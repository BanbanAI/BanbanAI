import type {
  AiModelCapability,
  AiModelEndpointType,
  AiModelModality,
} from '@common/utils/aiModelCapabilities'

export type {
  AiModelCapability,
  AiModelEndpointType,
  AiModelModality,
} from '@common/utils/aiModelCapabilities'

export type AiProviderType = 'builtin-cloud' | 'ollama' | 'openai-compatible'

export type AiProviderHealthStatus = 'unknown' | 'healthy' | 'unhealthy'

export type AiBuiltinRouteStatus = 'unknown' | 'ready' | 'degraded' | 'unavailable'

export type AiModelValidationStatus = 'unverified' | 'passed' | 'failed' | 'manual-disabled'

export type AiModelSource = 'builtin' | 'sync' | 'manual'

export type AiModelTier = 'fast' | 'balanced' | 'deep'

export type AiTierDefaultSelection = {
  providerId: string
  modelId: string
}

export type AiDefaultModelSelections = {
  fast: AiTierDefaultSelection | null
  balanced: AiTierDefaultSelection | null
  deep: AiTierDefaultSelection | null
}

export type AiModelToolCapabilities = {
  auto: boolean
  requireAny: boolean
  requireSpecific: boolean
  parallel: boolean
}

export type AiModelValidationChecks = {
  connection: boolean
  generation: boolean
  toolAuto: boolean
  toolRequireAny: boolean
  toolRequireSpecific: boolean
  toolParallel: boolean
}

export type AiBuiltinRouteChecks = {
  connection: boolean
  generation: boolean
  toolAuto: boolean
}

export type AiProviderModel = {
  id: string
  model: string
  displayName: string
  tier?: AiModelTier | null
  enabled: boolean
  /** Whether the model still exists in the latest authoritative catalog. */
  available?: boolean
  allowInWorkbenchAgent: boolean
  supportsTools: boolean
  toolCapabilities?: AiModelToolCapabilities | null
  /** Legacy field kept only for persisted-config migration. */
  supportsVision?: boolean
  capabilities: AiModelCapability[]
  inputModalities: AiModelModality[]
  outputModalities: AiModelModality[]
  endpointTypes: AiModelEndpointType[]
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  supportsStreaming: boolean
  contextWindow?: number | null
  source: AiModelSource
  validationStatus: AiModelValidationStatus
  validationMessage?: string | null
  validationChecks?: AiModelValidationChecks | null
  lastValidatedAt?: number | null
  remark?: string | null
  meta?: Record<string, any> | null
}

export type AiProviderConfig = {
  id: string
  name: string
  type: AiProviderType
  enabled: boolean
  baseUrl?: string | null
  /** Write-only field; public responses contain only a truncated stored ciphertext. */
  apiKey?: string | null
  /** Internal server-side ciphertext used to render the write-only field. */
  apiKeyEncrypted?: string | null
  credentials?: AiProviderCredentialSummary[]
  managementMode?: 'fixed' | 'custom'
  presetKey?: string | null
  requiresPlatformLogin?: boolean
  lastSyncedAccountId?: string | null
  defaultModelId?: string | null
  models: AiProviderModel[]
  availableModels?: AiProviderModel[]
  /** User-managed models for the built-in provider. */
  builtinManagedModels?: AiProviderModel[]
  lastHealthCheckAt?: number | null
  lastHealthStatus?: AiProviderHealthStatus
  lastHealthMessage?: string | null
  builtinRouteStatus?: AiBuiltinRouteStatus
  builtinRouteCheckedAt?: number | null
  builtinRouteMessage?: string | null
  builtinEffectiveModel?: string | null
  builtinModelsSyncedAt?: number | null
  builtinCapabilities?: AiModelToolCapabilities | null
  builtinChecks?: AiBuiltinRouteChecks | null
}

export type AiProviderCredentialSummary = {
  id: string
  label?: string | null
  enabled: boolean
  masked: string
  lastUsedAt?: number | null
}

