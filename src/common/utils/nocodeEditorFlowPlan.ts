import {
  DataChangeType,
  type ConditionBranchConditionGroup,
} from '@common/types/project'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from './nocodeEditorConfirmationNormalization'
import i18next from 'i18next'
import {
  filterPendingNocodeEditorFlowConfirmationQuestions,
  filterPendingNocodeEditorFlowQuestionTitles,
} from './nocodeEditorFlowQuestionPolicy'

export type NocodeEditorFlowPlanNodeType =
  | 'trigger-data-change'
  | 'trigger-time-task'
  | 'trigger-operation'
  | 'approval'
  | 'transact'
  | 'notify'
  | 'report-data'
  | 'add-data'
  | 'edit-data'
  | 'delete-data'
  | 'condition-branch'
  | 'parallel-branch'

export type NocodeEditorFlowPlanTriggerNodeType = Extract<
  NocodeEditorFlowPlanNodeType,
  'trigger-data-change' | 'trigger-time-task' | 'trigger-operation'
>

export type NocodeEditorFlowPlanNodeCategory =
  | 'trigger'
  | 'human'
  | 'cross-table'
  | 'branch'

export type NocodeEditorFlowPlanBranch = {
  branchKey?: string
  label?: string
  conditions?: ConditionBranchConditionGroup[]
  nodes: NocodeEditorFlowPlanNode[]
}

export type NocodeEditorFlowPlanNode = {
  nodeKey?: string
  type: NocodeEditorFlowPlanNodeType
  name?: string
  options?: Record<string, unknown> | null
  branches?: NocodeEditorFlowPlanBranch[]
}

export type NocodeEditorFlowPlanTriggerNode = Omit<NocodeEditorFlowPlanNode, 'type'> & {
  type: NocodeEditorFlowPlanTriggerNodeType
}

export type NocodeEditorFlowPlanTriggerBranch = {
  branchKey?: string
  label?: string
  triggerNode: NocodeEditorFlowPlanTriggerNode
  nodes: NocodeEditorFlowPlanNode[]
}

export type NocodeEditorFlowPlanDiagnosticLevel =
  | 'error'
  | 'warning'

export type NocodeEditorFlowPlanDiagnostic = {
  id: string
  code: string
  level: NocodeEditorFlowPlanDiagnosticLevel
  message: string
  location?: string
  nodeKey?: string
  nodeName?: string
  nodeType?: NocodeEditorFlowPlanNodeType
  fieldKey?: string
  fieldLabel?: string
  scopeKind?: 'overview' | 'trigger-branch'
  branchKey?: string
  branchLabel?: string
}

export type NocodeEditorFlowPlan = {
  id?: string
  title: string
  summary: string
  target?: {
    formId?: string
    formName?: string
  } | null
  triggerBranches: NocodeEditorFlowPlanTriggerBranch[]
  openQuestions: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
}

type UnknownRecord = Record<string, unknown>

const FLOW_PLAN_NODE_TYPES = new Set<NocodeEditorFlowPlanNodeType>([
  'trigger-data-change',
  'trigger-time-task',
  'trigger-operation',
  'approval',
  'transact',
  'notify',
  'report-data',
  'add-data',
  'edit-data',
  'delete-data',
  'condition-branch',
  'parallel-branch',
])

export const NOCODE_EDITOR_FLOW_DATA_CHANGE_TYPES: ReadonlySet<DataChangeType> = new Set([
  DataChangeType.ADD,
  DataChangeType.EDIT,
  DataChangeType.DELETE,
])

export const isNocodeEditorFlowDataChangeType = (
  value: unknown,
): value is DataChangeType => (
  NOCODE_EDITOR_FLOW_DATA_CHANGE_TYPES.has(value as DataChangeType)
)

const LEGACY_FLOW_PLAN_NODE_TYPE_ALIASES: Record<string, NocodeEditorFlowPlanNodeType> = {
  'trigger-manual': 'trigger-data-change',
}

const FLOW_PLAN_CONFIRMATION_QUESTION_ID_ALIASES: Record<string, string> = {
  q_reject_status: 'q_reject_handling',
  q_reject_status_high: 'q_reject_handling',
  q_finance_assignee_source: 'q_finance_empty_handler',
}

const FLOW_PLAN_APPROVAL_RESULT_FIELD_TOKENS = new Set([
  '审批结果',
  '审批状态',
  '审核结果',
  '结果状态',
  'result',
  'status',
].map(item => normalizeFlowPlanToken(item)))

