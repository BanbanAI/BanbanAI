import { FieldUID, Table, WhereCondition } from "@common/types/project";

export type QueryAlias = string;
 
export type QueryFilters = WhereCondition;

export type QuerySort = QueryAlias | `${QueryAlias}:${'asc' | 'desc'}`;

export type QueryPagination = {
  page?: number,
  pageSize?: number
  start?: number,
  limit?: number
  withCount?: boolean,
  total?: number,
}

export type QueryPopulate = '*' | QueryAlias | QueryAlias[];

export type ApiQueryOption = {
  filters?: Record<QueryAlias, WhereCondition | WhereCondition[]>,
  sort?: QuerySort,
  pagination?: QueryPagination,
  fields?: QueryAlias[],
  populate?: QueryPopulate,
}

export type ApiSearchOption = {
  query: string,
  pagination?: QueryPagination,
}

export type CustomFSOptions = {
  table: Table,
  appId: string,
  pagination?: QueryPagination,
}

export type ValidOption = {
  key: string,
  timestamp: number,
  sign: string
}