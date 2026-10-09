<template>
  <div class="base-data-form-dialog data-form-container" v-if="!isDrawer">
    <el-dialog
      :title="title"
      :modelValue="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      @open="handleOpen"
      @closed="handleClear"
      :close-on-click-modal="false"
      :destroy-on-close="true"
      draggable
      align-center
      class="table-form-dialog"
      :show-close="false"
      :fullscreen="isFullscreen"
    >
      <template #header>
        <div class="title" :title="title">{{ title }}</div>
        <div class="menus">
          <el-button link :title="$t('BaseDataFormDialog.switchToDrawer')" @click="changeDisplayMode(true)">
            <el-icon :size="16"><i-ven-icon-partial-full-screen /></el-icon>
          </el-button>
          <el-button
            link
            :title="isFullscreen ? $t('BaseDataFormDialog.exitFullscreen') : $t('BaseDataFormDialog.fullscreen')"
            @click="isFullscreen = !isFullscreen"
          >
            <el-icon :size="16">
              <i-ven-icon-shrink-screen v-if="isFullscreen" />
              <i-ven-icon-full-screen v-else />
            </el-icon>
          </el-button>
          <el-button link @click="handleClose">
            <el-icon :size="16"><i-ep-close/></el-icon>
          </el-button>
        </div>
      </template>
      <template #default>
        <div class="content">
          <div class="left">
            <div class="form-container">
              <div class="header" v-if="isViewing">
                <form-display-fields v-if="resolvedShowDisplayFields" @update:hiddenColumnIds="updateHiddenColumnIds"></form-display-fields>
                <div class="icon-wrap" v-if="rowShareVisible" @click="rowShareDialogVisible = true">
                  <el-icon size="16"><i-ven-share /></el-icon>
                </div>
                <div class="division" v-if="showToolbarDivision"></div>
                <el-popover placement="bottom" :teleported="false" append-to=".data-form-container">
                  <template #reference>
                    <div class="icon-wrap">
                      <el-icon size="16">
                        <i-ep-printer />
                      </el-icon><span>{{ $t('DataFormCore.print') }}</span>
                    </div>
                  </template>
                  <ul class="print-menu">
                    <li @click="handlePrint()">{{ $t('DataFormCore.systemPrint') }}</li>
                    <li v-for="item in filteredPrintTemplate" :key="item.uid" @click="handlePrint(item)">{{ item.name }}</li>
                  </ul>
                </el-popover>
                <div
                  class="icon-wrap"
                  @click="() => deleteTipDialogVisible = true"
                  v-if="canDeleteCurrentRow"
                >
                  <el-icon size="16"><i-ep-delete /></el-icon><span>{{ $t('BaseDataFormDialog.delete') }}</span>
                </div>
                <div
                  class="icon-wrap"
                  :class="{ 'active': !isViewing }"
                  @click="handleClickEditBtn"
                  v-if="canEditCurrentRow"
                >
                  <el-icon size="16"><i-ep-edit /></el-icon><span>{{ $t('BaseDataFormDialog.edit') }}</span>
                </div>
              </div>
              <div class="form-wrap viewing">
                <nocode-form
                  :key="formRenderKey"
                  ref="editingFormRef"
                  v-bind="resolvedNocodeFormProps"
                  :row="mergedRow"
                  :isViewing="isViewing"
                  v-if="props.modelValue"
                  @ready="handleFormReady"
                ></nocode-form>
              </div>
              <div class="footer" v-if="!isViewing">
                <el-button type="primary" @click="handleSubmit">{{ $t('BaseDataFormDialog.submit') }}</el-button>
                <el-button v-if="formMode === FormMode.Edit" @click="handleCancel">{{ $t('BaseDataFormDialog.cancel') }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
  <div class="data-form-drawer data-form-container" v-else>
    <el-drawer
      :title="title"
      :modelValue="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      @open="handleOpen"
      @closed="handleClear"
      close-on-click-modal
      :before-close="handleDrawerBeforeClose"
      :destroy-on-close="true"
      draggable
      align-center
      class="table-form-drawer"
      :class="{ 'is-fullscreen': isFullscreen }"
      :show-close="false"
      :size="isFullscreen ? '100%' : '70%'"
    >
      <template #header>
        <div class="title" :title="title">{{ title }}</div>
        <div class="menus">
          <el-button link :title="$t('BaseDataFormDialog.switchToDialog')" @click="changeDisplayMode(false)">
            <el-icon :size="16"><i-ven-icon-partial-shrink-screen /></el-icon>
          </el-button>
          <el-button
            link
            :title="isFullscreen ? $t('BaseDataFormDialog.exitFullscreen') : $t('BaseDataFormDialog.fullscreen')"
            @click="isFullscreen = !isFullscreen"
          >
            <el-icon :size="16">
              <i-ven-icon-shrink-screen v-if="isFullscreen" />
              <i-ven-icon-full-screen v-else />
            </el-icon>
          </el-button>
          <el-button link @click="handleClose"><el-icon :size="16"><i-ep-close /></el-icon></el-button>
        </div>
      </template>
      <template #default>
        <div class="content">
          <div class="left">
            <div class="form-container">
              <div class="header" v-if="isViewing">
                <form-display-fields v-if="resolvedShowDisplayFields" @update:hiddenColumnIds="updateHiddenColumnIds"></form-display-fields>
                <div class="icon-wrap" v-if="rowShareVisible" @click="rowShareDialogVisible = true">
                  <el-icon size="16"><i-ven-share /></el-icon>
                </div>
                <div class="division" v-if="showToolbarDivision"></div>
                <el-popover placement="bottom" :teleported="false" append-to=".data-form-container">
                  <template #reference>
                    <div class="icon-wrap">
                      <el-icon size="16">
                        <i-ep-printer />
                      </el-icon><span>{{ $t('DataFormCore.print') }}</span>
                    </div>
                  </template>
                  <ul class="print-menu">
                    <li @click="handlePrint()">{{ $t('DataFormCore.systemPrint') }}</li>
                    <li v-for="item in filteredPrintTemplate" :key="item.uid" @click="handlePrint(item)">{{ item.name }}</li>
                  </ul>
                </el-popover>
                <div
                  class="icon-wrap"
                  @click="() => deleteTipDialogVisible = true"
                  v-if="canDeleteCurrentRow"
                >
                  <el-icon size="16"><i-ep-delete /></el-icon><span>{{ $t('BaseDataFormDialog.delete') }}</span>
                </div>
                <div
                  class="icon-wrap"
                  :class="{ 'active': !isViewing }"
                  @click="handleClickEditBtn"
                  v-if="canEditCurrentRow"
                >
                  <el-icon size="16"><i-ep-edit /></el-icon><span>{{ $t('BaseDataFormDialog.edit') }}</span>
                </div>
              </div>
              <div class="form-wrap viewing">
                <nocode-form
                  :key="formRenderKey"
                  ref="editingFormRef"
                  v-bind="resolvedNocodeFormProps"
                  :row="mergedRow"
                  :isViewing="isViewing"
                  v-if="props.modelValue"
                  @ready="handleFormReady"
                ></nocode-form>
              </div>
              <div class="footer" v-if="!isViewing">
                <el-button type="primary" @click="handleSubmit">{{ $t('BaseDataFormDialog.submit') }}</el-button>
                <el-button v-if="formMode === FormMode.Edit" @click="handleCancel">{{ $t('BaseDataFormDialog.cancel') }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>

  <table-delete-data-dialog
    v-model="deleteTipDialogVisible"
    @deleteTableData="deleteCheckRowsData"
    :title="$t('BaseDataFormDialog.delete')"
    :dataText="$t('DataFormDialog.currentRow')"
  />
  <form-save-tip-dialog ref="saveTipDialogRef" :title="$t('BaseDataFormDialog.isSave')" />
  <tip-dialog ref="drawerExitTipDialogRef" :title="$t('BaseDataFormDialog.tip')" :content="$t('BaseDataFormDialog.isExit')" :closeOnClickModal="true" />
  <system-print-dialog v-model="systemPrintDialogVisible" :title="$t('DataFormDialog.systemPrint')" :rows="printRows" />
  <print-dialog v-model="printDialogVisible" :title="$t('DataFormDialog.print')" v-bind="printingInfo" @closed="closePrintingDialog" />
  <office-print-preview
    v-model="visibleOfPreview"
    :uploadTemplateName="uploadTemplateName"
    :preViewPath="previewPath"
    :nocodeId="dialogNocodeId"
    :tableId="currentTableUID"
    :recordId="templateRecord?.uid"
    :isTemporary="templateRecord?.isTemporary ?? false"
    @download="downloadPrintTemplate"
    @closed="closePreviewDialog"
  />
  <word-print-preview
    v-model="visibleOfWordPreview"
    :uploadTemplateName="uploadTemplateName"
    :preViewPath="previewPath"
    :nocodeId="dialogNocodeId"
    :tableId="currentTableUID"
    :recordId="templateRecord?.uid"
    :isTemporary="templateRecord?.isTemporary ?? false"
    @download="downloadPrintTemplate"
    @closed="closePreviewDialog"
  />
  <row-share-link-dialog
    v-if="currentDialogTable && currentActionRow"
    v-model="rowShareDialogVisible"
    :table="currentDialogTable"
    :row="currentActionRow"
    :nocodeId="dialogNocodeId"
  />
</template>

<script lang="ts" setup>
import axios from "axios";
import { ElLoading, ElMessage } from "element-plus";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getUUIDSystemField } from "@common/utils";
import { fetchPathAsArrayBuffer } from "@common/utils/print/shared";
import { NocodeBody, NocodeFormData, PrintedTemplateRecord, PrintTemplate, PrintTemplateMode, PrintTemplateType } from "@common/types/nocode";
import { Row, Table as ProjectTable } from "@common/types/project";
import { provideFormMode, useTable, useTableProps } from "../hooks";
import { FormMode } from "../types";
import { doDownload, formDataApi, useRuntime } from "@renderer/utils";
import { projectApi } from "@renderer/utils/api/project";
import i18next from "i18next";
import RowShareLinkDialog from "./RowShareLinkDialog.vue";
import { getDeleteResultMessage, hasDeleteFailures } from "../delete-result-message";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  nocodeFormProps: any;
  formMode: FormMode;
  contentRefreshKey?: number;
  showDisplayFields?: boolean;
  isEditDataAble?: boolean;
  isDeleteDataAble?: boolean;
  isRelatedDetailDialog?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "submitted", value: FormMode): void;
  (event: "copy", copyRow: Row): void;
  (event: "deleted"): void;
}>();

