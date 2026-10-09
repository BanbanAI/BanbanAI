import {
  AiReadAppDataAnalysisCompareOp,
  AiReadAppDataAnalysisMetricOp,
  AiReadAppDataAnalysisOrderDirection,
  AiReadAppDataTimeGranularity,
  AiThreadCrossAppAnalysisBundle,
  AiThreadCrossAppAnalysisRequestSummary,
  AiThreadCrossAppAnalysisSlice,
} from '../ai.types'

export function buildCrossAppAnalysisRequestSummaryFromResolvedReadOutput(output: any) {
  if (normalizeText(output?.resolved?.mode).toLowerCase() !== 'aggregate') {
    return undefined
  }

  return normalizeCrossAppAnalysisRequestSummary({
    mode: 'aggregate',
    filters: output?.resolved?.request?.filters,
    groupBy: output?.resolved?.request?.groupBy,
    timeGranularity: output?.resolved?.request?.timeGranularity,
    topN: output?.resolved?.request?.topN,
    analysis: output?.resolved?.request?.analysis,
  })
}

export function buildCrossAppAnalysisRequestSignature(
  requestSummary?: AiThreadCrossAppAnalysisRequestSummary | null,
) {
  const normalized = normalizeCrossAppAnalysisRequestSummary(requestSummary)
  return normalized
    ? stableStringify(normalized)
    : undefined
}

export function normalizeCrossAppAnalysisRequestSummary(
  value?: AiThreadCrossAppAnalysisRequestSummary | Record<string, unknown> | null,
): AiThreadCrossAppAnalysisRequestSummary | undefined {
  if (!isPlainObject(value)) {
    return undefined
  }

  const normalizedMode = normalizeText(value.mode).toLowerCase()
  if (normalizedMode !== 'aggregate') {
    return undefined
  }

  const filters = normalizeStructuredValue(value.filters)
  const groupBy = normalizeText(value.groupBy) || undefined
  const timeGranularity = normalizeTimeGranularity(value.timeGranularity)
  const topN = normalizeFiniteNumber(value.topN)
  const analysis = normalizeAnalysisRequest(value.analysis)

  return cleanObject({
    mode: 'aggregate',
    filters,
    groupBy,
    timeGranularity,
    topN,
    analysis,
  }) as AiThreadCrossAppAnalysisRequestSummary
}

export function normalizeCrossAppAnalysisSlice(
  value?: AiThreadCrossAppAnalysisSlice | null,
): AiThreadCrossAppAnalysisSlice | undefined {
  if (!isPlainObject(value)) {
    return undefined
  }

  const appId = normalizeText(value.appId)
  if (!appId) {
    return undefined
  }

  const requestSummary = normalizeCrossAppAnalysisRequestSummary(value.requestSummary)
  const requestSignature = normalizeText(value.requestSignature)
    || buildCrossAppAnalysisRequestSignature(requestSummary)
    || undefined

  return cleanObject({
    appId,
    appName: normalizeText(value.appName) || undefined,
    targetId: normalizeText(value.targetId) || undefined,
    targetName: normalizeText(value.targetName) || undefined,
    targetType: normalizeTargetType(value.targetType) || undefined,
    requestSignature,
    requestSummary,
    analysisResult: isPlainObject(value.analysisResult) ? value.analysisResult : undefined,
  }) as AiThreadCrossAppAnalysisSlice
}

export function normalizeCrossAppAnalysisBundle(
  value?: AiThreadCrossAppAnalysisBundle | null,
): AiThreadCrossAppAnalysisBundle | undefined {
  if (!isPlainObject(value)) {
    return undefined
  }

  const mode = normalizeBundleMode(value.mode)
  const status = normalizeText(value.status).toLowerCase()
  if (!mode || status !== 'complete') {
    return undefined
  }

  const slices = (Array.isArray(value.slices) ? value.slices : [])
    .map(item => normalizeCrossAppAnalysisSlice(item))
    .filter((item): item is AiThreadCrossAppAnalysisSlice => Boolean(item))
  if (!slices.length) {
    return undefined
  }

  const expectedAppIds = normalizeIdList(value.expectedAppIds)
  if (expectedAppIds.length < 2 || expectedAppIds.length !== slices.length) {
    return undefined
  }

  const requestSummary = normalizeCrossAppAnalysisRequestSummary(value.requestSummary)
  const requestSignature = normalizeText(value.requestSignature)
    || buildCrossAppAnalysisRequestSignature(requestSummary)
    || undefined
  if (!requestSignature) {
    return undefined
  }

  const everySliceMatchesIdentity = slices.every(item =>
    normalizeText(item.requestSignature) === requestSignature
    && expectedAppIds.includes(normalizeText(item.appId)),
  )
  if (!everySliceMatchesIdentity) {
    return undefined
  }

  if (mode === 'compare') {
    const alignmentSummary = normalizeCompareAlignmentSummary(value.alignmentSummary)
    if (!alignmentSummary) {
      return undefined
    }
    return {
      mode,
      status: 'complete',
      expectedAppIds,
      requestSignature,
      requestSummary: requestSummary || { mode: 'aggregate' },
      alignmentSummary,
      slices,
    }
  }

  const alignmentSummary = normalizeMergeAlignmentSummary(value.alignmentSummary)
  if (!alignmentSummary) {
    return undefined
  }
  return {
    mode,
    status: 'complete',
    expectedAppIds,
    requestSignature,
    requestSummary: requestSummary || { mode: 'aggregate' },
    alignmentSummary,
    slices,
  }
}

