<template>
  <div
    ref="rowRef"
    class="virtual-table__row"
    :class="rowClassValue"
    :style="rowStyle"
    :data-row-index="rowIndex"
    :data-row-key="String(rowKey)"
    @mouseenter="handleRowMouseEnter"
  >
    <div
      v-for="descriptor in descriptors"
      :key="descriptor.key"
      :ref="(element) => setCellTemplateRef(descriptor.key, element)"
      class="virtual-table__cell"
      :class="[
        descriptor.type === 'normal' ? descriptor.column.className : getBlankCellClass(descriptor),
        getExtraCellClassName(descriptor),
        descriptor.type === 'normal' && descriptor.column.fixed ? `is-fixed-${descriptor.column.fixed}` : '',
        isHiddenSpanCell(descriptor) ? 'is-span-placeholder' : '',
        isMergedRootCell(descriptor) ? 'is-span-anchor' : '',
        isEditingCell(descriptor) ? 'is-cell-editing' : '',
      ]"
      :style="getFlowCellStyle(descriptor)"
      @click="handleCellClick(descriptor, $event)"
      @dblclick="handleCellDblClick(descriptor, $event)"
    >
      <template v-if="descriptor.type === 'normal' && isEditingInlineCell(descriptor)">
        <component
          :is="getEditorState(descriptor)?.definition.component"
          :ref="(element) => setInlineEditorRef(descriptor.key, element)"
          v-bind="getInlineEditorProps(descriptor)"
          @click.stop
          @update:modelValue="handleEditorDraft(descriptor, $event)"
          @commit="handleEditorCommit(descriptor, $event)"
          @cancel="handleEditorCancel(descriptor, $event)"
        />
      </template>
      <template
        v-else-if="isNormalDescriptor(descriptor) && isMergedRootCell(descriptor) && !isEditingPopupCell(descriptor)"
      >
        <div class="virtual-table__cell-overlay" :style="getMergedOverlayStyle(descriptor)">
          <slot
            name="cell"
            v-bind="getBodyCellSlotProps(descriptor)!"
          >
            <span class="virtual-table__cell-text">{{ resolveDescriptorValue(descriptor) }}</span>
          </slot>
        </div>
      </template>
      <template
        v-else-if="descriptor.type === 'normal' && !isHiddenSpanCell(descriptor) && !isEditingPopupCell(descriptor)"
      >
        <slot
          name="cell"
          v-bind="getBodyCellSlotProps(descriptor)!"
        >
          <span class="virtual-table__cell-text">{{ resolveDescriptorValue(descriptor) }}</span>
        </slot>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, type ComponentPublicInstance, type CSSProperties, PropType, ref } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { VirtualTableEditorRegistry } from "./editing/editor-registry";
import { buildVirtualTableRowEditorStateMap } from "./editing/row-editor-state";
import { buildVirtualTableEditorProps } from "./editing/runtime";
import { VirtualTableEditSession, VirtualTableResolvedEditor } from "./editing/types";
import { buildVirtualTableBodyCellSlotProps } from "./slot-contract";
import {
  VirtualTableCellProps,
  VirtualPlannedCellSpan,
  VirtualTableBodyCellSlotProps,
  VirtualTableCellSpan,
  VirtualTableColumn,
  VirtualTableVerticalAlign,
  VirtualVisibleColumnDescriptor,
} from "./types";
import { createVirtualRowSpanAccessor } from "./row-span-cache";
import { resolveMeasuredVirtualRowHeight } from "./row-measurement";
import {
  decorateVirtualFlowCellStyle,
  resolveVirtualCellInteractionPlan,
  resolveVirtualMergedOverlayGeometry,
  resolveVirtualMergedOverlayStyle,
  resolveVirtualRowFlowStyle,
} from "./row-style-utils";

type VirtualTableEditTrigger = "click" | "dblclick" | "manual";

