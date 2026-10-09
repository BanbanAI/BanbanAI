import { DataChangeType, Row, TableUID } from "@common/types/project";
import { Entity, EntityRepository, Property } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";

export type FlowImmediateMutationStatus = "applied" | "rolled_back" | "skipped" | "conflict" | "failed";
export type FlowImmediateTriggerStatus = "pending" | "running" | "success" | "failed";
export type FlowImmediateMutationSource = "trigger" | "current_form_node" | "cross_table_node" | "submit_todo" | "report_data";
export type FlowImmediateRollbackPolicy = "keep" | "restore" | "cancel_delete" | "reverse";

@Entity({
  tableName: "flow_immediate_mutations",
  customRepository: () => FlowImmediateMutationRepository,
})
export class FlowImmediateMutation {
  @PrimaryKey({ mongoLike: global.mongoLike })
  id: string = unique();

  @Property({ fieldName: "todo_id", type: "string" })
  todoId: string;

  @Property({ fieldName: "occurrence_id", type: "string" })
  occurrenceId: string;

  @Property({ type: "number" })
  sequence: number;

  @Property({ type: "string" })
  source: FlowImmediateMutationSource;

  @Property({ type: "string" })
  action: DataChangeType;

  @Property({ fieldName: "rollback_policy", nullable: true, type: "string" })
  rollbackPolicy?: FlowImmediateRollbackPolicy;

  @Property({ fieldName: "target_nocode_id", type: "string" })
  targetNocodeId: string;

  @Property({ fieldName: "target_table_id", type: "string" })
  targetTableId: TableUID;

  @Property({ fieldName: "target_uuid", nullable: true, type: "string" })
  targetUuid?: string;

  @Property({ fieldName: "before_snapshot", nullable: true, type: "json" })
  beforeSnapshot?: Row[];

  @Property({ fieldName: "after_snapshot", nullable: true, type: "json" })
  afterSnapshot?: Row[];

  @Property({ fieldName: "changed_field_uids", nullable: true, type: "json" })
  changedFieldUids?: string[];

  @Property({ type: "string" })
  status: FlowImmediateMutationStatus = "applied";

  @Property({ fieldName: "trigger_status", nullable: true, type: "string" })
  triggerStatus?: FlowImmediateTriggerStatus;

  @Property({ fieldName: "trigger_target_process", nullable: true, type: "boolean" })
  triggerTargetProcess?: boolean;

  @Property({ fieldName: "trigger_attempt_count", nullable: true, type: "number" })
  triggerAttemptCount = 0;

  @Property({ fieldName: "trigger_last_error", nullable: true, type: "string" })
  triggerLastError?: string;

  @Property({ fieldName: "trigger_next_retry_at", nullable: true, type: "bigint" })
  triggerNextRetryAt?: number;

  @Property({ fieldName: "triggered_at", nullable: true, type: "bigint" })
  triggeredAt?: number;

  @Property({ fieldName: "conflict_detail", nullable: true, type: "json" })
  conflictDetail?: any;

  @Property({ fieldName: "created_at", type: "bigint" })
  createdAt: number = Date.now();

  @Property({ fieldName: "rolled_back_at", nullable: true, type: "bigint" })
  rolledBackAt?: number;
}

export class FlowImmediateMutationRepository extends EntityRepository<FlowImmediateMutation> {}
