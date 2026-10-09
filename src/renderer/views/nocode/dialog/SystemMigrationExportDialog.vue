<template>
  <el-dialog
    :modelValue="modelValue"
    width="640px"
    :title="$t('SystemMigration.exportTitle')"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    @update:modelValue="emit('update:modelValue', $event)"
  >
    <div class="migration-export-dialog">
      <el-steps direction="vertical" :active="activeStep">
        <el-step :title="$t('SystemMigration.exportNow')">
          <template #description>
            <div class="step-body">
              <div class="intro">
                {{ $t('SystemMigration.exportDescription') }}
              </div>

              <div class="summary-card" v-loading="summaryLoading">
                <div class="summary-row">
                  <span>{{ $t('SystemMigration.exportScopeLabel') }}</span>
                  <span>{{ exportScopeText }}</span>
                </div>
                <div class="summary-row" v-if="summary">
                  <span>{{ $t('SystemMigration.databaseTypeLabel') }}</span>
                  <span>{{ databaseTypeText }}</span>
                </div>
                <div class="summary-option">
                  <el-checkbox v-model="excludeApplicationData">
                    {{ $t('SystemMigration.excludeApplicationData') }}
                  </el-checkbox>
                </div>
                <div class="summary-tip" :class="summary?.database?.supported ? 'success' : 'error'" v-if="summary">
                  {{ databaseTip }}
                </div>
              </div>

              <div class="result-card" v-if="hasExportFeedback">
                <div class="result-title">
                  <span>{{ $t('SystemMigration.exportResultTitle') }}</span>
                  <span class="result-status" :class="exportStatusClass">{{ exportStatusText }}</span>
                </div>
                <div class="result-item" v-if="downloadFileName">
                  <span>{{ $t('SystemMigration.downloadFileLabel') }}</span>
                  <span class="value">{{ downloadFileName }}</span>
                </div>
                <div class="result-item" v-if="exportError">
                  <span>{{ $t('SystemMigration.errorReasonLabel') }}</span>
                  <span class="value error-text">{{ exportError }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-step>
      </el-steps>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <template v-if="exportResult">
          <el-button v-if="!downloadCompleted" @click="handleCancel">{{ $t('SystemMigration.cancel') }}</el-button>
          <el-button v-if="!downloadCompleted" type="primary" @click="handleDownloadServerExport">
            {{ $t('SystemMigration.downloadExportPackage') }}
          </el-button>
          <el-button v-else type="primary" @click="handleConfirm">
            {{ $t('SystemMigration.confirm') }}
          </el-button>
        </template>
        <template v-else>
          <el-button @click="handleCancel">{{ $t('SystemMigration.cancel') }}</el-button>
          <el-button type="primary" :loading="exporting" :disabled="!canExport" @click="handleExport">
            {{ $t('SystemMigration.exportNow') }}
          </el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { FormDatabaseType } from '@common/types/nocode';
import { SystemMigrationExportResult, SystemMigrationExportSummary, SystemMigrationExportTaskStatus } from '@common/types/system-migration';
import { DialogBeforeCloseFn, ElMessage } from 'element-plus';
import axios from 'axios';
import i18next from 'i18next';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const summaryLoading = ref(false);
const exporting = ref(false);
const summary = ref<SystemMigrationExportSummary | null>(null);
const exportResult = ref<SystemMigrationExportResult | null>(null);
const exportError = ref('');
const excludeApplicationData = ref(false);
const exportTaskId = ref('');
const downloadCompleted = ref(false);
const downloadFileName = ref('');
const exportTaskPollTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const exportTaskPollFailureCount = ref(0);

const EXPORT_TASK_POLL_INTERVAL_MS = 1500;
const EXPORT_TASK_POLL_MAX_FAILURES = 4;
const EXPORT_TASK_POLL_MAX_RETRY_DELAY_MS = 12000;

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

const activeStep = computed(() => 0);

const hasExportFeedback = computed(() => {
  return exporting.value || downloadCompleted.value || !!exportResult.value || !!exportError.value;
});

const canExport = computed(() => {
  return !!summary.value?.database?.supported && !exporting.value;
});

const exportStatusText = computed(() => {
  if (exporting.value) {
    return i18next.t('SystemMigration.exportGenerating');
  }
  if (exportResult.value && !downloadCompleted.value) {
    return i18next.t('SystemMigration.exportPackageReady');
  }
  if (downloadCompleted.value) {
    return i18next.t('SystemMigration.exportResultSuccess');
  }
  if (exportError.value) {
    return i18next.t('SystemMigration.exportResultFailed');
  }
  return '';
});

const exportStatusClass = computed(() => {
  if (exporting.value) {
    return '';
  }
  if (exportResult.value && !downloadCompleted.value) {
    return 'success';
  }
  if (downloadCompleted.value) {
    return 'success';
  }
  if (exportError.value) {
    return 'error';
  }
  return '';
});

const isCanceledError = (error: any) => {
  return axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
};

const buildExportTaskId = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const cleanupCurrentExportTask = (taskId: string) => {
  if (!taskId) {
    return;
  }
  void axios.post('/system-migration/export-task/cleanup', { taskId }).catch(() => null);
};

const cancelServerExportTask = async (taskId: string) => {
  if (!taskId) {
    return;
  }
  await axios.post('/system-migration/export/cancel', { taskId }).catch(() => null);
};

const clearExportTaskPollTimer = () => {
  if (!exportTaskPollTimer.value) {
    return;
  }
  clearTimeout(exportTaskPollTimer.value);
  exportTaskPollTimer.value = null;
};

const resetExportTaskPollingState = () => {
  clearExportTaskPollTimer();
  exportTaskPollFailureCount.value = 0;
};

const cancelCurrentExport = () => {
  const taskId = exportTaskId.value;
  resetExportTaskPollingState();
  exportTaskId.value = '';
  exporting.value = false;
  if (taskId) {
    void axios.post('/system-migration/export/cancel', { taskId }).catch(() => null);
    cleanupCurrentExportTask(taskId);
  }
};

const resetState = () => {
  summaryLoading.value = false;
  exporting.value = false;
  summary.value = null;
  exportResult.value = null;
  exportError.value = '';
  excludeApplicationData.value = false;
  exportTaskId.value = '';
  resetExportTaskPollingState();
  downloadCompleted.value = false;
  downloadFileName.value = '';
};

const databaseTypeText = computed(() => {
  const type = summary.value?.database?.type;
  if (type === FormDatabaseType.MONGODB) {
    return i18next.t('SystemMigration.databaseTypeMongo');
  }
  if (type === FormDatabaseType.MYSQL) {
    return i18next.t('SystemMigration.databaseTypeMysql');
  }
  return i18next.t('SystemMigration.databaseTypeEmbedded');
});

const exportScopeText = computed(() => {
  return excludeApplicationData.value
    ? i18next.t('SystemMigration.exportScopeValueWithoutData')
    : i18next.t('SystemMigration.exportScopeValue');
});

const databaseTip = computed(() => {
  const database = summary.value?.database;
  if (!database) return '';
  if (database.message && !database.supported) {
    return database.message;
  }
  if (excludeApplicationData.value) {
    return i18next.t('SystemMigration.exportWithoutApplicationDataTip');
  }
  if (database.message) {
    return database.message;
  }
  if (database.requiresImportStep) {
    return i18next.t('SystemMigration.mongoExportTip');
  }
  return i18next.t('SystemMigration.embeddedExportTip');
});

const buildServerExportDownloadUrl = (taskId: string) => {
  const params = new URLSearchParams();
  params.set('taskId', taskId);
  return `/system-migration/export-download?${params.toString()}`;
};

const triggerServerDownload = (taskId: string) => {
  const link = document.createElement('a');
  link.href = buildServerExportDownloadUrl(taskId);
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const handleServerExportTaskStatus = (status: SystemMigrationExportTaskStatus | null) => {
  if (!status || status.taskId !== exportTaskId.value) {
    return;
  }
  if (status.status === 'running') {
    exportTaskPollFailureCount.value = 0;
    startServerExportTaskPolling();
    return;
  }

  resetExportTaskPollingState();
  exporting.value = false;
  if (status.status === 'success' && status.result) {
    downloadFileName.value = status.fileName || `system-migration-${Date.now()}.bbm`;
    exportResult.value = status.result;
    ElMessage.success(i18next.t('SystemMigration.exportPackageReady'));
    return;
  }

  exportError.value = buildDetailedErrorMessage(status.message, status.status === 'canceled' ? 'SystemMigration.exportCanceled' : 'SystemMigration.exportFailed');
  ElMessage.error(exportError.value);
  cleanupCurrentExportTask(status.taskId);
  exportTaskId.value = '';
};

const getExportTaskPollRetryDelay = (failureCount: number) => {
  const exponent = Math.max(0, failureCount - 1);
  return Math.min(EXPORT_TASK_POLL_INTERVAL_MS * (2 ** exponent), EXPORT_TASK_POLL_MAX_RETRY_DELAY_MS);
};

const scheduleServerExportTaskPolling = (delay = EXPORT_TASK_POLL_INTERVAL_MS) => {
  clearExportTaskPollTimer();
  if (!exportTaskId.value) {
    return;
  }
  exportTaskPollTimer.value = setTimeout(() => {
    void pollServerExportTaskStatus();
  }, delay);
};

const pollServerExportTaskStatus = async () => {
  const taskId = exportTaskId.value;
  if (!taskId) {
    return;
  }
  const status = await axios.get('/system-migration/export-task/status', {
    params: { taskId },
  }).then(({ data }) => data as SystemMigrationExportTaskStatus).catch((error) => {
    if (taskId !== exportTaskId.value || isCanceledError(error)) {
      return null;
    }
    exportTaskPollFailureCount.value += 1;
    if (exportTaskPollFailureCount.value < EXPORT_TASK_POLL_MAX_FAILURES) {
      scheduleServerExportTaskPolling(getExportTaskPollRetryDelay(exportTaskPollFailureCount.value));
      return null;
    }
    exportError.value = buildDetailedErrorMessage(error?.response?.data?.message, 'SystemMigration.exportTaskStatusFailed');
    ElMessage.error(exportError.value);
    resetExportTaskPollingState();
    exporting.value = false;
    return null;
  });
  handleServerExportTaskStatus(status);
};

const startServerExportTaskPolling = () => {
  scheduleServerExportTaskPolling();
};

const loadSummary = async () => {
  summaryLoading.value = true;
  exportResult.value = null;
  exportError.value = '';
  summary.value = await axios.get('/system-migration/export-summary').then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(resolveLocalizedMessage(response?.data?.message, 'SystemMigration.loadSummaryFailed'));
    return null;
  });
  summaryLoading.value = false;
};

