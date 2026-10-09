import { DataPermissionDataStatus, DataPermissionOther, DateDynamicRuleType, FilterRule, FormCondition, FormConditionValueType, FormElementConfiguration, LogicalOperator, NocodeBody, NocodeFormData, OtherDataSource, PermissionCategory, PermissionRangeType, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { Connection, ConnectionUID, Field, FieldUID, FormOption, OptionTableUID, ProcessNodeType, Row, Table, TableUID, WhereCondition } from "@common/types/project";
import { deepClone, isEmpty } from "@common/utils/object";
import dayjs from "dayjs";
import { evaluateFormulaWithRuntime, type FormulaRuntime } from "./formula";
import { escapeRegExp } from "./other";
import i18next from "i18next";
import { FormDataStage, SystemField } from "@common/types/system-field";
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import advancedFormat from 'dayjs/plugin/advancedFormat'

export { FormDataStage, SystemField } from "@common/types/system-field";

dayjs.extend(quarterOfYear);
dayjs.extend(advancedFormat);

export const isNocodeFormData = (data: any): data is NocodeFormData => {
  return Boolean(data && 'formOptions' in data);
}

export type NocodeDataSourceConnection = NocodeFormData & Pick<OtherDataSource, "uid" | "name" | "nocodeId">;

type NocodeDataSourceOptions = {
  nocodeId?: string,
  name?: string,
  includeSchemaSources?: boolean,
}

export type NocodeMainTableOption = {
  value: TableUID,
  label: string,
  table: Table,
  nocodeId?: string,
  sourceName?: string,
  isCrossApp: boolean,
}

const createCurrentNocodeDataSource = (
  formData?: NocodeFormData,
  options: NocodeDataSourceOptions = {},
): NocodeDataSourceConnection | undefined => {
  if (!formData) return undefined;

  return {
    ...formData,
    nocodeId: options.nocodeId,
    name: options.name,
  };
}

const mergeNocodeDataSourceList = <T extends { uid?: string }>(prev: T[] = [], next: T[] = []) => {
  const uidSet = new Set(prev.map(item => item?.uid).filter(Boolean));
  const extraItems = next.filter(item => !item?.uid || !uidSet.has(item.uid));
  return [...prev, ...extraItems];
}

const mergeNocodeDataSourceConnection = (
  prev: NocodeDataSourceConnection,
  next: NocodeDataSourceConnection,
): NocodeDataSourceConnection => {
  return {
    ...next,
    ...prev,
    tables: mergeNocodeDataSourceList(prev.tables || [], next.tables || []),
    aggregateTables: mergeNocodeDataSourceList(prev.aggregateTables || [], next.aggregateTables || []),
    options: {
      ...(next.options || {}),
      ...(prev.options || {}),
      tables: mergeNocodeDataSourceList(prev.options?.tables || [], next.options?.tables || []),
    },
    formOptions: {
      ...(next.formOptions || {}),
      ...(prev.formOptions || {}),
    },
    metas: {
      ...(next.metas || {}),
      ...(prev.metas || {}),
    },
  };
}

export const isValidNocodeDataSourceTable = (
  table?: Pick<Table, "uid" | "fields" | "meta">,
  connection?: Pick<NocodeDataSourceConnection, "tables">,
) => {
  const primaryTableUID = table?.meta?.extra?.primaryTable?.[1];
  if (!primaryTableUID) return true;

  const primaryTable = connection?.tables?.find(item => item.uid === primaryTableUID);
  if (!primaryTable) return false;

  return primaryTable.fields?.some(field => field?.meta?.extra?.subTableUID?.[1] === table.uid);
}

export const getNocodeDataSourceConnections = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
  options: NocodeDataSourceOptions = {},
): NocodeDataSourceConnection[] => {
  const sources: NocodeDataSourceConnection[] = [];
  const appendSource = (source?: NocodeDataSourceConnection) => {
    if (!source?.uid) return;
    const index = sources.findIndex(item => item.uid === source.uid);
    if (index === -1) {
      sources.push(source);
      return;
    }
    sources[index] = mergeNocodeDataSourceConnection(sources[index], source);
  };
  const currentSource = createCurrentNocodeDataSource(body?.formData, options);

  if (currentSource) {
    appendSource(currentSource);
  }
  if (body?.otherDataSources?.length) {
    (body.otherDataSources as NocodeDataSourceConnection[]).forEach(appendSource);
  }
  if (options.includeSchemaSources && body?.otherDataSourceSchemas?.length) {
    (body.otherDataSourceSchemas as NocodeDataSourceConnection[]).forEach(appendSource);
  }

  return sources;
}

