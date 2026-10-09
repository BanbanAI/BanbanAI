import { Bucket, Connection, Table, Field, ProjectParams, QueryOptions } from '@common/types/project';
import { Injectable, Logger } from '@nestjs/common'
import { unique } from '@common/utils/unique';
import { AbstractConnector, TableData } from '@common/types/connector';
import { deepClone, isEmpty } from '@common/utils/object';
import { ReadConnectionOptions, PagingOptions } from './types';
import dayjs from 'dayjs';
import { isNocodeFormData, isSystemField, mappingSystemFieldAlias, SystemField } from '@common/utils';
import { NocodeFormData } from '@common/types/nocode';
import { FormDataConnector } from '../formData/form-data.connector';
import { MikroORM } from '@mikro-orm/core';
import { convertCondition } from '../formData/utils'
import { RawData } from '../formData/types';
import { OrganizeCacheService } from '../workbench/organize-cache.service';

type InternalFieldUIDsMap = Record<string, string[]>;

type InternalReadConnectionOptions = ReadConnectionOptions & {
  fieldUIDsMap?: InternalFieldUIDsMap,
}


@Injectable()
export class ConnectionUtils {
  private readonly logger = new Logger("ConnectionUtils");

  constructor(
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly formDataConnector: FormDataConnector,
    private readonly organizeCache: OrganizeCacheService,
  ) {}

  private async mergeFields(IConnector: AbstractConnector, originFields: Field[], newFields: Field[], isReset = false, isEmbedded: boolean): Promise<Field[]> {
    if (isEmpty(newFields)) return originFields;  // 防止某一次查询的数据为空时，造成组件数据字段丢失
    const fields = [];
    for (const newField of newFields) {
      const index = await IConnector.findField(newField.meta, originFields, newFields);
      if (index === -1) { // 新增的
        const field = {
          uid: `f_${unique()}`,
          ...newField,
          alias: isEmbedded ? mappingSystemFieldAlias(newField.alias || newField.meta.name) : newField.alias,
        }
        fields.push(field);
      } else if (isReset) { // 重置字段（除了uid，其他都重置）
        const field = {
          ...newField,
          uid: originFields[index].uid,
          alias: isEmbedded ? mappingSystemFieldAlias(newField.alias || newField.meta.name) : newField.alias,
        }
        fields.push(field);
      } else {
        const originField = originFields[index];
        const alias = isSystemField(newField as Field)
          ? newField.alias
          : ((originField.meta['name'] === originField.alias) || isEmbedded ? newField.alias : originField.alias);
        const field = {
          ...originField,
          meta: newField.meta,
          alias: isEmbedded ? mappingSystemFieldAlias(alias) : alias,
          type: newField.type,
        };
        fields.push(field);
      }
    }
    return fields;
  }

  private reserveDeletedTables(currentTables: Table[], originTables: Table[]) {
    const deletedTables = originTables.filter(originTable => {
      const table = currentTables.find(table => table.uid === originTable.uid);
      if(!table) {
        originTable.meta.isDeleted = true;
        return !table;
      }
    })
    return currentTables.concat(deletedTables);
  }

  private async mergeTables(IConnector: AbstractConnector, originTables: Table[], newTables: Table[], isEmbedded: boolean, isReset = false): Promise<Table[]> {
    const tables = [];
    for (const newTable of newTables) {
      const index = await IConnector.findTable(newTable.meta, originTables, newTables);
      if (index === -1) { // 表示新增的Table
        let newUid = unique()
        while (tables.findIndex( item => item.uid === newUid) !== -1) {
          this.logger.debug(global.i18next.t('connectionUtils.addTableUidDuplicate'));
          newUid = unique();
        }
        this.logger.debug(global.i18next.t('connectionUtils.addTableUidLabel') + newUid);
        const table = {
          uid: `t_${newUid}`,
          ...newTable,
          fields: await this.mergeFields(IConnector, [], newTable.fields, isReset, isEmbedded),
        };
        tables.push(table);
      } else if (isReset) {
        const table = {
          ...newTable,
          uid: originTables[index].uid,
          fields: await this.mergeFields(IConnector, originTables[index].fields, newTable.fields, isReset, isEmbedded),
        }
        tables.push(table);
      } else {  // 修改的
        const originTable = originTables[index];
        const table = {
          ...originTable,
          alias: originTable.meta['name'] === originTable.alias ? newTable.alias : originTable.alias,
          meta: newTable.meta,
          fields: await this.mergeFields(IConnector, originTable.fields, newTable.fields, isReset, isEmbedded),
        };
        tables.push(table);
      }
    }
    return isReset ? tables : this.reserveDeletedTables(tables, originTables);
  }


