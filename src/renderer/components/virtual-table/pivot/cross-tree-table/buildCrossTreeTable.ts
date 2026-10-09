import { DEFAULT_COLUMN_WIDTH } from "../../column-utils";
import type { VirtualTableColumn } from "../../types";
import {
  getLeftMetaColumnPassthrough,
  getTreeNodeColumnPassthrough,
  mergePivotColumnMeta,
  normalizeVirtualTableFixed,
} from "../column-props";
import { ROW_KEY } from "../cross-table/constants";
import type { LeftCrossTreeNode, TopCrossTreeNode } from "../cross-table/interfaces";
import { isLeafNode as standardIsLeafNode } from "../pivot-utils/shared";
import type {
  BuildCrossTreeTableOptions,
  BuildCrossTreeTableResult,
  CrossTreeTableRenderRow,
} from "./interfaces";

const PRIMARY_COLUMN_KEY = "__pivot-tree-primary";
type DrillTreeLikeNode = {
  path?: string[];
  leafDepth?: number;
  children?: DrillTreeLikeNode[];
};

export default function buildCrossTreeTable(
  options: BuildCrossTreeTableOptions,
): BuildCrossTreeTableResult {
  const primaryColumn = options.primaryColumn || { name: "" };
  const leftTree = options.leftTree || [];
  const topTree = options.topTree || [];
  const openKeySet = new Set(options.openKeys || []);
  const indentSize = Math.max(0, Number(options.indentSize) || 16);
  const defaultColumnWidth = Math.max(1, Number(options.defaultColumnWidth) || DEFAULT_COLUMN_WIDTH);
  const getValue = options.getValue || (() => null);
  const topLeafColumns: Array<{ node: TopCrossTreeNode; depth: number }> = [];
  const isLeafNode = options.isLeafNode || ((node, meta) => {
    return standardIsLeafNode(node) || (!node?.children?.length && !node?.hasChild) || meta.expanded === false && Boolean(node?.hasChild) === false;
  });

  return {
    columns: [buildPrimaryColumn(), ...buildDataColumns(topTree, 1)],
    rows: buildRows(leftTree, []),
  };

  function buildPrimaryColumn(): VirtualTableColumn {
    return {
      ...getLeftMetaColumnPassthrough(primaryColumn),
      key: PRIMARY_COLUMN_KEY,
      title: String(primaryColumn.name ?? primaryColumn.title ?? ""),
      dataIndex: PRIMARY_COLUMN_KEY,
      width: primaryColumn.width || defaultColumnWidth,
      fixed: normalizeVirtualTableFixed(primaryColumn.fixed, primaryColumn.lock, "left"),
      align: primaryColumn.align || "left",
      headerAlign: primaryColumn.headerAlign || primaryColumn.align || "left",
      meta: mergePivotColumnMeta(primaryColumn.meta, {
        region: "tree-primary",
        primaryColumn,
        title: primaryColumn.title,
        indentSize,
      }),
    };
  }

  function buildDataColumns(
    nodes: TopCrossTreeNode[],
    fallbackHeaderDepth: number,
  ): VirtualTableColumn[] {
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
          region: "tree-data",
          topDepth: Math.max(0, headerDepth - 1),
          topNode: node,
          title: node.title,
        }),
      };

      if (children.length) {
        column.children = buildDataColumns(children, resolveChildHeaderDepth(node, headerDepth));
      } else {
        column.dataIndex = node.key;
        topLeafColumns.push({
          node,
          depth: Math.max(0, headerDepth - 1),
        });
      }

      result.push(column);
    }

    return result;
  }

  function buildRows(
    nodes: LeftCrossTreeNode[],
    pathNodes: LeftCrossTreeNode[],
  ): CrossTreeTableRenderRow[] {
    const result: CrossTreeTableRenderRow[] = [];

    for (const node of nodes) {
      if (node.hidden) {
        continue;
      }

      const nextPathNodes = [...pathNodes, node];
      const depth = nextPathNodes.length - 1;
      const expanded = openKeySet.has(node.key);
      const leaf = Boolean(isLeafNode(node, {
        depth,
        expanded,
        rowKey: node.key,
      }));
      const hasChildren = Boolean(node.children?.length || node.hasChild);
      const nextOpenKeys = leaf
        ? undefined
        : (
          expanded
            ? (options.openKeys || []).filter((key) => key !== node.key)
            : [...(options.openKeys || []), node.key]
        );

      const row = {
        [ROW_KEY]: node.key,
        [PRIMARY_COLUMN_KEY]: node.value,
        __pivotTreeNode: node,
        __pivotTreePathNodes: nextPathNodes,
        __pivotTreeDepth: depth,
        __pivotTreeExpanded: expanded,
        __pivotTreeLeaf: leaf,
        __pivotTreeHasChildren: hasChildren,
        __pivotTreeNextOpenKeys: nextOpenKeys,
        __pivotTreeAction: leaf ? undefined : (expanded ? "collapse" : "expand"),
      } as CrossTreeTableRenderRow;

      for (const column of topLeafColumns) {
        row[column.node.key] = getValue(node, column.node, depth, column.depth);
      }

      result.push(row);

      if (!leaf && expanded && node.children?.length) {
        result.push(...buildRows(node.children, nextPathNodes));
      }
    }

    return result;
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
