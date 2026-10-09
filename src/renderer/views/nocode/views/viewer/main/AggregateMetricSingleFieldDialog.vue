<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-metric-single-field-dialog-panel"
    width="960"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @open="onOpen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateMetricSingleFieldDialog.quickAggregate') }}</div>
      </div>
    </template>

    <div class="aggregate-metric-single-field-dialog">
      <div class="metric-form-field">
        <div class="metric-form-field__label">{{ $t('AggregateMetricSingleFieldDialog.metricNameLabel') }}</div>
        <el-input
          v-model="draftMetric.name"
          class="metric-form-field__control"
          :placeholder="$t('AggregateMetricSingleFieldDialog.inputMetricName')"
        />
      </div>

      <div class="metric-form-field">
        <div class="metric-form-field__label">{{ $t('AggregateMetricSingleFieldDialog.field') }}</div>
        <el-select
          :model-value="singleFieldSelectedUID"
          class="metric-form-field__control"
          filterable
          clearable
          :placeholder="$t('AggregateMetricSingleFieldDialog.selectField')"
          @update:model-value="handleSingleFieldOptionChange"
        >
          <el-option
            v-for="item in sourceFieldOptions"
            :key="item.uid"
            :label="item.label"
            :value="item.uid"
          />
        </el-select>
      </div>

      <div class="metric-form-field">
        <div class="metric-form-field__label">{{ $t('AggregateMetricSingleFieldDialog.aggregateMethod') }}</div>
        <el-select
          :model-value="draftMetric.singleFieldConfig.aggregate || 'SUM'"
          class="metric-form-field__control"
          @update:model-value="handleSingleFieldAggregateChange"
        >
          <el-option
            v-for="item in aggregateOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <!-- <div class="metric-form-field metric-form-field--filter">
        <div class="metric-form-field__label">筛选条件</div>
        <div class="metric-filter-panel">
          <div class="metric-filter-panel__summary">{{ singleFieldFilterSummary }}</div>
          <button
            class="metric-filter-panel__action"
            type="button"
            :disabled="!singleFieldSelectedUID"
            @click="filterDialogVisible = true"
          >
            设置筛选条件
          </button>
        </div>
      </div> -->
    </div>

    <aggregate-variable-filter-dialog
      v-model="filterDialogVisible"
      :value="draftMetric.singleFieldConfig.filterRule"
      :source-label="singleFieldSourceLabel"
      :field-options="currentFilterFieldOptions"
      @update="handleFilterUpdate"
    />

    <template #footer>
      <div class="metric-format-bar">
        <div class="metric-format-bar__field">
          <span class="metric-format-bar__label">{{ $t('AggregateMetricSingleFieldDialog.decimalPlaces') }}</span>
          <el-input-number class="metric-format-bar__decimal" v-model="draftMetric.format.decimalPlaces" :controls="false" :min="0" :max="8" />
        </div>

        <div class="metric-format-bar__divider" />

        <el-checkbox
          class="metric-format-bar__thousand-separator"
          :model-value="Boolean(draftMetric.format.thousandSeparator)"
          @update:model-value="(value) => draftMetric.format.thousandSeparator = value ? ',' : ''"
        >
          {{ $t('AggregateMetricSingleFieldDialog.showThousandSeparator') }}
        </el-checkbox>

        <div class="metric-format-bar__divider" />

        <el-checkbox v-model="draftMetric.format.isPercent">{{ $t('AggregateMetricSingleFieldDialog.showAsPercent') }}</el-checkbox>
      </div>

      <div class="btns">
        <el-button @click="handleClose">{{ $t('AggregateMetricSingleFieldDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('AggregateMetricSingleFieldDialog.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { AggregateMetric, AggregateMetricMode, AggregateMetricVariable, AggregateVariableAggregate, FilterRule } from '@common/types/nocode';
import { Field, FieldUID } from '@common/types/project';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, ref } from 'vue';
import AggregateVariableFilterDialog from './AggregateVariableFilterDialog.vue';

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
  mode: AggregateMetricMode,
  format: NonNullable<AggregateMetric['format']>,
  variables: AggregateMetricVariable[],
  singleFieldConfig: AggregateMetricVariable,
};

const props = withDefaults(defineProps<{
  modelValue: boolean,
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

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const filterDialogVisible = ref(false);
const allowedAggregates: AggregateVariableAggregate[] = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'];
const aggregateOptions: { label: string, value: AggregateVariableAggregate }[] = [
  { get label() { return `${i18next.t('AggregateMetricSingleFieldDialog.sum')} (SUM)` }, value: 'SUM' },
  { get label() { return `${i18next.t('AggregateMetricSingleFieldDialog.average')} (AVERAGE)` }, value: 'AVERAGE' },
  { get label() { return `${i18next.t('AggregateMetricSingleFieldDialog.count')} (COUNT)` }, value: 'COUNT' },
  { get label() { return `${i18next.t('AggregateMetricSingleFieldDialog.max')} (MAX)` }, value: 'MAX' },
  { get label() { return `${i18next.t('AggregateMetricSingleFieldDialog.min')} (MIN)` }, value: 'MIN' },
];

const draftMetric = ref<AggregateMetricDraft>({
  uid: createId('metric'),
  name: '',
  mode: 'singleField',
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
  mode: 'singleField',
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

const sourceFieldOptions = computed(() => props.fieldOptions.filter(item => item.optionType !== 'metric'));

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

const singleFieldSelectedUID = computed(() => draftMetric.value.singleFieldConfig.sourceVariableUID || '');
const singleFieldSourceLabel = computed(() => findSourceVariableOption(draftMetric.value.singleFieldConfig)?.sourceLabel || '');
const currentFilterFieldOptions = computed(() => findSourceVariableOption(draftMetric.value.singleFieldConfig)?.filterFieldOptions || []);
const singleFieldFilterSummary = computed(() => {
  const conditions = draftMetric.value.singleFieldConfig.filterRule?.conditions || [];
  if (!conditions.length) return i18next.t('AggregateMetricSingleFieldDialog.filterUnset');
  const labelMap = new Map(currentFilterFieldOptions.value.map(item => [item.value, item.label]));
  return conditions.map(condition => labelMap.get(condition.uid) || condition.uid).join('，');
});

const handleSingleFieldOptionChange = (value?: string) => {
  const option = sourceFieldOptions.value.find(item => item.uid === value);
  draftMetric.value.singleFieldConfig.sourceVariableUID = option?.uid || '';
  draftMetric.value.singleFieldConfig.name = option?.label || '';
  draftMetric.value.singleFieldConfig.sourceUID = option?.sourceUID || '';
  draftMetric.value.singleFieldConfig.fieldUID = option?.fieldUID ?? null;
  draftMetric.value.singleFieldConfig.subFieldUID = option?.subFieldUID ?? null;
  draftMetric.value.singleFieldConfig.filterRule = undefined;
};

const handleSingleFieldAggregateChange = (value?: AggregateVariableAggregate) => {
  draftMetric.value.singleFieldConfig.aggregate = (value && allowedAggregates.includes(value)) ? value : 'SUM';
};

const handleFilterUpdate = (filterRule?: FilterRule) => {
  draftMetric.value.singleFieldConfig.filterRule = filterRule ? deepClone(filterRule) : undefined;
};

const onOpen = () => {
  draftMetric.value = normalizeMetric(props.value);
  filterDialogVisible.value = false;
};

const handleClose = () => {
  filterDialogVisible.value = false;
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  if (!draftMetric.value.name.trim()) {
    ElMessage.error(i18next.t('AggregateMetricSingleFieldDialog.inputMetricName'));
    return;
  }
  if (!draftMetric.value.singleFieldConfig.sourceVariableUID) {
    ElMessage.error(i18next.t('AggregateMetricSingleFieldDialog.selectFieldRequired'));
    return;
  }

  draftMetric.value.mode = 'singleField';
  draftMetric.value.formula = '';
  draftMetric.value.variables = [];
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

.aggregate-metric-single-field-dialog {
  min-height: 500px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.metric-form-field__label {
  margin-bottom: 12px;
  color: #303133;
  font-size: 15px;
  line-height: 24px;
  font-weight: 500;
}

.metric-form-field__control {
  width: 100%;

  :deep(.el-input__wrapper) {
    border-radius: 4px;
  }

  :deep(.el-select__wrapper) {
    border-radius: 4px;
  }
}

.metric-filter-panel {
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.metric-filter-panel__summary {
  min-width: 0;
  color: #8f95a3;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-filter-panel__action {
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

.metric-filter-panel__action:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.metric-format-bar {
  @include common-input;
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

.metric-format-bar__thousand-separator {
  margin-right: 0;
}

.metric-format-bar__divider {
  width: 1px;
  height: 18px;
  background: #ebeef5;
}
</style>

<style lang="scss">
.aggregate-metric-single-field-dialog-panel {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;
  width: 680px;
  height: 592px;
  border-radius: 8px;

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
    padding: 16px;
  }

  .el-dialog__footer {
    height: var(--dialog-footer-height);
    padding: 16px;
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
