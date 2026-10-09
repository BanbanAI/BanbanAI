import { Injectable, Optional } from "@nestjs/common";
import { EntityManager, EntityName, FilterQuery, Transaction } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { FlowScheduleCursor, FlowScheduledRun, FlowScheduleFire } from "../entities";
import { FlowScheduleDefinition, FlowScheduleProjectionChange, FlowScheduleChangeOutbox, FlowScheduleSubscriptionBackfill } from "../entities";
import { Nocode } from "../../project/entities";
import { ScheduledTriggerSignal } from "./scheduled-trigger-signal";

export const SCHEDULE_GLOBAL_SUBJECT = "__global__";
const PROJECTION_CHANGE_BATCH_SIZE = 200;
const SQLITE_MAX_VARIABLES = 30_000;
const PROJECTION_CHANGE_PARAMS_PER_PAIR = 10;
const EXTERNAL_CHANGE_FALLBACK_DELAY_MS = 30_000;

export type ProjectionChangePublishToken = {
  id: string;
  updatedAt: number;
};

export type AcceptScheduledRunInput = {
  cursorId: string;
  scheduleId: string;
  fireId: string;
  configHash: string;
  subjectKey: string;
  recordId?: string;
  scheduledFor: number;
  nextFireAt?: number;
  completed: boolean;
  now: number;
  leaseOwner?: string;
  lifecycleEpoch?: number;
  initiatorUserId?: string;
};

export type LeaseInput = {
  owner: string;
  now: number;
  leaseMs: number;
  limit: number;
  scheduleId?: string;
};

export type ScheduleChangeLeaseInput = {
  owner: string;
  now: number;
  leaseMs: number;
  limit: number;
};

export type ProjectionChangeLeaseInput = LeaseInput;

export type SubscriptionBackfillInput = {
  owner: string;
  now: number;
  leaseMs: number;
  limit: number;
  lowWatermark: number;
  highWatermark: number;
};

export type SubscriptionBackfillResult = {
  state: "completed" | "leased" | "blocked" | "progressed";
  checkpoint?: string;
  enqueued: number;
  outstandingChanges: number;
  nextAt?: number;
};