export const getNocodeMainTableOptions = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas" | "settings">,
  options: NocodeDataSourceOptions = {},
): NocodeMainTableOption[] => {
  const currentNocodeId = options.nocodeId;

  return getNocodeDataSourceConnections(body, {
    ...options,
    includeSchemaSources: true,
  }).flatMap(source => {
    return (source.tables || [])
      .filter(table => !table.meta?.extra?.primaryTable)
      .map(table => ({
        value: table.uid,
        label: source.nocodeId && source.nocodeId !== currentNocodeId
          ? `${source.name || source.uid} / ${table.alias || table.uid}`
          : (table.alias || table.uid),
        table,
        nocodeId: source.nocodeId,
        sourceName: source.name,
        isCrossApp: !!source.nocodeId && source.nocodeId !== currentNocodeId,
      }));
  });
}

export const getBoardConnectionsByNocodeBody = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources"> & { connections?: NocodeBody["connections"] },
  options: NocodeDataSourceOptions = {},
): Connection[] => {
  return [
    ...(body?.connections || []),
    ...(getNocodeDataSourceConnections(body, options) as unknown as Connection[]),
  ];
}

export const getNocodeDataSourceByUID = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
  uid?: ConnectionUID,
  options: NocodeDataSourceOptions = {},
): NocodeDataSourceConnection | undefined => {
  if (!uid) return undefined;
  return getNocodeDataSourceConnections(body, options).find(item => item.uid === uid);
}

export const populateNocodeDataSourceTableSubFields = <T extends Table>(
  table?: T,
  connection?: Pick<NocodeDataSourceConnection, "tables">,
) => {
  if (!table || !connection?.tables?.length) return table;

  const hasSubTable = table.fields?.some(field => field.meta?.extra?.subTableUID?.[1]);
  if (!hasSubTable) return table;

  const nextTable = deepClone(table);
  nextTable.fields?.forEach(field => {
    const subTableUID = field.meta?.extra?.subTableUID?.[1];
    if (!subTableUID) return;
    const subTable = connection.tables.find(item => item.uid === subTableUID);
    if (subTable) {
      field.subTableFields = subTable.fields;
    }
  });

  return nextTable as T;
}

export const getNocodeDataSourceTableByUID = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
  tableUID?: TableUID,
  options: NocodeDataSourceOptions = {},
  fillSubTableFields = false,
) => {
  if (!tableUID) return undefined;

  for (const connection of getNocodeDataSourceConnections(body, options)) {
    const table = connection.tables?.find(item => item.uid === tableUID);
    if (!table) continue;

    return {
      connection,
      table: fillSubTableFields
        ? populateNocodeDataSourceTableSubFields(table, connection)
        : table,
    };
  }

  return undefined;
}

export const getNocodeDataSourceTableContextByUID = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources">,
  tableUID?: TableUID,
  options: NocodeDataSourceOptions = {},
  fillSubTableFields = false,
) => {
  const tableSource = getNocodeDataSourceTableByUID(body, tableUID, options, fillSubTableFields);
  if (!tableSource?.connection || !tableSource?.table) {
    return undefined;
  }

  return {
    ...tableSource,
    sourceNocodeId: tableSource.connection.nocodeId || options.nocodeId,
    optionTableUID: [tableSource.connection.uid, tableSource.table.uid] as OptionTableUID,
  };
}

export const getNocodeDataSourceTableByOptionTableUID = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
  optionTableUID?: OptionTableUID,
  options: NocodeDataSourceOptions = {},
  fillSubTableFields = false,
) => {
  const [connectionUID, tableUID] = optionTableUID || [];
  if (!connectionUID || !tableUID) return undefined;

  const connection = getNocodeDataSourceByUID(body, connectionUID, options);
  if (!connection) return undefined;
  const table = connection.tables?.find(item => item.uid === tableUID);
  if (!table) return undefined;

  return {
    connection,
    table: fillSubTableFields
      ? populateNocodeDataSourceTableSubFields(table, connection)
      : table,
  };
}

export const buildFormulaTableUID = (
  connectionUID: ConnectionUID,
  tableUID: TableUID,
  currentConnectionUID?: ConnectionUID,
) => {
  if (!connectionUID || !tableUID) return tableUID;
  return currentConnectionUID && connectionUID === currentConnectionUID
    ? tableUID
    : `${connectionUID}:${tableUID}`;
}

