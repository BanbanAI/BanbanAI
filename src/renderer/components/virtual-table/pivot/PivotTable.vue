<template>
  <cross-table
    v-if="mode === 'cross'"
    ref="crossTableRef"
    :left-tree="model.cross.leftTree"
    :left-total-node="model.cross.leftTotalNode"
    :top-tree="model.cross.topTree"
    :top-total-node="model.cross.topTotalNode"
    :left-meta-columns="model.leftMetaColumns"
    :corner-header-rows="resolvedCornerHeaderRows"
    :default-column-width="defaultColumnWidth"
    :get-value="getCrossValue"
    :render="renderCrossValue"
    :get-cell-props="getCrossCellProps"
    :on-change-left-expand-keys="onChangeLeftExpandKeys"
    :on-change-top-expand-keys="onChangeTopExpandKeys"
    :estimated-row-height="estimatedRowHeight"
    :min-row-height="minRowHeight"
    :overscan="overscan"
    :header-height="headerHeight"
    :loading="loading"
    :empty-text="emptyText"
    :loading-text="loadingText"
    :show-footer="showFooter"
    :footer-height="footerHeight"
    :container-width="containerWidth"
    :container-min-width="containerMinWidth"
    :container-max-width="containerMaxWidth"
    :container-height="containerHeight"
    :container-min-height="containerMinHeight"
    :container-max-height="containerMaxHeight"
    :body-height-mode="bodyHeightMode"
    :cell-vertical-align="cellVerticalAlign"
    :enable-column-resize="enableColumnResize"
    :row-class-name="rowClassName"
    @cell-click="$emit('cell-click', $event)"
    @cell-dblclick="$emit('cell-dblclick', $event)"
    @column-width-change="$emit('column-width-change', $event)"
  >
    <template #header-cell="slotProps">
      <slot name="header-cell" v-bind="buildHeaderSlotPayload(slotProps)">
        <default-cross-table-header-cell :column="slotProps.column" />
      </slot>
    </template>

    <template #cell="slotProps">
      <slot name="cell" v-bind="buildCrossCellSlotPayload(slotProps)">
        <default-cross-table-body-cell
          :row="slotProps.row"
          :column="slotProps.column"
          :render="renderCrossSlotValue"
        />
      </slot>
    </template>
  </cross-table>

  <cross-tree-table
    v-else
    ref="crossTreeTableRef"
    :primary-column="resolvedTreePrimaryColumn"
    :left-tree="model.tree.leftTree"
    :top-tree="model.tree.topTree"
    :default-open-keys="defaultTreeOpenKeys"
    :open-keys="treeOpenKeys"
    :default-column-width="defaultColumnWidth"
    :get-value="getTreeValue"
    :render="renderTreeValue"
    :get-cell-props="getTreeCellProps"
    :estimated-row-height="estimatedRowHeight"
    :min-row-height="minRowHeight"
    :overscan="overscan"
    :header-height="headerHeight"
    :loading="loading"
    :empty-text="emptyText"
    :loading-text="loadingText"
    :show-footer="showFooter"
    :footer-height="footerHeight"
    :container-width="containerWidth"
    :container-min-width="containerMinWidth"
    :container-max-width="containerMaxWidth"
    :container-height="containerHeight"
    :container-min-height="containerMinHeight"
    :container-max-height="containerMaxHeight"
    :body-height-mode="bodyHeightMode"
    :cell-vertical-align="cellVerticalAlign"
    :enable-column-resize="enableColumnResize"
    :row-class-name="rowClassName"
    @change-open-keys="$emit('change-tree-open-keys', $event)"
    @cell-click="$emit('cell-click', $event)"
    @cell-dblclick="$emit('cell-dblclick', $event)"
    @column-width-change="$emit('column-width-change', $event)"
  >
    <template #header-cell="slotProps">
      <slot name="header-cell" v-bind="buildHeaderSlotPayload(slotProps)">
        <default-cross-tree-table-header-cell :column="slotProps.column" />
      </slot>
    </template>

    <template #cell="slotProps">
      <slot name="cell" v-bind="buildTreeCellSlotPayload(slotProps)">
        <default-cross-tree-table-body-cell
          :row="slotProps.row"
          :column="slotProps.column"
          :indent-size="resolvedTreeIndentSize"
          :render="renderTreeSlotValue"
        />
      </slot>
    </template>
  </cross-tree-table>
