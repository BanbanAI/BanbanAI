<template>
  <div class="echart-data-filter-dialog">
    <el-dialog class="echart-filter-visibility-dialog" :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)" :title="$t('FieldsFilterConditionsDialog.dataFilter')" align-center width="680" destroy-on-close
      :close-on-click-modal="false" @open="onOpen" draggable>
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="filterRule" ref="formRef">
          <div class="container-tip-header">
            <p class="tip">{{ $t('FieldsFilterConditionsDialog.dataSourceForm') }}:<el-tag>{{ getlinkageTable()?.alias }}</el-tag></p>

            <el-button class="btn-delete-all-condition" link @click="handleDeleteAllCondition">
              <el-icon :szie="16">
                <Delete />
              </el-icon>
              {{ $t('FieldsFilterConditionsDialog.clear') }}
            </el-button>
          </div>

          <div class="condition-option">
            <div class="logic">
              <span>{{ $t('FieldsFilterConditionsDialog.satisfyFollow') }}</span>
              <el-select class="logic-select" size="small" v-model="filterRule.logic" :suffix-icon="CaretBottom"
                :no-data-text="$t('FieldsFilterConditionsDialog.noData')">
                <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <span>{{ $t('FieldsFilterConditionsDialog.conditionData') }}</span>
            </div>

            <el-button class="btn-add-condition" link @click="handleAddCondition">
              <el-icon :size="16" style="margin-right: 4px;">
                <Plus />
              </el-icon>
              {{ $t('FieldsFilterConditionsDialog.addAddition') }}
            </el-button>
          </div>

          <ul class="condition-list">
            <li class="condition-title">
              <span class="linkage-field-title">{{ $t('FieldsFilterConditionsDialog.dataSourceFormField') }}</span>
              <!-- /自定义值 -->
              <span class="current-field-title">{{ $t('FieldsFilterConditionsDialog.customValue') }}</span>
            </li>
            <li class="condition-item" v-for="(condition, index) in filterRule.conditions">
              <div class="linkage-table-field-wrapper">
                <el-form-item prop="uid" :rules="getConditionFormRules(condition, 'uid')">
                  <field-select :modelValue="condition.uid" :options="linkageTableFieldOptions" @update:modelValue="(val) => condition.uid = val"
                  @change="handleSelectLinkageField(condition)" filterable :placeholder="$t('FieldsFilterConditionsDialog.selectQueryFormFields')" :no-data-text="$t('FieldsFilterConditionsDialog.noData')" :show-arrow="false" :offset="4">
                  </field-select>
                </el-form-item>
              </div>

              <div class="rule-select-wrapper">
                <el-select class="rule-select" v-model="condition.func" :suffix-icon="CaretBottom" :show-arrow="false" :offset="4" :no-data-text="$t('FieldsFilterConditionsDialog.noData')" :disabled="!condition.uid" popper-class="data-filiter-rule-select-popper" @change="handleFuncChange(condition)">
                  <el-option v-for="value, key in condition.funcOptions" :key="key" :label="RuleFuncTextMapping[key]" :value="key" />
                </el-select>
              </div>

              <el-select
                class="current-select"
                v-model="condition.fieldType"
                @change="handleFieldTypeChange(condition)"
                :disabled="canSelectFieldType(condition)"
              >
                <el-option
                  :value="FormConditionValueType.CUSTOM"
                  :label="($t('FieldsFilterConditionsDialog.customValue') as string)"
                />
                <el-option
                  :value="FormConditionValueType.FORMULA"
                  :label="($t('FieldsFilterConditionsDialog.formulaEdit') as string)"
                />
              </el-select>
              <div class="current-field-wrapper" v-if="isShowCurrentField(condition)">
                <el-form-item prop="value" v-if="condition.fieldType === FormConditionValueType.CUSTOM" :rules="getConditionFormRules(condition, 'value')">
                  <el-config-provider :locale="locale">
                    <form-filter-value-format class="current-field-input" :otherTableFieldUID="props.widget.getMetaData()?.axisValue[0]?.uid" :disabled="!condition.uid" v-model="condition.value" :element="condition.slelectedElement" :fieldId="condition.uid" :selectElementUid="linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField.meta?.uid" :type="condition.slelectedElementTpye" :placeholder="$t('FieldsFilterConditionsDialog.pleaseInput')" :widget="(props.widget as any)" />
                  </el-config-provider>
                </el-form-item>
                <el-form-item v-else prop="formula" :rules="getConditionFormRules(condition, 'formula')">
                  <el-button
                    :class="['formula-button', condition.formula ? 'has-formula' : '']"
                    @click="handleEditFormula(condition, index)"
                    :style="{color: condition.formula ? 'var(--color-primary)' : 'var(--text-color-regular)'}"
                  >
                    {{ condition.value ? $t('FieldsFilterConditionsDialog.setted') : $t('FieldsFilterConditionsDialog.setFormula') }}
                  </el-button>
                </el-form-item>
              </div>
              <div class="current-field-wrapper" v-else></div>

              <div :class="['delete']">
                <el-icon :zie="16" @click="handleDeleteCondition(index)">
                  <Delete />
                </el-icon>
              </div>
            </li>
          </ul>
        </el-form>
      </el-scrollbar>
      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t('FieldsFilterConditionsDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('FieldsFilterConditionsDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
    <source-table-formula-dialog
      v-model="formulaVisible"
      @update="handleUpdate"
      :value="tempCondition?.formula"
      :defaultTables="[]"
      :tables="[]"
      :otherTableLabel="''"
      :hiddenCurrentTable="true"
      :supportTableFields="false"
    />
  </div>
</template>

<script setup lang='ts'>
import { FieldUID } from '@common/types/project';
import { FormConditionValueType, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { formElementInstances } from '@renderer/utils/instance';
import { getSystemColumnConfigurations, isSystemField, SystemField } from '@common/utils/connection';
import { LogicalOperator, SelectIdOfForm } from './types';
import { Widget } from '@renderer/b2/controllers/widget';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { computed, reactive, ref } from 'vue';
import { CaretBottom, Delete, Plus } from "@element-plus/icons-vue";
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { deepClone, isEmpty } from '@common/utils/object';
import i18next from 'i18next';
type FormCondition = {
  uid: FieldUID;
  func: RuleFunc;
  value: any;
  fieldType?: FormConditionValueType;
  formula?: string;
  funcOptions?: object;
  slelectedElement?: any;
  slelectedElementTpye?: any;
  comparisonOfForm?: SelectIdOfForm;
};
type FilterRule = {
  logic: LogicalOperator;
  conditions: FormCondition[];
};
const isSubmit = ref(false);

const props = defineProps<{
  modelValue: boolean,
  widget: Widget;
  value: FilterRule,
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: any);
}>();

const formRules = reactive<FormRules<FilterRule>>({})

const filterRule = ref<FilterRule>({
  logic: LogicalOperator.AND,
  conditions: [],
})

const onOpen = () => {
  if (!isEmpty(props.value)) {
    filterRule.value = deepClone(props.value);
    // 初始化自定义值的框
    filterRule.value.conditions.forEach(async (condition) => {
      condition.slelectedElement = await getInstance(condition.uid);
      condition.slelectedElementTpye = await funcValue(condition.uid, condition.func);
      const funcs = await filterMenus(condition.uid);
      condition.funcOptions = funcs;
    })
  } else {
    filterRule.value = {
      logic: LogicalOperator.AND,
      conditions: [],
    }
  }

  if (filterRule.value.conditions.length === 0) handleAddCondition();
}

const formRef = ref<FormInstance>();
const handleConfirm = async () => {
  isSubmit.value = true;
  await formRef.value.validate((valid) => {
    if (!valid) {
      ElMessage.warning(i18next.t("FieldsFilterConditionsDialog.setCompleteConditions"));
      return;
    }

    // slelectedElement和slelectedElementTpye提交筛选逻辑时需要删除，否则会保存失败
    filterRule.value.conditions.forEach(condition => {
      if (condition.slelectedElement) {
        delete condition.slelectedElement
      }
      if (condition.slelectedElementTpye) {
        delete condition.slelectedElementTpye
      }
      if (condition.funcOptions) {
        delete condition.funcOptions
      }
    })

    emit("update", filterRule.value);
    emit("update:modelValue", false);
  });
  isSubmit.value = false;
}

const handleDeleteAllCondition = () => {
  filterRule.value.conditions = []
}

const handleAddCondition = () => {
  filterRule.value.conditions.push({
    uid: null,
    func: RuleFunc.EQUAL,
    value: null,
    fieldType: FormConditionValueType.CUSTOM,
    funcOptions: {[RuleFunc.EQUAL]: RuleFuncTextMapping[RuleFunc.EQUAL]},
  })
}

const handleDeleteCondition = (index: number) => {
  filterRule.value.conditions.splice(index, 1);
}

const getLinkageConnection = () => {
  const connectionUID = props.widget.getMetaData()?.axisValue?.[0]?.uid?.[0];
  return props.widget.getBoard().getConnections().find(c => c.uid === connectionUID);
}

const getlinkageTable = () => {
  const optionTableUID = props.widget.getMetaData()?.axisValue[0]?.uid || undefined;
  const connection = getLinkageConnection() as any;
  return connection?.tables?.find(t => t.uid === optionTableUID?.[1]);
}

const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t("FieldsFilterConditionsDialog.all") },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t("FieldsFilterConditionsDialog.one") },
  },
];

