import {
  Entity,
  EntityRepository,
  Index,
  Property,
  Unique,
} from "@mikro-orm/core";
import { ExecuteViewActionEditContext, ExecuteViewActionRequest, FlowTriggerContext, FormTableRuntime, NocodeFormData, ViewActionFieldId } from "@common/types/nocode";
import { OptionFieldUID, Row, TableUID } from "@common/types/project";
import type { Account } from "@common/types/account";
import type { DataChangeFlowQueueState } from "../types";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";

export type ViewActionTriggerTaskStatus =
  | "preparing"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "stale"
  | "unknown";

export type ViewActionTriggerTaskExecutionPhase =
  | "claimed"
  | "prepared"
  /** The side-effect call has started; a crash leaves its result unknown. */
  | "executing"
  /** Legacy value written by an earlier build; treated as executing. */
  | "side_effect_unknown";

export type FlowTaskStepExecutionStatus = "started" | "succeeded" | "failed" | "unknown";

export type PersistentTaskType = "view_action_trigger" | "data_mutation";
export type PersistentTaskQueueClass = "p0" | "p1" | "p2";

export type DataMutationTaskAction = "add" | "update" | "delete" | "delete_all";

export type PersistentTaskRequestContext = {
  account?: Account;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  sessionID?: string;
  clientSign?: string;
  lastSign?: string;
};

export type DataMutationTaskPayload = {
  /** Stable identity of the committed mutation event, reused on retry. */
  eventId?: string;
  /** Immutable digest of the original HTTP mutation request, written before the business mutation. */
  requestDigest?: string;
  action: DataMutationTaskAction;
  auditAction: "addData" | "updateData" | "deleteData" | "deleteAllData";
  /** Full form metadata is required for inline CRUD tasks, but import post-mutation
   * tasks reload it from nocodeId and deliberately leave this field unset. */
  formData?: NocodeFormData;
  nocodeId: string;
  tableUID: TableUID;
  rows?: Row[];
  keys?: OptionFieldUID[];
  runtime?: FormTableRuntime;
  stashFlow?: boolean;
  triggerTodo: boolean;
  updateFieldIds?: ViewActionFieldId[];
  viewActionContext?: ExecuteViewActionEditContext;
  queueState?: DataChangeFlowQueueState | null;
  postMutationOnly?: boolean;
  postMutationKind?: "standard" | "import" | "bulk";
  beforeMutationRows?: Row[];
  importTaskId?: string;
  triggerContext?: FlowTriggerContext;
  causedByTodoId?: string;
  causedByTaskId?: string;
  finalizeDeleteWithoutFlow?: boolean;
  /** Only the first import chunk performs the batch-level aggregation pass. */
  runBatchAggregation?: boolean;
  /** Read-only condition evaluation pool; execution remains in the caller's queue. */
  conditionWorkerQueue?: "p0" | "p1";
  /** Delete-all tasks process one bounded cursor page per gateway cycle. */
  pagedDeleteAll?: boolean;
  deleteAllCursor?: string;
};

@Entity({
  tableName: "view_action_trigger_batches",
  customRepository: () => ViewActionTriggerBatchRepository,
})
@Unique({
  name: "view_action_trigger_batch_idempotency_unique",
  properties: ["initiatorId", "idempotencyKey"],
})
export class ViewActionTriggerBatch {
  @PrimaryKey({ mongoLike: global.mongoLike })
    id: string = unique();

  @Property({ fieldName: "initiator_id", type: "string" })
    initiatorId: string;

  @Property({ fieldName: "idempotency_key", type: "string" })
    idempotencyKey: string;

  @Property({ fieldName: "request_digest", type: "string" })
    requestDigest: string;

  @Property({ fieldName: "nocode_id", type: "string" })
    nocodeId: string;

  @Property({ fieldName: "table_id", type: "string" })
    tableId: TableUID;

  @Property({ fieldName: "view_id", type: "string" })
    viewId: string;

  @Property({ fieldName: "action_id", type: "string" })
    actionId: string;

  @Property({ fieldName: "accepted_count", type: "number" })
    acceptedCount: number = 0;

  @Property({ fieldName: "blocked_count", type: "number" })
    blockedCount: number = 0;

  @Property({ fieldName: "batch_type", type: "string", default: "view_action" })
    batchType: "view_action" | "import" | "bulk" = "view_action";

  @Property({ fieldName: "total_count", type: "number", default: 0 })
    totalCount: number = 0;

