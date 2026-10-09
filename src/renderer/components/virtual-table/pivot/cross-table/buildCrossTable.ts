import { DEFAULT_COLUMN_WIDTH } from "../../column-utils";
import type { VirtualTableCellSpan, VirtualTableColumn } from "../../types";
import {
  getLeftMetaColumnPassthrough,
  getTreeNodeColumnPassthrough,
  mergePivotColumnMeta,
  normalizeVirtualTableFixed,
} from "../column-props";
import { getTreeDepth, isLeafNode } from "../pivot-utils/shared";
import { ROW_KEY } from "./constants";
import type {
  CrossTableCornerHeaderRow,
  CrossTableLeftMetaColumn,
  LeftCrossTreeNode,
  TopCrossTreeNode,
} from "./interfaces";
import {
  type CrossTableRenderRect,
  type CrossTableRenderRow,
  materializeLeftCells,
} from "./internals";

type DrillTreeLikeNode = {
  path?: string[];
  leafDepth?: number;
  children?: DrillTreeLikeNode[];
};

export interface BuildCrossTableOptions {
  leftTree: LeftCrossTreeNode[] | null | undefined;
  topTree: TopCrossTreeNode[] | null | undefined;
  leftTotalNode?: LeftCrossTreeNode;
  topTotalNode?: TopCrossTreeNode;
  leftMetaColumns?: CrossTableLeftMetaColumn[];
  cornerHeaderRows?: CrossTableCornerHeaderRow[];
  rowOffset?: number;
  columnOffset?: number;
  defaultColumnWidth?: number;
  getValue?(
    leftNode: LeftCrossTreeNode,
    topNode: TopCrossTreeNode,
    leftDepth: number,
    topDepth: number,
  ): unknown;
  onChangeLeftExpandKeys?(nextKeys: string[], targetNode: LeftCrossTreeNode, action: "collapse" | "expand"): void;
  onChangeTopExpandKeys?(nextKeys: string[], targetNode: TopCrossTreeNode, action: "collapse" | "expand"): void;
}

export interface BuildCrossTableResult {
  columns: VirtualTableColumn[];
  rows: CrossTableRenderRow[];
  getCellSpan(
    row: CrossTableRenderRow,
    rowIndex: number,
    column: VirtualTableColumn,
    columnIndex: number,
  ): VirtualTableCellSpan;
}

