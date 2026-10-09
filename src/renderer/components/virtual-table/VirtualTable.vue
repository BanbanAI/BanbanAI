<template>
  <div
    class="virtual-table"
    :class="{
      'is-content-height': props.bodyHeightMode === 'content',
      'is-overlay-scrollbar-dragging': overlayScrollbarDraggingAxis,
    }"
    :style="containerStyle"
  >
    <div
      ref="scrollContainerRef"
      class="virtual-table__scroller"
      :class="{
        'has-left-fixed-overlap': fixedBoundaryState.leftHasOverlap,
        'has-right-fixed-overlap': fixedBoundaryState.rightHasOverlap,
        'is-horizontal-end': fixedBoundaryState.rightAtEnd,
      }"
      @scroll="handleScrollerScroll"
    >
      <div ref="innerRef" class="virtual-table__inner" :style="{ width: `${canvasWidth}px` }">
        <div ref="headerRef" class="virtual-table__header">
          <div
            v-for="(headerRow, rowIndex) in headerRows"
            :key="`header-${rowIndex}`"
            class="virtual-table__header-row"
            :data-row-index="rowIndex"
            :style="getHeaderRowStyle(rowIndex)"
          >
            <div
              v-for="cell in headerRow"
              :key="cell.key"
              class="virtual-table__header-cell"
              :class="[
                cell.type === 'normal' ? cell.column.headerClassName : getBlankCellClass(cell),
                cell.type === 'normal' && cell.column.fixed ? `is-fixed-${cell.column.fixed}` : '',
              ]"
              :data-row-index="rowIndex"
              :data-row-span="cell.type === 'normal' ? cell.rowSpan : 1"
              :style="getResolvedHeaderCellStyle(cell, rowIndex)"
            >
              <template v-if="cell.type === 'normal'">
                <slot
                  name="header-cell"
                  v-bind="buildVirtualTableHeaderCellSlotProps(cell)"
                >
                  <div class="virtual-table__header-content">
                    <span class="virtual-table__header-text">{{ cell.title }}</span>
                  </div>
                </slot>
              </template>
              <button
                v-if="cell.type === 'normal' && enableColumnResize && cell.isLeaf && cell.column.resizable !== false"
                type="button"
                class="virtual-table__column-resize-handle"
                @mousedown.stop.prevent="startColumnResize(cell, $event)"
              ></button>
            </div>
          </div>
        </div>

        <div
          v-if="visibleItems.length"
          class="virtual-table__body"
          :style="bodyStyle"
          @mouseleave="clearHoveredRowBoundary"
        >
          <div
            v-if="bodyFillerHeight > 0"
            class="virtual-table__body-filler"
            :style="bodyFillerStyle"
            aria-hidden="true"
          ></div>
          <virtual-table-row
            v-for="item in visibleItems"
            :key="item.key"
            :ref="(element) => setRowComponentRef(item.key, element)"
            :row="item.row"
            :row-index="item.index"
            :row-key="item.key"
            :descriptors="visibleColumnDescriptors"
            :top="item.top"
            :total-width="canvasWidth"
            :row-height="getRowHeight(item.index)"
            :min-row-height="resolvedMinRowHeight"
            :cell-vertical-align="props.cellVerticalAlign"
            :get-cell-style="getBodyCellStyle"
            :get-cell-props="props.getCellProps"
            :get-planned-cell-span="(descriptor) => getPlannedCellSpan(item.index, descriptor)"
            :resolve-cell-span="resolveCellSpan"
            :get-span-height="getSpanHeight"
            :get-span-width="getSpanWidth"
            :row-class-name="rowClassName"
            :hovered="isRowHovered(item.index)"
            :editable="editable"
            :edit-trigger="editTrigger"
            :editing-session="editingSession"
            :editor-registry="editorRegistry"
            :resolve-cell-editor="resolveCellEditor"
            @measure="handleRowMeasureEvent"
            @row-mouseenter="handleRowMouseEnter"
            @cell-click="handleCellClick"
            @cell-dblclick="handleCellDblClick"
            @cell-edit-start="handleCellEditStart"
            @cell-edit-draft="handleCellEditDraft"
            @cell-edit-commit="handleCellEditCommit"
            @cell-edit-cancel="handleCellEditCancel"
          >
            <template #cell="slotProps">
              <slot name="cell" v-bind="slotProps">
                <span class="virtual-table__cell-text">{{ slotProps.value }}</span>
              </slot>
            </template>
          </virtual-table-row>
        </div>

        <div v-else-if="!loading" class="virtual-table__empty">
          <slot name="empty">
            <span>{{ emptyText || $t('virtualTable.emptyText') }}</span>
          </slot>
        </div>

        <div
          v-if="showFooter"
          class="virtual-table__footer"
          :style="{ width: `${canvasWidth}px`, minHeight: `${footerHeight}px` }"
        >
          <div
            v-for="descriptor in visibleColumnDescriptors"
            :key="`footer-${descriptor.key}`"
            class="virtual-table__footer-cell"
            :class="[
              descriptor.type === 'normal' ? descriptor.column.className : getBlankCellClass(descriptor),
              descriptor.type === 'normal' && descriptor.column.fixed ? `is-fixed-${descriptor.column.fixed}` : '',
            ]"
            :style="getFooterCellStyle(descriptor)"
            >
              <template v-if="descriptor.type === 'normal'">
              <slot
                name="footer-cell"
                v-bind="buildVirtualTableFooterCellSlotProps({ descriptor })"
              >
                <span class="virtual-table__cell-text"></span>
              </slot>
            </template>
          </div>
        </div>

        <edit-host
          ref="editHostRef"
          :session="editingSession"
          :definition="activePopupEditorDefinition"
          :anchor="activePopupAnchor"
          :editor-props="activePopupEditorProps"
          @draft-change="handlePopupDraftChange"
          @commit="handlePopupCommit"
          @cancel="handlePopupCancel"
          @outside-click="handlePopupOutsideClick"
        />
      </div>
    </div>

    <div
      v-if="hasHorizontalOverlayScrollbar"
      ref="horizontalOverlayScrollbarRef"
      class="virtual-table__overlay-scrollbar virtual-table__overlay-scrollbar--horizontal"
      :class="{ 'has-vertical-peer': hasVerticalOverlayScrollbar }"
      @mousedown="handleOverlayScrollbarTrackMouseDown('horizontal', $event)"
    >
      <div
        class="virtual-table__overlay-scrollbar-thumb"
        :style="horizontalOverlayScrollbarThumbStyle"
        @mousedown.stop.prevent="startOverlayScrollbarDrag('horizontal', $event)"
      ></div>
    </div>

    <div
      v-if="hasVerticalOverlayScrollbar"
      ref="verticalOverlayScrollbarRef"
      class="virtual-table__overlay-scrollbar virtual-table__overlay-scrollbar--vertical"
      :class="{ 'has-horizontal-peer': hasHorizontalOverlayScrollbar }"
      @mousedown="handleOverlayScrollbarTrackMouseDown('vertical', $event)"
    >
      <div
        class="virtual-table__overlay-scrollbar-thumb"
        :style="verticalOverlayScrollbarThumbStyle"
        @mousedown.stop.prevent="startOverlayScrollbarDrag('vertical', $event)"
      ></div>
    </div>

    <div v-if="loading" class="virtual-table__loading">
      <slot name="loading">
        <svg class="virtual-table__loading-spinner" viewBox="0 0 50 50" aria-hidden="true">
          <circle class="path" cx="25" cy="25" r="20" fill="none" />
        </svg>
        <span>{{ loadingText || $t('virtualTable.loadingText') }}</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, toRef, watch, type ComponentPublicInstance, type CSSProperties } from "vue";
