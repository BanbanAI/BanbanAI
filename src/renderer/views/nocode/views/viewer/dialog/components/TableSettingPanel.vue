<template>
  <view-drawer-panel :isLoading="isLoading" :loadingText="$t('projectEditor.saving')" @close="handleClose" @cancel="handleCancel" @confirm="handleConfirm">
    <div class="table-setting-panel">
      <div class="table-setting-panel-title">
        <div class="label">{{ $t("TableSettingPanel.tableSettingNameLabel") }}</div>
        <div class="value">
          <el-input v-model="viewName" type="text" :placeholder="$t('TableSettingPanel.tableSettingNamePlaceholder')" />
        </div>
      </div>
      <div class="table-setting-panel-main">
        <vn-stack v-model="activeMenu">
          <div class="tabs">
            <vn-stack-tab class="tab-item" :class="{ 'active': activeMenu === item.name }" v-for="(item, index) in settingMenus" :key="index" :name="item.name" @click="handleChangeMenu(item.name)">
              <span>{{ item.label }}</span>
            </vn-stack-tab>
          </div>
          <vn-stack-layer :class="['layer-item', `layer-item-${item.name}`]" v-for="(item, index) in settingMenus" :key="index" :name="item.name">
            <fields-drag-display-setting
              v-if="item.name === 'field'"
              :ref="setFieldSettingRef"
              :tableUid="table.uid"
              :columns="fieldColumns"
            ></fields-drag-display-setting>
            <dataManagement-filter-setting
              v-if="item.name === 'filter'"
              :ref="setFilterSettingRef"
              :columns="filterColumns"
              :tableUid="table.uid"
              :widget="tableWidget"
            ></dataManagement-filter-setting>
            <table-action-setting
              v-if="item.name === 'action'"
              :ref="setActionSettingRef"
              :actions="draftActions"
              v-model:detail-visible="actionDetailVisible"
              :table="table"
              :view-id="props.currentView?.uid"
            ></table-action-setting>
          </vn-stack-layer>
        </vn-stack>
      </div>
    </div>
  </view-drawer-panel>
</template>

<script setup lang='ts'>
import { FilterRule, FormTableColumnOrder, FormTableRuntime, LogicalOperator, MemberRange, Nocode, OperationPermission, ViewAction, ViewSetting } from '@common/types/nocode';
import { FORM_DATA_VIEWER_EMITTER, NOCODE, NOCODE_SIGN_IS_LATEST, ORGANIZE_UTIL, VIEW_ACTIVE_UID, VIEW_SETTING_DRAWER_CLOSE_GUARD, VIEW_SETTING_DRAWER_PANEL_STATE, VIEW_SETTING_DRAWER_REF } from '@renderer/types';
import { computed, inject, nextTick, onMounted, onUnmounted, Ref, ref, toRaw, watch } from 'vue';
import type { FieldUID, Table as ProjectTable } from '@common/types/project'
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from "axios";
import { Events } from '../../main/formDataViewerEmitter';
import { Column } from '../../../../components/global/table/table';
import { equals, isEmpty } from '@common/utils/object';
import { cloneDeep } from 'lodash';
import i18next from 'i18next';
import { storeFactory } from '@renderer/utils';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { AbstractForm } from '@renderer/b2/controllers/form';

interface ViewSettingDrawerProps {
  currentView?: ViewSetting;
  table: ProjectTable;
  filterColumns?: Column[];
  nocodeTableRef: any
}

type FieldSettingExpose = {
  initValue: (hiddenColumnIds?: FieldUID[]) => void;
  getValue: () => {
    hiddenColumnIds: FieldUID[];
    columnOrders: FormTableColumnOrder;
  };
}
type FilterSettingExpose = {
  initValue: (filterRules?: FilterRule) => void;
  getValue: () => FilterRule;
  clearValue: () => void;
}
type ActionSettingExpose = {
  flushActions: () => Promise<void> | void;
  validateActions: () => Promise<boolean> | boolean;
  getActions: () => ViewAction[];
  hasChanges: () => boolean;
  getActionPermissionCopySources: () => Record<string, string>;
}

