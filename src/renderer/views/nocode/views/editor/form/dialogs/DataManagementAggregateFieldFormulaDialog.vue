<template>
  <el-dialog
    :model-value="modelValue"
    class="data-management-aggregate-field-formula-dialog-panel"
    width="1008"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    draggable
    @open="onOpen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('DataManagementAggregateFieldFormulaDialog.formulaEdit') }}</div>
      </div>
    </template>

    <div class="data-management-aggregate-field-formula-dialog">
      <div class="field-name-row">
        <div class="field-name-row__label">{{ $t('DataManagementAggregateFieldFormulaDialog.nameField') }}</div>
        <el-input
          v-model="draftField.name"
          class="field-name-row__control"
          :placeholder="$t('DataManagementAggregateFieldFormulaDialog.inputAggregateFieldName')"
        />
      </div>

      <div class="formula-shell">
        <formula-editer
          ref="formulaEditor"
          class="formula-shell__editor"
          :default-tables="defaultTables"
          :tables="[]"
          :linked-tables="[]"
          :hidden-current-table="false"
          :filter-functions="aggregateFilterFunctions"
          :filter-rule-editable="true"
          :filter-rule-function-names="Array.from(AGGREGATE_FUNCTION_NAMES)"
          :filter-rule-context="filterRuleContext"
          :allow-current-table-function-filter="true"
          :other-table-label="$t('DataManagementAggregateFieldFormulaDialog.sourceTableForm')"
        />
      </div>
    </div>

    <template #footer>
      <div class="btns">
        <el-button @click="handleClose">{{ $t('DataManagementAggregateFieldFormulaDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('DataManagementAggregateFieldFormulaDialog.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  AggregateMetricFormat,
  TableAggregateField,
} from '@common/types/nocode';
import { formulaList } from '@common/utils';
import { Field, FieldUID, Table } from '@common/types/project';
import FormulaEditer from '@renderer/views/nocode/components/global/table/components/formula/FormulaEditer.vue';
import { replaceBracketId } from '@renderer/views/nocode/components/global/table/components/formula/utils';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, nextTick, ref } from 'vue';

type TableAggregateFieldDraft = Omit<TableAggregateField, 'format'> & {
  format: NonNullable<TableAggregateField['format']>,
};

type FormulaFieldScope = {
  fieldId: string,
  inAggregateScope: boolean,
};

const AGGREGATE_FUNCTION_NAMES = new Set([
  'SUM',
  'AVERAGE',
  'COUNT',
  'MAX',
  'MIN',
]);

const props = withDefaults(defineProps<{
  modelValue: boolean,
  value?: TableAggregateField | null,
  table?: Table | null,
  filterRuleContext?: any,
}>(), {
  value: null,
  table: null,
  filterRuleContext: null,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value: TableAggregateField): void,
}>();

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const formulaEditor = ref();

const createDefaultFormat = (): AggregateMetricFormat => ({
  isPercent: false,
  completeZero: false,
  decimalPlaces: 0,
  thousandSeparator: '',
  decimalSeparator: '.',
});

const aggregateFilterFunctions = computed(() => {
  const allFunctions = formulaList.flatMap(item => item.children.map(child => child.name));
  return Array.from(new Set(allFunctions.filter(name => !AGGREGATE_FUNCTION_NAMES.has(name))));
});

const normalizeField = (value?: TableAggregateField | null): TableAggregateFieldDraft => ({
  uid: value?.uid || createId('table_aggregate_field'),
  name: value?.name || '',
  mode: 'formula',
  formula: value?.formula || '',
  singleFieldConfig: null,
  filterRules: deepClone(value?.filterRules || {}),
  format: {
    isPercent: value?.format?.isPercent ?? false,
    completeZero: false,
    decimalPlaces: value?.format?.decimalPlaces ?? 0,
    thousandSeparator: value?.format?.thousandSeparator || '',
    decimalSeparator: value?.format?.decimalSeparator || '.',
  },
});

const draftField = ref<TableAggregateFieldDraft>({
  uid: '',
  name: '',
  mode: 'formula',
  formula: '',
  singleFieldConfig: null,
  filterRules: {},
  format: createDefaultFormat(),
});

const defaultTables = computed<Table[]>(() => props.table ? [{
  ...props.table,
  alias: props.table.alias || props.table.meta?.name || '',
}] : []);

const getFieldLabel = (field?: Field | null) => field?.alias || field?.uid || '';

const getFieldAliasByIds = (ids: string[]) => {
  const tableUID = ids[0];
  if (!props.table || tableUID !== props.table.uid) return '';

  const fieldUID = ids[1] as FieldUID | '_count' | undefined;
  const subFieldUID = ids[2] as FieldUID | '_count' | undefined;
  if (!fieldUID) return '';
  if (fieldUID === '_count') return i18next.t('DataManagementAggregateFieldFormulaDialog.recordCount');

  const field = (props.table.fields || []).find(item => item.uid === fieldUID);
  if (!field) return '';
  if (!subFieldUID) return getFieldLabel(field);
  if (subFieldUID === '_count') return `${getFieldLabel(field)}.${i18next.t('DataManagementAggregateFieldFormulaDialog.recordCount')}`;

  const subField = (field.subTableFields || []).find(item => item.uid === subFieldUID);
  if (!subField) return '';
  return `${getFieldLabel(field)}.${getFieldLabel(subField)}`;
};

const syncFormulaAlias = (formula: string) => {
  if (!formula) return '';
  return replaceBracketId(formula, (ids, aliases) => {
    const alias = getFieldAliasByIds(ids) || aliases.join('.') || ids.join('.');
    return `${ids.join('.')},${alias}`;
  });
};

const scanAggregateFormula = (formula: string) => {
  const fieldScopes: FormulaFieldScope[] = [];
  const normalizedFormula = String(formula || '').replace(/<[^>]+>/g, '');

  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  const fnStack: Array<{
    openDepth: number,
    isAggregate: boolean,
  }> = [];

  for (let i = 0; i < normalizedFormula.length; i++) {
    const ch = normalizedFormula[i];
    const next = normalizedFormula[i + 1];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (ch === '\'' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) continue;

    if (ch === '[' && next === '[') {
      const end = normalizedFormula.indexOf(']]', i + 2);
      if (end === -1) break;

      const content = normalizedFormula.slice(i + 2, end);
      const [fieldId = ''] = content.split(',');
      fieldScopes.push({
        fieldId,
        inAggregateScope: fnStack.some(item => item.isAggregate),
      });

      i = end + 1;
      continue;
    }

    if (ch === '(') {
      let cursor = i - 1;
      while (cursor >= 0 && /\s/.test(normalizedFormula[cursor])) cursor--;
      let end = cursor;
      while (cursor >= 0 && /[a-zA-Z0-9_]/.test(normalizedFormula[cursor])) cursor--;

      const fnName = normalizedFormula.slice(cursor + 1, end + 1).toUpperCase();
      if (/^[A-Z_][A-Z0-9_]*$/.test(fnName)) {
        fnStack.push({
          openDepth: depth + 1,
          isAggregate: AGGREGATE_FUNCTION_NAMES.has(fnName),
        });
      }
      depth++;
      continue;
    }

    if (ch === ')') {
      depth = Math.max(depth - 1, 0);
      while (fnStack.length && fnStack[fnStack.length - 1].openDepth > depth) {
        fnStack.pop();
      }
    }
  }

  return {
    hasAggregateFunctions: fieldScopes.some(item => item.inAggregateScope)
      || Array.from(AGGREGATE_FUNCTION_NAMES).some(name => new RegExp(`\\b${name}(?:<[^>]+>)?\\s*\\(`, 'i').test(normalizedFormula)),
    fieldScopes,
  };
};

const validateFormula = (formula: string) => {
  const { hasAggregateFunctions, fieldScopes } = scanAggregateFormula(formula);
  if (!hasAggregateFunctions) return true;
  return fieldScopes.every(item => item.inAggregateScope);
};

const syncFormulaEditor = async () => {
  await nextTick();
  if (!formulaEditor.value) return;
  const defaultSourceUID = defaultTables.value[0]?.uid;
  if (defaultSourceUID) formulaEditor.value.selectTable(defaultSourceUID);
  formulaEditor.value.init(
    syncFormulaAlias(draftField.value.formula || ''),
    draftField.value.filterRules || {},
  );
};

const onOpen = async () => {
  draftField.value = normalizeField(props.value);
  await syncFormulaEditor();
};

const handleClose = () => {
  formulaEditor.value?.clear?.();
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  if (!draftField.value.name.trim()) {
    ElMessage.error(i18next.t('DataManagementAggregateFieldFormulaDialog.inputAggregateFieldName'));
    return;
  }

  const formula = syncFormulaAlias(formulaEditor.value?.getCodeMirrorText?.() || '');
  const filterRules = deepClone(formulaEditor.value?.getFilterRule?.() || {});
  if (!formula) {
    ElMessage.error(i18next.t('DataManagementAggregateFieldFormulaDialog.setFormula'));
    return;
  }

  if (!validateFormula(formula)) {
    ElMessage.error(i18next.t('DataManagementAggregateFieldFormulaDialog.mixedAggregateError'));
    return;
  }

  emit('update', {
    uid: draftField.value.uid || createId('table_aggregate_field'),
    name: draftField.value.name.trim(),
    mode: 'formula',
    formula,
    format: deepClone(draftField.value.format),
    singleFieldConfig: null,
    filterRules,
  });
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

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

@mixin common-select {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  :deep(.el-select__wrapper),
  :deep(.el-select-v2__wrapper) {
    width: 100%;
    min-height: 32px;
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

:deep(.formula-shell__editor .form-select .el-select__wrapper) {
  min-height: 32px;
  border-radius: 4px;
  border: none;
  background: var(--bg-color-overlay);
  box-shadow: unset;
}

.data-management-aggregate-field-formula-dialog {
  display: flex;
  flex-direction: column;
}

.field-name-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;

  :deep(.el-input__wrapper) {
    border-radius: 4px;
  }
}

.field-name-row__label {
  color: #1f2329;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
}

.formula-shell {
  border-radius: 4px;
  overflow: hidden;
}

.btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.container-code) {
  min-height: 164px;
  border-bottom: 1px solid #ebeef5;
}

:deep(.container-code .vue-codemirror) {
  min-height: 120px;
  padding: 12px 14px;
  font-size: 14px;
}

:deep(.container-list) {
  height: 330px;
}

:deep(.fields-container),
:deep(.formula-menu) {
  padding: 12px;
}

:deep(.fields-container) {
  width: 258px;
}

:deep(.formula-menu) {
  width: 286px;
  border-left: 1px solid #ebeef5;
}

:deep(.formula-intro) {
  margin: 0;
  padding: 12px;
  border-left: 1px solid #ebeef5;
  height: 100%;
}
</style>

<style lang="scss"> 
.data-management-aggregate-field-formula-dialog-panel {
  background-color: var(--bg-color-page);
  --el-dialog-padding-primary: 0;
  border-radius: 4px;

  .el-dialog__header {
    margin: 0;
    padding: 12px 16px;
    border-bottom: 1px solid #ebeef5;
  }

  .el-dialog__body {
    padding: 20px;
    border-bottom: 1px solid #ebeef5;
  }

  .el-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;

    .el-button {
      border-radius: 4px;
    }
  }
}
</style>
