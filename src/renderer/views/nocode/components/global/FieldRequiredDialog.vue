<template>
  <div class="field-required-rule-container">
    <el-dialog
      class="field-required-dialog"
      :modelValue="modelValue"
      :title="$t('FieldRequiredDialog.title')"
      width="680"
      @update:modelValue="emit('update:modelValue', $event)"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      @open="onOpen"
      @closed="onClosed"
      draggable
    >
      <el-scrollbar class="container-scrollbar">
        <div class="container">
          <div class="warning-banner">
            <el-icon :size="16"><i-ep-warning /></el-icon>
            <span>{{ $t("FieldRequiredDialog.typeMatchTip") }}</span>
          </div>

          <div class="header">
            <div class="current-field-row">
              <div class="field-info">
                <span class="text">{{ $t("FieldRequiredDialog.current") }}</span>
                <span class="tag">{{ currentWidgetLabel }}</span>
              </div>
              <div class="actions">
                <el-button link type="primary" :disabled="!rule.conditions.length" @click="handleClearConditions">
                  <el-icon style="margin-right: 4px">
                    <Delete />
                  </el-icon>
                  {{ $t("FieldRequiredDialog.clear") }}
                </el-button>
              </div>
            </div>

            <div class="condition-row">
              <div class="condition-text">
                <span class="text">{{ $t("FieldRequiredDialog.ifCurrentFieldMeet") }}</span>
                <el-select v-model="rule.logic" class="logic-select" :suffix-icon="CaretBottom">
                  <el-option :label="$t('FieldRequiredDialog.all')" :value="LogicalOperator.AND" />
                  <el-option :label="$t('FieldRequiredDialog.any')" :value="LogicalOperator.OR" />
                </el-select>
                <span class="text">{{ $t("FieldRequiredDialog.condition") }}</span>
                <span class="text">{{ $t("FieldRequiredDialog.currentFieldIsRequired") }}</span>
              </div>
              <div class="actions">
                <el-button type="primary" link @click="handleAddCondition">
                  <el-icon style="margin-right: 4px">
                    <Plus />
                  </el-icon>
                  {{ $t("FieldRequiredDialog.addCondition") }}
                </el-button>
              </div>
            </div>
          </div>

          <div class="condition-list">
            <div class="condition-item" v-for="(condition, index) in rule.conditions" :key="`${condition.uid || 'empty'}-${index}`">
              <div class="condition-field">
                <el-select
                  v-model="condition.uid"
                  filterable
                  :placeholder="$t('FieldRequiredDialog.selectField')"
                  @change="handleCurrentFieldChange(condition)"
                >
                  <el-option
                    v-for="item in fieldOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                  <template #label="{ label, value }">
                    <span v-if="fieldOptions.some(item => item.value === value)">{{ label }}</span>
                    <span v-else class="deleted-field">{{ $t("FieldRequiredDialog.fieldDeleted") }}</span>
                  </template>
                </el-select>
              </div>

              <div class="condition-rule" :class="{ disabled: !condition.uid }">
                <el-select
                  v-model="condition.func"
                  :suffix-icon="CaretBottom"
                  :disabled="!condition.uid"
                  @change="handleConditionFuncChange(condition)"
                >
                  <el-option
                    v-for="value, key in getConditionRules(condition.uid)"
                    :key="key"
                    :label="getFuncTextLabel(key, condition.uid)"
                    :value="key"
                  />
                </el-select>
              </div>

              <div class="condition-value">
                <form-filter-value-format
                  v-model="condition.value"
                  :disabled="isValueInputDisabled(condition)"
                  class="custom-input"
                  :element="getConditionWidget(condition.uid)"
                  :otherTableFieldUID="getConditionWidget(condition.uid)?.form?.tableUID || getForm().tableUID"
                  :selectElementUid="condition.uid"
                  :type="getConditionWidget(condition.uid)?.getConfigurations().editFuncInfo[condition.func]"
                  :placeholder="$t('FieldRequiredDialog.inputValue')"
                  :widget="widget"
                />
              </div>

              <div class="delete">
                <el-icon :size="16" @click="handleRemoveCondition(index)">
                  <Delete />
                </el-icon>
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>

      <template #footer>
        <el-button type="default" @click="emit('update:modelValue', false)">{{ $t("FieldRequiredDialog.cancel") }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t("FieldRequiredDialog.confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { FilterRule, FormCondition } from "@common/types/nocode";
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue } from "@common/types/nocode";
import { LogicalOperator } from "@renderer/b2/types";
import { AbstractSubForm, FormElement } from "@renderer/b2/controllers/form";
import { deepClone, isEmpty } from "@common/utils/object";
import { CaretBottom, Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import i18next from "i18next";
import type { PropType } from "vue";
import { computed, ref } from "vue";

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  value: {
    type: Object as PropType<FilterRule>,
    default: undefined,
  },
  widget: {
    type: Object as PropType<FormElement>,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "update"]);

type FieldOption = {
  label: string;
  value: string;
  widget: FormElement;
  fieldId: string;
  isSubField: boolean;
}

const notAllowSelectTypes = [
  "widget.form.subform",
  "widget.form.selectData",
  "widget.form.relatedData",
  "widget.form.richTextEditor",
  "widget.form.markdownEditor",
  "widget.form.splitLine",
  "widget.form.file-uploader",
  "widget.form.image-uploader",
  "widget.form.titleBar",
  "widget.form.imageTextShow",
  "widget.form.multipleTabs",
  "widget.form.tabPanel",
];

const rule = ref<FilterRule>({
  logic: LogicalOperator.AND,
  conditions: [],
});

const CONDITION_WIDGET_SEPARATOR = ".";

const getCurrentSubForm = () => {
  return props.widget.isInSubForm ? props.widget.form as AbstractSubForm : null;
};

const getForm = () => {
  return props.widget.topForm;
};

const getCurrentWidgetLabel = () => {
  if (!props.widget.isInSubForm) {
    return props.widget.title;
  }
  const currentSubForm = getCurrentSubForm();
  return `${currentSubForm?.title || ""}.${props.widget.title}`;
};

const getConditionForms = () => {
  const currentSubForm = getCurrentSubForm();
  if (!currentSubForm) {
    return {
      mainForm: props.widget.topForm,
      subForm: null,
    };
  }
  return {
    mainForm: props.widget.topForm,
    subForm: currentSubForm,
  };
};

const normalizeConditionUid = (uid: string, isSubField: boolean = false) => {
  if (!uid) return "";
  if (!props.widget.isInSubForm || !isSubField) return uid;
  const form = getCurrentSubForm();
  if (!form) return uid;
  const widgetIds = uid.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
  if (!widgetIds.length) return "";
  if (widgetIds.length > 1) return uid;
  return `${form.uid}${CONDITION_WIDGET_SEPARATOR}${uid}`;
};

const getConditionFieldUid = (uid: string) => {
  if (!uid) return "";
  const widgetIds = uid.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
  if (props.widget.isInSubForm && widgetIds.length > 1) {
    return widgetIds[1] || "";
  }
  return widgetIds[widgetIds.length - 1] || "";
};

const normalizeStoredConditionUid = (uid: string) => {
  if (!uid || !props.widget.isInSubForm) return uid;
  const widgetIds = uid.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
  if (widgetIds.length > 1) return uid;
  const currentSubForm = getCurrentSubForm();
  if (currentSubForm?.getChildElement(uid)) {
    return normalizeConditionUid(uid, true);
  }
  return uid;
};

const flattenWidgets = (elements: FormElement[], prefix = "", isSubField: boolean = false): FieldOption[] => {
  return elements.flatMap((element) => {
    if (element.type === "widget.form.multipleTabs") {
      return element.widgets.flatMap((tab: FormElement) => {
        const tabPrefix = prefix ? `${prefix}.${element.title}.${tab.title}` : `${element.title}.${tab.title}`;
        return flattenWidgets(tab.widgets as FormElement[], tabPrefix, isSubField);
      });
    }
    const conditionUid = normalizeConditionUid(element.uid, isSubField);
    const currentSubForm = getCurrentSubForm();
    const labelPrefix = isSubField ? `${currentSubForm?.title || ""}.` : "";
    return [{
      label: `${labelPrefix}${prefix ? `${prefix}.${element.title}` : element.title}`,
      value: conditionUid,
      widget: element,
      fieldId: getConditionFieldUid(conditionUid),
      isSubField,
    }];
  });
};

const fieldOptions = computed<FieldOption[]>(() => {
  const { mainForm, subForm } = getConditionForms();
  const mainFields = flattenWidgets((mainForm?.children || []) as FormElement[]);
  const subFields = subForm ? flattenWidgets((subForm.children || []) as FormElement[], "", true) : [];
  const currentWidgetUid = normalizeConditionUid(props.widget.uid, !!subForm);
  return [...mainFields, ...subFields]
    .filter(item => item.value !== currentWidgetUid)
    .filter(item => !notAllowSelectTypes.includes(item.widget.type));
});

const currentWidgetLabel = computed(() => getCurrentWidgetLabel());

const fieldOptionMap = computed(() => {
  return new Map(fieldOptions.value.map(item => [item.value, item]));
});

const getConditionWidget = (uid: string) => {
  if (!uid) return null;
  const option = fieldOptionMap.value.get(uid);
  if (option?.widget) {
    return option.widget;
  }
  const { mainForm, subForm } = getConditionForms();
  const widgetIds = uid.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
  if (subForm && widgetIds.length > 1 && widgetIds[0] === subForm.uid) {
    return subForm.getChildElement(widgetIds[1]);
  }
  return mainForm?.getChildElement(getConditionFieldUid(uid));
};

const getConditionRules = (uid: string) => {
  const element = getConditionWidget(uid);
  if (!element) {
    return {
      [RuleFunc.EQUAL]: RuleFuncValue.STRING,
    };
  }
  const { editFuncInfo } = element.getConfigurations();
  if (element.getSoul().type === "widget.form.switch") {
    return {
      [RuleFunc.TRUE]: RuleFuncValue.NULL,
      [RuleFunc.FALSE]: RuleFuncValue.NULL,
    };
  }
  return editFuncInfo || {};
};

const getFuncTextLabel = (key: RuleFunc, uid: string) => {
  const element = getConditionWidget(uid);
  if (element?.getConfigurations()?.editFuncInfoText?.[key]) {
    return element.getConfigurations().editFuncInfoText[key];
  }
  return RuleFuncTextMapping[key];
};

const getDefaultConditionValue = (uid: string, func: RuleFunc) => {
  const valueType = getConditionRules(uid)?.[func] || RuleFuncValue.STRING;
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(valueType)) {
    return [];
  }
  return null;
};

