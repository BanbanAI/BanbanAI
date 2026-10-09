type ResolveNocodeDetailTriggerOptions = {
  rowDetailTrigger?: "click" | "dblclick";
  isMobile?: boolean;
};

type ShouldDelayNocodeSelectionOnDblclickOptions = {
  clickRowChecked?: boolean;
  clickRowShowDetail?: boolean;
  detailTrigger?: "click" | "dblclick";
  isShowCheck?: boolean;
  isMobile?: boolean;
};

type ShouldSyncNocodeSelectedRowOnRowActivateOptions = {
  activationTrigger: "click" | "dblclick";
  clickRowChecked?: boolean;
  isShowCheck?: boolean;
  isMobile?: boolean;
};

type PendingSelectionState = {
  timer: any;
  sequenceId: number;
};

export type CommittedDelayedSelectionState = {
  rowKey: any;
  sequenceId: number;
};

type CreateNocodeDelayedSelectionControllerOptions<T> = {
  delayMs: number;
  getRowKey: (row: T) => any;
  schedule: (callback: () => void, delayMs: number) => any;
  cancel: (timer: any) => void;
};

export const resolveNocodeDetailTrigger = (options: ResolveNocodeDetailTriggerOptions) => {
  if (options.rowDetailTrigger === "dblclick" && !options.isMobile) {
    return "dblclick" as const;
  }
  return "click" as const;
};

export const shouldDelayNocodeSelectionOnDblclick = (options: ShouldDelayNocodeSelectionOnDblclickOptions) => {
  return Boolean(
    options.clickRowChecked
    && options.clickRowShowDetail
    && options.detailTrigger === "dblclick"
    && !options.isMobile,
  );
};

export const shouldSyncNocodeSelectedRowOnRowActivate = (
  options: ShouldSyncNocodeSelectedRowOnRowActivateOptions,
) => {
  if (options.activationTrigger !== "click") {
    return true;
  }

  return !(
    options.clickRowChecked
    && !options.isMobile
  );
};

export const createNocodeDelayedSelectionController = <T>(
  options: CreateNocodeDelayedSelectionControllerOptions<T>,
) => {
  const pendingSelectionMap = new Map<any, PendingSelectionState>();
  const selectionSequenceMap = new Map<any, number>();
  let committedSelection: CommittedDelayedSelectionState | null = null;
  let nextSequenceId = 0;

  const clearPending = (rowKey?: any) => {
    if (rowKey === undefined) {
      pendingSelectionMap.forEach(({ timer }) => options.cancel(timer));
      pendingSelectionMap.clear();
      return;
    }

    const pendingSelection = pendingSelectionMap.get(rowKey);
    if (pendingSelection) {
      options.cancel(pendingSelection.timer);
      pendingSelectionMap.delete(rowKey);
    }
  };

  const clearSequence = (rowKey?: any) => {
    if (rowKey === undefined) {
      selectionSequenceMap.clear();
      return;
    }
    selectionSequenceMap.delete(rowKey);
  };

  const clearCommitted = (rowKey?: any) => {
    if (rowKey === undefined) {
      committedSelection = null;
      return;
    }
    if (committedSelection?.rowKey === rowKey) {
      committedSelection = null;
    }
  };

  const clearAll = (rowKey?: any) => {
    clearPending(rowKey);
    clearSequence(rowKey);
    clearCommitted(rowKey);
  };

  const getSequence = (rowKey: any) => {
    return selectionSequenceMap.get(rowKey);
  };

  const getCommitted = (rowKey?: any) => {
    if (rowKey === undefined) {
      return committedSelection;
    }
    return committedSelection?.rowKey === rowKey ? committedSelection : null;
  };

  const queue = (row: T, commit: () => void) => {
    const rowKey = options.getRowKey(row);
    if (rowKey === undefined || rowKey === null) {
      return false;
    }

    clearPending(rowKey);

    const sequenceId = ++nextSequenceId;
    selectionSequenceMap.set(rowKey, sequenceId);

    const timer = options.schedule(() => {
      const pendingSelection = pendingSelectionMap.get(rowKey);
      if (!pendingSelection || pendingSelection.sequenceId !== sequenceId) {
        return;
      }

      pendingSelectionMap.delete(rowKey);
      commit();
      committedSelection = {
        rowKey,
        sequenceId,
      };
    }, options.delayMs);

    pendingSelectionMap.set(rowKey, {
      timer,
      sequenceId,
    });

    return true;
  };

  return {
    clearPending,
    clearSequence,
    clearCommitted,
    clearAll,
    getSequence,
    getCommitted,
    queue,
  };
};