const notAllowSelectTypes = ["widget.form.selectData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const linkageTableFieldOptions = computed(() => {
  const table = getlinkageTable();
  if (table) {
    const formData = getLinkageConnection() as any;
    if (!formData) return [];
    const { baseFields, subFields } = table.fields.reduce<{ baseFields, subFields }>((prev, f) => {
      if (isSystemField(f)) return prev;
      if (f.meta.subType === "subForm") {
        prev.subFields.push(f);
      } else {
        prev.baseFields.push(f);
      }
      return prev;
    }, { baseFields: [], subFields: [] });
    const fields = table.fields?.filter(f => {
      let isAllow = true
      // if(isSystemField(f) && !systemFieldNameOfFilter.includes(f.meta.name as SystemField)) {
      //   isAllow = f.meta.name === SystemField.STATUS ? isProcessTable(formData?.formOptions?.[optionTableUID]) : false
      // }
      return isAllow && f.meta.subType !== "subForm" && !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)
    }) || [];
    const tableOptions = fields.map(f => {
      return {
        label: f.alias,
        value: f.uid,
        selfField: f,
      }
    })

    const subOptions = subFields.map(f => {
      const subTable = formData.tables?.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
      return subTable?.fields?.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)).map(sf => {
        return {
          label: `${f.alias}.${sf.alias}`,
          value: `${f.uid}.${sf.uid}`,
          selfField: sf,
        }
      }) ?? [];
    }).filter(f => f !== undefined)

    if (subOptions.length > 0) {
      let temp = []
      subOptions.forEach((subOptionItem) => {
        temp.push(...subOptionItem)
      })
      return [...tableOptions, ...temp]
    }

    return [...tableOptions]
  }
  return []
})

