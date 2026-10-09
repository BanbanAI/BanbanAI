<template>
  <div class="data-source-form">
    <div class="title">
      <span class="title-left">
        {{ title }}
        <el-tooltip
          class="box-item"
          effect="light"
          :content="props.helpText"
          placement="bottom"
        >
          <el-icon>
            <i-nocode-data-source-form-question/>
          </el-icon>
        </el-tooltip>
      </span>
      <div class="add-button" @click="addTable">
        <el-icon>
          <i-ep-plus></i-ep-plus>
        </el-icon>
        <span>{{ $t('DataSourceForm.addForm') }}</span>
      </div>
    </div>
    <div class="default-form-container" v-for="(item, index) in defaultFormInfo" :key="item.title">
      <div class="header">
        <div class="header-left">
          <span>
            {{ item.title }}
          </span>
          <el-tooltip
            class="box-item"
            effect="light"
            :content="item.tipContent"
            placement="bottom"
          >
            <el-icon>
              <i-nocode-data-source-form-question/>
            </el-icon>
          </el-tooltip>
        </div>
        <div class="header-extra">
          <slot name="default-header-extra" :item="item" :index="index" />
        </div>
      </div>
      <div class="body">
        <span>
          {{ item.description }}
        </span>
      </div>
      <slot name="after-default-item" :item="item" :index="index" />
    </div>
    <div class="form-container" v-for="(table, index) in props.sourceTables">
      <div class="header">
        <span v-if="!localTables[index].isEditing" class="form-name">
          {{ table.alias || table.name }}
          <el-icon class="edit-pen" @click="startEdit(index, table)">
            <i-nocode-flow-edit-pen/>
          </el-icon>
        </span>
        <el-input
          style="width: 100px;"
          v-model="editName"
          @blur="finishEdit(index, table)"
          @keydown.enter="finishEdit(index, table)"
          maxlength="30"
          clearable
          v-else
        />
        <div class="status-tag" v-if="isUsing(table.uid)">
          {{ $t('DataSourceForm.inUse') }}
        </div>
        <el-icon class="delete" @click="deleteTable(index)" v-else>
          <i-ep-delete/>
        </el-icon>
      </div>
      <el-form :rules="rules" :model="table" ref="formRef" class="body">
        <div class="item">
          <span>
            {{ $t('DataSourceForm.dataSourceForm') }}
          </span>
          <el-form-item prop="tableUID">
            <el-select 
              :placeholder="$t('DataSourceForm.selectForm')"
              :model-value="getSourceTableSelectValue(table)"
              :no-data-text="$t('DataSourceForm.noForm')"
              @change="(value) => syncTable(index, table, value)"
              filterable
            >
              <el-option
                v-for="item in allFormOptions"
                :value="getFormOptionValue(item)"
                :label="item.label"
              />
              <template #label="{ label, value }">
                <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('DataSourceForm.formDeleted') }}</span>
                <span v-else>{{ label }}</span>
              </template>
            </el-select>
          </el-form-item>
        </div>
        <filter-condition-setting-item
          :filterRule="table.filterRule"
          :tableUID="table.tableUID"
          :disableAddCondition="props.disableAddCondition"
          ref="filterConditionSettingItemRef"
        />
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LogicalOperator } from '@common/types/nocode'
import { 
  SourceTable,
  TargetFieldFillRule,
  TargetFieldFillType,
  DefaultFormInfoItem,
  FieldUID,
  TableUID,
} from '@common/types/project'
import { computed, inject, ref, watch } from 'vue'
import { NOCODE, ORGANIZE_UTIL } from "@renderer/types"
import { useFormTable } from '../../../hooks'
import { ElMessage, FormInstance } from 'element-plus'
import { unique } from "@common/utils/unique";
import { isEmpty } from "@common/utils/object";
import i18next from 'i18next'
import { getNocodeDataSourceConnections } from '@common/utils/connection';
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission'

const nocode = inject(NOCODE)
const organizeUtil = inject(ORGANIZE_UTIL, null)
const table = useFormTable();
const formRef = ref<FormInstance>();
const filterConditionSettingItemRef = ref()

