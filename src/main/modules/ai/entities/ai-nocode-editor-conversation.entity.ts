import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { PrimaryKey } from '@main/decorators/primary-key'

@Entity({
  tableName: 'ai_nocode_editor_conversation',
  customRepository: () => AiNocodeEditorConversationRepository,
})
export class AiNocodeEditorConversationEntity {
  static get DEFAULT_TITLE() { return global.i18next.t('aiNocodeEditorConversationEntity.defaultTitle') }

    @PrimaryKey({ mongoLike: global.mongoLike, length: 255 })
      id: string = ''

    @Property({ type: 'string' })
      ownerAccountId: string

    @Property({ type: 'string' })
      nocodeId: string

    @Property({ type: 'string' })
      title: string = AiNocodeEditorConversationEntity.DEFAULT_TITLE

    @Property({ nullable: true, type: 'string' })
      providerId: string = null

    @Property({ nullable: true, type: 'string' })
      modelId: string = null

    @Property({ nullable: true, type: 'string' })
      model: string = null

    @Property({ nullable: true, type: 'string' })
      modelSelectionSource: 'default' | 'explicit' = null

    @Property({ nullable: true, type: 'string' })
      taskId: string = ''

    @Property({ nullable: true, type: 'string' })
      scopeKey: string = ''

    @Property({ nullable: true, type: 'string' })
      source: string = ''

    @Property({ nullable: true, type: 'json' })
      taskSummary: Record<string, unknown> | null = null

    @Property({ nullable: true, type: 'number', columnType: 'bigint' })
      lastActiveTime: number = Date.now()

    @Property({ nullable: true, type: 'number', columnType: 'bigint' })
      createTime: number = Date.now()

    @Property({ nullable: true, type: 'number', columnType: 'bigint' })
      updateTime: number = Date.now()
}

export class AiNocodeEditorConversationRepository extends EntityRepository<AiNocodeEditorConversationEntity> {}

