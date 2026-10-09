import buildDrillTree from "./buildDrillTree";
import { BuildingCtx, DrillNode, RecordMatrix } from "./interfaces";
import simpleEncode from "./simpleEncode";
import { always, groupBy2, isLeafNode } from "./shared";

export interface BuildRecordMatrixConfig {
  leftCodes: string[];
  topCodes: string[];
  data: any[];
  aggregate?(slice: any[], ctx: BuildingCtx): any;
  encode?(valuePath: string[]): string;
  isLeftExpand?(key: string): boolean;
  isTopExpand?(key: string): boolean;
  prebuiltLeftTree?: DrillNode[];
  prebuiltTopTree?: DrillNode[];
}

type TransientMatrixRow = {
  leftKey: string;
  children: TransientMatrixRow[] | null;
  col: TransientMatrixCol;
};

type TransientMatrixCol = {
  topKey: string;
  topValue: string;
  children: TransientMatrixCol[] | null;
  record: any;
};

const fallbackAggregate = (slice: any[]) => {
  return slice.length === 1 ? slice[0] : {};
};

export function buildRecordMatrix({
  data,
  leftCodes,
  topCodes,
  aggregate = fallbackAggregate,
  encode = simpleEncode,
  isLeftExpand = always(true),
  isTopExpand = always(true),
  prebuiltLeftTree,
  prebuiltTopTree,
}: BuildRecordMatrixConfig): RecordMatrix {
  const ctx: BuildingCtx = {
    peculiarity: new Set(),
  };

  const [leftRootDrillNode] =
    prebuiltLeftTree ??
    buildDrillTree(data, leftCodes, {
      encode,
      includeTopWrapper: true,
      isExpand: isLeftExpand,
    });
  const [topRootDrillNode] =
    prebuiltTopTree ??
    buildDrillTree(data, topCodes, {
      encode,
      includeTopWrapper: true,
      isExpand: isTopExpand,
    });

  const transientMatrixRow = buildByLeft(data, leftRootDrillNode, 0);
  return makeMatrix(transientMatrixRow);

  function buildByLeft(slice: any[], drillNode: DrillNode, depth: number): TransientMatrixRow {
    let children: TransientMatrixRow[] | null = null;
    let col: TransientMatrixCol;

    if (isLeafNode(drillNode)) {
      col = buildByTop(slice, topRootDrillNode, 0);
    } else {
      children = [];
      const code = leftCodes[depth];
      const groups = groupBy2(slice, (row) => String(row?.[code] ?? ""));

      ctx.peculiarity.add(code);
      for (const child of drillNode.children || []) {
        const group = groups.get(child.value);
        if (group) {
          children.push(buildByLeft(group, child, depth + 1));
        }
      }
      ctx.peculiarity.delete(code);

      col = mergeColsByTopTree(children.map((child) => child.col));
    }

    return {
      leftKey: drillNode.key,
      children,
      col,
    };
  }

  function buildByTop(slice: any[], drillNode: DrillNode, depth: number): TransientMatrixCol {
    let children: TransientMatrixCol[] | null = null;
    let record: any;

    if (isLeafNode(drillNode)) {
      record = aggregate(slice, ctx);
    } else {
      children = [];
      const code = topCodes[depth];
      const groups = groupBy2(slice, (row) => String(row?.[code] ?? ""));

      ctx.peculiarity.add(code);
      for (const child of drillNode.children || []) {
        const group = groups.get(child.value);
        if (group) {
          children.push(buildByTop(group, child, depth + 1));
        }
      }
      ctx.peculiarity.delete(code);

      record = aggregate(children.map((child) => child.record), ctx);
    }

    return {
      topKey: drillNode.key,
      topValue: drillNode.value,
      children,
      record,
    };
  }

  function mergeColsByTopTree(colsToMerge: TransientMatrixCol[]): TransientMatrixCol {
    return visitTopMerge(colsToMerge, topRootDrillNode, 0);
  }

  function visitTopMerge(
    cols: TransientMatrixCol[],
    topDrillNode: DrillNode,
    depth: number,
  ): TransientMatrixCol {
    let children: TransientMatrixCol[] | null = null;
    const record = aggregate(cols.map((item) => item.record), ctx);

    if (!isLeafNode(topDrillNode)) {
      const topCode = topCodes[depth];
      ctx.peculiarity.add(topCode);

      const drillChildMap = new Map((topDrillNode.children || []).map((child) => [child.value, child] as const));
      const colChildMaps = cols.map((col) => new Map((col.children || []).map((child) => [child.topValue, child] as const)));
      children = (topDrillNode.children || []).map((item) => {
        const childCols = colChildMaps
          .map((colChildMap) => colChildMap.get(item.value))
          .filter(Boolean) as TransientMatrixCol[];
        return visitTopMerge(childCols, drillChildMap.get(item.value)!, depth + 1);
      });

      ctx.peculiarity.delete(topCode);
    }

    return {
      topKey: topDrillNode.key,
      topValue: topDrillNode.value,
      record,
      children,
    };
  }

  function makeMatrix(rootRow: TransientMatrixRow): RecordMatrix {
    const matrix: RecordMatrix = new Map();
    visitRow(rootRow);
    return matrix;

    function visitRow(row: TransientMatrixRow) {
      const subMap = new Map<string, any>();
      matrix.set(row.leftKey, subMap);
      visitCol(subMap, row.col);

      if (!isLeafNode(row)) {
        for (const childRow of row.children || []) {
          visitRow(childRow);
        }
      }
    }

    function visitCol(subMap: Map<string, any>, col: TransientMatrixCol) {
      subMap.set(col.topKey, col.record);

      if (!isLeafNode(col)) {
        for (const childCol of col.children || []) {
          visitCol(subMap, childCol);
        }
      }
    }
  }
}

export function buildRecordMap({
  codes,
  data,
  aggregate,
  encode = simpleEncode,
  isExpand,
}: {
  codes: string[];
  data: any[];
  aggregate?(slice: any[], ctx: BuildingCtx): any;
  encode?(valuePath: string[]): string;
  isExpand?(key: string): boolean;
}) {
  const matrix = buildRecordMatrix({
    data,
    leftCodes: [],
    topCodes: codes,
    aggregate,
    encode,
    isTopExpand: isExpand,
  });
  return matrix.get(encode([])) || new Map<string, any>();
}
