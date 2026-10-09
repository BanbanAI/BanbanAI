import type { Account } from "@common/types/account";
import dayjs from "dayjs";
import { FormWidgetType } from "@common/types/nocode";
import type { Field, Row, Table } from "@common/types/project";
import { createFormulaRuntimeByData, getFormulaStr, replaceByFormula } from "@common/utils/formula";
import { hasConfiguredValue } from "@common/utils/other";
import { isBuiltinField } from "@common/utils/connection";
import { deepClone } from "@common/utils/object";
// @ts-ignore
import { applyOrganizeFieldRuntimeDefaultToRow,hasOrganizeFieldRuntimeDefaultValue,} from "@renderer/views/nocode/components/organizeFieldDefaultValue";

type ManualSubFormWidget = {
  uid?: string;
  fieldId?: string;
  type?: string;
  field?: Field;
  getOption?: (paths: string | string[], options?: unknown) => unknown;
};

type ManualSubFormRuntime = {
  field?: Field;
  tableUID?: string[];
  children?: ManualSubFormWidget[];
  topForm?: {
    tableUID?: string[];
    getTable?: (uid?: string[]) => Table | undefined | null;
  };
  getTable?: (uid?: string[]) => Table | undefined | null;
};

export type ApplyManualSubFormRowDefaultsOptions = {
  row?: Row | null;
  subForm?: ManualSubFormRuntime | null;
  formData?: { tables?: Table[] } | null;
  account?: Partial<Account> | null;
  allowPopulatedRow?: boolean;
};

const TRANSIENT_ROW_KEYS = new Set<string>([
  "isManualAdd",
  "updateLastChangeTime",
]);

const isEmptyRuntimeValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return value === undefined || value === null || value === "";
};

const getSubTableUID = (field?: Field) => {
  const uid = field?.meta?.extra?.subTableUID;
  return Array.isArray(uid) ? uid : undefined;
};

const getTableByUID = (
  tableUID: string[] | undefined,
  subForm?: ManualSubFormRuntime | null,
  formData?: { tables?: Table[] } | null,
) => {
  if (!tableUID?.length) {
    return null;
  }

  const tableId = tableUID.at(-1);
  return subForm?.getTable?.(tableUID)
    || subForm?.topForm?.getTable?.(tableUID)
    || formData?.tables?.find(table => table.uid === tableId)
    || null;
};

const resolveSubTable = (
  subForm?: ManualSubFormRuntime | null,
  formData?: { tables?: Table[] } | null,
) => {
  const subTableUID = subForm?.tableUID || getSubTableUID(subForm?.field);
  return getTableByUID(subTableUID, subForm, formData);
};

const getWidgetField = (
  widget: ManualSubFormWidget,
  subTable?: Table | null,
) => {
  return widget.field
    || subTable?.fields?.find(field => field.meta?.uid === widget.uid || field.uid === widget.fieldId)
    || null;
};

const getFieldId = (widget: ManualSubFormWidget, field?: Field | null) => {
  return widget.fieldId || field?.uid || "";
};

const getWidgetRuntimeDefaultValue = (
  widget: ManualSubFormWidget,
  field: Field,
) => {
  if (
    widget.type === FormWidgetType.DATE_PICKER
    && widget.getOption?.("default-type") === "currentDate"
  ) {
    return dayjs().format("YYYY-MM-DD HH:mm:ss");
  }

  const widgetDefaultValue = widget.getOption?.("default-value");
  return isEmptyRuntimeValue(widgetDefaultValue)
    ? field.meta?.extra?.defaultValue
    : widgetDefaultValue;
};

const isFormulaDefaultField = (field?: Field | null) => {
  const extra = field?.meta?.extra;
  return extra?.defaultValueType === "formula"
    && extra?.defaultComputeType !== "quickCompute"
    && !!getFormulaStr(extra?.formula);
};

const isRuntimeDefaultField = (
  field: Field,
  defaultValue: unknown,
  widgetType?: string,
) => {
  const extra = field.meta?.extra;
  return (
    (extra?.defaultValueType && extra.defaultValueType !== "formula" && hasConfiguredValue(defaultValue))
    || hasOrganizeFieldRuntimeDefaultValue({
      defaultValue,
      field,
      widgetType,
    })
  );
};

const isOrganizeRuntimeDefaultField = (
  field: Field,
  defaultValue: unknown,
  widgetType?: string,
) => {
  return hasOrganizeFieldRuntimeDefaultValue({
    defaultValue,
    field,
    widgetType,
  });
};

