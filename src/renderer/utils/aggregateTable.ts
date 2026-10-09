import {
  AggregateDimension,
  AggregateDimensionDateFormat,
  AggregateDimensionItem,
  AggregateMetric,
  AggregateMetricVariable,
  AggregateTable,
} from "@common/types/nocode";
import {
  Bucket,
  Connection,
  ConnectionData,
  FieldUID,
  OptionTableUID,
  QueryOptions,
  Row,
  Table,
  TableUID,
} from "@common/types/project";
import { deepClone } from "@common/utils/object";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import i18next from "i18next";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { evaluateFormulaWithRuntime } from "@common/utils/formula";
import {
  applyQueryOptionsToRows,
  isEmptyValue,
  isEqualValue,
  normalizeComparableValue,
  toSafeNumber,
  type AggregateRuntimeContext,
  type AggregateRuntimeSource,
} from "@common/utils/aggregateTableShared";
import {
  buildAggregateRuntimeFields,
  buildSourceRuntimeMap,
  getAggregateTables,
  getRuntimeSourceByUID,
  getSourceTableRuntime,
  matchMetricVariableFilterRule,
  resolveReferenceValueFromRecord,
  type AggregateRuntimeFieldLabels,
  type AggregateSourceRuntime,
  type AggregateSourceRuntimeRecord,
} from "@common/utils/aggregateTableRuntimeShared";

dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

export type { AggregateRuntimeContext, AggregateRuntimeSource } from "@common/utils/aggregateTableShared";

export const isAggregateTableAvailable = (
  aggregateTable?: Pick<AggregateTable, "sourceTables" | "metrics"> | null,
) => {
  if (!aggregateTable) return false;
  const hasSource = (aggregateTable.sourceTables || []).some(item => !!item.tableUID);
  const hasMetric = Boolean(aggregateTable.metrics?.length);
  return hasSource && hasMetric;
};

type AggregateMetricConsumeContext = {
  aggregateTable: AggregateTable;
  metric: AggregateMetric;
  row: Row;
  tokenValueMap?: Map<string, number>;
};

const AGGREGATE_TOKEN_REGEX = /\[\[([a-zA-Z0-9.:_]+(?:\.[a-zA-Z0-9_]+)*),([^\]]+?)\]\]/gu;
const AGGREGATE_UUID_FIELD_UID = "_uuid" as FieldUID;

const buildAggregateRowUUID = (aggregateTable: AggregateTable, groupKey: string) => {
  return `aggregate:${aggregateTable.uid}:${groupKey}`;
};

const getRendererAggregateFieldLabels = (): AggregateRuntimeFieldLabels => ({
  dataId: i18next.t("aggregateTable.dataId"),
  getDimensionName: (index, name) => name || i18next.t("aggregateTable.dimensionFieldName", {
    index: index + 1,
  }),
  getMetricName: (index, name) => name || i18next.t("aggregateTable.metricFieldName", {
    index: index + 1,
  }),
});

const serializeGroupKey = (values: any[]) => {
  return JSON.stringify(values.map(value => normalizeComparableValue(value)));
};

const getDimensionItemBySourceUID = (dimension: AggregateDimension, sourceUID: string) => {
  return (dimension.items || []).find(item => item.sourceUID === sourceUID);
};

const resolveSourceFieldByReference = (
  reference: Pick<AggregateDimensionItem, "fieldUID" | "subFieldUID">,
  sourceRuntime: AggregateSourceRuntime,
) => {
  if (reference.subFieldUID && reference.subFieldUID !== "_count") {
    return sourceRuntime.subTable?.fields.find(field => field.uid === reference.subFieldUID);
  }
  if (reference.fieldUID && reference.fieldUID !== "_count") {
    return sourceRuntime.mainTable?.fields.find(field => field.uid === reference.fieldUID);
  }
  return undefined;
};

const toDayjsValue = (value: any) => {
  if (value === undefined || value === null || value === "") return null;
  const date = dayjs(value);
  if (!date.isValid()) return null;
  return date;
};

