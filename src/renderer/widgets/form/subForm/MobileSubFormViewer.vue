<template>
  <div class="mobile-subform-viewer" ref="subformViewerRef"
    v-if="subForm.children?.length || subForm.isLoading"
    v-loading="subForm.isLoading"
    element-loading-custom-class="detail-loading-mask"
    :element-loading-text="i18next.t('loading')"
  >
    <div v-if="!subForm.isReadonly" class="table-editor">
      <div class="add-btn-wrapper" :class="{ disabled: isRowLimitReached }" @click="handleAddRow">
        <el-icon class="add-btn" :size="20"><CirclePlusFilled /></el-icon>
      </div>
    </div>

    <div class="collapse" :class="{'empty': !displayRows.length}">
      <div v-show="!displayRows.length" class="empty-show">
        <el-empty :image-size="64" :description="$t('noData')">
          <template #image>
            <i-ven-icon-widget-form-sub-form-empty-icon fill="#F5F6F7"></i-ven-icon-widget-form-sub-form-empty-icon>
          </template>
        </el-empty>
      </div>

      <el-collapse class="collapse-container" v-show="showColumns.length > 0" v-model="activeNames" @change="handleSelectionChange">
        <div class="collapse-item" v-for="(rowItem, rowIndex) in displayRows" :key="rowItem.key">
          <el-collapse-item :name="rowItem.key">
            <template #title="{ isActive }">
              <div :class="['title-wrapper', { 'is-active': isActive }]">
                {{ (rowIndex + 1).toString().padStart(2, '0') }}
                <el-icon class="header-icon">
                  <info-filled />
                </el-icon>
              </div>
            </template>

            <template #icon="{ isActive }">
              <span class="icon-ele">
                {{ isActive ? i18next.t('collapse') : i18next.t('expand') }}
                <el-icon><ArrowUp /></el-icon>
              </span>
            </template>

            <template #default>
              <template v-if="subForm.hasRuntime && subForm.runtimeStore">
                <div class="widget"
                  v-for="field in runtimeFieldsForRow(rowItem.runtimeRow)"
                  :key="field.column.id"
                  :title="field.widget.title"
                  :width="field.widget.widthInSubForm"
                >
                  <div class="header-title">
                    <span class="header-required" v-if="isColumnRequired(field.widget) && !field.widget.isReadonly">*</span>
                    <div class="header-title-text" v-if="field.widget.showTitle" :title="field.widget.title">{{ field.widget.title }}</div>
                    <span class="header-description-tooltip" v-if="field.widget.showDescription && field.widget.descriptionLayout === 'tooltip'">
                      <el-tooltip
                        :content="field.widget.descriptionContent" raw-content effect="light" :disabled="!field.widget.descriptionContent"
                        show-arrow placement="top" trigger="click"
                        popper-class="header-description-tooltip-popper"
                      >
                        <el-icon size="14"><i-ven-icon-widget-form-sub-form-data-source-form-question/></el-icon>
                      </el-tooltip>
                    </span>
                  </div>

                  <div class="runtime-cell">
                    <cell-presenter
                      :address="{ rowId: rowItem.key, fieldId: field.column.fieldId }"
                      :column="field.column"
                      :store="subForm.runtimeStore"
                      :version="subForm.runtimeVersion"
                      :readonly="subForm.isReadonly"
                      :action-selected="isRuntimeActionSelected(rowItem.key, field.column.fieldId)"
                      :related-data-service="subForm.runtimeRelatedDataService"
                      :option-service="subForm.runtimeOptionService"
                      @commit="handleRuntimeCommit"
                      @action="handleRuntimeCellAction"
                    />
                  </div>
                </div>
              </template>
              <template v-else>
                <template v-for="widget in showColumns" :key="widget.uid">
                  <div class="widget"
                    v-if="widget.isCreateField() || !subForm.isReadonly"
                    :title="widget.title"
                    :width="widget.widthInSubForm"
                  >
                    <div class="header-title">
                      <span class="header-required" v-if="isColumnRequired(widget) && !widget.isReadonly">*</span>
                      <div class="header-title-text" v-if="widget.showTitle" :title="widget.title">{{ widget.title }}</div>
                      <span class="header-description-tooltip" v-if="widget.showDescription && widget.descriptionLayout === 'tooltip'">
                        <el-tooltip
                          :content="widget.descriptionContent" raw-content effect="light" :disabled="!widget.descriptionContent"
                          show-arrow placement="top" trigger="click"
                          popper-class="header-description-tooltip-popper"
                        >
                          <el-icon size="14"><i-ven-icon-widget-form-sub-form-data-source-form-question/></el-icon>
                        </el-tooltip>
                      </span>
                    </div>

                    <x-widget
                      :widget="findWidget(rowItem.formRow?.children, widget)"
                      :style="{ padding: '0px' }"
                    ></x-widget>
                  </div>
                </template>
              </template>
            </template>

          </el-collapse-item>
          <div class="subform-row-preview" @click.stop="rowPreviewClick(rowItem, rowIndex)">
            <table-cell-format v-if="previewWidget" :row="rowItem.formRow?.row" :sub-row="rowItem.runtimeRow" :value="previewValue(rowItem)" :params="getParams(previewWidget)" :widget="subForm" @show-link-form="showLinkForm" />
            <span v-else class="empty">{{ i18next.t('noData') }}</span>
            <div class="widget-editor" v-if="!subForm.isReadonly" v-show="widgetEditorVisible && clickWidgetEditorIndex === rowIndex">
              <el-icon class="del-btn" :size="16" @click="handleDeleteRow(rowItem, rowIndex)"><i-ep-delete /></el-icon>
            </div>
          </div>
        </div>
      </el-collapse>
    </div>

    <el-button
      v-if="!subForm.isReadonly"
      class="bottom-add-button"
      type="primary"
      plain
      @click="subForm.addRow(undefined, {}, true)"
      >
      {{ $t('add') }}
    </el-button>

    <teleport to="body">
      <runtime-select-data-host
        v-if="runtimeSelectDataWidget && runtimeSelectDataContext"
        :key="runtimeSelectDataWidget.uid"
        v-model="runtimeSelectDataVisible"
        :widget="runtimeSelectDataWidget"
        :runtime="runtimeSelectDataContext"
        @select="handleRuntimeSelectData"
        @fill-start="handleRuntimeSelectDataStart"
        @fill-error="handleRuntimeSelectDataError"
      />
      <runtime-organize-host
        v-if="runtimeOrganizeWidget && runtimeOrganizeContext"
        v-model="runtimeOrganizeVisible"
        :widget="runtimeOrganizeWidget"
        :value="runtimeOrganizeContext.value"
        @commit="handleRuntimeOrganizeCommit"
        @cancel="clearRuntimeOrganizeState"
      />
      <runtime-uploader-host
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
  
    <!-- 这里是为了让子组件mount，影响组件的isReady -->
    <b2-container v-show="false" :container="subForm.container"></b2-container>
  </div>
  <div class="subform-empty" v-else>
    <el-empty :image-size="64" :description="i18next.t('noAvailableFields')">
      <template #image>
        <i-ven-icon-widget-form-sub-form-empty-icon fill="#F5F6F7"></i-ven-icon-widget-form-sub-form-empty-icon>
      </template>
    </el-empty>
  </div>
