export interface VirtualTableCellId {
  rowKey: string | number;
  columnKey: string;
}

export type VirtualTableEditorMode = "inline" | "popup";

export interface VirtualTableResolvedEditor {
  type: string;
  value?: any;
  props?: Record<string, any>;
  disabled?: boolean;
  readonly?: boolean;
  context?: Record<string, any>;
}

export interface VirtualTableEditorDefinition {
  type: string;
  mode: VirtualTableEditorMode;
  component: any;
  canCommitOnEnter?: boolean;
  canCommitOnBlur?: boolean;
  preserveOnScroll?: boolean;
}

export interface VirtualTableEditCommitContext<Row = Record<string, any>, Column = any> {
  cell: VirtualTableCellId;
  row: Row;
  column: Column;
  previousValue: any;
  nextValue: any;
  reason?: string;
  resolvedEditor?: VirtualTableResolvedEditor;
}

export type VirtualTableEditCommitResult<Row = Record<string, any>> =
  | { status: "patched"; row: Row }
  | { status: "refreshed" }
  | { status: "rejected"; message?: string };

export type VirtualTableEditingStatus =
  | "idle"
  | "activating"
  | "editing"
  | "committing"
  | "cancelling";

export interface VirtualTableEditSession {
  status: VirtualTableEditingStatus;
  cell: VirtualTableCellId | null;
  draftValue: any;
  initialValue: any;
  editorType?: string;
  mode?: VirtualTableEditorMode;
  reason?: string;
  errorMessage?: string;
  resolvedEditor?: VirtualTableResolvedEditor;
}

export interface VirtualTableEditAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}