const getDefaultCondition = (uid?: string): FormCondition => {
  const currentWidgetUid = normalizeConditionUid(props.widget.uid, props.widget.isInSubForm);
  const defaultUid = uid || fieldOptions.value.find(item => item.value === currentWidgetUid)?.value || fieldOptions.value[0]?.value || "";
  const funcs = getConditionRules(defaultUid);
  const func = !isEmpty(funcs) ? Object.keys(funcs)[0] as RuleFunc : RuleFunc.EQUAL;
  return {
    uid: defaultUid,
    func,
    value: getDefaultConditionValue(defaultUid, func),
  };
};

const handleCurrentFieldChange = (condition: FormCondition) => {
  const funcs = getConditionRules(condition.uid);
  condition.func = !isEmpty(funcs) ? Object.keys(funcs)[0] as RuleFunc : RuleFunc.EQUAL;
  condition.value = getDefaultConditionValue(condition.uid, condition.func);
};

const handleConditionFuncChange = (condition: FormCondition) => {
  condition.value = getDefaultConditionValue(condition.uid, condition.func);
};

const handleAddCondition = () => {
  rule.value.conditions.push(getDefaultCondition());
};

const handleRemoveCondition = (index: number) => {
  rule.value.conditions.splice(index, 1);
};

const handleClearConditions = () => {
  rule.value.conditions = [];
};

