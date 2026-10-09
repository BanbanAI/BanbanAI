<template>
  <div class="row-share-data-form-page data-form-container" v-loading="loading">
    <div class="detail-shell" v-if="ready">
      <div class="detail-header">
        <div class="title">{{ title }}</div>
      </div>
      <div class="detail-body">
        <row-share-data-form-core
          :isViewing="isViewing"
          :row="currentFormRow"
          :loading="submitting"
          :formMode="formMode"
          :printTemplates="filteredPrintTemplate"
          :showProcessFlowToggle="showProcessFlowToggle"
          :processInfoFolded="processInfoFolded"
          :showDisplayFields="showDisplayFields"
          :showShare="showShare"
          :showPrint="showPrint"
          :showCopy="showCopy"
          :showDelete="showDelete"
          :showEdit="showEdit"
          :showRelatedTabs="showRelatedTabs"
          @updateHiddenColumns="updateHiddenColumnIds"
          @print="handlePrint"
          @copy="clickCopyButton"
          @share="rowShareDialogVisible = true"
          @delete="deleteTipDialogVisible = true"
          @edit="handleClickEditBtn"
          @submit="handleSubmit"
          @openProcessInfo="processInfoFolded = false"
          @submitDraft="handleSubmitDraft"
          @cancel="handleCancel"
        >
          <template #form>
            <nocode-form
              :key="formKey"
              :row="useReadFormData ? undefined : row"
              ref="editingFormRef"
              :nocodeId="nocodeId"
              :tableUID="[formData.uid, tableUID]"
              :uuid="rowUUID"
              :isViewing="isViewing"
              :memberFieldsAuth="memberFieldsAuth"
              :fieldsAuth="useReadFormData ? undefined : fieldsAuth"
              :bootstrapData="useReadFormData ? undefined : { formData }"
            ></nocode-form>
          </template>
          <template #right>
            <div class="right process-right" v-if="showProcessFlowToggle && !processInfoFolded">
              <el-button class="fold-button" text @click="processInfoFolded = true">
                <el-icon :size="16">
                  <i-workbench-horizontal-unfold />
                </el-icon>
              </el-button>
              <process-flows :todo="todo"></process-flows>
            </div>
          </template>
        </row-share-data-form-core>
      </div>
    </div>
    <public-share-footer
      v-if="publisher"
      class="share-footer"
      :publisher="publisher"
      :report-account="reportAccount"
    />

    <table-delete-data-dialog
      v-model="deleteTipDialogVisible"
      @deleteTableData="deleteCheckRowsData"
      :title="$t('RowShareDataFormPage.delete')"
      :dataText="$t('RowShareDataFormPage.currentRow')"
    />
    <system-print-dialog v-model="systemPrintDialogVisible" :title="$t('RowShareDataFormPage.systemPrint')" :rows="printRows" />
    <print-dialog v-model="printDialogVisible" :title="$t('RowShareDataFormPage.print')" v-bind="printingInfo" @closed="closePrintingDialog" />
    <office-print-preview
      v-model="visibleOfPreview"
      :uploadTemplateName="uploadTemplateName"
      :preViewPath="previewPath"
      :nocodeId="nocodeId"
      :tableId="tableUID"
      :recordId="templateRecord?.uid"
      :isTemporary="templateRecord?.isTemporary ?? false"
      @download="downloadPrintTemplate"
      @closed="closePreviewDialog"
    />
    <word-print-preview
      v-model="visibleOfWordPreview"
      :uploadTemplateName="uploadTemplateName"
      :preViewPath="previewPath"
      :nocodeId="nocodeId"
      :tableId="tableUID"
      :recordId="templateRecord?.uid"
      :isTemporary="templateRecord?.isTemporary ?? false"
      @download="downloadPrintTemplate"
      @closed="closePreviewDialog"
    />
    <row-share-link-dialog
      v-if="showShare && tableWidget?.table && currentFormRow"
      v-model="rowShareDialogVisible"
      :table="tableWidget.table"
      :row="currentFormRow"
      :nocodeId="nocodeId"
    />
    <process-initiate-dialog
      v-if="showCopy"
      v-model="showCopyDialog"
      :tableUID="tableWidget.formTableUID"
      :nocodeID="tableWidget.nocodeId"
      :tableName="title"
      :row="copyRow"
      :message="$t('RowShareDataFormPage.copySuccess')"
      @close="handleCopy"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, provide, reactive, ref, watch } from 'vue';