import { useResizeObserver } from "@vueuse/core";
import EditHost from "./editing/EditHost.vue";
import VirtualTableRow from "./VirtualTableRow.vue";
import {
  createVirtualTableAutoHeightResizeController,
  DEFAULT_VIRTUAL_TABLE_AUTO_HEIGHT_RESIZE_SETTLE_MS,
} from "./auto-height-resize";
import { VirtualTableEditorRegistry } from "./editing/editor-registry";
import { normalizeVirtualTableEditorEventValue } from "./editing/payload";
import { resolveVirtualTablePopupAnchorAction } from "./editing/popup-anchor";
import { measureVisibleVirtualRows } from "./row-measurement";
import {
  buildVirtualTableEditorProps,
  createVirtualTableEditAnchor,
  resolveVirtualTableEditorValue,
  resolveVirtualTableOutsideClickAction,
} from "./editing/runtime";
import {
  VirtualTableCellId,
  VirtualTableEditAnchor,
  VirtualTableEditCommitResult,
  VirtualTableEditSession,
  VirtualTableResolvedEditor,
} from "./editing/types";
import {
  beginVirtualTableEdit,
  cancelVirtualTableEdit,
  completeVirtualTableEditCommit,
  createIdleVirtualTableEditSession,
  requestVirtualTableEditCommit,
  updateVirtualTableEditDraft,
} from "./features/editing";
import {
  resolveVirtualTableBodyFillerHeight,
  resolveVirtualTableBodyHeight,
  resolveVirtualTableContainerStyle,
  resolveVirtualTableMinRowHeight,
} from "./layout";
import {
  resolveVirtualViewportCoverageAction,
  resolveVirtualViewportCompensation,
} from "./viewport-coverage";
import {
  buildVirtualTableFooterCellSlotProps,
  buildVirtualTableHeaderCellSlotProps,
} from "./slot-contract";
import { useVirtualTable } from "./useVirtualTable";
import { buildVirtualSpanPlan } from "./virtual-span-plan";
import {
  VirtualTableCellProps,
  VirtualTableBodyCellSlotProps,
  VirtualTableBodyHeightMode,
  VirtualPlannedCellSpan,
  VirtualTableCellSpan,
  VirtualTableColumn,
  VirtualTableFooterCellSlotProps,
  VirtualTableRowSpanBoundary,
  VirtualTableHeaderCellSlotProps,
  VirtualTableVerticalAlign,
  VirtualVisibleColumnDescriptor,
  VirtualVisibleHeaderCell,
} from "./types";

type VirtualTableEditTrigger = "click" | "dblclick" | "manual";

type VirtualTableActiveEditorContext = {
  row: Record<string, any>;
  column: VirtualTableColumn;
  rowIndex: number;
  columnIndex: number;
  cell: VirtualTableCellId;
  resolvedEditor: VirtualTableResolvedEditor;
};

type VirtualTableOverlayScrollbarAxis = "horizontal" | "vertical";

type VirtualTableOverlayScrollbarState = {
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  devicePixelRatio: number;
};

type VirtualTableCellEditStartPayload = VirtualTableActiveEditorContext & {
  anchorEl?: HTMLElement | null;
};

const props = defineProps({
  columns: {
    type: Array as PropType<VirtualTableColumn[]>,
    required: true,
  },
  rows: {
    type: Array as PropType<Record<string, any>[]>,
    default: () => [],
  },
  rowKey: {
    type: [String, Function] as PropType<string | ((row: Record<string, any>, index: number) => string | number)>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  estimatedRowHeight: {
    type: Number,
    default: 44,
  },
  minRowHeight: {
    type: Number,
    default: 40,
  },
  cellVerticalAlign: {
    type: String as PropType<VirtualTableVerticalAlign>,
    default: "middle",
  },
  bodyHeightMode: {
    type: String as PropType<VirtualTableBodyHeightMode>,
    default: "fill",
  },
  overscan: {
    type: Number,
    default: 6,
  },
  headerHeight: {
    type: Number,
    default: 40,
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
  getCellSpan: {
    type: Function as PropType<(row: Record<string, any>, rowIndex: number, column: VirtualTableColumn, columnIndex: number) => Partial<VirtualTableCellSpan> | undefined>,
    default: undefined,
  },
  getRowSpanBoundary: {
    type: Function as PropType<(row: Record<string, any>, rowIndex: number) => VirtualTableRowSpanBoundary | undefined>,
    default: undefined,
  },
  getCellProps: {
    type: Function as PropType<(
      descriptor: VirtualVisibleColumnDescriptor,
      row: Record<string, any>,
      rowIndex: number,
    ) => VirtualTableCellProps | undefined>,
    default: undefined,
  },
  rowClassName: {
    type: [String, Function] as PropType<string | ((row: Record<string, any>, rowIndex: number) => string | undefined)>,
    default: "",
  },
  enableColumnResize: {
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
  commitCellEdit: {
    type: Function as PropType<(
      payload: {
        cell: VirtualTableCellId;
        row: Record<string, any>;
        column: VirtualTableColumn;
        rowIndex: number;
        columnIndex: number;
        previousValue: any;
        nextValue: any;
        reason?: string;
        resolvedEditor?: VirtualTableResolvedEditor;
      }
    ) => Promise<VirtualTableEditCommitResult<Record<string, any>>> | VirtualTableEditCommitResult<Record<string, any>>>,
    default: undefined,
  },
  shouldIgnoreEditOutsideClick: {
    type: Function as PropType<(event: MouseEvent) => boolean>,
    default: undefined,
  },
});

defineSlots<{
  "header-cell"?: (props: VirtualTableHeaderCellSlotProps) => any;
  cell?: (props: VirtualTableBodyCellSlotProps) => any;
  "footer-cell"?: (props: VirtualTableFooterCellSlotProps) => any;
  empty?: () => any;
  loading?: () => any;
}>();

const emit = defineEmits<{
  (event: "cell-click", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; event: MouseEvent }): void;
  (event: "cell-dblclick", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; event: MouseEvent }): void;
  (event: "column-width-change", payload: { column: VirtualTableColumn; width: number }): void;
  (event: "cell-edit-start", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; cell: VirtualTableCellId; resolvedEditor?: VirtualTableResolvedEditor }): void;
  (event: "cell-edit-commit", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; cell: VirtualTableCellId; previousValue: any; nextValue: any; reason?: string; result: VirtualTableEditCommitResult<Record<string, any>>; resolvedEditor?: VirtualTableResolvedEditor }): void;
  (event: "cell-edit-cancel", payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; cell: VirtualTableCellId; reason?: string; resolvedEditor?: VirtualTableResolvedEditor }): void;
}>();

const innerRef = ref<HTMLElement | null>(null);
const headerRef = ref<HTMLElement | null>(null);
const editHostRef = ref<{ requestCommit?: (reason?: string) => void } | null>(null);
const horizontalOverlayScrollbarRef = ref<HTMLElement | null>(null);
const verticalOverlayScrollbarRef = ref<HTMLElement | null>(null);
const editingSession = ref<VirtualTableEditSession>(createIdleVirtualTableEditSession());
const activeEditorContext = ref<VirtualTableActiveEditorContext | null>(null);
const activePopupAnchor = ref<VirtualTableEditAnchor | null>(null);
const activeEditorAnchorEl = ref<HTMLElement | null>(null);
const hoveredRowBoundary = ref<VirtualTableRowSpanBoundary | null>(null);
const headerRowHeights = ref<number[]>([]);
const measuredHeaderHeight = ref(0);
const overlayScrollbarDraggingAxis = ref<VirtualTableOverlayScrollbarAxis | null>(null);
const overlayScrollbarState = ref<VirtualTableOverlayScrollbarState>({
  clientWidth: 0,
  scrollWidth: 0,
  scrollLeft: 0,
  clientHeight: 0,
  scrollHeight: 0,
  scrollTop: 0,
  devicePixelRatio: 1,
});
type VirtualTableRowComponentRef = {
  getCellElement?: (descriptorKey: string) => HTMLElement | null;
  measureRow?: () => void;
  requestInlineEditorCommit?: (descriptor: VirtualVisibleColumnDescriptor, reason?: string) => void;
};
const rowComponentRefMap = new Map<string | number, VirtualTableRowComponentRef | null>();
let isUnmounted = false;
const pendingFrameIds = new Set<number>();
const scheduleFrame = (callback: () => void) => {
  const frameId = window.requestAnimationFrame(() => {
    pendingFrameIds.delete(frameId);
    if (isUnmounted) return;
    callback();
  });
  pendingFrameIds.add(frameId);
  return frameId;
};
const resolvedMinRowHeight = computed(() => {
  return resolveVirtualTableMinRowHeight({
    estimatedRowHeight: props.estimatedRowHeight,
    minRowHeight: props.minRowHeight,
  });
});

