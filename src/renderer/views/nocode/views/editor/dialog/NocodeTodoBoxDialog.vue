<template>
  <div class="delete-nocode-process-dialog">
    <el-dialog v-model="visible" width="360" :title="title" :close-on-click-modal="false" :close-on-press-escape="false" align-center>
      <div class="tip-container">
        <el-icon :size="32" color="var(--color-warning)">
          <i-ep-warn-triangle-filled></i-ep-warn-triangle-filled>
        </el-icon>
        <div class="tip-text">
          {{ tipText }}
        </div>
      </div>
      <template #footer>
        <el-button @click="handleClose">{{ $t('NocodeTodoBoxDialog.cancel') }}</el-button>
        <el-button :type="btnColor" @click="handleConfirm">{{ $t('NocodeTodoBoxDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
  
<script setup lang='ts'>
import { ref } from 'vue';
import i18next from 'i18next';

type btnColorType = 'primary' | 'danger'
const props = withDefaults(defineProps<{
  title: string,
  tipText: string,
  btnColor: btnColorType
}>(), {
  title: () => i18next.t('NocodeTodoBoxDialog.tips'),
  tipText: () => i18next.t('NocodeTodoBoxDialog.confirmCheck'),
  btnColor: 'primary'
});

const visible = ref(false);
let _resolve: Function;

const handleClose = () => {
  visible.value = false;
  _resolve(false);
  _resolve = null;
}

const handleConfirm = () => {
  visible.value = false;
  _resolve(true);
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
.delete-nocode-process-dialog {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-border-radius: 4px;
    overflow: hidden;

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


    .tip-container {
      display: flex;
      column-gap: 14px;
      justify-content: start;
      align-items: center;
      padding: 24px 16px;

      .tip-text {

        .tip-text-top {
          width: 209px;
          height: 25px;
          font-size: 14px;
          color: var(--text-color-primary);
        }

        .tip-text-bottom {
          height: 22px;
          line-height: 21.6px;
          font-size: 12px;
          color: var(--text-color-primary);
        }
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