<template>
  <div class="subform-grid" ref="gridContainerRef" :style="{ height: `${gridHeight}px` }">
    <div class="subform-grid__scroll" ref="scrollContainerRef" @scroll="handleScroll">
      <div class="subform-grid__canvas" :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }">
        <div class="subform-grid__header" :style="headerStyle">
          <div
            class="subform-grid__action-cell"
            :style="{ width: `${actionWidth}px`, minWidth: `${actionWidth}px` }"
          >
            <input
              v-if="batchOperation"
              class="subform-grid__checkbox"
              type="checkbox"
              :checked="allRowsSelected"
              :indeterminate="someRowsSelected && !allRowsSelected"
              @change="toggleAllRows"
            />
            <slot v-else name="header-actions" />
          </div>
          <div class="subform-grid__column-spacer" :style="{ width: leadingColumnWidth + 'px' }" />
          <div
            v-for="col in visibleColumns"
            :key="col.column.id"
            class="subform-grid__header-cell"
            :style="{ width: col.width + 'px', minWidth: col.width + 'px' }"
          >
            <slot name="header-cell" :column="col.column">
              <span class="subform-grid__header-text">{{ col.title }}</span>
            </slot>
          </div>
          <div class="subform-grid__column-spacer" :style="{ width: trailingColumnWidth + 'px' }" />
          <div
            v-if="hasTrailingAction"
            class="subform-grid__action-cell subform-grid__action-cell--trailing"
            :style="{ width: `${trailingActionWidth}px`, minWidth: `${trailingActionWidth}px` }"
          >
            <slot name="trailing-action-header" />
          </div>
        </div>

        <div
          v-for="rowInfo in visibleRows"
          :key="rowInfo.rowId"
          class="subform-grid__row"
          :style="{ top: rowInfo.top + 'px', height: rowHeight + 'px' }"
        >
          <div
            class="subform-grid__action-cell"
            :style="{ width: `${actionWidth}px`, minWidth: `${actionWidth}px` }"
          >
            <input
              v-if="batchOperation"
              class="subform-grid__checkbox"
              type="checkbox"
              :checked="isSelected(rowInfo.rowId)"
              @change="toggleRow(rowInfo.rowId)"
            />
            <slot
              v-else
              name="row-actions"
              :row-id="rowInfo.rowId"
              :index="rowInfo.index"
              :batch-operation="batchOperation"
            >
              <span class="subform-grid__row-index">{{ rowInfo.index + 1 }}</span>
            </slot>
          </div>
          <div class="subform-grid__column-spacer" :style="{ width: leadingColumnWidth + 'px' }" />
          <div
            v-for="col in visibleColumns"
            :key="col.column.id"
            class="subform-grid__cell"
            :style="{ width: col.width + 'px', minWidth: col.width + 'px' }"
          >
            <CellPresenter
              :address="{ rowId: rowInfo.rowId, fieldId: col.column.fieldId }"
              :column="col.column"
              :store="store"
              :version="renderVersion"
              :readonly="readonly"
              :action-selected="isActionSelected(rowInfo.rowId, col.column.fieldId)"
              :related-data-service="relatedDataService"
              :option-service="optionService"
              @commit="handleCellCommit"
              @click="handleCellClick"
              @action="handleCellAction"
              @enter="handleCellEnter"
            />
          </div>
          <div class="subform-grid__column-spacer" :style="{ width: trailingColumnWidth + 'px' }" />
          <div
            v-if="hasTrailingAction"
            class="subform-grid__action-cell subform-grid__action-cell--trailing"
            :style="{ width: `${trailingActionWidth}px`, minWidth: `${trailingActionWidth}px` }"
          >
            <slot name="trailing-action" :row-id="rowInfo.rowId" :index="rowInfo.index" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from "vue";
import type { RowId, FieldId, CellAddress } from "../runtime/types";
import type { ColumnDefinition } from "../runtime/column-definition";
import type { RowStore } from "../runtime/row-store";
import type { RuntimeRelatedDataService } from "../runtime/related-data-service";
import type { RuntimeOptionService } from "../runtime/option-service";
import CellPresenter from "./CellPresenter.vue";

