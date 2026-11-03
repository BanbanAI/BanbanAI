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
import {
  isNocodeEditorDefaultHandledConfirmationQuestion,
  isNocodeEditorPendingDecisionQuestion,
} from './nocodeEditorConfirmationQuestionGrouping'

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

const normalizeQuestionTitleKey = (value: unknown) => (
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\?/g, '？')
)

const resolveQuestionTitleText = (value: unknown) => (
  typeof value === 'string'
    ? normalizeText(value)
    : (
      value && typeof value === 'object'
        ? normalizeText((value as Record<string, unknown>).title)
        : ''
    )
)

// 同一问题可能同时出现在结构化 confirmation 和 openQuestions 中：
// 纯文本题常把说明附在题干后，例如“xxx是否合适？后续会…”。以第一个问号前的
// 题干作为补充身份键；如果问号后还有追问，则不做截断，避免把两个连续问题误合并。
const resolveQuestionTitleIdentityKeys = (value: unknown) => {
  const title = resolveQuestionTitleText(value)
  if (!title) {
    return []
  }

  const normalizedTitle = normalizeQuestionTitleKey(title)
  const questionMarkIndex = title.search(/[?？]/)
  if (questionMarkIndex < 0) {
    return [normalizedTitle]
  }

  const coreTitle = title.slice(0, questionMarkIndex + 1).trim()
  const remainder = title.slice(questionMarkIndex + 1)
  if (!coreTitle || /[?？]/.test(remainder)) {
    return [normalizedTitle]
  }

  const normalizedCoreTitle = normalizeQuestionTitleKey(coreTitle)
  return normalizedCoreTitle && normalizedCoreTitle !== normalizedTitle
    ? [normalizedTitle, normalizedCoreTitle]
    : [normalizedTitle]
}

const isPendingQuestion = (question: NocodeEditorAiConfirmQuestion) => (
  isNocodeEditorPendingDecisionQuestion(question)
)

const isCompletedQuestion = (question: NocodeEditorAiConfirmQuestion) => (
  question.confirmed === true
  || Boolean(
    normalizeText(question.selectedOptionValue)
    || normalizeText(question.answerSummary)
    || normalizeText(question.answerDetail)
    || question.options?.some(option => option.selected),
  )
)

const resolveQuestionTargetIdentityKey = (question: NocodeEditorAiConfirmQuestion) => {
  const formKey = normalizeText(question.decisionTarget?.formKey)
  const fieldKey = normalizeText(question.decisionTarget?.fieldKey)
  return formKey && fieldKey ? `target:${formKey}:${fieldKey}` : ''
}

const POSITIONAL_BLUEPRINT_QUESTION_ID =
  /^(?:blueprint|form-blueprint)-question-\d+(?:-\d+)?$|^blueprint-late-question-\d+(?:-\d+)?$/u

// 位置型 id 只表示「本轮第几题」，换一轮就会指向另一道题，不能当作已完成身份。
const isPositionalBlueprintQuestionId = (id: unknown) => (
  POSITIONAL_BLUEPRINT_QUESTION_ID.test(normalizeText(id))
)

const getQuestionIdentityKeys = (question: NocodeEditorAiConfirmQuestion) => (
  [
    normalizeText(question.decisionKey),
    isPositionalBlueprintQuestionId(question.id) ? '' : normalizeText(question.id),
    resolveQuestionTargetIdentityKey(question),
    ...resolveQuestionTitleIdentityKeys(question.title),
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
    const keys = resolveQuestionTitleIdentityKeys(title)
    if (!title || keys.some(key => seen.has(key))) {
      return titles
    }
    keys.forEach(key => seen.add(key))
    titles.push(title)
    return titles
  }, [])
}

const OPEN_QUESTION_DUPLICATE_SIMILARITY_THRESHOLD = 0.72

