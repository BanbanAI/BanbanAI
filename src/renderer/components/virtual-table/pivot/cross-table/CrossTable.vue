<template>
  <virtual-table
    ref="tableRef"
    :columns="built.columns"
    :rows="built.rows"
    :row-key="ROW_KEY"
    :estimated-row-height="estimatedRowHeight"
    :min-row-height="minRowHeight"
    :overscan="overscan"
    :header-height="headerHeight"
    :container-width="containerWidth"
    :container-min-width="containerMinWidth"
    :container-max-width="containerMaxWidth"
    :container-height="containerHeight"
    :container-min-height="containerMinHeight"
    :container-max-height="containerMaxHeight"
    :body-height-mode="bodyHeightMode"
    :cell-vertical-align="cellVerticalAlign"
    :loading="loading"
    :empty-text="emptyText"
    :loading-text="loadingText"
    :show-footer="showFooter"
    :footer-height="footerHeight"
    :enable-column-resize="enableColumnResize"
    :get-cell-span="built.getCellSpan"
    :get-cell-props="getVirtualCellProps"
    :row-class-name="rowClassName"
    @cell-click="$emit('cell-click', $event)"
    @cell-dblclick="$emit('cell-dblclick', $event)"
    @column-width-change="$emit('column-width-change', $event)"
  >
    <template #header-cell="slotProps">
      <slot
        name="header-cell"
        v-bind="slotProps"
      >
        <default-cross-table-header-cell :column="slotProps.column" />
      </slot>
    </template>

    <template #cell="slotProps">
      <slot
        name="cell"
        v-bind="slotProps"
        :left-node="resolveLeftNode(slotProps.row)"
        :top-node="resolveTopNode(slotProps.column)"
        :left-depth="resolveLeftDepth(slotProps.column)"
        :top-depth="resolveTopDepth(slotProps.column)"
      >
        <default-cross-table-body-cell
          :row="slotProps.row"
          :column="slotProps.column"
          :render="props.render"
        />
      </slot>
    </template>
  </virtual-table>
</template>

<script setup lang="ts">
import { computed, ref, type PropType, type VNodeChild } from "vue";
import VirtualTable from "../../VirtualTable.vue";
import type {
  VirtualTableBodyHeightMode,
  VirtualTableCellProps,
  VirtualTableColumn,
  VirtualTableVerticalAlign,
  VirtualVisibleColumnDescriptor,
} from "../../types";
import buildCrossTable from "./buildCrossTable";
import { ROW_KEY } from "./constants";
import type {
  CrossTableCornerHeaderRow,
  CrossTableLeftMetaColumn,
  LeftCrossTreeNode,
  TopCrossTreeNode,
  VirtualPivotCellProps,
} from "./interfaces";
import { getPivotColumnMeta, getPivotLeafNode, getPivotLeftCell, type CrossTableRenderRow } from "./internals";
import type { PivotVirtualTableHandle } from "../model";
import {
  DefaultCrossTableBodyCell,
  DefaultCrossTableHeaderCell,
} from "./renderers";

const props = defineProps({
  leftTree: {
    type: Array as PropType<LeftCrossTreeNode[]>,
    default: () => [],
  },
  topTree: {
    type: Array as PropType<TopCrossTreeNode[]>,
    default: () => [],
  },
  leftTotalNode: {
    type: Object as PropType<LeftCrossTreeNode | undefined>,
    default: undefined,
  },
  topTotalNode: {
    type: Object as PropType<TopCrossTreeNode | undefined>,
    default: undefined,
  },
  leftMetaColumns: {
    type: Array as PropType<CrossTableLeftMetaColumn[]>,
    default: () => [],
  },
  cornerHeaderRows: {
    type: Array as PropType<CrossTableCornerHeaderRow[]>,
    default: () => [],
  },
  defaultColumnWidth: {
    type: Number,
    default: 100,
  },
  getValue: {
    type: Function as PropType<(
      leftNode: LeftCrossTreeNode,
      topNode: TopCrossTreeNode,
      leftDepth: number,
      topDepth: number,
    ) => any>,
    default: undefined,
  },
  render: {
    type: Function as PropType<(
      value: any,
      leftNode: LeftCrossTreeNode,
      topNode: TopCrossTreeNode,
      leftDepth: number,
      topDepth: number,
    ) => VNodeChild>,
    default: undefined,
  },
  getCellProps: {
    type: Function as PropType<(
      value: any,
      leftNode: LeftCrossTreeNode,
      topNode: TopCrossTreeNode,
      leftDepth: number,
      topDepth: number,
    ) => VirtualPivotCellProps | undefined>,
    default: undefined,
  },
  onChangeTopExpandKeys: {
    type: Function as PropType<(
      nextKeys: string[],
      targetNode: TopCrossTreeNode,
      action: "collapse" | "expand",
    ) => void>,
    default: undefined,
  },
  onChangeLeftExpandKeys: {
    type: Function as PropType<(
      nextKeys: string[],
      targetNode: LeftCrossTreeNode,
      action: "collapse" | "expand",
    ) => void>,
    default: undefined,
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
    type: [String, Function] as PropType<string | ((row: CrossTableRenderRow, rowIndex: number) => string | undefined)>,
    default: "",
  },
});

