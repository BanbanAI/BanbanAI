<template>
  <el-form
    class="add-data-option"
    :model="options"
    :rules="rules"
    ref="formRef"
  >
    <div class="warning is-danger">
      <span>{{ $t('AddDataOption.dataPermissionWarning') }}</span>
    </div>
    <div class="warning">
      <el-icon size="16"><i-ep-warning /></el-icon>
      <span>{{ $t('AddDataOption.triggerConditionDesc') }}</span>
    </div>
    <el-form-item class="target-form" prop="targetTableUID">
      <div class="target-form-title">
        <span style="color: #f56c6c; font-size: 16px;">
          *
        </span>
        {{ $t('AddDataOption.targetForm') }}
      </div>
      <el-select
        :placeholder="$t('AddDataOption.selectForm')"
        v-model="props.options.targetTableUID"
        @change="changeTargetTable"
        :no-data-text="$t('AddDataOption.noForm')"
        filterable
      >
        <el-option
          v-for="item in targetFormOption"
          :value="item.value"
          :label="item.label"
        />
        <template #label="{ label, value }">
          <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('AddDataOption.formDeleted') }}</span>
          <span v-else>{{ label }}</span>
        </template>
      </el-select>
    </el-form-item>
    <el-tabs v-model="activeTab" v-if="props.options.targetTableUID">
      <el-tab-pane :label="$t('AddDataOption.basicSetting')" name="baseSetting">
        <el-form-item
          class="data-source-form"
        >
          <data-source-form
            :sourceTables="props.options.sourceTables"
            ref="dataSourceFormRef"
            :targetFields="props.options.targetFields"
          />
        </el-form-item>
        <hr />
        <el-form-item
          class="data-source-form"
          v-if="!!isSelectSubTable"
        >
          <data-source-subform
            :primarySourceTable="props.options.primarySourceTable"
            :allowEmptyFilter="true"
            ref="dataSourceSubFormRef"
          />
        </el-form-item>
        <hr v-if="!!isSelectSubTable"/>
        <el-form-item class="target-form-field">
          <target-form-field
            :tableUID="props.options.targetTableUID"
            :targetFields="props.options.targetFields"
            :sourceTables="props.options.sourceTables"
            :allowDataOwnerField="true"
            mode="add"
            ref="targetFormFieldRef"
            @update="(val) => props.options.targetFields = val"
          >
          </target-form-field>
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane :label="$t('AddDataOption.batchSetting')" name="batchSetting">
        <el-form-item>
          <el-checkbox @change="handleBatchEnabledChange" :label="$t('AddDataOption.enableBatchAdd')" v-model="props.options.batchEnabled"></el-checkbox>
        </el-form-item>
        
        <el-form-item v-if="props.options.batchNumber && props.options.batchEnabled" class="batch-number-option" prop="batchNumber">
          <div class="title">{{ $t('AddDataOption.batchAddCount') }}</div>
          <div class="form-container">
            <el-select v-model="props.options.batchNumber.type" class="batch-number-type" @change="props.options.batchNumber.value = null">
              <el-option :label="$t('AddDataOption.field') + ''" :value="TargetFieldFillType.FIELD"></el-option>
              <el-option :label="$t('AddDataOption.customValue') + ''" :value="TargetFieldFillType.CUSTOM"></el-option>
            </el-select>
            <el-input-number
              v-model="props.options.batchNumber.value"
              v-if="props.options.batchNumber.type === TargetFieldFillType.CUSTOM"
              :placeholder="$t('AddDataOption.inputContent')"
              :min="1"
              :step="1"
              :precision="0"
            />
            <field-of-tables-select
              v-model="props.options.batchNumber.value"
              filterable
              :tables="sourceTablesLocal"
              :defaultTables="defaultTables"
              :placeholder="$t('AddDataOption.selectField')"
              :noDataText="$t('AddDataOption.noFieldData')"
              ref="fieldValueRef"
              :otherTableLabel="$t('AddDataOption.dataSourceForm')"
              v-if="props.options.batchNumber.type === TargetFieldFillType.FIELD"
            ></field-of-tables-select>
          </div>
        </el-form-item>

        <el-form-item class="target-form-field" v-if="props.options.batchNumber && props.options.batchEnabled">
          <target-form-field
            :tableUID="props.options.targetTableUID"
            :targetFields="props.options.batchFields"
            :showTargetTable="props.options.targetTableUID"
            :allowDataOwnerField="true"
            mode="add"
            ref="batchRuleRef"
            @update="(val) => props.options.batchFields = val"
            :titleText="$t('AddDataOption.batchAddRule')"
            :isFillTypeDisabled="onFillTypeDisabled"
          >
            <template #fillType="{ field }">
              <el-option :label="$t('AddDataOption.keepUnchanged') + ''" :value="TargetFieldFillType.EMPTY"></el-option>
              <el-option :label="$t('AddDataOption.formulaEdit') + ''" :value="TargetFieldFillType.FORMULA"></el-option>
            </template>
          </target-form-field>
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane :label="$t('AddDataOption.permissionSetting')" name="permissionSetting">
        <el-form-item>
          <div class="form-permission-setting">
            <div class="permission-label">{{ $t('AddDataOption.formPermission') }}</div>
            <div class="permission-control">
              <el-checkbox
                v-model="props.options.allowLinkageFill"
                :label="$t('AddDataOption.allowLinkageFill')"
              />
              <el-tooltip :content="$t('AddDataOption.allowLinkageFillTip')" placement="top">
                <el-icon class="permission-tip"><i-ep-question-filled /></el-icon>
              </el-tooltip>
            </div>
          </div>
        </el-form-item>
        <el-form-item>
          <el-checkbox
            v-model="triggerTargetProcess"
            :label="$t('AddDataOption.triggerTargetProcess')"
            :disabled="isCurrentFormTarget"
          />
        </el-form-item>
      </el-tab-pane>
    </el-tabs>
  </el-form>
