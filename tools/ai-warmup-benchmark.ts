import path from 'node:path'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import {
  isBenchmarkAttemptSuccessful,
  resolveBenchmarkToolObservation,
  matchExpectedIdsByToolOrAnswer,
  normalizeBenchmarkCaseTimeoutMs,
  resolveBenchmarkCaseTimeoutMs,
  resolveBenchmarkLatencyBreakdown,
  buildBenchmarkSummary,
  resolveBenchmarkStreamDiagnostics,
  resolveBenchmarkFinalAssistantText,
  resolveBenchmarkFailureReason,
} from './ai-warmup-benchmark-shared'

type BenchmarkMode = 'baseline' | 'top-candidate-prime' | 'hotness-prime' | 'session-cache'
type BenchmarkTemperature = 'cold' | 'hot'

type BenchmarkCase = {
  caseId: string
  category: string
  question: string
  setupTurns?: string[]
  timeoutMs?: number
  nocodeIds?: string[]
  expected?: {
    appId?: string
    sourceIds?: string[]
    sourceNames?: string[]
  }
}

type CliOptions = {
  baseUrl: string
  casesPath: string
  mode: BenchmarkMode
  temperature: BenchmarkTemperature
  providerId?: string
  modelId?: string
  model?: string
  keepMutatedMemory: boolean
  allowIsolatedDataDir: boolean
  dryRun: boolean
}

type BenchmarkFeatureFlags = {
  searchAppsTopCandidateStructurePrimeEnabled: boolean
  searchAppsTopCandidateStructurePrimeLimit: number
  searchAppsTopCandidateStructurePrimeJoinTimeoutMs: number
}

type AiSettings = {
  enabled: boolean
  allowModelSelection: boolean
  defaultProviderId?: string | null
  defaultModelId?: string | null
  featureFlags?: Record<string, any>
  migrations?: Record<string, any> | null
  providers: Array<Record<string, any>>
}

type WarmupTrace = {
  id: string
  kind: 'search_apps' | 'prime_search_app_memories' | 'get_app_memory' | 'read_app_data'
  traceId?: string
  appId?: string
  updatedAt: number
  durationMs?: number
  keywords?: string[]
  returnedAppIds?: string[]
  topCandidateAppId?: string
  convergence?: string
  requiresDisambiguation?: boolean
  targetLevel?: 'catalog' | 'structure'
  appIds?: string[]
  joinTimeoutMs?: number
  scheduledCount?: number
  settledCount?: number
  timeoutCount?: number
  failedCount?: number
  requestedLevel?: 'catalog' | 'structure'
  beforeCatalogLevel?: string
  beforeStructureLevel?: string
  afterCatalogLevel?: string
  afterStructureLevel?: string
  onsiteBuildMs?: number
  mode?: string
  targetIds?: string[]
  sourceIds?: string[]
  resultKind?: string
  partial?: boolean
  failedTargetCount?: number
  semanticScheduled?: boolean
  semanticScheduleReason?: string
  semanticWarmupHit?: boolean
  semanticSummaryAvailable?: boolean
  derivedSummaryAvailable?: boolean
}

type AttemptRecord = {
  caseId: string
  category: string
  question: string
  attempt: number
  mode: BenchmarkMode
  temperature: BenchmarkTemperature
  traceId: string
  timeoutMs: number
  threadId?: string
  success: boolean
  error?: string
  benchmarkFailureReason?: string
  featureFlags: BenchmarkFeatureFlags
  firstTokenLatency: number | null
  totalLatency: number | null
  searchAppsLatency: number
  getAppMemoryLatency: number
  readAppDataLatency: number
  warmupWaitMs: number
  onsiteBuildMs: number
  assistantTextChars: number
  finalContentChars: number
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  diagnosticInputTokens: number | null
  diagnosticOutputTokens: number | null
  diagnosticTotalTokens: number | null
  diagnosticTotalDurationMs: number | null
  diagnosticTotalRounds: number | null
  diagnosticTotalToolCalls: number | null
  diagnosticFallbackStage?: string
  diagnosticFirstNoNewInformationRound?: number | null
  diagnosticLastEffectiveToolResult?: string
  modelRoundDurations: number[]
  modelRoundFirstTokenLatencies: number[]
  modelRoundFinishReasons: string[]
  modelRoundToolCallCounts: number[]
  modelRoundFallbackHits: boolean[]
  modelRoundRequestedReasoningLevels: string[]
  modelRoundEffectiveReasoningLevels: string[]
  modelRoundInputTokens: number[]
  modelRoundOutputTokens: number[]
  modelRoundPromptTotalChars: number[]
  modelRoundPromptEstimatedTokens: number[]
  modelRoundPromptSystemChars: number[]
  modelRoundPromptHistoryMessageChars: number[]
  modelRoundPromptHistoricalToolSummaryChars: number[]
  modelRoundPromptActionResultChars: number[]
  modelRoundHistoryPromptSnapshotChars: number[]
  observedToolLatency: number
  preFirstTokenNonToolLatency: number | null
  postFirstTokenLatency: number | null
  warmupHitLevel: 'structure' | 'catalog' | 'cold' | 'unknown'
  finalAppId?: string
  finalSourceIds: string[]
  finalAppInTop1: boolean | null
  finalAppInTop3: boolean | null
  sourceFirstHit: boolean | null
  repeatSearchCount: number
  disambiguationCount: number
  searchTraceCount: number
  primeTraceCount: number
  getTraceCount: number
  readTraceCount: number
  topCandidateAppId?: string
  returnedAppIds: string[]
  resultKind?: string
  partial: boolean
  failedTargetCount: number
  assistantFinishReason?: string
  finalConversationProfile?: string
  toolPath: string
  searchOnlyOutcome: string | null
  expectedAppMatched: boolean | null
  expectedSourceMatched: boolean | null
  semanticScheduled: boolean
  semanticScheduleReason?: string
  semanticWarmupHit: boolean
  semanticSummaryAvailable: boolean
  derivedSummaryAvailable: boolean
  semanticSummaryUnavailableReason?: string
}

type BackupState = {
  appId: string
  appAiDir: string
  backupDir: string
  existed: boolean
}

