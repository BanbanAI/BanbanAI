import type { AiAssistantConfirmationCardPresentation } from '@common/types/ai'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmSurface,
} from '@common/types/nocodeEditorConfirmation'
import {
  buildNocodeEditorSingleFormPlanPromptSummary,
  resolveNocodeEditorSingleFormPlanSummary,
  type NocodeEditorSingleFormPlanOutlineLike,
  type NocodeEditorSingleFormPlanPresentationLike,
  type NocodeEditorSingleFormPlanSummaryResult,
} from '@common/utils/nocodeEditorSingleFormPlan'
import {
  buildSharedFormPlanConfirmationCardPresentation,
} from '@common/utils/nocodeEditorConfirmationCardPresentation'
import {
  getNocodeEditorPendingContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'

type NocodeEditorFormPlanInput = {
  outline?: (NocodeEditorSingleFormPlanOutlineLike & {
    confirmation?: unknown
  }) | null
  solutionPresentation?: NocodeEditorSingleFormPlanPresentationLike | null
}

const isSummaryResult = (
  value: unknown,
): value is NocodeEditorSingleFormPlanSummaryResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return (
    'eligible' in value
    && 'formName' in value
    && 'goalText' in value
    && 'contentText' in value
    && 'scopeText' in value
    && 'openQuestions' in value
  )
}

const resolveSummary = (
  input: NocodeEditorFormPlanInput | NocodeEditorSingleFormPlanSummaryResult,
) => (
  isSummaryResult(input)
    ? input
    : resolveNocodeEditorSingleFormPlanSummary(input)
)

export const buildNocodeEditorFormPlanLeadText = (
  input: NocodeEditorFormPlanInput | NocodeEditorSingleFormPlanSummaryResult,
) => {
  const summary = resolveSummary(input)
  if (!summary.eligible) {
    return ''
  }

  if (summary.openQuestions.length) {
    const directContinueHintText = summary.directContinueHintText
      || global.i18next.t('nocodeEditorFormPlan.directContinueHint', {
        label: getNocodeEditorPendingContinueLabel(),
      })
    const directContinueRiskText = summary.directContinueRiskText
      || global.i18next.t('nocodeEditorFormPlan.directContinueRisk', {
        label: getNocodeEditorPendingContinueLabel(),
      })

    return [
      global.i18next.t('nocodeEditorFormPlan.pendingPlanLead', { formName: summary.formName }),
      global.i18next.t('nocodeEditorFormPlan.pendingPlanOverview', { hint: directContinueHintText }),
      directContinueRiskText,
    ].join('')
  }

  return global.i18next.t('nocodeEditorFormPlan.readyPlanLead', { formName: summary.formName })
}

export const buildNocodeEditorFormPlanConfirmation = (
  input: NocodeEditorFormPlanInput | NocodeEditorSingleFormPlanSummaryResult,
  preferredSurface?: NocodeEditorAiConfirmSurface,
): NocodeEditorAiConfirmPayload | null => {
  const summary = resolveSummary(input)
  if (!summary.eligible) {
    return null
  }

  const outline = isSummaryResult(input)
    ? null
    : input.outline

  return resolveNocodeEditorPlanningQuestionProjection({
    stage: 'form-plan',
    structuredConfirmation: outline?.confirmation,
    legacyOpenQuestions: summary.openQuestions,
    legacyOpenQuestionsMode: 'fallback-only',
    preferredSurface,
    summary: summary.goalText || summary.contentText,
  }).confirmation
}

export const buildNocodeEditorFormPlanConfirmationCardPresentation = (
  input: NocodeEditorFormPlanInput | NocodeEditorSingleFormPlanSummaryResult,
): AiAssistantConfirmationCardPresentation | null => {
  if (isSummaryResult(input) || !input.outline) {
    return buildSharedFormPlanConfirmationCardPresentation(input)
  }

  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'form-plan',
    structuredConfirmation: input.outline.confirmation,
    legacyOpenQuestions: input.outline.openQuestions,
    legacyOpenQuestionsMode: 'fallback-only',
    summary: input.outline.summary,
  })
  return buildSharedFormPlanConfirmationCardPresentation({
    ...input,
    outline: {
      ...input.outline,
      confirmation: projection.confirmation,
      openQuestions: projection.openQuestions,
    },
  })
}

export {
  buildNocodeEditorSingleFormPlanPromptSummary,
  resolveNocodeEditorSingleFormPlanSummary,
}
