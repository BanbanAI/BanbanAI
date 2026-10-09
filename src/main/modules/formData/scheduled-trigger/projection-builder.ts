import { CompiledSchedule } from "./schedule-compiler";
import { calculateNextFire, CalculateNextFireInput, ScheduleCalendar } from "./next-fire-calculator";
import { FlowScheduleCursor } from "../entities";

export type ProjectionRow = {
  recordId: string;
  createTime: string;
  dates: Record<string, unknown>;
  version?: number;
};

export type ProjectionCheckpoint = {
  lastCreateTime?: string;
  lastRecordId?: string;
  scanUpperBound?: string;
  projectionVersion: number;
};

export type ProjectionReader = (checkpoint: ProjectionCheckpoint, limit: number) => Promise<ProjectionRow[]>;
export type ProjectionWriter = (cursor: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion">) => Promise<void>;
export type ProjectionBatchWriter = (cursors: Parameters<ProjectionWriter>[0][]) => Promise<void>;
export type ProjectionCheckpointWriter = (checkpoint: ProjectionCheckpoint) => Promise<void>;
export type ProjectionYield = () => Promise<void>;

export type ProjectionBuildInput = {
  schedule: CompiledSchedule;
  scheduleId: string;
  activationAt: Date;
  checkpoint?: ProjectionCheckpoint;
  readBatch: ProjectionReader;
  writeCursors: ProjectionBatchWriter;
  writeCheckpoint: ProjectionCheckpointWriter;
  existingRecordIds?: Iterable<string>;
  calendar?: ScheduleCalendar;
  batchSize: number;
  yieldControl?: ProjectionYield;
};

export type ProjectionBuildResult = {
  checkpoint: ProjectionCheckpoint;
  rowsProcessed: number;
};

const defaultYield: ProjectionYield = async () => new Promise(resolve => setImmediate(resolve));
export class ProjectionBuilder {
  async build(input: ProjectionBuildInput): Promise<ProjectionBuildResult> {
    const yieldControl = input.yieldControl || defaultYield;
    let checkpoint: ProjectionCheckpoint = input.checkpoint || { projectionVersion: 1 };
    let rowsProcessed = 0;
    const seenRecordIds = new Set(input.existingRecordIds || []);
    for (let page = 0; page < Number.MAX_SAFE_INTEGER; page += 1) {
      const rows = await input.readBatch(checkpoint, input.batchSize);
      if (!rows.length) return { checkpoint, rowsProcessed };
      const cursors: Parameters<ProjectionWriter>[0][] = [];
      let previousCreateTime = checkpoint.lastCreateTime;
      let previousRecordId = checkpoint.lastRecordId;
      for (const row of rows) {
        if (typeof row.recordId !== "string" || !row.recordId) {
          throw new Error("SCHEDULE_PROJECTION_INVALID_RECORD_ID");
        }
        if (typeof row.createTime !== "string" || !row.createTime) {
          throw new Error("SCHEDULE_PROJECTION_INVALID_CREATE_TIME");
        }
        const duplicate = seenRecordIds.has(row.recordId);
        const isAdvancing = previousCreateTime === undefined
          || row.createTime > previousCreateTime
          || (row.createTime === previousCreateTime && row.recordId > (previousRecordId || ""));
        if (!isAdvancing) {
          if (duplicate) continue;
          throw new Error("SCHEDULE_PROJECTION_CHECKPOINT_NOT_ADVANCING");
        }
        if (duplicate) {
          checkpoint = {
            ...checkpoint,
            lastCreateTime: row.createTime,
            lastRecordId: row.recordId,
          };
          previousCreateTime = row.createTime;
          previousRecordId = row.recordId;
          continue;
        }
        const result = calculateNextFire({
          schedule: input.schedule,
          activationAt: input.activationAt,
          recordDates: row.dates,
          calendar: input.calendar,
          allowPastDue: true,
        } as CalculateNextFireInput);
        const cursor: Pick<FlowScheduleCursor, "scheduleId" | "subjectKey" | "recordId" | "nextFireAt" | "state" | "invalidReason" | "projectionVersion"> = {
          scheduleId: input.scheduleId,
          subjectKey: row.recordId,
          recordId: row.recordId,
          nextFireAt: result.nextFireAt?.getTime(),
          state: result.nextFireAt ? "ready" : result.reason === "INVALID_TRIGGER_DATE" || result.reason === "INVALID_START_DATE" || result.reason === "INVALID_END_DATE" || result.reason === "CALENDAR_REQUIRED" || result.reason === "CALENDAR_DATA_UNAVAILABLE" ? "invalid" : "completed",
          invalidReason: result.nextFireAt ? undefined : result.reason,
          projectionVersion: Math.max(checkpoint.projectionVersion, row.version || 0),
        };
        cursors.push(cursor);
        checkpoint = {
          ...checkpoint,
          lastCreateTime: row.createTime,
          lastRecordId: row.recordId,
          projectionVersion: cursor.projectionVersion,
        };
        previousCreateTime = row.createTime;
        previousRecordId = row.recordId;
        seenRecordIds.add(row.recordId);
        rowsProcessed += 1;
      }
      await input.writeCursors(cursors);
      await input.writeCheckpoint(checkpoint);
      await yieldControl();
    }
    return { checkpoint, rowsProcessed };
  }
}

export type ProjectionChange = {
  scheduleId: string;
  recordId: string;
};

export class ProjectionChangeCoalescer {
  private readonly pending = new Map<string, ProjectionChange>();

  add(change: ProjectionChange) {
    this.pending.set(`${change.scheduleId}:${change.recordId}`, change);
  }

  drain(limit: number): ProjectionChange[] {
    const changes = Array.from(this.pending.values()).slice(0, limit);
    for (const change of changes) this.pending.delete(`${change.scheduleId}:${change.recordId}`);
    return changes;
  }

  get size() {
    return this.pending.size;
  }
}
