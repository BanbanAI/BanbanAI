import {
  AggregateMetricVariable,
  FilterRule,
  TableAggregateField,
  TableAggregateFieldMode,
} from "@common/types/nocode";
import {
  Field,
  FieldMeta,
  FieldUID,
  Row,
  Table,
  TableUID,
  WhereCondition,
} from "@common/types/project";
import {
  createFormulaRuntimeByData,
  evaluateFormulaWithRuntime,
  replaceByFormula,
} from "./formula";
import { transformFilterRule } from "./connection";

export type TableAggregateFieldComputeStage = "row" | "bucket";

type TableAggregateFieldRuntimeMeta = {
  uid: string;
  mode: TableAggregateFieldMode;
  computeStage: TableAggregateFieldComputeStage;
  formula?: string;
  hasAggregateFunctions?: boolean;
  singleFieldConfig?: Pick<AggregateMetricVariable, "aggregate" | "fieldUID" | "subFieldUID"> | null;
  filterRules?: Record<string, Record<TableUID, FilterRule>>;
};

type PrintableTableAggregateFieldOptions = {
  sourceRows?: Row[];
};

const TABLE_AGGREGATE_FUNCTION_NAMES = new Set([
  "SUM",
  "AVERAGE",
  "COUNT",
  "MAX",
  "MIN",
]);

const AGGREGATE_FUNCTION_CALL_REGEX = /\b(SUM|AVERAGE|COUNT|MAX|MIN)(?:<([a-zA-Z0-9_-]+)>)?\(\s*(\[\[([^\]]+)\]\])\s*\)/gi;

const buildFieldMeta = (uid: string, name: string, extra: Record<string, any> = {}, subType?: string): FieldMeta => ({
  uid,
  name,
  subType,
  extra,
});

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const isEmptyValue = (value: any) => {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
};

const toSafeNumber = (value: any) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeComparableValue = (value: any) => {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
};

const isEqualValue = (left: any, right: any) => {
  return normalizeComparableValue(left) === normalizeComparableValue(right);
};

export const normalizeTableAggregateFieldMode = (field: TableAggregateField): TableAggregateFieldMode => {
  if (field.mode) return field.mode;
  return field.singleFieldConfig ? "singleField" : "formula";
};

export const scanTableAggregateFormula = (formula: string) => {
  const normalizedFormula = String(formula || "").replace(/<[^>]+>/g, "");
  let hasAggregateFunctions = false;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < normalizedFormula.length; i++) {
    const ch = normalizedFormula[i];
    const next = normalizedFormula[i + 1];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === "\"" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) continue;

    if (ch === "[" && next === "[") {
      const end = normalizedFormula.indexOf("]]", i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }

    if (ch === "(") {
      let cursor = i - 1;
      while (cursor >= 0 && /\s/.test(normalizedFormula[cursor])) cursor--;
      let end = cursor;
      while (cursor >= 0 && /[a-zA-Z0-9_]/.test(normalizedFormula[cursor])) cursor--;

      const fnName = normalizedFormula.slice(cursor + 1, end + 1).toUpperCase();
      if (/^[A-Z_][A-Z0-9_]*$/.test(fnName) && TABLE_AGGREGATE_FUNCTION_NAMES.has(fnName)) {
        hasAggregateFunctions = true;
      }
    }
  }

  return hasAggregateFunctions;
};

export const resolveTableAggregateFieldComputeStage = (
  field: TableAggregateField,
): TableAggregateFieldComputeStage => {
  if (normalizeTableAggregateFieldMode(field) === "singleField") return "bucket";
  return scanTableAggregateFormula(field.formula || "") ? "bucket" : "row";
};

const createRuntimeMeta = (field: TableAggregateField): TableAggregateFieldRuntimeMeta => {
  const mode = normalizeTableAggregateFieldMode(field);
  const computeStage = resolveTableAggregateFieldComputeStage(field);

  return {
    uid: field.uid,
    mode,
    computeStage,
    formula: field.formula || "",
    hasAggregateFunctions: mode === "formula" ? scanTableAggregateFormula(field.formula || "") : false,
    singleFieldConfig: field.singleFieldConfig ? {
      aggregate: field.singleFieldConfig.aggregate,
      fieldUID: field.singleFieldConfig.fieldUID,
      subFieldUID: field.singleFieldConfig.subFieldUID,
    } : null,
    filterRules: field.filterRules || {},
  };
};