type StreamRunResult = {
  threadId?: string
  firstTokenLatencyMs: number | null
  totalLatencyMs: number | null
  assistantText: string
  finalAssistantText: string
  done: boolean
  finishReason?: string
  conversationProfile?: string
  assistantTextChars: number
  finalContentChars: number
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  diagnosticInputTokens: number | null
  diagnosticOutputTokens: number | null
  diagnosticTotalTokens: number | null
  diagnosticTotalDurationMs: number | null
  diagnosticTotalRounds: number | null
  diagnosticTotalToolCalls: number | null
  diagnosticFallbackStage?: string
  diagnosticFirstNoNewInformationRound?: number | null
  diagnosticLastEffectiveToolResult?: string
  modelRoundDurations: number[]
  modelRoundFirstTokenLatencies: number[]
  modelRoundFinishReasons: string[]
  modelRoundToolCallCounts: number[]
  modelRoundFallbackHits: boolean[]
  modelRoundRequestedReasoningLevels: string[]
  modelRoundEffectiveReasoningLevels: string[]
  modelRoundInputTokens: number[]
  modelRoundOutputTokens: number[]
  modelRoundPromptTotalChars: number[]
  modelRoundPromptEstimatedTokens: number[]
  modelRoundPromptSystemChars: number[]
  modelRoundPromptHistoryMessageChars: number[]
  modelRoundPromptHistoricalToolSummaryChars: number[]
  modelRoundPromptActionResultChars: number[]
  modelRoundHistoryPromptSnapshotChars: number[]
  error?: string
}

type ModeDescriptor = {
  implemented: boolean
  reason?: string
  flags: BenchmarkFeatureFlags
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:16667'
const DEFAULT_CASES_PATH = path.resolve('.tmp', 'ai-warmup-benchmark-cases.json')
const OUTPUT_JSON_PATH = path.resolve('.tmp', 'ai-warmup-benchmark-result.json')
const OUTPUT_CSV_PATH = path.resolve('.tmp', 'ai-warmup-benchmark-result.csv')
const STREAM_TIMEOUT_MS = Number.isFinite(Number(process.env.AI_WARMUP_BENCHMARK_TIMEOUT_MS))
  ? Math.max(5000, Math.round(Number(process.env.AI_WARMUP_BENCHMARK_TIMEOUT_MS)))
  : 60000

const MODE_DESCRIPTORS: Record<BenchmarkMode, ModeDescriptor> = {
  baseline: {
    implemented: true,
    flags: {
      searchAppsTopCandidateStructurePrimeEnabled: false,
      searchAppsTopCandidateStructurePrimeLimit: 3,
      searchAppsTopCandidateStructurePrimeJoinTimeoutMs: 0,
    },
  },
  'top-candidate-prime': {
    implemented: true,
    flags: {
      searchAppsTopCandidateStructurePrimeEnabled: true,
      searchAppsTopCandidateStructurePrimeLimit: 3,
      searchAppsTopCandidateStructurePrimeJoinTimeoutMs: 0,
    },
  },
  'hotness-prime': {
    implemented: false,
    reason: '当前仓库还未实现 Task 5 所需的热度持久化与后台预热开关。',
    flags: {
      searchAppsTopCandidateStructurePrimeEnabled: true,
      searchAppsTopCandidateStructurePrimeLimit: 3,
      searchAppsTopCandidateStructurePrimeJoinTimeoutMs: 0,
    },
  },
  'session-cache': {
    implemented: false,
    reason: '当前仓库还未实现 Task 6 所需的会话级缓存复用开关。',
    flags: {
      searchAppsTopCandidateStructurePrimeEnabled: true,
      searchAppsTopCandidateStructurePrimeLimit: 3,
      searchAppsTopCandidateStructurePrimeJoinTimeoutMs: 0,
    },
  },
}

class CookieJar {
  private readonly cookies = new Map<string, string>()

  capture(headers: Headers) {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
    const rawCookies = typeof getSetCookie === 'function' ? getSetCookie.call(headers) : []
    for (const rawCookie of rawCookies) {
      const cookiePair = String(rawCookie || '').split(';')[0] || ''
      const separatorIndex = cookiePair.indexOf('=')
      if (separatorIndex <= 0) {
        continue
      }

      const name = cookiePair.slice(0, separatorIndex).trim()
      const value = cookiePair.slice(separatorIndex + 1).trim()
      if (!name) {
        continue
      }
      this.cookies.set(name, value)
    }
  }

  apply(headers: Headers) {
    if (!this.cookies.size) {
      return
    }
    headers.set(
      'cookie',
      Array.from(this.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    )
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/g, '') || DEFAULT_BASE_URL
}

function normalizeStringArray(value: any) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => String(item || '').trim())
      .filter(Boolean),
  ))
}

function normalizeOrderedStringArray(value: any) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: normalizeBaseUrl(process.env.WORKBENCH_BASE_URL || DEFAULT_BASE_URL),
    casesPath: DEFAULT_CASES_PATH,
    mode: 'baseline',
    temperature: 'hot',
    providerId: String(process.env.WORKBENCH_AI_PROVIDER_ID || '').trim() || undefined,
    modelId: String(process.env.WORKBENCH_AI_MODEL_ID || '').trim() || undefined,
    model: String(process.env.WORKBENCH_AI_MODEL || '').trim() || undefined,
    keepMutatedMemory: false,
    allowIsolatedDataDir: false,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim()
    const next = String(argv[index + 1] || '').trim()
    if (arg === '--cases') {
      assert(next, '--cases 需要传入路径')
      options.casesPath = path.resolve(next)
      index += 1
      continue
    }
    if (arg === '--mode') {
      assert(next, '--mode 需要传入模式')
      options.mode = next as BenchmarkMode
      index += 1
      continue
    }
    if (arg === '--temperature') {
      assert(next, '--temperature 需要传入 cold 或 hot')
      options.temperature = next as BenchmarkTemperature
      index += 1
      continue
    }
    if (arg === '--base-url') {
      assert(next, '--base-url 需要传入地址')
      options.baseUrl = normalizeBaseUrl(next)
      index += 1
      continue
    }
    if (arg === '--provider-id') {
      assert(next, '--provider-id 需要传入值')
      options.providerId = next
      index += 1
      continue
    }
    if (arg === '--model-id') {
      assert(next, '--model-id 需要传入值')
      options.modelId = next
      index += 1
      continue
    }
    if (arg === '--model') {
      assert(next, '--model 需要传入值')
      options.model = next
      index += 1
      continue
    }
    if (arg === '--keep-mutated-memory') {
      options.keepMutatedMemory = true
      continue
    }
    if (arg === '--allow-isolated-data-dir') {
      options.allowIsolatedDataDir = true
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    throw new Error(`未知参数: ${arg}`)
  }

  assert(MODE_DESCRIPTORS[options.mode], `不支持的 mode: ${options.mode}`)
  assert(options.temperature === 'cold' || options.temperature === 'hot', `不支持的 temperature: ${options.temperature}`)
  return options
}

