<template>
  <div class="workbench-login" :style="styleVariables" :class="{ 'is-preview': props.preview }">
    <div v-if="!isEnglishLanguage" class="logo"><img class="img-logo" :src="loginLogo" /></div>
    <div class="login-container" :inert="props.preview" :aria-hidden="props.preview ? 'true' : undefined">
      <div class="login-left">
        <img
          :src="loginLeftTitle"
          @error="handleImgError"
        />
      </div>

      <div class="login-right">
        <div class="form-wrapper">
          <div class="title">
            <img class="title-img-logo" :src="loginCompany" />
            {{ formData.company }}
          </div>
          <div class="login-form">
            <el-form :model="formData" :rules="rules" ref="formRef">
              <el-form-item class="form-title-text">
                <p>{{ $t("WorkbenchLogin.title") }}</p>
              </el-form-item>
              <el-form-item prop="username">
                <el-input v-model="formData.username" autocomplete="username" :placeholder="$t('WorkbenchLogin.accountPlaceholder')">
                  <template #prefix>
                    <el-icon size="var(--font-size-num-16)"><i-workbench-user /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item prop="password">
                <el-input :type="passwordVisible ? 'text' : 'password'" v-model="formData.password" autocomplete="username" :placeholder="$t('WorkbenchLogin.passwordPlaceholder')"
                  @keydown.enter="handleLogin">
                  <template #prefix>
                    <el-icon size="var(--font-size-num-16)"><i-workbench-password /></el-icon>
                  </template>
                  <template #suffix>
                    <el-icon class="password-visible" v-if="!passwordVisible" size="var(--font-size-num-16)"
                      @click="checkPasswordVisible"><i-workbench-visible /></el-icon>
                    <el-icon class="password-visible" v-else size="var(--font-size-num-16)" @click="checkPasswordVisible"><i-workbench-disvisible /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item class="btn-submit">
                <el-button type="primary" :loading="isLoggingIn" :disabled="isLoggingIn" @click="handleLogin" style="width: 100%;">{{ $t('WorkbenchLogin.login') }}</el-button>
              </el-form-item>
            </el-form>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>


<script setup lang='ts'>
import { ElMessage, FormInstance } from 'element-plus';
import { computed, nextTick, reactive, ref, toRaw, onBeforeUnmount, onMounted } from 'vue';
import axios from 'axios';
import { usePassportStore, useSettingStore } from '@renderer/stores';
import { accountUtil } from '@renderer/stores/account';
import { ProjectPreviewPlatform } from '@common/types/project';
import i18next from 'i18next';
import { useRoute, useRouter } from 'vue-router';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';
import loginLogo from "@renderer/assets/image/workbench/nocode-login-logo.png";
import leftTitle from "@renderer/assets/image/workbench/login-left-title.png";
import leftTitleEnglish from "@renderer/assets/image/workbench/login-left-title-en.png";
import loginCompany from "@renderer/assets/image/workbench/login-company.png";

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  preview?: boolean,
}>();

useLocalizedDocumentTitle(() => `${i18next.t("WorkbenchLogin.login")} - ${i18next.t("productName")}`);
const passportState = usePassportStore();
const settingState = useSettingStore();
const route = useRoute();
const router = useRouter();

if (!props.preview) {
  document.title = `${i18next.t("WorkbenchLogin.login")} - ${i18next.t("productName")}`;
  passportState.init();
}

const languageVersion = ref(0);
const isEnglishLanguage = computed(() => {
  void languageVersion.value;
  return /^en(?:-|$)/i.test(i18next.resolvedLanguage || i18next.language || '');
});
const loginLeftTitle = computed(() => isEnglishLanguage.value ? leftTitleEnglish : leftTitle);
const handleLanguageChanged = () => {
  languageVersion.value += 1;
};

const formData = ref({
  company: '',
  username: '',
  password: ''
});
const rules = reactive({
  username: [
    { required: true, get message() { return i18next.t("WorkbenchLogin.accountEmpty") }, trigger: 'blur' }
  ],
  password: [
    { required: true, get message() { return i18next.t("WorkbenchLogin.passwordEmpty") }, trigger: 'blur' }
  ]
})
const formRef = ref<FormInstance>();
const isLoggingIn = ref(false);

onMounted(() => {
  i18next.on('languageChanged', handleLanguageChanged);
});

onBeforeUnmount(() => {
  i18next.off('languageChanged', handleLanguageChanged);
});

