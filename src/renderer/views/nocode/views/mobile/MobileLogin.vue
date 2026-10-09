<template>
  <div class="login-container">
    <div class="header">
      <img class="logo" :src="loginCompany" />
      <div class="name">{{ companyName }}</div>
    </div>
    <div class="form-wrapper">
      <div class="title">{{ $t("MobileLogin.title") }}</div>
      <div class="login-form">
        <el-form :model="formData" :rules="rules" ref="formRef">
          <el-form-item prop="username">
            <el-input v-model="formData.username" autocomplete="username"
              :placeholder="$t('MobileLogin.accountPlaceholder')">
              <template #prefix>
                <el-icon :size="16"><i-workbench-user /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input :type="passwordVisible ? 'text' : 'password'" v-model="formData.password" autocomplete="username"
              :placeholder="$t('MobileLogin.passwordPlaceholder')" @keydown.enter="handleLogin">
              <template #prefix>
                <el-icon :size="16"><i-workbench-password /></el-icon>
              </template>
              <template #suffix>
                <el-icon class="password-visible" v-if="!passwordVisible" :size="16"
                  @click="checkPasswordVisible"><i-workbench-visible /></el-icon>
                <el-icon class="password-visible" v-else :size="16"
                  @click="checkPasswordVisible"><i-workbench-disvisible /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item class="btn-submit">
            <el-button type="primary" @click="handleLogin" style="width: 100%;">{{ $t("MobileLogin.login")
              }}</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <div class="footer">
      <div class="text-left">{{ $t("MobileLogin.banbanNocode") }}&nbsp;</div>
      <div class="text-right">{{ $t("MobileLogin.ProvideTechnicalSupport") }}</div>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { ref, reactive, toRaw, computed } from 'vue';
import { ElMessage, FormInstance } from 'element-plus';
import axios from 'axios';
import { usePassportStore, useSettingStore } from '@renderer/stores';
import { accountUtil } from '@renderer/stores/account';
import { ProjectPreviewPlatform } from '@common/types/project';
import loginCompany from "@renderer/assets/image/workbench/login-company.png";
import i18next from 'i18next';

const passportState = usePassportStore();
const settingState = useSettingStore();
void settingState.getCompanyName().catch(() => undefined);

passportState.init()
const formData = ref({
  username: '',
  password: ''
});
const rules = reactive({
  username: [
    { required: true, get message() { return i18next.t("MobileLogin.accountEmpty") }, trigger: 'blur' }
  ],
  password: [
    { required: true, get message() { return i18next.t("MobileLogin.passwordEmpty") }, trigger: 'blur' }
  ]
})
const formRef = ref<FormInstance>();

const companyName = computed(() => settingState.companyName);

const handleLogin = () => {
  formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      const res = await axios.post("auth/login", {
        ...toRaw(formData.value),
        loginPlatform: ProjectPreviewPlatform.Mobile,
      })
        .catch((err) => {
          ElMessage.error(err.response.data.message)
        })
      if (res && res.data) {
        ElMessage.success(`${i18next.t("MobileLogin.loginSuccess")}`);
        accountUtil.clearFetchCache();
        settingState.clearAccountSettings();
        passportState.updateAccount(res.data.account);
        passportState.updateUser(res.data.user);
      }
    } else {
      console.log(`${i18next.t("MobileLogin.validateFailed")}`);
    }
  });
};

const passwordVisible = ref(false);
const checkPasswordVisible = () => {
  passwordVisible.value = !passwordVisible.value;
}
</script>

<style lang='scss' scoped>
.login-container {
  min-height: 100vh;
  padding: 64px 32px 30px 32px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-direction: column;

  .header {
    width: 100%;
    display: flex;
    align-items: center;
    margin-top: 60px;
    margin-bottom: 40px;

    .logo {
      width: 32px;
      height: 32px;
      margin-right: 8px;
    }

    .name {
      font-size: 24px;
      font-weight: 500;
    }
  }

  .form-wrapper {
    width: 100%;

    .title {
      font-size: 16px;
      font-weight: 400;
      margin-bottom: 24px;
    }

    .login-form {
      :deep(.el-input) {
        height: 48px;

        .el-input__wrapper {
          border-radius: 4px;
        }

        .el-input__inner::placeholder {
          font-size: 16px;
          font-weight: 400;
        }
      }

      .btn-submit {
        margin-top: 48px;

        :deep(.el-button) {
          height: 48px;
          border-radius: 4px;
          font-size: 16px;
        }
      }
    }
  }

  .footer {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: end;
    margin-top: auto;
    padding-bottom: 34px;

    .footer-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: rgba(23, 26, 29, 0.6);
      font-size: 12px;

      .footer-copyright {
        line-height: 22px;
        font-size: 12px;
        text-align: center;
      }

      .footer-police-main {
        display: flex;
        align-items: center;
        .police-img {
          width: 20px;
          height: 20px;
        }
        .police-text {
          margin: 0 4px;
          text-decoration: none;
          font-weight: 400;
          font-size: 12px;
          color: rgba(23, 26, 29, 0.6);
          letter-spacing: 0;
          white-space: nowrap;
          &:hover {
            color: var(--text-color-regular);
          }
        }
      }
    }

    .text-left {
      font-size: 12px;
      font-weight: 500;
      color: #B8B8B8;
    }

    .text-right {
      font-size: 12px;
      font-weight: 400;
      color: #B8B8B8;
    }
  }
}

</style>
