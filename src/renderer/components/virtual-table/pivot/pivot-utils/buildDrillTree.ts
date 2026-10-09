import { DrillNode } from "./interfaces";
import i18next from "i18next";
import simpleEncode from "./simpleEncode";
import { always, groupBy2 } from "./shared";

export interface BuildDrillTreeOptions<T extends DrillNode> {
  includeTopWrapper?: boolean;
  totalValue?: string;
  encode?(path: string[]): string;
  isExpand?(key: string): boolean;
  enforceExpandTotalNode?: boolean;
}

export default function buildDrillTree(
  data: any[],
  codes: string[],
  {
    encode = simpleEncode,
    totalValue = i18next.t("virtualTable.grandTotal"),
    includeTopWrapper = false,
    isExpand = always(true),
    enforceExpandTotalNode = true,
  }: BuildDrillTreeOptions<DrillNode> = {},
): DrillNode[] {
  const emptyPath: string[] = [];
  const totalKey = encode(emptyPath);
  const leafDepth = codes.length;

  let array: DrillNode[];
  let hasChild = false;

  if (codes.length === 0) {
    array = [];
  } else if (!enforceExpandTotalNode && !isExpand(totalKey)) {
    array = [];
    hasChild = data.length > 0;
  } else {
    array = visit(data, []);
  }

  if (!includeTopWrapper) {
    return array;
  }

  const rootNode: DrillNode = {
    key: totalKey,
    value: totalValue,
    path: emptyPath,
    leafDepth,
    children: array,
  };
  if (hasChild) {
    rootNode.hasChild = hasChild;
  }
  return [rootNode];

  function visit(slice: any[], path: string[]): DrillNode[] {
    const depth = path.length;
    const code = codes[depth];
    const groups = groupBy2(slice, (row) => String(row?.[code] ?? ""));
    const result: DrillNode[] = [];

    for (const groupKey of groups.keys()) {
      path.push(groupKey);

      const node: DrillNode = {
        key: encode(path),
        value: groupKey,
        path: path.slice(),
        leafDepth,
      };
      result.push(node);

      const group = groups.get(groupKey) || [];
      if (group.length > 0 && depth < codes.length - 1) {
        if (isExpand(node.key)) {
          node.children = visit(group, path);
        } else {
          node.hasChild = true;
        }
      }

      path.pop();
    }

    return result;
  }
}
