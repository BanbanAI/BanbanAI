import type {
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionKind,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeQuestion,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import type {
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from './nocodeEditorFlowSchemeGrounding'
import type {
  FlowGroundingIssueGroup,
} from './nocodeEditorFlowGroundingPresentation'
import {
  NOCODE_EDITOR_FLOW_APPROVAL_OWNER_EMPTY_HANDLER_DESCRIPTION,
  normalizeNocodeEditorConfirmationQuestion,
} from './nocodeEditorConfirmationNormalization'
import {
  isNocodeEditorFlowApprovalOwnerSourceQuestion,
} from './nocodeEditorFlowQuestionPolicy'
import {
  flowConfirmationQuestionKey,
} from './nocodeEditorFlowConfirmationPendingQuestions'
import {
  buildNocodeEditorFlowPersonnelSourceOptions,
} from './nocodeEditorFlowPersonnelSourceOptions'
import {
  annotateNocodeEditorFlowPersonnelSourceQuestion,
  resolveNocodeEditorFlowPersonnelSourceQuestionAnchor,
} from './nocodeEditorFlowPersonnelSourceAnchor'
import type {
  NocodeEditorFlowPersonnelSourceEvidence,
} from './nocodeEditorFlowPersonnelSourceAnchor'
import type {
  NocodeEditorConfirmationDecisionConflict,
} from './nocodeEditorConfirmationDecisionReconciliation'
import { projectFlowDecisionContract } from './nocodeEditorFlowDecisionGraph'
import {
  buildFlowDecisionStepLookup,
  resolveFlowDependencyDecisionPointRef,
  resolveFlowDependencyPersonnelDecision,
  resolveFlowQuestionDecisionPointRef,
} from './nocodeEditorFlowDecisionIdentity'
import type { FlowDecisionStepLookup } from './nocodeEditorFlowDecisionIdentity'

export type UnifiedFlowIssueSourceStage =
  | 'flow-scheme'
  | 'flow-plan'
  | 'runtime'
  | 'apply'
  | 'patch'

export type UnifiedFlowIssueCategory =
  | 'business_gap'
  | 'mapping_gap'
  | 'config_gap'
  | 'environment_blocker'
  | 'system_error'

export type UnifiedFlowIssueSeverity =
  | 'blocking'
  | 'warning'

export type UnifiedFlowIssueBlockedNextAction =
  | 'editor_stage_flow_blueprint'
  | 'editor_apply_staged_flow'
  | 'editor_patch_flow'

export type UnifiedFlowIssueScope = {
  kind?: 'global' | 'step' | 'branch' | 'process_node'
  key?: string
  title?: string
  targetId?: string
  targetLabel?: string
}

export type UnifiedFlowIssueDiagnostic = Record<string, unknown>

export type UnifiedFlowIssue = {
  issueId: string
  decisionPointKey?: string
  sourceStage: UnifiedFlowIssueSourceStage
  category: UnifiedFlowIssueCategory
  severity: UnifiedFlowIssueSeverity
  userActionRequired: boolean
  planningContextKey?: string
  returnToStage?: 'flow-scheme' | null
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | null
  userMessage: string
  questionPayload?: NocodeEditorAiConfirmQuestion | null
  scope?: UnifiedFlowIssueScope
  diagnostics?: UnifiedFlowIssueDiagnostic[]
}

export type FlowIssueStateResolutionLike = {
  userActionRequired?: boolean
  returnToStage?: 'flow-scheme' | null
  questionTitle?: string
  questionDescription?: string
  questionKind?: NocodeEditorAiConfirmQuestionKind
  questionPayload?: Partial<NocodeEditorAiConfirmQuestion> | null
  category?: UnifiedFlowIssueCategory
  userMessage?: string
}

type UnknownRecord = Record<string, unknown>

type BuildUnifiedFlowIssuesFromFlowSchemeInput = {
  scheme?: NocodeEditorFlowScheme | null
  planningContextKey?: string
  userMessage?: string
  personnelSourceEvidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}

type BuildUnifiedFlowIssuesFromGroundingInput = {
  planningContextKey?: string
  userMessage?: string
  groups: FlowGroundingIssueGroup[]
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | string | null
}

type FlowActionIssueLike = {
  id?: string
  code?: string
  targetId?: string
  targetLabel?: string
  message?: string
  displayMessage?: string
}

type FlowIssueStateLike = {
  summary?: string
  actionIssues?: FlowActionIssueLike[]
}

type BuildUnifiedFlowIssuesFromFlowIssueStateInput = {
  sourceStage: UnifiedFlowIssueSourceStage
  planningContextKey?: string
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | string | null
  userMessage?: string
  flowIssueState?: FlowIssueStateLike | null
  issueResolutions?: Record<string, FlowIssueStateResolutionLike>
}

type BuildUnifiedFlowIssuesFromExecutionBlockerInput = {
  issueId: string
  sourceStage: UnifiedFlowIssueSourceStage
  planningContextKey?: string
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | string | null
  userMessage?: string
  code?: string
  path?: string
  title?: string
  message?: string
  diagnostics?: UnifiedFlowIssueDiagnostic[]
}

const SOURCE_STAGES = new Set<UnifiedFlowIssueSourceStage>([
  'flow-scheme',
  'flow-plan',
  'runtime',
  'apply',
  'patch',
])

const ISSUE_CATEGORIES = new Set<UnifiedFlowIssueCategory>([
  'business_gap',
  'mapping_gap',
  'config_gap',
  'environment_blocker',
  'system_error',
])

const ISSUE_SEVERITIES = new Set<UnifiedFlowIssueSeverity>([
  'blocking',
  'warning',
])

const BLOCKED_NEXT_ACTIONS = new Set<UnifiedFlowIssueBlockedNextAction>([
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
])

const QUESTION_KINDS = new Set<NocodeEditorAiConfirmQuestionKind>([
  'note_only',
  'binary',
  'single_select',
])

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeSourceStage = (
  value: unknown,
): UnifiedFlowIssueSourceStage => {
  const normalized = normalizeText(value) as UnifiedFlowIssueSourceStage
  return SOURCE_STAGES.has(normalized) ? normalized : 'flow-scheme'
}

const normalizeIssueCategory = (
  value: unknown,
  fallback: UnifiedFlowIssueCategory = 'config_gap',
): UnifiedFlowIssueCategory => {
  const normalized = normalizeText(value) as UnifiedFlowIssueCategory
  return ISSUE_CATEGORIES.has(normalized) ? normalized : fallback
}

const normalizeIssueSeverity = (
  value: unknown,
  fallback: UnifiedFlowIssueSeverity = 'blocking',
): UnifiedFlowIssueSeverity => {
  const normalized = normalizeText(value) as UnifiedFlowIssueSeverity
  return ISSUE_SEVERITIES.has(normalized) ? normalized : fallback
}

export const normalizeUnifiedFlowIssueBlockedNextAction = (
  value: unknown,
): UnifiedFlowIssueBlockedNextAction | null => {
  const normalized = normalizeText(value) as UnifiedFlowIssueBlockedNextAction
  return BLOCKED_NEXT_ACTIONS.has(normalized) ? normalized : null
}

const normalizeReturnToStage = (
  value: unknown,
): 'flow-scheme' | null => (
  normalizeText(value) === 'flow-scheme' ? 'flow-scheme' : null
)

const normalizeQuestionKind = (
  value: unknown,
): NocodeEditorAiConfirmQuestionKind | undefined => {
  const normalized = normalizeText(value) as NocodeEditorAiConfirmQuestionKind
  return QUESTION_KINDS.has(normalized) ? normalized : undefined
}

const normalizeQuestionPayload = (
  value: unknown,
  index: number,
): NocodeEditorAiConfirmQuestion | null => (
  normalizeNocodeEditorConfirmationQuestion(value, index, 'flow-scheme', {
    preserveTrustedDecisionKeySource: true,
  })
)

const normalizeScopeKind = (
  value: unknown,
): UnifiedFlowIssueScope['kind'] | undefined => {
  const normalized = normalizeText(value)
  if (normalized === 'trigger-branch') {
    return 'branch'
  }
  if (
    normalized === 'global'
    || normalized === 'step'
    || normalized === 'branch'
    || normalized === 'process_node'
  ) {
    return normalized
  }
  return undefined
}

const normalizeScope = (
  value: unknown,
): UnifiedFlowIssueScope | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const scope: UnifiedFlowIssueScope = {
    kind: normalizeScopeKind(value.kind || value.scopeKind),
    key: normalizeText(value.key || value.scopeKey) || undefined,
    title: normalizeText(value.title || value.scopeTitle) || undefined,
    targetId: normalizeText(value.targetId) || undefined,
    targetLabel: normalizeText(value.targetLabel) || undefined,
  }
  return scope.kind || scope.key || scope.title || scope.targetId || scope.targetLabel
    ? scope
    : undefined
}

const normalizeDiagnostics = (
  value: unknown,
): UnifiedFlowIssueDiagnostic[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item): UnifiedFlowIssueDiagnostic[] => (
      isRecord(item) ? [item] : []
    ))
  }
  return isRecord(value) ? [value] : []
}