const props = withDefaults(defineProps<ViewSettingDrawerProps>(), {});
const viewSettingDrawerRef = inject(VIEW_SETTING_DRAWER_REF);
const viewSettingDrawerCloseGuard = inject(VIEW_SETTING_DRAWER_CLOSE_GUARD);
const viewSettingDrawerPanelState = inject(VIEW_SETTING_DRAWER_PANEL_STATE);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const nocode: Ref<Nocode> = inject(NOCODE);
const forDataViewerEmitter = inject(FORM_DATA_VIEWER_EMITTER);
const isLoading = ref(false);
const activeTab = inject(VIEW_ACTIVE_UID);
const isCurrent = computed(() => {
  return props.currentView?.type === "table" && activeTab.value === props.currentView?.uid;
})
const viewName = ref("");
const originViewName = ref("");
const originHiddenColumns = ref<FieldUID[]>([]);
const originColumnOrders = ref<FormTableColumnOrder>({});
const originManagedHiddenColumns = ref<FieldUID[]>([]);
const originManagedColumnOrders = ref<FormTableColumnOrder>({});
const fieldColumns = ref<Column[]>([]);
const filterColumns = computed(() => {
  const columns = props.filterColumns;
  return columns && columns.length ? columns : fieldColumns.value;
});
const fieldSettingRef = ref<FieldSettingExpose>();
const filterSettingRef = ref<FilterSettingExpose>();
const actionSettingRef = ref<ActionSettingExpose>();
const originFilterRule = ref<FilterRule>({ logic: LogicalOperator.AND, conditions: [] });
const originActions = ref<ViewAction[]>([]);
const tableWidget = ref<AbstractForm>();

watch(
  () => activeTab.value,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      initData();
    }
  }
);

const getCurrentViewItem = () => {
  return nocode.value.body.views?.[props.table.uid]?.find(
    (item) => item.uid === activeTab.value
  );
};

const draftActions = ref<ViewAction[]>([]);

const actionDetailVisible = computed<boolean>({
  get() {
    return !!viewSettingDrawerPanelState?.value?.actionDetailVisible;
  },
  set(value) {
    if (!viewSettingDrawerPanelState) return;
    viewSettingDrawerPanelState.value.actionDetailVisible = value;
  },
});

const resetViewerColumnOrderCache = () => {
  const viewUid = props.currentView?.uid;
  if (!viewUid) return;
  const storageKeys = [
    `TABLE_VIEW_META_${viewUid}`,
    `TABLE_VIEW_META_V2_${viewUid}`,
  ];

  storageKeys.forEach((storageKey) => {
    const viewMetaStorage = storeFactory(storageKey);
    const runtimeMeta = viewMetaStorage.get() || {};
    if (!runtimeMeta.columnOrders) return;
    viewMetaStorage.set({
      ...runtimeMeta,
      columnOrders: {},
    });
  });
};

const setFieldSettingRef = (value: FieldSettingExpose | null) => {
  if (!value) return;
  fieldSettingRef.value = value;
};

const setFilterSettingRef = (value: FilterSettingExpose | null) => {
  if (!value) return;
  filterSettingRef.value = value;
};

const setActionSettingRef = (value: ActionSettingExpose | null) => {
  actionSettingRef.value = value || undefined;
};

const setViewName = (name: string) => {
  const nextName = (name || "").trim() || i18next.t('FormDataViewer.dataTableView');
  const item = getCurrentViewItem();
  if (item && item.name !== nextName) {
    item.name = nextName;
  }
  if (props.currentView && props.currentView.name !== nextName) {
    props.currentView.name = nextName;
  }
};
const settingMenus = [
  {
    name: 'filter',
    get label() { return i18next.t('TableSettingPanel.filterMenu') }
  },
  {
    name: 'field',
    get label() { return i18next.t('TableSettingPanel.fieldMenu') }
  },
  {
    name: 'action',
    get label() { return i18next.t('TableSettingPanel.actionMenu') }
  }
];

const getStoredActiveMenu = () => {
  const storedMenu = viewSettingDrawerPanelState?.value?.activeMenu;
  return settingMenus.some((item) => item.name === storedMenu) ? storedMenu : 'filter';
};

