<template>
  <div class="linkage-data-filter-dialog">
    <el-dialog class="form-visibility-dialog" :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)" :title="$t('dataFilterTitle')" align-center width="680" destroy-on-close
      :close-on-click-modal="false" @open="onOpen" draggable>
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="filterRule" ref="formRef">
          <div class="container-tip-header">
            <p class="tip">{{ $t("searchFormLabel") }}:<el-tag>{{ getlinkageTable()?.alias }}</el-tag></p>

            <el-button class="btn-delete-all-condition" link @click="handleDeleteAllCondition">
              <el-icon :zie="16">
                <i-ep-delete />
              </el-icon>
              {{ $t("clear") }}
            </el-button>
          </div>

          <div class="condition-option">
            <div class="logic">
              <span>{{ $t("matchFollowing") }}</span>
              <el-select class="logic-select" size="small" v-model="filterRule.logic" :suffix-icon="CaretBottom"
                :no-data-text="$t('noData')">
                <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <span>{{ $t("conditionDataSuffix") }}</span>
            </div>

            <el-button class="btn-add-condition" link @click="handleAddCondition">
              <el-icon :size="16" style="margin-right: 4px;">
                <i-ep-plus />
              </el-icon>
              {{ $t("addCondition") }}
            </el-button>
          </div>

          <ul class="condition-list">
            <li class="condition-title">
              <span class="linkage-field-title">{{ $t("searchFormField") }}</span>
              <!-- /自定义值 -->
              <span class="current-field-title">{{ $t("currentFormFieldOrCustomValue") }}</span>
            </li>
            <li class="condition-item" v-for="(condition, index) in filterRule.conditions">
              <div class="linkage-table-field-wrapper">
                <el-form-item :prop="`conditions.${index}.uid`" :rules="getConditionFormRules(condition, 'uid')">
                  <field-select :modelValue="condition.uid" :options="linkageTableFieldOptions" @update:modelValue="(val) => condition.uid = val"
                  @change="handleSelectLinkageField(condition)" filterable :placeholder="$t('pleaseSelectSearchFormField')" :no-data-text="$t('noData')" :show-arrow="false" :offset="4">
                  </field-select>
                </el-form-item>
              </div>

              <div class="rule-select-wrapper">
                <el-select class="rule-select" v-model="condition.func" :suffix-icon="CaretBottom" :show-arrow="false" :offset="4" :no-data-text="$t('noData')" :disabled="!condition.uid" popper-class="data-filiter-rule-select-popper" @change="handleFuncChange(condition)">
                  <el-option v-for="value, key in condition.funcOptions" :key="key" :label="RuleFuncTextMapping[key]" :value="key" />
                </el-select>
              </div>

              <el-select class="current-select" v-if="isShowCurrentField(condition)" v-model="condition.fieldType" :suffix-icon="CaretBottom" :no-data-text="$t('noData')" :disabled="disabledCurrentFieldWrapper(condition)" @change="handleFieldTypeChange(condition)">
                <el-option v-for="item in currentFieldWrapperOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>

              <div class="current-field-wrapper" v-if="isShowCurrentField(condition)">
                <el-form-item :prop="getConditionProp(condition, index)" :rules="getConditionFormRules(condition, getConditionRuleKey(condition))">
                  <field-select v-if="condition.fieldType === CurrentFieldWrapperOperator.FIELD && isEmpty(curFormRelatedTables)" :modelValue="condition.comparisonUid" :fit-input-width="true" :isGroups="false" :options="tablesGroupOptions(linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField)" @update:modelValue="(val) => condition.comparisonUid = val"
                  filterable :placeholder="$t('pleaseSelectCurrentFormField')" :no-data-text="$t('noData')" :no-match-text="$t('noData')" :show-arrow="false" :offset="4" :disabled="!condition.uid || !condition.func" @change="handleComparisonChange(condition, linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField)"></field-select>
                  <field-tree-select v-else-if="condition.fieldType === CurrentFieldWrapperOperator.FIELD" :modelValue="condition.comparisonUid" :fit-input-width="true" :isGroups="true" :options="tablesGroupOptions(linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField)" @update:modelValue="(val) => condition.comparisonUid = val"
                  filterable :placeholder="$t('pleaseSelectCurrentFormField')" :no-data-text="$t('noData')" :no-match-text="$t('noData')" :show-arrow="false" :offset="4" :disabled="!condition.uid || !condition.func" @change="handleComparisonChange(condition, linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField)">
                  </field-tree-select>
                  <el-config-provider v-else :locale="locale">
                    <form-filter-value-format class="current-field-input" v-model="condition.value" :element="condition.slelectedElement" :fieldId="condition.uid" :selectElementUid="getConditionSelectElementUID(condition)" :type="condition.slelectedElementTpye" :placeholder="$t('pleaseInput')" :widget="props.widget as any" />
                  </el-config-provider>
                </el-form-item>
              </div>

              <div :class="['delete']">
                <el-icon :zie="16" @click="handleDeleteCondition(index)">
                  <i-ep-delete />
                </el-icon>
              </div>
            </li>
          </ul>
        </el-form>
      </el-scrollbar>

      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t("cancel") }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t("confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, inject, reactive, ref } from 'vue';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { isProcessTable } from '@common/utils/flow';
import { isNocodeFormData, isSystemField, SystemField, getSystemColumnConfigurations } from '@common/utils/connection';
import { formElementInstances } from '@renderer/utils/instance';
import { RuleFunc, RuleFuncValue, RuleFuncTextMapping, FormWidgetType } from '@common/types/nocode';
import { LogicalOperator } from '@renderer/b2/types';
import { AbstractForm, FormElement } from '@renderer/b2/controllers/form';
import { CaretBottom, Search } from "@element-plus/icons-vue";
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { FilterRule, SelectIdOfForm } from './types';
import { CurrentFieldWrapperOperator } from './types';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import FormFilterValueFormat from "./FormFilterValueFormat.vue"
import { elementPlusLocale as locale } from "@renderer/widgets/utils/elementPlusLocale";
import { RelatedData } from "../relatedData/relatedData"
import i18next, { $t } from "@renderer/widgets/i18next";

type Column = {
  uid: `f_${string}`,
  elementId?: string,
  name: string,
  alias: string,
  subType: string,
  extra?: any,
  subColumns?: Column[],
  isSubColumn?: boolean,
}

type Option = {
  label: string;
  value: string;
  column?: Column;
  parent?: Column;
}

const props = defineProps<{
  modelValue: boolean,
  widget: AbstractForm | FormElement;
  value: FilterRule,
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: FilterRule);
}>();

