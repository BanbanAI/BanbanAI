<template>
  <div class="related-form-linkage-fill-dialog">
    <el-dialog
      class="related-form-fill-dialog"
      :modelValue="modelValue"
      :title="dialogTitle"
      width="960"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      @update:modelValue="emit('update:modelValue', $event)"
      @open="onOpen"
      @closed="onClosed"
    >
      <vn-stack v-if="relatedTableList.length" class="related-form-stack" :modelValue="activeTableKey">
        <div class="left-tab-menus">
          <vn-stack-tab
            v-for="tableItem in relatedTableList"
            :key="tableItem.key"
            :name="tableItem.key"
            :class="['tab-item', { active: activeTableKey === tableItem.key }]"
            @click="activeTableKey = tableItem.key"
          >
            <el-text truncated>{{ tableItem.name }}</el-text>
          </vn-stack-tab>
        </div>

        <div class="line"></div>

        <div class="right-layers">
          <vn-stack-layer
            v-for="tableItem in relatedTableList"
            :key="tableItem.key"
            :name="tableItem.key"
            class="tab-layer"
          >
            <el-form
              :ref="(el) => setFormRef(tableItem.key, el)"
              class="container"
              :model="getTableRules(tableItem.key)"
            >
              <div class="warning-banner">
                <el-icon :size="16"><i-ep-warning /></el-icon>
                <span>{{ typeMatchTipText }}</span>
              </div>
              <div class="container-tip-header">
                <p class="tip">
                  {{ targetFormText }}:
                  <el-tag :title="tableItem.name">
                    <el-text truncated>{{ tableItem.name }}</el-text>
                  </el-tag>
                </p>

                <el-button
                  class="btn-delete-all-condition"
                  link
                  @click="handleDeleteAllCondition(tableItem.key)"
                >
                  <el-icon :size="16">
                    <i-ep-delete />
                  </el-icon>
                  {{ clearText }}
                </el-button>
              </div>
              <div class="linkage-fill-form">
                <p class="label">
                  <span>{{ fillDescriptionText }}</span>
                  <el-button type="primary" link @click="handleAddFillField(tableItem.key)">
                    <el-icon :size="16" style="margin-right: 4px;">
                      <i-ep-plus />
                    </el-icon>
                    {{ addFieldText }}
                  </el-button>
                </p>
                <el-scrollbar class="container-scrollbar">
                  <div class="field-wrapper">
                    <template v-for="(item, index) in getTableRules(tableItem.key)" :key="index">
                      <div class="fill-field-item">
                        <div class="linkage-field">
                          <p class="label" v-if="index === 0">{{ targetFieldText }}</p>
                          <div class="field">
                            <el-form-item
                              :prop="`${index}.linkageField`"
                              :rules="getConditionFormRules(item, 'linkageField')"
                            >
                              <el-select
                                class="linkage-field-select"
                                popper-class="linkage-fill-select-popper"
                                v-model="item.linkageField"
                                :placeholder="targetFieldPlaceholder"
                                filterable
                                :no-data-text="noDataText"
                                :no-match-text="noDataText"
                                clearable
                                :offset="4"
                                @change="handleChangeLinkageField(tableItem.key, item)"
                              >
                                <el-option
                                  v-for="field in getTargetLinkageTableFields(tableItem.key)"
                                  :key="field.uid"
                                  :label="field.alias"
                                  :value="field.uid"
                                  :disabled="isTargetFieldDisabled(tableItem.key, index, field.uid)"
                                ></el-option>
                                <template #label="{ label, value }">
                                  <span :class="{ error: label === value }">
                                    {{ label === value ? errorText : label }}
                                  </span>
                                </template>
                              </el-select>
                            </el-form-item>
                          </div>
                        </div>

                        <p class="text">{{ fillAsText }}</p>

                        <div class="current-field">
                          <p class="label" v-if="index === 0">{{ fillDataText }}</p>
                          <div class="field">
                            <el-select
                              class="select-value-type"
                              v-model="item.type"
                              :suffix-icon="CaretBottom"
                              :disabled="!item.linkageField"
                              :placeholder="valueTypePlaceholder"
                              :no-data-text="noDataText"
                              @change="handleChangeValueType(item)"
                            >
                              <el-option
                                v-for="typeItem in valueTypeOptions(tableItem.key, item)"
                                :key="typeItem.value"
                                :label="typeItem.label"
                                :value="typeItem.value"
                              />
                            </el-select>

                            <el-form-item
                              v-if="item.type === FormConditionValueType.FORM"
                              :prop="`${index}.currentWidget`"
                              :rules="getConditionFormRules(item, 'currentWidget')"
                            >
                              <el-select
                                class="fill-field-select"
                                v-model="item.currentWidget"
                                :placeholder="currentFieldPlaceholder"
                                filterable
                                :no-data-text="noDataText"
                                :no-match-text="noDataText"
                                :disabled="!item.linkageField"
                                clearable
                                popper-class="linkage-fill-select-popper"
                                :offset="4"
                              >
                                <el-option
                                  v-for="field in currentFormElements(tableItem.key, item)"
                                  :key="field.uid"
                                  :label="getFieldLabel(field)"
                                  :value="getFieldValue(field)"
                                >
                                  {{ getFieldLabel(field) }}
                                </el-option>
                              </el-select>
                            </el-form-item>

                            <el-form-item
                              v-else-if="item.type === FormConditionValueType.FORMULA"
                              :prop="`${index}.formula`"
                              :rules="getConditionFormRules(item, 'formula')"
                            >
                              <el-button
                                :class="['formula-button', item.formula ? 'has-formula' : '']"
                                :style="{ color: item.formula ? 'var(--color-primary)' : 'var(--text-color-regular)' }"
                                @click="handleEditFormula(tableItem.key, item, index)"
                              >
                                {{ item.formula ? formulaSetText : formulaText }}
                              </el-button>
                            </el-form-item>

                            <el-form-item
                              v-else
                              :prop="`${index}.value`"
                              :rules="getConditionFormRules(item, 'value')"
                            >
                              <form-filter-value-format
                                class="current-vaule-input"
                                v-model="item.value"
                                :fieldId="item.linkageField"
                                :element="item.selectedElement"
                                :type="item.selectedElementTpye"
                                :placeholder="inputPlaceholder"
                                :widget="props.widget"
                              ></form-filter-value-format>
                            </el-form-item>
                          </div>
                        </div>

                        <div :class="['delete', { disabled: getTableRules(tableItem.key).length === 1 }]">
                          <el-icon :size="16" @click="handleDeleteFillField(tableItem.key, index)">
                            <i-ep-delete />
                          </el-icon>
                        </div>
                      </div>
                    </template>
                  </div>
                </el-scrollbar>
              </div>
            </el-form>
          </vn-stack-layer>
        </div>
      </vn-stack>

      <div class="empty-data" v-else>
        <div class="empty-text">{{ emptyText }}</div>
      </div>

      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ cancelText }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ confirmText }}</el-button>
      </template>
    </el-dialog>

    <source-table-formula-dialog
      v-model="formulaVisible"
      @update="handleFormulaUpdate"
      :value="tempFormula"
      :defaultTables="[getCurrentTable()]"
      :tables="[getCurrentTable()]"
    />
  </div>
