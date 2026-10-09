export type PivotDesignerFilterMap = Record<string, string[]>;
export type PivotDesignerFilterMutationResult = {
  filters: PivotDesignerFilterMap;
  treeOpenKeysTouched: boolean;
};
export type PivotDesignerLeftAxisMutationResult = {
  dimCodes: string[];
  activeFilterDimCode: string | null;
  treeOpenKeysTouched: boolean;
  expandKeys: string[];
};
export type PivotDesignerAxisMutationResult = {
  dimCodes: string[];
  expandKeys: string[];
};
export type SyncPivotDesignerOpenKeysOptions = {
  openKeys: string[];
  validKeys: Iterable<string>;
  defaultKeys?: string[];
  touched?: boolean;
};

export const samePivotDesignerStringArray = (left: string[], right: string[]) => {
  return left.length === right.length && left.every((value, index) => value === right[index]);
};

export const reorderPivotDesignerDimCodes = (
  dimCodes: string[],
  fromIndex: number,
  toIndex: number,
) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= dimCodes.length || toIndex >= dimCodes.length) {
    return [...dimCodes];
  }

  const nextCodes = [...dimCodes];
  const [target] = nextCodes.splice(fromIndex, 1);
  nextCodes.splice(toIndex, 0, target);
  return nextCodes;
};

export const setPivotDesignerDimEnabled = (
  dimCodes: string[],
  code: string,
  checked: boolean,
) => {
  const hasDimension = dimCodes.includes(code);
  if (checked && !hasDimension) {
    return [...dimCodes, code];
  }
  if (!checked && hasDimension) {
    return dimCodes.filter((item) => item !== code);
  }
  return [...dimCodes];
};

export const setPivotDesignerFilterValues = (
  filters: PivotDesignerFilterMap,
  code: string,
  values: string[],
) => {
  return {
    ...filters,
    [code]: [...values],
  };
};

export const togglePivotDesignerFilterValue = (
  filters: PivotDesignerFilterMap,
  code: string,
  value: string,
  checked: boolean,
) => {
  const currentValues = filters[code] || [];
  const nextValues = checked
    ? [...currentValues, value]
    : currentValues.filter((item) => item !== value);
  return setPivotDesignerFilterValues(filters, code, Array.from(new Set(nextValues)));
};

export const prunePivotDesignerOpenKeys = (
  openKeys: string[],
  validKeys: Iterable<string>,
) => {
  if (!openKeys.length) {
    return [];
  }
  const validKeySet = validKeys instanceof Set ? validKeys : new Set(validKeys);
  return openKeys.filter((key) => validKeySet.has(key));
};

export const syncPivotDesignerOpenKeys = ({
  openKeys,
  validKeys,
  defaultKeys = [],
  touched = true,
}: SyncPivotDesignerOpenKeysOptions) => {
  const nextOpenKeys = prunePivotDesignerOpenKeys(openKeys, validKeys);
  if (!nextOpenKeys.length && defaultKeys.length && !touched) {
    return [...defaultKeys];
  }
  return nextOpenKeys;
};

export const syncPivotDesignerExpandKeys = (
  expandKeys: string[],
  validKeys: Iterable<string>,
) => {
  return prunePivotDesignerOpenKeys(expandKeys, validKeys);
};

export const resolvePivotDesignerActiveFilterDimCode = (
  activeFilterDimCode: string | null,
  dimCodes: string[],
) => {
  if (activeFilterDimCode && dimCodes.includes(activeFilterDimCode)) {
    return activeFilterDimCode;
  }
  return dimCodes[0] || null;
};

export const applyPivotDesignerFilterValues = (
  filters: PivotDesignerFilterMap,
  code: string,
  values: string[],
): PivotDesignerFilterMutationResult => {
  return {
    filters: setPivotDesignerFilterValues(filters, code, values),
    treeOpenKeysTouched: false,
  };
};

export const applyPivotDesignerFilterValueToggle = (
  filters: PivotDesignerFilterMap,
  code: string,
  value: string,
  checked: boolean,
): PivotDesignerFilterMutationResult => {
  return {
    filters: togglePivotDesignerFilterValue(filters, code, value, checked),
    treeOpenKeysTouched: false,
  };
};

const applyPivotDesignerLeftAxisDimCodes = (
  dimCodes: string[],
  activeFilterDimCode: string | null,
): PivotDesignerLeftAxisMutationResult => {
  return {
    dimCodes: [...dimCodes],
    activeFilterDimCode: resolvePivotDesignerActiveFilterDimCode(activeFilterDimCode, dimCodes),
    treeOpenKeysTouched: false,
    expandKeys: [],
  };
};

export const togglePivotDesignerLeftAxisDimension = (
  dimCodes: string[],
  code: string,
  checked: boolean,
  activeFilterDimCode: string | null,
) => {
  return applyPivotDesignerLeftAxisDimCodes(
    setPivotDesignerDimEnabled(dimCodes, code, checked),
    activeFilterDimCode,
  );
};

export const reorderPivotDesignerLeftAxisDimensions = (
  dimCodes: string[],
  fromIndex: number,
  toIndex: number,
  activeFilterDimCode: string | null,
) => {
  return applyPivotDesignerLeftAxisDimCodes(
    reorderPivotDesignerDimCodes(dimCodes, fromIndex, toIndex),
    activeFilterDimCode,
  );
};

const applyPivotDesignerAxisDimCodes = (
  dimCodes: string[],
): PivotDesignerAxisMutationResult => {
  return {
    dimCodes: [...dimCodes],
    expandKeys: [],
  };
};

export const togglePivotDesignerTopAxisDimension = (
  dimCodes: string[],
  code: string,
  checked: boolean,
) => {
  return applyPivotDesignerAxisDimCodes(
    setPivotDesignerDimEnabled(dimCodes, code, checked),
  );
};

export const reorderPivotDesignerTopAxisDimensions = (
  dimCodes: string[],
  fromIndex: number,
  toIndex: number,
) => {
  return applyPivotDesignerAxisDimCodes(
    reorderPivotDesignerDimCodes(dimCodes, fromIndex, toIndex),
  );
};
