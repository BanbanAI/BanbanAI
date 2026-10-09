import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from './nocodeEditorConfirmationNormalization'
import {
  reconcileNocodeEditorConfirmationDecisions,
} from './nocodeEditorConfirmationDecisionReconciliation'
import {
  filterPendingNocodeEditorFlowConfirmationQuestions,
  filterPendingNocodeEditorFlowQuestionRecords,
} from './nocodeEditorFlowQuestionPolicy'
import {
  type NocodeEditorFlowPersonnelRequirement,
  normalizeNocodeEditorFlowPersonnelRequirement,
} from './nocodeEditorFlowPersonnel'

export type NocodeEditorFlowSchemeStepKind =
  | 'approval'
  | 'notify'
  | 'transact'
  | 'report-data'
  | 'add-data'
  | 'edit-data'
  | 'delete-data'
  | 'condition-branch'

export type NocodeEditorFlowSchemeQuestion = {
  key: string
  title: string
  reason: string
  scopeKind?: 'global' | 'step' | 'branch'
  scopeKey?: string
}

export type NocodeEditorFlowSchemeTrigger = {
  type: 'submit' | 'update' | 'manual' | 'schedule' | 'unknown'
  description: string
}

export type NocodeEditorFlowSchemeStep = {
  key: string
  kind: NocodeEditorFlowSchemeStepKind
  title: string
  intent: string
  personnelRequirement?: NocodeEditorFlowPersonnelRequirement
  actorHint?: string
  targetHint?: string
  conditionHint?: string
}

export type NocodeEditorFlowSchemeBranch = {
  key: string
  title: string
  when: string
  steps: NocodeEditorFlowSchemeStep[]
}

export type NocodeEditorFlowSchemeDependency = {
  id: string
  kind:
    | 'field_missing'
    | 'field_policy_mismatch'
    | 'source_table_missing'
    | 'org_anchor_missing'
    | 'mapping_conflict'
    | 'capability_gap'
  requiredFor:
    | 'approval_owner'
    | 'condition'
    | 'writeback'
    | 'source_mapping'
    | 'notify_target'
    | 'trigger_schedule'
    | 'owner_binding'
  scopeKind: 'global' | 'step' | 'branch'
  scopeKey?: string
  scopeTitle?: string
  targetFormId?: string
  targetFormName?: string
  fieldRef?: {
    fieldId?: string
    fieldName?: string
    expectedType?: string
  }
  riskLevel: 'low' | 'high'
  resolutionStatus: 'unresolved' | 'resolved'
  resolutionMode?:
    | 'use_existing'
    | 'create_later'
    | 'switch_strategy'
    | 'remove_design'
    | 'specify_org_anchor'
  materializationStatus: 'existing' | 'planned' | 'not_available'
  summary: string
}

export type NocodeEditorFlowSchemeDeferredConfigItem = {
  id: string
  nodeKey?: string
  nodeTitle?: string
  category:
    | 'owner_binding'
    | 'fallback_handler'
    | 'data_target'
    | 'field_mapping'
    | 'condition_detail'
    | 'schedule_detail'
    | 'notification_detail'
    | 'reminder_detail'
    | 'advanced_option'
    | 'copywriting'
    | 'display'
  requirementLevel: 'required' | 'optional'
  supportStatus: 'runtime_supported' | 'needs_runtime_support'
  summary: string
  fillTiming: 'after_generation'
  severity: 'low' | 'medium' | 'high'
  recommendedDefault?: string
  relatedIssueCodes?: string[]
}

export type NocodeEditorFlowSchemeConvergence = {
  businessStatus: 'pending' | 'resolved'
  dependencyStatus: 'pending' | 'resolved'
  materializationStatus: 'all_existing' | 'has_planned_dependencies'
  unresolvedQuestionCount: number
  unresolvedDependencyCount: number
  plannedDependencyCount: number
  requiredDeferredConfigCount: number
  optionalDeferredConfigCount: number
  deferredConfigItemCount: number
}