</template>

<script setup lang='ts'>
import { FormConditionValueType, RuleFunc, RuleFuncValue, FormWidgetType } from '@common/types/nocode';
import { formElementInstances } from '@renderer/utils/instance';
import { getSystemColumnConfigurations, isSystemField } from '@common/utils/connection';
import { FormElement } from '@renderer/b2/controllers/form';
import { Field, Table } from '@common/types/project';
import { computed, ref } from 'vue';
import { deepClone, isEmpty } from '@common/utils/object';
import { CaretBottom } from "@element-plus/icons-vue";
import { ElMessage, FormInstance } from 'element-plus';
import IEpDelete from "~icons/ep/delete";
import IEpPlus from "~icons/ep/plus";
import { Form } from '../../form';
import i18next, { $t } from "@renderer/widgets/i18next";

type FillRuleItem = {
  linkageField: string | null;
  currentWidget?: string | null;
  type: FormConditionValueType;
  formula?: string | null;
  value?: any;
  selectedElement?: any;
  selectedElementTpye?: RuleFuncValue | null;
};

type RelatedTableItem = {
  key: string;
  name: string;
  fields: Field[];
};

type SelectableFormElement = FormElement & {
  form?: FormElement;
  isInSubForm?: boolean;
};

const props = defineProps<{
  modelValue: boolean;
  widget: Form;
  value?: Record<string, FillRuleItem[]>;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: Record<string, FillRuleItem[]>): void;
}>();

