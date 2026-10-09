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
  status?: LastChangeStatus;
  tableData?: SubFormColumnRow[];
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
  const columnTimes = subForm.tableData?.map(row =>
    row.children?.find(field => field.fieldId === fieldId)?.status?.lastChangeTime
  ) ?? [];

  return [
    subForm.status?.lastChangeTime,
    columnTimes,
  ];
}

export function markSubFormStructureChanged(subForm: SubFormStructureSource) {
  subForm.updateLastChangeTime?.();

  const forceWatch = subForm.topForm?.forceWatch;
  if (forceWatch) {
    forceWatch.value = !forceWatch.value;
  }
}
