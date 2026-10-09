type MaybeQueryValue = string | string[] | null | undefined;

export type VirtualTableLabRouteQuery = Record<string, MaybeQueryValue>;

export const hasTruthyQueryFlag = (value: MaybeQueryValue) => {
  if (Array.isArray(value)) {
    return value.some(hasTruthyQueryFlag);
  }
  return value === "1" || value === "true";
};

export const isVirtualTableLabRoute = (
  query?: VirtualTableLabRouteQuery,
) => {
  return hasTruthyQueryFlag(query?.virtualTableLab);
};

export const isPivotTableLabRoute = (
  query?: VirtualTableLabRouteQuery,
) => {
  return hasTruthyQueryFlag(query?.pivotTableLab);
};
