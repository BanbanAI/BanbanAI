<template>
  <div class="ai-blueprint-detail-sections">
    <section
      v-for="entry in visibleEntries"
      :id="entry.anchorId"
      :key="entry.anchorId"
      class="ai-blueprint-detail-sections__form-section"
    >
      <div class="ai-blueprint-detail-sections__form-header">
        <div class="ai-blueprint-detail-sections__form-main">
          <div class="ai-blueprint-detail-sections__form-title-row">
            <h3 class="ai-blueprint-detail-sections__form-title">{{ entry.form.tableName }}</h3>
            <span
              v-if="entry.form.groupName"
              class="ai-blueprint-detail-sections__group-tag"
            >
              {{ entry.form.groupName }}
            </span>
          </div>
          <p
            v-if="entry.form.description"
            class="ai-blueprint-detail-sections__form-description"
          >
            {{ entry.form.description }}
          </p>
        </div>
        <div class="ai-blueprint-detail-sections__form-meta">
          <span class="ai-blueprint-detail-sections__meta-pill">
            {{ getFieldCount(entry.form) }}{{ $t('nocodeEditorAiBlueprintDetailSections.fields') }}</span>
        </div>
      </div>

      <div class="ai-blueprint-detail-sections__field-grid">
        <article
          v-for="fieldEntry in entry.fieldEntries"
          :key="fieldEntry.key"
          class="ai-blueprint-detail-sections__field-card"
          :class="{ 'is-child': fieldEntry.depth > 0 }"
        >
          <div
            v-if="fieldEntry.parentPath.length"
            class="ai-blueprint-detail-sections__field-parent"
          >{{ $t('nocodeEditorAiBlueprintDetailSections.belongsToLabel') }}{{ fieldEntry.parentPath.join(' / ') }}
          </div>
          <div class="ai-blueprint-detail-sections__field-head">
            <div class="ai-blueprint-detail-sections__field-main">
              <div class="ai-blueprint-detail-sections__field-title-row">
                <div class="ai-blueprint-detail-sections__field-name">{{ fieldEntry.field.name }}</div>
                <div class="ai-blueprint-detail-sections__field-tags">
                  <span
                    v-if="fieldEntry.field.required"
                    class="ai-blueprint-detail-sections__field-tag"
                  >{{ $t('nocodeEditorAiBlueprintDetailSections.required') }}</span>
                  <span
                    v-if="fieldEntry.depth > 0"
                    class="ai-blueprint-detail-sections__field-tag is-child"
                  >{{ $t('nocodeEditorAiBlueprintDetailSections.childField') }}</span>
                  <span
                    v-if="fieldEntry.field.source?.formName || fieldEntry.field.source?.fieldName"
                    class="ai-blueprint-detail-sections__field-tag is-shared"
                  >{{ $t('nocodeEditorAiBlueprintDetailSections.sharedField') }}</span>
                  <span
                    v-if="fieldEntry.field.enumOptions?.length"
                    class="ai-blueprint-detail-sections__field-tag is-link"
                  >
                    {{ fieldEntry.field.enumOptions.length }}{{ $t('nocodeEditorAiBlueprintDetailSections.optionCountSuffix') }}</span>
                  <span
                    v-if="fieldEntry.field.children?.length"
                    class="ai-blueprint-detail-sections__field-tag is-children"
                  >
                    {{ fieldEntry.field.children.length }}{{ $t('nocodeEditorAiBlueprintDetailSections.childFieldCountSuffix') }}</span>
                  <span
                    v-if="fieldEntry.field.formulaSettings?.length"
                    class="ai-blueprint-detail-sections__field-tag is-formula"
                  >{{ resolveNocodeEditorFormulaCountLabel(fieldEntry.field.formulaSettings.length) }}</span>
                  <span
                    v-if="hasBlueprintDefaultValue(fieldEntry.field)"
                    class="ai-blueprint-detail-sections__field-tag is-default"
                  >{{ $t('nocodeEditorAiBlueprintDetailSections.defaultValue') }}</span>
                </div>
              </div>
              <p
                v-if="fieldEntry.field.description"
                class="ai-blueprint-detail-sections__field-description"
              >
                {{ fieldEntry.field.description }}
              </p>
              <div
                v-if="hasBlueprintDefaultValue(fieldEntry.field)"
                class="ai-blueprint-detail-sections__default-value-line"
              >
                <span class="ai-blueprint-detail-sections__default-value-label">
                  {{ $t('nocodeEditorAiBlueprintDetailSections.defaultValue') }}
                </span>
                <span class="ai-blueprint-detail-sections__default-value-content">
                  {{ formatBlueprintDefaultValue(fieldEntry.field.defaultValue) }}
                </span>
              </div>
              <div
                v-if="fieldEntry.field.formulaSettings?.length"
                class="ai-blueprint-detail-sections__formula-lines"
              >
                <div
                  v-for="formulaSetting in fieldEntry.field.formulaSettings"
                  :key="`${formulaSetting.formulaPath}:${formulaSetting.formula}`"
                  class="ai-blueprint-detail-sections__formula-line"
                >
                  <span class="ai-blueprint-detail-sections__formula-path">{{ resolveNocodeEditorFormulaPathLabel(formulaSetting.formulaPath) }}</span>
                  <code class="ai-blueprint-detail-sections__formula-expression">{{ formulaSetting.formula }}</code>
                  <span
                    v-if="formulaSetting.explanation"
                    class="ai-blueprint-detail-sections__formula-explanation"
                  >{{ formulaSetting.explanation }}</span>
                </div>
              </div>
              <div
                v-if="fieldEntry.field.formulaSettings?.length && resolveFormulaTargetResults(entry.form, fieldEntry.field).length"
                class="ai-blueprint-detail-sections__formula-result-lines"
              >
                <div
                  v-for="formulaTargetResult in resolveFormulaTargetResults(entry.form, fieldEntry.field)"
                  :key="`${formulaTargetResult.itemKey}:${formulaTargetResult.formulaPath || ''}`"
                  :class="[
                    'ai-blueprint-detail-sections__formula-result',
                    `is-${formulaTargetResult.status}`,
                  ]"
                >
                  <span class="ai-blueprint-detail-sections__formula-result-status">
                    {{ resolveNocodeEditorFormulaTargetStatusLabel(formulaTargetResult.status) }}
                  </span>
                  <span
                    v-if="formulaTargetResult.reason"
                    class="ai-blueprint-detail-sections__formula-result-reason"
                  >{{ formulaTargetResult.reason }}</span>
                </div>
              </div>
            </div>
            <span
              v-if="getFieldTypeLabel(fieldEntry.field.widgetType)"
              class="ai-blueprint-detail-sections__field-type"
            >
              {{ getFieldTypeLabel(fieldEntry.field.widgetType) }}
            </span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { resolveBlueprintWidgetTypeLabel } from '@common/utils/nocodeEditorBlueprintWidgetLabel'
