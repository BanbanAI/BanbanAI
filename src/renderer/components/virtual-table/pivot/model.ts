import type { VNodeChild } from "vue";
import i18next from "i18next";
import type {
  VirtualTableBodyCellSlotProps,
  VirtualTableHeaderCellSlotProps,
  VirtualTableFixed,
} from "../types";
import type {
  CrossTableIndicator,
  CrossTableLeftMetaColumn,
  LeftCrossTreeNode,
  TopCrossTreeNode,
  VirtualPivotCellProps,
} from "./cross-table";
import type { PivotTableExportData } from "./pivot-export";
import {
  getDimensionColumnPassthrough,
  getIndicatorColumnPassthrough,
  normalizeVirtualTableFixed,
} from "./column-props";
import {
  buildDrillTree,
  buildRecordMatrix,
  convertDrillTreeToCrossTree,
  simpleEncode,
  type DrillNode,
  type RecordMatrix,
} from "./pivot-utils";

export type PivotTableIndicator<RecordType = any, AggregateRecord = any> = {
  code: string;
  name: string;
  title?: VNodeChild;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: VirtualTableFixed;
  lock?: boolean | VirtualTableFixed;
  align?: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  hidden?: boolean;
  meta?: Record<string, any>;
  getValue?(record: AggregateRecord | undefined, context: {
    leftNode: LeftCrossTreeNode;
    topNode: TopCrossTreeNode;
  }): any;
  render?(value: any, context: {
    record: AggregateRecord | undefined;
    leftNode: LeftCrossTreeNode;
    topNode: TopCrossTreeNode;
  }): VNodeChild;
  getCellProps?(value: any, context: {
    record: AggregateRecord | undefined;
    leftNode: LeftCrossTreeNode;
    topNode: TopCrossTreeNode;
  }): VirtualPivotCellProps | undefined;
};

export type PivotTableDimension<RecordType = any> = {
  code: keyof RecordType | string;
  name: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: VirtualTableFixed;
  lock?: boolean | VirtualTableFixed;
  align?: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  meta?: Record<string, any>;
};

export type PivotTableIndicatorSide = "top" | "left";
export type PivotTableSubtotalPosition = "top" | "bottom";
export type PivotTableGrandTotalRowPosition = "top" | "bottom";
export type PivotTableGrandTotalColumnPosition = "left" | "right";
export type PivotTableExpandAction = "expand" | "collapse";
export type PivotTableSlotRegion = "left-meta" | "cross-data" | "corner-header" | "tree-primary" | "tree-data";
export type PivotTableHeaderSlotRegion = PivotTableSlotRegion;
export type PivotTableCellSlotRegion = Exclude<PivotTableSlotRegion, "corner-header">;

export type PivotTableDimensionValueMap = Record<string, string[]>;
export type PivotTableFilterMap = Record<string, string[]>;
export type PivotVirtualTableHandle = {
  getScroller(): HTMLElement | null;
  getVirtualState(): Record<string, any>;
  scrollTo(options?: { top?: number; left?: number; behavior?: ScrollBehavior }): void;
  scrollToRowIndex(
    rowIndex: number,
    options?: { align?: "start" | "center" | "end"; behavior?: ScrollBehavior },
  ): void;
};

export type PivotTableHandle = PivotVirtualTableHandle & {
  getCurrentMode(): "cross" | "tree";
  getInnerTable(): PivotVirtualTableHandle | null;
  getExportData(): PivotTableExportData;
};

export type PivotTableHeaderSlotPayload = VirtualTableHeaderCellSlotProps & {
  mode: "cross" | "tree";
  indicatorSide: PivotTableIndicatorSide;
  pivotMeta?: Record<string, any>;
  topNode?: TopCrossTreeNode;
  displayTitle: VNodeChild;
  pivotRegion: PivotTableHeaderSlotRegion;
  isTreePrimary: boolean;
  isLeftMeta: boolean;
  isDataColumn: boolean;
  canToggle: boolean;
  expanded: boolean;
  nextExpandKeys?: string[];
  toggleAction?: PivotTableExpandAction;
  toggleColumn: () => void;
};

