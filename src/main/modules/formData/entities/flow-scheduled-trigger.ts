import { Entity, EntityRepository, Index, Property, Unique } from '@mikro-orm/core'
import { PrimaryKey } from '@main/decorators/primary-key'
import { unique } from '@common/utils/unique'

export type FlowScheduleDefinitionState = 'building' | 'active' | 'paused' | 'retired' | 'failed'
export type FlowSchedulePauseReason = 'soft_deleted' | 'manual' | 'calendar_data_unavailable' | 'other'
export type FlowScheduleCursorState = 'ready' | 'leased' | 'completed' | 'disabled' | 'invalid'
export type FlowScheduleFireState = 'dispatching' | 'dispatched' | 'completed' | 'canceled'
export type FlowScheduledRunState = 'queued' | 'running' | 'succeeded' | 'skipped' | 'retry_wait' | 'dead_letter' | 'canceled'
export type FlowScheduleProjectionChangeState = 'pending' | 'leased' | 'processed' | 'dead_letter'
export type FlowScheduleChangeOutboxState = 'pending' | 'leased' | 'processed' | 'dead_letter'

@Entity({ tableName: 'flow_schedule_definition', customRepository: () => FlowScheduleDefinitionRepository })
@Unique({ name: 'flow_schedule_definition_revision_unique', properties: ['scheduleKey', 'revision'] })
@Index({ name: 'flow_schedule_definition_due_idx', properties: ['state', 'nextDueAt', 'id'] })
@Index({ name: 'flow_schedule_definition_fair_due_idx', properties: ['state', 'headDirty', 'dispatchRotationKey', 'nextDueAt', 'id'] })
@Index({ name: 'flow_schedule_definition_rotation_idx', properties: ['dispatchRotationKey'] })
@Index({ name: 'flow_schedule_definition_dirty_idx', properties: ['state', 'headDirty', 'updatedAt', 'id'] })
@Index({ name: 'flow_schedule_definition_reconcile_idx', properties: ['state', 'executionScope', 'updatedAt', 'id'] })
@Index({ name: 'flow_schedule_definition_subscription_idx', properties: ['nocodeId', 'tableId'] })
export class FlowScheduleDefinition {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string = unique()
  @Property({ fieldName: 'schedule_key' }) scheduleKey: string
  @Property() revision: number
  @Property({ fieldName: 'nocode_id' }) nocodeId: string
  @Property({ fieldName: 'table_id' }) tableId: string
  @Property({ fieldName: 'process_version' }) processVersion: string
  @Property({ fieldName: 'node_uid' }) nodeUid: string
  @Property({ fieldName: 'config_hash' }) configHash: string
  @Property({ fieldName: 'config_json', type: 'json' }) configJson: Record<string, unknown>
  @Property({ fieldName: 'execution_scope' }) executionScope: 'global' | 'per_record'
  @Property({ fieldName: 'time_zone' }) timeZone: string
  @Property({ fieldName: 'calendar_id' }) calendarId: string
  @Property() state: FlowScheduleDefinitionState = 'building'
  @Property({ fieldName: 'pause_reason', nullable: true }) pauseReason?: FlowSchedulePauseReason
  @Property({ fieldName: 'initiator_user_id' }) initiatorUserId: string = 'admin'
  @Property({ fieldName: 'lifecycle_epoch', columnType: 'bigint' }) lifecycleEpoch: number = 0
  @Property({ fieldName: 'next_due_at', nullable: true, columnType: 'bigint' }) nextDueAt?: number
  @Property({ fieldName: 'head_dirty' }) headDirty: boolean = true
  @Property({ fieldName: 'head_version', columnType: 'bigint' }) headVersion: number = 0
  @Property({ fieldName: 'dispatch_rotation_key', nullable: true }) dispatchRotationKey?: string
  @Property({ fieldName: 'activation_at', columnType: 'bigint' }) activationAt: number
  @Property({ fieldName: 'build_checkpoint', nullable: true, type: 'string' }) buildCheckpoint?: string
  @Property({ fieldName: 'reconcile_checkpoint', nullable: true, type: 'string' }) reconcileCheckpoint?: string
  @Property({ fieldName: 'created_at', columnType: 'bigint' }) createdAt: number = Date.now()
  @Property({ fieldName: 'updated_at', columnType: 'bigint' }) updatedAt: number = Date.now()
}
export class FlowScheduleDefinitionRepository extends EntityRepository<FlowScheduleDefinition> {}

