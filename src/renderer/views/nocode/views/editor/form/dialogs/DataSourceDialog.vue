<template>
  <div class="data-source-dialog">
    <el-dialog
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :title="title"
      :close-on-click-modal="false"
      draggable
      align-center
    >
      <data-source-viewer
        ref="dataSourceViewerRef"
        @handle-edit="emit('handle-edit', $event)"
      >
      </data-source-viewer>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Connection, Table } from "@common/types/project";

const dataSourceViewerRef = ref();

const props = defineProps<{
  modelValue: boolean,
  title: string,
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: "handle-edit", table: Table),
}>();

defineExpose({
  async getTableInfo(c: Connection, t: Table) {
    dataSourceViewerRef.value.getTableInfo(c, t);
  }
})
</script>

<style scoped lang='scss'>
.data-source-dialog {
  :deep(.el-dialog) {
    width: 80%;
    height: 80%;
    border-radius: 4px;
    background-color: var(--bg-color-overlay);
    padding: 0px;

    .el-dialog__header{
      padding: 0px;
      text-align: center;
      line-height: 40px;
      background-color: var(--bg-color-page);
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
      border-radius: 4px 4px 0 0;
    }
    .el-dialog__body {
      height: 100%;
      border-radius: 4px;
    }
  }
}
</style>
