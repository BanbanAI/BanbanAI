import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'

const normalizeQuestionList = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => String(item || '').trim())
      .filter(Boolean)
    : []
)

const normalizeConfirmationQuestionList = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }
        if (item && typeof item === 'object') {
          return String((item as Record<string, unknown>).title || '').trim()
        }
        return ''
      })
      .filter(Boolean)
    : []
)

type PlanningConvergenceResultLike = {
  ok?: boolean
  name?: string
  output?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

type PendingPlanningResultKind = 'app-plan' | 'form-plan'

type PendingPlanningResultRecord = {
  result: PlanningConvergenceResultLike
  kind: PendingPlanningResultKind
}

export const resolvePlanningScopeToolGuard = (input: {
  planningScope?: unknown
  toolName?: unknown
}) => {
  const planningScope = String(input.planningScope || '').trim()
  const toolName = String(input.toolName || '').trim()
  const blocked = planningScope === 'form' && toolName === 'editor_stage_app_plan'
  return {
    blocked,
    planningScope,
    toolName,
  }
}

const normalizeTaskSummary = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
)

const normalizeObject = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const getNormalizedFormPlanOutline = (value: unknown) => (
  normalizeNocodeEditorPlanningOutline(value, {
    confirmationStage: 'form-plan',
  })
)

export const resolvePlanningConvergenceTaskSummary = (input: {
  currentConversationTaskSummary?: unknown
  latestAppConversationTaskSummary?: unknown
  latestTaskSummary?: unknown
}) => {
  const currentConversationTaskSummary = normalizeTaskSummary(input.currentConversationTaskSummary)
  if (currentConversationTaskSummary) {
    return {
      taskSummary: currentConversationTaskSummary,
      source: 'current-conversation' as const,
    }
  }

  const latestAppConversationTaskSummary = normalizeTaskSummary(input.latestAppConversationTaskSummary)
  if (latestAppConversationTaskSummary) {
    return {
      taskSummary: latestAppConversationTaskSummary,
      source: 'latest-app-conversation' as const,
    }
  }

  const latestTaskSummary = normalizeTaskSummary(input.latestTaskSummary)
  if (latestTaskSummary) {
    return {
      taskSummary: latestTaskSummary,
      source: 'latest-task-summary' as const,
    }
  }

  return {
    taskSummary: null,
    source: 'unavailable' as const,
  }
}

export const getLatestPlanningConvergenceLateQuestions = (results: PlanningConvergenceResultLike[]) => {
  for (let index = (results || []).length - 1; index >= 0; index -= 1) {
    const questions = normalizeQuestionList(results[index]?.metadata?.planningConvergenceLateQuestions)
    if (questions.length > 0) {
      return questions
    }
  }

  return []
}

export const getLatestPendingAppPlanResult = (results: PlanningConvergenceResultLike[]) => {
  for (let index = (results || []).length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_stage_app_plan') {
      continue
    }

    const plan = result.output?.plan
    const normalizedPlan = plan && typeof plan === 'object' && !Array.isArray(plan)
      ? plan as Record<string, unknown>
      : null
    const openQuestions = normalizeQuestionList(normalizedPlan?.openQuestions)
    const confirmation = normalizedPlan && normalizedPlan.outline && typeof normalizedPlan.outline === 'object' && !Array.isArray(normalizedPlan.outline)
      ? (normalizedPlan.outline as Record<string, unknown>).confirmation as Record<string, unknown> | null | undefined
      : null
    const confirmationStatus = String(confirmation?.status || '').trim()
    const confirmationQuestions = normalizeConfirmationQuestionList(confirmation?.questions)

    if (
      openQuestions.length > 0
      || (confirmationStatus && confirmationStatus !== 'completed')
      || (confirmationQuestions.length > 0 && confirmationStatus !== 'completed')
    ) {
      return result
    }

    return null
  }

  return null
}

export const getLatestPendingFormPlanResult = (results: PlanningConvergenceResultLike[]) => {
  for (let index = (results || []).length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_stage_single_form_plan') {
      continue
    }

    const normalizedOutline = getNormalizedFormPlanOutline(result.output?.outline)
    const openQuestions = normalizeQuestionList(normalizedOutline?.openQuestions)
    const confirmation = normalizedOutline?.confirmation as Record<string, unknown> | null | undefined
    const confirmationStatus = String(confirmation?.status || '').trim()
    const confirmationQuestions = normalizeConfirmationQuestionList(confirmation?.questions)

    if (
      openQuestions.length > 0
      || (confirmationStatus && confirmationStatus !== 'completed')
      || (confirmationQuestions.length > 0 && confirmationStatus !== 'completed')
    ) {
      return result
    }

    return null
  }

  return null
}

