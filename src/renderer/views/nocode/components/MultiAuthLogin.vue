<template>
  <vn-stack class="login-view" v-model="activeWay">
    <div class="multi-auth-login">
      <div class="multi-auth-tabs">
        <vn-stack-tab name="codeLogin">
          <span :class="{ 'tab-active': activeWay === 'codeLogin' }">{{ $t('nocodeLoginDialog.codeLogin') }}</span>
        </vn-stack-tab>
        <vn-stack-tab name="passwordLogin">
          <span :class="{ 'tab-active': activeWay === 'passwordLogin' }">{{ $t('nocodeLoginDialog.passwordLogin') }}</span>
        </vn-stack-tab>
      </div>

      <div class="multi-auth-panes">
        <vn-stack-layer class="tab" name="codeLogin">
          <el-form ref="phoneFormRef" :model="phoneFormData" :rules="passFormRules" label-width="auto" >
            <el-form-item type="phone" prop="phone">
              <el-input type="text" v-model="phoneFormData.phone" oninput="value=value.replace(/[^\d]/g,'')" :placeholder="$t('nocodeLoginDialog.phoneTip')">
                <template #prefix>
                  <div class="beginning-phone-number">+86</div>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item prop="code">
              <el-input v-model="phoneFormData.code" :placeholder="$t('nocodeLoginDialog.codeTip')">
                <template #suffix>
                  <el-button link class="get-code" :class="{'canNotRequset': countdown <= 59 && !sendCodeLoading}" :loading="sendCodeLoading" @click="handleRequestCode">{{ sendCodeLoading || countdown > 59 ? $t('nocodeLoginDialog.getCode') : (countdown + 's') }}</el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-form>
        </vn-stack-layer>
        <vn-stack-layer class="tab" name="passwordLogin">
          <el-form ref="passwordFormRef" :model="passwordFormData" :rules="passFormRules" label-width="auto" >
            <el-form-item prop="username">
              <el-input v-model="passwordFormData.username" :placeholder="$t('nocodeLoginDialog.accountTip')"/>
            </el-form-item>
            <el-form-item prop="password">
              <el-input type="password" v-model="passwordFormData.password" :placeholder="$t('WorkBenchAccount.passwordPlaceholder2')" show-password/>
            </el-form-item>
          </el-form>
        </vn-stack-layer>
        <a v-show="activeWay === 'passwordLogin'" @click="handleRetrievePassword">{{ $t("nocodeLoginDialog.forgetPassword") }}</a>
      </div>

      <div class="multi-auth-footer">
        <el-button class="btn-next" type="primary"  :loading="submitLoading" @click="onClickLogin" :disabled="loginBtnDisabled">{{ $t("nocodeLoginDialog.login") }}</el-button>
        <div class="register-tip" v-if="false">
          {{ $t("nocodeLoginDialog.registerTip") }}<a class="baseline" target="browser" href="">{{ $t("nocodeLoginDialog.registerLink") }}</a>
        </div>
        <div class="agreement-tip">
          <agreement-checkbox ref="agreementCheckboxRef"></agreement-checkbox>
        </div>
      </div>
    </div>
  </vn-stack>
</template>

<script setup lang='ts'>
import { ElMessage, ElButton, FormRules } from 'element-plus';
import { ref, toRaw, onBeforeMount, computed } from 'vue';
import { useDialogStore, usePassportStore } from '@renderer/stores';
import axios from "axios";
import i18next from "i18next";
const emit = defineEmits<{
  (event: 'retrievePassword')
  (e: 'closed'): void,
  (e: 'update:modelValue', value: boolean),
  (e: 'loginEnd'),
}>();

const passportState = usePassportStore();

const loginTip = ref('');
const dialogState = useDialogStore()

const agreementCheckboxRef = ref();
const submitLoading = ref(false)
const passwordFormRef = ref()
const phoneFormData = ref({ phone: '', code: '' });
const passwordFormData = ref({ username: '', password: '' });
let isRequestCode = false;
const phoneFormRef = ref();
const passFormRules: FormRules = {
  phone: [
    {
      required: true,
      get message() { return i18next.t('nocodeLoginDialog.notPhoneTip') },
      trigger: 'blur'
    },
    {
      pattern: /^1[3-9]\d{9}$/,
      get message() { return i18next.t('nocodeLoginDialog.errorPhoneTip') },
      trigger: 'blur'
    }
  ],
  code: [
    {
      required: false,
      get message() { return i18next.t('nocodeLoginDialog.notCodeTip') },
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (isRequestCode && !value) {
          callback(new Error(i18next.t('nocodeLoginDialog.notCodeTip')));
        } else {
          callback();
        }
      }
    },
    {
      pattern: /^\d{6}$/,
      get message() { return i18next.t('nocodeLoginDialog.errorCodeTip') },
      trigger: 'blur'
    }
  ],
  username: [
    {
      required: true,
      get message() { return i18next.t('nocodeLoginDialog.notUsernameTip') },
      trigger: 'blur'
    }
  ],
  password: [
    {
      required: true,
      get message() { return i18next.t('nocodeLoginDialog.notPasswordTip') },
      trigger: 'blur'
    }
  ]
}
let timer: number = null;
const countdown = ref(60);
const sendCodeLoading = ref(false);
const activeWay = ref('codeLogin')

const onClickLogin = () => {
  if (activeWay.value === 'codeLogin') {
    loginByPhone()
  } else {
    loginUser()
  }
}

const handleRetrievePassword = () => {
  emit('retrievePassword');
}

