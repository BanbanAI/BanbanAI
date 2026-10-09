import {
  AggregateMetricVariable,
  FilterRule,
  FormTableViewMeta,
  TableAggregateField,
  TableAggregateFieldMode,
} from "@common/types/nocode";
import {
  Bucket,
  Connection,
  Field,
  FieldMeta,
  FieldUID,
  Row,
  Table,
  TableUID,
} from "@common/types/project";
import {
  createFormulaRuntimeByData,
  evaluateFormulaWithRuntime,
  replaceByFormula,
  replaceColFieldsByFormula,
} from "@common/utils/formula";

export type TableAggregateRuntimeSource = {
  uid: string;
  nocodeId?: string;
  tables?: Table[];
  metas?: Record<TableUID, FormTableViewMeta>;
};

export type TableAggregateRuntimeContext = {
  sources: TableAggregateRuntimeSource[];
};

type TableAggregateComputeStage = "row" | "bucket";

type TableAggregateFieldRuntimeMeta = {
  uid: string;
  mode: TableAggregateFieldMode;
  computeStage: TableAggregateComputeStage;
  formula?: string;
  hasAggregateFunctions?: boolean;
  dependencies: string[];
  singleFieldConfig?: Pick<AggregateMetricVariable, "aggregate" | "fieldUID" | "subFieldUID"> | null;
  filterRules?: Record<string, Record<TableUID, FilterRule>>;
};

const TABLE_AGGREGATE_FUNCTION_NAMES = new Set([
  "SUM",
  "AVERAGE",
  "COUNT",
  "MAX",
  "MIN",
]);

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

const toSafeNumber = (value: any) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeFormulaRuntimeValue = (value: any) => {
  return value === undefined || value === null ? 0 : value;
};

const normalizeFieldMode = (field: TableAggregateField): TableAggregateFieldMode => {
  if (field.mode) return field.mode;
  return field.singleFieldConfig ? "singleField" : "formula";
};

const scanAggregateFormula = (formula: string) => {
  const normalizedFormula = String(formula || "").replace(/<[^>]+>/g, "");
  let hasAggregateFunctions = false;

  let depth = 0;
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
      depth++;
      continue;
    }

    if (ch === ")") {
      depth = Math.max(depth - 1, 0);
    }
  }

  return hasAggregateFunctions;
};

const collectFormulaDependencies = (formula: string) => {
  const ids = new Set<string>();
  String(formula || "").replace(/\[\[([^\],]+)(?:,[^\]]*)?\]\]/g, (_match, id) => {
    if (id) ids.add(id);
    return _match;
  });
  return Array.from(ids);
};

const collectFilterRuleDependencies = (
  filterRules?: Record<string, Record<TableUID, FilterRule>>,
) => {
  const ids = new Set<string>();
  Object.values(filterRules || {}).forEach(filterRuleMap => {
    Object.entries(filterRuleMap || {}).forEach(([tableUID, filterRule]) => {
      (filterRule?.conditions || []).forEach(condition => {
        if (!condition?.uid || !tableUID) return;
        ids.add([tableUID, condition.uid].filter(Boolean).join("."));
      });
    });
  });
  return Array.from(ids);
};

const resolveComputeStage = (field: TableAggregateField): TableAggregateComputeStage => {
  if (normalizeFieldMode(field) === "singleField") return "bucket";
  return scanAggregateFormula(field.formula || "") ? "bucket" : "row";
};

const createRuntimeMeta = (field: TableAggregateField, tableUID: TableUID): TableAggregateFieldRuntimeMeta => {
  const mode = normalizeFieldMode(field);
  const computeStage = resolveComputeStage(field);
  const dependencies = mode === "singleField"
    ? [([tableUID, field.singleFieldConfig?.fieldUID, field.singleFieldConfig?.subFieldUID].filter(Boolean).join("."))]
      .filter(Boolean)
    : Array.from(new Set([
      ...collectFormulaDependencies(field.formula || ""),
      ...collectFilterRuleDependencies(field.filterRules),
    ]));

  return {
    uid: field.uid,
    mode,
    computeStage,
    formula: field.formula || "",
    hasAggregateFunctions: mode === "formula" ? scanAggregateFormula(field.formula || "") : false,
    dependencies,
    singleFieldConfig: field.singleFieldConfig ? {
      aggregate: field.singleFieldConfig.aggregate,
      fieldUID: field.singleFieldConfig.fieldUID,
      subFieldUID: field.singleFieldConfig.subFieldUID,
    } : null,
    filterRules: field.filterRules || {},
  };
};

