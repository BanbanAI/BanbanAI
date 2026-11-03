import type {
  NocodeEditorAiConfirmQuestion,
  NocodeEditorFlowDecisionScope,
} from '@common/types/nocodeEditorConfirmation'
import { findFlowSafeDefaultRule } from './nocodeEditorFlowSafeDefaults'
import {
  filterPendingNocodeEditorFlowConfirmationQuestions,
  filterPendingNocodeEditorFlowQuestionRecords,
  pruneDanglingFlowDecisionReferences,
} from './nocodeEditorFlowQuestionPolicy'
import {
  inferFlowPersonnelSlotFromQuestionOptions,
} from './nocodeEditorFlowDecisionIdentity'

export type FlowDecisionDiagnostic = {
  code: 'duplicate_key' | 'unknown_dependency' | 'self_dependency' | 'cycle' | 'invalid_option' | 'unsafe_default' | 'missing_dependency_declaration'
    | 'missing_decision_key' | 'duplicate_decision_key' | 'open_question_confirmation_mismatch' | 'duplicate_pending_question' | 'invalid_prerequisite_reference'
    | 'invalid_contract_version' | 'missing_decision_scope' | 'invalid_decision_scope' | 'unknown_fact' | 'duplicate_fact_producer'
    | 'binary_question_has_alternative_answers'
    | 'fact_dependency_cycle' | 'invalid_fact_snapshot' | 'untrusted_fact_snapshot'
    | 'personnel_decision_question_kind_invalid' | 'personnel_decision_slot_options_invalid'
    | 'field_value_option_not_in_enum'
  decisionKey: string
  dependencyKey?: string
  scopeKey?: string
  factKey?: string
  source?: 'explicit' | 'fact'
  reason?: 'unknown_key'
  /** 结构假设类诊断自带可读原因（哪条假设、缺哪道题），必须能回传给模型 */
  message?: string
}

export type FlowDecisionState = 'ready' | 'blocked_by_prerequisite' | 'resolved' | 'inapplicable'

const keyOf = (question: NocodeEditorAiConfirmQuestion) => String(question.decisionKey || question.id || '').trim()
const answered = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || question.selectedOptionValue
  || question.answerSummary
  || question.answerDetail
  || question.options?.some(option => option.selected),
)
const selectedValue = (question: NocodeEditorAiConfirmQuestion) => String(
  question.selectedOptionValue || question.options?.find(option => option.selected)?.value || '',
).trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const factKeys = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
  : []

const augmentFactDependencies = (
  questions: NocodeEditorAiConfirmQuestion[],
  factSnapshot: Record<string, unknown> = {},
) => {
  const diagnostics: FlowDecisionDiagnostic[] = []
  const producers = new Map<string, string>()
  questions.forEach((question) => question.producesFacts?.forEach((factKey) => {
    const previous = producers.get(factKey)
    if (previous && previous !== keyOf(question)) diagnostics.push({
      code: 'duplicate_fact_producer', decisionKey: keyOf(question), dependencyKey: previous, factKey,
    })
    else producers.set(factKey, keyOf(question))
  }))
  const augmented = questions.map((question) => {
    const dependencies = new Set(question.dependsOn || [])
    const dependencySources: Record<string, 'explicit' | 'fact'> = Object.fromEntries(
      (question.dependsOn || []).map(key => [key, question.dependencySources?.[key] || 'explicit']),
    )
    question.requiresFacts?.forEach((factKey) => {
      const producer = producers.get(factKey)
      if (producer && producer !== keyOf(question)) {
        dependencies.add(producer)
        if (!dependencySources[producer]) dependencySources[producer] = 'fact'
      }
      else if (!producer && !isRecord(factSnapshot[factKey])) diagnostics.push({
        code: 'unknown_fact', decisionKey: keyOf(question), factKey,
      })
    })
    return { ...question, dependsOn: [...dependencies], dependencySources }
  })
  if (validateFlowDecisionGraph(augmented).some(item => item.code === 'cycle')) diagnostics.push({
    code: 'fact_dependency_cycle', decisionKey: '', source: 'fact',
  })
  return { questions: augmented, diagnostics }
}

