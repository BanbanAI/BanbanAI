import { Field, Row, TableUID } from "@common/types/project";
import type { Table } from "./table";
import { calculateAggregation } from "@renderer/utils/autoCompute";
import { createFormulaRuntimeByData, findIdByFormula, FormulaConfig, getFormulaStr } from "@common/utils/formula";
import { getNocodeDataSourceByUID, SystemField } from "@common/utils/connection";
import { replaceFormulaFieldValues } from "./formulaValue";
import type { ResolvedFormulaFieldValue } from "./formulaValue";

export { getSystemColumnConfigurations } from "@common/utils/connection";

const hasRuntimeValue = (value: unknown) => value !== undefined && value !== null;
const shouldPreferDynamicFieldValue = (field?: Field) => {
  const extra = field?.meta?.extra;
  return extra?.widgetType === "widget.form.autoCompute"
    || (
      extra?.defaultValueType === "formula"
      && extra?.defaultComputeType === "quickCompute"
      && Array.isArray(extra?.otherTableFieldUID)
      && extra.otherTableFieldUID.length >= 3
    );
};
const shouldResolveDynamicFieldValue = (field?: Field) => {
  const extra = field?.meta?.extra;
  return shouldPreferDynamicFieldValue(field) || !!(extra?.defaultValueType === "formula" && extra?.formula);
};

const getDefaultQuickComputeNocodeId = (widget: Table, otherTableFieldUID?: string[]) => {
  const connectionUID = otherTableFieldUID?.[0];
  if (!connectionUID) {
    return widget.nocodeId;
  }

  const dataSource = getNocodeDataSourceByUID(widget.nocodeBody, connectionUID, {
    nocodeId: widget.nocodeId,
    includeSchemaSources: true,
  });
  return dataSource?.nocodeId || widget.nocodeId;
};

type DynamicFieldContext = {
  widget: Table;
  row: Row;
  tableUID: TableUID;
  currentTable: ReturnType<Table["getTable"]>;
  cache: Map<string, any>;
  resolving: Set<string>;
};