export function hasCrossAppAnalysisBundleIdentityMismatch(
  left?: AiThreadCrossAppAnalysisBundle | null,
  right?: { expectedAppIds?: string[] | null; requestSignature?: string | null } | null,
) {
  const leftBundle = normalizeCrossAppAnalysisBundle(left || undefined)
  if (!leftBundle || !right) {
    return false
  }

  const requestSignature = normalizeText(right.requestSignature)
  const expectedAppIds = normalizeIdList(right.expectedAppIds)
  return (
    Boolean(requestSignature && requestSignature !== leftBundle.requestSignature)
    || (expectedAppIds.length > 0 && expectedAppIds.join(':') !== leftBundle.expectedAppIds.join(':'))
  )
}

function normalizeAnalysisRequest(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const metrics = (Array.isArray(value.metrics) ? value.metrics : [])
    .map(item => normalizeMetricRequest(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  if (!metrics.length) {
    return undefined
  }

  const groupBy = (Array.isArray(value.groupBy) ? value.groupBy : [])
    .map(item => normalizeGroupRequest(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const having = (Array.isArray(value.having) ? value.having : [])
    .map(item => normalizeHavingRequest(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const orderBy = (Array.isArray(value.orderBy) ? value.orderBy : [])
    .map(item => normalizeOrderByRequest(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const topN = normalizeFiniteNumber(value.topN)

  return cleanObject({
    metrics,
    groupBy,
    having,
    orderBy,
    topN,
  })
}

function normalizeMetricRequest(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const op = normalizeMetricOp(value.op)
  const as = normalizeText(value.as)
  if (!op || !as) {
    return undefined
  }

  return cleanObject({
    op,
    field: normalizeText(value.field) || undefined,
    as,
  }) as {
    op: AiReadAppDataAnalysisMetricOp
    field?: string
    as: string
  }
}

function normalizeGroupRequest(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const field = normalizeText(value.field)
  if (!field) {
    return undefined
  }

  return cleanObject({
    field,
    as: normalizeText(value.as) || undefined,
    timeGranularity: normalizeTimeGranularity(value.timeGranularity),
  })
}

function normalizeHavingRequest(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const metric = normalizeText(value.metric)
  const op = normalizeCompareOp(value.op)
  const normalizedValue = normalizeStructuredValue(value.value)
  if (!metric || !op || normalizedValue === undefined) {
    return undefined
  }

  return {
    metric,
    op,
    value: normalizedValue as string | number | boolean | null,
  }
}

function normalizeOrderByRequest(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const metric = normalizeText(value.metric) || undefined
  const group = normalizeText(value.group) || undefined
  const direction = normalizeOrderDirection(value.direction)
  if (!metric && !group && !direction) {
    return undefined
  }

  return cleanObject({
    metric,
    group,
    direction,
  })
}

function normalizeCompareAlignmentSummary(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const metricKeys = normalizeIdList(value.metricKeys)
  const groupKeys = normalizeIdList(value.groupKeys)
  if (!metricKeys.length || !groupKeys.length) {
    return undefined
  }

  return cleanObject({
    kind: 'compare' as const,
    metricKeys,
    groupKeys,
    timeGranularity: normalizeTimeGranularity(value.timeGranularity),
  }) as {
    kind: 'compare'
    metricKeys: string[]
    groupKeys: string[]
    timeGranularity?: AiReadAppDataTimeGranularity | null
  } | undefined
}

function normalizeMergeAlignmentSummary(value: unknown) {
  if (!isPlainObject(value)) {
    return undefined
  }

  const metricKeys = normalizeIdList(value.metricKeys)
  const groupKeys = normalizeIdList(value.groupKeys)
  const mergeKey = normalizeText(value.mergeKey)
  if (!metricKeys.length || !groupKeys.length || !mergeKey) {
    return undefined
  }

  return {
    kind: 'merge' as const,
    metricKeys,
    groupKeys,
    mergeKey,
  }
}

function normalizeBundleMode(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'compare' || normalized === 'merge'
    ? normalized as 'compare' | 'merge'
    : undefined
}

function normalizeMetricOp(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'].includes(normalized)
    ? normalized as AiReadAppDataAnalysisMetricOp
    : undefined
}

function normalizeCompareOp(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'].includes(normalized)
    ? normalized as AiReadAppDataAnalysisCompareOp
    : undefined
}

function normalizeOrderDirection(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'asc' || normalized === 'desc'
    ? normalized as AiReadAppDataAnalysisOrderDirection
    : undefined
}

function normalizeTimeGranularity(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return ['minute', 'hour', 'day', 'week', 'month', 'year'].includes(normalized)
    ? normalized as AiReadAppDataTimeGranularity
    : undefined
}

function normalizeTargetType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'source'
    ? normalized
    : undefined
}

function normalizeIdList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(item => normalizeText(item)).filter(Boolean))].sort()
    : []
}

function normalizeFiniteNumber(value: unknown) {
  return Number.isFinite(Number(value))
    ? Math.max(0, Number(value))
    : undefined
}

function normalizeStructuredValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeStructuredValue(item))
  }
  if (!isPlainObject(value)) {
    return normalizeText(value)
  }

  const entries = Object.entries(value)
    .map(([key, item]) => [key, normalizeStructuredValue(item)] as const)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return Object.fromEntries(entries)
}

function stableStringify(value: unknown) {
  return JSON.stringify(value)
}

function normalizeText(value?: unknown) {
  return String(value || '').trim()
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cleanObject<T extends Record<string, any>>(value: T) {
  const entries = Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === '') {
      return false
    }
    if (Array.isArray(item)) {
      return item.length > 0
    }
    if (isPlainObject(item)) {
      return Object.keys(item).length > 0
    }
    return true
  })

  return entries.length
    ? Object.fromEntries(entries) as T
    : undefined
}
