<template>
  <div class="linkage-data-filter-dialog">
    <el-dialog class="form-visibility-dialog" :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)" :title="staticDescription.title" align-center width="680" destroy-on-close
      :close-on-click-modal="false" @open="onOpen" draggable>
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="filterRule" ref="formRef">
          <div class="container-tip-header">
            <p class="tip">
              {{ staticDescription.description }}:
              <el-tag :title="getLinkageTableName()">
                <el-text truncated>{{ getLinkageTableName() }}</el-text>
              </el-tag>
              <span v-if="staticDescription.showFiledDescription" style="color: #727272;">{{ $t('FormDataFilterDialog.of') }}<el-tag style="margin: 0 4px;">
                <el-text truncated>{{ getLinkageField().alias }}</el-text>
              </el-tag>{{ $t('FormDataFilterDialog.field') }}</span>
            </p>

            <el-button class="btn-delete-all-condition" link @click="handleDeleteAllCondition">
              <el-icon :zie="16">
                <i-ep-delete />
              </el-icon>
              {{ $t('FormDataFilterDialog.clear') }}
            </el-button>
          </div>

          <div class="condition-option">
            <div class="logic">
              <span>{{ $t('FormDataFilterDialog.if') }}{{ staticDescription.description }}{{ $t('FormDataFilterDialog.meetTheFoll') }}</span>
              <el-select
                class="logic-select"
                size="small"
                v-model="filterRule.logic"
                :suffix-icon="CaretBottom"
                :no-data-text="$t('FormDataFilterDialog.noData')"
              >
                <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <span>{{ $t('FormDataFilterDialog.condition') }}</span>
            </div>

            <el-button class="btn-add-condition" type="primary" link @click="handleAddCondition">
              <el-icon :size="16" style="margin-right: 4px;">
                <i-ep-plus />
              </el-icon>
              {{ $t('FormDataFilterDialog.addCondition') }}
            </el-button>
          </div>

          <ul class="condition-list">
            <li class="condition-title">
              <span class="linkage-field-title">{{ staticDescription.description }}</span>
              <!-- /自定义值 -->
              <span class="current-field-title">{{ $t('FormDataFilterDialog.currFormFieldOrCustom') }}</span>
            </li>
            <li class="condition-item" v-for="(condition, index) in filterRule.conditions">
              <div class="linkage-table-field-wrapper">
                <el-form-item :prop="`conditions.${index}.uid`" :rules="getConditionFormRules(condition, 'uid')">
                  <field-select
                    :modelValue="condition.uid"
                    :options="linkageTableFieldOptions"
                    @update:modelValue="(val) => condition.uid = val"
                    @change="handleSelectLinkageField(condition)"
                    filterable
                    :placeholder="$t('FormDataFilterDialog.plsSelectRelFormField')"
                    :no-data-text="$t('FormDataFilterDialog.noData')"
                    :show-arrow="false"
                    :offset="4"
                  />
                </el-form-item>
              </div>

              <div class="rule-select-wrapper">
                <el-select class="rule-select" v-model="condition.func" :suffix-icon="CaretBottom" :show-arrow="false" :offset="4" :no-data-text="$t('FormDataFilterDialog.noData')" :disabled="!condition.uid" popper-class="data-filiter-rule-select-popper" @change="handleFuncChange(condition)">
                  <el-option v-for="value, key in (conditionsAllOptions[index] ? conditionsAllOptions[index].funcOptions : {[RuleFunc.EQUAL]: RuleFuncTextMapping[RuleFunc.EQUAL]})" :key="key" :label="RuleFuncTextMapping[key]" :value="key" />
                </el-select>
              </div>

              <el-select class="current-select" v-if="isShowCurrentField(condition)" v-model="condition.type" :suffix-icon="CaretBottom" :no-data-text="$t('FormDataFilterDialog.noData')" :disabled="disabledCurrentFieldWrapper(condition)" @change="handleFieldTypeChange(condition)">
                <el-option v-for="item in currentFieldWrapperOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>

              <div class="current-field-wrapper">
                <el-form-item
                  :prop="`conditions.${index}.${getConditionValueType(condition) === FormConditionValueType.FORM ? 'comparisonUid' : 'value'}`"
                  :rules="getConditionFormRules(condition, getConditionValueType(condition) === FormConditionValueType.FORM ? 'comparisonUid' : 'value')"
                  v-if="isShowCurrentField(condition)"
                >
                  <field-select v-if="getConditionValueType(condition) === FormConditionValueType.FORM && isEmpty(curFormRelatedTables)" :modelValue="condition.comparisonUid" :fit-input-width="true" :isGroups="false" :options="tablesGroupOptions(linkageTableFieldOptions.find(option=> option.value === condition.uid)?.selfField)" @update:modelValue="(val) => handleComparisonChange(condition, linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField, val)"
                  filterable :placeholder="$t('FormDataFilterDialog.plsSelectCurrFormField')" :no-data-text="$t('FormDataFilterDialog.noData')" :no-match-text="$t('FormDataFilterDialog.noData')" :show-arrow="false" :offset="4" :disabled="!condition.uid || !condition.func"></field-select>
                  <field-tree-select
                    v-else-if="getConditionValueType(condition) === FormConditionValueType.FORM"
                    :modelValue="condition.comparisonUid"
                    :options="tablesGroupOptions(linkageTableFieldOptions.find(option=> option.value === condition.uid)?.selfField)"
                    @update:modelValue="(val) => handleComparisonChange(condition, linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField, val)"
                    filterable
                    :placeholder="$t('FormDataFilterDialog.plsSelectCurrFormField')"
                    :no-data-text="$t('FormDataFilterDialog.noData')"
                    :no-match-text="$t('FormDataFilterDialog.noData')"
                    :show-arrow="false"
                    :isGroups="currentSelectUseGroup"
                    :offset="4"
                    :disabled="!condition.uid || !condition.func"
                    :fit-input-width="true"
                  />
                  <el-input v-else-if="!condition.uid" class="current-field-input" disabled v-model="condition.value" :placeholder="$t('FormFilterValueFormat.plsInput')" />
                  <form-filter-value-format v-else class="current-field-input" v-model="condition.value" :element="conditionsAllOptions[index]?.selectedElement" :fieldId="condition.uid" :selectElementUid="linkageTableFieldOptions.find(option => option.value === condition.uid)?.selfField?.meta?.uid" :type="conditionsAllOptions[index]?.selectedElementTpye" :placeholder="$t('FormFilterValueFormat.plsInput')" :widget="props.widget" />
                </el-form-item>
              </div>

              <div :class="['delete']">
                <el-icon :size="16" @click="handleDeleteCondition(index)">
                  <i-ep-delete />
                </el-icon>
              </div>
            </li>
          </ul>
        </el-form>
      </el-scrollbar>

      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t('FormDataFilterDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('FormDataFilterDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, inject, reactive, ref } from 'vue';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { CaretBottom, Search } from "@element-plus/icons-vue";
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import FormFilterValueFormat from "./FormFilterValueFormat.vue"
import { FormConditionValueType, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { isSystemField, SystemField } from '@common/utils/connection';
import { isProcessTable } from '@common/utils/flow';
import { FormLinkageRule, LogicalOperator, SelectIdOfForm } from '@renderer/b2/types';
import { AbstractForm, FormElement, isSubForm } from '@renderer/b2/controllers/form';
import { Board } from '@renderer/b2/controllers/board';
import { getSystemColumnConfigurations } from './table/utils';
import { Connection, Field, Table } from '@common/types/project';
import { formElementInstances } from '@renderer/utils/instance';
import i18next from 'i18next';
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission';

type Option = {
  label: string;
  value: string;
  selfField: Field;
}

type FormFilterCondition = FormLinkageRule['conditions'][number] & {
  fieldType?: FormConditionValueType;
};

type SubFormFieldLike = {
  meta?: {
    extra?: {
      subTableUID?: string[];
    };
  };
};

const props = defineProps<{
  modelValue: boolean,
  widget: AbstractForm | FormElement;
  value: FormLinkageRule,
  onlyCustomValue?: boolean,
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: FormLinkageRule);
}>();
const nocode = inject(NOCODE, ref());
const organizeUtil = inject(ORGANIZE_UTIL, null);