const saveTipDialogRef = ref();
const drawerExitTipDialogRef = ref();
const isDrawer = ref(true);
const isFullscreen = ref(false);
const table = useTable();
const editingFormRef = ref();
const isViewing = ref(true);
const deleteTipDialogVisible = ref(false);
const tableProps = useTableProps() || {} as any;
const runtime = useRuntime();
const route = useRoute();
const row = ref<Row | null>(null);
const runtimeFormData = ref<NocodeFormData | undefined>(undefined);
const runtimeOtherDataSources = ref<NocodeBody["otherDataSources"]>([]);
const runtimeTable = ref<ProjectTable | undefined>(undefined);
const rowShareDialogVisible = ref(false);
const systemPrintDialogVisible = ref(false);
const printRows = ref<Row[]>([]);
const templateRecord = ref<PrintedTemplateRecord>();
const uploadTemplateName = ref("");
const previewPathStr = ref<string | null>(null);
const visibleOfPreview = ref(false);
const visibleOfWordPreview = ref(false);
const previewArrayBuffer = ref<ArrayBuffer | Blob | null>(null);
const printDialogVisible = ref(false);
const filteredPrintTemplate = ref<PrintTemplate[]>([]);
const printTemplateType = ref<PrintTemplateType>();
const printingInfo = ref({
  loading: false,
  status: "success",
});

