import { VirtualTableCellSpan, VirtualTableColumn, VirtualVisibleColumnDescriptor } from "./types";

type CreateVirtualRowSpanAccessorOptions<T> = {
  descriptors: VirtualVisibleColumnDescriptor[];
  row: T;
  rowIndex: number;
  resolveCellSpan: (
    row: T,
    rowIndex: number,
    column: VirtualTableColumn,
    columnIndex: number,
  ) => VirtualTableCellSpan;
};

const DEFAULT_SPAN: VirtualTableCellSpan = {
  rowSpan: 1,
  colSpan: 1,
};

const normalizeSpan = (span?: Partial<VirtualTableCellSpan> | null): VirtualTableCellSpan => {
  return {
    rowSpan: Math.max(0, Math.floor(Number(span?.rowSpan ?? DEFAULT_SPAN.rowSpan))),
    colSpan: Math.max(0, Math.floor(Number(span?.colSpan ?? DEFAULT_SPAN.colSpan))),
  };
};

export const createVirtualRowSpanAccessor = <T>(
  options: CreateVirtualRowSpanAccessorOptions<T>,
) => {
  const spanCache = new Map<string, VirtualTableCellSpan>();

  for (const descriptor of options.descriptors) {
    if (descriptor.type === "blank") {
      spanCache.set(descriptor.key, DEFAULT_SPAN);
      continue;
    }

    spanCache.set(
      descriptor.key,
      normalizeSpan(
        options.resolveCellSpan(options.row, options.rowIndex, descriptor.column, descriptor.columnIndex),
      ),
    );
  }

  return {
    getSpan(descriptor: VirtualVisibleColumnDescriptor) {
      return spanCache.get(descriptor.key) || DEFAULT_SPAN;
    },
  };
};
