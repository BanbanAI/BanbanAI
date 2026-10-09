<template>
  <div class="nocode-data-management-table" :class="{ mobile: isMobileDevice }">
    <div
      v-if="widget"
      class="b2table scrollbar-thick"
      :class="{
        'fixed-filter': displayState.filterDisplayMode.value === 'fixed',
      }"
    >
      <table-header
        v-if="props.isShowHeader && props.headerVariant === 'default'"
        :rowHeightLevel="displayState.rowHeightLevel.value"
        :disabled="isInitialLoading"
        @add-data="showFormRowDialog(FormMode.Add)"
        @execute-view-action="void handleExecuteViewAction($event)"
        @import-completed="void handleImportCompleted()"
        @toggleAggregateFields="emit('toggleAggregateFields')"
        @openRecycleBin="emit('openRecycleBin')"
        @changeRowHeight="handleChangeRowHeight"
        @openBatchEditDialog="batchEditDialogVisible = true"
        @openAssignOwnerDialog="handleHeaderAssignOwnerDialog"
      />

      <recycle-bin-table-header
        v-else-if="props.isShowHeader"
        :isFullscreen="props.fullscreen"
        @toggleFullscreen="emit('toggleFullscreen')"
        @recycleChanged="emit('recycleChanged')"
      />

        <div v-if="viewActions.batchBannerVisible.value" class="view-action-batch-banner">
        <div class="view-action-batch-banner__content">
          <div class="view-action-batch-banner__title">
            {{ viewActionBatchBannerMessage }}
          </div>
          <div class="view-action-batch-banner__description">
            {{ viewActionBatchBannerDescription }}
          </div>
        </div>
        <div class="view-action-batch-banner__actions">
          <el-button link type="primary" @click="viewActions.openFailureDetail()">
            {{ VIEW_ACTION_BATCH_TEXT.viewDetail }}
          </el-button>
          <el-button link type="primary" @click="void retryFailedViewActionBatch()">
            {{ VIEW_ACTION_BATCH_TEXT.retryFailed }}
          </el-button>
          <el-button link @click="viewActions.clearBatchState()">
            {{ VIEW_ACTION_BATCH_TEXT.clear }}
          </el-button>
        </div>
      </div>

      <album-panel
        v-if="props.isAlbum"
        :widget="widget"
        :tableId="props.tableUID"
        @clickCard="handleAlbumCardClick"
      />

      <div v-else class="b2table-main">
        <nocode-virtual-data-table
          ref="virtualTableRef"
          :active="props.active"
          :widget="widget"
          :displayColumns="displayColumns"
          :rowHeightLevel="displayState.rowHeightLevel.value"
          :bodyHeightMode="resolvedBodyHeightMode"
          :loading="loading"
          :isMobileDevice="isMobileDevice"
          :isShowCheck="props.isShowCheck"
          :showIndexColumn="props.isShowIndex"
          :showSelectionSequence="props.showSelectionSequence"
          :isMultiple="props.isMultiple"
          :isCellEdit="isCellEdit"
          :showTableActionPanel="viewActions.showTableActionPanel.value"
          :tableActionColumnWidth="tableActionColumnWidth"
          :tableWidthData="displayState.tableWidthData.value"
          :getRecordActionItems="viewActions.getRecordActionItems"
          :clickRowShowDetail="props.clickRowShowDetail"
          :rowDetailTrigger="props.rowDetailTrigger"
          :clickRowChecked="props.clickRowChecked"
          :showAggregateFooter="Boolean(props.isShowFooter && props.isShowAggregateRow)"
          :openedRowKey="dialogs.detailRowKey.value || null"
          :sortable="props.sortable"
          :hideColumnsAble="props.hideColumnsAble"
          :updateColumnDataAble="props.updateColumnDataAble"
          :isShowTableHeaderMenu="Boolean(props.isShowHeader && props.isShowTableHeaderMenu)"
          :headerMenuMode="props.headerMenuMode"
          :enableHeaderFilterPanel="props.enableHeaderFilterPanel"
          :sortFieldsMap="displayState.sortFieldsMap.value"
          :filterConditions="displayState.filterConditions.value"
          :canUpdateColumnData="canUpdateColumnData"
          :locale="locale"
          :headerFilterInfo="columnFilterInfo"
          :isHeaderFilterValueNotEmpty="displayState.isFilterValueNotEmpty.value"
          :getHeaderFilterMenus="getHeaderFilterMenus"
          :getHeaderFilterInstance="getHeaderFilterInstance"
          :getHeaderFilterValueType="getHeaderFilterValueType"
          :shouldShowHeaderFilterValue="shouldShowHeaderFilterValue"
          :fixedColumnCount="props.fixedColumnCount"
          :enableShareLinkColumn="props.enableShareLinkColumn"
          :showShareLinkColumn="showShareLinkColumn"
          :canCopyInternalRowShare="showInternalShareCopyButton"
          :canCopyPublicRowShare="showPublicShareCopyButton"
          :copyInternalRowShareLink="copyInternalRowShareLink"
          :copyPublicRowShareLink="copyPublicRowShareLink"
          @show-related-form="handleShowRelatedForm"
          @show-link-form="handleShowLinkForm"
          @show-related-sub-form="handleShowRelatedSubForm"
          @update-cell-edit="isCellEdit = $event"
          @row-activate="handleRowActivate"
          @header-action="handleVirtualHeaderAction"
          @column-width-change="handleVirtualColumnWidthChange"
          @header-filter-menu-open="handleHeaderFilterMenuOpen"
          @header-filter-menu-close="handleHeaderFilterMenuClose"
          @header-filter-clear="clearFilterValue"
          @execute-view-action="void handleExecuteViewAction($event.payload, $event.row)"
          @toggle-checkbox-row="emit('toggleCheckboxRow', $event)"
          @toggle-check-all="emit('toggleCheckAll', $event.rows, $event.isChecked)"
        />
      </div>

      <div class="b2table-pagination-wrap" v-if="props.isShowPagination">
        <el-config-provider :locale="locale">
          <el-pagination
            background
            :size="isMobileDevice ? 'small' : 'default'"
            :pager-count="isMobileDevice ? 3 : 7"
            :total="widget.total"
            :page-size="widget.pageSize"
            :current-page="widget.currentPage"
            :page-sizes="[10, 20, 30, 40, 50, 100]"
            layout="sizes, slot, prev, pager, next"
            @update:page-size="handlePageSizeChange"
            @update:current-page="handleCurrentPageChange"
          >
            <span v-if="!isMobileDevice" class="page-total-text">
              {{ $t("NocodeTable.total", { count: widget.total }) }}
            </span>
          </el-pagination>
        </el-config-provider>
      </div>

      <teleport to="body">
        <template v-if="isMobileDevice">
          <mobile-data-form-dialog
            v-for="(item, index) in baseDetailDialogStack"
            :key="item.id"
            :modelValue="item.visible"
            @update:modelValue="handleBaseDetailModelValueChange(index, $event)"
            :title="item.title"
            :nocodeFormProps="item.nocodeFormProps"
            :form-mode="FormMode.Edit"
            :contentRefreshKey="item.contentRefreshKey"
            :showDisplayFields="false"
            :isEditDataAble="item.permissions.update"
            :isDeleteDataAble="item.permissions.delete"
            :isRelatedDetailDialog="true"
            @submitted="handleBaseDetailSubmitted(index)"
            @deleted="handleBaseDetailDeleted(index)"
          />
        </template>
        <template v-else>
          <base-data-form-dialog
            v-for="(item, index) in baseDetailDialogStack"
            :key="item.id"
            :modelValue="item.visible"
            @update:modelValue="handleBaseDetailModelValueChange(index, $event)"
            :title="item.title"
            :nocodeFormProps="item.nocodeFormProps"
            :form-mode="FormMode.Edit"
            :contentRefreshKey="item.contentRefreshKey"
            :showDisplayFields="false"
            :isEditDataAble="item.permissions.update"
            :isDeleteDataAble="item.permissions.delete"
            :isRelatedDetailDialog="true"
            @submitted="handleBaseDetailSubmitted(index)"
            @deleted="handleBaseDetailDeleted(index)"
          />
        </template>
        <data-form-dialog
          v-if="!isMobileDevice && dialogs.detailVisible.value"
          v-model="dialogs.detailVisible.value"
          :title="tableFormName"
          :nocodeFormProps="dialogs.nocodeFormProps.value"
          :form-mode="dialogs.detailFormMode.value"
          :startInEdit="dialogs.detailStartInEdit.value"
          :contentRefreshKey="dialogs.detailContentRefreshKey.value"
          :processRefreshKey="dialogs.detailProcessRefreshKey.value"
          :detailActionItems="currentDetailActionItems"
          :workbenchScoped="props.workbenchScopedFormDialog"
          @submitted="handleDetailSubmitted"
          @flow-finished="handleDetailFlowFinished"
          @copy="openCopyDialog"
          @draft-saved="handleDraftSaved"
          @deleted="handleDetailDeleted"
          @executeViewAction="void handleExecuteViewAction($event, dialogs.detailRow.value || undefined)"
        />
        <mobile-data-form-dialog
          v-if="isMobileDevice && dialogs.detailVisible.value"
          v-model="dialogs.detailVisible.value"
          :title="tableFormName"
          :nocodeFormProps="dialogs.nocodeFormProps.value"
          :form-mode="dialogs.detailFormMode.value"
          :startInEdit="dialogs.detailStartInEdit.value"
          :contentRefreshKey="dialogs.detailContentRefreshKey.value"
          :showDisplayFields="true"
          :isEditDataAble="props.isEditDataAble"
          :isDeleteDataAble="props.isDeleteDataAble"
          :detailActionItems="currentDetailActionItems"
          @submitted="handleMobileDetailSubmitted"
          @flow-finished="handleDetailFlowFinished"
          @draft-saved="handleDraftSaved"
          @deleted="handleMobileDetailDeleted"
          @executeViewAction="void handleExecuteViewAction($event, dialogs.detailRow.value || undefined)"
        />
        <data-view-dialog
          v-if="dataViewDialogVisible"
          v-model="dataViewDialogVisible"
          :nocodeId="linkTableInfo.nocodeId || props.nocodeId"
          :tableId="linkTableInfo.tableId"
          :filterPath="linkTableInfo.filterPath"
        />

        <nocode-table-dialog
          v-if="relatedSubTableDialogVisible"
          v-model="relatedSubTableDialogVisible"
          :title="relatedSubTableDialogInfo.title || ''"
          v-bind="relatedSubTableDialogInfo"
          ref="relatedSubTableDialogRef"
        />

        <table-assign-owner-dialog
          v-if="assignOwnerDialogVisible"
          v-model="assignOwnerDialogVisible"
          :rows="assignOwnerDialogRows"
          :initialOwnerId="assignOwnerDialogInitialOwnerId"
          :onSubmit="assignOwnerDialogOnSubmit"
          @update:modelValue="assignOwnerDialogVisible = $event"
        />
        <table-batch-edit-dialog
          v-if="batchEditDialogVisible"
          v-model="batchEditDialogVisible"
          @update:modelValue="batchEditDialogVisible = $event"
        />
        <process-initiate-dialog
          v-if="showCopyDialog && copyProcessTableUID"
          v-model="showCopyDialog"
          :tableUID="copyProcessTableUID"
          :nocodeID="props.nocodeId"
          :tableName="tableFormName"
          :row="copyRow"
          :message="$t('NocodeTable.copySuccess')"
          enableSaveDraft
          @draft-saved="handleCopyDraftSaved"
          @close="handleCopy"
        />
        <view-action-edit-dialog
          v-if="actionEditDialogVisible"
          v-model="actionEditDialogVisible"
          :title="actionEditDialogTitle"
          :nocodeFormProps="actionEditNocodeFormProps"
          :visibleFieldIds="actionEditVisibleFieldIds"
          @submitted="handleActionEditSubmitted"
        />
        <view-action-trigger-precheck-dialog
          v-if="viewActionTriggerPrecheckVisible"
          v-model="viewActionTriggerPrecheckVisible"
          :title="viewActionTriggerPrecheckAction?.display?.label || viewActionTriggerPrecheckAction?.name || i18next.t('NocodeTable.viewActionBatchResultTitleDefault')"
          :result="viewActionTriggerPrecheckResult"
          :loading="viewActionTriggerEnqueueSubmitting"
          @closed="resetViewActionTriggerPrecheck"
          @cancel="cancelViewActionTriggerPrecheck"
          @confirm="void confirmViewActionTriggerEnqueue()"
        />
      </teleport>

    </div>
    <div
      v-if="widget && props.isChangeFilterDisplayMode && props.filterable && displayState.filterDisplayMode.value === 'fixed'"
      class="table-filter-wrap"
    >
      <table-filter />
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import i18next from "i18next";
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRefs, useAttrs, watch } from "vue";
import { useRoute } from "vue-router";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { toRaw } from "vue";
import { FormCondition, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from "@common/types/nocode";
import { LogicalOperator } from "@renderer/b2/types";
import { canReadNocodeTableDataByBody, isPublicDataPermissionBypassedRoute } from "@renderer/views/nocode/utils/data-permission";
import { canViewNocodeLayerByBody } from "@renderer/views/nocode/utils/page-permission";
import { usePassportStore, useSettingStore } from "@renderer/stores";
import { formDataApi, isMobile, storeFactory, useRuntime } from "@renderer/utils";
import { projectApi } from "@renderer/utils/api/project";
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from "@renderer/utils/nocodeSyncMessage";
import {
  NOCODE,
  NOCODE_SIGN_IS_LATEST,
  ORGANIZE_UTIL,
  SYNC_FORM_DATA,
  UPDATE_NOCODE_SIGN,
} from "@renderer/types";
import {
  ExecuteViewActionEditContext,
  ExecuteViewActionRequest,
  ExecuteViewActionResult,
  FieldAuthValue,
  FilterRule,
  FormTableCarouselSettings,
  FormSortField,
  FormTableRuntime,
  FormTableViewMeta,
  FormTableColumnOrder,
  FormTableOperationSettings,
  FormTablePermissionMode,
  NocodeBody,
  NocodeFormData,
  FormTableRowHeight,
  PermissionRangeType,
  ViewAction,
  ViewActionBehaviorType,
  ViewActionConditionScope,
  ViewActionFieldId,
  ViewActionPlacement,
  ViewActionRecordConditionMode,
  ViewActionTriggerMode,
  ViewActionTriggerPrecheckResult,
  ViewActionViewConditionMode,
} from "@common/types/nocode";
import { Field, FieldUID, FormDataStageWhereCondition, OptionTableUID, Row, Table as ProjectTable, TableUID } from "@common/types/project";
import {
  getUUIDSystemField,
  getAllRelatedDepartments,
  getNocodeDataSourceTableByOptionTableUID,
  isMeetConditionsByRow,
} from "@common/utils";
import {
  getViewActionTriggerMode,
  isViewActionRecordTarget,
  isViewActionSelectedTarget,
  isViewActionViewTarget,
} from "@common/utils/viewAction";
import { Column, Table } from "./table";
import { FormMode, TableAssignOwnerDialogOptions } from "./types";
import type { TableProps } from "./types";
import { provideTable, provideTableProps } from "./hooks";
import { provideFormTable } from "@renderer/views/nocode/views/editor/form/hooks";
import {
  createColumnFilterTarget,
  getFilterDefaultValue,
  getFilterFuncInfo,
  getFilterFuncValue,
  isFilterValueVisible,
  useFilterElementResolver,
} from "./filter";
import TableHeader from "./components/TableHeader.vue";
import TableFilter from "./components/TableFilter.vue";
import RecycleBinTableHeader from "./components/RecycleBinTableHeader.vue";
import AlbumPanel from "./components/AlbumPanel.vue";
import NocodeVirtualDataTable from "./NocodeVirtualDataTable.vue";
import type { VirtualTableBodyHeightMode } from "@renderer/components/virtual-table";
import {
  DATA_MANAGEMENT_FORM_MODE,
  resolveDataManagementCurrentDetailRow,
  resolveDataManagementDetailActionRow,
} from "./data-management/detail-row";
import { useDataManagementDialogs } from "./data-management/useDataManagementDialogs";
import { useDataManagementDisplayState } from "./data-management/useDataManagementDisplayState";
import { createDataManagementTableController } from "./data-management/useDataManagementTableController";
import {
  shouldQueueDataManagementDetailTableRefreshAfterCreate,
  shouldRefreshDataManagementDetailAfterViewAction,
  useDataManagementViewActions,
} from "./data-management/useDataManagementViewActions";
import { sanitizeCopiedRowForCopy } from "./copy";
import { useFormMutationTaskNotifications } from "@renderer/hooks/useFormMutationTaskNotifications";
import { useClipboard } from "@vueuse/core";

const BaseDataFormDialog = defineAsyncComponent(() => import("./components/BaseDataFormDialog.vue"));
const DataFormDialog = defineAsyncComponent(() => import("./components/DataFormDialog.vue"));
const MobileDataFormDialog = defineAsyncComponent(() => import("./components/MobileDataFormDialog.vue"));
const DataViewDialog = defineAsyncComponent(() => import("@renderer/views/nocode/views/viewer/dialog/DataViewDialog.vue"));
const NocodeTableDialog = defineAsyncComponent(() => import("./components/NocodeTableDialog.vue"));
const TableAssignOwnerDialog = defineAsyncComponent(() => import("./components/TableAssignOwnerDialog.vue"));
const TableBatchEditDialog = defineAsyncComponent(() => import("./components/TableBatchEditDialog.vue"));
const ViewActionEditDialog = defineAsyncComponent(() => import("./components/ViewActionEditDialog.vue"));
const ViewActionTriggerPrecheckDialog = defineAsyncComponent(() => import("./components/ViewActionTriggerPrecheckDialog.vue"));
const ProcessInitiateDialog = defineAsyncComponent(() => import("@renderer/views/nocode/views/editor/form/dialogs/ProcessInitiateDialog.vue"));

type HeaderActionPayload = {
  actionKey: "sort-asc" | "sort-desc" | "freeze" | "unfreeze" | "hide" | "update-data";
  column: Column;
};

type ExecuteViewActionOptions = {
  targetUUIDs?: string[];
  filters?: ExecuteViewActionRequest["filters"];
};

type NocodeDataManagementTableProps = {
  active?: boolean;
  nocodeId: string;
  widgetNocodeId?: string;
  tableUID: TableUID;
  viewId?: string;
  actions?: ViewAction[];
  tableViewMeta?: FormTableViewMeta;
  uid?: string;
  applyAppFieldPermissionToSystemFields?: boolean;
  isAddDataAble?: boolean;
  isImportDataAble?: boolean;
  isExportDataAble?: boolean;
  isPrintDataAble?: boolean;
  isDeleteDataAble?: boolean;
  isShowMoreMenu?: boolean;
  isEditDataAble?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  isChangeFilterDisplayMode?: boolean;
  isTableCellEditable?: boolean;
  sortable?: boolean;
  hideColumnsAble?: boolean;
  changeRowHeightAble?: boolean;
  isShowAggregateFieldButton?: boolean;
  aggregateFieldActive?: boolean;
  isShowHeader?: boolean;
  isShowTableHeaderMenu?: boolean;
  updateColumnDataAble?: boolean;
  isShowCheck?: boolean;
  isShowIndex?: boolean;
  showSelectionSequence?: boolean;
  isMultiple?: boolean;
  clickRowShowDetail?: boolean;
  rowDetailTrigger?: "click" | "dblclick";
  workbenchScopedFormDialog?: boolean;
  clickRowChecked?: boolean;
  isShowFooter?: boolean;
  isShowAggregateRow?: boolean;
  isShowPagination?: boolean;
  isAlbum?: boolean;
  preFilterRule?: FilterRule;
  preViewFilterRules?: FilterRule[];
  preHiddenColumns?: FieldUID[];
  preColumnOrders?: FormTableColumnOrder;
  preSortFields?: FormSortField[];
  prePageSize?: number;
  addNewRowData?: Row;
  headerOptionsShowMode?: "default" | "right-compact";
  headerVisibleOptionCount?: number;
  headerMenuMode?: "full" | "sort-root-only";
  enableHeaderFilterPanel?: boolean;
  headerVariant?: "default" | "recycle";
  showRecycleBinEntry?: boolean;
  isFilterEmptyValue?: boolean;
  queryStage?: FormDataStageWhereCondition;
  fullscreen?: boolean;
  skipOrganizeLoad?: boolean;
  permissionMode?: "page" | "data";
  dataPermissionMode?: FormTablePermissionMode;
  operationSettings?: FormTableOperationSettings;
  topLimit?: number;
  fixedColumnCount?: 0 | 1 | 2 | 3 | 4;
  carouselSettings?: FormTableCarouselSettings;
  bodyHeightMode?: VirtualTableBodyHeightMode;
  openAssignOwnerDialog?: (options?: TableAssignOwnerDialogOptions) => void;
  enableShareLinkColumn?: boolean;
};

const props = withDefaults(defineProps<NocodeDataManagementTableProps>(), {
  active: true,
  isShowHeader: true,
  isShowFooter: true,
  isShowAggregateRow: true,
  isShowPagination: true,
  isShowTableHeaderMenu: () => (!isMobile()),
  isShowCheck: true,
  isShowIndex: false,
  showSelectionSequence: true,
  clickRowShowDetail: true,
  rowDetailTrigger: "click",
  workbenchScopedFormDialog: false,
  isMultiple: true,
  isAlbum: false,
  clickRowChecked: false,
  isAddDataAble: true,
  isImportDataAble: true,
  isEditDataAble: true,
  isExportDataAble: true,
  isPrintDataAble: true,
  isDeleteDataAble: true,
  isShowMoreMenu: true,
  searchable: true,
  filterable: true,
  sortable: true,
  hideColumnsAble: true,
  changeRowHeightAble: true,
  isShowAggregateFieldButton: false,
  aggregateFieldActive: false,
  isChangeFilterDisplayMode: false,
  isTableCellEditable: false,
  updateColumnDataAble: false,
  isFilterEmptyValue: true,
  actions: () => [],
  skipOrganizeLoad: false,
  permissionMode: "page",
  headerMenuMode: "full",
  enableHeaderFilterPanel: true,
  headerVariant: "default",
  showRecycleBinEntry: false,
  fullscreen: false,
  dataPermissionMode: "form",
  operationSettings: () => ({ export: true, print: true }),
  fixedColumnCount: 0,
  carouselSettings: () => ({ mode: "none", scrollSpeed: "medium", pageInterval: 5 }),
  enableShareLinkColumn: false,
});

const emit = defineEmits<{
  (event: "update:tableViewMeta", meta: FormTableViewMeta): void;
  (event: "closeDialog"): void;
  (event: "openDialog"): void;
  (event: "toggleCheckboxRow", row: any): void;
  (event: "toggleCheckAll", rows: any[], isChecked: boolean): void;
  (event: "submitted", value?: FormMode): void;
  (event: "changeRows", rows: any): void;
  (event: "draft-saved"): void;
  (event: "update-sign", sign: string): void;
  (event: "toggleAggregateFields"): void;
  (event: "openRecycleBin"): void;
  (event: "toggleFullscreen"): void;
  (event: "recycleChanged"): void;
  (event: "openBatchEditDialog"): void;
  (event: "executeViewAction", action: any): void;
}>();

const isMobileDevice = isMobile();
const runtime = useRuntime();
const route = useRoute();
const attrs = useAttrs();
const passportState = usePassportStore();
const organizeUtil = inject<any>(ORGANIZE_UTIL);
const nocodeCited = inject(NOCODE, null);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const updateNocodeSign = inject(UPDATE_NOCODE_SIGN, null);
const syncConnection = inject(SYNC_FORM_DATA, null);

const viewMetaStorage = storeFactory(`TABLE_VIEW_META_V2_${props.uid || props.tableUID}`);
const settingStore = useSettingStore();
const { copy } = useClipboard({ legacy: true });
const widget = new Table(props);
let isUnmounted = false;
useFormMutationTaskNotifications({
  nocodeId: () => props.nocodeId,
  tableUID: () => props.tableUID,
  active: () => props.active,
  onSettled: () => widget.refreshData(),
});
const virtualTableRef = ref<InstanceType<typeof NocodeVirtualDataTable> | null>(null);
const lastAppliedPreHiddenColumns = ref<FieldUID[]>([]);
const carouselTimer = ref<number | null>(null);
const carouselDelayTimer = ref<number | null>(null);
const relatedSubTableDialogRef = ref<{ setPreRow: (row: Row) => void } | null>(null);
const pendingRelatedSubTablePreRow = ref<Row | null>(null);
const nocodeBody = ref<NocodeBody | null>(null);
const currentTable = ref<ProjectTable | undefined>(undefined);
const isReady = ref(false);
const isInitialLoading = ref(true);
const isCellEdit = ref(false);
const dataViewDialogVisible = ref(false);
const relatedSubTableDialogVisible = ref(false);
const relatedSubTableDialogInfo = ref<Record<string, any>>({});
const assignOwnerDialogVisible = ref(false);
const batchEditDialogVisible = ref(false);
const assignOwnerDialogRows = ref<Row[] | undefined>(undefined);
const assignOwnerDialogInitialOwnerId = ref<string | undefined>(undefined);
const assignOwnerDialogOnSubmit = ref<TableAssignOwnerDialogOptions["onSubmit"]>();
const actionEditDialogVisible = ref(false);
const actionEditDialogTitle = ref("");
const actionEditVisibleFieldIds = ref<ViewActionFieldId[]>([]);
const actionEditRestoreDetail = ref(false);
const actionEditRestoreUuid = ref("");
const detailTableRefreshPending = ref(false);
const viewActionTriggerPrecheckVisible = ref(false);
const viewActionTriggerPrecheckResult = ref<ViewActionTriggerPrecheckResult | null>(null);
const viewActionTriggerPrecheckAction = ref<ViewAction | null>(null);
const viewActionTriggerPrecheckRequest = ref<ExecuteViewActionRequest | null>(null);
const viewActionTriggerEnqueueKey = ref("");
const viewActionTriggerEnqueueSubmitting = ref(false);
const showCopyDialog = ref(false);
type RelatedDetailDialogPayload = {
  relatedTableUID: OptionTableUID;
  uuid: string;
  row?: Row | null;
  fieldUID?: string;
  sourceContext?: {
    nocodeId: string;
    tableUID?: OptionTableUID;
    formData?: NocodeBody['formData'];
    otherDataSources?: NocodeBody['otherDataSources'];
  };
};

type RelatedDetailDialogState = {
  id: string;
  visible: boolean;
  contentRefreshKey: number;
  title: string;
  nocodeFormProps: {
    nocodeId: string;
    nocodeSign: string;
    tableUID: OptionTableUID;
    uuid: string;
    row: Row | null;
    bootstrapData?: {
      formData: NocodeFormData;
      otherDataSources?: NocodeBody["otherDataSources"];
    };
    permissionContextOverride?: {
      nocodeBody?: NocodeBody;
      getPermissionBody?: (tableId?: string) => Pick<NocodeBody, "permissions"> | NocodeBody | undefined;
    };
    fieldsAuth?: Record<string, FieldAuthValue> | "all";
    relatedDetailHandler?: (payload: RelatedDetailDialogPayload) => void;
  };
  permissions: {
    update: boolean;
    delete: boolean;
  };
};

let baseDetailDialogSeq = 0;
const relatedDetailBodyCache = new Map<string, NocodeBody | null>();
const baseDetailDialogStack = ref<RelatedDetailDialogState[]>([]);
const normalizeClassValue = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeClassValue(item));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([className]) => className);
  }
  return [];
};

