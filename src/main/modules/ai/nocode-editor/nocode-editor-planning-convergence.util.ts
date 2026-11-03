import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  isDefaultContinueReplyMessage,
} from '@common/utils/nocodeEditorPlanningConfirmationReply'
import {
  isNocodeEditorStructuredConfirmationReplyMessage,
} from '@common/utils/nocodeEditorTaskContextRequest'
import {
  isExplicitNocodeEditorPlanningRestartText,
  isExplicitNocodeEditorPlanningContinuationText,
} from '@common/utils/nocodeEditorPlanningContinuationIntent'

const normalizeQuestionList = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => String(
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>).title || ''
          : item || '',
      ).trim())
      .filter(Boolean)
    : []
)

const normalizeQuestionIdentity = (value: unknown) => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s"'`“”‘’：:，,。！？!？；;（）()【】[\]{}\-_/\\]/g, '')

const resolveQuestionIdentity = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const question = value as Record<string, unknown>
    const decisionKey = String(question.decisionKey || '').trim()
    if (decisionKey) {
      return `decision:${normalizeQuestionIdentity(decisionKey)}`
    }
    const id = String(question.id || '').trim()
    if (id) {
      return `id:${normalizeQuestionIdentity(id)}`
    }
    const fieldKey = String(question.fieldKey || question.field || '').trim()
    const kind = String(question.questionKind || question.kind || '').trim()
    if (fieldKey || kind) {
      return `field:${normalizeQuestionIdentity(fieldKey)}:${normalizeQuestionIdentity(kind)}`
    }
    return `title:${normalizeQuestionIdentity(question.title)}`
  }
  return `title:${normalizeQuestionIdentity(value)}`
}

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

const isPlanningConfirmationReplyText = (value: unknown) => (
  isNocodeEditorStructuredConfirmationReplyMessage(value)
  || isDefaultContinueReplyMessage(String(value || '').trim())
  || isExplicitNocodeEditorPlanningContinuationText(value)
)

/**
 * 读出模型打算暂存的表单名：`outline.forms[]` 是协议要求的位置，顶层 `forms` 兼容
 * 模型直接给数组的写法。缺失时返回空集合，交给工具自身校验兜底。
 */
const readProposedFormNames = (toolInput: unknown) => {
  const input = toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)
    ? toolInput as Record<string, unknown>
    : {}
  const outline = input.outline && typeof input.outline === 'object' && !Array.isArray(input.outline)
    ? input.outline as Record<string, unknown>
    : {}
  const forms = Array.isArray(outline.forms)
    ? outline.forms
    : Array.isArray(input.forms) ? input.forms : []
  return new Set(forms
    .filter(form => form && typeof form === 'object' && !Array.isArray(form))
    .map(form => normalizeQuestionIdentity((form as Record<string, unknown>).tableName))
    .filter(Boolean))
}

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

type PlanningContinuationGuardTaskSummary = {
  planningConfirmationStatus?: unknown
  planningConfirmationContextKey?: unknown
  planningMode?: unknown
}

export const resolvePlanningContinuationToolGuard = (input: {
  toolName?: unknown
  userMessage?: unknown
  confirmationStage?: unknown
  planningContextKey?: unknown
  taskSummary?: PlanningContinuationGuardTaskSummary | null
}) => {
  const toolName = String(input.toolName || '').trim()
  const taskSummary = input.taskSummary && typeof input.taskSummary === 'object'
    ? input.taskSummary
    : null
  const confirmationStage = String(input.confirmationStage || '').trim()
  const planningContextKey = String(input.planningContextKey || '').trim()
  const summaryContextKey = String(taskSummary?.planningConfirmationContextKey || '').trim()
  const planningMode = String(taskSummary?.planningMode || '').trim()
  const userMessage = String(input.userMessage || '').trim()
  const isPlanningTool = toolName === 'editor_stage_single_form_plan'
    || toolName === 'editor_stage_app_plan'
  const isConfirmationReply = isPlanningConfirmationReplyText(userMessage)
  const isCompletedPlanning = String(taskSummary?.planningConfirmationStatus || '').trim() === 'completed'
  // 规划上下文键由渲染层工件生成，主进程侧摘要未必持久化过；摘要键为空只代表
  // “没有可用于比对的旧身份”，不能据此把已完成规划的续接回合放行成重新规划。
  const hasMatchingContext = Boolean(
    planningContextKey
    && (!summaryContextKey || planningContextKey === summaryContextKey),
  )
  const isExplicitRestart = isExplicitNocodeEditorPlanningRestartText(userMessage)
  const isFormPlanning = confirmationStage === 'form-plan' || planningMode === 'single-form'
  const blocked = Boolean(
    isPlanningTool
    && isConfirmationReply
    && isCompletedPlanning
    && hasMatchingContext
    && !isExplicitRestart,
  )

  return {
    blocked,
    toolName,
    expectedToolName: 'editor_stage_app_blueprint',
    planningKind: isFormPlanning ? 'form-plan' as const : 'app-plan' as const,
    reason: blocked ? 'completed_planning_confirmation_continuation' as const : null,
  }
}