const props = defineProps<{
  store: RowStore;
  columns: readonly ColumnDefinition[];
  rowHeight?: number;
  readonly?: boolean;
  overscan?: number;
  height?: number;
  actionWidth?: number;
  trailingActionWidth?: number;
  stretchColumns?: boolean;
  batchOperation?: boolean;
  selectedRowIds?: readonly RowId[];
  actionSelectedAddresses?: ReadonlySet<string>;
  relatedDataService?: RuntimeRelatedDataService | null;
  optionService?: RuntimeOptionService | null;
  externalVersion?: number;
}>();

const emit = defineEmits<{
  (e: "cell-change", payload: { address: CellAddress; value: unknown }): void;
  (e: "selection-change", rowIds: RowId[]): void;
  (e: "cell-action", payload: { address: CellAddress; anchor?: HTMLElement | null; readonly?: boolean }): void;
  (e: "enter", address: CellAddress): void;
}>();

const gridContainerRef = ref<HTMLElement | null>(null);
const scrollContainerRef = ref<HTMLElement | null>(null);

const rowHeight = computed(() => props.rowHeight || 36);
const overscan = computed(() => props.overscan || 5);
const GRID_BORDER_HEIGHT = 2;
const SCROLLBAR_HEIGHT = 8;
const actionWidth = computed(() => props.actionWidth || 80);
const trailingActionWidth = computed(() => Math.max(0, props.trailingActionWidth || 0));
const hasTrailingAction = computed(() => trailingActionWidth.value > 0);
const batchOperation = computed(() => props.batchOperation === true);
const viewportHeight = ref(600);
const viewportWidth = ref(800);
const scrollViewportWidth = ref(800);
const scrollTop = ref(0);
const scrollLeft = ref(0);

const storeVersion = ref(0);
const renderVersion = computed(() => storeVersion.value + (props.externalVersion || 0));
let stopStoreSubscription: (() => boolean) | undefined;

const columnWidths = computed(() => {
  const configured = props.columns.map(col => ({
    column: col,
    width: Number((col.schema as any)?.widthInSubForm || 200),
    title: (col.schema as any)?.title ?? '',
  }));
  const configuredTotal = configured.reduce((sum, item) => sum + item.width, 0);
  const usable = Math.min(scrollViewportWidth.value, viewportWidth.value);
  const available = usable - actionWidth.value - trailingActionWidth.value;
  const stretch = props.stretchColumns === true && configuredTotal > 0 && available > configuredTotal;
  let left = 0;
  let remaining = available;
  return configured.map((item, index) => {
    let width = item.width;
    if (stretch) {
      width = index === configured.length - 1
        ? remaining
        : Math.floor(item.width * available / configuredTotal);
      remaining -= width;
    }
    const result = { ...item, width, left };
    left += width;
    return result;
  });
});

const visibleColumns = computed(() => {
  const columns = columnWidths.value;
  if (!columns.length) return columns;
  const left = Math.max(scrollLeft.value - actionWidth.value, 0);
  const availableWidth = (scrollLeft.value < actionWidth.value
    ? viewportWidth.value - actionWidth.value + scrollLeft.value
    : viewportWidth.value) - trailingActionWidth.value;
  const right = left + Math.max(availableWidth, 1);
  let start = columns.findIndex(column => column.left + column.width >= left);
  if (start < 0) start = columns.length - 1;
  let end = start;
  while (end < columns.length && columns[end].left <= right) end += 1;
  start = Math.max(0, start - 2);
  end = Math.min(columns.length, end + 2);
  return columns.slice(start, end);
});

const totalColumnsWidth = computed(() => columnWidths.value.reduce((sum, col) => sum + col.width, 0));
const leadingColumnWidth = computed(() => visibleColumns.value[0]?.left || 0);
const canvasWidth = computed(() => Math.max(
  actionWidth.value + totalColumnsWidth.value + trailingActionWidth.value,
  Math.min(scrollViewportWidth.value, viewportWidth.value),
));
const trailingColumnWidth = computed(() => {
  const last = visibleColumns.value[visibleColumns.value.length - 1];
  const contentRight = last ? last.left + last.width : 0;
  const limit = canvasWidth.value - actionWidth.value - trailingActionWidth.value;
  return Math.max(0, limit - contentRight);
});