export type NocodeEditorFlowScheme = {
  id?: string
  title: string
  summary: string
  target?: {
    formId?: string
    formName?: string
  } | null
  trigger: NocodeEditorFlowSchemeTrigger
  mainPath: NocodeEditorFlowSchemeStep[]
  branches: NocodeEditorFlowSchemeBranch[]
  confirmedFacts: string[]
  assumptions: string[]
  openQuestions: NocodeEditorFlowSchemeQuestion[]
  dependencies?: NocodeEditorFlowSchemeDependency[]
  deferredConfigItems?: NocodeEditorFlowSchemeDeferredConfigItem[]
  convergence?: NocodeEditorFlowSchemeConvergence | null
  confirmation?: NocodeEditorAiConfirmPayload | null
}

export type NocodeEditorFlowSchemePlanningStatus =
  | 'needs_confirmation'
  | 'ready_for_review'

export type NocodeEditorFlowSchemeReviewFailureReason =
  | 'main_path_missing'
  | 'critical_config_missing'
  | 'semantic_conflict'
  | 'constraint_not_grounded'

export type NocodeEditorFlowSchemeReviewResult = {
  failed: boolean
  failureReasons: NocodeEditorFlowSchemeReviewFailureReason[]
  summary: string
  questions: NocodeEditorFlowSchemeQuestion[]
}

type UnknownRecord = Record<string, unknown>

const FLOW_SCHEME_STEP_KINDS = new Set<NocodeEditorFlowSchemeStepKind>([
  'approval',
  'notify',
  'transact',
  'report-data',
  'add-data',
  'edit-data',
  'delete-data',
  'condition-branch',
])

const FLOW_SCHEME_REVIEW_FAILURE_REASONS = new Set<NocodeEditorFlowSchemeReviewFailureReason>([
  'main_path_missing',
  'critical_config_missing',
  'semantic_conflict',
  'constraint_not_grounded',
])

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const normalizeNonNegativeInteger = (value: unknown) => {
  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 0) {
    return null
  }
  return normalized
}

const normalizeFlowSchemeTriggerType = (
  value: unknown,
): NocodeEditorFlowSchemeTrigger['type'] => {
  const normalized = normalizeText(value)
  if (
    normalized === 'submit'
    || normalized === 'update'
    || normalized === 'manual'
    || normalized === 'schedule'
  ) {
    return normalized
  }
  return 'unknown'
}

const normalizeFlowSchemeQuestion = (
  value: unknown,
  index: number,
): NocodeEditorFlowSchemeQuestion | null => {
  if (typeof value === 'string') {
    const title = normalizeText(value)
    if (!title) {
      return null
    }
    return {
      key: `question-${index + 1}`,
      title,
      reason: title,
    }
  }

  if (!isRecord(value)) {
    return null
  }

  const key = normalizeText(value.key || value.id)
  const title = normalizeText(value.title)
  const reason = normalizeText(value.reason || value.description)
  if (!title || !reason) {
    return null
  }

  const scopeKind = normalizeText(value.scopeKind)
  return {
    key: key || `question-${index + 1}`,
    title,
    reason,
    scopeKind: scopeKind === 'global' || scopeKind === 'step' || scopeKind === 'branch'
      ? scopeKind
      : undefined,
    scopeKey: normalizeText(value.scopeKey) || undefined,
  }
}

