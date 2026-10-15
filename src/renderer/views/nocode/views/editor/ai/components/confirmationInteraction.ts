import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorConfirmationDecision,
} from '@common/utils/nocodeEditorConfirmationDecisionProjection'
import {
  NOCODE_EDITOR_CONFIRMATION_DECISION_LIMIT,
} from '@common/utils/nocodeEditorConfirmationDecisionProjection'
import {
  getNocodeEditorCompletedDefaultsContinueLabel,
  getNocodeEditorCompletedDefaultsResultSummary,
  getNocodeEditorCompletedDefaultsSummary,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  isDefaultContinueReplyMessage,
  normalizeReplyQuestionToken,
} from '@common/utils/nocodeEditorPlanningConfirmationReply'
import type { AiArtifactConfirmationQuestion } from '@renderer/views/nocode/components/ai/artifactBlock'
import i18next from 'i18next'

export type NocodeEditorAiConfirmationResponse = {
  question: AiArtifactConfirmationQuestion
  option?: NocodeEditorAiConfirmQuestionOption | null
  note?: string
}

export type NocodeEditorAiConfirmationResponseDraft = {
  note: string
  option: NocodeEditorAiConfirmQuestionOption | null
}

export type NocodeEditorAiConfirmationResponseDraftMap = Record<string, NocodeEditorAiConfirmationResponseDraft>

export type FlowSchemeConfirmationContinuationRequestMetadata = {
  nextAction: 'editor_plan_flow_scheme'
  requiredNextAction: 'editor_plan_flow_scheme'
  flowPlanningContextKey?: string
  blockedNextAction?: 'editor_stage_flow_blueprint'
}

export type ConfirmationContinuationRequestMetadata = {
  confirmationStage: 'app-plan' | 'form-plan' | 'flow-scheme' | 'blueprint'
  planningContextKey?: string
  flowSchemeRevision?: number
  planningConfirmationDecisions?: NocodeEditorConfirmationDecision[]
  flowConfirmationDecisions?: NocodeEditorConfirmationDecision[]
  blueprintConfirmationDecisions?: NocodeEditorConfirmationDecision[]
}

