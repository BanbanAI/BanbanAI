import { effectScope, EffectScope, reactive, Ref, ref, shallowRef, ShallowRef, toRaw, watch } from "vue";
import { equals, isEmpty } from "@common/utils/object";
import { TableContext, TableProps } from "./types";
import { RelatedData } from "./components/cell";
import { FieldUID, OptionTableUID } from "@common/types/project";
import { FormCondition, RuleFunc } from "@common/types/nocode";
import { getFlowById, getFlows } from "@common/utils/flow";
import { getUUIDSystemField, SystemField } from "@common/utils/connection";
import { usePassportStore } from "@renderer/stores/passport";
import { LogicalOperator } from "@renderer/b2/types";
import { AbstractForm, FormElement } from "@renderer/b2/controllers/form";
import { Board } from "@renderer/b2/controllers/board";
import { resolveWidget } from "@renderer/b2/utils/widget.util";
import { WidgetSoul } from "@common/types/project";
import { Field, FormDataStageWhereCondition, Table as _Table, TableUID, WhereCondition, QueryOptions, SortType, ProcessFlow, ProcessNodeStatus, Row, Bucket } from "@common/types/project";
import { getAllRelatedDepartments, hasPublishedProcess, isAnonymousAccount, isBuiltinField, isSystemField } from "@common/utils";
import { buildTree, formDataApi, OrganizeUtil } from "@renderer/views/nocode/utils";
import axios from "axios";
import { DataPermissionOther, FilterRule, FilterDisplayMode, FormSortField, FormTableRuntime, FormTableViewMeta, NocodeFormData, FormTableRowHeight, NocodeBody, PermissionCategory, FieldPermissionGroupItemType, PermissionRangeType, FormTableColumnOrder } from "@common/types/nocode";
import { Account, Department } from "@common/types/account";
import { loadWidget } from "@renderer/b2/utils/widget.util";
import EventEmitter from "eventemitter2";
import { expandLegacyNoProcessDataPermissionGroups, getDefaultDataPermissionOther, isDataOwnerEnabledTable, normalizeDataPermissionStatus, transformCondition, mappingSystemFieldAlias } from "@common/utils/connection";
import { intersection } from "lodash";
import { ExportType, AggregationType } from '@common/types/nocode';
import i18next from "i18next";
import { getRelatedFields } from "@common/utils/related";
import { cloneDeep as deepClone } from "lodash";
import { assignFieldsAuth } from "@common/utils/element";
import { getTableDatePrecision } from "./date-filter";
import { getBoardConnectionsByNocodeBody, getNocodeDataSourceByUID, getNocodeDataSourceTableByOptionTableUID } from "@common/utils/connection";
import { buildAggregateRuntimeTables, buildBoardConnectionsWithAggregateTables, type AggregateRuntimeSource } from "@renderer/utils/aggregateTable";
import { FormDataStage } from "@common/utils";
import { canReadNocodeTableDataByBody, isPublicDataPermissionBypassedRoute } from "@renderer/views/nocode/utils/data-permission";
import router from "@renderer/router";
import { filterAutoComputeConditions, filterAutoComputeSortFields } from "./column-capability";
import { extendConnectionsWithTableAggregateFields, mergeBucketsWithTableAggregateFields } from "@renderer/utils/tableAggregateField";
import { buildMainAndSubSearchCondition, buildSubTableDisplaySearchCondition } from "./search-filter";
import type { FormDataFindFilterNode, FormDataFindResponse } from "@common/types/form-data-find";
import { combineFormDataFindFilters, convertWhereConditionToFormDataFindFilter, isFormDataFindCapabilityError, normalizeFormDataFindResponse } from "./form-data-find";

export type Column = {
  uid: FieldUID,
  elementId?: string,
  name: string,
  alias: string,
  type?: Field["type"],
  subType: string,
  extra?: any,
  subColumns?: Column[],
  isSubColumn?: boolean,
  paths?: string[],
  tableUID?: TableUID,
  parentUID?: FieldUID,
}
type _TableData = {
  rows: object[],
  total: number,
};

type WaitForInstanceByIdResult =
  | {
    status: "ready";
    instance: FormElement;
  }
  | {
    status: "timeout" | "cancelled";
  };

const passportState = usePassportStore();

const isEmptyFilterValue = (value: unknown) => (
  value === ""
  || (typeof value === "string" && value.trim() === "")
  || isEmpty(value)
);

const isValueOptionalFilter = (func: RuleFunc) => (
  [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY].includes(func)
);

const shouldSkipFilterCondition = (condition: FormCondition) => (
  isEmptyFilterValue(condition.value)
  && !isValueOptionalFilter(condition.func)
);

export class Table implements RelatedData {
  private _showRows: ShallowRef<object[]> = shallowRef(undefined);
  public formData: NocodeFormData;
  public nocodeBody: NocodeBody;
  public organizeUtil: OrganizeUtil;
  public fieldPermissions: FieldPermissionGroupItemType[];
  public emitter: EventEmitter = new EventEmitter();
  public getMainSign?: () => string | undefined;
  public setMainSign?: (sign: string) => void;
  private context: TableContext;
  form: AbstractForm | undefined;
  private _formInitPromise: Promise<AbstractForm | undefined> | null = null;
  private _requestController = new AbortController();
  private _findRefreshController?: AbortController;
  private inlineConnectionData: Record<string, any[]> = reactive({});
  private loadedConnectionBucketKeys: Set<string> = new Set();
  private loadingConnectionBucketPromises: Map<string, Promise<any | undefined>> = new Map();

  constructor(private tableProps: TableProps) {
    this.getOrganizeUsers();
    this.getOrganizeDepartments();
  }
  private _effectScope: EffectScope | null = null;
  private _disposeVersion = 0;
  get effectScope() {
    if (!this._effectScope) {
      this._effectScope = effectScope(true);
    }
    return this._effectScope;
  }

  get uid() {
    return this.tableProps.uid || this.formTableUID;
  }
  
  get formTableUID() {
    return this.tableProps.tableUID;
  }
  get nocodeId() {
    return this.tableProps.nocodeId;
  }

  get widgetNocodeId() {
    return this.tableProps.widgetNocodeId || this.tableProps.nocodeId;
  }

  get table() {
    return this.getTable(this.formTableUID);
  }

  get tables() {
    return this.formData?.tables || [];
  }

  private _tableViewMeta = ref<FormTableViewMeta>({});
  getTableViewMeta<T extends keyof FormTableViewMeta = keyof FormTableViewMeta>(key: T): FormTableViewMeta[T] {
    return this._tableViewMeta.value[key];
  }

  setTableViewMeta<T extends keyof FormTableViewMeta = keyof FormTableViewMeta>(key: T, value: FormTableViewMeta[T]) {
    this._tableViewMeta.value[key] = value;
    this.emitter.emit("update-view-meta", this._tableViewMeta.value);
  }

  get processInfoFolded() {
    return this.getTableViewMeta('processInfoFolded') || false;
  }
  set processInfoFolded(value: boolean) {
    this.setTableViewMeta('processInfoFolded', value);
  }

  init(context: TableContext) {
    this.context = context;
    this.nocodeBody = context.nocodeBody;
    const formData = context.nocodeBody.formData;
    this.fieldPermissions = context.nocodeBody?.permissions?.field?.[this.formTableUID]?.[PermissionCategory.GET];
    this.formData = formData;
    this.organizeUtil = context.organizeUtil;
    this._tableViewMeta.value = context.meta;

    const rule = this.getTableViewMeta("filterRules");
    if (rule) {
      this._filterRules.value = this.sanitizeFilterRuleValue(rule);
    }
    const searchFieldIdsArr = this.getTableViewMeta("searchFieldIds");
    if (searchFieldIdsArr) {
      this._searchFieldIds.value = searchFieldIdsArr;
    }
    this._hiddenColumnIds.value = this.getTableViewMeta("hiddenColumns");
    this._columnOrders.value = this.getTableViewMeta("columnOrders") || {};
    this._sortFields.value = this.sanitizeSortFieldsValue(this.getTableViewMeta("sort") || []);
    const savedPageSize = Math.max(1, Number(this.getTableViewMeta("pageSize")) || 20);
    this._pageSize.value = Math.min(100, savedPageSize);
    if (savedPageSize > 100) {
      this.setTableViewMeta("pageSize", this._pageSize.value);
    }
    this._dataAggregation.value = this.getTableViewMeta("dataAggregation") || {};
    this._relatedSubForm.value = Object.fromEntries(
      Object.entries(deepClone(getRelatedFields(formData, this.table))).filter(([tableId]) => this.canReadLayerDataInTable(tableId))
    );
    this.initWatch();
  }

  private canReadLayerDataInTable(tableId: string) {
    if (this.tableProps.dataPermissionMode === "all") {
      return true;
    }
    return canReadNocodeTableDataByBody(
      this.context?.nocodeBody,
      tableId,
      this.organizeUtil?.departments || [],
      undefined,
      isPublicDataPermissionBypassedRoute(router.currentRoute.value),
    );
  }

  private async initFormInstance() {
    const disposeVersion = this._disposeVersion;
    if (this.form) {
      return this.form;
    }
    const soul = this.formData?.formOptions?.[this.formTableUID]?.widget;
    if (!soul) return;
    let { TheWidget, component } = resolveWidget(soul.type);
    if (!TheWidget || !component) {
      const _widget = await loadWidget(soul.type);
      if (!_widget) {
        console.error("no widget or widget is corrupted", soul.type);
      } else {
        TheWidget = _widget.TheWidget;
        component = _widget.component;
      }
    }
    if (disposeVersion !== this._disposeVersion) return;
    const board = new Board({ type: "board" }, this.getInlineProjectContext() as any);
    board.status.isFormMode = true;
    board.status.isConnectionInited = true;
    this.form = new TheWidget(soul, board) as AbstractForm;
    this.form.setTableUID([this.formData.uid, this.formTableUID]);
    const table = this.getTable(this.formTableUID);
    const fields = table.fields;
    for (const field of fields) {
      const subTableUID: OptionTableUID = field.meta?.extra?.subTableUID;
      if (subTableUID) {
        const subTable = this.getTable(subTableUID[1]);
        if (!subTable) continue;
        field.subTableFields = subTable.fields;
      }
    }
    this.form.bindFields(fields);
    if (disposeVersion !== this._disposeVersion) {
      const form = this.form;
      this.form = undefined;
      form?.destroy();
      if (form) board.unsetInstancedWidget(form.uid);
      board.destroy();
      return;
    }
    return this.form;
  }

  public async ensureFormReady() {
    if (this.form) {
      return this.form;
    }
    if (!this._formInitPromise) {
      // debugger;
      this._formInitPromise = this.initFormInstance().finally(() => {
        this._formInitPromise = null;
      });
    }
    return await this._formInitPromise;
  }

  private buildOptionTableKey(optionTableUID?: OptionTableUID) {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return "";
    return optionTableUID.join(".");
  }

  private getInlineProjectContext() {
    const table = this;
    return {
      typography: "page",
      inNocodeForm: true,
      runtime: this.context?.runtime,
      projectId: "",
      projectName: "",
      get nocodeId() {
        return table.nocodeId;
      },
      get pagePermissionContext() {
        return {
          nocodeBody: table.context?.nocodeBody,
          departments: table.organizeUtil?.departments || [],
          account: passportState.account,
          skipDataPermission: isPublicDataPermissionBypassedRoute(router.currentRoute.value),
        };
      },
      get connectionData() {
        return table.inlineConnectionData;
      },
      get mergedConnectionData() {
        return table.inlineConnectionData;
      },
      getConnections: () => {
        const runtimeSources = table.getAggregateRuntimeSources();
        const connections = buildBoardConnectionsWithAggregateTables(getBoardConnectionsByNocodeBody(table.nocodeBody, {
          nocodeId: table.nocodeId,
        }), runtimeSources);
        return extendConnectionsWithTableAggregateFields(connections, runtimeSources);
      },
      getBoards: () => table.form?.getBoard?.() ? [table.form.getBoard()] : [],
      getNocodeBodyData: () => ({
        formData: table.nocodeBody?.formData,
        otherDataSources: table.nocodeBody?.otherDataSources || [],
      }),
      getElementByUID: (uid: string[]) => {
        return table.form?.getChildElement(uid?.[0]) as any;
      },
      setActiveBoardById: () => {},
      refreshConnectionData: async () => {
        const optionTableUIDs: OptionTableUID[] = Array.from(table.loadedConnectionBucketKeys)
          .map(key => key.split("."))
          .filter((item): item is OptionTableUID => item.length >= 2 && !!item[0] && !!item[1])
          .map(item => [item[0], item[1]]);
        await Promise.all(optionTableUIDs.map(optionTableUID => table.ensureInlineConnectionBucket(optionTableUID, {
          force: true,
        })));
      },
      ensureConnectionBucket: async (optionTableUID: OptionTableUID) => {
        return await table.ensureInlineConnectionBucket(optionTableUID);
      },
      readDataByOptions: async (optionTableUID: OptionTableUID, options: QueryOptions) => {
        return await table.readInlineDataByOptions(optionTableUID, options);
      },
      updateToConnection: async () => ({ success: false } as any),
      addToConnection: async () => ({ success: false } as any),
      removeFromConnection: async () => ({ success: false } as any),
      clone: async () => undefined as any,
    };
  }

  private async readInlineDataByOptions(optionTableUID?: OptionTableUID, options?: QueryOptions) {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return;
    if (!this.canReadLayerDataInTable(optionTableUID[1])) {
      return {
        count: 0,
        rows: [],
      };
    }
    const dataSource = getNocodeDataSourceByUID(this.nocodeBody, optionTableUID[0], {
      nocodeId: this.nocodeId,
    });
    const targetNocodeId = dataSource?.nocodeId || this.nocodeId;
    const sourceUID = optionTableUID[0];
    const sourceInfo = this.getAggregateSourceInfoByTableUID(optionTableUID[1]);
    const aggregateTable = sourceInfo?.aggregateTable;
    const buckets = this.tableProps?.dataPermissionMode === "all"
      ? await formDataApi.getManagedViewTableData({
        nocodeId: targetNocodeId,
        tableUIDs: [aggregateTable?.uid || optionTableUID[1]],
        options,
        widgetUID: this.uid,
        widgetNocodeId: this.widgetNocodeId || this.nocodeId,
        signal: this._requestController.signal,
      })
      : await formDataApi.getData({
        nocodeId: targetNocodeId,
        tableUIDs: [aggregateTable?.uid || optionTableUID[1]],
        options,
        signal: this._requestController.signal,
      });
    return mergeBucketsWithTableAggregateFields(sourceUID, buckets || [], {
      sources: this.getAggregateRuntimeSources(),
    })[0];
  }

  private async ensureInlineConnectionBucket(optionTableUID?: OptionTableUID, config: { force?: boolean } = {}) {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return undefined;
    const bucketKey = this.buildOptionTableKey(optionTableUID);
    if (!bucketKey) return undefined;
    if (!config.force && this.loadedConnectionBucketKeys.has(bucketKey)) {
      return this.inlineConnectionData[optionTableUID[0]]?.find(bucket => bucket.tableId === optionTableUID[1]);
    }
    if (this.loadingConnectionBucketPromises.has(bucketKey)) {
      return await this.loadingConnectionBucketPromises.get(bucketKey);
    }
    const loadingPromise = this.readInlineDataByOptions(optionTableUID).then(bucket => {
      if (!bucket) return undefined;
      if (!this.inlineConnectionData[optionTableUID[0]]) {
        this.inlineConnectionData[optionTableUID[0]] = [];
      }
      const buckets = this.inlineConnectionData[optionTableUID[0]];
      const bucketIndex = buckets.findIndex(item => item.tableId === (bucket as Bucket).tableId);
      if (bucketIndex > -1) {
        buckets.splice(bucketIndex, 1, bucket);
      } else {
        buckets.push(bucket);
      }
      this.loadedConnectionBucketKeys.add(bucketKey);
      return bucket;
    }).finally(() => {
      this.loadingConnectionBucketPromises.delete(bucketKey);
    });
    this.loadingConnectionBucketPromises.set(bucketKey, loadingPromise);
    return await loadingPromise;
  }