const isSearchFormResultTable = computed(() => {
  return normalizeClassValue(attrs.class).includes("search-form-result-table");
});

const stopCarousel = () => {
  if (carouselTimer.value) {
    window.clearInterval(carouselTimer.value);
    carouselTimer.value = null;
  }
  if (carouselDelayTimer.value) {
    window.clearTimeout(carouselDelayTimer.value);
    carouselDelayTimer.value = null;
  }
};

const getCarouselMode = () => props.carouselSettings?.mode || "none";

const getCarouselScroller = () => {
  return virtualTableRef.value?.getInnerTable?.()?.getScroller?.();
};

const getCarouselMaxPage = () => {
  return Math.max(1, Math.ceil((widget.total || 0) / Math.max(1, widget.pageSize || 20)));
};

const resetCarouselScrollTop = () => {
  nextTick(() => {
    getCarouselScroller()?.scrollTo({ top: 0 });
  });
};

const goToNextCarouselPage = () => {
  const maxPage = getCarouselMaxPage();
  widget.currentPage = widget.currentPage >= maxPage ? 1 : widget.currentPage + 1;
  resetCarouselScrollTop();
};

const scheduleNextCarouselPage = (delay = 1500) => {
  if (carouselDelayTimer.value) return;
  carouselDelayTimer.value = window.setTimeout(() => {
    carouselDelayTimer.value = null;
    goToNextCarouselPage();
  }, delay);
};

