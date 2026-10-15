import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorConfirmationDecision,
} from './nocodeEditorConfirmationDecisionProjection'
import {
  isSamePlanningConfirmationContext,
} from './nocodeEditorPlanningConfirmationIdentity'
import {
  invalidateFlowDecisionAnswers,
  projectFlowDecisionContract,
} from './nocodeEditorFlowDecisionGraph'
import {
  canonicalizeFlowDecisionQuestionValues,
  canonicalizeFlowDecisionValue,
} from './nocodeEditorFlowDecisionValueAliases'

export type NocodeEditorConfirmationDecisionConflict = {
  code: 'confirmed_decision_value_conflict' | 'confirmed_decision_option_unavailable'
  decisionKey: string
  previousValue?: string
  proposedValue?: string
  questionId: string
  questionTitle: string
}

export type NocodeEditorConfirmationDecisionReconciliation = {
  confirmation: NocodeEditorAiConfirmPayload | null
  inheritedDecisionKeys: string[]
  resolvedDecisionKeys: string[]
  unresolvedDecisionKeys: string[]
  conflicts: NocodeEditorConfirmationDecisionConflict[]
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

type CanonicalAnswer = {
  selectedValue: string
  answerSummary: string
  answerDetail: string
}

type CanonicalCurrentAnswer = CanonicalAnswer & {
  hasAnswer: boolean
  isResolved: boolean
  invalidSelection?: ValueConflictDetail
  unavailableSelectedValue?: string
}

type ValueConflictDetail = {
  previousValue?: string
  proposedValue?: string
}

type CurrentDecisionGroup = {
  question: NocodeEditorAiConfirmQuestion
  decisionKey: string
  answer: CanonicalCurrentAnswer
  constraintKey: string
  conflictDetail?: ValueConflictDetail
}

type PreviousDecisionEntry = {
  decision: NocodeEditorConfirmationDecision
  answer: CanonicalAnswer
}

const cloneQuestion = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  const clonedQuestion = { ...question }
  if (question.options) {
    clonedQuestion.options = question.options.map(option => ({ ...option }))
  }
  if (question.dependsOn) {
    clonedQuestion.dependsOn = [...question.dependsOn]
  }
  if (question.prerequisites) {
    clonedQuestion.prerequisites = question.prerequisites.map(item => ({
      ...item,
      values: [...item.values],
    }))
  }
  if (question.requiresFacts) {
    clonedQuestion.requiresFacts = [...question.requiresFacts]
  }
  if (question.producesFacts) {
    clonedQuestion.producesFacts = [...question.producesFacts]
  }
  if (question.changes) {
    clonedQuestion.changes = [...question.changes]
  }
  if (question.dependencySources) {
    clonedQuestion.dependencySources = { ...question.dependencySources }
  }
  return clonedQuestion
}

const resolveDecisionKey = (question: NocodeEditorAiConfirmQuestion) => (
  normalizeText(question.decisionKey) || normalizeText(question.id)
)

const resolvePreviousDecisionKey = (
  decision: NocodeEditorConfirmationDecision,
) => normalizeText(decision.decisionKey) || normalizeText(decision.questionId)