  public async prepareEditorDataByElementId(elementId?: string) {
    if (!elementId) return;
    const widget = this.getInstanceById(elementId);
    if (!widget) return;
    if (!["widget.form.treeSelect", "widget.form.treeMultipleSelect"].includes(widget.type)) return;
    const otherTableField = widget.getOption<string>("other-table-field");
    const optionTableUID = otherTableField?.split(".")?.slice(0, 2) as OptionTableUID | undefined;
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return;
    await this.ensureInlineConnectionBucket(optionTableUID);
  }

  private resetInlineConnectionRuntime() {
    Object.keys(this.inlineConnectionData).forEach(key => {
      delete this.inlineConnectionData[key];
    });
    this.loadedConnectionBucketKeys.clear();
    this.loadingConnectionBucketPromises.clear();
  }

  private getAggregateRuntimeSources(): AggregateRuntimeSource[] {
    const sources: AggregateRuntimeSource[] = [];
    if (this.formData?.uid) {
      sources.push({
        uid: this.formData.uid,
        nocodeId: this.nocodeId,
        tables: this.formData.tables || [],
        aggregateTables: this.formData.aggregateTables || [],
      });
    }
    (this.nocodeBody?.otherDataSources || []).forEach(source => {
      if (!source?.uid) return;
      sources.push({
        uid: source.uid,
        nocodeId: source.nocodeId,
        tables: source.tables || [],
        aggregateTables: (source as any).aggregateTables || [],
      });
    });
    return sources;
  }

  private getAggregateSourceInfoByTableUID(tableId: TableUID) {
    const runtimeSources = this.getAggregateRuntimeSources();
    for (const source of runtimeSources) {
      const aggregateTable = (source.aggregateTables || []).find(table => table.uid === tableId);
      if (!aggregateTable) continue;
      return {
        source,
        aggregateTable,
        runtimeSources,
      };
    }
    return undefined;
  }

  private getAggregateRuntimeTable(tableId: TableUID) {
    const sourceInfo = this.getAggregateSourceInfoByTableUID(tableId);
    if (!sourceInfo) return undefined;
    return buildAggregateRuntimeTables(sourceInfo.source, sourceInfo.runtimeSources).find(table => table.uid === tableId);
  }

  private async getData(tableId: TableUID, options: QueryOptions, nocodeId = this.nocodeId) {
    if (!this.canReadLayerDataInTable(tableId)) {
      return {
        tableId,
        tableName: this.getTable(tableId)?.alias || tableId,
        fields: this.getTable(tableId)?.fields || [],
        count: 0,
        rows: [],
      };
    }
    const stage = options?.stage ?? this.getQueryStage(tableId);
    const requestOptions = {
      ...(options || {}),
      ...(stage !== undefined ? { stage } : {}),
    };
    const data = this.tableProps.dataPermissionMode === "all"
        ? await formDataApi.getManagedViewTableData({
          nocodeId,
          tableUIDs: [tableId],
          options: requestOptions,
          widgetUID: this.uid,
          widgetNocodeId: this.widgetNocodeId || this.nocodeId,
          signal: this._requestController.signal,
        })
        : await formDataApi.getData({
          nocodeId,
          tableUIDs: [tableId],
          options: requestOptions,
          signal: this._requestController.signal,
        });
    const table = this.getTable(tableId);
    return data[0] || {
      tableId,
      tableName: table?.alias || tableId,
      fields: table?.fields || [],
      count: 0,
      rows: [],
    };
  }

  private getDefaultQueryStage(tableId: TableUID): FormDataStageWhereCondition | undefined {
    const stage = this.tableProps.queryStage;
    if (stage === undefined) {
      return undefined;
    }
    if (tableId === this.formTableUID) {
      return stage;
    }
    const isSubTable = Array.from(this._subTableUIDs.values()).some((subTableUID) => subTableUID?.[1] === tableId);
    return isSubTable ? stage : undefined;
  }

  public getQueryStage(tableId: TableUID): FormDataStageWhereCondition {
    return this.getDefaultQueryStage(tableId) ?? {
      $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
    };
  }

  getInstanceById(uid: string): FormElement {
    return this.form?.getChildElement(uid);
  }

  public async waitForInstanceById(
    uid: string,
    options: {
      timeoutMs?: number;
      pollMs?: number;
    } = {},
  ): Promise<WaitForInstanceByIdResult> {
    if (!uid) {
      return {
        status: "cancelled",
      };
    }

    const currentInstance = this.getInstanceById(uid);
    if (currentInstance) {
      return {
        status: "ready",
        instance: currentInstance,
      };
    }

    const currentForm = this.form;
    if (!currentForm) {
      return {
        status: "cancelled",
      };
    }

    const {
      timeoutMs = 15000,
      pollMs = 16,
    } = options;
    const startedAt = Date.now();

    return await new Promise<WaitForInstanceByIdResult>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (result: WaitForInstanceByIdResult) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        resolve(result);
      };

      const check = () => {
        if (this.form !== currentForm) {
          finish({
            status: "cancelled",
          });
          return;
        }

        const instance = this.getInstanceById(uid);
        if (instance) {
          finish({
            status: "ready",
            instance,
          });
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          finish({
            status: "timeout",
          });
          return;
        }

        timer = setTimeout(check, pollMs);
      };

