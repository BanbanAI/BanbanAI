import { Column } from "../table";
import { toggleNocodeSelectionState } from "@renderer/components/virtual-table/features/selection";
import { DataManagementControllerOptions } from "./types";

type CommitSelectionOptions = {
  row: Record<string, any>;
  column?: Column | null;
};

type HandleRowActivateOptions = {
  row: Record<string, any>;
  column?: Column | null;
  syncSelectedRow: boolean;
};

type ToggleAllSelectionOptions = {
  rows: Record<string, any>[];
};

const cloneRow = <T extends Record<string, any>>(row?: T | null) => {
  if (!row) {
    return null;
  }
  return {
    ...row,
  };
};

const resolveSourceColumn = (column?: Column | Record<string, any> | null) => {
  if (!column) {
    return null;
  }
  return (column as Record<string, any>)?.meta?.sourceColumn || column || null;
};

export const createDataManagementTableController = (
  options: DataManagementControllerOptions,
) => {
  const getRowKey = (row?: Record<string, any> | null) => {
    return row?.[options.widget.rowKey];
  };

  const setSelectedRow = (row?: Record<string, any> | null, column?: Column | Record<string, any> | null) => {
    options.widget.setSelectedRow(cloneRow(row), resolveSourceColumn(column));
  };

  const commitSelection = ({ row, column }: CommitSelectionOptions) => {
    if (!options.isShowCheck) {
      setSelectedRow(row, column || null);
      return {
        checked: true,
        nextRows: options.widget.checkboxRow || [],
        nextSelectedRow: row,
        selectedRowChanged: true,
      };
    }

    const result = toggleNocodeSelectionState({
      currentRows: options.widget.checkboxRow || [],
      currentSelectedRow: options.widget.selectedRow || null,
      row,
      rowKey: options.widget.rowKey,
      isMultiple: options.isMultiple,
    });

    options.widget.setCheckboxRow(result.nextRows.map((item) => cloneRow(item)).filter(Boolean));

    if (result.selectedRowChanged) {
      setSelectedRow(result.nextSelectedRow, column || null);
    }

    return result;
  };

  const toggleAllSelection = ({ rows }: ToggleAllSelectionOptions) => {
    const currentRowKeys = new Set((options.widget.checkboxRow || []).map((row) => getRowKey(row)));
    const allChecked = rows.length > 0 && rows.every((row) => currentRowKeys.has(getRowKey(row)));
    const isChecked = !allChecked;

    options.widget.setCheckboxRow(isChecked ? rows.map((row) => cloneRow(row)).filter(Boolean) : []);
    if (!isChecked) {
      setSelectedRow(null, null);
    }

    return {
      rows,
      isChecked,
    };
  };

  const handleRowActivate = ({ row, column, syncSelectedRow }: HandleRowActivateOptions) => {
    if (!options.clickRowShowDetail) {
      return;
    }

    if (syncSelectedRow) {
      setSelectedRow(row, column || null);
    }

    options.onRowActivate?.({
      row,
      rowKey: getRowKey(row),
      column: resolveSourceColumn(column),
    });
  };

  return {
    commitSelection,
    toggleAllSelection,
    handleRowActivate,
  };
};