import axios from 'axios';
import { ElLoading, ElMessage } from 'element-plus';
import { getUUIDSystemField } from '@common/utils';
import { fetchPathAsArrayBuffer } from '@common/utils/print/shared';
import { FieldAuthValue, FormTableRuntime, NocodeBody, NocodeFormData, PrintedTemplateRecord, PrintTemplate, PrintTemplateMode, PrintTemplateType } from '@common/types/nocode';
import { Row, TableUID } from '@common/types/project';
import { doDownload, formFlowApi, useRuntime } from '@renderer/utils';
import { FormMode } from '@renderer/views/nocode/components/global/table/types';
import { provideFormMode, provideTable, provideTableProps } from '@renderer/views/nocode/components/global/table/hooks';
import { Table } from '@renderer/views/nocode/components/global/table/table';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { provideFormTable } from '../form/hooks';
import RowShareLinkDialog from '@renderer/views/nocode/components/global/table/components/RowShareLinkDialog.vue';
import ProcessInitiateDialog from '@renderer/views/nocode/views/editor/form/dialogs/ProcessInitiateDialog.vue';
import { projectApi } from '@renderer/utils/api/project';
import i18next from 'i18next';
import RowShareDataFormCore from './RowShareDataFormCore.vue';
import PublicShareFooter from './PublicShareFooter.vue';
import { sanitizeCopiedRowForCopy } from '@renderer/views/nocode/components/global/table/copy';
import { getDeleteResultMessage, hasDeleteFailures } from '@renderer/views/nocode/components/global/table/delete-result-message';

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  nocodeId: {
    type: String,
    required: true,
  },
  tableUID: {
    type: String as PropType<TableUID>,
    required: true,
  },
  rowUUID: {
    type: String,
    required: true,
  },
  rowData: {
    type: Object as PropType<Row>,
    required: true,
  },
  formData: {
    type: Object as PropType<NocodeFormData>,
    required: true,
  },
  nocodeBody: {
    type: Object as PropType<NocodeBody>,
    required: true,
  },
  organizeUtil: {
    type: Object as PropType<OrganizeUtil>,
    required: true,
  },
  publisher: {
    type: Object as PropType<{
      userId?: string,
      user?: string,
      realname?: string,
    }>,
    default: undefined,
  },
  reportAccount: {
    type: String,
    default: "",
  },
  loading: {
    type: Boolean,
    default: false,
  },
  isAddDataAble: {
    type: Boolean,
    default: false,
  },
  isEditDataAble: {
    type: Boolean,
    default: false,
  },
  isDeleteDataAble: {
    type: Boolean,
    default: false,
  },
  fieldsAuth: {
    type: Object as PropType<Record<string, FieldAuthValue>>,
    default: undefined,
  },
  memberFieldsAuth: {
    type: [Object, String] as PropType<Record<string, FieldAuthValue> | "all">,
    default: undefined,
  },
  showDisplayFields: {
    type: Boolean,
    default: true,
  },
  showShare: {
    type: Boolean,
    default: true,
  },
  showPrint: {
    type: Boolean,
    default: true,
  },
  showCopy: {
    type: Boolean,
    default: true,
  },
  showDelete: {
    type: Boolean,
    default: true,
  },
  showEdit: {
    type: Boolean,
    default: true,
  },
  showRelatedTabs: {
    type: Boolean,
    default: true,
  },
  enableProcessFlow: {
    type: Boolean,
    default: false,
  },
  loadPrintTemplates: {
    type: Boolean,
    default: true,
  },
  submitHandler: {
    type: Function as PropType<(rowPatch: Row, formRef: any) => Promise<any>>,
    default: undefined,
  },
  beforeDelete: {
    type: Function as PropType<() => Promise<void>>,
    default: undefined,
  },
  useReadFormData: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (event: 'submitted', payload?: any): void,
  (event: 'deleted'): void,
}>();

