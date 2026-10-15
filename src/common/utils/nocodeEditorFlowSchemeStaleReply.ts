import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorConfirmationDecision,
} from './nocodeEditorConfirmationDecisionProjection'
import type {
  NocodeEditorConfirmationDecisionConflict,
} from './nocodeEditorConfirmationDecisionReconciliation'
import {
  reconcileNocodeEditorConfirmationDecisions,
} from './nocodeEditorConfirmationDecisionReconciliation'
import {
  projectFlowDecisionContract,
} from './nocodeEditorFlowDecisionGraph'
import {
  filterPendingNocodeEditorFlowConfirmationQuestions,
} from './nocodeEditorFlowQuestionPolicy'
import {
  isSamePlanningConfirmationContext,
} from './nocodeEditorPlanningConfirmationIdentity'
import type {
  UnifiedFlowIssue,
  UnifiedFlowIssueDiagnostic,
} from './nocodeEditorFlowUnifiedIssue'
import type {
  NocodeEditorFlowSchemeConfirmationRejection,
} from './nocodeEditorFlowConfirmationTrust'

export type NocodeEditorFlowSchemeStaleReplyMode =
  | 'idempotent_replay'
  | 'rebased'
  | 'route'
  | 'accept_without_pending'

export type NocodeEditorFlowSchemeStaleReplyResolution = {
  mode: NocodeEditorFlowSchemeStaleReplyMode
  decisionKeys: string[]
  idempotentDecisionKeys: string[]
  rebasedDecisionKeys: string[]
  unhealedDecisionKeys: string[]
  conflicts: NocodeEditorConfirmationDecisionConflict[]
  pendingQuestions: NocodeEditorAiConfirmQuestion[]
}

export const NOCODE_EDITOR_FLOW_SCHEME_STALE_REPLY_ISSUE_PREFIX = 'flow-scheme-answer-stale'

export const NOCODE_EDITOR_FLOW_SCHEME_STALE_REPLY_MESSAGE = '方案已更新，请按最新方案重新确认这组问题。'

const normalizeText = (value: unknown) => String(value ?? '').trim()

const decisionKeyOf = (decision: NocodeEditorConfirmationDecision) => (
  normalizeText(decision.decisionKey) || normalizeText(decision.questionId)
)

const questionKeyOf = (question: NocodeEditorAiConfirmQuestion) => (
  normalizeText(question.decisionKey) || normalizeText(question.id)
)

const hasDecisionAnswer = (decision: NocodeEditorConfirmationDecision) => Boolean(
  normalizeText(decision.selectedOptionValue)
  || normalizeText(decision.answerSummary)
  || normalizeText(decision.answerDetail)
)

const questionHasStoredAnswer = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || normalizeText(question.selectedOptionValue)
  || normalizeText(question.answerSummary)
  || normalizeText(question.answerDetail)
  || question.options?.some(option => option.selected)
)

const stripQuestionAnswerFields = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => ({
  ...question,
  confirmed: false,
  selectedOptionValue: undefined,
  answerSummary: undefined,
  answerDetail: undefined,
  ...(question.options
    ? { options: question.options.map(option => ({ ...option, selected: false })) }
    : {}),
})

export const resolveNocodeEditorFlowSchemePendingQuestions = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
): NocodeEditorAiConfirmQuestion[] => {
  const questions = Array.isArray(confirmation?.questions) ? confirmation.questions : []
  if (!questions.length) {
    return []
  }
  const projection = projectFlowDecisionContract(questions, confirmation?.factSnapshot || {})
  const pending = projection.diagnostics.length
    ? questions.filter(question => question.required !== false && !questionHasStoredAnswer(question))
    : projection.unresolved.filter(question => question.required !== false)
  return filterPendingNocodeEditorFlowConfirmationQuestions(
    pending.map(stripQuestionAnswerFields),
  )
}

export type NocodeEditorFlowSchemeDecisionMatch = {
  providedKeys: string[]
  currentKeys: string[]
  matchedKeys: string[]
  unmatchedKeys: string[]
}

/**
 * 可信决策键与当前题目键的匹配：命中项可应用，未命中项保持待答；
 * 题目键取 decisionKey 优先、id 兜底。
 */
