import type { Ref } from "vue";
import type { FormWidgetType, FormTableRowHeight } from "../../../../../../../common/types/nocode";
import type { Row } from "../../../../../../../common/types/project";
import type { Table } from "../table";

export type NocodeTableEditorType = "nocode-widget-inline" | "nocode-widget-popup";

export type NocodeTableColumnLike = {
  field: string;
  title?: string;
  params: {
    isSubColumn?: boolean;
    parentUID?: string;
    tableUID?: string;
    elementId?: string;
    extra?: {
      widgetType?: FormWidgetType;
      [key: string]: any;
    };
    [key: string]: any;
  };
};

export type NocodeTableEditingTableProps = {
  isEditDataAble?: boolean;
  isTableCellEditable?: boolean;
  preViewFilterRules?: Array<{ conditions?: Array<{ uid?: string | null }> }>;
  preFilterRule?: { conditions?: Array<{ uid?: string | null }> } | null;
  openAssignOwnerDialog?: (options?: {
    rows?: Row[];
    initialOwnerId?: string;
    onSubmit?: (rows?: Row[]) => Promise<void> | void;
  }) => void;
};

export type ResolveNocodeTableEditorOptions = {
  editable: boolean;
  widgetType?: FormWidgetType;
  props?: Record<string, any>;
};

export type CommitNocodeTableCellEditOptions = {
  widget: Table | any;
  row: Row | Record<string, any>;
  column: NocodeTableColumnLike;
  previousValue?: any;
  nextValue: any;
  tableProps?: NocodeTableEditingTableProps;
};

export type UseNocodeTableEditingOptions = {
  widget: Table;
  rowHeightLevel: FormTableRowHeight;
  isCellEdit: boolean | Ref<boolean>;
  tableProps: NocodeTableEditingTableProps;
  isAdmin: boolean | Ref<boolean>;
};

export type NocodeTableEditorContext = {
  widget: Table;
  editingColumn: NocodeTableColumnLike;
  rowHeightLevel: FormTableRowHeight;
  presentationMode: "inline" | "popup";
};