const runtime = useRuntime();
const formMode = computed(() => FormMode.Edit);
const tableProps = reactive({
  nocodeId: props.nocodeId,
  tableUID: props.tableUID,
  isAddDataAble: props.isAddDataAble,
  isImportDataAble: false,
  isExportDataAble: false,
  isDeleteDataAble: props.isDeleteDataAble,
  isShowMoreMenu: false,
  isEditDataAble: props.isEditDataAble,
  searchable: false,
  filterable: false,
  isChangeFilterDisplayMode: false,
  isTableCellEditable: false,
  sortable: false,
  hideColumnsAble: true,
  changeRowHeightAble: false,
  isShowHeader: false,
  isShowTableHeaderMenu: false,
  updateColumnDataAble: false,
  isShowCheck: false,
  isMultiple: false,
  clickRowShowDetail: false,
  clickRowChecked: false,
  isShowFooter: false,
  isShowAggregateRow: false,
  isShowPagination: false,
  isAlbum: false,
  uid: `row-share-${props.nocodeId}-${props.tableUID}`,
});
const tableWidget = new Table(tableProps as any);

const row = ref<Row>({ ...(props.rowData || {}) });
const formKey = ref(0);
const ready = ref(false);
const submitting = ref(false);
const editingFormRef = ref();
const isViewing = ref(true);
const processInfoFolded = ref(false);
const deleteTipDialogVisible = ref(false);
const rowShareDialogVisible = ref(false);
const showCopyDialog = ref(false);
const copyRow = ref({});
const todo = ref(null);

const systemPrintDialogVisible = ref(false);
const printRows = ref<Row[]>([]);
const printTemplateType = ref<PrintTemplateType>();
const templateRecord = ref<PrintedTemplateRecord>();
const uploadTemplateName = ref('');
const previewPathStr = ref<string | null>(null);
const visibleOfPreview = ref(false);
const visibleOfWordPreview = ref(false);
const previewArrayBuffer = ref<ArrayBuffer | Blob | null>(null);
const printDialogVisible = ref(false);
const filteredPrintTemplate = ref<PrintTemplate[]>([]);
const printingInfo = reactive({
  loading: false,
  status: "success",
});

provideTable(tableWidget);
provideTableProps(tableProps as any);
provideFormMode(formMode);
provide(NOCODE_ID, props.nocodeId);
provide(ORGANIZE_UTIL, props.organizeUtil);
provideFormTable(computed(() => {
  return props.formData?.tables?.find(item => item.uid === props.tableUID);
}));

const currentFormRow = computed(() => {
  return editingFormRef.value?.getFormRow?.() || row.value;
});

const previewPath = computed(() => {
  if (previewArrayBuffer.value) {
    return previewArrayBuffer.value;
  }
  return previewPathStr.value || '';
});

const showProcessFlowToggle = computed(() => {
  return props.enableProcessFlow && !!todo.value;
});

const initTable = async () => {
  tableWidget.init({
    runtime,
    nocodeBody: props.nocodeBody,
    organizeUtil: props.organizeUtil,
    meta: {},
  });
  tableWidget.setSelectedRow(row.value);
  ready.value = true;
};

const loadTodo = async () => {
  if (!props.enableProcessFlow || runtime === FormTableRuntime.FORM_EDITOR) {
    todo.value = null;
    return;
  }
  todo.value = await formFlowApi.getTodo({
    nocodeId: props.nocodeId,
    tableUID: props.tableUID,
    uuid: props.rowUUID,
  }).catch(() => null);
};