export const NOCODE_EDITOR_FLOW_PLAN_NODE_CATEGORY_MAP: Record<NocodeEditorFlowPlanNodeType, NocodeEditorFlowPlanNodeCategory> = {
  'trigger-data-change': 'trigger',
  'trigger-time-task': 'trigger',
  'trigger-operation': 'trigger',
  approval: 'human',
  transact: 'human',
  notify: 'human',
  'report-data': 'human',
  'add-data': 'cross-table',
  'edit-data': 'cross-table',
  'delete-data': 'cross-table',
  'condition-branch': 'branch',
  'parallel-branch': 'branch',
}

export const NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP: Record<NocodeEditorFlowPlanNodeType, string> = {
  get 'trigger-data-change'() { return i18next.t('nocodeEditorFlowPlan.dataChangeTrigger') },
  get 'trigger-time-task'() { return i18next.t('nocodeEditorFlowPlan.scheduledTrigger') },
  get 'trigger-operation'() { return i18next.t('nocodeEditorFlowPlan.operationTrigger') },
  get approval() { return i18next.t('nocodeEditorFlowPlan.approvalNode') },
  get transact() { return i18next.t('nocodeEditorFlowPlan.processingNode') },
  get notify() { return i18next.t('nocodeEditorFlowPlan.ccNode') },
  get 'report-data'() { return i18next.t('nocodeEditorFlowPlan.dataEntryNode') },
  get 'add-data'() { return i18next.t('nocodeEditorFlowPlan.addDataNode') },
  get 'edit-data'() { return i18next.t('nocodeEditorFlowPlan.editDataNode') },
  get 'delete-data'() { return i18next.t('nocodeEditorFlowPlan.deleteDataNode') },
  get 'condition-branch'() { return i18next.t('nocodeEditorFlowPlan.conditionBranch') },
  get 'parallel-branch'() { return i18next.t('nocodeEditorFlowPlan.parallelBranch') },
}

export const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeFlowPlanToken(value: unknown) {
  return normalizeText(value)
  .toLowerCase()
  .replace(/[\s\-_/\\]+/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')
}

const normalizeStringList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const normalizeQuestionTitleKey = (value: unknown) => (
  normalizeText(value).replace(/[：:]/g, ':')
)

const isFlowPlanApprovalResultField = (value: unknown) => (
  FLOW_PLAN_APPROVAL_RESULT_FIELD_TOKENS.has(normalizeFlowPlanToken(value))
)

const normalizeFlowPlanQuestionCanonicalId = (value: unknown) => {
  const normalizedId = normalizeText(value)
  return FLOW_PLAN_CONFIRMATION_QUESTION_ID_ALIASES[normalizedId] || normalizedId
}

const buildFlowPlanQuestionIdentityKeys = (
  question?: Partial<NocodeEditorAiConfirmQuestion> | null,
) => {
  const keys = new Set<string>()
  const questionId = normalizeText(question?.id)
  const canonicalId = normalizeFlowPlanQuestionCanonicalId(questionId)
  if (canonicalId) {
    keys.add(`id:${canonicalId}`)
  }
  if (questionId && questionId !== canonicalId) {
    keys.add(`id:${questionId}`)
  }

  const titleKey = normalizeQuestionTitleKey(question?.title)
  if (titleKey) {
    keys.add([
      'title',
      normalizeText(question?.scopeKind),
      normalizeText(question?.branchKey),
      titleKey,
    ].join(':'))
  }

  return keys
}

const isFlowPlanUsingSystemStatusOnly = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
) => {
  if (!confirmation) {
    return false
  }

  const questionMatched = (confirmation.questions || []).some((question) => {
    const selectedOptionValue = normalizeText(question.selectedOptionValue)
    if (selectedOptionValue === 'use-system-status') {
      return true
    }

    const answerText = [
      question.answerSummary,
      question.answerDetail,
    ].map(item => normalizeText(item)).filter(Boolean).join(' ')
    return (
      answerText.includes('流程状态')
      && (
        answerText.includes('不新增')
        || answerText.includes('不再额外回写')
        || answerText.includes('不额外回写')
        || answerText.includes('仅用流程状态')
        || answerText.includes('直接依赖流程状态')
      )
    )
  })

  if (questionMatched) {
    return true
  }

  return [
    confirmation.completionSummary,
    ...(Array.isArray(confirmation.resultSummary) ? confirmation.resultSummary : []),
  ].some((item) => {
    const text = normalizeText(item)
    return (
      text.includes('流程状态')
      && (
        text.includes('不新增')
        || text.includes('不再额外回写')
        || text.includes('不额外回写')
      )
    )
  })
}

const isApprovalResultWritebackQuestionText = (
  value: unknown,
) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  return (
    /审批结果回写到哪个字段/.test(text)
    || (/结果字段/.test(text) && /已通过|已驳回/.test(text))
    || (/流程状态/.test(text) && /新增业务字段|新增结果字段|业务结果字段/.test(text))
  )
}

