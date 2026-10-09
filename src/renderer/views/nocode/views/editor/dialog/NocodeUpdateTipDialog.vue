<template>
  <div class="nocode-update-tip-dialog">
    <el-dialog class="tip-dialog" :model-value="visible" :close-on-press-escape="false" :show-close="false"
      align-center>
      <template #header>
        <div class="header-text">
          {{ $t("nocodeUpdateTipDialog.title") }}
        </div>

        <el-button class="close-btn" link @click="handleClick('close')">
          <el-icon :size="16"><i-ep-close></i-ep-close></el-icon>
        </el-button>
      </template>
      <div class="content-text">
        <el-icon :size="36"><i-workbench-nocode-tip /></el-icon>
        <p>{{ $t("nocodeUpdateTipDialog.text") }}</p>
      </div>
      <template #footer>
        <el-button @click="handleClick('cancel')">{{ $t("nocodeUpdateTipDialog.cancel") }}</el-button>
        <el-button type="primary" @click="handleClick('save')">{{ $t("nocodeUpdateTipDialog.confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';

const visible = ref(false);
let _resolve: Function;

const handleClick = (option: 'close' | 'cancel' | 'save') => {
  visible.value = false;
  _resolve(option); // 点击关闭按钮，切换tab，返回true
  _resolve = null;
}

defineExpose({
  confirm: async () => {
    return new Promise((resolve) => {
      visible.value = true;
      _resolve = resolve;
    });
  }
})
</script>

<style scoped lang='scss'>
.nocode-update-tip-dialog {
  &:deep(.tip-dialog) {
    width: 360px;
    height: 176px;
    --el-dialog-padding-primary: 0;
    --el-dialog-title-font-size: 14px;
    --dialog-header-height: 40px;
    --el-dialog-bg-color: var(--bg-color-page);
    padding: 0;

    .el-dialog__header {
      position: relative;

      .header-text {
        width: 100%;
        text-align: center;
        font-size: 14px;
        color: var(--text-color-regular);
      }

      .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
      }

      height: 40px;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color-light);

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__body {
      width: 100%;
      height: 80px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;

      .content-text {

        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .el-dialog__footer {
      padding: 8px 16px 16px 0;

      .el-button {
        width: 60px;
        height: 32px;
        border-radius: 4px;
      }

    }

  }
}
</style>