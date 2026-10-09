<template>
  <details
    v-if="diagnosticsData"
    class="ai-dev-diagnostics"
    :open="isExpanded"
    @toggle="handleToggle"
  >
    <summary class="ai-dev-diagnostics__header">
      <span class="ai-dev-diagnostics__header-main">
        <span class="ai-dev-diagnostics__title">{{ $t('workbenchAiDevDiagnostics.devSessionDiagnostics') }}</span>
        <span class="ai-dev-diagnostics__header-meta">{{ headerSummaryText }}</span>
      </span>
      <span class="ai-dev-diagnostics__header-actions">
        <span class="ai-dev-diagnostics__badge">DEV</span>
        <span class="ai-dev-diagnostics__arrow" aria-hidden="true"></span>
      </span>
    </summary>

    <div class="ai-dev-diagnostics__body">
      <div class="ai-dev-diagnostics__summary">
        <div class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.actualModel') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ effectiveModelsText }}</span>
        </div>
        <div v-if="publicModelsText" class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.publicModel') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ publicModelsText }}</span>
        </div>
        <div v-if="providersText" class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.provider') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ providersText }}</span>
        </div>
        <div v-if="reasoningSummaryText" class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.reasoningEffort') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ reasoningSummaryText }}</span>
        </div>
        <div v-if="reasoningModeSummaryText" class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.routingMode') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ reasoningModeSummaryText }}</span>
        </div>
        <div v-if="routePolicySummaryText" class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.routingPolicy') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ routePolicySummaryText }}</span>
        </div>
        <div v-if="fallbackSummaryText" class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.fallbackHit') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ fallbackSummaryText }}</span>
        </div>
        <div class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.modelCalls') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ diagnosticsData.totalRounds }}{{ $t('workbenchAiDevDiagnostics.timesSuffix') }}</span>
        </div>
        <div class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.toolCalls') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ diagnosticsData.totalToolCalls }}{{ $t('workbenchAiDevDiagnostics.timesSuffix') }}</span>
        </div>
        <div class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.totalDuration') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ formatDuration(diagnosticsData.totalDurationMs) }}</span>
        </div>
        <div class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.totalTokens') }}</span>
          <span class="ai-dev-diagnostics__summary-value">{{ formatTokenCount(diagnosticsData.usage.totalTokens) }}</span>
        </div>
        <div class="ai-dev-diagnostics__summary-item">
          <span class="ai-dev-diagnostics__summary-label">{{ $t('workbenchAiDevDiagnostics.inputOutput') }}</span>
          <span class="ai-dev-diagnostics__summary-value">
            {{ formatTokenCount(diagnosticsData.usage.inputTokens) }} / {{ formatTokenCount(diagnosticsData.usage.outputTokens) }}
          </span>
        </div>
      </div>

      <div class="ai-dev-diagnostics__rounds">
        <div
          v-for="round in diagnosticsData.rounds"
          :key="`diagnostics-round-${round.round}-${round.startedAt}`"
          class="ai-dev-diagnostics__round"
        >
          <div class="ai-dev-diagnostics__round-header">
            <span class="ai-dev-diagnostics__round-title">{{ $t('workbenchAiDevDiagnostics.ordinalPrefix') }}{{ round.round }}{{ $t('workbenchAiDevDiagnostics.roundModelCall') }}</span>
            <span class="ai-dev-diagnostics__round-meta">{{ formatClockRange(round.startedAt, round.completedAt) }}</span>
          </div>
          <div class="ai-dev-diagnostics__round-grid">
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.actualModel') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ round.effectiveModel || round.effectiveModelId || '--' }}</span>
            </div>
            <div v-if="round.publicModel" class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.publicModel') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ round.publicModel }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.requestedReasoningEffort') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatReasoningLevel(round.requestedReasoningLevel) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.actualReasoningEffort') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatReasoningLevel(round.effectiveReasoningLevel) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.routingMode') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatReasoningMode(round.reasoningMode) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.routingPolicy') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatRoutePolicy(round.routePolicyId, round.routeVersion) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.fallbackHit') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatFallback(round.fallbackHit) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.duration') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatDuration(round.durationMs) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.firstTokenLatency') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatDuration(round.firstTokenLatencyMs) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.finishReason') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ round.finishReason || '--' }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.toolCalls') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ round.toolCallCount }}{{ $t('workbenchAiDevDiagnostics.timesSuffix') }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item is-wide">
              <span class="ai-dev-diagnostics__round-label">{{ $t('workbenchAiDevDiagnostics.reasoningDecisionBasis') }}</span>
              <span class="ai-dev-diagnostics__round-value">{{ formatReasonCodes(round.reasoningReasonCodes) }}</span>
            </div>
            <div class="ai-dev-diagnostics__round-item is-wide">
              <span class="ai-dev-diagnostics__round-label">Token</span>
              <span class="ai-dev-diagnostics__round-value">
                {{ formatTokenCount(round.usage.totalTokens) }}
                <span class="ai-dev-diagnostics__round-value-sub">{{ $t('workbenchAiDevDiagnostics.inputPrefix') }}{{ formatTokenCount(round.usage.inputTokens) }}{{ $t('workbenchAiDevDiagnostics.outputSuffix') }}{{ formatTokenCount(round.usage.outputTokens) }})
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import i18next from 'i18next'
import type {
  AiReasoningLevel,
  AiReasoningMode,
  AiTokenUsage,
  AiTurnDiagnostics,
  AiTurnDiagnosticsRound,
} from '../types'

