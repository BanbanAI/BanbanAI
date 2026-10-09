<template>
  <div class="recall-password-dialog">
    <el-dialog v-model="dialogState.recallPasswordDialogVisible" @opened="handleInputFocus" @close="goBackLogin" :close-on-press-escape="false" :close-on-click-modal="false" width="400px">
      <template #header>
        <div class="dialog-title">{{ $t("recallPasswordDialog.dialogHeader") }}</div>
      </template>
      <el-link class="goback-bnt" type="primary" @click="goBackLogin" :underline="false">
        <el-icon>
          <i-ep-arrow-left />
        </el-icon>
        <span>{{ $t("recallPasswordDialog.goBackLogin") }}</span>
      </el-link>
      <div v-if="step === 1">
        <div class="dialog-content">
          <el-form :model="authForm" :rules="authFormRules" ref="authFormRef">
            <el-form-item :label="modeText" label-width="65px" prop="account">
              <el-input v-model="authForm.account" :placeholder="$t('recallPasswordDialog.phonePlaceholder') + modeText" ref="phoneRef">
                <template #prepend v-if="mode === 'phone'">+86</template>
              </el-input>
            </el-form-item>
            <el-form-item :label="$t('recallPasswordDialog.code')" label-width="65px" prop="code">
              <el-input v-model="authForm.code" @keyup.enter.native="nextStep" :placeholder="$t('recallPasswordDialog.codePlaceholder')" />
              <el-button type="primary" @click="sendCode" :loading="sendCodeState.loading" :disabled="sendCodeDisable">
                {{ sendCodeState.cooling ? sendCodeState.text : $t("recallPasswordDialog.codeGetText") }}
              </el-button>
            </el-form-item>
          </el-form>
          <el-divider>{{ $t("recallPasswordDialog.pwdRetrievalOther") }}</el-divider>
          <el-link @click="handleModeTrigger" :underline="false" type="primary">
            {{ triggerText }}
          </el-link>
        </div>
        <div class="step-controller">
          <el-button type="primary" @click="nextStep" :loading="nextStepLoading">{{ $t("recallPasswordDialog.nextStep") }}</el-button>
        </div>
      </div>
      <div v-else>
        <div class="dialog-content">
          <el-form :model="modifyForm" ref="modifyFormRef" :rules="modifyFormRules">
            <el-form-item :label="$t('recallPasswordDialog.pwdNew')" label-width="80px">
              <el-input v-model="modifyForm.password" :placeholder="$t('recallPasswordDialog.pwdNewPlaceholder')" show-password ref="passwordRef" />
            </el-form-item>
            <el-form-item :label="$t('recallPasswordDialog.pwdNewConfirmation')" label-width="80px">
              <el-input v-model="modifyForm.password2" @keyup.enter.native="submit" :placeholder="$t('recallPasswordDialog.pwdNewConfirmationPlaceholder')" show-password />
            </el-form-item>
          </el-form>
        </div>
        <div class="step-controller">
          <el-button type="primary" @click="submit" :loading="submitLoading">{{ $t("recallPasswordDialog.submitLabel") }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { useDialogStore } from '../../../stores';
import { computed, ComputedRef, ref, toRaw } from 'vue';
import { FormRules, FormInstance, ElMessage, InputInstance } from 'element-plus';
import axios from "axios";
import { nextTick } from 'vue';
import i18next from "i18next";

// data
const dialogState = useDialogStore()
const authForm = ref({ account: '', code: '' })
const modifyForm = ref({ password: '', password2: '' })
const mode = ref<"email" | "phone">("phone")
const step = ref<1 | 2>(1)
const phoneRef = ref<InputInstance>();
const passwordRef = ref<InputInstance>();
const triggerText = computed(() => {
  return mode.value === "email" ? i18next.t("recallPasswordDialog.pwdRetrievalByPhone") : i18next.t("recallPasswordDialog.pwdRetrievalByEmail");
})
const modeText = computed(() => {
  return mode.value === "email" ? i18next.t("recallPasswordDialog.email"): i18next.t("recallPasswordDialog.phone")
})
const sendCodeState = ref({ text: '', cooling: false, loading: false })
const sendCodeDisable = computed(() => !authForm.value.account || sendCodeState.value.cooling)
const authFormRules: ComputedRef<FormRules> = computed(() => {
  return {
    'account': [{
      required: true,
      message: modeText.value + i18next.t("recallPasswordDialog.emptyTip"),
      trigger: 'submit'
    }],
    'code': [{
      required: true,
      message: i18next.t("recallPasswordDialog.codeEmptyTip"),
      trigger: 'submit'
    }]
  }
})
const modifyFormRules: ComputedRef<FormRules> = computed(() => {
  return {
    'password': [{
      required: true,
      message: i18next.t("recallPasswordDialog.pwdNewEmptyTip"),
      trigger: 'submit'
    }],
    'password2': [{
      required: true,
      message: i18next.t("recallPasswordDialog.pwdNewConfirmationEmptyTip"),
      trigger: 'submit'
    }]
  }
})
const authFormRef = ref<FormInstance>();
const modifyFormRef = ref<FormInstance>();
const nextStepLoading = ref(false)
const submitLoading = ref(false)

// methods
const clear = () => {
  authForm.value = { account: '', code: '' }
  modifyForm.value = { password: '', password2: '' }
  step.value = 1
}
const goBackLogin = () => {
  dialogState.hide('recallPasswordDialogVisible')
  dialogState.show('loginDialogVisible')
  clear()
}
const handleInputFocus = () => {
  if (step.value === 1) {
    phoneRef.value.focus();
  } else {
    passwordRef.value.focus();
  }
}
const handleModeTrigger = () => {
  mode.value = mode.value === "email" ? "phone" : "email"
  authForm.value.account = ''
  handleInputFocus();
}
const sendCode = () => {
  if (!authFormRef) return;
  authFormRef.value.validateField("account", async (valid) => {
    if (!valid) return;
    let params: any = { account: authForm.value.account }
    let requestUrl = "/user/send-recall-password-email-code"
    if (mode.value === "phone") {
      params.phoneArea = '86'
      requestUrl = "/user/send-recall-password-phone-code"
    }
    sendCodeState.value.loading = true
    const res = await axios.post(requestUrl, params).then(({ data }) => data).catch(({ response }) => {
      ElMessage.error(response?.data?.message);
    }).finally(() => {
      sendCodeState.value.loading = false;
    });

    if (res) {
      sendCodeState.value.cooling = true
      ElMessage.success(modeText.value + i18next.t("recallPasswordDialog.smsTip"))
      let count = 60
      const timer = setInterval(() => {
        if (count === 0) {
          clearInterval(timer)
          sendCodeState.value.text = '';
          sendCodeState.value.cooling = false
          return
        }
        sendCodeState.value.text = (count--) + i18next.t("recallPasswordDialog.codeGetTip");
      }, 1000)
    }
      
  })
}
const nextStep = () => {
  if (!authFormRef) return;
  authFormRef.value.validate(async (valid) => {
    if (!valid) return;
    let params: any = { ...toRaw(authForm.value) }
    let requestUrl = "/user/recall-password-verify-email"
    if (mode.value === "phone") {
      params.phoneArea = '86'
      requestUrl = "/user/recall-password-verify-phone"
    }
    nextStepLoading.value = true
    const res = await axios.post(requestUrl, params).catch(({ response }) => {
      ElMessage.error(response?.data?.message);
    }).finally(() => {
      nextStepLoading.value = false;
    })
    if (res) {
      step.value += 1;
      await nextTick();
      handleInputFocus();
    }
  })
}
const submit = () => {
  if (!modifyFormRef) return;
  modifyFormRef.value.validate(async (valid) => {
    if (!valid) return;
    const requestUrl = "/user/recall-password";
    const res = await axios.post(requestUrl, {
      account: authForm.value.account,
      ...toRaw(modifyForm.value)
    }).catch(err => { 
      console.log(requestUrl, err);
      ElMessage.error({ message: err });
    });
    if (res) {
      dialogState.hide('recallPasswordDialogVisible')
      dialogState.show('loginDialogVisible')
      clear()
    }
      
  })
}
</script>

<style lang="scss" scoped>
.recall-password-dialog {
  :deep(.el-overlay) {
    $dialog-header-height: 50px;

    .el-dialog__header {
      padding: 0;
      height: $dialog-header-height;
      border-bottom: 1px solid var(--border-color);
      margin-right: 0;

      .dialog-title {
        font-size: 16px;
        text-align: center;
        line-height: $dialog-header-height;
        color: #c1c1c1;
      }
    }

    .el-dialog__body {
      padding: 12px;
      position: relative;

      .el-link {
        font-size: 12px;
      }

      .goback-bnt {
        position: absolute;
      }

      .dialog-content {
        padding: 40px 8px;

        .el-form {
          margin-top: 20px;


          .el-form-item {
            .el-form-item__label {
              line-height: 40px;
              text-align: start;
            }

            .el-form-item__content {
              display: flex;
              flex-direction: row;

              .el-button {
                height: 40px;
                margin-left: 10px;
              }

              .el-input {
                padding: 4px 0;
                background-color: #1b1b1b;
                border-radius: 4px;
                flex: 1;

                .el-input-group__prepend {
                  background-color: #1b1b1b;
                  box-shadow: none;
                }

                .el-input__wrapper {
                  background-color: #1b1b1b;
                  box-shadow: none;
                }
              }
            }
          }
        }

        .el-divider {
          margin: 24px 0 16px;

          .el-divider__text {
            color: #52545f;
            font-size: 12px;
          }
        }
      }

      .step-controller {
        text-align: center;
        margin: 16px 0;

        .el-button {
          width: 150px;
        }
      }
    }

    .el-dialog__headerbtn {
      top: 0;
      height: $dialog-header-height;
    }
  }
}
</style>
