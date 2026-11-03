import type { NocodeEditorAiConfirmQuestion } from '../types/nocodeEditorConfirmation'
import type { NocodeEditorConfirmationDecision } from './nocodeEditorConfirmationDecisionProjection'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from './nocodeEditorFlowScheme'
import {
  FLOW_GROUNDING_GLOBAL_SCOPE_KEY,
  normalizeText,
  parseFlowGroundingFieldOptionDecision,
} from './nocodeEditorFlowGroundingPresentation'

type UnknownRecord = Record<string, unknown>

const normalizeScopeKey = (value: unknown) => normalizeText(value).toLowerCase()
const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)
const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {})
const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : [])

export const FLOW_REPLAN_QUESTION_GLOBAL_SCOPE = FLOW_GROUNDING_GLOBAL_SCOPE_KEY

export type FlowReplanQuestionCapability =
  | 'condition'
  | 'source_field'
  | 'source_table'
  | 'write_field'
  | 'sequential_write'

const CAPABILITIES: FlowReplanQuestionCapability[] = [
  'condition',
  'source_field',
  'source_table',
  'write_field',
  'sequential_write',
]

const CANONICAL_DECISION_KEY_PREFIX: Record<FlowReplanQuestionCapability, string> = {
  condition: 'flow.condition.field',
  source_field: 'flow.source.field',
  source_table: 'flow.source.table',
  write_field: 'flow.write.field',
  sequential_write: 'flow.write.sequential',
}

const LEGACY_QUESTION_CAPABILITY: Record<string, FlowReplanQuestionCapability> = {
  'flow-grounding-condition-field-missing': 'condition',
  'flow-grounding-condition-field-forbidden': 'condition',
  'flow-grounding-source-field-missing': 'source_field',
  'flow-grounding-source-field-conflict': 'source_field',
  'flow-grounding-source-table-missing': 'source_table',
  'flow-grounding-write-field-missing': 'write_field',
  'flow-grounding-write-field-forbidden': 'write_field',
  'flow-grounding-sequential-write-conflict': 'sequential_write',
}

export type FlowReplanQuestionIdentity = {
  capability: FlowReplanQuestionCapability
  scopeKey: string
  decisionKey: string
}

const buildCanonicalDecisionKey = (
  capability: FlowReplanQuestionCapability,
  scopeKey: string,
) => {
  const normalizedScope = capability === 'sequential_write'
    ? FLOW_REPLAN_QUESTION_GLOBAL_SCOPE
    : (scopeKey || FLOW_REPLAN_QUESTION_GLOBAL_SCOPE)
  return `${CANONICAL_DECISION_KEY_PREFIX[capability]}:${normalizedScope}`
}

export const parseFlowReplanQuestionIdentity = (
  value: unknown,
): FlowReplanQuestionIdentity | null => {
  const rawKey = normalizeText(value)
  if (!rawKey) {
    return null
  }
  const lowerKey = rawKey.toLowerCase()

  for (const capability of CAPABILITIES) {
    const prefix = `${CANONICAL_DECISION_KEY_PREFIX[capability]}:`
    if (!lowerKey.startsWith(prefix)) {
      continue
    }
    const scopeKey = capability === 'sequential_write'
      ? FLOW_REPLAN_QUESTION_GLOBAL_SCOPE
      : normalizeScopeKey(rawKey.slice(prefix.length)) || FLOW_REPLAN_QUESTION_GLOBAL_SCOPE
    return {
      capability,
      scopeKey,
      decisionKey: buildCanonicalDecisionKey(capability, scopeKey),
    }
  }

  const [legacyId, ...scopeParts] = rawKey.split(':')
  const capability = LEGACY_QUESTION_CAPABILITY[normalizeText(legacyId).toLowerCase()]
  if (!capability) {
    return null
  }
  const scopeKey = capability === 'sequential_write'
    ? FLOW_REPLAN_QUESTION_GLOBAL_SCOPE
    : normalizeScopeKey(scopeParts.join(':')) || FLOW_REPLAN_QUESTION_GLOBAL_SCOPE
  return {
    capability,
    scopeKey,
    decisionKey: buildCanonicalDecisionKey(capability, scopeKey),
  }
}

