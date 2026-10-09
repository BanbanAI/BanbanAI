<template>
  <div class="data-management" :class="{ 'mobile': isMobile() }">
    <div class="wrapper">
      <div class="table-wrapper">
        <virtual-table-lab
          v-if="showVirtualTableLab"
          class="table-lab"
        />
        <NocodeDataManagementTable
          v-else-if="isShowTable && dataManagementBinding"
          :key="dataManagementTableKey"
          :active="props.active && !recycleBinVisible"
          :nocodeId="dataManagementBinding.nocodeId"
          :tableUID="dataManagementBinding.tableUID"
          :viewId="currentTOC?.uid"
          :actions="currentTOC?.actions || []"
          :tableViewMeta="viewerTableViewMeta"
          :isAddDataAble="!isMobile() && getAddPermission"
          :isImportDataAble="getAddPermission"
          :isEditDataAble="getOtherPermission.update"
          :isDeleteDataAble="getOtherPermission.delete"
          :isChangeFilterDisplayMode="true"
          :isTableCellEditable="nocode?.body?.isEditTableCell ?? true"
          :updateColumnDataAble="runtime === FormTableRuntime.FORM_EDITOR"
          :isAlbum="false"
          :isShowAggregateFieldButton="isShowAggregateFieldPanel"
          :aggregateFieldActive="aggregateFieldPanelVisible"
          :isMultiple="true"
          :clickRowChecked="true"
          rowDetailTrigger="dblclick"
          :workbenchScopedFormDialog="isWorkbenchScopedFormDialog"
          :uid="uid"
          :preHiddenColumns="viewerPreHiddenColumns"
          :preColumnOrders="viewerPreColumnOrders"
          :preViewFilterRules="viewerPreViewFilterRules"
          :applyAppFieldPermissionToSystemFields="runtime === FormTableRuntime.FORM_EDITOR"
          :showRecycleBinEntry="runtime === FormTableRuntime.FORM_EDITOR"
          :enableShareLinkColumn="true"
          ref="nocodeTableRef"
          @submitted="emit('submitted')"
          @changeRows="emit('changeRows')"
          @draft-saved="emit('draft-saved')"
          @openRecycleBin="recycleBinVisible = true"
          @toggleAggregateFields="handleToggleAggregateFields"
        />
        <el-button type="primary" circle class="add-data-button" @click="handleAddData" v-if="isMobile()"><el-icon size="24"><i-ep-plus /></el-icon></el-button>
      </div>

      <data-management-aggregate-fields-panel
        v-if="!showVirtualTableLab && isShowAggregateFieldPanel && aggregateFieldPanelVisible && tableSettingBinding"
        :table="tableSettingBinding.table"
        :aggregateFields="currentAggregateFields"
        :filterRuleContext="aggregateFieldFilterContext"
        @close="aggregateFieldPanelVisible = false"
        @confirm="handleConfirmAggregateFields"
      />
    </div>
    <data-recycle-bin-drawer
      v-if="!showVirtualTableLab && recycleBinVisible && dataManagementBinding"
      v-model="recycleBinVisible"
      :nocodeId="dataManagementBinding.nocodeId"
      :tableUID="dataManagementBinding.tableUID"
      :uid="uid"
      @changed="nocodeTableRef?.refreshData?.()"
    />
    <teleport
      :to="viewSettingDrawerSlotRef"
      :disabled="!viewSettingDrawerSlotRef"
    >
      <table-setting-panel
        v-if="isTableViewSettingVisible"
        :table="tableSettingBinding.table"
        :currentView="currentTOC"
        :filterColumns="filterColumns"
        :nocodeTableRef="nocodeTableRef"
      />
    </teleport>
  </div>