const buildNoteOnlyQuestionPayload = (input: {
  id: string
  decisionKey?: string
  title: string
  description?: string
  required?: boolean
}): NocodeEditorAiConfirmQuestion => {
  const decisionKey = normalizeText(input.decisionKey)
  return {
    id: input.id,
    ...(decisionKey ? { decisionKey } : {}),
    title: input.title,
    questionKind: 'note_only',
    description: normalizeText(input.description) || undefined,
    required: input.required ?? true,
    allowFreeText: true,
  }
}

// 派生的人员来源题与模型来源题共用决策键与答案空间，确保卡片呈现五个来源选项、
// 答复以标准来源值回传，并让审批人收敛网络能按 flow.approval.owner.source 命中。
const buildApprovalOwnerSourceDecisionKey = (stepKey: unknown) => {
  const normalizedStepKey = normalizeText(stepKey)
  return normalizedStepKey
    ? `flow.approval.owner.source:${normalizedStepKey}`
    : 'flow.approval.owner.source'
}

const buildPersonnelSourceQuestionPayload = (input: {
  id: string
  decisionKey: string
  title: string
  description?: string
  stepKey: string
}): NocodeEditorAiConfirmQuestion => ({
  id: input.id,
  decisionKey: input.decisionKey,
  title: input.title,
  questionKind: 'single_select',
  description: normalizeText(input.description) || undefined,
  required: true,
  allowFreeText: true,
  personnelDecision: {
    stepKey: input.stepKey,
    slot: 'source',
  },
  options: buildNocodeEditorFlowPersonnelSourceOptions(),
})

// 层级题的答案空间是“方向 + 级数”：给出可点选项，其余级数仍可自由输入。
// 选择值形如 up1/down1，符合运行时对层级选项的识别规则。
const NOCODE_EDITOR_FLOW_DEPARTMENT_MANAGER_LEVEL_OPTIONS = [
  { value: 'up1', label: '向上 1 级（直属部门主管）' },
  { value: 'up2', label: '向上 2 级' },
  { value: 'up3', label: '向上 3 级' },
  { value: 'down1', label: '向下 1 级' },
]

const buildDepartmentManagerLevelQuestionPayload = (input: {
  id: string
  decisionKey?: string
  title: string
  description?: string
  stepKey: string
  /** approval_level 是审批专属槽位，非审批节点只保留决策键身份，不声明槽位 */
  stepKind?: NocodeEditorFlowSchemeStep['kind']
}): NocodeEditorAiConfirmQuestion => {
  const decisionKey = normalizeText(input.decisionKey)
  const stepKey = normalizeText(input.stepKey)
  return {
    id: input.id,
    ...(decisionKey ? { decisionKey } : {}),
    title: input.title,
    questionKind: 'single_select',
    description: normalizeText(input.description) || undefined,
    required: true,
    allowFreeText: true,
    ...(stepKey && input.stepKind === 'approval'
      ? { personnelDecision: { stepKey, slot: 'approval_level' as const } }
      : {}),
    options: NOCODE_EDITOR_FLOW_DEPARTMENT_MANAGER_LEVEL_OPTIONS,
  }
}

const isQuestionScopeCoveringDependency = (
  questionScope?: UnifiedFlowIssueScope,
  dependencyScope?: Pick<NocodeEditorFlowSchemeDependency, 'scopeKind' | 'scopeKey'>,
) => {
  const questionKind = questionScope?.kind || 'global'
  const dependencyKind = dependencyScope?.scopeKind || 'global'
  if (questionKind === 'global') {
    return true
  }
  return questionKind === dependencyKind
    && normalizeText(questionScope?.key) === normalizeText(dependencyScope?.scopeKey)
}

const getQuestionKey = (question: NocodeEditorAiConfirmQuestion) => (
  flowConfirmationQuestionKey(question) || normalizeText(question.title)
)

const hasResolvedQuestionAnswer = (
  question?: NocodeEditorAiConfirmQuestion | null,
) => Boolean(
  question?.confirmed
  || normalizeText(question?.selectedOptionValue)
  || normalizeText(question?.answerSummary)
  || normalizeText(question?.answerDetail)
  || (
    Array.isArray(question?.options)
    && question.options.some(option => option?.selected)
  ),
)

const pushIssue = (
  issues: UnifiedFlowIssue[],
  issue: UnifiedFlowIssue,
  usedKeys: Set<string>,
) => {
  const key = `${issue.sourceStage}:${issue.issueId}:${issue.userMessage}`
  if (usedKeys.has(key)) {
    return
  }
  usedKeys.add(key)
  issues.push(issue)
}

const isInteractiveIssueQuestion = (issue: UnifiedFlowIssue) => {
  const question = issue.questionPayload
  if (!question || question.questionKind === 'note_only') {
    return false
  }
  return Boolean(
    question.options?.length
    || question.questionKind === 'binary'
    || question.allowFreeText,
  )
}

const getIssueMergeScore = (issue: UnifiedFlowIssue) => (
  (isInteractiveIssueQuestion(issue) ? 100 : 0)
  + (issue.userActionRequired ? 10 : 0)
  + (issue.questionPayload?.questionKind === 'single_select' ? 5 : 0)
)

const mergeIssueDiagnostics = (
  primary?: UnifiedFlowIssueDiagnostic[],
  secondary?: UnifiedFlowIssueDiagnostic[],
) => {
  const result: UnifiedFlowIssueDiagnostic[] = []
  const seen = new Set<string>()
  ;[...(primary || []), ...(secondary || [])].forEach((diagnostic) => {
    const key = JSON.stringify(diagnostic)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(diagnostic)
  })
  return result.length ? result : undefined
}

