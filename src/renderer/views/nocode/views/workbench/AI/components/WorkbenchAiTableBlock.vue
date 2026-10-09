<template>
  <div class="ai-table-block" :class="{ 'is-preview': previewMode }">
    <WorkbenchAiStructuredResultCard
      v-model="activePrimaryViewKey"
      class="ai-table-block__card"
      :title="block.title || ''"
      :section-title="dataDetailsTitle"
      :notice="resolveMergedNotice"
      :primary-views="resolvedPrimaryViews"
      :expand-label="expandPreviewLabel"
      :expandable="expandable"
      :preview-mode="previewMode"
      @expand="handleExpand"
    >
      <template v-if="hasSupportingContent" #supporting>
        <workbench-ai-analysis-conclusion
          class="ai-table-block__conclusion"
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
      <WorkbenchAiTableBody
        ref="tableBodyRef"
        :block="block"
        :initial-view-key="initialTableViewKey"
        @update:view-key="activeTableViewKey = $event"
      />
    </WorkbenchAiStructuredResultCard>
  </div>
</template>

<script setup lang="ts">
import type { AiAssistantTableBlock } from '@common/types/ai'
import { resolveAiAssistantPresentationNotice } from '@common/utils/aiMessageBlocks'
import { computed, ref } from 'vue'
import WorkbenchAiAnalysisConclusion from './WorkbenchAiAnalysisConclusion.vue'
import WorkbenchAiInsightEvidenceMeta from './WorkbenchAiInsightEvidenceMeta.vue'
import WorkbenchAiStructuredResultCard from './WorkbenchAiStructuredResultCard.vue'
import WorkbenchAiTableBody from './WorkbenchAiTableBody.vue'
import type { AiAnalysisEvidenceSummary } from '../workbenchAiInsightPanelModel'
import { useAiInsightMetaAnchor } from '../useAiInsightMetaAnchor'
import { useReactiveI18next } from '../useReactiveI18next'
import type { ShadowMarkdownRouteTarget } from '../shadowMarkdownRoute'

type TableExpandPayload = {
  title: string
  tableHtml: string
  tableText: string
  tableViewKey: string
}

type TableBodyExpose = {
  buildExpandPayload: () => TableExpandPayload
}

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  block: AiAssistantTableBlock
  evidence?: AiAnalysisEvidenceSummary | null
  leadingSummaryText?: string
  expandable?: boolean
  previewMode?: boolean
  initialTableViewKey?: string
}>(), {
  evidence: null,
  leadingSummaryText: '',
  expandable: true,
  previewMode: false,
  initialTableViewKey: '',
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'expand', payload: {
    title: string
    tableHtml: string
    tableText: string
    tableViewKey: string
    evidence: AiAnalysisEvidenceSummary | null
    leadingSummaryText: string
  }): void
  (event: 'route-click', target: ShadowMarkdownRouteTarget): void
}>()

const tableBodyRef = ref<TableBodyExpose | null>(null)
const analysisConclusionItems = computed(() => props.block.analysisConclusion?.items || [])
const structuredSupportingData = computed(() => props.block.analysisConclusion?.supportingData || null)
const {
  supportingData,
  hasSupportingContent,
} = useAiInsightMetaAnchor({
  structuredSupportingData,
  analysisConclusionItems,
})
const activePrimaryViewKey = ref<'table'>('table')
const activeTableViewKey = ref(props.initialTableViewKey || props.block.views?.defaultKey || 'base')
const { translate } = useReactiveI18next()
const expandPreviewLabel = translate('WorkbenchAiChat.expandPreview')
const dataDetailsTitle = translate('DataSourceViewer.dataDetails')
const presentationNotice = computed(() => resolveAiAssistantPresentationNotice(props.block.presentation))
const resolveMergedNotice = computed(() => {
  const summaryText = String(props.leadingSummaryText || '').trim()
  const noticeText = String(presentationNotice.value || '').trim()
  return [summaryText, noticeText].filter(Boolean).join('\n')
})
const resolvedPrimaryViews = computed(() => (
  props.block.primaryViews || {
    defaultKey: 'table' as const,
    items: [
      { key: 'chart' as const, enabled: false, disabledReason: 'table_only_result' },
      { key: 'table' as const, enabled: true },
    ],
  }
))
const initialTableViewKey = computed(() => (
  props.initialTableViewKey || activeTableViewKey.value || props.block.views?.defaultKey || 'base'
))

const handleExpand = () => {
  const payload = tableBodyRef.value?.buildExpandPayload()
  if (!payload) {
    return
  }

  activeTableViewKey.value = payload.tableViewKey
  emit('expand', {
    title: payload.title,
    tableHtml: payload.tableHtml,
    tableText: payload.tableText,
    tableViewKey: payload.tableViewKey,
    evidence: props.evidence || null,
    leadingSummaryText: props.leadingSummaryText || '',
  })
}

</script>

<style scoped lang="scss">
.ai-table-block {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-table-block.is-preview {
  height: 100%;
  min-height: 100%;
}

.ai-table-block__conclusion {
  width: 100%;
}

.ai-table-block__card {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}
</style>
