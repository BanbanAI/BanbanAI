<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-metric-formula-dialog-panel"
    width="1100"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @open="onOpen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateMetricFormulaDialog.formulaEdit') }}</div>
      </div>
    </template>

    <div class="aggregate-metric-formula-dialog">
      <div class="metric-name-row">
        <div class="metric-name-row__label">{{ $t('AggregateMetricFormulaDialog.metricNameLabel') }}</div>
        <el-input v-model="draftMetric.name" :placeholder="$t('AggregateMetricFormulaDialog.inputMetricName')" />
      </div>

      <div class="metric-formula-shell">
        <formula-editer
          ref="formulaEditor"
          class="aggregate-metric-formula-shell__editor"
          :default-tables="[]"
          :tables="formulaSourceTables"
          :linked-tables="[]"
          :hidden-current-table="true"
          :other-table-label="$t('AggregateMetricFormulaDialog.sourceTableForm')"
          :filter-functions="metricFilterFunctions"
          :tag-config-editable="true"
          :resolve-tag-insert-content="handleResolveTagInsertContent"
          @tag-click="handleTagClick"
          @tag-clear="handleTagClear"
        >
          <template #tag-config="{ tag }">
            <div class="metric-token-panel">
              <template v-if="currentEditingMetricVariable">
                <div class="metric-token-panel__section">
                  <div class="metric-token-panel__title">{{ $t('AggregateMetricFormulaDialog.aggregateMethod') }}</div>

                  <el-select
                    :model-value="currentEditingMetricVariable.aggregate || 'SUM'"
                    class="metric-token-panel__select"
                    @update:model-value="handleMetricVariableAggregateChange"
                  >
                    <el-option
                      v-for="item in aggregateOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>

                <div class="metric-token-panel__section">
                  <div class="metric-token-panel__title">{{ $t('AggregateMetricFormulaDialog.filterConditionTitle') }}</div>
                  <aggregate-variable-filter-editor
                    class="metric-token-panel__filter-editor"
                    :value="currentFilterRule"
                    :field-options="currentFilterFieldOptions"
                    :hide-source-label="true"
                    :compact="true"
                    :inline="true"
                    :auto-save="true"
                    :sync-key="editingMetricVariableUid"
                    @change="handleFilterUpdate"
                  />
                </div>
              </template>

              <template v-else-if="currentEditingMetricReference">
                <div class="metric-token-panel__section">
                  <div class="metric-token-panel__title">{{ $t('AggregateMetricFormulaDialog.metricReference') }}</div>
                  <div class="metric-token-panel__name">{{ currentEditingMetricReference.label || tag.text }}</div>
                  <div class="metric-token-panel__summary">{{ $t('AggregateMetricFormulaDialog.metricReferenceSummary') }}</div>
                </div>
              </template>

              <template v-else>
                <div class="metric-token-panel__section">
                  <div class="metric-token-panel__title">{{ $t('AggregateMetricFormulaDialog.configDescription') }}</div>
                  <div class="metric-token-panel__summary">{{ $t('AggregateMetricFormulaDialog.configDescriptionSummary') }}</div>
                </div>
              </template>
            </div>
          </template>
        </formula-editer>
      </div>
    </div>

    <template #footer>
      <div class="metric-format-bar">
        <div class="metric-format-bar__field">
          <span class="metric-format-bar__label">{{ $t('AggregateMetricFormulaDialog.decimalPlaces') }}</span>
          <el-input-number class="metric-format-bar__decimal" v-model="draftMetric.format.decimalPlaces" :controls="false" :min="0" :max="8" />
        </div>

        <div class="metric-format-bar__divider" />

        <el-checkbox class="metric-format-bar__thousand-separator"
          :model-value="Boolean(draftMetric.format.thousandSeparator)"
          @update:model-value="(value) => draftMetric.format.thousandSeparator = value ? ',' : ''"
        >
          {{ $t('AggregateMetricFormulaDialog.showThousandSeparator') }}
        </el-checkbox>

        <div class="metric-format-bar__divider" />

        <el-checkbox v-model="draftMetric.format.isPercent">{{ $t('AggregateMetricFormulaDialog.showAsPercent') }}</el-checkbox>
      </div>
      <div class="btns">
        <el-button @click="handleClose">{{ $t('AggregateMetricFormulaDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('AggregateMetricFormulaDialog.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  AggregateMetric,
  AggregateMetricVariable,
  AggregateVariableAggregate,
  FilterRule,
  RuleFuncTextMapping,
} from '@common/types/nocode';
import { formulaList } from '@common/utils';
import { Field, FieldUID, Table, TableUID, TableWithSource } from '@common/types/project';
import FormulaEditer from '@renderer/views/nocode/components/global/table/components/formula/FormulaEditer.vue';
import { PlaceholderTagMeta } from '@renderer/views/nocode/components/global/table/components/formula/codemirror';
import { replaceBracketId } from '@renderer/views/nocode/components/global/table/components/formula/utils';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, nextTick, ref } from 'vue';
import AggregateVariableFilterEditor from './AggregateVariableFilterEditor.vue';

type AggregateFilterFieldOption = {
  value: string,
  label: string,
  field?: Field | null,
};

type MetricVariableOption = {
  uid: string,
  label: string,
  sourceUID: string,
  sourceLabel?: string,
  optionType?: 'sourceField' | 'metric',
  metricUID?: string,
  aggregate: AggregateVariableAggregate,
  fieldUID?: FieldUID | '_count' | null,
  subFieldUID?: FieldUID | '_count' | null,
  filterFieldOptions?: AggregateFilterFieldOption[],
};

type AggregateMetricDraft = AggregateMetric & {
  format: NonNullable<AggregateMetric['format']>,
  variables: AggregateMetricVariable[],
  singleFieldConfig: AggregateMetricVariable,
};

type FormulaTable = Table & {
  label?: string,
  formSelectLabel?: string,
  formulaAlias?: string,
  connectionUID?: string,
};

const props = withDefaults(defineProps<{
  modelValue: boolean,
  tableUid: string,
  value?: AggregateMetric | null,
  fieldOptions?: MetricVariableOption[],
}>(), {
  value: undefined,
  fieldOptions: () => [],
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value: AggregateMetric): void,
}>();

const AGGREGATE_METRIC_SOURCE_UID = '__aggregate_metric__';
const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const formulaEditor = ref();
const editingMetricVariableUid = ref('');
const editingMetricReferenceUid = ref('');
const allowedAggregates: AggregateVariableAggregate[] = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'];
const aggregateOptions: { label: string, value: AggregateVariableAggregate }[] = [
  { get label() { return `${i18next.t('AggregateMetricFormulaDialog.sum')} (SUM)` }, value: 'SUM' },
  { get label() { return `${i18next.t('AggregateMetricFormulaDialog.average')} (AVERAGE)` }, value: 'AVERAGE' },
  { get label() { return `${i18next.t('AggregateMetricFormulaDialog.count')} (COUNT)` }, value: 'COUNT' },
  { get label() { return `${i18next.t('AggregateMetricFormulaDialog.max')} (MAX)` }, value: 'MAX' },
  { get label() { return `${i18next.t('AggregateMetricFormulaDialog.min')} (MIN)` }, value: 'MIN' },
];

const draftMetric = ref<AggregateMetricDraft>({
  uid: createId('metric'),
  name: '',
  mode: 'formula',
  formula: '',
  variables: [],
  singleFieldConfig: {
    uid: createId('metric_variable'),
    sourceVariableUID: '',
    name: '',
    sourceUID: '',
    aggregate: 'SUM',
    fieldUID: null,
    subFieldUID: null,
    filterRule: undefined,
  },
  format: {
    isPercent: false,
    completeZero: false,
    decimalPlaces: 0,
    thousandSeparator: '',
    decimalSeparator: '.',
  },
});

const normalizeMetricVariable = (metricVariable?: AggregateMetricVariable | null): AggregateMetricVariable => ({
  uid: metricVariable?.uid || createId('metric_variable'),
  sourceVariableUID: metricVariable?.sourceVariableUID || '',
  name: metricVariable?.name || '',
  sourceUID: metricVariable?.sourceUID || '',
  aggregate: metricVariable?.aggregate || 'SUM',
  fieldUID: metricVariable?.fieldUID ?? null,
  subFieldUID: metricVariable?.subFieldUID ?? null,
  filterRule: metricVariable?.filterRule ? deepClone(metricVariable.filterRule) : undefined,
});

const normalizeMetric = (metric?: AggregateMetric | null): AggregateMetricDraft => ({
  uid: metric?.uid || createId('metric'),
  name: metric?.name || '',
  mode: 'formula',
  formula: metric?.formula || '',
  variables: (metric?.variables || []).map(item => normalizeMetricVariable(item)),
  singleFieldConfig: normalizeMetricVariable(metric?.singleFieldConfig),
  format: {
    isPercent: metric?.format?.isPercent ?? false,
    completeZero: false,
    decimalPlaces: metric?.format?.decimalPlaces ?? 0,
    thousandSeparator: metric?.format?.thousandSeparator || '',
    decimalSeparator: metric?.format?.decimalSeparator || '.',
  },
});

const createVariableField = (variable: MetricVariableOption): Field => ({
  uid: variable.uid as FieldUID,
  alias: variable.label,
  type: 'number',
  meta: {
    uid: variable.uid as FieldUID,
    name: variable.label,
    extra: {
      widgetType: 'widget.form.numberInput',
    },
  },
});

const sourceFieldOptions = computed(() => props.fieldOptions.filter(item => item.optionType !== 'metric'));

const formulaSourceTables = computed<TableWithSource[]>(() => {
  const grouped = new Map<string, MetricVariableOption[]>();
  props.fieldOptions.forEach(item => {
    if (!item.sourceUID) return;
    if (!grouped.has(item.sourceUID)) grouped.set(item.sourceUID, []);
    grouped.get(item.sourceUID)!.push(item);
  });
  return Array.from(grouped.entries()).map(([sourceUID, options]) => ({
    uid: sourceUID as TableUID,
    name: (options[0]?.sourceLabel || sourceUID) as TableUID,
    alias: options[0]?.sourceLabel || sourceUID,
    meta: {
      connectionUID: 'c_aggregate_formula',
    },
    fields: options.map(item => createVariableField(item)),
    formSelectLabel: options[0]?.sourceLabel || sourceUID,
    formulaAlias: options[0]?.sourceLabel || sourceUID,
    connectionUID: 'c_aggregate_formula',
  } as FormulaTable as TableWithSource));
});

const metricFilterFunctions = computed(() => {
  const enabled = new Set(['AND', 'IF', 'IFS', 'OR', 'INT', 'ROUND']);
  const all = formulaList.flatMap(item => item.children.map(child => child.name));
  return Array.from(new Set(all.filter(name => !enabled.has(name))));
});

const currentEditingMetricVariable = computed(() => draftMetric.value.variables.find(item => item.uid === editingMetricVariableUid.value));
const currentEditingMetricReference = computed(() => props.fieldOptions.find(item => (
  item.optionType === 'metric'
  && item.metricUID === editingMetricReferenceUid.value
)));
const currentEditingMetricVariableLabel = computed(() => currentEditingMetricVariable.value ? getMetricVariableLabel(currentEditingMetricVariable.value) : '');

const findMetricReferenceOption = (metricUID?: string) => props.fieldOptions.find(item => (
  item.optionType === 'metric'
  && item.metricUID === metricUID
));

const findSourceVariableOption = (metricVariable?: Partial<AggregateMetricVariable> | null) => {
  if (!metricVariable) return undefined;
  if (metricVariable.sourceVariableUID) {
    const sourceVariable = sourceFieldOptions.value.find(item => item.uid === metricVariable.sourceVariableUID);
    if (sourceVariable) return sourceVariable;
  }
  return sourceFieldOptions.value.find(item => (
    item.sourceUID === metricVariable.sourceUID
    && (item.fieldUID ?? null) === (metricVariable.fieldUID ?? null)
    && (item.subFieldUID ?? null) === (metricVariable.subFieldUID ?? null)
  ));
};

const getMetricVariableFieldLabel = (metricVariable?: AggregateMetricVariable | null) => {
  if (!metricVariable) return '';
  return findSourceVariableOption(metricVariable)?.label || metricVariable.name || i18next.t('AggregateMetricFormulaDialog.unnamedField');
};

const getMetricVariableLabel = (metricVariable?: AggregateMetricVariable | null) => {
  if (!metricVariable) return '';
  const aggregate = metricVariable.aggregate || 'SUM';
  const fieldLabel = getMetricVariableFieldLabel(metricVariable);
  return `${aggregate}(${fieldLabel})`;
};

const getMetricVariableSourceLabel = (metricVariable?: AggregateMetricVariable | null) => findSourceVariableOption(metricVariable)?.sourceLabel || '';
const getMetricVariableFilterFieldOptions = (metricVariable?: AggregateMetricVariable | null) => findSourceVariableOption(metricVariable)?.filterFieldOptions || [];

const getMetricVariableFilterSummary = (metricVariable?: AggregateMetricVariable | null) => {
  const conditions = metricVariable?.filterRule?.conditions || [];
  if (!conditions.length) return i18next.t('AggregateMetricFormulaDialog.filterUnset');
  const labelMap = new Map(getMetricVariableFilterFieldOptions(metricVariable).map(item => [item.value, item.label]));
  return conditions.map(condition => {
    const fieldLabel = labelMap.get(condition.uid) || condition.uid;
    return `${fieldLabel} ${RuleFuncTextMapping[condition.func] || condition.func}`;
  }).join('；');
};

const currentFilterRule = computed(() => currentEditingMetricVariable.value?.filterRule);
const currentFilterFieldOptions = computed(() => getMetricVariableFilterFieldOptions(currentEditingMetricVariable.value));

const buildMetricVariableTokenPath = (metricVariable: AggregateMetricVariable) => `${props.tableUid}.${draftMetric.value.uid}.${metricVariable.uid}`;
const buildMetricVariableToken = (metricVariable: AggregateMetricVariable) => `[[${buildMetricVariableTokenPath(metricVariable)},${getMetricVariableLabel(metricVariable)}]]`;
const buildMetricReferenceTokenPath = (metricUID?: string) => `${props.tableUid}.${metricUID || ''}`;
const buildMetricReferenceToken = (metricOption: MetricVariableOption) => `[[${buildMetricReferenceTokenPath(metricOption.metricUID)},${metricOption.label}]]`;

const parseMetricVariableUID = (ids: string[]) => {
  if (ids[0] !== props.tableUid) return '';
  if (ids.length >= 3 && ids[1] === draftMetric.value.uid) return ids[2];
  if (ids.length === 2 && draftMetric.value.variables.some(item => item.uid === ids[1])) return ids[1];
  return '';
};

const parseMetricReferenceUID = (ids: string[]) => {
  if (ids[0] !== props.tableUid || ids.length !== 2) return '';
  return findMetricReferenceOption(ids[1])?.metricUID || '';
};

const syncFormulaAlias = (formula: string) => {
  if (!formula) return '';
  return replaceBracketId(formula, (ids, aliases) => {
    if (ids[0] !== props.tableUid) {
      return `${ids.join('.')},${aliases.join('.') || ids.join('.')}`;
    }

    const metricReferenceUID = parseMetricReferenceUID(ids);
    if (metricReferenceUID) {
      const metricReference = findMetricReferenceOption(metricReferenceUID);
      if (!metricReference) return `${ids.join('.')},${i18next.t('AggregateMetricFormulaDialog.deleted')}`;
      return `${buildMetricReferenceTokenPath(metricReferenceUID)},${metricReference.label}`;
    }

    const variableUID = parseMetricVariableUID(ids);
    const metricVariable = draftMetric.value.variables.find(item => item.uid === variableUID)
      || (ids.length === 2 ? draftMetric.value.variables.find(item => item.uid === ids[1]) : undefined);
    if (!metricVariable) return `${ids.join('.')},${i18next.t('AggregateMetricFormulaDialog.deleted')}`;
    return `${buildMetricVariableTokenPath(metricVariable)},${getMetricVariableLabel(metricVariable)}`;
  });
};

const getUsedMetricVariableUIDs = (formula: string) => {
  const ids = new Set<string>();
  replaceBracketId(formula, (tokenIds, aliases) => {
    const metricVariableUID = parseMetricVariableUID(tokenIds);
    if (metricVariableUID) ids.add(metricVariableUID);
    return `${tokenIds.join('.')},${aliases.join('.') || tokenIds.join('.')}`;
  });
  return ids;
};

const createMetricVariable = (option: MetricVariableOption): AggregateMetricVariable => ({
  uid: createId('metric_variable'),
  sourceVariableUID: option.uid,
  name: option.label,
  sourceUID: option.sourceUID,
  aggregate: 'SUM',
  fieldUID: option.fieldUID ?? null,
  subFieldUID: option.subFieldUID ?? null,
  filterRule: undefined,
});

const syncFormulaEditor = async () => {
  await nextTick();
  if (!formulaEditor.value) return;
  const defaultSourceUID = formulaSourceTables.value.find(item => item.uid !== AGGREGATE_METRIC_SOURCE_UID)?.uid || formulaSourceTables.value[0]?.uid;
  if (defaultSourceUID) formulaEditor.value.selectTable(defaultSourceUID);
  formulaEditor.value.init(syncFormulaAlias(draftMetric.value.formula));
};

const handleResolveTagInsertContent = (field: Field & { tableUID?: string }) => {
  const variableOption = props.fieldOptions.find(item => item.uid === field.uid && item.sourceUID === (field.tableUID || ''));
  if (!variableOption) {
    return `[[${props.tableUid}.${field.uid},SUM(${field.alias})]]`;
  }
  if (variableOption.optionType === 'metric') {
    return buildMetricReferenceToken(variableOption);
  }
  const metricVariable = createMetricVariable(variableOption);
  draftMetric.value.variables.push(metricVariable);
  return buildMetricVariableToken(metricVariable);
};

const handleTagClick = (tag: PlaceholderTagMeta) => {
  const ids = tag.uid.split('.');
  const metricVariableUID = parseMetricVariableUID(ids);
  if (metricVariableUID) {
    editingMetricVariableUid.value = metricVariableUID;
    editingMetricReferenceUid.value = '';
    return;
  }
  editingMetricVariableUid.value = '';
  editingMetricReferenceUid.value = parseMetricReferenceUID(ids);
};

const handleTagClear = () => {
  editingMetricVariableUid.value = '';
  editingMetricReferenceUid.value = '';
};

const handleFilterUpdate = (filterRule?: FilterRule) => {
  if (!currentEditingMetricVariable.value) return;
  currentEditingMetricVariable.value.filterRule = filterRule ? deepClone(filterRule) : undefined;
};

const handleMetricVariableAggregateChange = (value?: AggregateVariableAggregate) => {
  if (!currentEditingMetricVariable.value) return;
  currentEditingMetricVariable.value.aggregate = (value && allowedAggregates.includes(value)) ? value : 'SUM';
  const latestFormula = formulaEditor.value?.getCodeMirrorText?.() || '';
  const syncedFormula = syncFormulaAlias(latestFormula);
  formulaEditor.value?.setCodeMirrorText?.(syncedFormula);
};

const onOpen = async () => {
  draftMetric.value = normalizeMetric(props.value);
  draftMetric.value.mode = 'formula';
  draftMetric.value.format.completeZero = false;
  editingMetricVariableUid.value = '';
  editingMetricReferenceUid.value = '';
  await syncFormulaEditor();
};

const handleClose = () => {
  editingMetricVariableUid.value = '';
  editingMetricReferenceUid.value = '';
  formulaEditor.value?.clear?.();
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  if (!draftMetric.value.name.trim()) {
    ElMessage.error(i18next.t('AggregateMetricFormulaDialog.inputMetricName'));
    return;
  }

  const formula = syncFormulaAlias(formulaEditor.value?.getCodeMirrorText?.() || '');
  if (!formula) {
    ElMessage.error(i18next.t('AggregateMetricFormulaDialog.setFormulaRequired'));
    return;
  }

  const usedMetricVariableUIDs = getUsedMetricVariableUIDs(formula);
  draftMetric.value.mode = 'formula';
  draftMetric.value.formula = formula;
  draftMetric.value.variables = draftMetric.value.variables.filter(item => usedMetricVariableUIDs.has(item.uid));
  draftMetric.value.format.completeZero = false;

  emit('update', deepClone(draftMetric.value));
  handleClose();
};
</script>

<style scoped lang="scss">
.dialog-header__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  text-align: center;
}

