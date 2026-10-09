<template>
  <div class="exit-dialog">
    <el-dialog :model-value="modelValue" align-center @update:model-value="emit('update:modelValue', $event)"
      width="400px" :close-on-press-escape="false" :close-on-click-modal="false">
      <template #header>
        <div class="title">
          {{ title ?? $t("AccountSettingDialog.editPassword") }}
        </div>
      </template>
      <div class="dialog-content">
        <el-form :model="formPassword" :rules="passFormRules" label-width="auto" ref="formRef">
          <el-form-item label-position="left" prop="oldPassword" :label="$t('AccountSettingDialog.currentPassword')">
            <el-input type="password" v-model="formPassword.oldPassword" :placeholder="$t('AccountSettingDialog.currentPasswordTip')" show-password/>
          </el-form-item>
          <el-form-item label-position="left" prop="newPassword" :label="$t('AccountSettingDialog.newPassword')">
            <el-input type="password" v-model="formPassword.newPassword" :placeholder="$t('AccountSettingDialog.newPasswordTip')" show-password/>
          </el-form-item>
          <el-form-item class="password-item" prop="rePassword" label-position="left" :label="$t('AccountSettingDialog.confirmNewPassword')">
            <el-input type="password" v-model="formPassword.rePassword" :placeholder="$t('AccountSettingDialog.confirmPasswordTip')" show-password />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="btn-cancel" @click="emit('update:modelValue', false)">{{ $t("AccountSettingDialog.cancel") }}</el-button>
          <el-button class="btn-confirm" type="primary" @click="handleEditPassword">{{ $t("AccountSettingDialog.save") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { usePassportStore } from '@renderer/stores';
import { FormRules} from 'element-plus';
import i18next from "i18next";

type FormPassWord = {
  oldPassword: string,
  newPassword: string,
  rePassword: string,
}

const props = defineProps<{
  modelValue: boolean,
  title?: string
}>();

const emit = defineEmits<{
  (event: 'edit:formPassword', value: FormPassWord)
  (event: 'update:modelValue', value: boolean)
}>();

const passport = usePassportStore();

const formPassword = reactive({
  oldPassword: '',
  newPassword: '',
  rePassword: '',
});
const formRef = ref();
// 密码验证规则
const passFormRules: FormRules = {
  oldPassword: [{
    validator: (rule, value, callback) => {
      if (!passport.user.noPassword && !value || value === '') {
        callback(i18next.t("editPasswordDialog.pwdCurrentEmptyTip"));
      }
      callback();
    },
    trigger: 'blur'
  }],
  newPassword: [{
    validator: (rule, value, callback) => {
      if (!value || value === '') {
        callback(i18next.t("AccountSettingDialog.changePasswordWarning"));
      } else if (!/^[0-9a-zA-Z_@]{6,20}$/.test(value)) {
        callback(i18next.t("AccountSettingDialog.changePasswordWarning"));
      }
      callback();
    },
    trigger: 'blur'
  }],
  rePassword: [{
    validator: (rule, value, callback) => {
      if (!value || value === '') {
        callback(i18next.t("editPasswordDialog.pwdFormatTip"));
      } else if (!/^[0-9a-zA-Z_@]{6,20}$/.test(value)) {
        callback(i18next.t("editPasswordDialog.pwdFormatTip"));
      } else if (value !== formPassword.newPassword) {
        callback(i18next.t("AccountSettingDialog.confirmPasswordWarning"));
      }
      callback();
    },
    trigger: 'blur'
  }]
}

const handleEditPassword = async() => {
  await formRef.value.validate((valid) => {
    if (!valid) return;
    emit('edit:formPassword', formPassword);
  })
}

const clear = () => {
  formPassword.oldPassword = ''
  formPassword.newPassword = ''
  formPassword.rePassword = ''
}

defineExpose({
  clear
})

</script>


<style scoped lang="scss">
.exit-dialog {
  :deep(.el-form-item) {
    margin-bottom: 16px;

      &:last-child {
          margin-bottom: 0;
      }
      .el-form-item__error {
        font-size: 10px;
        display: flex;
        align-items: center;
      }
  }
  :deep(.el-form-item__label) {
    line-height: 36px;
  }
  :deep(.el-input__inner) {
    height: 36px;
    border: none;
  }

  :deep(.el-dialog) {
    padding: 0;
    background-color: var(--bg-color-page);
    border-radius: 4px;

    .el-dialog__header {
      padding: 0;
      margin: 0;

      .title {
        position: relative;
        font-size: 14px;
        text-align: center;
        height: 40px;
        line-height: 40px;
        border-bottom: 1px solid var(--border-color);

        .btn-back {
          position: absolute;
          left: 0;
          top: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }
      }

      button {
        width: 40px;
        height: 40px;
      }
    }
    .el-dialog__close {
      color: #36393D;
    }

    .el-dialog__body {
      padding: 24px 24px 6px 24px;
      width: 100%;
      height: 180px;

      .dialog-content {

        .el-form {
          width: 100%;

          .el-form-item {

            .el-input__wrapper {
              background-color: var(--bg-color-overlay);
              border-radius: 4px;
              border: none;
              box-shadow: none;
            }
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 0 16px 16px 16px;

      .el-button {
        border-radius: 4px;
      }
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