export default function buildCrossTable(options: BuildCrossTableOptions): BuildCrossTableResult {
  const leftTree = options.leftTree || [];
  const topTree = options.topTree || [];
  const leftMetaColumns = options.leftMetaColumns || [];
  const cornerHeaderRows = (options.cornerHeaderRows || []).filter((row) => row && row.title !== undefined && row.title !== null && row.title !== "");
  const getValue = options.getValue || (() => null);
  const rowOffset = Math.max(0, Math.floor(Number(options.rowOffset) || 0));
  const columnOffset = Math.max(0, Math.floor(Number(options.columnOffset) || 0));
  const defaultColumnWidth = Math.max(1, Number(options.defaultColumnWidth) || DEFAULT_COLUMN_WIDTH);
  const leftHeaderWidth = Math.max(leftMetaColumns.length, getTreeDepth(leftTree) + 1);
  const topLeafDescriptors: Array<{ node: TopCrossTreeNode; depth: number }> = [];

  const columns = [...buildLeftColumns(), ...buildDataColumns()];
  const rows = buildRows();

  return {
    columns,
    rows,
    getCellSpan(row, rowIndex, column, columnIndex) {
      const pivotMeta = column.meta?.pivot;
      if (pivotMeta?.region !== "left") {
        return {
          rowSpan: 1,
          colSpan: 1,
        };
      }

      const leftCell = row.__pivotLeftCells[pivotMeta.leftDepth || 0];
      if (!leftCell) {
        return {
          rowSpan: 1,
          colSpan: 1,
        };
      }

      if (!leftCell.anchor) {
        return {
          rowSpan: 0,
          colSpan: 0,
        };
      }
      if (rowIndex !== leftCell.rect.top + rowOffset) {
        return {
          rowSpan: 0,
          colSpan: 0,
        };
      }
      if (columnIndex !== leftCell.rect.left + columnOffset) {
        return {
          rowSpan: 0,
          colSpan: 0,
        };
      }

      return {
        rowSpan: Math.max(1, leftCell.rect.bottom - leftCell.rect.top),
        colSpan: Math.max(1, leftCell.rect.right - leftCell.rect.left),
      };
    },
  };

  function buildLeftColumns() {
    const leafColumns: VirtualTableColumn[] = [];

    for (let index = 0; index < leftHeaderWidth; index += 1) {
      const metaColumn = leftMetaColumns[index];
      leafColumns.push({
        ...getLeftMetaColumnPassthrough(metaColumn),
        key: `__pivot-left-${index}`,
        title: String(metaColumn?.name ?? metaColumn?.title ?? ""),
        dataIndex: `__pivot-left-${index}`,
        width: metaColumn?.width || defaultColumnWidth,
        fixed: normalizeVirtualTableFixed(metaColumn?.fixed, metaColumn?.lock, "left"),
        align: metaColumn?.align || "left",
        headerAlign: metaColumn?.headerAlign || metaColumn?.align || "left",
        meta: mergePivotColumnMeta(metaColumn?.meta, {
          region: "left",
          leftDepth: index,
          leftMetaColumn: metaColumn,
          title: metaColumn?.title,
        }),
      });
    }

    if (!cornerHeaderRows.length) {
      return leafColumns;
    }

    let nestedColumns = leafColumns;
    for (let index = cornerHeaderRows.length - 1; index >= 0; index -= 1) {
      const cornerHeaderRow = cornerHeaderRows[index];
      nestedColumns = [{
        key: cornerHeaderRow.key || `__pivot-corner-${index}`,
        title: cornerHeaderRow.title,
        fixed: "left",
        align: cornerHeaderRow.align || "left",
        headerAlign: cornerHeaderRow.headerAlign || cornerHeaderRow.align || "left",
        headerClassName: cornerHeaderRow.headerClassName,
        children: nestedColumns,
        meta: mergePivotColumnMeta(cornerHeaderRow.meta, {
          region: "corner",
          cornerHeaderRow,
          cornerDepth: index,
          title: cornerHeaderRow.title,
        }),
      }];
    }

    return nestedColumns;
  }

  function buildDataColumns(): VirtualTableColumn[] {
    const sourceNodes = topTree.length ? topTree : options.topTotalNode ? [options.topTotalNode] : [];
    return visitTopNodes(sourceNodes, 1);
  }

  function visitTopNodes(nodes: TopCrossTreeNode[], fallbackHeaderDepth: number): VirtualTableColumn[] {
    const result: VirtualTableColumn[] = [];

    for (const node of nodes) {
      if (node.hidden) {
        continue;
      }

      const children = (node.children || []).filter((child) => !child.hidden);
      const headerDepth = resolveTopHeaderDepth(node, fallbackHeaderDepth);
      const column: VirtualTableColumn = {
        ...getTreeNodeColumnPassthrough(node),
        key: node.key,
        title: String(node.value ?? ""),
        headerDepth,
        width: children.length ? undefined : (node.width || defaultColumnWidth),
        fixed: normalizeVirtualTableFixed(node.fixed, node.lock),
        meta: mergePivotColumnMeta(node.meta, {
          region: "data",
          topDepth: Math.max(0, headerDepth - 1),
          topNode: node,
          title: node.title,
          expandable: node.meta?.pivot?.expandable,
          expanded: node.meta?.pivot?.expanded,
          nextExpandKeys: node.meta?.pivot?.nextExpandKeys,
          action: node.meta?.pivot?.action,
          sourceNode: node.meta?.pivot?.sourceNode,
          triggerExpand: node.meta?.pivot?.expandable && node.meta?.pivot?.nextExpandKeys
            ? () => {
              if (typeof options.onChangeTopExpandKeys === "function") {
                options.onChangeTopExpandKeys?.(
                  node.meta?.pivot?.nextExpandKeys,
                  node.meta?.pivot?.sourceNode || node,
                  node.meta?.pivot?.action || "expand",
                );
                return;
              }
              if (typeof node.meta?.pivot?.triggerExpand === "function") {
                node.meta.pivot.triggerExpand();
              }
            }
            : null,
        }),
      };

      if (children.length) {
        column.children = visitTopNodes(children, resolveChildHeaderDepth(node, headerDepth));
      } else {
        column.dataIndex = node.key;
        topLeafDescriptors.push({
          node,
          depth: Math.max(0, headerDepth - 1),
        });
      }

      result.push(column);
    }

    return result;
  }

  function buildRows(): CrossTableRenderRow[] {
    const sourceNodes = leftTree.length ? leftTree : options.leftTotalNode ? [options.leftTotalNode] : [];
    const result: CrossTableRenderRow[] = [];
    const ctx = {
      depth: 0,
      rects: [] as CrossTableRenderRect[],
      nodes: [] as LeftCrossTreeNode[],
      rowIndex: 0,
    };

    visitLeftNodes(sourceNodes, ctx);
    return result;

    function visitLeftNodes(
      nodes: LeftCrossTreeNode[],
      state: {
        depth: number;
        rects: CrossTableRenderRect[];
        nodes: LeftCrossTreeNode[];
        rowIndex: number;
      },
    ) {
      let count = 0;

      for (const node of nodes) {
        if (node.hidden) {
          continue;
        }

        const rect: CrossTableRenderRect = {
          top: state.rowIndex + count,
          bottom: -1,
          left: state.depth,
          right: -1,
        };

        const rowNodes = [...state.nodes, node];
        const rowRects = [...state.rects, rect];

        if (isLeafNode(node)) {
          rect.right = leftHeaderWidth;
          rect.bottom = rect.top + 1;

          const row = createRenderRow(node, rowNodes, rowRects);
          result.push(row);
          count += 1;
          continue;
        }

        state.rects.push(rect);
        state.nodes.push(node);
        const childCount = visitLeftNodes(node.children || [], {
          depth: state.depth + 1,
          rects: state.rects,
          nodes: state.nodes,
          rowIndex: state.rowIndex + count,
        });
        state.rects.pop();
        state.nodes.pop();

        count += childCount;
        rect.right = rect.left + 1;
        rect.bottom = rect.top + childCount;
      }

      return count;
    }
  }

  function createRenderRow(
    leafNode: LeftCrossTreeNode,
    nodes: LeftCrossTreeNode[],
    rects: CrossTableRenderRect[],
  ): CrossTableRenderRow {
    const row = {
      [ROW_KEY]: leafNode.key,
      __pivotLeftNodes: nodes,
      __pivotLeftCells: materializeLeftCells(nodes, rects, leftHeaderWidth),
      __pivotLeafNode: leafNode,
    } as CrossTableRenderRow;

    row.__pivotLeftCells = row.__pivotLeftCells.map((leftCell) => {
      if (!leftCell?.anchor) {
        return leftCell;
      }

      const pivotMeta = leftCell.node?.meta?.pivot;
      if (!pivotMeta?.expandable || !pivotMeta?.nextExpandKeys) {
        return leftCell;
      }

      const node = {
        ...leftCell.node,
        meta: {
          ...(leftCell.node.meta || {}),
          pivot: {
            ...pivotMeta,
            triggerExpand: () => {
              if (typeof options.onChangeLeftExpandKeys === "function") {
                options.onChangeLeftExpandKeys?.(
                  pivotMeta.nextExpandKeys,
                  (pivotMeta.sourceNode || leftCell.node) as LeftCrossTreeNode,
                  pivotMeta.action || "expand",
                );
                return;
              }
              if (typeof pivotMeta.triggerExpand === "function") {
                pivotMeta.triggerExpand();
              }
            },
          },
        },
      } as LeftCrossTreeNode;

      return {
        ...leftCell,
        node,
      };
    });

    for (let leftDepth = 0; leftDepth < leftHeaderWidth; leftDepth += 1) {
      const leftCell = row.__pivotLeftCells[leftDepth];
      row[`__pivot-left-${leftDepth}`] = leftCell?.node?.value ?? "";
    }

    const leftDepth = Math.max(0, nodes.length - 1);
    for (const descriptor of topLeafDescriptors) {
      row[descriptor.node.key] = getValue(leafNode, descriptor.node, leftDepth, descriptor.depth);
    }

    return row;
  }
}

