<template>
  <el-dialog
    :modelValue="modelValue"
    width="780px"
    :title="$t('SystemMigration.importTitle')"
    align-center
    destroy-on-close
    :show-close="!executing && !importCompleted"
    :close-on-click-modal="false"
    :close-on-press-escape="!executing && !importCompleted"
    @update:modelValue="emit('update:modelValue', $event)"
    :before-close="handleBeforeClose"
  >
    <div class="migration-import-dialog">
      <el-steps direction="vertical" :active="activeStep">
        <el-step :title="$t('SystemMigration.stepSelectPackage')">
          <template #description>
            <div class="step-body">
              <div class="package-row">
                <el-input readonly :model-value="packageDisplayName" :placeholder="$t('SystemMigration.packagePlaceholder')" />
                <el-upload
                  ref="uploadRef"
                  :auto-upload="false"
                  :show-file-list="false"
                  :limit="1"
                  accept=".bbm"
                  :on-change="handleUploadPackage"
                >
                  <el-button :loading="selecting" :disabled="executing || importCompleted">
                    {{ $t('SystemMigration.uploadPackage') }}
                  </el-button>
                </el-upload>
              </div>

              <div class="step-card" v-if="inspectResult">
                <div class="card-row">
                  <span>{{ $t('SystemMigration.packageVersionLabel') }}</span>
                  <span>{{ inspectResult.manifest.appVersion }}</span>
                </div>
                <div class="card-row">
                  <span>{{ $t('SystemMigration.databaseTypeLabel') }}</span>
                  <span>{{ databaseTypeText }}</span>
                </div>
              </div>

              <div class="step-error" v-if="packageError">{{ packageError }}</div>
            </div>
          </template>
        </el-step>

        <el-step :title="$t('SystemMigration.stepPrecheck')">
          <template #description>
            <div class="step-body">
              <div class="precheck-loading" v-if="prechecking">
                {{ $t('SystemMigration.prechecking') }}
              </div>
              <div class="step-card" v-else-if="precheckResult">
                <div class="check-item" v-for="item in precheckResult.checks" :key="item.key" :class="item.passed ? 'success' : 'error'">
                  <el-icon :size="16">
                    <i-ep-circle-check-filled v-if="item.passed" />
                    <i-ep-circle-close-filled v-else />
                  </el-icon>
                  <span>{{ item.message }}</span>
                </div>
                <div class="root-dir-block">
                  <div class="root-dir-tip warning" v-if="showPackageRootDirMissingTip">
                    <el-icon :size="16"><i-ep-warning-filled /></el-icon>
                    <span>{{ $t('SystemMigration.packageRootDirMissingTip', { path: precheckResult.rootDirInfo.packageRootDir }) }}</span>
                  </div>
                  <div class="root-dir-tip success" v-else-if="showPackageRootDirMatchedTip">
                    <el-icon :size="16"><i-ep-circle-check-filled /></el-icon>
                    <span>{{ $t('SystemMigration.packageRootDirMatchedTip', { path: precheckResult.rootDirInfo.packageRootDir }) }}</span>
                  </div>
                  <div class="root-dir-row">
                    <span class="root-dir-label">{{ $t('SystemMigration.rootDirLabel') }}</span>
                    <div class="root-dir-input">
                      <el-input readonly :model-value="targetRootDir" :title="targetRootDir" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="step-hint" v-else>
                {{ $t('SystemMigration.precheckHint') }}
              </div>
            </div>
          </template>
        </el-step>

        <el-step v-if="requiresDatabaseStep" :title="$t('SystemMigration.stepDatabase')">
          <template #description>
            <div class="step-body">
              <el-form label-position="top" :model="databaseForm" class="database-form">
                <div class="form-grid">
                  <el-form-item :label="$t('SystemMigration.databaseHost')">
                    <el-input v-model="databaseForm.host" />
                  </el-form-item>
                  <el-form-item :label="$t('SystemMigration.databasePort')">
                    <el-input-number v-model="databaseForm.port" :min="0" :max="65535" :controls="false" style="width: 100%;" />
                  </el-form-item>
                  <el-form-item :label="$t('SystemMigration.databaseUsername')">
                    <el-input v-model="databaseForm.username" />
                  </el-form-item>
                  <el-form-item :label="$t('SystemMigration.databasePassword')">
                    <el-input v-model="databaseForm.password" show-password />
                  </el-form-item>
                  <el-form-item :label="$t('SystemMigration.databaseAuth')">
                    <el-input v-model="databaseForm.authDatabase" />
                  </el-form-item>
                </div>
              </el-form>

              <div class="db-actions">
                <el-button type="primary" :loading="validatingDatabase" :disabled="executing || importCompleted" @click="handleValidateDatabase">
                  {{ $t('SystemMigration.validateDatabase') }}
                </el-button>
                <span class="db-message" :class="databaseValidated ? 'success' : 'error'" v-if="databaseMessage">
                  {{ databaseMessage }}
                </span>
              </div>
            </div>
          </template>
        </el-step>

        <el-step :title="$t('SystemMigration.stepImport')">
          <template #description>
            <div class="step-body">
              <div class="warning-box" v-if="!importCompleted">
                <el-icon :size="16"><i-ep-warning-filled /></el-icon>
                <span>{{ $t('SystemMigration.importWarning') }}</span>
              </div>
              <div class="success-box" v-if="importCompleted">
                <el-icon :size="16"><i-ep-circle-check-filled /></el-icon>
                <span>{{ $t('SystemMigration.importPrepared') }}</span>
              </div>
              <div class="step-hint" v-if="importCompleted">
                {{ $t('SystemMigration.importPreparedHint') }}
              </div>
              <div class="step-error" v-if="importError">{{ importError }}</div>
            </div>
          </template>
        </el-step>
      </el-steps>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="!importCompleted" @click="emit('update:modelValue', false)" :disabled="executing">{{ $t('SystemMigration.cancel') }}</el-button>
        <el-button type="primary" :loading="executing" :disabled="executing || (!importCompleted && !canImport)" @click="handlePrimaryAction">
          {{ importCompleted ? $t('SystemMigration.confirmAndRelaunch') : $t('SystemMigration.startImport') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { FormDatabaseType } from '@common/types/nocode';
import { SystemMigrationImportDatabaseOptions, SystemMigrationPackageInspectResult, SystemMigrationPrecheckResult } from '@common/types/system-migration';
import { DialogBeforeCloseFn, ElMessage, UploadFile, UploadInstance } from 'element-plus';
import axios from 'axios';
import i18next from 'i18next';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const packagePath = ref('');
const packageDisplayName = ref('');
const selecting = ref(false);
const prechecking = ref(false);
const validatingDatabase = ref(false);
const executing = ref(false);
const importCompleted = ref(false);

const inspectResult = ref<SystemMigrationPackageInspectResult | null>(null);
const precheckResult = ref<SystemMigrationPrecheckResult | null>(null);
const packageError = ref('');
const importError = ref('');
const databaseMessage = ref('');
const databaseValidated = ref(false);
const uploadRef = ref<UploadInstance>();
const targetRootDir = ref('');
const requestController = ref<AbortController | null>(null);
const requestSeq = ref(0);
const selectingRequestSeq = ref(0);
const precheckingRequestSeq = ref(0);
const validatingDatabaseRequestSeq = ref(0);

const resolveLocalizedMessage = (message: string | undefined, fallbackKey: string) => {
  if (message && /[\u4e00-\u9fa5]/.test(message)) {
    return message;
  }
  return i18next.t(fallbackKey);
};

const buildDetailedErrorMessage = (message: string | undefined, fallbackKey: string) => {
  const fallback = i18next.t(fallbackKey);
  if (!message) {
    return fallback;
  }
  if (message === fallback || /[\u4e00-\u9fa5]/.test(message)) {
    return message;
  }
  return `${fallback}\n${i18next.t('SystemMigration.errorReasonLabel')}: ${message}`;
};

const databaseForm = reactive<SystemMigrationImportDatabaseOptions>({
  type: FormDatabaseType.MONGODB,
  host: '',
  port: 27017,
  username: '',
  password: '',
  authDatabase: 'admin',
});

const requiresDatabaseStep = computed(() => inspectResult.value?.manifest?.database?.requiresImportStep);
const showPackageRootDirMissingTip = computed(() => {
  const rootDirInfo = precheckResult.value?.rootDirInfo;
  return !!rootDirInfo?.packageRootDirDetected && !rootDirInfo.packageRootDirExists;
});
const showPackageRootDirMatchedTip = computed(() => {
  const rootDirInfo = precheckResult.value?.rootDirInfo;
  return !!rootDirInfo?.packageRootDirDetected && rootDirInfo.packageRootDirExists && rootDirInfo.targetRootDir === rootDirInfo.packageRootDir;
});
const databaseTypeText = computed(() => {
  const type = inspectResult.value?.manifest?.database?.type;
  if (type === FormDatabaseType.MONGODB) {
    return i18next.t('SystemMigration.databaseTypeMongo');
  }
  if (type === FormDatabaseType.MYSQL) {
    return i18next.t('SystemMigration.databaseTypeMysql');
  }
  return i18next.t('SystemMigration.databaseTypeEmbedded');
});

const cleanupUploadedPackage = async (targetPath?: string) => {
  if (!targetPath) {
    return;
  }
  await axios.post('/system-migration/cleanup-upload-package', {
    packagePath: targetPath,
  }).catch(() => null);
};

const createRequestContext = () => {
  requestController.value?.abort();
  const controller = new AbortController();
  requestController.value = controller;
  const seq = requestSeq.value + 1;
  requestSeq.value = seq;
  return {
    controller,
    seq,
  };
};

const clearRequestController = (controller: AbortController | null) => {
  if (requestController.value === controller) {
    requestController.value = null;
  }
};

const startSelecting = (seq = 0) => {
  selectingRequestSeq.value = seq;
  selecting.value = true;
};

const stopSelecting = (seq = 0) => {
  if (selectingRequestSeq.value !== seq) {
    return;
  }
  selecting.value = false;
};

const startPrechecking = (seq: number) => {
  precheckingRequestSeq.value = seq;
  prechecking.value = true;
};

const stopPrechecking = (seq = 0) => {
  if (precheckingRequestSeq.value !== seq) {
    return;
  }
  prechecking.value = false;
};

const startValidatingDatabase = (seq: number) => {
  validatingDatabaseRequestSeq.value = seq;
  validatingDatabase.value = true;
};

const stopValidatingDatabase = (seq = 0) => {
  if (validatingDatabaseRequestSeq.value !== seq) {
    return;
  }
  validatingDatabase.value = false;
};

const abortPackageRequests = () => {
  requestSeq.value += 1;
  requestController.value?.abort();
  requestController.value = null;
  stopSelecting(selectingRequestSeq.value);
  stopPrechecking(precheckingRequestSeq.value);
  stopValidatingDatabase(validatingDatabaseRequestSeq.value);
};

const isActiveRequest = (seq: number, selectedPath?: string) => {
  return requestSeq.value === seq && (!selectedPath || packagePath.value === selectedPath);
};

const isCanceledRequestError = (error: any) => {
  return axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
};

const canImport = computed(() => {
  if (importCompleted.value) {
    return true;
  }
  if (!inspectResult.value || !precheckResult.value?.passed || executing.value) {
    return false;
  }
  if (requiresDatabaseStep.value) {
    return databaseValidated.value;
  }
  return true;
});

const activeStep = computed(() => {
  if (!inspectResult.value) {
    return 0;
  }
  if (!precheckResult.value?.passed) {
    return 1;
  }
  if (requiresDatabaseStep.value && !databaseValidated.value) {
    return 2;
  }
  return requiresDatabaseStep.value ? 3 : 2;
});

const resetState = () => {
  const currentPackagePath = packagePath.value;
  abortPackageRequests();
  packagePath.value = '';
  packageDisplayName.value = '';
  executing.value = false;
  inspectResult.value = null;
  precheckResult.value = null;
  packageError.value = '';
  importError.value = '';
  databaseMessage.value = '';
  databaseValidated.value = false;
  importCompleted.value = false;
  targetRootDir.value = '';
  databaseForm.type = FormDatabaseType.MONGODB;
  databaseForm.host = '';
  databaseForm.port = 27017;
  databaseForm.username = '';
  databaseForm.password = '';
  databaseForm.authDatabase = 'admin';
  uploadRef.value?.clearFiles?.();
  void cleanupUploadedPackage(currentPackagePath);
};

const fillDatabaseForm = () => {
  const summary = inspectResult.value?.manifest?.database?.configSummary;
  if (!summary) return;
  databaseForm.type = FormDatabaseType.MONGODB;
  databaseForm.host = summary.host || '';
  databaseForm.port = Number(summary.port || 27017);
  databaseForm.username = summary.username || '';
  databaseForm.password = '';
  databaseForm.authDatabase = summary.authDatabase || 'admin';
};

const runInspectAndPrecheck = async (selectedPath: string) => {
  const inspectRequest = createRequestContext();
  packageError.value = '';
  importError.value = '';
  databaseMessage.value = '';
  validatingDatabase.value = false;
  databaseValidated.value = false;
  importCompleted.value = false;
  inspectResult.value = null;
  precheckResult.value = null;
  stopPrechecking(precheckingRequestSeq.value);

  const inspect = await axios.post('/system-migration/inspect', { packagePath: selectedPath }, {
    signal: inspectRequest.controller.signal,
  }).then(({ data }) => data).catch((error) => {
    if (isCanceledRequestError(error)) {
      return null;
    }
    if (!isActiveRequest(inspectRequest.seq, selectedPath)) {
      return null;
    }
    const response = error?.response;
    packageError.value = resolveLocalizedMessage(response?.data?.message, 'SystemMigration.inspectFailed');
    return null;
  });
  clearRequestController(inspectRequest.controller);
  if (!isActiveRequest(inspectRequest.seq, selectedPath)) {
    return;
  }
  inspectResult.value = inspect;
  if (!inspectResult.value) {
    precheckResult.value = null;
    return;
  }

  fillDatabaseForm();

  const precheckRequest = createRequestContext();
  startPrechecking(precheckRequest.seq);
  const precheck = await axios.post('/system-migration/precheck', {
    packagePath: selectedPath,
    rootDir: undefined,
  }, {
    signal: precheckRequest.controller.signal,
  }).then(({ data }) => data).catch((error) => {
    if (isCanceledRequestError(error)) {
      stopPrechecking(precheckRequest.seq);
      return null;
    }
    if (!isActiveRequest(precheckRequest.seq, selectedPath)) {
      stopPrechecking(precheckRequest.seq);
      return null;
    }
    const response = error?.response;
    packageError.value = resolveLocalizedMessage(response?.data?.message, 'SystemMigration.precheckFailed');
    stopPrechecking(precheckRequest.seq);
    return null;
  });
  clearRequestController(precheckRequest.controller);
  if (!isActiveRequest(precheckRequest.seq, selectedPath)) {
    stopPrechecking(precheckRequest.seq);
    return;
  }
  precheckResult.value = precheck;
  targetRootDir.value = precheck?.rootDirInfo?.targetRootDir || '';
  stopPrechecking(precheckRequest.seq);
};

const handleUploadPackage = async (uploadFile: UploadFile) => {
  const rawFile = uploadFile.raw;
  if (!rawFile) {
    return;
  }
  const previousPackagePath = packagePath.value;
  if (!rawFile.name.toLowerCase().endsWith('.bbm')) {
    uploadRef.value?.clearFiles?.();
    ElMessage.warning(i18next.t('SystemMigration.packageTypeLimit'));
    return;
  }
  packageError.value = '';
  validatingDatabase.value = false;
  const uploadRequest = createRequestContext();
  startSelecting(uploadRequest.seq);
  stopPrechecking(precheckingRequestSeq.value);
  const formData = new FormData();
  formData.append('file', rawFile);
  const uploaded = await axios.post('/system-migration/upload-package', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    signal: uploadRequest.controller.signal,
  }).then(({ data }) => data).catch((error) => {
    if (isCanceledRequestError(error)) {
      stopSelecting(uploadRequest.seq);
      return null;
    }
    if (!isActiveRequest(uploadRequest.seq)) {
      stopSelecting(uploadRequest.seq);
      return null;
    }
    const response = error?.response;
    ElMessage.error(resolveLocalizedMessage(response?.data?.message, 'SystemMigration.uploadPackageFailed'));
    stopSelecting(uploadRequest.seq);
    return null;
  });
  clearRequestController(uploadRequest.controller);
  if (!isActiveRequest(uploadRequest.seq)) {
    stopSelecting(uploadRequest.seq);
    return;
  }
  stopSelecting(uploadRequest.seq);
  uploadRef.value?.clearFiles?.();
  if (!uploaded?.packagePath) {
    return;
  }
  void cleanupUploadedPackage(previousPackagePath);
  targetRootDir.value = '';
  packagePath.value = uploaded.packagePath;
  packageDisplayName.value = uploaded.originalName || rawFile.name;
  await runInspectAndPrecheck(uploaded.packagePath);
};

const handleValidateDatabase = async () => {
  databaseMessage.value = '';
  const validatePackagePath = packagePath.value;
  const validateRequest = createRequestContext();
  startValidatingDatabase(validateRequest.seq);
  const result = await axios.post('/system-migration/validate-database', {
    packagePath: validatePackagePath,
    databaseOptions: { ...databaseForm },
  }, {
    signal: validateRequest.controller.signal,
  }).then(({ data }) => data).catch((error) => {
    if (isCanceledRequestError(error)) {
      stopValidatingDatabase(validateRequest.seq);
      return null;
    }
    if (!isActiveRequest(validateRequest.seq, validatePackagePath)) {
      stopValidatingDatabase(validateRequest.seq);
      return null;
    }
    const response = error?.response;
    databaseMessage.value = resolveLocalizedMessage(response?.data?.message, 'SystemMigration.databaseValidateFailed');
    stopValidatingDatabase(validateRequest.seq);
    return null;
  });
  clearRequestController(validateRequest.controller);
  if (!isActiveRequest(validateRequest.seq, validatePackagePath)) {
    stopValidatingDatabase(validateRequest.seq);
    return;
  }
  stopValidatingDatabase(validateRequest.seq);
  if (!result) {
    databaseValidated.value = false;
    return;
  }
  databaseValidated.value = !!result.passed;
  databaseMessage.value = resolveLocalizedMessage(result.message, result.passed ? 'SystemMigration.databaseValidated' : 'SystemMigration.databaseValidateFailed');
};

const handleImport = async () => {
  importError.value = '';
  executing.value = true;
  const result = await axios.post('/system-migration/import', {
    packagePath: packagePath.value,
    rootDir: targetRootDir.value,
    databaseOptions: requiresDatabaseStep.value ? { ...databaseForm } : undefined,
  }).then(({ data }) => data).catch(({ response }) => {
    importError.value = buildDetailedErrorMessage(response?.data?.message, 'SystemMigration.importFailed');
    return null;
  });
  executing.value = false;
  if (!result) {
    return;
  }
  importCompleted.value = true;
  ElMessage.success(i18next.t('SystemMigration.importPrepared'));
};

const handleRelaunch = async () => {
  importError.value = '';
  executing.value = true;
  const success = await axios.post('/relaunch').then(() => true).catch(({ response }) => {
    importError.value = buildDetailedErrorMessage(response?.data?.message, 'SystemMigration.relaunchFailed');
    return false;
  });
  if (!success) {
    executing.value = false;
  }
};

const handlePrimaryAction = async () => {
  if (importCompleted.value) {
    await handleRelaunch();
    return;
  }
  await handleImport();
};

const handleBeforeClose: DialogBeforeCloseFn = (done) => {
  abortPackageRequests();
  if (executing.value) {
    ElMessage.warning(i18next.t('SystemMigration.importRunning'));
    return false;
  }
  if (importCompleted.value) {
    ElMessage.warning(i18next.t('SystemMigration.restartRequired'));
    return false;
  }
  done();
};

watch(() => props.modelValue, (value) => {
  if (value) {
  } else {
    resetState();
  }
});

watch(() => [
  databaseForm.host,
  databaseForm.port,
  databaseForm.username,
  databaseForm.password,
  databaseForm.authDatabase,
], (current, previous) => {
  if (!requiresDatabaseStep.value || !previous) {
    return;
  }
  if (current.every((value, index) => value === previous[index])) {
    return;
  }
  databaseValidated.value = false;
  databaseMessage.value = '';
});
</script>

<style lang="scss" scoped>
.migration-import-dialog {
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;

  .step-body {
    padding: 8px 0 16px;
  }

  .package-row {
    display: flex;
    gap: 8px;

    :deep(.el-upload) {
      display: inline-flex;
    }
  }

  .step-card {
    margin-top: 12px;
    padding: 14px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-color-page);
  }

  .card-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    line-height: 20px;
    font-size: 13px;
    color: var(--text-color-regular);
  }

  .card-row + .card-row {
    margin-top: 8px;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 20px;
    font-size: 13px;

    &.success {
      color: #5b8a31;
    }

    &.error {
      color: #d03050;
    }
  }

  .check-item + .check-item {
    margin-top: 10px;
  }

  .root-dir-block {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .root-dir-tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 20px;
    font-size: 13px;
    margin-bottom: 12px;

    .el-icon {
      margin-top: 3px;
    }

    &.warning {
      color: #ad6800;
    }

    &.success {
      color: #5b8a31;
    }
  }

  .root-dir-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .root-dir-label {
    width: 70px;
    flex-shrink: 0;
    font-size: 13px;
    color: var(--text-color-regular);
  }

  .root-dir-input {
    display: flex;
    flex: 1;
    gap: 8px;
  }

  .step-hint,
  .precheck-loading {
    font-size: 13px;
    color: #86909c;
    line-height: 20px;
  }

  .step-error {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    background: #fef0f0;
    color: #d03050;
    white-space: pre-line;
    line-height: 1.6;
    font-size: 12px;
  }

  .warning-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #fff7e8;
    color: #ad6800;
    line-height: 1.6;
    font-size: 13px;
    
    .el-icon {
      margin-top: 3px;
    }
  }

  .success-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #f0f9eb;
    color: #5b8a31;
    line-height: 1.6;
    font-size: 13px;
    
    .el-icon {
      margin-top: 3px;
    }
  }

  .database-form {
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
  }

  .db-actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .db-message {
      line-height: 20px;
      font-size: 12px;

      &.success {
        color: #5b8a31;
      }

      &.error {
        color: #d03050;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
