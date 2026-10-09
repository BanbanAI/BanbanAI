<template>
  <div class="save-as-dialog">
    <el-dialog width="400px" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
      :title="$t('SaveAsDialog.title') "
      :close-on-click-modal="false" draggable :before-close="handleDialogClose"  align-center :destroy-on-close="true">
      <nocode-save-as v-if="args?.id" :nocodeId="args.id" @close="handleDialogClose"></nocode-save-as>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>


defineProps<{
  modelValue: boolean,
  args?: {
    type: string,
    id: string,
  }
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean),
  (event: "refresh", projectId: string),
  (event: "migration"),
}>();

const handleDialogClose = () => {
  emit('update:modelValue', false)
}

defineExpose({
  hide: handleDialogClose
});
</script>
<style scoped lang="scss">
.save-as-dialog {
  :deep(.el-dialog) {
    height: 454px;
    border-radius: 8px;
    overflow: hidden;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--el-bg-color-page);
    display: flex;
    flex-direction: column;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      height: 48px;
      line-height: 48px;
      border-bottom: 1px solid #f0f0f0;
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 48px;
        width: 48px;
        line-height: 48px;
        font-size: 16px;
        top: 0;
      }
    }

    .el-dialog__body {
      height: calc(100% - 48px);
      overflow: hidden;
    }
  }
}
</style>
