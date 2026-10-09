const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
)

const hasNonEmptyConfirmationAnswerValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value === 'string') {
    return Boolean(normalizeText(value))
  }
  if (Array.isArray(value)) {
    return value.some(item => hasNonEmptyConfirmationAnswerValue(item))
  }
  if (isRecord(value)) {
    return Object.values(value).some(item => hasNonEmptyConfirmationAnswerValue(item))
  }
  return false
}

const hasConfirmationAnswer = (question: unknown) => {
  if (!isRecord(question)) {
    return false
  }
  if (question.confirmed === false) {
    return false
  }
  if (question.confirmed === true) {
    return true
  }
  return [
    'selectedOptionValue',
    'selected_option_value',
    'answerSummary',
    'answer_summary',
    'answerDetail',
    'answer_detail',
  ].some(key => hasNonEmptyConfirmationAnswerValue(question[key]))
}

const normalizeConfirmationQuestionTitle = (value: unknown) => {
  if (typeof value === 'string') {
    return normalizeText(value)
  }
  if (!isRecord(value)) {
    return ''
  }
  return normalizeText(value.title)
    || normalizeText(value.question)
    || normalizeText(value.name)
}

const normalizePendingConfirmationQuestionTitles = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter(question => !hasConfirmationAnswer(question))
    .map(question => normalizeConfirmationQuestionTitle(question))
    .filter(Boolean)
}

const mergeOpenQuestionLists = (primary: string[], secondary: string[]) => {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const item of [...primary, ...secondary]) {
    const question = normalizeText(item)
    if (!question || seen.has(question)) {
      continue
    }
    seen.add(question)
    merged.push(question)
  }
  return merged
}

export const resolvePromptVisiblePlanningConfirmationStatus = (input: {
  openQuestions?: unknown
  confirmationStatus?: unknown
  confirmationQuestions?: unknown
  fallbackStatus?: unknown
}) => {
  const rawStatus = normalizeText(input.confirmationStatus)
  const normalizedFallbackStatus = normalizeText(input.fallbackStatus)
  if (rawStatus === 'completed') {
    if (!Array.isArray(input.confirmationQuestions) || input.confirmationQuestions.length === 0) {
      return 'completed'
    }
    const pendingConfirmationQuestionTitles = normalizePendingConfirmationQuestionTitles(
      input.confirmationQuestions,
    )
    const hasExplicitOpenQuestions = normalizeStringList(input.openQuestions).length > 0
    if (pendingConfirmationQuestionTitles.length > 0 && hasExplicitOpenQuestions) {
      return 'pending'
    }
    return (
      pendingConfirmationQuestionTitles.length === 0
      || !hasExplicitOpenQuestions
      || normalizedFallbackStatus === 'completed'
    )
      ? 'completed'
      : 'pending'
  }

  return normalizedFallbackStatus || rawStatus
}

export const resolvePromptVisiblePlanningOpenQuestions = (input: {
  openQuestions?: unknown
  confirmationQuestions?: unknown
  confirmationStatus?: unknown
  fallbackConfirmationStatus?: unknown
}) => {
  if (resolvePromptVisiblePlanningConfirmationStatus({
    openQuestions: input.openQuestions,
    confirmationStatus: input.confirmationStatus,
    confirmationQuestions: input.confirmationQuestions,
    fallbackStatus: input.fallbackConfirmationStatus,
  }) === 'completed') {
    return []
  }

  return mergeOpenQuestionLists(
    normalizeStringList(input.openQuestions),
    normalizePendingConfirmationQuestionTitles(input.confirmationQuestions),
  )
}
