<template>
  <article
    class="ai-blueprint-workbench-card"
    :class="[
      `is-${card.role}`,
      `is-${card.status}`,
      {
        'is-selected': selected,
        'is-compact': isCompactCard,
      },
    ]"
    role="button"
    tabindex="0"
    :aria-pressed="selected"
    @click="emit('select', card)"
    @keydown.enter.prevent="emit('select', card)"
    @keydown.space.prevent="emit('select', card)"
  >
    <div
      class="ai-blueprint-workbench-card__top-row"
      style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;"
    >
      <div
        class="ai-blueprint-workbench-card__top-main"
        style="min-width:0;flex:1;"
      >
        <div class="ai-blueprint-workbench-card__title-row">
          <span class="ai-blueprint-workbench-card__title-icon">
            <el-icon :size="20"><i-ven-nocode-page-form /></el-icon>
          </span>
          <div class="ai-blueprint-workbench-card__title">{{ card.title }}</div>
          <span
            v-if="showRoleTag"
            class="ai-blueprint-workbench-card__inline-tag ai-blueprint-workbench-card__inline-tag--role"
          >{{ $t('nocodeEditorAiBlueprintWorkbenchCard.mainBlueprint') }}</span>
          <span
            :class="[
              'ai-blueprint-workbench-card__inline-tag',
              'ai-blueprint-workbench-card__inline-tag--status',
              { 'is-applied': isGeneratedCard },
            ]"
          >
            {{ statusTagText }}
          </span>
        </div>
      </div>

      <div
        class="ai-blueprint-workbench-card__top-side"
        style="display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-shrink:0;"
      >
        <span class="ai-blueprint-workbench-card__field-count">{{ fieldCountLabel }}</span>

        <div
          v-if="showActionButton"
          class="ai-blueprint-workbench-card__actions"
          @click.stop
        >
          <el-button
            type="primary"
            link
            :loading="applyingId === card.item.id"
            :disabled="isReviewActionDisabled"
            @click="handleAction"
          >
            {{ actionLabel }}
          </el-button>
        </div>
      </div>
    </div>

    <p
      class="ai-blueprint-workbench-card__summary"
      :class="{ 'is-compact': isCompactCard }"
    >
      {{ summaryText }}
    </p>

    <div
      :class="[
        'ai-blueprint-workbench-card__field-row',
        { 'is-compact': isCompactCard },
      ]"
    >
      <span
        v-for="(field, index) in visibleFields"
        :key="`${field.name}:${index}`"
        class="ai-blueprint-workbench-card__field-chip"
      >
        <span class="ai-blueprint-workbench-card__field-name">{{ field.name }}</span>
      </span>

      <span
        v-if="hasMoreFields"
        class="ai-blueprint-workbench-card__field-chip ai-blueprint-workbench-card__field-chip--more"
        :title="$t('nocodeEditorAiBlueprintWorkbenchCard.fullFieldsSwitchTabTip')"
      >
        ...
      </span>
    </div>

    <div
      :class="[
        'ai-blueprint-workbench-card__footer-shell',
        { 'has-note-panel': showNotePanel },
      ]"
    >
      <div
        v-if="showFooterDivider"
        class="ai-blueprint-workbench-card__footer-divider"
      ></div>

      <div class="ai-blueprint-workbench-card__footer-inline">
        <span class="ai-blueprint-workbench-card__footer-label">{{ footerHeading }}</span>
        <span class="ai-blueprint-workbench-card__footer-separator">｜</span>
        <span class="ai-blueprint-workbench-card__footer-copy">{{ footerText }}</span>
      </div>
    </div>

    <section
      v-if="showNotePanel"
      class="ai-blueprint-workbench-card__note-panel"
    >
      <div class="ai-blueprint-workbench-card__note-panel-title">
        <span class="ai-blueprint-workbench-card__note-panel-icon">
          <el-icon :size="16"><i-ep-warning /></el-icon>
        </span>
        <span class="ai-blueprint-workbench-card__note-panel-heading">{{ notePanelTitle }}</span>
      </div>

      <div class="ai-blueprint-workbench-card__note-panel-divider"></div>

      <div class="ai-blueprint-workbench-card__note-sections">
        <div
          v-for="item in noteItems"
          :key="item.label"
          class="ai-blueprint-workbench-card__note-section"
        >
          <div class="ai-blueprint-workbench-card__note-section-label">{{ item.label }}</div>
          <div class="ai-blueprint-workbench-card__note-section-copy">{{ item.copy }}</div>
        </div>
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import i18next from 'i18next'
import { computed, type PropType } from 'vue'
import type { NocodeEditorAiAppBlueprintField, NocodeEditorAiAppBlueprintForm } from '../types'
import type { BlueprintWorkbenchCard } from '../blueprintWorkbenchViewModel'

