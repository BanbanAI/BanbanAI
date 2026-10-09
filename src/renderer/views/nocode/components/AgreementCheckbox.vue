<template>
  <div class="agreement-tip">
    <input type="checkbox" v-model="consentAgreement" class="checkbox" />
    {{ $t("nocodeLoginDialog.agree") }}
    <el-link type="primary" href="https://www.banban.work/privacy-policy" target="browser">
      {{ $t("loginDialog.privacyPolicy") }}
    </el-link>
    {{ $t("nocodeLoginDialog.and") }}
    <el-link type="primary" href="https://www.banban.work/terms-conditions" target="browser">
      {{ $t("loginDialog.onlineServicesAgreement") }}
    </el-link>

  </div>
  <div class="agreement-dialog">
    <el-dialog :title="$t('loginDialog.dialogHeader')" v-model="dialogVisible" align-center class="confirm-dialog"
      width="360">
      <div class="wrapper-content">
        {{ $t("loginDialog.readAndAgree") }}

        <el-link type="primary" href="https://www.banban.work/privacy-policy" target="browser">
          {{ $t("loginDialog.privacyPolicy") }}
        </el-link>

        {{ $t("loginDialog.andText") }}

        <el-link type="primary" href="https://www.banban.work/terms-conditions" target="browser">
          {{ $t("loginDialog.onlineServicesAgreement") }}
        </el-link>
      </div>
      <template #footer class="dialog-footer">
        <el-button @click="closeAgreementDialog">{{ $t("loginDialog.cancel") }}</el-button>
        <el-button type="primary" @click="acceptAgreement">{{ $t("loginDialog.confirm")
          }}</el-button>
      </template>
    </el-dialog>
  </div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const consentAgreement = ref(false);
const dialogVisible = ref(false);
const pendingAction = ref<null | (() => void | Promise<void>)>(null);

const closeAgreementDialog = () => {
  dialogVisible.value = false;
  pendingAction.value = null;
};

const acceptAgreement = async () => {
  consentAgreement.value = true;
  dialogVisible.value = false;

  const action = pendingAction.value;
  pendingAction.value = null;
  await action?.();
};

const checkIsAgree = (action?: () => void | Promise<void>) => {
  if (!consentAgreement.value) {
    pendingAction.value = action ?? null;
    dialogVisible.value = true;
    return false;
  }
  return true;
};

defineExpose({
  checkIsAgree
});

</script>


<style scoped lang="scss">
.agreement-tip {
  height: 24px;
  font-size: 14px;
  line-height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71757A;

  .el-button {
    cursor: var(--cursor-pointer);
  }

  .checkbox {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    cursor: var(--cursor-pointer);
    accent-color: #0873FF;
  }

  :deep(.el-link) {
    .el-link__inner {
      margin: 0 4px;
      font-size: 14px;
      color: #0873FF;
    }
  }
}

.agreement-dialog {
  :deep(.el-dialog) {
    padding: 0;
    background-color: var(--bg-color-page);
    border-radius: 4px;
    -webkit-app-region: no-drag !important;

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

    .el-dialog__footer {
      padding: 0 24px 24px 24px;

      .el-button {
        border-radius: 4px;
        margin-left: 8px;
      }
    }
  }

  .wrapper-content {
    display: flex;
    padding: 24px;
    line-height: 20px;
  }
}
</style>
