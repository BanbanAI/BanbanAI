<template>
  <div v-if="stageItems.length || orphanInterimTexts.length" class="ai-tool-calls">
    <div v-for="stage in stageItems" :key="stage.id" class="ai-tool-calls__item">
      <div class="ai-tool-call">
        <div class="ai-tool-call__summary">
          <span class="ai-tool-call__title-wrap">
            <span class="ai-tool-call__name">{{ resolveDisplayName(stage.call) }}</span>
            <span v-if="resolveDisplaySummary(stage.call)" class="ai-tool-call__subtitle">{{ resolveDisplaySummary(stage.call) }}</span>
          </span>
          <span class="ai-tool-call__tail">
            <span class="ai-tool-call__meta">
              <span class="ai-tool-call__status" :class="`is-${resolveDisplayStatus(stage.call)}`">{{ resolveDisplayStatusText(stage.call) }}</span>
              <span class="ai-tool-call__duration">{{ formatDuration(stage.call.durationMs) }}</span>
            </span>
          </span>
        </div>
      </div>
      <div v-if="stage.interimTexts.length" class="ai-tool-calls__interims">
        <div v-for="interimText in stage.interimTexts" :key="interimText.id" class="ai-tool-call__interim">
          {{ interimText.text }}
        </div>
      </div>
    </div>

    <div v-for="interimText in orphanInterimTexts" :key="interimText.id" class="ai-tool-call__interim ai-tool-call__interim--orphan">
      {{ interimText.text }}
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import i18next from 'i18next'
import { resolveReadAppDataDisplayName, resolveReadAppDataDisplaySummaryFallback } from '@common/utils/aiToolDisplay'
import { isLikelyToolProtocolText, normalizeInterimText } from '@common/utils/aiToolProtocol'
import type {
  AiInterimTextTrace,
  AiToolCallGroupTimelineItem,
  AiToolCallTrace,
} from '../types'

type AiToolCallRenderItem = {
  id: string
  call?: AiToolCallTrace
  interimText?: AiInterimTextTrace
}

type AiToolStageItem = {
  id: string
  call: AiToolCallTrace
  interimTexts: AiInterimTextTrace[]
}

type AiToolDisplayStatus = 'running' | 'success' | 'error' | 'skipped'

const props = withDefaults(defineProps<{
  calls?: AiToolCallTrace[]
  interimTexts?: AiInterimTextTrace[]
  timeline?: AiToolCallGroupTimelineItem[]
  collapseGroup?: boolean
}>(), {
  calls: () => [],
  interimTexts: () => [],
  timeline: () => [],
  collapseGroup: true,
})

const TOOL_NAME_LABEL_MAP: Record<string, string> = {
  get search_apps() { return i18next.t('workbenchAiToolCalls.searchApps') },
  get get_app_memory() { return i18next.t('workbenchAiToolCalls.analyzeAppStructure') },
}

const TOOL_PENDING_SUMMARY_MAP: Record<string, string> = {
  get search_apps() { return i18next.t('workbenchAiToolCalls.searchAppsRunning') },
  get get_app_memory() { return i18next.t('workbenchAiToolCalls.analyzeAppStructureRunning') },
}

const TOOL_SUCCESS_SUMMARY_MAP: Record<string, string> = {
  get search_apps() { return i18next.t('workbenchAiToolCalls.searchAppsSuccess') },
  get get_app_memory() { return i18next.t('workbenchAiToolCalls.analyzeAppStructureSuccess') },
}

const TOOL_ERROR_SUMMARY_MAP: Record<string, string> = {
  get search_apps() { return i18next.t('workbenchAiToolCalls.searchAppsError') },
  get get_app_memory() { return i18next.t('workbenchAiToolCalls.analyzeAppStructureError') },
}

const TOOL_STATUS_TEXT_MAP: Record<AiToolDisplayStatus, string> = {
  get running() { return i18next.t('workbenchAiToolCalls.running') },
  get success() { return i18next.t('workbenchAiToolCalls.success') },
  get error() { return i18next.t('workbenchAiToolCalls.error') },
  get skipped() { return i18next.t('workbenchAiToolCalls.skipped') },
}

const renderableInterimTexts = computed(() => (
  props.interimTexts
    .map(item => {
      const text = normalizeInterimText(String(item?.text || ''))
      if (!text || isLikelyToolProtocolText(text)) {
        return null
      }
      return {
        ...item,
        text,
      }
    })
    .filter((item): item is AiInterimTextTrace => Boolean(item))
))

const shouldHideCall = (call: AiToolCallTrace) => call.displayHidden === true

const renderableCalls = computed(() => (
  props.calls.filter(call => !shouldHideCall(call))
))

const resolveDisplayName = (call: AiToolCallTrace) => {
  const displayName = String(call.displayName || '').trim()
  if (displayName) {
    return displayName
  }
  const toolName = String(call.name || '').trim()
  if (toolName === 'read_app_data') {
    return resolveReadAppDataDisplayName(call.input)
  }
  return TOOL_NAME_LABEL_MAP[toolName] || toolName || i18next.t('workbenchAiToolCalls.unknownTool')
}

const resolveDisplayStatus = (call: AiToolCallTrace): AiToolDisplayStatus => {
  const displayStatus = String(call.displayStatus || '').trim()
  if (displayStatus === 'running' || displayStatus === 'success' || displayStatus === 'error' || displayStatus === 'skipped') {
    return displayStatus
  }
  if (call.policyBlocked) return 'skipped'
  if (call.ok === true) return 'success'
  if (call.ok === false) return 'error'
  return 'running'
}

