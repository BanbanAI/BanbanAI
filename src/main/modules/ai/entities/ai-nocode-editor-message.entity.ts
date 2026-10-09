import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'
import { AiMessageRole } from '../ai.types'

@Entity({
  tableName: 'ai_nocode_editor_message',
  customRepository: () => AiNocodeEditorMessageRepository,
})
export class AiNocodeEditorMessageEntity {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @Property({ type: 'string' })
  conversationId: string

  @Property({ type: 'string' })
  ownerAccountId: string

  @Property({ type: 'string' })
  role: AiMessageRole = AiMessageRole.USER

  @Property({ nullable: true, type: 'number', default: 0 })
  sequence: number = 0

  @Property({ nullable: true, type: 'text' })
  content: string = ''

  @Property({ nullable: true, type: 'string' })
  traceId: string = null

  @Property({ nullable: true, type: 'json' })
  metadata: Record<string, any> = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()
}

export class AiNocodeEditorMessageRepository extends EntityRepository<AiNocodeEditorMessageEntity> {}