export const parseFormulaTableUID = (
  rawTableUID?: string,
  currentConnectionUID?: ConnectionUID,
) => {
  if (!rawTableUID) {
    return {
      rawTableUID,
      connectionUID: currentConnectionUID,
      tableUID: undefined,
      isCrossApp: false,
    };
  }

  if (rawTableUID.includes(":")) {
    const [connectionUID, tableUID] = rawTableUID.split(":");
    return {
      rawTableUID,
      connectionUID: connectionUID as ConnectionUID,
      tableUID: tableUID as TableUID,
      isCrossApp: true,
    };
  }

  return {
    rawTableUID,
    connectionUID: currentConnectionUID,
    tableUID: rawTableUID as TableUID,
    isCrossApp: false,
  };
}

export const toFormulaOptionTableUID = (
  rawTableUID?: string,
  currentConnectionUID?: ConnectionUID,
): OptionTableUID | undefined => {
  const { connectionUID, tableUID } = parseFormulaTableUID(rawTableUID, currentConnectionUID);
  if (!connectionUID || !tableUID) return undefined;
  return [connectionUID, tableUID];
}

export const isReportConnection = (connection: Connection) => {
  return connection?.from === 'report';
}
export const isNocodeConnection = (connection: Connection) => {
  return connection?.from === 'nocode';
}

export const printOperator = 'printOperator'
export const printTime = 'printTime'

const systemFieldNamesMap = {
  get[SystemField.UUID](){return i18next.t('commonConnection.dataId')},
  get[SystemField.CREATE_TIME](){return i18next.t('commonConnection.createTime')},
  get[SystemField.UPDATE_TIME](){return i18next.t('commonConnection.updateTime')},
  get[SystemField.CREATE_OWNER](){return i18next.t('commonConnection.submitter')},
  get[SystemField.DATA_OWNER](){return i18next.t('commonConnection.dataOwner')},
  get[SystemField.UPDATE_OWNER](){return i18next.t('commonConnection.updater')},
  get[SystemField.STATUS](){return i18next.t('commonConnection.processStatus')},
  get[SystemField.CURRENT_NODE](){return i18next.t('commonConnection.currentNode')},
  get[SystemField.CURRENT_OWNER](){return i18next.t('commonConnection.currentPrincipal')},
  get[SystemField.KEY](){return i18next.t('commonConnection.relDataId')},
  get[SystemField.RELATED_SUB_FORM](){return i18next.t('commonConnection.relForm')},
  get[SystemField.DATA_TITLE](){return i18next.t('commonConnection.title')},
  get[SystemField.SORT](){return i18next.t('commonConnection.sort')},
  get[SystemField.DATA_STAGE](){return i18next.t('commonConnection.dataStage')},
}
export const isSystemField = (field?: Field | null) => {
  return Boolean(field?.meta?.name) && Object.keys(systemFieldNamesMap).includes(field.meta.name);
}
export const isInternalField = (field?: Field | null) => {
  return !!field?.meta?.extra?.internalField;
}
export const isBuiltinField = (field?: Field | null) => {
  return isSystemField(field) || isInternalField(field);
}
export const isBusinessField = (field?: Field | null) => {
  return !!field && !isBuiltinField(field);
}
export const isEntityField = (field?: Field | null) => {
  if (!field) return false;
  return (
    (isSystemField(field) &&
      [
        SystemField.CREATE_OWNER,
        SystemField.DATA_OWNER,
        SystemField.UPDATE_OWNER,
        SystemField.CURRENT_OWNER
      ].includes(field.meta.name as SystemField)
    )
    ||
    field.meta?.subType === 'account'
    ||
    field.meta?.subType === 'department'
  );
};
export const mappingSystemFieldAlias = (name: string): string => {
  if (!Object.keys(systemFieldNamesMap).includes(name)) return name;
  return systemFieldNamesMap[name] || name;
}