const props = defineProps({
  card: {
    type: Object as PropType<BlueprintWorkbenchCard>,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  applyingId: {
    type: String,
    default: '',
  },
  allowApplyAction: {
    type: Boolean,
    default: true,
  },
  allowOpenAction: {
    type: Boolean,
    default: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'apply', 'open'])

const flattenFields = (
  fields: NocodeEditorAiAppBlueprintField[] | undefined,
): NocodeEditorAiAppBlueprintField[] => {
  const source = Array.isArray(fields) ? fields : []
  return source.flatMap((field) => {
    const children = flattenFields(field.children)
    return [field, ...children]
  })
}

const resolveFormIdentity = (form: NocodeEditorAiAppBlueprintForm | undefined) => String(
  form?.formKey || form?.tableName || '',
).trim()

const isSecondaryCard = computed(() => props.card.role === 'secondary')
const isCompactCard = computed(() => props.compact || isSecondaryCard.value)
const previewLimit = computed(() => (isCompactCard.value ? 5 : 12))
const visibleFields = computed(() => props.card.fieldsPreview.slice(0, previewLimit.value))
const hasMoreFields = computed(() => props.card.fieldsPreview.length > previewLimit.value)
const relatedBlueprintCount = computed(() => Math.max((props.card.item.blueprint.forms || []).length - 1, 0))
const sharedFieldCount = computed(() => flattenFields(props.card.form.fields).filter((field) => {
  const source = field.source || {}
  return Boolean(source.formKey || source.formName || source.fieldKey || source.fieldName)
}).length)
const isStagedCard = computed(() => props.card.status === 'staged')
const isGeneratedCard = computed(() => !isStagedCard.value)
const statusTagText = computed(() => props.card.statusText)
const showRoleTag = computed(() => {
  if (isSecondaryCard.value || relatedBlueprintCount.value <= 0) {
    return false
  }

  const firstFormIdentity = resolveFormIdentity(props.card.item.blueprint.forms[0])
  return Boolean(firstFormIdentity && firstFormIdentity === props.card.formKey)
})
const fieldCountLabel = computed(() => (
  i18next.t('nocodeEditorAiBlueprintWorkbenchCard.fieldCount', { count: props.card.fieldCount })
))
const summaryText = computed(() => (
  props.card.summary?.trim()
  || i18next.t('nocodeEditorAiBlueprintWorkbenchCard.defaultSummary', {
    title: props.card.title,
    count: props.card.fieldCount,
  })
))
const footerHeading = computed(() => (
  isStagedCard.value
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchCard.reviewFocus')
    : i18next.t('nocodeEditorAiBlueprintWorkbenchCard.reviewTip')
))
const showFooterDivider = computed(() => true)
const footerText = computed(() => {
  const fieldSourceText = sharedFieldCount.value > 0
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchCard.sharedFieldCount', { count: sharedFieldCount.value })
    : i18next.t('nocodeEditorAiBlueprintWorkbenchCard.localFieldsOnly')

  if (relatedBlueprintCount.value > 0) {
    return i18next.t('nocodeEditorAiBlueprintWorkbenchCard.footerSummaryWithRelated', {
      count: props.card.fieldCount,
      fieldSourceText,
      relatedCount: relatedBlueprintCount.value,
    })
  }

  return i18next.t('nocodeEditorAiBlueprintWorkbenchCard.footerSummary', {
    count: props.card.fieldCount,
    fieldSourceText,
  })
})
const showNotePanel = computed(() => !isCompactCard.value && isStagedCard.value)
const notePanelTitle = computed(() => i18next.t('nocodeEditorAiBlueprintWorkbenchCard.notes'))
const noteItems = computed(() => {
  if (relatedBlueprintCount.value > 0) {
    return [
      {
        label: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.relatedObjects'),
        copy: sharedFieldCount.value > 0
          ? i18next.t('nocodeEditorAiBlueprintWorkbenchCard.relatedImpactWithSharedFields', {
            fieldCount: props.card.fieldCount,
            sharedCount: sharedFieldCount.value,
            relatedCount: relatedBlueprintCount.value,
          })
          : i18next.t('nocodeEditorAiBlueprintWorkbenchCard.relatedImpact', {
            fieldCount: props.card.fieldCount,
            relatedCount: relatedBlueprintCount.value,
          }),
      },
      {
        label: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.changeImpact'),
        copy: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.mainBlueprintChangeImpact'),
      },
    ]
  }

  return [
    {
      label: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.fieldStructure'),
      copy: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.fieldStructureTip', { count: props.card.fieldCount }),
    },
    {
      label: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.changeImpact'),
      copy: i18next.t('nocodeEditorAiBlueprintWorkbenchCard.generateChangeImpact'),
    },
  ]
})
const showActionButton = computed(() => (
  (props.card.mode === 'review' && isStagedCard.value && props.allowApplyAction)
  || (props.card.mode === 'generated' && props.allowOpenAction)
))
const isReviewActionDisabled = computed(() => isStagedCard.value && Boolean(props.applyingId))
const actionLabel = computed(() => (
  props.card.mode === 'generated'
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchCard.viewDetails')
    : i18next.t('nocodeEditorAiBlueprintWorkbenchCard.generateFromBlueprint')
))

const handleAction = () => {
  if (props.card.mode === 'generated') {
    emit('open', props.card)
    return
  }

  if (isReviewActionDisabled.value) {
    return
  }

  emit('apply', props.card)
}
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface);
  box-shadow: none;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.ai-blueprint-workbench-card.is-primary {
  min-height: 396px;
}

.ai-blueprint-workbench-card.is-compact {
  min-height: 124px;
  padding: 10px 12px;
  gap: 10px;
}

.ai-blueprint-workbench-card:hover {
  background: #fbfdff;
}

.ai-blueprint-workbench-card.is-selected {
  border-color: var(--blueprint-border-strong);
  background: #fcfeff;
}

.ai-blueprint-workbench-card__top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.ai-blueprint-workbench-card__top-main {
  min-width: 0;
  flex: 1;
}

.ai-blueprint-workbench-card__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ai-blueprint-workbench-card__title-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--blueprint-brand);
  flex-shrink: 0;
}