export const matchNocodeEditorFlowSchemeDecisionsToQuestions = (input: {
  decisions?: Array<{
    decisionKey?: unknown
    questionId?: unknown
  }> | null
  questions?: NocodeEditorAiConfirmQuestion[] | null
}): NocodeEditorFlowSchemeDecisionMatch => {
  const providedKeys = Array.from(new Set((Array.isArray(input.decisions) ? input.decisions : [])
    .map(decision => normalizeText(decision?.decisionKey) || normalizeText(decision?.questionId))
    .filter(Boolean)))
  const currentKeys = Array.from(new Set((Array.isArray(input.questions) ? input.questions : [])
    .map(questionKeyOf)
    .filter(Boolean)))
  const currentKeySet = new Set(currentKeys)
  return {
    providedKeys,
    currentKeys,
    matchedKeys: providedKeys.filter(key => currentKeySet.has(key)),
    unmatchedKeys: providedKeys.filter(key => !currentKeySet.has(key)),
  }
}

export type NocodeEditorFlowSchemeDecisionMatchDisposition =
  | 'no_decisions'
  | 'applied'
  | 'partially_applied'
  | 'superseded_by_replan'

/**
 * 匹配结果的分级判定：0 命中且仍有待答问题时视为题目已按最新规划重建（重问轮），
 * 宿主降级为非阻断诊断而不是阻断失败；其余情况沿用应用/部分应用语义。
 */
export const resolveNocodeEditorFlowSchemeDecisionMatchDisposition = (input: {
  match?: NocodeEditorFlowSchemeDecisionMatch | null
  pendingQuestionCount?: number
}): NocodeEditorFlowSchemeDecisionMatchDisposition => {
  const providedKeys = Array.isArray(input.match?.providedKeys) ? input.match.providedKeys : []
  if (!providedKeys.length) {
    return 'no_decisions'
  }
  const matchedKeys = Array.isArray(input.match?.matchedKeys) ? input.match.matchedKeys : []
  if (matchedKeys.length === providedKeys.length) {
    return 'applied'
  }
  if (matchedKeys.length || !(Number(input.pendingQuestionCount) > 0)) {
    return 'partially_applied'
  }
  return 'superseded_by_replan'
}

/**
 * 卡片版本与实时 revision 不一致时的三态判定：幂等重放 / 重基接受 / 路由重问。
 * 复用 reconcile 语义——决策键被当前确认吸收（同答案=幂等，待答可继承=可重基），
 * 冲突、未吸收或形态缺失即视为不可愈合；只有在仍有待答问题时才值得重问。
 */