const {
  scrollContainerRef,
  leafColumns,
  visibleColumnDescriptors,
  virtualWindowBoundaryColumnIndexes,
  headerRows,
  fixedBoundaryState,
  totalWidth,
  canvasWidth,
  virtualWindow,
  visibleItems,
  scrollTop,
  viewportWidth,
  getHeaderCellStyle,
  getBodyCellStyle,
  getLeafColumnsForHeaderCell,
  rowViewportHeight,
  effectiveRowViewportHeight,
  handleScroll,
  updateMeasuredRowHeight,
  resolveCellSpan,
  resolveRowSpanBoundary,
  resolveVisibleSpanPlanBoundary,
  getSpanHeight,
  getSpanWidth,
  getRowHeight,
  getRowOffset,
  getTotalRowHeight,
  previewVirtualWindow,
  setViewportCompensation,
  setColumnWidthOverride,
  clearColumnWidthOverride,
} = useVirtualTable({
  columns: toRef(props, "columns"),
  rows: toRef(props, "rows"),
  rowKey: toRef(props, "rowKey"),
  estimatedRowHeight: toRef(props, "estimatedRowHeight"),
  overscan: toRef(props, "overscan"),
  headerHeight: toRef(props, "headerHeight"),
  headerHeightTotalOverride: computed(() => measuredHeaderHeight.value || undefined),
  showFooter: toRef(props, "showFooter"),
  footerHeight: toRef(props, "footerHeight"),
  getCellSpan: toRef(props, "getCellSpan"),
  getRowSpanBoundary: toRef(props, "getRowSpanBoundary"),
});

const rowClassName = computed(() => props.rowClassName);
const isAutoRowHeight = computed(() => resolvedMinRowHeight.value <= 0);
const isHorizontalVirtualizing = computed(() => {
  const normalDescriptorCount = visibleColumnDescriptors.value.filter((descriptor) => descriptor.type === "normal").length;
  return normalDescriptorCount < leafColumns.value.length || visibleColumnDescriptors.value.some((descriptor) => descriptor.type === "blank");
});
const containerStyle = computed(() => {
  return resolveVirtualTableContainerStyle({
    width: props.containerWidth,
    minWidth: props.containerMinWidth,
    maxWidth: props.containerMaxWidth,
    height: props.containerHeight,
    minHeight: props.containerMinHeight,
    maxHeight: props.containerMaxHeight,
  });
});
const bodyViewportHeight = computed(() => {
  return Math.max(0, Math.ceil(Number(rowViewportHeight.value) || 0));
});
const emptyGridRowHeight = computed(() => {
  const fallbackHeight = Math.ceil(Number(props.estimatedRowHeight) || 32);
  return Math.max(1, resolvedMinRowHeight.value > 0 ? resolvedMinRowHeight.value : fallbackHeight);
});
const bodyHeight = computed(() => {
  return resolveVirtualTableBodyHeight({
    totalHeight: virtualWindow.value.totalHeight,
    bodyViewportHeight: bodyViewportHeight.value,
    mode: props.bodyHeightMode,
  });
});
const bodyFillerHeight = computed(() => {
  return resolveVirtualTableBodyFillerHeight({
    totalHeight: virtualWindow.value.totalHeight,
    bodyViewportHeight: bodyViewportHeight.value,
    mode: props.bodyHeightMode,
  });
});
const bodyStyle = computed(() => {
  return {
    height: `${bodyHeight.value}px`,
    "--virtual-table-empty-row-height": `${emptyGridRowHeight.value}px`,
  };
});
const bodyFillerStyle = computed(() => {
  const totalHeight = Math.max(0, Math.ceil(Number(virtualWindow.value.totalHeight) || 0));
  return {
    top: `${totalHeight}px`,
    height: `${bodyFillerHeight.value}px`,
  };
});
const OVERLAY_SCROLLBAR_EDGE_PADDING = 2;
const OVERLAY_SCROLLBAR_SIZE = 8;
const OVERLAY_SCROLLBAR_MIN_THUMB_SIZE = 32;
let overlayScrollbarSyncFrame: number | null = null;
let stopOverlayScrollbarDrag: (() => void) | null = null;
let stopColumnResize: (() => void) | null = null;

const resolveOverlayScrollbarVisibilityEpsilon = () => {
  const devicePixelRatio = Number(overlayScrollbarState.value.devicePixelRatio) || 1;
  if (devicePixelRatio >= 1) {
    return 1;
  }
  // Low browser zoom can inflate synthetic overflow by a few CSS pixels due to
  // integer layout rounding across header/footer/body blocks.
  return Math.max(2, Math.min(4, Math.ceil(1 / devicePixelRatio)));
};

const hasHorizontalOverlayScrollbar = computed(() => {
  const state = overlayScrollbarState.value;
  return state.scrollWidth - state.clientWidth > resolveOverlayScrollbarVisibilityEpsilon();
});

const hasVerticalOverlayScrollbar = computed(() => {
  const state = overlayScrollbarState.value;
  return state.scrollHeight - state.clientHeight > resolveOverlayScrollbarVisibilityEpsilon();
});

const resolveOverlayScrollbarTrackSize = (axis: VirtualTableOverlayScrollbarAxis) => {
  const state = overlayScrollbarState.value;
  const peerSize = axis === "horizontal" && hasVerticalOverlayScrollbar.value
    ? OVERLAY_SCROLLBAR_SIZE
    : axis === "vertical" && hasHorizontalOverlayScrollbar.value
      ? OVERLAY_SCROLLBAR_SIZE
      : 0;
  const fallbackSize = axis === "horizontal" ? state.clientWidth : state.clientHeight;
  const trackElement = axis === "horizontal"
    ? horizontalOverlayScrollbarRef.value
    : verticalOverlayScrollbarRef.value;
  const measuredSize = trackElement
    ? (axis === "horizontal"
      ? trackElement.getBoundingClientRect().width
      : trackElement.getBoundingClientRect().height)
    : 0;
  return Math.max(0, Math.floor(measuredSize || fallbackSize - OVERLAY_SCROLLBAR_EDGE_PADDING * 2 - peerSize));
};

const resolveOverlayScrollbarThumbMetrics = (axis: VirtualTableOverlayScrollbarAxis) => {
  const state = overlayScrollbarState.value;
  const clientSize = axis === "horizontal" ? state.clientWidth : state.clientHeight;
  const scrollSize = axis === "horizontal" ? state.scrollWidth : state.scrollHeight;
  const scrollOffset = axis === "horizontal" ? state.scrollLeft : state.scrollTop;
  const trackSize = resolveOverlayScrollbarTrackSize(axis);
  const scrollRange = Math.max(0, scrollSize - clientSize);
  if (trackSize <= 0 || clientSize <= 0 || scrollSize <= clientSize || scrollRange <= 0) {
    return {
      size: 0,
      offset: 0,
      trackSize,
      scrollRange,
    };
  }

  const thumbSize = Math.min(
    trackSize,
    Math.max(OVERLAY_SCROLLBAR_MIN_THUMB_SIZE, Math.floor((clientSize / scrollSize) * trackSize)),
  );
  const thumbRange = Math.max(0, trackSize - thumbSize);
  return {
    size: thumbSize,
    offset: thumbRange > 0 ? Math.round((scrollOffset / scrollRange) * thumbRange) : 0,
    trackSize,
    scrollRange,
  };
};

const horizontalOverlayScrollbarThumbStyle = computed(() => {
  const metrics = resolveOverlayScrollbarThumbMetrics("horizontal");
  return {
    width: `${metrics.size}px`,
    transform: `translate3d(${metrics.offset}px, 0, 0)`,
  } satisfies CSSProperties;
});

const verticalOverlayScrollbarThumbStyle = computed(() => {
  const metrics = resolveOverlayScrollbarThumbMetrics("vertical");
  return {
    height: `${metrics.size}px`,
    transform: `translate3d(0, ${metrics.offset}px, 0)`,
  } satisfies CSSProperties;
});