const mergeIssueScope = (
  primary?: UnifiedFlowIssueScope,
  secondary?: UnifiedFlowIssueScope,
): UnifiedFlowIssueScope | undefined => {
  if (!primary) {
    return secondary
  }
  if (!secondary) {
    return primary
  }
  return {
    ...secondary,
    ...primary,
    kind: primary.kind || secondary.kind,
    key: primary.key || secondary.key,
    title: primary.title || secondary.title,
    targetId: primary.targetId || secondary.targetId,
    targetLabel: primary.targetLabel || secondary.targetLabel,
  }
}

// 同一决策点可能同时由模型问题（带选项）和系统依赖（带诊断）表达。
// 合并时保留可交互题面，聚合全部诊断，避免同一决策在卡片里出现两次。
export const mergeUnifiedFlowIssuesByDecisionPoint = (
  issues: UnifiedFlowIssue[],
): UnifiedFlowIssue[] => {
  const result: UnifiedFlowIssue[] = []
  const indexByKey = new Map<string, number>()

  issues.forEach((issue) => {
    const decisionPointKey = normalizeText(issue.decisionPointKey)
    if (!decisionPointKey || issue.category === 'system_error') {
      result.push(issue)
      return
    }
    const existingIndex = indexByKey.get(decisionPointKey)
    if (existingIndex == null) {
      indexByKey.set(decisionPointKey, result.length)
      result.push(issue)
      return
    }

    const existing = result[existingIndex]
    const primary = getIssueMergeScore(issue) > getIssueMergeScore(existing)
      ? issue
      : existing
    const secondary = primary === issue ? existing : issue
    result[existingIndex] = {
      ...secondary,
      ...primary,
      decisionPointKey,
      severity: existing.severity === 'blocking' || issue.severity === 'blocking'
        ? 'blocking'
        : 'warning',
      userActionRequired: existing.userActionRequired || issue.userActionRequired,
      planningContextKey: primary.planningContextKey || secondary.planningContextKey,
      returnToStage: primary.returnToStage ?? secondary.returnToStage,
      blockedNextAction: primary.blockedNextAction ?? secondary.blockedNextAction,
      userMessage: primary.userMessage || secondary.userMessage,
      questionPayload: primary.questionPayload || secondary.questionPayload,
      scope: mergeIssueScope(primary.scope, secondary.scope),
      diagnostics: mergeIssueDiagnostics(primary.diagnostics, secondary.diagnostics),
    }
  })

  return result
}

const findConfirmationQuestionForOpenQuestion = (
  openQuestion: NocodeEditorFlowSchemeQuestion,
  questions: NocodeEditorAiConfirmQuestion[],
) => {
  const key = normalizeText(openQuestion.key)
  const title = normalizeText(openQuestion.title)
  const pendingQuestions = questions.filter(question => !hasResolvedQuestionAnswer(question))
  return pendingQuestions.find(question => normalizeText(question.decisionKey) === key)
    || pendingQuestions.find(question => (
      !normalizeText(question.decisionKey)
      && normalizeText(question.id) === key
    ))
    || pendingQuestions.find(question => (
      !normalizeText(question.decisionKey)
      && normalizeText(question.title) === title
    ))
    || null
}

const resolveFlowSchemeQuestionIssueScope = (input: {
  question: NocodeEditorFlowSchemeQuestion
  questionPayload?: NocodeEditorAiConfirmQuestion | null
}): UnifiedFlowIssueScope => {
  const decisionScope = input.questionPayload?.decisionScope
  if (decisionScope?.kind === 'step' || decisionScope?.kind === 'object') {
    return { kind: 'step', key: normalizeText(decisionScope.id) || undefined }
  }
  if (decisionScope?.kind === 'branch' || decisionScope?.kind === 'path') {
    return { kind: 'branch', key: normalizeText(decisionScope.id) || undefined }
  }
  if (decisionScope?.kind === 'flow') {
    return { kind: 'global' }
  }
  if (
    input.questionPayload?.scopeKind === 'trigger-branch'
    && normalizeText(input.questionPayload.branchKey)
  ) {
    return { kind: 'branch', key: normalizeText(input.questionPayload.branchKey) }
  }
  return {
    kind: input.question.scopeKind || 'global',
    key: normalizeText(input.question.scopeKey) || undefined,
  }
}

const buildFlowSchemeQuestionIssue = (input: {
  question: NocodeEditorFlowSchemeQuestion
  questionPayload?: NocodeEditorAiConfirmQuestion | null
  decisionPointKey?: string
  index: number
  planningContextKey?: string
  userMessage?: string
}): UnifiedFlowIssue => {
  const issueId = normalizeText(input.question.key) || `flow-scheme-question-${input.index + 1}`
  const title = normalizeText(input.question.title) || '流程方案还需要补充确认'
  const reason = normalizeText(input.question.reason) || title
  const questionPayload = input.questionPayload || buildNoteOnlyQuestionPayload({
    id: issueId,
    title,
    description: reason,
  })

  return {
    issueId,
    ...(normalizeText(input.decisionPointKey)
      ? { decisionPointKey: normalizeText(input.decisionPointKey) }
      : {}),
    sourceStage: 'flow-scheme',
    category: 'business_gap',
    severity: 'blocking',
    userActionRequired: true,
    planningContextKey: normalizeText(input.planningContextKey) || undefined,
    returnToStage: 'flow-scheme',
    blockedNextAction: null,
    userMessage: normalizeText(input.userMessage) || reason,
    questionPayload,
    scope: resolveFlowSchemeQuestionIssueScope({
      question: input.question,
      questionPayload: input.questionPayload,
    }),
    diagnostics: [{
      code: issueId,
      message: reason,
      kind: 'open_question',
    }],
  }
}

const resolveDependencyIssueCategory = (
  dependency: NocodeEditorFlowSchemeDependency,
): UnifiedFlowIssueCategory => {
  if (
    dependency.requiredFor === 'source_mapping'
    || dependency.kind === 'source_table_missing'
    || dependency.kind === 'mapping_conflict'
  ) {
    return 'mapping_gap'
  }
  return 'config_gap'
}

const isUnresolvedApprovalOwnerPersonnelDependency = (
  dependency: NocodeEditorFlowSchemeDependency,
) => Boolean(
  normalizeText(dependency.id).startsWith('flow-personnel:')
  && dependency.kind === 'org_anchor_missing'
  && dependency.requiredFor === 'approval_owner'
  && dependency.scopeKind === 'step'
  && normalizeText(dependency.scopeKey)
  && dependency.resolutionStatus !== 'resolved',
)

const isUnresolvedApprovalOwnerSourcePersonnelDependency = (
  dependency: NocodeEditorFlowSchemeDependency,
) => Boolean(
  isUnresolvedApprovalOwnerPersonnelDependency(dependency)
  && normalizeText(dependency.id).endsWith(':source'),
)

const isUnresolvedApprovalOwnerFallbackPersonnelDependency = (
  dependency: NocodeEditorFlowSchemeDependency,
) => Boolean(
  isUnresolvedApprovalOwnerPersonnelDependency(dependency)
  && normalizeText(dependency.id).endsWith(':fallback'),
)