  @Property({ fieldName: "total_chunks", type: "number", default: 0 })
    totalChunks: number = 0;

  @Property({ fieldName: "completed_chunks", type: "number", default: 0 })
    completedChunks: number = 0;

  @Property({ fieldName: "failed_chunks", type: "number", default: 0 })
    failedChunks: number = 0;

  @Property({ fieldName: "unknown_chunks", type: "number", default: 0 })
    unknownChunks: number = 0;

  @Property({ fieldName: "batch_status", type: "string", default: "queued" })
    batchStatus: "queued" | "running" | "completed" | "failed" | "unknown" = "queued";


  @Property({ fieldName: "created_at", type: "bigint" })
    createdAt: number = Date.now();

  @Property({ fieldName: "updated_at", type: "bigint" })
    updatedAt: number = Date.now();
}

export class ViewActionTriggerBatchRepository extends EntityRepository<ViewActionTriggerBatch> {}

@Entity({
  tableName: "view_action_trigger_tasks",
  customRepository: () => ViewActionTriggerTaskRepository,
})
@Unique({
  name: "view_action_trigger_task_batch_uuid_unique",
  properties: ["batchId", "uuid"],
})
@Index({
  name: "view_action_trigger_task_dedupe_unique",
  properties: ["dedupeKey"],
  options: { unique: true, sparse: true },
})
@Index({
  name: "view_action_trigger_task_queue_idx",
  properties: ["queueClass", "status", "availableAt", "priority", "createdAt", "sequence", "id"],
})
@Index({
  name: "view_action_trigger_task_claim_idx",
  properties: ["queueClass", "status", "priority", "createdAt", "sequence", "id", "availableAt"],
})
@Index({
  name: "view_action_trigger_task_batch_idx",
  properties: ["batchId", "sequence"],
})
@Index({
  name: "view_action_trigger_task_dependency_idx",
  properties: ["dependsOnTaskId", "status"],
})
export class ViewActionTriggerTask {
  @PrimaryKey({ mongoLike: global.mongoLike })
    id: string = unique();

  @Property({ fieldName: "batch_id", nullable: true, type: "string" })
    batchId?: string;

  @Property({ fieldName: "initiator_id", type: "string" })
    initiatorId: string;

  @Property({ fieldName: "nocode_id", type: "string" })
    nocodeId: string;

  @Property({ fieldName: "table_id", type: "string" })
    tableId: TableUID;

  @Property({ fieldName: "view_id", nullable: true, type: "string" })
    viewId?: string;

  @Property({ fieldName: "action_id", nullable: true, type: "string" })
    actionId?: string;

  @Property({ type: "string" })
    uuid: string;

  @Property({ fieldName: "data_title", type: "string" })
    dataTitle: string;

  @Property({ type: "number" })
    sequence: number;

  @Property({ fieldName: "request_payload", type: "json" })
    requestPayload: ExecuteViewActionRequest | Record<string, unknown>;

  @Property({ fieldName: "task_type", type: "string", default: "view_action_trigger" })
    taskType: PersistentTaskType = "view_action_trigger";

  @Property({ fieldName: "queue_class", type: "string", default: "p1" })
    queueClass: PersistentTaskQueueClass = "p1";

  @Property({ type: "number", default: 0 })
    priority: number = 0;

  @Property({ fieldName: "available_at", type: "bigint", default: 0 })
    availableAt: number = 0;

  @Property({ fieldName: "lease_owner", nullable: true, type: "string" })
    leaseOwner?: string;

  @Property({ fieldName: "lease_until", nullable: true, type: "bigint" })
    leaseUntil?: number;

  @Property({ fieldName: "lease_version", nullable: true, type: "number" })
    leaseVersion?: number;

  @Property({ fieldName: "attempt_count", type: "number", default: 0 })
    attemptCount: number = 0;

  @Property({ fieldName: "execution_phase", nullable: true, type: "string" })
    executionPhase?: ViewActionTriggerTaskExecutionPhase;

  @Property({ fieldName: "dedupe_key", nullable: true, type: "string" })
    dedupeKey?: string;

  @Property({ fieldName: "chunk_id", nullable: true, type: "string" })
    chunkId?: string;

  @Property({ fieldName: "chunk_sequence", nullable: true, type: "number" })
    chunkSequence?: number;

  @Property({ fieldName: "chunk_size", nullable: true, type: "number" })
    chunkSize?: number;

  @Property({ fieldName: "depends_on_task_id", nullable: true, type: "string" })
    dependsOnTaskId?: string;

