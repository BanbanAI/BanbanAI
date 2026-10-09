<template>
  <div class="add-form-data-value">
    <el-dialog
      class="add-form-data-value-dialog"
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      :title="staticDescription.title"
      width="680"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      @open="onOpen"
      draggable
    >
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="fillRule" ref="formRef">
          <div class="container-tip-header">
            <p class="tip">
              {{ staticDescription.description }}:
              <el-tag :title="getLinkageTableName()">
                <el-text truncated>{{ getLinkageTableName() }}</el-text>
              </el-tag>
            </p>

            <el-button class="btn-delete-all-condition" link @click="handleDeleteAllCondition">
              <el-icon :zie="16">
                <i-ep-delete />
              </el-icon>
              {{ $t("clear") }}
            </el-button>
          </div>
          <div class="linkage-fill-form">
            <p class="label">
              <span>{{ $t("fillTargetFormByRules") }}</span>
              <el-button type="primary" link @click="handleAddFillField">
                <el-icon :size="16" style="margin-right: 4px;">
                  <i-ep-plus />
                </el-icon>
                {{ $t("addField") }}
              </el-button>
            </p>
            <div class="field-wrapper">
              <template v-for="(item, index) in fillRule" :key="index">
                <div class="fill-field-item">
                  <div class="linkage-field">
                    <p class="label" v-if="index === 0">{{ $t("targetFormField") }}</p>
                    <div class="field">
                      <el-form-item prop="linkageField" :rules="getConditionFormRules(item, 'linkageField')">
                        <el-select
                          class="linkage-field-select"
                          popper-class="linkage-fill-select-popper"
                          v-model="item.linkageField"
                          :placeholder="$t('pleaseSelectTargetFormField')"
                          filterable
                          :no-data-text="$t('noData')"
                          :no-match-text="$t('noData')"
                          clearable
                          :offset="4"
                          @change="handleChangeLinkageField(item)"
                        >
                          <el-option
                            v-for="field in getTargetLinkageTableFields"
                            :key="field.uid"
                            :label="field.alias"
                            :value="field.uid"
                            :disabled="fillRule.some(item => item.linkageField === field.uid)"
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
                  <p class="text">{{ i18next.t("fillAs") }}</p>
                  <div class="current-field">
                    <p class="label" v-if="index === 0">{{ i18next.t("fillData") }}</p>
                    <div class="field">
                      <el-select class="select-value-type" v-model="item.type" :suffix-icon="CaretBottom" :disabled="!item.linkageField" :placeholder="i18next.t('pleaseSelectDataType')" :no-data-text="i18next.t('noData')" @change="handleChangeValueType(item)">
                        <el-option v-for="typeItem in valueTypeOptions(item)" :key="typeItem.value" :label="typeItem.label" :value="typeItem.value" />
                      </el-select>
                      <el-form-item v-if="item.type === FormConditionValueType.FORM" prop="currentWidget" :rules="getConditionFormRules(item, 'currentWidget')">
                        <el-select
                          class="fill-field-select"
                          v-model="item.currentWidget"
                          :placeholder="i18next.t('pleaseSelectCurrentFormField')"
                          filterable
                          :no-data-text="i18next.t('noData')"
                          :no-match-text="i18next.t('noData')"
                          :disabled="!item.linkageField"
                          clearable
                          popper-class="linkage-fill-select-popper"
                          :offset="4"
                        >
                          <el-option
                            v-for="field in currentFormElements(item)"
                            :key="field.uid"
                            :label="getFieldLabel(field)"
                            :value="getFieldValue(field)"
                          >{{ getFieldLabel(field) }}</el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item v-else-if="item.type === FormConditionValueType.FORMULA" prop="formula" :rules="getConditionFormRules(item, 'formula')">
                        <el-button
                          :class="['formula-button', item.formula ? 'has-formula' : '']"
                          @click="handleEditFormula(item, index)"
                          :style="{color: item.formula ? 'var(--color-primary)' : 'var(--text-color-regular)'}"
                          >
                          {{ item.formula ? i18next.t("formulaSet") : i18next.t("setFormula") }}
                        </el-button>
                      </el-form-item>
                      <el-form-item v-else prop="value" :rules="getConditionFormRules(item, 'value')">
                        <form-filter-value-format class="current-vaule-input" v-model="item.value" :fieldId="item.linkageField"
                          :element="item.selectedElement" :type="item.selectedElementTpye"
                          :placeholder="i18next.t('pleaseInput')" :widget="props.widget"
                        ></form-filter-value-format>
                      </el-form-item>
                    </div>
                  </div>
                  <div :class="['delete', { disabled: fillRule.length === 1 }]">
                    <el-icon :size="16" @click="fillRule.splice(index, 1)">
                      <i-ep-delete />
                    </el-icon>
                  </div>
                </div>
                <div class="sub-form-field-wrappe"></div>
              </template>
            </div>
          </div>
        </el-form>
      </el-scrollbar>

      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ i18next.t("cancel") }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ i18next.t("confirm") }}</el-button>
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
import { FormConditionValueType, RuleFunc, RuleFuncValue } from '@common/types/nocode';
import { formElementInstances } from '@renderer/utils/instance';
import { getSystemColumnConfigurations, isNocodeFormData, isSystemField } from '@common/utils/connection';
import { OptionTableUID } from '@common/types/project';
import { unique } from '@common/utils/unique';
import { LogicalOperator } from '@renderer/b2/types';
import { AbstractForm, FormElement, isSubForm } from '@renderer/b2/controllers/form';
import { Field, Table } from '@common/types/project';
import { computed, reactive, ref } from 'vue';
import { deepClone, isEmpty } from '@common/utils/object';
import { CaretBottom } from "@element-plus/icons-vue";
import { ElMessage, FormRules } from 'element-plus';
import IEpDelete from "~icons/ep/delete";
import IEpPlus from "~icons/ep/plus";
import { createWidgetI18n } from "@renderer/widgets/i18n";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  widget: FormElement;
  value?: any;
}>(), {});