  private async readRawData(
    IConnector: AbstractConnector,
    connection: Connection,
    projectId: string,
    clientId: string,
    projectParams: ProjectParams,
    tableNames?: string[],
    pagingOptions?: PagingOptions,
    fieldUIDsMap?: InternalFieldUIDsMap,
  ) {

    const options = deepClone(connection.options);
    options.projectParams = projectParams || {};
    options.projectId = projectId;
    options.clientId = clientId;
    options.connectionId = connection.uid;

    if (!IConnector.readOptions) {
      return await IConnector.readRawData(options, tableNames);
    }
    const readOptions = {
      tableNames,
      paging: pagingOptions,
      format: pagingOptions?.formatData,
      fieldUIDsMap,
    };
    return await IConnector.readOptions(options, readOptions);
  }

  private async getIConnector(connection: Connection | NocodeFormData) {
    if (isNocodeFormData(connection)) {
      return this.formDataConnector as unknown as AbstractConnector;
    }
    return undefined;
  }

  async getBucketRow(connection: Connection | NocodeFormData, rawData : RawData, table: Table) {
    let IConnector = await this.getIConnector(connection);
    if (!IConnector) return;
    rawData = await Promise.all(rawData.map(async (raw) => {
      if (isNocodeFormData(connection)) {
        raw.data = await this.formDataConnector.formatData(raw.data, raw.columns);
      }
      return raw
    }))
    const data = await IConnector.transformData(rawData, [table])
    return await this.getBuckets([table], data, true)
  }

  async readConnectionData(connection: Connection | NocodeFormData, updateTables: boolean, projectId: string, clientId: string, projectParams: ProjectParams, options: InternalReadConnectionOptions={}) {
    let IConnector = await this.getIConnector(connection);
    if (!IConnector) return;

    let tables = connection.tables;
    let tableNames: string[] = null;
    const { tableUIDs, isReset, queryOptions, fieldUIDsMap } = options;
    if(!isEmpty(tableUIDs)) {
      tables = tables.filter(table => tableUIDs.includes(table.uid));

      tableNames = tables.reduce((prev, table) => {
        const t = connection.options.tables.find(t => t.uid === table.meta.uid);
        prev.push(t?.tableName || table.meta.name);
        return prev;
      }, []);
    }

    const { filters, orderBy, ...pagingOptions } = queryOptions || {} as QueryOptions;
    if (!isEmpty(filters)) {
      const wheres = {};
      for (const tableId in filters) {
        let conditions = filters[tableId];
        if (!conditions) continue;
        const table = tables.find(table => table.uid === tableId);
        if (!table) continue;
        if (!Array.isArray(conditions)) conditions = [conditions];
        const where = conditions.map(item => convertCondition(item, table)).filter(Boolean);
        if (!isEmpty(where)) {
          wheres[(table.meta.uid || table.meta.name)] = where;
        }
      }
      if (!isEmpty(wheres)) {
        (pagingOptions as any).wheres = wheres;
      }
    }

    if (!isEmpty(orderBy)) {
      if (typeof orderBy === "object") {
        const _orderBy = {};
        for (const fieldId in orderBy) {
          const table = tables.find(table => table.fields.find(field => field.uid === fieldId));
          if (!table) continue;
          const field = table.fields.find(field => field.uid === fieldId);
          const metaKey = isSystemField(field) ? field.meta.name : field.meta.uid;
          _orderBy[metaKey] = orderBy[fieldId];
        }
        (pagingOptions as any).orderBy = _orderBy;
      } else {
        (pagingOptions as any).orderBy = orderBy;
      }
    }

    const rawData = await this.readRawData(IConnector, connection as Connection, projectId, clientId, projectParams, tableNames, pagingOptions, fieldUIDsMap);
    const isFormData = isNocodeFormData(connection);
    if (updateTables) {
      let newTables: any = await IConnector.parseTables(rawData);  // 一个没有id的table结构
      tables = await this.mergeTables(IConnector, tables, newTables, isFormData, isReset);
    }

    if (IConnector.getLostInfo) {
      const { tableNames: lostTablesName, isConnectionLost } = await IConnector.getLostInfo(rawData);
      if (isConnectionLost && !isFormData) {
        throw new Error(global.i18next.t("connectionUtilTs.connectionLost"));
      }
  
      for (const table of tables || []) {
        const lostTable = lostTablesName.find(name => table.meta["name"] === name);
        if (lostTable) {
          table.isLost = true;
        } else {
          delete table.isLost;
        }
      }
    }
    const data = await IConnector.transformData(rawData, tables);
    const buckets = await this.getBuckets(tables, data, options.transformFormData);

    return {
      tables,
      buckets
    }
  }

