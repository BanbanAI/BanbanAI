<template>
  <el-scrollbar class="branch-setting-option">
    <div class="tips">
      <div class="header-left" v-if="!props.isParallel">{{ $t('BranchSettingItem.branchConditionTip') }}</div>
      <div class="header-left" v-else>
        <el-icon>
          <i-ep-warning/>
        </el-icon>
        {{ $t('BranchSettingItem.branchConditionDesc') }}
      </div>
      <!--TODO: 跳转到对应地址 -->
      <router-link
        to="/"
        class="header-right" v-if="false && !props.isParallel"
      >
        {{ $t('BranchSettingItem.howToSetCondition') }}
      </router-link>
    </div>

    <data-source-form
      :sourceTables="sourceTables"
      ref="dataSourceFormRef"
      :helpText="$t('BranchSettingItem.conditionFieldSource')"
    />

    <condition-item
      :node="props.node"
      :options="props.options"
      :allowEmptyCondition="props.isParallel"
      ref="conditionItemRef"
    >
      <template #condition-type-options>
        <el-option :label="$t('ConditionItem.field')" :value="FormConditionValueType.FORM"/>
        <el-option :label="$t('ConditionItem.formulaEdit')" :value="FormConditionValueType.FORMULA"/>
        <el-option :label="$t('ConditionItem.node')" :value="FormConditionValueType.NODE"/>
        <el-option :label="$t('ConditionItem.filterRowCount')" :value="FormConditionValueType.FILTER_ROW"/>
      </template>
    </condition-item>
  </el-scrollbar>
</template>

<script lang='ts' setup>
import { ConditionBranchOptions } from '@common/types/project';
import { FormConditionValueType } from '@common/types/nocode';
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { useFormFields } from '../../../hooks';
import { isSystemField } from '@common/utils';
import { formElementInstances } from "@renderer/utils/instance";
import { ProcessNode } from '../../process';

const formFields = useFormFields();

const props = defineProps<{
  node: ProcessNode,
  options: ConditionBranchOptions,
  isParallel: boolean,
}>();

const conditionItemRef = ref(null)
const dataSourceFormRef = ref(null)

watch(() => props.options.conditions, (value) => {
  if(!value) {
    props.options.conditions = []
  }
},{ immediate: true, deep: true })

const conditionFuncInfoMap = reactive(new Map())

const getFuncInfoByType = async (type) => {
  return await (await formElementInstances.getInstance(type)).getConfigurations().funcInfo
}

const sourceTables = computed(() => {
  if(!props.options.sourceTables) {
    props.options.sourceTables = []
  }
  return props.options.sourceTables
})

const initConditionFuncInfoMap = async (formFields) => {
  for (const field of formFields) {
    if (isSystemField(field)) continue
    const funcInfo = await getFuncInfoByType(field.meta?.extra?.widgetType)
    conditionFuncInfoMap.set(field.uid, funcInfo)
  }
}

onMounted(async () => {
  await initConditionFuncInfoMap(formFields.value)
})

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

const save = async () => {
  const valid = await dataSourceFormRef.value?.validate()
  const validCondition = await conditionItemRef.value?.validate()
  return valid && validCondition
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.branch-setting-option {
  width: 100%;
  height: 100%;
  padding: 12px;

  .tips {
    display: flex;

    font-weight: 400;

    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    text-align: right;
    margin-bottom: 16px;

    .header-left {
      color: var(--text-color-secondary);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .header-right {
      margin-left: auto;
      color: var(--color-primary);
      cursor: pointer;
    }
  }

  .add-group-button {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    height: 32px;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    color: var(--text-color-regular);

    .el-icon {
      margin-right: 4px;
      font-size: 16px;
      padding-top: 2px;
    }
  }
}
</style>