const i18next = createWidgetI18n(props.widget.type);
const $t = i18next.t;

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: any);
}>();

const errorText = i18next.t("deletedFieldError")

const isSubTable = (table: Table) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
}

const getForm = () => {
  return props.widget.topForm as AbstractForm;
}
const getCurrentTable = () => {
  return {
    ...getForm().getTable(getForm().tableUID),
    name: getForm().getTable(getForm().tableUID).alias
  };
}

const isShowSubField = (elementId: string) => {
  if (!elementId) return false;
  return true;
}

const connectionTable = computed(() => {
  if (props.widget.getOption<string>("connectionTable")) {
    return props.widget.getOption<string>("connectionTable").split(",") as OptionTableUID || [];
  } else if (props.widget.getOption<string>("select-search-form")) {
    return props.widget.getOption<string>("select-search-form").split(",") as OptionTableUID || [];
  }
  return [];
})
const getLinkageConnection = () => {
  const connection = connectionTable.value[0] || undefined;
  return getForm().getBoard().getConnections().find(c => c.uid === connection);
}
const getlinkageTable = () => {
  const optionTableUID = connectionTable.value[1] || undefined;
  return getLinkageConnection()?.tables?.find(t => t.uid === optionTableUID);
}
// 表单名称返回
const getLinkageTableName = () => {
  const table = getlinkageTable();
  if (table?.meta?.extra?.primaryTable) {
    const mianTable = getForm().getTable(table.meta?.extra?.primaryTable);
    const subTableField = mianTable?.fields.find(f => table.alias.includes(f.meta.uid))
    const subTableTitle = `${mianTable?.alias}--${subTableField?.alias}`
    return subTableTitle;
  }
  return table?.alias;
}
const getFieldLabel = (element: FormElement, isInSubForm = false) => {
  let title = element.title;

  if (element.isInSubForm && !isInSubForm) {
    title = `${(element.form as FormElement).title}.${title}`;
  }
  return title;
}

