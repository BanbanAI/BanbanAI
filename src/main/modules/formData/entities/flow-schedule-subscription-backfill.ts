import { Entity, Property } from '@mikro-orm/core'
import { PrimaryKey } from '@main/decorators/primary-key'

export type FlowScheduleSubscriptionBackfillState = 'pending' | 'running' | 'completed'

@Entity({ tableName: 'flow_schedule_subscription_backfill' })
export class FlowScheduleSubscriptionBackfill {
  @PrimaryKey({ mongoLike: global.mongoLike }) id: string
  @Property() state: FlowScheduleSubscriptionBackfillState = 'pending'
  @Property({ nullable: true }) checkpoint?: string
  @Property({ fieldName: 'lease_owner', nullable: true }) leaseOwner?: string
  @Property({ fieldName: 'lease_until', nullable: true, columnType: 'bigint' }) leaseUntil?: number
  @Property({ fieldName: 'queued_count' }) queuedCount: number = 0
  @Property({ fieldName: 'created_at', columnType: 'bigint' }) createdAt: number = Date.now()
  @Property({ fieldName: 'updated_at', columnType: 'bigint' }) updatedAt: number = Date.now()
  @Property({ fieldName: 'completed_at', nullable: true, columnType: 'bigint' }) completedAt?: number
}
