<template>
  <el-form
    class="edit-data-option"
    ref="formRef"
    :model="options"
    :rules="rules"
  >
    <div class="warning is-danger">
      <span>{{ $t('EditDataOption.dataPermissionWarning') }}</span>
    </div>
    <div class="warning">
      <el-icon size="16"><i-ep-warning /></el-icon>
      <span>{{ $t('EditDataOption.triggerConditionDesc') }}</span>
    </div>
    <el-form-item class="target-form" prop="targetTableUID">
      <div class="target-form-title">
        <span style="color: #f56c6c; font-size: 16px;">
          *
        </span>
        {{ $t('EditDataOption.targetForm') }}
      </div>
      <el-select
        :placeholder="$t('EditDataOption.selectForm')"
        v-model="targetFormSelectValue"
        :no-data-text="$t('EditDataOption.noForm')"
        filterable
      >
        <el-option
          v-for="item in targetFormOption"
          :key="item.value"
          :value="item.value"
          :label="item.label"
        />
        <template #label="{ label, value }">
          <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('EditDataOption.formDeleted') }}</span>
          <span v-else>{{ label }}</span>
        </template>
      </el-select>
    </el-form-item>
    <el-tabs v-model="activeTab" v-if="props.options.targetTableUID">
      <el-tab-pane :label="$t('EditDataOption.basicSetting')" name="baseSetting">
        <el-form-item class="filter-condition-form">
          <filter-condition-setting-item
            ref="filterConditionRef"
            :filterRule="props.options.targetTableFilterRule"
            :tableUID="props.options.targetTableUID"
            :targetTitle="$t('EditDataOption.targetFormField')"
            :isRequired="isTargetFilterRequired"
            :disableAddCondition="shouldDisableMainTableAddCondition"
          />
        </el-form-item>
        <hr />
        <el-form-item class="data-source-form">
          <data-source-form
            :sourceTables="props.options.sourceTables"
            ref="dataSourceFormRef"
            :targetFields="props.options.targetFields"
            :defaultFormInfo="defaultFormInfo"
            :disableAddCondition="shouldDisableMainTableAddCondition"
          >
            <template #default-header-extra="{ index }">
              <div
                v-if="index === 0 && currentSubTableItems.length > 0"
                :class="['current-subtable-filter-add-button', { disabled: isCurrentSubTableFilterAddDisabled }]"
                :title="isCurrentSubTableFilterAddDisabled ? $t('EditDataOption.currentSubTableFilterAddDisabledTip') : ''"
                @click="addCurrentSubTableFilter"
              >
                <el-icon>
                  <i-ep-plus/>
                </el-icon>
                <span>{{ $t('EditDataOption.addCurrentSubTableFilter') }}</span>
              </div>
            </template>
            <template #after-default-item="{ index }">
              <div
                v-if="index === 0 && normalizedCurrentSubTableFilters.length"
                class="current-subtable-filter-list"
              >
                <current-sub-table-filter
                  v-for="(filter, filterIndex) in normalizedCurrentSubTableFilters"
                  :key="`${filter.fieldUID || 'empty'}_${filterIndex}`"
                  ref="currentSubTableFilterRef"
                  :filter="filter"
                  :options="getCurrentSubTableFilterOptions(filterIndex)"
                  :currentFields="currentSubTableFilterCurrentFields"
                  @remove="removeCurrentSubTableFilter(filterIndex)"
                />
              </div>
            </template>
          </data-source-form>
        </el-form-item>
        <hr />
        <el-form-item
          class="data-source-form"
          v-if="!!isSelectSubTable"
        >
          <data-source-subform
            :primarySourceTable="props.options.primarySourceTable"
            ref="dataSourceSubFormRef"
            :disableAddCondition="shouldDisableSubTablePrimaryAddCondition"
          />
        </el-form-item>
        <hr v-if="!!isSelectSubTable"/>
        <el-form-item class="target-form-field">
          <target-form-field
            :tableUID="props.options.targetTableUID"
            :targetFields="props.options.targetFields"
            :defaultTables="defaultTables"
            :sourceTables="props.options.sourceTables"
            :pluginFields="lastPluginNodeFields"
            :allowDataOwnerField="true"
            :table="table"
            mode="edit"
            ref="targetFormFieldRef"
            @update="updateTargetFields"
          />
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane :label="$t('EditDataOption.operationPermission')" name="operationPermissions">
        <el-form-item>
          <div class="form-permission-setting">
            <div class="permission-label">{{ $t('EditDataOption.formPermission') }}</div>
            <div class="permission-control">
              <el-checkbox
                v-model="props.options.allowLinkageFill"
                :label="$t('EditDataOption.allowLinkageFill')"
              />
              <el-tooltip :content="$t('EditDataOption.allowLinkageFillTip')" placement="top">
                <el-icon class="permission-tip"><i-ep-question-filled /></el-icon>
              </el-tooltip>
            </div>
          </div>
        </el-form-item>
        <el-form-item>
          <el-checkbox
            v-model="triggerTargetProcess"
            :label="$t('EditDataOption.triggerTargetProcess')"
            :disabled="isCurrentFormTarget"
          />
        </el-form-item>
      </el-tab-pane>
    </el-tabs>
  </el-form>