// 层级题的答案空间是“方向 + 级数”，不给出取值说明与可照抄示例时，
// 用户面对“XX 尚未确定”这类循环描述无从填写。
const NOCODE_EDITOR_FLOW_DEPARTMENT_MANAGER_LEVEL_DESCRIPTION = '请补充取哪一级部门主管：「向上」从直属部门主管逐级向上，「向下」从最高部门主管逐级向下。例如：向上 1 级（直属部门主管）。'

const resolveApprovalOwnerFallbackDecisionKey = (
  dependency: NocodeEditorFlowSchemeDependency,
) => {
  const stepKey = normalizeText(dependency.scopeKey)
  return isUnresolvedApprovalOwnerFallbackPersonnelDependency(dependency) && stepKey
    ? `flow.approval.owner.empty_handler.${stepKey}`
    : ''
}

const resolveApprovalOwnerFallbackQuestionIdentityKeys = (
  dependencies: NocodeEditorFlowSchemeDependency[],
) => new Set(dependencies.flatMap((dependency) => {
  const decisionKey = resolveApprovalOwnerFallbackDecisionKey(dependency)
  if (!decisionKey) {
    return []
  }
  return [normalizeText(dependency.id), decisionKey].filter(Boolean)
}))

const buildDependencyIssue = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  steps?: FlowDecisionStepLookup
  index: number
  planningContextKey?: string
  userMessage?: string
}): UnifiedFlowIssue | null => {
  if (input.dependency.resolutionStatus === 'resolved') {
    return null
  }

  const issueId = normalizeText(input.dependency.id) || `flow-scheme-dependency-${input.index + 1}`
  const title = normalizeText(input.dependency.summary) || '流程依赖还需要补充确认'
  const nodeTitle = normalizeText(input.dependency.scopeTitle)
  const personnelDecision = resolveFlowDependencyPersonnelDecision(input.dependency)
  const personnelSlot = personnelDecision?.slot
  const asksForPersonnelSource = personnelSlot === 'source' && Boolean(nodeTitle)
  const asksForLevel = personnelSlot === 'approval_level'
  const fallbackDecisionKey = resolveApprovalOwnerFallbackDecisionKey(input.dependency)
  const asksForFallback = personnelSlot === 'empty_handler' || Boolean(fallbackDecisionKey)
  const sourceRoleLabel = input.dependency.requiredFor === 'approval_owner'
    ? '审批人'
    : input.dependency.requiredFor === 'notify_target' ? '通知对象' : '人员'
  const questionTitle = asksForFallback
    ? `“${nodeTitle || '该节点'}”的${sourceRoleLabel}为空时如何处理？`
    : asksForPersonnelSource
      ? `如何确定“${nodeTitle}”的${sourceRoleLabel}？`
      : asksForLevel
        ? `“${nodeTitle || '该节点'}”的${sourceRoleLabel}取哪一级部门主管？`
        : title
  const questionDescription = asksForFallback
    ? input.dependency.requiredFor === 'approval_owner'
      ? NOCODE_EDITOR_FLOW_APPROVAL_OWNER_EMPTY_HANDLER_DESCRIPTION
      : '请选择该节点人员为空时的处理策略：不设置兜底处理、自动转交管理员或由指定人员处理。'
    : asksForPersonnelSource
      ? input.dependency.requiredFor === 'approval_owner'
        ? '请选择该节点的审批人来源。'
        : '请选择该节点的人员来源。'
      : asksForLevel
        ? NOCODE_EDITOR_FLOW_DEPARTMENT_MANAGER_LEVEL_DESCRIPTION
        : `请补充或确认：${title}`
  const questionPayload = asksForPersonnelSource
    ? buildPersonnelSourceQuestionPayload({
      id: issueId,
      decisionKey: input.dependency.requiredFor === 'approval_owner'
        // 来源题按节点区分身份，两个节点需要问来源时才能同轮展示；
        // 没有节点键时退回历史裸键，避免生成无法被收敛识别的空后缀。
        ? buildApprovalOwnerSourceDecisionKey(input.dependency.scopeKey)
        : normalizeText(input.dependency.decisionKey) || `flow.personnel:${normalizeText(input.dependency.scopeKey)}:source`,
      title: questionTitle,
      description: questionDescription,
      stepKey: normalizeText(input.dependency.scopeKey),
    })
    : asksForLevel
      ? buildDepartmentManagerLevelQuestionPayload({
        id: issueId,
        decisionKey: normalizeText(input.dependency.decisionKey) || fallbackDecisionKey,
        title: questionTitle,
        description: questionDescription,
        stepKey: normalizeText(input.dependency.scopeKey),
        stepKind: input.steps?.get(normalizeText(input.dependency.scopeKey))?.kind,
      })
      : buildNoteOnlyQuestionPayload({
        id: issueId,
        decisionKey: normalizeText(input.dependency.decisionKey) || fallbackDecisionKey,
        title: questionTitle,
        description: questionDescription,
      })
  const decisionPointKey = resolveFlowDependencyDecisionPointRef(
    input.dependency,
    input.steps,
  )?.key
  return {
    issueId,
    ...(decisionPointKey ? { decisionPointKey } : {}),
    sourceStage: 'flow-scheme',
    category: resolveDependencyIssueCategory(input.dependency),
    severity: 'blocking',
    userActionRequired: true,
    planningContextKey: normalizeText(input.planningContextKey) || undefined,
    returnToStage: 'flow-scheme',
    blockedNextAction: null,
    userMessage: normalizeText(input.userMessage) || questionTitle,
    questionPayload,
    scope: {
      kind: input.dependency.scopeKind,
      key: normalizeText(input.dependency.scopeKey) || undefined,
      title: normalizeText(input.dependency.scopeTitle) || undefined,
    },
    diagnostics: [{
      ...input.dependency,
      code: input.dependency.kind,
      message: title,
    }],
  }
}

const isPersonnelDependencyFallbackQuestion = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  question: NocodeEditorFlowSchemeQuestion
  questionPayload?: NocodeEditorAiConfirmQuestion | null
}) => {
  const dependencyId = normalizeText(input.dependency.id)
  if (normalizeText(input.question.key) === dependencyId) {
    return true
  }

  const questionText = [
    normalizeText(input.question.title),
    normalizeText(input.question.reason),
    normalizeText(input.questionPayload?.title),
    normalizeText(input.questionPayload?.description),
  ].filter(Boolean).join(' ')
  if (!/人员来源.{0,8}(?:尚未确定|未确定|待确定|不明确|待明确)/u.test(questionText)) {
    return false
  }

  const scopeTitle = normalizeText(input.dependency.scopeTitle)
  return !scopeTitle || questionText.includes(scopeTitle)
}

