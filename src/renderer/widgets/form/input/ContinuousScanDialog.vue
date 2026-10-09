<template>
  <el-dialog
    :model-value="visible"
    fullscreen
    :show-close="false"
    class="continuous-scan-dialog"
    append-to-body
    destroy-on-close
    @close="handleClose"
  >
    <div class="scan-container">
      <div class="instruction-card">
        <div class="card-title">{{ $t('continuousScanTitle') }}</div>
        <div class="https-alert" v-if="isHttp">
          <el-icon class="alert-icon"><Warning /></el-icon>
          <span class="alert-text">{{ $t('switchToHttps') }}</span>
          <span class="alert-link" @click="handleViewTutorial">{{ $t('viewTutorial') }}</span>
        </div>
        <div class="card-desc">
          {{ $t('continuousScanDesc') }}
        </div>
      </div>

      <div class="result-area">
        <div class="result-label">{{ $t('scanResult') }}</div>
        <div class="result-value">{{ value }}</div>
      </div>

      <div class="action-footer">
        <el-button type="primary" class="btn-next" @click="handleNext">
          {{ $t('scanNext') }}
        </el-button>

        <div class="secondary-actions">
          <el-button class="btn-half" @click="handleRescan">
            {{ $t('rescan') }}
          </el-button>
          <el-button class="btn-half btn-done" @click="handleClose">
            {{ $t('done') }}
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { Warning } from '@element-plus/icons-vue';
import i18next, { $t } from "@renderer/widgets/i18next";

defineProps<{
  visible: boolean;
  value: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void;
  (e: 'next'): void;
  (e: 'rescan'): void;
}>();

const isHttp = window?.location.protocol === 'http:';

const handleNext = () => {
  emit('next');
};

const handleRescan = () => {
  emit('rescan');
};

const handleClose = () => {
  emit('update:visible', false);
};

const handleViewTutorial = () => {
  const url = 'https://www.banban.work/docs/v1/ye6mncg5cis0bwxm';
  window.open(url, '_blank');
};
</script>

<style lang="scss">
.continuous-scan-dialog {
  display: flex;
  flex-direction: column;
  padding: 0;
  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    flex: 1;
    padding: 0;
    height: 100%;
  }
}
</style>

<style lang="scss" scoped>
.scan-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  padding: 0 16px;
  padding-top: 24px;
  padding-bottom: 60px;
  box-sizing: border-box;
  position: relative;

  .instruction-card {
    line-height: 1.6;
    font-size: 14px;
    color: var(--text-color-secondary);
    background: var(--fill-color-blank);
    padding: 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;

    .card-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color-regular);
      margin-bottom: 12px;
    }

    .https-alert {
      width: 100%;
      background-color: var(--bg-color);
      border-radius: 4px;
      padding: 4px 8px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      font-size: 14px;

      .alert-icon {
        font-size: 16px;
        margin-right: 8px;
      }

      .alert-text {
        color: var(--text-color-regular);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .alert-link {
        color: var(--primary-color);
        cursor: pointer;
        margin-left: 8px;
        white-space: nowrap;

        &:hover {
          opacity: 0.8;
        }
      }
    }

    .card-desc {
      font-size: 14px;
      color: var(--text-color-secondary);
      line-height: 1.6;
      text-align: justify;
    }
  }

  .result-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 60px;

    .result-label {
      font-size: 16px;
      color: var(--text-color-secondary);
      margin-bottom: 12px;
    }

    .result-value {
      font-size: 24px;
      line-height: 32px;
      color: var(--text-color-primary);
      text-align: center;
      word-break: break-all;
    }
  }

  .action-footer {
    width: 100%;
    padding-bottom: 20px;

    .btn-next {
      width: 100%;
      height: 44px;
      font-size: 14px;
      border-radius: 4px;
      background-color: var(--color-primary);
      border-color: var(--color-primary);
      margin-bottom: 12px;
    }

    .secondary-actions {
      display: flex;
      justify-content: space-between;
      gap: 12px;

      .btn-half {
        flex: 1;
        height: 44px;
        font-size: 14px;
        border-radius: 4px;
        background-color: var(--fill-color-blank);
        border: 1px solid var(--border-color);
        color: var(--text-color-regular);
        margin-left: 0;
      }

      .btn-done {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }
    }
  }
}
</style>
