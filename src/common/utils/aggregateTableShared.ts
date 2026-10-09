import { AggregateTable, RuleFunc } from "@common/types/nocode";
import {
  ConnectionData,
  FieldUID,
  QueryOptions,
  Row,
  SortType,
  Table,
  WhereCondition,
} from "@common/types/project";
import { getDynamicValue } from "@common/utils/connection";
import dayjs from "dayjs";

export type AggregateRuntimeSource = {
  uid: string;
  nocodeId?: string;
  tables?: Table[];
  aggregateTables?: AggregateTable[];
};

export type AggregateRuntimeContext = {
  sources: AggregateRuntimeSource[];
  connectionData: ConnectionData;
};

export const isEmptyValue = (value: any) => {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
};

export const toSafeNumber = (value: any) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const normalizeComparableValue = (value: any) => {
  if (dayjs.isDayjs(value)) return value.valueOf();
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
};

export const isEqualValue = (left: any, right: any) => {
  return normalizeComparableValue(left) === normalizeComparableValue(right);
};

const toDateValue = (value: any) => {
  if (value === undefined || value === null || value === "") return null;
  const date = dayjs(value);
  if (!date.isValid()) return null;
  return date.valueOf();
};

const isNumericLikeValue = (value: any) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;
  return Number.isFinite(Number(trimmedValue));
};

const getComparableDateValues = (currentValue: any, targetValue: any) => {
  if (isNumericLikeValue(currentValue) || isNumericLikeValue(targetValue)) return null;
  const normalizedCurrentValue = toDateValue(currentValue);
  const normalizedTargetValue = toDateValue(targetValue);
  if (normalizedCurrentValue === null || normalizedTargetValue === null) return null;
  return {
    currentDateValue: normalizedCurrentValue,
    targetDateValue: normalizedTargetValue,
  };
};

const isContainValue = (currentValue: any, expectedValue: any) => {
  if (Array.isArray(currentValue)) {
    if (Array.isArray(expectedValue)) {
      return expectedValue.some(item => currentValue.some(value => isEqualValue(value, item)));
    }
    return currentValue.some(value => isEqualValue(value, expectedValue));
  }
  if (currentValue === undefined || currentValue === null) return false;
  return String(currentValue).includes(String(expectedValue ?? ""));
};

const isContainAllValues = (currentValue: any, expectedValue: any) => {
  if (!Array.isArray(currentValue)) return false;
  const expectedList = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
  return expectedList.every(item => currentValue.some(value => isEqualValue(value, item)));
};

