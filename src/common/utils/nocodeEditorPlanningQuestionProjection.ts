import type {
  NocodeEditorAiConfirmSurface,
  NocodeEditorPlanningQuestionStage,
} from '../types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from './nocodeEditorConfirmationNormalization'
import {
  projectPendingPlanningQuestionTitles,
  type ReconciledPlanningConfirmation,
} from './nocodeEditorPlanningQuestionContract'

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => String(item ?? '').trim()).filter(Boolean)
    : []
)

export type NocodeEditorLegacyOpenQuestionsMode = 'reconcile' | 'fallback-only'

export const resolveNocodeEditorPlanningQuestionProjection = (input: {
  stage: NocodeEditorPlanningQuestionStage
  structuredConfirmation?: unknown
  legacyConfirmation?: unknown
  legacyOpenQuestions?: unknown
  legacyOpenQuestionsMode?: NocodeEditorLegacyOpenQuestionsMode
  openQuestions?: unknown
  preferredSurface?: NocodeEditorAiConfirmSurface
  summary?: unknown
}): ReconciledPlanningConfirmation => {
  const normalizeCandidate = (confirmation: unknown) => {
    const normalized = normalizeNocodeEditorConfirmationPayload({
      stage: input.stage,
      confirmation,
      openQuestions: [],
      preferredSurface: input.preferredSurface,
      summary: input.summary,
      planningQuestionContract: true,
    })
    return normalized
      ? { ...normalized, stage: input.stage }
      : null
  }
  const structuredConfirmation = normalizeCandidate(input.structuredConfirmation)
  const legacyConfirmation = structuredConfirmation
    ? null
    : normalizeCandidate(input.legacyConfirmation)
  const legacyOpenQuestions = [
    ...normalizeStringList(input.legacyOpenQuestions),
    ...normalizeStringList(input.openQuestions),
  ]
  const legacyOpenQuestionsMode = input.legacyOpenQuestionsMode === 'fallback-only'
    ? 'fallback-only'
    : 'reconcile'
  const normalizedConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: input.stage,
    confirmation: structuredConfirmation || legacyConfirmation,
    openQuestions: legacyOpenQuestionsMode === 'fallback-only' && structuredConfirmation
      ? []
      : legacyOpenQuestions,
    preferredSurface: input.preferredSurface,
    summary: input.summary,
    planningQuestionContract: true,
  })
  const confirmation = normalizedConfirmation
    ? { ...normalizedConfirmation, stage: input.stage }
    : null

  return {
    confirmation,
    openQuestions: projectPendingPlanningQuestionTitles(
      confirmation?.questions || [],
      confirmation?.status,
    ),
  }
}