const getFieldValue = (element: FormElement) => {
  if (element.isInSubForm) {
    return `${(element.form as FormElement).uid}.${element.uid}`;
  }
  return element.uid;
}

// 判断field和element是否同一类型
const equivalentGroups = ["text", "tag"];
const isSameElementType = (field: Field, element: FormElement) => {
  if (!field || !element) return false;
  if ((field.type === element.fieldType && (element.resolveFormSetting().subType === field.meta?.subType || (equivalentGroups.includes(element.resolveFormSetting().subType) && equivalentGroups.includes(field.meta?.subType))))) {
    return true;
  }
  return false;
}
const currentFormElements = (fillItem) => {
  if (!fillItem.linkageField) return [];
  const children = getForm().children as FormElement[]
  const tempField = getlinkageTable()?.fields.find(f => f.uid === fillItem.linkageField)

  // 递归展开 multipleTabs 的 widgets
  const flattenWidgets = (elements: FormElement[]): FormElement[] => {
    return elements.flatMap(el => {
      if (el.type === 'widget.form.multipleTabs') {
        // 展开每个 tab 下的 widgets
        return flattenWidgets(el.widgets.flatMap(tab => tab.widgets as unknown as FormElement[]))
      } else if (isSubForm(el)) {
        return [el].flat(Infinity) as FormElement[];
      }
      return el
    })
  }

  return flattenWidgets(children).filter(c => !notAllowFillSelectTypes.includes(c.type) && isSameElementType(tempField, c))
}

const handleFormulaUpdate = (value) => {
  fillRule.value[indexOfFieldEditingFormula.value].formula = value;
}

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

// 允许公式编辑的字段类型
const allowFormulaFieldType = ["widget.form.datePicker", "widget.form.hyperlink", "widget.form.textInput", "widget.form.numberInput", "widget.form.textarea"];
const valueTypeOptions = (fillItem) => {
  const field = getlinkageTable()?.fields.find(f => f.uid === fillItem.linkageField);
  if (field && allowFormulaFieldType.includes(field.meta?.extra?.widgetType)) {
    return valueTypeOptions2;
  }
  return valueTypeOptions1;
}

const formRules = reactive<FormRules>({});

const fillRule = ref<{
  linkageField: string;
  currentWidget?: string;
  type: FormConditionValueType;
  formula?: string;
  value?: any;
  selectedElement?: any;
  selectedElementTpye?: RuleFuncValue;
}[]>([
  {
    linkageField: null,
    currentWidget: null,
    type: FormConditionValueType.FORM,
    formula: null,
    value: null,
  }
])

const handleAddFillField = () => {
  fillRule.value.push({
    linkageField: null,
    currentWidget: null,
    type: FormConditionValueType.FORM,
    formula: null,
    value: null,
  })
}

const onOpen = () => {
  if (!isEmpty(props.value)) {
    fillRule.value = deepClone(props.value);
    // 初始化自定义值的框
    fillRule.value.forEach(async (item) => {
      item.selectedElement = await getInstance(item.linkageField);
      const tempFunc = item.selectedElement?.type === "widget.form.datePicker" ? RuleFunc.TIME_EQUAL : RuleFunc.EQUAL;
      item.selectedElementTpye = item.selectedElement ? await funcValue(item.linkageField, tempFunc) : null;
    })
  } else {
    fillRule.value = [
      {
        linkageField: null,
        currentWidget: null,
        type: FormConditionValueType.FORM,
        formula: null,
        value: null,
      }
    ]
  }
};

