import { FormDataStage, isBranchNode, isSystemField, replaceUID, SystemField } from "@common/utils";
import { unique } from "@common/utils/unique";
import dayjs from 'dayjs';
import LinvoDB from "linvodb3";
import { isEmpty } from "@common/utils/object";
import { FormDataColumn, FormDataTableMeta, FormWidgetType, NocodeFormData } from "@common/types/nocode";
import type { Account, Department } from "@common/types/account";
import { Field, FieldType, FieldUID, OptionTableUID, ProcessFlow, Row, Table, WhereCondition, WidgetSoul } from "@common/types/project";
import { RawData, TransformRowOptions } from "./types";
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { DataRows } from "@common/types/connector";
import "dayjs/locale/en";
import "dayjs/locale/zh-cn";
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const DATE_TIME_VALUE_FORMAT = "YYYY-MM-DD HH:mm:ss";
const BARE_DATE_TEXT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const transformType = (value: any, type: FieldType) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map(item => transformType(item, type))
  if (type === "number") {
    return Number(value);
  } else if (value instanceof RegExp) {
    return value;
  } else {
    return String(value);
  }
}

export const isBareDateText = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!BARE_DATE_TEXT_REGEX.test(text)) return false;
  const dateValue = dayjs(text);
  return dateValue.isValid() && dateValue.format("YYYY-MM-DD") === text;
}

const formatNextDayStart = (value: string) => {
  const text = String(value || "").trim();
  if (!isBareDateText(text)) return "";
  return dayjs(text).add(1, "day").startOf("day").format(DATE_TIME_VALUE_FORMAT);
}

const isDateLikeSystemFieldName = (name?: string) => {
  return name === SystemField.CREATE_TIME || name === SystemField.UPDATE_TIME;
}

export const isDateLikeField = (field: Field | null | undefined) => {
  if (!field) return false;
  if (isSystemField(field)) {
    return isDateLikeSystemFieldName(field.meta?.name);
  }
  return field.meta?.subType === "date" || field.meta?.extra?.widgetType === FormWidgetType.DATE_PICKER;
}

export const isDateLikeColumn = (column: FormDataColumn | null | undefined) => {
  if (!column) return false;
  if (column.isSystem) {
    return isDateLikeSystemFieldName(String(column.name || ""));
  }
  return column.subType === "date" || column.extra?.widgetType === FormWidgetType.DATE_PICKER;
}

export const normalizeDateLikeFieldFilterValue = <T = any>(value: T, isDateLike: boolean): T => {
  if (!isDateLike || !value || Array.isArray(value) || !(value instanceof Object)) {
    return value;
  }

  const operatorValue = value as Record<string, any>;
  const nextDayStart = formatNextDayStart(operatorValue.$lte);
  if (!nextDayStart || operatorValue.$lt !== undefined) {
    return value;
  }

  const normalized: Record<string, any> = {
    ...operatorValue,
    $lt: nextDayStart,
  };
  delete normalized.$lte;
  return normalized as T;
}

export const transformFormDataRow = (rows: any, columns: FormDataColumn[], options?: TransformRowOptions) => {
  if (Array.isArray(rows)) {
    return rows.map(row => transformFormDataRow(row, columns, options));
  } else if (rows instanceof Object) {
    const result: Record<string, any> = {};
    for (const _key in rows) {
      const column = columns.find(column => [column.uid, column.name].includes(_key));
      if (!column || column?.isSystem) {
        result[_key] = rows[_key];
        continue;
      }

      const key = column.uid;
      const value = rows[_key];

      result[key] = typeof value === "object" && value !== null
        ? transformFormDataRow(value, columns, options)
        : (options?.transformType ? transformType(value, column.type) : value);
    }
    return result;
  }
  return rows;
};

const getSwitchValueVariants = (value: any, column: FormDataColumn) => {
  const format = Array.isArray(column.extra?.format) ? column.extra.format : [];
  const activeText = format[0];
  const inactiveText = format[1];

  if (value === true || value === "true" || (activeText !== undefined && value === activeText)) {
    return [true, "true", activeText].filter((item, index, values) => item !== undefined && values.indexOf(item) === index);
  }
  if (value === false || value === "false" || (inactiveText !== undefined && value === inactiveText)) {
    return [false, "false", inactiveText].filter((item, index, values) => item !== undefined && values.indexOf(item) === index);
  }
  return [value];
};

const normalizeSwitchFilterValue = (value: any, column: FormDataColumn) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap(item => getSwitchValueVariants(item, column))));
  }
  if (value instanceof Object && !(value instanceof RegExp)) {
    const result: Record<string, any> = {};
    for (const [operator, operatorValue] of Object.entries(value)) {
      if (operator === "$in" || operator === "$nin") {
        const values = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
        result[operator] = Array.from(new Set(values.flatMap(item => getSwitchValueVariants(item, column))));
      } else if (operator === "$ne") {
        result.$nin = getSwitchValueVariants(operatorValue, column);
      } else {
        result[operator] = operatorValue;
      }
    }
    return result;
  }

  const variants = getSwitchValueVariants(value, column);
  return variants.length === 1 ? variants[0] : { $in: variants };
};