export type FlowDecisionOrderDependency = {
  decisionKey: string
  dependencyKey: string
  tier: number
  scopeRank: number
}

const FLOW_DECISION_ORDER_TIER_BY_CHANGE: Record<string, number> = {
  topology: 1,
  applicability: 1,
  scope: 1,
  binding: 3,
  cardinality: 3,
  options: 3,
  meaning: 4,
  strategy: 4,
}

const FLOW_DECISION_ORDER_TIER_BY_SLOT: Record<
  NonNullable<NocodeEditorAiConfirmQuestion['personnelDecision']>['slot'],
  number
> = {
  approval_level: 1,
  source: 2,
  binding: 3,
  multi_person: 3,
  same_as_submitter: 3,
  empty_handler: 4,
}

type FlowDecisionOrderScope = {
  kind: 'flow' | 'branch' | 'step' | 'object'
  id: string
}

type FlowDecisionOrderEntry = {
  decisionKey: string
  tier: number
  scope: FlowDecisionOrderScope
  scopeRank: number
  branchKey: string
  index: number
}

const flowDecisionOrderScope = (
  question: NocodeEditorAiConfirmQuestion,
): FlowDecisionOrderScope => {
  const scope = question.decisionScope
  if (scope?.kind === 'branch' || scope?.kind === 'step' || scope?.kind === 'object') {
    return { kind: scope.kind, id: String(scope.id || '').trim() }
  }
  if (scope?.kind === 'flow' || scope?.kind === 'path') {
    return { kind: 'flow', id: String(scope.id || '').trim() }
  }
  const stepKey = String(question.personnelDecision?.stepKey || '').trim()
  return stepKey ? { kind: 'step', id: stepKey } : { kind: 'flow', id: '' }
}

const flowDecisionOrderScopeRank = (scope: FlowDecisionOrderScope) => (
  scope.kind === 'flow' ? 0 : scope.kind === 'branch' ? 1 : 2
)

const flowDecisionOrderBranchKey = (question: NocodeEditorAiConfirmQuestion) => {
  const branchKey = String(question.branchKey || '').trim()
  if (branchKey) return branchKey
  return question.decisionScope?.kind === 'branch'
    ? String(question.decisionScope.id || '').trim()
    : ''
}

// 无结构化信号就不排序：宁可多答一轮，也不猜测业务层级。
const resolveFlowDecisionOrderTier = (
  question: NocodeEditorAiConfirmQuestion,
): number | null => {
  if (question.required === false || question.questionKind === 'note_only') return null
  const slot = question.personnelDecision?.slot
    || inferFlowPersonnelSlotFromQuestionOptions(question)
  // 人员题所在层只由槽位决定。changes 是模型自填的，来源题被多标一个 topology 就会
  // 抬到结构层，与分支/结构题算出同一个 orderKey；同层不成边，两者会一起待答。
  if (slot) return FLOW_DECISION_ORDER_TIER_BY_SLOT[slot]
  const tiers: number[] = []
  ;(question.changes || []).forEach((change) => {
    const tier = FLOW_DECISION_ORDER_TIER_BY_CHANGE[String(change)]
    if (tier) tiers.push(tier)
  })
  if (tiers.length) return Math.min(...tiers)
  // 整条流程上的二选一通常决定是否分流/是否新增节点，按结构层处理。
  return question.questionKind === 'binary'
    && flowDecisionOrderScopeRank(flowDecisionOrderScope(question)) === 0
    ? 1
    : null
}

const flowDecisionOrderScopesOverlap = (
  left: FlowDecisionOrderEntry,
  right: FlowDecisionOrderEntry,
) => {
  if (left.scope.kind === 'flow' || right.scope.kind === 'flow') return true
  if (left.scope.kind === right.scope.kind) {
    return Boolean(left.scope.id) && left.scope.id === right.scope.id
  }
  const branch = left.scope.kind === 'branch'
    ? left
    : right.scope.kind === 'branch' ? right : null
  const fine = left.scope.kind === 'branch' ? right : left
  if (!branch || (fine.scope.kind !== 'step' && fine.scope.kind !== 'object')) return false
  return Boolean(branch.scope.id) && fine.branchKey === branch.scope.id
}

