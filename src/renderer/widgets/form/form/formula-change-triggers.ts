type LastChangeStatus = {
  lastChangeTime?: number;
};

type SubFormColumnChild = {
  fieldId?: string;
  status?: LastChangeStatus;
};

type SubFormColumnRow = {
  children?: SubFormColumnChild[];
};

type SubFormColumnSource = {
  hasRuntime?: boolean;
  status?: LastChangeStatus;
  tableData?: SubFormColumnRow[];
  runtimeTableData?: Record<string, unknown>[];
  runtimeVersion?: number;
};

type ForceWatchRef = {
  value: boolean;
};

type SubFormStructureSource = {
  topForm?: {
    forceWatch?: ForceWatchRef;
  };
  updateLastChangeTime?: () => void;
};

export function getSubFormColumnLastChangeTimes(subForm: SubFormColumnSource, fieldId: string) {
  const columnTimes = subForm.hasRuntime && subForm.runtimeTableData
    ? subForm.runtimeTableData.map(row => row[fieldId])
    : subForm.tableData?.map(row =>
      row.children?.find(field => field.fieldId === fieldId)?.status?.lastChangeTime
    ) ?? [];

  return [
    subForm.status?.lastChangeTime,
    subForm.runtimeVersion,
    columnTimes,
  ];
}

export function getSubFormDataFillChangeToken(subForm: SubFormColumnSource, fieldId: string) {
  if (subForm.hasRuntime) {
    return subForm.status?.lastChangeTime;
  }
  return subForm.tableData?.map(row =>
    row.children?.find(field => field.fieldId === fieldId)?.status?.lastChangeTime
  ).filter(Boolean) ?? [];
}

export function createCoalescedDataFillRunner(run: () => Promise<void>) {
  let requested = false;
  let currentRun: Promise<void> | undefined;

  return () => {
    requested = true;
    if (!currentRun) {
      currentRun = Promise.resolve().then(async () => {
        while (requested) {
          requested = false;
          await run();
        }
      }).finally(() => {
        currentRun = undefined;
      });
    }
    return currentRun;
  };
}

export function ensureSubFormDataFillRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.length ? rows : [{}];
}

export function markSubFormStructureChanged(subForm: SubFormStructureSource) {
  subForm.updateLastChangeTime?.();

  const forceWatch = subForm.topForm?.forceWatch;
  if (forceWatch) {
    forceWatch.value = !forceWatch.value;
  }
}