type ParsedConfirmationBatchReplyItem = {
  title: string
  optionLabel?: string
  note?: string
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

export const buildFlowSchemeConfirmationContinuationRequestMetadata = (
  confirmation?: Pick<
    NocodeEditorAiConfirmPayload,
    'blockedNextAction' | 'planningContextKey' | 'requiredNextAction'
  > | null,
): FlowSchemeConfirmationContinuationRequestMetadata | undefined => {
  if (confirmation?.requiredNextAction !== 'editor_plan_flow_scheme') {
    return undefined
  }

  const planningContextKey = normalizeText(confirmation.planningContextKey)
  return {
    nextAction: 'editor_plan_flow_scheme',
    requiredNextAction: 'editor_plan_flow_scheme',
    ...(planningContextKey ? { flowPlanningContextKey: planningContextKey } : {}),
    ...(confirmation.blockedNextAction === 'editor_stage_flow_blueprint'
      ? { blockedNextAction: 'editor_stage_flow_blueprint' }
      : {}),
  }
}

const BLUEPRINT_CONFIRMATION_DECISION_SUMMARY_MAX_LENGTH = 60

const buildBlueprintDecisionAnswerSummary = (
  response: NocodeEditorAiConfirmationResponse,
) => {
  const optionLabel = normalizeText(response.option?.label || response.option?.value)
  if (optionLabel) {
    return optionLabel
  }

  const note = normalizeConfirmationResponseNote(response.note).replace(/\s+/g, ' ')
  if (!note) {
    return ''
  }

  return note.length > BLUEPRINT_CONFIRMATION_DECISION_SUMMARY_MAX_LENGTH
    ? `${note.slice(0, BLUEPRINT_CONFIRMATION_DECISION_SUMMARY_MAX_LENGTH)}...`
    : note
}

export const buildConfirmationContinuationRequestMetadata = (
  confirmation?: Pick<NocodeEditorAiConfirmPayload, 'stage' | 'questions' | 'planningContextKey' | 'schemeRevision'> | null,
  responses?: NocodeEditorAiConfirmationResponse[] | null,
): ConfirmationContinuationRequestMetadata | undefined => {
  if (
    confirmation?.stage !== 'app-plan'
    && confirmation?.stage !== 'form-plan'
    && confirmation?.stage !== 'flow-scheme'
    && confirmation?.stage !== 'blueprint'
  ) {
    return undefined
  }

  const decisionsByKey = new Map<string, NocodeEditorConfirmationDecision>()
  const resolveDecisionKey = (question: {
    decisionKey?: unknown
    id?: unknown
    title?: unknown
  }) => (
    normalizeText(question.decisionKey)
    || normalizeText(question.id)
    || normalizeText(question.title)
  )

  const responseList = Array.isArray(responses) ? responses : []
  responseList.forEach((response) => {
    const questionId = normalizeText(response?.question?.id)
    const questionTitle = normalizeText(response?.question?.title)
    const explicitDecisionKey = normalizeText(response?.question?.decisionKey)
    const decisionKey = resolveDecisionKey(response?.question)
    if (!decisionKey) {
      return
    }

    decisionsByKey.set(decisionKey, {
      questionId: questionId || decisionKey,
      questionTitle,
      decisionKey,
      decisionTarget: response?.question?.decisionTarget,
      ...(explicitDecisionKey
        ? { decisionKeySource: 'explicit' as const }
        : (questionId ? { decisionKeySource: 'legacy_question_id' as const } : {})),
      selectedOptionValue: normalizeText(response?.option?.value) || undefined,
      answerSummary: buildBlueprintDecisionAnswerSummary(response) || undefined,
      answerDetail: buildConfirmationResponseAnswerDetail(response) || undefined,
    })
  })

  const questionList = Array.isArray(confirmation.questions) ? confirmation.questions : []
  questionList.forEach((question) => {
    if (!isCompletedConfirmationQuestion(question, true)) {
      return
    }

    const questionId = normalizeText(question.id)
    const questionTitle = normalizeText(question.title)
    const decisionKey = resolveDecisionKey(question)
    if (!decisionKey || decisionsByKey.has(decisionKey)) {
      return
    }

    decisionsByKey.set(decisionKey, {
      questionId: questionId || decisionKey,
      questionTitle,
      decisionKey: normalizeText(question.decisionKey) || decisionKey,
      decisionTarget: question.decisionTarget,
      decisionKeySource: question.decisionKeySource || 'explicit',
      selectedOptionValue: normalizeText(question.selectedOptionValue) || undefined,
      answerSummary: normalizeText(question.answerSummary) || undefined,
      answerDetail: normalizeText(question.answerDetail) || undefined,
    })
  })

  const decisions = Array.from(decisionsByKey.values())
    .slice(0, NOCODE_EDITOR_CONFIRMATION_DECISION_LIMIT)
  if (!decisions.length) {
    return undefined
  }

  const isPlanningConfirmation = confirmation.stage === 'app-plan' || confirmation.stage === 'form-plan'
  if (confirmation.stage === 'flow-scheme') {
    return {
      confirmationStage: 'flow-scheme',
      planningContextKey: normalizeText(confirmation.planningContextKey) || undefined,
      flowSchemeRevision: Number.isSafeInteger(confirmation.schemeRevision) && Number(confirmation.schemeRevision) > 0
        ? Number(confirmation.schemeRevision) : undefined,
      flowConfirmationDecisions: decisions.map(decision => ({
        ...decision,
        ...(normalizeText(confirmation.planningContextKey)
          ? { planningContextKey: normalizeText(confirmation.planningContextKey) }
          : {}),
      })),
    }
  }

  return isPlanningConfirmation
    ? {
      confirmationStage: confirmation.stage,
      planningContextKey: normalizeText(confirmation.planningContextKey) || undefined,
      planningConfirmationDecisions: decisions,
    }
    : {
      confirmationStage: 'blueprint',
      blueprintConfirmationDecisions: decisions,
    }
}

const resolveQuestionSelectedOption = (
  question?: AiArtifactConfirmationQuestion | null,
) => {
  const selectedOptionValue = normalizeText(question?.selectedOptionValue)
  const options = Array.isArray(question?.options) ? question.options : []
  return options.find(option => (
    Boolean(option?.selected)
    || (selectedOptionValue && normalizeText(option?.value) === selectedOptionValue)
  )) || null
}

export const normalizeConfirmationResponseNote = (value: unknown) => (
  normalizeText(value)
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
)

export const createEmptyConfirmationResponseDraft = (): NocodeEditorAiConfirmationResponseDraft => ({
  option: null,
  note: '',
})

export const hasConfirmationResponseDraftNote = (
  draft?: NocodeEditorAiConfirmationResponseDraft | null,
) => Boolean(normalizeConfirmationResponseNote(draft?.note))

export const buildInitialConfirmationResponseDraft = (
  question: AiArtifactConfirmationQuestion,
): NocodeEditorAiConfirmationResponseDraft => {
  const selectedOption = resolveQuestionSelectedOption(question)
  const note = normalizeConfirmationResponseNote(question.answerDetail)
  const normalizedQuestionDescription = normalizeText(question.description)
  const normalizedSelectedOptionDescription = normalizeText(selectedOption?.description)

  return {
    option: selectedOption,
    note: (
      note
      && note !== normalizedQuestionDescription
      && note !== normalizedSelectedOptionDescription
    )
      ? note
      : '',
  }
}

export const buildConfirmationResponseDrafts = (
  questions: AiArtifactConfirmationQuestion[],
): NocodeEditorAiConfirmationResponseDraftMap => (
  questions.reduce<NocodeEditorAiConfirmationResponseDraftMap>((drafts, question) => {
    if (!question?.id) {
      return drafts
    }

    drafts[question.id] = buildInitialConfirmationResponseDraft(question)
    return drafts
  }, {})
)

export const buildConfirmationResponseFromDraft = (
  question: AiArtifactConfirmationQuestion,
  draft?: NocodeEditorAiConfirmationResponseDraft | null,
): NocodeEditorAiConfirmationResponse => ({
  question,
  option: draft?.option || null,
  note: normalizeConfirmationResponseNote(draft?.note),
})

export const toggleConfirmationResponseDraftOption = (
  draft: NocodeEditorAiConfirmationResponseDraft | null | undefined,
  option: NocodeEditorAiConfirmQuestionOption,
) => {
  const nextOptionValue = normalizeText(option?.value)
  if (!nextOptionValue) {
    return null
  }

  const currentOptionValue = normalizeText(draft?.option?.value)
  return currentOptionValue === nextOptionValue ? null : option
}

export const hasMeaningfulConfirmationResponse = (
  response?: NocodeEditorAiConfirmationResponse | null,
) => {
  const optionLabel = normalizeText(response?.option?.label || response?.option?.value)
  const note = normalizeConfirmationResponseNote(response?.note)
  return Boolean(optionLabel || note)
}

const canQuestionUseSupplementNoteAsAnswer = (
  question?: Pick<AiArtifactConfirmationQuestion, 'allowFreeText'> | null,
) => question?.allowFreeText !== false

const hasAnsweredSupplementNote = (
  question?: Pick<AiArtifactConfirmationQuestion, 'allowFreeText'> | null,
  note?: string,
) => (
  canQuestionUseSupplementNoteAsAnswer(question)
  && Boolean(normalizeConfirmationResponseNote(note))
)

export const isConfirmationQuestionAnswered = (
  question: AiArtifactConfirmationQuestion,
  draft?: NocodeEditorAiConfirmationResponseDraft | null,
) => {
  const response = buildConfirmationResponseFromDraft(question, draft)
  if (question.questionKind === 'note_only') {
    return Boolean(normalizeConfirmationResponseNote(response.note))
  }

  const hasOptions = Array.isArray(question.options) && question.options.length > 0
  if (hasOptions) {
    return Boolean(response.option?.value || hasAnsweredSupplementNote(question, response.note))
  }

  return hasAnsweredSupplementNote(question, response.note)
}

export const countUnansweredConfirmationQuestions = (
  questions: AiArtifactConfirmationQuestion[],
  drafts: NocodeEditorAiConfirmationResponseDraftMap = {},
) => (
  questions.reduce((count, question) => (
    count + (isConfirmationQuestionAnswered(question, drafts[question.id]) ? 0 : 1)
  ), 0)
)

export const buildStagedConfirmationResponses = (
  questions: AiArtifactConfirmationQuestion[],
  drafts: NocodeEditorAiConfirmationResponseDraftMap = {},
) => (
  questions
    .map(question => buildConfirmationResponseFromDraft(question, drafts[question.id]))
    .filter(hasMeaningfulConfirmationResponse)
)

export const buildConfirmationBatchReplyMessage = (
  responses: NocodeEditorAiConfirmationResponse[],
) => {
  const normalizedResponses = responses.filter(hasMeaningfulConfirmationResponse)
  if (!normalizedResponses.length) {
    return ''
  }

  const lines = [i18next.t('confirmationInteraction.replyLead')]

  normalizedResponses.forEach((response, index) => {
    const questionTitle = normalizeText(response.question?.title) || i18next.t('confirmationInteraction.pendingQuestion', { index: index + 1 })
    const optionLabel = normalizeText(response.option?.label || response.option?.value)
    const note = normalizeConfirmationResponseNote(response.note)

    lines.push(`${index + 1}. ${questionTitle}`)
    if (optionLabel) {
      lines.push(`   ${i18next.t('confirmationInteraction.selectedOptionPrefix')} ${optionLabel}`)
    }
    if (note) {
      lines.push(`   ${i18next.t('confirmationInteraction.additionalNotePrefix')} ${note}`)
    }
  })

  return lines.join('\n')
}

export const buildConfirmationResponseAnswerSummary = (
  response: NocodeEditorAiConfirmationResponse,
) => {
  const optionLabel = normalizeText(response.option?.label || response.option?.value)
  if (optionLabel) {
    return optionLabel
  }

  const note = normalizeConfirmationResponseNote(response.note).replace(/\s+/g, ' ')
  if (!note) {
    return ''
  }

  return note.length > 20 ? `${note.slice(0, 20)}...` : note
}

export const buildConfirmationResponseAnswerDetail = (
  response: NocodeEditorAiConfirmationResponse,
) => {
  const note = normalizeConfirmationResponseNote(response.note)
  if (note) {
    return note
  }

  return normalizeText(
    response.option?.description
      || response.question?.description,
  )
}

export const isStructuredConfirmationReplyMessage = (content: string) => (
  normalizeText(content).startsWith(i18next.t('confirmationInteraction.replyLead'))
)

export const parseStructuredConfirmationReplyMessage = (
  content: string,
): ParsedConfirmationBatchReplyItem[] => {
  if (!isStructuredConfirmationReplyMessage(content)) {
    return []
  }

  const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n')
  const items: ParsedConfirmationBatchReplyItem[] = []
  let currentItem: ParsedConfirmationBatchReplyItem | null = null
  let currentMultilineField: 'note' | null = null
  const selectedOptionPrefix = i18next.t('confirmationInteraction.selectedOptionPrefix')
  const additionalNotePrefix = i18next.t('confirmationInteraction.additionalNotePrefix')

  for (const rawLine of lines) {
    const line = String(rawLine || '')
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      if (currentMultilineField === 'note' && currentItem?.note) {
        currentItem.note = `${currentItem.note}\n`
      }
      continue
    }

    const questionMatch = trimmedLine.match(/^\d+\.\s*(.+)$/)
    if (questionMatch) {
      currentItem = {
        title: normalizeText(questionMatch[1]),
      }
      currentMultilineField = null
      items.push(currentItem)
      continue
    }

    if (!currentItem) {
      continue
    }

    if (trimmedLine.startsWith(selectedOptionPrefix)) {
      currentItem.optionLabel = normalizeText(trimmedLine.slice(selectedOptionPrefix.length)) || undefined
      currentMultilineField = null
      continue
    }

    if (trimmedLine.startsWith(additionalNotePrefix)) {
      currentItem.note = normalizeConfirmationResponseNote(trimmedLine.slice(additionalNotePrefix.length))
      currentMultilineField = 'note'
      continue
    }

    if (currentMultilineField === 'note') {
      currentItem.note = normalizeConfirmationResponseNote([
        currentItem.note || '',
        trimmedLine,
      ].filter(Boolean).join('\n'))
    }
  }

  return items.filter(item => Boolean(item.title))
}

