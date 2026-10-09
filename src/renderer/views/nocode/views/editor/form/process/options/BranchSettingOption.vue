<template>
  <branch-setting-item
    :node="node"
    :options="options"
    :isParallel="parentNodeType === ProcessNodeType.PARALLEL_BRANCH"
    ref="branchSettingItemRef"
  />
</template>

<script lang='ts' setup>
import { ConditionBranchOptions, ProcessNodeType } from '@common/types/project';
import { computed, ref } from 'vue';
import { ProcessNode } from '../process';

const props = defineProps<{
  node: ProcessNode,
  options: ConditionBranchOptions,
}>();

const parentNodeType = computed(() => {
  const parentNode = props?.node?.parent
  return parentNode?.getOwner()?.getFlow()?.type || ProcessNodeType.CONDITION_BRANCH;
});

const branchSettingItemRef = ref(null)

const save = async () => {
  return await branchSettingItemRef.value?.save()
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>

</style>