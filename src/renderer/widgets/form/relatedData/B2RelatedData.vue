<template>
  <b2-select-data class="related-data-button" :class="{'mobile': isMobileDevice}" v-if="!widget.isReadonly">
    <template v-if="widget.isRelated">
      <related-label />
      <el-icon class="related-data-close" :size="16" @click.stop="handleCancelFillData"><i-ep-circle-close-filled /></el-icon>
    </template>
    <template v-else>
      <el-icon :size="16"><i-icon-park-outline-database-sync /></el-icon>
      <span class="text">{{ showButtonText }}</span>
    </template>
    <teleport to="body">
      <select-connection-table-dialog v-model="dialogVisible"></select-connection-table-dialog>
    </teleport>
  </b2-select-data>
  <b2-form-element v-else>
    <div class="value" :class="{'mobile': isMobileDevice}">
      <el-tag class="tag" v-for="item,index in widget.dataRows" :key="index" effect="dark" :title="item" @click.stop="handleClickTag(index)">{{ item }}</el-tag>
    </div>
  </b2-form-element>
  <teleport to="body">
    <template v-if="isMobileDevice">
      <mobile-data-form-dialog
        v-for="(item, index) in relatedDetailDialogStack"
        :key="item.id"
        :modelValue="item.visible"
        @update:modelValue="handleRelatedDetailModelValueChange(index, $event)"
        :title="item.title"
        :nocodeFormProps="item.nocodeFormProps"
        :form-mode="FormMode.Edit"
        :contentRefreshKey="item.contentRefreshKey"
        :showDisplayFields="false"
        :isEditDataAble="widget.allowEditRow"
        :isDeleteDataAble="false"
        :isRelatedDetailDialog="true"
        @submitted="handleSubmitted(index)"
        @deleted="handleDeleted(index)"
      />
    </template>
    <template v-else>
      <base-data-form-dialog
        v-for="(item, index) in relatedDetailDialogStack"
        :key="item.id"
        :modelValue="item.visible"
        @update:modelValue="handleRelatedDetailModelValueChange(index, $event)"
        :title="item.title"
        :nocodeFormProps="item.nocodeFormProps"
        :form-mode="FormMode.Edit"
        :contentRefreshKey="item.contentRefreshKey"
        :showDisplayFields="false"
        :isEditDataAble="widget.allowEditRow"
        :isDeleteDataAble="false"
        :isRelatedDetailDialog="true"
        @submitted="handleSubmitted(index)"
        @deleted="handleDeleted(index)"
      />
    </template>
  </teleport>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { OptionTableUID } from "@common/types/project";
import { useWidget } from "@renderer/b2/types";
import { SELECTED_WIDGETS } from "@renderer/types/inject";
import { computed, defineAsyncComponent, inject, onBeforeUnmount, ref, watch } from "vue";
import type { NocodeBody, NocodeFormData } from "@common/types/nocode";
import IIconParkOutlineDatabaseSync from "~icons/icon-park-outline/database-sync";
import IEpCircleCloseFilled from "~icons/ep/circle-close-filled";
import { RelatedData } from "./relatedData";
import { component as B2SelectData } from "@renderer/widgets/form/selectData";
import RelatedLabel from './RelatedLabel.vue';
import SelectConnectionTableDialog from "./SelectConnectionTableDialog.vue";
import { equals, isEmpty } from "@common/utils/object";
import { FormMode } from "../_common/type";
import { Row } from "@common/types/project";
import axios from "axios";
import i18next, { $t } from "@renderer/widgets/i18next";

const BaseDataFormDialog = defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/BaseDataFormDialog.vue"));
const MobileDataFormDialog = defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/MobileDataFormDialog.vue"));

const autoOpenedWidgetUids = new Set<string>();

const isMobileDevice = isMobile();

const widget = useWidget<RelatedData>();
const selectedWidgets = inject(SELECTED_WIDGETS);
const isWidgetSelected = computed(() => {
  return selectedWidgets?.value?.[0]?.uid === widget.uid;
});
const dialogVisible = ref(false);
const dataUid = ref();

(widget as RelatedData & {
  showConnectionTableDialog?: () => void;
  hideConnectionTableDialog?: () => void;
}).showConnectionTableDialog = () => {
  dialogVisible.value = true;
};

(widget as RelatedData & {
  showConnectionTableDialog?: () => void;
  hideConnectionTableDialog?: () => void;
}).hideConnectionTableDialog = () => {
  dialogVisible.value = false;
};

