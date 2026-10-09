import { AggregateSubmitValidateRule, AggregateTable, ExecuteViewActionEditContext, ExecuteViewActionFailedItem, ExecuteViewActionRequest, ExecuteViewActionResult, FieldAuthValue, FormCondition, FormConditionValueType, FormDataColumn, FormDataOptions, FormDataTable, FormValidateDuplicateIssue, FormValidateSubmitResult, FormWidgetType, FilterRule, KeyValue, LogicalOperator, MemberRange, NocodeBody, NocodeFormData, NocodeStructure, PermissionCategory, PermissionRangeType, PrepareEditViewActionResult, ViewAction, ViewActionBehaviorType, ViewActionConditionScope, ViewActionEditFieldMode, ViewActionFieldId, ViewActionFieldValueType, ViewActionRecordConditionMode, ViewActionTarget, ViewActionTriggerContext, ViewActionTriggerMode, ViewActionViewConditionMode, DataPermissionDataRange, DBInfo, ViewActionTriggerPrecheckItem, ViewActionTriggerPrecheckResult } from '@common/types/nocode';
import { Bucket, Connection, DataChangeType, DraftStorageStatus, Field, FieldUID, FormDataStoreScope, OptionFieldUID, OptionTableUID, QueryOptions, Row, SortType, Table, TableUID, WhereCondition, FormOption, FormValidRule, FormDataStageWhereCondition, ProcessNodeStatus, ProcessNodeType, FormSubmitAllowNoticeMode, FormSubmitValidMode, WidgetSoul, SourceTable } from '@common/types/project';
import { forwardRef, HttpException, Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import type { AggregateSourceTable } from '@common/types/nocode';
import type { ConnectionData } from '@common/types/project';
import { countSerialNumber, evaluateCondition, parseTables, systemColumnUtil, transformFormDataRow, assignWidgetsUid, replaceProcessUID, convertOrderby, convertCondition, getDbColumnKey, transformDeleteRows, transformWhereCondition, convertWhere, deleteDataWithKey, rewriteDataOwnerCompatibility } from './utils';
import { NOCODES_DIR, PREFERENCES, UPLOADS_DIR } from '@main/constants';
import { unique } from '@common/utils/unique';
import { Account, isSystemAdminAccount } from '@common/types/account';
import { rowsDefaultValueCalculation, createFormulaRuntimeByData, type FormulaRuntime, expandLegacyNoProcessDataPermissionGroups, findIdByFormula, FormDataStage, funcMap, getCreateOwnerSystemField, getDataOwnerSystemField, getDefaultDataPermissionOther, getFlowById, getFlows, getFormulaFields, getNocodeDataSourceTableByUID, getUpdateOwnerSystemField, getUUIDSystemField, hasConfiguredValue, isAnonymousAccount, isBuiltinField, isMeetConditionsByRow, isSystemField, normalizeDataPermissionStatus, replaceByFormula, replaceColFieldsByFormula, replaceUID, SystemField, transformCondition, transformFilterRule, getFormulaStr } from "@common/utils";
import { isDataOwnerEnabledTable } from '@common/utils/connection';
import { mergeUpdateFieldIds } from '@common/utils/updateFieldIds';
import { getNocodeBody, getNocodeRuntimeState, getRuntimeCounter, saveNocodeRuntimeState, setRuntimeCounter } from '@main/utils';
import { ConnectionUtils } from '../project/connection.utils';
import { DbManager } from './db.manager';
import { RequestStorage } from '@main/middleware';
import { WorkbenchService } from '../workbench/workbench.service';
import { isEmpty, deepClone, equals } from '@common/utils/object';
import dayjs from 'dayjs';
import { DataChangeFlowQueueState, DocumentIndexKey, FlowDerivedPostMutationOptions, FlowTriggerResult, TriggerOptions } from './types';
import { FormFlowService } from './form-flow.service';
import { intersection, keys, merge } from "lodash";
import AsyncLock from 'async-lock';
import Piscina from "piscina";
import { extname, join, relative, resolve, sep } from "path";
import { ProjectService } from '../project/project.services';
import { Preferences } from '../common';
import { buildAggregateBucketByOptions, type AggregateRuntimeSource } from '@common/utils/aggregateTable';
import { evaluateFormulaWithRuntime } from '@common/utils/formula';
import { DraftStorageStateService } from './draft-storage-state.service';
import { ProjectionChangePublishToken, ScheduledTriggerRepository } from './scheduled-trigger/scheduled-trigger.repository';
import { assignFieldsAuth, findWidgetSoulByUID } from '@common/utils/element';
import { canViewActionFieldUseCustomValue, getViewActionTriggerMode as resolveViewActionTriggerMode, isViewActionRecordTarget, isViewActionSelectedTarget, isViewActionViewTarget, normalizeViewActionTarget, isViewActionUploadField, isViewActionUploadFieldMultiple, isViewActionUploadFile } from '@common/utils/viewAction';
import { existsSync, statSync } from "fs";
import { convertMarkdownEditorFieldValue, convertMarkdownEditorValue } from "./markdown-editor-storage.util";
import { DataRows, HandleDataResult } from '@common/types/connector';
import type { FormDataFindRequest, FormDataFindResponse } from '@common/types/form-data-find';
import { createFormDataFindMetrics, executeFormDataFind } from './form-data-find';

type UniqueValidationOptions = {
  fullReplace?: boolean;
  skipValidation?: boolean;
  skipLock?: boolean;
  skipSubTableSync?: boolean;
  skipSubTableDeduplicationRebuild?: boolean;
  fullReplaceRelationValue?: string | number;
  fullReplaceRelationValues?: Array<string | number>;
  validateCurrentTable?: boolean;
  fixedUpdateTime?: string;
  restoreFromSnapshot?: boolean;
}
type TryAddDataOptions = {
  stage?: FormDataStage;
  keepSubmitter?: boolean;
  preserveOwners?: boolean;
  preserveCreateOwner?: boolean;
  overrideStage?: FormDataStage;
  scope?: FormDataStoreScope;
  uniqueValidation?: UniqueValidationOptions;
}
type SubTableUpdateFieldMap = Map<FieldUID, ViewActionFieldId[] | null>;

type UniqueRowDescriptor = {
  identity: string;
  rowIndex: number;
  rowUUID?: string;
}

type UniqueValidationError = Error & {
  duplicateIssues?: FormValidateDuplicateIssue[];
}

type MutationCommittedError = Error & {
  mutationCommitted?: boolean;
}

type HandleMutationDataResult = HandleDataResult & {
  errorMessage?: string;
  mutationCommitted?: boolean;
  changedRowIndexes?: number[];
}


type TryDeleteDataResult = HandleDataResult & {
  delegatedToTodo?: boolean;
  mutationApplied?: boolean;
  partialSuccess?: boolean;
  successCount?: number;
  failedCount?: number;
  permissionDeniedCount?: number;
  successRows?: DataRows;
  failedRows?: DataRows;
  permissionDeniedRows?: DataRows;
  delegatedRows?: DataRows;
  mutationAppliedRows?: DataRows;
  queueState?: DataChangeFlowQueueState | null;
}

export type DeleteAllDataPageResult = TryDeleteDataResult & {
  scannedCount: number;
  nextCursor: string;
  errorMessage?: string;
  message?: string;
}

type TryDeleteDataOptions = TriggerOptions & {
  currentRows?: Row[];
  queueState?: DataChangeFlowQueueState | null;
}

type PreparedAddRowsResult = {
  table: Table;
  preparedRows: Row[];
  uniqueValidation: UniqueValidationOptions;
  subTableUIDs: { field: Field, tableUID: OptionTableUID }[];
}

type PreparedUpdateRowsResult = {
  table: Table;
  preparedRows: Row[];
  uniqueValidation: UniqueValidationOptions;
  subTableUIDs: { field: Field, tableUID: OptionTableUID }[];
  subTableUpdateFieldMap: SubTableUpdateFieldMap;
  effectiveUpdateFieldIds: ViewActionFieldId[];
}

type SubFormDeduplicationAggregationType = "NOTAGGRE" | "SUM" | "AVG" | "MAX" | "MIN";

type SubFormDeduplicationRule = {
  fieldUID: FieldUID;
  type: SubFormDeduplicationAggregationType;
}

type SubFormDeduplicationConfig = {
  order: "formula" | "aggregation";
  deduplicationField: Field;
  rules: SubFormDeduplicationRule[];
}

const SUBFORM_DEDUPLICATION_UNSUPPORTED_WIDGET_TYPES = new Set([
  "widget.form.image-uploader",
  "widget.form.file-uploader",
]);

const SUBFORM_DEDUPLICATION_UNORDERED_ARRAY_WIDGET_TYPES = new Set([
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.checkboxGroup",
  "widget.form.treeMultipleSelect",
  "widget.form.tagInput",
  "widget.form.selectData",
  "widget.form.relatedData",
]);

type InternalReadDataOptions = {
  fieldUIDsMap?: Record<string, string[]>;
  enforceFieldReadAuth?: boolean;
  skipReadPermission?: boolean;
}

type FieldPermissionResolveContext = {
  account?: Account | null;
  memberRangeUsersCache?: Map<string, string[]>;
}

type RecalculateTargetFieldInfo = {
  targetField: Field;
}


type ViewActionSearchUUIDResult = {
  hasSubSearch: boolean;
  searchUUIDs: Array<string | number>;
}

type ViewActionTriggerRetryTargets = {
  uniqueRows: Row[];
  affectedCount: number;
  affectedRowsDigest: string;
  batchIndexByUUID: Map<string, number>;
  unavailableTargetUUIDs: string[];
}

type MemberFieldAuth = "all" | Record<string, number>;
type FlowFieldAuth = "all" | Record<string, unknown> | undefined;

type ViewActionFieldTreeNode = {
  all: boolean;
  children: Map<string, ViewActionFieldTreeNode>;
}

type ViewActionCreateMappingFailureReason =
  | "source_unreadable"
  | "target_not_editable"
  | "formula_unreadable";

type ViewActionCreateMappingFailure = {
  fieldId: ViewActionFieldId;
  fieldLabel: string;
  reason: ViewActionCreateMappingFailureReason;
};

type ViewActionCreateMappingState = {
  fieldId: ViewActionFieldId;
  fieldLabel: string;
  applied: boolean;
  failedReason?: ViewActionCreateMappingFailureReason;
};

type ViewActionCreateRowsResult = {
  rows: Row[];
  failedMappings: ViewActionCreateMappingFailure[];
};

const VIEW_ACTION_TRIGGER_CONFIRM_THRESHOLD = 50;
const VIEW_ACTION_TRIGGER_MAX_COUNT = 500;
const VIEW_ACTION_IMAGE_FILE_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
]);

const isUniqueFieldEmpty = (value: any) => isEmpty(value === "" ? null : value);
const isEmptyUUIDValue = (value: any) => value === null || value === undefined || value === "";
const stringifyUniqueValue = (value: any) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
};
const FLOW_TRIGGER_EXECUTION_BATCH_SIZE = 100;

@Injectable()
export class FormDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger('FormDataService');
  private documentIndex: Record<DocumentIndexKey, boolean> = {};
  private lock = new AsyncLock({ timeout: 60 * 1000 });
  private tinypool: Piscina = null;
  private calculate: Piscina = null;
  private readonly recalculateBatchSize = 200;
  private flowDerivedPostMutationEnqueuer?: (options: FlowDerivedPostMutationOptions) => Promise<unknown>;
  private flowDerivedPostMutationPreparer?: (options: FlowDerivedPostMutationOptions) => Promise<{ taskId: string } | null>;
  private flowDerivedPostMutationFailureHandler?: (taskId: string, error: unknown) => Promise<void>;

  constructor(
    @Inject(forwardRef(() => ConnectionUtils)) private readonly connectionUtils: ConnectionUtils,
    @Inject(DbManager) private readonly dbManager: DbManager,
    @Inject(forwardRef(() => WorkbenchService)) private readonly workbenchService: WorkbenchService,
    @Inject(forwardRef(() => FormFlowService)) private readonly formFlowService: FormFlowService,
    @Inject(forwardRef(() => ProjectService)) private readonly projectService: ProjectService,
    private readonly draftStorageStateService: DraftStorageStateService,
    private readonly scheduledTriggerRepository: ScheduledTriggerRepository,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) {
    const searchPath = join(__dirname, "search.js");
    this.tinypool = new Piscina({
      filename: searchPath,
      minThreads: 1,
      maxThreads: 1,
      idleTimeout: 0,
    });
    const calculatePath = join(__dirname, "calculate.js");
    this.calculate = new Piscina({
      filename: calculatePath,
      minThreads: 1,
      maxThreads: 1,
      idleTimeout: 0,
    });
  }

  onApplicationBootstrap() {
    void this.runDataOwnerCompatibilityOnBootstrap();
  }

  registerFlowDerivedPostMutationEnqueuer(
    enqueuer: (options: FlowDerivedPostMutationOptions) => Promise<unknown>,
    preparer?: (options: FlowDerivedPostMutationOptions) => Promise<{ taskId: string } | null>,
    failureHandler?: (taskId: string, error: unknown) => Promise<void>,
  ) {
    this.flowDerivedPostMutationEnqueuer = enqueuer;
    this.flowDerivedPostMutationPreparer = preparer;
    this.flowDerivedPostMutationFailureHandler = failureHandler;
  }

  async prepareFlowDerivedPostMutation(options: FlowDerivedPostMutationOptions) {
    return this.flowDerivedPostMutationPreparer
      ? await this.flowDerivedPostMutationPreparer(options)
      : null;
  }

  async failFlowDerivedPostMutation(taskId: string | undefined, error: unknown) {
    if (taskId && this.flowDerivedPostMutationFailureHandler) {
      await this.flowDerivedPostMutationFailureHandler(taskId, error);
    }
  }

  async enqueueFlowDerivedPostMutation(options: FlowDerivedPostMutationOptions) {
    return this.flowDerivedPostMutationEnqueuer
      ? await this.flowDerivedPostMutationEnqueuer(options)
      : null;
  }

  async migrateLegacyDeletingStagesOnce() {
    const targetVersion = 1;
    if (this.preferences.get("formDataStageMigrationVersion", 0) >= targetVersion) {
      return;
    }

    await this.lock.acquire("form-data-stage-migration", async () => {
      if (this.preferences.get("formDataStageMigrationVersion", 0) >= targetVersion) {
        return;
      }
      const nocodeMetas = await this.projectService.getAllNocodeMetas();
      for (const nocodeMeta of nocodeMetas) {
        if (nocodeMeta.deleted) {
          continue;
        }
        const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeMeta.id).catch((error) => {
          this.logger.warn(`skip form data stage migration because nocode body load failed: ${nocodeMeta.id}`, error?.message || String(error));
          return null;
        });
        const formData = nocodeBody?.formData;
        if (!nocodeBody) {
          this.logger.log(`form data stage migration nocode body load failed: ${nocodeMeta.id}`);
          continue;
        }
        if (!formData?.tables?.length) {
          continue;
        }
        for (const table of formData.tables) {
          const optionTable = formData.options?.tables?.find(item => item.uid === table.meta?.uid);
          const stageField = this.getSystemFieldByName(table, SystemField.DATA_STAGE);
          if (!optionTable || !stageField) {
            continue;
          }
          const db = await this.dbManager.getDB(nocodeMeta.id, optionTable, "main");
          const deletingRows = await db.find({
            [getDbColumnKey(stageField)]: FormDataStage.DELETING,
          });
          for (const row of deletingRows) {
            const uuid = row?.[SystemField.UUID];
            if (!uuid) continue;
            const primaryTableUID = table.meta?.extra?.primaryTable?.[1];
            if (primaryTableUID && row?.[SystemField.KEY]) {
              const primaryTable = formData.tables.find(item => item.uid === primaryTableUID);
              const primaryOptionTable = formData.options?.tables?.find(item => item.uid === primaryTable?.meta?.uid);
              const primaryStageField = this.getSystemFieldByName(primaryTable, SystemField.DATA_STAGE);
              if (primaryTable && primaryOptionTable && primaryStageField) {
                const primaryDb = await this.dbManager.getDB(nocodeMeta.id, primaryOptionTable, "main");
                const deletingParent = await primaryDb.findOne({
                  [SystemField.UUID]: row[SystemField.KEY],
                  [getDbColumnKey(primaryStageField)]: FormDataStage.DELETING,
                });
                if (deletingParent) {
                  continue;
                }
              }
            }
            const targetStage = await this.formFlowService.resolveLegacyDeletingMigrationStage(
              nocodeMeta.id,
              table.uid,
              String(uuid),
              row?.[SystemField.TODO_ID],
              row?.[SystemField.STATUS],
              row?.[SystemField.CURRENT_NODE],
            );
            if (targetStage === FormDataStage.DELETING) {
              continue;
            }
            await db.update({
              [SystemField.UUID]: uuid,
              [getDbColumnKey(stageField)]: FormDataStage.DELETING,
            }, {
              $set: {
                [getDbColumnKey(stageField)]: targetStage,
              },
            }, {
              multi: false,
            });
            if (targetStage === FormDataStage.NORMAL) {
              await db.update({
                [SystemField.UUID]: uuid,
              }, {
                $set: {
                  [SystemField.STATUS]: row?.[SystemField.STATUS] || ProcessNodeStatus.REJECTED,
                  [SystemField.CURRENT_NODE]: [],
                },
              }, {
                multi: false,
              });
            }
          }
        }
      }
      this.preferences.set({ formDataStageMigrationVersion: targetVersion });
      this.logger.log("form data stage migration completed", targetVersion);
    });
  }

  private shouldCheckGlobalUnique(table: Table, field: Field) {
    if (table?.meta?.extra?.primaryTable) {
      return !!field.meta?.extra?.isGlobalUnique;
    }
    return !!field.meta?.extra?.isUnique;
  }

  private shouldCheckSubFormUnique(table: Table, field: Field) {
    return !!table?.meta?.extra?.primaryTable && !!field.meta?.extra?.isUnique;
  }

  private normalizeSerialNumberFieldValue(value: any) {
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

  private getSerialNumberFieldValueIds(value: any) {
    return this.normalizeSerialNumberFieldValue(value)
      .map((item) => typeof item === "object" ? (item?.id ?? item?.uid ?? item?.value) : item)
      .filter(Boolean)
      .map(item => String(item));
  }

  private async getSerialNumberOrganizeLookups(nocodeId: string, tableId: string, newRow: any, fieldId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const table = nocodeBody.formData.tables.find(table => tableId == table.meta.uid);
    const field = table?.fields.find(f => f.uid === fieldId);
    const column = nocodeBody.formData.options.tables.find(item => item.uid === tableId)?.columns?.find(col => col.uid === field?.meta?.uid);
    const serialNumberRules = column?.extra?.serialNumber?.rules || [];
    const targetFields = serialNumberRules
      .filter(rule => rule?.type === "field")
      .map(rule => table?.fields.find(item => item.meta?.uid === rule.value))
      .filter(Boolean);

    const userIds = new Set<string>();
    const departmentIds = new Set<string>();

    for (const targetField of targetFields) {
      const widgetType = targetField.meta?.extra?.widgetType;
      const valueIds = this.getSerialNumberFieldValueIds(newRow?.[targetField.uid]);
      if (widgetType === "widget.form.memberSelect") {
        valueIds.forEach(id => userIds.add(id));
      }
      if (widgetType === "widget.form.departmentSelect") {
        valueIds.forEach(id => departmentIds.add(id));
      }
    }

    if (!userIds.size && !departmentIds.size) {
      return undefined;
    }

    const [users, departments] = await Promise.all([
      userIds.size ? this.workbenchService.filterValidUsers(Array.from(userIds)) : Promise.resolve([]),
      departmentIds.size ? this.workbenchService.getDepartmentsByIds(Array.from(departmentIds)) : Promise.resolve([]),
    ]);

    return { users, departments };
  }

  private hasUniqueValidationFields(table: Table) {
    return !!table?.fields?.some(field => (
      this.shouldCheckGlobalUnique(table, field)
      || this.shouldCheckSubFormUnique(table, field)
    ));
  }

  private getSubFormDuplicateMessage(fields: Field[]) {
    const fieldTitles = fields.map(field => field?.alias || field?.meta?.name).filter(Boolean);
    return global.i18next.t('form.subFormDuplicateFieldTips', {
      field: fieldTitles.join(','),
    });
  }

  private getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }

  private createUniqueValidationQueryError(err: unknown) {
    this.logger.error('Unique validation query failed', err instanceof Error ? err.stack : String(err));
    return new Error(global.i18next.t('form.uniqueValidationFailed'));
  }

  private markMutationCommittedError(err: unknown): MutationCommittedError {
    const error = (err instanceof Error ? err : new Error(this.getErrorMessage(err))) as MutationCommittedError;
    error.mutationCommitted = true;
    return error;
  }

  private getTableMutationLockKey(nocodeId: string, tableUID: string, scope: FormDataStoreScope = "main") {
    return ['table-mutation', scope, nocodeId, tableUID].join(':');
  }

  private async runWithTableMutationLock<T>(
    nocodeId: string,
    tableUID: string,
    scope: FormDataStoreScope = "main",
    handler: () => Promise<T>,
  ): Promise<T> {
    return await this.lock.acquire(this.getTableMutationLockKey(nocodeId, tableUID, scope), handler);
  }

  private async ensureDataOwnerBackfilled(nocodeId: string, optionTable: FormDataTable, scope: FormDataStoreScope) {
    const db = await this.dbManager.getDB(nocodeId, optionTable, scope);
    try {
      await db.updateManyColumns({
        $and: [
          {
            [SystemField.CREATE_OWNER]: {
              $exists: true,
              $nin: [null, ""],
            },
          },
          {
            $or: [
              { [SystemField.DATA_OWNER]: { $exists: false } },
              { [SystemField.DATA_OWNER]: null },
              { [SystemField.DATA_OWNER]: "" },
            ],
          },
        ],
      }, {
        [SystemField.DATA_OWNER]: SystemField.CREATE_OWNER,
      });
    } catch (err) {
      this.logger.error(`data owner compatibility failed: ${nocodeId}:${optionTable.uid}`, err);
    }

  }

  async ensureNocodeDataOwnerCompatible(nocodeId: string, formData?: NocodeFormData) {
    let currentFormData = formData;
    let loadFailed = false;
    if (!currentFormData) {
      const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId).catch((error) => {
        loadFailed = true;
        this.logger.warn(`skip data owner compatibility because nocode body load failed: ${nocodeId}`, error?.message || String(error));
        return null;
      });
      currentFormData = nocodeBody?.formData;
    }

    if (loadFailed) {
      return false;
    }

    if (!currentFormData?.tables?.length || !currentFormData?.options?.tables?.length) {
      return true;
    }

    let success = true;
    for (const table of currentFormData.tables) {
      const optionTable = currentFormData.options.tables.find(item => item.uid === table.meta?.uid);
      if (!optionTable || !isDataOwnerEnabledTable(table)) {
        continue;
      }
      try {
        await this.ensureDataOwnerBackfilled(nocodeId, optionTable, "main");
      } catch (error) {
        success = false;
        this.logger.error(`data owner compatibility failed: ${nocodeId}:${optionTable.uid}`, error?.message || String(error));
      }
    }

    return success;
  }

  private async runDataOwnerCompatibilityOnBootstrap() {
    if (this.preferences.get('isDataOnwerComptible', false)) {
      return;
    }
    this.logger.log("runDataOwnerCompatibilityOnBootstrap start");
    try {
      const nocodeMetas = (await this.projectService.getAllNocodeMetas());
      for (const nocodeMeta of nocodeMetas) {
        const status = await this.ensureNocodeDataOwnerCompatible(nocodeMeta.id);
        this.logger.log("runDataOwnerCompatibilityOnBootstrap status", status, nocodeMeta.id, nocodeMeta.name);
      }

      this.preferences.set({
        isDataOnwerComptible: true,
      });
      this.logger.log("runDataOwnerCompatibilityOnBootstrap success");
    } catch (error) {
      this.logger.error("runDataOwnerCompatibilityOnBootstrap failed", error?.message || String(error));
    }
  }

  async restoreRowsFromSnapshot(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
    keys: OptionFieldUID[],
    scope: FormDataStoreScope = "main",
    options?: TriggerOptions,
  ) {
    if (isEmpty(rows) || isEmpty(keys)) {
      return;
    }

    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return;
    }
    if (scope === "main") {
      await this.tryUpdateData(
        formData,
        nocodeId,
        tableUID,
        rows,
        keys,
        null,
        {
          triggerTodo: false,
          validatePermission: false,
          ...(options || {}),
        },
        {
          validateCurrentTable: true,
          restoreFromSnapshot: true,
        },
      );
      return;
    }

    await this.updateData(
      formData,
      nocodeId,
      tableUID,
      rows,
      keys,
      null,
      scope,
      {
        restoreFromSnapshot: true,
      },
    );
  }

  private getFieldStorageKey(field?: Field) {
    if (!field) {
      return "";
    }
    return getDbColumnKey(field);
  }

  private buildAllowedUpdateFieldKeys(table: Table, updateFieldIds: ViewActionFieldId[] = []) {
    if (!Array.isArray(updateFieldIds) || !updateFieldIds.length) {
      return undefined;
    }

    const fieldKeys = new Set<string>();
    for (const rawFieldId of updateFieldIds) {
      const fieldId = String(rawFieldId || "");
      if (!fieldId || fieldId.includes(".")) {
        continue;
      }

      const field = table?.fields?.find(item => item.uid === fieldId);
      if (!field || field.meta?.extra?.subTableUID?.[1]) {
        continue;
      }

      const storageKey = this.getFieldStorageKey(field);
      if (storageKey) {
        fieldKeys.add(storageKey);
      }
    }

    return [...fieldKeys];
  }

  private buildSubTableUpdateFieldMap(
    formData: NocodeFormData,
    table: Table,
    updateFieldIds: ViewActionFieldId[] = [],
  ): SubTableUpdateFieldMap {
    const result: SubTableUpdateFieldMap = new Map();
    if (!Array.isArray(updateFieldIds) || !updateFieldIds.length) {
      return result;
    }

    for (const rawFieldId of updateFieldIds) {
      const [fieldUID, subFieldUID] = String(rawFieldId || "").split(".");
      if (!fieldUID) {
        continue;
      }

      const field = table?.fields?.find(item => item.uid === fieldUID);
      const subTableUID = field?.meta?.extra?.subTableUID?.[1];
      if (!field || !subTableUID) {
        continue;
      }

      if (!subFieldUID) {
        result.set(field.uid, null);
        continue;
      }

      if (result.get(field.uid) === null) {
        continue;
      }

      const subTable = formData.tables.find(item => item.uid === subTableUID);
      const subField = subTable?.fields?.find(item => item.uid === subFieldUID);
      if (!subField) {
        continue;
      }

      const current = result.get(field.uid) || [];
      if (!current.includes(subField.uid as ViewActionFieldId)) {
        current.push(subField.uid as ViewActionFieldId);
      }
      result.set(field.uid, current);
    }

    return result;
  }

  private getSubTableUpdateFieldIds(subTableUpdateFieldMap: SubTableUpdateFieldMap, fieldUID: FieldUID) {
    if (!subTableUpdateFieldMap.size || !subTableUpdateFieldMap.has(fieldUID)) {
      return undefined;
    }
    const updateFieldIds = subTableUpdateFieldMap.get(fieldUID);
    return updateFieldIds == null ? [] : updateFieldIds;
  }

  private buildControlledUpdateItem(nextRow: Record<string, any>, allowedUpdateFieldKeys?: string[]) {
    if (!Array.isArray(allowedUpdateFieldKeys)) {
      return deepClone(nextRow || {});
    }

    const updateItem: Record<string, any> = {};
    for (const key of allowedUpdateFieldKeys) {
      if (Object.prototype.hasOwnProperty.call(nextRow || {}, key)) {
        updateItem[key] = deepClone(nextRow[key]);
      }
    }

    for (const systemKey of [SystemField.UPDATE_TIME, SystemField.UPDATE_OWNER, SystemField.DATA_STAGE]) {
      if (Object.prototype.hasOwnProperty.call(nextRow || {}, systemKey)) {
        updateItem[systemKey] = deepClone(nextRow[systemKey]);
      }
    }

    return updateItem;
  }

  private buildControlledInsertRows(
    table: Table,
    rows: Row[] = [],
    updateFieldIds?: ViewActionFieldId[],
    extraFieldUIDs: FieldUID[] = [],
  ) {
    const uuidField = getUUIDSystemField(table?.fields || []);
    const hasExplicitRestrictions = Array.isArray(updateFieldIds) && updateFieldIds.length > 0;
    const allowedFieldUIDs = new Set<string>();

    if (hasExplicitRestrictions) {
      for (const fieldUID of extraFieldUIDs || []) {
        if (fieldUID) {
          allowedFieldUIDs.add(fieldUID);
        }
      }
      for (const rawFieldId of updateFieldIds) {
        const fieldId = String(rawFieldId || "");
        if (!fieldId || fieldId.includes(".")) {
          continue;
        }

        const field = table?.fields?.find(item => item.uid === fieldId);
        if (!field || field.meta?.name === SystemField.UUID) {
          continue;
        }
        allowedFieldUIDs.add(field.uid);
      }
    }

    return (rows || []).map((row) => {
      const sourceRow = deepClone(row || {});
      const insertRow: Record<string, any> = {};

      if (hasExplicitRestrictions) {
        for (const fieldUID of allowedFieldUIDs) {
          if (Object.prototype.hasOwnProperty.call(sourceRow, fieldUID)) {
            insertRow[fieldUID] = sourceRow[fieldUID];
          }
        }
      } else {
        Object.assign(insertRow, sourceRow);
      }

      if (uuidField?.uid) {
        delete insertRow[uuidField.uid];
      }

      return insertRow;
    });
  }

  private buildUpdatedRowSnapshot(previousRow: Record<string, any>, updateItem: Record<string, any>) {
    const snapshot = deepClone(previousRow || {});
    delete snapshot._id;
    Object.assign(snapshot, deepClone(updateItem || {}));
    return snapshot;
  }

  private resolveFieldAuthValue(value: unknown): number {
    if (value === FieldAuthValue.VISIBLE_EDITABLE) return FieldAuthValue.VISIBLE_EDITABLE;
    if (value === FieldAuthValue.VISIBLE) return FieldAuthValue.VISIBLE;
    return FieldAuthValue.HIDDEN;
  }

  private getFieldAuthValue(fieldAuth: MemberFieldAuth, field?: Field, defaultWhenMissing = FieldAuthValue.HIDDEN) {
    if (!field) {
      return defaultWhenMissing;
    }
    if (!fieldAuth || fieldAuth === "all") {
      return FieldAuthValue.VISIBLE_EDITABLE;
    }

    const value = fieldAuth[field.meta?.uid] ?? fieldAuth[field.uid];
    if (value === undefined) {
      return defaultWhenMissing;
    }
    return this.resolveFieldAuthValue(value);
  }

  private getExplicitFieldAuthValue(fieldAuth: FlowFieldAuth, field?: Field) {
    if (!field || !fieldAuth || fieldAuth === "all") {
      return undefined;
    }

    const value = fieldAuth[field.meta?.uid] ?? fieldAuth[field.uid];
    if (value === FieldAuthValue.VISIBLE_EDITABLE) {
      return FieldAuthValue.VISIBLE_EDITABLE;
    }
    if (value === FieldAuthValue.VISIBLE) {
      return FieldAuthValue.VISIBLE;
    }
    return undefined;
  }

  private getRowSystemFieldValue(
    table: Table,
    row: Row | null | undefined,
    systemField: SystemField,
  ) {
    if (!row) {
      return undefined;
    }

    const fieldUid = this.getSystemFieldByName(table, systemField)?.uid;
    if (fieldUid && row[fieldUid] !== undefined) {
      return row[fieldUid];
    }

    return row[systemField];
  }

  private buildPermissionDataStatusWhereCondition(
    table: Table,
    dataStatus?: { processing?: boolean; finished?: boolean; noProcess?: boolean } | null,
  ) {
    const normalizedStatus = normalizeDataPermissionStatus(dataStatus);
    const statusField = this.getSystemFieldByName(table, SystemField.STATUS);
    const statusFieldKey = statusField ? getDbColumnKey(statusField) : SystemField.STATUS;
    const currentNodeField = this.getSystemFieldByName(table, SystemField.CURRENT_NODE);
    const currentNodeFieldKey = currentNodeField ? getDbColumnKey(currentNodeField) : SystemField.CURRENT_NODE;
    const conditions: WhereCondition[] = [];

    if (normalizedStatus.processing) {
      conditions.push({
        $or: [
          {
            [statusFieldKey]: ProcessNodeStatus.QUEUED,
          },
          {
            $and: [
              {
                [statusFieldKey]: ProcessNodeStatus.IN_PROGRESS,
              },
              {
                [currentNodeFieldKey]: {
                  $exists: true,
                  $nin: ["", null],
                },
              },
            ],
          },
        ],
      });
    }

    if (normalizedStatus.finished) {
      conditions.push({
        $or: [
          {
            [statusFieldKey]: {
              $exists: true,
              $nin: ["", null, ProcessNodeStatus.QUEUED, ProcessNodeStatus.IN_PROGRESS, ProcessNodeStatus.NOT_STARTED],
            },
          },
          {
            $and: [
              {
                [statusFieldKey]: ProcessNodeStatus.IN_PROGRESS,
              },
              {
                $or: [
                  {
                    [currentNodeFieldKey]: {
                      $exists: false,
                    },
                  },
                  {
                    [currentNodeFieldKey]: {
                      $in: ["", null],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    }

    if (normalizedStatus.noProcess) {
      conditions.push({
        $or: [
          {
            [statusFieldKey]: {
              $exists: false,
            },
          },
          {
            [statusFieldKey]: {
              $in: ["", null, ProcessNodeStatus.NOT_STARTED],
            },
          },
        ],
      });
    }

    if (isEmpty(conditions)) {
      return null;
    }
    return conditions.length === 1 ? conditions[0] : {
      $or: conditions,
    } as WhereCondition;
  }

  private getViewActionEditCurrentFlowIds(table: Table, row: Row | null | undefined) {
    const status = this.getRowSystemFieldValue(table, row, SystemField.STATUS);
    if (status !== ProcessNodeStatus.IN_PROGRESS) {
      return [];
    }

    const currentNodeValue = this.getRowSystemFieldValue(table, row, SystemField.CURRENT_NODE);
    const currentFlowIds = Array.isArray(currentNodeValue)
      ? currentNodeValue
      : typeof currentNodeValue === "string"
        ? currentNodeValue.split(",")
        : [];

    return Array.from(new Set(currentFlowIds
      .map(item => String(item || "").trim())
      .filter(Boolean)));
  }

  private async getViewActionEditFlowFieldAuths(nocodeId: string, formData: NocodeFormData, table: Table, row?: Row | null) {
    const process = formData?.formOptions?.[table.uid]?.process;
    const currentFlowIds = this.getViewActionEditCurrentFlowIds(table, row);
    if (!currentFlowIds.length) {
      return [];
    }
    const flows = await this.formFlowService.getRuntimeFlows(process, {
      nocodeId,
      tableId: table.uid,
      uuid: row?.[SystemField.UUID],
      todoId: row?.[SystemField.TODO_ID],
    });

    return currentFlowIds.map(flowId => getFlowById(flows, flowId)?.options?.fieldAuth);
  }

  private getViewActionCreateFlowFieldAuth(formData: NocodeFormData, table: Table): FlowFieldAuth {
    const process = formData?.formOptions?.[table.uid]?.process;
    if (!process?.enabled) {
      return undefined;
    }
    const flows = getFlows(process) || [];
    const branches = flows[0]?.branches || [];
    const branch = branches.find(item => (
      item.flows?.[0]?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      && item.flows?.[0]?.options?.changeType?.includes(DataChangeType.ADD)
    )) || branches.find(item => item.flows?.[0]?.type === ProcessNodeType.TRIGGER_DATA_CHANGE);
    return branch?.flows?.[0]?.options?.fieldAuth;
  }

  private canEditViewActionFieldByFlowFieldAuth(
    formData: NocodeFormData,
    table: Table,
    resolvedField: {
      fieldId: FieldUID,
      subFieldId: FieldUID | null,
    },
    fieldAuth: FlowFieldAuth,
  ) {
    return this.canAccessViewActionFieldByFlowFieldAuth(
      formData,
      table,
      resolvedField,
      fieldAuth,
      FieldAuthValue.VISIBLE_EDITABLE,
    );
  }

  private canReadViewActionFieldByFlowFieldAuth(
    formData: NocodeFormData,
    table: Table,
    resolvedField: {
      fieldId: FieldUID,
      subFieldId: FieldUID | null,
    },
    fieldAuth: FlowFieldAuth,
  ) {
    return this.canAccessViewActionFieldByFlowFieldAuth(
      formData,
      table,
      resolvedField,
      fieldAuth,
      FieldAuthValue.VISIBLE,
    );
  }

  private canAccessViewActionFieldByFlowFieldAuth(
    formData: NocodeFormData,
    table: Table,
    resolvedField: {
      fieldId: FieldUID,
      subFieldId: FieldUID | null,
    },
    fieldAuth: FlowFieldAuth,
    requiredAuth: FieldAuthValue,
  ) {
    if (!fieldAuth || fieldAuth === "all") {
      return true;
    }

    const field = table.fields.find(item => item.uid === resolvedField.fieldId);
    if ((this.getExplicitFieldAuthValue(fieldAuth, field) ?? FieldAuthValue.HIDDEN) < requiredAuth) {
      return false;
    }

    if (!resolvedField.subFieldId) {
      return true;
    }

    const subTableUID = field?.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID
      ? formData.tables.find(item => item.uid === subTableUID)
      : null;
    const subField = subTable?.fields?.find(item => item.uid === resolvedField.subFieldId);
    return (this.getExplicitFieldAuthValue(fieldAuth, subField) ?? FieldAuthValue.HIDDEN) >= requiredAuth;
  }

  private canEditViewActionFieldByCurrentFlows(
    formData: NocodeFormData,
    table: Table,
    resolvedField: {
      fieldId: FieldUID,
      subFieldId: FieldUID | null,
    },
    flowFieldAuths: FlowFieldAuth[] = [],
  ) {
    if (!flowFieldAuths.length) {
      return true;
    }

    return flowFieldAuths.every(fieldAuth => this.canEditViewActionFieldByFlowFieldAuth(
      formData,
      table,
      resolvedField,
      fieldAuth,
    ));
  }

  private canReadViewActionFieldByCurrentFlows(
    formData: NocodeFormData,
    table: Table,
    resolvedField: {
      fieldId: FieldUID,
      subFieldId: FieldUID | null,
    },
    flowFieldAuths: FlowFieldAuth[] = [],
  ) {
    if (!flowFieldAuths.length) {
      return true;
    }

    return flowFieldAuths.every(fieldAuth => this.canReadViewActionFieldByFlowFieldAuth(
      formData,
      table,
      resolvedField,
      fieldAuth,
    ));
  }

  private async getMemberFieldAuth(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>> | undefined,
    tableUID: TableUID,
    resolveContext?: FieldPermissionResolveContext,
  ): Promise<MemberFieldAuth> {
    let resolvedAccount = resolveContext?.account;
    if (resolvedAccount === undefined) {
      resolvedAccount = await this.getAccount();
      if (resolveContext) {
        resolveContext.account = resolvedAccount;
      }
    }
    if (resolvedAccount.isAdmin || resolvedAccount?.id === "0") {
      return "all";
    }

    const permissions = nocodeBody?.permissions?.field?.[tableUID]?.[PermissionCategory.GET];
    if (isEmpty(permissions)) {
      return "all";
    }

    const fieldsAuth: Record<string, number> = {};
    let hasMatchedPermission = false;
    let hasCustomFieldRange = false;

    for (const permission of permissions) {
      if (permission.memberRange.rangeType === PermissionRangeType.CUSTOM) {
        const rangeKey = JSON.stringify(permission.memberRange.range ?? {});
        let userIds = resolveContext?.memberRangeUsersCache?.get(rangeKey);
        if (!userIds) {
          const users = await this.workbenchService.getUsers(permission.memberRange.range);
          userIds = users.map(user => user.id);
          resolveContext?.memberRangeUsersCache?.set(rangeKey, userIds);
        }
        if (!userIds.includes(resolvedAccount.id)) {
          continue;
        }
      }

      hasMatchedPermission = true;
      if (permission.fieldRange.rangeType === PermissionRangeType.ALL) {
        continue;
      }

      hasCustomFieldRange = true;
      assignFieldsAuth(fieldsAuth, permission.fieldRange.range || {});
    }

    if (!hasMatchedPermission || !hasCustomFieldRange || isEmpty(fieldsAuth)) {
      return "all";
    }

    return fieldsAuth;
  }

  private async getReadableFieldUIDSet(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>> | undefined,
    table?: Table | null,
    resolveContext?: FieldPermissionResolveContext,
  ) {
    if (!table?.uid) {
      return null;
    }

    const fieldAuth = await this.getMemberFieldAuth(nocodeBody, table.uid, resolveContext);
    if (!fieldAuth || fieldAuth === "all") {
      return null;
    }

    return new Set(
      (Array.isArray(table.fields) ? table.fields : [])
        .filter(field => isSystemField(field) || this.getFieldAuthValue(fieldAuth, field) >= FieldAuthValue.VISIBLE)
        .map(field => String(field?.uid || "").trim())
        .filter(Boolean),
    );
  }

  async getAiReadableFieldIds(nocodeId: string, tableUID: TableUID) {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const tables = [
      ...(nocodeBody?.formData?.tables || []),
      ...((nocodeBody?.otherDataSources || []).flatMap((source: any) => source?.tables || [])),
    ] as Table[];
    const table = tables.find(item => item?.uid === tableUID);
    if (!table) {
      return [];
    }

    const readableFieldUIDSet = await this.getReadableFieldUIDSet(nocodeBody, table);
    if (!readableFieldUIDSet) {
      return (Array.isArray(table.fields) ? table.fields : [])
        .map(field => String(field?.uid || "").trim())
        .filter(Boolean);
    }

    return Array.from(readableFieldUIDSet);
  }

  async getApiReadableFieldIds(nocodeId: string, tableUID: TableUID) {
    return await this.getAiReadableFieldIds(nocodeId, tableUID);
  }

  async assertApiFieldsEditable(nocodeId: string, tableUID: TableUID, fieldUIDs: FieldUID[]) {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const tables = [
      ...(nocodeBody?.formData?.tables || []),
      ...((nocodeBody?.otherDataSources || []).flatMap((source: any) => source?.tables || [])),
    ] as Table[];
    const table = tables.find(item => item?.uid === tableUID);
    if (!table) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }

    const fieldAuth = await this.getMemberFieldAuth(nocodeBody, table.uid);
    const requestedFields = new Set((fieldUIDs || []).map(item => String(item || "")).filter(Boolean));
    const denied = table.fields.some(field => (
      requestedFields.has(field.uid)
      && !isSystemField(field)
      && this.getFieldAuthValue(fieldAuth, field) < FieldAuthValue.VISIBLE_EDITABLE
    ));
    if (denied) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
  }

  async getAiReadableFieldIdsMap(nocodeId: string, tableUIDs: TableUID[]) {
    const normalizeTableUID = (value: unknown) => {
      const normalized = String(value || "").trim();
      return normalized ? normalized as TableUID : undefined;
    };
    const normalizedTableUIDs = [...new Set(
      (Array.isArray(tableUIDs) ? tableUIDs : [])
        .map(item => normalizeTableUID(item))
        .filter((item): item is TableUID => Boolean(item)),
    )];
    const result = new Map<TableUID, string[]>();

    if (!normalizedTableUIDs.length) {
      return result;
    }

    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const resolveContext: FieldPermissionResolveContext = {
      memberRangeUsersCache: new Map<string, string[]>(),
    };
    const tables = [
      ...(nocodeBody?.formData?.tables || []),
      ...((nocodeBody?.otherDataSources || []).flatMap((source: any) => source?.tables || [])),
    ] as Table[];
    const tableMap = new Map(
      tables
        .map(table => [normalizeTableUID(table?.uid), table] as const)
        .filter(item => item[0]),
    );

    for (const tableUID of normalizedTableUIDs) {
      const table = tableMap.get(tableUID);
      if (!table) {
        result.set(tableUID, []);
        continue;
      }

      const readableFieldUIDSet = await this.getReadableFieldUIDSet(
        nocodeBody,
        table,
        resolveContext,
      );
      result.set(
        tableUID,
        readableFieldUIDSet
          ? Array.from(readableFieldUIDSet)
          : (Array.isArray(table.fields) ? table.fields : [])
            .map(field => String(field?.uid || "").trim())
            .filter(Boolean),
      );
    }

    return result;
  }

  private filterBucketFieldsByReadableFieldSet(
    fields: Field[] | undefined,
    readableFieldUIDSet: Set<string> | null,
  ) {
    if (!readableFieldUIDSet) {
      return Array.isArray(fields) ? fields : [];
    }

    return (Array.isArray(fields) ? fields : []).filter(field =>
      readableFieldUIDSet.has(String(field?.uid || "").trim()),
    );
  }

  private filterBucketRowsByReadableFieldSet(
    rows: Row[] | undefined,
    fields: Field[] | undefined,
    readableFieldUIDSet: Set<string> | null,
  ) {
    if (!readableFieldUIDSet) {
      return Array.isArray(rows) ? rows : [];
    }

    const fieldIds = new Set(
      (Array.isArray(fields) ? fields : [])
        .map(field => String(field?.uid || "").trim())
        .filter(Boolean),
    );

    return (Array.isArray(rows) ? rows : []).map(row => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return row;
      }

      return Object.entries(row).reduce<Row>((result, [key, value]) => {
        const normalizedKey = String(key || "").trim();
        const baseKey = normalizedKey.endsWith("_entity")
          ? normalizedKey.slice(0, -7)
          : normalizedKey;
        if (!fieldIds.has(baseKey) || readableFieldUIDSet.has(baseKey)) {
          result[key as FieldUID] = value;
        }
        return result;
      }, {} as Row);
    });
  }

  private buildViewActionFieldTree(fieldPaths: string[] = []) {
    const root = new Map<string, ViewActionFieldTreeNode>();
    for (const fieldPath of fieldPaths) {
      if (typeof fieldPath !== "string" || !fieldPath) {
        continue;
      }

      const segments = fieldPath.split(".").filter(Boolean);
      if (!segments.length) {
        continue;
      }

      let currentMap = root;
      for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        let node = currentMap.get(segment);
        if (!node) {
          node = {
            all: false,
            children: new Map<string, ViewActionFieldTreeNode>(),
          };
          currentMap.set(segment, node);
        }

        if (index === segments.length - 1) {
          node.all = true;
        } else {
          currentMap = node.children;
        }
      }
    }

    return root;
  }

  private pickViewActionRowByFieldTree(
    row: Row | null | undefined,
    tree: Map<string, ViewActionFieldTreeNode>,
  ) {
    if (!row) {
      return {};
    }

    const pickedRow: Row = {};
    for (const [fieldId, node] of tree.entries()) {
      if (!Object.prototype.hasOwnProperty.call(row, fieldId)) {
        continue;
      }

      const value = row[fieldId];
      if (node.all || !node.children.size) {
        pickedRow[fieldId] = deepClone(value);
        continue;
      }

      pickedRow[fieldId] = Array.isArray(value)
        ? value.map(item => this.pickViewActionRowByFieldTree(item || {}, node.children))
        : [];
    }

    return pickedRow;
  }

  private sanitizeViewActionPrepareRow(
    row: Row,
    fieldIds: ViewActionFieldId[] = [],
    keyFieldId?: FieldUID,
  ) {
    const prepareFieldIds = [...fieldIds];
    if (keyFieldId) {
      prepareFieldIds.push(keyFieldId as ViewActionFieldId);
    }

    return this.pickViewActionRowByFieldTree(
      row,
      this.buildViewActionFieldTree(prepareFieldIds),
    );
  }

  private collectPrepareEditFieldIds(
    formData: NocodeFormData,
    currentTable: Table,
    resolvedFields: ReturnType<FormDataService["resolveEditActionFields"]>,
  ) {
    const prepareFieldIds = new Set<ViewActionFieldId>(resolvedFields.map(item => item.fieldId));

    for (const { targetField } of resolvedFields) {
      const field = currentTable.fields.find(item => item.uid === targetField.fieldId);
      const subTableUID = field?.meta?.extra?.subTableUID?.[1];
      if (!field || !subTableUID) {
        continue;
      }

      const subTable = formData.tables.find(item => item.uid === subTableUID);
      const subTableUUIDField = getUUIDSystemField(subTable?.fields || []);
      if (subTableUUIDField?.uid) {
        prepareFieldIds.add(`${field.uid}.${subTableUUIDField.uid}` as ViewActionFieldId);
      }
    }

    return [...prepareFieldIds];
  }

  private getSubmittedStageWhereCondition(table: Table): WhereCondition | null {
    const stageField = table?.fields?.find(field => field.meta.name === SystemField.DATA_STAGE);
    const stageFieldKey = stageField ? getDbColumnKey(stageField) : SystemField.DATA_STAGE;

    return {
      $or: [
        { [stageFieldKey]: { $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING] } },
        { [stageFieldKey]: { $exists: false } },
      ],
    };
  }

  private getDefaultReadableStageCondition(): FormDataStageWhereCondition {
    return {
      $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
    };
  }

  private buildTableStageWhereCondition(
    table: Table,
    stage: FormDataStageWhereCondition = FormDataStage.NORMAL,
    enabledStage = true,
  ): WhereCondition | null {
    if (!enabledStage) {
      return null;
    }
    const stageField = table?.fields?.find(item => item.meta.name === SystemField.DATA_STAGE);
    const stageFieldKey = stageField ? getDbColumnKey(stageField) : SystemField.DATA_STAGE;
    if (stage === FormDataStage.NORMAL) {
      return this.getSubmittedStageWhereCondition(table);
    }
    return {
      [stageFieldKey]: stage,
    } as WhereCondition;
  }

  private mergeWhereConditions(...conditions: (WhereCondition | null | undefined)[]) {
    const validConditions = conditions.filter(condition => condition && !isEmpty(condition));
    if (!validConditions.length) {
      return null;
    }
    if (validConditions.length === 1) {
      return validConditions[0];
    }
    return {
      $and: validConditions,
    } as WhereCondition;
  }

  private buildViewActionBaseCondition(
    rowKey: FieldUID,
    matchedUUIDs: string[],
    hasSubCondition: boolean,
    mainCondition: WhereCondition | null | undefined,
    logic: LogicalOperator,
  ) {
    const uuidCondition = hasSubCondition
      ? {
          [rowKey]: {
            $in: matchedUUIDs,
          },
        } as WhereCondition
      : null;
    const hasMainCondition = !isEmpty(mainCondition);

    if (uuidCondition && hasMainCondition) {
      return {
        [logic === LogicalOperator.AND ? "$and" : "$or"]: [
          uuidCondition,
          mainCondition,
        ],
      } as WhereCondition;
    }

    if (uuidCondition) {
      return uuidCondition;
    }

    return hasMainCondition ? mainCondition : null;
  }

  private async getSubmittedRows(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    baseCondition?: WhereCondition,
    options: {
      applyGetPermission?: boolean,
    } = {},
  ) {
    const filterCondition = await this.buildSubmittedRowsFilterCondition(
      nocodeId,
      table,
      baseCondition,
      options,
    );

    const buckets = await this._getData(formData, [table.uid], nocodeId, filterCondition ? {
      filters: {
        [table.uid]: [filterCondition],
      },
      enabledStage: false,
    } : undefined);

    return buckets?.find(bucket => bucket.tableId === table.uid)?.rows ?? [];
  }

  private async getReadPermissionWhereCondition(
    nocodeId: string,
    table: Table,
    stage: FormDataStageWhereCondition,
    account?: Account,
  ): Promise<WhereCondition | null> {
    account = account || await this.getAccount();
    if (isSystemAdminAccount(account)) {
      return null;
    }

    const permissionOwnerGroup = await this.getPermissionOwnerGroup(nocodeId, table.uid, PermissionCategory.GET, account);
    if (permissionOwnerGroup === "all") {
      return null;
    }

    const orQuery = await this.ownerGroupToQuery(permissionOwnerGroup, table, stage, {}, account);
    if (!isEmpty(orQuery)) {
      return orQuery.length > 1 ? {
        $or: orQuery,
      } as WhereCondition : orQuery[0];
    }

    const uuidField = getUUIDSystemField(table.fields);
    return {
      [uuidField ? getDbColumnKey(uuidField) : "_id"]: 1234567890,
    } as WhereCondition;
  }

  private async buildSubmittedRowsFilterCondition(
    nocodeId: string,
    table: Table,
    baseCondition?: WhereCondition,
    options: {
      applyGetPermission?: boolean,
    } = {},
  ) {
    return this.mergeWhereConditions(
      baseCondition,
      this.getSubmittedStageWhereCondition(table),
      options.applyGetPermission
        ? await this.getGetPermissionWhereCondition(nocodeId, table)
        : null,
    );
  }

  private async countSubmittedRows(
    nocodeId: string,
    table: Table,
    baseCondition?: WhereCondition,
    options: {
      applyGetPermission?: boolean,
    } = {},
  ) {
    const filterCondition = await this.buildSubmittedRowsFilterCondition(
      nocodeId,
      table,
      baseCondition,
      options,
    );

    return await this.count(nocodeId, table.uid, filterCondition ? {
      filters: {
        [table.uid]: [filterCondition],
      },
    } : undefined);
  }

  private getViewActionTriggerConfirmMessage(affectedCount: number) {
    return global.i18next.t('formDataService.viewActionTriggerConfirm', { count: affectedCount });
  }

  private getViewActionTriggerRetryConfirmMessage(affectedCount: number) {
    return global.i18next.t('formDataService.viewActionTriggerRetryConfirm', { count: affectedCount });
  }

  private getViewActionTriggerLimitMessage(affectedCount: number) {
    return global.i18next.t('formDataService.viewActionTriggerLimit', {
      count: affectedCount,
      limit: VIEW_ACTION_TRIGGER_MAX_COUNT,
    });
  }

  private getViewActionTriggerRetryLimitMessage(affectedCount: number) {
    return global.i18next.t('formDataService.viewActionTriggerRetryLimit', {
      count: affectedCount,
      limit: VIEW_ACTION_TRIGGER_MAX_COUNT,
    });
  }

  private getViewActionTriggerReconfirmMessage(affectedCount: number) {
    return global.i18next.t('formDataService.viewActionTriggerReconfirm', { count: affectedCount });
  }

  private getViewActionTriggerRetryReconfirmMessage(affectedCount: number) {
    return global.i18next.t('formDataService.viewActionTriggerRetryReconfirm', { count: affectedCount });
  }

  private getViewActionTriggerEmptyMessage() {
    return global.i18next.t('formDataService.viewActionTriggerEmpty');
  }

  private getViewActionTriggerMode(action: ViewAction) {
    return resolveViewActionTriggerMode(action);
  }

  private getViewActionViewConditionMode(action: ViewAction) {
    if (!isViewActionViewTarget(action.target) || action.executeCondition.scope !== ViewActionConditionScope.VIEW) {
      return undefined;
    }
    return action.executeCondition.mode;
  }

  private buildViewActionTriggerContext(
    request: ExecuteViewActionRequest,
    action: ViewAction,
    matchedCount: number,
  ): ViewActionTriggerContext {
    return {
      tableUID: request.tableUID,
      viewId: request.viewId,
      actionId: action.id,
      target: normalizeViewActionTarget(action.target),
      triggerNodeId: action.behavior.type === ViewActionBehaviorType.TRIGGER_PROCESS
        ? action.behavior.config.triggerNodeId
        : "",
      triggerMode: this.getViewActionTriggerMode(action),
      matchedCount,
      targetUUIDs: this.normalizeViewActionTargetUUIDs(request.targetUUIDs),
      filterRule: request.filterRule ? deepClone(request.filterRule) : undefined,
      searchValue: Array.isArray(request.searchValue) ? deepClone(request.searchValue) : undefined,
      filters: request.filters ? deepClone(request.filters) : undefined,
    };
  }

  private normalizeViewActionTargetUUIDs(targetUUIDs?: string[]) {
    return [...new Set((targetUUIDs || []).map(uuid => String(uuid || "").trim()).filter(Boolean))];
  }

  private getViewActionRowDataTitle(table: Table, row?: Row | null) {
    const dataTitleField = table.fields.find(field => field.meta.name === SystemField.DATA_TITLE);
    const uuidField = getUUIDSystemField(table.fields);
    const dataTitle = dataTitleField?.uid ? row?.[dataTitleField.uid] : undefined;
    const fallbackTitle = uuidField?.uid ? row?.[uuidField.uid] : undefined;
    return String(dataTitle || fallbackTitle || global.i18next.t('formDataService.unnamedData')).trim();
  }

  private buildViewActionRetryUnavailableFailedItem(
    uuid: string,
    index: number,
  ): ExecuteViewActionFailedItem {
    return {
      index,
      uuid,
      dataTitle: uuid,
      message: global.i18next.t('formDataService.retryUnavailableMessage'),
      suggestion: global.i18next.t('formDataService.retryUnavailableSuggestion'),
    };
  }

  private async getGetPermissionWhereCondition(nocodeId: string, table: Table) {
    const account = await this.getAccount();
    if (isSystemAdminAccount(account)) {
      return null;
    }

    const permissionOwnerGroup = await this.getPermissionOwnerGroup(nocodeId, table.uid, PermissionCategory.GET);
    if (permissionOwnerGroup === "all") {
      return null;
    }

    const uuidField = getUUIDSystemField(table.fields);
    const orQuery = await this.ownerGroupToQuery(permissionOwnerGroup, table);
    if (isEmpty(orQuery)) {
      return uuidField?.uid
        ? {
            [uuidField.uid]: {
              $in: [],
            },
          }
        : {
            $or: [],
          };
    }

    return orQuery.length > 1
      ? { $or: orQuery }
      : orQuery[0];
  }
  private getSubFormPrimaryTable(formData: NocodeFormData, table: Table) {
    const primaryTableUID = table?.meta?.extra?.primaryTable?.[1];
    if (!primaryTableUID) {
      return null;
    }
    return formData?.tables?.find(item => item.uid === primaryTableUID) ?? null;
  }

  private getSubFormParentField(primaryTable: Table | null | undefined, subTableUID?: TableUID | null) {
    if (!primaryTable || !subTableUID) {
      return null;
    }
    return primaryTable.fields.find(field => field.meta?.extra?.subTableUID?.[1] === subTableUID) ?? null;
  }

  private getSubFormWidgetSoul(formData: NocodeFormData, primaryTable: Table, subFormField: Field) {
    const rootSoul = formData.formOptions?.[primaryTable.uid]?.widget as WidgetSoul | undefined;
    if (!rootSoul || !subFormField?.meta?.uid) {
      return null;
    }
    return findWidgetSoulByUID([rootSoul], subFormField.meta.uid) ?? null;
  }

  private resolveSubFormWidgetField(subTable: Table, widgetUID?: string | null) {
    if (!subTable || !widgetUID) {
      return null;
    }
    return subTable.fields.find(field => field.meta?.uid === widgetUID || field.uid === widgetUID) ?? null;
  }

  private getSubFormDeduplicationConfig(
    formData: NocodeFormData,
    primaryTable: Table,
    subFormField: Field,
    subTable: Table,
  ): SubFormDeduplicationConfig | null {
    const subFormSoul = this.getSubFormWidgetSoul(formData, primaryTable, subFormField);
    const options = subFormSoul?.options as Record<string, any> | undefined;
    if (!options?.["deduplication-aggregation"]) {
      return null;
    }

    const deduplicationField = this.resolveSubFormWidgetField(subTable, String(options["deduplication-field"] || ""));
    const deduplicationWidgetType = deduplicationField?.meta?.extra?.widgetType;
    if (!deduplicationField || SUBFORM_DEDUPLICATION_UNSUPPORTED_WIDGET_TYPES.has(deduplicationWidgetType)) {
      return null;
    }

    const rawRules = Array.isArray(options["aggregation-rules"])
      ? options["aggregation-rules"]
      : [];
    const rules = rawRules.map((item) => {
      const field = this.resolveSubFormWidgetField(subTable, String(item?.field || ""));
      if (!field) {
        return null;
      }
      return {
        fieldUID: field.uid,
        type: item?.type || "NOTAGGRE",
      } as SubFormDeduplicationRule;
    }).filter(Boolean);

    return {
      order: options["aggregation-order"] === "aggregation" ? "aggregation" : "formula",
      deduplicationField,
      rules,
    };
  }

  private encodeSubFormDeduplicationPrimitive(value: any) {
    if (value === undefined) return { __dedupeType: "undefined" };
    if (typeof value === "number" && Number.isNaN(value)) return { __dedupeType: "number", value: "NaN" };
    if (value === Number.POSITIVE_INFINITY) return { __dedupeType: "number", value: "Infinity" };
    if (value === Number.NEGATIVE_INFINITY) return { __dedupeType: "number", value: "-Infinity" };
    if (value === null) return { __dedupeType: "null" };
    return value;
  }

  private stringifySubFormDeduplicationValue(value: any) {
    return JSON.stringify([value], (_, currentValue) => {
      return this.encodeSubFormDeduplicationPrimitive(currentValue);
    });
  }

  private normalizeSubFormDeduplicationValue(
    value: any,
    options: { sortArray?: boolean } = {},
  ): any {
    if (value instanceof Date) return value.toISOString();

    if (Array.isArray(value)) {
      const normalized = value.map(item => this.normalizeSubFormDeduplicationValue(item, options));
      if (!options.sortArray) return normalized;
      return normalized.sort((left, right) => {
        return this.stringifySubFormDeduplicationValue(left).localeCompare(this.stringifySubFormDeduplicationValue(right));
      });
    }

    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((result, key) => {
        result[key] = this.normalizeSubFormDeduplicationValue(value[key], options);
        return result;
      }, {});
    }

    return this.encodeSubFormDeduplicationPrimitive(value);
  }

  private getSubFormDeduplicationKey(value: any, field?: Field | null) {
    const widgetType = field?.meta?.extra?.widgetType;
    const sortArray = !!widgetType && SUBFORM_DEDUPLICATION_UNORDERED_ARRAY_WIDGET_TYPES.has(widgetType);
    return this.stringifySubFormDeduplicationValue(this.normalizeSubFormDeduplicationValue(value, {
      sortArray,
    }));
  }

  private normalizeSubFormAggregationNumber(value: any) {
    const normalized = Number(value);
    return Number.isNaN(normalized) ? 0 : normalized;
  }

  private mergeSubFormRowsByDeduplicationConfig(
    rows: Row[] = [],
    config: SubFormDeduplicationConfig,
  ) {
    if (isEmpty(rows)) {
      return rows;
    }

    const map = new Map<string, Row & { _count: number }>();
    for (const currentRow of rows) {
      const row = deepClone(currentRow || {});
      const key = this.getSubFormDeduplicationKey(row?.[config.deduplicationField.uid], config.deduplicationField);
      if (!map.has(key)) {
        const base = { ...row };
        for (const rule of config.rules) {
          if (rule.type === "NOTAGGRE") continue;
          base[rule.fieldUID] = this.normalizeSubFormAggregationNumber(base[rule.fieldUID]);
        }
        map.set(key, { ...base, _count: 1 });
        continue;
      }

      const existingRow = map.get(key);
      const mergedRow = { ...existingRow };
      mergedRow._count += 1;

      for (const rule of config.rules) {
        if (rule.type === "NOTAGGRE") continue;
        switch (rule.type) {
          case "SUM":
            mergedRow[rule.fieldUID] = this.normalizeSubFormAggregationNumber(existingRow?.[rule.fieldUID]) + this.normalizeSubFormAggregationNumber(row?.[rule.fieldUID]);
            break;
          case "MAX":
            mergedRow[rule.fieldUID] = Math.max(this.normalizeSubFormAggregationNumber(existingRow?.[rule.fieldUID]), this.normalizeSubFormAggregationNumber(row?.[rule.fieldUID]));
            break;
          case "MIN":
            if (existingRow?.[rule.fieldUID] == null) {
              mergedRow[rule.fieldUID] = this.normalizeSubFormAggregationNumber(row?.[rule.fieldUID]);
            } else {
              mergedRow[rule.fieldUID] = Math.min(this.normalizeSubFormAggregationNumber(existingRow?.[rule.fieldUID]), this.normalizeSubFormAggregationNumber(row?.[rule.fieldUID]));
            }
            break;
          case "AVG":
            mergedRow[rule.fieldUID] = (
              this.normalizeSubFormAggregationNumber(existingRow?.[rule.fieldUID]) * existingRow._count
              + this.normalizeSubFormAggregationNumber(row?.[rule.fieldUID])
            ) / mergedRow._count;
            break;
        }
      }

      map.set(key, mergedRow);
    }

    return Array.from(map.values()).map((item) => {
      const { _count, ...row } = item;
      return row;
    });
  }

  private recalculateSubFormFormulaRows(
    formData: NocodeFormData,
    primaryTable: Table,
    subFormField: Field,
    subTable: Table,
    rows: Row[] = [],
  ) {
    if (isEmpty(rows)) {
      return;
    }

    const formulaFields = subTable.fields.reduce<Field[]>((result, field) => {
      const extra = field.meta?.extra || {};
      const formulaText = getFormulaStr(extra?.formula);
      const shouldRecalculate = (
        extra?.defaultValueType === "formula"
        || (extra?.widgetType === FormWidgetType.AUTO_COMPUTE && extra?.computeType === "formula")
      ) && !isEmpty(formulaText);
      if (!shouldRecalculate) {
        return result;
      }

      result.push({
        ...field,
        uid: `${subFormField.uid}.${field.uid}` as FieldUID,
      });
      return result;
    }, []);

    if (!formulaFields.length) {
      return;
    }

    try {
      rowsDefaultValueCalculation(rows, { formulaFields, defaultFields: [] }, primaryTable, formData);
    } catch (error) {
      this.logger.error("subform deduplication formula recalculation failed", primaryTable.uid, subFormField.uid, error);
    }
  }

  private applySubFormDeduplicationToRows(
    formData: NocodeFormData,
    table: Table,
    rows: Row[] = [],
    options: { fieldUIDs?: Set<FieldUID> } = {},
  ) {
    if (!table || isEmpty(rows) || table.meta?.extra?.primaryTable) {
      return rows;
    }

    for (const field of table.fields) {
      if (!field.meta?.extra?.subTableUID?.[1]) {
        continue;
      }
      if (options.fieldUIDs?.size && !options.fieldUIDs.has(field.uid)) {
        continue;
      }

      const subTable = formData.tables.find(item => item.uid === field.meta?.extra?.subTableUID?.[1]);
      if (!subTable) {
        continue;
      }

      const config = this.getSubFormDeduplicationConfig(formData, table, field, subTable);
      if (!config) {
        continue;
      }

      const candidateRows = rows.filter(row => Array.isArray(row?.[field.uid]) && row[field.uid].length > 0);
      if (!candidateRows.length) {
        continue;
      }

      for (const row of candidateRows) {
        row[field.uid] = this.mergeSubFormRowsByDeduplicationConfig(row[field.uid], config);
      }

      if (config.order === "aggregation") {
        this.recalculateSubFormFormulaRows(formData, table, field, subTable, candidateRows);
      }
    }

    return rows;
  }

  private shouldRebuildSubTableDeduplication(
    table: Table,
    scope: FormDataStoreScope = "main",
    options: UniqueValidationOptions = {},
  ) {
    return scope === "main"
      && !!table?.meta?.extra?.primaryTable
      && !options?.skipSubTableDeduplicationRebuild;
  }

  private async loadRowsByKeys(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    keys: OptionFieldUID[] = [],
    scope: FormDataStoreScope = "main",
  ) {
    if (!table || isEmpty(rows) || isEmpty(keys)) {
      return [];
    }

    const keyFieldUIDs = keys
      .filter(item => item?.[1] === table.uid && item?.[2])
      .map(item => item[2]);
    if (!keyFieldUIDs.length) {
      return [];
    }

    const keyFilters = rows.map((row) => {
      const filter = keyFieldUIDs.reduce((result, fieldUID) => {
        if (isUniqueFieldEmpty(row?.[fieldUID])) {
          return result;
        }
        result[fieldUID] = row[fieldUID];
        return result;
      }, {} as Record<string, any>);
      return isEmpty(filter) ? null : filter;
    }).filter(Boolean);

    if (!keyFilters.length) {
      return [];
    }

    const buckets = await this._getData(formData, [table.uid], nocodeId, {
      filters: {
        [table.uid]: keyFilters,
      },
      enabledStage: false,
      scope,
    });
    return buckets?.find(bucket => bucket.tableId === table.uid)?.rows ?? [];
  }

  private collectSubTableRelationValues(table: Table, rows: Row[] = [], extraRows: Row[] = []) {
    const relationField = table?.fields?.find(field => field.meta?.name === SystemField.KEY);
    if (!relationField) {
      return [];
    }

    return [...new Set(
      [...rows, ...extraRows]
        .map(row => row?.[relationField.uid])
        .filter(value => !isUniqueFieldEmpty(value)),
    )];
  }

  private async rebuildSubTableDeduplicatedRows(
    formData: NocodeFormData,
    nocodeId: string,
    subTable: Table,
    relationValues: Array<string | number> = [],
    scope: FormDataStoreScope = "main",
    options: UniqueValidationOptions = {},
  ) {
    if (!this.shouldRebuildSubTableDeduplication(subTable, scope, options) || !relationValues.length) {
      return;
    }

    const primaryTable = this.getSubFormPrimaryTable(formData, subTable);
    const subFormField = this.getSubFormParentField(primaryTable, subTable.uid);
    const primaryUUIDField = primaryTable ? getUUIDSystemField(primaryTable.fields) : null;
    const relationField = subTable.fields.find(field => field.meta?.name === SystemField.KEY);
    if (!primaryTable || !subFormField || !primaryUUIDField || !relationField) {
      return;
    }

    if (!this.getSubFormDeduplicationConfig(formData, primaryTable, subFormField, subTable)) {
      return;
    }

    const parentBuckets = await this._getData(formData, [primaryTable.uid], nocodeId, {
      filters: {
        [primaryTable.uid]: [{
          [primaryUUIDField.uid]: {
            $in: relationValues,
          },
        }],
      },
      enabledStage: false,
      scope,
    });
    const parentRows = parentBuckets?.find(bucket => bucket.tableId === primaryTable.uid)?.rows ?? [];
    if (!parentRows.length) {
      return;
    }

    const childBuckets = await this._getData(formData, [subTable.uid], nocodeId, {
      filters: {
        [subTable.uid]: [{
          [relationField.uid]: {
            $in: relationValues,
          },
        }],
      },
      enabledStage: false,
      scope,
    });
    const childRows = childBuckets?.find(bucket => bucket.tableId === subTable.uid)?.rows ?? [];
    for (const parentRow of parentRows) {
      parentRow[subFormField.uid] = childRows.filter(row => equals(row?.[relationField.uid], parentRow?.[primaryUUIDField.uid]));
    }

    this.applySubFormDeduplicationToRows(formData, primaryTable, parentRows, {
      fieldUIDs: new Set([subFormField.uid]),
    });

    await this.syncSubTableFieldRows(
      formData,
      nocodeId,
      primaryTable,
      parentRows,
      subFormField,
      [formData.uid, subTable.uid],
      null,
      scope,
      {
        skipLock: options?.skipLock ?? true,
        skipSubTableDeduplicationRebuild: true,
      },
    );
  }

  private async filterSubmittedSubFormRowsByExistingParents(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
  ) {
    if (!table?.meta?.extra?.primaryTable || isEmpty(rows)) {
      return rows;
    }

    const relationField = table.fields.find(field => field.meta.name === SystemField.KEY);
    const primaryTable = this.getSubFormPrimaryTable(formData, table);
    const primaryUUIDField = primaryTable ? getUUIDSystemField(primaryTable.fields) : null;
    if (!relationField || !primaryTable || !primaryUUIDField) {
      return rows;
    }

    const relationValues = [...new Set(
      rows
        .map(row => row?.[relationField.uid])
        .filter(value => !isUniqueFieldEmpty(value)),
    )];
    if (!relationValues.length) {
      return rows;
    }

    const parentCondition = this.mergeWhereConditions(
      {
        [primaryUUIDField.uid]: {
          $in: relationValues,
        },
      },
      this.getSubmittedStageWhereCondition(primaryTable),
    );
    const parentBuckets = await this._getData(formData, [primaryTable.uid], nocodeId, parentCondition ? {
      filters: {
        [primaryTable.uid]: [parentCondition],
      },
      enabledStage: false,
    } : undefined);
    const parentRows = parentBuckets?.find(bucket => bucket.tableId === primaryTable.uid)?.rows ?? [];
    const validParentUUIDs = new Set(
      parentRows
        .map(row => row?.[primaryUUIDField.uid])
        .filter(value => !isUniqueFieldEmpty(value))
        .map(value => stringifyUniqueValue(value)),
    );

    return rows.filter(row => {
      const relationValue = row?.[relationField.uid];
      return isUniqueFieldEmpty(relationValue) || validParentUUIDs.has(stringifyUniqueValue(relationValue));
    });
  }

  private async distinctSubmittedRows(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    fieldId: FieldUID,
    baseCondition?: WhereCondition,
  ) {
    if (table?.meta?.extra?.primaryTable) {
      const submittedRows = await this.getSubmittedRows(formData, nocodeId, table, baseCondition);
      const validRows = await this.filterSubmittedSubFormRowsByExistingParents(formData, nocodeId, table, submittedRows);
      const distinctRows = new Map<string, { value: any, count: number }>();

      for (const row of validRows) {
        const value = row?.[fieldId];
        if (isUniqueFieldEmpty(value)) {
          continue;
        }

        const valueKey = stringifyUniqueValue(value);
        const current = distinctRows.get(valueKey);
        if (current) {
          current.count += 1;
          continue;
        }

        distinctRows.set(valueKey, {
          value,
          count: 1,
        });
      }

      return [...distinctRows.values()];
    }

    const filterCondition = this.mergeWhereConditions(
      baseCondition,
      this.getSubmittedStageWhereCondition(table),
    );

    return await this._distinct(formData, nocodeId, table.uid, fieldId, filterCondition ? {
      filters: {
        [table.uid]: [filterCondition],
      },
    } : undefined);
  }

  private getSubFormUniqueLockKey(table: Table, rows: Row[] = []) {
    const hasGlobalUniqueField = table?.fields?.some(field => this.shouldCheckGlobalUnique(table, field));
    if (hasGlobalUniqueField) {
      return ['subform-unique', table?.uid].join(':');
    }

    const relationField = table?.fields.find(field => field.meta.name === SystemField.KEY);
    const relationKeys = relationField
      ? [...new Set(rows.map(row => row?.[relationField.uid]).filter(value => !isUniqueFieldEmpty(value)).map(value => stringifyUniqueValue(value)))]
      : [];

    return ['subform-single-unique', table?.uid, ...relationKeys.sort()].join(':');
  }

  private shouldValidateCurrentTableInGuard(table: Table, options: UniqueValidationOptions = {}) {
    return !!table
      && this.hasUniqueValidationFields(table)
      && (!!table.meta?.extra?.primaryTable || !!options.validateCurrentTable);
  }

  private getCurrentTableUniqueLockKey(table: Table, rows: Row[] = []) {
    return table?.meta?.extra?.primaryTable
      ? this.getSubFormUniqueLockKey(table, rows)
      : ['table-unique', table?.uid].join(':');
  }

  private getUniqueRowIdentity(row: Row, index: number, uuidFieldUID: string | null) {
    const uuidValue = uuidFieldUID ? row?.[uuidFieldUID] : undefined;
    return !isUniqueFieldEmpty(uuidValue)
      ? `${uuidFieldUID}:${stringifyUniqueValue(uuidValue)}`
      : `__row_index__:${index}`;
  }

  private getUniqueRowDescriptor(row: Row, index: number, uuidFieldUID: string | null): UniqueRowDescriptor {
    const uuidValue = uuidFieldUID ? row?.[uuidFieldUID] : undefined;
    return {
      identity: this.getUniqueRowIdentity(row, index, uuidFieldUID),
      rowIndex: index,
      rowUUID: !isUniqueFieldEmpty(uuidValue) ? String(uuidValue) : undefined,
    };
  }

  private appendDuplicateIssue(
    issueMap: Map<string, FormValidateDuplicateIssue>,
    field: Field,
    rowDescriptor: UniqueRowDescriptor,
  ) {
    const issueKey = `${field.uid}:${rowDescriptor.rowUUID ?? rowDescriptor.rowIndex}`;
    if (issueMap.has(issueKey)) {
      return;
    }

    issueMap.set(issueKey, {
      fieldId: field.uid,
      fieldTitle: field.alias || field.meta?.name,
      rowIndex: rowDescriptor.rowIndex,
      rowUUID: rowDescriptor.rowUUID,
    });
  }

  private createUniqueValidationError(
    table: Table,
    issues: FormValidateDuplicateIssue[],
    fallbackMessage: string,
  ): UniqueValidationError {
    const duplicateFields = table.fields.filter(field => issues.some(issue => issue.fieldId === field.uid));
    const error = new Error(
      table?.meta?.extra?.primaryTable && duplicateFields.length > 0
        ? this.getSubFormDuplicateMessage(duplicateFields)
        : fallbackMessage,
    ) as UniqueValidationError;
    error.duplicateIssues = issues;
    return error;
  }

  private async prepareUniqueValidationContext(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    options: UniqueValidationOptions = {},
  ) {
    const uuidField = getUUIDSystemField(table.fields);
    const relationField = table.fields.find(field => field.meta.name === SystemField.KEY);
    const batchUUIDValues = uuidField
      ? [...new Set(rows.map(row => row?.[uuidField.uid]).filter(value => !isUniqueFieldEmpty(value)))]
      : [];
    const currentRowsByUUID = new Map<string, Row>();

    if (uuidField && batchUUIDValues.length > 0) {
      const buckets = await this._getData(formData, [table.uid], nocodeId, {
        filters: {
          [table.uid]: [{
            [uuidField.uid]: {
              $in: batchUUIDValues,
            }
          }]
        },
        enabledStage: false,
      });
      for (const existingRow of buckets?.[0]?.rows ?? []) {
        const uuidValue = existingRow?.[uuidField.uid];
        if (!isUniqueFieldEmpty(uuidValue)) {
          currentRowsByUUID.set(stringifyUniqueValue(uuidValue), existingRow);
        }
      }
    }

    let finalRows = rows.map(row => {
      if (!uuidField) {
        return row;
      }
      const uuidValue = row?.[uuidField.uid];
      if (isUniqueFieldEmpty(uuidValue)) {
        return row;
      }
      const currentRow = currentRowsByUUID.get(stringifyUniqueValue(uuidValue));
      return currentRow ? { ...currentRow, ...row } : row;
    });

    const explicitRelationValues = relationField && options.fullReplace
      ? [
          ...(!isUniqueFieldEmpty(options.fullReplaceRelationValue) ? [options.fullReplaceRelationValue] : []),
          ...((options.fullReplaceRelationValues || []).filter(value => !isUniqueFieldEmpty(value))),
        ]
      : [];
    const inferredRelationValues = relationField && explicitRelationValues.length === 0
      ? [...new Set(finalRows.map(row => row?.[relationField.uid]).filter(value => !isUniqueFieldEmpty(value)))]
      : [];
    const fullReplaceRelationValues = options.fullReplace && relationField
      ? [...new Set(explicitRelationValues.length > 0 ? explicitRelationValues : inferredRelationValues)]
      : [];
    if (relationField && options.fullReplace && fullReplaceRelationValues.length === 1) {
      finalRows = finalRows.map(row => {
        return {
          ...row,
          [relationField.uid]: fullReplaceRelationValues[0],
        };
      });
    }

    return {
      uuidField,
      relationField,
      finalRows,
      batchUUIDValues,
      fullReplaceRelationValues,
    };
  }

  private collectGlobalUniqueChecks(row: Row, table: Table): (KeyValue & { field: Field })[] {
    const uniqueChecks: (KeyValue & { field: Field })[] = [];
    if (!table || !row) {
      return uniqueChecks;
    }

    for (const key of Object.keys(row)) {
      const field = table.fields.find(f => f.uid === key);
      const value = row[key];
      if (!field) continue;
      if (isSystemField(field)) continue;
      if (!this.shouldCheckGlobalUnique(table, field)) continue;
      if (!isUniqueFieldEmpty(value)) {
        uniqueChecks.push({ key, value, field });
      }
    }

    return uniqueChecks;
  }

  private async checkRowsRepeatUniqueChecks(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    options: UniqueValidationOptions = {},
  ) {
    if (!table || isEmpty(rows)) {
      return [];
    }

    const context = await this.prepareUniqueValidationContext(formData, nocodeId, table, rows, options);
    const duplicateCache = new Map<string, UniqueRowDescriptor[]>();
    const duplicateIssues = new Map<string, FormValidateDuplicateIssue>();
    const queryCache = new Map<string, boolean>();
    const distinctFieldUID = context.uuidField?.uid;

    for (let index = 0; index < context.finalRows.length; index++) {
      const row = context.finalRows[index];
      const rowDescriptor = this.getUniqueRowDescriptor(row, index, context.uuidField?.uid ?? null);

      for (const uniqueCheck of this.collectGlobalUniqueChecks(row, table)) {
        const duplicateKey = `${uniqueCheck.key}:${stringifyUniqueValue(uniqueCheck.value)}`;
        const currentDescriptors = duplicateCache.get(duplicateKey) ?? [];
        const hasCurrentRow = currentDescriptors.some(item => item.identity === rowDescriptor.identity);
        if (!hasCurrentRow && currentDescriptors.length > 0) {
          currentDescriptors.forEach(item => this.appendDuplicateIssue(duplicateIssues, uniqueCheck.field, item));
          this.appendDuplicateIssue(duplicateIssues, uniqueCheck.field, rowDescriptor);
        }
        if (!hasCurrentRow) {
          currentDescriptors.push(rowDescriptor);
          duplicateCache.set(duplicateKey, currentDescriptors);
        }

        if (!queryCache.has(duplicateKey) && distinctFieldUID) {
          const queryConditions: WhereCondition[] = [{ [uniqueCheck.key]: uniqueCheck.value }];
          if (context.fullReplaceRelationValues.length > 0 && context.relationField) {
            queryConditions.push({
              [context.relationField.uid]: {
                $nin: context.fullReplaceRelationValues,
              }
            });
          } else if (context.uuidField && context.batchUUIDValues.length > 0) {
            queryConditions.push({
              [context.uuidField.uid]: {
                $nin: context.batchUUIDValues,
              }
            });
          }

          let res;
          try {
            res = await this.distinctSubmittedRows(
              formData,
              nocodeId,
              table,
              distinctFieldUID,
              { $and: queryConditions },
            );
          } catch (err) {
            throw this.createUniqueValidationQueryError(err);
          }
          queryCache.set(duplicateKey, !!(res && !isEmpty(res)));
        }

        if (queryCache.get(duplicateKey)) {
          (duplicateCache.get(duplicateKey) ?? [rowDescriptor]).forEach(item => {
            this.appendDuplicateIssue(duplicateIssues, uniqueCheck.field, item);
          });
        }
      }
    }

    return [...duplicateIssues.values()];
  }

  private async checkSubFormSingleUniqueRows(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    options: UniqueValidationOptions = {},
  ) {
    if (!table?.meta?.extra?.primaryTable || isEmpty(rows)) {
      return [];
    }

    const uniqueFields = table.fields.filter(field => this.shouldCheckSubFormUnique(table, field));
    if (!uniqueFields.length) {
      return [];
    }

    const context = await this.prepareUniqueValidationContext(formData, nocodeId, table, rows, options);
    const relationField = context.relationField;
    const uuidField = context.uuidField;
    const duplicateIssues = new Map<string, FormValidateDuplicateIssue>();
    const duplicateCache = new Map<string, UniqueRowDescriptor[]>();

    for (let index = 0; index < context.finalRows.length; index++) {
      const row = context.finalRows[index];
      const relationValue = relationField ? row?.[relationField.uid] : "__subform__";
      const rowDescriptor = this.getUniqueRowDescriptor(row, index, uuidField?.uid ?? null);
      for (const field of uniqueFields) {
        const value = row?.[field.uid];
        if (isUniqueFieldEmpty(value)) continue;

        const duplicateKey = `${stringifyUniqueValue(relationValue)}:${field.uid}:${stringifyUniqueValue(value)}`;
        const currentDescriptors = duplicateCache.get(duplicateKey) ?? [];
        const hasCurrentRow = currentDescriptors.some(item => item.identity === rowDescriptor.identity);
        if (!hasCurrentRow && currentDescriptors.length > 0) {
          currentDescriptors.forEach(item => this.appendDuplicateIssue(duplicateIssues, field, item));
          this.appendDuplicateIssue(duplicateIssues, field, rowDescriptor);
        }
        if (!hasCurrentRow) {
          currentDescriptors.push(rowDescriptor);
          duplicateCache.set(duplicateKey, currentDescriptors);
        }
      }
    }

    if (!relationField || context.fullReplaceRelationValues.length > 0) {
      return [...duplicateIssues.values()];
    }

    const relationKeys = [...new Set(context.finalRows.map(row => row?.[relationField.uid]).filter(value => !isUniqueFieldEmpty(value)))];
    if (relationKeys.length > 0) {
      // Legacy submitted child rows may not have a stage field yet, so reuse the
      // submitted-row helper instead of filtering by NORMAL directly.
      const existingRows = await this.getSubmittedRows(formData, nocodeId, table, {
        [relationField.uid]: {
          $in: relationKeys,
        }
      });
      const batchUUIDKeys = new Set(context.batchUUIDValues.map(value => stringifyUniqueValue(value)));
      for (const existingRow of existingRows) {
        const existingRowUUID = uuidField ? existingRow?.[uuidField.uid] : undefined;
        if (!isUniqueFieldEmpty(existingRowUUID) && batchUUIDKeys.has(stringifyUniqueValue(existingRowUUID))) {
          continue;
        }

        for (const field of uniqueFields) {
          const value = existingRow?.[field.uid];
          if (isUniqueFieldEmpty(value)) continue;

          const duplicateKey = `${stringifyUniqueValue(existingRow?.[relationField.uid])}:${field.uid}:${stringifyUniqueValue(value)}`;
          if (duplicateCache.has(duplicateKey)) {
            duplicateCache.get(duplicateKey)?.forEach(item => this.appendDuplicateIssue(duplicateIssues, field, item));
          }
        }
      }
    }

    return [...duplicateIssues.values()];
  }

  private async validateCurrentTableUniqueRows(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    options: UniqueValidationOptions = {},
  ) {
    if (!table || isEmpty(rows)) {
      return;
    }

    const duplicateIssues = new Map<string, FormValidateDuplicateIssue>();
    if (table.meta?.extra?.primaryTable) {
      const subFormIssues = await this.checkSubFormSingleUniqueRows(formData, nocodeId, table, rows, options);
      subFormIssues.forEach(issue => duplicateIssues.set(`${issue.fieldId}:${issue.rowUUID ?? issue.rowIndex}`, issue));
    }

    const globalIssues = await this.checkRowsRepeatUniqueChecks(formData, nocodeId, table, rows, options);
    globalIssues.forEach(issue => duplicateIssues.set(`${issue.fieldId}:${issue.rowUUID ?? issue.rowIndex}`, issue));
    if (duplicateIssues.size > 0) {
      throw this.createUniqueValidationError(
        table,
        [...duplicateIssues.values()],
        global.i18next.t('formFlowService.targetFormHasDuplicateField'),
      );
    }
  }

  async validateTableUniqueRows(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    options: UniqueValidationOptions = {},
  ) {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table || isEmpty(rows)) {
      return;
    }
    await this.validateCurrentTableUniqueRows(formData, nocodeId, table, rows, options);
  }

  private normalizeNestedSubFormRows(
    table: Table,
    rows: Row[] = [],
    field: Field,
    subTable: Table,
  ) {
    const relationField = subTable?.fields.find(item => item.meta.name === SystemField.KEY);
    const normalizedRows: Row[] = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const relationValue = this.getNestedSubFormRelationValue(table, row, rowIndex);
      const subRows = Array.isArray(row?.[field.uid]) ? row[field.uid] : [];
      for (const subRow of subRows) {
        if (relationField && isUniqueFieldEmpty(subRow?.[relationField.uid])) {
          normalizedRows.push({
            ...subRow,
            [relationField.uid]: relationValue,
          });
        } else {
          normalizedRows.push(subRow);
        }
      }
    }

    return normalizedRows;
  }

  private getNestedSubFormRelationValue(table: Table, row: Row, rowIndex: number) {
    const uuidField = getUUIDSystemField(table.fields);
    return !isUniqueFieldEmpty(row?.[uuidField?.uid])
      ? row?.[uuidField.uid]
      : `__pending_parent__:${table.uid}:${rowIndex}`;
  }

  private collectNestedSubFormRelationLockRows(
    table: Table,
    rows: Row[] = [],
    field: Field,
    subTable: Table,
  ) {
    const relationField = subTable?.fields.find(item => item.meta.name === SystemField.KEY);
    if (!relationField) {
      return [];
    }

    const seenRelationKeys = new Set<string>();
    const lockRows: Row[] = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || !Object.prototype.hasOwnProperty.call(row, field.uid) || row[field.uid] == null) {
        continue;
      }

      const relationValue = this.getNestedSubFormRelationValue(table, row, rowIndex);
      if (isUniqueFieldEmpty(relationValue)) {
        continue;
      }

      const relationKey = stringifyUniqueValue(relationValue);
      if (seenRelationKeys.has(relationKey)) {
        continue;
      }

      seenRelationKeys.add(relationKey);
      lockRows.push({
        [relationField.uid]: relationValue,
      });
    }

    return lockRows;
  }

  private collectNestedSubFormUniqueLockKeys(
    formData: NocodeFormData,
    table: Table,
    rows: Row[] = [],
  ) {
    if (!table || isEmpty(rows)) {
      return [];
    }

    const lockKeys = new Set<string>();
    const subTableFields = table.fields.filter(field => !!field.meta?.extra?.subTableUID?.[1]);
    for (const field of subTableFields) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      if (!subTable) {
        continue;
      }

      const normalizedRows = this.normalizeNestedSubFormRows(table, rows, field, subTable);
      const relationLockRows = this.collectNestedSubFormRelationLockRows(table, rows, field, subTable);
      if (!normalizedRows.length && !relationLockRows.length) {
        continue;
      }

      if (this.hasUniqueValidationFields(subTable)) {
        lockKeys.add(this.getSubFormUniqueLockKey(subTable, relationLockRows));
      }

      if (!normalizedRows.length) {
        continue;
      }

      for (const lockKey of this.collectNestedSubFormUniqueLockKeys(formData, subTable, normalizedRows)) {
        lockKeys.add(lockKey);
      }
    }

    return [...lockKeys];
  }

  private normalizeSubTableRows(
    table: Table,
    parentRows: Row[] = [],
    field: Field,
    relationTable: Table,
  ) {
    const parentUUIDField = getUUIDSystemField(table.fields);
    const relationField = relationTable?.fields.find(item => item.meta.name === SystemField.KEY);
    const relationValues: any[] = [];
    const rows: Row[] = [];

    if (!parentUUIDField || !relationField) {
      return {
        relationField,
        relationValues,
        rows,
      };
    }

    for (const parentRow of parentRows) {
      if (!parentRow || !Object.prototype.hasOwnProperty.call(parentRow, field.uid) || parentRow[field.uid] == null) {
        continue;
      }

      const relationValue = parentRow?.[parentUUIDField.uid];
      if (isUniqueFieldEmpty(relationValue)) {
        continue;
      }

      relationValues.push(relationValue);
      const subRows = Array.isArray(parentRow?.[field.uid]) ? parentRow[field.uid] : [];
      for (const subRow of subRows) {
        rows.push({
          ...subRow,
          [relationField.uid]: relationValue,
        });
      }
    }

    return {
      relationField,
      relationValues: [...new Set(relationValues)],
      rows,
    };
  }

  private async ensureSubmittedSubTableRowsStillValid(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    parentRows: Row[] = [],
    field: Field,
    subTableUID: OptionTableUID,
    scope: FormDataStoreScope = "main",
    updateFieldIds?: ViewActionFieldId[],
  ) {
    if (updateFieldIds === undefined) {
      return;
    }

    const relationTable = formData.tables.find(item => item.uid === subTableUID[1]);
    if (!relationTable) {
      return;
    }

    const relationUUIDField = getUUIDSystemField(relationTable.fields);
    const normalized = this.normalizeSubTableRows(table, parentRows, field, relationTable);
    const relationField = normalized.relationField;
    if (!relationField || !relationUUIDField || isEmpty(normalized.relationValues) || isEmpty(normalized.rows)) {
      return;
    }

    const buckets = await this._getData(formData, [subTableUID[1]], nocodeId, {
      filters: {
        [subTableUID[1]]: [{
          [relationField.uid]: {
            $in: normalized.relationValues,
          }
        }],
      },
      enabledStage: false,
      scope,
    });
    const existingRows = buckets?.find(bucket => bucket.tableId === subTableUID[1])?.rows ?? [];
    const existingIDs = new Set<string>();

    for (const existingRow of existingRows) {
      const rowUUID = existingRow?.[relationUUIDField.uid];
      if (isUniqueFieldEmpty(rowUUID)) {
        continue;
      }
      existingIDs.add(String(rowUUID));
    }

    for (const row of normalized.rows) {
      const rowUUID = row?.[relationUUIDField.uid];
      if (isUniqueFieldEmpty(rowUUID)) {
        continue;
      }

      if (!existingIDs.has(String(rowUUID))) {
        throw new Error(global.i18next.t('formDataService.subTableRowChanged'));
      }
    }
  }

  private reconcileDeduplicatedSubTableRowsWithExistingRows(
    formData: NocodeFormData,
    table: Table,
    field: Field,
    relationTable: Table,
    relationField: Field,
    rows: Row[] = [],
    existingRows: Row[] = [],
    relationUUIDField?: Field | null,
  ) {
    if (!relationField || !relationUUIDField || isEmpty(rows) || isEmpty(existingRows)) {
      return rows;
    }

    const config = this.getSubFormDeduplicationConfig(formData, table, field, relationTable);
    if (!config) {
      return rows;
    }

    const getMatchKey = (row?: Row | null) => {
      const relationValueKey = this.getSubFormDeduplicationKey(row?.[relationField.uid]);
      const deduplicationValueKey = this.getSubFormDeduplicationKey(row?.[config.deduplicationField.uid], config.deduplicationField);
      return `${relationValueKey}::${deduplicationValueKey}`;
    };

    const existingRowByUUID = new Map<string, Row>();
    const existingRowsByKey = new Map<string, Row[]>();
    for (const existingRow of existingRows) {
      const rowUUID = existingRow?.[relationUUIDField.uid];
      if (isUniqueFieldEmpty(rowUUID)) {
        continue;
      }

      const rowUUIDKey = String(rowUUID);
      existingRowByUUID.set(rowUUIDKey, existingRow);

      const key = getMatchKey(existingRow);
      const matchedRows = existingRowsByKey.get(key) || [];
      matchedRows.push(existingRow);
      existingRowsByKey.set(key, matchedRows);
    }

    const consumeExistingRow = (targetRow?: Row | null) => {
      const rowUUID = targetRow?.[relationUUIDField.uid];
      if (isUniqueFieldEmpty(rowUUID)) {
        return;
      }

      const key = getMatchKey(targetRow);
      const matchedRows = existingRowsByKey.get(key);
      if (!matchedRows?.length) {
        return;
      }

      const targetUUID = String(rowUUID);
      const matchedIndex = matchedRows.findIndex(item => String(item?.[relationUUIDField.uid]) === targetUUID);
      if (matchedIndex < 0) {
        return;
      }

      matchedRows.splice(matchedIndex, 1);
      if (!matchedRows.length) {
        existingRowsByKey.delete(key);
      }
    };

    for (const row of rows) {
      const rowUUID = row?.[relationUUIDField.uid];
      const currentKey = getMatchKey(row);
      let matchedExistingRowByUUID: Row | undefined;
      if (!isUniqueFieldEmpty(rowUUID)) {
        matchedExistingRowByUUID = existingRowByUUID.get(String(rowUUID));
        if (matchedExistingRowByUUID && getMatchKey(matchedExistingRowByUUID) === currentKey) {
          consumeExistingRow(matchedExistingRowByUUID);
          continue;
        }
      }

      const matchedRows = existingRowsByKey.get(currentKey);
      const matchedExistingRow = matchedRows?.shift();
      if (matchedExistingRow) {
        row[relationUUIDField.uid] = matchedExistingRow[relationUUIDField.uid];
        if (!matchedRows.length) {
          existingRowsByKey.delete(currentKey);
        }
        continue;
      }

      if (matchedExistingRowByUUID) {
        consumeExistingRow(matchedExistingRowByUUID);
      }
    }

    return rows;
  }

  private async syncSubTableFieldRows(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    parentRows: Row[] = [],
    field: Field,
    subTableUID: OptionTableUID,
    stage: FormDataStage = null,
    scope: FormDataStoreScope = "main",
    options: UniqueValidationOptions = {},
    updateFieldIds?: ViewActionFieldId[],
  ) {
    const relationTable = formData.tables.find(item => item.uid === subTableUID[1]);
    if (!relationTable) {
      return;
    }

    const relationUUIDField = getUUIDSystemField(relationTable.fields);
    const normalized = this.normalizeSubTableRows(table, parentRows, field, relationTable);
    const relationField = normalized.relationField;
    if (!relationField || !relationUUIDField || isEmpty(normalized.relationValues)) {
      return;
    }

    const lockRows = normalized.rows.length > 0
      ? normalized.rows
      : normalized.relationValues.map(value => ({
        [relationField.uid]: value,
      }));

    const executeSync = async () => {
      await this.ensureSubmittedSubTableRowsStillValid(
        formData,
        nocodeId,
        table,
        parentRows,
        field,
        subTableUID,
        scope,
        updateFieldIds,
      );

      if (normalized.rows.length > 0 && !options.skipValidation) {
        await this.validateCurrentTableUniqueRows(formData, nocodeId, relationTable, normalized.rows, {
          fullReplace: true,
          fullReplaceRelationValues: normalized.relationValues,
        });
        await this.validateNestedSubFormUniqueRows(formData, nocodeId, relationTable, normalized.rows);
      }

      const buckets = await this._getData(formData, [subTableUID[1]], nocodeId, {
        filters: {
          [subTableUID[1]]: [{
            [relationField.uid]: {
              $in: normalized.relationValues,
            }
          }],
        },
        enabledStage: false,
        scope,
      });
      const existingRows = buckets?.find(bucket => bucket.tableId === subTableUID[1])?.rows ?? [];
      if (scope === "main") {
        this.reconcileDeduplicatedSubTableRowsWithExistingRows(
          formData,
          table,
          field,
          relationTable,
          relationField,
          normalized.rows,
          existingRows,
          relationUUIDField,
        );
      }
      const willAddRows: Row[] = [];
      const willUpdateRows: Row[] = [];
      const willRemoveRows: Row[] = [];
      const currentIDs = new Set<string>();
      const existingIDs = new Set<string>();

      for (const existingRow of existingRows) {
        const rowUUID = existingRow?.[relationUUIDField.uid];
        if (isUniqueFieldEmpty(rowUUID)) {
          continue;
        }
        existingIDs.add(String(rowUUID));
      }

      for (const row of normalized.rows) {
        const rowUUID = row?.[relationUUIDField.uid];
        if (!isUniqueFieldEmpty(rowUUID)) {
          const rowUUIDKey = String(rowUUID);
          if (existingIDs.has(rowUUIDKey)) {
            willUpdateRows.push(row);
            currentIDs.add(rowUUIDKey);
            continue;
          }
        }

        willAddRows.push(row);
      }

      for (const existingRow of existingRows) {
        const rowUUID = existingRow?.[relationUUIDField.uid];
        if (isUniqueFieldEmpty(rowUUID) || !currentIDs.has(String(rowUUID))) {
          willRemoveRows.push(existingRow);
        }
      }

      if (willRemoveRows.length > 0) {
        await this.deleteData(formData, nocodeId, subTableUID[1], willRemoveRows, [[...subTableUID, relationUUIDField.uid]], scope);
      }
      if (willUpdateRows.length > 0) {
        await this.updateSubTableRowsWithinUniqueGuard(
          formData,
          nocodeId,
          subTableUID,
          willUpdateRows,
          relationUUIDField.uid,
          stage,
          scope,
          updateFieldIds,
        );
      }
      if (willAddRows.length > 0) {
        await this.addSubTableRowsWithinUniqueGuard(
          formData,
          nocodeId,
          subTableUID,
          this.buildControlledInsertRows(
            relationTable,
            willAddRows,
            updateFieldIds,
            relationField ? [relationField.uid] : [],
          ),
          stage,
          scope,
        );
      }
    };

    if (options.skipLock) {
      await executeSync();
      return;
    }

    await this.lock.acquire(this.getSubFormUniqueLockKey(relationTable, lockRows), executeSync);
  }

  private async updateSubTableRowsWithinUniqueGuard(
    formData: NocodeFormData,
    nocodeId: string,
    subTableUID: OptionTableUID,
    rows: Row[],
    relationUUIDFieldUID: FieldUID,
    stage: FormDataStage = null,
    scope: FormDataStoreScope = "main",
    updateFieldIds?: ViewActionFieldId[],
  ) {
    // The full replacement set has already been validated inside syncSubTableFieldRows
    // while holding the child-table unique lock.
    await this.updateData(
      formData,
      nocodeId,
      subTableUID[1],
      rows,
      [[...subTableUID, relationUUIDFieldUID]],
      stage,
      scope,
      {
        skipValidation: true,
        skipLock: true,
        skipSubTableDeduplicationRebuild: true,
      },
      updateFieldIds,
    );
  }

  private async addSubTableRowsWithinUniqueGuard(
    formData: NocodeFormData,
    nocodeId: string,
    subTableUID: OptionTableUID,
    rows: Row[],
    stage: FormDataStage = null,
    scope: FormDataStoreScope = "main",
  ) {
    // The full replacement set has already been validated inside syncSubTableFieldRows
    // while holding the child-table unique lock.
    const res = await this.tryAddData(formData, nocodeId, subTableUID[1], rows, {
      stage,
      scope,
      uniqueValidation: {
        skipValidation: true,
        skipLock: true,
        skipSubTableDeduplicationRebuild: true,
      },
    });
    if (!res?.success) {
      throw new Error((res as HandleDataResult & { errorMessage?: string })?.errorMessage || global.i18next.t('NocodeForm.formSubmitFail'));
    }
  }

  private async validateNestedSubFormUniqueRows(formData: NocodeFormData, nocodeId: string, table: Table, rows: Row[] = []) {
    if (!table || isEmpty(rows)) {
      return;
    }

    const subTableFields = table.fields.filter(field => !!field.meta?.extra?.subTableUID?.[1]);
    if (!subTableFields.length) {
      return;
    }

    for (const field of subTableFields) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      if (!subTable) {
        continue;
      }

      const normalizedRows = this.normalizeNestedSubFormRows(table, rows, field, subTable);
      const relationLockRows = this.collectNestedSubFormRelationLockRows(table, rows, field, subTable);
      const relationField = subTable.fields.find(item => item.meta.name === SystemField.KEY);
      if (!normalizedRows.length) {
        continue;
      }

      await this.validateCurrentTableUniqueRows(formData, nocodeId, subTable, normalizedRows, {
        fullReplace: true,
        fullReplaceRelationValues: relationField
          ? relationLockRows.map(row => row?.[relationField.uid]).filter(value => !isUniqueFieldEmpty(value))
          : [],
      });
      await this.validateNestedSubFormUniqueRows(formData, nocodeId, subTable, normalizedRows);
    }
  }

  private async runWithSubFormUniqueGuard<T>(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    options: UniqueValidationOptions = {},
    handler: () => Promise<T>,
  ): Promise<T> {
    const execute = async () => {
      if (!options.skipValidation) {
        if (this.shouldValidateCurrentTableInGuard(table, options)) {
          await this.validateCurrentTableUniqueRows(formData, nocodeId, table, rows, options);
        }
        await this.validateNestedSubFormUniqueRows(formData, nocodeId, table, rows);
      }
      return await handler();
    };

    if (isEmpty(rows) || options.skipLock) {
      return await execute();
    }

    const lockKeys = new Set<string>();
    if (this.shouldValidateCurrentTableInGuard(table, options)) {
      lockKeys.add(this.getCurrentTableUniqueLockKey(table, rows));
    }
    for (const lockKey of this.collectNestedSubFormUniqueLockKeys(formData, table, rows)) {
      lockKeys.add(lockKey);
    }
    const sortedLockKeys = [...lockKeys].filter(Boolean).sort();
    if (!sortedLockKeys.length) {
      return await execute();
    }

    const acquireLocks = async (index: number): Promise<T> => {
      if (index >= sortedLockKeys.length) {
        return await execute();
      }
      return await this.lock.acquire(sortedLockKeys[index], async () => {
        return await acquireLocks(index + 1);
      });
    };

    return await acquireLocks(0);
  }

  async getAccount(): Promise<Account> {
    let { account } = RequestStorage?.current?.req ?? {};
    if (!account) {
      this.logger.warn(global.i18next.t('formDataService.noAccountAnon'));
      account = await this.workbenchService.getAnonymousUser();
    }
    return account;
  }

  private async resolvePermissionAccount(userId?: string, fallbackAccount?: Account | null) {
    if (fallbackAccount) {
      return fallbackAccount;
    }
    const currentAccount = RequestStorage?.current?.req?.account;
    if (userId && currentAccount?.id === userId) {
      return currentAccount;
    }
    if (!userId) {
      return await this.getAccount();
    }
    const accounts = await this.workbenchService.getUsers({
      users: [userId],
      roles: [],
      departments: [],
    });
    return accounts?.[0] || null;
  }

  async canUserReadDataByUUID(
    nocodeId: string,
    tableUID: TableUID,
    userId: string,
    uuid: string,
    options?: Pick<QueryOptions, "stage" | "scope" | "enabledStage">,
  ) {
    const account = await this.resolvePermissionAccount(userId);
    if (!account) {
      return false;
    }
    if (isSystemAdminAccount(account)) {
      return true;
    }

    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData as NocodeFormData;
    const table = formData.tables.find(item => item.uid === tableUID || item.meta?.uid === tableUID);
    if (!table) {
      return false;
    }
    const optionTable = formData.options.tables.find(item => item.uid === table.meta.uid);
    const uuidField = getUUIDSystemField(table.fields);
    if (!optionTable || !uuidField?.uid) {
      return false;
    }

    const db = await this.dbManager.getDB(nocodeId, optionTable, options?.scope || "main");
    const stage = options?.stage ?? this.getDefaultReadableStageCondition();
    const permissionCondition = await this.getReadPermissionWhereCondition(nocodeId, table, stage, account);
    const query = rewriteDataOwnerCompatibility(this.mergeWhereConditions(
      convertCondition({
        [uuidField.uid]: uuid,
      }, table) || {},
      permissionCondition,
      this.buildTableStageWhereCondition(table, stage, options?.enabledStage !== false),
    ));

    return (await db.count(query || {})) > 0;
  }

  private getViewActionContext(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    tableUID: TableUID,
    viewId: string,
    actionId: string,
  ) {
    const tableViews = nocodeBody?.views?.[tableUID] || [];
    const view = tableViews.find(item => item.uid === viewId);
    if (!view) {
      throw new Error(global.i18next.t('formDataService.viewNotFound'));
    }
    const action = (view.actions || []).find(item => item.id === actionId);
    if (!action) {
      throw new Error(global.i18next.t('formDataService.actionNotFound'));
    }
    return {
      view,
      action,
    };
  }

  private getViewActionDisplayName(action?: ViewAction | null) {
    const displayLabel = (action?.display?.label || "").trim();
    if (displayLabel) {
      return displayLabel;
    }

    const actionName = (action?.name || "").trim();
    return actionName || action?.id || global.i18next.t('formDataService.unnamedButton');
  }

  private assertTriggerProcessActionUniqueBinding(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    tableUID: TableUID,
    viewId: string,
    action: ViewAction,
  ) {
    if (action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
      return;
    }

    const triggerNodeId = action.behavior.config.triggerNodeId;
    if (!triggerNodeId) {
      return;
    }

    const tableViews = nocodeBody?.views?.[tableUID] || [];
    for (const view of tableViews) {
      for (const currentAction of view.actions || []) {
        if (currentAction?.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
          continue;
        }
        if (currentAction.behavior.config?.triggerNodeId !== triggerNodeId) {
          continue;
        }
        if (view.uid === viewId && currentAction.id === action.id) {
          continue;
        }

        const viewName = (view.name || "").trim();
        const actionName = this.getViewActionDisplayName(currentAction);
        if (viewName) {
          throw new Error(global.i18next.t('formDataService.triggerNodeBoundByViewAction', {
            viewName,
            actionName,
          }));
        }
        throw new Error(global.i18next.t('formDataService.triggerNodeBoundByAction', { actionName }));
      }
    }
  }

  private async canAccessMemberRange(permission?: MemberRange) {
    if (!permission || permission.rangeType !== PermissionRangeType.CUSTOM) {
      return true;
    }

    const account = await this.getAccount();
    if (isSystemAdminAccount(account)) {
      return true;
    }
    if (isAnonymousAccount(account)) {
      return false;
    }

    const { departments, roles, users } = permission.range || {};
    if (users?.includes(account.id)) {
      return true;
    }
    if (roles?.some(roleId => account.roles.includes(roleId))) {
      return true;
    }
    return await this.workbenchService.isInDepartments(account.departments, departments);
  }

  private async validateViewActionPermission(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    tableUID: TableUID,
    actionId: string,
  ) {
    const permission = nocodeBody?.permissions?.operation?.[tableUID]?.[actionId];
    const hasPermission = await this.canAccessMemberRange(permission);
    if (!hasPermission) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
  }

  private async validateViewPermission(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    tableUID: TableUID,
    viewId: string,
  ) {
    const permission = nocodeBody?.permissions?.view?.[tableUID]?.[viewId]?.[PermissionCategory.GET];
    const hasPermission = await this.canAccessMemberRange(permission);
    if (!hasPermission) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
  }

  private async getSubmittedRowByUUID(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    uuid: string,
  ) {
    const uuidField = getUUIDSystemField(table.fields);
    const rows = await this.getSubmittedRows(formData, nocodeId, table, {
      [uuidField.uid]: uuid,
    }, {
      applyGetPermission: true,
    });
    const filledRows = await this.fillSubmittedRowsSubForms(formData, nocodeId, table, rows);
    return filledRows?.[0] || null;
  }

  private async getPersistedViewActionRowByUUID(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    viewId: string,
    uuid: string,
  ) {
    const uuidField = getUUIDSystemField(table.fields);
    const persistedFilterRules = this.getViewActionPersistedFilterRules(nocodeBody, table.uid, viewId);
    const persistedCondition = await this.buildViewActionPersistedCondition(
      formData,
      nocodeId,
      table,
      persistedFilterRules,
    );
    const rows = await this.getSubmittedRows(formData, nocodeId, table, this.mergeWhereConditions(
      persistedCondition,
      {
        [uuidField.uid]: uuid,
      },
    ), {
      applyGetPermission: true,
    });
    const filledRows = await this.fillSubmittedRowsSubForms(formData, nocodeId, table, rows);
    return filledRows?.[0] || null;
  }

  private async fillSubmittedRowsSubForms(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
  ) {
    if (isEmpty(rows)) {
      return rows;
    }

    const whereConditions: Record<FieldUID, WhereCondition | WhereCondition[]> = {};
    for (const field of table.fields) {
      const subTableUID: TableUID = field.meta?.extra?.subTableUID?.[1];
      if (!subTableUID) {
        continue;
      }

      const subTable = formData.tables.find(item => item.uid === subTableUID);
      const submittedStageWhereCondition = subTable
        ? this.getSubmittedStageWhereCondition(subTable)
        : null;
      if (submittedStageWhereCondition) {
        whereConditions[field.uid] = submittedStageWhereCondition;
      }
    }

    return await this.fillSubFormField(
      rows,
      nocodeId,
      table,
      formData,
      whereConditions,
    );
  }

  private getViewActionFilterRuleInfo(
    filterRule: FilterRule | undefined,
    preFilterRules: FilterRule[] = [],
    type: "main" | "sub",
  ) {
    const logic = filterRule?.logic || LogicalOperator.AND;
    const conditions = filterRule?.conditions || [];

    const pickConditions = (ruleConditions: FormCondition[] = []) => {
      return ruleConditions.filter((condition) => {
        const noValueNeeded = ['\u2205', '!\u2205'].includes(condition.func);
        return condition?.uid?.split(".").length === (type === "main" ? 1 : 2)
          && (noValueNeeded || !isEmpty(condition.value));
      });
    };

    const buildGroup = (ruleConditions: FormCondition[], ruleLogic: LogicalOperator) => {
      if (isEmpty(ruleConditions)) {
        return undefined;
      }
      const whereConditions = ruleConditions.map(condition => transformCondition(condition));
      if (whereConditions.length === 1) {
        return whereConditions[0];
      }
      return {
        [ruleLogic === LogicalOperator.AND ? "$and" : "$or"]: whereConditions,
      } as WhereCondition;
    };

    const originBaseConditions = pickConditions(conditions);
    const preRuleGroups = preFilterRules.map((rule) => {
      const ruleConditions = pickConditions(rule?.conditions || []);
      const group = buildGroup(ruleConditions, rule?.logic || LogicalOperator.AND);
      return group ? { group, logic: rule?.logic || LogicalOperator.AND } : null;
    }).filter(Boolean) as Array<{ group: WhereCondition, logic: LogicalOperator }>;

    let mergedLogic = LogicalOperator.AND;
    if (!isEmpty(originBaseConditions) && !isEmpty(preRuleGroups)) {
      mergedLogic = LogicalOperator.AND;
    } else if (!isEmpty(originBaseConditions)) {
      mergedLogic = logic;
    } else if (preRuleGroups.length === 1) {
      mergedLogic = preRuleGroups[0].logic;
    }

    if (type === "main") {
      const baseConditions = buildGroup(originBaseConditions, logic);
      const preConditions = preRuleGroups.map(item => item.group);
      const preRulesConditionsArray = preConditions.length > 1
        ? { $and: preConditions }
        : preConditions?.[0];

      const allConditions = [baseConditions, preRulesConditionsArray].filter(Boolean) as WhereCondition[];
      const mergedConditions = allConditions.length > 1
        ? { $and: allConditions }
        : (allConditions[0] || {});

      return {
        logic: mergedLogic,
        conditions: mergedConditions,
      };
    }

    const queryGroup: Record<string, WhereCondition[]> = {};
    const buildGroupedByField = (ruleConditions: FormCondition[], ruleLogic: LogicalOperator) => {
      const grouped = ruleConditions.reduce<Record<string, FormCondition[]>>((prev, item) => {
        const [fieldId] = item.uid.split(".");
        if (!prev[fieldId]) {
          prev[fieldId] = [];
        }
        prev[fieldId].push(item);
        return prev;
      }, {});

      const groupedResult: Record<string, WhereCondition> = {};
      for (const fieldId in grouped) {
        const whereConditions = grouped[fieldId].map(condition => transformCondition(condition));
        if (isEmpty(whereConditions)) {
          continue;
        }
        groupedResult[fieldId] = whereConditions.length > 1
          ? { [ruleLogic === LogicalOperator.AND ? "$and" : "$or"]: whereConditions }
          : whereConditions[0];
      }
      return groupedResult;
    };

    const appendGrouped = (grouped: Record<string, WhereCondition>) => {
      for (const fieldId in grouped) {
        if (!queryGroup[fieldId]) {
          queryGroup[fieldId] = [];
        }
        queryGroup[fieldId].push(grouped[fieldId]);
      }
    };

    appendGrouped(buildGroupedByField(originBaseConditions, logic));
    preFilterRules.forEach((rule) => {
      const ruleConditions = pickConditions(rule?.conditions || []);
      appendGrouped(buildGroupedByField(ruleConditions, rule?.logic || LogicalOperator.AND));
    });

    const mergedConditions = Object.entries(queryGroup).reduce<Record<string, WhereCondition>>((prev, [fieldId, whereConditions]) => {
      if (isEmpty(whereConditions)) {
        return prev;
      }
      prev[fieldId] = whereConditions.length > 1
        ? { $and: whereConditions }
        : whereConditions[0];
      return prev;
    }, {});

    return {
      logic: mergedLogic,
      conditions: mergedConditions,
    };
  }

  private async getViewActionRuleMatchedUUIDs(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    subConditions: Record<string, WhereCondition>,
    logic: LogicalOperator,
  ) {
    const uuidGroup = await Promise.all(Object.entries(subConditions || {}).map(async ([fieldId, condition]) => {
      const subTableUID = table.fields.find(field => field.uid === fieldId)?.meta?.extra?.subTableUID?.[1];
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      const relationField = subTable?.fields?.find(field => field.meta.name === SystemField.KEY);
      if (!subTableUID || !subTable || !relationField?.uid) {
        return [];
      }

      const filters = this.mergeWhereConditions(condition, this.getSubmittedStageWhereCondition(subTable));
      return await this.distinct(nocodeId, subTableUID, relationField.uid, {
        filters: {
          [subTableUID]: [filters || {}],
        },
      });
    }));

    if (!uuidGroup.length) {
      return [];
    }

    return logic === LogicalOperator.AND
      ? intersection(...uuidGroup)
      : Array.from(new Set(uuidGroup.flat()));
  }

  private async getViewActionSearchUUIDs(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    searchValue: FormCondition[] = [],
  ): Promise<ViewActionSearchUUIDResult> {
    const searchSubRules = searchValue.filter(condition => condition?.uid?.split(".").length > 1);
    const uuidGroup = await Promise.all(Object.entries(searchSubRules.reduce<Record<string, WhereCondition[]>>((prev, item) => {
      const [fieldId] = item.uid.split(".");
      if (!prev[fieldId]) {
        prev[fieldId] = [];
      }
      prev[fieldId].push(transformCondition(item));
      return prev;
    }, {})).map(async ([fieldId, whereConditions]) => {
      const subTableUID = table.fields.find(field => field.uid === fieldId)?.meta?.extra?.subTableUID?.[1];
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      const relationField = subTable?.fields?.find(field => field.meta.name === SystemField.KEY);
      if (!subTableUID || !subTable || !relationField?.uid || isEmpty(whereConditions)) {
        return [];
      }

      const searchCondition = whereConditions.length > 1
        ? { $or: whereConditions }
        : whereConditions[0];
      const filters = this.mergeWhereConditions(searchCondition, this.getSubmittedStageWhereCondition(subTable));
      return await this.distinct(nocodeId, subTableUID, relationField.uid, {
        filters: {
          [subTableUID]: [filters || {}],
        },
      });
    }));

    return {
      hasSubSearch: !isEmpty(searchSubRules),
      searchUUIDs: Array.from(new Set(uuidGroup.flat())),
    };
  }

  private getViewActionPersistedFilterRules(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    tableUID: TableUID,
    viewId: string,
  ) {
    const view = (nocodeBody?.views?.[tableUID] || []).find(item => item.uid === viewId);
    const rules: FilterRule[] = [];
    const editorFilterRule = nocodeBody?.formData?.metas?.[tableUID]?.filterRules;
    const viewFilterRule = view?.viewFilterRules || (view as any)?.filterRules;
    if (editorFilterRule?.conditions?.length) {
      rules.push(editorFilterRule);
    }
    if (viewFilterRule?.conditions?.length) {
      rules.push(viewFilterRule);
    }
    return rules;
  }

  private async buildViewActionPersistedCondition(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    persistedFilterRules: FilterRule[] = [],
  ) {
    if (isEmpty(persistedFilterRules)) {
      return null;
    }

    const mainRuleInfo = this.getViewActionFilterRuleInfo(undefined, persistedFilterRules, "main");
    const subRuleInfo = this.getViewActionFilterRuleInfo(undefined, persistedFilterRules, "sub");
    const subMatchedUUIDs = await this.getViewActionRuleMatchedUUIDs(
      formData,
      nocodeId,
      table,
      subRuleInfo.conditions as Record<string, WhereCondition>,
      subRuleInfo.logic,
    );
    const rowKey = getUUIDSystemField(table.fields).uid;
    const filtersData = this.buildViewActionBaseCondition(
      rowKey,
      subMatchedUUIDs,
      !isEmpty(subRuleInfo.conditions),
      mainRuleInfo.conditions,
      mainRuleInfo.logic,
    );

    return isEmpty(filtersData) ? null : filtersData;
  }

  private async buildViewActionCondition(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    request: ExecuteViewActionRequest,
  ) {
    const rowKey = getUUIDSystemField(table.fields).uid;
    const targetUUIDs = this.normalizeViewActionTargetUUIDs(request.targetUUIDs);
    const persistedFilterRules = this.getViewActionPersistedFilterRules(nocodeBody, table.uid, request.viewId);
    const persistedCondition = await this.buildViewActionPersistedCondition(
      formData,
      nocodeId,
      table,
      persistedFilterRules,
    );
    const displayFilters = request.filters?.[table.uid];
    const finalDisplayCondition = !isEmpty(displayFilters)
      ? this.mergeWhereConditions(...(Array.isArray(displayFilters) ? displayFilters : [displayFilters]))
      : null;

    if (targetUUIDs.length > 0) {
      return this.mergeWhereConditions(
        {
          [rowKey]: {
            $in: targetUUIDs,
          },
        },
        persistedCondition,
        finalDisplayCondition,
      );
    }

    if (!isEmpty(displayFilters)) {
      const mergedDisplayCondition = this.mergeWhereConditions(persistedCondition, finalDisplayCondition);
      if (!isEmpty(mergedDisplayCondition)) {
        return mergedDisplayCondition;
      }
    }

    const mainRuleInfo = this.getViewActionFilterRuleInfo(request.filterRule, persistedFilterRules, "main");
    const subRuleInfo = this.getViewActionFilterRuleInfo(request.filterRule, persistedFilterRules, "sub");
    const subMatchedUUIDs = await this.getViewActionRuleMatchedUUIDs(
      formData,
      nocodeId,
      table,
      subRuleInfo.conditions as Record<string, WhereCondition>,
      subRuleInfo.logic,
    );
    const searchValue = request.searchValue || [];
    const searchMainRules = searchValue.filter(condition => condition?.uid?.split(".").length === 1);
    const searchWhereConditions = searchMainRules.map(condition => transformCondition(condition));
    const searchMainCondition = searchWhereConditions.length > 1
      ? { $or: searchWhereConditions }
      : searchWhereConditions?.[0];
    const { hasSubSearch, searchUUIDs } = await this.getViewActionSearchUUIDs(formData, nocodeId, table, searchValue);
    let filtersData = this.buildViewActionBaseCondition(
      rowKey,
      subMatchedUUIDs,
      !isEmpty(subRuleInfo.conditions),
      mainRuleInfo.conditions,
      mainRuleInfo.logic,
    );
    const subSearchCondition = hasSubSearch
      ? {
          [rowKey]: {
            $in: searchUUIDs,
          },
        }
      : null;

    const searchCondition = !isEmpty(subSearchCondition) && !isEmpty(searchMainCondition)
      ? {
          $or: [
            subSearchCondition,
            searchMainCondition,
          ],
        }
      : (!isEmpty(subSearchCondition)
          ? subSearchCondition
          : (!isEmpty(searchMainCondition)
              ? searchMainCondition
              : null));

    if (!isEmpty(searchCondition)) {
      filtersData = isEmpty(filtersData)
        ? searchCondition
        : {
            $and: [
              filtersData,
              searchCondition,
            ],
          };
    }

    return isEmpty(filtersData) ? null : filtersData;
  }

  private async getRowsByViewActionFilters(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    request: ExecuteViewActionRequest,
  ) {
    const mergedCondition = await this.buildViewActionCondition(
      nocodeBody,
      formData,
      nocodeId,
      table,
      request,
    );
    return await this.getSubmittedRows(formData, nocodeId, table, mergedCondition, {
      applyGetPermission: true,
    });
  }

  private getUniqueViewActionRows(
    table: Table,
    rows: Row[] = [],
  ) {
    const uuidFieldId = getUUIDSystemField(table.fields).uid;
    const seenUUIDs = new Set<string>();
    return rows.filter((row) => {
      const uuid = String(row?.[uuidFieldId] || "");
      if (!uuid || seenUUIDs.has(uuid)) {
        return false;
      }
      seenUUIDs.add(uuid);
      return true;
    });
  }

  private buildViewActionAffectedRowsDigest(
    table: Table,
    rows: Row[] = [],
  ) {
    const uuidFieldId = getUUIDSystemField(table.fields).uid;
    return rows
      .map(row => String(row?.[uuidFieldId] || ""))
      .filter(Boolean)
      .sort()
      .join(",");
  }

  private async getViewActionTriggerRetryTargets(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    request: ExecuteViewActionRequest,
  ): Promise<ViewActionTriggerRetryTargets> {
    const targetUUIDs = this.normalizeViewActionTargetUUIDs(request.targetUUIDs);
    const uniqueRows = this.getUniqueViewActionRows(
      table,
      await this.getRowsByViewActionFilters(
        nocodeBody,
        formData,
        nocodeId,
        table,
        request,
      ),
    );
    const uuidFieldId = getUUIDSystemField(table.fields).uid;
    const currentUUIDSet = new Set(uniqueRows.map(row => String(row?.[uuidFieldId] || "")));

    return {
      uniqueRows,
      affectedCount: uniqueRows.length,
      affectedRowsDigest: this.buildViewActionAffectedRowsDigest(table, uniqueRows),
      batchIndexByUUID: new Map(targetUUIDs.map((uuid, index) => [uuid, index + 1])),
      unavailableTargetUUIDs: targetUUIDs.filter(uuid => !currentUUIDSet.has(uuid)),
    };
  }

  private async getViewActionRowByUUID(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    request: ExecuteViewActionRequest,
  ) {
    if (!request.uuid) {
      return null;
    }

    const uuidField = getUUIDSystemField(table.fields);
    const viewCondition = await this.buildViewActionCondition(
      nocodeBody,
      formData,
      nocodeId,
      table,
      request,
    );
    const mergedCondition = this.mergeWhereConditions(viewCondition, {
      [uuidField.uid]: request.uuid,
    });

    const rows = await this.getSubmittedRows(formData, nocodeId, table, mergedCondition, {
      applyGetPermission: true,
    });
    const filledRows = await this.fillSubmittedRowsSubForms(formData, nocodeId, table, rows);
    return filledRows?.[0] || null;
  }

  private buildRecordExecuteConditions(action: ViewAction) {
    if (!isViewActionRecordTarget(action.target) || action.executeCondition.scope !== ViewActionConditionScope.RECORD) {
      return [];
    }
    const { mode, conditions = [] } = action.executeCondition;
    if (!conditions.length) {
      return [];
    }
    return mode === ViewActionRecordConditionMode.ANY
      ? conditions.map(condition => [condition])
      : [conditions];
  }

  private async validateViewActionExecuteCondition(
    action: ViewAction,
    table: Table,
    options: {
      currentRow?: Row | null,
      currentRows?: Row[],
      currentCount?: number,
    } = {},
  ) {
    if (!action.executeCondition?.enabled) {
      return;
    }

    if (action.executeCondition.scope === ViewActionConditionScope.VIEW) {
      const count = options.currentCount ?? options.currentRows?.length ?? 0;
      const { mode } = action.executeCondition;
      const isValid = mode === ViewActionViewConditionMode.ALWAYS
        || (mode === ViewActionViewConditionMode.HAS_DATA && count > 0)
        || (mode === ViewActionViewConditionMode.NO_DATA && count === 0);
      if (!isValid) {
        throw new Error(action.executeCondition.tip || global.i18next.t('formDataService.actionConditionUnavailable'));
      }
      return;
    }

    const currentRow = options.currentRow;
    if (!currentRow) {
      throw new Error(global.i18next.t('formDataService.recordNotFound'));
    }

    const conditions = this.buildRecordExecuteConditions(action);
    if (!conditions.length) {
      return;
    }

    const result = isMeetConditionsByRow(
      currentRow,
      conditions,
      { [table.uid]: [currentRow] },
      table.fields,
    );
    if (!result?.valid) {
      throw new Error(action.executeCondition.tip || global.i18next.t('formDataService.actionConditionUnavailable'));
    }
  }

  private getViewActionFieldPath(
    formData: NocodeFormData,
    table: Table,
    fieldPath: any,
    errorMessage: string,
  ) {
    if (typeof fieldPath !== "string" || !fieldPath) {
      throw new Error(errorMessage);
    }

    const [fieldId, subFieldId] = fieldPath.split(".");
    const field = table.fields.find(item => item.uid === fieldId);
    if (!field) {
      throw new Error(errorMessage);
    }

    if (!subFieldId) {
      return {
        fieldId: field.uid,
        subFieldId: null as FieldUID | null,
      };
    }

    const subTableUID = field.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID
      ? formData.tables.find(item => item.uid === subTableUID)
      : null;
    const subField = subTable?.fields?.find(item => item.uid === subFieldId);
    if (!subTable || !subField) {
      throw new Error(errorMessage);
    }

    return {
      fieldId: field.uid,
      subFieldId: subField.uid,
    };
  }

  private parseViewActionSourcePath(sourcePath: any, formData: NocodeFormData, currentTable: Table) {
    if (typeof sourcePath !== "string" || !sourcePath) {
      return null;
    }
    const [sourceTableUID, ...restPath] = sourcePath.split(".");
    if (!sourceTableUID || !restPath.length) {
      return null;
    }
    if (sourceTableUID !== currentTable.uid) {
      throw new Error(global.i18next.t('formDataService.sourceCurrentTableOnly'));
    }
    return this.getViewActionFieldPath(
      formData,
      currentTable,
      restPath.join("."),
      global.i18next.t('formDataService.sourceFieldMissing'),
    );
  }

  private getViewActionSourceInfo(
    formData: NocodeFormData,
    currentTable: Table,
    sourcePath: any,
  ) {
    const parsedPath = this.parseViewActionSourcePath(sourcePath, formData, currentTable);
    if (!parsedPath) {
      return null;
    }

    const field = currentTable.fields.find(item => item.uid === parsedPath.fieldId);
    const subTableUID = field?.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID
      ? formData.tables.find(item => item.uid === subTableUID)
      : null;
    const subField = parsedPath.subFieldId
      ? subTable?.fields?.find(item => item.uid === parsedPath.subFieldId)
      : null;
    return {
      ...parsedPath,
      field,
      subField,
      isSubFormField: field?.meta?.subType === "subForm",
    };
  }

  private canAccessViewActionFieldPath(
    formData: NocodeFormData,
    table: Table,
    fieldPath: string,
    fieldAuth: MemberFieldAuth,
    requiredAuth: FieldAuthValue,
    errorMessage: string,
  ) {
    const resolvedField = this.getViewActionFieldPath(formData, table, fieldPath, errorMessage);
    const field = table.fields.find(item => item.uid === resolvedField.fieldId);
    if (this.getFieldAuthValue(fieldAuth, field) < requiredAuth) {
      return false;
    }

    if (!resolvedField.subFieldId) {
      return true;
    }

    const subTableUID = field?.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID
      ? formData.tables.find(item => item.uid === subTableUID)
      : null;
    const subField = subTable?.fields?.find(item => item.uid === resolvedField.subFieldId);
    return this.getFieldAuthValue(fieldAuth, subField) >= requiredAuth;
  }

  private canReadViewActionFormula(
    formula: any,
    formData: NocodeFormData,
    currentTable: Table,
    sourceFieldAuth: MemberFieldAuth,
    sourceFlowFieldAuths: FlowFieldAuth[] = [],
  ) {
    if (typeof formula !== "string" || !formula) {
      return true;
    }

    let canRead = true;
    replaceColFieldsByFormula(formula, (keys) => {
      if (!canRead) {
        return null;
      }

      const [sourceUID, fieldId, subFieldId] = keys;
      if (sourceUID !== currentTable.uid) {
        canRead = false;
        return null;
      }

      const fieldPath = subFieldId ? `${fieldId}.${subFieldId}` : fieldId;
      const resolvedField = this.getViewActionFieldPath(
        formData,
        currentTable,
        fieldPath,
        global.i18next.t('formDataService.formulaFieldMissing'),
      );
      canRead = this.canAccessViewActionFieldPath(
        formData,
        currentTable,
        fieldPath,
        sourceFieldAuth,
        FieldAuthValue.VISIBLE,
        global.i18next.t('formDataService.formulaFieldMissing'),
      ) && this.canReadViewActionFieldByCurrentFlows(
        formData,
        currentTable,
        resolvedField,
        sourceFlowFieldAuths,
      );
      return null;
    });

    return canRead;
  }

  private getViewActionSourceValue(
    currentRow: Row,
    formData: NocodeFormData,
    currentTable: Table,
    sourcePath: any,
    options: { arrayMode?: "full" | "first" } = {},
  ) {
    const parsedPath = this.parseViewActionSourcePath(sourcePath, formData, currentTable);
    if (!parsedPath) {
      return null;
    }

    const fieldValue = currentRow?.[parsedPath.fieldId];
    if (!parsedPath.subFieldId) {
      return deepClone(fieldValue);
    }

    if (!Array.isArray(fieldValue)) {
      return options.arrayMode === "first" ? null : [];
    }

    const values = fieldValue.map(item => item?.[parsedPath.subFieldId]);
    return options.arrayMode === "first" ? values[0] : values;
  }

  private evaluateViewActionFormula(
    formula: any,
    currentTable: Table,
    currentRow: Row,
    options: { arrayMode?: "full" | "first" } = {},
  ) {
    if (typeof formula !== "string" || !formula) {
      return null;
    }

    let invalidReference = false;
    let maxSubRowLength = 0;

    const columnFormula = replaceColFieldsByFormula(formula, (keys) => {
      const [sourceUID, fieldId, subFieldId] = keys;
      if (sourceUID !== currentTable.uid) {
        invalidReference = true;
        return null;
      }
      const value = currentRow?.[fieldId];
      if (subFieldId) {
        if (!Array.isArray(value)) {
          return [];
        }
        maxSubRowLength = Math.max(maxSubRowLength, value.length);
        return value.map(item => item?.[subFieldId]);
      }
      return [value];
    });

    const formulaRuntime = createFormulaRuntimeByData(currentRow, currentTable.fields);
    const evaluateByIndex = (index: number) => {
      const resolvedFormula = replaceByFormula(columnFormula, (keys) => {
        const [sourceUID, fieldId, subFieldId] = keys;
        if (sourceUID !== currentTable.uid) {
          invalidReference = true;
          return null;
        }
        const value = currentRow?.[fieldId];
        if (subFieldId) {
          if (!Array.isArray(value)) {
            return null;
          }
          maxSubRowLength = Math.max(maxSubRowLength, value.length);
          return value[index]?.[subFieldId];
        }
        return Number.isNaN(value) ? 0 : value;
      });

      try {
        return formulaRuntime.evaluate(resolvedFormula);
      } catch (error) {
        this.logger.error("view action formula evaluate error", error);
        return null;
      }
    };

    if (invalidReference) {
      throw new Error(global.i18next.t('formDataService.formulaCurrentTableOnly'));
    }

    if (maxSubRowLength > 0 && options.arrayMode !== "first") {
      const values: any[] = [];
      for (let index = 0; index < maxSubRowLength; index++) {
        values.push(evaluateByIndex(index));
      }
      return values;
    }

    return evaluateByIndex(0);
  }

  private ensureCreateRowsLength(rows: Row[], targetLength: number) {
    if (targetLength <= rows.length) {
      return rows;
    }
    const nextRows = [...rows];
    const template = this.getCommonCreateRowTemplate(rows);
    while (nextRows.length < targetLength) {
      nextRows.push(deepClone(template));
    }
    return nextRows;
  }

  private getCommonCreateRowTemplate(rows: Row[] = []) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return {};
    }

    const [firstRow] = rows;
    if (!firstRow || typeof firstRow !== "object") {
      return {};
    }

    const template: Row = {};
    for (const key of Object.keys(firstRow)) {
      const value = firstRow[key];
      if (rows.every((row) => equals(row?.[key], value))) {
        template[key] = deepClone(value);
      }
    }
    return template;
  }

  private ensureTargetSubRows(row: Row, fieldId: FieldUID, minLength: number) {
    if (!Array.isArray(row[fieldId])) {
      row[fieldId] = [];
    }
    while (row[fieldId].length < Math.max(minLength, 1)) {
      row[fieldId].push({});
    }
  }

  private getCommonSubRowTemplate(subRows: Row[] = []) {
    if (!Array.isArray(subRows) || subRows.length === 0) {
      return {};
    }

    const [firstRow] = subRows;
    if (!firstRow || typeof firstRow !== "object") {
      return {};
    }

    const template: Row = {};
    for (const key of Object.keys(firstRow)) {
      const value = firstRow[key];
      if (subRows.every((row) => equals(row?.[key], value))) {
        template[key] = deepClone(value);
      }
    }
    return template;
  }

  private ensureTargetSubRowsWithTemplate(row: Row, fieldId: FieldUID, minLength: number) {
    if (!Array.isArray(row[fieldId])) {
      row[fieldId] = [];
    }

    const template = this.getCommonSubRowTemplate(row[fieldId]);
    while (row[fieldId].length < Math.max(minLength, 1)) {
      row[fieldId].push(deepClone(template));
    }
  }

  private assignCreateValueToRows(
    rows: Row[],
    targetFieldId: FieldUID,
    targetSubFieldId: FieldUID | null,
    value: any,
    options: {
      expandRowsFromArray?: boolean,
      expandSubRowsFromArray?: boolean,
    } = {},
  ) {
    if (targetSubFieldId) {
      for (const row of rows) {
        // 数组值不一定代表多条子表行，只有显式指定时才按子表行展开。
        if (Array.isArray(value) && options.expandSubRowsFromArray) {
          this.ensureTargetSubRowsWithTemplate(row, targetFieldId, value.length);
          value.forEach((item, index) => {
            row[targetFieldId][index][targetSubFieldId] = deepClone(item);
          });
        } else {
          this.ensureTargetSubRows(row, targetFieldId, Math.max(row[targetFieldId]?.length || 0, 1));
          row[targetFieldId].forEach((item) => {
            item[targetSubFieldId] = deepClone(value);
          });
        }
      }
      return rows;
    }

    if (Array.isArray(value) && options.expandRowsFromArray) {
      const nextRows = this.ensureCreateRowsLength(rows, value.length);
      value.forEach((item, index) => {
        nextRows[index][targetFieldId] = deepClone(item);
      });
      return nextRows;
    }

    for (const row of rows) {
      row[targetFieldId] = deepClone(value);
    }
    return rows;
  }

  private normalizeViewActionScalarValue(field: Field, value: any) {
    if (value === null || value === undefined || Array.isArray(value)) {
      return value;
    }
    if (typeof value !== "object" || value instanceof Date || value instanceof RegExp) {
      return value;
    }

    for (const key of ["value", "id", "label", "name", "alias", "text"]) {
      const candidate = value?.[key];
      if (candidate === null || candidate === undefined || typeof candidate === "object") {
        continue;
      }

      if (field.type === "number") {
        const numericValue = Number(candidate);
        return Number.isNaN(numericValue) ? null : numericValue;
      }

      return String(candidate);
    }

    return null;
  }

  private normalizeViewActionCreateRows(
    rows: Row[],
    targetTable: Table,
    formData: NocodeFormData,
  ) {
    const normalizeRow = (row: Row, table: Table) => {
      for (const field of table.fields) {
        if (!(field.uid in row)) {
          continue;
        }

        if (field.meta?.extra?.widgetType === "widget.form.subform") {
          const subTableUID = field.meta?.extra?.subTableUID?.[1];
          const subTable = subTableUID
            ? formData.tables.find(item => item.uid === subTableUID)
            : null;
          if (subTable && Array.isArray(row[field.uid])) {
            row[field.uid] = row[field.uid].map((subRow) => normalizeRow(subRow || {}, subTable));
          }
          continue;
        }

        if (field.meta?.extra?.widgetType === FormWidgetType.MARKDOWN_EDITOR) {
          row[field.uid] = convertMarkdownEditorFieldValue(row[field.uid], field);
          continue;
        }

        if (!["string", "number"].includes(field.type)) {
          continue;
        }

        row[field.uid] = this.normalizeViewActionScalarValue(field, row[field.uid]);
      }

      return row;
    };

    return rows.map((row) => normalizeRow(row, targetTable));
  }

  private applyCreateDefaults(
    rows: Row[],
    targetTable: Table,
    formData: NocodeFormData,
    explicitFieldIds: Set<string>,
  ) {
    const defaultFields: Field[] = [];
    const formulaFields: Field[] = [];

    for (const field of targetTable.fields) {
      if (field.meta?.extra?.widgetType === "widget.form.subform") {
        const subTable = formData.tables.find(item => item.uid === field.meta?.extra?.subTableUID?.[1]);
        for (const subField of subTable?.fields || []) {
          const key = `${field.uid}.${subField.uid}`;
          if (explicitFieldIds.has(key)) {
            continue;
          }
          const extra = subField.meta?.extra;
          if ((extra?.defaultValueType === "custom" || extra?.linkType === "form") && hasConfiguredValue(extra?.defaultValue)) {
            defaultFields.push({ ...subField, uid: key as FieldUID });
          } else if (extra?.defaultValueType === "formula" && !isEmpty(getFormulaStr(extra?.formula))) {
            formulaFields.push({ ...subField, uid: key as FieldUID });
          }
        }
        continue;
      }

      if (explicitFieldIds.has(field.uid)) {
        continue;
      }

      const extra = field.meta?.extra;
      if ((extra?.defaultValueType === "custom" || extra?.linkType === "form") && hasConfiguredValue(extra?.defaultValue)) {
        defaultFields.push(field);
      } else if (extra?.defaultValueType === "formula" && !isEmpty(getFormulaStr(extra?.formula))) {
        formulaFields.push(field);
      }
    }

    try {
      rowsDefaultValueCalculation(rows, { formulaFields, defaultFields }, targetTable, formData);
    } catch (error) {
      this.logger.error("view action create default value calculation error", error);
    }
    return rows;
  }

  private getFieldDisplayLabel(field?: Field) {
    return String(field?.alias || field?.meta?.name || global.i18next.t('formDataService.unnamedField'));
  }

  private getResolvedViewActionFieldLabel(
    formData: NocodeFormData,
    table: Table,
    fieldPath: {
      fieldId: FieldUID;
      subFieldId: FieldUID | null;
    },
  ) {
    const field = table.fields.find(item => item.uid === fieldPath.fieldId);
    if (!fieldPath.subFieldId) {
      return this.getFieldDisplayLabel(field);
    }

    const subTableUID = field?.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID
      ? formData.tables.find(item => item.uid === subTableUID)
      : null;
    const subField = subTable?.fields?.find(item => item.uid === fieldPath.subFieldId);
    return `${this.getFieldDisplayLabel(field)} / ${this.getFieldDisplayLabel(subField)}`;
  }

  private buildViewActionCreateMappingFailureMessage(failedMappings: ViewActionCreateMappingFailure[]) {
    const fieldLabels = [...new Set(failedMappings.map(item => item.fieldLabel).filter(Boolean))];
    const quotedFields = fieldLabels.map(label => `“${label}”`).join(global.i18next.t('formDataService.listSeparator'));
    const isMultipleFields = fieldLabels.length > 1;
    const prefix = fieldLabels.length > 1
      ? global.i18next.t('formDataService.createMappingMultiplePrefix', { fields: quotedFields })
      : global.i18next.t('formDataService.createMappingSinglePrefix', { fields: quotedFields });
    const reasons = [...new Set(failedMappings.map(item => item.reason))];

    if (reasons.length === 1) {
      if (reasons[0] === "source_unreadable") {
        return `${prefix}${global.i18next.t(
          isMultipleFields
            ? 'formDataService.createMappingSourceUnreadableMultiple'
            : 'formDataService.createMappingSourceUnreadableSingle',
        )}`;
      }
      if (reasons[0] === "target_not_editable") {
        return `${prefix}${global.i18next.t(
          isMultipleFields
            ? 'formDataService.createMappingTargetNotEditableMultiple'
            : 'formDataService.createMappingTargetNotEditableSingle',
        )}`;
      }
      if (reasons[0] === "formula_unreadable") {
        return `${prefix}${global.i18next.t(
          isMultipleFields
            ? 'formDataService.createMappingFormulaUnreadableMultiple'
            : 'formDataService.createMappingFormulaUnreadableSingle',
        )}`;
      }
    }

    return `${prefix}${global.i18next.t('formDataService.createMappingPermissionMissing')}`;
  }

  private async buildCreateRowsForViewAction(
    nocodeId: string,
    formData: NocodeFormData,
    currentTable: Table,
    currentRow: Row,
    targetTable: Table,
    action: ViewAction,
    options: {
      sourceFieldAuth?: MemberFieldAuth,
      targetFieldAuth?: MemberFieldAuth,
    } = {},
  ): Promise<ViewActionCreateRowsResult> {
    if (action.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) {
      return {
        rows: [],
        failedMappings: [],
      };
    }

    const sourceFieldAuth = options.sourceFieldAuth || "all";
    const targetFieldAuth = options.targetFieldAuth || "all";
    const sourceFlowFieldAuths = await this.getViewActionEditFlowFieldAuths(nocodeId, formData, currentTable, currentRow);
    const targetFlowFieldAuth = this.getViewActionCreateFlowFieldAuth(formData, targetTable);
    let rows: Row[] = [{}];
    const explicitFieldIds = new Set<string>();
    const mappingStates = new Map<string, ViewActionCreateMappingState>();

    for (const mapping of action.behavior.config.fieldMappings || []) {
      if (!mapping?.fieldId) {
        continue;
      }

      const targetField = this.getViewActionFieldPath(
        formData,
        targetTable,
        mapping.fieldId,
        global.i18next.t('formDataService.targetFieldMissing'),
      );
      const explicitFieldId = targetField.subFieldId ? `${targetField.fieldId}.${targetField.subFieldId}` : targetField.fieldId;
      const mappingState = mappingStates.get(explicitFieldId) || {
        fieldId: explicitFieldId as ViewActionFieldId,
        fieldLabel: this.getResolvedViewActionFieldLabel(formData, targetTable, targetField),
        applied: false,
      };
      mappingStates.set(explicitFieldId, mappingState);
      explicitFieldIds.add(explicitFieldId);
      const canEditTargetField = this.canAccessViewActionFieldPath(
        formData,
        targetTable,
        mapping.fieldId,
        targetFieldAuth,
        FieldAuthValue.VISIBLE_EDITABLE,
        global.i18next.t('formDataService.targetFieldMissing'),
      );
      const canEditTargetFieldByFlow = this.canEditViewActionFieldByFlowFieldAuth(
        formData,
        targetTable,
        targetField,
        targetFlowFieldAuth,
      );
      if (!canEditTargetField || !canEditTargetFieldByFlow) {
        if (!mappingState.applied && !mappingState.failedReason) {
          mappingState.failedReason = "target_not_editable";
        }
        continue;
      }
      let value: any = null;
      let shouldApply = true;
      let failedReason: ViewActionCreateMappingFailureReason | undefined;
      let expandRowsFromArray = false;
      let expandSubRowsFromArray = false;

      if (mapping.valueType === ViewActionFieldValueType.FIELD) {
        const sourceInfo = this.getViewActionSourceInfo(formData, currentTable, mapping.value);
        if (
          !sourceInfo
          || (sourceInfo.isSubFormField && !sourceInfo.subFieldId)
          || this.getFieldAuthValue(sourceFieldAuth, sourceInfo.field) < FieldAuthValue.VISIBLE
          || (sourceInfo.subField && this.getFieldAuthValue(sourceFieldAuth, sourceInfo.subField) < FieldAuthValue.VISIBLE)
          || !this.canReadViewActionFieldByCurrentFlows(formData, currentTable, sourceInfo, sourceFlowFieldAuths)
        ) {
          shouldApply = false;
          failedReason = "source_unreadable";
        } else {
          value = this.getViewActionSourceValue(
            currentRow,
            formData,
            currentTable,
            mapping.value,
            { arrayMode: sourceInfo.subFieldId ? "full" : "first" },
          );
          expandRowsFromArray = Boolean(sourceInfo.subFieldId && !targetField.subFieldId);
          expandSubRowsFromArray = Boolean(sourceInfo.subFieldId && targetField.subFieldId);
        }
      } else if (mapping.valueType === ViewActionFieldValueType.CUSTOM) {
        value = deepClone(mapping.value);
      } else if (mapping.valueType === ViewActionFieldValueType.FORMULA) {
        if (!this.canReadViewActionFormula(
          mapping.value,
          formData,
          currentTable,
          sourceFieldAuth,
          sourceFlowFieldAuths,
        )) {
          shouldApply = false;
          failedReason = "formula_unreadable";
        } else {
          value = this.evaluateViewActionFormula(mapping.value, currentTable, currentRow);
          expandRowsFromArray = Array.isArray(value) && !targetField.subFieldId;
        }
      } else if (mapping.valueType === ViewActionFieldValueType.EMPTY) {
        value = null;
      }

      if (!shouldApply) {
        if (!mappingState.applied && failedReason && !mappingState.failedReason) {
          mappingState.failedReason = failedReason;
        }
        continue;
      }

      rows = this.assignCreateValueToRows(
        rows,
        targetField.fieldId as FieldUID,
        targetField.subFieldId,
        value,
        { expandRowsFromArray, expandSubRowsFromArray },
      );
      mappingState.applied = true;
      delete mappingState.failedReason;
    }

    return {
      rows: this.normalizeViewActionCreateRows(
        this.applyCreateDefaults(rows, targetTable, formData, explicitFieldIds),
        targetTable,
        formData,
      ),
      failedMappings: [...mappingStates.values()]
        .filter(item => !item.applied && !!item.failedReason)
        .map(item => ({
          fieldId: item.fieldId,
          fieldLabel: item.fieldLabel,
          reason: item.failedReason as ViewActionCreateMappingFailureReason,
        })),
    };
  }

  private applyEditFieldValue(
    row: Row,
    targetFieldId: FieldUID,
    targetSubFieldId: FieldUID | null,
    value: any,
  ) {
    if (!targetSubFieldId) {
      row[targetFieldId] = deepClone(value);
      return;
    }

    this.ensureTargetSubRows(row, targetFieldId, Math.max(row[targetFieldId]?.length || 0, 1));
    row[targetFieldId].forEach((item) => {
      item[targetSubFieldId] = deepClone(value);
    });
  }

  private getViewActionLeafField(
    formData: NocodeFormData,
    currentTable: Table,
    targetField: ReturnType<FormDataService["getViewActionFieldPath"]>,
  ) {
    if (!targetField.subFieldId) {
      return currentTable.fields.find(item => item.uid === targetField.fieldId) || null;
    }

    const parentField = currentTable.fields.find(item => item.uid === targetField.fieldId);
    const subTableUID = parentField?.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID
      ? formData.tables.find(item => item.uid === subTableUID)
      : null;
    return subTable?.fields?.find(item => item.uid === targetField.subFieldId) || null;
  }

  private normalizeViewActionUploadFileValue(
    nocodeId: string,
    field: Field,
    value: any,
  ) {
    if (!isViewActionUploadFile(value)) {
      throw new Error(global.i18next.t('formDataService.uploadCustomValueInvalid'));
    }

    const normalizedUrl = String(value.url || "").replace(/^\/+/, "");
    const expectedPrefix = `uploads/${nocodeId}/`;
    if (!normalizedUrl.startsWith(expectedPrefix)) {
      throw new Error(global.i18next.t('formDataService.uploadCustomValueCurrentAppOnly'));
    }

    const relativeUploadPath = normalizedUrl.slice("uploads/".length);
    let decodedRelativeUploadPath = relativeUploadPath;
    try {
      decodedRelativeUploadPath = decodeURIComponent(relativeUploadPath);
    } catch (_error) {
      // Keep the raw path when decoding fails, and let the path checks below reject it.
    }

    const uploadRootPath = resolve(this.uploadsDir);
    const uploadFilePath = resolve(uploadRootPath, decodedRelativeUploadPath);
    const uploadRelativePath = relative(uploadRootPath, uploadFilePath);
    const nocodeUploadPrefix = `${nocodeId}${sep}`;
    if (
      !uploadRelativePath
      || uploadRelativePath.startsWith("..")
      || (!uploadRelativePath.startsWith(nocodeUploadPrefix) && uploadRelativePath !== nocodeId)
    ) {
      throw new Error(global.i18next.t('formDataService.uploadCustomValuePathInvalid'));
    }

    if (!existsSync(uploadFilePath)) {
      throw new Error(global.i18next.t('formDataService.uploadCustomValueMissing'));
    }

    if (!statSync(uploadFilePath).isFile()) {
      throw new Error(global.i18next.t('formDataService.uploadCustomValueNotFile'));
    }

    const extensionSource = `${value.name || normalizedUrl}`.split("?")[0].split("#")[0];
    const fileExtension = extname(extensionSource).toLowerCase();
    if (
      field.meta?.extra?.widgetType === FormWidgetType.IMAGE_UPLOADER
      && !VIEW_ACTION_IMAGE_FILE_EXTENSIONS.has(fileExtension)
    ) {
      throw new Error(global.i18next.t('formDataService.imageCustomValueMustBeImage'));
    }

    return {
      uid: typeof value.uid === "string" && value.uid ? value.uid : unique(),
      name: String(value.name),
      status: "success",
      size: typeof value.size === "number" && Number.isFinite(value.size) ? value.size : undefined,
      url: normalizedUrl,
    };
  }

  private normalizeViewActionEditCustomValue(
    nocodeId: string,
    field: Field,
    value: any,
  ) {
    if (!canViewActionFieldUseCustomValue(field)) {
      throw new Error(global.i18next.t('formDataService.customValueUnsupported'));
    }

    if (field.meta?.extra?.widgetType === FormWidgetType.MARKDOWN_EDITOR) {
      return convertMarkdownEditorFieldValue(value, field);
    }

    if (!isViewActionUploadField(field)) {
      return deepClone(value);
    }

    if (value === undefined || value === null || value === "") {
      return isViewActionUploadFieldMultiple(field) ? [] : null;
    }

    const normalizedFiles = (Array.isArray(value) ? value : [value])
      .filter(item => item !== null && item !== undefined && item !== "")
      .map(item => this.normalizeViewActionUploadFileValue(nocodeId, field, item));

    if (!isViewActionUploadFieldMultiple(field) && normalizedFiles.length > 1) {
      throw new Error(global.i18next.t('formDataService.singleFileCustomValueOnlyOne'));
    }

    return isViewActionUploadFieldMultiple(field)
      ? normalizedFiles
      : (normalizedFiles[0] || null);
  }

  private resolveEditActionFields(
    nocodeId: string,
    formData: NocodeFormData,
    currentTable: Table,
    action: ViewAction,
  ) {
    if (action.behavior.type !== ViewActionBehaviorType.EDIT_RECORD) {
      return [];
    }

    const fieldConfigs = (action.behavior.config.fields || []).filter(item => !!item?.fieldId);
    if (!fieldConfigs.length) {
      throw new Error(global.i18next.t('formDataService.editFieldsMissing'));
    }

    return fieldConfigs.map((fieldConfig) => {
      const targetField = this.getViewActionFieldPath(
        formData,
        currentTable,
        fieldConfig.fieldId,
        global.i18next.t('formDataService.editFieldMissing'),
      );
      const leafField = this.getViewActionLeafField(formData, currentTable, targetField);
      if (!leafField) {
        throw new Error(global.i18next.t('formDataService.editFieldMissing'));
      }

      const normalizedFieldConfig = fieldConfig.mode === ViewActionEditFieldMode.CUSTOM
        ? {
            ...fieldConfig,
            customValue: this.normalizeViewActionEditCustomValue(nocodeId, leafField, fieldConfig.customValue),
          }
        : fieldConfig;

      return {
        fieldConfig: normalizedFieldConfig,
        targetField,
        leafField,
        fieldId: targetField.subFieldId
          ? `${targetField.fieldId}.${targetField.subFieldId}` as ViewActionFieldId
          : targetField.fieldId as ViewActionFieldId,
      };
    });
  }

  private async filterEditableViewActionFields(
    nocodeId: string,
    formData: NocodeFormData,
    currentTable: Table,
    resolvedFields: ReturnType<FormDataService["resolveEditActionFields"]>,
    fieldAuth: MemberFieldAuth,
    currentRow?: Row | null,
  ) {
    const flowFieldAuths = await this.getViewActionEditFlowFieldAuths(nocodeId, formData, currentTable, currentRow);
    return resolvedFields.filter(item => {
      if (!this.canAccessViewActionFieldPath(
        formData,
        currentTable,
        item.fieldId,
        fieldAuth,
        FieldAuthValue.VISIBLE_EDITABLE,
        global.i18next.t('formDataService.editFieldMissing'),
      )) {
        return false;
      }

      return this.canEditViewActionFieldByCurrentFlows(
        formData,
        currentTable,
        item.targetField,
        flowFieldAuths,
      );
    });
  }

  private buildPrepareEditResult(
    formData: NocodeFormData,
    currentTable: Table,
    currentRow: Row,
    resolvedFields: ReturnType<FormDataService["resolveEditActionFields"]>,
    context?: ExecuteViewActionEditContext,
  ): PrepareEditViewActionResult {
    const preparedRow = deepClone(currentRow);
    const prepareFieldIds = this.collectPrepareEditFieldIds(formData, currentTable, resolvedFields);

    for (const { fieldConfig, targetField } of resolvedFields) {
      if (fieldConfig.mode === ViewActionEditFieldMode.CURRENT) {
        continue;
      }

      const value = fieldConfig.customValue === undefined ? null : deepClone(fieldConfig.customValue);

      this.applyEditFieldValue(preparedRow, targetField.fieldId as FieldUID, targetField.subFieldId, value);
    }

    return {
      row: this.sanitizeViewActionPrepareRow(
        preparedRow,
        prepareFieldIds,
        getUUIDSystemField(currentTable.fields)?.uid,
      ),
      fields: resolvedFields.map(item => item.fieldId),
      context,
    };
  }

  private assertTriggerProcessActionConfig(action: ViewAction) {
    if (action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
      return;
    }
    if (!action.behavior.config.triggerNodeId) {
      throw new Error(global.i18next.t('formDataService.triggerNodeMissing'));
    }
    if (
      action.behavior.config.triggerMode
      && ![ViewActionTriggerMode.EACH_RECORD, ViewActionTriggerMode.VIEW_CONTEXT_ONCE].includes(action.behavior.config.triggerMode)
    ) {
      throw new Error(global.i18next.t('formDataService.triggerModeInvalid'));
    }
  }

  private assertCreateRecordActionConfig(action: ViewAction) {
    if (action.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) {
      return;
    }
    if (!action.behavior.config.targetFormId) {
      throw new Error(global.i18next.t('formDataService.targetFormMissing'));
    }
  }

  private async executeViewTriggerByRows(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    table: Table,
    action: ViewAction,
    request: ExecuteViewActionRequest,
    runtimeOptions: Pick<TriggerOptions, "flowWorkerContext"> = {},
  ): Promise<ExecuteViewActionResult> {
    if (action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
      throw new Error(global.i18next.t('formDataService.viewActionTriggerProcessOnly'));
    }
    const triggerBehavior = action.behavior;

    if (this.getViewActionViewConditionMode(action) === ViewActionViewConditionMode.NO_DATA) {
      throw new Error(global.i18next.t('formDataService.eachTriggerNoDataUnsupported'));
    }

    const targetUUIDs = this.normalizeViewActionTargetUUIDs(request.targetUUIDs);
    const isRetryByTargetUUIDs = targetUUIDs.length > 0;
    const retryTargets = isRetryByTargetUUIDs
      ? await this.getViewActionTriggerRetryTargets(
          nocodeBody,
          formData,
          request.nocodeId,
          table,
          request,
        )
      : null;
    const viewCondition = isRetryByTargetUUIDs
      ? undefined
      : await this.buildViewActionCondition(
          nocodeBody,
          formData,
          request.nocodeId,
          table,
          request,
        );
    const affectedCount = isRetryByTargetUUIDs
      ? (retryTargets?.affectedCount || 0)
      : await this.countSubmittedRows(
          request.nocodeId,
          table,
          viewCondition,
          {
            applyGetPermission: true,
          },
        );

    await this.validateViewActionExecuteCondition(
      action,
      table,
      isRetryByTargetUUIDs
        ? { currentRows: retryTargets?.uniqueRows || [] }
        : { currentCount: affectedCount },
    );

    if (affectedCount <= 0) {
      return {
        type: action.behavior.type,
        executionMode: "row_batch",
        affectedCount: 0,
        message: this.getViewActionTriggerEmptyMessage(),
      };
    }

    if (affectedCount > VIEW_ACTION_TRIGGER_MAX_COUNT) {
      return {
        type: action.behavior.type,
        executionMode: "row_batch",
        affectedCount,
        blockedByLimit: true,
        message: isRetryByTargetUUIDs
          ? this.getViewActionTriggerRetryLimitMessage(affectedCount)
          : this.getViewActionTriggerLimitMessage(affectedCount),
      };
    }

    const uniqueRows = retryTargets?.uniqueRows || this.getUniqueViewActionRows(
      table,
      await this.getRowsByViewActionFilters(
        nocodeBody,
        formData,
        request.nocodeId,
        table,
        request,
      ),
    );
    const affectedRowsDigest = isRetryByTargetUUIDs
      ? (retryTargets?.affectedRowsDigest || "")
      : this.buildViewActionAffectedRowsDigest(table, uniqueRows);
    const requiresConfirm = affectedCount > VIEW_ACTION_TRIGGER_CONFIRM_THRESHOLD;
    if (request.previewOnly) {
      return {
        type: action.behavior.type,
        executionMode: "row_batch",
        affectedCount,
        affectedRowsDigest,
        requiresConfirm,
        message: requiresConfirm
          ? (
            isRetryByTargetUUIDs
              ? this.getViewActionTriggerRetryConfirmMessage(affectedCount)
              : this.getViewActionTriggerConfirmMessage(affectedCount)
          )
          : undefined,
      };
    }

    if (
      requiresConfirm
      && (
        !request.confirmed
        || request.expectedAffectedCount === undefined
        || request.expectedAffectedCount !== affectedCount
        || (
          request.expectedAffectedRowsDigest !== undefined
          && request.expectedAffectedRowsDigest !== affectedRowsDigest
        )
      )
    ) {
      return {
        type: action.behavior.type,
        executionMode: "row_batch",
        affectedCount,
        requiresConfirm: true,
        message: request.confirmed
          ? (
            isRetryByTargetUUIDs
              ? this.getViewActionTriggerRetryReconfirmMessage(affectedCount)
              : this.getViewActionTriggerReconfirmMessage(affectedCount)
          )
          : (
            isRetryByTargetUUIDs
              ? this.getViewActionTriggerRetryConfirmMessage(affectedCount)
              : this.getViewActionTriggerConfirmMessage(affectedCount)
          ),
      };
    }
    const uuidFieldId = getUUIDSystemField(table.fields).uid;
    const batchIndexByUUID = isRetryByTargetUUIDs
      ? (retryTargets?.batchIndexByUUID || new Map(targetUUIDs.map((uuid, index) => [uuid, index + 1])))
      : new Map(uniqueRows.map((row, index) => [String(row?.[uuidFieldId]), index + 1]));
    const triggerResult = await this.formFlowService.triggerOperations(uniqueRows.map(row => ({
      nocodeId: request.nocodeId,
      tableId: request.tableUID,
      uuid: row[uuidFieldId],
      processId: triggerBehavior.config.processId,
      triggerNodeId: triggerBehavior.config.triggerNodeId,
      operationId: action.id,
      batchIndex: batchIndexByUUID.get(String(row?.[uuidFieldId])) || 0,
      dataTitle: this.getViewActionRowDataTitle(table, row),
      flowWorkerContext: runtimeOptions.flowWorkerContext,
    })));
    const failedItems = [
      ...(triggerResult.failedItems || []),
      ...(retryTargets?.unavailableTargetUUIDs || [])
        .map(uuid => this.buildViewActionRetryUnavailableFailedItem(
          uuid,
          batchIndexByUUID.get(uuid) || 0,
        )),
    ].sort((left, right) => (left.index || 0) - (right.index || 0));
    const successCount = triggerResult.successCount || 0;
    const failedCount = failedItems.length;
    const attemptedCount = isRetryByTargetUUIDs
      ? targetUUIDs.length
      : (triggerResult.attemptedCount || uniqueRows.length);

    return {
      type: action.behavior.type,
      executionMode: "row_batch",
      affectedCount: successCount,
      attemptedCount,
      successCount,
      failedCount,
      partialSuccess: successCount > 0 && failedCount > 0,
      failedItems: failedCount > 0 ? failedItems : undefined,
    };
  }

  private async executeViewTriggerOnce(
    nocodeBody: Awaited<ReturnType<typeof getNocodeBody>>,
    formData: NocodeFormData,
    table: Table,
    action: ViewAction,
    request: ExecuteViewActionRequest,
    runtimeOptions: Pick<TriggerOptions, "flowWorkerContext"> = {},
  ): Promise<ExecuteViewActionResult> {
    if (action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
      throw new Error(global.i18next.t('formDataService.viewActionTriggerProcessOnly'));
    }
    const triggerBehavior = action.behavior;

    if (
      this.normalizeViewActionTargetUUIDs(request.targetUUIDs).length > 0
      && !isViewActionSelectedTarget(action.target)
    ) {
      throw new Error(global.i18next.t('formDataService.onceTriggerRetryUnsupported'));
    }

    const viewCondition = await this.buildViewActionCondition(
      nocodeBody,
      formData,
      request.nocodeId,
      table,
      request,
    );
    const matchedCount = await this.countSubmittedRows(
      request.nocodeId,
      table,
      viewCondition,
      {
        applyGetPermission: true,
      },
    );

    await this.validateViewActionExecuteCondition(action, table, { currentCount: matchedCount });

    if (request.previewOnly) {
      return {
        type: action.behavior.type,
        executionMode: "view_once",
        matchedCount,
      };
    }

    await this.formFlowService.triggerViewOperation({
      nocodeId: request.nocodeId,
      tableId: request.tableUID,
      processId: triggerBehavior.config.processId,
      triggerNodeId: triggerBehavior.config.triggerNodeId,
      operationId: action.id,
      actionDisplayName: this.getViewActionDisplayName(action),
      triggerContext: this.buildViewActionTriggerContext(request, action, matchedCount),
      flowWorkerContext: runtimeOptions.flowWorkerContext,
    });

    return {
      type: action.behavior.type,
      executionMode: "view_once",
      matchedCount,
      triggeredCount: 1,
    };
  }

  async precheckViewActionTrigger(request: ExecuteViewActionRequest): Promise<ViewActionTriggerPrecheckResult> {
    const nocodeBody = await getNocodeBody(this.nocodesDir, request.nocodeId);
    const formData = nocodeBody?.formData;
    const table = formData?.tables?.find(item => item.uid === request.tableUID);
    if (!formData || !table) {
      throw new Error(global.i18next.t('formDataService.currentFormMissing'));
    }

    const { view, action } = this.getViewActionContext(nocodeBody, request.tableUID, request.viewId, request.actionId);
    await this.validateViewPermission(nocodeBody, request.tableUID, view.uid);
    await this.validateViewActionPermission(nocodeBody, request.tableUID, action.id);
    this.assertTriggerProcessActionConfig(action);
    this.assertTriggerProcessActionUniqueBinding(nocodeBody, request.tableUID, view.uid, action);
    if (
      !isViewActionViewTarget(action.target)
      || this.getViewActionTriggerMode(action) !== ViewActionTriggerMode.EACH_RECORD
    ) {
      throw new Error(global.i18next.t('formDataService.viewActionTriggerProcessOnly'));
    }

    const targetUUIDs = this.normalizeViewActionTargetUUIDs(request.targetUUIDs);
    const viewCondition = await this.buildViewActionCondition(
      nocodeBody,
      formData,
      request.nocodeId,
      table,
      request,
    );
    const candidateCount = targetUUIDs.length
      ? targetUUIDs.length
      : await this.countSubmittedRows(request.nocodeId, table, viewCondition, {
        applyGetPermission: true,
      });
    if (candidateCount > VIEW_ACTION_TRIGGER_MAX_COUNT) {
      throw new Error(this.getViewActionTriggerLimitMessage(candidateCount));
    }
    const rows = this.getUniqueViewActionRows(
      table,
      await this.getSubmittedRows(formData, request.nocodeId, table, viewCondition, {
        applyGetPermission: true,
      }),
    );
    const uuidField = getUUIDSystemField(table.fields);
    const rowByUUID = new Map(rows.map(row => [String(row?.[uuidField.uid] || ""), row]));
    const candidateUUIDs = targetUUIDs.length
      ? targetUUIDs
      : rows.map(row => String(row?.[uuidField.uid] || "")).filter(Boolean);
    const conditionRows = targetUUIDs.length
      ? candidateUUIDs.map(uuid => rowByUUID.get(uuid)).filter((row): row is Row => Boolean(row))
      : rows;

    if (candidateUUIDs.length > VIEW_ACTION_TRIGGER_MAX_COUNT) {
      throw new Error(this.getViewActionTriggerLimitMessage(candidateUUIDs.length));
    }

    await this.validateViewActionExecuteCondition(action, table, {
      currentCount: conditionRows.length,
      currentRows: conditionRows,
    });
    if (action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
      throw new Error(global.i18next.t('formDataService.viewActionTriggerProcessOnly'));
    }
    const triggerConfig = action.behavior.config;
    await this.formFlowService.assertOperationTriggerConfiguration({
      nocodeId: request.nocodeId,
      tableId: request.tableUID,
      processId: triggerConfig.processId,
      triggerNodeId: triggerConfig.triggerNodeId,
    });
    const activeUUIDs = await this.formFlowService.getActiveOperationTriggerUUIDs(
      request.nocodeId,
      request.tableUID,
      candidateUUIDs,
    );

    const items: ViewActionTriggerPrecheckItem[] = candidateUUIDs.map((uuid, index) => {
      const row = rowByUUID.get(uuid);
      if (!row) {
        return {
          index: index + 1,
          uuid,
          dataTitle: uuid,
          executable: false,
          reasonCode: "record_unavailable",
          message: global.i18next.t('formDataService.recordNotFound'),
        };
      }
      if (activeUUIDs.has(uuid)) {
        return {
          index: index + 1,
          uuid,
          dataTitle: this.getViewActionRowDataTitle(table, row),
          executable: false,
          reasonCode: "flow_in_progress",
          message: global.i18next.t('formFlowService.operationTriggerActiveRecordExists'),
        };
      }
      return {
        index: index + 1,
        uuid,
        dataTitle: this.getViewActionRowDataTitle(table, row),
        executable: true,
      };
    });

    return {
      type: ViewActionBehaviorType.TRIGGER_PROCESS,
      executionMode: "row_batch",
      attemptedCount: candidateUUIDs.length,
      executableCount: items.filter(item => item.executable).length,
      blockedCount: items.filter(item => !item.executable).length,
      items,
    };
  }

  private async resolveViewActionEditUpdateFieldIds(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    keys: OptionFieldUID[] = [],
    context?: ExecuteViewActionEditContext,
  ) {
    if (!context) {
      return undefined;
    }

    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody?.formData;
    const table = formData?.tables?.find(item => item.uid === tableUID);
    if (!formData || !table) {
      throw new Error(global.i18next.t('formDataService.currentFormMissing'));
    }

    if (rows.length !== 1) {
      throw new Error(global.i18next.t('formDataService.editSingleRecordOnly'));
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) {
      throw new Error(global.i18next.t('formDataService.recordIdMissing'));
    }
    if (!(keys || []).some(key => key?.[2] === uuidField.uid)) {
      throw new Error(global.i18next.t('formDataService.actionRecordIdMissing'));
    }

    const rowUUID = rows[0]?.[uuidField.uid];
    if (!rowUUID || String(rowUUID) !== String(context.uuid)) {
      throw new Error(global.i18next.t('formDataService.recordChangedReopenAction'));
    }

    const { view, action } = this.getViewActionContext(nocodeBody, tableUID, context.viewId, context.actionId);
    await this.validateViewPermission(nocodeBody, tableUID, view.uid);
    await this.validateViewActionPermission(nocodeBody, tableUID, action.id);
    if (!isViewActionRecordTarget(action.target) || action.behavior.type !== ViewActionBehaviorType.EDIT_RECORD) {
      throw new Error(global.i18next.t('formDataService.editSubmitUnsupported'));
    }

    const currentRow = await this.getSubmittedRowByUUID(formData, nocodeId, table, String(context.uuid));
    if (!currentRow) {
      throw new Error(global.i18next.t('formDataService.recordNotFound'));
    }

    const currentViewRow = await this.getPersistedViewActionRowByUUID(
      nocodeBody,
      formData,
      nocodeId,
      table,
      context.viewId,
      String(context.uuid),
    );
    if (!currentViewRow) {
      throw new Error(global.i18next.t('formDataService.recordOutOfViewRetry'));
    }

    await this.validateViewActionExecuteCondition(action, table, { currentRow: currentViewRow });
    const memberFieldAuth = await this.getMemberFieldAuth(nocodeBody, table.uid);
    const allowedFields = await this.filterEditableViewActionFields(
      nocodeId,
      formData,
      table,
      this.resolveEditActionFields(nocodeId, formData, table, action),
      memberFieldAuth,
      currentViewRow,
    );
    if (!allowedFields.length) {
      throw new Error(global.i18next.t('formDataService.noEditableFields'));
    }

    return allowedFields.map(item => item.fieldId);
  }

  async executeViewAction(
    request: ExecuteViewActionRequest,
    runtimeOptions: Pick<TriggerOptions, "flowWorkerContext"> = {},
  ): Promise<ExecuteViewActionResult> {
    const nocodeBody = await getNocodeBody(this.nocodesDir, request.nocodeId);
    const formData = nocodeBody?.formData;
    const table = formData?.tables?.find(item => item.uid === request.tableUID);
    if (!formData || !table) {
      throw new Error(global.i18next.t('formDataService.currentFormMissing'));
    }

    const { view, action } = this.getViewActionContext(nocodeBody, request.tableUID, request.viewId, request.actionId);
    await this.validateViewPermission(nocodeBody, request.tableUID, view.uid);
    await this.validateViewActionPermission(nocodeBody, request.tableUID, action.id);
    if (action.behavior.type === ViewActionBehaviorType.TRIGGER_PROCESS) {
      this.assertTriggerProcessActionConfig(action);
      this.assertTriggerProcessActionUniqueBinding(nocodeBody, request.tableUID, view.uid, action);
    }

    if (isViewActionViewTarget(action.target)) {
      if (
        isViewActionSelectedTarget(action.target)
        && this.normalizeViewActionTargetUUIDs(request.targetUUIDs).length <= 0
      ) {
        throw new Error(global.i18next.t('formDataService.selectDataFirst'));
      }
      if (this.getViewActionTriggerMode(action) === ViewActionTriggerMode.VIEW_CONTEXT_ONCE) {
        return await this.executeViewTriggerOnce(nocodeBody, formData, table, action, request, runtimeOptions);
      }
      return await this.executeViewTriggerByRows(nocodeBody, formData, table, action, request, runtimeOptions);
    }

    if (!request.uuid) {
      throw new Error(global.i18next.t('formDataService.currentRecordIdMissing'));
    }

    const currentRow = await this.getViewActionRowByUUID(nocodeBody, formData, request.nocodeId, table, request);
    if (!currentRow) {
      throw new Error(global.i18next.t('formDataService.recordNotFound'));
    }

    await this.validateViewActionExecuteCondition(action, table, { currentRow });

    if (action.behavior.type === ViewActionBehaviorType.CREATE_RECORD) {
      this.assertCreateRecordActionConfig(action);
      const targetFormId = action.behavior.config.targetFormId;
      const targetTable = formData.tables.find(item => item.uid === targetFormId);
      if (!targetTable) {
        throw new Error(global.i18next.t('formDataService.targetFormNotFound'));
      }

      const sourceFieldAuth = await this.getMemberFieldAuth(nocodeBody, table.uid);
      const targetFieldAuth = await this.getMemberFieldAuth(nocodeBody, targetTable.uid);
      const createResult = await this.buildCreateRowsForViewAction(request.nocodeId, formData, table, currentRow, targetTable, action, {
        sourceFieldAuth,
        targetFieldAuth,
      });
      if (createResult.failedMappings.length) {
        this.logger.warn(`view action create mapping skipped: ${JSON.stringify({
          actionId: action.id,
          targetTableId: targetTable.uid,
          failedMappings: createResult.failedMappings.map(item => ({
            fieldId: item.fieldId,
            reason: item.reason,
          })),
        })}`);
        throw new Error(this.buildViewActionCreateMappingFailureMessage(createResult.failedMappings));
      }
      const { rows } = createResult;
      await this.formFlowService.validateSubmitRows(formData, request.nocodeId, targetTable.uid, rows);
      const addResult = await this.addData(formData, request.nocodeId, targetTable.uid, rows, undefined, {
        uniqueValidation: {
          validateCurrentTable: true,
        },
      });
      return {
        type: action.behavior.type,
        affectedCount: Array.isArray(addResult?.data) ? addResult.data.length : rows.length,
        auditMeta: {
          tableUID: targetTable.uid,
          rows: Array.isArray(addResult?.data) ? addResult.data : rows,
        },
      } as ExecuteViewActionResult & {
        auditMeta: {
          tableUID: TableUID,
          rows: Row[],
        },
      };
    }

    if (action.behavior.type === ViewActionBehaviorType.EDIT_RECORD) {
      const uuidField = getUUIDSystemField(table.fields);
      await this.validateUpdatePermission(request.nocodeId, table, [], [uuidField.uid], [{
        [uuidField.uid]: request.uuid,
      }]);
      const memberFieldAuth = await this.getMemberFieldAuth(nocodeBody, table.uid);
      const resolvedFields = await this.filterEditableViewActionFields(
        request.nocodeId,
        formData,
        table,
        this.resolveEditActionFields(request.nocodeId, formData, table, action),
        memberFieldAuth,
        currentRow,
      );

      return {
        type: action.behavior.type,
        prepareEditResult: this.buildPrepareEditResult(formData, table, currentRow, resolvedFields, {
          viewId: request.viewId,
          actionId: action.id,
          uuid: request.uuid,
        }),
      };
    }

    await this.formFlowService.triggerOperation({
      nocodeId: request.nocodeId,
      tableId: request.tableUID,
      uuid: request.uuid,
      processId: action.behavior.config.processId,
      triggerNodeId: action.behavior.config.triggerNodeId,
      operationId: action.id,
      flowWorkerContext: runtimeOptions.flowWorkerContext,
    });

    return {
      type: action.behavior.type,
      affectedCount: 1,
    };
  }

  private getTableContext(formData: NocodeFormData, tableUID: TableUID) {
    const table = formData.tables.find(t => t.uid === tableUID);
    const optionTable = table
      ? formData.options.tables.find(t => t.uid === table.meta.uid)
      : null;
    return {
      table,
      optionTable,
    };
  }

  private getSystemFieldByName(table: Table, name: string) {
    return table?.fields?.find(field => field.meta.name === name);
  }

  private isDraftOnlyExcludedStage(stage?: FormDataStageWhereCondition) {
    if (!stage || typeof stage !== "object") {
      return false;
    }
    if ("$ne" in stage) {
      return stage.$ne === FormDataStage.DRAFT;
    }
    if ("$nin" in stage) {
      return Array.isArray(stage.$nin)
        && stage.$nin.length === 1
        && stage.$nin[0] === FormDataStage.DRAFT;
    }
    return false;
  }

  private getTableTreeUIDs(formData: NocodeFormData, tableUID: TableUID, visited = new Set<TableUID>()) {
    if (visited.has(tableUID)) {
      return [];
    }
    visited.add(tableUID);
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return [];
    }
    const tableUIDs: TableUID[] = [tableUID];
    for (const field of table.fields) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      if (!subTableUID) continue;
      tableUIDs.push(...this.getTableTreeUIDs(formData, subTableUID, visited));
    }
    return tableUIDs;
  }

  private hasDraftStorageStateService() {
    return !!this.draftStorageStateService?.readState;
  }

  private async getDraftStorageTreeContext(nocodeId: string, formData: NocodeFormData, tableUID: TableUID) {
    const tableUIDs = this.getTableTreeUIDs(formData, tableUID);
    const state = this.hasDraftStorageStateService()
      ? await this.draftStorageStateService.readState(nocodeId)
      : null;
    const statusMap = new Map<TableUID, DraftStorageStatus>();
    const optionTableUIDs: string[] = [];
    for (const currentTableUID of tableUIDs) {
      const { table } = this.getTableContext(formData, currentTableUID);
      const optionTableUid = table?.meta?.uid;
      const status = optionTableUid
        ? (state?.tables?.[optionTableUid]?.status || "legacy")
        : "legacy";
      statusMap.set(currentTableUID, status);
      if (optionTableUid) {
        optionTableUIDs.push(optionTableUid);
      }
    }
    return {
      tableUIDs,
      statusMap,
      optionTableUIDs: Array.from(new Set(optionTableUIDs)).sort(),
      isSeparated: Array.from(statusMap.values()).every(status => status === "separated"),
    };
  }

  private async withDraftStorageLocksForTableTree<T>(nocodeId: string, formData: NocodeFormData, tableUID: TableUID, fn: () => Promise<T>) {
    if (!this.hasDraftStorageStateService()) {
      return await fn();
    }
    const { optionTableUIDs } = await this.getDraftStorageTreeContext(nocodeId, formData, tableUID);
    const run = async (index: number): Promise<T> => {
      if (index >= optionTableUIDs.length) {
        return await fn();
      }
      return await this.draftStorageStateService.withTableLock(nocodeId, optionTableUIDs[index], async () => {
        return await run(index + 1);
      });
    };
    return await run(0);
  }

  private scheduleDraftMigrationForTableTree(nocodeId: string, formData: NocodeFormData, tableUID: TableUID) {
    if (!this.hasDraftStorageStateService()) {
      return;
    }
    const tableUIDs = this.getTableTreeUIDs(formData, tableUID);
    for (const currentTableUID of tableUIDs) {
      void this.ensureDraftStorageMigrated(nocodeId, currentTableUID, formData).catch((err) => {
        this.logger.error("ensure draft storage migrated failed", nocodeId, currentTableUID, err);
      });
    }
  }

  private async getDraftStorageStatus(nocodeId: string, formData: NocodeFormData, tableUID: TableUID): Promise<DraftStorageStatus> {
    const { table } = this.getTableContext(formData, tableUID);
    if (!table?.meta?.uid) {
      return "legacy";
    }
    if (!this.hasDraftStorageStateService()) {
      return "legacy";
    }
    return await this.draftStorageStateService.getTableStatus(nocodeId, table.meta.uid);
  }

  private mergeDraftRow(
    formData: NocodeFormData,
    tableUID: TableUID,
    preferredRow: Row,
    fallbackRow: Row,
    options: { keepFallbackRows?: boolean } = {},
  ) {
    if (!preferredRow) {
      return fallbackRow;
    }
    if (!fallbackRow) {
      return preferredRow;
    }
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return preferredRow;
    }
    const mergedRow = {
      ...fallbackRow,
      ...preferredRow,
    };
    for (const field of table.fields) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      if (!subTableUID) continue;
      const preferredChildren = Array.isArray(preferredRow[field.uid]) ? preferredRow[field.uid] : [];
      const fallbackChildren = Array.isArray(fallbackRow[field.uid]) ? fallbackRow[field.uid] : [];
      if (!preferredChildren.length && !fallbackChildren.length) {
        mergedRow[field.uid] = [];
        continue;
      }
      mergedRow[field.uid] = this.mergeRowsByUUID(formData, subTableUID, preferredChildren, fallbackChildren, options);
    }
    return mergedRow;
  }

  private buildDraftMergeComparableRow(
    formData: NocodeFormData,
    tableUID: TableUID,
    row: Row,
  ) {
    if (!row) {
      return row;
    }
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return row;
    }

    const comparableRow: Record<string, any> = {};
    for (const field of table.fields) {
      if (isSystemField(field)) {
        continue;
      }
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const value = row?.[field.uid];
      if (subTableUID && Array.isArray(value)) {
        comparableRow[field.uid] = value.map(item => this.buildDraftMergeComparableRow(formData, subTableUID, item));
        continue;
      }
      if (value !== undefined) {
        comparableRow[field.uid] = deepClone(value);
      }
    }
    return comparableRow;
  }

  private findFallbackRowForDraftMerge(
    formData: NocodeFormData,
    tableUID: TableUID,
    preferredIndex: number,
    preferredRow: Row,
    fallbackEntries: Array<{ row: Row; uuid?: string; used: boolean }>,
  ): { row: Row; uuid?: string; used: boolean } | null {
    if ((preferredRow as Record<string, any>)?.isManualAdd) {
      return null;
    }

    const unmatchedEntries = fallbackEntries.filter(entry => !entry.used);
    if (unmatchedEntries.length === 0) {
      return null;
    }

    const comparablePreferredRow = stringifyUniqueValue(
      this.buildDraftMergeComparableRow(formData, tableUID, preferredRow),
    );
    const matchedByContent = unmatchedEntries.find(entry => {
      return stringifyUniqueValue(
        this.buildDraftMergeComparableRow(formData, tableUID, entry.row),
      ) === comparablePreferredRow;
    });
    if (matchedByContent) {
      return matchedByContent;
    }

    if (preferredIndex < fallbackEntries.length) {
      return unmatchedEntries[0];
    }

    return null;
  }

  private mergeRowsByUUID(
    formData: NocodeFormData,
    tableUID: TableUID,
    preferredRows: Row[],
    fallbackRows: Row[],
    options: { keepFallbackRows?: boolean } = {},
  ) {
    const { keepFallbackRows = true } = options;
    const table = formData.tables.find(item => item.uid === tableUID);
    const uuidField = getUUIDSystemField(table?.fields || []);
    const fallbackEntries = (fallbackRows || []).map((row) => {
      const uuid = row?.[uuidField?.uid];
      return {
        row,
        used: false,
        uuid: uuid ? String(uuid) : undefined,
      };
    });
    const fallbackRowsByUUID = new Map<string, { row: Row; uuid?: string; used: boolean }>();
    const mergedRows: Row[] = [];

    for (const entry of fallbackEntries) {
      if (entry.uuid) {
        fallbackRowsByUUID.set(entry.uuid, entry);
      }
    }

    for (const [index, row] of (preferredRows || []).entries()) {
      const uuid = row?.[uuidField?.uid];
      let fallbackEntry: { row: Row; uuid?: string; used: boolean } | null = null;
      if (uuid) {
        const normalizedUUID = String(uuid);
        fallbackEntry = fallbackRowsByUUID.get(normalizedUUID);
      } else {
        fallbackEntry = this.findFallbackRowForDraftMerge(
          formData,
          tableUID,
          index,
          row,
          fallbackEntries,
        );
      }

      if (fallbackEntry) {
        fallbackEntry.used = true;
      }

      mergedRows.push(
        this.mergeDraftRow(
          formData,
          tableUID,
          row,
          fallbackEntry?.row,
          options,
        ),
      );
    }

    if (!keepFallbackRows) {
      return mergedRows;
    }

    for (const entry of fallbackEntries) {
      if (entry.used) {
        continue;
      }
      mergedRows.push(entry.row);
    }

    return mergedRows;
  }

  private async fillDraftSubFormFieldCompat(
    rows: Row[],
    nocodeId: string,
    table: Table,
    formData: NocodeFormData,
    statusMap: Map<TableUID, DraftStorageStatus>,
    whereConditions: Record<string, WhereCondition | WhereCondition[]> = {},
    transformFormData: boolean = false,
    formatData = false,
  ) {
    if (!Array.isArray(rows)) return rows;
    const filteredRows = rows.filter(Boolean);
    if (filteredRows.length === 0) return filteredRows;

    const UUIDField = getUUIDSystemField(table.fields);
    const parentUUIDs = filteredRows.map((row) => row?.[UUIDField?.uid]).filter(Boolean);
    if (!parentUUIDs.length) {
      return filteredRows;
    }

    for (const field of table.fields) {
      const subTableUID: TableUID = field.meta?.extra?.subTableUID?.[1];
      if (!subTableUID) continue;
      const subTable = formData.tables?.find((item) => item.uid === subTableUID);
      const relationField = subTable?.fields?.find((item) => item.meta.name === SystemField.KEY);
      if (!subTable || !relationField?.uid) {
        for (const row of filteredRows) {
          row[field.uid] = [];
        }
        continue;
      }
      let baseFilter: WhereCondition = {
        [relationField.uid]: {
          $in: parentUUIDs,
        },
      };
      const conditions = whereConditions?.[field.uid];
      if (conditions) {
        baseFilter = {
          $and: [baseFilter, ...(Array.isArray(conditions) ? conditions : [conditions])],
        };
      }
      const readRows = async (scope: FormDataStoreScope) => {
        const buckets = await this._getData(formData, [subTableUID], nocodeId, {
          transformFormData,
          formatData,
          filters: {
            [subTableUID]: [baseFilter],
          },
          orderBy: SortType.ASC,
          stage: FormDataStage.DRAFT,
          scope,
        });
        return buckets?.find((bucket) => bucket.tableId === subTableUID)?.rows || [];
      };

      const draftRows = await readRows("draft");
      const childRows = statusMap.get(subTableUID) === "separated"
        ? draftRows
        : this.mergeRowsByUUID(formData, subTableUID, draftRows, await readRows("main"));
      const intactChildRows = await this.fillDraftSubFormFieldCompat(
        childRows,
        nocodeId,
        subTable,
        formData,
        statusMap,
        whereConditions,
        transformFormData,
        formatData,
      );
      const groupedRows = intactChildRows.reduce<Record<string, Row[]>>((prev, row) => {
        const relationValue = row?.[relationField.uid];
        if (!relationValue) return prev;
        const key = String(relationValue);
        if (!prev[key]) {
          prev[key] = [];
        }
        prev[key].push(row);
        return prev;
      }, {});
      for (const row of filteredRows) {
        const uuid = row?.[UUIDField?.uid];
        row[field.uid] = uuid ? (groupedRows[String(uuid)] || []) : [];
      }
    }
    return filteredRows;
  }

  private ensureHandleDataSuccess(res: HandleDataResult, errorKey = 'formDataService.updateDataFail') {
    if (!res?.success) {
      throw new Error(global.i18next.t(errorKey));
    }
    return res;
  }

  private buildRowsWhereCondition(rows: Row[] = [], keys: OptionFieldUID[] = []) {
    const conditions = rows
      .map((row) => {
        const query = {};
        for (const key of keys) {
          const fieldUID = key?.[2];
          if (fieldUID && row?.[fieldUID] !== undefined) {
            query[fieldUID] = row[fieldUID];
          }
        }
        return query;
      })
      .filter((query) => !isEmpty(query));

    if (!conditions.length) {
      return null;
    }
    if (conditions.length === 1) {
      return conditions[0];
    }
    return {
      $or: conditions,
    } as WhereCondition;
  }

  private getRecycleMutationStageCondition(table: Table, targetStage: FormDataStage) {
    const stageField = this.getSystemFieldByName(table, SystemField.DATA_STAGE);
    if (!stageField?.uid) {
      return null;
    }

    if (targetStage === FormDataStage.DELETING) {
      return {
        $or: [
          { [stageField.uid]: { $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING] } },
          { [stageField.uid]: { $exists: false } },
        ],
      } as WhereCondition;
    }

    if (targetStage === FormDataStage.DELETED) {
      return {
        $or: [
          { [stageField.uid]: { $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING] } },
          { [stageField.uid]: { $exists: false } },
        ],
      } as WhereCondition;
    }

    if (targetStage === FormDataStage.NORMAL) {
      return {
        [stageField.uid]: FormDataStage.DELETED,
      } as WhereCondition;
    }

    return {
      [stageField.uid]: targetStage,
    } as WhereCondition;
  }

  private async loadRowsForRecycleMutation(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
    keys: OptionFieldUID[],
    targetStage: FormDataStage,
    scope: FormDataStoreScope = "main",
  ) {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return [];
    }

    const baseCondition = this.buildRowsWhereCondition(rows, keys);
    if (!baseCondition) {
      return [];
    }

    const buckets = await this._getData(formData, [tableUID], nocodeId, {
      filters: {
        [tableUID]: [
          this.mergeWhereConditions(
            baseCondition,
            this.getRecycleMutationStageCondition(table, targetStage),
          ),
        ],
      },
      enabledStage: false,
      scope,
    });
    return buckets?.[0]?.rows || [];
  }

  public async loadRowsForAuditSnapshot(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    keys: OptionFieldUID[] = [],
    options: {
      stage?: FormDataStage | FormDataStageWhereCondition,
      scope?: FormDataStoreScope,
      fillSubTable?: boolean,
      formatData?: boolean,
    } = {},
  ) {
    const { table } = this.getTableContext(formData, tableUID);
    if (!table || isEmpty(rows) || isEmpty(keys)) {
      return [];
    }

    const fieldsMap = new Map(table.fields.map(field => [field.uid, field]));
    const conditions = rows
      .map((row) => {
        const query = {};
        for (const key of keys) {
          const fieldUID = key?.[2];
          if (!fieldUID) {
            continue;
          }
          if (row?.[fieldUID] !== undefined) {
            query[fieldUID] = row[fieldUID];
            continue;
          }
          const field = fieldsMap.get(fieldUID);
          if (field?.meta?.name && row?.[field.meta.name] !== undefined) {
            query[fieldUID] = row[field.meta.name];
          }
        }
        return query;
      })
      .filter(query => !isEmpty(query));

    if (!conditions.length) {
      return [];
    }

    const baseCondition = conditions.length === 1
      ? conditions[0]
      : {
        $or: conditions,
      } as WhereCondition;
    const filterCondition = options.stage === undefined
      ? baseCondition
      : this.mergeWhereConditions(
        baseCondition,
        this.buildTableStageWhereCondition(table, options.stage, true),
      );
    const scope = options.scope || "main";
    const buckets = await this._getData(formData, [tableUID], nocodeId, {
      filters: {
        [tableUID]: [filterCondition],
      },
      enabledStage: false,
      formatData: options.formatData,
      scope,
    });
    let snapshotRows = buckets?.[0]?.rows || [];
    if (options.fillSubTable) {
      snapshotRows = await this.fillSubFormField(
        snapshotRows,
        nocodeId,
        table,
        formData,
        {},
        false,
        Boolean(options.formatData),
        scope,
        true,
      );
    }
    return snapshotRows;
  }

  private async updateRowsStageRecursively(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
    keys: OptionFieldUID[],
    targetStage: FormDataStage,
    scope: FormDataStoreScope = "main",
    recycleMutationTime?: string,
  ) {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table || isEmpty(rows)) {
      return {
        tableName: table?.alias || tableUID,
        data: [],
        success: true,
      } as HandleDataResult;
    }

    const currentRecycleMutationTime = targetStage === FormDataStage.DELETED
      ? (recycleMutationTime || dayjs().format("YYYY-MM-DD HH:mm:ss"))
      : recycleMutationTime;
    const res = await this.updateData(formData, nocodeId, tableUID, rows, keys, targetStage, scope, {
      skipValidation: true,
      skipLock: true,
      skipSubTableSync: true,
      fixedUpdateTime: currentRecycleMutationTime,
    });
    this.ensureHandleDataSuccess(res);

    const { subTableUIDs } = transformDeleteRows(table, rows);
    const updatedRows = Array.isArray(res.data) ? res.data : [];
    if (updatedRows.length) {
      const uuids = updatedRows.map(row => row?.[SystemField.UUID]).filter(Boolean);
      for (const subTableUID of subTableUIDs) {
        const relationTable = formData.tables.find(item => item.uid === subTableUID[1]);
        const relationField = relationTable?.fields?.find(field => field.meta.name === SystemField.KEY);
        const relationUUIDField = relationTable ? getUUIDSystemField(relationTable.fields) : null;
        if (!relationTable || !relationField?.uid || !relationUUIDField?.uid || isEmpty(uuids)) {
          continue;
        }

        const childBaseCondition = targetStage === FormDataStage.NORMAL
          ? this.buildRecycleRestoreRelationCondition(table, rows, relationTable, relationField.uid)
          : {
            [relationField.uid]: {
              $in: uuids,
            },
          };
        if (!childBaseCondition) {
          continue;
        }

        const childBuckets = await this._getData(formData, [subTableUID[1]], nocodeId, {
          filters: {
            [subTableUID[1]]: [
              this.mergeWhereConditions(
                childBaseCondition,
                this.getRecycleMutationStageCondition(relationTable, targetStage),
              ),
            ],
          },
          enabledStage: false,
          scope,
        });
        const childRows = childBuckets?.[0]?.rows || [];
        if (isEmpty(childRows)) {
          continue;
        }
        await this.updateRowsStageRecursively(
          formData,
          nocodeId,
          subTableUID[1],
          childRows,
          [[...subTableUID, relationUUIDField.uid]],
          targetStage,
          scope,
          currentRecycleMutationTime,
        );
      }
    }

    if (scope === "main") {
      if (targetStage === FormDataStage.DELETED) {
        await this.afterDeleteData(nocodeId, table, rows);
      } else if (targetStage === FormDataStage.NORMAL) {
        await this.afterAddData(nocodeId, table, rows);
      }
    }

    return res;
  }

  private buildRecycleRestoreRelationCondition(
    parentTable: Table,
    parentRows: Row[],
    relationTable: Table,
    relationFieldUID: FieldUID,
  ) {
    const parentUUIDField = getUUIDSystemField(parentTable.fields);
    if (!parentUUIDField?.uid) {
      return null;
    }

    const parentUpdateTimeField = this.getSystemFieldByName(parentTable, SystemField.UPDATE_TIME);
    const parentUpdateOwnerField = getUpdateOwnerSystemField(parentTable.fields);
    const relationUpdateTimeField = this.getSystemFieldByName(relationTable, SystemField.UPDATE_TIME);
    const relationUpdateOwnerField = getUpdateOwnerSystemField(relationTable.fields);
    const conditions = parentRows
      .map((row) => {
        const uuid = row?.[parentUUIDField.uid];
        if (!uuid) {
          return null;
        }

        const andConditions: WhereCondition[] = [{
          [relationFieldUID]: uuid,
        }];
        const updateTime = parentUpdateTimeField?.uid ? row?.[parentUpdateTimeField.uid] : null;
        if (relationUpdateTimeField?.uid && updateTime) {
          andConditions.push({
            [relationUpdateTimeField.uid]: {
              $gte: updateTime,
            },
          });
        }
        const updateOwner = parentUpdateOwnerField?.uid ? row?.[parentUpdateOwnerField.uid] : null;
        if (relationUpdateOwnerField?.uid && updateOwner) {
          andConditions.push({
            [relationUpdateOwnerField.uid]: updateOwner,
          });
        }

        if (andConditions.length === 1) {
          return andConditions[0];
        }
        return {
          $and: andConditions,
        } as WhereCondition;
      })
      .filter(Boolean);

    if (!conditions.length) {
      return null;
    }
    if (conditions.length === 1) {
      return conditions[0];
    }
    return {
      $or: conditions,
    } as WhereCondition;
  }

  private sanitizeRowsForPromote(formData: NocodeFormData, tableUID: TableUID, rows: Row[]) {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return rows;
    }
    const stageField = this.getSystemFieldByName(table, SystemField.DATA_STAGE);
    const updateOwnerField = getUpdateOwnerSystemField(table.fields);
    const updateTimeField = this.getSystemFieldByName(table, SystemField.UPDATE_TIME);
    const sanitizedRows = deepClone(rows || []);
    for (const row of sanitizedRows) {
      if (stageField?.uid) {
        delete row[stageField.uid];
      }
      if (updateOwnerField?.uid) {
        delete row[updateOwnerField.uid];
      }
      if (updateTimeField?.uid) {
        delete row[updateTimeField.uid];
      }
      for (const field of table.fields) {
        const subTableUID = field.meta?.extra?.subTableUID?.[1];
        if (!subTableUID || !Array.isArray(row[field.uid])) continue;
        row[field.uid] = this.sanitizeRowsForPromote(formData, subTableUID, row[field.uid]);
      }
    }
    return sanitizedRows;
  }

  private async loadDraftRowsByScope(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    filters: WhereCondition[],
    scope: FormDataStoreScope,
    statusMap?: Map<TableUID, DraftStorageStatus>,
  ) {
    const { table } = this.getTableContext(formData, tableUID);
    if (!table) {
      return [];
    }
    const buckets = await this._getData(formData, [tableUID], nocodeId, {
      filters: {
        [tableUID]: filters,
      },
      stage: FormDataStage.DRAFT,
      scope,
    });
    const rows = buckets?.[0]?.rows || [];
    if (isEmpty(rows)) {
      return [];
    }
    if (statusMap) {
      return await this.fillDraftSubFormFieldCompat(rows, nocodeId, table, formData, statusMap);
    }
    return await this.fillSubFormField(rows, nocodeId, table, formData, {}, false, false, scope, true);
  }

  private async loadDraftRowsByUUIDs(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    uuids: string[],
    scope: FormDataStoreScope,
    statusMap?: Map<TableUID, DraftStorageStatus>,
  ) {
    if (isEmpty(uuids)) {
      return [];
    }
    const { table } = this.getTableContext(formData, tableUID);
    const uuidField = getUUIDSystemField(table?.fields || []);
    if (!table || !uuidField?.uid) {
      return [];
    }
    return await this.loadDraftRowsByScope(formData, nocodeId, tableUID, [{
      [uuidField.uid]: {
        $in: uuids,
      },
    }], scope, statusMap);
  }

  private getDraftStorageStatusByTable(statusMap: Map<TableUID, DraftStorageStatus>, tableUID: TableUID): DraftStorageStatus {
    return statusMap?.get(tableUID) || "legacy";
  }

  private async loadCompatDraftRowsByUUIDs(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    uuids: string[],
    statusMap: Map<TableUID, DraftStorageStatus>,
  ) {
    const draftRows = await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "draft", statusMap);
    const legacyRows = this.getDraftStorageStatusByTable(statusMap, tableUID) === "separated"
      ? []
      : await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "main", statusMap);
    return this.mergeRowsByUUID(formData, tableUID, draftRows, legacyRows);
  }

  private async syncDraftRowsSnapshot(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    uuids: string[],
    snapshotRows: Row[],
  ) {
    const { table } = this.getTableContext(formData, tableUID);
    const uuidField = getUUIDSystemField(table?.fields || []);
    if (!table || !uuidField?.uid) {
      return;
    }
    const keys: OptionFieldUID[] = [[formData.uid, tableUID, uuidField.uid]];
    const currentDraftRows = await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "draft");
    if (!isEmpty(currentDraftRows)) {
      const deleteRes = await this.deleteData(formData, nocodeId, tableUID, currentDraftRows, keys, "draft");
      this.ensureHandleDataSuccess(deleteRes);
    }
    if (!isEmpty(snapshotRows)) {
      const restoreRes = await this.tryAddData(
        formData,
        nocodeId,
        tableUID,
        deepClone(snapshotRows),
        {
          stage: FormDataStage.DRAFT,
          scope: "draft",
          preserveOwners: true,
          uniqueValidation: {
            skipValidation: true,
          },
        },
      );
      this.ensureHandleDataSuccess(restoreRes);
    }
  }

  private async deleteLegacyDraftRowsFromMainScope(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
    statusMap: Map<TableUID, DraftStorageStatus>,
  ) {
    const { table } = this.getTableContext(formData, tableUID);
    const normalizedRows = (rows || []).filter(Boolean);
    if (!table || isEmpty(normalizedRows)) {
      return;
    }
    if (this.getDraftStorageStatusByTable(statusMap, tableUID) !== "separated") {
      const uuidField = getUUIDSystemField(table.fields);
      const uuids = Array.from(new Set(
        normalizedRows
          .map(row => row?.[uuidField?.uid])
          .filter(Boolean),
      ));
      if (!isEmpty(uuids)) {
        const legacyRows = await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "main");
        if (!isEmpty(legacyRows)) {
          const { newRows } = transformDeleteRows(table, legacyRows);
          const deleteRes = await this._deleteData(formData.options, nocodeId, table.meta.uid, newRows, [SystemField.UUID], "main");
          this.ensureHandleDataSuccess(deleteRes);
        }
      }
    }
    for (const field of table.fields) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      if (!subTableUID) continue;
      const childRows = normalizedRows.flatMap((row) => Array.isArray(row?.[field.uid]) ? row[field.uid].filter(Boolean) : []);
      if (isEmpty(childRows)) continue;
      await this.deleteLegacyDraftRowsFromMainScope(formData, nocodeId, subTableUID, childRows, statusMap);
    }
  }

  private async shouldDisableStageFilterForMainRead(
    nocodeId: string,
    formData: NocodeFormData,
    tableUIDs: TableUID[],
    options?: QueryOptions,
  ) {
    if ((options?.scope || "main") !== "main") {
      return false;
    }
    if (tableUIDs.length !== 1) {
      return false;
    }
    if (!this.isDraftOnlyExcludedStage(options?.stage)) {
      return false;
    }
    return await this.getDraftStorageStatus(nocodeId, formData, tableUIDs[0]) === "separated";
  }

  private resolveTableSourceContext(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    nocodeId: string,
    tableUID: TableUID,
    fillSubTableFields = false,
  ) {
    const sourceData = getNocodeDataSourceTableByUID(nocodeBody, tableUID, { nocodeId }, fillSubTableFields);
    const sourceFormData = sourceData?.connection as NocodeFormData | undefined;
    const table = sourceData?.table;
    const sourceNocodeId = sourceData?.connection?.nocodeId || nocodeId;
    const uuidField = table ? getUUIDSystemField(table.fields) : null;
    const titleField = table?.fields?.find(field => field.meta.name === SystemField.DATA_TITLE) || null;
    const optionTable = table ? sourceFormData?.options?.tables?.find(item => item.uid === table.meta.uid) : null;
    return {
      table,
      sourceFormData,
      sourceNocodeId,
      uuidField,
      titleField,
      optionTable,
    };
  }

  private async getTableSourceContext(
    nocodeId: string,
    tableUID: TableUID,
    fillSubTableFields = false,
    options?: {
      useEditorSources?: boolean,
    },
  ) {
    const nocodeBody = options?.useEditorSources
      ? await this.projectService.getEditorNocodeBodyWithOtherDataSources(nocodeId)
      : await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    return {
      nocodeBody,
      ...this.resolveTableSourceContext(nocodeBody, nocodeId, tableUID, fillSubTableFields),
    };
  }

  async syncTable(nocodeId: string, tableUIDs: string[], formData: NocodeFormData) {
    const data = await this.connectionUtils.readConnectionData(formData, true, nocodeId, unique(), {}, {
      tableUIDs,
    });
    return data;
  }

  async count(nocodeId: string, tableUID: TableUID, options?: QueryOptions) {
    const { table, optionTable, sourceNocodeId } = await this.getTableSourceContext(nocodeId, tableUID, false, {
      useEditorSources: options?.useEditorSources,
    });
    if (!table || !optionTable) {
      return 0;
    }
    const db = await this.dbManager.getDB(sourceNocodeId, optionTable, options?.scope || "main");

    const stage = options?.stage ?? this.getDefaultReadableStageCondition();
    const permissionCondition = await this.getReadPermissionWhereCondition(sourceNocodeId, table, stage);
    const query = rewriteDataOwnerCompatibility(this.mergeWhereConditions(
      convertCondition(options?.filters?.[tableUID]?.[0], table) || {},
      permissionCondition,
      this.buildTableStageWhereCondition(table, stage, options?.enabledStage !== false),
    ));
    return await db.count(query || {});
  }
  async findOne(nocodeId: string, tableUID: TableUID, options?: QueryOptions) {
    const { nocodeBody, table, optionTable, sourceFormData, sourceNocodeId } = await this.getTableSourceContext(
      nocodeId,
      tableUID,
      false,
      {
        useEditorSources: options?.useEditorSources,
      },
    );
    if (!table || !optionTable || !sourceFormData) {
      return null;
    }
    const db = await this.dbManager.getDB(sourceNocodeId, optionTable, options?.scope || "main");
    const stage = options?.stage ?? this.getDefaultReadableStageCondition();
    const permissionCondition = await this.getReadPermissionWhereCondition(sourceNocodeId, table, stage);
    const query = rewriteDataOwnerCompatibility(this.mergeWhereConditions(
      convertCondition(options?.filters?.[tableUID]?.[0], table) || {},
      permissionCondition,
      this.buildTableStageWhereCondition(table, stage, options?.enabledStage !== false),
    ));
    const doc = await db.findOne(query || {});
    if (!doc) return null;
    const [bucket] = await  this.connectionUtils.getBucketRow(
      sourceFormData,
      [
        {
          tableName: optionTable.tableName,
          tableUid: optionTable.uid,
          columns: optionTable.columns,
          data: [doc],
        }
      ],
      table,
    )
    let row = bucket?.rows?.[0];
    if (!row) {
      return null
    }
    if (options.fillSubTable) {
      [row] = await this.fillSubFormField([row], sourceNocodeId, table, sourceFormData, {}, false, false, options?.scope || "main");
    }
    if (options.transformRelated) {
      [row] = await this.transformRelatedField([row], nocodeId, table, nocodeBody, stage, {
        transformRelatedResultObject: options?.transformRelatedResultObject,
        transformFormData: options?.transformFormData,
      });
    }

    return row
  }

  private async getUUIDQueryContext(
    nocodeId: string,
    tableUID: TableUID,
    options?: {
      useEditorSources?: boolean,
    },
  ) {
    const { table, uuidField } = await this.getTableSourceContext(nocodeId, tableUID, false, {
      useEditorSources: options?.useEditorSources,
    });
    return {
      table,
      uuidField,
    };
  }

  private buildQueryOptionsByUUID(tableUID: TableUID, uuidField: Field, uuid: string, options?: QueryOptions): QueryOptions {
    return {
      ...options,
      filters: {
        ...(options?.filters || {}),
        [tableUID]: [{
          [uuidField.uid]: uuid,
        }],
      },
    };
  }

  async canReadDataByUUID(
    nocodeId: string,
    tableUID: TableUID,
    uuid: string,
    options?: Pick<QueryOptions, "stage" | "enabledStage" | "scope">,
  ) {
    const { table, uuidField } = await this.getUUIDQueryContext(nocodeId, tableUID);
    if (!table || !uuidField) {
      return false;
    }

    const count = await this.count(
      nocodeId,
      tableUID,
      this.buildQueryOptionsByUUID(tableUID, uuidField, uuid, options),
    );
    return count > 0;
  }

  async findOneByUUID(nocodeId: string, tableUID: TableUID, uuid: string, options?: QueryOptions) {
    const { table, uuidField } = await this.getUUIDQueryContext(nocodeId, tableUID, {
      useEditorSources: options?.useEditorSources,
    });
    if (!table || !uuidField) {
      return null;
    }

    const buckets = await this.getData(
      nocodeId,
      [tableUID],
      this.buildQueryOptionsByUUID(tableUID, uuidField, uuid, options),
    );

    return buckets?.find(bucket => bucket.tableId === tableUID)?.rows?.[0] ?? null;
  }

  async _distinct(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    fieldId: FieldUID,
    options?: QueryOptions,
    permissionOptions?: { skipReadPermission?: boolean },
  ) {
    const table = formData.tables.find(t => t.uid === tableUID);
    const field = table.fields.find(f => f.uid === fieldId)
    const optionTable = formData.options.tables.find(t => t.uid === table.meta.uid);
    const db = await this.dbManager.getDB(nocodeId, optionTable, options?.scope || "main");

    const stage = options?.stage ?? FormDataStage.NORMAL;
    const permissionCondition = permissionOptions?.skipReadPermission
      ? null
      : await this.getReadPermissionWhereCondition(nocodeId, table, stage);
    const queryCondition = this.mergeWhereConditions(
      convertCondition(options?.filters?.[tableUID]?.[0], table) || {},
      permissionCondition,
      this.buildTableStageWhereCondition(table, stage, options?.enabledStage !== false),
    );
    const query = rewriteDataOwnerCompatibility(transformWhereCondition(convertWhere(queryCondition || {}), optionTable.columns));
    const sort = convertOrderby(options?.orderBy as Record<string, SortType>, table)
    const convetrOptions = { sort }
    if (field?.meta?.name === SystemField.DATA_OWNER) {
      return await this.distinctDataOwnerWithCompatibility(db, table, query, convetrOptions);
    }
    return await db.distinct(getDbColumnKey(field), query, convetrOptions);
  }

  async distinct(nocodeId: string, tableUID: TableUID, fieldId: FieldUID, options?: QueryOptions, onlyValue = true) {
    const nocodeBody = options?.useEditorSources
      ? await this.projectService.getEditorNocodeBodyWithOtherDataSources(nocodeId)
      : await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const formData = nocodeBody.formData as NocodeFormData;
    const runtimeSources = this.getAggregateRuntimeSources(nocodeBody, nocodeId);
    const aggregateTableUIDSet = new Set(
      runtimeSources.flatMap(source => (source.aggregateTables || []).map(table => table.uid)),
    );
    const res = aggregateTableUIDSet.has(tableUID)
      ? await this.distinctAggregateTable(runtimeSources, nocodeId, tableUID, fieldId, options)
      : await this._distinct(formData, nocodeId, tableUID, fieldId, options);
    if (!onlyValue) return res;
    return res.map(({value})=>value);
  }

  private async distinctAggregateTable(
    runtimeSources: AggregateRuntimeSource[],
    nocodeId: string,
    tableUID: TableUID,
    fieldId: FieldUID,
    options?: QueryOptions,
  ) {
    const distinctOptions = {
      ...(options || {}),
    };
    delete distinctOptions.pageSize;
    delete distinctOptions.pageNumber;
    delete distinctOptions.start;
    delete distinctOptions.limit;

    const bucket = await this.buildAggregateBucketByTableUID(
      tableUID,
      distinctOptions,
      runtimeSources,
      nocodeId,
    );
    const field = bucket?.fields?.find(item => {
      return item.uid === fieldId || item.meta?.uid === fieldId || item.meta?.name === fieldId;
    });
    if (!field) {
      return [];
    }

    const distinctMap = new Map<any, { value: any, count: number }>();
    const appendValue = (value: any) => {
      if (Array.isArray(value)) {
        value.forEach(item => appendValue(item));
        return;
      }
      const current = distinctMap.get(value);
      if (current) {
        current.count += 1;
        return;
      }
      distinctMap.set(value, {
        value,
        count: 1,
      });
    };

    (bucket?.rows || []).forEach(row => {
      appendValue(row?.[field.uid]);
    });

    return Array.from(distinctMap.values());
  }

  private appendMongoQueryCondition(query: Record<string, any>, condition: Record<string, any>) {
    if (isEmpty(query)) {
      return condition;
    }
    if (isEmpty(condition)) {
      return query;
    }
    if (Array.isArray(query.$and)) {
      return {
        ...query,
        $and: [...query.$and, condition],
      };
    }
    return {
      $and: [query, condition],
    };
  }

  private remapDistinctSortOptions(
    options: { sort?: Record<string, SortType> | SortType },
    fieldKey: string,
    logicalFieldKeys: string[],
  ) {
    const sort = options?.sort;
    if (typeof sort === "number" || !sort || Array.isArray(sort)) {
      return options;
    }

    const mappedSort = Object.entries(sort).reduce((result, [sortField, direction]) => {
      const nextField = logicalFieldKeys.includes(sortField) ? fieldKey : sortField;
      result[nextField] = direction;
      return result;
    }, {} as Record<string, SortType>);

    return {
      ...options,
      sort: mappedSort,
    };
  }

  private mergeDistinctResults(results: Array<{ value: any, count: number }[]>) {
    const merged = new Map<string, { value: any, count: number }>();
    for (const items of results) {
      for (const item of items || []) {
        const isEmptyValue = item?.value === undefined || item?.value === null || item?.value === "";
        const mergeKey = isEmptyValue ? "__empty__" : stringifyUniqueValue(item?.value);
        const current = merged.get(mergeKey);
        if (current) {
          current.count += item?.count || 0;
          continue;
        }
        merged.set(mergeKey, {
          value: isEmptyValue ? "" : item?.value,
          count: item?.count || 0,
        });
      }
    }
    return Array.from(merged.values());
  }

  private async distinctDataOwnerWithCompatibility(
    db: Awaited<ReturnType<DbManager["getDB"]>>,
    table: Table,
    query: Record<string, any>,
    options: { sort?: Record<string, SortType> | SortType },
  ) {
    const dataOwnerField = getDataOwnerSystemField(table.fields);
    const createOwnerField = getCreateOwnerSystemField(table.fields);
    if (!dataOwnerField || !createOwnerField) {
      return await db.distinct(SystemField.DATA_OWNER, query, options);
    }

    const dataOwnerKey = getDbColumnKey(dataOwnerField);
    const createOwnerKey = getDbColumnKey(createOwnerField);
    const dataOwnerDistinctOptions = this.remapDistinctSortOptions(options, dataOwnerKey, [dataOwnerKey, createOwnerKey]);
    const createOwnerDistinctOptions = this.remapDistinctSortOptions(options, createOwnerKey, [dataOwnerKey, createOwnerKey]);
    const effectiveDataOwnerResults = await db.distinct(dataOwnerKey, this.appendMongoQueryCondition(query, {
      $and: [
        { [dataOwnerKey]: { $exists: true } },
        { [dataOwnerKey]: { $nin: [null, ""] } },
      ],
    }), dataOwnerDistinctOptions);
    const fallbackCreateOwnerResults = await db.distinct(createOwnerKey, this.appendMongoQueryCondition(query, {
      $and: [
        {
          $or: [
            { [dataOwnerKey]: { $exists: false } },
            { [dataOwnerKey]: null },
            { [dataOwnerKey]: "" },
          ],
        },
        { [createOwnerKey]: { $exists: true } },
        { [createOwnerKey]: { $nin: [null, ""] } },
      ],
    }), createOwnerDistinctOptions);
    const emptyDataOwnerCount = await db.count(this.appendMongoQueryCondition(query, {
      $and: [
        {
          $or: [
            { [dataOwnerKey]: { $exists: false } },
            { [dataOwnerKey]: null },
            { [dataOwnerKey]: "" },
          ],
        },
        {
          $or: [
            { [createOwnerKey]: { $exists: false } },
            { [createOwnerKey]: null },
            { [createOwnerKey]: "" },
          ],
        },
      ],
    }));

    return this.mergeDistinctResults([
      effectiveDataOwnerResults,
      fallbackCreateOwnerResults,
      emptyDataOwnerCount > 0 ? [{ value: "", count: emptyDataOwnerCount }] : [],
    ]);
  }

  private getFirstFilterCondition(condition?: WhereCondition | WhereCondition[]) {
    if (!condition) {
      return null;
    }
    return Array.isArray(condition) ? condition[0] : condition;
  }

  private getAutoComputeFilterLogic(condition?: WhereCondition | null) {
    if (!condition) {
      return LogicalOperator.AND;
    }
    return "$or" in condition ? LogicalOperator.OR : LogicalOperator.AND;
  }

  private getAutoComputeFieldSet(table?: Table) {
    const fieldIds = (table?.fields || []).flatMap((field) => {
      return [field.uid, field.meta?.name].filter(Boolean);
    });
    return new Set(fieldIds);
  }

  private async distinctAutoComputeFieldValues(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    fieldUID?: FieldUID,
    filterCondition?: WhereCondition | null,
    options?: QueryOptions,
  ) {
    if (!fieldUID || !filterCondition) {
      return [];
    }

    const res = await this._distinct(formData, nocodeId, tableUID, fieldUID, {
      ...(options || {}),
      filters: {
        [tableUID]: [filterCondition],
      },
    });
    return res.map(({ value }) => value).filter(Boolean);
  }

  private pickAutoComputeFilterByFields(
    condition: WhereCondition,
    fieldSet: Set<string>,
  ): WhereCondition | null {
    if (!condition || !fieldSet?.size) {
      return null;
    }

    if ('$and' in condition) {
      const conditions = (Array.isArray(condition.$and) ? condition.$and : [])
        .map((item) => this.pickAutoComputeFilterByFields(item, fieldSet))
        .filter(Boolean) as WhereCondition[];
      if (!conditions.length) {
        return null;
      }
      return conditions.length === 1 ? conditions[0] : { $and: conditions };
    }

    if ('$or' in condition) {
      const conditions = (Array.isArray(condition.$or) ? condition.$or : [])
        .map((item) => this.pickAutoComputeFilterByFields(item, fieldSet))
        .filter(Boolean) as WhereCondition[];
      if (!conditions.length) {
        return null;
      }
      return conditions.length === 1 ? conditions[0] : { $or: conditions };
    }

    if ('$not' in condition) {
      const next = typeof condition.$not === "object" && condition.$not !== null
        ? this.pickAutoComputeFilterByFields(condition.$not as WhereCondition, fieldSet)
        : null;
      return next ? { $not: next } : null;
    }

    const picked: Record<string, any> = {};
    for (const key in condition) {
      if (fieldSet.has(key)) {
        picked[key] = condition[key];
      }
    }

    return isEmpty(picked) ? null : picked as WhereCondition;
  }

  private async appendTargetSubFilterToAutoComputeOptions(
    formData: NocodeFormData,
    nocodeId: string,
    targetTable: Table,
    options?: QueryOptions,
  ) {
    const currentFilter = this.getFirstFilterCondition(options?.filters?.[targetTable.uid]);
    const mainUUIDField = getUUIDSystemField(targetTable.fields);
    if (!currentFilter || !mainUUIDField?.uid) {
      return options;
    }

    const uuidGroup: any[] = [];
    const mainTableFilter = this.pickAutoComputeFilterByFields(currentFilter, this.getAutoComputeFieldSet(targetTable));
    if (mainTableFilter) {
      uuidGroup.push(await this.distinctAutoComputeFieldValues(
        formData,
        nocodeId,
        targetTable.uid,
        mainUUIDField.uid,
        mainTableFilter,
        options,
      ));
    }

    let hasSubFilter = false;
    const subTableUIDs = [...new Set(targetTable.fields.map(field => field.meta?.extra?.subTableUID?.[1]).filter(Boolean))] as TableUID[];
    for (const subTableUID of subTableUIDs) {
      const subTable = formData.tables.find(table => table.uid === subTableUID);
      const keyFieldUID = subTable?.fields.find(field => field.meta.name === SystemField.KEY)?.uid;
      const subTableFilter = this.pickAutoComputeFilterByFields(currentFilter, this.getAutoComputeFieldSet(subTable));
      if (!subTableFilter || !keyFieldUID) {
        continue;
      }

      hasSubFilter = true;
      uuidGroup.push(await this.distinctAutoComputeFieldValues(
        formData,
        nocodeId,
        subTable.uid,
        keyFieldUID,
        subTableFilter,
        options,
      ));
    }

    if (!hasSubFilter) {
      return options;
    }

    const mainUUIDs = uuidGroup.length > 1
      ? (this.getAutoComputeFilterLogic(currentFilter) === LogicalOperator.OR ? Array.from(new Set(uuidGroup.flat())) : intersection(...uuidGroup))
      : (uuidGroup[0] || []);
    const filters = deepClone(options?.filters || {});
    filters[targetTable.uid] = [{
      [mainUUIDField.uid]: {
        $in: mainUUIDs,
      },
    }];

    return {
      ...(options || {}),
      filters,
    };
  }

  private mergeAutoComputeFilterConditions(...conditions: (WhereCondition | null | undefined)[]) {
    const validConditions = conditions.filter(Boolean) as WhereCondition[];
    if (!validConditions.length) {
      return null;
    }
    if (validConditions.length === 1) {
      return validConditions[0];
    }
    return {
      $and: validConditions,
    } as WhereCondition;
  }

  private async appendTargetMainFilterToAutoComputeOptions(
    formData: NocodeFormData,
    nocodeId: string,
    targetTableUID: TableUID,
    options?: QueryOptions,
  ) {
    if (!targetTableUID) {
      return options;
    }

    const targetTable = formData.tables.find(t => t.uid === targetTableUID);
    if (!targetTable) {
      return options;
    }
    const targetMainTableUID = targetTable?.meta?.extra?.primaryTable?.[1];
    if (!targetMainTableUID) {
      return await this.appendTargetSubFilterToAutoComputeOptions(
        formData,
        nocodeId,
        targetTable,
        options,
      );
    }

    const mainTable = formData.tables.find(t => t.uid === targetMainTableUID);
    const mainUUIDField = getUUIDSystemField(mainTable?.fields);
    if (!mainTable || !mainUUIDField?.uid) {
      return options;
    }

    const filters = deepClone(options?.filters || {});
    const currentFilter = this.getFirstFilterCondition(filters[targetTableUID]);
    const mainTableFilter = this.mergeAutoComputeFilterConditions(
      this.getFirstFilterCondition(filters[targetMainTableUID]),
      this.pickAutoComputeFilterByFields(currentFilter, this.getAutoComputeFieldSet(mainTable)),
    );
    const targetTableFilter = this.pickAutoComputeFilterByFields(
      currentFilter,
      this.getAutoComputeFieldSet(targetTable),
    );
    const mainOptions = mainTableFilter ? {
      ...(options || {}),
      filters: {
        ...filters,
        [targetMainTableUID]: [mainTableFilter],
      },
    } : undefined;
    const res = await this._distinct(
      formData,
      nocodeId,
      targetMainTableUID,
      mainUUIDField.uid,
      mainOptions,
    );
    const mainUUIDs = res.map(({ value }) => value).filter(Boolean);

    const keyField = targetTable.fields.find(field => field.meta.name === SystemField.KEY);
    if (!keyField?.uid) {
      return options;
    }

    const relationFilter = {
      [keyField.uid]: {
        $in: mainUUIDs,
      }
    };
    filters[targetTableUID] = [
      this.mergeAutoComputeFilterConditions(relationFilter, targetTableFilter) || relationFilter
    ];

    return {
      ...(options || {}),
      filters,
    };
  }

  async autoComputeDistinct(
    nocodeId: string,
    tableUID: TableUID,
    fieldId: FieldUID,
    options?: QueryOptions,
  ) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData as NocodeFormData;
    const scopedOptions = await this.appendTargetMainFilterToAutoComputeOptions(
      formData,
      nocodeId,
      tableUID,
      options,
    );
    return await this._distinct(formData, nocodeId, tableUID, fieldId, scopedOptions);
  }

  async _getData(
    formData: NocodeFormData,
    tableUIDs: string[],
    nocodeId: string,
    options?: QueryOptions,
    internalOptions?: InternalReadDataOptions,
  ) {
    const { buckets }: {buckets: Bucket[]} = await this.connectionUtils.readConnectionData(formData, false, nocodeId, unique(), {}, {
      tableUIDs,
      queryOptions: {
        ...(options || {}),
      },
      transformFormData: options?.transformFormData,
      fieldUIDsMap: internalOptions?.fieldUIDsMap,
    });
    return buckets;
  }

  private getAggregateRuntimeSources(nocodeBody: NocodeBody, nocodeId: string): AggregateRuntimeSource[] {
    const sources: AggregateRuntimeSource[] = [];
    if (nocodeBody?.formData?.uid) {
      sources.push({
        uid: nocodeBody.formData.uid,
        nocodeId,
        tables: nocodeBody.formData.tables || [],
        aggregateTables: nocodeBody.formData.aggregateTables || [],
      });
    }
    (nocodeBody?.otherDataSources || []).forEach(source => {
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

  private resolveAggregateSource(runtimeSources: AggregateRuntimeSource[], tableUID: TableUID) {
    for (const source of runtimeSources) {
      const aggregateTable = (source.aggregateTables || []).find(item => item.uid === tableUID);
      if (!aggregateTable) continue;
      return {
        source,
        aggregateTable,
      };
    }
    return null;
  }

  private getAggregateSourceConnectionUID(sourceTable?: AggregateSourceTable | null, ownerConnectionUID?: string) {
    return sourceTable?.connectionUID || ownerConnectionUID || "";
  }

  private collectAggregateFilterRuleFieldUIDs(
    filterRule: FilterRule | null | undefined,
    relationFieldUID: FieldUID | undefined,
    hasSubTable: boolean,
    mainFieldUIDs: Set<string>,
    subFieldUIDs: Set<string>,
  ) {
    (filterRule?.conditions || []).forEach(condition => {
      const uid = String(condition?.uid || "");
      if (!uid) return;
      const [first, second] = uid.split(".");
      if (!second) {
        mainFieldUIDs.add(first);
        return;
      }
      if (hasSubTable && relationFieldUID && first === relationFieldUID) {
        if (second !== "_count") {
          subFieldUIDs.add(second);
        }
        return;
      }
      mainFieldUIDs.add(first);
    });
  }

  private addAggregateReferenceFieldUIDs(
    reference: { fieldUID?: FieldUID | "_count" | null; subFieldUID?: FieldUID | "_count" | null; },
    hasSubTable: boolean,
    mainFieldUIDs: Set<string>,
    subFieldUIDs: Set<string>,
  ) {
    if (reference.fieldUID && reference.fieldUID !== "_count") {
      mainFieldUIDs.add(reference.fieldUID);
    }
    if (reference.subFieldUID && reference.subFieldUID !== "_count") {
      if (hasSubTable) {
        subFieldUIDs.add(reference.subFieldUID);
      } else {
        mainFieldUIDs.add(reference.subFieldUID);
      }
    }
  }

  private collectAggregateRequiredFieldUIDs(
    source: AggregateRuntimeSource,
    aggregateTable: AggregateTable,
  ) {
    const mainFieldUIDsMap = new Map<string, Set<string>>();
    const subFieldUIDsMap = new Map<string, Set<string>>();
    const sourceTableInfoMap = new Map<string, {
      mainTable?: Table;
      subTable?: Table;
      relationFieldUID?: FieldUID;
      subRelationFieldUID?: FieldUID;
    }>();
    const ensureFieldUIDSet = (target: Map<string, Set<string>>, tableUID?: TableUID | null) => {
      if (!tableUID) return null;
      const current = target.get(tableUID) || new Set<string>();
      target.set(tableUID, current);
      return current;
    };
    const toRecord = (target: Map<string, Set<string>>) => {
      return Array.from(target.entries()).reduce<Record<string, string[]>>((result, [tableUID, fieldUIDs]) => {
        if (fieldUIDs.size) {
          result[tableUID] = Array.from(fieldUIDs);
        }
        return result;
      }, {});
    };

    (aggregateTable.sourceTables || []).forEach(sourceTable => {
      const mainTable = (source.tables || []).find(item => item.uid === sourceTable.tableUID);
      const subTable = (source.tables || []).find(item => item.uid === sourceTable.subTableUID);
      const relationFieldUID = mainTable?.fields.find(field => field.meta?.extra?.subTableUID?.[1] === sourceTable.subTableUID)?.uid;
      const subRelationFieldUID = subTable?.fields.find(field => field.meta?.name === SystemField.KEY)?.uid;
      sourceTableInfoMap.set(sourceTable.uid, {
        mainTable,
        subTable,
        relationFieldUID,
        subRelationFieldUID,
      });

      const mainFieldUIDs = ensureFieldUIDSet(mainFieldUIDsMap, mainTable?.uid);
      const subFieldUIDs = ensureFieldUIDSet(subFieldUIDsMap, subTable?.uid) || new Set<string>();
      const mainUUIDField = mainTable ? getUUIDSystemField(mainTable.fields || []) : null;
      if (mainUUIDField?.uid) {
        mainFieldUIDs?.add(mainUUIDField.uid);
      }
      if (relationFieldUID) {
        mainFieldUIDs?.add(relationFieldUID);
      }
      if (subRelationFieldUID) {
        subFieldUIDs?.add(subRelationFieldUID);
      }
      if (mainFieldUIDs) {
        this.collectAggregateFilterRuleFieldUIDs(
          sourceTable.filterRule,
          relationFieldUID,
          !!subTable,
          mainFieldUIDs,
          subFieldUIDs,
        );
      }
    });

    (aggregateTable.dimensions || []).forEach(dimension => {
      (dimension.items || []).forEach(item => {
        const sourceTableInfo = sourceTableInfoMap.get(item.sourceUID);
        if (!sourceTableInfo?.mainTable) return;
        const mainFieldUIDs = ensureFieldUIDSet(mainFieldUIDsMap, sourceTableInfo.mainTable.uid);
        const subFieldUIDs = ensureFieldUIDSet(subFieldUIDsMap, sourceTableInfo.subTable?.uid) || new Set<string>();
        if (!mainFieldUIDs) return;
        this.addAggregateReferenceFieldUIDs(item, !!sourceTableInfo.subTable, mainFieldUIDs, subFieldUIDs);
      });
    });

    (aggregateTable.metrics || []).forEach(metric => {
      const runtimeVariables = metric.mode === "singleField"
        ? (metric.singleFieldConfig ? [metric.singleFieldConfig] : [])
        : (metric.variables || []);
      runtimeVariables.forEach(variable => {
        const sourceTableInfo = sourceTableInfoMap.get(variable.sourceUID);
        if (!sourceTableInfo?.mainTable) return;
        const mainFieldUIDs = ensureFieldUIDSet(mainFieldUIDsMap, sourceTableInfo.mainTable.uid);
        const subFieldUIDs = ensureFieldUIDSet(subFieldUIDsMap, sourceTableInfo.subTable?.uid) || new Set<string>();
        if (!mainFieldUIDs) return;
        this.addAggregateReferenceFieldUIDs(variable, !!sourceTableInfo.subTable, mainFieldUIDs, subFieldUIDs);
        this.collectAggregateFilterRuleFieldUIDs(
          variable.filterRule,
          sourceTableInfo.relationFieldUID,
          !!sourceTableInfo.subTable,
          mainFieldUIDs,
          subFieldUIDs,
        );
      });
    });

    return {
      mainFieldUIDsMap: toRecord(mainFieldUIDsMap),
      subFieldUIDsMap: toRecord(subFieldUIDsMap),
    };
  }

  private async readAggregateSourceBuckets(
    source: AggregateRuntimeSource,
    aggregateTable: AggregateTable,
    runtimeSources: AggregateRuntimeSource[],
    nocodeId: string,
    options?: QueryOptions,
    extra?: { formatData?: boolean; },
  ) {
    const connectionData: ConnectionData = {};
    const runtimeSourceMap = new Map<string, AggregateRuntimeSource>(runtimeSources.map(item => [item.uid, item]));
    const sourceTablesByConnection = (aggregateTable.sourceTables || []).reduce<Map<string, AggregateSourceTable[]>>((result, sourceTable) => {
      const connectionUID = this.getAggregateSourceConnectionUID(sourceTable, source.uid);
      if (!connectionUID) return result;
      const current = result.get(connectionUID) || [];
      current.push(sourceTable);
      result.set(connectionUID, current);
      return result;
    }, new Map<string, AggregateSourceTable[]>());

    for (const [connectionUID, sourceTables] of sourceTablesByConnection.entries()) {
      const runtimeSource = runtimeSourceMap.get(connectionUID);
      if (!runtimeSource) continue;

      const fallbackNocodeId = runtimeSource.nocodeId || nocodeId;
      const scopedAggregateTable: AggregateTable = {
        ...aggregateTable,
        sourceTables,
      };
      const validTableUIDSet = new Set((runtimeSource.tables || []).map(table => table.uid));
      const rawSourceTableUIDs = sourceTables.map(item => item.tableUID).filter(Boolean) as TableUID[];
      const validSourceTableUIDs = Array.from(new Set(rawSourceTableUIDs)).filter(uid => validTableUIDSet.has(uid));
      const { mainFieldUIDsMap, subFieldUIDsMap } = this.collectAggregateRequiredFieldUIDs(runtimeSource, scopedAggregateTable);
      const sourceBuckets = validSourceTableUIDs.length ? await this.getData(fallbackNocodeId, validSourceTableUIDs, {
        stage: options?.stage,
        enabledStage: options?.enabledStage,
        formatData: extra?.formatData,
        scope: options?.scope,
      }, {
        fieldUIDsMap: mainFieldUIDsMap,
      }) : [];

      const sourceBucketMap = new Map<string, Bucket>(sourceBuckets.map(bucket => [bucket.tableId, bucket]));
      const subTableBucketCache = new Map<string, Row[]>();
      for (const sourceTable of sourceTables) {
        if (!sourceTable.subTableUID) continue;
        const mainTable = (runtimeSource.tables || []).find(item => item.uid === sourceTable.tableUID);
        const subTable = (runtimeSource.tables || []).find(item => item.uid === sourceTable.subTableUID);
        const mainBucket = sourceBucketMap.get(sourceTable.tableUID || "");
        if (!mainTable || !subTable || !mainBucket) continue;

        const relationFieldUID = mainTable.fields.find(field => field.meta?.extra?.subTableUID?.[1] === sourceTable.subTableUID)?.uid;
        const mainUUIDField = getUUIDSystemField(mainTable.fields || []);
        const subRelationField = subTable.fields.find(field => field.meta?.name === SystemField.KEY);
        if (!relationFieldUID || !mainUUIDField?.uid || !subRelationField?.uid) continue;

        const targetRows = mainBucket.rows || [];
        const mainUUIDs = Array.from(new Set(targetRows.map(row => row?.[mainUUIDField.uid]).filter(value => value !== undefined && value !== null && value !== "")));
        if (!mainUUIDs.length) {
          targetRows.forEach(row => {
            row[relationFieldUID] = [];
          });
          continue;
        }

        const subCacheKey = `${subTable.uid}:${relationFieldUID}`;
        let subRows = subTableBucketCache.get(subCacheKey);
        if (!subRows) {
          const [subBucket] = await this.getData(fallbackNocodeId, [subTable.uid], {
            stage: options?.stage,
            enabledStage: options?.enabledStage,
            filters: {
              [subTable.uid]: [{
                [subRelationField.uid]: {
                  $in: mainUUIDs,
                },
              }],
            },
            formatData: extra?.formatData,
            scope: options?.scope,
          }, {
            fieldUIDsMap: {
              [subTable.uid]: subFieldUIDsMap[subTable.uid] || [],
            },
          });
          subRows = subBucket?.rows || [];
          subTableBucketCache.set(subCacheKey, subRows);
        }

        const subRowMap = subRows.reduce<Map<string, Row[]>>((result, row) => {
          const key = row?.[subRelationField.uid];
          if (key === undefined || key === null || key === "") return result;
          const current = result.get(key) || [];
          current.push(row);
          result.set(key, current);
          return result;
        }, new Map<string, Row[]>());

        targetRows.forEach(row => {
          const rowKey = row?.[mainUUIDField.uid];
          row[relationFieldUID] = rowKey === undefined || rowKey === null || rowKey === ""
            ? []
            : (subRowMap.get(rowKey) || []);
        });
      }

      connectionData[connectionUID] = sourceBuckets;
    }

    return connectionData;
  }

  private async buildAggregateBucketBySource(
    source: AggregateRuntimeSource,
    aggregateTable: AggregateTable,
    runtimeSources: AggregateRuntimeSource[],
    nocodeId: string,
    options?: QueryOptions,
    extra?: {
      formatData?: boolean;
      overrideAggregateTables?: AggregateTable[];
      submitTargetConnectionUID?: string;
      submitTargetTableUID?: TableUID;
      submitRow?: Row;
      originRow?: Row | null;
    },
  ): Promise<Bucket | undefined> {
    const connectionData = await this.readAggregateSourceBuckets(source, aggregateTable, runtimeSources, nocodeId, options, {
      formatData: extra?.formatData,
    });
    if (extra?.submitRow && extra.submitTargetConnectionUID) {
      const submitSource = runtimeSources.find(item => item.uid === extra.submitTargetConnectionUID);
      if (submitSource) {
        connectionData[submitSource.uid] = this.buildAggregateSubmitBuckets(
          connectionData[submitSource.uid] || [],
          submitSource,
          extra.submitTargetTableUID,
          extra.submitRow,
          extra.originRow,
        );
      }
    }
    const nextSources = runtimeSources.map(item => {
      if (item.uid !== source.uid) return item;
      return {
        ...item,
        aggregateTables: extra?.overrideAggregateTables || item.aggregateTables,
      };
    });
    return buildAggregateBucketByOptions([source.uid as any, aggregateTable.uid as any], options || {}, {
      sources: nextSources,
      connectionData,
    });
  }

  private async buildAggregateBucketByTableUID(
    tableUID: TableUID,
    options: QueryOptions | undefined,
    runtimeSources: AggregateRuntimeSource[],
    fallbackNocodeId: string,
  ): Promise<Bucket | undefined> {
    const resolved = this.resolveAggregateSource(runtimeSources, tableUID);
    if (!resolved) return undefined;
    const { source, aggregateTable } = resolved;
    return await this.buildAggregateBucketBySource(
      source,
      aggregateTable,
      runtimeSources,
      fallbackNocodeId,
      options,
    );
  }

  async previewAggregateTable(
    nocodeId: string,
    aggregateTable: AggregateTable,
    options?: QueryOptions,
  ): Promise<Bucket | undefined> {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const runtimeSources = this.getAggregateRuntimeSources(nocodeBody, nocodeId);
    const currentSourceUID = nocodeBody.formData?.uid;
    const source = currentSourceUID
      ? runtimeSources.find(item => item.uid === currentSourceUID)
      : undefined;
    if (!currentSourceUID || !source) return undefined;
    return await this.buildAggregateBucketBySource(
      source,
      aggregateTable,
      runtimeSources,
      nocodeId,
      options,
      {
        formatData: true,
        overrideAggregateTables: [aggregateTable],
      },
    );
  }

  private expandFindReadFieldDependencies(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    nocodeId: string,
    table: Table,
    fieldUIDs: FieldUID[],
  ) {
    const result = new Set(fieldUIDs);
    const titleField = table.fields.find(field => field.meta?.name === SystemField.DATA_TITLE);
    if (!titleField || !result.has(titleField.uid)) {
      return Array.from(result);
    }

    const { optionTable } = this.resolveTableSourceContext(nocodeBody, nocodeId, table.uid);
    const businessFields = table.fields.filter(field => !isSystemField(field));
    const template = optionTable?.extra?.dataTitle?.value;
    if (template) {
      for (const match of template.matchAll(/\{\s*:(.*?)\s*\}/g)) {
        const dependency = businessFields.find(field => (
          field.uid === match[1]
          || field.meta?.uid === match[1]
          || field.meta?.name === match[1]
        ));
        if (dependency) result.add(dependency.uid);
      }
    } else {
      const firstField = businessFields.find(field => [
        "widget.form.textInput",
        "widget.form.radioGroup",
        "widget.form.treeSelect",
        "widget.form.serialNumber",
      ].includes(field.meta?.extra?.widgetType)) || businessFields[0];
      if (firstField) result.add(firstField.uid);
    }
    return Array.from(result);
  }

  async find(
    request: FormDataFindRequest,
    options?: {
      skipReadPermission?: boolean;
      enforceFieldReadAuth?: boolean;
      useEditorSources?: boolean;
      isAborted?: () => boolean;
    },
  ) {
    const startedAt = Date.now();
    const memoryBefore = process.memoryUsage();
    const requestId = unique();
    const metrics = createFormDataFindMetrics();
    const nocodeBody = options?.useEditorSources
      ? await this.projectService.getEditorNocodeBodyWithOtherDataSources(request.nocodeId)
      : await this.projectService.getNocodeBodyWithOtherDataSources(request.nocodeId);
    const { table: rootTable } = this.resolveTableSourceContext(nocodeBody, request.nocodeId, request.tableUID);
    if (!rootTable) {
      throw new NotFoundException({ code: "FIND_TABLE_NOT_FOUND", message: `Form data table not found: ${request.tableUID}` });
    }
    const tables = [
      ...(nocodeBody.formData?.tables || []),
      ...(nocodeBody.otherDataSources || []).flatMap(source => source?.tables || []),
    ] as Table[];
    const tableMap = new Map(tables.map(table => [table.uid, table] as const));
    const readableFieldUIDs = new Map<TableUID, Set<FieldUID> | null>();
    if (options?.enforceFieldReadAuth !== false) {
      const relevantTableUIDs = new Set<TableUID>([rootTable.uid]);
      const appendSubFormTable = (parentFieldUID: FieldUID) => {
        const subTableUID = rootTable.fields.find(field => field.uid === parentFieldUID)?.meta?.extra?.subTableUID?.[1];
        if (subTableUID) relevantTableUIDs.add(subTableUID);
      };
      Object.keys(request.select?.subForms || {}).forEach(fieldUID => appendSubFormTable(fieldUID as FieldUID));
      const collectFilterTables = (filter = request.filter) => {
        if (!filter) return;
        if (filter.kind === "condition") {
          if (filter.path.length === 2) appendSubFormTable(filter.path[0]);
        } else if (filter.kind === "group") {
          filter.conditions.forEach(collectFilterTables);
        } else {
          collectFilterTables(filter.condition);
        }
      };
      collectFilterTables();
      const resolveContext: FieldPermissionResolveContext = {
        memberRangeUsersCache: new Map<string, string[]>(),
      };
      await Promise.all(Array.from(relevantTableUIDs).map(async (tableUID) => {
        const table = tableMap.get(tableUID);
        if (!table) return;
        const readable = await this.getReadableFieldUIDSet(nocodeBody, table, resolveContext);
        readableFieldUIDs.set(tableUID, readable ? new Set(Array.from(readable) as FieldUID[]) : null);
      }));
    }

    let response: FormDataFindResponse | undefined;
    let error: unknown;
    try {
      response = await executeFormDataFind(request, {
        rootTable,
        tables: tableMap,
        readableFieldUIDs: options?.enforceFieldReadAuth === false ? undefined : readableFieldUIDs,
        read: async (tableUIDs, queryOptions, fieldUIDsMap) => {
          return await this.getData(request.nocodeId, tableUIDs, {
            ...queryOptions,
            useEditorSources: options?.useEditorSources,
          }, {
            fieldUIDsMap,
            skipReadPermission: options?.skipReadPermission,
            enforceFieldReadAuth: options?.enforceFieldReadAuth !== false,
          });
        },
        distinct: async (tableUID, fieldUID, condition, queryOptions) => {
          const { sourceFormData, sourceNocodeId } = this.resolveTableSourceContext(nocodeBody, request.nocodeId, tableUID);
          if (!sourceFormData) return [];
          return await this._distinct(sourceFormData, sourceNocodeId, tableUID, fieldUID, {
            ...queryOptions,
            filters: { [tableUID]: [condition] },
          }, {
            skipReadPermission: options?.skipReadPermission,
          }).then(items => items.map(item => item?.value));
        },
        expandReadFieldDependencies: (table, fieldUIDs) => (
          this.expandFindReadFieldDependencies(nocodeBody, request.nocodeId, table, fieldUIDs)
        ),
        isAborted: options?.isAborted,
        metrics,
      });
      return response;
    } catch (findError) {
      error = findError;
      throw findError;
    } finally {
      const memoryAfter = process.memoryUsage();
      const requestedPagination = request.pagination;
      const requestedLimit = requestedPagination && "pageSize" in requestedPagination
        ? requestedPagination.pageSize
        : (requestedPagination && "limit" in requestedPagination ? requestedPagination.limit : undefined);
      const errorResponse = error instanceof HttpException ? error.getResponse() : undefined;
      const errorCode = errorResponse && typeof errorResponse === "object" && "code" in errorResponse
        ? errorResponse.code
        : undefined;
      this.logger.log(`[form-data-find] ${JSON.stringify({
        requestId,
        tableUID: request.tableUID,
        durationMs: Date.now() - startedAt,
        pageSize: response?.pagination?.limit || requestedLimit,
        rowCount: response?.data?.length || 0,
        selectedFieldCount: request.select?.fields?.length || 0,
        selectedSubFormCount: Object.keys(request.select?.subForms || {}).length,
        ...metrics,
        heapDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
        rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
        warningCodes: response?.warnings?.map(item => item.code) || [],
        errorCode,
      })}`);
    }
  }

  async getData(
    nocodeId: string,
    tableUIDs: string[],
    options?: QueryOptions,
    internalOptions?: InternalReadDataOptions,
  ) {
    const nocodeBody = options?.useEditorSources
      ? await this.projectService.getEditorNocodeBodyWithOtherDataSources(nocodeId)
      : await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const runtimeSources = this.getAggregateRuntimeSources(nocodeBody, nocodeId);
    const aggregateTableUIDSet = new Set(
      runtimeSources.flatMap(source => (source.aggregateTables || []).map(table => table.uid)),
    );
    const normalTableUIDs = tableUIDs.filter(tableUID => !aggregateTableUIDSet.has(tableUID));
    const aggregateTableUIDs = tableUIDs.filter(tableUID => aggregateTableUIDSet.has(tableUID));
    const stage = options?.stage ?? this.getDefaultReadableStageCondition();
    const sourceReadGroups = new Map<string, {
      formData: NocodeFormData;
      nocodeId: string;
      tableUIDs: string[];
      filters: QueryOptions["filters"];
      enabledStage: QueryOptions["enabledStage"];
      fieldUIDsMap?: Record<string, string[]>;
    }>();
    for (const tableUID of normalTableUIDs) {
      const { sourceFormData, sourceNocodeId } = this.resolveTableSourceContext(nocodeBody, nocodeId, tableUID as TableUID);
      if (!sourceFormData) {
        continue;
      }
      const key = `${sourceNocodeId}::${sourceFormData.uid || ""}`;
      if (!sourceReadGroups.has(key)) {
        sourceReadGroups.set(key, {
          formData: sourceFormData,
          nocodeId: sourceNocodeId,
          tableUIDs: [],
          filters: {},
          enabledStage: options?.enabledStage,
          fieldUIDsMap: internalOptions?.fieldUIDsMap ? {} : undefined,
        });
      }
      const group = sourceReadGroups.get(key)!;
      group.tableUIDs.push(tableUID);
      if (options?.filters?.[tableUID] !== undefined) {
        group.filters[tableUID] = options.filters[tableUID];
      }
      if (internalOptions?.fieldUIDsMap?.[tableUID] && group.fieldUIDsMap) {
        group.fieldUIDsMap[tableUID] = internalOptions.fieldUIDsMap[tableUID];
      }
    }
    const sourceGroups = Array.from(sourceReadGroups.values());
    await Promise.all(sourceGroups.map(async (group) => {
      if (group.enabledStage === false) {
        return;
      }
      if (await this.shouldDisableStageFilterForMainRead(group.nocodeId, group.formData, group.tableUIDs as TableUID[], {
        ...(options || {}),
        stage,
      })) {
        group.enabledStage = false;
      }
    }));
    const account = await this.getAccount();
    if (!isSystemAdminAccount(account) && !internalOptions?.skipReadPermission) {
      await Promise.all(sourceGroups.map(async (group) => {
        await Promise.all(group.tableUIDs.map(async (tableUID) => {
          const res = await this.getPermissionOwnerGroup(group.nocodeId, tableUID);
          const andValue = [];
          if (group.filters?.[tableUID]) {
            if (Array.isArray(group.filters?.[tableUID])) {
              andValue.push(...group.filters?.[tableUID] as any);
            } else {
              andValue.push(group.filters?.[tableUID] as any);
            }
          }
          if (res === "all") {
            group.filters[tableUID] = andValue;
            return;
          }
          const table = group.formData.tables.find(t => t.uid === tableUID);
          if (!table) {
            return;
          }
          const uuidField = getUUIDSystemField(table.fields);
        // const createOwnerField = getCreateOwnerSystemField(table.fields);
        // const dataStageField = table.fields.find(f => f.meta.name === SystemField.DATA_STAGE);
        // const orQuery = [];
        // for (const item of res) {
        //   if (!isEmpty(item.users)) {
        //     const query: WhereCondition = {
        //       [dataStageField.uid]: {
        //         $in: item.stages,
        //       }
        //     };
        //     if (item.users !== "all") {
        //       query[createOwnerField.uid] = {
        //         $in: item.users as string[],
        //       }
        //     }
        //     orQuery.push(query);
        //   }
        //   // if (!isEmpty(item.noStage)) {
        //   //   orQuery.push({
        //   //     [dataStageField.uid]: {
        //   //       $nin: item.noStage,
        //   //     }
        //   //   })
        //   // }
        //   if (!isEmpty(item.ownerField)) {
            
        //     for (const fieldId of item.ownerField) {
        //       const field = table.fields.find(f => f.uid === fieldId);
        //       if (field?.meta?.subType === "account") {
        //         orQuery.push({
        //           [field.uid]: account.id
        //         })
        //       } else if (field?.meta?.subType === "department") {
        //         const departments = await this.workbenchService.getAncestorDepartments(account.departments);
        //         const departmentIds = departments.map(d => d.id);
        //         orQuery.push({
        //           [field.uid]: {
        //             $in: [...account.departments, ...departmentIds],
        //           }
        //         })
        //       }
        //     }
        //   }
        // }
        
          const primaryTableUID = table?.meta?.extra?.primaryTable?.[1];
          if (!primaryTableUID) {
            const orQuery = await this.ownerGroupToQuery(res, table, stage);
            if (isEmpty(orQuery)) {
              andValue.push({
                [uuidField ? getDbColumnKey(uuidField) : "_id"]: 1234567890
              })
            } else {
              if (orQuery.length > 1) {
                andValue.push({
                  $or: orQuery
                })
              } else {
                andValue.push(orQuery[0]);
              }
            }
          }

          if (andValue.length > 1) {
            group.filters[tableUID] = [{
              $and: andValue
            }]
          } else {
            group.filters[tableUID] = andValue;
          }
          group.enabledStage = false;
        }));
      }));
    }
    const tableOrder = new Map(normalTableUIDs.map((tableUID, index) => [tableUID, index]));
    const normalBuckets = normalTableUIDs.length
      ? (await Promise.all(sourceGroups.map(async (group) => {
        const groupInternalOptions = group.fieldUIDsMap
          ? {
            ...(internalOptions || {}),
            fieldUIDsMap: group.fieldUIDsMap,
          }
          : internalOptions;
        return await this._getData(group.formData, group.tableUIDs, group.nocodeId, {
          ...(options || {}),
          stage,
          filters: group.filters,
          enabledStage: group.enabledStage,
        }, groupInternalOptions);
      }))).flat().sort((a, b) => {
        return (tableOrder.get(a.tableId) ?? 0) - (tableOrder.get(b.tableId) ?? 0);
      })
      : [];
    if (options.fillSubTable) {
      for (const bucket of normalBuckets) {
        let rows = bucket.rows;
        const { table, sourceFormData, sourceNocodeId } = this.resolveTableSourceContext(nocodeBody, nocodeId, bucket.tableId as TableUID, true);
        if (!table || !sourceFormData) continue;
        bucket.rows = await this.fillSubFormField(
          rows,
          sourceNocodeId,
          table,
          sourceFormData,
          options.subTableFilters || {},
          options.transformFormData,
          options.formatData,
          options?.scope || "main",
          false,
          internalOptions,
        );
      }
    }
    if(options.transformRelated) {
      for (const bucket of normalBuckets) {
        let rows = bucket.rows;
        const { table } = this.resolveTableSourceContext(nocodeBody, nocodeId, bucket.tableId as TableUID);
        if (!table) continue;
        bucket.rows = await this.transformRelatedField(rows, nocodeId, table, nocodeBody, stage, {
          transformFormData: options?.transformFormData,
          transformRelatedResultObject: options?.transformRelatedResultObject,
          internalOptions,
        });
      }
    }
    if (internalOptions?.enforceFieldReadAuth) {
      const readableFieldUIDSetMap = new Map<string, Set<string> | null>();
      await Promise.all(normalBuckets.map(async (bucket) => {
        const { table } = this.resolveTableSourceContext(nocodeBody, nocodeId, bucket.tableId as TableUID);
        const readableFieldUIDSet = await this.getReadableFieldUIDSet(nocodeBody, table);
        readableFieldUIDSetMap.set(String(bucket.tableId || ""), readableFieldUIDSet);
      }));

      for (const bucket of normalBuckets) {
        const readableFieldUIDSet = readableFieldUIDSetMap.get(String(bucket.tableId || "")) ?? null;
        bucket.fields = this.filterBucketFieldsByReadableFieldSet(bucket.fields, readableFieldUIDSet);
        bucket.rows = this.filterBucketRowsByReadableFieldSet(bucket.rows, bucket.fields, readableFieldUIDSet);
      }
    }
    const aggregateBuckets = await Promise.all(aggregateTableUIDs.map((tableUID) => {
      return this.buildAggregateBucketByTableUID(
        tableUID as TableUID,
        options,
        runtimeSources,
        nocodeId,
      );
    }));
    const mergedBucketMap = new Map<string, Bucket>();
    normalBuckets.forEach(bucket => mergedBucketMap.set(bucket.tableId, bucket));
    aggregateBuckets.filter(Boolean).forEach(bucket => mergedBucketMap.set(bucket.tableId, bucket));
    return tableUIDs.map(tableUID => mergedBucketMap.get(tableUID)).filter(Boolean);
  }

  // async getDataBySearch(nocodeId: string, tableUIDs: TableUID[], options?: QueryOptions): Promise<Bucket[]> {
  //   const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
  //   const formData = nocodeBody.formData as NocodeFormData;
  //   const buckets: Bucket[] = [];

  //   for (const tableUID of tableUIDs) {
  //     const table: Table = formData.tables.find(item => item.uid === tableUID);
  //     let dIndex = this.getDocumentIndex(`${nocodeId}-${table?.uid}`);
  //     if (!dIndex) await this.createFlexsearchIndex(table, nocodeId);

  //     const searchResult = await this.documentSearch(`${nocodeId}-${table?.uid}`, {
  //       query: options.searchValue ?? '',
  //       limit: 9999999, // 需要检索出所有符合要求的数据，给 limit 赋一个足够大的整数
  //       merge: true,
  //       enrich: true,
  //     });

  //     const rows: Row[] = [];
  //     searchResult.forEach((item, index) => {
  //       // 判断这行数据是否符合 filter 的筛选条件
  //       if (evaluateCondition(item.doc, options.filters?.[tableUID]?.[0] ?? {})) {
  //         rows.push(item.doc);
  //       }
  //     });

  //     // 排序
  //     rows.sort((a, b) => {
  //       for (const key in options.orderBy as Record<string, SortType>) {
  //         const sortType: SortType = options.orderBy[key];
  //         if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * sortType;
  //       }
  //     });

  //     let offset = Number((options.pageNumber - 1) * options.pageSize);
  //     let limit = Number(options.pageSize);

  //     buckets.push({
  //       tableId: table?.uid,
  //       tableName: table.alias,
  //       fields: table.fields,
  //       rows: rows.slice(offset, offset + limit),
  //       count: rows.length,
  //     });
  //   }

  //   if (options.fillSubTable) {
  //     for (const bucket of buckets) {
  //       let rows = bucket.rows;
  //       const table = formData.tables.find(t => t.uid === bucket.tableId);
  //       bucket.rows = await this.fillSubFormField(rows, nocodeId, table, formData, {}, options.transformFormData);
  //     }
  //   }
  //   return buckets;
  // }

  private async getPermissionRangeOwners(dataRange: DataPermissionDataRange, account?: Account) {
    const users: string[] = [], departments: string[] = [];
    account = account || await this.getAccount();
    if (dataRange.all) {
      return "all";
    }
    if (dataRange.self) {
      users.push(account.id);
    }
    if (dataRange.currentDepartment) {
      departments.push(...account.departments);
    }
    if (dataRange.customDepartment?.enabled) {
      departments.push(...(dataRange.customDepartment?.departments || []));
    }
    if (dataRange.siblingDepartment) {
      const siblingDepartments = await this.workbenchService.getSiblingDepartments(account.departments);
      departments.push(...siblingDepartments.map(d => d.id));
    }
    if (dataRange.subDepartment) {
      const subDepartments = await this.workbenchService.getSubDepartments(account.departments);
      departments.push(...subDepartments.map(d => d.id));
    }
    if (dataRange.anonymous) {
      const anonymousAccount = await this.workbenchService.getAnonymousUser();
      users.push(anonymousAccount.id);
    }
    const AllUsers = await this.workbenchService.getUsers({
      users: Array.from(new Set(users)),
      roles: [],
      departments: Array.from(new Set(departments)),
    });

    return AllUsers.map(u => u.id);
  }

  private isSubmittedStage(stage: FormDataStage) {
    return [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING].includes(stage);
  }

  private isStageMatchedByCondition(stage: FormDataStage, condition?: FormDataStageWhereCondition) {
    if (!condition) {
      return true;
    }
    if (typeof condition === "string") {
      return condition === FormDataStage.NORMAL
        ? this.isSubmittedStage(stage)
        : stage === condition;
    }
    if ("$eq" in condition && condition.$eq !== undefined && stage !== condition.$eq) {
      return false;
    }
    if ("$ne" in condition && condition.$ne !== undefined && stage === condition.$ne) {
      return false;
    }
    if ("$in" in condition && Array.isArray(condition.$in) && !condition.$in.includes(stage)) {
      return false;
    }
    if ("$nin" in condition && Array.isArray(condition.$nin) && condition.$nin.includes(stage)) {
      return false;
    }
    if ("$exists" in condition && condition.$exists === false) {
      return false;
    }
    return true;
  }

  private getPermissionStageWhereCondition(
    stageFieldKey: string | undefined,
    stages: FormDataStage[] = [],
    requestedStage?: FormDataStageWhereCondition,
  ) {
    if (!stageFieldKey || requestedStage === undefined) {
      return null;
    }
    const matchedStages = Array.from(new Set((stages || []).filter(stage => this.isStageMatchedByCondition(stage, requestedStage))));
    if (!matchedStages.length) {
      return null;
    }
    return {
      [stageFieldKey]: {
        $in: matchedStages,
      },
    } as WhereCondition;
  }

  private async ownerGroupToQuery(
    ownerGroup: Exclude<Awaited<ReturnType<typeof this.getPermissionOwnerGroup>>, "all">,
    table: Table,
    requestedStage?: FormDataStageWhereCondition,
    options: {
      ignoreStageCondition?: boolean,
      fallbackToPermissionStages?: boolean,
    } = {},
    account?: Account,
  ) {
    account = account || await this.getAccount();
    const createOwnerField = getCreateOwnerSystemField(table.fields);
    const dataOwnerField = isDataOwnerEnabledTable(table) ? getDataOwnerSystemField(table.fields) : null;
    const dataStageField = table.fields.find(f => f.meta.name === SystemField.DATA_STAGE);
    const ownerFieldKeys = [createOwnerField, dataOwnerField]
      .filter((field): field is Field => Boolean(field))
      .map(field => getDbColumnKey(field));
    const dataStageFieldKey = dataStageField ? getDbColumnKey(dataStageField) : SystemField.DATA_STAGE;
    const orQuery: WhereCondition[] = [];
    let permissionDepartmentIds: string[] | null = null;
    for (const item of ownerGroup) {
      const stageQuery = options.ignoreStageCondition
        ? null
        : this.getPermissionStageWhereCondition(dataStageFieldKey, item.stages, requestedStage);
      const dataStatusQuery = options.ignoreStageCondition
        ? null
        : this.buildPermissionDataStatusWhereCondition(table, item.dataStatus);
      const appendPermissionConditions = (andQuery: WhereCondition[]) => {
        if (stageQuery) {
          andQuery.push(stageQuery);
        } else if (!options.ignoreStageCondition && requestedStage !== undefined) {
          return false;
        } else if (!options.ignoreStageCondition && options.fallbackToPermissionStages && !isEmpty(item.stages)) {
          andQuery.push({
            [dataStageFieldKey]: {
              $in: item.stages,
            }
          });
        }
        if (dataStatusQuery) {
          andQuery.push(dataStatusQuery);
        }
        return true;
      };
      if (!isEmpty(item.users)) {
        const andQuery: WhereCondition[] = [];
        if (!appendPermissionConditions(andQuery)) {
          continue;
        }

        if (item.users !== "all" && ownerFieldKeys.length) {
          const ownerQuery = ownerFieldKeys.length === 1
            ? {
                [ownerFieldKeys[0]]: {
                  $in: item.users as string[],
                }
              }
            : {
                $or: ownerFieldKeys.map(fieldKey => ({
                  [fieldKey]: {
                    $in: item.users as string[],
                  }
                }))
              };
          andQuery.push(ownerQuery);
        }
        if (isEmpty(andQuery)) {
          if (item.users === "all") {
            orQuery.push({});
          }
          continue;
        }
        orQuery.push(andQuery.length === 1 ? andQuery[0] : { $and: andQuery });
      }
      if (!isEmpty(item.ownerField)) {
        for (const fieldId of item.ownerField) {
          const field = table.fields.find(f => f.uid === fieldId || f.meta?.uid === fieldId);
          const fieldKey = field ? getDbColumnKey(field) : '';
          if (!fieldKey) continue;
          if (field?.meta?.subType === "account") {
            const andQuery: WhereCondition[] = [{
              [fieldKey]: account.id
            }];
            if (!appendPermissionConditions(andQuery)) {
              continue;
            }
            orQuery.push(andQuery.length === 1 ? andQuery[0] : { $and: andQuery })
          } else if (field?.meta?.subType === "department") {
            if (!permissionDepartmentIds) {
              const departments = await this.workbenchService.getAncestorDepartments(account.departments);
              const departmentIds = departments.map(d => d.id);
              permissionDepartmentIds = [...account.departments, ...departmentIds];
            }
            const andQuery: WhereCondition[] = [{
              [fieldKey]: {
                $in: permissionDepartmentIds,
              }
            }];
            if (!appendPermissionConditions(andQuery)) {
              continue;
            }
            orQuery.push(andQuery.length === 1 ? andQuery[0] : { $and: andQuery })
          }
        }
      }
    }
    return orQuery;
  }

  private async getPermissionOwnerGroup(
    nocodeId: string,
    tableUID: string,
    category: Exclude<PermissionCategory, PermissionCategory.ADD> = PermissionCategory.GET,
    account?: Account,
  ) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    account = account || await this.getAccount();
    if (isSystemAdminAccount(account)) return "all";
    const table = nocodeBody.formData.tables.find(item => item.uid === tableUID || item.meta?.uid === tableUID);
    let permissionGroup = nocodeBody.permissions?.data?.[tableUID]?.other
      || (table?.uid ? nocodeBody.permissions?.data?.[table.uid]?.other : undefined)
      || (table?.meta?.uid ? nocodeBody.permissions?.data?.[table.meta.uid]?.other : undefined);
    if (!permissionGroup) {
      const primaryTableUID = table?.meta?.extra?.primaryTable?.[1];
      if (primaryTableUID) {
        permissionGroup = nocodeBody.permissions?.data?.[primaryTableUID]?.other;
      }
    }
    if (!permissionGroup) permissionGroup = getDefaultDataPermissionOther();
    permissionGroup = expandLegacyNoProcessDataPermissionGroups(permissionGroup);
    if (isEmpty(permissionGroup)) return [];
    const promises = permissionGroup.map(async (permission) => {
      if (!permission.handleRange[category]) return null;
      if (permission.memberRange.rangeType === PermissionRangeType.CUSTOM) {
        const users = await this.workbenchService.getUsers(permission.memberRange.range);
        if (!users.some(user => user.id === account.id)) return null;
      }
      const users = await this.getPermissionRangeOwners(permission.dataRange, account);
      let stages: FormDataStage[] = [];
      const dataStatus = normalizeDataPermissionStatus(permission.dataStatus);
      if (dataStatus?.processing) {
        // 排队发生在数据已提交之后，记录仍处于 NORMAL 阶段；否则 queued 记录会被权限查询过滤掉。
        stages.push(FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.DELETING, FormDataStage.EDITING, FormDataStage.DELETED);
        // noStage = [FormDataStage.DRAFT, FormDataStage.NORMAL];
      }
      if (dataStatus?.finished || dataStatus?.noProcess) {
        stages.push(FormDataStage.NORMAL);
      }
      let ownerField = [];
      if (permission.dataRange?.fromFormField?.enabled) {
        const fieldValue = permission.dataRange?.fromFormField?.field;
        ownerField = (Array.isArray(fieldValue) ? fieldValue : [fieldValue]).filter(Boolean);
      }
      return {
        // inProcess: permission.dataRange.inProcess,
        // hasProcess: permission.dataStatus.processing,
        stages,
        dataStatus,
        ownerField,
        users,
      }
    });
    const res = await Promise.all(promises).then((data) => data.flat(Infinity)?.filter(Boolean));
    // if (res.some(item => item.users === "all")) return "all";
    return res;
  }

  private async generateSerialNumber(nocodeId: string, tableId: string, newRow: any, fieldId: string) {
    const organizeLookups = await this.getSerialNumberOrganizeLookups(nocodeId, tableId, newRow, fieldId).catch(() => undefined);
    const res = await this.lock.acquire(tableId, async () => {
      const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId)
      const runtimeState = await getNocodeRuntimeState(this.nocodesDir, nocodeId);
      const runtimeCounter = getRuntimeCounter(runtimeState, tableId, fieldId) || {};
      const table = nocodeBody.formData.tables.find(table => tableId == table.meta.uid);
      const field = table.fields.find(f => f.uid === fieldId);
      let res = countSerialNumber(nocodeBody.formData, tableId, newRow, fieldId, organizeLookups, runtimeCounter);
      if (this.shouldCheckGlobalUnique(table, field)) {
        const allSerialNumberData = (await this.distinctSubmittedRows(
          nocodeBody.formData,
          nocodeId,
          table,
          field.uid,
        )).map(item => item.value);
        while(allSerialNumberData.includes(res)) {
          res = countSerialNumber(nocodeBody.formData, tableId, newRow, fieldId, organizeLookups, runtimeCounter);
        }
      }
      setRuntimeCounter(runtimeState, tableId, fieldId, runtimeCounter);
      await saveNocodeRuntimeState(this.nocodesDir, nocodeId, runtimeState);

      return res;
    });

    return res;
  }

  async addDraftData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[]) {
    return await this.tryAddData(formData, nocodeId, tableUID, rows, {
      stage: FormDataStage.DRAFT,
      scope: "draft",
      uniqueValidation: {
        skipValidation: true,
      },
    });
  }
  async fillSubFormField(
    rows: Row[],
    nocodeId: string,
    table: Table,
    formData: NocodeFormData,
    whereConditions: Record<string, WhereCondition | WhereCondition[]> = {},
    transformFormData: boolean = false,
    formatData = false,
    scope: FormDataStoreScope = "main",
    bypassPermission = false,
    internalOptions?: InternalReadDataOptions,
    stage?: FormDataStageWhereCondition
  ){
    if (!Array.isArray(rows)) return rows
    rows = rows.filter(row => row)
    if (rows.length === 0) return rows;

    const subTables: { subTableUID: TableUID, relationFieldUID: FieldUID }[] = [];
    const fieldsMap = new Map<TableUID, FieldUID>();
    for (const field of table.fields) {
      if (field.meta.extra?.subTableUID) {
        const subTableId: TableUID = field.meta.extra?.subTableUID[1];
        const subTable = formData.tables?.find(t => t.uid === subTableId);
        if (subTable?.fields) {
          const relationField = subTable.fields.find(f => f.meta.name === SystemField.KEY);
          subTables.push({ subTableUID: subTableId, relationFieldUID: relationField?.uid });
          fieldsMap.set(subTableId, field?.uid);
        }
      }
    }
    if(subTables.length === 0) return rows;

    const UUIDField: Field = getUUIDSystemField(table.fields);
    const ids = rows.map((row) => row[UUIDField?.uid]);
    const tableUIDs: TableUID[] = [];
    const filters: Record<string, WhereCondition[]> = {};
    for (const { subTableUID, relationFieldUID } of subTables) {
      tableUIDs.push(subTableUID);
      let baseFilter: WhereCondition = { [relationFieldUID]: { '$in': ids } }
        const fieldUID: FieldUID = fieldsMap.get(subTableUID);
        const conditions = whereConditions?.[fieldUID];
        if(conditions) {
          baseFilter = {
            "$and": [baseFilter, ...(Array.isArray(conditions) ? conditions : [conditions])]
          }
        }
      filters[subTableUID] = [baseFilter];
    }
    const readOptions: QueryOptions = {
      transformFormData,
      formatData,
      filters,
      enabledStage: stage !== undefined,
      orderBy: SortType.ASC,
      scope,
      ...(stage !== undefined ? { stage } : {}),
    };
    const buckets = bypassPermission
      ? await this._getData(formData, tableUIDs, nocodeId, readOptions, internalOptions)
      : await this.getData(nocodeId, tableUIDs, readOptions, internalOptions);
    const intactRows = await this.calculate.run({
      handle: "fillSubFormData",
      data: {
        buckets, rows, fieldsMap, UUIDField
      }
    })
    return intactRows;
  }

  async transformRelatedField(
    rows: Row[],
    nocodeId: string,
    table: Table,
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    stage: FormDataStageWhereCondition = FormDataStage.NORMAL,
    options?: {
      transformFormData?: boolean,
      transformRelatedResultObject?: boolean,
      internalOptions?: InternalReadDataOptions,
    }
  ) {
    const { transformFormData = false, transformRelatedResultObject = false } = options || {};  
    const relatedFields = table.fields?.filter(field => {
      return field.meta?.extra?.widgetType === "widget.form.relatedData"
    }).map(field => {
      return {
        fieldId: field?.uid,
        relatedTableUID: field.meta?.extra?.relatedTableUID?.[1] || '',
      }
    });

    const relatedTables: Set<string> = new Set();
    const filters = {}
    if(relatedFields.length === 0) return rows;
    for(const row of rows) {
      for(const key of Object.keys(row)) {
        if(!relatedFields.some(item => item.fieldId === key)) continue;

        const relatedTableUID = relatedFields.find(item => item.fieldId === key)?.relatedTableUID;
        if(!relatedTableUID) continue;

        relatedTables.add(relatedTableUID)
        const relatedTableContext = this.resolveTableSourceContext(nocodeBody, nocodeId, relatedTableUID as TableUID);
        const uuidFiledId = relatedTableContext.uuidField?.uid;
        if (!uuidFiledId) continue;
        if(!filters[relatedTableUID]) {
          filters[relatedTableUID] = {
            "$or": []
          }
        }
        filters[relatedTableUID].$or.push({
          [uuidFiledId]: {
            '$in': [ row[key] ]
          }
        })
      }
    }

    const searchRow = await this.getData(nocodeId, [...relatedTables], {
      transformFormData,
      filters, stage,
      orderBy: SortType.ASC,
    }, options?.internalOptions);

    for(const row of rows) {
      for(const key of Object.keys(row)) {
        if(!relatedFields.some(item => item.fieldId === key)) continue;

        const relatedTableUID = relatedFields.find(item => item.fieldId === key)?.relatedTableUID;
        if(!relatedTableUID) continue;

        const relatedTableContext = this.resolveTableSourceContext(nocodeBody, nocodeId, relatedTableUID as TableUID);
        const uuidFiledId = relatedTableContext.uuidField?.uid;
        const titleFiledId = relatedTableContext.titleField?.uid;
        const _row = searchRow.find(item => item.tableId === relatedTableUID)?.rows
        if(_row) {
          row[key] = row[key].map(item => {
            if (transformRelatedResultObject) {
              return _row?.find(row => row[uuidFiledId] === item)
            }
            return _row?.find(row => row[uuidFiledId] === item)?.[titleFiledId]
          });
        }
      }
    }

    return rows;
  }

  async getDrafts(nocodeId: string, tableUID: TableUID) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(table => table.uid === tableUID);
    if (!table) return [];
    const createOwnerField = getCreateOwnerSystemField(table.fields);
    const account = await this.getAccount();
    const filters = [
      { [createOwnerField.uid]: account.id },
    ];
    const treeContext = await this.getDraftStorageTreeContext(nocodeId, formData, tableUID);
    const draftRows = await this.loadDraftRowsByScope(formData, nocodeId, tableUID, filters, "draft", treeContext.statusMap);
    if (treeContext.isSeparated) {
      return draftRows;
    }
    const legacyRows = await this.loadDraftRowsByScope(formData, nocodeId, tableUID, filters, "main", treeContext.statusMap);
    this.scheduleDraftMigrationForTableTree(nocodeId, formData, tableUID);
    return this.mergeRowsByUUID(formData, tableUID, draftRows, legacyRows);
  }

  async updateDraftData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[], stage: FormDataStage) {
    if (isEmpty(rows)) return;
    const table = formData.tables.find(table => table.uid === tableUID);
    const uuidField = table.fields.find(field => field.meta.name === SystemField.UUID);
    const isUpdate = rows[0][uuidField.uid];
    if (isUpdate) {
      const stageField = table.fields.find(field => field.meta.name === SystemField.DATA_STAGE)
      const isUpdateDraft = (rows[0][stageField.uid] === FormDataStage.DRAFT) && (stage === FormDataStage.DRAFT);
      if (isUpdateDraft) {
        return await this.withDraftStorageLocksForTableTree(nocodeId, formData, tableUID, async () => {
          const treeContext = await this.getDraftStorageTreeContext(nocodeId, formData, tableUID);
          const uuids = rows.map(row => row?.[uuidField?.uid]).filter(Boolean);
          const legacyDraftRows = treeContext.isSeparated
            ? []
            : await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "main", treeContext.statusMap);
          let draftSnapshot = await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "draft");
          if (!treeContext.isSeparated && isEmpty(draftSnapshot) && !isEmpty(legacyDraftRows)) {
            const compatRows = await this.loadCompatDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, treeContext.statusMap);
            if (!isEmpty(compatRows)) {
              await this.syncDraftRowsSnapshot(formData, nocodeId, tableUID, uuids, compatRows);
              draftSnapshot = await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "draft");
            }
          }
          const draftRes = await this.updateData(formData, nocodeId, tableUID, rows, [[formData.uid, tableUID, uuidField.uid]], stage, "draft", {
            skipValidation: true,
          });
          this.ensureHandleDataSuccess(draftRes);
          if (treeContext.isSeparated || isEmpty(legacyDraftRows)) {
            return draftRes;
          }
          try {
            const legacyRes = await this.updateData(formData, nocodeId, tableUID, rows, [[formData.uid, tableUID, uuidField.uid]], stage, "main", {
              skipValidation: true,
            });
            this.ensureHandleDataSuccess(legacyRes);
            return draftRes;
          } catch (err) {
            try {
              await this.syncDraftRowsSnapshot(formData, nocodeId, tableUID, uuids, draftSnapshot);
            } catch (rollbackErr) {
              this.logger.error("rollback draft rows failed", nocodeId, tableUID, rollbackErr);
              throw new Error(`${this.getErrorMessage(err)}; rollback draft rows failed: ${this.getErrorMessage(rollbackErr)}`);
            }
            throw err;
          }
        });
      }
      return await this.promoteDraftToNormal(formData, nocodeId, tableUID, rows, [[formData.uid, tableUID, uuidField.uid]]);
    } else {
      if (stage === FormDataStage.DRAFT) {
        return await this.addDraftData(formData, nocodeId, tableUID, rows);
      }
      return await this.addData(formData, nocodeId, tableUID, rows, { triggerTodo: false });
    }

  }

  async deleteDraftData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[], keys: OptionFieldUID[]) {
    return await this.withDraftStorageLocksForTableTree(nocodeId, formData, tableUID, async () => {
      const treeContext = await this.getDraftStorageTreeContext(nocodeId, formData, tableUID);
      if (!treeContext.isSeparated) {
        await this.deleteLegacyDraftRowsFromMainScope(formData, nocodeId, tableUID, rows, treeContext.statusMap);
      }
      const draftRes = await this.deleteData(formData, nocodeId, tableUID, rows, keys, "draft");
      this.ensureHandleDataSuccess(draftRes);
      return draftRes;
    });
  }

  private async promoteDraftToNormal(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: any[],
    keys: OptionFieldUID[],
  ) {
    return await this.withDraftStorageLocksForTableTree(nocodeId, formData, tableUID, async () => {
      const { table } = this.getTableContext(formData, tableUID);
      if (!table) {
        return;
      }
      const uuidField = getUUIDSystemField(table?.fields || []);
      if (!uuidField?.uid) {
        return;
      }
      const uuids = rows.map(row => row?.[uuidField?.uid]).filter(Boolean);
      const treeContext = await this.getDraftStorageTreeContext(nocodeId, formData, tableUID);
      const draftRows = await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "draft", treeContext.statusMap);
      const legacyRows = treeContext.isSeparated
        ? []
        : await this.loadDraftRowsByUUIDs(formData, nocodeId, tableUID, uuids, "main", treeContext.statusMap);
      const compatRows = await this.loadCompatDraftRowsByUUIDs(
        formData,
        nocodeId,
        tableUID,
        uuids,
        treeContext.statusMap,
      );
      const cleanupRows = !isEmpty(draftRows)
        ? draftRows
        : (!isEmpty(legacyRows) ? legacyRows : rows);
      const promotedSourceRows = !isEmpty(compatRows)
        ? this.mergeRowsByUUID(formData, tableUID, rows, compatRows, { keepFallbackRows: false })
        : rows;
      const promotedRows = this.sanitizeRowsForPromote(formData, tableUID, promotedSourceRows);

      if (!isEmpty(legacyRows)) {
        const res = await this.tryUpdateData(formData, nocodeId, tableUID, promotedRows, keys, FormDataStage.NORMAL, {
          triggerTodo: true,
          source: DataChangeType.ADD,
        });
        this.ensureHandleDataSuccess(res);
        const draftDeleteRes = await this.deleteData(formData, nocodeId, tableUID, cleanupRows, keys, "draft");
        this.ensureHandleDataSuccess(draftDeleteRes);
        return res;
      }

      if (!isEmpty(draftRows)) {
        const res = await this.addData(
          formData,
          nocodeId,
          tableUID,
          promotedRows,
          {
            triggerTodo: true,
            source: DataChangeType.ADD,
          },
          {
            preserveCreateOwner: true,
            overrideStage: FormDataStage.NORMAL,
            scope: "main",
          },
        );
        this.ensureHandleDataSuccess(res);
        if (!treeContext.isSeparated) {
          await this.deleteLegacyDraftRowsFromMainScope(formData, nocodeId, tableUID, cleanupRows, treeContext.statusMap);
        }
        const draftDeleteRes = await this.deleteData(formData, nocodeId, tableUID, cleanupRows, keys, "draft");
        this.ensureHandleDataSuccess(draftDeleteRes);
        return res;
      }

      const res = await this.addData(formData, nocodeId, tableUID, promotedRows, {
        triggerTodo: true,
        source: DataChangeType.ADD,
      });
      this.ensureHandleDataSuccess(res);
      return res;
    });
  }

  async ensureDraftStorageMigrated(nocodeId: string, tableUID: TableUID, formData?: NocodeFormData) {
    if (!this.hasDraftStorageStateService()) {
      return;
    }
    if (!formData) {
      const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
      formData = nocodeBody?.formData;
    }
    if (!formData) {
      return;
    }
    const { optionTable } = this.getTableContext(formData, tableUID);
    if (!optionTable) {
      return;
    }
    const status = await this.draftStorageStateService.getTableStatus(nocodeId, optionTable.uid);
    if (status === "separated") {
      return;
    }
    await this.migrateDraftStorageForOptionTable(nocodeId, optionTable.uid, formData);
  }

  private compareGroupedDraftMigrationRows(legacyRows: DataRows, migratedRows: DataRows) {
    const groupByKey = (rows: DataRows) => {
      return rows.reduce<Record<string, number>>((prev, row) => {
        const rawKey = row?.[SystemField.KEY];
        if (!rawKey) return prev;
        const key = String(rawKey);
        prev[key] = (prev[key] || 0) + 1;
        return prev;
      }, {});
    };
    const legacyGrouped = groupByKey(legacyRows);
    const migratedGrouped = groupByKey(migratedRows);
    const allKeys = new Set([
      ...Object.keys(legacyGrouped),
      ...Object.keys(migratedGrouped),
    ]);
    for (const key of allKeys) {
      if ((legacyGrouped[key] || 0) !== (migratedGrouped[key] || 0)) {
        return false;
      }
    }
    return true;
  }

  private verifyDraftMigrationRows(legacyRows: DataRows, migratedRows: DataRows) {
    if (legacyRows.length !== migratedRows.length) {
      throw new Error("draft migration row count mismatch");
    }
    const legacyUUIDs = new Set(legacyRows.map(row => row?.[SystemField.UUID]).filter(Boolean));
    const migratedUUIDs = new Set(migratedRows.map(row => row?.[SystemField.UUID]).filter(Boolean));
    if (legacyUUIDs.size !== migratedUUIDs.size) {
      throw new Error("draft migration uuid count mismatch");
    }
    for (const uuid of legacyUUIDs) {
      if (!migratedUUIDs.has(uuid)) {
        throw new Error(`draft migration uuid missing: ${uuid}`);
      }
    }
    const hasKey = legacyRows.some(row => SystemField.KEY in row) || migratedRows.some(row => SystemField.KEY in row);
    if (hasKey && !this.compareGroupedDraftMigrationRows(legacyRows, migratedRows)) {
      throw new Error("draft migration grouped key mismatch");
    }
  }

  async migrateDraftStorageForOptionTable(nocodeId: string, optionTableUid: string, formData?: NocodeFormData) {
    if (!this.hasDraftStorageStateService()) {
      return;
    }
    await this.draftStorageStateService.withTableLock(nocodeId, optionTableUid, async () => {
      const currentStatus = await this.draftStorageStateService.getTableStatus(nocodeId, optionTableUid);
      if (currentStatus === "separated") {
        return;
      }
      if (!formData) {
        const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
        formData = nocodeBody?.formData;
      }
      const optionTable = formData?.options?.tables?.find(table => table.uid === optionTableUid);
      if (!optionTable) {
        return;
      }
      await this.draftStorageStateService.setTableStatus(nocodeId, optionTableUid, "migrating");
      try {
        const mainDb = await this.dbManager.getDB(nocodeId, optionTable, "main");
        const draftDb = await this.dbManager.getDB(nocodeId, optionTable, "draft");
        const legacyRows = await mainDb.find({
          [SystemField.DATA_STAGE]: FormDataStage.DRAFT,
        });
        if (isEmpty(legacyRows)) {
          await this.draftStorageStateService.setTableStatus(nocodeId, optionTableUid, "separated");
          return;
        }
        const uuids = legacyRows.map(row => row?.[SystemField.UUID]).filter(Boolean);
        for (const row of legacyRows) {
          const uuid = row?.[SystemField.UUID];
          if (!uuid) continue;
          const { _id, ...nextRow } = row || {};
          await draftDb.update({
            [SystemField.UUID]: uuid,
          }, {
            // `_id` is store-local. Carrying the main-store `_id` into draft upserts
            // can make retrying migration fail once the draft row already exists.
            $set: nextRow,
          }, {
            upsert: true,
            multi: false,
          });
        }
        const migratedRows = await draftDb.find({
          [SystemField.UUID]: {
            $in: uuids,
          },
        });
        this.verifyDraftMigrationRows(legacyRows, migratedRows);
        await mainDb.remove({
          $and: [
            {
              [SystemField.DATA_STAGE]: FormDataStage.DRAFT,
            },
            {
              [SystemField.UUID]: {
                $in: uuids,
              },
            },
          ],
        }, {
          multi: true,
        });
        await this.draftStorageStateService.setTableStatus(nocodeId, optionTableUid, "separated");
      } catch (err) {
        await this.draftStorageStateService.setTableStatus(nocodeId, optionTableUid, "legacy", {
          lastError: err?.message || String(err),
        });
        throw err;
      }
    });
  }

  private async _addData(options: FormDataOptions, nocodeId: string, tableUID: string, rows: DataRows, scope: FormDataStoreScope = "main"): Promise<HandleDataResult> {
    const table = options.tables.find(table => table.uid === tableUID);
    try {
      const systemColumns = systemColumnUtil.getSystemColumns({
        includeDataOwner: Boolean(table && isDataOwnerEnabledTable(table)),
      });
      rows = rows.map((row) => {
        for (const column of systemColumns) {
          if (!(column.name in row) || (column.name === SystemField.UUID && isEmptyUUIDValue(row[column.name]))) {
            row[column.name] = systemColumnUtil.getColumnDefaultValue(column) ?? "";
          }
        }
        return row;
      });
      const db = await this.dbManager.getDB(nocodeId, table, scope);
      const data = await this.runWithTableMutationLock(nocodeId, tableUID, scope, async () => {
        return await db.insert(transformFormDataRow(rows, table.columns, { transformType: true })) || [];
      });

      return {
        tableName: table.tableName,
        data,
        success: true,
      };
    } catch (err) {
      this.logger.error(`Add form data failed: ${table?.tableName || tableUID}`, err instanceof Error ? err.stack : String(err));
      return {
        tableName: table.tableName,
        data: [],
        errorMessage: this.getErrorMessage(err),
        success: false,
      } as HandleDataResult & { errorMessage?: string }
    }
  }

  private async prepareAddRowsForMutation(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: string,
    rows: any[],
    options?: TryAddDataOptions,
  ): Promise<PreparedAddRowsResult> {
    const account = await this.getAccount();
    const { id: userId } = account ?? {};
    const stage: FormDataStageWhereCondition = options?.stage || FormDataStage.NORMAL;
    const uniqueValidation = options?.uniqueValidation || {};
    //添加主表数据
    const table = formData.tables.find(table => tableUID == table.uid);
    if (!table) {
      throw new Error(global.i18next.t('formDataService.updateDataFail'));
    }
    if (options?.scope === "main") {
      this.applySubFormDeduplicationToRows(formData, table, rows);
    }
    const tableFieldsMap = new Map<string, any>();
    const subTableUIDs: { field: Field, tableUID: OptionTableUID }[] = [];
    for (const field of table.fields) {
      const { extra } = field.meta;
      if (extra?.subTableUID) {
          //带有关联表标志的不属于该数据库字段
        subTableUIDs.push({ field, tableUID: extra.subTableUID });
      } else {
        tableFieldsMap.set(field.uid, {
          name: field.meta.name,
          extra: field.meta.extra,
        });
      }
    }
    const createOwnerField = getCreateOwnerSystemField(table.fields);
    const dataOwnerField = isDataOwnerEnabledTable(table) ? getDataOwnerSystemField(table.fields) : null;
    const updateOwnerField = getUpdateOwnerSystemField(table.fields);
    //重新组织rows的效果
    const uuidField = getUUIDSystemField(table.fields);
    const stageField = table.fields.find(field => field.meta.name === SystemField.DATA_STAGE);
    const preparedRows = [];
    for (const row of rows) {
      if (uuidField?.uid) {
        const uuid = row?.[uuidField.uid] || row?.[SystemField.UUID];
        row[uuidField.uid] = uuid || unique();
      }
      const preparedRow = {};
      for (const uid of Object.keys(row || {})) {
        if (!tableFieldsMap.has(uid)) continue;
        const field = table.fields.find(field => field.uid === uid);
        const { name } = tableFieldsMap.get(uid);
        if (field.meta?.extra?.widgetType === "widget.form.serialNumber" && row[uid] === null) {
          const serialValue = await this.generateSerialNumber(nocodeId, table.meta.uid, row, field.uid);
          row[uid] = serialValue;
          preparedRow[name] = serialValue;
        } else {
          let value = row[uid];
          if (typeof value === 'number' && Number.isNaN(value)) {
            value = null;
          }
          preparedRow[name] = value;
        }
      }
      const serialNumberFields = table.fields.filter(field => (
        field.meta?.extra?.widgetType === "widget.form.serialNumber"
      ) && [null, undefined].includes(preparedRow[field.meta.name]));
      for (const field of serialNumberFields) {
        const serialValue = await this.generateSerialNumber(nocodeId, table.meta.uid, row, field.uid);
        row[field.uid] = serialValue;
        preparedRow[field.meta.name] = serialValue;
      }
      if (options?.overrideStage) {
        preparedRow[SystemField.DATA_STAGE] = options.overrideStage;
        if (stageField?.uid) {
          row[stageField.uid] = options.overrideStage;
        }
      } else if (stage === FormDataStage.DRAFT) {
        preparedRow[SystemField.DATA_STAGE] = FormDataStage.DRAFT;
        if (stageField?.uid) {
          row[stageField.uid] = FormDataStage.DRAFT;
        }
      }
      if (options?.keepSubmitter) {
        preparedRow[tableFieldsMap.get(createOwnerField.uid).name] = row[createOwnerField.uid] || userId;
        preparedRow[tableFieldsMap.get(updateOwnerField.uid).name] = row[createOwnerField.uid] || userId;
        row[createOwnerField.uid] = row[createOwnerField.uid] || userId;
        row[updateOwnerField.uid] = row[createOwnerField.uid] || userId;
      } else if (options?.preserveOwners) {
        preparedRow[tableFieldsMap.get(createOwnerField.uid).name] = row[createOwnerField.uid] || userId;
        preparedRow[tableFieldsMap.get(updateOwnerField.uid).name] = row[updateOwnerField.uid] || row[createOwnerField.uid] || userId;
        row[createOwnerField.uid] = row[createOwnerField.uid] || userId;
        row[updateOwnerField.uid] = row[updateOwnerField.uid] || row[createOwnerField.uid] || userId;
      } else if (options?.preserveCreateOwner) {
        preparedRow[tableFieldsMap.get(createOwnerField.uid).name] = row[createOwnerField.uid] || userId;
        preparedRow[tableFieldsMap.get(updateOwnerField.uid).name] = userId;
        row[createOwnerField.uid] = row[createOwnerField.uid] || userId;
        row[updateOwnerField.uid] = userId;
      } else {
        preparedRow[tableFieldsMap.get(createOwnerField.uid).name] = userId;
        preparedRow[tableFieldsMap.get(updateOwnerField.uid).name] = userId;
        row[createOwnerField.uid] = userId;
        row[updateOwnerField.uid] = userId;
      }
      if (dataOwnerField?.uid) {
        const dataOwnerFieldName = tableFieldsMap.get(dataOwnerField.uid)?.name || SystemField.DATA_OWNER;
        const dataOwnerValue = row[dataOwnerField.uid] || row[SystemField.DATA_OWNER] || row[createOwnerField.uid] || userId;
        preparedRow[dataOwnerFieldName] = dataOwnerValue;
        row[dataOwnerField.uid] = dataOwnerValue;
      }
      preparedRows.push(preparedRow);
    }
    return {
      table,
      preparedRows,
      uniqueValidation,
      subTableUIDs,
    };
  }

  private async prepareUpdateRowsForMutation(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: any[],
    keys: OptionFieldUID[],
    stage: FormDataStage = null,
    uniqueValidation: UniqueValidationOptions = {},
    updateFieldIds: ViewActionFieldId[] = [],
    viewActionContext?: ExecuteViewActionEditContext,
  ): Promise<PreparedUpdateRowsResult> {
    uniqueValidation = {
      validateCurrentTable: stage !== FormDataStage.DRAFT,
      ...(uniqueValidation || {}),
    };
    const effectiveUpdateFieldIds = viewActionContext
      ? mergeUpdateFieldIds(
          await this.resolveViewActionEditUpdateFieldIds(nocodeId, tableUID as TableUID, rows, keys, viewActionContext),
          updateFieldIds,
        )
      : updateFieldIds;
    const table = formData.tables.find(table => tableUID == table.uid);
    if (!table) {
      throw new Error(global.i18next.t('formDataService.updateDataFail'));
    }
    if (uniqueValidation.skipSubTableSync !== true && rows.length) {
      this.applySubFormDeduplicationToRows(formData, table, rows);
    }
    const subTableUpdateFieldMap = this.buildSubTableUpdateFieldMap(formData, table, effectiveUpdateFieldIds);
    const tableFieldsMap = new Map<string, any>();
    const subTableUIDs: { field: Field, tableUID: OptionTableUID }[] = [];
    const allowDataOwner = isDataOwnerEnabledTable(table);
    for (const key in SystemField) {
      if (!allowDataOwner && SystemField[key] === SystemField.DATA_OWNER) {
        continue;
      }
      tableFieldsMap.set(SystemField[key], {
        name: SystemField[key],
        extra: null,
      });
    }
    for (const field of table.fields) {
      const { extra } = field.meta;
      if (extra?.subTableUID) {
        subTableUIDs.push({ field, tableUID: extra.subTableUID });
      } else {
        const fieldMeta = {
          name: field.meta.name,
          extra: field.meta.extra,
          subType: field.meta.subType,
        };
        tableFieldsMap.set(field.uid, fieldMeta);
        if (field.meta?.uid && !tableFieldsMap.has(field.meta.uid)) {
          tableFieldsMap.set(field.meta.uid, fieldMeta);
        }
      }
    }
    const account = await this.getAccount();
    const { id: userId } = account ?? {};
    const updateOwnerField = getUpdateOwnerSystemField(table.fields);
    const updateOwnerFieldName = updateOwnerField?.uid ? tableFieldsMap.get(updateOwnerField.uid)?.name : "";
    const preparedRows = [];
    for (const row of rows) {
      const preparedRow = {};
      for (const uid of Object.keys(row || {})) {
        if (!tableFieldsMap.has(uid)) continue;
        let value = row[uid];
        if (typeof value === 'number' && Number.isNaN(value)) {
          value = null;
        }
        const { name, extra, subType } = tableFieldsMap.get(uid);
        const format = extra?.format;
        if (subType === "switch" && format?.includes(value)) {
          preparedRow[name] = value === format[0] ? true : false;
        } else {
          preparedRow[name] = value;
        }
      }
      if (stage) {
        preparedRow[SystemField.DATA_STAGE] = stage;
      }
      if (
        updateOwnerFieldName
        && (!uniqueValidation.restoreFromSnapshot || !Object.prototype.hasOwnProperty.call(preparedRow, updateOwnerFieldName))
      ) {
        preparedRow[updateOwnerFieldName] = userId;
      }
      preparedRows.push(preparedRow);
    }
    await this.runWithSubFormUniqueGuard(formData, nocodeId, table, rows, uniqueValidation, async () => {
      if (!uniqueValidation.skipSubTableSync) {
        for (const { field, tableUID: subTableUID } of subTableUIDs) {
          await this.ensureSubmittedSubTableRowsStillValid(
            formData,
            nocodeId,
            table,
            rows,
            field,
            subTableUID,
            "main",
            this.getSubTableUpdateFieldIds(subTableUpdateFieldMap, field.uid),
          );
        }
      }
      return true;
    });
    return {
      table,
      preparedRows,
      uniqueValidation,
      subTableUIDs,
      subTableUpdateFieldMap,
      effectiveUpdateFieldIds,
    };
  }

  private async tryAddData(formData: NocodeFormData, nocodeId: string, tableUID: string, rows: any[], options?: TryAddDataOptions) {
    const scope = options?.scope || "main";
    const stage: FormDataStageWhereCondition = options?.stage || FormDataStage.NORMAL;
    const { table, preparedRows, uniqueValidation, subTableUIDs } = await this.prepareAddRowsForMutation(
      formData,
      nocodeId,
      tableUID,
      rows,
      options,
    );
    const projectionChanges = scope === "main"
      ? await this.stageScheduledProjectionChanges(nocodeId, table, rows, true)
      : [];
    let mutationCommitted = false;
    const handlePostCommitError = (err: unknown): never => {
      if (mutationCommitted) {
        throw this.markMutationCommittedError(err);
      }
      throw err;
    };
    const res = await this.runWithSubFormUniqueGuard(formData, nocodeId, table, rows, uniqueValidation, async () => {
      const addRes = await this._addData(formData.options, nocodeId, table.meta.uid, preparedRows, scope);
      if (!addRes?.success) {
        return addRes;
      }
      const addedRows = addRes.data ?? [];
      mutationCommitted = addedRows.length > 0;
      if (addedRows.length > 0) {
        const uuidField = getUUIDSystemField(table.fields);
        if (uuidField?.uid) {
          rows.forEach((row, index) => {
            row[uuidField.uid] = addedRows[index]?.[SystemField.UUID];
          });
        }
        for (const { field, tableUID: subTableUID } of subTableUIDs) {
          await this.syncSubTableFieldRows(formData, nocodeId, table, rows, field, subTableUID, stage as FormDataStage, scope, {
            skipValidation: true,
            skipLock: true,
            skipSubTableDeduplicationRebuild: true,
          });
        }
      }
      const relationValues = this.collectSubTableRelationValues(table, rows);
      if (addedRows.length > 0 && relationValues.length > 0) {
        await this.rebuildSubTableDeduplicatedRows(formData, nocodeId, table, relationValues, scope, {
          skipLock: true,
          skipSubTableDeduplicationRebuild: uniqueValidation.skipSubTableDeduplicationRebuild,
        });
      }
      return addRes;
    }).catch(handlePostCommitError);
    if (res?.success && scope === "main") {
      await this.afterAddData(nocodeId, table, rows, projectionChanges).catch(handlePostCommitError);
    }
    return res;
  }

  async addData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[], options?: TriggerOptions, addOptions?: TryAddDataOptions) {
    const scope = addOptions?.scope || "main";
    if (options?.validatePermission !== false) {
      const isValid = await this.validateAddPermission(nocodeId, tableUID);
      if (!isValid) {
        throw new Error(global.i18next.t('formDataService.noPerm'));
      }
    }
    if (options?.stashFlow) {
      const { table, uniqueValidation } = await this.prepareAddRowsForMutation(formData, nocodeId, tableUID, rows, {
        ...(addOptions || {}),
        uniqueValidation: {
          validateCurrentTable: addOptions?.scope !== "draft" && addOptions?.stage !== FormDataStage.DRAFT,
          ...(addOptions?.uniqueValidation || {}),
        },
      });
      await this.runWithSubFormUniqueGuard(formData, nocodeId, table, rows, uniqueValidation, async () => true);
      const uuidField = getUUIDSystemField(table.fields);
      const preparedRows = rows.map((row) => ({
        ...row,
        [SystemField.UUID]: row?.[uuidField?.uid] || row?.[SystemField.UUID] || unique(),
      }));
      const res = await this.formFlowService.createDataChangeStashTodo(
        nocodeId,
        tableUID,
        preparedRows[0] || rows[0],
        DataChangeType.ADD,
        options.triggerContext,
      );
      if (!res?.triggered) {
        throw new Error(global.i18next.t('formFlowService.stashEntryInvalid'));
      }
      return {
        tableName: table?.alias || table?.meta?.name || tableUID,
        data: preparedRows,
        success: true,
      } as HandleDataResult;
    }
    const res = await this.tryAddData(formData, nocodeId, tableUID, rows, {
      ...(addOptions || {}),
      uniqueValidation: {
        validateCurrentTable: addOptions?.scope !== "draft" && addOptions?.stage !== FormDataStage.DRAFT,
        ...(addOptions?.uniqueValidation || {}),
      },
    });
    if (!res?.success) {
      throw new Error((res as HandleDataResult & { errorMessage?: string })?.errorMessage || global.i18next.t('NocodeForm.formSubmitFail'));
    }
    options = merge({ triggerTodo: true, source: DataChangeType.ADD }, options || {});
    options.beforeMutationRows ||= [];
    if (scope === "main" && !options.deferPostMutation) {
      try {
        await this.runPostMutationTasks(nocodeId, tableUID, res.data, options.source, options, options.failOnPostMutationError === true);
      } catch (err) {
        throw this.markMutationCommittedError(err);
      }
    }
    return res;
  }

  async runImportBatchAggregation(nocodeId: string, tableUID: TableUID, rows: Row[]) {
    // 仅供 Excel 导入后台任务调用；普通新增/编辑仍由 runPostMutationTasks 处理。
    return await this.formFlowService.runImportBatchAggregation(nocodeId, tableUID, rows);
  }

  async supportsImportBatchAggregation(nocodeId: string, tableUID: TableUID) {
    return await this.formFlowService.supportsImportBatchAggregation(nocodeId, tableUID);
  }

  async prepareDataChangeFlowQueue(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    source: DataChangeType,
    triggerContext?: TriggerOptions['triggerContext'],
    options?: {
      /** Canonical rows returned by a committed ADD import. */
      knownRows?: Row[];
      /** Only valid together with knownRows for a committed ADD import. */
      skipStatusUpdate?: boolean;
    },
  ): Promise<DataChangeFlowQueueState | null | undefined> {
    if (isEmpty(rows) || ![DataChangeType.ADD, DataChangeType.EDIT, DataChangeType.DELETE].includes(source)) {
      return null;
    }

    try {
      // 只有实际命中数据变更流程及其分支条件的数据才进入排队状态。
      const matchedUUIDs = await this.formFlowService.getDataChangeTriggerRowUUIDs(
        nocodeId,
        tableUID,
        rows,
        source,
        triggerContext,
      );
      if (!matchedUUIDs.length) {
        return null;
      }

      // Newly inserted rows are already committed and are available in the
      // mutation result. Avoid reading the same large batch back from the
      // data store merely to create a rollback snapshot. We still write the
      // durable QUEUED status for matched rows; skipping that transition makes
      // queued imports appear as ordinary records in the data manager.
      const useKnownRows = source === DataChangeType.ADD
        && options?.skipStatusUpdate === true
        && Array.isArray(options.knownRows);
      if (useKnownRows) {
        const current = await this.getCurrentFormDataTable(nocodeId, tableUID);
        const uuidField = getUUIDSystemField(current.table.fields);
        const statusField = this.getSystemFieldByName(current.table, SystemField.STATUS);
        if (!uuidField?.uid || !statusField?.uid) {
          return null;
        }
        const matchedUUIDSet = new Set(matchedUUIDs);
        const previousRows = options.knownRows
          .filter(row => matchedUUIDSet.has(String(this.getRowSystemFieldValue(current.table, row, SystemField.UUID) || "")))
          .map(row => deepClone(row));
        if (!previousRows.length) {
          return null;
        }
        const optionTable = current.formData.options.tables.find(item => item.uid === current.table.meta.uid);
        if (!optionTable) {
          return null;
        }
        const matchedRowUUIDs = previousRows.map(row => (
          this.getRowSystemFieldValue(current.table, row, SystemField.UUID)
        ));
        const db = await this.dbManager.getDB(nocodeId, optionTable, "main");
        await this.runWithTableMutationLock(nocodeId, tableUID, "main", async () => {
          await db.update({
            [getDbColumnKey(uuidField)]: { $in: matchedRowUUIDs },
          }, {
            $set: {
              [getDbColumnKey(statusField)]: ProcessNodeStatus.QUEUED,
            },
          }, {
            multi: true,
          });
        });
        return previousRows.length ? { previousRows } : null;
      }

      const current = await this.getCurrentFormDataRowsByUUID(nocodeId, tableUID, rows);
      const uuidField = getUUIDSystemField(current.table.fields);
      const statusField = this.getSystemFieldByName(current.table, SystemField.STATUS);
      if (!uuidField?.uid || !statusField?.uid) {
        return null;
      }

      const matchedUUIDSet = new Set(matchedUUIDs);
      const previousRows = current.rows
        .filter(row => matchedUUIDSet.has(String(this.getRowSystemFieldValue(current.table, row, SystemField.UUID) || "")))
        .map(row => deepClone(row));
      if (!previousRows.length) {
        return null;
      }

      const queuedRows = previousRows.map(row => ({
        [uuidField.uid]: this.getRowSystemFieldValue(current.table, row, SystemField.UUID),
        [statusField.uid]: ProcessNodeStatus.QUEUED,
      }));
      // 保留入队前快照，后续未能真正进入流程时可恢复原状态。
      await this.tryUpdateData(
        current.formData,
        nocodeId,
        tableUID,
        queuedRows,
        [[current.formData.uid, current.table.uid, uuidField.uid]],
        null,
        {
          triggerTodo: false,
          validatePermission: false,
          allowDataOwnerUpdate: true,
        },
      );
      return { previousRows };
    } catch (error) {
      this.logger.error(`Prepare data change flow queue failed: ${nocodeId}:${tableUID}`, error);
      // undefined 表示排队检查失败；null 仅表示确认没有命中流程。
      return undefined;
    }
  }

  async getDataChangeFlowTaskRowUUIDs(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    source: DataChangeType,
    triggerContext?: TriggerOptions['triggerContext'],
  ) {
    return await this.formFlowService.getDataChangeTriggerRowUUIDs(
      nocodeId,
      tableUID,
      rows,
      source,
      triggerContext,
    );
  }

  async prepareViewActionTriggerQueue(
    nocodeId: string,
    tableUID: TableUID,
    uuids: string[] = [],
  ): Promise<Record<string, DataChangeFlowQueueState> | null | undefined> {
    const normalizedUUIDs = [...new Set((uuids || []).map(uuid => String(uuid || "").trim()).filter(Boolean))];
    if (!normalizedUUIDs.length) {
      return null;
    }

    try {
      const current = await this.getCurrentFormDataRowsByUUID(
        nocodeId,
        tableUID,
        normalizedUUIDs.map(uuid => ({ [SystemField.UUID]: uuid })),
      );
      const uuidField = getUUIDSystemField(current.table.fields);
      const statusField = this.getSystemFieldByName(current.table, SystemField.STATUS);
      if (!uuidField?.uid || !statusField?.uid || !current.rows.length) {
        return null;
      }

      const previousRows = current.rows.map(row => deepClone(row));
      const queueStateByUUID: Record<string, DataChangeFlowQueueState> = {};
      const queuedRows = previousRows.map(row => {
        const uuid = String(this.getRowSystemFieldValue(current.table, row, SystemField.UUID) || "");
        queueStateByUUID[uuid] = { previousRows: [row] };
        return {
        [uuidField.uid]: this.getRowSystemFieldValue(current.table, row, SystemField.UUID),
        [statusField.uid]: ProcessNodeStatus.QUEUED,
        };
      });
      await this.tryUpdateData(
        current.formData,
        nocodeId,
        tableUID,
        queuedRows,
        [[current.formData.uid, current.table.uid, uuidField.uid]],
        null,
        {
          triggerTodo: false,
          validatePermission: false,
          allowDataOwnerUpdate: true,
        },
      );
      return queueStateByUUID;
    } catch (error) {
      this.logger.error(`Prepare view action trigger queue failed: ${nocodeId}:${tableUID}`, error);
      return undefined;
    }
  }

  async restoreQueuedDataChangeFlowRows(
    nocodeId: string,
    tableUID: TableUID,
    queueState?: DataChangeFlowQueueState | null,
  ) {
    if (!queueState?.previousRows?.length) {
      return;
    }

    try {
      // 删除流程先将记录移入回收站，回滚时需要读取包含 DELETED 阶段的记录。
      const current = await this.getCurrentFormDataRowsByUUID(
        nocodeId,
        tableUID,
        queueState.previousRows,
        { $nin: [FormDataStage.DRAFT] },
      );
      const uuidField = getUUIDSystemField(current.table.fields);
      const statusField = this.getSystemFieldByName(current.table, SystemField.STATUS);
      if (!uuidField?.uid || !statusField?.uid) {
        return;
      }

      const previousRowsByUUID = new Map(queueState.previousRows.map(row => [
        String(this.getRowSystemFieldValue(current.table, row, SystemField.UUID) || ""),
        row,
      ]));
      const rowsToRestore = current.rows
        // 已被流程推进到“进行中”或终态的数据不再回滚，避免覆盖流程结果。
        .filter(row => this.getRowSystemFieldValue(current.table, row, SystemField.STATUS) === ProcessNodeStatus.QUEUED)
        .map(row => {
          const uuid = String(this.getRowSystemFieldValue(current.table, row, SystemField.UUID) || "");
          const previousRow = previousRowsByUUID.get(uuid);
          return {
            [uuidField.uid]: uuid,
            [statusField.uid]: previousRow
              ? this.getRowSystemFieldValue(current.table, previousRow, SystemField.STATUS) ?? ""
              : "",
          };
        });
      if (!rowsToRestore.length) {
        return;
      }

      await this.tryUpdateData(
        current.formData,
        nocodeId,
        tableUID,
        rowsToRestore,
        [[current.formData.uid, current.table.uid, uuidField.uid]],
        null,
        {
          triggerTodo: false,
          validatePermission: false,
          allowDataOwnerUpdate: true,
        },
      );
    } catch (error) {
      this.logger.error(`Restore queued data change flow rows failed: ${nocodeId}:${tableUID}`, error);
    }
  }

  async runPostMutationTasks(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    source: DataChangeType,
    options: TriggerOptions = {},
    failOnError = true,
    queueState?: DataChangeFlowQueueState | null,
  ): Promise<FlowTriggerResult> {
    const resultRows = Array.isArray(rows) ? rows : [];
    const operationLabel = source === DataChangeType.ADD
      ? "Add"
      : source === DataChangeType.EDIT
        ? "Update"
        : source;
    let triggerResult: FlowTriggerResult = { triggered: false };
    // 控制器已预先标记时复用快照；其他调用入口则在这里补齐入队标记。
    const preparedQueueState = queueState !== undefined ? queueState : (
      options.triggerTodo !== false
        ? await this.prepareDataChangeFlowQueue(nocodeId, tableUID, resultRows, source, options.triggerContext)
        : null
    );
    let queueRestored = false;
    const restoreQueue = async () => {
      if (queueRestored) {
        return;
      }
      queueRestored = true;
      await this.restoreQueuedDataChangeFlowRows(nocodeId, tableUID, preparedQueueState);
    };
    if (options.triggerTodo !== false && resultRows.length) {
      try {
        // 实际创建流程记录时，既有逻辑会将数据状态改为“进行中”。
        for (let index = 0; index < resultRows.length; index += FLOW_TRIGGER_EXECUTION_BATCH_SIZE) {
          const currentResult = await this.formFlowService.tryTriggerTodo(
            nocodeId,
            tableUID,
            resultRows.slice(index, index + FLOW_TRIGGER_EXECUTION_BATCH_SIZE),
            source,
            options.triggerContext,
            options.importTaskId,
            false,
            options,
          );
          if (currentResult.triggered) {
            triggerResult = {
              triggered: true,
              triggeredTodoId: triggerResult.triggeredTodoId || currentResult.triggeredTodoId,
            };
          } else if (!triggerResult.triggered) {
            triggerResult = currentResult;
          }
          await new Promise<void>(resolve => setImmediate(resolve));
        }
        if (options.crossAppTriggerResult) {
          Object.assign(options.crossAppTriggerResult, triggerResult);
        }
      } catch (err) {
        this.logger.error(`${operationLabel}: trigger todo error`, err);
        await restoreQueue();
        if (failOnError) throw err;
      }
    }

    // 未命中、跳过或触发异常时，仅恢复仍停留在“排队中”的数据。
    await restoreQueue();

    return triggerResult;
  }

  private async getCurrentFormDataTable(nocodeId: string, tableUID: TableUID) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const currentFormData = nocodeBody.formData;
    const currentTable = currentFormData?.tables?.find(table => table.uid === tableUID);
    if (!currentTable) {
      throw new Error(`Current form table not found: ${nocodeId}:${tableUID}`);
    }
    return {
      formData: currentFormData,
      table: currentTable,
    };
  }

  async finalizeDerivedDeleteRows(nocodeId: string, tableUID: TableUID, rows: Row[]) {
    if (!rows.length) return;
    const current = await this.getCurrentFormDataTable(nocodeId, tableUID);
    const uuidField = getUUIDSystemField(current.table.fields);
    if (!uuidField?.uid) return;
    await this.moveRowsToRecycleBin(
      current.formData,
      nocodeId,
      tableUID,
      rows,
      [[current.formData.uid, tableUID, uuidField.uid]],
    );
  }

  private async getCurrentFormDataRowsByUUID(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    stage: FormDataStageWhereCondition = this.getDefaultReadableStageCondition(),
  ) {
    const current = await this.getCurrentFormDataTable(nocodeId, tableUID);
    const uuidField = getUUIDSystemField(current.table.fields);
    const uuids = Array.from(new Set(rows
      .map(row => this.getRowSystemFieldValue(current.table, row, SystemField.UUID))
      .filter(Boolean)
      .map(uuid => String(uuid))));
    if (!uuidField?.uid || !uuids.length) {
      return {
        ...current,
        rows: [],
      };
    }

    const buckets = await this._getData(current.formData, [tableUID], nocodeId, {
      filters: {
        [tableUID]: [{
          [uuidField.uid]: {
            $in: uuids,
          },
        }],
      },
      stage,
    });
    const currentRows = buckets?.[0]?.rows || [];
    const rowMap = new Map(currentRows.map(row => [String(this.getRowSystemFieldValue(current.table, row, SystemField.UUID)), row]));
    return {
      ...current,
      rows: uuids.map(uuid => rowMap.get(uuid)).filter(Boolean),
    };
  }

  private async validateAddPermission(nocodeId: string, tableUID: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const table = nocodeBody.formData.tables.find(item => item.uid === tableUID || item.meta?.uid === tableUID);
    const permission = nocodeBody.permissions?.data?.[tableUID]?.[PermissionCategory.ADD]
      || (table?.uid ? nocodeBody.permissions?.data?.[table.uid]?.[PermissionCategory.ADD] : undefined)
      || (table?.meta?.uid ? nocodeBody.permissions?.data?.[table.meta.uid]?.[PermissionCategory.ADD] : undefined);
    if (!permission) return true;
    if (permission.rangeType !== PermissionRangeType.CUSTOM) return true;
    const account = await this.getAccount();
    if (isAnonymousAccount(account) || isSystemAdminAccount(account)) return true;
    const { departments, roles, users } = permission.range || {};
    if (users?.some(id => id === account.id)) return true;
    if (roles?.some(id => account.roles.includes(id))) return true;
    return await this.workbenchService.isInDepartments(account.departments, departments);
  }

  private async _updateData(
    options: FormDataOptions,
    nocodeId: string,
    tableUID: string,
    rows: DataRows,
    keys: string[],
    scope: FormDataStoreScope = "main",
    updateOptions: Pick<UniqueValidationOptions, "fixedUpdateTime" | "restoreFromSnapshot"> & {
      allowedUpdateFieldKeys?: string[];
      forceChangeRows?: boolean[];
    } = {},
  ): Promise<HandleMutationDataResult> {
    const table = options.tables.find(table => table.uid === tableUID);
    try {
      const db = await this.dbManager.getDB(nocodeId, table, scope);
      return await this.runWithTableMutationLock(nocodeId, tableUID, scope, async () => {
        const rollbackRowMap = new Map<string, Record<string, unknown>>();
        try {
          const preparedRows = rows.map((row, rowIndex) => {
            const query = {};
            for (const key of keys) {
              if (key in row) {
                query[key] = row[key];
              }
            }
            const queryForDb = transformFormDataRow(query, table.columns, { transformType: true });
            const item = transformFormDataRow(row, table.columns, { transformType: true });
            const updateItem = this.buildControlledUpdateItem(item, updateOptions.allowedUpdateFieldKeys);
            return { rowIndex, queryForDb, updateItem };
          });
          if (preparedRows.length && (!keys?.length || preparedRows.some(item => isEmpty(item.queryForDb)))) {
            throw new Error(global.i18next.t('formDataService.updateDataFail'));
          }
          const queries = preparedRows
            .map(item => item.queryForDb)
            .filter(query => !isEmpty(query));
          const previousRows = queries.length
            ? await db.find({ $or: queries })
            : [];
          const hasMissingTarget = preparedRows.some(prepared => {
            return !previousRows.some(previousRow => {
              return Object.entries(prepared.queryForDb).every(([key, value]) => equals(previousRow?.[key], value));
            });
          });
          if (hasMissingTarget) {
            throw new Error(global.i18next.t('formDataService.updateDataFail'));
          }
          const availablePreviousRows = [...previousRows];
          const nextRowMap = new Map<string, Record<string, unknown>>();
          const lastChangedRowIndexMap = new Map<string, number>();
          const forcedRowIdentities = new Set<string>();
          const ignoredChangeFields = new Set([
            SystemField.UPDATE_TIME,
            SystemField.UPDATE_OWNER,
          ]);
          const updateTime = updateOptions.fixedUpdateTime || dayjs().format("YYYY-MM-DD HH:mm:ss");

          for (const prepared of preparedRows) {
            if (isEmpty(prepared.queryForDb)) {
              continue;
            }
            const previousIndex = availablePreviousRows.findIndex(previousRow => {
              return Object.entries(prepared.queryForDb).every(([key, value]) => equals(previousRow?.[key], value));
            });
            if (previousIndex < 0) {
              continue;
            }
            const previousRow = availablePreviousRows[previousIndex];
            const hasBusinessChange = Object.entries(prepared.updateItem).some(([key, value]) => {
              return !ignoredChangeFields.has(key as SystemField) && !equals(previousRow?.[key], value);
            });
            if (
              !hasBusinessChange
              && !updateOptions.restoreFromSnapshot
              && !updateOptions.forceChangeRows?.[prepared.rowIndex]
            ) {
              continue;
            }
            if (!(
              updateOptions.restoreFromSnapshot
              && Object.prototype.hasOwnProperty.call(prepared.updateItem, SystemField.UPDATE_TIME)
            )) {
              prepared.updateItem[SystemField.UPDATE_TIME] = updateTime;
            }
            const rollbackRow = deepClone(previousRow);
            rollbackRow._id = previousRow._id;
            const nextRow = deepClone(previousRow);
            nextRow._id = previousRow._id;
            Object.assign(nextRow, deepClone(prepared.updateItem));
            const rowIdentity = previousRow._id != null
              ? `id:${String(previousRow._id)}`
              : `query:${JSON.stringify(prepared.queryForDb)}`;
            if (!rollbackRowMap.has(rowIdentity)) {
              rollbackRowMap.set(rowIdentity, rollbackRow);
            }
            nextRowMap.set(rowIdentity, nextRow);
            lastChangedRowIndexMap.set(rowIdentity, prepared.rowIndex);
            if (updateOptions.forceChangeRows?.[prepared.rowIndex]) {
              forcedRowIdentities.add(rowIdentity);
            }
            availablePreviousRows[previousIndex] = nextRow;
          }

          const changedEntries = [...nextRowMap.entries()].filter(([rowIdentity, nextRow]) => {
            if (updateOptions.restoreFromSnapshot || forcedRowIdentities.has(rowIdentity)) {
              return true;
            }
            const originalRow = rollbackRowMap.get(rowIdentity);
            const compareKeys = new Set([
              ...Object.keys(originalRow || {}),
              ...Object.keys(nextRow || {}),
            ]);
            compareKeys.delete("_id");
            return [...compareKeys].some(key => {
              return !ignoredChangeFields.has(key as SystemField)
                && !equals(originalRow?.[key], nextRow?.[key]);
            });
          });
          const changedRowIdentities = new Set(changedEntries.map(([rowIdentity]) => rowIdentity));
          for (const rowIdentity of rollbackRowMap.keys()) {
            if (!changedRowIdentities.has(rowIdentity)) {
              rollbackRowMap.delete(rowIdentity);
            }
          }
          if (changedEntries.length) {
            await db.save(changedEntries.map(([, row]) => row));
          }
          return {
            tableName: table.tableName,
            data: changedEntries.map(([, row]) => this.buildUpdatedRowSnapshot(row, {})),
            changedRowIndexes: changedEntries
              .map(([rowIdentity]) => lastChangedRowIndexMap.get(rowIdentity))
              .filter((rowIndex): rowIndex is number => rowIndex !== undefined),
            success: true,
          };
        } catch (err) {
          this.logger.error(`Update form data failed: ${table?.tableName || tableUID}`, err instanceof Error ? err.stack : String(err));
          let mutationCommitted = false;
          const errorMessage = this.getErrorMessage(err);
          if (rollbackRowMap.size) {
            try {
              await db.save([...rollbackRowMap.values()]);
            } catch (rollbackErr) {
              mutationCommitted = true;
              this.logger.error(`Rollback updated form data failed: ${table?.tableName || tableUID}`, rollbackErr instanceof Error ? rollbackErr.stack : String(rollbackErr));
            }
          }
          return {
            tableName: table.tableName,
            data: [],
            errorMessage,
            mutationCommitted,
            success: false,
          };
        }
      });
    } catch (err) {
      this.logger.error(`Update form data failed: ${table?.tableName || tableUID}`, err instanceof Error ? err.stack : String(err));
      return {
        tableName: table.tableName,
        data: [],
        errorMessage: this.getErrorMessage(err),
        success: false,
      } as HandleDataResult & { errorMessage?: string }
    }
  }

  private async checkRowInProcess(nocodeId: string, tableUID: TableUID, fieldIds: FieldUID[], rows: any[]) {
    if (isEmpty(rows)) return [];
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const queryCondition = rows.map(row => {
      const query: WhereCondition = {};
      for (const fieldId of fieldIds) {
        if (fieldId in row) {
          query[fieldId] = row[fieldId];
        }
      }
      return query;
    });

    const query = {
      $or: queryCondition,
    }
    const buckets = await this._getData(formData, [tableUID], nocodeId, {
      filters: {
        [tableUID]: [query],
      },
      stage: {
        $in: [FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING]
      }
    })
    const _rows = buckets?.[0]?.rows;
    return _rows;
  }

  private resolveRecalculateField(table: Table, formData: NocodeFormData, fieldUID: FieldUID): RecalculateTargetFieldInfo | null {
    if (!table || !fieldUID) return null;
    const fieldUIDParts = String(fieldUID).split(".");
    if (fieldUIDParts.length === 1) {
      const targetField = table.fields.find(field => field.uid === fieldUID);
      return targetField ? { targetField } : null;
    }

    const [parentFieldUID, subFieldUID] = fieldUIDParts;
    const parentField = table.fields.find(field => field.uid === parentFieldUID);
    const subTableUID = parentField?.meta?.extra?.subTableUID?.[1];
    if (!parentField || !subTableUID || !subFieldUID) return null;
    const subTable = formData.tables.find(item => item.uid === subTableUID);
    const subField = subTable?.fields?.find(field => field.uid === subFieldUID);
    if (!subField) return null;

    return {
      targetField: {
        ...deepClone(subField),
        uid: `${parentFieldUID}.${subFieldUID}` as FieldUID,
      },
    };
  }

  private buildRecalculateFormulaFields(table: Table, formData: NocodeFormData, targetField: Field) {
    const targetFields = [targetField];
    const dependentFields = getFormulaFields(targetFields, table.fields, formData.tables) || [];
    const fieldMap = new Map<string, Field>();
    [...targetFields, ...dependentFields].forEach((field) => {
      if (!field?.uid) return;
      fieldMap.set(field.uid, field);
    });
    return Array.from(fieldMap.values());
  }

  private normalizeRecalculateCompareFieldUIDs(fieldUIDs: FieldUID[] = []) {
    return Array.from(new Set(fieldUIDs
      .filter(Boolean)
      .map((item) => String(item).split(".")[0] as FieldUID)));
  }

  private pickChangedRows(beforeRows: Row[], afterRows: Row[], compareFieldUIDs: FieldUID[]) {
    const changedRows: Row[] = [];
    for (let i = 0; i < (afterRows || []).length; i++) {
      const nextRow = afterRows[i];
      const prevRow = beforeRows?.[i];
      const isChanged = compareFieldUIDs.some((compareFieldUID) => {
        return !equals(prevRow?.[compareFieldUID], nextRow?.[compareFieldUID]);
      });
      if (isChanged) {
        changedRows.push(nextRow);
      }
    }
    return changedRows;
  }

  async recalculateTableFieldData(nocodeId: string, tableUID: TableUID, fieldUID: FieldUID) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody?.formData as NocodeFormData;
    const table = formData?.tables?.find(item => item.uid === tableUID);
    if (!table) {
      throw new Error(global.i18next.t('formDataService.updateDataFail'));
    }

    const targetFieldInfo = this.resolveRecalculateField(table, formData, fieldUID);
    if (!targetFieldInfo) {
      throw new Error(global.i18next.t('formDataService.updateDataFail'));
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField?.uid) {
      throw new Error(global.i18next.t('formDataService.updateDataFail'));
    }

    const allRowUuids = await this.distinct(nocodeId, tableUID, uuidField.uid, {
      scope: "main",
    });
    const uuidList = Array.isArray(allRowUuids) ? allRowUuids.filter(Boolean) : [];
    if (!uuidList.length) {
      return {
        success: true,
        data: {
          fieldUID,
          totalCount: 0,
          changedCount: 0,
          updatedCount: 0,
          batchCount: 0,
        }
      };
    }

    const isMarkdownEditor = targetFieldInfo.targetField.meta?.extra?.widgetType === FormWidgetType.MARKDOWN_EDITOR;
    const fieldUIDParts = String(fieldUID).split(".");
    const isSubTableMarkdownEditor = isMarkdownEditor && fieldUIDParts.length === 2;
    const formulaFields = isMarkdownEditor
      ? []
      : this.buildRecalculateFormulaFields(table, formData, targetFieldInfo.targetField);
    const compareFieldUIDs = isMarkdownEditor
      ? [isSubTableMarkdownEditor ? fieldUIDParts[0] as FieldUID : targetFieldInfo.targetField.uid]
      : this.normalizeRecalculateCompareFieldUIDs(formulaFields.map(field => field.uid as FieldUID));
    let changedCount = 0;
    let updatedCount = 0;
    let batchCount = 0;

    for (let i = 0; i < uuidList.length; i += this.recalculateBatchSize) {
      const batchUuids = uuidList.slice(i, i + this.recalculateBatchSize);
      if (!batchUuids.length) continue;
      batchCount += 1;

      const [bucket] = await this.getData(nocodeId, [tableUID], {
        scope: "main",
        fillSubTable: true,
        formatData: !isMarkdownEditor,
        filters: {
          [tableUID]: [{
            [uuidField.uid]: {
              $in: batchUuids,
            }
          }]
        },
      });
      const rows = bucket?.rows || [];
      if (!rows.length) continue;

      const originalRows = deepClone(rows);
      if (isMarkdownEditor) {
        const targetFormat = targetFieldInfo.targetField.meta?.subType === "html" ? "html" : "markdown";
        if (isSubTableMarkdownEditor) {
          const [parentFieldUID, subFieldUID] = fieldUIDParts;
          rows.forEach((row) => {
            const subRows = Array.isArray(row[parentFieldUID]) ? row[parentFieldUID] : [];
            subRows.forEach((subRow) => {
              subRow[subFieldUID] = convertMarkdownEditorValue(subRow[subFieldUID], targetFormat);
            });
          });
        } else {
          rows.forEach((row) => {
            row[targetFieldInfo.targetField.uid] = convertMarkdownEditorValue(
              row[targetFieldInfo.targetField.uid],
              targetFormat,
            );
          });
        }
      } else {
        rowsDefaultValueCalculation(rows, { formulaFields, defaultFields: [] }, table, formData);
      }
      const changedRows = this.pickChangedRows(originalRows, rows, compareFieldUIDs);
      if (!changedRows.length) continue;

      changedCount += changedRows.length;
      await this.tryUpdateData(
        formData,
        nocodeId,
        tableUID,
        changedRows,
        [[formData.uid, tableUID, uuidField.uid]],
        null,
        {
          triggerTodo: false,
        },
        {},
        isMarkdownEditor ? [fieldUID as ViewActionFieldId] : [],
      );
      updatedCount += changedRows.length;
    }

    return {
      success: true,
      data: {
        fieldUID,
        totalCount: uuidList.length,
        changedCount,
        updatedCount,
        batchCount,
      }
    };
  }

  async tryUpdateData(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: any[],
    keys: OptionFieldUID[],
    stage: FormDataStage = null,
    options?: TriggerOptions,
    uniqueValidation: UniqueValidationOptions = {},
    updateFieldIds: ViewActionFieldId[] = [],
    viewActionContext?: ExecuteViewActionEditContext,
  ) {
    let table = formData.tables.find(table => tableUID == table.uid);
    const keyFieldIds = keys.map(key => key[2]).filter(Boolean);
    const currentRows = table ? await this.loadRowsByKeys(formData, nocodeId, table, rows, keys, "main") : [];
    const currentRowsMap = new Map<string, Row>();
    for (const currentRow of currentRows) {
      currentRowsMap.set(this.buildRowKeySignature(keyFieldIds, currentRow), currentRow);
    }
    const resolvedRows = rows.map(row => currentRowsMap.get(this.buildRowKeySignature(keyFieldIds, row)) || row);

    await this.validateDataOwnerUpdatePermission(formData, nocodeId, table, rows, keyFieldIds, options);
    if (!table.meta.extra?.primaryTable && options?.validatePermission !== false) {
      const createOwnerField = getCreateOwnerSystemField(table.fields);
      const owners = resolvedRows.map(row => row[createOwnerField?.uid])?.filter(Boolean);
      const stageField = table.fields.find(field => field.meta.name === SystemField.DATA_STAGE);
      const isDraft = resolvedRows.every(row => (row[stageField?.uid] === FormDataStage.DRAFT));
      if (isDraft && stage === FormDataStage.NORMAL) {
        const isValid = await this.validateAddPermission(nocodeId, tableUID);
        if (!isValid) {
          throw new Error(global.i18next.t('formDataService.noPerm'));
        }
      } else {
        const ownerGroup = await this.getPermissionOwnerGroup(nocodeId, table.uid, PermissionCategory.UPDATE);
        if (ownerGroup !== "all") {
          const matchedIndexes = await this.resolveRowsMatchedUpdatePermissionIndexes(
            nocodeId,
            table,
            resolvedRows,
            resolvedRows.map((_, index) => index),
            keyFieldIds,
            ownerGroup,
            {
              ignoreDataStatus: options?.ignoreUpdatePermissionDataStatus,
            },
          );
          if (matchedIndexes.length < resolvedRows.length) {
            throw new Error(global.i18next.t('formDataService.noPerm'));
          }
        }
      }
    }
    const rollbackRows = options?.stashFlow
      ? await this.fillSubFormField(
          await this.loadRowsByKeys(formData, nocodeId, table, rows, keys),
          nocodeId,
          table,
          formData,
          {},
          false,
          false,
          "main",
          true,
        )
      : [];
    if (options?.stashFlow) {
      const prepared = await this.prepareUpdateRowsForMutation(
        formData,
        nocodeId,
        tableUID,
        rows,
        keys,
        stage,
        {
          validateCurrentTable: true,
          ...(uniqueValidation || {}),
        },
        updateFieldIds,
        viewActionContext,
      );
      await this.runWithSubFormUniqueGuard(formData, nocodeId, prepared.table, rows, prepared.uniqueValidation, async () => {
        for (const { field, tableUID: subTableUID } of prepared.subTableUIDs) {
          await this.ensureSubmittedSubTableRowsStillValid(
            formData,
            nocodeId,
            prepared.table,
            rows,
            field,
            subTableUID,
            "main",
            this.getSubTableUpdateFieldIds(prepared.subTableUpdateFieldMap, field.uid),
          );
        }
        return true;
      });
      const stashRow = rows?.[0];
      const uuidField = getUUIDSystemField(table.fields);
      const mergedRow = {
        ...(rollbackRows?.[0] || {}),
        ...(stashRow || {}),
        [SystemField.UUID]: stashRow?.[uuidField?.uid] || stashRow?.[SystemField.UUID] || rollbackRows?.[0]?.[uuidField?.uid] || rollbackRows?.[0]?.[SystemField.UUID],
      };
      const triggerResult = await this.formFlowService.createDataChangeStashTodo(
        nocodeId,
        tableUID,
        mergedRow,
        DataChangeType.EDIT,
        options.triggerContext,
      );
      if (options.crossAppTriggerResult) {
        Object.assign(options.crossAppTriggerResult, triggerResult);
      }
      if (!triggerResult?.triggered) {
        throw new Error(global.i18next.t('formFlowService.stashEntryInvalid'));
      }
      return {
        tableName: table.alias || table.meta?.name || tableUID,
        data: [mergedRow],
        success: true,
      } as HandleDataResult;
    }
    const res = await this.updateData(formData, nocodeId, tableUID, rows, keys, stage, "main", uniqueValidation, updateFieldIds, viewActionContext);
    const resolvedOptions = merge({ triggerTodo: true, source: DataChangeType.EDIT }, options || {});
    resolvedOptions.beforeMutationRows ||= deepClone(currentRows);
    if (options) {
      options.beforeMutationRows ||= deepClone(currentRows);
    }
    if (!resolvedOptions.deferPostMutation) {
      try {
        await this.runPostMutationTasks(nocodeId, tableUID, res.data, resolvedOptions.source, resolvedOptions, resolvedOptions.failOnPostMutationError === true);
      } catch (err) {
        throw this.markMutationCommittedError(err);
      }
    }
    return res;
  }

  async updateData(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: string,
    rows: any[],
    keys: OptionFieldUID[],
    stage: FormDataStage = null,
    scope: FormDataStoreScope = "main",
    uniqueValidation: UniqueValidationOptions = {},
    updateFieldIds: ViewActionFieldId[] = [],
    viewActionContext?: ExecuteViewActionEditContext,
  ) {
    const {
      table,
      preparedRows,
      uniqueValidation: resolvedUniqueValidation,
      subTableUIDs,
      subTableUpdateFieldMap,
      effectiveUpdateFieldIds,
    } = await this.prepareUpdateRowsForMutation(
      formData,
      nocodeId,
      tableUID as TableUID,
      rows,
      keys,
      stage,
      {
        validateCurrentTable: scope !== "draft" && stage !== FormDataStage.DRAFT,
        ...(uniqueValidation || {}),
      },
      updateFieldIds,
      viewActionContext,
    );
    uniqueValidation = resolvedUniqueValidation;
    if (table) {
      const projectionRows = scope === "main"
        ? await this.resolveScheduledProjectionRows(nocodeId, formData, table, rows, preparedRows, keys, scope)
        : rows;
      const projectionChanges = scope === "main"
        ? await this.stageScheduledProjectionChanges(nocodeId, table, projectionRows)
        : [];
      let mutationCommitted = false;
      try {
        const allowedUpdateFieldKeys = this.buildAllowedUpdateFieldKeys(table, effectiveUpdateFieldIds);
        const originalRows = this.shouldRebuildSubTableDeduplication(table, scope, uniqueValidation)
          ? await this.loadRowsByKeys(formData, nocodeId, table, rows, keys, scope)
          : [];
        const fieldUIDs = keys?.map(key => key[2]) || [];
        const fieldNames = table.fields.filter(field => fieldUIDs.includes(field.uid)).map(field => field.meta.name);
        const forceChangeRows = uniqueValidation.skipSubTableSync
          ? []
          : rows.map(row => subTableUIDs.some(({ field }) => {
            return [field.uid, field.meta?.uid]
              .filter(Boolean)
              .some(fieldId => Object.prototype.hasOwnProperty.call(row, fieldId));
          }));
        let changedRows: Row[] = [];
        const res = await this.runWithSubFormUniqueGuard(formData, nocodeId, table, rows, uniqueValidation, async () => {
          if (!uniqueValidation.skipSubTableSync) {
            for (const { field, tableUID: subTableUID } of subTableUIDs) {
              await this.ensureSubmittedSubTableRowsStillValid(
                formData,
                nocodeId,
                table,
                rows,
                field,
                subTableUID,
                scope,
                this.getSubTableUpdateFieldIds(subTableUpdateFieldMap, field.uid),
              );
            }
          }

          const updateRes = await this._updateData(formData.options, nocodeId, table.meta.uid, preparedRows, fieldNames, scope, {
            fixedUpdateTime: uniqueValidation.fixedUpdateTime,
            restoreFromSnapshot: uniqueValidation.restoreFromSnapshot,
            allowedUpdateFieldKeys,
            forceChangeRows,
          });
          if (!updateRes?.success) {
            return updateRes;
          }

          const updatedRows = updateRes.data ?? [];
          const changedRowIndexes = updateRes.changedRowIndexes || [];
          changedRows = changedRowIndexes
            .map(index => rows[index])
            .filter(Boolean);
          mutationCommitted = updatedRows.length > 0;
          if (updatedRows.length > 0 && !uniqueValidation.skipSubTableSync) {
            for (const { field, tableUID: subTableUID } of subTableUIDs) {
              await this.syncSubTableFieldRows(formData, nocodeId, table, changedRows, field, subTableUID, stage, scope, {
                skipValidation: true,
                skipLock: true,
                skipSubTableDeduplicationRebuild: true,
              }, this.getSubTableUpdateFieldIds(subTableUpdateFieldMap, field.uid));
            }
          }

          const changedOriginalRows = originalRows.filter(originalRow => changedRows.some(row => {
            const comparableFieldUIDs = fieldUIDs.filter(fieldUID => Object.prototype.hasOwnProperty.call(row, fieldUID));
            return comparableFieldUIDs.length > 0
              && comparableFieldUIDs.every(fieldUID => equals(originalRow?.[fieldUID], row?.[fieldUID]));
          }));
          const relationValues = this.collectSubTableRelationValues(table, changedRows, changedOriginalRows);
          if (updatedRows.length > 0 && relationValues.length > 0) {
            await this.rebuildSubTableDeduplicatedRows(formData, nocodeId, table, relationValues, scope, {
              skipLock: true,
              skipSubTableDeduplicationRebuild: uniqueValidation.skipSubTableDeduplicationRebuild,
            });
          }

          return updateRes;
        });
        if (!res?.success) {
          const error = new Error((res as HandleMutationDataResult)?.errorMessage || global.i18next.t('formDataService.updateDataFail'));
          if ((res as HandleMutationDataResult)?.mutationCommitted === true) {
            throw this.markMutationCommittedError(error);
          }
          throw error;
        }

        if(res.success && scope === "main" && changedRows.length){
          const changedProjectionRows = (res.changedRowIndexes || [])
            .map(index => projectionRows[index])
            .filter(Boolean);
          await this.afterUpdateData(nocodeId, table, changedProjectionRows, projectionChanges);
        }
        delete (res as HandleMutationDataResult).changedRowIndexes;
        return res;
      } catch (err) {
        if (mutationCommitted) {
          throw this.markMutationCommittedError(err);
        }
        throw err;
      }
    }
  }

  private async validateUpdatePermission(
    nocodeId: string,
    table: Table,
    dataOwners: string[],
    fieldIds: FieldUID[],
    rows: any[],
    options: {
      ignoreDataStatus?: boolean,
    } = {},
  ) {
    const account = await this.getAccount();
    if (isSystemAdminAccount(account)) return true;
    const res = await this.getPermissionOwnerGroup(nocodeId, table.uid, PermissionCategory.UPDATE);
    if (res === "all") return true;

    const orQuery = await this.ownerGroupToQuery(res, table, undefined, {
      ignoreStageCondition: options.ignoreDataStatus,
      fallbackToPermissionStages: true,
    });
    if (isEmpty(orQuery)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    const queryConditions = rows.map(row => {
      const query: WhereCondition = {};
      for (const fieldId of fieldIds) {
        if (fieldId in row) {
          query[fieldId] = row[fieldId];
        }
      }
      return query;
    }).filter(query => !isEmpty(query));
    if (!queryConditions.length) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    const uuidField = getUUIDSystemField(table.fields);
    const value = await this.distinct(nocodeId, table.uid, uuidField.uid, {
      filters: {
        [table.uid]: [{
          $and: [
            { $or: orQuery },
            { $or: queryConditions },
          ]
        }]
      }
    }, false);
    const count = value.reduce((prev, item) => prev + item.count, 0);
    if (count < rows.length) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    return true;
    // const owners = res.map(item => item.users).flat();
    // const hasAll = owners.some(item => item === "all");
    // const hasProcess = res.some(item => item.hasProcess);

    // const isOwnerValid = dataOwners.every(owner => owners.includes(owner));
    // if (isEmpty(owners) && !hasProcess) { 
    //   throw new Error('权限不足');
    // } else if (!isEmpty(owners) && !hasProcess) {
    //   if (!isOwnerValid) {
    //     throw new Error('权限不足');
    //   }
    // } else if (hasProcess) {
    //   const inProcessRows = await this.checkRowInProcess(nocodeId, table.uid, fieldIds, rows);
    //   const isAllProcessRows = inProcessRows.length === rows.length;
    //   if (isEmpty(owners)) {
    //     if (!isAllProcessRows) {
    //       throw new Error('权限不足');
    //     }
    //     return true;
    //   }
    //   return isOwnerValid || isAllProcessRows;
    // }
  }

  private getSystemFieldCandidateKeys(fieldKeys: Array<string | undefined>) {
    return Array.from(new Set(fieldKeys.filter((fieldKey): fieldKey is string => Boolean(fieldKey))));
  }

  private getCreateOwnerCandidateKeys(table?: Table | null) {
    const createOwnerField = getCreateOwnerSystemField(table?.fields || []);
    return this.getSystemFieldCandidateKeys([
      SystemField.CREATE_OWNER,
      createOwnerField?.uid,
      createOwnerField?.meta?.uid,
      createOwnerField?.meta?.name,
    ]);
  }

  private getDataOwnerCandidateKeys(table?: Table | null) {
    if (!table || !isDataOwnerEnabledTable(table)) {
      return [];
    }
    const dataOwnerField = getDataOwnerSystemField(table?.fields || []);
    return this.getSystemFieldCandidateKeys([
      SystemField.DATA_OWNER,
      dataOwnerField?.uid,
      dataOwnerField?.meta?.uid,
      dataOwnerField?.meta?.name,
    ]);
  }

  private extractRowValueByCandidateKeys(row: Row | undefined, candidateKeys: string[]) {
    if (!row || !candidateKeys.length) {
      return undefined;
    }
    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        return row[key];
      }
    }
    return undefined;
  }

  private buildRowKeySignature(fieldIds: FieldUID[], row: Row = {}) {
    return JSON.stringify(fieldIds.map(fieldId => row?.[fieldId] ?? null));
  }

  private pickRowsByIndexes<T>(rows: T[] = [], indexes: number[] = []) {
    return indexes
      .map(index => rows[index])
      .filter((row): row is T => row !== undefined);
  }

  private async resolveRowsMatchedDeletePermissionIndexes(
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    indexes: number[] = [],
    fieldIds: FieldUID[] = [],
    ownerGroup: Exclude<Awaited<ReturnType<typeof this.getPermissionOwnerGroup>>, "all"> = [],
  ) {
    if (!indexes.length) {
      return [];
    }

    const account = await this.getAccount();
    if (isSystemAdminAccount(account)) {
      return [...indexes];
    }

    const queryRows = this.pickRowsByIndexes(rows, indexes);
    const orQuery = await this.ownerGroupToQuery(ownerGroup, table);
    if (isEmpty(orQuery)) {
      return [];
    }

    const queryConditions = queryRows.map(row => {
      const query: WhereCondition = {};
      for (const fieldId of fieldIds) {
        if (fieldId in row) {
          query[fieldId] = row[fieldId];
        }
      }
      return isEmpty(query) ? null : query;
    }).filter(Boolean) as WhereCondition[];

    if (!queryConditions.length) {
      return [];
    }

    // 用现有数据权限查询能力反查出真正命中权限规则的行，再映射回本次删除请求中的索引。
    const uuidField = getUUIDSystemField(table.fields);
    const matched = await this.distinct(nocodeId, table.uid, uuidField.uid, {
      filters: {
        [table.uid]: [{
          $and: [
            { $or: orQuery },
            { $or: queryConditions },
          ],
        }],
      },
    }, false).catch(() => []);
    const matchedUuidSet = new Set(
      matched
        .map(item => item?.value)
        .filter(Boolean)
        .map(value => String(value)),
    );
    return indexes.filter(index => {
      const row = rows[index];
      const rowUuid = row?.[uuidField.uid] ?? row?.[SystemField.UUID];
      return rowUuid !== undefined && rowUuid !== null && matchedUuidSet.has(String(rowUuid));
    });
  }

  private async resolveRowsMatchedUpdatePermissionIndexes(
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    indexes: number[] = [],
    fieldIds: FieldUID[] = [],
    ownerGroup: Exclude<Awaited<ReturnType<typeof this.getPermissionOwnerGroup>>, "all"> = [],
    options: {
      ignoreDataStatus?: boolean,
    } = {},
  ) {
    if (!indexes.length) {
      return [];
    }

    const account = await this.getAccount();
    if (isSystemAdminAccount(account)) {
      return [...indexes];
    }

    const queryRows = this.pickRowsByIndexes(rows, indexes);
    const orQuery = await this.ownerGroupToQuery(ownerGroup, table, undefined, {
      ignoreStageCondition: options.ignoreDataStatus,
      fallbackToPermissionStages: true,
    });
    if (isEmpty(orQuery)) {
      return [];
    }

    const queryConditions = queryRows.map(row => {
      const query: WhereCondition = {};
      for (const fieldId of fieldIds) {
        if (fieldId in row) {
          query[fieldId] = row[fieldId];
        }
      }
      return isEmpty(query) ? null : query;
    }).filter(Boolean) as WhereCondition[];

    if (!queryConditions.length) {
      return [];
    }

    const uuidField = getUUIDSystemField(table.fields);
    const matched = await this.distinct(nocodeId, table.uid, uuidField.uid, {
      filters: {
        [table.uid]: [{
          $and: [
            { $or: orQuery },
            { $or: queryConditions },
          ]
        }]
      }
    }, false).catch(() => []);
    const matchedUuidSet = new Set(
      matched
        .map(item => item?.value)
        .filter(Boolean)
        .map(value => String(value)),
    );
    return indexes.filter(index => {
      const row = rows[index];
      const rowUuid = row?.[uuidField.uid] ?? row?.[SystemField.UUID];
      return rowUuid !== undefined && rowUuid !== null && matchedUuidSet.has(String(rowUuid));
    });
  }

  private createDeleteSummary(
    table: Table,
    successRows: DataRows = [],
    failedRows: DataRows = [],
    permissionDeniedRows: DataRows = [],
    extra: Partial<TryDeleteDataResult> = {},
  ): TryDeleteDataResult {
    return {
      tableName: table?.alias || table?.meta?.name || "",
      success: successRows.length > 0 || failedRows.length === 0,
      data: successRows,
      mutationApplied: successRows.length > 0 ? (extra.mutationApplied ?? true) : (extra.mutationApplied ?? false),
      partialSuccess: successRows.length > 0 && failedRows.length > 0,
      successCount: successRows.length,
      failedCount: failedRows.length,
      permissionDeniedCount: permissionDeniedRows.length,
      successRows,
      failedRows,
      permissionDeniedRows,
      ...extra,
    };
  }

  private async findCurrentRowsByKeys(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[] = [],
    fieldIds: FieldUID[] = [],
  ) {
    const queryConditions = rows.map(row => {
      const query: WhereCondition = {};
      for (const fieldId of fieldIds) {
        if (Object.prototype.hasOwnProperty.call(row, fieldId)) {
          query[fieldId] = row[fieldId];
        }
      }
      return isEmpty(query) ? null : query;
    }).filter(Boolean) as WhereCondition[];

    if (!queryConditions.length) {
      return new Map<string, Row>();
    }

    const buckets = await this._getData(formData, [table.uid], nocodeId, {
      filters: {
        [table.uid]: [{
          $or: queryConditions,
        }]
      },
      enabledStage: false,
    });
    const currentRows = buckets?.[0]?.rows || [];
    const currentRowsMap = new Map<string, Row>();

    for (const currentRow of currentRows) {
      currentRowsMap.set(this.buildRowKeySignature(fieldIds, currentRow), currentRow);
    }

    return currentRowsMap;
  }

  private hasDataOwnerMutation(table: Table, rows: any[] = []) {
    const candidateKeys = new Set<string>(this.getDataOwnerCandidateKeys(table));
    if (!candidateKeys.size) {
      return false;
    }
    return rows.some(row => Object.keys(row || {}).some(key => candidateKeys.has(key)));
  }

  private async validateDataOwnerUpdatePermission(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: any[] = [],
    keyFieldIds: FieldUID[] = [],
    options?: TriggerOptions,
  ) {
    if (!table || !isDataOwnerEnabledTable(table) || !this.hasDataOwnerMutation(table, rows)) {
      return;
    }

    const account = await this.getAccount();
    if (isSystemAdminAccount(account) || options?.allowDataOwnerUpdate) {
      return;
    }

    const dataOwnerCandidateKeys = this.getDataOwnerCandidateKeys(table);
    const createOwnerCandidateKeys = this.getCreateOwnerCandidateKeys(table);
    const currentRowsMap = await this.findCurrentRowsByKeys(formData, nocodeId, table, rows, keyFieldIds);
    const hasRealMutation = rows.some(row => {
      const hasDataOwnerKey = dataOwnerCandidateKeys.some(key => Object.prototype.hasOwnProperty.call(row || {}, key));
      if (!hasDataOwnerKey) {
        return false;
      }

      const currentRow = currentRowsMap.get(this.buildRowKeySignature(keyFieldIds, row));
      if (!currentRow) {
        return true;
      }

      const nextDataOwnerValue = this.extractRowValueByCandidateKeys(row, dataOwnerCandidateKeys);
      const currentDataOwnerValue = this.extractRowValueByCandidateKeys(currentRow, dataOwnerCandidateKeys);
      const currentOwnerBaseline = [undefined, null, ""].includes(currentDataOwnerValue as any)
        ? this.extractRowValueByCandidateKeys(currentRow, createOwnerCandidateKeys)
        : currentDataOwnerValue;

      return JSON.stringify(nextDataOwnerValue ?? null) !== JSON.stringify(currentOwnerBaseline ?? null);
    });

    if (!hasRealMutation) {
      return;
    }

    throw new Error(global.i18next.t('formDataService.noPerm'));
  }

  private async _deleteData(options: FormDataOptions, nocodeId: string, tableUID: string, rows: DataRows, keys: string[], scope: FormDataStoreScope = "main"): Promise<HandleDataResult> {
    const table = options.tables.find(table => table.uid === tableUID);

    const queryCondition = rows.map(row => {
      const query = {};
      for (const key of keys) {
        if (key in row) {
          query[key] = row[key];
        }
      }
      return query;
    });

    const query = {
      $or: queryCondition,
    }
    try {
      const db = await this.dbManager.getDB(nocodeId, table, scope);
      await this.runWithTableMutationLock(nocodeId, tableUID, scope, async () => {
        await db.remove(query, { multi: true });
      });
      return {
        tableName: table.tableName,
        data: rows,
        success: true,
      }
    } catch (err) {
      this.logger.error(`Delete form data failed: ${table?.tableName || tableUID}`, err instanceof Error ? err.stack : String(err));
      return {
        tableName: table.tableName,
        data: [],
        errorMessage: this.getErrorMessage(err),
        success: false,
      } as HandleDataResult & { errorMessage?: string }
    }
  }

  async tryDeleteAllData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, options?: TriggerOptions): Promise<TryDeleteDataResult> {
    const [ bucket ] = await this.getData(nocodeId, [tableUID], {
      stage: this.getDefaultReadableStageCondition(),
    });
    const rows = bucket.rows;
    const table = formData.tables.find(table => tableUID == table.uid);
    const uuidField = getUUIDSystemField(table.fields);
    const keys: OptionFieldUID[] = [[formData.uid, tableUID, uuidField.uid]];
    // 清空操作前面已经读取了当前行，直接复用，避免删除链路再次全表查询。
    return await this.tryDeleteData(formData, nocodeId, tableUID, rows, keys, {
      ...(options || {}),
      currentRows: rows,
    });
  }

  /**
   * Delete-all worker primitive. It keeps each read, permission check and
   * durable flow snapshot bounded so a large table is never materialized in
   * the Electron main process at once.
   */
  async tryDeleteAllDataPage(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    options?: TriggerOptions,
    afterUUID = "",
    limit = FLOW_TRIGGER_EXECUTION_BATCH_SIZE,
  ): Promise<DeleteAllDataPageResult> {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      return {
        ...this.createDeleteSummary(table, [], [], [], {
          tableName: tableUID,
          success: true,
        }),
        scannedCount: 0,
        nextCursor: afterUUID,
      };
    }
    const uuidField = getUUIDSystemField(table.fields);
    const [bucket] = await this.getData(nocodeId, [tableUID], {
      stage: this.getDefaultReadableStageCondition(),
      filters: afterUUID ? { [tableUID]: [{ [uuidField.uid]: { $gt: afterUUID } }] } : undefined,
      orderBy: { [uuidField.uid]: SortType.ASC },
      limit: Math.max(1, Math.min(FLOW_TRIGGER_EXECUTION_BATCH_SIZE, limit)),
    });
    const rows = bucket?.rows || [];
    if (!rows.length) {
      return {
        ...this.createDeleteSummary(table, [], [], [], {
          tableName: table.alias || tableUID,
          success: true,
        }),
        scannedCount: 0,
        nextCursor: afterUUID,
      };
    }
    const keys: OptionFieldUID[] = [[formData.uid, tableUID, uuidField.uid]];
    const result = await this.tryDeleteData(formData, nocodeId, tableUID, rows, keys, {
      ...(options || {}),
      currentRows: rows,
    });
    return {
      ...result,
      scannedCount: rows.length,
      nextCursor: String(rows[rows.length - 1]?.[uuidField.uid] || afterUUID),
    };
  }

  async tryDeleteData(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: any[],
    keys: OptionFieldUID[],
    options?: TryDeleteDataOptions,
    scope: FormDataStoreScope = "main",
  ): Promise<TryDeleteDataResult> {
    const table = formData.tables.find(table => tableUID == table.uid);
    if (!table || isEmpty(rows)) {
      return this.createDeleteSummary(table, [], [], [], {
        tableName: table?.alias || tableUID,
        success: true,
      });
    }

    const keyFieldIds = keys.map(key => key[2]).filter(Boolean);
    // 删除前先回表取当前真实数据，避免只依赖前端传来的局部字段做权限和流程判断。
    const suppliedCurrentRows = options?.currentRows;
    const currentRows = suppliedCurrentRows || await this.loadRowsByKeys(formData, nocodeId, table, rows, keys, scope);
    const currentRowsMap = new Map<string, Row>();
    for (const currentRow of currentRows) {
      currentRowsMap.set(this.buildRowKeySignature(keyFieldIds, currentRow), currentRow);
    }
    // 之后统一基于 resolvedRows 继续处理，尽量保证权限判断、流程判断和实际删除对象一致。
    const resolvedRows = rows.map(row => currentRowsMap.get(this.buildRowKeySignature(keyFieldIds, row)) || row);
    const resolvedIndexes = resolvedRows.map((_, index) => index);
    // “流程中数据”按流程运行态判断，而不是按回收站/删除阶段判断。
    const inProcessIndexes = resolvedRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const status = this.getRowSystemFieldValue(table, row, SystemField.STATUS);
        if (status !== ProcessNodeStatus.IN_PROGRESS) {
          return false;
        }
        const currentNodeValue = this.getRowSystemFieldValue(table, row, SystemField.CURRENT_NODE);
        return Array.isArray(currentNodeValue)
          ? currentNodeValue.length > 0
          : Boolean(currentNodeValue);
      })
      .map(item => item.index);
    const inProcessIndexSet = new Set(inProcessIndexes);
    const notInProcessIndexes = resolvedIndexes.filter(index => !inProcessIndexSet.has(index));

    let permissionDeniedIndexes: number[] = [];
    let executableIndexes = [...resolvedIndexes];

    if (!table.meta.extra?.primaryTable && options?.validatePermission !== false) {
      const ownerGroup = await this.getPermissionOwnerGroup(nocodeId, table.uid, PermissionCategory.DELETE);
      if (ownerGroup === "all") {
        executableIndexes = [...resolvedIndexes];
      } else {
        // 按数据状态拆分删除权限：普通数据只看 finished 权限，流程中数据只看 processing 权限。
        const finishedOwnerGroup = ownerGroup.filter(item => (item?.stages || []).includes(FormDataStage.NORMAL));
        const processingOwnerGroup = ownerGroup.filter(item => (
          [FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING].some(stage => (item?.stages || []).includes(stage))
        ));

        const matchedFinishedIndexes = isEmpty(finishedOwnerGroup)
          ? []
          : await this.resolveRowsMatchedDeletePermissionIndexes(
            nocodeId,
            table,
            resolvedRows,
            notInProcessIndexes,
            keyFieldIds,
            finishedOwnerGroup,
          );
        const matchedProcessingIndexes = isEmpty(processingOwnerGroup)
          ? []
          : await this.resolveRowsMatchedDeletePermissionIndexes(
            nocodeId,
            table,
            resolvedRows,
            inProcessIndexes,
            keyFieldIds,
            processingOwnerGroup,
          );

        executableIndexes = Array.from(new Set([...matchedFinishedIndexes, ...matchedProcessingIndexes]));
        const executableIndexSet = new Set(executableIndexes);
        permissionDeniedIndexes = resolvedIndexes.filter(index => !executableIndexSet.has(index));
      }
    }

    const mutationOptions = { ...(options || {}) } as TryDeleteDataOptions;
    delete mutationOptions.currentRows;
    options = merge({ triggerTodo: true, source: DataChangeType.DELETE }, mutationOptions);
    const executableInProcessIndexes = executableIndexes.filter(index => inProcessIndexSet.has(index));
    const executableNotInProcessIndexes = executableIndexes.filter(index => !inProcessIndexSet.has(index));
    const executableRows = this.pickRowsByIndexes(resolvedRows, executableIndexes);
    const executableInProcessRows = this.pickRowsByIndexes(resolvedRows, executableInProcessIndexes);
    const executableNotInProcessRows = this.pickRowsByIndexes(resolvedRows, executableNotInProcessIndexes);
    const permissionDeniedRows = this.pickRowsByIndexes(resolvedRows, permissionDeniedIndexes);
    let delegatedRows: DataRows = [];
    let mutationAppliedRows: DataRows = [];

    // 只有确认具备流程中删除权限的数据，才允许先结束流程再继续删除。
    if (executableInProcessRows.length && !options.skipCancelInProgressTodos) {
      await this.formFlowService.cancelInProgressTodosBeforeDelete(formData, nocodeId, tableUID, executableInProcessRows);
    }

    // 删除流程需要保留原数据供后台流程读取；先把命中流程的数据标记为排队中，再执行其余删除。
    const queueState = options.deferPostMutation && options.triggerTodo
      ? options.queueState !== undefined
        ? options.queueState
        : await this.prepareDataChangeFlowQueue(
        nocodeId,
        tableUID,
        executableNotInProcessRows,
        DataChangeType.DELETE,
        options.triggerContext,
      )
      : null;
    if (options.deferPostMutation && options.triggerTodo && queueState === undefined) {
      throw new Error(`Prepare delete flow queue failed: ${nocodeId}:${tableUID}`);
    }
    if (queueState?.previousRows?.length) {
      const queuedUUIDs = new Set(queueState.previousRows.map(row => String(
        this.getRowSystemFieldValue(table, row, SystemField.UUID) || "",
      )));
      delegatedRows = executableNotInProcessRows.filter(row => queuedUUIDs.has(String(
        this.getRowSystemFieldValue(table, row, SystemField.UUID) || "",
      )));
    }

    if (!executableRows.length) {
      return this.createDeleteSummary(table, [], permissionDeniedRows, permissionDeniedRows, {
        mutationApplied: false,
        ...(options.deferPostMutation ? { queueState } : {}),
      });
    }

    if (options.triggerTodo && !options.deferPostMutation) {
      const { newRows } = transformDeleteRows(table, executableNotInProcessRows);
      const triggerResult = await this.formFlowService.tryTriggerTodo(
        nocodeId,
        tableUID,
        newRows,
        options.source,
        options.triggerContext,
        options.importTaskId,
        false,
        {
          ...options,
          beforeMutationRows: deepClone(executableNotInProcessRows),
        },
      ).catch((err) => {
        this.logger.error("Delete: trigger todo error", err)
        if (options.failOnPostMutationError) throw err;
        return {
          triggered: false,
        };
      });
      if (options.crossAppTriggerResult) {
        Object.assign(options.crossAppTriggerResult, triggerResult);
      }
      if (triggerResult.triggered) {
        delegatedRows = [...executableNotInProcessRows];
      }
    }
    // 实际进入删除链路的只包括有权限删除的行，失败行通过摘要单独返回给前端。
    const delegatedRowSet = new Set(delegatedRows);
    const rowsToDelete = options.deferPostMutation
      ? [...executableNotInProcessRows, ...executableInProcessRows]
      : [
        ...executableNotInProcessRows.filter(row => !delegatedRowSet.has(row)),
        ...executableInProcessRows,
      ];
    let res: HandleDataResult;
    try {
      res = rowsToDelete.length
        ? await this.updateRowsStageRecursively(
            formData,
            nocodeId,
            tableUID,
            rowsToDelete,
            keys,
            options.deleteStage || FormDataStage.DELETED,
          )
        : this.createDeleteSummary(table, [], [], [], { mutationApplied: false });
    } catch (error) {
      await this.restoreQueuedDataChangeFlowRows(nocodeId, tableUID, queueState);
      throw error;
    }
    mutationAppliedRows = Array.isArray(res.data) ? res.data : [];
    // 延后触发时，delegatedRows 同时也已完成回收站迁移，避免在成功摘要中重复计数。
    const successRows = options.deferPostMutation
      ? mutationAppliedRows
      : [...delegatedRows, ...mutationAppliedRows];
    const failedRows = [...permissionDeniedRows];
    const resultExtra: Partial<TryDeleteDataResult> & { errorMessage?: string } = {
      data: successRows,
      delegatedToTodo: delegatedRows.length > 0,
      mutationApplied: mutationAppliedRows.length > 0,
      delegatedRows,
      mutationAppliedRows,
      ...(options.deferPostMutation ? { queueState } : {}),
    };
    if (res?.tableName) {
      resultExtra.tableName = res.tableName;
    }
    if (res?.success === false) {
      resultExtra.success = false;
    }
    if ((res as HandleDataResult & { errorMessage?: string })?.errorMessage) {
      resultExtra.errorMessage = (res as HandleDataResult & { errorMessage?: string }).errorMessage;
    }
    return this.createDeleteSummary(table, successRows, failedRows, permissionDeniedRows, {
      ...resultExtra,
    });
  }

  public async restoreDeletedData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[], keys: OptionFieldUID[], scope: FormDataStoreScope = "main") {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table || isEmpty(rows)) {
      return {
        tableName: table?.alias || tableUID,
        data: [],
        success: true,
      } as HandleDataResult;
    }

    if (!table.meta.extra?.primaryTable) {
      const createOwnerField = getCreateOwnerSystemField(table.fields);
      const recycleRows = await this.loadRowsForRecycleMutation(formData, nocodeId, tableUID, rows, keys, FormDataStage.NORMAL, scope);
      if (isEmpty(recycleRows)) {
        return {
          tableName: table.alias || tableUID,
          data: [],
          success: true,
        } as HandleDataResult;
      }
      const owners = recycleRows.map(row => row?.[createOwnerField?.uid]).filter(Boolean);
      await this.validateDeletePermission(nocodeId, table, Array.from(new Set(owners)), keys.map(key => key[2]), recycleRows);
      return await this.updateRowsStageRecursively(formData, nocodeId, tableUID, recycleRows, keys, FormDataStage.NORMAL, scope);
    }

    const recycleRows = await this.loadRowsForRecycleMutation(formData, nocodeId, tableUID, rows, keys, FormDataStage.NORMAL, scope);
    if (isEmpty(recycleRows)) {
      return {
        tableName: table.alias || tableUID,
        data: [],
        success: true,
      } as HandleDataResult;
    }
    return await this.updateRowsStageRecursively(formData, nocodeId, tableUID, recycleRows, keys, FormDataStage.NORMAL, scope);
  }

  public async moveRowsToRecycleBin(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
    keys: OptionFieldUID[],
    scope: FormDataStoreScope = "main",
  ) {
    const recycleRows = await this.loadRowsForRecycleMutation(
      formData,
      nocodeId,
      tableUID,
      rows,
      keys,
      FormDataStage.DELETED,
      scope,
    );
    if (isEmpty(recycleRows)) {
      const table = formData.tables.find(item => item.uid === tableUID);
      return {
        tableName: table?.alias || tableUID,
        data: [],
        success: true,
      } as HandleDataResult;
    }
    return await this.updateRowsStageRecursively(
      formData,
      nocodeId,
      tableUID,
      recycleRows,
      keys,
      FormDataStage.DELETED,
      scope,
    );
  }

  public async purgeDeletedData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[], keys: OptionFieldUID[], scope: FormDataStoreScope = "main") {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table || isEmpty(rows)) {
      return {
        tableName: table?.alias || tableUID,
        data: [],
        success: true,
      } as HandleDataResult;
    }

    const recycleRows = await this.loadRowsForRecycleMutation(formData, nocodeId, tableUID, rows, keys, FormDataStage.NORMAL, scope);
    if (isEmpty(recycleRows)) {
      return {
        tableName: table.alias || tableUID,
        data: [],
        success: true,
      } as HandleDataResult;
    }
    if (!table.meta.extra?.primaryTable) {
      const createOwnerField = getCreateOwnerSystemField(table.fields);
      const owners = recycleRows.map(row => row?.[createOwnerField?.uid]).filter(Boolean);
      await this.validateDeletePermission(nocodeId, table, Array.from(new Set(owners)), keys.map(key => key[2]), recycleRows);
    }
    return await this.deleteData(formData, nocodeId, tableUID, recycleRows, keys, scope);
  }

  public async deleteData(formData: NocodeFormData, nocodeId: string, tableUID: TableUID, rows: any[], keys: OptionFieldUID[], scope: FormDataStoreScope = "main") {
    const table = formData.tables.find(table => tableUID == table.uid);
    if (table) {
      const projectionChanges = scope === "main"
        ? await this.stageScheduledProjectionChanges(nocodeId, table, rows, true)
        : [];
      let mutationCommitted = false;
      try {
        const { newRows, subTableUIDs } = transformDeleteRows(table, rows);
        let fieldNames = [];
        if (keys) {
          const fieldUIDs = keys.map(key => key[2]);
          fieldNames = table.fields.filter(field => fieldUIDs.includes(field.uid)).map(field => deleteDataWithKey(field))
        }

        const res = await this._deleteData(formData.options, nocodeId, table.meta.uid, newRows, fieldNames, scope);
        if (!res?.success) {
          throw new Error((res as HandleDataResult & { errorMessage?: string })?.errorMessage || global.i18next.t('formDataService.delFormDataFail'));
        }

        mutationCommitted = true;
        if(res.success && scope === "main"){
          await this.afterDeleteData(nocodeId, table, rows, projectionChanges);
        }

        const removedRows = res.data;
        if (removedRows.length) {
          for (const subTableUID of subTableUIDs) {
            const relationTable = formData.tables.find(table => table.uid === subTableUID[1]);
            const relationField = relationTable.fields.find(field => field.meta.name === SystemField.KEY);
            const newRows = [];
            for (let i = 0; i < removedRows.length; i++) {
              const removedRow = removedRows[i];
              const uuid = removedRow[SystemField.UUID];
              newRows.push({
                [relationField.uid]: uuid,
              })
            }

            await this.deleteData(formData, nocodeId, subTableUID[1], newRows, [[...subTableUID, relationField.uid]], scope);
          }
        }
        return res;
      } catch (err) {
        if (mutationCommitted) {
          throw this.markMutationCommittedError(err);
        }
        throw err;
      }
    }
  }

  public async deleteDataByUUID(nocodeId: string, tableUID: TableUID, uuid: string) {
    const body = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = body.formData;
    const table = formData.tables.find(t => t.uid === tableUID);
    if (!table) {
      throw new Error(global.i18next.t('formDataService.delFormDataFail'));
    }
    const rows = [{ [SystemField.UUID]: uuid }];
    const projectionChanges = await this.stageScheduledProjectionChanges(nocodeId, table, rows, true);
    const deleteRes = await this._deleteData(formData.options, nocodeId, table.meta.uid, rows, [SystemField.UUID]).catch((err) => {
      this.logger.error(global.i18next.t('formDataService.delFormDataFail'), nocodeId, tableUID, uuid, err);
      throw err;
    });
    if (!deleteRes?.success) {
      throw new Error((deleteRes as HandleDataResult & { errorMessage?: string })?.errorMessage || global.i18next.t('formDataService.delFormDataFail'));
    }
    const subFields = table.fields.filter(field => field.meta?.extra?.subTableUID);
    for (const subField of subFields) {
      const subTableUID = subField.meta.extra.subTableUID;
      const subTable = formData.tables.find(table => table.uid === subTableUID[1]);
      if (!subTable) continue;
      const subDeleteRes = await this._deleteData(formData.options, nocodeId, subTable.meta.uid, [{ [SystemField.KEY]: uuid }], [SystemField.KEY]).catch((err) => {
        this.logger.error(global.i18next.t('formDataService.delSubFormDataFail'), nocodeId, subTableUID, uuid, err);
        throw err;
      });
      if (!subDeleteRes?.success) {
        throw new Error((subDeleteRes as HandleDataResult & { errorMessage?: string })?.errorMessage || global.i18next.t('formDataService.delSubFormDataFail'));
      }
    }
    await this.afterDeleteData(nocodeId, table, rows, projectionChanges);
  }

  private async validateDeletePermission(nocodeId: string, table: Table, dataOwners: string[], fieldIds: FieldUID[], rows: any[]) {
    const account = await this.getAccount();
    if (isSystemAdminAccount(account)) return true;
    const res = await this.getPermissionOwnerGroup(nocodeId, table.uid, PermissionCategory.DELETE);
    if (res === "all") return true;

    const orQuery = await this.ownerGroupToQuery(res, table, undefined, {
      fallbackToPermissionStages: true,
    });
    if (isEmpty(orQuery)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    const queryConditions = rows.map(row => {
      const query: WhereCondition = {};
      for (const fieldId of fieldIds) {
        if (fieldId in row) {
          query[fieldId] = row[fieldId];
        }
      }
      return query;
    });
    const uuidField = getUUIDSystemField(table.fields);
    const value = await this.distinct(nocodeId, table.uid, uuidField.uid, {
      filters: {
        [table.uid]: [{
          $and: [
            { $or: orQuery },
            { $or: queryConditions },
          ]
        }]
      }
    }, false);
    const count = value.reduce((prev, item) => prev + item.count, 0);
    if (count < rows.length) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    return true;


    // const owners = res.map(item => item.users).flat();
    // const isOwnerValid = dataOwners.every(owner => owners.includes(owner));
    // const hasProcess = res.some(item => item.inProcess);

    // if (isEmpty(owners) && !hasProcess) { 
    //   throw new Error('权限不足');
    // } else if (!isEmpty(owners) && !hasProcess) {
    //   if (!isOwnerValid) {
    //     throw new Error('权限不足');
    //   }
    // } else if (hasProcess) {
    //   const inProcessRows = await this.checkRowInProcess(nocodeId, table.uid, fieldIds, rows);
    //   const isAllProcessRows = inProcessRows.length === rows.length;
    //   if (isEmpty(owners)) {
    //     if (!isAllProcessRows) {
    //       throw new Error('权限不足');
    //     }
    //     return true;
    //   }
    //   return isOwnerValid || isAllProcessRows;
    // }
  }

  async syncTableColumns(formData: NocodeFormData, tableUID: string, columns: FormDataColumn[]) {
    const uid = formData.tables.find(table => table.uid === tableUID)?.meta?.uid;
    const table = formData.options.tables.find(table => table.uid === uid);
    if (!table) return formData;
    const includeDataOwner = isDataOwnerEnabledTable(table);
    const defaultColumns = systemColumnUtil.getSystemColumns({
      includeDataOwner,
    });
    const currentDefaultColumns = table.columns.filter(column => column.isSystem && (includeDataOwner || column.name !== SystemField.DATA_OWNER));
    const needAddColumns = defaultColumns.filter(c => !currentDefaultColumns.some(column => column.name === c.name));
    table.columns = [...currentDefaultColumns, ...needAddColumns, ...columns];
    return formData;
  }

  private getUniqueName(tableName: string, tables: FormDataTable[]) {
    tableName = tableName || global.i18next.t('formDataService.myForm');
    if (!tables) return tableName;
    const existingNames = new Set(tables.map(t => t.tableName));
    if (!existingNames.has(tableName)) return tableName;
    let index = 1;
    while (existingNames.has(`${tableName}${index}`)) {
      index++;
    }
    return `${tableName}${index}`;
  }

  async addTable(formData: NocodeFormData, name: string, extra?: any) {
    const uid = unique();
    const tableName = this.getUniqueName(name, formData?.options?.tables);
    const _table: FormDataTable = {
      uid: extra?.['__metaUID__'] || uid,
      tableName,
      columns: systemColumnUtil.getSystemColumns({
        includeDataOwner: isDataOwnerEnabledTable({ extra }),
      }),
      extra,
    }
    if (!formData) {
      formData = {
        uid: `c_${unique()}`,
        tables: [],
        formOptions: {},
        options: {
          tables: [_table]
        },
      }
    } else {
      formData.options.tables.push(_table);
    }
    const [ parsedTable ] = await parseTables([{
      tableName,
      tableUid: _table.uid,
      columns: _table.columns,
      extra: _table.extra,
    }]);
    const table: Table = {
      uid: `t_${unique()}`,
      ...parsedTable,
      alias: tableName !== name ? name : tableName,
      fields: parsedTable.fields.map(field => ({ ...field, uid: `f_${unique()}` })),
      publish: {
        sharing: true
      }
    };
    formData.tables.push(table);
    const uuidField = table.fields.find(field => field.meta?.name === SystemField.UUID);
    if (uuidField) {
      formData.metas = formData.metas || {};
      formData.metas[table.uid] = {
        ...(formData.metas[table.uid] || {}),
        hiddenColumns: Array.from(new Set([
          ...(formData.metas[table.uid]?.hiddenColumns || []),
          uuidField.uid,
        ])),
      };
      const primaryTableUID = table.meta?.extra?.primaryTable?.[1];
      if (primaryTableUID) {
        formData.metas[primaryTableUID] = {
          ...(formData.metas[primaryTableUID] || {}),
          hiddenColumns: Array.from(new Set([
            ...(formData.metas[primaryTableUID]?.hiddenColumns || []),
            uuidField.uid,
          ])),
        };
      }
    }
    return {
      formData,
      table,
    };
  }
  async deleteTable(formData: NocodeFormData, nocodeId: string, table: Table) {
    const formTable = formData.options.tables.find(_table => _table.uid === table.meta.uid);
    // await this.dbManager.removeDB(nocodeId, formTable);
    if (formTable) {
      formData.options.tables = formData.options.tables.filter(item => item.uid !== formTable.uid);
    }
    formData.tables = formData.tables.filter(_table => _table.uid !== table.uid);
    delete formData.formOptions[table.uid];
    const referencedSubTableUIDs = (table.fields || [])
      .map(field => field.meta?.extra?.subTableUID?.[1])
      .filter(Boolean) as TableUID[];
    const ownedSubTableUIDs = (formData.tables || [])
      .filter(item => item.meta?.extra?.primaryTable?.[1] === table.uid)
      .map(item => item.uid);
    const subTableUIDs = Array.from(new Set([...referencedSubTableUIDs, ...ownedSubTableUIDs]));
    for (const subTableUID of subTableUIDs) {
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      if (subTable) {
        await this.deleteTable(formData, nocodeId, subTable);
      }
    }
    return formData;
  }



  async updateSortData (nocodeId:string, tableUID: TableUID, rows:object[]) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table =  formData.tables.find(item => item.uid === tableUID)
    const uuidField = getUUIDSystemField(table.fields);
    const keys: OptionFieldUID[] = [[formData.uid, table.uid, uuidField.uid]]
    return await this.tryUpdateData(formData, nocodeId, tableUID, rows, keys, FormDataStage.NORMAL, { triggerTodo: false });
  }

  
  async createFormData(nocodeId: string, tableId: TableUID, rows: Row[]) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables?.find(t=>t.uid === tableId);
    const uuidField = getUUIDSystemField(table.fields);
    const res = await this.addData(formData, nocodeId, tableId, rows);
    const { buckets, tables } = await this.connectionUtils.readConnectionData(formData, false, nocodeId, unique(), {}, {
      tableUIDs: [tableId],
      queryOptions: {
        filters: {
          [tableId]: res.data.map(item => ({ [uuidField.uid]: item._uuid }))
        }, 
        formatData: true,
      }
    })
    return {
      bucket: buckets[0],
      rows: buckets[0]?.rows,
      connection: formData,
    };
  }
  
  async updateFormData(nocodeId: string, tableId: TableUID, rows: Row[]) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables?.find(t => t.uid === tableId);
    const uuidField = getUUIDSystemField(table.fields);

    const res = await this.tryUpdateData(formData, nocodeId, tableId, rows, [[formData?.uid, table?.uid, uuidField?.uid]]);
    const { buckets } = await this.connectionUtils.readConnectionData(formData, false, nocodeId, unique(), {}, {
      tableUIDs: [tableId],
      queryOptions: {
        filters: {
          [tableId]: res.data.map(item => ({ [uuidField?.uid]: item?._uuid }))
        }, 
        formatData: true,
      }
    })
    return {
      bucket: buckets[0],
      ...res
    };
  }

  async deleteFormData(nocodeId: string, tableId: TableUID, rows: Row[]) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables?.find(t => t.uid === tableId);
    const uuidField = getUUIDSystemField(table.fields);

    const res = await this.tryDeleteData(formData, nocodeId, tableId, rows, [[formData?.uid, table?.uid, uuidField?.uid]]);
    const { buckets } = await this.connectionUtils.readConnectionData(formData, false, nocodeId, unique(), {}, {
      tableUIDs: [tableId],
      queryOptions: {
        filters: {
          [tableId]: res.data.map(item => ({ [uuidField?.uid]: item._uuid }))
        },
        formatData: true,
      }
    })
    return {
      bucket: buckets[0],
      ...res
    };
  }

  private clearAutoFillDataConfig(value: any) {
    // 复制表单到应用时清理自动填充数据配置
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(item => this.clearAutoFillDataConfig(item));
      return;
    }

    delete value['setting-related-form-fill'];

    Object.values(value).forEach(child => this.clearAutoFillDataConfig(child));
  }

  async copyTable(nocodeId: string, sourceFormId: string, copyName: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = deepClone(nocodeBody.formData);

    // 计算原表 table 里的 id
    const sourceTable = formData.tables.find(table => table.uid === sourceFormId);
    if (!sourceTable) return {formData: formData, table: []};

    const sourceOptionTable = formData.options.tables.find(table => table.uid === sourceTable.meta.uid);
    if (!sourceOptionTable) return {formData: formData, table: []};

    const tableName = this.getUniqueName(copyName, formData?.options?.tables);
    const uidMapping = {};
    const copiedSubTableUIDByColumnUID: Record<string, TableUID> = {};
    const copiedSubTableUIDByFieldUID: Record<string, TableUID> = {};
    uidMapping[sourceTable.uid] = `t_${unique()}`;

    const uid = unique();
    uidMapping[sourceOptionTable.uid] = uid
    const subOptionTableList: FormDataTable[] = [];
    const subTableList: Table[] = [];

    const _table = deepClone(sourceOptionTable);
    _table.tableName = tableName;
    _table.columns.forEach(column => {
      const newUid = unique();
      uidMapping[column.uid] = newUid;

      if (column.extra?.subColumns && column.extra?.subTableUID?.[1]) {
        const uidOfSubTable = unique();
        const fieldUidOfSubTable: `t_${string}` = `t_${unique()}`;

        column.extra.subColumns?.forEach(subColumn => {
          const newSubUid = unique();
          uidMapping[subColumn.uid] = newSubUid;
        })

        const relevanceTable = formData.tables.find(field => field.uid === column.extra.subTableUID[1]);
        if (!relevanceTable) return;
        const relevanceOptionTable = formData.options.tables.find(table => table.uid === relevanceTable.meta.uid);
        if (!relevanceOptionTable) return;
        uidMapping[relevanceOptionTable.uid] = uidOfSubTable;
        uidMapping[relevanceTable.uid] = fieldUidOfSubTable;
        copiedSubTableUIDByColumnUID[newUid] = fieldUidOfSubTable;

        const beAddedSubformOptionTable = {
          ...deepClone(relevanceOptionTable),
          tableName: `${tableName !== copyName ? copyName : tableName}--${global.i18next.t('formDataService.subForm')}(${column.alias}-${newUid})`,
        }
        beAddedSubformOptionTable.columns.forEach(col => {
          const relevanceId = unique();
          uidMapping[col.uid] = relevanceId;
        })
        subOptionTableList.push(beAddedSubformOptionTable);
      }
    })

    let table = deepClone(sourceTable);
    table.alias = tableName !== copyName ? copyName : tableName;
    table.meta.name = tableName;
    table.fields = table.fields.map(field => {
      const newUid: FieldUID = `f_${unique()}`;
      uidMapping[field.uid] = newUid;
      if (field.meta.extra?.widgetType === "widget.form.subform" && field.meta.extra?.subTableUID?.[1]) {
        const sourceSubTableId = field.meta.extra.subTableUID[1];

        field.subTableFields?.forEach(subField => {
          const newSubUid: FieldUID = `f_${unique()}`;
          uidMapping[subField.uid] = newSubUid;
        })

        const relevanceTable = deepClone(formData.tables.find(t => t.uid === sourceSubTableId));
        if (!relevanceTable) {
          return {
            ...field,
          }
        }
        const copiedSubTableUID = uidMapping[sourceSubTableId] as TableUID | undefined;
        if (copiedSubTableUID) {
          copiedSubTableUIDByFieldUID[newUid] = copiedSubTableUID;
        }
        const alias = `${table.alias}--${global.i18next.t('formDataService.subForm')}(${field.alias}-${uidMapping[field.meta.uid]})`
        const beAddedSubformTable = {
          ...relevanceTable,
          alias: alias,
          meta: {
            ...relevanceTable.meta,
            name: alias,
            fields: relevanceTable.fields.map(f => {
              const newUid: FieldUID = `f_${unique()}`;
              uidMapping[f.uid] = newUid;
              return {
                ...f,
              }
            })
          },
        }
        subTableList.push(beAddedSubformTable);
      }

      return {
        ...field,
      }
    });

    const copiedOptionTables = replaceUID([_table, ...subOptionTableList], uidMapping) as FormDataTable[];
    const copiedMainOptionTable = copiedOptionTables[0];
    copiedMainOptionTable?.columns?.forEach(column => {
      const copiedSubTableUID = copiedSubTableUIDByColumnUID[column.uid];
      if (copiedSubTableUID && column.extra) {
        column.extra.subTableUID = [formData.uid, copiedSubTableUID];
      }
    });
    formData.options.tables.push(...copiedOptionTables);
    table = replaceUID(table, uidMapping);
    table.fields?.forEach(field => {
      const copiedSubTableUID = copiedSubTableUIDByFieldUID[field.uid];
      if (copiedSubTableUID && field.meta?.extra) {
        field.meta.extra.subTableUID = [formData.uid, copiedSubTableUID];
      }
    });
    const subformTables = replaceUID(subTableList, uidMapping) as Table[];
    subformTables.forEach(subTable => {
      if (subTable.meta?.extra?.primaryTable) {
        subTable.meta.extra.primaryTable = [formData.uid, table.uid];
      }
    });
    formData.tables.push(table, ...subformTables);

    // 复制formOptions，并同步替换表单规则、字段规则、流程规则中的uid
    const sourceFormOptions = deepClone(formData.formOptions[sourceFormId] || {} as FormOption);
    const sourceFormWidgetUID = sourceFormOptions?.widget?.uid;
    if (sourceFormWidgetUID) {
      uidMapping[sourceFormWidgetUID] = unique();
    }
    formData.formOptions[table.uid] = replaceUID(sourceFormOptions, uidMapping);

    if(formData.formOptions[table.uid]?.widget) {
      formData.formOptions[table.uid].widget.uid = uidMapping[sourceFormWidgetUID] || unique();
    }

    this.clearAutoFillDataConfig(formData.formOptions[table.uid]);

    return {
      formData,
      table
    };
  }

  private async afterAddData(nocodeId: string, table: Table, rows: Row[], projectionChanges?: ProjectionChangePublishToken[]){
    await this.refreshDocumentIndex('add', rows, nocodeId, table);
    await this.queueScheduledProjectionChanges(nocodeId, table, rows, true, projectionChanges);
  }

  private async afterUpdateData(nocodeId: string, table: Table, rows: Row[], projectionChanges?: ProjectionChangePublishToken[]){
    await this.refreshDocumentIndex('update', rows, nocodeId, table);
    await this.queueScheduledProjectionChanges(nocodeId, table, rows, false, projectionChanges);
  }

  private async afterDeleteData(nocodeId: string, table: Table, rows: Row[], projectionChanges?: ProjectionChangePublishToken[]){
    await this.refreshDocumentIndex('remove', rows, nocodeId, table);
    await this.queueScheduledProjectionChanges(nocodeId, table, rows, true, projectionChanges);
  }

  private async stageScheduledProjectionChanges(nocodeId: string, table: Table, rows: Row[], allFields = false) {
    const batches = this.buildScheduledProjectionInputs(table, rows, allFields);
    if (!batches.length) return [];
    // The repository already chunks large inputs transactionally. Sending the
    // complete set once avoids re-reading the same schedule definitions for
    // every 200-row batch on the user-request path.
    return await this.scheduledTriggerRepository.stageProjectionChangesForRecords(
      nocodeId,
      table.uid,
      batches.flat(),
    );
  }

  private async resolveScheduledProjectionRows(
    nocodeId: string,
    formData: NocodeFormData,
    table: Table,
    rows: Row[],
    preparedRows: Row[],
    keys: OptionFieldUID[],
    scope: FormDataStoreScope,
  ): Promise<Row[]> {
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) return rows;
    const unresolvedIndexes = rows
      .map((row, index) => this.getScheduledProjectionRecordId(table, row) ? -1 : index)
      .filter(index => index >= 0);
    if (!unresolvedIndexes.length || !await this.scheduledTriggerRepository.hasProjectionDefinitions(nocodeId, table.uid)) return rows;

    const optionTable = formData.options?.tables?.find(item => item.uid === table.meta?.uid);
    const keyFields = (keys || [])
      .filter(key => key?.[1] === table.uid)
      .map(key => table.fields.find(field => field.uid === key?.[2]))
      .filter((field): field is Field => Boolean(field));
    if (!optionTable || !keyFields.length) return rows;

    const db = await this.dbManager.getDB(nocodeId, optionTable, scope);
    const uuidStorageKey = getDbColumnKey(uuidField);
    const projection = [...new Set([uuidStorageKey, ...keyFields.map(getDbColumnKey)])];
    const resolvedRows = [...rows];
    const batchSize = 200;
    for (let offset = 0; offset < unresolvedIndexes.length; offset += batchSize) {
      const entries = unresolvedIndexes.slice(offset, offset + batchSize).map(index => {
        const preparedRow = preparedRows[index] || {};
        const query = Object.fromEntries(keyFields
          .filter(field => !isEmptyUUIDValue(preparedRow[field.meta?.name]))
          .map(field => [field.meta.name, preparedRow[field.meta.name]]));
        return {
          index,
          query: transformFormDataRow(query, optionTable.columns, { transformType: true }),
        };
      }).filter(entry => !isEmpty(entry.query));
      if (!entries.length) continue;
      const matches = await db.find({ $or: entries.map(entry => entry.query) }, { projection });
      for (const entry of entries) {
        const match = matches.find(row => Object.entries(entry.query).every(([key, value]) => equals(row?.[key], value)));
        const recordId = match?.[uuidStorageKey];
        if (!isEmptyUUIDValue(recordId)) {
          resolvedRows[entry.index] = { ...rows[entry.index], [uuidField.uid]: recordId };
        }
      }
    }
    return resolvedRows;
  }

  private getScheduledProjectionRecordId(table: Table, row: Row) {
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) return undefined;
    return [SystemField.UUID, uuidField.uid, uuidField.meta?.uid, uuidField.meta?.name]
      .map(key => key ? row?.[key] : undefined)
      .find(value => !isEmptyUUIDValue(value));
  }

  private buildScheduledProjectionInputs(table: Table, rows: Row[], allFields: boolean) {
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) return [];
    const aliases = new Map<string, string>();
    for (const field of table.fields) {
      aliases.set(field.uid, field.uid);
      if (field.meta?.uid) aliases.set(field.meta.uid, field.uid);
      if (field.meta?.name) aliases.set(field.meta.name, field.uid);
    }
    const batchSize = 200;
    const batches: Array<Array<{ recordId: string; changedFieldIds?: string[] }>> = [];
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const inputs: Array<{ recordId: string; changedFieldIds?: string[] }> = [];
      for (const row of rows.slice(offset, offset + batchSize)) {
        const recordId = this.getScheduledProjectionRecordId(table, row);
        if (recordId) {
          const changedFieldIds = allFields ? undefined : [...new Set(Object.keys(row)
            .map(key => aliases.get(key) || key)
            .filter(fieldId => fieldId !== uuidField.uid))];
          inputs.push({ recordId: String(recordId), changedFieldIds });
        }
      }
      if (!inputs.length) continue;
      batches.push(inputs);
    }
    return batches;
  }

  private async queueScheduledProjectionChanges(nocodeId: string, table: Table, rows: Row[], allFields = false, projectionChanges?: ProjectionChangePublishToken[]) {
    if (projectionChanges?.length) {
      try {
        const published = await this.scheduledTriggerRepository.publishProjectionChanges(projectionChanges);
        if (published >= projectionChanges.length) return;
        if (published < projectionChanges.length) {
          this.logger.warn(`scheduled projection markers were consumed before publish for ${nocodeId}:${table.uid}; rebuilding post-commit events`);
        }
      } catch (error) {
        // The fallback delay marker normally survives a publication error;
        // falling through also rebuilds it if a slow commit consumed it first.
        this.logger.warn(`scheduled projection publish failed for ${nocodeId}:${table.uid}`, error);
      }
    }
    const batches = this.buildScheduledProjectionInputs(table, rows, allFields);
    if (!batches.length) return;
    try {
      await this.scheduledTriggerRepository.queueProjectionChangesForRecords(nocodeId, table.uid, batches.flat());
      return;
    } catch (error) {
      this.logger.warn(`scheduled projection queue failed for ${nocodeId}:${table.uid}`, error);
    }
    // If a bulk call failed after a partial transaction, replaying each batch
    // is idempotent and keeps a single bad batch from hiding the rest.
    for (const inputs of batches) {
      try {
        await this.scheduledTriggerRepository.queueProjectionChangesForRecords(nocodeId, table.uid, inputs);
      } catch (error) {
        this.logger.warn(`scheduled projection queue failed for ${nocodeId}:${table.uid}`, error);
      }
    }
  }

  async createFlexsearchIndex(table: Table, appId: string): Promise<void>{
    const uuidField = getUUIDSystemField(table.fields);
    const buckets = await this.getData(appId, [table.uid], {});
    const result = await this.tinypool.run({
      handle: "create",
      indexKey: `${appId}-${table.uid}`,
      uid: uuidField.uid,
      fields: table.fields.filter(item => !isBuiltinField(item) && item.type === 'string').map(item => ({
        field: item.uid,
      })),
      rows: buckets[0].rows
    });
    if (result) this.documentIndex[`${appId}-${table.uid}`] = true;
  }

  async documentSearch(dIndexKey: DocumentIndexKey, query: any) {
    return await this.tinypool.run({
      handle: "search",
      indexKey: dIndexKey,
      query: query
    })
  }

  getDocumentIndex(dIndexKey: DocumentIndexKey): boolean {
    return this.documentIndex[dIndexKey];
  }

  private async refreshDocumentIndex(handle: 'add' | 'update' | 'remove', rows: Row[], appId: string, table: Table) {
    const dIndex = this.documentIndex[`${appId}-${table.uid}`];
    if (!dIndex) return;

    const uuidFleid: Field = getUUIDSystemField(table.fields);
    if(handle !== 'remove'){
      const filterIn = rows.map(row => row[uuidFleid.uid]);
      const filters = {
        [table.uid]: [
          { [uuidFleid.uid]: { '$in': filterIn } }
        ]
      }
      const buckets = await this.getData(appId, [table.uid], { filters });
      rows = buckets?.[0]?.rows || [];
    }
    this.tinypool.run({
      handle: handle,
      indexKey: `${appId}-${table.uid}`,
      rows: rows
    });
  }

  private async getTableRows(nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">, nocodeId: string, tableUID: TableUID, filterRule: FilterRule, row: Row, fillSubTables = false, formulaRuntime?: FormulaRuntime | null) {
    const sourceData = getNocodeDataSourceTableByUID(nocodeBody, tableUID, { nocodeId }, true);
    const sourceFormData = sourceData?.connection as NocodeFormData;
    const sourceNocodeId = sourceData?.connection?.nocodeId || nocodeId;
    const table = sourceData?.table;
    if (!sourceFormData || !table) return [];
    const whereCondition = transformFilterRule(filterRule, row, { formulaRuntime });
    const buckets = await this._getData(sourceFormData, [tableUID], sourceNocodeId, {
      filters: {
        [tableUID]: [whereCondition]
      }
    });
    const rows = buckets[0]?.rows || [];
    if (fillSubTables) {
      return await this.fillSubFormField(rows, sourceNocodeId, table, sourceFormData);
    }
    return rows;
  }

  private getCurrentSubformRows(sourceTable: SourceTable | undefined, row: Row, formulaRuntime?: FormulaRuntime | null) {
    const subTableFieldUID = sourceTable?.currentSubTableFieldUID;
    if (!subTableFieldUID) return [];

    const subRows = Array.isArray(row?.[subTableFieldUID]) ? row[subTableFieldUID] : [];
    if (!subRows.length) return [];
    if (isEmpty(sourceTable?.filterRule?.conditions)) {
      return subRows;
    }

    const whereCondition = transformFilterRule(sourceTable.filterRule, row, { formulaRuntime });
    return subRows.filter(subRow => evaluateCondition(subRow, whereCondition));
  }

  private isAggregateSubmitValidateEnabled(aggregateTable?: AggregateTable | null) {
    return Boolean(aggregateTable?.submitValidate?.enabled && aggregateTable?.submitValidate?.rules?.length);
  }

  private mergeSubmitRowIntoBucketRows(rows: Row[] = [], table: Table | undefined, row: Row, originRow?: Row | null) {
    if (!table) return rows;
    const mergedRow = {
      ...(originRow || {}),
      ...(row || {}),
    };
    const uuidField = getUUIDSystemField(table.fields);
    const targetUUID = mergedRow?.[uuidField?.uid] ?? originRow?.[uuidField?.uid] ?? row?.[uuidField?.uid];
    if (!targetUUID) {
      return [...rows, mergedRow];
    }

    let matched = false;
    const nextRows = rows.map(item => {
      if (item?.[uuidField.uid] !== targetUUID) return item;
      matched = true;
      return {
        ...item,
        ...mergedRow,
      };
    });
    if (!matched) {
      nextRows.push(mergedRow);
    }
    return nextRows;
  }

  private buildAggregateSubmitBuckets(
    sourceBuckets: Bucket[],
    source: AggregateRuntimeSource,
    targetTableUID?: TableUID,
    row?: Row,
    originRow?: Row | null,
  ) {
    if (!targetTableUID || !row) {
      return sourceBuckets || [];
    }
    const targetTable = (source.tables || []).find(item => item.uid === targetTableUID);
    if (!targetTable) {
      return sourceBuckets || [];
    }

    let hasTargetBucket = false;
    const buckets = (sourceBuckets || []).map(bucket => {
      if (bucket.tableId !== targetTableUID) return bucket;
      hasTargetBucket = true;
      const mergedRows = this.mergeSubmitRowIntoBucketRows(bucket.rows || [], targetTable, row, originRow);
      return {
        ...bucket,
        rows: mergedRows,
        count: mergedRows.length,
      };
    });

    if (!hasTargetBucket) {
      const mergedRows = this.mergeSubmitRowIntoBucketRows([], targetTable, row, originRow);
      buckets.push({
        tableId: targetTableUID,
        tableName: targetTable.alias || targetTable.uid,
        fields: targetTable.fields,
        rows: mergedRows,
        count: mergedRows.length,
      } as Bucket);
    }

    return buckets;
  }

  private normalizeFormSubmitValidMode(formValidRule?: FormValidRule | null) {
    return formValidRule?.submitMode === FormSubmitValidMode.ALLOW
      ? FormSubmitValidMode.ALLOW
      : FormSubmitValidMode.BLOCK;
  }

  private normalizeConditionalGroupSubmitMode(group?: NonNullable<FormValidRule['validConditions']>[number] | null, formValidRule?: FormValidRule | null) {
    if (group?.submitMode === FormSubmitValidMode.ALLOW) {
      return FormSubmitValidMode.ALLOW;
    }
    if (group?.submitMode === FormSubmitValidMode.BLOCK) {
      return FormSubmitValidMode.BLOCK;
    }
    return this.normalizeFormSubmitValidMode(formValidRule);
  }

  private normalizeFormSubmitAllowNoticeMode(formValidRule?: FormValidRule | null) {
    return formValidRule?.allowNoticeMode === FormSubmitAllowNoticeMode.TOAST
      ? FormSubmitAllowNoticeMode.TOAST
      : FormSubmitAllowNoticeMode.DIALOG;
  }

  private normalizeConditionalGroupAllowNoticeMode(group?: NonNullable<FormValidRule['validConditions']>[number] | null, formValidRule?: FormValidRule | null) {
    if (group?.allowNoticeMode === FormSubmitAllowNoticeMode.TOAST) {
      return FormSubmitAllowNoticeMode.TOAST;
    }
    if (group?.allowNoticeMode === FormSubmitAllowNoticeMode.DIALOG) {
      return FormSubmitAllowNoticeMode.DIALOG;
    }
    return this.normalizeFormSubmitAllowNoticeMode(formValidRule);
  }

  private normalizeSubmitValidationMessage(errorText?: string) {
    return errorText || global.i18next.t('formDataService.submitValidationFailed');
  }

  private appendUniqueSubmitValidationMessages(target: string[], messages: string[] = []) {
    for (const message of messages) {
      const text = String(message || '').trim();
      if (!text || target.includes(text)) continue;
      target.push(text);
    }
    return target;
  }

  private createFormSubmitValidateResult(
    formValidRule?: FormValidRule | null,
    overrides: Partial<FormValidateSubmitResult> = {},
  ): FormValidateSubmitResult {
    return {
      valid: true,
      error: null,
      messages: [],
      submitMode: this.normalizeFormSubmitValidMode(formValidRule),
      allowNoticeMode: this.normalizeFormSubmitAllowNoticeMode(formValidRule),
      ...overrides,
    };
  }

  private evaluateAggregateSubmitValidateRule(aggregateTable: AggregateTable, bucket: Bucket, rule: AggregateSubmitValidateRule) {
    const rows = bucket?.rows || [];
    if (!rows.length) {
      return {
        valid: true,
        error: null,
      };
    }

    const evaluateFormula = (row: Row, formulaText?: string) => {
      if (!formulaText) return false;
      const formula = replaceByFormula(formulaText, (ids) => {
        if (ids[0] !== aggregateTable.uid) return null;
        const value = row?.[ids[1]];
        if (Number.isNaN(value)) return 0;
        if (isEmpty(value) && value !== 0 && value !== false) return null;
        return value;
      });

      try {
        const value = evaluateFormulaWithRuntime(formula, createFormulaRuntimeByData(row, bucket.fields));
        return typeof value === 'boolean' && value;
      } catch (err) {
        return false;
      }
    };

    const conditions = rule.conditions || [];
    if (conditions.length) {
      for (const row of rows) {
        const valid = conditions.every(condition => {
          if (condition?.type === FormConditionValueType.FORMULA) {
            return evaluateFormula(row, condition.formula || '');
          }

          const fieldUID = condition?.uid;
          const func = condition?.func;
          if (!fieldUID || !func) return false;

          let fieldValue = row?.[fieldUID];
          if (Number.isNaN(fieldValue)) fieldValue = 0;
          if (isEmpty(fieldValue) && fieldValue !== 0 && fieldValue !== false) return false;
          return Boolean(funcMap[func]?.(fieldValue, condition.value));
        });

        if (valid) continue;
        return {
          valid: false,
          error: rule.errorText || global.i18next.t('formDataService.submitValidationFailed'),
        };
      }

      return {
        valid: true,
        error: null,
      };
    }

    for (const row of rows) {
      if (evaluateFormula(row, rule.formula)) continue;
      return {
        valid: false,
        error: rule.errorText || global.i18next.t('formDataService.submitValidationFailed'),
      };
    }

    return {
      valid: true,
      error: null,
    };
  }

  private async validateAggregateTableSubmit(
    nocodeBody: NocodeBody,
    nocodeId: string,
    row: Row,
    options?: { connectionUID?: string; tableUID?: TableUID; originRow?: Row | null; },
  ): Promise<FormValidateSubmitResult> {
    const result = {
      error: null,
      valid: true,
    };
    const connectionUID = options?.connectionUID;
    const targetTableUID = options?.tableUID;
    if (!connectionUID || !targetTableUID || !row) return result;

    const runtimeSources = this.getAggregateRuntimeSources(nocodeBody, nocodeId);
    const matchedAggregateTables = runtimeSources.flatMap(source => {
      return (source.aggregateTables || [])
        .filter(aggregateTable => {
          if (!this.isAggregateSubmitValidateEnabled(aggregateTable)) return false;
          return (aggregateTable.sourceTables || []).some(item => {
            const sourceConnectionUID = this.getAggregateSourceConnectionUID(item, source.uid);
            return sourceConnectionUID === connectionUID && item.tableUID === targetTableUID;
          });
        })
        .map(aggregateTable => ({
          source,
          aggregateTable,
        }));
    });

    for (const { source, aggregateTable } of matchedAggregateTables) {
      const aggregateBucket = await this.buildAggregateBucketBySource(
        source,
        aggregateTable,
        runtimeSources,
        nocodeId,
        {},
        {
          submitTargetConnectionUID: connectionUID,
          submitTargetTableUID: targetTableUID,
          submitRow: row,
          originRow: options?.originRow,
        },
      );
      if (!aggregateBucket) continue;

      for (const rule of aggregateTable.submitValidate?.rules || []) {
        if (!rule?.formula) continue;
        const validateResult = this.evaluateAggregateSubmitValidateRule(aggregateTable, aggregateBucket, rule);
        if (!validateResult.valid) {
          return validateResult;
        }
      }
    }

    return result;
  }

  async validateFormSubmit(
    nocodeId: string,
    row: Row,
    formValidRule?: FormValidRule | null | undefined,
    isSubTable: boolean = false,
    options?: { connectionUID?: string; tableUID?: TableUID; originRow?: Row | null; },
  ): Promise<FormValidateSubmitResult> {
    const result = this.createFormSubmitValidateResult(formValidRule);
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    if (formValidRule) {
      const formData = nocodeBody.formData;
      const { sourceTables, targetTableUID, validConditions } = formValidRule;
      const targetTable = formData.tables.find(t => t.uid === targetTableUID);
      const formulaRuntime = createFormulaRuntimeByData(row, targetTable?.fields);
      const sourceTableRows = {
        [targetTableUID]: [row],
      };
      await Promise.all((sourceTables || []).map(async (item) => {
        if (item?.sourceType === "current-subform" && item.currentSubTableFieldUID) {
          sourceTableRows[item.uid] = this.getCurrentSubformRows(item, row, formulaRuntime);
          return;
        }
        const filterRule = item.filterRule;
        sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, nocodeId, item.tableUID, filterRule, row, true, formulaRuntime);
      }));

      const maxRowLength = Math.max(...Object.values(sourceTableRows).map(rows => rows.length));
      const evaluateConditionGroup = (validRule: NonNullable<FormValidRule['validConditions']>[number]) => {
        const { conditions, errorText } = validRule;
        let isGroupMeet = true;

        for (let i = 0; i < maxRowLength; i++) {
          const isMeet = conditions.every(condition => {
            if (condition.type === FormConditionValueType.FORMULA) {
              let formula = replaceColFieldsByFormula(condition.formula, (keys) => {
                const [sourceUID, fieldId, subFieldId] = keys;
                const rows = sourceTableRows[sourceUID];
                const fieldValue = rows?.map(row => row[fieldId]);
                if (isEmpty(fieldValue)) return null;

                if (subFieldId) {
                  return fieldValue.flatMap(rows => rows.map(item => item[subFieldId]));
                } else {
                  return fieldValue;
                }
              })

              formula = replaceByFormula(formula, (keys) => {
                const [sourceUID, fieldId, subFieldId] = keys;
                const rows = sourceTableRows[sourceUID];
                let fieldValue = rows?.[sourceUID === targetTableUID ? 0 : i]?.[fieldId];
                fieldValue = Number.isNaN(fieldValue) ? 0 : fieldValue
                if (isEmpty(fieldValue)) return null;

                if (subFieldId) {
                  return fieldValue.map(row => row[subFieldId]);
                } else {
                  return fieldValue;
                }
              });

              try {
                const value = formulaRuntime.evaluate(formula);
                if (typeof value === 'boolean') return value;
                return false;
              } catch (err) {
                return false;
              }
            } else if(condition.type === FormConditionValueType.FILTER_ROW) {
              if(!sourceTableRows?.[condition.uid]) return false
              return funcMap[condition.func]?.(sourceTableRows?.[condition.uid].length, condition.value);
            } {
              const uidArr = condition.uid?.split(".") || [];
              const [sourceUID = null, fieldId = null, subFieldId = null] = uidArr;
              const rows = sourceTableRows[sourceUID];
              if (!rows?.length) return false;
              if (i > rows.length - 1) return true;
              const fieldValue = rows?.[i]?.[fieldId];

              if (subFieldId) {
                if (isEmpty(fieldValue)) return false
                const everyMeetOfSubField = fieldValue?.every(row => funcMap[condition.func]?.(row[subFieldId], condition.value));
                return everyMeetOfSubField;
              } else {
                if (isEmpty(fieldValue)) return false
                return funcMap[condition.func]?.(fieldValue, condition.value)
              }
            }
          });

          if (!isMeet) {
            isGroupMeet = false;
            break;
          }
        }

        return {
          isGroupMeet,
          message: this.normalizeSubmitValidationMessage(errorText),
        };
      };

      const normalizedValidConditions = validConditions || [];
      const evaluatedConditionGroups = normalizedValidConditions.map(validRule => ({
        validRule,
        ...evaluateConditionGroup(validRule),
      }));

      // 条件组之间是“或”：任意一组满足时，整体验证通过。
      const hasSatisfiedGroup = evaluatedConditionGroups.some(({ isGroupMeet }) => isGroupMeet);
      if (!hasSatisfiedGroup) {
        const blockFailedGroup = evaluatedConditionGroups.find(({ validRule }) => (
          this.normalizeConditionalGroupSubmitMode(validRule, formValidRule) === FormSubmitValidMode.BLOCK
        ));
        if (blockFailedGroup) {
          return this.createFormSubmitValidateResult(formValidRule, {
            valid: false,
            error: blockFailedGroup.message,
            messages: [blockFailedGroup.message],
            submitMode: FormSubmitValidMode.BLOCK,
          });
        }
      }

      const allowFailedMessages: string[] = [];
      let allowNoticeMode = FormSubmitAllowNoticeMode.TOAST;
      for (const { validRule, isGroupMeet, message } of evaluatedConditionGroups) {
        if (isGroupMeet || this.normalizeConditionalGroupSubmitMode(validRule, formValidRule) !== FormSubmitValidMode.ALLOW) {
          continue;
        }

        this.appendUniqueSubmitValidationMessages(allowFailedMessages, [message]);
        if (this.normalizeConditionalGroupAllowNoticeMode(validRule, formValidRule) === FormSubmitAllowNoticeMode.DIALOG) {
          allowNoticeMode = FormSubmitAllowNoticeMode.DIALOG;
        }
      }

      if (allowFailedMessages.length > 0) {
        result.messages = allowFailedMessages;
        result.submitMode = FormSubmitValidMode.ALLOW;
        result.allowNoticeMode = allowNoticeMode;
      }
    }

    if (!isSubTable) {
      const aggregateValidateResult = await this.validateAggregateTableSubmit(nocodeBody, nocodeId, row, options);
      if (!aggregateValidateResult.valid) {
        return aggregateValidateResult;
      }
    }

    return result;
  }

  async validateSubFormSubmit(
    nocodeId: string,
    rows: Row[],
    formValidRule?: FormValidRule,
    tableId?: TableUID,
    options: UniqueValidationOptions = {},
  ): Promise<FormValidateSubmitResult> {
    if (!Array.isArray(rows)) {
      return {
        valid: false,
        error: global.i18next.t('formDataService.formSubmitFail'),
      };
    }

    try {
      const result = this.createFormSubmitValidateResult(formValidRule);
      let allowNoticeMode = FormSubmitAllowNoticeMode.TOAST;
      for (const row of rows) {
        const res = await this.validateFormSubmit(nocodeId, row, formValidRule, true);
        if (!res.valid) {
          return res;
        }
        this.appendUniqueSubmitValidationMessages(result.messages, res.messages);
        if ((res.messages?.length || 0) > 0 && res.allowNoticeMode === FormSubmitAllowNoticeMode.DIALOG) {
          allowNoticeMode = FormSubmitAllowNoticeMode.DIALOG;
        }
      }

      if ((result.messages?.length || 0) > 0) {
        result.submitMode = FormSubmitValidMode.ALLOW;
        result.allowNoticeMode = allowNoticeMode;
      }

      if (tableId && !isEmpty(rows)) {
        const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
        const formData = nocodeBody.formData as NocodeFormData;
        const table = formData.tables.find(item => item.uid === tableId);
        if (table) {
          await this.validateCurrentTableUniqueRows(formData, nocodeId, table, rows, options);
          await this.validateNestedSubFormUniqueRows(formData, nocodeId, table, rows);
        }
      }

      return result;
    } catch (err) {
      const duplicateIssues = (err as UniqueValidationError)?.duplicateIssues;
      return {
        valid: false,
        error: this.getErrorMessage(err),
        duplicateIssues,
      };
    }
  }

  public subRowsDefaultValueCalculation(rows: Row[], fieldUID: string, subFields: Field[], targetTable: Table, formData: NocodeFormData, mode: 'add' | 'update') {
    for(const row of rows) {
      if(mode === 'update' && (!Array.isArray(row?.[fieldUID]) || !row[fieldUID].length)) continue
      if(!row?.[fieldUID]?.length) {
        row[fieldUID] = [{}];
      }
      const subRows = row[fieldUID]
      let index = 0
      for(let subRow of subRows) {
        const defaultFields = []
        const formulaFields = []
        for(const field of subFields) {
          if(Object.keys(subRow).includes(field.uid)) continue
          const extra = field.meta?.extra
          if((extra?.defaultValueType == 'custom' || extra?.linkType == 'form') && mode == 'add' && hasConfiguredValue(extra?.defaultValue)) {
            defaultFields.push({
              ...field,
              uid: `${fieldUID}.${field.uid}`,
            })
          } else if(getFormulaStr(extra?.formula) && !isEmpty(getFormulaStr(extra?.formula))) {
            formulaFields.push({
              ...field,
              uid: `${fieldUID}.${field.uid}`,
            })
          }
        }
        row[fieldUID][index] = rowsDefaultValueCalculation(deepClone([{...row, [fieldUID]: [subRow]}]), {formulaFields, defaultFields}, targetTable, formData)?.[0]?.[fieldUID]?.[0]
        index++
      }
    }
    return rows
  }

  public async checkUniqueValue(nocodeId: string, tableId: TableUID, uniqueChecks: KeyValue[], uuid: KeyValue) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(t => t.uid === tableId);
    const uuidField = getUUIDSystemField(table.fields);
    let _query: WhereCondition[];
    if (!isEmpty(uuid)) {
      _query = [
        {
          [uuid.key]: { $ne: uuid.value }
        }
      ];
    }

    for (const item of uniqueChecks) {
      let query: WhereCondition | WhereCondition[] = { [item.key]: item.value };
      if (_query) {
        query = [query, ..._query];
      }
      let res;
      try {
        res = await this.distinctSubmittedRows(
          formData,
          nocodeId,
          table,
          uuidField.uid,
          Array.isArray(query) ? { $and: query } : query,
        );
      } catch (err) {
        throw this.createUniqueValidationQueryError(err);
      }
      if (res && !isEmpty(res)) {
        return {
          valid: false,
          key: item.key,
          value: item.value,
        }
      }
    }
    return {
      valid: true,
    }
  }

  async testDBConnect(config: Required<DBInfo>) {
    return await this.dbManager.testConnect(config);
  }

  async dataMigration(options: Required<DBInfo>) {
    const nocodeMetas = await this.projectService.getAllNocodeMetas();
    const nocodeBodies = await Promise.all(nocodeMetas.map(async nocodeMeta => ({
      meta: nocodeMeta,
      body: await getNocodeBody(this.nocodesDir, nocodeMeta.id) as Awaited<ReturnType<typeof getNocodeBody>> | null,
    })));
    const nocodes: Parameters<DbManager["dataMigration"]>[1] = [];
    const skippedNocodeIds: string[] = [];
    for (const { meta, body } of nocodeBodies) {
      if (!body) {
        skippedNocodeIds.push(meta.id);
        continue;
      }
      nocodes.push({
        meta,
        body,
      });
    }
    if (skippedNocodeIds.length) {
      this.logger.warn(`skip data migration for nocodes with empty body: ${skippedNocodeIds.join(", ")}`);
    }
    await this.dbManager.dataMigration(options, nocodes);
    const { type, ...config } = options;
    this.preferences.set({
      formDatabaseType: type,
      formDatabaseConfig: config,
    });
    return true;
  }
}
