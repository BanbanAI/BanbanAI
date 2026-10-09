import type { CSSProperties, VNodeChild } from "vue";
import type { VirtualTableAlign, VirtualTableFixed } from "../../types";

export interface VirtualPivotCellProps {
  className?: string;
  style?: CSSProperties;
}

export interface CrossTableIndicator {
  code: string;
  name: string;
  title?: VNodeChild;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: VirtualTableFixed;
  lock?: boolean | VirtualTableFixed;
  align?: VirtualTableAlign;
  headerAlign?: VirtualTableAlign;
  className?: string;
  headerClassName?: string;
  hidden?: boolean;
  meta?: Record<string, any>;
}

export interface CrossTableLeftMetaColumn {
  key?: string;
  name?: string;
  title?: VNodeChild;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: VirtualTableFixed;
  lock?: boolean | VirtualTableFixed;
  align?: VirtualTableAlign;
  headerAlign?: VirtualTableAlign;
  className?: string;
  headerClassName?: string;
  meta?: Record<string, any>;
  render?(leftNode: LeftCrossTreeNode, leftDepth: number): VNodeChild;
  getCellProps?(leftNode: LeftCrossTreeNode, leftDepth: number): VirtualPivotCellProps | undefined;
}

export interface CrossTableCornerHeaderRow {
  key?: string;
  title?: VNodeChild;
  align?: VirtualTableAlign;
  headerAlign?: VirtualTableAlign;
  headerClassName?: string;
  meta?: Record<string, any>;
}

export interface CrossTreeNode {
  key: string;
  value: string;
  title?: VNodeChild;
  data?: any;
  hidden?: boolean;
  headerDepth?: number;
  leafDepth?: number;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: VirtualTableFixed;
  lock?: boolean | VirtualTableFixed;
  align?: VirtualTableAlign;
  headerAlign?: VirtualTableAlign;
  className?: string;
  headerClassName?: string;
  meta?: Record<string, any>;
  children?: CrossTreeNode[];
  hasChild?: boolean;
}

export interface LeftCrossTreeNode extends CrossTreeNode {
  children?: LeftCrossTreeNode[];
}

export interface TopCrossTreeNode extends CrossTreeNode {
  children?: TopCrossTreeNode[];
}
