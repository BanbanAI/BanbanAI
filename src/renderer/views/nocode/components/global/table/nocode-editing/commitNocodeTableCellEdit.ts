import type { Row } from "../../../../../../../common/types/project";
import { cloneDeep as deepClone } from "lodash";
import { equals } from "@common/utils/object";
import { getFormulaFields, rowsDefaultValueCalculation } from "@common/utils/formula";
import type { VirtualTableEditCommitResult } from "@renderer/components/virtual-table";
import type { CommitNocodeTableCellEditOptions, NocodeTableColumnLike, NocodeTableEditingTableProps } from "./types";

type NocodeTableLike = {
  fields: any[];
};

const UUID_SYSTEM_FIELD = "_uuid";
const KEY_SYSTEM_FIELD = "_key";

const getNocodeUuidField = (fields: any[] = []) => {
  return fields.find((field) => field?.meta?.name === UUID_SYSTEM_FIELD);
};

const resolvePermissionRow = (
  options: {
    widget: any;
    row: Record<string, any>;
  },
) => {
  const rowKeyField = options.widget?.rowKey;
  const rowKey = rowKeyField ? options.row?.[rowKeyField] : undefined;
  if ((typeof rowKey !== "string" && typeof rowKey !== "number")) {
    return options.row;
  }
  return options.widget?.getRow?.(rowKey) || options.row;
};

type NocodeTableEditingDeps = {
  cloneRow?: <T>(value: T) => T;
  getFormulaFields?: (...args: any[]) => any[];
  rowsDefaultValueCalculation?: (...args: any[]) => void;
};

const resolveNocodeTableEditingDeps = (
  deps?: NocodeTableEditingDeps,
) => {
  if (deps?.getFormulaFields && deps?.rowsDefaultValueCalculation) {
    return {
      cloneRow: deps.cloneRow || deepClone,
      getFormulaFields: deps.getFormulaFields,
      rowsDefaultValueCalculation: deps.rowsDefaultValueCalculation,
    };
  }

  return {
    cloneRow: deps?.cloneRow || deepClone,
    getFormulaFields,
    rowsDefaultValueCalculation,
  };
};

const getFilterRules = (
  widget: { filterRule?: any },
  tableProps?: NocodeTableEditingTableProps,
) => {
  return [
    widget.filterRule,
    ...(tableProps?.preViewFilterRules || []),
    tableProps?.preFilterRule,
  ].filter(Boolean);
};

export const isNocodeTableColumnUsedInFilters = (
  options: {
    column: NocodeTableColumnLike;
    widget: { filterRule?: any };
    tableProps?: NocodeTableEditingTableProps;
  },
) => {
  const currentColumnFilterKey = options.column.params.isSubColumn
    ? `${options.column.params.parentUID}.${options.column.field}`
    : String(options.column.field || "");

  if (!currentColumnFilterKey) {
    return false;
  }

  return getFilterRules(options.widget, options.tableProps).some((rule) => {
    return rule?.conditions?.some((condition) => condition?.uid === currentColumnFilterKey);
  });
};

export const buildNocodeTableRowDiff = (
  options: {
    oldRow: Record<string, any>;
    newRow: Record<string, any>;
    table: NocodeTableLike;
    getTable: (uid: string) => NocodeTableLike | null | undefined;
    startRow?: Record<string, any>;
  },
): Record<string, any> => {
  const uuidField = getNocodeUuidField(options.table.fields);
  const uuid = uuidField?.uid;
  const result = {
    ...(options.startRow || {}),
    ...(uuid ? { [uuid]: options.newRow?.[uuid] } : {}),
  };

  for (const key of Object.keys(options.newRow || {})) {
    if (uuid && key === uuid) {
      continue;
    }
    if (equals(options.newRow[key], options.oldRow?.[key])) {
      continue;
    }

    const field = options.table.fields.find((item) => item.uid === key);
    if (field?.meta?.subType === "subform") {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const subTable = subTableUID ? options.getTable(subTableUID) : null;
      if (!subTable?.fields?.length) {
        continue;
      }
      const subUuidField = subTable ? getNocodeUuidField(subTable.fields) : null;
      const subUuid = subUuidField?.uid;
      const keyField = subTable?.fields?.find((item) => item.meta?.name === KEY_SYSTEM_FIELD)?.uid;
      const subTableRows = options.newRow[key] || [];
      const oldSubTableRows = options.oldRow?.[key] || [];
      result[key] = [];

      for (const subRow of subTableRows) {
        const oldSubRow = oldSubTableRows.find((item) => item?.[subUuid] === subRow?.[subUuid]);
        const subDiff = buildNocodeTableRowDiff({
          oldRow: oldSubRow || {},
          newRow: subRow,
          table: subTable,
          getTable: options.getTable,
          startRow: keyField ? { [keyField]: options.newRow?.[uuid] } : {},
        });
        if (Object.keys(subDiff).length > 0) {
          result[key].push(subDiff);
        }
      }
      continue;
    }

    result[key] = options.newRow[key];
  }

  return result;
};