const getTemplateRender = async (option: { printTemplateUID: string, rowUids: string[] }) => {
  return await projectApi.getTemplateRender({
    nocodeId: props.nocodeId,
    tableId: props.tableUID,
    printTemplateUID: option.printTemplateUID,
    selectRowUids: option.rowUids,
  });
};

const getFirstFileAsArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip(arrayBuffer);
  const fileNames = Object.keys(zip.files)
    .filter(name => !zip.files[name].dir)
    .sort();

  if (fileNames.length === 0) {
    throw new Error(i18next.t('RowShareDataFormPage.zipNoFolder'));
  }

  const firstFileName = fileNames[0];
  const zipEntry = zip.file(firstFileName);
  const uint8Array = zipEntry.asUint8Array();

  return {
    fileName: firstFileName,
    arrayBuffer: uint8Array.buffer,
  };
};

const handlePrint = async (template?: PrintTemplate) => {
  if (!template) {
    systemPrintDialogVisible.value = true;
    printRows.value = [currentFormRow.value];
    return;
  }
  await handlePrintTemplate(template);
};

const downloadPrintTemplate = async (downloadSrc) => {
  if (typeof downloadSrc === 'string') {
    doDownload({
      url: downloadSrc,
      name: uploadTemplateName.value,
    });
  } else if (downloadSrc instanceof Blob || downloadSrc instanceof ArrayBuffer) {
    const blob = new Blob([downloadSrc], {
      type: printTemplateType.value === PrintTemplateType.EXCEL
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    doDownload({
      url,
      name: uploadTemplateName.value,
    });
  } else {
    const url = URL.createObjectURL(downloadSrc);
    doDownload({
      url,
      name: uploadTemplateName.value,
    });
  }
};

const closePreviewDialog = () => {
  previewArrayBuffer.value = null;
  previewPathStr.value = null;
  uploadTemplateName.value = '';
};

const handlePrintTemplate = async (template: PrintTemplate) => {
  printingInfo.loading = true;
  printDialogVisible.value = true;
  const uuidField = getUUIDSystemField(tableWidget.getTable(tableWidget.formTableUID)?.fields || []);
  const rowData = currentFormRow.value || {};
  const selectRowUIDs = uuidField ? [rowData[uuidField.uid]] : [];
  const res = await getTemplateRender({
    printTemplateUID: template.uid,
    rowUids: selectRowUIDs,
  });
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
      const arrayBuffer = await fetchPathAsArrayBuffer(previewPathStr.value);
      const previewFile = await getFirstFileAsArrayBuffer(arrayBuffer);
      previewArrayBuffer.value = previewFile.arrayBuffer as ArrayBuffer;
      uploadTemplateName.value = previewFile.fileName;
    }
    visibleOfPreview.value = true;
  } else {
    visibleOfWordPreview.value = true;
  }
};

const closePrintingDialog = () => {
  printingInfo.loading = false;
  printingInfo.status = "success";
};

const getFilteredPrintTemplate = async () => {
  if (!props.loadPrintTemplates) {
    filteredPrintTemplate.value = [];
    return;
  }
  const res = await axios.get('project/get-filtered-print-template', {
    params: {
      nocodeId: props.nocodeId,
      tableId: props.tableUID,
    }
  }).catch(err => {
    ElMessage.error(err.message);
    return null;
  });
  if (res) {
    filteredPrintTemplate.value = res.data.filter(item => item.enabled);
  }
};

const handleCancel = () => {
  isViewing.value = true;
  row.value = { ...(props.rowData || {}) };
  formKey.value += 1;
};

const handleClickEditBtn = () => {
  isViewing.value = false;
};

const updateHiddenColumnIds = (value: string[]) => {
  editingFormRef.value?.setHiddenFields(value);
};

const clickCopyButton = () => {
  const currentRow = editingFormRef.value?.getFormRow?.() ?? {};
  const currentTable = tableWidget?.getTable(tableWidget.formTableUID);
  if (!currentTable) return;
  copyRow.value = sanitizeCopiedRowForCopy({
    row: currentRow,
    table: currentTable,
    formData: props.formData,
  });
  showCopyDialog.value = true;
};

