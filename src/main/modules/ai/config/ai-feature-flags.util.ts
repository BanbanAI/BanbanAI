import type { AiFeatureFlags } from '@common/types/ai-provider'

function normalizeWarmupDuration(value: unknown, fallback: number) {
  if (!Number.isFinite(Number(value))) {
    return fallback
  }
  return Math.max(0, Math.round(Number(value)))
}

function normalizeWarmupPositiveInt(value: unknown, fallback: number, max: number) {
  if (!Number.isFinite(Number(value))) {
    return fallback
  }
  return Math.max(1, Math.min(max, Math.round(Number(value))))
}

export function normalizeAiFeatureFlags(value?: Partial<AiFeatureFlags> | null): AiFeatureFlags {
  return {
    batchReadAppDataEnabled: value?.batchReadAppDataEnabled !== false,
    dynamicToolParallelEnabled: value?.dynamicToolParallelEnabled !== false,
    batchRuntimeStateEnabled: value?.batchRuntimeStateEnabled !== false,
    batchToolTraceEnabled: value?.batchToolTraceEnabled !== false,
    searchAppsWeakRepeatGuardEnabled: value?.searchAppsWeakRepeatGuardEnabled !== false,
    searchAppsCatalogInvalidateEnabled: value?.searchAppsCatalogInvalidateEnabled !== false,
    searchAppsRepeatGuardFallbackTtlMs: Number.isFinite(Number(value?.searchAppsRepeatGuardFallbackTtlMs))
      ? Math.max(0, Math.round(Number(value?.searchAppsRepeatGuardFallbackTtlMs)))
      : 180000,
    searchAppsDominantConvergenceEnabled: value?.searchAppsDominantConvergenceEnabled !== false,
    neutralColdStartProfileEnabled: value?.neutralColdStartProfileEnabled === true,
    searchAppsTopCandidateStructurePrimeEnabled: value?.searchAppsTopCandidateStructurePrimeEnabled === true,
    searchAppsTopCandidateStructurePrimeLimit: Number.isFinite(Number(value?.searchAppsTopCandidateStructurePrimeLimit))
      ? Math.max(1, Math.min(3, Math.round(Number(value?.searchAppsTopCandidateStructurePrimeLimit))))
      : 3,
    searchAppsTopCandidateStructurePrimeJoinTimeoutMs: Number.isFinite(Number(value?.searchAppsTopCandidateStructurePrimeJoinTimeoutMs))
      ? Math.max(0, Math.round(Number(value?.searchAppsTopCandidateStructurePrimeJoinTimeoutMs)))
      : 0,
    deterministicAnalysisChartEnabled: value?.deterministicAnalysisChartEnabled !== false,
    analysisChartModelHintEnabled: value?.analysisChartModelHintEnabled !== false,
    semanticWarmupEnabled: value?.semanticWarmupEnabled !== false,
    semanticWarmupBootstrapIdleEnabled: value?.semanticWarmupBootstrapIdleEnabled !== false,
    semanticWarmupObservationWritebackEnabled: value?.semanticWarmupObservationWritebackEnabled === true,
    semanticDerivedSummaryEnabled: value?.semanticDerivedSummaryEnabled !== false,
    warmupUserIdleGateEnabled: value?.warmupUserIdleGateEnabled !== false,
    warmupStopOnUserActivityEnabled: value?.warmupStopOnUserActivityEnabled !== false,
    warmupCatalogMinIdleMs: normalizeWarmupDuration(value?.warmupCatalogMinIdleMs, 5 * 60 * 1000),
    warmupProfileMinIdleMs: normalizeWarmupDuration(value?.warmupProfileMinIdleMs, 10 * 60 * 1000),
    warmupDeepMinIdleMs: normalizeWarmupDuration(value?.warmupDeepMinIdleMs, 30 * 60 * 1000),
    warmupGlobalConcurrency: normalizeWarmupPositiveInt(value?.warmupGlobalConcurrency, 1, 4),
    warmupIdleSweepBatchSize: normalizeWarmupPositiveInt(value?.warmupIdleSweepBatchSize, 1, 4),
    warmupSearchSyncPrimeLimit: normalizeWarmupPositiveInt(value?.warmupSearchSyncPrimeLimit, 5, 8),
    warmupSearchSyncPrimeJoinTimeoutMs: normalizeWarmupDuration(value?.warmupSearchSyncPrimeJoinTimeoutMs, 800),
  }
}
