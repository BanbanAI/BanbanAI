<template>
  <div class="setting-container">
    <el-dialog v-model="visible" width="350px" :title="$t('HttpsSettingDialog.title')" top="40vh" destroy-on-close :close-on-click-modal="false" align-center>
    <div class="server-container">
      <div class="server-item" v-for="item in items" :key="item.type">
        <span class="server-item-title">{{ item.label }}{{ getI18nLabelColon() }}</span>
        <div class="server-item-upload">
          <el-input class="server-item-value" :model-value="values[item.type] ? selected[item.type] : ''" readonly :placeholder="$t('workbenchSetting.certificatePlaceholder')" />
          <i v-if="values[item.type]" class="fs fs-cuohao delete-icon" @click="clearCertificate(item.type)" />
          <el-button class="upload-btn" @click="openFile(item.type)">{{ $t('workbenchSetting.upload') }}</el-button>
          <input :ref="(element) => setInputRef(item.type, element)" type="file" class="server-item-file" :accept="item.accept" @change="handleFileChange(item.type, $event)" />
        </div>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">{{ $t('HttpsSettingDialog.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ $t('HttpsSettingDialog.save') }}</el-button>
      </span>
    </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { useSettingStore } from '@renderer/stores';
import { getI18nLabelColon } from '@common/utils/i18n';

type CertificateType = 'key' | 'cert' | 'ca';
const settingState = useSettingStore();
const visible = ref(false);
const saving = ref(false);
const values = reactive<Record<CertificateType, string | null>>({ key: null, cert: null, ca: null });
const selected = reactive<Record<CertificateType, string>>({ key: '', cert: '', ca: '' });
const files = reactive<Record<CertificateType, File | null>>({ key: null, cert: null, ca: null });
const inputRefs = reactive<Partial<Record<CertificateType, HTMLInputElement>>>({});
const items = [
  { type: 'key' as const, label: 'Key', accept: '.key,.pem' },
  { type: 'cert' as const, label: 'cert', accept: '.pem,.crt,.cer' },
  { type: 'ca' as const, label: 'ca', accept: '.pem,.crt,.ca-bundle' },
];

const setInputRef = (type: CertificateType, element: HTMLInputElement | null) => {
  if (element) inputRefs[type] = element;
};
const openFile = (type: CertificateType) => inputRefs[type]?.click();
const handleFileChange = (type: CertificateType, event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  files[type] = file;
  selected[type] = file.name;
  values[type] = file.name;
};
const clearCertificate = (type: CertificateType) => {
  files[type] = null;
  selected[type] = '';
  values[type] = null;
};
const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
});
const load = async () => {
  const data = await settingState.getServerProtocol();
  values.key = data.key ? 'configured' : null;
  values.cert = data.cert ? 'configured' : null;
  values.ca = data.ca ? 'configured' : null;
  selected.key = values.key || '';
  selected.cert = values.cert || '';
  selected.ca = values.ca || '';
};
const save = async () => {
  saving.value = true;
  let changed = false;
  try {
    for (const type of ['key', 'cert', 'ca'] as CertificateType[]) {
      if (files[type]) {
        changed = true;
        await settingState.changeServerCertificate(type, await readFile(files[type]!));
      } else if (!values[type]) {
        changed = true;
        await settingState.changeServerCertificate(type);
      }
    }
    visible.value = false;
    if (changed) ElMessage.warning(i18next.t('webShareSetting.httpsCertificateChangedTip'));
  } catch (error: unknown) {
    const response = (error as { response?: { data?: { message?: string } } })?.response;
    ElMessage.error(response?.data?.message || (error instanceof Error ? error.message : i18next.t('saasSetting.certificateUpdateFailed')));
  } finally {
    saving.value = false;
  }
};
defineExpose({ show: async () => { visible.value = true; await load(); } });
</script>

<style scoped lang="scss">
.setting-container {
  position: absolute;

  :deep(.el-dialog) {
    border-radius: 4px;
    overflow: hidden;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--el-bg-color-page);

    .el-dialog__header {
      padding: 0;
      margin: 0;
      text-align: center;
      height: 40px;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body { padding: 22px 16px; }

    .el-dialog__footer {
      height: 60px;
      padding: 8px 16px 16px;

      .el-button {
        height: 36px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }

  .server-container { display: flex; flex-direction: column; gap: 16px; }

  .server-item {
    height: 32px;
    color: var(--text-color-regular);
    display: flex;
    align-items: center;
    font-size: 12px;

    .server-item-title {
      display: flex;
      align-items: center;
      height: 25px;
      width: 40px;
      font-size: 13px;
    }

    .server-item-upload {
      height: 100%;
      width: 100%;
      position: relative;
      display: flex;

      & > :not(:last-child) { margin-right: 8px; }

      .server-item-value {
        flex: 1;
        height: 32px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        font-size: 14px;
        pointer-events: none;

        :deep(.el-input__wrapper) { box-shadow: none; padding-right: 30px; }
      }

      .upload-btn {
        margin-left: 8px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        border: none;
        font-weight: 500;
        color: var(--color-primary);

        &:hover { opacity: 0.6; }
      }

      .delete-icon {
        position: absolute;
        right: 75px;
        top: 50%;
        transform: translateY(-50%);
        cursor: var(--cursor-pointer);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      &:hover .delete-icon { opacity: 1; }
      .server-item-file { display: none; }
    }
  }
}
</style>
