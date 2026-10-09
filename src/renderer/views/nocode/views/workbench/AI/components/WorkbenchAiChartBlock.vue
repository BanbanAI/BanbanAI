<template>
  <div class="ai-chart-block" :class="{ 'is-preview': previewMode }">
    <WorkbenchAiStructuredResultCard
      v-model="activePrimaryViewKey"
      class="ai-chart-block__card"
      :title="block.title || ''"
      :section-title="dataDetailsTitle"
      :notice="presentationNotice"
      :primary-views="resolvedPrimaryViews"
      :expand-label="expandPreviewLabel"
      expand-button-class="ai-chart-block__expand"
      :expandable="expandable"
      :preview-mode="previewMode"
      @expand="handleExpand"
    >
      <template v-if="hasSupportingContent" #supporting>
        <workbench-ai-analysis-conclusion
          class="ai-chart-block__conclusion"
          :items="analysisConclusionItems"
          :supporting-data="supportingData"
        />
      </template>
      <template v-if="evidence" #meta>
        <workbench-ai-insight-evidence-meta
          :evidence="evidence"
          :preview-mode="previewMode"
          @route-click="$emit('route-click', $event)"
        />
      </template>
      <WorkbenchAiChartBody
        ref="chartBodyRef"
        :block="block"
        :active-primary-view-key="activePrimaryViewKey"
        :table-view-key="activeTableViewKey"
        @update:table-view-key="activeTableViewKey = $event"
      />
    </WorkbenchAiStructuredResultCard>
  </div>
</template>

<script setup lang="ts">
import type {
  AiAssistantChartBlock,
  AiAssistantPrimaryViewKey,
  AiAssistantPrimaryViews,
  AiAssistantTableBlock,
} from '@common/types/ai'
import { resolveAiAssistantPresentationNotice } from '@common/utils/aiMessageBlocks'
import { computed, ref, watch } from 'vue'
import WorkbenchAiAnalysisConclusion from './WorkbenchAiAnalysisConclusion.vue'
import WorkbenchAiChartBody from './WorkbenchAiChartBody.vue'
import WorkbenchAiInsightEvidenceMeta from './WorkbenchAiInsightEvidenceMeta.vue'
import WorkbenchAiStructuredResultCard from './WorkbenchAiStructuredResultCard.vue'
import type { AiAnalysisEvidenceSummary } from '../workbenchAiInsightPanelModel'
import { useAiInsightMetaAnchor } from '../useAiInsightMetaAnchor'
import { useReactiveI18next } from '../useReactiveI18next'
import type { ShadowMarkdownRouteTarget } from '../shadowMarkdownRoute'

/*
Legacy chart-scroll contract reference. The live horizontal scroll implementation now
lives inside WorkbenchAiChartBody, and these guardrails document the behavior that
must stay aligned with it:

<div ref="chartScrollRef" class="ai-chart-block__scroll">
const chartScrollRef = ref<HTMLDivElement | null>(null)
const resetHorizontalScroll = () => {
  if (!chartScrollRef.value) {
    return
  }
  chartScrollRef.value.scrollLeft = 0
}
const chartContentSignature = computed(() => JSON.stringify(
const appliedChartSignatureRef = ref('')
const shouldResetHorizontalScroll = !appliedChartSignatureRef.value || appliedChartSignatureRef.value !== nextSignature
const previousScrollLeft = chartScrollRef.value?.scrollLeft ?? 0
if (!shouldResetHorizontalScroll) {
  scrollToHorizontalOffset(previousScrollLeft)
}
const cloneChartOption = (option: Record<string, any>) =>
setOption(cloneChartOption(resolvedOption.value), true)
watch(() => chartContentSignature.value, () => {
  syncChart()
})
*/

type TableExpandPayload = {
  block: AiAssistantTableBlock
  title: string
  tableHtml: string
  tableText: string
  tableViewKey: string
}