const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t('FormDataFilterDialog.all') },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t('FormDataFilterDialog.any') },
  },
];

const currentFieldWrapperOptions = [
  {
    value: FormConditionValueType.FORM,
    get label() { return i18next.t('FormDataFilterDialog.field') },
  },
  {
    value: FormConditionValueType.CUSTOM,
    get label() { return i18next.t('FormDataFilterDialog.custom') },
  },
];

const onlyCustomValue = computed(() => Boolean(props.onlyCustomValue));
const filterCurrentLinkageSubFormFields = <T extends SubFormFieldLike>(subFields: T[], currentSubTableUID?: string) => {
  if (!currentSubTableUID) return [];
  return subFields.filter(field => field.meta?.extra?.subTableUID?.[1] === currentSubTableUID);
};

const disabledCurrentFieldWrapper = (condition) => {
  if (onlyCustomValue.value) {
    condition.type = FormConditionValueType.CUSTOM;
    return true;
  }
  const field = linkageTableFieldOptions.value.find(option => option.value === condition.uid)?.selfField;
  // 关联表单不允许选择自定义输入值
  if (field && field.meta?.extra?.widgetType === "widget.form.relatedData") {
    return true;
  } else if (condition.func === RuleFunc.BETWEEN || condition.func === RuleFunc.DYNAMIC || field?.meta?.name === SystemField.STATUS) {
    condition.type = FormConditionValueType.CUSTOM;
    return true;
  } else {
    return !condition.uid || !condition.func;
  }
}

