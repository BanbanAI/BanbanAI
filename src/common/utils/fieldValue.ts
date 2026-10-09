import type { Field, Row, Table } from "@common/types/project";
import type { NocodeFormData } from "@common/types/nocode";
import { formatNumberWithSeparator, truncateNumber } from "./amount";

const NUMERIC_WIDGET_TYPES = new Set<string>([
  "widget.form.numberInput",
  "widget.form.amountInput",
]);

const normalizeDecimalPlaces = (value: unknown) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.trunc(numericValue)));
};

const roundNumber = (value: number, decimalPlaces: number, rule?: string) => {
  if (rule === "truncate") {
    return truncateNumber(value, decimalPlaces);
  }
  return Number(value.toFixed(decimalPlaces));
};

type NumberFieldDisplayFormatOptions = {
  isPercent?: boolean;
  completeZero?: boolean;
  decimalPlaces?: number;
  decimalRoundingRule?: "round" | "truncate" | string;
  thousandSeparator?: string;
  decimalSeparator?: string;
};

export const isNumericValueField = (field?: Field | null) => {
  return NUMERIC_WIDGET_TYPES.has(field?.meta?.extra?.widgetType || "");
};

export const normalizeNumberFieldValue = (value: unknown, field?: Field | null) => {
  if (!isNumericValueField(field)) {
    return value;
  }
  if (value === null || value === undefined || value === "") {
    return value;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return value;
  }

  const extra = field?.meta?.extra || {};
  const decimalPlaces = normalizeDecimalPlaces(extra.decimalPlaces);
  if (decimalPlaces === null) {
    return numberValue;
  }

  if (extra.isPercent) {
    const normalizedPercentValue = roundNumber(numberValue * 100, decimalPlaces, extra.decimalRoundingRule);
    return Number((normalizedPercentValue / 100).toFixed(Math.min(100, decimalPlaces + 2)));
  }

  return roundNumber(numberValue, decimalPlaces, extra.decimalRoundingRule);
};

export const formatNumberFieldDisplayValue = (
  value: unknown,
  extra: NumberFieldDisplayFormatOptions = {},
) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  let numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    numberValue = 0;
  }

  const decimalPlaces = normalizeDecimalPlaces(extra.decimalPlaces) ?? 0;
  const displayValue = extra.isPercent ? numberValue * 100 : numberValue;
  const normalizedValue = roundNumber(displayValue, decimalPlaces, extra.decimalRoundingRule);
  const shouldUseSeparatorFormatter = Boolean(extra.thousandSeparator)
    || Boolean(extra.decimalSeparator && extra.decimalSeparator !== ".");

  if (shouldUseSeparatorFormatter) {
    return formatNumberWithSeparator(normalizedValue, {
      decimalPlaces,
      thousandSeparator: extra.thousandSeparator || "",
      decimalSeparator: extra.decimalSeparator || ".",
      decimalPadding: extra.completeZero,
    });
  }

  if (extra.completeZero) {
    return normalizedValue.toFixed(decimalPlaces);
  }

  return parseFloat(normalizedValue.toFixed(decimalPlaces)).toString();
};

const getSubTable = (formData: Pick<NocodeFormData, "tables">, field?: Field | null) => {
  const subTableUID = field?.meta?.extra?.subTableUID?.at(-1);
  if (!subTableUID) {
    return null;
  }
  return formData.tables?.find(table => table.uid === subTableUID) || null;
};

const normalizeRowNumberFieldValueByPath = (
  row: Row,
  table: Table,
  formData: Pick<NocodeFormData, "tables">,
  fieldUID: string,
) => {
  const [fieldId, subFieldId] = String(fieldUID || "").split(".");
  if (!fieldId) {
    return;
  }

  const field = table.fields?.find(item => item.uid === fieldId);
  if (!field) {
    return;
  }

  if (!subFieldId) {
    row[fieldId] = normalizeNumberFieldValue(row[fieldId], field);
    return;
  }

  const subTable = getSubTable(formData, field);
  const subField = subTable?.fields?.find(item => item.uid === subFieldId);
  if (!subField || !Array.isArray(row[fieldId])) {
    return;
  }

  for (const subRow of row[fieldId]) {
    if (!subRow || typeof subRow !== "object") {
      continue;
    }
    subRow[subFieldId] = normalizeNumberFieldValue(subRow[subFieldId], subField);
  }
};

export const normalizeRowNumberFieldValues = (
  row: Row,
  table: Table,
  formData: Pick<NocodeFormData, "tables">,
  fieldUIDs: string[] = [],
) => {
  for (const fieldUID of Array.from(new Set(fieldUIDs.filter(Boolean)))) {
    normalizeRowNumberFieldValueByPath(row, table, formData, fieldUID);
  }
  return row;
};
