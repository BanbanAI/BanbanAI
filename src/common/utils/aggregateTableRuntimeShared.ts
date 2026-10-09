import {
  AggregateDimension,
  AggregateDimensionItem,
  AggregateMetric,
  AggregateSourceTable,
  AggregateTable,
  FilterRule,
  LogicalOperator,
} from "@common/types/nocode";
import {
  Field,
  FieldMeta,
  FieldType,
  FieldUID,
  Row,
  Table,
  TableUID,
} from "@common/types/project";
import { SystemField } from "@common/utils/connection";
import {
  matchConditionByRuleFunc,
  type AggregateRuntimeContext,
  type AggregateRuntimeSource,
} from "@common/utils/aggregateTableShared";

const AGGREGATE_UUID_FIELD_UID = "_uuid" as FieldUID;

export type AggregateSourceRuntimeRecord = {
  mainRow: Row;
  subRow: Row | null;
};

export type AggregateSourceRuntime = {
  sourceUID: string;
  sourceTable: AggregateSourceTable;
  mainTable?: Table;
  subTable?: Table;
  relationFieldUID?: FieldUID;
  rows: Row[];
  records: AggregateSourceRuntimeRecord[];
};

export type AggregateRuntimeFieldLabels = {
  dataId: string;
  getDimensionName: (index: number, name?: string) => string;
  getMetricName: (index: number, name?: string) => string;
};

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const buildFieldMeta = (uid: string, name: string, extra: Record<string, any> = {}, subType?: string): FieldMeta => ({
  uid,
  name,
  subType,
  extra,
});

const createAggregateField = (
  uid: string,
  alias: string,
  type: FieldType,
  extra: Record<string, any> = {},
  subType?: string,
  metaName?: string,
): Field => {
  return {
    uid: uid as FieldUID,
    alias,
    type,
    meta: buildFieldMeta(uid, metaName || alias, extra, subType),
  };
};

export const getRuntimeSourceByUID = (sources: AggregateRuntimeSource[] = [], uid?: string) => {
  if (!uid) return undefined;
  return sources.find(item => item.uid === uid);
};

export const getSourceTableRuntime = (
  sourceRuntimeMap: Map<string, AggregateSourceRuntime>,
  sourceUID?: string,
) => {
  if (!sourceUID) return undefined;
  return sourceRuntimeMap.get(sourceUID);
};

const getAggregateSourceConnectionUID = (
  sourceTable?: AggregateSourceTable | null,
  ownerConnectionUID?: string,
) => {
  return sourceTable?.connectionUID || ownerConnectionUID || "";
};

export const getAggregateTables = (source?: AggregateRuntimeSource | null) => source?.aggregateTables || [];

const getMainTableByUID = (source?: AggregateRuntimeSource | null, tableUID?: TableUID | null) => {
  if (!source?.tables?.length || !tableUID) return undefined;
  return source.tables.find(table => table.uid === tableUID);
};

const getSubTableByUID = (source?: AggregateRuntimeSource | null, tableUID?: TableUID | null) => {
  if (!source?.tables?.length || !tableUID) return undefined;
  return source.tables.find(table => table.uid === tableUID);
};

const getSubTableRelationFieldUID = (mainTable?: Table | null, subTableUID?: TableUID | null) => {
  if (!mainTable?.fields?.length || !subTableUID) return undefined;
  return mainTable.fields.find(field => field.meta?.extra?.subTableUID?.[1] === subTableUID)?.uid;
};

const buildSourceRuntimeRecords = (
  rows: Row[] = [],
  relationFieldUID?: FieldUID,
) => {
  if (!relationFieldUID) {
    return rows.map(row => ({ mainRow: row, subRow: null }));
  }

  const records: AggregateSourceRuntimeRecord[] = [];
  rows.forEach(row => {
    const subRows = toArray(row?.[relationFieldUID]);
    if (!subRows.length) {
      records.push({ mainRow: row, subRow: null });
      return;
    }
    subRows.forEach(subRow => {
      records.push({
        mainRow: row,
        subRow: subRow as Row,
      });
    });
  });
  return records;
};