</template>
<script lang='ts' setup>
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useFormTable } from './hooks';
import { NOCODE, VIEW_ACTIVE_UID, VIEW_SETTING_DRAWER_SLOT } from '@renderer/types';
import { usePassportStore } from '@renderer/stores';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { isMobile, useRuntime } from "@renderer/utils";
import { FormMode } from "../../../components/global/table/types";
import { getAllRelatedDepartments, getBoardConnectionsByNocodeBody, getNocodeDataSourceTableByOptionTableUID, getNocodeDataSourceTableByUID } from '@common/utils';
import { FilterRule, FormTableRuntime, TableAggregateField, ViewSetting } from '@common/types/nocode';
import { ConnectionUID, FieldUID, OptionTableUID, TableUID, Table as ProjectTable } from '@common/types/project';
import { Column } from "../../../components/global/table/table";
import NocodeDataManagementTable from "../../../components/global/table/NocodeDataManagementTable.vue";
import { WORKBENCH_AI_FORM_FILL_CONTEXT } from '@renderer/views/nocode/views/workbench/AI/workbenchAiFormFillContext';

const VirtualTableLab = defineAsyncComponent(() => import("@renderer/components/virtual-table/VirtualTableLab.vue"));
const DataManagementAggregateFieldsPanel = defineAsyncComponent(() => import('./dialogs/DataManagementAggregateFieldsPanel.vue'));
const DataRecycleBinDrawer = defineAsyncComponent(() => import('./DataRecycleBinDrawer.vue'));

