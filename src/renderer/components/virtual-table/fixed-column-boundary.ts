import { flattenVirtualColumns, getColumnWidth } from "./column-utils";
import type { VirtualTableColumn } from "./types";

type ResolveVirtualFixedColumnBoundaryStateOptions = {
  totalWidth: number;
  viewportWidth: number;
  scrollLeft: number;
  hasFixedLeft: boolean;
  hasFixedRight: boolean;
  epsilon?: number;
};

export type VirtualFixedColumnBoundaryState = {
  hasHorizontalOverflow: boolean;
  leftHasOverlap: boolean;
  rightHasOverlap: boolean;
  leftAtStart: boolean;
  rightAtEnd: boolean;
  maxScrollLeft: number;
  scrollLeft: number;
};

type ResolveEffectiveVirtualFixedColumnsOptions = {
  columns: VirtualTableColumn[];
  viewportWidth: number;
};

const PERSISTENT_LEFT_FIXED_COLUMN_KINDS = new Set(["index", "selection"]);
const MIN_CENTER_VIEWPORT_WIDTH_FOR_LEFT_FIXED = 1;

const shouldPreserveLeftFixedColumn = (column: VirtualTableColumn) => {
  return column.fixed === "left"
    && PERSISTENT_LEFT_FIXED_COLUMN_KINDS.has(String(column.meta?.kind || ""));
};

const hasCancellableLeftFixedColumns = (columns: VirtualTableColumn[] = []) => {
  return flattenVirtualColumns(columns).some((column) => (
    column.fixed === "left" && !shouldPreserveLeftFixedColumn(column)
  ));
};

const cloneVirtualColumnsWithoutLeftFixed = (
  columns: VirtualTableColumn[] = [],
): VirtualTableColumn[] => {
  return columns.map((column) => {
    const nextColumn: VirtualTableColumn = {
      ...column,
      fixed: column.fixed === "left" && !shouldPreserveLeftFixedColumn(column)
        ? undefined
        : column.fixed,
    };
    if (column.children?.length) {
      nextColumn.children = cloneVirtualColumnsWithoutLeftFixed(column.children);
    }
    return nextColumn;
  });
};

const getLeadingLeftFixedWidth = (columns: VirtualTableColumn[] = []) => {
  let width = 0;
  for (const column of flattenVirtualColumns(columns)) {
    if (column.fixed !== "left") {
      break;
    }
    width += getColumnWidth(column);
  }
  return width;
};

const getTrailingRightFixedWidth = (columns: VirtualTableColumn[] = []) => {
  let width = 0;
  for (const column of [...flattenVirtualColumns(columns)].reverse()) {
    if (column.fixed !== "right") {
      break;
    }
    width += getColumnWidth(column);
  }
  return width;
};

export const resolveEffectiveVirtualFixedColumns = (
  options: ResolveEffectiveVirtualFixedColumnsOptions,
) => {
  const viewportWidth = Math.max(0, Math.floor(Number(options.viewportWidth) || 0));
  if (viewportWidth <= 0) {
    return options.columns;
  }

  const leadingLeftFixedWidth = getLeadingLeftFixedWidth(options.columns);
  const trailingRightFixedWidth = getTrailingRightFixedWidth(options.columns);
  const reservedFixedWidth = leadingLeftFixedWidth + trailingRightFixedWidth;
  const hasCenterViewportSpace = (
    reservedFixedWidth + MIN_CENTER_VIEWPORT_WIDTH_FOR_LEFT_FIXED <= viewportWidth
  );
  if (
    leadingLeftFixedWidth <= 0
    || hasCenterViewportSpace
    || !hasCancellableLeftFixedColumns(options.columns)
  ) {
    return options.columns;
  }

  return cloneVirtualColumnsWithoutLeftFixed(options.columns);
};

export const resolveVirtualFixedColumnBoundaryState = (
  options: ResolveVirtualFixedColumnBoundaryStateOptions,
): VirtualFixedColumnBoundaryState => {
  const epsilon = Math.max(0, Number(options.epsilon) || 1);
  const totalWidth = Math.max(0, Number(options.totalWidth) || 0);
  const viewportWidth = Math.max(0, Number(options.viewportWidth) || 0);
  const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
  const scrollLeft = Math.max(0, Math.min(Number(options.scrollLeft) || 0, maxScrollLeft));
  const hasHorizontalOverflow = maxScrollLeft > epsilon;
  const leftAtStart = !hasHorizontalOverflow || scrollLeft <= epsilon;
  const rightAtEnd = !hasHorizontalOverflow || scrollLeft >= maxScrollLeft - epsilon;

  return {
    hasHorizontalOverflow,
    leftHasOverlap: Boolean(options.hasFixedLeft) && hasHorizontalOverflow && !leftAtStart,
    rightHasOverlap: Boolean(options.hasFixedRight) && hasHorizontalOverflow && !rightAtEnd,
    leftAtStart,
    rightAtEnd,
    maxScrollLeft,
    scrollLeft,
  };
};
