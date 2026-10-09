import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowSchemePlanningStatus,
  NocodeEditorFlowSchemeQuestion,
} from './nocodeEditorFlowScheme'
import type {
  UnifiedFlowIssue,
  UnifiedFlowIssueBlockedNextAction,
} from './nocodeEditorFlowUnifiedIssue'
import {
  normalizeUnifiedFlowIssueBlockedNextAction,
  normalizeUnifiedFlowIssues,
} from './nocodeEditorFlowUnifiedIssue'
import {
  normalizeVisibleFlowGroundingQuestions,
} from './nocodeEditorFlowGroundingPresentation'
import type {
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from './nocodeEditorFlowSchemeGrounding'

export type FlowIssueRoutingOutcome =
  | 'auto_continue'
  | 'return_to_flow_scheme'
  | 'execution_blocker'
  | 'system_error'

export type FlowIssueRoutingResult = {
  outcome: FlowIssueRoutingOutcome
  activeIssues: UnifiedFlowIssue[]
  planningStatus: NocodeEditorFlowSchemePlanningStatus
  requiredNextAction?: 'editor_plan_flow_scheme'
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | null
  userMessage?: string
}

export type FlowIssueLegacyProjection = {
  planningStatus: NocodeEditorFlowSchemePlanningStatus
  openQuestions: NocodeEditorFlowSchemeQuestion[]
  confirmation: NocodeEditorAiConfirmPayload | null
  requiredNextAction?: 'editor_plan_flow_scheme'
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | null
  userMessage?: string
  flowGroundingQuestions?: NocodeEditorAiConfirmQuestion[]
  flowGroundingReturnToStage?: 'flow-scheme'
  flowGroundingUserMessage?: string
}

type UnknownRecord = Record<string, unknown>

type ProjectFlowIssueRouteInput = {
  issues: UnifiedFlowIssue[]
  routing: FlowIssueRoutingResult
  planningContextKey?: string
  stage?: string
}

const ROUTING_OUTCOMES = new Set<FlowIssueRoutingOutcome>([
  'auto_continue',
  'return_to_flow_scheme',
  'execution_blocker',
  'system_error',
])

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeRoutingOutcome = (
  value: unknown,
): FlowIssueRoutingOutcome | null => {
  const normalized = normalizeText(value) as FlowIssueRoutingOutcome
  return ROUTING_OUTCOMES.has(normalized) ? normalized : null
}

const resolveFirstText = (
  issues: UnifiedFlowIssue[],
  pick: (issue: UnifiedFlowIssue) => unknown,
) => {
  for (const issue of issues) {
    const text = normalizeText(pick(issue))
    if (text) {
      return text
    }
  }
  return ''
}

const resolveFirstBlockedNextAction = (
  issues: UnifiedFlowIssue[],
) => {
  for (const issue of issues) {
    if (issue.blockedNextAction) {
      return issue.blockedNextAction
    }
  }
  return null
}

const buildRoutingResult = (
  outcome: FlowIssueRoutingOutcome,
  activeIssues: UnifiedFlowIssue[],
): FlowIssueRoutingResult => {
  const planningStatus = outcome === 'return_to_flow_scheme'
    ? 'needs_confirmation'
    : 'ready_for_review'
  const blockedNextAction = resolveFirstBlockedNextAction(activeIssues)
  const userMessage = resolveFirstText(activeIssues, issue => issue.userMessage)

  return {
    outcome,
    activeIssues,
    planningStatus,
    requiredNextAction: outcome === 'return_to_flow_scheme'
      ? 'editor_plan_flow_scheme'
      : undefined,
    blockedNextAction,
    userMessage: userMessage || undefined,
  }
}

const isReturnToFlowSchemeIssue = (issue: UnifiedFlowIssue) => (
  issue.userActionRequired === true
  && issue.returnToStage === 'flow-scheme'
  && Boolean(issue.questionPayload)
)

export const routeUnifiedFlowIssues = (
  value: unknown,
): FlowIssueRoutingResult => {
  const issues = normalizeUnifiedFlowIssues(value)
  if (!issues.length) {
    return buildRoutingResult('auto_continue', [])
  }

  const systemIssues = issues.filter(issue => issue.category === 'system_error')
  if (systemIssues.length) {
    return buildRoutingResult('system_error', systemIssues)
  }

  const returnIssues = issues.filter(isReturnToFlowSchemeIssue)
  if (returnIssues.length) {
    return buildRoutingResult('return_to_flow_scheme', returnIssues)
  }

  const blockingIssues = issues.filter(issue => issue.severity === 'blocking')
  if (blockingIssues.length) {
    return buildRoutingResult('execution_blocker', blockingIssues)
  }

  return buildRoutingResult('auto_continue', [])
}

type FlowIssueQuestionEntry = {
  issue: UnifiedFlowIssue
  issueIndex: number
  question: NocodeEditorAiConfirmQuestion
}

const buildDedupedIssueQuestionEntries = (
  issues: UnifiedFlowIssue[],
) => {
  const usedKeys = new Set<string>()
  const result: FlowIssueQuestionEntry[] = []
  issues.forEach((issue, issueIndex) => {
    const question = projectIssueToVisibleQuestion(issue, issueIndex)
    const key = normalizeText(question.decisionKey)
      || normalizeText(question.id)
      || normalizeText(question.title)
    if (!key || usedKeys.has(key)) {
      return
    }
    usedKeys.add(key)
    result.push({ issue, issueIndex, question })
  })
  return result
}

const buildFallbackQuestionPayload = (
  issue: UnifiedFlowIssue,
  index: number,
): NocodeEditorAiConfirmQuestion => {
  const title = normalizeText(issue.userMessage) || '流程方案还需要补充确认'
  return {
    id: issue.issueId || `flow-issue-question-${index + 1}`,
    title,
    questionKind: 'note_only',
    description: title,
    required: true,
    allowFreeText: true,
  }
}

const resolveOpenQuestionScopeKind = (
  issue: UnifiedFlowIssue,
): NocodeEditorFlowSchemeQuestion['scopeKind'] => {
  if (issue.questionPayload?.scopeKind === 'trigger-branch') {
    return 'branch'
  }
  if (issue.scope?.kind === 'step') {
    return 'step'
  }
  if (issue.scope?.kind === 'branch') {
    return 'branch'
  }
  return 'global'
}

const projectIssueToOpenQuestion = (
  issue: UnifiedFlowIssue,
  index: number,
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorFlowSchemeQuestion => {
  return {
    key: normalizeText(question.decisionKey)
      || normalizeText(question.id)
      || issue.issueId
      || `flow-issue-question-${index + 1}`,
    title: normalizeText(question.title) || issue.userMessage,
    reason: normalizeText(question.description) || normalizeText(question.title) || issue.userMessage,
    scopeKind: resolveOpenQuestionScopeKind(issue),
    scopeKey: normalizeText(question.branchKey)
      || normalizeText(issue.scope?.key)
      || undefined,
  }
}

const projectIssueToVisibleQuestion = (
  issue: UnifiedFlowIssue,
  index: number,
) => {
  const sourceQuestion = issue.questionPayload || buildFallbackQuestionPayload(issue, index)
  const questions = normalizeVisibleFlowGroundingQuestions({
    questions: [sourceQuestion],
    diagnostics: Array.isArray(issue.diagnostics)
      ? issue.diagnostics as NocodeEditorFlowSchemeGroundingDiagnostic[]
      : [],
  })
  const question = questions[0] || buildFallbackQuestionPayload(issue, index)
  const decisionKey = normalizeText(sourceQuestion.decisionKey)
  return decisionKey
    ? {
      ...question,
      decisionKey,
      ...(sourceQuestion.decisionKeySource
        ? { decisionKeySource: sourceQuestion.decisionKeySource }
        : {}),
    }
    : question
}

const isLateStageReturnIssue = (issue: UnifiedFlowIssue) => (
  issue.returnToStage === 'flow-scheme'
  && issue.sourceStage !== 'flow-scheme'
)

const buildReturnToFlowSchemeProjection = (
  input: ProjectFlowIssueRouteInput,
): FlowIssueLegacyProjection => {
  const activeIssues = input.routing.activeIssues.length
    ? input.routing.activeIssues
    : routeUnifiedFlowIssues(input.issues).activeIssues
  if (!activeIssues.length) {
    return {
      planningStatus: 'ready_for_review',
      openQuestions: [],
      confirmation: null,
      blockedNextAction: input.routing.blockedNextAction,
      userMessage: input.routing.userMessage,
    }
  }

  const questionEntries = buildDedupedIssueQuestionEntries(activeIssues)
  const questions = questionEntries.map(entry => entry.question)
  const openQuestions = questionEntries.map(entry => (
    projectIssueToOpenQuestion(entry.issue, entry.issueIndex, entry.question)
  ))
  const planningContextKey = normalizeText(input.planningContextKey)
    || resolveFirstText(activeIssues, issue => issue.planningContextKey)
  const blockedNextAction = input.routing.blockedNextAction
    || resolveFirstBlockedNextAction(activeIssues)
  const userMessage = normalizeText(input.routing.userMessage)
    || resolveFirstText(activeIssues, issue => issue.userMessage)
  const hasLateStageIssue = activeIssues.some(isLateStageReturnIssue)
  const confirmationBlockedNextAction = blockedNextAction === 'editor_stage_flow_blueprint'
    ? 'editor_stage_flow_blueprint' as const
    : undefined

  const confirmation: NocodeEditorAiConfirmPayload = {
    stage: 'flow-scheme',
    status: 'pending',
    planningContextKey: planningContextKey || undefined,
    questions,
    requiredNextAction: 'editor_plan_flow_scheme',
    blockedNextAction: confirmationBlockedNextAction,
  }

  return {
    planningStatus: 'needs_confirmation',
    openQuestions,
    confirmation,
    requiredNextAction: 'editor_plan_flow_scheme',
    blockedNextAction,
    userMessage: userMessage || undefined,
    flowGroundingQuestions: hasLateStageIssue ? questions : undefined,
    flowGroundingReturnToStage: hasLateStageIssue ? 'flow-scheme' : undefined,
    flowGroundingUserMessage: hasLateStageIssue
      ? userMessage || undefined
      : undefined,
  }
}

export const projectFlowIssueRouteToLegacyFields = (
  input: ProjectFlowIssueRouteInput,
): FlowIssueLegacyProjection => {
  const normalizedIssues = normalizeUnifiedFlowIssues(input.issues)
  const inputRouting = normalizeFlowIssueRoutingResult(input.routing)
  const routing = normalizedIssues.length
    ? (() => {
      const issueRouting = routeUnifiedFlowIssues(normalizedIssues)
      return {
        ...issueRouting,
        blockedNextAction: issueRouting.blockedNextAction || inputRouting?.blockedNextAction,
        userMessage: issueRouting.userMessage || inputRouting?.userMessage,
      }
    })()
    : inputRouting || routeUnifiedFlowIssues([])

  if (routing.outcome !== 'return_to_flow_scheme') {
    return {
      planningStatus: 'ready_for_review',
      openQuestions: [],
      confirmation: null,
      blockedNextAction: routing.blockedNextAction,
      userMessage: routing.userMessage,
    }
  }

  return buildReturnToFlowSchemeProjection({
    ...input,
    issues: normalizedIssues,
    routing,
  })
}

const resolveRoutingRecord = (
  value: UnknownRecord,
): UnknownRecord => {
  if (isRecord(value.flowIssueRouting)) {
    return value.flowIssueRouting
  }
  if (isRecord(value.routing)) {
    return value.routing
  }
  if (isRecord(value.flowIssueRoute)) {
    return value.flowIssueRoute
  }
  if (isRecord(value.metadata)) {
    const metadata = value.metadata
    if (isRecord(metadata.flowIssueRouting)) {
      return metadata.flowIssueRouting
    }
    if (isRecord(metadata.routing)) {
      return metadata.routing
    }
  }
  return value
}

export const normalizeFlowIssueRoutingResult = (
  value: unknown,
): FlowIssueRoutingResult | null => {
  const record = isRecord(value) ? value : null
  if (!record) {
    return null
  }

  const routingRecord = resolveRoutingRecord(record)
  const outcome = normalizeRoutingOutcome(routingRecord.outcome)
  const normalizedActiveIssues = normalizeUnifiedFlowIssues(routingRecord.activeIssues)
  const activeIssues = normalizedActiveIssues.length
    ? normalizedActiveIssues
    : normalizeUnifiedFlowIssues(routingRecord.issues)
  const blockedNextAction = normalizeUnifiedFlowIssueBlockedNextAction(
    routingRecord.blockedNextAction,
  ) || undefined
  const userMessage = normalizeText(routingRecord.userMessage)

  if (activeIssues.length) {
    const derived = routeUnifiedFlowIssues(activeIssues)
    return {
      ...derived,
      blockedNextAction: blockedNextAction || derived.blockedNextAction,
      userMessage: userMessage || derived.userMessage,
    }
  }

  if (!outcome) {
    return null
  }

  if (outcome !== 'auto_continue') {
    return null
  }

  const normalized = buildRoutingResult(outcome, activeIssues)

  return {
    ...normalized,
    blockedNextAction: blockedNextAction || normalized.blockedNextAction,
    userMessage: userMessage || normalized.userMessage,
  }
}