</template>

<script lang="ts" setup>
import { SubForm } from './subForm';
import IEpPlus from "~icons/ep/plus";
import { FormElement } from '@renderer/b2/controllers/form';
import { TableCellFormat } from "../_common/table";
import { computed, ref, watch, provide, nextTick, shallowRef, onBeforeUnmount } from 'vue';
import { ArrowUp, CirclePlusFilled } from "@element-plus/icons-vue";
import IEpDelete from "~icons/ep/delete";
import IVenIconEmptyIcon from "~icons/ven-icon/widget-form-sub-form-empty-icon";
import IVenIconDataSourceFormQuestion from "~icons/ven-icon/widget-form-sub-form-data-source-form-question";
import { ElMessage } from 'element-plus';
import i18next, { $t } from "@renderer/widgets/i18next";
import { deepClone } from '@common/utils/object';
import CellPresenter from './grid/CellPresenter.vue';
import RuntimeOrganizeHost from './grid/RuntimeOrganizeHost.vue';
import RuntimeUploaderHost from './grid/RuntimeUploaderHost.vue';
import RuntimeSelectDataHost from '../selectData/RuntimeSelectDataHost.vue';
import type { RuntimeSelectDataContext } from '../selectData/SelectDataDialog.vue';
import type { RuntimeOrganizeType } from './runtime/organization-runtime';
import type { CellAddress } from './runtime/types';
import type { RuntimeUploadItem } from './runtime/uploader-service';
import {
  createRuntimePendingUploads,
  RUNTIME_PENDING_UPLOADS,
} from './grid/runtime-pending-uploads';
import {
  createRuntimeUploadCell,
  RUNTIME_UPLOAD_CELL,
} from './grid/runtime-upload-cell';