const getScrollStep = () => {
  switch (props.carouselSettings?.scrollSpeed) {
    case "slow":
      return 1;
    case "fast":
      return 4;
    case "medium":
    default:
      return 2;
  }
};

const startScrollCarousel = () => {
  carouselTimer.value = window.setInterval(() => {
    const scroller = getCarouselScroller();
    if (!scroller) return;
    if (scroller.scrollHeight <= scroller.clientHeight) {
      scheduleNextCarouselPage();
      return;
    }
    const nextTop = scroller.scrollTop + getScrollStep();
    const maxTop = scroller.scrollHeight - scroller.clientHeight;
    if (nextTop >= maxTop) {
      scroller.scrollTo({ top: maxTop });
      scheduleNextCarouselPage();
      return;
    }
    scroller.scrollTo({ top: nextTop });
  }, 80);
};

const startPageCarousel = () => {
  const seconds = Math.max(1, Math.min(60, Math.floor(Number(props.carouselSettings?.pageInterval) || 5)));
  carouselTimer.value = window.setInterval(() => {
    const scroller = getCarouselScroller();
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
      goToNextCarouselPage();
      return;
    }
    const maxTop = scroller.scrollHeight - scroller.clientHeight;
    if (scroller.scrollTop >= maxTop - 1) {
      goToNextCarouselPage();
      return;
    }
    scroller.scrollTo({ top: Math.min(maxTop, scroller.scrollTop + scroller.clientHeight) });
  }, seconds * 1000);
};

const restartCarousel = () => {
  stopCarousel();
  if (isMobileDevice || !isReady.value || props.isAlbum || !widget.rows?.length) return;
  const mode = getCarouselMode();
  if (mode === "scroll") {
    startScrollCarousel();
  } else if (mode === "page") {
    startPageCarousel();
  }
};

const resolvedBodyHeightMode = computed<VirtualTableBodyHeightMode>(() => {
  return props.bodyHeightMode || (isSearchFormResultTable.value ? "content" : "fill");
});
const copyRow = ref<Row | null>(null);
const actionEditNocodeFormProps = ref({
  nocodeId: "",
  tableUID: [] as [string, TableUID] | [],
  uuid: "",
  row: null as Row | null,
  memberFieldsAuth: undefined as undefined | Record<string, FieldAuthValue>,
  fieldsAuth: undefined as undefined | Record<string, FieldAuthValue> | "all",
  viewActionContext: undefined as ExecuteViewActionEditContext | undefined,
  bootstrapData: undefined as undefined | { formData: NocodeFormData },
});
const linkTableInfo = ref({
  tableId: "",
  filterPath: "",
  nocodeId: "",
});

const openAssignOwnerDialog = (options: TableAssignOwnerDialogOptions = {}) => {
  assignOwnerDialogRows.value = options.rows;
  assignOwnerDialogInitialOwnerId.value = options.initialOwnerId;
  assignOwnerDialogOnSubmit.value = options.onSubmit;
  assignOwnerDialogVisible.value = true;
};

const handleHeaderAssignOwnerDialog = () => {
  openAssignOwnerDialog({
    rows: widget.checkboxRow || [],
  });
};

const providedTableProps = reactive({
  ...toRefs(props),
  openAssignOwnerDialog,
}) as TableProps;

provideTable(widget);
provideTableProps(providedTableProps);
provideFormTable(currentTable as any);

const mergeColumnOrders = (
  baseOrders: Record<string, any> = {},
  overrideOrders: Record<string, any> = {},
) => {
  return Object.keys({
    ...baseOrders,
    ...overrideOrders,
  }).reduce<Record<string, Record<string, number>>>((result, key) => {
    result[key] = {
      ...(baseOrders[key] || {}),
      ...(overrideOrders[key] || {}),
    };
    return result;
  }, {});
};

const mergeTableViewMeta = (baseMeta: FormTableViewMeta = {}, overrideMeta: FormTableViewMeta = {}) => {
  return {
    ...baseMeta,
    ...overrideMeta,
    hiddenColumns: Array.from(new Set([
      ...(baseMeta.hiddenColumns || []),
      ...(overrideMeta.hiddenColumns || []),
    ])),
    columnOrders: mergeColumnOrders(baseMeta.columnOrders || {}, overrideMeta.columnOrders || {}),
  };
};

const filterDisplayColumns = (columns: Column[] = [], hiddenSet: Set<FieldUID>) => {
  return columns.reduce<Column[]>((result, column) => {
    if (!column) {
      return result;
    }
    if (!column.subColumns?.length && hiddenSet.has(column.uid as FieldUID)) {
      return result;
    }
    if (column.subColumns?.length) {
      const nextSubColumns = filterDisplayColumns(column.subColumns, hiddenSet);
      if (!nextSubColumns.length) {
        return result;
      }
      result.push({
        ...column,
        subColumns: nextSubColumns,
      });
      return result;
    }
    result.push(column);
    return result;
  }, []);
};

const getInjectedNocodeBody = () => {
  const injectedBody = nocodeCited?.value?.body;
  const injectedNocodeId = nocodeCited?.value?.meta?.id;
  if (!injectedBody?.formData) return null;
  if (injectedNocodeId && props.nocodeId && injectedNocodeId !== props.nocodeId) {
    return null;
  }
  return injectedBody as NocodeBody;
};

const getNocode = async () => {
  const injectedBody = getInjectedNocodeBody();
  if (injectedBody) {
    return injectedBody;
  }
  return await axios.get(`project/get-nocode-body/${props.nocodeId}`).then(({ data }) => data).catch(() => null);
};

const currentNocodeId = computed(() => nocodeCited?.value?.meta?.id);
const isCurrentNocodeTable = computed(() => currentNocodeId.value === props.nocodeId);
const tableNocodeSign = computed(() => {
  return isCurrentNocodeTable.value ? nocodeCited?.value?.body?.sign : nocodeBody.value?.sign;
});

const updateTableNocodeSign = (sign: string) => {
  if (nocodeBody.value) {
    nocodeBody.value.sign = sign;
  }
  if (isCurrentNocodeTable.value) {
    updateNocodeSign?.(sign);
    emit("update-sign", sign);
  }
};

widget.getMainSign = () => tableNocodeSign.value;
widget.setMainSign = (sign: string) => {
  updateTableNocodeSign(sign);
};

const refreshTargetNocodeSign = async () => {
  const latestNocodeBody = await getNocode();
  if (!latestNocodeBody) return;
  if (nocodeBody.value) {
    nocodeBody.value.sign = latestNocodeBody.sign;
  } else {
    nocodeBody.value = latestNocodeBody;
  }
};