const applyNextValueToWorkingRow = (
  options: {
    workingRow: Record<string, any>;
    sourceRow: Record<string, any>;
    column: NocodeTableColumnLike;
    widget: any;
    nextValue: any;
  },
) => {
  if (!options.workingRow || typeof options.workingRow !== "object") {
    return undefined;
  }

  if (options.column.params.isSubColumn) {
    const subTable = options.widget.getTable(options.column.params.tableUID);
    if (!subTable?.fields?.length) {
      return undefined;
    }
    const subUuid = getNocodeUuidField(subTable.fields)?.uid;
    const subTableRows = Array.isArray(options.workingRow[options.column.params.parentUID])
      ? options.workingRow[options.column.params.parentUID]
      : [];
    const targetSubRow = subTableRows.find((item) => item?.[subUuid] === options.sourceRow?.[subUuid]);
    if (targetSubRow) {
      targetSubRow[options.column.field] = options.nextValue;
    }
    return subTable.fields.find((item) => item.uid === options.column.field);
  }

  options.workingRow[options.column.field] = options.nextValue;
  return options.widget.table.fields.find((item) => item.uid === options.column.field);
};

const applyCellValueToRowSnapshot = (
  options: {
    rowSnapshot: Record<string, any>;
    sourceRow: Record<string, any>;
    column: NocodeTableColumnLike;
    widget: any;
    value: any;
  },
) => {
  if (!options.rowSnapshot || typeof options.rowSnapshot !== "object") {
    return;
  }

  if (options.column.params.isSubColumn) {
    const subTable = options.widget.getTable(options.column.params.tableUID);
    if (!subTable?.fields?.length) {
      return;
    }
    const subUuid = getNocodeUuidField(subTable.fields)?.uid;
    const subTableRows = Array.isArray(options.rowSnapshot[options.column.params.parentUID])
      ? options.rowSnapshot[options.column.params.parentUID]
      : [];
    const targetSubRow = subTableRows.find((item) => item?.[subUuid] === options.sourceRow?.[subUuid]);
    if (targetSubRow) {
      targetSubRow[options.column.field] = options.value;
    }
    return;
  }

  options.rowSnapshot[options.column.field] = options.value;
};

export const commitNocodeTableCellEdit = async (
  options: CommitNocodeTableCellEditOptions,
  deps?: NocodeTableEditingDeps,
): Promise<VirtualTableEditCommitResult<Record<string, any>>> => {
  const resolvedDeps = resolveNocodeTableEditingDeps(deps);
  const permissionRow = resolvePermissionRow({
    widget: options.widget,
    row: options.row,
  });
  if (options.widget.canEditRow?.(permissionRow) === false) {
    return {
      status: "refreshed",
    };
  }
  const rowUUID = options.row?.[options.widget.rowKey];
  const workingRow = options.column.params.isSubColumn
    ? await options.widget.getFullRow(rowUUID, options.column.params.parentUID)
    : options.widget.getRow(rowUUID);

  if (!workingRow || typeof workingRow !== "object") {
    return {
      status: "rejected",
      message: "missing_working_row",
    };
  }

  const previousRow = resolvedDeps.cloneRow(workingRow);
  applyCellValueToRowSnapshot({
    rowSnapshot: previousRow,
    sourceRow: options.row,
    column: options.column,
    widget: options.widget,
    value: options.previousValue,
  });
  const changedField = applyNextValueToWorkingRow({
    workingRow,
    sourceRow: options.row,
    column: options.column,
    widget: options.widget,
    nextValue: options.nextValue,
  });
  if (!changedField) {
    return {
      status: "rejected",
      message: "missing_edit_field",
    };
  }

  const formulaFields = resolvedDeps.getFormulaFields([changedField], options.widget.table.fields, options.widget.tables);
  resolvedDeps.rowsDefaultValueCalculation(
    [workingRow],
    { formulaFields, defaultFields: [] },
    options.widget.table,
    options.widget.formData,
  );

  const diffRow = buildNocodeTableRowDiff({
    oldRow: previousRow,
    newRow: workingRow,
    table: options.widget.table,
    getTable: (uid) => options.widget.getTable(uid),
  });

  await options.widget.updateRows([diffRow]);

  if (
    options.column.params.isSubColumn
    || isNocodeTableColumnUsedInFilters({
      column: options.column,
      widget: options.widget,
      tableProps: options.tableProps,
    })
  ) {
    options.widget.refreshData();
    return {
      status: "refreshed",
    };
  }

  options.widget.patchLocalRow(diffRow);
  return {
    status: "patched",
    row: diffRow,
  };
};

export const commitNocodeTablePreparedRow = async (
  options: {
    widget: any;
    column: NocodeTableColumnLike;
    nextRow: Record<string, any>;
    tableProps?: NocodeTableEditingTableProps;
  },
): Promise<VirtualTableEditCommitResult<Record<string, any>>> => {
  await options.widget.updateRows([options.nextRow]);

  if (
    options.column.params.isSubColumn
    || isNocodeTableColumnUsedInFilters({
      column: options.column,
      widget: options.widget,
      tableProps: options.tableProps,
    })
  ) {
    options.widget.refreshData();
    return {
      status: "refreshed",
    };
  }

  options.widget.patchLocalRow(options.nextRow);
  return {
    status: "patched",
    row: options.nextRow,
  };
};
