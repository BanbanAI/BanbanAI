import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'
import { AiProviderEntity } from './ai-provider.entity'

@Entity({ tableName: 'ai_provider_credential' })
@Index({ properties: ['provider', 'enabled', 'sortOrder'] })
export class AiProviderCredentialEntity {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @ManyToOne(() => AiProviderEntity, { onDelete: 'cascade' })
  provider: AiProviderEntity

  @Property({ type: 'string' })
  encryptedValue: string

  @Property({ nullable: true, type: 'string' })
  label: string = null

  @Property({ type: 'boolean' })
  enabled: boolean = true

  @Property({ type: 'number' })
  sortOrder: number = 0

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  lastUsedAt: number = null

  @Property({ type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()
}