export const augmentFlowDecisionOrderDependencies = (
  questions: NocodeEditorAiConfirmQuestion[],
): {
  questions: NocodeEditorAiConfirmQuestion[]
  orderDependencies: FlowDecisionOrderDependency[]
} => {
  const entries = questions.flatMap((question, index): FlowDecisionOrderEntry[] => {
    const decisionKey = keyOf(question)
    const tier = resolveFlowDecisionOrderTier(question)
    if (!decisionKey || tier === null) return []
    const scope = flowDecisionOrderScope(question)
    return [{
      decisionKey,
      tier,
      scope,
      scopeRank: flowDecisionOrderScopeRank(scope),
      branchKey: flowDecisionOrderBranchKey(question),
      index,
    }]
  })
  const sorted = [...entries].sort((left, right) => (
    left.tier - right.tier
    || left.scopeRank - right.scopeRank
    || left.index - right.index
  ))
  const dependenciesByKey = new Map<string, Set<string>>(questions.map(question => [
    keyOf(question),
    new Set([
      ...(question.dependsOn || []),
      ...(question.prerequisites || []).map(item => item.decisionKey),
    ].map(value => String(value || '').trim()).filter(Boolean)),
  ] as const))
  const orderKeyOf = (entry: FlowDecisionOrderEntry) => entry.tier * 10 + entry.scopeRank

  const hasDependencyPath = (
    from: string,
    target: string,
    seen: Set<string> = new Set(),
  ): boolean => {
    if (!from || seen.has(from)) return false
    if (from === target) return true
    seen.add(from)
    const dependencies = dependenciesByKey.get(from)
    if (!dependencies) return false
    return [...dependencies].some(dependency => (
      hasDependencyPath(dependency, target, seen)
    ))
  }

  const orderDependencies: FlowDecisionOrderDependency[] = []
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const prerequisite = sorted[leftIndex]
      const dependent = sorted[rightIndex]
      if (orderKeyOf(prerequisite) === orderKeyOf(dependent)) continue
      if (!flowDecisionOrderScopesOverlap(prerequisite, dependent)) continue
      const dependencies = dependenciesByKey.get(dependent.decisionKey)
      if (!dependencies || dependencies.has(prerequisite.decisionKey)) continue
      // 模型显式写了反向依赖时以模型为准，不补出环。
      if (hasDependencyPath(prerequisite.decisionKey, dependent.decisionKey)) continue
      dependencies.add(prerequisite.decisionKey)
      orderDependencies.push({
        decisionKey: dependent.decisionKey,
        dependencyKey: prerequisite.decisionKey,
        tier: prerequisite.tier,
        scopeRank: prerequisite.scopeRank,
      })
    }
  }

  if (!orderDependencies.length) return { questions, orderDependencies }
  const byDependent = new Map<string, string[]>()
  orderDependencies.forEach((edge) => {
    byDependent.set(edge.decisionKey, [
      ...(byDependent.get(edge.decisionKey) || []),
      edge.dependencyKey,
    ])
  })
  return {
    questions: questions.map((question) => {
      const added = byDependent.get(keyOf(question))
      return added
        ? { ...question, dependsOn: [...(question.dependsOn || []), ...added] }
        : question
    }),
    orderDependencies,
  }
}

export const projectFlowDecisionContract = (
  questions: NocodeEditorAiConfirmQuestion[],
  factSnapshot: Record<string, unknown> = {},
  decisionSnapshot?: Record<string, string>,
) => {
  const augmented = augmentFactDependencies(questions, factSnapshot)
  const graphDiagnostics = validateFlowDecisionGraph(augmented.questions)
  const ordered = augmentFlowDecisionOrderDependencies(augmented.questions)
  // 诊断不再清空 states：坏边只影响被点名的题，由上层做隔离。
  // questions 仍返回事实补全后的版本，不把隐式排序边写回契约。
  return {
    ...projectFlowDecisionQuestions(ordered.questions, decisionSnapshot),
    questions: augmented.questions,
    orderDependencies: ordered.orderDependencies,
    diagnostics: [...augmented.diagnostics, ...graphDiagnostics],
  }
}