const isValueInputDisabled = (condition: FormCondition) => {
  return !condition.uid || [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func);
};

const hasConditionValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(item => hasConditionValue(item));
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return value !== null && value !== undefined;
};

const checkFormData = () => {
  if (!rule.value.logic) {
    return false;
  }
  for (const condition of rule.value.conditions) {
    if (!condition.uid || !condition.func) {
      return false;
    }
    if (!isValueInputDisabled(condition) && !hasConditionValue(condition.value)) {
      return false;
    }
  }
  return true;
};

const handleConfirm = () => {
  if (!checkFormData()) {
    ElMessage.warning(i18next.t("FieldRequiredDialog.plsSetFullCondition"));
    return;
  }
  emit("update", deepClone({
    ...rule.value,
    conditions: rule.value.conditions.map(condition => ({
      ...condition,
      uid: condition.uid,
    })),
  }));
  emit("update:modelValue", false);
};

const onOpen = () => {
  if (props.value) {
    rule.value = deepClone({
      logic: props.value.logic || LogicalOperator.AND,
      conditions: (props.value.conditions || []).map(condition => ({
        ...condition,
        uid: normalizeStoredConditionUid(condition.uid),
      })),
    });
    return;
  }
  rule.value = {
    logic: LogicalOperator.AND,
    conditions: [getDefaultCondition()],
  };
};

