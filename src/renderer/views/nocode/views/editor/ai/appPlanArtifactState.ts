export type AppPlanArtifactLike = {
  kind?: unknown
  status?: unknown
  revision?: unknown
  stagedAt?: unknown
  appPlan?: unknown
}

export type StagedAppPlanLike = {
  revision?: unknown
  stagedAt?: unknown
  plan?: unknown
}

const normalizePositiveNumber = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

export const doesAppPlanArtifactMatchStagedState = (
  block: AppPlanArtifactLike | null | undefined,
  stagedAppPlan: StagedAppPlanLike | null | undefined,
) => {
  const blockRevision = normalizePositiveNumber(block?.revision)
  const stagedRevision = normalizePositiveNumber(stagedAppPlan?.revision)
  const blockStagedAt = normalizePositiveNumber(block?.stagedAt)
  const stagedAt = normalizePositiveNumber(stagedAppPlan?.stagedAt)

  return Boolean(
    block
    && String(block.kind || '').trim() === 'app-plan'
    && String(block.status || '').trim() === 'ready'
    && block.appPlan
    && stagedAppPlan?.plan
    && blockRevision > 0
    && stagedRevision > 0
    && blockStagedAt > 0
    && stagedAt > 0
    && blockRevision === stagedRevision
    && blockStagedAt === stagedAt,
  )
}

export type AppPlanArtifactSyncDecision = {
  shouldSync: boolean
  reason: 'current_app_plan_artifact' | 'stale_app_plan_artifact'
}

export const resolveAppPlanArtifactSyncDecision = (
  block: AppPlanArtifactLike | null | undefined,
  stagedAppPlan: StagedAppPlanLike | null | undefined,
): AppPlanArtifactSyncDecision => {
  if (doesAppPlanArtifactMatchStagedState(block, stagedAppPlan)) {
    return {
      shouldSync: true,
      reason: 'current_app_plan_artifact',
    }
  }

  return {
    shouldSync: false,
    reason: 'stale_app_plan_artifact',
  }
}