export const transformWhereCondition = (where: any, columns: FormDataColumn[]) => {
  if (Array.isArray(where)) {
    return where.map(item => transformWhereCondition(item, columns));
  } else if (where instanceof Object) {
    const result: Record<string, any> = {};
    for (const _key in where) {
      if (_key.startsWith('$')) {
        result[_key] = transformWhereCondition(where[_key], columns);
        continue;
      }

      const column = columns.find(column => [column.uid, column.name].includes(_key));
      if (!column) {
        result[_key] = where[_key];
        continue;
      }
      const dateLikeColumn = isDateLikeColumn(column);
      const value = normalizeDateLikeFieldFilterValue(where[_key], dateLikeColumn);
      if (column?.isSystem && !dateLikeColumn) {
        result[_key] = value;
        continue;
      }
      const key = column.isSystem ? _key : column.uid;

      if (column.subType === "switch") {
        result[key] = normalizeSwitchFilterValue(value, column);
        continue;
      }

      if (!Array.isArray(value) && value instanceof Object) {
        const sub: Record<string, any> = {};
        for (const op in value) {
          if (op === "$size" || op === "$exists") {
            sub[op] = value[op];
          } else if (Array.isArray(value[op])) {
            sub[op] = value[op].map(item => transformType(item, column.type));
          } else {
            sub[op] = transformType(value[op], column.type);
          }
        }
        result[key] = sub;
      } else {
        result[key] = transformType(value, column.type);
      }
    }
    return result;
  }
  return where;
};

const isEmptyDataOwnerValue = (value: unknown) => {
  return value === undefined || value === null || value === "";
};

const buildMissingFieldClause = (fieldName: string) => {
  return {
    $or: [
      { [fieldName]: { $exists: false } },
      { [fieldName]: null },
      { [fieldName]: "" },
    ],
  };
};

const buildNonEmptyFieldClause = (fieldName: string) => {
  return {
    $and: [
      { [fieldName]: { $exists: true } },
      { [fieldName]: { $nin: [null, ""] } },
    ],
  };
};

const mergeClausesWithAnd = (clauses: any[]) => {
  const validClauses = clauses.filter(Boolean);
  if (validClauses.length === 0) {
    return {};
  }
  if (validClauses.length === 1) {
    return validClauses[0];
  }
  return {
    $and: validClauses,
  };
};

const mergeClausesWithOr = (clauses: any[]) => {
  const validClauses = clauses.filter(Boolean);
  if (validClauses.length === 0) {
    return {};
  }
  if (validClauses.length === 1) {
    return validClauses[0];
  }
  return {
    $or: validClauses,
  };
};

const buildValueMatcher = (values: any[]) => {
  if (values.length === 1) {
    return values[0];
  }
  return {
    $in: values,
  };
};

const buildNotInMatcher = (values: any[]) => {
  if (values.length === 0) {
    return null;
  }
  return {
    $nin: values,
  };
};

const buildDataOwnerInCompatibilityClause = (values: any[]) => {
  if (values.length === 0) {
    return {
      [SystemField.DATA_OWNER]: {
        $in: [],
      },
    };
  }
  const nonEmptyValues = values.filter(value => !isEmptyDataOwnerValue(value));
  const matchEmptyValue = values.some(isEmptyDataOwnerValue);
  const effectiveOwnerClauses: any[] = [];

  if (nonEmptyValues.length > 0) {
    const matcher = buildValueMatcher(nonEmptyValues);
    effectiveOwnerClauses.push({
      [SystemField.DATA_OWNER]: matcher,
    });
    effectiveOwnerClauses.push(mergeClausesWithAnd([
      buildMissingFieldClause(SystemField.DATA_OWNER),
      {
        [SystemField.CREATE_OWNER]: matcher,
      },
    ]));
  }

  if (matchEmptyValue) {
    effectiveOwnerClauses.push(mergeClausesWithAnd([
      buildMissingFieldClause(SystemField.DATA_OWNER),
      buildMissingFieldClause(SystemField.CREATE_OWNER),
    ]));
  }

  return mergeClausesWithOr(effectiveOwnerClauses);
};

