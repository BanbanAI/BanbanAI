export type PivotIndicatorFieldFormat = {
  isPercent?: boolean;
  completeZero?: boolean;
  decimalPlaces?: number;
  decimalRoundingRule?: "round" | "truncate";
  unitPosition?: "suffix" | "prefix";
  unit?: string;
  thousandSeparator?: string;
  decimalSeparator?: string;
};

const normalizeDecimalPlaces = (value: any) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.trunc(numericValue)));
};

const truncateNumber = (value: number, decimalPlaces: number) => {
  const factor = 10 ** decimalPlaces;
  const sign = value < 0 ? -1 : 1;
  return (Math.floor(Math.abs(value) * factor) / factor) * sign;
};

const formatNumberWithSeparator = (
  value: number,
  options: {
    decimalPlaces: number;
    thousandSeparator: string;
    decimalSeparator: string;
    decimalPadding?: boolean;
  },
) => {
  let text = value.toFixed(options.decimalPlaces);
  if (!options.decimalPadding && options.decimalPlaces > 0) {
    text = text.replace(/\.?0+$/, "");
  }

  const parts = text.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, options.thousandSeparator);
  return parts.join(options.decimalSeparator);
};

const formatFloat = (
  value: number,
  decimalPlaces: number,
  completeZero: boolean,
) => {
  const text = value.toFixed(decimalPlaces);
  return completeZero ? text : parseFloat(text).toString();
};

const roundNumberByRule = (value: number, decimalPlaces: number, rule?: string) => {
  if (rule === "truncate") {
    return truncateNumber(value, decimalPlaces);
  }
  return Number(value.toFixed(decimalPlaces));
};

const resolveThousandSeparator = (value: any) => {
  if (value === true) return ",";
  return typeof value === "string" ? value : "";
};

export const resolvePivotIndicatorFieldFormat = (
  sourceField: any,
  summary: string,
): PivotIndicatorFieldFormat | undefined => {
  const sourceFieldExtra = sourceField?.meta?.extra || {};
  if (sourceField?.meta?.subType !== "number" || ["count", "distinct"].includes(summary)) {
    return undefined;
  }

  return {
    isPercent: Boolean(sourceFieldExtra.isPercent),
    completeZero: Boolean(sourceFieldExtra.completeZero),
    decimalPlaces: normalizeDecimalPlaces(sourceFieldExtra.decimalPlaces) ?? undefined,
    decimalRoundingRule: sourceFieldExtra.decimalRoundingRule,
    unitPosition: sourceFieldExtra.unitPosition,
    unit: sourceFieldExtra.unit,
    thousandSeparator: resolveThousandSeparator(sourceFieldExtra.thousandSeparator),
    decimalSeparator: typeof sourceFieldExtra.decimalSeparator === "string"
      ? sourceFieldExtra.decimalSeparator
      : ".",
  };
};

export const formatPivotIndicatorValueByExtra = (
  value: any,
  fieldFormat?: PivotIndicatorFieldFormat,
) => {
  if (value === null || value === undefined || value === "" || !fieldFormat) return value;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;

  const decimalPlaces = normalizeDecimalPlaces(fieldFormat.decimalPlaces) ?? 0;
  const normalizedValue = fieldFormat.isPercent ? numericValue * 100 : numericValue;
  const roundedValue = roundNumberByRule(
    normalizedValue,
    decimalPlaces,
    fieldFormat.decimalRoundingRule,
  );
  const formattedValue = fieldFormat.thousandSeparator
    ? formatNumberWithSeparator(roundedValue, {
      decimalPlaces,
      thousandSeparator: fieldFormat.thousandSeparator,
      decimalSeparator: fieldFormat.decimalSeparator || ".",
      decimalPadding: fieldFormat.completeZero,
    })
    : formatFloat(roundedValue, decimalPlaces, Boolean(fieldFormat.completeZero));
  const prefix = !fieldFormat.isPercent && fieldFormat.unitPosition === "prefix"
    ? (fieldFormat.unit || "")
    : "";
  const suffix = !fieldFormat.isPercent && fieldFormat.unitPosition === "suffix"
    ? (fieldFormat.unit || "")
    : "";

  return `${prefix}${formattedValue}${fieldFormat.isPercent ? "%" : ""}${suffix}`;
};