import { resolveSupportedBlueprintWidgetType } from '../blueprintWidgetTypeSupport'
import {
  resolveNocodeEditorFormulaCountLabel,
  resolveNocodeEditorFormulaPathLabel,
  resolveNocodeEditorFormulaTargetStatusLabel,
} from '../formulaPlanPresentation'
import type {
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiBlueprintApplyFormResult,
} from '../types'
import type { NocodeEditorFormulaTargetResult } from '@common/types/nocodeEditorFormula'

type BlueprintDetailFormEntry = {
  anchorId: string
  form: NocodeEditorAiAppBlueprintForm
  fieldEntries: BlueprintDetailFieldEntry[]
  formKey: string
}

type BlueprintDetailFieldEntry = {
  depth: number
  field: NocodeEditorAiAppBlueprintField
  key: string
  parentPath: string[]
}

const props = defineProps({
  forms: {
    type: Array as PropType<NocodeEditorAiAppBlueprintForm[]>,
    default: () => [],
  },
  formulaApplyForms: {
    type: Array as PropType<NocodeEditorAiBlueprintApplyFormResult[]>,
    default: () => [],
  },
  selectedFormKey: {
    type: String,
    default: '',
  },
  anchorPrefix: {
    type: String,
    default: 'blueprint-detail-form',
  },
  focusSelectedOnly: {
    type: Boolean,
    default: false,
  },
})

