import { VirtualTableRowSpanBoundary, VirtualWindow } from "./types";

const ALI_REACT_TABLE_OVERSCAN_PX = 100;

type CreateHeightManagerOptions = {
  rowCount: number;
  estimatedRowHeight: number;
};

type RowHeightUpdateMode = "replace" | "preserve-max";

type ResolveVirtualWindowOptions = {
  heightManager: ReturnType<typeof createHeightManager>;
  rowCount: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
  getRowSpanBoundary?: (rowIndex: number) => VirtualTableRowSpanBoundary | undefined;
};

type ResolveVirtualScrollUpdateThresholdOptions = {
  estimatedRowHeight: number;
  overscan?: number;
};

type ShouldUpdateVirtualScrollOffsetOptions = {
  currentScrollTop: number;
  nextScrollTop: number;
  threshold: number;
  currentWindow?: VirtualWindow;
  nextWindow?: VirtualWindow;
  viewportHeight?: number;
  estimatedRowHeight?: number;
  allowImmediateWindowChangeCommit?: boolean;
};

export const resolveVerticalOverscanSize = (estimatedRowHeight: number, overscan?: number) => {
  const normalizedOverscan = Math.max(0, Number(overscan) || 0);
  if (normalizedOverscan <= 0) {
    return 0;
  }
  const normalizedEstimatedRowHeight = Math.max(1, Number(estimatedRowHeight) || 1);
  return Math.max(
    normalizedEstimatedRowHeight,
    Math.min(
      normalizedOverscan * normalizedEstimatedRowHeight,
      ALI_REACT_TABLE_OVERSCAN_PX,
    ),
  );
};