defineSlots<{
  "header-cell"?: (props: Record<string, any>) => any;
  cell?: (props: Record<string, any>) => any;
}>();

defineEmits<{
  (event: "cell-click", payload: any): void;
  (event: "cell-dblclick", payload: any): void;
  (event: "column-width-change", payload: any): void;
}>();

const tableRef = ref<PivotVirtualTableHandle | null>(null);

const built = computed(() => {
  return buildCrossTable({
    leftTree: props.leftTree,
    topTree: props.topTree,
    leftTotalNode: props.leftTotalNode,
    topTotalNode: props.topTotalNode,
    leftMetaColumns: props.leftMetaColumns,
    cornerHeaderRows: props.cornerHeaderRows,
    defaultColumnWidth: props.defaultColumnWidth,
    getValue: props.getValue,
    onChangeLeftExpandKeys: props.onChangeLeftExpandKeys,
    onChangeTopExpandKeys: props.onChangeTopExpandKeys,
  });
});

const resolveLeftNode = (row: CrossTableRenderRow) => {
  return getPivotLeafNode(row);
};

const resolveTopNode = (column: VirtualTableColumn) => {
  return getPivotColumnMeta(column)?.topNode;
};

const resolveLeftDepth = (column: VirtualTableColumn) => {
  return getPivotColumnMeta(column)?.leftDepth ?? -1;
};

const resolveTopDepth = (column: VirtualTableColumn) => {
  return getPivotColumnMeta(column)?.topDepth ?? -1;
};

const getVirtualCellProps = (
  descriptor: VirtualVisibleColumnDescriptor,
  row: Record<string, any>,
  _rowIndex: number,
): VirtualTableCellProps | undefined => {
  if (descriptor.type !== "normal") {
    return undefined;
  }

  const column = descriptor.column;
  const pivotMeta = getPivotColumnMeta(column);
  const pivotRow = row as CrossTableRenderRow;

  if (pivotMeta?.region === "left") {
    const leftCell = getPivotLeftCell(pivotRow, pivotMeta.leftDepth || 0);
    const leftMetaColumn = pivotMeta.leftMetaColumn;
    return leftMetaColumn?.getCellProps?.(leftCell?.node || pivotRow.__pivotLeafNode!, pivotMeta.leftDepth || 0);
  }

  if (pivotMeta?.region === "data" && props.getCellProps && pivotMeta.topNode && pivotRow.__pivotLeafNode) {
    const value = pivotRow[column.dataIndex || column.key];
    return props.getCellProps(
      value,
      pivotRow.__pivotLeafNode,
      pivotMeta.topNode,
      Math.max(0, pivotRow.__pivotLeftNodes.length - 1),
      pivotMeta.topDepth || 0,
    );
  }

  return undefined;
};

defineExpose({
  getScroller: () => tableRef.value?.getScroller?.() || null,
  getVirtualState: () => tableRef.value?.getVirtualState?.() || {},
  scrollTo: (options = {}) => {
    tableRef.value?.scrollTo?.(options);
  },
  scrollToRowIndex: (rowIndex, options = {}) => {
    tableRef.value?.scrollToRowIndex?.(rowIndex, options);
  },
});

</script>

<style scoped lang="scss">
:deep(.virtual-pivot-cross-table__header-text),
:deep(.virtual-pivot-cross-table__cell-text) {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  width: 100%;
}

:deep(.virtual-pivot-cross-table__header-expand) {
  width: 100%;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.virtual-pivot-cross-table__cell-expand) {
  width: 100%;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.virtual-pivot-cross-table__header-expand-icon) {
  width: 14px;
  min-width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  color: #8b95a7;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  outline: none;
  font-size: 14px;
  line-height: 1;
  transform-origin: 50% 50%;
  transition: transform 0.16s ease, color 0.16s ease;
}

:deep(.virtual-pivot-cross-table__cell-expand-icon) {
  width: 14px;
  min-width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  color: #8b95a7;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  outline: none;
  font-size: 14px;
  line-height: 1;
  transform-origin: 50% 50%;
  transition: transform 0.16s ease, color 0.16s ease;
}

:deep(.virtual-pivot-cross-table__header-expand-glyph),
:deep(.virtual-pivot-cross-table__cell-expand-glyph) {
  width: 10px;
  height: 10px;
}

:deep(.virtual-pivot-cross-table__header-expand-icon--expanded),
:deep(.virtual-pivot-cross-table__cell-expand-icon--expanded) {
  transform: rotate(90deg);
}

:deep(.virtual-pivot-cross-table__header-expand-icon:hover),
:deep(.virtual-pivot-cross-table__cell-expand-icon:hover) {
  color: #5f6b7a;
}
</style>