export type PivotTableCellSlotPayload<RecordType = any, AggregateRecord = any> = VirtualTableBodyCellSlotProps & {
  mode: "cross" | "tree";
  indicatorSide: PivotTableIndicatorSide;
  pivotMeta?: Record<string, any>;
  leftNode?: LeftCrossTreeNode;
  topNode?: TopCrossTreeNode;
  indicator?: PivotTableIndicator<RecordType, AggregateRecord>;
  record: AggregateRecord | undefined;
  rawValue: any;
  displayValue: VNodeChild;
  pivotRegion: PivotTableCellSlotRegion;
  isTreePrimary: boolean;
  isLeftMeta: boolean;
  isDataCell: boolean;
  canToggle: boolean;
  expanded: boolean;
  nextExpandKeys?: string[];
  toggleAction?: PivotTableExpandAction;
  toggleRow: () => void;
  treeNode?: LeftCrossTreeNode;
  treePathNodes: LeftCrossTreeNode[];
  treeDepth: number;
  treeExpanded: boolean;
  treeLeaf: boolean;
  treeHasChildren: boolean;
  treeNextOpenKeys?: string[];
  treeToggleAction?: PivotTableExpandAction;
};

export type BuildPivotTableModelOptions<RecordType = any, AggregateRecord = any> = {
  records: RecordType[];
  dimensions: PivotTableDimension<RecordType>[];
  leftCodes: string[];
  topCodes: string[];
  treeTopCodes?: string[];
  indicators: PivotTableIndicator<RecordType, AggregateRecord>[];
  aggregate(slice: any[]): AggregateRecord;
  columnWidthMap?: Record<string, number>;
  filters?: PivotTableFilterMap;
  indicatorSide?: PivotTableIndicatorSide;
  showSubtotal?: boolean;
  showSubtotalRow?: boolean;
  showSubtotalColumn?: boolean;
  subtotalPosition?: PivotTableSubtotalPosition;
  subtotalRowPosition?: PivotTableSubtotalPosition;
  subtotalColumnPosition?: PivotTableSubtotalPosition;
  showGrandTotalRow?: boolean;
  grandTotalRowPosition?: PivotTableGrandTotalRowPosition;
  showGrandTotalColumn?: boolean;
  grandTotalColumnPosition?: PivotTableGrandTotalColumnPosition;
  supportsExpand?: boolean;
  leftExpandKeys?: string[];
  topExpandKeys?: string[];
  treeOpenKeys?: string[];
  onChangeLeftExpandKeys?(nextKeys: string[], targetNode: DrillNode, action: "collapse" | "expand"): void;
  onChangeTopExpandKeys?(nextKeys: string[], targetNode: DrillNode, action: "collapse" | "expand"): void;
};

export type PivotTableModel<RecordType = any, AggregateRecord = any> = {
  records: RecordType[];
  filteredRecords: RecordType[];
  dimensions: PivotTableDimension<RecordType>[];
  dimensionValueMap: PivotTableDimensionValueMap;
  filters: PivotTableFilterMap;
  leftCodes: string[];
  topCodes: string[];
  treeTopCodes: string[];
  leftMetaColumns: CrossTableLeftMetaColumn[];
  visibleIndicators: PivotTableIndicator<RecordType, AggregateRecord>[];
  indicatorSide: PivotTableIndicatorSide;
  showSubtotal: boolean;
  showSubtotalRow: boolean;
  showSubtotalColumn: boolean;
  subtotalPosition: PivotTableSubtotalPosition;
  subtotalRowPosition: PivotTableSubtotalPosition;
  subtotalColumnPosition: PivotTableSubtotalPosition;
  showGrandTotalRow: boolean;
  grandTotalRowPosition: PivotTableGrandTotalRowPosition;
  showGrandTotalColumn: boolean;
  grandTotalColumnPosition: PivotTableGrandTotalColumnPosition;
  supportsExpand: boolean;
  cross: {
    matrix: RecordMatrix<AggregateRecord>;
    leftTree: LeftCrossTreeNode[];
    leftTotalNode: LeftCrossTreeNode;
    topTree: TopCrossTreeNode[];
    topTotalNode: TopCrossTreeNode;
  };
  tree: {
    matrix: RecordMatrix<AggregateRecord>;
    leftTree: LeftCrossTreeNode[];
    topTree: TopCrossTreeNode[];
    defaultOpenKeys: string[];
    totalKey: string;
  };
  resolveCrossRecord(leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode): AggregateRecord | undefined;
  resolveTreeRecord(leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode): AggregateRecord | undefined;
  resolveCrossValue(leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode): any;
  resolveTreeValue(leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode): any;
  renderValue(
    value: any,
    leftNode: LeftCrossTreeNode | undefined,
    topNode: TopCrossTreeNode | undefined,
    record: AggregateRecord | undefined,
    overrideRender?: ((value: any, context: PivotTableRenderContext<RecordType, AggregateRecord>) => VNodeChild) | undefined,
  ): VNodeChild;
  getCellProps(
    value: any,
    leftNode: LeftCrossTreeNode | undefined,
    topNode: TopCrossTreeNode | undefined,
    record: AggregateRecord | undefined,
  ): VirtualPivotCellProps | undefined;
};

