<template>
  <div class="filter-condition-setting-item">
    <el-form class="condition-item" v-for="(condition, index) in props.validRule?.conditions" :model="condition"
      :rules="rulesByType[condition.type] || rulesByType[FormConditionValueType.FORM]" ref="formRef">
      <div class="item-header">
        <span>{{ index === 0 ? $t('ConditionSettingItem.when') : $t('ConditionSettingItem.and') }}</span>

        <el-button class="delete-button" type="info" @click="deleteCondition(index)"
          v-if="props.validRule?.conditions?.length > 1" color="var(--text-color-placeholder)" :icon="Delete" link>
        </el-button>
      </div>

      <div class="select-container">
        <el-select
          class="type"
          v-model="condition.type"
          popper-class="custom-popper-large"
          :offset="2"
          @change="() => {
            condition.value = null
            condition.func = null
            condition.uid = null
          }"
        >
          <el-option :value="FormConditionValueType.FORM" :label="$t('conditionSettingItem.field')" />
          <!-- <el-option :value="FormConditionValueType.FORM" :label="$t('ConditionSettingItem.field')" /> -->
          <el-option :value="FormConditionValueType.FORMULA" :label="$t('conditionSettingItem.formulaEditor')" />
          <!-- <el-option :value="FormConditionValueType.FORMULA" :label="$t('ConditionSettingItem.formulaEdit')" /> -->
          <el-option :value="FormConditionValueType.FILTER_ROW" :label="$t('conditionSettingItem.filteredRowCount')" />
          <!-- <el-option :value="FormConditionValueType.FILTER_ROW" :label="$t('ConditionSettingItem.filterDataCount')" /> -->
        </el-select>

        <el-form-item v-if="condition.type === FormConditionValueType.FORM" prop="uid" style="flex: 1;">
          <field-of-tables-select :modelValue="condition.uid" @update:modelValue="getConfiguration(condition, $event)"
            filterable :tables="fieldSelectableSourceTablesLocal" :defaultTables="defaultTables" :placeholder="$t('ConditionSettingItem.plsSelectField')" ref="fieldValueRef"
            :otherTableLabel="$t('ConditionSettingItem.dataSourceForm')"></field-of-tables-select>
        </el-form-item>

        <el-form-item v-if="condition.type === FormConditionValueType.FILTER_ROW" prop="uid" style="flex: 1;">
          <el-select class="uid" :placeholder="$t('ConditionSettingItem.plsSelectDataSourceForm')" :no-data-text="$t('ConditionSettingItem.noDataSourceFormText')" v-model="condition.uid" :disabled="!condition.type" :key="sourceTables.length + `${index}`">
            <el-option v-for="table in sourceTables" :key="table.uid" :label="table.name" :value="table.uid" />
            <template #label="{ label, value }">
              <span :class="{ error: label === value }">
                {{ label === value ? $t('ConditionSettingItem.dataSourceDeleted') : label }}
              </span>
            </template>
          </el-select>
        </el-form-item>

        <el-form-item v-if="condition.type === FormConditionValueType.FORMULA" prop="formula" style="flex: 1;">
          <el-button :class="['formula-button', condition.formula ? 'has-formula' : '']"
            @click="handleEditFormula(condition, index)"
            :style="{ color: condition.formula ? 'var(--color-primary)' : 'var(--text-color-regular)' }">
            {{ condition.formula ? $t('ConditionSettingItem.formulaSet') : $t('ConditionSettingItem.setFormula') }}
          </el-button>
        </el-form-item>
      </div>

      <div class="select-container-condition">
        <el-form-item class="func-container" v-if="condition.type === FormConditionValueType.FORM" prop="func">
          <el-select class="func" :placeholder="$t('ConditionSettingItem.plsSelect')" @change="changeFunc(condition)" v-model="condition.func"
            :disabled="!condition.uid">
            <el-option v-for="([key, value], index) in Object.entries(conditionFuncInfoMap.get(condition.uid) || {})"
              :key="key" :label="RuleFuncTextMapping[key]" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item class="func-container" v-if="condition.type === FormConditionValueType.FILTER_ROW" prop="func">
          <el-select
            class="func"
            :placeholder="$t('ConditionSettingItem.plsSelect')"
            @change="(val) => {
              condition.value = val === RuleFunc.BETWEEN ? [null, null] : null
            }"
            v-model="condition.func"
            :disabled="!condition.uid"
          >
            <el-option 
              v-for="func in funcOption(condition)"
              :label="func.label"
              :value="func.value"
            />
          </el-select>
        </el-form-item>

        <div class="custom-value" v-if="condition.type === FormConditionValueType.FORM && ![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func)">
          <el-form-item prop="value" v-if="getFuncValue(condition)?.type === RuleFuncValue.RANGE">
            <div class="number-range"
              v-if="getFuncValue(condition)?.subType === 'number' && condition?.value?.length === 2">
              <el-input v-model="condition.value[0]" type="number" :placeholder="$t('ConditionSettingItem.minVal')" :disabled="isValueInputDisabled(condition)" />
              <span> ~ </span>
              <el-input v-model="condition.value[1]" type="number" :placeholder="$t('ConditionSettingItem.maxVal')" :disabled="isValueInputDisabled(condition)" />
            </div>
            <el-config-provider :locale="elementPlusLocale" v-else-if="getFuncValue(condition)?.subType === 'date' || getFuncValue(condition)?.subType === 'daterange'">
              <el-date-picker class="date-range" :value-format="$t('ConditionSettingItem.dateFormat')" range-separator="~"
                v-model="condition.value" type="daterange" :disabled="isValueInputDisabled(condition)" />
            </el-config-provider>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.DATE">
            <el-config-provider :locale="elementPlusLocale">
              <el-date-picker class="date-range" :value-format="$t('ConditionSettingItem.dateFormat')" v-model="condition.value" type="date" :disabled="isValueInputDisabled(condition)" />
            </el-config-provider>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.TIME">
            <el-config-provider :locale="elementPlusLocale">
              <el-time-picker class="time" :value-format="'HH:mm:ss'" v-model="condition.value" type="time" :disabled="isValueInputDisabled(condition)" />
            </el-config-provider>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.SELECT">
            <el-select-v2 v-model="condition.value" clearable filterable :options="selectOptions(condition)"
              :placeholder="$t('ConditionSettingItem.plsSelect')" :disabled="isValueInputDisabled(condition)">
            </el-select-v2>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.SELECT_MULTIPLE">
            <el-select-v2 v-model="condition.value" :collapse-tags="true" clearable filterable multiple
              :options="selectOptions(condition)" :placeholder="$t('ConditionSettingItem.plsSelect')" :disabled="isValueInputDisabled(condition)">
            </el-select-v2>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.TAGS">
            <el-input-tag v-model="condition.value" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :placeholder="$t('ConditionSettingItem.enterToAddVal')" :disabled="isValueInputDisabled(condition)"></el-input-tag>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.ADDRESS">
            <el-tree-select :placeholder="$t('ConditionSettingItem.plsSelect')" class="drop-down" ref="addressRef" v-model="condition.value" lazy
              :load="loadNode" node-key="value" :render-after-expand="false" clearable filterable check-strictly
              :highlight-current="true" :show-path="true" :empty-text="$t('ConditionSettingItem.noData')" :props="{
                label: 'label',
                value: 'value',
                children: 'children',
                isLeaf: 'isLeaf',
              }" :disabled="isValueInputDisabled(condition)">
            </el-tree-select>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.NUMBER">
            <el-input v-model="condition.value" :placeholder="$t('ConditionSettingItem.plsInput')" type="number" :disabled="isValueInputDisabled(condition)" />
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(condition)?.subType === 'date' && getFuncValue(condition)?.type === RuleFuncValue.STRING">
            <date-dynamic-filter-value-select class="dynamic-filter-select" v-model="condition.value" :append-to="'body'" :teleported="true" :disabled="isValueInputDisabled(condition)" />
          </el-form-item>
          <el-form-item prop="value" v-else>
            <el-input v-model="condition.value" :placeholder="$t('ConditionSettingItem.plsInput')" :disabled="isValueInputDisabled(condition)" />
          </el-form-item>
        </div>

        <div class="custom-value" v-if="condition.type === FormConditionValueType.FILTER_ROW">
          <el-input v-model="condition.value" :placeholder="$t('ConditionSettingItem.plsInput')" type="number" v-if="condition.func !== RuleFunc.BETWEEN" :disabled="isValueInputDisabled(condition)"/>
          <div class="number-range" v-else>
            <el-input v-model="condition.value[0]" type="number" :placeholder="$t('ConditionSettingItem.minVal')" :disabled="isValueInputDisabled(condition)" />
              <span> ~ </span>
            <el-input v-model="condition.value[1]" type="number" :placeholder="$t('ConditionSettingItem.maxVal')" :disabled="isValueInputDisabled(condition)" />
          </div>
        </div>
      </div>
    </el-form>

    <div class="add-button" @click="addCondition">
      <el-icon>
        <i-ep-plus />
      </el-icon>
      <span>{{ $t('ConditionSettingItem.addCondition') }}</span>
    </div>
    <span class="error-tip" v-if="props.validRule?.conditions?.length === 0 && hasAttemptedValidation">{{ $t('ConditionSettingItem.plsAddAtLeastOne') }}</span>
    <source-table-formula-dialog :modelValue="visible" @update:modelValue="v => visible = v" @update="handleUpdate" :filter-functions="['GETID']"
      :value="tempFormula" :defaultTables="defaultTables" :tables="fieldSelectableSourceTablesLocal" :otherTableLabel="$t('ConditionSettingItem.dataSourceFormSec')" />
  </div>