</template>

<script lang='ts' setup>
import { ElMessage, FormInstance } from 'element-plus'
import { computed, inject, ref, watch } from 'vue'
import {
  EditDataTargetScope,
  TargetFieldFillType,
  getProcessTargetSourceUID
} from '@common/types/project'
import type {
  CurrentSubTableFilter as CurrentSubTableFilterValue,
  EditDataOptions,
  Field,
  ProcessFlowOptions,
  Table,
} from '@common/types/project'
import { NOCODE, ORGANIZE_UTIL } from "@renderer/types"
import { useFormTable } from '../../hooks'
import { FormConditionValueType, LogicalOperator } from '@common/types/nocode'
import { deepClone } from '@common/utils/object'
import { isEqual } from 'lodash'
import { unique } from '@common/utils/unique'
import i18next from 'i18next'
import { ProcessNode } from '../process'
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission'
import { getNocodeDataSourceTableByUID, getNocodeMainTableOptions } from '@common/utils/connection'

const TARGET_FORM_SCOPE_SEPARATOR = "__scope__"

type TargetFormSelectOption = {
  label: string,
  value: string,
}

const props = defineProps<{
  node: ProcessNode,
  options: ProcessFlowOptions & EditDataOptions,
}>();

const nocode = inject(NOCODE)
const organizeUtil = inject(ORGANIZE_UTIL, null)
const table = useFormTable()
const dataSourceFormRef = ref(null)
const dataSourceSubFormRef = ref(null)
const currentSubTableFilterRef = ref<any>(null)
const targetFormFieldRef = ref(null)
const filterConditionRef = ref(null)
const formRef = ref<FormInstance>();
const activeTab = ref('baseSetting')

const historyDataLabel = () => i18next.t('EditDataOption.historyData')
const getScopeLabel = (scope: EditDataTargetScope) => {
  return scope === EditDataTargetScope.CURRENT
    ? i18next.t('EditDataOption.thisData')
    : historyDataLabel()
}

const currentTables = computed(() => {
  return nocode.value.body?.formData?.tables ?? []
})