const createAggregateField = (
  aggregateField: TableAggregateField,
  format: TableAggregateField["format"] = {},
): Field => {
  const runtimeMeta = createRuntimeMeta(aggregateField);
  return {
    uid: aggregateField.uid as FieldUID,
    alias: aggregateField.name,
    type: "number",
    meta: buildFieldMeta(aggregateField.uid, aggregateField.name, {
      widgetType: "widget.form.numberInput",
      isAggregateMetric: true,
      isPercent: format.isPercent ?? false,
      completeZero: format.completeZero ?? false,
      decimalPlaces: format.decimalPlaces ?? 0,
      thousandSeparator: format.thousandSeparator || "",
      decimalSeparator: format.decimalSeparator || ".",
      tableAggregateField: runtimeMeta,
    }, "number"),
  };
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

const resolveAggregateSourceValues = (
  row: Row,
  ids: string[] = [],
  currentTableUID?: string,
) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, currentTableUID);
  if (!fieldUID) return [] as any[];

  if (fieldUID === "_count") return [1];
  if (subFieldUID === "_count") {
    return toArray(row?.[fieldUID]).map(() => 1);
  }
  if (subFieldUID) {
    return toArray(row?.[fieldUID]).map(item => item?.[subFieldUID]);
  }
  return [row?.[fieldUID]];
};

const resolveScalarTokenValue = (
  row: Row,
  ids: string[] = [],
  currentTableUID?: string,
) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, currentTableUID);
  if (!fieldUID) return 0;

  if (fieldUID === "_count") return 1;
  if (subFieldUID === "_count") return toArray(row?.[fieldUID]).length;
  if (subFieldUID) {
    return toArray(row?.[fieldUID])[0]?.[subFieldUID] ?? 0;
  }
  return row?.[fieldUID] ?? 0;
};

const isContainAllValues = (currentValue: any, expectedValue: any) => {
  if (!Array.isArray(currentValue)) return false;
  const expectedList = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
  return expectedList.every(item => currentValue.some(value => isEqualValue(value, item)));
};

const applyFieldWhereRule = (value: any, rule: any): boolean => {
  if (rule === undefined) return true;
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
    return isEqualValue(value, rule);
  }

  if (rule.$eq !== undefined && !isEqualValue(value, rule.$eq)) return false;
  if (rule.$ne !== undefined && isEqualValue(value, rule.$ne)) return false;
  if (rule.$gt !== undefined && !(toSafeNumber(value) > toSafeNumber(rule.$gt))) return false;
  if (rule.$gte !== undefined && !(toSafeNumber(value) >= toSafeNumber(rule.$gte))) return false;
  if (rule.$lt !== undefined && !(toSafeNumber(value) < toSafeNumber(rule.$lt))) return false;
  if (rule.$lte !== undefined && !(toSafeNumber(value) <= toSafeNumber(rule.$lte))) return false;
  if (rule.$in !== undefined) {
    const compareList = Array.isArray(rule.$in) ? rule.$in : [rule.$in];
    if (!compareList.some(item => isEqualValue(value, item))) return false;
  }
  if (rule.$nin !== undefined) {
    const compareList = Array.isArray(rule.$nin) ? rule.$nin : [rule.$nin];
    if (compareList.some(item => isEqualValue(value, item))) return false;
  }
  if (rule.$all !== undefined && !isContainAllValues(value, rule.$all)) return false;
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

const matchAggregateFilterRule = (
  row: Row,
  filterRule?: FilterRule | null,
  fields: Field[] = [],
) => {
  if (!filterRule?.conditions?.length) return true;
  const formulaRuntime = createFormulaRuntimeByData(row, fields);
  const whereCondition = transformFilterRule(filterRule, row, { formulaRuntime });
  return matchWhereCondition(row, whereCondition);
};

const evaluateAggregateValues = (
  values: any[] = [],
  aggregate: AggregateMetricVariable["aggregate"] = "SUM",
) => {
  switch (aggregate) {
    case "COUNT":
      return values.filter(value => !isEmptyValue(value)).length;
    case "AVERAGE": {
      const numberValues = values.filter(value => !isEmptyValue(value)).map(toSafeNumber);
      if (!numberValues.length) return 0;
      return numberValues.reduce((sum, value) => sum + value, 0) / numberValues.length;
    }
    case "MAX": {
      const numberValues = values.filter(value => !isEmptyValue(value)).map(toSafeNumber);
      return numberValues.length ? Math.max(...numberValues) : 0;
    }
    case "MIN": {
      const numberValues = values.filter(value => !isEmptyValue(value)).map(toSafeNumber);
      return numberValues.length ? Math.min(...numberValues) : 0;
    }
    case "SUM":
    default:
      return values
        .filter(value => !isEmptyValue(value))
        .map(toSafeNumber)
        .reduce((sum, value) => sum + value, 0);
  }
};

const resolvePrintableAggregateSourceRows = (
  row: Row,
  options?: PrintableTableAggregateFieldOptions,
) => {
  return options?.sourceRows?.length ? options.sourceRows : [row];
};

const collectAggregateSourceValues = (
  sourceRows: Row[] = [],
  ids: string[] = [],
  currentTableUID?: string,
  filterRule?: FilterRule | null,
  fields: Field[] = [],
) => {
  const values: any[] = [];
  for (const sourceRow of sourceRows) {
    if (filterRule && !matchAggregateFilterRule(sourceRow, filterRule, fields)) continue;
    values.push(...resolveAggregateSourceValues(sourceRow, ids, currentTableUID));
  }
  return values;
};