const formatDimensionDateValue = (date: dayjs.Dayjs, dateFormat: AggregateDimensionDateFormat) => {
  switch (dateFormat) {
    case "year":
      return date.format("YYYY");
    case "year-quarter":
      return `${date.format("YYYY")}-Q${date.quarter()}`;
    case "year-month":
      return date.format("YYYY-MM");
    case "year-week": {
      const weekYear = typeof date.isoWeekYear === "function" ? date.isoWeekYear() : date.year();
      return `${weekYear}-${`${date.isoWeek()}`.padStart(2, "0")}${i18next.t("aggregateTable.weekSuffix")}`;
    }
    case "year-month-day":
    default:
      return date.format("YYYY-MM-DD");
  }
};

const normalizeRangeCursor = (date: dayjs.Dayjs, dateFormat: AggregateDimensionDateFormat) => {
  switch (dateFormat) {
    case "year":
      return date.startOf("year");
    case "year-quarter":
      return date.startOf("quarter");
    case "year-month":
      return date.startOf("month");
    case "year-week":
      return date.startOf("isoWeek");
    case "year-month-day":
    default:
      return date.startOf("day");
  }
};

const getRangeStepUnit = (dateFormat: AggregateDimensionDateFormat) => {
  switch (dateFormat) {
    case "year":
      return "year" as const;
    case "year-quarter":
      return "quarter" as const;
    case "year-month":
      return "month" as const;
    case "year-week":
      return "week" as const;
    case "year-month-day":
    default:
      return "day" as const;
  }
};

const buildDateRangeDimensionValues = (value: any, dateFormat: AggregateDimensionDateFormat) => {
  if (!Array.isArray(value) || value.length < 2) return [undefined];
  const start = toDayjsValue(value[0]);
  const end = toDayjsValue(value[1]);
  if (!start || !end) return [undefined];

  const startCursor = normalizeRangeCursor(start, dateFormat);
  const endCursor = normalizeRangeCursor(end, dateFormat);
  if (startCursor.valueOf() > endCursor.valueOf()) return [undefined];

  const values = new Set<string>();
  const stepUnit = getRangeStepUnit(dateFormat);
  let current = startCursor;
  while (current.valueOf() <= endCursor.valueOf()) {
    values.add(formatDimensionDateValue(current, dateFormat));
    current = current.add(1, stepUnit as any);
  }
  return values.size ? Array.from(values) : [undefined];
};

const resolveDimensionValuesFromRecord = (
  dimension: AggregateDimension,
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
) => {
  const item = getDimensionItemBySourceUID(dimension, sourceRuntime.sourceTable.uid);
  if (!item || (!item.fieldUID && !item.subFieldUID)) return [undefined];

  const currentValue = resolveReferenceValueFromRecord(item, runtimeRecord, sourceRuntime);
  const field = resolveSourceFieldByReference(item, sourceRuntime);
  const subType = field?.meta?.subType;

  if (!dimension.dateFormat || !["date", "daterange"].includes(subType || "")) {
    return [currentValue];
  }
  if (subType === "daterange") {
    return buildDateRangeDimensionValues(currentValue, dimension.dateFormat);
  }
  const date = toDayjsValue(currentValue);
  return [date ? formatDimensionDateValue(date, dimension.dateFormat) : undefined];
};

const buildDimensionValueCombinations = (valueGroups: any[][]) => valueGroups.reduce<any[][]>((result, group) => {
  const currentGroup = group.length ? group : [undefined];
  return result.flatMap(prefix => currentGroup.map(value => [...prefix, value]));
}, [[]]);