const activeMenu = ref(getStoredActiveMenu())

const syncDrawerPanelState = () => {
  if (!viewSettingDrawerPanelState) return;
  if (!isCurrent.value) {
    viewSettingDrawerPanelState.value.activeMenu = null;
    viewSettingDrawerPanelState.value.actionDetailVisible = false;
    return;
  }
  viewSettingDrawerPanelState.value.activeMenu = activeMenu.value;
  if (activeMenu.value !== "action") {
    viewSettingDrawerPanelState.value.actionDetailVisible = false;
  }
};

const handleChangeMenu = (menu: string) => {
  if (activeMenu.value !== menu) {
    actionDetailVisible.value = false;
  }
  activeMenu.value = menu;
}

const sortColumnsByOrder = <T extends { uid: FieldUID }>(columns: T[], groupKey: string, columnOrders: FormTableColumnOrder): T[] => {
  const orderMap = columnOrders?.[groupKey] || {};
  if (isEmpty(orderMap)) {
    return [...columns];
  }

  const placedIds = new Set<FieldUID>();
  const result = columns
    .filter((column) => orderMap[column.uid] !== undefined)
    .sort((a, b) => orderMap[a.uid] - orderMap[b.uid]);

  result.forEach((column) => placedIds.add(column.uid));

  columns.forEach((column, index) => {
    if (placedIds.has(column.uid)) return;

    let insertIndex = 0;
    let hasPrevPlaced = false;
    for (let i = index - 1; i >= 0; i--) {
      const prevUid = columns[i].uid;
      const prevIndex = result.findIndex((item) => item.uid === prevUid);
      if (prevIndex !== -1) {
        insertIndex = prevIndex + 1;
        hasPrevPlaced = true;
        break;
      }
    }

    if (!hasPrevPlaced) {
      insertIndex = 0;
    }

    result.splice(insertIndex, 0, column);
    placedIds.add(column.uid);
  });

  return result;
};

const applyColumnOrders = (columns: Column[], columnOrders: FormTableColumnOrder = {}) => {
  return sortColumnsByOrder(columns, "__root__", columnOrders).map((column) => {
    if (!column.subColumns?.length) return column;
    return {
      ...column,
      subColumns: sortColumnsByOrder(column.subColumns, column.uid, columnOrders),
    };
  });
};

const getColumnUidSet = (columns: Column[]) => {
  const uidSet = new Set<FieldUID>();
  columns.forEach((column) => {
    uidSet.add(column.uid);
    column.subColumns?.forEach((subColumn) => uidSet.add(subColumn.uid));
  });
  return uidSet;
};

const filterHiddenColumns = (hiddenColumns: FieldUID[] = [], columns: Column[] = []) => {
  const columnUidSet = getColumnUidSet(columns);
  return hiddenColumns.filter((uid) => columnUidSet.has(uid));
};

const filterColumnsByHiddenSet = (columns: Column[] = [], hiddenSet: Set<FieldUID>) => {
  return columns.reduce<Column[]>((result, column) => {
    if (!column) {
      return result;
    }
    if (!column.subColumns?.length) {
      if (!hiddenSet.has(column.uid)) {
        result.push({ ...column });
      }
      return result;
    }

    const visibleSubColumns = filterColumnsByHiddenSet(column.subColumns, hiddenSet);
    if (!visibleSubColumns.length) {
      return result;
    }

    result.push({
      ...column,
      subColumns: visibleSubColumns,
    });
    return result;
  }, []);
};

const getEditorColumns = () => {
  const allColumns = props.nocodeTableRef.getAllColumns() as Column[];
  const editorHiddenColumns = nocode.value?.body?.formData?.metas?.[props.table.uid]?.hiddenColumns || [];
  if (!editorHiddenColumns.length) {
    return allColumns;
  }
  return filterColumnsByHiddenSet(allColumns, new Set(editorHiddenColumns));
};