const collectFlowPlanNodeMappings = (
  node: NocodeEditorFlowPlanNode,
) => {
  const options = isRecord(node.options) ? node.options : {}
  const mapping = Array.isArray(options.mapping) ? options.mapping : []
  const mappings = Array.isArray(options.mappings) ? options.mappings : []
  return [...mapping, ...mappings].filter(isRecord)
}

const isApprovalResultWritebackNode = (
  node: NocodeEditorFlowPlanNode,
) => {
  if (node.type !== 'edit-data') {
    return false
  }

  const mappings = collectFlowPlanNodeMappings(node)
  const allResultFieldMappings = mappings.length > 0 && mappings.every((mapping) => (
    isFlowPlanApprovalResultField(
      mapping.targetFieldName
      || mapping.targetFieldId
      || mapping.targetFieldUID
      || mapping.fieldName,
    )
  ))
  if (!allResultFieldMappings) {
    return false
  }

  const nodeName = normalizeText(node.name)
  const nodeKey = normalizeFlowPlanToken(node.nodeKey)
  return (
    /回写.*(结果|状态)|写回.*(结果|状态)/.test(nodeName)
    || nodeKey.includes('writeback')
    || nodeKey.includes('result')
    || nodeKey.includes('status')
  )
}

const collectApprovalResultWritebackNodeKeys = (
  nodes: NocodeEditorFlowPlanNode[],
  removedNodeKeys: Set<string>,
) => {
  nodes.forEach((node) => {
    if (isApprovalResultWritebackNode(node)) {
      const nodeKey = normalizeText(node.nodeKey)
      if (nodeKey) {
        removedNodeKeys.add(nodeKey)
      }
      return
    }

    ;(node.branches || []).forEach((branch) => {
      collectApprovalResultWritebackNodeKeys(branch.nodes, removedNodeKeys)
    })
  })
}

const sanitizeFlowPlanNodeOptionsAfterWritebackRemoval = (
  node: NocodeEditorFlowPlanNode,
  removedNodeKeys: Set<string>,
) => {
  if (node.type !== 'approval' || !isRecord(node.options)) {
    return node.options
  }

  const nextOptions = cloneRecord(node.options)
  if (!nextOptions || !isRecord(nextOptions.reject)) {
    return nextOptions
  }

  const nextReject = cloneRecord(nextOptions.reject)
  if (!nextReject) {
    return nextOptions
  }

  if (Array.isArray(nextReject.skipNodeKeys)) {
    const remainingSkipNodeKeys = nextReject.skipNodeKeys
      .map(item => normalizeText(item))
      .filter(item => item && !removedNodeKeys.has(item))
    if (remainingSkipNodeKeys.length) {
      nextReject.skipNodeKeys = remainingSkipNodeKeys
    } else {
      delete nextReject.skipNodeKeys
    }
  }

  if (nextReject.continue === true && !Array.isArray(nextReject.skipNodeKeys)) {
    delete nextReject.continue
  }

  nextOptions.reject = nextReject
  return nextOptions
}

const stripApprovalResultWritebackNodes = (
  nodes: NocodeEditorFlowPlanNode[],
  removedNodeKeys: Set<string>,
): NocodeEditorFlowPlanNode[] => (
  nodes.flatMap((node): NocodeEditorFlowPlanNode[] => {
    if (isApprovalResultWritebackNode(node)) {
      return []
    }

    const branches = Array.isArray(node.branches)
      ? node.branches.map((branch) => ({
        ...branch,
        nodes: stripApprovalResultWritebackNodes(branch.nodes, removedNodeKeys),
      }))
      : undefined

    return [{
      ...node,
      options: sanitizeFlowPlanNodeOptionsAfterWritebackRemoval(node, removedNodeKeys),
      branches,
    }]
  })
)

const cloneRecord = (value: unknown) => (
  isRecord(value)
    ? JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    : undefined
)

const normalizeNodeType = (value: unknown): NocodeEditorFlowPlanNodeType | null => {
  const rawType = normalizeText(value)
  const normalized = (LEGACY_FLOW_PLAN_NODE_TYPE_ALIASES[rawType] || rawType) as NocodeEditorFlowPlanNodeType
  return FLOW_PLAN_NODE_TYPES.has(normalized) ? normalized : null
}

const normalizeNodeOptions = (
  type: NocodeEditorFlowPlanNodeType,
  value: unknown,
  rawType: string,
) => {
  const nextValue = cloneRecord(value) || (type === 'trigger-data-change' ? {} : undefined)
  if (!nextValue) {
    return undefined
  }

  if (type === 'trigger-data-change') {
    const normalizedChangeTypes = Array.isArray(nextValue.changeType)
      ? nextValue.changeType.filter(isNocodeEditorFlowDataChangeType)
      : []

    nextValue.changeType = normalizedChangeTypes.length
      ? normalizedChangeTypes
      : [DataChangeType.ADD]

    if (typeof nextValue.enableTriggerConditions !== 'boolean') {
      nextValue.enableTriggerConditions = false
    }
    if (!Array.isArray(nextValue.sourceTables)) {
      nextValue.sourceTables = []
    }

    if (rawType === 'trigger-manual') {
      delete nextValue.triggerMode
      delete nextValue.allowViewContextOnce
    }
  }

  return nextValue
}