const buildDataOwnerNotInCompatibilityClause = (values: any[]) => {
  const nonEmptyValues = values.filter(value => !isEmptyDataOwnerValue(value));
  const excludeEmptyValue = values.some(isEmptyDataOwnerValue);
  const notInMatcher = buildNotInMatcher(nonEmptyValues);
  const effectiveOwnerClauses: any[] = [
    mergeClausesWithAnd([
      buildNonEmptyFieldClause(SystemField.DATA_OWNER),
      notInMatcher ? { [SystemField.DATA_OWNER]: notInMatcher } : null,
    ]),
    mergeClausesWithAnd([
      buildMissingFieldClause(SystemField.DATA_OWNER),
      buildNonEmptyFieldClause(SystemField.CREATE_OWNER),
      notInMatcher ? { [SystemField.CREATE_OWNER]: notInMatcher } : null,
    ]),
  ];

  if (!excludeEmptyValue) {
    effectiveOwnerClauses.push(mergeClausesWithAnd([
      buildMissingFieldClause(SystemField.DATA_OWNER),
      buildMissingFieldClause(SystemField.CREATE_OWNER),
    ]));
  }

  return mergeClausesWithOr(effectiveOwnerClauses);
};

const buildDataOwnerCompatibilityClause = (value: any) => {
  if (Array.isArray(value)) {
    return buildDataOwnerInCompatibilityClause(value);
  }
  if (!(value instanceof Object) || value instanceof RegExp) {
    return buildDataOwnerInCompatibilityClause([value]);
  }

  const operatorEntries = Object.entries(value);
  if (operatorEntries.length !== 1) {
    return null;
  }

  const [operator, operatorValue] = operatorEntries[0];
  switch (operator) {
    case "$eq":
      return buildDataOwnerInCompatibilityClause([operatorValue]);
    case "$in":
      return buildDataOwnerInCompatibilityClause(Array.isArray(operatorValue) ? operatorValue : []);
    case "$ne":
      return buildDataOwnerNotInCompatibilityClause([operatorValue]);
    case "$nin":
      return buildDataOwnerNotInCompatibilityClause(Array.isArray(operatorValue) ? operatorValue : []);
    default:
      return null;
  }
};

export const rewriteDataOwnerCompatibility = (where: any): any => {
  if (Array.isArray(where)) {
    return where.map(item => rewriteDataOwnerCompatibility(item));
  }
  if (!(where instanceof Object) || where instanceof RegExp) {
    return where;
  }

  const result: Record<string, any> = {};
  const compatibilityClauses: any[] = [];
  for (const key in where) {
    if (key.startsWith("$")) {
      result[key] = rewriteDataOwnerCompatibility(where[key]);
      continue;
    }
    if (key !== SystemField.DATA_OWNER) {
      result[key] = where[key];
      continue;
    }

    const compatibilityClause = buildDataOwnerCompatibilityClause(where[key]);
    if (compatibilityClause) {
      compatibilityClauses.push(compatibilityClause);
      continue;
    }
    result[key] = where[key];
  }

  if (compatibilityClauses.length === 0) {
    return result;
  }
  return mergeClausesWithAnd([
    Object.keys(result).length > 0 ? result : null,
    ...compatibilityClauses,
  ]);
};

export const parseFields = async (columns: FormDataColumn[]): Promise<Omit<Field, "uid">[]> => {
  // [ {label: 'id', type: "number"}, { label: 'name', type: 'string' } ]
  let fields = [];
  for (const column of columns) {
    let { name, alias, type, uid, subType, extra, isSystem } = column;
    let field: Omit<Field, "uid"> & { uid?: FieldUID }= {
      alias: String(alias || name),
      meta: {
        name: String(name),
        uid,
        subType,
        extra,
        isSystem,
      },
      type
    }
    if (extra?.['__fieldId__']) {
      field.uid = extra['__fieldId__']
    }
    fields.push(field)
  }
  return fields;
}

export const parseTables = async (rawData: RawData): Promise<Omit<Table, "uid">[]> => {
  let tables = [];

  for (const { tableName, tableUid, columns, extra } of rawData) {
    let fields = await parseFields(columns) as Field[];
    let meta: FormDataTableMeta = {
      name: String(tableName),
      uid: tableUid,
      extra,
    }
    let table: Omit<Table, "uid"> & { uid?: FieldUID } = {
      alias: String(tableName),
      fields,
      meta
    }
    if (extra?.['__tableUID__']) {
      table.uid = extra['__tableUID__']
    }
    tables.push(table);
  }
  return tables;
}