const initFieldSetting = async (hiddenColumns: FieldUID[] = [], columnOrders: FormTableColumnOrder = {}) => {
  fieldColumns.value = applyColumnOrders(getEditorColumns(), columnOrders);
  await nextTick();
  fieldSettingRef.value?.initValue(filterHiddenColumns(hiddenColumns, fieldColumns.value));
};

const getFieldSettingValue = () => {
  if (!fieldSettingRef.value) {
    return {
      hiddenColumnIds: [] as FieldUID[],
      columnOrders: {} as FormTableColumnOrder,
    };
  }
  return fieldSettingRef.value.getValue();
};

const syncOriginManagedFieldSetting = () => {
  const fieldSettingValue = getFieldSettingValue();
  originManagedHiddenColumns.value = [...fieldSettingValue.hiddenColumnIds];
  originManagedColumnOrders.value = cloneDeep(fieldSettingValue.columnOrders);
};

const syncOriginManagedFilterSetting = () => {
  const filterValue = getFilterSettingValue();
  originFilterRule.value = cloneDeep(filterValue);
};

const getFilterSettingValue = (): FilterRule => {
  if (!filterSettingRef.value) {
    return { logic: LogicalOperator.AND, conditions: [] };
  }
  return filterSettingRef.value.getValue();
};

const getActionSettingValue = () => {
  if (!actionSettingRef.value?.getActions) {
    return cloneDeep(draftActions.value || []);
  }
  return actionSettingRef.value.getActions();
};

const getActionPermissionCopySources = () => {
  if (!actionSettingRef.value?.getActionPermissionCopySources) {
    return {};
  }
  return actionSettingRef.value.getActionPermissionCopySources();
};

const collectValidActionIds = (views: ViewSetting[]) => {
  const actionIds = new Set<string>();
  (views || []).forEach((view) => {
    (view.actions || []).forEach((action) => {
      if (action?.id) {
        actionIds.add(action.id);
      }
    });
  });
  return actionIds;
};

const buildNextOperationPermissions = (views: ViewSetting[], actionPermissionCopySources: Record<string, string>) => {
  const copyEntries = Object.entries(actionPermissionCopySources || {});
  const currentOperationPermissions = nocode.value.body.permissions?.operation || {};
  const sourceTablePermissions = currentOperationPermissions[props.table.uid] || {};
  const nextTablePermissions = cloneDeep(sourceTablePermissions) as Record<string, MemberRange>;
  let hasChanges = false;

  for (const [targetActionId, sourceActionId] of copyEntries) {
    if (!targetActionId || !sourceActionId) {
      continue;
    }

    const sourcePermission = sourceTablePermissions[sourceActionId];
    if (!sourcePermission || nextTablePermissions[targetActionId]) {
      continue;
    }

    nextTablePermissions[targetActionId] = cloneDeep(sourcePermission);
    hasChanges = true;
  }

  const validActionIds = collectValidActionIds(views);
  Object.keys(nextTablePermissions).forEach((actionId) => {
    if (!validActionIds.has(actionId)) {
      delete nextTablePermissions[actionId];
      hasChanges = true;
    }
  });

  if (!hasChanges) {
    return null;
  }

  const nextOperationPermissions = cloneDeep(currentOperationPermissions) as OperationPermission;
  if (Object.keys(nextTablePermissions).length) {
    nextOperationPermissions[props.table.uid] = nextTablePermissions;
  } else {
    delete nextOperationPermissions[props.table.uid];
  }

  return nextOperationPermissions;
};

const hasActionUnsavedChanges = () => {
  if (!actionSettingRef.value?.hasChanges) {
    return !equals(draftActions.value || [], originActions.value || []);
  }
  return actionSettingRef.value.hasChanges();
};

const hasUnsavedChanges = () => {
  const fieldSettingValue = getFieldSettingValue();
  const filterValue = getFilterSettingValue();
  return viewName.value !== originViewName.value
    || !equals(fieldSettingValue.hiddenColumnIds, originManagedHiddenColumns.value)
    || !equals(fieldSettingValue.columnOrders, originManagedColumnOrders.value)
    || !equals(filterValue, originFilterRule.value)
    || hasActionUnsavedChanges();
};