const resolveDisplayStatusText = (call: AiToolCallTrace) => TOOL_STATUS_TEXT_MAP[resolveDisplayStatus(call)]

const resolveDisplaySummary = (call: AiToolCallTrace) => {
  const displaySummary = String(call.displaySummary || '').trim()
  if (displaySummary) {
    return displaySummary
  }

  const toolName = String(call.name || '').trim()
  const status = resolveDisplayStatus(call)
  if (toolName === 'read_app_data' && status !== 'skipped') {
    return resolveReadAppDataDisplaySummaryFallback(status, call.input)
  }
  if (status === 'success') {
    return TOOL_SUCCESS_SUMMARY_MAP[toolName] || i18next.t('workbenchAiToolCalls.toolCompleted', { name: resolveDisplayName(call) })
  }
  if (status === 'error') {
    return TOOL_ERROR_SUMMARY_MAP[toolName] || i18next.t('workbenchAiToolCalls.toolIncomplete', { name: resolveDisplayName(call) })
  }
  if (status === 'skipped') {
    return i18next.t('workbenchAiToolCalls.stepSkipped')
  }
  return TOOL_PENDING_SUMMARY_MAP[toolName] || i18next.t('workbenchAiToolCalls.processingTool', { name: resolveDisplayName(call) })
}

const orderedRenderItems = computed<AiToolCallRenderItem[]>(() => {
  if (!props.timeline.length) {
    return renderableCalls.value.map(call => ({
      id: `tool-call-${call.id}`,
      call,
    }))
  }

  const callMap = new Map(renderableCalls.value.map(call => [call.id, call]))
  const interimTextMap = new Map(renderableInterimTexts.value.map(interimText => [interimText.id, interimText]))

  return props.timeline
    .map((item): AiToolCallRenderItem | null => {
      if (item.type === 'tool-call') {
        const call = callMap.get(item.refId)
        return call
          ? {
              id: item.id,
              call,
            }
          : null
      }

      const interimText = interimTextMap.get(item.refId)
      return interimText
        ? {
            id: item.id,
            interimText,
          }
        : null
    })
    .filter((item): item is AiToolCallRenderItem => Boolean(item))
})

const stageResult = computed(() => {
  const stageItems: AiToolStageItem[] = []
  const stageByCallId = new Map<string, AiToolStageItem>()
  const bufferedInterimsByAnchor = new Map<string, AiInterimTextTrace[]>()
  const leadingInterimTexts: AiInterimTextTrace[] = []

  orderedRenderItems.value.forEach(item => {
    if (item.interimText) {
      const anchorCallId = String(item.interimText.anchorCallId || '').trim()
      if (anchorCallId) {
        const matchedStage = stageByCallId.get(anchorCallId)
        if (matchedStage) {
          matchedStage.interimTexts.push(item.interimText)
          return
        }
        const bufferedItems = bufferedInterimsByAnchor.get(anchorCallId) || []
        bufferedItems.push(item.interimText)
        bufferedInterimsByAnchor.set(anchorCallId, bufferedItems)
        return
      }

      if (!stageItems.length) {
        leadingInterimTexts.push(item.interimText)
        return
      }

      stageItems[stageItems.length - 1].interimTexts.push(item.interimText)
      return
    }

    if (!item.call) {
      return
    }

    const stage: AiToolStageItem = {
      id: item.id,
      call: item.call,
      interimTexts: [],
    }
    if (!stageItems.length && leadingInterimTexts.length) {
      stage.interimTexts.push(...leadingInterimTexts.splice(0))
    }
    const bufferedItems = bufferedInterimsByAnchor.get(item.call.id) || []
    if (bufferedItems.length) {
      stage.interimTexts.push(...bufferedItems)
      bufferedInterimsByAnchor.delete(item.call.id)
    }
    stageItems.push(stage)
    stageByCallId.set(item.call.id, stage)
  })

  const orphanInterimTexts = [
    ...leadingInterimTexts,
    ...Array.from(bufferedInterimsByAnchor.values()).reduce<AiInterimTextTrace[]>((result, items) => {
      result.push(...items)
      return result
    }, []),
  ]

  return {
    stageItems,
    orphanInterimTexts,
  }
})

const stageItems = computed(() => stageResult.value.stageItems)
const orphanInterimTexts = computed(() => stageResult.value.orphanInterimTexts)

const formatDuration = (durationMs?: number) => {
  if (!Number.isFinite(Number(durationMs)) || Number(durationMs) < 0) {
    return '--'
  }
  return `${Math.round(Number(durationMs))}ms`
}
</script>

<style scoped lang='scss'>
.ai-tool-calls {
  width: 100%;
}

.ai-tool-calls__item + .ai-tool-calls__item {
  margin-top: 8px;
}

.ai-tool-calls__interims {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.ai-tool-call {
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #f7f8fa;
  overflow: hidden;
}

.ai-tool-call__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
}

.ai-tool-call__title-wrap {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-tool-call__name {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.ai-tool-call__subtitle {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ai-tool-call__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ai-tool-call__tail {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ai-tool-call__status,
.ai-tool-call__duration {
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.ai-tool-call__status {
  padding: 1px 6px;
  border-radius: 999px;
  background: #eef1f5;

  &.is-success {
    color: #0e6245;
    background: #e8ffea;
  }

  &.is-error {
    color: #cb2634;
    background: #ffece8;
  }

  &.is-skipped {
    color: #6b4f00;
    background: #fff7e8;
  }
}

.ai-tool-call__interim {
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #ffffff;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ai-tool-call__interim--orphan {
  margin-top: 8px;
}
</style>
