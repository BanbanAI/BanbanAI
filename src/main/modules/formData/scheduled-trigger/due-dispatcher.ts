import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { FlowScheduleCursor, FlowScheduleFire } from "../entities";
import { NextFireResult } from "./next-fire-calculator";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { ScheduledTriggerSignal } from "./scheduled-trigger-signal";
import { ScheduledTriggerStartupBarrier } from "./scheduled-trigger-startup-barrier";
import { WakeupCoordinator, WakeupPumpResult } from "./wakeup-coordinator";

export type DueDispatcherOptions = {
  globalHighWaterMark: number;
  globalLowWaterMark: number;
  perScheduleBatchSize: number;
  scheduleCountPerRound: number;
  leaseMs: number;
  conditionScanDelayMs: number;
};

type DispatchRoundResult = {
  accepted: number;
  progressed: boolean;
};

const DEFAULT_OPTIONS: DueDispatcherOptions = {
  globalHighWaterMark: 256,
  globalLowWaterMark: 128,
  perScheduleBatchSize: 32,
  scheduleCountPerRound: 16,
  leaseMs: 30_000,
  conditionScanDelayMs: 100,
};

export interface DueScheduleProvider {
  nextFire(cursor: FlowScheduleCursor, now: number): Promise<NextFireResult>;
  latestDue?(cursor: FlowScheduleCursor, now: number): Promise<NextFireResult>;
  latestDueWithNextFire?(cursor: FlowScheduleCursor, now: number): Promise<{ due: NextFireResult; nextFire?: NextFireResult }>;
  latestDueWithNextFireBatch?(cursors: FlowScheduleCursor[], now: number): Promise<Map<string, { due: NextFireResult; nextFire?: NextFireResult }>>;
  matchesConditions(cursor: FlowScheduleCursor): Promise<boolean>;
  matchesConditionsBatch?(cursors: FlowScheduleCursor[], scheduledForByCursor?: ReadonlyMap<string, number>): Promise<Set<string> | Map<string, "matched" | "unmatched" | "pending">>;
}

export const SCHEDULED_DUE_PROVIDER = Symbol("SCHEDULED_DUE_PROVIDER");

