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
  matchMetricVariableFilterRule,
  resolveReferenceValueFromRecord,
  type AggregateRuntimeFieldLabels,
  type AggregateSourceRuntime,
  type AggregateSourceRuntimeRecord,
} from "@common/utils/aggregateTableRuntimeShared";

dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

export type { AggregateRuntimeContext, AggregateRuntimeSource } from "@common/utils/aggregateTableShared";

type AggregateMetricConsumeContext = {
  aggregateTable: AggregateTable;
  metric: AggregateMetric;
  row: Row;
  tokenValueMap?: Map<string, number>;
};

type AggregateMetricAccumulator = {
  aggregateType: AggregateMetricVariable["aggregate"];
  sum: number;
  count: number;
  max: number | null;
  min: number | null;
  uniqueRows?: Set<Row>;
};

type AggregateGroupAccumulator = {
  groupKey: string;
  row: Row;
  metricAccumulators: Map<string, AggregateMetricAccumulator>;
};

const AGGREGATE_TOKEN_REGEX = /\[\[([a-zA-Z0-9.:_]+(?:\.[a-zA-Z0-9_]+)*),([^\]]+?)\]\]/gu;
const AGGREGATE_UUID_FIELD_UID = "_uuid" as FieldUID;

const buildAggregateRowUUID = (aggregateTable: AggregateTable, groupKey: string) => {
  return `aggregate:${aggregateTable.uid}:${groupKey}`;
};