const dialogTitle = i18next.t("autoFillRuleTitle");
const targetFormText = i18next.t("targetForm");
const clearText = i18next.t("clear");
const fillDescriptionText = i18next.t("fillTargetFormByRules");
const addFieldText = i18next.t("addField");
const typeMatchTipText = i18next.t("typeMatchTip");
const targetFieldText = i18next.t("targetFormField");
const targetFieldPlaceholder = i18next.t("pleaseSelectTargetFormField");
const fillAsText = i18next.t("fillAs");
const fillDataText = i18next.t("fillData");
const valueTypePlaceholder = i18next.t("pleaseSelectDataType");
const currentFieldPlaceholder = i18next.t("pleaseSelectCurrentFormField");
const formulaText = i18next.t("setFormula");
const formulaSetText = i18next.t("formulaSet");
const inputPlaceholder = i18next.t("pleaseInput");
const emptyText = i18next.t("currentFormNotLinked");
const cancelText = i18next.t("cancel");
const confirmText = i18next.t("confirm");
const errorText = i18next.t("deletedFieldError");
const noDataText = i18next.t("noData");

const equivalentGroups = ["text", "tag"];
const allowFormulaFieldType = [
  FormWidgetType.DATE_PICKER,
  FormWidgetType.HYPERLINK,
  FormWidgetType.TEXT_INPUT,
  FormWidgetType.NUMBER_INPUT,
  FormWidgetType.TEXTAREA,
];
const notAllowFillSelectTypes = [
  FormWidgetType.SELECT_DATA,
  FormWidgetType.SEARCH_FORM,
  FormWidgetType.RELATED_DATA,
  FormWidgetType.RICH_TEXT_EDITOR,
  FormWidgetType.MARKDOWN_EDITOR,
  FormWidgetType.SPLIT_LINE,
  FormWidgetType.TITLE_BAR,
  FormWidgetType.IMAGE_TEXT_SHOW,
  FormWidgetType.AUTO_COMPUTE,
  FormWidgetType.SUBFORM,
];

const valueTypeOptions1 = [
  {
    value: FormConditionValueType.FORM,
    label: i18next.t("field"),
  },
  {
    value: FormConditionValueType.CUSTOM,
    label: i18next.t("custom"),
  },
];

const valueTypeOptions2 = [
  {
    value: FormConditionValueType.FORM,
    label: i18next.t("field"),
  },
  {
    value: FormConditionValueType.CUSTOM,
    label: i18next.t("custom"),
  },
  {
    value: FormConditionValueType.FORMULA,
    label: i18next.t("formulaEdit"),
  },
];

const relatedTablesData = computed(() => {
  return props.widget.getRelatedTablesData() || {};
});
const visibleTableKeys = ref<string[]>([]);

