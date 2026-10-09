<template>
  <div class="common-tip-dialog" @click.stop.prevent="">
    <el-dialog
      v-model="visible"
      :width="formatUnit(width)"
      :top="formatUnit(top)"
      :close-on-click-modal="closeOnClickModal"
      :close-on-press-escape="false"
      :align-center="!top"
      :show-close="showClose"
      @close="handleCloseFallback"
      :class="['custom-center-dialog', { 'show-footer-border': showFooterBorder }]"
    >
      <template #header>
        <div class="dialog-header">{{ title }}</div>
      </template>

      <div class="dialog-content">
        <div class="tip-container">
          <el-icon :size="iconSize" :color="iconColor" class="tip-icon">
            <component :is="icon" />
          </el-icon>
          
          <div class="tip-text" v-html="content"></div>
        </div>

        <div
          v-if="extraInfo"
          class="extra-info"
          :style="{ backgroundColor: extraInfoBgColor }"
        >
          {{ extraInfo }}
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="showCancelButton"
            class="cancel-btn"
            @click="handleCancel"
            :style="cancelBtnStyle"
          >
            {{ cancelText }}
          </el-button>
          <el-button type="primary" class="confirm-btn" @click="handleConfirm" :style="confirmBtnStyle">{{ confirmText }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { WarningFilled } from '@element-plus/icons-vue'; 
import i18next from 'i18next';

interface Props {
  title?: string;
  content?: string;
  cancelText?: string;
  confirmText?: string;
  width?: number | string;
  top?: number | string;
  icon?: string | object;
  iconColor?: string;
  iconSize?: number;
  showClose?: boolean;
  showCancelButton?: boolean;
  closeOnClickModal?: boolean;
  extraInfo?: string;
  extraInfoColor?: string;
  extraInfoBgColor?: string;
  showFooterBorder?: boolean;
  cancelBtnStyle?: { [key: string]: string };
  confirmBtnStyle?: { [key: string]: string };
}

const props = withDefaults(defineProps<Props>(), {
  title: () => i18next.t('TipDialog.tips'),
  content: () => i18next.t('TipDialog.confirmQuit'),
  cancelText: () => i18next.t('TipDialog.cancel'),
  confirmText: () => i18next.t('TipDialog.confirm'),
  width: 400,
  top: '', // 默认居中
  icon: WarningFilled,
  iconColor: '#FF9900',
  iconSize: 20,
  showClose: true,
  showCancelButton: true,
  closeOnClickModal: false,
  extraInfo: '',
  extraInfoColor: '#CF870C',
  extraInfoBgColor: '#FFFBE8',
  showFooterBorder: false,
});

const formatUnit = (val: string | number) => {
  if (!val) return undefined;
  const strVal = String(val);
  if (/^\d+$/.test(strVal)) {
    return strVal + 'px';
  }
  return strVal;
};

const visible = ref(false);
let _resolve: Function;

const handleConfirm = () => {
  if (_resolve) {
    _resolve(true);
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

// 点击 X、背景
const handleCloseFallback = () => {
  if (_resolve) {
    _resolve(undefined);
    _resolve = null;
  }
};

defineExpose({
  confirm: async () => {
    return new Promise<boolean | undefined>((resolve) => {
      visible.value = true;
      _resolve = resolve;
    });
  }
});
</script>

<style scoped lang='scss'>
.common-tip-dialog {
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
      border-bottom: 1px solid #E5E6EB;
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
      padding: 24px 20px;
    }

    .dialog-content {
      display: flex;
      flex-direction: column;
      row-gap: 16px;
    }

    .tip-container {
      display: flex;
      align-items: center;
      justify-content: start;
      column-gap: 8px;

      .tip-icon {
        flex-shrink: 0;
      }

      .tip-text {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        color: #1D2129;
        line-height: 1.5;
        text-align: left;
        white-space: normal;
        overflow-wrap: anywhere;
      }
    }

    .extra-info {
      min-height: 38px;
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 22px;
      color: #CF870C;
      text-align: left;
      background-color: #FFFBE8;
      word-break: break-all;
      display: flex;
      align-items: center;
    }

    .el-dialog__footer {
      padding: 16px 20px;
      border-top: none;
      
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
        border: none;
        margin: 0;
        position: relative;
        overflow: hidden;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background-color: #FFFFFF;
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
          border-radius: inherit;
        }

        span {
          position: relative;
          z-index: 1;
        }

        &:hover::before {
          opacity: 0.2;
        }
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

    &.show-footer-border {
      .el-dialog__footer {
        border-top: 1px solid #E5E6EB;
      }
    }
  }
}
</style>