export const matchConditionByRuleFunc = (
  values: any[],
  func?: RuleFunc,
  expectedValue?: any,
) => {
  const validValues = values.length ? values : [undefined];
  switch (func) {
    case RuleFunc.NOT_EQUAL:
      return validValues.every(value => !isEqualValue(value, expectedValue));
    case RuleFunc.EMPTY:
      return validValues.some(value => isEmptyValue(value));
    case RuleFunc.NOT_EMPTY:
      return validValues.every(value => !isEmptyValue(value));
    case RuleFunc.CONTAIN:
    case RuleFunc.BELONG:
      return validValues.some(value => isContainValue(value, expectedValue));
    case RuleFunc.NOT_CONTAIN:
    case RuleFunc.NOT_BELONG:
      return validValues.every(value => !isContainValue(value, expectedValue));
    case RuleFunc.GT: {
      const compareValue = toSafeNumber(expectedValue);
      return validValues.some(value => toSafeNumber(value) > compareValue);
    }
    case RuleFunc.GTE: {
      const compareValue = toSafeNumber(expectedValue);
      return validValues.some(value => toSafeNumber(value) >= compareValue);
    }
    case RuleFunc.LT: {
      const compareValue = toSafeNumber(expectedValue);
      return validValues.some(value => toSafeNumber(value) < compareValue);
    }
    case RuleFunc.LTE: {
      const compareValue = toSafeNumber(expectedValue);
      return validValues.some(value => toSafeNumber(value) <= compareValue);
    }
    case RuleFunc.IN: {
      const compareList = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
      return validValues.some(value => compareList.some(item => isEqualValue(item, value)));
    }
    case RuleFunc.NOT_IN: {
      const compareList = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
      return validValues.every(value => compareList.every(item => !isEqualValue(item, value)));
    }
    case RuleFunc.CONTAIN_ANY:
      return validValues.some(value => isContainValue(value, expectedValue));
    case RuleFunc.CONTAIN_ALL:
      return validValues.some(value => isContainAllValues(value, expectedValue));
    case RuleFunc.BETWEEN: {
      if (!Array.isArray(expectedValue) || expectedValue.length < 2) return false;
      const [start, end] = expectedValue.map(item => toSafeNumber(item));
      return validValues.some(value => {
        const current = toSafeNumber(value);
        return current >= start && current <= end;
      });
    }
    case RuleFunc.TIME_EQUAL: {
      const target = toDateValue(expectedValue);
      if (target === null) return false;
      const targetStart = dayjs(target).startOf("day").valueOf();
      const targetEnd = dayjs(target).endOf("day").valueOf();
      return validValues.some(value => {
        const current = toDateValue(value);
        if (current === null) return false;
        return current >= targetStart && current <= targetEnd;
      });
    }
    case RuleFunc.TIME_NOT_EQUAL: {
      const target = toDateValue(expectedValue);
      if (target === null) return false;
      const targetStart = dayjs(target).startOf("day").valueOf();
      const targetEnd = dayjs(target).endOf("day").valueOf();
      return validValues.every(value => {
        const current = toDateValue(value);
        if (current === null) return true;
        return current < targetStart || current > targetEnd;
      });
    }
    case RuleFunc.TIME_LTE: {
      const target = toDateValue(expectedValue);
      if (target === null) return false;
      const targetEnd = dayjs(target).endOf("day").valueOf();
      return validValues.some(value => {
        const current = toDateValue(value);
        return current !== null && current <= targetEnd;
      });
    }
    case RuleFunc.TIME_BETWEEN: {
      if (!Array.isArray(expectedValue) || expectedValue.length < 2) return false;
      const start = toDateValue(expectedValue[0]);
      const end = toDateValue(expectedValue[1]);
      if (start === null || end === null) return false;
      const startValue = dayjs(start).startOf("day").valueOf();
      const endValue = dayjs(end).endOf("day").valueOf();
      return validValues.some(value => {
        const current = toDateValue(value);
        return current !== null && current >= startValue && current <= endValue;
      });
    }
    case RuleFunc.DYNAMIC: {
      let dynamicValue: ReturnType<typeof getDynamicValue>;
      try {
        dynamicValue = getDynamicValue(expectedValue);
      } catch {
        return false;
      }
      if (!dynamicValue) return false;

      const startValue = dynamicValue.$gte === undefined
        ? null
        : toDateValue(dynamicValue.$gte);
      const endValue = dynamicValue.$lte === undefined
        ? null
        : toDateValue(dynamicValue.$lte);
      if (startValue === null && endValue === null) return false;

      return validValues.some(value => {
        const current = toDateValue(value);
        return current !== null
          && (startValue === null || current >= startValue)
          && (endValue === null || current <= endValue);
      });
    }
    case RuleFunc.TRUE:
      return validValues.some(value => value === true || value === "true");
    case RuleFunc.FALSE:
      return validValues.some(value => value === false || value === "false");
    case RuleFunc.EQUAL:
    default:
      return validValues.some(value => isEqualValue(value, expectedValue));
  }
};