type FlowSummaryFieldLike = {
  fieldId: string
  fieldName: string
  writePolicy?: string
  conditionPolicy?: string
  subFields: FlowSummaryFieldLike[]
}

type FlowSummaryTableLike = {
  tableId: string
  tableName: string
  fields: FlowSummaryFieldLike[]
}

type FlowSummaryEvidence = {
  currentForm: FlowSummaryTableLike | null
  availableForms: FlowSummaryTableLike[]
}

const normalizeSummaryField = (value: unknown): FlowSummaryFieldLike | null => {
  const record = asRecord(value)
  const fieldId = normalizeText(record.fieldId)
  const fieldName = normalizeText(record.fieldName)
  if (!fieldId && !fieldName) {
    return null
  }
  return {
    fieldId,
    fieldName,
    writePolicy: normalizeText(record.writePolicy) || undefined,
    conditionPolicy: normalizeText(record.conditionPolicy) || undefined,
    subFields: asArray(record.subFields)
      .map(item => normalizeSummaryField(item))
      .filter((item): item is FlowSummaryFieldLike => Boolean(item)),
  }
}

const normalizeSummaryTable = (value: unknown): FlowSummaryTableLike | null => {
  const record = asRecord(value)
  const tableId = normalizeText(record.tableId)
  const tableName = normalizeText(record.tableName)
  if (!tableId && !tableName) {
    return null
  }
  return {
    tableId,
    tableName,
    fields: asArray(record.fields)
      .map(item => normalizeSummaryField(item))
      .filter((item): item is FlowSummaryFieldLike => Boolean(item)),
  }
}

const readFlowSummaryEvidence = (value: unknown): FlowSummaryEvidence => {
  const forms = asRecord(asRecord(value).forms)
  return {
    currentForm: normalizeSummaryTable(forms.currentForm),
    availableForms: asArray(forms.availableForms)
      .map(item => normalizeSummaryTable(item))
      .filter((item): item is FlowSummaryTableLike => Boolean(item)),
  }
}

const flattenSummaryFields = (
  fields: FlowSummaryFieldLike[],
): FlowSummaryFieldLike[] => (
  fields.flatMap(field => [
    field,
    ...flattenSummaryFields(field.subFields),
  ])
)

const findSummaryField = (
  table: FlowSummaryTableLike | null | undefined,
  candidate: unknown,
): FlowSummaryFieldLike | null => {
  const text = normalizeText(candidate)
  if (!table || !text) {
    return null
  }
  const direct = table.fields.find(field => field.fieldId === text)
    || table.fields.find(field => normalizeToken(field.fieldName) === normalizeToken(text))
  if (direct) {
    return direct
  }
  const flattened = flattenSummaryFields(table.fields)
  const idMatches = flattened.filter(field => field.fieldId === text)
  if (idMatches.length === 1) {
    return idMatches[0]
  }
  const nameMatches = flattened.filter(field => normalizeToken(field.fieldName) === normalizeToken(text))
  return nameMatches.length === 1 ? nameMatches[0] : null
}

const findSummaryTable = (
  tables: FlowSummaryTableLike[],
  candidate: unknown,
): FlowSummaryTableLike | null => {
  const text = normalizeText(candidate)
  if (!text) {
    return null
  }
  const token = normalizeToken(text)
  return tables.find(table => table.tableId === text)
    || tables.find(table => normalizeToken(table.tableName) === token)
    || null
}

const collectSummaryTables = (summary: FlowSummaryEvidence) => [
  ...(summary.currentForm ? [summary.currentForm] : []),
  ...summary.availableForms,
]

type FlowReplanDecisionEntry = {
  identity: FlowReplanQuestionIdentity
  decision: NocodeEditorConfirmationDecision
  answerText: string
}