@mixin common-select {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  :deep(.el-select__wrapper),
  :deep(.el-select-v2__wrapper) {
    width: 100%;
    height: 32px;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    box-shadow: 0 0 0 0px var(--border-color) inset;
    font-size: 12px;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
    }

    &.is-focused {
      box-shadow: 0 0 0 1px var(--color-primary) inset !important;
    }
  }
}

@mixin common-input {
  :deep(.el-input__wrapper),
  :deep(.el-input-number__wrapper) {
    border-radius: 4px;
    background-color: var(--bg-color-overlay);
    box-shadow: unset;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
    }

    &.is-focus,
    &.is-focused {
      box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
    }

    .el-input__inner {
      font-size: 12px;
      height: 32px;
      color: var(--text-color-regular);

      &::placeholder {
        font-size: 12px;
      }
    }
  }
}

.aggregate-metric-formula-dialog {
  display: flex;
  flex-direction: column;
}

.metric-name-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;

  :deep(.el-input__wrapper) {
    border-radius: 4px;
  }
}

.metric-name-row__label,
.metric-format-bar__label {
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.metric-format-bar__decimal {
  height: 24px;
  width: 64px;
  border-radius: 4px;

  :deep(.el-input__wrapper) {
    border-radius: 4px;
  }
}

.metric-formula-shell {
  min-height: 520px;
}

.metric-token-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-token-panel__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-token-panel__filter-editor {
  margin-top: 2px;
}

.metric-token-panel__title {
  color: #4e5969;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}

.metric-token-panel__name {
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  word-break: break-all;
}

.metric-token-panel__meta,
.metric-token-panel__summary {
  color: #86909c;
  font-size: 12px;
  line-height: 20px;
  word-break: break-word;
}

.metric-token-panel__select {
  width: 100%;
}

.metric-format-bar {
  min-height: 48px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.metric-format-bar__field {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.metric-format-bar__thousand-separator {
  margin-right: 0;
}

.metric-format-bar__divider {
  width: 1px;
  height: 18px;
  background: #ebeef5;
}

:deep(.aggregate-metric-formula-shell__editor.container) {
  width: 100%;
  height: 100%;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

:deep(.aggregate-metric-formula-shell__editor .container-header) {
  height: 40px;
  padding: 0 14px;
  background: #f7f8fa;
  border-bottom: 1px solid #ebeef5;
}

:deep(.aggregate-metric-formula-shell__editor .header-title) {
  color: #1f2329;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
}

:deep(.aggregate-metric-formula-shell__editor .header-options) {
  font-size: 13px;
  color: #4e5969;
}

:deep(.aggregate-metric-formula-shell__editor .container-code) {
  min-height: 164px;
  border-bottom: 1px solid #ebeef5;
}

:deep(.aggregate-metric-formula-shell__editor .container-code .vue-codemirror) {
  min-height: 120px;
  padding: 12px 14px;
  font-size: 14px;
}

:deep(.aggregate-metric-formula-shell__editor .container-list) {
  height: 330px;
}

:deep(.aggregate-metric-formula-shell__editor .fields-container),
:deep(.aggregate-metric-formula-shell__editor .formula-menu) {
  padding: 12px;
}

:deep(.aggregate-metric-formula-shell__editor .fields-container) {
  width: 258px;
}

:deep(.aggregate-metric-formula-shell__editor .formula-menu) {
  width: 286px;
  border-left: 1px solid #ebeef5;
}

:deep(.aggregate-metric-formula-shell__editor .formula-intro) {
  margin: 0;
  padding: 12px;
  border-left: 1px solid #ebeef5;
  height: 100%;
}

:deep(.aggregate-metric-formula-shell__editor .fields-search),
:deep(.aggregate-metric-formula-shell__editor .formula-search) {
  height: auto;
  margin: 8px 0 12px;
}

:deep(.aggregate-metric-formula-shell__editor .form-select .el-select__wrapper) {
  min-height: 32px;
  border-radius: 4px;
  border: none;
  background: var(--bg-color-overlay);
  box-shadow: unset;
}

:deep(.aggregate-metric-formula-shell__editor .fields-search .el-input__wrapper:hover),
:deep(.aggregate-metric-formula-shell__editor .formula-search .el-input__wrapper:hover),
:deep(.aggregate-metric-formula-shell__editor .form-select .el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

:deep(.aggregate-metric-formula-shell__editor .fields-search .el-input__wrapper.is-focus),
:deep(.aggregate-metric-formula-shell__editor .formula-search .el-input__wrapper.is-focus),
:deep(.aggregate-metric-formula-shell__editor .form-select .el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--color-primary) inset !important;
}

:deep(.aggregate-metric-formula-shell__editor .fields-list),
:deep(.aggregate-metric-formula-shell__editor .formula-list),
:deep(.aggregate-metric-formula-shell__editor .search-list) {
  scrollbar-width: thin;
}

:deep(.aggregate-metric-formula-shell__editor .filed-item),
:deep(.aggregate-metric-formula-shell__editor .formula-item) {
  border-radius: 6px;
}

:deep(.aggregate-metric-formula-shell__editor .filed-item:hover),
:deep(.aggregate-metric-formula-shell__editor .formula-item:hover) {
  background: #f2f3f5;
}

:deep(.aggregate-metric-formula-shell__editor .formula-category > .title) {
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

:deep(.aggregate-metric-formula-shell__editor .formula-intro .el-divider) {
  margin: 14px 0;
}

:deep(.aggregate-metric-formula-shell__editor .formula-title) {
  margin-bottom: 10px;
  color: #86909c;
}

@media (max-width: 1280px) {
  .metric-name-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>

<style lang="scss">
.aggregate-metric-formula-dialog-panel {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;
  border-radius: 8px;

  .aggregate-metric-formula-shell__editor .cm-tag--aggregate .cm-tag__fn {
    background: #ffe7e8;
    color: #ff4d4f;
  }

  .aggregate-metric-formula-shell__editor .cm-tag--aggregate .cm-tag__field {
    background: #eaf2fd;
    color: #2f7deb;
  }

  .aggregate-metric-formula-shell__editor .cm-tag--aggregate .cm-tag__paren {
    color: #4e5969;
  }

  .aggregate-metric-formula-shell__editor .cm-tag--aggregate.cm-tag--active {
    display: inline-flex;
    align-items: center;
    height: 32px;
    box-sizing: border-box;
    padding: 0 4px;
    border-radius: 6px;
    background: #bbe2ff;
  }

  .el-dialog__header {
    height: var(--dialog-header-height);
    padding: 0 16px;
    margin-right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-color);
  }

  .el-dialog__headerbtn {
    top: 0;
    right: 0;
    width: var(--dialog-header-height);
    height: var(--dialog-header-height);
  }

  .el-dialog__body {
    padding: 24px 20px;
  }

  .el-dialog__footer {
    height: var(--dialog-footer-height);
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-color-page);
    border-radius: 0 0 8px 8px;
  }

  .el-dialog__footer .el-button {
    border-radius: 4px;
  }
}
</style>