type LooseRecord = Record<string, unknown>

const props = defineProps({
  diagnostics: {
    type: Object as PropType<AiTurnDiagnostics | LooseRecord | null>,
    default: null,
  },
  resetKey: {
    type: String,
    default: '',
  },
})

const isExpanded = ref(false)

watch(() => props.resetKey, (nextResetKey, previousResetKey) => {
  if (nextResetKey !== previousResetKey) {
    isExpanded.value = false
  }
})

const REASONING_LEVEL_LABEL_MAP: Record<AiReasoningLevel, string> = {
  get low() { return i18next.t('workbenchAiDevDiagnostics.low') },
  get medium() { return i18next.t('workbenchAiDevDiagnostics.medium') },
  get high() { return i18next.t('workbenchAiDevDiagnostics.high') },
}

const REASONING_MODE_LABEL_MAP: Record<AiReasoningMode, string> = {
  get 'builtin-route'() { return i18next.t('workbenchAiDevDiagnostics.builtinRoute') },
  get parameter() { return i18next.t('workbenchAiDevDiagnostics.parameterPassThrough') },
  get 'model-map'() { return i18next.t('workbenchAiDevDiagnostics.modelMap') },
  get 'provider-default'() { return i18next.t('workbenchAiDevDiagnostics.providerDefault') },
}

const REASON_CODE_LABEL_MAP: Record<string, string> = {
  get 'profile-neutral-base'() { return i18next.t('workbenchAiDevDiagnostics.reasonProfileNeutralBase') },
  get 'profile-records-base'() { return i18next.t('workbenchAiDevDiagnostics.reasonProfileRecordsBase') },
  get 'profile-compare-base'() { return i18next.t('workbenchAiDevDiagnostics.reasonProfileCompareBase') },
  get 'message-design-heavy'() { return i18next.t('workbenchAiDevDiagnostics.reasonMessageDesignHeavy') },
  get 'message-analysis-heavy'() { return i18next.t('workbenchAiDevDiagnostics.reasonMessageAnalysisHeavy') },
  get 'message-summary-heavy'() { return i18next.t('workbenchAiDevDiagnostics.reasonMessageSummaryHeavy') },
  get 'runtime-aggregation'() { return i18next.t('workbenchAiDevDiagnostics.reasonRuntimeAggregation') },
  get 'runtime-clarify'() { return i18next.t('workbenchAiDevDiagnostics.reasonRuntimeClarify') },
  get 'runtime-comparison'() { return i18next.t('workbenchAiDevDiagnostics.reasonRuntimeComparison') },
  get 'verified-multi-target'() { return i18next.t('workbenchAiDevDiagnostics.reasonVerifiedMultiTarget') },
  get 'verified-single-target-fast-path'() { return i18next.t('workbenchAiDevDiagnostics.reasonVerifiedSingleTargetFastPath') },
  get 'history-multi-read'() { return i18next.t('workbenchAiDevDiagnostics.reasonHistoryMultiRead') },
  get 'history-multi-memory-compare'() { return i18next.t('workbenchAiDevDiagnostics.reasonHistoryMultiMemoryCompare') },
  get 'round-escalation-unverified'() { return i18next.t('workbenchAiDevDiagnostics.reasonRoundEscalationUnverified') },
  get 'search-unresolved'() { return i18next.t('workbenchAiDevDiagnostics.reasonSearchUnresolved') },
  get 'top-candidate-unstable'() { return i18next.t('workbenchAiDevDiagnostics.reasonTopCandidateUnstable') },
  get 'deep-round-escalation'() { return i18next.t('workbenchAiDevDiagnostics.reasonDeepRoundEscalation') },
}

