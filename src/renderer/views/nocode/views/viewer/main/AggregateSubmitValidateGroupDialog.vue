<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-submit-validate-group-dialog"
    width="960"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @open="onOpen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateSubmitValidateGroupDialog.addValidateRule') }}</div>
      </div>
    </template>

    <div class="aggregate-submit-validate-group-dialog__body">
      <div class="warning-banner">
        <el-icon :size="14"><i-ep-warning /></el-icon>
        <span>{{ $t('AggregateSubmitValidateGroupDialog.validateRuleTip') }}</span>
      </div>

      <div class="group-section">
        <div class="group-section__header">
          <div class="group-section__title">{{ $t('AggregateSubmitValidateGroupDialog.validationCondition') }}</div>

          <button class="group-section__add" type="button" @click="handleAddRule">
            <el-icon><i-ep-plus /></el-icon>
            {{ $t('AggregateSubmitValidateGroupDialog.addConditionGroup') }}
          </button>
        </div>

        <div v-for="(rule, groupIndex) in draftConfig.rules" :key="rule.uid" class="rule-card">
          <div class="rule-card__header">
            <div class="rule-card__title">{{ $t('AggregateSubmitValidateGroupDialog.conditionGroup') }}{{ groupIndex + 1 }}</div>

            <button class="rule-card__delete" type="button" @click="handleRemoveRule(groupIndex)">
              <el-icon><i-ep-close /></el-icon>
            </button>
          </div>

          <div class="rule-card__body">
            <div class="rule-field">
              <div class="rule-field__label">{{ $t('AggregateSubmitValidateGroupDialog.validationFailTipLabel') }}</div>
              <el-input
                v-model="rule.errorText"
                class="rule-field__control"
                :placeholder="$t('AggregateSubmitValidateGroupDialog.inputValidationFailTip')"
              />
            </div>

            <div
              v-for="(condition, conditionIndex) in rule.conditions"
              :key="`${rule.uid}_${conditionIndex}`"
              class="condition-block"
            >
              <div class="condition-block__label">{{ conditionIndex === 0 ? $t('AggregateSubmitValidateGroupDialog.when') : $t('AggregateSubmitValidateGroupDialog.and') }}</div>

              <div class="condition-block__row">
                <el-select
                  :model-value="condition.type || FormConditionValueType.FORM"
                  class="condition-block__type"
                  @update:model-value="(value) => handleConditionTypeChange(condition, value)"
                >
                  <el-option :value="FormConditionValueType.FORM" :label="$t('AggregateSubmitValidateGroupDialog.field')" />
                  <el-option :value="FormConditionValueType.FORMULA" :label="$t('AggregateSubmitValidateGroupDialog.formulaEdit')" />
                </el-select>

                <template v-if="condition.type === FormConditionValueType.FORMULA">
                  <button
                    class="condition-block__formula-btn"
                    :class="{ 'is-configured': Boolean(condition.formula) }"
                    type="button"
                    @click="handleOpenFormulaDialog(groupIndex, conditionIndex)"
                  >
                    {{ condition.formula ? $t('AggregateSubmitValidateGroupDialog.formulaConfigured') : $t('AggregateSubmitValidateGroupDialog.setFormula') }}
                  </button>
                </template>

                <template v-else>
                  <el-select
                    v-model="condition.uid"
                    class="condition-block__field"
                    filterable
                    clearable
                    :placeholder="$t('AggregateSubmitValidateGroupDialog.selectField')"
                  >
                    <el-option
                      v-for="item in metricOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>

                  <el-select
                    :model-value="condition.func || RuleFunc.EQUAL"
                    class="condition-block__operator"
                    :placeholder="$t('AggregateSubmitValidateGroupDialog.select')"
                    @update:model-value="(value) => handleConditionFuncChange(condition, value)"
                  >
                    <el-option
                      v-for="item in operatorOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>

                  <div class="condition-block__value">
                    <template v-if="condition.func === RuleFunc.BETWEEN">
                      <div class="condition-range">
                        <el-input
                          :model-value="Array.isArray(condition.value) ? condition.value[0] : ''"
                          type="number"
                          :placeholder="$t('AggregateSubmitValidateGroupDialog.minValue')"
                          @update:model-value="(value) => handleRangeValueChange(condition, 0, value)"
                        />
                        <span class="condition-range__separator">~</span>
                        <el-input
                          :model-value="Array.isArray(condition.value) ? condition.value[1] : ''"
                          type="number"
                          :placeholder="$t('AggregateSubmitValidateGroupDialog.maxValue')"
                          @update:model-value="(value) => handleRangeValueChange(condition, 1, value)"
                        />
                      </div>
                    </template>

                    <template v-else>
                      <el-input
                        v-model="condition.value"
                        type="number"
                        :placeholder="$t('AggregateSubmitValidateGroupDialog.input')"
                      />
                    </template>
                  </div>
                </template>

                <button
                  v-if="rule.conditions.length > 1"
                  class="condition-block__delete"
                  type="button"
                  @click="handleRemoveCondition(groupIndex, conditionIndex)"
                >
                  <el-icon><i-ep-delete /></el-icon>
                </button>
              </div>
            </div>

            <button class="rule-card__add-condition" type="button" @click="handleAddCondition(rule)">
              <el-icon><i-ep-plus /></el-icon>
              {{ $t('AggregateSubmitValidateGroupDialog.addCondition') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <aggregate-submit-validate-dialog
      v-model="formulaDialogVisible"
      :table-uid="tableUid"
      :metrics="metrics"
      :value="editingFormulaValue"
      @update="handleFormulaDialogUpdate"
    />

    <template #footer>
      <el-button @click="handleClose">{{ $t('AggregateSubmitValidateGroupDialog.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('AggregateSubmitValidateGroupDialog.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  AggregateMetric,
  AggregateSubmitValidateConfig,
  AggregateSubmitValidateRule,
  FormCondition,
  FormConditionValueType,
  RuleFunc,
  RuleFuncTextMapping,
} from '@common/types/nocode';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, ref } from 'vue';
import AggregateSubmitValidateDialog from './AggregateSubmitValidateDialog.vue';

type AggregateSubmitValidateRuleDraft = AggregateSubmitValidateRule & {
  conditions: FormCondition[],
};

type AggregateSubmitValidateConfigDraft = {
  enabled: boolean,
  rules: AggregateSubmitValidateRuleDraft[],
};

const props = withDefaults(defineProps<{
  modelValue: boolean,
  tableUid: string,
  metrics?: AggregateMetric[],
  value?: AggregateSubmitValidateConfig | null,
}>(), {
  metrics: () => [],
  value: undefined,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value: AggregateSubmitValidateConfig): void,
}>();

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const createDefaultCondition = (condition?: Partial<FormCondition> | null): FormCondition => {
  const nextType = condition?.type || (condition?.formula ? FormConditionValueType.FORMULA : FormConditionValueType.FORM);
  let nextValue = deepClone(condition?.value ?? null);

  if (nextType === FormConditionValueType.FORM) {
    if (condition?.func === RuleFunc.BETWEEN) {
      nextValue = Array.isArray(nextValue) ? nextValue : [null, null];
    } else if (nextValue === null || nextValue === undefined) {
      nextValue = '';
    }
  }

  return {
    uid: condition?.uid || '',
    func: condition?.func || RuleFunc.EQUAL,
    value: nextValue,
    formula: condition?.formula || '',
    fixedValue: deepClone(condition?.fixedValue ?? null),
    type: nextType,
    tFormat: deepClone(condition?.tFormat ?? null),
  } as FormCondition;
};

const createDefaultRule = (rule?: AggregateSubmitValidateRule | null): AggregateSubmitValidateRuleDraft => {
  const conditions = (rule?.conditions?.length
    ? rule.conditions
    : (rule?.formula ? [{ type: FormConditionValueType.FORMULA, formula: rule.formula }] : [createDefaultCondition()]))
    .map(item => createDefaultCondition(item));

  return {
    uid: rule?.uid || createId('submit_validate_rule'),
    errorText: rule?.errorText || i18next.t('AggregateSubmitValidateGroupDialog.defaultSubmitValidateError'),
    formula: rule?.formula || '',
    conditions,
  };
};

const createDefaultConfig = (config?: AggregateSubmitValidateConfig | null): AggregateSubmitValidateConfigDraft => ({
  enabled: Boolean(config?.enabled),
  rules: (config?.rules || []).map(item => createDefaultRule(item)),
});

const operatorOptions: { label: string, value: RuleFunc }[] = [
  { label: RuleFuncTextMapping[RuleFunc.EQUAL], value: RuleFunc.EQUAL },
  { label: RuleFuncTextMapping[RuleFunc.NOT_EQUAL], value: RuleFunc.NOT_EQUAL },
  { label: RuleFuncTextMapping[RuleFunc.GT], value: RuleFunc.GT },
  { label: RuleFuncTextMapping[RuleFunc.GTE], value: RuleFunc.GTE },
  { label: RuleFuncTextMapping[RuleFunc.LT], value: RuleFunc.LT },
  { label: RuleFuncTextMapping[RuleFunc.LTE], value: RuleFunc.LTE },
  { label: RuleFuncTextMapping[RuleFunc.BETWEEN], value: RuleFunc.BETWEEN },
];

const draftConfig = ref<AggregateSubmitValidateConfigDraft>(createDefaultConfig());
const formulaDialogVisible = ref(false);
const editingFormulaGroupIndex = ref(-1);
const editingFormulaConditionIndex = ref(-1);
const editingFormulaValue = ref('');

const metricOptions = computed(() => (props.metrics || []).map(metric => ({
  label: metric.name || i18next.t('AggregateSubmitValidateGroupDialog.unnamedMetric'),
  value: metric.uid,
})));

const handleAddRule = () => {
  draftConfig.value.rules.push(createDefaultRule());
};

const handleRemoveRule = (groupIndex: number) => {
  draftConfig.value.rules.splice(groupIndex, 1);
};

const handleAddCondition = (rule: AggregateSubmitValidateRuleDraft) => {
  rule.conditions.push(createDefaultCondition());
};

const handleRemoveCondition = (groupIndex: number, conditionIndex: number) => {
  draftConfig.value.rules[groupIndex].conditions.splice(conditionIndex, 1);
};

const handleConditionTypeChange = (condition: FormCondition, value?: FormConditionValueType) => {
  condition.type = value || FormConditionValueType.FORM;
  condition.uid = '';
  condition.formula = '';
  condition.fixedValue = null;
  condition.tFormat = null;
  condition.func = RuleFunc.EQUAL;
  condition.value = condition.type === FormConditionValueType.FORMULA ? null : '';
};

const handleConditionFuncChange = (condition: FormCondition, value?: RuleFunc) => {
  condition.func = value || RuleFunc.EQUAL;
  condition.value = condition.func === RuleFunc.BETWEEN ? [null, null] : '';
};

const handleRangeValueChange = (condition: FormCondition, index: number, value: string | number) => {
  const nextValue = Array.isArray(condition.value) ? [...condition.value] : [null, null];
  nextValue[index] = value;
  condition.value = nextValue;
};

const handleOpenFormulaDialog = (groupIndex: number, conditionIndex: number) => {
  editingFormulaGroupIndex.value = groupIndex;
  editingFormulaConditionIndex.value = conditionIndex;
  editingFormulaValue.value = draftConfig.value.rules[groupIndex]?.conditions?.[conditionIndex]?.formula || '';
  formulaDialogVisible.value = true;
};

const handleFormulaDialogUpdate = (formula: string) => {
  const condition = draftConfig.value.rules[editingFormulaGroupIndex.value]?.conditions?.[editingFormulaConditionIndex.value];
  if (!condition) return;
  condition.formula = formula;
};

const normalizeFieldConditionValue = (condition: FormCondition) => {
  if (condition.func === RuleFunc.BETWEEN) {
    const value = Array.isArray(condition.value) ? condition.value : [null, null];
    return [Number(value[0]), Number(value[1])];
  }
  return Number(condition.value);
};

const hasEmptyFieldValue = (condition: FormCondition) => {
  if (condition.func === RuleFunc.BETWEEN) {
    return !Array.isArray(condition.value) || condition.value.some(item => item === '' || item === null || item === undefined);
  }
  return condition.value === '' || condition.value === null || condition.value === undefined;
};

const validateDraft = () => {
  if (!draftConfig.value.rules.length) {
    ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.atLeastOneConditionGroup'));
    return false;
  }

  for (let groupIndex = 0; groupIndex < draftConfig.value.rules.length; groupIndex += 1) {
    const rule = draftConfig.value.rules[groupIndex];
    if (!rule.errorText.trim()) {
      ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.inputConditionGroupErrorText', {
        groupIndex: groupIndex + 1,
      }));
      return false;
    }
    if (!rule.conditions.length) {
      ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.atLeastOneConditionInGroup', {
        groupIndex: groupIndex + 1,
      }));
      return false;
    }

    for (let conditionIndex = 0; conditionIndex < rule.conditions.length; conditionIndex += 1) {
      const condition = rule.conditions[conditionIndex];
      if (condition.type === FormConditionValueType.FORMULA) {
        if (!`${condition.formula || ''}`.trim()) {
          ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.setFormulaCondition', {
            groupIndex: groupIndex + 1,
            conditionIndex: conditionIndex + 1,
          }));
          return false;
        }
        continue;
      }

      if (!condition.uid) {
        ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.selectMetricField', {
          groupIndex: groupIndex + 1,
          conditionIndex: conditionIndex + 1,
        }));
        return false;
      }
      if (!condition.func) {
        ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.selectCompareMethod', {
          groupIndex: groupIndex + 1,
          conditionIndex: conditionIndex + 1,
        }));
        return false;
      }
      if (hasEmptyFieldValue(condition)) {
        ElMessage.error(i18next.t('AggregateSubmitValidateGroupDialog.inputCompareValue', {
          groupIndex: groupIndex + 1,
          conditionIndex: conditionIndex + 1,
        }));
        return false;
      }
    }
  }

  return true;
};