export const resolveNocodeEditorFlowSchemeStaleReplyMode = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  replyDecisions?: NocodeEditorConfirmationDecision[] | null
  expectedPlanningContextKey?: string
}): NocodeEditorFlowSchemeStaleReplyResolution => {
  const expectedPlanningContextKey = normalizeText(input.expectedPlanningContextKey)
  const decisions = (Array.isArray(input.replyDecisions) ? input.replyDecisions : [])
    .filter(decision => Boolean(decisionKeyOf(decision)) && hasDecisionAnswer(decision))
  const decisionKeys = Array.from(new Set(decisions.map(decisionKeyOf)))
  const pendingQuestions = resolveNocodeEditorFlowSchemePendingQuestions(input.confirmation)

  if (!input.confirmation || !decisions.length) {
    return {
      mode: 'accept_without_pending',
      decisionKeys,
      idempotentDecisionKeys: [],
      rebasedDecisionKeys: [],
      unhealedDecisionKeys: [],
      conflicts: [],
      pendingQuestions,
    }
  }

  const contextMismatchedKeys = new Set(decisions
    .filter(decision => (
      expectedPlanningContextKey
      && (
        !normalizeText(decision.planningContextKey)
        || !isSamePlanningConfirmationContext(
          normalizeText(decision.planningContextKey),
          expectedPlanningContextKey,
        )
      )
    ))
    .map(decisionKeyOf))
  const reconciliation = reconcileNocodeEditorConfirmationDecisions({
    confirmation: input.confirmation,
    previousDecisions: decisions,
    expectedPlanningContextKey: expectedPlanningContextKey || undefined,
  })
  const questions = Array.isArray(input.confirmation.questions) ? input.confirmation.questions : []
  const questionByKey = new Map<string, NocodeEditorAiConfirmQuestion>()
  questions.forEach((question) => {
    const key = questionKeyOf(question)
    if (key) {
      questionByKey.set(key, question)
    }
  })
  const conflictKeys = new Set(reconciliation.conflicts
    .map(conflict => normalizeText(conflict.decisionKey))
    .filter(Boolean))
  const resolvedKeys = new Set(reconciliation.resolvedDecisionKeys.map(normalizeText).filter(Boolean))

  const idempotentDecisionKeys: string[] = []
  const rebasedDecisionKeys: string[] = []
  const unhealedDecisionKeys: string[] = []
  decisionKeys.forEach((key) => {
    const question = questionByKey.get(key)
    if (
      contextMismatchedKeys.has(key)
      || !question
      || conflictKeys.has(key)
      || !resolvedKeys.has(key)
    ) {
      unhealedDecisionKeys.push(key)
      return
    }
    if (questionHasStoredAnswer(question)) {
      idempotentDecisionKeys.push(key)
    } else {
      rebasedDecisionKeys.push(key)
    }
  })

  const mode: NocodeEditorFlowSchemeStaleReplyMode = unhealedDecisionKeys.length
    ? (pendingQuestions.length ? 'route' : 'accept_without_pending')
    : (idempotentDecisionKeys.length === decisionKeys.length ? 'idempotent_replay' : 'rebased')

  return {
    mode,
    decisionKeys,
    idempotentDecisionKeys,
    rebasedDecisionKeys,
    unhealedDecisionKeys,
    conflicts: reconciliation.conflicts,
    pendingQuestions,
  }
}

const buildFlowSchemePendingQuestionIssues = (input: {
  issuePrefix: string
  userMessage: string
  diagnostic: UnifiedFlowIssueDiagnostic
  pendingQuestions?: NocodeEditorAiConfirmQuestion[] | null
  planningContextKey?: string
}): UnifiedFlowIssue[] => {
  const pendingQuestions = Array.isArray(input.pendingQuestions) ? input.pendingQuestions : []
  if (!pendingQuestions.length) {
    return []
  }

  return pendingQuestions.map((question, index) => {
    const decisionKey = questionKeyOf(question)
    return {
      issueId: `${input.issuePrefix}:${decisionKey || index + 1}`,
      sourceStage: 'flow-scheme',
      category: 'business_gap',
      severity: 'blocking',
      userActionRequired: true,
      planningContextKey: normalizeText(input.planningContextKey) || undefined,
      returnToStage: 'flow-scheme',
      blockedNextAction: null,
      userMessage: input.userMessage,
      questionPayload: question,
      scope: {
        kind: question.scopeKind === 'trigger-branch' ? 'branch' : 'global',
        key: normalizeText(question.branchKey) || undefined,
      },
      diagnostics: [{
        ...input.diagnostic,
        decisionKey: decisionKey || undefined,
        pendingQuestionCount: pendingQuestions.length,
      }],
    }
  })
}

export const buildNocodeEditorFlowSchemeStaleReplyIssues = (input: {
  pendingQuestions?: NocodeEditorAiConfirmQuestion[] | null
  planningContextKey?: string
  answerRevision?: number
  currentRevision?: number
  unhealedDecisionKeys?: string[]
}): UnifiedFlowIssue[] => {
  const answerRevision = Number(input.answerRevision || 0)
  const currentRevision = Number(input.currentRevision || 0)
  const unhealedDecisionKeys = (Array.isArray(input.unhealedDecisionKeys)
    ? input.unhealedDecisionKeys
    : [])
    .map(normalizeText)
    .filter(Boolean)

  return buildFlowSchemePendingQuestionIssues({
    issuePrefix: NOCODE_EDITOR_FLOW_SCHEME_STALE_REPLY_ISSUE_PREFIX,
    userMessage: NOCODE_EDITOR_FLOW_SCHEME_STALE_REPLY_MESSAGE,
    diagnostic: {
      code: 'flow_scheme_answer_version_stale',
      message: `answer revision ${answerRevision}, current revision ${currentRevision}`,
      answerRevision: answerRevision || undefined,
      currentRevision: currentRevision || undefined,
      decisionKeys: unhealedDecisionKeys,
    },
    pendingQuestions: input.pendingQuestions,
    planningContextKey: input.planningContextKey,
  })
}