const toRecord = (value: unknown): LooseRecord | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null
)

const normalizeText = (value?: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || ''
}

const normalizeTimestamp = (value?: unknown) => {
  const normalized = Math.round(Number(value || 0))
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

const normalizeReasoningLevel = (value?: unknown): AiReasoningLevel | undefined => {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'low' || normalized === 'medium' || normalized === 'high'
    ? normalized as AiReasoningLevel
    : undefined
}

const normalizeReasoningMode = (value?: unknown): AiReasoningMode | undefined => {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'builtin-route'
    || normalized === 'parameter'
    || normalized === 'model-map'
    || normalized === 'provider-default'
    ? normalized as AiReasoningMode
    : undefined
}

const normalizeBoolean = (value?: unknown) => (
  typeof value === 'boolean' ? value : undefined
)

const normalizeTokenUsage = (value?: unknown): AiTokenUsage => {
  const record = toRecord(value)
  const inputTokens = Math.max(0, Math.round(Number(record?.inputTokens || 0)))
  const outputTokens = Math.max(0, Math.round(Number(record?.outputTokens || 0)))
  const totalTokens = Math.max(
    0,
    Math.round(Number(record?.totalTokens || (inputTokens + outputTokens))),
  )

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  }
}

const normalizePromptDiagnostics = (value?: unknown) => {
  const record = toRecord(value)
  if (!record) {
    return undefined
  }

  return {
    totalChars: Math.max(0, Math.round(Number(record.totalChars || 0))),
    estimatedTokens: Math.max(0, Math.round(Number(record.estimatedTokens || 0))),
    messageCount: Math.max(0, Math.round(Number(record.messageCount || 0))),
    historyMessageCount: Math.max(0, Math.round(Number(record.historyMessageCount || 0))),
    actionResultCount: Math.max(0, Math.round(Number(record.actionResultCount || 0))),
    systemPromptChars: Math.max(0, Math.round(Number(record.systemPromptChars || 0))),
    historyMessageChars: Math.max(0, Math.round(Number(record.historyMessageChars || 0))),
    historicalToolSummaryChars: Math.max(0, Math.round(Number(record.historicalToolSummaryChars || 0))),
    currentActionResultChars: Math.max(0, Math.round(Number(record.currentActionResultChars || 0))),
    historyPromptSnapshotChars: Math.max(0, Math.round(Number(record.historyPromptSnapshotChars || 0))),
  }
}

const normalizeToolProgressDiagnostics = (value?: unknown) => {
  const record = toRecord(value)
  if (!record) {
    return undefined
  }

  const lastEffectiveToolResult = toRecord(record.lastEffectiveToolResult)
  return {
    actionResultCount: Math.max(0, Math.round(Number(record.actionResultCount || 0))),
    firstNoNewInformationRound: Math.max(0, Math.round(Number(record.firstNoNewInformationRound || 0))) || undefined,
    lastEffectiveToolResult: lastEffectiveToolResult
      ? {
          round: Math.max(1, Math.round(Number(lastEffectiveToolResult.round || 1))),
          tool: normalizeText(lastEffectiveToolResult.tool),
          resultKind: normalizeText(lastEffectiveToolResult.resultKind) || undefined,
          appId: normalizeText(lastEffectiveToolResult.appId) || undefined,
          targetId: normalizeText(lastEffectiveToolResult.targetId) || undefined,
          path: normalizeText(lastEffectiveToolResult.path) || undefined,
          truncated: normalizeBoolean(lastEffectiveToolResult.truncated),
          nextOffset: Math.max(0, Math.round(Number(lastEffectiveToolResult.nextOffset || 0))) || undefined,
        }
      : undefined,
  }
}