</template>

<script lang='ts' setup>
import { ElMessage, FormInstance } from 'element-plus'
import { computed, inject, ref } from 'vue'
import { AddDataOptions, ProcessFlowOptions, Table, TargetFieldFillType, TargetFieldFillRule, getProcessTargetSourceUID } from '@common/types/project'
import { NOCODE, ORGANIZE_UTIL } from "@renderer/types"
import { useFormTable } from '../../hooks'
import { isSystemField, shouldTreatFieldAsStaticRequired } from '@common/utils'
import { LogicalOperator } from '@common/types/nocode'
import { unique } from '@common/utils/unique'
import i18next from 'i18next'
import { ProcessNode } from '../process'
import { getNocodeDataSourceTableByUID, getNocodeMainTableOptions } from '@common/utils/connection'
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission'

const props = defineProps<{
  node: ProcessNode,
  options: ProcessFlowOptions & AddDataOptions,
}>();


const nocode = inject(NOCODE)
const organizeUtil = inject(ORGANIZE_UTIL, null)
const table = useFormTable()
const formRef = ref<FormInstance>()
const dataSourceFormRef = ref(null)
const dataSourceSubFormRef = ref(null)
const targetFormFieldRef = ref(null)
const activeTab = ref('baseSetting')
const batchRuleRef = ref(null)

const currentTables = computed(() => {
  return nocode.value.body?.formData?.tables ?? []
})

const getRootTableUID = (tableUID?: string) => {
  let currentUID = tableUID
  const visited = new Set<string>()
  while (currentUID && !visited.has(currentUID)) {
    visited.add(currentUID)
    const currentTable = currentTables.value.find(item => item.uid === currentUID)
    const primaryTableUID = currentTable?.meta?.extra?.primaryTable?.[1]
    if (!primaryTableUID) {
      return currentUID
    }
    currentUID = primaryTableUID
  }
  return currentUID
}

const isCurrentFormTarget = computed(() => {
  const targetSource = getNocodeDataSourceTableByUID(nocode.value?.body, props.options.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)
  if (targetSource?.connection?.nocodeId && targetSource.connection.nocodeId !== nocode.value?.meta?.id) {
    return false
  }
  return getRootTableUID(props.options.targetTableUID) === getRootTableUID(table.value.uid)
})

