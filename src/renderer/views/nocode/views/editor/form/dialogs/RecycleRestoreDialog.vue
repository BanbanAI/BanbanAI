<template>
  <div class="recycle-restore-dialog" :class="isMobile() ? 'mobile' : ''">
    <el-dialog custom-class="restore-dialog" :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" align-center>
      <template #header>
        <div class="dialog-header">{{ title || $t('RecycleRestoreDialog.title') }}</div>
      </template>
      <div class="dialog-body">
        <div class="restore-dialog-tip">
          <el-icon :size="24"><i-table-delete-tip /></el-icon>
          <span>{{ restoreTip || $t('RecycleRestoreDialog.restoreTip') }}</span>
        </div>
        <div class="restore-dialog-warning">{{ restoreWarningText || $t('RecycleRestoreDialog.willRestore') }}</div>
      </div>
      <template #footer>
        <div class="btns">
          <el-button class="cancel" @click="emit('update:modelValue', false)">{{ $t('RecycleRestoreDialog.cancel') }}</el-button>
          <el-button class="confirm" type="primary" @click="handleConfirm">{{ $t('RecycleRestoreDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { isMobile } from '@renderer/utils';

const props = defineProps<{
  modelValue: boolean;
  dataText?: string | string[];
  title?: string;
  restoreTip?: string;
  isNoneSummary?: boolean;
  restoreWarningText?: string;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'confirm'): void;
}>();

const handleConfirm = () => {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>

<style scoped lang='scss'>
.recycle-restore-dialog {
  :deep(.el-dialog) {
    padding: 0;
    width: 400px;
    height: fit-content;
    border-radius: 8px;

    .el-dialog__header {
      width: 100%;
      height: 40px;
      padding: 8px 0;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border-color);

      .dialog-header {
        flex: 1;
        text-align: center;
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .dialog-body {
      padding: 24px;

      .restore-dialog-tip {
        display: flex;
        align-items: center;
        justify-content: start;
        column-gap: 8px;
        font-size: 16px;
      }

      .restore-dialog-warning {
        margin-top: 16px;
        background-color: #FAAD1426;
        border-radius: 4px;
        padding: 8px;
        font-size: 14px;
        line-height: 20px;
        color: #FF4D4F;
      }
    }

    .el-dialog__footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);

      .btns {
        .el-button {
          border-radius: 4px;
          padding: 6px 16px;
        }
      }
    }
  }

  &.mobile:deep(.el-dialog) {
    width: 82%;
    height: auto;
    border-radius: 8px;
    .el-dialog__footer {
      padding: 0 16px;
      padding-bottom: 16px;
    }
  }
}
</style>