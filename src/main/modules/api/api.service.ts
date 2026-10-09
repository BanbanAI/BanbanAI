import { Injectable, Inject } from '@nestjs/common';
import { NOCODES_DIR, UPLOADS_DIR } from '@main/constants';
import { getNocodeBody } from '@main/utils';
import { FormDataStage, getFormulaStr, getUUIDSystemField, hasConfiguredValue, isInternalField, isSystemField, rowsDefaultValueCalculation, SystemField, transformBucketRows } from '@common/utils';
import {
  getNocodeDataSourceTableByOptionTableUID,
  getNocodeDataSourceTableByUID,
} from '@common/utils/connection';
import { ConnectionUtils } from '../project/connection.utils';
import { unique } from '@common/utils/unique';
import { Bucket, Field, FieldUID, OptionFieldUID, PageOptions, QueryOptions, Row, SortType, Table, TableUID, WhereCondition } from '@common/types/project';
import { CatalogViewSetting, NocodeFormData, TOCTreeNode } from '@common/types/nocode';
import { FormDataService } from '../formData/form-data.service';
import { ApiSearchOption, ApiQueryOption, CustomFSOptions, QueryAlias, QueryPagination, QueryPopulate, QuerySort } from './type';
import { HandleDataResult } from '@common/types/connector';
import { EntityManager } from '@mikro-orm/core';
import { jieba } from '@main/utils/jieba';
import { Nocode as NocodeEntity, NocodeRepository } from '@main/modules/project/entities';
import { RequestStorage } from '@main/middleware';
import { isEmpty } from '@common/utils/object';
import path from 'path';
import { cp, mkdir, rm } from 'fs/promises';
import { getFileMd5 } from '@main/utils/md5';
import { ProjectService } from '../project/project.services';
import { OrganizeCacheService } from '../workbench/organize-cache.service';