const buildFieldResolver = ({
  widget,
  row,
  tableUID,
  currentTable,
  cache,
  resolving,
}: DynamicFieldContext) => {
  const formData = widget.formData;
  const mainTableUID = widget.formTableUID;
  const isMainTableColumn = tableUID === mainTableUID;
  const currentRelationKey = !isMainTableColumn
    ? currentTable?.fields?.find((item) => item.meta?.name === SystemField.KEY)?.uid
    : undefined;
  const parentRowUUID = currentRelationKey ? row?.[currentRelationKey] : undefined;
  const parentRow = !isMainTableColumn && parentRowUUID ? widget.getRow(parentRowUUID) : undefined;

  const getFieldIds = (keys: string[]) => {
    const [rawSourceTableUID, widgetId, subWidgetId] = keys;
    const sourceTableUID = rawSourceTableUID as TableUID;
    const sourceTable = widget.getTable(sourceTableUID) || currentTable;
    let fieldId: string | undefined;
    let field: Field | undefined;

    if (widgetId.startsWith("f_")) {
      fieldId = widgetId;
      field = sourceTable?.fields?.find((item) => item.uid === fieldId);
    } else {
      field = sourceTable?.fields?.find((item) => item.meta?.uid === widgetId);
      fieldId = field?.uid;
    }

    const subTableUID = field?.meta?.extra?.subTableUID?.at(-1);
    const subTable = subTableUID ? formData.tables.find((item) => item.uid === subTableUID) : undefined;
    let subFieldId: string | undefined;
    if (subWidgetId && subWidgetId.startsWith("f_")) {
      subFieldId = subWidgetId;
    } else if (subWidgetId) {
      subFieldId = subTable?.fields?.find((item) => item.meta?.uid === subWidgetId)?.uid;
    }
    const valueField = subFieldId
      ? subTable?.fields?.find((item) => item.uid === subFieldId)
      : field;

    return { sourceTableUID, fieldId, subFieldId, field, valueField };
  };

  const getDirectFieldValue = (
    sourceTableUID?: TableUID,
    fieldId?: string,
    subFieldId?: string,
    listMode = false,
  ) => {
    if (!fieldId) {
      return listMode ? [] : undefined;
    }

    let fieldValue = row?.[fieldId];
    if (!hasRuntimeValue(fieldValue) && !isMainTableColumn && sourceTableUID === mainTableUID) {
      fieldValue = parentRow?.[fieldId];
    }
    if (typeof fieldValue === "number" && Number.isNaN(fieldValue)) {
      fieldValue = 0;
    }

    if (subFieldId) {
      if (isMainTableColumn && sourceTableUID === mainTableUID) {
        const subTableData = widget.subTableData?.[fieldId];
        if (subTableData?.rows) {
          const mainRowUUID = row?.[widget.rowKey];
          const subTableInfo = widget.subTableFieldUIDs?.find((info) => info.fieldUID === fieldId);
          if (subTableInfo && mainRowUUID) {
            const relatedRows = subTableData.rows.filter((item) => item[subTableInfo.relationKey] === mainRowUUID);
            const values = relatedRows.map((item) => item[subFieldId]);
            return listMode ? values : values;
          }
        }
        return listMode ? [] : [];
      }

      if (row && typeof row === "object" && subFieldId in row) {
        return listMode ? [row[subFieldId]] : row[subFieldId];
      }

      const values = Array.isArray(fieldValue) ? fieldValue.map((item) => item?.[subFieldId]) : [];
      return listMode ? values : values;
    }

    return listMode ? [fieldValue] : fieldValue;
  };

  const resolveFieldRuntimeValue = async (
    field: Field | undefined,
    runtimeRow: Row,
    runtimeTableUID: TableUID,
  ) => {
    if (!field) return undefined;

    const extra = field.meta?.extra ?? {};
    const runtimeFields = widget.getTable(runtimeTableUID)?.fields || currentTable?.fields || [];

    if (extra.widgetType === "widget.form.autoCompute") {
      if (extra.computeType === "formula" && extra.formula) {
        return await executeFormulaCalculation(extra.formula, widget, runtimeRow, runtimeTableUID, cache, resolving);
      }
      if (extra.computeType === "quickCompute" && extra.otherTableFieldUID?.length) {
        return await calculateAggregation({
          otherTableFieldUID: extra.otherTableFieldUID,
          dataFilter: extra.dataFilter,
          nocodeId: widget.nocodeId,
          aggregateType: extra.aggregateType,
          decimal: extra.decimalPlaces,
          row: runtimeRow,
          fields: runtimeFields,
        });
      }
      return undefined;
    }

    if (
      extra.defaultValueType === "formula"
      && extra.defaultComputeType === "quickCompute"
      && extra.otherTableFieldUID?.length
    ) {
      return await calculateAggregation({
        otherTableFieldUID: extra.otherTableFieldUID,
        dataFilter: extra.dataFilter,
        nocodeId: getDefaultQuickComputeNocodeId(widget, extra.otherTableFieldUID),
        aggregateType: extra.aggregateType,
        decimal: extra.decimalPlaces,
        row: runtimeRow,
        fields: runtimeFields,
      });
    }

    if (extra.defaultValueType === "formula" && extra.formula) {
      return await executeFormulaCalculation(extra.formula, widget, runtimeRow, runtimeTableUID, cache, resolving);
    }

    return undefined;
  };

  const resolveSubFieldRuntimeValues = async (
    sourceTableUID?: TableUID,
    field?: Field,
    fieldId?: string,
    subFieldId?: string,
  ) => {
    if (!field || !fieldId || !subFieldId) return undefined;

    const subTableUID = field.meta?.extra?.subTableUID?.at(-1) as TableUID | undefined;
    if (!subTableUID) return undefined;

    const subTable = widget.getTable(subTableUID);
    const subField = subTable?.fields?.find((item) => item.uid === subFieldId);
    if (!shouldResolveDynamicFieldValue(subField)) {
      return undefined;
    }

    let subRows: Row[] = [];
    if (isMainTableColumn && sourceTableUID === mainTableUID) {
      const subTableData = widget.subTableData?.[fieldId];
      const subTableInfo = widget.subTableFieldUIDs?.find((info) => info.fieldUID === fieldId);
      const mainRowUUID = row?.[widget.rowKey];
      if (subTableData?.rows && subTableInfo && mainRowUUID) {
        subRows = subTableData.rows.filter((item) => item[subTableInfo.relationKey] === mainRowUUID) as Row[];
      }
    } else {
      let fieldValue = row?.[fieldId];
      if (!hasRuntimeValue(fieldValue) && !isMainTableColumn && sourceTableUID === mainTableUID) {
        fieldValue = parentRow?.[fieldId];
      }
      subRows = Array.isArray(fieldValue) ? fieldValue : [];
    }

    if (!subRows.length) {
      return [];
    }

    return await Promise.all(
      subRows.map(async (subRow) => {
        const runtimeValue = await resolveFieldRuntimeValue(subField, subRow, subTableUID);
        if (hasRuntimeValue(runtimeValue)) {
          return runtimeValue;
        }
        return subRow?.[subFieldId];
      })
    );
  };

  const resolveDynamicFieldValue = async (field?: Field, fieldId?: string, sourceTableUID?: TableUID) => {
    if (!field || !fieldId) return undefined;

    const runtimeSourceTableUID = sourceTableUID || tableUID;
    const runtimeRow = !isMainTableColumn && runtimeSourceTableUID === mainTableUID && parentRow ? parentRow : row;
    const runtimeTableUID = runtimeSourceTableUID;
    const runtimeTable = widget.getTable(runtimeTableUID) || currentTable;
    const runtimeRowId = runtimeTableUID === mainTableUID
      ? runtimeRow?.[widget.rowKey]
      : runtimeRow?.[
        runtimeTable?.fields?.find((item) =>
          item.meta?.name === SystemField.UUID || item.meta?.name === SystemField.KEY
        )?.uid
      ];
    const cacheKey = `${runtimeSourceTableUID}.${fieldId}.${runtimeRowId || "root"}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    if (resolving.has(cacheKey)) {
      return undefined;
    }

    resolving.add(cacheKey);
    try {
      const extra = field.meta?.extra ?? {};
      let value: any;

      if (extra.widgetType === "widget.form.autoCompute" && extra.computeType === "formula" && extra.formula) {
        value = await executeFormulaCalculation(extra.formula, widget, runtimeRow, runtimeTableUID, cache, resolving);
      } else if (extra.widgetType === "widget.form.autoCompute" && extra.computeType === "quickCompute" && extra.otherTableFieldUID?.length) {
        value = await calculateAggregation({
          otherTableFieldUID: extra.otherTableFieldUID,
          dataFilter: extra.dataFilter,
          nocodeId: widget.nocodeId,
          aggregateType: extra.aggregateType,
          decimal: extra.decimalPlaces,
          row: runtimeRow,
          fields: widget.getTable(runtimeTableUID)?.fields || currentTable?.fields || [],
        });
      } else if (extra.defaultValueType === "formula" && extra.defaultComputeType === "quickCompute" && extra.otherTableFieldUID?.length) {
        value = await calculateAggregation({
          otherTableFieldUID: extra.otherTableFieldUID,
          dataFilter: extra.dataFilter,
          nocodeId: getDefaultQuickComputeNocodeId(widget, extra.otherTableFieldUID),
          aggregateType: extra.aggregateType,
          decimal: extra.decimalPlaces,
          row: runtimeRow,
          fields: widget.getTable(runtimeTableUID)?.fields || currentTable?.fields || [],
        });
      } else if (extra.defaultValueType === "formula" && extra.formula) {
        value = await executeFormulaCalculation(extra.formula, widget, runtimeRow, runtimeTableUID, cache, resolving);
      }

      cache.set(cacheKey, value);
      return value;
    } finally {
      resolving.delete(cacheKey);
    }
  };

  return {
    getFormulaField(keys: string[]) {
      return getFieldIds(keys).valueField;
    },
    async getFormulaValue(keys: string[], listMode = false) {
      const { sourceTableUID, fieldId, subFieldId, field } = getFieldIds(keys);
      const directValue = getDirectFieldValue(sourceTableUID, fieldId, subFieldId, listMode);

      if (subFieldId) {
        const runtimeValues = await resolveSubFieldRuntimeValues(sourceTableUID, field, fieldId, subFieldId);
        if (Array.isArray(runtimeValues) && runtimeValues.some(hasRuntimeValue)) {
          return runtimeValues;
        }
        return directValue;
      }

      if (shouldResolveDynamicFieldValue(field)) {
        const runtimeValue = await resolveDynamicFieldValue(field, fieldId, sourceTableUID);
        if (listMode) {
          if (hasRuntimeValue(runtimeValue)) {
            return [runtimeValue];
          }
          if (Array.isArray(directValue) && directValue.some(hasRuntimeValue)) {
            return directValue;
          }
          return [];
        }
        if (hasRuntimeValue(runtimeValue)) {
          return runtimeValue;
        }
        if (hasRuntimeValue(directValue)) {
          return directValue;
        }
      }

      if (listMode) {
        if (Array.isArray(directValue) && directValue.some(hasRuntimeValue)) {
          return directValue;
        }
      } else if (hasRuntimeValue(directValue)) {
        return directValue;
      }

      const runtimeValue = await resolveDynamicFieldValue(field, fieldId, sourceTableUID);
      if (listMode) {
        return hasRuntimeValue(runtimeValue) ? [runtimeValue] : [];
      }
      return runtimeValue;
    }
  };
};

export const executeFormulaCalculation = async (
  formula: string | FormulaConfig,
  widget: Table,
  row: Row,
  tableUID: TableUID,
  cache = new Map<string, any>(),
  resolving = new Set<string>(),
) => {
  const formulaStr = getFormulaStr(formula);
  let formulaValue = formulaStr;
  if (!formulaValue) return undefined;

  const currentTable = widget.getTable(tableUID) || widget.table;
  const resolver = buildFieldResolver({
    widget,
    row,
    tableUID,
    currentTable,
    cache,
    resolving,
  });
  const ids = [...new Set(findIdByFormula(formulaStr))];
  const valueMap = new Map<string, ResolvedFormulaFieldValue>();

  for (const id of ids) {
    const keys = id.split(".");
    valueMap.set(id, {
      field: resolver.getFormulaField(keys),
      column: await resolver.getFormulaValue(keys, true),
      scalar: await resolver.getFormulaValue(keys, false),
      isCollection: keys.length > 2,
    });
  }

  formulaValue = replaceFormulaFieldValues(formulaValue, valueMap);

  try {
    const formulaRuntime = createFormulaRuntimeByData(row, currentTable?.fields);
    return formulaRuntime.evaluate(formulaValue);
  } catch (err) {
    console.log(`auto compute formula error:`, err);
    return undefined;
  }
}
