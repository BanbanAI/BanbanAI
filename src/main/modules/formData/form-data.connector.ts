import { FormDataColumn, FormDataOptions, FormDataTable, FormDataTableMeta } from "@common/types/nocode";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { IConnector, ReadOptions, TableData } from "@common/types/connector";
import { Raw, RawData } from "./types";
import { convertWhere, FindOptions, parseTables, rewriteDataOwnerCompatibility, transformWhereCondition } from "./utils";
import { isEmpty } from "@common/utils/object";
import { DbManager } from "./db.manager";
import { FormDataStage, getFlowById, getFlows, mappingSystemFieldAlias, replaceByParams, SystemField } from "@common/utils";
import { Field, FieldMeta, FormDataStageWhereCondition, ProcessNodeStatus, Table } from "@common/types/project";
import { isDataOwnerEnabledTable } from "@common/utils/connection";
import dayjs from "dayjs";
import { FormFlowService } from "./form-flow.service";
import { getNocodeBody } from "@main/utils";
import { NOCODES_DIR } from "@main/constants";
import { MikroORM } from "@mikro-orm/core";
import { OrganizeCacheService } from "../workbench/organize-cache.service";

type FormatDataOptions = {
  nocodeId: string,
  optionTableId: string,
}
type InternalReadOptions = ReadOptions & {
  fieldUIDsMap?: Record<string, string[]>,
}

const buildVirtualDataOwnerField = (): Field => ({
  uid: SystemField.DATA_OWNER as any,
  alias: mappingSystemFieldAlias(SystemField.DATA_OWNER),
  type: "string",
  meta: {
    name: SystemField.DATA_OWNER,
    uid: SystemField.DATA_OWNER as any,
    subType: "account",
    extra: {},
    isSystem: true,
  }
});

const normalizeTableColumns = (table: FormDataTable) => {
  if (isDataOwnerEnabledTable(table)) {
    return table.columns;
  }
  return (table.columns || []).filter(column => column?.name !== SystemField.DATA_OWNER);
};

const buildProjectedColumnKeys = (table: FormDataTable, fieldUIDs: string[] = []) => {
  if (!fieldUIDs.length) return [];
  const columns = normalizeTableColumns(table);
  const fieldUIDSet = new Set(fieldUIDs);
  const projection = columns.flatMap((column) => {
      if (!fieldUIDSet.has(column.uid) && !fieldUIDSet.has(column.name)) {
        return [];
      }
      if (column.isSystem) {
        return column.uid === column.name ? [column.uid] : [column.uid, column.name];
      }
      return [column.uid];
    });
  const requestedProcessField = columns.some((column) => {
    if (!fieldUIDSet.has(column.uid) && !fieldUIDSet.has(column.name)) {
      return false;
    }
    return [
      SystemField.STATUS,
      SystemField.CURRENT_NODE,
      SystemField.CURRENT_OWNER,
    ].includes(column.name as SystemField);
  });
  if (requestedProcessField) {
    projection.push(SystemField.TODO_VERSION);
  }
  return Array.from(new Set(projection));
};

@Injectable()
export class FormDataConnector implements IConnector<FormDataOptions, RawData, FormDataTableMeta, FieldMeta>{
  private readonly logger = new Logger('FormDataConnector');

