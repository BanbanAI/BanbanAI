import type { VirtualTableCellSpan, VirtualTableColumn } from "./types";

const UTILITY_SPAN_COLUMN_KINDS = new Set(["selection", "index", "action"]);

export const isVirtualTableUtilityColumn = (column?: VirtualTableColumn) => {
  return UTILITY_SPAN_COLUMN_KINDS.has(String(column?.meta?.kind || ""));
};

export const shouldAllowVirtualTableUtilitySpan = (column?: VirtualTableColumn) => {
  if (!isVirtualTableUtilityColumn(column)) {
    return true;
  }
  return Boolean(column?.meta?.allowUtilitySpan);
};

export const normalizeVirtualTableColumnSpan = (
  options: {
    column?: VirtualTableColumn;
    rawSpan?: Partial<VirtualTableCellSpan> | null;
  },
): VirtualTableCellSpan => {
  if (!shouldAllowVirtualTableUtilitySpan(options.column)) {
    return {
      rowSpan: 1,
      colSpan: 1,
    };
  }

  return {
    rowSpan: Math.max(0, Math.floor(Number(options.rawSpan?.rowSpan ?? 1))),
    colSpan: Math.max(0, Math.floor(Number(options.rawSpan?.colSpan ?? 1))),
  };
};