const createAggregateField = (
  tableUID: TableUID,
  aggregateField: TableAggregateField,
  format: TableAggregateField["format"] = {},
): Field => {
  const runtimeMeta = createRuntimeMeta(aggregateField, tableUID);
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

const getRuntimeSourceByUID = (sources: TableAggregateRuntimeSource[] = [], uid?: string) => {
  if (!uid) return undefined;
  return sources.find(item => item.uid === uid);
};

const getTableAggregateFields = (source?: TableAggregateRuntimeSource | null, tableUID?: TableUID | null) => {
  if (!source?.metas || !tableUID) return [] as TableAggregateField[];
  return source.metas?.[tableUID]?.aggregateFields || [];
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

const resolveColTokenValue = (table: Table, row: Row, ids: string[] = []) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, table.uid);
  if (!fieldUID) return undefined;

  if (fieldUID === "_count") return [1];
  if (subFieldUID === "_count") return [toArray(row?.[fieldUID]).length];
  if (subFieldUID) {
    return toArray(row?.[fieldUID]).map(item => item?.[subFieldUID]);
  }
  return [row?.[fieldUID]];
};

const resolveTokenValue = (table: Table, row: Row, ids: string[] = []) => {
  const { fieldUID, subFieldUID } = resolveFormulaFieldIds(ids, table.uid);
  if (!fieldUID) return undefined;

  if (fieldUID === "_count") return 1;
  if (subFieldUID === "_count") return toArray(row?.[fieldUID]).length;
  if (subFieldUID) {
    return normalizeFormulaRuntimeValue(toArray(row?.[fieldUID])[0]?.[subFieldUID]);
  }
  return normalizeFormulaRuntimeValue(row?.[fieldUID]);
};

const evaluateRowFormulaFieldValue = (
  aggregateField: TableAggregateField,
  currentTable: Table,
  row: Row,
  bucketFields: Field[],
) => {
  const formula = String(aggregateField.formula || "").trim();
  if (!formula) return undefined;

  let nextFormula = replaceColFieldsByFormula(formula, ids => resolveColTokenValue(currentTable, row, ids));
  nextFormula = replaceByFormula(nextFormula, ids => resolveTokenValue(currentTable, row, ids));
  const runtime = createFormulaRuntimeByData(row, bucketFields);
  try {
    return toSafeNumber(evaluateFormulaWithRuntime(nextFormula, runtime));
  } catch (error) {
    console.warn("evaluate row aggregate formula error:", error);
    return undefined;
  }
};

const isTableAggregateFieldAvailable = (field?: TableAggregateField | null) => {
  if (!field?.uid || !field?.name) return false;
  if (normalizeFieldMode(field) === "singleField") {
    return Boolean(field.singleFieldConfig?.fieldUID || field.singleFieldConfig?.subFieldUID);
  }
  return Boolean(String(field.formula || "").trim());
};

const buildRuntimeFields = (tableUID: TableUID, aggregateFields: TableAggregateField[] = []) => {
  return aggregateFields.filter(isTableAggregateFieldAvailable).map(field => createAggregateField(tableUID, field, field.format));
};

const mergeFields = (tableUID: TableUID, fields: Field[] = [], aggregateFields: TableAggregateField[] = []) => {
  const nextFieldMap = new Map<string, Field>();
  fields.forEach(field => nextFieldMap.set(field.uid, field));
  buildRuntimeFields(tableUID, aggregateFields).forEach(field => nextFieldMap.set(field.uid, field));
  return Array.from(nextFieldMap.values());
};

export const extendConnectionsWithTableAggregateFields = (
  connections: Connection[] = [],
  sources: TableAggregateRuntimeSource[] = [],
) => {
  if (!connections.length || !sources.length) return connections;
  const sourceMap = new Map<string, TableAggregateRuntimeSource>(sources.map(source => [source.uid, source]));

  return connections.map(connection => {
    const source = sourceMap.get(connection.uid);
    if (!source?.tables?.length || !connection.tables?.length) return connection;

    const tables = connection.tables.map(table => {
      const aggregateFields = getTableAggregateFields(source, table.uid).filter(isTableAggregateFieldAvailable);
      if (!aggregateFields.length) return table;
      return {
        ...table,
        fields: mergeFields(table.uid, table.fields || [], aggregateFields),
      } as Table;
    });

    return {
      ...connection,
      tables,
    } as Connection;
  });
};

export const mergeBucketsWithTableAggregateFields = (
  connectionUID: string,
  buckets: Bucket[] = [],
  context: TableAggregateRuntimeContext,
) => {
  const source = getRuntimeSourceByUID(context.sources, connectionUID);
  if (!source?.tables?.length) return buckets;

  return buckets.map(bucket => {
    const table = source.tables?.find(item => item.uid === bucket.tableId);
    const aggregateFields = getTableAggregateFields(source, bucket.tableId as TableUID).filter(isTableAggregateFieldAvailable);
    if (!table || !aggregateFields.length) return bucket;

    const fields = mergeFields(table.uid, bucket.fields || [], aggregateFields);
    const rowStageFields = aggregateFields.filter(field => resolveComputeStage(field) === "row");
    if (!rowStageFields.length) {
      return {
        ...bucket,
        fields,
      } as Bucket;
    }

    const rows = (bucket.rows || []).map(originRow => {
      const row = { ...originRow };
      rowStageFields.forEach(aggregateField => {
        row[aggregateField.uid as FieldUID] = evaluateRowFormulaFieldValue(aggregateField, table, row, fields);
      });
      return row;
    });

    return {
      ...bucket,
      fields,
      rows,
    } as Bucket;
  });
};