const props = defineProps<{
  active: boolean,
  uid: string,
  currentTOC?: ViewSetting;
}>();
const emit = defineEmits<{
  (event: 'submitted'): void
  (event: 'changeRows'): void
  (event: 'draft-saved'): void
}>();
const liveTable = useFormTable();
const table = ref<ProjectTable>();
const nocode = inject<Ref<any>>(NOCODE, ref());
const passportState = usePassportStore()
const organizeUtil = inject<any>(ORGANIZE_UTIL)
const runtime = useRuntime();
const route = useRoute();
const workbenchAiFormFillContext = inject(WORKBENCH_AI_FORM_FILL_CONTEXT, null);
const isWorkbenchScopedFormDialog = computed(() => Boolean(workbenchAiFormFillContext?.overlayHost.value));
const filterColumns = ref<Column[]>([]);
watch(() => liveTable.value, (value) => {
  if (!value) return;
  table.value = value;
}, { immediate: true });
const editorTableMeta = computed(() => {
  return nocode.value?.body?.formData?.metas?.[table.value?.uid] || {};
});
const viewerPreHiddenColumns = computed(() => {
  if ([FormTableRuntime.FORM_EDITOR].includes(runtime)) return undefined;
  return Array.from(new Set([
    ...(editorTableMeta.value.hiddenColumns || []),
    ...(props.currentTOC?.hiddenColumns || []),
  ]));
});
const viewerPreColumnOrders = computed(() => {
  if ([FormTableRuntime.FORM_EDITOR].includes(runtime)) return undefined;
  return {
    ...(editorTableMeta.value.columnOrders || {}),
    ...(props.currentTOC?.columnOrders || {}),
  };
});
const viewerTableViewMeta = computed(() => {
  if ([FormTableRuntime.FORM_EDITOR].includes(runtime)) return undefined;
  return {
    ...editorTableMeta.value,
    hiddenColumns: viewerPreHiddenColumns.value,
    columnOrders: viewerPreColumnOrders.value,
  };
});
const viewerPreViewFilterRules = computed<FilterRule[] | undefined>(() => {
  if ([FormTableRuntime.FORM_EDITOR].includes(runtime)) return undefined;
  const rules: FilterRule[] = [];
  if (editorTableMeta.value.filterRules?.conditions?.length) {
    rules.push(editorTableMeta.value.filterRules);
  }
  const viewFilterRules = props.currentTOC?.viewFilterRules || (props.currentTOC as any)?.filterRules;
  if (viewFilterRules?.conditions?.length) {
    rules.push(viewFilterRules);
  }
  return rules.length ? rules : undefined;
});
const dataManagementBinding = computed<{
  nocodeId: string;
  tableUID: TableUID;
} | null>(() => {
  const nocodeId = nocode.value?.meta?.id;
  const tableUID = table.value?.uid;
  if (!nocodeId || !tableUID) {
    return null;
  }
  return {
    nocodeId,
    tableUID,
  };
});
const dataManagementTableKey = computed(() => {
  const binding = dataManagementBinding.value;
  if (!binding) {
    return `empty:${props.uid}`;
  }
  return [
    binding.nocodeId,
    binding.tableUID,
    props.currentTOC?.uid || "",
    runtime,
  ].join(":");
});
const showVirtualTableLab = computed(() => {
  if (!import.meta.env.DEV) return false;
  const labFlag = route.query.virtualTableLab;
  if (!props.active) {
    return false;
  }
  if (Array.isArray(labFlag)) {
    return labFlag.includes("1") || labFlag.includes("true");
  }
  return labFlag === "1" || labFlag === "true";
});
const tableSettingBinding = computed<{
  table: ProjectTable;
} | null>(() => {
  if (!table.value) {
    return null;
  }
  return {
    table: table.value,
  };
});
const viewSettingDrawerSlotRef = inject<Ref<HTMLElement | null>>(VIEW_SETTING_DRAWER_SLOT, ref(null));
const activeTab = inject<Ref<string>>(VIEW_ACTIVE_UID, ref(""));
const isTable = computed(() => {
  return props.currentTOC?.type === "table" && activeTab.value === props.currentTOC?.uid;
})
const nocodeTableRef = ref()
const recycleBinVisible = ref(false);
const isShowTable = ref(false);
const aggregateFieldPanelVisible = ref(false);
const currentAggregateFields = ref<TableAggregateField[]>([]);
let tableRenderTaskId = 0;
let isUnmounted = false;
const isTableRenderTaskActive = (taskId: number, tableUID = table.value?.uid) => {
  return !isUnmounted && props.active && !!tableUID && taskId === tableRenderTaskId && tableUID === table.value?.uid;
};
const aggregateFieldFilterContext = computed(() => {
  const body = nocode.value?.body;
  const currentTableUID = table.value?.uid;
  const nocodeId = nocode.value?.meta?.id;
  if (!body || !currentTableUID) return null;

  const currentDataSource = getNocodeDataSourceTableByUID(body, currentTableUID, { nocodeId }, true);
  const currentConnectionUID = currentDataSource?.connection?.uid as ConnectionUID | undefined;
  if (!currentConnectionUID) return null;

  const connections = getBoardConnectionsByNocodeBody(body, { nocodeId });
  const getContextTable = (optionTableUID?: OptionTableUID) => {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return undefined;
    return getNocodeDataSourceTableByOptionTableUID(body, optionTableUID, { nocodeId }, true)?.table;
  };

  return {
    topForm: {
      tableUID: [currentConnectionUID, currentTableUID] as OptionTableUID,
    },
    getBoard: () => ({
      nocodeId,
      getConnections: () => connections,
    }),
    getTable: (optionTableUID?: OptionTableUID | TableUID) => {
      if (!optionTableUID) return undefined;
      if (Array.isArray(optionTableUID)) return getContextTable(optionTableUID as OptionTableUID);
      return getContextTable([currentConnectionUID, optionTableUID as TableUID]);
    },
    getField: (path: [ConnectionUID?, TableUID?, FieldUID?, FieldUID?]) => {
      const [connectionUID = currentConnectionUID, tableUID = currentTableUID, fieldUID, subFieldUID] = path || [];
      if (!fieldUID) return undefined;

      const targetTable = getContextTable([connectionUID, tableUID]);
      const field = targetTable?.fields?.find(item => item.uid === fieldUID);
      if (!field) return undefined;
      if (!subFieldUID) return field;
      return field.subTableFields?.find(item => item.uid === subFieldUID);
    },
  };
});
const isShowAggregateFieldPanel = computed(() => !isMobile() && runtime === FormTableRuntime.FORM_EDITOR);
const isTableViewSettingVisible = computed(() => {
  return !isMobile()
    && !!viewSettingDrawerSlotRef.value
    && !showVirtualTableLab.value
    && isTable.value
    && !!nocodeTableRef.value
    && !!tableSettingBinding.value;
});
const syncCurrentAggregateFields = () => {
  currentAggregateFields.value = deepClone(editorTableMeta.value.aggregateFields || []);
};
const syncFilterColumns = async (taskId = tableRenderTaskId, tableUID = table.value?.uid) => {
  await nextTick();
  if (!isTableRenderTaskActive(taskId, tableUID)) return;
  const columns = nocodeTableRef.value?.getAllColumns?.();
  filterColumns.value = Array.isArray(columns) ? [...columns] : [];
};
const initTableElement = async () => {
  const taskId = ++tableRenderTaskId;
  const tableUID = table.value?.uid;
  isShowTable.value = false;
  await nextTick();
  if (!isTableRenderTaskActive(taskId, tableUID)) return;
  isShowTable.value = true;
  await nextTick();
  if (!isTableRenderTaskActive(taskId, tableUID)) return;
  await syncFilterColumns(taskId, tableUID);
}
const initViewerTableElement = async () => {
  const taskId = ++tableRenderTaskId;
  const tableUID = table.value?.uid;
  isShowTable.value = true;
  await nextTick();
  if (!isTableRenderTaskActive(taskId, tableUID)) return;
  await syncFilterColumns(taskId, tableUID);
}
watch(
  () => ({
    hiddenColumns: viewerPreHiddenColumns.value || [],
    columnOrders: viewerPreColumnOrders.value || {},
  }),
  async (value, oldValue) => {
    if ([FormTableRuntime.FORM_EDITOR].includes(runtime)) return;
    if (!props.active || !nocodeTableRef.value) return;
    if (!oldValue) return;
    const taskId = tableRenderTaskId;
    const tableUID = table.value?.uid;
    const hiddenColumnsChanged = !equals(value.hiddenColumns, oldValue.hiddenColumns || []);
    const columnOrdersChanged = !equals(value.columnOrders, oldValue.columnOrders || {});
    if (!hiddenColumnsChanged && !columnOrdersChanged) {
      return;
    }
    await nextTick();
    if (!isTableRenderTaskActive(taskId, tableUID) || !nocodeTableRef.value) return;
    nocodeTableRef.value?.refreshColumns?.();
    await syncFilterColumns(taskId, tableUID);
  },
  { flush: 'post' }
)
watch(
  () => ({
    viewUid: props.currentTOC?.uid || "",
    hiddenColumns: props.currentTOC?.hiddenColumns || [],
    columnOrders: props.currentTOC?.columnOrders || {},
  }),
  async (value, oldValue) => {
    if (![FormTableRuntime.FORM_EDITOR].includes(runtime)) return;
    if (!props.active || !nocodeTableRef.value) return;
    if (!oldValue) return;
    const taskId = tableRenderTaskId;
    const tableUID = table.value?.uid;
    const hiddenColumnsChanged = !equals(value.hiddenColumns, oldValue.hiddenColumns || []);
    const columnOrdersChanged = !equals(value.columnOrders, oldValue.columnOrders || {});
    if (!hiddenColumnsChanged && !columnOrdersChanged) {
      return;
    }
    await nextTick();
    if (!isTableRenderTaskActive(taskId, tableUID) || !nocodeTableRef.value) return;
    nocodeTableRef.value?.refreshColumns?.();
    await syncFilterColumns(taskId, tableUID);
  },
  { flush: 'post', deep: true }
)
watch(() => {
  if (!props.active) return null;
  return table.value?.uid;
}, async (value) => {
  if (!value) {
    tableRenderTaskId += 1;
    filterColumns.value = [];
    return;
  }
  if ([FormTableRuntime.FORM_EDITOR].includes(runtime)) {
    await initTableElement();
    return;
  }
  await initViewerTableElement();
}, { immediate: true });
watch(() => table.value?.uid, (value) => {
  if (!value) {
    tableRenderTaskId += 1;
    filterColumns.value = [];
  }
  aggregateFieldPanelVisible.value = false;
  syncCurrentAggregateFields();
}, { immediate: true });
watch(() => editorTableMeta.value.aggregateFields, () => {
  if (aggregateFieldPanelVisible.value) return;
  syncCurrentAggregateFields();
}, { deep: true });
watch(() => props.active, (value) => {
  if (value) return;
  tableRenderTaskId += 1;
  filterColumns.value = [];
  aggregateFieldPanelVisible.value = false;
});
const getAddPermission = computed(() => {
  const addPermission = nocode.value.body.permissions?.data?.[table.value?.uid]?.add;
  if (!addPermission) return true;
  const account = passportState.account
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments)
  if(addPermission?.rangeType === 'custom' && !account.isAdmin) {
    if(addPermission.range.users.includes(account.id)) {
      return true
    }
    if(addPermission.range.roles.some(role => account.roles.includes(role))) {
      return true
    }
    if(addPermission.range.departments.some(dep => departments.includes(dep))) {
      return true
    }
    return false
  }
  return true
})