  @Property({ fieldName: "mutation_action", nullable: true, type: "string" })
    mutationAction?: DataMutationTaskAction;

  @Property({ fieldName: "mutation_payload", nullable: true, type: "json" })
    mutationPayload?: DataMutationTaskPayload;

  @Property({ fieldName: "request_context", nullable: true, type: "json" })
    requestContext?: PersistentTaskRequestContext;

  @Property({ fieldName: "result_payload", nullable: true, type: "json" })
    resultPayload?: unknown;

  @Property({ type: "string" })
    status: ViewActionTriggerTaskStatus = "queued";

  @Property({ fieldName: "error_code", nullable: true, type: "string" })
    errorCode?: string;

  @Property({ fieldName: "error_message", nullable: true, type: "string" })
    errorMessage?: string;

  @Property({ fieldName: "created_at", type: "bigint" })
    createdAt: number = Date.now();

  @Property({ fieldName: "updated_at", type: "bigint" })
    updatedAt: number = Date.now();

  @Property({ fieldName: "started_at", nullable: true, type: "bigint" })
    startedAt?: number;

  @Property({ fieldName: "finished_at", nullable: true, type: "bigint" })
    finishedAt?: number;
}

export class ViewActionTriggerTaskRepository extends EntityRepository<ViewActionTriggerTask> {}

/**
 * Durable execution evidence for a logical task step. The row is deliberately
 * separate from the task so a terminal commit can be retried without
 * replaying a side effect whose result was already confirmed.
 */
@Entity({
  tableName: "flow_task_step_executions",
  customRepository: () => FlowTaskStepExecutionRepository,
})
@Unique({
  name: "flow_task_step_execution_task_step_unique",
  properties: ["taskId", "stepKey"],
})
@Index({
  name: "flow_task_step_execution_status_idx",
  properties: ["status", "updatedAt"],
})
export class FlowTaskStepExecution {
  @PrimaryKey({ mongoLike: global.mongoLike })
    id: string = unique();

  @Property({ fieldName: "task_id", type: "string" })
    taskId: string;

  @Property({ fieldName: "step_key", type: "string" })
    stepKey: string;

  @Property({ fieldName: "idempotency_key", type: "string" })
    idempotencyKey: string;

  @Property({ type: "string" })
    status: FlowTaskStepExecutionStatus = "started";

  @Property({ type: "number", default: 1 })
    attempt: number = 1;

  @Property({ fieldName: "lease_owner", nullable: true, type: "string" })
    leaseOwner?: string;

  @Property({ fieldName: "lease_version", nullable: true, type: "number" })
    leaseVersion?: number;

  @Property({ fieldName: "result_snapshot", nullable: true, type: "json" })
    resultSnapshot?: unknown;

  @Property({ fieldName: "error_code", nullable: true, type: "string" })
    errorCode?: string;

  @Property({ fieldName: "error_message", nullable: true, type: "string" })
    errorMessage?: string;

  @Property({ fieldName: "started_at", type: "bigint" })
    startedAt: number = Date.now();

  @Property({ fieldName: "finished_at", nullable: true, type: "bigint" })
    finishedAt?: number;

  @Property({ fieldName: "updated_at", type: "bigint" })
    updatedAt: number = Date.now();
}

export class FlowTaskStepExecutionRepository extends EntityRepository<FlowTaskStepExecution> {}

@Entity({
  tableName: "view_action_trigger_active_records",
  customRepository: () => ViewActionTriggerActiveRecordRepository,
})
@Unique({
  name: "view_action_trigger_active_record_unique",
  properties: ["nocodeId", "tableId", "uuid"],
})
@Index({
  name: "view_action_trigger_active_task_idx",
  properties: ["taskId"],
})
export class ViewActionTriggerActiveRecord {
  @PrimaryKey({ mongoLike: global.mongoLike })
    id: string = unique();

  @Property({ fieldName: "task_id", type: "string" })
    taskId: string;

  @Property({ fieldName: "nocode_id", type: "string" })
    nocodeId: string;

  @Property({ fieldName: "table_id", type: "string" })
    tableId: TableUID;

  @Property({ type: "string" })
    uuid: string;

  @Property({ fieldName: "created_at", type: "bigint" })
    createdAt: number = Date.now();

  @Property({ fieldName: "updated_at", type: "bigint" })
    updatedAt: number = Date.now();
}

export class ViewActionTriggerActiveRecordRepository extends EntityRepository<ViewActionTriggerActiveRecord> {}
