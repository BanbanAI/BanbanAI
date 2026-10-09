export type VirtualTableFixed = "left" | "right";
export type VirtualTableAlign = "left" | "center" | "right";
export type VirtualTableVerticalAlign = "top" | "middle" | "bottom";
export type VirtualTableBodyHeightMode = "fill" | "content";
export type VirtualTableColumnKind = "index" | "selection" | "data" | "action" | "group" | "share-link";

export interface VirtualTableColumnMeta {
  kind?: VirtualTableColumnKind;
  allowUtilitySpan?: boolean;
  editable?: boolean;
  editorType?: string;
  sourceColumn?: any;
  [key: string]: any;
}

export interface VirtualTableCellProps {
  className?: string;
  style?: Record<string, string | number | undefined>;
}

export interface VirtualTableColumn {
  key: string;
  title?: string;
  dataIndex?: string;
  headerDepth?: number;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: VirtualTableFixed;
  align?: VirtualTableAlign;
  headerAlign?: VirtualTableAlign;
  className?: string;
  headerClassName?: string;
  children?: VirtualTableColumn[];
  meta?: VirtualTableColumnMeta;
}

export interface VirtualHeaderCell {
  key: string;
  title?: string;
  depth: number;
  colSpan: number;
  rowSpan: number;
  isLeaf: boolean;
  column: VirtualTableColumn;
}

export interface VirtualColumnPartitions {
  flat: {
    full: VirtualTableColumn[];
    left: VirtualTableColumn[];
    center: VirtualTableColumn[];
    right: VirtualTableColumn[];
  };
  nested: {
    full: VirtualTableColumn[];
    left: VirtualTableColumn[];
    center: VirtualTableColumn[];
    right: VirtualTableColumn[];
  };
}

export interface VirtualHorizontalRenderRange {
  leftIndex: number;
  leftBlank: number;
  rightIndex: number;
  rightBlank: number;
}

export type VirtualVisibleColumnDescriptor =
  | {
      type: "normal";
      key: string;
      column: VirtualTableColumn;
      columnIndex: number;
    }
  | {
      type: "blank";
      key: string;
      blankSide: "left" | "right";
      blankKind?: "virtual" | "filler";
      width: number;
    };

export type VirtualVisibleHeaderCell =
  | {
      type: "normal";
      key: string;
      title?: string;
      depth: number;
      colSpan: number;
      rowSpan: number;
      isLeaf: boolean;
      column: VirtualTableColumn;
      columnIndex: number;
      width: number;
      leafColumns: VirtualTableColumn[];
    }
  | {
      type: "placeholder";
      key: string;
      width: number;
      leafColumns: VirtualTableColumn[];
    }
  | {
      type: "blank";
      key: string;
      blankSide: "left" | "right";
      blankKind?: "virtual" | "filler";
      width: number;
    };

export interface VirtualStickyOffsets {
  left: Record<string, number>;
  right: Record<string, number>;
}

export interface VirtualWindow {
  start: number;
  end: number;
  offsetTop: number;
  offsetBottom: number;
  totalHeight: number;
}

export interface VirtualTableCellSpan {
  rowSpan: number;
  colSpan: number;
}

export interface VirtualPlannedCellSpan extends VirtualTableCellSpan {
  hidden: boolean;
}

export interface VirtualTableRowSpanBoundary {
  start: number;
  end: number;
}

export type VirtualTableRenderRegion = "header" | "body" | "footer";

export interface VirtualTableCellSlotCommonProps {
  region: VirtualTableRenderRegion;
  column: VirtualTableColumn;
  columnKey: string;
  columnIndex: number;
  leafColumns: VirtualTableColumn[];
  isLeaf: boolean;
  row?: Record<string, any>;
  rowIndex?: number;
  value?: any;
  editable: boolean;
  isEditing: boolean;
  startEdit: () => void;
}

export interface VirtualTableHeaderCellSlotProps extends VirtualTableCellSlotCommonProps {
  region: "header";
  cell: Extract<VirtualVisibleHeaderCell, { type: "normal" }>;
}

export interface VirtualTableBodyCellSlotProps extends VirtualTableCellSlotCommonProps {
  region: "body";
  descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>;
  row: Record<string, any>;
  rowIndex: number;
}

export interface VirtualTableFooterCellSlotProps extends VirtualTableCellSlotCommonProps {
  region: "footer";
  descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>;
}