const rowState = computed(() => ({ version: renderVersion.value, rowIds: props.store.rowIds }));
const rowIds = computed(() => rowState.value.rowIds);

const canvasHeight = computed(() => {
  return (rowIds.value.length + 1) * rowHeight.value;
});

const gridHeight = computed(() => {
  const limit = props.height || 400;
  const contentWidth = actionWidth.value + totalColumnsWidth.value + trailingActionWidth.value;
  const needsHorizontalScrollbar = contentWidth > Math.min(scrollViewportWidth.value, viewportWidth.value) + 1;
  const scrollbarHeight = needsHorizontalScrollbar ? SCROLLBAR_HEIGHT : 0;
  return Math.min(limit, canvasHeight.value + GRID_BORDER_HEIGHT + scrollbarHeight);
});

const selectedSet = computed(() => {
  const selected = new Set(props.selectedRowIds || []);
  return new Set(rowIds.value.filter(rowId => selected.has(rowId)));
});
const allRowsSelected = computed(() => rowIds.value.length > 0 && selectedSet.value.size === rowIds.value.length);
const someRowsSelected = computed(() => selectedSet.value.size > 0);

const headerStyle = computed(() => ({
  height: rowHeight.value + "px",
  position: "sticky" as const,
  top: "0",
  zIndex: 2,
  background: "var(--bg-color)",
}));

const visibleRows = computed(() => {
  const bodyScrollTop = Math.max(0, scrollTop.value - rowHeight.value);
  const startIndex = Math.max(0, Math.floor(bodyScrollTop / rowHeight.value) - overscan.value);
  const endIndex = Math.min(
    rowIds.value.length,
    Math.ceil((bodyScrollTop + viewportHeight.value) / rowHeight.value) + overscan.value,
  );

  return rowIds.value.slice(startIndex, endIndex).map((rowId, i) => ({
    rowId,
    index: startIndex + i,
    top: rowHeight.value + (startIndex + i) * rowHeight.value,
  }));
});

function isSelected(rowId: RowId) {
  return selectedSet.value.has(rowId);
}

function emitSelection(rowIds: RowId[]) {
  emit("selection-change", rowIds);
}

function toggleRow(rowId: RowId) {
  const next = new Set(selectedSet.value);
  if (next.has(rowId)) next.delete(rowId);
  else next.add(rowId);
  emitSelection(rowIds.value.filter(id => next.has(id)));
}

function toggleAllRows(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  emitSelection(checked ? rowIds.value.slice() : []);
}

function handleCellCommit(payload: { address: CellAddress; value: unknown }) {
  const { address, value } = payload;
  const column = props.columns.find(col => col.fieldId === address.fieldId);
  if (!column) return;

  props.store.transact(tx => {
    tx.setValue(address, column.adapter.parse(value, {
      address,
      row: props.store.getRow(address.rowId)!,
      store: props.store,
    }), "user");
  }).then(() => {
    emit("cell-change", { address, value });
  });
}

function handleCellClick() {
}

function handleCellAction(address: CellAddress, anchor?: HTMLElement | null, readonly?: boolean) {
  emit("cell-action", { address, anchor, readonly });
}

function handleCellEnter(address: CellAddress) {
  emit("enter", address);
}

function scrollRowIntoView(index: number) {
  const el = scrollContainerRef.value;
  if (!el) return;
  const rowTop = (index + 1) * rowHeight.value;
  const viewTop = el.scrollTop;
  const viewBottom = viewTop + el.clientHeight;
  if (rowTop < viewTop + rowHeight.value) {
    el.scrollTop = Math.max(0, rowTop - rowHeight.value);
  } else if (rowTop + rowHeight.value > viewBottom) {
    el.scrollTop = rowTop + rowHeight.value - el.clientHeight;
  }
  scrollTop.value = el.scrollTop;
}

