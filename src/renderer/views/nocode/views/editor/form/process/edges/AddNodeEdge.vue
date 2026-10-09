<template>
  <g>
    <foreignObject :width="32" :height="32">
      <div class="node-add-container">
        <div class="icon-wrapper">
          <el-icon :size="20" color="var(--color-primary)">
            <i-ven-plus></i-ven-plus>
          </el-icon>
        </div>
      </div>
    </foreignObject>
  </g>
</template>

<script lang='ts' setup>
import { ProcessNode } from '../process';

defineProps<{
  node?: ProcessNode | null,
}>();

// const x = computed(() => {
//   return props.node.sourceX - 16;

// })
// const y = computed(() => {
//   return props.node.targetY - (props.node.targetY - props.node.sourceY) / 2 - 16

// })
</script>

<style lang='scss' scoped>
.node-add-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  .icon-wrapper {
    width: 24px;
    height: 24px;
    background-color: var(--bg-color-page);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all !important;

    &:hover {
      transform: scale(1.333333);
    }
  }
}
</style>
