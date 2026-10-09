import { createFormulaRuntimeByData, evaluateFormulaWithRuntime, parseArguments, replaceByFormula, replaceColFieldsByFormula } from "@common/utils/formula";
import { OptionFieldUID } from "@common/types/project";
import { OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { FilterRule, RuleFunc } from "@common/types/nocode";
import { LogicalOperator } from "@renderer/b2/types";
import { Field, FieldUID, Row } from "@common/types/project";
import dayjs from "dayjs";

type TableAggregateFieldComputeStage = "row" | "bucket";
type TableAggregateFieldMode = "formula" | "singleField";
type TableAggregateSingleFieldAggregate = "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN";

type TableAggregateFieldRuntimeMeta = {
  uid: string;
  mode: TableAggregateFieldMode;
  computeStage: TableAggregateFieldComputeStage;
  formula?: string;
  hasAggregateFunctions?: boolean;
  dependencies?: string[];
  singleFieldConfig?: {
    aggregate?: TableAggregateSingleFieldAggregate;
    fieldUID?: string;
    subFieldUID?: string;
  } | null;
  filterRules?: Record<string, Record<string, FilterRule>>;
};

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const toSafeNumber = (value: any) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const isEmptyValue = (value: any) => {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
};

const normalizeComparableValue = (value: any) => {
  if (dayjs.isDayjs(value)) return value.valueOf();
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
};

const isEqualValue = (left: any, right: any) => {
  return normalizeComparableValue(left) === normalizeComparableValue(right);
};

const toDateValue = (value: any) => {
  if (value === undefined || value === null || value === "") return null;
  const date = dayjs(value);
  if (!date.isValid()) return null;
  return date.valueOf();
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

const matchConditionByRuleFunc = (
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
    case RuleFunc.TRUE:
      return validValues.some(value => value === true || value === "true");
    case RuleFunc.FALSE:
      return validValues.some(value => value === false || value === "false");
    case RuleFunc.EQUAL:
    default:
      return validValues.some(value => isEqualValue(value, expectedValue));
  }
};

const toOptionUID = (uid?: OptionFieldUID | null) => {
  if (!Array.isArray(uid) || uid.length < 3) return null;
  return uid;
};

const isTableAggregateFieldUID = (uid?: string) => {
  return String(uid || "").startsWith("table_aggregate_field_");
};

const pushUniqueUID = (target: OptionFieldUID[], uid?: OptionFieldUID | null) => {
  const nextUID = toOptionUID(uid);
  if (!nextUID) return;
  const key = nextUID.join(".");
  if (target.some(item => item.join(".") === key)) return;
  target.push(nextUID);
};

const getDependencyPath = (dependency: string, tableUID: string) => {
  const parts = String(dependency || "").split(".").filter(Boolean);
  if (!parts.length) return "";

  if (parts[0] === tableUID) {
    parts.shift();
  }

  if (!parts.length) return "";
  if (parts[0] === "_count") return "";

  if (parts[parts.length - 1] === "_count") {
    parts.pop();
  }

  return parts.join(".");
};

const getTableFields = (element: Widget | any, uid?: OptionFieldUID | null) => {
  const optionUID = toOptionUID(uid);
  if (!optionUID) return [] as Field[];

  const [connectionUID, tableUID] = optionUID;
  const connections = element.getBoard?.()?.getConnections?.() || [];
  const connection = connections.find(item => item?.uid === connectionUID);
  const table = connection?.tables?.find(item => item?.uid === tableUID);
  return table?.fields || [];
};

const resolveSingleFieldConfigFieldUID = (
  element: Widget | any,
  uid?: OptionFieldUID | null,
  singleFieldConfig?: TableAggregateFieldRuntimeMeta["singleFieldConfig"],
) => {
  if (singleFieldConfig?.fieldUID) return singleFieldConfig.fieldUID;
  if (!singleFieldConfig?.subFieldUID) return "";

  const subFormFields = getTableFields(element, uid)
    .filter(field => field?.uid && field?.meta?.extra?.subTableUID?.[1]);
  return subFormFields.length === 1 ? subFormFields[0].uid : "";
};

export const resolveTableAggregateSingleFieldDependencyPath = (
  element: Widget | any,
  uid?: OptionFieldUID | null,
  singleFieldConfig?: TableAggregateFieldRuntimeMeta["singleFieldConfig"],
) => {
  const fieldUID = resolveSingleFieldConfigFieldUID(element, uid, singleFieldConfig);
  if (!fieldUID) return "";
  return [fieldUID, singleFieldConfig?.subFieldUID].filter(Boolean).join(".");
};

export const resolveTableAggregateOptionUID = (
  element: Widget | any,
  uid?: OptionFieldUID | null,
) => {
  const optionUID = toOptionUID(uid);
  if (!optionUID) return null;
  if (!isTableAggregateFieldUID(optionUID[2])) return optionUID;
  if (element.getField?.(optionUID)) return optionUID;

  const aggregateFields = getTableFields(element, optionUID)
    .filter(field => field?.uid && field?.meta?.extra?.tableAggregateField);
  if (aggregateFields.length !== 1) return optionUID;

  return [optionUID[0], optionUID[1], aggregateFields[0].uid] as OptionFieldUID;
};

const getFallbackUID = (element: Widget | any, uid?: OptionFieldUID | null) => {
  const optionUID = toOptionUID(uid);
  if (!optionUID) return null;

  const tableFields = getTableFields(element, optionUID);
  const field = tableFields.find(item => item?.uid && !item?.meta?.extra?.tableAggregateField)
    || tableFields.find(item => item?.uid);

  if (!field?.uid) return null;

  return [optionUID[0], optionUID[1], field.uid] as OptionFieldUID;
};

const resolveFormulaFieldIds = (ids: string[] = [], currentTableUID?: string) => {
  if (!ids.length) {
    return {
      fieldUID: "",
      subFieldUID: "",
    };
  }

  if (currentTableUID && ids[0] === currentTableUID) {
    return {
      fieldUID: ids[1] || "",
      subFieldUID: ids[2] || "",
    };
  }

  return {
    fieldUID: ids[0] || "",
    subFieldUID: ids[1] || "",
  };
};

const getFieldValues = (
  rows: Row[] = [],
  fieldUID?: string,
  subFieldUID?: string,
) => {
  if (!fieldUID) return [] as any[];
  if (fieldUID === "_count") return rows.map(() => 1);
  if (subFieldUID === "_count") {
    return rows.flatMap(row => toArray(row?.[fieldUID]).map(() => 1));
  }
  if (subFieldUID) {
    return rows.flatMap(row => toArray(row?.[fieldUID]).map(item => item?.[subFieldUID]));
  }
  return rows.map(row => row?.[fieldUID]);
};

const aggregateSingleFieldValues = (
  aggregate?: TableAggregateSingleFieldAggregate,
  values: any[] = [],
) => {
  switch (aggregate) {
    case "SUM":
      return values.reduce((sum, current) => sum + toSafeNumber(current), 0);
    case "AVERAGE":
      return values.length
        ? values.reduce((sum, current) => sum + toSafeNumber(current), 0) / values.length
        : 0;
    case "COUNT":
      return values.length;
    case "MAX":
      return values.length
        ? Math.max(...values.map(value => toSafeNumber(value)))
        : 0;
    case "MIN":
      return values.length
        ? Math.min(...values.map(value => toSafeNumber(value)))
        : 0;
    default:
      return 0;
  }
};

const BUCKET_AGGREGATE_FUNCTION_NAMES = new Set<TableAggregateSingleFieldAggregate>([
  "SUM",
  "AVERAGE",
  "COUNT",
  "MAX",
  "MIN",
]);

const normalizeFormulaRuntimeValue = (value: any): any[] => {
  const nextValue = value?.toArray ? value.toArray() : value;
  if (Array.isArray(nextValue)) {
    return nextValue.flatMap(item => normalizeFormulaRuntimeValue(item));
  }
  return [nextValue];
};

const toFormulaLiteralValue = (value: any) => {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (dayjs.isDayjs(value)) return JSON.stringify(value.toISOString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  return JSON.stringify(value);
};

const toFormulaArrayLiteral = (values: any[] = []) => {
  return `[${values.map(value => toFormulaLiteralValue(value)).join(",")}]`;
};

const getConditionValuesByUID = (row: Row, uid?: string) => {
  if (!uid) return [] as any[];
  const ids = String(uid).split(".");

  if (ids.length <= 1) {
    return [row?.[uid]];
  }

  const [first, second] = ids;
  if (second === "_count") {
    return [toArray(row?.[first]).length];
  }

  const parentValue = row?.[first];
  if (Array.isArray(parentValue)) {
    return parentValue.map(item => item?.[second]);
  }
  if (parentValue && typeof parentValue === "object") {
    return [parentValue?.[second]];
  }
  return [row?.[second]];
};

const matchFilterRule = (row: Row, filterRule?: FilterRule | null) => {
  if (!filterRule?.conditions?.length) return true;
  const logic = filterRule.logic || LogicalOperator.AND;
  const matchedList = filterRule.conditions.map(condition => {
    const values = getConditionValuesByUID(row, condition?.uid);
    return matchConditionByRuleFunc(values, condition?.func, condition?.value);
  });
  return logic === LogicalOperator.OR
    ? matchedList.some(Boolean)
    : matchedList.every(Boolean);
};

const filterRowsByFunctionRule = (
  rows: Row[] = [],
  currentTableUID: string,
  filterRules?: TableAggregateFieldRuntimeMeta["filterRules"],
  fnId?: string | null,
) => {
  if (!fnId) return rows;
  const filterRule = filterRules?.[fnId]?.[currentTableUID];
  if (!filterRule?.conditions?.length) return rows;
  return rows.filter(row => matchFilterRule(row, filterRule));
};

const resolveFlattenedSubFormFieldValue = (
  row: Row,
  fieldUID: string,
  subFieldUID: string,
  subFormFieldUID?: string,
) => {
  if (!subFormFieldUID || fieldUID !== subFormFieldUID || !subFieldUID) return undefined;
  if (subFieldUID === "_count") return 1;

  const flatKey = `${fieldUID}.${subFieldUID}`;
  if (row?.[flatKey] !== undefined) return row[flatKey];
  return row?.[subFieldUID];
};

const resolveRowColTokenValue = (
  row: Row,
  currentTableUID: string,
  ids: string[] = [],
  subFormFieldUID?: string,
) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, currentTableUID);
  const flattenedValue = resolveFlattenedSubFormFieldValue(row, fieldUID, subFieldUID, subFormFieldUID);
  if (flattenedValue !== undefined) return [flattenedValue];
  return getFieldValues([row], fieldUID, subFieldUID);
};

