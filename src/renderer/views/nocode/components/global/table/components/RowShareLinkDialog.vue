<template>
  <div class='row-share-dialog'>
    <el-dialog
      :model-value='modelValue'
      width='560'
      align-center
      draggable
      destroy-on-close
      @open='handleOpen'
      @update:model-value='emit(`update:modelValue`, $event)'
    >
      <template #header>
        <div class='title'>{{ $t('RowShareLinkDialog.title') }}</div>
      </template>

      <div class='row-share-link-dialog' v-loading='loading'>
        <div class='link-section'>
          <div class='section-title-wrap'>
            <div class='section-title'>{{ $t('RowShareLinkDialog.internalTitle') }}</div>
            <div class='section-tip-inline'>{{ $t('RowShareLinkDialog.internalTip') }}</div>
          </div>
          <div class='link-row'>
            <el-input class='share-url-input' :model-value='internalShareUrl' readonly :placeholder="$t('RowShareLinkDialog.placeholder')" />
            <div class='link-actions'>
              <el-button class='icon-btn' :disabled='!internalShareUrl || isScopeSaving(`internal`)' @click='handleCopyLink(`internal`)'>
                <el-icon><i-ven-copy-link /></el-icon>
              </el-button>
              <el-popover placement='bottom' trigger='click' width='176' :disabled='!internalShareUrl || isScopeSaving(`internal`)' :popper-style='{ padding: 0 }'>
                <template #reference>
                  <el-button class='icon-btn' :disabled='!internalShareUrl || isScopeSaving(`internal`)'>
                    <el-icon><i-ven-qr-code /></el-icon>
                  </el-button>
                </template>
                <div class='qrcode-container'>
                  <div class='qrcode-title'>{{ $t('RowShareLinkDialog.scanToAccess') }}</div>
                  <Qrcode :size='150' :value='internalShareUrl' level='L' />
                </div>
              </el-popover>
              <el-button class='icon-btn' :disabled='!internalShareUrl || isScopeSaving(`internal`)' @click='handleOpenLink(`internal`)'>
                <el-icon><i-ven-share-link /></el-icon>
              </el-button>
            </div>
          </div>
          <div v-if='internalError' class='section-error'>{{ internalError }}</div>
          <div v-if='internalPublish.passwordEnabled || internalPublish.expireEnabled' class='access-setting'>
            <div v-if='internalPublish.passwordEnabled' class='setting-row'>
              <div class='setting-label'>{{ $t('RowShareLinkDialog.password') }}</div>
              <div class='setting-control password-control'>
                <el-input class='password-input' :model-value='internalAccess.password' readonly />
                <el-button v-if='isAdmin' class='refresh-btn' :disabled='isScopeSaving(`internal`)' @click='handleRegeneratePassword(`internal`)'>
                  <el-icon><i-ven-refresh /></el-icon>
                </el-button>
                <el-button class='copy-btn' :disabled='!internalAccess.password || isScopeSaving(`internal`)' @click='handleCopyPassword(internalAccess.password || "")'>
                  <el-icon><i-ven-copy-link /></el-icon>
                </el-button>
              </div>
            </div>
            <div v-if='internalPublish.expireEnabled' class='setting-row'>
              <div class='setting-label'>{{ $t('RowShareLinkDialog.shareExpireTime') }}</div>
              <div class='setting-control'>
                <el-config-provider :locale="locale">
                  <el-date-picker
                    v-model='internalAccess.shareExpireTime'
                    type='date'
                    value-format='x'
                    :placeholder="$t('RowShareLinkDialog.selectExpireTime')"
                    :disabled-date='onDisabledDate'
                    :disabled='isScopeSaving(`internal`)'
                    :readonly="!isAdmin"
                    clearable
                    @change='handleAccessChange(`internal`)'
                  />
                </el-config-provider>
              </div>
            </div>
          </div>
        </div>

        <div class='link-section'>
          <div class='section-title-wrap'>
            <div class='section-title'>{{ $t('RowShareLinkDialog.publicTitle') }}</div>
            <div class='section-tip-inline'>{{ $t('RowShareLinkDialog.publicTip') }}</div>
          </div>
          <div class='link-row'>
            <el-input class='share-url-input' :model-value='publicShareUrl' readonly :placeholder="$t('RowShareLinkDialog.placeholder')" />
            <div class='link-actions'>
              <el-button class='icon-btn' :disabled='!publicShareUrl || isScopeSaving(`public`)' @click='handleCopyLink(`public`)'>
                <el-icon><i-ven-copy-link /></el-icon>
              </el-button>
              <el-popover placement='bottom' trigger='click' width='176' :disabled='!publicShareUrl || isScopeSaving(`public`)' :popper-style='{ padding: 0 }'>
                <template #reference>
                  <el-button class='icon-btn' :disabled='!publicShareUrl || isScopeSaving(`public`)'>
                    <el-icon><i-ven-qr-code /></el-icon>
                  </el-button>
                </template>
                <div class='qrcode-container'>
                  <div class='qrcode-title'>{{ $t('RowShareLinkDialog.scanToAccess') }}</div>
                  <Qrcode :size='150' :value='publicShareUrl' level='L' />
                </div>
              </el-popover>
              <el-button class='icon-btn' :disabled='!publicShareUrl || isScopeSaving(`public`)' @click='handleOpenLink(`public`)'>
                <el-icon><i-ven-share-link /></el-icon>
              </el-button>
            </div>
          </div>
          <div v-if='publicError' class='section-error'>{{ publicError }}</div>
          <div v-if='publicPublish.passwordEnabled || publicPublish.expireEnabled' class='access-setting'>
            <div v-if='publicPublish.passwordEnabled' class='setting-row'>
              <div class='setting-label'>{{ $t('RowShareLinkDialog.password') }}</div>
              <div class='setting-control password-control'>
                <el-input class='password-input' :model-value='publicAccess.password' readonly />
                <el-button v-if='isAdmin' class='refresh-btn' :disabled='isScopeSaving(`public`)' @click='handleRegeneratePassword(`public`)'>
                  <el-icon><i-ven-refresh /></el-icon>
                </el-button>
                <el-button class='copy-btn' :disabled='!publicAccess.password || isScopeSaving(`public`)' @click='handleCopyPassword(publicAccess.password || "")'>
                  <el-icon><i-ven-copy-link /></el-icon>
                </el-button>
              </div>
            </div>
            <div v-if='publicPublish.expireEnabled' class='setting-row'>
              <div class='setting-label'>{{ $t('RowShareLinkDialog.shareExpireTime') }}</div>
              <div class='setting-control'>
                <el-config-provider :locale="locale">
                  <el-date-picker
                    v-model='publicAccess.shareExpireTime'
                    type='date'
                    value-format='x'
                    :placeholder="$t('RowShareLinkDialog.selectExpireTime')"
                    :disabled-date='onDisabledDate'
                    :disabled='isScopeSaving(`public`)'
                    :readonly="!isAdmin"
                    clearable
                    @change='handleAccessChange(`public`)'
                  />
                </el-config-provider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ADMIN_USERNAME } from '@common/types/account';