const handleExport = async () => {
  if (exporting.value) {
    return;
  }
  exporting.value = true;
  exportResult.value = null;
  exportError.value = '';
  downloadCompleted.value = false;
  downloadFileName.value = '';
  void cancelServerExportTask(exportTaskId.value);
  cleanupCurrentExportTask(exportTaskId.value);
  const taskId = buildExportTaskId();
  exportTaskId.value = taskId;
  exportTaskPollFailureCount.value = 0;
  const status = await axios.post('/system-migration/export-task', {
    taskId,
    options: {
      includeApplicationData: !excludeApplicationData.value,
    },
  }).then(({ data }) => data as SystemMigrationExportTaskStatus).catch((error) => {
    exportError.value = buildDetailedErrorMessage(error?.response?.data?.message, 'SystemMigration.exportFailed');
    ElMessage.error(exportError.value);
    return null;
  });
  if (!status) {
    exportTaskId.value = '';
    exporting.value = false;
    return;
  }
  handleServerExportTaskStatus(status);
};

const handleDownloadServerExport = () => {
  const taskId = exportTaskId.value;
  if (!taskId) {
    return;
  }
  triggerServerDownload(taskId);
  downloadCompleted.value = true;
};

const handleConfirm = () => {
  cleanupCurrentExportTask(exportTaskId.value);
  exportTaskId.value = '';
  emit('update:modelValue', false);
};