type VirtualTableResolvedRowEditor = {
  cell: {
    rowKey: string | number;
    columnKey: string;
  };
  definition: any;
  resolvedEditor: VirtualTableResolvedEditor;
  isEditing: boolean;
};

const props = defineProps({
  row: {
    type: Object as PropType<Record<string, any>>,
    required: true,
  },
  rowIndex: {
    type: Number,
    required: true,
  },
  rowKey: {
    type: [String, Number] as PropType<string | number>,
    required: true,
  },
  descriptors: {
    type: Array as PropType<VirtualVisibleColumnDescriptor[]>,
    required: true,
  },
  top: {
    type: Number,
    required: true,
  },
  totalWidth: {
    type: Number,
    required: true,
  },
  rowHeight: {
    type: Number,
    required: true,
  },
  minRowHeight: {
    type: Number,
    required: true,
  },
  cellVerticalAlign: {
    type: String as PropType<VirtualTableVerticalAlign>,
    default: "middle",
  },
  getCellStyle: {
    type: Function as PropType<(descriptor: VirtualVisibleColumnDescriptor) => Record<string, string | number>>,
    required: true,
  },
  getCellProps: {
    type: Function as PropType<(
      descriptor: VirtualVisibleColumnDescriptor,
      row: Record<string, any>,
      rowIndex: number,
    ) => VirtualTableCellProps | undefined>,
    default: undefined,
  },
  getPlannedCellSpan: {
    type: Function as PropType<(descriptor: VirtualVisibleColumnDescriptor) => VirtualPlannedCellSpan>,
    default: undefined,
  },
  resolveCellSpan: {
    type: Function as PropType<(row: Record<string, any>, rowIndex: number, column: VirtualTableColumn, columnIndex: number) => VirtualTableCellSpan>,
    required: true,
  },
  getSpanHeight: {
    type: Function as PropType<(rowIndex: number, rowSpan: number) => number>,
    required: true,
  },
  getSpanWidth: {
    type: Function as PropType<(columnIndex: number, colSpan: number) => number>,
    required: true,
  },
  rowClassName: {
    type: [String, Function] as PropType<string | ((row: Record<string, any>, rowIndex: number) => string | undefined)>,
    default: "",
  },
  hovered: {
    type: Boolean,
    default: false,
  },
  editable: {
    type: Boolean,
    default: false,
  },
  editTrigger: {
    type: String as PropType<VirtualTableEditTrigger>,
    default: "manual",
  },
  editingSession: {
    type: Object as PropType<VirtualTableEditSession>,
    default: undefined,
  },
  editorRegistry: {
    type: Object as PropType<VirtualTableEditorRegistry | undefined>,
    default: undefined,
  },
  resolveCellEditor: {
    type: Function as PropType<(
      row: Record<string, any>,
      column: VirtualTableColumn,
      rowIndex: number,
      columnIndex: number,
    ) => VirtualTableResolvedEditor | undefined>,
    default: undefined,
  },
});

defineSlots<{
  cell?: (props: VirtualTableBodyCellSlotProps) => any;
}>();

const emit = defineEmits<{
  (event: "measure", payload: { rowKey: string | number; rowIndex: number; height: number }): void;
  (event: "row-mouseenter", payload: { rowIndex: number; rowKey: string | number }): void;
  (event: "cell-click", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; event: MouseEvent }): void;
  (event: "cell-dblclick", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; event: MouseEvent }): void;
  (event: "cell-edit-start", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; columnIndex: number; cell: { rowKey: string | number; columnKey: string }; resolvedEditor: VirtualTableResolvedEditor; anchorEl?: HTMLElement | null }): void;
  (event: "cell-edit-draft", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; columnIndex: number; nextValue: any }): void;
  (event: "cell-edit-commit", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; columnIndex: number; nextValue: any; reason?: string }): void;
  (event: "cell-edit-cancel", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; columnIndex: number; reason?: string }): void;
}>();