const onClosed = () => {
  rule.value = {
    logic: LogicalOperator.AND,
    conditions: [],
  };
};
</script>

<style scoped lang="scss">
.field-required-rule-container {
  @mixin diy-select {
    width: max-content;
    min-width: 60px;
    max-width: 100%;
    border-radius: 4px;

    &:hover {
      background-color: var(--bg-color-hover);
    }

    .el-select__wrapper {
      box-shadow: none;
      border: none;
      padding: 0 4px 0 10px;
      background-color: transparent;
      gap: 4px;

      .el-select__placeholder {
        position: unset;
        transform: unset;
      }

      .el-select__input-wrapper {
        display: none;
      }
    }
  }

  :deep(.field-required-dialog) {
    height: 640px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);
    --dialog-header-height: 40px;
    --dialog-footer-height: 80px;

    .el-dialog__header {
      height: var(--dialog-header-height);
      display: flex;
      justify-content: center;
      align-items: center;
      border-bottom: 1px solid var(--border-color);

      .el-dialog__title {
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: var(--dialog-header-height);
        height: var(--dialog-header-height);
      }
    }

    .el-dialog__body {
      height: calc(100% - var(--dialog-header-height) - var(--dialog-footer-height));
      padding: 8px;

      .container-scrollbar {
        .el-scrollbar__view {
          padding: 8px 16px;
        }

        .container {
          display: flex;
          flex-direction: column;
          row-gap: 16px;

          .warning-banner {
            height: 38px;
            padding: 8px 12px;
            border-radius: 4px;
            background: #fff8e6;
            color: #c28b00;
            font-size: 14px;
            line-height: 22px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .header {
            display: flex;
            flex-direction: column;
            row-gap: 12px;

            .current-field-row,
            .condition-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              flex-wrap: wrap;
            }

            .field-info,
            .condition-text,
            .actions {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;
            }

            .text {
              color: var(--color-black);
            }

            .tag {
              line-height: 24px;
              padding: 4px;
              border-radius: 4px;
              background-color: var(--bg-color-overlay);
            }

            .logic-select {
              width: 72px;
              @include diy-select;
            }

            .actions {
              margin-left: auto;

              .el-button {
                font-size: 14px;
              }
            }
          }

          .condition-list {
            display: flex;
            flex-direction: column;
            row-gap: 8px;

            .condition-item {
              display: flex;
              align-items: center;
              min-height: 32px;
              column-gap: 8px;

              .condition-field {
                width: 220px;

                .el-select {
                  width: 100%;
                }
              }

              .condition-rule {
                width: 92px;

                .el-select {
                  @include diy-select;
                }
              }

              .condition-value {
                width: 278px;

                :deep(.custom-input),
                :deep(.el-input),
                :deep(.el-select) {
                  width: 100%;
                }

                :deep(.el-select) {
                  @include diy-select;
                }
              }

              .delete {
                display: flex;
                align-items: center;

                .el-icon {
                  cursor: pointer;
                  color: var(--el-text-color-secondary);

                  &:hover {
                    color: var(--color-danger);
                  }
                }
              }

              .deleted-field {
                color: var(--el-color-danger);
              }

              .disabled {
                opacity: 0.7;
              }
            }
          }
        }
      }
    }

    .el-dialog__footer {
      height: var(--dialog-footer-height);
      padding: 0 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: end;
      align-items: center;

      .el-button {
        border-radius: 4px;
      }
    }
  }

  @media (max-width: 768px) {
    :deep(.field-required-dialog) {
      width: calc(100vw - 24px) !important;
      max-width: calc(100vw - 24px);

      .el-dialog__body {
        .container-scrollbar {
          .el-scrollbar__view {
            padding: 8px 12px;
          }

          .container {
            .condition-list {
              .condition-item {
                flex-wrap: wrap;

                .condition-field,
                .condition-rule,
                .condition-value {
                  width: 100%;
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
