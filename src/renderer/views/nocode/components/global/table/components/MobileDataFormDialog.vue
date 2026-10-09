<template>
  <div class="data-form-dialog data-form-container">
    <el-dialog 
      class="table-form-dialog"
      :modelValue="modelValue" 
      @update:model-value="emit('update:modelValue', $event)" 
      @open="handleOpen" 
      @closed="handleClear" 
      :close-on-click-modal="false" 
      :destroy-on-close="true" 
      align-center  
      :show-close="false"
    >
      <template #header>
        <div class="header-row">
          <div class="title" @click="handleClose">
            <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
            <span>{{title}}</span>
          </div>
          <view-action-button-group
            v-if="detailActionItems.length && isViewing"
            :items="detailActionItems"
            :maxVisible="2"
            size="small"
            @execute="emit('executeViewAction', $event)"
          />
        </div>
      </template>
      <div class="dialog-container">
        <div class="content">
          <div class="form-container-viewing" v-if="isViewing">
            <vn-stack class="mobile-detail-stack" v-model="activeName">
              <div class="stack-tabs">
                <vn-stack-tab name="data">
                  {{ $t('MobileDataFormDialog.data') }}
                </vn-stack-tab>
                <vn-stack-tab name="process">
                  {{ $t('MobileDataFormDialog.process') }}
                </vn-stack-tab>
              </div>
              <el-scrollbar class="stack-content">
                <vn-stack-layer name="data">
                  <div class="view-form-wrap">
                    <nocode-form :key="formRenderKey" ref="viewingFormRef" v-bind="resolvedNocodeFormProps" :row="mergedRow" :isViewing="isViewing" v-if="props.modelValue" @ready="handleFormReady"></nocode-form>
                  </div>
                </vn-stack-layer>
                <vn-stack-layer name="process">
                  <div class="stack-panel process-panel">
                    <process-flows v-if="todo" :todo="todo" :isMobile="true" />
                    <el-empty v-else :description="$t('MobileDataFormDialog.noProcess')" :image-size="72" />
                  </div>
                </vn-stack-layer>
              </el-scrollbar>
            </vn-stack>
          </div>
          <div class="form-container-edit" v-if="!isViewing">
            <div class="edit-form-wrap">
              <nocode-form :key="formRenderKey" ref="editingFormRef" v-bind="resolvedNocodeFormProps" :row="mergedRow" v-if="isShowForm && props.modelValue" @ready="handleFormReady"></nocode-form>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="footer" v-if="isViewing">
          <mobile-form-display-fields
            v-if="resolvedShowDisplayFields"
            :preHiddenColumnIds="preHiddenColumnIds"
            @update:hiddenColumnIds="updateHiddenColumnIds"
          ></mobile-form-display-fields>
          <div class="buttons">
            <el-button
              class="delete"
              @click="() => deleteTipDialogVisible = true"
              v-if="canDeleteCurrentRow"
              >
            {{ $t('MobileDataFormDialog.delete') }}
            </el-button>
            <el-button
              type="primary"
              class="edit"
              @click="handleClickEditBtn"
              v-if="canEditCurrentRow"
            >
            {{ $t('MobileDataFormDialog.edit') }}
            </el-button>
            <el-button
              class="finish-flow danger"
              @click="handleFinishFlow"
              v-if="showFinishFlowButton"
            >
              {{ $t('MobileDataFormDialog.finishFlow') }}
            </el-button>
          </div>
        </div>
        <div class="footer edit-footer" v-else>
          <div class="buttons edit-buttons" v-if="formMode === FormMode.Edit">
            <el-button class="cancel" v-if="formMode === FormMode.Edit" @click="handleCancel">{{ $t('MobileDataFormDialog.cancel') }}</el-button>
            <el-button v-if="showStashButton" :loading="isSubmitting" class="submit-draft" @click="handleStash">{{ $t('MobileDataFormDialog.stash') }}</el-button>
            <el-button class="submit" type="primary" @click="handleSubmit">{{ $t('MobileDataFormDialog.submit') }}</el-button>
          </div>
          <div class="buttons add-buttons" v-if="formMode !== FormMode.Edit">
            <div class="left">
              <el-checkbox v-model="isSubmitContinuous">{{ $t('MobileDataFormDialog.continuousSubmit') }}</el-checkbox>
              <el-checkbox v-show="isSubmitContinuous" v-model="isSaveCurrentContent">{{ $t('MobileDataFormDialog.saveCurrentContent') }}</el-checkbox>
            </div>
            <div class="right">
              <el-button :loading="isSubmitting" class="submit-draft" @click="handleSubmitDraft">{{ isSubmitContinuous ? $t('MobileDataFormDialog.saveDraft') : $t('MobileDataFormDialog.baocunDraft') }}</el-button>
              <el-button v-if="showStashButton" :loading="isSubmitting" class="submit-draft" @click="handleStash">{{ $t('MobileDataFormDialog.stash') }}</el-button>
              <el-button :loading="isSubmitting" class="submit" type="primary" @click="handleSubmit">{{ $t('MobileDataFormDialog.submit') }}</el-button>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>

    <table-delete-data-dialog
      v-model="deleteTipDialogVisible"
      @deleteTableData="deleteCheckRowsData"
      :title="$t('MobileDataFormDialog.delete')"
      :dataText="$t('MobileDataFormDialog.currentData')"
    ></table-delete-data-dialog>
    <form-save-tip-dialog ref="saveTipDialogRef" :title="$t('MobileDataFormDialog.isSave')"></form-save-tip-dialog>
    <tip-dialog
      ref="finishFlowTipDialogRef"
      :title="$t('MobileDataFormDialog.finishFlow')"
      :content="$t('MobileDataFormDialog.confirmFinishFlow')"
      :confirmText="$t('MobileDataFormDialog.finishFlow')"
      :cancelText="$t('MobileDataFormDialog.cancel')"
      :confirmBtnStyle="{ backgroundColor: '#f9484e' }"
    />
  </div>
