import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'

@Entity({
  tableName: 'ai_conversation',
  customRepository: () => AiConversationRepository,
})
export class AiConversation {
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
  title: string = global.i18next.t('aiConversationEntity.newConversation')

  @Property({ nullable: true, type: 'json' })
  metadata: Record<string, any> = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  lastMessageAt: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  deleteTime: number = null
}

export class AiConversationRepository extends EntityRepository<AiConversation> {
}