const props = defineProps<{
  subForm: SubForm;
}>();

const selectedRows = ref<any[]>([]);
const subformViewerRef = ref();
const clickWidgetEditorIndex = ref(null);
const widgetEditorVisible = ref(null);
const isRowLimitReached = computed(() => !props.subForm.canAddRows());
const showColumns = computed(() => {
  return props.subForm.children.filter(item => !item.isHidden)
})

const rowKey = (row: Record<string, any> = {}) => String(row.__rowId || row.__uuid__ || row.uid || '');

const displayRows = computed<Array<{ key: string; runtimeRow?: Record<string, any>; formRow?: any }>>(() => {
  if (props.subForm.hasRuntime) {
    void props.subForm.runtimeVersion;
    return props.subForm.runtimeTableData.map(row => ({
      key: rowKey(row as Record<string, any>),
      runtimeRow: row as Record<string, any>,
    }));
  }
  return props.subForm.tableData.map(row => ({ key: row.uid, formRow: row }));
});

const previewWidget = computed(() => showColumns.value[0]);

const previewValue = (rowItem: { runtimeRow?: Record<string, any>; formRow?: any }) => {
  if (props.subForm.hasRuntime) {
    return rowItem.runtimeRow?.[previewWidget.value?.fieldId];
  }
  return findWidget(rowItem.formRow?.children, previewWidget.value)?.inputValue;
};

const runtimeFieldsForRow = (row: Record<string, any>) => {
  const store = props.subForm.runtimeStore;
  const rowId = rowKey(row);
  const rowState = store?.getRow(rowId);
  if (!rowState || !store) return [];
  const columns = props.subForm.runtimeColumns || [];
  const byFieldId = new Map(columns.map(column => [column.fieldId, column]));
  const byId = new Map(columns.map(column => [column.id, column]));
  return showColumns.value.flatMap(widget => {
    const column = byFieldId.get(widget.fieldId || '') || byId.get(widget.uid);
    if (!column) return [];
    const visible = column.adapter.isVisible?.({
      address: { rowId, fieldId: column.fieldId },
      row: rowState,
      store,
    });
    return visible === false ? [] : [{ column, widget }];
  });
};

const handleRuntimeCommit = async ({ address, value }: { address: CellAddress; value: unknown }) => {
  const store = props.subForm.runtimeStore;
  const column = (props.subForm.runtimeColumns || []).find(item => item.fieldId === address.fieldId);
  const row = store?.getRow(address.rowId);
  if (!column || !store || !row) return;
  const parsedValue = column.adapter.parse(value, { address, row, store });
  await props.subForm.batchPatchRuntimeRows([{
    rowId: address.rowId,
    values: { [address.fieldId]: parsedValue },
  }]);
};

const activeNames = ref([]);
const isInitialized = ref(false);

const findWidget = (widgets: FormElement[], sourceWidget: FormElement) => {
  if (!widgets || !sourceWidget) return null;
  return widgets.find(w => w['originId'] === sourceWidget?.uid);
}

const isColumnRequired = (widget: FormElement) => {
  return props.subForm.isColumnRequired(widget);
}

const getParams = (widget: FormElement)=>{
  const subType = widget.field?.meta?.subType;
  const extra = widget.field?.meta?.extra;
  const uid = widget.field?.uid;
  return { subType, extra, uid };
};

const getWidgetClassName = (widget: FormElement) => {
  let widgetType = widget.field.meta?.extra?.widgetType || widget.type || 'TextInput';
  widgetType = widgetType.split('.').pop();
  return `widget-${widgetType}`;
}

const linkTableInfo = ref({});
const dataViewDialogVisible = ref(false);
const showLinkForm = async (tableId: string, filterPath?: string) => {
  const canView = await props.subForm.topForm.canReadLayerData(tableId);
  if (!canView) {
    ElMessage.error(i18next.t('linkFormNoPermission'));
    return;
  }

  linkTableInfo.value = {
    nocodeId: props.subForm.getBoard().nocodeId,
    tableId,
    filterPath,
  }
  dataViewDialogVisible.value = true;
}

const findRuntimeWidget = (address: CellAddress) => props.subForm.children.find(child => (
  child.fieldId === address.fieldId || child.uid === address.fieldId
)) || null;

