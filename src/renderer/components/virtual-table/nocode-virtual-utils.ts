import { FieldUID } from "@common/types/project";
import i18next from "i18next";
import { resolveNocodeColumnFixed, resolveNocodeColumnWidth } from "./features/column-sizing";
import { VirtualTableCellSpan, VirtualTableColumn, VirtualTableRowSpanBoundary } from "./types";

type NocodeDisplayColumn = {
  uid: FieldUID;
  alias: string;
  type?: string;
  subColumns?: NocodeDisplayColumn[];
  isSubColumn?: boolean;
};

type BuildNocodeVirtualColumnsOptions = {
  displayColumns: NocodeDisplayColumn[];
  tableWidthData?: Record<string, number>;
  isShowCheck?: boolean;
  showIndexColumn?: boolean;
  showTableActionPanel?: boolean;
  tableActionColumnWidth?: number;
  isFixedColumn?: (uid: FieldUID) => string | undefined;
  appendColumns?: VirtualTableColumn[];
};

type BuildNocodeRowSpanBoundariesRow = {
  _merge?: boolean;
  _mergeRow?: number;
};

type ResolveNocodeCellSpanOptions<T extends BuildNocodeRowSpanBoundariesRow> = {
  row: T;
  rowIndex: number;
  column: VirtualTableColumn;
  rowSpanBoundaries: Map<number, VirtualTableRowSpanBoundary>;
};

type GetNocodeVirtualRowKeyOptions<T extends Record<string, any>> = {
  row?: T;
  rowKey: string;
  rowIndex: number;
};

const DEFAULT_COLUMN_WIDTH = 150;

const isNocodeNumberColumn = (column: NocodeDisplayColumn) => {
  return column.type === "number";
};

const mapLeafColumn = (
  column: NocodeDisplayColumn,
  options: BuildNocodeVirtualColumnsOptions,
  parentColumn?: NocodeDisplayColumn,
  inheritedFixed?: "left" | "right",
): VirtualTableColumn => {
  const fixed = resolveNocodeColumnFixed(column.uid, options.isFixedColumn) || inheritedFixed;
  const isNumberColumn = isNocodeNumberColumn(column);
  return {
    key: column.uid,
    dataIndex: column.uid,
    title: column.alias,
    width: resolveNocodeColumnWidth({
      uid: column.uid,
      tableWidthData: options.tableWidthData,
      fallbackWidth: DEFAULT_COLUMN_WIDTH,
    }),
    resizable: true,
    fixed: fixed as "left" | "right" | undefined,
    align: isNumberColumn ? "right" : undefined,
    meta: {
      kind: "data",
      sourceColumn: column,
      parentColumn,
    },
  };
};

export const buildNocodeVirtualColumns = (options: BuildNocodeVirtualColumnsOptions) => {
  const columns = (options.displayColumns || []).map((column) => {
    if (column.subColumns?.length) {
      const groupFixed = resolveNocodeColumnFixed(column.uid, options.isFixedColumn) as "left" | "right" | undefined;
      return {
        key: column.uid,
        title: column.alias,
        fixed: groupFixed,
        children: column.subColumns.map((child) => mapLeafColumn(child, options, column, groupFixed)),
        meta: {
          kind: "group",
          sourceColumn: column,
        },
      } satisfies VirtualTableColumn;
    }

    return mapLeafColumn(column, options);
  });

  const utilityColumns: VirtualTableColumn[] = [];

  if (options.isShowCheck) {
    utilityColumns.push({
      key: "__selection__",
      title: "",
      width: 56,
      resizable: false,
      fixed: "left",
      meta: {
        kind: "selection",
        allowUtilitySpan: true,
      },
    });
  }

  if (options.showIndexColumn) {
    utilityColumns.push({
      key: "__index__",
      title: "",
      width: 56,
      resizable: false,
      fixed: "left",
      align: "center",
      headerAlign: "center",
      meta: {
        kind: "index",
        allowUtilitySpan: true,
      },
    });
  }

  columns.unshift(...utilityColumns);

  if (options.showTableActionPanel) {
    columns.push({
      key: "__action__",
      title: i18next.t("nocodeVirtualUtils.actionColumn"),
      width: options.tableActionColumnWidth || 180,
      resizable: false,
      fixed: "right",
      meta: {
        kind: "action",
        allowUtilitySpan: true,
      },
    });
  }

  if (options.appendColumns?.length) {
    columns.push(...options.appendColumns);
  }

  return columns;
};

export const buildNocodeRowSpanBoundaries = <T extends BuildNocodeRowSpanBoundariesRow>(rows: T[] = []) => {
  const boundaries = new Map<number, VirtualTableRowSpanBoundary>();

  rows.forEach((row, rowIndex) => {
    const rowSpan = Math.max(0, Math.floor(Number(row?._mergeRow) || 0));
    if (!row?._merge || rowSpan <= 1) {
      return;
    }

    const boundary = {
      start: rowIndex,
      end: Math.min(rows.length - 1, rowIndex + rowSpan - 1),
    } satisfies VirtualTableRowSpanBoundary;

    for (let index = boundary.start; index <= boundary.end; index += 1) {
      boundaries.set(index, boundary);
    }
  });

  return boundaries;
};

export const resolveNocodeCellSpan = <T extends BuildNocodeRowSpanBoundariesRow>(options: ResolveNocodeCellSpanOptions<T>): VirtualTableCellSpan => {
  const sourceColumn = options.column.meta?.sourceColumn;
  if (options.column.meta?.kind === "group" || sourceColumn?.isSubColumn || !options.row?._merge) {
    return {
      rowSpan: 1,
      colSpan: 1,
    };
  }

  const boundary = options.rowSpanBoundaries.get(options.rowIndex);
  if (!boundary) {
    return {
      rowSpan: 1,
      colSpan: 1,
    };
  }

  if (boundary.start !== options.rowIndex) {
    return {
      rowSpan: 0,
      colSpan: 0,
    };
  }

  return {
    rowSpan: boundary.end - boundary.start + 1,
    colSpan: 1,
  };
};

export const getNocodeVirtualRowKey = <T extends Record<string, any>>(options: GetNocodeVirtualRowKeyOptions<T>) => {
  const rowValue = options.row?.[options.rowKey];
  const normalizedRowValue = rowValue === undefined || rowValue === null ? "row" : String(rowValue);
  return `${normalizedRowValue}::${options.rowIndex}`;
};
