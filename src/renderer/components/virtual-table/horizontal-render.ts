import {
  VirtualColumnPartitions,
  VirtualHorizontalRenderRange,
  VirtualTableColumn,
  VirtualVisibleColumnDescriptor,
  VirtualVisibleHeaderCell,
} from "./types";
import {
  flattenVirtualColumns,
  getColumnWidth,
  getColumnsMaxDepth,
  resolveColumnHeaderDepth,
} from "./column-utils";

type IndexedVirtualColumn = {
  column: VirtualTableColumn;
  columnIndex: number;
  children?: IndexedVirtualColumn[];
};

type BuildVisibleColumnDescriptorsOptions = {
  flat: VirtualColumnPartitions["flat"];
  horizontalRange: VirtualHorizontalRenderRange;
  enabled: boolean;
  trailingFillerWidth?: number;
};

type BuildVisibleHeaderRowsOptions = {
  nested: VirtualColumnPartitions["nested"];
  flat: VirtualColumnPartitions["flat"];
  horizontalRange: VirtualHorizontalRenderRange;
  enabled: boolean;
  trailingFillerWidth?: number;
};

type ResolveHorizontalRenderRangeOptions = {
  flat: VirtualColumnPartitions["flat"];
  scrollLeft: number;
  viewportWidth: number;
  overscanPx?: number;
  enabled: boolean;
};

export const HORIZONTAL_VIRTUAL_OVERSCAN_PX = 100;

const isLeafColumn = (column: VirtualTableColumn) => !column.children?.length;

const hasFixedDescendant = (column: VirtualTableColumn, fixed: "left" | "right"): boolean => {
  if (column.fixed === fixed) {
    return true;
  }
  return (column.children || []).some((child) => hasFixedDescendant(child, fixed));
};

const getLeadingFixedCount = (columns: VirtualTableColumn[], fixed: "left" | "right") => {
  let count = 0;
  for (const column of columns) {
    if (!hasFixedDescendant(column, fixed)) {
      break;
    }
    count += 1;
  }
  return count;
};

const attachColumnIndex = (columns: VirtualTableColumn[], startColumnIndex: number): IndexedVirtualColumn[] => {
  let leafCount = 0;

  return columns.reduce<IndexedVirtualColumn[]>((result, column) => {
    const columnIndex = startColumnIndex + leafCount;
    if (isLeafColumn(column)) {
      leafCount += 1;
      result.push({
        column,
        columnIndex,
      });
      return result;
    }

    const children = attachColumnIndex(column.children || [], columnIndex);
    leafCount += flattenVirtualColumns([column]).length;
    if (children.length) {
      result.push({
        column,
        columnIndex,
        children,
      });
    }
    return result;
  }, []);
};

const filterIndexedCenterColumns = (
  columns: VirtualTableColumn[],
  horizontalRange: VirtualHorizontalRenderRange,
  leftFlatCount: number,
) => {
  const startIndex = leftFlatCount + horizontalRange.leftIndex;
  const endIndex = leftFlatCount + horizontalRange.rightIndex;

  const visit = (items: IndexedVirtualColumn[]): IndexedVirtualColumn[] => {
    return items.reduce<IndexedVirtualColumn[]>((result, item) => {
      if (!item.children?.length) {
        if (item.columnIndex >= startIndex && item.columnIndex < endIndex) {
          result.push(item);
        }
        return result;
      }

      const children = visit(item.children);
      if (children.length) {
        result.push({
          column: item.column,
          columnIndex: item.columnIndex,
          children,
        });
      }
      return result;
    }, []);
  };

  return visit(attachColumnIndex(columns, leftFlatCount));
};

