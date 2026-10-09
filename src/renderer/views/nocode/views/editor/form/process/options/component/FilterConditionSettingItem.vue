<template>
  <div class="filter-condition-setting-item">
    <div class="header">
      <div>
        <span style="color: #f56c6c; font-size: 16px;" v-if="props.isRequired">
          *
        </span>
        {{ filterTitle }}
      </div>
      <el-select
        v-if="props.filterRule"
        v-model="props.filterRule.logic"
        :disabled="props.disableConditionSetting || props.disableLogicSelect"
      >
        <el-option
          v-for="value in LogicalOperator"
          :value="value"
          :label="value === LogicalOperator.AND ? $t('FilterConditionSettingItem.all') : $t('FilterConditionSettingItem.any')"
        />
      </el-select>
      <div>
        {{ $t('FilterConditionSettingItem.conditionData') }}
      </div>
      <div
        v-if="props.tableUID"
        :class="['add-button', { disabled: props.disableAddCondition }]"
        @click="addCondition"
      >
        <el-icon>
          <i-ep-plus/>
        </el-icon>
        <span>{{ $t('FilterConditionSettingItem.addCondition') }}</span>
      </div>
    </div>
    <div class="body">
      <div class="title">
        <div class="target-title">{{ targetTitle }}</div>
        <div class="current-field-title">{{ props.currentFieldTitle }}</div>
      </div>
      <el-form
        class="condition-item"
        v-for="(condition, index) in props.filterRule?.conditions"
        :key="getConditionKey(condition, index)"
        :model="condition"
        :rules="rules"
        :disabled="props.disableConditionSetting"
        ref="formRef"
      >
        <div class="select-container">
          <el-form-item class="data-field-item" prop="uid" :rules="getUidRules(condition)">
            <field-select
              v-if="props.useFieldSelect"
              class="data-field"
              :modelValue="condition.uid"
              :options="getDataFieldSelectOptions(condition)"
              @update:modelValue="(val) => condition.uid = val"
              @change="getConfiguration(condition)"
              :disabled="props.disableConditionSetting"
              :placeholder="$t('FilterConditionSettingItem.selectField')"
              :no-data-text="$t('FilterConditionSettingItem.noField')"
              :no-match-text="$t('FilterConditionSettingItem.noField')"
            />
            <el-select
              v-else
              class="data-field"
              :placeholder="$t('FilterConditionSettingItem.selectField')"
              v-model="condition.uid"
              @change="getConfiguration(condition)"
              :disabled="props.disableConditionSetting"
              :no-data-text="$t('FilterConditionSettingItem.noField')"
            >
              <el-option
                v-for="field in getDataFieldOptions(condition)"
                :label="field.alias"
                :value="field.uid"
              />
              <template #label="{ label, value }">
                <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('FilterConditionSettingItem.fieldDeleted') }}</span>
                <span v-else>{{ label }}</span>
              </template>
            </el-select>
          </el-form-item>
          <el-select
            class="func"
            :placeholder="$t('FilterConditionSettingItem.selectContent')"
            @change="changeFunc(condition)"
            v-model="condition.func"
            :disabled="props.disableConditionSetting || !condition.uid"
          >
            <el-option
              v-for="([key, value], index) in Object.entries(conditionFuncInfoMap.get(condition.uid) || {})"
              :key="key"
              :label="RuleFuncTextMapping[key]"
              :value="key"
            />
          </el-select>
        </div>
        <div class="select-container select-value-container" v-if="![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func)">
          <el-select
            class="current-field"
            v-model="condition.type"
            @change="changeFunc(condition)"
            :disabled="props.disableConditionSetting || !condition.uid || !condition.func || (condition.func === RuleFunc.DYNAMIC)"
          >
            <el-option
              :value="FormConditionValueType.CUSTOM"
              :label="($t('FilterConditionSettingItem.customValue') as string)"
            />
            <el-option
              v-if="props.allowCurrentFormField"
              :value="FormConditionValueType.FORM"
              :label="props.formFieldTypeLabel"
            />
            <el-option
              :value="FormConditionValueType.FORMULA"
              :label="($t('FilterConditionSettingItem.formulaEdit') as string)"
              v-if="props.allowFormulaValue && isAllowFormula(condition)"
            />
          </el-select>
          <el-form-item
            v-if="condition.type === FormConditionValueType.FORM"
            prop="value"
            style="flex: 1;"
            :rules="getFormValueRules(condition)"
          >
            <field-select
              v-if="props.useFieldSelect"
              class="value"
              :modelValue="condition.value"
              :options="getCurrentFieldSelectOptions(condition)"
              @update:modelValue="(val) => condition.value = val"
              :placeholder="$t('FilterConditionSettingItem.selectField')"
              :disabled="props.disableConditionSetting || !condition.uid || !condition.func"
              :no-data-text="$t('FilterConditionSettingItem.noField')"
              :no-match-text="$t('FilterConditionSettingItem.noField')"
            />
            <el-select
              v-else
              class="value"
              v-model="condition.value"
              :placeholder="$t('FilterConditionSettingItem.selectField')"
              :disabled="props.disableConditionSetting || !condition.uid || !condition.func"
              :no-data-text="$t('FilterConditionSettingItem.noField')"
            >
              <el-option
                v-for="field in getCurrentFieldOptions(condition)"
                :label="field.alias"
                :value="field.uid"
              />
            </el-select>
          </el-form-item>
          <div class="formula-value" v-else-if="condition.type === FormConditionValueType.FORMULA">
            <el-form-item prop="value" :rules="formulaRules">
              <el-button
                :class="['formula-button', condition.value ? 'has-formula' : '']"
                @click="handleEditFormula(condition, index)"
                :disabled="props.disableConditionSetting"
                :style="{color: condition.value ? 'var(--color-primary)' : 'var(--text-color-regular)'}"
              >
                {{ condition.value ? $t('FilterConditionSettingItem.formulaSet') : $t('FilterConditionSettingItem.setFormula') }}
              </el-button>
            </el-form-item>
          </div>
          <div v-else class="value-input">
            <el-form-item prop="value" v-if="getFuncValue(condition)?.subType === 'account'">
              <el-button
                :class="{'active': condition.value?.length}"
                @click="openSelectDialog('member', condition.value, index, condition)"
                :disabled="props.disableConditionSetting"
              >
                {{ condition.value?.length ? $t('FilterConditionSettingItem.memberSelected') : $t('FilterConditionSettingItem.selectMember') }}
              </el-button>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.subType === 'department'">
              <el-button
                :class="{'active': condition.value?.length}"
                @click="openSelectDialog('department', condition.value, index, condition)"
                :disabled="props.disableConditionSetting"
              >
                {{ condition.value?.length ? $t('FilterConditionSettingItem.deptSelected') : $t('FilterConditionSettingItem.selectDept') }}
              </el-button>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.RANGE">
              <div class="number-range" v-if="getFuncValue(condition)?.subType === 'number' && condition?.value?.length === 2">
                <el-input v-model="condition.value[0]" type="number" :placeholder="$t('FilterConditionSettingItem.minValue')" />
                <span> ~ </span>
                <el-input v-model="condition.value[1]" type="number" :placeholder="$t('FilterConditionSettingItem.maxValue')" />
              </div>
              <el-config-provider
                :locale="elementPlusLocale"
                v-else-if="getFuncValue(condition)?.subType === 'date'"
              >
                <el-date-picker
                  class="date-range"
                  :value-format="'YYYY-MM-DD HH:mm:ss'"
                  :format="$t('FilterConditionSettingItem.dateFormat')"
                  range-separator="~"
                  v-model="condition.value"
                  type="daterange"
                />
              </el-config-provider>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.DATE">
              <el-config-provider :locale="elementPlusLocale">
                <el-date-picker
                  class="date-range"
                  :value-format="'YYYY-MM-DD HH:mm:ss'"
                  :format="$t('FilterConditionSettingItem.dateFormat')"
                  v-model="condition.value"
                  type="date"
                />
              </el-config-provider>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.SELECT">
              <!-- <el-select-v2
                v-model="condition.value"
                clearable
                filterable
                :options="selectOptions(condition)"
                placeholder="请选择"
              /> -->
              <el-input
                v-model="condition.value"
                :placeholder="$t('FilterConditionSettingItem.inputContent')"
                clearable
              />
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.SELECT_MULTIPLE">
              <!-- <el-select-v2
                v-model="condition.value"
                :collapse-tags="true"
                clearable
                filterable
                multiple
                :options="selectOptions(condition)"
                placeholder="请选择"
              /> -->
              <el-input-tag v-model="condition.value" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :placeholder="$t('FilterConditionSettingItem.tagInputContent')"></el-input-tag>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.TAGS">
              <el-input-tag v-model="condition.value" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :placeholder="$t('FilterConditionSettingItem.tagInputContent')"></el-input-tag>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.ADDRESS">
              <el-tree-select
                :placeholder="$t('FilterConditionSettingItem.selectContent')"
                class="drop-down"
                ref="addressRef"
                v-model="condition.value"
                lazy
                :load="loadNode"
                node-key="value"
                :render-after-expand="false"
                clearable filterable check-strictly
                :highlight-current="true" :show-path="true" :empty-text="$t('FilterConditionSettingItem.noData')" :props="{
                  label: 'label',
                  value: 'value',
                  children: 'children',
                  isLeaf: 'isLeaf',
                }">
              </el-tree-select>
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.NUMBER">
              <el-input
                v-model="condition.value"
                :placeholder="$t('FilterConditionSettingItem.inputContent')"
                type="number"
              />
            </el-form-item>
            <el-form-item prop="value" v-else-if="getFuncValue(condition)?.subType === 'date' && getFuncValue(condition)?.type === RuleFuncValue.STRING">
              <date-dynamic-filter-value-select
                :class="['dynamic-filter-select', { disabled: props.disableConditionSetting }]"
                v-model="condition.value"
                :append-to="'body'"
                :teleported="true"
              />
            </el-form-item>
            <el-form-item prop="value" v-else>
              <el-input
                v-model="condition.value"
                :placeholder="$t('FilterConditionSettingItem.inputContent')"
                clearable
              />
            </el-form-item>
          </div>

        </div>
        <div
          v-if="!props.disableConditionSetting && (!props.isRequired || props.filterRule?.conditions?.length > 1)"
          class="condition-action"
        >
          <el-icon @click="deleteCondition(index)" class="delete">
            <i-ep-delete/>
          </el-icon>
        </div>
      </el-form>
      <source-table-formula-dialog
        v-model="formulaVisible"
        @update="handleUpdate"
        :value="tempCondition?.value"
        :defaultTables="[]"
        :tables="[]"
        :otherTableLabel="''"
        :hiddenCurrentTable="true"
        :supportTableFields="false"
        :supportCategories="[FormulaCategory.DATE]"
        />
        <organize-manager-dialog
          ref="organizeManageDialogRef"
          :isInWidget="false"
          :multiple="organizeIsMultiple"
          :currentType="currentType"
          :dialogTitle="currentType === 'department' ? $t('FilterConditionSettingItem.chooseDept') : $t('FilterConditionSettingItem.chooseMember')"
          :tableList="tableList"
          @confirm="closeSelectDialog"
        />
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  LogicalOperator,
  FilterRule,
  FormConditionValueType,
  FormWidgetType,
  RuleFunc,
  RuleFuncValue,
  RuleFuncTextMapping,
  FormCondition
} from '@common/types/nocode'
import { useFormFields } from '../../../hooks';
import { FormulaCategory, isSystemField } from '@common/utils';
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { getChinaAddressData } from "@renderer/utils/township";
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { Field, TableUID } from '@common/types/project';
import { FieldSelectOption } from '@renderer/b2/types';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale'
import { isEmpty } from "@common/utils/object";
import { unique } from '@common/utils/unique';
import { formElementInstances } from '@renderer/utils/instance';
import i18next from 'i18next';
import { ElMessage } from 'element-plus';