const runtimeSelectDataVisible = ref(false);
const runtimeSelectDataWidget = ref<any>(null);
const runtimeSelectDataContext = ref<RuntimeSelectDataContext | null>(null);
const runtimeOrganizeVisible = ref(false);
const runtimeOrganizeWidget = ref<any>(null);
const runtimeOrganizeContext = ref<{
  address: CellAddress;
  rowRevision?: number;
  value: unknown;
  type: RuntimeOrganizeType;
} | null>(null);
const runtimeUploaderVisible = ref(false);
const runtimeUploaderWidget = ref<any>(null);
const runtimeUploaderContext = ref<{
  address: CellAddress;
  rowRevision?: number;
  value: unknown;
  readonly?: boolean;
} | null>(null);
const runtimeUploaderAnchor = shallowRef<HTMLElement | null>(null);

const runtimeActionSelections = ref<ReadonlySet<string>>(new Set());
const runtimeSelectDataSelections = ref(new Map<string, Record<string, any[]>>());
const runtimeSelectionKey = (rowId: string, fieldId: string) => `${rowId}\u0000${fieldId}`;
const isRuntimeActionSelected = (rowId: string, fieldId: string) => {
  return runtimeActionSelections.value.has(runtimeSelectionKey(rowId, fieldId));
};

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

const pendingUploads = createRuntimePendingUploads({
  store: () => props.subForm.runtimeStore,
  service: () => props.subForm.runtimeUploaderService,
  widget: address => findRuntimeWidget(address) as any,
  commit: (address, items) => applyUploaderValue(address, items),
});
provide(RUNTIME_PENDING_UPLOADS, pendingUploads);