export const createHeightManager = (options: CreateHeightManagerOptions) => {
  let estimatedRowHeight = Math.max(1, Number(options.estimatedRowHeight) || 1);
  let rowCount = Math.max(0, Number(options.rowCount) || 0);
  let dirtyFrom = 0;
  let heights = Array.from({ length: rowCount }, () => estimatedRowHeight);
  let measured = Array.from({ length: rowCount }, () => false);
  let offsets = Array.from({ length: rowCount + 1 }, (_, index) => index * estimatedRowHeight);

  const ensureOffsetCache = () => {
    if (!offsets.length || offsets.length !== rowCount + 1) {
      offsets = Array.from({ length: rowCount + 1 }, () => 0);
      dirtyFrom = 0;
    }

    if (dirtyFrom >= rowCount) {
      offsets[rowCount] = offsets[rowCount] ?? heights.reduce((sum, height) => sum + height, 0);
      return;
    }

    const start = Math.max(0, dirtyFrom);
    if (start === 0) {
      offsets[0] = 0;
    }

    for (let index = start; index < rowCount; index += 1) {
      offsets[index + 1] = offsets[index] + (heights[index] ?? estimatedRowHeight);
    }

    dirtyFrom = rowCount;
  };

  const updateRowCount = (nextRowCount: number) => {
    const normalized = Math.max(0, Number(nextRowCount) || 0);
    if (normalized === rowCount) {
      return;
    }

    rowCount = normalized;
    heights = Array.from({ length: rowCount }, (_, index) => heights[index] ?? estimatedRowHeight);
    measured = Array.from({ length: rowCount }, (_, index) => measured[index] ?? false);
    offsets = Array.from({ length: rowCount + 1 }, (_, index) => offsets[index] ?? (index * estimatedRowHeight));
    dirtyFrom = 0;
  };

  const resetRowHeights = () => {
    heights = Array.from({ length: rowCount }, () => estimatedRowHeight);
    measured = Array.from({ length: rowCount }, () => false);
    offsets = Array.from({ length: rowCount + 1 }, (_, index) => index * estimatedRowHeight);
    dirtyFrom = 0;
  };

  const syncEstimatedRowHeight = (
    nextEstimatedRowHeight: number,
    options?: {
      resetMeasured?: boolean;
    },
  ) => {
    const normalizedEstimatedRowHeight = Math.max(1, Number(nextEstimatedRowHeight) || 1);
    const shouldResetMeasured = Boolean(options?.resetMeasured);
    const estimateChanged = normalizedEstimatedRowHeight !== estimatedRowHeight;

    if (!estimateChanged && !shouldResetMeasured) {
      return false;
    }

    estimatedRowHeight = normalizedEstimatedRowHeight;

    if (shouldResetMeasured) {
      resetRowHeights();
      return true;
    }

    let changed = estimateChanged;
    for (let index = 0; index < rowCount; index += 1) {
      if (measured[index]) {
        continue;
      }
      if (heights[index] !== estimatedRowHeight) {
        heights[index] = estimatedRowHeight;
        changed = true;
      }
    }

    if (changed) {
      offsets = Array.from({ length: rowCount + 1 }, (_, index) => offsets[index] ?? (index * estimatedRowHeight));
      dirtyFrom = 0;
    }

    return changed;
  };

  const setRowHeight = (
    _rowKey: string | number,
    height: number,
    index: number,
    options?: {
      mode?: RowHeightUpdateMode;
    },
  ) => {
    if (index < 0 || index >= rowCount) {
      return false;
    }

    const normalizedHeight = Math.max(1, Math.round(Number(height) || estimatedRowHeight));
    const currentHeight = heights[index] ?? estimatedRowHeight;
    const nextHeight = options?.mode === "preserve-max" && measured[index]
      ? Math.max(currentHeight, normalizedHeight)
      : normalizedHeight;
    measured[index] = true;

    if (currentHeight === nextHeight) {
      return false;
    }

    heights[index] = nextHeight;
    dirtyFrom = Math.min(dirtyFrom, index);
    return true;
  };

  const getRowHeight = (index: number) => {
    if (index < 0 || index >= rowCount) {
      return estimatedRowHeight;
    }
    return heights[index] ?? estimatedRowHeight;
  };

  const getOffset = (index: number) => {
    ensureOffsetCache();
    const normalized = Math.max(0, Math.min(index, rowCount));
    return offsets[normalized] ?? 0;
  };

  const getTotalHeight = () => {
    ensureOffsetCache();
    return offsets[rowCount] ?? 0;
  };

  const findIndexAtOffset = (offset: number) => {
    ensureOffsetCache();

    if (rowCount <= 0) {
      return 0;
    }

    const normalizedOffset = Math.max(0, Math.min(offset, getTotalHeight()));
    let left = 0;
    let right = rowCount - 1;

    while (left <= right) {
      const middle = Math.floor((left + right) / 2);
      const start = offsets[middle];
      const end = offsets[middle + 1];

      if (normalizedOffset < start) {
        right = middle - 1;
        continue;
      }

      if (normalizedOffset >= end) {
        left = middle + 1;
        continue;
      }

      if (normalizedOffset === start && middle > 0) {
        return middle - 1;
      }

      return middle;
    }

    return Math.max(0, Math.min(left, rowCount - 1));
  };

  return {
    get estimatedRowHeight() {
      return estimatedRowHeight;
    },
    setRowHeight,
    getRowHeight,
    getOffset,
    getTotalHeight,
    findIndexAtOffset,
    updateRowCount,
    resetRowHeights,
    syncEstimatedRowHeight,
  };
};

export const resolveVirtualScrollUpdateThreshold = (options: ResolveVirtualScrollUpdateThresholdOptions) => {
  const normalizedOverscan = Math.max(0, Number(options.overscan) || 0);
  if (normalizedOverscan <= 0) {
    return 1;
  }
  const overscanSize = resolveVerticalOverscanSize(options.estimatedRowHeight, normalizedOverscan);
  return Math.min(50, Math.max(1, Math.floor(overscanSize / 2)));
};