onBeforeUnmount(() => {
  delete (widget as RelatedData & {
    showConnectionTableDialog?: () => void;
    hideConnectionTableDialog?: () => void;
  }).showConnectionTableDialog;
  delete (widget as RelatedData & {
    showConnectionTableDialog?: () => void;
    hideConnectionTableDialog?: () => void;
  }).hideConnectionTableDialog;
});

type RelatedDetailDialogPayload = {
  relatedTableUID: OptionTableUID;
  uuid: string;
  row?: Row | null;
  fieldUID?: string;
  sourceContext?: {
    nocodeId: string;
    tableUID?: OptionTableUID;
    formData?: NocodeFormData;
    otherDataSources?: NocodeBody["otherDataSources"];
  };
};

type RelatedDetailDialogState = {
  id: string;
  visible: boolean;
  contentRefreshKey: number;
  title: string;
  nocodeFormProps: {
    nocodeId: string;
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
    relatedDetailHandler: (payload: RelatedDetailDialogPayload) => void;
  };
};

let relatedDetailDialogSeq = 0;
const relatedDetailDialogStack = ref<RelatedDetailDialogState[]>([]);
const relatedDetailBodyCache = new Map<string, NocodeBody | null>();

const getBoardSourceContext = () => {
  const board = widget.getBoard() as any;
  const nocodeBody = board?.projectContext?.pagePermissionContext?.nocodeBody;
  return {
    nocodeId: board?.nocodeId || widget.nocodeId,
    tableUID: widget.topForm?.tableUID,
    formData: nocodeBody?.formData,
    otherDataSources: nocodeBody?.otherDataSources || nocodeBody?.otherDataSourceSchemas || [],
  };
};

const getTargetNocodeId = (payload: RelatedDetailDialogPayload, fallbackConnectionTable: OptionTableUID = widget.connectionTable) => {
  const connectionTable = payload.relatedTableUID || fallbackConnectionTable;
  const [connectionUID] = connectionTable || [];
  const sourceContext = payload.sourceContext;
  const sourceConnections = [
    sourceContext?.formData,
    ...(sourceContext?.otherDataSources || []),
  ].filter(Boolean);
  const sourceConnection = sourceConnections.find((item: any) => item?.uid === connectionUID);
  const liveConnection = widget.getBoard().getConnections?.().find((item: any) => item?.uid === connectionUID);
  return sourceConnection?.nocodeId || liveConnection?.nocodeId || sourceContext?.nocodeId || widget.nocodeId;
}

const loadRelatedDetailPermissionBody = async (nocodeId?: string) => {
  if (!nocodeId) {
    return null;
  }
  if (relatedDetailBodyCache.has(nocodeId)) {
    return relatedDetailBodyCache.get(nocodeId) || null;
  }
  const body = await axios.get(`/project/get-nocode-body/${nocodeId}`)
    .then(({ data }) => data as NocodeBody)
    .catch(() => null);
  relatedDetailBodyCache.set(nocodeId, body);
  return body;
};

const getRelatedDetailPermissionSource = (
  tableUID?: string,
  permissionBody?: NocodeBody | null,
  sourceContext?: RelatedDetailDialogPayload["sourceContext"],
) => {
  if (!tableUID) {
    return permissionBody || undefined;
  }
  const targetDataSource = (permissionBody?.otherDataSources || []).find((source) => {
    return (source.tables || []).some((table) => table.uid === tableUID);
  });
  if (targetDataSource && (targetDataSource as any)?.permissions) {
    return { permissions: (targetDataSource as any).permissions } as Pick<NocodeBody, "permissions">;
  }
  if (permissionBody?.permissions) {
    return permissionBody;
  }
  const fallbackSource = (sourceContext?.otherDataSources || []).find((source) => {
    return (source.tables || []).some((table) => table.uid === tableUID);
  });
  return fallbackSource && (fallbackSource as any)?.permissions
    ? ({ permissions: (fallbackSource as any).permissions } as Pick<NocodeBody, "permissions">)
    : undefined;
};

const loadRelatedDetailFormContext = async (nocodeId: string, tableUID: string, uuid: string) => {
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
  }).catch(() => null);
};

const closeRelatedDetailDialogsFromIndex = (index: number) => {
  if (index < 0 || index >= relatedDetailDialogStack.value.length) {
    return;
  }
  relatedDetailDialogStack.value.splice(index);
}