const getRedirectPath = () => {
  const redirect = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect;
  if (!redirect || typeof redirect !== 'string') {
    return '/';
  }
  if (redirect.startsWith('http')) {
    try {
      const url = new URL(redirect);
      return url.hash ? url.hash.replace(/^#/, '') || '/' : '/';
    } catch {
      return '/';
    }
  }
  return redirect;
};

const navigateAfterLogin = async () => {
  if (props.preview) return;
  const redirectPath = getRedirectPath();
  await router.replace(redirectPath || '/');
};

void settingState.getCompanyName().then((companyName) => {
  formData.value.company = companyName;
}).catch(() => undefined);

const handleLogin = () => {
  if (props.preview || !formRef.value || isLoggingIn.value) return;
  formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      isLoggingIn.value = true;
      let loginCompleted = false;
      try {
        const { data } = await axios.post("auth/login", {
          ...toRaw(formData.value),
          loginPlatform: ProjectPreviewPlatform.PC,
        });
        accountUtil.clearFetchCache();
        settingState.clearAccountSettings();
        await navigateAfterLogin();
        passportState.updateAccount(data.account);
        passportState.updateUser(data.user);
        await nextTick();
        ElMessage.success(`${i18next.t("WorkbenchLogin.loginSuccess")}`);
        loginCompleted = true;
      } catch (err) {
        ElMessage.error(err?.response?.data?.message || err?.message);
      } finally {
        if (!loginCompleted) {
          isLoggingIn.value = false;
        }
      }
    } else {
      console.log(`${i18next.t("WorkbenchLogin.validateFailed")}!`);
    }
  });
};
const passwordVisible = ref(false);
const checkPasswordVisible = () => {
  passwordVisible.value = !passwordVisible.value;
}

const delRouteSource = () => {
  const url = new URL(window.location.href);

  if (url.searchParams.has('source')) {
    url.searchParams.delete('source');
    formData.value.username = "admin";
    window.history.replaceState({}, '', url.toString());
  }
}
if (!props.preview) {
  delRouteSource();
}

const handleImgError = (event) => {
  event.target.src = leftTitle;
}