export type AiFeatureFlags = {
  batchReadAppDataEnabled: boolean
  dynamicToolParallelEnabled: boolean
  batchRuntimeStateEnabled: boolean
  batchToolTraceEnabled: boolean
  searchAppsWeakRepeatGuardEnabled: boolean
  searchAppsCatalogInvalidateEnabled: boolean
  searchAppsRepeatGuardFallbackTtlMs: number
  searchAppsDominantConvergenceEnabled: boolean
  neutralColdStartProfileEnabled: boolean
  searchAppsTopCandidateStructurePrimeEnabled: boolean
  searchAppsTopCandidateStructurePrimeLimit: number
  searchAppsTopCandidateStructurePrimeJoinTimeoutMs: number
  deterministicAnalysisChartEnabled: boolean
  analysisChartModelHintEnabled: boolean
  semanticWarmupEnabled: boolean
  semanticWarmupBootstrapIdleEnabled: boolean
  semanticWarmupObservationWritebackEnabled: boolean
  semanticDerivedSummaryEnabled: boolean
  warmupUserIdleGateEnabled: boolean
  warmupStopOnUserActivityEnabled: boolean
  warmupCatalogMinIdleMs: number
  warmupProfileMinIdleMs: number
  warmupDeepMinIdleMs: number
  warmupGlobalConcurrency: number
  warmupIdleSweepBatchSize: number
  warmupSearchSyncPrimeLimit: number
  warmupSearchSyncPrimeJoinTimeoutMs: number
}

export type AiSettingsMigrations = {
  builtinModelBootstrapCompletedAt?: number | null
}

export type AiSettings = {
  enabled: boolean
  autoTaskEnabled: boolean
  allowModelSelection: boolean
  defaultSelections?: AiDefaultModelSelections | null
  defaultProviderId?: string | null
  defaultModelId?: string | null
  featureFlags?: AiFeatureFlags
  migrations?: AiSettingsMigrations | null
  providers: AiProviderConfig[]
}

export type AiThreadModelSelection = {
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: AiThreadModelSelectionSource | null
}

export type AiThreadModelSelectionSource = 'default' | 'explicit'

export type AiModelCatalogItem = {
  providerId: string
  providerName: string
  providerType: AiProviderType
  modelId: string
  model: string
  displayName: string
  label: string
  supportsTools: boolean
  capabilities: AiModelCapability[]
  inputModalities: AiModelModality[]
  outputModalities: AiModelModality[]
  endpointTypes: AiModelEndpointType[]
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  supportsStreaming: boolean
  /** Legacy compatibility for older renderer consumers. */
  supportsVision?: boolean
  contextWindow?: number | null
  isDefault?: boolean
}

export type AiModelCatalog = {
  enabled: boolean
  allowModelSelection: boolean
  defaultProviderId?: string | null
  defaultModelId?: string | null
  featureFlags?: AiFeatureFlags
  items: AiModelCatalogItem[]
}

export type AiProviderTestResult = {
  success: boolean
  checkedAt: number
  healthStatus: AiProviderHealthStatus
  message?: string | null
  models?: AiProviderModel[]
  provider?: AiProviderConfig
}

export type AiModelValidationResult = {
  success: boolean
  checkedAt: number
  status: AiModelValidationStatus
  checks: AiModelValidationChecks & {
    tools: boolean
  }
  message?: string | null
  model?: AiProviderModel
}

export type AiModelHealthCheckKeyResult = {
  keyIndex: number
  success: boolean
  checkedAt: number
  durationMs: number
  message?: string | null
}

export type AiModelHealthCheckResult = {
  success: boolean
  checkedAt: number
  durationMs: number
  message?: string | null
  keyResults: AiModelHealthCheckKeyResult[]
}

export type AiBuiltinPreflightPurposeReadiness = {
  ready: boolean
  requiredTier: AiModelTier
  effectiveModel?: string | null
  message?: string | null
}

export type AiBuiltinPreflightResult = {
  success: boolean
  checkedAt: number
  status: AiBuiltinRouteStatus
  message?: string | null
  effectiveModel?: string | null
  checks: AiBuiltinRouteChecks
  capabilities: AiModelToolCapabilities
  readiness: {
    interactiveDefault: AiBuiltinPreflightPurposeReadiness
    semanticWarmup: AiBuiltinPreflightPurposeReadiness
  }
}