const resolvedShowDisplayFields = computed(() => props.showDisplayFields ?? true);
const resolvedEditDataAble = computed(() => props.isEditDataAble ?? tableProps.isEditDataAble);
const isRelatedDetailDialog = computed(() => props.isRelatedDetailDialog === true);
const isRelatedDetailReady = computed(() => {
  return !isRelatedDetailDialog.value || (!!currentResolvedFormData.value && !!currentDialogTable.value);
});
const resolvedDeleteDataAble = computed(() => {
  const canDelete = props.isDeleteDataAble ?? tableProps.isDeleteDataAble;
  return canDelete && isRelatedDetailReady.value;
});
const resolvedNocodeFormProps = computed(() => {
  const relatedDetailHandler = props.nocodeFormProps?.relatedDetailHandler;
  if (!relatedDetailHandler) {
    return props.nocodeFormProps;
  }
  return {
    ...props.nocodeFormProps,
    relatedDetailHandler: (payload: any) => {
      relatedDetailHandler({
        ...payload,
        sourceContext: payload?.sourceContext || {
          nocodeId: dialogNocodeId.value,
          tableUID: props.nocodeFormProps?.tableUID,
          formData: currentResolvedFormData.value,
          otherDataSources: currentResolvedOtherDataSources.value,
        },
      });
    },
  };
});
const showToolbarDivision = computed(() => {
  return resolvedShowDisplayFields.value
    && (rowShareVisible.value || canEditCurrentRow.value || canDeleteCurrentRow.value);
});
const dialogNocodeId = computed(() => props.nocodeFormProps?.nocodeId || table?.nocodeId || tableProps.nocodeId);
const currentTableUID = computed(() => {
  return props.nocodeFormProps?.tableUID?.[1] || table?.formTableUID || tableProps.tableUID || "";
});
const currentBootstrapFormData = computed<NocodeFormData | undefined>(() => props.nocodeFormProps?.bootstrapData?.formData);
const currentBootstrapOtherDataSources = computed<NocodeBody["otherDataSources"]>(() => props.nocodeFormProps?.bootstrapData?.otherDataSources || []);
const currentResolvedFormData = computed(() => currentBootstrapFormData.value || runtimeFormData.value);
const currentResolvedOtherDataSources = computed(() => {
  return currentBootstrapOtherDataSources.value.length
    ? currentBootstrapOtherDataSources.value
    : runtimeOtherDataSources.value;
});
const mergedRow = computed(() => row.value || props.nocodeFormProps?.row);
const currentActionRow = computed<Row | null>(() => {
  return editingFormRef.value?.getFormRow?.() || mergedRow.value || null;
});
const detailPermissionRow = computed<Row | null>(() => {
  return currentActionRow.value || table?.selectedRow || null;
});
const currentDialogTable = computed<ProjectTable | undefined>(() => {
  if (runtimeTable.value?.uid === currentTableUID.value) {
    return runtimeTable.value;
  }
  const formDataTables = currentResolvedFormData.value?.tables || [];
  const otherTables = currentResolvedOtherDataSources.value.flatMap((source) => source.tables || []);
  return [...formDataTables, ...otherTables].find((item) => item.uid === currentTableUID.value);
});
const shouldUseTableRowPermission = computed(() => {
  return !isRelatedDetailDialog.value
    && currentTableUID.value === (table?.formTableUID || tableProps.tableUID || "");
});
const canEditCurrentRow = computed(() => {
  const canEdit = resolvedEditDataAble.value;
  if (!canEdit) {
    return false;
  }
  if (!shouldUseTableRowPermission.value) {
    return true;
  }
  return table?.canEditRow?.(detailPermissionRow.value) ?? true;
});
const canDeleteCurrentRow = computed(() => {
  if (!resolvedDeleteDataAble.value) {
    return false;
  }
  if (!shouldUseTableRowPermission.value) {
    return true;
  }
  return table?.canDeleteRow?.(detailPermissionRow.value) ?? true;
});
const currentUuidField = computed(() => getUUIDSystemField(currentDialogTable.value?.fields || []));
const rowShareVisible = computed(() => {
  return !!(
    isViewing.value
    && currentDialogTable.value?.publish?.rowShareEnabled
    && currentUuidField.value?.uid
    && currentActionRow.value?.[currentUuidField.value.uid]
  );
});
const previewPath = computed(() => {
  return previewArrayBuffer.value || previewPathStr.value || "";
});
const formRenderKey = computed(() => {
  return `${dialogNocodeId.value || "nocode"}-${currentTableUID.value || "table"}-${props.nocodeFormProps?.uuid || "new"}-${props.contentRefreshKey || 0}-${isViewing.value ? "view" : "edit"}`;
});
const formMode = computed(() => props.formMode);

