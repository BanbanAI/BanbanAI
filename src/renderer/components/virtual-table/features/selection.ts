type ToggleNocodeSelectionOptions<T extends Record<string, any>> = {
  currentRows?: T[];
  row: T;
  rowKey: string;
  isMultiple: boolean;
};

type ToggleNocodeSelectionStateOptions<T extends Record<string, any>> = ToggleNocodeSelectionOptions<T> & {
  currentSelectedRow?: T | null;
};

type IsNocodeRowCheckedOptions<T extends Record<string, any>> = {
  currentRows?: T[];
  row?: T;
  rowKey: string;
};

type ResolveNocodeRowClassNameOptions<T extends Record<string, any>> = {
  checkedRows?: T[];
  selectedRow?: T | null;
  row?: T;
  rowKey: string;
  isShowCheck?: boolean;
  openedRowKey?: any;
};

type GetNocodeRowSequenceOptions<T extends Record<string, any>> = {
  rows?: T[];
  row?: T;
  rowKey: string;
  rowIndex: number;
  currentPage?: number;
  pageSize?: number;
};

type NormalizeNocodeSelectionRowsOptions<T extends Record<string, any>, U extends Record<string, any> = T> = {
  rows?: T[];
  rowKey: string;
  mapRow?: (row: T) => U;
};

type ReconcileNocodeSelectionRowsOptions<T extends Record<string, any>, U extends Record<string, any> = T> = {
  availableRows?: T[];
  checkedRows?: T[];
  rowKey: string;
  mapRow?: (row: T) => U;
};

type ResolveNocodeSelectedRowAfterRefreshOptions<T extends Record<string, any>> = {
  isShowCheck?: boolean;
  checkedRows?: T[];
  selectedRow?: T | null;
};

type ResolveNocodeCheckAllStateOptions<T extends Record<string, any>> = {
  rows?: T[];
  checkedRows?: T[];
  rowKey: string;
};

type ShouldShowNocodeSelectionSequenceOptions = {
  isMultiple?: boolean;
  checked?: boolean;
  showIndexColumn?: boolean;
};

export const isNocodeRowChecked = <T extends Record<string, any>>(options: IsNocodeRowCheckedOptions<T>) => {
  const rowValue = options.row?.[options.rowKey];
  return Boolean((options.currentRows || []).some((item) => item?.[options.rowKey] === rowValue));
};

export const toggleNocodeSelection = <T extends Record<string, any>>(options: ToggleNocodeSelectionOptions<T>) => {
  const currentRows = options.currentRows || [];
  const rowValue = options.row?.[options.rowKey];
  const checked = isNocodeRowChecked({
    currentRows,
    row: options.row,
    rowKey: options.rowKey,
  });

  if (options.isMultiple) {
    return {
      checked: !checked,
      nextRows: checked
        ? currentRows.filter((item) => item?.[options.rowKey] !== rowValue)
        : [...currentRows, options.row],
    };
  }

  return {
    checked: !checked,
    nextRows: checked ? [] : [options.row],
  };
};

export const toggleNocodeSelectionState = <T extends Record<string, any>>(options: ToggleNocodeSelectionStateOptions<T>) => {
  const { checked, nextRows } = toggleNocodeSelection(options);
  const currentSelectedRow = options.currentSelectedRow ?? null;
  const currentSelectedRowKey = currentSelectedRow?.[options.rowKey];
  const rowValue = options.row?.[options.rowKey];
  const selectedRowChanged = checked || currentSelectedRowKey === rowValue;

  return {
    checked,
    nextRows,
    nextSelectedRow: checked ? options.row : currentSelectedRowKey === rowValue ? null : currentSelectedRow,
    selectedRowChanged,
  };
};