</template>

<script setup lang="ts">
import {
  FormConditionValueType,
  RuleFuncValue,
  RuleFuncTextMapping,
  RuleFunc
} from '@common/types/nocode'
import { isBuiltinField } from '@common/utils';
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { getChinaAddressData } from "@renderer/utils/township";
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { ConditionalGroup, Field, SourceTable, TableUID, ValidConditionalRule } from '@common/types/project';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale'
import { isEmpty } from "@common/utils/object";
import { useFormData, useFormFields, useFormTable } from '../../views/editor/form/hooks';
import { Delete } from '@element-plus/icons-vue';
import { formElementInstances } from '@renderer/utils/instance';
import i18next from 'i18next';
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';

const props = withDefaults(defineProps<{
  validRule: ConditionalGroup,
  tableUID: TableUID,
  sourceTables: SourceTable[],
  isRequired: boolean,
  isInTarget: boolean,
}>(), {
  isRequired: false,
  isInTarget: false,
})

const baseRules = {
  func: [
    {
      validator: (rule, value, callback) => {
        if (isEmpty(value) || !value) {
          return callback(new Error(i18next.t('ConditionSettingItem.plsSelectLogic')))
        }
        callback()
      },
    }
  ],
  value: [
    {
      validator: (rule, value, callback) => {
        if (isEmpty(value) || !value) {
          return callback(new Error(i18next.t('ConditionSettingItem.plsFillCustomVal')))
        }
        callback()
      },
    }
  ],
  formula: [
    {
      validator: (rule, value, callback) => {
        if (isEmpty(value) || !value) {
          return callback(new Error(i18next.t('ConditionSettingItem.plsEditFormula')))
        }
        callback()
      },
    }
  ],
}