const buildCanonicalCurrentAnswer = (
  question: NocodeEditorAiConfirmQuestion,
  options: {
    allowCompletedConfirmedEmpty: boolean
  },
): CanonicalCurrentAnswer => {
  if (question.confirmed === false) {
    return {
      selectedValue: '',
      answerSummary: '',
      answerDetail: '',
      hasAnswer: false,
      isResolved: false,
    }
  }

  const explicitSelectedValue = normalizeText(question.selectedOptionValue)
  const selectedOptionValues = (question.options || [])
    .filter(option => option.selected === true)
    .map(option => normalizeText(option.value))
  const optionValues = (question.options || []).map(option => normalizeText(option.value))
  const selectedOptionValue = selectedOptionValues[0] || ''
  const rawAnswerSummary = normalizeText(question.answerSummary)
  const rawAnswerDetail = normalizeText(question.answerDetail)
  const invalidSelection = selectedOptionValues.length > 1
    || (selectedOptionValues.length === 1 && !selectedOptionValue)
    || Boolean(
      explicitSelectedValue
      && selectedOptionValue
      && explicitSelectedValue !== selectedOptionValue,
    )
  const selectedValue = explicitSelectedValue || selectedOptionValue
  const canUseTextAnswer = optionValues.length === 0 || question.allowFreeText !== false
  const answerSummary = canUseTextAnswer ? rawAnswerSummary : ''
  const answerDetail = canUseTextAnswer ? rawAnswerDetail : ''
  const hasAnswer = Boolean(
    selectedValue
    || selectedOptionValues.length
    || answerSummary
    || answerDetail,
  )

  return {
    selectedValue,
    answerSummary,
    answerDetail,
    hasAnswer,
    isResolved: hasAnswer
      || (
        options.allowCompletedConfirmedEmpty
        && question.confirmed === true
        && canUseTextAnswer
      ),
    invalidSelection: invalidSelection
      ? {
        previousValue: explicitSelectedValue || selectedOptionValues[0] || undefined,
        proposedValue: selectedOptionValues[1] || selectedOptionValue || undefined,
      }
      : undefined,
    unavailableSelectedValue: selectedValue
      && optionValues.length > 0
      && !optionValues.includes(selectedValue)
      ? selectedValue
      : undefined,
  }
}

const buildCanonicalPreviousAnswer = (
  decision: NocodeEditorConfirmationDecision,
): CanonicalAnswer => ({
  selectedValue: canonicalizeFlowDecisionValue(
    resolvePreviousDecisionKey(decision),
    decision.selectedOptionValue,
  ),
  answerSummary: normalizeText(decision.answerSummary),
  answerDetail: normalizeText(decision.answerDetail),
})

const isSameCanonicalAnswer = (
  left: CanonicalAnswer,
  right: CanonicalAnswer,
) => {
  if (left.selectedValue || right.selectedValue) {
    return Boolean(
      left.selectedValue
      && right.selectedValue
      && left.selectedValue === right.selectedValue,
    )
  }

  return left.answerSummary === right.answerSummary
    && left.answerDetail === right.answerDetail
}

const buildQuestionConstraintKey = (question: NocodeEditorAiConfirmQuestion) => JSON.stringify({
  allowFreeText: question.allowFreeText !== false,
  branchKey: normalizeText(question.branchKey),
  decisionScope: question.decisionScope || null,
  dependsOn: (question.dependsOn || []).map(normalizeText).sort(),
  domain: normalizeText(question.domain),
  options: (question.options || []).map(option => [
    normalizeText(option.value),
    normalizeText(option.label),
    normalizeText(option.description),
  ]).sort((a, b) => a[0].localeCompare(b[0])),
  personnelDecision: question.personnelDecision || null,
  prerequisites: (question.prerequisites || []).map(condition => ({
    decisionKey: normalizeText(condition.decisionKey),
    operator: condition.operator,
    values: condition.values.map(normalizeText).sort(),
  })).sort((a, b) => a.decisionKey.localeCompare(b.decisionKey)),
  questionKind: normalizeText(question.questionKind),
  required: question.required !== false,
  requiresFacts: (question.requiresFacts || []).map(normalizeText).sort(),
  scopeKind: normalizeText(question.scopeKind),
})

