<template>
  <div class="data-source-form">
    <div class="title">
      <span class="title-left">
        {{ title + ' (' + $t('DataSourceSubform.emptyFilterTip') + ')' }}
      </span>
    </div>
    <div class="form-container">
      <div class="header">
        <span class="form-name">
          {{ primarySourceTable?.name }}
        </span>
        <div class="status-tag">
          {{ $t('DataSourceSubform.inUse') }}
        </div>
      </div>
      <el-form :rules="rules" :model="table" ref="formRef" class="body">
        <filter-condition-setting-item
          :filterRule="primarySourceTable.filterRule"
          :tableUID="primarySourceTable.tableUID"
          ref="filterConditionSettingItemRef"
          :isRequired="!props.allowEmptyFilter"
          :isShowSubField="false"
          :targetTitle="$t('DataSourceSubform.mainFormDataSourceField')"
          :filterTitle="$t('DataSourceSubform.filterMainFormCondition')"
          :disableAddCondition="props.disableAddCondition"
          :disableConditionSetting="props.disableAddCondition"
        />
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  SourceTable,
  DefaultFormInfoItem,
} from '@common/types/project'
import { inject, ref } from 'vue'
import { NOCODE } from "@renderer/types"
import { useFormTable } from '../../../hooks'
import { FormInstance } from 'element-plus'
import { isEmpty } from "@common/utils/object";
import i18next from 'i18next'

const nocode = inject(NOCODE)
const table = useFormTable();
const formRef = ref<FormInstance>();
const filterConditionSettingItemRef = ref()

const props = withDefaults(defineProps<{
  helpText: string,
  title?: string,
  defaultFormInfo?: DefaultFormInfoItem[],
  primarySourceTable: SourceTable,
  disableAddCondition?: boolean,
  allowEmptyFilter?: boolean,
}>(), {
  targetFields: () => [], // 默认值
  sourceTables: () => [],
  defaultFormInfo: () => [
    {
      title: i18next.t('DataSourceSubform.dataSourceFormDefault'),
      tipContent: i18next.t('DataSourceSubform.formNotDeletableTip'),
      description: i18next.t('DataSourceSubform.currentFormThisData'),
    }
  ],
  helpText: () => i18next.t('DataSourceSubform.formFieldSourceTip'),
  title: () => i18next.t('DataSourceSubform.subformMainDataSourceForm'),
  disableAddCondition: false,
  allowEmptyFilter: false,
})

const rules = {
  tableUID: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t('DataSourceSubform.selectForm')))
        }
        callback()
      },
    }
  ],
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

      .el-icon {
        margin-left: auto;
        font-size: 16px;
        color: var(--text-color-secondary);
        cursor: pointer;
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