export type FinishRunInput = {
  runId: string;
  owner: string;
  /** Durable lease generation. Required by production workers; optional for legacy callers. */
  leaseVersion?: number;
  now: number;
  state: "succeeded" | "skipped" | "retry_wait" | "dead_letter" | "canceled";
  availableAt?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type SkipAndAdvanceCursorInput = {
  cursorId: string;
  scheduleId: string;
  fireId: string;
  scheduledFor: number;
  nextFireAt?: number;
  state?: "ready" | "completed" | "invalid";
  invalidReason?: string;
  now: number;
  leaseOwner?: string;
  lifecycleEpoch?: number;
};

export type RenewRunLeaseInput = {
  runId: string;
  owner: string;
  leaseVersion: number;
  now: number;
  leaseMs: number;
};

export type ReleaseCursorAfterUnavailableFireInput = {
  cursorId: string;
  scheduleId: string;
  now: number;
  leaseOwner?: string;
};

export type RescheduleLeasedCursorInput = {
  cursorId: string;
  scheduleId: string;
  nextFireAt?: number;
  state: "ready" | "completed" | "invalid";
  invalidReason?: string;
  now: number;
  leaseOwner: string;
};

@Injectable()
export class ScheduledTriggerRepository {
  constructor(
    private readonly rootEntityManager: EntityManager,
    @Optional() private readonly signal?: ScheduledTriggerSignal,
  ) {}

  private wake(reason: "definition" | "subscription_backfill" | "projection" | "cursor" | "run" | "lease" | "lifecycle") {
    this.signal?.wake(reason)
  }

  private manager(): EntityManager {
    const driver = this.rootEntityManager.getDriver?.();
    return driver?.createEntityManager
      ? driver.createEntityManager(false) as EntityManager
      : this.rootEntityManager;
  }

  private transactional<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    // Keep scheduler transactions out of MikroORM's global TransactionContext.
    // The scheduler runs from long-lived timers, so a leaked async context can
    // make later reads use a completed Knex transaction.
    const driver = this.rootEntityManager.getDriver?.();
    const connection = driver?.getConnection?.();
    if (driver?.createEntityManager && connection?.transactional) {
      const em = driver.createEntityManager(false) as EntityManager;
      return connection.transactional(async (trx: unknown) => {
        em.setTransactionContext?.(trx as Transaction);
        try {
          const result = await callback(em);
          await em.flush();
          return result;
        } finally {
          em.resetTransactionContext?.();
        }
      });
    }
    const em = typeof this.rootEntityManager.fork === "function"
      ? this.rootEntityManager.fork()
      : this.rootEntityManager;
    return em.transactional(callback);
  }

  private async findNocode(em: EntityManager, nocodeId?: string): Promise<Nocode | null | undefined> {
    if (!nocodeId) return undefined;
    let entityRegistered: boolean | undefined;
    // A few migration/isolated scheduler databases intentionally contain only
    // scheduler tables. In that case the definition state remains the gate;
    // the full application database includes the Nocode entity and gets the
    // stronger soft-delete check below.
    try {
      const metadata = em.getMetadata();
      entityRegistered = Boolean(metadata.find(Nocode.name));
      if (!entityRegistered) return null;
    } catch {
      // Fall through to the normal query; drivers without metadata access are
      // still expected to expose findOne.
    }
    try {
      const nocode = await em.findOne(Nocode, { id: nocodeId });
      // `null` means this is an isolated scheduler-only database. When the
      // complete business schema is registered, a missing app must fail closed
      // instead of allowing an orphaned definition to create new runs.
      return nocode || (entityRegistered ? undefined : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/metadata|entity.+discovered|not.+known/i.test(message)) return null;
      throw error;
    }
  }

  async acceptRunAndAdvanceCursor(input: AcceptScheduledRunInput): Promise<FlowScheduledRun | null> {
    const run = await this.transactional(async em => {
      const cursor = await em.findOne(FlowScheduleCursor, {
        id: input.cursorId,
        ...(input.leaseOwner ? { state: "leased", leaseOwner: input.leaseOwner } : {}),
      });
      const definition = await em.findOne(FlowScheduleDefinition, { id: input.scheduleId });
      let run = await em.findOne(FlowScheduledRun, { scheduleId: input.scheduleId, subjectKey: input.subjectKey, scheduledFor: input.scheduledFor });
      if (!cursor || cursor.scheduleId !== input.scheduleId) return null;

      // The cursor lease can outlive an app lifecycle transition.  Check the
      // definition, epoch and soft-delete flag in the acceptance transaction
      // before creating a fire/run; starter-side checks are intentionally too
      // late because they would leave an accepted queue item behind.
      const nocode = await this.findNocode(em, definition?.nocodeId);
      const lifecycleMatches = input.lifecycleEpoch === undefined
        || definition?.lifecycleEpoch === input.lifecycleEpoch;
      const canAccept = Boolean(
        definition
        && definition.state === "active"
        && lifecycleMatches
        && (nocode === null || (nocode !== undefined && nocode.deleted !== true)),
      );
      if (!canAccept) {
        if (cursor.state === "leased" && (!input.leaseOwner || cursor.leaseOwner === input.leaseOwner)) {
          cursor.state = nocode === undefined || nocode?.deleted === true ? "disabled" : "ready";
          cursor.leaseOwner = undefined;
          cursor.leaseUntil = undefined;
          cursor.updatedAt = input.now;
          em.persist(cursor);
        }
        return null;
      }
      if (cursor.lastScheduledFor === input.scheduledFor) {
        cursor.nextFireAt = input.nextFireAt;
        cursor.state = input.completed ? "completed" : "ready";
        cursor.conditionScanScheduledFor = undefined;
        cursor.conditionScanCheckpoint = undefined;
        cursor.leaseOwner = undefined;
        cursor.leaseUntil = undefined;
        cursor.updatedAt = input.now;
        em.persist(cursor);
        await em.flush();
        if (definition) {
          definition.headDirty = true;
          definition.headVersion += 1;
          if (input.nextFireAt !== undefined && (definition.nextDueAt === undefined || input.nextFireAt < definition.nextDueAt)) definition.nextDueAt = input.nextFireAt;
          em.persist(definition);
        }
        return run;
      }

      const fire = await em.findOne(FlowScheduleFire, { id: input.fireId });
      if (!fire || (fire.lifecycleEpoch ?? 0) !== definition.lifecycleEpoch) {
        if (cursor.state === "leased" && (!input.leaseOwner || cursor.leaseOwner === input.leaseOwner)) {
          cursor.state = "ready";
          cursor.leaseOwner = undefined;
          cursor.leaseUntil = undefined;
          cursor.updatedAt = input.now;
          em.persist(cursor);
        }
        return null;
      }

      if (!run) {
        run = em.create(FlowScheduledRun, {
          id: unique(), fireId: input.fireId, scheduleId: input.scheduleId, configHash: input.configHash,
          subjectKey: input.subjectKey, recordId: input.recordId, scheduledFor: input.scheduledFor,
          queuedAt: input.now, availableAt: input.now, todoId: unique(32),
          lifecycleEpoch: input.lifecycleEpoch ?? definition?.lifecycleEpoch ?? 0,
          initiatorUserId: input.initiatorUserId || definition?.initiatorUserId || "admin",
        });
        em.persist(run);
        fire.acceptedCount += 1;
        em.persist(fire);
      }

      cursor.lastScheduledFor = input.scheduledFor;
      cursor.nextFireAt = input.nextFireAt;
      cursor.state = input.completed ? "completed" : "ready";
      cursor.conditionScanScheduledFor = undefined;
      cursor.conditionScanCheckpoint = undefined;
      cursor.leaseOwner = undefined;
      cursor.leaseUntil = undefined;
      cursor.updatedAt = input.now;
      em.persist(cursor);
      if (definition) {
        definition.headDirty = true;
        definition.headVersion += 1;
        if (input.nextFireAt !== undefined && (definition.nextDueAt === undefined || input.nextFireAt < definition.nextDueAt)) definition.nextDueAt = input.nextFireAt;
        em.persist(definition);
      }
      await em.flush();
      return run;
    });
    if (run) this.wake("run");
    return run;
  }

  async findDueCursors(now: number, limit: number, scheduleId?: string): Promise<FlowScheduleCursor[]> {
    return this.manager().find(FlowScheduleCursor, {
      state: "ready",
      nextFireAt: { $lte: now },
      ...(scheduleId ? { scheduleId } : {}),
    }, { orderBy: { nextFireAt: "ASC", id: "ASC" }, limit });
  }

  async leaseDueCursors(scheduleId: string, owner: string, now: number, leaseMs: number, limit: number): Promise<FlowScheduleCursor[]> {
    const em = this.manager();
    const candidates = await em.find(FlowScheduleCursor, {
      state: "ready",
      nextFireAt: { $lte: now },
      scheduleId,
    }, { orderBy: { nextFireAt: "ASC", id: "ASC" }, limit });
    const leased: FlowScheduleCursor[] = [];
    for (const candidate of candidates) {
      const updated = await em.nativeUpdate(FlowScheduleCursor, {
        id: candidate.id,
        scheduleId,
        state: "ready",
        nextFireAt: { $lte: now },
      }, { state: "leased", leaseOwner: owner, leaseUntil: now + leaseMs });
      if (!updated) continue;
      Object.assign(candidate, { state: "leased", leaseOwner: owner, leaseUntil: now + leaseMs });
      leased.push(candidate);
    }
    return leased;
  }

  async recoverExpiredCursorLeases(now: number, limit = 200): Promise<number> {
    const updated = await this.transactional(async em => {
      const expired = await em.find(FlowScheduleCursor, {
        state: "leased",
        leaseUntil: { $lte: now },
      }, { orderBy: { leaseUntil: "ASC", id: "ASC" }, limit });
      if (!expired.length) return 0;
      const recovered = await em.nativeUpdate(FlowScheduleCursor, {
        id: { $in: expired.map(item => item.id) },
        state: "leased",
        leaseUntil: { $lte: now },
      }, { state: "ready", leaseOwner: null, leaseUntil: null, updatedAt: now });
      if (!recovered) return 0;
      const definitions = await em.find(FlowScheduleDefinition, {
        id: { $in: Array.from(new Set(expired.map(item => item.scheduleId))) },
      });
      for (const definition of definitions) {
        definition.headDirty = true;
        definition.headVersion += 1;
        definition.updatedAt = now;
        em.persist(definition);
      }
      return recovered;
    });
    if (updated) this.wake("lease");
    return updated;
  }

  async releaseCursorLease(cursorId: string, owner: string, wake = true): Promise<boolean> {
    const released = await this.manager().nativeUpdate(FlowScheduleCursor, {
      id: cursorId,
      state: "leased",
      leaseOwner: owner,
    }, { state: "ready", leaseOwner: null, leaseUntil: null }) > 0;
    if (released && wake) this.wake("cursor");
    return released;
  }

  async rescheduleLeasedCursor(input: RescheduleLeasedCursorInput): Promise<boolean> {
    const updated = await this.transactional(async em => {
      const definition = await em.findOne(FlowScheduleDefinition, { id: input.scheduleId });
      if (!definition) return false;
      const cursorUpdated = await em.nativeUpdate(FlowScheduleCursor, {
        id: input.cursorId,
        scheduleId: input.scheduleId,
        state: "leased",
        leaseOwner: input.leaseOwner,
      }, {
        nextFireAt: input.nextFireAt,
        state: input.state,
        invalidReason: input.invalidReason,
        conditionScanScheduledFor: null,
        conditionScanCheckpoint: null,
        leaseOwner: null,
        leaseUntil: null,
        updatedAt: input.now,
      });
      if (!cursorUpdated) return false;
      definition.headDirty = true;
      definition.headVersion += 1;
      if (input.nextFireAt !== undefined && (definition.nextDueAt === undefined || input.nextFireAt < definition.nextDueAt)) {
        definition.nextDueAt = input.nextFireAt;
      }
      em.persist(definition);
      return true;
    });
    if (updated) this.wake("cursor");
    return updated;
  }

  async saveConditionScanCheckpoint(input: {
    cursorId: string;
    scheduleId: string;
    scheduledFor: number;
    checkpoint: string;
    leaseOwner?: string;
  }): Promise<boolean> {
    return await this.manager().nativeUpdate(FlowScheduleCursor, {
      id: input.cursorId,
      scheduleId: input.scheduleId,
      state: "leased",
      ...(input.leaseOwner ? { leaseOwner: input.leaseOwner } : {}),
    }, {
      conditionScanScheduledFor: input.scheduledFor,
      conditionScanCheckpoint: input.checkpoint,
      updatedAt: Date.now(),
    }) > 0;
  }

  async hasDueCursors(scheduleId: string, now: number): Promise<boolean> {
    return Boolean(await this.manager().findOne(FlowScheduleCursor, {
      scheduleId,
      state: "ready",
      nextFireAt: { $lte: now },
    }, { orderBy: { nextFireAt: "ASC", id: "ASC" } }));
  }

  async findCursor(scheduleId: string, subjectKey: string): Promise<FlowScheduleCursor | null> {
    return this.manager().findOne(FlowScheduleCursor, { scheduleId, subjectKey });
  }

  async findCursorSubjectKeys(scheduleId: string): Promise<string[]> {
    const cursors = await this.manager().find(FlowScheduleCursor, { scheduleId });
    return cursors.map(cursor => cursor.subjectKey).filter(Boolean);
  }

  async findDefinition(id: string): Promise<FlowScheduleDefinition | null> {
    return this.manager().findOne(FlowScheduleDefinition, { id });
  }

  async findRunnableDefinition(
    id: string,
    configHash?: string,
    lifecycleEpoch?: number,
  ): Promise<FlowScheduleDefinition | null> {
    const em = this.manager();
    const definition = await em.findOne(FlowScheduleDefinition, {
      id,
      state: "active",
      ...(configHash ? { configHash } : {}),
      ...(lifecycleEpoch === undefined ? {} : { lifecycleEpoch }),
    });
    if (!definition) return null;
    const nocode = await this.findNocode(em, definition.nocodeId);
    return nocode === undefined || nocode?.deleted === true ? null : definition;
  }

  async hasProjectionDefinitions(nocodeId: string, tableId: string): Promise<boolean> {
    return Boolean(await this.manager().findOne(FlowScheduleDefinition, {
      nocodeId,
      tableId,
      executionScope: "per_record",
      state: { $in: ["building", "active"] },
    }, { fields: ["id"] }));
  }

  async findDefinitionByHash(scheduleKey: string, configHash: string): Promise<FlowScheduleDefinition | null> {
    return this.manager().findOne(FlowScheduleDefinition, { scheduleKey, configHash });
  }

  async findLatestDefinition(scheduleKey: string): Promise<FlowScheduleDefinition | null> {
    const definitions = await this.manager().find(FlowScheduleDefinition, { scheduleKey }, { orderBy: { revision: "DESC" }, limit: 1 });
    return definitions[0] || null;
  }

  async findDueDefinitions(now: number, limit: number): Promise<FlowScheduleDefinition[]> {
    const em = this.manager();
    const dirty = await em.find(FlowScheduleDefinition, {
      state: "active",
      headDirty: true,
    }, { orderBy: { updatedAt: "ASC", id: "ASC" }, limit });
    if (dirty.length >= limit) return dirty;
    const dueWhere: FilterQuery<FlowScheduleDefinition> = {
      state: "active",
      headDirty: false,
      nextDueAt: { $lte: now },
    };
    const dueLimit = limit - dirty.length;
    const neverDispatched = await em.find(FlowScheduleDefinition, {
      ...dueWhere,
      dispatchRotationKey: null,
    } as FilterQuery<FlowScheduleDefinition>, {
      orderBy: { nextDueAt: "ASC", id: "ASC" },
      limit: dueLimit,
    });
    if (neverDispatched.length >= dueLimit) return dirty.concat(neverDispatched);
    const rotated = await em.find(FlowScheduleDefinition, {
      ...dueWhere,
      dispatchRotationKey: { $ne: null },
    } as FilterQuery<FlowScheduleDefinition>, {
      orderBy: { dispatchRotationKey: "ASC", nextDueAt: "ASC", id: "ASC" },
      limit: dueLimit - neverDispatched.length,
    });
    return dirty.concat(neverDispatched, rotated);
  }

  async markDefinitionsDispatched(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    return this.transactional(async em => {
      const latest = await em.findOne(FlowScheduleDefinition, {
        dispatchRotationKey: { $ne: null },
      } as FilterQuery<FlowScheduleDefinition>, {
        orderBy: { dispatchRotationKey: "DESC" },
      });
      const next = (BigInt(latest?.dispatchRotationKey || "0") + 1n).toString().padStart(20, "0");
      return em.nativeUpdate(FlowScheduleDefinition, { id: { $in: ids } }, { dispatchRotationKey: next });
    });
  }

  async findEarliestDefinitionDueAt(now = Date.now()): Promise<number | undefined> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const dirty = await this.manager().findOne(FlowScheduleDefinition, {
        state: "active",
        headDirty: true,
      }, { orderBy: { updatedAt: "ASC", id: "ASC" } });
      if (!dirty) break;
      await this.rebuildDefinitionHead(dirty.id, now);
    }
    // A large configuration replay can leave more dirty heads than the
    // bounded rebuild window. Return an immediate-but-nonzero retry marker so
    // the next batch continues without pretending a future due time is safe.
    const remainingDirty = await this.manager().findOne(FlowScheduleDefinition, {
      state: "active",
      headDirty: true,
    }, { orderBy: { updatedAt: "ASC", id: "ASC" } });
    if (remainingDirty) return now;
    const definition = await this.manager().findOne(FlowScheduleDefinition, {
      state: "active",
      headDirty: false,
      nextDueAt: { $ne: null },
    }, { orderBy: { nextDueAt: "ASC", id: "ASC" } });
    return definition?.nextDueAt;
  }

  async rebuildDefinitionHead(scheduleId: string, now = Date.now()): Promise<number | undefined> {
    return this.transactional(async em => {
      const definition = await em.findOne(FlowScheduleDefinition, { id: scheduleId });
      if (!definition || definition.state !== "active") return undefined;
      const version = definition.headVersion;
      const cursor = await em.findOne(FlowScheduleCursor, {
        scheduleId,
        state: "ready",
        nextFireAt: { $ne: null },
      }, { orderBy: { nextFireAt: "ASC", id: "ASC" } });
      const current = await em.findOne(FlowScheduleDefinition, { id: scheduleId });
      if (!current || current.headVersion !== version || current.state !== "active") return current?.nextDueAt;
      current.nextDueAt = cursor?.nextFireAt;
      current.headDirty = false;
      current.updatedAt = now;
      em.persist(current);
      return current.nextDueAt;
    });
  }

  /*
   * Kept as a separate helper so projection writes can check the lifecycle
   * epoch in the same transaction as the cursor upsert. A pre-check in the
   * consumer alone would allow a recycle-bin transition to race the write.
   */
  async upsertCursorForDefinition(
    input: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">,
    lifecycleEpoch: number,
  ): Promise<FlowScheduleCursor | null> {
    const cursor = await this.transactional(async em => {
      const definition = await em.findOne(FlowScheduleDefinition, { id: input.scheduleId });
      if (!definition || !["building", "active"].includes(definition.state) || (definition.lifecycleEpoch ?? 0) !== lifecycleEpoch) return null;
      const nocode = await this.findNocode(em, definition.nocodeId);
      if (nocode === undefined || nocode?.deleted === true) return null;
      const result = await this.upsertCursorWithManager(em, input);
      await this.markHeadsDirty(em, [input.scheduleId], Number.isFinite(input.nextFireAt) ? input.nextFireAt : undefined);
      return result;
    });
    if (cursor) this.wake("cursor");
    return cursor;
  }

  async upsertCursorsForDefinition(
    inputs: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">[],
    lifecycleEpoch: number,
  ): Promise<boolean> {
    if (!inputs.length) return true;
    const updated = await this.transactional(async em => {
      const scheduleId = inputs[0].scheduleId;
      if (inputs.some(input => input.scheduleId !== scheduleId)) return false;
      const definition = await em.findOne(FlowScheduleDefinition, { id: scheduleId });
      if (!definition || !["building", "active"].includes(definition.state) || (definition.lifecycleEpoch ?? 0) !== lifecycleEpoch) return false;
      const nocode = await this.findNocode(em, definition.nocodeId);
      if (nocode === undefined || nocode?.deleted === true) return false;
      for (const input of inputs) await this.upsertCursorWithManager(em, input);
      const dueTimes = inputs
        .map(input => input.nextFireAt)
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
      await this.markHeadsDirty(em, [scheduleId], dueTimes.length ? Math.min(...dueTimes) : undefined);
      return true;
    });
    if (updated) this.wake("cursor");
    return updated;
  }

  async saveDefinition(input: Partial<FlowScheduleDefinition>): Promise<FlowScheduleDefinition | null> {
    const definition = await this.transactional(async em => {
      let current = input.id ? await em.findOne(FlowScheduleDefinition, { id: input.id }) : null;
      if (!current && input.scheduleKey && input.configHash) {
        current = await em.findOne(FlowScheduleDefinition, { scheduleKey: input.scheduleKey, configHash: input.configHash });
      }
      const nocode = await this.findNocode(em, input.nocodeId || current?.nocodeId);
      if (nocode === undefined || nocode?.deleted === true) return null;
      if (!current) {
        current = em.create(FlowScheduleDefinition, {
          id: unique(),
          revision: input.revision || 1,
          ...input,
        });
      } else {
        Object.assign(current, input, { updatedAt: Date.now() });
      }
      if (!current.initiatorUserId) current.initiatorUserId = "admin";
      em.persist(current);
      return current;
    });
    if (definition) this.wake("definition");
    return definition;
  }

  async saveDefinitionBuildCheckpoint(id: string, configHash: string, lifecycleEpoch: number, buildCheckpoint: string): Promise<boolean> {
    const updated = await this.manager().nativeUpdate(FlowScheduleDefinition, {
      id,
      configHash,
      lifecycleEpoch,
      state: "building",
    }, {
      buildCheckpoint,
      updatedAt: Date.now(),
    });
    if (updated) this.wake("definition");
    return updated > 0;
  }

  async activateDefinition(id: string, configHash: string, lifecycleEpoch: number, buildCheckpoint?: string): Promise<boolean> {
    const updated = await this.manager().nativeUpdate(FlowScheduleDefinition, {
      id,
      configHash,
      lifecycleEpoch,
      state: "building",
    }, {
      state: "active",
      headDirty: true,
      ...(buildCheckpoint === undefined ? {} : { buildCheckpoint }),
      updatedAt: Date.now(),
    });
    if (updated) this.wake("definition");
    return updated > 0;
  }

  async failDefinitionBuild(id: string, configHash: string, lifecycleEpoch: number): Promise<boolean> {
    const updated = await this.manager().nativeUpdate(FlowScheduleDefinition, {
      id,
      configHash,
      lifecycleEpoch,
      state: "building",
    }, {
      state: "failed",
      updatedAt: Date.now(),
    });
    if (updated) this.wake("definition");
    return updated > 0;
  }

  async retireOtherRevisions(scheduleKey: string, activeId: string): Promise<number> {
    const updatedAt = Date.now();
    const updated = await this.transactional(async em => {
      const definitions = await em.find(FlowScheduleDefinition, {
        scheduleKey,
        id: { $ne: activeId },
        state: { $in: ["building", "active"] },
      });
      if (!definitions.length) return 0;
      const ids = definitions.map(item => item.id);
      for (const definition of definitions) {
        definition.state = "retired";
        definition.lifecycleEpoch = (definition.lifecycleEpoch || 0) + 1;
        definition.nextDueAt = undefined;
        definition.headDirty = false;
        definition.updatedAt = updatedAt;
        em.persist(definition);
      }
      await em.nativeUpdate(FlowScheduleCursor, { scheduleId: { $in: ids }, state: { $in: ["ready", "leased"] } }, {
        state: "disabled", leaseOwner: null, leaseUntil: null, updatedAt,
      });
      await em.nativeUpdate(FlowScheduledRun, { scheduleId: { $in: ids }, state: { $in: ["queued", "retry_wait"] } }, {
        state: "canceled", finishedAt: updatedAt, leaseOwner: null, leaseUntil: null, errorCode: "SCHEDULE_RETIRED",
      });
      return definitions.length;
    });
    if (updated) this.wake("lifecycle");
    return updated;
  }

  async retireMissingSchedules(scheduleKeys: string[]): Promise<number> {
    if (!scheduleKeys.length) return 0;
    return this.manager().nativeUpdate(FlowScheduleDefinition, {
      state: "active",
      scheduleKey: { $nin: scheduleKeys },
    }, { state: "retired", updatedAt: Date.now() });
  }

  async retireSchedulesForNocodeIds(nocodeIds: string[], activeScheduleKeys: string[]): Promise<number> {
    if (!nocodeIds.length) return 0;
    const updatedAt = Date.now();
    const updated = await this.transactional(async em => {
      const definitions = await em.find(FlowScheduleDefinition, {
        state: { $in: ["building", "active"] },
        nocodeId: { $in: nocodeIds },
        ...(activeScheduleKeys.length ? { scheduleKey: { $nin: activeScheduleKeys } } : {}),
      });
      if (!definitions.length) return 0;
      const ids = definitions.map(item => item.id);
      for (const definition of definitions) {
        definition.state = "retired";
        definition.lifecycleEpoch = (definition.lifecycleEpoch || 0) + 1;
        definition.nextDueAt = undefined;
        definition.headDirty = false;
        definition.updatedAt = updatedAt;
        em.persist(definition);
      }
      await em.nativeUpdate(FlowScheduleCursor, { scheduleId: { $in: ids }, state: { $in: ["ready", "leased"] } }, {
        state: "disabled", leaseOwner: null, leaseUntil: null, updatedAt,
      });
      await em.nativeUpdate(FlowScheduledRun, { scheduleId: { $in: ids }, state: { $in: ["queued", "retry_wait"] } }, {
        state: "canceled", finishedAt: updatedAt, leaseOwner: null, leaseUntil: null, errorCode: "SCHEDULE_RETIRED",
      });
      return definitions.length;
    });
    if (updated) this.wake("lifecycle");
    return updated;
  }

  async retireSchedulesByNocodeId(nocodeId: string): Promise<number> {
    return this.retireSchedulesForNocodeIds([nocodeId], []);
  }

  private async pauseSchedulesWithManager(em: EntityManager, nocodeId: string, now: number): Promise<number> {
    const definitions = await em.find(FlowScheduleDefinition, {
      nocodeId,
      state: { $in: ["building", "active"] },
    });
    if (!definitions.length) return 0;
    const ids = definitions.map(item => item.id);
    for (const definition of definitions) {
      definition.state = "paused";
      definition.pauseReason = "soft_deleted";
      definition.lifecycleEpoch = (definition.lifecycleEpoch || 0) + 1;
      definition.nextDueAt = undefined;
      definition.headDirty = false;
      definition.updatedAt = now;
      em.persist(definition);
    }
    await em.nativeUpdate(FlowScheduleCursor, { scheduleId: { $in: ids }, state: { $in: ["ready", "leased"] } }, {
      state: "disabled", leaseOwner: null, leaseUntil: null, updatedAt: now,
    });
    await em.nativeUpdate(FlowScheduledRun, { scheduleId: { $in: ids }, state: { $in: ["queued", "retry_wait"] } }, {
      state: "canceled", finishedAt: now, leaseOwner: null, leaseUntil: null, errorCode: "APP_IN_RECYCLE_BIN",
    });
    return definitions.length;
  }

  async softDeleteNocodeAndPauseSchedules(nocodeId: string, deleteTime = Date.now()): Promise<Nocode | null> {
    const result = await this.transactional(async em => {
      const nocode = await em.findOne(Nocode, { id: nocodeId });
      if (!nocode) return null;
      nocode.deleted = true;
      nocode.deleteTime = deleteTime;
      em.persist(nocode);
      const paused = await this.pauseSchedulesWithManager(em, nocodeId, deleteTime);
      return { nocode, paused };
    });
    if (result?.paused) this.wake("lifecycle");
    return result?.nocode || null;
  }

  async pauseSchedulesByNocodeId(nocodeId: string): Promise<number> {
    const now = Date.now();
    const updated = await this.transactional(em => this.pauseSchedulesWithManager(em, nocodeId, now));
    if (updated) this.wake("lifecycle");
    return updated;
  }

  async resumeSchedulesByNocodeId(nocodeId: string): Promise<number> {
    const updated = await this.transactional(async em => {
      const nocode = await this.findNocode(em, nocodeId);
      if (nocode === undefined || nocode?.deleted === true) return 0;
      const definitions = await em.find(FlowScheduleDefinition, {
        nocodeId,
        state: "paused",
        ...(nocode === null ? {} : { pauseReason: "soft_deleted" }),
      });
      const ids = definitions.map(item => item.id);
      for (const definition of definitions) {
        definition.state = "building";
        definition.pauseReason = undefined;
        definition.lifecycleEpoch = (definition.lifecycleEpoch || 0) + 1;
        definition.headDirty = true;
        definition.updatedAt = Date.now();
        em.persist(definition);
      }
      if (ids.length) {
        await em.nativeUpdate(FlowScheduleCursor, { scheduleId: { $in: ids }, state: "disabled", nextFireAt: { $ne: null } }, { state: "ready", updatedAt: Date.now() });
      }
      return definitions.length;
    });
    if (updated) this.wake("lifecycle");
    return updated;
  }

  async findBuildingDefinitions(limit = 8): Promise<FlowScheduleDefinition[]> {
    return this.manager().find(FlowScheduleDefinition, {
      state: "building",
      executionScope: "per_record",
    }, { orderBy: { updatedAt: "ASC", id: "ASC" }, limit });
  }

  async findReconciliationDefinition(): Promise<FlowScheduleDefinition | null> {
    return this.manager().findOne(FlowScheduleDefinition, {
      state: "active",
      executionScope: "per_record",
    }, { orderBy: { updatedAt: "ASC", id: "ASC" } });
  }

  async findProjectionCursorsAfter(scheduleId: string, after: string | undefined, limit: number): Promise<FlowScheduleCursor[]> {
    return this.manager().find(FlowScheduleCursor, {
      scheduleId,
      recordId: { $ne: null },
      ...(after ? { subjectKey: { $gt: after } } : {}),
    }, { orderBy: { subjectKey: "ASC", id: "ASC" }, limit });
  }

  async saveDefinitionReconcileCheckpoint(
    id: string,
    configHash: string,
    lifecycleEpoch: number,
    reconcileCheckpoint: string,
    now: number,
  ): Promise<boolean> {
    return await this.manager().nativeUpdate(FlowScheduleDefinition, {
      id,
      configHash,
      lifecycleEpoch,
      state: "active",
    }, {
      reconcileCheckpoint,
      updatedAt: now,
    }) > 0;
  }

  async findEarliestRunAvailableAt(): Promise<number | undefined> {
    const run = await this.manager().findOne(FlowScheduledRun, {
      state: { $in: ["queued", "retry_wait"] },
      availableAt: { $ne: null },
    }, { orderBy: { availableAt: "ASC", id: "ASC" } });
    return run?.availableAt;
  }

  async findEarliestRunLeaseUntil(): Promise<number | undefined> {
    const run = await this.manager().findOne(FlowScheduledRun, {
      state: "running",
      leaseUntil: { $ne: null },
    }, { orderBy: { leaseUntil: "ASC", id: "ASC" } });
    return run?.leaseUntil;
  }

  async findEarliestCursorLeaseUntil(): Promise<number | undefined> {
    const cursor = await this.manager().findOne(FlowScheduleCursor, {
      state: "leased",
      leaseUntil: { $ne: null },
    }, { orderBy: { leaseUntil: "ASC", id: "ASC" } });
    return cursor?.leaseUntil;
  }

  async queueScheduleChange(
    nocodeId: string,
    reason = "configuration",
    availableAt = Date.now(),
    updatedAt = availableAt,
  ): Promise<FlowScheduleChangeOutbox | null> {
    if (!nocodeId) return null;
    const change = await this.transactional(async em => {
      let item = await em.findOne(FlowScheduleChangeOutbox, { nocodeId });
      if (!item) {
        item = em.create(FlowScheduleChangeOutbox, { id: unique(), nocodeId });
      }
      item.reason = reason;
      item.aggregateVersion += 1;
      item.state = "pending";
      item.availableAt = availableAt;
      item.leaseOwner = undefined;
      item.leaseUntil = undefined;
      item.attemptCount = 0;
      item.updatedAt = updatedAt;
      em.persist(item);
      return item;
    });
    this.wake("definition");
    return change;
  }

  async advanceSubscriptionBackfill(input: SubscriptionBackfillInput): Promise<SubscriptionBackfillResult> {
    let shouldWake = false;
    const result = await this.transactional(async em => {
      let marker = await em.findOne(FlowScheduleSubscriptionBackfill, { id: "flow-schedule-subscription-backfill-2.0.0-v1" });
      if (!marker) {
        marker = em.create(FlowScheduleSubscriptionBackfill, {
          id: "flow-schedule-subscription-backfill-2.0.0-v1",
          createdAt: input.now,
          updatedAt: input.now,
        });
        em.persist(marker);
        await em.flush();
      }
      if (marker.state === "completed") {
        return { state: "completed" as const, checkpoint: marker.checkpoint, enqueued: 0, outstandingChanges: 0 };
      }
      const claimed = await em.nativeUpdate(FlowScheduleSubscriptionBackfill, {
        id: marker.id,
        state: { $ne: "completed" },
        $or: [
          { leaseOwner: input.owner },
          { leaseOwner: null },
          { leaseUntil: null },
          { leaseUntil: { $lte: input.now } },
        ],
      }, {
        state: "running",
        leaseOwner: input.owner,
        leaseUntil: input.now + input.leaseMs,
        updatedAt: input.now,
      });
      const refreshedMarker = await em.findOne(
        FlowScheduleSubscriptionBackfill,
        { id: marker.id },
        { refresh: true },
      );
      if (!refreshedMarker) throw new Error("subscription backfill marker disappeared");
      marker = refreshedMarker;
      if (!claimed) {
        if (marker.state === "completed") {
          return { state: "completed" as const, checkpoint: marker.checkpoint, enqueued: 0, outstandingChanges: 0 };
        }
        return {
          state: "leased" as const,
          checkpoint: marker.checkpoint,
          enqueued: 0,
          outstandingChanges: 0,
          nextAt: marker.leaseUntil,
        };
      }

      const outstanding = await em.find(FlowScheduleChangeOutbox, {
        state: { $in: ["pending", "leased"] },
      }, {
        fields: ["id"],
        limit: input.highWatermark + 1,
      });
      const outstandingChanges = outstanding.length;
      if (outstandingChanges > input.lowWatermark) {
        marker.state = "pending";
        marker.leaseOwner = undefined;
        marker.leaseUntil = undefined;
        marker.updatedAt = input.now;
        return {
          state: "blocked" as const,
          checkpoint: marker.checkpoint,
          enqueued: 0,
          outstandingChanges,
        };
      }

      const limit = Math.min(
        Math.max(1, input.limit),
        Math.max(0, input.highWatermark - outstandingChanges),
      );
      if (!limit) {
        marker.state = "pending";
        marker.leaseOwner = undefined;
        marker.leaseUntil = undefined;
        marker.updatedAt = input.now;
        return {
          state: "blocked" as const,
          checkpoint: marker.checkpoint,
          enqueued: 0,
          outstandingChanges,
        };
      }

      const nocodes = await em.find(Nocode, {
        ...(marker.checkpoint ? { id: { $gt: marker.checkpoint } } : {}),
        $or: [
          { deleted: { $ne: true } },
          { deleted: null },
        ],
      }, {
        orderBy: { id: "ASC" },
        limit,
        fields: ["id"],
      });
      const existingChanges = nocodes.length
        ? await em.find(FlowScheduleChangeOutbox, { nocodeId: { $in: nocodes.map(nocode => nocode.id) } })
        : [];
      const changesByNocodeId = new Map(existingChanges.map(change => [change.nocodeId, change]));
      for (const nocode of nocodes) {
        let change = changesByNocodeId.get(nocode.id);
        if (!change) change = em.create(FlowScheduleChangeOutbox, { id: unique(), nocodeId: nocode.id });
        change.reason = "subscription_backfill";
        change.aggregateVersion = (change.aggregateVersion || 0) + 1;
        change.state = "pending";
        change.availableAt = input.now;
        change.leaseOwner = undefined;
        change.leaseUntil = undefined;
        change.attemptCount = 0;
        change.updatedAt = input.now;
        em.persist(change);
      }
      if (nocodes.length) {
        marker.checkpoint = nocodes[nocodes.length - 1].id;
        marker.queuedCount += nocodes.length;
        shouldWake = true;
      }
      if (nocodes.length < limit) {
        marker.state = "completed";
        marker.completedAt = input.now;
        marker.leaseOwner = undefined;
        marker.leaseUntil = undefined;
      }
      marker.updatedAt = input.now;
      return {
        state: marker.state === "completed" ? "completed" as const : "progressed" as const,
        checkpoint: marker.checkpoint,
        enqueued: nocodes.length,
        outstandingChanges: outstandingChanges + nocodes.length,
      };
    });
    if (shouldWake) this.wake("subscription_backfill");
    return result;
  }

  async stageScheduleChange(nocodeId: string, reason: string): Promise<FlowScheduleChangeOutbox | null> {
    const now = Date.now();
    return this.queueScheduleChange(nocodeId, reason, now + EXTERNAL_CHANGE_FALLBACK_DELAY_MS, now);
  }

  async leaseScheduleChanges(input: ScheduleChangeLeaseInput): Promise<FlowScheduleChangeOutbox[]> {
    const em = this.manager();
    const candidates = await em.find(FlowScheduleChangeOutbox, {
      state: "pending",
      availableAt: { $lte: input.now },
    }, { orderBy: { availableAt: "ASC", id: "ASC" }, limit: input.limit });
    const leased: FlowScheduleChangeOutbox[] = [];
    for (const candidate of candidates) {
      const leaseUntil = input.now + input.leaseMs;
      const updated = await em.nativeUpdate(FlowScheduleChangeOutbox, {
        id: candidate.id,
        state: "pending",
        updatedAt: candidate.updatedAt,
        availableAt: { $lte: input.now },
      }, {
        state: "leased",
        leaseOwner: input.owner,
        leaseUntil,
        attemptCount: (candidate.attemptCount || 0) + 1,
      });
      if (!updated) continue;
      Object.assign(candidate, {
        state: "leased",
        leaseOwner: input.owner,
        leaseUntil,
        attemptCount: (candidate.attemptCount || 0) + 1,
      });
      leased.push(candidate);
    }
    return leased;
  }

  async recoverExpiredScheduleChangeLeases(now: number, limit = 64): Promise<number> {
    const em = this.manager();
    const expired = await em.find(FlowScheduleChangeOutbox, {
      state: "leased",
      leaseUntil: { $lte: now },
    }, { orderBy: { leaseUntil: "ASC", id: "ASC" }, limit });
    if (!expired.length) return 0;
    const updated = await em.nativeUpdate(FlowScheduleChangeOutbox, {
      id: { $in: expired.map(item => item.id) },
      state: "leased",
      leaseUntil: { $lte: now },
    }, { state: "pending", leaseOwner: null, leaseUntil: null, availableAt: now, updatedAt: now });
    if (updated) this.wake("lease");
    return updated;
  }

  async leaseProjectionChanges(input: ProjectionChangeLeaseInput): Promise<FlowScheduleProjectionChange[]> {
    const em = this.manager();
    const where: FilterQuery<FlowScheduleProjectionChange> = {
      state: "pending",
      availableAt: { $lte: input.now },
    };
    if (input.scheduleId) where.scheduleId = input.scheduleId;
    const candidates = await em.find(FlowScheduleProjectionChange, where, {
      orderBy: { availableAt: "ASC", id: "ASC" },
      limit: input.limit,
    });
    const leased: FlowScheduleProjectionChange[] = [];
    for (const candidate of candidates) {
      const leaseUntil = input.now + input.leaseMs;
      const updated = await em.nativeUpdate(FlowScheduleProjectionChange, {
        id: candidate.id,
        state: "pending",
        updatedAt: candidate.updatedAt,
        availableAt: { $lte: input.now },
      }, {
        state: "leased",
        leaseOwner: input.owner,
        leaseUntil,
        attemptCount: (candidate.attemptCount || 0) + 1,
      });
      if (!updated) continue;
      Object.assign(candidate, {
        state: "leased",
        leaseOwner: input.owner,
        leaseUntil,
        attemptCount: (candidate.attemptCount || 0) + 1,
      });
      leased.push(candidate);
    }
    return leased;
  }

  async recoverExpiredProjectionChangeLeases(now: number, limit = 200): Promise<number> {
    const em = this.manager();
    const expired = await em.find(FlowScheduleProjectionChange, {
      state: "leased",
      leaseUntil: { $lte: now },
    }, { orderBy: { leaseUntil: "ASC", id: "ASC" }, limit });
    if (!expired.length) return 0;
    const updated = await em.nativeUpdate(FlowScheduleProjectionChange, {
      id: { $in: expired.map(item => item.id) },
      state: "leased",
      leaseUntil: { $lte: now },
    }, {
      state: "pending",
      leaseOwner: null,
      leaseUntil: null,
      availableAt: now,
      updatedAt: now,
    });
    if (updated) this.wake("lease");
    return updated;
  }

  async completeProjectionChange(id: string, owner: string, updatedAt?: number): Promise<boolean> {
    const removed = await this.manager().nativeDelete(FlowScheduleProjectionChange, {
      id,
      state: "leased",
      leaseOwner: owner,
      ...(updatedAt === undefined ? {} : { updatedAt }),
    }) > 0;
    if (removed) this.wake("projection");
    return removed;
  }

  async failProjectionChange(id: string, owner: string, now: number, delayMs: number, deadLetter = false): Promise<boolean> {
    const current = await this.manager().findOne(FlowScheduleProjectionChange, { id, state: "leased", leaseOwner: owner });
    if (!current) return false;
    const failed = await this.manager().nativeUpdate(FlowScheduleProjectionChange, {
      id,
      state: "leased",
      leaseOwner: owner,
    }, {
      state: deadLetter ? "dead_letter" : "pending",
      availableAt: now + Math.max(0, delayMs),
      leaseOwner: null,
      leaseUntil: null,
      // attemptCount is incremented when the row is leased. Incrementing it
      // again here makes the retry/dead-letter threshold depend on failure
      // handling rather than on actual delivery attempts.
      attemptCount: current.attemptCount || 0,
      updatedAt: now,
    }) > 0;
    if (failed) this.wake("projection");
    return failed;
  }

  async completeScheduleChange(id: string, owner: string, updatedAt?: number): Promise<boolean> {
    const completed = await this.manager().nativeUpdate(FlowScheduleChangeOutbox, {
      id,
      state: "leased",
      leaseOwner: owner,
      ...(updatedAt === undefined ? {} : { updatedAt }),
    }, { state: "processed", leaseOwner: null, leaseUntil: null, updatedAt: Date.now() }) > 0;
    if (completed) this.wake("definition");
    return completed;
  }

  async failScheduleChange(id: string, owner: string, now: number, delayMs: number, deadLetter = false): Promise<boolean> {
    const current = await this.manager().findOne(FlowScheduleChangeOutbox, { id, state: "leased", leaseOwner: owner });
    if (!current) return false;
    const failed = await this.manager().nativeUpdate(FlowScheduleChangeOutbox, {
      id,
      state: "leased",
      leaseOwner: owner,
    }, {
      state: deadLetter ? "dead_letter" : "pending",
      availableAt: now + Math.max(0, delayMs),
      leaseOwner: null,
      leaseUntil: null,
      attemptCount: current.attemptCount || 0,
      updatedAt: now,
    }) > 0;
    if (failed) this.wake("definition");
    return failed;
  }

  async findEarliestScheduleChangeAt(): Promise<number | undefined> {
    const change = await this.manager().findOne(FlowScheduleChangeOutbox, {
      state: "pending",
    }, { orderBy: { availableAt: "ASC", id: "ASC" } });
    return change?.availableAt;
  }

  async findEarliestScheduleChangeLeaseUntil(): Promise<number | undefined> {
    const change = await this.manager().findOne(FlowScheduleChangeOutbox, {
      state: "leased",
      leaseUntil: { $ne: null },
    }, { orderBy: { leaseUntil: "ASC", id: "ASC" } });
    return change?.leaseUntil;
  }

  async ensureGlobalCursor(
    scheduleId: string,
    nextFireAt: number | undefined,
    now = Date.now(),
    lifecycleEpoch?: number,
    state?: "ready" | "completed" | "invalid",
    invalidReason?: string,
  ): Promise<FlowScheduleCursor | null> {
    const existing = await this.manager().findOne(FlowScheduleCursor, {
      scheduleId,
      subjectKey: SCHEDULE_GLOBAL_SUBJECT,
    });
    if (existing?.state === "disabled") {
      return this.upsertCursorForDefinition({
        scheduleId,
        subjectKey: SCHEDULE_GLOBAL_SUBJECT,
        nextFireAt: existing.nextFireAt,
        state: existing.nextFireAt === undefined ? "completed" : "ready",
        invalidReason: existing.invalidReason,
        projectionVersion: Math.max(existing.projectionVersion || 0, now),
      }, lifecycleEpoch ?? (await this.findDefinition(scheduleId))?.lifecycleEpoch ?? 0);
    }
    const canRecoverCalendar = existing?.state === "invalid"
      && existing.invalidReason === "CALENDAR_DATA_UNAVAILABLE"
      && state === "ready";
    if (existing && (existing.lastScheduledFor !== undefined || (existing.state !== "ready" && !canRecoverCalendar))) return existing;
    const definitionEpoch = lifecycleEpoch ?? (await this.findDefinition(scheduleId))?.lifecycleEpoch ?? 0;
    return this.upsertCursorForDefinition({
      scheduleId,
      subjectKey: SCHEDULE_GLOBAL_SUBJECT,
      nextFireAt,
      state: state || (nextFireAt ? "ready" : "completed"),
      invalidReason,
      projectionVersion: now,
    }, definitionEpoch);
  }

  async upsertCursor(input: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">): Promise<FlowScheduleCursor> {
    const cursor = await this.transactional(async em => {
      const result = await this.upsertCursorWithManager(em, input);
      await this.markHeadsDirty(em, [input.scheduleId], input.nextFireAt);
      return result;
    });
    this.wake("cursor");
    return cursor;
  }

  async upsertCursors(inputs: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">[]): Promise<void> {
    if (!inputs.length) return;
    await this.transactional(async em => {
      for (const input of inputs) await this.upsertCursorWithManager(em, input);
      const scheduleIds = Array.from(new Set(inputs.map(input => input.scheduleId)));
      const dueTimes = inputs
        .map(input => input.nextFireAt)
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
      await this.markHeadsDirty(em, scheduleIds, dueTimes.length ? Math.min(...dueTimes) : undefined);
    });
    this.wake("cursor");
  }

  private async markHeadsDirty(em: EntityManager, scheduleIds: string[], nextFireAt?: number) {
    if (!scheduleIds.length) return;
    const definitions = await em.find(FlowScheduleDefinition, { id: { $in: scheduleIds } });
    for (const definition of definitions) {
      definition.headDirty = true;
      definition.headVersion += 1;
      if (nextFireAt !== undefined && Number.isFinite(nextFireAt) && (definition.nextDueAt === undefined || nextFireAt < definition.nextDueAt)) {
        definition.nextDueAt = nextFireAt;
      }
      em.persist(definition);
    }
  }

  private async upsertCursorWithManager(em: EntityManager, input: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">): Promise<FlowScheduleCursor> {
    let cursor = await em.findOne(FlowScheduleCursor, { scheduleId: input.scheduleId, subjectKey: input.subjectKey });
    if (cursor && cursor.projectionVersion > input.projectionVersion) return cursor;
    if (!cursor) {
      cursor = em.create(FlowScheduleCursor, { id: unique(), ...input });
    } else {
      Object.assign(cursor, input, { updatedAt: Date.now() });
    }
    em.persist(cursor);
    return cursor;
  }

  async queueProjectionChange(scheduleId: string, recordId: string): Promise<void> {
    const em = this.manager();
    let change = await em.findOne(FlowScheduleProjectionChange, { scheduleId, recordId });
    if (!change) {
      change = em.create(FlowScheduleProjectionChange, { id: unique(), scheduleId, recordId });
    }
    change.state = "pending";
    change.availableAt = Date.now();
    change.leaseOwner = undefined;
    change.leaseUntil = undefined;
    change.attemptCount = 0;
    change.updatedAt = Date.now();
    await em.persistAndFlush(change);
    this.wake("projection");
  }

  async queueProjectionChangesForRecord(nocodeId: string, tableId: string, recordId: string, changedFieldIds?: string[]): Promise<void> {
    if (!recordId) return;
    await this.queueProjectionChangesForRecords(nocodeId, tableId, [{ recordId, changedFieldIds }]);
  }

  async queueProjectionChangesForRecords(nocodeId: string, tableId: string, records: Array<{ recordId: string; changedFieldIds?: string[] }>): Promise<void> {
    const now = Date.now();
    const changes = await this.upsertProjectionChangesForRecords(nocodeId, tableId, records, now, now);
    if (changes.length) this.wake("projection");
  }

  async stageProjectionChangesForRecords(
    nocodeId: string,
    tableId: string,
    records: Array<{ recordId: string; changedFieldIds?: string[] }>,
    now = Date.now(),
  ): Promise<ProjectionChangePublishToken[]> {
    const changes = await this.upsertProjectionChangesForRecords(
      nocodeId,
      tableId,
      records,
      now,
      now + EXTERNAL_CHANGE_FALLBACK_DELAY_MS,
    );
    if (changes.length) this.wake("projection");
    return changes;
  }

  async publishProjectionChanges(changes: ProjectionChangePublishToken[], now = Date.now()): Promise<number> {
    if (!changes.length) return 0;
    const published = await this.transactional(async em => {
      let count = 0;
      for (const change of changes) {
        count += await em.nativeUpdate(FlowScheduleProjectionChange, {
          id: change.id,
          updatedAt: change.updatedAt,
        }, {
          state: "pending",
          availableAt: now,
          leaseOwner: null,
          leaseUntil: null,
          attemptCount: 0,
          updatedAt: Math.max(now, change.updatedAt + 1),
        });
      }
      return count;
    });
    if (published) this.wake("projection");
    return published;
  }

  private async upsertProjectionChangesForRecords(
    nocodeId: string,
    tableId: string,
    records: Array<{ recordId: string; changedFieldIds?: string[] }>,
    now: number,
    availableAt: number,
  ): Promise<ProjectionChangePublishToken[]> {
    if (!records.length) return [];
    const definitions = await this.manager().find(FlowScheduleDefinition, {
      nocodeId,
      tableId,
      executionScope: "per_record",
      state: { $in: ["building", "active"] },
    });
    if (!definitions.length) return [];
    const changes: ProjectionChangePublishToken[] = [];
    const definitionIds = definitions.map(definition => definition.id);
    for (let offset = 0; offset < records.length; offset += PROJECTION_CHANGE_BATCH_SIZE) {
      const batch = records.slice(offset, offset + PROJECTION_CHANGE_BATCH_SIZE).filter(item => item.recordId);
      if (!batch.length) continue;
      const pairs = definitions.flatMap(definition => {
        const referenced = (definition.configJson?.referencedDateFields as string[]) || [];
        return batch
          .filter(input => !input.changedFieldIds || input.changedFieldIds.some(fieldId => referenced.includes(fieldId)))
          .map(input => ({ definitionId: definition.id, recordId: input.recordId }));
      });
      if (!pairs.length) continue;
      await this.transactional(async em => {
        const connection = em.getConnection?.();
        const transaction = em.getTransactionContext?.();
        const dbType = this.rootEntityManager.config?.get?.("type");
        const projectionUpsertSql = dbType === "mysql" || dbType === "mariadb"
          ? `on duplicate key update
               updated_at = greatest(values(updated_at), updated_at + 1),
               state = values(state),
               available_at = values(available_at),
               lease_owner = null,
               lease_until = null,
               attempt_count = 0`
          : dbType === "sqlite" || dbType === "better-sqlite"
            ? `on conflict(schedule_id, record_id) do update set
                 updated_at = max(excluded.updated_at, flow_schedule_projection_change.updated_at + 1),
                 state = excluded.state,
                 available_at = excluded.available_at,
                 lease_owner = null,
                 lease_until = null,
                 attempt_count = 0`
            : undefined;
        if (connection?.execute && projectionUpsertSql) {
          // Keep each INSERT below SQLite's variable limit while retaining a
          // single transaction for the whole user mutation.
          const maxPairsPerInsert = Math.max(1, Math.floor(SQLITE_MAX_VARIABLES / PROJECTION_CHANGE_PARAMS_PER_PAIR));
          for (let pairOffset = 0; pairOffset < pairs.length; pairOffset += maxPairsPerInsert) {
            const pairBatch = pairs.slice(pairOffset, pairOffset + maxPairsPerInsert);
            const values = pairBatch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
            const params = pairBatch.flatMap(pair => [
              unique(),
              pair.definitionId,
              pair.recordId,
              now,
              now,
              "pending",
              availableAt,
              null,
              null,
              0,
            ]);
            await connection.execute(
              `insert into flow_schedule_projection_change (id, schedule_id, record_id, created_at, updated_at, state, available_at, lease_owner, lease_until, attempt_count)
               values ${values}
               ${projectionUpsertSql}`,
              params,
              "run",
              transaction,
            );
          }
          const recordIds = Array.from(new Set(batch.map(item => item.recordId)));
          const schedulePlaceholders = definitionIds.map(() => "?").join(", ");
          const recordPlaceholders = recordIds.map(() => "?").join(", ");
          const persisted = await connection.execute(
            `select id, schedule_id, record_id, updated_at
               from flow_schedule_projection_change
              where schedule_id in (${schedulePlaceholders})
                and record_id in (${recordPlaceholders})`,
            [...definitionIds, ...recordIds],
            "all",
            transaction,
          ) as Array<{ id: string; schedule_id: string; record_id: string; updated_at: number }>;
          const persistedByKey = new Map(persisted.map(change => [`${change.schedule_id}:${change.record_id}`, change]));
          for (const pair of pairs) {
            const change = persistedByKey.get(`${pair.definitionId}:${pair.recordId}`);
            if (change) changes.push({ id: change.id, updatedAt: Number(change.updated_at) });
          }
          return;
        }

        // Keep lightweight test/legacy entity managers working when they do
        // not expose the SQLite connection API.
        const existing = await em.find(FlowScheduleProjectionChange, {
          scheduleId: { $in: definitionIds },
          recordId: { $in: batch.map(item => item.recordId) },
        });
        const existingByKey = new Map(existing.map(change => [`${change.scheduleId}:${change.recordId}`, change]));
        for (const pair of pairs) {
          let change = existingByKey.get(`${pair.definitionId}:${pair.recordId}`);
          if (!change) {
            change = em.create(FlowScheduleProjectionChange, { id: unique(), scheduleId: pair.definitionId, recordId: pair.recordId });
            existingByKey.set(`${pair.definitionId}:${pair.recordId}`, change);
          }
          const updatedAt = Math.max(now, (change.updatedAt || 0) + 1);
          Object.assign(change, { state: "pending", availableAt, leaseOwner: undefined, leaseUntil: undefined, attemptCount: 0, updatedAt });
          em.persist(change);
          changes.push({ id: change.id, updatedAt });
        }
      });
    }
    return changes;
  }

  async takeProjectionChanges(limit: number, scheduleId?: string): Promise<FlowScheduleProjectionChange[]> {
    // Keep the legacy method safe for callers that have not migrated yet: a
    // read must claim the rows before returning them, otherwise two consumers
    // can both rebuild the same cursor.
    return this.leaseProjectionChanges({
      owner: `projection-${process.pid}`,
      now: Date.now(),
      leaseMs: 30_000,
      limit,
      scheduleId,
    });
  }

  async countProjectionChanges(scheduleId: string, now = Date.now()): Promise<number> {
    return this.manager().count(FlowScheduleProjectionChange, { scheduleId, state: "pending", availableAt: { $lte: now } });
  }

  async removeProjectionChange(id: string, updatedAt?: number): Promise<boolean> {
    const removed = await this.manager().nativeDelete(FlowScheduleProjectionChange, {
      id,
      ...(updatedAt === undefined ? {} : { updatedAt }),
    }) > 0;
    if (removed) this.wake("projection");
    return removed;
  }

  async findEarliestProjectionChangeAt(): Promise<number | undefined> {
    const change = await this.manager().findOne(FlowScheduleProjectionChange, {
      state: "pending",
    }, { orderBy: { availableAt: "ASC", id: "ASC" } });
    return change?.availableAt;
  }

  async findEarliestProjectionChangeLeaseUntil(): Promise<number | undefined> {
    const change = await this.manager().findOne(FlowScheduleProjectionChange, {
      state: "leased",
      leaseUntil: { $ne: null },
    }, { orderBy: { leaseUntil: "ASC", id: "ASC" } });
    return change?.leaseUntil;
  }

  async skipAndAdvanceCursor(input: SkipAndAdvanceCursorInput): Promise<boolean> {
    const updated = await this.transactional(async em => {
      const cursor = await em.findOne(FlowScheduleCursor, {
        id: input.cursorId,
        scheduleId: input.scheduleId,
        ...(input.leaseOwner ? { state: "leased", leaseOwner: input.leaseOwner } : {}),
      });
      const definition = await em.findOne(FlowScheduleDefinition, { id: input.scheduleId });
      if (!cursor) return false;
      const nocode = await this.findNocode(em, definition?.nocodeId);
      const active = Boolean(
        definition
        && definition.state === "active"
        && (input.lifecycleEpoch === undefined || definition.lifecycleEpoch === input.lifecycleEpoch)
        && (nocode === null || (nocode !== undefined && nocode.deleted !== true)),
      );
      if (!active) {
        if (cursor.state === "leased" && (!input.leaseOwner || cursor.leaseOwner === input.leaseOwner)) {
          cursor.state = nocode === undefined || nocode?.deleted === true ? "disabled" : "ready";
          cursor.leaseOwner = undefined;
          cursor.leaseUntil = undefined;
          cursor.updatedAt = input.now;
          em.persist(cursor);
        }
        return false;
      }
      if (cursor.lastScheduledFor === input.scheduledFor) {
        cursor.nextFireAt = input.nextFireAt;
        cursor.state = input.state || (input.nextFireAt ? "ready" : "completed");
        cursor.conditionScanScheduledFor = undefined;
        cursor.conditionScanCheckpoint = undefined;
        cursor.leaseOwner = undefined;
        cursor.leaseUntil = undefined;
        cursor.updatedAt = input.now;
        em.persist(cursor);
        if (definition) {
          definition.headDirty = true;
          definition.headVersion += 1;
          if (input.nextFireAt !== undefined && (definition.nextDueAt === undefined || input.nextFireAt < definition.nextDueAt)) definition.nextDueAt = input.nextFireAt;
          em.persist(definition);
        }
        await em.flush();
        return true;
      }
      const fire = await em.findOne(FlowScheduleFire, { id: input.fireId });
      if (fire && (fire.lifecycleEpoch ?? 0) === definition.lifecycleEpoch) {
        fire.skippedCount += 1;
        em.persist(fire);
      } else {
        cursor.state = "ready";
        cursor.leaseOwner = undefined;
        cursor.leaseUntil = undefined;
        cursor.updatedAt = input.now;
        em.persist(cursor);
        return false;
      }
      cursor.lastScheduledFor = input.scheduledFor;
      cursor.nextFireAt = input.nextFireAt;
      cursor.state = input.state || (input.nextFireAt ? "ready" : "completed");
      cursor.invalidReason = input.invalidReason;
      cursor.conditionScanScheduledFor = undefined;
      cursor.conditionScanCheckpoint = undefined;
      cursor.leaseOwner = undefined;
      cursor.leaseUntil = undefined;
      cursor.updatedAt = input.now;
      em.persist(cursor);
      if (definition) {
        definition.headDirty = true;
        definition.headVersion += 1;
        if (input.nextFireAt !== undefined && (definition.nextDueAt === undefined || input.nextFireAt < definition.nextDueAt)) definition.nextDueAt = input.nextFireAt;
        em.persist(definition);
      }
      await em.flush();
      return true;
    });
    if (updated) this.wake("cursor");
    return updated;
  }

  async releaseCursorAfterUnavailableFire(input: ReleaseCursorAfterUnavailableFireInput): Promise<boolean> {
    const released = await this.transactional(async em => {
      const cursor = await em.findOne(FlowScheduleCursor, {
        id: input.cursorId,
        scheduleId: input.scheduleId,
        ...(input.leaseOwner ? { state: "leased", leaseOwner: input.leaseOwner } : {}),
      });
      const definition = await em.findOne(FlowScheduleDefinition, { id: input.scheduleId });
      if (!cursor) return false;
      const nocode = await this.findNocode(em, definition?.nocodeId);
      cursor.state = nocode === undefined || nocode?.deleted === true || definition?.state === "paused" || definition?.state === "retired"
        ? "disabled"
        : "ready";
      cursor.leaseOwner = undefined;
      cursor.leaseUntil = undefined;
      cursor.updatedAt = input.now;
      em.persist(cursor);
      await em.flush();
      return true;
    });
    if (released) this.wake("cursor");
    return released;
  }

  async ensureFire(scheduleId: string, scheduledFor: number, lifecycleEpoch = 0): Promise<FlowScheduleFire | null> {
    try {
      const fire = await this.transactional(async em => {
        const definition = await em.findOne(FlowScheduleDefinition, { id: scheduleId });
        const definitionEpoch = definition?.lifecycleEpoch ?? 0;
        if (!definition || definition.state !== "active" || definitionEpoch !== lifecycleEpoch) return null;
        const nocode = await this.findNocode(em, definition.nocodeId);
        if (nocode === undefined || nocode?.deleted === true) return null;
        const existing = await em.findOne(FlowScheduleFire, { scheduleId, scheduledFor });
        if (existing) {
          if ((existing.lifecycleEpoch ?? 0) === lifecycleEpoch) return existing;
          // A fire is the logical schedule period, so a resumed definition
          // continues its unfinished subjects on the same row. Existing runs
          // retain their identity through the run uniqueness constraint.
          existing.lifecycleEpoch = lifecycleEpoch;
          existing.state = "dispatching";
          existing.completedAt = undefined;
          em.persist(existing);
          return existing;
        }
        const created = em.create(FlowScheduleFire, { id: unique(), scheduleId, scheduledFor, lifecycleEpoch });
        em.persist(created);
        return created;
      });
      if (fire) this.wake("cursor");
      return fire;
    } catch (error) {
      // A concurrent dispatcher may have won the unique insert. Re-read only
      // after the failed transaction and still enforce the lifecycle epoch;
      // an old-epoch fire must never be handed to a new dispatcher.
      const existing = await this.manager().findOne(FlowScheduleFire, { scheduleId, scheduledFor });
      if (existing && (existing.lifecycleEpoch ?? 0) === lifecycleEpoch) return existing;
      throw error;
    }
  }

  async finishDispatchForSchedule(scheduleId: string, now: number, limit = 200): Promise<number> {
    const em = this.manager();
    const fires = await em.find(FlowScheduleFire, {
      scheduleId,
      state: "dispatching",
      scheduledFor: { $lte: now },
    }, { orderBy: { scheduledFor: "ASC", id: "ASC" }, limit });
    let updated = 0;
    for (const fire of fires) {
      const activeRuns = await em.count(FlowScheduledRun, {
        fireId: fire.id,
        state: { $in: ["queued", "running", "retry_wait"] },
      });
      fire.state = activeRuns === 0 ? "completed" : "dispatched";
      fire.completedAt = activeRuns === 0 ? now : undefined;
      await em.persistAndFlush(fire);
      updated += 1;
    }
    return updated;
  }

  async leaseQueuedRuns(input: LeaseInput): Promise<FlowScheduledRun[]> {
    const em = this.manager();
    const where: FilterQuery<FlowScheduledRun> = { state: "queued", availableAt: { $lte: input.now } };
    if (input.scheduleId) where.scheduleId = input.scheduleId;
    const candidates = await em.find(FlowScheduledRun, where, { orderBy: { availableAt: "ASC", id: "ASC" }, limit: input.limit });
    const leased: FlowScheduledRun[] = [];
    for (const candidate of candidates) {
      const leaseVersion = Math.max(0, Number(candidate.leaseVersion) || 0) + 1;
      const updated = await em.nativeUpdate(FlowScheduledRun, { id: candidate.id, state: "queued", availableAt: { $lte: input.now } }, {
        state: "running", leaseOwner: input.owner, leaseUntil: input.now + input.leaseMs,
        leaseVersion,
        startedAt: input.now, attemptCount: candidate.attemptCount + 1,
      });
      if (!updated) continue;
      Object.assign(candidate, { state: "running", leaseOwner: input.owner, leaseUntil: input.now + input.leaseMs, leaseVersion, startedAt: input.now, attemptCount: candidate.attemptCount + 1 });
      leased.push(candidate);
    }
    if (leased.length) this.wake("run");
    return leased;
  }

  async findQueuedScheduleIds(now: number, limit: number, afterScheduleId?: string): Promise<string[]> {
    const connection = this.rootEntityManager.getDriver?.().getConnection?.();
    if (!connection?.execute) {
      const runs = await this.manager().find(FlowScheduledRun, { state: "queued", availableAt: { $lte: now } }, { orderBy: { availableAt: "ASC", id: "ASC" }, limit });
      return Array.from(new Set(runs.map(run => run.scheduleId)));
    }
    const select = async (after: string | undefined, take: number) => {
      if (take <= 0) return [];
      const rows = await connection.execute<Array<{ schedule_id: string }>>(
        `select schedule_id from flow_scheduled_run where state = ? and available_at <= ?${after ? " and schedule_id > ?" : ""} group by schedule_id order by schedule_id limit ?`,
        after ? ["queued", now, after, take] : ["queued", now, take],
      );
      return rows.map(row => row.schedule_id);
    };
    const scheduleIds = await select(afterScheduleId, limit);
    if (afterScheduleId && scheduleIds.length < limit) scheduleIds.push(...await select(undefined, limit - scheduleIds.length));
    return scheduleIds;
  }

  async recoverExpiredLeases(now: number): Promise<number> {
    const em = this.manager();
    const expired = await em.find(FlowScheduledRun, { state: "running", leaseUntil: { $lte: now } }, { orderBy: { leaseUntil: "ASC", id: "ASC" }, limit: 200 });
    let recovered = 0;
    for (const run of expired) {
      const state = run.workflowExecutionId ? "succeeded" : "retry_wait";
      const updated = await em.nativeUpdate(FlowScheduledRun, {
        id: run.id,
        state: "running",
        leaseUntil: { $lte: now },
        leaseVersion: run.leaseVersion,
      }, {
        state,
        leaseVersion: Math.max(0, Number(run.leaseVersion) || 0) + 1,
        ...(state === "retry_wait" ? { availableAt: now } : {}),
        ...(state === "succeeded" ? { finishedAt: now } : {}),
        leaseOwner: null,
        leaseUntil: null,
      });
      if (updated) recovered += 1;
      if (updated && state === "succeeded") {
        const fire = await em.findOne(FlowScheduleFire, { id: run.fireId });
        if (fire) {
          fire.succeededCount += 1;
          if (fire.state === "dispatched") {
            const activeRuns = await em.count(FlowScheduledRun, { fireId: fire.id, state: { $in: ["queued", "running", "retry_wait"] } });
            if (activeRuns === 0) {
              fire.state = "completed";
              fire.completedAt = now;
            }
          }
          await em.persistAndFlush(fire);
        }
      }
    }
    if (recovered) this.wake("lease");
    return recovered;
  }

  async finishRun(input: FinishRunInput): Promise<boolean> {
    const finished = await this.transactional(async em => {
      const run = await em.findOne(FlowScheduledRun, {
        id: input.runId,
        state: "running",
        leaseOwner: input.owner,
        ...(input.leaseVersion === undefined ? {} : { leaseVersion: input.leaseVersion }),
        ...(input.leaseVersion === undefined ? {} : { leaseUntil: { $gt: input.now } }),
      });
      if (!run) return false;
      const terminal = input.state === "succeeded" || input.state === "skipped" || input.state === "dead_letter" || input.state === "canceled";
      Object.assign(run, {
        state: input.state,
        ...(input.availableAt === undefined ? {} : { availableAt: input.availableAt }),
        ...(terminal ? { finishedAt: input.now } : {}),
        leaseOwner: undefined,
        leaseUntil: undefined,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage?.slice(0, 1000),
      });
      em.persist(run);
      const fire = await em.findOne(FlowScheduleFire, { id: run.fireId });
      if (fire) {
        if (input.state === "succeeded") fire.succeededCount += 1;
        if (input.state === "skipped") fire.skippedCount += 1;
        if (input.state === "dead_letter") fire.failedCount += 1;
        const activeRuns = await em.count(FlowScheduledRun, { fireId: run.fireId, state: { $in: ["queued", "running", "retry_wait"] } });
        if (terminal && fire.state === "dispatched" && activeRuns === 0) {
          fire.completedAt = input.now;
          fire.state = "completed";
        }
        em.persist(fire);
      }
      await em.flush();
      return true;
    });
    if (finished) this.wake("run");
    return finished;
  }

  async attachWorkflowExecution(runId: string, workflowExecutionId: string, owner?: string, leaseVersion?: number, now = Date.now()): Promise<boolean> {
    const updated = await this.manager().nativeUpdate(FlowScheduledRun, {
      id: runId,
      ...(owner === undefined ? {} : { state: "running", leaseOwner: owner }),
      ...(leaseVersion === undefined ? {} : { leaseVersion, leaseUntil: { $gt: now } }),
    }, { workflowExecutionId }) > 0;
    if (updated) this.wake("run");
    return updated;
  }

  async hasRunLease(runId: string, owner: string, leaseVersion: number, now = Date.now()): Promise<boolean> {
    return Boolean(await this.manager().findOne(FlowScheduledRun, {
      id: runId,
      state: "running",
      leaseOwner: owner,
      leaseVersion,
      leaseUntil: { $gt: now },
    }, { fields: ["id"] }));
  }

  async renewRunLease(input: RenewRunLeaseInput): Promise<boolean> {
    const updated = await this.manager().nativeUpdate(FlowScheduledRun, {
      id: input.runId,
      state: "running",
      leaseOwner: input.owner,
      leaseVersion: input.leaseVersion,
      leaseUntil: { $gt: input.now },
    }, { leaseUntil: input.now + input.leaseMs }) > 0;
    return updated;
  }

  async requeueReadyRetries(now: number, limit: number): Promise<number> {
    const em = this.manager();
    const retries = await em.find(FlowScheduledRun, { state: "retry_wait", availableAt: { $lte: now } }, { orderBy: { availableAt: "ASC", id: "ASC" }, limit });
    if (!retries.length) return 0;
    const updated = await em.nativeUpdate(FlowScheduledRun, { id: { $in: retries.map(item => item.id) }, state: "retry_wait" }, { state: "queued" });
    if (updated) this.wake("run");
    return updated;
  }

  async countActiveRuns(scheduleId?: string): Promise<number> {
    return this.manager().count(FlowScheduledRun, { ...(scheduleId ? { scheduleId } : {}), state: { $in: ["queued", "running", "retry_wait"] } });
  }

  async countActiveRunsBySchedule(scheduleIds: string[]): Promise<Map<string, number>> {
    const ids = Array.from(new Set(scheduleIds.filter(Boolean)));
    const counts = new Map(ids.map(id => [id, 0]));
    if (!ids.length) return counts;
    const connection = this.rootEntityManager.getDriver?.().getConnection?.();
    if (connection?.execute) {
      const placeholders = ids.map(() => "?").join(", ");
      const rows = await connection.execute<Array<{ schedule_id: string; active_count: number | string }>>(
        `select schedule_id, count(*) as active_count from flow_scheduled_run where schedule_id in (${placeholders}) and state in (?, ?, ?) group by schedule_id`,
        [...ids, "queued", "running", "retry_wait"],
      );
      for (const row of rows) counts.set(row.schedule_id, Number(row.active_count) || 0);
      return counts;
    }
    const runs = await this.manager().find(FlowScheduledRun, {
      scheduleId: { $in: ids },
      state: { $in: ["queued", "running", "retry_wait"] },
    }, { fields: ["scheduleId"] });
    for (const run of runs) counts.set(run.scheduleId, (counts.get(run.scheduleId) || 0) + 1);
    return counts;
  }

  async getQueueStats(now = Date.now()) {
    const em = this.manager();
    const countStates = async <T extends object>(entity: EntityName<T>, states: string[]) => {
      const result: Record<string, number> = {};
      for (const state of states) result[state] = await em.count(entity, { state } as FilterQuery<T>);
      return result;
    };
    const definitions = await countStates(FlowScheduleDefinition, ["building", "active", "paused", "failed", "retired"]);
    const cursors = await countStates(FlowScheduleCursor, ["ready", "leased", "completed", "disabled", "invalid"]);
    const runs = await countStates(FlowScheduledRun, ["queued", "running", "retry_wait", "succeeded", "skipped", "dead_letter", "canceled"]);
    const dueCursors = await em.count(FlowScheduleCursor, { state: "ready", nextFireAt: { $lte: now } });
    const oldestQueued = await em.findOne(FlowScheduledRun, { state: { $in: ["queued", "retry_wait"] }, availableAt: { $lte: now } }, { orderBy: { availableAt: "ASC" } });
    return {
      at: now,
      definitions,
      cursors: { ...cursors, due: dueCursors },
      runs,
      activeRuns: (runs.queued || 0) + (runs.running || 0) + (runs.retry_wait || 0),
      oldestQueuedAt: oldestQueued?.queuedAt,
      oldestQueuedDelayMs: oldestQueued ? Math.max(0, now - oldestQueued.queuedAt) : 0,
    };
  }

  async purgeRuns(cutoff: number, deadLetterCutoff: number, limit: number): Promise<number> {
    const em = this.manager();
    const candidates = await em.find(FlowScheduledRun, {
      $or: [
        { state: { $in: ["succeeded", "skipped", "canceled"] }, finishedAt: { $lt: cutoff } },
        { state: "dead_letter", finishedAt: { $lt: deadLetterCutoff } },
      ],
    }, { orderBy: { finishedAt: "ASC" }, limit });
    if (!candidates.length) return 0;
    return em.nativeDelete(FlowScheduledRun, { id: { $in: candidates.map(item => item.id) } });
  }

  async purgeFires(cutoff: number, limit: number): Promise<number> {
    const em = this.manager();
    const candidates = await em.find(FlowScheduleFire, { state: { $in: ["completed", "canceled"] }, completedAt: { $lt: cutoff } }, { orderBy: { completedAt: "ASC" }, limit });
    if (!candidates.length) return 0;
    const removable: string[] = [];
    for (const candidate of candidates) {
      if (await em.count(FlowScheduledRun, { fireId: candidate.id }) === 0) removable.push(candidate.id);
    }
    if (!removable.length) return 0;
    return em.nativeDelete(FlowScheduleFire, { id: { $in: removable } });
  }

  async purgeRetiredScheduleData(limit: number): Promise<number> {
    const em = this.manager();
    const definitions = await em.find(FlowScheduleDefinition, { state: "retired" }, { orderBy: { updatedAt: "ASC", id: "ASC" }, limit: 16 });
    if (!definitions.length) return 0;
    const scheduleIds = definitions.map(item => item.id);
    const cursors = await em.find(FlowScheduleCursor, { scheduleId: { $in: scheduleIds } }, { orderBy: { updatedAt: "ASC", id: "ASC" }, limit });
    const changes = await em.find(FlowScheduleProjectionChange, { scheduleId: { $in: scheduleIds } }, { orderBy: { updatedAt: "ASC", id: "ASC" }, limit: Math.max(0, limit - cursors.length) });
    if (cursors.length) await em.nativeDelete(FlowScheduleCursor, { id: { $in: cursors.map(item => item.id) } });
    if (changes.length) await em.nativeDelete(FlowScheduleProjectionChange, { id: { $in: changes.map(item => item.id) } });
    const removedDependents = cursors.length + changes.length;
    if (removedDependents) return removedDependents;
    const removable: string[] = [];
    for (const definition of definitions) {
      const [fires, runs] = await Promise.all([
        em.count(FlowScheduleFire, { scheduleId: definition.id }),
        em.count(FlowScheduledRun, { scheduleId: definition.id }),
      ]);
      if (fires === 0 && runs === 0) removable.push(definition.id);
    }
    if (!removable.length) return 0;
    return em.nativeDelete(FlowScheduleDefinition, { id: { $in: removable } });
  }
}
