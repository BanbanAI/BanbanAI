import { VirtualTableColumn } from "../types";
import {
  VirtualTableEditAnchor,
  VirtualTableEditSession,
  VirtualTableEditorDefinition,
  VirtualTableResolvedEditor,
} from "./types";

type ResolveVirtualTableEditorValueOptions = {
  row: Record<string, any>;
  column: VirtualTableColumn;
  resolvedEditor?: VirtualTableResolvedEditor;
};

type BuildVirtualTableEditorPropsOptions = {
  row: Record<string, any>;
  column: VirtualTableColumn;
  rowIndex: number;
  session: VirtualTableEditSession;
  resolvedEditor?: VirtualTableResolvedEditor;
};

type CreateVirtualTableEditAnchorOptions = {
  cellRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  containerRect: {
    top: number;
    left: number;
  };
};

export const resolveVirtualTableEditorValue = (
  options: ResolveVirtualTableEditorValueOptions,
) => {
  if (options.resolvedEditor && Object.prototype.hasOwnProperty.call(options.resolvedEditor, "value")) {
    return options.resolvedEditor.value;
  }
  const dataIndex = options.column.dataIndex || options.column.key;
  return options.row?.[dataIndex];
};

export const buildVirtualTableEditorProps = (
  options: BuildVirtualTableEditorPropsOptions,
) => {
  const baseProps: Record<string, any> = {
    modelValue: options.session.draftValue,
    row: options.row,
    column: options.column,
    rowIndex: options.rowIndex,
    rowKey: options.session.cell?.rowKey,
    columnKey: options.session.cell?.columnKey,
    readonly: options.resolvedEditor?.readonly ?? false,
    disabled: options.resolvedEditor?.disabled ?? false,
  };

  if (options.resolvedEditor?.context !== undefined) {
    baseProps.context = options.resolvedEditor.context;
  }

  return {
    ...baseProps,
    ...(options.resolvedEditor?.props || {}),
  };
};

export const createVirtualTableEditAnchor = (
  options: CreateVirtualTableEditAnchorOptions,
): VirtualTableEditAnchor => ({
  top: options.cellRect.top - options.containerRect.top,
  left: options.cellRect.left - options.containerRect.left,
  width: options.cellRect.width,
  height: options.cellRect.height,
});

export const resolveVirtualTableOutsideClickAction = (
  definition?: VirtualTableEditorDefinition,
) => {
  return definition?.canCommitOnBlur ? "commit" : "cancel";
};
