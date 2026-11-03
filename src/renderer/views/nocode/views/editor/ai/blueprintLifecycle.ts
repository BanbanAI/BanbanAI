import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppliedDraftBlueprintState,
  NocodeEditorAiAppliedSavedBlueprintState,
  NocodeEditorAiBlueprintApplyResult,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiStagedAppBlueprint,
  NocodeEditorAiStagedBlueprintState,
} from './types'
import type { NocodeEditorPlanningScope } from '@common/utils/nocodeEditorPlanningScope'

const canonicalizeBlueprintValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => canonicalizeBlueprintValue(item))
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalizeBlueprintValue((value as Record<string, unknown>)[key])
      return result
    }, {})
}

/** Confirmation metadata is lifecycle state, so it must not create a new blueprint version. */
export const buildBlueprintConfigurationFingerprint = (blueprint: unknown) => {
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    return ''
  }

  const value = blueprint as Record<string, unknown>
  return JSON.stringify(canonicalizeBlueprintValue({
    title: value.title,
    summary: value.summary,
    forms: value.forms,
  }))
}

export const hasBlueprintConfigurationChanged = (previous: unknown, next: unknown) => (
  buildBlueprintConfigurationFingerprint(previous) !== buildBlueprintConfigurationFingerprint(next)
)

export const buildFlowBlueprintConfigurationFingerprint = (blueprint: unknown) => {
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    return ''
  }

  const value = blueprint as Record<string, unknown>
  // Keep lifecycle metadata out of the version identity. The flow blueprint
  // type currently contains only these business configuration fields, but the
  // explicit projection also protects this fingerprint if confirmation or
  // staging metadata is attached at runtime.
  return JSON.stringify(canonicalizeBlueprintValue({
    title: value.title,
    summary: value.summary,
    target: value.target,
    triggerBranches: value.triggerBranches,
  }))
}

export const hasFlowBlueprintConfigurationChanged = (previous: unknown, next: unknown) => (
  buildFlowBlueprintConfigurationFingerprint(previous)
  !== buildFlowBlueprintConfigurationFingerprint(next)
)

export const hasFlowBlueprintSourceRevisionContentConflict = (input: {
  previousBlueprint: unknown
  previousSourceSchemeRevision?: number
  nextBlueprint: unknown
  nextSourceSchemeRevision?: number
}) => Boolean(
  Number(input.previousSourceSchemeRevision) > 0
  && Number(input.previousSourceSchemeRevision) === Number(input.nextSourceSchemeRevision)
  && hasFlowBlueprintConfigurationChanged(input.previousBlueprint, input.nextBlueprint),
)

export const createStagedBlueprintState = (input: {
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint | null
  sourcePlanningContextKey?: string | null
}): NocodeEditorAiStagedBlueprintState => ({
  phase: 'staged',
  planningScope: input.planningScope,
  revision: input.revision,
  stagedAt: input.stagedAt,
  blueprint: input.blueprint,
  applyResult: null,
  draftPersistenceState: null,
  sourcePlanningContextKey: input.sourcePlanningContextKey || null,
})

export const createAppliedDraftBlueprintState = (input: {
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint | null
  applyResult: NocodeEditorAiBlueprintApplyResult
  draftPersistenceState: NocodeEditorAiDraftPersistenceState
  sourcePlanningContextKey?: string | null
}): NocodeEditorAiAppliedDraftBlueprintState => ({
  phase: 'applied_draft',
  planningScope: input.planningScope,
  revision: input.revision,
  stagedAt: input.stagedAt,
  blueprint: input.blueprint,
  applyResult: input.applyResult,
  draftPersistenceState: input.draftPersistenceState,
  sourcePlanningContextKey: input.sourcePlanningContextKey || null,
})

export const createAppliedSavedBlueprintState = (input: {
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint | null
  applyResult: NocodeEditorAiBlueprintApplyResult
  sourcePlanningContextKey?: string | null
}): NocodeEditorAiAppliedSavedBlueprintState => ({
  phase: 'applied_saved',
  planningScope: input.planningScope,
  revision: input.revision,
  stagedAt: input.stagedAt,
  blueprint: input.blueprint,
  applyResult: input.applyResult,
  draftPersistenceState: null,
  sourcePlanningContextKey: input.sourcePlanningContextKey || null,
})

export const isStagedBlueprintState = (
  value: NocodeEditorAiStagedAppBlueprint | null | undefined,
): value is NocodeEditorAiStagedBlueprintState => value?.phase === 'staged'

export const isAppliedDraftBlueprintState = (
  value: NocodeEditorAiStagedAppBlueprint | null | undefined,
): value is NocodeEditorAiAppliedDraftBlueprintState => value?.phase === 'applied_draft'

export const isAppliedSavedBlueprintState = (
  value: NocodeEditorAiStagedAppBlueprint | null | undefined,
): value is NocodeEditorAiAppliedSavedBlueprintState => value?.phase === 'applied_saved'