const relatedTableList = computed<RelatedTableItem[]>(() => {
  return Object.entries(relatedTablesData.value)
  .filter(([key]) => visibleTableKeys.value.includes(key))
  .map(([key, value]) => {
    const fields = props.widget.getTableFields([props.widget.tableUID[0], key]);
    return {
      key,
      name: value.name,
      fields: fields || [],
    };
  });
});

const activeTableKey = ref("");
const relatedFillRule = ref<Record<string, FillRuleItem[]>>({});
const formRefs = ref<Record<string, FormInstance | null>>({});

const tempFormula = ref<string | null>("");
const formulaVisible = ref(false);
const formulaEditTableKey = ref("");
const indexOfFieldEditingFormula = ref<number | null>(null);

const createEmptyRule = (): FillRuleItem => {
  return {
    linkageField: null,
    currentWidget: null,
    type: FormConditionValueType.FORM,
    formula: null,
    value: null,
    selectedElement: null,
    selectedElementTpye: null,
  };
};

const getCurrentTable = () => {
  const table = props.widget.getTable(props.widget.tableUID) as Table;
  return {
    ...table,
    name: table.alias,
  };
};

const getFieldLabel = (element: SelectableFormElement) => {
  return element.title;
};

const getFieldValue = (element: SelectableFormElement) => {
  return element.uid;
};

const hasValue = (value: any) => {
  if (value === 0) return true;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return !isEmpty(value);
  return value !== null && value !== undefined && value !== "";
};

const isRuleTouched = (rule: FillRuleItem) => {
  return (
    hasValue(rule.linkageField) ||
    hasValue(rule.currentWidget) ||
    hasValue(rule.formula) ||
    hasValue(rule.value) ||
    rule.type !== FormConditionValueType.FORM
  );
};

const setFormRef = (tableKey: string, formRef: FormInstance | null) => {
  formRefs.value[tableKey] = formRef;
};

const getTableRules = (tableKey: string) => {
  return relatedFillRule.value[tableKey] || [];
};

const getTargetLinkageTableFields = (tableKey: string) => {
  return (relatedTableList.value.find((item) => item.key === tableKey)?.fields || []).filter((field) => {
    return (
      !isSystemField(field) &&
      `${field.uid}`.split(".").length === 1 &&
      !notAllowFillSelectTypes.includes(field.meta?.extra?.widgetType)
    );
  });
};

const isTargetFieldDisabled = (tableKey: string, currentIndex: number, fieldUID: string) => {
  return getTableRules(tableKey).some((item, index) => {
    return index !== currentIndex && item.linkageField === fieldUID;
  });
};

const isSameElementType = (field: Field, element: FormElement) => {
  if (!field || !element) return false;
  return (
    field.type === element.fieldType &&
    (
      element.resolveFormSetting().subType === field.meta?.subType ||
      (
        equivalentGroups.includes(element.resolveFormSetting().subType) &&
        equivalentGroups.includes(field.meta?.subType)
      )
    )
  );
};

const flattenCurrentFormElements = (children: FormElement[]): FormElement[] => {
  return children.flatMap((item: FormElement) => {
    if (item.children?.length > 0 && item.type !== FormWidgetType.SUBFORM) {
      return flattenCurrentFormElements(item.children);
    }
    return item;
  }).filter((item: FormElement) => ![FormWidgetType.TAB_PANEL, FormWidgetType.MULTIPLE_TABS].includes(item.type));
};

const currentFormElements = (tableKey: string, fillItem: FillRuleItem) => {
  if (!fillItem.linkageField) return [];
  const targetField = getTargetLinkageTableFields(tableKey).find((field) => field.uid === fillItem.linkageField);
  if (!targetField) return [];

  return flattenCurrentFormElements(props.widget.children as FormElement[])
    .filter((item: FormElement) => !notAllowFillSelectTypes.includes(item.type))
    .flatMap((item: FormElement) => {
      return isSameElementType(targetField, item) ? [item as SelectableFormElement] : [];
    });
};