  constructor(
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly dbManager: DbManager,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    private readonly formFlowService: FormFlowService,
    private readonly organizeCache: OrganizeCacheService,
  ) {}
  async toString(options: FormDataOptions): Promise<string> {
    return `form-data/...`;
  }
  async getDisplayName(): Promise<string> {
    return global.i18next.t('formDataConnector.formData')
  }
  private getSubmittedStageWhereCondition() {
    return {
      $or: [
        { [SystemField.DATA_STAGE]: { $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING] } },
        { [SystemField.DATA_STAGE]: { $exists: false } },
      ],
    };
  }

  private getDefaultReadableStageCondition(): FormDataStageWhereCondition {
    return {
      $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
    };
  }

  private buildStageWhereCondition(stage: FormDataStageWhereCondition) {
    if (stage === FormDataStage.NORMAL) {
      return this.getSubmittedStageWhereCondition();
    }
    return {
      [SystemField.DATA_STAGE]: stage,
    };
  }

  private async generateDataTitle(table: FormDataTable, data: any[]) {
    const columns = table.columns.filter(col => !col.isSystem);
    if (isEmpty(columns)) return { data, columns: table.columns };
    const value = table.extra?.dataTitle?.value;
    const firstColumn = columns.find(col => {
      return ["widget.form.textInput", "widget.form.radioGroup", "widget.form.treeSelect", "widget.form.serialNumber"].includes(col.extra?.widgetType)
    }) || columns[0];
    const column: FormDataColumn = {
      name: SystemField.DATA_TITLE,
      uid: SystemField.DATA_TITLE,
      isSystem: true,
      type: 'string',
    }
    if (!value) {
      column.type = firstColumn?.type;
    }
    if (isEmpty(data)) {
      return { data, columns: [column, ...table.columns] };
    }
    const columnByUid = new Map(columns.map(column => [column.uid, column]));
    const accountColumnIds = new Set<string>();
    if (value) {
      replaceByParams(value, uid => {
        if (columnByUid.get(uid)?.subType === "account") accountColumnIds.add(uid);
        return "";
      });
    } else if (firstColumn?.subType === "account") {
      accountColumnIds.add(firstColumn.uid);
    }
    let accountNameById = new Map<string, string>();
    if (accountColumnIds.size) {
      const accountIds = new Set<string>();
      for (const item of data) {
        for (const uid of accountColumnIds) {
          const ids = Array.isArray(item[uid]) ? item[uid] : [item[uid]];
          for (const id of ids) {
            if (id !== undefined && id !== null && id !== "") accountIds.add(String(id));
          }
        }
      }
      accountNameById = await this.organizeCache.resolveUserDisplayNames(Array.from(accountIds));
    }
    const newData = data.map(item => {
      const title = value ? replaceByParams(value, (uid) => {
        const column = columnByUid.get(uid);
        if (column?.subType === "account") {
          const ids = Array.isArray(item[column.uid]) ? item[column.uid] : [item[column.uid]];
          const names = ids.map(id => accountNameById.get(String(id))).filter(Boolean);
          return names?.join(",") || "";
        }
        return column ? (item[column.uid] || "") : "";
      }) : item[firstColumn?.uid];
      return {
        ...item,
        [SystemField.DATA_TITLE]: title,
      }
    })
    return { data: newData, columns: [column, ...table.columns] };
  }

  async formatData(data: any[], columns: FormDataColumn[], options?: FormatDataOptions) {
    const body = options ? await getNocodeBody(this.nocodesDir, options?.nocodeId) : null;
    const formData = body?.formData;
    const table = formData?.tables?.find(t => t.meta.uid === options.optionTableId);
    const allowDataOwner = Boolean(table && isDataOwnerEnabledTable(table));
    const process = formData?.formOptions?.[table?.uid]?.process;
    const createOwnerColumn = columns.find(column => column.name === SystemField.CREATE_OWNER);
    const dataOwnerColumn = allowDataOwner ? columns.find(column => column.name === SystemField.DATA_OWNER) : undefined;
    return await Promise.all(data.map(async (row) => {
      if (!allowDataOwner) {
        delete row[SystemField.DATA_OWNER];
      }
      for (const column of columns) {
        if (!column?.isSystem || !column?.uid || !column?.name) {
          continue;
        }
        if (row[column.uid] === undefined && row[column.name] !== undefined) {
          row[column.uid] = row[column.name];
        }
        if (row[column.name] === undefined && row[column.uid] !== undefined) {
          row[column.name] = row[column.uid];
        }
      }
      const createOwnerValue = createOwnerColumn?.uid
        ? (row[createOwnerColumn.uid] ?? row[SystemField.CREATE_OWNER])
        : row[SystemField.CREATE_OWNER];
      const dataOwnerValue = dataOwnerColumn?.uid
        ? (row[dataOwnerColumn.uid] ?? row[SystemField.DATA_OWNER])
        : row[SystemField.DATA_OWNER];
      if (
        allowDataOwner
        &&
        createOwnerValue !== undefined
        && createOwnerValue !== null
        && createOwnerValue !== ""
        && (dataOwnerValue === undefined || dataOwnerValue === null || dataOwnerValue === "")
      ) {
        row[SystemField.DATA_OWNER] = createOwnerValue;
        if (dataOwnerColumn?.uid) {
          row[dataOwnerColumn.uid] = createOwnerValue;
        }
      }
      for (const column of columns) {
        const format = column?.extra?.format
        if (column.subType === "switch") {
          let value
          if (format.includes(row[column.uid])) {
            value = row[column.uid];
          } else if ([true, 'true'].includes(row[column.uid])) {
            value = format[0];
          } else {
            value = format[1];
          }
          row[column.uid] = value;
          continue;
        }
        if (!format || !row[column.uid]) continue;
        try {
          if (column.subType === "date") {
            row[column.uid] = dayjs(row[column.uid]).format(format);
          } else if (column.subType === "daterange") {
            row[column.uid] = row[column.uid].map(item => dayjs(item).format(format));
          }
        } catch (err) {
          this.logger.error(`[formatData] format data context table=${table?.meta?.uid || options?.optionTableId} uuid=${row?.[SystemField.UUID]} todoId=${row?.[SystemField.TODO_ID]} columnUid=${column.uid} columnName=${column.name} valueType=${Array.isArray(row[column.uid]) ? "array" : typeof row[column.uid]}`);
          this.logger.error("format data error: ", err);
        }
      }
      try {
        const flows = getFlows(process, row[SystemField.TODO_VERSION] ?? 1);
        if (flows && row[SystemField.STATUS] === ProcessNodeStatus.IN_PROGRESS && !isEmpty(row[SystemField.CURRENT_NODE])) {
          let nodes = row[SystemField.CURRENT_NODE] || [];
          if (!isEmpty(nodes)) {
            if (!Array.isArray(nodes)) nodes = String(nodes).split(',');
            const nodeFlows = nodes.map((id) => getFlowById(flows, id))?.filter(Boolean);
            const flowsOperators = await this.formFlowService.getFlowsPaddingOperators({ nocodeId: options.nocodeId, tableId: table.uid, uuid: row[SystemField.UUID], todoId: row[SystemField.TODO_ID] }, nodeFlows);
            row[SystemField.CURRENT_OWNER] = Array.from(new Set(Object.values(flowsOperators)?.flat(Infinity)));
          }
        } else {
          delete row[SystemField.CURRENT_OWNER];
          delete row[SystemField.CURRENT_NODE];
        }
      } catch (err) {
        this.logger.error(`[formatData] current node context table=${table?.meta?.uid || options?.optionTableId} uuid=${row?.[SystemField.UUID]} todoId=${row?.[SystemField.TODO_ID]} todoVersion=${row[SystemField.TODO_VERSION] ?? 1} status=${row[SystemField.STATUS]} currentNodeType=${Array.isArray(row[SystemField.CURRENT_NODE]) ? "array" : typeof row[SystemField.CURRENT_NODE]}`);
        this.logger.error("format current nodes error: ", err);
      }
      return row;
    }))
  }

  async readOptions(options: FormDataOptions, readOptions: ReadOptions): Promise<RawData> {
    const tableNames = readOptions?.tableNames || options.tables;
    return await Promise.all(tableNames.map((table: FormDataTable | string) => {
      return new Promise<Raw>(async (resolve, reject) => {
        if (typeof table === 'string') {
          table = options.tables.find(t => t.tableName === table);
        }
        try {
          table.columns = normalizeTableColumns(table);
          let isLost = false;
          const findOptions: FindOptions = {};
          const projection = buildProjectedColumnKeys(table, (readOptions as InternalReadOptions)?.fieldUIDsMap?.[table.uid] || []);
          let where = table.where?.enabled ? (table.where.value || {}) : {};
          let stage: FormDataStageWhereCondition = this.getDefaultReadableStageCondition();
          const scope = readOptions?.paging?.scope || "main";
          const enabledStage = readOptions?.paging?.enabledStage !== false;
          if (!isEmpty(readOptions?.paging)) {
            const pageSize = readOptions.paging.pageSize;
            const pageNumber = Math.max(readOptions.paging.pageNumber || 1, 1);
            const start = readOptions.paging.start;
            const limit = readOptions.paging.limit;
            if (pageSize) {
              const offset = (pageNumber - 1) * pageSize;
              findOptions.limit = pageSize;
              findOptions.skip = offset;
            } else if (Number.isInteger(start) && Number.isInteger(limit)) {
              findOptions.skip = start;
              findOptions.limit = limit;
            }
            if (readOptions.paging.orderBy) {
              findOptions.sort = readOptions.paging.orderBy;
            }
            if (readOptions.paging.wheres) {
              const whereConditions = readOptions.paging.wheres[table.uid];
              if (!isEmpty(whereConditions)) {
                const _where = convertWhere(whereConditions);
                Object.assign(where, transformWhereCondition(_where, table.columns));
              }
            }
            if (readOptions.paging.stage) {
              stage = readOptions.paging.stage;
            }
          }
          if (enabledStage) {
            const stageWhere = this.buildStageWhereCondition(stage);
            if (where['$and']) {
              where['$and'].push(stageWhere)
            } else {
              where = {
                $and: [
                  where,
                  stageWhere,
                ]
              }
            }
          }
          if (projection.length) {
            findOptions.projection = projection;
          }
          where = rewriteDataOwnerCompatibility(where);
          const db = await this.dbManager.getDB(options.projectId, table, scope);
          const { count, docs: _data } = await db.findWithCount(where, findOptions);
          const { data, columns } = await this.generateDataTitle(table, _data);
          const format = readOptions.format;
          resolve({
            isLost,
            columns: columns,
            tableName: table.tableName,
            tableUid: table.uid,
            data: format ? await this.formatData(data, columns, {
              nocodeId: options.projectId,
              optionTableId: table.uid,
            }) : data,
            count,
            extra: table.extra,
          });
        } catch (err) {
          this.logger.error(`[readOptions] table error name=${table?.tableName} uid=${table?.uid} projectId=${options?.projectId} scope=${readOptions?.paging?.scope || "main"} pagingEnabled=${Boolean(readOptions?.paging)} hasWheres=${Boolean(readOptions?.paging?.wheres)} hasStage=${readOptions?.paging?.enabledStage !== false}`);
          this.logger.error("readRawData error", table.tableName, err);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      })
    }))
  }

  async parseTables(rawData: RawData): Promise<Omit<Table, "uid">[]> {
    return await parseTables(rawData);
  }
  async findTable(meta: FormDataTableMeta, originTables: Table[], newTables: Table[]): Promise<number> {
    const originMetas = originTables.map(table => table.meta) as FormDataTableMeta[];
    const index = originMetas.findIndex(item => item.uid === meta.uid);
    return index;
  }
  async findField(meta: FieldMeta, originFields: Field[], newFields: Field[]): Promise<number> {
    const originMetas = originFields.map(field => field.meta) as FieldMeta[];
    const index = originMetas.findIndex(item => item.uid === meta.uid);
    return index;
  }
  async transformData(rawData: RawData, tables: Table[]): Promise<TableData[]> {
    let tableData = [];
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      if (!isDataOwnerEnabledTable(table)) {
        table.fields = table.fields.filter(field => field.meta?.name !== SystemField.DATA_OWNER);
      } else if (!table.fields.some(field => field.meta?.name === SystemField.DATA_OWNER)) {
        table.fields = [...table.fields, buildVirtualDataOwnerField()];
      }
      const { meta, fields } = table;
      let data = rawData.find(raw => raw.tableUid === meta.uid);
      if (!data) {
        tableData.push([]);
        continue;
      };
      const systemColumnUIDs = data.columns.filter(column => column.isSystem).map(column => column.uid);
      const value = data.data.map(item => {
        const row = fields.map(field => {
          if (systemColumnUIDs.includes(field.meta.uid)) {
            return item[field.meta.name];
          }
          return item[field.meta.uid];
        })
        // 流程实例的版本号/实例号不在表结构字段里，但前端渲染节点名时需要用到。
        // 这里作为额外字段透传，避免被表字段映射丢掉。
        if (item[SystemField.TODO_ID] !== undefined) {
          row.push([SystemField.TODO_ID, item[SystemField.TODO_ID]]);
        }
        if (item[SystemField.TODO_VERSION] !== undefined) {
          row.push([SystemField.TODO_VERSION, item[SystemField.TODO_VERSION]]);
        }
        return row;
      });

      if (data.count) {
        tableData.push({
          data: value,
          count: data.count,
        })
      } else {
        tableData.push(value);
      }
    }
    return tableData;
  }
}