const syncOverlayScrollbarState = (target?: HTMLElement | null) => {
  const scroller = target || scrollContainerRef.value;
  if (!scroller) {
    return;
  }
  const nextState: VirtualTableOverlayScrollbarState = {
    clientWidth: scroller.clientWidth,
    scrollWidth: scroller.scrollWidth,
    scrollLeft: scroller.scrollLeft,
    clientHeight: scroller.clientHeight,
    scrollHeight: scroller.scrollHeight,
    scrollTop: scroller.scrollTop,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
  const currentState = overlayScrollbarState.value;
  if (
    currentState.clientWidth === nextState.clientWidth
    && currentState.scrollWidth === nextState.scrollWidth
    && currentState.scrollLeft === nextState.scrollLeft
    && currentState.clientHeight === nextState.clientHeight
    && currentState.scrollHeight === nextState.scrollHeight
    && currentState.scrollTop === nextState.scrollTop
    && currentState.devicePixelRatio === nextState.devicePixelRatio
  ) {
    return;
  }
  overlayScrollbarState.value = nextState;
};

const scheduleOverlayScrollbarSync = () => {
  if (overlayScrollbarSyncFrame !== null) {
    return;
  }
  overlayScrollbarSyncFrame = scheduleFrame(() => {
    overlayScrollbarSyncFrame = null;
    syncOverlayScrollbarState();
  });
};

const handleScrollerScroll = (event: Event) => {
  handleScroll(event);
  syncOverlayScrollbarState(event.target as HTMLElement | null);
};

const scrollByOverlayScrollbarPointer = (
  axis: VirtualTableOverlayScrollbarAxis,
  trackElement: HTMLElement,
  pointerClientPosition: number,
) => {
  const scroller = scrollContainerRef.value;
  if (!scroller) {
    return;
  }
  const rect = trackElement.getBoundingClientRect();
  const metrics = resolveOverlayScrollbarThumbMetrics(axis);
  const trackStart = axis === "horizontal" ? rect.left : rect.top;
  const trackSize = axis === "horizontal" ? rect.width : rect.height;
  const thumbRange = Math.max(0, trackSize - metrics.size);
  if (metrics.scrollRange <= 0 || thumbRange <= 0) {
    return;
  }
  const targetThumbOffset = Math.max(
    0,
    Math.min(thumbRange, pointerClientPosition - trackStart - metrics.size / 2),
  );
  const targetScrollOffset = Math.round((targetThumbOffset / thumbRange) * metrics.scrollRange);
  if (axis === "horizontal") {
    scroller.scrollLeft = targetScrollOffset;
  } else {
    scroller.scrollTop = targetScrollOffset;
  }
  syncOverlayScrollbarState(scroller);
};

const handleOverlayScrollbarTrackMouseDown = (
  axis: VirtualTableOverlayScrollbarAxis,
  event: MouseEvent,
) => {
  const trackElement = event.currentTarget as HTMLElement | null;
  if (!trackElement) {
    return;
  }
  event.preventDefault();
  const pointerPosition = axis === "horizontal" ? event.clientX : event.clientY;
  scrollByOverlayScrollbarPointer(axis, trackElement, pointerPosition);
};

const startOverlayScrollbarDrag = (
  axis: VirtualTableOverlayScrollbarAxis,
  event: MouseEvent,
) => {
  const scroller = scrollContainerRef.value;
  const thumbElement = event.currentTarget as HTMLElement | null;
  const trackElement = thumbElement?.parentElement;
  if (!scroller || !trackElement) {
    return;
  }

  stopOverlayScrollbarDrag?.();
  stopColumnResize?.();
  stopColumnResize = null;
  overlayScrollbarDraggingAxis.value = axis;
  const startPointerPosition = axis === "horizontal" ? event.clientX : event.clientY;
  const startScrollOffset = axis === "horizontal" ? scroller.scrollLeft : scroller.scrollTop;
  const trackRect = trackElement.getBoundingClientRect();
  const trackSize = axis === "horizontal" ? trackRect.width : trackRect.height;
  const metrics = resolveOverlayScrollbarThumbMetrics(axis);
  const thumbRange = Math.max(0, trackSize - metrics.size);
  const scrollRange = metrics.scrollRange;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (thumbRange <= 0 || scrollRange <= 0) {
      return;
    }
    const pointerPosition = axis === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
    const delta = pointerPosition - startPointerPosition;
    const nextScrollOffset = Math.max(
      0,
      Math.min(scrollRange, startScrollOffset + (delta / thumbRange) * scrollRange),
    );
    if (axis === "horizontal") {
      scroller.scrollLeft = nextScrollOffset;
    } else {
      scroller.scrollTop = nextScrollOffset;
    }
    syncOverlayScrollbarState(scroller);
  };

  const handleMouseUp = () => {
    overlayScrollbarDraggingAxis.value = null;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "";
    stopOverlayScrollbarDrag = null;
  };

  stopOverlayScrollbarDrag = handleMouseUp;
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
};
const DEFAULT_HEADER_TOTAL_HEIGHT = 68;
const DEFAULT_HEADER_ROW_HEIGHT = 34;
const MAX_HEADER_ROW_HEIGHT = 68;

const resolveHeaderRowMinHeight = () => {
  return headerRows.value.length <= 1 ? DEFAULT_HEADER_TOTAL_HEIGHT : DEFAULT_HEADER_ROW_HEIGHT;
};

const clampHeaderRowHeight = (height: number) => {
  return Math.max(
    resolveHeaderRowMinHeight(),
    Math.min(MAX_HEADER_ROW_HEIGHT, Math.ceil(Number(height) || 0)),
  );
};

const hasMeasuredHeaderRowsForSpan = (rowIndex: number, rowSpan: number) => {
  const normalizedRowSpan = Math.max(1, Math.floor(Number(rowSpan) || 1));
  for (let index = rowIndex; index < rowIndex + normalizedRowSpan; index += 1) {
    if (!Number.isFinite(headerRowHeights.value[index]) || headerRowHeights.value[index] <= 0) {
      return false;
    }
  }
  return true;
};

const resolveHeaderRowHeight = (rowIndex: number) => {
  const measuredHeight = headerRowHeights.value[rowIndex];
  if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
    return measuredHeight;
  }
  return resolveHeaderRowMinHeight();
};

const resolveHeaderCellHeight = (rowIndex: number, rowSpan: number) => {
  const normalizedRowSpan = Math.max(1, Math.floor(Number(rowSpan) || 1));
  let height = 0;
  for (let index = rowIndex; index < rowIndex + normalizedRowSpan; index += 1) {
    height += resolveHeaderRowHeight(index);
  }
  return Math.max(DEFAULT_HEADER_ROW_HEIGHT, height);
};

const getResolvedHeaderCellStyle = (cell: VirtualVisibleHeaderCell, rowIndex: number) => {
  const rowSpan = cell.type === "normal" ? cell.rowSpan : 1;
  const baseStyle = {
    ...getHeaderCellStyle(cell),
  };

  if (!hasMeasuredHeaderRowsForSpan(rowIndex, rowSpan)) {
    const rowMinHeight = resolveHeaderRowMinHeight();
    if (rowSpan <= 1) {
      return {
        ...baseStyle,
        minHeight: `${rowMinHeight}px`,
      };
    }

    const fallbackHeight = rowMinHeight * rowSpan;
    return {
      ...baseStyle,
      minHeight: `${fallbackHeight}px`,
    };
  }

  const nextHeight = resolveHeaderCellHeight(rowIndex, rowSpan);
  return {
    ...baseStyle,
    height: `${nextHeight}px`,
    minHeight: `${nextHeight}px`,
  };
};

const getHeaderRowStyle = (rowIndex: number) => {
  return {
    height: `${resolveHeaderRowHeight(rowIndex)}px`,
    minHeight: `${resolveHeaderRowHeight(rowIndex)}px`,
  };
};