const normalizeQuestionSimilarityText = (value: unknown) => (
  normalizeText(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
)

const collectQuestionTextBigrams = (text: string) => {
  const bigrams = new Set<string>()
  for (let index = 0; index < text.length - 1; index += 1) {
    bigrams.add(text.slice(index, index + 2))
  }
  return bigrams
}

const computeQuestionTextSimilarity = (left: unknown, right: unknown) => {
  const leftText = normalizeQuestionSimilarityText(left)
  const rightText = normalizeQuestionSimilarityText(right)
  if (!leftText || !rightText) {
    return 0
  }
  if (leftText === rightText) {
    return 1
  }
  if (leftText.length < 2 || rightText.length < 2) {
    return 0
  }

  const leftBigrams = collectQuestionTextBigrams(leftText)
  const rightBigrams = collectQuestionTextBigrams(rightText)
  let intersection = 0
  leftBigrams.forEach((bigram) => {
    if (rightBigrams.has(bigram)) {
      intersection += 1
    }
  })
  return (2 * intersection) / (leftBigrams.size + rightBigrams.size)
}

const resolveQuestionComparisonText = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const question = value as Record<string, unknown>
    return [
      normalizeText(question.title),
      normalizeText(question.description),
    ].filter(Boolean).join('\n')
  }
  return normalizeText(value)
}

const QUESTION_INTENT_PATTERN = /[?？]|请|是否|如何|怎么|怎样|哪|哪些|哪个|多少|多久|需要|要不要|能否|可否|确认|说明|补充|选择|填写|提供/u

const isDeclarativeQuestionStatement = (value: unknown) => {
  const text = resolveQuestionComparisonText(value)
  return Boolean(text) && !QUESTION_INTENT_PATTERN.test(text)
}

const resolveQuestionFieldNameSuffixes = (value: string) => new Set(
  Array.from(value.matchAll(/([\p{Script=Han}]{2,8})字段/gu))
    .map(match => normalizeQuestionSimilarityText(match[1]))
    .filter(Boolean),
)

const resolveQuestionQuotedTerms = (value: string) => new Set(
  Array.from(value.matchAll(/[“「『]([^”」』]{1,40})[”」』]/gu))
    .map(match => normalizeQuestionSimilarityText(match[1]))
    .filter(Boolean),
)

const hasConflictingQuestionEntities = (left: string, right: string) => {
  const leftFieldSuffixes = resolveQuestionFieldNameSuffixes(left)
  const rightFieldSuffixes = resolveQuestionFieldNameSuffixes(right)
  if (
    leftFieldSuffixes.size
    && rightFieldSuffixes.size
    && !Array.from(leftFieldSuffixes).some(suffix => rightFieldSuffixes.has(suffix))
  ) {
    return true
  }

  const leftQuotedTerms = resolveQuestionQuotedTerms(left)
  const rightQuotedTerms = resolveQuestionQuotedTerms(right)
  return leftQuotedTerms.size > 0
    && rightQuotedTerms.size > 0
    && (
      Array.from(leftQuotedTerms).some(term => !rightQuotedTerms.has(term))
      || Array.from(rightQuotedTerms).some(term => !leftQuotedTerms.has(term))
    )
}