const normalizeFlowSchemeDependency = (
  value: unknown,
): NocodeEditorFlowSchemeDependency | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const kind = normalizeText(value.kind)
  const requiredFor = normalizeText(value.requiredFor)
  const scopeKind = normalizeText(value.scopeKind)
  const resolutionStatus = normalizeText(value.resolutionStatus)
  const materializationStatus = normalizeText(value.materializationStatus)
  const summary = normalizeText(value.summary)
  const resolutionMode = normalizeText(value.resolutionMode)
  const fieldRefValue = isRecord(value.fieldRef) ? value.fieldRef : null
  const fieldRef = fieldRefValue
    ? {
      ...(normalizeText(fieldRefValue.fieldId) ? { fieldId: normalizeText(fieldRefValue.fieldId) } : {}),
      ...(normalizeText(fieldRefValue.fieldName) ? { fieldName: normalizeText(fieldRefValue.fieldName) } : {}),
      ...(normalizeText(fieldRefValue.expectedType) ? { expectedType: normalizeText(fieldRefValue.expectedType) } : {}),
    }
    : null
  const normalizedRiskLevel = normalizeText(value.riskLevel)
  const riskLevel = normalizedRiskLevel || (
    kind === 'field_missing'
    && requiredFor === 'approval_owner'
    && resolutionStatus === 'resolved'
    && resolutionMode === 'create_later'
    && materializationStatus === 'planned'
    && Boolean(fieldRef?.fieldName)
    && fieldRef?.expectedType === 'memberSelect'
    && !fieldRef?.fieldId
      ? 'low'
      : ''
  )
  if (!id || !summary) {
    return null
  }
  if (!['field_missing', 'field_policy_mismatch', 'source_table_missing', 'org_anchor_missing', 'mapping_conflict', 'capability_gap'].includes(kind)) {
    return null
  }
  if (!['approval_owner', 'condition', 'writeback', 'source_mapping', 'notify_target', 'trigger_schedule', 'owner_binding'].includes(requiredFor)) {
    return null
  }
  if (!['global', 'step', 'branch'].includes(scopeKind)) {
    return null
  }
  if (!['low', 'high'].includes(riskLevel)) {
    return null
  }
  if (!['unresolved', 'resolved'].includes(resolutionStatus)) {
    return null
  }
  if (!['existing', 'planned', 'not_available'].includes(materializationStatus)) {
    return null
  }

  return {
    id,
    kind: kind as NocodeEditorFlowSchemeDependency['kind'],
    requiredFor: requiredFor as NocodeEditorFlowSchemeDependency['requiredFor'],
    scopeKind: scopeKind as NocodeEditorFlowSchemeDependency['scopeKind'],
    scopeKey: normalizeText(value.scopeKey) || undefined,
    scopeTitle: normalizeText(value.scopeTitle) || undefined,
    targetFormId: normalizeText(value.targetFormId) || undefined,
    targetFormName: normalizeText(value.targetFormName) || undefined,
    fieldRef: fieldRef && (fieldRef.fieldId || fieldRef.fieldName || fieldRef.expectedType)
      ? fieldRef
      : undefined,
    riskLevel: riskLevel as NocodeEditorFlowSchemeDependency['riskLevel'],
    resolutionStatus: resolutionStatus as NocodeEditorFlowSchemeDependency['resolutionStatus'],
    resolutionMode: ['use_existing', 'create_later', 'switch_strategy', 'remove_design', 'specify_org_anchor'].includes(resolutionMode)
      ? resolutionMode as NocodeEditorFlowSchemeDependency['resolutionMode']
      : undefined,
    materializationStatus: materializationStatus as NocodeEditorFlowSchemeDependency['materializationStatus'],
    summary,
  }
}

const normalizeFlowSchemeDeferredConfigItem = (
  value: unknown,
): NocodeEditorFlowSchemeDeferredConfigItem | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const category = normalizeText(value.category)
  const requirementLevel = normalizeText(value.requirementLevel)
  const supportStatus = normalizeText(value.supportStatus)
  const summary = normalizeText(value.summary)
  const fillTiming = normalizeText(value.fillTiming)
  const severity = normalizeText(value.severity)
  if (!id || !summary) {
    return null
  }
  if (!['owner_binding', 'fallback_handler', 'data_target', 'field_mapping', 'condition_detail', 'schedule_detail', 'notification_detail', 'reminder_detail', 'advanced_option', 'copywriting', 'display'].includes(category)) {
    return null
  }
  if (!['required', 'optional'].includes(requirementLevel)) {
    return null
  }
  if (!['runtime_supported', 'needs_runtime_support'].includes(supportStatus)) {
    return null
  }
  if (fillTiming !== 'after_generation') {
    return null
  }
  if (!['low', 'medium', 'high'].includes(severity)) {
    return null
  }

  return {
    id,
    nodeKey: normalizeText(value.nodeKey) || undefined,
    nodeTitle: normalizeText(value.nodeTitle) || undefined,
    category: category as NocodeEditorFlowSchemeDeferredConfigItem['category'],
    requirementLevel: requirementLevel as NocodeEditorFlowSchemeDeferredConfigItem['requirementLevel'],
    supportStatus: supportStatus as NocodeEditorFlowSchemeDeferredConfigItem['supportStatus'],
    summary,
    fillTiming: 'after_generation',
    severity: severity as NocodeEditorFlowSchemeDeferredConfigItem['severity'],
    recommendedDefault: normalizeText(value.recommendedDefault) || undefined,
    relatedIssueCodes: normalizeStringList(value.relatedIssueCodes),
  }
}