.ai-blueprint-workbench-card__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-workbench-card__inline-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}

.ai-blueprint-workbench-card__inline-tag--role {
  background: #e8f6ff;
  color: var(--blueprint-brand);
}

.ai-blueprint-workbench-card__inline-tag--status {
  background: #e8f6ff;
  color: var(--blueprint-brand);
}

.ai-blueprint-workbench-card__inline-tag--status.is-applied {
  background: #f4ffe8;
  color: var(--blueprint-success);
}

.ai-blueprint-workbench-card__top-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.ai-blueprint-workbench-card__field-count {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-tertiary);
  white-space: nowrap;
}

.ai-blueprint-workbench-card__summary {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-card__summary.is-compact {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-blueprint-workbench-card__field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.ai-blueprint-workbench-card__field-row.is-compact {
  flex-wrap: nowrap;
  overflow: hidden;
}

.ai-blueprint-workbench-card__field-chip {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: 0;
  max-width: 120px;
  padding: 2px 8px;
  border-radius: 2px;
  background: #f2f3f5;
}

.ai-blueprint-workbench-card__field-row.is-compact .ai-blueprint-workbench-card__field-chip {
  max-width: 56px;
}

.ai-blueprint-workbench-card__field-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-card__field-chip--more {
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-card__note-panel {
  margin-top: 12px;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--blueprint-warning-border);
  background: rgba(255, 251, 232, 0.4);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-blueprint-workbench-card__note-panel-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ai-blueprint-workbench-card__note-panel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--blueprint-warning);
}

.ai-blueprint-workbench-card__note-panel-heading {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: var(--blueprint-warning);
}

.ai-blueprint-workbench-card__note-panel-divider {
  width: 100%;
  height: 1px;
  background: var(--blueprint-border);
}

.ai-blueprint-workbench-card__note-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px;
}

.ai-blueprint-workbench-card__note-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-blueprint-workbench-card__note-section-label {
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-card__note-section-copy {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-workbench-card__footer-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin-top: auto;
}

.ai-blueprint-workbench-card__footer-shell.has-note-panel {
  gap: 16px;
  margin-top: 0;
}

.ai-blueprint-workbench-card.is-compact .ai-blueprint-workbench-card__footer-shell {
  gap: 8px;
}

.ai-blueprint-workbench-card__footer-divider {
  width: 100%;
  height: 1px;
  background: var(--blueprint-border);
}

.ai-blueprint-workbench-card__footer-inline {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  line-height: 20px;
}

.ai-blueprint-workbench-card__footer-label,
.ai-blueprint-workbench-card__footer-separator {
  flex-shrink: 0;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-card__footer-label {
  font-weight: 600;
}

.ai-blueprint-workbench-card__footer-copy {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-workbench-card__actions {
  flex-shrink: 0;
}

.ai-blueprint-workbench-card__actions :deep(.el-button.is-link) {
  min-height: auto;
  padding: 0;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}

@media (max-width: 1280px) {
  .ai-blueprint-workbench-card__top-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .ai-blueprint-workbench-card__top-side {
    gap: 10px;
  }
}
</style>