const hasDecisionAnswer = (decision: NocodeEditorConfirmationDecision) => Boolean(
  normalizeText(decision.selectedOptionValue)
  || normalizeText(decision.answerSummary)
  || normalizeText(decision.answerDetail),
)

const collectTrustedDecisionEntries = (
  decisions?: NocodeEditorConfirmationDecision[] | null,
) => {
  const entries = new Map<string, FlowReplanDecisionEntry>()
  asArray<NocodeEditorConfirmationDecision>(decisions).forEach((decision) => {
    const identity = parseFlowReplanQuestionIdentity(decision.decisionKey)
      || parseFlowReplanQuestionIdentity(decision.questionId)
    if (!identity || !hasDecisionAnswer(decision)) {
      return
    }
    entries.set(identity.decisionKey, {
      identity,
      decision,
      answerText: normalizeText(decision.answerSummary)
        || normalizeText(decision.answerDetail)
        || normalizeText(decision.selectedOptionValue),
    })
  })
  return entries
}

export const hasFlowReplanCapabilityDecisions = (
  decisions?: NocodeEditorConfirmationDecision[] | null,
) => collectTrustedDecisionEntries(decisions).size > 0

const resolveExplicitFieldId = (
  capability: FlowReplanQuestionCapability,
  value: unknown,
) => {
  const option = parseFlowGroundingFieldOptionDecision(value)
  if (!option) {
    return ''
  }
  if (capability === 'condition' && option.capability === 'condition') {
    return option.fieldId
  }
  if (capability === 'source_field' && option.capability === 'source') {
    return option.fieldId
  }
  return ''
}

const collectAnswerCandidates = (entry: FlowReplanDecisionEntry) => Array.from(new Set([
  normalizeText(entry.decision.answerDetail),
  normalizeText(entry.decision.answerSummary),
].filter(Boolean)))

type FlowReplanEvidence =
  | { status: 'valid'; field?: FlowSummaryFieldLike; table?: FlowSummaryTableLike }
  | {
    status: 'invalid'
    reason: 'field_not_found' | 'field_not_usable' | 'field_not_writable' | 'table_not_found'
  }
  | { status: 'unavailable' }
  | { status: 'not_applicable' }

const resolveFlowReplanDecisionEvidence = (input: {
  entry: FlowReplanDecisionEntry
  summary: FlowSummaryEvidence
  targetDependency?: NocodeEditorFlowSchemeDependency
}): FlowReplanEvidence => {
  const { entry, summary } = input
  const capability = entry.identity.capability
  if (capability === 'sequential_write') {
    return { status: 'not_applicable' }
  }

  const explicitFieldId = resolveExplicitFieldId(capability, entry.decision.selectedOptionValue)
  const answerCandidates = collectAnswerCandidates(entry)

  if (capability === 'condition' || capability === 'source_field') {
    if (!summary.currentForm) {
      return { status: 'unavailable' }
    }
    const matchedCandidate = answerCandidates.find(candidate => (
      Boolean(findSummaryField(summary.currentForm, candidate))
    ))
    const fieldCandidate = explicitFieldId || matchedCandidate || ''
    if (!fieldCandidate) {
      return { status: 'not_applicable' }
    }
    const field = findSummaryField(summary.currentForm, fieldCandidate)
    if (!field) {
      return { status: 'invalid', reason: 'field_not_found' }
    }
    if (capability === 'condition' && normalizeText(field.conditionPolicy) !== 'usable') {
      return { status: 'invalid', reason: 'field_not_usable' }
    }
    return { status: 'valid', field }
  }

  if (capability === 'write_field') {
    const tables = collectSummaryTables(summary)
    const targetTable = findSummaryTable(tables, input.targetDependency?.targetFormId)
      || findSummaryTable(tables, input.targetDependency?.targetFormName)
      || summary.currentForm
    if (!targetTable) {
      return { status: 'unavailable' }
    }
    const matchedCandidate = answerCandidates.find(candidate => (
      Boolean(findSummaryField(targetTable, candidate))
    ))
    const fieldCandidate = explicitFieldId || matchedCandidate || ''
    if (!fieldCandidate) {
      return { status: 'not_applicable' }
    }
    const field = findSummaryField(targetTable, fieldCandidate)
    if (!field) {
      return { status: 'invalid', reason: 'field_not_found' }
    }
    if (normalizeText(field.writePolicy) !== 'writable') {
      return { status: 'invalid', reason: 'field_not_writable' }
    }
    return { status: 'valid', field }
  }

  if (capability === 'source_table') {
    const tables = collectSummaryTables(summary)
    if (!tables.length) {
      return { status: 'unavailable' }
    }
    const matchedCandidate = answerCandidates.find(candidate => (
      Boolean(findSummaryTable(tables, candidate))
    ))
    const table = matchedCandidate ? findSummaryTable(tables, matchedCandidate) : null
    return table
      ? { status: 'valid', table }
      : { status: 'not_applicable' }
  }

  return { status: 'not_applicable' }
}