const logicOptions = [
  {
    value: LogicalOperator.AND,
    label: i18next.t("all"),
  },
  {
    value: LogicalOperator.OR,
    label: i18next.t("any"),
  },
];

const currentFieldWrapperOptions = [
  {
    value: CurrentFieldWrapperOperator.FIELD,
    label: i18next.t("field"),
  },
  {
    value: CurrentFieldWrapperOperator.INPUT,
    label: i18next.t("custom"),
  },
];

const disabledCurrentFieldWrapper = (condition) => {
  const field = linkageTableFieldOptions.value.find(option => option.value === condition.uid)?.selfField;
  // 关联表单不允许选择自定义输入值
  if (field && field.meta?.extra?.widgetType === "widget.form.relatedData") {
    return true;
  } else if (condition.func === RuleFunc.BETWEEN || condition.func === RuleFunc.DYNAMIC || field?.meta?.name === SystemField.STATUS) {
    condition.fieldType = CurrentFieldWrapperOperator.INPUT;
    return true;
  } else {
    return !condition.uid || !condition.func;
  }
}

const filterRule = ref<FilterRule>({
  logic: LogicalOperator.AND,
  conditions: [],
})
const formRef = ref<FormInstance>();

const isShowCurrentField = (conditionItem) => {
  if ([RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(conditionItem.func)) {
    conditionItem.value = ""
    return false
  } else {
    return true
  }
}
const formRules = reactive<FormRules<FilterRule>>({
})
const notAllowSelectTypes = ["widget.form.selectData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const systemFieldNameOfFilter = [ SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER, SystemField.DATA_OWNER ]
const isSubmit = ref(false);
const visibleTableUIDs = ref<string[]>([]);
const currentFormElements = computed(() => {
  return (getForm().children as FormElement[]).filter((c) => {
    return !notAllowSelectTypes.includes(c.type);
  });
})
const isCurrentSubFormField = (widget: FormElement) => {
  return (widget as any).isInSubForm;
}

const isComparableCurrentFieldWidget = (widget: FormElement, selfField) => {
  if (!widget?.isCreateField?.()) return false;
  if (widget.uid === props.widget.uid || notAllowSelectTypes.includes(widget.getSoul().type)) return false;

  const setting = widget.resolveFormSetting?.();
  if (!setting || widget.fieldType !== selfField.type) return false;

  const equivalentGroups = ["text", "tag"];
  const isEquivalent = equivalentGroups.includes(setting.subType) && equivalentGroups.includes(selfField.meta?.subType);
  if (setting.subType !== selfField.meta?.subType && !isEquivalent) return false;

  if (widget.getSoul().type === "widget.form.relatedData") {
    return equals(setting.extra?.relatedTableUID, selfField.meta?.extra?.relatedTableUID);
  }

  return true;
}

const getCurrentSubForm = () => {
  const widget = props.widget as FormElement;
  const form = widget.form as any;

  if (form?.getSoul?.().type === "SubFormRow") {
    return form.parent as FormElement;
  }

  if (widget.isInSubForm && widget.parent?.type === "widget.form.subform") {
    return widget.parent as FormElement;
  }

  return null;
}

const currentTriggerFormElementOptions = (selfField) => {
  if (!selfField) return [];
  const currentSubForm = getCurrentSubForm();

  const currentFormOptions = (props.widget as FormElement).topForm.container.getChildWidgets(true, (w: FormElement) => {
    return !isCurrentSubFormField(w) && !notAllowSelectTypes.includes(w.type);
  }).filter((w: FormElement) => isComparableCurrentFieldWidget(w, selfField))
  .map((w: FormElement) => {
    return {
      label: w.title,
      value: w.uid,
    }
  });

  if (!currentSubForm) {
    return currentFormOptions;
  }

  const currentSubFormOptions = currentSubForm.children.filter((w: FormElement) => {
    return isComparableCurrentFieldWidget(w, selfField);
  }).map((w: FormElement) => {
    return {
      label: `${currentSubForm.title}.${w.title}`,
      value: `${currentSubForm.uid}.${w.uid}`,
    }
  });

  return [...currentFormOptions, ...currentSubFormOptions];
}

const linkageConnectionUID = computed(() => {
  return (props.widget as any).selectSearchForm?.[0];
})

const otherTableField = computed(() => {
  const value = props.widget.getOption("other-table-field");
  return Array.isArray(value) ? value[0] : undefined;
})

const linkageTableUID = computed(() => {
  return otherTableField.value?.value || (props.widget as any).selectSearchForm?.[1];
})

const linkageConnection = computed(() => {
  return getForm().getBoard().getConnections().find(c => c.uid === linkageConnectionUID.value && isNocodeFormData(c));
})

const currentFormConnection = computed(() => {
  return getForm().getBoard().getConnections().find(c => c.uid === (props.widget as FormElement).topForm.tableUID[0] && isNocodeFormData(c));
})

const canUseVisibleTable = (connectionUID?: string, tableUID?: string) => {
  if (!tableUID) return false;
  return connectionUID !== (props.widget as FormElement).topForm.tableUID[0] || visibleTableUIDs.value.includes(tableUID);
}

const linkageTableFieldOptions = computed(() => {
  const optionTableUID = linkageTableUID.value;
  if (optionTableUID && canUseVisibleTable(linkageConnectionUID.value, optionTableUID)) {
    const formData = linkageConnection.value;
    const table = formData?.tables.find(t => t.uid === optionTableUID);
    if (!table) return [];

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
      if(isSystemField(f) && !systemFieldNameOfFilter.includes(f.meta.name as SystemField)) {
        isAllow = f.meta.name === SystemField.STATUS ? isProcessTable(formData?.formOptions?.[optionTableUID]) : false
      }
      return isAllow && f.meta.subType !== "subForm" && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)
    }) || [];
    const tableOptions = fields.map(f => {
      return {
        label: f.alias,
        value: f.uid,
        selfField: f,
      }
    })

    const subOptions = subFields.map(f => {
      const subTable = formData.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
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
  return [];
})

const getConditionSelectElementUID = (condition) => {
  return linkageTableFieldOptions.value.find(option => option.value === condition.uid)?.selfField?.meta?.uid;
}

const curFormRelatedTables = computed(() => {
  const optionTableUID = linkageTableUID.value;
  const currentFormRelatedFormElement = (props.widget as FormElement).topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData");
  const currentFormRelatedTables = currentFormRelatedFormElement.map((child: RelatedData) => {
    const isSameSourceTable = linkageConnectionUID.value && optionTableUID && equals(child.connectionTable, [linkageConnectionUID.value, optionTableUID]);
    if (child.connectionTable && child.connectionTable[1] !== (props.widget as FormElement).topForm.tableUID[1] && !isSameSourceTable) {
      const connectionTable = (props.widget as FormElement).getTable(child.connectionTable);
      if (!connectionTable) return null;
      return {
        relatedTitle: child.title,
        connectionTable
      };
    }
  }).filter(t => t);
  return currentFormRelatedTables
})

const tablesGroupOptions = (selfField) => {
  const currentTable = currentFormConnection.value?.tables.find(t => t.uid === (props.widget as FormElement).topForm.tableUID[1]);
  if (!currentTable) return [];
  const options = [
    {
      label: i18next.t("currentFormFieldGroup"),
      value: SelectIdOfForm.CURRENT,
      options: [
        {
          label: currentTable.alias,
          value: currentTable.uid,
          children: currentTriggerFormElementOptions(selfField)
        }
      ],
    },
  ]
  for (const tableItemObj of curFormRelatedTables.value) {
    const connectionTable = tableItemObj?.connectionTable;
    if (!connectionTable) continue;
    if (options.find(item => item.options?.[0]?.value === tableItemObj.connectionTable.uid)) continue;
    // 单行文本可以和单选字段进行筛选，单选会有'tag'类型的subType
    const equivalentGroups = ["text", "tag"];
    options.push({
      label: `[${tableItemObj.connectionTable.alias}]${i18next.t("linkedDataFieldGroupSuffix")}`,
      value: SelectIdOfForm.LINKAGE,
      options: [
        {
          label: tableItemObj.connectionTable.alias,
          value: tableItemObj.connectionTable.uid,
          children: tableItemObj.connectionTable.fields.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType) && f.meta.subType !== "subForm")
            .filter(f => f.type === selfField?.type && (f.meta?.subType === selfField.meta?.subType || (equivalentGroups.includes(f.meta?.subType) && equivalentGroups.includes(selfField.meta?.subType))))
            .filter(f => {
              if (f.meta?.extra?.widgetType === "widget.form.relatedData") {
                return equals(f.meta?.extra?.relatedTableUID, selfField.meta?.extra?.relatedTableUID) ? true : false;
              } else {
                return true;
              }
            })
            .map(f => {
              return {
                label: f.alias,
                value: f.uid,
                selfField: f,
              }
            })
        }
      ]
    })
  }

  // 只有当前表单时不使用树状结构
  if (isEmpty(curFormRelatedTables.value)) {
    return currentTriggerFormElementOptions(selfField);
  }

  return options;
}