export function convertWhere(where: WhereCondition | WhereCondition[]): Record<string, any> {
  const mongoQuery: Record<string, any> = {};

  const conditions = (Array.isArray(where) ? where : [where]).filter(Boolean);

  for (const condition of conditions) {
    for (const [field, value] of Object.entries(condition)) {
      if (field === "$and" || field === "$or") {
        mongoQuery[field] = (value as WhereCondition[]).map(item => convertWhere(item));
        continue;
      } else if (field === "$not") {
        mongoQuery[field] = convertWhere(value as WhereCondition);
        continue;
      }

      if (Array.isArray(value)) {
        mongoQuery[field] = { $in: value };
      } else if ((value as any) instanceof Object) {
        let fieldQuery: Record<string, any> = {};

        for (const [op, val] of Object.entries(value)) {
          switch (op) {
            case '$eq':
              fieldQuery = val;
              break;
            case '$ne':
              fieldQuery['$ne'] = val;
              break;
            case '$gt':
              fieldQuery['$gt'] = val;
              break;
            case '$gte':
              fieldQuery['$gte'] = val;
              break;
            case '$lt':
              fieldQuery['$lt'] = val;
              break;
            case '$lte':
              fieldQuery['$lte'] = val;
              break;
            case '$in':
              fieldQuery['$in'] = val;
              break;
            case '$all':
              fieldQuery['$all'] = val;
              break;
            case '$size':
              fieldQuery['$size'] = val;
              break;
            case '$nin':
              fieldQuery['$nin'] = val;
              break;
            case '$regex':
              fieldQuery['$regex'] = new RegExp(val as string, 'i');
              break;
            case '$exists':
              fieldQuery['$exists'] = val;
              break;
            default:
              throw new Error(`Unsupported operator: ${op}`);
          }
        }

        mongoQuery[field] = fieldQuery;
      } else {
        // 简单值（直接等于）
        mongoQuery[field] = value;
      }
    }
  }

  return mongoQuery;
}

export const systemColumnUtil = {
  getSystemColumns(options: { includeDataOwner?: boolean } = {}): FormDataColumn[] {
    const includeDataOwner = options.includeDataOwner !== false;
    const dataOwnerColumns: FormDataColumn[] = includeDataOwner
      ? [{ name: SystemField.DATA_OWNER, type: 'string' as FieldType, uid: unique(), isSystem: true }]
      : [];
    return [
      { name: SystemField.UUID, type: 'string' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.CREATE_OWNER, type: 'string' as FieldType, uid: unique(), isSystem: true },
      ...dataOwnerColumns,
      { name: SystemField.UPDATE_OWNER, type: 'string' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.CREATE_TIME, type: 'string' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.UPDATE_TIME, type: 'string' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.STATUS, type: 'string' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.CURRENT_NODE, type: 'array' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.CURRENT_OWNER, type: 'array' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.SORT, type: 'number' as FieldType, uid: unique(), isSystem: true },
      { name: SystemField.DATA_STAGE, type: 'string' as FieldType, uid: unique(), isSystem: true },
    ];
  },
  getColumnDefaultValue(column: FormDataColumn) {
    switch (column.name) {
      case SystemField.UUID:
        return unique();
      case SystemField.CREATE_TIME:
        return dayjs().format("YYYY-MM-DD HH:mm:ss");
      case SystemField.UPDATE_TIME:
        return dayjs().format("YYYY-MM-DD HH:mm:ss");
      case SystemField.SORT:
        return 0;
      case SystemField.DATA_STAGE:
        return FormDataStage.NORMAL;
      case SystemField.CURRENT_NODE:
        return [];
      case SystemField.CURRENT_OWNER:
        return [];
      default:
        return "";
    }
  }
}


type LinvoDBOptions = {
  tableDir: string,
}

export interface RemoveOptions {
  multi?: boolean,

}

export interface UpdateOptions extends RemoveOptions {
  upsert?: boolean,
}

type UpdateQuery = {
  $set?: any,
  $unset?: any,
  $inc?: any,
  $push?: any,
  $pull?: any,
  $addToSet?: any,
  $pop?: any,
  $each?: any,
}

export enum EventType {
  CLOSE = 'close',
}

enum SortType {
  ASC = 1,
  DESC = -1,
}
export type FindOptions = {
  limit?: number,
  skip?: number,
  sort?: Record<string, SortType> | SortType,
  projection?: string[],
}


export const getDbColumnKey = (field: Field) => {
  return isSystemField(field) ? (field.meta?.name === SystemField.KEY ? field.meta.uid : field.meta.name) : field.meta.uid;
}
export function convertCondition<T extends WhereCondition = WhereCondition>(condition: T, table: Table) {
  if (!condition) return;
  const conditionRecord = condition as Record<string, any>;
  if ('$and' in condition) {
    const value = (condition.$and) as WhereCondition[];
    if (isEmpty(value)) return {};
    if (value.length === 1) {
      return convertCondition(value[0], table);
    }
    return {
      $and: value?.map(sub => convertCondition(sub, table))
    };
  }
  if ('$or' in condition) {
    const value = (condition.$or) as WhereCondition[];
    return {
      $or: value?.map(sub => convertCondition(sub, table))
    };
  }
  if ('$not' in condition) {
    const value = (condition.$not) as WhereCondition;
    return {
      $not: convertCondition(value, table)
    };
  }

  const result: Record<string, any> = {};
  for (const key in condition) {
    const field = table.fields.find(f => ((f.uid === key) || (f.meta.name === key)));
    if (!field) {
      result[key] = conditionRecord[key];
      continue;
    }
    const metaKey = getDbColumnKey(field)
    result[metaKey] = normalizeDateLikeFieldFilterValue(conditionRecord[key], isDateLikeField(field));
  }
  return result;
}

