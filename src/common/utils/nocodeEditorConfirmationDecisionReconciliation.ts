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
  selectedValue: normalizeText(decision.selectedOptionValue),
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
  allowFreeText: question.allowFreeText ?? null,
  branchKey: normalizeText(question.branchKey),
  dependsOn: (question.dependsOn || []).map(normalizeText).sort(),
  domain: normalizeText(question.domain),
  options: (question.options || []).map(option => normalizeText(option.value)).sort(),
  questionKind: normalizeText(question.questionKind),
  required: question.required ?? null,
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

  questions.forEach((question) => {
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
  previousDecisions?: NocodeEditorConfirmationDecision[]
  expectedPlanningContextKey?: string
  preserveTrustedDecisionKeySource?: boolean
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

  const questions = currentDecisionGroups.map((group) => {
    const decisionKey = group.decisionKey
    const question = materializeQuestionDecisionKey(group.question, decisionKey, {
      preserveTrustedDecisionKeySource: input.preserveTrustedDecisionKeySource === true,
    })
    const previousEntry = previousDecisionState.decisionsByKey.get(decisionKey)
    const historicalConflictDetail = previousDecisionState.conflictsByKey.get(decisionKey)
    if (previousEntry?.decision.decisionKeySource === 'legacy_question_id') {
      question.decisionKeySource = 'legacy_question_id'
    }

    if (group.conflictDetail || historicalConflictDetail) {
      conflicts.push(buildValueConflict({
        decisionKey,
        question,
        detail: group.conflictDetail || historicalConflictDetail,
      }))
      return buildPendingQuestionShell(question)
    }

    if (group.answer.unavailableSelectedValue) {
      conflicts.push(buildOptionUnavailableConflict({
        decisionKey,
        question,
        proposedValue: group.answer.unavailableSelectedValue,
      }))
      return buildPendingQuestionShell(question)
    }

    if (group.answer.hasAnswer) {
      if (previousEntry && !isSameCanonicalAnswer(previousEntry.answer, group.answer)) {
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

  return {
    confirmation: {
      ...input.confirmation,
      resultSummary: input.confirmation.resultSummary
        ? [...input.confirmation.resultSummary]
        : undefined,
      status: unresolvedDecisionKeys.length || conflicts.length
        ? 'pending'
        : 'completed',
      questions,
    },
    inheritedDecisionKeys,
    resolvedDecisionKeys,
    unresolvedDecisionKeys,
    conflicts,
  }
}
