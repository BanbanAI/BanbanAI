import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '../types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from './nocodeEditorConfirmationNormalization'
import {
  filterNocodeEditorQuestionsForStage,
} from './nocodeEditorQuestionStagePolicy'

type ProjectBlueprintConfirmationOptions = {
  confirmation?: unknown
  openQuestions?: unknown
  lateQuestions?: unknown
  summary?: unknown
}

export type ProjectBlueprintConfirmationResult = {
  confirmation: NocodeEditorAiConfirmPayload | null
  openQuestions: string[]
  pendingQuestions: NocodeEditorAiConfirmQuestion[]
}

type ReconcileBlueprintConfirmationOptions = ProjectBlueprintConfirmationOptions & {
  completedConfirmation?: unknown
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeQuestionTitleKey = (value: unknown) => normalizeText(value).toLowerCase()

const isPendingQuestion = (question: NocodeEditorAiConfirmQuestion) => question.confirmed !== true

const isCompletedQuestion = (question: NocodeEditorAiConfirmQuestion) => (
  question.confirmed === true
  || Boolean(
    normalizeText(question.selectedOptionValue)
    || normalizeText(question.answerSummary)
    || normalizeText(question.answerDetail)
    || question.options?.some(option => option.selected),
  )
)

const getQuestionIdentityKeys = (question: NocodeEditorAiConfirmQuestion) => (
  [
    normalizeText(question.decisionKey),
    /^(?:blueprint|form-blueprint)-question-\d+$/u.test(normalizeText(question.id))
      ? ''
      : normalizeText(question.id),
    normalizeQuestionTitleKey(question.title),
  ].filter(Boolean)
)

const mergeQuestionsByIdentity = (...questionLists: NocodeEditorAiConfirmQuestion[][]) => {
  const merged: NocodeEditorAiConfirmQuestion[] = []
  const seen = new Set<string>()

  questionLists.flat().forEach((question) => {
    const keys = getQuestionIdentityKeys(question)
    if (keys.some(key => seen.has(key))) {
      return
    }
    keys.forEach(key => seen.add(key))
    merged.push(question)
  })

  return merged
}

const filterBlueprintStageQuestions = (value: unknown) => Array.isArray(value)
  ? filterNocodeEditorQuestionsForStage(value, 'form-blueprint')
  : value

const assignLateQuestionFallbackIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return value
  }

  return value.map((question, index) => {
    const fallbackId = `blueprint-late-question-${index + 1}`
    if (typeof question === 'string') {
      return {
        id: fallbackId,
        title: question,
      }
    }
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      return question
    }

    const item = question as Record<string, unknown>
    return normalizeText(item.id)
      ? question
      : {
        ...item,
        id: fallbackId,
      }
  })
}

const filterBlueprintStageConfirmation = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const confirmation = value as Record<string, unknown>
  if (!Array.isArray(confirmation.questions)) {
    return value
  }

  const questions = filterNocodeEditorQuestionsForStage(
    confirmation.questions,
    'form-blueprint',
  )
  const isCompleted = normalizeText(confirmation.status).toLowerCase() === 'completed'
  if (
    !questions.length
    && !isCompleted
  ) {
    return null
  }

  const completionEvidence = normalizeText(
    confirmation.completionSummary ?? confirmation.completion_summary,
  ) || normalizeText(confirmation.resultSummary ?? confirmation.result_summary)
  const summary = normalizeText(confirmation.summary)

  return {
    ...confirmation,
    questions,
    ...(
      isCompleted && !questions.length && !completionEvidence && summary
        ? { completionSummary: summary }
        : {}
    ),
  }
}

const dedupeQuestionTitles = (questions: NocodeEditorAiConfirmQuestion[]) => {
  const seen = new Set<string>()
  return questions.reduce<string[]>((titles, question) => {
    const title = normalizeText(question.title)
    const key = normalizeQuestionTitleKey(title)
    if (!title || (key && seen.has(key))) {
      return titles
    }
    if (key) {
      seen.add(key)
    }
    titles.push(title)
    return titles
  }, [])
}