export const NOCODE_EDITOR_FLOW_SCHEME_CONFIRMATION_REJECTED_ISSUE_PREFIX = 'flow-scheme-confirmation-rejected'

export const NOCODE_EDITOR_FLOW_SCHEME_DECISION_UNMATCHED_ISSUE_PREFIX = 'flow-scheme-decision-unmatched'

export const NOCODE_EDITOR_FLOW_SCHEME_DECISION_UNMATCHED_MESSAGE = '这组答案与当前方案的问题已不对应，请按最新问题重新确认。'

const NOCODE_EDITOR_FLOW_SCHEME_CONFIRMATION_REJECTED_MESSAGES: Record<string, string> = {
  flow_confirmation_context_missing: '确认题的上下文未能建立，请重新确认这组问题。',
  flow_confirmation_context_mismatch: '确认上下文与当前方案不一致，请重新确认这组问题。',
  flow_confirmation_revision_stale: NOCODE_EDITOR_FLOW_SCHEME_STALE_REPLY_MESSAGE,
}

export const resolveNocodeEditorFlowSchemeConfirmationRejectedUserMessage = (code: unknown) => (
  NOCODE_EDITOR_FLOW_SCHEME_CONFIRMATION_REJECTED_MESSAGES[normalizeText(code)]
  || '确认题的上下文未能建立，请重新确认这组问题。'
)

export const buildNocodeEditorFlowSchemeConfirmationRejectedIssues = (input: {
  rejection?: Partial<NocodeEditorFlowSchemeConfirmationRejection> | null
  pendingQuestions?: NocodeEditorAiConfirmQuestion[] | null
  planningContextKey?: string
}): UnifiedFlowIssue[] => {
  const rejection = input.rejection
  if (!rejection) {
    return []
  }
  const code = normalizeText(rejection.code) || 'flow_confirmation_context_missing'
  return buildFlowSchemePendingQuestionIssues({
    issuePrefix: NOCODE_EDITOR_FLOW_SCHEME_CONFIRMATION_REJECTED_ISSUE_PREFIX,
    userMessage: resolveNocodeEditorFlowSchemeConfirmationRejectedUserMessage(code),
    diagnostic: {
      code,
      message: `confirmation context rejected: ${code}`,
      confirmationStage: normalizeText(rejection.confirmationStage) || undefined,
      missingFields: rejection.missingFields?.length ? rejection.missingFields : undefined,
      expected: normalizeText(rejection.expected) || undefined,
      actual: normalizeText(rejection.actual) || undefined,
      replyRevision: rejection.replyRevision,
      currentRevision: rejection.currentRevision,
    },
    pendingQuestions: input.pendingQuestions,
    planningContextKey: input.planningContextKey,
  })
}

export const buildNocodeEditorFlowSchemeDecisionUnmatchedIssues = (input: {
  pendingQuestions?: NocodeEditorAiConfirmQuestion[] | null
  providedKeys?: string[] | null
  currentKeys?: string[] | null
  planningContextKey?: string
}): UnifiedFlowIssue[] => {
  const providedKeys = (Array.isArray(input.providedKeys) ? input.providedKeys : [])
    .map(normalizeText)
    .filter(Boolean)
  const currentKeys = (Array.isArray(input.currentKeys) ? input.currentKeys : [])
    .map(normalizeText)
    .filter(Boolean)
  return buildFlowSchemePendingQuestionIssues({
    issuePrefix: NOCODE_EDITOR_FLOW_SCHEME_DECISION_UNMATCHED_ISSUE_PREFIX,
    userMessage: NOCODE_EDITOR_FLOW_SCHEME_DECISION_UNMATCHED_MESSAGE,
    diagnostic: {
      code: 'flow_confirmation_decision_unmatched',
      message: `provided decision keys match 0 current question keys (provided ${providedKeys.length}, current ${currentKeys.length})`,
      providedKeys,
      currentKeys,
    },
    pendingQuestions: input.pendingQuestions,
    planningContextKey: input.planningContextKey,
  })
}
