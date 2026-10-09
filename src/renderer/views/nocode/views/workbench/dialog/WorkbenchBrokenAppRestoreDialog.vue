<template>
  <div class="workbench-broken-app-restore-dialog">
    <el-dialog
      :model-value="props.modelValue"
      :width="400"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      destroy-on-close
      @update:model-value="emit('update:modelValue', $event)"
    >
      <div class="dialog-content">
        <div class="dialog-title">
          <el-icon class="title-icon" :size="16">
            <i-ep-circle-close-filled />
          </el-icon>
          <span>{{ $t('WorkbenchBrokenAppRestoreDialog.title') }}</span>
        </div>
        <div class="dialog-message">{{ $t('WorkbenchBrokenAppRestoreDialog.message') }}</div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button :disabled="props.loading" @click="emit('update:modelValue', false)" text bg>
            {{ $t('WorkbenchBrokenAppRestoreDialog.cancel') }}
          </el-button>
          <el-button type="primary" :loading="props.loading" @click="emit('confirm')">
            {{ $t('WorkbenchBrokenAppRestoreDialog.confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'confirm']);
</script>

<style scoped lang="scss">
.workbench-broken-app-restore-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    background-color: var(--color-white);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      display: none;
    }

    .el-dialog__body {
      padding: 24px 20px 20px;
    }

    .el-dialog__footer {
      padding: 0 20px 16px;
    }
  }

  .dialog-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-color-primary);
    font-size: 16px;
    line-height: 24px;

    .title-icon {
      color: #ff4d4f;
    }
  }

  .dialog-message {
    margin-top: 16px;
    color: var(--text-color-regular);
    font-size: 14px;
    line-height: 22px;
    white-space: pre-line;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;

    .el-button {
      height: 32px;
      margin-left: 0;
      border-radius: 4px;
    }
  }
}
</style>