const normalizeText = (value: unknown, fallback = '') => {
  const text = String(value || '').trim()
  return text || fallback
}

const flattenFormFields = (
  fields: NocodeEditorAiAppBlueprintField[] | undefined,
  parentPath: string[] = [],
): BlueprintDetailFieldEntry[] => {
  const source = Array.isArray(fields) ? fields : []
  return source.flatMap((field, index) => {
    const fieldName = normalizeText(field.name, `field-${index}`)
    const currentPath = [...parentPath, fieldName]
    return [
      {
        depth: parentPath.length,
        field,
        key: `${normalizeText(field.fieldKey, fieldName)}::${currentPath.join('>')}::${index}`,
        parentPath,
      },
      ...flattenFormFields(field.children, currentPath),
    ]
  })
}

const resolveFormKey = (form: NocodeEditorAiAppBlueprintForm, index: number) => (
  normalizeText(form.formKey || form.tableName, `form-${index}`)
)

const formEntries = computed<BlueprintDetailFormEntry[]>(() => (
  (props.forms || []).map((form, index) => ({
    anchorId: `${props.anchorPrefix}-${index}`,
    fieldEntries: flattenFormFields(form.fields),
    form,
    formKey: resolveFormKey(form, index),
  }))
))

const visibleEntries = computed(() => {
  if (!props.focusSelectedOnly) {
    return formEntries.value
  }

  const selectedFormKey = normalizeText(props.selectedFormKey)
  const matchedEntry = formEntries.value.find(entry => entry.formKey === selectedFormKey)
  if (matchedEntry) {
    return [matchedEntry]
  }

  return formEntries.value.slice(0, 1)
})

const getFieldCount = (form: NocodeEditorAiAppBlueprintForm) => flattenFormFields(form.fields).length

const hasBlueprintDefaultValue = (field: NocodeEditorAiAppBlueprintField) => (
  field.defaultValue !== undefined
)

const formatBlueprintDefaultValue = (value: NocodeEditorAiAppBlueprintField['defaultValue']) => (
  Array.isArray(value) ? value.join(', ') : String(value)
)

const resolveFormulaApplyForm = (form: NocodeEditorAiAppBlueprintForm) => {
  const formKey = normalizeText(form.formKey || form.tableName)
  const tableName = normalizeText(form.tableName)
  return (props.formulaApplyForms || []).find(result => (
    normalizeText(result.formKey) === formKey
    || normalizeText(result.tableName) === tableName
  ))
}

const resolveFormulaTargetResults = (
  form: NocodeEditorAiAppBlueprintForm,
  field: NocodeEditorAiAppBlueprintField,
): NocodeEditorFormulaTargetResult[] => {
  const formResult = resolveFormulaApplyForm(form)
  const fieldKey = normalizeText(field.fieldKey || field.name)
  const itemKey = `${normalizeText(form.formKey || form.tableName)}:${fieldKey}:${field.name}`
  return (formResult?.formulaApply?.targetResults || []).filter(result => (
    result.itemKey === itemKey
    || (!fieldKey && normalizeText(result.fieldName) === normalizeText(field.name))
  ))
}

const getFieldTypeLabel = (widgetType?: string) => {
  const normalized = String(widgetType || '').trim()
  if (!normalized) {
    return ''
  }

  const exactLabel = resolveBlueprintWidgetTypeLabel(normalized)
  if (exactLabel) {
    return exactLabel
  }

  const resolvedWidgetType = resolveSupportedBlueprintWidgetType({
    requestedType: normalized,
  })

  return resolveBlueprintWidgetTypeLabel(resolvedWidgetType.widgetType)
}
</script>

<style scoped lang="scss">
.ai-blueprint-detail-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-blueprint-detail-sections__form-section {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--blueprint-border);
  background: var(--blueprint-surface);
  box-shadow: none;
}

.ai-blueprint-detail-sections__form-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.ai-blueprint-detail-sections__form-main {
  min-width: 0;
  flex: 1;
}

