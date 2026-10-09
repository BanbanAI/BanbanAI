import { ComputedRef, Ref } from "vue";
import { FieldUID, OptionTableUID, TableUID } from "@common/types/project";
import { FormCondition } from "@common/types/nocode";
import { FormTableRowHeight, FormTableViewMeta } from "@common/types/nocode";
import { Row } from "@common/types/project";
import { Column, Table } from "../table";
import { TableProps } from "../types";

export type DataManagementRowActivatePayload = {
  row: Row;
  rowKey: string | number | undefined;
  column?: Column | null;
};

export type DataManagementControllerOptions = {
  widget: Table;
  isShowCheck: boolean;
  isMultiple: boolean;
  clickRowChecked: boolean;
  clickRowShowDetail: boolean;
  rowDetailTrigger: "click" | "dblclick";
  isMobileDevice: boolean;
  onRowActivate?: (payload: DataManagementRowActivatePayload) => void;
};

export type DataManagementDisplayStateOptions = {
  widget: Table;
  props: TableProps;
  displayColumns: ComputedRef<Column[]>;
  rowHeightLevel: ComputedRef<FormTableRowHeight>;
  tableWidthData: ComputedRef<Record<string, number>>;
  sortFieldsMap: ComputedRef<Record<string, number | undefined>>;
  filterConditions: ComputedRef<Array<{ uid?: string | null; value?: any }>>;
  columnFilterInfo: Ref<FormCondition>;
  isFilterValueNotEmpty: ComputedRef<boolean>;
};

export type DataManagementDialogState = {
  visible: Ref<boolean>;
  row: Ref<Row | null>;
  rowKey: Ref<string>;
};

export type DataManagementViewActionState = {
  viewMeta: Ref<FormTableViewMeta | undefined>;
};

export type DataManagementDialogFormState = {
  mode: Ref<"add" | "edit">;
  startInEdit: Ref<boolean>;
  currentTableUID: Ref<TableUID>;
  nocodeFormProps: Ref<{
    nocodeId: string;
    nocodeSign: string;
    tableUID: OptionTableUID;
    uuid: string;
    row: Row | null;
  }>;
  readonlyHiddenColumnIds: ComputedRef<FieldUID[]>;
  contentRefreshKey: Ref<number>;
};