      check();
    });
  }

  private getConditionColumn(fieldUID: string) {
    const [columnUID, subColumnUID] = fieldUID?.split(".") ?? [];
    const column = this.allColumns.find(item => item.uid === columnUID);
    if (!column) return null;
    if (!subColumnUID) return column;
    return column.subColumns?.find(item => item.uid === subColumnUID) || null;
  }

  private buildSearchCondition(condition: FormCondition) {
    const column = this.getConditionColumn(condition.uid);
    const [rootUID, subColumnUID] = condition.uid?.split(".") ?? [];
    const rootField = this.getTable(this.formTableUID)?.fields.find(field => field.uid === rootUID);
    const conditionField = subColumnUID
      ? this.getTable(rootField?.meta?.extra?.subTableUID?.[1])?.fields.find(field => field.uid === subColumnUID)
      : rootField;
    const fieldType = column?.type || conditionField?.revisedType || conditionField?.type;
    const fieldId = condition.uid?.split(".")?.at(-1);
    const isArrayField = column?.type === "array"
      || conditionField?.type === "array"
      || conditionField?.revisedType === "array";
    // `$size` is only valid for array fields. Applying it to a scalar field
    // makes the legacy query fail and the connector returns an `isLost`
    // bucket. Keep the array branch in transformCondition and use scalar-safe
    // null/blank checks for main-table and sub-table fields.
    if (
      fieldId
      && fieldType
      && !isArrayField
      && [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY].includes(condition.func)
    ) {
      return condition.func === RuleFunc.EMPTY
        ? { [fieldId]: { $in: ["", null] } }
        : { [fieldId]: { $nin: ["", null] } };
    }
    if (column?.subType === "date") {
      const element = column.elementId ? this.getInstanceById(column.elementId) : undefined;
      return transformCondition({
        ...condition,
        datePrecision: getTableDatePrecision(element, column.extra),
      });
    }
    return transformCondition(condition);
  }

  private sanitizeFilterConditions(ruleConditions: FormCondition[] = []) {
    return filterAutoComputeConditions(ruleConditions, this._columns.value);
  }

  private sanitizeFilterRuleValue(value?: FilterRule): FilterRule {
    return {
      logic: value?.logic || LogicalOperator.AND,
      conditions: this.sanitizeFilterConditions(value?.conditions || []),
    };
  }

  private sanitizeSortFieldsValue(value: FormSortField[] = []) {
    return filterAutoComputeSortFields(value, this._columns.value);
  }

  getTable(uid: TableUID) {
    return this.tables.find(table => table.uid === uid) || this.getAggregateRuntimeTable(uid)
  }

  private getOptionTableContext(optionTableUID?: OptionTableUID) {
    return getNocodeDataSourceTableByOptionTableUID(this.nocodeBody, optionTableUID, {
      nocodeId: this.nocodeId,
    }, true);
  }

  getTableFields(uid: TableUID | OptionTableUID) {
    if (Array.isArray(uid)) {
      return this.getOptionTableContext(uid)?.table?.fields ?? [];
    }
    return this.getTable(uid)?.fields ?? [];
  }

  private _checkboxRow = ref<any[]>()
  public get checkboxRow () {
    return this._checkboxRow.value
  }
  public setCheckboxRow(value: any[]) {
    this._checkboxRow.value = value
  }

  get relatedSubForm() {
    return this._relatedSubForm.value;
  }

  private _fields: ShallowRef<Field[]> = shallowRef([]);
  private _uuidField: ShallowRef<Field> = shallowRef();
  private _data: { rows: ShallowRef<object[]>, total: Ref<number> } = { rows: shallowRef([]), total: ref(0) };

  private _subTableUIDs: Map<FieldUID, OptionTableUID> = new Map();
  private _subTableFields: Map<FieldUID, Field[]> = new Map();
  private _subTableData: Ref<{[fieldUID: FieldUID]: _TableData}> = shallowRef({});
  private _subTableRowIndex: ShallowRef<{ [fieldUID: FieldUID]: Map<any, object[]> }> = shallowRef({});
  private _subTableFieldUIDs: Ref<{fieldUID: FieldUID, relationKey: string}[]> = ref([]);

  private _relatedTableUIDs: Map<FieldUID, { relatedTableUID: OptionTableUID, primaryFieldId?: FieldUID }> = new Map();
  private _relatedTableFields: Map<FieldUID, Field[]> = new Map();
  private _relatedTableData: Ref<{[fieldUID: FieldUID]: _TableData}> = shallowRef({});

  private _columns: ShallowRef<Column[]> = shallowRef([]);

  private isShowProcessFields() {
    const formOptions = this.formData?.formOptions
    if(!formOptions) return false
    const formOption = formOptions[this.formTableUID]
    if(hasPublishedProcess(formOption?.process)) {
      return true
    }
    return false
  }

  private getSystemColumnAlias(field: Field) {
    if (!field) return field?.alias;
    if (this.tableProps.headerVariant === 'recycle') {
      if (field.meta?.name === SystemField.UPDATE_OWNER) {
        return i18next.t('RecycleBinTableHeader.deleteOperator');
      }
      if (field.meta?.name === SystemField.UPDATE_TIME) {
        return i18next.t('RecycleBinTableHeader.deleteTime');
      }
    }
    if (isSystemField(field)) {
      return mappingSystemFieldAlias(field.meta?.name || field.alias);
    }
    return field.alias;
  }

  isRefreshing = ref(false);
  private shouldPrepareFormRuntimeOnInit() {
    if (!isEmpty(this.filterRule?.conditions)) {
      return true;
    }
    if (!isEmpty(this.searchValue)) {
      return true;
    }
    const preFilterRule = this.tableProps.preFilterRule;
    if (!isEmpty(preFilterRule?.conditions)) {
      return true;
    }
    return (this.tableProps.preViewFilterRules || []).some(rule => !isEmpty(rule?.conditions));
  }
  protected initWatch(): void {
    this.effectScope.run(()=>{
      watch(()=>this.formTableUID, (value, oldValue)=>{
        if (equals(value, oldValue)) {
          return;
        }
        this.form = undefined;
        this._formInitPromise = null;
        this.resetInlineConnectionRuntime();
        this.fieldPermissions = this.context?.nocodeBody?.permissions?.field?.[value]?.[PermissionCategory.GET];
        this._subTableUIDs.clear();
        this._subTableFields.clear();
        this._subTableData.value = {};
        this._subTableFieldUIDs.value = [];
        this._relatedTableUIDs.clear();
        this._relatedTableFields.clear();
        this._relatedTableData.value = {};
        this._relatedSubForm.value = {};
        if (!value) {
          this._fields.value = [];
          this._uuidField.value = undefined;
          return;
        }
        // Avoid eagerly creating the full form runtime for large tables when
        // the current table view has no active filter/search conditions.
        // if (this.shouldPrepareFormRuntimeOnInit()) {
        //   this.ensureFormReady();
        // }
        const table = this.getTable(value);
        const fields = this.getTableFields(value);
        this._fields.value = fields;
        this._uuidField.value = getUUIDSystemField(fields);
        this._relatedSubForm.value = deepClone(getRelatedFields(this.formData, table));
        for (const field of fields) {
          const fieldUID = field.uid;
          const { subTableUID, relatedTableUID } = field.meta?.extra ?? {};
          if (subTableUID) {
            this._subTableUIDs.set(fieldUID, subTableUID);
            const subTableFields = this.getTableFields(subTableUID[1]);
            this._subTableFields.set(fieldUID, subTableFields);
            const subTable = this.getTable(subTableUID[1]);
            if (subTable) {
              for (const subField of subTable.fields) {
                const fieldUID = subField.uid;
                const { relatedTableUID } = subField.meta?.extra ?? {};
                if (relatedTableUID && this.canReadLayerDataInTable(relatedTableUID[1])) {
                  this._relatedTableUIDs.set(fieldUID, { relatedTableUID, primaryFieldId: field.uid });
                  const relatedTableFields = this.getTableFields(relatedTableUID);
                  this._relatedTableFields.set(fieldUID, relatedTableFields);
                }
              }
            }
          }
          if (relatedTableUID && this.canReadLayerDataInTable(relatedTableUID[1])) {
            this._relatedTableUIDs.set(fieldUID, { relatedTableUID });
            const relatedTableFields = this.getTableFields(relatedTableUID);
            this._relatedTableFields.set(fieldUID, relatedTableFields);
          }
        }
      }, {immediate: true});
      watch(()=>this._fields.value, (value, oldValue)=>{
        if (equals(value, oldValue)) {
          return;
        }
        if (!value) {
          this._columns.value = [];
          return;
        }
        const allowDataOwner = this.table ? isDataOwnerEnabledTable(this.table) : true;
        const showSystemFields: string[] = this.tableProps.headerVariant === 'recycle'
          ? [
            SystemField.UUID,
            SystemField.DATA_TITLE,
            SystemField.CREATE_OWNER,
            ...(allowDataOwner ? [SystemField.DATA_OWNER] : []),
            SystemField.CREATE_TIME,
            SystemField.UPDATE_OWNER,
            SystemField.UPDATE_TIME,
          ]
          : [
            SystemField.UUID,
            SystemField.DATA_TITLE,
            ...(allowDataOwner ? [SystemField.DATA_OWNER] : []),
            SystemField.CREATE_OWNER,
            SystemField.CREATE_TIME,
            SystemField.UPDATE_OWNER,
            SystemField.UPDATE_TIME,
          ];
        const processFields: string[] = [
          SystemField.STATUS,
          SystemField.CURRENT_NODE,
          SystemField.CURRENT_OWNER
        ]
        const fields = allowDataOwner
          ? (
            value.some(field => field.meta?.name === SystemField.DATA_OWNER)
              ? value
              : [
                ...value,
                    {
                      uid: SystemField.DATA_OWNER,
                      alias: mappingSystemFieldAlias(SystemField.DATA_OWNER),
                      type: 'string',
                      meta: {
                        name: SystemField.DATA_OWNER,
                        uid: SystemField.DATA_OWNER,
                        subType: 'account',
                        extra: {},
                        isSystem: true,
                      },
                    } as unknown as Field,
              ]
          )
          : value.filter(field => field.meta?.name !== SystemField.DATA_OWNER);
        const columns: Column[] = [];
        const systemColumns: Column[] = [];
        const subTableFieldUIDs = [];
        const isShowProcessField = this.isShowProcessFields();
        for (const field of fields ?? []) {
          const column: Column = {
            uid: field.uid,
            name: field.meta?.name,
            alias: this.getSystemColumnAlias(field),
            type: field.revisedType || field.type,
            subType: field.meta?.subType,
            extra: field.meta?.extra,
            tableUID: this.formTableUID,
          };
          if (column.subType === "subForm") {
            const subTableUID = field.meta?.extra?.subTableUID;
            if (subTableUID) {
              const subTableFields = this.getTableFields(subTableUID[1]);
              const relationField = subTableFields.find(f=>f.meta.name === SystemField.KEY);
              subTableFieldUIDs.push({
                fieldUID: field.uid,
                relationKey: relationField?.uid,
              });
              const subColumns: Column[] = [];
              for (const subTableField of subTableFields ?? []) {
                if (subTableField.meta?.name === SystemField.UUID) {
                  subColumns.unshift({
                    uid: subTableField.uid,
                    elementId: subTableField.meta.uid,
                    name: subTableField.meta?.name,
                    alias: subTableField.alias,
                    type: subTableField.revisedType || subTableField.type,
                    subType: subTableField.meta?.subType,
                    extra: subTableField.meta?.extra,
                    paths: [field.meta.uid, subTableField.meta.uid],
                    isSubColumn: true,
                    parentUID: field.uid,
                    tableUID: subTableUID[1],
                  })
                  continue;
                }
                if (isBuiltinField(subTableField)) continue;
                const subColumn: Column = {
                  uid: subTableField.uid,
                  elementId: subTableField.meta.uid,
                  name: subTableField.meta?.name,
                  alias: subTableField.alias,
                  type: subTableField.revisedType || subTableField.type,
                  subType: subTableField.meta?.subType,
                  extra: subTableField.meta?.extra,
                  paths: [field.meta.uid, subTableField.meta.uid],
                  isSubColumn: true,
                  parentUID: field.uid,
                  tableUID: subTableUID[1],
                };
                subColumns.push(subColumn);
              }
              column.subColumns = subColumns;
            }
          }
          if (isBuiltinField(field)) {
            if (([SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.UPDATE_OWNER, SystemField.CURRENT_OWNER] as string[]).includes(field.meta.name)) {
              column.subType = "account";
            }
            if(field.meta.name === SystemField.STATUS) {
              column.subType = "process-status";
            }
            if(field.meta.name === SystemField.CURRENT_NODE) {
              column.subType = "process-node";
            }
            if (showSystemFields.includes(field.meta.name)) {
              systemColumns.push(column);
            }
            if(processFields.includes(field.meta.name) && isShowProcessField) { // 娴佺▼淇℃伅鐩稿叧瀛楁澶勭悊
              systemColumns.push(column);
            }
          } else {
            column.elementId = field.meta?.uid;
            column.paths = [field.meta.uid];
            columns.push(column);
          }
        }
        const orderMap = new Map<string, number>();
        for (let i = 0; i < showSystemFields.length; i++) {
          orderMap.set(showSystemFields[i], i);
        }
        for (let i = 0; i < processFields.length; i++) {
          orderMap.set(processFields[i], 1000 + i);
        }
        systemColumns.sort((a, b) => {
          const aOrder = orderMap.get(a.name) ?? 500;
          const bOrder = orderMap.get(b.name) ?? 500;
          return aOrder - bOrder;
        });
        if (!isEmpty(this.relatedSubForm)) {
          systemColumns.splice(2, 0, {
            name: SystemField.RELATED_SUB_FORM,
            uid: SystemField.RELATED_SUB_FORM as any,
            alias: mappingSystemFieldAlias(SystemField.RELATED_SUB_FORM),
            subType: "relatedSubForm",
          });
        }
        if (!isEmpty(systemColumns)) {
          columns.unshift(systemColumns[0], systemColumns[1]);
          columns.push(...systemColumns.slice(2));
        }
        this._subTableFieldUIDs.value = subTableFieldUIDs;
        this._subTableRowIndex.value = {};
        this._columns.value = columns;
        this.syncHiddenSubTableColumnIds();
      }, {immediate: true});
      watch(()=>{
        if (!this._fields.value?.length) {
          return {};
        }
        const time = this._refreshDataTime.value; // 鏀堕泦鍒锋柊鏃堕棿鍝嶅簲渚濊禆
        const currentPage = this.currentPage; // 鏀堕泦褰撳墠椤电爜鍝嶅簲渚濊禆
        const pageSize = this.pageSize; // 鏀堕泦姣忛〉鏉℃暟鍝嶅簲渚濊禆
        const orderBy = this.sortFieldsMap;
        const topLimit = this.normalizedTopLimit;

        return { time, currentPage, pageSize, orderBy, topLimit };
      }, (value, oldValue)=>{
        if(equals(value, oldValue)) return;
        clearTimeout(this._refreshDataTimer)
        this.isRefreshing.value = true;
        const refreshTask = this._refreshTask;
        this._refreshDataTimer = window.setTimeout(() => {
          void this._refreshData(value, refreshTask);
        }, this._refreshDataTimerMs);
      }, {immediate: true});
    });
  }

  public getSearchRules(type: "main" | "sub") {
    const { logic, conditions } = this.filterRule;
    const preFilterRule = this.tableProps.preFilterRule;
    const preViewFilterRules = this.tableProps.preViewFilterRules || [];
    const mergedPreRules = preFilterRule ? [...preViewFilterRules, preFilterRule] : [...preViewFilterRules];

    const pickConditions = (ruleConditions: FormCondition[] = []) => {
      return this.sanitizeFilterConditions(ruleConditions).filter(c => {
        return c.uid?.split(".").length === (type === "main" ? 1 : 2)
          && (this.tableProps.isFilterEmptyValue ? !shouldSkipFilterCondition(c) : true);
      });
    };
    const buildGroup = (ruleConditions: FormCondition[], ruleLogic: LogicalOperator) => {
      if (isEmpty(ruleConditions)) return undefined;
      const whereConditions = ruleConditions.map(condition => this.buildSearchCondition(condition));
      if (whereConditions.length === 1) return whereConditions[0];
      const logicKey = ruleLogic === LogicalOperator.AND ? "$and" : "$or";
      return { [logicKey]: whereConditions };
    };

    const originBaseConditions = pickConditions(conditions);
    const preRuleGroups = mergedPreRules.map(rule => {
      const ruleConditions = pickConditions(rule?.conditions || []);
      const group = buildGroup(ruleConditions, rule?.logic || LogicalOperator.AND);
      return group ? { group, logic: rule?.logic || LogicalOperator.AND } : null;
    }).filter(Boolean) as { group: WhereCondition, logic: LogicalOperator }[];

    let _logic: LogicalOperator = LogicalOperator.AND;
    if (!isEmpty(originBaseConditions) && !isEmpty(preRuleGroups)) {
      _logic = LogicalOperator.AND
    } else if (!isEmpty(originBaseConditions)) {
      _logic = logic;
    } else if (preRuleGroups.length === 1) {
      _logic = preRuleGroups[0].logic;
    }
    if (type === "main") {
      let result: WhereCondition = {};
      // 鍩虹鏉′欢
      const baseConditions = buildGroup(originBaseConditions, logic);
      // 棰勭疆鏉′欢
      const preConditions = preRuleGroups.map(item => item.group);
      const preRulesConditionsArray = preConditions.length > 1 ? { $and: preConditions } : preConditions?.[0];

      const allConditions = [];
      if (baseConditions) allConditions.push(baseConditions);
      if (preRulesConditionsArray) allConditions.push(preRulesConditionsArray);

      if (allConditions.length > 1) {
        result = { $and: allConditions };
      } else if (allConditions.length === 1) {
        result = allConditions[0];
      }

      return {
        logic: _logic,
        conditions: result,
      }
    } else {
      // 子表条件，返回结果按子表 fieldId 分组
      const result: Record<FieldUID, WhereCondition> = {};
      const queryGroup: Record<string, WhereCondition[]> = {};

      const buildGroupedByField = (ruleConditions: FormCondition[], ruleLogic: LogicalOperator) => {
        const grouped = ruleConditions.reduce<Record<FieldUID, FormCondition[]>>((prev, item) => {
          const arr = item.uid.split(".");
          if (!prev[arr[0]]) prev[arr[0]] = [];
          prev[arr[0]].push(item);
          return prev;
        }, {});
        const groupedResult: Record<FieldUID, WhereCondition> = {};
        for (const fieldId in grouped) {
          const whereConditions = grouped[fieldId].map(condition => this.buildSearchCondition(condition));
          if (!isEmpty(whereConditions)) {
            const subLogicKey = ruleLogic === LogicalOperator.AND ? "$and" : "$or";
            groupedResult[fieldId] = whereConditions.length > 1 ? { [subLogicKey]: whereConditions } : whereConditions?.[0];
          }
        }
        return groupedResult;
      };

      const appendGrouped = (grouped: Record<FieldUID, WhereCondition>) => {
        for (const fieldId in grouped) {
          if (!queryGroup[fieldId]) queryGroup[fieldId] = [];
          queryGroup[fieldId].push(grouped[fieldId]);
        }
      };

      appendGrouped(buildGroupedByField(originBaseConditions, logic));
      mergedPreRules.forEach((rule) => {
        const ruleConditions = pickConditions(rule?.conditions || []);
        const grouped = buildGroupedByField(ruleConditions, rule?.logic || LogicalOperator.AND);
        appendGrouped(grouped);
      });

      for (const fieldId in queryGroup) {
        const whereConditions: WhereCondition[] = queryGroup[fieldId];
        if (!isEmpty(whereConditions)) {
          result[fieldId] = whereConditions.length > 1 ? { $and: whereConditions } : whereConditions?.[0];
        }
      }

      return {
        logic: _logic,
        conditions: result,
      }
    }
  }

  private async getSearchFilterUuid() {
    const searchSubRules = this.searchValue?.filter(c => c.uid?.split(".").length > 1) || [];
    let uuids: string[] = [];
    const promises = [];
    if (!isEmpty(searchSubRules) && this._subTableUIDs.size) {
      const searchQueryGroup = searchSubRules.reduce<Record<FieldUID, WhereCondition[]>>((prev, item) => {
        const arr = item.uid.split(".");
        if (!prev[arr[0]]) prev[arr[0]] = [];
        prev[arr[0]].push(transformCondition(item));
        return prev;
      }, {});
      for (const fieldId in searchQueryGroup) {
        const whereConditions: WhereCondition[] = searchQueryGroup[fieldId];
        if (!isEmpty(whereConditions)) {
          const subConditions = whereConditions.length > 1 ? { $or: whereConditions } : whereConditions?.[0];
          const subTableUID = this._subTableUIDs.get(fieldId as FieldUID);
          if (!subTableUID) continue;
          const [cUID, tableUID ] = subTableUID;
          const table = this.getTable(tableUID);
          const keyField = table?.fields?.find(f => f.meta.name === SystemField.KEY);
          if (!table || !keyField?.uid) continue;
          promises.push(formDataApi.distinct({
            nocodeId: this.nocodeId,
            tableUID,
            columnId: keyField.uid,
            options: {
              stage: this.getQueryStage(tableUID),
              filters: {
                [tableUID]: [subConditions],
              }
            }
          }));
        }
      }
      const uuidGroup = await Promise.all(promises);
      uuids = Array.from(new Set(uuidGroup.flat()));
    }
    return uuids;
  }

  private async getSearchConditions() {
    // 鎼滅储鏉′欢
    let _searchCondition: WhereCondition;
    if (!isEmpty(this.searchValue)) {
      const searchMainRules = this.searchValue.filter(c => c.uid?.split(".").length === 1);
      const searchSubRules = this.searchValue.filter(c => c.uid?.split(".").length > 1);
      const searchWhereConditions = searchMainRules.map(condition => transformCondition(condition))
      const searchMainCondiions = searchWhereConditions?.length > 1 ? { $or: searchWhereConditions } : searchWhereConditions?.[0];
      const searchUuid = await this.getSearchFilterUuid()
      _searchCondition = buildMainAndSubSearchCondition(
        this.rowKey,
        searchMainCondiions,
        searchUuid,
        !isEmpty(searchSubRules),
        LogicalOperator.OR,
      );
    }
    return _searchCondition;
  }

  private mergeWhereConditionsWithAnd(...conditions: (WhereCondition | null | undefined)[]) {
    const validConditions = conditions.filter(condition => !isEmpty(condition)) as WhereCondition[];
    if (!validConditions.length) {
      return {};
    }
    if (validConditions.length === 1) {
      return validConditions[0];
    }
    return {
      $and: validConditions,
    } as WhereCondition;
  }

  private buildMainAndSubFilterCondition(
    mainCondition: WhereCondition | null | undefined,
    subMatchedUUIDs: string[],
    hasSubCondition: boolean,
    logic: LogicalOperator,
  ) {
    return buildMainAndSubSearchCondition(this.rowKey, mainCondition, subMatchedUUIDs, hasSubCondition, logic);
  }
  private async getFilterConditions() {
    const mainRuleInfo = this.getSearchRules("main");
    const subRuleInfo = this.getSearchRules("sub");
    const uuids = await this.getFilteredUuid();

    return this.buildMainAndSubFilterCondition(
      mainRuleInfo.conditions,
      uuids,
      !isEmpty(subRuleInfo.conditions),
      mainRuleInfo.logic,
    ) || {};
  }

  private getSubTableSearchCondition(fieldUID: FieldUID) {
    const searchSubConditions = this.searchValue?.filter(c => c.uid?.split(".").length > 1) || [];
    const searchSubWhereConditions = searchSubConditions
      .filter(c => c.uid.split(".")[0] === fieldUID)
      .map(condition => transformCondition(condition));
    if (searchSubWhereConditions.length > 1) {
      return { $or: searchSubWhereConditions } as WhereCondition;
    }
    return searchSubWhereConditions[0];
  }

  private getSearchMainCondition() {
    const searchMainRules = this.searchValue?.filter(c => c.uid?.split(".").length === 1) || [];
    const searchWhereConditions = searchMainRules.map(condition => transformCondition(condition));
    return searchWhereConditions.length > 1 ? { $or: searchWhereConditions } as WhereCondition : searchWhereConditions?.[0];
  }

  private async getSearchMainMatchedRowKeys(displayRowKeys: unknown[]) {
    const searchMainCondition = this.getSearchMainCondition();
    const keys = Array.from(new Set(displayRowKeys.filter(key => key !== undefined && key !== null)));
    if (!this.rowKey || isEmpty(searchMainCondition) || isEmpty(keys)) {
      return [];
    }

    const filtersData = this.mergeWhereConditionsWithAnd(
      { [this.rowKey]: { $in: keys } } as WhereCondition,
      searchMainCondition,
    );

    return await formDataApi.distinct({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      columnId: this.rowKey,
      options: {
        stage: this.getQueryStage(this.formTableUID),
        filters: {
          [this.formTableUID]: [filtersData],
        }
      }
    }) || [];
  }

  public async getDisplayFilters() {
    const filtersData = this.mergeWhereConditionsWithAnd(
      await this.getFilterConditions(),
      await this.getSearchConditions(),
    );

    return {
      [this.formTableUID]: [filtersData],
    };
  }

  public async getDisplayRowUuids() {
    if (!this.rowKey) {
      return [];
    }
    return await formDataApi.distinct({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      columnId: this.rowKey,
      options: {
        stage: this.getQueryStage(this.formTableUID),
        filters: await this.getDisplayFilters(),
      }
    }) || [];
  }

  public async getSubTableDisplayFilters(fieldUID: FieldUID, subTableUID: TableUID) {
    const table = this.getTable(subTableUID);
    const keyField = table?.fields?.find(f => f.meta.name === SystemField.KEY);
    if (!keyField?.uid) {
      return {
        [subTableUID]: [{}],
      };
    }

    const filtersData = this.mergeWhereConditionsWithAnd(
      {
        [keyField.uid]: {
          $in: await this.getDisplayRowUuids(),
        }
      } as WhereCondition,
      deepClone(this.getSearchRules("sub").conditions?.[fieldUID]),
      this.getSubTableSearchCondition(fieldUID),
    );

    return {
      [subTableUID]: [filtersData],
    };
  }

  private buildFindFilterGroup(conditions: FormCondition[] = [], logic: LogicalOperator) {
    const converted: FormDataFindFilterNode[] = [];
    for (const condition of this.sanitizeFilterConditions(conditions)) {
      if (this.tableProps.isFilterEmptyValue && shouldSkipFilterCondition(condition)) continue;
      const column = this.getConditionColumn(condition.uid);
      const field = column?.tableUID ? this.getTable(column.tableUID)?.fields.find(item => item.uid === column.uid) : undefined;
      if (!column || !field) return { supported: false as const };
      const path = column.isSubColumn
        ? [column.parentUID, column.uid] as [FieldUID, FieldUID]
        : [column.uid] as [FieldUID];
      const result = convertWhereConditionToFormDataFindFilter(this.buildSearchCondition(condition), path, field);
      if (!result.supported) return result;
      if (result.filter) converted.push(result.filter);
    }
    return {
      supported: true as const,
      filter: combineFormDataFindFilters(logic === LogicalOperator.AND ? "and" : "or", converted),
    };
  }

  private buildFindFilter() {
    const groups: FormDataFindFilterNode[] = [];
    const base = this.buildFindFilterGroup(this.filterRule?.conditions || [], this.filterRule?.logic || LogicalOperator.AND);
    if (!base.supported) return { supported: false as const };
    if (base.filter) groups.push(base.filter);
    for (const rule of [
      ...(this.tableProps.preViewFilterRules || []),
      ...(this.tableProps.preFilterRule ? [this.tableProps.preFilterRule] : []),
    ]) {
      const group = this.buildFindFilterGroup(rule?.conditions || [], rule?.logic || LogicalOperator.AND);
      if (!group.supported) return { supported: false as const };
      if (group.filter) groups.push(group.filter);
    }
    const search = this.buildFindFilterGroup(this.searchValue || [], LogicalOperator.OR);
    if (!search.supported) return { supported: false as const };
    if (search.filter) groups.push(search.filter);
    return { supported: true as const, filter: combineFormDataFindFilters("and", groups) };
  }

  private buildFindSelect() {
    const table = this.table;
    if (!table) return { fields: [] as FieldUID[] };
    const hidden = new Set(this.hiddenColumnIds || []);
    const required = new Set<FieldUID>([
      this.rowKey,
      ...this.getOwnerFieldIds(),
      ...Object.keys(this.sortFieldsMap || {}),
    ].filter(Boolean) as FieldUID[]);
    const appendConditionFields = (conditions?: FormCondition[] | null) => conditions?.forEach(condition => {
      const [rootUID] = String(condition?.uid || "").split(".");
      if (rootUID) required.add(rootUID as FieldUID);
    });
    appendConditionFields(this.filterRule?.conditions);
    appendConditionFields(this.tableProps.preFilterRule?.conditions);
    (this.tableProps.preViewFilterRules || []).forEach(rule => appendConditionFields(rule?.conditions));
    appendConditionFields(this.searchValue);
    const fields = table.fields
      .filter(field => !hidden.has(field.uid) || required.has(field.uid) || isSystemField(field))
      .map(field => field.uid);
    const subForms: Record<FieldUID, FieldUID[]> = {};
    for (const parentFieldUID of this.getRequestedSubTableFieldUIDs()) {
      const subTableUID = this._subTableUIDs.get(parentFieldUID)?.[1];
      const subTable = subTableUID ? this.getTable(subTableUID) : undefined;
      if (!subTable) continue;
      const subFields = subTable.fields
        .filter(field => !hidden.has(field.uid) || isSystemField(field))
        .map(field => field.uid);
      if (subFields.length) subForms[parentFieldUID] = subFields;
    }
    return { fields, ...(Object.keys(subForms).length ? { subForms } : {}) };
  }

  private applyFindResponse(response: FormDataFindResponse) {
    const { rows, subTableData, relatedTableData } = normalizeFormDataFindResponse(response, {
      rootTable: this.table,
      subTableUIDs: this._subTableUIDs,
      getTable: tableUID => this.getTable(tableUID as TableUID),
      relatedTableFields: this._relatedTableFields,
    });
    const nextSubTableRowIndex: typeof this._subTableRowIndex.value = {};
    for (const parentFieldUID of Object.keys(subTableData) as FieldUID[]) {
      nextSubTableRowIndex[parentFieldUID] = this.buildSubTableRowIndex(parentFieldUID, subTableData[parentFieldUID].rows);
    }
    this._subTableData.value = subTableData;
    this._subTableRowIndex.value = nextSubTableRowIndex;
    this._relatedTableData.value = relatedTableData;
    return rows;
  }

  private async refreshWithFind(value: { currentPage?: number; pageSize?: number; orderBy?: Record<FieldUID, SortType> }, requestVersion: number) {
    const filter = this.buildFindFilter();
    if (!filter.supported) return false;
    this._findRefreshController?.abort();
    const controller = new AbortController();
    this._findRefreshController = controller;
    const topLimit = this.normalizedTopLimit;
    const safePageSize = Math.min(100, Math.max(1, Number(value?.pageSize) || this.pageSize || 20));
    let safeCurrentPage = Math.max(1, Number(value?.currentPage) || this.currentPage || 1);
    let start = (safeCurrentPage - 1) * safePageSize;
    if (topLimit && start >= topLimit) {
      safeCurrentPage = Math.max(1, Math.ceil(topLimit / safePageSize));
      this.currentPage = safeCurrentPage;
      start = (safeCurrentPage - 1) * safePageSize;
    }
    const limit = topLimit ? Math.min(safePageSize, Math.max(1, topLimit - start)) : safePageSize;
    const orderBy = value?.orderBy || this.sortFieldsMap || {};
    let response: FormDataFindResponse;
    try {
      response = await formDataApi.find({
        nocodeId: this.nocodeId,
        tableUID: this.formTableUID,
        pagination: topLimit ? { start, limit } : { pageNumber: safeCurrentPage, pageSize: safePageSize },
        select: this.buildFindSelect(),
        filter: filter.filter,
        sort: Object.entries(orderBy).map(([fieldUID, direction]) => ({ fieldUID: fieldUID as FieldUID, direction })),
        stage: this.getQueryStage(this.formTableUID),
        ...(this.tableProps.dataPermissionMode === "all" ? {
          context: {
            widgetNocodeId: this.widgetNocodeId,
            widgetUID: this.uid,
          },
        } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (requestVersion !== this._refreshRequestVersion || controller.signal.aborted) return true;
      if (isFormDataFindCapabilityError(error)) return false;
      throw error;
    }
    if (requestVersion !== this._refreshRequestVersion || controller.signal.aborted) return true;
    const rows = this.applyFindResponse(response);
    const ownerIds = this.collectOwnerIdsFromRows(rows);
    const ownerIdSet = new Set(ownerIds);
    const accountIds = this.collectAccountIdsFromRows(rows).filter(id => !ownerIdSet.has(id));
    void this.prefetchAccounts(ownerIds, { status: 'all' });
    void this.prefetchAccounts(accountIds);
    this._data.total.value = topLimit
      ? Math.min(response.pagination.total, topLimit)
      : response.pagination.total;
    if (!equals(rows, this._data.rows.value)) this._data.rows.value = rows;
    return true;
  }

  private async _refreshData(value, refreshTask = this._refreshTask) {
    const requestVersion = ++this._refreshRequestVersion;
    this._findRefreshController?.abort();
    let refreshError: unknown;
    try {
      const { currentPage, pageSize, orderBy } = value ?? {};
      const canUseFind = !isPublicDataPermissionBypassedRoute(router.currentRoute.value)
        && !this.getAggregateSourceInfoByTableUID(this.formTableUID)
        && isEmpty(this.table?.meta?.extra?.primaryTable)
        && (this.table?.uid === this.formTableUID);
      if (canUseFind && await this.refreshWithFind({ currentPage, pageSize, orderBy }, requestVersion)) {
        return;
      }
      const filters = await this.getDisplayFilters();
      const topLimit = this.normalizedTopLimit;
      const requestedPageSize = Math.max(1, Number(pageSize) || this.pageSize || 20);
      const safePageSize = this.tableProps.prePageSize
        ? requestedPageSize
        : Math.min(100, requestedPageSize);
      let safeCurrentPage = Math.max(1, Number(currentPage) || this.currentPage || 1);
      let start = (safeCurrentPage - 1) * safePageSize;
      if (topLimit && start >= topLimit) {
        safeCurrentPage = Math.max(1, Math.ceil(topLimit / safePageSize));
        if (this.currentPage !== safeCurrentPage) {
          this.currentPage = safeCurrentPage;
        }
        start = (safeCurrentPage - 1) * safePageSize;
      }
      const remainingLimit = topLimit ? Math.max(0, topLimit - start) : safePageSize;
      const readOptions = topLimit
        ? {
          start,
          limit: Math.min(safePageSize, remainingLimit),
        }
        : {
          pageSize: safePageSize,
          pageNumber: safeCurrentPage,
        };

      const data = await this.getData(this.formTableUID, {
        ...readOptions,
        orderBy: orderBy,
        filters,
      });
      if (requestVersion !== this._refreshRequestVersion) {
        return;
      }
      if (!data) {
        return;
      }

      const { rows, count } = data;
      const ownerIds = this.collectOwnerIdsFromRows(rows);
      const ownerIdSet = new Set(ownerIds);
      const accountIds = this.collectAccountIdsFromRows(rows).filter(id => !ownerIdSet.has(id));
      void this.prefetchAccounts(ownerIds, { status: 'all' });
      void this.prefetchAccounts(accountIds);
      this._data.total.value = topLimit ? Math.min(count ?? rows.length, topLimit) : (count ?? rows.length);
      if (!equals(rows, this._data.rows.value)) {
        this._data.rows.value = rows;
      }
      const subTableFieldUIDs = this.getRequestedSubTableFieldUIDs();
      await this.readSubTableData(rows, subTableFieldUIDs);
      if (requestVersion !== this._refreshRequestVersion) return;
      await this.readRelatedTableData(rows);
      if (requestVersion !== this._refreshRequestVersion) return;
    } catch (err) {
      if (requestVersion !== this._refreshRequestVersion) return;
      refreshError = err;
      console.error(err);
    } finally {
      if (requestVersion === this._refreshRequestVersion) {
        if (this._refreshTask === refreshTask) {
          if (this._refreshPending && this._fields.value?.length) {
            this._refreshPending = false;
            this._refreshDataTime.value += 1;
          } else {
            this._refreshPending = false;
            this._refreshTask = undefined;
            if (refreshError === undefined || !refreshTask?.reportFailure) {
              refreshTask?.resolve();
            } else {
              refreshTask?.reject(refreshError);
            }
          }
        }
        this.isRefreshing.value = false;
        this._refreshDataTimerMs = 100;
      }
    }
  }
  get fieldsAuth() {
    if (this.tableProps.dataPermissionMode === "all") return "all";
    if (this.context?.runtime === FormTableRuntime.FORM_EDITOR) return "all";
    const account = passportState.account;
    if (account?.isAdmin || !account) return "all";
    if (isEmpty(this.fieldPermissions)) return "all";
    const fieldsAuth: Record<string, number> = {};
    let hasMatchedPermission = false;
    let hasCustomFieldRange = false;
    for (const permission of this.fieldPermissions) {
      if (permission.memberRange.rangeType === PermissionRangeType.CUSTOM) {
        const users = this.organizeUtil.getUsersByOrganizeValue(permission.memberRange.range);
        const userIds = users.map(user => user.id);
        if (!userIds.includes(account.id)) continue;
      }
      hasMatchedPermission = true;
      if (permission.fieldRange.rangeType === PermissionRangeType.ALL) continue;
      hasCustomFieldRange = true;
      const range = permission.fieldRange.range;
      assignFieldsAuth(fieldsAuth, range);
    }
    if (!hasMatchedPermission) return "all";
    if (!hasCustomFieldRange || isEmpty(fieldsAuth)) return "all";
    return fieldsAuth;
  }

  private getCurrentTablePermissions() {
    const currentTable = this.getTable(this.formTableUID);
    const permissions = this.context?.nocodeBody?.permissions?.data?.[currentTable?.uid || this.formTableUID]?.other;
    return isEmpty(permissions)
      ? getDefaultDataPermissionOther()
      : expandLegacyNoProcessDataPermissionGroups(permissions as DataPermissionOther[]);
  }

  private getExpandedDepartmentIds(departmentIds: string[] = []) {
    const expandedDepartmentIds = this.organizeUtil?.getChildDepartmentIdsByIds?.(departmentIds) || [];
    return Array.from(new Set(
      expandedDepartmentIds.filter((departmentId): departmentId is string => typeof departmentId === "string" && !!departmentId),
    ));
  }

  private getSiblingDepartmentIds(departmentIds: string[] = []) {
    const currentDepartmentIds = Array.from(new Set((departmentIds || []).filter(Boolean)));
    if (!currentDepartmentIds.length) {
      return [];
    }

    const departments = this.organizeUtil?.departments || [];
    const parentIds = Array.from(new Set(
      departments
        .filter(department => currentDepartmentIds.includes(department.id))
        .map(department => department.parent)
        .filter(Boolean),
    ));

    return Array.from(new Set(
      departments
        .filter(department => parentIds.includes(department.parent) && !currentDepartmentIds.includes(department.id))
        .map(department => department.id)
        .filter(Boolean),
    ));
  }

  private getSubDepartmentIds(departmentIds: string[] = []) {
    const currentDepartmentIds = new Set((departmentIds || []).filter(Boolean));
    if (!currentDepartmentIds.size) {
      return [];
    }

    return Array.from(new Set(
      (this.organizeUtil?.departments || [])
        .filter(department => currentDepartmentIds.has(department.parent))
        .map(department => department.id)
        .filter(Boolean),
    ));
  }

  private canMatchPermissionMemberRange(permission?: DataPermissionOther, account?: Account) {
    if (!permission || !account) {
      return false;
    }
    if (permission.memberRange?.rangeType === PermissionRangeType.ALL) {
      return true;
    }
    if (permission.memberRange?.range?.users?.includes(account.id)) {
      return true;
    }
    if (permission.memberRange?.range?.roles?.some(roleId => account.roles?.includes(roleId))) {
      return true;
    }

    const matchedDepartmentIds = this.getExpandedDepartmentIds(permission.memberRange?.range?.departments || []);
    return account.departments?.some(departmentId => matchedDepartmentIds.includes(departmentId)) ?? false;
  }

  private getCurrentRowStatusType(row?: Row | null) {
    const currentTable = this.getTable(this.formTableUID);
    if (!currentTable || !row) {
      return "noProcess" as const;
    }
    const statusField = currentTable.fields.find(field => field.meta?.name === SystemField.STATUS);
    const currentNodeField = currentTable.fields.find(field => field.meta?.name === SystemField.CURRENT_NODE);
    const status = row?.[statusField?.uid || SystemField.STATUS];
    const currentNodeValue = row?.[currentNodeField?.uid || SystemField.CURRENT_NODE];
    const hasCurrentNode = Array.isArray(currentNodeValue)
      ? currentNodeValue.length > 0
      : Boolean(currentNodeValue);

    if (status === ProcessNodeStatus.QUEUED || (status === ProcessNodeStatus.IN_PROGRESS && hasCurrentNode)) {
      return "processing" as const;
    }
    if (!status || status === ProcessNodeStatus.NOT_STARTED) {
      return "noProcess" as const;
    }
    return "finished" as const;
  }

  private canMatchPermissionDataStatus(permission?: DataPermissionOther, row?: Row | null) {
    const normalizedStatus = normalizeDataPermissionStatus(permission?.dataStatus);
    const rowStatusType = this.getCurrentRowStatusType(row);
    return !!normalizedStatus?.[rowStatusType];
  }

  private canMatchPermissionDataRange(permission?: DataPermissionOther, row?: Row | null, account?: Account) {
    this._rowPermissionAccountVersion.value;
    if (!permission || !row || !account) {
      return false;
    }
    const currentTable = this.getTable(this.formTableUID);
    if (!currentTable) {
      return false;
    }

    const createOwnerField = currentTable.fields.find(field => field.meta?.name === SystemField.CREATE_OWNER);
    const dataOwnerField = isDataOwnerEnabledTable(currentTable)
      ? currentTable.fields.find(field => field.meta?.name === SystemField.DATA_OWNER)
      : null;
    const ownerCandidates = [dataOwnerField?.uid, createOwnerField?.uid, SystemField.DATA_OWNER, SystemField.CREATE_OWNER].filter(Boolean);
    const ownerValue = ownerCandidates.map(key => row?.[key]).find(value => value !== undefined && value !== null && value !== "");
    const ownerId = ownerValue === undefined || ownerValue === null || ownerValue === "" ? "" : String(ownerValue);
    const accountDepartmentIds = (account.departments || []).filter(Boolean);
    const relatedDepartments = getAllRelatedDepartments(this.organizeUtil?.departments || [], account.departments || []);
    const rowOwner = this.organizeUtil?.findUserById?.(ownerId) || this.getCachedOrganizationAccount(ownerId, { status: 'all' });
    const rowOwnerDepartments = (rowOwner?.departments || []).filter(Boolean);

    if (permission.dataRange?.all) {
      return true;
    }
    if (permission.dataRange?.self && ownerId === account.id) {
      return true;
    }
    const currentDepartmentIds = this.getExpandedDepartmentIds(accountDepartmentIds);
    if (permission.dataRange?.currentDepartment && rowOwnerDepartments.some(departmentId => currentDepartmentIds.includes(departmentId))) {
      return true;
    }
    if (permission.dataRange?.customDepartment?.enabled) {
      const targetDepartmentIds = this.getExpandedDepartmentIds(permission.dataRange.customDepartment.departments || []);
      if (rowOwnerDepartments.some(departmentId => targetDepartmentIds.includes(departmentId))) {
        return true;
      }
    }
    if (permission.dataRange?.siblingDepartment) {
      const siblingDepartmentIds = this.getExpandedDepartmentIds(this.getSiblingDepartmentIds(accountDepartmentIds));
      if (rowOwnerDepartments.some(departmentId => siblingDepartmentIds.includes(departmentId))) {
        return true;
      }
    }
    if (permission.dataRange?.subDepartment) {
      const subDepartmentIds = this.getExpandedDepartmentIds(this.getSubDepartmentIds(accountDepartmentIds));
      if (rowOwnerDepartments.some(departmentId => subDepartmentIds.includes(departmentId))) {
        return true;
      }
    }
    if (permission.dataRange?.anonymous && isAnonymousAccount(rowOwner || { id: ownerId } as Account)) {
      return true;
    }
    if (permission.dataRange?.fromFormField?.enabled) {
      const fields = Array.isArray(permission.dataRange.fromFormField.field)
        ? permission.dataRange.fromFormField.field
        : [permission.dataRange.fromFormField.field];
      const values = fields
        .filter(Boolean)
        .flatMap(fieldId => {
          const rawValue = row?.[fieldId as string];
          if (Array.isArray(rawValue)) {
            return rawValue;
          }
          return rawValue !== undefined && rawValue !== null && rawValue !== "" ? [rawValue] : [];
        })
        .map(value => typeof value === "object" ? (value?.id || value?.value) : value);
      if (values.some(value => String(value) === String(account.id))) {
        return true;
      }
      if (values.some(value => relatedDepartments.includes(String(value)))) {
        return true;
      }
    }
    return false;
  }

  private canHandleRowByPermissionCategory(category: PermissionCategory.UPDATE | PermissionCategory.DELETE, row?: Row | null) {
    const account = passportState.account as Account;
    if (!account) {
      return false;
    }
    if (this.tableProps.dataPermissionMode === "all" || this.context?.runtime === FormTableRuntime.FORM_EDITOR || account.isAdmin) {
      return true;
    }
    const permissions = this.getCurrentTablePermissions();
    return permissions.some((permission) => {
      if (!permission?.handleRange?.[category]) {
        return false;
      }
      if (!this.canMatchPermissionMemberRange(permission, account)) {
        return false;
      }
      if (!this.canMatchPermissionDataStatus(permission, row)) {
        return false;
      }
      return this.canMatchPermissionDataRange(permission, row, account);
    });
  }

  public canEditRow(row?: Row | null) {
    return this.canHandleRowByPermissionCategory(PermissionCategory.UPDATE, row);
  }

  public canDeleteRow(row?: Row | null) {
    return this.canHandleRowByPermissionCategory(PermissionCategory.DELETE, row);
  }

  private getVisibleColumns() {
    const fieldsAuth = this.fieldsAuth;
    const columns = this._columns.value?.filter(Boolean) ?? [];
    return fieldsAuth === "all"
      ? columns
      : columns
        .filter(column => {
          if (!column) {
            return false;
          }
          if (column.subColumns?.length) {
            return true;
          }
          if (!this.tableProps.applyAppFieldPermissionToSystemFields && isSystemField({ meta: { name: column.name } } as any)) {
            return true;
          }
          return Boolean(column.elementId && fieldsAuth[column.elementId]);
        })
        .map(column => {
          if (!column.subColumns) return column;
          return {
            ...column,
            subColumns: column.subColumns.filter(subColumn => {
              if (!this.tableProps.applyAppFieldPermissionToSystemFields && isSystemField({ meta: { name: subColumn.name } } as any)) {
                return true;
              }
              return Boolean(subColumn.elementId && fieldsAuth[subColumn.elementId]);
            })
          }
        })
        .filter(column => !column.subColumns || column.subColumns.length > 0);
  }

  private getRequestedSubTableFieldUIDsByHiddenColumns(hiddenColumnIds: FieldUID[] = this.hiddenColumnIds || []) {
    const hiddenSet = new Set(hiddenColumnIds || []);
    const needed = new Set<FieldUID>();

    for (const column of this.allColumns || []) {
      if (!column?.subColumns?.length) continue;
      if (column.subColumns.some(subColumn => !hiddenSet.has(subColumn.uid))) {
        needed.add(column.uid);
      }
    }

    return needed;
  }

  private getRequestedSubTableFieldUIDs() {
    return this.getRequestedSubTableFieldUIDsByHiddenColumns(this.hiddenColumnIds || []);
  }

  private shouldRefreshDataForSubTableVisibilityChange(
    prevHiddenColumnIds: FieldUID[] = this.hiddenColumnIds ?? [],
    nextHiddenColumnIds: FieldUID[] = prevHiddenColumnIds,
  ) {
    if (!this._subTableUIDs.size) {
      return false;
    }

    const prevRequestedFieldUIDs = this.getRequestedSubTableFieldUIDsByHiddenColumns(prevHiddenColumnIds || []);
    const nextRequestedFieldUIDs = this.getRequestedSubTableFieldUIDsByHiddenColumns(nextHiddenColumnIds || []);

    return Array.from(nextRequestedFieldUIDs).some(fieldUID => !prevRequestedFieldUIDs.has(fieldUID));
  }

  private refreshDataIfSubTableVisibilityExpanded(
    prevHiddenColumnIds: FieldUID[] = this.hiddenColumnIds ?? [],
    nextHiddenColumnIds: FieldUID[] = prevHiddenColumnIds,
  ) {
    if (!this.rows?.length) {
      return;
    }
    if (!this.shouldRefreshDataForSubTableVisibilityChange(prevHiddenColumnIds, nextHiddenColumnIds)) {
      return;
    }
    this.refreshData();
  }

  get renderColumns() {
    return this.getVisibleColumns();
  }

  get allColumns() {
    const visibleColumns = this.getVisibleColumns();

    return this.sortColumnsByOrder(visibleColumns, "__root__").map(column => {
      if (!column.subColumns?.length) return column;
      return {
        ...column,
        subColumns: this.sortColumnsByOrder(column.subColumns, column.uid),
      };
    });
  }

  get fixedColumnId () {
    return this.getTableViewMeta("manualFixedColumn") ?? this.getTableViewMeta("fixedColumn") ?? null;
  }

  get hasFixedColumnIdSetting() {
    return "manualFixedColumn" in this._tableViewMeta.value
      || "fixedColumn" in this._tableViewMeta.value;
  }

  set fixedColumnId (fieldUID: FieldUID | null) {
    this.setTableViewMeta("manualFixedColumn", fieldUID);
  }

  isFixedColumn(fieldUID: FieldUID, fixedColumnCount?: number): "left" | "" {
    const count = Math.max(0, Math.min(4, Math.floor(Number(fixedColumnCount) || 0)));
    if (count > 0) {
      return this.allColumns.slice(0, count).some(column => column.uid === fieldUID) ? "left" : "";
    }
    if (!this.fixedColumnId) return "";
    const index = this.allColumns.findIndex(column => column.uid === this.fixedColumnId);
    const _fixedIds = index !== -1 ? this.allColumns.slice(0, index + 1) : [];
    return _fixedIds.map(column => column.uid).includes(fieldUID) ? "left" : "";
  }

  get isChanged () {
    return this.hiddenColumnIds?.length > 0 || Object.keys(this.columnOrders).length > 0;
  }

  private _hiddenColumnIds: Ref<FieldUID[]> = ref(null);
  private _columnOrders: Ref<FormTableColumnOrder> = ref({});
  private _displaySettingVersion = ref(0);
  private _isApplyingDisplaySettings = ref(false);
  private _hiddenSubTableColumnIds: ShallowRef<Set<FieldUID>> = shallowRef(new Set());
  private _showRowsWatchInitialized = false;

  get displaySettingVersion() {
    return this._displaySettingVersion.value;
  }

  get isApplyingDisplaySettings() {
    return this._isApplyingDisplaySettings.value;
  }

  private bumpDisplaySettingVersion() {
    this._displaySettingVersion.value++;
  }

  setDisplaySettingApplying(value: boolean) {
    this._isApplyingDisplaySettings.value = value;
  }

  get flatColumns() {
    return this.allColumns.flatMap(column => {
      const result = [{
        uid: column.uid,
        name: column.name,
      }];
      if (Array.isArray(column.subColumns)) {
        result.push(...column.subColumns.map(sub => {
          return {
            uid: sub.uid,
            name: sub.name,
          }
        }));
      }
      return result;
    });
  }

  get hiddenColumnIds() {
    if(!this._hiddenColumnIds.value) {
      const hiddenColumns = this.flatColumns.filter(c => [SystemField.DATA_TITLE, SystemField.UUID].includes(c.name as any));
      if (!isEmpty(hiddenColumns)) {
        const value = hiddenColumns.map(c => c.uid);
        const subTableColumns = this.allColumns.filter(c => !!c.subColumns);
        for (const column of subTableColumns) {
          const isHidden = column.subColumns.every(c => value.includes(c.uid));
          if (isHidden) {
            value.push(column.uid);
          }
        }
        return value;
      }
    }
    return this._hiddenColumnIds.value;
  }

  set hiddenColumnIds(value: FieldUID[]) {
    const prevHiddenColumnIds = this.hiddenColumnIds ?? [];
    this._hiddenColumnIds.value = value;
    this.syncHiddenSubTableColumnIds(value);
    this.setTableViewMeta("hiddenColumns", this._hiddenColumnIds.value);
    this.bumpDisplaySettingVersion();
    this.refreshDataIfSubTableVisibilityExpanded(prevHiddenColumnIds, value ?? []);
  }


  get columnOrders() {
    return this._columnOrders.value || {};
  }

  set columnOrders(value: FormTableColumnOrder) {
    this._columnOrders.value = value || {};
    this.setTableViewMeta("columnOrders", this._columnOrders.value);
    this.bumpDisplaySettingVersion();
  }

  hasDisplaySettingsChanged(value: { hiddenColumnIds: FieldUID[]; columnOrders: FormTableColumnOrder }) {
    const nextHiddenColumnIds = value.hiddenColumnIds ?? [];
    const nextColumnOrders = value.columnOrders || {};
    const hiddenChanged = !equals(nextHiddenColumnIds, this.hiddenColumnIds ?? []);
    const orderChanged = !equals(nextColumnOrders, this.columnOrders ?? {});

    return hiddenChanged || orderChanged;
  }

  setDisplaySettings(value: { hiddenColumnIds: FieldUID[]; columnOrders: FormTableColumnOrder }) {
    const nextHiddenColumnIds = value.hiddenColumnIds ?? [];
    const nextColumnOrders = value.columnOrders || {};
    const prevHiddenColumnIds = this.hiddenColumnIds ?? [];
    const hiddenChanged = !equals(nextHiddenColumnIds, this.hiddenColumnIds ?? []);
    const orderChanged = !equals(nextColumnOrders, this.columnOrders ?? {});

    if (!hiddenChanged && !orderChanged) {
      this.setDisplaySettingApplying(false);
      return false;
    }

    if (hiddenChanged) {
      this._hiddenColumnIds.value = nextHiddenColumnIds;
      this.syncHiddenSubTableColumnIds(nextHiddenColumnIds);
      this._tableViewMeta.value.hiddenColumns = this._hiddenColumnIds.value;
    }

    if (orderChanged) {
      this._columnOrders.value = nextColumnOrders;
      this._tableViewMeta.value.columnOrders = this._columnOrders.value;
    }

    this.emitter.emit("update-view-meta", this._tableViewMeta.value);
    this.bumpDisplaySettingVersion();
    if (hiddenChanged) {
      this.refreshDataIfSubTableVisibilityExpanded(prevHiddenColumnIds, nextHiddenColumnIds);
    }
    return true;
  }

  private getFullyHiddenSubTableColumnIds(hiddenColumnIds: FieldUID[] = this.hiddenColumnIds ?? []) {
    const hiddenSet = new Set(hiddenColumnIds || []);
    const result = new Set<FieldUID>();

    for (const { fieldUID } of this._subTableFieldUIDs.value) {
      const subTableUID = this._subTableUIDs.get(fieldUID as FieldUID)?.[1];
      const subTable = subTableUID ? this.getTable(subTableUID) : undefined;
      const subFieldUIDs = subTable?.fields?.filter(f => !isBuiltinField(f)).map(f => f.uid) || [];
      if (!subFieldUIDs.length) continue;
      if (subFieldUIDs.every(item => hiddenSet.has(item))) {
        result.add(fieldUID);
      }
    }

    return result;
  }

  private syncHiddenSubTableColumnIds(hiddenColumnIds: FieldUID[] = this.hiddenColumnIds ?? []) {
    const nextHiddenSubTableColumnIds = this.getFullyHiddenSubTableColumnIds(hiddenColumnIds);
    const currentHiddenSubTableColumnIds = this._hiddenSubTableColumnIds.value;

    if (
      currentHiddenSubTableColumnIds.size === nextHiddenSubTableColumnIds.size
      && Array.from(nextHiddenSubTableColumnIds).every(fieldUID => currentHiddenSubTableColumnIds.has(fieldUID))
    ) {
      return;
    }

    this._hiddenSubTableColumnIds.value = nextHiddenSubTableColumnIds;
  }

  private initShowRowsWatch() {
    if (this._showRowsWatchInitialized) return;

    this._showRowsWatchInitialized = true;
    this.effectScope.run(() => {
      watch([
        () => this.rows,
        () => this._subTableRowIndex.value,
        () => this._subTableFieldUIDs.value,
        () => this.rowKey,
        () => this._hiddenSubTableColumnIds.value,
      ], () => {
        this._showRows.value = this._computeShowRows();
      }, { immediate: true });
    });
  }

  private sortColumnsByOrder<T extends { uid: FieldUID }>(columns: T[], groupKey: string): T[] {
    const orderMap = this.columnOrders?.[groupKey] || {};
    if (isEmpty(orderMap)) {
      return [...columns];
    }

    const placedIds = new Set<FieldUID>();
    const result = columns
      .filter((column) => orderMap[column.uid] !== undefined)
      .sort((a, b) => orderMap[a.uid] - orderMap[b.uid]);

    result.forEach((column) => placedIds.add(column.uid));

    columns.forEach((column, index) => {
      if (placedIds.has(column.uid)) return;

      let insertIndex = 0;
      let hasPrevPlaced = false;
      for (let i = index - 1; i >= 0; i--) {
        const prevUid = columns[i].uid;
        const prevIndex = result.findIndex((item) => item.uid === prevUid);
        if (prevIndex !== -1) {
          insertIndex = prevIndex + 1;
          hasPrevPlaced = true;
          break;
        }
      }

      if (!hasPrevPlaced) {
        insertIndex = 0;
      }

      result.splice(insertIndex, 0, column);
      placedIds.add(column.uid);
    });

    return result;
  }

  private buildSubTableRowIndex(fieldUID: FieldUID, rows: object[] = []) {
    const relationKey = this._subTableFieldUIDs.value.find(item => item.fieldUID === fieldUID)?.relationKey;
    const rowIndex = new Map<any, object[]>();
    if (!relationKey) return rowIndex;

    for (const row of rows) {
      const relationValue = row?.[relationKey];
      if (relationValue === undefined || relationValue === null) continue;
      const groupedRows = rowIndex.get(relationValue);
      if (groupedRows) {
        groupedRows.push(row);
      } else {
        rowIndex.set(relationValue, [row]);
      }
    }

    return rowIndex;
  }

  get rowKey() {
    return this._uuidField.value?.uid ?? "";
  }

  get subTableData() {
    return this._subTableData.value;
  }

  get subTableFieldUIDs() {
    return this._subTableFieldUIDs.value;
  }

  private async getFilteredUuid() {
    const subRuleInfo = this.getSearchRules("sub");
    let uuids: string[] = [];
    const promises = [];
    if (!this._subTableUIDs.size) {
      return uuids;
    }
    if (subRuleInfo.conditions) {
      for (const fieldId in subRuleInfo.conditions) {
        const subTableUID = this._subTableUIDs.get(fieldId as FieldUID);
        if (!subTableUID) continue;
        const [cUID, tableUID ] = subTableUID; 
        const queryConditions = subRuleInfo.conditions[fieldId];
        const table = this.getTable(tableUID);
        const keyField = table?.fields?.find(f => f.meta.name === SystemField.KEY);
        if (!table || !keyField?.uid) continue;
        promises.push(formDataApi.distinct({
          nocodeId: this.nocodeId,
          tableUID,
          columnId: keyField.uid,
          options: {
            stage: this.getQueryStage(tableUID),
            filters: {
              [tableUID]: [queryConditions],
            }
          }
        }));
      }
      
      const uuidGroup = await Promise.all(promises);
      uuids = subRuleInfo.logic === LogicalOperator.AND ? intersection(...uuidGroup) : Array.from(new Set(uuidGroup.flat()));
    }
    return uuids;
  }

  private async readSubTableData(rows: object[], requestedFieldUIDs: Set<FieldUID> = this.getRequestedSubTableFieldUIDs()) {
    if (!requestedFieldUIDs.size) {
      this._subTableData.value = {};
      this._subTableRowIndex.value = {};
      return [];
    }
    const keys = rows
      .map(row => row[this.rowKey])
      .filter(key => key !== undefined && key !== null);
    if (!keys.length) {
      this._subTableData.value = {};
      this._subTableRowIndex.value = {};
      return [];
    }
    const subRuleInfo = this.getSearchRules("sub");
    const hasMainSearchCondition = !isEmpty(this.getSearchMainCondition());
    const hasSubSearchCondition = !isEmpty(this.searchValue?.filter(c => c.uid?.split(".").length > 1));
    const mainMatchedRowKeys = hasMainSearchCondition && hasSubSearchCondition
      ? await this.getSearchMainMatchedRowKeys(keys)
      : [];
    const requests: Promise<[FieldUID, _TableData] | null>[] = [];
    for (const [fieldUID, tableUID] of this._subTableUIDs) {
      if (!requestedFieldUIDs.has(fieldUID)) {
        continue;
      }
      let filters: Record<string, WhereCondition[]> = {};
      const table = this.getTable(tableUID[1]);
      if (!table) {
        console.error(i18next.t('table.subFormLostTips'), tableUID);
        continue;
      }
      const keyField = table?.fields?.find(f => f.meta.name === SystemField.KEY);
      if (!keyField?.uid) continue;
      const searchSubConditions = this.searchValue?.filter(c => c.uid?.split(".").length > 1);
      let _searchCondition: WhereCondition;
      if (!isEmpty(searchSubConditions)) {
        const searchSubWhereConditions = searchSubConditions.filter(c => c.uid.split(".")[0] === fieldUID).map(condition => transformCondition(condition));
        if (searchSubWhereConditions.length > 1) {
          _searchCondition = { $or: searchSubWhereConditions };
        } else if (searchSubWhereConditions.length === 1) {
          _searchCondition = searchSubWhereConditions[0];
        }
      }
      const queryParts = buildSubTableDisplaySearchCondition(
        keyField.uid,
        keys,
        mainMatchedRowKeys,
        _searchCondition,
      );
      const allFilters = this.mergeWhereConditionsWithAnd(
        queryParts,
        deepClone(subRuleInfo.conditions?.[fieldUID]),
      );

      filters = {
        [tableUID[1]]: [
          allFilters
        ]
      };
      requests.push(
        this.getData(tableUID[1], {
          filters,
          orderBy: SortType.ASC,
        }).then(({ rows, count }) => [fieldUID, { rows, total: count }] as [FieldUID, _TableData]).catch(() => null)
      );
    }
    const results = await Promise.all(requests);
    const nextData: {[fieldUID: FieldUID]: _TableData} = {};
    const nextRowIndex: { [fieldUID: FieldUID]: Map<any, object[]> } = {};
    for (const result of results) {
      if (!result) continue;
      const [fieldUID, data] = result;
      nextData[fieldUID] = data;
      nextRowIndex[fieldUID] = this.buildSubTableRowIndex(fieldUID, data.rows);
    }
    this._subTableData.value = nextData;
    this._subTableRowIndex.value = nextRowIndex;
    return results;
  }
  async readRelatedTableData(rows: object[]) {
    if (!this._relatedTableUIDs.size) {
      return [];
    }
    const requests: Promise<[FieldUID, _TableData] | null>[] = [];
    for (const [fieldUID, { relatedTableUID, primaryFieldId }] of this._relatedTableUIDs) {
      // TODO ids瑕佹崲鎴愬綋鍓嶅瓧娈垫墍鍦ㄧ殑琛ㄧ殑uuid
      let ids = rows.map(row=>row[fieldUID])?.flat(Infinity);
      if (primaryFieldId) {
        const subData = this._subTableData.value[primaryFieldId];
        ids = subData?.rows?.map(row => row[fieldUID])?.flat(Infinity);
      }
      const fields = this._relatedTableFields.get(fieldUID) ?? [];
      const uuidField = getUUIDSystemField(fields);
      if (!uuidField?.uid) continue;
      const targetTableContext = this.getOptionTableContext(relatedTableUID);
      requests.push(
        this.getData(relatedTableUID[1], {
          filters: {
            [relatedTableUID[1]]: [
              { [uuidField.uid]: { $in: Array.from(new Set(ids)) } }
            ]
          },
        }, targetTableContext?.connection?.nocodeId || this.nocodeId).then(({rows, count}) => [fieldUID, { rows, total: count }] as [FieldUID, _TableData]).catch(() => null)
      );
    }
    const results = await Promise.all(requests);
    const nextData = { ...this._relatedTableData.value };
    for (const result of results) {
      if (!result) continue;
      const [fieldUID, data] = result;
      nextData[fieldUID] = data;
    }
    this._relatedTableData.value = nextData;
  }

  public getRelatedRowKey(fieldUID: FieldUID) {
    const fields = this._relatedTableFields.get(fieldUID) ?? [];
    const uuidField = getUUIDSystemField(fields);
    return uuidField?.uid;
  }
  public getRelatedTitleFieldUID(fieldUID: FieldUID) {
    const fields = this._relatedTableFields.get(fieldUID) ?? [];
    return fields.find(f => f.meta.name === SystemField.DATA_TITLE)?.uid;
  }
  public getRelatedRows(fieldUID: FieldUID, uuids: string[]) {
    const fields = this._relatedTableFields.get(fieldUID) ?? [];
    const uuidField = getUUIDSystemField(fields);
    const {rows} = this._relatedTableData.value[fieldUID] ?? {};
    return uuids?.map(uuid => rows?.find(row => row[uuidField.uid] === uuid))?.filter(Boolean) || [];
  }
  public async getRelatedFilterOptions(fieldUID: FieldUID, uuids: string[]) {
    const fallbackOptions = uuids.map(value => ({ label: value, value }));
    const relatedTableUID = this.getRelatedTableUID(fieldUID);
    const rowKey = this.getRelatedRowKey(fieldUID);
    const titleFieldUID = this.getRelatedTitleFieldUID(fieldUID);
    if (!relatedTableUID?.[1] || !rowKey || !titleFieldUID || !uuids.length) {
      return fallbackOptions;
    }

    const targetTableContext = this.getOptionTableContext(relatedTableUID);
    const { rows } = await this.getData(relatedTableUID[1], {
      filters: {
        [relatedTableUID[1]]: [
          { [rowKey]: { $in: uuids } }
        ]
      }
    }, targetTableContext?.connection?.nocodeId || this.nocodeId);

    return uuids.map(value => {
      const row = rows.find(item => item[rowKey] === value);
      return {
        label: row?.[titleFieldUID] ? `${row[titleFieldUID]}(${value})` : value,
        value,
      };
    });
  }
  public getRelatedTableUID(fieldUID: FieldUID) {
    return this._relatedTableUIDs.get(fieldUID)?.relatedTableUID;
  }

  get rows() {
    return this._data?.rows?.value ?? [];
  }
  get total() {
    return this._data?.total?.value ?? 0;
  }
  get normalizedTopLimit() {
    const value = Math.floor(Number(this.tableProps.topLimit) || 0);
    if (!value) return 0;
    return Math.max(1, Math.min(1000, value));
  }
  get showRows() {
    if (this._showRows.value === undefined) {
      this.initShowRowsWatch();
    }
    return this._showRows.value;
  }
  private pickSubTableRowDisplayFields(parentFieldUID: FieldUID, subRow: Row) {
    if (!subRow) {
      return {};
    }
    const subTableUID = this._subTableUIDs.get(parentFieldUID)?.[1];
    const subTableFields = subTableUID ? this.getTableFields(subTableUID) : [];
    if (!subTableFields?.length) {
      return {};
    }
    return subTableFields.reduce<Row>((result, field) => {
      const canDisplayInMainRow = field.meta?.name === SystemField.UUID || !isBuiltinField(field);
      if (!canDisplayInMainRow) {
        return result;
      }
      if (Object.prototype.hasOwnProperty.call(subRow, field.uid)) {
        result[field.uid] = subRow[field.uid];
      }
      return result;
    }, {});
  }
  private _computeShowRows() {
    const rows = [];
    const uuidKey = this.rowKey;
    for (const row of this.rows) {
      const rowUUID = row[uuidKey];
      //瀛愯〃鏁版嵁
      let maxLen = 1;
      const subRowsList: { fieldUID: FieldUID, subRows: object[] }[] = [];
      for (const {fieldUID, relationKey} of this._subTableFieldUIDs.value) {
        // 隐藏列不显示。对子表单需要按子字段的 fieldUID 判断是否隐藏。
        if (this._hiddenSubTableColumnIds.value.has(fieldUID)) continue;
        const subRows = this._subTableRowIndex.value[fieldUID]?.get(rowUUID)
          ?? this._subTableData.value[fieldUID]?.rows?.filter(row => row[relationKey] === rowUUID)
          ?? [];
        subRowsList.push({ fieldUID, subRows });
        if (subRows.length > maxLen) {
          maxLen = subRows.length;
        }
      }
      for (let i = 0; i < maxLen; i++) {
        const newRow = {
          ...row,
          _merge: maxLen > 1,
          _mergeRow: i === 0 ? maxLen : undefined,
        };
        for (const { fieldUID, subRows } of subRowsList) {
          const subRow = subRows[i] ?? {};
          Object.assign(newRow, this.pickSubTableRowDisplayFields(fieldUID, subRow as Row));
        }
        rows.push(newRow);
      }
    }
    return rows;
  }


  private _sortFields = ref<FormSortField[]>([]);
  get sortFields() {
    return this.sanitizeSortFieldsValue(this._sortFields.value);
  }
  set sortFields(value) {
    this._sortFields.value = this.sanitizeSortFieldsValue(value);
    this.setTableViewMeta("sort", this._sortFields.value);
  }
  get sortFieldsMap() {
    return this.sortFields.reduce<Record<FieldUID, SortType>>((prev, item) => {
      prev[item.field] = item.value;
      return prev;
    }, {});
  }
  private _filterRules = ref<FilterRule>({
    logic: LogicalOperator.AND,
    conditions: [],
  });

  get filterRule() {
    return this.sanitizeFilterRuleValue(this._filterRules.value);
  }

  set filterRule(value) {
    this._filterRules.value = this.sanitizeFilterRuleValue(value);
    this.persistFilterRule();
  }

  // 临时显示逻辑（筛选、隐藏列）不做保存
  setTempShowTableRule<T extends keyof FormTableViewMeta = keyof FormTableViewMeta>(key: T, value) {
    if (key === "filterRules") {
      this._filterRules.value = this.sanitizeFilterRuleValue(value);
    } else if (key ===  "hiddenColumns") {
      const prevHiddenColumnIds = this.hiddenColumnIds ?? [];
      if (equals(this._hiddenColumnIds.value || [], value || [])) return;
      this._hiddenColumnIds.value = value;
      this.syncHiddenSubTableColumnIds(value);
      this.bumpDisplaySettingVersion();
      this.refreshDataIfSubTableVisibilityExpanded(prevHiddenColumnIds, value || []);
    } else if (key === "columnOrders") {
      if (equals(this._columnOrders.value || {}, value || {})) return;
      this._columnOrders.value = value;
      this.bumpDisplaySettingVersion();
    } else if (key === "sort") {
      this._sortFields.value = this.sanitizeSortFieldsValue(value);
    }
  }

  persistFilterRule() {
    this.setTableViewMeta("filterRules", this._filterRules.value);
  }

  private _pageSize = ref(20);
  private _refreshDataTime = ref(0);
  private _refreshDataTimer: number;
  private _refreshDataTimerMs = 500;
  private _refreshRequestVersion = 0;
  private _refreshPending = false;
  private _refreshTask?: {
    promise: Promise<void>,
    resolve: () => void,
    reject: (error: unknown) => void,
    reportFailure: boolean,
  };
  private _dataAggregation = ref<Record<FieldUID, AggregationType>>({});
  private _relatedSubForm: Ref<ReturnType<typeof getRelatedFields>> = ref({});
  refreshData(reportFailure = false){
    if (!this._fields.value?.length) return Promise.resolve();

    if (this._refreshTask) {
      this._findRefreshController?.abort();
      this._refreshPending = true;
      this._refreshTask.reportFailure ||= reportFailure;
      return this._refreshTask.promise;
    }

    let resolve: () => void;
    let reject: (error: unknown) => void;
    const promise = new Promise<void>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    this._refreshTask = {
      promise,
      resolve,
      reject,
      reportFailure,
    };
    this._refreshDataTime.value += 1;
    return promise;
  }

  dispose() {
    this._disposeVersion += 1;
    if (this._refreshDataTimer) {
      clearTimeout(this._refreshDataTimer);
    }
    this._refreshDataTimer = undefined;
    this._refreshRequestVersion += 1;
    this._findRefreshController?.abort();
    this._findRefreshController = undefined;
    this._requestController.abort();
    this._refreshPending = false;
    this._refreshTask?.resolve();
    this._refreshTask = undefined;
    this._effectScope?.stop();
    this._effectScope = null;
    const form = this.form;
    const board = form?.getBoard();
    form?.destroy();
    if (form && board) {
      board.unsetInstancedWidget(form.uid);
      board.destroy();
    }
    this.emitter.removeAllListeners();
    this.form = undefined;
    this._formInitPromise = null;
    this._showRows.value = undefined;
    this._data.rows.value = [];
    this._data.total.value = 0;
    this._fields.value = [];
    this._columns.value = [];
    this._subTableData.value = {};
    this._subTableRowIndex.value = {};
    this._relatedTableData.value = {};
    this._subTableFieldUIDs.value = [];
    this._subTableUIDs.clear();
    this._subTableFields.clear();
    this._relatedTableUIDs.clear();
    this._relatedTableFields.clear();
    this.inlineConnectionData = {};
    this.loadedConnectionBucketKeys.clear();
    this.loadingConnectionBucketPromises.clear();
    this._departmentCache.clear();
    this._accountCache.clear();
    this._resolvedAccountCache.clear();
    this._filteredPrintTemplateCache.clear();
    this._relatedSubForm.value = {};
    this._checkboxRow.value = undefined;
    this._selectedRow.value = undefined;
    this._selectedColumn.value = undefined;
    this._filterRules.value = { logic: LogicalOperator.AND, conditions: [] };
    this._searchValue.value = undefined;
    this._searchFieldIds.value = [];
    this._hiddenColumnIds.value = [];
    this._columnOrders.value = {};
    this._hiddenSubTableColumnIds.value = new Set();
    // Break references held by late async callbacks after the table leaves the view.
    this.context = undefined as unknown as TableContext;
    this.formData = undefined as unknown as NocodeFormData;
    this.nocodeBody = undefined as unknown as NocodeBody;
    this.organizeUtil = undefined as unknown as OrganizeUtil;
    this.fieldPermissions = undefined as unknown as FieldPermissionGroupItemType[];
    this.getMainSign = undefined;
    this.setMainSign = undefined;
    // Release the component props proxy captured by this table instance.
    this.tableProps = {} as TableProps;
  }

  get refreshDataTime() {
    return this._refreshDataTime.value;
  }

  get pageSize() {
    return this._pageSize.value;
  }
  set pageSize(value) {
    this._pageSize.value = value;
  }

  private _currentPage = ref(1);
  get currentPage(): number {
    return this._currentPage.value;
  }
  set currentPage(pageNumber) {
    this._currentPage.value = pageNumber;
  }

  get dataAggregation() {
    return this._dataAggregation.value;
  }
  set dataAggregation(value) {
    this._dataAggregation.value = value;
    this.setTableViewMeta("dataAggregation", this._dataAggregation.value);
  }

  private _searchValue = ref<FormCondition[]>();
  get searchValue(): FormCondition[] {
    return this._searchValue.value;
  }
  set searchValue(searchValue) {
    this._searchValue.value = searchValue;
  }

  private _searchFieldIds = ref<FieldUID[]>([]);
  get searchFieldIds(): FieldUID[] {
    return this._searchFieldIds.value;
  }
  set searchFieldIds(searchFieldIds) {
    this._searchFieldIds.value = searchFieldIds;
    this.persistSearchFieldIds();
  }
  persistSearchFieldIds() {
    this.setTableViewMeta("searchFieldIds", this._searchFieldIds.value);
  }

  private _selectedRow = ref(null);
  private _selectedColumn = ref(null);
  setSelectedRow(row, column?){
    // 閫変腑鏌愯鏌愬�?
    if(!row){
      row = null;
      column = null;
    }
    this._selectedRow.value = row;
    this._selectedColumn.value = column;
  }

  get selectedRow(){
    return this._selectedRow?.value;
  }

  get selectedColumn(){
    return this._selectedColumn.value;
  }

  public addRows(rows: any[]){
    if(!this.formTableUID) return;
    formDataApi.addData({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      rows,
      sign: this.getMainSign?.(),
      onMainSign: (sign: string) => this.setMainSign?.(sign),
    });
  }

  private removeLocalRows(rows: Row[] = []) {
    if (!rows.length) return;

    const removedUUIDs = new Set(
      rows
        .map(row => row?.[this.rowKey] ?? row?.[SystemField.UUID])
        .filter(value => value !== undefined && value !== null && value !== "")
        .map(value => String(value)),
    );
    if (!removedUUIDs.size) return;

    const currentRows = this._data.rows.value || [];
    const nextRows = currentRows.filter(row => !removedUUIDs.has(String(
      row?.[this.rowKey] ?? row?.[SystemField.UUID] ?? "",
    )));
    const removedCount = currentRows.length - nextRows.length;
    if (!removedCount) return;

    this._data.rows.value = nextRows;
    this._data.total.value = Math.max(0, this._data.total.value - removedCount);
  }

  public async removeRows(rows, runtime: FormTableRuntime){
    if(!this.formTableUID) return;
    let keyUid;
    if(this.rowKey){
      keyUid = [this.formData.uid, this.formTableUID, this.rowKey];
    }
    return await formDataApi.deleteData({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      rows,
      keys: keyUid && [keyUid],
      runtime,
      sign: this.getMainSign?.(),
      onMainSign: (sign: string) => this.setMainSign?.(sign),
    }).then((result)=>{
      const successRows = Array.isArray(result?.data) ? result.data : [];
      this.removeLocalRows(successRows);
      if (!result?.taskId) {
        this.refreshData();
      }
      if(this.selectedRow){
        const hasSelectedRow = successRows.some((checkRow)=>checkRow[this.rowKey] === this.selectedRow[this.rowKey]);
        if(hasSelectedRow){
          this.setSelectedRow(null);
        }
      }
      this.setCheckboxRow([])
      return result;
    });
  }

  public async removeAllRows(runtime: FormTableRuntime){
    if(!this.formTableUID) return;
    let keyUid;
    if(this.rowKey){
      keyUid = [this.formData.uid, this.formTableUID, this.rowKey];
    }
    return await formDataApi.deleteAllData({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      runtime,
      sign: this.getMainSign?.(),
      onMainSign: (sign: string) => this.setMainSign?.(sign),
    }).then((result)=>{
      const successRows = Array.isArray(result?.data) ? result.data : [];
      this.removeLocalRows(successRows);
      // 删除全部返回的是全量结果，当前页的本地扣减无法校正总数；数据已先进入 DELETED，刷新不会重新显示。
      this.refreshData();
      this.setCheckboxRow([])
      return result;
    });
  }

  public async restoreRows(rows) {
    if (!this.formTableUID) return;
    let keyUid;
    if (this.rowKey) {
      keyUid = [this.formData.uid, this.formTableUID, this.rowKey];
    }
    await formDataApi.restoreData({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      rows,
      keys: keyUid && [keyUid],
      sign: this.getMainSign?.(),
      onMainSign: (sign: string) => this.setMainSign?.(sign),
    }).then(() => {
      this.refreshData();
      this.setSelectedRow(null);
      this.setCheckboxRow([]);
    });
  }

  public async purgeRows(rows) {
    if (!this.formTableUID) return;
    let keyUid;
    if (this.rowKey) {
      keyUid = [this.formData.uid, this.formTableUID, this.rowKey];
    }
    await formDataApi.purgeData({
      nocodeId: this.nocodeId,
      tableUID: this.formTableUID,
      rows,
      keys: keyUid && [keyUid],
      sign: this.getMainSign?.(),
      onMainSign: (sign: string) => this.setMainSign?.(sign),
    }).then(() => {
      this.refreshData();
      this.setSelectedRow(null);
      this.setCheckboxRow([]);
    });
  }

  public async queryBucket(options: QueryOptions = {}) {
    if (!this.formTableUID) return null;
    return await this.getData(this.formTableUID, options);
  }

  public async getTableName() {
    if(!this.formTableUID) return [];
    const res = await this.getTable(this.formTableUID);
    return res.alias
  }
  public async getSubTableUIDs() {
    return this._subTableUIDs
  }

  public async getTableFilter() {
    const mainRuleInfo = this.getSearchRules("main");
    const subRuleInfo = this.getSearchRules("sub");
    const uuids = await this.getFilteredUuid();
    const searchConditionsInfo = await this.getSearchConditions();
    let filtersData = this.buildMainAndSubFilterCondition(
      mainRuleInfo.conditions,
      uuids,
      !isEmpty(subRuleInfo.conditions),
      mainRuleInfo.logic,
    );

    if (!isEmpty(searchConditionsInfo)) {
      filtersData = isEmpty(filtersData)
        ? searchConditionsInfo
        : {
          $and: [
            filtersData,
            searchConditionsInfo,
          ],
        };
    }

    return {
      [this.formTableUID]: [
        filtersData || {},
      ]
    }
  }
  public async getRows(type) {
    if(!this.formTableUID) return [];
    let rows = [];
    if(type === ExportType.FilteredData){
      const filters = await this.getTableFilter();
      const data = await this.getData(this.formTableUID, {
        filters: filters,
        transformFormData: true,
      });
      rows = data?.rows ?? [];
      // 读取子表和关联表数据
      await this.readSubTableData(rows, new Set(Array.from(this._subTableUIDs.keys())));
      await this.readRelatedTableData(rows);
    } else if(type === ExportType.SelectedData){
      // 鑾峰彇閫変腑琛岀殑鏁版嵁
      const checkRows = this.checkboxRow || [];
      const table = this.getTable(this.formTableUID);
      const uuidFieldUID = table.fields.find((field) => field.meta.name === SystemField.UUID).uid;
      const selectRowUids = checkRows.map((row) => row[uuidFieldUID]);
      const data = await this.getData(this.formTableUID, { transformFormData: true });
      rows = data?.rows ?? [];
      rows = rows.filter((row) => selectRowUids.includes(row[uuidFieldUID]));
      await this.readSubTableData(rows, new Set(Array.from(this._subTableUIDs.keys())));
      await this.readRelatedTableData(rows);
    } else if(type === ExportType.AllData){
      const data = await this.getData(this.formTableUID, { transformFormData: true });
      rows = data?.rows ?? [];
    }

    // 合并子表数据到主表
    if (this._subTableUIDs.size > 0) {
      const uuidKey = this.rowKey;

      // 鑾峰彇瀛愯〃鏁版嵁
      const subTablesRows = {};
      if(type === ExportType.AllData){
        for (const [fieldUID, tableUID] of this._subTableUIDs) {
          const data = await this.getData(tableUID[1], { transformFormData: true });
          subTablesRows[fieldUID] = data?.rows ?? [];
        }
      }
      
      // 为每一行主表数据合并子表数据
      for (const row of rows) {
        const rowUUID = row[uuidKey];
        
        // 遍历所有子表
        for (const [fieldUID, tableUID] of this._subTableUIDs) {
          let allSubRows;
          if(type === ExportType.AllData){
            allSubRows = subTablesRows[fieldUID];
          } else {
            allSubRows = this._subTableData.value[fieldUID]?.rows ?? [];
          }
          const subTable = this.getTable(tableUID[1]);
          if (subTable) {
            const relationField = subTable.fields.find(f => f.meta.name === SystemField.KEY);
            const relationKey = relationField?.uid;
            const subRows = allSubRows?.filter(row => row[relationKey] === rowUUID) ?? [];

            // 为每个子表行数据添加所属子表单 UID 属性
            row[fieldUID] = subRows.map(item => ({
              ...item,
              parentUID: fieldUID
            }));
          }
        }

        // 澶勭悊鍥剧墖鍜岄檮浠讹紙鍖呭惈url灞炴€э級锛屾瀯閫爀xportUrl
        for (const key in row) {
          const fileItem = row[key];
          // 妫€鏌ユ槸鍚﹀寘鍚玼rl瀛楁�?
          if (fileItem && Array.isArray(fileItem)) {
            if(fileItem[0]?.url){
              fileItem.map(item => { 
                if (item && item.url) {
                  item.exportUrl = `${window.location.origin}/${item.url}`;
                }
              })
            } else {  // 鏋勯€犲瓙琛ㄥ崟涓浘鐗囧拰闄勪欢鐨別xportUrl
              fileItem.forEach(fileItem => { 
                for (const key in fileItem) {
                  const rowItem = fileItem[key];
                  // 妫€鏌owItem
                  if(rowItem?.[0]?.url){
                    rowItem.map(item => { 
                      if (item && item.url) {
                        item.exportUrl = `${window.location.origin}/${item.url}`;
                      }
                    })
                  }
                }
              });
            }
          }
        }
      }
    }

    // 没有子表的情况
    // 处理图片和附件（包含 url 属性），构造 exportUrl
    for (const row of rows) {
      for (const key in row) {
        const fileItem = row[key];
        // 妫€鏌ユ槸鍚﹀寘鍚玼rl瀛楁�?
        if (fileItem && Array.isArray(fileItem)) {
          if(fileItem[0]?.url){
            fileItem.map(item => { 
              if (item && item.url) {
                item.exportUrl = `${window.location.origin}/${item.url}`;
              }
            })
          }
        }
      }
    }

    return rows;
  }

  public async updateTableRows(options: {
    tableUID: TableUID,
    rows: Row[],
    keyFieldUID?: FieldUID,
  }) {
    const { tableUID, rows, keyFieldUID } = options;
    if (!tableUID || !rows?.length) return;
    let keyUid = void 0;
    if (keyFieldUID) {
      keyUid = [this.formData.uid, tableUID, keyFieldUID];
    }
    await formDataApi.updateData({
      nocodeId: this.nocodeId,
      tableUID,
      rows,
      keys: keyUid && [keyUid],
      // 直接单元格编辑和批量修改不触发流程，保持与产品提示一致。
      runtime: FormTableRuntime.FORM_EDITOR,
      sign: this.getMainSign?.(),
      onMainSign: (sign: string) => this.setMainSign?.(sign),
    })
  }

  public async updateRows(rows){
    if(!this.formTableUID) return;
    await this.updateTableRows({
      tableUID: this.formTableUID,
      rows,
      keyFieldUID: this.rowKey || undefined,
    });
  }

  public patchLocalRow(row: Row) {
    if (!row || !this.rowKey) return;
    const rowUUID = row[this.rowKey];
    if (!rowUUID) return;
    const allowDataOwner = this.table ? isDataOwnerEnabledTable(this.table) : true;
    const dataOwnerField = this.table?.fields?.find(field => field.meta?.name === SystemField.DATA_OWNER);

    const currentRows = this._data.rows.value || [];
    const rowIndex = currentRows.findIndex((item) => item[this.rowKey] === rowUUID);
    if (rowIndex !== -1) {
      const nextRows = [...currentRows];
      const nextRow = {
        ...nextRows[rowIndex],
      };

      for (const field of this.table?.fields || []) {
        if (field.meta?.subType === 'subform') continue;
        if (Object.prototype.hasOwnProperty.call(row, field.uid)) {
          nextRow[field.uid] = deepClone(row[field.uid]);
        }
      }
      if (allowDataOwner && Object.prototype.hasOwnProperty.call(row, SystemField.DATA_OWNER)) {
        nextRow[SystemField.DATA_OWNER] = deepClone(row[SystemField.DATA_OWNER]);
        if (dataOwnerField?.uid) {
          nextRow[dataOwnerField.uid] = deepClone(row[SystemField.DATA_OWNER]);
        }
      }

      nextRows[rowIndex] = nextRow;
      this._data.rows.value = nextRows;
      if (this.selectedRow?.[this.rowKey] === rowUUID) {
        this._selectedRow.value = deepClone(nextRow);
      }
    }

    if (!this._subTableFieldUIDs.value.length) return;

    const nextSubTableData = { ...this._subTableData.value };
    const nextSubTableRowIndex = { ...this._subTableRowIndex.value };
    let changed = false;

    for (const { fieldUID, relationKey } of this._subTableFieldUIDs.value) {
      if (!Object.prototype.hasOwnProperty.call(row, fieldUID)) continue;
      const currentSubTableData = nextSubTableData[fieldUID];
      if (!currentSubTableData) continue;

      const incomingRows = Array.isArray(row[fieldUID])
        ? row[fieldUID].map((subRow) => {
          const nextSubRow = deepClone(subRow);
          nextSubRow[relationKey] = rowUUID;
          return nextSubRow;
        })
        : [];
      const preservedRows = (currentSubTableData.rows || []).filter((subRow) => subRow[relationKey] !== rowUUID);

      nextSubTableData[fieldUID] = {
        ...currentSubTableData,
        rows: [...preservedRows, ...incomingRows],
        total: preservedRows.length + incomingRows.length,
      };
      nextSubTableRowIndex[fieldUID] = this.buildSubTableRowIndex(fieldUID, nextSubTableData[fieldUID].rows);
      changed = true;
    }

    if (changed) {
      this._subTableData.value = nextSubTableData;
      this._subTableRowIndex.value = nextSubTableRowIndex;
    }
  }

  private _departmentCache = new Map<string, Promise<Department>>();
  private _accountCache = new Map<string, Promise<Account>>();
  private _resolvedAccountCache = new Map<string, Account | null>();
  private _filteredPrintTemplateCache = new Map<string, Promise<any[]>>();
  private _rowPermissionAccountVersion = ref(0);

  private touchRowPermissionAccountVersion() {
    this._rowPermissionAccountVersion.value += 1;
  }

  private getOwnerFieldIds() {
    const currentTable = this.table;
    const createOwnerFieldUID = currentTable?.fields?.find(field => field.meta?.name === SystemField.CREATE_OWNER)?.uid;
    const dataOwnerFieldUID = currentTable && isDataOwnerEnabledTable(currentTable)
      ? currentTable.fields.find(field => field.meta?.name === SystemField.DATA_OWNER)?.uid
      : null;
    return [createOwnerFieldUID, dataOwnerFieldUID, SystemField.CREATE_OWNER, SystemField.DATA_OWNER]
      .filter(Boolean)
      .map(id => String(id));
  }

  private collectAccountIdsByFieldIds(rows: Row[], fieldIds: string[]) {
    if (!rows?.length || !fieldIds?.length) {
      return [];
    }
    const ids = new Set<string>();
    const pushId = (value: any) => {
      if (!value) return;
      let id: string | undefined;
      if (typeof value === "string") {
        id = value.trim();
      } else if (typeof value === "number") {
        id = String(value);
      } else if (typeof value === "object") {
        const objId = (value as any).id ?? (value as any).value;
        if (typeof objId === "string") id = objId.trim();
        else if (typeof objId === "number") id = String(objId);
      }
      if (id && id !== "0") {
        ids.add(id);
      }
    };
    for (const row of rows) {
      for (const fieldId of fieldIds) {
        const value = (row as any)?.[fieldId];
        if (Array.isArray(value)) {
          value.forEach(item => pushId(item));
        } else {
          pushId(value);
        }
      }
    }
    return [...ids];
  }

  private collectAccountIdsFromRows(rows: Row[]): string[] {
    if (!rows?.length) {
      return [];
    }
    const accountColumnIds = this.allColumns
      .filter(column => column.subType === "account" && !column.isSubColumn)
      .map(column => column.uid);
    const ownerFieldIds = this.getOwnerFieldIds();
    const accountFieldIds = Array.from(new Set([...accountColumnIds, ...ownerFieldIds]));
    return this.collectAccountIdsByFieldIds(rows, accountFieldIds);
  }

  private collectOwnerIdsFromRows(rows: Row[]): string[] {
    return this.collectAccountIdsByFieldIds(rows, this.getOwnerFieldIds());
  }

  private getAccountCacheKey(id: string, searchParams?: { status?: 'active' | 'resigned' | 'all' }) {
    if (!id) {
      return "";
    }
    if (searchParams?.status === 'all') {
      return `all:${id}`;
    }
    if (searchParams?.status === 'resigned') {
      return `resigned:${id}`;
    }
    return id;
  }

  public async prefetchAccounts(ids: string[], searchParams?: { status?: 'active' | 'resigned' | 'all' }) {
    if (!ids?.length) return;
    const uniqueIds = [...new Set(ids.filter(Boolean).map(id => String(id)).filter(id => id !== "0"))];
    const missingIds = uniqueIds.filter(id => {
      const cacheKey = this.getAccountCacheKey(id, searchParams);
      if (this._accountCache.has(cacheKey)) {
        return false;
      }
      return !this.getCachedOrganizationAccount(id, searchParams);
    });
    if (!missingIds.length) return;
    const resolvers = new Map<string, (value: Account | null) => void>();
    for (const id of missingIds) {
      const cacheKey = this.getAccountCacheKey(id, searchParams);
      this._accountCache.set(cacheKey, new Promise(resolve => resolvers.set(id, resolve)));
    }
    try {
      const { users: rawAccounts } = await this.organizeUtil.getUserByOptions({
        accountIds: missingIds,
        ...(searchParams || {}),
      }) as { users?: Account[] };
      const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
      const accountMap = new Map<string, Account>(accounts.map(account => [account.id, account]));
      for (const id of missingIds) {
        const resolve = resolvers.get(id);
        if (resolve) {
          const account = accountMap.get(id) ?? null;
          this.setResolvedAccountCache(id, account, searchParams);
          resolve(account);
        }
      }
      this.touchRowPermissionAccountVersion();
    } catch (err) {
      for (const id of missingIds) {
        const resolve = resolvers.get(id);
        if (resolve) {
          resolve(null);
        }
        this.setResolvedAccountCache(id, null, searchParams);
        this._accountCache.delete(this.getAccountCacheKey(id, searchParams));
      }
      this.touchRowPermissionAccountVersion();
    }
  }

  public async getFilteredPrintTemplatesCached(nocodeId: string, tableId: TableUID) {
    if (!nocodeId || !tableId) return [];
    const key = `${nocodeId}::${tableId}`;
    const cached = this._filteredPrintTemplateCache.get(key);
    if (cached) {
      return await cached;
    }
    const request = axios.get("project/get-filtered-print-template", {
      params: { nocodeId, tableId },
    }).then(res => res.data).catch(err => {
      this._filteredPrintTemplateCache.delete(key);
      throw err;
    });
    this._filteredPrintTemplateCache.set(key, request);
    return await request;
  }

  async getAccount(id: string) {
    return await this._accountCache.get(id);
  }

  private setResolvedAccountCache(id: string, account: Account | null, searchParams?: { status?: 'active' | 'resigned' | 'all' }) {
    if (!id) {
      return;
    }
    if (searchParams?.status === 'all') {
      this._resolvedAccountCache.set(`all:${id}`, account);
      if (account?.resigned) {
        this._resolvedAccountCache.set(`resigned:${id}`, account);
      } else if (account) {
        this._resolvedAccountCache.set(id, account);
      }
      return;
    }
    if (searchParams?.status === 'resigned') {
      this._resolvedAccountCache.set(`resigned:${id}`, account);
      if (account) {
        this._resolvedAccountCache.set(`all:${id}`, account);
      }
      return;
    }
    this._resolvedAccountCache.set(id, account);
    if (account) {
      this._resolvedAccountCache.set(`all:${id}`, account);
    }
  }

  private getCachedOrganizationAccount(id: string, searchParams?: { status?: 'active' | 'resigned' | 'all' }) {
    if (!id || id === "0") {
      return null;
    }
    const cacheKey = this.getAccountCacheKey(id, searchParams);
    if (searchParams?.status === 'all') {
      return this._resolvedAccountCache.get(cacheKey)
        ?? this._resolvedAccountCache.get(id)
        ?? this._resolvedAccountCache.get(`resigned:${id}`)
        ?? null;
    }
    return this._resolvedAccountCache.get(cacheKey) ?? null;
  }

  async getDepartment(id: string) {
    return await this._departmentCache.get(id);
  }
  private async getOrganizeDepartments(searchParams?, isTree=true) {
    let departments: Department[] = await this.organizeUtil.getDepartments(searchParams);
    if (isTree) {
      departments = buildTree(departments);
    }
    const queue = [...departments];
    while (queue.length) {
      const department = queue.pop();
      if (!this._departmentCache.has(department.id)) {
        this._departmentCache.set(department.id, Promise.resolve(department));
        queue.push(...department.children ?? []);
      }
    }
    return departments;
  }
  async getOrganizeUsers(searchParams?) {
    const { users: rawAccounts } = await this.organizeUtil.getUserByOptions(searchParams) as { users?: Account[] };
    const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
    for (const account of accounts) {
      this.setResolvedAccountCache(account.id, account, searchParams);
      this._accountCache.set(this.getAccountCacheKey(account.id, searchParams), Promise.resolve(account));
    }
    if (accounts.length) {
      this.touchRowPermissionAccountVersion();
    }
    return accounts;
  }
  public async getOrganizationDepartment(id: string): Promise<Department> {
    if (!id) {
      return null;
    }
    if (!this._departmentCache.has(id)) {
      this._departmentCache.set(id, new Promise(async (resolve)=>{
        const departments: Department[] = await this.organizeUtil.getDepartments();
        for (const department of departments) {
          this._departmentCache.set(department.id, Promise.resolve(department));
        }
        const department = departments.find(d=>d.id === id);
        resolve(department);
      }));
    }
    return this._departmentCache.get(id);
  }
  public async getOrganizationAccount(id: string, searchParams?: { status?: 'active' | 'resigned' | 'all' }): Promise<Account> {
    if (!id || id === "0") {
      return null;
    }
    const cacheKey = this.getAccountCacheKey(id, searchParams);
    if (!this._accountCache.has(cacheKey)) {
      this._accountCache.set(cacheKey, new Promise(async (resolve)=>{
        const { users: rawAccounts } = await this.organizeUtil.getUserByOptions({
          accountIds: [id],
          ...(searchParams || {}),
        }) as { users?: Account[] };
        const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
        const account = accounts[0] ?? null;
        this.setResolvedAccountCache(id, account, searchParams);
        this.touchRowPermissionAccountVersion();
        resolve(account);
      }));
    }
    return this._accountCache.get(cacheKey);
  }
  get flows() {
    const process = this.formData?.formOptions?.[this.tableProps?.tableUID]?.process;
    if(!process) return [];
    return getFlows(process);
  }

  private getRowSystemFieldValue(row: Row | null | undefined, systemField: SystemField) {
    if (!row) {
      return undefined;
    }

    const fieldUid = this.table?.fields?.find((field) => field.meta?.name === systemField)?.uid;
    if (fieldUid && row[fieldUid] !== undefined) {
      return row[fieldUid];
    }

    return row[systemField];
  }

  getFlow(flowId: string, row?: Row | null): ProcessFlow | null {
    const process = this.formData?.formOptions?.[this.tableProps?.tableUID]?.process;
    if (!process || !flowId) {
      return null;
    }

    const versionSet = new Set<number>();
    const rowVersion = Number(this.getRowSystemFieldValue(row, SystemField.TODO_VERSION));
    if (Number.isInteger(rowVersion) && rowVersion > 0) {
      versionSet.add(rowVersion);
    }

    const currentVersion = Number(process.version);
    if (Number.isInteger(currentVersion) && currentVersion > 0) {
      versionSet.add(currentVersion);
    }

    const versions = Array.from(versionSet);
    for (const version of versions) {
      const flow = getFlowById(getFlows(process, version) || [], flowId);
      if (flow) {
        return flow;
      }
    }

    const versionKeys = Object.keys(process.flowsByVersion || {});
    for (const key of versionKeys) {
      const match = /^v(\d+)$/.exec(key);
      const version = match ? Number(match[1]) : NaN;
      if (!Number.isInteger(version) || versionSet.has(version)) {
        continue;
      }
      const flow = getFlowById(getFlows(process, version) || [], flowId);
      if (flow) {
        return flow;
      }
    }

    return getFlowById(this.flows || [], flowId) || null;
  }

  getFlowLabel(flowId: string, row?: Row | null) {
    return this.getFlow(flowId, row)?.options?.name || flowId;
  }

  get filterDisplayMode() {
    return this.getTableViewMeta('filterDisplayMode') || "popover";
  }
  set filterDisplayMode(value) {
    this.setTableViewMeta('filterDisplayMode', value);
  }

  get rowHeightLevel() {
    return this.getTableViewMeta("rowHeight") || FormTableRowHeight.SMALL;
  }

  set rowHeightLevel(value: FormTableRowHeight) {
    this.setTableViewMeta('rowHeight', value);
  }

  public getRow(uuid: string): Row {
    const row = deepClone(this._data.rows.value.find(row => row[this.rowKey] === uuid)) as Row;
    if (!row) return;
    for(const field of Object.keys(this._subTableData.value)) {
      const subRows = this._subTableData.value[field];
      const subField = this._fields.value.find(f=>f.uid === field);
      const subTable = this.formData.tables.find(t=>t.uid === subField?.meta?.extra?.subTableUID[1]);
      const subRowKey = subTable?.fields.find(f => f.meta?.name === SystemField.KEY)?.uid
      row[field] = subRows.rows.filter(r=>r[subRowKey] === uuid)
    }
    return row;
  }

  public async getFullRow(uuid: string, fieldUID?: FieldUID, applyDisplayFilters = false): Promise<Row> {
    const row = deepClone(this._data.rows.value.find(item => item[this.rowKey] === uuid)) as Row;
    if (!row) {
      return row;
    }

    const targetFieldUIDs = fieldUID ? [fieldUID] : Array.from(this._subTableUIDs.keys());
    const subRuleInfo = applyDisplayFilters ? this.getSearchRules("sub") : undefined;
    const hasMainSearchCondition = applyDisplayFilters && !isEmpty(this.getSearchMainCondition());
    const hasSubSearchCondition = applyDisplayFilters && !isEmpty(this.searchValue?.filter(c => c.uid?.split(".").length > 1));
    const mainMatchedRowKeys = hasMainSearchCondition && hasSubSearchCondition
      ? await this.getSearchMainMatchedRowKeys([uuid])
      : [];
    for (const targetFieldUID of targetFieldUIDs) {
      const subTableUID = this._subTableUIDs.get(targetFieldUID);
      const subTable = subTableUID ? this.getTable(subTableUID[1]) : undefined;
      const relationField = subTable?.fields.find(field => field.meta?.name === SystemField.KEY);
      if (!subTableUID?.[1] || !relationField?.uid) continue;

      const filters = applyDisplayFilters
        ? this.mergeWhereConditionsWithAnd(
          buildSubTableDisplaySearchCondition(
            relationField.uid,
            [uuid],
            mainMatchedRowKeys,
            this.getSubTableSearchCondition(targetFieldUID),
          ),
          deepClone(subRuleInfo?.conditions?.[targetFieldUID]),
        )
        : { [relationField.uid]: uuid };

      const data = await this.getData(subTableUID[1], {
        filters: {
          [subTableUID[1]]: [
            filters,
          ]
        },
        orderBy: SortType.ASC,
      });

      row[targetFieldUID] = data?.rows || [];
    }

    return deepClone(row);
  }

  public getAllRows(): Row[] {
    const rows = this._data.rows.value.map(row => this.getRow(row[this.rowKey]));
    return rows;
  }
}