const syncMeasuredHeaderMetrics = () => {
  const headerEl = headerRef.value;
  if (!headerEl) {
    return;
  }

  const nextRowHeights = headerRows.value.map((_, rowIndex) => {
    const measuredCells = Array.from(
      headerEl.querySelectorAll(`.virtual-table__header-cell[data-row-index="${rowIndex}"][data-row-span="1"]`),
    )
      .filter((cell) => !cell.classList.contains("is-blank")) as HTMLElement[];
    const rowHeightFromCells = measuredCells.reduce((maxHeight, cell) => {
      return Math.max(maxHeight, Math.ceil(cell.getBoundingClientRect().height || 0));
    }, 0);
    return clampHeaderRowHeight(rowHeightFromCells || DEFAULT_HEADER_ROW_HEIGHT);
  });

  const currentRowHeights = headerRowHeights.value;
  const mergedRowHeights = nextRowHeights.map((nextHeight, index) => {
    const currentHeight = currentRowHeights[index];
    if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
      return nextHeight;
    }
    return Math.max(currentHeight, nextHeight);
  });
  if (
    mergedRowHeights.length !== currentRowHeights.length
    || mergedRowHeights.some((height, index) => height !== currentRowHeights[index])
  ) {
    headerRowHeights.value = mergedRowHeights;
  }

  const nextHeight = Math.max(
    DEFAULT_HEADER_TOTAL_HEIGHT,
    Math.ceil(
      Math.max(
        headerEl.getBoundingClientRect().height || 0,
        mergedRowHeights.reduce((sum, height) => sum + height, 0),
      ),
    ),
  );
  if (measuredHeaderHeight.value !== nextHeight) {
    measuredHeaderHeight.value = nextHeight;
  }
};
const activeEditorDefinition = computed(() => {
  if (!editingSession.value.editorType) {
    return undefined;
  }
  return props.editorRegistry?.resolve(editingSession.value.editorType);
});
const activePopupEditorDefinition = computed(() => {
  return activeEditorDefinition.value?.mode === "popup" ? activeEditorDefinition.value : undefined;
});
const activePopupEditorProps = computed(() => {
  if (!activeEditorContext.value) {
    return {};
  }
  return buildVirtualTableEditorProps({
    row: activeEditorContext.value.row,
    column: activeEditorContext.value.column,
    rowIndex: activeEditorContext.value.rowIndex,
    session: editingSession.value,
    resolvedEditor: activeEditorContext.value.resolvedEditor,
  });
});

const visibleSpanPlan = computed(() => {
  return buildVirtualSpanPlan({
    allRows: props.rows,
    rows: visibleItems.value.map((item) => ({
      row: item.row,
      rowIndex: item.index,
    })),
    descriptors: visibleColumnDescriptors.value,
    rowLimit: virtualWindow.value.end + 1,
    resolveRowSpanBoundary: resolveVisibleSpanPlanBoundary,
    resolveCarryInBoundary: resolveRowSpanBoundary,
    resolveCellSpan,
  });
});

const getPlannedCellSpan = (
  rowIndex: number,
  descriptor: VirtualVisibleColumnDescriptor,
): VirtualPlannedCellSpan => {
  return visibleSpanPlan.value.getCellSpan(rowIndex, descriptor.key);
};

const getBlankCellClass = (cell: { type: string; blankKind?: string }) => {
  if (cell.type === "blank" && cell.blankKind === "filler") {
    return "is-filler";
  }
  return cell.type === "normal" ? "" : "is-blank";
};

const headerLayoutResetSignature = computed(() => {
  return [
    headerRows.value.length,
    viewportWidth.value,
    leafColumns.value.map((column) => `${column.key}:${column.width ?? ""}:${column.minWidth ?? ""}:${column.maxWidth ?? ""}`).join("|"),
  ].join("::");
});

const { stop: stopHeaderResizeObserver } = useResizeObserver(headerRef, () => {
  syncMeasuredHeaderMetrics();
});

const { stop: stopScrollContainerResizeObserver } = useResizeObserver(scrollContainerRef, () => {
  syncOverlayScrollbarState();
  scheduleOverlayScrollbarSync();
});

const { stop: stopInnerResizeObserver } = useResizeObserver(innerRef, () => {
  syncOverlayScrollbarState();
  scheduleOverlayScrollbarSync();
});

watch(
  headerLayoutResetSignature,
  (nextSignature, previousSignature) => {
    if (previousSignature && nextSignature === previousSignature) {
      return;
    }
    headerRowHeights.value = [];
    measuredHeaderHeight.value = 0;
    void nextTick().then(() => {
      syncMeasuredHeaderMetrics();
    });
  },
  { immediate: true, flush: "post" },
);

watch(
  [headerRows, visibleColumnDescriptors],
  () => {
    void nextTick().then(() => {
      syncMeasuredHeaderMetrics();
      syncOverlayScrollbarState();
    });
  },
  { flush: "post" },
);

watch(
  [
    () => canvasWidth.value,
    () => bodyHeight.value,
    () => bodyFillerHeight.value,
    () => measuredHeaderHeight.value,
    () => props.loading,
    () => props.rows.length,
    visibleItems,
  ],
  () => {
    void nextTick().then(() => {
      syncOverlayScrollbarState();
      scheduleOverlayScrollbarSync();
    });
  },
  { immediate: true, flush: "post" },
);

const ensureMeasuredRowsCoverViewport = () => {
  if (!visibleItems.value.length || props.loading) {
    setViewportCompensation(0);
    return;
  }
  const currentCompensation = Math.max(
    0,
    Math.ceil(Number(effectiveRowViewportHeight.value - rowViewportHeight.value) || 0),
  );
  const nextCompensation = resolveVirtualViewportCompensation({
    renderedWindow: virtualWindow.value,
    scrollTop: scrollTop.value,
    viewportHeight: rowViewportHeight.value,
    rowCount: props.rows.length,
  });
  const projectedWindow = nextCompensation > 0
    ? previewVirtualWindow({
      viewportHeight: rowViewportHeight.value + nextCompensation,
    })
    : virtualWindow.value;
  const coverageAction = resolveVirtualViewportCoverageAction({
    renderedWindow: virtualWindow.value,
    scrollTop: scrollTop.value,
    viewportHeight: rowViewportHeight.value,
    rowCount: props.rows.length,
    currentCompensation,
    currentRenderedWindowEnd: virtualWindow.value.end,
    projectedRenderedWindowEnd: projectedWindow.end,
  });
  setViewportCompensation(coverageAction.compensation);
  if (coverageAction.shouldFollowupMeasurement) {
    requestVisibleRowMeasurement({ force: true });
  }
};

watch(
  [
    visibleItems,
    () => virtualWindow.value.end,
    () => scrollTop.value,
    () => rowViewportHeight.value,
    () => effectiveRowViewportHeight.value,
    () => props.loading,
    () => props.rows.length,
  ],
  () => {
    void nextTick().then(() => {
      ensureMeasuredRowsCoverViewport();
    });
  },
  { immediate: true, flush: "post" },
);

watch(
  [
    () => editingSession.value.status,
    () => editingSession.value.mode,
    () => scrollTop.value,
    visibleItems,
  ],
  () => {
    const fallbackAnchorEl = resolveActiveCellAnchorEl();
    const anchorAction = resolveVirtualTablePopupAnchorAction({
      session: editingSession.value,
      anchorEl: activeEditorAnchorEl.value,
      fallbackAnchorEl,
      containerEl: innerRef.value,
    });

    if (anchorAction.type === "none") {
      return;
    }

    if (anchorAction.type === "sync") {
      activeEditorAnchorEl.value = (anchorAction.anchorEl as HTMLElement | null) || fallbackAnchorEl || activeEditorAnchorEl.value;
      syncPopupAnchor(activeEditorAnchorEl.value);
      return;
    }

    cancelActiveCellEdit(undefined, "anchor-detached");
  },
  { flush: "post" },
);

const handleCellClick = (payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; event: MouseEvent }) => {
  emit("cell-click", payload);
};

const handleCellDblClick = (payload: { row: Record<string, any>; column: VirtualTableColumn; rowIndex: number; event: MouseEvent }) => {
  emit("cell-dblclick", payload);
};

const clearActiveEditing = () => {
  activeEditorContext.value = null;
  activePopupAnchor.value = null;
  activeEditorAnchorEl.value = null;
};

const resolveHoveredRowBoundary = (rowIndex: number): VirtualTableRowSpanBoundary => {
  return resolveRowSpanBoundary(rowIndex) || {
    start: rowIndex,
    end: rowIndex,
  };
};

const handleRowMouseEnter = (payload: { rowIndex: number }) => {
  hoveredRowBoundary.value = resolveHoveredRowBoundary(payload.rowIndex);
};

const clearHoveredRowBoundary = () => {
  hoveredRowBoundary.value = null;
};

