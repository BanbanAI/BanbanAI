<template>
  <div class="add-branch-node">
    <div class="node">{{ node?.type === ProcessNodeType.CONDITION_BRANCH ? $t('AddBranchNode.addConditionBranch') : $t('AddBranchNode.addParallelBranch') }}</div>
  </div>
</template>

<script lang='ts' setup>
import { ProcessNodeType } from "@common/types/project";
import { ProcessNode } from "../process";

const props = defineProps<{
  node: ProcessNode;
}>();
</script>

<style lang='scss' scoped>
.add-branch-node {
  width: 104px;
  height: 32px;
  border-radius: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-color-page);
  color: var(--color-primary);
  box-shadow: 0px 8px 20px 0px #00000014;
  cursor: pointer;
}
</style>