.ai-blueprint-detail-sections__form-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-blueprint-detail-sections__form-title {
  margin: 0;
  font-size: 15px;
  line-height: 24px;
  font-weight: 700;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-detail-sections__group-tag,
.ai-blueprint-detail-sections__meta-pill,
.ai-blueprint-detail-sections__field-type,
.ai-blueprint-detail-sections__field-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  white-space: nowrap;
}

.ai-blueprint-detail-sections__group-tag,
.ai-blueprint-detail-sections__field-type {
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
  background: #eef6ff;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-detail-sections__meta-pill {
  padding: 2px 8px;
  background: #f7f8fa;
  color: var(--blueprint-text-tertiary);
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}

.ai-blueprint-detail-sections__form-description,
.ai-blueprint-detail-sections__field-description,
.ai-blueprint-detail-sections__field-parent {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-detail-sections__field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-blueprint-detail-sections__field-card {
  border-radius: 6px;
  border: 0;
  background: #f7f8fa;
  padding: 12px;
}

.ai-blueprint-detail-sections__field-card.is-child {
  background: #f2f7ff;
}

.ai-blueprint-detail-sections__field-parent {
  margin-bottom: 8px;
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-detail-sections__field-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-blueprint-detail-sections__field-main {
  min-width: 0;
  flex: 1;
}

.ai-blueprint-detail-sections__field-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-blueprint-detail-sections__field-name {
  font-size: 12px;
  line-height: 20px;
  font-weight: 700;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-detail-sections__field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-blueprint-detail-sections__field-tag {
  padding: 0 4px;
  background: transparent;
  border: 0;
  font-size: 11px;
  line-height: 20px;
  font-weight: 600;
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-detail-sections__field-tag.is-shared {
  color: var(--blueprint-brand);
}

.ai-blueprint-detail-sections__field-tag.is-child {
  color: #64748b;
}

.ai-blueprint-detail-sections__field-tag.is-link {
  color: #f59e0b;
}

.ai-blueprint-detail-sections__field-tag.is-children {
  color: #0f766e;
}

.ai-blueprint-detail-sections__field-tag.is-formula {
  color: #7c3aed;
}

.ai-blueprint-detail-sections__field-tag.is-default,
.ai-blueprint-detail-sections__default-value-label {
  color: #0f766e;
}

.ai-blueprint-detail-sections__default-value-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  line-height: 18px;
}

.ai-blueprint-detail-sections__default-value-label {
  font-weight: 600;
}

.ai-blueprint-detail-sections__default-value-content {
  overflow-wrap: anywhere;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-detail-sections__formula-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.ai-blueprint-detail-sections__formula-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  line-height: 18px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-detail-sections__formula-path {
  color: #7c3aed;
  font-weight: 600;
}

.ai-blueprint-detail-sections__formula-expression {
  overflow-wrap: anywhere;
  color: var(--blueprint-text-primary);
  font-family: Consolas, Monaco, monospace;
}

.ai-blueprint-detail-sections__formula-explanation {
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-detail-sections__formula-result-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
}

.ai-blueprint-detail-sections__formula-result {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  line-height: 18px;
}

.ai-blueprint-detail-sections__formula-result-status {
  font-weight: 600;
}

.ai-blueprint-detail-sections__formula-result.is-updated .ai-blueprint-detail-sections__formula-result-status {
  color: #0f766e;
}

.ai-blueprint-detail-sections__formula-result.is-skipped .ai-blueprint-detail-sections__formula-result-status {
  color: #a16207;
}

.ai-blueprint-detail-sections__formula-result.is-failed .ai-blueprint-detail-sections__formula-result-status {
  color: #b91c1c;
}

.ai-blueprint-detail-sections__formula-result.is-draft .ai-blueprint-detail-sections__formula-result-status {
  color: #6b7280;
}

.ai-blueprint-detail-sections__formula-result-reason {
  color: var(--blueprint-text-secondary);
}

@media (max-width: 900px) {
  .ai-blueprint-detail-sections__field-grid {
    grid-template-columns: 1fr;
  }

  .ai-blueprint-detail-sections__form-header {
    flex-direction: column;
  }

  .ai-blueprint-detail-sections__form-title {
    font-size: 20px;
  }
}
</style>