const isForm = (widget: any) => {
  return widget instanceof AbstractForm;
}

const getForm = () => {
  if (isForm(props.widget)) {
    return props.widget;
  }
  return props.widget.form as AbstractForm;
}

const getlinkageTable = () => {
  const optionTableUID = linkageTableUID.value;
  if (!canUseVisibleTable(linkageConnectionUID.value, optionTableUID)) return null;
  const table = linkageConnection.value?.tables.find(t => t.uid === optionTableUID);
  return table;
}

const handleAddCondition = () => {
  filterRule.value.conditions.push({
    uid: null,
    func: RuleFunc.EQUAL,
    value: null,
    fieldType: CurrentFieldWrapperOperator.FIELD,
    funcOptions: {[RuleFunc.EQUAL]: RuleFuncTextMapping[RuleFunc.EQUAL]}
  })
}

const handleDeleteCondition = (index: number) => {
  filterRule.value.conditions.splice(index, 1);
}

const handleDeleteAllCondition = () => {
  filterRule.value.conditions = []
}

const noValueRequiredFuncs = [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE];

const hasCompleteValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => hasCompleteValue(item));
  }
  return value !== null && value !== undefined && value !== "";
}

const isFieldComparison = (condition) => condition.fieldType === CurrentFieldWrapperOperator.FIELD;