const confirmCloseIfNeeded = async () => {
  if (!isCurrent.value || !hasUnsavedChanges()) return true;
  try {
    await ElMessageBox.confirm(
      i18next.t('TableSettingPanel.isSave'),
      i18next.t('TableSettingPanel.tips'),
      {
        distinguishCancelAndClose: true,
        confirmButtonText: i18next.t('TableSettingPanel.save'),
        cancelButtonText: i18next.t('TableSettingPanel.notSaveText'),
        type: 'warning',
      }
    );
    isLoading.value = true;
    return await save().finally(() => {
      isLoading.value = false;
    });
  } catch (action) {
    if (action === 'cancel') {
      await dataToOrigin();
      return true;
    }
    return false;
  }
};

const saveTabData = async (data = nocode.value.body.views[props.table.uid]) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  return await axios
    .post("/project/save-nocode-toc", {
      nocodeId: toRaw(nocode.value.meta.id),
      tableId: props.table.uid,
      data,
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    })
    .then(({ headers }) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        nocode.value.body.sign = mainSign;
      }
      return true;
    })
    .catch((err) => {
      if (handleNocodeSyncConflictError(err, nocodeSignIsLatest)) return false;
      ElMessage.error(err.message);
      return false;
    });
};
const saveOperationPermissions = async (permissions: OperationPermission) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  return await axios
    .post("/project/save-nocode-permissions", {
      nocodeId: toRaw(nocode.value.meta.id),
      permissions,
      permissionType: "operation",
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    })
    .then(({ headers }) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        nocode.value.body.sign = mainSign;
      }
      return true;
    })
    .catch((err) => {
      if (handleNocodeSyncConflictError(err, nocodeSignIsLatest)) return false;
      ElMessage.error(err.message);
      return false;
    });
};

// 数据恢复原来
const dataToOrigin = async () => {
  if (!isCurrent.value) return
  viewName.value = originViewName.value;
  await initFieldSetting(originHiddenColumns.value, originColumnOrders.value);
  syncOriginManagedFieldSetting();
  initFilterSetting(originFilterRule.value);
  draftActions.value = cloneDeep(originActions.value);
  actionDetailVisible.value = false;
};
const initFilterSetting = async (filterRules?: FilterRule) => {
  await nextTick();
  filterSettingRef.value?.initValue(filterRules || { logic: LogicalOperator.AND, conditions: [] });
};

const  initData = async ({ force = false }: { force?: boolean } = {}) => {
  if (!isCurrent.value) return
  if (!force && !viewSettingDrawerPanelState?.value.visible) return
  const item = getCurrentViewItem();
  const currentViewName = (item?.name || "").trim() || i18next.t('FormDataViewer.dataTableView');
  // 处理表单名字
  originViewName.value = currentViewName;
  originHiddenColumns.value = [...(item?.hiddenColumns || [])];
  originColumnOrders.value = cloneDeep(item?.columnOrders || {});
  const viewFilterRules = item?.viewFilterRules || (item as any)?.filterRules;
  originFilterRule.value = cloneDeep(viewFilterRules || { logic: LogicalOperator.AND, conditions: [] });
  originActions.value = cloneDeep(item?.actions || []);
  draftActions.value = cloneDeep(item?.actions || []);
  activeMenu.value = getStoredActiveMenu();
  actionDetailVisible.value = activeMenu.value === "action" && !!viewSettingDrawerPanelState?.value?.actionDetailVisible;
  viewName.value = currentViewName;
  tableWidget.value = await props.nocodeTableRef.getCurrentForm();
  await initFieldSetting(originHiddenColumns.value, originColumnOrders.value);
  await initFilterSetting(originFilterRule.value);
  syncOriginManagedFieldSetting();
  syncOriginManagedFilterSetting();
}