const handleDeleteAllCondition = () => {
  fillRule.value = []
}
const isSubmit = ref(false);
const formRef = ref(null);
const handleConfirm = async () => {
  isSubmit.value = true;
  await formRef.value.validate((valid) => {
    if (!valid) {
      ElMessage.warning(i18next.t("incompleteAddDataRule"));
      return;
    }
    fillRule.value.forEach(item => {
      if (item.selectedElement) {
        delete item.selectedElement
      }
      if (item.selectedElementTpye) {
        delete item.selectedElementTpye
      }
    })

    emit("update", deepClone(fillRule.value));
    emit("update:modelValue", false);
  });
  isSubmit.value = false;
};

const tempFormula = ref("");
const indexOfFieldEditingFormula = ref();
const formulaVisible = ref(false);
const handleEditFormula = (item, index) => {
  tempFormula.value = item.formula;
  indexOfFieldEditingFormula.value = index;
  formulaVisible.value = true;
}

const getConditionFormRules = <T>(condition: T, key: keyof T) => {
  if(key === "linkageField" && isShowSubField((condition as any).fillWidget)) {
    return []
  }
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!condition[key] && condition[key] !== 0) return callback(new Error(''));
        callback();
      }
    }
  ]
}

const allLinkageTableFields = computed(() => {
  if (isEmpty(connectionTable.value)) return [];
  const table = props.widget.getTable(connectionTable.value as OptionTableUID);
  if (!table) return [];
  const { baseFields, subFields } = table.fields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
    if (isSystemField(f)) return prev;
    if (f.meta.subType === "subForm") {
      prev.subFields.push(f);
    } else {
      prev.baseFields.push(f);
    }
    return prev;
  }, { baseFields: [], subFields: [] });
  const subFormFields = subFields.map(f => {
    const subTable = props.widget.getTable(f.meta.extra.subTableUID);
    return (subTable?.fields || []).filter(sf => !isSystemField(sf)).map(sf => {
      return {
        ...sf,
        alias: `${f.alias}.${sf.alias}`,
        uid: `${f.uid}.${sf.uid}`,
      }
    })
  })?.flat(Infinity) as Field[];

  return [...baseFields, ...subFields, ...subFormFields];
});

const staticDescription = ref({
  title: i18next.t("fillRulesTitle"),
  description: i18next.t("targetForm"),
})

const notAllowFillSelectTypes = ["widget.form.selectData", "widget.form.searchForm", "widget.form.relatedData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.titleBar", "widget.form.imageTextShow", "widget.form.autoCompute"];
const getTargetLinkageTableFields = computed(() => {
  // 先不允许子表填充（f.uid.split(".").length === 1）
  return allLinkageTableFields.value.filter(f => !isSystemField(f) && f.meta.subType !== "subForm" && f.uid.split(".").length === 1 && !notAllowFillSelectTypes.includes(f.meta?.extra?.widgetType)) || []
})

const handleChangeLinkageField = async (fillItem) => {
  fillItem.type = FormConditionValueType.FORM;
  if (fillItem.linkageField) {
    const element = await getInstance(fillItem.linkageField);
    const tempFunc = element?.type === "widget.form.datePicker" ? RuleFunc.TIME_EQUAL : RuleFunc.EQUAL;
    fillItem.selectedElement = element || null;
    fillItem.selectedElementTpye = element ? await funcValue(fillItem.linkageField, tempFunc) : null;
  } else {
    fillItem.selectedElement = null;
    fillItem.selectedElementTpye = null;
  }
  handleChangeValueType(fillItem)
}

const handleChangeValueType = (fillItem) => {
  fillItem.value = null;
  fillItem.currentWidget = null;
  fillItem.formula = null;
}