const getTableSourceByUID = (tableUID?: string | null) => {
  return getNocodeDataSourceTableByUID(nocode.value?.body, tableUID || undefined, {
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

const targetTableSource = computed(() => {
  return getTableSourceByUID(props.options.targetTableUID)
})

const targetTable = computed(() => {
  return targetTableSource.value?.table
})

const isCrossAppTarget = computed(() => {
  const targetNocodeId = targetTableSource.value?.connection?.nocodeId
  return !!targetNocodeId && targetNocodeId !== nocode.value?.meta?.id
})

const targetTableScope = computed(() => {
  return !isCrossAppTarget.value && props.options.targetTableDataScope === EditDataTargetScope.CURRENT
    ? EditDataTargetScope.CURRENT
    : EditDataTargetScope.HISTORY
})

const isCurrentDataTarget = computed(() => {
  return targetTableScope.value === EditDataTargetScope.CURRENT
})

const isTargetFilterRequired = computed(() => {
  return targetTableScope.value === EditDataTargetScope.HISTORY
})

const shouldDisableAddCondition = computed(() => {
  return isCurrentDataTarget.value && props.options.targetTableUID === table.value.uid
})

const isSubTableTarget = computed(() => {
  return !!targetTable.value?.meta?.extra?.primaryTable
})

const shouldDisableMainTableAddCondition = computed(() => {
  return shouldDisableAddCondition.value
})

const isCurrentSubTableFilterAddDisabled = computed(() => {
  return availableCurrentSubTableItems.value.length === 0
})

const shouldDisableSubTablePrimaryAddCondition = computed(() => {
  return shouldDisableAddCondition.value || (isCurrentDataTarget.value && isSubTableTarget.value)
})

const getTargetFormSelectOptionValue = (
  tableUID?: string,
  scope: EditDataTargetScope = EditDataTargetScope.HISTORY,
) => {
  return tableUID ? `${tableUID}${TARGET_FORM_SCOPE_SEPARATOR}${scope}` : null
}

const parseTargetFormSelectOptionValue = (value?: string) => {
  if (!value) {
    return {
      tableUID: null,
      scope: EditDataTargetScope.HISTORY,
    }
  }

  const [tableUID, scope] = value.split(TARGET_FORM_SCOPE_SEPARATOR)
  return {
    tableUID,
    scope: scope === EditDataTargetScope.CURRENT ? EditDataTargetScope.CURRENT : EditDataTargetScope.HISTORY,
  }
}

const tableAliasList = computed<any[]>(() => {
  return currentTables.value.map(item => {
    if (!canReadNocodeTableDataByBody(
      nocode.value.body,
      item.uid,
      organizeUtil?.departments || [],
    )) {
      return null
    }

    if (item.meta?.extra?.primaryTable) {
      const primaryTable = currentTables.value.find(t => t.uid === item.meta?.extra?.primaryTable?.[1])
      const field = primaryTable?.fields?.find(f => f.meta?.extra?.subTableUID?.[1] === item.uid)

      if(!primaryTable || !field) {
        return null
      }

      const pAlias = primaryTable.alias ?? i18next.t('EditDataOption.unnamedTable')
      const fAlias = field.alias ?? i18next.t('EditDataOption.unnamedField')

      return {
        ...item,
        alias: `${pAlias}.${fAlias}`
      }
    }

    return {
      ...item,
      alias: item.alias ?? i18next.t('EditDataOption.unnamedTable')
    }
  }).filter(Boolean)
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
      fieldUID: field.uid,
      tableUID: subTable.uid,
      label: field.alias ?? subTable.alias ?? i18next.t('EditDataOption.unnamedField'),
    })
    return acc
  }, [] as { fieldUID: string, tableUID: string, label: string }[])
})

const normalizeCurrentSubTableFilter = (
  filter?: CurrentSubTableFilterValue | null,
): CurrentSubTableFilterValue | null => {
  if (!filter) {
    return null
  }
  const nextFilter = deepClone(filter)
  const matched = currentSubTableItems.value.find(item => item.fieldUID === nextFilter.fieldUID)
  const fieldUID = matched?.fieldUID ?? nextFilter.fieldUID
  const tableUID = matched?.tableUID ?? nextFilter.tableUID
  const conditions = nextFilter.filterRule?.conditions || []
  const logic = LogicalOperator.AND
  return {
    ...nextFilter,
    fieldUID,
    tableUID,
    filterRule: {
      logic,
      conditions,
    },
  }
}

const normalizeCurrentSubTableFilters = (
  filters?: Array<CurrentSubTableFilterValue | null | undefined> | null,
): CurrentSubTableFilterValue[] => {
  return (filters || [])
    .map(item => normalizeCurrentSubTableFilter(item))
    .filter((item): item is CurrentSubTableFilterValue => !!item)
}

const getCurrentSubTableFiltersFromOptions = (): CurrentSubTableFilterValue[] => {
  return normalizeCurrentSubTableFilters([
    ...(props.options.currentSubTableFilters || []),
    ...(props.options.currentSubTableFilter ? [props.options.currentSubTableFilter] : []),
  ])
}

const currentSubTableFiltersDraft = ref<CurrentSubTableFilterValue[]>([])

const resetCurrentSubTableFiltersDraft = () => {
  currentSubTableFiltersDraft.value = getCurrentSubTableFiltersFromOptions()
}

const clearCurrentSubTableFilters = () => {
  currentSubTableFiltersDraft.value = []
  props.options.currentSubTableFilters = []
  props.options.currentSubTableFilter = null
}

watch(
  [
    () => props.options.currentSubTableFilters,
    () => props.options.currentSubTableFilter,
  ],
  () => {
    resetCurrentSubTableFiltersDraft()
  },
  { immediate: true, deep: true },
)

const normalizedCurrentSubTableFilters = computed<CurrentSubTableFilterValue[]>(() => {
  return currentSubTableFiltersDraft.value
})

const selectedCurrentSubTableFieldUIDSet = computed(() => {
  return new Set(normalizedCurrentSubTableFilters.value.map(item => item.fieldUID).filter(Boolean))
})