async function readJsonFile<T>(filePath: string) {
  const text = await readFile(filePath, 'utf8')
  return JSON.parse(text) as T
}

async function writeJsonFile(filePath: string, value: any) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function requestJson<T>(
  jar: CookieJar,
  baseUrl: string,
  requestPath: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers)
  headers.set('accept', 'application/json')
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  jar.apply(headers)

  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...init,
    headers,
  })

  jar.capture(response.headers)
  const responseText = await response.text()
  const data = responseText ? JSON.parse(responseText) as T : null
  if (!response.ok) {
    throw new Error(`请求 ${requestPath} 失败(${response.status}): ${responseText || response.statusText}`)
  }
  return data
}

async function loginAsAdmin(jar: CookieJar, baseUrl: string) {
  const username = String(process.env.WORKBENCH_ADMIN_USERNAME || 'admin').trim()
  const password = String(process.env.WORKBENCH_ADMIN_PASSWORD || '123456')
  const loginPlatform = String(process.env.WORKBENCH_LOGIN_PLATFORM || 'pc').trim() || 'pc'
  const login = await requestJson<{ account?: { isAdmin?: boolean; user?: string } }>(jar, baseUrl, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      loginPlatform,
    }),
  })

  assert(login?.account, '登录成功，但响应中缺少 account。')
  assert(
    login.account?.isAdmin || String(login.account?.user || '').trim() === 'admin',
    '当前登录账号不是管理员，无法执行 warmup benchmark。',
  )
  return login.account
}