export const resolveReferenceValueFromRecord = (
  reference: Pick<AggregateDimensionItem, "fieldUID" | "subFieldUID">,
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
) => {
  if (reference.fieldUID === "_count") {
    return 1;
  }

  if (reference.subFieldUID) {
    if (reference.subFieldUID === "_count") {
      if (!sourceRuntime.relationFieldUID) return 0;
      return toArray(runtimeRecord.mainRow?.[sourceRuntime.relationFieldUID]).length;
    }

    if (sourceRuntime.relationFieldUID && runtimeRecord.subRow) {
      return runtimeRecord.subRow[reference.subFieldUID];
    }

    if (sourceRuntime.relationFieldUID) {
      const subRows = toArray(runtimeRecord.mainRow?.[sourceRuntime.relationFieldUID]);
      return subRows[0]?.[reference.subFieldUID];
    }

    return runtimeRecord.mainRow?.[reference.subFieldUID];
  }

  if (reference.fieldUID) {
    return runtimeRecord.mainRow?.[reference.fieldUID];
  }

  return undefined;
};

const getConditionValuesByUID = (
  uid: string,
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
) => {
  if (!uid) return [];
  const ids = uid.split(".");

  if (ids.length <= 1) {
    return [runtimeRecord.mainRow?.[uid]];
  }

  const [first, second] = ids;
  if (sourceRuntime.relationFieldUID && sourceRuntime.relationFieldUID === first && runtimeRecord.subRow) {
    if (second === "_count") return [1];
    return [runtimeRecord.subRow?.[second]];
  }

  if (second === "_count") {
    return [toArray(runtimeRecord.mainRow?.[first]).length];
  }

  const parentValue = runtimeRecord.mainRow?.[first];
  if (Array.isArray(parentValue)) {
    return parentValue.map(item => item?.[second]);
  }
  if (parentValue && typeof parentValue === "object") {
    return [parentValue?.[second]];
  }
  return [runtimeRecord.mainRow?.[second]];
};

export const matchMetricVariableFilterRule = (
  filterRule: FilterRule | null | undefined,
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
) => {
  if (!filterRule?.conditions?.length) return true;
  const logic = filterRule.logic || LogicalOperator.AND;
  const matchedList = filterRule.conditions.map(condition => {
    const values = getConditionValuesByUID(condition.uid, runtimeRecord, sourceRuntime);
    return matchConditionByRuleFunc(values, condition.func, condition.value);
  });
  return logic === LogicalOperator.OR
    ? matchedList.some(Boolean)
    : matchedList.every(Boolean);
};

const matchSourceTableFilterRule = (
  filterRule: FilterRule | null | undefined,
  runtimeRecord: AggregateSourceRuntimeRecord,
  sourceRuntime: AggregateSourceRuntime,
) => matchMetricVariableFilterRule(filterRule, runtimeRecord, sourceRuntime);

export const buildSourceRuntimeMap = (
  ownerSource: AggregateRuntimeSource,
  aggregateTable: AggregateTable,
  context: AggregateRuntimeContext,
) => {
  return new Map<string, AggregateSourceRuntime>(
    (aggregateTable.sourceTables || []).map(sourceTable => {
      const sourceUID = getAggregateSourceConnectionUID(sourceTable, ownerSource.uid);
      const source = getRuntimeSourceByUID(context.sources, sourceUID);
      const sourceBuckets = context.connectionData[sourceUID] || [];
      const mainTable = getMainTableByUID(source, sourceTable.tableUID);
      const subTable = getSubTableByUID(source, sourceTable.subTableUID);
      const relationFieldUID = getSubTableRelationFieldUID(mainTable, sourceTable.subTableUID);
      const rows = sourceBuckets.find(bucket => bucket.tableId === sourceTable.tableUID)?.rows || [];
      const sourceRuntime: AggregateSourceRuntime = {
        sourceUID,
        sourceTable,
        mainTable,
        subTable,
        relationFieldUID,
        rows,
        records: [],
      };
      sourceRuntime.records = buildSourceRuntimeRecords(rows, relationFieldUID)
        .filter(record => matchSourceTableFilterRule(sourceTable.filterRule, record, sourceRuntime));
      return [sourceTable.uid, sourceRuntime];
    }),
  );
};

const resolveDimensionFieldType = (
  dimension: AggregateDimension,
  runtimeMap: Map<string, AggregateSourceRuntime>,
) => {
  const item = (dimension.items || []).find(current => current.fieldUID || current.subFieldUID);
  if (!item) return "string" as FieldType;
  if (item.fieldUID === "_count" || item.subFieldUID === "_count") return "number" as FieldType;
  const sourceRuntime = getSourceTableRuntime(runtimeMap, item.sourceUID);
  if (!sourceRuntime) return "string" as FieldType;
  if (item.subFieldUID) {
    return sourceRuntime.subTable?.fields.find(field => field.uid === item.subFieldUID)?.type || "string";
  }
  if (item.fieldUID) {
    return sourceRuntime.mainTable?.fields.find(field => field.uid === item.fieldUID)?.type || "string";
  }
  return "string" as FieldType;
};

