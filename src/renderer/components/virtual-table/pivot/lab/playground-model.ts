import {
  buildDrillTree,
  buildRecordMatrix,
  convertDrillTreeToCrossTree,
  simpleEncode,
  type RecordMatrix,
} from "../pivot-utils";
import type { CrossTableLeftMetaColumn, LeftCrossTreeNode, TopCrossTreeNode } from "../cross-table";
import {
  collectPivotTableDrillTreeKeys,
  createPivotTableDimensionValueMap,
  createPivotTableFilters,
  type PivotTableGrandTotalColumnPosition,
  type PivotTableGrandTotalRowPosition,
  type PivotTableSubtotalPosition,
  type PivotTableDimensionValueMap,
} from "../model";
import {
  prunePivotDesignerOpenKeys,
  reorderPivotDesignerDimCodes,
  type PivotDesignerFilterMap,
} from "../designer";
import {
  createPivotTableLabRecords,
  PIVOT_TABLE_LAB_DEFAULT_LEFT_CODES,
  PIVOT_TABLE_LAB_DEFAULT_TOP_CODES,
  PIVOT_TABLE_LAB_DIMENSIONS,
  PIVOT_TABLE_LAB_TREE_TOP_CODES,
  type PivotTableLabIndicatorSide,
  pivotTableLabIndicators,
  type PivotTableLabDimension,
  type PivotTableLabRecord,
} from "./mock-data";

export type PivotTableLabDimensionValueMap = Record<string, string[]>;
export type PivotTableLabFilterMap = PivotDesignerFilterMap;

export type PivotTableLabCrossState = {
  matrix: RecordMatrix<{ amount: number; target: number }>;
  leftTree: LeftCrossTreeNode[];
  leftTotalNode: LeftCrossTreeNode;
  topTree: TopCrossTreeNode[];
  topTotalNode: TopCrossTreeNode;
};

export type PivotTableLabTreeState = {
  matrix: RecordMatrix<{ amount: number; target: number }>;
  leftTree: LeftCrossTreeNode[];
  topTree: TopCrossTreeNode[];
  defaultOpenKeys: string[];
  totalKey: string;
};

export type PivotTableLabSnapshot = {
  records: PivotTableLabRecord[];
  filteredRecords: PivotTableLabRecord[];
  dimensionValueMap: PivotTableLabDimensionValueMap;
  leftMetaColumns: CrossTableLeftMetaColumn[];
  cross: PivotTableLabCrossState;
  tree: PivotTableLabTreeState;
};

export type BuildPivotTableLabSnapshotOptions = {
  records: PivotTableLabRecord[];
  leftDimCodes: string[];
  topDimCodes?: string[];
  filters: PivotTableLabFilterMap;
  treeOpenKeys?: string[];
  crossLeftExpandKeys?: string[];
  crossTopExpandKeys?: string[];
  indicatorSide?: PivotTableLabIndicatorSide;
  showSubtotal?: boolean;
  subtotalPosition?: PivotTableSubtotalPosition;
  showGrandTotalRow?: boolean;
  grandTotalRowPosition?: PivotTableGrandTotalRowPosition;
  showGrandTotalColumn?: boolean;
  grandTotalColumnPosition?: PivotTableGrandTotalColumnPosition;
  supportsExpand?: boolean;
};

const resolveSubtotalPosition = (subtotalPosition: PivotTableSubtotalPosition) => {
  return subtotalPosition === "bottom" ? "end" as const : "start" as const;
};

const resolveGrandTotalPosition = (
  position: PivotTableGrandTotalRowPosition | PivotTableGrandTotalColumnPosition,
) => {
  return position === "bottom" || position === "right" ? "end" as const : "start" as const;
};

const createSubtotalNodeFactory = (options: {
  showSubtotal: boolean;
  subtotalPosition: PivotTableSubtotalPosition;
  showGrandTotal: boolean;
  grandTotalPosition: PivotTableGrandTotalRowPosition | PivotTableGrandTotalColumnPosition;
}) => {
  return (drillNode: { path: string[] }) => {
    if (drillNode.path.length === 0) {
      if (!options.showGrandTotal) {
        return null;
      }
      return {
        position: resolveGrandTotalPosition(options.grandTotalPosition),
        value: "总计",
      };
    }

    if (!options.showSubtotal) {
      return null;
    }

    return {
      position: resolveSubtotalPosition(options.subtotalPosition),
      value: "小计",
    };
  };
};