const handleUpdateViewMeta = (meta: FormTableViewMeta) => {
  if (props.headerVariant === "recycle") {
    return;
  }
  if (runtime === FormTableRuntime.BOARD_EDITOR) {
    emit("update:tableViewMeta", meta);
  } else if (runtime === FormTableRuntime.FORM_EDITOR) {
    if (isCurrentNocodeTable.value && !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
    axios.post("project/update-nocode-table-view-meta", {
      nocodeId: props.nocodeId,
      tableUID: props.tableUID,
      meta,
    }, {
      headers: tableNocodeSign.value ? {
        "x-sign": tableNocodeSign.value,
      } : undefined,
    }).then(({ headers }) => {
      const mainSign = Array.isArray(headers?.["x-sign"]) ? headers["x-sign"][0] : headers?.["x-sign"];
      if (mainSign) {
        updateTableNocodeSign(mainSign);
      }
    }).catch((error) => {
      if (isCurrentNocodeTable.value) {
        handleNocodeSyncConflictError(error, nocodeSignIsLatest);
      } else {
        console.error(error);
      }
    });
  } else if ([FormTableRuntime.FORM_VIEWER, FormTableRuntime.BOARD_VIEWER].includes(runtime)) {
    viewMetaStorage.set(meta);
  }
};
widget.emitter.on("update-view-meta", handleUpdateViewMeta);

const displayColumns = computed(() => {
  return filterDisplayColumns(widget.allColumns || [], new Set(widget.hiddenColumnIds || []));
});

const currentTablePublish = computed(() => {
  return currentTable.value?.publish || {};
});

const showInternalShareCopyButton = computed(() => {
  return !!currentTablePublish.value?.rowShareEnabled;
});

const showPublicShareCopyButton = computed(() => {
  return !!currentTablePublish.value?.rowShareEnabled;
});

const showShareLinkColumn = computed(() => {
  return !!currentTablePublish.value?.rowShareEnabled;
});

const getRowUUIDValue = (row?: Row | null) => {
  const uuidField = getUUIDSystemField(currentTable.value?.fields || []);
  if (!uuidField?.uid) {
    return "";
  }
  return String(row?.[uuidField.uid] || "").trim();
};

const getShareCopyText = async (row: Row, scope: "internal" | "public") => {
  const rowUUID = getRowUUIDValue(row);
  if (!rowUUID) {
    throw new Error(i18next.t("RowShareLinkDialog.missingRow"));
  }
  const rowShare = await projectApi.createOrGetRowShare({
    nocodeId: props.nocodeId,
    tableUID: props.tableUID,
    rowUUID,
  });
  const shareToken = scope === "internal" ? rowShare.internalToken : rowShare.publicToken;
  if (!shareToken) {
    throw new Error(i18next.t("RowShareLinkDialog.createFailed"));
  }
  const detail = await projectApi.getRowShareAccessDetail({
    token: shareToken,
    scope,
  });
  const shareUrl = `${settingStore.saas.domain}${scope === "internal" ? "/#/view/data/" : "/#/share/data/"}${shareToken}`;
  const needPassword = !!(detail?.publish?.passwordEnabled && detail?.isNeedPassword);
  const password = String(detail?.access?.password || "");
  if (!needPassword || !password) {
    return shareUrl;
  }
  return `${shareUrl}\n${i18next.t("NocodeTable.sharePasswordLabel")}: ${password}`;
};

const copyRowShareLink = async (row: Row, scope: "internal" | "public") => {
  const text = await getShareCopyText(row, scope);
  await copy(text);
  ElMessage.success(i18next.t("NocodePublishPublicPage.copySuccess"));
};

const copyInternalRowShareLink = async (row: Row) => {
  await copyRowShareLink(row, "internal").catch((error: any) => {
    ElMessage.error(error?.response?.data?.message || error?.message || i18next.t("RowShareLinkDialog.createFailed"));
  });
};

const copyPublicRowShareLink = async (row: Row) => {
  await copyRowShareLink(row, "public").catch((error: any) => {
    ElMessage.error(error?.response?.data?.message || error?.message || i18next.t("RowShareLinkDialog.createFailed"));
  });
};

const columnFilterInfo = ref<FormCondition>({
  uid: null,
  func: RuleFunc.EQUAL,
  value: "",
});
const displayState = useDataManagementDisplayState({
  widget,
  props,
  displayColumns,
  rowHeightLevel: computed(() => widget.rowHeightLevel),
  tableWidthData: computed(() => widget.getTableViewMeta("columnWidths") || {}),
  sortFieldsMap: computed(() => widget.sortFieldsMap),
  filterConditions: computed(() => widget.filterRule?.conditions || []),
  columnFilterInfo,
  isFilterValueNotEmpty: computed(() => {
    const value = columnFilterInfo.value?.value;
    if (typeof value === "number" || typeof value === "boolean") return true;
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return !isEmpty(value);
  }),
});

const getSingleRow = (row?: Row | null) => {
  if (!row) {
    return row;
  }

  const nextRow = {
    ...row,
  };
  Object.keys(widget.subTableData || {}).forEach((key) => {
    for (const { fieldUID, relationKey } of widget.subTableFieldUIDs || []) {
      const subRows = widget.subTableData[key]?.rows?.filter((rowItem) => {
        return rowItem?.[relationKey] === nextRow?.[widget.rowKey];
      }) ?? [];
      if (subRows.length > 0) {
        (nextRow as any)[fieldUID] = subRows;
      }
    }
  });
  return nextRow as Row;
};

const normalizeTargetUUIDs = (targetUUIDs: string[] = []) => {
  return [...new Set(targetUUIDs.map((uuid) => String(uuid || "").trim()).filter(Boolean))];
};

const getRecordScopeRow = (row?: Row | null) => {
  if (!row) {
    return undefined;
  }
  return getSingleRow({ ...toRaw(row) }) as Row;
};

const hasActionPermission = (action: ViewAction) => {
  const permission = nocodeCited?.value?.body?.permissions?.operation?.[props.tableUID]?.[action.id];
  const account = passportState.account;
  if (!permission || permission.rangeType !== PermissionRangeType.CUSTOM || account?.isAdmin) {
    return true;
  }
  if (!account) {
    return false;
  }
  const departments = getAllRelatedDepartments(organizeUtil?.departments || [], account?.departments || []);
  return permission.range?.users?.includes(account.id)
    || permission.range?.roles?.some((roleId) => account.roles?.includes(roleId))
    || permission.range?.departments?.some((departmentId) => departments.includes(departmentId));
};

const getRecordActionConditionGroups = (action: ViewAction) => {
  if (action.executeCondition?.scope !== ViewActionConditionScope.RECORD) {
    return [];
  }
  const conditions = action.executeCondition.conditions || [];
  if (!conditions.length) {
    return [];
  }
  return action.executeCondition.mode === ViewActionRecordConditionMode.ANY
    ? conditions.map((condition) => [condition])
    : [conditions];
};

const getRecordActionDisabled = (action: ViewAction, row?: Row) => {
  const actionRow = getRecordScopeRow(row);
  if (!actionRow) {
    return true;
  }
  if (!action.executeCondition?.enabled || action.executeCondition.scope !== ViewActionConditionScope.RECORD) {
    return false;
  }
  if (!widget.table) {
    return true;
  }
  const conditions = getRecordActionConditionGroups(action);
  if (!conditions.length) {
    return false;
  }
  return !isMeetConditionsByRow(
    actionRow,
    conditions,
    { [props.tableUID]: [actionRow] },
    widget.table.fields,
  )?.valid;
};

const checkboxRowSeqMap = computed(() => {
  const map = new Map<string, number>();
  (widget.checkboxRow || []).forEach((row, index) => {
    const uuid = row?.[widget.rowKey];
    if (uuid !== undefined && uuid !== null) {
      map.set(String(uuid), index + 1);
    }
  });
  return map;
});

const viewActions = useDataManagementViewActions({
  actions: computed(() => props.actions || []),
  isMobileDevice,
  isAlbum: Boolean(props.isAlbum),
  hasActionPermission,
  getActionDisabled: getRecordActionDisabled,
  rowIndexByUuid: checkboxRowSeqMap,
});

const getRelatedDetailBodyData = (payload?: RelatedDetailDialogPayload) => {
  if (payload?.sourceContext?.formData || payload?.sourceContext?.otherDataSources?.length) {
    return {
      formData: payload.sourceContext.formData,
      otherDataSources: payload.sourceContext.otherDataSources || [],
    };
  }
  return {
    formData: nocodeBody.value?.formData,
    otherDataSources: nocodeBody.value?.otherDataSources || [],
  };
};

const getTargetTable = (tableUID: TableUID, payload?: RelatedDetailDialogPayload) => {
  const bodyData = getRelatedDetailBodyData(payload);
  const currentTables = bodyData.formData?.tables || [];
  const otherTables = (bodyData.otherDataSources || []).flatMap((source) => source.tables || []);
  return [...currentTables, ...otherTables].find((table) => table.uid === tableUID);
};

const loadRelatedDetailPermissionBody = async (nocodeId?: string) => {
  if (!nocodeId) {
    return null;
  }
  if (nocodeId === props.nocodeId) {
    return nocodeBody.value;
  }
  if (relatedDetailBodyCache.has(nocodeId)) {
    return relatedDetailBodyCache.get(nocodeId) || null;
  }
  const body = await projectApi.getNocodeBody(nocodeId).catch(() => null);
  relatedDetailBodyCache.set(nocodeId, body);
  return body;
};

const getRelatedDetailPermissionSource = (
  tableUID: TableUID,
  permissionBody?: NocodeBody | null,
  payload?: RelatedDetailDialogPayload,
) => {
  const bodyData = permissionBody || nocodeBody.value;
  const targetDataSource = (bodyData?.otherDataSources || []).find((source) => {
    return (source.tables || []).some((table) => table.uid === tableUID);
  });
  if (targetDataSource && (targetDataSource as any)?.permissions) {
    return { permissions: (targetDataSource as any)?.permissions } as Pick<NocodeBody, "permissions">;
  }
  if (permissionBody?.permissions) {
    return permissionBody;
  }
  const fallbackSource = (payload?.sourceContext?.otherDataSources || []).find((source) => {
    return (source.tables || []).some((table) => table.uid === tableUID);
  });
  return fallbackSource
    ? ({ permissions: (fallbackSource as any)?.permissions } as Pick<NocodeBody, "permissions">)
    : bodyData;
};

const canReadRelatedDetail = async (tableUID: TableUID, payload?: RelatedDetailDialogPayload) => {
  const targetTable = getTargetTable(tableUID, payload);
  if (!targetTable?.uid) {
    return false;
  }
  const permissionBody = await loadRelatedDetailPermissionBody(payload?.sourceContext?.nocodeId);
  return canReadNocodeTableDataByBody(
    getRelatedDetailPermissionSource(tableUID, permissionBody, payload) as NocodeBody,
    targetTable.uid,
    organizeUtil?.departments || [],
    undefined,
    isPublicDataPermissionBypassedRoute(route),
  );
};

const getRelatedDetailPermission = async (tableUID: TableUID, payload?: RelatedDetailDialogPayload) => {
  if (isPublicDataPermissionBypassedRoute(route)) {
    return { delete: false, update: false };
  }
  const targetTable = getTargetTable(tableUID, payload);
  if (!targetTable?.uid) {
    return { delete: false, update: false };
  }
  const account = passportState.account;
  if (account?.isAdmin) {
    return { delete: true, update: true };
  }
  const permissionBody = await loadRelatedDetailPermissionBody(payload?.sourceContext?.nocodeId);
  const permissionsSource = getRelatedDetailPermissionSource(tableUID, permissionBody, payload);
  const permissions = permissionsSource?.permissions?.data?.[targetTable.uid]?.other ?? [];
  if (isEmpty(permissions)) {
    return { delete: true, update: true };
  }

  const result = {
    delete: false,
    update: false,
  };
  const departments = getAllRelatedDepartments(organizeUtil?.departments || [], account?.departments || []);
  for (const permission of permissions) {
    const needHandle = (permission.handleRange.delete && !result.delete) || (permission.handleRange.update && !result.update);
    if (!needHandle) continue;
    if (
      permission.memberRange?.rangeType === "all"
      || permission.memberRange?.range?.users?.includes(account?.id)
      || permission.memberRange?.range?.roles?.some((role) => account?.roles?.includes(role))
      || permission.memberRange?.range?.departments?.some((departmentId) => departments.includes(departmentId))
    ) {
      result.delete = result.delete || permission.handleRange?.delete;
      result.update = result.update || permission.handleRange?.update;
    }
    if (result.delete && result.update) {
      break;
    }
  }
  return result;
};

const loadRelatedDetailFormContext = async (nocodeId: string, tableUID: TableUID, uuid: string) => {
  return await axios.get("nocode/read-form-data", {
    params: {
      nocodeId,
      tableId: tableUID,
      uuid,
    },
  }).then(({ data }) => data as {
    formData?: NocodeFormData;
    otherDataSources?: NocodeBody["otherDataSources"];
    row?: Row | null;
    fieldsAuth?: Record<string, FieldAuthValue> | "all";
  }).catch(() => null);
};

const loadRelatedDetailNocodeSign = async (nocodeId: string) => {
  return await axios.post("project/get-nocode-sign", {
    nocodeId,
  }).then(({ data }) => {
    return data?.sign || "";
  }).catch(() => "");
};

const resolveRelatedDetailTitle = (tableUID: TableUID, payload?: RelatedDetailDialogPayload) => {
  const targetTable = getTargetTable(tableUID, payload);
  return targetTable?.alias || targetTable?.meta?.name || i18next.t("formFieldTypes.relatedData");
};

const dialogs = useDataManagementDialogs({
  nocodeId: props.nocodeId,
  widget,
  getNocodeSign: () => tableNocodeSign.value || "",
  getCurrentFormDataUID: () => nocodeBody.value?.formData?.uid || "",
  getRelatedDetailHandler: () => openRelatedDetailDialog,
  getBootstrapDataForTable: (tableUID) => {
    if (tableUID !== props.tableUID) {
      return undefined;
    }
    const body = nocodeBody.value;
    const formData = body?.formData;
    if (!formData?.tables?.some((table) => table.uid === tableUID)) {
      return undefined;
    }
    return {
      formData,
      otherDataSources: body.otherDataSources || [],
      otherDataSourceSchemas: body.otherDataSourceSchemas || [],
      settings: body.settings,
      fieldsAuth: widget.fieldsAuth,
    };
  },
});

const controller = createDataManagementTableController({
  widget,
  isShowCheck: Boolean(props.isShowCheck),
  isMultiple: props.isMultiple,
  clickRowChecked: Boolean(props.clickRowChecked),
  clickRowShowDetail: Boolean(props.clickRowShowDetail),
  rowDetailTrigger: props.rowDetailTrigger,
  isMobileDevice,
  onRowActivate: ({ row, rowKey }) => {
    dialogs.openDetail(row, rowKey, props.tableUID, FormMode.Edit);
    emit("openDialog");
  },
});

const { resolveInstance, getInstance: getResolvedInstance } = useFilterElementResolver((elementId) => {
  return elementId ? widget.getInstanceById(elementId) : undefined;
});

const getFilterInstance = (column: Column, parentColumn?: Column) => {
  return getResolvedInstance(createColumnFilterTarget(column, parentColumn));
};

const getHeaderFilterMenus = (column: Column, parentColumn?: Column) => {
  const target = createColumnFilterTarget(column, parentColumn);
  const funcInfo = getFilterFuncInfo(target, getFilterInstance(column, parentColumn));
  return Object.entries(funcInfo).map(([key], index) => ({
    title: RuleFuncTextMapping[key as RuleFunc],
    click: () => {
      columnFilterInfo.value.func = key as RuleFunc;
    },
    index,
  }));
};

const getHeaderFilterInstance = (column: Column, parentColumn?: Column) => {
  return getFilterInstance(column, parentColumn);
};

const getHeaderFilterValueType = (func: RuleFunc, column: Column, parentColumn?: Column) => {
  const target = createColumnFilterTarget(column, parentColumn);
  return getFilterFuncValue(target, func, getFilterInstance(column, parentColumn));
};

const shouldShowHeaderFilterValue = (condition: FormCondition) => {
  return isFilterValueVisible(condition.func);
};

const activeFilterContext = ref<{ column: Column; parentColumn?: Column } | null>(null);
const hasFilterValue = (value: any): boolean => {
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0 && value.some((item) => hasFilterValue(item));
  return !isEmpty(value);
};

const clearFilterValue = () => {
  if (!activeFilterContext.value) {
    columnFilterInfo.value.value = "";
    return;
  }
  const { column, parentColumn } = activeFilterContext.value;
  const filterType = getHeaderFilterValueType(columnFilterInfo.value.func as RuleFunc, column, parentColumn);
  columnFilterInfo.value.value = getFilterDefaultValue(filterType);
};

const handleHeaderFilterMenuOpen = async ({ column, parentColumn }: { column: Column; parentColumn?: Column }) => {
  const target = createColumnFilterTarget(column, parentColumn);
  activeFilterContext.value = { column, parentColumn };
  await widget.ensureFormReady();
  await resolveInstance(target);
  const uid = target.key;
  const condition = displayState.filterConditions.value.find((cond) => cond.uid === uid);
  const funcs = getFilterFuncInfo(target, getFilterInstance(column, parentColumn));
  if (condition) {
    Object.assign(columnFilterInfo.value, deepClone(condition));
  } else {
    columnFilterInfo.value.uid = uid;
    columnFilterInfo.value.func = (Object.keys(funcs)[0] as RuleFunc) || RuleFunc.EQUAL;
    columnFilterInfo.value.value = "";
  }
};

const handleHeaderFilterMenuClose = ({ column, parentColumn }: { column: Column; parentColumn?: Column }) => {
  const target = createColumnFilterTarget(column, parentColumn);
  const uid = target.key;
  if (columnFilterInfo.value.uid !== uid) return;
  const condition = displayState.filterConditions.value.find((cond) => cond.uid === uid);
  const funcs = getFilterFuncInfo(target, getFilterInstance(column, parentColumn));
  if (equals(condition, columnFilterInfo.value)) return;
  const nextRule = deepClone(widget.filterRule || {
    logic: LogicalOperator.AND,
    conditions: [],
  }) as FilterRule;
  const conditionIndex = nextRule.conditions.findIndex((cond) => cond.uid === uid);
  if (shouldShowHeaderFilterValue(columnFilterInfo.value) && !hasFilterValue(columnFilterInfo.value.value)) {
    if (conditionIndex > -1) {
      nextRule.conditions.splice(conditionIndex, 1);
      widget.filterRule = nextRule;
      widget.refreshData();
    }
    return;
  }
  if (!condition) {
    if (
      columnFilterInfo.value.value === ""
      && (columnFilterInfo.value.func === (Object.keys(funcs)[0] as RuleFunc) || columnFilterInfo.value.func === RuleFunc.EQUAL)
    ) {
      return;
    }
    nextRule.conditions.push(deepClone(columnFilterInfo.value));
  } else if (conditionIndex > -1) {
    Object.assign(nextRule.conditions[conditionIndex], deepClone(columnFilterInfo.value));
  }
  widget.filterRule = nextRule;
  widget.refreshData();
};

const loading = computed(() => {
  return !isReady.value || widget.isRefreshing.value || widget.isApplyingDisplaySettings;
});

const clearDisplaySettingApplying = () => {
  if (widget.isApplyingDisplaySettings) {
    widget.setDisplaySettingApplying(false);
  }
};

const tableFormName = computed(() => {
  const tableUID = dialogs.detailTableUID.value || props.tableUID;
  const table = widget.getTable(tableUID);
  return table?.alias || table?.meta?.name || "";
});

const currentDetailActionRow = computed(() => {
  return resolveDataManagementDetailActionRow({
    detailVisible: dialogs.detailVisible.value,
    detailFormMode: dialogs.detailFormMode.value as typeof DATA_MANAGEMENT_FORM_MODE[keyof typeof DATA_MANAGEMENT_FORM_MODE],
    detailTableUID: dialogs.detailTableUID.value,
    tableUID: props.tableUID,
    detailRow: dialogs.detailRow.value || null,
    selectedRow: widget.selectedRow || null,
  });
});

const currentDetailActionItems = computed(() => {
  if (dialogs.detailFormMode.value !== FormMode.Edit || dialogs.detailTableUID.value !== props.tableUID) {
    return [];
  }
  return viewActions.detailActionItems(currentDetailActionRow.value || undefined);
});

const copyProcessTableUID = computed<OptionTableUID | null>(() => {
  const formUID = nocodeBody.value?.formData?.uid;
  if (!formUID) {
    return null;
  }
  return [formUID, props.tableUID];
});

const getDetailDialogLoadingTarget = () => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLElement>(".data-form-dialog .table-form-dialog .el-dialog__body")
    || document.querySelector<HTMLElement>(".data-form-drawer .table-form-drawer .el-drawer__body")
    || null;
};

