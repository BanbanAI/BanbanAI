<template>
  <aside class="data-management-aggregate-fields-panel">
    <div class="panel-header">
      <div class="panel-header__title">{{ $t('DataManagementAggregateFieldsPanel.aggregateFields') }}</div>
      <button class="panel-header__close" type="button" @click="emit('close')">
        <el-icon :size="18"><i-ep-close /></el-icon>
      </button>
    </div>

    <el-scrollbar class="panel-content">
      <div v-if="draftAggregateFields?.length" class="field-list">
        <div v-for="(item, index) in draftAggregateFields" :key="item.uid" class="field-item">
          
            <button class="field-item__selector" type="button">
              <span class="field-item__selector-text">{{ item.name || `${$t('DataManagementAggregateFieldsPanel.fieldPrefix')}${index + 1}` }}</span>
              <el-dropdown
            trigger="click"
            placement="bottom-end"
            popper-class="aggregate-field-mode-dropdown"
            @command="(mode) => handleFieldModeCommand(mode, item)"
          >
              <el-icon class="field-item__selector-arrow" :size="14"><i-ep-arrow-down /></el-icon>
              
            <template #dropdown>
              <el-dropdown-menu class="aggregate-field-mode-dropdown-menu">
                <el-dropdown-item
                  command="singleField"
                  :class="{ 'is-active': normalizeMode(item) === 'singleField' }"
                >
                  {{ $t('DataManagementAggregateFieldsPanel.quickAggregate') }}
                </el-dropdown-item>
                <el-dropdown-item
                  command="formula"
                  :class="{ 'is-active': normalizeMode(item) === 'formula' }"
                >
                  {{ $t('DataManagementAggregateFieldsPanel.formulaEdit') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
            </button>


          <div class="field-item__actions">
            <button class="icon-action-btn" type="button" @click="handleEditField(item)">
              <el-icon :size="16"><i-ven-aggregate-field-edit /></el-icon>
            </button>
            <button class="icon-action-btn icon-action-btn--danger" type="button" @click="handleRemoveField(item.uid)">
              <el-icon :size="16"><i-ep-delete /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <el-dropdown trigger="click" popper-class="aggregate-field-mode-dropdown" @command="handleAddFieldByMode">
        <button class="add-field-btn" type="button">
          <el-icon><i-ep-plus /></el-icon>
          {{ $t('DataManagementAggregateFieldsPanel.addField') }}
        </button>

        <template #dropdown>
          <el-dropdown-menu class="aggregate-field-mode-dropdown-menu">
            <el-dropdown-item command="singleField">{{ $t('DataManagementAggregateFieldsPanel.quickAggregate') }}</el-dropdown-item>
            <el-dropdown-item command="formula">{{ $t('DataManagementAggregateFieldsPanel.formulaEdit') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-scrollbar>

    <div class="panel-footer">
      <el-button @click="handleClear">{{ $t('DataManagementAggregateFieldsPanel.clear') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('DataManagementAggregateFieldsPanel.confirm') }}</el-button>
    </div>

    <aggregate-metric-single-field-dialog
      v-model="singleFieldDialogVisible"
      :value="singleFieldDialogValue"
      :field-options="metricFieldOptions"
      @update="handleSingleFieldDialogUpdate"
    />
    <data-management-aggregate-field-formula-dialog
      v-model="formulaDialogVisible"
      :value="formulaDialogValue"
      :table="table"
      :filterRuleContext="filterRuleContext"
      @update="handleFormulaDialogUpdate"
    />
  </aside>
</template>

<script setup lang="ts">
import { AggregateMetric, AggregateVariableAggregate, TableAggregateField, TableAggregateFieldMode } from '@common/types/nocode';
import { Field, FieldUID, Table } from '@common/types/project';
import { isSystemField } from '@common/utils';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, ref, watch } from 'vue';
import AggregateMetricSingleFieldDialog from '@renderer/views/nocode/views/viewer/main/AggregateMetricSingleFieldDialog.vue';
import DataManagementAggregateFieldFormulaDialog from './DataManagementAggregateFieldFormulaDialog.vue';

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

const props = withDefaults(defineProps<{
  table?: Table | null,
  aggregateFields?: TableAggregateField[],
  filterRuleContext?: any,
}>(), {
  table: null,
  aggregateFields: () => [],
  filterRuleContext: null,
});

const emit = defineEmits<{
  (event: 'close'): void,
  (event: 'confirm', fields: TableAggregateField[]): void,
}>();

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const draftAggregateFields = ref<TableAggregateField[]>([]);
const singleFieldDialogVisible = ref(false);
const formulaDialogVisible = ref(false);
const editingFieldUid = ref('');
const editingField = ref<TableAggregateField | null>(null);

const buildMetricFieldOptions = (table?: Table | null): MetricVariableOption[] => {
  if (!table) return [];

  const sourceLabel = table.alias || table.meta?.name || i18next.t('DataManagementAggregateFieldsPanel.currentTable');
  const options: MetricVariableOption[] = [
    {
      uid: `${table.uid}.__count`,
      label: i18next.t('DataManagementAggregateFieldsPanel.recordCount'),
      sourceUID: table.uid,
      sourceLabel,
      optionType: 'sourceField',
      aggregate: 'COUNT',
      fieldUID: '_count',
      subFieldUID: null,
      filterFieldOptions: [],
    },
  ];

  (table.fields || []).forEach(field => {
    if (isSystemField(field)) return;
    const baseOption: Omit<MetricVariableOption, 'uid' | 'label' | 'fieldUID' | 'subFieldUID'> = {
      sourceUID: table.uid,
      sourceLabel,
      optionType: 'sourceField',
      aggregate: 'SUM',
      filterFieldOptions: [],
    };

    if (field.meta?.subType === 'subForm') {
      (field.subTableFields || []).forEach(subField => {
        if (isSystemField(subField)) return;
        options.push({
          ...baseOption,
          uid: `${table.uid}.${field.uid}.${subField.uid}`,
          label: `${field.alias}.${subField.alias}`,
          fieldUID: field.uid,
          subFieldUID: subField.uid,
        });
      });

      options.push({
        ...baseOption,
        uid: `${table.uid}.${field.uid}.__count`,
        label: `${field.alias}.${i18next.t('DataManagementAggregateFieldsPanel.recordCount')}`,
        aggregate: 'COUNT',
        fieldUID: field.uid,
        subFieldUID: '_count',
      });
      return;
    }

    options.push({
      ...baseOption,
      uid: `${table.uid}.${field.uid}`,
      label: field.alias,
      fieldUID: field.uid,
      subFieldUID: null,
    });
  });

  return options;
};

const metricFieldOptions = computed(() => buildMetricFieldOptions(props.table));
const toAggregateMetric = (field?: TableAggregateField | null): AggregateMetric | null => {
  if (!field) return null;
  return {
    uid: field.uid,
    name: field.name || '',
    mode: 'singleField',
    formula: field.formula || '',
    format: deepClone(field.format || {}),
    variables: [],
    singleFieldConfig: field.singleFieldConfig ? deepClone(field.singleFieldConfig) : null,
  };
};
const singleFieldDialogValue = computed(() => {
  if (!editingField.value) return undefined;
  return toAggregateMetric(editingField.value) || undefined;
});
const formulaDialogValue = computed(() => {
  if (!editingField.value) return undefined;
  return deepClone(editingField.value);
});

const resetEditingContext = () => {
  if (singleFieldDialogVisible.value || formulaDialogVisible.value) return;
  editingFieldUid.value = '';
  editingField.value = null;
};

const normalizeMode = (field: TableAggregateField): TableAggregateFieldMode => {
  if (field.mode) return field.mode;
  return field.singleFieldConfig ? 'singleField' : 'formula';
};

const upsertField = (value: TableAggregateField, mode: TableAggregateFieldMode) => {
  const uid = editingFieldUid.value || value.uid || createId('table_aggregate_field');
  const nextField: TableAggregateField = {
    ...deepClone(value),
    uid,
    mode,
  };
  const index = draftAggregateFields.value.findIndex(item => item.uid === uid);
  if (index === -1) {
    draftAggregateFields.value.push(nextField);
    return;
  }
  draftAggregateFields.value.splice(index, 1, nextField);
};

const openDialogByMode = (mode: TableAggregateFieldMode, value?: TableAggregateField | null) => {
  editingFieldUid.value = value?.uid || '';
  editingField.value = value ? deepClone(value) : null;
  if (mode === 'singleField') {
    singleFieldDialogVisible.value = true;
    return;
  }
  formulaDialogVisible.value = true;
};

const handleAddFieldByMode = (mode: TableAggregateFieldMode | string) => {
  const nextMode: TableAggregateFieldMode = mode === 'singleField' ? 'singleField' : 'formula';
  if (nextMode === 'singleField' && !metricFieldOptions.value.length) {
    ElMessage.warning(i18next.t('DataManagementAggregateFieldsPanel.noAggregatableFields'));
    return;
  }
  openDialogByMode(nextMode, null);
};

const handleFieldModeCommand = (mode: TableAggregateFieldMode | string, field: TableAggregateField) => {
  const nextMode: TableAggregateFieldMode = mode === 'singleField' ? 'singleField' : 'formula';
  if (nextMode === 'singleField' && !metricFieldOptions.value.length) {
    ElMessage.warning(i18next.t('DataManagementAggregateFieldsPanel.noAggregatableFields'));
    return;
  }
  openDialogByMode(nextMode, field);
};

const handleEditField = (field: TableAggregateField) => {
  openDialogByMode(normalizeMode(field), field);
};

const handleRemoveField = (uid: string) => {
  draftAggregateFields.value = draftAggregateFields.value.filter(item => item.uid !== uid);
};

const handleSingleFieldDialogUpdate = (value: AggregateMetric) => {
  upsertField(value as TableAggregateField, 'singleField');
};

const handleFormulaDialogUpdate = (value: TableAggregateField) => {
  upsertField(value, 'formula');
};

const handleClear = () => {
  draftAggregateFields.value = [];
};

const handleConfirm = () => {
  emit('confirm', deepClone(draftAggregateFields.value.map(item => ({
    ...item,
    mode: normalizeMode(item),
  }))));
};

watch(() => props.aggregateFields, value => {
  draftAggregateFields.value = deepClone((value || []).map(item => ({
    ...item,
    mode: normalizeMode(item),
  })));
}, { immediate: true, deep: true });
watch(() => [singleFieldDialogVisible.value, formulaDialogVisible.value], resetEditingContext, { deep: true });
</script>

<style scoped lang="scss">
.data-management-aggregate-fields-panel {
  width: 276px;
  min-width: 276px;
  height: 100%;
  border-left: 1px solid #ebeef5;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.panel-header {
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header__title {
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.panel-header__close {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color-regular);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.panel-header__close:hover {
  background: var(--bg-color-overlay);
}

.panel-content {
  flex: 1;
  min-height: 0;
  padding: 12px 12px 16px;
}

.empty-box {
  margin-bottom: 12px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-item__selector {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 10px 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.field-item__selector:hover {
  border-color: #c0c4cc;
}

.field-item__selector-text {
  min-width: 0;
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-item__selector-arrow {
  flex: none;
  color: #909399;
}

.field-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-action-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color-regular);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-action-btn:hover {
  background: var(--bg-color-overlay);
}

.icon-action-btn--danger:hover {
  color: #f56c6c;
}

.add-field-btn {
  margin-top: 12px;
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 14px;
  line-height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.panel-footer {
  height: 58px;
  padding: 12px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.panel-footer .el-button {
  min-width: 60px;
  border-radius: 4px;
}
</style>

<style lang="scss">
.aggregate-field-mode-dropdown.el-dropdown-menu {
  min-width: 168px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(31, 35, 41, 0.12);
}

.aggregate-field-mode-dropdown-menu .el-dropdown-menu__item {
  height: 28px;
  margin: 0;
  padding: 0 16px;
  border-radius: 8px;
  color: #1f2329;
  font-size: 14px;
  line-height: 24px;
  font-weight: 500;
}

.aggregate-field-mode-dropdown-menu .el-dropdown-menu__item:not(:first-child) {
  margin-top: 8px;
}

.aggregate-field-mode-dropdown-menu .el-dropdown-menu__item:hover {
  background: #f2f3f5;
  color: #1f2329;
}

.aggregate-field-mode-dropdown-menu .el-dropdown-menu__item.is-active {
  background: #eff6ff;
  color: #1677ff;
}
</style>