export const shouldUpdateVirtualScrollOffset = (options: ShouldUpdateVirtualScrollOffsetOptions) => {
  const currentScrollTop = Math.max(0, Number(options.currentScrollTop) || 0);
  const nextScrollTop = Math.max(0, Number(options.nextScrollTop) || 0);
  const threshold = Math.max(1, Number(options.threshold) || 1);
  const estimatedRowHeight = Math.max(0, Number(options.estimatedRowHeight) || 0);

  if (nextScrollTop === currentScrollTop) {
    return false;
  }

  if (nextScrollTop === 0) {
    return true;
  }

  if (Math.abs(nextScrollTop - currentScrollTop) >= threshold) {
    return true;
  }

  const currentWindow = options.currentWindow;
  const nextWindow = options.nextWindow;
  const allowImmediateWindowChangeCommit = Boolean(options.allowImmediateWindowChangeCommit);
  const viewportHeight = Math.max(0, Number(options.viewportHeight) || 0);
  if (!currentWindow || viewportHeight <= 0) {
    return false;
  }

  if (
    allowImmediateWindowChangeCommit
    && nextWindow
    && (
      nextWindow.start !== currentWindow.start
      || nextWindow.end !== currentWindow.end
    )
  ) {
    return true;
  }

  const renderedTop = Math.max(0, Number(currentWindow.offsetTop) || 0);
  const totalHeight = Math.max(renderedTop, Number(currentWindow.totalHeight) || 0);
  const renderedBottom = Math.max(renderedTop, totalHeight - (Number(currentWindow.offsetBottom) || 0));
  const nextViewportBottom = nextScrollTop + Math.max(viewportHeight - 1, 0);

  if (nextScrollTop < renderedTop || nextViewportBottom > renderedBottom) {
    return true;
  }

  const availableOverscan = Math.max(0, renderedBottom - renderedTop - viewportHeight);
  const edgeBuffer = Math.max(0, Math.min(threshold, Math.floor(availableOverscan / 2)));
  const rowAwareEdgeBuffer = Math.max(
    edgeBuffer,
    Math.min(
      Math.max(threshold, viewportHeight),
      estimatedRowHeight,
    ),
  );

  if (rowAwareEdgeBuffer <= 0) {
    return false;
  }

  const currentViewportBottom = currentScrollTop + Math.max(viewportHeight - 1, 0);
  const scrollDelta = nextScrollTop - currentScrollTop;
  const remainingTopBuffer = Math.max(0, currentScrollTop - renderedTop);
  const remainingBottomBuffer = Math.max(0, renderedBottom - currentViewportBottom);
  const directionalBufferCommitDistance = (remainingBuffer: number) => {
    return Math.max(1, Math.floor(remainingBuffer / 2));
  };

  if (
    scrollDelta > 0
    && renderedBottom < totalHeight
    && remainingBottomBuffer > rowAwareEdgeBuffer
    && scrollDelta >= directionalBufferCommitDistance(remainingBottomBuffer)
  ) {
    return true;
  }

  if (
    scrollDelta < 0
    && remainingTopBuffer > rowAwareEdgeBuffer
    && Math.abs(scrollDelta) >= directionalBufferCommitDistance(remainingTopBuffer)
  ) {
    return true;
  }

  if (nextScrollTop - renderedTop < rowAwareEdgeBuffer) {
    return renderedTop > 0;
  }

  if (renderedBottom - nextViewportBottom < rowAwareEdgeBuffer) {
    return renderedBottom < totalHeight;
  }

  return false;
};