const ensureUniqueQuestionIds = (questions: NocodeEditorAiConfirmQuestion[]) => {
  const usedIds = new Set<string>()
  return questions.map((question, index) => {
    const baseId = normalizeText(question.id) || `blueprint-question-${index + 1}`
    if (!usedIds.has(baseId)) {
      usedIds.add(baseId)
      return question
    }

    let suffix = 2
    let id = `${baseId}-${suffix}`
    while (usedIds.has(id)) {
      suffix += 1
      id = `${baseId}-${suffix}`
    }
    usedIds.add(id)
    return {
      ...question,
      id,
    }
  })
}

export const projectBlueprintConfirmation = (
  options: ProjectBlueprintConfirmationOptions,
): ProjectBlueprintConfirmationResult => {
  const summary = normalizeText(options.summary) || undefined
  const confirmation = filterBlueprintStageConfirmation(options.confirmation)
  const rawOpenQuestions = filterBlueprintStageQuestions(options.openQuestions)
  const lateQuestions = filterBlueprintStageQuestions(options.lateQuestions)
  const initialBaseConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'blueprint',
    confirmation,
    openQuestions: rawOpenQuestions,
    summary,
  })
  const completedQuestionTitleKeys = new Set(
    (initialBaseConfirmation?.questions || [])
      .filter(isCompletedQuestion)
      .map(question => normalizeQuestionTitleKey(question.title))
      .filter(Boolean),
  )
  const openQuestions = Array.isArray(rawOpenQuestions)
    ? rawOpenQuestions.filter(value => (
      !completedQuestionTitleKeys.has(normalizeQuestionTitleKey(value))
    ))
    : rawOpenQuestions
  const normalizedBaseConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'blueprint',
    confirmation,
    openQuestions,
    summary,
  })
  const normalizedOpenQuestionConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'blueprint',
    openQuestions,
    summary,
  })
  const baseConfirmation = normalizedBaseConfirmation
    && normalizedOpenQuestionConfirmation?.questions.length
    ? {
      ...normalizedBaseConfirmation,
      status: normalizedOpenQuestionConfirmation.questions.some(isPendingQuestion)
        ? 'pending' as const
        : normalizedBaseConfirmation.status,
      questions: mergeQuestionsByIdentity(
        normalizedBaseConfirmation.questions,
        normalizedOpenQuestionConfirmation.questions,
      ),
    }
    : normalizedBaseConfirmation
  const lateQuestionConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'blueprint',
    confirmation: Array.isArray(lateQuestions)
      ? {
        stage: 'blueprint',
        questions: assignLateQuestionFallbackIds(lateQuestions),
      }
      : undefined,
    openQuestions: lateQuestions,
    preferredSurface: baseConfirmation?.preferredSurface,
    summary,
  })

  const basePendingQuestions = Array.isArray(baseConfirmation?.questions)
    ? baseConfirmation.questions.filter(isPendingQuestion)
    : []
  const latePendingQuestions = Array.isArray(lateQuestionConfirmation?.questions)
    ? lateQuestionConfirmation.questions.filter(isPendingQuestion)
    : []

  if (!latePendingQuestions.length) {
    return {
      confirmation: baseConfirmation,
      openQuestions: dedupeQuestionTitles(basePendingQuestions),
      pendingQuestions: basePendingQuestions,
    }
  }

  const pendingQuestionsByTitle = new Map<string, NocodeEditorAiConfirmQuestion>()
  basePendingQuestions.forEach((question) => {
    const key = normalizeQuestionTitleKey(question.title)
    if (key && !pendingQuestionsByTitle.has(key)) {
      pendingQuestionsByTitle.set(key, question)
    }
  })

  const mergedPendingQuestions: NocodeEditorAiConfirmQuestion[] = []
  latePendingQuestions.forEach((question) => {
    const key = normalizeQuestionTitleKey(question.title)
    if (key && pendingQuestionsByTitle.has(key)) {
      mergedPendingQuestions.push(pendingQuestionsByTitle.get(key) as NocodeEditorAiConfirmQuestion)
      pendingQuestionsByTitle.delete(key)
      return
    }
    mergedPendingQuestions.push(question)
  })
  pendingQuestionsByTitle.forEach(question => mergedPendingQuestions.push(question))

  const uniqueMergedPendingQuestions = ensureUniqueQuestionIds(mergedPendingQuestions)

  return {
    confirmation: {
      ...(baseConfirmation || lateQuestionConfirmation || {
        stage: 'blueprint' as const,
      }),
      stage: 'blueprint',
      status: 'pending',
      summary: baseConfirmation?.summary || lateQuestionConfirmation?.summary || summary,
      completionSummary: undefined,
      resultSummary: undefined,
      questions: uniqueMergedPendingQuestions,
    },
    openQuestions: dedupeQuestionTitles(uniqueMergedPendingQuestions),
    pendingQuestions: uniqueMergedPendingQuestions,
  }
}

