<template>
  <div class='inner-row-share-viewer' v-loading='loading'>
    <div v-if='showPasswordPanel' class='visit-login'>
      <div class='wrap-form'>
        <div class='tip'>{{ $t('InnerRowShareViewer.inputAccessPwd') }}</div>
        <el-input
          v-model='password'
          type='password'
          :showPassword='true'
          :placeholder="$t('InnerRowShareViewer.inputPwdPlaceholder')"
          @keyup.enter='handleVerifyVisit'
        />
        <el-button type='primary' @click='handleVerifyVisit'>{{ $t('InnerRowShareViewer.confirm') }}</el-button>
      </div>
    </div>

    <row-share-data-form-page
      v-else-if='bootstrap && nocode?.body'
      :key='pageKey'
      :title="bootstrap.table?.alias || $t('InnerRowShareViewer.title')"
      :nocodeId='bootstrap.nocode.id'
      :tableUID='bootstrap.table.uid'
      :rowUUID='bootstrap.share.rowUUID'
      :rowData='bootstrap.row'
      :formData='bootstrap.formData'
      :nocodeBody='nocode.body'
      :organizeUtil='organizeUtil'
      :loading='loading'
      :isAddDataAble='getAddPermission'
      :isEditDataAble='canEditCurrentRow'
      :isDeleteDataAble='getOtherPermission.delete'
      :memberFieldsAuth='bootstrap.memberFieldsAuth'
      :showDisplayFields='true'
      :showShare='false'
      :showPrint='true'
      :showCopy='getAddPermission'
      :showDelete='getOtherPermission.delete'
      :showEdit='canEditCurrentRow'
      :enableProcessFlow='true'
      :submitHandler='handleSubmit'
      :beforeDelete='handleBeforeDelete'
      @submitted='handleSubmitted'
      @deleted='handleDeleted'
    />
    <el-empty v-else-if='!loading' :description="errorText || $t('InnerRowShareViewer.invalidLink')" />
  </div>
</template>

<script setup lang='ts'>
import { computed, provide, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Nocode } from '@common/types/nocode';
import { getAllRelatedDepartments } from '@common/utils';
import { isEmpty } from '@common/utils/object';
import { accountUtil } from '@renderer/stores/account';
import { usePassportStore } from '@renderer/stores';
import { storeFactory } from '@renderer/utils/storage';
import { NOCODE, NOCODE_THEME_COLOR } from '@renderer/types';
import { projectApi } from '@renderer/utils/api/project';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import RowShareDataFormPage from './RowShareDataFormPage.vue';
import i18next from 'i18next';

const route = useRoute();
const router = useRouter();
const passportState = usePassportStore();
const organizeUtil = new OrganizeUtil();
const token = route.params.token as string;
const rowShareVisitTokenStore = storeFactory('ROW_SHARE_VISIT_TOKEN_STORE', false);
const getCurrentAccountKey = () => {
  const account = passportState.account;
  return String(account?.id || account?.user || '');
};

const loading = ref(false);
const errorText = ref('');
const bootstrap = ref<any>(null);
const nocode = ref<Nocode>(null);
const pageKey = ref(0);
const themeColor = ref('#0089ff');
const password = ref('');
const isNeedPassword = ref(false);
const isVerifyVisitSuccess = ref(false);
const accessToken = ref('');

const showPasswordPanel = computed(() => {
  return isNeedPassword.value && !isVerifyVisitSuccess.value;
});

const getStoredVisitTokenMap = () => {
  return rowShareVisitTokenStore.get() || {};
};

const getVisitStoreKey = () => {
  return `internal:${token}:${getCurrentAccountKey()}`;
};

const getStoredVisitToken = () => {
  return String(getStoredVisitTokenMap()?.[getVisitStoreKey()] || '');
};

const setStoredVisitToken = (value: string) => {
  const tokenMap = getStoredVisitTokenMap();
  tokenMap[getVisitStoreKey()] = value;
  rowShareVisitTokenStore.set(tokenMap);
};

const removeStoredVisitToken = () => {
  const tokenMap = getStoredVisitTokenMap();
  delete tokenMap[getVisitStoreKey()];
  rowShareVisitTokenStore.set(tokenMap);
};

const redirectToLogin = async () => {
  await router.replace({
    path: '/login',
    query: {
      redirect: route.fullPath,
    },
  });
};

const ensureLogin = async () => {
  const loginState = await accountUtil.fetch().catch(() => ({}));
  if (loginState?.valid) {
    return true;
  }
  await redirectToLogin();
  return false;
};

const ensureViewPermission = async (nocodeId: string, tableUID: string) => {
  const { data } = await axios.get('/project/can-view-nocode-layer', {
    params: {
      nocodeId,
      layerId: tableUID,
    },
  });
  return !!data;
};

const initNocode = async (nocodeId: string) => {
  const { data } = await axios.get('workbench/' + nocodeId + '/get-nocode-preview?filter=sharing');
  nocode.value = data;
};

const applyBootstrap = (data: any) => {
  bootstrap.value = data;
  document.title = data.table?.alias || data.nocode?.name || i18next.t('InnerRowShareViewer.title');
  pageKey.value += 1;
};

const loadAccess = async () => {
  const data = await projectApi.getRowShareAccess({
    token,
    scope: 'internal',
  });
  isNeedPassword.value = !!data?.isNeedPassword;
};

const validateAccessToken = async (currentAccessToken: string) => {
  return await projectApi.validateRowShareAccessToken({
    token,
    scope: 'internal',
    accessToken: currentAccessToken,
  }).catch(() => false);
};

