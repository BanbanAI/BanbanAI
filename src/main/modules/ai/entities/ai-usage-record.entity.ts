import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'

@Entity({
  tableName: 'ai_usage_record',
  customRepository: () => AiUsageRecordRepository,
})
export class AiUsageRecord {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @Property({ nullable: true, type: 'string' })
  accountId: string

  @Property({ nullable: true, type: 'string' })
  agentId: string = null

  @Property({ nullable: true, type: 'string' })
  visitorId: string = null

  @Property({ nullable: true, type: 'string' })
  channel: string = 'owner'

  @Property({ nullable: true, type: 'string' })
  conversationId: string = null

  @Property({ nullable: true, type: 'string' })
  messageId: string = null

  @Property({ nullable: true, type: 'string' })
  scope: string = 'chat'

  @Property({ nullable: true, type: 'string' })
  provider: string = 'stub'

  @Property({ nullable: true, type: 'string' })
  model: string = 'stub/local'

  @Property({ nullable: true, type: 'number', default: 0 })
  inputTokens: number = 0

  @Property({ nullable: true, type: 'number', default: 0 })
  outputTokens: number = 0

  @Property({ nullable: true, type: 'number', default: 0 })
  totalTokens: number = 0

  @Property({ nullable: true, type: 'number', default: 0 })
  quotaCost: number = 0

  @Property({ nullable: true, type: 'string' })
  usageDate: string

  @Property({ nullable: true, type: 'string' })
  usageMonth: string

  @Property({ nullable: true, type: 'json' })
  metadata: Record<string, any> = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()
}

export class AiUsageRecordRepository extends EntityRepository<AiUsageRecord> {
}