const handleRelatedDetailModelValueChange = (index: number, value: boolean) => {
  if (value) {
    const target = relatedDetailDialogStack.value[index];
    if (target) {
      target.visible = true;
    }
    return;
  }
  closeRelatedDetailDialogsFromIndex(index);
}

const refreshRelatedDetailDialogAtIndex = (index: number) => {
  const target = relatedDetailDialogStack.value[index];
  if (!target) {
    return;
  }
  target.nocodeFormProps = {
    ...target.nocodeFormProps,
    row: null,
  };
  target.contentRefreshKey += 1;
}

const openRelatedDetailDialog = async (payload: RelatedDetailDialogPayload) => {
  const sourceContext = payload.sourceContext || getBoardSourceContext();
  const targetNocodeId = getTargetNocodeId({
    ...payload,
    sourceContext,
  });
  const [detailContext, permissionBody] = await Promise.all([
    loadRelatedDetailFormContext(targetNocodeId, payload.relatedTableUID?.[1], payload.uuid),
    loadRelatedDetailPermissionBody(targetNocodeId),
  ]);
  const resolvedOtherDataSources = detailContext?.otherDataSources || sourceContext.otherDataSources || [];
  const permissionSourceContext = detailContext?.formData
    ? {
      nocodeId: targetNocodeId,
      tableUID: payload.relatedTableUID,
      formData: detailContext.formData,
      otherDataSources: resolvedOtherDataSources,
    }
    : sourceContext;
  relatedDetailDialogStack.value.push({
    id: `related-detail-${Date.now()}-${relatedDetailDialogSeq++}`,
    visible: true,
    contentRefreshKey: 0,
    title: i18next.t("relatedData"),
    nocodeFormProps: {
      nocodeId: targetNocodeId,
      tableUID: payload.relatedTableUID,
      uuid: payload.uuid,
      row: detailContext?.row || payload.row || null,
      bootstrapData: detailContext?.formData
        ? {
          formData: detailContext.formData,
          otherDataSources: resolvedOtherDataSources,
        }
        : (sourceContext.formData ? {
          formData: sourceContext.formData,
          otherDataSources: sourceContext.otherDataSources || [],
        } : undefined),
      permissionContextOverride: {
        nocodeBody: permissionBody || undefined,
        getPermissionBody: (tableId?: string) => getRelatedDetailPermissionSource(
          tableId || payload.relatedTableUID?.[1],
          permissionBody,
          permissionSourceContext,
        ),
      },
      relatedDetailHandler: openRelatedDetailDialog,
    },
  });
}

const handleCancelFillData = () => {
  widget.onFillData({});
}

const handleClickTag = (index) => {
  const rows = Object.values(widget.selectedRows)[index] || [];
  dataUid.value = rows[0]?.[widget.uuidKey];
  const targetRow = rows[0] || null;
  const payload = {
    relatedTableUID: widget.connectionTable,
    uuid: dataUid.value,
    row: targetRow,
    fieldUID: widget.fieldId,
    sourceContext: getBoardSourceContext(),
  };
  const relatedDetailHandler = (widget.getBoard() as any)?.projectContext?.openRelatedDetail;
  if (relatedDetailHandler) {
    relatedDetailHandler(payload);
    return;
  }
  openRelatedDetailDialog(payload);
}

type SelectedRows = Record<string, any[]>;