@Injectable()
export class ApiService {
  private readonly nocodeRepository: NocodeRepository;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly connectionUtils: ConnectionUtils,
    private readonly formDataService: FormDataService,
    private readonly projectService: ProjectService,
    private readonly organizeCache: OrganizeCacheService,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
  ) {
    this.nocodeRepository = this.entityManager.getRepository(NocodeEntity);
  }

  private async resolveTableSourceContext(appId: string, formId: TableUID, fillSubTableFields = false) {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(appId);
    const sourceData = getNocodeDataSourceTableByUID(nocodeBody, formId, { nocodeId: appId }, fillSubTableFields);
    const sourceAppId = sourceData?.connection?.nocodeId || appId;
    const req = RequestStorage.current?.req;
    if (sourceAppId !== appId && req?.account && !await this.projectService.canViewNocode(sourceAppId, req)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    return {
      nocodeBody,
      connection: sourceData?.connection as NocodeFormData,
      table: sourceData?.table,
      sourceAppId,
    };
  }

  private getApiReadOptions() {
    const authenticated = Boolean(RequestStorage.current?.req?.account);
    return {
      enforceFieldReadAuth: authenticated,
      skipReadPermission: !authenticated,
    };
  }

  private async getReadableFields(appId: string, formId: TableUID, table: Table) {
    if (!RequestStorage.current?.req?.account) {
      return table.fields;
    }
    const readableFieldIds = new Set(await this.formDataService.getApiReadableFieldIds(appId, formId));
    return table.fields.filter(field => readableFieldIds.has(field.uid));
  }

  private showedSystemFieldArr: Array<{ alias: string, fieldMetaName: SystemField }> = [{
    alias: 'id',
    fieldMetaName: SystemField.UUID
  }, {
    alias: 'updateTime',
    fieldMetaName: SystemField.UPDATE_TIME
  }, {
    alias: 'createTime',
    fieldMetaName: SystemField.CREATE_TIME
  }, {
    alias: 'creator',
    fieldMetaName: SystemField.CREATE_OWNER
  }, {
    alias: 'dataOwner',
    fieldMetaName: SystemField.DATA_OWNER
  }, {
    alias: 'status',
    fieldMetaName: SystemField.STATUS
  }]

  private relatedUserArr: SystemField[] = [
    SystemField.CREATE_OWNER,
    SystemField.DATA_OWNER,
    SystemField.UPDATE_OWNER,
  ]

  private populateJudger: Function[] = [
    (field: Field) => field.meta.subType === 'related',
    (field: Field) => field.meta.subType === 'subForm',
    (field: Field) => this.relatedUserArr.indexOf(field.meta.name as SystemField) !== -1
  ];

  private getDefaultReadableStageCondition(): QueryOptions['stage'] {
    return {
      $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
    };
  }

  private _convertData(allFields: Field[], rows: Row[], fields?: Field[], populate?: FieldUID[]) {
    return rows.map(row => {
      const newRow = {};
      if (!fields) fields = allFields.filter(field => !isInternalField(field));
      for (const [uid, value] of Object.entries(row)) {
        const field = allFields.find(f => f.uid === uid);
        const showedSystemField = field && this.showedSystemFieldArr.find(item => item.fieldMetaName === field.meta.name);
        const isShowedField = fields.some(f => f.uid === uid);

        if (isShowedField && !isSystemField(field)) {
          // 在过滤的fields中且非系统字段
          newRow[field.alias] = value;

        } else if (isShowedField && showedSystemField) {
          // 在过滤的fields中且为showedSystemField
          newRow[showedSystemField.alias] = value;

        } else if (populate?.includes(uid as FieldUID)) {
          // 在populate中的字段
          if (showedSystemField) {
            newRow[showedSystemField.alias] = value;
          } else {
            const populateField = allFields.find(f => f.uid === uid);
            newRow[populateField.alias] = value;
          }
        }
      }
      return newRow;
    })
  }

  private _reConvertData(table: Table, rows: Row[], tables?: Table[]) {
    const allFields = table.fields;
    return rows.map(row => {
      const aliasKeys: QueryAlias[] = Object.keys(row);
      const uidKeys: FieldUID[] = this._aliasToUid(allFields, aliasKeys);
      const transformedRow = aliasKeys.reduce((prev, item, index) => {
        const field = allFields.find(item => item.uid === uidKeys[index]);
        const subTableUID = field?.meta?.extra?.subTableUID;
        if (tables && subTableUID) {
          const subTable = tables.find(t => t.uid === subTableUID[1]);
          prev[uidKeys[index]] = this._reConvertData(subTable, row[item], tables);
        } else {
          prev[uidKeys[index]] = row[item];
        }
        return prev;
      }, {});
      return transformedRow;
    })
  }

  private _aliasToUid(fields: Field[], aliasArr: QueryAlias[]): FieldUID[] {
    return aliasArr.map(alias => {
      let fieldUid: any = alias;
      let af = this.showedSystemFieldArr.find(item => item.alias === alias);
      if (af) {
        const field = fields.find(f => f.meta.name === af.fieldMetaName);
        field && (fieldUid = field.uid);
      } else {
        const field = fields.find(f => f.alias === alias);
        if (field) {
          fieldUid = field.uid
        }
      }
      return fieldUid;
    })
  }

  private processTreeData(
    catalogBucket: Bucket,
    selfBucket: Bucket,
    catalogReadableFieldIds?: Set<string>,
    selfReadableFieldIds?: Set<string>,
  ) {

    // 筛选需展示的字段
    const getShowedFields = (fields: Field[]) => {
      let uuidField = fields.find(item => item.meta.name === SystemField.UUID);
      let relatedField = fields.find(item => item.meta.subType === 'related');
      let dataTitleField = fields.find(item => item.meta.name === SystemField.DATA_TITLE);
      let sortField = fields.find(item => item.meta.name === SystemField.SORT);
      let createTimeField = fields.find(item => item.meta.name === SystemField.CREATE_TIME);
      let updateTimeField = fields.find(item => item.meta.name === SystemField.UPDATE_TIME);

      return { uuidField, relatedField, dataTitleField, sortField, createTimeField, updateTimeField }
    }

    let { uuidField, relatedField, dataTitleField, sortField, createTimeField, updateTimeField } = getShowedFields(catalogBucket.fields);
    let catalogMap = {};
    const canReadField = (field: Field, readableFieldIds?: Set<string>) => (
      !readableFieldIds || readableFieldIds.has(field?.uid)
    );

    for (const row of catalogBucket.rows) {
      catalogMap[row[uuidField.uid]] = {
        id: row[uuidField.uid],
        title: canReadField(dataTitleField, catalogReadableFieldIds) ? row[dataTitleField?.uid] : undefined,
        type: 'catalog',
        createTime: canReadField(createTimeField, catalogReadableFieldIds) ? row[createTimeField?.uid] : undefined,
        updateTime: canReadField(updateTimeField, catalogReadableFieldIds) ? row[updateTimeField?.uid] : undefined,
        sort: row[sortField.uid],
        children: []
      };
    }

    let tree: TOCTreeNode[] = [];
    for (const row of catalogBucket.rows) {
      const parentId = row[relatedField.uid] && row[relatedField.uid][0];
      if (parentId && catalogMap[parentId]) {
        catalogMap[parentId].children.push(catalogMap[row[uuidField.uid]]);
      } else {
        // 如果没有父节点，则作为根节点
        tree.push(catalogMap[row[uuidField.uid]]);
      }
    }

    ({ uuidField, relatedField, dataTitleField, sortField, createTimeField, updateTimeField } = getShowedFields(selfBucket.fields));
    for (const row of selfBucket.rows) {
      const node: TOCTreeNode = {
        id: row[uuidField.uid],
        title: canReadField(dataTitleField, selfReadableFieldIds) ? row[dataTitleField?.uid] : undefined,
        type: 'document',
        createTime: canReadField(createTimeField, selfReadableFieldIds) ? row[createTimeField?.uid] : undefined,
        updateTime: canReadField(updateTimeField, selfReadableFieldIds) ? row[updateTimeField?.uid] : undefined,
        sort: row[sortField.uid]
      }
      if (row[relatedField.uid][0]) {
        catalogMap[row[relatedField.uid][0]].children.push(node);
      } else {
        // 没有所在目录的文档直接push进tree数组
        tree.push(node);
      }
    }
    tree = this.sortTree(tree);
    return tree;
  }

  private sortTree(nodes: TOCTreeNode[]) {
    nodes.sort((a, b) => a.sort - b.sort);
    nodes.forEach(node => {
      delete node.sort;
      if (node.children && node.children.length > 0) {
        node.children = this.sortTree(node.children);
      }
    });

    return nodes;
  }

  private _reConvertFilter(filter: WhereCondition, table: Table, tables: Table[]) {
    if (Array.isArray(filter)) {
      return filter.map(item => this._reConvertFilter(item, table, tables));
    } else if (filter instanceof Object) {
      return Object.entries(filter).reduce((prev, [key, value]) => {
        if (key === "$or" || key === "$and") {
          prev[key] = value?.map(item => this._reConvertFilter(item, table, tables));
        } else if (key === "$not") {
          prev[key] = this._reConvertFilter(value, table, tables);
        } else {
          const [ uid ] = this._aliasToUid(table.fields, [key]);
          const field = table.fields.find(item => item.uid === uid);
          const subTableUID = field?.meta?.extra?.subTableUID;
          if (tables && subTableUID) {
            // const subTable = tables.find(t => t.uid === subTableUID[1]);
            // TODO 子表单查询的情况还没有，遇到的时候再做
          } else {
            prev[uid] = this._reConvertFilter(value, table, tables);
          }
        }
        return prev;
      }, {});
    }
    return filter;
  }

  private formatFilters(filters: ApiQueryOption['filters'], table: Table, tables): QueryOptions['filters'] {
    if (!filters) filters = {};
    
    const _filters = this._reConvertFilter(filters, table, tables)

    return {
      [table.uid]: [
        _filters
      ]
    };
  }

  private formatSort(qSort: QuerySort | QuerySort[], table: Table): Record<string, SortType> {
    if (typeof qSort === 'string') qSort = [qSort];
    const rSort: Record<string, SortType> = {};
    let fallbackSortType = SortType.ASC;
    for (const iterator of qSort) {
      const sortArr = iterator.split(':');
      if (!sortArr[1]) sortArr[1] = 'asc';
      sortArr[1] = sortArr[1].toUpperCase();
      const [uid]: FieldUID[] = this._aliasToUid(table.fields, [sortArr[0]]);
      const sortType = SortType[sortArr[1]];
      rSort[uid] = sortType;
      fallbackSortType = sortType;
    }
    const uuidField = getUUIDSystemField(table.fields);
    if (uuidField?.uid && rSort[uuidField.uid] === undefined) {
      // 分页查询需要稳定排序，避免相同排序值跨页时出现丢记录和重复记录
      rSort[uuidField.uid] = fallbackSortType;
    }
    return rSort;
  }

  private getDefaultOrderBy(table: Table): Record<string, SortType> {
    const orderBy: Record<string, SortType> = {};
    const createTimeField = table.fields.find(field => field.meta.name === SystemField.CREATE_TIME);
    const uuidField = getUUIDSystemField(table.fields);

    if (createTimeField?.uid) {
      orderBy[createTimeField.uid] = SortType.DESC;
    }
    if (uuidField?.uid) {
      orderBy[uuidField.uid] = SortType.DESC;
    }

    return orderBy;
  }

  private formatPagination(qPagination: QueryPagination): QueryPagination {
    const defaultPageSize = 25;
    const isPositiveNumber = (value: unknown) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) && numberValue > 0;
    };
    const normalizePositiveNumber = (value: unknown, fallback: number) => {
      const numberValue = Number(value);
      return isPositiveNumber(value) ? numberValue : fallback;
    };

    let pageOption: QueryPagination = {};
    if (qPagination?.start != undefined) {
      const limit = normalizePositiveNumber(qPagination?.limit, defaultPageSize);
      pageOption = {
        start: Math.max(0, Number(qPagination?.start) || 0),
        limit,
      };
    } else if (isPositiveNumber(qPagination?.page) || isPositiveNumber(qPagination?.pageSize)) {
      const page = normalizePositiveNumber(qPagination.page, 1);
      const pageSize = normalizePositiveNumber(qPagination.pageSize, defaultPageSize);
      pageOption = {
        start: (page - 1) * pageSize,
        limit: pageSize,
        page,
        pageSize,
      };
    } else {
      pageOption = {
        start: 0,
        limit: defaultPageSize,
        page: 1,
        pageSize: defaultPageSize,
      };
    }
    return pageOption;
  }

  private formatPopulate(allFields: Field[], queryPopulate: QueryPopulate): FieldUID[] {
    let rPopulate: FieldUID[] = [];
    if (queryPopulate === '*') {
      rPopulate = allFields.filter(item => {
        // 判断某字段是否符合populate条件
        return !isInternalField(item) && this.populateJudger.map(judger => judger(item)).some(jr => jr);
      }).map(item => item.uid);
    } else {
      if (typeof queryPopulate === 'string') {
        queryPopulate = [queryPopulate];
      }

      rPopulate = this._aliasToUid(allFields, queryPopulate).filter(uid => {
        const field = allFields.find(item => item.uid === uid);
        return !isInternalField(field);
      });
    }
    return rPopulate;
  }

  private async fillPopulate(rows: Row[], populate: FieldUID[], extraInfo: { table: Table, appId: string, connection: NocodeFormData }) {
    const { table, appId, connection } = extraInfo;
    const populateSet = new Set(populate);
    const fieldByUid = new Map(table.fields.map(field => [field.uid, field]));
    const accountFieldUids = new Set(table.fields
      .filter(field => populateSet.has(field.uid) && this.populateJudger[2](field))
      .map(field => field.uid));
    const accountIds = new Set<string>();
    for (const row of rows) {
      for (const uid of accountFieldUids) {
        const value = row[uid];
        const values = Array.isArray(value) ? value : [value];
        for (const id of values) {
          if (id !== undefined && id !== null && id !== "") accountIds.add(String(id));
        }
      }
    }
    const accountById = new Map(
      (await this.organizeCache.getUsersByIds(Array.from(accountIds))).map(user => [user.id, user]),
    );

    for (const row of rows) {
      for (const [uid, value] of Object.entries(row)) {
        if (!populateSet.has(uid as FieldUID)) continue;
        const field: Field = fieldByUid.get(uid as FieldUID);

        const getFillPopulateData = async (value: any) => {
          // 获取用来填充对应字段的数据
          let result = value;
          if (this.populateJudger[0](field)) {
            const relatedTableUID = field.meta.extra.relatedTableUID[1];
            const relatedRes = await this.loadFormData(appId, relatedTableUID, value);
            result = relatedRes?.data ?? value;

          } else if (this.populateJudger[1](field)) {
            const subTableUID = field.meta.extra.subTableUID[1];
            const subFormTable = connection.tables.find(item => item.uid === subTableUID);
            const relatedDataIdField = subFormTable.fields.find(item => item.meta.name === '_key');
            const UUIDField = getUUIDSystemField(table.fields);
            const filters = { [relatedDataIdField.alias]: { '$in': [row[UUIDField.uid]] } };
            const subTableRes = await this.loadFormDataList(appId, subTableUID, { filters });
            result = subTableRes?.data ?? value;

          } else if (this.populateJudger[2](field)) {
            const account = accountById.get(String(value));
            if (!account) throw new Error("User not found");
            const { id, user, realname } = account;
            result = { id, user, realname };
          }
          return result;
        }

        if (typeof value === 'string') {
          row[uid] = await getFillPopulateData(value);
        } else {
          let rValue = value;
          for (const i in value) {
            rValue[i] = await getFillPopulateData(value[i])
          }
          row[uid] = rValue;
        }
      }
    }
    return rows;
  }

  private async flexsearch(query: string, options: CustomFSOptions) {
    let { table, appId, pagination } = options;
    let dIndex = this.formDataService.getDocumentIndex(`${appId}-${table.uid}`);
    if (!dIndex) await this.formDataService.createFlexsearchIndex(table, appId);
    const searchResult = await this.formDataService.documentSearch(`${appId}-${table.uid}`, {
      query: query ?? "",
      offset: pagination.start,
      limit: pagination.limit,
      merge: true,
      enrich: true,
    });
    return searchResult;
  }

  async loadFormList(appId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    if (!nocodeBody) return { data: [] };
    const connection = nocodeBody.formData;
    const data = connection.tables.filter(table => !table.meta?.extra?.primaryTable).map(table => ({
      id: table.uid,
      name: table.alias
    }));

    return { data };
  }

  async loadFormDataList(appId: string, formId: TableUID, query: ApiQueryOption) {
    const req = RequestStorage.current.req;
    const t0 = Date.now();
    const { connection, table, sourceAppId } = await this.resolveTableSourceContext(appId, formId, true);
    req.timing.getBody = Date.now() - t0;

    const filters: QueryOptions['filters'] = this.formatFilters(query.filters, table, connection.tables);
    const orderBy: Record<string, SortType> = query.sort
      ? this.formatSort(query.sort, table)
      : this.getDefaultOrderBy(table);
    query.pagination = { ...query.pagination, ...this.formatPagination(query.pagination) };
    const pageOption: PageOptions = {
      pageSize: query.pagination.pageSize,
      pageNumber: query.pagination.page,
      start: query.pagination.start,
      limit: query.pagination.limit,
    };

    const t1 = Date.now();
    const buckets = await this.formDataService.getData(appId, [formId], {
      orderBy,
      filters,
      ...pageOption,
      stage: this.getDefaultReadableStageCondition(),
      formatData: true,
    }, this.getApiReadOptions());
    req.timing.readData = Date.now() - t1;

    const bucket = buckets[0] || { rows: [], count: 0, fields: [] } as Bucket;
    const readableFields = await this.getReadableFields(sourceAppId, formId, table);

    // fields参数处理
    let needFields: Field[] = readableFields.filter(field => !isInternalField(field));
    if (query.fields) {
      if (typeof query.fields === 'string') query.fields = [query.fields];
      let qFieldUids = this._aliasToUid(table.fields, query.fields);
      needFields = readableFields.filter(item => qFieldUids.indexOf(item.uid) !== -1 && !isInternalField(item));
    }

    // populate参数处理，填充row中符合populateJudger的字段
    let populateRows: Row[] = bucket.rows;
    const needPopulate: FieldUID[] = query.populate && this.formatPopulate(readableFields, query.populate);
    if (needPopulate) {
      const extraInfo = { table, appId: sourceAppId, connection };
      populateRows = await this.fillPopulate(populateRows, needPopulate, extraInfo);
    }

    const data = this._convertData(table.fields, populateRows, needFields, needPopulate);

    return {
      data,
      meta: {
        pagination: {
          page: pageOption.pageNumber,
          pageSize: pageOption.pageSize,
          pageCount: Math.ceil(bucket.count / pageOption.pageSize) || undefined,
          total: bucket.count
        }
      },
    }
  }

  async flexSearchFormDataList(appId: string, formId: TableUID, searchOption: ApiSearchOption) {
    const { table, sourceAppId } = await this.resolveTableSourceContext(appId, formId, true);

    const pagination = this.formatPagination(searchOption.pagination);
    const searchResults = await this.flexsearch(searchOption.query, {
      table,
      appId: sourceAppId,
      pagination: { start: 0, limit: 9999999 },
    });
    const uuidField = getUUIDSystemField(table.fields);
    const searchIds = searchResults
      .map(result => result?.doc?.[uuidField?.uid])
      .filter(Boolean);
    const buckets = searchIds.length
      ? await this.formDataService.getData(appId, [formId], {
        filters: {
          [formId]: [{ [uuidField.uid]: { $in: searchIds } }],
        },
        stage: this.getDefaultReadableStageCondition(),
        formatData: true,
      }, this.getApiReadOptions())
      : [];
    const readableFields = await this.getReadableFields(sourceAppId, formId, table);
    const readableRowMap = new Map(
      (buckets[0]?.rows || []).map(row => [row[uuidField.uid], row]),
    );
    const readableRows = searchIds.map(id => readableRowMap.get(id)).filter(Boolean);
    const rows = readableRows.slice(pagination.start, pagination.start + pagination.limit);
    const data = this._convertData(table.fields, rows, readableFields);

    return {
      data,
      meta: {
        tokens: jieba.cut(searchOption.query),
        pagination: {
          page: pagination?.page ? pagination.page : undefined,
          pageSize: pagination?.pageSize ? pagination.pageSize : undefined,
          start: pagination?.start ? pagination.start : undefined,
          limit: pagination?.limit ? pagination.limit : undefined,
          pageCount: pagination.pageSize ? Math.ceil(readableRows.length / pagination.pageSize) || undefined : undefined,
          total: readableRows.length
        }
      }
    }
  }

  private async loadFormData(appId: string, formId: string, id: string) {
    const { table, sourceAppId } = await this.resolveTableSourceContext(appId, formId as TableUID, true);
    const uuidField = getUUIDSystemField(table.fields);
    const buckets = await this.formDataService.getData(appId, [formId], {
      filters: {
        [formId]: [
          { [uuidField.uid]: id },
        ],
      },
      stage: this.getDefaultReadableStageCondition(),
      formatData: true,
    }, this.getApiReadOptions());
    const rows = buckets[0]?.rows || [];
    const readableFields = await this.getReadableFields(sourceAppId, formId as TableUID, table);
    const data = this._convertData(table.fields, rows, readableFields);
    return {
      rows,
      data: data[0],
      meta: {},
    }
  }

  async loadFormDataRow(appId: string, formId: string, id: string, query?: ApiQueryOption) {
    const { connection, table, sourceAppId } = await this.resolveTableSourceContext(appId, formId as TableUID, true);
    const { rows, meta } = await this.loadFormData(appId, formId, id);
    const readableFields = await this.getReadableFields(sourceAppId, formId as TableUID, table);
    // fields参数处理
    let needFields: Field[] = readableFields.filter(field => !isInternalField(field));
    if (query?.fields) {
      if (typeof query.fields === 'string') query.fields = [query.fields];
      let qFieldUids = this._aliasToUid(table.fields, query.fields);
      needFields = readableFields.filter(item => qFieldUids.indexOf(item.uid) !== -1 && !isInternalField(item));
    }
    let populateRows = rows;
    const needPopulate: FieldUID[] = query?.populate && this.formatPopulate(readableFields, query.populate);
    if (needPopulate) {
      const extraInfo = { table, appId: sourceAppId, connection };
      populateRows = await this.fillPopulate(populateRows, needPopulate, extraInfo);
    }
    const data = this._convertData(table.fields, populateRows, needFields, needPopulate);
    return {
      data: data[0],
      meta,
    }
  }

  async loadFormDataTree(appId: string, formId: TableUID, query: ApiQueryOption) {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(appId);
    const { connection, table, sourceAppId } = await this.resolveTableSourceContext(appId, formId, true);
    const sourceBody = sourceAppId === appId
      ? nocodeBody
      : await this.projectService.getNocodeBodyWithOtherDataSources(sourceAppId);

    // 获取关系字段
    const documentViewSetting: CatalogViewSetting = sourceBody.views[table.uid]?.find(item => item.type === 'document') as CatalogViewSetting;
    const relatedField: Field = table.fields.find(item => item.uid === documentViewSetting.catalogFieldUID);
    const sortField = table.fields.find(item => item.meta.name === SystemField.SORT);

    const relatedTableUID = relatedField.meta.extra.relatedTableUID[1];
    const relatedTableSource = getNocodeDataSourceTableByOptionTableUID(
      sourceBody,
      relatedField.meta.extra.relatedTableUID,
      { nocodeId: sourceAppId },
      true,
    );
    if (!relatedTableSource?.table) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    const catalogSortField = relatedTableSource?.table?.fields.find(item => item.meta.name === SystemField.SORT);
    if (!catalogSortField) {
      throw new Error('catalog sort field not found');
    }
    const catalogOrderBy: Record<string, SortType> = { [catalogSortField.uid]: SortType.ASC };
    const relatedSourceAppId = relatedTableSource?.connection?.nocodeId || sourceAppId;
    const treeReadOptions = {
      ...this.getApiReadOptions(),
      enforceFieldReadAuth: false,
    };
    const catalogPromise = this.formDataService.getData(relatedSourceAppId, [relatedTableUID], {
      orderBy: catalogOrderBy,
      stage: this.getDefaultReadableStageCondition(),
      formatData: true,
    }, treeReadOptions);

    const selfOrderBy: Record<string, SortType> = { [sortField.uid]: SortType.ASC };
    const selfFilters: QueryOptions['filters'] = this.formatFilters(query.filters, table, connection.tables);
    const selfPromise = this.formDataService.getData(appId, [formId], {
      orderBy: selfOrderBy,
      filters: selfFilters,
      stage: this.getDefaultReadableStageCondition(),
      formatData: true,
    }, treeReadOptions);

    const [catalogData, selfData] = await Promise.all([catalogPromise, selfPromise]);

    const [catalogReadableFieldIds, selfReadableFieldIds] = RequestStorage.current?.req?.account
      ? await Promise.all([
        this.formDataService.getApiReadableFieldIds(relatedSourceAppId, relatedTableUID),
        this.formDataService.getApiReadableFieldIds(appId, formId),
      ])
      : [undefined, undefined];

    let treeData: TOCTreeNode[] = this.processTreeData(
      catalogData[0] || { rows: [], fields: [] } as Bucket,
      selfData[0] || { rows: [], fields: [] } as Bucket,
      catalogReadableFieldIds ? new Set(catalogReadableFieldIds) : undefined,
      selfReadableFieldIds ? new Set(selfReadableFieldIds) : undefined,
    );
    return {
      data: treeData,
      meta: {},
    };
  }

  async defaultValueFormulaCalculation(transformedRow: Row, table: Table, connection: NocodeFormData, mode: 'add' | 'update') {
    const formulaFields = []
    const defaultFields = []
    for(const field of table.fields) {
      if(isSystemField(field)) continue
      if(Object.keys(transformedRow).includes(field.uid)) continue
      if(field.meta?.extra?.widgetType === "widget.form.subform") continue
      const extra = field?.meta?.extra
      if((extra?.defaultValueType == 'custom' || extra?.linkType == 'form') && hasConfiguredValue(extra?.defaultValue) && mode === 'add') {
        defaultFields.push(field);
      } else if(extra?.defaultValueType == 'formula' && !isEmpty(getFormulaStr(extra?.formula))) {
        formulaFields.push(field);
      }
    }
    try {
      rowsDefaultValueCalculation([transformedRow], {formulaFields, defaultFields}, table, connection);
    } catch (err) {
      console.error(`rows calculation error:`, err);
    }
    for(const field of table.fields) {
      if(field.meta?.extra?.widgetType != "widget.form.subform") continue
      const subTable = connection.tables?.find(t => t.uid === field.meta?.extra?.subTableUID?.[field.meta?.extra?.subTableUID?.length - 1] as TableUID)
      try {
        this.formDataService.subRowsDefaultValueCalculation([transformedRow], field.uid, subTable.fields, table, connection, mode);
      } catch (err) {
        console.error(`subRows calculation error:`, err);
      }
    }
  }

  async createLoadFormData(appId: string, formId: TableUID, row: Row) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    const connection = nocodeBody.formData;
    const table = connection.tables?.find(t => t.uid === formId);

    const [transformedRow] = this._reConvertData(table, [row], connection.tables);
    const uuidField: Field = getUUIDSystemField(table.fields);
    await this.formDataService.assertApiFieldsEditable(
      appId,
      formId,
      Object.keys(transformedRow) as FieldUID[],
    );

    // row中未传入uuid字段或传入的uuid在库中无数据记录，则新建；否则更新已有数据
    let res: HandleDataResult;
    let mode
    if(!transformedRow[uuidField.uid]) {
      mode = 'add'
    } else {
      const { buckets } = await this.connectionUtils.readConnectionData(connection, false, appId, unique(), {}, {
        tableUIDs: [formId],
        queryOptions: {
          filters: {
            [formId]: [
              { [uuidField.uid]: transformedRow[uuidField.uid] },
            ]
          },
          stage: this.getDefaultReadableStageCondition(),
          formatData: true,
        }
      });
      if(buckets[0].rows.length === 1) {
        mode = 'update'
      } else if(buckets[0].rows.length === 0) {
        mode = 'add'
      }
    }
    if(!mode) return res
    await this.defaultValueFormulaCalculation(transformedRow, table, connection, mode);
    const keys: OptionFieldUID[] = [[connection.uid, table.uid, uuidField.uid]];
    if (mode === 'update') {
      res = await this.formDataService.tryUpdateData(connection, appId, formId, [transformedRow], keys);
    } else if (mode === 'add') {
      res = await this.formDataService.addData(connection, appId, formId, [transformedRow]);
    }
    return res;
  }

  async editLoadFormData(appId: string, formId: TableUID, docId: string, row: Row) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    const connection = nocodeBody.formData;
    const table = connection.tables?.find(t => t.uid === formId);

    const [transformedRow] = this._reConvertData(table, [row], connection.tables);
    const uuidField: Field = getUUIDSystemField(table.fields);
    transformedRow[uuidField.uid] = docId;
    await this.formDataService.assertApiFieldsEditable(
      appId,
      formId,
      Object.keys(transformedRow) as FieldUID[],
    );
    await this.defaultValueFormulaCalculation(transformedRow, table, connection, 'update');
    const keys: OptionFieldUID[] = [[connection.uid, table.uid, uuidField.uid]];
    const res = await this.formDataService.tryUpdateData(connection, appId, formId, [transformedRow], keys);
    return res;
  }

  async editLoadFormDataByFilter(appId: string, formId: TableUID,  query: ApiQueryOption, row: Row): Promise<HandleDataResult> {
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    const formData = nocodeBody.formData;
    const table = formData.tables?.find(t => t.uid === formId);
    const uuidField: Field = getUUIDSystemField(table.fields);
    const [transformedRow] = this._reConvertData(table, [row], formData.tables);
    await this.formDataService.assertApiFieldsEditable(
      appId,
      formId,
      Object.keys(transformedRow) as FieldUID[],
    );
    const filters: QueryOptions['filters'] = this.formatFilters(query.filters, table, formData.tables);
    const data = await this.formDataService.distinct(appId, formId, uuidField.uid, {
      filters
    });
    if (isEmpty(data)) {
      return {
        tableName: table.alias,
        data: [],
        success: true,
      };
    }
    transformedRow[uuidField.uid] = data[0];
    await this.defaultValueFormulaCalculation(transformedRow, table, formData, 'update');
    const keys: OptionFieldUID[] = [[formData.uid, table.uid, uuidField.uid]];
    const res = await this.formDataService.tryUpdateData(formData, appId, formId, [transformedRow], keys);
    let rows: Row[];
    if (res.success) {
      rows = transformBucketRows(table.fields, res.data);
      rows = this._convertData(table.fields, rows);
    }
    return {
      ...res,
      tableName: table.alias,
      data: rows,
    }
  }

  async deleteLoadFormData(appId: string, formId: TableUID, docId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    const connection = nocodeBody.formData;
    const table = connection.tables?.find(t => t.uid === formId);

    const uuidField: Field = getUUIDSystemField(table.fields);
    const transformedRow: Row = { [uuidField.uid]: docId };
    const keys: OptionFieldUID[] = [[connection.uid, table.uid, uuidField.uid]];
    const res = await this.formDataService.tryDeleteData(connection, appId, formId, [transformedRow], keys);
    return res;
  }

  async uploadFile(file: any, appId: string) {
    const uploadTargetDir = path.join(this.uploadsDir, appId);
    await mkdir(uploadTargetDir, { recursive: true });

    try {
      const fileMd5 = await getFileMd5(file.path);
      const ext = path.extname(file.originalname);
      const finalFilename = `${fileMd5}${ext}`;
      const uploadFilePath = path.join(uploadTargetDir, finalFilename);

      await cp(file.path, uploadFilePath, { recursive: true });
      await rm(file.path);

      return {
        name: file.originalname,
        uid: Date.now(),
        status: 'success',
        size: file.size,
        url: `uploads/${appId}/${finalFilename}`,
        md5: fileMd5,
      };
    } catch (error) {
      console.error(error);
      return { url: null };
    }
  }
}