</template>

<script lang='ts' setup>
import { ElLoading, ElMessage } from 'element-plus';
import { computed, ref, watch, nextTick } from 'vue';
import { provideFormMode, useTableProps } from "../hooks";
import ViewActionButtonGroup from "./ViewActionButtonGroup.vue";

import { useTable } from '../hooks';
import { FormMode, type TableProps } from '../types';
import { formFlowApi, formDataApi, useRuntime } from '@renderer/utils';
import i18next from 'i18next';
import { isEmpty } from '@common/utils/object';
import { FieldAuthValue, FormTableRuntime, NocodeBody, NocodeFormData, ViewAction } from '@common/types/nocode';
import { OptionTableUID, Row, Table as ProjectTable } from '@common/types/project';
import { getUUIDSystemField } from '@common/utils';
import { getDeleteResultMessage, hasDeleteFailures } from '../delete-result-message';
import { isDataChangeTriggerStashEnabled } from '@common/utils';
import { DataChangeType, ProcessNodeStatus } from '@common/types/project';
import { usePassportStore } from '@renderer/stores';
import ProcessFlows from '../../../ProcessFlows.vue';

type MobileDialogNocodeFormProps = Record<string, unknown> & {
  uuid?: string,
  row?: Record<string, unknown> | null,
  nocodeId?: string,
  fieldsAuth?: Record<string, FieldAuthValue> | "all",
};

type RelatedDetailPayload = {
  relatedTableUID: OptionTableUID,
  uuid: string,
  row?: Row | null,
  fieldUID?: string,
  sourceContext?: {
    nocodeId: string,
    tableUID?: OptionTableUID,
    formData?: NocodeFormData,
    otherDataSources?: NocodeBody['otherDataSources'],
  },
};

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  modelValue: boolean,
  title: string,
  nocodeFormProps: MobileDialogNocodeFormProps,
  formMode: FormMode,
  startInEdit?: boolean,
  preHiddenColumnIds?: string[],
  contentRefreshKey?: number,
  showDisplayFields?: boolean,
  isEditDataAble?: boolean,
  isDeleteDataAble?: boolean,
  isRelatedDetailDialog?: boolean,
  detailActionItems?: Array<{ action: ViewAction, disabled?: boolean, tip?: string }>,
}>();

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void,
  (e: "submitted"): void,
  (e: "draft-saved"): void,
  (e: "flow-finished", uuid: string): void,
  (e: "executeViewAction", action: ViewAction): void,
  (e: "deleted"): void,
}>();

