import type { WhereCondition } from "@common/types/project";

const isEmptyCondition = (value: unknown) => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

const uniqueValues = (values: unknown[]) => Array.from(new Set(values.filter(value => (
  value !== undefined && value !== null
))));

export function buildMainAndSubSearchCondition(
  rowKey: string,
  mainCondition: WhereCondition | null | undefined,
  subMatchedUUIDs: string[],
  hasSubCondition: boolean,
  logic: string,
) {
  const uuidCondition = hasSubCondition
    ? {
      [rowKey]: {
        $in: subMatchedUUIDs,
      }
    } as WhereCondition
    : null;
  const hasMainCondition = !isEmptyCondition(mainCondition);

  if (uuidCondition && hasMainCondition) {
    return {
      [logic === "AND" ? "$and" : "$or"]: [
        uuidCondition,
        mainCondition,
      ]
    } as WhereCondition;
  }

  if (uuidCondition) {
    return uuidCondition;
  }

  return hasMainCondition ? mainCondition : null;
}

export function buildSubTableDisplaySearchCondition(
  keyFieldId: string,
  parentKeys: unknown[],
  mainMatchedParentKeys: unknown[],
  subSearchCondition: WhereCondition | null | undefined,
) {
  const keys = uniqueValues(parentKeys);
  const mainMatchedKeys = uniqueValues(mainMatchedParentKeys).filter(key => keys.includes(key));
  const subOnlyKeys = keys.filter(key => !mainMatchedKeys.includes(key));
  const hasSubSearchCondition = !isEmptyCondition(subSearchCondition);

  if (!hasSubSearchCondition) {
    return {
      [keyFieldId]: { $in: keys },
    } as WhereCondition;
  }

  const mainMatchedCondition = mainMatchedKeys.length
    ? {
      [keyFieldId]: { $in: mainMatchedKeys },
    } as WhereCondition
    : null;
  const subOnlyCondition = subOnlyKeys.length
    ? {
      $and: [
        { [keyFieldId]: { $in: subOnlyKeys } },
        subSearchCondition,
      ],
    } as WhereCondition
    : null;

  const conditions = [mainMatchedCondition, subOnlyCondition].filter(Boolean) as WhereCondition[];
  if (conditions.length > 1) {
    return { $or: conditions } as WhereCondition;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }

  return {
    [keyFieldId]: { $in: [] },
  } as WhereCondition;
}
