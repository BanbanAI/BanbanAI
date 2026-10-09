<template>
  <div class="workbench-home-user">
    <div class="workbench-home-user-content">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="auto"
        label-position="right"
      >
        <el-form-item :label="$t('WorkbenchHomeUser.account') + getI18nLabelColon()" prop="user">
          <el-input class="input-readonly" v-model="formData.user" readonly />
        </el-form-item>
        <el-form-item :label="$t('WorkbenchHomeUser.password') + getI18nLabelColon()" prop="pass">
          <el-input v-model="formData.pass" type="password" readonly>
            <template #append>
              <el-button class="edit-password" @click="updateVisibleEditPassword(true)">
                {{ $t("WorkbenchHomeUser.edit") }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item :label="$t('WorkbenchHomeUser.name') + getI18nLabelColon()" prop="realname" v-if="!isWebAdmin">
          <el-input class="input-readonly" v-model="formData.realname" readonly />
        </el-form-item>
        <el-form-item :label="$t('WorkbenchHomeUser.phone') + getI18nLabelColon()" prop="phone" v-if="!isWebAdmin">
          <el-input v-model="formData.phone" />
        </el-form-item>
        <el-form-item :label="$t('WorkbenchHomeUser.email') + getI18nLabelColon()" prop="email" v-if="!isWebAdmin">
          <el-input v-model="formData.email" />
        </el-form-item>
        <el-form-item v-if="!isWebAdmin">
          <el-button @click="onSubmit" class="submit-button" type="primary">
            {{ $t("WorkbenchHomeUser.save") }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <edit-user-password-dialog
      v-model="visibleEditPassword"
      @edit:formPassword="editFormPassword"
    />
  </div>
</template>

<script setup lang='ts'>
import axios from 'axios';
import { computed, ref, watch } from 'vue';
import { ElMessage, FormRules } from 'element-plus';
import { NocodeUser } from '@common/types/account';
import { usePassportStore } from '@renderer/stores';
import i18next from 'i18next';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';
import { getI18nLabelColon } from '@common/utils/i18n';

useLocalizedDocumentTitle(() => `${i18next.t("WorkbenchHomeUser.workbench")} - ${i18next.t("WorkbenchHomeUser.userInfo")}`);

const passportState = usePassportStore();
const formRef = ref();
const visibleEditPassword = ref(false);

const formData = ref({
  user: "",
  pass: "asdfghjkl",
  realname: "",
  phone: "",
  email: "",
});

const rules: FormRules = {
  user: [{
    required: true, get message() { return i18next.t("WorkbenchHomeUser.accountRequired") }, trigger: "blur"
  }],
  pass: [{
    required: true, get message() { return i18next.t("WorkbenchHomeUser.passwordRequired") }, trigger: "blur"
  }],
  realname: [{
    required: true, get message() { return i18next.t("WorkbenchHomeUser.nameRequired") }, trigger: "blur"
  }],
  phone: [
    { required: false, get message() { return i18next.t("WorkbenchHomeUser.phoneRequired") }, trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, get message() { return i18next.t("WorkbenchHomeUser.phoneFormatError") }, trigger: "blur" }
  ],
  email: [
    { required: false, get message() { return i18next.t("WorkbenchHomeUser.emailRequired") }, trigger: "blur" },
    { pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, get message() { return i18next.t("WorkbenchHomeUser.emailFormatError") }, trigger: ["blur", "change"] }
  ]
};

const userInfo = computed(() => passportState.account as NocodeUser);
const isWebAdmin = computed(() => passportState.isMainAccount);

function updateVisibleEditPassword(val: boolean) {
  visibleEditPassword.value = val;
}

async function editFormPassword(val) {
  const { newPassword, oldPassword } = val;
  await axios.post(`/workbench/update-password`, {
    oldPassword,
    newPassword,
  }).then(() => {
    ElMessage.success(`${i18next.t("WorkbenchHomeUser.passwordEditSuccess")}`);
    visibleEditPassword.value = false;
  }).catch((err) => {
    ElMessage.error(err?.response?.data?.message || err.message);
  });
}

function initUserData() {
  const currentUser = userInfo.value || {} as NocodeUser;
  const {
    user = "",
    realname = "",
    phone = "",
    email = "",
  } = currentUser;

  Object.assign(formData.value, {
    user,
    pass: "asdfghjkl",
    realname,
    phone,
    email,
  });
}

watch(
  () => userInfo.value?.id,
  (id) => {
    if (id) {
      initUserData();
    }
  },
  { immediate: true },
);

async function onSubmit() {
  await formRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }

    const { pass, ...rest } = formData.value;
    const user = {
      ...rest,
      id: userInfo.value?.id,
    };

    await axios.post(`/workbench/update-user-info`, { user }).then(() => {
      ElMessage.success(`${i18next.t("WorkbenchHomeUser.saveEditSuccess")}`);
    }).catch((err) => {
      ElMessage.error(err?.response?.data?.message || err.message);
    });
  });
}
</script>

<style scoped lang='scss'>
.workbench-home-user {
  height: 100%;

  .workbench-home-user-content {
    height: 100%;
    margin: 0 auto;
    background-color: var(--bg-color-page);
    padding: 16px;
    border-radius: 4px;

    :deep(.el-form) {
      width: 512px;

      .el-form-item {
        .el-input__wrapper {
          box-shadow: unset;
          background-color: var(--bg-color-overlay);
          border-radius: 4px;

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focus {
            box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
          }
        }

        .el-input-group__append {
          width: 48px;
          margin-left: 8px;
          background-color: var(--bg-color-overlay);
          box-shadow: unset;
          color: var(--color-primary);
          border-radius: 4px;
          cursor: var(--cursor-pointer);
          padding: 0;

          .edit-password {
            width: 100%;
            padding: 0;
          }
        }

        .submit-button {
          border-radius: 4px;
        }
      }
    }
  }
}

:deep(.input-readonly) .el-input__inner {
  color: var(--text-color-placeholder)
}
</style>