const props = withDefaults(defineProps<{
  filterRule: FilterRule,
  tableUID: TableUID,
  currentFields?: Field[] | null,
  isRequired?: boolean,
  isShowSubField?: boolean,
  targetTitle?: string,
  currentFieldTitle?: string,
  formFieldTypeLabel?: string,
  filterTitle?: string,
  disableAddCondition?: boolean,
  disableConditionSetting?: boolean,
  disableLogicSelect?: boolean,
  hideAutoComputeField?: boolean,
  allowCurrentFormField?: boolean,
  allowFormulaValue?: boolean,
  useFieldSelect?: boolean,
  validateDeletedField?: boolean,
}>(), {
  currentFields: null,
  isRequired: false,
  isShowSubField: true,
  targetTitle: () => i18next.t('FilterConditionSettingItem.dataSourceFormField'),
  currentFieldTitle: () => i18next.t('FilterConditionSettingItem.currentFormFieldOrCustom'),
  formFieldTypeLabel: () => i18next.t('FilterConditionSettingItem.field'),
  filterTitle: () => i18next.t('FilterConditionSettingItem.filterTargetFormCondition'),
  disableAddCondition: false,
  disableConditionSetting: false,
  disableLogicSelect: false,
  hideAutoComputeField: false,
  allowCurrentFormField: true,
  allowFormulaValue: true,
  useFieldSelect: false,
  validateDeletedField: false,
})