const filterRule = ref<FormLinkageRule>({
  logic: LogicalOperator.AND,
  conditions: [],
})
const formRef = ref<FormInstance>();
const currentSelectUseGroup = computed(() => {
  if (props.widget.getOption("option-filter-use-group-option")) {
    return props.widget.getOption("option-filter-use-group-option");
  } else {
    return false;
  }
})

const isChangeOptions = ref(false)
const conditionsAllOptions = computed(() => {
  const conditionsAllOptions = ref([])
  if (filterRule.value.conditions.length === 0) {
    conditionsAllOptions.value['default-show'] = {
      funcOptions: [],
      selectedElement: null,
      selectedElementTpye: null,
    };
    return conditionsAllOptions;
  };
  isChangeOptions.value
  filterRule.value.conditions.forEach(async (condition, index) => {
    if (condition.uid) {
      const funcs = await filterMenus(condition.uid);
      const element = await getInstance(condition.uid);
      const elementTpye = await funcValue(condition.uid, condition.func);
      conditionsAllOptions.value[index] = {
        funcOptions: funcs,
        selectedElement: element,
        selectedElementTpye: elementTpye,
      };
    }
  })
  return conditionsAllOptions.value;
})

const isShowCurrentField = (conditionItem) => {
  if ([RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(conditionItem.func)) {
    conditionItem.value = ""
    return false
  } else {
    return true
  }
}
const formRules = reactive<FormRules<FormLinkageRule>>({
})
const notAllowSelectTypes = ["widget.form.selectData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const systemFieldNameOfFilter = [ SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER, SystemField.DATA_OWNER ]
const isSubmit = ref(false);
const currentFormElements = computed(() => {
  return (getForm().children as FormElement[]).filter((c) => {
    return !notAllowSelectTypes.includes(c.type);
  });
})

const multipleChoiceWidgetTypes = [
  "widget.form.checkboxGroup",
  "widget.form.treeMultipleSelect",
];

const isMultipleChoiceField = (field?: Field) => {
  return field?.type === "array"
    && multipleChoiceWidgetTypes.includes(field.meta?.extra?.widgetType);
}

const isComparableField = (field: Field, selfField: Field) => {
  if (field.type !== selfField.type) return false;

  // 多选控件的颜色样式会影响 subType，但不影响其数组值的筛选语义。
  if (isMultipleChoiceField(field) && isMultipleChoiceField(selfField)) return true;

  const equivalentGroups = ["text", "tag"];
  return field.meta?.subType === selfField.meta?.subType
    || (equivalentGroups.includes(field.meta?.subType) && equivalentGroups.includes(selfField.meta?.subType));
}

const currentTriggerFormElementOptions = (selfField) => {
  // const currentTriggerFormElements = currentFormElements.value.filter((c) => !isSubForm(c)).filter(c => c !== props.widget);
  if (!selfField) return []
  let table: Table;
  if (isSubForm(getForm())) {
    // 当前表单是子表单，则获取子表单所属的主表单的table
    const currentFormTableUID = (props.widget as FormElement).topForm.tableUID
    table = getForm().getBoard().getConnections().find(c => c.uid === currentFormTableUID[0]).tables.find(t => t.uid === currentFormTableUID[1]);
  } else {
    const currentFormTableUID = getForm().tableUID
    table = getForm().getBoard().getConnections().find(c => c.uid === currentFormTableUID[0]).tables.find(t => t.uid === currentFormTableUID[1]);
  }

  const { baseFields, subFields } = table.fields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
      if (isSystemField(f)) return prev;
      if (isSelect(props.widget)) {
        if (f.meta.subType === "subForm" && f.meta.uid === getForm().uid) {
          prev.subFields.push(f);
        } else {
          prev.baseFields.push(f);
        }
      } else {
        if (f.meta.subType === "subForm") {
          prev.subFields.push(f);
        } else {
          prev.baseFields.push(f);
        }
      }
      return prev;
    }, { baseFields: [], subFields: [] });
  const fields = table.fields?.filter(f => !isSystemField(f) && f.meta.subType !== "subForm" && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) || [];
  // 过滤出当前表单中和所选的关联表单字段相同类型的组件fields
  const tableOptions = fields
    .filter(f => {
      if(notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) return false
      if (!isComparableField(f, selfField)) return false;
      if (f.meta?.extra?.widgetType === "widget.form.relatedData") {
        return equals(f.meta?.extra?.relatedTableUID, selfField.meta?.extra?.relatedTableUID);
      }
      return true
    })
    .map(f => {
      return {
        label: f.alias,
        value: f.uid,
        selfField: f,
      }
    })

  const subOptions = subFields.map(f => {
    // 过滤出当前表单中和所选的关联表单字段相同类型的组件fields
    // 关联表单选用了子表字段，当前表单主表上的筛选就不能使用子表字段对比
    if (getForm() instanceof AbstractForm) {
      return [];
    }
    const subTable = getForm().getBoard().getConnections().find(c => c.uid === f.meta?.extra?.subTableUID[0]).tables.find(t => t.uid === f.meta?.extra?.subTableUID[1])
    return subTable?.fields?.filter(f => !isSystemField(f) && isComparableField(f, selfField))
      .filter(f => {
        if (f.meta?.extra?.widgetType === "widget.form.relatedData") {
          return equals(f.meta?.extra?.relatedTableUID, selfField.meta?.extra?.relatedTableUID) ? true : false;
        } else {
          return true;
        }
      })
      .map(sf => {
        return {
          label: `${f.alias}.${sf.alias}`,
          value: `${f.uid}.${sf.uid}`,
          selfField: sf,
        }
      }).filter(f => f !== undefined) ?? [];
  }).filter(Boolean)
  
  if (subOptions.length > 0) {
    let temp = subOptions.flat(Infinity) as Option[]
    return [...tableOptions, ...temp].filter(f => f.selfField?.meta?.uid !== props.widget?.uid);
  }
  return [...tableOptions].filter(f => f.selfField?.meta?.uid !== props.widget?.uid);
}