const resolveConfirmationReplyOption = (
  question: NocodeEditorAiConfirmQuestion,
  optionLabel: string,
) => {
  const normalizedOptionLabel = normalizeReplyQuestionToken(optionLabel)
  if (!normalizedOptionLabel) {
    return null
  }

  const options = Array.isArray(question.options) ? question.options : []
  return options.find(option => (
    normalizeReplyQuestionToken(option.label) === normalizedOptionLabel
    || normalizeReplyQuestionToken(option.value) === normalizedOptionLabel
  )) || null
}

const buildCompletedConfirmationQuestionFromReply = (
  question: NocodeEditorAiConfirmQuestion,
  item: ParsedConfirmationBatchReplyItem,
): NocodeEditorAiConfirmQuestion | null => {
  const questionKind = question.questionKind
  const option = item.optionLabel
    ? resolveConfirmationReplyOption(question, item.optionLabel)
    : null
  const note = normalizeConfirmationResponseNote(item.note)
  const hasQuestionOptions = Array.isArray(question.options) && question.options.length > 0
  const hasSupplementOnlyAnswer = hasAnsweredSupplementNote(question, note)

  if (questionKind !== 'note_only' && hasQuestionOptions && !option && !hasSupplementOnlyAnswer) {
    return null
  }
  if (!option && !note) {
    return null
  }

  const response: NocodeEditorAiConfirmationResponse = {
    question,
    option,
    note,
  }

  return {
    ...question,
    questionKind,
    confirmed: true,
    selectedOptionValue: option?.value || undefined,
    answerSummary: buildConfirmationResponseAnswerSummary(response) || undefined,
    answerDetail: buildConfirmationResponseAnswerDetail(response) || undefined,
    options: Array.isArray(question.options)
      ? question.options.map(candidate => ({
        ...candidate,
        selected: option ? candidate.value === option.value : false,
      }))
      : question.options,
  }
}

