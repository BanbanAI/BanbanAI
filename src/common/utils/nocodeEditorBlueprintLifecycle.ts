export const BLUEPRINT_PHASES = [
  'staged',
  'applied_draft',
  'applied_saved',
] as const

export type NocodeEditorAiBlueprintPhase = typeof BLUEPRINT_PHASES[number]

export type NocodeEditorAiBlueprintAppliedPhase = Exclude<NocodeEditorAiBlueprintPhase, 'staged'>

export const isBlueprintStagedPhase = (phase?: unknown): phase is 'staged' => (
  phase === 'staged'
)

export const isBlueprintAppliedDraftPhase = (phase?: unknown): phase is 'applied_draft' => (
  phase === 'applied_draft'
)

export const isBlueprintAppliedSavedPhase = (phase?: unknown): phase is 'applied_saved' => (
  phase === 'applied_saved'
)

export const isBlueprintAppliedPhase = (phase?: unknown): phase is NocodeEditorAiBlueprintAppliedPhase => (
  phase === 'applied_draft' || phase === 'applied_saved'
)

export const normalizeBlueprintPhase = (phase?: unknown): NocodeEditorAiBlueprintPhase => (
  isBlueprintAppliedPhase(phase) ? phase : 'staged'
)

export const normalizeAppliedBlueprintPhase = (
  phase?: unknown,
): NocodeEditorAiBlueprintAppliedPhase | null => (
  isBlueprintAppliedPhase(phase) ? phase : null
)

const BLUEPRINT_PHASE_ORDER: Record<NocodeEditorAiBlueprintPhase, number> = {
  staged: 1,
  applied_draft: 2,
  applied_saved: 3,
}

export const compareBlueprintPhase = (
  left?: unknown,
  right?: unknown,
) => BLUEPRINT_PHASE_ORDER[normalizeBlueprintPhase(left)] - BLUEPRINT_PHASE_ORDER[normalizeBlueprintPhase(right)]

export const resolveBlueprintStatusTagFromPhase = (phase?: unknown) => {
  if (isBlueprintAppliedDraftPhase(phase)) {
    return 'draft'
  }
  if (isBlueprintAppliedSavedPhase(phase)) {
    return 'applied'
  }
  return 'pending'
}

export const resolveBlueprintDraftPersistenceState = <T extends {
  phase?: unknown
  draftPersistenceState?: unknown
} | null | undefined>(value: T) => (
  isBlueprintAppliedDraftPhase(value?.phase)
    ? value?.draftPersistenceState || null
    : null
)

export const resolveBlueprintVersionKeyFromPhase = (input: {
  revision?: unknown
  stagedAt?: unknown
  phase?: unknown
  applyResult?: { finishedAt?: unknown } | null
}) => {
  const revision = Number(input.revision || 0)
  const stagedAt = Number(input.stagedAt || 0)
  const phase = normalizeBlueprintPhase(input.phase)
  const finishedAt = Number(input.applyResult?.finishedAt || 0)
  return `${revision}:${stagedAt}:${phase}:${finishedAt}`
}