async function streamThread(
  jar: CookieJar,
  baseUrl: string,
  body: Record<string, any>,
  timeoutMs?: number,
): Promise<StreamRunResult> {
  const effectiveTimeoutMs = resolveBenchmarkCaseTimeoutMs(timeoutMs, STREAM_TIMEOUT_MS)
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => {
    controller.abort(new Error(`AI stream exceeded timeout ${effectiveTimeoutMs}ms`))
  }, effectiveTimeoutMs)
  const headers = new Headers()
  headers.set('accept', 'text/event-stream')
  headers.set('content-type', 'application/json')
  jar.apply(headers)

  const startedAt = Date.now()
  try {
    const response = await fetch(`${baseUrl}/ai/threads/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    jar.capture(response.headers)

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '')
      throw new Error(`请求 /ai/threads/stream 失败(${response.status}): ${text || response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf8')
    let buffer = ''
    let threadId = String(body.threadId || '').trim() || undefined
    let firstTokenLatencyMs: number | null = null
    let totalLatencyMs: number | null = null
    let assistantText = ''
    let done = false
    let finishReason = ''
    let conversationProfile = ''
    let doneUsage: any
    let doneMetadata: any
    let errorMessage = ''

    const handleEventBlock = (block: string) => {
      const normalizedBlock = block.replace(/\r/g, '').trim()
      if (!normalizedBlock) {
        return
      }
      const lines = normalizedBlock.split('\n')
      const dataLines = lines
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
      if (!dataLines.length) {
        return
      }
      const payload = JSON.parse(dataLines.join('\n')) as {
        event?: string
        text?: string
        error?: string
        threadId?: string
        finishReason?: string
        usage?: any
        metadata?: Record<string, any>
      }
      threadId = String(payload.threadId || threadId || '').trim() || threadId
      const deltaText = String(payload.text || '')
      if (payload.event === 'delta' && deltaText.length > 0) {
        if (firstTokenLatencyMs === null) {
          firstTokenLatencyMs = Date.now() - startedAt
        }
        assistantText += deltaText
      }
      if (payload.event === 'done') {
        totalLatencyMs = Date.now() - startedAt
        if (firstTokenLatencyMs === null) {
          firstTokenLatencyMs = totalLatencyMs
        }
        finishReason = String(payload.finishReason || '').trim()
        conversationProfile = String(payload.metadata?.conversationProfile || '').trim()
        doneUsage = payload.usage
        doneMetadata = payload.metadata
        done = true
      }
      if (payload.event === 'error') {
        totalLatencyMs = Date.now() - startedAt
        errorMessage = String(payload.error || '').trim() || 'AI stream returned an unknown error'
      }
    }

    while (true) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex >= 0) {
        const block = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        handleEventBlock(block)
        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) {
      handleEventBlock(buffer)
    }

    const streamDiagnostics = resolveBenchmarkStreamDiagnostics({
      assistantText,
      usage: doneUsage,
      metadata: doneMetadata,
    })
    const finalAssistantText = resolveBenchmarkFinalAssistantText({
      assistantText,
      metadata: doneMetadata,
    })

    return {
      threadId,
      firstTokenLatencyMs,
      totalLatencyMs,
      assistantText,
      finalAssistantText,
      done,
      finishReason: finishReason || undefined,
      conversationProfile: conversationProfile || undefined,
      ...streamDiagnostics,
      error: errorMessage || undefined,
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function runCaseSetupTurns(options: {
  jar: CookieJar
  baseUrl: string
  caseItem: BenchmarkCase
  traceId: string
  providerId?: string
  modelId?: string
  model?: string
}) {
  const setupTurns = normalizeOrderedStringArray(options.caseItem.setupTurns)
  if (!setupTurns.length) {
    return undefined
  }

  const caseTimeoutMs = resolveBenchmarkCaseTimeoutMs(options.caseItem.timeoutMs, STREAM_TIMEOUT_MS)
  let threadId: string | undefined
  for (let index = 0; index < setupTurns.length; index += 1) {
    const setupQuestion = setupTurns[index]
    const setupTraceId = `${options.traceId}:setup-${index + 1}`
    const setupResult = await streamThread(options.jar, options.baseUrl, {
      message: setupQuestion,
      traceId: setupTraceId,
      threadId,
      nocodeIds: normalizeStringArray(options.caseItem.nocodeIds),
      providerId: options.providerId,
      modelId: options.modelId,
      model: options.model,
    }, caseTimeoutMs)
    if (!setupResult.done || setupResult.error) {
      throw new Error(
        `case ${options.caseItem.caseId} setup turn ${index + 1} failed: ${setupResult.error || 'stream not completed'}`,
      )
    }
    threadId = String(setupResult.threadId || threadId || '').trim() || threadId
  }

  assert(threadId, `case ${options.caseItem.caseId} 的 setupTurns 未返回 threadId，无法执行连续追问 benchmark。`)
  return threadId
}

async function pollWarmupTraces(jar: CookieJar, baseUrl: string, traceId: string) {
  const deadlineAt = Date.now() + 4000
  let lastValue: WarmupTrace[] = []
  while (Date.now() <= deadlineAt) {
    const response = await requestJson<{ live?: WarmupTrace[] }>(
      jar,
      baseUrl,
      `/ai/debug/warmup/traces?traceId=${encodeURIComponent(traceId)}&limit=100`,
    )
    lastValue = Array.isArray(response?.live) ? response.live : []
    if (lastValue.length > 0) {
      return lastValue
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  return lastValue
}

function sumTraceDuration(traces: WarmupTrace[]) {
  return traces.reduce((total, trace) => total + Math.max(0, Number(trace.durationMs || 0)), 0)
}

function lastItem<T>(items: T[]) {
  return items.length ? items[items.length - 1] : undefined
}

function resolveWarmupHitLevel(getTraces: WarmupTrace[]): AttemptRecord['warmupHitLevel'] {
  const firstTrace = getTraces[0]
  if (!firstTrace) {
    return 'unknown'
  }
  if (String(firstTrace.beforeStructureLevel || '').trim() === 'ready') {
    return 'structure'
  }
  if (String(firstTrace.beforeCatalogLevel || '').trim() === 'ready') {
    return 'catalog'
  }
  return 'cold'
}

export function pickSemanticTrace(traces: WarmupTrace[]) {
  return [...traces]
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .reverse()
    .find(item =>
      item.semanticScheduled === true
      || item.semanticWarmupHit === true
      || item.semanticSummaryAvailable === true
      || item.derivedSummaryAvailable === true
      || Boolean(String(item.semanticScheduleReason || '').trim()),
    ) || lastItem(traces)
}

function resolveSemanticSummaryUnavailableReason(options: {
  semanticWarmupHit: boolean
  semanticSummaryAvailable: boolean
  semanticScheduleReason?: string
}) {
  if (options.semanticSummaryAvailable) {
    return undefined
  }
  if (!options.semanticWarmupHit) {
    const reason = String(options.semanticScheduleReason || '').trim()
    return reason
      ? `pending_or_backoff:${reason}`
      : 'pending_or_backoff:unknown'
  }
  return 'permission_safe_clear_or_missing_source_facts'
}

function matchAll(expectedIds: string[], actualIds: string[]) {
  if (!expectedIds.length) {
    return null
  }
  return expectedIds.every(item => actualIds.includes(item))
}

export function buildAttemptRecord(options: {
  caseItem: BenchmarkCase
  attempt: number
  mode: BenchmarkMode
  temperature: BenchmarkTemperature
  traceId: string
  timeoutMs: number
  threadId?: string
  streamResult: StreamRunResult
  traces: WarmupTrace[]
  featureFlags: BenchmarkFeatureFlags
}): AttemptRecord {
  const sortedTraces = [...options.traces].sort((left, right) => left.updatedAt - right.updatedAt)
  const searchTraces = sortedTraces.filter(item => item.kind === 'search_apps')
  const primeTraces = sortedTraces.filter(item => item.kind === 'prime_search_app_memories')
  const getTraces = sortedTraces.filter(item => item.kind === 'get_app_memory')
  const readTraces = sortedTraces.filter(item => item.kind === 'read_app_data')

  const lastReadTrace = lastItem(readTraces)
  const lastGetTrace = lastItem(getTraces)
  const finalAppId = String(lastReadTrace?.appId || lastGetTrace?.appId || '').trim() || undefined
  const matchingSearchTrace = [...searchTraces]
    .reverse()
    .find(item => finalAppId && Array.isArray(item.returnedAppIds) && item.returnedAppIds.includes(finalAppId))
    || lastItem(searchTraces)

  const firstReadSourceIds = normalizeStringArray(readTraces.find(item => normalizeStringArray(item.sourceIds).length)?.sourceIds)
  const finalReadSourceIds = normalizeStringArray(lastReadTrace?.sourceIds)
  const returnedAppIds = normalizeStringArray(matchingSearchTrace?.returnedAppIds)
  const expectedAppId = String(options.caseItem.expected?.appId || '').trim()
  const expectedSourceIds = normalizeStringArray(options.caseItem.expected?.sourceIds)
  const expectedSourceNames = normalizeStringArray(options.caseItem.expected?.sourceNames)
  const semanticTrace = pickSemanticTrace([...searchTraces, ...getTraces])
  const semanticScheduled = semanticTrace?.semanticScheduled === true
  const semanticScheduleReason = String(semanticTrace?.semanticScheduleReason || '').trim() || undefined
  const semanticWarmupHit = semanticTrace?.semanticWarmupHit === true
  const semanticSummaryAvailable = semanticTrace?.semanticSummaryAvailable === true
  const derivedSummaryAvailable = semanticTrace?.derivedSummaryAvailable === true
  const success = isBenchmarkAttemptSuccessful({
    done: options.streamResult.done,
    error: options.streamResult.error,
    assistantText: options.streamResult.finalAssistantText,
    finishReason: options.streamResult.finishReason,
  })
  const benchmarkFailureReason = success
    ? undefined
    : resolveBenchmarkFailureReason({
      done: options.streamResult.done,
      error: options.streamResult.error,
      finishReason: options.streamResult.finishReason,
      assistantText: options.streamResult.finalAssistantText,
      diagnosticFallbackStage: options.streamResult.diagnosticFallbackStage,
    })
  const toolObservation = resolveBenchmarkToolObservation({
    traces: sortedTraces,
    finishReason: options.streamResult.finishReason,
    success,
    error: options.streamResult.error,
  })
  const finalizedAssistantText = options.streamResult.done && !options.streamResult.error
    ? options.streamResult.finalAssistantText
    : ''

  const searchAppsLatency = sumTraceDuration(searchTraces)
  const getAppMemoryLatency = sumTraceDuration(getTraces)
  const readAppDataLatency = sumTraceDuration(readTraces)
  const warmupWaitMs = sumTraceDuration(primeTraces)
  const latencyBreakdown = resolveBenchmarkLatencyBreakdown({
    firstTokenLatency: options.streamResult.firstTokenLatencyMs,
    totalLatency: options.streamResult.totalLatencyMs,
    searchAppsLatency,
    getAppMemoryLatency,
    readAppDataLatency,
    warmupWaitMs,
  })

  return {
    caseId: options.caseItem.caseId,
    category: options.caseItem.category,
    question: options.caseItem.question,
    attempt: options.attempt,
    mode: options.mode,
    temperature: options.temperature,
    traceId: options.traceId,
    timeoutMs: options.timeoutMs,
    threadId: options.threadId,
    success,
    error: options.streamResult.error,
    benchmarkFailureReason,
    featureFlags: options.featureFlags,
    firstTokenLatency: options.streamResult.firstTokenLatencyMs,
    totalLatency: options.streamResult.totalLatencyMs,
    searchAppsLatency,
    getAppMemoryLatency,
    readAppDataLatency,
    warmupWaitMs,
    onsiteBuildMs: getTraces.reduce((total, trace) => total + Math.max(0, Number(trace.onsiteBuildMs || 0)), 0),
    assistantTextChars: options.streamResult.assistantTextChars,
    finalContentChars: options.streamResult.finalContentChars,
    inputTokens: options.streamResult.inputTokens,
    outputTokens: options.streamResult.outputTokens,
    totalTokens: options.streamResult.totalTokens,
    diagnosticInputTokens: options.streamResult.diagnosticInputTokens,
    diagnosticOutputTokens: options.streamResult.diagnosticOutputTokens,
    diagnosticTotalTokens: options.streamResult.diagnosticTotalTokens,
    diagnosticTotalDurationMs: options.streamResult.diagnosticTotalDurationMs,
    diagnosticTotalRounds: options.streamResult.diagnosticTotalRounds,
    diagnosticTotalToolCalls: options.streamResult.diagnosticTotalToolCalls,
    diagnosticFallbackStage: options.streamResult.diagnosticFallbackStage,
    diagnosticFirstNoNewInformationRound: options.streamResult.diagnosticFirstNoNewInformationRound,
    diagnosticLastEffectiveToolResult: options.streamResult.diagnosticLastEffectiveToolResult,
    modelRoundDurations: options.streamResult.modelRoundDurations,
    modelRoundFirstTokenLatencies: options.streamResult.modelRoundFirstTokenLatencies,
    modelRoundFinishReasons: options.streamResult.modelRoundFinishReasons,
    modelRoundToolCallCounts: options.streamResult.modelRoundToolCallCounts,
    modelRoundFallbackHits: options.streamResult.modelRoundFallbackHits,
    modelRoundRequestedReasoningLevels: options.streamResult.modelRoundRequestedReasoningLevels,
    modelRoundEffectiveReasoningLevels: options.streamResult.modelRoundEffectiveReasoningLevels,
    modelRoundInputTokens: options.streamResult.modelRoundInputTokens,
    modelRoundOutputTokens: options.streamResult.modelRoundOutputTokens,
    modelRoundPromptTotalChars: options.streamResult.modelRoundPromptTotalChars,
    modelRoundPromptEstimatedTokens: options.streamResult.modelRoundPromptEstimatedTokens,
    modelRoundPromptSystemChars: options.streamResult.modelRoundPromptSystemChars,
    modelRoundPromptHistoryMessageChars: options.streamResult.modelRoundPromptHistoryMessageChars,
    modelRoundPromptHistoricalToolSummaryChars: options.streamResult.modelRoundPromptHistoricalToolSummaryChars,
    modelRoundPromptActionResultChars: options.streamResult.modelRoundPromptActionResultChars,
    modelRoundHistoryPromptSnapshotChars: options.streamResult.modelRoundHistoryPromptSnapshotChars,
    observedToolLatency: latencyBreakdown.observedToolLatency,
    preFirstTokenNonToolLatency: latencyBreakdown.preFirstTokenNonToolLatency,
    postFirstTokenLatency: latencyBreakdown.postFirstTokenLatency,
    warmupHitLevel: resolveWarmupHitLevel(getTraces),
    finalAppId,
    finalSourceIds: finalReadSourceIds,
    finalAppInTop1: finalAppId ? returnedAppIds[0] === finalAppId : null,
    finalAppInTop3: finalAppId ? returnedAppIds.slice(0, 3).includes(finalAppId) : null,
    sourceFirstHit: firstReadSourceIds.length && finalReadSourceIds.length ? firstReadSourceIds[0] === finalReadSourceIds[0] : null,
    repeatSearchCount: Math.max(0, searchTraces.length - 1),
    disambiguationCount: searchTraces.filter(item => item.requiresDisambiguation === true).length,
    searchTraceCount: searchTraces.length,
    primeTraceCount: primeTraces.length,
    getTraceCount: getTraces.length,
    readTraceCount: readTraces.length,
    topCandidateAppId: String(matchingSearchTrace?.topCandidateAppId || '').trim() || undefined,
    returnedAppIds,
    resultKind: String(lastReadTrace?.resultKind || '').trim() || undefined,
    partial: lastReadTrace?.partial === true,
    failedTargetCount: Math.max(0, Number(lastReadTrace?.failedTargetCount || 0)),
    assistantFinishReason: options.streamResult.finishReason,
    finalConversationProfile: options.streamResult.conversationProfile,
    toolPath: toolObservation.toolPath,
    searchOnlyOutcome: toolObservation.searchOnlyOutcome,
    expectedAppMatched: expectedAppId ? finalAppId === expectedAppId : null,
    expectedSourceMatched: matchExpectedIdsByToolOrAnswer({
      expectedIds: expectedSourceIds,
      expectedNames: expectedSourceNames,
      actualIds: finalReadSourceIds,
      assistantText: finalizedAssistantText,
    }),
    semanticScheduled,
    semanticScheduleReason,
    semanticWarmupHit,
    semanticSummaryAvailable,
    derivedSummaryAvailable,
    semanticSummaryUnavailableReason: resolveSemanticSummaryUnavailableReason({
      semanticWarmupHit,
      semanticSummaryAvailable,
      semanticScheduleReason,
    }),
  }
}

function buildSummary(records: AttemptRecord[]) {
  return buildBenchmarkSummary(records)
}

export function toCsv(records: AttemptRecord[]) {
  const headers = [
    'caseId',
    'category',
    'attempt',
    'question',
    'mode',
    'temperature',
    'traceId',
    'timeoutMs',
    'threadId',
    'success',
    'error',
    'benchmarkFailureReason',
    'featureFlags',
    'firstTokenLatency',
    'totalLatency',
    'searchAppsLatency',
    'getAppMemoryLatency',
    'readAppDataLatency',
    'warmupWaitMs',
    'onsiteBuildMs',
    'assistantTextChars',
    'finalContentChars',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'diagnosticInputTokens',
    'diagnosticOutputTokens',
    'diagnosticTotalTokens',
    'diagnosticTotalDurationMs',
    'diagnosticTotalRounds',
    'diagnosticTotalToolCalls',
    'diagnosticFallbackStage',
    'diagnosticFirstNoNewInformationRound',
    'diagnosticLastEffectiveToolResult',
    'modelRoundDurations',
    'modelRoundFirstTokenLatencies',
    'modelRoundFinishReasons',
    'modelRoundToolCallCounts',
    'modelRoundFallbackHits',
    'modelRoundRequestedReasoningLevels',
    'modelRoundEffectiveReasoningLevels',
    'modelRoundInputTokens',
    'modelRoundOutputTokens',
    'modelRoundPromptTotalChars',
    'modelRoundPromptEstimatedTokens',
    'modelRoundPromptSystemChars',
    'modelRoundPromptHistoryMessageChars',
    'modelRoundPromptHistoricalToolSummaryChars',
    'modelRoundPromptActionResultChars',
    'modelRoundHistoryPromptSnapshotChars',
    'observedToolLatency',
    'preFirstTokenNonToolLatency',
    'postFirstTokenLatency',
    'warmupHitLevel',
    'finalAppId',
    'finalAppInTop1',
    'finalAppInTop3',
    'sourceFirstHit',
    'repeatSearchCount',
    'disambiguationCount',
    'topCandidateAppId',
    'returnedAppIds',
    'finalSourceIds',
    'resultKind',
    'partial',
    'failedTargetCount',
    'assistantFinishReason',
    'finalConversationProfile',
    'toolPath',
    'searchOnlyOutcome',
    'expectedAppMatched',
    'expectedSourceMatched',
    'semanticScheduled',
    'semanticScheduleReason',
    'semanticWarmupHit',
    'semanticSummaryAvailable',
    'derivedSummaryAvailable',
    'semanticSummaryUnavailableReason',
  ]

  const escapeCell = (value: any) => {
    const text = value === undefined || value === null
      ? ''
      : Array.isArray(value)
        ? JSON.stringify(value)
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  const lines = [headers.join(',')]
  for (const item of records) {
    lines.push([
      item.caseId,
      item.category,
      item.attempt,
      item.question,
      item.mode,
      item.temperature,
      item.traceId,
      item.timeoutMs,
      item.threadId,
      item.success,
      item.error,
      item.benchmarkFailureReason,
      item.featureFlags,
      item.firstTokenLatency,
      item.totalLatency,
      item.searchAppsLatency,
      item.getAppMemoryLatency,
      item.readAppDataLatency,
      item.warmupWaitMs,
      item.onsiteBuildMs,
      item.assistantTextChars,
      item.finalContentChars,
      item.inputTokens,
      item.outputTokens,
      item.totalTokens,
      item.diagnosticInputTokens,
      item.diagnosticOutputTokens,
      item.diagnosticTotalTokens,
      item.diagnosticTotalDurationMs,
      item.diagnosticTotalRounds,
      item.diagnosticTotalToolCalls,
      item.diagnosticFallbackStage,
      item.diagnosticFirstNoNewInformationRound,
      item.diagnosticLastEffectiveToolResult,
      item.modelRoundDurations,
      item.modelRoundFirstTokenLatencies,
      item.modelRoundFinishReasons,
      item.modelRoundToolCallCounts,
      item.modelRoundFallbackHits,
      item.modelRoundRequestedReasoningLevels,
      item.modelRoundEffectiveReasoningLevels,
      item.modelRoundInputTokens,
      item.modelRoundOutputTokens,
      item.modelRoundPromptTotalChars,
      item.modelRoundPromptEstimatedTokens,
      item.modelRoundPromptSystemChars,
      item.modelRoundPromptHistoryMessageChars,
      item.modelRoundPromptHistoricalToolSummaryChars,
      item.modelRoundPromptActionResultChars,
      item.modelRoundHistoryPromptSnapshotChars,
      item.observedToolLatency,
      item.preFirstTokenNonToolLatency,
      item.postFirstTokenLatency,
      item.warmupHitLevel,
      item.finalAppId,
      item.finalAppInTop1,
      item.finalAppInTop3,
      item.sourceFirstHit,
      item.repeatSearchCount,
      item.disambiguationCount,
      item.topCandidateAppId,
      item.returnedAppIds,
      item.finalSourceIds,
      item.resultKind,
      item.partial,
      item.failedTargetCount,
      item.assistantFinishReason,
      item.finalConversationProfile,
      item.toolPath,
      item.searchOnlyOutcome,
      item.expectedAppMatched,
      item.expectedSourceMatched,
      item.semanticScheduled,
      item.semanticScheduleReason,
      item.semanticWarmupHit,
      item.semanticSummaryAvailable,
      item.derivedSummaryAvailable,
      item.semanticSummaryUnavailableReason,
    ].map(escapeCell).join(','))
  }
  return `${lines.join('\n')}\n`
}

async function resolveRuntimeContext(jar: CookieJar, baseUrl: string, allowIsolatedDataDir: boolean) {
  const warmup = await requestJson<{ filePath?: string }>(jar, baseUrl, '/ai/debug/warmup')
  const ledgerPath = String(warmup?.filePath || '').trim()
  assert(ledgerPath, '无法从 /ai/debug/warmup 返回值中解析 warmup-status.json 路径。')
  const nocodesDir = path.dirname(path.dirname(ledgerPath))
  assert(nocodesDir, '无法根据 warmup-status.json 路径推导 nocodes 目录。')
  if (!allowIsolatedDataDir && /ds-banban-dev/i.test(nocodesDir)) {
    throw new Error(`当前 benchmark 指向隔离数据目录: ${nocodesDir}。如需继续，请显式传入 --allow-isolated-data-dir。`)
  }
  return {
    ledgerPath,
    nocodesDir,
  }
}

async function createColdBackup(runId: string, nocodesDir: string, appId: string) {
  const appAiDir = path.join(nocodesDir, appId, 'ai')
  const backupDir = path.resolve('.tmp', 'ai-warmup-memory-backups', runId, appId)
  await mkdir(path.dirname(backupDir), { recursive: true })

  let existed = false
  try {
    await cp(appAiDir, backupDir, {
      recursive: true,
      force: true,
      errorOnExist: false,
    })
    existed = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/ENOENT/i.test(message)) {
      throw new Error(`备份 ${appAiDir} 失败: ${message}`)
    }
  }

  await rm(appAiDir, {
    recursive: true,
    force: true,
  })

  return {
    appId,
    appAiDir,
    backupDir,
    existed,
  } satisfies BackupState
}

async function restoreColdBackup(backupState: BackupState) {
  await rm(backupState.appAiDir, {
    recursive: true,
    force: true,
  })

  if (!backupState.existed) {
    return
  }

  await mkdir(path.dirname(backupState.appAiDir), { recursive: true })
  try {
    await cp(backupState.backupDir, backupState.appAiDir, {
      recursive: true,
      force: true,
      errorOnExist: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`恢复 ${backupState.appAiDir} 失败，请检查备份目录 ${backupState.backupDir}: ${message}`)
  }
}

async function runBenchmark() {
  const options = parseArgs(process.argv.slice(2))
  const descriptor = MODE_DESCRIPTORS[options.mode]
  const rawCases = await readJsonFile<BenchmarkCase[]>(options.casesPath)
  const cases = (Array.isArray(rawCases) ? rawCases : []).map(caseItem => ({
    caseId: String(caseItem?.caseId || '').trim(),
    category: String(caseItem?.category || '').trim(),
    question: String(caseItem?.question || '').trim(),
    setupTurns: normalizeOrderedStringArray(caseItem?.setupTurns),
    timeoutMs: normalizeBenchmarkCaseTimeoutMs(caseItem?.timeoutMs),
    nocodeIds: normalizeStringArray(caseItem?.nocodeIds),
    expected: {
      appId: String(caseItem?.expected?.appId || '').trim() || undefined,
      sourceIds: normalizeStringArray(caseItem?.expected?.sourceIds),
      sourceNames: normalizeStringArray(caseItem?.expected?.sourceNames),
    },
  }))

  for (const caseItem of cases) {
    assert(
      !caseItem.setupTurns || caseItem.setupTurns.every(item => String(item || '').trim()),
      `case ${caseItem?.caseId || '<unknown>'} 的 setupTurns 只能包含非空字符串。`,
    )
  }

  assert(Array.isArray(cases) && cases.length > 0, 'benchmark cases 文件不能为空。')
  for (const caseItem of cases) {
    assert(String(caseItem?.caseId || '').trim(), '每条 case 都必须提供 caseId。')
    assert(String(caseItem?.category || '').trim(), `case ${caseItem?.caseId || '<unknown>'} 缺少 category。`)
    assert(String(caseItem?.question || '').trim(), `case ${caseItem?.caseId || '<unknown>'} 缺少 question。`)
  }

  const runId = new Date().toISOString().replace(/[^\dT]/g, '').slice(0, 15)
  const preview = {
    runId,
    baseUrl: options.baseUrl,
    casesPath: options.casesPath,
    mode: options.mode,
    temperature: options.temperature,
    providerId: options.providerId || null,
    modelId: options.modelId || null,
    model: options.model || null,
    dryRun: options.dryRun,
    keepMutatedMemory: options.keepMutatedMemory,
    allowIsolatedDataDir: options.allowIsolatedDataDir,
    implemented: descriptor.implemented,
    notImplementedReason: descriptor.reason || null,
    plannedFeatureFlags: descriptor.flags,
    attemptsPerCase: options.temperature === 'hot' ? 2 : 1,
    cases: cases.map(caseItem => ({
      caseId: caseItem.caseId,
      category: caseItem.category,
      question: caseItem.question,
      setupTurnCount: normalizeOrderedStringArray(caseItem.setupTurns).length,
      setupTurns: normalizeOrderedStringArray(caseItem.setupTurns),
      timeoutMs: resolveBenchmarkCaseTimeoutMs(caseItem.timeoutMs, STREAM_TIMEOUT_MS),
      threadMode: normalizeOrderedStringArray(caseItem.setupTurns).length ? 'setup+measured-turn' : 'single-turn',
      expectedAppId: String(caseItem.expected?.appId || '').trim() || null,
      coldRequiresBackup: options.temperature === 'cold',
    })),
  }

  if (options.dryRun) {
    await writeJsonFile(OUTPUT_JSON_PATH, {
      ...preview,
      records: [],
      summary: null,
    })
    await mkdir(path.dirname(OUTPUT_CSV_PATH), { recursive: true })
    await writeFile(OUTPUT_CSV_PATH, 'caseId,category,question,mode,temperature,dryRun\n', 'utf8')
    console.log(JSON.stringify(preview, null, 2))
    console.log(`[benchmark] dry-run 完成: ${OUTPUT_JSON_PATH}`)
    console.log(`[benchmark] dry-run 完成: ${OUTPUT_CSV_PATH}`)
    return
  }

  assert(descriptor.implemented, descriptor.reason || `mode ${options.mode} 尚未实现。`)

  const jar = new CookieJar()
  await loginAsAdmin(jar, options.baseUrl)
  const runtimeContext = await resolveRuntimeContext(jar, options.baseUrl, options.allowIsolatedDataDir)
  const currentConfig = await requestJson<AiSettings>(jar, options.baseUrl, '/ai/config')
  const nextFeatureFlags = {
    ...(currentConfig.featureFlags || {}),
    ...descriptor.flags,
  }

  const records: AttemptRecord[] = []
  const errors: string[] = []
  await requestJson<AiSettings>(jar, options.baseUrl, '/ai/config', {
    method: 'PATCH',
    body: JSON.stringify({ featureFlags: nextFeatureFlags }),
  })

  try {
    for (const caseItem of cases) {
      const expectedAppId = String(caseItem.expected?.appId || '').trim()
      if (options.temperature === 'cold' && !expectedAppId) {
        throw new Error(`cold 模式要求 case ${caseItem.caseId} 提供 expected.appId，用于备份和恢复 app ai memory。`)
      }

      const attempts = options.temperature === 'hot' ? 2 : 1
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let backupState: BackupState | null = null
        const traceId = `warmup-benchmark:${runId}:${caseItem.caseId}:attempt-${attempt}`
        const caseTimeoutMs = resolveBenchmarkCaseTimeoutMs(caseItem.timeoutMs, STREAM_TIMEOUT_MS)
        try {
          if (options.temperature === 'cold') {
            backupState = await createColdBackup(runId, runtimeContext.nocodesDir, expectedAppId)
          }

          const threadId = await runCaseSetupTurns({
            jar,
            baseUrl: options.baseUrl,
            caseItem,
            traceId,
            providerId: options.providerId,
            modelId: options.modelId,
            model: options.model,
          })
          const streamResult = await streamThread(jar, options.baseUrl, {
            message: caseItem.question,
            traceId,
            threadId,
            nocodeIds: normalizeStringArray(caseItem.nocodeIds),
            providerId: options.providerId,
            modelId: options.modelId,
            model: options.model,
          }, caseTimeoutMs)
          const traces = await pollWarmupTraces(jar, options.baseUrl, traceId)
          const record = buildAttemptRecord({
            caseItem,
            attempt,
            mode: options.mode,
            temperature: options.temperature,
            traceId,
            timeoutMs: caseTimeoutMs,
            threadId: streamResult.threadId,
            streamResult,
            traces,
            featureFlags: descriptor.flags,
          })
          records.push(record)
          if (!record.success) {
            errors.push(`case ${caseItem.caseId} attempt ${attempt}: ${record.benchmarkFailureReason || record.error || 'unknown failure'}`)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          records.push({
            caseId: caseItem.caseId,
            category: caseItem.category,
            question: caseItem.question,
            attempt,
            mode: options.mode,
            temperature: options.temperature,
            traceId,
            timeoutMs: caseTimeoutMs,
            threadId: undefined,
            success: false,
            error: message,
            benchmarkFailureReason: message,
            featureFlags: descriptor.flags,
            firstTokenLatency: null,
            totalLatency: null,
            searchAppsLatency: 0,
            getAppMemoryLatency: 0,
            readAppDataLatency: 0,
            warmupWaitMs: 0,
            onsiteBuildMs: 0,
            assistantTextChars: 0,
            finalContentChars: 0,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            diagnosticInputTokens: null,
            diagnosticOutputTokens: null,
            diagnosticTotalTokens: null,
            diagnosticTotalDurationMs: null,
            diagnosticTotalRounds: null,
            diagnosticTotalToolCalls: null,
            diagnosticFallbackStage: undefined,
            diagnosticFirstNoNewInformationRound: null,
            diagnosticLastEffectiveToolResult: undefined,
            modelRoundDurations: [],
            modelRoundFirstTokenLatencies: [],
            modelRoundFinishReasons: [],
            modelRoundToolCallCounts: [],
            modelRoundFallbackHits: [],
            modelRoundRequestedReasoningLevels: [],
            modelRoundEffectiveReasoningLevels: [],
            modelRoundInputTokens: [],
            modelRoundOutputTokens: [],
            modelRoundPromptTotalChars: [],
            modelRoundPromptEstimatedTokens: [],
            modelRoundPromptSystemChars: [],
            modelRoundPromptHistoryMessageChars: [],
            modelRoundPromptHistoricalToolSummaryChars: [],
            modelRoundPromptActionResultChars: [],
            modelRoundHistoryPromptSnapshotChars: [],
            observedToolLatency: 0,
            preFirstTokenNonToolLatency: null,
            postFirstTokenLatency: null,
            warmupHitLevel: 'unknown',
            finalAppId: undefined,
            finalSourceIds: [],
            finalAppInTop1: null,
            finalAppInTop3: null,
            sourceFirstHit: null,
            repeatSearchCount: 0,
            disambiguationCount: 0,
            searchTraceCount: 0,
            primeTraceCount: 0,
            getTraceCount: 0,
            readTraceCount: 0,
            topCandidateAppId: undefined,
            returnedAppIds: [],
            resultKind: undefined,
            partial: false,
            failedTargetCount: 0,
            assistantFinishReason: undefined,
            finalConversationProfile: undefined,
            toolPath: 'unknown',
            searchOnlyOutcome: null,
            expectedAppMatched: null,
            expectedSourceMatched: null,
            semanticScheduled: false,
            semanticScheduleReason: undefined,
            semanticWarmupHit: false,
            semanticSummaryAvailable: false,
            derivedSummaryAvailable: false,
            semanticSummaryUnavailableReason: 'pending_or_backoff:unknown',
          })
          errors.push(`case ${caseItem.caseId} attempt ${attempt}: ${message}`)
        } finally {
          if (backupState && !options.keepMutatedMemory) {
            await restoreColdBackup(backupState)
          }
        }
      }
    }
  } finally {
    await requestJson<AiSettings>(jar, options.baseUrl, '/ai/config', {
      method: 'PATCH',
      body: JSON.stringify({ featureFlags: currentConfig.featureFlags || null }),
    })
  }

  const summary = buildSummary(records)
  const result = {
    ...preview,
    dryRun: false,
    nocodesDir: runtimeContext.nocodesDir,
    ledgerPath: runtimeContext.ledgerPath,
    records,
    summary,
    errors,
  }

  await writeJsonFile(OUTPUT_JSON_PATH, result)
  await mkdir(path.dirname(OUTPUT_CSV_PATH), { recursive: true })
  await writeFile(OUTPUT_CSV_PATH, toCsv(records), 'utf8')

  console.log(JSON.stringify({
    runId,
    recordCount: records.length,
    successCount: records.filter(item => item.success).length,
    failureCount: records.filter(item => !item.success).length,
    outputJson: OUTPUT_JSON_PATH,
    outputCsv: OUTPUT_CSV_PATH,
    summary,
  }, null, 2))

  if (errors.length) {
    throw new Error(`benchmark 完成，但存在 ${errors.length} 条失败记录。首条失败: ${errors[0]}`)
  }
}

if (require.main === module) {
  runBenchmark().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[benchmark] AI warmup benchmark failed: ${message}`)
    process.exitCode = 1
  })
}