export type PivotTableRenderContext<RecordType = any, AggregateRecord = any> = {
  value: any;
  record: AggregateRecord | undefined;
  leftNode: LeftCrossTreeNode | undefined;
  topNode: TopCrossTreeNode | undefined;
  indicator: PivotTableIndicator<RecordType, AggregateRecord> | undefined;
};

const resolveUniqueValues = <RecordType extends Record<string, any>>(
  records: RecordType[],
  code: string,
) => {
  return Array.from(new Set(records.map((record) => String(record?.[code] ?? ""))));
};

export const createPivotTableDimensionValueMap = <RecordType extends Record<string, any>>(
  records: RecordType[],
  dimensions: PivotTableDimension<RecordType>[],
): PivotTableDimensionValueMap => {
  return dimensions.reduce((result, dimension) => {
    result[String(dimension.code)] = resolveUniqueValues(records, String(dimension.code));
    return result;
  }, {} as PivotTableDimensionValueMap);
};

export const createPivotTableFilters = (
  dimensionValueMap: PivotTableDimensionValueMap,
): PivotTableFilterMap => {
  return Object.fromEntries(
    Object.entries(dimensionValueMap).map(([code, values]) => [code, [...values]]),
  );
};

export const filterPivotTableRecords = <RecordType extends Record<string, any>>(
  records: RecordType[],
  filters: PivotTableFilterMap,
) => {
  const filterSets = new Map(
    Object.entries(filters).map(([code, values]) => [code, new Set(values)] as const),
  );

  return records.filter((record) => {
    for (const [code, selectedValues] of filterSets) {
      if (!selectedValues.has(String(record?.[code] ?? ""))) {
        return false;
      }
    }
    return true;
  });
};

const collectDrillNodeKeys = (nodes: DrillNode[]) => {
  const keys: string[] = [];
  const visit = (items: DrillNode[]) => {
    for (const item of items) {
      keys.push(item.key);
      if (Array.isArray(item.children) && item.children.length) {
        visit(item.children);
      }
    }
  };
  visit(nodes);
  return keys;
};

export const collectPivotTableDrillTreeKeys = <RecordType extends Record<string, any>>(
  records: RecordType[],
  dimCodes: string[],
) => {
  if (!dimCodes.length) {
    return [];
  }
  const [root] = buildDrillTree(records, dimCodes, {
    includeTopWrapper: true,
  });
  return collectDrillNodeKeys(root?.children || []);
};

const toCrossIndicator = <RecordType, AggregateRecord>(
  indicator: PivotTableIndicator<RecordType, AggregateRecord>,
): CrossTableIndicator => {
  return {
    ...getIndicatorColumnPassthrough(indicator),
    code: indicator.code,
    name: indicator.name,
    title: indicator.title,
    fixed: normalizeVirtualTableFixed(indicator.fixed, indicator.lock),
    hidden: indicator.hidden,
    meta: {
      ...(indicator.meta || {}),
      pivotIndicatorConfig: indicator,
    },
  };
};