const isPublicVisit = computed(() => {
  return route.matched?.some((record) => (
    record.meta?.isPublicShare === true
    || record.meta?.isPublicRowShare === true
  )) || route.meta?.isPublicShare === true || route.meta?.isPublicRowShare === true || route.name === "PublicQuery";
});

const isFormModified = () => {
  if (isViewing.value) return false;
  return !!editingFormRef.value?.isModified?.();
};

const changeDisplayMode = (visible: boolean) => {
  isViewing.value = true;
  if (editingFormRef.value) {
    row.value = editingFormRef.value.getFormRow();
  }
  isDrawer.value = visible;
};

const resetPreviewState = () => {
  templateRecord.value = undefined;
  uploadTemplateName.value = "";
  previewPathStr.value = null;
  previewArrayBuffer.value = null;
  visibleOfPreview.value = false;
  visibleOfWordPreview.value = false;
  printDialogVisible.value = false;
  systemPrintDialogVisible.value = false;
  printRows.value = [];
  filteredPrintTemplate.value = [];
  printingInfo.value = {
    loading: false,
    status: "success",
  };
};

const handleFormReady = (payload: {
  table?: ProjectTable;
  formData?: NocodeFormData;
  otherDataSources?: NocodeBody["otherDataSources"];
}) => {
  runtimeTable.value = payload.table;
  runtimeFormData.value = payload.formData;
  runtimeOtherDataSources.value = payload.otherDataSources || [];
  void getFilteredPrintTemplate();
};

