import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmStatus,
  NocodeEditorAiConfirmSurface,
  NocodeEditorPlanningQuestionStage,
} from '../types/nocodeEditorConfirmation'

const normalizeIdentityText = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\s+/gu, ' ')
  .trim()
  .toLowerCase()

const hashQuestionSeed = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeTitleKey = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[？?。.!！\s]+$/gu, '')
  .replace(/\s+/gu, ' ')
  .trim()
  .toLowerCase()

const normalizeDelimitedTitleLeadingKey = (value: unknown) => {
  const title = String(value ?? '').normalize('NFKC')
  const delimiterIndex = title.indexOf(':')
  if (delimiterIndex <= 0 || !title.slice(delimiterIndex + 1).trim()) {
    return ''
  }
  return normalizeTitleKey(title.slice(0, delimiterIndex))
}

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

export type ReconciledPlanningConfirmation = {
  confirmation: NocodeEditorAiConfirmPayload | null
  openQuestions: string[]
}

export const buildStablePlanningQuestionId = (input: {
  stage: NocodeEditorPlanningQuestionStage
  explicitId?: unknown
  title: unknown
}) => {
  const explicitId = String(input.explicitId ?? '').trim()
  if (explicitId) {
    return explicitId
  }

  const title = normalizeIdentityText(input.title)
  return `${input.stage}-question-${hashQuestionSeed(`${input.stage}:${title}`)}`
}

export const isQuestionAnswered = (question: NocodeEditorAiConfirmQuestion) => (
  question.confirmed !== false
  && (
    question.confirmed === true
    || Boolean(normalizeText(question.selectedOptionValue))
    || Boolean(normalizeText(question.answerSummary))
    || Boolean(normalizeText(question.answerDetail))
  )
)

type PlanningQuestionIdCandidate = {
  index: number
  baseId: string
  sortKey: string
}

const compareStableText = (left: string, right: string) => (
  left < right ? -1 : left > right ? 1 : 0
)

const buildQuestionBusinessFingerprint = (question: NocodeEditorAiConfirmQuestion) => {
  const options = (question.options || [])
    .map(option => ({
      value: normalizeIdentityText(option.value),
      label: normalizeIdentityText(option.label),
      description: normalizeIdentityText(option.description),
    }))
    .sort((left, right) => compareStableText(JSON.stringify(left), JSON.stringify(right)))
  const dependsOn = (question.dependsOn || [])
    .map(item => normalizeIdentityText(item))
    .filter(Boolean)
    .sort(compareStableText)

  return JSON.stringify({
    title: normalizeIdentityText(question.title),
    domain: normalizeIdentityText(question.domain),
    questionKind: normalizeIdentityText(question.questionKind),
    scopeKind: normalizeIdentityText(question.scopeKind),
    branchKey: normalizeIdentityText(question.branchKey),
    description: normalizeIdentityText(question.description),
    required: question.required ?? null,
    allowFreeText: question.allowFreeText ?? null,
    options,
    dependsOn,
  })
}

const allocateDeterministicQuestionIds = (
  candidates: PlanningQuestionIdCandidate[],
  usedIds: Set<string>,
) => {
  const candidatesByBaseId = new Map<string, PlanningQuestionIdCandidate[]>()
  candidates.forEach((candidate) => {
    const group = candidatesByBaseId.get(candidate.baseId) || []
    group.push(candidate)
    candidatesByBaseId.set(candidate.baseId, group)
  })

  const reservedBaseIds = new Set(candidatesByBaseId.keys())
  const allocatedIds = new Map<number, string>()
  const sortedCandidateGroups = [...candidatesByBaseId.entries()]
    .sort(([left], [right]) => compareStableText(left, right))
  sortedCandidateGroups.forEach(([baseId, group]) => {
    group
      .sort((left, right) => (
        compareStableText(left.sortKey, right.sortKey)
        || left.index - right.index
      ))
      .forEach((candidate) => {
        let suffix = 1
        let nextId = baseId
        while (
          usedIds.has(nextId)
          || (nextId !== baseId && reservedBaseIds.has(nextId))
        ) {
          suffix += 1
          nextId = `${baseId}-${suffix}`
        }
        usedIds.add(nextId)
        allocatedIds.set(candidate.index, nextId)
      })
  })

  return allocatedIds
}