const resolveCoveredPersonnelQuestionKeys = (input: {
  dependencies: NocodeEditorFlowSchemeDependency[]
  openQuestions: NocodeEditorFlowSchemeQuestion[]
  confirmationQuestions: NocodeEditorAiConfirmQuestion[]
}) => new Set(input.dependencies.flatMap((dependency) => {
  if (!isUnresolvedApprovalOwnerSourcePersonnelDependency(dependency)) {
    return []
  }

  const dependencyId = normalizeText(dependency.id)
  const dependencyScopeKey = normalizeText(dependency.scopeKey)
  const scopedQuestions = input.openQuestions
    .filter(question => (
      question.scopeKind === 'global'
      || (
        question.scopeKind === 'step'
        && normalizeText(question.scopeKey) === dependencyScopeKey
      )
    ))
    .map((question) => {
      const questionPayload = findConfirmationQuestionForOpenQuestion(
        question,
        input.confirmationQuestions,
      )
      return {
        question,
        questionPayload,
        isFallback: isPersonnelDependencyFallbackQuestion({
          dependency,
          question,
          questionPayload,
        }),
      }
    })
  const hasCoveringQuestion = scopedQuestions.some(item => (
    !item.isFallback
    && isNocodeEditorFlowApprovalOwnerSourceQuestion(item.questionPayload || item.question)
  ))
  if (!hasCoveringQuestion) {
    return []
  }

  const fallbackQuestionKeys = scopedQuestions
    .filter(item => item.isFallback)
    .map(item => normalizeText(item.question.key))
    .filter(Boolean)
  if (!fallbackQuestionKeys.includes(dependencyId)) {
    fallbackQuestionKeys.push(dependencyId)
  }

  return fallbackQuestionKeys
}))

const isPersonnelDependencyCoveredByPendingQuestion = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  questionIssues: UnifiedFlowIssue[]
}) => {
  if (!isUnresolvedApprovalOwnerSourcePersonnelDependency(input.dependency)) {
    return false
  }

  return input.questionIssues.some(issue => (
    issue.sourceStage === 'flow-scheme'
    && issue.category === 'business_gap'
    && issue.userActionRequired
    && isQuestionScopeCoveringDependency(issue.scope, input.dependency)
    && isNocodeEditorFlowApprovalOwnerSourceQuestion(issue.questionPayload)
  ))
}

export const buildUnifiedFlowIssuesFromDecisionConflicts = (input: {
  conflicts: NocodeEditorConfirmationDecisionConflict[]
  planningContextKey?: string
}): UnifiedFlowIssue[] => input.conflicts.map(conflict => ({
  issueId: `flow-confirmation-decision-conflict:${conflict.decisionKey}`,
  sourceStage: 'flow-scheme',
  category: 'system_error',
  severity: 'blocking',
  userActionRequired: false,
  planningContextKey: normalizeText(input.planningContextKey) || undefined,
  returnToStage: null,
  blockedNextAction: 'editor_stage_flow_blueprint',
  userMessage: '当前流程方案与已确认结论不一致，请基于已确认结论修订方案。',
  questionPayload: null,
  diagnostics: [{
    code: conflict.code,
    message: conflict.questionTitle,
    decisionKey: conflict.decisionKey,
    previousValue: conflict.previousValue,
    proposedValue: conflict.proposedValue,
  }],
}))

// 人员来源题锚定：步骤业务线索（标题/意图/actorHint）或项目证据点名了具体来源时，
// 在题面与对应选项上标注推荐；模型来源题与依赖收敛派生来源题共用同一标注。
const annotatePersonnelSourceQuestionIssues = (input: {
  issues: UnifiedFlowIssue[]
  scheme: NocodeEditorFlowScheme
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): UnifiedFlowIssue[] => input.issues.map((issue) => {
  const question = issue.questionPayload
  if (!question) {
    return issue
  }
  const personnelDecisionSource = question.personnelDecision?.slot === 'source'
  const dependencySource = !personnelDecisionSource
    && normalizeText(issue.diagnostics?.[0]?.kind) === 'org_anchor_missing'
    && normalizeText(issue.issueId).endsWith(':source')
  if (!personnelDecisionSource && !dependencySource) {
    return issue
  }
  const anchor = resolveNocodeEditorFlowPersonnelSourceQuestionAnchor({
    scheme: input.scheme,
    stepKey: question.personnelDecision?.stepKey || issue.scope?.key,
    evidence: input.evidence,
  })
  if (!anchor) {
    return issue
  }
  const annotatedQuestion = annotateNocodeEditorFlowPersonnelSourceQuestion({ question, anchor })
  return annotatedQuestion === question
    ? issue
    : { ...issue, questionPayload: annotatedQuestion }
})

export const buildUnifiedFlowIssuesFromFlowScheme = (
  input: BuildUnifiedFlowIssuesFromFlowSchemeInput,
): UnifiedFlowIssue[] => {
  const scheme = input.scheme || null
  if (!scheme) {
    return []
  }

  const usedKeys = new Set<string>()
  const issues: UnifiedFlowIssue[] = []
  const steps = buildFlowDecisionStepLookup(scheme)
  const confirmationQuestions = Array.isArray(scheme.confirmation?.questions)
    ? scheme.confirmation!.questions
      .map((item, index) => normalizeQuestionPayload(item, index))
      .filter((item): item is NocodeEditorAiConfirmQuestion => Boolean(item))
    : []
  const decisionStates = projectFlowDecisionContract(
    confirmationQuestions,
    scheme.confirmation?.factSnapshot || {},
  ).states
  const openQuestions = Array.isArray(scheme.openQuestions) ? scheme.openQuestions : []
  const dependencies = Array.isArray(scheme.dependencies) ? scheme.dependencies : []
  const coveredPersonnelQuestionKeys = resolveCoveredPersonnelQuestionKeys({
    dependencies,
    openQuestions,
    confirmationQuestions,
  })
  const fallbackQuestionIdentityKeys = resolveApprovalOwnerFallbackQuestionIdentityKeys(
    dependencies,
  )
  const usedQuestionKeys = new Set<string>()

  openQuestions.forEach((question, index) => {
    if (decisionStates?.get(normalizeText(question.key)) === 'inapplicable') return
    const questionPayload = findConfirmationQuestionForOpenQuestion(
      question,
      confirmationQuestions,
    )
    if (
      coveredPersonnelQuestionKeys.has(normalizeText(question.key))
      || fallbackQuestionIdentityKeys.has(normalizeText(question.key))
    ) {
      if (questionPayload) {
        usedQuestionKeys.add(getQuestionKey(questionPayload))
      }
      return
    }
    if (questionPayload) {
      usedQuestionKeys.add(getQuestionKey(questionPayload))
    }
    pushIssue(
      issues,
      buildFlowSchemeQuestionIssue({
        question,
        questionPayload,
        decisionPointKey: resolveFlowQuestionDecisionPointRef({
          question: questionPayload,
          openQuestion: question,
          steps,
        })?.key,
        index,
        planningContextKey: input.planningContextKey || scheme.confirmation?.planningContextKey,
        userMessage: input.userMessage,
      }),
      usedKeys,
    )
  })

  confirmationQuestions.forEach((question, index) => {
    const questionIdentityKey = normalizeText(question.decisionKey)
      || normalizeText(question.id)
    if (decisionStates?.get(questionIdentityKey) === 'inapplicable') return
    if (
      usedQuestionKeys.has(getQuestionKey(question))
      || fallbackQuestionIdentityKeys.has(questionIdentityKey)
      || hasResolvedQuestionAnswer(question)
    ) {
      return
    }
    const questionRecord: NocodeEditorFlowSchemeQuestion = {
      key: normalizeText(question.decisionKey)
        || normalizeText(question.id)
        || `flow-scheme-confirmation-${index + 1}`,
      title: question.title,
      reason: normalizeText(question.description) || question.title,
      scopeKind: question.scopeKind === 'trigger-branch' ? 'branch' : 'global',
      scopeKey: question.branchKey,
    }
    pushIssue(
      issues,
      buildFlowSchemeQuestionIssue({
        question: questionRecord,
        questionPayload: question,
        decisionPointKey: resolveFlowQuestionDecisionPointRef({
          question,
          steps,
        })?.key,
        index,
        planningContextKey: input.planningContextKey || scheme.confirmation?.planningContextKey,
        userMessage: input.userMessage,
      }),
      usedKeys,
    )
  })

  dependencies.forEach((dependency, index) => {
    if (isPersonnelDependencyCoveredByPendingQuestion({ dependency, questionIssues: issues })) {
      return
    }
    const issue = buildDependencyIssue({
      dependency,
      steps,
      index,
      planningContextKey: input.planningContextKey || scheme.confirmation?.planningContextKey,
      userMessage: input.userMessage,
    })
    if (issue) {
      pushIssue(issues, issue, usedKeys)
    }
  })

  return mergeUnifiedFlowIssuesByDecisionPoint(
    annotatePersonnelSourceQuestionIssues({
      issues,
      scheme,
      evidence: input.personnelSourceEvidence || null,
    }),
  )
}

const resolveGroundingIssueCategory = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
): UnifiedFlowIssueCategory => {
  const code = normalizeText(diagnostic.code)
  if (code.includes('source') || code.includes('mapping')) {
    return 'mapping_gap'
  }
  if (code.includes('condition')) {
    return 'business_gap'
  }
  return 'config_gap'
}