const handleFormulaUpdate = (value: string) => {
  const tableKey = formulaEditTableKey.value;
  const editIndex = indexOfFieldEditingFormula.value;
  if (!tableKey || editIndex === null) return;
  relatedFillRule.value[tableKey][editIndex].formula = value;
};

const valueTypeOptions = (tableKey: string, fillItem: FillRuleItem) => {
  const field = getTargetLinkageTableFields(tableKey).find((item) => item.uid === fillItem.linkageField);
  if (field && allowFormulaFieldType.includes(field.meta?.extra?.widgetType)) {
    return valueTypeOptions2;
  }
  return valueTypeOptions1;
};

const getConditionFormRules = <T extends FillRuleItem>(condition: T, key: keyof T) => {
  return [
    {
      validator(rule, value, callback) {
        if (!isRuleTouched(condition)) {
          callback();
          return;
        }

        if (key === "currentWidget" && condition.type !== FormConditionValueType.FORM) {
          callback();
          return;
        }

        if (key === "formula" && condition.type !== FormConditionValueType.FORMULA) {
          callback();
          return;
        }

        if (key === "value" && condition.type === FormConditionValueType.FORM) {
          callback();
          return;
        }

        if (!hasValue(value)) {
          callback(new Error(''));
          return;
        }

        callback();
      }
    }
  ];
};

const getInstance = async (tableKey: string, fieldId: string) => {
  const option = getTargetLinkageTableFields(tableKey).find((item) => item.uid === fieldId);
  if (!option?.meta?.extra?.widgetType) return;
  return formElementInstances.getInstance(option.meta.extra.widgetType);
};

const filterMenus = async (tableKey: string, fieldId: string) => {
  const option = getTargetLinkageTableFields(tableKey).find((item) => item.uid === fieldId);
  if (!option) return {};

  const instance = await getInstance(tableKey, fieldId);
  if (instance) {
    return instance.getConfigurations()?.editFuncInfo || {};
  }

  const configurations = getSystemColumnConfigurations(option.meta.name);
  return configurations?.editFuncInfo || {};
};

const funcValue = async (tableKey: string, fieldId: string, key: RuleFunc): Promise<RuleFuncValue> => {
  const funcs = await filterMenus(tableKey, fieldId);
  return funcs[key] || funcs[Object.keys(funcs)[0]];
};

const normalizeRule = async (tableKey: string, item: FillRuleItem) => {
  if (!item.linkageField) {
    item.selectedElement = null;
    item.selectedElementTpye = null;
    return;
  }

  const element = await getInstance(tableKey, item.linkageField);
  if (!element) {
    item.selectedElement = null;
    item.selectedElementTpye = null;
    return;
  }

  const tempFunc = element.type === FormWidgetType.DATE_PICKER ? RuleFunc.TIME_EQUAL : RuleFunc.EQUAL;
  item.selectedElement = element;
  item.selectedElementTpye = await funcValue(tableKey, item.linkageField, tempFunc);
};

const init = async () => {
  const nextRules: Record<string, FillRuleItem[]> = {};

  for (const tableItem of relatedTableList.value) {
    const currentValue = props.value?.[tableItem.key];
    const tempRules = (isEmpty(currentValue) ? [createEmptyRule()] : deepClone(currentValue)).map((item) => {
      return {
        ...createEmptyRule(),
        ...item,
      };
    });

    await Promise.all(tempRules.map((item) => normalizeRule(tableItem.key, item)));
    nextRules[tableItem.key] = tempRules;
  }

  relatedFillRule.value = nextRules;
  activeTableKey.value = relatedTableList.value[0]?.key || "";
};

const onOpen = async () => {
  const tableKeys = Object.keys(relatedTablesData.value);
  visibleTableKeys.value = tableKeys.filter(tableKey => props.widget.canReadLayerDataSync(tableKey));

  if (relatedTableList.value.length) {
    await init();
  }
};

