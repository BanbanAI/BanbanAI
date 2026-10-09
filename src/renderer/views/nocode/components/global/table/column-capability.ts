import { FieldUID } from "@common/types/project";
import { SystemField } from "@common/utils";

const AUTO_COMPUTE_WIDGET_TYPE = "widget.form.autoCompute";

export type ColumnLike = {
  uid: FieldUID | string,
  name?: string,
  extra?: {
    widgetType?: string,
  } | Record<string, any>,
  subColumns?: ColumnLike[],
}

export const isAutoComputeColumn = (column?: Pick<ColumnLike, "extra"> | null) => {
  return column?.extra?.widgetType === AUTO_COMPUTE_WIDGET_TYPE;
};

export const findColumnByFieldId = (columns: ColumnLike[] = [], fieldId?: string | null): ColumnLike | null => {
  if (!fieldId) {
    return null;
  }

  const [columnUID, subColumnUID] = fieldId.split(".");
  const column = columns.find(item => item.uid === columnUID);
  if (!column) {
    return null;
  }
  if (!subColumnUID) {
    return column;
  }
  return column.subColumns?.find(item => item.uid === subColumnUID) || null;
};

export const isAutoComputeFieldId = (columns: ColumnLike[] = [], fieldId?: string | null) => {
  return isAutoComputeColumn(findColumnByFieldId(columns, fieldId));
};

export const isSortDisabledSystemColumn = (
  column?: Pick<ColumnLike, "uid" | "extra" | "name"> | null,
) => {
  return [
    SystemField.DATA_TITLE,
    SystemField.CURRENT_OWNER,
    SystemField.UUID,
    SystemField.RELATED_SUB_FORM,
  ].includes(column?.name as any);
};

export const filterAutoComputeConditions = <T extends { uid?: string }>(conditions: T[] = [], columns: ColumnLike[] = []) => {
  return conditions.filter(condition => !isAutoComputeFieldId(columns, condition.uid));
};

export const filterAutoComputeSortFields = <T extends { field?: string }>(sortFields: T[] = [], columns: ColumnLike[] = []) => {
  return sortFields.filter(item => !isAutoComputeFieldId(columns, item.field));
};
