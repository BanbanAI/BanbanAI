import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { getFlows, getProcessVersionStatus, getUUIDSystemField, SystemField } from "@common/utils";
import { ProcessFlow, ProcessNodeType, ProcessVersionStatus, TimeTaskOptions, Table, Row } from "@common/types/project";
import { NocodeBody, NocodeFormData } from "@common/types/nocode";
import { getNocodeBody } from "@main/utils";
import { NOCODES_DIR } from "@main/constants";
import { ProjectService } from "../../project/project.services";
import { DueScheduleProvider } from "./due-dispatcher";
import { calculateLatestDue, calculateNextFire, NextFireResult } from "./next-fire-calculator";
import { FlowScheduleCursor, FlowScheduleDefinition } from "../entities";
import { CompiledSchedule, ScheduleCompileError, compileSchedule } from "./schedule-compiler";
import { SCHEDULE_POLICY } from "./schedule-policy";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { DbManager } from "../db.manager";
import { ProjectionBuilder } from "./projection-builder";
import { getDbColumnKey } from "../utils";
import { FormDataStage } from "@common/utils";
import { CHINESE_CALENDAR_ID, HolidayService } from "../../common/holiday.service";
import { FormFlowService } from "../form-flow.service";
import { ScheduledTriggerSignal } from "./scheduled-trigger-signal";
import { ScheduledTriggerStartupBarrier } from "./scheduled-trigger-startup-barrier";
import { WakeupCoordinator, WakeupPumpResult } from "./wakeup-coordinator";
import dayjs from "dayjs";

type CompiledNode = { flow: ProcessFlow; options: TimeTaskOptions; hasApprovalOrTransactAfterTrigger: boolean };

const CHANGE_BATCH_SIZE = 16;
const PROJECTION_BUILD_CONCURRENCY = 2;
const CHANGE_LEASE_MS = 30_000;
const CHANGE_MAX_ATTEMPTS = 5;
const CHANGE_RETRY_BASE_MS = 1_000;
const CHANGE_RETRY_MAX_MS = 300_000;
const CHANGE_BATCH_YIELD_MS = 25;