const normalizeFlowSchemeConvergence = (
  value: unknown,
): NocodeEditorFlowSchemeConvergence | null => {
  if (!isRecord(value)) {
    return null
  }

  const businessStatus = normalizeText(value.businessStatus)
  const dependencyStatus = normalizeText(value.dependencyStatus)
  const materializationStatus = normalizeText(value.materializationStatus)
  if (
    !['pending', 'resolved'].includes(businessStatus)
    || !['pending', 'resolved'].includes(dependencyStatus)
    || !['all_existing', 'has_planned_dependencies'].includes(materializationStatus)
  ) {
    return null
  }

  const unresolvedQuestionCount = normalizeNonNegativeInteger(value.unresolvedQuestionCount)
  const unresolvedDependencyCount = normalizeNonNegativeInteger(value.unresolvedDependencyCount)
  const plannedDependencyCount = normalizeNonNegativeInteger(value.plannedDependencyCount)
  const requiredDeferredConfigCount = normalizeNonNegativeInteger(value.requiredDeferredConfigCount)
  const optionalDeferredConfigCount = normalizeNonNegativeInteger(value.optionalDeferredConfigCount)
  const deferredConfigItemCount = normalizeNonNegativeInteger(value.deferredConfigItemCount)

  if (
    unresolvedQuestionCount === null
    || unresolvedDependencyCount === null
    || plannedDependencyCount === null
    || requiredDeferredConfigCount === null
    || optionalDeferredConfigCount === null
    || deferredConfigItemCount === null
  ) {
    return null
  }

  return {
    businessStatus: businessStatus as NocodeEditorFlowSchemeConvergence['businessStatus'],
    dependencyStatus: dependencyStatus as NocodeEditorFlowSchemeConvergence['dependencyStatus'],
    materializationStatus: materializationStatus as NocodeEditorFlowSchemeConvergence['materializationStatus'],
    unresolvedQuestionCount,
    unresolvedDependencyCount,
    plannedDependencyCount,
    requiredDeferredConfigCount,
    optionalDeferredConfigCount,
    deferredConfigItemCount,
  }
}

const normalizeQuestionTitleKey = (value: unknown) => (
  normalizeText(value).replace(/[：:]/g, ':')
)

const GENERATED_FLOW_SCHEME_QUESTION_KEY_PATTERN = /^(?:flow-scheme-question|question)-\d+$/u

const isGeneratedFlowSchemeQuestionKey = (value: unknown) => (
  GENERATED_FLOW_SCHEME_QUESTION_KEY_PATTERN.test(normalizeText(value))
)

const normalizeQuestionScopeKey = (value: unknown) => {
  const scope = normalizeText(value)
  return scope === 'overview' ? 'global' : scope
}

const buildFlowSchemeQuestionIdentity = (input: {
  title: unknown
  scopeKind?: unknown
  scopeKey?: unknown
  branchKey?: unknown
}) => [
  normalizeQuestionTitleKey(input.title),
  normalizeQuestionScopeKey(input.scopeKind) || 'global',
  normalizeText(input.scopeKey || input.branchKey),
].join('|')