const isRowHovered = (rowIndex: number) => {
  const boundary = hoveredRowBoundary.value;
  if (!boundary) {
    return false;
  }
  return rowIndex >= boundary.start && rowIndex <= boundary.end;
};

const preserveMeasuredRowHeightDuringHorizontalRange = ref(false);
let horizontalRangeMeasurementToken = 0;
const preserveMeasuredRowHeightDuringLayoutResize = ref(false);
let layoutResizeMeasurementToken = 0;
const autoHeightResizeController = createVirtualTableAutoHeightResizeController<number>({
  schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
  cancel: (timer) => window.clearTimeout(timer),
  onSettled: () => {
    preserveMeasuredRowHeightDuringHorizontalRange.value = false;
    const nextToken = layoutResizeMeasurementToken + 1;
    layoutResizeMeasurementToken = nextToken;
    preserveMeasuredRowHeightDuringLayoutResize.value = true;
    void nextTick().then(() => {
      scheduleFrame(() => {
        scheduleFrame(() => {
          if (layoutResizeMeasurementToken !== nextToken) {
            return;
          }
          preserveMeasuredRowHeightDuringLayoutResize.value = false;
        });
      });
    });
    requestVisibleRowMeasurement({ force: true });
  },
  delayMs: DEFAULT_VIRTUAL_TABLE_AUTO_HEIGHT_RESIZE_SETTLE_MS,
});

const activateHorizontalRangeMeasurementGuard = () => {
  if (!isAutoRowHeight.value || !isHorizontalVirtualizing.value) {
    preserveMeasuredRowHeightDuringHorizontalRange.value = false;
    return;
  }

  const nextToken = horizontalRangeMeasurementToken + 1;
  horizontalRangeMeasurementToken = nextToken;
  preserveMeasuredRowHeightDuringHorizontalRange.value = true;

  void nextTick().then(() => {
    scheduleFrame(() => {
      scheduleFrame(() => {
        if (horizontalRangeMeasurementToken !== nextToken) {
          return;
        }
        preserveMeasuredRowHeightDuringHorizontalRange.value = false;
      });
    });
  });
};

const requestVisibleRowMeasurement = (options: { force?: boolean } = {}) => {
  if (!options.force && autoHeightResizeController.isActive()) {
    return;
  }
  nextTick(() => {
    scheduleFrame(() => {
      measureVisibleVirtualRows({
        visibleItems: visibleItems.value,
        rowComponentRefMap,
      });
    });
  });
};

const setRowComponentRef = (
  key: string | number,
  element: Element | ComponentPublicInstance | VirtualTableRowComponentRef | null,
) => {
  rowComponentRefMap.set(key, (element as VirtualTableRowComponentRef | null) ?? null);
};

const layoutMeasurementSignature = computed(() => {
  if (!isAutoRowHeight.value) {
    return "";
  }
  return [
    viewportWidth.value,
    leafColumns.value.map((column) => `${column.key}:${column.width ?? ""}:${column.minWidth ?? ""}:${column.maxWidth ?? ""}`).join("|"),
  ].join("::");
});

watch(
  layoutMeasurementSignature,
  (nextSignature, previousSignature) => {
    if (!nextSignature || !previousSignature || nextSignature === previousSignature) {
      return;
    }
    if (!isAutoRowHeight.value) {
      return;
    }
    autoHeightResizeController.request();
  },
  { flush: "post" },
);

const visibleColumnMeasurementSignature = computed(() => {
  return visibleColumnDescriptors.value
    .map((descriptor) => {
      if (descriptor.type === "blank") {
        return `blank:${descriptor.blankSide}:${descriptor.blankKind || "virtual"}:${descriptor.width}`;
      }
      return `normal:${descriptor.column.key}:${descriptor.column.width ?? ""}`;
    })
    .join("|");
});

watch(
  visibleColumnMeasurementSignature,
  (nextSignature, previousSignature) => {
    if (!nextSignature || !previousSignature || nextSignature === previousSignature) {
      return;
    }
    if (autoHeightResizeController.isActive()) {
      return;
    }
    if (!isAutoRowHeight.value || !isHorizontalVirtualizing.value) {
      return;
    }
    activateHorizontalRangeMeasurementGuard();
    requestVisibleRowMeasurement();
  },
  { flush: "post" },
);

const visibleRowMeasurementSignature = computed(() => {
  return [
    visibleItems.value.map((item) => item.key).join("::"),
    props.rows.length,
    props.loading ? "loading" : "ready",
  ].join("|");
});

watch(
  visibleRowMeasurementSignature,
  () => {
    requestVisibleRowMeasurement();
  },
  {
    immediate: true,
    flush: "post",
  },
);

const handleRowMeasureEvent = (payload: { rowKey: string | number; rowIndex: number; height: number }) => {
  updateMeasuredRowHeight(payload, {
    mode: preserveMeasuredRowHeightDuringHorizontalRange.value || preserveMeasuredRowHeightDuringLayoutResize.value
      ? "preserve-max"
      : "replace",
  });
};

const requestActiveEditorCommit = (reason = "outside-click") => {
  if (!activeEditorContext.value || !editingSession.value.cell) {
    return false;
  }

  if (editingSession.value.mode === "popup") {
    editHostRef.value?.requestCommit?.(reason);
    return true;
  }

  const rowRef = rowComponentRefMap.get(editingSession.value.cell.rowKey);
  const descriptor = visibleColumnDescriptors.value.find((item) => (
    item.type === "normal" && item.column.key === editingSession.value.cell?.columnKey
  ));
  if (!rowRef || !descriptor || descriptor.type !== "normal") {
    return false;
  }
  rowRef.requestInlineEditorCommit?.(descriptor, reason);
  return true;
};

const resolveActiveCellAnchorEl = () => {
  const activeCell = editingSession.value.cell;
  if (!activeCell || !innerRef.value) {
    return null;
  }

  const descriptor = visibleColumnDescriptors.value.find((item) => (
    item.type === "normal" && item.column.key === activeCell.columnKey
  ));
  const rowRef = rowComponentRefMap.get(activeCell.rowKey);
  if (descriptor?.type === "normal") {
    const directCellEl = rowRef?.getCellElement?.(descriptor.key);
    if (directCellEl) {
      return directCellEl;
    }
  }

  const rowEl = innerRef.value.querySelector(
    `.virtual-table__row[data-row-key="${String(activeCell.rowKey)}"]`,
  ) as HTMLElement | null;
  if (!rowEl) {
    return null;
  }

  if (!descriptor || descriptor.type !== "normal") {
    return null;
  }

  const candidateCells = Array.from(rowEl.querySelectorAll(".virtual-table__cell")).filter((cell) => (
    !cell.classList.contains("is-blank")
    && !cell.classList.contains("is-span-placeholder")
  ));
  if (!candidateCells.length) {
    return null;
  }

  return (candidateCells[descriptor.columnIndex] as HTMLElement | undefined) || null;
};

const syncPopupAnchor = (anchorEl?: HTMLElement | null) => {
  if (!anchorEl || !innerRef.value) {
    activePopupAnchor.value = null;
    return;
  }
  const cellRect = anchorEl.getBoundingClientRect();
  const containerRect = innerRef.value.getBoundingClientRect();
  activePopupAnchor.value = createVirtualTableEditAnchor({
    cellRect,
    containerRect,
  });
};

const normalizeEditorEventReason = (payload: any, fallbackReason: string) => {
  if (payload && typeof payload === "object" && typeof payload.reason === "string") {
    return payload.reason;
  }
  return fallbackReason;
};

const handleCellEditStart = (payload: VirtualTableCellEditStartPayload) => {
  if (!props.editable) {
    return;
  }
  const definition = props.editorRegistry?.resolve(payload.resolvedEditor.type);
  if (!definition) {
    return;
  }

  const initialValue = resolveVirtualTableEditorValue({
    row: payload.row,
    column: payload.column,
    resolvedEditor: payload.resolvedEditor,
  });

  activeEditorContext.value = {
    row: payload.row,
    column: payload.column,
    rowIndex: payload.rowIndex,
    columnIndex: payload.columnIndex,
    cell: payload.cell,
    resolvedEditor: payload.resolvedEditor,
  };
  activeEditorAnchorEl.value = payload.anchorEl || null;

  editingSession.value = beginVirtualTableEdit(editingSession.value, {
    cell: payload.cell,
    draftValue: initialValue,
    initialValue,
    editorType: payload.resolvedEditor.type,
    mode: definition.mode,
    resolvedEditor: payload.resolvedEditor,
  });

  syncPopupAnchor(payload.anchorEl);

  emit("cell-edit-start", {
    row: payload.row,
    column: payload.column,
    rowIndex: payload.rowIndex,
    cell: payload.cell,
    resolvedEditor: payload.resolvedEditor,
  });
};

