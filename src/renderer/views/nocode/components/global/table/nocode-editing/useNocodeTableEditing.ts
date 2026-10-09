import { createVirtualTableEditorRegistry, VirtualTableColumn } from "@renderer/components/virtual-table";
import { FormWidgetType } from "../../../../../../../common/types/nocode";
import { isMobile } from "@renderer/utils";
import NocodeTableEditorHost from "./NocodeTableEditorHost.vue";
import { resolveNocodeTableCellEditingState, shouldIgnoreNocodeTableEditorOutsideClick } from "./capabilities";
import { commitNocodeTableCellEdit, commitNocodeTablePreparedRow } from "./commitNocodeTableCellEdit";
import { resolveNocodeTableEditorPolicy } from "./editor-policy";
import { resolveNocodeTableEditor } from "./resolveNocodeTableEditor";
import { resolveNocodeTableEditingRuntimeState } from "./runtime-state";
import { UseNocodeTableEditingOptions } from "./types";
import { shallowRef } from "vue";

const nocodeTableEditorRegistry = createVirtualTableEditorRegistry([
  {
    type: "nocode-widget-inline",
    mode: "inline",
    component: NocodeTableEditorHost,
    canCommitOnBlur: true,
    canCommitOnEnter: true,
  },
  {
    type: "nocode-widget-popup",
    mode: "popup",
    component: NocodeTableEditorHost,
    canCommitOnBlur: true,
  },
]);

const toNocodeEditingColumn = (column: VirtualTableColumn) => {
  const sourceColumn = column.meta?.sourceColumn as Record<string, any> | undefined;
  if (!sourceColumn) {
    return null;
  }
  return {
    field: sourceColumn.uid,
    title: sourceColumn.alias,
    params: sourceColumn,
  };
};