export function convertOrderby(orderby: Record<string, SortType>, table: Table) {
  if (!orderby) return;
  const _orderBy = {};
  for (const fieldId in orderby) {
    if (!table) continue;
    const field = table.fields.find(field => field.uid === fieldId);
    const metaKey = getDbColumnKey(field);
    _orderBy[metaKey] = orderby[fieldId];
  }
  return _orderBy;
}

export abstract class BaseDbConnection {
  abstract connect(): Promise<void>;
  abstract close(): Promise<void>;
  abstract getDb(databaseName: string, tableName: string): Promise<BaseDb>;
  abstract isConnectionActive(): boolean;
}
export abstract class BaseDb {
  constructor() {
  }

  abstract find<Q = any, O extends FindOptions = FindOptions>(query?: Q, options?: O): Promise<any[]>;
  abstract findOne<Q = any, O extends FindOptions = FindOptions>(query?: Q, options?: O): Promise<any>;
  abstract findWithCount<Q = any, O extends FindOptions = FindOptions>(query?: Q, options?: O): Promise<{docs: any[], count: number}>;
  abstract insert<T = any>(data: T): Promise<any[]>;
  abstract save<T = any>(docs: T[]): Promise<any[]>;
  abstract update<Q = any, S = UpdateQuery, O extends UpdateOptions = UpdateOptions>(query: Q, updateQuery: S, options?: O): Promise<any[]>;
  abstract remove<Q = any, O extends RemoveOptions = RemoveOptions>(query: Q, options?: O): Promise<any[]>;
  abstract count<Q = any>(query?: Q, quiet?: boolean): Promise<number>;
  abstract distinct<Q = any, O = FindOptions>(field: string, query?: Q, options?: O, quiet?: boolean): Promise<{value: any, count: number}[]>;
  abstract close(): Promise<void>;
  abstract updateManyColumns<Q=any, K extends object = Record<string, string>>(query: Q, keyMap: K): Promise<any>;
}


export class LevelDB extends BaseDb {
  private sortField = "_time";
  private doc: LinvoDB;

  get tableDir() {
    return this.options.tableDir;
  }
  constructor(private name: string, private options: LinvoDBOptions) {
    super();
    this.doc = new LinvoDB(name, {
      filename: options.tableDir,
    });
  }

  private resolveReadyPromise() {
    const awaitReady = (this.doc as any)?._awaitReady;
    if (typeof awaitReady === "function") {
      return Promise.resolve(awaitReady.call(this.doc)).then(() => undefined);
    }
    return Promise.resolve();
  }

  private async ensureReady() {
    await this.resolveReadyPromise();
  }