export const aggregatePivotTableLabRecords = (slice: any[]) => {
  return slice.reduce((result, item) => {
    result.amount += Number(item?.amount || 0);
    result.target += Number(item?.target || 0);
    return result;
  }, { amount: 0, target: 0 });
};

export const createPivotTableLabDimensionValueMap = (
  records: PivotTableLabRecord[],
  dimensions: PivotTableLabDimension[] = PIVOT_TABLE_LAB_DIMENSIONS,
): PivotTableLabDimensionValueMap => {
  return createPivotTableDimensionValueMap(records, dimensions) as PivotTableDimensionValueMap;
};

export const createPivotTableLabFilters = createPivotTableFilters;

export const filterPivotTableLabRecords = (
  records: PivotTableLabRecord[],
  filters: PivotTableLabFilterMap,
) => {
  const filterSets = new Map(
    Object.entries(filters).map(([code, values]) => [code, new Set(values)] as const),
  );

  return records.filter((record) => {
    for (const [code, selectedValues] of filterSets) {
      if (!selectedValues.has(String(record[code as keyof PivotTableLabRecord] ?? ""))) {
        return false;
      }
    }
    return true;
  });
};

export const reorderPivotTableLabDimCodes = reorderPivotDesignerDimCodes;

export const collectPivotTableLabDrillTreeKeys = (
  records: PivotTableLabRecord[],
  dimCodes: string[],
) => {
  return collectPivotTableDrillTreeKeys(records, dimCodes);
};

export const prunePivotTableLabOpenKeys = prunePivotDesignerOpenKeys;

const resolvePivotValue = (
  matrix: RecordMatrix<{ amount: number; target: number }>,
  leftNode: any,
  topNode: any,
) => {
  const record = matrix.get(leftNode.data.dataKey)?.get(topNode.data.dataKey);
  if (!record) {
    return "-";
  }

  const indicator = leftNode.data?.indicator || topNode.data?.indicator;
  if (!indicator) {
    return record.amount;
  }
  if (indicator.code === "rate") {
    if (!record.target) {
      return "-";
    }
    return Number((record.amount / record.target).toFixed(2));
  }
  return record[indicator.code];
};

export const resolvePivotTableLabValue = resolvePivotValue;

export const resolvePivotTableLabRenderedValue = (value: any, leftNode: any, topNode: any) => {
  const indicator = leftNode?.data?.indicator || topNode?.data?.indicator;
  if (indicator?.code === "rate" && typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }
  if (typeof value === "number") {
    return value.toLocaleString("zh-CN");
  }
  return value;
};

const createLeftMetaColumns = (leftCodes: string[]) => {
  return leftCodes.map((code) => {
    const dimension = PIVOT_TABLE_LAB_DIMENSIONS.find((item) => item.code === code);
    return {
      key: code,
      name: dimension?.name || code,
      width: dimension?.width,
    } satisfies CrossTableLeftMetaColumn;
  });
};

