function normalizeStringArray(value: any) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => String(item || '').trim())
      .filter(Boolean),
  ))
}

const BENCHMARK_FALLBACK_ANSWER_TEXTS = [
  '抱歉，这次回答没有成功完成。请稍后重试，或把问题说得更具体一点。',
]

export function normalizeBenchmarkCaseTimeoutMs(value: any) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) {
    return undefined
  }
  return Math.max(5000, Math.round(normalized))
}

export function resolveBenchmarkCaseTimeoutMs(caseTimeoutMs: number | undefined, fallbackTimeoutMs: number) {
  return normalizeBenchmarkCaseTimeoutMs(caseTimeoutMs)
    ?? normalizeBenchmarkCaseTimeoutMs(fallbackTimeoutMs)
    ?? 60000
}

export function isBenchmarkAttemptSuccessful(options: {
  done?: boolean
  error?: string
  assistantText?: string
  finishReason?: string
}) {
  if (!options.done || options.error) {
    return false
  }

  if (String(options.finishReason || '').trim().toLowerCase() === 'fallback') {
    return false
  }

  const assistantText = String(options.assistantText || '').trim()
  if (!assistantText) {
    return false
  }

  return !BENCHMARK_FALLBACK_ANSWER_TEXTS.includes(assistantText)
}

export function resolveBenchmarkToolObservation(options: {
  traces?: Array<{
    kind?: string
    mode?: string
  }>
  finishReason?: string
  success?: boolean
  error?: string
}) {
  const traces = Array.isArray(options.traces) ? options.traces : []
  const hasSearch = traces.some(item => String(item?.kind || '').trim() === 'search_apps')
  const hasGetAppMemory = traces.some(item => String(item?.kind || '').trim() === 'get_app_memory')
  const readModes = traces
    .filter(item => String(item?.kind || '').trim() === 'read_app_data')
    .map(item => String(item?.mode || '').trim().toLowerCase())
    .filter(Boolean)

  const enteredRecordRead = readModes.some(item => item === 'records' || item === 'aggregate')
  const finishReason = String(options.finishReason || '').trim().toLowerCase()

  let toolPath = 'unknown'
  if (enteredRecordRead) {
    toolPath = 'record_read'
  } else if (hasGetAppMemory) {
    toolPath = 'search_get_memory_only'
  } else if (hasSearch) {
    toolPath = 'search_only'
  }

  let searchOnlyOutcome: string | null = null
  if (toolPath === 'search_only') {
    if (options.success) {
      searchOnlyOutcome = 'answered_after_search'
    } else if (finishReason === 'fallback') {
      searchOnlyOutcome = 'fallback_after_search'
    } else if (options.error) {
      searchOnlyOutcome = 'error_after_search'
    } else {
      searchOnlyOutcome = 'stopped_after_search'
    }
  }

  return {
    toolPath,
    searchOnlyOutcome,
  }
}

export function matchExpectedIdsByToolOrAnswer(options: {
  expectedIds?: string[]
  expectedNames?: string[]
  actualIds?: string[]
  assistantText?: string
}) {
  const expectedIds = normalizeStringArray(options.expectedIds)
  const expectedNames = normalizeStringArray(options.expectedNames)
  if (!expectedIds.length && !expectedNames.length) {
    return null
  }

  const actualIds = normalizeStringArray(options.actualIds)
  if (expectedIds.length && expectedIds.every(item => actualIds.includes(item))) {
    return true
  }

  const assistantText = String(options.assistantText || '')
  if (!assistantText) {
    return false
  }

  if (expectedIds.length && expectedIds.every(item => assistantText.includes(item))) {
    return true
  }

  return expectedNames.length
    ? expectedNames.every(item => assistantText.includes(item))
    : false
}

export function resolveBenchmarkFinalAssistantText(options: {
  assistantText?: string
  metadata?: any
}) {
  const metadata = options.metadata && typeof options.metadata === 'object' ? options.metadata : {}
  const finalContent = String(metadata.finalContent || '').trim()
  return finalContent || String(options.assistantText || '').trim()
}