const normalizeBranchConditions = (
  value: unknown,
): ConditionBranchConditionGroup[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  return JSON.parse(JSON.stringify(value)) as ConditionBranchConditionGroup[]
}

export const isNocodeEditorFlowPlanBranchNodeType = (
  value: unknown,
): value is Extract<NocodeEditorFlowPlanNodeType, 'condition-branch' | 'parallel-branch'> => {
  const normalized = normalizeNodeType(value)
  return normalized === 'condition-branch' || normalized === 'parallel-branch'
}

export const isNocodeEditorFlowPlanTriggerNodeType = (
  value: unknown,
): value is NocodeEditorFlowPlanTriggerNodeType => {
  const normalized = normalizeNodeType(value)
  return normalized === 'trigger-data-change'
    || normalized === 'trigger-time-task'
    || normalized === 'trigger-operation'
}

const normalizeBranch = (value: unknown): NocodeEditorFlowPlanBranch | null => {
  if (!isRecord(value)) {
    return null
  }

  const nodes = Array.isArray(value.nodes)
    ? value.nodes.flatMap((item): NocodeEditorFlowPlanNode[] => {
      const normalized = normalizeNode(item)
      return normalized ? [normalized] : []
    })
    : []

  const label = normalizeText(value.label)
  return {
    branchKey: normalizeText(value.branchKey) || undefined,
    label: label || undefined,
    conditions: normalizeBranchConditions(value.conditions),
    nodes,
  }
}

export const normalizeNode = (value: unknown): NocodeEditorFlowPlanNode | null => {
  if (!isRecord(value)) {
    return null
  }

  const rawType = normalizeText(value.type)
  const type = normalizeNodeType(rawType)
  if (!type) {
    return null
  }

  const branches = Array.isArray(value.branches)
    ? value.branches.flatMap((item): NocodeEditorFlowPlanBranch[] => {
      const normalized = normalizeBranch(item)
      return normalized ? [normalized] : []
    })
    : []

  return {
    nodeKey: normalizeText(value.nodeKey) || undefined,
    type,
    name: normalizeText(value.name) || undefined,
    options: normalizeNodeOptions(type, value.options, rawType),
    branches: branches.length ? branches : undefined,
  }
}

const normalizeTriggerNode = (
  value: unknown,
): NocodeEditorFlowPlanTriggerNode | null => {
  const normalized = normalizeNode(value)
  if (!normalized || !isNocodeEditorFlowPlanTriggerNodeType(normalized.type)) {
    return null
  }

  return {
    ...normalized,
    type: normalized.type,
  }
}

const normalizeTriggerBranch = (
  value: unknown,
): NocodeEditorFlowPlanTriggerBranch | null => {
  if (!isRecord(value)) {
    return null
  }

  const triggerNode = normalizeTriggerNode(value.triggerNode ?? value.trigger_node)
  if (!triggerNode) {
    return null
  }

  const nodes = Array.isArray(value.nodes)
    ? value.nodes.flatMap((item): NocodeEditorFlowPlanNode[] => {
      const normalized = normalizeNode(item)
      return normalized ? [normalized] : []
    })
    : []

  const label = normalizeText(value.label)
  return {
    branchKey: normalizeText(value.branchKey) || undefined,
    label: label || undefined,
    triggerNode,
    nodes,
  }
}

const isResolvedConfirmationQuestion = (
  question?: Partial<NocodeEditorAiConfirmQuestion> | null,
) => Boolean(
  question?.confirmed
  || normalizeText(question?.selectedOptionValue)
  || normalizeText(question?.answerSummary)
  || normalizeText(question?.answerDetail)
)

export const hasUnresolvedNocodeEditorConfirmationQuestion = (
  question?: Partial<NocodeEditorAiConfirmQuestion> | null,
) => !isResolvedConfirmationQuestion(question)

export const resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles = (
  plan: NocodeEditorFlowPlan | null | undefined,
) => {
  if (!plan) {
    return []
  }

  const titles: string[] = []
  const seenTitleKeys = new Set<string>()
  const pushTitle = (value: unknown) => {
    const title = normalizeText(value)
    const titleKey = normalizeQuestionTitleKey(title)
    if (!title || !titleKey || seenTitleKeys.has(titleKey)) {
      return
    }
    seenTitleKeys.add(titleKey)
    titles.push(title)
  }

  ;(plan.confirmation?.questions || [])
    .filter(question => hasUnresolvedNocodeEditorConfirmationQuestion(question))
    .forEach(question => pushTitle(question.title))

  return titles
}