function resolveTopHeaderDepth(
  node: TopCrossTreeNode,
  fallbackHeaderDepth: number,
) {
  const explicitHeaderDepth = Math.floor(Number(node.headerDepth) || 0);
  if (explicitHeaderDepth > 0) {
    return Math.max(fallbackHeaderDepth, explicitHeaderDepth);
  }
  return fallbackHeaderDepth;
}

function resolveChildHeaderDepth(
  node: TopCrossTreeNode,
  headerDepth: number,
) {
  const defaultChildHeaderDepth = headerDepth + 1;
  const pivotMeta = node.meta?.pivot;
  if (!pivotMeta?.expandable || pivotMeta.expanded !== false) {
    return resolveIndicatorChildHeaderDepth(node, defaultChildHeaderDepth);
  }

  const sourceNode = pivotMeta.sourceNode;
  if (!sourceNode) {
    return resolveIndicatorChildHeaderDepth(node, defaultChildHeaderDepth);
  }

  return Math.max(defaultChildHeaderDepth, getDeepestDrillPathLength(sourceNode) + 1);
}

function resolveIndicatorChildHeaderDepth(
  node: TopCrossTreeNode,
  defaultChildHeaderDepth: number,
) {
  const children = (node.children || []).filter((child) => !child.hidden);
  if (!children.length || !children.every((child) => child.data?.indicator || child.meta?.pivot?.pivotIndicator)) {
    return defaultChildHeaderDepth;
  }

  const leafDepth = Math.max(0, Math.floor(Number(node.leafDepth) || 0));
  if (leafDepth <= 0) {
    return defaultChildHeaderDepth;
  }
  return Math.max(defaultChildHeaderDepth, leafDepth + 1);
}

function getDeepestDrillPathLength(node: DrillTreeLikeNode | null | undefined): number {
  if (!node) {
    return 0;
  }

  const currentPathLength = Array.isArray(node.path) ? node.path.length : 0;
  const explicitLeafDepth = Math.max(0, Math.floor(Number(node.leafDepth) || 0));
  const childPathLength = Math.max(
    0,
    ...((node.children || []).map((child) => getDeepestDrillPathLength(child))),
  );
  return Math.max(currentPathLength, explicitLeafDepth, childPathLength);
}
