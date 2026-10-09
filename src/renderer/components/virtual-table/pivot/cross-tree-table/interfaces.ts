import type { VNodeChild } from "vue";
import type { VirtualTableAlign, VirtualTableCellProps, VirtualTableColumn } from "../../types";
import type { CrossTableLeftMetaColumn, LeftCrossTreeNode, TopCrossTreeNode } from "../cross-table/interfaces";

export type CrossTreeTableRenderRow = Record<string, any> & {
  __virtualPivotRowKey: string;
  __pivotTreeNode: LeftCrossTreeNode;
  __pivotTreePathNodes: LeftCrossTreeNode[];
  __pivotTreeDepth: number;
  __pivotTreeExpanded: boolean;
  __pivotTreeLeaf: boolean;
  __pivotTreeHasChildren: boolean;
  __pivotTreeNextOpenKeys?: string[];
  __pivotTreeAction?: "expand" | "collapse";
};

export type CrossTreePrimaryColumn = CrossTableLeftMetaColumn & {
  key?: string;
  width?: number;
  align?: VirtualTableAlign;
  headerAlign?: VirtualTableAlign;
};

export interface BuildCrossTreeTableOptions {
  primaryColumn?: CrossTreePrimaryColumn;
  leftTree: LeftCrossTreeNode[] | null | undefined;
  topTree: TopCrossTreeNode[] | null | undefined;
  openKeys: string[];
  onChangeOpenKeys(nextOpenKeys: string[]): void;
  indentSize?: number;
  isLeafNode?(node: any, nodeMeta: { depth: number; expanded: boolean; rowKey: string }): boolean;
  defaultColumnWidth?: number;
  getValue?(
    leftNode: LeftCrossTreeNode,
    topNode: TopCrossTreeNode,
    leftDepth: number,
    topDepth: number,
  ): any;
  render?(
    value: any,
    leftNode: LeftCrossTreeNode,
    topNode: TopCrossTreeNode,
    leftDepth: number,
    topDepth: number,
  ): VNodeChild;
  getCellProps?(
    value: any,
    leftNode: LeftCrossTreeNode,
    topNode: TopCrossTreeNode,
    leftDepth: number,
    topDepth: number,
  ): VirtualTableCellProps | undefined;
}

export interface BuildCrossTreeTableResult {
  columns: VirtualTableColumn[];
  rows: CrossTreeTableRenderRow[];
}