const rowRef = ref<HTMLElement | null>(null);
const cellRefMap = new Map<string, HTMLElement>();
const inlineEditorRefMap = new Map<string, ComponentPublicInstance | null>();
let isUnmounted = false;
let rowMeasureFrame: number | null = null;

const rowClassValue = computed(() => {
  const resolvedRowClassName = typeof props.rowClassName === "function"
    ? props.rowClassName(props.row, props.rowIndex)
    : props.rowClassName;
  if (typeof props.rowClassName === "function") {
    return [
      resolvedRowClassName,
      props.hovered ? "is-row-hovered" : "",
    ];
  }
  return [
    resolvedRowClassName,
    props.hovered ? "is-row-hovered" : "",
  ];
});

const rowStyle = computed(() => {
  const nextMinHeight = Math.max(
    Math.ceil(Number(props.minRowHeight) || 0),
    Math.ceil(Number(props.rowHeight) || 0),
  );
  return {
    width: `${props.totalWidth}px`,
    minHeight: `${nextMinHeight}px`,
    top: `${props.top}px`,
    ...resolveVirtualRowFlowStyle({
      hasMergedRootCell: hasMergedRootCell.value,
    }),
  };
});

const cellAlignItems = computed(() => {
  if (props.cellVerticalAlign === "top") {
    return "flex-start";
  }
  if (props.cellVerticalAlign === "bottom") {
    return "flex-end";
  }
  return "center";
});

const resolveCellValue = (column: VirtualTableColumn) => {
  const dataIndex = column.dataIndex || column.key;
  return props.row?.[dataIndex];
};

const isNormalDescriptor = (
  descriptor: VirtualVisibleColumnDescriptor,
): descriptor is Extract<VirtualVisibleColumnDescriptor, { type: "normal" }> => {
  return descriptor.type === "normal";
};

const getBlankCellClass = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (descriptor.type === "blank" && descriptor.blankKind === "filler") {
    return "is-filler";
  }
  return descriptor.type === "normal" ? "" : "is-blank";
};

const resolveDescriptorValue = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (!isNormalDescriptor(descriptor)) {
    return undefined;
  }
  return resolveCellValue(descriptor.column);
};

const setCellRef = (key: string, element: HTMLElement | null) => {
  if (!element) {
    cellRefMap.delete(key);
    return;
  }
  cellRefMap.set(key, element);
};

const setCellTemplateRef = (
  key: string,
  element: Element | ComponentPublicInstance | null,
) => {
  setCellRef(key, (element as HTMLElement | null) ?? null);
};

const setInlineEditorRef = (
  key: string,
  element: Element | ComponentPublicInstance | null,
) => {
  inlineEditorRefMap.set(key, (element as ComponentPublicInstance | null) ?? null);
};

const editorStateMap = computed(() => {
  if (!props.editable) {
    return new Map<string, VirtualTableResolvedRowEditor>();
  }
  return buildVirtualTableRowEditorStateMap({
    row: props.row,
    rowIndex: props.rowIndex,
    rowKey: props.rowKey,
    descriptors: props.descriptors,
    editingSession: props.editingSession,
    editorRegistry: props.editorRegistry,
    resolveCellEditor: props.resolveCellEditor,
  }) as Map<string, VirtualTableResolvedRowEditor>;
});

const getEditorState = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (descriptor.type !== "normal") {
    return undefined;
  }
  return editorStateMap.value.get(descriptor.key);
};

const requestInlineEditorCommit = (
  descriptor: VirtualVisibleColumnDescriptor,
  reason = "outside-click",
) => {
  const editorRef = inlineEditorRefMap.get(descriptor.key) as
    | { requestCommit?: (reason?: string) => void }
    | undefined
    | null;
  editorRef?.requestCommit?.(reason);
};

const getCellElement = (descriptorKey: string) => {
  return cellRefMap.get(descriptorKey) || null;
};

