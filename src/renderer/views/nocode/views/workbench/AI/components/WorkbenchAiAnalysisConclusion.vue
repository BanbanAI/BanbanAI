<template>
  <section v-if="hasContent" class="ai-analysis-conclusion">
    <div class="ai-analysis-conclusion__title">{{ title }}</div>
    <div v-if="supportingItems.length" class="ai-analysis-conclusion__supporting-strip">
      <div
        v-for="item in supportingItems"
        :key="item.key"
        class="ai-analysis-conclusion__supporting-pill"
        :class="{ 'is-delta': item.kind === 'delta' }"
      >
        <template v-if="item.kind === 'kpi'">
          <span class="ai-analysis-conclusion__supporting-value">{{ item.value }}</span>
          <span class="ai-analysis-conclusion__supporting-label">{{ item.label }}</span>
        </template>
        <span v-else class="ai-analysis-conclusion__supporting-text">{{ item.text }}</span>
      </div>
    </div>
    <ul class="ai-analysis-conclusion__list">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="ai-analysis-conclusion__item"
      >
        {{ item }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import i18next from 'i18next'
import {
  formatAiAnalysisSupportingKpiLabel,
  type AiAnalysisSupportingData,
} from '../workbenchAiInsightPanelModel'

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  items?: string[]
  supportingData?: AiAnalysisSupportingData | null
}>()

const items = computed(() => Array.isArray(props.items) ? props.items.filter(Boolean) : [])
const title = computed(() => i18next.t('workbenchAiAnalysisConclusion.analysisConclusion'))
const kpiDisplayCopy = computed(() => ({
  recordPrefix: i18next.t('workbenchAiAnalysisConclusion.recordPrefix'),
  recordSuffix: i18next.t('workbenchAiAnalysisConclusion.recordSuffix'),
  defaultRecordLabel: i18next.t('workbenchAiAnalysisConclusion.defaultRecordLabel'),
  groupPrefix: i18next.t('workbenchAiAnalysisConclusion.groupPrefix'),
  defaultGroupLabel: i18next.t('workbenchAiAnalysisConclusion.defaultGroupLabel'),
  combinationSuffix: i18next.t('workbenchAiAnalysisConclusion.combinationSuffix'),
  timeBucketLabels: {
    minute: i18next.t('workbenchAiAnalysisConclusion.timeBucketMinute'),
    hour: i18next.t('workbenchAiAnalysisConclusion.timeBucketHour'),
    day: i18next.t('workbenchAiAnalysisConclusion.timeBucketDay'),
    week: i18next.t('workbenchAiAnalysisConclusion.timeBucketWeek'),
    month: i18next.t('workbenchAiAnalysisConclusion.timeBucketMonth'),
    year: i18next.t('workbenchAiAnalysisConclusion.timeBucketYear'),
  },
}))

const supportingItems = computed(() => {
  const kpis = props.supportingData?.kpis || []
  const deltaLabel = String(props.supportingData?.deltaLabel || '').trim()

  return [
    ...kpis.map(kpi => ({
      key: `kpi-${kpi.key}`,
      kind: 'kpi' as const,
      label: formatAiAnalysisSupportingKpiLabel(kpi, kpiDisplayCopy.value),
      value: kpi.value,
    })),
    ...(deltaLabel ? [{
      key: 'delta',
      kind: 'delta' as const,
      text: deltaLabel,
    }] : []),
  ]
})
const hasContent = computed(() => items.value.length > 0 || supportingItems.value.length > 0)
</script>

<style scoped lang="scss">
.ai-analysis-conclusion {
  --ai-analysis-conclusion-accent: #165dff;
  --ai-analysis-conclusion-surface: linear-gradient(135deg, rgba(22, 93, 255, 0.08), rgba(22, 93, 255, 0.02));
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(22, 93, 255, 0.12);
  border-radius: 12px;
  background: var(--ai-analysis-conclusion-surface);
}

.ai-analysis-conclusion__title {
  margin-bottom: 8px;
  color: var(--ai-analysis-conclusion-accent);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.ai-analysis-conclusion__supporting-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.ai-analysis-conclusion__supporting-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(22, 93, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #1d2129;
}

.ai-analysis-conclusion__supporting-pill.is-delta {
  max-width: 100%;
  border-style: dashed;
  color: #4e5969;
}

.ai-analysis-conclusion__supporting-value {
  color: var(--ai-analysis-conclusion-accent);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.ai-analysis-conclusion__supporting-label,
.ai-analysis-conclusion__supporting-text {
  font-size: 12px;
  line-height: 18px;
}

.ai-analysis-conclusion__supporting-text {
  white-space: normal;
  word-break: break-word;
}

.ai-analysis-conclusion__list {
  margin: 0;
  padding-left: 18px;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.ai-analysis-conclusion__item::marker {
  color: var(--ai-analysis-conclusion-accent);
}

.ai-analysis-conclusion__item + .ai-analysis-conclusion__item {
  margin-top: 6px;
}
</style>