const getConditionComparisonUid = (condition) => {
  if (hasCompleteValue(condition.comparisonUid)) {
    return condition.comparisonUid;
  }
  return typeof condition.value === "string" && hasCompleteValue(condition.value) ? condition.value : undefined;
}

const getConditionRuleKey = (condition) => {
  return isFieldComparison(condition) ? "comparisonUid" : "value";
}

const getConditionProp = (condition, index: number) => {
  return `conditions.${index}.${getConditionRuleKey(condition)}`;
}

const normalizeConditionValue = (condition) => {
  if (noValueRequiredFuncs.includes(condition.func)) {
    condition.value = "";
    return;
  }
  if (isFieldComparison(condition)) {
    const comparisonUid = getConditionComparisonUid(condition);
    condition.comparisonUid = comparisonUid;
    condition.value = comparisonUid ?? null;
  }
}

const getConditionFormRules = (condition, key: "uid" | "value" | "comparisonUid") => {
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!isSubmit.value) return callback();
        normalizeConditionValue(condition);
        if (key === "comparisonUid") {
          if (!hasCompleteValue(getConditionComparisonUid(condition))) return callback(new Error(''));
          return callback();
        }
        if (!hasCompleteValue(condition[key])) return callback(new Error(''));
        callback();
      }
    }
  ]
}