const handleCancel = () => {
  cancelCurrentExport();
  emit('update:modelValue', false);
};

const handleBeforeClose: DialogBeforeCloseFn = (done) => {
  if (downloadCompleted.value) {
    resetExportTaskPollingState();
    cleanupCurrentExportTask(exportTaskId.value);
    exportTaskId.value = '';
    done();
    return;
  }
  cancelCurrentExport();
  done();
};

watch(() => props.modelValue, (value) => {
  if (value) {
  void loadSummary();
  } else {
    cancelCurrentExport();
    resetState();
  }
});

watch(excludeApplicationData, () => {
  if (exporting.value) {
    return;
  }
  cleanupCurrentExportTask(exportTaskId.value);
  exportTaskId.value = '';
  exportResult.value = null;
  exportError.value = '';
  downloadCompleted.value = false;
  downloadFileName.value = '';
});
</script>

<style lang="scss" scoped>
.migration-export-dialog {
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  row-gap: 16px;

  .step-body {
    padding: 8px 0 16px;
  }

  .intro {
    margin-bottom: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #f7f8fa;
    color: #4e5969;
    line-height: 1.6;
    font-size: 13px;
  }

  .step-actions {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
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
  }

  .summary-card,
  .result-card {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-color-page);
  }

  .result-card {
    margin-top: 12px;
  }

  .summary-row,
  .result-item {
    display: flex;
    justify-content: space-between;
    column-gap: 16px;
    line-height: 20px;
    font-size: 13px;
    color: var(--text-color-regular);

    .value {
      flex: 1;
      text-align: right;
      word-break: break-all;
      color: #1d2129;
    }
  }

  .summary-row + .summary-row,
  .result-item + .result-item {
    margin-top: 10px;
  }

  .summary-option {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border-color);

    :deep(.el-checkbox) {
      align-items: flex-start;
      height: auto;
    }

    :deep(.el-checkbox__label) {
      white-space: normal;
      line-height: 1.6;
      color: var(--text-color-regular);
    }
  }

  .summary-tip {
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 6px;
    line-height: 1.6;
    font-size: 12px;

    &.success {
      background: #f0f9eb;
      color: #5b8a31;
    }

    &.error {
      background: #fef0f0;
      color: #d03050;
    }
  }

  .result-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
    color: #1d2129;
  }

  .result-status {
    font-weight: 400;
    font-size: 12px;

    &.success {
      color: #5b8a31;
    }

    &.error {
      color: #d03050;
    }
  }

  .error-text {
    color: #d03050;
    white-space: pre-line;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