const resolveRowTokenValue = (
  row: Row,
  currentTableUID: string,
  ids: string[] = [],
  subFormFieldUID?: string,
) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, currentTableUID);
  if (!fieldUID) return undefined;

  if (fieldUID === "_count") return 1;
  const flattenedValue = resolveFlattenedSubFormFieldValue(row, fieldUID, subFieldUID, subFormFieldUID);
  if (flattenedValue !== undefined) return flattenedValue;
  if (subFieldUID === "_count") {
    return toArray(row?.[fieldUID]).length;
  }
  if (subFieldUID) {
    return toArray(row?.[fieldUID])[0]?.[subFieldUID];
  }
  return row?.[fieldUID];
};

const evaluateRowFormulaExpression = (
  formula: string,
  row: Row,
  currentTableUID: string,
  subFormFieldUID?: string,
) => {
  let nextFormula = replaceColFieldsByFormula(formula, ids => resolveRowColTokenValue(row, currentTableUID, ids, subFormFieldUID));
  nextFormula = replaceByFormula(nextFormula, ids => resolveRowTokenValue(row, currentTableUID, ids, subFormFieldUID));
  return evaluateFormulaWithRuntime(nextFormula, createFormulaRuntimeByData(row));
};

const findNextFormulaFunction = (str: string) => {
  const fnMatch = str.match(/([A-Za-z_][A-Za-z0-9_]*)(?:<([a-zA-Z0-9_-]+)>)?\s*\(/);
  if (!fnMatch) return null;

  const start = fnMatch.index ?? -1;
  const originalName = fnMatch[1];
  const name = originalName.toUpperCase();
  const fnId = fnMatch[2] || null;

  let index = start + fnMatch[0].length - 1;
  let depth = 0;

  for (let i = index; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") {
      depth--;
      if (depth === 0) {
        return {
          originalName,
          name,
          fnId,
          argsContent: str.slice(index + 1, i),
          start,
          end: i + 1,
        };
      }
    }
  }

  return null;
};

