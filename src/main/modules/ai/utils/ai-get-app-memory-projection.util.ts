import type {
  AiAppMemoryEvidenceProfile,
  AiConversationProfile,
  AiGetAppMemoryOutput,
  AiThreadRuntimeIntent,
} from '../ai.types'

export type AiGetAppMemoryProjectionMode = 'detail' | 'summary' | 'history_full' | 'history_fallback'

type AiSourceLike = AiGetAppMemoryOutput['sources'][number] | Record<string, any>

export type AiGetAppMemoryProjectionInput = {
  userMessage?: string
  conversationProfile?: AiConversationProfile
  currentIntent?: AiThreadRuntimeIntent
  mode: AiGetAppMemoryProjectionMode
  request?: AiGetAppMemoryOutput['request'] | Record<string, any> | null
  app?: AiGetAppMemoryOutput['app'] | Record<string, any> | null
  evidenceProfile?: AiAppMemoryEvidenceProfile | Record<string, any> | null
  sources?: AiSourceLike[]
}

export type AiProjectedSource = {
  sourceId: string
  sourceName?: string
  role?: string
  summary?: string
  whenToUse?: string
  recordRouteHints?: string[]
  typicalQuestions?: string[]
  keyFields?: Array<{
    id?: string
    name?: string
    displayMeta?: Record<string, any>
  }>
  queryHints?: {
    timeFields?: string[]
    metricFields?: string[]
    entityFields?: string[]
    filterFields?: string[]
  }
  doNotUseFor?: string[]
  score: number
  reasons: string[]
  compacted?: boolean
}

export type AiProjectedSemanticProfile = {
  summary?: string
  primaryUseCases?: string[]
  keyEntities?: string[]
  keyActions?: string[]
  featureTags?: string[]
  relationOverview?: string[]
  sourceRoleHints?: string[]
  doNotUseFor?: string[]
}

export type AiGetAppMemoryProjectionResult = {
  semanticProfile?: AiProjectedSemanticProfile
  sources: AiProjectedSource[]
  omittedSourceCount: number
  compacted: boolean
}

type ProjectionModeConfig = {
  sourceCount: number
  keyFieldCount: number
  summaryLength: number
  whenToUseLength: number
  compactSecondaryVariants: boolean
  forceCompact: boolean
}

type ProjectionContext = {
  userMessage: string
  profile?: AiConversationProfile
  currentIntent?: AiThreadRuntimeIntent
  focusSourceIds: Set<string>
  timeHints: string[]
  metricHints: string[]
  entityHints: string[]
}

type ScoredSource = {
  source: AiSourceLike
  sourceId: string
  sourceNameKey: string
  index: number
  score: number
  reasons: string[]
  lookupTexts: string[]
}

const MODE_CONFIG: Record<AiGetAppMemoryProjectionMode, ProjectionModeConfig> = {
  detail: {
    sourceCount: 4,
    keyFieldCount: 4,
    summaryLength: 120,
    whenToUseLength: 120,
    compactSecondaryVariants: false,
    forceCompact: false,
  },
  summary: {
    sourceCount: 3,
    keyFieldCount: 3,
    summaryLength: 96,
    whenToUseLength: 84,
    compactSecondaryVariants: true,
    forceCompact: false,
  },
  history_full: {
    sourceCount: 3,
    keyFieldCount: 3,
    summaryLength: 96,
    whenToUseLength: 84,
    compactSecondaryVariants: true,
    forceCompact: false,
  },
  history_fallback: {
    sourceCount: 2,
    keyFieldCount: 1,
    summaryLength: 48,
    whenToUseLength: 48,
    compactSecondaryVariants: true,
    forceCompact: true,
  },
}

function normalizeText(value: any) {
  return String(value || '').trim().toLowerCase()
}