const readDependencyBranchKey = (dependency: NocodeEditorFlowSchemeDependency) => (
  normalizeText((dependency as NocodeEditorFlowSchemeDependency & { branchKey?: string }).branchKey)
)

const isSystemDerivedGroundingDependency = (
  dependency: NocodeEditorFlowSchemeDependency,
) => normalizeText(dependency.id).toLowerCase().startsWith('flow-dependency:grounding_')

const resolveDependencyCapability = (
  dependency: NocodeEditorFlowSchemeDependency,
): FlowReplanQuestionCapability | null => {
  const identity = parseFlowReplanQuestionIdentity(dependency.decisionKey)
  if (identity) {
    return identity.capability
  }
  const id = normalizeText(dependency.id).toLowerCase()
  if (id.startsWith('flow-dependency:grounding_condition_field_')) {
    return 'condition'
  }
  if (id.startsWith('flow-dependency:grounding_source_field_')) {
    return 'source_field'
  }
  if (id.startsWith('flow-dependency:grounding_source_table_')) {
    return 'source_table'
  }
  if (id.startsWith('flow-dependency:grounding_write_field_')) {
    return 'write_field'
  }
  if (id.startsWith('flow-dependency:grounding_sequential_write_conflict')) {
    return 'sequential_write'
  }
  // 模型自建依赖没有稳定键，只能按业务槽位归类；顺序写入没有可靠的兜底身份，不猜测。
  if (dependency.requiredFor === 'condition') {
    return 'condition'
  }
  if (dependency.requiredFor === 'source_mapping') {
    return dependency.kind === 'source_table_missing' ? 'source_table' : 'source_field'
  }
  if (dependency.requiredFor === 'writeback') {
    return 'write_field'
  }
  return null
}

const resolveDependencyScopeKey = (
  dependency: NocodeEditorFlowSchemeDependency,
) => normalizeScopeKey(readDependencyBranchKey(dependency) || dependency.scopeKey)
  || FLOW_REPLAN_QUESTION_GLOBAL_SCOPE

const matchesDependencyIdentity = (
  dependency: NocodeEditorFlowSchemeDependency,
  identity: FlowReplanQuestionIdentity,
) => {
  if (resolveDependencyCapability(dependency) !== identity.capability) {
    return false
  }
  if (identity.capability === 'sequential_write') {
    return true
  }
  if (identity.scopeKey === FLOW_REPLAN_QUESTION_GLOBAL_SCOPE) {
    return true
  }
  return resolveDependencyScopeKey(dependency) === identity.scopeKey
}

const isSequentialWriteConfirmedDecision = (entry: FlowReplanDecisionEntry) => (
  normalizeText(entry.decision.selectedOptionValue).toLowerCase() === 'confirm-sequential-updates'
)

