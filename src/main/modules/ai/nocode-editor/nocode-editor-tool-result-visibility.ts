import type { AiActionResult } from '../ai.types'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'

export type NocodeEditorToolResultVisibilityMetadata = {
  suppressPersistedSummary?: boolean
  suppressSummaryContent?: boolean
  suppressStreamBlocks?: boolean
  suppressedIntermediateSummary?: boolean
  summarySuppressionReason?: 'transient_failed_app_plan_followed_by_success'
}

const toArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
)

const normalizeQuestions = (value: unknown) => (
  toArray(value)
    .map(item => String(item || '').trim())
    .filter(Boolean)
)

const hasPendingConfirmationQuestion = (value: unknown) => (
  toArray(value).some(item => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && (item as Record<string, unknown>).confirmed !== true
  ))
)

export const isCompletedNocodeEditorFormPlanResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_single_form_plan' || !result?.ok) {
    return false
  }

  const outline = normalizeNocodeEditorPlanningOutline(result?.output?.outline, {
    confirmationStage: 'form-plan',
  })
  const confirmation = outline?.confirmation
  const confirmationStatus = String(confirmation?.status || '').trim()
  if (confirmationStatus) {
    return confirmationStatus === 'completed'
      && !hasPendingConfirmationQuestion(confirmation?.questions)
  }
  if (hasPendingConfirmationQuestion(confirmation?.questions)) {
    return false
  }
  return normalizeQuestions(outline?.openQuestions).length === 0
}

export const isReadyNocodeEditorBlueprintResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_blueprint' || !result?.ok) {
    return false
  }

  const blueprint = result?.output?.blueprint
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    return false
  }

  return normalizeQuestions(blueprint?.openQuestions).length === 0
    && normalizeQuestions(result?.metadata?.planningConvergenceLateQuestions).length === 0
}

export const isCompletedNocodeEditorAppPlanResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_plan' || !result?.ok) {
    return false
  }

  const plan = result?.output?.plan
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return false
  }

  const planRecord = plan as Record<string, unknown>
  const outline = planRecord.outline && typeof planRecord.outline === 'object' && !Array.isArray(planRecord.outline)
    ? planRecord.outline as Record<string, unknown>
    : null
  const confirmations = [
    planRecord.confirmation,
    outline?.confirmation,
  ].filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
  for (const confirmationRecord of confirmations) {
    const confirmationStatus = String(confirmationRecord.status || '').trim()
    if (
      (confirmationStatus && confirmationStatus !== 'completed')
      || hasPendingConfirmationQuestion(confirmationRecord.questions)
    ) {
      return false
    }
  }

  return normalizeQuestions(planRecord.openQuestions).length === 0
}

export const isSuccessfulNocodeEditorBlueprintStageResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_blueprint' || !result?.ok) {
    return false
  }

  const blueprint = result?.output?.blueprint
  return Boolean(blueprint && typeof blueprint === 'object' && !Array.isArray(blueprint))
}

const isFailedNocodeEditorAppPlanResult = (result: AiActionResult) => (
  String(result?.name || '').trim() === 'editor_stage_app_plan'
  && !result?.ok
)

const isSuccessfulNocodeEditorAppPlanResult = (result: AiActionResult) => (
  String(result?.name || '').trim() === 'editor_stage_app_plan'
  && Boolean(result?.ok)
)

export const resolveNocodeEditorToolResultVisibilityMetadata = (
  results: AiActionResult[],
): Record<string, NocodeEditorToolResultVisibilityMetadata> => {
  const normalizedResults = results || []
  const metadataByCallId: Record<string, NocodeEditorToolResultVisibilityMetadata> = {}

  for (let index = 0; index < normalizedResults.length; index += 1) {
    const result = normalizedResults[index]
    if (!result?.callId || !isFailedNocodeEditorAppPlanResult(result)) {
      continue
    }

    const hasLaterSuccessfulAppPlan = normalizedResults
      .slice(index + 1)
      .some(isSuccessfulNocodeEditorAppPlanResult)

    if (!hasLaterSuccessfulAppPlan) {
      continue
    }

    metadataByCallId[result.callId] = {
      suppressPersistedSummary: true,
      suppressSummaryContent: true,
      suppressStreamBlocks: true,
      suppressedIntermediateSummary: true,
      summarySuppressionReason: 'transient_failed_app_plan_followed_by_success',
    }
  }

  return metadataByCallId
}

export const applyNocodeEditorToolResultVisibilityMetadata = (
  results: AiActionResult[],
) => {
  const metadataByCallId = resolveNocodeEditorToolResultVisibilityMetadata(results)
  return (results || []).map((result) => {
    const visibilityMetadata = metadataByCallId[result?.callId]
    if (!visibilityMetadata) {
      return result
    }
    result.metadata = {
      ...(result.metadata || {}),
      ...visibilityMetadata,
    }
    return result
  })
}