const handleSubmit = async () => {
  if (!editingFormRef.value) return;
  const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.();
  if (!confirmed) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  const loadingInstance = ElLoading.service({
    target: ".iframe-wrap",
    text: i18next.t("BaseDataFormDialog.submiting"),
    background: "rgba(0, 0, 0, 0.2)",
  });
  try {
    const result = await editingFormRef.value.submit({
      skipSubmitValidationNoticeConfirm: true,
      skipSubmitSignSyncConfirm: true,
    });
    if (result) {
      ElMessage.success(i18next.t(props.formMode === FormMode.Add ? "BaseDataFormDialog.addSuccess" : "BaseDataFormDialog.editSuccess"));
      emit("submitted", props.formMode);
    }
    return result;
  } finally {
    loadingInstance.close();
  }
};

const handleCancel = () => {
  isViewing.value = true;
};

const handleClose = async () => {
  if (props.formMode === FormMode.Edit && isFormModified()) {
    const isSave = await saveTipDialogRef.value?.confirm();
    if (isSave) {
      await handleSubmit();
    }
  }
  emit("update:modelValue", false);
};

const handleClickEditBtn = () => {
  if (!canEditCurrentRow.value) {
    return;
  }
  isViewing.value = false;
};

const resolveDeletePromise = () => {
  const targetRow = currentActionRow.value || props.nocodeFormProps?.row || table?.selectedRow;
  const targetTableUID = currentTableUID.value;
  const targetNocodeSign = editingFormRef.value?.getTargetNocodeSign?.();
  const dialogFormData = currentResolvedFormData.value;
  const targetTable = currentDialogTable.value;
  if (!targetRow || !targetTableUID) {
    return null;
  }
  if (!dialogFormData || !targetTable) {
    return null;
  }
  const uuidField = getUUIDSystemField(targetTable.fields || []);
  return formDataApi.deleteData({
    formData: dialogFormData,
    nocodeId: dialogNocodeId.value,
    tableUID: targetTableUID,
    rows: [targetRow],
    keys: uuidField?.uid ? [[dialogFormData.uid, targetTableUID, uuidField.uid]] : undefined,
    runtime,
    sign: targetNocodeSign || props.nocodeFormProps?.nocodeSign,
  });
};