export const resolveBlueprintScopeRecoveryPlanningGuard = (input: {
  toolName?: unknown
  scopeErrorSeen?: unknown
  plannedForms?: unknown
}) => {
  const toolName = String(input.toolName || '').trim()
  const isPlanningTool = toolName === 'editor_stage_single_form_plan'
    || toolName === 'editor_stage_app_plan'
  const scopeErrorSeen = input.scopeErrorSeen === true
  if (!isPlanningTool || !scopeErrorSeen) {
    return {
      blocked: false,
      toolName,
      expectedToolName: 'editor_stage_app_blueprint',
      plannedFormLabels: [] as string[],
      message: '',
    }
  }

  const plannedFormLabels = (Array.isArray(input.plannedForms) ? input.plannedForms : [])
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const record = item as Record<string, unknown>
      const tableName = String(record.tableName || '').trim()
      const formKey = String(record.formKey || '').trim()
      return tableName && formKey ? `${tableName}（formKey=${formKey}）` : tableName || formKey
    })
    .filter(Boolean)
  const plannedHint = plannedFormLabels.length
    ? `当前已规划表单（必须复用同一 formKey 和表名）：${plannedFormLabels.join('；')}。`
    : ''

  return {
    blocked: true,
    toolName,
    expectedToolName: 'editor_stage_app_blueprint',
    plannedFormLabels,
    message: `刚才的蓝图因表单身份与已确认规划不一致被拒绝，不能通过重新规划来迁就蓝图。${plannedHint}请复用已规划身份修正 blueprint.forms，并以 updateMode=replace 重新提交完整蓝图。`,
  }
}

export const resolvePlanningScopeToolGuard = (input: {
  planningScope?: unknown
  toolName?: unknown
  toolInput?: unknown
  planningCompleted?: unknown
  completedFormName?: unknown
  userMessage?: unknown
}) => {
  const planningScope = String(input.planningScope || '').trim()
  const toolName = String(input.toolName || '').trim()
  const planningCompleted = input.planningCompleted === true
  const isExplicitRestart = isExplicitNocodeEditorPlanningRestartText(input.userMessage)
  // 已完成的规划只拦“仍在续接这份规划”的回合：确认答复，或模型仍要暂存同一张已规划表单。
  // 用户提出另一张新表单属于新需求；只按 scope+completed 拒绝会让模型无路可走，
  // 连续重试同一工具后触发同因失败止损，用户看到的却是“请调整内容”。
  const isContinuationReply = isPlanningConfirmationReplyText(input.userMessage)
  const completedFormIdentity = normalizeQuestionIdentity(input.completedFormName)
  const targetsCompletedForm = Boolean(
    completedFormIdentity
    && readProposedFormNames(input.toolInput).has(completedFormIdentity),
  )
  const blockedByCompletedPlan = Boolean(
    planningCompleted
    && toolName === 'editor_stage_single_form_plan'
    && !isExplicitRestart
    && (isContinuationReply || targetsCompletedForm),
  )
  const blocked = planningScope === 'form' && (
    toolName === 'editor_stage_app_plan'
    || blockedByCompletedPlan
  )
  const expectedToolName = planningCompleted
    ? 'editor_stage_app_blueprint'
    : 'editor_stage_single_form_plan'
  const message = planningCompleted
    ? '当前需求的规划范围是单表单（form），且规划确认已经完成。不要重复暂存同一张表单的规划，也不要重新开启应用级规划；请直接调用 editor_stage_app_blueprint，把当前主表和已确认引入的关联表一起写入 blueprint.forms，并用主表字段的 source 指向关联表。内容分组、流程和看板不要拆成额外表单。'
    : '当前需求的规划范围是单表单（form），不能调用 editor_stage_app_plan。请继续用单表单规划工具收口当前表单；如果后续确认引入了独立关联表，再在蓝图阶段把主表和关联表一起写入 blueprint.forms，并用主表字段的 source 建立关系。'
  const code = planningCompleted
    ? 'planning_scope_completed_guard'
    : 'planning_scope_mismatch_guard'
  return {
    blocked,
    code,
    planningScope,
    toolName,
    planningCompleted,
    isExplicitRestart,
    isContinuationReply,
    targetsCompletedForm,
    expectedToolName,
    message,
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

const hasPositiveRevision = (value: unknown) => Number(value || 0) > 0

const hasNamedForm = (value: unknown) => (
  Array.isArray(value)
  && value.some(item => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && String((item as Record<string, unknown>).tableName || '').trim()
  ))
)

const isValidAppPlanOutput = (result: PlanningConvergenceResultLike) => {
  const plan = result.output?.plan
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return false
  }
  const record = plan as Record<string, unknown>
  return hasPositiveRevision(result.output?.revision)
    && Boolean(String(record.goal || '').trim())
    && Array.isArray(record.objects)
    && Array.isArray(record.artifacts)
    && Array.isArray(record.openQuestions)
}