const uidRulesByType = {
  [FormConditionValueType.FORM]: [
    {
      validator: (rule, value, callback) => {
        if (isEmpty(value) || !value) {
          return callback(new Error(i18next.t('ConditionSettingItem.plsSelectFieldSec')))
        }
        callback()
      },
    }
  ],
  [FormConditionValueType.FILTER_ROW]: [
    {
      validator: (rule, value, callback) => {
        if (isEmpty(value) || !value) {
          return callback(new Error(i18next.t('ConditionSettingItem.plsSelectDataSourceForm')))
        }
        callback()
      },
    }
  ],
}

const rulesByType = {
  [FormConditionValueType.FORM]: {
    ...baseRules,
    uid: uidRulesByType[FormConditionValueType.FORM],
  },
  [FormConditionValueType.FILTER_ROW]: {
    ...baseRules,
    uid: uidRulesByType[FormConditionValueType.FILTER_ROW],
  },
  [FormConditionValueType.FORMULA]: baseRules,
}

const nocode = inject(NOCODE)
const conditionFuncInfoMap = reactive(new Map())
const organizeUtil = inject(ORGANIZE_UTIL)
const formRef = ref(null)
const visible = ref(false)
const table = useFormTable();
const hasAttemptedValidation = ref(false)

const defaultTables = computed(() => {
  return [
    {
      label: i18next.t('ConditionSettingItem.currentForm'),
      ...table.value,
    }
  ]
})
const sourceTablesLocal = computed(() => {
  return props.sourceTables?.reduce((acc, sourceTable) => {
    const tableSource = getNocodeDataSourceTableByUID(nocode.value?.body, sourceTable.tableUID, {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
    }, true);
    if (tableSource?.table) {
      acc.push({
        ...tableSource.table,
        connectionUID: tableSource.connection?.uid,
        sourceConnectionUID: tableSource.connection?.uid,
        sourceTableUID: tableSource.table.uid,
        name: sourceTable.alias || sourceTable.name,
        uid: sourceTable.uid
      })
    }
    return acc
  }, [])
})