const availableCurrentSubTableItems = computed(() => {
  return currentSubTableItems.value.filter(item => !selectedCurrentSubTableFieldUIDSet.value.has(item.fieldUID))
})

const targetFormOption = computed<TargetFormSelectOption[]>(() => {
  const currentTableUID = table.value.uid
  const currentSubTableUIDs = new Set(currentSubTableItems.value.map(item => item.tableUID))
  const otherOptions = tableAliasList.value
    .filter(item => item.uid !== currentTableUID && !currentSubTableUIDs.has(item.uid))
    .map(item => ({
      label: `${item.alias}-${getScopeLabel(EditDataTargetScope.HISTORY)}`,
      value: getTargetFormSelectOptionValue(item.uid),
    }))
  const crossAppOptions = getNocodeMainTableOptions(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }).filter(item => item.isCrossApp).map(item => ({
    label: `${item.label}-${getScopeLabel(EditDataTargetScope.HISTORY)}`,
    value: getTargetFormSelectOptionValue(item.value, EditDataTargetScope.HISTORY),
  }))

  return [
    {
      label: `${i18next.t('EditDataOption.currentForm')}-${getScopeLabel(EditDataTargetScope.CURRENT)}`,
      value: getTargetFormSelectOptionValue(currentTableUID, EditDataTargetScope.CURRENT),
    },
    ...currentSubTableItems.value.map(item => ({
      label: `${i18next.t('EditDataOption.currentForm')}.${item.label}-${getScopeLabel(EditDataTargetScope.CURRENT)}`,
      value: getTargetFormSelectOptionValue(item.tableUID, EditDataTargetScope.CURRENT),
    })),
    {
      label: `${i18next.t('EditDataOption.currentForm')}-${getScopeLabel(EditDataTargetScope.HISTORY)}`,
      value: getTargetFormSelectOptionValue(currentTableUID, EditDataTargetScope.HISTORY),
    },
    ...currentSubTableItems.value.map(item => ({
      label: `${i18next.t('EditDataOption.currentForm')}.${item.label}-${getScopeLabel(EditDataTargetScope.HISTORY)}`,
      value: getTargetFormSelectOptionValue(item.tableUID, EditDataTargetScope.HISTORY),
    })),
    ...otherOptions,
    ...crossAppOptions,
  ]
})

const createEmptyTargetFilterCondition = () => ({
  uid: null,
  func: null,
  value: null,
  type: FormConditionValueType.FORM,
})

const createTargetFilterRule = (
  scope: EditDataTargetScope = targetTableScope.value,
) => {
  return {
    conditions: scope === EditDataTargetScope.HISTORY
      ? [createEmptyTargetFilterCondition()]
      : [],
    logic: props.options.targetTableFilterRule?.logic || LogicalOperator.AND
  }
}

const createDefaultTargetFields = () => {
  return [{
    fieldUID: null,
    type: TargetFieldFillType.EMPTY,
    value: null
  }]
}