const handleCellEditDraft = (payload: { nextValue: any }) => {
  editingSession.value = updateVirtualTableEditDraft(editingSession.value, payload.nextValue);
};

const commitActiveCellEdit = async (payload?: any, fallbackReason = "manual") => {
  if (!activeEditorContext.value || !editingSession.value.cell) {
    return;
  }

  const nextValue = payload === undefined
    ? editingSession.value.draftValue
    : normalizeVirtualTableEditorEventValue(payload);
  const reason = normalizeEditorEventReason(payload, fallbackReason);
  const sessionBeforeCommit = updateVirtualTableEditDraft(editingSession.value, nextValue);
  editingSession.value = requestVirtualTableEditCommit(sessionBeforeCommit, reason);

  let result: VirtualTableEditCommitResult<Record<string, any>> = {
    status: "refreshed",
  };

  try {
    if (props.commitCellEdit) {
      result = await Promise.resolve(props.commitCellEdit({
        cell: activeEditorContext.value.cell,
        row: activeEditorContext.value.row,
        column: activeEditorContext.value.column,
        rowIndex: activeEditorContext.value.rowIndex,
        columnIndex: activeEditorContext.value.columnIndex,
        previousValue: sessionBeforeCommit.initialValue,
        nextValue,
        reason,
        resolvedEditor: activeEditorContext.value.resolvedEditor,
      }));
    }
  } catch (error) {
    result = {
      status: "rejected",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const previousContext = activeEditorContext.value;
  editingSession.value = completeVirtualTableEditCommit(editingSession.value, result);

  if (result.status === "rejected") {
    return;
  }

  clearActiveEditing();

  emit("cell-edit-commit", {
    row: previousContext.row,
    column: previousContext.column,
    rowIndex: previousContext.rowIndex,
    cell: previousContext.cell,
    previousValue: sessionBeforeCommit.initialValue,
    nextValue,
    reason,
    result,
    resolvedEditor: previousContext.resolvedEditor,
  });
};

const cancelActiveCellEdit = (payload?: any, fallbackReason = "cancel") => {
  if (!activeEditorContext.value || !editingSession.value.cell) {
    editingSession.value = cancelVirtualTableEdit(editingSession.value, fallbackReason);
    clearActiveEditing();
    return;
  }

  const reason = normalizeEditorEventReason(payload, fallbackReason);
  const previousContext = activeEditorContext.value;
  const previousCell = editingSession.value.cell;
  editingSession.value = cancelVirtualTableEdit(editingSession.value, reason);
  clearActiveEditing();

  emit("cell-edit-cancel", {
    row: previousContext.row,
    column: previousContext.column,
    rowIndex: previousContext.rowIndex,
    cell: previousCell,
    reason,
    resolvedEditor: previousContext.resolvedEditor,
  });
};

const handleCellEditCommit = (payload?: any) => {
  void commitActiveCellEdit(payload, "manual");
};

const handleCellEditCancel = (payload?: any) => {
  cancelActiveCellEdit(payload, "manual");
};

const handlePopupDraftChange = (nextValue: any) => {
  editingSession.value = updateVirtualTableEditDraft(editingSession.value, nextValue);
};

const handlePopupCommit = (payload?: any) => {
  void commitActiveCellEdit(payload, "popup");
};

const handlePopupCancel = (payload?: any) => {
  cancelActiveCellEdit(payload, "popup");
};

const handlePopupOutsideClick = (event: MouseEvent) => {
  if (props.shouldIgnoreEditOutsideClick?.(event)) {
    return;
  }
  if (resolveVirtualTableOutsideClickAction(activeEditorDefinition.value) === "commit") {
    if (!requestActiveEditorCommit("outside-click")) {
      void commitActiveCellEdit(undefined, "outside-click");
    }
    return;
  }
  cancelActiveCellEdit(undefined, "outside-click");
};

const handleInlineOutsideClick = (event: MouseEvent) => {
  if (editingSession.value.mode !== "inline" || editingSession.value.status !== "editing") {
    return;
  }
  if (props.shouldIgnoreEditOutsideClick?.(event)) {
    return;
  }
  const anchorEl = activeEditorAnchorEl.value;
  if (anchorEl?.contains(event.target as Node)) {
    return;
  }
  if (resolveVirtualTableOutsideClickAction(activeEditorDefinition.value) === "commit") {
    if (!requestActiveEditorCommit("outside-click")) {
      void commitActiveCellEdit(undefined, "outside-click");
    }
    return;
  }
  cancelActiveCellEdit(undefined, "outside-click");
};

onMounted(() => {
  document.addEventListener("mousedown", handleInlineOutsideClick, true);
  void nextTick().then(() => {
    syncOverlayScrollbarState();
    scheduleOverlayScrollbarSync();
  });
});

onBeforeUnmount(() => {
  isUnmounted = true;
  autoHeightResizeController.cancel();
  stopHeaderResizeObserver();
  stopScrollContainerResizeObserver();
  stopInnerResizeObserver();
  rowComponentRefMap.clear();
  activeEditorAnchorEl.value = null;
  activePopupAnchor.value = null;
  if (overlayScrollbarSyncFrame !== null) {
    window.cancelAnimationFrame(overlayScrollbarSyncFrame);
    overlayScrollbarSyncFrame = null;
  }
  pendingFrameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
  pendingFrameIds.clear();
  stopOverlayScrollbarDrag?.();
  stopColumnResize?.();
  stopColumnResize = null;
  document.removeEventListener("mousedown", handleInlineOutsideClick, true);
});

const getClampedColumnWidth = (column: VirtualTableColumn, nextWidth: number) => {
  const minWidth = Math.max(40, Number(column.minWidth) || 80);
  const maxWidth = Number(column.maxWidth) > 0 ? Number(column.maxWidth) : Number.POSITIVE_INFINITY;
  return Math.min(maxWidth, Math.max(minWidth, Math.floor(nextWidth)));
};

const startColumnResize = (cell: { column: VirtualTableColumn }, event: MouseEvent) => {
  const startX = event.clientX;
  const startWidth = Number(cell.column.width) || (event.currentTarget as HTMLElement | null)?.parentElement?.offsetWidth || 0;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const nextWidth = getClampedColumnWidth(cell.column, startWidth + moveEvent.clientX - startX);
    setColumnWidthOverride(cell.column.key, nextWidth);
  };

  const handleMouseUp = (upEvent: MouseEvent) => {
    const nextWidth = getClampedColumnWidth(cell.column, startWidth + upEvent.clientX - startX);
    clearColumnWidthOverride(cell.column.key);
    emit("column-width-change", {
      column: cell.column,
      width: nextWidth,
    });
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    stopColumnResize = null;
  };

  stopColumnResize?.();
  stopColumnResize = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
};

const getFooterCellStyle = (descriptor: VirtualVisibleColumnDescriptor) => {
  return {
    ...getBodyCellStyle(descriptor),
    minHeight: `${props.footerHeight}px`,
  };
};

const scrollTo = (options: { top?: number; left?: number; behavior?: ScrollBehavior } = {}) => {
  const scroller = scrollContainerRef.value;
  if (!scroller) {
    return;
  }
  scroller.scrollTo({
    top: options.top ?? scroller.scrollTop,
    left: options.left ?? scroller.scrollLeft,
    behavior: options.behavior,
  });
};

const scrollToRowIndex = (
  rowIndex: number,
  options: {
    align?: "start" | "center" | "end";
    behavior?: ScrollBehavior;
  } = {},
) => {
  const scroller = scrollContainerRef.value;
  if (!scroller) {
    return;
  }

  const clampedRowIndex = Math.max(0, Math.min(props.rows.length - 1, Math.floor(Number(rowIndex) || 0)));
  const rowTop = getRowOffset(clampedRowIndex);
  const rowBottom = getRowOffset(clampedRowIndex + 1);
  const rowHeight = Math.max(0, rowBottom - rowTop);
  const align = options.align || "start";

  let nextTop = rowTop;
  if (align === "center") {
    nextTop = rowTop - Math.max(0, Math.floor((scroller.clientHeight - rowHeight) / 2));
  } else if (align === "end") {
    nextTop = rowBottom - scroller.clientHeight;
  }

  scrollTo({
    top: Math.max(0, nextTop),
    behavior: options.behavior,
  });
};

const getVirtualState = () => {
  const boundaryColumnIndexSet = new Set(virtualWindowBoundaryColumnIndexes.value);
  return {
    virtualWindow: {
      ...virtualWindow.value,
    },
    visibleRowIndexes: visibleItems.value.map((item) => item.index),
    visibleRowKeys: visibleItems.value.map((item) => item.key),
    visibleColumnKeys: visibleColumnDescriptors.value
      .filter((descriptor) => descriptor.type === "normal")
      .map((descriptor) => descriptor.column.key),
    virtualWindowBoundaryColumnIndexes: [...virtualWindowBoundaryColumnIndexes.value],
    virtualWindowBoundaryColumnKeys: visibleColumnDescriptors.value
      .filter((descriptor): descriptor is Extract<VirtualVisibleColumnDescriptor, { type: "normal" }> => {
        return descriptor.type === "normal" && boundaryColumnIndexSet.has(descriptor.columnIndex);
      })
      .map((descriptor) => descriptor.column.key),
    scrollTop: scrollTop.value,
    rowViewportHeight: rowViewportHeight.value,
    effectiveRowViewportHeight: effectiveRowViewportHeight.value,
    totalRowHeight: getTotalRowHeight(),
    totalWidth: totalWidth.value,
    fixedBoundaryState: {
      ...fixedBoundaryState.value,
    },
  };
};

defineExpose({
  getScroller: () => scrollContainerRef.value,
  getVirtualState,
  scrollTo,
  scrollToRowIndex,
});
</script>

<style scoped lang="scss">
.virtual-table {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #fff;
  border: 1px solid #ebeef5;
}

.virtual-table.is-content-height {
  height: auto;
}

.virtual-table__scroller {
  --virtual-table-fixed-right-shadow: none;
  --virtual-table-fixed-right-divider: 0 solid transparent;
  --virtual-table-fixed-left-shadow: none;
  --virtual-table-fixed-left-divider: 0 solid transparent;
  height: 100%;
  overflow: auto;
  overflow-anchor: none;
  scrollbar-gutter: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  &.has-left-fixed-overlap {
    .virtual-table__header-cell.is-fixed-left,
    .virtual-table__cell.is-fixed-left,
    .virtual-table__footer-cell.is-fixed-left {
      box-shadow: 12px 0 18px -12px rgba(15, 23, 42, 0.22);
      border-right: 1px solid rgba(64, 158, 255, 0.22);
    }
  }

  &.has-right-fixed-overlap {
    --virtual-table-fixed-right-shadow: -12px 0 18px -12px rgba(15, 23, 42, 0.22);
    --virtual-table-fixed-right-divider: 1px solid rgba(64, 158, 255, 0.22);

    .virtual-table__header-cell.is-fixed-right,
    .virtual-table__footer-cell.is-fixed-right {
      box-shadow: var(--virtual-table-fixed-right-shadow);
      border-left: var(--virtual-table-fixed-right-divider);
    }
  }

  &.is-horizontal-end {
    --virtual-table-fixed-right-divider: 1px solid #ebeef5;

    .virtual-table__header-cell.is-fixed-right,
    .virtual-table__footer-cell.is-fixed-right {
      border-left: var(--virtual-table-fixed-right-divider);
    }
  }
}

.virtual-table.is-content-height .virtual-table__scroller {
  height: auto;
}

.virtual-table__overlay-scrollbar {
  position: absolute;
  z-index: 30;
  border-radius: 999px;
  background: transparent;
  pointer-events: auto;
  user-select: none;
}

.virtual-table__overlay-scrollbar--horizontal {
  right: 0px;
  bottom: 0px;
  left: 0px;
  height: 8px;

}

.virtual-table__overlay-scrollbar--vertical {
  top: 0px;
  right: 0px;
  bottom: 32px;
  width: 8px;
}

.virtual-table__overlay-scrollbar-thumb {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: rgba(78, 89, 105, 0.42);
  transition: background-color 0.16s ease;
}

.virtual-table__overlay-scrollbar:hover .virtual-table__overlay-scrollbar-thumb,
.virtual-table.is-overlay-scrollbar-dragging .virtual-table__overlay-scrollbar-thumb {
  background: rgba(78, 89, 105, 0.64);
}

.virtual-table__inner {
  position: relative;
  min-height: 100%;
  overflow-anchor: none;
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
}

.virtual-table.is-content-height .virtual-table__inner {
  min-height: 0;
}

.virtual-table__header {
  position: sticky;
  top: 0;
  z-index: 8;
  background: #f8fafc;
  border-bottom: 1px solid #ebeef5;
}

.virtual-table__header-row {
  display: flex;
}

.virtual-table__header-cell {
  display: flex;
  align-items: center;
  position: relative;
  box-sizing: border-box;
  padding: 3px 10px;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  background: #f8fafc;
  font-weight: 600;
  color: #303133;

  &.is-fixed-left,
  &.is-fixed-right {
    background: #f8fafc;
  }

  &.is-blank {
    padding: 0;
    border-color: transparent;
    background: transparent;
    pointer-events: none;
  }

  &.is-filler {
    padding: 0;
    background: #f8fafc;
    pointer-events: none;
  }
}

.virtual-table__header-content {
  display: flex;
  align-items: center;
  justify-content: var(--virtual-table-header-cell-justify, flex-start);
  width: 100%;
  min-width: 0;
  max-height: 60px;
  overflow: hidden;
  line-height: 20px;
}

.virtual-table__column-resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: col-resize;
  z-index: 2;
}