const handleClose = async () => {
  if (!isCurrent.value) return
  const allowClose = await confirmCloseIfNeeded();
  if (!allowClose) return
  viewSettingDrawerRef.value?.hide();
};
const handleCancel = async () => {
  if (!isCurrent.value) return
  const allowClose = await confirmCloseIfNeeded();
  if (!allowClose) return
  viewSettingDrawerRef.value?.hide();
};
const buildNextViews = () => {
  const views = cloneDeep(nocode.value.body.views?.[props.table.uid] || []);
  const currentIndex = views.findIndex((view) => view.uid === activeTab.value);
  const fieldSettingValue = fieldSettingRef.value?.getValue();
  const filterValue = filterSettingRef.value?.getValue();
  const actionValue = getActionSettingValue();
  const nextViewName = (viewName.value || "").trim() || i18next.t('FormDataViewer.dataTableView');

  if (currentIndex === -1) {
    return {
      views,
      currentIndex,
      fieldSettingValue,
      filterValue,
      nextViewName,
    };
  }

  const nextItem = views[currentIndex];
  if (fieldSettingValue) {
    nextItem.hiddenColumns = fieldSettingValue.hiddenColumnIds;
    nextItem.columnOrders = fieldSettingValue.columnOrders;
  }
  if (filterValue) {
    nextItem.viewFilterRules = filterValue;
  }
  nextItem.actions = cloneDeep(actionValue || []);
  if (nextItem.name !== nextViewName) {
    nextItem.name = nextViewName;
  }

  return {
    views,
    currentIndex,
    fieldSettingValue,
    filterValue,
    nextViewName,
  };
};

const syncSavedCurrentViewToLocalState = (views: ViewSetting[], currentIndex: number) => {
  const nextItem = currentIndex === -1 ? null : views[currentIndex];
  const currentViews = nocode.value.body.views?.[props.table.uid];
  if (!Array.isArray(currentViews) || !nextItem) {
    nocode.value.body.views[props.table.uid] = views;
    return nextItem;
  }

  const localCurrentIndex = currentViews.findIndex((view) => view.uid === nextItem.uid);
  if (localCurrentIndex === -1 || currentViews.length !== views.length) {
    nocode.value.body.views[props.table.uid] = views;
    return nocode.value.body.views[props.table.uid]?.[currentIndex] || nextItem;
  }

  const localCurrentView = currentViews[localCurrentIndex] as Record<string, any>;
  const nextCurrentView = cloneDeep(nextItem) as Record<string, any>;
  Object.keys(localCurrentView).forEach((key) => {
    if (!(key in nextCurrentView)) {
      delete localCurrentView[key];
    }
  });
  Object.assign(localCurrentView, nextCurrentView);

  return localCurrentView as ViewSetting;
};

const syncFieldSettingToLiveTable = (fieldSettingValue?: {
  hiddenColumnIds: FieldUID[];
  columnOrders: FormTableColumnOrder;
} | null) => {
  if (!fieldSettingValue) return;
  props.nocodeTableRef?.applyDisplaySettings?.(fieldSettingValue);
};

