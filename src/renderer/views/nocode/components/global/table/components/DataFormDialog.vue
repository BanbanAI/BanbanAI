<template>
  <div class="data-form-dialog data-form-container" v-if="!isDrawer || modalOnly">
    <el-dialog :title="title" :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)"
      @open="handleOpen" @opened="handleOpened" @closed="handleClear" :close-on-click-modal="false" :destroy-on-close="true" draggable
      :modal="true" :lock-scroll="true"
      align-center class="table-form-dialog" :show-close="false" :style="dialogStyle" :fullscreen="isFullscreen">
      <template #header>
        <div class="title" :title="title">{{ title }}</div>
        <div class="menus">
          <el-button
            v-if="!modalOnly"
            link
            :title="$t('DataFormDialog.switchToDrawer')"
            @click="changeDisplayMode(true)"
          >
            <el-icon :size="16"><i-ven-icon-partial-full-screen /></el-icon>
          </el-button>
          <el-button
            link
            :title="isFullscreen ? $t('DataFormDialog.exitFullscreen') : $t('DataFormDialog.fullscreen')"
            @click="isFullscreen = !isFullscreen"
          >
            <el-icon :size="16">
              <i-ven-icon-shrink-screen v-if="isFullscreen" />
              <i-ven-icon-full-screen v-else />
            </el-icon>
          </el-button>
          <el-button link @click="handleClose">
            <el-icon :size="16"><i-ep-close /></el-icon>
          </el-button>
        </div>
      </template>
      <template #default>
        <data-form-core :isViewing="isViewing" :row="currentFormRow" :loading="isSubmitting"
          :formReady="isFormReady" :formMode="formMode"
          :isEditDataAble="canEditCurrentRow" :isDeleteDataAble="canDeleteCurrentRow"
          :printTemplates="filteredPrintTemplate" :showProcessFlowToggle="showSidePanel"
          :preHiddenColumnIds="preHiddenColumnIds"
          :showStashButton="showStashButton"
          :processInfoFolded="processInfoFolded"
          :showDisplayFields="!isPublicVisit"
          :showShare="isPublicVisit ? false : undefined"
          :showCopy="!isPublicVisit"
          :showDelete="!isPublicVisit"
          :showEdit="!isPublicVisit"
          @updateHiddenColumns="updateHiddenColumnIds" @print="handlePrint" @copy="clickCopyButton"
          @share="rowShareDialogVisible = true"
          @delete="deleteTipDialogVisible = true" @edit="handleClickEditBtn" @submit="handleSubmit"
          @openProcessInfo="syncProcessInfoFolded(false)"
          @submitDraft="handleSubmitDraft" @stash="handleStash" @cancel="handleCancel">
          <template #header-actions>
            <div
              v-if="showFinishFlowButton"
              class="icon-wrap danger"
              @click="handleFinishFlow"
            >
              <el-icon size="16"><i-ep-switch-button /></el-icon>
              <span>{{ $t('DataFormDialog.finishFlow') }}</span>
            </div>
          </template>
          <template #toolbar-right>
            <view-action-button-group
              v-if="detailActionItems.length && isViewing"
              class="detail-action-group"
              :items="detailActionItems"
              :maxVisible="6"
              size="small"
              @execute="emit('executeViewAction', $event)"
            />
          </template>
          <template #form>
            <nocode-form :showLoading="false" :key="formRenderKey" ref="editingFormRef" v-bind="nocodeFormProps" :row="mergedRow" :isViewing="isViewing" v-if="isShowForm && props.modelValue" @ready="handleFormReady"></nocode-form>
          </template>
          <template #right>
            <data-form-side-panel
              v-if="showSidePanel && !processInfoFolded"
              class="right process-right"
              :todo="todo"
              :showFlowTab="runtime !== FormTableRuntime.FORM_EDITOR"
              @fold="syncProcessInfoFolded(true)"
            />
          </template>
        </data-form-core>
        
      </template>
    </el-dialog>
  </div>
  <div class="data-form-drawer data-form-container" v-else>
    <el-drawer :title="title" :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)"
      @open="handleOpen" @opened="handleOpened" @closed="handleClear" close-on-click-modal :before-close="handleDrawerBeforeClose"
      :destroy-on-close="true" :modal="true" :lock-scroll="!workbenchScoped"
      :modal-class="workbenchScoped ? 'workbench-scoped-form-overlay' : undefined"
      :append-to="workbenchOverlayHost"
      draggable align-center class="table-form-drawer" :class="{ 'is-fullscreen': isFullscreen }"
      :show-close="false" :size="isFullscreen ? '100%' : '70%'">
      <template #header>
        <div class="title" :title="title">{{ title }}</div>
        <div class="menus">
          <el-button link :title="$t('DataFormDialog.switchToDialog')" @click="changeDisplayMode(false)">
            <el-icon :size="16"><i-ven-icon-partial-shrink-screen /></el-icon>
          </el-button>
          <el-button
            link
            :title="isFullscreen ? $t('DataFormDialog.exitFullscreen') : $t('DataFormDialog.fullscreen')"
            @click="isFullscreen = !isFullscreen"
          >
            <el-icon :size="16">
              <i-ven-icon-shrink-screen v-if="isFullscreen" />
              <i-ven-icon-full-screen v-else />
            </el-icon>
          </el-button>
          <el-button link @click="handleClose"><el-icon :size="16"><i-ep-close></i-ep-close></el-icon></el-button>
        </div>
      </template>
      <template #default>
        <data-form-core :isViewing="isViewing" :row="currentFormRow" :loading="isSubmitting"
          :formReady="isFormReady" :formMode="formMode"
          :isEditDataAble="canEditCurrentRow" :isDeleteDataAble="canDeleteCurrentRow"
          :printTemplates="filteredPrintTemplate" :showProcessFlowToggle="showSidePanel"
          :preHiddenColumnIds="preHiddenColumnIds"
          :showStashButton="showStashButton"
          :processInfoFolded="processInfoFolded"
          :showDisplayFields="!isPublicVisit"
          :showShare="isPublicVisit ? false : undefined"
          :showCopy="!isPublicVisit"
          :showDelete="!isPublicVisit"
          :showEdit="!isPublicVisit"
          @updateHiddenColumns="updateHiddenColumnIds" @print="handlePrint" @copy="clickCopyButton"
          @share="rowShareDialogVisible = true"
          @delete="deleteTipDialogVisible = true" @edit="handleClickEditBtn" @submit="handleSubmit"
          @openProcessInfo="syncProcessInfoFolded(false)"
          @submitDraft="handleSubmitDraft" @stash="handleStash" @cancel="handleCancel">
          <template #header-actions>
            <div
              v-if="showFinishFlowButton"
              class="icon-wrap danger"
              @click="handleFinishFlow"
            >
              <el-icon size="16"><i-ep-switch-button /></el-icon>
              <span>{{ $t('DataFormDialog.finishFlow') }}</span>
            </div>
          </template>
          <template #toolbar-right>
            <view-action-button-group
              v-if="detailActionItems.length && isViewing"
              class="detail-action-group"
              :items="detailActionItems"
              :maxVisible="6"
              size="small"
              @execute="emit('executeViewAction', $event)"
            />
          </template>
          <template #form>
            <nocode-form :showLoading="false" :key="formRenderKey" ref="editingFormRef" v-bind="nocodeFormProps" :row="mergedRow" :isViewing="isViewing"
              v-if="isShowForm && props.modelValue" @ready="handleFormReady"></nocode-form>
          </template>
          <template #right>
            <data-form-side-panel
              v-if="showSidePanel && !processInfoFolded"
              class="right process-right"
              :todo="todo"
              :showFlowTab="runtime !== FormTableRuntime.FORM_EDITOR"
              @fold="syncProcessInfoFolded(true)"
            />
          </template>
        </data-form-core>
        
      </template>
    </el-drawer>
  </div>
  <table-delete-data-dialog v-model="deleteTipDialogVisible" @deleteTableData="deleteCheckRowsData"
    :title="$t('DataFormDialog.delete')" :dataText="$t('DataFormDialog.currentRow')" />
  <form-save-tip-dialog ref="saveTipDialogRef" :title="$t('DataFormDialog.isSave')" />
  <tip-dialog ref="drawerExitTipDialogRef" :title="$t('DataFormDialog.tip')" :content="$t('DataFormDialog.isExit')"
    :closeOnClickModal="true" />
  <tip-dialog
    ref="finishFlowTipDialogRef"
    :title="$t('DataFormDialog.finishFlow')"
    :content="$t('DataFormDialog.confirmFinishFlow')"
    :confirmText="$t('DataFormDialog.finishFlow')"
    :cancelText="$t('DataFormDialog.cancel')"
    :confirmBtnStyle="{ backgroundColor: '#f9484e' }"
  />
  <print-dialog v-model="printDialogVisible" :title="$t('DataFormDialog.print')" v-bind="printingInfo"
    @closed="closePrintingDialog" />
  <!-- 打印结束调用弹窗 -->
  <office-print-preview v-model="visibleOfPreview" :uploadTemplateName="uploadTemplateName" :preViewPath="previewPath"
    :nocodeId="dialogNocodeId" :tableId="tableProps.tableUID" :recordId="templateRecord?.uid"
    :isTemporary="templateRecord?.isTemporary ?? false" @download="downloadPrintTemplate"
    @closed="closePreviewDialog" />
  <word-print-preview v-model="visibleOfWordPreview" :uploadTemplateName="uploadTemplateName" :preViewPath="previewPath"
    :nocodeId="dialogNocodeId" :tableId="tableProps.tableUID" :recordId="templateRecord?.uid"
    :isTemporary="templateRecord?.isTemporary ?? false" @download="downloadPrintTemplate"
    @closed="closePreviewDialog" />
  <row-share-link-dialog
    v-if="table?.table && currentFormRow"
    v-model="rowShareDialogVisible"
    :table="table.table"
    :row="currentFormRow"
    :nocodeId="dialogNocodeId"
  />