export const getSystemField = (fields: Field[], systemField: SystemField) => {
  return fields?.find(field => field.meta.name === systemField);
}
export const getUUIDSystemField = (fields: Field[]) => {
  return getSystemField(fields, SystemField.UUID);
}
export const getCreateOwnerSystemField = (fields: Field[]) => {
  return getSystemField(fields, SystemField.CREATE_OWNER);
}
export const getStatusSystemField = (fields: Field[]) => {
  return getSystemField(fields, SystemField.STATUS);
}
export const isDataOwnerEnabledTable = (table?: { meta?: { extra?: any }, extra?: any } | null) => {
  return !Boolean(table?.meta?.extra?.primaryTable || table?.extra?.primaryTable);
}
export const getFilterableSystemFields = (table?: { meta?: { extra?: any }, extra?: any } | null) => {
  return [
    SystemField.CREATE_TIME,
    SystemField.UPDATE_TIME,
    SystemField.CREATE_OWNER,
    ...(isDataOwnerEnabledTable(table) ? [SystemField.DATA_OWNER] : []),
  ];
}
export const getDataOwnerSystemField = (fields: Field[]) => {
  return fields.find(field => field.meta.name === SystemField.DATA_OWNER) || {
    uid: SystemField.DATA_OWNER,
    alias: mappingSystemFieldAlias(SystemField.DATA_OWNER),
    type: "string",
    meta: {
      name: SystemField.DATA_OWNER,
      uid: SystemField.DATA_OWNER,
      subType: "account",
      extra: {},
      isSystem: true,
    },
  } as unknown as Field;
}
export const getUpdateOwnerSystemField = (fields: Field[]) => {
  return fields.find(field => field.meta.name === SystemField.UPDATE_OWNER);
}

const replaceUid = (soul: any, uidMap) => {
  if (!soul) return soul;
  if (Array.isArray(soul)) {
    return soul.map(item => replaceUid(item, uidMap));
  } else if (soul instanceof Object) {
    for (const key in soul) {
      if (key === "uid") {
        if (soul["__opt_type"] === "field") {
          if (uidMap[soul.uid[1]] && uidMap[soul.uid[2]]) {
            soul.uid = [soul.uid[0], uidMap[soul.uid[1]], uidMap[soul.uid[2]]];
          }
        } else {
          soul.uid = uidMap[soul.uid] || soul.uid;
        }
      } else if (key === "widgets") {
        soul.widgets = soul.widgets.filter(w => w.type !== "widget.form.subform")?.map( item => replaceUid(item, uidMap))
      } else if (uidMap[key]) {
        soul[uidMap[key]] = soul[key];
        delete soul[key];
      } else {
        soul[key] = replaceUid(soul[key], uidMap);
      }
    }
    return soul;
  }
  return soul;
}
const createUidMap = (originTable: Table, table: Table) => {
  const uidMap = {};
  uidMap[originTable.uid] = table.uid;
  const originFields = originTable.fields.filter(f => f.meta.subType !== "subForm");
  for (let i = 0; i < originFields.length; i++) {
    const originField = originFields[i];
    const field = table.fields[i];
    uidMap[originField.uid] = field.uid;
    uidMap[originField.meta.uid] =  field.meta.uid;
  }
  return uidMap;
}

const getDatePrecisionUnit = (datePrecision?: FormCondition['datePrecision']) => {
  switch (datePrecision) {
    case 'year':
    case 'month':
    case 'day':
    case 'hour':
    case 'minute':
    case 'second':
      return datePrecision;
    default:
      return 'day';
  }
}

const getDateRange = (value: any, tFormat: string, datePrecision?: FormCondition['datePrecision']) => {
  if (!dayjs(value).isValid()) return null;
  const unit = getDatePrecisionUnit(datePrecision);
  const dateValue = dayjs(value);
  return {
    $gte: dateValue.startOf(unit).format(tFormat),
    $lte: dateValue.endOf(unit).format(tFormat),
  };
}

