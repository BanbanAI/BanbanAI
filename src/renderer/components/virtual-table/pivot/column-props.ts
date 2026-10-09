import type { VirtualTableColumnMeta, VirtualTableFixed } from "../types";

const isRecord = (value: unknown): value is Record<string, any> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const omitKeys = (
  source: Record<string, any> | null | undefined,
  keys: string[],
) => {
  if (!isRecord(source)) {
    return {};
  }
  const blocked = new Set(keys);
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !blocked.has(key)),
  );
};

export const getLeftMetaColumnPassthrough = (
  column: Record<string, any> | null | undefined,
) => {
  return omitKeys(column, [
    "key",
    "lock",
    "name",
    "render",
    "getCellProps",
  ]);
};

export const getTreeNodeColumnPassthrough = (
  node: Record<string, any> | null | undefined,
) => {
  return omitKeys(node, [
    "key",
    "lock",
    "value",
    "children",
    "data",
    "hidden",
    "hasChild",
  ]);
};

export const getIndicatorColumnPassthrough = (
  indicator: Record<string, any> | null | undefined,
) => {
  return omitKeys(indicator, [
    "code",
    "lock",
    "name",
    "hidden",
    "getValue",
    "render",
    "getCellProps",
  ]);
};

export const getDimensionColumnPassthrough = (
  dimension: Record<string, any> | null | undefined,
) => {
  return omitKeys(dimension, [
    "code",
    "lock",
    "name",
  ]);
};

export const normalizeVirtualTableFixed = (
  fixed: unknown,
  lock: unknown,
  fallback?: VirtualTableFixed,
): VirtualTableFixed | undefined => {
  if (fixed === "left" || fixed === "right") {
    return fixed;
  }
  if (lock === "left" || lock === "right") {
    return lock;
  }
  if (lock === true) {
    return "left";
  }
  return fallback;
};

export const mergePivotColumnMeta = (
  sourceMeta: Record<string, any> | null | undefined,
  pivotMeta: Record<string, any>,
): VirtualTableColumnMeta => {
  const resolvedSourceMeta = isRecord(sourceMeta) ? sourceMeta : {};
  return {
    ...resolvedSourceMeta,
    kind: "data",
    pivot: {
      ...(isRecord(resolvedSourceMeta.pivot) ? resolvedSourceMeta.pivot : {}),
      ...pivotMeta,
    },
  };
};
