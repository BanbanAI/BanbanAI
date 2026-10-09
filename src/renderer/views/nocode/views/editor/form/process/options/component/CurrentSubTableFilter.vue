<template>
  <div class="current-subtable-filter">
    <div class="title">
      <span class="title-left">
        {{ $t('CurrentSubTableFilter.title') }}
        <el-tooltip
          effect="light"
          :content="$t('CurrentSubTableFilter.tip')"
          placement="bottom"
        >
          <el-icon>
            <i-nocode-data-source-form-question/>
          </el-icon>
        </el-tooltip>
      </span>
      <el-icon class="delete-icon" @click="emit('remove')">
        <i-ep-delete/>
      </el-icon>
    </div>
    <el-form :model="filter" :rules="rules" ref="formRef" class="form-container">
      <div class="item">
        <span>{{ $t('CurrentSubTableFilter.currentSubTable') }}</span>
        <el-form-item prop="fieldUID">
          <el-select
            v-model="selectedFieldUID"
            :placeholder="$t('CurrentSubTableFilter.selectCurrentSubTable')"
            :no-data-text="$t('CurrentSubTableFilter.noCurrentSubTable')"
          >
            <el-option
              v-for="item in optionList"
              :key="item.fieldUID"
              :label="item.label"
              :value="item.fieldUID"
            />
            <template #label="{ label, value }">
              <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('CurrentSubTableFilter.subTableDeleted') }}</span>
              <span v-else>{{ label }}</span>
            </template>
          </el-select>
        </el-form-item>
      </div>
      <filter-condition-setting-item
        v-if="filter?.tableUID"
        :filterRule="filter.filterRule"
        :tableUID="filter.tableUID"
        :currentFields="currentFields"
        :targetTitle="$t('CurrentSubTableFilter.currentSubTableField')"
        :currentFieldTitle="$t('CurrentSubTableFilter.targetFieldOrCustom')"
        :formFieldTypeLabel="$t('EditDataOption.targetFormField')"
        :filterTitle="$t('CurrentSubTableFilter.filterCurrentSubTableCondition')"
        :disableAddCondition="props.disableAddCondition"
        :disableLogicSelect="true"
        :allowCurrentFormField="true"
        :allowFormulaValue="false"
        :useFieldSelect="true"
        :validateDeletedField="true"
        ref="filterConditionRef"
      />
    </el-form>
  </div>
</template>

<script setup lang="ts">
import type { Field, CurrentSubTableFilter, FieldUID, TableUID } from '@common/types/project'
import { LogicalOperator } from '@common/types/nocode'
import { ElMessage, FormInstance } from 'element-plus'
import { computed, ref, watch } from 'vue'
import i18next from 'i18next'

type CurrentSubTableOption = {
  fieldUID: FieldUID,
  tableUID: TableUID,
  label: string,
}

const props = withDefaults(defineProps<{
  filter: CurrentSubTableFilter,
  options: CurrentSubTableOption[],
  currentFields: Field[],
  disableAddCondition?: boolean,
}>(), {
  disableAddCondition: false,
})

const emit = defineEmits<{
  remove: []
}>()

const formRef = ref<FormInstance>()
const filterConditionRef = ref()

const createEmptyFilterRule = () => ({
  logic: LogicalOperator.AND,
  conditions: [],
})

const syncFilterRuleLogic = () => {
  props.filter.filterRule = props.filter.filterRule || createEmptyFilterRule()
  props.filter.filterRule.logic = LogicalOperator.AND
}

const syncSelectedSubTable = (fieldUID?: string | null) => {
  const target = props.options.find(item => item.fieldUID === fieldUID)
  if (!target) {
    syncFilterRuleLogic()
    return
  }
  props.filter.fieldUID = target.fieldUID
  props.filter.tableUID = target.tableUID
  syncFilterRuleLogic()
}

const ensureFilterDefaults = () => {
  if (props.filter?.fieldUID) {
    syncSelectedSubTable(props.filter.fieldUID)
    return
  }
  const target = props.options[0]
  if (!target) {
    syncFilterRuleLogic()
    return
  }
  props.filter.fieldUID = target.fieldUID
  props.filter.tableUID = target.tableUID
  syncFilterRuleLogic()
}

watch(
  () => props.options,
  (value) => {
    if (!Array.isArray(value) || value.length === 0) {
      return
    }
    ensureFilterDefaults()
  },
  { deep: true, immediate: true },
)

const optionList = computed<CurrentSubTableOption[]>(() => {
  const options = props.options || []
  const currentFieldUID = props.filter?.fieldUID
  if (!currentFieldUID || options.some(item => item.fieldUID === currentFieldUID)) {
    return options
  }
  return [
    ...options,
    {
      fieldUID: currentFieldUID as FieldUID,
      tableUID: props.filter?.tableUID as TableUID,
      label: currentFieldUID,
    },
  ]
})

const selectedFieldUID = computed({
  get() {
    return props.filter?.fieldUID
  },
  set(value: string) {
    const prevFieldUID = props.filter?.fieldUID
    syncSelectedSubTable(value)
    if (prevFieldUID && prevFieldUID !== value) {
      props.filter.filterRule = createEmptyFilterRule()
    }
  }
})

const rules = {
  fieldUID: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback(new Error(i18next.t('CurrentSubTableFilter.selectCurrentSubTable')))
        }
        callback()
      },
    }
  ],
}

const validate = async () => {
  let formValid = true
  if (formRef.value?.validate) {
    formValid = await new Promise<boolean>((resolve) => {
      formRef.value?.validate((valid) => resolve(valid))
    })
  }
  if (!props.options.some(item => item.fieldUID === props.filter?.fieldUID)) {
    ElMessage.warning(i18next.t('CurrentSubTableFilter.subTableDeleted'))
    return false
  }
  if (!props.filter?.filterRule?.conditions?.length) {
    ElMessage.warning(i18next.t('CurrentSubTableFilter.conditionRequired'))
    return false
  }
  const filterValid = filterConditionRef.value?.validate
    ? await filterConditionRef.value.validate()
    : true
  return formValid && filterValid
}

defineExpose({
  validate,
})
</script>

<style scoped lang="scss">
.current-subtable-filter {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;

  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title-left {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
    }

    .el-icon {
      color: var(--text-color-secondary);
      font-size: 16px;
      cursor: pointer;
    }

    .delete-icon {
      color: var(--text-color-secondary);
      cursor: pointer;
    }
  }

  .form-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 8px;

    span {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
    }

    :deep(.el-form-item) {
      margin-bottom: 0;
    }

    :deep(.el-select) {
      .el-select__wrapper {
        box-shadow: none;
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
      }
    }
  }
}
</style>