export const getLatestPendingPlanningResult = (
  results: PlanningConvergenceResultLike[],
): PendingPlanningResultRecord | null => {
  const pendingFormPlan = getLatestPendingFormPlanResult(results)
  if (pendingFormPlan) {
    return { result: pendingFormPlan, kind: 'form-plan' }
  }

  const pendingAppPlan = getLatestPendingAppPlanResult(results)
  if (pendingAppPlan) {
    return { result: pendingAppPlan, kind: 'app-plan' }
  }

  return null
}

export const getLatestCompletedPlanningResult = (
  results: PlanningConvergenceResultLike[],
): PendingPlanningResultRecord | null => {
  for (let index = (results || []).length - 1; index >= 0; index -= 1) {
    const result = results[index]
    const name = String(result?.name || '').trim()
    if (!result?.ok || (name !== 'editor_stage_single_form_plan' && name !== 'editor_stage_app_plan')) {
      continue
    }

    const pending = name === 'editor_stage_single_form_plan'
      ? getLatestPendingFormPlanResult([result])
      : getLatestPendingAppPlanResult([result])
    if (pending) {
      return null
    }

    return {
      result,
      kind: name === 'editor_stage_single_form_plan' ? 'form-plan' : 'app-plan',
    }
  }

  return null
}

export const shouldStopAfterPendingAppPlanRound = (input: {
  results: PlanningConvergenceResultLike[]
}) => Boolean(getLatestPendingAppPlanResult(input.results))

export const shouldStopAfterCompletedPlanningRound = (input: {
  results: PlanningConvergenceResultLike[]
  autoContinueWithoutConfirmation?: unknown
}) => {
  if (input.autoContinueWithoutConfirmation === true) {
    return false
  }

  const completedPlanning = getLatestCompletedPlanningResult(input.results)
  return completedPlanning?.kind === 'app-plan'
}

export const detectLateBlueprintOpenQuestions = (input: {
  formPlanOpenQuestions?: unknown
  blueprintOpenQuestions?: unknown
}) => {
  const planQuestions = normalizeQuestionList(input.formPlanOpenQuestions)
  const blueprintQuestions = normalizeQuestionList(input.blueprintOpenQuestions)
  const planQuestionSet = new Set(planQuestions)
  const lateQuestions = blueprintQuestions.filter(question => !planQuestionSet.has(question))

  return {
    planQuestions,
    blueprintQuestions,
    lateQuestions,
    shouldFallBackToPlanning: lateQuestions.length > 0,
  }
}

export const detectBlueprintPlanningConvergence = (input: {
  hasSameRoundFormPlan?: boolean
  sameRoundFormPlanOpenQuestions?: unknown
  currentConversationTaskSummary?: unknown
  latestAppConversationTaskSummary?: unknown
  latestTaskSummary?: unknown
  blueprintOpenQuestions?: unknown
}) => {
  const resolvedTaskSummary = resolvePlanningConvergenceTaskSummary({
    currentConversationTaskSummary: input.currentConversationTaskSummary,
    latestAppConversationTaskSummary: input.latestAppConversationTaskSummary,
    latestTaskSummary: input.latestTaskSummary,
  })
  const latestTaskSummary = resolvedTaskSummary.taskSummary
  const sameRoundPlanQuestions = normalizeQuestionList(input.sameRoundFormPlanOpenQuestions)
  const crossRoundPlanQuestions = normalizeQuestionList(latestTaskSummary?.planningOpenQuestions)
  const blueprintQuestions = normalizeQuestionList(input.blueprintOpenQuestions)

  if (input.hasSameRoundFormPlan) {
    const decision = detectLateBlueprintOpenQuestions({
      formPlanOpenQuestions: sameRoundPlanQuestions,
      blueprintOpenQuestions: blueprintQuestions,
    })

    return {
      comparisonSource: 'same-round' as const,
      taskSummarySource: 'same-round' as const,
      planQuestions: decision.planQuestions,
      blueprintQuestions: decision.blueprintQuestions,
      lateQuestions: decision.lateQuestions,
      shouldFallBackToPlanning: decision.shouldFallBackToPlanning,
    }
  }

  if (String(latestTaskSummary?.planningMode || '').trim() === 'single-form') {
    const decision = detectLateBlueprintOpenQuestions({
      formPlanOpenQuestions: crossRoundPlanQuestions,
      blueprintOpenQuestions: blueprintQuestions,
    })

    return {
      comparisonSource: 'cross-round' as const,
      taskSummarySource: resolvedTaskSummary.source,
      planQuestions: decision.planQuestions,
      blueprintQuestions: decision.blueprintQuestions,
      lateQuestions: decision.lateQuestions,
      shouldFallBackToPlanning: decision.shouldFallBackToPlanning,
    }
  }

  return {
    comparisonSource: 'unavailable' as const,
    taskSummarySource: resolvedTaskSummary.source,
    planQuestions: [],
    blueprintQuestions,
    lateQuestions: [],
    shouldFallBackToPlanning: false,
  }
}

