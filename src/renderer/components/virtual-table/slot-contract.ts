import type {
  VirtualTableBodyCellSlotProps,
  VirtualTableFooterCellSlotProps,
  VirtualTableHeaderCellSlotProps,
  VirtualVisibleColumnDescriptor,
  VirtualVisibleHeaderCell,
} from "./types";

const noopStartEdit = () => {};

type NormalHeaderCell = Extract<VirtualVisibleHeaderCell, { type: "normal" }>;
type NormalColumnDescriptor = Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>;

type BuildVirtualTableBodyCellSlotPropsOptions = {
  descriptor: NormalColumnDescriptor;
  row: Record<string, any>;
  rowIndex: number;
  value: any;
  editable: boolean;
  isEditing: boolean;
  startEdit?: () => void;
};

export const buildVirtualTableHeaderCellSlotProps = (
  cell: NormalHeaderCell,
): VirtualTableHeaderCellSlotProps => {
  return {
    region: "header",
    cell,
    column: cell.column,
    columnKey: cell.column.key,
    columnIndex: cell.columnIndex,
    leafColumns: cell.leafColumns,
    isLeaf: cell.isLeaf,
    row: undefined,
    rowIndex: undefined,
    value: undefined,
    editable: false,
    isEditing: false,
    startEdit: noopStartEdit,
  };
};

export const buildVirtualTableBodyCellSlotProps = (
  options: BuildVirtualTableBodyCellSlotPropsOptions,
): VirtualTableBodyCellSlotProps => {
  return {
    region: "body",
    descriptor: options.descriptor,
    column: options.descriptor.column,
    columnKey: options.descriptor.column.key,
    columnIndex: options.descriptor.columnIndex,
    leafColumns: [options.descriptor.column],
    isLeaf: true,
    row: options.row,
    rowIndex: options.rowIndex,
    value: options.value,
    editable: options.editable,
    isEditing: options.isEditing,
    startEdit: options.startEdit || noopStartEdit,
  };
};

export const buildVirtualTableFooterCellSlotProps = (
  options: {
    descriptor: NormalColumnDescriptor;
  },
): VirtualTableFooterCellSlotProps => {
  return {
    region: "footer",
    descriptor: options.descriptor,
    column: options.descriptor.column,
    columnKey: options.descriptor.column.key,
    columnIndex: options.descriptor.columnIndex,
    leafColumns: [options.descriptor.column],
    isLeaf: true,
    row: undefined,
    rowIndex: undefined,
    value: undefined,
    editable: false,
    isEditing: false,
    startEdit: noopStartEdit,
  };
};