const fieldSelectableSourceTablesLocal = computed(() => {
  return sourceTablesLocal.value.filter(sourceTable => {
    const matchedSourceTable = props.sourceTables?.find(item => item.uid === sourceTable.uid);
    return matchedSourceTable?.sourceType !== "current-subform";
  })
})

const addCondition = () => {
  props.validRule?.conditions.push({
    uid: null,
    func: null,
    value: null,
    formula: null,
    type: FormConditionValueType.FORM,
  })
  hasAttemptedValidation.value = false;
}

const deleteCondition = (index) => {
  props.validRule?.conditions.splice(index, 1)
}

const getFuncInfoByType = async (type) => {
  return await (await formElementInstances.getInstance(type)).getConfigurations().editFuncInfo
}
const initConditionFuncInfoMap = async (formFields) => {
  for (const field of formFields) {
    if (field?.meta?.extra?.subTableUID?.[1]) {
      const subTable = nocode.value.body?.formData?.tables?.find(t => field.meta.extra.subTableUID[1] === t.uid);

      for (const subField of subTable.fields) {
        if (isBuiltinField(subField)) continue
        const editFuncInfo = await getFuncInfoByType(subField.meta?.extra?.widgetType)
        conditionFuncInfoMap.set(`${table.value.uid}.${field.uid}.${subField.uid}`, editFuncInfo)
      }
    } else {
      if (isBuiltinField(field)) continue
      const editFuncInfo = await getFuncInfoByType(field.meta?.extra?.widgetType)
      conditionFuncInfoMap.set(field.uid, editFuncInfo)
    }
  }

  const allTables = [...sourceTablesLocal.value, table.value]
  for (const condition of props.validRule.conditions) {
    if (condition.type !== FormConditionValueType.FORM || !condition.uid) continue;
    const [tableUid = null, fieldUid = null, subFieldUid = null] = condition.uid.split(".") || [];
    if (!tableUid || !fieldUid) continue;

    const targetTable = allTables.find(t => t.uid === tableUid);
    const field = targetTable?.fields?.find(item => item.uid === fieldUid);
    const targetField = subFieldUid
      ? field?.subTableFields?.find(item => item.uid === subFieldUid)
      : field;
    if (!targetField?.meta?.extra?.widgetType) continue;

    const editFuncInfo = await getFuncInfoByType(targetField.meta.extra.widgetType)
    conditionFuncInfoMap.set(condition.uid, editFuncInfo)
  }
}

const getFuncValue = (condition: ValidConditionalRule) => {
  const field = getFieldByCondition(condition);
  if (!field) return
  // 使用condition.uid作为键
  const func = conditionFuncInfoMap.get(condition.uid)?.[condition.func]

  return {
    type: func,
    subType: field?.meta.subType,
  }
}

const isValueInputDisabled = (condition: ValidConditionalRule) => {
  return !condition.uid || !condition.func
}