  private parseData<T = any>(data: T, time = Date.now()) {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) {
      return data.map((item, i) => this.parseData(item, time + i));
    } else if (data instanceof Object) {
      data[this.sortField] = time;
    }
    return data;
  }

  private filterData<T = any>(data: T) {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.filterData(item));
    } else if (data instanceof Object) {
      delete data[this.sortField];
    }
    return data
  }

  private projectData<T = any>(data: T, projection?: string[]) {
    if (!projection?.length) return data;
    const projectionSet = new Set(["_id", ...projection]);
    if (Array.isArray(data)) {
      return data.map(item => this.projectData(item, projection)) as T;
    }
    if (data instanceof Object) {
      const result: Record<string, any> = {};
      Object.keys(data as Record<string, any>).forEach(key => {
        if (projectionSet.has(key)) {
          result[key] = (data as Record<string, any>)[key];
        }
      });
      return result as T;
    }
    return data;
  }

  count<T>(query = {} as T, quiet?: boolean) {
    return this.ensureReady().then(() => new Promise<number>((resolve, reject) => {
      this.doc.count(query, (err, count) => {
        if (err) reject(err);
        resolve(count);
      }, quiet);
    }))
  }

  distinct<T>(field: string, query = {} as T, options: FindOptions = {}, quiet?: boolean) {
    return this.ensureReady().then(() => new Promise<{value: any, count: number}[]>((resolve, reject)=>{
      let sort = isEmpty(options?.sort) ? SortType.DESC : options.sort;
      let cursor = this.doc.distinct(field, query).sort(sort);
      cursor.exec((err, res) => {
        if (err) reject(err);
        resolve(res);
      })
    }))
  }

  find<T>(query = {} as T, options: FindOptions = {}) {
    return this._find(query, options, false) as Promise<any[]>;
  }
  findWithCount<T>(query = {} as T, options: FindOptions = {}) {
    return this._find(query, options, true) as Promise<{docs: any[], count: number}>;
  }

  private _find<T>(query = {} as T, options: FindOptions = {}, fetchCount=false) {
    return this.ensureReady().then(() => new Promise<any[]|{docs: any[], count: number}>((resolve, reject) => {
      let sort = isEmpty(options?.sort) ? SortType.DESC : options.sort;
      if (typeof sort !== "object") {
        sort = { [this.sortField]: sort as SortType };
      }
      for (const key in sort) {
        sort[key] = sort[key] == SortType.DESC ? -1 : 1;
      }
      let cursor = this.doc.find(query).sort(sort);
      if (options.skip) cursor = cursor.skip(options.skip);
      if (options.limit) cursor = cursor.limit(options.limit);
      if (fetchCount) cursor = cursor.fetchCount();
      cursor.exec((err, res) => {
        if (err) return reject(err);
        if (!fetchCount) {
          resolve(this.projectData(this.filterData(res), options.projection));
        } else {
          const { docs, count } = res;
          resolve({docs: this.projectData(this.filterData(docs), options.projection), count});
        }
      })
    }));
  }

  findOne<T>(query = {} as T, options: FindOptions = {}) {
    return this.ensureReady().then(() => new Promise<any>((resolve, reject) => {
      let sort = isEmpty(options?.sort) ? SortType.DESC : options.sort;
      if (typeof sort !== "object") {
        sort = { [this.sortField]: sort as SortType };
      }
      for (const key in sort) {
        sort[key] = sort[key] == SortType.DESC ? -1 : 1;
      }
      this.doc.findOne(query).sort(sort).exec((err, doc) => {
        if (err) reject(err);
        resolve(this.projectData(this.filterData(doc), options.projection));
      })
    }));
  }

  insert<T = any>(data: T) {
    return this.ensureReady().then(() => new Promise<any[]>((resolve, reject) => {
      this.doc.insert(this.parseData(data), (err, result) => {
        if (err) reject(err);
        resolve(result?.map(item => item.copy()));
      })
    }));
  }

  save<T = any>(docs: T[]) {
    return this.ensureReady().then(async () => {
      const existingDocs = docs.filter(doc => (doc as any)?._id != null);
      const insertDocs = docs.filter(doc => (doc as any)?._id == null);
      const results: any[] = [];

      if (existingDocs.length) {
        const docMap = new Map(existingDocs.map(doc => [String((doc as any)._id), doc]));
        const updated = await new Promise<any[]>((resolve, reject) => {
          this.doc.update({
            _id: { $in: [...docMap.keys()] },
          }, (storedDoc) => {
            const nextDoc = docMap.get(String(storedDoc._id));
            if (!nextDoc) return;
            const sortValue = storedDoc[this.sortField];
            for (const key of Object.keys(storedDoc)) {
              if (key !== this.sortField) delete storedDoc[key];
            }
            Object.assign(storedDoc, nextDoc);
            storedDoc[this.sortField] = sortValue;
          }, { multi: true }, (err, result) => {
            if (err) return reject(err);
            resolve(Array.isArray(result) ? result : (result == null ? [] : [result]));
          });
        });
        results.push(...updated);
      }

      if (insertDocs.length) {
        const inserted = await new Promise<any[]>((resolve, reject) => {
          this.doc.insert(this.parseData(insertDocs), (err, result) => {
            if (err) return reject(err);
            resolve(result?.map(item => item.copy()) || []);
          });
        });
        results.push(...inserted);
      }

      return results;
    });
  }

  update<T>(query: T, updateQuery: UpdateQuery, options: UpdateOptions = {}) {
    return this.ensureReady().then(() => new Promise<any[]>((resolve, reject) => {
      this.doc.update(query, updateQuery, options, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    }));
  }

  remove<T>(query: T, options: RemoveOptions = {}) {
    return this.ensureReady().then(() => new Promise<any[]>((resolve, reject) => {
      this.doc.remove(query, {
        ...options,
        multi: options.multi !== false ? true : false,
      }, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    }));
  }

  updateManyColumns<T, K>(query: T, keyMap: K) {
    return new Promise<void>((resolve, reject) => {
      this.doc.update(query, (doc) => {
        for (const key in keyMap) {
          doc[key] = doc[keyMap[key]];
        }
      }, { multi: true }, (err, docs) => {
        if (err) reject(err?.message);
        resolve();
      })
    })
  }

  close() {
    return new Promise<void>((resolve, reject) => {
      (this.doc as any).close((err) => {
        if (err) return reject(err);
        this.doc?.emit("close");
        resolve();
      });
    });
  }

  on(event: EventType, listener: (...args: any[]) => void) {
    this.doc?.addListener(event, listener);
  }
}

export function getResetTimestamp(cycle: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'): number | null {
  const now = dayjs();

  switch (cycle) {
    case 'daily':
      return now.endOf('day').valueOf();
    case 'weekly':
      return now.endOf('week').valueOf();
    case 'monthly':
      return now.endOf('month').valueOf();
    case 'yearly':
      return now.endOf('year').valueOf();
    default:
      return null;
  }
}

type SerialNumberOrganizeLookups = {
  users?: Array<Pick<Account, "id" | "realname" | "user">>;
  departments?: Array<Pick<Department, "id" | "name" | "children">>;
}

function flattenDepartments<T extends { children?: T[] }>(departments: T[] = []): T[] {
  const result: T[] = [];

  const dfs = (list: T[] = []) => {
    for (const item of list) {
      result.push(item);
      if (item?.children?.length) {
        dfs(item.children);
      }
    }
  };

  dfs(departments);
  return result;
}

function normalizeFieldValue(value: any) {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined && item !== null && item !== "");
  }

  if (typeof value === "string" && value.includes(",")) {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(item => item !== "");
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function getOrganizeItemId(item: any) {
  return item?.id ?? item?.uid ?? item?.value;
}

function getOrganizeItemName(item: any) {
  return item?.realname || item?.name || item?.user || item?.label || item?.id || "";
}

function isSameOrganizeItem(source: any, value: any) {
  const sourceId = getOrganizeItemId(source);
  const valueId = typeof value === "object" ? getOrganizeItemId(value) : value;

  if (sourceId === undefined || sourceId === null || valueId === undefined || valueId === null) {
    return false;
  }

  return String(sourceId) === String(valueId);
}

function formatOrganizeFieldValue(value: any, sourceList: any[] = []) {
  return normalizeFieldValue(value)
    .map((item) => {
      const matched = sourceList.find(source => isSameOrganizeItem(source, item));
      if (matched) {
        return getOrganizeItemName(matched);
      }

      if (typeof item === "object") {
        return getOrganizeItemName(item);
      }

      return String(item ?? "");
    })
    .filter(Boolean)
    .join("");
}

function formatFieldValue(field: Field, value: any, organizeLookups?: SerialNumberOrganizeLookups) {
  const widgetType = field?.meta?.extra?.widgetType;
  if (widgetType === "widget.form.memberSelect") {
    return formatOrganizeFieldValue(value, organizeLookups?.users || []);
  }

  if (widgetType === "widget.form.departmentSelect") {
    return formatOrganizeFieldValue(value, flattenDepartments(organizeLookups?.departments || []));
  }

  if (widgetType === "widget.form.datePicker" && value) {
    const format = field?.meta?.extra?.format;
    const locale = field?.meta?.extra?.dateLocale === "en" ? "en" : "zh-cn";
    const date = dayjs(value).locale(locale);
    if (format && date.isValid()) {
      return date.format(format);
    }
  }

  return value ?? "";
}

export function formatSerialNumber(serialNumber: number, serialNumberRules: any, row: any, fields: Field[], organizeLookups?: SerialNumberOrganizeLookups): string {
  const countingRule = serialNumberRules?.find(item => item.type === 'counting');

  let textSerialNumber = "";
  for (const rule of serialNumberRules) {
    switch (rule.type) {
      case "date":
        const format = rule.value.optionalFormat === "custom" ? rule.value.customFormat : rule.value.optionalFormat;
        const now = dayjs();
        const timeStr = now.format(format);
        textSerialNumber += timeStr;
        break;
      case "field":
        const field = fields?.find(field => field.meta.uid === rule.value);
        const fieldId = field?.uid;
        if (fieldId) textSerialNumber += formatFieldValue(field, row[fieldId], organizeLookups);
        break;
      case "prefix":
        textSerialNumber += rule.value;
        break;
      case "counting":
        textSerialNumber += countingRule?.value.digitFixed ? String(serialNumber).padStart(rule.value.digitLength, '0') : String(serialNumber);
        break;
    }
  }

  return textSerialNumber;
}

export function countSerialNumber(
  formData: NocodeFormData,
  tableId: string,
  newRow: any,
  fieldId: string,
  organizeLookups?: SerialNumberOrganizeLookups,
  runtimeCounter?: Record<string, any>,
): String {
  const formDataTable = formData.options.tables.find(table => table.uid === tableId);
  const table = formData.tables.find(table => tableId == table.meta.uid);
  const field = table.fields.find(f => f.uid === fieldId);
  const column = formDataTable.columns.find(col => col.uid === field.meta.uid);
  const serialNumberConfig = column?.extra?.serialNumber || {};
  const serialNumber = runtimeCounter || serialNumberConfig;
  const countingRule = serialNumberConfig?.rules?.find(item => item.type === 'counting');

  if (!runtimeCounter && !column?.extra?.serialNumber) {
    column.extra.serialNumber = {};
  }

  if (!serialNumber.resetTime && countingRule?.value.resetCycle !== 'none') {
    serialNumber.resetTime = getResetTimestamp(countingRule?.value.resetCycle) ?? null;
  }

  if (serialNumber.resetTime !== null && dayjs().valueOf() > serialNumber.resetTime) {
    serialNumber.count = Number(countingRule?.value.startValue) ?? 0;
    serialNumber.resetTime = getResetTimestamp(countingRule?.value.resetCycle) ?? null;
  } else {
    serialNumber.count = serialNumber.count === undefined ? Number(countingRule.value.startValue ?? 0) : serialNumber.count + 1;
  }
  serialNumber.updateTime = dayjs().valueOf();


  return formatSerialNumber(serialNumber.count ?? countingRule.value.startValue, serialNumberConfig?.rules, newRow, table.fields, organizeLookups)
}

// 评估行数据是否满足指定的WhereCondition
export function evaluateCondition(row: Row, condition: WhereCondition): boolean {
  for (const [field, value] of Object.entries(condition)) {
    // 跳过特殊操作符，由函数evaluateTopLevelOperators处理
    if (field.startsWith('$')) continue;
    if (!(field in row)) return false;

    const cell = row[field];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!evaluateNestedOperators(cell, value)) {
        return false;
      }
    } else {
      // value为基础类型直接比较
      if (cell !== value) return false;
    }
  }

  return evaluateTopLevelOperators(row, condition);
}