import { Row, RowShareAccessScope, Table } from '@common/types/project';
import { getUUIDSystemField } from '@common/utils';
import { usePassportStore, useSettingStore } from '@renderer/stores';
import { projectApi } from '@renderer/utils/api/project';
import { useClipboard } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import i18next from 'i18next';
import Qrcode from 'qrcode.vue';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";

const props = defineProps<{
  modelValue: boolean,
  table: Table,
  row: Row,
  nocodeId: string,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
}>();

const defaultPublishAccess = () => ({ passwordEnabled: false, expireEnabled: false });
const defaultRuntimeAccess = () => ({ isNeedPassword: false, shareExpireTime: null, password: '' });
const cloneRuntimeAccess = (access = defaultRuntimeAccess()) => ({
  isNeedPassword: !!access.isNeedPassword,
  shareExpireTime: access.shareExpireTime || null,
  password: access.password || '',
});

const passportState = usePassportStore();
const settingStore = useSettingStore();
const { copy } = useClipboard({ legacy: true });
const loading = ref(false);
const internalToken = ref('');
const publicToken = ref('');
const internalPublish = ref(defaultPublishAccess());
const publicPublish = ref(defaultPublishAccess());
const internalAccess = ref(defaultRuntimeAccess());
const publicAccess = ref(defaultRuntimeAccess());
const internalLastSavedAccess = ref(defaultRuntimeAccess());
const publicLastSavedAccess = ref(defaultRuntimeAccess());
const internalError = ref('');
const publicError = ref('');
const internalSaving = ref(false);
const publicSaving = ref(false);

const isAdmin = computed(() => {
  return !!(passportState.account?.isAdmin || passportState.account?.user === ADMIN_USERNAME);
});

const internalShareUrl = computed(() => {
  return internalToken.value
    ? settingStore.saas.domain + '/#/view/data/' + internalToken.value
    : '';
});

const publicShareUrl = computed(() => {
  return publicToken.value
    ? settingStore.saas.domain + '/#/share/data/' + publicToken.value
    : '';
});

const rowUUID = computed(() => {
  const uuidField = getUUIDSystemField(props.table?.fields || []);
  if (!uuidField) return '';
  return props.row?.[uuidField.uid] || '';
});

