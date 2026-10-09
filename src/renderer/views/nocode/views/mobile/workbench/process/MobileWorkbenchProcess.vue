<template>
  <div class="workbench-process">
    <mobile-nocode-todo-box :isShowSearch="true"></mobile-nocode-todo-box>
  </div>
</template>

<script setup lang='ts'>
import { ORGANIZE_UTIL } from '@renderer/types';
import { ref, computed, provide } from 'vue';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
const organizeUtil = new OrganizeUtil();

provide(ORGANIZE_UTIL, organizeUtil);
</script>

<style scoped lang='scss'>
.workbench-process {
  width: 100%;
  height: 100%;
  background-color: #f5f5f7;

  :deep(.el-container) {
    width: 100%;
    height: 100%;

    .el-header {
      padding: 0 !important;
    }

    .workbench-organize-content {
      height: calc(100% - 34px);
    }
    .el-main {
      padding: 0 !important;
      color: red;
    }
  }
}
</style>