export const useNocodeTableEditing = (
  options: UseNocodeTableEditingOptions,
) => {
  const preparingDisplayEditCell = shallowRef<{
    rowKey: string | number;
    columnKey: string;
  } | null>(null);

  const resolveRuntimeState = () => resolveNocodeTableEditingRuntimeState({
    isCellEdit: options.isCellEdit,
    isAdmin: options.isAdmin,
  });

  const resolveDisplayEditCellIdentity = (
    row: Record<string, any>,
    column: VirtualTableColumn,
  ) => {
    const rowKeyField = options.widget.rowKey;
    const rowKey = rowKeyField ? row?.[rowKeyField] : undefined;
    if ((typeof rowKey !== "string" && typeof rowKey !== "number") || !column.key) {
      return null;
    }
    return {
      rowKey,
      columnKey: column.key,
    };
  };

  const isSameDisplayEditCell = (
    left?: { rowKey: string | number; columnKey: string } | null,
    right?: { rowKey: string | number; columnKey: string } | null,
  ) => {
    if (!left || !right) {
      return false;
    }
    return left.rowKey === right.rowKey && left.columnKey === right.columnKey;
  };

  const setPreparingDisplayEditCell = (
    row: Record<string, any>,
    column: VirtualTableColumn,
  ) => {
    preparingDisplayEditCell.value = resolveDisplayEditCellIdentity(row, column);
  };

  const clearPreparingDisplayEditCell = (
    row?: Record<string, any>,
    column?: VirtualTableColumn,
  ) => {
    if (!row || !column) {
      preparingDisplayEditCell.value = null;
      return;
    }
    const cellIdentity = resolveDisplayEditCellIdentity(row, column);
    if (!cellIdentity || isSameDisplayEditCell(preparingDisplayEditCell.value, cellIdentity)) {
      preparingDisplayEditCell.value = null;
    }
  };

  const resolveDisplayEditingState = (row: Record<string, any>, column: VirtualTableColumn) => {
    const editingColumn = toNocodeEditingColumn(column);
    if (!editingColumn) {
      return {
        editable: false,
        interaction: "none",
        widgetType: undefined,
      } as const;
    }
    const runtimeState = resolveRuntimeState();
    return resolveNocodeTableCellEditingState({
      widget: options.widget,
      row,
      column: editingColumn,
      tableProps: options.tableProps,
      isCellEdit: runtimeState.isCellEdit,
      isAdmin: runtimeState.isAdmin,
    });
  };

  const resolveCellEditor = (
    row: Record<string, any>,
    column: VirtualTableColumn,
  ) => {
    const editingColumn = toNocodeEditingColumn(column);
    if (!editingColumn) {
      return undefined;
    }
    const editingState = resolveDisplayEditingState(row, column);
    if (!editingState.editable || editingState.interaction !== "widget") {
      return undefined;
    }
    const resolvedEditor = resolveNocodeTableEditor({
      editable: true,
      widgetType: editingState.widgetType,
    });
    if (!resolvedEditor) {
      return undefined;
    }
    const editorPolicy = resolveNocodeTableEditorPolicy(editingState.widgetType);
    return {
      ...resolvedEditor,
      context: {
        widget: options.widget,
        editingColumn,
        rowHeightLevel: options.rowHeightLevel,
        presentationMode: editorPolicy.presentationMode,
      },
      props: {
        context: {
          widget: options.widget,
          editingColumn,
          rowHeightLevel: options.rowHeightLevel,
          presentationMode: editorPolicy.presentationMode,
        },
      },
    };
  };

  const handleDisplayEditClick = async (
    payload: {
      row: Record<string, any>;
      column: VirtualTableColumn;
      startEdit: () => void;
    },
  ) => {
    if (isMobile()) {
      return;
    }
    const editingColumn = toNocodeEditingColumn(payload.column);
    if (!editingColumn) {
      return;
    }
    const editingState = resolveDisplayEditingState(payload.row, payload.column);
    if (!editingState.editable) {
      return;
    }

    if (editingState.interaction === "dialog") {
      options.tableProps.openAssignOwnerDialog?.({
        rows: [payload.row],
        initialOwnerId: payload.row?.[editingColumn.field],
        onSubmit: async (rows) => {
          const nextRow = rows?.[0];
          if (!nextRow) {
            return;
          }
          await commitNocodeTablePreparedRow({
            widget: options.widget,
            column: editingColumn,
            nextRow,
            tableProps: options.tableProps,
          });
        },
      });
      return;
    }

    const elementId = editingColumn.params.elementId;
    if (!elementId) {
      return;
    }

    setPreparingDisplayEditCell(payload.row, payload.column);

    try {
      await options.widget.ensureFormReady();
      const instanceResult = await options.widget.waitForInstanceById(elementId, {
        timeoutMs: 15000,
      });
      if (instanceResult.status !== "ready") {
        return;
      }
    } finally {
      clearPreparingDisplayEditCell(payload.row, payload.column);
    }

    const latestEditingState = resolveDisplayEditingState(payload.row, payload.column);
    if (!latestEditingState.editable) {
      return;
    }

    payload.startEdit();
  };

  const commitCellEdit = (payload: {
    row: Record<string, any>;
    column: VirtualTableColumn;
    previousValue: any;
    nextValue: any;
  }) => {
    const editingColumn = toNocodeEditingColumn(payload.column);
    if (!editingColumn) {
      return {
        status: "refreshed",
      } as const;
    }
    return commitNocodeTableCellEdit({
      widget: options.widget,
      row: payload.row,
      column: editingColumn,
      previousValue: payload.previousValue,
      nextValue: payload.nextValue,
      tableProps: options.tableProps,
    });
  };

  const isDisplayCellEditable = (row: Record<string, any>, column: VirtualTableColumn) => {
    return resolveDisplayEditingState(row, column).editable;
  };

  const isDisplayCellPreparing = (row: Record<string, any>, column: VirtualTableColumn) => {
    return isSameDisplayEditCell(
      preparingDisplayEditCell.value,
      resolveDisplayEditCellIdentity(row, column),
    );
  };

  const shouldIgnoreEditOutsideClick = (event: MouseEvent) => {
    return shouldIgnoreNocodeTableEditorOutsideClick(event);
  };

  return {
    editorRegistry: nocodeTableEditorRegistry,
    resolveCellEditor,
    handleDisplayEditClick,
    commitCellEdit,
    isDisplayCellEditable,
    isDisplayCellPreparing,
    shouldIgnoreEditOutsideClick,
  };
};
