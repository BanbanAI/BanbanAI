<template>
  <div class="pivot-table-widget__table-shell">
    <pivot-table
      ref="pivotTableRef"
      class="pivot-table-widget__table"
      mode="cross"
      :records="tableRecords"
      :dimensions="widget.dimensions"
      :left-codes="widget.leftCodes"
      :top-codes="widget.topCodes"
      :indicators="widget.indicatorConfigs"
      :aggregate="widget.buildAggregate"
      :indicator-side="widget.indicatorSide"
      :show-subtotal-row="widget.showSubtotalRow"
      :show-subtotal-column="widget.showSubtotalColumn"
      :subtotal-row-position="widget.subtotalRowPosition"
      :subtotal-column-position="widget.subtotalColumnPosition"
      :show-grand-total-row="widget.showGrandTotalRow"
      :grand-total-row-position="widget.grandTotalRowPosition"
      :show-grand-total-column="widget.showGrandTotalColumn"
      :grand-total-column-position="widget.grandTotalColumnPosition"
      :supports-expand="widget.supportsExpand"
      :left-expand-keys="widget.runtimeState.leftExpandKeys"
      :top-expand-keys="widget.runtimeState.topExpandKeys"
      :column-width-map="widget.columnWidthMap"
      :default-column-width="widget.defaultColumnWidth"
      :header-height="widget.headerHeight"
      :show-corner-dimension-header="shouldShowCornerDimensionHeader"
      :enable-column-resize="true"
      :container-width="'100%'"
      :container-height="'100%'"
      :empty-text="$t('emptyText')"
      :loading="tableLoading"
      :loading-text="$t('loadingText')"
      @change-left-expand-keys="$emit('change-left-expand-keys', $event)"
      @change-top-expand-keys="$emit('change-top-expand-keys', $event)"
      @column-width-change="$emit('column-width-change', $event)"
    >
      <template #header-cell="slotProps">
        <button
          v-if="slotProps.canToggle"
          type="button"
          class="pivot-table-widget__header-content pivot-table-widget__toggle-button"
          :class="resolveHeaderClasses(slotProps)"
          @click.stop="slotProps.toggleColumn"
        >
          <span class="pivot-table-widget__toggle-icon">
            <el-icon v-if="slotProps.expanded" :size="12"><i-ep-caret-bottom /></el-icon>
            <el-icon v-else :size="12"><i-ep-caret-right /></el-icon>
          </span>
          <span class="pivot-table-widget__text">{{ resolveHeaderText(slotProps.displayTitle) }}</span>
        </button>
        <span
          v-else
          class="pivot-table-widget__header-content"
          :class="resolveHeaderClasses(slotProps)"
        >
          <span class="pivot-table-widget__text">{{ resolveHeaderText(slotProps.displayTitle) }}</span>
        </span>
      </template>

      <template #cell="slotProps">
        <button
          v-if="slotProps.canToggle"
          type="button"
          class="pivot-table-widget__cell-content pivot-table-widget__toggle-button"
          :class="resolveCellClasses(slotProps)"
          @click.stop="slotProps.toggleRow"
        >
          <span class="pivot-table-widget__toggle-icon">
            <el-icon v-if="slotProps.expanded" :size="12"><i-ep-caret-bottom /></el-icon>
            <el-icon v-else :size="12"><i-ep-caret-right /></el-icon>
          </span>
          <span class="pivot-table-widget__text">{{ resolveCellText(slotProps) }}</span>
        </button>
        <span
          v-else
          class="pivot-table-widget__cell-content"
          :class="resolveCellClasses(slotProps)"
        >
          <span class="pivot-table-widget__text">{{ resolveCellText(slotProps) }}</span>
        </span>
      </template>
    </pivot-table>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import i18next, { $t } from "@renderer/widgets/i18next";
import { PivotTableWidget } from "./pivot-table";
import {
  resolvePivotDisplayText,
  resolvePivotSummaryKind,
} from "./pivot-table-adapter";
import IEpCaretBottom from "~icons/ep/caret-bottom";
import IEpCaretRight from "~icons/ep/caret-right";

const PIVOT_TABLE_WIDGET_INITIAL_LOADING_MIN_MS = 500;
const PIVOT_TABLE_WIDGET_RENDER_SETTLE_FRAMES = 2;

type PivotTableHeaderSlotPayload = {
  displayTitle: unknown;
  canToggle: boolean;
  expanded: boolean;
  toggleColumn: () => void;
  isDataColumn: boolean;
  isLeftMeta: boolean;
};

type PivotTableCellSlotPayload = {
  displayValue: unknown;
  rawValue: unknown;
  canToggle: boolean;
  expanded: boolean;
  toggleRow: () => void;
  isDataCell: boolean;
  isLeftMeta: boolean;
  indicator?: {
    align?: "left" | "center" | "right";
  };
  leftNode?: {
    value?: unknown;
  };
  topNode?: {
    value?: unknown;
  };
};

type PivotTableExportData = {
  data: any[][];
  merges?: Array<{
    s: { r: number; c: number };
    e: { r: number; c: number };
  }>;
  sheetName?: string;
};

type PivotTableHandle = {
  getExportData?: () => PivotTableExportData;
};

const props = defineProps({
  widget: {
    type: Object as PropType<PivotTableWidget>,
    required: true,
  },
});

defineEmits<{
  (event: "change-left-expand-keys", payload: { nextKeys: string[] }): void;
  (event: "change-top-expand-keys", payload: { nextKeys: string[] }): void;
  (event: "column-width-change", payload: { column: Record<string, any>; width: number }): void;
}>();