</template>

<script setup lang="ts">
import i18next from "i18next";
import { computed, ref, type PropType } from "vue";
import type {
  VirtualTableBodyCellSlotProps,
  VirtualTableBodyHeightMode,
  VirtualTableColumn,
  VirtualTableHeaderCellSlotProps,
  VirtualTableVerticalAlign,
} from "../types";
import {
  CrossTable,
  DefaultCrossTableBodyCell,
  DefaultCrossTableHeaderCell,
} from "./cross-table";
import type { LeftCrossTreeNode, TopCrossTreeNode } from "./cross-table";
import { getPivotColumnMeta, getPivotLeftCell, type CrossTableRenderRow } from "./cross-table/internals";
import {
  CrossTreeTable,
  DefaultCrossTreeTableBodyCell,
  DefaultCrossTreeTableHeaderCell,
} from "./cross-tree-table";
import type { CrossTreePrimaryColumn, CrossTreeTableRenderRow } from "./cross-tree-table";
import type { CrossTableCornerHeaderRow } from "./cross-table";
import {
  buildPivotTableModel,
  type PivotTableCellSlotPayload,
  type PivotTableDimension,
  type PivotTableExpandAction,
  type PivotTableFilterMap,
  type PivotTableGrandTotalColumnPosition,
  type PivotTableGrandTotalRowPosition,
  type PivotTableHeaderSlotPayload,
  type PivotTableHandle,
  type PivotTableIndicator,
  type PivotTableIndicatorSide,
  type PivotTableRenderContext,
  type PivotTableSubtotalPosition,
  type PivotTableSlotRegion,
  type PivotVirtualTableHandle,
} from "./model";
import { buildPivotTableExportData } from "./pivot-export";