const buildResolvedDependency = (
  dependency: NocodeEditorFlowSchemeDependency,
  entry: FlowReplanDecisionEntry,
  evidence: FlowReplanEvidence,
): NocodeEditorFlowSchemeDependency => {
  const base = {
    ...dependency,
    decisionKey: entry.identity.decisionKey,
    lifecycleStatus: 'resolved' as const,
    resolutionStatus: 'resolved' as const,
    unverifiedReason: undefined,
  }

  if (entry.identity.capability === 'sequential_write') {
    const confirmed = isSequentialWriteConfirmedDecision(entry)
    return {
      ...base,
      resolutionMode: confirmed ? 'use_existing' as const : 'switch_strategy' as const,
      materializationStatus: confirmed ? 'existing' as const : 'not_available' as const,
      summary: confirmed
        ? '已确认顺序步骤按顺序更新同一字段'
        : '已按用户确认调整重复写入安排',
    }
  }

  if (evidence.status === 'valid' && evidence.field) {
    return {
      ...base,
      resolutionMode: 'use_existing' as const,
      materializationStatus: 'existing' as const,
      fieldRef: {
        fieldId: evidence.field.fieldId,
        fieldName: evidence.field.fieldName,
      },
      summary: entry.identity.capability === 'condition'
        ? `条件判断已确认改用现有字段“${evidence.field.fieldName}”`
        : entry.identity.capability === 'write_field'
          ? `流程回写已确认使用现有字段“${evidence.field.fieldName}”`
          : `数据来源已确认使用现有字段“${evidence.field.fieldName}”`,
    }
  }

  if (evidence.status === 'valid' && evidence.table) {
    return {
      ...base,
      resolutionMode: 'use_existing' as const,
      materializationStatus: 'existing' as const,
      targetFormId: evidence.table.tableId || dependency.targetFormId,
      targetFormName: evidence.table.tableName || dependency.targetFormName,
      summary: `数据来源已确认使用现有表单“${evidence.table.tableName}”`,
    }
  }

  return {
    ...base,
    resolutionMode: 'switch_strategy' as const,
    materializationStatus: 'not_available' as const,
    summary: '已按用户确认调整该流程配置',
  }
}

const buildSequentialDecisionDependency = (
  entry: FlowReplanDecisionEntry,
): NocodeEditorFlowSchemeDependency => {
  const confirmed = isSequentialWriteConfirmedDecision(entry)
  return {
    id: 'flow-dependency:replan-decision:sequential_write:global',
    decisionKey: entry.identity.decisionKey,
    lifecycleStatus: 'resolved',
    kind: 'capability_gap',
    requiredFor: 'writeback',
    scopeKind: 'global',
    riskLevel: 'low',
    resolutionStatus: 'resolved',
    resolutionMode: confirmed ? 'use_existing' : 'switch_strategy',
    materializationStatus: confirmed ? 'existing' : 'not_available',
    summary: confirmed
      ? '已确认顺序步骤按顺序更新同一字段'
      : '已按用户确认调整重复写入安排',
  }
}

const markConfirmationQuestionConfirmed = (
  question: NocodeEditorAiConfirmQuestion,
  entry: FlowReplanDecisionEntry,
): NocodeEditorAiConfirmQuestion => {
  const isNoteOnly = question.questionKind === 'note_only'
  const selectedOptionValue = isNoteOnly
    ? ''
    : normalizeText(entry.decision.selectedOptionValue)
  const answerSummary = normalizeText(entry.decision.answerSummary)
    || normalizeText(entry.decision.answerDetail)
    || selectedOptionValue
  const answerDetail = normalizeText(entry.decision.answerDetail)
  const options = Array.isArray(question.options) ? [...question.options] : []

  if (selectedOptionValue && !options.some(option => (
    normalizeText(option.value) === selectedOptionValue
  ))) {
    options.push({
      value: selectedOptionValue,
      label: answerSummary || selectedOptionValue,
    })
  }

  return {
    ...question,
    confirmed: true,
    ...(selectedOptionValue ? { selectedOptionValue } : {}),
    ...(answerSummary ? { answerSummary } : {}),
    ...(answerDetail ? { answerDetail } : {}),
    ...(options.length
      ? {
        options: options.map(option => {
          if (selectedOptionValue && normalizeText(option.value) === selectedOptionValue) {
            return { ...option, selected: true }
          }
          return option.selected ? { ...option, selected: false } : option
        }),
      }
      : {}),
  }
}

