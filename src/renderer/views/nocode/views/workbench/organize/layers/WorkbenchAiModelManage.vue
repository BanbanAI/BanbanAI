<template>
  <el-scrollbar class="workbench-ai-model-manage-layer">
    <workbench-ai-settings-panel />
  </el-scrollbar>
</template>

<style scoped lang="scss">
.workbench-ai-model-manage-layer {
  width: 100%;
  height: 100%;
  min-width: 0;

  :deep(.el-scrollbar__view) {
    height: 100%;
  }
}
</style>