const props = defineProps({
  mode: {
    type: String as PropType<"cross" | "tree">,
    default: "cross",
  },
  records: {
    type: Array as PropType<Record<string, any>[]>,
    default: () => [],
  },
  dimensions: {
    type: Array as PropType<PivotTableDimension[]>,
    required: true,
  },
  leftCodes: {
    type: Array as PropType<string[]>,
    required: true,
  },
  topCodes: {
    type: Array as PropType<string[]>,
    required: true,
  },
  treeTopCodes: {
    type: Array as PropType<string[] | undefined>,
    default: undefined,
  },
  indicators: {
    type: Array as PropType<PivotTableIndicator[]>,
    required: true,
  },
  columnWidthMap: {
    type: Object as PropType<Record<string, number> | undefined>,
    default: undefined,
  },
  aggregate: {
    type: Function as PropType<(slice: any[]) => any>,
    required: true,
  },
  filters: {
    type: Object as PropType<PivotTableFilterMap | undefined>,
    default: undefined,
  },
  indicatorSide: {
    type: String as PropType<PivotTableIndicatorSide>,
    default: "top",
  },
  showSubtotal: {
    type: Boolean,
    default: true,
  },
  showSubtotalRow: {
    type: Boolean as PropType<boolean | undefined>,
    default: undefined,
  },
  showSubtotalColumn: {
    type: Boolean as PropType<boolean | undefined>,
    default: undefined,
  },
  subtotalPosition: {
    type: String as PropType<PivotTableSubtotalPosition>,
    default: "top",
  },
  subtotalRowPosition: {
    type: String as PropType<PivotTableSubtotalPosition | undefined>,
    default: undefined,
  },
  subtotalColumnPosition: {
    type: String as PropType<PivotTableSubtotalPosition | undefined>,
    default: undefined,
  },
  showGrandTotalRow: {
    type: Boolean,
    default: false,
  },
  grandTotalRowPosition: {
    type: String as PropType<PivotTableGrandTotalRowPosition>,
    default: "bottom",
  },
  showGrandTotalColumn: {
    type: Boolean,
    default: false,
  },
  grandTotalColumnPosition: {
    type: String as PropType<PivotTableGrandTotalColumnPosition>,
    default: "right",
  },
  supportsExpand: {
    type: Boolean,
    default: false,
  },
  leftExpandKeys: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  topExpandKeys: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  treeOpenKeys: {
    type: Array as PropType<string[] | undefined>,
    default: undefined,
  },
  treePrimaryColumn: {
    type: Object as PropType<CrossTreePrimaryColumn | undefined>,
    default: undefined,
  },
  treeIndentSize: {
    type: Number,
    default: 16,
  },
  defaultColumnWidth: {
    type: Number,
    default: 100,
  },
  estimatedRowHeight: {
    type: Number,
    default: 44,
  },
  minRowHeight: {
    type: Number,
    default: 40,
  },
  overscan: {
    type: Number,
    default: 6,
  },
  headerHeight: {
    type: Number,
    default: 40,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  emptyText: {
    type: String,
    default: "",
  },
  loadingText: {
    type: String,
    default: "",
  },
  showFooter: {
    type: Boolean,
    default: false,
  },
  footerHeight: {
    type: Number,
    default: 32,
  },
  containerWidth: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  containerMinWidth: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  containerMaxWidth: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  containerHeight: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  containerMinHeight: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  containerMaxHeight: {
    type: [String, Number] as PropType<string | number | undefined>,
    default: undefined,
  },
  bodyHeightMode: {
    type: String as PropType<VirtualTableBodyHeightMode>,
    default: "fill",
  },
  cellVerticalAlign: {
    type: String as PropType<VirtualTableVerticalAlign>,
    default: "middle",
  },
  enableColumnResize: {
    type: Boolean,
    default: false,
  },
  rowClassName: {
    type: [String, Function] as PropType<string | ((row: Record<string, any>, rowIndex: number) => string | undefined)>,
    default: "",
  },
  renderValue: {
    type: Function as PropType<(
      value: any,
      context: PivotTableRenderContext,
    ) => any>,
    default: undefined,
  },
  showCornerDimensionHeader: {
    type: Boolean,
    default: false,
  },
});

defineSlots<{
  "header-cell"?: (props: PivotTableHeaderSlotPayload) => any;
  cell?: (props: PivotTableCellSlotPayload) => any;
}>();

const emit = defineEmits<{
  (event: "change-left-expand-keys", payload: { nextKeys: string[]; targetNode: any; action: "collapse" | "expand" }): void;
  (event: "change-top-expand-keys", payload: { nextKeys: string[]; targetNode: any; action: "collapse" | "expand" }): void;
  (event: "change-tree-open-keys", payload: { nextOpenKeys: string[]; row: CrossTreeTableRenderRow }): void;
  (event: "cell-click", payload: any): void;
  (event: "cell-dblclick", payload: any): void;
  (event: "column-width-change", payload: any): void;
}>();

type PivotCrossCellSlotProps = VirtualTableBodyCellSlotProps & {
  row: CrossTableRenderRow;
  leftNode?: LeftCrossTreeNode;
  topNode?: TopCrossTreeNode;
  leftDepth?: number;
  topDepth?: number;
};

type PivotTreeCellSlotProps = VirtualTableBodyCellSlotProps & {
  row: CrossTreeTableRenderRow;
  leftNode?: LeftCrossTreeNode;
  topNode?: TopCrossTreeNode;
  leftDepth?: number;
  topDepth?: number;
  toggleRow?: () => void;
};

const noopToggle = () => {};
const crossTableRef = ref<PivotVirtualTableHandle | null>(null);
const crossTreeTableRef = ref<PivotVirtualTableHandle | null>(null);

const model = computed(() => {
  return buildPivotTableModel({
    records: props.records,
    dimensions: props.dimensions,
    leftCodes: props.leftCodes,
    topCodes: props.topCodes,
    treeTopCodes: props.treeTopCodes,
    indicators: props.indicators,
    aggregate: props.aggregate,
    columnWidthMap: props.columnWidthMap,
    filters: props.filters,
    indicatorSide: props.indicatorSide,
    showSubtotal: props.showSubtotal,
    showSubtotalRow: props.showSubtotalRow,
    showSubtotalColumn: props.showSubtotalColumn,
    subtotalPosition: props.subtotalPosition,
    subtotalRowPosition: props.subtotalRowPosition,
    subtotalColumnPosition: props.subtotalColumnPosition,
    showGrandTotalRow: props.showGrandTotalRow,
    grandTotalRowPosition: props.grandTotalRowPosition,
    showGrandTotalColumn: props.showGrandTotalColumn,
    grandTotalColumnPosition: props.grandTotalColumnPosition,
    supportsExpand: props.supportsExpand,
    leftExpandKeys: props.leftExpandKeys,
    topExpandKeys: props.topExpandKeys,
    treeOpenKeys: props.treeOpenKeys || [],
  });
});

const defaultTreeOpenKeys = computed(() => {
  return model.value.tree.defaultOpenKeys;
});

const resolvedTreeIndentSize = computed(() => {
  return Math.max(0, Number(props.treeIndentSize) || 16);
});

const resolvedTreePrimaryColumn = computed(() => {
  if (props.treePrimaryColumn) {
    return props.treePrimaryColumn;
  }
  const labels = props.leftCodes
    .map((code) => props.dimensions.find((dimension) => String(dimension.code) === code)?.name || code)
    .filter(Boolean);
  return {
    name: labels.length
      ? i18next.t("PivotTable.treePrimaryColumnWithLabels", { labels: labels.join(" / ") })
      : i18next.t("PivotTable.treePrimaryColumn"),
    width: 220,
  } satisfies CrossTreePrimaryColumn;
});

const resolvedCornerHeaderRows = computed<CrossTableCornerHeaderRow[]>(() => {
  if (
    !props.showCornerDimensionHeader
    || props.mode !== "cross"
    || props.indicatorSide !== "top"
    || props.topCodes.length === 0
    || props.leftCodes.length === 0
  ) {
    return [];
  }

  return props.topCodes
    .map((code, index) => {
      const dimension = props.dimensions.find((item) => String(item.code) === code);
      const title = dimension?.name || code;
      if (!title) {
        return null;
      }
      return {
        key: `__pivot-corner-dimension-${index}`,
        title,
      } satisfies CrossTableCornerHeaderRow;
    })
    .filter(Boolean) as CrossTableCornerHeaderRow[];
});

const resolvedInnerTable = computed(() => {
  return props.mode === "cross" ? crossTableRef.value : crossTreeTableRef.value;
});

defineExpose({
  getCurrentMode: () => props.mode,
  getInnerTable: () => resolvedInnerTable.value,
  getExportData: () => buildPivotTableExportData(model.value, {
    mode: props.mode,
    defaultColumnWidth: props.defaultColumnWidth,
    cornerHeaderRows: resolvedCornerHeaderRows.value,
    treePrimaryColumn: resolvedTreePrimaryColumn.value,
    treeOpenKeys: props.treeOpenKeys || defaultTreeOpenKeys.value,
    treeIndentSize: resolvedTreeIndentSize.value,
  }),
  getScroller: () => resolvedInnerTable.value?.getScroller?.() || null,
  getVirtualState: () => resolvedInnerTable.value?.getVirtualState?.() || {},
  scrollTo: (options = {}) => {
    resolvedInnerTable.value?.scrollTo?.(options);
  },
  scrollToRowIndex: (rowIndex, options = {}) => {
    resolvedInnerTable.value?.scrollToRowIndex?.(rowIndex, options);
  },
} satisfies PivotTableHandle);

const onChangeLeftExpandKeys = (
  nextKeys: string[],
  targetNode: LeftCrossTreeNode,
  action: "collapse" | "expand",
) => {
  emit("change-left-expand-keys", {
    nextKeys,
    targetNode,
    action,
  });
};

const onChangeTopExpandKeys = (
  nextKeys: string[],
  targetNode: TopCrossTreeNode,
  action: "collapse" | "expand",
) => {
  emit("change-top-expand-keys", {
    nextKeys,
    targetNode,
    action,
  });
};

const getCrossValue = (leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode) => {
  return model.value.resolveCrossValue(leftNode, topNode);
};

const getTreeValue = (leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode) => {
  return model.value.resolveTreeValue(leftNode, topNode);
};

const renderCrossValue = (value: any, leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode) => {
  const record = model.value.resolveCrossRecord(leftNode, topNode);
  return model.value.renderValue(value, leftNode, topNode, record, props.renderValue);
};

const renderTreeValue = (value: any, leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode) => {
  const record = model.value.resolveTreeRecord(leftNode, topNode);
  return model.value.renderValue(value, leftNode, topNode, record, props.renderValue);
};

const renderCrossSlotValue = (
  value: any,
  leftNode: LeftCrossTreeNode,
  topNode: TopCrossTreeNode,
  _leftDepth: number,
  _topDepth: number,
) => {
  return renderCrossValue(value, leftNode, topNode);
};

const renderTreeSlotValue = (
  value: any,
  leftNode: LeftCrossTreeNode,
  topNode: TopCrossTreeNode,
  _leftDepth: number,
  _topDepth: number,
) => {
  return renderTreeValue(value, leftNode, topNode);
};

const getCrossCellProps = (value: any, leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode) => {
  return model.value.getCellProps(value, leftNode, topNode, model.value.resolveCrossRecord(leftNode, topNode));
};

const getTreeCellProps = (value: any, leftNode: LeftCrossTreeNode, topNode: TopCrossTreeNode) => {
  return model.value.getCellProps(value, leftNode, topNode, model.value.resolveTreeRecord(leftNode, topNode));
};

const resolvePivotMeta = (column: VirtualTableColumn | undefined) => {
  return column?.meta?.pivot as Record<string, any> | undefined;
};

const resolvePivotRegion = (
  mode: "cross" | "tree",
  column: VirtualTableColumn | undefined,
): PivotTableSlotRegion => {
  const region = resolvePivotMeta(column)?.region;
  if (mode === "tree") {
    return region === "tree-primary" ? "tree-primary" : "tree-data";
  }
  if (region === "corner") {
    return "corner-header";
  }
  return region === "left" ? "left-meta" : "cross-data";
};

const resolveDisplayTitle = (column: VirtualTableColumn | undefined) => {
  const pivotMeta = resolvePivotMeta(column);
  return pivotMeta?.title ?? column?.title ?? "";
};

const buildHeaderToggleState = (column: VirtualTableColumn | undefined) => {
  const pivotMeta = resolvePivotMeta(column);
  const canToggle = Boolean(pivotMeta?.expandable && typeof pivotMeta.triggerExpand === "function");
  return {
    canToggle,
    expanded: Boolean(pivotMeta?.expanded),
    nextExpandKeys: pivotMeta?.nextExpandKeys as string[] | undefined,
    toggleAction: pivotMeta?.action as PivotTableExpandAction | undefined,
    toggleColumn: () => {
      if (canToggle) {
        pivotMeta?.triggerExpand?.();
      }
    },
  };
};

const resolveIndicator = (
  leftNode: LeftCrossTreeNode | undefined,
  topNode: TopCrossTreeNode | undefined,
) => {
  const rawIndicator = leftNode?.data?.indicator || topNode?.data?.indicator;
  return (rawIndicator?.meta?.pivotIndicatorConfig || rawIndicator) as PivotTableIndicator | undefined;
};

const resolveCrossCellLeftNode = (slotProps: PivotCrossCellSlotProps) => {
  const pivotMeta = getPivotColumnMeta(slotProps.column);
  if (pivotMeta?.region === "left") {
    return getPivotLeftCell(slotProps.row, pivotMeta.leftDepth || 0)?.node
      || slotProps.row.__pivotLeafNode
      || (slotProps.leftNode as LeftCrossTreeNode | undefined);
  }
  return (slotProps.leftNode as LeftCrossTreeNode | undefined) || slotProps.row.__pivotLeafNode || undefined;
};

const resolveCrossCellLeftDepth = (
  slotProps: PivotCrossCellSlotProps,
  leftNode: LeftCrossTreeNode | undefined,
) => {
  const pivotMeta = getPivotColumnMeta(slotProps.column);
  if (pivotMeta?.region === "left") {
    return pivotMeta.leftDepth || 0;
  }
  if (typeof slotProps.leftDepth === "number" && slotProps.leftDepth >= 0) {
    return slotProps.leftDepth;
  }
  if (leftNode) {
    return Math.max(0, slotProps.row.__pivotLeftNodes.length - 1);
  }
  return -1;
};

const resolveCrossLeftMetaDisplayValue = (
  slotProps: PivotCrossCellSlotProps,
  leftNode: LeftCrossTreeNode | undefined,
  leftDepth: number,
) => {
  if (!leftNode) {
    return slotProps.value;
  }
  const pivotMeta = getPivotColumnMeta(slotProps.column);
  const rendered = pivotMeta?.leftMetaColumn?.render?.(leftNode, Math.max(0, leftDepth));
  return rendered ?? leftNode.title ?? leftNode.value ?? slotProps.value;
};

const buildCrossCellToggleState = (leftNode: LeftCrossTreeNode | undefined) => {
  const pivotMeta = leftNode?.meta?.pivot as Record<string, any> | undefined;
  const canToggle = Boolean(pivotMeta?.expandable && typeof pivotMeta.triggerExpand === "function");
  return {
    canToggle,
    expanded: Boolean(pivotMeta?.expanded),
    nextExpandKeys: pivotMeta?.nextExpandKeys as string[] | undefined,
    toggleAction: pivotMeta?.action as PivotTableExpandAction | undefined,
    toggleRow: () => {
      if (canToggle) {
        pivotMeta?.triggerExpand?.();
      }
    },
  };
};

const resolveTreePrimaryDisplayValue = (
  slotProps: PivotTreeCellSlotProps,
  leftNode: LeftCrossTreeNode | undefined,
) => {
  if (!leftNode) {
    return slotProps.value;
  }
  const pivotMeta = resolvePivotMeta(slotProps.column);
  const treeDepth = slotProps.row.__pivotTreeDepth ?? slotProps.leftDepth ?? 0;
  const rendered = pivotMeta?.primaryColumn?.render?.(leftNode, Math.max(0, treeDepth));
  return rendered ?? leftNode.title ?? leftNode.value ?? slotProps.value;
};

const buildTreeCellToggleState = (
  slotProps: PivotTreeCellSlotProps,
  pivotRegion: PivotTableSlotRegion,
) => {
  const row = slotProps.row;
  const canToggle = pivotRegion === "tree-primary"
    && Boolean(row.__pivotTreeHasChildren && !row.__pivotTreeLeaf && typeof slotProps.toggleRow === "function");
  return {
    canToggle,
    expanded: Boolean(row.__pivotTreeExpanded),
    nextExpandKeys: row.__pivotTreeNextOpenKeys,
    toggleAction: row.__pivotTreeAction,
    toggleRow: () => {
      if (canToggle) {
        slotProps.toggleRow?.();
      }
    },
  };
};

const buildHeaderSlotPayload = (
  slotProps: VirtualTableHeaderCellSlotProps,
): PivotTableHeaderSlotPayload => {
  const column = slotProps.column as VirtualTableColumn;
  const pivotMeta = resolvePivotMeta(column);
  const pivotRegion = resolvePivotRegion(props.mode, column);
  const toggleState = buildHeaderToggleState(column);
  const isTreePrimary = pivotRegion === "tree-primary";
  const isLeftMeta = pivotRegion === "left-meta";
  const isCornerHeader = pivotRegion === "corner-header";

  return {
    ...slotProps,
    mode: props.mode,
    indicatorSide: props.indicatorSide,
    column,
    pivotMeta,
    topNode: pivotMeta?.topNode as TopCrossTreeNode | undefined,
    displayTitle: resolveDisplayTitle(column),
    pivotRegion,
    isTreePrimary,
    isLeftMeta,
    isDataColumn: !isTreePrimary && !isLeftMeta && !isCornerHeader,
    canToggle: toggleState.canToggle,
    expanded: toggleState.expanded,
    nextExpandKeys: toggleState.nextExpandKeys,
    toggleAction: toggleState.toggleAction,
    toggleColumn: toggleState.toggleColumn,
  };
};

const buildCrossCellSlotPayload = (
  slotProps: PivotCrossCellSlotProps,
): PivotTableCellSlotPayload => {
  const column = slotProps.column as VirtualTableColumn;
  const pivotMeta = resolvePivotMeta(column);
  const pivotRegion = resolvePivotRegion("cross", column);
  const isLeftMeta = pivotRegion === "left-meta";
  const leftNode = resolveCrossCellLeftNode(slotProps);
  const leftDepth = resolveCrossCellLeftDepth(slotProps, leftNode);
  const topNode = isLeftMeta
    ? undefined
    : ((slotProps.topNode as TopCrossTreeNode | undefined) || (pivotMeta?.topNode as TopCrossTreeNode | undefined));
  const record = leftNode && topNode ? model.value.resolveCrossRecord(leftNode, topNode) : undefined;
  const indicator = resolveIndicator(leftNode, topNode);
  const displayValue = isLeftMeta
    ? resolveCrossLeftMetaDisplayValue(slotProps, leftNode, leftDepth)
    : (leftNode && topNode
      ? model.value.renderValue(slotProps.value, leftNode, topNode, record, props.renderValue)
      : slotProps.value);
  const toggleState = isLeftMeta ? buildCrossCellToggleState(leftNode) : {
    canToggle: false,
    expanded: false,
    nextExpandKeys: undefined,
    toggleAction: undefined,
    toggleRow: noopToggle,
  };

  return {
    ...slotProps,
    mode: "cross" as const,
    indicatorSide: props.indicatorSide,
    pivotMeta,
    leftNode,
    topNode,
    indicator,
    record,
    rawValue: slotProps.value,
    displayValue,
    pivotRegion,
    isTreePrimary: false,
    isLeftMeta,
    isDataCell: !isLeftMeta,
    canToggle: toggleState.canToggle,
    expanded: toggleState.expanded,
    nextExpandKeys: toggleState.nextExpandKeys,
    toggleAction: toggleState.toggleAction,
    toggleRow: toggleState.toggleRow,
    treeNode: undefined,
    treePathNodes: [],
    treeDepth: -1,
    treeExpanded: false,
    treeLeaf: false,
    treeHasChildren: false,
    treeNextOpenKeys: undefined,
    treeToggleAction: undefined,
  };
};

const buildTreeCellSlotPayload = (
  slotProps: PivotTreeCellSlotProps,
): PivotTableCellSlotPayload => {
  const column = slotProps.column as VirtualTableColumn;
  const pivotMeta = resolvePivotMeta(column);
  const pivotRegion = resolvePivotRegion("tree", column);
  const leftNode = (slotProps.leftNode as LeftCrossTreeNode | undefined) || slotProps.row.__pivotTreeNode;
  const topNode = pivotRegion === "tree-data"
    ? ((slotProps.topNode as TopCrossTreeNode | undefined) || (pivotMeta?.topNode as TopCrossTreeNode | undefined))
    : undefined;
  const record = leftNode && topNode ? model.value.resolveTreeRecord(leftNode, topNode) : undefined;
  const indicator = resolveIndicator(leftNode, topNode);
  const displayValue = pivotRegion === "tree-primary"
    ? resolveTreePrimaryDisplayValue(slotProps, leftNode)
    : (leftNode && topNode
      ? model.value.renderValue(slotProps.value, leftNode, topNode, record, props.renderValue)
      : slotProps.value);
  const toggleState = buildTreeCellToggleState(slotProps, pivotRegion);

  return {
    ...slotProps,
    mode: "tree" as const,
    indicatorSide: props.indicatorSide,
    pivotMeta,
    leftNode,
    topNode,
    indicator,
    record,
    rawValue: slotProps.value,
    displayValue,
    pivotRegion,
    isTreePrimary: pivotRegion === "tree-primary",
    isLeftMeta: false,
    isDataCell: pivotRegion === "tree-data",
    canToggle: toggleState.canToggle,
    expanded: toggleState.expanded,
    nextExpandKeys: toggleState.nextExpandKeys,
    toggleAction: toggleState.toggleAction,
    toggleRow: toggleState.toggleRow,
    treeNode: leftNode,
    treePathNodes: slotProps.row.__pivotTreePathNodes || [],
    treeDepth: slotProps.row.__pivotTreeDepth ?? slotProps.leftDepth ?? -1,
    treeExpanded: Boolean(slotProps.row.__pivotTreeExpanded),
    treeLeaf: Boolean(slotProps.row.__pivotTreeLeaf),
    treeHasChildren: Boolean(slotProps.row.__pivotTreeHasChildren),
    treeNextOpenKeys: slotProps.row.__pivotTreeNextOpenKeys,
    treeToggleAction: slotProps.row.__pivotTreeAction,
  };
};
</script>
