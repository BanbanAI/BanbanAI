<template>
  <el-form class="data-change-option" :model="options" :rules="rules" ref="formRef">
    <div class="warning">
      <el-icon size="16"><Warning /></el-icon>
      <span>{{ $t('DataChangeOption.triggerConditionDesc') }}</span>
    </div>
    <option-item :title="$t('DataChangeOption.changeType')">
      <el-form-item prop="changeType">
        <el-checkbox-group class="data-change-checkbox-group" v-model="(props.options.changeType as any)">
          <el-checkbox v-for="item in DataChangeType" :key="item" :value="item">{{ textMapping[item] }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-tabs v-model="currentTab">
        <el-tab-pane :label="$t('DataChangeOption.formPermission')" :name="FormPermissions">
          <field-auth-option
            :requiredValue="props.options.requiredFieldAuth"
            @update:requiredValue="value => props.options.requiredFieldAuth = value"
          ></field-auth-option>
        </el-tab-pane>
        <el-tab-pane :label="$t('DataChangeOption.operationPermission')" name="operationPermissions">
          <div class="operation-permission">
            <el-form-item>
              <el-checkbox v-model="props.options.allowCancel" :label="$t('NodeOptionDrawer.allowCancel')"/>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="props.options.allowStash" :label="$t('DataChangeOption.allowStash')"/>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="props.options.allowFinishFlow" :label="$t('DataChangeOption.allowFinishFlow')"/>
            </el-form-item>
            <cross-table-execution-mode-option :options="props.options" :show-wait-option="true" />
          </div>
        </el-tab-pane>
        <el-tab-pane :label="$t('DataChangeOption.triggerCondition')" :name="TriggerConditions" @click="handleClickTab">
          <div class="trigger-condition-switch">
            <span>{{ $t('DataChangeOption.enableTriggerConditions') }}</span>
            <el-switch v-model="triggerConditionsEnabled" size="small" />
          </div>
          <template v-if="triggerConditionsEnabled">
            <data-source-form
              :sourceTables="props.options.sourceTables"
              ref="dataSourceFormRef"
            />
            <condition-item
              :node="props.node"
              :options="props.options"
              :allowEmptyCondition="true"
              :customTitle="$t('DataChangeOption.conditionTitle')"
              ref="conditionItemRef"
            >
              <template #condition-type-options>
                <el-option :label="$t('DataChangeOption.field')+''" :value="FormConditionValueType.FORM"/>
                <el-option :label="$t('DataChangeOption.formulaEdit')+''" :value="FormConditionValueType.FORMULA"/>
              </template>
            </condition-item>
          </template>
        </el-tab-pane>
      </el-tabs>
    </option-item>
  </el-form>
</template>

<script lang='ts' setup>
import { DataChangeType, DataChangeOptions, ProcessFlowOptions, isDataChangeTriggerConditionsEnabled } from '@common/types/project';
import { FormInstance, FormRules } from 'element-plus';
import { computed, ref, reactive } from 'vue';
import { FormConditionValueType } from '@common/types/nocode';
import i18next from 'i18next';
import { ProcessNode } from '../process';
import { Warning } from '@element-plus/icons-vue';

const props = defineProps<{
  node: ProcessNode,
  options: DataChangeOptions & ProcessFlowOptions,
}>();
const textMapping = {
  get [DataChangeType.ADD]() { return i18next.t('DataChangeOption.addNew') },
  get [DataChangeType.EDIT]() { return i18next.t('DataChangeOption.edit') },
  get [DataChangeType.DELETE]() { return i18next.t('DataChangeOption.delete') }
}
const formRef = ref<FormInstance>();
const conditionItemRef = ref();
const dataSourceFormRef = ref();
const FormPermissions = 'formPermissions';
const TriggerConditions = 'triggerConditions';
const currentTab = ref(FormPermissions);
const ensureSourceTablesInitialized = () => {
  if(!props.options.sourceTables?.length) {
    props.options.sourceTables = []
  }
}
const triggerConditionsEnabled = computed({
  get: () => isDataChangeTriggerConditionsEnabled(props.options),
  set: (value: boolean) => {
    props.options.enableTriggerConditions = value
    if (value) {
      ensureSourceTablesInitialized()
    }
  },
})

const handleClickTab = () => {
  if (triggerConditionsEnabled.value) {
    ensureSourceTablesInitialized()
  }
}

const validateChangeType = (rule: any, value: string[], callback: any) => {
  if (!value?.length) {
    callback(new Error(i18next.t('DataChangeOption.setChangeType')))
  }
  callback()
}
const rules = reactive<FormRules<DataChangeOptions>>({
  changeType: [{ validator: validateChangeType, trigger: 'blur' }]
})
const save = async () => {
  const validDataSource = triggerConditionsEnabled.value
    ? (await dataSourceFormRef.value?.validate?.()) ?? true
    : true
  const validCondition = triggerConditionsEnabled.value
    ? (await conditionItemRef.value?.validate?.()) ?? true
    : true
  return new Promise((resolve, reject) => {
    formRef.value?.validate((isValid) => {
      if (isValid && validDataSource && validCondition) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.data-change-option {
  width: 100%;
  height: 100%;
  padding: 12px;

  .warning {
    font-size: 14px;
    margin-bottom: 24px;
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
  }

  .data-change-checkbox-group {
    --el-checkbox-height: 20px;
  }

  .trigger-condition-switch {
    display: flex;
    align-items: center;
    font-size: 14px;
    gap: 24px;
    padding: 7px 0px;
    margin-top: 9px;
  }

  .operation-permission {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-form-item {
      margin-bottom: 0;
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
  }
}
</style>