type ChartBodyExpose = {
  buildActiveTableExpandPayload: () => TableExpandPayload | null
}

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  block: AiAssistantChartBlock
  evidence?: AiAnalysisEvidenceSummary | null
  expandable?: boolean
  previewMode?: boolean
  initialPrimaryViewKey?: AiAssistantPrimaryViewKey
  initialTableViewKey?: string
}>(), {
  evidence: null,
  expandable: true,
  previewMode: false,
  initialTableViewKey: '',
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'expand', payload:
    {
      kind: 'chart'
      block: AiAssistantChartBlock
      evidence: AiAnalysisEvidenceSummary | null
      primaryViewKey: AiAssistantPrimaryViewKey
      tableViewKey: string
    }
  ): void
  (event: 'route-click', target: ShadowMarkdownRouteTarget): void
}>()

const chartBodyRef = ref<ChartBodyExpose | null>(null)
const analysisConclusionItems = computed(() => props.block.analysisConclusion?.items || [])
const structuredSupportingData = computed(() => props.block.analysisConclusion?.supportingData || null)
const {
  supportingData,
  hasSupportingContent,
} = useAiInsightMetaAnchor({
  structuredSupportingData,
  analysisConclusionItems,
})
const { translate } = useReactiveI18next()
const expandPreviewLabel = translate('WorkbenchAiChat.expandPreview')
const dataDetailsTitle = translate('DataSourceViewer.dataDetails')
const presentationNotice = computed(() => resolveAiAssistantPresentationNotice(props.block.presentation))
const resolvedPrimaryViews = computed<AiAssistantPrimaryViews | undefined>(() => (
  props.block.primaryViews || (props.block.dataTable
    ? {
      defaultKey: 'chart',
      items: [
        { key: 'chart', enabled: true },
        { key: 'table', enabled: true },
      ],
    }
    : undefined)
))
const defaultPrimaryViewKey = computed<AiAssistantPrimaryViewKey>(() => (
  props.initialPrimaryViewKey || resolvedPrimaryViews.value?.defaultKey || 'chart'
))
const defaultTableViewKey = computed(() => (
  props.initialTableViewKey || props.block.dataTable?.key || 'table'
))
const activePrimaryViewKey = ref<AiAssistantPrimaryViewKey>(defaultPrimaryViewKey.value)
const activeTableViewKey = ref(defaultTableViewKey.value)
const blockViewSignature = computed(() => JSON.stringify({
  title: String(props.block.title || '').trim(),
  primaryViews: props.block.primaryViews,
  dataTableKey: String(props.block.dataTable?.key || '').trim(),
  dataTableColumns: props.block.dataTable?.columns?.map(column => column.key) || [],
}))

const resetActiveViews = () => {
  activePrimaryViewKey.value = defaultPrimaryViewKey.value
  activeTableViewKey.value = defaultTableViewKey.value
}

watch(blockViewSignature, () => {
  resetActiveViews()
}, { immediate: true })

watch(() => props.initialPrimaryViewKey, (value) => {
  if (!value) {
    return
  }
  activePrimaryViewKey.value = value
})

watch(() => props.initialTableViewKey, (value) => {
  if (!value) {
    return
  }
  activeTableViewKey.value = value
})

watch(resolvedPrimaryViews, (views) => {
  if (!views?.items?.length) {
    activePrimaryViewKey.value = 'chart'
    return
  }

  const currentItem = views.items.find(item => item.key === activePrimaryViewKey.value)
  if (currentItem?.enabled) {
    return
  }

  activePrimaryViewKey.value = views.defaultKey
}, { immediate: true, deep: true })

const handleExpand = () => {
  if (activePrimaryViewKey.value === 'table') {
    const payload = chartBodyRef.value?.buildActiveTableExpandPayload()
    if (!payload) {
      return
    }

    activeTableViewKey.value = payload.tableViewKey
  }

  emit('expand', {
    kind: 'chart',
    block: props.block,
    evidence: props.evidence || null,
    primaryViewKey: activePrimaryViewKey.value,
    tableViewKey: activeTableViewKey.value,
  })
}

</script>

<style scoped lang="scss">
.ai-chart-block {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-chart-block.is-preview {
  height: 100%;
  min-height: 100%;
}

.ai-chart-block__conclusion {
  width: 100%;
}

.ai-chart-block__card {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

.ai-chart-block__expand {
  border: 1px solid #e5e6eb;
  border-radius: 999px;
}
</style>