const buildCurrentDecisionGroups = (
  questions: NocodeEditorAiConfirmQuestion[],
  options: {
    allowCompletedConfirmedEmpty: boolean
  },
) => {
  const groups: CurrentDecisionGroup[] = []
  const groupsByKey = new Map<string, CurrentDecisionGroup>()

  questions.forEach((rawQuestion) => {
    const question = canonicalizeFlowDecisionQuestionValues(rawQuestion)
    const decisionKey = resolveDecisionKey(question)
    const answer = buildCanonicalCurrentAnswer(question, options)
    const constraintKey = buildQuestionConstraintKey(question)
    const group: CurrentDecisionGroup = {
      question,
      decisionKey,
      answer,
      constraintKey,
      conflictDetail: answer.invalidSelection,
    }

    if (!decisionKey) {
      group.conflictDetail = group.conflictDetail || {}
      groups.push(group)
      return
    }

    const existingGroup = groupsByKey.get(decisionKey)
    if (!existingGroup) {
      groupsByKey.set(decisionKey, group)
      groups.push(group)
      return
    }

    if (
      !existingGroup.conflictDetail
      && (
        Boolean(answer.invalidSelection)
        || existingGroup.answer.isResolved !== answer.isResolved
        || !isSameCanonicalAnswer(existingGroup.answer, answer)
        || existingGroup.constraintKey !== constraintKey
      )
    ) {
      existingGroup.conflictDetail = answer.invalidSelection || {
        previousValue: existingGroup.answer.selectedValue || undefined,
        proposedValue: answer.selectedValue || undefined,
      }
    }
  })

  return groups
}

const buildPreviousDecisionsByKey = (input: {
  previousDecisions: NocodeEditorConfirmationDecision[]
  expectedPlanningContextKey: string
}) => {
  const decisionsByKey = new Map<string, PreviousDecisionEntry>()
  const conflictsByKey = new Map<string, ValueConflictDetail>()

  input.previousDecisions.forEach((decision) => {
    const planningContextKey = normalizeText(decision.planningContextKey)
    if (
      input.expectedPlanningContextKey
      && (
        !planningContextKey
        || !isSamePlanningConfirmationContext(
          planningContextKey,
          input.expectedPlanningContextKey,
        )
      )
    ) {
      return
    }

    const decisionKey = resolvePreviousDecisionKey(decision)
    if (!decisionKey) {
      return
    }

    const answer = buildCanonicalPreviousAnswer(decision)
    const existingEntry = decisionsByKey.get(decisionKey)
    if (!existingEntry) {
      decisionsByKey.set(decisionKey, { decision, answer })
      return
    }

    if (!conflictsByKey.has(decisionKey) && !isSameCanonicalAnswer(existingEntry.answer, answer)) {
      conflictsByKey.set(decisionKey, {
        previousValue: existingEntry.answer.selectedValue || undefined,
        proposedValue: answer.selectedValue || undefined,
      })
    }
  })

  return {
    decisionsByKey,
    conflictsByKey,
  }
}

const materializeQuestionDecisionKey = (
  question: NocodeEditorAiConfirmQuestion,
  decisionKey: string,
  options: {
    preserveTrustedDecisionKeySource: boolean
  },
) => {
  const materializedQuestion = cloneQuestion(question)
  const explicitDecisionKey = normalizeText(question.decisionKey)
  const questionId = normalizeText(question.id)
  if (decisionKey) {
    materializedQuestion.decisionKey = decisionKey
  } else {
    delete materializedQuestion.decisionKey
  }
  if (
    options.preserveTrustedDecisionKeySource
    && question.decisionKeySource === 'legacy_question_id'
    && explicitDecisionKey === questionId
  ) {
    materializedQuestion.decisionKeySource = 'legacy_question_id'
  } else if (decisionKey) {
    if (explicitDecisionKey) {
      delete materializedQuestion.decisionKeySource
    } else {
      materializedQuestion.decisionKeySource = 'legacy_question_id'
    }
  } else {
    delete materializedQuestion.decisionKeySource
  }
  return materializedQuestion
}

const buildPendingQuestionShell = (
  question: NocodeEditorAiConfirmQuestion,
) => {
  const pendingQuestion = cloneQuestion(question)
  pendingQuestion.confirmed = false
  delete pendingQuestion.selectedOptionValue
  delete pendingQuestion.answerSummary
  delete pendingQuestion.answerDetail
  if (pendingQuestion.options) {
    pendingQuestion.options = pendingQuestion.options.map(option => ({
      ...option,
      selected: false,
    }))
  }
  return pendingQuestion
}