export const resolveNocodeEditorFlowPlanPendingQuestionTitles = (
  plan: NocodeEditorFlowPlan | null | undefined,
) => {
  if (!plan) {
    return []
  }

  const titles: string[] = []
  const seenTitleKeys = new Set<string>()

  const pushTitle = (value: unknown) => {
    const title = normalizeText(value)
    const titleKey = normalizeQuestionTitleKey(title)
    if (!title || !titleKey || seenTitleKeys.has(titleKey)) {
      return
    }
    seenTitleKeys.add(titleKey)
    titles.push(title)
  }

  plan.openQuestions.forEach(pushTitle)
  resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(plan).forEach(pushTitle)

  return titles
}

export const hasPendingNocodeEditorFlowPlanQuestions = (
  plan: NocodeEditorFlowPlan | null | undefined,
) => resolveNocodeEditorFlowPlanPendingQuestionTitles(plan).length > 0

const findMatchingQuestion = (
  question: NocodeEditorAiConfirmQuestion,
  candidates: NocodeEditorAiConfirmQuestion[],
) => {
  const questionIdentityKeys = buildFlowPlanQuestionIdentityKeys(question)
  if (questionIdentityKeys.size) {
    const matchedByIdentity = candidates.find(candidate => (
      [...buildFlowPlanQuestionIdentityKeys(candidate)]
        .some(key => questionIdentityKeys.has(key))
    ))
    if (matchedByIdentity) {
      return matchedByIdentity
    }
  }

  const questionTitleKey = normalizeQuestionTitleKey(question.title)
  if (!questionTitleKey) {
    return null
  }

  return candidates.find(candidate => (
    normalizeQuestionTitleKey(candidate.title) === questionTitleKey
    && normalizeText(candidate.scopeKind) === normalizeText(question.scopeKind)
    && normalizeText(candidate.branchKey) === normalizeText(question.branchKey)
  )) || null
}

const mergeQuestionOptionSelection = (
  options: NocodeEditorAiConfirmQuestionOption[] | undefined,
  selectedOptionValue: string,
) => {
  if (!Array.isArray(options) || !options.length || !selectedOptionValue) {
    return options
  }

  return options.map(option => ({
    ...option,
    selected: normalizeText(option.value) === selectedOptionValue,
  }))
}

const mergeResolvedQuestion = (
  baseQuestion: NocodeEditorAiConfirmQuestion,
  confirmedQuestion: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  if (!isResolvedConfirmationQuestion(confirmedQuestion)) {
    return {
      ...baseQuestion,
    }
  }

  const selectedOptionValue = normalizeText(
    confirmedQuestion.selectedOptionValue,
  ) || normalizeText(baseQuestion.selectedOptionValue)

  return {
    ...baseQuestion,
    scopeKind: baseQuestion.scopeKind || confirmedQuestion.scopeKind,
    branchKey: baseQuestion.branchKey || confirmedQuestion.branchKey,
    confirmed: true,
    selectedOptionValue: selectedOptionValue || undefined,
    answerSummary: normalizeText(confirmedQuestion.answerSummary)
      || normalizeText(baseQuestion.answerSummary)
      || undefined,
    answerDetail: normalizeText(confirmedQuestion.answerDetail)
      || normalizeText(baseQuestion.answerDetail)
      || undefined,
    options: mergeQuestionOptionSelection(baseQuestion.options, selectedOptionValue),
  }
}

const normalizeFlowPlanConfirmation = (input: {
  confirmation?: unknown
  openQuestions?: unknown
  summary?: unknown
  ignoreOpenQuestionsFallback?: boolean
}) => normalizeNocodeEditorConfirmationPayload({
  stage: 'flow-plan',
  confirmation: input.confirmation,
  openQuestions: input.ignoreOpenQuestionsFallback ? [] : input.openQuestions,
  summary: input.summary,
})

const filterSkippableFlowPlanConfirmation = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  summary?: string
}) => {
  if (!input.confirmation) {
    return null
  }

  const nextQuestions = filterPendingNocodeEditorFlowConfirmationQuestions(
    input.confirmation.questions || [],
  )
  if (nextQuestions.length === input.confirmation.questions.length) {
    return input.confirmation
  }

  return normalizeFlowPlanConfirmation({
    summary: input.summary,
    confirmation: {
      ...input.confirmation,
      questions: nextQuestions,
    },
    openQuestions: [],
    ignoreOpenQuestionsFallback: true,
  })
}

