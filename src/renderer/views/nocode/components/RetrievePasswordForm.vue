<template>
  <div class="dialog-content">
    <el-form ref="recallPwdFormRef" :model="recallPwdFormData" :rules="passFormRules" label-width="auto" >
      <el-form-item type="phone" prop="phone">
        <el-input type="text" v-model="recallPwdFormData.phone" oninput="value=value.replace(/[^\d]/g,'')" :placeholder="$t('nocodeLoginDialog.phoneTip')">
          <template #prefix>
            <div class="beginning-phone-number">+86</div>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item prop="code">
        <el-input v-model="recallPwdFormData.code" :placeholder="$t('nocodeLoginDialog.codeTip')">
          <template #suffix>
            <el-button link class="get-code" :class="{'canNotRequset': countdown <= 59 && !sendCodeLoading}" :loading="sendCodeLoading" @click="handleRequestCode">{{ countdown > 59 || sendCodeLoading ? $t('nocodeLoginDialog.getCode') : (countdown + 's') }}</el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item prop="password">
        <el-input v-model="recallPwdFormData.password" :placeholder="$t('retrievePasswordForm.newPasswordPlaceholder')" show-password ref="passwordRef" />
      </el-form-item>
      <el-form-item prop="password2">
        <el-input v-model="recallPwdFormData.password2" @keyup.enter.native="nextStepLoading" :placeholder="$t('retrievePasswordForm.pwdNewConfirmationPlaceholder')" show-password />
      </el-form-item>
    </el-form>
  </div>
</template>

<script lang="ts" setup>
import { ref, toRaw, onBeforeMount} from 'vue';
import i18next from "i18next";
import { FormRules, ElMessage } from 'element-plus';
import axios from "axios";

let timer: NodeJS.Timeout | null = null;
const countdown = ref(60);
const recallPwdFormData = ref({ phone: '', code: '', password: '', password2: '' });
const recallPwdFormRef = ref();
const sendCodeLoading = ref(false);
const nextStepLoading = ref(false)
let isRequestCode = false;
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
  password: [{
    validator: (rule, value, callback) => {
      if (!value || value === '') {
        callback(i18next.t("editPasswordDialog.pwdNewPlaceholder"))
      } else if (!/^[0-9a-zA-Z_@]{6,20}$/.test(value)) {
        callback(i18next.t("editPasswordDialog.pwdNewPlaceholder"))
      }
      callback()
    },
    trigger: 'blur'
  }],
  password2: [{
    validator: (rule, value, callback) => {
      if (!value || value === '') {
        callback(i18next.t("editPasswordDialog.pwdFormatTip"))
      } else if (!/^[0-9a-zA-Z_@]{6,20}$/.test(value)) {
        callback(i18next.t("editPasswordDialog.pwdFormatTip"))
      } else if (value !== recallPwdFormData.value.password) {
        callback(i18next.t("editPasswordDialog.pwdNotEquateTip"))
      }
      callback()
    },
    trigger: 'blur'
  }]
}

const loginTip = ref('');
const filterErrorNotice = (message: string) => {
  if (message.includes('getaddrinfo ENOTFOUND')) {
    loginTip.value = i18next.t("loginDialog.networkError");
  }else {
    loginTip.value = message;
  }
}

//发送短信
const handleRequestCode = async () => {
  if (sendCodeLoading.value || countdown.value <= 59) return;

  sendCodeLoading.value = true
  recallPwdFormRef.value.validateField("phone", async (valid) => {
    if (valid) {
      const phone = recallPwdFormData.value.phone;
      const res = await axios.post("/user/send-recall-password-phone-code", { account: phone, phoneArea: '86' }).catch(err => {
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

const changePassword = async () => {
  let res = null;
  await recallPwdFormRef.value.validate(async (valid, fields) => {
    if (valid) {
      let params: any = { ...toRaw(recallPwdFormData.value) }
      let requestUrl = "/user/recall-password-verify-phone"
      params.phoneArea = '86'
      nextStepLoading.value = true
      const SMSVerificationRes = await axios.post(requestUrl, { account: recallPwdFormData.value.phone, phoneArea: '86', code: recallPwdFormData.value.code }).catch(({ response }) => {
        ElMessage.error(response?.data?.message);
      })

      if (SMSVerificationRes) {
        const requestUrl = "/user/recall-password";
        res = await axios.post(requestUrl, {
          account: recallPwdFormData.value.phone,
          password: recallPwdFormData.value.password,
          password2: recallPwdFormData.value.password2,
        }).catch(err => {
          ElMessage.error({ message: err });
        });
        if (res) {
          ElMessage.success(i18next.t("editPasswordDialog.editSuccess"))
        }
      }
    } else {
      const firstErrorField = Object.keys(fields)[0];
      if (firstErrorField) {
        switch (firstErrorField) {
          case 'phone':
            ElMessage.warning(i18next.t('nocodeLoginDialog.errorPhoneTip'));
            break;
          case 'code':
            ElMessage.warning(i18next.t('nocodeLoginDialog.errorCodeTip'));
            break;
          default:
            ElMessage.warning(i18next.t('nocodeLoginDialog.errorPasswordTip2'));
          }
      }
      return;
    }
  })

  return res
}

const resetFields = () => {
  recallPwdFormRef.value?.resetFields()
}

onBeforeMount(() => {
  resetFields();
})

defineExpose({ changePassword, resetFields })

</script>

<style lang="scss" scoped>
.dialog-content {
  :deep(.el-form-item) {
    display: flex;
    align-items: center;
    margin-bottom: 16px;

    .el-form-item__label {
      width: 76px;
    }

    .el-form-item__content {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;

      .el-form-item__error {
        padding-top: 0;
        font-size: 10px;
      }

      .el-input__wrapper {
        height: 40px;
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
        box-shadow: none;
        border: none;
      }
    }
  }
  .beginning-phone-number {
    line-height: 16px;
    margin-right: 20px;
    padding-right: 24px;
    border-right: 1px solid var(--border-color-light);
    cursor: var(--cursor-pointer);
    color: var(--text-color-primary);
  }

  .get-code {
    font-size: 12px;
      padding-left: 16px;
      padding-right: 5px;
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
}
</style>