const createLeftMetaColumns = <RecordType>(
  dimensions: PivotTableDimension<RecordType>[],
  leftCodes: string[],
) => {
  const dimensionMap = new Map(
    dimensions.map((dimension) => [String(dimension.code), dimension] as const),
  );
  return leftCodes.map((code) => {
    const dimension = dimensionMap.get(code);
    return {
      ...getDimensionColumnPassthrough(dimension),
      key: code,
      name: dimension?.name || code,
      width: dimension?.width,
      fixed: normalizeVirtualTableFixed(dimension?.fixed, dimension?.lock, "left"),
    } satisfies CrossTableLeftMetaColumn;
  });
};

const normalizeColumnWidthMap = (widthMap?: Record<string, number>) => {
  if (!widthMap || typeof widthMap !== "object") {
    return {};
  }

  return Object.entries(widthMap).reduce((result, [key, value]) => {
    const nextWidth = Math.round(Number(value) || 0);
    if (key && nextWidth > 0) {
      result[key] = nextWidth;
    }
    return result;
  }, {} as Record<string, number>);
};

const applyTopTreeWidthMap = (
  nodes: TopCrossTreeNode[],
  widthMap: Record<string, number>,
): TopCrossTreeNode[] => {
  return nodes.map((node) => {
    const nextWidth = widthMap[node.key];
    return {
      ...node,
      width: typeof nextWidth === "number" && nextWidth > 0 ? nextWidth : node.width,
      children: node.children?.length ? applyTopTreeWidthMap(node.children, widthMap) : node.children,
    };
  });
};

const resolveSubtotalPosition = (
  subtotalPosition: PivotTableSubtotalPosition,
) => {
  return subtotalPosition === "bottom" ? "end" as const : "start" as const;
};

const resolveGrandTotalPosition = (
  position: PivotTableGrandTotalRowPosition | PivotTableGrandTotalColumnPosition,
) => {
  return position === "bottom" || position === "right" ? "end" as const : "start" as const;
};

const createSubtotalNodeFactory = (
  options: {
    showSubtotal: boolean;
    subtotalPosition: PivotTableSubtotalPosition;
    showGrandTotal: boolean;
    grandTotalPosition: PivotTableGrandTotalRowPosition | PivotTableGrandTotalColumnPosition;
  },
) => {
  return (drillNode: DrillNode) => {
    if (drillNode.path.length === 0) {
      if (!options.showGrandTotal) {
        return null;
      }
      return {
        position: resolveGrandTotalPosition(options.grandTotalPosition),
        value: i18next.t("virtualTable.grandTotal"),
      };
    }

    if (!options.showSubtotal) {
      return null;
    }

    return {
      position: resolveSubtotalPosition(options.subtotalPosition),
      value: i18next.t("virtualTable.subtotal"),
    };
  };
};

const resolveIndicator = (
  leftNode: LeftCrossTreeNode | undefined,
  topNode: TopCrossTreeNode | undefined,
): PivotTableIndicator | undefined => {
  const rawIndicator = leftNode?.data?.indicator || topNode?.data?.indicator;
  return (rawIndicator?.meta?.pivotIndicatorConfig || rawIndicator) as PivotTableIndicator | undefined;
};

const resolveIndicatorValue = (
  indicator: PivotTableIndicator | undefined,
  record: any,
  context: {
    leftNode: LeftCrossTreeNode;
    topNode: TopCrossTreeNode;
  },
) => {
  if (!indicator) {
    return record;
  }
  if (typeof indicator.getValue === "function") {
    return indicator.getValue(record, context);
  }
  return record?.[indicator.code] ?? "-";
};

