import { defineComponent, h, type PropType, type VNode, type VNodeChild } from "vue";
import type { VirtualTableColumn } from "../../types";
import type { CrossTreeTableRenderRow } from "./interfaces";

const HEADER_TEXT_CLASS = "virtual-pivot-cross-tree-table__header-text";
const CELL_TEXT_CLASS = "virtual-pivot-cross-tree-table__cell-text";
const PRIMARY_CELL_CLASS = "virtual-pivot-cross-tree-table__primary-cell";
const TOGGLE_CLASS = "virtual-pivot-cross-tree-table__toggle";
const TOGGLE_PLACEHOLDER_CLASS = "virtual-pivot-cross-tree-table__toggle-placeholder";

const wrapSpan = (className: string, content: VNodeChild): VNode => {
  return h("span", { class: className }, content ?? "");
};

export const buildCrossTreeTableDefaultHeaderVNode = (column: VirtualTableColumn): VNode => {
  const pivotMeta = column.meta?.pivot;
  return wrapSpan(HEADER_TEXT_CLASS, pivotMeta?.title ?? column.title ?? "");
};

export const buildCrossTreeTableDefaultCellVNode = (
  options: {
    row: CrossTreeTableRenderRow;
    column: VirtualTableColumn;
    indentSize: number;
    toggleRow?: (row: CrossTreeTableRenderRow) => void;
    render?: (
      value: any,
      leftNode: any,
      topNode: any,
      leftDepth: number,
      topDepth: number,
    ) => VNodeChild;
  },
): VNode => {
  const pivotMeta = options.column.meta?.pivot;

  if (pivotMeta?.region === "tree-primary") {
    const indent = Math.max(0, Number(options.row.__pivotTreeDepth) || 0) * Math.max(0, Number(options.indentSize) || 0);
    const canToggle = options.row.__pivotTreeHasChildren && !options.row.__pivotTreeLeaf;
    const toggleNode = canToggle
      ? h(
        "button",
        {
          type: "button",
          class: TOGGLE_CLASS,
          onClick: (event: MouseEvent) => {
            event.stopPropagation();
            options.toggleRow?.(options.row);
          },
        },
        options.row.__pivotTreeExpanded ? "▾" : "▸",
      )
      : h("span", { class: TOGGLE_PLACEHOLDER_CLASS }, "");

    const label = pivotMeta.primaryColumn?.render?.(options.row.__pivotTreeNode, options.row.__pivotTreeDepth)
      ?? options.row.__pivotTreeNode.title
      ?? options.row.__pivotTreeNode.value
      ?? "";

    return h(
      "div",
      {
        class: PRIMARY_CELL_CLASS,
        style: {
          paddingLeft: `${indent}px`,
        },
      },
      [
        toggleNode,
        wrapSpan(CELL_TEXT_CLASS, label),
      ],
    );
  }

  if (pivotMeta?.region === "tree-data" && pivotMeta.topNode) {
    const value = options.row[options.column.dataIndex || options.column.key];
    const leftDepth = Math.max(0, options.row.__pivotTreePathNodes.length - 1);
    const rendered = options.render?.(
      value,
      options.row.__pivotTreeNode,
      pivotMeta.topNode,
      leftDepth,
      pivotMeta.topDepth || 0,
    );
    return wrapSpan(CELL_TEXT_CLASS, rendered ?? value ?? "");
  }

  return wrapSpan(CELL_TEXT_CLASS, options.row[options.column.dataIndex || options.column.key] ?? "");
};

export const DefaultCrossTreeTableHeaderCell = defineComponent({
  name: "DefaultCrossTreeTableHeaderCell",
  props: {
    column: {
      type: Object as PropType<VirtualTableColumn>,
      required: true,
    },
  },
  setup(props) {
    return () => buildCrossTreeTableDefaultHeaderVNode(props.column);
  },
});

export const DefaultCrossTreeTableBodyCell = defineComponent({
  name: "DefaultCrossTreeTableBodyCell",
  props: {
    row: {
      type: Object as PropType<CrossTreeTableRenderRow>,
      required: true,
    },
    column: {
      type: Object as PropType<VirtualTableColumn>,
      required: true,
    },
    indentSize: {
      type: Number,
      default: 16,
    },
    onToggle: {
      type: Function as PropType<(row: CrossTreeTableRenderRow) => void>,
      default: undefined,
    },
    render: {
      type: Function as PropType<(
        value: any,
        leftNode: any,
        topNode: any,
        leftDepth: number,
        topDepth: number,
      ) => VNodeChild>,
      default: undefined,
    },
  },
  setup(props) {
    return () => buildCrossTreeTableDefaultCellVNode({
        row: props.row,
        column: props.column,
        indentSize: props.indentSize,
        toggleRow: props.onToggle,
        render: props.render,
      });
    },
});