const rawQuestions = (scheme: Record<string, unknown>) => {
  const confirmation = isRecord(scheme.confirmation) ? scheme.confirmation : null
  const questions = Array.isArray(confirmation?.questions)
    ? confirmation.questions.filter(isRecord)
    : []
  const openQuestions = Array.isArray(scheme.openQuestions)
    ? scheme.openQuestions.filter(isRecord)
    : []
  const retainedQuestions = filterPendingNocodeEditorFlowConfirmationQuestions(
    questions as NocodeEditorAiConfirmQuestion[],
  ) as Record<string, unknown>[]
  const retainedOpen = filterPendingNocodeEditorFlowQuestionRecords(openQuestions)
  const removedKeys = new Set(questions
    .filter(question => !retainedQuestions.includes(question))
    .map(question => String(question.decisionKey || question.id || '').trim())
    .filter(Boolean))
  const removedOpenKeys = new Set(openQuestions
    .filter(question => !retainedOpen.includes(question))
    .map(question => String(question.key || '').trim())
    .filter(Boolean))
  const keptQuestions = retainedQuestions.filter(question => (
    answered(question as NocodeEditorAiConfirmQuestion)
    || !removedOpenKeys.has(String(question.decisionKey || '').trim())
  ))
  const keptKeys = new Set(keptQuestions
    .map(question => String(question.decisionKey || question.id || '').trim())
    .filter(Boolean))
  const droppedKeys = new Set(questions
    .map(question => String(question.decisionKey || question.id || '').trim())
    .filter(key => key && !keptKeys.has(key)))
  return {
    questions: pruneDanglingFlowDecisionReferences(keptQuestions, droppedKeys),
    openQuestions: retainedOpen.filter(question => !removedKeys.has(String(question.key || '').trim())),
  }
}

const normalizedTitle = (value: unknown) => String(value || '')
  .normalize('NFKC')
  .replace(/[\s\p{P}\p{S}]+/gu, '')
  .toLocaleLowerCase()

export type FlowDecisionScopeLookup = {
  stepKeys: Set<string>
  branchKeys: Set<string>
}

export const createFlowDecisionScopeLookup = (scheme: unknown): FlowDecisionScopeLookup => {
  const record = isRecord(scheme) ? scheme : {}
  const branches = Array.isArray(record.branches) ? record.branches.filter(isRecord) : []
  const steps = [
    ...(Array.isArray(record.mainPath) ? record.mainPath.filter(isRecord) : []),
    ...branches.flatMap(branch => (Array.isArray(branch.steps) ? branch.steps.filter(isRecord) : [])),
  ]
  return {
    stepKeys: new Set(steps.map(step => String(step.key || '').trim()).filter(Boolean)),
    branchKeys: new Set(branches.map(branch => String(branch.key || '').trim()).filter(Boolean)),
  }
}

const personnelStepKeyOf = (question: Record<string, unknown>) => {
  const personnel = isRecord(question.personnelDecision) ? question.personnelDecision : null
  const explicit = String(personnel?.stepKey || '').trim()
  if (explicit) return explicit
  const structured = /^flow\.personnel:(.+):(?:source|binding|approval_level|multi_person|empty_handler|same_as_submitter)$/u
    .exec(String(question.decisionKey || '').trim())
  return String(structured?.[1] || '').trim()
}