const evaluateBucketAggregateFunction = (
  fnName: TableAggregateSingleFieldAggregate,
  fnId: string | null,
  args: string[],
  rows: Row[] = [],
  currentTableUID: string,
  meta: TableAggregateFieldRuntimeMeta,
) => {
  const targetRows = filterRowsByFunctionRule(rows, currentTableUID, meta.filterRules, fnId);
  if (!args.length || !targetRows.length) return 0;

  const valuesByArg = args.map(arg => targetRows.flatMap(row => normalizeFormulaRuntimeValue(
    evaluateRowFormulaExpression(arg, row, currentTableUID),
  )));

  if (!valuesByArg.some(values => values.length)) return 0;

  const runtime = createFormulaRuntimeByData(targetRows[0] || rows[0] || {});
  if (fnName === "COUNT") {
    return toSafeNumber(evaluateFormulaWithRuntime(
      `COUNT(${toFormulaArrayLiteral(valuesByArg.flat())})`,
      runtime,
    ));
  }

  return toSafeNumber(evaluateFormulaWithRuntime(
    `${fnName}(${valuesByArg.map(values => toFormulaArrayLiteral(values)).join(",")})`,
    runtime,
  ));
};

const replaceBucketAggregateFunctions = (
  formula: string,
  rows: Row[] = [],
  currentTableUID: string,
  meta: TableAggregateFieldRuntimeMeta,
): string => {
  const fn = findNextFormulaFunction(formula);
  if (!fn) return formula;

  const prefix = formula.slice(0, fn.start);
  const nextArgs = parseArguments(fn.argsContent).map(arg => replaceBucketAggregateFunctions(arg, rows, currentTableUID, meta));
  const current = BUCKET_AGGREGATE_FUNCTION_NAMES.has(fn.name as TableAggregateSingleFieldAggregate)
    ? String(evaluateBucketAggregateFunction(
      fn.name as TableAggregateSingleFieldAggregate,
      fn.fnId,
      nextArgs,
      rows,
      currentTableUID,
      meta,
    ))
    : `${fn.originalName}(${nextArgs.join(",")})`;
  const suffix = replaceBucketAggregateFunctions(formula.slice(fn.end), rows, currentTableUID, meta);
  return `${prefix}${current}${suffix}`;
};

