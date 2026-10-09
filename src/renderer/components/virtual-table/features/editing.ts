import {
  VirtualTableCellId,
  VirtualTableEditCommitResult,
  VirtualTableEditSession,
  VirtualTableEditorDefinition,
  VirtualTableResolvedEditor,
} from "../editing/types";

type BeginVirtualTableEditPayload = {
  cell: VirtualTableCellId;
  draftValue: any;
  initialValue: any;
  editorType: string;
  mode: "inline" | "popup";
  resolvedEditor?: VirtualTableResolvedEditor;
};

export const createIdleVirtualTableEditSession = (): VirtualTableEditSession => ({
  status: "idle",
  cell: null,
  draftValue: undefined,
  initialValue: undefined,
  editorType: undefined,
  mode: undefined,
  reason: undefined,
  errorMessage: undefined,
  resolvedEditor: undefined,
});

export const beginVirtualTableEdit = (
  _session: VirtualTableEditSession,
  payload: BeginVirtualTableEditPayload,
): VirtualTableEditSession => ({
  status: "editing",
  cell: payload.cell,
  draftValue: payload.draftValue,
  initialValue: payload.initialValue,
  editorType: payload.editorType,
  mode: payload.mode,
  reason: undefined,
  errorMessage: undefined,
  resolvedEditor: payload.resolvedEditor,
});

export const updateVirtualTableEditDraft = (
  session: VirtualTableEditSession,
  draftValue: any,
): VirtualTableEditSession => ({
  ...session,
  draftValue,
  errorMessage: undefined,
});

export const requestVirtualTableEditCommit = (
  session: VirtualTableEditSession,
  reason?: string,
): VirtualTableEditSession => {
  if (!session.cell) {
    return session;
  }
  return {
    ...session,
    status: "committing",
    reason,
    errorMessage: undefined,
  };
};

export const completeVirtualTableEditCommit = (
  session: VirtualTableEditSession,
  result: VirtualTableEditCommitResult,
): VirtualTableEditSession => {
  if (result.status === "rejected") {
    return {
      ...session,
      status: "editing",
      errorMessage: result.message,
    };
  }
  return createIdleVirtualTableEditSession();
};

export const cancelVirtualTableEdit = (
  _session: VirtualTableEditSession,
  reason?: string,
): VirtualTableEditSession => ({
  ...createIdleVirtualTableEditSession(),
  reason,
});

export const isVirtualTableEditingCell = (
  session: VirtualTableEditSession,
  cell: VirtualTableCellId,
): boolean => {
  if (!session.cell) {
    return false;
  }
  if (session.status === "idle") {
    return false;
  }
  return session.cell.rowKey === cell.rowKey && session.cell.columnKey === cell.columnKey;
};

export const shouldCommitVirtualTableEditOnEnter = (
  definition?: VirtualTableEditorDefinition,
) => {
  return Boolean(definition?.canCommitOnEnter);
};

export const shouldCommitVirtualTableEditOnBlur = (
  definition?: VirtualTableEditorDefinition,
) => {
  return Boolean(definition?.canCommitOnBlur);
};