const assignStructuredQuestionIds = (
  questions: NocodeEditorAiConfirmQuestion[],
  stage: NocodeEditorPlanningQuestionStage,
) => {
  const explicitIds = questions.map(question => normalizeText(question.id))
  const explicitIdCounts = explicitIds.reduce<Map<string, number>>((counts, id) => {
    if (id) {
      counts.set(id, (counts.get(id) || 0) + 1)
    }
    return counts
  }, new Map())
  const usedIds = new Set(
    explicitIds.filter(id => id && explicitIdCounts.get(id) === 1),
  )
  const fallbackCandidates = questions.flatMap((question, index) => {
    const explicitId = explicitIds[index]
    if (explicitId && explicitIdCounts.get(explicitId) === 1) {
      return []
    }
    const fingerprint = buildQuestionBusinessFingerprint(question)
    return [{
      index,
      baseId: `${stage}-question-${hashQuestionSeed(`${stage}:${fingerprint}`)}`,
      sortKey: fingerprint,
    }]
  })
  const allocatedIds = allocateDeterministicQuestionIds(fallbackCandidates, usedIds)

  return {
    questions: questions.map((question, index) => {
      const explicitId = explicitIds[index]
      const id = explicitId && explicitIdCounts.get(explicitId) === 1
        ? explicitId
        : allocatedIds.get(index) || buildStablePlanningQuestionId({
          stage,
          title: question.title,
        })
      return id === question.id ? question : { ...question, id }
    }),
    usedIds,
  }
}

export const reconcileNormalizedPlanningQuestions = (input: {
  stage: NocodeEditorPlanningQuestionStage
  status?: NocodeEditorAiConfirmStatus
  structuredQuestions: NocodeEditorAiConfirmQuestion[]
  legacyOpenQuestions: string[]
}) => {
  const questions: NocodeEditorAiConfirmQuestion[] = []
  const knownTitles = new Set<string>()
  const structuredTitles = new Set<string>()
  const structuredAssignment = assignStructuredQuestionIds(
    input.structuredQuestions,
    input.stage,
  )

  structuredAssignment.questions.forEach((question) => {
    const titleKey = normalizeTitleKey(question.title)
    questions.push(question)
    if (titleKey) {
      knownTitles.add(titleKey)
      structuredTitles.add(titleKey)
    }
  })

  if (input.status !== 'completed') {
    const legacyQuestions = normalizeStringList(input.legacyOpenQuestions).flatMap((title) => {
      const titleKey = normalizeTitleKey(title)
      const leadingTitleKey = normalizeDelimitedTitleLeadingKey(title)
      if (
        !titleKey
        || knownTitles.has(titleKey)
        || (leadingTitleKey && structuredTitles.has(leadingTitleKey))
      ) {
        return []
      }
      knownTitles.add(titleKey)
      return [{ title }]
    })
    const allocatedLegacyIds = allocateDeterministicQuestionIds(
      legacyQuestions.map((item, index) => ({
        index,
        baseId: buildStablePlanningQuestionId({ stage: input.stage, title: item.title }),
        sortKey: normalizeIdentityText(item.title),
      })),
      structuredAssignment.usedIds,
    )
    legacyQuestions.forEach((item, index) => {
      questions.push({
        id: allocatedLegacyIds.get(index) || buildStablePlanningQuestionId({
          stage: input.stage,
          title: item.title,
        }),
        title: item.title,
        questionKind: 'note_only',
      })
    })
  }

  return questions
}

export const projectPendingPlanningQuestionTitles = (
  questions: NocodeEditorAiConfirmQuestion[],
  status?: NocodeEditorAiConfirmStatus,
) => status === 'completed'
  ? []
  : questions.filter(item => !isQuestionAnswered(item)).map(item => item.title)

export const reconcilePlanningConfirmation = (input: {
  stage: NocodeEditorPlanningQuestionStage
  structuredConfirmation?: NocodeEditorAiConfirmPayload | null
  legacyOpenQuestions?: unknown
  openQuestions?: unknown
  preferredSurface?: NocodeEditorAiConfirmSurface
  summary?: unknown
}): ReconciledPlanningConfirmation => {
  const structured = input.structuredConfirmation
  const questions = reconcileNormalizedPlanningQuestions({
    stage: input.stage,
    status: structured?.status,
    structuredQuestions: structured?.questions || [],
    legacyOpenQuestions: [
      ...normalizeStringList(input.legacyOpenQuestions),
      ...normalizeStringList(input.openQuestions),
    ],
  })
  const confirmation = structured || (questions.length
    ? {
      stage: input.stage,
      status: 'pending' as const,
      preferredSurface: input.preferredSurface,
      summary: normalizeText(input.summary) || undefined,
      questions,
    }
    : null)

  return {
    confirmation: confirmation
      ? { ...confirmation, questions }
      : null,
    openQuestions: projectPendingPlanningQuestionTitles(
      questions,
      confirmation?.status,
    ),
  }
}