export const resolveVirtualWindow = (options: ResolveVirtualWindowOptions): VirtualWindow => {
  const rowCount = Math.max(0, Number(options.rowCount) || 0);
  const viewportHeight = Math.max(0, Number(options.viewportHeight) || 0);
  const scrollTop = Math.max(0, Number(options.scrollTop) || 0);
  const { heightManager } = options;
  const overscanSize = resolveVerticalOverscanSize(heightManager.estimatedRowHeight, options.overscan);

  heightManager.updateRowCount(rowCount);

  if (!rowCount) {
    return {
      start: 0,
      end: -1,
      offsetTop: 0,
      offsetBottom: 0,
      totalHeight: 0,
    };
  }

  const visibleStart = heightManager.findIndexAtOffset(scrollTop);
  const visibleEnd = heightManager.findIndexAtOffset(scrollTop + Math.max(viewportHeight - 1, 0));
  const expandRangeByOverscan = (
    start: number,
    end: number,
    direction: "both" | "up" | "down" = "both",
  ) => {
    let nextStart = start;
    let nextEnd = end;

    if (direction === "both" || direction === "up") {
      let overscannedUpwards = 0;
      while (nextStart > 0 && overscannedUpwards < overscanSize) {
        nextStart -= 1;
        overscannedUpwards += heightManager.getRowHeight(nextStart);
      }
    }

    if (direction === "both" || direction === "down") {
      let overscannedDownwards = 0;
      while (nextEnd < rowCount - 1 && overscannedDownwards < overscanSize) {
        nextEnd += 1;
        overscannedDownwards += heightManager.getRowHeight(nextEnd);
      }
    }

    return {
      start: nextStart,
      end: nextEnd,
    };
  };

  let { start, end } = expandRangeByOverscan(visibleStart, visibleEnd);

  const normalizeBoundary = (boundary?: VirtualTableRowSpanBoundary) => {
    if (!boundary) {
      return null;
    }

    const normalizedStart = Math.max(0, Math.min(rowCount - 1, Number(boundary.start) || 0));
    const normalizedEnd = Math.max(normalizedStart, Math.min(rowCount - 1, Number(boundary.end) || normalizedStart));
    return {
      start: normalizedStart,
      end: normalizedEnd,
    } satisfies VirtualTableRowSpanBoundary;
  };

  const { getRowSpanBoundary } = options;
  if (getRowSpanBoundary) {
    const baseStart = start;
    const baseEnd = end;
    const baseWindowRowCount = Math.max(1, baseEnd - baseStart + 1);
    const baseWindowRowBudget = Math.max(
      1,
      Math.ceil(
        (Math.max(1, viewportHeight) + (overscanSize * 2))
        / Math.max(1, heightManager.estimatedRowHeight),
      ),
    );
    const mergeExpansionRowBudget = Math.max(8, baseWindowRowBudget * 2);
    const mergeBoundarySnapRowBudget = Math.max(
      baseWindowRowBudget,
      Math.min(baseWindowRowCount, baseWindowRowBudget + 2),
    );
    const mergeBoundarySnapDistance = Math.max(
      2,
      Math.min(mergeExpansionRowBudget, mergeBoundarySnapRowBudget + 1),
    );
    const wouldExceedMergeBudget = (nextStart: number, nextEnd: number) => {
      const expansionRows = Math.max(0, baseStart - nextStart) + Math.max(0, nextEnd - baseEnd);
      return expansionRows > mergeExpansionRowBudget;
    };
    const resolveBoundaryGaps = (boundary: VirtualTableRowSpanBoundary) => {
      return {
        startGap: Math.max(0, start - boundary.start),
        endGap: Math.max(0, boundary.end - end),
      };
    };
    const canFullyExpandBoundary = (boundary: VirtualTableRowSpanBoundary) => {
      const { startGap, endGap } = resolveBoundaryGaps(boundary);
      return startGap <= mergeBoundarySnapDistance && endGap <= mergeBoundarySnapDistance;
    };
    const shouldKeepBoundaryClippedToBaseWindow = (boundary: VirtualTableRowSpanBoundary) => {
      const boundaryStartsAtBaseTail = boundary.start === baseEnd;
      const boundaryEndsAtBaseHead = boundary.end === baseStart;
      const { startGap } = resolveBoundaryGaps(boundary);
      return (
        (boundaryStartsAtBaseTail && boundary.end > baseEnd)
        || (boundaryEndsAtBaseHead && startGap <= 1)
      );
    };
    const shouldForceOneSidedBoundaryClip = (boundary: VirtualTableRowSpanBoundary) => {
      const { startGap, endGap } = resolveBoundaryGaps(boundary);
      if (startGap <= 0 && endGap <= 0) {
        return false;
      }
      const boundaryRowCount = Math.max(1, boundary.end - boundary.start + 1);
      return boundaryRowCount > mergeExpansionRowBudget;
    };
    const resolveOneSidedBoundarySnap = (boundary: VirtualTableRowSpanBoundary) => {
      const { startGap, endGap } = resolveBoundaryGaps(boundary);
      const startExpansionRows = Math.max(0, baseStart - boundary.start);
      const endExpansionRows = Math.max(0, boundary.end - baseEnd);
      const boundaryStartAtBaseTail = boundary.start === baseEnd;
      const boundaryEndAtBaseHead = boundary.end === baseStart;
      const boundaryStartAlreadyVisible = boundary.start >= start && boundary.start <= end;
      const boundaryEndAlreadyVisible = boundary.end >= start && boundary.end <= end;
      const canUseBudgetDrivenStartSnap = !boundaryEndAlreadyVisible;
      const canUseBudgetDrivenEndSnap = !boundaryStartAlreadyVisible;
      const canSnapStart =
        startGap > 0 &&
        !(boundaryEndAtBaseHead && startGap <= 1) &&
        (
          startGap <= mergeBoundarySnapDistance
          || (canUseBudgetDrivenStartSnap && startExpansionRows <= mergeExpansionRowBudget)
        ) &&
        !wouldExceedMergeBudget(boundary.start, end);
      const canSnapEnd =
        endGap > 0 &&
        !boundaryStartAtBaseTail &&
        (
          endGap <= mergeBoundarySnapDistance
          || (canUseBudgetDrivenEndSnap && endExpansionRows <= mergeExpansionRowBudget)
        ) &&
        !wouldExceedMergeBudget(start, boundary.end);

      if (canSnapStart && canSnapEnd) {
        if (startGap <= endGap) {
          return {
            start: boundary.start,
            end,
          };
        }

        return {
          start,
          end: boundary.end,
        };
      }

      if (canSnapStart) {
        return {
          start: boundary.start,
          end,
        };
      }

      if (canSnapEnd) {
        return {
          start,
          end: boundary.end,
        };
      }

      return null;
    };

    let changed = true;
    while (changed) {
      changed = false;
      const startBeforeBoundaryExpansion = start;
      const endBeforeBoundaryExpansion = end;
      let expandedUpwards = false;
      let expandedDownwards = false;
      let shouldSkipOverscanUp = false;
      let shouldSkipOverscanDown = false;
      let shouldTrimStartToVisibleStart = false;
      const processedBoundaryKeys = new Set<string>();

      for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
        const boundary = normalizeBoundary(getRowSpanBoundary(rowIndex));
        if (!boundary) {
          continue;
        }
        const boundaryKey = `${boundary.start}:${boundary.end}`;
        if (processedBoundaryKeys.has(boundaryKey)) {
          continue;
        }
        processedBoundaryKeys.add(boundaryKey);

        const nextStart = Math.min(start, boundary.start);
        const nextEnd = Math.max(end, boundary.end);
        if (shouldKeepBoundaryClippedToBaseWindow(boundary)) {
          continue;
        }
        if (
          shouldForceOneSidedBoundaryClip(boundary)
          || !canFullyExpandBoundary(boundary)
          || wouldExceedMergeBudget(nextStart, nextEnd)
        ) {
          const forcedOneSidedBoundaryClip = shouldForceOneSidedBoundaryClip(boundary);
          const snappedWindow = resolveOneSidedBoundarySnap(boundary);
          if (!snappedWindow) {
            continue;
          }

          if (snappedWindow.start < start) {
            start = snappedWindow.start;
            expandedUpwards = true;
            changed = true;
            if (!forcedOneSidedBoundaryClip) {
              shouldSkipOverscanUp = false;
            }
          }
          if (snappedWindow.end > end) {
            end = snappedWindow.end;
            expandedDownwards = true;
            changed = true;
            shouldSkipOverscanDown = forcedOneSidedBoundaryClip;
            shouldTrimStartToVisibleStart = forcedOneSidedBoundaryClip;
          }
          continue;
        }

        if (nextStart < start) {
          start = nextStart;
          expandedUpwards = true;
          changed = true;
          shouldSkipOverscanUp = false;
        }
        if (nextEnd > end) {
          end = nextEnd;
          expandedDownwards = true;
          changed = true;
          shouldSkipOverscanDown = false;
        }
      }

      if (expandedUpwards && !shouldSkipOverscanUp) {
        const overscannedWindow = expandRangeByOverscan(start, end, "up");
        if (!wouldExceedMergeBudget(overscannedWindow.start, end)) {
          start = overscannedWindow.start;
          changed = true;
        }
      }
      if (expandedDownwards && !shouldSkipOverscanDown) {
        const overscannedWindow = expandRangeByOverscan(start, end, "down");
        if (!wouldExceedMergeBudget(start, overscannedWindow.end)) {
          end = overscannedWindow.end;
          changed = true;
        }
      }

      if (shouldTrimStartToVisibleStart && start < visibleStart) {
        start = visibleStart;
        changed = true;
      }

      if (start === startBeforeBoundaryExpansion && end === endBeforeBoundaryExpansion) {
        break;
      }
    }
  }

  const offsetTop = heightManager.getOffset(start);
  const totalHeight = heightManager.getTotalHeight();
  const offsetBottom = Math.max(0, totalHeight - heightManager.getOffset(end + 1));

  return {
    start,
    end,
    offsetTop,
    offsetBottom,
    totalHeight,
  };
};