export function resolveBenchmarkFailureReason(options: {
  done?: boolean
  error?: string
  finishReason?: string
  assistantText?: string
  diagnosticFallbackStage?: string
}) {
  const error = String(options.error || '').trim()
  if (error) {
    return error
  }

  const finishReason = String(options.finishReason || '').trim().toLowerCase()
  const fallbackStage = String(options.diagnosticFallbackStage || '').trim()
  if (finishReason === 'fallback') {
    return fallbackStage ? `fallback:${fallbackStage}` : 'fallback'
  }

  if (!options.done) {
    return 'stream_not_done'
  }

  const assistantText = String(options.assistantText || '').trim()
  if (!assistantText) {
    return 'empty_final_answer'
  }

  if (BENCHMARK_FALLBACK_ANSWER_TEXTS.includes(assistantText)) {
    return fallbackStage ? `fallback_text:${fallbackStage}` : 'fallback_text'
  }

  return ''
}

function normalizeFiniteNumber(value: any) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function percentile(values: number[], ratio: number) {
  if (!values.length) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

function average(values: number[]) {
  if (!values.length) {
    return null
  }
  return values.reduce((total, value) => total + value, 0) / values.length
}

function ratio(values: Array<boolean | null | undefined>) {
  const filtered = values.filter((value): value is boolean => value === true || value === false)
  if (!filtered.length) {
    return null
  }
  return filtered.filter(Boolean).length / filtered.length
}

function normalizeNumberArray(value: any) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeFiniteNumber)
    .filter((item): item is number => item !== null)
}

function normalizeBooleanArray(value: any) {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is boolean => item === true || item === false)
}

function normalizeUsageValue(value: any) {
  const normalized = normalizeFiniteNumber(value)
  return normalized === null ? null : Math.max(0, Math.round(normalized))
}

function normalizeTokenUsage(value: any) {
  return {
    inputTokens: normalizeUsageValue(value?.inputTokens ?? value?.input_tokens ?? value?.promptTokens ?? value?.prompt_tokens),
    outputTokens: normalizeUsageValue(value?.outputTokens ?? value?.output_tokens ?? value?.completionTokens ?? value?.completion_tokens),
    totalTokens: normalizeUsageValue(value?.totalTokens ?? value?.total_tokens),
  }
}

function normalizePromptDiagnostics(value: any) {
  return {
    totalChars: normalizeUsageValue(value?.totalChars),
    estimatedTokens: normalizeUsageValue(value?.estimatedTokens),
    systemPromptChars: normalizeUsageValue(value?.systemPromptChars),
    historyMessageChars: normalizeUsageValue(value?.historyMessageChars),
    historicalToolSummaryChars: normalizeUsageValue(value?.historicalToolSummaryChars),
    currentActionResultChars: normalizeUsageValue(value?.currentActionResultChars),
    historyPromptSnapshotChars: normalizeUsageValue(value?.historyPromptSnapshotChars),
  }
}

function compactStringArray(value: any) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function formatLastEffectiveToolResult(value: any) {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const round = normalizeUsageValue(value.round)
  const tool = String(value.tool || value.name || '').trim()
  const resultKind = String(value.resultKind || '').trim()
  const path = String(value.path || '').trim()
  const parts = [
    round === null ? '' : String(round),
    tool,
    resultKind,
    path,
  ].filter(Boolean)
  return parts.length ? parts.join(':') : undefined
}