const applyFieldWhereRule = (value: any, rule: any): boolean => {
  if (rule === undefined) return true;
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
    return isEqualValue(value, rule);
  }

  if (rule.$eq !== undefined && !isEqualValue(value, rule.$eq)) return false;
  if (rule.$ne !== undefined && isEqualValue(value, rule.$ne)) return false;
  if (rule.$gt !== undefined) {
    const comparableDateValues = getComparableDateValues(value, rule.$gt);
    if (comparableDateValues) {
      if (!(comparableDateValues.currentDateValue > comparableDateValues.targetDateValue)) return false;
    } else if (!(toSafeNumber(value) > toSafeNumber(rule.$gt))) return false;
  }
  if (rule.$gte !== undefined) {
    const comparableDateValues = getComparableDateValues(value, rule.$gte);
    if (comparableDateValues) {
      if (!(comparableDateValues.currentDateValue >= comparableDateValues.targetDateValue)) return false;
    } else if (!(toSafeNumber(value) >= toSafeNumber(rule.$gte))) return false;
  }
  if (rule.$lt !== undefined) {
    const comparableDateValues = getComparableDateValues(value, rule.$lt);
    if (comparableDateValues) {
      if (!(comparableDateValues.currentDateValue < comparableDateValues.targetDateValue)) return false;
    } else if (!(toSafeNumber(value) < toSafeNumber(rule.$lt))) return false;
  }
  if (rule.$lte !== undefined) {
    const comparableDateValues = getComparableDateValues(value, rule.$lte);
    if (comparableDateValues) {
      if (!(comparableDateValues.currentDateValue <= comparableDateValues.targetDateValue)) return false;
    } else if (!(toSafeNumber(value) <= toSafeNumber(rule.$lte))) return false;
  }
  if (rule.$in !== undefined) {
    const compareList = Array.isArray(rule.$in) ? rule.$in : [rule.$in];
    if (!compareList.some(item => isEqualValue(value, item))) return false;
  }
  if (rule.$nin !== undefined) {
    const compareList = Array.isArray(rule.$nin) ? rule.$nin : [rule.$nin];
    if (compareList.some(item => isEqualValue(value, item))) return false;
  }
  if (rule.$all !== undefined) {
    if (!isContainAllValues(value, rule.$all)) return false;
  }
  if (rule.$size !== undefined) {
    if (!Array.isArray(value) || value.length !== rule.$size) return false;
  }
  if (rule.$exists !== undefined) {
    const exists = value !== undefined && value !== null;
    if (Boolean(rule.$exists) !== exists) return false;
  }
  if (rule.$regex !== undefined) {
    const text = String(value ?? "");
    if (!text.includes(String(rule.$regex))) return false;
  }
  if (rule.$like !== undefined) {
    const text = String(value ?? "");
    if (!text.includes(String(rule.$like))) return false;
  }
  return true;
};

const matchWhereCondition = (row: Row, whereCondition?: WhereCondition | null): boolean => {
  if (!whereCondition) return true;
  const conditionObject = whereCondition as Record<string, any>;
  const andConditions = Array.isArray(conditionObject.$and) ? conditionObject.$and : null;
  const orConditions = Array.isArray(conditionObject.$or) ? conditionObject.$or : null;

  if (andConditions?.length) {
    return andConditions.every(condition => matchWhereCondition(row, condition));
  }
  if (orConditions?.length) {
    return orConditions.some(condition => matchWhereCondition(row, condition));
  }
  if (conditionObject.$not) {
    return !matchWhereCondition(row, conditionObject.$not as WhereCondition);
  }

  return Object.entries(conditionObject).every(([fieldUID, fieldRule]) => {
    if (fieldUID.startsWith("$")) return true;
    return applyFieldWhereRule(row[fieldUID as FieldUID], fieldRule);
  });
};

const sortRowsByOrderBy = (rows: Row[], orderBy?: QueryOptions["orderBy"]) => {
  if (!orderBy || typeof orderBy !== "object" || Array.isArray(orderBy)) return rows;

  const orderEntries = Object.entries(orderBy);
  if (!orderEntries.length) return rows;

  return [...rows].sort((leftRow, rightRow) => {
    for (const [fieldUID, sortType] of orderEntries) {
      const leftValue = normalizeComparableValue(leftRow[fieldUID as FieldUID]);
      const rightValue = normalizeComparableValue(rightRow[fieldUID as FieldUID]);
      if (leftValue === rightValue) continue;
      if (sortType === SortType.DESC) {
        return leftValue > rightValue ? -1 : 1;
      }
      return leftValue > rightValue ? 1 : -1;
    }
    return 0;
  });
};

export const applyQueryOptionsToRows = (
  tableUID: string,
  rows: Row[],
  options: QueryOptions = {},
) => {
  const tableFilters = options.filters?.[tableUID];
  const whereConditions = Array.isArray(tableFilters)
    ? tableFilters
    : (tableFilters ? [tableFilters] : []);

  let nextRows = whereConditions.length
    ? rows.filter(row => whereConditions.every(condition => matchWhereCondition(row, condition)))
    : [...rows];

  nextRows = sortRowsByOrderBy(nextRows, options.orderBy);

  const count = nextRows.length;
  const pageSize = Number(options.pageSize || 0);
  const pageNumber = Number(options.pageNumber || 0);
  const start = Number(options.start || 0);
  const limit = Number(options.limit || 0);

  if (pageSize > 0 && pageNumber > 0) {
    const offset = (pageNumber - 1) * pageSize;
    return {
      rows: nextRows.slice(offset, offset + pageSize),
      count,
    };
  }

  if (start > 0 || limit > 0) {
    const offset = start > 0 ? start : 0;
    return {
      rows: limit > 0 ? nextRows.slice(offset, offset + limit) : nextRows.slice(offset),
      count,
    };
  }

  return {
    rows: nextRows,
    count,
  };
};
