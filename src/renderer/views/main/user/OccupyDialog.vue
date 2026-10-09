<template>
  <div class="occupy-dialog">
    <el-dialog v-model="dialogState.occupyDialogVisible" :title="$t('occupyDialog.occupyTitle')"  @close="onClose" width="400px" :close-on-click-modal="false">
      <div class="text">
        <el-icon :size="32">
          <i-ep-warning-filled></i-ep-warning-filled>
        </el-icon>
        {{ $t('occupyDialog.userForceQuitTip') }}
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="cancel" type="default" @click="dialogClosed">{{ $t('occupyDialog.cancel') }}</el-button>
          <el-button class="confirm" type="primary" @click="confirm">{{ $t('occupyDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="tsx" setup>
import { ElMessage } from 'element-plus';
import axios from "axios";
import { watchEffect, ref } from 'vue';
import { useDialogStore, usePassportStore } from '@renderer/stores';

const emit = defineEmits<{
  (event: 'logged-outed'),
}>();

const isSessionLoading = ref([])

const dialogState = useDialogStore()
const passportState = usePassportStore();
const onClose = async () => {
  if (passportState.isOutOfOnlineLimit) {
    await passportState.logoutUser();
    emit('logged-outed');
  }
}

const onForceOffline = async (sessionId) => {
  const res = await axios.post("/user/force-offline", { sessionId }).catch(err => {
    console.log("/user/force-offline", err);
    ElMessage.error({ message: err });
  });
  if (res) {
    passportState.updateUser(res.data.user);
  }
}

const dialogClosed = () => {
  passportState.logout();
  passportState.updateUser({});
}

const confirm = () => {
  onForceOffline(passportState.user.sessionId);
}

watchEffect(() => {
  if (passportState.isOutOfOnlineLimit) {
    dialogState.show('occupyDialogVisible')
  } else {
    dialogState.hide('occupyDialogVisible')
  }
})
</script>

<style scoped lang="scss">
.occupy-dialog {
  $dialog-header-height: 48px;
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
      font-size: 16px;

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__body {
      padding: 24px 20px;

      .text {
        display: flex;
        align-items: center;
        column-gap: 8px;
        line-height: 22px;

        .el-icon {
          width: 20px;
          height: 20px;
          margin-top: -20px;
          color: var(--color-warning);
        }
      }
    }

    .el-dialog__footer {
      padding: 8px 16px 16px;
      .cancel {
        background: #F2F3F5;
      }
      .confirm {
        background: #0873FF;
        color: #fff;
      }
      .el-button {
        border-radius: 4px;
        gap: 4px;
        border: none;
      }
    }
  }
}
</style>