const createPrimarySourceTable = (targetTableUID?: string) => {
  const targetTable = getTableSourceByUID(targetTableUID)?.table
  if (!targetTable?.meta?.extra?.primaryTable) {
    return null
  }

  const primaryUID = targetTable.meta?.extra?.primaryTable?.[1]
  const primaryTable = getTableSourceByUID(primaryUID)?.table

  return {
    uid: unique(),
    name: primaryTable?.alias || targetTable.alias || i18next.t('EditDataOption.unnamedTable'),
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

const createCurrentSubTableFilter = (): CurrentSubTableFilterValue | null => {
  const [firstSubTable] = availableCurrentSubTableItems.value
  if (!firstSubTable) {
    return null
  }
  return {
    fieldUID: firstSubTable.fieldUID,
    tableUID: firstSubTable.tableUID,
    filterRule: {
      logic: LogicalOperator.AND,
      conditions: [],
    },
  }
}

const applyTargetTableChange = (
  prevTableUID?: string,
  prevScope: EditDataTargetScope = EditDataTargetScope.HISTORY,
  nextTableUID?: string,
  nextScope: EditDataTargetScope = EditDataTargetScope.HISTORY,
) => {
  const isTargetTableChanged = prevTableUID !== nextTableUID
  const isSwitchingToCurrentFormCurrentData = (
    prevScope !== nextScope
    && nextScope === EditDataTargetScope.CURRENT
    && nextTableUID === table.value.uid
  )

  const nextTargetSource = getTableSourceByUID(nextTableUID)
  const fixedScope = nextTargetSource?.connection?.nocodeId
    && nextTargetSource.connection.nocodeId !== nocode.value?.meta?.id
    ? EditDataTargetScope.HISTORY
    : nextScope
  props.options.targetTableUID = nextTableUID
  props.options.targetTableDataScope = fixedScope
  if (isTargetTableChanged || nextTableUID === table.value.uid) {
    props.options.triggerTargetProcess = !isCurrentFormTarget.value
  }
  if (isTargetTableChanged || isSwitchingToCurrentFormCurrentData) {
    clearCurrentSubTableFilters()
  }

  if (isTargetTableChanged) {
    props.options.targetTableFilterRule = createTargetFilterRule(fixedScope)
    props.options.targetFields = createDefaultTargetFields()
    props.options.primarySourceTable = createPrimarySourceTable(nextTableUID)
    return
  }

  if (prevScope !== fixedScope) {
    props.options.targetTableFilterRule = createTargetFilterRule(fixedScope)
  }

  if (!nextTableUID) {
    props.options.primarySourceTable = null
    return
  }

  const nextTargetTable = nextTargetSource?.table
  if (!nextTargetTable?.meta?.extra?.primaryTable) {
    props.options.primarySourceTable = null
  } else if (!props.options.primarySourceTable) {
    props.options.primarySourceTable = createPrimarySourceTable(nextTableUID)
  }
}

const ensureTargetTableDefaults = () => {
  if (!props.options.targetTableUID) {
    return
  }

  if (isCrossAppTarget.value) {
    props.options.targetTableDataScope = EditDataTargetScope.HISTORY
  }

  if (!props.options.targetTableFilterRule) {
    props.options.targetTableFilterRule = createTargetFilterRule()
  } else if (
    isTargetFilterRequired.value
    && !props.options.targetTableFilterRule.conditions?.length
  ) {
    props.options.targetTableFilterRule.conditions = [createEmptyTargetFilterCondition()]
  }
  if (!props.options.targetFields?.length) {
    props.options.targetFields = createDefaultTargetFields()
  }

  const currentTargetTable = targetTable.value
  if (!currentTargetTable?.meta?.extra?.primaryTable) {
    props.options.primarySourceTable = null
    return
  }
  if (!props.options.primarySourceTable) {
    props.options.primarySourceTable = createPrimarySourceTable(props.options.targetTableUID)
  }
}

ensureTargetTableDefaults()

const targetFormSelectValue = computed({
  get() {
    return getTargetFormSelectOptionValue(props.options.targetTableUID, targetTableScope.value)
  },
  set(value: string) {
    const prevTableUID = props.options.targetTableUID
    const prevScope = targetTableScope.value
    const { tableUID, scope } = parseTargetFormSelectOptionValue(value)
    applyTargetTableChange(prevTableUID, prevScope, tableUID, scope)
  }
})

const rules = {
  targetTableUID: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('EditDataOption.selectForm'))),
    trigger: 'change'
  }]
}

const defaultFormInfo = computed(() => {
  return [
    {
      title: i18next.t('EditDataOption.dataSourceFormDefault1'),
      tipContent: i18next.t('EditDataOption.formNotDeletableTip'),
      description: `${i18next.t('EditDataOption.currentForm')}-${i18next.t('EditDataOption.thisData')}`,
    },
    {
      title: i18next.t('EditDataOption.dataSourceFormDefault2'),
      tipContent: i18next.t('EditDataOption.formNotDeletableTip'),
      description: `${i18next.t('EditDataOption.targetForm')}-${getScopeLabel(targetTableScope.value)}`,
    }
  ]
})

const defaultTables = computed(() => {
  const targetTableUID = props.options.targetTableUID;
  const targetSourceUID = getProcessTargetSourceUID(targetTableUID, table.value.uid);
  return [
    {
      ...table.value,
      label: `${i18next.t('EditDataOption.currentForm')}-${i18next.t('EditDataOption.thisData')}`,
    },
    {
      label: `${i18next.t('EditDataOption.targetForm')}-${getScopeLabel(targetTableScope.value)}`,
      ...(targetTable.value || {}),
      uid: targetSourceUID,
    }
  ]
})

const createComparisonFields = (targetTable: Table | undefined, sourceUID: string, label: string): Field[] => {
  if (!targetTable?.fields?.length) {
    return []
  }
  return targetTable.fields.map(field => ({
    ...field,
    uid: `${sourceUID}.${field.uid}` as any,
    alias: `${label}.${field.alias ?? i18next.t('EditDataOption.unnamedField')}`,
  }))
}

