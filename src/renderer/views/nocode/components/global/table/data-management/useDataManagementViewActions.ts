import { computed, ref, type ComputedRef } from "vue";
import {
  ExecuteViewActionFailedItem,
  ExecuteViewActionRequest,
  ExecuteViewActionResult,
  ViewAction,
  ViewActionBehaviorType,
  ViewActionPlacement,
} from "@common/types/nocode";
import { isViewActionRecordTarget } from "@common/utils/viewAction";
import { Row, TableUID } from "@common/types/project";
import { FormMode } from "../types";

export type RuntimeActionItem = {
  action: ViewAction;
  disabled?: boolean;
  tip?: string;
};

export type ViewActionBatchState = {
  actionId: string;
  actionName: string;
  attemptedCount: number;
  successCount: number;
  failedCount: number;
  failedItems: ExecuteViewActionFailedItem[];
  retryFilters?: ExecuteViewActionRequest["filters"];
};

type BuildRecordActionItemsOptions = {
  actions: ViewAction[];
  placement: ViewActionPlacement;
  row?: Row;
  hasActionPermission: (action: ViewAction) => boolean;
  getActionDisabled: (action: ViewAction, row?: Row) => boolean;
};

type BuildBatchStateOptions = {
  action: ViewAction;
  result: ExecuteViewActionResult;
  retryFilters?: ExecuteViewActionRequest["filters"];
  rowIndexByUuid?: Map<string, number>;
};

type UseDataManagementViewActionsOptions = {
  actions: ComputedRef<ViewAction[]>;
  isMobileDevice: boolean;
  isAlbum: boolean;
  hasActionPermission: (action: ViewAction) => boolean;
  getActionDisabled: (action: ViewAction, row?: Row) => boolean;
  rowIndexByUuid?: ComputedRef<Map<string, number>>;
};

type DetailViewActionContextOptions = {
  action: ViewAction;
  actionRowUUID?: string | number | null;
  detailVisible: boolean;
  detailFormMode: FormMode;
  detailTableUID?: TableUID;
  detailRowKey?: string | null;
  tableUID: TableUID;
};

type DetailCreateRefreshOptions = {
  action: ViewAction;
  result: Pick<ExecuteViewActionResult, "type" | "affectedCount">;
  inDetailContext: boolean;
  tableUID: TableUID;
};

export const buildDataManagementRecordActionItems = (
  options: BuildRecordActionItemsOptions,
): RuntimeActionItem[] => {
  return (options.actions || [])
    .filter((action) => isViewActionRecordTarget(action.target))
    .filter((action) => action.display?.placement === options.placement)
    .filter((action) => options.hasActionPermission(action))
    .sort((left, right) => (left.order || 0) - (right.order || 0))
    .map((action) => ({
      action,
      disabled: options.getActionDisabled(action, options.row),
      tip: action.executeCondition?.tip || "",
    }));
};

export const buildViewActionBatchState = (
  options: BuildBatchStateOptions,
): ViewActionBatchState => {
  const failedItems = [...(options.result.failedItems || [])]
    .filter((item) => !!item?.uuid)
    .map((item) => ({
      ...item,
      index: options.rowIndexByUuid?.get(String(item.uuid)) ?? item.index,
    }))
    .sort((left, right) => (left.index || 0) - (right.index || 0));
  const failedCount = options.result.failedCount ?? failedItems.length;

  return {
    actionId: options.action.id,
    actionName: options.action.name,
    attemptedCount: options.result.attemptedCount || failedItems.length,
    successCount: options.result.successCount || 0,
    failedCount,
    failedItems,
    retryFilters: options.retryFilters,
  };
};

export const shouldShowDataManagementTableActionPanel = (options: {
  items: RuntimeActionItem[];
  isMobileDevice: boolean;
  isAlbum: boolean;
}) => {
  return options.items.length > 0 && !options.isMobileDevice && !options.isAlbum;
};

export const shouldRefreshDataManagementDetailAfterViewAction = (
  options: DetailViewActionContextOptions,
) => {
  if (!options.actionRowUUID) {
    return false;
  }

  return options.detailVisible
    && options.detailFormMode === FormMode.Edit
    && options.detailTableUID === options.tableUID
    && String(options.detailRowKey || "") === String(options.actionRowUUID || "")
    && options.action.display?.placement === ViewActionPlacement.DETAIL_HEADER;
};

export const shouldQueueDataManagementDetailTableRefreshAfterCreate = (
  options: DetailCreateRefreshOptions,
) => {
  return options.inDetailContext
    && options.result.type === ViewActionBehaviorType.CREATE_RECORD
    && options.action.behavior.type === ViewActionBehaviorType.CREATE_RECORD
    && options.action.behavior.config.targetFormId === options.tableUID
    && (options.result.affectedCount || 0) > 0;
};

export const useDataManagementViewActions = (
  options: UseDataManagementViewActionsOptions,
) => {
  const batchBannerVisible = ref(false);
  const batchState = ref<ViewActionBatchState | null>(null);
  const resultDialogVisible = ref(false);
  const failureDetailDialogVisible = ref(false);

  const getRecordActionItems = (placement: ViewActionPlacement, row?: Row) => {
    return buildDataManagementRecordActionItems({
      actions: options.actions.value || [],
      placement,
      row,
      hasActionPermission: options.hasActionPermission,
      getActionDisabled: options.getActionDisabled,
    });
  };

  const tableActionItems = computed(() => {
    return getRecordActionItems(ViewActionPlacement.TABLE_ACTION_COLUMN);
  });

  const detailActionItems = (row?: Row | null) => {
    if (!row) {
      return [];
    }
    return getRecordActionItems(ViewActionPlacement.DETAIL_HEADER, row);
  };

  const showTableActionPanel = computed(() => {
    return shouldShowDataManagementTableActionPanel({
      items: tableActionItems.value,
      isMobileDevice: options.isMobileDevice,
      isAlbum: options.isAlbum,
    });
  });

  const clearBatchState = () => {
    batchState.value = null;
    batchBannerVisible.value = false;
    resultDialogVisible.value = false;
    failureDetailDialogVisible.value = false;
  };

  const openFailureDetail = () => {
    if (!batchState.value) {
      return;
    }
    failureDetailDialogVisible.value = true;
  };

  const openFailureDetailFromResult = () => {
    resultDialogVisible.value = false;
    openFailureDetail();
  };

  const setBatchStateFromResult = (
    action: ViewAction,
    result: ExecuteViewActionResult,
    request?: Pick<ExecuteViewActionRequest, "filters">,
  ) => {
    const nextState = buildViewActionBatchState({
      action,
      result,
      retryFilters: request?.filters,
      rowIndexByUuid: options.rowIndexByUuid?.value,
    });

    if (nextState.failedCount <= 0) {
      return null;
    }

    batchState.value = nextState;
    batchBannerVisible.value = true;
    failureDetailDialogVisible.value = false;
    resultDialogVisible.value = true;
    return nextState;
  };

  return {
    batchBannerVisible,
    batchState,
    resultDialogVisible,
    failureDetailDialogVisible,
    tableActionItems,
    showTableActionPanel,
    getRecordActionItems,
    detailActionItems,
    clearBatchState,
    openFailureDetail,
    openFailureDetailFromResult,
    setBatchStateFromResult,
  };
};