const getFlowSchemeQuestionCopyScore = (question: NocodeEditorFlowSchemeQuestion) => (
  (question.reason !== question.title ? 4 : 0)
  + Math.min(3, question.reason.length > question.title.length ? 2 : 0)
  + (isGeneratedFlowSchemeQuestionKey(question.key) ? 0 : 1)
)

const dedupeFlowSchemeQuestions = (
  questions: NocodeEditorFlowSchemeQuestion[],
) => {
  const result: NocodeEditorFlowSchemeQuestion[] = []
  const indexesByIdentity = new Map<string, number[]>()

  questions.forEach((question) => {
    const identity = buildFlowSchemeQuestionIdentity(question)
    const indexes = indexesByIdentity.get(identity) || []
    const duplicateIndex = indexes.find(index => (
      isGeneratedFlowSchemeQuestionKey(question.key)
      || isGeneratedFlowSchemeQuestionKey(result[index]?.key)
    ))
    if (duplicateIndex == null) {
      indexes.push(result.length)
      indexesByIdentity.set(identity, indexes)
      result.push(question)
      return
    }

    const existing = result[duplicateIndex]
    const preferred = getFlowSchemeQuestionCopyScore(question) > getFlowSchemeQuestionCopyScore(existing)
      ? question
      : existing
    const preferredKey = isGeneratedFlowSchemeQuestionKey(preferred.key)
      ? (isGeneratedFlowSchemeQuestionKey(existing.key) ? question.key : existing.key)
      : preferred.key
    result[duplicateIndex] = {
      ...preferred,
      key: preferredKey,
    }
  })

  return result
}

const getConfirmationQuestionKey = (question: NocodeEditorAiConfirmQuestion) => (
  normalizeText(question.decisionKey) || normalizeText(question.id)
)

const getConfirmationQuestionCopyScore = (question: NocodeEditorAiConfirmQuestion) => (
  (normalizeText(question.description) ? 4 : 0)
  + (Array.isArray(question.options) && question.options.length ? 2 : 0)
  + (question.confirmed === true
    || Boolean(question.selectedOptionValue || question.answerSummary || question.answerDetail)
    ? 2
    : 0)
  + (isGeneratedFlowSchemeQuestionKey(getConfirmationQuestionKey(question)) ? 0 : 1)
)

const dedupeFlowSchemeConfirmationQuestions = (
  questions: NocodeEditorAiConfirmQuestion[],
) => {
  const result: NocodeEditorAiConfirmQuestion[] = []
  const indexesByIdentity = new Map<string, number[]>()

  questions.forEach((question) => {
    const identity = buildFlowSchemeQuestionIdentity({
      title: question.title,
      scopeKind: question.scopeKind,
      branchKey: question.branchKey,
    })
    const indexes = indexesByIdentity.get(identity) || []
    const duplicateIndex = indexes.find(index => (
      isGeneratedFlowSchemeQuestionKey(getConfirmationQuestionKey(question))
      || isGeneratedFlowSchemeQuestionKey(getConfirmationQuestionKey(result[index]))
    ))
    if (duplicateIndex == null) {
      indexes.push(result.length)
      indexesByIdentity.set(identity, indexes)
      result.push(question)
      return
    }

    const existing = result[duplicateIndex]
    result[duplicateIndex] = getConfirmationQuestionCopyScore(question) > getConfirmationQuestionCopyScore(existing)
      ? question
      : existing
  })

  return result
}

const resolveConfirmationDecisionKey = (
  question: NocodeEditorAiConfirmQuestion,
) => normalizeText(question.decisionKey) || normalizeText(question.id)

