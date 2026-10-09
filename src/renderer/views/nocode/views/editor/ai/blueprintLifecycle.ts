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