const rules = {
  uid: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t('FilterConditionSettingItem.selectDataSourceFormField')))
        }
        callback()
      },
    }
  ],
  value: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t('FilterConditionSettingItem.fillFieldOrCustomValue')))
        }
        callback()
      },
    }
  ],
}

const getUidRules = (condition: FormCondition) => {
  return [
    ...rules.uid,
    {
      validator: (rule, value, callback) => {
        if (!props.validateDeletedField || isEmpty(value) || !value) {
          callback()
          return
        }
        const exists = getDataFieldSelectOptions(condition).some(item => item.value === value)
        if (!exists) {
          callback(new Error(i18next.t('FilterConditionSettingItem.fieldDeleted')))
          return
        }
        callback()
      },
    },
  ]
}

const getFormValueRules = (condition: FormCondition) => {
  return [
    ...rules.value,
    {
      validator: (rule, value, callback) => {
        if (
          !props.validateDeletedField
          || condition.type !== FormConditionValueType.FORM
          || isEmpty(value)
          || !value
        ) {
          callback()
          return
        }
        const exists = getCurrentFieldSelectOptions(condition).some(item => item.value === value)
        if (!exists) {
          callback(new Error(i18next.t('FilterConditionSettingItem.fieldDeleted')))
          return
        }
        callback()
      },
    },
  ]
}

