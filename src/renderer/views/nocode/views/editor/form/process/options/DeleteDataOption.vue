<template>
  <el-form
    class="delete-data-option"
    ref="formRef"
    :model="options"
    :rules="rules"
  >
    <div class="warning is-danger">
      <span>{{ $t('DeleteDataOption.dataPermissionWarning') }}</span>
    </div>
    <el-form-item class="target-form" prop="targetTableUID">
      <div class="target-form-title">
        <span style="color: #f56c6c; font-size: 16px;">
          *
        </span>
        {{ $t('DeleteDataOption.targetForm') }}
      </div>
      <el-select
        :placeholder="$t('DeleteDataOption.selectForm')"
        v-model="props.options.targetTableUID"
        :no-data-text="$t('DeleteDataOption.noForm')"
        filterable
        @change="changeTargetTable"
      >
        <el-option
          v-for="item in targetFormOption"
          :value="item.value"
          :label="item.label"
        />
        <template #label="{ label, value }">
          <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('DeleteDataOption.formDeleted') }}</span>
          <span v-else>{{ label }}</span>
        </template>
      </el-select>
    </el-form-item>
    <el-tabs v-model="activeTab" v-if="props.options.targetTableUID">
      <el-tab-pane :label="$t('DeleteDataOption.basicSetting')" name="baseSetting">
        <el-form-item class="filter-condition-form">
          <filter-condition-setting-item
            :filterRule="props.options.targetTableFilterRule"
            :tableUID="props.options.targetTableUID"
            ref="filterConditionRef"
            :targetTitle="$t('DeleteDataOption.targetFormField')"
            :hideAutoComputeField="true"
          />
        </el-form-item>
        <hr v-if="!!isSelectSubTable"/>
        <el-form-item
          class="data-source-form"
          v-if="!!isSelectSubTable"
        >
          <data-source-subform
            :primarySourceTable="props.options.primarySourceTable"
            ref="dataSourceSubFormRef"
          />
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane :label="$t('DeleteDataOption.operationPermission')" name="operationPermissions">
        <el-form-item>
          <el-checkbox
            v-model="triggerTargetProcess"
            :label="$t('DeleteDataOption.triggerTargetProcess')"
            :disabled="isCurrentFormTarget"
          />
        </el-form-item>
      </el-tab-pane>
    </el-tabs>
  </el-form>
</template>

<script lang='ts' setup>
import { FormInstance } from 'element-plus'
import { computed, inject, ref } from 'vue'
import { EditDataOptions, ProcessFlowOptions } from '@common/types/project'
import { NOCODE, ORGANIZE_UTIL } from "@renderer/types"
import { useFormTable } from '../../hooks'
import { FormConditionValueType, LogicalOperator } from '@common/types/nocode'
import { unique } from '@common/utils/unique'
import i18next from 'i18next'
import { ProcessNode } from '../process'
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission'
import { getNocodeDataSourceTableByUID, getNocodeMainTableOptions } from '@common/utils/connection'

const nocode = inject(NOCODE)
const organizeUtil = inject(ORGANIZE_UTIL, null)
const table = useFormTable()
const filterConditionRef = ref(null)
const dataSourceSubFormRef = ref(null)
const activeTab = ref('baseSetting')

const currentTables = computed(() => {
  return nocode.value.body?.formData?.tables ?? []
})

const getTableSourceByUID = (targetTableUID?: string | null) => {
  return getNocodeDataSourceTableByUID(nocode.value?.body, targetTableUID || undefined, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)
}

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
  const targetSource = getTableSourceByUID(props.options.targetTableUID)
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