const buildGroundingScope = (
  diagnostic?: NocodeEditorFlowSchemeGroundingDiagnostic,
): UnifiedFlowIssueScope | undefined => {
  const nodeKey = normalizeText(diagnostic?.nodeKey)
  const branchKey = normalizeText(diagnostic?.branchKey)
  if (nodeKey) {
    return {
      kind: 'step',
      key: nodeKey,
      title: normalizeText(diagnostic?.nodeName) || undefined,
      targetId: nodeKey,
      targetLabel: normalizeText(diagnostic?.nodeName) || undefined,
    }
  }
  if (branchKey) {
    return {
      kind: 'branch',
      key: branchKey,
      title: normalizeText(diagnostic?.branchLabel) || undefined,
      targetId: branchKey,
      targetLabel: normalizeText(diagnostic?.branchLabel) || undefined,
    }
  }
  return undefined
}

export const buildUnifiedFlowIssuesFromGrounding = (
  input: BuildUnifiedFlowIssuesFromGroundingInput,
): UnifiedFlowIssue[] => input.groups.map((group) => {
  const planningContextKey = normalizeText(input.planningContextKey) || undefined
  const blockedNextAction = normalizeUnifiedFlowIssueBlockedNextAction(input.blockedNextAction)
    || 'editor_stage_flow_blueprint'

  if (group.kind === 'system_error') {
    return {
      issueId: group.key,
      sourceStage: 'flow-plan',
      category: 'system_error',
      severity: 'blocking',
      userActionRequired: false,
      planningContextKey,
      returnToStage: null,
      blockedNextAction,
      userMessage: group.userMessage,
      questionPayload: null,
      diagnostics: group.diagnostics,
    }
  }

  const diagnostic = group.diagnostics[0]
  return {
    issueId: group.key,
    sourceStage: 'flow-plan',
    category: diagnostic ? resolveGroundingIssueCategory(diagnostic) : 'config_gap',
    severity: 'blocking',
    userActionRequired: true,
    planningContextKey,
    returnToStage: 'flow-scheme',
    blockedNextAction,
    userMessage: normalizeText(input.userMessage) || group.question.title,
    questionPayload: group.question,
    scope: group.diagnostics.length === 1 ? buildGroundingScope(diagnostic) : undefined,
    diagnostics: group.diagnostics,
  }
})

export type SchemeRestageBlueprintDiagnosticLike = {
  code?: string
  message?: string
  severity?: string
  routeToScheme?: boolean
  nodeKey?: string
  nodeName?: string
  expectedFieldId?: string
  expectedFieldName?: string
  actualFieldId?: string
  actualFieldName?: string
  compatibleFields?: Array<{ fieldId?: string; fieldName?: string }>
  [key: string]: unknown
}

type BuildUnifiedFlowIssuesFromSchemeRestageDiagnosticsInput = {
  diagnostics: SchemeRestageBlueprintDiagnosticLike[]
  sourceStage: UnifiedFlowIssueSourceStage
  planningContextKey?: string
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | string | null
}

const SCHEME_RESTAGE_OWNER_FIELD_CODES = new Set([
  'blueprint_approval_owner_existing_field_invalid',
  'approval_owner_existing_field_invalid',
])

const isSchemeRestageOwnerFieldCode = (code: string) => (
  SCHEME_RESTAGE_OWNER_FIELD_CODES.has(code)
)

const isSchemeRestageTargetContextCode = (code: string) => (
  code.endsWith('target_context_mismatch')
)

const buildSchemeRestageCompatibleFieldOptions = (value: unknown) => (
  (Array.isArray(value) ? value : []).flatMap((field) => {
    if (!isRecord(field)) {
      return []
    }
    const fieldId = normalizeText(field.fieldId)
    const fieldName = normalizeText(field.fieldName)
    return fieldId && fieldName
      ? [{
        value: `use-existing-owner-field:${fieldId}`,
        label: `使用现有成员字段（${fieldName}）`,
        description: '复用该表单成员字段作为审批人来源。',
      }]
      : []
  }).slice(0, 6)
)

export const FLOW_APPROVAL_OWNER_FIELD_REF_QUESTION_KEY_PREFIX = 'flow.approval.owner.field_ref.'
export const FLOW_APPROVAL_OWNER_SOURCE_ESCAPE_OPTION_VALUE = 'choose-another-owner-source'

const buildSchemeRestageOwnerFieldQuestion = (input: {
  diagnostic: SchemeRestageBlueprintDiagnosticLike
  index: number
}): NocodeEditorAiConfirmQuestion => {
  const stepKey = normalizeText(input.diagnostic.nodeKey) || `step-${input.index + 1}`
  const id = `${FLOW_APPROVAL_OWNER_FIELD_REF_QUESTION_KEY_PREFIX}${stepKey}`
  const compatibleFieldOptions = buildSchemeRestageCompatibleFieldOptions(
    input.diagnostic.compatibleFields,
  )
  return {
    id,
    decisionKey: id,
    title: '重新确认审批人字段绑定',
    description: compatibleFieldOptions.length
      ? '当前审批人绑定与表单字段证据不一致，请重新选择该节点的审批人来源。'
      : '当前审批人绑定与表单字段证据不一致，请重新确认该节点的审批人来源（现有成员字段、新增成员字段或其他固定人员）。',
    questionKind: compatibleFieldOptions.length ? 'single_select' : 'note_only',
    scopeKind: 'overview',
    required: true,
    allowFreeText: true,
    options: compatibleFieldOptions.length
      ? [
        ...compatibleFieldOptions,
        {
          value: FLOW_APPROVAL_OWNER_SOURCE_ESCAPE_OPTION_VALUE,
          label: '改用其他审批人来源',
          description: '改用新增成员字段、固定人员或其他可用的审批人来源。',
        },
      ]
      : undefined,
  }
}