const props = withDefaults(defineProps<{
  sourceTables: SourceTable[],
  targetFields: TargetFieldFillRule[],
  helpText: string,
  title?: string,
  defaultFormInfo?: DefaultFormInfoItem[],
  disableAddCondition?: boolean,
  currentSubformOptions?: Array<{
    fieldUID: FieldUID,
    tableUID: TableUID,
    label: string,
  }>,
}>(), {
  targetFields: () => [], // 默认值
  sourceTables: () => [],
  defaultFormInfo: () => [
    {
      title: i18next.t('DataSourceForm.dataSourceFormDefault'),
      tipContent: i18next.t('DataSourceForm.formNotDeletableTip'),
      description: i18next.t('DataSourceForm.currentFormThisData'),
    }
  ],
  helpText: () => i18next.t('DataSourceForm.formFieldSourceTip'),
  title: () => i18next.t('DataSourceForm.dataSourceForm'),
  disableAddCondition: false,
  currentSubformOptions: () => [],
})

const localTables = ref(props.sourceTables.map((t) => ({isEditing: false })))

const rules = {
  tableUID: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t('DataSourceForm.selectForm')))
        }
        callback()
      },
    }
  ],
}

watch(() => {
  if(!props.sourceTables) {
    return 
  } else {
    return props.sourceTables?.length
  }
},
  () => {
    localTables.value = props.sourceTables.map((t) => ({isEditing: false }))
  },{deep: true}
)

const editName = ref('')

const startEdit = (index, table) => {
  editName.value = table.alias || table.name
  for(const item of localTables.value) {
    item.isEditing = false
  }
  localTables.value[index].isEditing = true
}

const finishEdit = (index, table) => {
  const tableName = table.alias || table.name
  if(editName.value.trim() != tableName) {
    if(checkName(editName.value)) {
      table.alias = editName.value
    }
  }
  for(const item of localTables.value) {
    item.isEditing = false
  }
  editName.value = ''
}

const checkName = (name) => {
  if(!name.trim()) {
    ElMessage.warning(i18next.t('DataSourceForm.nameNotEmpty'))
    return false
  }
  const nameList = props.sourceTables.map(item => item.name)
  if(nameList.includes(name.trim())) {
    ElMessage.warning(i18next.t('DataSourceForm.nameDuplicate'))
    return false
  }
  return true
}

const addTable = () => {
  props.sourceTables.push({
    uid: unique(),
    name: getNewTableName(),
    tableUID: null,
    filterRule: {
      logic: LogicalOperator.AND,
      conditions: []
    },
    sourceType: "table",
  })
}

const getNewTableName = (title = i18next.t('DataSourceForm.dataForm')) => {
  const nameList = props.sourceTables.map(item => item.alias || item.name)
  let index = 0
  while(true) {
    const newName = `${title}${index ? index : ''}`
    if(!nameList.includes(newName)) {
      return newName
    }
    index++
  }
}

const deleteTable = (index) => {
  props.sourceTables.splice(index,1)
}

const formOption = computed(() => {
  const sources = getNocodeDataSourceConnections(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  });
  const isMultipleSources = sources.length > 1;
  const departments = organizeUtil?.departments || [];

  return sources.flatMap(source => {
    return (source.tables || [])
      .filter(item => !item.meta?.extra?.primaryTable)
      .filter(item => canReadNocodeTableDataByBody(nocode.value?.body, item.uid, departments))
      .map(item => {
        return {
          label: isMultipleSources ? `${source.name || source.uid}.${item.alias}` : item.alias,
          value: item.uid,
          sourceType: "table" as const,
        }
      })
  })
})

const currentSubformFormOption = computed(() => {
  return (props.currentSubformOptions || []).map(item => ({
    label: `${i18next.t('DataSourceForm.currentFormSubform')}.${item.label}`,
    value: item.tableUID,
    sourceType: "current-subform" as const,
    currentSubTableFieldUID: item.fieldUID,
  }))
})

const allFormOptions = computed(() => {
  return [
    ...formOption.value,
    ...currentSubformFormOption.value,
  ]
})

const getFormOptionValue = (item: { sourceType?: "table" | "current-subform"; value: TableUID; currentSubTableFieldUID?: FieldUID }) => {
  return item.sourceType === "current-subform"
    ? `current-subform:${item.currentSubTableFieldUID}:${item.value}`
    : item.value
}

