<template>
  <div class="print-dialog">
    <el-dialog :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" width="360px" :close-on-click-modal="false"
      draggable :title="title" align-center destroy-on-close @closed="emit('closed')">
      <div class="dialog-content">
        <div class="generating" v-if="loading">
          <div class="loading" v-loading="loading">

          </div>
          <div class="text-top">
            {{ $t('PrintDialog.generating') }}
          </div>
          <div class="text-bottom">
            {{ $t('PrintDialog.canClose') }}
          </div>
        </div>
        <div class="success" v-else>
          <el-icon class="success-icon">
            <i-nocode-import-success v-if="status === 'success'" />
            <i-nocode-import-warning v-else />
          </el-icon>
          <div class="success-text">{{ status === 'success' ? $t('PrintDialog.printSuccess') : $t('PrintDialog.printFail') }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  loading: boolean;
  status?: "success" | "fail"
}>(), {
  status: "success"
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'closed'): void;
}>();
</script>

<style scoped lang='scss'>
.print-dialog {
  :deep(.el-dialog) {
    height: 232px;
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body {
      padding: 24px 16px 16px 16px;
      border-radius: 4px;

      .dialog-content {
        display: flex;
        flex-direction: column;
        align-items: center;

        .generating {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 16px;
          .loading {
            width: 48px;
            height: 48px;
          }
          .text-top {
            font-size: 14px;
            font-weight: 400;
            color: #141414;
            margin-top: 16px;
            margin-bottom: 8px;
          }
          .text-bottom {
            font-size: 14px;
            font-weight: 400;
            color: #A1A1A1;
          }
        }
        .success {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 32px;
          .success-icon {
            font-size: 32px;
          }
          .success-text {
            font-size: 14px;
            font-weight: 400;
            color: #141414;
            margin-top: 16px;
          }
        }
      }
    }
  }
}
</style>