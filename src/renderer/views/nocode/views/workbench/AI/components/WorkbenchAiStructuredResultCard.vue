<template>
  <div ref="cardRootRef" class="ai-structured-result-card" :class="{ 'is-preview': previewMode }">
    <div v-if="sectionTitle || title || expandable || primaryViewItems.length" class="ai-structured-result-card__header">
      <div v-if="sectionTitle || title || expandable" class="ai-structured-result-card__header-top">
        <div
          v-if="sectionTitle || title"
          class="ai-structured-result-card__title-wrap"
          :title="title || sectionTitle || ''"
        >
          <span
            v-if="sectionTitle && title && sectionTitle !== title"
            class="ai-structured-result-card__section-tag"
          >
            {{ sectionTitle }}
          </span>
          <span class="ai-structured-result-card__title">{{ title || sectionTitle }}</span>
        </div>
        <el-button
          v-if="expandable"
          :class="['ai-structured-result-card__expand', expandButtonClass]"
          :aria-label="resolvedExpandPreviewLabel"
          @click="$emit('expand')"
        >
          <el-icon :size="14" class="ai-structured-result-card__expand-icon">
            <i-ep-full-screen v-if="expandIconName === 'i-ep-full-screen'" />
            <component :is="expandIconName" v-else />
          </el-icon>
          <span class="ai-structured-result-card__expand-text">{{ resolvedExpandPreviewLabel }}</span>
        </el-button>
      </div>
      <div v-if="primaryViewItems.length" class="ai-structured-result-card__switch-row">
        <div class="ai-structured-result-card__switch">
          <button
            v-for="item in primaryViewItems"
            :key="item.key"
            type="button"
            class="ai-structured-result-card__switch-item"
            :class="{
              'is-active': item.key === activePrimaryViewKey,
              'is-disabled': !item.enabled,
            }"
            :disabled="!item.enabled"
            :title="resolvePrimaryViewDisabledReason(item.disabledReason)"
            @click="handlePrimaryViewSelect(item.key)"
          >
            {{ resolvePrimaryViewLabel(item.key) }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="notice" class="ai-structured-result-card__notice">{{ notice }}</div>
    <div v-if="$slots.supporting" class="ai-structured-result-card__supporting workbench-ai-analysis-conclusion-layer">
      <slot name="supporting" />
    </div>
    <div class="ai-structured-result-card__main">
      <slot />
    </div>
    <div
      v-if="$slots.meta"
      ref="metaSectionRef"
      class="ai-structured-result-card__meta"
      tabindex="-1"
    >
      <slot name="meta" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiAssistantPrimaryViewKey, AiAssistantPrimaryViews } from '@common/types/ai'
import { computed, nextTick, ref } from 'vue'
import i18next from 'i18next'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  title?: string
  sectionTitle?: string
  notice?: string
  primaryViews?: AiAssistantPrimaryViews
  modelValue?: AiAssistantPrimaryViewKey
  expandable?: boolean
  previewMode?: boolean
  expandLabel?: string
  expandIconName?: string
  expandButtonClass?: string
}>(), {
  title: '',
  sectionTitle: '',
  notice: '',
  primaryViews: undefined,
  modelValue: undefined,
  expandable: true,
  previewMode: false,
  expandLabel: '',
  expandIconName: 'i-ep-full-screen',
  expandButtonClass: '',
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: AiAssistantPrimaryViewKey): void
  (event: 'expand'): void
}>()

const cardRootRef = ref<HTMLDivElement | null>(null)
const metaSectionRef = ref<HTMLDivElement | null>(null)
const resolvedExpandPreviewLabel = computed(() => (
  props.expandLabel || i18next.t('workbenchAiStructuredResultCard.expandPreview')
))

const primaryViewItems = computed(() => props.primaryViews?.items || [])
const activePrimaryViewKey = computed<AiAssistantPrimaryViewKey>(() => (
  props.modelValue
  || props.primaryViews?.defaultKey
  || 'table'
))

const resolvePrimaryViewLabel = (key: AiAssistantPrimaryViewKey) => (
  key === 'chart'
    ? i18next.t('workbenchAiStructuredResultCard.chart')
    : i18next.t('workbenchAiStructuredResultCard.dataTable')
)

