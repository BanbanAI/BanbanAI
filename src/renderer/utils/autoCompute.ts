import { FilterRule } from "@common/types/nocode";
import { Field, FieldUID, Row, WhereCondition } from "@common/types/project";
import { createFormulaRuntimeByData, evaluateFormulaWithRuntime, transformCondition } from "@common/utils";
import { AggregationType, FormConditionValueType, RuleFunc } from "@common/types/nocode";
import { OptionFieldUID } from "@common/types/project";
import { LogicalOperator } from "@renderer/b2/types";
import axios from "axios";
import { isEmpty } from "lodash";

type DistinctCountResult = {
  value: any;
  count: number;
};

type AutoComputeDistinctCacheEntry = {
  data?: DistinctCountResult[] | null;
  expireAt: number;
  pending?: Promise<DistinctCountResult[] | null>;
};

const AUTO_COMPUTE_DISTINCT_CACHE_TTL = 500;
const autoComputeDistinctCache = new Map<string, AutoComputeDistinctCacheEntry>();

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== void 0)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

const clearExpiredAutoComputeDistinctCache = (now = Date.now()) => {
  for (const [key, entry] of autoComputeDistinctCache.entries()) {
    if (!entry.pending && entry.expireAt <= now) {
      autoComputeDistinctCache.delete(key);
    }
  }
};

const fetchAutoComputeDistinctCount = async (payload: {
  nocodeId: string;
  tableUID: string;
  columnId: string;
  options: {
    filters: Record<string, WhereCondition[]>;
  };
}): Promise<DistinctCountResult[] | null> => {
  const now = Date.now();
  clearExpiredAutoComputeDistinctCache(now);

  const cacheKey = stableSerialize(payload);
  const cached = autoComputeDistinctCache.get(cacheKey);
  if (cached?.pending) {
    return await cached.pending;
  }
  if (cached && cached.expireAt > now) {
    return cached.data ?? null;
  }

  const request = axios.post("form-data/autoComputeDistinctCount", payload)
    .then(({ data }) => {
      const nextData = data || [];
      autoComputeDistinctCache.set(cacheKey, {
        data: nextData,
        expireAt: Date.now() + AUTO_COMPUTE_DISTINCT_CACHE_TTL,
      });
      return nextData as DistinctCountResult[];
    })
    .catch((error) => {
      autoComputeDistinctCache.delete(cacheKey);
      throw error;
    });

  autoComputeDistinctCache.set(cacheKey, {
    data: cached?.data,
    expireAt: cached?.expireAt ?? 0,
    pending: request,
  });

  return await request;
};

const getCurrentFormConditionValue = ({
  condition,
  row,
  fields,
}: {
  condition: any;
  row: Row;
  fields: Field[];
}) => {
  const conditionValue = condition?.value;
  if (typeof conditionValue !== "string" || !conditionValue) {
    return conditionValue;
  }

  const ids = conditionValue.split(".");
  if (ids.length < 2) {
    return row?.[conditionValue];
  }

  const [fieldId, subFieldId] = ids;
  const isArray = [RuleFunc.IN, RuleFunc.NOT_IN].includes(condition?.func);
  const currentFieldIds = new Set((fields || []).map((field) => field.uid));

  if (currentFieldIds.has(subFieldId as FieldUID) && subFieldId in (row || {})) {
    return isArray ? [row[subFieldId]] : row[subFieldId];
  }

  const fieldValue = row?.[fieldId];
  if (Array.isArray(fieldValue)) {
    return isArray ? fieldValue.map((item) => item?.[subFieldId]) : fieldValue[0]?.[subFieldId];
  }

  if (fieldValue && typeof fieldValue === "object") {
    return isArray ? [fieldValue?.[subFieldId]] : fieldValue?.[subFieldId];
  }

  return undefined;
};

