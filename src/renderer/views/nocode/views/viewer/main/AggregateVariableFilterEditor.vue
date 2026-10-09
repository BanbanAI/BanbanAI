<template>
  <div
    class="aggregate-variable-filter-editor"
    :class="{
      'aggregate-variable-filter-editor--compact': compact,
      'aggregate-variable-filter-editor--inline': inline,
    }"
  >
    <div v-if="sourceLabel && !hideSourceLabel" class="source-label">{{ sourceLabel }}</div>

    <el-config-provider :locale="locale">
      <div v-if="draftFilterRule.conditions.length" class="condition-list">
        <div
          v-for="(condition, index) in draftFilterRule.conditions"
          :key="`${condition.uid || 'empty'}_${index}`"
          class="condition-item"
          :class="{
            'condition-item--compact': compact,
            'condition-item--hidden-value': isValueHidden(condition),
          }"
        >
          <el-select
            :model-value="condition.uid"
            class="condition-item__field"
            :placeholder="$t('AggregateVariableFilterEditor.selectField')"
            filterable
            clearable
            @update:model-value="(value) => handleFieldChange(condition, value)"
          >
            <el-option v-for="option in fieldOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>

          <el-select
            :model-value="condition.func"
            class="condition-item__func"
            :placeholder="$t('AggregateVariableFilterEditor.select')"
            :disabled="!condition.uid"
            @update:model-value="(value) => handleFuncChange(condition, value)"
          >
            <el-option v-for="option in getFuncOptions(condition)" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>

          <div v-if="!isValueHidden(condition)" class="condition-item__value">
            <div v-if="isNumberRange(condition)" class="condition-item__range">
              <el-input v-model="condition.value[0]" type="number" :placeholder="$t('AggregateVariableFilterEditor.inputStartValue')" />
              <span class="condition-item__range-separator">-</span>
              <el-input v-model="condition.value[1]" type="number" :placeholder="$t('AggregateVariableFilterEditor.inputEndValue')" />
            </div>

            <el-date-picker
              v-else-if="isDateRange(condition)"
              v-model="condition.value"
              type="daterange"
              value-format="YYYY-MM-DD"
              :start-placeholder="$t('AggregateVariableFilterEditor.startDate')"
              :end-placeholder="$t('AggregateVariableFilterEditor.endDate')"
              class="condition-item__control"
            />

            <el-date-picker
              v-else-if="isDateValue(condition)"
              v-model="condition.value"
              type="date"
              value-format="YYYY-MM-DD"
              :placeholder="$t('AggregateVariableFilterEditor.selectDate')"
              class="condition-item__control"
            />

            <date-dynamic-filter-value-select
              v-else-if="isDynamicDateValue(condition)"
              :model-value="condition.value"
              :append-to="'body'"
              :teleported="true"
              @update:model-value="condition.value = $event"
            />

            <el-time-picker
              v-else-if="isTimeValue(condition)"
              v-model="condition.value"
              value-format="HH:mm:ss"
              :placeholder="$t('AggregateVariableFilterEditor.selectTime')"
              class="condition-item__control"
            />

            <el-select-v2
              v-else-if="isSingleSelectValue(condition)"
              v-model="condition.value"
              clearable
              filterable
              :options="getSelectOptions(condition)"
              :placeholder="$t('AggregateVariableFilterEditor.select')"
              class="condition-item__control"
            />

            <el-select-v2
              v-else-if="isMultipleSelectValue(condition)"
              v-model="condition.value"
              clearable
              filterable
              multiple
              :options="getSelectOptions(condition)"
              :placeholder="$t('AggregateVariableFilterEditor.select')"
              class="condition-item__control"
            />

            <el-input-tag
              v-else-if="isTagsValue(condition)"
              v-model="condition.value"
              collapse-tags
              collapse-tags-tooltip
              tag-type="primary"
              filterable
              class="condition-item__control"
              :placeholder="$t('AggregateVariableFilterEditor.inputAndEnter')"
            />

            <el-input
              v-else-if="isNumberValue(condition)"
              v-model="condition.value"
              type="number"
              :placeholder="$t('AggregateVariableFilterEditor.input')"
              class="condition-item__control"
            />

            <el-input
              v-else
              v-model="condition.value"
              :placeholder="$t('AggregateVariableFilterEditor.select')"
              class="condition-item__control"
            />
          </div>

          <button class="condition-item__delete" type="button" @click="handleRemoveCondition(index)">
            <el-icon><i-ep-delete /></el-icon>
          </button>
        </div>
      </div>

    </el-config-provider>

    <button class="add-condition-btn" type="button" @click="handleAddCondition">
      <el-icon><i-ep-plus /></el-icon>
      {{ $t('AggregateVariableFilterEditor.addCondition') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { FilterRule, FormCondition, LogicalOperator, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { elementPlusLocale as locale } from '@renderer/utils/elementPlusLocale';
import { Field } from '@common/types/project';
import { formElementInstances } from '@renderer/utils/instance';
import DateDynamicFilterValueSelect from '@renderer/views/nocode/components/global/DateDynamicFilterValueSelect.vue';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { ref, watch } from 'vue';

type AggregateFilterFieldOption = {
  value: string,
  label: string,
  field?: Field | null,
};

type ConditionValueInfo = {
  type?: RuleFuncValue,
  subType?: string,
};

const props = withDefaults(defineProps<{
  value?: FilterRule | null,
  sourceLabel?: string,
  fieldOptions?: AggregateFilterFieldOption[],
  hideSourceLabel?: boolean,
  compact?: boolean,
  inline?: boolean,
  autoSave?: boolean,
  syncKey?: string,
}>(), {
  value: undefined,
  sourceLabel: '',
  fieldOptions: () => [],
  hideSourceLabel: false,
  compact: false,
  inline: false,
  autoSave: false,
  syncKey: '',
});

const emit = defineEmits<{
  (event: 'change', value?: FilterRule): void,
}>();

const draftFilterRule = ref<FilterRule>({
  logic: LogicalOperator.AND,
  conditions: [],
});
const fieldFuncInfoMap = ref<Record<string, Partial<Record<RuleFunc, RuleFuncValue>>>>({});
const syncing = ref(false);

const getFieldByCondition = (condition: FormCondition) => props.fieldOptions.find(item => item.value === condition.uid)?.field;
const getConditionValueInfo = (condition: FormCondition): ConditionValueInfo => {
  const field = getFieldByCondition(condition);
  return {
    type: fieldFuncInfoMap.value[condition.uid]?.[condition.func],
    subType: field?.meta?.subType,
  };
};

const getFallbackFuncInfo = (field?: Field | null): Partial<Record<RuleFunc, RuleFuncValue>> => {
  if (!field) return {};
  if (field.type === 'number') {
    return {
      [RuleFunc.EQUAL]: RuleFuncValue.NUMBER,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.NUMBER,
      [RuleFunc.GT]: RuleFuncValue.NUMBER,
      [RuleFunc.GTE]: RuleFuncValue.NUMBER,
      [RuleFunc.LT]: RuleFuncValue.NUMBER,
      [RuleFunc.LTE]: RuleFuncValue.NUMBER,
      [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
    };
  }

  return {
    [RuleFunc.EQUAL]: RuleFuncValue.STRING,
    [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
    [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
    [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
    [RuleFunc.EMPTY]: RuleFuncValue.NULL,
    [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
  };
};

const isValueHidden = (condition: FormCondition) => [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func);
const isNumberRange = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.RANGE && getConditionValueInfo(condition).subType !== 'date';
const isDateRange = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.RANGE && getConditionValueInfo(condition).subType === 'date';
const isDateValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.DATE;
const isDynamicDateValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.STRING && getConditionValueInfo(condition).subType === 'date';
const isTimeValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.TIME;
const isSingleSelectValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.SELECT;
const isMultipleSelectValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.SELECT_MULTIPLE;
const isTagsValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.TAGS;
const isNumberValue = (condition: FormCondition) => getConditionValueInfo(condition).type === RuleFuncValue.NUMBER;

const getSelectOptions = (condition: FormCondition) => {
  const field = getFieldByCondition(condition);
  const choices = (field?.meta?.extra as any)?.choices || [];
  return choices.map(item => typeof item === 'string' ? ({ label: item, value: item }) : item);
};

const getFuncOptions = (condition: FormCondition) => Object.keys(fieldFuncInfoMap.value[condition.uid] || {}).map(key => ({
  label: RuleFuncTextMapping[key as RuleFunc],
  value: key as RuleFunc,
}));

const setConditionDefaultValue = (condition: FormCondition) => {
  if (isValueHidden(condition)) {
    condition.value = null;
    return;
  }
  if (isNumberRange(condition)) {
    condition.value = [null, null];
    return;
  }
  if (isDateRange(condition)) {
    condition.value = [];
    return;
  }
  if (isMultipleSelectValue(condition) || isTagsValue(condition)) {
    condition.value = [];
    return;
  }
  condition.value = null;
};

const loadFieldFuncInfoMap = async () => {
  const entries = await Promise.all(props.fieldOptions.map(async option => {
    const widgetType = option.field?.meta?.extra?.widgetType;
    if (!widgetType) return [option.value, getFallbackFuncInfo(option.field)] as const;
    try {
      const widget = await formElementInstances.getInstance(widgetType);
      const config = await widget.getConfigurations();
      return [option.value, config.editFuncInfo || getFallbackFuncInfo(option.field)] as const;
    } catch (error) {
      return [option.value, getFallbackFuncInfo(option.field)] as const;
    }
  }));
  fieldFuncInfoMap.value = Object.fromEntries(entries);
};

const applyFieldToCondition = (condition: FormCondition, value?: string) => {
  condition.uid = value || '';
  const [firstFunc] = Object.keys(fieldFuncInfoMap.value[condition.uid] || {});
  condition.func = (firstFunc as RuleFunc) || RuleFunc.EQUAL;
  setConditionDefaultValue(condition);
};

const createDefaultCondition = (): FormCondition => {
  const condition: FormCondition = {
    uid: '',
    func: RuleFunc.EQUAL,
    value: null,
  };
  applyFieldToCondition(condition, props.fieldOptions[0]?.value);
  return condition;
};

const normalizeDraftFilterRule = () => {
  const nextValue = deepClone(props.value) || {
    logic: LogicalOperator.AND,
    conditions: [],
  };
  nextValue.logic = LogicalOperator.AND;
  nextValue.conditions = (nextValue.conditions || []).filter(condition => props.fieldOptions.some(item => item.value === condition.uid));
  nextValue.conditions.forEach(condition => {
    if (!fieldFuncInfoMap.value[condition.uid]?.[condition.func]) {
      applyFieldToCondition(condition, condition.uid);
    }
  });
  if (!nextValue.conditions.length && props.fieldOptions.length) {
    nextValue.conditions.push(createDefaultCondition());
  }
  draftFilterRule.value = nextValue;
};

const getOutputValue = () => {
  const conditions = draftFilterRule.value.conditions.filter(condition => condition.uid || condition.func || condition.value !== null);
  if (!conditions.length) return undefined;
  return {
    logic: LogicalOperator.AND,
    conditions: deepClone(conditions),
  } as FilterRule;
};

const validateCondition = (condition: FormCondition) => {
  if (!condition.uid) return false;
  if (!condition.func) return false;
  if (isValueHidden(condition)) return true;
  if (isNumberRange(condition) || isDateRange(condition)) {
    return Array.isArray(condition.value) && condition.value.length === 2 && condition.value.every(item => item !== null && item !== undefined && item !== '');
  }
  if (Array.isArray(condition.value)) return condition.value.length > 0;
  return condition.value !== null && condition.value !== undefined && condition.value !== '';
};

const validate = (silent: boolean = false) => {
  const conditions = draftFilterRule.value.conditions.filter(condition => condition.uid || condition.func || condition.value !== null);
  if (!conditions.length) return true;
  const isValid = conditions.every(validateCondition);
  if (!isValid && !silent) {
    ElMessage.error(i18next.t('AggregateVariableFilterEditor.filterConditionIncomplete'));
  }
  return isValid;
};

const emitAutoSave = () => {
  if (!props.autoSave || syncing.value) return;
  const value = getOutputValue();
  if (!value) {
    emit('change', undefined);
    return;
  }
  if (validate(true)) {
    emit('change', value);
  }
};

const syncDraftFilterRule = async () => {
  syncing.value = true;
  await loadFieldFuncInfoMap();
  normalizeDraftFilterRule();
  syncing.value = false;
};

const handleAddCondition = () => {
  draftFilterRule.value.conditions.push(createDefaultCondition());
};

const handleFieldChange = (condition: FormCondition, value?: string) => {
  applyFieldToCondition(condition, value);
};

const handleFuncChange = (condition: FormCondition, value?: RuleFunc) => {
  condition.func = value || RuleFunc.EQUAL;
  setConditionDefaultValue(condition);
};

const handleRemoveCondition = (index: number) => {
  draftFilterRule.value.conditions.splice(index, 1);
};

watch(
  () => [props.syncKey, props.fieldOptions],
  () => {
    syncDraftFilterRule();
  },
  { immediate: true }
);

watch(
  draftFilterRule,
  () => {
    emitAutoSave();
  },
  { deep: true }
);

defineExpose({
  validate,
  getValue: getOutputValue,
  reload: syncDraftFilterRule,
});
</script>

<style scoped lang="scss">
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
  :deep(.el-date-editor.el-input__wrapper),
  :deep(.el-time-editor.el-input__wrapper),
  :deep(.el-input-tag__wrapper),
  :deep(.el-input-number__wrapper) {
    width: 100%;
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

.aggregate-variable-filter-editor {
  min-height: 300px;
}

.aggregate-variable-filter-editor--inline {
  min-height: auto;
}

.source-label {
  margin-bottom: 16px;
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
}

.condition-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.condition-item {
  display: grid;
  grid-template-columns: 220px 120px minmax(0, 1fr) 28px;
  grid-template-areas: "field func value delete";
  gap: 12px;
  align-items: center;
}

.condition-item__field {
  grid-area: field;
  width: 100%;
  @include common-select;
}

.condition-item__func {
  grid-area: func;
  width: 104px;
  @include common-select;
  flex: 0 0 auto;
}

.condition-item__value {
  grid-area: value;
  min-width: 0;
}

.condition-item__control {
  @include common-input;
  @include common-select;
}

.condition-item__range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  @include common-input;
}

.condition-item__range-separator {
  color: #909399;
  text-align: center;
}

.condition-item__delete {
  grid-area: delete;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #c0c4cc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.condition-item__delete:hover {
  color: var(--color-danger);
}

.add-condition-btn {
  margin-top: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: #409eff;
  font-size: 13px;
  line-height: 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.condition-item--compact {
  width: 100%;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "field func"
    "value delete";
  row-gap: 8px;
  column-gap: 10px;
  align-items: start;

  display: flex;
  flex-wrap: wrap;
  column-gap: 10px;
  row-gap: 8px;
}

.condition-item--compact.condition-item--hidden-value {
  grid-template-columns: 1fr auto;
  grid-template-areas: "field func";
  align-items: center;
}

.aggregate-variable-filter-editor--compact .condition-list {
  gap: 16px;
}

.aggregate-variable-filter-editor--compact .condition-item__field,
.aggregate-variable-filter-editor--compact .condition-item__value {
  flex: 1 1 calc(100% - 120px);
  min-width: 0;
}

.aggregate-variable-filter-editor--compact .condition-item__delete {
  width: 24px;
  height: 32px;
  color: #8f959e;
  justify-self: start;
  align-self: center;
  flex: 0 0 auto;
}

.aggregate-variable-filter-editor--compact .condition-item__delete:hover {
  color: var(--color-danger);
}

.aggregate-variable-filter-editor--compact .condition-item--hidden-value .condition-item__delete {
  display: none;
}

.aggregate-variable-filter-editor--compact .add-condition-btn {
  margin-top: 14px;
  color: #1677ff;
  font-size: 14px;
  line-height: 22px;
  gap: 6px;
}

.aggregate-variable-filter-editor--compact .add-condition-btn :deep(.el-icon) {
  font-size: 16px;
}

.aggregate-variable-filter-editor--compact :deep(.el-empty) {
  min-height: 120px;
  padding: 8px 0 0;
}
</style>