const isEditableCell = (descriptor: VirtualVisibleColumnDescriptor) => {
  return Boolean(getEditorState(descriptor));
};

const isEditingCell = (descriptor: VirtualVisibleColumnDescriptor) => {
  return Boolean(getEditorState(descriptor)?.isEditing);
};

const isEditingInlineCell = (descriptor: VirtualVisibleColumnDescriptor) => {
  const editorState = getEditorState(descriptor);
  return Boolean(editorState?.isEditing && editorState.definition.mode === "inline");
};

const isEditingPopupCell = (descriptor: VirtualVisibleColumnDescriptor) => {
  const editorState = getEditorState(descriptor);
  return Boolean(editorState?.isEditing && editorState.definition.mode === "popup");
};

const startEdit = (descriptor: VirtualVisibleColumnDescriptor) => {
  const editorState = getEditorState(descriptor);
  if (!editorState || descriptor.type !== "normal") {
    return;
  }
  emit("cell-edit-start", {
    row: props.row,
    column: descriptor.column,
    rowIndex: props.rowIndex,
    columnIndex: descriptor.columnIndex,
    cell: editorState.cell,
    resolvedEditor: editorState.resolvedEditor,
    anchorEl: cellRefMap.get(descriptor.key) || null,
  });
};

const getBodyCellSlotProps = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (descriptor.type !== "normal") {
    return null;
  }
  return buildVirtualTableBodyCellSlotProps({
    descriptor,
    row: props.row,
    rowIndex: props.rowIndex,
    value: resolveCellValue(descriptor.column),
    editable: isEditableCell(descriptor),
    isEditing: isEditingCell(descriptor),
    startEdit: () => startEdit(descriptor),
  });
};

const handleRowMouseEnter = () => {
  emit("row-mouseenter", {
    rowIndex: props.rowIndex,
    rowKey: props.rowKey,
  });
};

const getInlineEditorProps = (descriptor: VirtualVisibleColumnDescriptor) => {
  const editorState = getEditorState(descriptor);
  if (descriptor.type !== "normal" || !editorState || !props.editingSession) {
    return {};
  }
  return buildVirtualTableEditorProps({
    row: props.row,
    column: descriptor.column,
    rowIndex: props.rowIndex,
    session: props.editingSession,
    resolvedEditor: editorState.resolvedEditor,
  });
};

const normalizeEditorEventValue = (payload: any) => {
  if (payload && typeof payload === "object" && "value" in payload) {
    return payload.value;
  }
  return payload;
};

const normalizeEditorEventReason = (payload: any) => {
  if (payload && typeof payload === "object" && typeof payload.reason === "string") {
    return payload.reason;
  }
  return undefined;
};

const handleEditorDraft = (descriptor: VirtualVisibleColumnDescriptor, nextValue: any) => {
  if (descriptor.type !== "normal") {
    return;
  }
  emit("cell-edit-draft", {
    row: props.row,
    column: descriptor.column,
    rowIndex: props.rowIndex,
    columnIndex: descriptor.columnIndex,
    nextValue,
  });
};

const handleEditorCommit = (descriptor: VirtualVisibleColumnDescriptor, payload?: any) => {
  if (descriptor.type !== "normal") {
    return;
  }
  emit("cell-edit-commit", {
    row: props.row,
    column: descriptor.column,
    rowIndex: props.rowIndex,
    columnIndex: descriptor.columnIndex,
    nextValue: payload === undefined ? props.editingSession?.draftValue : normalizeEditorEventValue(payload),
    reason: normalizeEditorEventReason(payload),
  });
};

const handleEditorCancel = (descriptor: VirtualVisibleColumnDescriptor, payload?: any) => {
  if (descriptor.type !== "normal") {
    return;
  }
  emit("cell-edit-cancel", {
    row: props.row,
    column: descriptor.column,
    rowIndex: props.rowIndex,
    columnIndex: descriptor.columnIndex,
    reason: normalizeEditorEventReason(payload),
  });
};