export const transformCondition = ({ uid, func, value, tFormat, datePrecision }: FormCondition): WhereCondition => {
  const fieldId = uid.split(".")?.at(-1);
  tFormat = tFormat || "YYYY-MM-DD HH:mm:ss";
  switch (func) {
    case RuleFunc.EQUAL: {
      return {
        [fieldId]: value
      }
    }
    case RuleFunc.NOT_EQUAL: {
      return {
        [fieldId]: {
          $ne: value
        }
      }
    }
    case RuleFunc.IN: {
      return {
        [fieldId]: {
          $in: value || []
        }
      }
    }
    case RuleFunc.NOT_IN: {
      return {
        [fieldId]: {
          $nin: value || []
        }
      }
    }
    case RuleFunc.CONTAIN:
    case RuleFunc.BELONG: {
      return {
        [fieldId]: {
          $regex: escapeRegExp(String(value ?? ""))
        }
      }
    }
    case RuleFunc.NOT_CONTAIN:
    case RuleFunc.NOT_BELONG: {
      return {
        $not: {
          [fieldId]: {
            $regex: escapeRegExp(String(value ?? ""))
          }
        }
      }
    }
    case RuleFunc.GT: {
      return {
        [fieldId]: {
          $gt: value
        }
      }
    }
    case RuleFunc.GTE: {
      return {
        [fieldId]: {
          $gte: value
        }
      }
    }
    case RuleFunc.LT: {
      return {
        [fieldId]: {
          $lt: value
        }
      }
    }
    case RuleFunc.LTE: {
      return {
        [fieldId]: {
          $lte: value
        }
      }
    }
    case RuleFunc.EMPTY: {
      return {
        $or: [
          {
            [fieldId]: {
              $in: ['', null, undefined],
            }
          },
          {
            [fieldId]: {
              $size: 0,
            }
          }
        ]
      }
    }
    case RuleFunc.NOT_EMPTY: {
      return {
        $and: [
          {
            [fieldId]: {
              $nin: ['', null, undefined],
            }
          },
          {
            $not: {
              [fieldId]: {
                $size: 0
              }
            }
          }
        ]
      }
    }
    case RuleFunc.CONTAIN_ANY: {
      return {
        [fieldId]: {
          $in: value || []
        }
      }
    }
    case RuleFunc.CONTAIN_ALL: {
      return {
        [fieldId]: {
          $all: value || []
        },
      }
    }
    case RuleFunc.BETWEEN: {
      const valueArr = value;
      if (isEmpty(valueArr)) return {};
      return {
        [fieldId]: {
          $gte: valueArr[0],
          $lte: valueArr[1]
        }
      };
    }
    case RuleFunc.TIME_EQUAL: {
      const dateRange = getDateRange(value, tFormat, datePrecision);
      if (!dateRange) return {};
      return {
        [fieldId]: dateRange
      };
    }
    case RuleFunc.TIME_NOT_EQUAL: {
      const dateRange = getDateRange(value, tFormat, datePrecision);
      if (!dateRange) return {};
      return {
        $not: {
          [fieldId]: dateRange
        }
      };
    }
    case RuleFunc.TIME_LTE: {
      const dateRange = getDateRange(value, tFormat, datePrecision);
      if (!dateRange) return {};
      return {
        [fieldId]: {
          $lte: dateRange.$lte,
        }
      };
    }
    case RuleFunc.TIME_BETWEEN: {
      const valueArr = value;
      if (!Array.isArray(valueArr) || isEmpty(valueArr) || valueArr?.some(item => !dayjs(item).isValid())) return {};
      const startDateRange = getDateRange(valueArr[0], tFormat, datePrecision);
      const endDateRange = getDateRange(valueArr[1], tFormat, datePrecision);
      if (!startDateRange || !endDateRange) return {};
      return {
        [fieldId]: {
          $gte: startDateRange.$gte,
          $lte: endDateRange.$lte,
        }
      };
    }
    case RuleFunc.DYNAMIC: {
      const tempValue = getDynamicValue(value);
      return {
        [fieldId]: tempValue
      };
    }
    case RuleFunc.TRUE: {
      return {
        [fieldId]: {
          $in: ['true', true]
        }
      }
    }
    case RuleFunc.FALSE: {
      return {
        [fieldId]: {
          $in: ['false', false]
        }
      }
    }
  }
}

