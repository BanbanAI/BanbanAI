import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'
import { findFlowSafeDefaultRule } from './nocodeEditorFlowSafeDefaults'
import {
  filterPendingNocodeEditorFlowConfirmationQuestions,
  filterPendingNocodeEditorFlowQuestionRecords,
  pruneDanglingFlowDecisionReferences,
} from './nocodeEditorFlowQuestionPolicy'

export type FlowDecisionDiagnostic = {
  code: 'duplicate_key' | 'unknown_dependency' | 'self_dependency' | 'cycle' | 'invalid_option' | 'unsafe_default' | 'missing_dependency_declaration'
    | 'missing_decision_key' | 'duplicate_decision_key' | 'open_question_confirmation_mismatch' | 'duplicate_pending_question' | 'invalid_prerequisite_reference'
    | 'invalid_contract_version' | 'missing_decision_scope' | 'invalid_decision_scope' | 'unknown_fact' | 'duplicate_fact_producer'
    | 'binary_question_has_alternative_answers'
    | 'fact_dependency_cycle' | 'invalid_fact_snapshot' | 'untrusted_fact_snapshot'
  decisionKey: string
  dependencyKey?: string
  scopeKey?: string
  factKey?: string
  source?: 'explicit' | 'fact'
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

export const projectFlowDecisionContract = (
  questions: NocodeEditorAiConfirmQuestion[],
  factSnapshot: Record<string, unknown> = {},
  decisionSnapshot?: Record<string, string>,
) => {
  const augmented = augmentFactDependencies(questions, factSnapshot)
  const graphDiagnostics = validateFlowDecisionGraph(augmented.questions)
  if (augmented.diagnostics.length || graphDiagnostics.length) return {
    states: new Map<string, FlowDecisionState>(),
    ready: [] as NocodeEditorAiConfirmQuestion[],
    unresolved: [] as NocodeEditorAiConfirmQuestion[],
    questions: augmented.questions,
    diagnostics: [...augmented.diagnostics, ...graphDiagnostics],
  }
  return {
    ...projectFlowDecisionQuestions(augmented.questions, decisionSnapshot),
    questions: augmented.questions,
    diagnostics: augmented.diagnostics,
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
      const scope = isRecord(question.decisionScope) ? question.decisionScope : null
      if (!scope) diagnostics.push({ code: 'missing_decision_scope', decisionKey: key })
      else {
        const kind = String(scope.kind || '')
        const id = String(scope.id || '').trim()
        const steps = Array.isArray(scheme.mainPath) ? scheme.mainPath.filter(isRecord) : []
        const branches = Array.isArray(scheme.branches) ? scheme.branches.filter(isRecord) : []
        const valid = kind === 'flow' ? Boolean(id)
          : kind === 'path' ? id === 'main' || branches.some(branch => branch.key === id)
          : kind === 'branch' ? branches.some(branch => branch.key === id)
            : kind === 'step' ? [...steps, ...branches.flatMap(branch => Array.isArray(branch.steps) ? branch.steps.filter(isRecord) : [])]
              .some(step => step.key === id)
              : kind === 'object' ? Boolean(id) : false
        if (!valid) diagnostics.push({ code: 'invalid_decision_scope', decisionKey: key, scopeKey: id })
      }
      if (!Array.isArray(question.requiresFacts) || !Array.isArray(question.producesFacts)
        || !Array.isArray(question.changes)) diagnostics.push({ code: 'invalid_fact_snapshot', decisionKey: key })
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
  const openCounts = new Map<string, number>()
  openQuestions.forEach((question) => {
    const key = String(question.key || '').trim()
    openCounts.set(key, (openCounts.get(key) || 0) + 1)
    if (!key || !readyKeys.has(key)) {
      diagnostics.push({ code: 'open_question_confirmation_mismatch', decisionKey: key })
    }
  })
  readyKeys.forEach(key => {
    if (openCounts.get(key) !== 1) {
      diagnostics.push({ code: 'open_question_confirmation_mismatch', decisionKey: key })
    }
  })

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
  'decisionKey',
  'dependencyKey',
  'factKey',
  'scopeKey',
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
  const resolve = (question: NocodeEditorAiConfirmQuestion): FlowDecisionState => {
    const key = keyOf(question)
    const cached = states.get(key)
    if (cached) return cached
    const dependencies = [
      ...(question.dependsOn || []),
      ...(question.prerequisites || []).map(item => item.decisionKey),
    ]
    // A validated acyclic graph is required before this projection is used.
    const parentStates = dependencies.map(dependency => {
      const parent = byKey.get(dependency)
      if (!parent) return 'blocked_by_prerequisite'
      return resolve(parent)
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
  questions.forEach(resolve)
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