const matchGroupDimensionsBySource = (
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
  dimensions: AggregateDimension[] = [],
  groupRow: Row,
) => {
  return dimensions.every(dimension => {
    const item = getDimensionItemBySourceUID(dimension, sourceRuntime.sourceTable.uid);
    if (!item || (!item.fieldUID && !item.subFieldUID)) return true;
    const expectedValue = groupRow[dimension.uid as FieldUID];
    const currentValues = resolveDimensionValuesFromRecord(dimension, runtimeRecord, sourceRuntime);
    return currentValues.some(currentValue => isEqualValue(currentValue, expectedValue));
  });
};

const calculateMetricVariableValue = (
  metricVariable: AggregateMetricVariable,
  matchedRecords: AggregateSourceRuntimeRecord[],
  sourceRuntime: AggregateSourceRuntime,
) => {
  const values: number[] = [];

  if (metricVariable.fieldUID === "_count" || metricVariable.subFieldUID === "_count") {
    matchedRecords.forEach(record => {
      const value = resolveReferenceValueFromRecord(metricVariable, record, sourceRuntime);
      values.push(toSafeNumber(value));
    });
  } else if (metricVariable.subFieldUID) {
    matchedRecords.forEach(record => {
      const value = resolveReferenceValueFromRecord(metricVariable, record, sourceRuntime);
      if (!isEmptyValue(value)) values.push(toSafeNumber(value));
    });
  } else if (metricVariable.fieldUID) {
    const uniqueRows = new Set<Row>();
    matchedRecords.forEach(record => {
      if (uniqueRows.has(record.mainRow)) return;
      uniqueRows.add(record.mainRow);
      const value = resolveReferenceValueFromRecord(metricVariable, record, sourceRuntime);
      if (!isEmptyValue(value)) values.push(toSafeNumber(value));
    });
  }

  const aggregateType = metricVariable.aggregate || "SUM";
  if (!values.length) return 0;
  switch (aggregateType) {
    case "COUNT":
      return values.filter(value => !isEmptyValue(value)).length;
    case "AVERAGE":
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case "MAX":
      return Math.max(...values);
    case "MIN":
      return Math.min(...values);
    case "SUM":
    default:
      return values.reduce((sum, value) => sum + value, 0);
  }
};

const getMetricRuntimeVariables = (metric: AggregateMetric) => {
  if (metric.mode === "singleField") {
    return metric.singleFieldConfig ? [metric.singleFieldConfig] : [];
  }
  return metric.variables || [];
};

const buildAggregateMetricTokenValueMap = (
  metric: AggregateMetric,
  row: Row,
  dimensions: AggregateDimension[],
  runtimeMap: Map<string, AggregateSourceRuntime>,
) => {
  const tokenValueMap = new Map<string, number>();

  getMetricRuntimeVariables(metric).forEach(variable => {
    const sourceRuntime = getSourceTableRuntime(runtimeMap, variable.sourceUID);
    if (!sourceRuntime) {
      tokenValueMap.set(variable.uid, 0);
      return;
    }

    const matchedRecords = sourceRuntime.records
      .filter(record => matchGroupDimensionsBySource(record, sourceRuntime, dimensions, row))
      .filter(record => matchMetricVariableFilterRule(variable.filterRule, record, sourceRuntime));
    const variableValue = calculateMetricVariableValue(variable, matchedRecords, sourceRuntime);
    tokenValueMap.set(variable.uid, variableValue);
  });

  return tokenValueMap;
};

export const resolveAggregateMetricValueByRow = (
  row: Row,
  metricUID?: string | null,
) => {
  if (!metricUID) return 0;
  const metricValue = Number(row?.[metricUID as FieldUID]);
  return Number.isFinite(metricValue) ? metricValue : 0;
};