const buildHeaderRowsFromIndexed = (
  indexedColumns: IndexedVirtualColumn[],
  rowCount: number,
): VirtualVisibleHeaderCell[][] => {
  type HeaderRowEntry = {
    sortIndex: number;
    order: number;
    cell: VirtualVisibleHeaderCell;
  };

  const rows: HeaderRowEntry[][] = Array.from({ length: rowCount }, () => []);
  let rowEntryOrder = 0;

  const pushRowEntry = (rowIndex: number, sortIndex: number, cell: VirtualVisibleHeaderCell) => {
    rows[rowIndex].push({
      sortIndex,
      order: rowEntryOrder,
      cell,
    });
    rowEntryOrder += 1;
  };

  const pushHeaderCell = (
    rowIndex: number,
    sortIndex: number,
    cell: Extract<VirtualVisibleHeaderCell, { type: "normal" }>,
  ) => {
    pushRowEntry(rowIndex, sortIndex, cell);

    if (cell.rowSpan <= 1) {
      return;
    }

    for (let nextRowIndex = rowIndex + 1; nextRowIndex < Math.min(rowCount, rowIndex + cell.rowSpan); nextRowIndex += 1) {
      pushRowEntry(nextRowIndex, sortIndex, {
        type: "placeholder",
        key: `__header_placeholder__${cell.key}__${nextRowIndex}`,
        width: cell.width,
        leafColumns: cell.leafColumns,
      });
    }
  };

  const visit = (items: IndexedVirtualColumn[], fallbackDepth: number): VirtualTableColumn[] => {
    return items.reduce<VirtualTableColumn[]>((descendantLeaves, item) => {
      const depth = resolveColumnHeaderDepth(item.column, fallbackDepth);
      if (!item.children?.length) {
        pushHeaderCell(depth - 1, item.columnIndex, {
          type: "normal",
          key: item.column.key,
          title: item.column.title,
          depth,
          colSpan: 1,
          rowSpan: rowCount - depth + 1,
          isLeaf: true,
          column: item.column,
          columnIndex: item.columnIndex,
          width: getColumnWidth(item.column),
          leafColumns: [item.column],
        });
        descendantLeaves.push(item.column);
        return descendantLeaves;
      }

      const childHeaderDepth = Math.min(
        ...item.children.map((child) => resolveColumnHeaderDepth(child.column, depth + 1)),
      );
      const visibleLeaves = visit(item.children, depth + 1);
      if (visibleLeaves.length) {
        pushHeaderCell(depth - 1, item.columnIndex, {
          type: "normal",
          key: item.column.key,
          title: item.column.title,
          depth,
          colSpan: visibleLeaves.length,
          rowSpan: Math.max(1, childHeaderDepth - depth),
          isLeaf: false,
          column: item.column,
          columnIndex: item.columnIndex,
          width: visibleLeaves.reduce((total, column) => total + getColumnWidth(column), 0),
          leafColumns: visibleLeaves,
        });
      }
      descendantLeaves.push(...visibleLeaves);
      return descendantLeaves;
    }, []);
  };

  visit(indexedColumns, 1);
  return rows.map((row) => {
    return row
      .sort((left, right) => left.sortIndex - right.sortIndex || left.order - right.order)
      .map((entry) => entry.cell);
  });
};

const normalizeTrailingFillerWidth = (width: number | undefined) => {
  return Math.max(0, Math.floor(Number(width) || 0));
};

export const partitionVirtualColumns = (columns: VirtualTableColumn[] = []): VirtualColumnPartitions => {
  const leftNestedCount = getLeadingFixedCount(columns, "left");
  const rightNestedCount = getLeadingFixedCount([...columns].reverse(), "right");
  const safeRightCount = Math.max(0, Math.min(rightNestedCount, columns.length - leftNestedCount));

  const left = columns.slice(0, leftNestedCount);
  const center = columns.slice(leftNestedCount, columns.length - safeRightCount);
  const right = columns.slice(columns.length - safeRightCount);

  return {
    flat: {
      full: flattenVirtualColumns(columns),
      left: flattenVirtualColumns(left),
      center: flattenVirtualColumns(center),
      right: flattenVirtualColumns(right),
    },
    nested: {
      full: columns,
      left,
      center,
      right,
    },
  };
};

export const resolveHorizontalRenderRange = (
  options: ResolveHorizontalRenderRangeOptions,
): VirtualHorizontalRenderRange => {
  const centerColumns = options.flat.center || [];
  if (!options.enabled) {
    return {
      leftIndex: 0,
      leftBlank: 0,
      rightIndex: centerColumns.length,
      rightBlank: 0,
    };
  }

  const overscanPx = Math.max(0, Math.floor(Number(options.overscanPx) || HORIZONTAL_VIRTUAL_OVERSCAN_PX));
  const viewportWidth = Math.max(0, Math.floor(Number(options.viewportWidth) || 0));
  const scrollLeft = Math.max(0, Math.floor(Number(options.scrollLeft) || 0));

  let leftIndex = 0;
  let leftBlank = 0;
  const overscannedOffsetX = Math.max(0, scrollLeft - overscanPx);

  while (leftIndex < centerColumns.length) {
    const column = centerColumns[leftIndex];
    if (getColumnWidth(column) + leftBlank < overscannedOffsetX) {
      leftBlank += getColumnWidth(column);
      leftIndex += 1;
      continue;
    }
    break;
  }

  let centerCount = 0;
  let centerRenderWidth = 0;
  const minCenterRenderWidth = viewportWidth + (overscannedOffsetX - leftBlank) + (overscanPx * 2);
  while (leftIndex + centerCount < centerColumns.length) {
    const column = centerColumns[leftIndex + centerCount];
    if (getColumnWidth(column) + centerRenderWidth < minCenterRenderWidth) {
      centerRenderWidth += getColumnWidth(column);
      centerCount += 1;
      continue;
    }
    break;
  }

  const rightIndex = leftIndex + centerCount;
  const rightBlank = centerColumns
    .slice(rightIndex)
    .reduce((total, column) => total + getColumnWidth(column), 0);

  return {
    leftIndex,
    leftBlank,
    rightIndex,
    rightBlank,
  };
};