export const resolveNocodeRowClassName = <T extends Record<string, any>>(options: ResolveNocodeRowClassNameOptions<T>) => {
  const rowValue = options.row?.[options.rowKey];
  const selectedRowKey = options.selectedRow?.[options.rowKey];

  return [
    isNocodeRowChecked({
      currentRows: options.checkedRows,
      row: options.row,
      rowKey: options.rowKey,
    }) ? "is-row-checked" : "",
    !options.isShowCheck && rowValue !== undefined && rowValue === selectedRowKey ? "is-row-selected" : "",
    rowValue !== undefined && rowValue === options.openedRowKey ? "is-row-opened" : "",
  ].filter(Boolean).join(" ");
};

export const shouldShowNocodeSelectionSequence = (options: ShouldShowNocodeSelectionSequenceOptions) => {
  return Boolean(options.isMultiple && !options.checked && !options.showIndexColumn);
};

export const getNocodeRowSequence = <T extends Record<string, any>>(options: GetNocodeRowSequenceOptions<T>) => {
  const currentPage = Math.max(1, Number(options.currentPage) || 1);
  const pageSize = Math.max(0, Number(options.pageSize) || 0);
  const pageOffset = (currentPage - 1) * pageSize;
  const rowValue = options.row?.[options.rowKey];
  const sourceIndex = (options.rows || []).findIndex((item) => item?.[options.rowKey] === rowValue);

  if (sourceIndex >= 0) {
    return pageOffset + sourceIndex + 1;
  }

  return options.rowIndex + 1;
};

export const normalizeNocodeSelectionRows = <
  T extends Record<string, any>,
  U extends Record<string, any> = T,
>(options: NormalizeNocodeSelectionRowsOptions<T, U>) => {
  const rows = options.rows || [];
  const mapRow = options.mapRow || ((row: T) => row as unknown as U);

  if (!options.rowKey) {
    return rows.map(mapRow);
  }

  const uniqueRows = new Map<any, U>();
  for (const row of rows) {
    const rowValue = row?.[options.rowKey];
    if (rowValue === undefined || rowValue === null || uniqueRows.has(rowValue)) {
      continue;
    }
    uniqueRows.set(rowValue, mapRow(row));
  }
  return [...uniqueRows.values()];
};

export const reconcileNocodeSelectionRows = <
  T extends Record<string, any>,
  U extends Record<string, any> = T,
>(options: ReconcileNocodeSelectionRowsOptions<T, U>) => {
  const checkedRows = normalizeNocodeSelectionRows({
    rows: options.checkedRows,
    rowKey: options.rowKey,
  });
  const checkedRowKeys = new Set(checkedRows.map((row) => row?.[options.rowKey]));

  return normalizeNocodeSelectionRows({
    rows: (options.availableRows || []).filter((row) => checkedRowKeys.has(row?.[options.rowKey])),
    rowKey: options.rowKey,
    mapRow: options.mapRow,
  });
};

export const resolveNocodeSelectedRowAfterRefresh = <T extends Record<string, any>>(
  options: ResolveNocodeSelectedRowAfterRefreshOptions<T>,
) => {
  if (!options.isShowCheck) {
    return options.selectedRow ?? null;
  }
  if ((options.checkedRows || []).length > 0) {
    return options.selectedRow ?? null;
  }
  return null;
};

export const resolveNocodeCheckAllState = <T extends Record<string, any>>(
  options: ResolveNocodeCheckAllStateOptions<T>,
) => {
  const allRows = normalizeNocodeSelectionRows({
    rows: options.rows,
    rowKey: options.rowKey,
  });
  const checkedRows = normalizeNocodeSelectionRows({
    rows: options.checkedRows,
    rowKey: options.rowKey,
  });
  const checkedRowKeys = new Set(checkedRows.map((row) => row?.[options.rowKey]));
  const checkedCount = allRows.filter((row) => checkedRowKeys.has(row?.[options.rowKey])).length;
  const totalCount = allRows.length;

  return {
    totalCount,
    checkedCount,
    checked: totalCount > 0 && checkedCount === totalCount,
    indeterminate: checkedCount > 0 && checkedCount < totalCount,
  };
};