const targetFormOption = computed(() => {
  const tableAliasList = currentTables.value.map(item => {
    if (!canReadNocodeTableDataByBody(
      nocode.value.body,
      item.uid,
      organizeUtil?.departments || [],
    )) {
      return null
    }

    if (item.meta?.extra?.primaryTable) {
      const primaryTable = currentTables.value.find(t => t.uid === item.meta?.extra?.primaryTable?.[1])

      const field = primaryTable?.fields?.find(
        f => f.meta?.extra?.subTableUID?.[1] === item.uid
      )

      const pAlias = primaryTable?.alias ?? i18next.t('DeleteDataOption.unnamedTable')
      const fAlias = field?.alias ?? i18next.t('DeleteDataOption.unnamedTableField')

      if(!primaryTable || !field) {
        return null
      }
      
      return {
        ...item,
        alias: `${pAlias}.${fAlias}`
      }
    }
    return {
      ...item,
      alias: item.alias ?? i18next.t('DeleteDataOption.unnamedTable')
    }
  }).filter(Boolean)

  const currentSubTableItems = (table.value.fields || []).reduce((acc, field) => {
    const subTableUID = field.meta?.extra?.subTableUID?.[1]
    if (!subTableUID) {
      return acc
    }

    const subTable = currentTables.value.find(item => item.uid === subTableUID)
    if (!subTable) {
      return acc
    }

    acc.push({
      label: `${i18next.t('DeleteDataOption.currentForm')}.${field.alias ?? i18next.t('DeleteDataOption.unnamedTableField')}`,
      value: subTable.uid,
    })
    return acc
  }, [] as { label: string, value: string }[])

  const currentSubTableUIDs = new Set(currentSubTableItems.map(item => item.value))
  const otherOptions = tableAliasList
    .filter(item => item.uid !== table.value.uid && !currentSubTableUIDs.has(item.uid))
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
      label: i18next.t('DeleteDataOption.currentForm'),
      value: table.value.uid,
    },
    ...currentSubTableItems,
    ...otherOptions,
    ...crossAppOptions,
  ]
})

const props = defineProps<{
  node: ProcessNode,
  options: ProcessFlowOptions & EditDataOptions,
}>();

const createPrimarySourceTable = (targetTableUID?: string) => {
  const targetTable = getTableSourceByUID(targetTableUID)?.table
  if (!targetTable?.meta?.extra?.primaryTable) {
    return null
  }

  const primaryUID = targetTable.meta?.extra?.primaryTable?.[1]
  const primaryTable = getTableSourceByUID(primaryUID)?.table
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
      conditions: [{
        uid: null,
        func: null,
        value: null,
        type: FormConditionValueType.FORM,
      }]
    },
  }
}

const rules = {
  targetTableUID: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('DeleteDataOption.selectForm'))),
    trigger: 'change'
  }]
}

const changeTargetTable = () => {
  props.options.triggerTargetProcess = !isCurrentFormTarget.value
  props.options.targetTableFilterRule = {
    conditions: [],
    logic: props.options.targetTableFilterRule?.logic || LogicalOperator.AND
  }
  props.options.primarySourceTable = createPrimarySourceTable(props.options.targetTableUID)
}

const isSelectSubTable = computed(() => {
  const targetTable = getTableSourceByUID(props.options.targetTableUID)?.table
  const isSelectSubTable = !!targetTable?.meta?.extra?.primaryTable
  if(isSelectSubTable && !props.options.primarySourceTable) {
    props.options.primarySourceTable = createPrimarySourceTable(props.options.targetTableUID)
  }
  return isSelectSubTable
})

const formRef = ref<FormInstance>();
const save = async () => {
  const valid1 = formRef.value
    ? await new Promise((resolve) => {
      formRef.value?.validate((isValid) => {
        isValid ? resolve(true) : resolve(false)
      })
    })
    : true
  const valid2 =await filterConditionRef.value?.validate()
  const valid3 = dataSourceSubFormRef.value ? await dataSourceSubFormRef.value?.validate() : true
  
  return valid1 && valid2 && valid3
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.delete-data-option {
  width: 100%;
  height: 100%;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  .warning {
    font-size: 14px;
    width: 100%;
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 4px;

    span {
      line-height: 22px;
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

    &.filter-condition-form {
      .el-form-item__content {
        display: block;
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
}
</style>