const reconcileFlowSchemeOpenQuestions = (input: {
  openQuestions: NocodeEditorFlowSchemeQuestion[]
  preReconciliationQuestions: NocodeEditorAiConfirmQuestion[]
  resolvedDecisionKeys: string[]
}) => {
  const resolvedDecisionKeySet = new Set(input.resolvedDecisionKeys)
  const modernResolvedDecisionKeys = new Set(
    input.preReconciliationQuestions
      .filter(question => normalizeText(question.decisionKey))
      .map(resolveConfirmationDecisionKey)
      .filter(decisionKey => resolvedDecisionKeySet.has(decisionKey)),
  )
  const resolvedLegacyQuestions: Array<{ decisionKey: string, titleKey: string }> = []
  const seenLegacyDecisionKeys = new Set<string>()

  input.preReconciliationQuestions.forEach((question) => {
    if (normalizeText(question.decisionKey)) {
      return
    }
    const decisionKey = resolveConfirmationDecisionKey(question)
    if (
      !resolvedDecisionKeySet.has(decisionKey)
      || modernResolvedDecisionKeys.has(decisionKey)
      || seenLegacyDecisionKeys.has(decisionKey)
    ) {
      return
    }
    seenLegacyDecisionKeys.add(decisionKey)
    resolvedLegacyQuestions.push({
      decisionKey,
      titleKey: normalizeQuestionTitleKey(question.title),
    })
  })

  const removedQuestionIndexes = new Set<number>()
  resolvedLegacyQuestions.forEach((legacyQuestion) => {
    const exactMatchIndex = input.openQuestions.findIndex((question, index) => (
      !removedQuestionIndexes.has(index)
      && question.key === legacyQuestion.decisionKey
    ))
    if (exactMatchIndex >= 0) {
      removedQuestionIndexes.add(exactMatchIndex)
      return
    }

    const titleMatchIndex = input.openQuestions.findIndex((question, index) => (
      !removedQuestionIndexes.has(index)
      && normalizeQuestionTitleKey(question.title) === legacyQuestion.titleKey
    ))
    if (titleMatchIndex >= 0) {
      removedQuestionIndexes.add(titleMatchIndex)
    }
  })

  input.openQuestions.forEach((question, index) => {
    if (modernResolvedDecisionKeys.has(question.key)) {
      removedQuestionIndexes.add(index)
    }
  })

  return input.openQuestions.filter((_, index) => !removedQuestionIndexes.has(index))
}

type FlowSchemeStepKeyAllocationState = {
  explicitKeys: Set<string>
  generatedKeys: Set<string>
}

const getExplicitFlowSchemeStepKey = (value: unknown) => {
  if (!isRecord(value)) {
    return ''
  }
  return normalizeText(value.key || value.nodeKey)
}

const createFlowSchemeStepKeyAllocationState = (
  value: Record<string, unknown>,
): FlowSchemeStepKeyAllocationState => {
  const rawSteps = [
    ...(Array.isArray(value.mainPath) ? value.mainPath : []),
    ...(Array.isArray(value.branches)
      ? value.branches.flatMap((branch) => {
        if (!isRecord(branch) || !Array.isArray(branch.steps)) {
          return []
        }
        return branch.steps
      })
      : []),
  ]
  return {
    explicitKeys: new Set(rawSteps.map(getExplicitFlowSchemeStepKey).filter(Boolean)),
    generatedKeys: new Set<string>(),
  }
}

const allocateFlowSchemeStepFallbackKey = (
  fallbackKey: string,
  state: FlowSchemeStepKeyAllocationState,
) => {
  let candidate = fallbackKey
  let suffix = 2
  while (state.explicitKeys.has(candidate) || state.generatedKeys.has(candidate)) {
    candidate = `${fallbackKey}-${suffix}`
    suffix += 1
  }
  state.generatedKeys.add(candidate)
  return candidate
}