const getComparisonOfForm = (selfField, comparisonUid?: string): SelectIdOfForm | undefined => {
  if (!comparisonUid) {
    return undefined;
  }
  if (isEmpty(curFormRelatedTables.value)) {
    return SelectIdOfForm.CURRENT;
  }
  const comparisonOptions = tablesGroupOptions(selfField);
  const matchedCurrentField = comparisonOptions.find((option: any) => option?.value === comparisonUid);
  if (matchedCurrentField) {
    return SelectIdOfForm.CURRENT;
  }

  const comparisonSelectedGroup = comparisonOptions.find((group: any) => {
    if (!Array.isArray(group?.options)) return false;
    return group.options.some((option: any) => {
      if (!Array.isArray(option?.children)) return false;
      return option.children.some((child: any) => child.value === comparisonUid);
    });
  });
  const comparisonOfForm = comparisonSelectedGroup?.value;
  return comparisonOfForm === SelectIdOfForm.CURRENT || comparisonOfForm === SelectIdOfForm.LINKAGE
    ? comparisonOfForm
    : undefined;
}

const handleComparisonChange = (condition, selfField, comparisonUid = condition.comparisonUid) => {
  condition.comparisonUid = comparisonUid;
  condition.comparisonOfForm = getComparisonOfForm(selfField, comparisonUid);
  condition.value = comparisonUid ?? null;
}

const handleSelectLinkageField = async (condition) => {
  const funcs = await filterMenus(condition.uid);
  condition.func = (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL;
  condition.funcOptions = funcs;
  handleFuncChange(condition);
}

const handleFuncChange = async (condition) => {
  condition.fieldType = CurrentFieldWrapperOperator.FIELD;
  handleFieldTypeChange(condition)
}

const handleFieldTypeChange = async (condition) => {
  const type = await funcValue(condition.uid, condition.func);
  condition.comparisonUid = undefined;
  condition.comparisonOfForm = undefined;
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    condition.value = [];
  } else {
    condition.value = null;
  }
  if (condition.fieldType === CurrentFieldWrapperOperator.INPUT) {
    condition.slelectedElement = await getInstance(condition.uid);
    condition.slelectedElementTpye = await funcValue(condition.uid, condition.func);
  }
}

const onOpen = () => {
  const tableUIDs = currentFormConnection.value?.tables?.map(table => table.uid) || [];
  visibleTableUIDs.value = tableUIDs.filter(tableUID => (props.widget as FormElement).topForm.canReadLayerDataSync(tableUID));

  if (!isEmpty(props.value)) {
    filterRule.value = deepClone(props.value);
    // 初始化自定义值的框
    filterRule.value.conditions.forEach(async (condition) => {
      normalizeConditionValue(condition);
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

const handleConfirm = async () => {
  isSubmit.value = true;
  filterRule.value.conditions.forEach(condition => normalizeConditionValue(condition));
  await formRef.value.validate((valid) => {
    if (!valid) {
      ElMessage.warning(i18next.t("incompleteDataFilterConditions"));
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
    return configurations?.editFuncInfo || {};
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
.linkage-data-filter-dialog {
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

  :deep(.form-visibility-dialog) {
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
                right: 235px;
              }
            }

            .condition-item {
              display: flex;
              align-items: end;
              gap: 8px;
              width: 100%;

              .current-select {
                @include diy-select;
                width: 90px !important;
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

                .current-field-input {
                  border-radius: 4px;
                  background-color: var(--bg-color-overlay);
                  gap: 4px;
                  width: 230px;

                  &:hover {
                    background-color: var(--bg-color-hover);
                  }

                  .el-input__wrapper, .el-input-tag__wrapper {
                    width: 230px;
                    box-shadow: none;
                    border: none;
                    background: transparent;
                    font-size: 12px;
                    .el-input__inner {
                      font-size: 12px;
                    }

                    .el-input__inner::placeholder {
                      font-size: 12px;
                    }
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

                .rule-select {
                  @include diy-select;
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

.wraper-option-content {
  display: flex;
  align-items: center;
  column-gap: 4px;
}
</style>
<style lang="scss">
.data-filiter-rule-select-popper {
  --el-bg-color-overlay: var(--bg-color-page);
}
</style>

