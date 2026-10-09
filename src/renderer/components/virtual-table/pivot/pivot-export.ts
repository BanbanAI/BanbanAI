import i18next from "i18next";
import { buildHeaderRows, flattenVirtualColumns } from "../column-utils";
import type { VirtualHeaderCell, VirtualTableCellSpan, VirtualTableColumn } from "../types";
import buildCrossTable from "./cross-table/buildCrossTable";
import type { BuildCrossTableResult } from "./cross-table/buildCrossTable";
import type { CrossTableCornerHeaderRow } from "./cross-table/interfaces";
import buildCrossTreeTable from "./cross-tree-table/buildCrossTreeTable";
import type { CrossTreePrimaryColumn } from "./cross-tree-table/interfaces";
import type { PivotTableModel } from "./model";

export type PivotTableExportMode = "cross" | "tree";

export type PivotTableExportCellAddress = {
  r: number;
  c: number;
};

export type PivotTableExportMerge = {
  s: PivotTableExportCellAddress;
  e: PivotTableExportCellAddress;
};

export type PivotTableExportData = {
  data: any[][];
  merges: PivotTableExportMerge[];
  columns: VirtualTableColumn[];
  sourceRows: Record<string, any>[];
  headerRowCount: number;
  sheetName: string;
};

export type BuildPivotTableExportDataOptions = {
  mode?: PivotTableExportMode;
  defaultColumnWidth?: number;
  cornerHeaderRows?: CrossTableCornerHeaderRow[];
  treePrimaryColumn?: CrossTreePrimaryColumn;
  treeOpenKeys?: string[];
  treeIndentSize?: number;
  sheetName?: string;
};

const normalizeExportCellValue = (value: any) => {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeExportCellValue).join(",");
  }
  const text = String(value);
  return text === "[object Object]" ? "" : text;
};

const pushMerge = (
  merges: PivotTableExportMerge[],
  startRow: number,
  startColumn: number,
  rowSpan: number,
  colSpan: number,
) => {
  if (rowSpan <= 1 && colSpan <= 1) {
    return;
  }

  merges.push({
    s: {
      r: startRow,
      c: startColumn,
    },
    e: {
      r: startRow + Math.max(1, rowSpan) - 1,
      c: startColumn + Math.max(1, colSpan) - 1,
    },
  });
};

const buildHeaderExportRows = (
  columns: VirtualTableColumn[],
  merges: PivotTableExportMerge[],
) => {
  const headerRows = buildHeaderRows(columns);
  const leafColumnCount = flattenVirtualColumns(columns).length;
  const data = Array.from({ length: headerRows.length }, () => Array.from({ length: leafColumnCount }, () => ""));
  const occupied = Array.from({ length: headerRows.length }, () => Array.from({ length: leafColumnCount }, () => false));

  headerRows.forEach((row, rowIndex) => {
    let columnIndex = 0;

    row.forEach((cell: VirtualHeaderCell) => {
      while (occupied[rowIndex]?.[columnIndex]) {
        columnIndex += 1;
      }

      data[rowIndex][columnIndex] = normalizeExportCellValue(cell.title);
      pushMerge(merges, rowIndex, columnIndex, cell.rowSpan, cell.colSpan);

      for (let rowOffset = 0; rowOffset < cell.rowSpan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < cell.colSpan; columnOffset += 1) {
          if (occupied[rowIndex + rowOffset]) {
            occupied[rowIndex + rowOffset][columnIndex + columnOffset] = true;
          }
        }
      }

      columnIndex += cell.colSpan;
    });
  });

  return data;
};

const normalizeCellSpanValue = (value: unknown) => {
  if (value == null) {
    return 1;
  }
  return Math.max(0, Math.floor(Number(value) || 0));
};

const normalizeCellSpan = (span?: Partial<VirtualTableCellSpan>) => {
  return {
    rowSpan: normalizeCellSpanValue(span?.rowSpan),
    colSpan: normalizeCellSpanValue(span?.colSpan),
  };
};

const buildBodyExportRows = (
  rows: Record<string, any>[],
  leafColumns: VirtualTableColumn[],
  merges: PivotTableExportMerge[],
  headerRowCount: number,
  getCellSpan?: BuildCrossTableResult["getCellSpan"],
) => {
  return rows.map((row, rowIndex) => {
    return leafColumns.map((column, columnIndex) => {
      const span = getCellSpan
        ? normalizeCellSpan(getCellSpan(row as any, rowIndex, column, columnIndex))
        : { rowSpan: 1, colSpan: 1 };

      if (span.rowSpan === 0 || span.colSpan === 0) {
        return "";
      }

      pushMerge(merges, headerRowCount + rowIndex, columnIndex, span.rowSpan, span.colSpan);
      return normalizeExportCellValue(row[column.dataIndex || column.key]);
    });
  });
};

const buildExportDataFromTable = (
  table: {
    columns: VirtualTableColumn[];
    rows: Record<string, any>[];
    getCellSpan?: BuildCrossTableResult["getCellSpan"];
  },
  options: BuildPivotTableExportDataOptions,
): PivotTableExportData => {
  const merges: PivotTableExportMerge[] = [];
  const leafColumns = flattenVirtualColumns(table.columns);
  const headerData = buildHeaderExportRows(table.columns, merges);
  const bodyData = buildBodyExportRows(table.rows, leafColumns, merges, headerData.length, table.getCellSpan);

  return {
    data: [...headerData, ...bodyData],
    merges,
    columns: table.columns,
    sourceRows: table.rows,
    headerRowCount: headerData.length,
    sheetName: options.sheetName || i18next.t("PivotTable.exportSheetName"),
  };
};

export const buildPivotTableExportData = (
  model: PivotTableModel,
  options: BuildPivotTableExportDataOptions = {},
): PivotTableExportData => {
  const mode = options.mode || "cross";
  const defaultColumnWidth = options.defaultColumnWidth;

  if (mode === "tree") {
    const table = buildCrossTreeTable({
      primaryColumn: options.treePrimaryColumn,
      leftTree: model.tree.leftTree,
      topTree: model.tree.topTree,
      openKeys: options.treeOpenKeys || model.tree.defaultOpenKeys,
      onChangeOpenKeys: () => {},
      indentSize: options.treeIndentSize,
      defaultColumnWidth,
      getValue: (leftNode, topNode) => model.resolveTreeValue(leftNode, topNode),
    });

    return buildExportDataFromTable(table, options);
  }

  const table = buildCrossTable({
    leftTree: model.cross.leftTree,
    leftTotalNode: model.cross.leftTotalNode,
    topTree: model.cross.topTree,
    topTotalNode: model.cross.topTotalNode,
    leftMetaColumns: model.leftMetaColumns,
    cornerHeaderRows: options.cornerHeaderRows,
    defaultColumnWidth,
    getValue: (leftNode, topNode) => model.resolveCrossValue(leftNode, topNode),
  });

  return buildExportDataFromTable(table, options);
};
