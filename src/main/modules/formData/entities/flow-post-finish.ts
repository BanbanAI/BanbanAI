import { DataChangeType, ProcessFlow, ProcessNodeType, Row, TableUID } from "@common/types/project";
import { Entity, EntityRepository, Property } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";

export type FlowPostFinishPlanStatus =
  | "prepared"
  | "ready"
  | "running"
  | "success"
  | "partial_failed"
  | "failed"
  | "discarded";

export type FlowPostFinishTaskStatus =
  | "pending"
  | "running"
  | "success"
  | "partial_failed"
  | "failed"
  | "discarded";

export type FlowPostFinishTaskType = "data_action" | "trigger_event" | "report_data";

@Entity({
  tableName: "flow_post_finish_plans",
  customRepository: () => FlowPostFinishPlanRepository,
})
export class FlowPostFinishPlan {
  @PrimaryKey({ mongoLike: global.mongoLike })
  id: string = unique();

  @Property({ fieldName: "todo_id", type: "string" })
  todoId: string;

  @Property({ fieldName: "nocode_id", type: "string" })
  nocodeId: string;

  @Property({ fieldName: "table_id", type: "string" })
  tableId: TableUID;

  @Property({ type: "string" })
  uuid: string;

  @Property({ fieldName: "process_version", nullable: true })
  processVersion?: number;

  @Property({ type: "string" })
  status: FlowPostFinishPlanStatus = "prepared";

  @Property({ fieldName: "finish_reason", nullable: true, type: "string" })
  finishReason?: "normal_finish" | "terminal_reject" | "cancel";

  @Property({ fieldName: "completion_row_snapshot", nullable: true, type: "json" })
  completionRowSnapshot?: Row;

  @Property({ fieldName: "created_at", type: "bigint" })
  createdAt: number = Date.now();

  @Property({ fieldName: "started_at", nullable: true, type: "bigint" })
  startedAt?: number;

  @Property({ fieldName: "finished_at", nullable: true, type: "bigint" })
  finishedAt?: number;

  @Property({ fieldName: "last_error", nullable: true, type: "string" })
  lastError?: string;
}

export class FlowPostFinishPlanRepository extends EntityRepository<FlowPostFinishPlan> {}

@Entity({
  tableName: "flow_post_finish_tasks",
  customRepository: () => FlowPostFinishTaskRepository,
})
export class FlowPostFinishTask {
  @PrimaryKey({ mongoLike: global.mongoLike })
  id: string = unique();

  @Property({ fieldName: "plan_id", type: "string" })
  planId: string;

  @Property({ fieldName: "todo_id", type: "string" })
  todoId: string;

  @Property({ fieldName: "occurrence_id", type: "string" })
  occurrenceId: string;

  @Property({ fieldName: "flow_id", type: "string" })
  flowId: string;

  @Property({ fieldName: "execution_record_id", nullable: true, type: "string" })
  executionRecordId?: string;

  @Property({ fieldName: "node_type", type: "string" })
  nodeType: ProcessNodeType;

  @Property({ fieldName: "task_type", type: "string" })
  taskType: FlowPostFinishTaskType;

  @Property({ type: "string" })
  action: DataChangeType;

  @Property({ fieldName: "sequence_path", type: "json" })
  sequencePath: number[];

  @Property({ fieldName: "source_nocode_id", type: "string" })
  sourceNocodeId: string;

  @Property({ fieldName: "source_table_id", type: "string" })
  sourceTableId: TableUID;

  @Property({ fieldName: "source_uuid", type: "string" })
  sourceUuid: string;

  @Property({ fieldName: "target_nocode_id", type: "string" })
  targetNocodeId: string;

  @Property({ fieldName: "target_table_id", type: "string" })
  targetTableId: TableUID;

  @Property({ fieldName: "node_snapshot", type: "json" })
  nodeSnapshot: ProcessFlow;

  @Property({ fieldName: "input_snapshot", nullable: true, type: "json" })
  inputSnapshot?: Row;

  @Property({ fieldName: "before_snapshot", nullable: true, type: "json" })
  beforeSnapshot?: Row;

  @Property({ type: "string" })
  status: FlowPostFinishTaskStatus = "pending";

  @Property({ fieldName: "attempt_count", type: "number" })
  attemptCount: number = 0;

  @Property({ fieldName: "success_count", type: "number" })
  successCount: number = 0;

  @Property({ fieldName: "failed_count", type: "number" })
  failedCount: number = 0;

  @Property({ fieldName: "result_snapshot", nullable: true, type: "json" })
  resultSnapshot?: any;

  @Property({ fieldName: "last_error", nullable: true, type: "string" })
  lastError?: string;

  @Property({ fieldName: "created_at", type: "bigint" })
  createdAt: number = Date.now();

  @Property({ fieldName: "started_at", nullable: true, type: "bigint" })
  startedAt?: number;

  @Property({ fieldName: "finished_at", nullable: true, type: "bigint" })
  finishedAt?: number;
}

export class FlowPostFinishTaskRepository extends EntityRepository<FlowPostFinishTask> {}