const getOtherPermission = computed(() => {
  const currentTableUID = table.value?.uid;
  if (!currentTableUID) {
    return { delete: true, update: true }
  }
  const account = passportState.account
  if(account.isAdmin) {
    return { delete: true, update: true }
  }
  if(isEmpty(nocode.value?.body?.permissions?.data?.[currentTableUID]?.other?.length)) {
    return { delete: true, update: true }
  }
  const result = {
    delete: false,
    update: false
  }
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments);

  const permissions = nocode.value?.body?.permissions?.data?.[currentTableUID]?.other ?? []
  for(const permission of permissions) {
    const needHandle = (permission.handleRange.delete && !result.delete) || (permission.handleRange.update && !result.update);
    if(!needHandle) continue;
    if(
      permission.memberRange?.rangeType === 'all' ||
      permission.memberRange?.range?.users?.includes(account.id) || 
      permission.memberRange?.range?.roles?.some(role => account.roles?.includes(role)) ||
      permission.memberRange?.range?.departments?.some(dep => departments.includes(dep))
    ) {
      result.delete = result.delete || permission.handleRange?.delete
      result.update = result.update || permission.handleRange?.update
    }
    if(result.delete && result.update) break;
  }
  return result
})
const handleAddData = () => {
  if (nocodeTableRef.value && getAddPermission.value) {
    nocodeTableRef.value.showFormRowDialog(FormMode.Add)
  }
}
const handleToggleAggregateFields = async () => {
  if (!isShowAggregateFieldPanel.value) return;
  if (!aggregateFieldPanelVisible.value) {
    syncCurrentAggregateFields();
  }
  aggregateFieldPanelVisible.value = !aggregateFieldPanelVisible.value;
}
const handleConfirmAggregateFields = (fields: TableAggregateField[]) => {
  const nextFields = deepClone(fields || []);
  currentAggregateFields.value = nextFields;
  if (nocode.value?.body?.formData) {
    if (!nocode.value.body.formData.metas) {
      nocode.value.body.formData.metas = {};
    }
    const currentTableUID = table.value?.uid;
    if (currentTableUID) {
      nocode.value.body.formData.metas[currentTableUID] = {
        ...(nocode.value.body.formData.metas[currentTableUID] || {}),
        aggregateFields: deepClone(nextFields),
      };
    }
  }
  nocodeTableRef.value?.updateTableViewMetaPatch?.({
    aggregateFields: nextFields,
  });
  aggregateFieldPanelVisible.value = false;
}
defineExpose({
  refreshData: () => nocodeTableRef.value?.refreshData?.(),
})
onBeforeUnmount(() => {
  isUnmounted = true;
  tableRenderTaskId += 1;
});
</script>
<style lang='scss' scoped>
.data-management {
  width: 100%;
  height: 100%;
  padding: 16px;
  .wrapper {
    height: 100%;
    background-color: var(--bg-color-page);
    display: flex;
    align-items: stretch;
    gap: 16px;

    .table-wrapper {
      flex: 1;
      min-width: 0;
      height: 100%;
      position: relative;

      .table-lab {
        width: 100%;
        height: 100%;
      }
    }

    .add-data-button {
      width: 48px;
      height: 48px;
      position: absolute;
      right: 40px;
      bottom: 136px;
      -webkit-tap-highlight-color: transparent;
      z-index: 1000;
    }
  }
  &.mobile {
    padding: 0 10px;
    .wrapper {
      gap: 0;
      .add-data-button {
        bottom: 100px;
      }
    }
  }
}
</style>
