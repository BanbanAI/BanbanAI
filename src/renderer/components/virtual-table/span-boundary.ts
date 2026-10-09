import {
  VirtualTableCellSpan,
  VirtualTableColumn,
  VirtualTableRowSpanBoundary,
  VirtualVisibleColumnDescriptor,
} from "./types";

type InferVirtualRowSpanBoundariesOptions<T> = {
  rows: T[];
  leafColumns: VirtualTableColumn[];
  columnIndexes?: number[];
  resolveCellSpan: (
    row: T,
    rowIndex: number,
    column: VirtualTableColumn,
    columnIndex: number,
  ) => VirtualTableCellSpan;
};

type ResolveVirtualRowSpanBoundaryColumnIndexesOptions = {
  descriptors: VirtualVisibleColumnDescriptor[];
};

type ResolveVirtualSpanPlanBoundaryOptions = {
  rowIndex: number;
  visibleBoundaryMap?: Map<number, VirtualTableRowSpanBoundary> | null;
  fallbackBoundary?: (rowIndex: number) => VirtualTableRowSpanBoundary | undefined;
};

const UTILITY_BOUNDARY_COLUMN_KINDS = new Set(["selection", "index", "action"]);

const mergeRowSpanBoundary = (
  previous: VirtualTableRowSpanBoundary | undefined,
  next: VirtualTableRowSpanBoundary,
): VirtualTableRowSpanBoundary => {
  if (!previous) {
    return next;
  }
  return {
    start: Math.min(previous.start, next.start),
    end: Math.max(previous.end, next.end),
  };
};

export const inferVirtualRowSpanBoundaries = <T>(
  options: InferVirtualRowSpanBoundariesOptions<T>,
) => {
  const boundaryMap = new Map<number, VirtualTableRowSpanBoundary>();
  const rows = options.rows || [];
  const columns = options.leafColumns || [];
  const lastRowIndex = rows.length - 1;
  const activeColumnIndexes = options.columnIndexes?.length
    ? new Set(
      options.columnIndexes
        .map((columnIndex) => Math.floor(Number(columnIndex)))
        .filter((columnIndex) => columnIndex >= 0 && columnIndex < columns.length),
    )
    : null;

  if (lastRowIndex < 0 || !columns.length) {
    return boundaryMap;
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) {
      continue;
    }

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      if (activeColumnIndexes && !activeColumnIndexes.has(columnIndex)) {
        continue;
      }
      const column = columns[columnIndex];
      const rawSpan = options.resolveCellSpan(row, rowIndex, column, columnIndex);
      const rowSpan = Math.max(0, Math.floor(Number(rawSpan?.rowSpan ?? 1)));
      if (rowSpan <= 1) {
        continue;
      }

      const boundary = {
        start: rowIndex,
        end: Math.min(lastRowIndex, rowIndex + rowSpan - 1),
      } satisfies VirtualTableRowSpanBoundary;

      for (let coveredRowIndex = boundary.start; coveredRowIndex <= boundary.end; coveredRowIndex += 1) {
        boundaryMap.set(
          coveredRowIndex,
          mergeRowSpanBoundary(boundaryMap.get(coveredRowIndex), boundary),
        );
      }
    }
  }

  return boundaryMap;
};

export const inferVirtualWindowRowSpanBoundaries = <T>(
  options: InferVirtualRowSpanBoundariesOptions<T>,
) => {
  const rows = options.rows || [];
  const columns = options.leafColumns || [];
  if (!rows.length || !columns.length) {
    return null as Map<number, VirtualTableRowSpanBoundary> | null;
  }

  if (Array.isArray(options.columnIndexes) && options.columnIndexes.length === 0) {
    return new Map<number, VirtualTableRowSpanBoundary>();
  }

  return inferVirtualRowSpanBoundaries(options);
};

export const resolveVirtualSpanPlanBoundary = (
  options: ResolveVirtualSpanPlanBoundaryOptions,
) => {
  if (options.visibleBoundaryMap) {
    return options.visibleBoundaryMap.get(options.rowIndex);
  }

  if (options.visibleBoundaryMap instanceof Map) {
    return undefined;
  }

  return options.fallbackBoundary?.(options.rowIndex);
};

export const resolveVirtualRowSpanBoundaryColumnIndexes = (
  options: ResolveVirtualRowSpanBoundaryColumnIndexesOptions,
) => {
  const indexes = options.descriptors
    .filter((descriptor): descriptor is Extract<VirtualVisibleColumnDescriptor, { type: "normal" }> => {
      if (descriptor.type !== "normal") {
        return false;
      }
      return !UTILITY_BOUNDARY_COLUMN_KINDS.has(String(descriptor.column.meta?.kind || ""));
    })
    .map((descriptor) => descriptor.columnIndex);

  return Array.from(new Set(indexes));
};