export function resolveBenchmarkStreamDiagnostics(options: {
  assistantText?: string
  usage?: any
  metadata?: any
}) {
  const metadata = options.metadata && typeof options.metadata === 'object' ? options.metadata : {}
  const devDiagnostics = metadata.devDiagnostics && typeof metadata.devDiagnostics === 'object'
    ? metadata.devDiagnostics
    : {}
  const usage = normalizeTokenUsage(options.usage)
  const diagnosticUsage = normalizeTokenUsage(devDiagnostics.usage)
  const rounds = Array.isArray(devDiagnostics.rounds) ? devDiagnostics.rounds : []
  const finalContent = String(metadata.finalContent || '')
  const fallbackStage = String(devDiagnostics?.fallback?.stage || '').trim()
  const toolProgress = devDiagnostics?.toolProgress && typeof devDiagnostics.toolProgress === 'object'
    ? devDiagnostics.toolProgress
    : {}

  return {
    assistantTextChars: String(options.assistantText || '').length,
    finalContentChars: finalContent.length || String(options.assistantText || '').length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    diagnosticInputTokens: diagnosticUsage.inputTokens,
    diagnosticOutputTokens: diagnosticUsage.outputTokens,
    diagnosticTotalTokens: diagnosticUsage.totalTokens,
    diagnosticTotalDurationMs: normalizeUsageValue(devDiagnostics.totalDurationMs),
    diagnosticTotalRounds: normalizeUsageValue(devDiagnostics.totalRounds),
    diagnosticTotalToolCalls: normalizeUsageValue(devDiagnostics.totalToolCalls),
    diagnosticFallbackStage: fallbackStage || undefined,
    modelRoundDurations: normalizeNumberArray(rounds.map((item: any) => item?.durationMs)),
    modelRoundFirstTokenLatencies: normalizeNumberArray(rounds.map((item: any) => item?.firstTokenLatencyMs)),
    modelRoundFinishReasons: compactStringArray(rounds.map((item: any) => item?.finishReason)),
    modelRoundToolCallCounts: normalizeNumberArray(rounds.map((item: any) => item?.toolCallCount)),
    modelRoundFallbackHits: normalizeBooleanArray(rounds.map((item: any) => item?.fallbackHit)),
    modelRoundRequestedReasoningLevels: compactStringArray(rounds.map((item: any) => item?.requestedReasoningLevel)),
    modelRoundEffectiveReasoningLevels: compactStringArray(rounds.map((item: any) => item?.effectiveReasoningLevel)),
    modelRoundInputTokens: normalizeNumberArray(rounds.map((item: any) => normalizeTokenUsage(item?.usage).inputTokens)),
    modelRoundOutputTokens: normalizeNumberArray(rounds.map((item: any) => normalizeTokenUsage(item?.usage).outputTokens)),
    modelRoundPromptTotalChars: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).totalChars)),
    modelRoundPromptEstimatedTokens: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).estimatedTokens)),
    modelRoundPromptSystemChars: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).systemPromptChars)),
    modelRoundPromptHistoryMessageChars: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).historyMessageChars)),
    modelRoundPromptHistoricalToolSummaryChars: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).historicalToolSummaryChars)),
    modelRoundPromptActionResultChars: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).currentActionResultChars)),
    modelRoundHistoryPromptSnapshotChars: normalizeNumberArray(rounds.map((item: any) => normalizePromptDiagnostics(item?.promptDiagnostics).historyPromptSnapshotChars)),
    diagnosticFirstNoNewInformationRound: normalizeUsageValue(toolProgress.firstNoNewInformationRound),
    diagnosticLastEffectiveToolResult: formatLastEffectiveToolResult(toolProgress.lastEffectiveToolResult),
  }
}

export function resolveBenchmarkLatencyBreakdown(options: {
  firstTokenLatency?: number | null
  totalLatency?: number | null
  searchAppsLatency?: number | null
  getAppMemoryLatency?: number | null
  readAppDataLatency?: number | null
  warmupWaitMs?: number | null
}) {
  const observedToolLatency = [
    options.searchAppsLatency,
    options.getAppMemoryLatency,
    options.readAppDataLatency,
    options.warmupWaitMs,
  ].reduce((total, value) => total + Math.max(0, normalizeFiniteNumber(value) ?? 0), 0)

  const firstTokenLatency = normalizeFiniteNumber(options.firstTokenLatency)
  const totalLatency = normalizeFiniteNumber(options.totalLatency)

  return {
    observedToolLatency,
    preFirstTokenNonToolLatency: firstTokenLatency === null
      ? null
      : Math.max(0, firstTokenLatency - observedToolLatency),
    postFirstTokenLatency: firstTokenLatency === null || totalLatency === null
      ? null
      : Math.max(0, totalLatency - firstTokenLatency),
  }
}

