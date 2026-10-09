import { computed, onScopeDispose, type CSSProperties, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { computeStickyOffsets, getColumnWidth } from "./column-utils";
import {
  buildVisibleColumnDescriptors,
  buildVisibleHeaderRows,
  HORIZONTAL_VIRTUAL_OVERSCAN_PX,
  partitionVirtualColumns,
  resolveHorizontalRenderRange,
} from "./horizontal-render";
import {
  resolveEffectiveVirtualFixedColumns,
  resolveVirtualFixedColumnBoundaryState,
} from "./fixed-column-boundary";
import {
  resolveVirtualTableBodyViewportHeight,
  resolveVirtualTableCanvasWidth,
  resolveVirtualTableTrailingFillerWidth,
  resolveVirtualTableViewportMetrics,
} from "./layout";
import {
  inferVirtualRowSpanBoundaries,
  inferVirtualWindowRowSpanBoundaries,
  resolveVirtualSpanPlanBoundary,
  resolveVirtualRowSpanBoundaryColumnIndexes,
} from "./span-boundary";
import { normalizeVirtualTableColumnSpan } from "./span-policy";
import {
  createHeightManager,
  resolveVirtualScrollUpdateThreshold,
  resolveVirtualWindow,
  shouldUpdateVirtualScrollOffset,
} from "./virtual-range";
import {
  VirtualTableCellSpan,
  VirtualTableColumn,
  VirtualTableRowSpanBoundary,
  VirtualVisibleColumnDescriptor,
  VirtualVisibleHeaderCell,
} from "./types";

type RowKeyGetter<T> = string | ((row: T, index: number) => string | number);

type UseVirtualTableOptions<T> = {
  columns: MaybeRefOrGetter<VirtualTableColumn[]>;
  rows: MaybeRefOrGetter<T[]>;
  rowKey: MaybeRefOrGetter<RowKeyGetter<T>>;
  estimatedRowHeight: MaybeRefOrGetter<number>;
  overscan: MaybeRefOrGetter<number>;
  headerHeight: MaybeRefOrGetter<number>;
  headerHeightTotalOverride?: MaybeRefOrGetter<number | undefined>;
  showFooter?: MaybeRefOrGetter<boolean>;
  footerHeight?: MaybeRefOrGetter<number>;
  getCellSpan?: MaybeRefOrGetter<((row: T, rowIndex: number, column: VirtualTableColumn, columnIndex: number) => Partial<VirtualTableCellSpan> | undefined) | undefined>;
  getRowSpanBoundary?: MaybeRefOrGetter<((row: T, rowIndex: number) => VirtualTableRowSpanBoundary | undefined) | undefined>;
};

export const useVirtualTable = <T>(options: UseVirtualTableOptions<T>) => {
  const scrollContainerRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const scrollLeft = ref(0);
  const scrollLeftVisual = ref(0);
  const viewportHeight = ref(0);
  const viewportWidth = ref(0);
  const viewportCompensation = ref(0);
  const heightVersion = ref(0);
  const columnWidthOverrides = ref<Record<string, number>>({});
  let viewportMetricsFrame: number | null = null;

  const heightManager = createHeightManager({
    rowCount: toValue(options.rows).length,
    estimatedRowHeight: toValue(options.estimatedRowHeight),
  });

  const resolvedColumns = computed(() => {
    const applyOverrides = (columns: VirtualTableColumn[] = []) => {
      return columns.map((column) => {
        const nextColumn: VirtualTableColumn = {
          ...column,
        };
        const overrideWidth = columnWidthOverrides.value[column.key];
        if (Number.isFinite(overrideWidth) && overrideWidth > 0) {
          nextColumn.width = overrideWidth;
        }
        if (column.children?.length) {
          nextColumn.children = applyOverrides(column.children);
        }
        return nextColumn;
      });
    };

    return applyOverrides(toValue(options.columns));
  });

  const effectiveColumns = computed(() => resolveEffectiveVirtualFixedColumns({
    columns: resolvedColumns.value,
    viewportWidth: viewportWidth.value,
  }));
  const columnPartitions = computed(() => partitionVirtualColumns(effectiveColumns.value));
  const leafColumns = computed(() => columnPartitions.value.flat.full);
  const stickyOffsets = computed(() => computeStickyOffsets(leafColumns.value));
  const totalWidth = computed(() => leafColumns.value.reduce((width, column) => width + getColumnWidth(column), 0));
  const canvasWidth = computed(() => resolveVirtualTableCanvasWidth({
    totalWidth: totalWidth.value,
    viewportWidth: viewportWidth.value,
  }));
  const trailingFillerWidth = computed(() => resolveVirtualTableTrailingFillerWidth({
    canvasWidth: canvasWidth.value,
    totalWidth: totalWidth.value,
  }));
  const enableHorizontalVirtual = computed(() => {
    return viewportWidth.value > 0
      && totalWidth.value > viewportWidth.value
      && columnPartitions.value.flat.center.length > 0;
  });
  const horizontalRenderRange = computed(() => {
    return resolveHorizontalRenderRange({
      flat: columnPartitions.value.flat,
      scrollLeft: scrollLeft.value,
      viewportWidth: viewportWidth.value,
      overscanPx: HORIZONTAL_VIRTUAL_OVERSCAN_PX,
      enabled: enableHorizontalVirtual.value,
    });
  });
  const fixedBoundaryState = computed(() => {
    return resolveVirtualFixedColumnBoundaryState({
      totalWidth: totalWidth.value,
      viewportWidth: viewportWidth.value,
      scrollLeft: scrollLeftVisual.value,
      hasFixedLeft: columnPartitions.value.flat.left.length > 0,
      hasFixedRight: columnPartitions.value.flat.right.length > 0,
    });
  });
  const visibleColumnDescriptors = computed(() => {
    return buildVisibleColumnDescriptors({
      flat: columnPartitions.value.flat,
      horizontalRange: horizontalRenderRange.value,
      enabled: enableHorizontalVirtual.value,
      trailingFillerWidth: trailingFillerWidth.value,
    });
  });
  const headerRows = computed(() => {
    return buildVisibleHeaderRows({
      nested: columnPartitions.value.nested,
      flat: columnPartitions.value.flat,
      horizontalRange: horizontalRenderRange.value,
      enabled: enableHorizontalVirtual.value,
      trailingFillerWidth: trailingFillerWidth.value,
    });
  });
  const headerHeightTotal = computed(() => {
    const overrideHeight = Number(toValue(options.headerHeightTotalOverride));
    if (Number.isFinite(overrideHeight) && overrideHeight > 0) {
      return Math.max(0, Math.ceil(overrideHeight));
    }
    return headerRows.value.length * Math.max(1, Number(toValue(options.headerHeight)) || 1);
  });

  const getLeafColumnsForHeaderCell = (cell: VirtualVisibleHeaderCell) => {
    if (cell.type === "blank") {
      return [] as VirtualTableColumn[];
    }
    return cell.leafColumns;
  };

  const resolveStickyStyle = (columns: VirtualTableColumn[], baseZIndex: number) => {
    if (!columns.length) {
      return {} as CSSProperties;
    }

    const allLeft = columns.every((column) => column.fixed === "left");
    const allRight = columns.every((column) => column.fixed === "right");

    if (allLeft) {
      return {
        position: "sticky",
        left: `${stickyOffsets.value.left[columns[0].key] || 0}px`,
        zIndex: baseZIndex,
      } satisfies CSSProperties;
    }

    if (allRight) {
      return {
        position: "sticky",
        right: `${stickyOffsets.value.right[columns[columns.length - 1].key] || 0}px`,
        zIndex: baseZIndex,
      } satisfies CSSProperties;
    }

    return {} as CSSProperties;
  };

  const getHeaderCellStyle = (cell: VirtualVisibleHeaderCell) => {
    if (cell.type === "blank") {
      return {
        width: `${cell.width}px`,
        minWidth: `${cell.width}px`,
      } satisfies CSSProperties;
    }

    if (cell.type === "placeholder") {
      return {
        width: `${cell.width}px`,
        minWidth: `${cell.width}px`,
        ...resolveStickyStyle(getLeafColumnsForHeaderCell(cell), 5),
      } satisfies CSSProperties;
    }

    const leafs = getLeafColumnsForHeaderCell(cell);
    const headerAlign = cell.column.headerAlign || cell.column.align;
    return {
      width: `${cell.width}px`,
      minWidth: `${cell.width}px`,
      textAlign: headerAlign || "left",
      "--virtual-table-header-cell-justify": resolveColumnJustifyContent(headerAlign),
      ...resolveStickyStyle(leafs, 6),
    } satisfies CSSProperties;
  };

  const resolveColumnJustifyContent = (align?: VirtualTableColumn["align"]) => {
    if (align === "right") {
      return "flex-end";
    }
    if (align === "center") {
      return "center";
    }
    return "flex-start";
  };

  const resolveColumnTextAlign = (align?: VirtualTableColumn["align"]) => {
    return align || "left";
  };

  const getBodyCellStyle = (descriptor: VirtualVisibleColumnDescriptor) => {
    if (descriptor.type === "blank") {
      return {
        width: `${descriptor.width}px`,
        minWidth: `${descriptor.width}px`,
      } satisfies CSSProperties;
    }

    const column = descriptor.column;
    const justifyContent = resolveColumnJustifyContent(column.align);
    const textAlign = resolveColumnTextAlign(column.align);
    return {
      width: `${getColumnWidth(column)}px`,
      minWidth: `${getColumnWidth(column)}px`,
      justifyContent,
      textAlign,
      "--virtual-table-cell-content-justify": justifyContent,
      "--virtual-table-cell-text-align": textAlign,
      "--virtual-table-cell-number-justify": column.align === "right" ? "flex-end" : "space-between",
      ...resolveStickyStyle([column], 3),
    } satisfies CSSProperties;
  };

  const resolveRowKey = (row: T, index: number) => {
    const rowKey = toValue(options.rowKey);
    if (typeof rowKey === "function") {
      return rowKey(row, index);
    }
    return (row as any)?.[rowKey] ?? index;
  };

  const rowIdentitySignature = computed(() => {
    return toValue(options.rows)
      .map((row, index) => String(resolveRowKey(row, index)))
      .join("::");
  });

  watch(
    () => toValue(options.rows).length,
    (rowCount) => {
      heightManager.updateRowCount(rowCount);
      heightVersion.value += 1;
    },
    { immediate: true },
  );

  watch(rowIdentitySignature, () => {
    heightManager.resetRowHeights();
    heightVersion.value += 1;
  }, { immediate: true });

  watch(
    () => Math.max(1, Number(toValue(options.estimatedRowHeight)) || 1),
    (nextEstimatedRowHeight, previousEstimatedRowHeight) => {
      if (nextEstimatedRowHeight === previousEstimatedRowHeight) {
        return;
      }
      if (heightManager.syncEstimatedRowHeight(nextEstimatedRowHeight, { resetMeasured: true })) {
        heightVersion.value += 1;
      }
    },
  );

  const updateViewportMetrics = (target?: HTMLElement | null) => {
    const nextTarget = target || scrollContainerRef.value;
    if (!nextTarget) {
      return;
    }
    const metrics = resolveVirtualTableViewportMetrics({
      clientWidth: nextTarget.clientWidth,
      clientHeight: nextTarget.clientHeight,
    });
    viewportHeight.value = metrics.height;
    viewportWidth.value = metrics.width;
  };

  const { stop: stopScrollContainerResizeObserver } = useResizeObserver(scrollContainerRef, (entries) => {
    const entry = entries[0];
    const target = (entry?.target as HTMLElement | undefined) || scrollContainerRef.value || null;
    if (!target) {
      return;
    }
    const metrics = resolveVirtualTableViewportMetrics({
      clientWidth: target.clientWidth,
      clientHeight: target.clientHeight,
      contentRectWidth: entry?.contentRect?.width,
      contentRectHeight: entry?.contentRect?.height,
    });
    viewportHeight.value = metrics.height;
    viewportWidth.value = metrics.width;
  });

  watch(
    scrollContainerRef,
    (target) => {
      if (!target) {
        return;
      }
      updateViewportMetrics(target);
      if (viewportMetricsFrame !== null) {
        window.cancelAnimationFrame(viewportMetricsFrame);
      }
      viewportMetricsFrame = requestAnimationFrame(() => {
        viewportMetricsFrame = null;
        if (scrollContainerRef.value !== target) {
          return;
        }
        updateViewportMetrics(target);
      });
    },
    { flush: "post" },
  );

  onScopeDispose(() => {
    stopScrollContainerResizeObserver();
    if (viewportMetricsFrame !== null) {
      window.cancelAnimationFrame(viewportMetricsFrame);
      viewportMetricsFrame = null;
    }
  });

  const rowViewportHeight = computed(() => {
    const showFooter = Boolean(toValue(options.showFooter));
    return resolveVirtualTableBodyViewportHeight({
      viewportHeight: viewportHeight.value,
      estimatedRowHeight: toValue(options.estimatedRowHeight),
      headerHeight: headerHeightTotal.value,
      footerHeight: Number(toValue(options.footerHeight) || 0),
      showFooter,
      verticalChromeHeight: showFooter ? 1 : 0,
    });
  });
  const effectiveRowViewportHeight = computed(() => {
    return Math.max(0, rowViewportHeight.value + viewportCompensation.value);
  });

  const scrollUpdateThreshold = computed(() => {
    return resolveVirtualScrollUpdateThreshold({
      estimatedRowHeight: toValue(options.estimatedRowHeight),
      overscan: toValue(options.overscan),
    });
  });

  const resolveCellSpan = (
    row: T,
    rowIndex: number,
    column: VirtualTableColumn,
    columnIndex: number,
  ): VirtualTableCellSpan => {
    const cellSpanResolver = toValue(options.getCellSpan);
    const rawSpan = cellSpanResolver?.(row, rowIndex, column, columnIndex);
    return normalizeVirtualTableColumnSpan({
      column,
      rawSpan,
    });
  };

  const inferredRowSpanBoundaries = computed(() => {
    const rows = toValue(options.rows);
    const cellSpanResolver = toValue(options.getCellSpan);
    if (!rows.length || !leafColumns.value.length || !cellSpanResolver) {
      return null;
    }
    return inferVirtualRowSpanBoundaries({
      rows,
      leafColumns: leafColumns.value,
      resolveCellSpan: (row, rowIndex, column, columnIndex) => {
        const rawSpan = cellSpanResolver(row, rowIndex, column, columnIndex);
        return {
          rowSpan: Math.max(0, Math.floor(Number(rawSpan?.rowSpan ?? 1))),
          colSpan: Math.max(0, Math.floor(Number(rawSpan?.colSpan ?? 1))),
        };
      },
    });
  });

  const virtualWindowBoundaryColumnIndexes = computed(() => {
    return resolveVirtualRowSpanBoundaryColumnIndexes({
      descriptors: visibleColumnDescriptors.value,
    });
  });

  const virtualWindowRowSpanBoundaries = computed(() => {
    const rows = toValue(options.rows);
    return inferVirtualWindowRowSpanBoundaries({
      rows,
      leafColumns: leafColumns.value,
      columnIndexes: virtualWindowBoundaryColumnIndexes.value,
      resolveCellSpan,
    });
  });

  const resolveRowSpanBoundary = (rowIndex: number) => {
    const rows = toValue(options.rows);
    if (rowIndex < 0 || rowIndex >= rows.length) {
      return undefined;
    }

    const rowSpanBoundaryResolver = toValue(options.getRowSpanBoundary);
    if (rowSpanBoundaryResolver) {
      const row = rows[rowIndex];
      if (!row) {
        return undefined;
      }
      return rowSpanBoundaryResolver(row, rowIndex);
    }

    return inferredRowSpanBoundaries.value?.get(rowIndex);
  };

  const resolveVirtualWindowRowSpanBoundary = (rowIndex: number) => {
    if (virtualWindowRowSpanBoundaries.value) {
      return virtualWindowRowSpanBoundaries.value.get(rowIndex);
    }
    return resolveRowSpanBoundary(rowIndex);
  };

  const resolveVisibleSpanPlanBoundary = (rowIndex: number) => {
    return resolveVirtualSpanPlanBoundary({
      rowIndex,
      visibleBoundaryMap: virtualWindowRowSpanBoundaries.value,
      fallbackBoundary: resolveRowSpanBoundary,
    });
  };

  const previewVirtualWindow = (
    previewOptions: {
      viewportHeight?: number;
      scrollTop?: number;
      overscan?: number;
    } = {},
  ) => {
    return resolveVirtualWindow({
      heightManager,
      rowCount: toValue(options.rows).length,
      viewportHeight: previewOptions.viewportHeight ?? effectiveRowViewportHeight.value,
      scrollTop: previewOptions.scrollTop ?? scrollTop.value,
      overscan: previewOptions.overscan ?? toValue(options.overscan),
      getRowSpanBoundary: resolveVirtualWindowRowSpanBoundary,
    });
  };

  const virtualWindow = computed(() => {
    heightVersion.value;
    return previewVirtualWindow();
  });

  const visibleItems = computed(() => {
    heightVersion.value;
    const rows = toValue(options.rows);
    if (!rows.length || virtualWindow.value.end < virtualWindow.value.start) {
      return [] as Array<{ row: T; index: number; key: string | number; top: number }>;
    }

    const items: Array<{ row: T; index: number; key: string | number; top: number }> = [];
    for (let index = virtualWindow.value.start; index <= virtualWindow.value.end; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }
      items.push({
        row,
        index,
        key: resolveRowKey(row, index),
        top: heightManager.getOffset(index),
      });
    }
    return items;
  });

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    updateViewportMetrics(target);
    const nextVirtualWindow = target.scrollTop === scrollTop.value
      ? virtualWindow.value
      : previewVirtualWindow({
        scrollTop: target.scrollTop,
      });
    if (shouldUpdateVirtualScrollOffset({
      currentScrollTop: scrollTop.value,
      nextScrollTop: target.scrollTop,
      threshold: scrollUpdateThreshold.value,
      currentWindow: virtualWindow.value,
      nextWindow: nextVirtualWindow,
      viewportHeight: rowViewportHeight.value,
      estimatedRowHeight: toValue(options.estimatedRowHeight),
      allowImmediateWindowChangeCommit: Boolean(virtualWindowRowSpanBoundaries.value?.size),
    })) {
      scrollTop.value = target.scrollTop;
    }
    if (!enableHorizontalVirtual.value) {
      scrollLeft.value = target.scrollLeft;
      scrollLeftVisual.value = target.scrollLeft;
      return;
    }

    scrollLeftVisual.value = target.scrollLeft;
    if (Math.abs(target.scrollLeft - scrollLeft.value) >= (HORIZONTAL_VIRTUAL_OVERSCAN_PX / 2)) {
      scrollLeft.value = target.scrollLeft;
    }
  };

  const handleRowMeasure = (payload: { rowKey: string | number; rowIndex: number; height: number }) => {
    if (heightManager.setRowHeight(payload.rowKey, payload.height, payload.rowIndex)) {
      heightVersion.value += 1;
    }
  };

  const updateMeasuredRowHeight = (
    payload: { rowKey: string | number; rowIndex: number; height: number },
    options?: {
      mode?: "replace" | "preserve-max";
    },
  ) => {
    if (heightManager.setRowHeight(payload.rowKey, payload.height, payload.rowIndex, options)) {
      heightVersion.value += 1;
    }
  };

  const resetMeasuredRowHeights = () => {
    heightManager.resetRowHeights();
    heightVersion.value += 1;
  };

  const setColumnWidthOverride = (columnKey: string, width: number) => {
    if (!columnKey) {
      return;
    }
    const nextWidth = Math.max(1, Math.floor(Number(width) || 0));
    if (!nextWidth) {
      return;
    }
    columnWidthOverrides.value = {
      ...columnWidthOverrides.value,
      [columnKey]: nextWidth,
    };
  };

  const clearColumnWidthOverride = (columnKey: string) => {
    if (!columnKey || !Object.prototype.hasOwnProperty.call(columnWidthOverrides.value, columnKey)) {
      return;
    }
    const nextOverrides = {
      ...columnWidthOverrides.value,
    };
    delete nextOverrides[columnKey];
    columnWidthOverrides.value = nextOverrides;
  };

  const resolveCellValue = (row: T, column: VirtualTableColumn) => {
    const dataIndex = column.dataIndex || column.key;
    return (row as any)?.[dataIndex];
  };

  const getSpanHeight = (rowIndex: number, rowSpan: number) => {
    const normalizedSpan = Math.max(1, Math.floor(Number(rowSpan) || 1));
    const rowCount = toValue(options.rows).length;
    const start = heightManager.getOffset(rowIndex);
    const end = heightManager.getOffset(Math.min(rowCount, rowIndex + normalizedSpan));
    return Math.max(0, end - start);
  };

  const getSpanWidth = (columnIndex: number, colSpan: number) => {
    const normalizedSpan = Math.max(1, Math.floor(Number(colSpan) || 1));
    const columns = leafColumns.value;
    return columns
      .slice(columnIndex, columnIndex + normalizedSpan)
      .reduce((width, column) => width + getColumnWidth(column), 0);
  };

  const setViewportCompensation = (nextCompensation: number) => {
    const normalized = Math.max(0, Math.ceil(Number(nextCompensation) || 0));
    if (viewportCompensation.value === normalized) {
      return;
    }
    viewportCompensation.value = normalized;
  };

  return {
    scrollContainerRef,
    leafColumns,
    visibleColumnDescriptors,
    virtualWindowBoundaryColumnIndexes,
    headerRows,
    stickyOffsets,
    fixedBoundaryState,
    totalWidth,
    canvasWidth,
    trailingFillerWidth,
    headerHeightTotal,
    virtualWindow,
    visibleItems,
    scrollTop,
    scrollLeft,
    scrollLeftVisual,
    viewportHeight,
    viewportWidth,
    rowViewportHeight,
    effectiveRowViewportHeight,
    getHeaderCellStyle,
    getBodyCellStyle,
    getLeafColumnsForHeaderCell,
    handleScroll,
    handleRowMeasure,
    updateMeasuredRowHeight,
    resetMeasuredRowHeights,
    resolveRowKey,
    resolveCellValue,
    resolveCellSpan,
    resolveRowSpanBoundary,
    resolveVisibleSpanPlanBoundary,
    getSpanHeight,
    getSpanWidth,
    getRowHeight: (rowIndex: number) => heightManager.getRowHeight(rowIndex),
    getRowOffset: (rowIndex: number) => heightManager.getOffset(rowIndex),
    getTotalRowHeight: () => heightManager.getTotalHeight(),
    previewVirtualWindow,
    setViewportCompensation,
    setColumnWidthOverride,
    clearColumnWidthOverride,
  };
};