const flushPendingDetailTableRefresh = () => {
  if (!detailTableRefreshPending.value) {
    return;
  }
  detailTableRefreshPending.value = false;
  widget.refreshData();
};

const tableActionColumnWidth = computed(() => {
  const actionCount = viewActions.tableActionItems.value.length;
  if (!actionCount) {
    return 140;
  }
  const visibleCount = Math.min(actionCount, 3);
  const estimatedWidth = 76 * visibleCount + 8 * Math.max(visibleCount - 1, 0) + 32;
  return Math.min(140 + 76 * 2, Math.max(140, estimatedWidth));
});

const isViewTriggerProcessAction = (action: ViewAction) => (
  isViewActionViewTarget(action.target)
  && action.behavior.type === ViewActionBehaviorType.TRIGGER_PROCESS
);

const isEachRecordViewTriggerProcessAction = (action: ViewAction) => (
  isViewTriggerProcessAction(action)
  && getViewActionTriggerMode(action) === ViewActionTriggerMode.EACH_RECORD
);

const isViewContextOnceTriggerProcessAction = (action: ViewAction) => (
  isViewTriggerProcessAction(action)
  && getViewActionTriggerMode(action) === ViewActionTriggerMode.VIEW_CONTEXT_ONCE
);

const getTriggerProcessSuccessCount = (result: ExecuteViewActionResult) => {
  return result.executionMode === "view_once"
    ? (result.triggeredCount || 0)
    : (result.affectedCount || 0);
};

const resolveCurrentTableDetailRow = (uuid?: string | number, row?: Row | null) => {
  return resolveDataManagementCurrentDetailRow({
    explicitRow: row,
    uuid,
    selectedRow: widget.selectedRow,
    visibleRows: (widget.showRows || []) as Row[],
    allRows: (widget.rows || []) as Row[],
    rowKey: widget.rowKey,
    normalizeRow: (sourceRow) => getRecordScopeRow(sourceRow) || null,
  });
};

const buildExecuteViewActionRequest = async (
  action: ViewAction,
  actionRow?: Row,
  options: ExecuteViewActionOptions = {},
): Promise<ExecuteViewActionRequest> => {
  const selectedTargetUUIDs = isViewActionSelectedTarget(action.target)
    ? normalizeTargetUUIDs((widget.checkboxRow || []).map((item) => item?.[widget.rowKey]))
    : [];
  const targetUUIDs = normalizeTargetUUIDs(options.targetUUIDs?.length ? options.targetUUIDs : selectedTargetUUIDs);
  const hasTargetUUIDs = targetUUIDs.length > 0;
  const isSingleRecordExecution = isViewActionRecordTarget(action.target) || hasTargetUUIDs || !!actionRow?.[widget.rowKey];
  const shouldIncludeRuntimeViewContext = isViewActionViewTarget(action.target) && !isSingleRecordExecution;
  const displayFilters = shouldIncludeRuntimeViewContext
    ? (options.filters ? deepClone(options.filters) : await widget.getDisplayFilters())
    : undefined;

  return {
    nocodeId: props.nocodeId,
    tableUID: props.tableUID,
    viewId: props.viewId as string,
    actionId: action.id,
    uuid: actionRow?.[widget.rowKey],
    targetUUIDs: hasTargetUUIDs ? targetUUIDs : undefined,
    filterRule: shouldIncludeRuntimeViewContext ? deepClone(widget.filterRule) : undefined,
    searchValue: shouldIncludeRuntimeViewContext ? deepClone(widget.searchValue || []) : undefined,
    filters: displayFilters,
  };
};

const requestExecuteViewAction = async (
  request: ExecuteViewActionRequest,
): Promise<ExecuteViewActionResult> => {
  const response = await formDataApi.executeViewAction({
    ...request,
    sign: tableNocodeSign.value || "",
    onMainSign: (sign: string) => updateTableNocodeSign(sign),
  });
  return response.data;
};

const resetViewActionTriggerPrecheck = () => {
  viewActionTriggerPrecheckResult.value = null;
  viewActionTriggerPrecheckAction.value = null;
  viewActionTriggerPrecheckRequest.value = null;
  viewActionTriggerEnqueueKey.value = "";
};

const cancelViewActionTriggerPrecheck = () => {
  viewActionTriggerPrecheckVisible.value = false;
  resetViewActionTriggerPrecheck();
};

const openViewActionTriggerPrecheck = (
  action: ViewAction,
  request: ExecuteViewActionRequest,
  result: ViewActionTriggerPrecheckResult,
) => {
  viewActionTriggerPrecheckAction.value = action;
  viewActionTriggerPrecheckRequest.value = request;
  viewActionTriggerPrecheckResult.value = result;
  viewActionTriggerEnqueueKey.value = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  viewActionTriggerPrecheckVisible.value = true;
};

const confirmViewActionTriggerEnqueue = async () => {
  if (viewActionTriggerEnqueueSubmitting.value) {
    return;
  }
  const request = viewActionTriggerPrecheckRequest.value;
  const precheck = viewActionTriggerPrecheckResult.value;
  const idempotencyKey = viewActionTriggerEnqueueKey.value;
  if (!request || !precheck || !idempotencyKey) {
    return;
  }

  const targetUUIDs = normalizeTargetUUIDs(
    precheck.items.filter(item => item.executable).map(item => item.uuid),
  );
  if (!targetUUIDs.length) {
    ElMessage.warning(i18next.t("NocodeTable.viewActionNoExecutableData"));
    cancelViewActionTriggerPrecheck();
    return;
  }

  viewActionTriggerEnqueueSubmitting.value = true;
  const loadingInstance = ElLoading.service({
    target: ".nocode-data-management-table",
    text: i18next.t("NocodeTable.actionExecuting"),
    background: "rgba(0, 0, 0, 0.15)",
  });
  try {
    const result = await formDataApi.enqueueViewActionTrigger({
      ...request,
      targetUUIDs,
      idempotencyKey,
      sign: tableNocodeSign.value || "",
      onMainSign: (sign: string) => updateTableNocodeSign(sign),
    });
    viewActionTriggerPrecheckVisible.value = false;
    if (result.acceptedCount > 0) {
      ElMessage.success(i18next.t("NocodeTable.viewActionTriggerEnqueueSuccess", {
        count: result.acceptedCount,
      }));
    }
    if (result.blockedCount > 0) {
      ElMessage.warning(i18next.t("NocodeTable.viewActionTriggerEnqueuePartial", {
        count: result.blockedCount,
      }));
    }
    await widget.refreshData();
  } catch (error: any) {
    ElMessage.error(error?.message || i18next.t("NocodeTable.viewActionExecuteFailed"));
  } finally {
    loadingInstance.close();
    viewActionTriggerEnqueueSubmitting.value = false;
  }
};

const buildDetailRowSnapshot = (row?: Row | null) => {
  if (!row) {
    return null;
  }
  return getRecordScopeRow(row);
};