export function buildBenchmarkSummary(records: Array<{
  success?: boolean
  firstTokenLatency?: number | null
  totalLatency?: number | null
  searchAppsLatency?: number | null
  getAppMemoryLatency?: number | null
  readAppDataLatency?: number | null
  warmupWaitMs?: number | null
  onsiteBuildMs?: number | null
  assistantTextChars?: number | null
  finalContentChars?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  diagnosticInputTokens?: number | null
  diagnosticOutputTokens?: number | null
  diagnosticTotalTokens?: number | null
  diagnosticTotalDurationMs?: number | null
  diagnosticTotalRounds?: number | null
  diagnosticTotalToolCalls?: number | null
  observedToolLatency?: number | null
  preFirstTokenNonToolLatency?: number | null
  postFirstTokenLatency?: number | null
  finalAppInTop1?: boolean | null
  finalAppInTop3?: boolean | null
  sourceFirstHit?: boolean | null
  repeatSearchCount?: number | null
  disambiguationCount?: number | null
  searchTraceCount?: number | null
  returnedAppIds?: string[]
  finalAppId?: string
  semanticScheduled?: boolean | null
  semanticWarmupHit?: boolean | null
  semanticSummaryAvailable?: boolean | null
  derivedSummaryAvailable?: boolean | null
}>) {
  const successful = records.filter(item => item.success === true)
  const numberValues = (selector: (item: any) => any) =>
    successful
      .map(selector)
      .map(normalizeFiniteNumber)
      .filter((value): value is number => value !== null)
  const finalAppSearchSamples = successful.filter(item =>
    Math.max(0, normalizeFiniteNumber(item.searchTraceCount) ?? 0) > 0
    && normalizeStringArray(item.returnedAppIds).length > 0
    && String(item.finalAppId || '').trim()
    && (item.finalAppInTop1 === true || item.finalAppInTop1 === false)
    && (item.finalAppInTop3 === true || item.finalAppInTop3 === false),
  )

  return {
    totalAttempts: records.length,
    successAttempts: successful.length,
    failedAttempts: records.length - successful.length,
    firstTokenLatency: {
      p50: percentile(numberValues(item => item.firstTokenLatency), 0.5),
      p90: percentile(numberValues(item => item.firstTokenLatency), 0.9),
    },
    totalLatency: {
      p50: percentile(numberValues(item => item.totalLatency), 0.5),
      p90: percentile(numberValues(item => item.totalLatency), 0.9),
    },
    searchAppsLatency: {
      p50: percentile(numberValues(item => item.searchAppsLatency), 0.5),
      p90: percentile(numberValues(item => item.searchAppsLatency), 0.9),
    },
    getAppMemoryLatency: {
      p50: percentile(numberValues(item => item.getAppMemoryLatency), 0.5),
      p90: percentile(numberValues(item => item.getAppMemoryLatency), 0.9),
    },
    readAppDataLatency: {
      p50: percentile(numberValues(item => item.readAppDataLatency), 0.5),
      p90: percentile(numberValues(item => item.readAppDataLatency), 0.9),
    },
    onsiteBuildMs: {
      p50: percentile(numberValues(item => item.onsiteBuildMs), 0.5),
      p90: percentile(numberValues(item => item.onsiteBuildMs), 0.9),
    },
    assistantTextChars: {
      p50: percentile(numberValues(item => item.assistantTextChars), 0.5),
      p90: percentile(numberValues(item => item.assistantTextChars), 0.9),
    },
    finalContentChars: {
      p50: percentile(numberValues(item => item.finalContentChars), 0.5),
      p90: percentile(numberValues(item => item.finalContentChars), 0.9),
    },
    inputTokens: {
      p50: percentile(numberValues(item => item.inputTokens), 0.5),
      p90: percentile(numberValues(item => item.inputTokens), 0.9),
    },
    outputTokens: {
      p50: percentile(numberValues(item => item.outputTokens), 0.5),
      p90: percentile(numberValues(item => item.outputTokens), 0.9),
    },
    totalTokens: {
      p50: percentile(numberValues(item => item.totalTokens), 0.5),
      p90: percentile(numberValues(item => item.totalTokens), 0.9),
    },
    diagnosticInputTokens: {
      p50: percentile(numberValues(item => item.diagnosticInputTokens), 0.5),
      p90: percentile(numberValues(item => item.diagnosticInputTokens), 0.9),
    },
    diagnosticOutputTokens: {
      p50: percentile(numberValues(item => item.diagnosticOutputTokens), 0.5),
      p90: percentile(numberValues(item => item.diagnosticOutputTokens), 0.9),
    },
    diagnosticTotalTokens: {
      p50: percentile(numberValues(item => item.diagnosticTotalTokens), 0.5),
      p90: percentile(numberValues(item => item.diagnosticTotalTokens), 0.9),
    },
    diagnosticTotalDurationMs: {
      p50: percentile(numberValues(item => item.diagnosticTotalDurationMs), 0.5),
      p90: percentile(numberValues(item => item.diagnosticTotalDurationMs), 0.9),
    },
    diagnosticTotalRounds: {
      p50: percentile(numberValues(item => item.diagnosticTotalRounds), 0.5),
      p90: percentile(numberValues(item => item.diagnosticTotalRounds), 0.9),
    },
    diagnosticTotalToolCalls: {
      p50: percentile(numberValues(item => item.diagnosticTotalToolCalls), 0.5),
      p90: percentile(numberValues(item => item.diagnosticTotalToolCalls), 0.9),
    },
    observedToolLatency: {
      p50: percentile(numberValues(item => item.observedToolLatency), 0.5),
      p90: percentile(numberValues(item => item.observedToolLatency), 0.9),
    },
    preFirstTokenNonToolLatency: {
      p50: percentile(numberValues(item => item.preFirstTokenNonToolLatency), 0.5),
      p90: percentile(numberValues(item => item.preFirstTokenNonToolLatency), 0.9),
    },
    postFirstTokenLatency: {
      p50: percentile(numberValues(item => item.postFirstTokenLatency), 0.5),
      p90: percentile(numberValues(item => item.postFirstTokenLatency), 0.9),
    },
    finalAppInTop1Ratio: ratio(finalAppSearchSamples.map(item => item.finalAppInTop1)),
    finalAppInTop3Ratio: ratio(finalAppSearchSamples.map(item => item.finalAppInTop3)),
    finalAppSearchMetrics: {
      sampleSize: finalAppSearchSamples.length,
      top1Ratio: ratio(finalAppSearchSamples.map(item => item.finalAppInTop1)),
      top3Ratio: ratio(finalAppSearchSamples.map(item => item.finalAppInTop3)),
    },
    semanticScheduledRatio: ratio(successful.map(item => item.semanticScheduled)),
    semanticWarmupHitRatio: ratio(successful.map(item => item.semanticWarmupHit)),
    semanticSummaryAvailableRatio: ratio(successful.map(item => item.semanticSummaryAvailable)),
    derivedSummaryAvailableRatio: ratio(successful.map(item => item.derivedSummaryAvailable)),
    sourceFirstHitRatio: ratio(successful.map(item => item.sourceFirstHit)),
    repeatSearchCountAverage: average(numberValues(item => item.repeatSearchCount)),
    disambiguationCountAverage: average(numberValues(item => item.disambiguationCount)),
  }
}