const normalizeTextList = (value?: unknown) => (
  Array.isArray(value)
    ? [...new Set(value.map(item => normalizeText(item)).filter(Boolean))]
    : []
)

const normalizeRound = (value?: unknown): AiTurnDiagnosticsRound | null => {
  const record = toRecord(value)
  if (!record) {
    return null
  }

  const round = Math.max(1, Math.round(Number(record.round || 0)))
  const startedAt = normalizeTimestamp(record.startedAt)
  const completedAt = Math.max(normalizeTimestamp(record.completedAt), startedAt)
  if (!startedAt || !completedAt) {
    return null
  }

  const firstTokenAt = normalizeTimestamp(record.firstTokenAt) || undefined
  const durationMs = Math.max(0, Math.round(Number(record.durationMs || (completedAt - startedAt))))
  const firstTokenLatencyMs = firstTokenAt
    ? Math.max(0, Math.round(Number(record.firstTokenLatencyMs || (firstTokenAt - startedAt))))
    : undefined

  return {
    round,
    startedAt,
    firstTokenAt,
    completedAt,
    durationMs,
    firstTokenLatencyMs,
    provider: normalizeText(record.provider) || undefined,
    requestedModel: normalizeText(record.requestedModel) || undefined,
    publicModel: normalizeText(record.publicModel) || undefined,
    effectiveModel: normalizeText(record.effectiveModel) || undefined,
    effectiveModelId: normalizeText(record.effectiveModelId) || undefined,
    routePolicyId: normalizeText(record.routePolicyId) || undefined,
    routeVersion: normalizeText(record.routeVersion) || undefined,
    fallbackHit: normalizeBoolean(record.fallbackHit),
    requestedReasoningLevel: normalizeReasoningLevel(record.requestedReasoningLevel),
    effectiveReasoningLevel: normalizeReasoningLevel(record.effectiveReasoningLevel),
    reasoningMode: normalizeReasoningMode(record.reasoningMode),
    reasoningReasonCodes: normalizeTextList(record.reasoningReasonCodes),
    finishReason: normalizeText(record.finishReason) || undefined,
    toolCallCount: Math.max(0, Math.round(Number(record.toolCallCount || 0))),
    usage: normalizeTokenUsage(record.usage),
    promptDiagnostics: normalizePromptDiagnostics(record.promptDiagnostics),
  }
}

const diagnosticsData = computed<AiTurnDiagnostics | null>(() => {
  const value = toRecord(props.diagnostics)
  if (!value) {
    return null
  }

  const rounds = Array.isArray(value.rounds)
    ? value.rounds.map(item => normalizeRound(item)).filter(Boolean) as AiTurnDiagnosticsRound[]
    : []

  if (!rounds.length) {
    return null
  }

  const startedAt = normalizeTimestamp(value.startedAt) || rounds[0].startedAt
  const completedAt = Math.max(
    normalizeTimestamp(value.completedAt) || rounds[rounds.length - 1].completedAt,
    startedAt,
  )

  return {
    startedAt,
    completedAt,
    totalDurationMs: Math.max(0, Math.round(Number(value.totalDurationMs || (completedAt - startedAt)))),
    totalRounds: Math.max(rounds.length, Math.round(Number(value.totalRounds || rounds.length))),
    totalToolCalls: Math.max(
      0,
      Math.round(Number(value.totalToolCalls || rounds.reduce((sum, item) => sum + item.toolCallCount, 0))),
    ),
    usage: normalizeTokenUsage(value.usage),
    providers: normalizeTextList(value.providers),
    requestedModels: normalizeTextList(value.requestedModels),
    publicModels: normalizeTextList(value.publicModels),
    effectiveModels: normalizeTextList(value.effectiveModels),
    rounds,
    toolProgress: normalizeToolProgressDiagnostics(value.toolProgress),
  }
})