// 归属可以推：模型常只写 scopeKind，甚至整段省略。缺 scope 本身不是建模错误，
// 只有显式写了却指向不存在的节点才值得打回。
export const resolveFlowQuestionDecisionScope = (
  question: unknown,
  openQuestions: unknown,
  lookup: FlowDecisionScopeLookup,
): NocodeEditorFlowDecisionScope => {
  const record = isRecord(question) ? question : {}
  const explicit = isRecord(record.decisionScope) ? record.decisionScope : null
  const explicitKind = String(explicit?.kind || '')
  const explicitId = String(explicit?.id || '').trim()
  if (explicitKind && explicitId) {
    return { kind: explicitKind as NocodeEditorFlowDecisionScope['kind'], id: explicitId }
  }
  const stepKey = personnelStepKeyOf(record)
  if (stepKey && lookup.stepKeys.has(stepKey)) {
    return { kind: 'step', id: stepKey }
  }
  const decisionKey = String(record.decisionKey || record.id || '').trim()
  const linked = (Array.isArray(openQuestions) ? openQuestions : [])
    .filter(isRecord)
    .find(item => String(item.key || '').trim() === decisionKey)
  const linkedKey = String(linked?.scopeKey || '').trim()
  if (linkedKey && linked?.scopeKind === 'step' && lookup.stepKeys.has(linkedKey)) {
    return { kind: 'step', id: linkedKey }
  }
  if (linkedKey && linked?.scopeKind === 'branch' && lookup.branchKeys.has(linkedKey)) {
    return { kind: 'branch', id: linkedKey }
  }
  return { kind: 'flow', id: 'main' }
}