async function focusCell(address: CellAddress): Promise<boolean> {
  const index = rowIds.value.indexOf(address.rowId);
  if (index < 0) return false;
  scrollRowIntoView(index);

  for (let attempt = 0; attempt < 3; attempt++) {
    await nextTick();
    const selector = `[data-cell-row="${address.rowId}"][data-cell-field="${address.fieldId}"]`;
    const input = scrollContainerRef.value
      ?.querySelector<HTMLElement>(`${selector} input, ${selector} textarea`);
    if (input) {
      input.focus();
      (input as HTMLInputElement).select?.();
      return true;
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return false;
}

defineExpose({ focusCell });

function isActionSelected(rowId: RowId, fieldId: FieldId) {
  return props.actionSelectedAddresses?.has(`${rowId}\u0000${fieldId}`) === true;
}

function handleScroll() {
  const el = scrollContainerRef.value;
  if (!el) return;
  scrollTop.value = el.scrollTop;
  scrollLeft.value = el.scrollLeft;
}

function updateViewport() {
  const el = gridContainerRef.value;
  if (!el) return;
  viewportHeight.value = el.clientHeight;
  viewportWidth.value = el.clientWidth;
  scrollViewportWidth.value = scrollContainerRef.value?.clientWidth || el.clientWidth;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  stopStoreSubscription = props.store.subscribe(() => {
    storeVersion.value += 1;
  });
  resizeObserver = new ResizeObserver(() => updateViewport());
  watch(gridContainerRef, el => {
    if (!el) return;
    resizeObserver?.observe(el);
    updateViewport();
  }, { immediate: true });
  watch(() => props.store.size, () => { void nextTick(updateViewport); });
});

onBeforeUnmount(() => {
  stopStoreSubscription?.();
  resizeObserver?.disconnect();
});
</script>

<style lang="scss" scoped>
.subform-grid {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;
  background: var(--el-table-tr-bg-color, #fff);

  &__scroll {
    width: 100%;
    height: 100%;
    overflow: auto;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 8px;
      background: var(--el-scrollbar-bg-color, #c0c4cc);
      background-clip: padding-box;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: var(--el-scrollbar-hover-bg-color, #909399);
      background-clip: padding-box;
    }
  }

  &__canvas {
    position: relative;
  }

  &__header {
    display: flex;
    background: var(--el-table-header-bg-color, #f7f7fa);
    border-bottom: 1px solid var(--el-border-color, var(--border-color));
    color: var(--el-table-header-text-color, var(--text-color-primary));
    box-sizing: border-box;
    box-shadow: 0 1px 0 rgb(0 0 0 / 2%);
  }

  &__header-cell {
    display: flex;
    align-items: center;
    padding: 0 8px;
    border-right: 1px solid var(--el-border-color, var(--border-color));
    overflow: hidden;
    flex-shrink: 0;
    font-weight: 400;
    font-size: 13px;
    line-height: 20px;
    color: var(--el-text-color-primary, var(--text-color-primary));
  }

  &__action-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--border-color-light);
    flex-shrink: 0;
    position: relative;
    background: var(--el-table-header-bg-color, #f7f7fa);
  }

  &__action-cell--trailing {
    position: sticky;
    right: 0;
    z-index: 1;
    border-right: none;
    border-left: 1px solid var(--border-color-light);
    background: var(--el-table-tr-bg-color, #fff);
  }

  &__header &__action-cell--trailing {
    z-index: 3;
    background: var(--el-table-header-bg-color, #f7f7fa);
  }

  &__row:hover &__action-cell--trailing,
  &__row:focus-within &__action-cell--trailing {
    background: #f9f9fb;
  }

  &__column-spacer {
    flex: 0 0 auto;
    height: 100%;
  }

  &__checkbox {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--el-color-primary, var(--color-primary));
    cursor: pointer;
  }

  &__row-index {
    color: var(--text-color-secondary);
    font-size: 12px;
  }

  &__header-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__row {
    position: absolute;
    left: 0;
    display: flex;
    border-bottom: 1px solid var(--el-border-color-lighter, var(--border-color-light));
    background: var(--el-table-tr-bg-color, #fff);
    transition: background-color 0.12s ease;

    &:hover {
      background: #f9f9fb;
    }

    &:focus-within {
      background: #f9f9fb;
    }
  }

  &__cell {
    display: flex;
    align-items: center;
    border-right: 1px solid var(--el-border-color-lighter, var(--border-color-light));
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
    box-sizing: border-box;

    &:focus-within {
      z-index: 1;
    }
  }
}
</style>