const tryAutoLogin = async () => {
  const currentAccessToken = getStoredVisitToken();
  if (!currentAccessToken) return;
  const valid = await validateAccessToken(currentAccessToken);
  if (valid) {
    accessToken.value = currentAccessToken;
    isVerifyVisitSuccess.value = true;
    return;
  }
  removeStoredVisitToken();
};

const loadBootstrap = async () => {
  if (!token) return;
  if (!(await ensureLogin())) return;
  loading.value = true;
  errorText.value = '';
  try {
    const data = await projectApi.getRowShareBootstrap(token, {
      accessToken: accessToken.value,
    });
    const canView = await ensureViewPermission(data.nocode.id, data.table.uid).catch(() => false);
    if (!canView) {
      throw new Error(i18next.t('InnerRowShareViewer.noPermission'));
    }

    await passportState.init(data.nocode.id);
    await Promise.all([
      initNocode(data.nocode.id),
      organizeUtil.getDepartments(),
      organizeUtil.getUsers(),
      organizeUtil.getRoles(),
    ]);

    applyBootstrap(data);
  } catch (error: any) {
    if ([401, 403].includes(error?.response?.status)) {
      await redirectToLogin();
      return;
    }
    bootstrap.value = null;
    nocode.value = null;
    errorText.value = error?.response?.data?.message || error?.message || i18next.t('InnerRowShareViewer.invalidLink');
  } finally {
    loading.value = false;
  }
};

const initPage = async () => {
  if (!token) return;
  if (!(await ensureLogin())) return;
  loading.value = true;
  errorText.value = '';
  try {
    await loadAccess();
    await tryAutoLogin();
    if (showPasswordPanel.value) {
      return;
    }
    await loadBootstrap();
  } catch (error: any) {
    bootstrap.value = null;
    nocode.value = null;
    errorText.value = error?.response?.data?.message || error?.message || i18next.t('InnerRowShareViewer.invalidLink');
  } finally {
    loading.value = false;
  }
};

const handleVerifyVisit = async () => {
  const data = await projectApi.visitRowShare({
    token,
    scope: 'internal',
    password: password.value,
  }).catch((error) => {
    ElMessage.error(error?.response?.data?.message || error?.message);
    return null;
  });
  if (!data?.success) {
    return;
  }
  accessToken.value = String(data.token || '');
  isVerifyVisitSuccess.value = true;
  setStoredVisitToken(accessToken.value);
  await loadBootstrap();
};

const handleSubmit = async (rowPatch) => {
  const data = await projectApi.updateRowShare(token, rowPatch, {
    accessToken: accessToken.value,
  });
  ElMessage.success(i18next.t('PublicRowShareViewer.submitSuccess'));
  return data;
};

const handleBeforeDelete = async () => {
  await projectApi.getRowShareBootstrap(token, {
    accessToken: accessToken.value,
  });
};

const getAddPermission = computed(() => {
  const tableUID = bootstrap.value?.table?.uid;
  if (!tableUID) return false;
  const addPermission = nocode.value?.body?.permissions?.data?.[tableUID]?.add;
  if (!addPermission) return true;
  const account = passportState.account;
  const departments = getAllRelatedDepartments(organizeUtil.departments, account?.departments || []);

  if (addPermission?.rangeType === 'custom' && !account?.isAdmin) {
    if (addPermission.range.users.includes(account.id)) {
      return true;
    }
    if (addPermission.range.roles.some(role => account.roles.includes(role))) {
      return true;
    }
    if (addPermission.range.departments.some(dep => departments.includes(dep))) {
      return true;
    }
    return false;
  }
  return true;
});

const getOtherPermission = computed(() => {
  const tableUID = bootstrap.value?.table?.uid;
  const account = passportState.account;
  if (!tableUID || !account) {
    return { delete: false, update: false };
  }
  if (account.isAdmin) {
    return { delete: true, update: true };
  }
  if (isEmpty(nocode.value?.body?.permissions?.data?.[tableUID]?.other?.length)) {
    return { delete: true, update: true };
  }

  const result = {
    delete: false,
    update: false,
  };
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments || []);
  const permissions = nocode.value?.body?.permissions?.data?.[tableUID]?.other ?? [];

  for (const permission of permissions) {
    const needHandle = (permission.handleRange.delete && !result.delete) || (permission.handleRange.update && !result.update);
    if (!needHandle) continue;
    if (
      permission.memberRange?.rangeType === 'all' ||
      permission.memberRange?.range?.users?.includes(account.id) ||
      permission.memberRange?.range?.roles?.some(role => account.roles?.includes(role)) ||
      permission.memberRange?.range?.departments?.some(dep => departments.includes(dep))
    ) {
      result.delete = result.delete || permission.handleRange?.delete;
      result.update = result.update || permission.handleRange?.update;
    }
    if (result.delete && result.update) break;
  }

  return result;
});

const canEditCurrentRow = computed(() => {
  return !!bootstrap.value?.hasEditableFields && getOtherPermission.value.update;
});

const handleSubmitted = async () => {
  await loadBootstrap();
};

const handleDeleted = async () => {
  await loadBootstrap();
};

initPage();

provide(NOCODE, nocode);
provide(NOCODE_THEME_COLOR, themeColor);
</script>

<style scoped lang='scss'>
.inner-row-share-viewer {
  min-height: 100%;

  .visit-login {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;

    .wrap-form {
      width: 360px;
      padding: 32px;
      border-radius: 12px;
      background-color: #fff;
      box-shadow: 0 12px 30px rgba(31, 35, 41, 0.12);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .tip {
      font-size: 14px;
      line-height: 22px;
      color: var(--text-color-regular);
    }
  }
}
</style>