const hasDetailRowChanged = (currentRow?: Row | null, latestRow?: Row | null) => {
  return !equals(buildDetailRowSnapshot(currentRow), buildDetailRowSnapshot(latestRow));
};

const refreshDetailDialogContent = async (uuid?: string) => {
  if (!uuid) {
    return {
      refreshed: false,
      changed: false,
    };
  }

  const latestRow = await formDataApi.findOne({
    nocodeId: props.nocodeId,
    tableUID: props.tableUID,
    uuid,
  });
  if (!latestRow) {
    return {
      refreshed: false,
      changed: false,
    };
  }

  const changed = hasDetailRowChanged(dialogs.detailRow.value, latestRow);
  widget.patchLocalRow(latestRow);
  widget.setSelectedRow(latestRow);
  dialogs.syncDetailRow(latestRow, uuid);
  if (changed) {
    dialogs.refreshDetailContent();
  }
  return {
    refreshed: true,
    changed,
  };
};

const openCopyDialog = (row: Row) => {
  const currentTableRef = widget.table ?? widget.getTable(widget.formTableUID);
  copyRow.value = currentTableRef && widget.formData
    ? sanitizeCopiedRowForCopy({
        row,
        table: currentTableRef,
        formData: widget.formData,
      })
    : row;
  showCopyDialog.value = true;
};

const handleCopy = () => {
  showCopyDialog.value = false;
  widget.refreshData();
};

const handleCopyDraftSaved = async () => {
  await refreshTargetNocodeSign();
  emit("draft-saved");
};

const resetActionEditDialogState = () => {
  actionEditDialogTitle.value = "";
  actionEditVisibleFieldIds.value = [];
  actionEditRestoreDetail.value = false;
  actionEditRestoreUuid.value = "";
  actionEditNocodeFormProps.value = {
    nocodeId: "",
    tableUID: [],
    uuid: "",
    row: null,
    memberFieldsAuth: undefined,
    fieldsAuth: undefined,
    viewActionContext: undefined,
    bootstrapData: undefined,
  };
};

const loadActionEditFormContext = async (uuid?: string) => {
  if (!uuid) {
    throw new Error(i18next.t("NocodeTable.missingCurrentRecordId"));
  }

  return await axios.get("nocode/read-form-data", {
    params: {
      nocodeId: props.nocodeId,
      tableId: props.tableUID,
      uuid,
    },
  }).then(({ data }) => data as {
    formData: NocodeFormData;
    fieldsAuth?: Record<string, FieldAuthValue> | "all";
    row?: Row;
  });
};

const showActionEditDialog = (
  action: ViewAction,
  row: Row | undefined,
  options: {
    prepareRow: Row;
    visibleFieldIds: ViewActionFieldId[];
    bootstrapData?: { formData: NocodeFormData };
    memberFieldsAuth?: Record<string, FieldAuthValue>;
    viewActionContext?: ExecuteViewActionEditContext;
  },
) => {
  if (!nocodeBody.value?.formData?.uid) {
    return;
  }
  actionEditDialogTitle.value = action.display?.label || action.name || i18next.t("NocodeTable.viewActionEditDialogTitle");
  actionEditVisibleFieldIds.value = options.visibleFieldIds || [];
  actionEditRestoreDetail.value = dialogs.detailVisible.value;
  actionEditRestoreUuid.value = String(row?.[widget.rowKey] || "");
  actionEditNocodeFormProps.value = {
    nocodeId: props.nocodeId,
    tableUID: [nocodeBody.value.formData.uid, props.tableUID],
    uuid: row?.[widget.rowKey] || "",
    row: options.prepareRow,
    memberFieldsAuth: options.memberFieldsAuth,
    fieldsAuth: "all",
    viewActionContext: options.viewActionContext,
    bootstrapData: options.bootstrapData,
  };
  actionEditDialogVisible.value = true;
};

const handleActionEditSubmitted = async () => {
  const shouldRestoreDetail = actionEditRestoreDetail.value && !!actionEditRestoreUuid.value;
  const restoreUuid = actionEditRestoreUuid.value;
  actionEditDialogVisible.value = false;

  if (syncConnection && nocodeBody.value?.formData) {
    await syncConnection(nocodeBody.value.formData);
  }
  widget.refreshData();
  emit("submitted", FormMode.Edit);
  resetActionEditDialogState();

  if (!shouldRestoreDetail) {
    return;
  }

  dialogs.closeDetail();
  await nextTick();
  showFormRowDialog(FormMode.Edit, restoreUuid);
};

const handleAlbumCardClick = (row: Row) => {
  dialogs.openDetail(row, row?.[widget.rowKey], props.tableUID, FormMode.Edit);
  emit("openDialog");
};

const handleRowActivate = (payload: { row: Row; column: Column; syncSelectedRow: boolean }) => {
  controller.handleRowActivate(payload);
};

const handleCurrentPageChange = (pageNumber: number) => {
  widget.setCheckboxRow([]);
  widget.currentPage = pageNumber;
};

const handlePageSizeChange = (pageSize: number) => {
  widget.setCheckboxRow([]);
  widget.pageSize = pageSize;
  widget.setTableViewMeta("pageSize", pageSize);
};

const handleChangeRowHeight = (rowHeightLevel: FormTableRowHeight) => {
  widget.rowHeightLevel = rowHeightLevel;
};

const canUpdateColumnData = (column: Column) => {
  return Boolean(props.updateColumnDataAble && column);
};

const getDefaultFixedColumnId = () => {
  const count = Math.max(0, Math.min(4, Math.floor(Number(props.fixedColumnCount) || 0)));
  if (count <= 0) {
    return null;
  }
  return displayColumns.value[count - 1]?.uid || null;
};

const getManualFixedColumnId = () => {
  return widget.hasFixedColumnIdSetting ? widget.fixedColumnId : null;
};

const getEffectiveFixedColumnId = () => {
  return getManualFixedColumnId() ?? getDefaultFixedColumnId();
};

const switchColumnFreeze = (uid: FieldUID) => {
  widget.fixedColumnId = getEffectiveFixedColumnId() === uid ? null : uid;
};

const handleHiddenColumn = (column: Column) => {
  const hiddenIds = new Set(widget.hiddenColumnIds || []);
  if (column.subColumns?.length) {
    hiddenIds.add(column.uid);
    column.subColumns.forEach((subColumn) => hiddenIds.add(subColumn.uid));
    widget.hiddenColumnIds = Array.from(hiddenIds);
    return;
  }

  hiddenIds.add(column.uid);
  const parentColumn = widget.allColumns.find((group) => group.subColumns?.some((sub) => sub.uid === column.uid));
  if (parentColumn?.subColumns?.every((subColumn) => hiddenIds.has(subColumn.uid))) {
    hiddenIds.add(parentColumn.uid);
  }
  widget.hiddenColumnIds = Array.from(hiddenIds);
};

const handleHeaderSort = (uid: FieldUID, orderValue: 1 | -1) => {
  if (widget.sortFieldsMap[uid] === orderValue) {
    widget.sortFields = widget.sortFields.filter((item) => item.field !== uid);
  } else {
    const sortFields = [...widget.sortFields];
    const sortField = sortFields.find((item) => item.field === uid);
    if (sortField) {
      sortField.value = orderValue;
    } else {
      sortFields.push({
        field: uid,
        value: orderValue,
      });
    }
    widget.sortFields = sortFields;
  }
  widget.refreshData();
};

const resolveUpdateField = (column: Column) => {
  if (!column.isSubColumn) {
    return widget.table?.fields?.find((field) => field.uid === column.uid);
  }
  const parentField = widget.table?.fields?.find((field) => field.uid === column.parentUID);
  const subTableUID = parentField?.meta?.extra?.subTableUID?.[1];
  const subTable = widget.getTable(subTableUID);
  const subField = subTable?.fields?.find((field) => field.uid === column.uid);
  if (!subField) return undefined;
  return {
    ...subField,
    uid: `${column.parentUID}.${column.uid}`,
  };
};