export const markPlanningConvergenceLateQuestionsOnRoundResults = (input: {
  results: PlanningConvergenceResultLike[]
  currentConversationTaskSummary?: unknown
  latestAppConversationTaskSummary?: unknown
  latestTaskSummary?: unknown
}) => {
  if (!Array.isArray(input.results) || !input.results.length) {
    return {
      lateQuestions: [],
      shouldFallBackToPlanning: false,
    }
  }

  const stagedPlanResult = input.results.find(result => (
    result?.ok
    && String(result?.name || '').trim() === 'editor_stage_single_form_plan'
  ))
  const stagedBlueprintResult = input.results.find(result => (
    result?.ok
    && String(result?.name || '').trim() === 'editor_stage_app_blueprint'
  ))

  if (!stagedBlueprintResult) {
    return {
      lateQuestions: [],
      shouldFallBackToPlanning: false,
    }
  }

  const decision = detectBlueprintPlanningConvergence({
    hasSameRoundFormPlan: Boolean(stagedPlanResult),
    sameRoundFormPlanOpenQuestions: getNormalizedFormPlanOutline(
      normalizeObject(normalizeObject(stagedPlanResult?.output).outline),
    )?.openQuestions,
    currentConversationTaskSummary: input.currentConversationTaskSummary,
    latestAppConversationTaskSummary: input.latestAppConversationTaskSummary,
    latestTaskSummary: input.latestTaskSummary,
    blueprintOpenQuestions: normalizeObject(normalizeObject(stagedBlueprintResult?.output).blueprint).openQuestions,
  })

  if (!decision.shouldFallBackToPlanning) {
    return decision
  }

  stagedBlueprintResult.metadata = {
    ...(stagedBlueprintResult.metadata || {}),
    planningConvergenceLateQuestions: decision.lateQuestions,
  }

  return decision
}

export const shouldStopAfterPlanningConvergenceRound = (input: {
  results: PlanningConvergenceResultLike[]
  currentConversationTaskSummary?: unknown
  latestAppConversationTaskSummary?: unknown
  latestTaskSummary?: unknown
}) => {
  if (!Array.isArray(input.results) || !input.results.length) {
    return false
  }

  const stagedPlanResult = input.results.find(result => (
    result?.ok
    && String(result?.name || '').trim() === 'editor_stage_single_form_plan'
  ))
  const stagedBlueprintResult = input.results.find(result => (
    result?.ok
    && String(result?.name || '').trim() === 'editor_stage_app_blueprint'
  ))
  if (!stagedPlanResult && !stagedBlueprintResult) {
    return false
  }

  if (getLatestPlanningConvergenceLateQuestions(stagedBlueprintResult ? [stagedBlueprintResult] : []).length > 0) {
    return true
  }

  const convergenceDecision = detectBlueprintPlanningConvergence({
    hasSameRoundFormPlan: Boolean(stagedPlanResult),
    sameRoundFormPlanOpenQuestions: getNormalizedFormPlanOutline(
      normalizeObject(normalizeObject(stagedPlanResult?.output).outline),
    )?.openQuestions,
    currentConversationTaskSummary: input.currentConversationTaskSummary,
    latestAppConversationTaskSummary: input.latestAppConversationTaskSummary,
    latestTaskSummary: input.latestTaskSummary,
    blueprintOpenQuestions: normalizeObject(normalizeObject(stagedBlueprintResult?.output).blueprint).openQuestions,
  })

  if (convergenceDecision.shouldFallBackToPlanning) {
    return true
  }

  return Boolean(stagedPlanResult) && convergenceDecision.planQuestions.length > 0
}

export const shouldBlockBlueprintApplyForPlanningConvergence = (results: PlanningConvergenceResultLike[]) => (
  getLatestPlanningConvergenceLateQuestions(results).length > 0
)
