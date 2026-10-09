import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'
import { AiThreadAppScope, AiThreadContextState, AiThreadKind, AiThreadModelSelectionSource, AiThreadRuntimeState, AiThreadVisitorProfile } from '../ai.types'

@Entity({
  tableName: 'ai_thread',
  customRepository: () => AiThreadRepository,
})
export class AiThreadEntity {
  static readonly DEFAULT_TITLE = 'New Chat'

  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @Property({ type: 'string' })
  agentId: string

  @Property({ type: 'string' })
  ownerAccountId: string

  @Property({ type: 'string' })
  kind: AiThreadKind = 'private'

  @Property({ type: 'string' })
  title: string = AiThreadEntity.DEFAULT_TITLE

  @Property({ nullable: true, type: 'json' })
  appScope: AiThreadAppScope = null

  @Property({ nullable: true, type: 'string' })
  providerId: string = null

  @Property({ nullable: true, type: 'string' })
  modelId: string = null

  @Property({ nullable: true, type: 'string' })
  model: string = null

  @Property({ nullable: true, type: 'string' })
  modelSelectionSource: AiThreadModelSelectionSource = null

  @Property({ nullable: true, type: 'boolean' })
  pinned: boolean = false

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  pinTime: number = null

  @Property({ nullable: true, type: 'string' })
  visitorKey: string = null

  @Property({ nullable: true, type: 'json' })
  visitorProfile: AiThreadVisitorProfile = null

  @Property({ nullable: true, type: 'json' })
  runtimeState: AiThreadRuntimeState = null

  @Property({ nullable: true, type: 'json' })
  contextState: AiThreadContextState = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  hiddenTime: number = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  deleteTime: number = null
}

export class AiThreadRepository extends EntityRepository<AiThreadEntity> {}