const buildSchemeRestageNoteQuestion = (input: {
  diagnostic: SchemeRestageBlueprintDiagnosticLike
  index: number
  idPrefix: string
  fallbackTitle: string
  fallbackDescription: string
}): NocodeEditorAiConfirmQuestion => {
  const nodeKey = normalizeText(input.diagnostic.nodeKey)
  return buildNoteOnlyQuestionPayload({
    id: `${input.idPrefix}-${nodeKey || input.index + 1}`,
    title: input.fallbackTitle,
    description: normalizeText(input.diagnostic.message) || input.fallbackDescription,
  })
}

export const buildUnifiedFlowIssuesFromSchemeRestageDiagnostics = (
  input: BuildUnifiedFlowIssuesFromSchemeRestageDiagnosticsInput,
): UnifiedFlowIssue[] => {
  const planningContextKey = normalizeText(input.planningContextKey) || undefined
  const blockedNextAction = normalizeUnifiedFlowIssueBlockedNextAction(input.blockedNextAction)
    || 'editor_stage_flow_blueprint'
  return (Array.isArray(input.diagnostics) ? input.diagnostics : []).map((diagnostic, index) => {
    const code = normalizeText(diagnostic.code) || 'flow_scheme_restage_required'
    const nodeKey = normalizeText(diagnostic.nodeKey) || undefined
    const nodeName = normalizeText(diagnostic.nodeName) || undefined
    const questionPayload = isSchemeRestageOwnerFieldCode(code)
      ? buildSchemeRestageOwnerFieldQuestion({ diagnostic, index })
      : isSchemeRestageTargetContextCode(code)
        ? buildSchemeRestageNoteQuestion({
          diagnostic,
          index,
          idPrefix: 'flow-scheme-restage-target-context',
          fallbackTitle: '重新确认流程目标表单',
          fallbackDescription: '当前表单证据与流程方案的目标表单不一致，请重新确认目标表单后再继续。',
        })
        : buildSchemeRestageNoteQuestion({
          diagnostic,
          index,
          idPrefix: 'flow-scheme-restage-personnel-field',
          fallbackTitle: '重新确认人员字段绑定',
          fallbackDescription: '当前人员字段绑定与表单字段证据不一致，请重新确认后再继续。',
        })
    const userMessage = normalizeText(diagnostic.message)
      || normalizeText(questionPayload.description)
      || questionPayload.title
    return {
      issueId: `flow-scheme-restage:${code}:${nodeKey || index + 1}`,
      sourceStage: input.sourceStage,
      category: 'business_gap' as const,
      severity: 'blocking' as const,
      userActionRequired: true,
      planningContextKey,
      returnToStage: 'flow-scheme' as const,
      blockedNextAction,
      userMessage,
      questionPayload,
      scope: nodeKey
        ? { kind: 'step' as const, key: nodeKey, title: nodeName }
        : undefined,
      diagnostics: [{ ...diagnostic, code, requiresSchemeRestage: true }],
    }
  })
}

const normalizeFlowIssueResolution = (
  value: unknown,
): FlowIssueStateResolutionLike | null => (
  isRecord(value) ? value as FlowIssueStateResolutionLike : null
)

const buildRuntimeQuestionPayload = (input: {
  issue: FlowActionIssueLike
  resolution: FlowIssueStateResolutionLike
  index: number
}): NocodeEditorAiConfirmQuestion | null => {
  const explicitQuestion = normalizeQuestionPayload(input.resolution.questionPayload, input.index)
  if (explicitQuestion) {
    return explicitQuestion
  }

  const title = normalizeText(input.resolution.questionTitle)
    || normalizeText(input.issue.displayMessage)
    || normalizeText(input.issue.message)
    || '流程运行配置需要补充'
  const issueId = normalizeText(input.issue.id)
    || normalizeText(input.issue.code)
    || `runtime-flow-issue-${input.index + 1}`
  return {
    ...buildNoteOnlyQuestionPayload({
      id: issueId,
      title,
      description: normalizeText(input.resolution.questionDescription)
        || normalizeText(input.issue.message)
        || title,
    }),
    questionKind: normalizeQuestionKind(input.resolution.questionKind) || 'note_only',
  }
}

export const buildUnifiedFlowIssuesFromFlowIssueState = (
  input: BuildUnifiedFlowIssuesFromFlowIssueStateInput,
): UnifiedFlowIssue[] => {
  const actionIssues = Array.isArray(input.flowIssueState?.actionIssues)
    ? input.flowIssueState!.actionIssues
    : []
  const issueResolutions = isRecord(input.issueResolutions) ? input.issueResolutions : {}

  return actionIssues.map((issue, index) => {
    const code = normalizeText(issue.code) || `runtime_flow_issue_${index + 1}`
    const resolution = normalizeFlowIssueResolution(issueResolutions[code])
    const userActionRequired = resolution?.userActionRequired === true
    const questionPayload = userActionRequired && resolution
      ? buildRuntimeQuestionPayload({ issue, resolution, index })
      : null
    const message = normalizeText(issue.displayMessage)
      || normalizeText(issue.message)
      || normalizeText(issue.targetLabel)
      || '流程配置问题'

    return {
      issueId: normalizeText(issue.id) || code,
      sourceStage: normalizeSourceStage(input.sourceStage || 'runtime'),
      category: normalizeIssueCategory(resolution?.category, 'config_gap'),
      severity: 'blocking',
      userActionRequired,
      planningContextKey: normalizeText(input.planningContextKey) || undefined,
      returnToStage: userActionRequired
        ? normalizeReturnToStage(resolution?.returnToStage || 'flow-scheme')
        : null,
      blockedNextAction: normalizeUnifiedFlowIssueBlockedNextAction(input.blockedNextAction),
      userMessage: normalizeText(resolution?.userMessage)
        || normalizeText(input.userMessage)
        || normalizeText(input.flowIssueState?.summary)
        || message,
      questionPayload,
      scope: {
        kind: 'process_node',
        key: normalizeText(issue.targetId) || undefined,
        title: normalizeText(issue.targetLabel) || undefined,
        targetId: normalizeText(issue.targetId) || undefined,
        targetLabel: normalizeText(issue.targetLabel) || undefined,
      },
      diagnostics: [{
        ...issue,
        code,
        message: normalizeText(issue.message) || message,
      }],
    }
  })
}

export const buildUnifiedFlowIssuesFromExecutionBlocker = (
  input: BuildUnifiedFlowIssuesFromExecutionBlockerInput,
): UnifiedFlowIssue[] => {
  const issueId = normalizeText(input.issueId)
  const message = normalizeText(input.message)
    || normalizeText(input.userMessage)
    || '当前环境阻塞流程继续执行。'
  if (!issueId && !message) {
    return []
  }

  return [{
    issueId: issueId || 'flow-execution-blocker',
    sourceStage: normalizeSourceStage(input.sourceStage),
    category: 'environment_blocker',
    severity: 'blocking',
    userActionRequired: false,
    planningContextKey: normalizeText(input.planningContextKey) || undefined,
    returnToStage: null,
    blockedNextAction: normalizeUnifiedFlowIssueBlockedNextAction(input.blockedNextAction),
    userMessage: normalizeText(input.userMessage)
      || normalizeText(input.title)
      || message,
    questionPayload: null,
    diagnostics: input.diagnostics?.length
      ? input.diagnostics
      : [{
        code: normalizeText(input.code) || issueId || 'flow_execution_blocker',
        message,
        ...(normalizeText(input.path) ? { path: normalizeText(input.path) } : {}),
      }],
  }]
}