const isCompletedConfirmationQuestion = (
  question?: Partial<NocodeEditorAiConfirmQuestion> | null,
  treatLegacyAnswersAsCompleted = false,
) => Boolean(
  question?.confirmed
  || (
    treatLegacyAnswersAsCompleted
    && (
      normalizeText(question?.selectedOptionValue)
      || normalizeText(question?.answerSummary)
      || normalizeText(question?.answerDetail)
      || (Array.isArray(question?.options) && question.options.some(option => Boolean(option?.selected)))
    )
  ),
)

export const deriveCompletedConfirmationFromReplyMessage = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
  replyContent?: string | null,
): NocodeEditorAiConfirmPayload | null => {
  if (!confirmation || !Array.isArray(confirmation.questions) || !confirmation.questions.length) {
    return null
  }

  const shouldTreatLegacyAnswersAsCompleted = confirmation.status === 'completed'
  const pendingQuestions = confirmation.questions.filter(question => !isCompletedConfirmationQuestion(
    question,
    shouldTreatLegacyAnswersAsCompleted,
  ))
  const targetQuestions = pendingQuestions.length ? pendingQuestions : confirmation.questions
  const parsedItems = parseStructuredConfirmationReplyMessage(String(replyContent || ''))
  if (parsedItems.length < targetQuestions.length) {
    return null
  }

  const remainingItems = [...parsedItems]
  let resolvedPendingCount = 0
  const nextQuestions = confirmation.questions.map((question, index) => {
    if (isCompletedConfirmationQuestion(question, shouldTreatLegacyAnswersAsCompleted)) {
      return {
        ...question,
        confirmed: true,
      }
    }

    const normalizedQuestionTitle = normalizeReplyQuestionToken(question.title)
    const matchedIndex = remainingItems.findIndex(item => (
      normalizeReplyQuestionToken(item.title) === normalizedQuestionTitle
    ))
    const resolvedIndex = matchedIndex >= 0
      ? matchedIndex
      : (
        index < remainingItems.length
          ? index
          : -1
      )
    if (resolvedIndex < 0) {
      return null
    }

    const [item] = remainingItems.splice(resolvedIndex, 1)
    const nextQuestion = buildCompletedConfirmationQuestionFromReply(question, item)
    if (nextQuestion) {
      resolvedPendingCount += 1
    }
    return nextQuestion
  })

  if (nextQuestions.some(question => !question)) {
    return null
  }

  if (pendingQuestions.length > 0 && resolvedPendingCount < pendingQuestions.length) {
    return null
  }

  return {
    ...confirmation,
    status: 'completed',
    questions: nextQuestions as NocodeEditorAiConfirmQuestion[],
  }
}