const formulaRules = [
  {
    validator: (rule, value, callback) => {
      if(isEmpty(value) || !value) {
        return callback(new Error(i18next.t('FilterConditionSettingItem.configFormula')))
      }
      callback()
    },
  }
]

const organizeManageDialogRef = ref()
const tableList = ref({
  departments: [],
  roles: [],
  users: [],
  dynamic: [],
})

const currentType = ref()
const currentIndex = ref()
const organizeIsMultiple = ref(false);

const resolveUsersByIds = (userIds = []) => {
  return (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map(userId => organizeUtil?.findUserById(userId))
    .filter(Boolean)
}

const openSelectDialog = (type, value, conditionIndex, condition) => {
  if (props.disableConditionSetting) {
    return;
  }
  currentType.value = type;
  currentIndex.value = conditionIndex;
  const field = formFields.value.find(field => field.uid === condition.uid)
  if (field.meta?.extra?.isMultiple) {
    organizeIsMultiple.value = true;
  } else {
    organizeIsMultiple.value = false;
  }
  
  tableList.value = {
    departments: [],
    roles: [],
    users: [],
    dynamic: [],
  }
  if(!Array.isArray(value)) {
    value = [value].filter(Boolean)
  }
  if(type === 'department') {
    tableList.value.departments = value.map(item => organizeUtil.departments.find(user => user.id === item)).filter(Boolean) || []
  } else if(type === 'member') {
    tableList.value.users = resolveUsersByIds(value)
  }
  organizeManageDialogRef.value.show()
}

const closeSelectDialog = (value) => {
  if (props.disableConditionSetting) {
    return;
  }
  const condition = props.filterRule.conditions[currentIndex.value]

  if (currentType.value === "department") {
    condition.value = value.departments?.map(item => item.id) || []
  } else {
    condition.value = value.users?.map(item => item.id) || []
  }
}

const injectedFormFields = useFormFields();
const nocode = inject(NOCODE)
const conditionFuncInfoMap = reactive(new Map())
const organizeUtil = inject(ORGANIZE_UTIL)
const formRef = ref(null)
const conditionKeyMap = new WeakMap<FormCondition, string>()

const addCondition = () => {
  if (props.disableAddCondition) {
    return;
  }
  props.filterRule?.conditions.push({
    uid: null,
    func: null,
    value: null,
    type: FormConditionValueType.FORM,
  })
}

const getConditionKey = (condition: FormCondition, index: number) => {
  if (!condition || typeof condition !== "object") {
    return `condition_${index}`;
  }
  if (!conditionKeyMap.has(condition)) {
    conditionKeyMap.set(condition, `condition_${unique(8)}`);
  }
  return conditionKeyMap.get(condition) || `condition_${index}`;
}

const deleteCondition = (index) => {
  if (props.disableConditionSetting) {
    return;
  }
  props.filterRule?.conditions.splice(index, 1)
}

const getFuncInfoByType = async (type) => {
  return await (await formElementInstances.getInstance(type)).getConfigurations().funcInfo
}

const formulaVisible = ref(false);
const tempCondition = ref<FormCondition>();
const handleEditFormula = (condition: FormCondition, index: number) => {
  if (props.disableConditionSetting) {
    return;
  }
  tempCondition.value = condition;
  formulaVisible.value = true;
}

const handleUpdate = (value: string) => {
  if (!tempCondition.value) return;
  tempCondition.value.value = value;
}

const initConditionFuncInfoMap = async (formFields) => {
  for (const field of formFields) {
    if (isSystemField(field)) continue
    const funcInfo = await getFuncInfoByType(field.meta?.extra?.widgetType)
    conditionFuncInfoMap.set(field.uid, funcInfo)
  }
}

const isAllowFormula = (condition: FormCondition) => {
  return getFuncValue(condition)?.subType === "date";
}

const getFuncValue = (condition: FormCondition) => {
  const field = formFields.value.find(field => field.uid === condition.uid)
  if(!field) return
  // 使用condition.uid作为键
  const func = conditionFuncInfoMap.get(condition.uid)?.[condition.func]
  return {
    type: func,
    subType: field?.meta.subType,
  }
}

const getConfiguration = (condition: FormCondition) => {
  if (!condition.uid) return;
  const field = formFields.value.find(field => field.uid === condition.uid);
  const type = field?.meta?.extra?.widgetType;
  const subType = field?.meta?.subType;
  formElementInstances.getInstance(type).then(widget => {
    return widget.getConfigurations()
  }).then(config => {
    conditionFuncInfoMap.set(condition.uid, config.funcInfo)

    // 默认选第一个 func
    condition.func = (Object.keys(config.funcInfo)[0] || null) as RuleFunc

    // 根据 func 类型设置 value
    if (getFuncValue(condition)?.type === RuleFuncValue.RANGE && getFuncValue(condition)?.subType === 'number') {
      condition.value = [0, 0]
    } else {
      condition.value = null
    }
  })
  if ((subType !== "date") && (condition.type === FormConditionValueType.FORMULA)) {
    condition.type = FormConditionValueType.CUSTOM
  }
  if (!props.allowFormulaValue && condition.type === FormConditionValueType.FORMULA) {
    condition.type = FormConditionValueType.CUSTOM
  }
  if (!props.allowCurrentFormField && condition.type === FormConditionValueType.FORM) {
    condition.type = FormConditionValueType.CUSTOM
  }
}

const changeFunc = (condition) => {
  const type = formFields.value.find(field => field.uid === condition.uid)?.meta.extra.widgetType

  formElementInstances.getInstance(type).then(widget => {
    return widget.getConfigurations()
  }).then(config => {
    conditionFuncInfoMap.set(condition.uid, config.funcInfo)
    if (condition.func === RuleFunc.DYNAMIC) {
      condition.type = FormConditionValueType.CUSTOM;
    }
    if (!props.allowFormulaValue && condition.type === FormConditionValueType.FORMULA) {
      condition.type = FormConditionValueType.CUSTOM
    }
    if (!props.allowCurrentFormField && condition.type === FormConditionValueType.FORM) {
      condition.type = FormConditionValueType.CUSTOM
    }

    if (getFuncValue(condition)?.type === RuleFuncValue.RANGE && getFuncValue(condition)?.subType === 'number' && condition.type === FormConditionValueType.CUSTOM) {
      condition.value = [null, null]
    } else {
      condition.value = null
    }
  })
}

const getFieldOption = (fields: Field[]) => {
  const result = []
  if(!fields || !Array.isArray(fields)) return result
  for(const field of fields) {
    if(isSystemField(field)) continue
    if(field.meta?.extra?.widgetType == 'widget.form.dateRangePicker') continue
    if(field.meta?.extra?.relatedTableUID) continue

    if(field.meta?.extra?.widgetType === 'widget.form.subform') {
      if(!props.isShowSubField) continue
      const subformFields = (field.subTableFields || []).filter(item => {
        return !isSystemField(item) && item.meta?.extra?.widgetType !== 'widget.form.dateRangePicker' && !item.meta?.extra?.relatedTableUID
      }).map(item => {
        return {...item, uid: `${field.uid}.${item.uid}`, alias: `${field.alias}.${item.alias}`}
      })
      if(!subformFields.length) continue
      result.push(...subformFields)
      continue
    }
    result.push(field)
  }
  return result
}

const isAutoComputeField = (field?: Field) => {
  return field?.meta?.extra?.widgetType === FormWidgetType.AUTO_COMPUTE
}

const getDataFieldOptions = (condition?: FormCondition) => {
  return formFields.value.filter(field => {
    if (!props.hideAutoComputeField || !isAutoComputeField(field)) {
      return true
    }
    return field.uid === condition?.uid
  })
}

const getDataFieldSelectOptions = (condition?: FormCondition): FieldSelectOption[] => {
  return getDataFieldOptions(condition).map(field => ({
    label: field.alias,
    value: field.uid,
  }))
}

const getCurrentFieldOptions = (condition?: FormCondition) => {
  return currentFormFields.value.filter(field => {
    if (!props.hideAutoComputeField || !isAutoComputeField(field)) {
      return true
    }
    return field.uid === condition?.value
  })
}

const getCurrentFieldSelectOptions = (condition?: FormCondition): FieldSelectOption[] => {
  return getCurrentFieldOptions(condition).map(field => ({
    label: field.alias,
    value: field.uid,
  }))
}

const hasDeletedFieldCondition = () => {
  if (!props.validateDeletedField) {
    return false
  }
  return (props.filterRule?.conditions || []).some((condition) => {
    if (condition?.uid && !getDataFieldSelectOptions(condition).some(item => item.value === condition.uid)) {
      return true
    }
    if (
      condition?.type === FormConditionValueType.FORM
      && condition?.value
      && !getCurrentFieldSelectOptions(condition).some(item => item.value === condition.value)
    ) {
      return true
    }
    return false
  })
}

const dataSourceTable = computed(() => {
  return getNocodeDataSourceTableByUID(nocode.value?.body, props.tableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)
})

const formFields = computed(() => {
  const table = dataSourceTable.value?.table
  if(!table) {
    return []
  }
  const fields = table.fields
  return getFieldOption(fields)
})

const currentFormFields = computed(() => {
  if (Array.isArray(props.currentFields)) {
    return getFieldOption(props.currentFields)
  }
  const injectedFields = injectedFormFields?.value
  return getFieldOption(Array.isArray(injectedFields) ? injectedFields : [])
})

const selectOptions = computed(() => {
  return (condition) => {
    if(getFuncValue(condition)?.subType === 'account') {
      return organizeUtil.users.map(item => ({
        label: item.realname,
        value: item.id,
      }))
    } else if(getFuncValue(condition)?.subType === 'department') {
      return organizeUtil.departments.map(item => ({
        label: item.name,
        value: item.id,
      }))
    } else {
      const field = formFields.value.find(field => field.uid === condition.uid)
      return field.meta.extra?.choices || []
    }
  }
});

const loadNode = async (node, resolve: (data) => void) => {
  const chinaAddressData = await getChinaAddressData();
  if (!node?.label) {
    resolve(chinaAddressData.map(({ children, ...rest }) => ({
      ...rest,
      isLeaf: !children || children.length === 0
    })));
  } else if (node.data?.value) {
    const match = findNodeByValue(chinaAddressData, node.data.value);

    if (match && match.children) {
      resolve(match.children.map(({ children, ...rest }) => ({
        ...rest,
        isLeaf: !children || children.length === 0
      })));
    } else {
      resolve([]);
    }
  } else {
    resolve([]);
  }
};

const findNodeByValue = (data, value) => {
  for (const node of data) {
    if (node.value === value) {
      return node;
    }
    if (node.children) {
      const found = findNodeByValue(node.children, value);
      if (found) return found;
    }
  }
  return null;
};

watch(() => props.tableUID, async () => {
  await initConditionFuncInfoMap(formFields.value)
},{ deep: true })

onMounted(async () => {
  await initConditionFuncInfoMap(formFields.value)
})

const validate = async () => {
  if (props.disableConditionSetting) {
    return true
  }
  if (hasDeletedFieldCondition()) {
    ElMessage.warning(i18next.t('FilterConditionSettingItem.fieldDeleted'))
    return false
  }
  if(!formRef.value) {
    return true
  }
  if (Array.isArray(formRef.value)) {
    // 多个子表单逐个校验
    const results = await Promise.all(
      formRef.value.map(form =>
        new Promise((resolve) => {
          form.validate((valid) => resolve(valid))
        })
      )
    )
    return results.every(Boolean)
  } else {
    // 单个表单
    return new Promise((resolve) => {
      formRef.value.validate((valid) => resolve(valid))
    })
  }
}
defineExpose({
  validate,
})
</script>

<style scoped lang="scss">
.filter-condition-setting-item {
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;

  .header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;

    :deep(.el-select) {
      width: 56px;
      height: 24px;

      .el-select__wrapper {
        min-height: 24px;
        box-shadow: none;
        background-color: var(--bg-color-overlay);
        padding: 4px 4px 4px 8px;
        border-radius: 4px;
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%;
        gap: 6px;
      }
    }

    .add-button {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-left: auto;
      cursor: pointer;
      color: var(--color-primary);

      &.disabled {
        cursor: not-allowed;
        color: var(--text-color-secondary);
        opacity: 0.7;
      }

      .el-icon {
        font-size: 16px;
        margin-right: 3px;
      }
    }
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 13px;

    .title {
      display: flex;
      justify-content: space-between;
      gap: 8px;

      .target-title {
        width: 272px;
      }

      .current-field-title {
        flex: 1;
      }
    }

    .condition-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      min-width: 0;

      .select-container {
        width: fit-content;
        display: flex;
        gap: 8px;
        align-items: center;
        min-width: 0;

        .data-field-item {
          width: 160px;
        }
        :deep(.data-field) {
          .el-select__wrapper {
            box-shadow: none;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
            padding: 8px;
          }
        }

        :deep(.func) {
          width: 104px;

          .el-select__wrapper {
            box-shadow: none;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
          }
        }

        :deep(.current-field) {
          width: 104px;

          .el-select__wrapper {
            box-shadow: none;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
            padding: 8px 4px 8px 8px;
          }
        }

        :deep(.value) {
          flex: 1;

          .el-select__wrapper {
            box-shadow: none;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
            padding: 8px;
          }
        }

        .formula-value {
          flex: 1;

          .formula-button {
            width: 100%;
            border-radius: 4px;

            &.has-formula :deep(span) {
              color: var(--color-primary);
            }
          }
        }

        .value-input {
          flex: 1;

          :deep(.el-button) {
            width: 100%;
            border-radius: 4px;
            
            &:hover {
              color: var(--color-primary);
              border: 1px solid var(--color-primary-light-5);
              background-color: var(--color-primary-light-9);
            }

            &.active {
              color: var(--color-primary);
            }
          }

          :deep(.el-select) {
            width: 100%;

            .el-select__wrapper {
              border-radius: 4px;
              background-color: var(--bg-color-overlay);
              box-shadow: none;
            }
          }

          :deep(.el-input) {
            width: 100%;

            .el-input__wrapper {
              border-radius: 4px;
              background-color: var(--bg-color-overlay);
              box-shadow: none;
            }

            .el-input__inner::-webkit-outer-spin-button,
            .el-input__inner::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }

            .el-input__inner[type="number"] {
              -moz-appearance: textfield;
              appearance: textfield;
            }
          }
          
          :deep(.el-input-tag) {
            width: 100%;
            &.el-input-tag__wrapper {
              border-radius: 4px;
              background-color: var(--bg-color-overlay);
              box-shadow: none;
            }
            .el-input-tag__inner {
              overflow: hidden;
              white-space: nowrap;
              flex-wrap: nowrap;
              justify-content: end;
            }
            .el-input-tag__inner::-webkit-outer-spin-button,
            .el-input-tag__inner::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
          }

          :deep(.el-date-editor) {
            width: 100%;
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            box-shadow: none;
            height: 32px;
          }

          :deep(.dynamic-filter-select) {
            width: 100%;
            border-radius: 4px;

            &.disabled {
              opacity: 0.7;
              pointer-events: none;
            }

            .show-type-popover-btn {
              background-color: var(--bg-color-overlay);
              border: none !important;
            }

            .el-input__wrapper {
              height: 32px;
            }
          }

          .number-range {
            display: flex;
            align-items: center;

            span {
              margin: 0px 2px;
            }
          }

        }

        .el-icon {
          cursor: pointer;
          color: var(--text-color-secondary);
        }
      }
      .select-value-container {
        flex: 1;
      }

      .condition-action {
        width: 24px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .delete {
        cursor: pointer;
        color: var(--text-color-secondary);
      }
    }
  }
}
</style>