const onClosed = () => {
  visibleTableKeys.value = [];
  relatedFillRule.value = {};
  formRefs.value = {};
  activeTableKey.value = "";
  formulaVisible.value = false;
  formulaEditTableKey.value = "";
  indexOfFieldEditingFormula.value = null;
  tempFormula.value = "";
};

const handleAddFillField = (tableKey: string) => {
  if (!relatedFillRule.value[tableKey]) {
    relatedFillRule.value[tableKey] = [];
  }
  relatedFillRule.value[tableKey].push(createEmptyRule());
};

const handleDeleteAllCondition = (tableKey: string) => {
  relatedFillRule.value[tableKey] = [];
};

const handleDeleteFillField = (tableKey: string, index: number) => {
  if (getTableRules(tableKey).length === 1) return;
  relatedFillRule.value[tableKey].splice(index, 1);
};

const handleEditFormula = (tableKey: string, item: FillRuleItem, index: number) => {
  formulaEditTableKey.value = tableKey;
  indexOfFieldEditingFormula.value = index;
  tempFormula.value = item.formula;
  formulaVisible.value = true;
};

const handleChangeValueType = (fillItem: FillRuleItem) => {
  fillItem.value = null;
  fillItem.currentWidget = null;
  fillItem.formula = null;
};

const handleChangeLinkageField = async (tableKey: string, fillItem: FillRuleItem) => {
  fillItem.type = FormConditionValueType.FORM;
  await normalizeRule(tableKey, fillItem);
  handleChangeValueType(fillItem);
};

const validateForms = async () => {
  for (const tableItem of relatedTableList.value) {
    const formRef = formRefs.value[tableItem.key];
    if (!formRef) continue;

    try {
      await formRef.validate();
    } catch (error) {
      activeTableKey.value = tableItem.key;
      return false;
    }
  }
  return true;
};

const sanitizeRules = () => {
  const result: Record<string, FillRuleItem[]> = {};

  for (const tableItem of relatedTableList.value) {
    const rules = getTableRules(tableItem.key)
      .filter((item) => isRuleTouched(item))
      .map((item) => {
        const temp = item;
        delete temp.selectedElement;
        delete temp.selectedElementTpye;
        return temp;
      });

    if (!isEmpty(rules)) {
      result[tableItem.key] = rules;
    }
  }

  return result;
};

const handleConfirm = async () => {
  const valid = await validateForms();
  if (!valid) {
    ElMessage.warning(i18next.t("incompleteAutoFillRule"));
    return;
  }

  emit("update", sanitizeRules());
  emit("update:modelValue", false);
};
</script>