const CHART_DISABLED_REASON_LABELS: Record<string, string> = {
  get user_disabled_chart() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.user_disabled_chart') },
  get multi_metric_deferred() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.multi_metric_deferred') },
  get multi_dimension_too_complex() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.multi_dimension_too_complex') },
  get single_value_no_chart_needed() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.single_value_no_chart_needed') },
  get too_few_rows() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.too_few_rows') },
  get too_many_rows_without_topn() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.too_many_rows_without_topn') },
  get explicit_scatter_requires_two_metrics() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.explicit_scatter_requires_two_metrics') },
  get explicit_chart_kind_requires_single_metric() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.explicit_chart_kind_requires_single_metric') },
  get table_only_result() { return i18next.t('WorkbenchAiChat.chartDisabledReasons.table_only_result') },
}

const resolvePrimaryViewDisabledReason = (disabledReason?: string) => {
  const reasonCode = String(disabledReason || '').trim()
  if (!reasonCode) {
    return ''
  }

  return CHART_DISABLED_REASON_LABELS[reasonCode] || reasonCode
}

const handlePrimaryViewSelect = (key: AiAssistantPrimaryViewKey) => {
  const item = primaryViewItems.value.find(view => view.key === key)
  if (!item?.enabled || key === activePrimaryViewKey.value) {
    return
  }

  emit('update:modelValue', key)
}

const focusMetaSection = async () => {
  const targetElement = metaSectionRef.value || cardRootRef.value
  if (!targetElement) {
    return
  }

  await nextTick()
  targetElement.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
  })

  if (metaSectionRef.value) {
    metaSectionRef.value.focus({ preventScroll: true })
  }
}

defineExpose({
  focusMetaSection,
})
</script>

<style scoped lang="scss">
.ai-structured-result-card {
  --ai-structured-card-border: #dce4f2;
  --ai-structured-card-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
  --ai-structured-card-surface: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  --ai-structured-card-text: #1d2129;
  --ai-structured-card-subtle: #4e5969;
  --ai-structured-card-divider: rgba(78, 89, 105, 0.14);
  width: 100%;
  padding: 14px;
  border: 1px solid var(--ai-structured-card-border);
  border-radius: 14px;
  background: var(--ai-structured-card-surface);
  box-shadow: var(--ai-structured-card-shadow);
}

.ai-structured-result-card__header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-bottom: 14px;
}

.ai-structured-result-card__header-top {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.ai-structured-result-card__title-wrap {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-structured-result-card__section-tag {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
}

.ai-structured-result-card__title {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ai-structured-card-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: normal;
}

.ai-structured-result-card__switch-row {
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: center;
  min-width: 0;
}

.ai-structured-result-card__switch {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border: 1px solid rgba(29, 33, 41, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}

.ai-structured-result-card__switch-item {
  min-width: 84px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ai-structured-card-subtle);
  padding: 4px 12px;
  font-size: 12px;
  line-height: 18px;
  cursor: var(--cursor-pointer);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.ai-structured-result-card__switch-item.is-active {
  background: #165dff;
  color: #fff;
}

.ai-structured-result-card__switch-item.is-disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.ai-structured-result-card__expand {
  margin-left: auto;
  flex-shrink: 0;
  height: auto;
  border: 1px solid rgba(29, 33, 41, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--ai-structured-card-subtle);
  padding: 4px 10px;
}

.ai-structured-result-card__expand:hover {
  background: #f5f7fb;
  color: var(--ai-structured-card-text);
}

.ai-structured-result-card__expand-icon {
  margin-right: 4px;
}

.ai-structured-result-card__expand-text {
  font-size: 12px;
  line-height: 18px;
}

.ai-structured-result-card__notice {
  margin: 0 0 12px;
  color: var(--ai-structured-card-subtle);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.ai-structured-result-card__supporting {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.ai-structured-result-card__main {
  width: 100%;
  min-width: 0;
}

.ai-structured-result-card__meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--ai-structured-card-divider);
}

.ai-structured-result-card.is-preview {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
}

.ai-structured-result-card.is-preview .ai-structured-result-card__main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
