import { VirtualTableEditorRegistry } from "./editor-registry";
import { VirtualTableEditSession, VirtualTableResolvedEditor } from "./types";
import { isVirtualTableEditingCell } from "../features/editing";
import { VirtualVisibleColumnDescriptor, VirtualTableColumn } from "../types";

type VirtualTableResolvedRowEditor = {
  cell: {
    rowKey: string | number;
    columnKey: string;
  };
  definition: any;
  resolvedEditor: VirtualTableResolvedEditor;
  isEditing: boolean;
};

type BuildVirtualTableRowEditorStateMapOptions = {
  row: Record<string, any>;
  rowIndex: number;
  rowKey: string | number;
  descriptors: VirtualVisibleColumnDescriptor[];
  editingSession?: VirtualTableEditSession;
  editorRegistry?: VirtualTableEditorRegistry;
  resolveCellEditor?: (
    row: Record<string, any>,
    column: VirtualTableColumn,
    rowIndex: number,
    columnIndex: number,
  ) => VirtualTableResolvedEditor | undefined;
};

const buildEditingCell = (
  rowKey: string | number,
  descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>,
) => ({
  rowKey,
  columnKey: descriptor.column.key,
});

export const buildVirtualTableRowEditorStateMap = (
  options: BuildVirtualTableRowEditorStateMapOptions,
) => {
  const map = new Map<string, VirtualTableResolvedRowEditor>();
  if (!options.editorRegistry) {
    return map;
  }

  for (const descriptor of options.descriptors) {
    if (descriptor.type !== "normal") {
      continue;
    }

    const cell = buildEditingCell(options.rowKey, descriptor);
    const isEditing = options.editingSession
      ? isVirtualTableEditingCell(options.editingSession, cell)
      : false;

    const resolvedEditor = isEditing
      ? (options.editingSession?.resolvedEditor
        || options.resolveCellEditor?.(options.row, descriptor.column, options.rowIndex, descriptor.columnIndex))
      : options.resolveCellEditor?.(options.row, descriptor.column, options.rowIndex, descriptor.columnIndex);

    if (!resolvedEditor) {
      continue;
    }

    const definition = options.editorRegistry.resolve(resolvedEditor.type);
    if (!definition) {
      continue;
    }

    map.set(descriptor.key, {
      cell,
      definition,
      resolvedEditor,
      isEditing,
    });
  }

  return map;
};