const isValidFormPlanOutput = (result: PlanningConvergenceResultLike) => {
  const outline = getNormalizedFormPlanOutline(result.output?.outline)
  return hasPositiveRevision(result.output?.revision)
    && hasNamedForm(outline?.forms)
}

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
    const rawQuestions = results[index]?.metadata?.planningConvergenceLateQuestions
    const questions = normalizeQuestionList(rawQuestions)
    if (questions.length > 0) {
      // 守卫重发时保留问题对象，避免 decisionTarget 在二次投影中丢失。
      return Array.isArray(rawQuestions) ? rawQuestions : questions
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
    const outline = normalizedPlan && normalizedPlan.outline && typeof normalizedPlan.outline === 'object' && !Array.isArray(normalizedPlan.outline)
      ? normalizedPlan.outline as Record<string, unknown>
      : null
    const confirmations = [normalizedPlan?.confirmation, outline?.confirmation]
      .filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
    const hasPendingConfirmation = confirmations.some(confirmation => {
      const status = String(confirmation.status || '').trim()
      return (status && status !== 'completed')
        || normalizeConfirmationQuestionList(confirmation.questions).length > 0 && status !== 'completed'
    })

    if (
      openQuestions.length > 0
      || hasPendingConfirmation
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

    const hasValidStructure = name === 'editor_stage_single_form_plan'
      ? isValidFormPlanOutput(result)
      : isValidAppPlanOutput(result)
    if (!hasValidStructure) {
      return null
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
  const rawPlanQuestions = Array.isArray(input.formPlanOpenQuestions) ? input.formPlanOpenQuestions : []
  const rawBlueprintQuestions = Array.isArray(input.blueprintOpenQuestions) ? input.blueprintOpenQuestions : []
  const planQuestions = normalizeQuestionList(rawPlanQuestions)
  const blueprintQuestions = normalizeQuestionList(rawBlueprintQuestions)
  const planQuestionSet = new Set(rawPlanQuestions.flatMap(question => [
    resolveQuestionIdentity(question),
    `title:${normalizeQuestionIdentity(
      question && typeof question === 'object' && !Array.isArray(question)
        ? (question as Record<string, unknown>).title
        : question,
    )}`,
  ]))
  const lateQuestions = rawBlueprintQuestions
    .filter(question => !planQuestionSet.has(resolveQuestionIdentity(question))
      && !planQuestionSet.has(`title:${normalizeQuestionIdentity(
        question && typeof question === 'object' && !Array.isArray(question)
          ? (question as Record<string, unknown>).title
          : question,
      )}`))
    // 保留问题对象，后续投影才能把 decisionTarget 带回表单/字段。
    .filter(question => (
      typeof question === 'string'
        ? Boolean(question.trim())
        : Boolean(
          question
          && typeof question === 'object'
          && !Array.isArray(question)
          && String((question as Record<string, unknown>).title || '').trim(),
        )
    ))

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
      blueprintOpenQuestions: input.blueprintOpenQuestions,
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
      blueprintOpenQuestions: input.blueprintOpenQuestions,
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

export type RepeatedFormPlanRestageDecision =
  | { kind: 'continue' }
  | {
      kind: 'remind'
      systemMessage: string
    }
  | {
      kind: 'stop'
      finishReason: 'form_plan_restage_stop_loss'
      assistantMessage: string
    }

type FormPlanRestageResultLike = PlanningConvergenceResultLike & {
  callId?: unknown
}

type FormPlanRestageEvent = {
  result: FormPlanRestageResultLike
  isRepeat: boolean
  newQuestionCount: number
}

const resolveFormPlanRestageFamilyKey = (outline: Record<string, unknown> | null | undefined) => {
  const primaryForm = Array.isArray(outline?.forms)
    ? outline.forms.find(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined
    : undefined
  return normalizeQuestionIdentity(String(primaryForm?.tableName || primaryForm?.formKey || '').trim())
}

const collectFormPlanRestageEvents = (
  results: PlanningConvergenceResultLike[],
): FormPlanRestageEvent[] => {
  const events: FormPlanRestageEvent[] = []
  const seenQuestionsByFamily = new Map<string, Set<string>>()

  for (const result of results || []) {
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_stage_single_form_plan') {
      continue
    }

    const outline = getNormalizedFormPlanOutline(result.output?.outline)
    const familyKey = resolveFormPlanRestageFamilyKey(outline as Record<string, unknown> | null)
    if (!familyKey) {
      continue
    }

    const questionIdentities = new Set(
      (Array.isArray(outline?.openQuestions) ? outline.openQuestions : []).map(resolveQuestionIdentity),
    )
    const seenQuestions = seenQuestionsByFamily.get(familyKey)
    if (!seenQuestions) {
      seenQuestionsByFamily.set(familyKey, questionIdentities)
      events.push({ result, isRepeat: false, newQuestionCount: 0 })
      continue
    }

    let newQuestionCount = 0
    for (const identity of questionIdentities) {
      if (!seenQuestions.has(identity)) {
        newQuestionCount += 1
      }
    }
    for (const identity of questionIdentities) {
      seenQuestions.add(identity)
    }
    events.push({ result, isRepeat: true, newQuestionCount })
  }

  return events
}

const isFormPlanRestageEventInRound = (input: {
  event: FormPlanRestageEvent
  roundResults: FormPlanRestageResultLike[]
}) => (input.roundResults || []).some(roundResult => (
  roundResult === input.event.result
  || Boolean(
    roundResult?.callId
    && input.event.result?.callId
    && String(roundResult.callId) === String(input.event.result.callId),
  )
))

const buildFormPlanRestageReminderSystemMessage = () => [
  '该表单规划已暂存且没有新增待确认项。',
  '请直接调用 editor_stage_app_blueprint 进入蓝图（或等待用户确认），不要重复暂存同一张表单的规划。',
].join('\n')

const buildFormPlanRestageStopLossMessage = () => (
  '该表单规划已重复暂存且没有新增待确认项，已停止重复暂存。'
  + '请直接继续生成应用蓝图，或等待用户确认现有规划。'
)

/**
 * 同一回合内对同一逻辑家族（阶段 + 主表单）重复暂存规划且没有新增待确认项时，
 * 先提醒一次；再次重复则收口结束，避免同表并列出现多张规划卡。
 * 跨回合（用户有新输入）的正常迭代不受影响。
 */
export const resolveRepeatedFormPlanRestageDecision = (input: {
  results: PlanningConvergenceResultLike[]
  roundResults: FormPlanRestageResultLike[]
  reminderCount?: unknown
}): RepeatedFormPlanRestageDecision => {
  const events = collectFormPlanRestageEvents(input.results)
  const latestEvent = events[events.length - 1]
  if (
    !latestEvent
    || !latestEvent.isRepeat
    || latestEvent.newQuestionCount > 0
    || !isFormPlanRestageEventInRound({
      event: latestEvent,
      roundResults: input.roundResults,
    })
  ) {
    return { kind: 'continue' }
  }

  if (Number(input.reminderCount || 0) < 1) {
    return {
      kind: 'remind',
      systemMessage: buildFormPlanRestageReminderSystemMessage(),
    }
  }

  return {
    kind: 'stop',
    finishReason: 'form_plan_restage_stop_loss',
    assistantMessage: buildFormPlanRestageStopLossMessage(),
  }
}