export const validateRawFlowDecisionContract = (
  value: unknown,
  decisionSnapshot?: Record<string, string>,
  trustedFactSnapshot?: Record<string, unknown>,
): FlowDecisionDiagnostic[] => {
  const scheme = isRecord(value) && isRecord(value.scheme) ? value.scheme : value
  if (!isRecord(scheme)) return []
  const { questions, openQuestions } = rawQuestions(scheme)
  const diagnostics: FlowDecisionDiagnostic[] = []
  const confirmation = isRecord(scheme.confirmation) ? scheme.confirmation : {}
  const version = confirmation.decisionContractVersion ?? scheme.decisionContractVersion
  const isVersioned = version === 2
  if (version !== undefined && !isVersioned) diagnostics.push({ code: 'invalid_contract_version', decisionKey: '' })
  const factSnapshot = isRecord(confirmation.factSnapshot)
    ? confirmation.factSnapshot
    : isRecord(scheme.factSnapshot) ? scheme.factSnapshot : {}
  if (isVersioned) {
    Object.entries(factSnapshot).forEach(([factKey, fact]) => {
      if (!isRecord(fact) || typeof fact.value !== 'string'
        || !['user', 'history', 'runtime'].includes(String(fact.source))) diagnostics.push({
        code: 'invalid_fact_snapshot', decisionKey: '', factKey,
      })
      else if (trustedFactSnapshot && JSON.stringify(fact) !== JSON.stringify(trustedFactSnapshot[factKey])) diagnostics.push({
        code: 'untrusted_fact_snapshot', decisionKey: '', factKey,
      })
    })
  }
  const byKey = new Map<string, Record<string, unknown>>()
  const scopeLookup = createFlowDecisionScopeLookup(scheme)
  questions.forEach((question) => {
    const key = String(question.decisionKey || '').trim()
    if (!key) diagnostics.push({ code: 'missing_decision_key', decisionKey: String(question.id || '').trim() })
    else if (byKey.has(key)) diagnostics.push({ code: 'duplicate_decision_key', decisionKey: key })
    else byKey.set(key, question)
    const title = String(question.title || '').normalize('NFKC').toLocaleLowerCase()
    if (
      question.questionKind === 'binary'
      && /(?:还是|或者|或|rather\s+than|instead\s+of|\bor\b)/u.test(title)
    ) diagnostics.push({
      code: 'binary_question_has_alternative_answers',
      decisionKey: key,
    })
    if (isVersioned) {
      const scope = resolveFlowQuestionDecisionScope(question, openQuestions, scopeLookup)
      const valid = scope.kind === 'flow' ? Boolean(scope.id)
        : scope.kind === 'path' ? scope.id === 'main' || scopeLookup.branchKeys.has(scope.id)
          : scope.kind === 'branch' ? scopeLookup.branchKeys.has(scope.id)
            : scope.kind === 'step' ? scopeLookup.stepKeys.has(scope.id)
              : scope.kind === 'object' ? Boolean(scope.id) : false
      if (!valid) diagnostics.push({ code: 'invalid_decision_scope', decisionKey: key, scopeKey: scope.id })
      const factFields = ['requiresFacts', 'producesFacts', 'changes']
      if (factFields.some(field => question[field] !== undefined && !Array.isArray(question[field]))) {
        diagnostics.push({ code: 'invalid_fact_snapshot', decisionKey: key })
      }
    }
  })

  // Raw values are inspected before normalization can synthesize ids or answers.
  const graphQuestions = questions.filter(question => String(question.decisionKey || '').trim())
    .map((question) => {
      const key = String(question.decisionKey)
      const trustedAnswer = decisionSnapshot?.[key]
      return {
        ...question,
        id: String(question.id || ''),
        decisionKey: key,
        ...(trustedAnswer === undefined ? {} : {
          confirmed: true,
          selectedOptionValue: trustedAnswer,
        }),
      }
    }) as NocodeEditorAiConfirmQuestion[]
  graphQuestions.forEach((question) => {
    question.prerequisites?.forEach((condition) => {
      const parent = byKey.get(String(condition.decisionKey || '').trim())
      const options = Array.isArray(parent?.options) ? parent.options.filter(isRecord) : []
      if (
        !['equals', 'in'].includes(condition.operator)
        || !Array.isArray(condition.values)
        || !condition.values.length
        || !options.length
        || condition.values.some(value => !options.some(option => option.value === value))
      ) diagnostics.push({
        code: 'invalid_prerequisite_reference',
        decisionKey: String(question.decisionKey),
        dependencyKey: String(condition.decisionKey || ''),
      })
    })
  })
  const factProjection = isVersioned
    ? augmentFactDependencies(graphQuestions.map(question => ({
      ...question,
      requiresFacts: factKeys(question.requiresFacts),
      producesFacts: factKeys(question.producesFacts),
    })), factSnapshot)
    : { questions: graphQuestions, diagnostics: [] as FlowDecisionDiagnostic[] }
  diagnostics.push(...factProjection.diagnostics)
  const graphDiagnostics = validateFlowDecisionGraph(factProjection.questions)
  diagnostics.push(...graphDiagnostics.map(item => ({
    ...item,
    code: item.code === 'duplicate_key' ? 'duplicate_decision_key' as const
      : ['unknown_dependency', 'self_dependency', 'cycle', 'invalid_option'].includes(item.code)
        ? 'invalid_prerequisite_reference' as const : item.code,
  })))
  if (graphDiagnostics.some(item => ['unknown_dependency', 'self_dependency', 'cycle'].includes(item.code))) return diagnostics

  const projection = projectFlowDecisionQuestions(factProjection.questions)
  const readyKeys = new Set(projection.ready.map(question => String(question.decisionKey)))
  // openQuestions 只是本轮可答题的索引，就绪状态由依赖图唯一决定；索引与就绪集合不一致
  // （后置题还没轮到、可答题漏写）交给归一化自行收敛，不为可推导的偏差整份方案重跑。
  if (byKey.size > 0) {
    openQuestions.forEach((question) => {
      const key = String(question.key || question.decisionKey || '').trim()
      if (!key || !byKey.has(key)) {
        diagnostics.push({
          code: 'open_question_confirmation_mismatch',
          decisionKey: key,
          reason: 'unknown_key',
        })
      }
    })
  }

  const seenTitles = new Map<string, string>()
  openQuestions.forEach((question) => {
    const key = String(question.key || '').trim()
    if (!readyKeys.has(key)) return
    const scope = `${String(question.scopeKind || 'global').trim()}|${String(question.scopeKey || '').trim()}`
    const titleKey = `${scope}|${normalizedTitle(question.title)}`
    if (!normalizedTitle(question.title)) return
    const previous = seenTitles.get(titleKey)
    if (previous && previous !== key) diagnostics.push({
      code: 'duplicate_pending_question', decisionKey: key,
      dependencyKey: previous, scopeKey: scope,
    })
    else seenTitles.set(titleKey, key)
  })
  return diagnostics
}