export const deriveDefaultCompletedConfirmationFromReplyMessage = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
  replyContent?: string | null,
): NocodeEditorAiConfirmPayload | null => {
  if (!confirmation || !Array.isArray(confirmation.questions) || !confirmation.questions.length) {
    return null
  }

  if (!isDefaultContinueReplyMessage(String(replyContent || ''), confirmation)) {
    return null
  }

  const resolvedResultSummary = Array.isArray(confirmation.resultSummary)
    ? confirmation.resultSummary
      .map(item => normalizeText(item))
      .filter(Boolean)
    : []

  return {
    ...confirmation,
    status: 'completed',
    completionSummary: confirmation.completionSummary || getNocodeEditorCompletedDefaultsSummary(),
    resultSummary: resolvedResultSummary.length
      ? resolvedResultSummary
      : [getNocodeEditorCompletedDefaultsResultSummary()],
    continueLabel: getNocodeEditorCompletedDefaultsContinueLabel(),
    reviewLabel: confirmation.reviewLabel || i18next.t('confirmationInteraction.viewFullConfirmationRecord'),
    questions: confirmation.questions.map((question) => ({
      ...question,
      confirmed: true,
      selectedOptionValue: undefined,
      answerSummary: undefined,
      answerDetail: undefined,
      options: Array.isArray(question.options)
        ? question.options.map(option => ({
          ...option,
          selected: false,
        }))
        : question.options,
    })),
  }
}