const onDisabledDate = (date: Date) => {
  return dayjs(date).isBefore(dayjs());
};

const isScopeSaving = (scope: RowShareAccessScope) => {
  return scope === 'internal' ? internalSaving.value : publicSaving.value;
};

const setScopeSaving = (scope: RowShareAccessScope, value: boolean) => {
  if (scope === 'internal') {
    internalSaving.value = value;
    return;
  }
  publicSaving.value = value;
};

const resetScopeState = (scope: RowShareAccessScope) => {
  if (scope === 'internal') {
    internalPublish.value = defaultPublishAccess();
    internalAccess.value = defaultRuntimeAccess();
    internalLastSavedAccess.value = defaultRuntimeAccess();
    internalError.value = '';
    internalSaving.value = false;
    return;
  }
  publicPublish.value = defaultPublishAccess();
  publicAccess.value = defaultRuntimeAccess();
  publicLastSavedAccess.value = defaultRuntimeAccess();
  publicError.value = '';
  publicSaving.value = false;
};

const loadScopeAccess = async (scope: RowShareAccessScope) => {
  const targetToken = scope === 'internal' ? internalToken.value : publicToken.value;
  const data = await projectApi.getRowShareAccessDetail({
    token: targetToken,
    scope,
  });
  if (scope === 'internal') {
    internalPublish.value = data?.publish || defaultPublishAccess();
    internalAccess.value = cloneRuntimeAccess(data?.access);
    internalLastSavedAccess.value = cloneRuntimeAccess(data?.access);
    return;
  }
  publicPublish.value = data?.publish || defaultPublishAccess();
  publicAccess.value = cloneRuntimeAccess(data?.access);
  publicLastSavedAccess.value = cloneRuntimeAccess(data?.access);
};

const rollbackScopeAccess = (scope: RowShareAccessScope) => {
  if (scope === 'internal') {
    internalAccess.value = cloneRuntimeAccess(internalLastSavedAccess.value);
    return;
  }
  publicAccess.value = cloneRuntimeAccess(publicLastSavedAccess.value);
};

const saveScopeAccess = async (scope: RowShareAccessScope) => {
  if (isScopeSaving(scope)) {
    return;
  }
  setScopeSaving(scope, true);
  const targetToken = scope === 'internal' ? internalToken.value : publicToken.value;
  const targetAccess = scope === 'internal' ? internalAccess.value : publicAccess.value;
  try {
    const data = await projectApi.updateRowShareAccess({
      token: targetToken,
      scope,
      access: {
        isNeedPassword: true,
        shareExpireTime: targetAccess.shareExpireTime,
        password: targetAccess.password,
      },
    });
    if (scope === 'internal') {
      internalAccess.value = cloneRuntimeAccess(data?.access || internalAccess.value);
      internalLastSavedAccess.value = cloneRuntimeAccess(internalAccess.value);
      return;
    }
    publicAccess.value = cloneRuntimeAccess(data?.access || publicAccess.value);
    publicLastSavedAccess.value = cloneRuntimeAccess(publicAccess.value);
  } finally {
    setScopeSaving(scope, false);
  }
};

const saveScopeAccessIfNeeded = async (scope: RowShareAccessScope) => {
  const scopeError = scope === 'internal' ? internalError.value : publicError.value;
  if (!isAdmin.value || scopeError) {
    return true;
  }
  await saveScopeAccess(scope);
  return true;
};

const handleOpen = async () => {
  if (!rowUUID.value) {
    internalToken.value = '';
    publicToken.value = '';
    resetScopeState('internal');
    resetScopeState('public');
    ElMessage.error(i18next.t('RowShareLinkDialog.missingRow'));
    emit('update:modelValue', false);
    return;
  }
  loading.value = true;
  resetScopeState('internal');
  resetScopeState('public');
  try {
    const rowShare = await projectApi.createOrGetRowShare({
      nocodeId: props.nocodeId,
      tableUID: props.table.uid,
      rowUUID: rowUUID.value,
    });
    internalToken.value = rowShare.internalToken || '';
    publicToken.value = rowShare.publicToken || '';
    const [internalResult, publicResult] = await Promise.allSettled([
      loadScopeAccess('internal'),
      loadScopeAccess('public'),
    ]);
    if (internalResult.status === 'rejected') {
      resetScopeState('internal');
      internalError.value = internalResult.reason?.response?.data?.message || internalResult.reason?.message || i18next.t('RowShareLinkDialog.loadAccessFailed');
    }
    if (publicResult.status === 'rejected') {
      resetScopeState('public');
      publicError.value = publicResult.reason?.response?.data?.message || publicResult.reason?.message || i18next.t('RowShareLinkDialog.loadAccessFailed');
    }
  } catch (error: any) {
    internalToken.value = '';
    publicToken.value = '';
    resetScopeState('internal');
    resetScopeState('public');
    ElMessage.error(error?.response?.data?.message || error?.message || i18next.t('RowShareLinkDialog.createFailed'));
    emit('update:modelValue', false);
  } finally {
    loading.value = false;
  }
};

