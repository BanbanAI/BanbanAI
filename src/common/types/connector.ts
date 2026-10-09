import {
  FormDataStageWhereCondition,
  FormDataStoreScope,
  WhereCondition,
} from "@common/types/project";

export interface ConnectionOptions {
  projectParams?: Record<string, string>;
  projectId?: string;
  clientId?: string;
  connectionId?: string;
}

export interface RawData {}
export interface TableMeta {}

export interface FieldMeta {
  name: string;
  uid?: string;
  subType?: string;
  extra?: any;
}

enum SortType {
  ASC = 1,
  DESC = -1,
}

export type PagingOptions = {
  pageSize?: number;
  pageNumber?: number;
  start?: number;
  limit?: number;
  orderBy?: Record<string, SortType> | SortType;
  wheres?: Record<string, WhereCondition[]>;
  stage?: FormDataStageWhereCondition;
  enabledStage?: boolean;
  scope?: FormDataStoreScope;
};

export interface ReadOptions {
  tableNames?: string[];
  paging?: PagingOptions;
  format?: boolean;
}

export type Table = {
  alias: string;
  fields: Field[];
  meta: TableMeta;
};

export type FieldType = "string" | "number" | "array" | "object";
export type FieldValue = string | number | (string | number)[];

export type Field = {
  alias: string;
  type: FieldType;
  meta?: FieldMeta;
};

export type TableRowData = Row[];
export type TableData = TableRowData | {
  data: TableRowData;
  count: number;
};

export interface ConnectionLostInfo {
  tableNames?: string[];
  isConnectionLost: boolean;
}

export type Row = FieldValue[];
export type DataRows = Record<string, FieldValue>[];

export type HandleDataResult = {
  tableName: string;
  data?: DataRows;
  success: boolean;
};

export type TableColumn = {
  uid: string;
  name: string;
  type: FieldType;
};

export interface IConnector<
  O extends ConnectionOptions,
  R extends RawData,
  T extends TableMeta,
  F extends FieldMeta,
> {
  toString(options: O): Promise<string>;
  getDisplayName(): Promise<string>;
  readOptions(options: O, readOptions?: ReadOptions): Promise<R>;
  /** @deprecated Use readOptions instead. */
  readRawData?(options: O, tableNames?: string[]): Promise<R>;
  parseTables(rawData: R): Promise<Table[]>;
  findTable(meta: T, originTables: Table[], newTables: Table[]): Promise<number>;
  findField(meta: F, originFields: Field[], newFields: Field[]): Promise<number>;
  transformData(rawData: R, tables: Table[]): Promise<TableData[]>;
  getLostInfo?(rawData: R): Promise<ConnectionLostInfo>;
}

export interface AbstractConnector
  extends IConnector<ConnectionOptions, RawData, TableMeta, FieldMeta> {}
