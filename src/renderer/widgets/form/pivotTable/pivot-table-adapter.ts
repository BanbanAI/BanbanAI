export const CORE_PIVOT_GRAND_TOTAL_LABEL = "总计";
export const CORE_PIVOT_SUBTOTAL_LABEL = "小计";

export type PivotSummaryKind = "grand-total" | "subtotal" | null;

export const resolvePivotSummaryKind = (value: unknown): PivotSummaryKind => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (normalizedValue === CORE_PIVOT_GRAND_TOTAL_LABEL) {
    return "grand-total";
  }
  if (normalizedValue === CORE_PIVOT_SUBTOTAL_LABEL) {
    return "subtotal";
  }
  return null;
};

export const resolvePivotDisplayText = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
};