@Injectable()
export class ScheduleDefinitionService implements OnApplicationBootstrap, OnApplicationShutdown, DueScheduleProvider {
  private readonly logger = new Logger("ScheduleDefinitionService");
  private readonly projectionBuilds = new Set<string>();
  private readonly holidayService = new HolidayService();
  private readonly calendar = {
    isWorkday: (date: string) => this.holidayService.isWorkday(date),
    isHoliday: (date: string) => this.holidayService.isHoliday(date),
  };
  private readonly wakeup: WakeupCoordinator;
  private readonly unsubscribe?: () => boolean;
  private readonly changeOwner = `schedule-definition-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

  private buildReadableRecordQuery(table: Table, query: Record<string, unknown> = {}) {
    const stageField = table.fields?.find(field => field.meta?.name === SystemField.DATA_STAGE);
    if (!stageField) return query;
    const stageKey = getDbColumnKey(stageField);
    // Keep legacy rows without a stage readable, while excluding draft and
    // recycle-bin rows in every scheduler query. `$nin` is not equivalent
    // across the embedded and external database adapters for missing fields.
    const stageCondition = {
      $or: [
        { [stageKey]: { $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING] } },
        { [stageKey]: { $exists: false } },
      ],
    };
    return Object.keys(query).length ? { $and: [query, stageCondition] } : stageCondition;
  }

  constructor(
    private readonly projectService: ProjectService,
    private readonly repository: ScheduledTriggerRepository,
    private readonly dbManager: DbManager,
    private readonly formFlowService: FormFlowService,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Optional() @Inject(ScheduledTriggerSignal) private readonly signal?: ScheduledTriggerSignal,
    @Optional() @Inject(ScheduledTriggerStartupBarrier) private readonly startupBarrier?: ScheduledTriggerStartupBarrier,
  ) {
    this.wakeup = new WakeupCoordinator(() => this.processPendingChanges(), {
      onError: error => this.logger.warn("scheduled incremental update failed", error),
    });
    this.unsubscribe = this.signal?.subscribe(reason => {
      if (reason === "definition" || reason === "subscription_backfill" || reason === "projection" || reason === "lease" || reason === "lifecycle") {
        this.wakeup.wake();
      }
    });
  }

  async onApplicationBootstrap() {
    // Definitions and cursors are durable. Startup only replays pending
    // changes; it must not enumerate every application body.
    this.wakeup.start();
  }

  async onApplicationShutdown() {
    this.unsubscribe?.();
    await this.wakeup.stop();
  }

  /** Publish a coalesced, durable configuration/lifecycle change signal. */
  async queueScheduleChange(nocodeId: string, reason = "configuration") {
    return this.repository.queueScheduleChange(nocodeId, reason);
  }

  async stageScheduleChange(nocodeId: string, reason = "configuration_pending") {
    return this.repository.stageScheduleChange(nocodeId, reason);
  }

  private async getScheduleBody(nocodeId: string): Promise<NocodeBody> {
    const body = await getNocodeBody(this.nocodesDir, nocodeId);
    if (!body?.formData) throw new Error(`scheduled app body is unavailable: ${nocodeId}`);
    return body;
  }

  validateEnabledSchedules(formData: NocodeFormData, nocodeId: string, tableIds?: string[]) {
    const selected = tableIds?.length ? new Set(tableIds) : null;
    for (const table of formData?.tables || []) {
      if (selected && !selected.has(table.uid)) continue;
      const process = formData.formOptions?.[table.uid]?.process;
      const version = process?.version;
      if (!process?.enabled || !Number.isInteger(version) || getProcessVersionStatus(process, version) !== ProcessVersionStatus.ENABLED) continue;
      const flows = getFlows(process, version) || [];
      for (const compiledNode of this.findTimeTaskNodes(flows)) {
        compileSchedule({
          identity: { nocodeId, tableId: table.uid, processVersion: String(version), nodeUid: compiledNode.flow.uid },
          options: compiledNode.options,
          timeZone: SCHEDULE_POLICY.timeZone,
          calendarId: this.holidayService.getCalendarId() || CHINESE_CALENDAR_ID,
          initiatorUserId: SCHEDULE_POLICY.initiatorUserId,
          hasApprovalOrTransactAfterTrigger: compiledNode.hasApprovalOrTransactAfterTrigger,
        });
      }
    }
  }

  async compileEnabledSchedules(now = Date.now(), nocodeId?: string): Promise<number> {
    // Compilation is an explicit, target-scoped operation. A missing target is
    // intentionally a no-op so startup can never fall back to a full app scan.
    if (!nocodeId) return 0;
    const meta = await this.projectService.getNocodeMeta(nocodeId).catch(() => null);
    if (!meta) return 0;
    if (meta.deleted === true) {
      await this.repository.pauseSchedulesByNocodeId(nocodeId);
      return 0;
    }
    let compiledCount = 0;
    const activeScheduleKeys = new Set<string>();
    let body;
    try {
      body = await this.getScheduleBody(meta.id);
    } catch (error) {
      this.logger.warn(`skip schedule compilation because app body is unavailable: ${meta.id}`, error);
      // An outbox item must remain replayable when the body is temporarily
      // unavailable. Returning zero would acknowledge the event and strand
      // the subscription until a later unrelated save.
      throw error;
    }
    const formData = body.formData;
    if (!formData?.tables?.length) {
      await this.repository.retireSchedulesForNocodeIds([meta.id], []);
      return 0;
    }
    {
      for (const table of formData.tables) {
        const process = formData.formOptions?.[table.uid]?.process;
        const version = process?.version;
        if (!process?.enabled || !Number.isInteger(version) || getProcessVersionStatus(process, version) !== ProcessVersionStatus.ENABLED) continue;
        const flows = getFlows(process, version) || [];
        for (const compiledNode of this.findTimeTaskNodes(flows)) {
          try {
            const compiled = compileSchedule({
              identity: { nocodeId: meta.id, tableId: table.uid, processVersion: String(version), nodeUid: compiledNode.flow.uid },
              options: compiledNode.options,
              timeZone: SCHEDULE_POLICY.timeZone,
              calendarId: this.holidayService.getCalendarId() || CHINESE_CALENDAR_ID,
              initiatorUserId: SCHEDULE_POLICY.initiatorUserId,
              hasApprovalOrTransactAfterTrigger: compiledNode.hasApprovalOrTransactAfterTrigger,
            });
            activeScheduleKeys.add(compiled.scheduleKey);
            const latest = await this.repository.findLatestDefinition(compiled.scheduleKey);
            const existing = latest?.configHash === compiled.configHash && latest.state !== "retired" ? latest : null;
            const shouldBuildProjection = compiled.executionScope === "per_record" && (!existing || existing.state !== "active" || !existing.buildCheckpoint);
            const desiredState = compiled.executionScope === "global" || (existing?.state === "active" && !shouldBuildProjection) ? "active" : "building";
            const definition = await this.repository.saveDefinition({
              ...(existing ? { id: existing.id, revision: existing.revision } : {}),
              scheduleKey: compiled.scheduleKey,
              revision: existing?.revision || (latest?.revision || 0) + 1,
              nocodeId: meta.id,
              tableId: table.uid,
              processVersion: String(version),
              nodeUid: compiledNode.flow.uid,
              configHash: compiled.configHash,
              configJson: compiled as unknown as Record<string, unknown>,
              executionScope: compiled.executionScope,
              timeZone: compiled.timeZone,
              calendarId: compiled.calendarId,
              initiatorUserId: SCHEDULE_POLICY.initiatorUserId,
              lifecycleEpoch: existing?.lifecycleEpoch || 0,
              state: desiredState,
              activationAt: existing?.activationAt || now,
            });
            if (!definition) return compiledCount;
            await this.repository.retireOtherRevisions(compiled.scheduleKey, definition.id);
            if (compiled.executionScope === "global") {
              const next = calculateNextFire({ schedule: compiled, activationAt: new Date(definition.activationAt), calendar: this.calendar });
              await this.repository.ensureGlobalCursor(
                definition.id,
                next.nextFireAt?.getTime(),
                now,
                definition.lifecycleEpoch || 0,
                next.nextFireAt ? "ready" : this.isInvalidProjection(next.reason) ? "invalid" : "completed",
                next.reason,
              );
              if (!await this.repository.saveDefinition({ id: definition.id, state: "active" })) return compiledCount;
            }
            compiledCount += 1;
          } catch (error) {
            if (error instanceof ScheduleCompileError) this.logger.warn(`skip invalid scheduled node ${meta.id}/${table.uid}/${compiledNode.flow.uid}: ${error.code}`);
            else throw error;
          }
        }
      }
    }
    await this.repository.retireSchedulesForNocodeIds([meta.id], Array.from(activeScheduleKeys));
    return compiledCount;
  }

  async getStatus(now = Date.now()) {
    return {
      ...(await this.repository.getQueueStats(now)),
      projectionBuilds: this.projectionBuilds.size,
      scheduler: {
        wakeTimer: this.wakeup.hasTimer,
      },
    };
  }

  async reconcileOneProjectionBatch(limit = 200, now = Date.now()): Promise<number> {
    const definition = await this.repository.findReconciliationDefinition();
    if (!definition) return 0;
    const touch = (checkpoint = definition.reconcileCheckpoint || "") => this.repository.saveDefinitionReconcileCheckpoint(
      definition.id,
      definition.configHash,
      definition.lifecycleEpoch || 0,
      checkpoint,
      now,
    );
    let body;
    try {
      body = await this.getScheduleBody(definition.nocodeId);
    } catch (error) {
      // A damaged/missing body belongs to this definition only. Keep the
      // reconciliation cursor unchanged and let the next bounded pass try
      // again; failure to persist that checkpoint must not stop other work.
      await touch().catch(checkpointError => {
        this.logger.warn(`scheduled projection reconciliation checkpoint deferred: ${definition.id}`, checkpointError);
      });
      this.logger.warn(`scheduled projection reconciliation body is unavailable: ${definition.id}`, error);
      return 0;
    }
    const formData = body.formData;
    const table = formData?.tables?.find((item: Table) => item.uid === definition.tableId);
    const optionTable = formData?.options?.tables?.find(item => item.uid === table?.meta?.uid);
    const uuidField = table && getUUIDSystemField(table.fields);
    const schedule = definition.configJson as unknown as import("./schedule-compiler").CompiledSchedule;
    if (!formData || !table || !optionTable || !uuidField || !schedule) {
      await this.repository.queueScheduleChange(definition.nocodeId, "projection_reconcile").catch(() => undefined);
      await touch();
      return 0;
    }
    const db = await this.dbManager.getDB(definition.nocodeId, optionTable, "main");
    const projection = [SystemField.UUID, ...schedule.referencedDateFields.map(fieldId => {
      const field = table.fields.find(item => item.uid === fieldId);
      return field ? getDbColumnKey(field) : fieldId;
    })];
    const after = definition.reconcileCheckpoint || undefined;
    const [rows, storedCursors] = await Promise.all([
      db.find(this.buildReadableRecordQuery(table, after ? { [SystemField.UUID]: { $gt: after } } : {}), {
        sort: { [SystemField.UUID]: 1 },
        limit,
        projection,
      }),
      this.repository.findProjectionCursorsAfter(definition.id, after, limit),
    ]);
    const rowLast = rows.length ? String(rows[rows.length - 1]?.[SystemField.UUID] || "") : "";
    const cursorLast = storedCursors.length ? storedCursors[storedCursors.length - 1].subjectKey : "";
    const rowsExhausted = rows.length < limit;
    const cursorsExhausted = storedCursors.length < limit;
    const through = rowsExhausted
      ? cursorLast || rowLast
      : cursorsExhausted
        ? rowLast || cursorLast
        : [rowLast, cursorLast].filter(Boolean).sort()[0] || "";
    const rowsInRange = rows.filter((row: Row) => {
      const recordId = String(row?.[SystemField.UUID] || "");
      return recordId && (!through || recordId <= through);
    });
    const cursorsInRange = storedCursors.filter(cursor => !through || cursor.subjectKey <= through);
    const cursorByRecord = new Map(cursorsInRange.map(cursor => [cursor.subjectKey, cursor]));
    const rowIds = new Set(rowsInRange.map((row: Row) => String(row[SystemField.UUID])));
    const cursorUpdates: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">[] = rowsInRange
      .map((row: Row) => {
        const recordId = String(row[SystemField.UUID]);
        const cursor = cursorByRecord.get(recordId);
        const dates = Object.fromEntries(schedule.referencedDateFields.map(fieldId => {
          const field = table.fields.find(item => item.uid === fieldId);
          return [fieldId, row[field ? getDbColumnKey(field) : fieldId]];
        }));
        const next = calculateNextFire({
          schedule,
          activationAt: new Date(definition.activationAt),
          lastScheduledFor: cursor?.lastScheduledFor ? new Date(cursor.lastScheduledFor) : undefined,
          recordDates: dates,
          allowPastDue: true,
          calendar: this.calendar,
        });
        const input = {
          scheduleId: definition.id,
          subjectKey: recordId,
          recordId,
          nextFireAt: next.nextFireAt?.getTime(),
          state: next.nextFireAt ? "ready" as const : this.isInvalidProjection(next.reason) ? "invalid" as const : "completed" as const,
          invalidReason: next.reason,
          projectionVersion: now,
        };
        return cursor
          && cursor.recordId === input.recordId
          && cursor.nextFireAt === input.nextFireAt
          && cursor.state === input.state
          && cursor.invalidReason === input.invalidReason
          ? null
          : input;
      })
      .filter(Boolean);
    for (const cursor of cursorsInRange) {
      if (rowIds.has(cursor.subjectKey)) continue;
      if (cursor.state === "completed" && cursor.invalidReason === "RECORD_DELETED" && cursor.nextFireAt === undefined) continue;
      cursorUpdates.push({
        scheduleId: definition.id,
        subjectKey: cursor.subjectKey,
        recordId: cursor.recordId,
        nextFireAt: undefined,
        state: "completed",
        invalidReason: "RECORD_DELETED",
        projectionVersion: now,
      });
    }
    if (cursorUpdates.length && !(await this.repository.upsertCursorsForDefinition(cursorUpdates, definition.lifecycleEpoch || 0))) return 0;
    const checkpoint = rowsExhausted && cursorsExhausted ? "" : through;
    if (!(await touch(checkpoint))) return 0;
    return Math.max(rows.length, storedCursors.length);
  }

  async nextFire(cursor: FlowScheduleCursor, now = Date.now()): Promise<NextFireResult> {
    void now;
    const context = await this.readScheduleContext(cursor);
    if (!context || (cursor.recordId && context.recordDates === null)) return { reason: "COMPLETED" };
    return calculateNextFire({
      schedule: context.schedule,
      activationAt: new Date(context.definition.activationAt),
      lastScheduledFor: cursor.lastScheduledFor ? new Date(cursor.lastScheduledFor) : undefined,
      recordDates: context.recordDates || undefined,
      calendar: this.calendar,
    });
  }

  async latestDue(cursor: FlowScheduleCursor, now = Date.now()): Promise<NextFireResult> {
    const result = await this.latestDueWithNextFire(cursor, now);
    return result.due;
  }

  async latestDueWithNextFire(cursor: FlowScheduleCursor, now = Date.now()): Promise<{
    due: NextFireResult;
    nextFire?: NextFireResult;
  }> {
    const context = await this.readScheduleContext(cursor);
    if (!context || (cursor.recordId && context.recordDates === null)) {
      return { due: { reason: "COMPLETED" } };
    }
    const calculation = {
      schedule: context.schedule,
      activationAt: new Date(context.definition.activationAt),
      lastScheduledFor: cursor.lastScheduledFor ? new Date(cursor.lastScheduledFor) : undefined,
      recordDates: context.recordDates || undefined,
      calendar: this.calendar,
    };
    const due = calculateLatestDue({ ...calculation, now: new Date(now) });
    if (!due.nextFireAt || due.nextFireAt.getTime() > now) return { due };
    return {
      due,
      nextFire: calculateNextFire({ ...calculation, lastScheduledFor: due.nextFireAt }),
    };
  }

  async latestDueWithNextFireBatch(cursors: FlowScheduleCursor[], now = Date.now()): Promise<Map<string, { due: NextFireResult; nextFire?: NextFireResult }>> {
    const results = new Map<string, { due: NextFireResult; nextFire?: NextFireResult }>();
    if (!cursors.length) return results;
    const definition = await this.repository.findDefinition(cursors[0].scheduleId);
    if (!definition) {
      cursors.forEach(cursor => results.set(cursor.id, { due: { reason: "COMPLETED" } }));
      return results;
    }
    const schedule = definition.configJson as unknown as import("./schedule-compiler").CompiledSchedule;
    const recordCursors = cursors.filter(cursor => cursor.recordId);
    const datesByRecordId = new Map<string, Record<string, unknown>>();
    if (recordCursors.length) {
      const body = await this.getScheduleBody(definition.nocodeId);
      const table = body.formData.tables?.find((item: Table) => item.uid === definition.tableId);
      const optionTable = body.formData.options?.tables?.find(item => item.uid === table?.meta?.uid);
      if (!table || !optionTable) throw new Error(`scheduled record date source is unavailable: ${definition.id}`);
      const db = await this.dbManager.getDB(definition.nocodeId, optionTable, "main");
      const projection = [SystemField.UUID, ...schedule.referencedDateFields.map(fieldId => {
        const field = table.fields.find(item => item.uid === fieldId);
        return field ? getDbColumnKey(field) : fieldId;
      })];
      const rows = await db.find(this.buildReadableRecordQuery(table, {
        [SystemField.UUID]: { $in: recordCursors.map(cursor => cursor.recordId) },
      }), { projection });
      for (const row of rows) {
        const recordId = String(row?.[SystemField.UUID] || "");
        if (!recordId) continue;
        datesByRecordId.set(recordId, Object.fromEntries(schedule.referencedDateFields.map(fieldId => {
          const field = table.fields.find(item => item.uid === fieldId);
          return [fieldId, row[field ? getDbColumnKey(field) : fieldId]];
        })));
      }
    }
    for (const cursor of cursors) {
      const recordDates = cursor.recordId ? datesByRecordId.get(cursor.recordId) : undefined;
      if (cursor.recordId && !recordDates) {
        results.set(cursor.id, { due: { reason: "COMPLETED" } });
        continue;
      }
      const calculation = {
        schedule,
        activationAt: new Date(definition.activationAt),
        lastScheduledFor: cursor.lastScheduledFor ? new Date(cursor.lastScheduledFor) : undefined,
        recordDates,
        calendar: this.calendar,
      };
      const due = calculateLatestDue({ ...calculation, now: new Date(now) });
      results.set(cursor.id, !due.nextFireAt || due.nextFireAt.getTime() > now
        ? { due }
        : { due, nextFire: calculateNextFire({ ...calculation, lastScheduledFor: due.nextFireAt }) });
    }
    return results;
  }

  private async readScheduleContext(cursor: FlowScheduleCursor) {
    const definition = await this.repository.findDefinition(cursor.scheduleId);
    if (!definition) return null;
    const schedule = definition.configJson as unknown as import("./schedule-compiler").CompiledSchedule;
    const recordDates = cursor.recordId
      ? await this.readRecordDates(definition, schedule, cursor.recordId)
      : undefined;
    return { definition, schedule, recordDates };
  }

  private async readRecordDates(definition: FlowScheduleDefinition, schedule: import("./schedule-compiler").CompiledSchedule, recordId: string): Promise<Record<string, unknown> | null> {
    const body = await this.getScheduleBody(definition.nocodeId);
    const table = body.formData.tables?.find((item: Table) => item.uid === definition.tableId);
    const optionTable = body.formData.options?.tables?.find(item => item.uid === table?.meta?.uid);
    if (!table || !optionTable) throw new Error(`scheduled record date source is unavailable: ${definition.id}`);
    const db = await this.dbManager.getDB(definition.nocodeId, optionTable, "main");
    const projection = [SystemField.UUID, ...schedule.referencedDateFields.map(fieldId => {
      const field = table.fields.find(item => item.uid === fieldId);
      return field ? getDbColumnKey(field) : fieldId;
    })];
    const row = await db.findOne(this.buildReadableRecordQuery(table, { [SystemField.UUID]: recordId }), { projection });
    if (!row) return null;
    return Object.fromEntries(schedule.referencedDateFields.map(fieldId => {
      const field = table.fields.find(item => item.uid === fieldId);
      return [fieldId, row[field ? getDbColumnKey(field) : fieldId]];
    }));
  }

  async matchesConditions(cursor: FlowScheduleCursor): Promise<boolean> {
    const result = await this.matchesConditionsBatch(
      [cursor],
      cursor.nextFireAt === undefined ? undefined : new Map([[cursor.id, cursor.nextFireAt]]),
    );
    return result.get(cursor.id) === "matched";
  }

  async matchesConditionsBatch(
    cursors: FlowScheduleCursor[],
    scheduledForByCursor?: ReadonlyMap<string, number>,
  ): Promise<Map<string, "matched" | "unmatched" | "pending">> {
    const results = new Map<string, "matched" | "unmatched" | "pending">();
    if (!cursors.length) return results;
    const definition = await this.repository.findDefinition(cursors[0].scheduleId);
    const schedule = definition?.configJson as unknown as CompiledSchedule | undefined;
    if (!definition) return results;
    const recordCursors = cursors.filter(cursor => cursor.recordId);
    const globalCursors = cursors.filter(cursor => !cursor.recordId);
    if (!schedule?.conditionsEnabled) globalCursors.forEach(cursor => results.set(cursor.id, "matched"));
    if (!schedule?.conditionsEnabled && !recordCursors.length) return results;
    const body = await this.getScheduleBody(definition.nocodeId);
    const table = body.formData.tables?.find((item: Table) => item.uid === definition.tableId);
    const optionTable = body.formData.options?.tables?.find(item => item.uid === table?.meta?.uid);
    if (!table || !optionTable) throw new Error("scheduled source table is unavailable");
    const db = await this.dbManager.getDB(definition.nocodeId, optionTable, "main");
    const fieldIds = schedule?.conditionsEnabled
      ? (schedule.conditionCurrentTableFieldIds || this.conditionFieldIds(schedule.conditions, table)) as string[]
      : [];
    const projection = [SystemField.UUID, ...fieldIds.map((id: string) => {
      const field = table.fields.find(item => item.uid === id);
      return field ? getDbColumnKey(field) : id;
    })];
    const normalize = (raw: Row) => {
      const row: Row = { [SystemField.UUID]: raw[SystemField.UUID] } as Row;
      for (const id of fieldIds) {
        const field = table.fields.find(item => item.uid === id);
        if (field) row[id] = raw[getDbColumnKey(field)] ?? raw[id];
      }
      return row;
    };
    if (recordCursors.length) {
      const rows = await db.find(this.buildReadableRecordQuery(table, { [SystemField.UUID]: { $in: recordCursors.map(cursor => cursor.recordId) } }), { projection });
      const normalizedRows = rows.map(normalize);
      const matchedRecordIds = schedule?.conditionsEnabled
        ? await this.formFlowService.matchScheduledTriggerConditions({
          nocodeBody: body,
          nocodeId: definition.nocodeId,
          table,
          rows: normalizedRows,
          sourceTables: schedule.sourceTables || [],
          conditions: schedule.conditions || [],
          sourceFieldIds: schedule.conditionSourceFieldIds || {},
        })
        : new Set(normalizedRows.map(row => String(row[SystemField.UUID])));
      for (const cursor of recordCursors) {
        results.set(cursor.id, matchedRecordIds.has(String(cursor.recordId)) ? "matched" : "unmatched");
      }
    }
    if (!globalCursors.length || !schedule?.conditionsEnabled) return results;
    for (const cursor of globalCursors) {
      const scheduledFor = scheduledForByCursor?.get(cursor.id) ?? cursor.nextFireAt;
      if (scheduledFor === undefined) {
        results.set(cursor.id, "unmatched");
        continue;
      }
      const after = cursor.conditionScanScheduledFor === scheduledFor
        ? cursor.conditionScanCheckpoint
        : undefined;
      const rows = await db.find(this.buildReadableRecordQuery(table, after ? { [SystemField.UUID]: { $gt: after } } : {}), { sort: { [SystemField.UUID]: 1 }, limit: 200, projection });
      if (!rows.length) {
        results.set(cursor.id, "unmatched");
        continue;
      }
      const normalizedRows = rows.map(normalize);
      const matchedRecordIds = await this.formFlowService.matchScheduledTriggerConditions({ nocodeBody: body, nocodeId: definition.nocodeId, table, rows: normalizedRows, sourceTables: schedule.sourceTables || [], conditions: schedule.conditions || [], sourceFieldIds: schedule.conditionSourceFieldIds || {} });
      if (matchedRecordIds.size) {
        results.set(cursor.id, "matched");
        continue;
      }
      const checkpoint = String(rows[rows.length - 1][SystemField.UUID] || "");
      if (!checkpoint || rows.length < 200) {
        results.set(cursor.id, "unmatched");
        continue;
      }
      const saved = await this.repository.saveConditionScanCheckpoint({
        cursorId: cursor.id,
        scheduleId: cursor.scheduleId,
        scheduledFor,
        checkpoint,
        leaseOwner: cursor.leaseOwner,
      });
      results.set(cursor.id, "pending");
      if (saved) {
        cursor.conditionScanScheduledFor = scheduledFor;
        cursor.conditionScanCheckpoint = checkpoint;
      }
    }
    return results;
  }

  private conditionFieldIds(conditions: unknown, table: Table): string[] {
    const ids = new Set<string>();
    const visit = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== "object") return;
      const item = value as Record<string, unknown>;
      const parts = typeof item.uid === "string" ? item.uid.split(".") : [];
      const uid = parts.length === 1
        ? parts[0]
        : parts[0] === table.uid
          ? parts[1]
          : typeof item.field === "string"
            ? item.field
            : undefined;
      if (uid && table.fields.some(field => field.uid === uid)) ids.add(uid);
      Object.values(item).forEach(visit);
    };
    visit(conditions);
    return Array.from(ids);
  }

  private async buildRecordProjection(definition: FlowScheduleDefinition, schedule: CompiledSchedule, table: Table, formData: NocodeFormData) {
    const optionTable = formData.options?.tables?.find(item => item.uid === table.meta?.uid);
    const uuidField = getUUIDSystemField(table.fields);
    const createTimeField = table.fields.find(item => item.meta?.name === SystemField.CREATE_TIME);
    if (!optionTable || !uuidField || !createTimeField) return;
    const db = await this.dbManager.getDB(definition.nocodeId, optionTable, "main");
    const uuidKey = getDbColumnKey(uuidField);
    const createTimeKey = getDbColumnKey(createTimeField);
    const projection = [...new Set([SystemField.UUID, uuidField.uid, uuidKey, SystemField.CREATE_TIME, createTimeField.uid, createTimeKey, ...schedule.referencedDateFields.map(fieldId => {
      const field = table.fields.find(item => item.uid === fieldId);
      return field ? getDbColumnKey(field) : fieldId;
    })])];
    const builder = new ProjectionBuilder();
    const savedCheckpoint = definition.buildCheckpoint ? JSON.parse(definition.buildCheckpoint) : undefined;
    const scanUpperBound = dayjs().format("YYYY-MM-DD HH:mm:ss");
    let checkpoint = typeof savedCheckpoint?.lastCreateTime === "string"
      ? { ...savedCheckpoint, scanUpperBound: savedCheckpoint.scanUpperBound || scanUpperBound }
      : { projectionVersion: savedCheckpoint?.projectionVersion || 1, scanUpperBound };
    const existingRecordIds = await this.repository.findCursorSubjectKeys(definition.id);
    const result = await builder.build({
      schedule,
      scheduleId: definition.id,
      activationAt: new Date(definition.activationAt),
      calendar: this.calendar,
      checkpoint,
      existingRecordIds,
      batchSize: 200,
      readBatch: async (current, limit) => {
        const validRecord = {
          $and: [
            { [uuidKey]: { $exists: true, $nin: [null, ""] } },
            { [createTimeKey]: { $exists: true, $nin: [null, ""] } },
          ],
        };
        const bounded = current.scanUpperBound ? { [createTimeKey]: { $lte: current.scanUpperBound } } : {};
        const after = current.lastCreateTime && current.lastRecordId
          ? { $or: [
            { [createTimeKey]: { $gt: current.lastCreateTime } },
            { [createTimeKey]: current.lastCreateTime, [uuidKey]: { $gt: current.lastRecordId } },
          ] }
          : {};
        const range = Object.keys(after).length ? { $and: [after, bounded] } : bounded;
        const query = Object.keys(range).length ? { $and: [range, validRecord] } : validRecord;
        const rows = await db.find(this.buildReadableRecordQuery(table, query), {
          sort: { [createTimeKey]: 1, [uuidKey]: 1 },
          limit,
          projection,
        });
        return rows.map((row: Record<string, unknown>) => ({
          recordId: String(row[uuidKey] || row[SystemField.UUID] || row[uuidField.uid] || ""),
          createTime: String(row[createTimeKey] || row[SystemField.CREATE_TIME] || row[createTimeField.uid] || ""),
          dates: Object.fromEntries(schedule.referencedDateFields.map(fieldId => {
            const field = table.fields.find(item => item.uid === fieldId);
            return [fieldId, row[field ? getDbColumnKey(field) : fieldId]];
          })),
        }));
      },
      writeCursors: async cursors => {
        const accepted = await this.repository.upsertCursorsForDefinition(cursors, definition.lifecycleEpoch || 0);
        if (!accepted) throw new Error("SCHEDULE_LIFECYCLE_CHANGED");
      },
      writeCheckpoint: async next => {
        checkpoint = next;
        const accepted = await this.repository.saveDefinitionBuildCheckpoint(
          definition.id,
          definition.configHash,
          definition.lifecycleEpoch || 0,
          JSON.stringify(next),
        );
        if (!accepted) throw new Error("SCHEDULE_LIFECYCLE_CHANGED");
      },
    });
    // Apply only changes that are due now. A failed change has a future
    // backoff time; spinning on a plain pending count here would create a
    // private busy loop and starve the rest of the scheduler. The durable
    // change remains pending and the coordinator will retry it.
    for (let round = 0; round < 4; round += 1) {
      if (!(await this.repository.countProjectionChanges(definition.id, Date.now()))) break;
      const processed = await this.processProjectionChanges(64, definition.id);
      if (!processed) break;
    }
    const buildCheckpoint = JSON.stringify(result.checkpoint);
    const activated = await this.repository.activateDefinition(
      definition.id,
      definition.configHash,
      definition.lifecycleEpoch || 0,
      buildCheckpoint,
    );
    if (!activated) return;
  }

  private async processPendingChanges(): Promise<WakeupPumpResult> {
    const now = Date.now();
    // Recovery is bounded and only touches scheduler rows. It is deliberately
    // separate from compilation so a large app body cannot monopolize replay.
    await this.repository.recoverExpiredScheduleChangeLeases(now, CHANGE_BATCH_SIZE);
    await this.repository.recoverExpiredProjectionChangeLeases(now, CHANGE_BATCH_SIZE);
    // A previous process may have left more than the startup batch in
    // `building`. Continue those projections whenever the consumer is woken;
    // each completed build emits another durable definition signal.
    await this.resumeBuildingProjections();

    const changes = await this.repository.leaseScheduleChanges({
      owner: this.changeOwner,
      now,
      leaseMs: CHANGE_LEASE_MS,
      limit: CHANGE_BATCH_SIZE,
    });
    for (const change of changes) {
      try {
        await this.compileEnabledSchedules(now, change.nocodeId);
        // updatedAt is a compare-and-ack token. If a newer save coalesced into
        // the same row while compiling, this ack is rejected and the new
        // pending version is replayed instead of being lost.
        await this.repository.completeScheduleChange(change.id, this.changeOwner, change.updatedAt);
      } catch (error) {
        const delay = Math.min(
          CHANGE_RETRY_MAX_MS,
          CHANGE_RETRY_BASE_MS * 2 ** Math.max(0, (change.attemptCount || 1) - 1),
        );
        const deadLetter = (change.attemptCount || 0) >= CHANGE_MAX_ATTEMPTS;
        await this.repository.failScheduleChange(change.id, this.changeOwner, Date.now(), delay, deadLetter);
        this.logger.warn(`scheduled change ${change.id} ${deadLetter ? "dead-lettered" : "deferred"}`, error);
      }
    }

    const scheduleChangeAt = await this.repository.findEarliestScheduleChangeAt();
    const scheduleChangeLeaseUntil = await this.repository.findEarliestScheduleChangeLeaseUntil();
    if (scheduleChangeAt === undefined && scheduleChangeLeaseUntil === undefined && this.startupBarrier?.release()) {
      this.signal?.wake("lifecycle");
    }

    await this.processProjectionChanges(64);
    const earliest = [
      scheduleChangeAt,
      scheduleChangeLeaseUntil,
      await this.repository.findEarliestProjectionChangeAt(),
      await this.repository.findEarliestProjectionChangeLeaseUntil(),
    ].filter((value): value is number => value !== undefined).sort((left, right) => left - right)[0];
    const nextAt = earliest !== undefined && earliest <= now
      ? now + CHANGE_BATCH_YIELD_MS
      : earliest;
    return { nextAt };
  }

  private async resumeBuildingProjections(limit = PROJECTION_BUILD_CONCURRENCY) {
    if (this.projectionBuilds.size >= limit) return;
    const definitions = await this.repository.findBuildingDefinitions(limit);
    for (const definition of definitions) {
      if (this.projectionBuilds.has(definition.id)) continue;
      if (this.projectionBuilds.size >= limit) break;
      this.projectionBuilds.add(definition.id);
      let body;
      try {
        body = await this.getScheduleBody(definition.nocodeId);
      } catch (error) {
        await this.repository.queueScheduleChange(definition.nocodeId, "projection_resume").catch(queueError => {
          this.logger.warn(`scheduled projection retry could not be queued: ${definition.id}`, queueError);
        });
        await this.markProjectionBuildFailed(definition);
        this.projectionBuilds.delete(definition.id);
        this.logger.warn(`scheduled projection body is unavailable; retry queued: ${definition.id}`, error);
        continue;
      }
      const formData = body.formData;
      const table = formData?.tables?.find((item: Table) => item.uid === definition.tableId);
      const schedule = definition.configJson as unknown as import("./schedule-compiler").CompiledSchedule;
      if (!formData || !table || definition.executionScope !== "per_record" || !schedule) {
        await this.repository.queueScheduleChange(definition.nocodeId, "projection_resume");
        await this.markProjectionBuildFailed(definition);
        this.projectionBuilds.delete(definition.id);
        continue;
      }
      void this.buildRecordProjection(definition, schedule, table, formData)
        .catch(async error => {
          this.logger.error(`scheduled projection resume failed: ${definition.id}`, error);
          await this.markProjectionBuildFailed(definition);
        })
        .finally(() => {
          this.projectionBuilds.delete(definition.id);
          this.wakeup.wake();
        });
    }
  }

  private async markProjectionBuildFailed(definition: FlowScheduleDefinition) {
    await this.repository.failDefinitionBuild(
      definition.id,
      definition.configHash,
      definition.lifecycleEpoch || 0,
    ).catch(() => undefined);
  }

  private isInvalidProjection(reason?: NextFireResult["reason"]) {
    return reason === "INVALID_TRIGGER_DATE" || reason === "INVALID_START_DATE" || reason === "INVALID_END_DATE" || reason === "CALENDAR_REQUIRED" || reason === "CALENDAR_DATA_UNAVAILABLE";
  }

  private async processProjectionChanges(limit = 64, scheduleId?: string): Promise<number> {
    const changes = await this.repository.leaseProjectionChanges({
      owner: this.changeOwner,
      now: Date.now(),
      leaseMs: CHANGE_LEASE_MS,
      limit,
      scheduleId,
    });
    for (const change of changes) {
      try {
        const definition = await this.repository.findDefinition(change.scheduleId);
        if (!definition || !["building", "active"].includes(definition.state)) {
          await this.repository.completeProjectionChange(change.id, this.changeOwner, change.updatedAt);
          continue;
        }
        const body = await this.getScheduleBody(definition.nocodeId);
        const table = body.formData.tables?.find((item: Table) => item.uid === definition.tableId);
        const optionTable = body.formData.options?.tables?.find(item => item.uid === table?.meta?.uid);
        const uuidField = table && getUUIDSystemField(table.fields);
        if (!table || !optionTable || !uuidField) {
          // A body can be durable before its form-data structure is complete
          // (for example during import or a crash recovery). Keep this change
          // retryable and let the targeted compiler retire the definition once
          // the table was intentionally removed.
          await this.repository.queueScheduleChange(definition.nocodeId, "projection_structure_unavailable").catch(queueError => {
            this.logger.warn(`scheduled projection structure retry could not be queued: ${definition.id}`, queueError);
          });
          throw new Error(`scheduled projection source is unavailable: ${definition.id}`);
        }
        const db = await this.dbManager.getDB(definition.nocodeId, optionTable, "main");
        const schedule = definition.configJson as unknown as import("./schedule-compiler").CompiledSchedule;
        const projection = [SystemField.UUID, ...schedule.referencedDateFields.map(fieldId => {
          const field = table.fields.find(item => item.uid === fieldId);
          return field ? getDbColumnKey(field) : fieldId;
        })];
        const raw = await db.findOne(this.buildReadableRecordQuery(table, { [SystemField.UUID]: change.recordId }), { projection });
        if (!raw) {
          await this.repository.upsertCursorForDefinition({ scheduleId: definition.id, subjectKey: change.recordId, recordId: change.recordId, state: "completed", invalidReason: "RECORD_DELETED", projectionVersion: Date.now() }, definition.lifecycleEpoch || 0);
        } else {
          const cursor = await this.repository.findCursor(definition.id, change.recordId);
          const dates = Object.fromEntries(schedule.referencedDateFields.map(fieldId => {
            const field = table.fields.find(item => item.uid === fieldId);
            return [fieldId, raw[field ? getDbColumnKey(field) : fieldId]];
          }));
          const next = calculateNextFire({ schedule, activationAt: new Date(definition.activationAt), lastScheduledFor: cursor?.lastScheduledFor ? new Date(cursor.lastScheduledFor) : undefined, recordDates: dates, allowPastDue: true, calendar: this.calendar });
          await this.repository.upsertCursorForDefinition({ scheduleId: definition.id, subjectKey: change.recordId, recordId: change.recordId, nextFireAt: next.nextFireAt?.getTime(), state: next.nextFireAt ? "ready" : this.isInvalidProjection(next.reason) ? "invalid" : "completed", invalidReason: next.reason, projectionVersion: Date.now() }, definition.lifecycleEpoch || 0);
        }
        await this.repository.completeProjectionChange(change.id, this.changeOwner, change.updatedAt);
      } catch (error) {
        const delay = Math.min(
          CHANGE_RETRY_MAX_MS,
          CHANGE_RETRY_BASE_MS * 2 ** Math.max(0, (change.attemptCount || 1) - 1),
        );
        const deadLetter = (change.attemptCount || 0) >= CHANGE_MAX_ATTEMPTS;
        await this.repository.failProjectionChange(change.id, this.changeOwner, Date.now(), delay, deadLetter);
        this.logger.warn(`scheduled projection ${change.id} ${deadLetter ? "dead-lettered" : "deferred"}`, error);
      }
    }
    return changes.length;
  }

  private findTimeTaskNodes(flows: ProcessFlow[]): CompiledNode[] {
    const result: CompiledNode[] = [];
    const containsApprovalOrTransact = (flow: ProcessFlow): boolean => {
      if (flow.type === ProcessNodeType.APPROVAL || flow.type === ProcessNodeType.TRANSACT) return true;
      return (flow.branches || []).some(branch => (branch.flows || []).some(containsApprovalOrTransact));
    };
    for (const start of (flows || []).filter(flow => flow.type === ProcessNodeType.START)) {
      for (const branch of start.branches || []) {
        const [flow, ...following] = branch.flows || [];
        if (flow?.type !== ProcessNodeType.TRIGGER_TIME_TASK || !flow.options) continue;
        result.push({
          flow,
          options: flow.options as TimeTaskOptions,
          hasApprovalOrTransactAfterTrigger: following.some(containsApprovalOrTransact),
        });
      }
    }
    return result;
  }
}
