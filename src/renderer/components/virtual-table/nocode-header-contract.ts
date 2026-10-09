import { FieldUID } from "@common/types/project";
import { resolveNocodeColumnFixed, resolveNocodeColumnWidth } from "./features/column-sizing";
import {
  hasActiveNocodeHeaderFilter,
  HeaderIndicatorKind,
  HeaderSortOrder,
  resolveNocodeHeaderFilterKey,
  resolveNocodeHeaderIndicatorKind,
  resolveNocodeHeaderSortOrder,
} from "./features/header-interactions";

type NocodeHeaderColumnLike = {
  uid: FieldUID;
  alias: string;
  isSubColumn?: boolean;
  subColumns?: NocodeHeaderColumnLike[];
  [key: string]: any;
};

type NocodeHeaderConditionLike = {
  uid?: string | null;
  value?: any;
};

export type NocodeHeaderMenuMode = "full" | "sort-root-only";

export type NocodeHeaderActionKey =
  | "sort-asc"
  | "sort-desc"
  | "freeze"
  | "unfreeze"
  | "hide"
  | "update-data";

export type NocodeHeaderDescriptor = {
  key: string;
  uid: string;
  title: string;
  parentUid?: string;
  isLeaf: boolean;
  width: number;
  fixed?: "left" | "right";
  sortOrder: HeaderSortOrder;
  hasFilter: boolean;
  indicatorKind: HeaderIndicatorKind;
  filterKey: string;
  actionKeys: NocodeHeaderActionKey[];
  disabledActionKeys?: NocodeHeaderActionKey[];
  sourceColumn: NocodeHeaderColumnLike;
};

type ResolveNocodeHeaderActionKeysOptions = {
  sortable?: boolean;
  hideColumnsAble?: boolean;
  updateColumnDataAble?: boolean;
  headerMenuMode?: NocodeHeaderMenuMode;
  isAutoComputeColumn?: (column: NocodeHeaderColumnLike) => boolean;
  isSystemColumnWithoutSortAndFilter?: (column: NocodeHeaderColumnLike) => boolean;
  canUpdateColumnData?: (column: NocodeHeaderColumnLike) => boolean;
};

type BuildNocodeHeaderDescriptorsOptions = ResolveNocodeHeaderActionKeysOptions & {
  displayColumns: NocodeHeaderColumnLike[];
  tableWidthData?: Record<string, number>;
  sortFieldsMap?: Record<string, number | undefined>;
  filterConditions?: NocodeHeaderConditionLike[];
  enableHeaderFilterPanel?: boolean;
  isFixedColumn?: (uid: FieldUID) => string | undefined;
  isPresetFreezeActive?: boolean;
  isPresetFixedColumn?: (uid: FieldUID) => boolean;
  fixedColumnId?: FieldUID | null;
};

const shouldShowUpdateDataAction = (
  column: NocodeHeaderColumnLike,
  options: ResolveNocodeHeaderActionKeysOptions,
) => {
  if (!options.updateColumnDataAble) {
    return false;
  }
  return options.canUpdateColumnData?.(column) ?? false;
};

const shouldDisableSortForColumn = (
  column: NocodeHeaderColumnLike,
  options: ResolveNocodeHeaderActionKeysOptions,
) => {
  return options.isSystemColumnWithoutSortAndFilter?.(column) ?? false;
};

export const resolveNocodeHeaderActionKeys = (
  column: NocodeHeaderColumnLike,
  parentColumn: NocodeHeaderColumnLike | undefined,
  options: ResolveNocodeHeaderActionKeysOptions,
): NocodeHeaderActionKey[] => {
  const isGroup = Boolean(column.subColumns?.length);
  const isAutoCompute = options.isAutoComputeColumn?.(column) ?? false;
  const canSort = Boolean(options.sortable && !isAutoCompute && !shouldDisableSortForColumn(column, options));

  const sortActions = canSort ? (["sort-asc", "sort-desc"] satisfies NocodeHeaderActionKey[]) : [];
  const hideActions = options.hideColumnsAble ? (["hide"] satisfies NocodeHeaderActionKey[]) : [];
  const updateDataActions = shouldShowUpdateDataAction(column, options)
    ? (["update-data"] satisfies NocodeHeaderActionKey[])
    : [];

  if (options.headerMenuMode === "sort-root-only") {
    if (column.isSubColumn || isGroup) {
      return [];
    }
    return sortActions;
  }

  if (column.isSubColumn) {
    return [...hideActions, ...updateDataActions];
  }

  if (isGroup) {
    return [...(parentColumn ? [] : ["freeze"] satisfies NocodeHeaderActionKey[]), ...hideActions];
  }

  return [
    ...sortActions,
    "freeze",
    ...hideActions,
    ...updateDataActions,
  ];
};

const buildHeaderDescriptor = (
  column: NocodeHeaderColumnLike,
  parentColumn: NocodeHeaderColumnLike | undefined,
  options: BuildNocodeHeaderDescriptorsOptions,
): NocodeHeaderDescriptor => {
  const sortOrder = resolveNocodeHeaderSortOrder({
    sortFieldsMap: options.sortFieldsMap,
    columnUid: column.uid,
  });
  const hasFilter = hasActiveNocodeHeaderFilter({
    enableHeaderFilterPanel: options.enableHeaderFilterPanel,
    filterConditions: options.filterConditions,
    column,
    parentColumn,
  });
  const isPresetFreezeActive = Boolean(options.isPresetFreezeActive);
  const isPresetFixed = Boolean(options.isPresetFixedColumn?.(column.uid));
  const disabledActionKeys: NocodeHeaderActionKey[] = [];
  const actionKeys = resolveNocodeHeaderActionKeys(column, parentColumn, options).map((actionKey) => {
    if (actionKey !== "freeze") {
      return actionKey;
    }
    if (isPresetFreezeActive && isPresetFixed) {
      disabledActionKeys.push("unfreeze");
      return "unfreeze";
    }
    if (isPresetFreezeActive) {
      return "freeze";
    }
    if (options.fixedColumnId === column.uid) {
      return "unfreeze";
    }
    return "freeze";
  });

  return {
    key: parentColumn ? `${parentColumn.uid}.${column.uid}` : column.uid,
    uid: column.uid,
    title: column.alias,
    parentUid: parentColumn?.uid,
    isLeaf: !column.subColumns?.length,
    width: resolveNocodeColumnWidth({
      uid: column.uid,
      tableWidthData: options.tableWidthData,
    }),
    fixed: resolveNocodeColumnFixed(column.uid, options.isFixedColumn),
    sortOrder,
    hasFilter,
    indicatorKind: resolveNocodeHeaderIndicatorKind({
      sortOrder,
      hasFilter,
    }),
    filterKey: resolveNocodeHeaderFilterKey(column, parentColumn),
    actionKeys,
    disabledActionKeys,
    sourceColumn: column,
  };
};

export const buildNocodeHeaderDescriptors = (options: BuildNocodeHeaderDescriptorsOptions) => {
  const descriptors: NocodeHeaderDescriptor[] = [];

  for (const column of options.displayColumns || []) {
    descriptors.push(buildHeaderDescriptor(column, undefined, options));
    for (const subColumn of column.subColumns || []) {
      descriptors.push(buildHeaderDescriptor(subColumn, column, options));
    }
  }

  return descriptors;
};