const uniqueRoundValues = <T extends string>(
  resolver: (round: AiTurnDiagnosticsRound) => T | undefined,
) => {
  const rounds = diagnosticsData.value?.rounds || []
  return [...new Set(rounds.map(resolver).filter(Boolean) as T[])]
}

const effectiveModelsText = computed(() => {
  if (!diagnosticsData.value) {
    return '--'
  }
  const models = diagnosticsData.value.effectiveModels.length
    ? diagnosticsData.value.effectiveModels
    : diagnosticsData.value.rounds
      .map(item => item.effectiveModel || item.effectiveModelId || '')
      .filter(Boolean)
  return models.length ? [...new Set(models)].join(' / ') : '--'
})

const publicModelsText = computed(() => (
  diagnosticsData.value?.publicModels?.length
    ? diagnosticsData.value.publicModels.join(' / ')
    : ''
))

const providersText = computed(() => (
  diagnosticsData.value?.providers?.length
    ? diagnosticsData.value.providers.join(' / ')
    : ''
))

const reasoningSummaryText = computed(() => {
  const requestedLevels = uniqueRoundValues(round => round.requestedReasoningLevel)
  const effectiveLevels = uniqueRoundValues(round => round.effectiveReasoningLevel)
  if (!requestedLevels.length && !effectiveLevels.length) {
    return ''
  }

  const requestedText = requestedLevels.length
    ? requestedLevels.map(formatReasoningLevel).join(' / ')
    : '--'
  const effectiveText = effectiveLevels.length
    ? effectiveLevels.map(formatReasoningLevel).join(' / ')
    : '--'
  return i18next.t('workbenchAiDevDiagnostics.reasoningRequestedActual', { requested: requestedText, actual: effectiveText })
})

const reasoningModeSummaryText = computed(() => {
  const modes = uniqueRoundValues(round => round.reasoningMode)
  return modes.length
    ? modes.map(formatReasoningMode).join(' / ')
    : ''
})

const routePolicySummaryText = computed(() => {
  const routePolicies = uniqueRoundValues(round => formatRoutePolicy(round.routePolicyId, round.routeVersion, false))
  return routePolicies.length
    ? routePolicies.join(' / ')
    : ''
})

const fallbackSummaryText = computed(() => {
  const rounds = diagnosticsData.value?.rounds || []
  if (!rounds.length) {
    return ''
  }
  const fallbackRounds = rounds.filter(round => round.fallbackHit === true).length
  if (!fallbackRounds) {
    return i18next.t('workbenchAiDevDiagnostics.notHit')
  }
  return i18next.t('workbenchAiDevDiagnostics.fallbackHitRounds', { fallbackRounds, totalRounds: rounds.length })
})

const headerSummaryText = computed(() => {
  if (!diagnosticsData.value) {
    return ''
  }

  const parts = []
  if (effectiveModelsText.value !== '--') {
    parts.push(effectiveModelsText.value)
  }
  parts.push(i18next.t('workbenchAiDevDiagnostics.modelRoundsSummary', { count: diagnosticsData.value.totalRounds }))
  parts.push(i18next.t('workbenchAiDevDiagnostics.toolCallsSummary', { count: diagnosticsData.value.totalToolCalls }))
  parts.push(i18next.t('workbenchAiDevDiagnostics.durationSummary', { duration: formatDuration(diagnosticsData.value.totalDurationMs) }))
  parts.push(`Token ${formatTokenCount(diagnosticsData.value.usage.totalTokens)}`)
  return parts.join(' · ')
})

const formatClock = (timestamp?: number) => {
  const normalized = normalizeTimestamp(timestamp)
  if (!normalized) {
    return '--'
  }

  const date = new Date(normalized)
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

const formatClockRange = (start?: number, end?: number) => (
  `${formatClock(start)} - ${formatClock(end)}`
)

const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined || durationMs === null) {
    return '--'
  }
  const normalized = Math.round(Number(durationMs))
  if (!Number.isFinite(normalized) || normalized < 0) {
    return '--'
  }
  if (normalized === 0) {
    return '0ms'
  }
  if (normalized < 1000) {
    return `${normalized}ms`
  }
  if (normalized < 60 * 1000) {
    return `${(normalized / 1000).toFixed(2)}s`
  }

  const minutes = Math.floor(normalized / 60000)
  const seconds = ((normalized % 60000) / 1000).toFixed(2)
  return `${minutes}m ${seconds}s`
}

