import type { AiFeatureFlags } from '@common/types/ai-provider'
import type { AiAppMemoryWarmupPhase } from '../ai.types'

export function getWarmupPhaseRequiredIdleMs(
  phase: AiAppMemoryWarmupPhase,
  flags: Pick<AiFeatureFlags, 'warmupCatalogMinIdleMs' | 'warmupProfileMinIdleMs' | 'warmupDeepMinIdleMs'>,
) {
  if (phase === 'deep') {
    return Math.max(0, Math.round(Number(flags.warmupDeepMinIdleMs || 0)))
  }
  if (phase === 'profile') {
    return Math.max(0, Math.round(Number(flags.warmupProfileMinIdleMs || 0)))
  }
  return Math.max(0, Math.round(Number(flags.warmupCatalogMinIdleMs || 0)))
}

export function clampWarmupGlobalConcurrency(value: unknown) {
  if (!Number.isFinite(Number(value))) {
    return 1
  }
  return Math.max(1, Math.min(4, Math.round(Number(value))))
}

export function clampWarmupIdleSweepBatchSize(value: unknown) {
  if (!Number.isFinite(Number(value))) {
    return 1
  }
  return Math.max(1, Math.min(4, Math.round(Number(value))))
}

export function isWarmupPhaseIdleEligible(options: {
  phase: AiAppMemoryWarmupPhase
  scopedIdleAgeMs: number
  globalIdleAgeMs: number
  flags: Pick<AiFeatureFlags,
    | 'warmupUserIdleGateEnabled'
    | 'warmupCatalogMinIdleMs'
    | 'warmupProfileMinIdleMs'
    | 'warmupDeepMinIdleMs'
  >
}) {
  if (options.flags.warmupUserIdleGateEnabled === false) {
    return true
  }
  const requiredIdleMs = getWarmupPhaseRequiredIdleMs(options.phase, options.flags)
  const scopedIdleAgeMs = Math.max(0, Number(options.scopedIdleAgeMs || 0))
  const globalIdleAgeMs = Math.max(0, Number(options.globalIdleAgeMs || 0))
  return scopedIdleAgeMs >= requiredIdleMs && globalIdleAgeMs >= requiredIdleMs
}

export function buildWarmupIdleDecision(options: {
  phase: AiAppMemoryWarmupPhase
  scopedIdleAgeMs: number
  globalIdleAgeMs: number
  now: number
  flags: Pick<AiFeatureFlags,
    | 'warmupUserIdleGateEnabled'
    | 'warmupCatalogMinIdleMs'
    | 'warmupProfileMinIdleMs'
    | 'warmupDeepMinIdleMs'
  >
}) {
  const requiredIdleMs = getWarmupPhaseRequiredIdleMs(options.phase, options.flags)
  const effectiveIdleAgeMs = Math.min(options.scopedIdleAgeMs, options.globalIdleAgeMs)
  const normalizedIdleAgeMs = Math.max(0, Math.round(effectiveIdleAgeMs))
  const idleEligible = isWarmupPhaseIdleEligible({
    phase: options.phase,
    scopedIdleAgeMs: options.scopedIdleAgeMs,
    globalIdleAgeMs: options.globalIdleAgeMs,
    flags: options.flags,
  })
  return {
    idleEligible,
    idleAgeMs: normalizedIdleAgeMs,
    requiredIdleMs,
    nextEligibleAt: idleEligible ? undefined : options.now + Math.max(0, requiredIdleMs - normalizedIdleAgeMs),
  }
}