const curFormRelatedTables = computed(() => {
  const table = getlinkageTable();
  const mianTable = table.meta?.extra?.primaryTable ? getForm().getTable(table.meta?.extra?.primaryTable) : table;
  const currentFormRelatedFormElement = (props.widget as FormElement).topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData");
  const currentFormRelatedTables = currentFormRelatedFormElement.map((child: any) => {
    if (
      child.connectionTable
      && canReadNocodeTableDataByBody(nocode?.value?.body, child.connectionTable[1], organizeUtil?.departments || [])
      && child.connectionTable[1] !== (props.widget as FormElement).topForm.tableUID[1]
      && child.connectionTable[1] !== mianTable.uid
    ) {
      return {
        relatedTitle: child.title,
        connectionTable: (props.widget as FormElement).getTable(child.connectionTable)
      };
    }
  }).filter(t => t);
  return currentFormRelatedTables
})

const tablesGroupOptions = (selfField) => {
  // 不使用分组选项，就返回原来的options
  if (!currentSelectUseGroup.value) {
    return currentTriggerFormElementOptions(selfField);
  }

  const currentFormTableUID = isSubForm(getForm()) ? (props.widget as FormElement).topForm.tableUID : getForm().tableUID;
  const currentTable = getForm().getBoard().getConnections().find(c => c.uid === currentFormTableUID[0]).tables.find(t => t.uid === currentFormTableUID[1]);
  const options = [
    {
      label: i18next.t('FormDataFilterDialog.currFormField'),
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
    if (options.find(item => item.options[0].value === tableItemObj.connectionTable.uid)) continue;
    options.push({
      label: `[${tableItemObj.connectionTable.alias}]${i18next.t('FormDataFilterDialog.fieldRelForm')}`,
      value: SelectIdOfForm.LINKAGE,
      options: [
        {
          label: tableItemObj.connectionTable.alias,
          value: tableItemObj.connectionTable.uid,
          children: tableItemObj.connectionTable.fields.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType) && f.meta.subType !== "subForm")
            .filter(f => isComparableField(f, selfField))
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

const isSelect = (widget: any) => {
  return [
    "widget.form.treeSelect",
    "widget.form.treeMultipleSelect",
    "widget.form.autoCompute",
    "widget.form.numberInput",
    "widget.form.amountInput",
  ].includes(widget.type);
}

const getTargetOtherTableFieldValue = () => {
  return props.widget.getOption<string>("default-other-table-field")
    || props.widget.getOption<string>("other-table-field")
    || "";
}

const linkageTableFieldOptions = computed(() => {
  const optionValue = getTargetOtherTableFieldValue();
  const optionTableUID = optionValue.split(".")[1] || undefined;
  const connection = optionValue.split(".")[0] || undefined;
  if (optionTableUID) {
    const selectedConnection = getConnectionByUID(connection);
    const table = selectedConnection?.tables?.find(t => t.uid === optionTableUID);
    if (!table) return [];
    if (table.meta?.extra?.primaryTable && isSelect(props.widget)) { // 下拉填充使用子表单
      // 获取其主表单
      const mianTable = selectedConnection?.tables?.find(t => t.uid === table.meta?.extra?.primaryTable[1]);
      if (!mianTable) return [];
      const { baseFields, subFields } = mianTable.fields.reduce<{ baseFields, subFields }>((prev, f) => {
        if (isSystemField(f)) return prev;
        if (f.meta.subType === "subForm") {
          prev.subFields.push(f);
        } else {
          prev.baseFields.push(f);
        }
        return prev;
      }, { baseFields: [], subFields: [] });
      const fields = mianTable.fields?.filter(f => !isSystemField(f) && f.meta.subType !== "subForm" && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) || [];
      const tableOptions = fields.map(f => {
      return {
          label: f.alias,
          value: f.uid,
          selfField: f,
        }
      })
      const currentSubFields = filterCurrentLinkageSubFormFields(subFields, table.uid);
      const subOptions = currentSubFields.map((f: any) => {
        const subTable = selectedConnection?.tables?.find(t => t.uid === f.meta?.extra?.subTableUID[1]);
        return subTable?.fields?.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)).map(sf => {
          // 这里要和“选择他表字段”所属的子表保持一致，避免跨子表筛选
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
        isAllow = f.meta.name === SystemField.STATUS ? isProcessTable(selectedConnection?.formOptions?.[optionTableUID]) : false
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
      const table = props.widget.getTable(f.meta.extra?.subTableUID)
      return table.fields?.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)).map(sf => {
        // 下拉选择的关联表单的子表单字段也可以选择
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

const isForm = (widget: any) => {
  return widget instanceof AbstractForm;
}

const getForm = () => {
  if (isForm(props.widget)) {
    return props.widget;
  }
  return props.widget.form as AbstractForm;
}

const getConnectionByUID = (connectionUID?: string): Connection | undefined => {
  if (!connectionUID) return undefined;
  return getForm().getBoard().getConnections().find(c => c.uid === connectionUID);
}

const getlinkageTable = () => {
  const optionValue = getTargetOtherTableFieldValue();
  const connection = optionValue.split(".")[0] || undefined;
  const optionTableUID = optionValue.split(".")[1] || undefined;
  const table = getConnectionByUID(connection)?.tables?.find(t => t.uid === optionTableUID);
  return table;
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

const getLinkageField = () => {
  const optionTableUID = getTargetOtherTableFieldValue()?.split(".") || undefined;
  const table = getlinkageTable();
  const field = table?.fields.find(f => f.uid === optionTableUID[2]);
  return field;
}

const handleAddCondition = () => {
  filterRule.value.conditions.push({
    uid: null,
    func: RuleFunc.EQUAL,
    value: null,
    type: onlyCustomValue.value ? FormConditionValueType.CUSTOM : FormConditionValueType.FORM,
    fieldType: onlyCustomValue.value ? FormConditionValueType.CUSTOM : FormConditionValueType.FORM,
  })
}

const handleDeleteCondition = (index: number) => {
  filterRule.value.conditions.splice(index, 1);
}

const handleDeleteAllCondition = () => {
  filterRule.value.conditions = []
}

const noValueRequiredFuncs = [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE];

const hasCompleteValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(item => hasCompleteValue(item));
  }
  return value !== null && value !== undefined && value !== '';
}

const getConditionValueType = (condition: FormFilterCondition) => {
  return condition.type ?? condition.fieldType ?? FormConditionValueType.FORM;
}

const syncConditionValueType = (condition: FormFilterCondition) => {
  condition.type = getConditionValueType(condition);
  condition.fieldType = condition.type;
}

const getConditionComparisonUid = (condition: FormFilterCondition) => {
  if (hasCompleteValue(condition.comparisonUid)) {
    return condition.comparisonUid;
  }

  return typeof condition.value === "string" && hasCompleteValue(condition.value)
    ? condition.value
    : undefined;
}

const syncConditionComparisonUid = (condition: FormFilterCondition) => {
  if (getConditionValueType(condition) !== FormConditionValueType.FORM) {
    return;
  }

  const comparisonUid = getConditionComparisonUid(condition);
  condition.comparisonUid = comparisonUid;
}

const normalizeConditionValue = (condition: FormFilterCondition) => {
  if (noValueRequiredFuncs.includes(condition.func)) {
    condition.value = "";
    return;
  }

  if (getConditionValueType(condition) === FormConditionValueType.FORM) {
    const comparisonUid = getConditionComparisonUid(condition);
    syncConditionValueType(condition);
    condition.comparisonUid = comparisonUid;
    condition.value = comparisonUid ?? null;
  }
}

const applyOnlyCustomValue = (condition: FormFilterCondition) => {
  if (!onlyCustomValue.value) return;
  const previousType = getConditionValueType(condition);
  condition.type = FormConditionValueType.CUSTOM;
  condition.fieldType = FormConditionValueType.CUSTOM;
  condition.comparisonUid = undefined;
  condition.comparisonOfForm = undefined;
  if (previousType === FormConditionValueType.FORM) {
    condition.value = null;
  }
}

const isConditionComplete = (condition: FormFilterCondition) => {
  if (!hasCompleteValue(condition.uid) || !hasCompleteValue(condition.func)) {
    return false;
  }

  if (noValueRequiredFuncs.includes(condition.func)) {
    return true;
  }

  if (getConditionValueType(condition) === FormConditionValueType.FORM) {
    return hasCompleteValue(getConditionComparisonUid(condition));
  }

  return hasCompleteValue(condition.value);
}

const getConditionFormRules = <T extends FormFilterCondition>(condition: T, key: keyof T) => {
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!isSubmit.value) return callback();
        if (key === "value") {
          normalizeConditionValue(condition);
          if (!isConditionComplete(condition)) return callback(new Error(''));
          return callback();
        }
        if (key === "comparisonUid") {
          syncConditionComparisonUid(condition);
          if (!hasCompleteValue(condition.comparisonUid)) return callback(new Error(''));
          return callback();
        }
        if (!hasCompleteValue(condition[key])) return callback(new Error(''));
        callback();
      }
    }
  ]
}

const getComparisonOfForm = (selfField, comparisonUid?: string): SelectIdOfForm | undefined => {
  if (!currentSelectUseGroup.value || !comparisonUid) {
    return undefined;
  }

  const comparisonOptions = tablesGroupOptions(selfField) as any[];
  const matchedCurrentField = comparisonOptions.find(option => option?.value === comparisonUid);
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

const handleComparisonChange = (condition: FormFilterCondition, selfField, comparisonUid = condition.comparisonUid) => {
  condition.comparisonUid = comparisonUid;
  condition.comparisonOfForm = getComparisonOfForm(selfField, comparisonUid);
  condition.value = comparisonUid ?? null;
}

const handleSelectLinkageField = async (condition) => {
  const funcs = await filterMenus(condition.uid);
  condition.func = (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL;
  handleFuncChange(condition);
}

const handleFuncChange = async (condition) => {
  condition.type = onlyCustomValue.value ? FormConditionValueType.CUSTOM : FormConditionValueType.FORM;
  condition.fieldType = condition.type;
  handleFieldTypeChange(condition)
}

const handleFieldTypeChange = async (condition) => {
  syncConditionValueType(condition);
  condition.fieldType = condition.type;
  const type = await funcValue(condition.uid, condition.func);
  condition.comparisonUid = undefined;
  condition.comparisonOfForm = undefined;
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    condition.value = [];
  } else {
    condition.value = null;
  }
  isChangeOptions.value = !isChangeOptions.value;
}

const staticDescription = ref({
  get title() { return i18next.t('FormDataFilterDialog.filterCondition') },
  description: '',
  showFiledDescription: false,
})

const onOpen = () => {
  if (!isEmpty(props.value)) {
    filterRule.value = deepClone(props.value);
    filterRule.value.conditions.forEach(condition => {
      syncConditionValueType(condition);
      syncConditionComparisonUid(condition);
      applyOnlyCustomValue(condition);
      normalizeConditionValue(condition);
    });
  } else {
    filterRule.value = {
      logic: LogicalOperator.AND,
      conditions: [],
    }
  }

  if (filterRule.value.conditions.length === 0) handleAddCondition();

  if (props.widget) {
    switch (props.widget.getSoul().type) {
      case "widget.form.treeSelect": staticDescription.value = {
          title: i18next.t('FormDataFilterDialog.optFilter'),
          description: i18next.t('FormDataFilterDialog.optRelField'),
          showFiledDescription: true,
        };
        break;
      case "widget.form.treeMultipleSelect": staticDescription.value = {
          title: i18next.t('FormDataFilterDialog.optFilter'),
          description: i18next.t('FormDataFilterDialog.optRelField'),
          showFiledDescription: true,
        };
        break;
      default: staticDescription.value = {
        title: i18next.t('FormDataFilterDialog.filterCondition'),
        description: i18next.t('FormDataFilterDialog.filterField'),
        showFiledDescription: false,
        }; break;
    }
  }
}

const handleConfirm = async () => {
  isSubmit.value = true;
  filterRule.value.conditions.forEach(condition => normalizeConditionValue(condition));
  await formRef.value.validate((valid) => {
    if (!valid) {
      ElMessage.warning(i18next.t('FormDataFilterDialog.plsSetFullFilterCond'));
      return;
    }

    emit("update", deepClone(filterRule.value));
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