/**
 * Checks the raw tool payload before normalization erases whether a model
 * explicitly considered a question's dependencies. Independent questions must
 * send `dependsOn: []`; dependent questions must send `dependsOn` or
 * `prerequisites`.
 */
export const validateRawFlowDecisionDependencyDeclarations = (
  value: unknown,
): FlowDecisionDiagnostic[] => {
  const scheme = isRecord(value) && isRecord(value.scheme) ? value.scheme : value
  if (!isRecord(scheme)) return []
  return rawQuestions(scheme).questions.flatMap((item) => {
    if (!isRecord(item)) return []
    const decisionKey = String(item.decisionKey || item.id || '').trim()
    if (!decisionKey) return []
    const hasDependsOn = Object.prototype.hasOwnProperty.call(item, 'dependsOn')
      || Object.prototype.hasOwnProperty.call(item, 'depends_on')
    const hasPrerequisites = Object.prototype.hasOwnProperty.call(item, 'prerequisites')
    return hasDependsOn || hasPrerequisites
      ? []
      : [{ code: 'missing_dependency_declaration' as const, decisionKey }]
  })
}

const MODEL_ACTIONABLE_FLOW_DECISION_DIAGNOSTIC_FIELDS = [
  'code',
  'message',
  'decisionKey',
  'dependencyKey',
  'factKey',
  'scopeKey',
  'reason',
] as const

/**
 * 决策契约失败要回传出错的决策键、依赖键、事实键，模型才能定位并自修；
 * 只回传笼统文案会让模型在下一轮盲目重发同一份 payload。
 */
export const projectModelActionableFlowDecisionDiagnostics = (
  diagnostics: FlowDecisionDiagnostic[] | undefined,
  limit = 8,
): Record<string, unknown>[] => {
  const source = Array.isArray(diagnostics) ? diagnostics : []
  return source
    .filter(item => isRecord(item))
    .map((diagnostic) => {
      const picked: Record<string, unknown> = {}
      MODEL_ACTIONABLE_FLOW_DECISION_DIAGNOSTIC_FIELDS.forEach((field) => {
        const value = String(diagnostic[field] || '').trim()
        if (value) picked[field] = value
      })
      return picked
    })
    .filter(item => Boolean(item.code))
    .slice(0, limit)
}

export const validateFlowDecisionGraph = (
  questions: NocodeEditorAiConfirmQuestion[],
): FlowDecisionDiagnostic[] => {
  const diagnostics: FlowDecisionDiagnostic[] = []
  const byKey = new Map<string, NocodeEditorAiConfirmQuestion>()
  questions.forEach((question) => {
    const key = keyOf(question)
    if (byKey.has(key)) diagnostics.push({ code: 'duplicate_key', decisionKey: key })
    else byKey.set(key, question)
  })

  const edges = new Map<string, string[]>()
  questions.forEach((question) => {
    const key = keyOf(question)
    const dependencies = [
      ...(question.dependsOn || []),
      ...(question.prerequisites || []).map(item => item.decisionKey),
    ]
    edges.set(key, dependencies)
    dependencies.forEach((dependencyKey) => {
      if (dependencyKey === key) diagnostics.push({ code: 'self_dependency', decisionKey: key, dependencyKey })
      else if (!byKey.has(dependencyKey)) diagnostics.push({ code: 'unknown_dependency', decisionKey: key, dependencyKey })
    })
    question.prerequisites?.forEach((condition) => {
      const parent = byKey.get(condition.decisionKey)
      if (parent?.options?.length && condition.values.some(value => !parent.options?.some(option => option.value === value))) {
        diagnostics.push({ code: 'invalid_option', decisionKey: key, dependencyKey: condition.decisionKey })
      }
    })
    if (question.uncertainty?.category === 'safe_default') {
      const nodeType = question.uncertainty.nodeType || ''
      const settingPath = question.uncertainty.settingPath || ''
      if (!findFlowSafeDefaultRule(nodeType, settingPath)) {
        diagnostics.push({ code: 'unsafe_default', decisionKey: key })
      }
    }
  })

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (key: string) => {
    if (visiting.has(key)) {
      diagnostics.push({ code: 'cycle', decisionKey: key })
      return
    }
    if (visited.has(key)) return
    visiting.add(key)
    edges.get(key)?.forEach(dependency => {
      if (byKey.has(dependency)) visit(dependency)
    })
    visiting.delete(key)
    visited.add(key)
  }
  byKey.forEach((_, key) => visit(key))
  return diagnostics
}

