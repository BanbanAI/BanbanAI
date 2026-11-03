import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '../types/nocodeEditorConfirmation'

type ConfirmationResponseLike = {
  question: NocodeEditorAiConfirmQuestion
  option?: { value?: string; label?: string } | null
  note?: string
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeNote = (value: unknown) => normalizeText(value)
  .replace(/\r\n?/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const getQuestionStableIdentityKeys = (question?: NocodeEditorAiConfirmQuestion | null) => (
  [
    normalizeText(question?.decisionKey),
    normalizeText(question?.id),
  ].filter(Boolean)
)

const countQuestionsByTitle = (questions: NocodeEditorAiConfirmQuestion[]) => {
  const counts = new Map<string, number>()
  questions.forEach((question) => {
    const title = normalizeText(question?.title)
    if (!title) {
      return
    }
    counts.set(title, (counts.get(title) || 0) + 1)
  })
  return counts
}

const isCompletedQuestion = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question?.confirmed
  || normalizeText(question?.selectedOptionValue)
  || normalizeText(question?.answerSummary)
  || normalizeText(question?.answerDetail)
  || question?.options?.some(option => option?.selected),
)

const resolveSelectedOptionValue = (question: NocodeEditorAiConfirmQuestion) => (
  normalizeText(question?.selectedOptionValue)
  || normalizeText(question?.options?.find(option => option?.selected)?.value)
)

export const isConfirmationResponseAlreadyApplied = (
  confirmation: NocodeEditorAiConfirmPayload | null | undefined,
  response: ConfirmationResponseLike,
) => {
  const canonicalQuestions = Array.isArray(confirmation?.questions)
    ? confirmation.questions
    : []
  if (!canonicalQuestions.length) {
    return false
  }

  // 稳定身份（decisionKey/id）优先且不回落题面：同题面可能来自另一条决策，
  // 否则 id/decisionKey 指向未完成题时会被同名题“救活”。只有完全没有稳定身份
  // 的历史题才按唯一题面匹配。
  const responseStableKeys = getQuestionStableIdentityKeys(response?.question)
  let recorded: NocodeEditorAiConfirmQuestion | undefined
  if (responseStableKeys.length) {
    recorded = canonicalQuestions.find(question => (
      getQuestionStableIdentityKeys(question).some(key => responseStableKeys.includes(key))
    ))
  } else {
    const responseTitle = normalizeText(response?.question?.title)
    if (responseTitle && countQuestionsByTitle(canonicalQuestions).get(responseTitle) === 1) {
      recorded = canonicalQuestions.find(question => normalizeText(question?.title) === responseTitle)
    }
  }
  if (!recorded || !isCompletedQuestion(recorded)) {
    return false
  }

  const responseOptionValue = normalizeText(response?.option?.value)
  const responseOptionLabel = normalizeText(response?.option?.label || response?.option?.value)
  const recordedOptionValue = resolveSelectedOptionValue(recorded)
  const recordedAnswerText = normalizeText(recorded.answerDetail)
    || normalizeText(recorded.answerSummary)
  const recordedSummary = normalizeText(recorded.answerSummary)

  if (responseOptionValue) {
    if (recordedOptionValue) {
      if (recordedOptionValue !== responseOptionValue) {
        return false
      }
    } else if (
      recordedSummary !== responseOptionLabel
      && recordedAnswerText !== responseOptionLabel
    ) {
      return false
    }
  }

  const responseNote = normalizeNote(response?.note)
  if (
    responseNote
    && responseNote !== recordedAnswerText
    && responseNote !== recordedSummary
  ) {
    return false
  }

  return Boolean(responseOptionValue || responseNote)
}

export const areConfirmationResponsesAlreadyApplied = (
  confirmation: NocodeEditorAiConfirmPayload | null | undefined,
  responses: ConfirmationResponseLike[],
) => (
  responses.length > 0
  && responses.every(response => isConfirmationResponseAlreadyApplied(confirmation, response))
)