const triggerTargetProcess = computed({
  get: () => props.options.triggerTargetProcess ?? !isCurrentFormTarget.value,
  set: (value: boolean) => {
    props.options.triggerTargetProcess = value
  },
})

const tableAliasList = computed<(Table & { alias: string })[]>(() => {
  return currentTables.value.reduce<(Table & { alias: string })[]>((acc, item) => {
    if (!canReadNocodeTableDataByBody(
      nocode.value.body,
      item.uid,
      organizeUtil?.departments || [],
    )) {
      return acc
    }

    if (item.meta?.extra?.primaryTable) {
      const primaryTable = currentTables.value.find(t => t.uid === item.meta?.extra?.primaryTable?.[1])
      const field = primaryTable?.fields?.find(f => f.meta?.extra?.subTableUID?.[1] === item.uid)

      if (!primaryTable || !field) {
        return acc
      }

      const pAlias = primaryTable.alias ?? i18next.t('AddDataOption.unnamedTable')
      const fAlias = field.alias ?? i18next.t('AddDataOption.unnamedTable')

      acc.push({
        ...item,
        alias: `${pAlias}.${fAlias}`
      })
      return acc
    }

    acc.push({
      ...item,
      alias: item.alias ?? i18next.t('AddDataOption.unnamedTable')
    })
    return acc
  }, [])
})

const currentSubTableItems = computed(() => {
  return (table.value.fields || []).reduce((acc, field) => {
    const subTableUID = field.meta?.extra?.subTableUID?.[1]
    if (!subTableUID) {
      return acc
    }

    const subTable = currentTables.value.find(item => item.uid === subTableUID)
    if (!subTable) {
      return acc
    }

    acc.push({
      tableUID: subTable.uid,
      label: `${i18next.t('AddDataOption.currentForm')}.${field.alias ?? i18next.t('AddDataOption.unnamedTable')}`,
    })
    return acc
  }, [] as { tableUID: string, label: string }[])
})

const targetFormOption = computed(() => {
  const currentTableUID = table.value.uid
  const currentSubTableUIDs = new Set(currentSubTableItems.value.map(item => item.tableUID))
  const otherOptions = tableAliasList.value
    .filter(item => item.uid !== currentTableUID && !currentSubTableUIDs.has(item.uid))
    .map(item => ({
      label: item.alias,
      value: item.uid
    }))
  const crossAppOptions = getNocodeMainTableOptions(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }).filter(item => item.isCrossApp).map(item => ({
    label: item.label,
    value: item.value,
  }))

  return [
    {
      label: i18next.t('AddDataOption.currentForm'),
      value: table.value.uid,
    },
    ...currentSubTableItems.value.map(item => ({
      label: item.label,
      value: item.tableUID
    })),
    ...otherOptions,
    ...crossAppOptions,
  ]
})

const createPrimarySourceTable = (targetTableUID?: string) => {
  const targetTable = getNocodeDataSourceTableByUID(nocode.value?.body, targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)?.table
  if (!targetTable?.meta?.extra?.primaryTable) {
    return null
  }

  const primaryUID = targetTable.meta?.extra?.primaryTable?.[1]
  const primaryTable = getNocodeDataSourceTableByUID(nocode.value?.body, primaryUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)?.table
  let name = targetTable.alias
  if (primaryTable) {
    name = `${primaryTable.alias}`
  }

  return {
    uid: unique(),
    name,
    tableUID: primaryTable?.uid,
    filterRule: {
      logic: LogicalOperator.AND,
      conditions: []
    },
  }
}