// 只有“缺前置”语义，不是待确认问题；用于投影与渲染两侧统一识别。
export const isFlowSchemePrerequisiteMissingIssue = (
  issue?: Pick<UnifiedFlowIssue, 'issueId' | 'diagnostics'> | null,
) => {
  if (!issue) {
    return false
  }
  if (normalizeText(issue.issueId) === 'flow-scheme-not-ready-for-blueprint') {
    return true
  }
  return (Array.isArray(issue.diagnostics) ? issue.diagnostics : []).some(item => (
    normalizeText(item?.code) === 'flow_scheme_not_ready_for_blueprint'
  ))
}

// 无方案 / 无 confirmation 时暂存或应用蓝图：这是“缺少前置”，不是“待确认问题”。
// 不能生成 note_only 问题，否则渲染端会得到一张没有选项、永远无法完成的确认卡。
export const buildUnifiedFlowIssuesFromFlowSchemeNotReady = (input: {
  planningContextKey?: string
  blockedNextAction?: UnifiedFlowIssueBlockedNextAction | string | null
  userMessage?: string
}): UnifiedFlowIssue[] => {
  const message = normalizeText(input.userMessage)
    || '流程方案尚未生成或确认，请先生成并确认流程方案，再继续流程蓝图。'
  return [{
    issueId: 'flow-scheme-not-ready-for-blueprint',
    sourceStage: 'flow-plan',
    category: 'business_gap',
    severity: 'blocking',
    userActionRequired: true,
    planningContextKey: normalizeText(input.planningContextKey) || undefined,
    returnToStage: 'flow-scheme',
    blockedNextAction: normalizeUnifiedFlowIssueBlockedNextAction(input.blockedNextAction)
      || 'editor_stage_flow_blueprint',
    userMessage: message,
    questionPayload: null,
    diagnostics: [{ code: 'flow_scheme_not_ready_for_blueprint', message }],
  }]
}

const buildLegacyScope = (
  value: UnknownRecord,
): UnifiedFlowIssueScope | undefined => {
  const metadata = isRecord(value.metadata) ? value.metadata : {}
  const dependency = isRecord(metadata.dependency) ? metadata.dependency : {}
  const actionIssue = isRecord(metadata.actionIssue) ? metadata.actionIssue : {}
  return normalizeScope(value.scope) || normalizeScope({
    kind: metadata.scopeKind || dependency.scopeKind,
    key: metadata.scopeKey || dependency.scopeKey || value.targetId || actionIssue.targetId,
    title: metadata.scopeTitle || dependency.scopeTitle || value.targetLabel || actionIssue.targetLabel,
    targetId: value.targetId || actionIssue.targetId,
    targetLabel: value.targetLabel || actionIssue.targetLabel,
  })
}

const buildLegacyDiagnostics = (
  value: UnknownRecord,
): UnifiedFlowIssueDiagnostic[] => {
  const diagnostics = normalizeDiagnostics(value.diagnostics)
  if (diagnostics.length) {
    return diagnostics
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {}
  const metadataDiagnostics = [
    ...normalizeDiagnostics(metadata.diagnostic),
    ...normalizeDiagnostics(metadata.dependency),
    ...normalizeDiagnostics(metadata.actionIssue),
  ]
  if (metadataDiagnostics.length) {
    return metadataDiagnostics
  }

  const code = normalizeText(value.code)
  const message = normalizeText(value.message || value.title || value.userMessage)
  return code || message ? [{ code, message }] : []
}

const resolveStoredIssueDecisionPointKey = (input: {
  value: UnknownRecord
  questionPayload?: NocodeEditorAiConfirmQuestion | null
  diagnostics: UnifiedFlowIssueDiagnostic[]
}) => {
  const explicitKey = normalizeText(input.value.decisionPointKey)
  if (explicitKey) {
    return explicitKey
  }
  const questionRef = input.questionPayload
    ? resolveFlowQuestionDecisionPointRef({
      question: input.questionPayload,
    })
    : null
  if (questionRef?.kind === 'personnel') {
    return questionRef.key
  }
  const dependencyDiagnostic = input.diagnostics.find(item => (
    isRecord(item) && normalizeText(item.id).startsWith('flow-personnel:')
  ))
  if (dependencyDiagnostic) {
    const dependencyRef = resolveFlowDependencyDecisionPointRef(
      dependencyDiagnostic as unknown as NocodeEditorFlowSchemeDependency,
    )
    if (dependencyRef?.kind === 'personnel') {
      return dependencyRef.key
    }
  }
  return questionRef?.key
}

const normalizeUnifiedFlowIssue = (
  value: unknown,
  index: number,
): UnifiedFlowIssue | null => {
  if (!isRecord(value)) {
    return null
  }

  const questionPayload = normalizeQuestionPayload(value.questionPayload, index)
  const issueId = normalizeText(value.issueId)
    || normalizeText(value.id)
    || normalizeText(value.code)
    || normalizeText(questionPayload?.id)
    || `unified-flow-issue-${index + 1}`
  const userMessage = normalizeText(value.userMessage)
    || normalizeText(value.message)
    || normalizeText(value.title)
    || normalizeText(questionPayload?.title)
  if (!userMessage) {
    return null
  }

  const legacyBlocking = value.blocking === false ? 'warning' : 'blocking'
  const diagnostics = buildLegacyDiagnostics(value)
  const decisionPointKey = resolveStoredIssueDecisionPointKey({
    value,
    questionPayload,
    diagnostics,
  })

  return {
    issueId,
    ...(decisionPointKey ? { decisionPointKey } : {}),
    sourceStage: normalizeSourceStage(value.sourceStage),
    category: normalizeIssueCategory(value.category),
    severity: normalizeIssueSeverity(value.severity, legacyBlocking),
    userActionRequired: value.userActionRequired === true,
    planningContextKey: normalizeText(value.planningContextKey) || undefined,
    returnToStage: normalizeReturnToStage(value.returnToStage),
    blockedNextAction: normalizeUnifiedFlowIssueBlockedNextAction(value.blockedNextAction),
    userMessage,
    questionPayload: questionPayload || undefined,
    scope: buildLegacyScope(value),
    diagnostics: diagnostics.length ? diagnostics : undefined,
  }
}

const resolveUnifiedFlowIssueSource = (
  value: unknown,
) => {
  if (Array.isArray(value)) {
    return value
  }
  if (!isRecord(value)) {
    return []
  }
  if (Array.isArray(value.issues)) {
    return value.issues
  }
  if (Array.isArray(value.activeIssues)) {
    return value.activeIssues
  }
  return []
}

export const normalizeUnifiedFlowIssues = (
  value: unknown,
): UnifiedFlowIssue[] => {
  const source = resolveUnifiedFlowIssueSource(value)
  const usedKeys = new Set<string>()
  const issues: UnifiedFlowIssue[] = []

  source.forEach((item, index) => {
    const issue = normalizeUnifiedFlowIssue(item, index)
    if (issue) {
      pushIssue(issues, issue, usedKeys)
    }
  })

  return mergeUnifiedFlowIssuesByDecisionPoint(issues)
}