const mergeFlowPlanConfirmation = (input: {
  baseConfirmation?: NocodeEditorAiConfirmPayload | null
  carryoverConfirmation?: NocodeEditorAiConfirmPayload | null
  summary?: string
}) => {
  const baseConfirmation = input.baseConfirmation || null
  const carryoverConfirmation = input.carryoverConfirmation || null

  if (!baseConfirmation && !carryoverConfirmation) {
    return null
  }

  if (!baseConfirmation) {
    return carryoverConfirmation
  }

  if (!carryoverConfirmation) {
    return baseConfirmation
  }

  const carryoverQuestions = carryoverConfirmation.questions
    .filter(question => isResolvedConfirmationQuestion(question))
  const baseQuestions = baseConfirmation.questions
  const mergedQuestions = (baseQuestions.length ? baseQuestions : carryoverQuestions)
    .map((question) => {
      const matchedCarryoverQuestion = findMatchingQuestion(question, carryoverQuestions)
      return matchedCarryoverQuestion
        ? mergeResolvedQuestion(question, matchedCarryoverQuestion)
        : {
          ...question,
        }
    })

  const hasMatchedCarryoverQuestion = mergedQuestions.some(question => {
    const matchedCarryoverQuestion = findMatchingQuestion(question, carryoverQuestions)
    return Boolean(
      matchedCarryoverQuestion
      && isResolvedConfirmationQuestion(matchedCarryoverQuestion)
      && isResolvedConfirmationQuestion(question),
    )
  })

  const resolvedQuestionCount = mergedQuestions.filter(question => (
    isResolvedConfirmationQuestion(question)
  )).length
  const allResolved = mergedQuestions.length > 0 && resolvedQuestionCount >= mergedQuestions.length
  const preferCarryoverCompletedSummary = (
    carryoverConfirmation.status === 'completed'
    && hasMatchedCarryoverQuestion
  )

  return normalizeFlowPlanConfirmation({
    summary: input.summary,
    confirmation: {
      ...baseConfirmation,
      planningContextKey: normalizeText(baseConfirmation.planningContextKey)
        || normalizeText(carryoverConfirmation.planningContextKey)
        || undefined,
      preferredSurface: baseConfirmation.preferredSurface || carryoverConfirmation.preferredSurface,
      summary: normalizeText(baseConfirmation.summary)
        || normalizeText(carryoverConfirmation.summary)
        || input.summary
        || undefined,
      status: allResolved ? 'completed' : 'pending',
      completionSummary: allResolved
        ? (
          normalizeText(baseConfirmation.completionSummary)
          || normalizeText(carryoverConfirmation.completionSummary)
          || undefined
        )
        : undefined,
      resultSummary: preferCarryoverCompletedSummary
        ? (
          Array.isArray(carryoverConfirmation.resultSummary) && carryoverConfirmation.resultSummary.length
            ? carryoverConfirmation.resultSummary
            : baseConfirmation.resultSummary
        )
        : baseConfirmation.resultSummary,
      continueLabel: baseConfirmation.continueLabel || carryoverConfirmation.continueLabel,
      secondaryActionLabel: baseConfirmation.secondaryActionLabel || carryoverConfirmation.secondaryActionLabel,
      reviewLabel: baseConfirmation.reviewLabel || carryoverConfirmation.reviewLabel,
      allowContinueWithDefaults: typeof baseConfirmation.allowContinueWithDefaults === 'boolean'
        ? baseConfirmation.allowContinueWithDefaults
        : carryoverConfirmation.allowContinueWithDefaults,
      questions: mergedQuestions,
    },
    openQuestions: [],
  })
}

const reconcileFlowPlanOpenQuestions = (input: {
  openQuestions: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
}) => {
  const resolvedQuestionTitleKeys = new Set(
    (input.confirmation?.questions || [])
      .filter(question => isResolvedConfirmationQuestion(question))
      .map(question => normalizeQuestionTitleKey(question.title))
      .filter(Boolean),
  )
  const mergedOpenQuestions = input.openQuestions.filter(question => (
    !resolvedQuestionTitleKeys.has(normalizeQuestionTitleKey(question))
  ))
  const mergedOpenQuestionKeys = new Set(
    mergedOpenQuestions
      .map(question => normalizeQuestionTitleKey(question))
      .filter(Boolean),
  )

  for (const question of input.confirmation?.questions || []) {
    if (isResolvedConfirmationQuestion(question)) {
      continue
    }
    const title = normalizeText(question.title)
    const titleKey = normalizeQuestionTitleKey(title)
    if (!titleKey || mergedOpenQuestionKeys.has(titleKey)) {
      continue
    }
    mergedOpenQuestions.push(title)
    mergedOpenQuestionKeys.add(titleKey)
  }

  return mergedOpenQuestions
}