const currentSubTableFilterCurrentFields = computed<Field[]>(() => {
  const targetTableUID = props.options.targetTableUID
  const targetTable = targetTableSource.value?.table
  const targetSourceUID = getProcessTargetSourceUID(targetTableUID, table.value.uid)
  return [
    ...createComparisonFields(targetTable, targetSourceUID, i18next.t('EditDataOption.targetForm')),
  ]
})

const updateTargetFields = (val) => {
  props.options.targetFields = val
}

const isSelectSubTable = computed(() => {
  const isSubTargetTable = !!targetTable.value?.meta?.extra?.primaryTable
  if (isSubTargetTable && !props.options.primarySourceTable) {
    props.options.primarySourceTable = createPrimarySourceTable(props.options.targetTableUID)
  }
  return isSubTargetTable
})

const addCurrentSubTableFilter = () => {
  if (isCurrentSubTableFilterAddDisabled.value) {
    return
  }
  const filter = createCurrentSubTableFilter()
  if (!filter) {
    return
  }
  currentSubTableFiltersDraft.value = [
    ...currentSubTableFiltersDraft.value,
    filter,
  ]
}

const removeCurrentSubTableFilter = (index: number) => {
  const filters = [...currentSubTableFiltersDraft.value]
  filters.splice(index, 1)
  currentSubTableFiltersDraft.value = filters
}

const getCurrentSubTableFilterOptions = (index: number) => {
  const currentFilter = normalizedCurrentSubTableFilters.value[index]
  const selectedSet = new Set(
    normalizedCurrentSubTableFilters.value
      .filter((_, filterIndex) => filterIndex !== index)
      .map(item => item.fieldUID)
      .filter(Boolean),
  )
  return currentSubTableItems.value.filter(item => {
    return item.fieldUID === currentFilter?.fieldUID || !selectedSet.has(item.fieldUID)
  })
}

const save = async () => {
  const nextCurrentSubTableFilters = normalizeCurrentSubTableFilters(currentSubTableFiltersDraft.value)
  const validCurrentSubTableFieldUIDSet = new Set(currentSubTableItems.value.map(item => item.fieldUID))
  if (nextCurrentSubTableFilters.some(item => item.fieldUID && !validCurrentSubTableFieldUIDSet.has(item.fieldUID))) {
    ElMessage.warning(i18next.t('CurrentSubTableFilter.subTableDeleted'))
    return false
  }
  const selectedFieldUIDs = nextCurrentSubTableFilters.map(item => item.fieldUID).filter(Boolean)
  if (new Set(selectedFieldUIDs).size !== selectedFieldUIDs.length) {
    ElMessage.warning(i18next.t('CurrentSubTableFilter.duplicateCurrentSubTable'))
    return false
  }
  const valid1 = formRef.value
    ? await new Promise((resolve) => {
      formRef.value?.validate((isValid) => {
        isValid ? resolve(true) : resolve(false)
      })
    })
    : true
  const valid2 = await dataSourceFormRef.value?.validate()
  const valid3 = await targetFormFieldRef.value?.validate()
  const valid4 = await filterConditionRef.value?.validate()
  const valid5 = dataSourceSubFormRef.value ? await dataSourceSubFormRef.value?.validate() : true
  const currentSubTableFilterRefs = Array.isArray(currentSubTableFilterRef.value)
    ? currentSubTableFilterRef.value
    : (currentSubTableFilterRef.value ? [currentSubTableFilterRef.value] : [])
  const currentSubTableFilterResults = await Promise.all(
    currentSubTableFilterRefs.map(item => item?.validate?.() ?? true)
  )
  const valid6 = currentSubTableFilterResults.every(Boolean)

  const isValid = valid1 && valid2 && valid3 && valid4 && valid5 && valid6
  if (!isValid) {
    return false
  }

  props.options.currentSubTableFilters = nextCurrentSubTableFilters
  props.options.currentSubTableFilter = null

  return true
}

const hasPendingChanges = () => {
  return !isEqual(
    normalizeCurrentSubTableFilters(currentSubTableFiltersDraft.value),
    getCurrentSubTableFiltersFromOptions(),
  )
}

defineExpose({
  save,
  hasPendingChanges,
})
</script>

<style lang='scss' scoped>
.edit-data-option {
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

  .current-subtable-filter-add-button {
    color: var(--color-primary);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;

    &.disabled {
      color: var(--text-color-secondary);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .el-icon {
      font-size: 16px;
    }

    span {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
    }
  }

  .current-subtable-filter-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
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