const spanAccessor = computed(() => {
  return createVirtualRowSpanAccessor({
    descriptors: props.descriptors,
    row: props.row,
    rowIndex: props.rowIndex,
    resolveCellSpan: props.resolveCellSpan,
  });
});

const getCellSpan = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (props.getPlannedCellSpan) {
    return props.getPlannedCellSpan(descriptor);
  }
  return {
    ...spanAccessor.value.getSpan(descriptor),
    hidden: false,
  } as VirtualPlannedCellSpan;
};

const isHiddenSpanCell = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (descriptor.type === "blank") {
    return false;
  }
  const span = getCellSpan(descriptor);
  return span.hidden || span.rowSpan === 0 || span.colSpan === 0;
};

const isMergedRootCell = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (descriptor.type === "blank") {
    return false;
  }
  const span = getCellSpan(descriptor);
  return span.rowSpan > 1 || span.colSpan > 1;
};

const hasMergedRootCell = computed(() => {
  return props.descriptors.some((descriptor) => isMergedRootCell(descriptor));
});

const isDescriptorHiddenForInteraction = (
  descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>,
) => {
  return isHiddenSpanCell(descriptor);
};

const getFlowCellStyle = (descriptor: VirtualVisibleColumnDescriptor) => {
  const extraCellProps = props.getCellProps?.(descriptor, props.row, props.rowIndex);
  return decorateVirtualFlowCellStyle({
    baseStyle: {
      ...props.getCellStyle(descriptor),
      ...(extraCellProps?.style || {}),
      alignItems: cellAlignItems.value,
      "--virtual-table-cell-vertical-align": props.cellVerticalAlign,
      "--virtual-table-cell-align-items": cellAlignItems.value,
    },
    descriptorType: descriptor.type,
    blankKind: descriptor.type === "blank" ? descriptor.blankKind : undefined,
    isHiddenSpanCell: isHiddenSpanCell(descriptor),
    isMergedRootCell: isMergedRootCell(descriptor),
  });
};

const getExtraCellClassName = (descriptor: VirtualVisibleColumnDescriptor) => {
  return props.getCellProps?.(descriptor, props.row, props.rowIndex)?.className || "";
};

const getMergedOverlayStyle = (descriptor: VirtualVisibleColumnDescriptor): CSSProperties => {
  if (descriptor.type === "blank") {
    return {};
  }
  const span = getCellSpan(descriptor);
  const geometry = resolveVirtualMergedOverlayGeometry({
    descriptor,
    plannedSpan: span,
    rowIndex: props.rowIndex,
    getSpanWidth: props.getSpanWidth,
    getSpanHeight: props.getSpanHeight,
  });
  if (!geometry) {
    return {};
  }
  const baseStyle = props.getCellStyle(descriptor);
  return resolveVirtualMergedOverlayStyle({
    baseStyle,
    width: geometry.width,
    height: geometry.height,
    alignItems: cellAlignItems.value,
    verticalAlign: props.cellVerticalAlign,
  });
};

const handleCellClick = (descriptor: VirtualVisibleColumnDescriptor, event: MouseEvent) => {
  const interactionPlan = resolveVirtualCellInteractionPlan({
    descriptors: props.descriptors,
    descriptorKey: descriptor.key,
    isHiddenSpanCell: descriptor.type === "normal" && isHiddenSpanCell(descriptor),
    isDescriptorHidden: isDescriptorHiddenForInteraction,
  });
  if (interactionPlan.type === "ignore") {
    return;
  }
  if (props.editingSession?.status && props.editingSession.status !== "idle") {
    return;
  }
  if (props.editTrigger === "click" && isEditableCell(interactionPlan.descriptor)) {
    startEdit(interactionPlan.descriptor);
    return;
  }
  emit("cell-click", {
    row: props.row,
    column: interactionPlan.descriptor.column,
    rowIndex: props.rowIndex,
    event,
  });
};