const getInstance = async (fieldId: string) => {
  const option = getTargetLinkageTableFields.value?.find(option => option.uid === fieldId);
  if (!option) return;
  if(option.meta?.extra?.widgetType) {
    const curElement = await formElementInstances.getInstance(option.meta?.extra?.widgetType)
    return curElement;
  }
}
const filterMenus = async (fieldId: string) => {
  const option = getTargetLinkageTableFields.value?.find(option => option.uid === fieldId);
  if (!option) return {};
  const instance = await getInstance(fieldId);
  if(instance) {
    const configurations = instance?.getConfigurations();
    return configurations?.editFuncInfo || {};
  } else {
    const configurations = getSystemColumnConfigurations(option.meta.name);
    return configurations?.editFuncInfo || {};
  }
}

const funcValue = async (fieldId: string, key: RuleFunc): Promise<RuleFuncValue> => {
  const funcs = await filterMenus(fieldId)
  return funcs[key] || funcs[Object.keys(funcs)[0]];
}
</script>

<style lang='scss' scoped>
.add-form-data-value {
  @mixin diy-select {
    width: 70px;
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

    .el-select__wrapper {
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
    .el-input__wrapper {
      border-radius: 4px;
      background-color: var(--bg-color-overlay);
      box-shadow: unset;

      &:hover {
        box-shadow: 0 0 0 1px var(--border-color) inset;
      }

      &.is-focus {
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
      width: 192px;
    }
  }

  :deep(.add-form-data-value-dialog) {
    height: 640px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);
    --dialog-header-height: 40px;
    --dialog-footer-height: 80px;
    .el-dialog__header {
      height: var(--dialog-header-height);
      display: flex;
      align-items: center;
      justify-content: center;
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
      padding: 16px 6px;

      .container-scrollbar {
        padding: 0 10px;

        .container {
          display: flex;
          flex-direction: column;
          row-gap: 32px;

          .container-tip-header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            .tip {
              display: flex;
              font-size: 14px;
              color: var(--text-color-primary);
              height: 24px;
              align-items: center;
              column-gap: 4px;

              .el-tag {
                border: 0;
                .el-tag__content {
                  font-size: 14px;
                }
                .el-text {
                  max-width: 208px;
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
              row-gap: 4px;
              .fill-field-item {
                display: flex;
                align-items: end;
                font-size: 12px;
                position: relative;
                gap: 8px;

                .text {
                  width: 120px;
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

                .current-field {
                  width: 288px;
                  .field {
                    @include field;

                    .select-value-type {
                      @include diy-select;
                      width: 70px;
                      .el-select__wrapper {
                        text-align: center;
                        font-size: 12px;
                      }
                    }
                  }
                }

                .linkage-field {
                  width: 208px;
                  .field {
                    display: flex;
                    align-items: center;
                    column-gap: 8px;
                    .el-select {
                      width: 200px;
                    }

                    .el-form-item {
                      // flex: 1;
                      width: 200px;
                      margin-right: 8px;
                    }
                  }
                }

                .fill-field-select, .linkage-field-select {
                  @include common-select();
                }

                .formula-button {
                  width: 192px;
                  border-radius: 4px;
                  background-color: var(--bg-color-overlay);
                  font-size: 12px;
                  &.has-formula :deep(span) {
                    color: var(--color-primary);
                  }
                }

                .current-vaule-input {
                  border-radius: 4px;
                  background-color: var(--bg-color-overlay);

                  &:hover {
                    background-color: var(--bg-color-hover);
                  }

                  .el-input__wrapper, .el-input-tag__wrapper {
                    width: 192px;
                    box-shadow: none;
                    border: none;
                    background: transparent;
                    .el-input__inner {
                      font-size: 12px;
                    }
                  }
                  .el-select__wrapper, .el-date-editor {
                    width: 192px;
                  }
                }

                .delete {
                  @include delete;
                  height: 32px;
                  position: absolute;
                  right: 8px;
                }
              }
            }
          }
        }
      }
    }

    .el-dialog__footer {
      height: var(--dialog-footer-height);
      padding: 9px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: end;
      align-items: center;
      position: relative;
      .filter-select-tips {
        position: absolute;
        left: 16px;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        color: #A1A1A1;
      }

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