const normalizeFlowSchemeStep = (
  value: unknown,
  fallbackKey: string,
  keyAllocationState: FlowSchemeStepKeyAllocationState,
): NocodeEditorFlowSchemeStep | null => {
  if (!isRecord(value)) {
    return null
  }

  const kind = normalizeText(value.kind) as NocodeEditorFlowSchemeStepKind
  const title = normalizeText(value.title || value.name)
  const intent = normalizeText(value.intent || value.summary || value.description)
  if (!FLOW_SCHEME_STEP_KINDS.has(kind) || !title || !intent) {
    return null
  }

  const personnelRequirement = value.personnelRequirement === undefined
    ? null
    : normalizeNocodeEditorFlowPersonnelRequirement(value.personnelRequirement)
  const explicitKey = getExplicitFlowSchemeStepKey(value)

  return {
    key: explicitKey || allocateFlowSchemeStepFallbackKey(fallbackKey, keyAllocationState),
    kind,
    title,
    intent,
    ...(personnelRequirement ? { personnelRequirement } : {}),
    actorHint: normalizeText(value.actorHint) || undefined,
    targetHint: normalizeText(value.targetHint) || undefined,
    conditionHint: normalizeText(value.conditionHint) || undefined,
  }
}

const normalizeFlowSchemeBranch = (
  value: unknown,
  index: number,
  keyAllocationState: FlowSchemeStepKeyAllocationState,
): NocodeEditorFlowSchemeBranch | null => {
  if (!isRecord(value)) {
    return null
  }

  const title = normalizeText(value.title || value.label)
  const when = normalizeText(value.when)
  if (!title || !when) {
    return null
  }

  const steps = Array.isArray(value.steps)
    ? value.steps.flatMap((item, stepIndex): NocodeEditorFlowSchemeStep[] => {
      const normalized = normalizeFlowSchemeStep(
        item,
        `branch-${index + 1}-step-${stepIndex + 1}`,
        keyAllocationState,
      )
      return normalized ? [normalized] : []
    })
    : []

  return {
    key: normalizeText(value.key || value.branchKey) || `branch-${index + 1}`,
    title,
    when,
    steps,
  }
}

