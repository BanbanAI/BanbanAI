import { VirtualHeaderCell, VirtualStickyOffsets, VirtualTableColumn } from "./types";

export const DEFAULT_COLUMN_WIDTH = 160;

export const getColumnWidth = (column: VirtualTableColumn) => {
  return Number(column.width) > 0 ? Number(column.width) : DEFAULT_COLUMN_WIDTH;
};

export const flattenVirtualColumns = (columns: VirtualTableColumn[] = []) => {
  const leaves: VirtualTableColumn[] = [];

  const walk = (items: VirtualTableColumn[] = []) => {
    items.forEach((column) => {
      if (column.children?.length) {
        walk(column.children);
        return;
      }
      leaves.push(column);
    });
  };

  walk(columns);
  return leaves;
};

const normalizeHeaderDepth = (value: unknown) => {
  const depth = Math.floor(Number(value) || 0);
  return depth > 0 ? depth : undefined;
};

export const resolveColumnHeaderDepth = (
  column: VirtualTableColumn,
  fallbackDepth: number,
): number => {
  const normalizedFallbackDepth = Math.max(1, Math.floor(Number(fallbackDepth) || 1));
  const explicitDepth = normalizeHeaderDepth(column.headerDepth);
  if (explicitDepth == null) {
    return normalizedFallbackDepth;
  }
  return Math.max(normalizedFallbackDepth, explicitDepth);
};

export const getColumnMaxDepth = (
  column: VirtualTableColumn,
  fallbackDepth = 1,
): number => {
  const depth = resolveColumnHeaderDepth(column, fallbackDepth);
  if (!column.children?.length) {
    return depth;
  }
  return Math.max(...column.children.map((child) => getColumnMaxDepth(child, depth + 1)));
};

export const getColumnsMaxDepth = (columns: VirtualTableColumn[] = []): number => {
  if (!columns.length) {
    return 0;
  }
  return Math.max(...columns.map((column) => getColumnMaxDepth(column, 1)));
};

const getLeafCount = (column: VirtualTableColumn): number => {
  if (!column.children?.length) {
    return 1;
  }
  return column.children.reduce((count, child) => count + getLeafCount(child), 0);
};

export const buildHeaderRows = (columns: VirtualTableColumn[] = []) => {
  if (!columns.length) {
    return [] as VirtualHeaderCell[][];
  }

  const maxDepth = getColumnsMaxDepth(columns);
  const rows: VirtualHeaderCell[][] = Array.from({ length: maxDepth }, () => []);

  const visit = (column: VirtualTableColumn, fallbackDepth: number) => {
    const depth = resolveColumnHeaderDepth(column, fallbackDepth);
    const isLeaf = !column.children?.length;
    const childHeaderDepth = isLeaf
      ? depth + 1
      : Math.min(...column.children!.map((child) => resolveColumnHeaderDepth(child, depth + 1)));
    rows[depth - 1].push({
      key: column.key,
      title: column.title,
      depth,
      colSpan: isLeaf ? 1 : getLeafCount(column),
      rowSpan: isLeaf ? (maxDepth - depth + 1) : Math.max(1, childHeaderDepth - depth),
      isLeaf,
      column,
    });

    column.children?.forEach((child) => visit(child, depth + 1));
  };

  columns.forEach((column) => visit(column, 1));
  return rows;
};

export const computeStickyOffsets = (columns: VirtualTableColumn[] = []): VirtualStickyOffsets => {
  const left: Record<string, number> = {};
  const right: Record<string, number> = {};

  let leftOffset = 0;
  columns.forEach((column) => {
    if (column.fixed !== "left") {
      return;
    }
    left[column.key] = leftOffset;
    leftOffset += getColumnWidth(column);
  });

  let rightOffset = 0;
  [...columns].reverse().forEach((column) => {
    if (column.fixed !== "right") {
      return;
    }
    right[column.key] = rightOffset;
    rightOffset += getColumnWidth(column);
  });

  return {
    left,
    right,
  };
};