const resolveDimensionSourceField = (
  dimension: AggregateDimension,
  runtimeMap: Map<string, AggregateSourceRuntime>,
) => {
  const item = (dimension.items || []).find(current => current.fieldUID || current.subFieldUID);
  if (!item || item.fieldUID === "_count" || item.subFieldUID === "_count") return undefined;
  const sourceRuntime = getSourceTableRuntime(runtimeMap, item.sourceUID);
  if (!sourceRuntime) return undefined;
  if (item.subFieldUID) {
    return sourceRuntime.subTable?.fields.find(field => field.uid === item.subFieldUID);
  }
  if (item.fieldUID) {
    return sourceRuntime.mainTable?.fields.find(field => field.uid === item.fieldUID);
  }
  return undefined;
};

const resolveDimensionFieldSubType = (
  dimension: AggregateDimension,
  runtimeMap: Map<string, AggregateSourceRuntime>,
) => {
  return resolveDimensionSourceField(dimension, runtimeMap)?.meta?.subType;
};

const buildDimensionFieldExtra = (
  type: FieldType,
  sourceField?: Field,
) => {
  const sourceExtra = sourceField?.meta?.extra || {};
  if (sourceField?.meta?.subType === "date") {
    return {
      ...sourceExtra,
      widgetType: "widget.form.datePicker",
    };
  }
  if (sourceField?.meta?.subType === "daterange") {
    return {
      ...sourceExtra,
      widgetType: "widget.form.dateRangePicker",
    };
  }
  if (type === "number") {
    return {
      widgetType: "widget.form.numberInput",
    };
  }
  return {
    widgetType: "widget.form.textInput",
  };
};

const isAmountMetricAggregate = (aggregate?: AggregateMetric["singleFieldConfig"]["aggregate"]) => {
  return ["SUM", "AVERAGE", "MAX", "MIN"].includes(aggregate || "");
};

const resolveMetricAmountSourceField = (
  metric: AggregateMetric,
  runtimeMap: Map<string, AggregateSourceRuntime>,
) => {
  if (metric.mode !== "singleField") return undefined;
  const variable = metric.singleFieldConfig;
  if (!variable || !isAmountMetricAggregate(variable.aggregate)) return undefined;
  if (!variable.fieldUID || variable.fieldUID === "_count") return undefined;

  const sourceRuntime = getSourceTableRuntime(runtimeMap, variable.sourceUID);
  const sourceField = variable.subFieldUID
    ? sourceRuntime?.subTable?.fields.find(field => field.uid === variable.subFieldUID)
    : sourceRuntime?.mainTable?.fields.find(field => field.uid === variable.fieldUID);
  return sourceField?.meta?.subType === "amount" ? sourceField : undefined;
};

export const buildAggregateRuntimeFields = (
  aggregateTable: AggregateTable,
  runtimeMap: Map<string, AggregateSourceRuntime>,
  labels: AggregateRuntimeFieldLabels,
) => {
  const uuidField = createAggregateField(
    AGGREGATE_UUID_FIELD_UID,
    labels.dataId,
    "string",
    { widgetType: "widget.form.textInput" },
    undefined,
    SystemField.UUID,
  );
  const dimensionFields = (aggregateTable.dimensions || []).map((dimension, index) => {
    const alias = labels.getDimensionName(index, dimension.name);
    const type = resolveDimensionFieldType(dimension, runtimeMap);
    const sourceField = resolveDimensionSourceField(dimension, runtimeMap);
    const subType = resolveDimensionFieldSubType(dimension, runtimeMap);
    return createAggregateField(
      dimension.uid,
      alias,
      type,
      buildDimensionFieldExtra(type, sourceField),
      subType,
    );
  });

  const metricFields = (aggregateTable.metrics || []).map((metric, index) => {
    const alias = labels.getMetricName(index, metric.name);
    const format = metric.format || {};
    const amountSourceField = resolveMetricAmountSourceField(metric, runtimeMap);
    return createAggregateField(
      metric.uid,
      alias,
      "number",
      {
        widgetType: amountSourceField ? "widget.form.amountInput" : "widget.form.numberInput",
        isAggregateMetric: true,
        isPercent: format.isPercent ?? false,
        completeZero: format.completeZero ?? false,
        decimalPlaces: format.decimalPlaces ?? 0,
        thousandSeparator: format.thousandSeparator || "",
        decimalSeparator: format.decimalSeparator || ".",
      },
      amountSourceField ? "amount" : "number",
    );
  });

  return [uuidField, ...dimensionFields, ...metricFields];
};