export const buildVisibleColumnDescriptors = (
  options: BuildVisibleColumnDescriptorsOptions,
): VirtualVisibleColumnDescriptor[] => {
  const trailingFillerWidth = normalizeTrailingFillerWidth(options.trailingFillerWidth);

  if (!options.enabled && trailingFillerWidth <= 0) {
    return options.flat.full.map((column, columnIndex) => ({
      type: "normal" as const,
      key: column.key,
      column,
      columnIndex,
    }));
  }

  const descriptors: VirtualVisibleColumnDescriptor[] = [];
  options.flat.left.forEach((column, columnIndex) => {
    descriptors.push({
      type: "normal",
      key: column.key,
      column,
      columnIndex,
    });
  });

  if (options.enabled && options.horizontalRange.leftBlank > 0) {
    descriptors.push({
      type: "blank",
      key: "__blank_left__",
      blankSide: "left",
      blankKind: "virtual",
      width: options.horizontalRange.leftBlank,
    });
  }

  options.flat.center
    .slice(
      options.enabled ? options.horizontalRange.leftIndex : 0,
      options.enabled ? options.horizontalRange.rightIndex : options.flat.center.length,
    )
    .forEach((column, index) => {
      descriptors.push({
        type: "normal",
        key: column.key,
        column,
        columnIndex: options.flat.left.length + (options.enabled ? options.horizontalRange.leftIndex : 0) + index,
      });
    });

  if (options.enabled && options.horizontalRange.rightBlank > 0) {
    descriptors.push({
      type: "blank",
      key: "__blank_right__",
      blankSide: "right",
      blankKind: "virtual",
      width: options.horizontalRange.rightBlank,
    });
  }

  if (trailingFillerWidth > 0) {
    descriptors.push({
      type: "blank",
      key: "__filler_right__",
      blankSide: "right",
      blankKind: "filler",
      width: trailingFillerWidth,
    });
  }

  options.flat.right.forEach((column, index) => {
    descriptors.push({
      type: "normal",
      key: column.key,
      column,
      columnIndex: options.flat.full.length - options.flat.right.length + index,
    });
  });

  return descriptors;
};

export const buildVisibleHeaderRows = (
  options: BuildVisibleHeaderRowsOptions,
): VirtualVisibleHeaderCell[][] => {
  const rowCount = getColumnsMaxDepth(options.nested.full);
  if (rowCount <= 0) {
    return [];
  }

  const trailingFillerWidth = normalizeTrailingFillerWidth(options.trailingFillerWidth);

  if (!options.enabled && trailingFillerWidth <= 0) {
    return buildHeaderRowsFromIndexed(attachColumnIndex(options.nested.full, 0), rowCount);
  }

  const leftRows = buildHeaderRowsFromIndexed(attachColumnIndex(options.nested.left, 0), rowCount);
  const centerRows = options.enabled
    ? buildHeaderRowsFromIndexed(
      filterIndexedCenterColumns(options.nested.center, options.horizontalRange, options.flat.left.length),
      rowCount,
    )
    : buildHeaderRowsFromIndexed(
      attachColumnIndex(options.nested.center, options.flat.left.length),
      rowCount,
    );
  const rightRows = buildHeaderRowsFromIndexed(
    attachColumnIndex(options.nested.right, options.flat.left.length + options.flat.center.length),
    rowCount,
  );

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const cells: VirtualVisibleHeaderCell[] = [];
    cells.push(...leftRows[rowIndex]);
    if (options.enabled && options.horizontalRange.leftBlank > 0) {
      cells.push({
        type: "blank",
        key: `__header_blank_left__${rowIndex}`,
        blankSide: "left",
        blankKind: "virtual",
        width: options.horizontalRange.leftBlank,
      });
    }
    cells.push(...centerRows[rowIndex]);
    if (options.enabled && options.horizontalRange.rightBlank > 0) {
      cells.push({
        type: "blank",
        key: `__header_blank_right__${rowIndex}`,
        blankSide: "right",
        blankKind: "virtual",
        width: options.horizontalRange.rightBlank,
      });
    }
    if (trailingFillerWidth > 0) {
      cells.push({
        type: "blank",
        key: `__header_filler_right__${rowIndex}`,
        blankSide: "right",
        blankKind: "filler",
        width: trailingFillerWidth,
      });
    }
    cells.push(...rightRows[rowIndex]);
    return cells;
  });
};