/**
 * 把已确认但不在当前选项里的取值并回选项，保留结论而不是判成「选项不可用」。
 * 选项措辞会随重新规划漂移（如 submit_auto 与 submit），这类漂移不该让用户重答。
 */
const mergeConfirmedDecisionOption = (
  question: NocodeEditorAiConfirmQuestion,
  value: string,
): NocodeEditorAiConfirmQuestion => {
  const targetValue = normalizeText(value)
  if (!targetValue) {
    return question
  }
  const mergedQuestion = cloneQuestion(question)
  mergedQuestion.confirmed = true
  mergedQuestion.selectedOptionValue = targetValue
  const options = mergedQuestion.options || []
  if (!options.some(option => normalizeText(option.value) === targetValue)) {
    options.push({ value: targetValue, label: targetValue })
  }
  mergedQuestion.options = options.map(option => ({
    ...option,
    selected: normalizeText(option.value) === targetValue,
  }))
  return mergedQuestion
}

const inheritPreviousDecision = (input: {
  question: NocodeEditorAiConfirmQuestion
  previousEntry: PreviousDecisionEntry
}) => {
  const selectedOptionValue = input.previousEntry.answer.selectedValue
  const answerSummary = input.previousEntry.answer.answerSummary
  const answerDetail = input.previousEntry.answer.answerDetail
  const inheritedQuestion = cloneQuestion(input.question)
  inheritedQuestion.confirmed = true

  if (selectedOptionValue) {
    inheritedQuestion.selectedOptionValue = selectedOptionValue
  } else {
    delete inheritedQuestion.selectedOptionValue
  }
  if (answerSummary) {
    inheritedQuestion.answerSummary = answerSummary
  } else {
    delete inheritedQuestion.answerSummary
  }
  if (answerDetail) {
    inheritedQuestion.answerDetail = answerDetail
  } else {
    delete inheritedQuestion.answerDetail
  }
  if (input.question.options) {
    inheritedQuestion.options = input.question.options.map(option => ({
      ...option,
      selected: Boolean(
        selectedOptionValue
        && normalizeText(option.value) === selectedOptionValue,
      ),
    }))
  }

  return inheritedQuestion
}

const pushUnique = (values: string[], seen: Set<string>, value: string) => {
  if (!value || seen.has(value)) {
    return
  }
  seen.add(value)
  values.push(value)
}

const buildValueConflict = (input: {
  decisionKey: string
  question: NocodeEditorAiConfirmQuestion
  detail?: ValueConflictDetail
}): NocodeEditorConfirmationDecisionConflict => {
  const conflict: NocodeEditorConfirmationDecisionConflict = {
    code: 'confirmed_decision_value_conflict',
    decisionKey: input.decisionKey,
    questionId: normalizeText(input.question.id),
    questionTitle: normalizeText(input.question.title),
  }
  const previousValue = normalizeText(input.detail?.previousValue)
  const proposedValue = normalizeText(input.detail?.proposedValue)
  if (previousValue) {
    conflict.previousValue = previousValue
  }
  if (proposedValue) {
    conflict.proposedValue = proposedValue
  }
  return conflict
}

const buildOptionUnavailableConflict = (input: {
  decisionKey: string
  question: NocodeEditorAiConfirmQuestion
  previousValue?: string
  proposedValue?: string
}): NocodeEditorConfirmationDecisionConflict => {
  const conflict: NocodeEditorConfirmationDecisionConflict = {
    code: 'confirmed_decision_option_unavailable',
    decisionKey: input.decisionKey,
    questionId: normalizeText(input.question.id),
    questionTitle: normalizeText(input.question.title),
  }
  const previousValue = normalizeText(input.previousValue)
  const proposedValue = normalizeText(input.proposedValue)
  if (previousValue) {
    conflict.previousValue = previousValue
  }
  if (proposedValue) {
    conflict.proposedValue = proposedValue
  }
  return conflict
}