const deleteCheckRowsData = async () => {
  if (!canDeleteCurrentRow.value) {
    ElMessage.warning(i18next.t("InnerRowShareViewer.noPermission"));
    return;
  }
  const deletePromise = resolveDeletePromise();
  if (!deletePromise) {
    return;
  }
  await deletePromise.then((result) => {
    const message = getDeleteResultMessage(result, i18next.t("BaseDataFormDialog.delSuccess"));
    if (hasDeleteFailures(result)) {
      ElMessage.warning(message);
      return;
    }
    ElMessage.success(message);
    emit("deleted");
  }).catch((err) => {
    ElMessage.error(err.message);
  });
  emit("update:modelValue", false);
};

const updateHiddenColumnIds = (value: string[]) => {
  editingFormRef.value?.setHiddenFields(value);
};

const handleDrawerBeforeClose = async (done: () => void) => {
  const isModified = isFormModified();
  if (isModified && isDrawer.value && !isViewing.value && [FormMode.Edit, FormMode.Add].includes(props.formMode)) {
    const isExit = await drawerExitTipDialogRef.value?.confirm();
    if (!isExit) {
      return;
    }
  }
  done();
};

const handleClear = () => {
  if (props.formMode === FormMode.Edit) {
    isViewing.value = true;
  }
  isFullscreen.value = false;
};

const handleOpen = () => {
  isViewing.value = props.formMode === FormMode.Edit;
};

const getFilteredPrintTemplate = async () => {
  if (!props.modelValue || !dialogNocodeId.value || !currentTableUID.value || isPublicVisit.value) {
    filteredPrintTemplate.value = [];
    return;
  }
  const data = await axios.get("project/get-filtered-print-template", {
    params: {
      nocodeId: dialogNocodeId.value,
      tableId: currentTableUID.value,
    },
  }).then((res) => res.data).catch((err) => {
    ElMessage.error(err.message);
    return null;
  });
  if (data) {
    filteredPrintTemplate.value = data.filter((item: PrintTemplate) => item.enabled);
  }
};

const handlePrint = async (template?: PrintTemplate) => {
  const currentRow = currentActionRow.value;
  if (!currentDialogTable.value || !currentRow) {
    return;
  }
  if (!template) {
    systemPrintDialogVisible.value = true;
    printRows.value = [currentRow];
    return;
  }
  await handlePrintTemplate(template, currentRow);
};

