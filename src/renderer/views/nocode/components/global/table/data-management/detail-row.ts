import { Row, TableUID } from "@common/types/project";

export const DATA_MANAGEMENT_FORM_MODE = {
  Add: "add",
  Edit: "edit",
} as const;

type DataManagementFormMode = typeof DATA_MANAGEMENT_FORM_MODE[keyof typeof DATA_MANAGEMENT_FORM_MODE];

type ResolveCurrentDetailRowOptions = {
  explicitRow?: Row | null;
  uuid?: string | number | null;
  selectedRow?: Row | null;
  visibleRows?: Row[] | null;
  allRows?: Row[] | null;
  rowKey: string;
  normalizeRow: (row?: Row | null) => Row | null | undefined;
};

type ResolveDetailActionRowOptions = {
  detailVisible: boolean;
  detailFormMode: DataManagementFormMode;
  detailTableUID?: TableUID;
  tableUID: TableUID;
  detailRow?: Row | null;
  selectedRow?: Row | null;
};

const cloneRow = (row?: Row | null) => {
  if (!row) {
    return null;
  }
  return {
    ...row,
  };
};

export const resolveDataManagementCurrentDetailRow = (
  options: ResolveCurrentDetailRowOptions,
) => {
  const normalizedExplicitRow = options.normalizeRow(options.explicitRow) || null;
  if (normalizedExplicitRow) {
    return cloneRow(normalizedExplicitRow);
  }

  const nextUuid = options.uuid === undefined || options.uuid === null
    ? ""
    : String(options.uuid);

  if (!nextUuid) {
    return null;
  }

  const normalizedSelectedRow = options.normalizeRow(options.selectedRow) || null;
  if (normalizedSelectedRow?.[options.rowKey] === nextUuid) {
    return cloneRow(normalizedSelectedRow);
  }

  const rowGroups = [options.visibleRows || [], options.allRows || []];
  for (const rows of rowGroups) {
    const matchedRow = rows.find((row) => {
      return String(options.normalizeRow(row)?.[options.rowKey] || "") === nextUuid;
    });
    const normalizedMatchedRow = options.normalizeRow(matchedRow) || null;
    if (normalizedMatchedRow) {
      return cloneRow(normalizedMatchedRow);
    }
  }

  return null;
};

export const resolveDataManagementDetailActionRow = (
  options: ResolveDetailActionRowOptions,
) => {
  if (
    !options.detailVisible
    || options.detailFormMode !== DATA_MANAGEMENT_FORM_MODE.Edit
    || options.detailTableUID !== options.tableUID
  ) {
    return null;
  }

  return options.detailRow || options.selectedRow || null;
};