export const buildPivotTableModel = <RecordType extends Record<string, any>, AggregateRecord = any>({
  records,
  dimensions,
  leftCodes,
  topCodes,
  treeTopCodes = topCodes,
  indicators,
  aggregate,
  columnWidthMap,
  filters,
  indicatorSide = "top",
  showSubtotal = true,
  showSubtotalRow = showSubtotal,
  showSubtotalColumn = showSubtotal,
  subtotalPosition = "top",
  subtotalRowPosition = subtotalPosition,
  subtotalColumnPosition = subtotalPosition,
  showGrandTotalRow = false,
  grandTotalRowPosition = "bottom",
  showGrandTotalColumn = false,
  grandTotalColumnPosition = "right",
  supportsExpand = false,
  leftExpandKeys = [],
  topExpandKeys = [],
  treeOpenKeys = [],
  onChangeLeftExpandKeys,
  onChangeTopExpandKeys,
}: BuildPivotTableModelOptions<RecordType, AggregateRecord>): PivotTableModel<RecordType, AggregateRecord> => {
  const dimensionValueMap = createPivotTableDimensionValueMap(records, dimensions);
  const resolvedFilters = filters || createPivotTableFilters(dimensionValueMap);
  const filteredRecords = filterPivotTableRecords(records, resolvedFilters);
  const visibleIndicators = indicators.filter((indicator) => !indicator.hidden);
  const crossIndicators = visibleIndicators.map(toCrossIndicator);
  const normalizedColumnWidthMap = normalizeColumnWidthMap(columnWidthMap);
  const leftMetaColumns = createLeftMetaColumns(dimensions, leftCodes).map((column) => {
    const nextWidth = column.key ? normalizedColumnWidthMap[column.key] : undefined;
    return typeof nextWidth === "number" && nextWidth > 0
      ? {
        ...column,
        width: nextWidth,
      }
      : column;
  });

  const crossLeftDrillTree = buildDrillTree(filteredRecords, leftCodes, {
    includeTopWrapper: true,
    isExpand: !supportsExpand ? undefined : (key) => leftExpandKeys.includes(key),
  });
  const crossTopDrillTree = buildDrillTree(filteredRecords, topCodes, {
    includeTopWrapper: true,
    isExpand: !supportsExpand ? undefined : (key) => topExpandKeys.includes(key),
  });
  const crossMatrix = buildRecordMatrix({
    data: filteredRecords,
    leftCodes,
    topCodes,
    aggregate,
    prebuiltLeftTree: crossLeftDrillTree,
    prebuiltTopTree: crossTopDrillTree,
  }) as RecordMatrix<AggregateRecord>;

  const [crossLeftTreeRoot] = convertDrillTreeToCrossTree(crossLeftDrillTree, {
    indicators: indicatorSide === "left" ? crossIndicators : null,
    supportsExpand,
    expandKeys: leftExpandKeys,
    onChangeExpandKeys: onChangeLeftExpandKeys,
    generateSubtotalNode: createSubtotalNodeFactory({
      showSubtotal: showSubtotalRow,
      subtotalPosition: subtotalRowPosition,
      showGrandTotal: showGrandTotalRow,
      grandTotalPosition: grandTotalRowPosition,
    }),
  });
  const [crossTopTreeRoot] = convertDrillTreeToCrossTree(crossTopDrillTree, {
    indicators: indicatorSide === "top" ? crossIndicators : null,
    supportsExpand,
    expandKeys: topExpandKeys,
    onChangeExpandKeys: onChangeTopExpandKeys,
    generateSubtotalNode: createSubtotalNodeFactory({
      showSubtotal: showSubtotalColumn,
      subtotalPosition: subtotalColumnPosition,
      showGrandTotal: showGrandTotalColumn,
      grandTotalPosition: grandTotalColumnPosition,
    }),
  });

  const treeLeftDrillTree = buildDrillTree(filteredRecords, leftCodes, {
    includeTopWrapper: true,
  });
  const treeTopDrillTree = buildDrillTree(filteredRecords, treeTopCodes, {
    includeTopWrapper: true,
  });
  const treeMatrix = buildRecordMatrix({
    data: filteredRecords,
    leftCodes,
    topCodes: treeTopCodes,
    aggregate,
    prebuiltLeftTree: treeLeftDrillTree,
    prebuiltTopTree: treeTopDrillTree,
  }) as RecordMatrix<AggregateRecord>;

  const [treeLeftTreeRoot] = convertDrillTreeToCrossTree(treeLeftDrillTree, {
    supportsExpand: true,
    expandKeys: treeOpenKeys,
  });
  const [treeTopTreeRoot] = convertDrillTreeToCrossTree(treeTopDrillTree, {
    indicators: crossIndicators,
  });

  const resolvedCrossTopTreeRoot = {
    ...crossTopTreeRoot,
    children: applyTopTreeWidthMap((crossTopTreeRoot.children || []) as TopCrossTreeNode[], normalizedColumnWidthMap),
  } as TopCrossTreeNode;
  const resolvedTreeTopTreeRoot = {
    ...treeTopTreeRoot,
    children: applyTopTreeWidthMap((treeTopTreeRoot.children || []) as TopCrossTreeNode[], normalizedColumnWidthMap),
  } as TopCrossTreeNode;

  const resolveCrossRecord = (
    leftNode: LeftCrossTreeNode,
    topNode: TopCrossTreeNode,
  ) => {
    return crossMatrix.get(leftNode.data?.dataKey)?.get(topNode.data?.dataKey);
  };

  const resolveTreeRecord = (
    leftNode: LeftCrossTreeNode,
    topNode: TopCrossTreeNode,
  ) => {
    return treeMatrix.get(leftNode.data?.dataKey)?.get(topNode.data?.dataKey);
  };

  const renderValue = (
    value: any,
    leftNode: LeftCrossTreeNode | undefined,
    topNode: TopCrossTreeNode | undefined,
    record: AggregateRecord | undefined,
    overrideRender?: ((value: any, context: PivotTableRenderContext<RecordType, AggregateRecord>) => VNodeChild) | undefined,
  ) => {
    const indicator = resolveIndicator(leftNode, topNode);
    const context = {
      value,
      record,
      leftNode,
      topNode,
      indicator,
    } satisfies PivotTableRenderContext<RecordType, AggregateRecord>;

    if (overrideRender) {
      return overrideRender(value, context);
    }

    if (indicator?.render && leftNode && topNode) {
      return indicator.render(value, {
        record,
        leftNode,
        topNode,
      });
    }
    return value;
  };

  const getCellProps = (
    value: any,
    leftNode: LeftCrossTreeNode | undefined,
    topNode: TopCrossTreeNode | undefined,
    record: AggregateRecord | undefined,
  ) => {
    const indicator = resolveIndicator(leftNode, topNode);
    if (indicator?.getCellProps && leftNode && topNode) {
      return indicator.getCellProps(value, {
        record,
        leftNode,
        topNode,
      });
    }
    return undefined;
  };

  return {
    records,
    filteredRecords,
    dimensions,
    dimensionValueMap,
    filters: resolvedFilters,
    leftCodes,
    topCodes,
    treeTopCodes,
    leftMetaColumns,
    visibleIndicators,
    indicatorSide,
    showSubtotal,
    showSubtotalRow,
    showSubtotalColumn,
    subtotalPosition,
    subtotalRowPosition,
    subtotalColumnPosition,
    showGrandTotalRow,
    grandTotalRowPosition,
    showGrandTotalColumn,
    grandTotalColumnPosition,
    supportsExpand,
    cross: {
      matrix: crossMatrix,
      leftTree: (crossLeftTreeRoot.children || []) as LeftCrossTreeNode[],
      leftTotalNode: crossLeftTreeRoot as LeftCrossTreeNode,
      topTree: (resolvedCrossTopTreeRoot.children || []) as TopCrossTreeNode[],
      topTotalNode: resolvedCrossTopTreeRoot,
    },
    tree: {
      matrix: treeMatrix,
      leftTree: (treeLeftTreeRoot.children || []) as LeftCrossTreeNode[],
      topTree: (resolvedTreeTopTreeRoot.children || []) as TopCrossTreeNode[],
      defaultOpenKeys: treeLeftTreeRoot.children?.[0]?.key ? [treeLeftTreeRoot.children[0].key] : [],
      totalKey: simpleEncode([]),
    },
    resolveCrossRecord,
    resolveTreeRecord,
    resolveCrossValue(leftNode, topNode) {
      const record = resolveCrossRecord(leftNode, topNode);
      return resolveIndicatorValue(resolveIndicator(leftNode, topNode), record, {
        leftNode,
        topNode,
      });
    },
    resolveTreeValue(leftNode, topNode) {
      const record = resolveTreeRecord(leftNode, topNode);
      return resolveIndicatorValue(resolveIndicator(leftNode, topNode), record, {
        leftNode,
        topNode,
      });
    },
    renderValue,
    getCellProps,
  };
};