</template>

<script lang='ts' setup>
import { ElLoading, ElMessage } from 'element-plus';
import { computed, ref, watch, reactive, Ref, nextTick, onMounted, onBeforeUnmount, inject } from 'vue';
import { provideFormMode, useTableProps } from "../hooks";
import { useTable } from '../hooks';
import { FormMode } from '../types';
import { formFlowApi, useRuntime, doDownload, formDataApi } from '@renderer/utils';
import { FormTableRuntime, PrintedTemplateRecord, PrintTemplate, PrintTemplateMode, PrintTemplateType, ViewAction } from '@common/types/nocode';
import { DataChangeType, ProcessNodeStatus, Row } from '@common/types/project';
import { collectPrintCurrentOwnerIds, fillPrintProcessSystemFieldValues, getUUIDSystemField } from '@common/utils';
import { fetchPathAsArrayBuffer } from '@common/utils/print/shared';
import { projectApi } from '@renderer/utils/api/project';
import { printDataReplace, systemPrint } from '@renderer/utils/print';
import i18next from 'i18next';
import { isEmpty } from '@common/utils/object';
import RowShareLinkDialog from './RowShareLinkDialog.vue';
import DataFormSidePanel from './DataFormSidePanel.vue';
import { useRoute } from 'vue-router';
import { sanitizeCopiedRowForCopy } from '../copy';
import ViewActionButtonGroup from './ViewActionButtonGroup.vue';
import { getDeleteResultMessage, hasDeleteFailures } from '../delete-result-message';
import { isDataChangeTriggerStashEnabled } from '@common/utils';
import { usePassportStore } from '@renderer/stores';
import { NOCODE } from '@renderer/types';
import type { AbstractForm } from '@renderer/b2/controllers/form';
import { createWorkbenchAiFormFillRuntime } from '@renderer/views/nocode/utils/workbenchAiFormFillRuntime';
import {
  WORKBENCH_AI_FORM_FILL_CONTEXT,
  type WorkbenchAiFormFillHost,
} from '@renderer/views/nocode/views/workbench/AI/workbenchAiFormFillContext';