const getSourceTableSelectValue = (table: SourceTable) => {
  if (table.sourceType === "current-subform" && table.currentSubTableFieldUID) {
    return `current-subform:${table.currentSubTableFieldUID}:${table.tableUID}`
  }
  return table.tableUID
}

const syncTable = (index, table, rawValue) => {
  const matched = allFormOptions.value.find(item => getFormOptionValue(item) === rawValue)
  if (!matched) return;
  props.sourceTables[index].tableUID = matched?.value || table.tableUID;
  props.sourceTables[index].sourceType = matched?.sourceType || "table";
  props.sourceTables[index].currentSubTableFieldUID = matched?.sourceType === "current-subform"
    ? matched.currentSubTableFieldUID
    : undefined;
  const newName = matched?.label || table.name || ''
  table.name = getNewTableName(newName)
} 

const isUsing = (uid) => {
  const usingFields = props.targetFields
    .filter(item => item.type === TargetFieldFillType.FIELD)
    .map(item => (item.value ? item.value.split(".")[0] : ""))
  return usingFields.includes(uid)
}

const validate = async () => {
  // 先校验 filter-condition-setting-item
  let filterValid = true
  if (!filterConditionSettingItemRef.value) {
    filterValid = true
  } else if (Array.isArray(filterConditionSettingItemRef.value)) {
    const results = await Promise.all(
      filterConditionSettingItemRef.value.map(item =>
        item?.validate ? item.validate() : Promise.resolve(true)
      )
    )
    filterValid = results.every(Boolean)
  } else if (filterConditionSettingItemRef.value?.validate) {
    filterValid = await filterConditionSettingItemRef.value.validate()
  }

  // 再校验 formRef
  let formValid = true
  if (!formRef.value) {
    formValid = true
  } else if (Array.isArray(formRef.value)) {
    const results = await Promise.all(
      formRef.value.map(form =>
        new Promise(resolve => {
          form?.validate
            ? form.validate((valid) => resolve(valid))
            : resolve(true)
        })
      )
    )
    formValid = results.every(Boolean)
  } else if (formRef.value?.validate) {
    formValid = await new Promise(resolve => {
      formRef.value.validate((valid) => resolve(valid))
    })
  }

  return formValid && filterValid
}
defineExpose({
  validate,
})
</script>

<style scoped lang="scss">
.data-source-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .title {
    display: flex;

    .title-left {
      display: flex;
      align-items: center;
      gap: 4px;

      .el-icon {
        color: var(--text-color-secondary);
        font-size: 16px;
        cursor: pointer;
      }
    }

    span {
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
    }

    .add-button {
      margin-left: auto;
      color: var(--color-primary);
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;

      .el-icon {
        font-size: 16px;
      }

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }
    }
  }

  .default-form-container {
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    overflow: hidden;

    .header {
      background-color: var(--bg-color-overlay);
      display: flex;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--border-color);

      .header-left,
      .form-name {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }

      .el-icon {
        font-size: 16px;
        color: var(--text-color-secondary);
        cursor: pointer;
      }

      .header-extra {
        margin-left: auto;
        display: flex;
        align-items: center;
      }
    }

    .body {
      padding: 10px 8px;

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }
    }
  }

  .form-container {
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    overflow: hidden;

    .header {
      background-color: var(--bg-color-overlay);
      display: flex;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--border-color);

      .form-name {
        display: flex;
        align-items: center;
      }

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }

      .edit-pen {
        margin-left: 8px;
      }

      .status-tag {
        margin-left: auto;
        background-color: #52C41A;
        color: var(--color-white);
        padding: 2px 4px;
        border-radius: 2px;
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%;
      }

      .el-icon {
        font-size: 16px;
        cursor: pointer;
        color: var(--text-color-secondary);
      }

      .delete {
        margin-left: auto;
      }
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 8px 16px;

      .item {
        display: flex;
        flex-direction: column;
        gap: 8px;

        span {
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
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

    :deep(.el-form) {
      .el-form-item {
        margin-bottom: 0px;
      }
    }
  }
}
</style>