/**
 * Reconciles a completed blueprint confirmation with the staged blueprint.
 * The model may omit the completed answer from its next blueprint patch, so
 * this boundary must consume the answer before deriving the next question set.
 */
export const reconcileBlueprintConfirmationDecisions = (
  options: ReconcileBlueprintConfirmationOptions,
): ProjectBlueprintConfirmationResult => {
  const baseProjection = projectBlueprintConfirmation({
    confirmation: options.confirmation,
    openQuestions: options.openQuestions,
    lateQuestions: options.lateQuestions,
    summary: options.summary,
  })
  const completedConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'blueprint',
    confirmation: options.completedConfirmation,
    summary: options.summary,
  })
  const completedQuestions = (completedConfirmation?.questions || [])
    .filter(isCompletedQuestion)

  if (!completedQuestions.length) {
    return baseProjection
  }

  const completedKeys = new Set(completedQuestions.flatMap(getQuestionIdentityKeys))
  const isAnswered = (question: NocodeEditorAiConfirmQuestion) => (
    getQuestionIdentityKeys(question).some(key => completedKeys.has(key))
  )
  const remainingOpenQuestions = baseProjection.openQuestions.filter((title) => (
    !completedKeys.has(normalizeQuestionTitleKey(title))
  ))
  const openQuestionConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'blueprint',
    openQuestions: remainingOpenQuestions,
    summary: options.summary,
  })
  const remainingPendingQuestions = mergeQuestionsByIdentity(
    baseProjection.pendingQuestions.filter(question => !isAnswered(question)),
    openQuestionConfirmation?.questions || [],
  )
  const mergedQuestions = mergeQuestionsByIdentity(
    completedQuestions,
    remainingPendingQuestions,
  )
  const mergedConfirmation: NocodeEditorAiConfirmPayload = {
    ...(baseProjection.confirmation || completedConfirmation || {
      stage: 'blueprint' as const,
      questions: [],
    }),
    stage: 'blueprint',
    status: remainingPendingQuestions.length ? 'pending' : 'completed',
    summary: baseProjection.confirmation?.summary
      || completedConfirmation?.summary
      || normalizeText(options.summary)
      || undefined,
    completionSummary: remainingPendingQuestions.length
      ? undefined
      : completedConfirmation?.completionSummary
        || completedConfirmation?.summary
        || undefined,
    resultSummary: completedQuestions
      .map(question => normalizeText(question.answerSummary || question.answerDetail))
      .filter(Boolean),
    questions: mergedQuestions,
  }

  return projectBlueprintConfirmation({
    confirmation: mergedConfirmation,
    openQuestions: remainingOpenQuestions,
    lateQuestions: options.lateQuestions,
    summary: options.summary,
  })
}
