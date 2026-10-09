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
    :get-cell-props="getVirtualCellProps"
    :row-class-name="rowClassName"
    @cell-click="handleCellClick"
    @cell-dblclick="$emit('cell-dblclick', $event)"
    @column-width-change="$emit('column-width-change', $event)"
  >
    <template #header-cell="slotProps">
      <slot
        name="header-cell"
        v-bind="slotProps"
      >
        <default-cross-tree-table-header-cell :column="slotProps.column" />
      </slot>
    </template>

    <template #cell="slotProps">
      <slot
        name="cell"
        v-bind="slotProps"
        :left-node="resolveLeftNode(slotProps.row)"
        :top-node="resolveTopNode(slotProps.column)"
        :left-depth="resolveLeftDepth(slotProps.row)"
        :top-depth="resolveTopDepth(slotProps.column)"
        :toggle-row="() => toggleRow(slotProps.row)"
      >
        <default-cross-tree-table-body-cell
          :row="slotProps.row"
          :column="slotProps.column"
          :indent-size="indentSize"
          :render="props.render"
          :on-toggle="toggleRow"
        />
      </slot>
    </template>
  </virtual-table>
</template>

<script setup lang="ts">
import { computed, type PropType, ref, watch } from "vue";
import VirtualTable from "../../VirtualTable.vue";
import type {
  VirtualTableBodyHeightMode,
  VirtualTableCellProps,
  VirtualTableColumn,
  VirtualTableVerticalAlign,
  VirtualVisibleColumnDescriptor,
} from "../../types";
import { ROW_KEY } from "../cross-table/constants";
import { getPivotColumnMeta } from "../cross-table/internals";
import {
  DefaultCrossTreeTableBodyCell,
  DefaultCrossTreeTableHeaderCell,
} from "./renderers";
import buildCrossTreeTable from "./buildCrossTreeTable";
import type {
  BuildCrossTreeTableOptions,
  CrossTreePrimaryColumn,
  CrossTreeTableRenderRow,
} from "./interfaces";
import type { LeftCrossTreeNode, TopCrossTreeNode } from "../cross-table/interfaces";
import type { PivotVirtualTableHandle } from "../model";

const props = defineProps({
  primaryColumn: {
    type: Object as PropType<CrossTreePrimaryColumn | undefined>,
    default: undefined,
  },
  leftTree: {
    type: Array as PropType<LeftCrossTreeNode[]>,
    default: () => [],
  },
  topTree: {
    type: Array as PropType<TopCrossTreeNode[]>,
    default: () => [],
  },
  defaultOpenKeys: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  openKeys: {
    type: Array as PropType<string[] | undefined>,
    default: undefined,
  },
  indentSize: {
    type: Number,
    default: 16,
  },
  defaultColumnWidth: {
    type: Number,
    default: 100,
  },
  getValue: {
    type: Function as PropType<BuildCrossTreeTableOptions["getValue"]>,
    default: undefined,
  },
  render: {
    type: Function as PropType<BuildCrossTreeTableOptions["render"]>,
    default: undefined,
  },
  getCellProps: {
    type: Function as PropType<BuildCrossTreeTableOptions["getCellProps"]>,
    default: undefined,
  },
  isLeafNode: {
    type: Function as PropType<BuildCrossTreeTableOptions["isLeafNode"]>,
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
    type: [String, Function] as PropType<string | ((row: CrossTreeTableRenderRow, rowIndex: number) => string | undefined)>,
    default: "",
  },
});

const emit = defineEmits<{
  (event: "cell-click", payload: any): void;
  (event: "cell-dblclick", payload: any): void;
  (event: "column-width-change", payload: any): void;
  (event: "change-open-keys", payload: { nextOpenKeys: string[]; row: CrossTreeTableRenderRow }): void;
}>();

const tableRef = ref<PivotVirtualTableHandle | null>(null);
const uncontrolledOpenKeys = ref<string[]>([...props.defaultOpenKeys]);

watch(() => props.defaultOpenKeys, (value) => {
  if (props.openKeys == null) {
    uncontrolledOpenKeys.value = [...value];
  }
});

const resolvedOpenKeys = computed(() => {
  return props.openKeys ?? uncontrolledOpenKeys.value;
});

const built = computed(() => {
  return buildCrossTreeTable({
    primaryColumn: props.primaryColumn,
    leftTree: props.leftTree,
    topTree: props.topTree,
    openKeys: resolvedOpenKeys.value,
    onChangeOpenKeys: updateOpenKeys,
    indentSize: props.indentSize,
    isLeafNode: props.isLeafNode,
    defaultColumnWidth: props.defaultColumnWidth,
    getValue: props.getValue,
    render: props.render,
    getCellProps: props.getCellProps,
  });
});

const resolveLeftNode = (row: CrossTreeTableRenderRow) => {
  return row.__pivotTreeNode;
};

const resolveTopNode = (column: VirtualTableColumn) => {
  return getPivotColumnMeta(column)?.topNode;
};

const resolveLeftDepth = (row: CrossTreeTableRenderRow) => {
  return row.__pivotTreeDepth ?? -1;
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

  const pivotRow = row as CrossTreeTableRenderRow;
  const pivotMeta = descriptor.column.meta?.pivot;
  if (pivotMeta?.region === "tree-primary") {
    return pivotMeta.primaryColumn?.getCellProps?.(
      pivotRow.__pivotTreeNode,
      pivotRow.__pivotTreeDepth,
    );
  }

  if (pivotMeta?.region === "tree-data" && props.getCellProps && pivotMeta.topNode) {
    const value = pivotRow[descriptor.column.dataIndex || descriptor.column.key];
    return props.getCellProps(
      value,
      pivotRow.__pivotTreeNode,
      pivotMeta.topNode,
      pivotRow.__pivotTreeDepth,
      pivotMeta.topDepth || 0,
    );
  }

  return undefined;
};

const updateOpenKeys = (nextOpenKeys: string[], row?: CrossTreeTableRenderRow) => {
  if (props.openKeys == null) {
    uncontrolledOpenKeys.value = nextOpenKeys;
  }
  if (row) {
    emit("change-open-keys", {
      nextOpenKeys,
      row,
    });
  }
};

const toggleRow = (row: CrossTreeTableRenderRow) => {
  if (!row.__pivotTreeNextOpenKeys) {
    return;
  }
  updateOpenKeys(row.__pivotTreeNextOpenKeys, row);
};

const handleCellClick = (payload: { row: CrossTreeTableRenderRow; column: VirtualTableColumn }) => {
  if (payload.column.key === "__pivot-tree-primary" && payload.row.__pivotTreeNextOpenKeys) {
    toggleRow(payload.row);
    return;
  }
  emit("cell-click", payload);
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
.virtual-pivot-cross-tree-table__header-text,
.virtual-pivot-cross-tree-table__cell-text {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  width: 100%;
}

.virtual-pivot-cross-tree-table__primary-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.virtual-pivot-cross-tree-table__toggle,
.virtual-pivot-cross-tree-table__toggle-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  min-width: 18px;
  height: 18px;
}

.virtual-pivot-cross-tree-table__toggle {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #606266;
  padding: 0;
}
</style>