const save = async () => {
  await nextTick();
  await actionSettingRef.value?.flushActions?.();
  const isActionValid = await actionSettingRef.value?.validateActions?.();
  if (isActionValid === false) {
    return false;
  }
  const { views, currentIndex, fieldSettingValue, filterValue, nextViewName } = buildNextViews();
  const nextOperationPermissions = buildNextOperationPermissions(views, getActionPermissionCopySources());
  const previousOperationPermissions = cloneDeep(nocode.value.body.permissions?.operation || {});
  if (nextOperationPermissions) {
    const permissionSaved = await saveOperationPermissions(nextOperationPermissions);
    if (!permissionSaved) return false;
  }
  const saved = await saveTabData(views);
  if (!saved) {
    if (nextOperationPermissions) {
      const rollbackSaved = await saveOperationPermissions(previousOperationPermissions);
      if (!rollbackSaved) {
        ElMessage.error(i18next.t('TableSettingPanel.permissionRollbackFailed'));
      }
    }
    return false;
  }
  if (nextOperationPermissions) {
    nocode.value.body.permissions.operation = cloneDeep(nextOperationPermissions);
  }
  const nextItem = syncSavedCurrentViewToLocalState(views, currentIndex);
  if (nextItem && props.currentView) {
    Object.assign(props.currentView, nextItem);
  }
  if (fieldSettingValue) {
    resetViewerColumnOrderCache();
    syncFieldSettingToLiveTable(fieldSettingValue);
    originHiddenColumns.value = [...fieldSettingValue.hiddenColumnIds];
    originColumnOrders.value = cloneDeep(fieldSettingValue.columnOrders);
    originManagedHiddenColumns.value = [...fieldSettingValue.hiddenColumnIds];
    originManagedColumnOrders.value = cloneDeep(fieldSettingValue.columnOrders);
  }
  if (filterValue) {
    originFilterRule.value = cloneDeep(filterValue);
  }
  if (nextItem) {
    originActions.value = cloneDeep(nextItem.actions || []);
    draftActions.value = cloneDeep(nextItem.actions || []);
  }
  setViewName(nextViewName);
  viewName.value = nextViewName;
  originViewName.value = nextViewName;
  ElMessage.success(i18next.t('TableSettingPanel.saveSuccess'));
  return true;
};
const handleConfirm = async () => {
  if (!isCurrent.value) return
  isLoading.value = true;
  await save();
  isLoading.value = false;
};
// 通过点击其他地方关闭抽屉 需要恢复数据
const handleDrawerOtherClose = () => {
  if (!isCurrent.value) return
  dataToOrigin();
};
// 抽屉打开
const handleDrawerOpen = () => {
  if (!isCurrent.value) return
  syncDrawerPanelState();
  initData({ force: true });
};
forDataViewerEmitter.on(Events.DRAWER_OTHERCLOSE, handleDrawerOtherClose);
forDataViewerEmitter.on(Events.DRAWER_OPEN, handleDrawerOpen);
onUnmounted(() => {
  forDataViewerEmitter.off(Events.DRAWER_OTHERCLOSE, handleDrawerOtherClose);
  forDataViewerEmitter.off(Events.DRAWER_OPEN, handleDrawerOpen);
});
watch(activeMenu, () => {
  syncDrawerPanelState();
}, { immediate: true });
watch(isCurrent, (value) => {
  syncDrawerPanelState();
  if (!viewSettingDrawerCloseGuard) return
  if (value) {
    viewSettingDrawerCloseGuard.value = confirmCloseIfNeeded;
    return;
  }
  if (viewSettingDrawerCloseGuard.value === confirmCloseIfNeeded) {
    viewSettingDrawerCloseGuard.value = null;
  }
}, { immediate: true });
onMounted(() => {
  syncDrawerPanelState();
  if (!isCurrent.value) return
  initData();
});
onUnmounted(() => {
  if (viewSettingDrawerCloseGuard?.value === confirmCloseIfNeeded) {
    viewSettingDrawerCloseGuard.value = null;
  }
  if (viewSettingDrawerPanelState?.value.activeMenu === activeMenu.value) {
    viewSettingDrawerPanelState.value.activeMenu = null;
    viewSettingDrawerPanelState.value.actionDetailVisible = false;
  }
});
</script>

<style lang='scss' scoped>
.table-setting-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  .table-setting-panel-title {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;

    .label {
      height: 22px;
      color: #4e5969;
      font-size: 14px;
      line-height: 22px;
    }
    
    .value {
      flex: 1;
      flex-basis: auto;
      height: 32px;
      display: flex;
      align-items: center;

      .el-input {
        --el-input-border-radius: 4px;
        --el-input-bg-color: #f2f3f5;
      }
    }
  }

  .table-setting-panel-main {
    flex: 1;
    min-height: 0;
    overflow: hidden;

    :deep(.vn-stack) {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    :deep(.vn-stack-layer) {
      min-height: 0;
    }

    .tabs {
      display: flex;
      height: 36px;
      border-bottom: 1px solid #e5e6eb;
      gap: 24px;
      flex-shrink: 0;

      .tab-item {
        &:hover {
          cursor: pointer;
        }
      }

      .active {
        color: #0873FF;
        box-shadow: inset 0 -1px 0 #0873FF;
      }
    }

    .layer-item {
      padding-top: 16px;
      box-sizing: border-box;
    }

    .layer-item-action {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;

      > * {
        flex: 1;
        min-height: 0;
      }
    }
  }
}
</style>