@Injectable()
export class DueDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("DueDispatcher");
  private readonly options: DueDispatcherOptions;
  private readonly owner = `dispatcher-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  private readonly wakeup: WakeupCoordinator;
  private readonly unsubscribe?: () => boolean;
  private stopped = false;
  private waitingForLowWaterMark = false;
  private conditionScanRetryAt?: number;

  constructor(
    private readonly repository: ScheduledTriggerRepository,
    @Inject(SCHEDULED_DUE_PROVIDER) private readonly schedules: DueScheduleProvider,
    @Optional() options?: Partial<DueDispatcherOptions>,
    @Optional() signal?: ScheduledTriggerSignal,
    @Optional() @Inject(ScheduledTriggerStartupBarrier) private readonly startupBarrier?: ScheduledTriggerStartupBarrier,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (options?.globalHighWaterMark !== undefined && options.globalLowWaterMark === undefined) {
      this.options.globalLowWaterMark = Math.floor(options.globalHighWaterMark / 2);
    }
    this.wakeup = new WakeupCoordinator(() => this.pump(), {
      onError: error => this.logger.error("scheduled dispatch failed", error instanceof Error ? error.stack : String(error)),
    });
    this.unsubscribe = signal?.subscribe(reason => {
      if (reason === "run" || reason === "cursor" || reason === "definition" || reason === "lease" || reason === "lifecycle") this.wake(reason);
    });
  }

  onApplicationBootstrap() {
    this.wakeup.start();
  }

  wake(_reason = "event") {
    void _reason;
    if (!this.stopped) this.wakeup.wake();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.unsubscribe?.();
    await this.wakeup.stop();
  }

  async onApplicationShutdown() {
    await this.stop();
  }

  async dispatch(now = Date.now()): Promise<number> {
    return (await this.dispatchRound(now)).accepted;
  }

  private async dispatchRound(now: number): Promise<DispatchRoundResult> {
    if (this.stopped) return { accepted: 0, progressed: false };
    if (this.startupBarrier && !this.startupBarrier.isReady) return { accepted: 0, progressed: false };
    const pending = await this.repository.countActiveRuns();
    if (pending >= this.options.globalHighWaterMark) this.waitingForLowWaterMark = true;
    if (this.waitingForLowWaterMark && pending > this.options.globalLowWaterMark) return { accepted: 0, progressed: false };
    this.waitingForLowWaterMark = false;

    let progressed = await this.repository.recoverExpiredCursorLeases(now, this.options.perScheduleBatchSize * this.options.scheduleCountPerRound) > 0;
    const dueDefinitions = await this.repository.findDueDefinitions(now, this.options.scheduleCountPerRound);
    if (!dueDefinitions.length) return { accepted: 0, progressed };
    await this.repository.markDefinitionsDispatched?.(dueDefinitions.map(definition => definition.id));
    const pendingBySchedule = await this.repository.countActiveRunsBySchedule(dueDefinitions.map(definition => definition.id));
    let accepted = 0;

    for (const definition of dueDefinitions) {
      if (pending + accepted >= this.options.globalHighWaterMark) break;
      const schedule = {
        id: definition.id,
        configHash: definition.configHash,
        maxPendingRuns: 64,
        lifecycleEpoch: definition.lifecycleEpoch,
        initiatorUserId: definition.initiatorUserId || "admin",
      };
      if (!schedule) continue;
      const schedulePending = pendingBySchedule.get(schedule.id) || 0;
      if (schedulePending >= schedule.maxPendingRuns) continue;
      const available = Math.min(this.options.perScheduleBatchSize, schedule.maxPendingRuns - schedulePending, this.options.globalHighWaterMark - pending - accepted);
      if (available <= 0) continue;
      const cursors = await this.repository.leaseDueCursors(schedule.id, this.owner, now, this.options.leaseMs, available);
      if (!cursors.length) continue;
      let deferred = false;
      const scheduledForByCursor = new Map<string, number>();
      const precomputedNextFireByCursor = new Map<string, NextFireResult | undefined>();
      const dueCursors: FlowScheduleCursor[] = [];
      let batchCalculations: Map<string, { due: NextFireResult; nextFire?: NextFireResult }> | undefined;
      let batchCalculationFailed = false;
      if (this.schedules.latestDueWithNextFireBatch && cursors.length) {
        try {
          batchCalculations = await this.schedules.latestDueWithNextFireBatch(cursors, now);
        } catch (error) {
          batchCalculationFailed = true;
          deferred = true;
          this.logger.warn(`scheduled due calculation deferred for schedule ${schedule.id}`, error);
        }
      }
      if (batchCalculationFailed) continue;
      for (const cursor of cursors) {
        const supportsLatestDue = Boolean(this.schedules.latestDueWithNextFireBatch || this.schedules.latestDueWithNextFire || this.schedules.latestDue);
        let due: NextFireResult;
        try {
          if (batchCalculations) {
            const calculated = batchCalculations.get(cursor.id);
            if (!calculated) throw new Error(`scheduled due calculation missing for cursor ${cursor.id}`);
            due = calculated.due;
            precomputedNextFireByCursor.set(cursor.id, calculated.nextFire);
          } else if (this.schedules.latestDueWithNextFire) {
            const calculated = await this.schedules.latestDueWithNextFire(cursor, now);
            due = calculated.due;
            precomputedNextFireByCursor.set(cursor.id, calculated.nextFire);
          } else {
            due = supportsLatestDue ? await this.schedules.latestDue!(cursor, now) : await this.schedules.nextFire(cursor, now);
          }
        } catch (error) {
          // Body reads are target-scoped. Keep this cursor leased so lease
          // recovery retries it later without spinning a missing body.
          deferred = true;
          this.logger.warn(`scheduled due calculation deferred for cursor ${cursor.id}`, error);
          continue;
        }
        const candidateTime = due?.nextFireAt?.getTime();
        const recalculatedFor = candidateTime !== undefined && Number.isFinite(candidateTime) ? candidateTime : undefined;
        if (supportsLatestDue && (recalculatedFor === undefined || recalculatedFor > now)) {
          const invalid = due.reason === "INVALID_TRIGGER_DATE"
            || due.reason === "INVALID_START_DATE"
            || due.reason === "INVALID_END_DATE"
            || due.reason === "CALENDAR_REQUIRED"
            || due.reason === "CALENDAR_DATA_UNAVAILABLE";
          progressed = await this.repository.rescheduleLeasedCursor({
            cursorId: cursor.id,
            scheduleId: schedule.id,
            nextFireAt: recalculatedFor,
            state: recalculatedFor !== undefined ? "ready" : invalid ? "invalid" : "completed",
            invalidReason: recalculatedFor === undefined ? due.reason : undefined,
            now,
            leaseOwner: this.owner,
          }) || progressed;
          continue;
        }
        const scheduledFor = recalculatedFor ?? cursor.nextFireAt;
        if (!scheduledFor || scheduledFor > now) {
          progressed = await this.repository.releaseCursorLease(cursor.id, this.owner) || progressed;
          continue;
        }
        scheduledForByCursor.set(cursor.id, scheduledFor);
        dueCursors.push(cursor);
      }
      let matchedCursorIds: Set<string> | Map<string, "matched" | "unmatched" | "pending"> | undefined;
      if (this.schedules.matchesConditionsBatch && dueCursors.length) {
        try {
          matchedCursorIds = await this.schedules.matchesConditionsBatch(dueCursors, scheduledForByCursor);
        } catch (error) {
          // All cursors in this batch remain leased and will be recovered as a
          // unit after lease expiry. Other schedules can still be dispatched.
          deferred = true;
          this.logger.warn(`scheduled condition calculation deferred for schedule ${schedule.id}`, error);
          continue;
        }
      }
      const fires = new Map<number, FlowScheduleFire | null>();
      for (const cursor of dueCursors) {
        const scheduledFor = scheduledForByCursor.get(cursor.id)!;
        const conditionResult = matchedCursorIds instanceof Map
          ? matchedCursorIds.get(cursor.id) || "unmatched"
          : matchedCursorIds instanceof Set
            ? matchedCursorIds.has(cursor.id) ? "matched" : "unmatched"
            : undefined;
        if (conditionResult === "pending") {
          progressed = await this.repository.releaseCursorLease(cursor.id, this.owner, false) || progressed;
          const retryAt = now + Math.max(1, this.options.conditionScanDelayMs);
          this.conditionScanRetryAt = this.conditionScanRetryAt === undefined
            ? retryAt
            : Math.min(this.conditionScanRetryAt, retryAt);
          continue;
        }
        let matches: boolean;
        try {
          matches = conditionResult ? conditionResult === "matched" : await this.schedules.matchesConditions(cursor);
        } catch (error) {
          this.logger.warn(`scheduled condition calculation deferred for cursor ${cursor.id}`, error);
          deferred = true;
          continue;
        }
        let following: NextFireResult;
        try {
          const precomputed = precomputedNextFireByCursor.get(cursor.id);
          following = precomputedNextFireByCursor.has(cursor.id)
            ? (precomputed || { reason: "COMPLETED" })
            : await this.schedules.nextFire({ ...cursor, lastScheduledFor: scheduledFor, nextFireAt: undefined }, now);
        } catch (error) {
          this.logger.warn(`scheduled next-fire calculation deferred for cursor ${cursor.id}`, error);
          deferred = true;
          continue;
        }
        const nextFireAt = following.nextFireAt?.getTime();
        let fire = fires.get(scheduledFor);
        if (!fires.has(scheduledFor)) {
          fire = await this.repository.ensureFire(schedule.id, scheduledFor, schedule.lifecycleEpoch || 0);
          fires.set(scheduledFor, fire);
        }
        if (!fire) {
          // An unavailable fire never consumes the logical due time. A
          // lifecycle transition may disable the cursor; otherwise it remains
          // ready for the next durable wake.
          progressed = await this.repository.releaseCursorAfterUnavailableFire({
            cursorId: cursor.id,
            scheduleId: schedule.id,
            now,
            leaseOwner: this.owner,
          }) || progressed;
          continue;
        }
        if (matches) {
          const run = await this.repository.acceptRunAndAdvanceCursor({
            cursorId: cursor.id, scheduleId: schedule.id, fireId: fire.id, configHash: schedule.configHash,
            subjectKey: cursor.subjectKey, recordId: cursor.recordId, scheduledFor, nextFireAt,
            completed: !nextFireAt, now, leaseOwner: this.owner, lifecycleEpoch: schedule.lifecycleEpoch,
            initiatorUserId: schedule.initiatorUserId,
          });
          if (run) {
            accepted += 1;
            progressed = true;
          }
        } else {
          progressed = await this.repository.skipAndAdvanceCursor({ cursorId: cursor.id, scheduleId: schedule.id, fireId: fire.id, scheduledFor, nextFireAt, state: nextFireAt ? "ready" : "completed", now, leaseOwner: this.owner, lifecycleEpoch: schedule.lifecycleEpoch }) || progressed;
        }
        if (pending + accepted >= this.options.globalHighWaterMark) break;
      }
      if (!deferred && pending + accepted < this.options.globalHighWaterMark && !(await this.repository.hasDueCursors(schedule.id, now))) {
        progressed = await this.repository.finishDispatchForSchedule(schedule.id, now) > 0 || progressed;
      }
      if (!deferred) {
        const rebuiltHead = await this.repository.rebuildDefinitionHead(schedule.id);
        progressed = definition.headDirty || rebuiltHead !== definition.nextDueAt || progressed;
      }
    }
    return { accepted, progressed };
  }

  private async pump(): Promise<WakeupPumpResult> {
    if (this.startupBarrier && !this.startupBarrier.isReady) return { nextAt: undefined };
    const now = Date.now();
    const result = await this.dispatchRound(now);
    // A cursor lease can be the only durable work left after a crash or a
    // stalled condition lookup. Keep a timer for its expiry even when the
    // definition head is currently in the future.
    const nextLease = await this.repository.findEarliestCursorLeaseUntil();
    if (this.waitingForLowWaterMark) return { nextAt: undefined };
    const nextAt = await this.repository.findEarliestDefinitionDueAt(now);
    const conditionScanRetryAt = this.conditionScanRetryAt;
    this.conditionScanRetryAt = undefined;
    const earliest = [nextAt, nextLease]
      .filter((value): value is number => value !== undefined && Number.isFinite(value))
      .sort((left, right) => left - right)[0];
    if (result.progressed) {
      const progressedAt = Math.max(Date.now() + 1, earliest || Date.now() + 1);
      // A pending global condition page is deliberately retried with a
      // bounded delay. Progress from releasing that cursor must not turn the
      // delay into a 1ms timer and a busy loop.
      return { nextAt: conditionScanRetryAt === undefined ? progressedAt : Math.max(progressedAt, conditionScanRetryAt) };
    }
    if (conditionScanRetryAt !== undefined) return { nextAt: conditionScanRetryAt };
    if (earliest !== undefined && earliest <= Date.now()) return { nextAt: nextLease };
    return { nextAt: earliest };
  }

}