const getDataValue = () => {
  const value = widget.dataValue as unknown as string[] | string | undefined;
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

const buildSelectedRows = (
  value: string[],
  rows: Record<string, any>[] = [],
  previousRows: SelectedRows = {},
  removedUuid?: string,
) => {
  return value.reduce<SelectedRows>((prev, uuid) => {
    if (uuid === removedUuid) {
      return prev;
    }
    const matchedRows = rows.filter(row => row[widget.uuidKey] === uuid);
    if (!isEmpty(matchedRows)) {
      prev[uuid] = matchedRows;
      return prev;
    }
    // A filtered or paged response is not proof that the relation was
    // removed. Preserve an already hydrated row until a subsequent lookup.
    const previous = previousRows?.[uuid];
    if (!isEmpty(previous)) {
      prev[uuid] = deepClone(previous);
    }
    return prev;
  }, {});
}

const refreshData = async ({
  force = false,
  triggerFillRules = false,
  preserveMissing = !force,
  removedUuid,
}: {
  force?: boolean;
  triggerFillRules?: boolean;
  preserveMissing?: boolean;
  removedUuid?: string;
} = {}) => {
  if (isEmpty(widget.connectionTable)) return;
  // A persisted value can mark the widget as changed while its selected rows
  // are still empty during row initialization. Only skip refresh after rows
  // have already been restored from the current user selection.
  if (!force && widget.isChanged && !isEmpty(widget.selectedRows)) return;

  const value = getDataValue();
  if (isEmpty(value)) {
    if (!isEmpty(widget.selectedRows)) {
      widget.selectedRows = {};
    }
    return;
  }

  const [cUid, tUid] = widget.connectionTable;
  const uuidKey = widget.uuidKey;
  if (!uuidKey) return;
  const res = await widget.getData().getPagingRows([cUid, tUid], {
    filters: {
      [tUid]: [{ [uuidKey]: { $in: value } }],
    },
  });

  const previousRows = preserveMissing ? widget.selectedRows : {};
  const nextSelectedRows = buildSelectedRows(value, res?.rows || [], previousRows, removedUuid);
  if (triggerFillRules && !isEmpty(nextSelectedRows)) {
    await widget.onFillData(nextSelectedRows);
    return;
  }

  if (!equals(widget.selectedRows, nextSelectedRows)) {
    if (removedUuid) {
      // A deletion is a real user change. Sync the filtered IDs back to the
      // row so the raw-value fallback cannot restore the deleted UUID.
      await widget.onFillData(nextSelectedRows);
    } else {
      widget.selectedRows = nextSelectedRows;
    }
  }
}

watch(() => [
  widget.dataValue as unknown as string[] | string,
  widget.connectionTable.join(","),
  widget.uuidKey,
], async () => {
  const shouldTriggerFillRules =
    widget.getBoard().formMode === FormMode.Add
    && !widget.isChanged
    && !isEmpty(widget.fillRules)
    && isEmpty(widget.selectedRows)
    && !isEmpty(getDataValue());

  await refreshData({
    triggerFillRules: shouldTriggerFillRules,
  });
}, { immediate: true });

watch(() => [isEmpty(widget.connectionTable), widget.isEditable, isWidgetSelected.value], ([isEmptyConnectionTable, isEditable, widgetSelected]) => {
  if (!isEmptyConnectionTable || !isEditable || !widgetSelected) {
    autoOpenedWidgetUids.delete(widget.uid);
    return;
  }

  // 只让当前选中的空关联字段自动弹窗，避免同页多个实例同时打开
  if (autoOpenedWidgetUids.has(widget.uid)) return;
  autoOpenedWidgetUids.add(widget.uid);
  dialogVisible.value = true;
}, { immediate: true });

const handleSubmitted = async (index: number) => {
  closeRelatedDetailDialogsFromIndex(index);
  await refreshData({ force: true, preserveMissing: true });
  if (index - 1 >= 0) {
    refreshRelatedDetailDialogAtIndex(index - 1);
  }
}

const handleDeleted = async (index: number) => {
  const removedUuid = relatedDetailDialogStack.value[index]?.nocodeFormProps.uuid;
  closeRelatedDetailDialogsFromIndex(index);
  await refreshData({ force: true, preserveMissing: true, removedUuid });
  if (index - 1 >= 0) {
    refreshRelatedDetailDialogAtIndex(index - 1);
  }
}

const showButtonText = computed(() => {
  if (isConnectionTableEmpty.value) {
    return i18next.t("unconfiguredRelatedForm")
  }
  return widget.buttonText;
})
// 是否有连接表
const isConnectionTableEmpty = computed(() => {
  return isEmpty(widget.connectionTable)
})
</script>

<style lang="scss" scoped>
:deep() .related-data-button {
  position: relative;

  >span:has(.related-label) {
    justify-content: start;
  }

  .related-data-close {
    position: absolute;
    right: 15px;
    display: none;
    color: var(--text-color-regular);

    &:hover {
      color: unset;
    }
  }

  &:hover .related-data-close{
    display: unset;
  }

  &.mobile {
    padding-right: 0;

    > span {
      height: 100%;
    }

    .related-data-close {
      width: auto;
      height: 100%;
      aspect-ratio: 1 / 1;
      color: var(--text-color-placeholder);
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }
}
.value {
  display: flex;
  height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;

  .el-tag {
    border: none;
    cursor: pointer;
  }
  .el-tag:not(:last-child) {
    margin-right: 2px;
  }
}

.select-data-button.mobile {
  border-radius: 4px;
  background-color: #fff;
  height: 40px;
  padding: 0 12px;
}
.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}
</style>