export const buildPivotTableLabSnapshot = ({
  records,
  leftDimCodes,
  topDimCodes = PIVOT_TABLE_LAB_DEFAULT_TOP_CODES,
  filters,
  treeOpenKeys = [],
  crossLeftExpandKeys = [],
  crossTopExpandKeys = [],
  indicatorSide = "top",
  showSubtotal = true,
  subtotalPosition = "top",
  showGrandTotalRow = false,
  grandTotalRowPosition = "bottom",
  showGrandTotalColumn = false,
  grandTotalColumnPosition = "right",
  supportsExpand = false,
}: BuildPivotTableLabSnapshotOptions): PivotTableLabSnapshot => {
  const dimensionValueMap = createPivotTableLabDimensionValueMap(records);
  const filteredRecords = filterPivotTableLabRecords(records, filters);
  const resolvedLeftCodes = [...leftDimCodes];
  const resolvedTopCodes = [...topDimCodes];
  const leftMetaColumns = createLeftMetaColumns(resolvedLeftCodes);

  const crossLeftDrillTree = buildDrillTree(filteredRecords, resolvedLeftCodes, {
    includeTopWrapper: true,
    isExpand: !supportsExpand ? undefined : (key) => crossLeftExpandKeys.includes(key),
  });
  const crossTopDrillTree = buildDrillTree(filteredRecords, resolvedTopCodes, {
    includeTopWrapper: true,
    isExpand: !supportsExpand ? undefined : (key) => crossTopExpandKeys.includes(key),
  });
  const crossMatrix = buildRecordMatrix({
    data: filteredRecords,
    leftCodes: resolvedLeftCodes,
    topCodes: resolvedTopCodes,
    aggregate: aggregatePivotTableLabRecords,
    prebuiltLeftTree: crossLeftDrillTree,
    prebuiltTopTree: crossTopDrillTree,
  });
  const [crossLeftTreeRoot] = convertDrillTreeToCrossTree(crossLeftDrillTree, {
    indicators: indicatorSide === "left" ? pivotTableLabIndicators : null,
    supportsExpand,
    expandKeys: crossLeftExpandKeys,
    generateSubtotalNode: createSubtotalNodeFactory({
      showSubtotal,
      subtotalPosition,
      showGrandTotal: showGrandTotalRow,
      grandTotalPosition: grandTotalRowPosition,
    }),
  });
  const [crossTopTreeRoot] = convertDrillTreeToCrossTree(crossTopDrillTree, {
    indicators: indicatorSide === "top" ? pivotTableLabIndicators : null,
    supportsExpand,
    expandKeys: crossTopExpandKeys,
    generateSubtotalNode: createSubtotalNodeFactory({
      showSubtotal,
      subtotalPosition,
      showGrandTotal: showGrandTotalColumn,
      grandTotalPosition: grandTotalColumnPosition,
    }),
  });

  const treeLeftDrillTree = buildDrillTree(filteredRecords, resolvedLeftCodes, {
    includeTopWrapper: true,
  });
  const treeTopDrillTree = buildDrillTree(filteredRecords, PIVOT_TABLE_LAB_TREE_TOP_CODES, {
    includeTopWrapper: true,
  });
  const treeMatrix = buildRecordMatrix({
    data: filteredRecords,
    leftCodes: resolvedLeftCodes,
    topCodes: PIVOT_TABLE_LAB_TREE_TOP_CODES,
    aggregate: aggregatePivotTableLabRecords,
    prebuiltLeftTree: treeLeftDrillTree,
    prebuiltTopTree: treeTopDrillTree,
  });
  const [treeLeftTreeRoot] = convertDrillTreeToCrossTree(treeLeftDrillTree, {
    supportsExpand: true,
    expandKeys: treeOpenKeys,
  });
  const [treeTopTreeRoot] = convertDrillTreeToCrossTree(treeTopDrillTree, {
    indicators: pivotTableLabIndicators,
  });

  return {
    records,
    filteredRecords,
    dimensionValueMap,
    leftMetaColumns,
    cross: {
      matrix: crossMatrix,
      leftTree: (crossLeftTreeRoot.children || []) as LeftCrossTreeNode[],
      leftTotalNode: crossLeftTreeRoot as LeftCrossTreeNode,
      topTree: (crossTopTreeRoot.children || []) as TopCrossTreeNode[],
      topTotalNode: crossTopTreeRoot as TopCrossTreeNode,
    },
    tree: {
      matrix: treeMatrix,
      leftTree: (treeLeftTreeRoot.children || []) as LeftCrossTreeNode[],
      topTree: (treeTopTreeRoot.children || []) as TopCrossTreeNode[],
      defaultOpenKeys: treeLeftTreeRoot.children?.[0]?.key ? [treeLeftTreeRoot.children[0].key] : [],
      totalKey: simpleEncode([]),
    },
  };
};

export const createDefaultPivotTableLabSnapshot = () => {
  const records = createPivotTableLabRecords();
  const dimensionValueMap = createPivotTableLabDimensionValueMap(records);
  return buildPivotTableLabSnapshot({
    records,
    leftDimCodes: [...PIVOT_TABLE_LAB_DEFAULT_LEFT_CODES],
    filters: createPivotTableLabFilters(dimensionValueMap),
  });
};