export const getDynamicValue = (value: string) => {
  if (!value) return {};
  const valueObject = JSON.parse(value);
  const weekType = valueObject.weekStart ? valueObject.weekStart : 'isoWeek';
  
  switch (valueObject.type) {
    case DateDynamicRuleType.TODAY: {
      return {
        $gte: dayjs().startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.YESTERDAY: {
      return {
        $gte: dayjs().subtract(1, 'day').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().subtract(1, 'day').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.TOMORROW: {
      return {
        $gte: dayjs().add(1, 'day').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().add(1, 'day').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_7_DAYS: {
      return {
        $gte: dayjs().subtract(6, 'day').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_30_DAYS: {
      return {
        $gte: dayjs().subtract(29, 'day').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_90_DAYS: {
      return {
        $gte: dayjs().subtract(89, 'day').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.THIS_WEEK: {
      return {
        $gte: dayjs().startOf(weekType).startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf(weekType).endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_WEEK: {
      return {
        $gte: dayjs().subtract(1, 'week').startOf(weekType).startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().subtract(1, 'week').endOf(weekType).endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.NEXT_WEEK: {
      return {
        $gte: dayjs().add(1, 'week').startOf(weekType).startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().add(1, 'week').endOf(weekType).endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.THIS_MONTH: {
      return {
        $gte: dayjs().startOf('month').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('month').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_MONTH: {
      return {
        $gte: dayjs().subtract(1, 'month').startOf('month').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().subtract(1, 'month').endOf('month').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.NEXT_MONTH: {
      return {
        $gte: dayjs().add(1, 'month').startOf('month').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().add(1, 'month').endOf('month').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.THIS_QUARTER: {
      return {
        $gte: dayjs().startOf('quarter').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('quarter').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_QUARTER: {
      return {
        $gte: dayjs().subtract(1, 'quarter').startOf('quarter').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().subtract(1, 'quarter').endOf('quarter').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.NEXT_QUARTER: {
      return {
        $gte: dayjs().add(1, 'quarter').startOf('quarter').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().add(1, 'quarter').endOf('quarter').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.THIS_YEAR: {
      return {
        $gte: dayjs().startOf('year').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().endOf('year').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.LAST_YEAR: {
      return {
        $gte: dayjs().subtract(1, 'year').startOf('year').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().subtract(1, 'year').endOf('year').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.NEXT_YEAR: {
      return {
        $gte: dayjs().add(1, 'year').startOf('year').startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        $lte: dayjs().add(1, 'year').endOf('year').endOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
    }
    case DateDynamicRuleType.CUSTOM: {
      let startDay;
      let endDay;
      if (valueObject.value.first) {
        const firstUnit = valueObject.value.first[2] === 'week' ? weekType : valueObject.value.first[2];
        if (valueObject.value.first[0] === 'this') {
          startDay = dayjs().startOf(firstUnit);
        } else if (valueObject.value.first[0] === 'last') {
          startDay = dayjs().subtract(valueObject.value.first[1], valueObject.value.first[2]).startOf(firstUnit);
        } else if (valueObject.value.first[0] === 'next') {
          startDay = dayjs().add(valueObject.value.first[1], valueObject.value.first[2]).startOf(firstUnit);
        }
      }
      if (valueObject.value.last) {
        const lastUnit = valueObject.value.last[2] === 'week' ? weekType : valueObject.value.last[2];
        if (valueObject.value.last[0] === 'this') {
          endDay = dayjs().endOf(lastUnit);
        } else if (valueObject.value.last[0] === 'last') {
          endDay = dayjs().subtract(valueObject.value.last[1], valueObject.value.last[2]).endOf(lastUnit);
        } else if (valueObject.value.last[0] === 'next') {
          endDay = dayjs().add(valueObject.value.last[1], valueObject.value.last[2]).endOf(lastUnit);
        }
      }
      // 自定义是根据选值计算
      if (valueObject.value.first && !valueObject.value.last) {
        return {
          $gte: startDay.startOf('day').format("YYYY-MM-DD HH:mm:ss"),
        };
      } else if (!valueObject.value.first && valueObject.value.last) {
        return {
          $lte: endDay.endOf('day').format("YYYY-MM-DD HH:mm:ss"),
        };
      } else if (valueObject.value.first && valueObject.value.last) {
        return {
          $gte: startDay.startOf('day').format("YYYY-MM-DD HH:mm:ss"),
          $lte: endDay.endOf('day').format("YYYY-MM-DD HH:mm:ss")
        };
      } else {
        return {};
      }
    }
  }
}

export type TransformFilterRuleOptions = {
  formulaRuntime?: FormulaRuntime | null,
}

export const transformFilterRule = (
  filterRule: FilterRule,
  row: Row,
  options: TransformFilterRuleOptions = {},
): WhereCondition => {
  const logic = filterRule.logic || LogicalOperator.AND;
  const { formulaRuntime } = options;
  const rules = filterRule.conditions.map(({ type, fixedValue, value, formula, ...rest }) => {
    type = type || FormConditionValueType.FORM;
    if(type === FormConditionValueType.FORM) {
      const isSubTable = value?.split(".")?.length > 1;
      const tableUID = value?.split(".")?.[0];
      const subFieldId = value?.split(".")?.at(-1);
      if(!isSubTable) {
        value = row[value];
      } else {
        const isArray = [RuleFunc.IN, RuleFunc.NOT_IN].includes(rest.func)
        value = isArray ? row[tableUID].map(item => item[subFieldId]) : row[tableUID][0][subFieldId];
      }
    } else if (type === FormConditionValueType.FORMULA) {
      try {
        value = evaluateFormulaWithRuntime(formula ?? value, formulaRuntime);
      } catch (err) {
      }
    } else {
      value = (fixedValue ?? value)
    }
    return transformCondition({ ...rest, value });
  });
  return rules.length === 1 ? rules[0] : {
    [logic === LogicalOperator.AND ? '$and' : '$or']: rules
  }
}
export const transformBucketRows = (fields: Field[], rows: Row[]) => {
  return rows.map(row => {
    return Object.entries(row).reduce((prev, [uid, value]) => {
      const field = fields.find(f => ((f.meta.uid === uid) || (f.meta.name === uid)));
      if (field) {
        prev[field.uid] = value;
      }
      return prev;
    }, {});
  })
}

export function getDefaultDataPermissionOther(): DataPermissionOther[] {
  return [
    {
      get title(){return i18next.t('commonConnection.allMemberViewAllUnfinishedData')},
      get description(){return i18next.t('commonConnection.defaultPerm')},
      memberRange: {
        rangeType: PermissionRangeType.ALL,
        range: {
          departments: [],
          roles: [],
          users: []
        }
      },
      dataRange: {
        all: true,
        anonymous: false,
        currentDepartment: false,
        customDepartment: { enabled: false, departments: [] },
        self: false,
        siblingDepartment: false,
        subDepartment: false,
        fromFormField: { enabled: false, field: [] },
      },
      dataStatus: {
        processing: true,
        finished: false,
        noProcess: false,
      },
      handleRange: {
        [PermissionCategory.GET]: true,
        [PermissionCategory.UPDATE]: false,
        [PermissionCategory.DELETE]: false,
      }
    },
    {
      get title(){return i18next.t('commonConnection.allMemberViewAllFinishedData')},
      get description(){return i18next.t('commonConnection.defaultPerm')},
      memberRange: {
        rangeType: PermissionRangeType.ALL,
        range: {
          departments: [],
          roles: [],
          users: []
        }
      },
      dataRange: {
        all: true,
        anonymous: false,
        currentDepartment: false,
        customDepartment: { enabled: false, departments: [] },
        self: false,
        siblingDepartment: false,
        subDepartment: false,
        fromFormField: { enabled: false, field: [] },
      },
      dataStatus: {
        processing: false,
        finished: true,
        noProcess: false,
      },
      handleRange: {
        [PermissionCategory.GET]: true,
        [PermissionCategory.UPDATE]: false,
        [PermissionCategory.DELETE]: false,
      }
    },
    {
      get title(){return i18next.t('commonConnection.allMemberManageAllNoProcessData')},
      get description(){return i18next.t('commonConnection.defaultPerm')},
      memberRange: {
        rangeType: PermissionRangeType.ALL,
        range: {
          departments: [],
          roles: [],
          users: []
        }
      },
      dataRange: {
        all: true,
        anonymous: false,
        currentDepartment: false,
        customDepartment: { enabled: false, departments: [] },
        self: false,
        siblingDepartment: false,
        subDepartment: false,
        fromFormField: { enabled: false, field: [] },
      },
      dataStatus: {
        processing: false,
        finished: false,
        noProcess: true,
      },
      handleRange: {
        [PermissionCategory.GET]: true,
        [PermissionCategory.UPDATE]: true,
        [PermissionCategory.DELETE]: true,
      }
    }
  ]
}

export function normalizeDataPermissionStatus(
  dataStatus?: Partial<DataPermissionDataStatus> | null,
): DataPermissionDataStatus {
  const processing = !!dataStatus?.processing;
  const finished = dataStatus?.finished !== undefined ? !!dataStatus.finished : true;
  return {
    processing,
    finished,
    noProcess: dataStatus?.noProcess !== undefined ? !!dataStatus.noProcess : false,
  };
}

function hasExplicitNoProcessStatus(
  dataStatus?: Partial<DataPermissionDataStatus> | null,
) {
  return !!dataStatus && Object.prototype.hasOwnProperty.call(dataStatus, 'noProcess');
}

function getLegacyNoProcessPermissionTitle(permission: DataPermissionOther) {
  const title = String(permission?.title || '').trim();
  const finishedLabel = i18next.t('formPermissionUtils.processFinished');
  const noProcessLabel = i18next.t('formPermissionUtils.noProcessData');
  const viewFinishedTitle = i18next.t('commonConnection.allMemberViewAllFinishedData');
  const viewNoProcessTitle = i18next.t('commonConnection.allMemberViewAllNoProcessData');
  const manageFinishedTitle = i18next.t('commonConnection.allMemberManageAllFinishedData');
  const manageNoProcessTitle = i18next.t('commonConnection.allMemberManageAllNoProcessData');

  if (!title) {
    const canManage = !!permission?.handleRange?.[PermissionCategory.UPDATE] || !!permission?.handleRange?.[PermissionCategory.DELETE];
    return canManage ? manageNoProcessTitle : viewNoProcessTitle;
  }
  if (title === viewFinishedTitle) {
    return viewNoProcessTitle;
  }
  if (title === manageFinishedTitle) {
    return manageNoProcessTitle;
  }
  const wrappedFinishedLabel = `（${finishedLabel}）`;
  const wrappedNoProcessLabel = `（${noProcessLabel}）`;
  if (title.includes(wrappedFinishedLabel)) {
    return title.replace(wrappedFinishedLabel, wrappedNoProcessLabel);
  }
  if (title.includes(finishedLabel)) {
    return title.replace(finishedLabel, noProcessLabel);
  }
  return `${title}${wrappedNoProcessLabel}`;
}

export function expandLegacyNoProcessDataPermissionGroups(
  permissions?: DataPermissionOther[] | null,
): DataPermissionOther[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const expandedPermissions: DataPermissionOther[] = [];
  for (const permission of permissions) {
    if (!permission) continue;

    const hasNoProcessStatus = hasExplicitNoProcessStatus(permission.dataStatus);
    const normalizedPermission = deepClone(permission);
    normalizedPermission.dataStatus = normalizeDataPermissionStatus({
      processing: permission.dataStatus?.processing,
      finished: permission.dataStatus?.finished,
      noProcess: hasNoProcessStatus ? permission.dataStatus?.noProcess : false,
    });
    expandedPermissions.push(normalizedPermission);

    if (!hasNoProcessStatus && normalizedPermission.dataStatus.finished) {
      const noProcessPermission = deepClone(normalizedPermission);
      noProcessPermission.title = getLegacyNoProcessPermissionTitle(normalizedPermission);
      noProcessPermission.dataStatus = {
        processing: false,
        finished: false,
        noProcess: true,
      };
      expandedPermissions.push(noProcessPermission);
    }
  }

  return expandedPermissions;
}


const systemColumnConfigurations: Record<string, FormElementConfiguration> = {
  [SystemField.CREATE_OWNER]: {
    subType: "account",
    funcInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  },
  [SystemField.DATA_OWNER]: {
    subType: "account",
    funcInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  },
  [SystemField.UPDATE_OWNER]: {
    subType: "account",
    funcInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  },
  [SystemField.CREATE_TIME]: {
    subType: "date",
    funcInfo: {
      [RuleFunc.GTE]: RuleFuncValue.DATE,
      [RuleFunc.TIME_LTE]: RuleFuncValue.DATE,
      [RuleFunc.TIME_BETWEEN]: RuleFuncValue.RANGE,
      // [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  },
  [SystemField.UPDATE_TIME]: {
    subType: "date",
    funcInfo: {
      [RuleFunc.GTE]: RuleFuncValue.DATE,
      [RuleFunc.TIME_LTE]: RuleFuncValue.DATE,
      [RuleFunc.TIME_BETWEEN]: RuleFuncValue.RANGE,
      // [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  },
  [SystemField.STATUS]: {
    subType: "status",
    funcInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  },
  [SystemField.CURRENT_NODE]: {
    subType: "node",
    funcInfo: {
      [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
    }
  },
  [SystemField.CURRENT_OWNER]: {
    subType: "account",
  }      
}
export const getSystemColumnConfigurations = (name: string) => {
  return systemColumnConfigurations[name];
}

export const transformConditionsGroup = (conditions: FormCondition[]) => {
    return conditions.reduce<{ main: WhereCondition[], [key: FieldUID]: WhereCondition[] }>((prev, item) => {
      const arr = item.uid?.split(".");
      if (arr.length > 1) {
        const groupKey = arr[0];
        if (!prev[groupKey]) { prev[groupKey] = [] };
        prev[groupKey].push(transformCondition(item));
      } else {
        prev.main.push(transformCondition(item));
      }
      return prev;
    }, { main: [] });
  }
