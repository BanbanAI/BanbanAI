import { Entity, Property } from '@mikro-orm/core'
import type { AiDefaultModelSelections, AiFeatureFlags, AiSettingsMigrations } from '@common/types/ai-provider'
import { PrimaryKey } from '@main/decorators/primary-key'

@Entity({ tableName: 'ai_config' })
export class AiConfigEntity {
  @PrimaryKey()
  id: string = 'default'

  @Property({ type: 'boolean' })
  enabled: boolean = true

  @Property({ type: 'boolean' })
  autoTaskEnabled: boolean = false

  @Property({ type: 'boolean' })
  allowModelSelection: boolean = true

  @Property({ nullable: true, type: 'json' })
  defaultSelections: AiDefaultModelSelections = { fast: null, balanced: null, deep: null }

  @Property({ nullable: true, type: 'json' })
  featureFlags: AiFeatureFlags = null

  @Property({ nullable: true, type: 'json' })
  migrations: AiSettingsMigrations = null

  @Property({ type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()
}