export const normalizeNocodeEditorFlowScheme = (
  value: unknown,
  options: {
    preserveTrustedDecisionKeySource?: boolean
  } = {},
): NocodeEditorFlowScheme | null => {
  if (!isRecord(value)) {
    return null
  }

  const title = normalizeText(value.title)
  const summary = normalizeText(value.summary)
  const trigger = isRecord(value.trigger)
    ? {
      type: normalizeFlowSchemeTriggerType(value.trigger.type),
      description: normalizeText(value.trigger.description),
    }
    : null
  if (!title || !summary || !trigger?.description) {
    return null
  }

  const target = isRecord(value.target)
    ? {
      formId: normalizeText(value.target.formId) || undefined,
      formName: normalizeText(value.target.formName) || undefined,
    }
    : null
  const dependencies = Array.isArray(value.dependencies)
    ? value.dependencies.flatMap((item): NocodeEditorFlowSchemeDependency[] => {
      const normalized = normalizeFlowSchemeDependency(item)
      return normalized ? [normalized] : []
    })
    : undefined
  const deferredConfigItems = Array.isArray(value.deferredConfigItems)
    ? value.deferredConfigItems.flatMap((item): NocodeEditorFlowSchemeDeferredConfigItem[] => {
      const normalized = normalizeFlowSchemeDeferredConfigItem(item)
      return normalized ? [normalized] : []
    })
    : undefined
  const convergence = value.convergence === undefined
    ? undefined
    : normalizeFlowSchemeConvergence(value.convergence)
  const openQuestions = Array.isArray(value.openQuestions)
    ? value.openQuestions.flatMap((item, index): NocodeEditorFlowSchemeQuestion[] => {
      const normalized = normalizeFlowSchemeQuestion(item, index)
      return normalized ? [normalized] : []
    })
    : []
  const filteredOpenQuestions = dedupeFlowSchemeQuestions(
    filterPendingNocodeEditorFlowQuestionRecords(openQuestions),
  )
  const synthesizedConfirmation = filteredOpenQuestions.length > 0 && !isRecord(value.confirmation)
    ? {
      stage: 'flow-scheme' as const,
      status: 'pending' as const,
      questions: filteredOpenQuestions.map(question => ({
        id: question.key,
        title: question.title,
        description: question.reason,
        required: true,
        allowFreeText: true,
      })),
    }
    : value.confirmation
  const baseConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'flow-scheme',
    confirmation: synthesizedConfirmation,
    openQuestions: filteredOpenQuestions.map(question => question.title),
    summary,
    preserveTrustedDecisionKeySource: options.preserveTrustedDecisionKeySource,
  })
  const preReconciliationConfirmation = baseConfirmation
    ? normalizeNocodeEditorConfirmationPayload({
      stage: 'flow-scheme',
      confirmation: {
        ...baseConfirmation,
        questions: dedupeFlowSchemeConfirmationQuestions(
          filterPendingNocodeEditorFlowConfirmationQuestions(baseConfirmation.questions || []),
        ),
      },
      openQuestions: [],
      summary,
      preserveTrustedDecisionKeySource: options.preserveTrustedDecisionKeySource,
    })
    : null
  const confirmationReconciliation = reconcileNocodeEditorConfirmationDecisions({
    confirmation: preReconciliationConfirmation,
    previousDecisions: [],
    preserveTrustedDecisionKeySource: options.preserveTrustedDecisionKeySource,
  })
  const reconciledOpenQuestions = reconcileFlowSchemeOpenQuestions({
    openQuestions: filteredOpenQuestions,
    preReconciliationQuestions: preReconciliationConfirmation?.questions || [],
    resolvedDecisionKeys: confirmationReconciliation.resolvedDecisionKeys,
  })
  const reconciledConfirmation = confirmationReconciliation.confirmation
  const confirmation = reconciledConfirmation && reconciledOpenQuestions.length > 0
    ? { ...reconciledConfirmation, status: 'pending' as const }
    : reconciledConfirmation
  const stepKeyAllocationState = createFlowSchemeStepKeyAllocationState(value)

  return {
    id: normalizeText(value.id) || undefined,
    title,
    summary,
    target: target?.formId || target?.formName ? target : null,
    trigger,
    mainPath: Array.isArray(value.mainPath)
      ? value.mainPath.flatMap((item, index): NocodeEditorFlowSchemeStep[] => {
        const normalized = normalizeFlowSchemeStep(
          item,
          `main-step-${index + 1}`,
          stepKeyAllocationState,
        )
        return normalized ? [normalized] : []
      })
      : [],
    branches: Array.isArray(value.branches)
      ? value.branches.flatMap((item, index): NocodeEditorFlowSchemeBranch[] => {
        const normalized = normalizeFlowSchemeBranch(item, index, stepKeyAllocationState)
        return normalized ? [normalized] : []
      })
      : [],
    confirmedFacts: normalizeStringList(value.confirmedFacts),
    assumptions: normalizeStringList(value.assumptions),
    openQuestions: reconciledOpenQuestions,
    dependencies,
    deferredConfigItems,
    convergence,
    confirmation,
  }
}

export const normalizeNocodeEditorFlowSchemeReviewResult = (
  value: unknown,
): NocodeEditorFlowSchemeReviewResult | null => {
  if (!isRecord(value)) {
    return null
  }

  const failed = value.failed === true
  const failureReasons = Array.isArray(value.failureReasons)
    ? value.failureReasons
      .map(item => normalizeText(item) as NocodeEditorFlowSchemeReviewFailureReason)
      .filter((item): item is NocodeEditorFlowSchemeReviewFailureReason => (
        FLOW_SCHEME_REVIEW_FAILURE_REASONS.has(item)
      ))
    : []
  const summary = normalizeText(value.summary)
  const questions = Array.isArray(value.questions)
    ? value.questions.flatMap((item, index): NocodeEditorFlowSchemeQuestion[] => {
      const normalized = normalizeFlowSchemeQuestion(item, index)
      return normalized ? [normalized] : []
    })
    : []

  if (!summary) {
    return null
  }
  if (failed && !failureReasons.length) {
    return null
  }
  if (!failed && (failureReasons.length || questions.length)) {
    return null
  }

  return {
    failed,
    failureReasons,
    summary,
    questions,
  }
}
