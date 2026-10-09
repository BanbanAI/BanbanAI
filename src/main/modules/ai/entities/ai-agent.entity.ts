import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'
import { AiThreadAppScope, AiThreadModelSelectionSource } from '../ai.types'

@Entity({
  tableName: 'ai_agent',
  customRepository: () => AiAgentRepository,
})
export class AiAgentEntity {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @Property({ type: 'string' })
  ownerAccountId: string

  @Property({ type: 'string' })
  name: string = 'New Chat'

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

  @Property({ nullable: true, type: 'boolean' })
  sharing: boolean = false

  @Property({ nullable: true, type: 'string' })
  shareToken: string = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  shareTime: number = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  deleteTime: number = null
}

export class AiAgentRepository extends EntityRepository<AiAgentEntity> {
}
