<template>
  <div class="login-dialog">
    <el-dialog :header="false" :model-value="modelValue" align-center class="login-dialog-nocode app-no-drag"
      :close-on-press-escape="false" :close-on-click-modal="false" :show-close="false" destroy-on-close
      ref="dialogRef" width="400px">
      <div class="nocode-login">
        <div class="login-header">
          <el-icon class="icon-return" v-show="loginStep !== LoginStep.Login" @click="handleClickReturn"
            :size="16"><i-ant-design-left-outlined /></el-icon>
          <el-icon class="icon-proxy" @click="handleSwitchStep('Proxy')" v-if="loginStep !== LoginStep.Proxy"
            :size="16"><i-ant-design-global-outlined /></el-icon>
          <el-icon class="icon-close" @click="handleClickClose" :size="16"><i-ant-design-close-outlined /></el-icon>
        </div>
        <div class="login-body">
          <div class="login-title">{{ computedStepData.title }}</div>
          <div class="sub-title" v-if="loginStep === LoginStep.Login">{{ $t("nocodeLoginDialog.welcome") }}</div>
          <div class="">
            <proxy-configuration v-if="loginStep === LoginStep.Proxy"></proxy-configuration>
            <retrieve-password v-else-if="loginStep === LoginStep.RetrievePwd" @confirmModifyPass="handleConfirmModifyPass"></retrieve-password>
            <multi-auth-login v-else @retrievePassword="handleSwitchStep('RetrievePwd')"></multi-auth-login>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
}>();

enum LoginStep {
  Login,
  Proxy,
  RetrievePwd
};

const loginStep = ref(LoginStep.Login);

const computedStepData = computed(() => {
  switch (loginStep.value) {
    case LoginStep.Proxy: {
      return { title: i18next.t("loginProxy.proxy") };
    }
    case LoginStep.RetrievePwd: {
      return { title: i18next.t("loginRetrieve.retrieve") };
    }
    default: {
      return { title: i18next.t("nocodeLoginDialog.login") };
    }
  };
});

const handleClickReturn = () => {
  loginStep.value = LoginStep.Login;
}

const handleSwitchStep = (step: keyof typeof LoginStep) => {
  loginStep.value = LoginStep[step];
}

const handleClickClose = () => {
  loginStep.value = LoginStep.Login;

  emit('update:modelValue', false);
}

const handleConfirmModifyPass = () => {
  loginStep.value = LoginStep.Login;
}
</script>

<style scoped lang='scss'>
.login-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    -webkit-app-region: drag;
    padding: 0 !important;

    .el-dialog__header {
      padding: 0;
    }
  }

  :deep(.el-form-item) {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .el-form-item__error {
      font-size: 10px;
      height: 16px;
      display: flex;
      align-items: center;
    }
  }
}

.nocode-login {
    padding: 0 24px 24px;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .login-header {
      height: 40px;
      position: relative;

      &>i {
        position: absolute;
        cursor: var(--cursor-pointer);
        color: var(--text-color-regular);
        top: 50%;
        transform: translateY(-50%);
      }

      .icon-return {
        left: -12px;
      }

      .icon-proxy {
        right: 20px;
      }

      .icon-close {
        right: -14px;
        pointer-events: auto;
      }
    }

    .login-body {

      .login-title {
        font-size: 24px;
        font-weight: 500;
        line-height: 32px;
        margin: 8px 0 4px 0;
      }
      .sub-title {
        color: #A9ADB2;
        margin-bottom: 32px;
      }
    }
  }
</style>