const resolveMetricFormulaTokenValue = (
  consumeContext: AggregateMetricConsumeContext,
  rawPath: string,
) => {
  const { aggregateTable, row, tokenValueMap = new Map<string, number>() } = consumeContext;
  const ids = String(rawPath || "").split(".");
  if (ids.length >= 3) {
    const variableUID = ids.at(-1) || "";
    const value = tokenValueMap.get(variableUID);
    return Number.isFinite(value as number) ? Number(value) : 0;
  }

  if (ids.length === 2) {
    const legacyVariableValue = tokenValueMap.get(ids[1] || "");
    if (Number.isFinite(legacyVariableValue as number)) return Number(legacyVariableValue);

    if (ids[0] === aggregateTable.uid) {
      const metricValue = resolveAggregateMetricValueByRow(row, ids[1]);
      if (Number.isFinite(metricValue)) return metricValue;
    }
  }

  const fallbackValue = tokenValueMap.get(ids.at(-1) || "");
  return Number.isFinite(fallbackValue as number) ? Number(fallbackValue) : 0;
};

const replaceMetricFormulaToken = (
  consumeContext: AggregateMetricConsumeContext,
  formula: string,
) => {
  return formula.replace(AGGREGATE_TOKEN_REGEX, (_, rawPath) => {
    return String(resolveMetricFormulaTokenValue(consumeContext, String(rawPath || "")));
  });
};

export const evaluateAggregateMetricByConsumeContext = (
  consumeContext: AggregateMetricConsumeContext,
) => {
  const { aggregateTable, metric, row, tokenValueMap = new Map<string, number>() } = consumeContext;
  const runtimeVariables = getMetricRuntimeVariables(metric);
  if (metric.mode === "singleField") {
    const variableUID = runtimeVariables[0]?.uid || "";
    return tokenValueMap.get(variableUID) || 0;
  }
  const formula = metric.formula || "";
  if (!formula.trim()) {
    if (runtimeVariables.length === 1) {
      const variableUID = runtimeVariables[0]?.uid || "";
      return tokenValueMap.get(variableUID) || 0;
    }
    return 0;
  }

  const formulaWithValue = replaceMetricFormulaToken(consumeContext, formula);
  try {
    const result = evaluateFormulaWithRuntime(formulaWithValue, null);
    const numberResult = Number(result);
    if (Number.isFinite(numberResult)) return numberResult;
    return 0;
  } catch (error) {
    return 0;
  }
};

const buildAggregateRows = (
  aggregateTable: AggregateTable,
  runtimeMap: Map<string, AggregateSourceRuntime>,
) => {
  const dimensions = aggregateTable.dimensions || [];
  const metrics = aggregateTable.metrics || [];
  const groupMap = new Map<string, Row>();

  if (!dimensions.length) {
    groupMap.set("__all__", {});
  } else {
    runtimeMap.forEach(sourceRuntime => {
      sourceRuntime.records.forEach(record => {
        const valueGroups = dimensions.map(dimension => resolveDimensionValuesFromRecord(dimension, record, sourceRuntime));
        if (valueGroups.every(group => group.every(value => value === undefined))) return;

        buildDimensionValueCombinations(valueGroups).forEach(values => {
          if (aggregateTable.dimensionFilterEmpty && values.some(isEmptyValue)) return;

          const key = serializeGroupKey(values);
          if (groupMap.has(key)) return;
          const row = {} as Row;
          dimensions.forEach((dimension, index) => {
            row[dimension.uid as FieldUID] = values[index];
          });
          groupMap.set(key, row);
        });
      });
    });
  }

  return Array.from(groupMap.entries()).map(([groupKey, groupRow]) => {
    const row = deepClone(groupRow);
    row[AGGREGATE_UUID_FIELD_UID] = buildAggregateRowUUID(aggregateTable, groupKey);
    metrics.forEach(metric => {
      const tokenValueMap = buildAggregateMetricTokenValueMap(metric, row, dimensions, runtimeMap);
      row[metric.uid as FieldUID] = evaluateAggregateMetricByConsumeContext({
        aggregateTable,
        metric,
        row,
        tokenValueMap,
      });
    });
    return row;
  });
};

