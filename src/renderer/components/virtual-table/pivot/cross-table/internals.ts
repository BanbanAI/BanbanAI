import type { VirtualTableColumn } from "../../types";
import type {
  CrossTableCornerHeaderRow,
  CrossTableLeftMetaColumn,
  LeftCrossTreeNode,
  TopCrossTreeNode,
} from "./interfaces";
import { ROW_KEY } from "./constants";

export type CrossTableRenderRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type CrossTableRenderLeftCell = {
  node: LeftCrossTreeNode;
  rect: CrossTableRenderRect;
  anchor: boolean;
};

export type CrossTableRenderRow = Record<string, any> & {
  [ROW_KEY]: string;
  __pivotLeftNodes: LeftCrossTreeNode[];
  __pivotLeftCells: Array<CrossTableRenderLeftCell | null>;
  __pivotLeafNode: LeftCrossTreeNode | null;
};

export type CrossTableColumnPivotMeta = {
  region: "left" | "data" | "corner";
  leftDepth?: number;
  leftMetaColumn?: CrossTableLeftMetaColumn;
  cornerHeaderRow?: CrossTableCornerHeaderRow;
  cornerDepth?: number;
  topDepth?: number;
  topNode?: TopCrossTreeNode;
  title?: any;
  leftNode?: LeftCrossTreeNode;
  expandable?: boolean;
  expanded?: boolean;
  nextExpandKeys?: string[];
  action?: "expand" | "collapse";
  sourceNode?: any;
  triggerExpand?: (() => void) | null;
};

export const getPivotColumnMeta = (column: VirtualTableColumn): CrossTableColumnPivotMeta | undefined => {
  return column.meta?.pivot as CrossTableColumnPivotMeta | undefined;
};

export const getPivotLeftCell = (row: CrossTableRenderRow, leftDepth: number) => {
  return row.__pivotLeftCells[leftDepth] || null;
};

export const getPivotLeafNode = (row: CrossTableRenderRow) => {
  return row.__pivotLeafNode;
};

export const materializeLeftCells = (
  nodes: LeftCrossTreeNode[],
  rects: CrossTableRenderRect[],
  leftHeaderWidth: number,
) => {
  const cells: Array<CrossTableRenderLeftCell | null> = Array.from({ length: leftHeaderWidth }, () => null);

  rects.forEach((rect, index) => {
    const node = nodes[index];
    if (!node) {
      return;
    }

    cells[rect.left] = {
      node,
      rect,
      anchor: true,
    };

    for (let colIndex = rect.left + 1; colIndex < rect.right; colIndex += 1) {
      cells[colIndex] = {
        node,
        rect,
        anchor: false,
      };
    }
  });

  return cells;
};