export type FlowReplanQuestionConvergenceDiagnostic = {
  code: 'flow_replan_question_closed' | 'flow_replan_question_kept'
  message: string
  decisionKey: string
  capability: FlowReplanQuestionCapability
  scopeKey: string
  openQuestionKey?: string
  reason?: 'form_evidence_unavailable' | 'decision_evidence_invalid' | 'residual_dependency'
  evidenceReason?: 'field_not_found' | 'field_not_usable' | 'field_not_writable' | 'table_not_found'
}

export type FlowReplanQuestionConvergenceResult = {
  scheme: NocodeEditorFlowScheme
  diagnostics: FlowReplanQuestionConvergenceDiagnostic[]
  consumedDecisionKeys: string[]
}

type FlowReplanQuestionCandidate = {
  identity: FlowReplanQuestionIdentity
  title: string
  openQuestionKey?: string
}

const buildClosedDiagnostic = (
  candidate: FlowReplanQuestionCandidate,
): FlowReplanQuestionConvergenceDiagnostic => ({
  code: 'flow_replan_question_closed',
  message: `已按已确认的流程决策关闭重复问题“${candidate.title}”。`,
  decisionKey: candidate.identity.decisionKey,
  capability: candidate.identity.capability,
  scopeKey: candidate.identity.scopeKey,
  openQuestionKey: candidate.openQuestionKey,
})

const buildKeptDiagnostic = (
  candidate: FlowReplanQuestionCandidate,
  reason: NonNullable<FlowReplanQuestionConvergenceDiagnostic['reason']>,
  evidenceReason?: FlowReplanQuestionConvergenceDiagnostic['evidenceReason'],
): FlowReplanQuestionConvergenceDiagnostic => ({
  code: 'flow_replan_question_kept',
  message: reason === 'form_evidence_unavailable'
    ? `保留问题“${candidate.title}”：当前无法读取表单字段证据，暂不关闭。`
    : reason === 'decision_evidence_invalid'
      ? `保留问题“${candidate.title}”：已确认的字段或表单当前不可用，需要重新确认。`
      : `保留问题“${candidate.title}”：最新方案仍有同一业务的未解决依赖。`,
  decisionKey: candidate.identity.decisionKey,
  capability: candidate.identity.capability,
  scopeKey: candidate.identity.scopeKey,
  openQuestionKey: candidate.openQuestionKey,
  reason,
  evidenceReason,
})

// 重规划会把同一槽位的问题从分支级抬成全局级（scope 变了，键也跟着变），
// 精确键匹配就认不出这是同一道题。全局候选没有同键答案时，允许继承同能力唯一一条
// 已答决策；多条时无法判断答的是哪一条，宁可继续提问也不猜。
const resolveReplanCandidateEntry = (
  candidate: FlowReplanQuestionCandidate,
  entriesByKey: Map<string, FlowReplanDecisionEntry>,
) => {
  const exact = entriesByKey.get(candidate.identity.decisionKey)
  if (exact) {
    return exact
  }
  if (candidate.identity.scopeKey !== FLOW_REPLAN_QUESTION_GLOBAL_SCOPE) {
    return undefined
  }
  const sameCapability = [...entriesByKey.values()].filter(entry => (
    entry.identity.capability === candidate.identity.capability
  ))
  return sameCapability.length === 1 ? sameCapability[0] : undefined
}