// 处理嵌套操作符 (如 { $gt: 18 })
function evaluateNestedOperators(value: any, condition: WhereCondition): boolean {
  for (const [op, opValue] of Object.entries(condition)) {
    switch (op) {
      case '$gt':
        if (!(value > opValue)) return false;
        break;
      case '$gte':
        if (!(value >= opValue)) return false;
        break;
      case '$lt':
        if (!(value < opValue)) return false;
        break;
      case '$lte':
        if (!(value <= opValue)) return false;
        break;
      case '$ne':
        if (value === opValue) return false;
        break;
      case '$in':
        if (!Array.isArray(opValue) || !opValue.includes(value)) return false;
        break;
      case '$nin':
        if (Array.isArray(opValue) && opValue.includes(value)) return false;
        break;
      case '$like':
        if (typeof value !== 'string' || !new RegExp(opValue, 'i').test(value)) return false;
        break;
      case '$regex':
        try {
          if (!new RegExp(opValue).test(value)) return false;
        } catch (e) {
          console.warn(`Invalid regex: ${opValue}`);
          return false;
        }
        break;
      default:
        console.warn(`Unknown operator: ${op}`);
        return false;
    }
  }
  return true;
}

// 处理顶层操作符 ($and, $or, $not)
function evaluateTopLevelOperators(row: Row, condition: WhereCondition): boolean {
  if ('$and' in condition) {
    const andConditions = condition.$and;
    if (!Array.isArray(andConditions)) return false;
    return (andConditions as WhereCondition[]).every(subCond => evaluateCondition(row, subCond));
  }

  if ('$or' in condition) {
    const orConditions = condition.$or;
    if (!Array.isArray(orConditions)) return false;
    return (orConditions as WhereCondition[]).some(subCond => evaluateCondition(row, subCond));
  }

  if ('$not' in condition) {
    return !evaluateCondition(row, condition.$not as WhereCondition);
  }

  return true;
}