const loginBtnDisabled = computed(() => {
  return !(phoneFormData.value.phone && phoneFormData.value.code || passwordFormData.value.username && passwordFormData.value.password);
});

//密码登录
const loginUser = async () => {
  if (!agreementCheckboxRef.value.checkIsAgree(() => loginUser())) return;
  submitLoading.value = true;

  const res = await axios.post('/user/login', toRaw(passwordFormData.value)).catch(err => {
    filterErrorNotice(err.response.data.message);
    ElMessage.error(err.response.data.message);
  }).finally(() => {
    submitLoading.value = false;
  });
  if (res) {
    passportState.updateUser(res.data.user)
    handleLoginEnd()
  }
}

//发送短信
const handleRequestCode = async () => {
  if (sendCodeLoading.value || countdown.value <= 59) return;

  sendCodeLoading.value = true
  phoneFormRef.value.validateField("phone", async (valid) => {
    if (valid) {
      const phone = phoneFormData.value.phone;
      const res = await axios.post("/user/send-login-code", { phone: phone, phoneArea: '86' }).catch(err => {
        filterErrorNotice(err.response.data.message);
      }).finally(() => {
        sendCodeLoading.value = false;
      });
      if (res) {
        ElMessage.success(i18next.t("loginDialog.smsTip"))
        isRequestCode = true;
        if (timer) {
          clearInterval(timer);
          timer = null;
        }

        countdown.value = 59;
        timer = setInterval(() => {
          if (timer && countdown.value === 0) {
            clearInterval(timer);
            timer = null;
            countdown.value = 60;
            return;
          }
          countdown.value--;
        }, 1000);
      } else {
      }
    } else {
      ElMessage.warning(i18next.t('nocodeLoginDialog.errorPhoneTip'));
      sendCodeLoading.value = false;
    }
  });
}

//手机短信登录
const loginByPhone = () => {
  if (!agreementCheckboxRef.value.checkIsAgree(() => loginByPhone())) return;

  phoneFormRef.value.validate(async (valid) => {
    submitLoading.value = true
    if (valid) {
      const res = await axios.post("/user/login-by-phone", toRaw(phoneFormData.value)).catch(err => {
        filterErrorNotice(err.response.data.message);
      }).finally(() => {
        submitLoading.value = false;
      });
      if (res) {
        passportState.updateUser(res.data.user)
        handleLoginEnd()
      }
    } else {
      submitLoading.value = false;
      ElMessage.warning(i18next.t('nocodeLoginDialog.errorPhoneTip'));
    }
  })
}

const filterErrorNotice = (message: string) => {
  if (message.includes('getaddrinfo ENOTFOUND')) {
    loginTip.value = i18next.t("loginDialog.networkError");
  }else {
    loginTip.value = message;
  }
}
const handleLoginEnd = () => {
  dialogState.hide("loginDialogVisible");
  emit('loginEnd');
}

onBeforeMount(() => {
  phoneFormRef.value?.resetFields();
  passwordFormRef.value?.resetFields();
})
</script>

<style scoped lang='scss'>
.multi-auth-login {
  display: flex;
  flex-direction: column;

  .multi-auth-tabs {
    width: 158px;
    height: 20px;
    font-size: 14px;
    display: flex;
    line-height: 30px;
    justify-content: flex-start;
    margin-bottom: 28px;
    gap: 32px;

    span {
      cursor: var(--cursor-pointer);
    }

    .tab-active {
      box-shadow: 0 3px 0 0 #0873FF;
    }
  }

  .multi-auth-panes {
    width: 100%;
    position: relative;

    :deep(.el-input__wrapper) {
      height: 40px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      box-shadow: none;
      border: none;
    }

    .beginning-phone-number {
      line-height: 20px;
      color: var(--text-color-regular);
      border-right: 1px solid var(--border-color-light);
      padding-right: 16px;
    }

    .get-code {
      padding-left: 12px;
      border-left: 1px solid var(--border-color-light);
      cursor: var(--cursor-pointer);

      &:hover {
        border-left-color: var(--border-color-light) !important;
      }

      &.canNotRequset {
        width: 30px;
        cursor: no-drop;
      }
    }

    &>a {
      position: absolute;
      top: 104px;
      right: 0;
      color: var(--color-primary);
    }
  }

  .multi-auth-footer {
    margin-top: 48px;
    width: 100%;

    .btn-next {
      width: 100%;
      height: 40px;
      border-radius: 4px;
      margin-bottom: 8px;
      :disabled {
        background-color: #82C5FF;
      }
    }

    .register-tip,
    .agreement-tip {
      width: 100%;
      font-size: 12px;
      line-height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-color-primary);

      a {
        color: var(--color-primary);
        cursor: var(--cursor-pointer);
        line-height: 14px;
        display: flex;
        align-items: center;

        &.baseline {
          text-decoration: underline;
        }
      }

      .el-button {
        color: var(--color-primary);
        cursor: var(--cursor-pointer);
        margin: 16px 0 24px 0;
      }

      .checkbox {
        width: 16px;
        height: 16px;
        margin-right: 4px;
        cursor: var(--cursor-pointer);
      }
    }
  }
}

.confirm-dialog{
  .el-dialog__title{
    color: rgb(170, 170, 170);
    font-weight: bold;
  }
  .el-dialog__body{
    font-size: 12px;
    text-align: left;
    color: #999;
    display: flex;
    align-items: center;
  }

  a {
    font-size: 12px;
    color: #228CFC;
    vertical-align: inherit;
  }
  a:hover {
    color:#3375b9;
  }
}
</style>