const props = defineProps<{
  modelValue: boolean,
  title: string,
  nocodeFormProps: any,
  formMode: FormMode,
  startInEdit?: boolean,
  preHiddenColumnIds?: string[],
  contentRefreshKey?: number,
  processRefreshKey?: number,
  detailActionItems?: Array<{ action: ViewAction, disabled?: boolean, tip?: string }>,
  workbenchScoped?: boolean,
  modalOnly?: boolean,
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void,
  (e: "submitted", submitType: FormMode, submitContinuous: boolean): void,
  (e: "copy", copyRow: Row): void,
  (e: "draft-saved"): void,
  (e: "flow-finished", uuid: string): void,
  (e: "executeViewAction", action: ViewAction): void,
  (e: "deleted"): void,
}>();

const saveTipDialogRef = ref();
const drawerExitTipDialogRef = ref();
const isDrawer = ref(true);
const isFullscreen = ref(false);
const table = useTable();
const editingFormRef = ref();
const isViewing = ref(true);
const deleteTipDialogVisible = ref(false);
const tableProps = useTableProps()
const dialogNocodeId = computed(() => props.nocodeFormProps?.nocodeId || tableProps.nocodeId);
const route = useRoute();
const isPublicVisit = computed(() => route.matched?.some(record => record.meta?.isPublicShare === true || record.meta?.isPublicRowShare === true) || route.meta?.isPublicShare === true || route.meta?.isPublicRowShare === true || route.name === 'PublicQuery');
const row = ref(null)
const mergedRow = computed(() => row.value || props.nocodeFormProps?.row);
const isShowForm = ref(false);
const isFormReady = ref(false);
const isSubmitting = ref(false)
const processInfoFolded = ref(table?.processInfoFolded ?? false);
const rowShareDialogVisible = ref(false);
const passportState = usePassportStore();
const finishFlowTipDialogRef = ref();
const nocode = inject(NOCODE, null);
const workbenchAiFormFillContext = inject(WORKBENCH_AI_FORM_FILL_CONTEXT, null);
const workbenchOverlayHost = computed(() => {
  if (!props.workbenchScoped) return 'body';
  return workbenchAiFormFillContext?.overlayHost.value || 'body';
});
const createFormFillContextId = () => `data-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formFillContextId = ref(createFormFillContextId());
const activeFormFillTarget = computed(() => props.modelValue
  ? `${props.formMode}:${String(props.nocodeFormProps?.uuid || 'new')}`
  : '');
const formReadyVersion = ref(0);
let unregisterAiFormFillHost: (() => void) | null = null;

const waitForEditableForm = async () => {
  if (!isViewing.value) return true;
  if (!canEditCurrentRow.value) return false;
  handleClickEditBtn();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 20));
    if (!isViewing.value && editingFormRef.value?.getFormWidget?.()) {
      return true;
    }
  }
  return false;
};

const aiFormFillRuntime = createWorkbenchAiFormFillRuntime({
  get contextId() {
    return formFillContextId.value;
  },
  get appId() {
    return String(dialogNocodeId.value || '');
  },
  get appName() {
    return String(nocode?.value?.meta?.name || '');
  },
  get formMode() {
    return props.formMode === FormMode.Edit ? 'edit' as const : 'add' as const;
  },
  getForm: () => editingFormRef.value?.getFormWidget?.() as AbstractForm | null,
  getTable: () => editingFormRef.value?.getCurrentTable?.(),
  getFormData: () => editingFormRef.value?.getCurrentFormData?.(),
  ensureEditable: waitForEditableForm,
});

const registerAiFormFillHost = () => {
  unregisterAiFormFillHost?.();
  unregisterAiFormFillHost = null;
  if (!props.modelValue || !workbenchAiFormFillContext) return;
  const host: WorkbenchAiFormFillHost = {
    contextId: formFillContextId.value,
    getSnapshot: aiFormFillRuntime.getSnapshot,
    applyFill: aiFormFillRuntime.applyFill,
    undoFill: aiFormFillRuntime.undoFill,
  };
  unregisterAiFormFillHost = workbenchAiFormFillContext.registerForm(host);
};

const handleFormReady = () => {
  isFormReady.value = true;
  formReadyVersion.value += 1;
  syncReadonlyHiddenFields();
  registerAiFormFillHost();
};

watch(activeFormFillTarget, (target, previousTarget) => {
  if (target && target !== previousTarget) {
    formFillContextId.value = createFormFillContextId();
  }
  registerAiFormFillHost();
}, { immediate: true, flush: 'post' });
watch(formReadyVersion, registerAiFormFillHost);
onBeforeUnmount(() => unregisterAiFormFillHost?.());

const syncProcessInfoFolded = (value: boolean) => {
  processInfoFolded.value = value;
  if (table) {
    table.processInfoFolded = value;
  }
}

const restoreProcessInfoFolded = () => {
  processInfoFolded.value = table?.processInfoFolded ?? false;
}
const detailActionItems = computed(() => props.detailActionItems || []);
const showFinishFlowButton = computed(() => {
  return Boolean(
    isViewing.value
    && (passportState.account?.isAdmin || passportState.isMainAccount)
    && todo.value?.status === ProcessNodeStatus.IN_PROGRESS
  );
});
const formRenderKey = computed(() => {
  return `${props.nocodeFormProps?.uuid || "new"}-${props.contentRefreshKey || 0}-${isViewing.value ? "view" : "edit"}`;
});
const readonlyHiddenColumnIds = ref<string[]>([]);

const currentFormRow = computed(() => {
  if (isViewing.value) {
    return editingFormRef.value?.getFormWidget?.()?.getRow?.() || mergedRow.value;
  }
  return editingFormRef.value?.getFormRow();
})
const showStashButton = computed(() => {
  if (isViewing.value || runtime === FormTableRuntime.FORM_EDITOR) {
    return false;
  }
  const process = table?.formData?.formOptions?.[table.formTableUID]?.process;
  if (props.formMode === FormMode.Add) {
    return tableProps?.isAddDataAble !== false && isDataChangeTriggerStashEnabled(process, DataChangeType.ADD);
  }
  if (props.formMode === FormMode.Edit) {
    return tableProps?.isEditDataAble !== false && isDataChangeTriggerStashEnabled(process, DataChangeType.EDIT);
  }
  return false;
});

const detailPermissionRow = computed(() => {
  return currentFormRow.value || mergedRow.value || table?.selectedRow || null;
});

const canEditCurrentRow = computed(() => {
  if (!tableProps.isEditDataAble) {
    return false;
  }
  return table?.canEditRow?.(detailPermissionRow.value) ?? !!tableProps.isEditDataAble;
});

const canDeleteCurrentRow = computed(() => {
  if (!tableProps.isDeleteDataAble) {
    return false;
  }
  return table?.canDeleteRow?.(detailPermissionRow.value) ?? !!tableProps.isDeleteDataAble;
});

const isFormModified = () => {
  if (isViewing.value) return false;
  return !!editingFormRef.value?.isModified?.();
}

const changeDisplayMode = (visible: boolean) => {
  if (editingFormRef.value) {
    row.value = editingFormRef.value.getFormRow();
  } else if (editingFormRef.value) {
    row.value = editingFormRef.value.getFormRow();
  }
  isDrawer.value = visible
}

const handleSubmit = async (isSubmitContinuous: boolean, isSaveCurrentContent: boolean) => {
  if (!isFormReady.value || isSubmitting.value || !editingFormRef.value) return;
  isSubmitting.value = true;
  let loadingInstance: ReturnType<typeof ElLoading.service> | undefined;
  try {
    const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.(
      props.formMode !== FormMode.Edit
        ? {
          onSignSyncConflict: saveDraftBeforeRefresh,
        }
        : undefined
    );
    if (!confirmed) {
      editingFormRef.value?.clearSubmitValidationNotice?.();
      return;
    }
    loadingInstance = ElLoading.service({
      target: ".iframe-wrap",
      text: i18next.t('DataFormDialog.submiting'),
      background: "rgba(0, 0, 0, 0.2)"
    });
    const result = await editingFormRef.value.submit({ skipSubmitValidationNoticeConfirm: true, skipSubmitSignSyncConfirm: true });
    if (result) {
      if (props.formMode === FormMode.Add) {
        ElMessage.success(i18next.t('DataFormDialog.addSuccess'));
        if (isSubmitContinuous && isSaveCurrentContent) {
          await editingFormRef.value.resetAddingRowIdentity?.();
        }
      } else {
        ElMessage.success(i18next.t('DataFormDialog.editSuccess'));
      }
      if (isSubmitContinuous) {  // 勾选连续提交
        if (!isSaveCurrentContent) {  // 不保存当前内容
          // 重置表单数据
          isShowForm.value = false;
        }
        nextTick().then(() => {
          isShowForm.value = true;
        });
        emit("submitted", props.formMode, isSubmitContinuous);
      } else {  // 不勾选连续提交
        emit("submitted", props.formMode, isSubmitContinuous);
      }
    }
    return result;
  } finally {
    loadingInstance?.close();
    isSubmitting.value = false;
  }
}

async function saveDraftBeforeRefresh() {
  if (!editingFormRef.value) return false;
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    text: i18next.t('DataFormDialog.saveDraftLoading'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  const res = await editingFormRef.value.saveDraft().then(() => true).catch((err) => {
    ElMessage.error(err?.message || i18next.t('DraftDataDialog.saveFail'));
    return false;
  });
  loadingInstance.close();
  return res;
}

const handleSubmitDraft = async () => {
  if (!isFormReady.value || isSubmitting.value || !editingFormRef.value) return;
  const res = await saveDraftBeforeRefresh();
  if (res) {
    ElMessage.success(i18next.t('DataFormDialog.saveDraftSuccess'));
    await nextTick()
    emit("draft-saved");
  }
}

const handleStash = async () => {
  if (!isFormReady.value || isSubmitting.value || !editingFormRef.value) return;
  const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.({
    onSignSyncConflict: saveDraftBeforeRefresh,
  });
  if (!confirmed) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  isSubmitting.value = true;
  const loadingInstance = ElLoading.service({
    target: ".iframe-wrap",
    text: i18next.t('DataFormDialog.stashLoading'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  try {
    const result = await editingFormRef.value.stash?.();
    if (result) {
      ElMessage.success(i18next.t('DataFormDialog.stashSuccess'));
      emit("submitted", props.formMode, false);
    }
  } finally {
    loadingInstance.close();
    isSubmitting.value = false;
    editingFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const copyRow = ref(null)

const clickCopyButton = () => {
  const currentRow = editingFormRef.value.getFormRow() ?? {};
  const currentTable = table?.getTable(table.formTableUID);
  if (!currentTable || !table?.formData) return;
  copyRow.value = sanitizeCopiedRowForCopy({
    row: currentRow,
    table: currentTable,
    formData: table.formData,
  });
  emit('copy', copyRow.value)
}

const printTemplateType = ref<PrintTemplateType>()
const templateRecord: Ref<PrintedTemplateRecord> = ref();
const uploadTemplateName = ref('');
const previewPathStr = ref<string | null>(null);
const visibleOfPreview = ref(false);
const visibleOfWordPreview = ref(false);
const previewArrayBuffer = ref<ArrayBuffer | Blob | null>(null);
const printingInfo = reactive({
  loading: false,
  status: "success",
});
const printDialogVisible = ref(false)
const filteredPrintTemplate = ref([])

const previewPath = computed(() => {
  if (previewArrayBuffer.value) {
    return previewArrayBuffer.value;
  }
  return previewPathStr.value ? previewPathStr.value : '';
});

const handlePrint = async (template?: PrintTemplate) => {
  if (!template) {
    await handleSingleRecordSystemPrint();
  } else {
    await handlePrintTemplate(template);
  }
}

const loadPrintBuckets = async (tableUIDs: string[], options) => {
  if (table.tableProps?.dataPermissionMode === "all") {
    return await formDataApi.getManagedViewTableData({
      nocodeId: table.nocodeId,
      tableUIDs,
      options,
      widgetUID: table.uid,
      widgetNocodeId: table.tableProps?.widgetNocodeId || table.tableProps?.nocodeId || table.nocodeId,
    });
  }
  return await formDataApi.getData({
    nocodeId: table.nocodeId,
    tableUIDs,
    options,
  });
};

const loadPrintBucket = async (tableUID: string, options) => {
  const buckets = await loadPrintBuckets([tableUID], options);
  return buckets[0];
};

const buildSingleRecordPrintRows = async (sourceRows: Row[]) => {
  const currentTable = table.getTable(table.formTableUID);
  const uuidField = getUUIDSystemField(currentTable.fields);
  const uuids = sourceRows.map((item: Row) => item[uuidField.uid]).filter(Boolean);
  if (!uuids.length) {
    throw new Error(i18next.t('DataFormDialog.unsavedDataCannotPrint'));
  }

  const buckets = await loadPrintBuckets([table.formTableUID], {
    fillSubTable: true,
    transformFormData: true,
    formatData: true,
    filters: {
      [table.formTableUID]: [{
        [uuidField.uid]: {
          $in: uuids
        }
      }]
    }
  });
  const rows = buckets[0]?.rows || [];
  const replacedRows = await printDataReplace(
    rows,
    table.allColumns,
    {
      nocodeId: table.nocodeId,
      loadBucket: loadPrintBucket,
    }
  );
  const ownerIds = collectPrintCurrentOwnerIds(replacedRows, table.table.fields);
  await table.prefetchAccounts(ownerIds);
  const ownerNameMap = Object.fromEntries(await Promise.all(ownerIds.map(async id => {
    const account = await table.getOrganizationAccount(id);
    return [id, account?.realname || id];
  })));
  return fillPrintProcessSystemFieldValues(replacedRows, table.table.fields, {
    process: table.formData?.formOptions?.[table.formTableUID]?.process,
    ownerNameMap,
  });
};

const handleSingleRecordSystemPrint = async () => {
  const currentRow = editingFormRef.value?.getFormRow() ?? {};
  const loadingInstance = ElLoading.service({
    target: ".iframe-wrap",
    text: i18next.t('DataFormDialog.preparingPrint'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  try {
    const rows = await buildSingleRecordPrintRows([currentRow]);
    await systemPrint({
      title: i18next.t('DataFormDialog.singleRecordSystemPrint'),
      describeInfo: '',
      columns: table.allColumns,
      rows,
      hideColumns: readonlyHiddenColumnIds.value,
      mode: "singleRecord",
    });
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : i18next.t('DataFormDialog.printFailed'));
  } finally {
    loadingInstance.close();
  }
}

const downloadPrintTemplate = async (downloadSrc) => {
  if (typeof downloadSrc === 'string') {  // 如果是字符串url
    doDownload({
      url: downloadSrc,
      name: uploadTemplateName.value,
    })
  } else if (downloadSrc instanceof Blob || downloadSrc instanceof ArrayBuffer) {  // 如果是Blob或者Arraybuffer
    const blob = new Blob([downloadSrc], { type: printTemplateType.value === PrintTemplateType.EXCEL ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    doDownload({
      url: url,
      name: uploadTemplateName.value,
    })
  } else {  // 如果是File对象
    const url = URL.createObjectURL(downloadSrc);
    doDownload({
      url: url,
      name: uploadTemplateName.value,
    })
  }
};

const closePreviewDialog = () => {
  previewArrayBuffer.value = null;
  previewPathStr.value = null;
  uploadTemplateName.value = '';
};

const getTemplateRender = async (option: { printTemplateUID: string, rowUids: string[] }) => {
  const res = await projectApi.getTemplateRender({
    nocodeId: table.nocodeId,
    tableId: tableProps.tableUID,
    printTemplateUID: option.printTemplateUID,
    selectRowUids: option.rowUids,
  })
  return res;
}
// 获取第一个文件的 ArrayBuffer
const getFirstFileAsArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip(arrayBuffer);
  const fileNames = Object.keys(zip.files)
    .filter(name => !zip.files[name].dir)
    .sort(); // 可选：按文件名排序

  if (fileNames.length === 0) {
    throw new Error(i18next.t('DataFormDialog.zipNoFolder'));
  }

  const firstFileName = fileNames[0];
  const zipEntry = zip.file(firstFileName);
  const uint8Array = zipEntry.asUint8Array();

  return {
    fileName: firstFileName,
    arrayBuffer: uint8Array.buffer,
    uint8Array: uint8Array
  };
}

const handlePreview = async (template, rows: Row[]) => {
  const uidField = table.getTable(table.formTableUID).fields.find(item => item.meta.name === '_uuid')

  const res = await getTemplateRender({
    printTemplateUID: template.uid,
    rowUids: rows.map(row => row[uidField.uid]),
  })
  if (!res.url) {
    throw new Error('Not find preview url')
  }
  previewPathStr.value = `${window.location.origin}${res.url}`;

  uploadTemplateName.value = res.record?.name || template.name;
  printTemplateType.value = template.type;
  if (template.type === PrintTemplateType.EXCEL) {
    if (template.mode === PrintTemplateMode.MULTIPLE) {
      const arrayBuffer = await fetchPathAsArrayBuffer(previewPathStr.value)
      const previewFile = await getFirstFileAsArrayBuffer(arrayBuffer)
      previewArrayBuffer.value = previewFile.arrayBuffer as ArrayBuffer;
      uploadTemplateName.value = previewFile.fileName;
    }
    visibleOfPreview.value = true;
  } else {
    visibleOfWordPreview.value = true;
  }
}

const handlePrintTemplate = async (template) => {
  printingInfo.loading = true;
  printDialogVisible.value = true;
  const uuidField = getUUIDSystemField(table.getTable(table.formTableUID).fields)
  const _row = editingFormRef.value.getFormRow() ?? {};
  const selectRowUIDs = [_row[uuidField.uid]];
  const res = await getTemplateRender({
    printTemplateUID: template.uid,
    rowUids: selectRowUIDs,
  })
  printingInfo.loading = false;
  if (!res?.url) {
    printingInfo.status = "fail";
    return;
  }
  templateRecord.value = res.record;
  previewPathStr.value = `${window.location.origin}${res.url}`;
  uploadTemplateName.value = res.record?.name || template.name;
  printTemplateType.value = template.type;
  if (template.type === PrintTemplateType.EXCEL) {
    if (template.mode === PrintTemplateMode.MULTIPLE) {
      const arrayBuffer = await fetchPathAsArrayBuffer(previewPathStr.value)
      const previewFile = await getFirstFileAsArrayBuffer(arrayBuffer)
      previewArrayBuffer.value = previewFile.arrayBuffer as ArrayBuffer;
      uploadTemplateName.value = previewFile.fileName;
    }
    visibleOfPreview.value = true;
  } else {
    visibleOfWordPreview.value = true;
  }
}

const closePrintingDialog = () => {
  printingInfo.loading = false;
  printingInfo.status = "success";
}

const getFilteredPrintTemplate = async () => {
  if (isPublicVisit.value) {
    filteredPrintTemplate.value = [];
    return;
  }
  const data = await table.getFilteredPrintTemplatesCached(table.nocodeId, tableProps.tableUID).catch(err => {
    ElMessage.error(err.message);
    return null;
  });
  if (data) {
    filteredPrintTemplate.value = data.filter(item => item.enabled);
  }
}

const handleCancel = () => {
  isViewing.value = true;
}

const confirmCloseModifiedForm = async (source: "button" | "drawer-before-close") => {
  const isModified = isFormModified();
  if (!isModified) {
    return true;
  }

  if (props.formMode === FormMode.Add && !isViewing.value) {
    return await drawerExitTipDialogRef.value?.confirm() === true;
  }

  if (
    source === "drawer-before-close"
    && isDrawer.value
    && !isViewing.value
    && props.formMode === FormMode.Edit
  ) {
    return await drawerExitTipDialogRef.value?.confirm() === true;
  }

  if (props.formMode === FormMode.Edit && !isViewing.value) {
    const isSave = await saveTipDialogRef.value?.confirm();
    if (isSave) {
      handleSubmit(false, false);
      return false;
    }
    return isSave === false;
  }

  return true;
}

const handleClose = async () => {
  const canClose = await confirmCloseModifiedForm("button");
  if (!canClose) {
    return;
  }
  emit("update:modelValue", false)
}

const handleClickEditBtn = () => {
  if (!canEditCurrentRow.value) {
    return;
  }
  isViewing.value = false;
}

const runtime = useRuntime();
const deleteCheckRowsData = async () => {
  if (!canDeleteCurrentRow.value) {
    ElMessage.warning(i18next.t('InnerRowShareViewer.noPermission'));
    return;
  }
  const currentRow = props.modalOnly
    ? currentFormRow.value || mergedRow.value
    : table.selectedRow;
  if (!currentRow) {
    return;
  }
  await table.removeRows([currentRow], runtime).then((result) => {
    const message = getDeleteResultMessage(result, i18next.t('DataFormDialog.delSuccess'));
    if (hasDeleteFailures(result)) {
      ElMessage.warning(message);
      return;
    }
    ElMessage.success(message);
    emit("deleted");
  }).catch((err) => {
    ElMessage.error(err.message);
  });;
  emit("update:modelValue", false)
}

const updateHiddenColumnIds = (value: string[]) => {
  readonlyHiddenColumnIds.value = value || [];
  editingFormRef.value?.setHiddenFields(value);
}

const syncReadonlyHiddenFields = () => {
  if (!isViewing.value) {
    return;
  }
  editingFormRef.value?.setHiddenFields(readonlyHiddenColumnIds.value);
}

const handleDrawerBeforeClose = async (done) => {
  const canClose = await confirmCloseModifiedForm("drawer-before-close");
  if (canClose) {
    done();
  }
}

const handleClear = () => {
  if (props.formMode === FormMode.Edit) isViewing.value = true;
  isFullscreen.value = false;

  // isSubmitContinuous.value = false;
  // isSaveCurrentContent.value = false;
  isShowForm.value = true;
  isFormReady.value = false;
  isSubmitting.value = false;
  todo.value = null;
}

const syncOpenState = () => {
  restoreProcessInfoFolded();
  if (props.formMode === FormMode.Edit) isViewing.value = !props.startInEdit;
  else isViewing.value = false;

  if (!isEmpty(tableProps.addNewRowData) && props.formMode === FormMode.Add) {
    row.value = tableProps.addNewRowData;
  }
}

const handleOpen = () => {
  syncOpenState();
}
const handleOpened = () => {
  isShowForm.value = true;
}
const todo = ref()
const showSidePanel = computed(() => !isPublicVisit.value && props.formMode !== FormMode.Add && runtime !== FormTableRuntime.FORM_EDITOR);
const dialogStyle = computed(() => {
  if (props.modalOnly && isFullscreen.value) {
    return { '--width': '100%', '--height': '100%', margin: '0' };
  }
  if (showSidePanel.value && !processInfoFolded.value) {
    return { '--width': '70%' };
  }
  return {};
});
const getTodo = async () => {
  if (isPublicVisit.value || runtime === FormTableRuntime.FORM_EDITOR || !props.nocodeFormProps.uuid) {
    todo.value = null;
    return;
  }
  const data = await formFlowApi.getTodo({
    nocodeId: dialogNocodeId.value,
    tableUID: table.formTableUID,
    uuid: props.nocodeFormProps.uuid
  });
  todo.value = data
}

const handleFinishFlow = async () => {
  if (!todo.value) {
    return;
  }
  const currentUuid = todo.value.uuid;
  const confirmed = await finishFlowTipDialogRef.value?.confirm();
  if (!confirmed) {
    return;
  }
  try {
    await formFlowApi.finishTodo({
      nocodeId: todo.value.nocodeId,
      tableId: todo.value.tableId,
      uuid: todo.value.uuid,
      todoId: todo.value.todoId,
      flowId: todo.value.flowId,
      id: todo.value.id,
    });
    await getTodo();
    emit("flow-finished", currentUuid);
  } catch (err) {
    ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
  }
}

watch(() => {
  return {
    visible: props.modelValue,
    uuid: props.nocodeFormProps.uuid
  }
}, async (newVal, oldVal) => {
  if (newVal.visible && newVal.uuid && (newVal.uuid !== oldVal?.uuid || !oldVal?.visible)) {
    todo.value = null
    if (oldVal?.visible && newVal.uuid !== oldVal?.uuid) {
      processInfoFolded.value = false;
    }
    await getTodo();
  }

  if (!newVal.visible) {
    processInfoFolded.value = false;
    todo.value = null;
    row.value = null
    todo.value = null
  }
}, {
  immediate: true,
})

watch(() => [props.modelValue, props.formMode, props.startInEdit, props.nocodeFormProps?.uuid], ([visible]) => {
  if (!visible) {
    return;
  }
  syncOpenState();
}, { immediate: true, flush: 'post' });

watch(() => props.processRefreshKey, async (value, oldValue) => {
  if (value === oldValue || !props.modelValue || !props.nocodeFormProps.uuid) {
    return;
  }
  todo.value = null;
  await getTodo();
})

watch(readonlyHiddenColumnIds, () => {
  syncReadonlyHiddenFields();
}, { deep: true });

watch(() => [props.modelValue, formRenderKey.value, isShowForm.value], () => {
  isFormReady.value = false;
}, { flush: 'sync' });

watch(() => [props.modelValue, isViewing.value, formRenderKey.value], async ([visible, viewing]) => {
  if (!visible || !viewing) {
    return;
  }
  await nextTick();
  syncReadonlyHiddenFields();
}, { flush: 'post' });

const formMode = computed(() => {
  return props.formMode;
})
onMounted(() => {
  getFilteredPrintTemplate()
})
provideFormMode(formMode);
</script>

<style lang='scss' scoped>
.data-form-dialog {
  pointer-events: all;

  :deep(.table-form-dialog) {
    // --el-bg-color: #fff;
    // --el-color-primary: var(--text-theme-color);
    // --el-color-primary-dark-2: var(--text-theme-color);
    // --el-color-primary-light-3: var(--text-theme-color);
    --close-button-size: 16px;
    --el-message-close-size: 24px;
    width: var(--width, 700px);
    height: var(--height, calc(100% - 100px));
    pointer-events: all;
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .el-dialog__header {
      padding: 0 16px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;

      .title {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        color: #444444;
        line-height: 40px;
      }

      .menus {
        flex-shrink: 0;
        height: 100%;
        display: flex;
        align-items: center;
      }

      // .el-dialog__headerbtn{
      //   font-size: var(--close-button-size);
      //   width: var(--close-button-size);
      //   height: var(--close-button-size);
      //   right: 12px;
      //   top: 12px;
      // }
    }

    .el-dialog__body {
      height: calc(100% - 40px);

      .iframe-wrap,
      iframe {
        width: 100%;
        height: 100%;
      }
    }

    .el-dialog__footer {
      text-align: left;
    }

    &.is-fullscreen {
      width: 100% !important;
      height: 100% !important;
      border-radius: 0;
    }
  }

}

.data-form-drawer {
  pointer-events: all;

  :deep(.table-form-drawer) {
    // --el-bg-color: #fff;
    // --el-color-primary: var(--text-theme-color);
    // --el-color-primary-dark-2: var(--text-theme-color);
    // --el-color-primary-light-3: var(--text-theme-color);
    --close-button-size: 16px;
    --el-message-close-size: 24px;
    // width: var(--width, 1000px);
    pointer-events: all;
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .el-drawer__header {
      padding: 0 16px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      margin: 0px;

      .title {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        color: #444444;
        line-height: 40px;
      }

      .menus {
        flex-shrink: 0;
        height: 100%;
        display: flex;
        align-items: center;
      }

      // .el-drawer__headerbtn{
      //   font-size: var(--close-button-size);
      //   width: var(--close-button-size);
      //   height: var(--close-button-size);
      //   right: 12px;
      //   top: 12px;
      // }
    }

    .el-drawer__body {
      padding: 0px;
      overflow: hidden;

      .iframe-wrap,
      iframe {
        width: 100%;
        height: 100%;
      }
    }

    .el-drawer__footer {
      text-align: left;
    }

    &.is-fullscreen {
      border-radius: 0;
    }
  }
}

.data-form-dialog,
.data-form-drawer {
  :deep(.icon-wrap.danger) {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    gap: 4px;
    color: #f9484e;
    border-radius: 4px;

    span {
      font-size: 14px;
      line-height: 20px;
    }
  }

  :deep(.icon-wrap.danger:hover) {
    cursor: var(--cursor-pointer);
    background-color: #f4f4f5;
  }

  .detail-action-group {
    :deep(.action-button),
    :deep(.more-button) {
      height: 24px;
      min-height: 24px;
      border-radius: 4px;
    }
  }

  .process-right {
    height: 100%;
  }

  :deep(.data-form-core) {
    .form-wrap {
      .nocode-form {
        height: unset;
        min-height: 100%;
        background-color: #fff;
        border-radius: 4px;
        overflow: hidden;

        :deep(.board) {
          .axis {
            position: unset;

            .board-container {
              position: unset;
            }
          }
        }
      }
    }
  }
}
</style>

<style lang="scss">
.workbench-scoped-form-overlay {
  position: absolute !important;
  inset: 0 !important;
  pointer-events: auto;

  .el-overlay-dialog {
    position: absolute;
    inset: 0;
  }

  .el-dialog,
  .el-drawer {
    max-width: 100%;
  }

  .table-form-drawer {
    --close-button-size: 16px;
    --el-message-close-size: 24px;
    pointer-events: all;
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .el-drawer__header {
      padding: 0 16px;
      height: 40px;
      margin: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;

      .title {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        color: #444444;
        line-height: 40px;
      }

      .menus {
        flex-shrink: 0;
        height: 100%;
        display: flex;
        align-items: center;
      }
    }

    &.is-fullscreen {
      border-radius: 0;
    }

    .el-drawer__body {
      padding: 0;
      overflow: hidden;

      .iframe-wrap,
      iframe {
        width: 100%;
        height: 100%;
      }
    }

    .el-drawer__footer {
      text-align: left;
    }
  }

  .icon-wrap.danger {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    gap: 4px;
    color: #f9484e;
    border-radius: 4px;

    span {
      font-size: 14px;
      line-height: 20px;
    }

    &:hover {
      cursor: var(--cursor-pointer);
      background-color: #f4f4f5;
    }
  }

  .detail-action-group {
    .action-button,
    .more-button {
      height: 24px;
      min-height: 24px;
      border-radius: 4px;
    }
  }

  .process-right {
    height: 100%;
  }

  .data-form-core .form-wrap .nocode-form {
    height: unset;
    min-height: 100%;
    background-color: #fff;
    border-radius: 4px;
    overflow: hidden;

    .board {
      .axis {
        position: unset;

        .board-container {
          position: unset;
        }
      }
    }
  }
}
</style>