.virtual-table__header-text,
.virtual-table__cell-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.virtual-table__header-text {
  display: -webkit-box;
  max-height: 60px;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  white-space: normal;
  line-height: 20px;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.virtual-table__cell-text {
  display: inline-flex;
  white-space: nowrap;
}

.virtual-table__body {
  position: relative;
  flex: 1 0 auto;
  background: #fff;
  overflow-anchor: none;
}

.virtual-table.is-content-height .virtual-table__body {
  flex: 0 0 auto;
}

.virtual-table__body-filler {
  position: absolute;
  left: 0;
  right: 0;
  background-color: #fff;
  pointer-events: none;
}

.virtual-table__empty,
.virtual-table__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.virtual-table__empty {
  min-height: 160px;
}

.virtual-table__footer {
  position: sticky;
  bottom: 0;
  z-index: 7;
  display: flex;
  margin-top: auto;
  border-top: 1px solid #ebeef5;
  background: #fff;
  box-shadow: 0 -1px 0 rgba(235, 238, 245, 0.9);
}

.virtual-table__footer-cell {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 12px;
  border-right: 1px solid #ebeef5;
  background: #fff;

  &.is-fixed-left,
  &.is-fixed-right {
    background: #fff;
  }

  &.is-blank {
    padding: 0;
    border-color: transparent;
    background: transparent;
  }

  &.is-filler {
    padding: 0;
    background: #fff;
    pointer-events: none;
  }
}

.virtual-table__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--el-text-color-regular, #606266);
  font-size: 14px;
  line-height: 20px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(2px);
  z-index: 20;
}

.virtual-table__loading-spinner {
  flex: 0 0 auto;
  display: inline;
  width: 24px;
  height: 24px;
  animation: virtual-table-loading-rotate 2s linear infinite;

  .path {
    animation: virtual-table-loading-dash 1.5s ease-in-out infinite;
    stroke-dasharray: 90, 150;
    stroke-dashoffset: 0;
    stroke-width: 2;
    stroke: var(--el-color-primary, #409eff);
    stroke-linecap: round;
  }
}

@keyframes virtual-table-loading-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes virtual-table-loading-dash {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -40px;
  }

  to {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -120px;
  }
}
</style>