// 递归赋值表单中formOptions中widgets的uid
export function assignWidgetsUid(widgets: WidgetSoul[], widgetIdMap: Record<string, string>) {
  // 结束条件：widgets不存在或者为空数组
  if (!widgets || !Array.isArray(widgets) || widgets.length === 0) return;

  widgets.forEach(widget => {
    if(widgetIdMap[widget.uid]){
      widget.uid = widgetIdMap[widget.uid];

      if (widget.type === "widget.form.subform") {
        widget.options = replaceUID(widget.options, widgetIdMap);
      }
    }else{
      widget.uid = unique();
    }
    assignWidgetsUid(widget.widgets, widgetIdMap);
  })
}


export const replaceProcessUID = (flows: ProcessFlow[], uidMap: Record<string, string>) => {
  if (isEmpty(flows)) return;
  for (const flow of flows) {
    if (isBranchNode(flow.type)) {
      for (const branch of flow.branches) {
        replaceProcessUID(branch.flows, uidMap);
      }
    }
    flow.options = replaceUID(flow.options, uidMap);
  }
}

export const isProcessFlow = (obj: any): obj is ProcessFlow => {
  return obj.uid && !obj.flowId;
}

export const deleteDataWithKey = (field: Field) => {
  if (field.meta.name === SystemField.KEY) {
    return field.meta.uid;
  }
  return field.meta.name;
}

export const transformDeleteRows = (table: Table, rows: any[]) => {
  const tableFieldsMap = new Map<string, any>();
  const subTableUIDs: OptionTableUID[] = [];
  for (const field of table.fields) {
    const { extra } = field.meta;
    if (extra?.subTableUID) {
      //带有关联表标志的不属于该数据库字段
      subTableUIDs.push(extra.subTableUID);
    } else {
      tableFieldsMap.set(field.uid, {
        name: field.meta.name,
        extra: field.meta.extra,
        field,
      });
    }
  }
  const newRows: DataRows = [];
  for (const row of rows) {
    const newRow = {}
    for (const uid of Object.keys(row)) {
      if (!tableFieldsMap.has(uid)) continue;
      let value = row[uid];
      const { field } = tableFieldsMap.get(uid);
      newRow[deleteDataWithKey(field)] = value;
    }
    newRows.push(newRow);
  }
  return {
    newRows,
    subTableUIDs,
  };
}
