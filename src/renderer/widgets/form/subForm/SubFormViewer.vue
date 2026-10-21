<template>
  <div class="subform-empty" v-if="!subForm.children?.length && !subForm.isLoading">
    {{ $t('noAvailableFields') }}
  </div>
  <div class="subform-viewer" ref="subformViewerRef" v-else v-loading="subForm.isLoading" element-loading-custom-class="detail-loading-mask" :element-loading-text="i18next.t('loading')">
    <div class="table">
      <div v-if="!subForm.isReadonly" class="table-editor">
        <div class="table-editor-left">
          <template v-if="!isBatchOperation">
            <el-button class="btn-add-row" type="primary" link :icon="IEpPlus" :disabled="isRowLimitReached" @click="addRow()">{{ $t('add') }}</el-button>
            <el-button  class="btn-import" type="default" link :icon="IVenIconImportButton" @click="handleImport">{{ $t('import') }}</el-button>
            <el-button  class="btn-quick-fill" type="default" link @click="handleQuickFill">
              <el-icon :size="14" style="margin-right: 6px;"><IVenIconEdit style="fill: currentColor;" /></el-icon>
              {{ $t('quickFill') }}
            </el-button>
          </template>
          <template v-else>
            <el-button class="btn-hover-primary" :disabled="selectedRows && !selectedRows?.length" link @click="handleEdit()">{{ i18next.t('edit') }}</el-button>
            <el-button class="btn-hover-primary" :disabled="selectedRows && !selectedRows?.length" link @click="handleCopy(selectedRows)">{{ i18next.t('copy') }}</el-button>
            <el-button class="btn-hover-danger" :disabled="selectedRows && !selectedRows?.length" link @click="handleDelete">{{ i18next.t('delete') }}</el-button>
          </template>
        </div>
        <div class="table-editor-right">
          <el-button v-if="!isBatchOperation" type="primary" link @click="handleBatch(true)">{{ i18next.t('batchOperation') }}</el-button>
          <el-button v-else type="primary" link @click="handleBatch(false)">{{ i18next.t('exitBatchOperation') }}</el-button>
        </div>
      </div>
      <SubFormGrid
        v-if="subForm.hasRuntime && subForm.runtimeStore"
        ref="subFormGridRef"
        :store="subForm.runtimeStore"
        :columns="runtimeGridColumns"
        :readonly="subForm.isReadonly"
        :row-height="lineHeight"
        :height="500"
        :batch-operation="isBatchOperation"
        :selected-row-ids="runtimeSelectedRowIds"
        :action-selected-addresses="runtimeActionSelections"
        :related-data-service="subForm.runtimeRelatedDataService"
        :option-service="subForm.runtimeOptionService"
        :external-version="subForm.runtimeVersion"
        @selection-change="handleRuntimeSelectionChange"
        @cell-action="handleRuntimeCellAction"
        @enter="handleRuntimeCellEnter"
      >
        <template #header-cell="{ column }">
          <div class="column-header">
            <span class="required" v-if="isRuntimeColumnRequired(column)">*</span>
            <span class="column-title" :title="runtimeColumnTitle(column)">{{ runtimeColumnTitle(column) }}</span>
          </div>
        </template>
        <template #row-actions="{ index }">
          <div class="wrapper-row-editor">
            <span :class="['row-index', !subForm.isReadonly ? 'editable' : '']">{{ index + 1 }}</span>
            <div :class="['row-editor', !subForm.isReadonly ? 'editable' : '']">
              <el-button class="danger" link @click="handleRuntimeRowDelete(index)">
                <el-icon :size="14"><i-ep-delete /></el-icon>
              </el-button>
              <el-button link @click="rowEditDrawerRef?.show(index)">
                <el-icon :size="14"><i-ven-icon-widget-form-sub-form-open-form /></el-icon>
              </el-button>
              <el-dropdown trigger="click">
                <el-button link>
                  <el-icon :size="14" :color="'var(--text-color-regular)'"><i-ven-icon-widget-form-sub-form-more /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="handleCopy([subForm.runtimeTableData[index]], index + 1)">{{ i18next.t('copyToNextRow') }}</el-dropdown-item>
                    <el-dropdown-item @click="handleCopy([subForm.runtimeTableData[index]], subForm.runtimeTableData.length)">{{ i18next.t('copyToLastRow') }}</el-dropdown-item>
                    <el-dropdown-item @click="insertRow(index)">{{ i18next.t('insertRowAbove') }}</el-dropdown-item>
                    <el-dropdown-item @click="insertRow(index + 1)">{{ i18next.t('insertRowBelow') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </template>
      </SubFormGrid>
      <teleport to="body">
        <RuntimeSelectDataHost
          v-if="runtimeSelectDataWidget && runtimeSelectDataContext"
          :key="runtimeSelectDataWidget.uid"
          v-model="runtimeSelectDataVisible"
          :widget="runtimeSelectDataWidget"
          :runtime="runtimeSelectDataContext"
          @select="handleRuntimeSelectData"
          @fill-start="handleRuntimeSelectDataStart"
          @fill-error="handleRuntimeSelectDataError"
        />
        <RuntimeOrganizeHost
          v-if="runtimeOrganizeWidget && runtimeOrganizeContext"
          v-model="runtimeOrganizeVisible"
          :widget="runtimeOrganizeWidget"
          :value="runtimeOrganizeContext.value"
          @commit="handleRuntimeOrganizeCommit"
          @cancel="clearRuntimeOrganizeState"
        />
        <RuntimeUploaderHost
          v-if="runtimeUploaderWidget && runtimeUploaderContext"
          v-model="runtimeUploaderVisible"
          :widget="runtimeUploaderWidget"
          :address="runtimeUploaderContext.address"
          :value="runtimeUploaderContext.value"
          :anchor="runtimeUploaderAnchor"
          :readonly="runtimeUploaderContext.readonly === true"
          :apply-value="applyUploaderValue"
          @update:model-value="handleRuntimeUploaderVisibility"
        />
      </teleport>
    </div>
    <div class="btn-list" v-if="!subForm.isReadonly">
      <el-button v-if="false" class="del-btn" type="danger" size="small" plain :icon="IEpDelete" @click="">{{ i18next.t('subFormBatchDelete') }}</el-button>
    </div>
    <!-- 这里是为了让子组件mount，影响组件的isReady -->
    <b2-container v-show="false" :container="subForm.container"></b2-container>
    <sub-form-batch-edit-dialog v-model="editVisible" :subForm="subForm" :selectedRows="selectedRows"></sub-form-batch-edit-dialog>
    <sub-form-row-edit-drawer ref="rowEditDrawerRef" :subForm="subForm"  @copy-row="handleCopyByDrawer" @create-row="handleCreateByDrawer" @cell-action="handleRuntimeCellAction"></sub-form-row-edit-drawer>
    <teleport to="body">
      <data-view-dialog
        v-model="dataViewDialogVisible"
        v-bind="linkTableInfo"
        v-if="dataViewDialogVisible"
      />
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { SubForm, UUID } from './subForm';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import IVenIconImportButton from "~icons/ven-icon/widget-form-sub-form-import-button";
import IVenIconEdit from "~icons/ven-icon/widget-form-sub-form-edit"
import { FormElement } from '@renderer/b2/controllers/form';
import { computed, nextTick, onUnmounted, ref, shallowRef, watch, provide, onBeforeUnmount } from 'vue';
import SubFormBatchEditDialog from './SubFormBatchEditDialog.vue';
import SubFormRowEditDrawer from './SubformRowEditDrawer.vue';
import { ElMessage } from 'element-plus'
import { deepClone } from '@common/utils/object';
import { provideEnterPress } from './utils';
import i18next, { $t } from "@renderer/widgets/i18next";
import SubFormGrid from './grid/SubFormGrid.vue';
import RuntimeSelectDataHost from '../selectData/RuntimeSelectDataHost.vue';
import type { RuntimeSelectDataContext } from '../selectData/SelectDataDialog.vue';
import RuntimeOrganizeHost from './grid/RuntimeOrganizeHost.vue';
import type { RuntimeOrganizeType } from './runtime/organization-runtime';
import RuntimeUploaderHost from './grid/RuntimeUploaderHost.vue';
import {
  createRuntimePendingUploads,
  RUNTIME_PENDING_UPLOADS,
} from './grid/runtime-pending-uploads';
import {
  createRuntimeUploadCell,
  RUNTIME_UPLOAD_CELL,
} from './grid/runtime-upload-cell';
import type { CellAddress } from './runtime/types';
import type { RuntimeUploadItem } from './runtime/uploader-service';

const props = defineProps<{
  subForm: SubForm;
}>();

props.subForm.setLazyRowInitialization(true);

const emit = defineEmits(['importExcel', 'quickFill']);

const isBatchOperation = ref(false);
const selectedRows = ref<any[]>([]);
const runtimeSelectedRowIds = computed(() => props.subForm.hasRuntime
  ? selectedRows.value.map(row => String(row))
  : []);
const runtimeActionSelections = ref<ReadonlySet<string>>(new Set());
const runtimeSelectDataSelections = ref(new Map<string, Record<string, any[]>>());
const editVisible = ref(false);
const rowEditDrawerRef = ref();
const subFormGridRef = ref();
const subformViewerRef = ref();
const isRowLimitReached = computed(() => !props.subForm.canAddRows());

const enterNewlineInput = computed(() => props.subForm.enterNewlineInput);
const showColumns = computed(() => {
  return props.subForm.getTableVisibleChildren()
})

const runtimeGridColumns = computed(() => {
  const runtimeColumns = props.subForm.runtimeColumns || [];
  const byFieldId = new Map(runtimeColumns.map(column => [column.fieldId, column]));
  const byId = new Map(runtimeColumns.map(column => [column.id, column]));
  return showColumns.value
    .map(widget => byFieldId.get(widget.fieldId || '') || byId.get(widget.uid))
    .filter((column): column is NonNullable<typeof column> => Boolean(column));
});

const runtimeColumnTitle = (column: any) => String(column?.schema?.title ?? '');
const isRuntimeColumnRequired = (column: any) => {
  const widget = showColumns.value.find(item => item.fieldId === column?.fieldId || item.uid === column?.id);
  return widget ? isColumnRequired(widget) : false;
};

const handleRuntimeSelectionChange = (rowIds: string[]) => {
  selectedRows.value = rowIds;
};

const runtimeSelectionKey = (rowId: string, fieldId: string) => `${rowId}\u0000${fieldId}`;

const clearRuntimeActionState = (rowIds: Iterable<string>) => {
  const deletedIds = new Set([...rowIds].map(String));
  if (!deletedIds.size) return;

  runtimeActionSelections.value = new Set(
    [...runtimeActionSelections.value].filter(key => !deletedIds.has(key.split("\u0000", 1)[0])),
  );
  for (const key of runtimeSelectDataSelections.value.keys()) {
    if (deletedIds.has(key.split("\u0000", 1)[0])) {
      runtimeSelectDataSelections.value.delete(key);
    }
  }
};

const pruneRuntimeActionState = () => {
  const rowIds = new Set(
    props.subForm.runtimeTableData.map(row => String(row.__rowId || row[UUID] || row.uid)),
  );
  runtimeActionSelections.value = new Set(
    [...runtimeActionSelections.value].filter(key => rowIds.has(key.split("\u0000", 1)[0])),
  );
  for (const key of runtimeSelectDataSelections.value.keys()) {
    if (!rowIds.has(key.split("\u0000", 1)[0])) {
      runtimeSelectDataSelections.value.delete(key);
    }
  }
};

watch(
  () => props.subForm.hasRuntime
    ? props.subForm.runtimeTableData.map(row => String(row.__rowId || row[UUID] || row.uid))
    : [],
  pruneRuntimeActionState,
  { flush: "post" },
);

const runtimeRowIdAt = (index: number) => {
  const row = props.subForm.runtimeTableData[index] as Record<string, unknown> | undefined;
  const rowId = row?.[UUID] ?? row?.__rowId ?? row?.uid;
  return rowId === undefined || rowId === null ? undefined : String(rowId);
};

const handleRuntimeRowDelete = (index: number) => {
  const rowId = runtimeRowIdAt(index);
  if (!rowId) return;
  clearRuntimeActionState([rowId]);
  void props.subForm.deleteRow(index);
};

const handleRuntimeCellEnter = async (address: CellAddress) => {
  if (!enterNewlineInput.value) return;
  const store = props.subForm.runtimeStore;
  if (!store) return;
  const index = store.rowIds.indexOf(address.rowId);
  if (index < 0) return;

  let targetRowId = store.rowIds[index + 1];
  if (!targetRowId) {
    const added = await props.subForm.addRowAsync(undefined, {}, true);
    if (!added) return;
    const nextRowIds = store.rowIds;
    targetRowId = nextRowIds[nextRowIds.length - 1];
  }
  if (!targetRowId) return;
  await nextTick();
  await subFormGridRef.value?.focusCell({ rowId: targetRowId, fieldId: address.fieldId });
};

const runtimeSelectDataVisible = ref(false);
const runtimeSelectDataWidget = ref<any>(null);
const runtimeSelectDataContext = ref<RuntimeSelectDataContext | null>(null);
const runtimeOrganizeVisible = ref(false);
const runtimeOrganizeWidget = ref<any>(null);
const runtimeOrganizeContext = ref<{
  address: { rowId: string; fieldId: string };
  rowRevision?: number;
  value: unknown;
  type: RuntimeOrganizeType;
} | null>(null);
const runtimeUploaderVisible = ref(false);
const runtimeUploaderWidget = ref<any>(null);
const runtimeUploaderContext = ref<{
  address: { rowId: string; fieldId: string };
  rowRevision?: number;
  value: unknown;
  readonly?: boolean;
} | null>(null);
const runtimeUploaderAnchor = shallowRef<HTMLElement | null>(null);

const pendingUploads = createRuntimePendingUploads({
  store: () => props.subForm.runtimeStore,
  service: () => props.subForm.runtimeUploaderService,
  widget: address => props.subForm.children.find(child => (
    child.fieldId === address.fieldId || child.uid === address.fieldId
  )) || null,
  commit: (address, items) => applyUploaderValue(address, items),
});
provide(RUNTIME_PENDING_UPLOADS, pendingUploads);
const uploadCell = createRuntimeUploadCell({
  store: () => props.subForm.runtimeStore,
  widget: address => props.subForm.children.find(child => (
    child.fieldId === address.fieldId || child.uid === address.fieldId
  )) || null,
  pendingUploads: () => pendingUploads,
  isReadonly: () => props.subForm.isReadonly === true,
});
provide(RUNTIME_UPLOAD_CELL, uploadCell);
props.subForm.setPendingUploadCheck(() => pendingUploads.hasAny());
onBeforeUnmount(() => {
  props.subForm.setPendingUploadCheck(null);
  uploadCell.dispose();
  pendingUploads.dispose();
});

const clearRuntimeOrganizeState = () => {
  runtimeOrganizeVisible.value = false;
  runtimeOrganizeWidget.value = null;
  runtimeOrganizeContext.value = null;
};

const clearRuntimeUploaderState = () => {
  runtimeUploaderVisible.value = false;
  runtimeUploaderWidget.value = null;
  runtimeUploaderContext.value = null;
  runtimeUploaderAnchor.value = null;
};

const handleRuntimeUploaderVisibility = (visible: boolean) => {
  runtimeUploaderVisible.value = visible;
  if (!visible) {
    runtimeUploaderWidget.value = null;
    runtimeUploaderContext.value = null;
    runtimeUploaderAnchor.value = null;
  }
};

const handleRuntimeCellAction = async (
  payload: { address: { rowId: string; fieldId: string }; anchor?: HTMLElement | null; readonly?: boolean } | { rowId: string; fieldId: string },
) => {
  const address = "address" in payload ? payload.address : payload;
  const anchor = "address" in payload ? payload.anchor : undefined;
  const cellReadonly = "address" in payload ? payload.readonly === true : false;
  if (!props.subForm.hasRuntime) return;
  const widget = props.subForm.children.find(child => (
    child.fieldId === address.fieldId
    || child.uid === address.fieldId
  ));
  if (!widget) return;
  if (widget.type === 'widget.form.file-uploader' || widget.type === 'widget.form.image-uploader') {
    const opened = runtimeUploaderContext.value;
    if (runtimeUploaderVisible.value && opened
      && opened.address.rowId === address.rowId && opened.address.fieldId === address.fieldId) {
      clearRuntimeUploaderState();
      return;
    }
    const row = props.subForm.runtimeStore?.getRow(address.rowId);
    if (!row) return;
    runtimeUploaderWidget.value = widget;
    runtimeUploaderContext.value = {
      address,
      rowRevision: row.revision,
      value: props.subForm.runtimeStore?.getValue(address),
      readonly: cellReadonly || props.subForm.isReadonly,
    };
    runtimeUploaderAnchor.value = anchor || null;
    runtimeUploaderVisible.value = true;
    return;
  }
  if (widget.type === 'widget.form.relatedData' && props.subForm.isReadonly) {
    const relatedTable = props.subForm.relatedTableInfo[address.fieldId];
    const ids = props.subForm.runtimeStore?.getValue(address);
    const uuid = Array.isArray(ids) ? ids.find(Boolean) : ids;
    if (!relatedTable || !uuid) return;
    const relatedRow = await props.subForm.getRuntimeRelatedDetailRow(address);
    if (!props.subForm.runtimeStore?.getRow(address.rowId)) return;
    const payload = {
      relatedTableUID: relatedTable.relatedTableUID,
      uuid: String(uuid),
      fieldUID: address.fieldId,
      row: relatedRow as any,
    };
    const handler = (props.subForm.getBoard() as any)?.projectContext?.openRelatedDetail;
    if (handler) {
      handler(payload);
      return;
    }
    void showLinkForm(relatedTable.relatedTableUID?.[1]);
    return;
  }
  if (props.subForm.isReadonly) return;
  if (widget.type === 'widget.form.memberSelect' || widget.type === 'widget.form.departmentSelect') {
    const row = props.subForm.runtimeStore?.getRow(address.rowId);
    if (!row) return;
    runtimeOrganizeWidget.value = widget;
    runtimeOrganizeContext.value = {
      address,
      rowRevision: row.revision,
      value: props.subForm.runtimeStore?.getValue(address),
      type: widget.type === 'widget.form.memberSelect' ? 'member' : 'department',
    };
    runtimeOrganizeVisible.value = true;
    return;
  }
  if (widget.type !== 'widget.form.selectData' && widget.type !== 'widget.form.relatedData') return;
  runtimeSelectDataWidget.value = widget;
  const row = props.subForm.runtimeStore?.getRow(address.rowId);
  const selectionKey = runtimeSelectionKey(address.rowId, address.fieldId);
  const currentIds = props.subForm.runtimeStore?.getValue(address);
  const initialSelectedRows = runtimeSelectDataSelections.value.get(selectionKey)
    || (widget.type === 'widget.form.relatedData'
      ? Object.fromEntries((Array.isArray(currentIds) ? currentIds : currentIds ? [currentIds] : [])
        .filter(Boolean)
        .map(id => [String(id), [{ [widget.uuidKey || 'id']: String(id) }]]))
      : {});
  runtimeSelectDataContext.value = {
    address,
    multiple: widget.type === 'widget.form.relatedData'
      ? (widget as any).dataMode === 'multiple'
      : !runtimeSelectDataSelections.value.has(selectionKey),
    rowRevision: row?.revision,
    initialSelectedRows: deepClone(initialSelectedRows),
  };
  runtimeSelectDataVisible.value = true;
};

const handleRuntimeOrganizeCommit = async (value: string[]) => {
  const context = runtimeOrganizeContext.value;
  if (!context) return;
  await props.subForm.applyRuntimeOrganizeValue(context.address, value, context.rowRevision);
  clearRuntimeOrganizeState();
};

const applyUploaderValue = (address: CellAddress, value: RuntimeUploadItem[]) => {
  const context = runtimeUploaderContext.value;
  const isCurrentCell = Boolean(context)
    && context!.address.rowId === address.rowId
    && context!.address.fieldId === address.fieldId;
  if (isCurrentCell) context!.value = value;
  void props.subForm.applyRuntimeUploaderValue(address, value).then(applied => {
    if (!applied || !isCurrentCell) return;
    const row = props.subForm.runtimeStore?.getRow(address.rowId);
    const current = runtimeUploaderContext.value;
    if (!row || !current || current.address.rowId !== address.rowId || current.address.fieldId !== address.fieldId) return;
    current.rowRevision = row.revision;
  });
};

const handleRuntimeSelectDataStart = () => {
  if (!props.subForm.isSelectDataBatchFilling) {
    props.subForm.beginSelectDataBatchFill();
  }
  props.subForm.markSelectDataBatchFillPhase("confirm");
};

const handleRuntimeSelectDataError = () => {
  if (props.subForm.isSelectDataBatchFilling) {
    props.subForm.endSelectDataBatchFill();
  }
};

const handleRuntimeSelectData = async (rows: Record<string, any[]>) => {
  const address = runtimeSelectDataContext.value?.address;
  const widget = runtimeSelectDataWidget.value;
  if (!address || !widget) return;
  const startedByConfirm = props.subForm.isSelectDataBatchFilling;
  if (!startedByConfirm) props.subForm.beginSelectDataBatchFill();
  try {
    const currentRow = props.subForm.runtimeStore?.getRow(address.rowId);
    if (!currentRow || (
      runtimeSelectDataContext.value?.rowRevision !== undefined
      && currentRow.revision !== runtimeSelectDataContext.value.rowRevision
    )) {
      runtimeSelectDataVisible.value = false;
      return;
    }
    const appliedRows = await props.subForm.applyRuntimeSelectData(
      address,
      rows,
      widget as any,
      runtimeSelectDataContext.value?.rowRevision,
    );
    if (!appliedRows?.length) {
      runtimeSelectDataVisible.value = false;
      return;
    }
    const hasSelection = Object.keys(rows || {}).length > 0;
    const nextSelections = new Set(runtimeActionSelections.value);
    for (const { rowId, key } of appliedRows) {
      const selectionKey = runtimeSelectionKey(rowId, address.fieldId);
      if (hasSelection && key) {
        nextSelections.add(selectionKey);
        runtimeSelectDataSelections.value.set(selectionKey, deepClone({ [key]: rows[key] }));
      } else {
        nextSelections.delete(selectionKey);
        runtimeSelectDataSelections.value.delete(selectionKey);
      }
    }
    runtimeActionSelections.value = nextSelections;
    runtimeSelectDataVisible.value = false;
  } finally {
    await nextTick();
    props.subForm.endSelectDataBatchFill();
  }
};

const isColumnRequired = (widget: FormElement) => {
  return props.subForm.isColumnRequired(widget);
}

const getCopiedRowValue = (child: FormElement, row: Record<string, any>) => {
  const fieldId = child.fieldId;
  if (!fieldId) return undefined;
  if (child.type === 'widget.form.serialNumber') {
    return null;
  }
  return deepClone(row[fieldId]);
}

const isFormulaCalculatedField = (child: FormElement) => {
  const formulaChild = child as FormElement & {
    computeType?: string;
    formulaValue?: unknown;
    defaultType?: string;
    defaultFormulaValue?: unknown;
  };
  return (
    (formulaChild.computeType === 'formula' && !!formulaChild.formulaValue)
    || (formulaChild.defaultType === 'formula' && !!formulaChild.defaultFormulaValue)
  );
}

const resolveOriginalRowData = (row: any) => {
  if (typeof row === 'number') {
    const runtimeRow = props.subForm.runtimeTableData[row];
    return props.subForm.hasRuntime
      ? props.subForm.getRuntimeRow(String(runtimeRow?.__rowId || runtimeRow?.[UUID] || runtimeRow?.uid))
      : props.subForm.rows[row];
  }
  if (typeof row === 'string') {
    return props.subForm.hasRuntime
      ? props.subForm.getRuntimeRow(row)
      : undefined;
  }
  return props.subForm.hasRuntime
    ? props.subForm.getRuntimeRow(String(row?.__rowId || row?.[UUID] || row?.uid))
    : props.subForm.rows.find(r => (r as any)[UUID] === row?.uid);
}

const ensureRowsCanBeAdded = (count = 1) => {
  if (props.subForm.canAddRows(count)) return true;
  ElMessage.warning({
    message: i18next.t('subFormRowLimitExceeded'),
    showClose: false,
  });
  return false;
}

let isCopyingRows = false;
const handleCopy = async(rows: any[], index: number | undefined = undefined) => {
  if (isCopyingRows || !rows.length) return;
  isCopyingRows = true;
  try {
    if (props.subForm.hasRuntime) {
      await props.subForm.runtimeStore?.whenIdle();
    }

    const originalRows = rows.map(resolveOriginalRowData);
    if (originalRows.some(row => !row) || !ensureRowsCanBeAdded(originalRows.length)) return;

    const rowsToCopy = originalRows.map(originalRowData => {
      const copiedRow = {};
      props.subForm.children.forEach((child) => {
        if (!child.fieldId || isFormulaCalculatedField(child)) return;
        copiedRow[child.fieldId] = getCopiedRowValue(child, originalRowData!);
      });
      return copiedRow;
    });

    if (props.subForm.hasRuntime) {
      await props.subForm.batchAppendRows(rowsToCopy, "user", true, index);
      return;
    }

    for (const row of rowsToCopy) {
      props.subForm.addRow(index, row, true);
      if (index !== undefined) index++;
    }
  } finally {
    isCopyingRows = false;
  }
}

const handleImport = () => {
  emit('importExcel');
}

const handleQuickFill = () => {
  emit('quickFill');
}

const handleEdit = async () => {
  if (!props.subForm.hasRuntime) {
    await props.subForm.ensureAllSubFormRowsInitialized();
  }
  editVisible.value = true;
}

const handleBatch = (bool: boolean) => {
  if (!bool) {
    clearBatchSelection();
  }

  isBatchOperation.value = bool;
}

const handleDelete = () => {
  const selectedIds = selectedRows.value.map(row => String(row));
  const selectedIndices = selectedIds
    .map(rowId => props.subForm.runtimeTableData.findIndex(row => String(row.__rowId || row.uid) === rowId))
    .filter(index => index >= 0);
  clearRuntimeActionState(selectedIds);
  props.subForm.deleteRows(selectedIndices);
  clearBatchSelection();
}

const clearBatchSelection = () => {
  selectedRows.value = [];
}

const handleCopyByDrawer = (index: number) => {
  handleCopy([props.subForm.hasRuntime ? props.subForm.runtimeTableData[index] : props.subForm.tableData[index]])
}

const handleCreateByDrawer = () => {
  if (!ensureRowsCanBeAdded()) return;
  props.subForm.addRow(undefined, {}, true);
}

const insertRow = (index: number) => {
  if (!ensureRowsCanBeAdded()) return;
  props.subForm.addRow(index, {}, true);
}

type BatchOuterScrollPosition = {
  element: HTMLElement;
  scrollTop: number;
  scrollLeft: number;
  overflowAnchor: string;
};

let batchOuterScrollPosition: BatchOuterScrollPosition | null = null;
let scrollRestoreFrame: number | null = null;
let batchScrollUnlockTimer: number | null = null;
let batchScrollLock = false;

const getScrollableAncestor = (): HTMLElement | null => {
  let element = subformViewerRef.value?.parentElement as HTMLElement | null;
  while (element) {
    const style = window.getComputedStyle(element);
    const canScrollY = ['auto', 'overlay', 'scroll'].includes(style.overflowY)
      && element.scrollHeight > element.clientHeight;
    const canScrollX = ['auto', 'overlay', 'scroll'].includes(style.overflowX)
      && element.scrollWidth > element.clientWidth;
    if (canScrollY || canScrollX) return element;
    element = element.parentElement;
  }
  return null;
};

const restoreBatchScrollPosition = () => {
  if (batchOuterScrollPosition) {
    const { element, scrollTop, scrollLeft } = batchOuterScrollPosition;
    if (element.scrollTop !== scrollTop) element.scrollTop = scrollTop;
    if (element.scrollLeft !== scrollLeft) element.scrollLeft = scrollLeft;
  }
};

const scheduleBatchScrollRestore = () => {
  if (scrollRestoreFrame !== null) {
    cancelAnimationFrame(scrollRestoreFrame);
  }

  void nextTick(() => {
    scrollRestoreFrame = requestAnimationFrame(() => {
      restoreBatchScrollPosition();
      scrollRestoreFrame = null;
    });
  });
};

const restoreBatchOuterScrollAnchor = () => {
  if (!batchOuterScrollPosition) return;
  batchOuterScrollPosition.element.style.setProperty(
    'overflow-anchor',
    batchOuterScrollPosition.overflowAnchor,
  );
};

const clearBatchScrollUnlockTimer = () => {
  if (batchScrollUnlockTimer !== null) {
    window.clearTimeout(batchScrollUnlockTimer);
    batchScrollUnlockTimer = null;
  }
};

const scheduleBatchScrollUnlock = () => {
  clearBatchScrollUnlockTimer();
  batchScrollUnlockTimer = window.setTimeout(() => {
    if (props.subForm.isSelectDataBatchFilling) return;
    restoreBatchScrollPosition();
    restoreBatchOuterScrollAnchor();
    batchScrollLock = false;
    batchOuterScrollPosition = null;
    batchScrollUnlockTimer = null;
  }, 200);
};

onBeforeUnmount(() => {
  clearBatchScrollUnlockTimer();
  restoreBatchOuterScrollAnchor();
  batchScrollLock = false;
  batchOuterScrollPosition = null;
  if (scrollRestoreFrame !== null) {
    cancelAnimationFrame(scrollRestoreFrame);
    scrollRestoreFrame = null;
  }
});

onUnmounted(() => {
  props.subForm.setLazyRowInitialization(false);
});

const addRow = () => {
  props.subForm.addRow(undefined, {}, true);
}

const linkTableInfo = ref({});
const dataViewDialogVisible = ref(false);
const showLinkForm = async (tableId: string) => {
  const canView = await (props.subForm.topForm as any).canReadLayerData(tableId);
  if (!canView) {
    ElMessage.error(i18next.t('linkFormNoPermission'));
    return;
  }

  linkTableInfo.value = {
    nocodeId: props.subForm.getBoard().nocodeId,
    tableId,
  }
  dataViewDialogVisible.value = true;
}

// 回车处理
const handleEnterPress = async (currentUid: string) => {
  if (!enterNewlineInput.value) return;

  const tableData = props.subForm.tableData;
  if (!tableData) return;

  let currentRowIndex = -1;
  let columnIndex = -1;
  // 获取当前行/列
  for (let i = 0; i < tableData.length; i++) {
    const row = tableData[i];
    const found = row.children?.find((child: FormElement, index) => {
      if (child.uid === currentUid) {
        currentRowIndex = i;
        columnIndex = index;
        return true;
      };
    });
    if (found) break;
  }

  if (currentRowIndex === -1) return;

  let nextRowIndex = currentRowIndex + 1;

  // 新增一行
  if (nextRowIndex >= tableData.length) {
    const added = await props.subForm.addRowAsync(undefined, {}, true);
    if (!added) return;
    await nextTick();
  }

  // 检查行数
  if (nextRowIndex < props.subForm.tableData.length) {
    const nextRow = props.subForm.tableData[nextRowIndex];
    if (!nextRow || !nextRow.children) return;

    if (!props.subForm.isSubFormRowInitialized(nextRow)) {
      await props.subForm.ensureSubFormRowInitialized(nextRow);
    }

    const targetWidget = nextRow.children[columnIndex];

    if (targetWidget && targetWidget.command) {
      await nextTick();
      targetWidget.command("focus");
      targetWidget.command("select");
    }
  }
};

provideEnterPress(handleEnterPress);

watch(() => props.subForm.isSelectDataBatchFilling, (isFilling) => {
  if (isFilling) {
    clearBatchScrollUnlockTimer();
    if (scrollRestoreFrame !== null) {
      cancelAnimationFrame(scrollRestoreFrame);
      scrollRestoreFrame = null;
    }
    const scrollElement = getScrollableAncestor();
    batchOuterScrollPosition = scrollElement
      ? {
        element: scrollElement,
        scrollTop: scrollElement.scrollTop,
        scrollLeft: scrollElement.scrollLeft,
        overflowAnchor: scrollElement.style.getPropertyValue('overflow-anchor'),
      }
      : null;
    if (batchOuterScrollPosition) {
      scrollElement.style.setProperty('overflow-anchor', 'none');
    }
    batchScrollLock = !!batchOuterScrollPosition;
    if (batchScrollLock) {
      scheduleBatchScrollRestore();
    }
  } else if (batchScrollLock) {
    scheduleBatchScrollRestore();
    scheduleBatchScrollUnlock();
  }
}, { flush: 'sync' });

// 动态计算行高
const lineHeight = computed(() => {
  const hasTextarea = showColumns.value.some(w => w.type === 'widget.form.textarea');
  if (hasTextarea) {
    return 100;
  }
  return 50;
});

</script>

<style lang="scss" scoped>
.subform-viewer {
  display: flex;
  width: 100%;
  flex-wrap: wrap;

  .column-header {
    display: flex;
    align-items: center;
    min-width: 0;
    width: 100%;

    .required {
      color: #eb5050;
      font-size: 14px;
      margin-right: 4px;
    }

    .column-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .header-description-tooltip {
    display: inline-flex;
    align-items: center;
    margin-left: 5px;
    vertical-align: middle;
    color: var(--text-color-secondary);
    cursor: pointer;

    :deep(.el-icon) {
      vertical-align: middle;
    }
  }

  .table-editor {
    height: 36px;
    width: 100%;
    padding: 6px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--border-color);
    border-bottom: 0;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;

    .table-editor-left {
      display: flex;
      gap: 8px;

      .btn-add-row {
        padding: 2px 8px 2px 2px;

        :deep(span) {
          margin-left: 4px;
        }
      }

      .el-button {
        cursor: var(--cursor-pointer);

        &.is-disabled {
          cursor: not-allowed;
        }

        &.btn-hover-primary:hover :deep(span) {
          color: var(--color-primary);
        }

        &.btn-hover-danger:hover :deep(span) {
          color: var(--color-danger);
        }
      }
    }

    .table-editor-right {
      display: flex;
      gap: 8px;

      .el-button {
        cursor: var(--cursor-pointer);
      }
    }
  }

  .table {
    display: flex;
    flex-direction: column;
    width: 100%;

    .wrapper-row-editor {
      position: relative;
      width: 100%;
      height: 100%;

      .row-index, .row-editor  {
        position: absolute;
        left: 50%;
        top:50%;
        transform: translate(-50%, -50%);
      }

      .row-index {
        opacity: 1;
        z-index: 1;

        &.editable {
          opacity: 1;
        }
      }

      .row-editor {
        display: flex;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        z-index: 2;
        width: 100%;
        gap: 4px;
        justify-content: center;

        :deep(.el-button) {
          margin-left: 0px;
          i {
            color: var(--text-color-regular);
            cursor: var(--cursor-pointer);
          }

          &:hover i {
            color: var(--color-primary);
          }

          &.danger:hover i {
            color: var(--color-danger);
          }
        }
      }

      &:hover {
        .row-index.editable {
          opacity: 0;
          visibility: hidden;
        }

        .row-editor.editable {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
      }
    }
  }

  :deep(.subform-grid__row:hover) .wrapper-row-editor,
  :deep(.subform-grid__row:focus-within) .wrapper-row-editor {
    .row-index.editable {
      opacity: 0;
      visibility: hidden;
    }

    .row-editor.editable {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
  }

  .btn-list {
    margin-top: 6px;
    .el-button {
      border-radius: 2px;
    }
  }
}

.subform-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 360px;
  height: 92px;
  background-color: var(--bg-color-overlay);
  border-radius: 4px;
}
</style>
