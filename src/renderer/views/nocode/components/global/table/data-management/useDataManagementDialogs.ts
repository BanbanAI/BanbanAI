import { computed, ref } from "vue";
import { FieldUID, OptionTableUID, Row, TableUID } from "@common/types/project";
import type { NocodeBody, NocodeFormData } from "@common/types/nocode";
import { FormMode } from "../types";
import type { Table } from "../table";

type UseDataManagementDialogsOptions = {
  nocodeId: string;
  widget: Table;
  getNocodeSign: () => string;
  getCurrentFormDataUID: () => string;
  getBootstrapDataForTable?: (tableUID: DetailTableUID) => {
    formData?: NocodeFormData;
    otherDataSources?: NocodeBody['otherDataSources'];
    otherDataSourceSchemas?: NocodeBody['otherDataSourceSchemas'];
    settings?: NocodeBody['settings'];
    fieldsAuth?: Record<string, number> | "all";
  } | undefined;
  getReadonlyHiddenColumnIds?: (tableUID: TableUID) => FieldUID[];
  getRelatedDetailHandler?: () => ((payload: {
    relatedTableUID: OptionTableUID;
    uuid: string;
    row?: Row | null;
    fieldUID?: string;
    sourceContext?: {
      nocodeId: string;
      tableUID?: OptionTableUID;
      formData?: NocodeFormData;
      otherDataSources?: NocodeBody['otherDataSources'];
    };
  }) => void) | undefined;
};

type DetailTableUID = TableUID | OptionTableUID;

export const useDataManagementDialogs = (options: UseDataManagementDialogsOptions) => {
  const getPlainTableUID = (tableUID: DetailTableUID) => {
    return Array.isArray(tableUID) ? tableUID[1] : tableUID;
  };

  const getOptionTableUID = (tableUID: DetailTableUID) => {
    return Array.isArray(tableUID)
      ? tableUID
      : [options.getCurrentFormDataUID?.() || "", tableUID] as OptionTableUID;
  };

  const detailVisible = ref(false);
  const detailRow = ref<Row | null>(null);
  const detailRowKey = ref("");
  const detailTableUID = ref<TableUID>(options.widget.formTableUID);
  const detailFormMode = ref<FormMode>(FormMode.Edit);
  const detailStartInEdit = ref(false);
  const detailContentRefreshKey = ref(0);
  const detailProcessRefreshKey = ref(0);
  const nocodeFormProps = ref({
    nocodeId: options.nocodeId,
    nocodeSign: "",
    tableUID: getOptionTableUID(options.widget.formTableUID),
    uuid: "",
    row: null as Row | null,
  });

  const readonlyHiddenColumnIds = computed(() => {
    return options.getReadonlyHiddenColumnIds?.(detailTableUID.value) || [];
  });

  const buildFormProps = (
    tableUID: DetailTableUID,
    row: Row | null,
    rowKey?: string | number,
    mode: FormMode = FormMode.Edit,
  ) => {
    const bootstrap = mode === FormMode.Add ? options.getBootstrapDataForTable?.(tableUID) : undefined;
    return {
      nocodeId: options.nocodeId,
      nocodeSign: options.getNocodeSign?.() || "",
      tableUID: getOptionTableUID(tableUID),
      uuid: rowKey === undefined || rowKey === null ? "" : String(rowKey),
      row,
      ...(bootstrap ? { bootstrapData: bootstrap } : {}),
      relatedDetailHandler: options.getRelatedDetailHandler?.(),
    };
  };

  const openDetail = (
    row: Row | null,
    rowKey?: string | number,
    tableUID: DetailTableUID = options.widget.formTableUID,
    mode: FormMode = FormMode.Edit,
    startInEdit = false,
  ) => {
    detailRow.value = row;
    detailRowKey.value = rowKey === undefined || rowKey === null ? "" : String(rowKey);
    detailTableUID.value = getPlainTableUID(tableUID);
    detailFormMode.value = mode;
    detailStartInEdit.value = startInEdit;
    nocodeFormProps.value = buildFormProps(tableUID, row, rowKey, mode);
    detailVisible.value = true;
  };

  const closeDetail = () => {
    detailVisible.value = false;
    detailRow.value = null;
    detailRowKey.value = "";
    detailTableUID.value = options.widget.formTableUID;
    detailStartInEdit.value = false;
    detailFormMode.value = FormMode.Edit;
    nocodeFormProps.value = buildFormProps(options.widget.formTableUID, null, "", FormMode.Edit);
  };

  const syncDetailRow = (row: Row | null, rowKey?: string | number) => {
    detailRow.value = row;
    detailRowKey.value = rowKey === undefined || rowKey === null ? detailRowKey.value : String(rowKey);
    nocodeFormProps.value = {
      ...nocodeFormProps.value,
      uuid: detailRowKey.value,
      row,
      nocodeSign: options.getNocodeSign?.() || nocodeFormProps.value.nocodeSign,
    };
  };

  const refreshDetailContent = () => {
    detailContentRefreshKey.value += 1;
  };

  const refreshDetailProcess = () => {
    detailProcessRefreshKey.value += 1;
  };

  const setFormMode = (mode: FormMode, startInEdit = false) => {
    detailFormMode.value = mode;
    detailStartInEdit.value = startInEdit;
  };

  return {
    detailVisible,
    detailRow,
    detailRowKey,
    detailTableUID,
    detailFormMode,
    detailStartInEdit,
    detailContentRefreshKey,
    detailProcessRefreshKey,
    nocodeFormProps,
    readonlyHiddenColumnIds,
    openDetail,
    closeDetail,
    syncDetailRow,
    refreshDetailContent,
    refreshDetailProcess,
    setFormMode,
  };
};
