<template>
  <div class='public-row-share-viewer' v-loading='loading'>
    <div v-if='showPasswordPanel' class='visit-login'>
      <div class='wrap-form'>
        <div class='tip'>{{ $t('PublicRowShareViewer.inputAccessPwd') }}</div>
        <el-input
          v-model='password'
          type='password'
          :showPassword='true'
          :placeholder="$t('PublicRowShareViewer.inputPwdPlaceholder')"
          @keyup.enter='handleVerifyVisit'
        />
        <el-button type='primary' @click='handleVerifyVisit'>{{ $t('PublicRowShareViewer.confirm') }}</el-button>
      </div>
    </div>

    <row-share-data-form-page
      v-else-if='bootstrap && nocodeBody'
      :key='pageKey'
      :title="bootstrap.table?.alias || $t('PublicRowShareViewer.title')"
      :nocodeId='bootstrap.nocode.id'
      :tableUID='bootstrap.table.uid'
      :rowUUID='bootstrap.share.rowUUID'
      :rowData='bootstrap.row'
      :formData='bootstrap.formData'
      :nocodeBody='nocodeBody'
      :organizeUtil='organizeUtil'
      :loading='loading'
      :isAddDataAble='false'
      :isEditDataAble='bootstrap.hasEditableFields'
      :isDeleteDataAble='false'
      :fieldsAuth='bootstrap.fieldsAuth'
      :showDisplayFields='false'
      :showShare='false'
      :showPrint='true'
      :showCopy='false'
      :showDelete='false'
      :showEdit='bootstrap.hasEditableFields'
      :showRelatedTabs='false'
      :enableProcessFlow='false'
      :loadPrintTemplates='false'
      :publisher="bootstrap.publisher"
      :reportAccount="bootstrap.reportAccount"
      :submitHandler='handleSubmit'
      :useReadFormData='true'
      @submitted='handleSubmitted'
    />
    <el-empty v-else-if='!loading' :description="errorText || $t('PublicRowShareViewer.invalidLink')" />
  </div>
</template>

<script setup lang='ts'>
import { computed, onUnmounted, provide, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { NOCODE } from '@renderer/types';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { projectApi } from '@renderer/utils/api/project';
import { storeFactory } from '@renderer/utils/storage';
import RowShareDataFormPage from './RowShareDataFormPage.vue';
import i18next from 'i18next';

const route = useRoute();
const token = route.params.token as string;
const organizeUtil = new OrganizeUtil();
const rowShareVisitTokenStore = storeFactory('ROW_SHARE_VISIT_TOKEN_STORE', false);

const loading = ref(false);
const errorText = ref('');
const bootstrap = ref<any>(null);
const pageKey = ref(0);
const nocode = ref<any>(null);
const password = ref('');
const isNeedPassword = ref(false);
const isVerifyVisitSuccess = ref(false);
const accessToken = ref('');
const updateShareRequestHeader = () => {
  axios.defaults.headers.common['x-row-share-token'] = token;
  if (accessToken.value) {
    axios.defaults.headers.common['x-row-share-access-token'] = accessToken.value;
    return;
  }
  delete axios.defaults.headers.common['x-row-share-access-token'];
};
updateShareRequestHeader();

const nocodeBody = computed(() => {
  if (!bootstrap.value) return null;
  return {
    formData: bootstrap.value.formData,
    permissions: {
      application: {},
      page: {},
      view: {},
      field: {},
      data: {},
    },
    structure: [],
    views: {},
  } as any;
});

const showPasswordPanel = computed(() => {
  return isNeedPassword.value && !isVerifyVisitSuccess.value;
});

const getStoredVisitTokenMap = () => {
  return rowShareVisitTokenStore.get() || {};
};

const getStoredVisitToken = () => {
  return String(getStoredVisitTokenMap()?.['public:' + token] || '');
};

const setStoredVisitToken = (value: string) => {
  const tokenMap = getStoredVisitTokenMap();
  tokenMap['public:' + token] = value;
  rowShareVisitTokenStore.set(tokenMap);
};

const removeStoredVisitToken = () => {
  const tokenMap = getStoredVisitTokenMap();
  delete tokenMap['public:' + token];
  rowShareVisitTokenStore.set(tokenMap);
};

const applyBootstrap = (data: any) => {
  bootstrap.value = data;
  nocode.value = {
    meta: {
      id: data?.nocode?.id || '',
      name: data?.nocode?.name || data?.table?.alias || '',
    },
    body: {
      formData: data?.formData,
      sign: '',
    },
  };
  document.title = data?.table?.alias || data?.nocode?.name || i18next.t('PublicRowShareViewer.title');
  pageKey.value += 1;
};

const loadAccess = async () => {
  const data = await projectApi.getRowShareAccess({
    token,
    scope: 'public',
  });
  isNeedPassword.value = !!data?.isNeedPassword;
};

const validateAccessToken = async (currentAccessToken: string) => {
  return await projectApi.validateRowShareAccessToken({
    token,
    scope: 'public',
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
    updateShareRequestHeader();
    return;
  }
  removeStoredVisitToken();
};

const loadBootstrap = async () => {
  if (!token) return;
  loading.value = true;
  errorText.value = '';
  try {
    const data = await projectApi.getPublicRowShareBootstrap(token, {
      accessToken: accessToken.value,
    });
    applyBootstrap(data);
  } catch (error: any) {
    bootstrap.value = null;
    errorText.value = error?.response?.data?.message || error?.message || i18next.t('PublicRowShareViewer.invalidLink');
  } finally {
    loading.value = false;
  }
};

const initPage = async () => {
  if (!token) return;
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
    errorText.value = error?.response?.data?.message || error?.message || i18next.t('PublicRowShareViewer.invalidLink');
  } finally {
    loading.value = false;
  }
};

const handleVerifyVisit = async () => {
  const data = await projectApi.visitRowShare({
    token,
    scope: 'public',
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
  updateShareRequestHeader();
  await loadBootstrap();
};

const handleSubmit = async (rowPatch) => {
  const data = await projectApi.updatePublicRowShare(token, rowPatch, {
    accessToken: accessToken.value,
  });
  ElMessage.success(i18next.t('PublicRowShareViewer.submitSuccess'));
  return data;
};

const handleSubmitted = (data) => {
  if (data) {
    applyBootstrap(data);
  }
};

initPage();
provide(NOCODE, nocode);

onUnmounted(() => {
  delete axios.defaults.headers.common['x-row-share-token'];
  delete axios.defaults.headers.common['x-row-share-access-token'];
});
</script>

<style scoped lang='scss'>
.public-row-share-viewer {
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