const replaceAggregateFunctionCallsInFormula = (
  aggregateField: TableAggregateField,
  row: Row,
  table: Table,
  options?: PrintableTableAggregateFieldOptions,
) => {
  let nextFormula = String(aggregateField.formula || "");
  const sourceRows = resolvePrintableAggregateSourceRows(row, options);

  for (let i = 0; i < 50; i++) {
    let replaced = false;
    nextFormula = nextFormula.replace(
      AGGREGATE_FUNCTION_CALL_REGEX,
      (_match, fnName: string, fnId: string, _token: string, tokenContent: string) => {
        replaced = true;
        const rawPath = String(tokenContent || "").split(",")[0] || "";
        const ids = rawPath.split(".").filter(Boolean);
        const filterRule = fnId ? aggregateField.filterRules?.[fnId]?.[table.uid] : undefined;
        const values = collectAggregateSourceValues(
          sourceRows,
          ids,
          table.uid,
          filterRule,
          table.fields || [],
        );

        return String(
          evaluateAggregateValues(
            values,
            String(fnName || "SUM").toUpperCase() as AggregateMetricVariable["aggregate"],
          ),
        );
      },
    );

    if (!replaced) break;
  }

  return nextFormula;
};

const evaluateFormulaAggregateFieldValue = (
  aggregateField: TableAggregateField,
  row: Row,
  table: Table,
  options?: PrintableTableAggregateFieldOptions,
) => {
  const formula = String(aggregateField.formula || "").trim();
  if (!formula) return 0;

  let nextFormula = replaceAggregateFunctionCallsInFormula(aggregateField, row, table, options);
  nextFormula = replaceByFormula(nextFormula, ids => resolveScalarTokenValue(row, ids, table.uid));
  const runtime = createFormulaRuntimeByData(row, table.fields || []);

  try {
    return toSafeNumber(evaluateFormulaWithRuntime(nextFormula, runtime));
  } catch (error) {
    return 0;
  }
};

const evaluateSingleFieldAggregateFieldValue = (
  aggregateField: TableAggregateField,
  row: Row,
  table: Table,
  options?: PrintableTableAggregateFieldOptions,
) => {
  const singleFieldConfig = aggregateField.singleFieldConfig;
  if (!singleFieldConfig) return 0;
  const sourceRows = resolvePrintableAggregateSourceRows(row, options);

  const ids = [table.uid, singleFieldConfig.fieldUID, singleFieldConfig.subFieldUID].filter(Boolean) as string[];
  const values = collectAggregateSourceValues(
    sourceRows,
    ids,
    table.uid,
    singleFieldConfig.filterRule,
    table.fields || [],
  );
  return evaluateAggregateValues(values, singleFieldConfig.aggregate || "SUM");
};

const isTableAggregateFieldAvailable = (field?: TableAggregateField | null) => {
  if (!field?.uid || !field?.name) return false;
  if (normalizeTableAggregateFieldMode(field) === "singleField") {
    return Boolean(field.singleFieldConfig?.fieldUID || field.singleFieldConfig?.subFieldUID);
  }
  return Boolean(String(field.formula || "").trim());
};

export const isPrintableTableAggregateField = (field?: TableAggregateField | null) => {
  if (!isTableAggregateFieldAvailable(field)) return false;
  return resolveTableAggregateFieldComputeStage(field as TableAggregateField) === "bucket";
};

export const buildTableAggregateRuntimeFields = (
  _tableUID: TableUID,
  aggregateFields: TableAggregateField[] = [],
) => {
  return aggregateFields
    .filter(isPrintableTableAggregateField)
    .map(field => createAggregateField(field, field.format));
};

export const evaluatePrintableTableAggregateFieldValue = (
  aggregateField: TableAggregateField,
  row: Row,
  table: Table,
  options?: PrintableTableAggregateFieldOptions,
) => {
  if (!isPrintableTableAggregateField(aggregateField)) return 0;
  if (normalizeTableAggregateFieldMode(aggregateField) === "singleField") {
    return evaluateSingleFieldAggregateFieldValue(aggregateField, row, table, options);
  }
  return evaluateFormulaAggregateFieldValue(aggregateField, row, table, options);
};

export const fillPrintableTableAggregateFieldValues = (
  rows: Row[] = [],
  table: Table,
  aggregateFields: TableAggregateField[] = [],
  options?: PrintableTableAggregateFieldOptions,
) => {
  const printableFields = aggregateFields.filter(isPrintableTableAggregateField);
  if (!rows.length || !printableFields.length) return rows;

  return rows.map(originRow => {
    const row = { ...originRow };
    printableFields.forEach(field => {
      row[field.uid as FieldUID] = evaluatePrintableTableAggregateFieldValue(field, row, table, options);
    });
    return row;
  });
};