export const calculateAggregation = async({
  otherTableFieldUID = [],
  dataFilter = null,
  nocodeId = "",
  aggregateType = AggregationType.SUM,
  decimal = 2,
  row = null,
  fields = [],
  throwOnError = false,
}: {
  otherTableFieldUID?: OptionFieldUID | string[];
  dataFilter?: FilterRule;
  nocodeId?: string;
  aggregateType?: AggregationType;
  decimal?: number;
  row?: Row | null;
  fields?: Field[];
  /** Preserve the caller's existing value when the aggregation request fails. */
  throwOnError?: boolean;
} = {}): Promise<number | null | undefined> => {
  const uids = otherTableFieldUID;
  if (uids.length < 3) {
    return undefined;
  }
  const [, tableUID, columnId] = uids;

  const filterRule = dataFilter;
  const conditions: any[] = [];
  let logic = "$and";

  if (filterRule?.conditions) {
    if (row) {
      const formulaRuntime = fields?.length ? createFormulaRuntimeByData(row, fields) : null;
      const rules = filterRule.conditions.map(({ type, fixedValue, value, formula, ...rest }) => {
        type = type || FormConditionValueType.FORM;
        if (type === FormConditionValueType.FORM) {
          value = getCurrentFormConditionValue({
            condition: { ...rest, value },
            row,
            fields,
          });
        } else if (type === FormConditionValueType.FORMULA) {
          try {
            value = evaluateFormulaWithRuntime(formula ?? value, formulaRuntime);
          } catch (error) {
          }
        } else {
          value = fixedValue || value;
        }
        return transformCondition({ ...rest, value });
      });
      conditions.push(rules.length === 1 ? rules[0] : {
        [filterRule.logic === LogicalOperator.AND ? "$and" : "$or"]: rules
      });
    } else {
      logic = filterRule.logic === LogicalOperator.AND ? "$and" : "$or";
      filterRule.conditions.forEach((condition) => {
        conditions.push(transformCondition(condition));
      });
    }
  }

  const filters: Record<string, WhereCondition[]> = {};
  if (conditions.length === 1) {
    filters[tableUID] = conditions;
  } else if (conditions.length > 1) {
    filters[tableUID] = [{ [logic]: conditions }];
  }

  let res: DistinctCountResult[] | null = [];
  try {
    res = await fetchAutoComputeDistinctCount({
      nocodeId,
      tableUID,
      columnId,
      options: { filters },
    });
  } catch (error) {
    console.error("Failed to fetch aggregation data", error);
    if (throwOnError) throw error;
    return null;
  }

  if (!res) {
    if (throwOnError) throw new Error("Aggregation data unavailable");
    return null;
  }

  let result: number | null = null;

  if (aggregateType === AggregationType.COUNT) {
    result = res.reduce((previous, current) => {
      return previous + (current.count ?? 0);
    }, 0);
  } else if (aggregateType === AggregationType.FILLED || aggregateType === AggregationType.UNFILLED) {
    const filledCount = res.reduce((previous, current) => {
      const value = current.value === "" ? null : current.value;
      const hasValue = !isEmpty(value);
      return previous + (hasValue ? current.count : 0);
    }, 0);

    if (aggregateType === AggregationType.FILLED) {
      result = filledCount;
    } else {
      const total = res.reduce((previous, current) => {
        return previous + current.count;
      }, 0);
      result = total - filledCount;
    }
  } else if (aggregateType === AggregationType.SUM) {
    result = res.reduce((previous, current) => {
      const value = current.value ?? 0;
      const count = current.count ?? 0;
      return previous + value * count;
    }, 0);
  } else if (aggregateType === AggregationType.AVE) {
    const sumCount = res.reduce((previous, current) => {
      const value = current.value ?? 0;
      const count = current.count ?? 0;
      return previous + value * count;
    }, 0);

    const totalCount = res.reduce((previous, current) => {
      return previous + (current.count ?? 0);
    }, 0);

    if (totalCount === 0) {
      result = 0;
    } else {
      result = Number((sumCount / totalCount).toFixed(decimal || 2));
    }
  } else if (aggregateType === AggregationType.MAX) {
    const values = res.map((item) => {
      return item.value ?? Number.NEGATIVE_INFINITY;
    });
    const max = Math.max(...values);
    result = max === Number.NEGATIVE_INFINITY ? null : max;
  } else if (aggregateType === AggregationType.MIN) {
    const values = res.map((item) => {
      return item.value ?? Number.POSITIVE_INFINITY;
    });
    const min = Math.min(...values);
    result = min === Number.POSITIVE_INFINITY ? null : min;
  }

  return result;
};