const formatTokenCount = (value?: number) => {
  const normalized = Math.max(0, Math.round(Number(value || 0)))
  return normalized.toLocaleString(i18next.resolvedLanguage || i18next.language || 'en')
}

function formatReasoningLevel(level?: AiReasoningLevel) {
  return level ? REASONING_LEVEL_LABEL_MAP[level] : '--'
}

function formatReasoningMode(mode?: AiReasoningMode) {
  return mode ? REASONING_MODE_LABEL_MAP[mode] : '--'
}

function formatRoutePolicy(routePolicyId?: string, routeVersion?: string, allowFallback = true) {
  const normalizedId = normalizeText(routePolicyId)
  const normalizedVersion = normalizeText(routeVersion)
  if (!normalizedId) {
    return allowFallback ? '--' : ''
  }
  return normalizedVersion ? `${normalizedId} (v${normalizedVersion})` : normalizedId
}

function formatFallback(value?: boolean) {
  if (value === true) return i18next.t('workbenchAiDevDiagnostics.yes')
  if (value === false) return i18next.t('workbenchAiDevDiagnostics.no')
  return '--'
}

function formatReasonCodes(value?: string[] | null) {
  const items = normalizeTextList(value)
  if (!items.length) {
    return '--'
  }
  return items
    .map(item => REASON_CODE_LABEL_MAP[item] || item)
    .join(' / ')
}

function handleToggle(event: Event) {
  isExpanded.value = (event.currentTarget as HTMLDetailsElement | null)?.open ?? false
}
</script>

<style scoped lang="scss">
.ai-dev-diagnostics {
  margin-top: 12px;
  border: 1px solid rgba(27, 43, 65, 0.12);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(241, 245, 249, 0.92) 100%);
  overflow: hidden;
}

.ai-dev-diagnostics__header {
  list-style: none;
  cursor: var(--cursor-pointer);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  user-select: none;
}

.ai-dev-diagnostics__header::-webkit-details-marker {
  display: none;
}

.ai-dev-diagnostics__header-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-dev-diagnostics__header-meta {
  font-size: 12px;
  line-height: 18px;
  color: #64748b;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-dev-diagnostics__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ai-dev-diagnostics__title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.ai-dev-diagnostics__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.ai-dev-diagnostics__arrow {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  flex-shrink: 0;
  border-top: 1.5px solid #86909c;
  border-right: 1.5px solid #86909c;
  transform: rotate(135deg);
  transform-origin: center;
  transition: transform 0.2s ease;
}

.ai-dev-diagnostics:not([open]) .ai-dev-diagnostics__arrow {
  transform: rotate(45deg);
}

.ai-dev-diagnostics__body {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-dev-diagnostics__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.ai-dev-diagnostics__summary-item,
.ai-dev-diagnostics__round-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ai-dev-diagnostics__summary-label,
.ai-dev-diagnostics__round-label {
  font-size: 12px;
  color: #64748b;
}

.ai-dev-diagnostics__summary-value,
.ai-dev-diagnostics__round-value {
  font-size: 12px;
  color: #0f172a;
  font-weight: 500;
  word-break: break-word;
}

.ai-dev-diagnostics__round-value-sub {
  color: #64748b;
  font-weight: 400;
}

.ai-dev-diagnostics__rounds {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-dev-diagnostics__round {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.ai-dev-diagnostics__round-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.ai-dev-diagnostics__round-title {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.ai-dev-diagnostics__round-meta {
  font-size: 12px;
  color: #64748b;
}

.ai-dev-diagnostics__round-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.ai-dev-diagnostics__round-item.is-wide {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .ai-dev-diagnostics__summary,
  .ai-dev-diagnostics__round-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-dev-diagnostics__round-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
