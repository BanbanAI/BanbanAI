import { CaretRight } from "@element-plus/icons-vue";
import { defineComponent, h, type PropType, type VNode, type VNodeChild } from "vue";
import type { VirtualTableColumn } from "../../types";
import type { CrossTableRenderRow } from "./internals";
import { getPivotColumnMeta, getPivotLeftCell } from "./internals";

const CELL_TEXT_CLASS = "virtual-pivot-cross-table__cell-text";
const CELL_EXPAND_CLASS = "virtual-pivot-cross-table__cell-expand";
const CELL_EXPAND_ICON_CLASS = "virtual-pivot-cross-table__cell-expand-icon";
const CELL_EXPAND_GLYPH_CLASS = "virtual-pivot-cross-table__cell-expand-glyph";
const HEADER_TEXT_CLASS = "virtual-pivot-cross-table__header-text";
const HEADER_EXPAND_CLASS = "virtual-pivot-cross-table__header-expand";
const HEADER_EXPAND_ICON_CLASS = "virtual-pivot-cross-table__header-expand-icon";
const HEADER_EXPAND_GLYPH_CLASS = "virtual-pivot-cross-table__header-expand-glyph";

const wrapTextVNode = (className: string, content: VNodeChild): VNode => {
  return h("span", { class: className }, content ?? "");
};

export const buildCrossTableDefaultHeaderVNode = (
  column: VirtualTableColumn,
): VNode => {
  const pivotMeta = getPivotColumnMeta(column);
  if (pivotMeta?.expandable) {
    return h("div", { class: HEADER_EXPAND_CLASS }, [
      h(
        "button",
        {
          type: "button",
          class: [
            HEADER_EXPAND_ICON_CLASS,
            pivotMeta.expanded ? `${HEADER_EXPAND_ICON_CLASS}--expanded` : "",
          ],
          "aria-label": pivotMeta.expanded ? "collapse" : "expand",
          onClick: (event?: MouseEvent) => {
            event?.stopPropagation?.();
            pivotMeta.triggerExpand?.();
          },
        },
        [
          h(CaretRight, {
            class: HEADER_EXPAND_GLYPH_CLASS,
          }),
        ],
      ),
      wrapTextVNode(HEADER_TEXT_CLASS, pivotMeta?.title ?? column.title ?? ""),
    ]);
  }
  return wrapTextVNode(HEADER_TEXT_CLASS, pivotMeta?.title ?? column.title ?? "");
};

export const buildCrossTableDefaultCellVNode = (
  options: {
    row: Record<string, any>;
    column: VirtualTableColumn;
    render?: (
      value: any,
      leftNode: any,
      topNode: any,
      leftDepth: number,
      topDepth: number,
    ) => VNodeChild;
  },
): VNode => {
  const pivotRow = options.row as CrossTableRenderRow;
  const pivotMeta = getPivotColumnMeta(options.column);

  if (pivotMeta?.region === "left") {
    const leftDepth = pivotMeta.leftDepth || 0;
    const leftCell = getPivotLeftCell(pivotRow, leftDepth);
    const leftNode = leftCell?.node || pivotRow.__pivotLeafNode;
    if (!leftNode) {
      return wrapTextVNode(CELL_TEXT_CLASS, "");
    }

    const rendered = pivotMeta.leftMetaColumn?.render?.(leftNode, leftDepth);
    const leftPivotMeta = leftNode.meta?.pivot;
    const label = rendered ?? leftNode.title ?? leftNode.value ?? "";
    if (leftPivotMeta?.expandable && typeof leftPivotMeta.triggerExpand === "function") {
      return h("div", { class: CELL_EXPAND_CLASS }, [
        h(
          "button",
          {
            type: "button",
            class: [
              CELL_EXPAND_ICON_CLASS,
              leftPivotMeta.expanded ? `${CELL_EXPAND_ICON_CLASS}--expanded` : "",
            ],
            "aria-label": leftPivotMeta.expanded ? "collapse" : "expand",
            onClick: (event?: MouseEvent) => {
              event?.stopPropagation?.();
              leftPivotMeta.triggerExpand?.();
            },
          },
          [
            h(CaretRight, {
              class: CELL_EXPAND_GLYPH_CLASS,
            }),
          ],
        ),
        wrapTextVNode(CELL_TEXT_CLASS, label),
      ]);
    }
    return wrapTextVNode(CELL_TEXT_CLASS, label);
  }

  if (pivotMeta?.region === "data" && pivotMeta.topNode && pivotRow.__pivotLeafNode) {
    const value = pivotRow[options.column.dataIndex || options.column.key];
    const leftDepth = Math.max(0, pivotRow.__pivotLeftNodes.length - 1);
    const rendered = options.render?.(
      value,
      pivotRow.__pivotLeafNode,
      pivotMeta.topNode,
      leftDepth,
      pivotMeta.topDepth || 0,
    );
    return wrapTextVNode(CELL_TEXT_CLASS, rendered ?? value ?? "");
  }

  return wrapTextVNode(
    CELL_TEXT_CLASS,
    pivotRow[options.column.dataIndex || options.column.key] ?? "",
  );
};

export const DefaultCrossTableHeaderCell = defineComponent({
  name: "DefaultCrossTableHeaderCell",
  props: {
    column: {
      type: Object as PropType<VirtualTableColumn>,
      required: true,
    },
  },
  setup(props) {
    return () => buildCrossTableDefaultHeaderVNode(props.column);
  },
});

export const DefaultCrossTableBodyCell = defineComponent({
  name: "DefaultCrossTableBodyCell",
  props: {
    row: {
      type: Object as PropType<Record<string, any>>,
      required: true,
    },
    column: {
      type: Object as PropType<VirtualTableColumn>,
      required: true,
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
    return () => buildCrossTableDefaultCellVNode({
      row: props.row,
      column: props.column,
      render: props.render,
    });
  },
});
