<template>
  <div class="common-input-tip-dialog" @click.stop.prevent="">
    <el-dialog
      v-model="visible"
      :width="formatUnit(width)"
      :top="formatUnit(top)"
      :close-on-click-modal="closeOnClickModal"
      :close-on-press-escape="false"
      :align-center="!top"
      :show-close="showClose"
      @opened="handleOpened"
      @close="handleCloseFallback"
      class="custom-center-dialog"
    >
      <template #header>
        <div class="dialog-header">{{ title }}</div>
      </template>

      <div class="dialog-body">
        <div class="input-label" v-if="label">{{ label }}</div>
        <el-input
          ref="inputRef"
          v-model="inputValue"
          :placeholder="placeholder"
          @keydown.enter.prevent="handleConfirm"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="cancel-btn" @click="handleCancel">{{ cancelText }}</el-button>
          <el-button type="primary" class="confirm-btn" @click="handleConfirm">{{ confirmText }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ElMessage } from 'element-plus';
import { ref } from 'vue';
import i18next from 'i18next';

interface Props {
  title?: string;
  label?: string;
  placeholder?: string;
  cancelText?: string;
  confirmText?: string;
  required?: boolean;
  requiredMessage?: string;
  trim?: boolean;
  width?: number | string;
  top?: number | string;
  showClose?: boolean;
  closeOnClickModal?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: () => i18next.t('TipDialog.tips'),
  label: '',
  placeholder: '',
  cancelText: () => i18next.t('TipDialog.cancel'),
  confirmText: () => i18next.t('TipDialog.confirm'),
  required: true,
  requiredMessage: () => i18next.t('inputTipDialog.requiredMessage'),
  trim: true,
  width: 400,
  top: '',
  showClose: true,
  closeOnClickModal: false,
});

type DialogResult = string | false | undefined;

const formatUnit = (val: string | number) => {
  if (!val) return undefined;
  const strVal = String(val);
  if (/^\d+$/.test(strVal)) {
    return strVal + 'px';
  }
  return strVal;
};

const visible = ref(false);
const inputValue = ref('');
const inputRef = ref();
let _resolve: ((value: DialogResult) => void) | null = null;

const getInputValue = () => {
  const value = props.trim ? inputValue.value.trim() : inputValue.value;
  if (props.required && !value) {
    ElMessage.warning(props.requiredMessage);
    return false;
  }
  return value;
};

const handleOpened = () => {
  inputRef.value?.focus?.();
  inputRef.value?.select?.();
};

const handleConfirm = () => {
  const value = getInputValue();
  if (value === false) return;

  inputValue.value = value;
  if (_resolve) {
    _resolve(value);
    _resolve = null;
  }
  visible.value = false;
};

const handleCancel = () => {
  if (_resolve) {
    _resolve(false);
    _resolve = null;
  }
  visible.value = false;
};

const handleCloseFallback = () => {
  if (_resolve) {
    _resolve(undefined);
    _resolve = null;
  }
};

defineExpose({
  confirm: async (value: string = '') => {
    return new Promise<DialogResult>((resolve) => {
      inputValue.value = value;
      visible.value = true;
      _resolve = resolve;
    });
  }
});
</script>

<style scoped lang='scss'>
.common-input-tip-dialog {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--bg-color-page);
    box-shadow: 0px 8px 20px #0000001a;

    .el-dialog__header {
      margin: 0;
      padding: 0;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);
      position: relative;

      .dialog-header {
        font-size: 16px;
        font-weight: 500;
        color: #1D2129;
      }

      .el-dialog__headerbtn {
        top: 50%;
        transform: translateY(-50%);
        right: 16px;
        width: 16px;
        height: 16px;

        .el-dialog__close {
          font-size: 16px;
        }
      }
    }

    .el-dialog__body {
      padding: 20px;
    }

    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .input-label {
        font-size: 14px;
        line-height: 22px;
        color: #1D2129;
      }

      .el-input {
        .el-input__wrapper {
          min-height: 32px;
          border-radius: 4px;
          background-color: var(--bg-color-page);
          box-shadow: 0 0 0 1px var(--border-color) inset;

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focus {
            box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
          }

          .el-input__inner {
            height: 32px;
            font-size: 14px;
            color: #1D2129;

            &::placeholder {
              color: #86909C;
            }
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);

      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .el-button {
        padding: 5px 16px;
        border-radius: 4px;
        height: 32px;
        font-size: 14px;
        margin: 0;
      }

      .cancel-btn {
        color: var(--el-text-color-regular);
        background-color: #F2F3F5;
        border: none;

        &:hover {
          color: var(--el-color-primary);
          border-color: var(--el-color-primary-light-7);
          background-color: var(--el-color-primary-light-9);
        }
      }
    }
  }
}
</style>