const handleAccessChange = async (scope: RowShareAccessScope) => {
  if (!isAdmin.value) return;
  await saveScopeAccess(scope).catch((error) => {
    rollbackScopeAccess(scope);
    ElMessage.error(error?.response?.data?.message || error?.message);
  });
};

const handleRegeneratePassword = async (scope: RowShareAccessScope) => {
  if (!isAdmin.value) return;
  const nextPassword = Math.random().toString(16).slice(2, 10);
  if (scope === 'internal') {
    internalAccess.value.password = nextPassword;
  } else {
    publicAccess.value.password = nextPassword;
  }
  await saveScopeAccess(scope).catch((error) => {
    rollbackScopeAccess(scope);
    ElMessage.error(error?.response?.data?.message || error?.message);
  });
};

const handleCopyLink = async (scope: RowShareAccessScope) => {
  const url = scope === 'internal' ? internalShareUrl.value : publicShareUrl.value;
  if (!url) return;
  const saved = await saveScopeAccessIfNeeded(scope).catch((error) => {
    ElMessage.error(error?.response?.data?.message || error?.message);
    return false;
  });
  if (!saved) return;
  await copy(url);
  ElMessage.success(i18next.t(scope === 'internal' ? 'RowShareLinkDialog.memberCopied' : 'RowShareLinkDialog.publicCopied'));
};

const handleCopyPassword = async (password: string) => {
  if (!password) return;
  await copy(password);
  ElMessage.success(i18next.t('NocodePublishPublicPage.copySuccess'));
};

const handleOpenLink = async (scope: RowShareAccessScope) => {
  const url = scope === 'internal' ? internalShareUrl.value : publicShareUrl.value;
  if (!url) return;
  const saved = await saveScopeAccessIfNeeded(scope).catch((error) => {
    ElMessage.error(error?.response?.data?.message || error?.message);
    return false;
  });
  if (!saved) return;
  window.open(url, '_blank');
};
</script>

<style scoped lang='scss'>
.row-share-dialog {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(31, 35, 41, 0.12);
    background-color: #fff;

    .el-dialog__header {
      width: 100%;
      height: 40px;
      padding: 8px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);
    }

    .el-dialog__body {
      padding: 0;
    }
  }
}

.row-share-link-dialog {
  display: flex;
  flex-direction: column;
  padding: 0 24px 12px;

  .link-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 0 16px;

    & + .link-section {
      border-top: 1px solid var(--border-color);
    }
  }

  .section-title-wrap {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;
  }

  .section-title {
    font-size: 14px;
    line-height: 20px;
    color: var(--text-color-primary);
    font-weight: 600;
    flex-shrink: 0;
  }

  .section-tip-inline {
    font-size: 12px;
    color: var(--text-color-secondary);
    line-height: 20px;
  }

  .section-error {
    font-size: 12px;
    line-height: 18px;
    color: var(--el-color-danger);
  }

  .link-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .share-url-input {
    flex: 1;
  }

  .link-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .icon-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 6px;
    border: none;
    background-color: #f2f4f7;
    color: var(--text-color-secondary);
  }

  .access-setting {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 2px 0 0;
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-label {
    font-size: 13px;
    color: var(--text-color-secondary);
  }

  .setting-control {
    width: 100%;
    display: flex;
  }

  .password-control {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .password-input {
    flex: 1;
  }

  .refresh-btn {
    width: 34px;
    min-width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 6px;
    background-color: #f2f4f7;
    border: none;
    color: var(--text-color-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;

    span {
      display: none;
    }
  }

  .copy-btn {
    width: 34px;
    min-width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 6px;
    background-color: #f2f4f7;
    border: none;
    color: var(--text-color-secondary);
  }

  :deep(.el-input) {
    flex: 1;
  }

  :deep(.share-url-input .el-input__wrapper),
  :deep(.password-input .el-input__wrapper),
  :deep(.expire-input .el-input__wrapper),
  :deep(.setting-control .el-date-editor .el-input__wrapper) {
    min-height: 36px;
    border-radius: 6px;
    background-color: #f5f6f7;
    box-shadow: none;
    padding: 0 12px;
  }
}

.title {
  text-align: center;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.qrcode-container {
  padding: 12px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--bg-color-page);
  border-radius: 4px;

  .qrcode-title {
    margin-bottom: 5px;
  }
}
</style>