// openQuestions 只承载问题；陈述式内容通常是结构化说明被重复放进了另一条通道。
// 仅在文本高度重合且没有指向不同字段/对象时丢弃副本，提问句始终保留。
const isDuplicateStructuredQuestionOpenQuestion = (
  value: unknown,
  structuredQuestionTexts: string[],
) => {
  const comparisonText = resolveQuestionComparisonText(value)
  if (!isDeclarativeQuestionStatement(comparisonText)) {
    return false
  }
  return structuredQuestionTexts.some((structuredText) => (
    computeQuestionTextSimilarity(comparisonText, structuredText)
      >= OPEN_QUESTION_DUPLICATE_SIMILARITY_THRESHOLD
    && !hasConflictingQuestionEntities(comparisonText, structuredText)
  ))
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
  const completedQuestionKeys = new Set(
    (initialBaseConfirmation?.questions || [])
      .filter(isCompletedQuestion)
      .flatMap(getQuestionIdentityKeys)
      .filter(Boolean),
  )
  const resolveValueIdentityKeys = (value: unknown) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? getQuestionIdentityKeys(value as NocodeEditorAiConfirmQuestion)
      : resolveQuestionTitleIdentityKeys(value)
  )
  const structuredQuestionTexts = Array.isArray(rawOpenQuestions) && rawOpenQuestions.length
    ? (normalizeNocodeEditorConfirmationPayload({
      stage: 'blueprint',
      confirmation,
      summary,
    })?.questions || [])
      .map(question => resolveQuestionComparisonText(question))
      .filter(Boolean)
    : []
  const openQuestions = Array.isArray(rawOpenQuestions)
    ? rawOpenQuestions.filter(value => (
      !resolveValueIdentityKeys(value)
        .some(key => completedQuestionKeys.has(key))
      && !isDuplicateStructuredQuestionOpenQuestion(value, structuredQuestionTexts)
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
    ? lateQuestionConfirmation.questions
      .filter(isPendingQuestion)
      .filter(question => !getQuestionIdentityKeys(question)
        .some(key => completedQuestionKeys.has(key)))
    : []

  if (!latePendingQuestions.length) {
    return {
      confirmation: baseConfirmation,
      openQuestions: dedupeQuestionTitles(basePendingQuestions),
      pendingQuestions: basePendingQuestions,
    }
  }

  const pendingBaseQuestionsByKey = new Map<string, NocodeEditorAiConfirmQuestion>()
  basePendingQuestions.forEach((question) => {
    getQuestionIdentityKeys(question).forEach((key) => {
      if (key && !pendingBaseQuestionsByKey.has(key)) {
        pendingBaseQuestionsByKey.set(key, question)
      }
    })
  })

  const mergedPendingQuestions: NocodeEditorAiConfirmQuestion[] = []
  const mergedBaseQuestions = new Set<NocodeEditorAiConfirmQuestion>()
  latePendingQuestions.forEach((question) => {
    const matchedBaseQuestion = getQuestionIdentityKeys(question)
      .map(key => pendingBaseQuestionsByKey.get(key))
      .find((candidate): candidate is NocodeEditorAiConfirmQuestion => Boolean(candidate))
    if (matchedBaseQuestion) {
      if (!mergedBaseQuestions.has(matchedBaseQuestion)) {
        mergedBaseQuestions.add(matchedBaseQuestion)
        mergedPendingQuestions.push(matchedBaseQuestion)
      }
      return
    }
    mergedPendingQuestions.push(question)
  })
  basePendingQuestions.forEach((question) => {
    if (!mergedBaseQuestions.has(question)) {
      mergedPendingQuestions.push(question)
    }
  })

  // 迟到问题只能追加待确认项，不能把已完成结论从卡片记录里抹掉：
  // 下一版暂存/刷新会以这里的结果恢复当前蓝图，丢弃已完成问题会让已答决策
  // 在后续版本被字段澄清重新问一遍。「已按默认处理」的说明项同样需要保留。
  const finalizedQuestions = ensureUniqueQuestionIds(mergeQuestionsByIdentity(
    Array.isArray(baseConfirmation?.questions)
      ? baseConfirmation.questions.filter(question => (
        isCompletedQuestion(question)
        || isNocodeEditorDefaultHandledConfirmationQuestion(question)
      ))
      : [],
    mergedPendingQuestions,
  ))
  const finalizedPendingQuestions = finalizedQuestions.filter(isPendingQuestion)

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
      questions: finalizedQuestions,
    },
    openQuestions: dedupeQuestionTitles(finalizedPendingQuestions),
    pendingQuestions: finalizedPendingQuestions,
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
    !resolveQuestionTitleIdentityKeys(title)
      .some(key => completedKeys.has(key))
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
