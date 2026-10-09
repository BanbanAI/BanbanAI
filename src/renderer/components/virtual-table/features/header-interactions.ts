export type HeaderSortOrder = -1 | 0 | 1;
export type HeaderIndicatorKind =
  | "more"
  | "filter"
  | "sort-asc"
  | "sort-desc"
  | "filter-sort-asc"
  | "filter-sort-desc";

type HeaderColumnLike = {
  uid: string;
  isSubColumn?: boolean;
};

type HeaderConditionLike = {
  uid?: string | null;
  value?: any;
};

type ResolveNocodeHeaderSortOrderOptions = {
  sortFieldsMap?: Record<string, number | undefined>;
  columnUid: string;
};

type HasActiveNocodeHeaderFilterOptions = {
  enableHeaderFilterPanel?: boolean;
  filterConditions?: HeaderConditionLike[];
  column: HeaderColumnLike;
  parentColumn?: HeaderColumnLike;
};

type ResolveNocodeHeaderIndicatorKindOptions = {
  sortOrder?: number;
  hasFilter?: boolean;
};

const isFilterValueActive = (value: any) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null && value !== "";
};

export const resolveNocodeHeaderFilterKey = (column: HeaderColumnLike, parentColumn?: HeaderColumnLike) => {
  if (column.isSubColumn && parentColumn?.uid) {
    return `${parentColumn.uid}.${column.uid}`;
  }
  return column.uid;
};

export const resolveNocodeHeaderSortOrder = (options: ResolveNocodeHeaderSortOrderOptions): HeaderSortOrder => {
  const rawValue = Number(options.sortFieldsMap?.[options.columnUid] || 0);
  if (rawValue === 1) {
    return 1;
  }
  if (rawValue === -1) {
    return -1;
  }
  return 0;
};

export const hasActiveNocodeHeaderFilter = (options: HasActiveNocodeHeaderFilterOptions) => {
  if (!options.enableHeaderFilterPanel) {
    return false;
  }

  const filterKey = resolveNocodeHeaderFilterKey(options.column, options.parentColumn);
  return (options.filterConditions || []).some((condition) => {
    return condition?.uid === filterKey && isFilterValueActive(condition?.value);
  });
};

export const resolveNocodeHeaderIndicatorKind = (options: ResolveNocodeHeaderIndicatorKindOptions): HeaderIndicatorKind => {
  const sortOrder = Number(options.sortOrder || 0);
  if (sortOrder === 1 && options.hasFilter) {
    return "filter-sort-asc";
  }
  if (sortOrder === -1 && options.hasFilter) {
    return "filter-sort-desc";
  }
  if (sortOrder === 1) {
    return "sort-asc";
  }
  if (sortOrder === -1) {
    return "sort-desc";
  }
  if (options.hasFilter) {
    return "filter";
  }
  return "more";
};