const styleVariables = computed(() => {
  const screenWidth = window.screen.width;

  // 注释w:1920情况下的值
  const loginRightFormWrapper = {
    width: 400, // 400
    height: 480 // 480
  }
  
  const loginRightFormWrapperLoginForm = {
    width: 352, // 352
    height: 244 // 244
  }
  
  const formWrapperLoginFormItem = {
    height: 40, // 40
  }
  const basicFontSizeRatio = 12; // 12
  
  const loginLeftImgDiv = {
    width: 560, // 560
    height: screenWidth * 0.2578 // 495
  }
  
  const fontSizeNum14 = 14; // 14px
  const fontSizeNum16 = 16 // 16px
  const fontSizeNum20 = 20; // 20px
  const fontSizeNum24 = 24; // 24px

  const loginContainerWidth = screenWidth >= 1440 ? 1440 : screenWidth;
  const loginContainerPadding = screenWidth > 1024 ? '0 80px' : '0 24px';
  return {
    '--login-right-form-wrapper-div-width': `${loginRightFormWrapper.width}px`,
    '--login-right-form-wrapper-div-height': `${loginRightFormWrapper.height}px`,
    '--form-wrapper-login-form-div-width': `${loginRightFormWrapperLoginForm.width}px`,
    '--form-wrapper-login-form-div-height': `${loginRightFormWrapperLoginForm.height}px`,
    '--form-wrapper-login-form-item-div-height': `${formWrapperLoginFormItem.height}px`,
    '--form-wrapper-login-form-item-title-font-size': `${2 * basicFontSizeRatio}px`,
    '--login-left-img-width': `${loginLeftImgDiv.width}px`,
    '--login-left-img-height': `${loginLeftImgDiv.height}px`,
    '--font-size-num-8': `${0.66 * basicFontSizeRatio}px`, 
    '--font-size-num-14': `${fontSizeNum14}px`,
    '--font-size-num-16': `${fontSizeNum16}px`,
    '--font-size-num-20': `${fontSizeNum20}px`,
    '--font-size-num-24': `${fontSizeNum24}px`,
    '--login-container-width': `${loginContainerWidth}px`,
    '--login-container-padding': `${loginContainerPadding}`
  }
})
</script>
<style scoped lang='scss'>
.workbench-login {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: linear-gradient(45deg, #F5FAFF, #C2E2FF);
  position: relative;
  align-items: center;
  pointer-events: none;

  .logo {
    position: absolute;
    top: 2.608vh;
    left: 1.875vw;
    display: flex;
    align-items: center;
    gap: 10px;

    .img-logo {
      height: 3.478vh;
      min-width: 34px;
    }
  }

  .login-container {
    width: var(--login-container-width);
    height: 100px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    padding: var(--login-container-padding);
    max-width: 100%;
    justify-content: space-between;
  }

  .login-left {
    width: var(--login-left-img-width);
    justify-content: center;
    img {
      width: 100%;
      user-select: none;
    }
  }

  .login-right {
    width: max-content;
    height: max-content;
    background-color: var(--color-white);
    // border-radius: 0.416vw;
    border-radius: 16px;
    padding: 0;
    display: inline-block;
    pointer-events: all;

    .form-wrapper {
      width: var(--login-right-form-wrapper-div-width);
      padding: 12.63% 6.31%;
      padding-bottom: 10%;
      display: flex;
      flex-direction: column;
      gap: 64px;

      .title {
        width: var(--form-wrapper-login-form-div-width);
        text-align: left;
        font-size: var(--font-size-num-24);
        font-weight: 500;
        line-height: 1;
        vertical-align: middle;
        display: flex;
        align-items: center;
        gap: 0.625vw;
        .title-img-logo {
          // width: 10%;
          width: 32px;
          height: 32px;
        }
      }

      .login-form {
        height: 100%;
        width: 100%;
        padding: 0;
        display: flex;
        flex-direction: column;

        :deep(.el-form) {
          flex: 1;
          // height: 100%;
          width: 100%;
          min-width: var(--form-wrapper-login-form-div-width);
          min-height: var(--form-wrapper-login-form-div-height);
          display: flex;
          flex-direction: column;
          gap: var(--font-size-num-14);
          .el-form-item {
            --input-text-color: #14141499;
            width: 100%;
            height: var(--form-wrapper-login-form-item-div-height);
  
            .el-form-item__error {
              position: static;
              transition: all 0.3s;
              height: var(--font-size-num-16);
              font-size: var(--font-size-num-14);
              line-height: 1;
              margin-top: clamp(4px, 0.434vh, 0.434vh);
              padding-top: 0;
            }
  
            .el-input {
              height: 100%;
              min-height: var(--form-wrapper-login-form-item-div-height);
  
              .el-input__wrapper {
                height: 100%;
                border-radius: 0.208vw;
                border: 1px solid var(--border-color);
                box-shadow: none !important;
                padding: 0.108vh 0.572vw;
  
                .el-input__prefix-inner, .el-input__suffix-inner {
                  color: var(--input-text-color);
                }

                .el-input__prefix-inner {
                  .el-icon {
                    margin-right: 0.416vw;
                  }
                }
              }
  
              .el-input__inner {
                font-size: var(--font-size-num-16);
                height: 100%;
                &::placeholder {
                  font-size: var(--font-size-num-16);
                  color: var(--input-text-color);
                }
              }
  
              &.company-input .el-input__inner {
                color: var(--text-color-secondary);
                cursor: var(--cursor-default);
  
                &::placeholder {
                  color: var(--input-text-color);
                }
              }
  
              .password-visible {
                cursor: pointer;
              }
            }

            .el-button {
              height: var(--form-wrapper-login-form-item-div-height);
              font-size: var(--font-size-num-16);
              border-radius: clamp(4px, 0.208vw, 0.208vw);
            }
          }
          .form-title-text {
            height: var(--font-size-num-24);
            p {
              font-size: var(--font-size-num-16);
            }
            .el-form-item__error {
              margin-top: 0;
              height: 0 !important;
            }
          }
        }

        .btn-submit {
          height: var(--form-wrapper-login-form-item-div-height) !important;
          border-radius: clamp(4px, 0.208vw, 0.208vw);
          margin: 18px 0 0 0;
        }
      }

    }
  }
}

.workbench-login.is-preview {
  .login-right {
    pointer-events: none !important;
  }
}

.footer {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  padding: 8px 16px;
  border-radius: 4px;
  color: rgba(23, 26, 29, 0.6);
  font-size: 14px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  row-gap: 8px;
  pointer-events: all;

  .footer-police-main {
    display: flex;
    align-items: center;
    .filing-item {
      display: flex;
      align-items: center;
    }
    .footer-copyright {
      line-height: 22px;
      font-size: 12px;
      margin-right: 10px;
    }
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

@media (max-width: 1024px) {
  .workbench-login:not(.is-preview) {
    height: auto;
    min-height: 100vh;
    flex-direction: column;

    .login-container {
      flex: 1;
      min-height: 620px;
      justify-content: center;
      padding: 0px;

      .login-left {
        display: none;
      }

      .login-right {
        margin: 0px;
      }
    }

    .footer {
      position: static;
      width: 100%;
      transform: none;
      box-sizing: border-box;
      padding: 0 16px 20px;

      .footer-police-main {
        justify-content: center;
        flex-wrap: wrap;
        gap: 4px 10px;

        .footer-copyright {
          margin-right: 0;
          white-space: nowrap;
        }
      }
    }
  }
}
</style>
