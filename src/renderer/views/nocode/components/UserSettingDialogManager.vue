<template>
  <div class="exit-dialog">
    <el-dialog :model-value="modelValue" align-center @update:model-value="emit('update:modelValue', $event)"
      width="400px" :close-on-press-escape="false" :close-on-click-modal="false" @open="handleDialogOpened" @close="handleDialogClose">
      <template #header>
        <div class="title">
          <el-icon class="icon-back app-no-drag" v-show="step !== Step.Nickname" @click="() => step--"
            :size="16"><i-ant-design-left-outlined /></el-icon>
          {{ step === Step.Nickname ? $t("AccountSettingDialog.accountSetting") : step === Step.Password ? $t("AccountSettingDialog.editPassword") : $t("loginRetrieve.retrieve")
          }}
        </div>
      </template>
      <div v-if="step === Step.Nickname" class="dialog-content">
        <el-form class="form-user" label-width="auto" :label-position="'right'" :model="formAccount"
          :rules="accountFormRules" ref="formAccountRef">
          <el-form-item :label="$t('AccountSettingDialog.account')">
            <el-input v-model="formAccount.loginName" :disabled="true" />
          </el-form-item>
          <el-form-item :label="$t('AccountSettingDialog.nickname')">
            <el-input v-model="formAccount.nickname" />
          </el-form-item>
          <el-form-item :label="$t('AccountSettingDialog.password')">
            <el-input type="password" v-model="formAccount.password" readonly>
            </el-input>
            <el-button class="edit-password-btn" @click="()=> { step++ }">{{ $t("AccountSettingDialog.modify")
              }}</el-button>
          </el-form-item>
        </el-form>
      </div>
      <edit-password-form ref="editPasswordRef" v-else-if="step === Step.Password"></edit-password-form>
      <retrieve-password-form ref="retrievePasswordRef" v-else></retrieve-password-form>
      <template #footer>
        <div class="footer">
          <el-button class="btn-forgetPassword" v-if="step === Step.Password && !passportState.user.noPassword" link type="primary" @click="forgetPassword()">{{ $t("nocodeLoginDialog.forgetPassword") }}</el-button>
          <el-button class="btn-cancel" @click="emit('update:modelValue', false)">{{ $t("AccountSettingDialog.cancel") }}</el-button>
          <el-button class="btn-confirm" type="primary" @click="handleConfirmEdit">{{ $t("AccountSettingDialog.confirm") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { usePassportStore } from "@renderer/stores";
import { nextTick, ref, watch } from "vue";
import { ElMessage, FormRules } from "element-plus";
import i18next from "i18next";
import axios from "axios";

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
}>();

const props = defineProps<{
  modelValue: boolean
}>();

enum Step {
  Nickname,
  Password,
  RetrievePass
}

const passportState = usePassportStore();
const visibleAccountSet = ref(false)
const formAccount = ref({
  loginName: '123456',
  nickname: '',
  password: 'asdfghjkl',
});
const formAccountRef = ref()
const editPasswordRef = ref()
const retrievePasswordRef = ref()
const step = ref<Step>(Step.Nickname)
const accountFormRules: FormRules = {
  nickname: [
    {
      required: true,
      get message() { return i18next.t('AccountSettingDialog.formNicknameTip') },
      trigger: 'blur'
    }
  ]
}

const initFormAccount = () => {
  const { loginName, nickname } = passportState.user;
  formAccount.value.loginName = loginName;
  formAccount.value.nickname = nickname;
}

if (passportState.user.id) {
  initFormAccount();
} else {
  const stop = watch(
    () => passportState.user.id,
    (newId) => {
      if (newId) {
        initFormAccount();
        nextTick(() => {
          stop();
        })
      }
    }
  )
}
const updateVisibleAccountSet = (val: boolean) => {
  visibleAccountSet.value = val
}

const editNickname = async () => {
  const res = await axios.post(`/user/update-nickname`, { nickname: formAccount.value.nickname }).catch(() => {
    ElMessage.error(i18next.t("editNickNameDialog.nicknameRepeatTip"))
  });
  if (res) {
    passportState.updateUser(res.data.user);
    ElMessage.success(i18next.t("editNickNameDialog.editSuccess"))
    emit('update:modelValue', false)
  }
}
const handleConfirmEdit = async () => {
  if (step.value === Step.Nickname) {
    editNickname()
  } else if (step.value === Step.Password) {
    let res = await editPasswordRef.value.changePassword()
    if (res) {
      emit('update:modelValue', false)
    }
  } else {
    let res = await retrievePasswordRef.value.changePassword()
    if (res) {
      emit('update:modelValue', false)
    }
  }
}

const forgetPassword = () => {
  step.value++
  editPasswordRef.value?.resetFields()
}

const handleDialogOpened = () => {
  initFormAccount()
}

const handleDialogClose = () => {
  editPasswordRef.value?.resetFields()
  retrievePasswordRef.value?.resetFields()
  step.value = Step.Nickname
}

defineExpose({ updateVisibleAccountSet })

</script>


<style scoped lang="scss">
.exit-dialog {
  :deep(.el-dialog) {
    padding: 0;
    background-color: var(--bg-color-page);
    border-radius: 4px;

    .el-dialog__header {
      padding: 0;
      margin: 0;

      button {
        width: 40px;
        height: 40px;
      }
      
      .el-dialog__close {
        color: #36393D;
      }
    }

    .el-dialog__footer {
      padding: 0 16px 16px 16px;

      .el-button {
        border-radius: 4px;
      }
    }
  }

  .title {
    position: relative;
    font-size: 14px;
    text-align: center;
    height: 40px;
    line-height: 40px;
    border-bottom: 1px solid var(--border-color);

    .icon-back {
      color: var(--text-color);
      margin-left: 12px;
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  .form-user {
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }
    :deep(.el-form-item__label) {
      line-height: 36px;
    }
    :deep(.el-input__inner) {
      height: 36px;
      border: none;
    }
  }

  .dialog-content {
    padding: 24px 24px 6px 24px;


    :deep(.el-form-item__content) {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;

      .el-input__wrapper {
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
        border: none;
        box-shadow: none;
      }
    }

    .edit-password-btn {
      width: 60px;
      height: 36px;
      margin-left: 8px;
      padding: 8px 12px;
      font-size: 14px;
      border-radius: 4px;
      color: var(--color-primary);
      background-color: var(--bg-color-overlay);
      border: none;
    }
  }

  .footer {
    position: relative;
    height: 36px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;

    .btn-forgetPassword {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }

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