const widget = computed(() => props.widget);
const pivotTableRef = ref<PivotTableHandle | null>(null);
const shouldDeferTableRecords = ref(true);
const isInitialTableLoading = ref(true);
const initialTablePreparingStartedAt = Date.now();
let initialTableFrameIds: number[] = [];
let initialTablePreparingTimerId: number | null = null;

const cancelInitialTablePreparingFrame = () => {
  initialTableFrameIds.forEach(frameId => window.cancelAnimationFrame(frameId));
  initialTableFrameIds = [];
  if (initialTablePreparingTimerId !== null) {
    window.clearTimeout(initialTablePreparingTimerId);
    initialTablePreparingTimerId = null;
  }
};

const finishInitialTableLoading = () => {
  const elapsed = Date.now() - initialTablePreparingStartedAt;
  const remaining = PIVOT_TABLE_WIDGET_INITIAL_LOADING_MIN_MS - elapsed;
  if (remaining <= 0) {
    isInitialTableLoading.value = false;
    return;
  }

  initialTablePreparingTimerId = window.setTimeout(() => {
    initialTablePreparingTimerId = null;
    isInitialTableLoading.value = false;
  }, remaining);
};

const scheduleAfterFrames = (frameCount: number, callback: () => void) => {
  if (typeof window.requestAnimationFrame !== "function") {
    callback();
    return;
  }

  const run = (remainingFrames: number) => {
    if (remainingFrames <= 0) {
      callback();
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      initialTableFrameIds = initialTableFrameIds.filter(item => item !== frameId);
      run(remainingFrames - 1);
    });
    initialTableFrameIds.push(frameId);
  };

  run(frameCount);
};

const scheduleInitialTableRender = () => {
  scheduleAfterFrames(PIVOT_TABLE_WIDGET_RENDER_SETTLE_FRAMES, () => {
    shouldDeferTableRecords.value = false;
    void nextTick().then(() => {
      scheduleAfterFrames(PIVOT_TABLE_WIDGET_RENDER_SETTLE_FRAMES, finishInitialTableLoading);
    });
  });
};

onMounted(() => {
  scheduleInitialTableRender();
});

onBeforeUnmount(() => {
  cancelInitialTablePreparingFrame();
});

const tableRecords = computed(() => (
  shouldDeferTableRecords.value ? [] : widget.value.records
));

const tableLoading = computed(() => (
  widget.value.isLoading || isInitialTableLoading.value
));

const summaryTextMap = computed(() => ({
  "grand-total": i18next.t("grandTotalLabel"),
  subtotal: i18next.t("subtotalLabel"),
}));

const resolveSummaryText = (value: unknown) => {
  const summaryKind = resolvePivotSummaryKind(resolvePivotDisplayText(value));
  return summaryKind ? summaryTextMap.value[summaryKind] : null;
};

const resolveHeaderText = (value: unknown) => {
  return resolveSummaryText(value) || resolvePivotDisplayText(value);
};

const resolveCellText = (slotProps: PivotTableCellSlotPayload) => {
  if (!slotProps.isLeftMeta) {
    return resolvePivotDisplayText(slotProps.displayValue);
  }

  const summaryValue = slotProps.leftNode?.value ?? slotProps.displayValue;
  return resolveSummaryText(summaryValue) || resolvePivotDisplayText(slotProps.displayValue);
};

const resolveHeaderClasses = (slotProps: PivotTableHeaderSlotPayload) => {
  return {
    "is-summary": Boolean(resolveSummaryText(slotProps.displayTitle)),
    "is-data-column": slotProps.isDataColumn,
    "is-left-meta": slotProps.isLeftMeta,
  };
};

const resolveCellClasses = (slotProps: PivotTableCellSlotPayload) => {
  return {
    "is-summary": Boolean(resolveSummaryText(slotProps.leftNode?.value ?? slotProps.topNode?.value ?? slotProps.displayValue)),
    "is-data-cell": slotProps.isDataCell,
    "is-left-meta": slotProps.isLeftMeta,
    "is-numeric": slotProps.indicator?.align === "right" || typeof slotProps.rawValue === "number",
  };
};

const shouldShowCornerDimensionHeader = computed(() => {
  return widget.value.indicatorSide === "top"
    && widget.value.topCodes.length > 0
    && widget.value.leftCodes.length > 0;
});

defineExpose({
  getExportData: () => pivotTableRef.value?.getExportData?.(),
});
</script>

<style lang="scss" scoped>
.pivot-table-widget__table-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  isolation: isolate;
}

.pivot-table-widget__table {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 4px;
  overflow: hidden;

  :deep(.virtual-table__row:hover),
  :deep(.virtual-table__row.is-row-hovered) {
    --virtual-table-row-background: #f5f7fa;
  }

  :deep(.virtual-table__row:hover .virtual-table__cell),
  :deep(.virtual-table__row.is-row-hovered .virtual-table__cell),
  :deep(.virtual-table__row:hover .virtual-table__cell-overlay),
  :deep(.virtual-table__row.is-row-hovered .virtual-table__cell-overlay) {
    background: #f5f7fa;
  }
}

.pivot-table-widget__header-content,
.pivot-table-widget__cell-content {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: inherit;
}

.pivot-table-widget__header-content {
  font-weight: 600;
}

.pivot-table-widget__cell-content.is-numeric {
  justify-content: flex-end;
}

.pivot-table-widget__header-content.is-summary,
.pivot-table-widget__cell-content.is-summary {
  font-weight: 600;
}

.pivot-table-widget__toggle-button {
  border: none;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pivot-table-widget__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