const getConfiguration = (condition, uid: string) => {
  condition.uid = uid;
  const type = getFieldByCondition(condition)?.meta.extra.widgetType;
  formElementInstances.getInstance(type).then(widget => {
    return widget.getConfigurations()
  }).then(config => {
    conditionFuncInfoMap.set(condition.uid, config.editFuncInfo)

    // 默认选第一个 func
    condition.func = Object.keys(config.editFuncInfo)[0] || null

    // 根据 func 类型设置 value
    if (getFuncValue(condition)?.type === RuleFuncValue.RANGE && getFuncValue(condition)?.subType === 'number') {
      condition.value = [0, 0]
    } else {
      condition.value = null
    }
  })
}

const getFieldByCondition = (condition: ValidConditionalRule): Field => {
  if (condition.uid?.split('.')?.length > 1) {
    const [tableUid = null, fieldId = null, subFieldId = null] = condition.uid?.split('.') || [];
    const targetTable = [...sourceTablesLocal.value, table.value].find(table => table.uid === tableUid);
    const field = targetTable.fields?.find(f => f.uid === fieldId);
    if (subFieldId) return field.subTableFields?.find(f => f.uid === subFieldId);
    return field;
  } else {
    return formFields.value.find(field => field.uid === condition.uid);
  }
}

const formData = useFormData()
const changeFunc = (condition: ValidConditionalRule) => {
  const type = getFieldByCondition(condition)?.meta.extra.widgetType;

  formElementInstances.getInstance(type).then(widget => {
    return widget.getConfigurations()
  }).then(config => {
    conditionFuncInfoMap.set(condition.uid, config.editFuncInfo)
    if (getFuncValue(condition)?.type === RuleFuncValue.RANGE && getFuncValue(condition)?.subType === 'number') {
      condition.value = [null, null]
    } else {
      condition.value = null
    }
  })
}

const formFields = computed(() => {
  const table = nocode.value.body?.formData?.tables?.find(item => item.uid === props.tableUID)
  if (!table) {
    return []
  }
  const fields = table.fields
  return fields.filter(field => {
    return !isBuiltinField(field) && field.meta?.extra?.widgetType != 'widget.form.dateRangePicker' && !field.meta?.extra?.relatedTableUID
  })
})

