import { Entity, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import type { AiBuiltinRouteChecks, AiBuiltinRouteStatus, AiModelToolCapabilities, AiProviderHealthStatus, AiProviderType } from '@common/types/ai-provider'
import { PrimaryKey } from '@main/decorators/primary-key'

export type AiProviderHealthSnapshot = {
  checkedAt?: number | null
  status?: AiProviderHealthStatus
  message?: string | null
}

export type AiBuiltinProviderRuntimeState = {
  status?: AiBuiltinRouteStatus
  checkedAt?: number | null
  message?: string | null
  effectiveModel?: string | null
  capabilities?: AiModelToolCapabilities | null
  checks?: AiBuiltinRouteChecks | null
}

@Entity({ tableName: 'ai_provider' })
export class AiProviderEntity {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 64 })
  id: string = unique(20)

  @Property({ type: 'string' })
  name: string

  @Property({ type: 'string' })
  type: AiProviderType

  @Property({ type: 'string' })
  managementMode: 'fixed' | 'custom' = 'custom'

  @Property({ nullable: true, type: 'string' })
  presetKey: string = null

  @Property({ type: 'boolean' })
  requiresPlatformLogin: boolean = false

  @Property({ type: 'boolean' })
  enabled: boolean = true

  @Property({ nullable: true, type: 'string' })
  baseUrl: string = null

  @Property({ nullable: true, type: 'string' })
  defaultModelId: string = null

  @Property({ nullable: true, type: 'json' })
  health: AiProviderHealthSnapshot = null

  @Property({ nullable: true, type: 'json' })
  builtinRuntime: AiBuiltinProviderRuntimeState = null

  @Property({ nullable: true, type: 'string' })
  lastSyncedAccountId: string = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  lastModelsSyncedAt: number = null

  @Property({ type: 'number' })
  sortOrder: number = 0

  @Property({ type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()
}