const handleCellDblClick = (descriptor: VirtualVisibleColumnDescriptor, event: MouseEvent) => {
  const interactionPlan = resolveVirtualCellInteractionPlan({
    descriptors: props.descriptors,
    descriptorKey: descriptor.key,
    isHiddenSpanCell: descriptor.type === "normal" && isHiddenSpanCell(descriptor),
    isDescriptorHidden: isDescriptorHiddenForInteraction,
  });
  if (interactionPlan.type === "ignore") {
    return;
  }
  if (props.editingSession?.status && props.editingSession.status !== "idle") {
    return;
  }
  if (props.editTrigger === "dblclick" && isEditableCell(interactionPlan.descriptor)) {
    startEdit(interactionPlan.descriptor);
    return;
  }
  emit("cell-dblclick", {
    row: props.row,
    column: interactionPlan.descriptor.column,
    rowIndex: props.rowIndex,
    event,
  });
};

const emitMeasuredRowHeight = (
  entry?: Parameters<typeof resolveMeasuredVirtualRowHeight>[0]["entry"],
) => {
  const nextHeight = resolveMeasuredVirtualRowHeight({
    entry,
    element: rowRef.value,
    minRowHeight: props.minRowHeight,
  });
  emit("measure", {
    rowKey: props.rowKey,
    rowIndex: props.rowIndex,
    height: nextHeight,
  });
};

const { stop: stopRowResizeObserver } = useResizeObserver(rowRef, (entries) => {
  emitMeasuredRowHeight(entries[0] as Parameters<typeof resolveMeasuredVirtualRowHeight>[0]["entry"]);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  if (rowMeasureFrame !== null) {
    window.cancelAnimationFrame(rowMeasureFrame);
    rowMeasureFrame = null;
  }
  stopRowResizeObserver();
  rowRef.value = null;
  cellRefMap.clear();
  inlineEditorRefMap.clear();
});

onMounted(() => {
  nextTick(() => {
    if (isUnmounted) return;
    rowMeasureFrame = requestAnimationFrame(() => {
      rowMeasureFrame = null;
      if (isUnmounted) return;
      emitMeasuredRowHeight();
    });
  });
});

defineExpose({
  getCellElement,
  measureRow: () => emitMeasuredRowHeight(),
  requestInlineEditorCommit,
});
</script>

<style scoped lang="scss">
.virtual-table__row {
  position: absolute;
  left: 0;
  display: flex;
  align-items: stretch;
  overflow: visible;
  --virtual-table-row-background: #fff;
  word-break: break-word;
}

.virtual-table__cell {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 12px;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  background: var(--virtual-table-row-background, #fff);
  overflow: hidden;

  &.is-fixed-left,
  &.is-fixed-right {
    background: var(--virtual-table-row-background, #fff);
  }

  &.is-fixed-right {
    border-left: var(--virtual-table-fixed-right-divider, 0 solid transparent);
    box-shadow: var(--virtual-table-fixed-right-shadow, none);
  }

  &.is-span-anchor {
    overflow: visible;
  }

  &.is-span-placeholder {
    pointer-events: none;
  }

  &.is-cell-editing {
    overflow: visible;
    z-index: 2;
  }

  &.is-blank {
    padding: 0;
    border-color: transparent;
    background: transparent;
  }

  &.is-filler {
    padding: 0;
  }
}

.virtual-table__cell-overlay {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 12px;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  background: var(--virtual-table-row-background, #fff);
  overflow: hidden;
}

.virtual-table__cell.is-fixed-right .virtual-table__cell-overlay {
  border-left: var(--virtual-table-fixed-right-divider, 0 solid transparent);
  box-shadow: var(--virtual-table-fixed-right-shadow, none);
}

.virtual-table__cell-text {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  white-space: normal;
  word-break: break-word;
}
</style>