const uploadCell = createRuntimeUploadCell({
  store: () => props.subForm.runtimeStore,
  widget: address => findRuntimeWidget(address) as any,
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
  payload: { address: CellAddress; anchor?: HTMLElement | null; readonly?: boolean } | CellAddress,
) => {
  const address = "address" in payload ? payload.address : payload;
  const anchor = "address" in payload ? payload.anchor : undefined;
  const cellReadonly = "address" in payload ? payload.readonly === true : false;
  if (!props.subForm.hasRuntime) return;
  const widget = findRuntimeWidget(address);
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
    const detailPayload = {
      relatedTableUID: relatedTable.relatedTableUID,
      uuid: String(uuid),
      fieldUID: address.fieldId,
      row: relatedRow as any,
    };
    const handler = (props.subForm.getBoard() as any)?.projectContext?.openRelatedDetail;
    if (handler) {
      handler(detailPayload);
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
        .map(id => [String(id), [{ [(widget as any).uuidKey || 'id']: String(id) }]]))
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

const handleDeleteRow = (rowItem: { key: string }, index: number) => {
  clearRuntimeActionState([rowItem.key]);
  props.subForm.deleteRow(index);
};


const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = rows;
  widgetEditorVisible.value = false;
}

const handleAddRow = () => {
  if (isRowLimitReached.value) return;
  props.subForm.addRow(undefined, {}, true);
}

const rowPreviewClick = (row: any, index: number) => {
  const lastIndex = clickWidgetEditorIndex.value;
  clickWidgetEditorIndex.value = index;
  if (index === lastIndex) {
    widgetEditorVisible.value = !widgetEditorVisible.value;
    return;
  }
  widgetEditorVisible.value = true;
}

watch(() => displayRows.value.length, () => {
  if (!isInitialized.value && props.subForm.children?.length && displayRows.value.length) {
    activeNames.value = [displayRows.value[0].key];
    isInitialized.value = true;
  }
});

// 连续扫码

const scannerRegistry = new Map<string, () => Promise<void>>();

const registerScanner = (uid: string, handler: () => Promise<void>) => {
  scannerRegistry.set(uid, handler);
};

const unregisterScanner = (uid: string) => {
  scannerRegistry.delete(uid);
};

// 连续扫码的处理函数
const handleNextScanCode = async (currentWidgetUid: string) => {
  const tableData = props.subForm.tableData;
  if (!tableData) return;

  let currentRowIndex = -1;
  let columnIndex = -1;

  for (let i = 0; i < tableData.length; i++) {
    const row = tableData[i];
    const found = row.children?.find((child: FormElement, index) => {
      if (child.uid === currentWidgetUid) {
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

  if (nextRowIndex < props.subForm.tableData.length) {
    const nextRow = props.subForm.tableData[nextRowIndex];

    // 展开下一行
    if (!activeNames.value.includes(nextRow.uid)) {
      activeNames.value = [nextRow.uid];
    }

    const targetWidget = nextRow.children?.[columnIndex];

    const handler = scannerRegistry.get(targetWidget.uid);
    if (targetWidget && handler) {
      handler();
    }
  }
};

// 提供给B2TextInput
provide('subform-scanner-registry', {
  registerScanner,
  unregisterScanner,
  onNextScanCode: handleNextScanCode
});

</script>

<style lang="scss" scoped>
.mobile-subform-viewer {
  width: 100%;
  position: relative;

  .collapse {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    &.empty {
      border: none;
    }
  }

  .runtime-cell {
    display: flex;
    min-height: 32px;
  }

  .empty-show {
    width: 100%;
    height: 128px;
    display: flex;
    justify-content: center;
    align-items: center;

    .el-empty {
      padding: 0;
      .el-empty__description {
        margin-top: 4px;
        font-size: 14px;
      }
    }
  }

  .table-editor {
    height: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    top: -28px;
    box-sizing: border-box;
    right: 0;
    gap: 8px;

    .add-btn-wrapper {
      height: 100%;
      width: auto;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;

      &.disabled {
        cursor: not-allowed;

        .add-btn {
          color: var(--text-color-disabled);
        }
      }

      .add-btn {
        font-size: 20px;
        padding: 2px;
        color: var(--color-primary);
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
  }

  .bottom-add-button {
    width: 100%;
    height: 32px;
    margin-top: 8px;
    border-radius: 4px;
    cursor: var(--cursor-pointer);
  }

  :deep(.collapse-container) {
    border: none;

    .collapse-item:first-child {
      .el-collapse-item__header {
        border-top: none;
      }
    }
    .el-collapse-item__header {
      height: 32px;
      min-height: 0;
      background-color: var(--bg-color);
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 0 12px;
      -webkit-tap-highlight-color: transparent;

      .icon-ele {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        .el-icon {
          transition: transform 0.3s;
          margin-top: -2px;
          transform-origin: center 60%;
        }
      }

      &.is-active {
        .icon-ele {
          color: var(--color-primary);
          .el-icon {
            transform: rotate(180deg);
          }
        }
      }

      .title-wrapper {
        font-size: 14px;
        color: var(--color-primary);
        letter-spacing: 1.5px;
      }
    }

    .collapse-item {
      .el-collapse-item__wrap {
        padding: 12px;
        border: none;
        .el-collapse-item__content {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 0;
        }
      }

      .widget {
        position: relative;

        .header-title {
          display: flex;
          align-items: center;
          min-width: 0;
          margin-bottom: 4px;

          .header-required {
            position: absolute;
            left: -6px;
            color: #eb5050;
            font-size: 14px;
            font-family: "Segoe UI";
          }

          .header-title-text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 14px;
            color: var(--text-color-primary);
          }

          .header-description-tooltip {
            display: inline-flex;
            align-items: center;
            margin-left: 5px;
            color: var(--text-color-secondary);
            cursor: pointer;
          }
        }

        .readonly-content {
          min-height: 40px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          > div {
            width: 100%;
          }

          &.widget-richTextEditor {
            min-height: 120px;
            max-height: 320px;
            padding: 8px;
            overflow-y: auto;
            .cell-content-value {
              max-height: auto;
            }
          }
        }
      }

      .subform-row-preview {
        height: 40px;
        display: flex;
        align-items: center;
        padding-right: 28px;
        margin: 0 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: height 0.3s;
        opacity: 1;
        position: relative;

        > div {
          overflow-y: visible;
        }

        .widget-editor {
          height: 100%;
          display: flex;
          gap: 4px;
          position: absolute;
          right: -12px;

          .el-icon {
            width: auto;
            height: 100%;
            aspect-ratio: 1 / 1;
          }
          .del-btn {
            color: var(--color-danger);
          }
        }
      }

      .is-active + .subform-row-preview {
        height: 0;
        opacity: 0;
      }
    }
  }

  :deep(.el-scrollbar) {
    .el-scrollbar__view {
      padding-bottom: 15px;
    }

    .el-scrollbar__bar {
      margin-bottom: 4px;
    }

    .el-scrollbar__thumb {
      height: 10px;
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
  max-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 360px;
  height: 128px;
  background-color: var(--bg-color-overlay);
  border-radius: 4px;

  :deep(.el-empty) {
    padding: 0;
    .el-empty__description {
      margin-top: 4px;
      font-size: 14px;
    }
  }
}
</style>

<style lang="scss">
.header-description-tooltip-popper {
  --el-bg-color-overlay: var(--bg-color);
  color: var(--text-color-regular);
  font-size: 14px;
  max-width: 80vw;
}
</style>