  private transformFormData(
    field: Field,
    value: any,
    accountNameById: ReadonlyMap<string, string>,
    departmentNameById: ReadonlyMap<string, string>,
  ) {
    if (isSystemField(field)) {
      if ([SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.UPDATE_OWNER, SystemField.CURRENT_OWNER].includes(field.meta.name as any)) {
        const isArray = Array.isArray(value);
        value = isArray ? value : [value];
        value = value.map(id => accountNameById.get(String(id)) || id);
        return value?.join(",");
      }
    } else if ('account' === field.meta?.subType) {
      const isArray = Array.isArray(value);
      value = isArray ? value : [value];
      value = value.map(id => accountNameById.get(String(id)));
      return value?.join(",");
    } else if ('department' === field.meta?.subType) {
      const isArray = Array.isArray(value);
      value = isArray ? value : [value];
      value = value.map(id => departmentNameById.get(String(id)));
      return value?.join(",");
    }
    return value;
  }

  private async getBuckets(tables: Table[], tableData: TableData[], transformFormData = false): Promise<Bucket[]> {
    const buckets = [];

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      let data = tableData?.[i] || [];
      let count = 0;
      if (!Array.isArray(data)) {
        count = data.count;
        data = data.data;
      } else {
        count = data.length;
      }
      const accountIds = new Set<string>();
      const departmentIds = new Set<string>();
      const organizeFields = table.fields.flatMap((field, index) => {
        const isAccount = (isSystemField(field)
          && [SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.UPDATE_OWNER, SystemField.CURRENT_OWNER].includes(field.meta.name as any))
          || field.meta?.subType === "account";
        if (isAccount) return [{ index, target: accountIds }];
        if (field.meta?.subType === "department") return [{ index, target: departmentIds }];
        return [];
      });
      for (const item of data) {
        for (const { index, target } of organizeFields) {
          const rawValue = item[index];
          const values: unknown[] = Array.isArray(rawValue) ? rawValue : [rawValue];
          for (const value of values) {
            if (value !== undefined && value !== null && value !== "") target.add(String(value));
          }
        }
      }
      const [accountNameById, departmentNameById] = await Promise.all([
        this.organizeCache.resolveUserDisplayNames(Array.from(accountIds)),
        this.organizeCache.resolveDepartmentNames(Array.from(departmentIds)),
      ]);
      const rows = data.map(item => {
        // row [ 1, '张三', true]
        const row = {};
        for (let j = 0; j < table.fields.length; j++) {
          const field = table.fields[j];
          const key = field.uid;
          const type = field.revisedType || field.type;
          let value: any = item[j];
          switch (type) {
          case 'string':
            value = value instanceof Date ? dayjs(value as unknown as Date).format('YYYY-MM-DD HH:mm:ss') :  String(value ?? '');
            break;
          case 'number':
            value = value instanceof Date ? value.valueOf() : parseFloat(String(value));
            break;
          case 'array':
            if (!Array.isArray(value)) {
              if (value === undefined || value === null) {
                value = [];
              } else {
                value = String(value).split(',');
              }
            }
            break;
          // case 'object':
          //   value = item[j];
          //   break;
          }

          const valueOfEntity = this.transformFormData(field, value, accountNameById, departmentNameById);
          const needAddEntity = (isSystemField(field) && [SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.UPDATE_OWNER, SystemField.CURRENT_OWNER].includes(field.meta.name as any))
            || (field.meta?.subType === 'account' || field.meta?.subType === 'department');
          if (needAddEntity) {
            row[`${key}_entity`] = valueOfEntity;
          }

          row[key] = transformFormData ? valueOfEntity : value;
        }
        if (Array.isArray(item)) {
          for (const extraEntry of item.slice(table.fields.length)) {
            if (!Array.isArray(extraEntry) || extraEntry.length < 2) {
              continue;
            }
            const [key, value] = extraEntry;
            if (typeof key !== 'string' || key in row) {
              continue;
            }
            row[key] = value;
          }
        }
        return row;
      })

      const bucket: Bucket = {
        tableName: table.alias,
        tableId: table.uid,
        fields: table.fields,
        rows,
        count,
      };
      buckets.push(bucket);
    }
    return buckets;
  }

}