const handleCopy = () => {
  showCopyDialog.value = false;
};

const handleSubmitDraft = async () => {};

const handleSubmit = async () => {
  if (!editingFormRef.value) return;
  try {
    let result: any;
    if (props.submitHandler) {
      const rowPatch = await editingFormRef.value.prepareSubmitRow();
      if (!rowPatch) return;
      const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.();
      if (!confirmed) {
        editingFormRef.value?.clearSubmitValidationNotice?.();
        return;
      }
      submitting.value = true;
      result = await props.submitHandler(rowPatch, editingFormRef.value);
      if (!result) {
        editingFormRef.value?.clearSubmitValidationNotice?.();
        return;
      }
      editingFormRef.value?.notifySubmitValidationMessages?.();
      editingFormRef.value?.clearSubmitValidationNotice?.();
    } else {
      const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.();
      if (!confirmed) {
        editingFormRef.value?.clearSubmitValidationNotice?.();
        return;
      }
      submitting.value = true;
      const loadingInstance = ElLoading.service({
        target: ".detail-body",
        text: i18next.t('RowShareDataFormPage.submiting'),
        background: "rgba(0, 0, 0, 0.2)"
      });
      result = await editingFormRef.value.submit({ skipSubmitValidationNoticeConfirm: true, skipSubmitSignSyncConfirm: true });
      loadingInstance.close();
      if (!result) return;
      ElMessage.success(i18next.t('RowShareDataFormPage.editSuccess'));
    }
    row.value = { ...(currentFormRow.value || {}) };
    tableWidget.setSelectedRow(row.value);
    isViewing.value = true;
    emit('submitted', result);
  } catch (error: any) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    ElMessage.error(error?.response?.data?.message || error?.message || i18next.t('RowShareDataFormPage.submitFailed'));
  } finally {
    submitting.value = false;
  }
};

const deleteCheckRowsData = async () => {
  try {
    if (props.beforeDelete) {
      await props.beforeDelete();
    }
    tableWidget.setSelectedRow(currentFormRow.value);
    const result = await tableWidget.removeRows([currentFormRow.value], runtime);
    const message = getDeleteResultMessage(result, i18next.t('RowShareDataFormPage.delSuccess'));
    if (hasDeleteFailures(result)) {
      ElMessage.warning(message);
      return;
    }
    ElMessage.success(message);
    emit('deleted');
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message);
  }
};

watch(() => props.rowData, (value) => {
  row.value = { ...(value || {}) };
  tableWidget.setSelectedRow(row.value);
  formKey.value += 1;
}, { deep: true });

watch(() => props.rowUUID, () => {
  processInfoFolded.value = false;
  loadTodo();
}, { immediate: true });

initTable();
getFilteredPrintTemplate();
</script>

<style scoped lang="scss">
.row-share-data-form-page {
  height: 100%;
  min-height: 100%;
  padding: 32px 24px;
  background: linear-gradient(180deg, #f5f7fb 0%, #eef2f8 100%);

  .detail-shell {
    width: min(1200px, 100%);
    height: min(880px, calc(100vh - 64px));
    margin: 0 auto;
    background-color: var(--bg-color-page);
    border-radius: 4px;
    box-shadow: 0 8px 32px rgba(31, 35, 41, 0.08);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .detail-header {
    height: 40px;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    background-color: var(--bg-color-page);

    .title {
      font-size: 14px;
      line-height: 20px;
      color: #444444;
    }
  }

  .detail-body {
    flex: 1;
    min-height: 0;
  }

  .share-footer {
    width: min(1200px, 100%);
  }

  .process-right {
    position: relative;

    .fold-button {
      position: absolute;
      top: 4px;
      right: 8px;
      z-index: 1;
      padding: 0;
      width: 32px;
      border-radius: 4px;
    }

    :deep(.process-flows .title) {
      padding-right: 40px;
    }
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