const formulaVisible = ref(false);
const tempCondition = ref<FormCondition>();
const handleEditFormula = (condition: FormCondition, index: number) => {
  tempCondition.value = condition;
  formulaVisible.value = true;
}

const handleUpdate = (value: string) => {
  if (!tempCondition.value) return;
  tempCondition.value.formula = value;
}

const getConditionFormRules = <T>(condition: T, key: keyof T) => {
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!isSubmit.value) return;
        if (!condition[key] && condition[key] !== 0) return callback(new Error(''));
        callback();
      }
    }
  ]
}

const isShowCurrentField = (conditionItem) => {
  if ([RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(conditionItem.func)) {
    conditionItem.value = ""
    return false
  } else {
    return true
  }
}

const noAllowUseFormulaType = ["widget.form.memberSelect", "widget.form.departmentSelect"]
const canSelectFieldType = (condition) => {
  const table = getlinkageTable();
  let field;
  const fieldUids = condition.uid?.split(".")
  if (fieldUids?.length > 1) { // 子表
    const subField = table.fields.find(f => f.uid === fieldUids?.[0]);
    const subTable = props.widget.getTable(subField.meta.extra.subTableUID);
    field = subTable.fields.find(f => f.uid === fieldUids?.[1]);
  } else {
    field = table.fields.find(f => f.uid === condition.uid);
  }
  
  if (!condition.uid || !condition.func) return true;
  if (noAllowUseFormulaType.includes(field.meta?.extra?.widgetType)) return true;
  if (condition.func === RuleFunc.DYNAMIC) return true;
  return false;
}

const handleSelectLinkageField = async (condition) => {
  const funcs = await filterMenus(condition.uid);
  condition.func = (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL;
  condition.funcOptions = funcs;
  handleFuncChange(condition);
}

const handleFuncChange = async (condition) => {
  condition.fieldType = FormConditionValueType.CUSTOM;
  handleFieldTypeChange(condition)
}

const handleFieldTypeChange = async (condition) => {
  const type = await funcValue(condition.uid, condition.func);
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    condition.value = [];
  } else {
    condition.value = null;
  }
  condition.formula = null;
  condition.slelectedElement = await getInstance(condition.uid);
  condition.slelectedElementTpye = await funcValue(condition.uid, condition.func);
}

const getInstance = async (fieldId: string) => {
  const option = linkageTableFieldOptions.value?.find(option => option.value === fieldId);
  if (!option) return;
  const { selfField } = option
  if(selfField.meta?.extra?.widgetType) {
    const curElement = await formElementInstances.getInstance(selfField.meta?.extra?.widgetType)
    return curElement;
  }
}
const filterMenus = async (fieldId: string) => {
  const option = linkageTableFieldOptions.value?.find(option => option.value === fieldId);
  if (!option) return {};
  const { selfField } = option
  const instance = await getInstance(fieldId);
  if(instance) {
    const configurations = instance?.getConfigurations();
    return configurations?.funcInfo || {};
  } else {
    const configurations = getSystemColumnConfigurations(selfField.meta.name);
    return configurations?.funcInfo || {};
  }
}

const funcValue = async (fieldId: string, key: RuleFunc): Promise<RuleFuncValue> => {
  const funcs = await filterMenus(fieldId)
  return funcs[key] || funcs[RuleFunc.EQUAL];
}
</script>

<style lang='scss' scoped>
.echart-data-filter-dialog {
  --color-primary: #0873FF;

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

  @mixin diy-select {
    width: 104px;
    border-radius: 4px;
    background-color: var(--bg-color-overlay);

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
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

  @mixin common-select {
    .el-select__wrapper {
      width: 320px;
      height: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      box-shadow: 0 0 0 0px var(--border-color) inset;

      &:hover {
        box-shadow: 0 0 0 1px var(--border-color) inset;
      }

      &.is-focused {
        box-shadow: 0 0 0 1px var(--color-primary) inset !important;
      }
    }
  }

  :deep(.echart-filter-visibility-dialog) {
    height: 608px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);
    --dialog-header-height: 40px;
    --dialog-footer-height: 64px;

    .el-dialog__header {
      height: var(--dialog-header-height);
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);

      .el-dialog__title {
        font-size: 14px;
        line-height: 20px;
      }

      .el-dialog__headerbtn {
        width: var(--dialog-header-height);
        height: var(--dialog-header-height);
      }
    }

    .el-dialog__body {
      height: calc(100% - var(--dialog-header-height) - var(--dialog-footer-height));
      padding: 24px 20px;

      .container-scrollbar {

        .container {
          display: flex;
          flex-direction: column;
          align-items: start;
          .container-tip-header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            margin-bottom: 32px;
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
                  max-width: 230px;
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

          .condition-option {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            height: 24px;
            margin-bottom: 16px;
            color: var(--text-color-primary);

            .logic {
              display: flex;
              align-items: center;
              column-gap: 8px;
              height: 32px;

              .logic-select {
                @include diy-select;
                width: 60px;
                background-color: var(--bg-color-overlay);

                .el-select__wrapper {
                  height: 100%;

                  .el-select__selection {
                    font-size: 12px;
                  }
                }
              }

              .buttons {
                margin-left: auto;
              }
            }
            .btn-add-condition {
              margin-left: auto;
              span {
                line-height: 20px !important;
                font-size: 14px !important;
              }
            }
            .btn-add-condition:hover {
              color: var(--color-primary);
            }
          }

          .condition-list {
            display: flex;
            flex-direction: column;
            row-gap: 8px;
            padding: 4px 0;
            width: 100%;

            .condition-title {
              width: 100%;
              height: 16px;
              line-height: 16px;
              position: relative;

              .linkage-field-title {
                position: absolute;
                font-size: 12px;
                left: 0;
              }

              .current-field-title {
                position: absolute;
                font-size: 12px;
                right: 300px;
              }
            }

            .condition-item {
              display: flex;
              align-items: end;
              gap: 8px;
              width: 100%;

              .current-select {
                @include diy-select;
                width: 80px !important;
                background-color: var(--bg-color-overlay);

                .el-select__wrapper {
                  height: 100%;

                  .el-select__selection {
                    font-size: 12px;
                  }
                }
              }

              .current-field-wrapper {
                width: 230px;

                .el-form-item.is-error {
                  .el-select__wrapper {
                    box-shadow: 0 0 0 1px var(--color-danger) inset !important;
                  }
                }

                .el-select {
                  @include common-select;
                  .el-select__wrapper {
                    width: 100%;

                    .el-select__selection {
                      font-size: 12px;
                    }
                  }
                }

                .formula-button {
                  border-radius: 4px;
                  background-color: var(--bg-color-overlay);
                  width: 230px;

                  &.has-formula :deep(span) {
                    color: var(--color-primary);
                  }
                }

                .current-field-input {
                  border-radius: 4px;
                  background-color: var(--bg-color-overlay);
                  gap: 4px;

                  // &:hover {
                  //   background-color: var(--bg-color-hover);
                  // }
                  .el-tag {
                    background-color: #e6f3ff;
                    color: var(--color-primary);
                  }
                  .el-input__wrapper, .el-input-tag__wrapper {
                    width: 230px;
                    box-shadow: none;
                    border: none;
                    background: transparent;
                    .el-input__inner {
                      font-size: 12px;
                    }
                  }
                  .el-date-editor {
                    width: 100%;
                  }
                  .el-select__wrapper {
                    width: 230px;
                  }
                }
              }

              .linkage-table-field-wrapper {
                width: 160px;

                .el-form-item.is-error {
                  .el-select__wrapper {
                    box-shadow: 0 0 0 1px var(--color-danger) inset !important;
                  }
                }

                .el-select {
                  @include common-select;
                  .el-select__wrapper {
                    width: 160px;
                    font-size: 12px;
                  }
                }
              }

              .current-field-wrapper,
              .linkage-table-field-wrapper {
                display: flex;
                flex-direction: column;
                row-gap: 8px;

                .field-select {
                  width: 100%;
                }
              }


              .rule-select-wrapper {
                flex: 1;
                padding: 0;
                display: flex;
                justify-content: center;

                .rule-select {
                  @include diy-select;
                  width: fit-content;
                  .el-select__wrapper {
                    text-align: center;
                    font-size: 12px;
                  }
                }
              }

              .delete {
                height: 32px;
                @include delete;
                margin-left: 8px;
              }
            }

          }
        }
      }
    }

    .el-dialog__footer {
      height: var(--dialog-footer-height);
      padding: 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: end;
      align-items: center;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
