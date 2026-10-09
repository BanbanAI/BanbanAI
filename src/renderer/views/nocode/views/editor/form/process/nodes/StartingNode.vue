<template>
  <div class="starting-node">
    <div class="node">{{ node.type === ProcessNodeType.START ? $t('StartingNode.start') : $t('StartingNode.end') }}</div>
  </div>
</template>

<script lang='ts' setup>
import { ProcessNodeType } from '@common/types/project';
import { ProcessNode } from '../process';

const props = defineProps<{
  node: ProcessNode;
}>();
</script>

<style lang='scss' scoped>
.starting-node {
  width: 72px;
  height: 40px;
  border-radius: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-color-page);
  box-shadow: 0px 8px 20px 0px #00000014;
}
</style>