<template>
  <div class="organize-delete-user-dialog">
    <el-dialog :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="title || $t('OrganizeDeleteUserDialog.deleteTipsTitle')" align-center draggable width="360px"
      :close-on-click-modal="false">
      <div class="content">
        <div class="tip-row">
          <div class="tip-icon">!</div>
          <div class="tip-text">{{ tipTitle || $t('OrganizeDeleteUserDialog.confirmDeleteMember') }}</div>
        </div>
        <div v-if="warningText" class="notice-card">{{ warningText }}</div>
        <div v-if="descriptionText" class="description">{{ descriptionText }}</div>
      </div>
      <template #footer>
        <el-button class="cancel-button" @click="() => { emit('update:modelValue', false); }">{{ $t('OrganizeDeleteUserDialog.cancel') }}</el-button>
        <el-button :class="['confirm-button', `is-${confirmType || 'danger'}`]" @click="handleConfirm">{{ confirmText || $t('OrganizeDeleteUserDialog.delete') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>

defineProps<{
  modelValue: boolean,
  title?: string,
  tipTitle?: string,
  warningText?: string,
  descriptionText?: string,
  confirmText?: string,
  confirmType?: 'primary' | 'danger',
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: "confirm");
}>();

const handleConfirm = () => {
  emit("confirm");
  emit('update:modelValue', false);
}

</script>

<style lang='scss' scoped>
.organize-delete-user-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);

    .el-dialog__header {
      height: 48px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;

      .el-dialog__title {
        font-size: 16px;
        color: var(--text-color-primary);
      }

      .el-dialog__headerbtn {
        top: 0;
        width: 48px;
        height: 48px;

        .el-dialog__close {
          font-size: 18px;
        }
      }
    }

    .el-dialog__body {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .el-dialog__footer {
      padding: 16px 20px;

      .el-button {
        height: 32px;
        min-width: 72px;
        border-radius: 4px;
      }
    }
  }

  .tip-row {
    display: flex;
    align-items: flex-start;
    column-gap: 8px;
    margin-bottom: 16px;
  }

  .tip-icon {
    width: 16px;
    height: 16px;
    margin-top: 3px;
    border-radius: 50%;
    background-color: #FFB400;
    color: #fff;
    font-size: 12px;
    line-height: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .tip-text {
    font-size: 14px;
    line-height: 22px;
    color: var(--text-color-primary);
  }

  .notice-card {
    padding: 8px;
    border-radius: 4px;
    background: #FFF7E8;
    color: #D46B08;
    font-size: 14px;
    line-height: 22px;
  }

  .description {
    margin-top: 16px;
    font-size: 14px;
    line-height: 22px;
    color: var(--text-color-regular);
  }

  .cancel-button {
    color: var(--text-color-regular);
    background-color: var(--bg-color-overlay);
    border-color: transparent;
  }

  .confirm-button {
    &.is-danger {
      border-color: #FF4D4F;
      color: #fff;
      background-color: #FF4D4F;
    }

    &.is-primary {
      border-color: var(--color-primary);
      color: #fff;
      background-color: var(--color-primary);
    }
  }
}
</style>