function truncateText(value: any, maxLength: number) {
  const normalized = String(value || '').trim()
  if (!normalized || maxLength <= 0 || normalized.length <= maxLength) {
    return normalized || undefined
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`
}

function uniqueTexts(values: any[]) {
  return Array.from(new Set(
    values
      .map(item => String(item || '').trim())
      .filter(Boolean),
  ))
}

function uniqueByKey<T>(items: T[], getKey: (item: T) => string) {
  const nextItems: T[] = []
  const seenKeys = new Set<string>()

  for (const item of items) {
    const key = getKey(item)
    if (!key || seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)
    nextItems.push(item)
  }

  return nextItems
}

function normalizeIdList(value: any) {
  return uniqueTexts(Array.isArray(value) ? value : [])
}

function limitStringList(value: any, limit: number) {
  return uniqueTexts(Array.isArray(value) ? value : []).slice(0, Math.max(0, limit))
}

function projectSemanticProfile(app: AiGetAppMemoryOutput['app'] | Record<string, any> | null | undefined) {
  const semanticProfile = app && typeof app === 'object' && !Array.isArray(app)
    ? (app as any)?.semanticProfile
    : null
  if (!semanticProfile || typeof semanticProfile !== 'object') {
    return undefined
  }

  const projected: AiProjectedSemanticProfile = {
    summary: truncateText(semanticProfile.derivedSummary || semanticProfile.summary, 220),
    primaryUseCases: limitStringList(semanticProfile.primaryUseCases, 4),
    keyEntities: limitStringList(semanticProfile.keyEntities, 4),
    keyActions: limitStringList(semanticProfile.keyActions, 4),
    featureTags: limitStringList(semanticProfile.featureTags, 6),
    relationOverview: limitStringList(semanticProfile.relationOverview, 6),
    sourceRoleHints: limitStringList(semanticProfile.sourceRoleHints, 6),
    doNotUseFor: limitStringList(semanticProfile.doNotUseFor, 4),
  }

  return Object.values(projected).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value))
    ? projected
    : undefined
}

function buildSourceLookupTexts(source: AiSourceLike) {
  const keyFieldTexts = (Array.isArray(source?.keyFields) ? source.keyFields : [])
    .flatMap((field: any) => [field?.id, field?.name])
  const queryHints = source?.queryHints && typeof source.queryHints === 'object'
    ? source.queryHints
    : {}
  const recordRouteHints = Array.isArray(source?.recordRouteHints) ? source.recordRouteHints : []
  const typicalQuestions = Array.isArray(source?.typicalQuestions) ? source.typicalQuestions : []

  return uniqueTexts([
    source?.sourceId,
    source?.sourceName,
    source?.role,
    source?.summary,
    source?.whenToUse,
    ...recordRouteHints,
    ...typicalQuestions,
    ...(Array.isArray(source?.doNotUseFor) ? source.doNotUseFor : []),
    ...keyFieldTexts,
    ...(Array.isArray(queryHints?.timeFields) ? queryHints.timeFields : []),
    ...(Array.isArray(queryHints?.metricFields) ? queryHints.metricFields : []),
    ...(Array.isArray(queryHints?.entityFields) ? queryHints.entityFields : []),
    ...(Array.isArray(queryHints?.filterFields) ? queryHints.filterFields : []),
  ]).map(normalizeText).filter(Boolean)
}

function matchesHints(texts: string[], hints: string[]) {
  if (!texts.length || !hints.length) {
    return false
  }

  return hints.some(hint => texts.some(text => text.includes(hint)))
}

function matchesMessage(texts: string[], userMessage: string) {
  const normalizedMessage = normalizeText(userMessage)
  if (!normalizedMessage) {
    return false
  }

  return texts.some(text =>
    text.length >= 2
    && (normalizedMessage.includes(text) || text.includes(normalizedMessage)),
  )
}

function normalizeLookupList(value: any) {
  return uniqueTexts(Array.isArray(value) ? value : []).map(normalizeText).filter(Boolean)
}

function getProfileHintArrays(profile: AiAppMemoryEvidenceProfile | Record<string, any> | null | undefined) {
  const normalizedProfile = profile && typeof profile === 'object' && !Array.isArray(profile)
    ? profile
    : {}

  return {
    timeHints: limitStringList(normalizedProfile?.timeFieldHints, 6).map(normalizeText).filter(Boolean),
    metricHints: limitStringList(normalizedProfile?.metricHints, 6).map(normalizeText).filter(Boolean),
    entityHints: uniqueTexts([
      ...(Array.isArray(normalizedProfile?.businessObjects) ? normalizedProfile.businessObjects : []),
      ...(Array.isArray(normalizedProfile?.attributeHints) ? normalizedProfile.attributeHints : []),
      ...(Array.isArray(normalizedProfile?.semanticFitHints) ? normalizedProfile.semanticFitHints : []),
    ]).map(normalizeText).filter(Boolean).slice(0, 8),
  }
}

function buildProjectionContext(input: AiGetAppMemoryProjectionInput): ProjectionContext {
  const hints = getProfileHintArrays(input.evidenceProfile)

  return {
    userMessage: String(input.userMessage || '').trim(),
    profile: input.conversationProfile,
    currentIntent: input.currentIntent,
    focusSourceIds: new Set(normalizeIdList(input?.request?.focus?.sourceIds)),
    timeHints: hints.timeHints,
    metricHints: hints.metricHints,
    entityHints: hints.entityHints,
  }
}

function compareByScore<T extends { score: number; index: number }>(left: T, right: T) {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  return left.index - right.index
}

function scoreSource(source: AiSourceLike, index: number, context: ProjectionContext): ScoredSource {
  const sourceId = String(source?.sourceId || '').trim()
  const sourceNameKey = normalizeText(source?.sourceName)
  const lookupTexts = buildSourceLookupTexts(source)
  const routeHints = normalizeLookupList(source?.recordRouteHints)
  const typicalQuestions = normalizeLookupList(source?.typicalQuestions)
  const reasons: string[] = []
  let score = 0

  if (context.focusSourceIds.has(sourceId)) {
    score += 1000
    reasons.push('focus_source')
  }
  if (matchesMessage(routeHints, context.userMessage)) {
    score += 180
    reasons.push('route_hint_match')
  }
  if (matchesMessage(typicalQuestions, context.userMessage)) {
    score += 220
    reasons.push('typical_question_match')
  }
  if (matchesHints(lookupTexts, context.timeHints)) {
    score += 120
    reasons.push('time_hint')
  }
  if (matchesHints(lookupTexts, context.metricHints)) {
    score += 120
    reasons.push('metric_hint')
  }
  if (matchesHints(lookupTexts, context.entityHints)) {
    score += 80
    reasons.push('entity_hint')
  }
  if (matchesMessage(lookupTexts, context.userMessage)) {
    score += 60
    reasons.push('message_match')
  }
  if (context.profile === 'records_query') {
    score += 30
    reasons.push('records_profile_bias')
  }
  if (context.currentIntent === 'aggregation') {
    score += 40
    reasons.push('aggregation_intent_bias')
  }
  if (context.currentIntent === 'records') {
    score += 25
    reasons.push('records_intent_bias')
  }

  const queryHints = source?.queryHints && typeof source.queryHints === 'object'
    ? source.queryHints
    : {}
  if (
    Array.isArray(queryHints?.timeFields) && queryHints.timeFields.length
    || Array.isArray(queryHints?.metricFields) && queryHints.metricFields.length
    || Array.isArray(queryHints?.entityFields) && queryHints.entityFields.length
  ) {
    score += 20
    reasons.push('structured_query_hint')
  }

  return {
    source,
    sourceId,
    sourceNameKey,
    index,
    score,
    reasons: uniqueTexts(reasons),
    lookupTexts,
  }
}

function selectCoverageSources(
  selected: ScoredSource[],
  scoredSources: ScoredSource[],
  limit: number,
) {
  if (selected.length >= limit) {
    return selected
  }

  const selectedIds = new Set(selected.map(item => item.sourceId))
  const fallbackCandidate = [...scoredSources]
    .filter(item => !selectedIds.has(item.sourceId))
    .sort(compareByScore)[0]

  if (fallbackCandidate && selected.length < limit) {
    selected.push(fallbackCandidate)
  }

  return selected
}

function selectPrimarySources(
  scoredSources: ScoredSource[],
  context: ProjectionContext,
  config: ProjectionModeConfig,
) {
  if (!scoredSources.length) {
    return []
  }

  const focusMatches = scoredSources
    .filter(item => context.focusSourceIds.has(item.sourceId))
    .sort(compareByScore)
  const selected = [...focusMatches]
  const selectedIds = new Set(selected.map(item => item.sourceId))

  for (const candidate of [...scoredSources].sort(compareByScore)) {
    if (selectedIds.has(candidate.sourceId) || candidate.score <= 0) {
      continue
    }
    selected.push(candidate)
    selectedIds.add(candidate.sourceId)
    if (selected.length >= config.sourceCount) {
      break
    }
  }

  selectCoverageSources(selected, scoredSources, config.sourceCount)

  if (!selected.length) {
    return [...scoredSources].sort(compareByScore).slice(0, Math.min(config.sourceCount, 2))
  }

  return uniqueByKey(selected.sort(compareByScore), item => item.sourceId)
}

function expandSameNameVariants(selected: ScoredSource[], allSources: ScoredSource[]) {
  const selectedNames = new Set(
    selected
      .map(item => item.sourceNameKey)
      .filter(Boolean),
  )
  if (!selectedNames.size) {
    return selected
  }

  const groupedVariants = allSources
    .filter(item => selectedNames.has(item.sourceNameKey))
    .sort((left, right) => left.index - right.index)

  return uniqueByKey(
    [...selected, ...groupedVariants],
    item => item.sourceId,
  )
}

function buildProjectedSource(
  item: ScoredSource,
  config: ProjectionModeConfig,
  primarySourceIds: Set<string>,
): AiProjectedSource {
  const compactBecauseVariant = config.compactSecondaryVariants
    && !primarySourceIds.has(item.sourceId)
    && Boolean(item.sourceNameKey)
  const compacted = config.forceCompact || compactBecauseVariant
  const keyFields = (Array.isArray(item.source?.keyFields) ? item.source.keyFields : [])
    .slice(0, compacted ? Math.min(1, config.keyFieldCount) : config.keyFieldCount)
    .map((field: any) => ({
      id: String(field?.id || '').trim() || undefined,
      name: String(field?.name || '').trim() || undefined,
      displayMeta: field?.displayMeta && typeof field.displayMeta === 'object'
        ? field.displayMeta
        : undefined,
    }))
    .filter(field => field.id || field.name)

  const queryHints = compacted
    ? undefined
    : (() => {
        const normalizedHints = item.source?.queryHints && typeof item.source.queryHints === 'object'
          ? item.source.queryHints
          : {}

        const result = {
          timeFields: limitStringList(normalizedHints?.timeFields, 3),
          metricFields: limitStringList(normalizedHints?.metricFields, 3),
          entityFields: limitStringList(normalizedHints?.entityFields, 3),
          filterFields: limitStringList(normalizedHints?.filterFields, 3),
        }

        return Object.values(result).some(value => value.length)
          ? result
          : undefined
      })()

  return {
    sourceId: item.sourceId,
    sourceName: String(item.source?.sourceName || '').trim() || undefined,
    role: String(item.source?.role || '').trim() || undefined,
    summary: compacted && !primarySourceIds.has(item.sourceId)
      ? truncateText(item.source?.summary, Math.min(40, config.summaryLength))
      : truncateText(item.source?.summary, config.summaryLength),
    whenToUse: compacted ? undefined : truncateText(item.source?.whenToUse, config.whenToUseLength),
    recordRouteHints: compacted ? undefined : limitStringList(item.source?.recordRouteHints, 3),
    typicalQuestions: compacted ? undefined : limitStringList(item.source?.typicalQuestions, 3),
    keyFields: keyFields.length ? keyFields : undefined,
    queryHints,
    doNotUseFor: compacted ? undefined : limitStringList(item.source?.doNotUseFor, 3),
    score: item.score,
    reasons: uniqueTexts([
      ...item.reasons,
      compactBecauseVariant ? 'same_name_variant' : '',
    ]).slice(0, 6),
    compacted: compacted || undefined,
  }
}

export function projectGetAppMemoryForPrompt(
  input: AiGetAppMemoryProjectionInput,
): AiGetAppMemoryProjectionResult {
  const config = MODE_CONFIG[input.mode]
  const context = buildProjectionContext(input)
  const sources = Array.isArray(input.sources) ? input.sources : []

  const scoredSources = sources
    .map((source, index) => scoreSource(source, index, context))
    .filter(item => item.sourceId)
  const primarySources = selectPrimarySources(scoredSources, context, config)
  const expandedSources = expandSameNameVariants(primarySources, scoredSources)
  const primarySourceIds = new Set(primarySources.map(item => item.sourceId))
  const projectedSources = expandedSources
    .sort((left, right) => {
      const leftPrimary = primarySourceIds.has(left.sourceId) ? 1 : 0
      const rightPrimary = primarySourceIds.has(right.sourceId) ? 1 : 0
      if (rightPrimary !== leftPrimary) {
        return rightPrimary - leftPrimary
      }
      return compareByScore(left, right)
    })
    .map(item => buildProjectedSource(item, config, primarySourceIds))

  const omittedSourceCount = Math.max(0, scoredSources.length - projectedSources.length)
  const compacted = input.mode === 'history_fallback'
    || projectedSources.some(item => item.compacted)
    || omittedSourceCount > 0

  return {
    semanticProfile: projectSemanticProfile(input.app),
    sources: projectedSources,
    omittedSourceCount,
    compacted,
  }
}