const buildAggregateBucketInternal = (
  source: AggregateRuntimeSource,
  aggregateTable: AggregateTable,
  context: AggregateRuntimeContext,
  options: QueryOptions = {},
) => {
  const runtimeMap = buildSourceRuntimeMap(source, aggregateTable, context);
  const fields = buildAggregateRuntimeFields(aggregateTable, runtimeMap, getRendererAggregateFieldLabels());
  const rows = buildAggregateRows(aggregateTable, runtimeMap);
  const pagingResult = applyQueryOptionsToRows(aggregateTable.uid, rows, options);
  return {
    tableId: aggregateTable.uid,
    tableName: aggregateTable.name || aggregateTable.uid,
    fields,
    rows: pagingResult.rows,
    count: pagingResult.count,
  } as Bucket;
};

export const buildAggregateRuntimeTables = (
  source?: AggregateRuntimeSource | null,
  sources: AggregateRuntimeSource[] = source ? [source] : [],
) => {
  if (!source) return [] as Table[];
  return getAggregateTables(source).filter(aggregateTable => isAggregateTableAvailable(aggregateTable)).map(aggregateTable => {
    const runtimeMap = buildSourceRuntimeMap(source, aggregateTable, {
      sources: sources.length ? sources : [source],
      connectionData: {},
    });
    const fields = buildAggregateRuntimeFields(aggregateTable, runtimeMap, getRendererAggregateFieldLabels());
    return {
      uid: aggregateTable.uid as TableUID,
      alias: aggregateTable.name || aggregateTable.uid,
      meta: {
        extra: {
          isAggregateTable: true,
        },
      },
      fields,
    } as Table;
  });
};

export const buildBoardConnectionsWithAggregateTables = (
  connections: Connection[] = [],
  sources: AggregateRuntimeSource[] = [],
) => {
  if (!connections.length || !sources.length) return connections;
  const sourceMap = new Map<string, AggregateRuntimeSource>(sources.map(source => [source.uid, source]));

  return connections.map(connection => {
    const source = sourceMap.get(connection.uid);
    if (!source) return connection;
    const aggregateTables = buildAggregateRuntimeTables(source, sources);
    if (!aggregateTables.length) return connection;

    const tableMap = new Map<string, Table>();
    (connection.tables || []).forEach(table => tableMap.set(table.uid, table));
    aggregateTables.forEach(table => tableMap.set(table.uid, table));

    return {
      ...connection,
      tables: Array.from(tableMap.values()),
    } as Connection;
  });
};

export const buildAggregateBucketByOptions = (
  optionTableUID?: OptionTableUID,
  options: QueryOptions = {},
  context?: AggregateRuntimeContext | null,
) => {
  const [connectionUID, tableUID] = optionTableUID || [];
  if (!connectionUID || !tableUID || !context?.sources?.length) return undefined;
  const source = getRuntimeSourceByUID(context.sources, connectionUID);
  if (!source) return undefined;
  const aggregateTable = getAggregateTables(source).find(item => item.uid === tableUID);
  if (!aggregateTable) return undefined;
  return buildAggregateBucketInternal(source, aggregateTable, context, options);
};

export const mergeConnectionBucketsWithAggregate = (
  connectionUID: string,
  buckets: Bucket[] = [],
  context: AggregateRuntimeContext,
) => {
  const source = getRuntimeSourceByUID(context.sources, connectionUID);
  if (!source) return buckets;
  const aggregateTables = getAggregateTables(source);
  if (!aggregateTables.length) return buckets;

  const baseBuckets = [...buckets];
  const connectionData: ConnectionData = {
    ...context.connectionData,
    [connectionUID]: baseBuckets,
  };

  const mergedBucketMap = new Map<string, Bucket>();
  baseBuckets.forEach(bucket => mergedBucketMap.set(bucket.tableId, bucket));
  aggregateTables.forEach(aggregateTable => {
    const aggregateBucket = buildAggregateBucketInternal(
      source,
      aggregateTable,
      {
        ...context,
        connectionData,
      },
      {},
    );
    mergedBucketMap.set(aggregateBucket.tableId, aggregateBucket);
  });
  return Array.from(mergedBucketMap.values());
};