const downloadPrintTemplate = async (downloadSrc: string | Blob | ArrayBuffer | File) => {
  if (typeof downloadSrc === "string") {
    doDownload({
      url: downloadSrc,
      name: uploadTemplateName.value,
    });
    return;
  }
  const blob = downloadSrc instanceof Blob
    ? downloadSrc
    : new Blob([downloadSrc], {
      type: printTemplateType.value === PrintTemplateType.EXCEL
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  const url = URL.createObjectURL(blob);
  doDownload({
    url,
    name: uploadTemplateName.value,
  });
};

const closePreviewDialog = () => {
  templateRecord.value = undefined;
  previewArrayBuffer.value = null;
  previewPathStr.value = null;
  uploadTemplateName.value = "";
};

const getTemplateRender = async (option: { printTemplateUID: string; rowUids: string[] }) => {
  return await projectApi.getTemplateRender({
    nocodeId: dialogNocodeId.value,
    tableId: currentTableUID.value,
    printTemplateUID: option.printTemplateUID,
    selectRowUids: option.rowUids,
  });
};

const getFirstFileAsArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  const { default: PizZip } = await import("pizzip");
  const zip = new PizZip(arrayBuffer);
  const fileNames = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .sort();
  if (!fileNames.length) {
    throw new Error(i18next.t("DataFormDialog.zipNoFolder"));
  }
  const firstFileName = fileNames[0];
  const zipEntry = zip.file(firstFileName);
  const uint8Array = zipEntry.asUint8Array();
  return {
    fileName: firstFileName,
    arrayBuffer: uint8Array.buffer,
    uint8Array,
  };
};

const handlePrintTemplate = async (template: PrintTemplate, currentRow: Row) => {
  const uuidField = currentUuidField.value;
  if (!uuidField?.uid) {
    return;
  }
  printingInfo.value = {
    loading: true,
    status: "success",
  };
  printDialogVisible.value = true;
  printTemplateType.value = template.type;
  const res = await getTemplateRender({
    printTemplateUID: template.uid,
    rowUids: [currentRow[uuidField.uid]],
  });
  printingInfo.value = {
    loading: false,
    status: res?.url ? "success" : "fail",
  };
  if (!res?.url) {
    return;
  }
  templateRecord.value = res.record;
  previewPathStr.value = `${window.location.origin}${res.url}`;
  uploadTemplateName.value = template.name;
  if (template.type === PrintTemplateType.EXCEL) {
    if (template.mode === PrintTemplateMode.MULTIPLE) {
      const arrayBuffer = await fetchPathAsArrayBuffer(previewPathStr.value);
      previewArrayBuffer.value = (await getFirstFileAsArrayBuffer(arrayBuffer)).arrayBuffer as ArrayBuffer;
    }
    visibleOfPreview.value = true;
  } else {
    visibleOfWordPreview.value = true;
  }
};

const closePrintingDialog = () => {
  printingInfo.value = {
    loading: false,
    status: "success",
  };
};

watch(() => ({
  visible: props.modelValue,
  uuid: props.nocodeFormProps?.uuid,
  tableUID: currentTableUID.value,
  nocodeId: dialogNocodeId.value,
}), async (newVal, oldVal) => {
  if (!newVal.visible) {
    row.value = null;
    runtimeFormData.value = undefined;
    runtimeOtherDataSources.value = [];
    runtimeTable.value = undefined;
    rowShareDialogVisible.value = false;
    resetPreviewState();
    return;
  }
  if (
    newVal.uuid !== oldVal.uuid
    || newVal.tableUID !== oldVal.tableUID
    || newVal.nocodeId !== oldVal.nocodeId
  ) {
    await getFilteredPrintTemplate();
  }
}, { immediate: true });

watch(() => props.contentRefreshKey, (value, oldValue) => {
  if (value === oldValue) {
    return;
  }
  row.value = null;
  runtimeFormData.value = undefined;
  runtimeOtherDataSources.value = [];
  runtimeTable.value = undefined;
  rowShareDialogVisible.value = false;
  resetPreviewState();
  isViewing.value = props.formMode === FormMode.Edit;
});

provideFormMode(formMode);
</script>

<style lang="scss" scoped>
.base-data-form-dialog {
  pointer-events: all;

  :deep(.table-form-dialog) {
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

  .content {
    height: 100%;
    display: flex;

    .left {
      min-width: 0;
      flex: 1;
      height: 100%;

      .form-container {
        height: 100%;
        display: flex;
        width: 100%;
        flex-direction: column;

        .header {
          display: flex;
          align-items: center;
          height: 40px;
          padding: 0 16px;
          border-bottom: 1px solid var(--border-color);

          .icon-wrap {
            padding: 8px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            cursor: var(--cursor-pointer);

            &.active,
            &:hover {
              span,
              i {
                color: var(--color-primary);
              }
            }

            span {
              margin-left: 4px;
              font-size: 14px;
              line-height: 20px;
            }
          }

          :deep(.el-popover) {
            padding: 8px 0;
            background-color: var(--color-white);

            .print-menu {
              display: flex;
              flex-direction: column;
              gap: 4px;

              li {
                cursor: var(--cursor-pointer);
                padding: 4px 8px;
                transition: all 0.3s ease;

                &:hover {
                  color: var(--color-primary);
                  background-color: var(--bg-color-overlay);
                }
              }
            }
          }

          .division {
            border-left: 1px solid var(--border-color-light);
            margin: 0 5px;
            height: 20px;
          }
        }

        .form-wrap {
          flex: 1;
          min-height: 0;
        }

        .form-wrap.viewing {
          background-color: var(--el-bg-color-overlay);
          padding: 16px;
          height: 100%;
          min-height: 0;
          overflow: auto;
          width: 100%;

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

          &::-webkit-scrollbar {
            width: 4px;
          }

          :deep(.process-info-card) {
            margin-bottom: 16px;
          }
        }

        .footer {
          background-color: var(--bg-color-page);
          padding: 10px 24px;
          border-top: 1px solid var(--border-color);

          .el-button {
            margin-right: 8px;
            border-radius: 4px;
          }
        }
      }
    }
  }
}

.data-form-drawer {
  pointer-events: all;

  :deep(.table-form-drawer) {
    --close-button-size: 16px;
    --el-message-close-size: 24px;
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
      margin: 0;

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

    &.is-fullscreen {
      border-radius: 0;
    }
  }

  .content {
    height: 100%;
    display: flex;

    .left {
      min-width: 0;
      flex: 1;
      height: 100%;

      .form-container {
        height: 100%;
        display: flex;
        width: 100%;
        flex-direction: column;

        .header {
          display: flex;
          align-items: center;
          height: 40px;
          padding: 0 16px;
          border-bottom: 1px solid var(--border-color);

          .icon-wrap {
            padding: 8px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            cursor: var(--cursor-pointer);

            &.active,
            &:hover {
              span,
              i {
                color: var(--color-primary);
              }
            }

            span {
              margin-left: 4px;
              font-size: 14px;
              line-height: 20px;
            }
          }

          :deep(.el-popover) {
            padding: 8px 0;
            background-color: var(--color-white);

            .print-menu {
              display: flex;
              flex-direction: column;
              gap: 4px;

              li {
                cursor: var(--cursor-pointer);
                padding: 4px 8px;
                transition: all 0.3s ease;

                &:hover {
                  color: var(--color-primary);
                  background-color: var(--bg-color-overlay);
                }
              }
            }
          }

          .division {
            border-left: 1px solid var(--border-color-light);
            margin: 0 5px;
            height: 20px;
          }
        }

        .form-wrap {
          flex: 1;
          min-height: 0;
        }

        .form-wrap.viewing {
          background-color: var(--el-bg-color-overlay);
          padding: 16px;
          height: 100%;
          min-height: 0;
          overflow: auto;
          width: 100%;

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

          &::-webkit-scrollbar {
            width: 4px;
          }

          :deep(.process-info-card) {
            margin-bottom: 16px;
          }
        }

        .footer {
          background-color: var(--bg-color-page);
          padding: 10px 24px;
          border-top: 1px solid var(--border-color);

          .el-button {
            margin-right: 8px;
            border-radius: 4px;
          }
        }
      }
    }
  }
}
</style>
