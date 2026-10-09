import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import type { AiModelCapability, AiModelEndpointType, AiModelModality, AiModelSource, AiModelTier, AiModelToolCapabilities, AiModelValidationChecks, AiModelValidationStatus } from '@common/types/ai-provider'
import { PrimaryKey } from '@main/decorators/primary-key'
import { AiProviderEntity } from './ai-provider.entity'

export type AiModelLimits = {
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  contextWindow?: number | null
  supportsStreaming?: boolean
}

export type AiModelValidationSnapshot = {
  message?: string | null
  checks?: AiModelValidationChecks | null
  checkedAt?: number | null
}

@Entity({ tableName: 'ai_provider_model' })
@Unique({ properties: ['provider', 'modelId'] })
@Index({ properties: ['provider', 'enabled'] })
@Index({ properties: ['provider', 'sortOrder'] })
export class AiProviderModelEntity {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @ManyToOne(() => AiProviderEntity, { onDelete: 'cascade' })
  provider: AiProviderEntity

  @Property({ type: 'string' })
  modelId: string

  @Property({ type: 'string' })
  model: string

  @Property({ type: 'string' })
  displayName: string

  @Property({ nullable: true, type: 'string' })
  tier: AiModelTier = null

  @Property({ type: 'boolean' })
  enabled: boolean = true

  @Property({ type: 'boolean' })
  available: boolean = true

  @Property({ type: 'boolean' })
  allowInWorkbenchAgent: boolean = true

  @Property({ type: 'boolean' })
  supportsTools: boolean = false

  @Property({ nullable: true, type: 'json' })
  toolCapabilities: AiModelToolCapabilities = null

  @Property({ nullable: true, type: 'json' })
  capabilities: AiModelCapability[] = null

  @Property({ nullable: true, type: 'json' })
  inputModalities: AiModelModality[] = null

  @Property({ nullable: true, type: 'json' })
  outputModalities: AiModelModality[] = null

  @Property({ nullable: true, type: 'json' })
  endpointTypes: AiModelEndpointType[] = null

  @Property({ nullable: true, type: 'json' })
  limits: AiModelLimits = null

  @Property({ type: 'string' })
  source: AiModelSource = 'manual'

  @Property({ type: 'string' })
  validationStatus: AiModelValidationStatus = 'unverified'

  @Property({ nullable: true, type: 'json' })
  validation: AiModelValidationSnapshot = null

  @Property({ nullable: true, type: 'json' })
  meta: Record<string, any> = null

  @Property({ nullable: true, type: 'string' })
  remark: string = null

  @Property({ nullable: true, type: 'number', columnType: 'bigint' })
  lastDiscoveredAt: number = null

  @Property({ type: 'number' })
  sortOrder: number = 0

  @Property({ type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()
}