const handleUpdateColumnData = async (column: Column) => {
  const updateField = resolveUpdateField(column);
  if (!updateField || !widget.formTableUID) return;
  if (isCurrentNocodeTable.value && !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  try {
    await formDataApi.recalculateTableField({
      nocodeId: widget.nocodeId,
      tableUID: widget.formTableUID,
      fieldUID: updateField.uid as FieldUID,
    });
    ElMessage.success(i18next.t("NocodeDataManagementTable.updateSuccess"));
    widget.refreshData();
  } catch (error) {
    handleNocodeSyncConflictError(error, nocodeSignIsLatest);
    throw error;
  }
};

const handleVirtualHeaderAction = ({ actionKey, column }: HeaderActionPayload) => {
  switch (actionKey) {
    case "sort-asc":
      handleHeaderSort(column.uid, 1);
      return;
    case "sort-desc":
      handleHeaderSort(column.uid, -1);
      return;
    case "freeze":
    case "unfreeze":
      switchColumnFreeze(column.uid);
      return;
    case "hide":
      handleHiddenColumn(column);
      return;
    case "update-data":
      void handleUpdateColumnData(column);
      return;
    default:
      return;
  }
};

const handleVirtualColumnWidthChange = ({ column, width }: { column: Column; width: number }) => {
  if (!column?.uid || !Number.isFinite(width) || width <= 0) {
    return;
  }
  widget.setTableViewMeta("columnWidths", {
    ...(displayState.tableWidthData.value || {}),
    [column.uid]: width,
  });
  widget.refreshData();
};

const showFormRowDialog = (
  mode: FormMode,
  uuid?: string,
  tableUID: TableUID | OptionTableUID = props.tableUID,
  options: {
    row?: Row | null;
    startInEdit?: boolean;
  } = {},
) => {
  const isPublicVisit = isPublicDataPermissionBypassedRoute(route);
  if (isPublicVisit) {
    ElMessage.error(i18next.t('NocodeDataManagementTable.detailNoPermission'));
    return;
  }
  const row = options.row || (uuid ? widget.rows.find((item) => item?.[widget.rowKey] === uuid) as Row : null);
  const resolvedRow = tableUID === props.tableUID
    ? resolveCurrentTableDetailRow(uuid || row?.[widget.rowKey], row || null)
    : (row || null);
  dialogs.openDetail(resolvedRow, uuid || row?.[widget.rowKey], tableUID, mode, options.startInEdit);
  if (options.row) {
    widget.setSelectedRow(options.row);
  }
  emit("openDialog");
};

const syncAfterDataMutation = async (submitType?: FormMode) => {
  if (syncConnection && nocodeBody.value?.formData) {
    await syncConnection(nocodeBody.value.formData);
  }
  await refreshTargetNocodeSign();
  await widget.refreshData();
  emit("submitted", submitType);
};

const handleImportCompleted = async () => {
  await syncAfterDataMutation();
};

const handleDetailSubmitted = async (submitType: FormMode, submitContinuous: boolean) => {
  if (!submitContinuous) {
    dialogs.closeDetail();
  }
  await syncAfterDataMutation(submitType);
};

const handleMobileDetailSubmitted = async () => {
  dialogs.closeDetail();
  await syncAfterDataMutation(FormMode.Edit);
};

const handleDetailFlowFinished = async (uuid: string) => {
  dialogs.refreshDetailProcess();
  const refreshed = await refreshDetailDialogContent(uuid);
  if (!refreshed.refreshed) {
    dialogs.closeDetail();
  }
  await syncAfterDataMutation(FormMode.Edit);
};

const handleDetailDeleted = async () => {
  dialogs.closeDetail();
  await syncAfterDataMutation(FormMode.Edit);
};

const handleMobileDetailDeleted = async () => {
  dialogs.closeDetail();
  await syncAfterDataMutation(FormMode.Edit);
};

const closeBaseDetailDialogsFromIndex = (index: number) => {
  if (index < 0 || index >= baseDetailDialogStack.value.length) {
    return;
  }
  baseDetailDialogStack.value.splice(index);
  if (!baseDetailDialogStack.value.length && !dialogs.detailVisible.value) {
    emit("closeDialog");
  }
};

const handleBaseDetailModelValueChange = (index: number, value: boolean) => {
  if (value) {
    const target = baseDetailDialogStack.value[index];
    if (target) {
      target.visible = true;
    }
    return;
  }
  closeBaseDetailDialogsFromIndex(index);
};

const refreshBaseDetailDialogAtIndex = async (index: number) => {
  const target = baseDetailDialogStack.value[index];
  if (!target) {
    return;
  }
  const previousBootstrapData = target.nocodeFormProps.bootstrapData;
  const permissions = await getRelatedDetailPermission(target.nocodeFormProps.tableUID?.[1], {
    relatedTableUID: target.nocodeFormProps.tableUID,
    uuid: target.nocodeFormProps.uuid,
    row: target.nocodeFormProps.row,
    sourceContext: {
      nocodeId: target.nocodeFormProps.nocodeId,
      tableUID: target.nocodeFormProps.tableUID,
      formData: previousBootstrapData?.formData,
      otherDataSources: previousBootstrapData?.otherDataSources || [],
    },
  });
  target.nocodeFormProps = {
    ...target.nocodeFormProps,
    nocodeSign: "",
    row: null,
    bootstrapData: undefined,
    fieldsAuth: undefined,
  };
  target.permissions = permissions;
  target.contentRefreshKey += 1;
};

const handleBaseDetailSubmitted = async (index: number) => {
  const parentIndex = index - 1;
  closeBaseDetailDialogsFromIndex(index);
  await syncAfterDataMutation(FormMode.Edit);
  if (parentIndex >= 0) {
    await refreshBaseDetailDialogAtIndex(parentIndex);
  }
  if (dialogs.detailVisible.value && dialogs.detailTableUID.value === props.tableUID) {
    await refreshDetailDialogContent(dialogs.detailRowKey.value);
  }
};

const handleBaseDetailDeleted = async (index: number) => {
  const parentIndex = index - 1;
  closeBaseDetailDialogsFromIndex(index);
  await syncAfterDataMutation(FormMode.Edit);
  if (parentIndex >= 0) {
    await refreshBaseDetailDialogAtIndex(parentIndex);
  }
  if (dialogs.detailVisible.value && dialogs.detailTableUID.value === props.tableUID) {
    await refreshDetailDialogContent(dialogs.detailRowKey.value);
  }
};

const handleDraftSaved = async () => {
  await refreshTargetNocodeSign();
  dialogs.closeDetail();
  emit("draft-saved");
};

const handleExecuteViewAction = async (
  action: ViewAction,
  row?: Row,
  options: ExecuteViewActionOptions = {},
) => {
  emit("executeViewAction", action);
  if (!props.viewId) {
    ElMessage.error(i18next.t("NocodeTable.viewNotFound"));
    return;
  }
  if (isViewActionSelectedTarget(action.target) && normalizeTargetUUIDs(options.targetUUIDs).length <= 0 && !(widget.checkboxRow || []).length) {
    ElMessage.warning(i18next.t("NocodeTable.viewActionSelectDataFirst"));
    return;
  }

  const actionRow = isViewActionRecordTarget(action.target)
    ? getRecordScopeRow(row)
    : row;
  if (actionRow) {
    widget.setSelectedRow(actionRow);
  }

  const shouldRefreshDetailDialog = shouldRefreshDataManagementDetailAfterViewAction({
    action,
    actionRowUUID: actionRow?.[widget.rowKey],
    detailVisible: dialogs.detailVisible.value,
    detailFormMode: dialogs.detailFormMode.value,
    detailTableUID: dialogs.detailTableUID.value,
    detailRowKey: dialogs.detailRowKey.value,
    tableUID: props.tableUID,
  });

  const loadingTarget: string | HTMLElement = shouldRefreshDetailDialog
    ? (getDetailDialogLoadingTarget() || ".nocode-data-management-table")
    : ".nocode-data-management-table";

  let loadingInstance = ElLoading.service({
    target: loadingTarget,
    text: i18next.t("NocodeTable.actionExecuting"),
    background: "rgba(0, 0, 0, 0.15)",
  });
  let loadingClosed = false;
  const closeLoading = () => {
    if (!loadingClosed) {
      loadingClosed = true;
      loadingInstance.close();
    }
  };

  try {
    const request = await buildExecuteViewActionRequest(action, actionRow, options);
    let result: ExecuteViewActionResult;

    if (isViewTriggerProcessAction(action)) {
      const isViewContextOnce = isViewContextOnceTriggerProcessAction(action);
      if (!isViewContextOnce && isEachRecordViewTriggerProcessAction(action)) {
        closeLoading();
        const precheckResult = await formDataApi.precheckViewActionTrigger({
          ...request,
          sign: tableNocodeSign.value || "",
          onMainSign: (sign: string) => updateTableNocodeSign(sign),
        });
        viewActions.clearBatchState();
        openViewActionTriggerPrecheck(action, request, precheckResult);
        return;
      }
      const previewResult = await requestExecuteViewAction({
        ...request,
        previewOnly: true,
      });
      if (previewResult.blockedByLimit) {
        ElMessage.error(previewResult.message || i18next.t("NocodeTable.viewActionScopeTooLarge"));
        return;
      }
      if (!isViewContextOnce && (previewResult.affectedCount || 0) <= 0) {
        ElMessage.warning(previewResult.message || i18next.t("NocodeTable.viewActionNoExecutableData"));
        return;
      }

      if (!isViewContextOnce && previewResult.requiresConfirm) {
        closeLoading();
        try {
          await ElMessageBox.confirm(
            previewResult.message || `${i18next.t("NocodeTable.viewActionConfirmPrefix")}${previewResult.affectedCount || 0}${i18next.t("NocodeTable.viewActionConfirmSuffix")}`,
            i18next.t("NocodeTable.viewActionConfirmTitle"),
            {
              confirmButtonText: i18next.t("NocodeTable.viewActionConfirmExecute"),
              cancelButtonText: i18next.t("NocodeTable.viewActionConfirmCancel"),
              type: "warning",
              closeOnClickModal: false,
              distinguishCancelAndClose: true,
            },
          );
        } catch {
          return;
        }

        loadingInstance = ElLoading.service({
          target: loadingTarget,
          text: i18next.t("NocodeTable.actionExecuting"),
          background: "rgba(0, 0, 0, 0.15)",
        });
        loadingClosed = false;
      }

      result = await requestExecuteViewAction({
        ...request,
        confirmed: !isViewContextOnce && !!previewResult.requiresConfirm,
        expectedAffectedCount: !isViewContextOnce ? previewResult.affectedCount : undefined,
        expectedAffectedRowsDigest: !isViewContextOnce ? previewResult.affectedRowsDigest : undefined,
      });

      if (result.blockedByLimit) {
        ElMessage.error(result.message || i18next.t("NocodeTable.viewActionScopeTooLarge"));
        return;
      }
      if (!isViewContextOnce && result.requiresConfirm) {
        ElMessage.warning(result.message || i18next.t("NocodeTable.viewActionChangedNeedReconfirm"));
        return;
      }
    } else {
      result = await requestExecuteViewAction(request);
    }

    const actionRowUUID = actionRow?.[widget.rowKey];
    const shouldRefreshCurrentTableAfterCreate = action.behavior.type === ViewActionBehaviorType.CREATE_RECORD
      && action.behavior.config.targetFormId === props.tableUID;

    if (result.type === ViewActionBehaviorType.EDIT_RECORD && result.prepareEditResult) {
      if (!(result.prepareEditResult.fields || []).length) {
        ElMessage.error(i18next.t("NocodeTable.viewActionEditFieldRequired"));
        return;
      }
      const actionEditFormContext = await loadActionEditFormContext(actionRowUUID);
      const editableVisibleFieldIds = Array.from(new Set((result.prepareEditResult.fields || []).filter(Boolean)));
      if (!editableVisibleFieldIds.length) {
        ElMessage.warning(i18next.t("NocodeTable.viewActionNoEditableFields"));
        return;
      }
      showActionEditDialog(action, actionRow, {
        prepareRow: result.prepareEditResult.row,
        visibleFieldIds: editableVisibleFieldIds,
        memberFieldsAuth: actionEditFormContext.fieldsAuth === "all" ? undefined : actionEditFormContext.fieldsAuth,
        viewActionContext: result.prepareEditResult.context,
        bootstrapData: {
          formData: actionEditFormContext.formData,
        },
      });
      return;
    }

    if (result.type === ViewActionBehaviorType.CREATE_RECORD) {
      ElMessage.success(result.message || i18next.t("NocodeTable.viewActionCreateSuccess"));
    } else if (result.type === ViewActionBehaviorType.TRIGGER_PROCESS) {
      if (getTriggerProcessSuccessCount(result) > 0) {
        ElMessage.success(
          result.message || (
            result.executionMode === "view_once"
              ? i18next.t("NocodeTable.viewActionProcessStarted")
              : i18next.t("NocodeTable.viewActionProcessTriggered")
          ),
        );
      } else {
        ElMessage.warning(result.message || i18next.t("NocodeTable.viewActionNoExecutableData"));
      }
    }

    if (shouldRefreshDetailDialog) {
      if (result.type === ViewActionBehaviorType.TRIGGER_PROCESS && getTriggerProcessSuccessCount(result) > 0) {
        detailTableRefreshPending.value = true;
        dialogs.refreshDetailProcess();
        const refreshed = await refreshDetailDialogContent(actionRowUUID);
        if (!refreshed.refreshed) {
          detailTableRefreshPending.value = false;
          dialogs.closeDetail();
          widget.refreshData();
          await nextTick();
          showFormRowDialog(FormMode.Edit, actionRowUUID);
        }
        return;
      }

      if (shouldQueueDataManagementDetailTableRefreshAfterCreate({
        action,
        result,
        inDetailContext: shouldRefreshDetailDialog,
        tableUID: props.tableUID,
      })) {
        detailTableRefreshPending.value = true;
      }
      return;
    }

    if (result.type === ViewActionBehaviorType.CREATE_RECORD) {
      if (shouldRefreshCurrentTableAfterCreate && (result.affectedCount || 0) > 0) {
        widget.refreshData();
      }
      return;
    }

    if (result.type === ViewActionBehaviorType.TRIGGER_PROCESS && getTriggerProcessSuccessCount(result) <= 0) {
      return;
    }

    widget.refreshData();
  } catch (error: any) {
    ElMessage.error(error?.message || i18next.t("NocodeTable.viewActionExecuteFailed"));
  } finally {
    closeLoading();
  }
};

const createBaseDetailDialogState = (payload: {
  title: string;
  nocodeId: string;
  nocodeSign: string;
  tableUID: OptionTableUID;
  uuid: string;
  row: Row | null;
  bootstrapData?: {
    formData: NocodeFormData;
    otherDataSources?: NocodeBody["otherDataSources"];
  };
  permissionContextOverride?: {
    nocodeBody?: NocodeBody;
    getPermissionBody?: (tableId?: string) => Pick<NocodeBody, "permissions"> | NocodeBody | undefined;
  };
  fieldsAuth?: Record<string, FieldAuthValue> | "all";
  permissions: {
    update: boolean;
    delete: boolean;
  };
}): RelatedDetailDialogState => {
  const id = `related-detail-${Date.now()}-${baseDetailDialogSeq++}`;
  return {
    id,
    visible: true,
    contentRefreshKey: 0,
    title: payload.title,
    nocodeFormProps: {
      nocodeId: payload.nocodeId,
      nocodeSign: payload.nocodeSign,
      tableUID: payload.tableUID,
      uuid: payload.uuid,
      row: payload.row,
      bootstrapData: payload.bootstrapData,
      permissionContextOverride: payload.permissionContextOverride,
      fieldsAuth: payload.fieldsAuth,
      relatedDetailHandler: openRelatedDetailDialog,
    },
    permissions: payload.permissions,
  };
};

function openRelatedDetailDialog(payload: RelatedDetailDialogPayload) {
  void handleShowRelatedForm(payload);
}

async function handleShowRelatedForm(payload: RelatedDetailDialogPayload) {
  const {
    relatedTableUID,
    uuid,
    row,
  } = payload;
  if (!props.clickRowShowDetail) return;
  const canView = await canReadRelatedDetail(relatedTableUID?.[1], payload);
  if (!canView) {
    ElMessage.error(i18next.t("NocodeDataManagementTable.relatedDetailNoPermission"));
    return;
  }
  const targetBodyData = getRelatedDetailBodyData(payload);
  const targetTableContext = getNocodeDataSourceTableByOptionTableUID(
    targetBodyData,
    relatedTableUID,
    { nocodeId: payload.sourceContext?.nocodeId || props.nocodeId },
    true,
  );
  const targetNocodeId = targetTableContext?.connection?.nocodeId || payload.sourceContext?.nocodeId || props.nocodeId;
  const [detailContext, targetNocodeSign, permissions] = await Promise.all([
    loadRelatedDetailFormContext(targetNocodeId, relatedTableUID[1], uuid),
    loadRelatedDetailNocodeSign(targetNocodeId),
    getRelatedDetailPermission(relatedTableUID?.[1], payload),
  ]);
  const permissionBody = await loadRelatedDetailPermissionBody(targetNocodeId);
  if (!detailContext?.formData) {
    ElMessage.error(i18next.t("NocodeDataManagementTable.relatedDetailLoadFailed"));
    return;
  }
  const detailRow = detailContext.row || row || null;
  if (!detailRow) {
    ElMessage.error(i18next.t("NocodeDataManagementTable.recordNotFound"));
    return;
  }
  const shouldEmitOpenDialog = !dialogs.detailVisible.value && !baseDetailDialogStack.value.length;
  baseDetailDialogStack.value.push(createBaseDetailDialogState({
    title: resolveRelatedDetailTitle(relatedTableUID?.[1], payload),
    nocodeId: targetNocodeId,
    nocodeSign: targetNocodeSign,
    tableUID: relatedTableUID,
    uuid,
    row: detailRow,
    bootstrapData: {
      formData: detailContext.formData,
      otherDataSources: detailContext.otherDataSources || [],
    },
    permissionContextOverride: {
      nocodeBody: permissionBody || undefined,
      getPermissionBody: (tableId?: TableUID) => getRelatedDetailPermissionSource(
        tableId || relatedTableUID[1],
        permissionBody,
        {
          ...payload,
          sourceContext: {
            nocodeId: targetNocodeId,
            tableUID: relatedTableUID,
            formData: detailContext.formData,
            otherDataSources: detailContext.otherDataSources || [],
          },
        },
      ) as NocodeBody,
    },
    fieldsAuth: detailContext.fieldsAuth,
    permissions,
  }));
  if (shouldEmitOpenDialog) {
    emit("openDialog");
  }
}

const flushPendingRelatedSubTablePreRow = () => {
  if (!relatedSubTableDialogRef.value || !pendingRelatedSubTablePreRow.value) return;
  relatedSubTableDialogRef.value.setPreRow(pendingRelatedSubTablePreRow.value);
  pendingRelatedSubTablePreRow.value = null;
};
watch(relatedSubTableDialogRef, flushPendingRelatedSubTablePreRow);

const handleShowRelatedSubForm = ({ row, value }: { row: Row; value: { uid: TableUID; name: string; fields: Field[] } }) => {
  relatedSubTableDialogInfo.value = {
    title: value.name,
    nocodeId: props.nocodeId,
    tableUID: value.uid,
    permissionMode: "data",
    preFilterRule: {
      logic: LogicalOperator.OR,
      conditions: value.fields.map((field) => ({
        uid: field.uid,
        func: RuleFunc.CONTAIN_ANY,
        value: [row[widget.rowKey]],
      })),
    },
  };
  relatedSubTableDialogVisible.value = true;
  const preRow = value.fields.reduce((prev, item) => {
    prev[item.uid] = [row[widget.rowKey]];
    return prev;
  }, {} as Row);
  pendingRelatedSubTablePreRow.value = preRow;
  nextTick(flushPendingRelatedSubTablePreRow);
};

const handleShowLinkForm = async ({ tableId, filterPath, nocodeId }: { tableId: string; filterPath: string; nocodeId?: string }) => {
  const targetNocodeId = nocodeId || props.nocodeId;
  if (isPublicDataPermissionBypassedRoute(route)) {
    linkTableInfo.value = {
      tableId,
      filterPath,
      nocodeId: targetNocodeId,
    };
    dataViewDialogVisible.value = true;
    return;
  }
  const permissionBody = await loadRelatedDetailPermissionBody(targetNocodeId);
  const canView = canViewNocodeLayerByBody(
    permissionBody || undefined,
    tableId,
    organizeUtil?.departments || [],
  );
  if (!canView) {
    ElMessage.error(i18next.t('NocodeDataManagementTable.linkDetailNoPermission'));
    return;
  }
  linkTableInfo.value = {
    tableId,
    filterPath,
    nocodeId: targetNocodeId,
  };
  dataViewDialogVisible.value = true;
};

const getShowRows = () => {
  return widget.showRows || [];
};

const setCheckedRows = (rows: Row[] = []) => {
  const nextRows = (rows || []).map(row => deepClone(row)).filter(Boolean);
  widget.setCheckboxRow(nextRows);
  widget.setSelectedRow(nextRows[0] || null);
};

const getMergedHiddenColumns = () => {
  const previousPreHiddenSet = new Set(lastAppliedPreHiddenColumns.value || []);
  const tableHiddenColumnIds = (widget.hiddenColumnIds || []).filter(uid => !previousPreHiddenSet.has(uid));
  return Array.from(new Set([
    ...(props.preHiddenColumns || []),
    ...tableHiddenColumnIds,
  ]));
};

const getMergedColumnOrders = () => {
  return mergeColumnOrders(props.preColumnOrders || {}, widget.columnOrders || {});
};

const applyMergedHiddenColumns = () => {
  const mergedHiddenColumns = getMergedHiddenColumns();
  lastAppliedPreHiddenColumns.value = [...(props.preHiddenColumns || [])];
  if (equals(widget.hiddenColumnIds ?? [], mergedHiddenColumns)) {
    return;
  }
  widget.setTempShowTableRule("hiddenColumns", mergedHiddenColumns);
};

const applyMergedColumnOrders = () => {
  const mergedColumnOrders = getMergedColumnOrders();
  if (equals(widget.columnOrders ?? {}, mergedColumnOrders)) {
    return;
  }
  widget.setTempShowTableRule("columnOrders", mergedColumnOrders);
};

const applyPreSortFields = (sortFields = props.preSortFields) => {
  if (!sortFields || equals(widget.sortFields ?? [], sortFields)) {
    return;
  }
  widget.setTempShowTableRule("sort", sortFields);
};

const refreshColumns = () => {
  applyMergedHiddenColumns();
  applyMergedColumnOrders();
};

const applyDisplaySettings = (value?: {
  hiddenColumnIds?: FieldUID[];
  columnOrders?: FormTableColumnOrder;
}) => {
  if (!value) return;
  widget.setTempShowTableRule("hiddenColumns", value.hiddenColumnIds || []);
  widget.setTempShowTableRule("columnOrders", value.columnOrders || {});
  refreshColumns();
};

const updateTableViewMetaPatch = (patch: Partial<FormTableViewMeta>) => {
  if (!patch) return;
  Object.entries(patch).forEach(([key, value]) => {
    widget.setTableViewMeta(key as keyof FormTableViewMeta, value as any);
  });
};

const init = async () => {
  nocodeBody.value = await getNocode();
  if (isUnmounted || !nocodeBody.value?.formData) {
    return;
  }
  const baseMeta = props.tableViewMeta || nocodeBody.value.formData?.metas?.[props.tableUID] || {};
  let meta = baseMeta;
  if ([FormTableRuntime.FORM_VIEWER, FormTableRuntime.BOARD_VIEWER].includes(runtime)) {
    meta = mergeTableViewMeta(baseMeta, viewMetaStorage.get() || {});
  } else if (runtime === FormTableRuntime.FORM_EDITOR) {
    meta = props.headerVariant === "recycle"
      ? baseMeta
      : (nocodeBody.value.formData?.metas?.[props.tableUID] || meta);
  }
  widget.init({
    runtime,
    nocodeBody: nocodeBody.value,
    organizeUtil,
    meta,
  });
  if (isUnmounted) {
    return;
  }
  if (props.prePageSize) {
    widget.pageSize = props.prePageSize;
  }
  currentTable.value = widget.getTable(props.tableUID) || nocodeBody.value.formData.tables?.find((table) => table.uid === props.tableUID);
  isReady.value = true;
  applyMergedHiddenColumns();
  applyMergedColumnOrders();
  applyPreSortFields();
  await widget.refreshData();
  if (isUnmounted) {
    return;
  }
  isInitialLoading.value = false;
};

void init();

watch(
  () => widget.rows,
  (newVal, oldVal) => {
    if (equals(newVal, oldVal)) return;
    emit("changeRows", newVal);
  },
);

watch(() => dialogs.detailVisible.value, (value) => {
  if (value) {
    return;
  }
  flushPendingDetailTableRefresh();
  dialogs.closeDetail();
  if (!baseDetailDialogStack.value.length) {
    emit("closeDialog");
  }
});

watch(() => actionEditDialogVisible.value, (value) => {
  if (!value) {
    resetActionEditDialogState();
  }
});

watch(() => {
  const rules = props.preViewFilterRules?.length ? props.preViewFilterRules : (props.preFilterRule ? [props.preFilterRule] : []);
  return rules.flatMap((rule) => rule?.conditions ? deepClone(rule.conditions) : []);
}, (value, oldValue) => {
  if (!isReady.value || equals(value, oldValue)) return;
  widget.refreshData();
}, { immediate: true, deep: true });

watch(() => props.preSortFields, (value, oldValue) => {
  if (!isReady.value || !value || equals(value, oldValue)) return;
  applyPreSortFields(value);
}, { immediate: true, deep: true });

watch(() => [props.preHiddenColumns, widget.getTableViewMeta("hiddenColumns")], () => {
  if (!isReady.value) return;
  applyMergedHiddenColumns();
}, { immediate: true, deep: true });

watch(() => [props.preColumnOrders, widget.getTableViewMeta("columnOrders")], () => {
  if (!isReady.value) return;
  applyMergedColumnOrders();
}, { immediate: true, deep: true });

watch(() => widget.displaySettingVersion, () => {
  if (!isReady.value) return;
  nextTick(() => {
    clearDisplaySettingApplying();
  });
}, { flush: "post" });

watch(() => [
  props.carouselSettings?.mode,
  props.carouselSettings?.scrollSpeed,
  props.carouselSettings?.pageInterval,
  widget.rows,
  widget.total,
], () => {
  nextTick(restartCarousel);
}, { deep: true });

onMounted(async () => {
  if (props.skipOrganizeLoad) {
    return;
  }
  if (!organizeUtil?.departments?.length) {
    await organizeUtil?.getDepartments?.();
  }
  if (!organizeUtil?.roleList?.length) {
    await organizeUtil?.getRoles?.();
  }
});

onBeforeUnmount(() => {
  isUnmounted = true;
  widget.emitter.off("update-view-meta", handleUpdateViewMeta);
  stopCarousel();
  baseDetailDialogStack.value = [];
  nocodeBody.value = null;
  currentTable.value = undefined;
  assignOwnerDialogRows.value = undefined;
  assignOwnerDialogOnSubmit.value = undefined;
  relatedSubTableDialogInfo.value = {};
  pendingRelatedSubTablePreRow.value = null;
  actionEditNocodeFormProps.value = {
    nocodeId: "",
    tableUID: [],
    uuid: "",
    row: null,
    memberFieldsAuth: undefined,
    fieldsAuth: undefined,
    viewActionContext: undefined,
    bootstrapData: undefined,
  };
  widget.dispose();
});

defineExpose({
  showFormRowDialog,
  getShowRows,
  setCheckedRows,
  getAllColumns: () => widget.allColumns,
  getHiddenColumnIds: () => widget.hiddenColumnIds,
  getFullRow: (uuid: string, fieldUID?: FieldUID, applyDisplayFilters = false) => widget.getFullRow(uuid, fieldUID, applyDisplayFilters),
  getCurrentForm: async () => await widget.ensureFormReady(),
  refreshData: (reportFailure = false) => widget.refreshData(reportFailure),
  refreshColumns,
  applyDisplaySettings,
  updateTableViewMetaPatch,
  getRowHeightLevel: () => widget.rowHeightLevel,
  setRowHeightLevel: (rowHeightLevel: FormTableRowHeight) => {
    widget.rowHeightLevel = rowHeightLevel;
  },
});
</script>

<style scoped lang="scss">
.nocode-data-management-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  gap: 16px;
  position: relative;

  .b2table {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 8px;

    &.fixed-filter {
      max-width: calc(100% - 376px);
    }
  }
}