const resolveBucketColTokenValue = (rows: Row[] = [], currentTableUID: string, ids: string[] = []) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, currentTableUID);
  return getFieldValues(rows, fieldUID, subFieldUID);
};

const resolveBucketTokenValue = (rows: Row[] = [], currentTableUID: string, ids: string[] = []) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, currentTableUID);
  if (!fieldUID) return undefined;

  if (fieldUID === "_count") return rows.length;
  if (subFieldUID === "_count") {
    return rows.reduce((sum, row) => sum + toArray(row?.[fieldUID]).length, 0);
  }
  if (subFieldUID) {
    return toArray(rows[0]?.[fieldUID])[0]?.[subFieldUID];
  }
  return rows[0]?.[fieldUID];
};

export const getTableAggregateFieldMeta = (
  element: Widget | any,
  uid?: OptionFieldUID | null,
) => {
  const optionUID = resolveTableAggregateOptionUID(element, uid);
  if (!optionUID) return null;
  const field = element.getField?.(optionUID) as Field | undefined;
  return field?.meta?.extra?.tableAggregateField as TableAggregateFieldRuntimeMeta | null;
};

export const isBucketStageTableAggregateField = (
  element: Widget | any,
  uid?: OptionFieldUID | null,
) => {
  return getTableAggregateFieldMeta(element, uid)?.computeStage === "bucket";
};

