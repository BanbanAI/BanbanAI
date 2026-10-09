import type { VirtualTableAlign } from "../../types";
import type { CrossTableIndicator, CrossTreeNode } from "../cross-table/interfaces";
import { getIndicatorColumnPassthrough, mergePivotColumnMeta } from "../column-props";
import { DrillNode } from "./interfaces";
import simpleEncode from "./simpleEncode";
import { always, isLeafNode } from "./shared";

export type ConvertDrillTreeToCrossTreeOptions<T extends CrossTreeNode = CrossTreeNode> = {
  indicators?: CrossTableIndicator[] | null;
  encode?(valuePath: string[]): string;
  generateSubtotalNode?(
    drillNode: DrillNode,
  ): null | {
    position: "start" | "end";
    value: string;
    data?: any;
  };
  supportsExpand?: boolean;
  expandKeys?: string[];
  onChangeExpandKeys?(nextKeys: string[], targetNode: DrillNode, action: "collapse" | "expand"): void;
  enforceExpandTotalNode?: boolean;
  indicatorAlign?: VirtualTableAlign;
  renderExpand?(payload: {
    node: DrillNode;
    depth: number;
    expanded: boolean;
    expandable: boolean;
    nextExpandKeys?: string[];
    action?: "collapse" | "expand";
    title: string;
  }): any;
};

export function convertDrillTreeToCrossTree<T extends CrossTreeNode = CrossTreeNode>(
  drillTree: DrillNode[],
  {
    indicators,
    encode = simpleEncode,
    generateSubtotalNode,
    supportsExpand = false,
    expandKeys,
    onChangeExpandKeys = always(undefined),
    enforceExpandTotalNode = true,
    indicatorAlign,
    renderExpand,
  }: ConvertDrillTreeToCrossTreeOptions<T> = {},
): T[] {
  const totalKey = encode([]);
  if (supportsExpand && expandKeys == null) {
    throw new Error(
      "[virtual-table] convertDrillTreeToCrossTree(...) requires expandKeys when supportsExpand=true.",
    );
  }

  const expandKeySet = new Set(expandKeys || []);

  return visit(drillTree, 0);

  function getIndicatorNodes(node: DrillNode, nodeData: any): T[] {
    return (indicators || []).map((indicator) => {
      return {
        ...getIndicatorColumnPassthrough(indicator),
        key: encode(node.path.concat([indicator.code])),
        value: indicator.name,
        title: indicator.title ?? indicator.name,
        align: indicator.align ?? indicatorAlign,
        headerAlign: indicator.headerAlign ?? indicator.align ?? indicatorAlign,
        data: {
          ...nodeData,
          indicator,
        },
        meta: mergePivotColumnMeta(indicator.meta, {
          pivotIndicator: indicator,
        }),
      } as T;
    });
  }

  function drillNodeToTreeNode(node: DrillNode, nodeData: any): T {
    if (indicators?.length) {
      return {
        key: node.key,
        value: node.value,
        title: node.value,
        leafDepth: node.leafDepth,
        data: nodeData,
        children: getIndicatorNodes(node, nodeData),
      } as T;
    }

    return {
      key: node.key,
      value: node.value,
      title: node.value,
      leafDepth: node.leafDepth,
      data: nodeData,
    } as T;
  }

  function visit(nodes: DrillNode[], depth: number): T[] {
    const result: T[] = [];

    for (const node of nodes) {
      const nodeData = {
        dataKey: node.key,
        dataPath: node.path,
      };

      if (isLeafNode(node) && !node.hasChild) {
        result.push(drillNodeToTreeNode(node, nodeData));
        continue;
      }

      let shouldProcessChildren = true;
      const treeNode = {
        key: node.key,
        value: node.value,
        title: node.value,
        leafDepth: node.leafDepth,
        data: nodeData,
        meta: {
          pivot: {
            depth,
            expandable: supportsExpand,
            expanded: !supportsExpand || (enforceExpandTotalNode && node.key === totalKey) || expandKeySet.has(node.key),
          },
        },
      } as T;

      if (!supportsExpand || (enforceExpandTotalNode && node.key === totalKey) || expandKeySet.has(node.key)) {
        treeNode.children = visit(node.children || [], depth + 1);
      } else {
        shouldProcessChildren = false;
        treeNode.meta = {
          ...(treeNode.meta || {}),
          pivot: {
            ...(treeNode.meta?.pivot || {}),
            depth,
            expandable: true,
            expanded: false,
            hasChild: true,
            action: "expand",
            nextExpandKeys: [...(expandKeys || []), node.key],
            sourceNode: node,
            triggerExpand: () => {
              onChangeExpandKeys([...(expandKeys || []), node.key], node, "expand");
            },
          },
        };
        treeNode.children = indicators?.length ? getIndicatorNodes(node, nodeData) : [];
      }

      if (shouldProcessChildren) {
        const subtotalNodeData = generateSubtotalNode?.(node);
        if (subtotalNodeData) {
          const subtotalPath = node.path.concat([subtotalNodeData.value]);
          const subtotalNode: DrillNode = {
            key: encode(subtotalPath),
            path: subtotalPath,
            value: subtotalNodeData.value,
            leafDepth: node.leafDepth,
          };
          const subtotalTreeNode = drillNodeToTreeNode(subtotalNode, {
            ...nodeData,
            subtotal: subtotalNodeData.data,
          });

          if (subtotalNodeData.position === "end") {
            treeNode.children = [...(treeNode.children || []), subtotalTreeNode];
          } else {
            treeNode.children = [subtotalTreeNode, ...(treeNode.children || [])];
          }
        }

        treeNode.meta = {
          ...(treeNode.meta || {}),
          pivot: {
            ...(treeNode.meta?.pivot || {}),
            depth,
            expandable: supportsExpand,
            expanded: true,
            action: supportsExpand ? "collapse" : undefined,
            nextExpandKeys: supportsExpand ? (expandKeys || []).filter((key) => key !== node.key) : undefined,
            sourceNode: node,
            triggerExpand: supportsExpand
              ? () => {
                onChangeExpandKeys((expandKeys || []).filter((key) => key !== node.key), node, "collapse");
              }
              : undefined,
          },
        };
      }

      const pivotMeta = treeNode.meta?.pivot;
      if (supportsExpand && pivotMeta?.expandable) {
        treeNode.title = renderExpand?.({
          node,
          depth,
          expanded: Boolean(pivotMeta.expanded),
          expandable: true,
          nextExpandKeys: pivotMeta.nextExpandKeys,
          action: pivotMeta.action,
          title: String(node.value ?? ""),
        }) ?? node.value;
      }

      result.push(treeNode);
    }

    return result;
  }
}