const selectOptions = computed(() => {
  return (condition) => {
    if (getFuncValue(condition)?.subType === 'account') {
      return organizeUtil.users.map(item => ({
        label: item.realname,
        value: item.id,
      }))
    } else if (getFuncValue(condition)?.subType === 'department') {
      return organizeUtil.departments.map(item => ({
        label: item.name,
        value: item.id,
      }))
    } else {
      const field = formFields.value.find(field => field.uid === condition.uid)
      return field?.meta?.extra?.choices || []
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

const funcOption = (condition: ValidConditionalRule) => {
  const isDate = getFuncValue(condition)?.subType === 'date'
  return [
    {
      label: i18next.t('ConditionSettingItem.equal'),
      value: isDate ? RuleFunc.TIME_EQUAL : RuleFunc.EQUAL,
    },
    {
      label: i18next.t('ConditionSettingItem.notEqual'),
      value: isDate ? RuleFunc.TIME_NOT_EQUAL : RuleFunc.NOT_EQUAL,
    },
    {
      label: i18next.t('ConditionSettingItem.greater'),
      value: RuleFunc.GT,
    },
    {
      label: i18next.t('ConditionSettingItem.greaterEqual'),
      value: RuleFunc.GTE,
    },
    {
      label: i18next.t('ConditionSettingItem.less'),
      value: RuleFunc.LT,
    },
    {
      label: i18next.t('ConditionSettingItem.lessEqual'),
      value: isDate ? RuleFunc.TIME_LTE : RuleFunc.LTE,
    },
    {
      label: i18next.t('ConditionSettingItem.selectRange'),
      value: isDate ? RuleFunc.TIME_BETWEEN : RuleFunc.BETWEEN,
    },
  ]
}

const tempFormula = ref("")
const indexOfFieldEditingFormula = ref()
const handleEditFormula = (condition: ValidConditionalRule, index) => {
  tempFormula.value = condition.formula;
  indexOfFieldEditingFormula.value = index
  visible.value = true
}

const handleUpdate = (formula) => {
  if (indexOfFieldEditingFormula.value < props.validRule.conditions.length) {
    props.validRule.conditions[indexOfFieldEditingFormula.value].formula = formula;
  }
}

watch(() => props.tableUID, () => {
  props.validRule.conditions = []
  if (props.isRequired) {
    addCondition()
  }
}, { deep: true })

onMounted(async () => {
  await initConditionFuncInfoMap(formFields.value)
})

const validate = async () => {
  if (props.validRule?.conditions?.length === 0) {
    hasAttemptedValidation.value = true
    return false
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
  display: flex;
  flex-direction: column;
  gap: 8px;

  :deep(.el-select) {
    &:has(.is-disabled) {
      cursor: not-allowed;
    }

    .el-select__wrapper {
      width: 100%;
      height: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      box-shadow: 0 0 0 0px var(--border-color) inset;
      font-size: 14px;

      &:hover {
        box-shadow: 0 0 0 1px var(--border-color) inset;
      }

      &.is-focused {
        box-shadow: 0 0 0 1px var(--color-primary) inset !important;
      }
    }
  }

  .condition-item {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-direction: column;

    .item-header {
      width: 100%;
      display: flex;
      justify-content: space-between;

      span {
        color: var(--text-color-placeholder);
      }

      :deep(.delete-button) {
        --color: var(--text-color-placeholder);

        .el-icon {
          font-size: 16px;
        }
      }
    }

    .select-container {
      width: 100%;
      display: flex;
      gap: 8px;
      align-items: flex-start;

      :deep(.el-select.type) {
        min-width: 160px;
        width: fit-content;
        height: 100%;

        .el-select__selected-item {
          position: unset;
          transform: none;

          &.is-hidden {
            position: absolute;
          }
        }

        .el-select__wrapper {
          height: 100%;
          padding: 0px 4px 0px 8px;
        }
      }

      :deep(.type) {
        width: 88px;

        .el-select__wrapper {
          padding: 8px 4px 8px 8px;
        }
      }

      :deep(.field-uid) {
        flex: 1;
      }

      .formula-button {
        width: 100%;
        border-radius: 4px;

        &.has-formula :deep(span) {
          color: var(--color-primary);
        }
      }
    }

    .select-container-condition {
      display: flex;
      margin-top: 2px;

      .func-container {
        width: 160px;
        margin-right: 8px;
      }
    }
  }

  .custom-value {
    flex: 1;

    :deep(.el-form-item__content) {
      width: 100%;
    }

    :deep(.el-select) {
      width: 100%;

      .el-select__wrapper {
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        box-shadow: none;
      }
    }

    :deep(.el-date-editor) {
      width: 100%;
    }

    :deep(.el-input) {
      width: 100%;
      height: 32px;

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
      &.el-input-tag__wrapper {
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        box-shadow: none;
      }

      .el-input-tag__inner::-webkit-outer-spin-button,
      .el-input-tag__inner::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }

    :deep(.dynamic-filter-select) {
      width: 100%;
      border-radius: 4px;
      .show-type-popover-btn {
        background-color: var(--bg-color-overlay);
        border: none !important;
      }
    }

    .number-range {
      width: 100%;
      display: flex;
      align-items: center;

      span {
        margin: 0px 2px;
      }
    }

  }

  .add-button {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    cursor: pointer;
    color: var(--color-primary);
    width: fit-content;

    .el-icon {
      font-size: 16px;
      margin-right: 3px;
    }
  }
}

.error-tip {
  color: var(--color-danger);
  font-size: 12px;
  line-height: 1;
  display: block;
  transition: all 0.3s ease;

  &.el-fade-in-enter-active,
  &.el-fade-in-leave-active {
    transition: opacity 0.3s ease;
  }

  &.el-fade-in-enter-from,
  &.el-fade-in-leave-to {
    opacity: 0;
  }
}

:deep(.el-select) {
  .el-select__wrapper {
    .el-select__selected-item {
      span {
        &.error {
          color: var(--color-danger);
        }
      }
    }
  }
}
</style>