@Entity({ tableName: 'flow_schedule_cursor', customRepository: () => FlowScheduleCursorRepository })
@Unique({ name: 'flow_schedule_cursor_subject_unique', properties: ['scheduleId', 'subjectKey'] })
@Index({ name: 'flow_schedule_cursor_due_idx', properties: ['state', 'nextFireAt', 'id'] })
@Index({ name: 'flow_schedule_cursor_schedule_due_idx', properties: ['scheduleId', 'state', 'nextFireAt'] })
@Index({ name: 'flow_schedule_cursor_lease_idx', properties: ['state', 'leaseUntil', 'id'] })
@Index({ name: 'flow_schedule_cursor_schedule_cleanup_idx', properties: ['scheduleId', 'updatedAt', 'id'] })
export class FlowScheduleCursor {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string = unique()
  @Property({ fieldName: 'schedule_id' }) scheduleId: string
  @Property({ fieldName: 'subject_key' }) subjectKey: string
  @Property({ fieldName: 'record_id', nullable: true }) recordId?: string
  @Property({ fieldName: 'next_fire_at', nullable: true, columnType: 'bigint' }) nextFireAt?: number
  @Property({ fieldName: 'last_scheduled_for', nullable: true, columnType: 'bigint' }) lastScheduledFor?: number
  @Property() state: FlowScheduleCursorState = 'ready'
  @Property({ fieldName: 'lease_owner', nullable: true }) leaseOwner?: string
  @Property({ fieldName: 'lease_until', nullable: true, columnType: 'bigint' }) leaseUntil?: number
  @Property({ fieldName: 'projection_version', columnType: 'bigint' }) projectionVersion: number = 0
  @Property({ fieldName: 'invalid_reason', nullable: true }) invalidReason?: string
  @Property({ fieldName: 'condition_scan_scheduled_for', nullable: true, columnType: 'bigint' }) conditionScanScheduledFor?: number
  @Property({ fieldName: 'condition_scan_checkpoint', nullable: true }) conditionScanCheckpoint?: string
  @Property({ fieldName: 'updated_at', columnType: 'bigint' }) updatedAt: number = Date.now()
}
export class FlowScheduleCursorRepository extends EntityRepository<FlowScheduleCursor> {}

@Entity({ tableName: 'flow_schedule_fire', customRepository: () => FlowScheduleFireRepository })
@Unique({ name: 'flow_schedule_fire_unique', properties: ['scheduleId', 'scheduledFor'] })
@Index({ name: 'flow_schedule_fire_cleanup_idx', properties: ['state', 'completedAt', 'id'] })
export class FlowScheduleFire {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string = unique()
  @Property({ fieldName: 'schedule_id' }) scheduleId: string
  @Property({ fieldName: 'scheduled_for', columnType: 'bigint' }) scheduledFor: number
  @Property({ fieldName: 'lifecycle_epoch', columnType: 'bigint' }) lifecycleEpoch: number = 0
  @Property() state: FlowScheduleFireState = 'dispatching'
  @Property({ fieldName: 'accepted_count' }) acceptedCount: number = 0
  @Property({ fieldName: 'skipped_count' }) skippedCount: number = 0
  @Property({ fieldName: 'succeeded_count' }) succeededCount: number = 0
  @Property({ fieldName: 'failed_count' }) failedCount: number = 0
  @Property({ fieldName: 'created_at', columnType: 'bigint' }) createdAt: number = Date.now()
  @Property({ fieldName: 'completed_at', nullable: true, columnType: 'bigint' }) completedAt?: number
}
export class FlowScheduleFireRepository extends EntityRepository<FlowScheduleFire> {}

@Entity({ tableName: 'flow_scheduled_run', customRepository: () => FlowScheduledRunRepository })
@Unique({ name: 'flow_scheduled_run_unique', properties: ['scheduleId', 'subjectKey', 'scheduledFor'] })
@Unique({ name: 'flow_scheduled_run_todo_unique', properties: ['todoId'] })
@Index({ name: 'flow_scheduled_run_available_idx', properties: ['state', 'availableAt', 'id'] })
@Index({ name: 'flow_scheduled_run_schedule_state_idx', properties: ['scheduleId', 'state'] })
@Index({ name: 'flow_scheduled_run_fire_state_idx', properties: ['fireId', 'state'] })
@Index({ name: 'flow_scheduled_run_cleanup_idx', properties: ['state', 'finishedAt', 'id'] })
@Index({ name: 'flow_scheduled_run_lease_idx', properties: ['state', 'leaseUntil', 'id'] })
export class FlowScheduledRun {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string = unique()
  @Property({ fieldName: 'fire_id' }) fireId: string
  @Property({ fieldName: 'schedule_id' }) scheduleId: string
  @Property({ fieldName: 'config_hash' }) configHash: string
  @Property({ fieldName: 'initiator_user_id' }) initiatorUserId: string = 'admin'
  @Property({ fieldName: 'lifecycle_epoch', columnType: 'bigint' }) lifecycleEpoch: number = 0
  @Property({ fieldName: 'subject_key' }) subjectKey: string
  @Property({ fieldName: 'record_id', nullable: true }) recordId?: string
  @Property({ fieldName: 'scheduled_for', columnType: 'bigint' }) scheduledFor: number
  @Property({ fieldName: 'queued_at', columnType: 'bigint' }) queuedAt: number = Date.now()
  @Property({ fieldName: 'available_at', columnType: 'bigint' }) availableAt: number = Date.now()
  @Property({ fieldName: 'started_at', nullable: true, columnType: 'bigint' }) startedAt?: number
  @Property({ fieldName: 'finished_at', nullable: true, columnType: 'bigint' }) finishedAt?: number
  @Property() state: FlowScheduledRunState = 'queued'
  @Property({ fieldName: 'attempt_count' }) attemptCount: number = 0
  @Property({ fieldName: 'lease_owner', nullable: true }) leaseOwner?: string
  @Property({ fieldName: 'lease_until', nullable: true, columnType: 'bigint' }) leaseUntil?: number
  @Property({ fieldName: 'lease_version', columnType: 'bigint' }) leaseVersion: number = 0
  @Property({ fieldName: 'todo_id' }) todoId: string = unique()
  @Property({ fieldName: 'workflow_execution_id', nullable: true }) workflowExecutionId?: string
  @Property({ fieldName: 'error_code', nullable: true }) errorCode?: string
  @Property({ fieldName: 'error_message', nullable: true }) errorMessage?: string
}
export class FlowScheduledRunRepository extends EntityRepository<FlowScheduledRun> {}

