<template>
  <div class="exit-dialog">
    <el-dialog :model-value="modelValue" :title="$t('exitDialog.exitSystem')" align-center
      @update:model-value="emit('update:modelValue', $event)" @close="handleCloseDialog" width="400px"
      :close-on-press-escape="false" :close-on-click-modal="false">
      <div class="wrapper-content">
        <div class="icon-warning">
          <el-icon :size="34" color="var(--color-warning)">
            <i-ep-warn-triangle-filled />
          </el-icon>
        </div>
        <div class="content">{{ $t("exitDialog.exitSystemTip") }}</div>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="btn-cancel" @click="emit('update:modelValue', false)">{{ $t("exitDialog.cancel") }}</el-button>
          <el-button class="btn-confirm" type="primary" @click="confirmExit">{{ $t("exitDialog.confirmExit") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { usePassportStore } from "@renderer/stores";
const props = defineProps<{
  modelValue: boolean
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
  (event: 'confirmExit')
}>();


const passportState = usePassportStore();

const confirmExit = () => {
  emit('confirmExit');
  passportState.logoutUser();
}

const handleCloseDialog = () => {
  emit('update:modelValue', false);
}
</script>


<style scoped lang="scss">
.exit-dialog {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 4px;

    .el-dialog__header {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0;
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--fill-color-light);

      span {
        font-size: 14px;
      }

      button {
        width: 40px;
        height: 40px;
      }
    }
    .el-dialog__close {
      color: #36393D;
    }

    .el-dialog__footer {
      padding: 0 24px 24px 24px;

      .el-button {
        border-radius: 4px;
        margin-left: 8px;
      }
    }

    .el-dialog__body {
      padding: 24px 16px;
    }
  }

  .wrapper-content {
    display: flex;
    align-items: center;

    .icon-warning {
      margin-right: 12px;

      i {
        font-size: 27px;
      }
    }

    .content {
      font-size: 14px;
      line-height: 20px;
    }
  }
    .footer {
    position: relative;
    height: 36px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;

    .btn-cancel {
      width: 68px;
      height: 36px;
      font-size: 14px;
      border: none;
      background-color: var(--bg-color-overlay);
    }

    .btn-confirm {
      @extend .btn-cancel;
      background-color: #0873FF;
      margin-left: 0;
    }
  }

}
</style>