export const projectFlowDecisionQuestions = (
  questions: NocodeEditorAiConfirmQuestion[],
  decisionSnapshot?: Record<string, string>,
) => {
  const byKey = new Map(questions.map(question => [keyOf(question), question]))
  const states = new Map<string, FlowDecisionState>()
  const hasAnswer = (question: NocodeEditorAiConfirmQuestion) => (
    decisionSnapshot
      ? Object.prototype.hasOwnProperty.call(decisionSnapshot, keyOf(question))
      : answered(question)
  )
  const answerValue = (question: NocodeEditorAiConfirmQuestion) => (
    decisionSnapshot
      ? String(decisionSnapshot[keyOf(question)] ?? '')
      : selectedValue(question)
  )
  const resolve = (
    question: NocodeEditorAiConfirmQuestion,
    inspecting: Set<string> = new Set(),
  ): FlowDecisionState => {
    const key = keyOf(question)
    const cached = states.get(key)
    if (cached) return cached
    // 历史方案或外部拼装方案可能成环；环内节点按“被前置阻塞”处理，不能递归到栈溢出。
    if (inspecting.has(key)) return 'blocked_by_prerequisite'
    const nextInspecting = new Set(inspecting)
    nextInspecting.add(key)
    const dependencies = [
      ...(question.dependsOn || []),
      ...(question.prerequisites || []).map(item => item.decisionKey),
    ]
    const parentStates = dependencies.map((dependency) => {
      const parent = byKey.get(dependency)
      if (!parent) return 'blocked_by_prerequisite'
      return resolve(parent, nextInspecting)
    })
    const inapplicable = parentStates.includes('inapplicable') || (question.prerequisites || []).some(condition => {
      const parent = byKey.get(condition.decisionKey)
      return parent && hasAnswer(parent) && !condition.values.includes(answerValue(parent))
    })
    const blocked = parentStates.some(state => state !== 'resolved')
    const state: FlowDecisionState = inapplicable
      ? 'inapplicable'
      : blocked ? 'blocked_by_prerequisite' : hasAnswer(question) ? 'resolved' : 'ready'
    states.set(key, state)
    return state
  }
  questions.forEach(question => resolve(question))
  return {
    states,
    ready: questions.filter(question => states.get(keyOf(question)) === 'ready'),
    unresolved: questions.filter(question => {
      const state = states.get(keyOf(question))
      return state === 'ready' || state === 'blocked_by_prerequisite'
    }),
  }
}

export const invalidateFlowDecisionAnswers = (
  questions: NocodeEditorAiConfirmQuestion[],
  changedDecisionKeys: string[],
) => {
  const affected = new Set(changedDecisionKeys)
  let changed = true
  while (changed) {
    changed = false
    questions.forEach((question) => {
      const key = keyOf(question)
      if (affected.has(key)) return
      if ([...(question.dependsOn || []), ...(question.prerequisites || []).map(item => item.decisionKey)]
        .some(dependency => affected.has(dependency))) {
        affected.add(key)
        changed = true
      }
    })
  }
  return questions.map(question => affected.has(keyOf(question)) && !changedDecisionKeys.includes(keyOf(question))
    ? {
      ...question,
      confirmed: false,
      selectedOptionValue: undefined,
      answerSummary: undefined,
      answerDetail: undefined,
      options: question.options?.map(option => ({ ...option, selected: false })),
    }
    : question)
}