const isIgnoredBusinessValueField = (field?: Field | null, widget?: ManualSubFormWidget) => {
  return !field
    || isBuiltinField(field)
    || field.meta?.extra?.widgetType === FormWidgetType.SERIAL_NUMBER
    || widget?.type === FormWidgetType.SERIAL_NUMBER;
};

const hasManualRowBusinessValue = (
  row: Row,
  widgets: ManualSubFormWidget[] = [],
  subTable?: Table | null,
) => {
  const fieldById = (subTable?.fields || []).reduce<Record<string, { field: Field | null, widget?: ManualSubFormWidget }>>((prev, field) => {
    if (field.uid) {
      prev[field.uid] = { field };
    }
    return prev;
  }, {});

  widgets.forEach((widget) => {
    const field = getWidgetField(widget, subTable);
    const fieldId = getFieldId(widget, field);
    if (fieldId) {
      fieldById[fieldId] = { field, widget };
    }
  });

  return Object.entries(row || {}).some(([key, value]) => {
    if (TRANSIENT_ROW_KEYS.has(key) || key.startsWith("__")) {
      return false;
    }
    if (isEmptyRuntimeValue(value)) {
      return false;
    }
    const fieldInfo = fieldById[key];
    return !isIgnoredBusinessValueField(fieldInfo?.field, fieldInfo?.widget);
  });
};

const getFormulaTokenValue = (row: Row, subTable: Table, keys: string[] = []) => {
  const fieldToken = keys.at(-1) || "";
  if (!fieldToken) {
    return undefined;
  }

  const field = subTable.fields?.find(item => item.uid === fieldToken || item.meta?.uid === fieldToken);
  return field ? row[field.uid] : undefined;
};

const calculateFormulaDefaultValue = (
  row: Row,
  subTable: Table,
  field: Field,
) => {
  let hasUnresolvedReference = false;
  const formula = replaceByFormula(getFormulaStr(field.meta?.extra?.formula), keys => {
    const value = getFormulaTokenValue(row, subTable, keys);
    if (value === undefined) {
      hasUnresolvedReference = true;
    }
    return value as any;
  });
  if (!formula || hasUnresolvedReference) {
    return undefined;
  }

  try {
    return createFormulaRuntimeByData(row, subTable.fields)?.evaluate(formula);
  } catch {
    return undefined;
  }
};

export const applyManualSubFormRowDefaults = ({
  row,
  subForm,
  formData,
  account,
  allowPopulatedRow = false,
}: ApplyManualSubFormRowDefaultsOptions) => {
  if (!row?.["isManualAdd"] || !subForm?.field) {
    return false;
  }

  const subTable = resolveSubTable(subForm, formData);
  const widgets = subForm.children || [];
  if (!subTable || !widgets.length || (!allowPopulatedRow && hasManualRowBusinessValue(row, widgets, subTable))) {
    return false;
  }

  const formulaFields: Array<{ field: Field, fieldId: string }> = [];
  let changed = false;

  widgets.forEach((widget) => {
    const field = getWidgetField(widget, subTable);
    const fieldId = getFieldId(widget, field);
    if (!field || !fieldId || !isEmptyRuntimeValue(row[fieldId])) {
      return;
    }

    if (isFormulaDefaultField(field)) {
      formulaFields.push({ field, fieldId });
      return;
    }

    const defaultValue = getWidgetRuntimeDefaultValue(widget, field);
    if (!isRuntimeDefaultField(field, defaultValue, widget.type)) {
      return;
    }

    if (isOrganizeRuntimeDefaultField(field, defaultValue, widget.type)) {
      changed = applyOrganizeFieldRuntimeDefaultToRow({
        row,
        field,
        fieldId,
        defaultValue,
        widgetType: widget.type,
        account,
      }) || changed;
      return;
    }

    if (isEmptyRuntimeValue(defaultValue)) {
      return;
    }
    row[fieldId] = deepClone(defaultValue);
    changed = true;
  });

  if (formulaFields.length) {
    for (const { field, fieldId } of formulaFields) {
      if (!isEmptyRuntimeValue(row[fieldId])) {
        continue;
      }
      const value = calculateFormulaDefaultValue(row, subTable, field);
      if (isEmptyRuntimeValue(value)) {
        continue;
      }
      row[fieldId] = value;
      changed = true;
    }
  }

  return changed;
};