const saveTipDialogRef = ref();
const finishFlowTipDialogRef = ref();
const table = useTable();
const passportState = usePassportStore();
const viewingFormRef = ref();
const editingFormRef = ref();
const activeName = ref("data");
const isViewing = ref(true);
const deleteTipDialogVisible = ref(false);
const tableProps = (useTableProps() || {}) as Partial<TableProps>;
const isSubmitContinuous = ref(false);
const isSaveCurrentContent = ref(false);
const isSubmitting = ref(false);
const isShowForm = ref(true);
const row = ref<Row | null>(null);
const runtimeFormData = ref<NocodeFormData | undefined>(undefined);
const runtimeOtherDataSources = ref<NocodeBody['otherDataSources']>([]);
const runtimeTable = ref<ProjectTable | undefined>(undefined);
const mergedRow = computed(() => row.value || props.nocodeFormProps?.row);
const detailActionItems = computed(() => props.detailActionItems || []);
const todo = ref();
const showFinishFlowButton = computed(() => {
  return Boolean(
    isViewing.value
    && (passportState.account?.isAdmin || passportState.isMainAccount)
    && todo.value?.status === ProcessNodeStatus.IN_PROGRESS
  );
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
const dialogNocodeId = computed(() => props.nocodeFormProps?.nocodeId || table?.nocodeId || tableProps.nocodeId || "");
const currentTableUID = computed(() => {
  return props.nocodeFormProps?.tableUID?.[1] || table?.formTableUID || tableProps.tableUID || "";
});
const currentBootstrapFormData = computed<NocodeFormData | undefined>(() => props.nocodeFormProps?.bootstrapData?.formData);
const currentBootstrapOtherDataSources = computed<NocodeBody['otherDataSources']>(() => props.nocodeFormProps?.bootstrapData?.otherDataSources || []);
const currentResolvedFormData = computed(() => currentBootstrapFormData.value || runtimeFormData.value);
const currentResolvedOtherDataSources = computed(() => {
  return currentBootstrapOtherDataSources.value.length
    ? currentBootstrapOtherDataSources.value
    : runtimeOtherDataSources.value;
});
const currentActionRow = computed<Row | null>(() => {
  if (isViewing.value) {
    return mergedRow.value || table?.selectedRow || viewingFormRef.value?.getFormRow?.() || null;
  }
  return editingFormRef.value?.getFormRow?.() || mergedRow.value || table?.selectedRow || null;
});
const currentDialogTable = computed<ProjectTable | undefined>(() => {
  if (runtimeTable.value?.uid === currentTableUID.value) {
    return runtimeTable.value;
  }
  const formDataTables = currentResolvedFormData.value?.tables || [];
  const otherTables = currentResolvedOtherDataSources.value.flatMap((source) => source.tables || []);
  return [...formDataTables, ...otherTables].find((item) => item.uid === currentTableUID.value);
});
const detailPermissionRow = computed(() => {
  return currentActionRow.value || table?.selectedRow || null;
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
const formRenderKey = computed(() => {
  return `${props.nocodeFormProps?.uuid || "new"}-${props.contentRefreshKey || 0}-${isViewing.value ? "view" : "edit"}`;
});
const resolvedNocodeFormProps = computed(() => {
  const relatedDetailHandler = props.nocodeFormProps?.relatedDetailHandler;
  if (!relatedDetailHandler) {
    return props.nocodeFormProps;
  }
  return {
    ...props.nocodeFormProps,
    relatedDetailHandler: (payload: RelatedDetailPayload) => {
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
const detailRuntimeContext = computed(() => ({
  nocodeId: dialogNocodeId.value,
  tableUID: currentTableUID.value,
  formData: currentResolvedFormData.value,
  fieldsAuth: props.nocodeFormProps?.fieldsAuth || table?.fieldsAuth,
}));
const readonlyHiddenColumnIds = ref<string[]>([]);
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

const handleFormReady = (payload: {
  table?: ProjectTable;
  formData?: NocodeFormData;
  otherDataSources?: NocodeBody['otherDataSources'];
}) => {
  runtimeTable.value = payload.table;
  runtimeFormData.value = payload.formData;
  runtimeOtherDataSources.value = payload.otherDataSources || [];
};
const todoRecordKey = computed(() => `${detailRuntimeContext.value.nocodeId || ''}:${detailRuntimeContext.value.tableUID || ''}:${props.nocodeFormProps?.uuid || ''}`);

const closeDialog = () => {
  emit('update:modelValue', false);
}

const isFormModified = () => {
  if (isViewing.value) return false;
  return !!editingFormRef.value?.isModified?.();
}

const handleSubmit = async ()=>{
  if(!editingFormRef.value) return;
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
  isSubmitting.value = true;
  const loadingInstance = ElLoading.service({
    target: ".iframe-wrap",
    text: i18next.t('MobileDataFormDialog.submiting'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  try {
    const result = await editingFormRef.value.submit({ skipSubmitValidationNoticeConfirm: true, skipSubmitSignSyncConfirm: true });
    if(result){
      if (props.formMode === FormMode.Add) {
        ElMessage.success(i18next.t('MobileDataFormDialog.addSuccess'));
        if (isSubmitContinuous.value && isSaveCurrentContent.value) {
          await editingFormRef.value.resetAddingRowIdentity?.();
        }
      } else {
        ElMessage.success(i18next.t('MobileDataFormDialog.editSuccess'));
      }

      if(isSubmitContinuous.value) {  // 勾选连续提交
        if (!isSaveCurrentContent.value) {  // 不保存当前内容
          // 重置表单数据
          isShowForm.value = false;
        }
        nextTick().then(() => {
          isShowForm.value = true;
        });
        emit("submitted");
      } else {  // 不勾选连续提交
        emit("submitted");
        closeDialog();
      }
    }
  } finally {
    loadingInstance.close();
    isSubmitting.value = false;
  }
}

async function saveDraftBeforeRefresh() {
  if(!editingFormRef.value) return false;
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    text: i18next.t('MobileDataFormDialog.saveDraftLoading'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  const res = await editingFormRef.value.saveDraft().then(() => true).catch((err) => {
    ElMessage.error(err?.message || i18next.t('MobileDataFormDialog.saveFail'));
    return false;
  });
  loadingInstance.close();
  return res;
}

const handleSubmitDraft = async () => { 
  if(!editingFormRef.value) return;
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    text: i18next.t('MobileDataFormDialog.saveDraftLoading'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  const res = await editingFormRef.value.saveDraft().then(() => true).catch((err) => {
    ElMessage.error(err?.message || i18next.t('MobileDataFormDialog.saveFail'));
    return false;
  });
  loadingInstance.close();
  if (res) {
    ElMessage.success(i18next.t('MobileDataFormDialog.saveDraftSuccess'));
    await nextTick()
    emit("draft-saved");
  }
}

const handleStash = async () => {
  if(!editingFormRef.value) return;
  const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.({
    onSignSyncConflict: saveDraftBeforeRefresh,
  });
  if (!confirmed) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    text: i18next.t('MobileDataFormDialog.stashLoading'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  isSubmitting.value = true;
  try {
    const res = await editingFormRef.value.stash?.();
    if (res) {
      ElMessage.success(i18next.t('MobileDataFormDialog.stashSuccess'));
      emit("submitted");
      closeDialog();
    }
  } finally {
    loadingInstance.close();
    isSubmitting.value = false;
    editingFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const handleCancel = () => {
  isViewing.value = true;
}

const handleClose = async () => {
  if (props.formMode === FormMode.Edit && isFormModified()) {
    const isSave = await saveTipDialogRef.value?.confirm();
    if (isSave) {
      await handleSubmit();
      return;
    }
  }
  closeDialog();
}

const handleClickEditBtn = () => {
  if (!canEditCurrentRow.value) {
    return;
  }
  isViewing.value = false;
}

const runtime = useRuntime();
const resolveDeletePromise = () => {
  const targetRow = currentActionRow.value || props.nocodeFormProps?.row || table?.selectedRow;
  const targetTableUID = currentTableUID.value;
  const targetNocodeSign = editingFormRef.value?.getTargetNocodeSign?.() || viewingFormRef.value?.getTargetNocodeSign?.();
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

const getTodo = async () => {
  if (
    runtime === FormTableRuntime.FORM_EDITOR
    || !props.nocodeFormProps?.uuid
    || !detailRuntimeContext.value.tableUID
    || !detailRuntimeContext.value.nocodeId
  ) {
    todo.value = null;
    return;
  }
  todo.value = await formFlowApi.getTodo({
    nocodeId: detailRuntimeContext.value.nocodeId,
    tableUID: detailRuntimeContext.value.tableUID,
    uuid: props.nocodeFormProps.uuid,
  });
}
const deleteCheckRowsData = async () => {
  if (!canDeleteCurrentRow.value) {
    ElMessage.warning(i18next.t('InnerRowShareViewer.noPermission'));
    return;
  }
  const deletePromise = resolveDeletePromise();
  if (!deletePromise) {
    return;
  }
  await deletePromise.then((result) => {
    const message = getDeleteResultMessage(result, i18next.t('MobileDataFormDialog.delSuccess'));
    if (hasDeleteFailures(result)) {
      ElMessage.warning(message);
      return;
    }
    ElMessage.success(message);
    emit("deleted");
  }).catch((err) => {
    ElMessage.error(err.message);
  });
  emit("update:modelValue", false)
}

const updateHiddenColumnIds = (value: string[]) => {
  readonlyHiddenColumnIds.value = value || [];
  viewingFormRef.value?.setHiddenFields(value);
}

const syncReadonlyHiddenFields = () => {
  if (!isViewing.value) {
    return;
  }
  viewingFormRef.value?.setHiddenFields(readonlyHiddenColumnIds.value);
}

const handleClear = () => {
  if(props.formMode === FormMode.Edit) isViewing.value = true;

  isSubmitContinuous.value = false;
  isSaveCurrentContent.value = false;
  isSubmitting.value = false;
  isShowForm.value = true;
  todo.value = null;
  runtimeFormData.value = undefined;
  runtimeOtherDataSources.value = [];
  runtimeTable.value = undefined;
}

const syncOpenState = () => {
  if(props.formMode === FormMode.Edit) isViewing.value = !props.startInEdit;
  else isViewing.value = false;

  if (!isEmpty(tableProps.addNewRowData) && props.formMode === FormMode.Add) {
    row.value = tableProps.addNewRowData;
  }
}

const handleOpen = () => {
  syncOpenState();
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

const formMode = computed(() => {
  return props.formMode;
})

watch(() => [props.modelValue, props.formMode, props.startInEdit, props.nocodeFormProps?.uuid], ([visible]) => {
  if (!visible) {
    return;
  }
  syncOpenState();
}, { immediate: true, flush: 'post' });

watch(() => {
  return {
    visible: props.modelValue,
    uuid: props.nocodeFormProps?.uuid,
  };
}, async (newVal, oldVal) => {
  if (newVal.visible && newVal.uuid && (newVal.uuid !== oldVal?.uuid || !oldVal?.visible)) {
    todo.value = null;
    await getTodo();
  }

  if (!newVal.visible) {
    todo.value = null;
    row.value = null;
  }
}, {
  immediate: true,
});

watch(() => props.contentRefreshKey, (value, oldValue) => {
  if (value === oldValue) {
    return;
  }
  runtimeFormData.value = undefined;
  runtimeOtherDataSources.value = [];
  runtimeTable.value = undefined;
}, { flush: 'post' });

watch(() => ({
  visible: props.modelValue,
  recordKey: todoRecordKey.value,
}), async (value, oldValue) => {
  if (value.visible && value.recordKey && value.recordKey !== '::' && (value.recordKey !== oldValue?.recordKey || !oldValue?.visible)) {
    activeName.value = 'data';
    todo.value = null;
    await getTodo();
  }

  if (!value.visible) {
    activeName.value = 'data';
    todo.value = null;
  }
}, {
  immediate: true,
});

watch(readonlyHiddenColumnIds, () => {
  syncReadonlyHiddenFields();
}, { deep: true });

watch(() => [props.modelValue, isViewing.value, formRenderKey.value], async ([visible, viewing]) => {
  if (!visible || !viewing) {
    return;
  }
  await nextTick();
  syncReadonlyHiddenFields();
}, { flush: 'post' });

provideFormMode(formMode);
</script>

<style lang='scss' scoped>
.data-form-dialog {
  :deep(.view-action-button-group) {
    .action-button,
    .more-button {
      height: 24px;
      min-height: 24px;
      border-radius: 4px;
    }
  }

  :deep(.table-form-dialog) {
    width: 100%;
    height: 100%;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #F2F5F7;

    .el-dialog__header {
      padding: 0 16px;
      padding-bottom: 0;
      padding-top: 24px;
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .title {
        height: 44px;
        display: inline-flex;
        align-items: center;
        padding-right: 12px;
        gap: 8px;

        .back-button {
          color: var(--text-color-primary);
          font-size: 16px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        span {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0px;
        }
      }
    }

    .el-dialog__body {
      padding: 16px 16px 80px;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;

      .dialog-container {
        padding: 6px 2px;
        background: #fff;
        border-radius: 8px;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
    }

    .el-dialog__footer {
      width: 100%;
      position: absolute;
      bottom: 0;
      left: 0;

      .footer {
        width: 100%;
        height: 64px;
        background-color: #fff;
        border-top: 1px solid #E6E6E6;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;

        .buttons {
          display: flex;
          gap: 8px;
          .el-button {
            border-radius: 4px;
            margin: 0;
            height: 40px;
          }
          .finish-flow.danger {
            color: #f9484e;
            border-color: #f2b8bb;
          }
          .edit {
            padding: 0 24px;
          }
        }
      }
      
      .edit-footer {
        .buttons {
          width: 100%;
        }
        .el-button {
          flex: 1;
        }
        .add-buttons {
          width: 100%;
          height: 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 0 10px;

          .left {
            display: flex;
            > label {
              margin: 0;
              margin-right: 10px;

              &:last-child {
                margin-right: 0;
              }
            }
          }

          .right {
            display: flex;
            justify-content: flex-end;
            flex: 1;

            .submit-draft {
              max-width: 90px;
              height: 40px;
              padding: 0 16px;
              border-radius: 4px;
            }
            .submit {
              max-width: 128px;
              min-width: 80px;
              height: 40px;
              border-radius: 4px;
              margin-left: 8px;
              flex: 1;
            }
          }
        }
      }
    }

    .form-container-viewing {
      .b2widget {
        .container {
          min-height: 40px;
          .value {
            border: 1px solid #D6D6D6;
            border-radius: 4px;
            background-color: #fff;
            min-height: 40px;
            padding: 9px 12px;
            box-sizing: border-box;
          }
        }
      }
    }

    .form-container-edit {
      .el-input {
        .el-input__wrapper {
          border-radius: 4px;
          background-color: #fff;
          height: 40px;
          padding: 10px 12px;
          box-sizing: border-box;
        }
      }
      
      .select-data-button {
        height: 40px;
        border-radius: 4px;
      }
    }
  }


  .dialog-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    
    .header {
      display: flex;
      align-items: center;

      .title {
        font-size: 16px;
        font-weight: 500;
        margin-left: 8px;
      }
    }

    .content {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      
      .form-container-viewing {
        width: 100%;
        height: 100%;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;

        .mobile-detail-stack {
          width: 100%;
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 12px;
          min-height: 0;

          .stack-tabs {
            display: flex;
            align-items: center;
            min-height: 40px;
            padding: 4px;
            border-radius: 8px;
            background: #fff;

            .vn-stack-tab {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 32px;
              border-radius: 6px;
              color: var(--text-color-regular);
              transition: all 0.2s ease;

              &.active {
                background: var(--bg-color);
                color: var(--el-color-primary);
              }
            }
          }

          .stack-content {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: auto;

            :deep(.el-scrollbar__wrap) {
              display: flex;
              flex-direction: column;
              flex: 1;
              min-height: 0;
            }

            :deep(.el-scrollbar__view) {
              height: 100%;
              flex: 1;
              min-height: 0;
              display: flex;
              flex-direction: column;
            }

            :deep(.vn-stack-layer.active) {
              height: 100%;
              display: flex;
              flex-direction: column;
              min-height: 0;
            }
          }

          .stack-panel {
            height: 100%;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            background: #fff;
            border-radius: 8px;
            padding: 12px;
            box-sizing: border-box;
          }

          .log-panel {
            height: 100%;
            padding: 0;
          }

          :deep(.process-flows) {
            height: 100%;
            flex: 1;
            min-height: 0;
          }
        }

        .view-form-wrap {
          width: 100%;
          min-height: 100%;
        }
        .footer {
          width: 100%;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: #fff;
          border-top: 1px solid #E6E6E6;
          padding-left: 8px;
          padding-right: 16px;

          :deep(.el-button) {
            border-radius: 4px;
          }
        }
      }
      .form-container-edit {
        height: 100%;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        .edit-form-wrap {
          width: 100%;
          flex: 1;
          min-height: 0;
          overflow: auto;
        }
      }
    }
  }
}
</style>
