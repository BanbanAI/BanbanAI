import {
  VirtualPlannedCellSpan,
  VirtualTableCellSpan,
  VirtualTableColumn,
  VirtualTableRowSpanBoundary,
  VirtualVisibleColumnDescriptor,
} from "./types";

type BuildVirtualSpanPlanOptions<T> = {
  allRows?: T[];
  rows: Array<{
    row: T;
    rowIndex: number;
  }>;
  descriptors: VirtualVisibleColumnDescriptor[];
  rowLimit: number;
  resolveRowSpanBoundary?: (rowIndex: number) => VirtualTableRowSpanBoundary | undefined;
  resolveCarryInBoundary?: (rowIndex: number) => VirtualTableRowSpanBoundary | undefined;
  resolveCellSpan: (
    row: T,
    rowIndex: number,
    column: VirtualTableColumn,
    columnIndex: number,
  ) => VirtualTableCellSpan;
};

type SpanRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const DEFAULT_PLANNED_SPAN: VirtualPlannedCellSpan = {
  rowSpan: 1,
  colSpan: 1,
  hidden: false,
};

const HIDDEN_PLANNED_SPAN: VirtualPlannedCellSpan = {
  rowSpan: 0,
  colSpan: 0,
  hidden: true,
};

const UTILITY_COLUMN_KINDS = new Set(["selection", "index", "action"]);

class VirtualSpanManager {
  private rects: SpanRect[] = [];

  testSkip(rowIndex: number, columnIndex: number) {
    return this.rects.some((rect) => (
      rect.left <= columnIndex
      && columnIndex < rect.right
      && rect.top <= rowIndex
      && rowIndex < rect.bottom
    ));
  }

  stripUpwards(rowIndex: number) {
    this.rects = this.rects.filter((rect) => rect.bottom > rowIndex);
  }

  add(rowIndex: number, columnIndex: number, colSpan: number, rowSpan: number) {
    this.rects.push({
      left: columnIndex,
      right: columnIndex + colSpan,
      top: rowIndex,
      bottom: rowIndex + rowSpan,
    });
  }
}

const buildVisibleColumnRunLimits = (descriptors: VirtualVisibleColumnDescriptor[]) => {
  const limits = new Map<string, number>();
  let currentRun: Array<{ key: string; columnIndex: number }> = [];
  let currentRunZone: "blank" | "left" | "center" | "right" | null = null;

  const resolveDescriptorZone = (descriptor: VirtualVisibleColumnDescriptor) => {
    if (descriptor.type === "blank") {
      return "blank" as const;
    }
    if (descriptor.column.fixed === "left") {
      return "left" as const;
    }
    if (descriptor.column.fixed === "right") {
      return "right" as const;
    }
    return "center" as const;
  };

  const flushRun = () => {
    if (!currentRun.length) {
      currentRunZone = null;
      return;
    }
    const runLimit = currentRun[currentRun.length - 1].columnIndex + 1;
    currentRun.forEach((item) => {
      limits.set(item.key, runLimit);
    });
    currentRun = [];
    currentRunZone = null;
  };

  descriptors.forEach((descriptor) => {
    if (descriptor.type === "blank") {
      flushRun();
      return;
    }

    const descriptorZone = resolveDescriptorZone(descriptor);
    if (currentRunZone && currentRunZone !== descriptorZone) {
      flushRun();
    }

    currentRunZone = descriptorZone;
    currentRun.push({
      key: descriptor.key,
      columnIndex: descriptor.columnIndex,
    });
  });
  flushRun();

  return limits;
};

const normalizeSpan = (
  rawSpan: VirtualTableCellSpan,
  rowIndex: number,
  rowLimit: number,
  columnIndex: number,
  columnLimit: number,
): VirtualPlannedCellSpan => {
  const maxRowSpan = Math.max(0, rowLimit - rowIndex);
  const maxColSpan = Math.max(0, columnLimit - columnIndex);
  const rowSpan = Math.min(Math.max(0, Math.floor(Number(rawSpan?.rowSpan ?? 1))), maxRowSpan);
  const colSpan = Math.min(Math.max(0, Math.floor(Number(rawSpan?.colSpan ?? 1))), maxColSpan);

  if (rowSpan === 0 || colSpan === 0) {
    return HIDDEN_PLANNED_SPAN;
  }

  return {
    rowSpan,
    colSpan,
    hidden: false,
  };
};

type CarryInRootSpan<T> = {
  rootRow: T;
  rootRowIndex: number;
  rawSpan: VirtualTableCellSpan;
};