const getCommonAggregateFieldLabels = (): AggregateRuntimeFieldLabels => ({
  dataId: i18next.t("aggregateTable.dataId"),
  getDimensionName: (index, name) => name || i18next.t("aggregateTable.dimensionFieldName", { index: index + 1 }),
  getMetricName: (index, name) => name || i18next.t("aggregateTable.metricFieldName", { index: index + 1 }),
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
      return `${weekYear}-${`${date.isoWeek()}`.padStart(2, "0")}${i18next.t("aggregateTable.weekSuffix", { defaultValue: "周" })}`;
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

const getMetricRuntimeVariables = (metric: AggregateMetric) => {
  if (metric.mode === "singleField") {
    return metric.singleFieldConfig ? [metric.singleFieldConfig] : [];
  }
  return metric.variables || [];
};

const createMetricAccumulator = (metricVariable: AggregateMetricVariable): AggregateMetricAccumulator => ({
  aggregateType: metricVariable.aggregate || "SUM",
  sum: 0,
  count: 0,
  max: null,
  min: null,
  uniqueRows: metricVariable.fieldUID && !metricVariable.subFieldUID ? new Set<Row>() : undefined,
});

const updateMetricAccumulator = (
  accumulator: AggregateMetricAccumulator,
  metricVariable: AggregateMetricVariable,
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
) => {
  if (metricVariable.fieldUID && !metricVariable.subFieldUID && metricVariable.fieldUID !== "_count") {
    if (accumulator.uniqueRows?.has(runtimeRecord.mainRow)) return;
    accumulator.uniqueRows?.add(runtimeRecord.mainRow);
  }

  const value = resolveReferenceValueFromRecord(metricVariable, runtimeRecord, sourceRuntime);
  if (
    metricVariable.fieldUID !== "_count"
    && metricVariable.subFieldUID !== "_count"
    && isEmptyValue(value)
  ) {
    return;
  }

  const numberValue = toSafeNumber(value);
  switch (accumulator.aggregateType) {
    case "COUNT":
      accumulator.count += 1;
      return;
    case "AVERAGE":
      accumulator.sum += numberValue;
      accumulator.count += 1;
      return;
    case "MAX":
      accumulator.max = accumulator.max === null ? numberValue : Math.max(accumulator.max, numberValue);
      return;
    case "MIN":
      accumulator.min = accumulator.min === null ? numberValue : Math.min(accumulator.min, numberValue);
      return;
    case "SUM":
    default:
      accumulator.sum += numberValue;
      return;
  }
};

const resolveMetricAccumulatorValue = (accumulator?: AggregateMetricAccumulator) => {
  if (!accumulator) return 0;
  switch (accumulator.aggregateType) {
    case "COUNT":
      return accumulator.count;
    case "AVERAGE":
      return accumulator.count ? (accumulator.sum / accumulator.count) : 0;
    case "MAX":
      return accumulator.max ?? 0;
    case "MIN":
      return accumulator.min ?? 0;
    case "SUM":
    default:
      return accumulator.sum;
  }
};

const getOrCreateGroupAccumulator = (
  groupMap: Map<string, AggregateGroupAccumulator>,
  aggregateTable: AggregateTable,
  dimensions: AggregateDimension[],
  groupKey: string,
  values: any[],
) => {
  const current = groupMap.get(groupKey);
  if (current) return current;

  const row = {} as Row;
  row[AGGREGATE_UUID_FIELD_UID] = buildAggregateRowUUID(aggregateTable, groupKey);
  dimensions.forEach((dimension, index) => {
    row[dimension.uid as FieldUID] = values[index];
  });

  const nextGroup: AggregateGroupAccumulator = {
    groupKey,
    row,
    metricAccumulators: new Map<string, AggregateMetricAccumulator>(),
  };
  groupMap.set(groupKey, nextGroup);
  return nextGroup;
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
  const groupMap = new Map<string, AggregateGroupAccumulator>();
  const metricVariablesBySourceUID = metrics.reduce<Map<string, AggregateMetricVariable[]>>((result, metric) => {
    getMetricRuntimeVariables(metric).forEach(variable => {
      if (!variable?.sourceUID) return;
      const current = result.get(variable.sourceUID) || [];
      current.push(variable);
      result.set(variable.sourceUID, current);
    });
    return result;
  }, new Map<string, AggregateMetricVariable[]>());

  if (!dimensions.length) {
    const group = getOrCreateGroupAccumulator(groupMap, aggregateTable, dimensions, "__all__", []);
    runtimeMap.forEach(sourceRuntime => {
      const runtimeVariables = metricVariablesBySourceUID.get(sourceRuntime.sourceTable.uid) || [];
      sourceRuntime.records.forEach(record => {
        runtimeVariables.forEach(variable => {
          if (!matchMetricVariableFilterRule(variable.filterRule, record, sourceRuntime)) return;
          const accumulator = group.metricAccumulators.get(variable.uid) || createMetricAccumulator(variable);
          updateMetricAccumulator(accumulator, variable, record, sourceRuntime);
          group.metricAccumulators.set(variable.uid, accumulator);
        });
      });
    });
  } else {
    runtimeMap.forEach(sourceRuntime => {
      sourceRuntime.records.forEach(record => {
        const valueGroups = dimensions.map(dimension => resolveDimensionValuesFromRecord(dimension, record, sourceRuntime));
        if (valueGroups.every(group => group.every(value => value === undefined))) return;

        buildDimensionValueCombinations(valueGroups).forEach(values => {
          if (aggregateTable.dimensionFilterEmpty && values.some(isEmptyValue)) return;

          const key = serializeGroupKey(values);
          const group = getOrCreateGroupAccumulator(groupMap, aggregateTable, dimensions, key, values);
          const runtimeVariables = metricVariablesBySourceUID.get(sourceRuntime.sourceTable.uid) || [];
          runtimeVariables.forEach(variable => {
            if (!matchMetricVariableFilterRule(variable.filterRule, record, sourceRuntime)) return;
            const accumulator = group.metricAccumulators.get(variable.uid) || createMetricAccumulator(variable);
            updateMetricAccumulator(accumulator, variable, record, sourceRuntime);
            group.metricAccumulators.set(variable.uid, accumulator);
          });
        });
      });
    });
  }

  return Array.from(groupMap.values()).map(group => {
    const row = deepClone(group.row);
    metrics.forEach(metric => {
      const tokenValueMap = new Map<string, number>();
      getMetricRuntimeVariables(metric).forEach(variable => {
        tokenValueMap.set(variable.uid, resolveMetricAccumulatorValue(group.metricAccumulators.get(variable.uid)));
      });
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
  const fields = buildAggregateRuntimeFields(aggregateTable, runtimeMap, getCommonAggregateFieldLabels());
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
  return getAggregateTables(source).map(aggregateTable => {
    const runtimeMap = buildSourceRuntimeMap(source, aggregateTable, {
      sources: sources.length ? sources : [source],
      connectionData: {},
    });
    const fields = buildAggregateRuntimeFields(aggregateTable, runtimeMap, getCommonAggregateFieldLabels());
    return {
      uid: aggregateTable.uid as TableUID,
      alias: aggregateTable.name || aggregateTable.uid,
      meta: {},
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