.nocode-data-management-table.search-form-result-table {
  height: auto;

  .b2table {
    height: auto;
  }

  .b2table-main {
    flex: 0 0 auto;
  }
}

.b2table-main {
  flex: 1;
  min-height: 0;
  padding-top: 4px;
}

.table-filter-wrap {
  max-width: calc(360px + 16px);
  height: calc(100% + 32px);
  flex: 1;
  flex-shrink: 0;
  padding-left: 16px;
  background-color: var(--bg-color);
  position: absolute;
  top: -16px;
  right: 0;
}

.view-action-batch-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #f7d9a6;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff8e8 0%, #fff4d8 100%);
}

.view-action-batch-banner__content {
  min-width: 0;
}

.view-action-batch-banner__title {
  font-size: 14px;
  font-weight: 600;
  color: #7a4d12;
  line-height: 1.5;
}

.view-action-batch-banner__description {
  margin-top: 4px;
  font-size: 12px;
  color: #9a6b2f;
  line-height: 1.5;
}

.view-action-batch-banner__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  white-space: nowrap;
}

.b2table-pagination-wrap {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 4px;
}

.b2table-pagination-wrap :deep(.el-pagination) {
  justify-content: flex-end;
  width: 100%;
}

.page-total-text {
  margin-left: 8px;
  font-size: 12px;
}
</style>

