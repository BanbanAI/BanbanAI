<template>
  <div class="delete-confirm-dialog">
    <el-dialog :modelValue="modelValue" width="360px" :title="title"
      @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false"
      destroy-on-close>
      <div class="text">
        <el-icon :size="32">
          <i-ep-warn-triangle-filled></i-ep-warn-triangle-filled>
        </el-icon>
        {{ text }}
      </div>
      <div class="tip">
        {{ tip }}
      </div>
      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t("deleteConfirmDialog.cancel") }}</el-button>
        <el-button type="danger" :loading="loading" :disabled="loading" @click="handleConfirm">{{ confirmText }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref } from 'vue';
import i18next from 'i18next';

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  text: string,
  tip: string,
  confirmText?: string;
  action?: () => Promise<boolean | void> | boolean | void;
}>(), {
  title: () => i18next.t('deleteConfirmDialog.deletePrompt'),
  confirmText: () => i18next.t('deleteConfirmDialog.confirmDelete')
});
// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: 'confirm'),
}>();


const loading = ref(false);

const handleConfirm = async () => {
  if (loading.value) return;
  if (!props.action) {
    emit('confirm');
    emit('update:modelValue', false);
    return;
  }
  loading.value = true;
  try {
    const result = await props.action();
    if (result !== false) emit('update:modelValue', false);
  } catch {
  } finally {
    loading.value = false;
  }
}

</script>

<style lang='scss' scoped>
.delete-confirm-dialog {

  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-border-radius: 4px;
    .el-dialog__header {
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      --el-dialog-title-font-size: 14px;
      --el-text-color-primary: var(--el-text-color-regular);

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__body {
      padding: 24px 16px;

      .text {
        display: flex;
        align-items: center;
        column-gap: 16px;
        color: var(--text-color-primary);
        opacity: 0.9;

        .el-icon {
          color: var(--color-warning);
        }
      }      
      .tip {
        margin-top: 16px;
        line-height: 20px;
        background-color: var(--el-color-warning-light-8);
        color: var(--color-danger);
        padding: 8px;
      }
    }

    .el-dialog__footer {
      padding: 8px 16px 16px;

      .el-button {
        border-radius: 4px;
      }
    }
  }

}

</style>