const onOpen = () => {
  draftConfig.value = createDefaultConfig(props.value);
  if (!draftConfig.value.rules.length) {
    draftConfig.value.rules.push(createDefaultRule());
  }
};

const handleClose = () => {
  formulaDialogVisible.value = false;
  editingFormulaGroupIndex.value = -1;
  editingFormulaConditionIndex.value = -1;
  editingFormulaValue.value = '';
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  if (!validateDraft()) return;

  const rules = draftConfig.value.rules.map(rule => {
    const conditions = rule.conditions.map(condition => {
      if (condition.type === FormConditionValueType.FORMULA) {
        return {
          uid: '',
          func: condition.func || RuleFunc.EQUAL,
          value: null,
          formula: `${condition.formula || ''}`.trim(),
          fixedValue: null,
          type: FormConditionValueType.FORMULA,
          tFormat: null,
        } as FormCondition;
      }

      return {
        uid: condition.uid || '',
        func: condition.func || RuleFunc.EQUAL,
        value: normalizeFieldConditionValue(condition),
        formula: '',
        fixedValue: null,
        type: FormConditionValueType.FORM,
        tFormat: null,
      } as FormCondition;
    });

    return {
      uid: rule.uid,
      errorText: rule.errorText.trim(),
      formula: conditions.length === 1 && conditions[0].type === FormConditionValueType.FORMULA
        ? conditions[0].formula || ''
        : '',
      conditions,
    } as AggregateSubmitValidateRule;
  });

  emit('update', {
    enabled: Boolean(rules.length),
    rules,
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

@mixin common-select {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  :deep(.el-select__wrapper) {
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

.aggregate-submit-validate-group-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  @include common-input;
  @include common-select;
}

.warning-banner {
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff8e6;
  color: #c28b00;
  font-size: 14px;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.group-section__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
}

.group-section__add,
.rule-card__add-condition {
  width: fit-content;
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 14px;
  line-height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.rule-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.rule-card__header {
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid #ebeef5;
  background: #f7f8fa;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rule-card__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
}

.rule-card__delete,
.condition-block__delete {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #86909c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rule-card__delete:hover,
.condition-block__delete:hover {
  background: #f2f3f5;
  color: #1f2329;
}

.rule-card__body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rule-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-field__label {
  color: #4e5969;
  font-size: 14px;
  line-height: 22px;
}

.condition-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.condition-block__label {
  color: #86909c;
  font-size: 14px;
  line-height: 22px;
}

.condition-block__row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) 146px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;

}

.condition-block__formula-btn {
  grid-column: span 3;
  width: 100%;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 4px;
  background: var(--bg-color-overlay);
  color: var(--text-color-regular);
  font-size: 12px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}

.condition-block__formula-btn.is-configured {
  color: #1677ff;
}

.condition-block__value {
  min-width: 0;
}

.condition-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.condition-range__separator {
  color: #86909c;
  font-size: 13px;
}

@media (max-width: 1280px) {
  .condition-block__row {
    grid-template-columns: 104px minmax(0, 1fr) 180px minmax(0, 1fr) auto;
    gap: 10px;
  }
}
</style>

<style lang="scss">
.aggregate-submit-validate-group-dialog {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;
  border-radius: 8px;
  width: 680px;

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
    max-height: 70vh;
    overflow: auto;
  }

  .el-dialog__footer {
    height: var(--dialog-footer-height);
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: end;
    align-items: center;
    background: var(--bg-color-page);
    border-radius: 0 0 8px 8px;
  }

  .el-dialog__footer .el-button {
    border-radius: 4px;
  }
}
</style>