const defaultTables = computed(() => {
  const _table = table.value;
  return [{
    ..._table,
    label: `${i18next.t('AddDataOption.currentForm')}-${i18next.t('AddDataOption.thisData')}`,
    fields: _table.fields.filter(field => field.meta?.extra?.widgetType === 'widget.form.numberInput'),
  }]
})
const sourceTablesLocal = computed(() => {
  if(props.options.targetTableUID) {
    const targetTable = getNocodeDataSourceTableByUID(nocode.value?.body, props.options.targetTableUID, {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
      includeSchemaSources: true,
    }, true)?.table
    if(!targetTable){
      return [];
    }
    return [{
      ...targetTable,
      uid: getProcessTargetSourceUID(props.options.targetTableUID, table.value.uid),
      fields: targetTable.fields.filter(field => field.meta?.extra?.widgetType === 'widget.form.numberInput'),
      name: targetTable.alias
    }];
  }
  return (props.options.sourceTables || []).reduce((acc, sourceTable) => {
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
        fields: tableSource.table.fields.filter(field => field.meta?.extra?.widgetType === 'widget.form.numberInput'),
        name: sourceTable.alias || sourceTable.name,
        uid: sourceTable.uid
      })
    }
    return acc
  }, [])
})

const rules = {
  targetTableUID: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('AddDataOption.selectForm'))),
    trigger: 'change'
  }],
  batchNumber: [
    {
      validator: (rule, value, callback) => {
        if (value.value === null || value.value === undefined) {
          callback(new Error(i18next.t('AddDataOption.batchAddCountNotEmpty')))
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

const changeTargetTable = () => {
  props.options.triggerTargetProcess = !isCurrentFormTarget.value
  const targetTable = getNocodeDataSourceTableByUID(nocode.value?.body, props.options.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)?.table
  if (!targetTable) {
    props.options.targetFields = []
    props.options.primarySourceTable = null
    return
  }
  const fields = targetTable.fields.filter(field => {
    return !isSystemField(field) && field.meta?.extra?.widgetType != 'widget.form.dateRangePicker' && !field.meta?.extra?.relatedTableUID
  })
  props.options.targetFields = fields.map(field => {
    const isRequired = shouldTreatFieldAsStaticRequired(field)
    return {
      fieldUID: field.uid,
      type: isRequired ? TargetFieldFillType.CUSTOM : TargetFieldFillType.EMPTY,
      value: null
    }
  })
  props.options.primarySourceTable = createPrimarySourceTable(props.options.targetTableUID)
}

const onFillTypeDisabled = (field: TargetFieldFillRule) => {
  const item = targetFormFieldRef.value?.targetFields?.find(item => item.fieldUID === field.fieldUID);
  const value = item?.type === TargetFieldFillType.EMPTY;
  if (value) {
    batchRuleRef.value?.changeFillType(field.fieldUID, TargetFieldFillType.EMPTY);
  }
  return value;
}

const handleBatchEnabledChange = (val) => {
  if(val) {
    props.options.batchNumber = {
      type: TargetFieldFillType.CUSTOM,
      value: null
    }
  }
}

const save = async () => {
  const valid = formRef.value
    ? await new Promise((resolve) => {
      formRef.value?.validate((isValid) => {
        isValid ? resolve(true) : resolve(false)
      })
    })
    : true
  if (!valid) {
    ElMessage.error(i18next.t('AddDataOption.saveConfigInvalid'))
    return false
  }

  const dataSourceFormValid = dataSourceFormRef.value?.validate
    ? await dataSourceFormRef.value.validate()
    : true
  if (!dataSourceFormValid) {
    ElMessage.error(i18next.t('AddDataOption.saveConfigInvalid'))
    return false
  }

  const dataSourceSubFormValid = dataSourceSubFormRef.value?.validate
    ? await dataSourceSubFormRef.value.validate()
    : true
  if (!dataSourceSubFormValid) {
    ElMessage.error(i18next.t('AddDataOption.saveConfigInvalid'))
    return false
  }

  const targetFormFieldValid = targetFormFieldRef.value?.validate
    ? await targetFormFieldRef.value.validate()
    : true
  if (!targetFormFieldValid) {
    ElMessage.error(i18next.t('AddDataOption.saveConfigInvalid'))
    return false
  }

  const batchRuleValid = batchRuleRef.value?.validate
    ? await batchRuleRef.value.validate()
    : true
  if (!batchRuleValid) {
    ElMessage.error(i18next.t('AddDataOption.saveConfigInvalid'))
    return false
  }

  return true
}

const isSelectSubTable = computed(() => {
  const targetTable = getNocodeDataSourceTableByUID(nocode.value?.body, props.options.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)?.table
  const isSelectSubTable = !!targetTable?.meta?.extra?.primaryTable
  if(isSelectSubTable && !props.options.primarySourceTable) {
    props.options.primarySourceTable = createPrimarySourceTable(props.options.targetTableUID)
  } else if (isSelectSubTable && Array.isArray(props.options.primarySourceTable?.filterRule?.conditions)) {
    const conditions = props.options.primarySourceTable.filterRule.conditions
    const isOnlyPlaceholderCondition = conditions.length === 1
      && !conditions[0]?.uid
      && !conditions[0]?.func
      && (conditions[0]?.value === null || conditions[0]?.value === undefined || conditions[0]?.value === "")
    if (isOnlyPlaceholderCondition) {
      props.options.primarySourceTable.filterRule.conditions = []
    }
  }
  return isSelectSubTable
})

defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.add-data-option {
  width: 100%;
  height: 100%;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  
  .warning {
    font-size: 14px;
    width: 100%;
    background-color: rgb(255, 251, 232);
    color: var(--el-color-warning);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 4px;

    span {
      line-height: 22px;
    }

    .menu-icon {
      margin-right: 4px;
    }

    &.is-danger {
      background-color: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
    }
  }

  hr {
    border: none;
    border-bottom: 1px solid var(--border-color);
  }

  :deep(.el-form-item) {
    margin-bottom: 0px;

    &.target-form {
      .el-form-item__content {
        display: flex;
        gap: 12px;
      }
      
      .target-form-title {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }
      
      .el-select {
        .el-select__wrapper {
          box-shadow: none;
          background-color: var(--bg-color-overlay);
          border-radius: 4px;
        }
      }
    }

    

    &.data-source-form {
      .el-form-item__content {
        display: block;
      }
    }
  }

  :deep(.el-tabs) {
    .el-tabs__header {
      display: flex !important;
      border-radius: 4px;
    }

    .el-tabs__nav-wrap {
      border-radius: 4px;
    }

    .el-tabs__item {
      flex: 1 !important;
      text-align: center;
      height: 32px;
      border-radius: 4px;
      transition: all 0.3s ease;

      &.is-active {
        background-color: #1f77fc;
        color: var(--color-white);
      }
    }

    .el-tabs__nav {
      width: 100%;
      height: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .el-tabs__active-bar {
      display: none;
    }

    .el-tabs__content {
      .el-tab-pane {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
    }
  }

  .form-permission-setting {
    width: 100%;

    .permission-label {
      font-weight: 500;
      margin-bottom: 12px;
    }

    .permission-control {
      display: flex;
      align-items: center;
      gap: 4px;

      .permission-tip {
        color: var(--text-color-secondary);
      }
    }
  }

  :deep(.batch-number-option) {
    .el-form-item__content {
      display: flex;
      gap: 12px;
      flex-direction: column;
      align-items: flex-start;

      .title {
        font-weight: 500;
        font-size: 14px;
      }

      .form-container {
        display: flex;
        gap: 12px;
        width: 100%;

        .batch-number-type {
          width: 96px;

          .el-select__wrapper {
            width: 96px;
          }
        }

        .el-select .el-select__wrapper {
          box-shadow: none;
          background-color: var(--bg-color-overlay);
          border-radius: 4px;
          padding: 8px;
        }

        .el-input .el-input__wrapper {
          border-radius: 4px;
          background-color: var(--bg-color-overlay);
          box-shadow: none;
          padding: 0px 8px;

          input {
            text-align: left;
          }
        }

        .el-input-number {
          flex: 1;

          .el-input-number__decrease {
            display: none;
          }

          .el-input-number__increase {
            display: none;
          }
        }
      }
    }
  }
}
</style>