const normalizeFlowPlanInternal = (
  value: unknown,
  carryoverConfirmation?: unknown,
): NocodeEditorFlowPlan | null => {
  if (!isRecord(value)) {
    return null
  }

  const target = isRecord(value.target)
    ? {
      formId: normalizeText(value.target.formId) || undefined,
      formName: normalizeText(value.target.formName) || undefined,
    }
    : null
  const title = normalizeText(value.title)
  const summary = normalizeText(value.summary)
  const triggerBranches = Array.isArray(value.triggerBranches ?? value.trigger_branches)
    ? (value.triggerBranches as NocodeEditorFlowPlanTriggerBranch[] ?? value.trigger_branches as NocodeEditorFlowPlanTriggerBranch[])
      .flatMap((item): NocodeEditorFlowPlanTriggerBranch[] => {
        const normalized = normalizeTriggerBranch(item)
        return normalized ? [normalized] : []
      })
    : []

  if (!title || !summary || !triggerBranches.length) {
    return null
  }

  const rawOpenQuestions = filterPendingNocodeEditorFlowQuestionTitles(
    normalizeStringList(value.openQuestions ?? value.open_questions),
  )
  const ignoreOpenQuestionsFallback = value._flowValidationKeepsConfirmationQuestionsLlmOnly === true
  const baseConfirmation = normalizeFlowPlanConfirmation({
    confirmation: value.confirmation,
    openQuestions: rawOpenQuestions,
    summary,
    ignoreOpenQuestionsFallback,
  })
  const normalizedCarryoverConfirmation = normalizeFlowPlanConfirmation({
    confirmation: carryoverConfirmation,
    openQuestions: [],
    summary,
    ignoreOpenQuestionsFallback: true,
  })
  const confirmation = mergeFlowPlanConfirmation({
    baseConfirmation,
    carryoverConfirmation: normalizedCarryoverConfirmation,
    summary,
  })
  const filteredConfirmation = filterSkippableFlowPlanConfirmation({
    confirmation,
    summary,
  })
  const openQuestions = reconcileFlowPlanOpenQuestions({
    openQuestions: rawOpenQuestions,
    confirmation: filteredConfirmation,
  })
  const usesSystemStatusOnly = isFlowPlanUsingSystemStatusOnly(filteredConfirmation)
  const removedApprovalResultWritebackNodeKeys = new Set<string>()
  if (usesSystemStatusOnly) {
    triggerBranches.forEach((branch) => {
      collectApprovalResultWritebackNodeKeys(branch.nodes, removedApprovalResultWritebackNodeKeys)
      branch.nodes = stripApprovalResultWritebackNodes(branch.nodes, removedApprovalResultWritebackNodeKeys)
    })
  }
  const normalizedOpenQuestions = usesSystemStatusOnly
    ? openQuestions.filter(question => !isApprovalResultWritebackQuestionText(question))
    : openQuestions
  const normalizedConfirmation = usesSystemStatusOnly && filteredConfirmation
    ? normalizeFlowPlanConfirmation({
      summary,
      confirmation: {
        ...filteredConfirmation,
        questions: filteredConfirmation.questions.filter((question) => {
          if (isResolvedConfirmationQuestion(question)) {
            return true
          }
          return !isApprovalResultWritebackQuestionText(question.title)
        }),
      },
      openQuestions: [],
      ignoreOpenQuestionsFallback: true,
    })
    : filteredConfirmation

  return {
    id: normalizeText(value.id) || undefined,
    title,
    summary,
    target: target?.formId || target?.formName ? target : null,
    triggerBranches,
    openQuestions: normalizedOpenQuestions,
    confirmation: normalizedConfirmation,
  }
}

export const normalizeNocodeEditorFlowPlan = (
  value: unknown,
): NocodeEditorFlowPlan | null => {
  return normalizeFlowPlanInternal(value)
}

export const normalizeNocodeEditorFlowPlanToolInput = (
  value: unknown,
): NocodeEditorFlowPlan | null => {
  if (!isRecord(value)) {
    return null
  }

  const nestedFlowPlan = isRecord(value.flowPlan)
    ? {
      ...(value.flowPlan || {}),
      title: value.flowPlan.title || value.title,
      summary: value.flowPlan.summary || value.summary,
      target: value.flowPlan.target || value.target,
      triggerBranches: Array.isArray(value.flowPlan.triggerBranches)
        ? value.flowPlan.triggerBranches
        : value.triggerBranches,
      openQuestions: Array.isArray(value.flowPlan.openQuestions)
        ? value.flowPlan.openQuestions
        : value.openQuestions,
      confirmation: value.flowPlan.confirmation || value.confirmation,
      id: value.flowPlan.id || value.id,
    }
    : null

  return normalizeFlowPlanInternal(nestedFlowPlan || value)
}