<style lang="scss" scoped>
.related-form-linkage-fill-dialog {
  @mixin diy-select {
    width: 90px;
    border-radius: 4px;
    background-color: var(--bg-color-overlay);

    .el-select__wrapper {
      box-shadow: none;
      border: none;
      padding: 0 4px 0 10px;
      background-color: transparent;
      gap: 4px;
      font-size: 12px;

      .el-select__placeholder {
        position: unset;
        transform: unset;
      }

      .el-select__input-wrapper {
        display: none;
      }
    }
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

  @mixin delete {
    display: flex;
    align-items: center;

    &.disabled {
      cursor: not-allowed;
      pointer-events: none;
      opacity: 0.4;
    }

    .el-icon {
      cursor: pointer;

      &:hover {
        color: var(--color-danger);
      }
    }
  }

  @mixin field {
    display: flex;
    column-gap: 8px;
    align-items: center;

    .el-select {
      width: 276px;
    }
  }

  :deep(.related-form-fill-dialog) {
    --el-dialog-padding-primary: 0;
    --dialog-header-height: 40px;
    --dialog-footer-height: 72px;
    height: 640px;
    max-height: 100%;
    border-radius: 8px;
    background-color: #fff;

    .el-dialog__header {
      height: var(--dialog-header-height);
      padding: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;

      .el-dialog__title {
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__body {
      padding: 0;
      height: calc(100% - var(--dialog-header-height) - var(--dialog-footer-height));
    }

    .el-dialog__footer {
      padding: 12px 16px 16px;
      border-top: 1px solid var(--border-color);

      .el-button {
        border-radius: 4px;
      }
    }
  }

  :deep(.related-form-stack) {
    display: flex;
    height: 100%;
  }

  .left-tab-menus {
    padding: 12px;
    width: 200px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .tab-item {
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      border-radius: 6px;
      cursor: pointer;
      background-color: transparent;
      color: var(--text-color-regular);
      transition: all 0.2s ease;

      &:hover {
        background-color: #e8f6ff;
      }

      &.active {
        background-color: #e8f6ff;
        .el-text {
          color: var(--color-primary);
        }
      }

      .el-text {
        width: 100%;
      }
    }
  }

  .line {
    width: 1px;
    height: 100%;
    background-color: var(--border-color);
  }

  .right-layers {
    flex: 1;
    min-width: 0;
  }

  :deep(.tab-layer) {
    height: 100%;
  }

  .container-scrollbar {
    height: 100%;

    :deep(.el-scrollbar__view) {
      min-height: 100%;
    }
  }

  .container {
    padding: 16px;
    display: flex;
    flex-direction: column;
    row-gap: 32px;
    height: 100%;

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

    .container-tip-header {
      width: 100%;
      display: flex;
      justify-content: space-between;

      .tip {
        display: flex;
        align-items: center;
        height: 24px;
        column-gap: 4px;
        font-size: 14px;
        color: var(--text-color-primary);

        .el-tag {
          border: 0;

          .el-text {
            max-width: 360px;
          }
        }
      }

      .btn-delete-all-condition {
        height: 24px;

        &:hover {
          color: var(--color-danger) !important;
        }

        .el-icon {
          margin-right: 4px;
          font-size: 16px;
        }

        span {
          font-size: 12px;
        }
      }
    }

    .el-form-item {
      margin: 0;
    }

    .linkage-fill-form {
      display: flex;
      flex-direction: column;
      row-gap: 16px;
      height: calc(100% - 62px - 64px);

      .label {
        display: flex;
        align-items: center;
        color: var(--text-color-primary);

        .el-button {
          margin-left: auto;
        }
      }

      .field-wrapper {
        display: flex;
        flex-direction: column;
        row-gap: 8px;

        .fill-field-item {
          display: flex;
          align-items: end;
          gap: 8px;
          font-size: 12px;
          position: relative;
          padding-right: 28px;

          .text {
            width: 42px;
            height: 32px;
            line-height: 32px;
            text-align: center;
          }

          .current-field,
          .linkage-field {
            display: flex;
            flex-direction: column;
            row-gap: 8px;
          }

          .linkage-field {
            width: 272px;

            .field {
              display: flex;
              align-items: center;

              .el-form-item {
                width: 272px;
              }
            }
          }

          .current-field {
            width: 374px;

            .field {
              @include field;

              :deep(.select-value-type) {
                @include diy-select;
              }
            }
          }

          .fill-field-select,
          .linkage-field-select {
            @include common-select();
          }

          .formula-button {
            width: 276px;
            height: 32px;
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            font-size: 12px;
          }

          :deep(.current-vaule-input) {
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            width: 276px;

            &:hover {
              background-color: var(--bg-color-hover);
            }

            .el-input__wrapper,
            .el-input-tag__wrapper {
              width: 276px;
              box-shadow: none;
              border: none;
              background: transparent;

              .el-input__inner {
                font-size: 12px;
              }
            }

            .el-select__wrapper,
            .el-date-editor {
              width: 276px;
            }
          }

          .delete {
            @include delete;
            height: 32px;
            position: absolute;
            right: 0;
          }
        }
      }
    }
  }

  .empty-data {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .empty-text {
      color: var(--text-color-secondary);
      font-size: 14px;
    }
  }
}
</style>