@Entity({ tableName: 'flow_schedule_projection_change', customRepository: () => FlowScheduleProjectionChangeRepository })
@Unique({ name: 'flow_schedule_projection_change_unique', properties: ['scheduleId', 'recordId'] })
@Index({ name: 'flow_schedule_projection_change_pending_idx', properties: ['state', 'availableAt', 'id'] })
@Index({ name: 'flow_schedule_projection_change_schedule_idx', properties: ['scheduleId', 'updatedAt', 'id'] })
@Index({ name: 'flow_schedule_projection_change_schedule_pending_idx', properties: ['scheduleId', 'state', 'availableAt', 'id'] })
@Index({ name: 'flow_schedule_projection_change_lease_idx', properties: ['leaseUntil', 'id'] })
export class FlowScheduleProjectionChange {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string = unique()
  @Property({ fieldName: 'schedule_id' }) scheduleId: string
  @Property({ fieldName: 'record_id' }) recordId: string
  @Property({ fieldName: 'created_at', columnType: 'bigint' }) createdAt: number = Date.now()
  @Property({ fieldName: 'updated_at', columnType: 'bigint' }) updatedAt: number = Date.now()
  @Property() state: FlowScheduleProjectionChangeState = 'pending'
  @Property({ fieldName: 'available_at', columnType: 'bigint' }) availableAt: number = Date.now()
  @Property({ fieldName: 'lease_owner', nullable: true }) leaseOwner?: string
  @Property({ fieldName: 'lease_until', nullable: true, columnType: 'bigint' }) leaseUntil?: number
  @Property({ fieldName: 'attempt_count' }) attemptCount: number = 0
}
export class FlowScheduleProjectionChangeRepository extends EntityRepository<FlowScheduleProjectionChange> {}

/**
 * A coalesced, replayable signal that an application's schedule definition
 * needs to be compiled. The application body remains the source of truth; a
 * single row per app is enough because newer saves supersede older payloads.
 */
@Entity({ tableName: 'flow_schedule_change_outbox', customRepository: () => FlowScheduleChangeOutboxRepository })
@Unique({ name: 'flow_schedule_change_outbox_nocode_unique', properties: ['nocodeId'] })
@Index({ name: 'flow_schedule_change_outbox_pending_idx', properties: ['state', 'availableAt', 'id'] })
@Index({ name: 'flow_schedule_change_outbox_lease_idx', properties: ['state', 'leaseUntil', 'id'] })
export class FlowScheduleChangeOutbox {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string = unique()
  @Property({ fieldName: 'nocode_id' }) nocodeId: string
  @Property() reason: string = 'configuration'
  @Property({ fieldName: 'aggregate_version', columnType: 'bigint' }) aggregateVersion: number = 0
  @Property() state: FlowScheduleChangeOutboxState = 'pending'
  @Property({ fieldName: 'available_at', columnType: 'bigint' }) availableAt: number = Date.now()
  @Property({ fieldName: 'lease_owner', nullable: true }) leaseOwner?: string
  @Property({ fieldName: 'lease_until', nullable: true, columnType: 'bigint' }) leaseUntil?: number
  @Property({ fieldName: 'attempt_count' }) attemptCount: number = 0
  @Property({ fieldName: 'created_at', columnType: 'bigint' }) createdAt: number = Date.now()
  @Property({ fieldName: 'updated_at', columnType: 'bigint' }) updatedAt: number = Date.now()
}
export class FlowScheduleChangeOutboxRepository extends EntityRepository<FlowScheduleChangeOutbox> {}
