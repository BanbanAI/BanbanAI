<template>
  <div class="dialog-content">
    <el-form :model="passwordForm" label-position="top" :rules="passFormRules" ref="passwordFormRefs">
        <el-form-item :label="$t('editPasswordDialog.pwdCurrent')" prop="oldPassword" v-if="!passport.user.noPassword">
          <el-input type="password" show-password v-model="passwordForm.oldPassword" autocomplete="off"
            :placeholder="$t('editPasswordDialog.pwdCurrentPlaceholder')" ref="curPasswordRef" />
        </el-form-item>
        <el-form-item :label="$t('editPasswordDialog.code')" prop="code" v-else>
          <el-input v-model="passwordForm.code" :placeholder="$t('editPasswordDialog.codePlaceholder')" ref="codeRef" />
          <el-button @click="sendLoginCode" :disabled="verifyButtonState.cooling"
            :loading="verifyButtonState.loading"
            :class="verifyButtonState.cooling ? 'verify-active verify-btn' : 'verify-btn'">
            {{ verifyButtonState.cooling ? verifyButtonState.text : $t('editPasswordDialog.codeGetText') }}
          </el-button>
        </el-form-item>
        <el-form-item :label="$t('editPasswordDialog.pwdNew')" prop="newPassword">
          <el-input type="password" show-password v-model="passwordForm.newPassword" :minlength="6" maxlength="20"
            autocomplete="off" :placeholder="$t('editPasswordDialog.pwdNewPlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('editPasswordDialog.pwdNewConfirmation')" prop="rePassword">
          <el-input type="password" show-password v-model="passwordForm.rePassword" :minlength="6" maxlength="20"
            autocomplete="off" :placeholder="$t('editPasswordDialog.pwdNewConfirmationPlaceholder')" />
        </el-form-item>
      </el-form>
  </div>
</template>

<script lang="ts" setup>
import { usePassportStore } from '@renderer/stores';
import axios from 'axios';
import { ElButton, ElForm, ElFormItem, ElInput, ElMessage, FormInstance, FormRules, InputInstance } from 'element-plus';
import { reactive, ref } from 'vue';
import i18next from "i18next";

defineProps<{
}>();

const emit = defineEmits<{
}>();

const passport = usePassportStore();

const passwordFormRefs = ref<FormInstance>();
const curPasswordRef = ref<InputInstance>();
const codeRef = ref<InputInstance>();
// 用户密码表单
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  rePassword: '',
  code: ''
})
const verifyButtonState = ref({ text: '', cooling: false, loading: false })

const sendLoginCode = async () => {
  verifyButtonState.value.loading = true
  const res = await axios.post("/user/send-login-code", { phone: passport.user.phone, phoneArea: '86' }).catch(err => {
    console.log("/user/send-login-code", err);
    ElMessage.error({ message: err.response.data.message });
  }).finally(() => {
    verifyButtonState.value.loading = false;
  });
  if (res) {
    verifyButtonState.value.cooling = true
    ElMessage.success(i18next.t("editPasswordDialog.smsTip"))
    let count = 60
    const timer = setInterval(() => {
      if (count === 0) {
        clearInterval(timer)
        verifyButtonState.value.text = '';
        verifyButtonState.value.cooling = false
        return
      }
      verifyButtonState.value.text = (count--) + i18next.t("editPasswordDialog.codeGetTip");
    }, 1000)
  }
}

// 密码验证规则
const passFormRules: FormRules = {
  oldPassword: [{
    validator: (rule, value, callback) => {
      if (!passport.user.noPassword && !value || value === '') {
        callback(i18next.t("editPasswordDialog.pwdCurrentEmptyTip"))
      }
      callback()
    },
    trigger: 'blur'
  }],
  code: [{
    validator: (rule, value, callback) => {
      if (passport.user.noPassword && !value || value === '') {
        callback(i18next.t("editPasswordDialog.codeEmptyTip"))
      }
      callback()
    },
    trigger: 'blur'
  }],
  newPassword: [{
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
  rePassword: [{
    validator: (rule, value, callback) => {
      if (!value || value === '') {
        callback(i18next.t("editPasswordDialog.pwdFormatTip"))
      } else if (!/^[0-9a-zA-Z_@]{6,20}$/.test(value)) {
        callback(i18next.t("editPasswordDialog.pwdFormatTip"))
      } else if (value !== passwordForm.newPassword) {
        callback(i18next.t("editPasswordDialog.pwdNotEquateTip"))
      }
      callback()
    },
    trigger: 'blur'
  }]
}


// 修改密码
const changePassword = async() => {
  let res = null
  await passwordFormRefs.value.validate(async (valid) => {
    if (!valid) return;

    res = await axios.post(`/user/update-password`, {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      code: passwordForm.code,
    }).catch(err => {
      ElMessage.error(err.response.data.message)
    });

    if (res) {
      passport.updateUser(res.data)
      ElMessage.success(i18next.t("editPasswordDialog.editSuccess"))
      passwordFormRefs.value.resetFields()
    }
  })

  return res
}

const resetFields = () => {
  passwordFormRefs.value.resetFields()
}

defineExpose({ changePassword, resetFields })

</script>

<style lang="scss" scoped>
.dialog-content {
  padding: 24px 24px 6px 24px;

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
        line-height: 16px;
      }

      .el-input__wrapper {
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
      }
    }
  }
}
</style>