export const convergeNocodeEditorFlowReplanQuestions = (input: {
  scheme: NocodeEditorFlowScheme
  decisions?: NocodeEditorConfirmationDecision[] | null
  flowSummary?: unknown
}): FlowReplanQuestionConvergenceResult => {
  const scheme = input.scheme
  const entriesByKey = collectTrustedDecisionEntries(input.decisions)
  if (!entriesByKey.size) {
    return { scheme, diagnostics: [], consumedDecisionKeys: [] }
  }

  const summary = readFlowSummaryEvidence(input.flowSummary)
  const dependencies = Array.isArray(scheme.dependencies) ? scheme.dependencies : []
  const openQuestions = Array.isArray(scheme.openQuestions) ? scheme.openQuestions : []
  const confirmationQuestions = Array.isArray(scheme.confirmation?.questions)
    ? scheme.confirmation?.questions || []
    : []

  const candidates = new Map<string, FlowReplanQuestionCandidate>()
  const addCandidate = (
    value: unknown,
    candidate: Omit<FlowReplanQuestionCandidate, 'identity'>,
  ) => {
    const identity = parseFlowReplanQuestionIdentity(value)
    if (!identity) {
      return
    }
    const existing = candidates.get(identity.decisionKey)
    if (existing) {
      existing.openQuestionKey = existing.openQuestionKey || candidate.openQuestionKey
      existing.title = existing.title || candidate.title
      return
    }
    candidates.set(identity.decisionKey, { identity, ...candidate })
  }

  openQuestions.forEach((question) => {
    addCandidate(question.key, {
      title: normalizeText(question.title) || normalizeText(question.reason) || '流程待确认问题',
      openQuestionKey: normalizeText(question.key),
    })
  })
  confirmationQuestions.forEach((question) => {
    if (question.confirmed === true) {
      return
    }
    addCandidate(question.decisionKey || question.id, {
      title: normalizeText(question.title) || '流程待确认问题',
    })
  })

  const closedEntries = new Map<string, FlowReplanDecisionEntry>()
  const evidenceByKey = new Map<string, FlowReplanEvidence>()
  const diagnostics: FlowReplanQuestionConvergenceDiagnostic[] = []

  candidates.forEach((candidate, decisionKey) => {
    const matchedEntry = resolveReplanCandidateEntry(candidate, entriesByKey)
    if (!matchedEntry) {
      return
    }
    // 回退命中时把身份改写成当前题的键：依赖匹配和写回的 decisionKey 都要跟这份方案一致。
    const entry: FlowReplanDecisionEntry = matchedEntry.identity.decisionKey === decisionKey
      ? matchedEntry
      : { ...matchedEntry, identity: candidate.identity }

    const matchingDependencies = dependencies.filter(dependency => (
      matchesDependencyIdentity(dependency, candidate.identity)
    ))
    const unresolvedDependencies = matchingDependencies.filter(dependency => (
      dependency.resolutionStatus !== 'resolved'
    ))
    const residualModelDependencies = unresolvedDependencies.filter(dependency => (
      !isSystemDerivedGroundingDependency(dependency)
    ))

    if (residualModelDependencies.length) {
      diagnostics.push(buildKeptDiagnostic(candidate, 'residual_dependency'))
      return
    }

    const targetDependency = unresolvedDependencies.find(isSystemDerivedGroundingDependency)
    const evidence = resolveFlowReplanDecisionEvidence({
      entry,
      summary,
      targetDependency,
    })
    const explicitFieldId = resolveExplicitFieldId(
      candidate.identity.capability,
      entry.decision.selectedOptionValue,
    )

    if (evidence.status === 'invalid') {
      diagnostics.push(buildKeptDiagnostic(
        candidate,
        'decision_evidence_invalid',
        evidence.reason,
      ))
      return
    }
    if (explicitFieldId && evidence.status === 'unavailable') {
      diagnostics.push(buildKeptDiagnostic(candidate, 'form_evidence_unavailable'))
      return
    }

    closedEntries.set(decisionKey, entry)
    evidenceByKey.set(decisionKey, evidence)
    diagnostics.push(buildClosedDiagnostic(candidate))
  })

  const closedIdentityList = [...closedEntries.values()].sort((left, right) => {
    const leftGlobal = left.identity.scopeKey === FLOW_REPLAN_QUESTION_GLOBAL_SCOPE ? 1 : 0
    const rightGlobal = right.identity.scopeKey === FLOW_REPLAN_QUESTION_GLOBAL_SCOPE ? 1 : 0
    return leftGlobal - rightGlobal
  })

  const nextDependencies = dependencies.map((dependency) => {
    if (dependency.resolutionStatus === 'resolved') {
      return dependency
    }
    if (!isSystemDerivedGroundingDependency(dependency)) {
      return dependency
    }
    const matchedEntry = closedIdentityList.find(entry => (
      matchesDependencyIdentity(dependency, entry.identity)
    ))
    if (!matchedEntry) {
      return dependency
    }
    return buildResolvedDependency(
      dependency,
      matchedEntry,
      evidenceByKey.get(matchedEntry.identity.decisionKey) || { status: 'not_applicable' },
    )
  })

  const sequentialEntry = closedIdentityList.find(entry => (
    entry.identity.capability === 'sequential_write'
  ))
  if (
    sequentialEntry
    && !nextDependencies.some(dependency => (
      resolveDependencyCapability(dependency) === 'sequential_write'
    ))
  ) {
    nextDependencies.push(buildSequentialDecisionDependency(sequentialEntry))
  }

  const closedDecisionKeys = new Set(closedEntries.keys())
  const nextOpenQuestions = openQuestions.filter((question) => {
    const identity = parseFlowReplanQuestionIdentity(question.key)
    return !identity || !closedDecisionKeys.has(identity.decisionKey)
  })

  const nextConfirmationQuestions = confirmationQuestions.map((question) => {
    if (question.confirmed === true) {
      return question
    }
    const identity = parseFlowReplanQuestionIdentity(question.decisionKey || question.id)
    if (!identity || !closedDecisionKeys.has(identity.decisionKey)) {
      return question
    }
    const entry = closedEntries.get(identity.decisionKey)
    return entry ? markConfirmationQuestionConfirmed(question, entry) : question
  })

  let nextScheme: NocodeEditorFlowScheme = {
    ...scheme,
    openQuestions: nextOpenQuestions,
    dependencies: nextDependencies,
  }
  if (scheme.confirmation && closedDecisionKeys.size > 0) {
    nextScheme = {
      ...nextScheme,
      confirmation: {
        ...scheme.confirmation,
        status: nextConfirmationQuestions.some(question => (
          question.required !== false && question.confirmed !== true
        )) || nextOpenQuestions.length > 0
          ? 'pending'
          : 'completed',
        questions: nextConfirmationQuestions,
      },
    }
  }

  const consumedDecisionKeys = new Set<string>()
  closedEntries.forEach((entry) => {
    consumedDecisionKeys.add(entry.identity.decisionKey)
    const rawDecisionKey = normalizeText(entry.decision.decisionKey)
    if (rawDecisionKey) {
      consumedDecisionKeys.add(rawDecisionKey)
    }
    const questionId = normalizeText(entry.decision.questionId)
    if (questionId) {
      consumedDecisionKeys.add(questionId)
    }
  })

  return {
    scheme: nextScheme,
    diagnostics,
    consumedDecisionKeys: [...consumedDecisionKeys],
  }
}

export const isFlowReplanSequentialWriteConfirmed = (
  scheme?: NocodeEditorFlowScheme | null,
) => Boolean(
  scheme?.confirmation?.questions.some(question => (
    (
      normalizeText(question.id) === 'flow-grounding-sequential-write-conflict'
      || parseFlowReplanQuestionIdentity(question.decisionKey)?.capability === 'sequential_write'
    )
    && question.confirmed === true
    && normalizeText(question.selectedOptionValue) === 'confirm-sequential-updates'
  ))
  || scheme?.dependencies?.some(dependency => (
    parseFlowReplanQuestionIdentity(dependency.decisionKey)?.capability === 'sequential_write'
    && dependency.resolutionStatus === 'resolved'
    && dependency.resolutionMode === 'use_existing'
    && dependency.materializationStatus === 'existing'
  )),
)