export const applyNocodeEditorFlowPlanConfirmation = (
  value: unknown,
  confirmation?: unknown,
) => normalizeFlowPlanInternal(value, confirmation)

export const countNocodeEditorFlowPlanNodes = (
  nodes: NocodeEditorFlowPlanNode[] = [],
): number => (
  nodes.reduce((total, node) => {
    const branchTotal = (node.branches || [])
      .reduce((sum, branch) => sum + countNocodeEditorFlowPlanNodes(branch.nodes || []), 0)
    return total + 1 + branchTotal
  }, 0)
)

export const countNocodeEditorFlowPlanBranches = (
  nodes: NocodeEditorFlowPlanNode[] = [],
): number => (
  nodes.reduce((total, node) => (
    total
    + (node.branches || []).length
    + (node.branches || []).reduce((sum, branch) => (
      sum + countNocodeEditorFlowPlanBranches(branch.nodes || [])
    ), 0)
  ), 0)
)

export const countNocodeEditorFlowPlanTriggerBranches = (
  triggerBranches: NocodeEditorFlowPlanTriggerBranch[] = [],
): number => triggerBranches.length

export const countNocodeEditorFlowPlanTotalNodes = (
  triggerBranches: NocodeEditorFlowPlanTriggerBranch[] = [],
): number => (
  triggerBranches.reduce((total, branch) => (
    total + 1 + countNocodeEditorFlowPlanNodes(branch.nodes || [])
  ), 0)
)

const formatNodeSummaryLine = (
  node: NocodeEditorFlowPlanNode,
  level: number,
): string[] => {
  const indent = '  '.repeat(level)
  const label = NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP[node.type] || node.type
  const nodeTitle = normalizeText(node.name) || label
  const category = NOCODE_EDITOR_FLOW_PLAN_NODE_CATEGORY_MAP[node.type]
  const lines = [`${indent}- ${nodeTitle}（${label} / ${category}）`]

  if (isNocodeEditorFlowPlanBranchNodeType(node.type) && Array.isArray(node.branches)) {
    node.branches.forEach((branch, index) => {
      const branchLabel = normalizeText(branch.label) || `分支 ${index + 1}`
      const conditionCount = Array.isArray(branch.conditions) ? branch.conditions.length : 0
      lines.push(`${indent}  * ${branchLabel}${node.type === 'condition-branch' ? `（${conditionCount} 组条件）` : ''}`)
      branch.nodes.forEach(child => {
        lines.push(...formatNodeSummaryLine(child, level + 2))
      })
    })
  }

  return lines
}

const formatTriggerBranchSummaryLines = (
  triggerBranch: NocodeEditorFlowPlanTriggerBranch,
  index: number,
): string[] => {
  const triggerLabel = NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP[triggerBranch.triggerNode.type] || triggerBranch.triggerNode.type
  const triggerTitle = normalizeText(triggerBranch.triggerNode.name)
    || normalizeText(triggerBranch.label)
    || triggerLabel
  const lines = [
    `- 触发分支 ${index + 1}：${triggerTitle}（${triggerLabel}）`,
  ]

  triggerBranch.nodes.forEach(node => {
    lines.push(...formatNodeSummaryLine(node, 1))
  })

  return lines
}

export const buildNocodeEditorFlowPlanPromptSummary = (
  plan: NocodeEditorFlowPlan | null | undefined,
) => {
  if (!plan) {
    return ''
  }

  const branchLines = plan.triggerBranches.flatMap((branch, index) => (
    formatTriggerBranchSummaryLines(branch, index)
  ))
  const confirmation = plan.confirmation || null
  const pendingQuestions = resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(plan)
  const resolvedQuestionSummaries = Array.isArray(confirmation?.resultSummary) && confirmation.resultSummary.length
    ? confirmation.resultSummary
    : (confirmation?.questions || [])
      .filter(question => isResolvedConfirmationQuestion(question))
      .map((question) => {
        return normalizeText(question.answerSummary)
          || normalizeText(question.title)
      })
      .filter(Boolean)

  return [
    `流程蓝图：${plan.title}`,
    plan.target?.formName ? `所属表单：${plan.target.formName}` : '',
    `摘要：${plan.summary}`,
    confirmation?.status === 'completed'
      ? '确认状态：已完成'
      : pendingQuestions.length
        ? `确认状态：待确认 ${pendingQuestions.length} 项`
        : '',
    branchLines.length ? `触发分支结构：\n${branchLines.join('\n')}` : '',
    resolvedQuestionSummaries.length ? `已确认结论：${resolvedQuestionSummaries.join('；')}` : '',
    pendingQuestions.length ? `待确认：${pendingQuestions.join('；')}` : '',
  ].filter(Boolean).join('\n')
}