const buildCarryInRootSpanMap = <T>(
  options: BuildVirtualSpanPlanOptions<T>,
) => {
  const carryInRootSpanMap = new Map<string, CarryInRootSpan<T>>();
  const firstVisibleRow = options.rows[0];
  const allRows = options.allRows || [];

  if (!firstVisibleRow || !allRows.length || !options.resolveRowSpanBoundary) {
    return carryInRootSpanMap;
  }

  const firstVisibleRowIndex = firstVisibleRow.rowIndex;
  const visibleBoundary = options.resolveRowSpanBoundary?.(firstVisibleRowIndex);
  const fallbackCarryInBoundary = options.resolveCarryInBoundary?.(firstVisibleRowIndex);
  const hasVisibleBusinessDescriptor = options.descriptors.some((descriptor) => {
    return descriptor.type === "normal"
      && !UTILITY_COLUMN_KINDS.has(String(descriptor.column.meta?.kind || ""));
  });

  const buildSearchRanges = (
    descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>,
  ) => {
    const ranges: Array<{ start: number; end: number }> = [];
    const appendRange = (boundary?: VirtualTableRowSpanBoundary) => {
      if (!boundary || boundary.start >= firstVisibleRowIndex) {
        return;
      }
      const nextRange = {
        start: Math.max(0, Math.min(boundary.start, firstVisibleRowIndex - 1)),
        end: Math.max(0, Math.min(boundary.end, firstVisibleRowIndex - 1)),
      };
      if (nextRange.end < nextRange.start) {
        return;
      }
      const rangeKey = `${nextRange.start}:${nextRange.end}`;
      if (ranges.some((range) => `${range.start}:${range.end}` === rangeKey)) {
        return;
      }
      ranges.push(nextRange);
    };

    appendRange(visibleBoundary);
    if (
      hasVisibleBusinessDescriptor
      && UTILITY_COLUMN_KINDS.has(String(descriptor.column.meta?.kind || ""))
    ) {
      appendRange(fallbackCarryInBoundary);
    }
    return ranges;
  };

  for (const descriptor of options.descriptors) {
    if (descriptor.type === "blank") {
      continue;
    }

    for (const searchRange of buildSearchRanges(descriptor)) {
      for (let candidateRowIndex = searchRange.end; candidateRowIndex >= searchRange.start; candidateRowIndex -= 1) {
        const candidateRow = allRows[candidateRowIndex];
        if (!candidateRow) {
          continue;
        }

        const candidateSpan = options.resolveCellSpan(
          candidateRow,
          candidateRowIndex,
          descriptor.column,
          descriptor.columnIndex,
        );
        const rowSpan = Math.max(0, Math.floor(Number(candidateSpan?.rowSpan ?? 1)));
        const distanceFromCandidate = firstVisibleRowIndex - candidateRowIndex;

        if (rowSpan <= distanceFromCandidate) {
          continue;
        }

        const colSpan = Math.max(0, Math.floor(Number(candidateSpan?.colSpan ?? 1)));
        if (rowSpan <= 1 && colSpan <= 1) {
          continue;
        }

        carryInRootSpanMap.set(descriptor.key, {
          rootRow: candidateRow,
          rootRowIndex: candidateRowIndex,
          rawSpan: candidateSpan,
        });
        break;
      }

      if (carryInRootSpanMap.has(descriptor.key)) {
        break;
      }
    }
  }

  return carryInRootSpanMap;
};

export const buildVirtualSpanPlan = <T>(options: BuildVirtualSpanPlanOptions<T>) => {
  const spanManager = new VirtualSpanManager();
  const columnRunLimits = buildVisibleColumnRunLimits(options.descriptors);
  const carryInRootSpanMap = buildCarryInRootSpanMap(options);
  const firstVisibleRowIndex = options.rows[0]?.rowIndex ?? -1;
  const rowPlans = new Map<number, Map<string, VirtualPlannedCellSpan>>();

  for (const rowItem of options.rows) {
    spanManager.stripUpwards(rowItem.rowIndex);
    const cellPlans = new Map<string, VirtualPlannedCellSpan>();

    for (const descriptor of options.descriptors) {
      if (descriptor.type === "blank") {
        cellPlans.set(descriptor.key, DEFAULT_PLANNED_SPAN);
        continue;
      }

      if (spanManager.testSkip(rowItem.rowIndex, descriptor.columnIndex)) {
        cellPlans.set(descriptor.key, HIDDEN_PLANNED_SPAN);
        continue;
      }

      const carryInRootSpan = rowItem.rowIndex === firstVisibleRowIndex
        ? carryInRootSpanMap.get(descriptor.key)
        : undefined;
      if (carryInRootSpan) {
        const columnLimit = columnRunLimits.get(descriptor.key) ?? (descriptor.columnIndex + 1);
        const rowOffset = rowItem.rowIndex - carryInRootSpan.rootRowIndex;
        const normalizedSpan = normalizeSpan(
          {
            rowSpan: Math.max(0, Math.floor(Number(carryInRootSpan.rawSpan.rowSpan || 0)) - rowOffset),
            colSpan: carryInRootSpan.rawSpan.colSpan,
          },
          rowItem.rowIndex,
          options.rowLimit,
          descriptor.columnIndex,
          columnLimit,
        );

        if (!normalizedSpan.hidden && (normalizedSpan.rowSpan > 1 || normalizedSpan.colSpan > 1)) {
          cellPlans.set(descriptor.key, normalizedSpan);
          spanManager.add(rowItem.rowIndex, descriptor.columnIndex, normalizedSpan.colSpan, normalizedSpan.rowSpan);
          continue;
        }
      }

      const columnLimit = columnRunLimits.get(descriptor.key) ?? (descriptor.columnIndex + 1);
      const normalizedSpan = normalizeSpan(
        options.resolveCellSpan(rowItem.row, rowItem.rowIndex, descriptor.column, descriptor.columnIndex),
        rowItem.rowIndex,
        options.rowLimit,
        descriptor.columnIndex,
        columnLimit,
      );

      cellPlans.set(descriptor.key, normalizedSpan);
      if (!normalizedSpan.hidden && (normalizedSpan.rowSpan > 1 || normalizedSpan.colSpan > 1)) {
        spanManager.add(rowItem.rowIndex, descriptor.columnIndex, normalizedSpan.colSpan, normalizedSpan.rowSpan);
      }
    }

    rowPlans.set(rowItem.rowIndex, cellPlans);
  }

  return {
    getCellSpan(rowIndex: number, descriptorKey: string): VirtualPlannedCellSpan {
      return rowPlans.get(rowIndex)?.get(descriptorKey) || DEFAULT_PLANNED_SPAN;
    },
  };
};