export const reconcileNocodeEditorConfirmationDecisions = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  previousConfirmation?: NocodeEditorAiConfirmPayload | null
  previousDecisions?: NocodeEditorConfirmationDecision[]
  expectedPlanningContextKey?: string
  preserveTrustedDecisionKeySource?: boolean
  trustedCurrentDecisionKeys?: string[]
}): NocodeEditorConfirmationDecisionReconciliation => {
  if (!input.confirmation) {
    return {
      confirmation: null,
      inheritedDecisionKeys: [],
      resolvedDecisionKeys: [],
      unresolvedDecisionKeys: [],
      conflicts: [],
    }
  }

  const inheritedDecisionKeys: string[] = []
  const resolvedDecisionKeys: string[] = []
  const unresolvedDecisionKeys: string[] = []
  const inheritedDecisionKeySet = new Set<string>()
  const resolvedDecisionKeySet = new Set<string>()
  const unresolvedDecisionKeySet = new Set<string>()
  const conflicts: NocodeEditorConfirmationDecisionConflict[] = []
  const changedDecisionKeys: string[] = []
  const currentDecisionGroups = buildCurrentDecisionGroups(
    input.confirmation.questions,
    {
      allowCompletedConfirmedEmpty: input.confirmation.status === 'completed',
    },
  )
  const previousDecisionState = buildPreviousDecisionsByKey({
    previousDecisions: input.previousDecisions || [],
    expectedPlanningContextKey: normalizeText(input.expectedPlanningContextKey),
  })
  const previousQuestionsByKey = new Map(
    (input.previousConfirmation?.questions || []).map((question) => {
      const canonicalQuestion = canonicalizeFlowDecisionQuestionValues(question)
      return [resolveDecisionKey(canonicalQuestion), canonicalQuestion]
    }),
  )
  const trustedCurrentDecisionKeys = new Set(
    (input.trustedCurrentDecisionKeys || []).map(normalizeText).filter(Boolean),
  )

  const questions = currentDecisionGroups.map((group) => {
    const decisionKey = group.decisionKey
    const question = materializeQuestionDecisionKey(group.question, decisionKey, {
      preserveTrustedDecisionKeySource: input.preserveTrustedDecisionKeySource === true,
    })
    const previousEntry = previousDecisionState.decisionsByKey.get(decisionKey)
    const previousQuestion = previousQuestionsByKey.get(decisionKey)
    const historicalConflictDetail = previousDecisionState.conflictsByKey.get(decisionKey)
    const hasTrustedCurrentAnswer = trustedCurrentDecisionKeys.has(decisionKey)
      && group.answer.hasAnswer
    if (previousEntry?.decision.decisionKeySource === 'legacy_question_id') {
      question.decisionKeySource = 'legacy_question_id'
    }

    if (previousEntry && previousQuestion
      && buildQuestionConstraintKey(previousQuestion) !== buildQuestionConstraintKey(question)) {
      changedDecisionKeys.push(decisionKey)
      if (!hasTrustedCurrentAnswer) {
        pushUnique(unresolvedDecisionKeys, unresolvedDecisionKeySet, decisionKey)
        return buildPendingQuestionShell(question)
      }
    }

    if (group.conflictDetail || historicalConflictDetail) {
      if (previousEntry) changedDecisionKeys.push(decisionKey)
      conflicts.push(buildValueConflict({
        decisionKey,
        question,
        detail: group.conflictDetail || historicalConflictDetail,
      }))
      return buildPendingQuestionShell(question)
    }

    if (group.answer.unavailableSelectedValue) {
      // 可信回填的结论取值不在当前选项里：并回选项保留结论。
      // 选项措辞会随重新规划漂移（如 submit_auto 与 submit），这类漂移不该让用户重答；
      // 非可信来源的取值（模型自造）仍按选项不可用处理，落回重问。
      const unavailableValue = group.answer.unavailableSelectedValue
      if (hasTrustedCurrentAnswer) {
        pushUnique(resolvedDecisionKeys, resolvedDecisionKeySet, decisionKey)
        return mergeConfirmedDecisionOption(question, unavailableValue)
      }
      if (previousEntry) changedDecisionKeys.push(decisionKey)
      conflicts.push(buildOptionUnavailableConflict({
        decisionKey,
        question,
        proposedValue: group.answer.unavailableSelectedValue,
      }))
      return buildPendingQuestionShell(question)
    }

    if (group.answer.hasAnswer) {
      if (hasTrustedCurrentAnswer) {
        pushUnique(resolvedDecisionKeys, resolvedDecisionKeySet, decisionKey)
        return question
      }
      if (previousEntry && !isSameCanonicalAnswer(previousEntry.answer, group.answer)) {
        changedDecisionKeys.push(decisionKey)
        conflicts.push(buildValueConflict({
          decisionKey,
          question,
          detail: {
            previousValue: previousEntry.answer.selectedValue || undefined,
            proposedValue: group.answer.selectedValue || undefined,
          },
        }))
        return buildPendingQuestionShell(question)
      }
      pushUnique(resolvedDecisionKeys, resolvedDecisionKeySet, decisionKey)
      return question
    }

    if (!previousEntry) {
      if (group.answer.isResolved) {
        pushUnique(resolvedDecisionKeys, resolvedDecisionKeySet, decisionKey)
      } else {
        pushUnique(unresolvedDecisionKeys, unresolvedDecisionKeySet, decisionKey)
        return buildPendingQuestionShell(question)
      }
      return question
    }

    const previousValue = previousEntry.answer.selectedValue
    const options = question.options || []
    if (
      options.length > 0
      && (
        (
          previousValue
          && !options.some(option => normalizeText(option.value) === previousValue)
        )
        || (!previousValue && question.allowFreeText === false)
      )
    ) {
      conflicts.push(buildOptionUnavailableConflict({
        decisionKey,
        question,
        previousValue,
      }))
      return buildPendingQuestionShell(question)
    }

    pushUnique(inheritedDecisionKeys, inheritedDecisionKeySet, decisionKey)
    pushUnique(resolvedDecisionKeys, resolvedDecisionKeySet, decisionKey)
    return inheritPreviousDecision({ question, previousEntry })
  })

  const decisionQuestions = input.confirmation.decisionContractVersion === 2
    ? projectFlowDecisionContract(questions, input.confirmation.factSnapshot || {}).questions
    : questions
  const invalidatedQuestions = changedDecisionKeys.length
    ? invalidateFlowDecisionAnswers(decisionQuestions, changedDecisionKeys)
    : decisionQuestions
  const invalidatedKeys = new Set(invalidatedQuestions.flatMap((question, index) => (
    question.confirmed === false && decisionQuestions[index].confirmed === true
      ? [resolveDecisionKey(question)] : []
  )))
  const finalResolvedDecisionKeys = resolvedDecisionKeys.filter(key => !invalidatedKeys.has(key))
  const finalUnresolvedDecisionKeys = [...unresolvedDecisionKeys]
  invalidatedKeys.forEach(key => pushUnique(finalUnresolvedDecisionKeys, unresolvedDecisionKeySet, key))

  return {
    confirmation: {
      ...input.confirmation,
      resultSummary: input.confirmation.resultSummary
        ? [...input.confirmation.resultSummary]
        : undefined,
      status: finalUnresolvedDecisionKeys.length || conflicts.length
        ? 'pending'
        : 'completed',
      questions: invalidatedQuestions,
    },
    inheritedDecisionKeys: inheritedDecisionKeys.filter(key => !invalidatedKeys.has(key)),
    resolvedDecisionKeys: finalResolvedDecisionKeys,
    unresolvedDecisionKeys: finalUnresolvedDecisionKeys,
    conflicts,
  }
}