export const shouldBypassSecondarySummary = (
  element: Widget | any,
  dim?: OptionFieldValue | null,
) => {
  return isBucketStageTableAggregateField(element, dim?.uid);
};

export const evaluateRowStageTableAggregateField = (
  element: Widget | any,
  dim: OptionFieldValue,
  row: Row,
  subFormFieldUID?: string,
) => {
  if (!dim?.uid?.length) return undefined;

  const optionUID = resolveTableAggregateOptionUID(element, dim.uid);
  if (!optionUID) return undefined;

  const meta = getTableAggregateFieldMeta(element, optionUID);
  if (!meta || meta.computeStage !== "row" || meta.mode !== "formula") return undefined;

  const formula = String(meta.formula || "").trim();
  if (!formula) return 0;

  return toSafeNumber(evaluateRowFormulaExpression(
    formula,
    row,
    optionUID[1],
    subFormFieldUID,
  ));
};

export const expandTableAggregateDataUids = (
  element: Widget | any,
  uids: OptionFieldUID[] = [],
) => {
  const nextUIDs: OptionFieldUID[] = [];

  uids.forEach(uid => {
    const optionUID = resolveTableAggregateOptionUID(element, uid);
    if (!optionUID) return;

    const meta = getTableAggregateFieldMeta(element, optionUID);
    if (!meta || meta.computeStage !== "bucket") {
      pushUniqueUID(nextUIDs, optionUID);
      return;
    }

    const dependencyUIDs = (meta.dependencies || [])
      .map(dependency => getDependencyPath(dependency, optionUID[1]))
      .filter(Boolean)
      .map(path => [optionUID[0], optionUID[1], path] as OptionFieldUID);

    dependencyUIDs.forEach(item => pushUniqueUID(nextUIDs, item));

    if (!dependencyUIDs.length) {
      const singleFieldDependencyPath = getDependencyPath(
        resolveTableAggregateSingleFieldDependencyPath(element, optionUID, meta.singleFieldConfig),
        optionUID[1],
      );
      if (singleFieldDependencyPath) {
        pushUniqueUID(nextUIDs, [optionUID[0], optionUID[1], singleFieldDependencyPath as FieldUID]);
      } else {
        pushUniqueUID(nextUIDs, getFallbackUID(element, optionUID));
      }
    }
  });

  return nextUIDs;
};

export const getTableAggregateFieldRows = (
  element: Widget | any,
  uid?: OptionFieldUID | null,
) => {
  const optionUID = resolveTableAggregateOptionUID(element, uid);
  if (!optionUID) return [] as Row[];

  const uids = expandTableAggregateDataUids(element, [optionUID]);
  return element.getData?.().getRows(uids.length ? uids : [optionUID]) || [];
};

export const evaluateBucketStageTableAggregateField = (
  element: Widget | any,
  dim?: OptionFieldValue | null,
  rows: Row[] = [],
) => {
  if (!dim?.uid?.length) return undefined;

  const optionUID = resolveTableAggregateOptionUID(element, dim.uid);
  if (!optionUID) return undefined;

  const meta = getTableAggregateFieldMeta(element, optionUID);
  if (!meta || meta.computeStage !== "bucket") return undefined;

  if (meta.mode === "singleField") {
    const singleFieldFieldUID = resolveSingleFieldConfigFieldUID(element, optionUID, meta.singleFieldConfig);
    return aggregateSingleFieldValues(
      meta.singleFieldConfig?.aggregate,
      getFieldValues(rows, singleFieldFieldUID, meta.singleFieldConfig?.subFieldUID),
    );
  }

  const formula = String(meta.formula || "").trim();
  if (!formula) return 0;

  let nextFormula = replaceBucketAggregateFunctions(formula, rows, optionUID[1], meta);
  nextFormula = replaceByFormula(nextFormula, ids => resolveBucketTokenValue(rows, optionUID[1], ids));

  const field = element.getField?.(optionUID) as Field | undefined;
  const runtime = createFormulaRuntimeByData(rows[0] || {}, field ? [field] : []);
  return toSafeNumber(evaluateFormulaWithRuntime(nextFormula, runtime));
};
