import { AddTodoOptions, AggregationType, BackTodoOptions, BaseTodoOptions, CancelTodoOptions, DeleteTodoOptions, FieldAuthValue, FilterRule, FinishTodoOptions, FlowTriggerContext, FlowTriggerSkipReason, FormCondition, FormConditionValueType, FormLinkageCondition, FormLinkageRule, FormWidgetType, GetFlowRecordsParams, GetTodoParams, GetTodosParams, GetTodosResult, GetTransferTodoUsersOptions, LogicalOperator, NocodeBody, NocodeFormData, PermissionCategory, PermissionRangeType, RejectTodoOptions, RuleFunc, SelectIdOfForm, SubmitTodoOptions, TODO, TodoCategory, TodoProcess, TransferTodoOptions, ViewActionTriggerContext, TodoSubCategory } from "@common/types/nocode";
import { OwnerEmptyHandle, CurrentSubTableFilter, CrossTableExecutionMode, DataChangeType, EditDataTargetScope, FLOW_DATA_OWNER_SOURCE_SUBMITTER, FlowOpinionFile, OrganizeOptionValue, ProcessBranch, ProcessFlow, ProcessNodeOwner, ProcessNodeOwnerType, ProcessNodeStatus, ProcessNodeType, SubmitRecord, TableUID, ApprovalCategory, NocodeProcess, ApproverType, ApprovalCategoryRule, OptionFieldUID, Row, TargetFieldFillType, TODOTriggerType, FormDataStageWhereCondition, ConditionBranchCondition, ConditionBranchConditionGroup, TimeTaskOptions, TimeTaskRepeat, Table, TargetFieldFillRule, TriggerMode, WhereCondition, SortType, QueryOptions, FormOption, FormValidRule, Field, getAllowCancel, getCrossTableExecutionMode, getWaitCrossTableFlowCompletion, getProcessTargetSourceUID, isDataChangeTriggerConditionsEnabled, isTimeTaskSingleTriggerMode, isTimeTaskTriggerConditionsEnabled, OperationTriggerMode, getOperationTriggerMode, ProcessVersionStatus, ProcessTimeoutActionType, ProcessTimeoutRule, FieldUID } from "@common/types/project";
import { FormDataStage, canRollbackFlow, filterCircularLinkageRules, getCreateOwnerSystemField, getDueTimeoutRules, getFlowById, getFlows, getFollowingFlows, getLastFlowById, getLastOwnerBranchFlow, getLinkageFillData, getLinkageFillValue, getNextFlow, getNocodeDataSourceTableByUID, getOwnerBranchFlow, getRollbackReplayPlan, getRollbackTargetFlows, getUUIDSystemField, hasConfiguredValue, isBranchNode, isDataProcessingNode, isMeetConditionsByRow, isProcessTable, isRollbackSubmitNode, isSystemField, isTriggerNode, resolveTimeoutDeadlineAt, SystemField, transformCondition, transformFilterRule, getProcessVersionStatus } from "@common/utils";
import { getNocodeDataSourceByUID, isDataOwnerEnabledTable } from "@common/utils/connection";
import { ADMIN_USERNAME, Account, Dynamic, isSystemAdminAccount } from "@common/types/account";
import { NOCODES_DIR } from "@main/constants";
import { getNocodeBody, saveNocodeBody } from "@main/utils";
import { forwardRef, Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from "@nestjs/common";
import { WorkbenchService } from "../workbench/workbench.service";
import { EntityManager, FilterQuery, MikroORM, RequestContext, UniqueConstraintViolationException } from "@mikro-orm/core";
import { FormDataService } from "./form-data.service";
import { evaluateCondition, transformFormDataRow } from "./utils";
import { equals, isEmpty } from "@common/utils/object";
import { cloneDeep as deepClone } from "lodash";
import { FlowExecutionRecordsRepository, FlowExecutionRecords, FlowBranchRecordsRepository, FlowBranchRecords, FlowExecutionContextRepository, FlowExecutionContext, FlowExecutionRecordMeta, FlowPostFinishPlan, FlowPostFinishPlanRepository, FlowPostFinishTask, FlowPostFinishTaskRepository, FlowImmediateMutation, FlowImmediateMutationRepository, FlowImmediateMutationSource, FlowScheduleDefinition, FlowScheduledRun, FlowTaskStepExecution, ViewActionTriggerTask } from "./entities";
import { Nocode, NocodeRepository } from "../project/entities";
import { getFormulaStr, getFormulaFields, replaceByFormula, replaceColFieldsByFormula, rowsDefaultValueCalculation, createFormulaRuntimeByData, evaluateFormulaWithRuntime, normalizeFormulaNumericValue, getFormulaEmptyCheckReferenceKeys, type FormulaRuntime } from "@common/utils/formula";
import { evaluateImportBatchAggregationFormula } from "@common/utils/flow-import-aggregation";
import { normalizeRowNumberFieldValues } from "@common/utils/fieldValue";
import { DataRows } from "@common/types/connector";
type FlowRollbackReason = string;
import { unique } from "@common/utils/unique";
import { Cron, CronExpression } from "@nestjs/schedule";
import { QueryBuilder } from "@mikro-orm/knex";

type SubmitRowsCheckResult = {
  messages: string[],
}
import { ProjectService } from "../project/project.services";
import { intersection } from 'lodash';
import { FlowTriggerResult, TriggerOptions } from "./types";
import { applyProcessFieldDefaults, calculateProcessDistinctAggregation, ProcessDefaultDependencyCycleError, resolveProcessDefaultQuickComputeFilterRow, resolveProcessTargetField, restoreProcessBatchFieldValues } from "./form-flow-default-value";

type DisplayFlowAncestor = {
  flow: ProcessFlow,
  branch: ProcessBranch,
}

const PROCESS_DEFAULT_QUICK_COMPUTE_CACHE_LIMIT = 100;
const DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE = 500;
const getTriggerTodoConcurrency = (hasImportTask: boolean, workerAvailable: boolean) => {
  if (!hasImportTask) return 1;
  const configured = Number(process.env.FLOW_EXECUTION_TRIGGER_TODO_CONCURRENCY);
  if (Number.isInteger(configured) && configured > 0 && configured <= 8) return configured;
  // Tinypool mode has already opted into bounded worker orchestration. Use a
  // conservative two-record fan-out by default; the same-UUID lock and P1
  // scheduler limits still prevent duplicate or unbounded execution.
  if (workerAvailable && (process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool") === "tinypool") return 2;
  // Preserve the existing serialized execution in inline mode unless an
  // operator explicitly enables bounded fan-out for an import/batch task.
  return 1;
};

type DisplayFlowPath = {
  flow: ProcessFlow,
  ancestors: DisplayFlowAncestor[],
}

type ActiveParallelTail = {
  record: FlowExecutionRecords,
  path: DisplayFlowPath,
}
import { SqlEntityManager } from "@mikro-orm/better-sqlite";
import { OperatorMap } from "@mikro-orm/core/typings";
import { assignFieldsAuth, findWidgetSoulByUID } from "@common/utils/element";
import AsyncLock from "async-lock";
import { RequestStorage } from "@main/middleware";
import { FlowWorkerPool } from "./flow-worker-pool";
import type {
  FlowWorkerNodeGatewayResult,
  FlowWorkerTriggerExecutionCandidate,
  FlowWorkerTriggerPlanCandidate,
} from "./flow-worker-pool";
import { buildFlowNodeExecutionSnapshot, type FlowNodeExecutionStep } from "./flow-execution-kernel";

type UpdateFlowData = {
  node?: {
    type: "add" | "update" | "delete",
    value: string[],
  },
  status?: ProcessNodeStatus,
  stage?: FormDataStage,
  todoId?: string,
  version?: number,
}
type ImportBatchAggregationResult = {
  handled: boolean,
  skipNodeIds?: string[],
}
type AddTodoRuntimeContext = {
  account?: Account,
  nocodeBody?: NocodeBody,
}
type FlowWorkerExecutionContext = NonNullable<TriggerOptions["flowWorkerContext"]>;
type WorkerNodeTodoOptions = BaseTodoOptions & {
  flowWorkerContext?: FlowWorkerExecutionContext,
  flowWorkerContinuation?: { nextNodeIds: string[] },
}
type WorkerNodeStepBeginResult = {
  status: "started" | "succeeded" | "failed" | "unknown",
  owned: boolean,
  stop?: boolean,
  nextNodeIds?: string[],
}
type GetTableRowsOptions = Pick<QueryOptions, "stage" | "orderBy" | "fillSubTable" | "filters"> & {
  formulaRuntime?: FormulaRuntime | null;
  fieldUIDs?: string[];
  limit?: number;
};
type TransferTodoContext = {
  flow: ProcessFlow,
  record: FlowExecutionRecords,
  startRecord: FlowExecutionRecords | null,
  owners: string[],
  canViewCurrentData: boolean,
}
type MemberHandoverSummary = {
  movedCount: number,
  mergedCount: number,
  skippedCount: number,
}
type MemberHandoverPreviewItem = {
  id: string,
  name: string,
  count: number,
  items: Array<Record<string, any>>,
}
type OperationTriggerOptions = {
  nocodeId: string,
  tableId: TableUID,
  uuid: string,
  processId: string,
  triggerNodeId: string,
  operationId: string,
  batchIndex?: number,
  dataTitle?: string,
  flowWorkerContext?: FlowWorkerExecutionContext,
}
type ViewOperationTriggerOptions = {
  nocodeId: string,
  tableId: TableUID,
  processId: string,
  triggerNodeId: string,
  operationId: string,
  actionDisplayName?: string,
  triggerContext: ViewActionTriggerContext,
  flowWorkerContext?: FlowWorkerExecutionContext,
}
type OperationTriggerFailedItem = {
  index: number,
  uuid: string,
  dataTitle: string,
  message: string,
  suggestion: string,
}
type OperationTriggerBatchResult = {
  attemptedCount: number,
  successCount: number,
  failedCount: number,
  failedItems: OperationTriggerFailedItem[],
}
type FlowCompensationMode = "none" | "best_effort" | "strict_batch_best_effort";
type FlowCompensationContext = {
  mode: FlowCompensationMode,
  options: OperationTriggerOptions,
  todoId?: string,
  rowSnapshot?: Row | null,
  compensationActions: Array<() => Promise<void>>,
}
type EmptyRowTriggerErrorCode =
  | "approval-not-supported"
  | "field-owner-not-supported"
  | "auto-related-not-supported"
  | "edit-current-not-supported"
  | "delete-current-not-supported";
type EmptyRowTriggerError = Error & {
  emptyRowTriggerError?: true,
  emptyRowTriggerErrorCode?: EmptyRowTriggerErrorCode,
}
type RuntimeCurrentRowContext = {
  formData: NocodeFormData,
  currentTable: Table,
  currentRows: Row[],
  currentRow: Row,
  hasPhysicalRow: boolean,
  startRecord?: FlowExecutionRecords | null,
}
type SubmitTodoRuntimeContext = {
  nocodeBody: NocodeBody,
  formData: NocodeFormData,
  process: NocodeProcess,
  flowRecord: FlowExecutionRecords,
  flows: ProcessFlow[],
  flow: ProcessFlow,
  table: Table,
  uuidFiled: Field,
}
type AutoSubmitTodoResult = {
  isFinish: boolean,
  errorMsg?: string,
  autoHandledUserIds: string[],
}
type ResolvedProcessTargetTable = {
  targetNocodeId: string,
  targetFormData: NocodeFormData,
  targetTable: Table,
  isCrossAppTarget: boolean,
}
type ReportDataWriteResult = {
  row: Row | null,
  targetUUID: string | null,
}
type ReportDataStashContext = {
  row?: Row | null,
  targetNocodeId?: string,
  targetTableUID?: TableUID,
  targetUUID?: string,
}
type DataChangeSubmittedTargetContext = {
  targetUUID?: string,
}
type FlowNodeStashContext = {
  row?: Row | null,
  source?: TODOTriggerType,
  targetNocodeId?: string,
  targetTableUID?: TableUID,
}
type StashMutationRollbackContext = {
  flowRecordSnapshot?: {
    isStashed?: boolean,
    stashTime?: number,
    stashOperatorId?: string,
    metas?: FlowExecutionRecords["metas"],
  } | null,
  sourceRowSnapshot?: Row | null,
  sourceStage?: FormDataStage,
  executionContextExisted?: boolean,
  executionContextDataSnapshot?: any,
  reportResolvedTarget?: ResolvedProcessTargetTable | null,
  reportTargetUUID?: string | null,
  reportPreviousRowSnapshot?: Row | null,
}
type SubmitTodoRollbackContext = {
  currentRecordSnapshot?: FlowExecutionRecords | null,
  startRecordSnapshot?: FlowExecutionRecords | null,
  branchRecordSnapshots?: Array<{
    id: string,
    flowId: string,
    todoId?: string,
    uuid: string,
    status: ProcessNodeStatus,
    branchIds: string[],
  }>,
  nextNodeRecordIdsBeforeSubmit?: Set<string>,
  executionContextExisted?: boolean,
  executionContextSnapshot?: {
    data?: any,
    skipNodeIds?: string[],
    viewActionTriggerContext?: ViewActionTriggerContext,
    triggerRowSnapshot?: Row,
    triggerContext?: FlowTriggerContext,
  } | null,
  sourceRowSnapshot?: Row | null,
  sourceRowStage?: FormDataStage | null,
  sourceRowExisted?: boolean,
  submittedTargetUUID?: string | null,
  reportTargetSnapshot?: {
    resolvedTarget: ResolvedProcessTargetTable,
    row?: Row | null,
    uuid?: string | null,
  } | null,
  reportTargetUUID?: string | null,
}
type DataProcessingNodeStartResult = {
  messages: string[],
  recordMeta?: Record<string, unknown>,
  mutation?: FlowNodeMutationResult,
}
type FlowNodeMutationResult = {
  action: DataChangeType,
  targetNocodeId: string,
  targetTableId: TableUID,
  targetUuid?: string,
  beforeRows: Row[],
  afterRows: Row[],
  changedFieldUids?: string[],
  preparedTaskId?: string,
}
type PostFinishRuntimeTodoOptions = BaseTodoOptions & {
  runtimeCurrentRowSnapshot?: Row,
  deferCurrentFormTrigger?: boolean,
  causedByTaskId?: string,
  mutationOccurrenceId?: string,
}
const IMMEDIATE_CROSS_TABLE_RETRY_LIMIT = 5;
const IMMEDIATE_CROSS_TABLE_RETRY_DELAY_MS = 60 * 1000;
const IMMEDIATE_CROSS_TABLE_STALE_MS = 5 * 60 * 1000;
type ScheduledFlowStartOptions = {
  runId: string,
  todoId: string,
  scheduleId: string,
  configHash: string,
  lifecycleEpoch: number,
  nocodeId: string,
  tableId: TableUID,
  uuid?: string,
  processVersion: string | number,
  nodeUid: string,
  scheduledFor: number,
  initiatorUserId: string,
  leaseOwner?: string,
  leaseVersion?: number,
}
type ScheduledLeaseContext = {
  runId: string,
  leaseOwner: string,
  leaseVersion: number,
}
type ScheduledTodoOptions = AddTodoOptions & {
  scheduledLease?: ScheduledLeaseContext,
}
const MAX_TRIGGER_DEPTH = 3;
const MAX_SAME_TABLE_TRIGGER_COUNT = 0;
const TIMEOUT_META_KEY = "__timeout__";
const isUniqueFieldEmpty = (value: any) => isEmpty(value === "" ? null : value);
@Injectable()
export class FormFlowService implements OnApplicationBootstrap {
  private readonly logger = new Logger('FormFlowService');
  private readonly lock = new AsyncLock({ timeout: 60 * 1000 });
  private flowExecutionRecordsRepository: FlowExecutionRecordsRepository;
  private flowBranchRecordsRepository: FlowBranchRecordsRepository;
  private flowExecutionContextRepository: FlowExecutionContextRepository;
  private flowPostFinishPlanRepository: FlowPostFinishPlanRepository;
  private flowPostFinishTaskRepository: FlowPostFinishTaskRepository;
  private flowImmediateMutationRepository: FlowImmediateMutationRepository;
  private nocodeRepository: NocodeRepository;
  private readonly scheduledLeaseByTodo = new Map<string, ScheduledLeaseContext>();
  private readonly activeWorkerNodeSteps = new Map<string, Map<string, FlowNodeExecutionStep>>();
  private timeoutTaskRunning = false;
  private workerFallbackCount = 0;

  private logWorkerFallback(scope: string, error: unknown) {
    this.workerFallbackCount += 1;
    if (this.workerFallbackCount === 1 || (this.workerFallbackCount & (this.workerFallbackCount - 1)) === 0) {
      this.logger.warn(`${scope}; fallbackCount=${this.workerFallbackCount}; error=${this.getFlowErrorMessage(error)}`);
    }
  }
  private immediateCrossTableRetryRunning = false;

  private withTodoOperationLock<T>(todoId: string | undefined, callback: () => Promise<T>) {
    return this.lock.acquire(`todo-operation:${todoId || "unknown"}`, callback);
  }

  private withTriggerTodoLock<T>(
    nocodeId: string,
    tableUID: TableUID,
    uuid: string,
    callback: () => Promise<T>,
  ) {
    // A UUID can be observed by overlapping mutation requests. Serialize only
    // that UUID; unrelated rows remain eligible for bounded parallelism.
    return this.lock.acquire(`trigger-todo:${nocodeId}:${tableUID}:${uuid}`, callback);
  }

  private getScheduledLease(options: BaseTodoOptions): ScheduledLeaseContext | undefined {
    const lease = (options as ScheduledTodoOptions).scheduledLease;
    if (!lease || !lease.runId || !lease.leaseOwner || !Number.isFinite(lease.leaseVersion)) return undefined;
    return lease;
  }

  private async assertScheduledLeaseContext(lease: ScheduledLeaseContext | undefined): Promise<void> {
    if (!lease) return;
    const active = await this.entityManager.findOne(FlowScheduledRun, {
      id: lease.runId,
      state: "running",
      leaseOwner: lease.leaseOwner,
      leaseVersion: lease.leaseVersion,
      leaseUntil: { $gt: Date.now() },
    }, { fields: ["id"], refresh: true });
    if (active) return;
    const error = new Error(`scheduled run lease lost: ${lease.runId}`) as Error & { code?: string };
    error.code = "SCHEDULED_RUN_LEASE_LOST";
    throw error;
  }

  /**
   * Fence a scheduled write in the same transaction that performs it. A
   * read-only lease check can pass just before another worker reclaims the
   * run; this conditional no-op update makes the write transaction win or
   * fail as one unit.
   */
  private async assertScheduledLeaseInTransaction(
    em: Pick<SqlEntityManager, "nativeUpdate">,
    lease: ScheduledLeaseContext | undefined,
  ): Promise<void> {
    if (!lease) return;
    const now = Date.now();
    const updated = await em.nativeUpdate(FlowScheduledRun, {
      id: lease.runId,
      state: "running",
      leaseOwner: lease.leaseOwner,
      leaseVersion: lease.leaseVersion,
      leaseUntil: { $gt: now },
    }, { state: "running" });
    if (updated) return;
    const error = new Error(`scheduled run lease lost: ${lease.runId}`) as Error & { code?: string };
    error.code = "SCHEDULED_RUN_LEASE_LOST";
    throw error;
  }

  private async assertScheduledLease(options: BaseTodoOptions): Promise<void> {
    await this.assertScheduledLeaseContext(this.getScheduledLease(options));
  }

  private async assertScheduledFlowLease(options: ScheduledFlowStartOptions): Promise<void> {
    if (options.leaseOwner === undefined || options.leaseVersion === undefined) return;
    const active = await this.entityManager.findOne(FlowScheduledRun, {
      id: options.runId,
      state: "running",
      leaseOwner: options.leaseOwner,
      leaseVersion: options.leaseVersion,
      leaseUntil: { $gt: Date.now() },
    }, { fields: ["id"], refresh: true });
    if (active) return;
    const error = new Error(`scheduled run lease lost: ${options.runId}`) as Error & { code?: string };
    error.code = "SCHEDULED_RUN_LEASE_LOST";
    throw error;
  }

  private getDefaultReadableStageCondition(): FormDataStageWhereCondition {
    return {
      $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
    };
  }

  private getDeleteTriggeredReadableStageCondition(): FormDataStageWhereCondition {
    return {
      // 删除流程在入队前已将记录移入回收站，后台执行期间仍需读取该记录。
      $nin: [FormDataStage.DRAFT],
    };
  }

  private getStartRecordSource(startRecord?: Pick<FlowExecutionRecords, "metas"> | null) {
    return Object.values(startRecord?.metas || {}).find((meta: any) => meta?.source)?.source;
  }

  private isDeleteTriggeredStartRecord(startRecord?: Pick<FlowExecutionRecords, "metas"> | null) {
    return this.getStartRecordSource(startRecord) === TODOTriggerType.DELETE;
  }

  private getTodoReadableStageCondition(startRecord?: Pick<FlowExecutionRecords, "metas"> | null): FormDataStageWhereCondition {
    return this.isDeleteTriggeredStartRecord(startRecord)
      ? this.getDeleteTriggeredReadableStageCondition()
      : this.getDefaultReadableStageCondition();
  }

  private getTodoReadableStageCacheKey(startRecord?: Pick<FlowExecutionRecords, "metas"> | null) {
    return this.isDeleteTriggeredStartRecord(startRecord) ? "delete-trigger" : "default";
  }

  private getTodoStartRecordCacheKey(
    options: Pick<BaseTodoOptions, "nocodeId" | "tableId" | "uuid"> & { todoId?: string },
  ) {
    return `${options.nocodeId}:${options.tableId}:${options.uuid}:${options.todoId || ""}`;
  }

  constructor(
    private readonly entityManager: SqlEntityManager,
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly workbenchService: WorkbenchService,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(forwardRef(() => FormDataService)) private readonly formDataService: FormDataService,
    @Inject(forwardRef(() => ProjectService)) private readonly projectService: ProjectService,
    @Optional() private readonly flowWorkerPool?: FlowWorkerPool,
  ) {
    this.flowExecutionRecordsRepository = this.entityManager.getRepository(FlowExecutionRecords);
    this.flowExecutionContextRepository = this.entityManager.getRepository(FlowExecutionContext);
    this.flowBranchRecordsRepository = this.entityManager.getRepository(FlowBranchRecords);
    this.flowPostFinishPlanRepository = this.entityManager.getRepository(FlowPostFinishPlan);
    this.flowPostFinishTaskRepository = this.entityManager.getRepository(FlowPostFinishTask);
    this.flowImmediateMutationRepository = this.entityManager.getRepository(FlowImmediateMutation);
    this.nocodeRepository = this.entityManager.getRepository(Nocode);
  }

  onApplicationBootstrap() {
    this.formDataService.migrateLegacyDeletingStagesOnce()
      .catch(err => this.logger.error("form data stage migration failed", err))
      .finally(() => {
        this.compatibleTodos();
        setImmediate(() => {
          this.recoverPostFinishPlans().catch(err => this.logger.error("recover post finish plans failed", err));
          this.recoverImmediateCrossTableTriggers().catch(err => this.logger.error("recover async cross-table flow triggers failed", err));
        });
      });
  }

  private async recoverImmediateCrossTableTriggers() {
    const records = await this.flowImmediateMutationRepository.find({
      source: "cross_table_node",
      triggerStatus: { $in: ["pending", "running"] },
    });
    if (!records.length) return;
    for (const record of records) {
      record.triggerStatus = "failed";
      record.triggerNextRetryAt = Date.now();
      record.triggerLastError = "async trigger interrupted by application restart";
    }
    await this.flowImmediateMutationRepository.persistAndFlush(records);
  }

  async resolveLegacyDeletingMigrationStage(
    nocodeId: string,
    tableId: TableUID,
    uuid: string,
    rowTodoId?: string,
    rowStatus?: ProcessNodeStatus,
    rowCurrentNode?: string[] | string,
  ) {
    const hasCurrentNode = Array.isArray(rowCurrentNode) ? rowCurrentNode.length > 0 : Boolean(rowCurrentNode);
    if (rowTodoId && rowStatus === ProcessNodeStatus.IN_PROGRESS && hasCurrentNode) {
      const activeRowRecord = await this.flowExecutionRecordsRepository.findOne({
        nocodeId,
        tableId,
        uuid,
        todoId: rowTodoId,
        status: ProcessNodeStatus.IN_PROGRESS,
      });
      if (activeRowRecord) return FormDataStage.DELETING;
    }
    const startRecords = await this.flowExecutionRecordsRepository.find({
      nocodeId,
      tableId,
      uuid,
      type: ProcessNodeType.START,
    }, {
      orderBy: { startTime: "DESC" },
    });
    for (const startRecord of startRecords) {
      if (!this.isDeleteTriggeredStartRecord(startRecord) || !startRecord.todoId) continue;
      const activeRecord = await this.flowExecutionRecordsRepository.findOne({
        todoId: startRecord.todoId,
        status: ProcessNodeStatus.IN_PROGRESS,
      });
      if (activeRecord) return FormDataStage.DELETING;
      if (startRecord.todoId !== rowTodoId) continue;
      if (hasCurrentNode) continue;
      const endRecord = await this.flowExecutionRecordsRepository.findOne({
        todoId: startRecord.todoId,
        type: ProcessNodeType.END,
        status: { $in: [ProcessNodeStatus.REJECTED, ProcessNodeStatus.CANCELED] },
      }, {
        orderBy: { startTime: "DESC" },
      });
      if (endRecord && endRecord.status === rowStatus) {
        return FormDataStage.NORMAL;
      }
    }
    return FormDataStage.DELETED;
  }
  private async getFlowNocodeBody(nocodeId: string, formData?: NocodeFormData) {
    // A scheduled run can traverse several nodes. Reuse its body snapshot so
    // every node does not rebuild the same application again.
    const request = RequestStorage.current?.req as ({
      scheduledNocodeBodies?: Map<string, NocodeBody>,
    }) | undefined;
    const scheduledNocodeBodies = request?.scheduledNocodeBodies;
    let nocodeBody = scheduledNocodeBodies?.get(nocodeId);
    if (!nocodeBody) {
      nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
      if (nocodeBody && scheduledNocodeBodies) scheduledNocodeBodies.set(nocodeId, nocodeBody);
    }
    if (!formData) return nocodeBody;
    return {
      ...nocodeBody,
      formData,
    };
  }

  private resolveProcessTargetTable(
    nocodeId: string,
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
    targetTableUID: TableUID,
  ): ResolvedProcessTargetTable {
    const sourceData = getNocodeDataSourceTableByUID(nocodeBody, targetTableUID, {
      nocodeId,
      includeSchemaSources: true,
    }, true);
    const targetFormData = (sourceData?.connection || nocodeBody?.formData) as NocodeFormData;
    const targetTable = sourceData?.table || nocodeBody?.formData?.tables?.find(item => item.uid === targetTableUID);
    const targetNocodeId = sourceData?.connection?.nocodeId || nocodeId;

    if (!targetFormData || !targetTable) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }

    return {
      targetNocodeId,
      targetFormData,
      targetTable,
      isCrossAppTarget: targetNocodeId !== nocodeId,
    };
  }

  private getProcessFormRootTableUID(formData: NocodeFormData, tableUID: TableUID) {
    let currentUID = tableUID;
    const visited = new Set<string>();
    while (currentUID && !visited.has(currentUID)) {
      visited.add(currentUID);
      const table = formData.tables.find(item => item.uid === currentUID);
      const primaryTableUID = table?.meta?.extra?.primaryTable?.[1];
      if (!primaryTableUID) {
        return currentUID;
      }
      currentUID = primaryTableUID;
    }
    return currentUID;
  }

  private isCurrentProcessFormTarget(
    options: BaseTodoOptions,
    formData: NocodeFormData,
    resolvedTarget: ResolvedProcessTargetTable,
  ) {
    if (resolvedTarget.targetNocodeId !== options.nocodeId) {
      return false;
    }
    return this.getProcessFormRootTableUID(formData, options.tableId)
      === this.getProcessFormRootTableUID(formData, resolvedTarget.targetTable.uid);
  }

  private getDataProcessingAction(type: ProcessNodeType) {
    if (type === ProcessNodeType.ADD_DATA) return DataChangeType.ADD;
    if (type === ProcessNodeType.EDIT_DATA) return DataChangeType.EDIT;
    return DataChangeType.DELETE;
  }

  private findFlowSequencePath(flows: ProcessFlow[], flowId: string, prefix: number[] = []): number[] {
    for (let flowIndex = 0; flowIndex < (flows || []).length; flowIndex++) {
      const flow = flows[flowIndex];
      const currentPath = [...prefix, flowIndex];
      if (flow.uid === flowId) {
        return currentPath;
      }
      for (let branchIndex = 0; branchIndex < (flow.branches || []).length; branchIndex++) {
        const nested = this.findFlowSequencePath(flow.branches[branchIndex].flows, flowId, [...currentPath, branchIndex]);
        if (nested.length) {
          return nested;
        }
      }
    }
    return [];
  }

  private compareSequencePath(left: number[] = [], right: number[] = []) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index++) {
      const result = (left[index] ?? -1) - (right[index] ?? -1);
      if (result !== 0) return result;
    }
    return 0;
  }

  private async getOrCreatePostFinishPlan(options: BaseTodoOptions) {
    if (!options.todoId) return null;
    return await this.lock.acquire(`post-finish-plan-create:${options.todoId}`, async () => {
      let plan = await this.flowPostFinishPlanRepository.findOne({ todoId: options.todoId });
      if (plan) return plan;
      const startRecord = await this.getStartRecord(options);
      plan = new FlowPostFinishPlan();
      plan.todoId = options.todoId;
      plan.nocodeId = options.nocodeId;
      plan.tableId = options.tableId;
      plan.uuid = options.uuid;
      plan.processVersion = startRecord?.processVersion;
      plan.status = "prepared";
      await this.flowPostFinishPlanRepository.persistAndFlush(plan);
      return plan;
    });
  }

  private async queuePostFinishTask(
    options: BaseTodoOptions,
    flows: ProcessFlow[],
    node: ProcessFlow,
    resolvedTarget: ResolvedProcessTargetTable,
    taskType: FlowPostFinishTask["taskType"],
    inputSnapshot?: Row,
    action?: DataChangeType,
    beforeSnapshot?: Row,
  ) {
    const plan = await this.getOrCreatePostFinishPlan(options);
    if (!plan) return null;
    return await this.lock.acquire(`post-finish-task-sequence:${options.todoId}`, async () => {
      const backCount = await this.flowExecutionRecordsRepository.count({
        todoId: options.todoId,
        status: ProcessNodeStatus.BACK,
      });
      const sameFlowCount = await this.flowPostFinishTaskRepository.count({
        todoId: options.todoId,
        flowId: node.uid,
      });
      const task = new FlowPostFinishTask();
      task.planId = plan.id;
      task.todoId = options.todoId;
      task.occurrenceId = unique(32);
      task.flowId = node.uid;
      task.nodeType = node.type;
      task.taskType = taskType;
      task.action = action || this.getDataProcessingAction(node.type);
      task.sequencePath = [backCount, ...this.findFlowSequencePath(flows, node.uid), sameFlowCount];
      task.sourceNocodeId = options.nocodeId;
      task.sourceTableId = options.tableId;
      task.sourceUuid = options.uuid;
      task.targetNocodeId = resolvedTarget.targetNocodeId;
      task.targetTableId = resolvedTarget.targetTable.uid;
      task.nodeSnapshot = deepClone(node);
      task.inputSnapshot = inputSnapshot ? deepClone(inputSnapshot) : undefined;
      task.beforeSnapshot = beforeSnapshot ? deepClone(beforeSnapshot) : undefined;
      await this.flowPostFinishTaskRepository.persistAndFlush(task);
      return task;
    });
  }

  private async recordImmediateMutation(
    todoId: string | undefined,
    source: FlowImmediateMutationSource,
    mutation: FlowNodeMutationResult,
    occurrenceId = unique(32),
    persist = true,
    knownSequence?: number,
    entityManager: EntityManager = this.entityManager,
    triggerTargetProcess?: boolean,
  ) {
    if (!todoId) return null;
    return await this.lock.acquire(`immediate-mutation-sequence:${todoId}`, async () => {
      const repository = entityManager.getRepository(FlowImmediateMutation);
      const sequence = knownSequence || await repository.count({ todoId }) + 1;
      const record = new FlowImmediateMutation();
      record.todoId = todoId;
      record.occurrenceId = occurrenceId;
      record.sequence = sequence;
      record.source = source;
      record.action = mutation.action;
      record.rollbackPolicy = source !== "trigger"
        ? "reverse"
        : mutation.action === DataChangeType.ADD
          ? "keep"
          : mutation.action === DataChangeType.EDIT
            ? "restore"
            : "cancel_delete";
      record.targetNocodeId = mutation.targetNocodeId;
      record.targetTableId = mutation.targetTableId;
      record.beforeSnapshot = deepClone(mutation.beforeRows || []);
      record.afterSnapshot = deepClone(mutation.afterRows || []);
      record.changedFieldUids = mutation.changedFieldUids || [];
      if (source === "cross_table_node" && triggerTargetProcess !== undefined) {
        record.triggerTargetProcess = triggerTargetProcess;
      }
      const firstRow = mutation.afterRows?.[0] || mutation.beforeRows?.[0];
      record.targetUuid = mutation.targetUuid || firstRow?.[SystemField.UUID];
      if (persist) {
        await repository.persistAndFlush(record);
      } else {
        repository.persist(record);
      }
      return record;
    });
  }

  private async recordCrossTableImmediateMutations(
    todoId: string | undefined,
    targetTable: Table,
    mutation: FlowNodeMutationResult,
    occurrenceId: string,
    triggerTargetProcess = true,
  ) {
    if (!todoId) {
      throw new Error("cross-table immediate mutation flow todo ID is empty");
    }
    const rows = mutation.action === DataChangeType.ADD ? mutation.afterRows : mutation.beforeRows;
    const records: FlowImmediateMutation[] = [];
    try {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const uuid = String(this.getRowUUID(targetTable, row) || "");
        if (!uuid) {
          throw new Error("cross-table immediate mutation target UUID is empty");
        }
        const beforeRow = mutation.beforeRows.find(item => String(this.getRowUUID(targetTable, item) || "") === uuid)
          || mutation.beforeRows[index];
        const afterRow = mutation.afterRows.find(item => String(this.getRowUUID(targetTable, item) || "") === uuid)
          || mutation.afterRows[index];
        const record = await this.recordImmediateMutation(todoId, "cross_table_node", {
          ...mutation,
          targetUuid: uuid,
          beforeRows: beforeRow ? [beforeRow] : [],
          afterRows: afterRow ? [afterRow] : [],
        }, occurrenceId, triggerTargetProcess);
        if (record) records.push(record);
      }
      return records;
    } catch (err) {
      (err as Error & { persistedMutationRecords?: FlowImmediateMutation[] }).persistedMutationRecords = records;
      throw err;
    }
  }

  private async compensateCrossTableMutationBeforeTrigger(
    resolvedTarget: ResolvedProcessTargetTable,
    mutation: FlowNodeMutationResult,
  ) {
    const uuidField = getUUIDSystemField(resolvedTarget.targetTable.fields);
    const key: OptionFieldUID = [
      resolvedTarget.targetFormData.uid,
      resolvedTarget.targetTable.uid,
      uuidField.uid,
    ];
    if (mutation.action === DataChangeType.ADD) {
      const addedRows = mutation.afterRows.filter(row => this.getRowUUID(resolvedTarget.targetTable, row));
      if (!addedRows.length) return;
      await this.formDataService.moveRowsToRecycleBin(
        resolvedTarget.targetFormData,
        mutation.targetNocodeId,
        mutation.targetTableId,
        deepClone(addedRows),
        [key],
      );
      return;
    }
    if (!mutation.beforeRows.length) return;
    await this.formDataService.restoreRowsFromSnapshot(
      resolvedTarget.targetFormData,
      mutation.targetNocodeId,
      mutation.targetTableId,
      deepClone(mutation.beforeRows),
      [key],
      "main",
      { triggerTodo: false, allowDataOwnerUpdate: true, ignoreUpdatePermissionDataStatus: true },
    );
  }

  private async getInstanceCrossTableExecutionMode(options: BaseTodoOptions, flows: ProcessFlow[]) {
    if (!options.todoId) return CrossTableExecutionMode.POST_FINISH;
    const startRecord = await this.getStartRecord(options);
    const entryId = Object.values(startRecord?.metas || {}).find(meta => meta?.entryId)?.entryId;
    const triggerNodeByEntry = flows[0]?.branches
      ?.find(branch => branch.uid === entryId)
      ?.flows?.[0];
    const triggerRecord = !triggerNodeByEntry
      ? (await this.flowExecutionRecordsRepository.find({ todoId: options.todoId }))
        .find(record => isTriggerNode(record.type))
      : null;
    const triggerNode = triggerNodeByEntry || (triggerRecord ? getFlowById(flows, triggerRecord.flowId) : null);
    return getCrossTableExecutionMode(triggerNode?.options);
  }

  private async getInstanceWaitCrossTableFlowCompletion(options: BaseTodoOptions, flows: ProcessFlow[]) {
    if (!options.todoId) return false;
    const startRecord = await this.getStartRecord(options);
    const entryId = Object.values(startRecord?.metas || {}).find(meta => meta?.entryId)?.entryId;
    const triggerNodeByEntry = flows[0]?.branches
      ?.find(branch => branch.uid === entryId)
      ?.flows?.[0];
    const triggerRecord = !triggerNodeByEntry
      ? (await this.flowExecutionRecordsRepository.find({ todoId: options.todoId }))
        .find(record => isTriggerNode(record.type))
      : null;
    const triggerNode = triggerNodeByEntry || (triggerRecord ? getFlowById(flows, triggerRecord.flowId) : null);
    return getWaitCrossTableFlowCompletion(triggerNode?.options);
  }

  private async getInstanceAllowCancel(
    options: BaseTodoOptions,
    flows: ProcessFlow[],
    startRecord?: FlowExecutionRecords | null,
  ) {
    const useStartRecord = startRecord ?? await this.getStartRecord(options);
    const entryId = Object.values(useStartRecord?.metas || {}).find(meta => meta?.entryId)?.entryId;
    const triggerNodeByEntry = flows[0]?.branches
      ?.find(branch => branch.uid === entryId)
      ?.flows?.[0];
    const triggerRecord = !triggerNodeByEntry && options.todoId
      ? (await this.flowExecutionRecordsRepository.find({ todoId: options.todoId }))
        .find(record => isTriggerNode(record.type))
      : null;
    const triggerNode = triggerNodeByEntry || (triggerRecord ? getFlowById(flows, triggerRecord.flowId) : null);
    return getAllowCancel(triggerNode?.options);
  }

  private async runImmediateCrossTableTriggers(
    options: BaseTodoOptions,
    resolvedTarget: ResolvedProcessTargetTable,
    mutation: FlowNodeMutationResult,
    records: FlowImmediateMutation[],
    shouldTriggerTargetProcess = true,
  ) {
    const triggerRows = mutation.action === DataChangeType.DELETE ? mutation.beforeRows : mutation.afterRows;
    const triggerContext = await this.getCurrentFlowTriggerContext(options);
    if (triggerRows.length > 1) {
      const mutationAction = mutation.action === DataChangeType.ADD
        ? "add"
        : mutation.action === DataChangeType.EDIT ? "edit" : "delete";
      const queued = await this.formDataService.enqueueFlowDerivedPostMutation({
        preparedTaskId: mutation.preparedTaskId,
        eventId: mutation.preparedTaskId
          ? `flow-node:${options.todoId}:${records[0]?.occurrenceId}:${mutationAction}`
          : `flow-derived:${options.todoId}:${records[0]?.id}:${records.length}`,
        source: mutation.action,
        formData: resolvedTarget.targetFormData,
        nocodeId: mutation.targetNocodeId,
        tableUID: mutation.targetTableId,
        rows: triggerRows,
        beforeMutationRows: mutation.beforeRows,
        triggerContext,
        causedByTodoId: options.todoId,
        finalizeDeleteWithoutFlow: mutation.action === DataChangeType.DELETE,
      });
      if (queued) return { triggered: false };
    }
    let result: FlowTriggerResult = { triggered: false };
    for (const record of records) {
      const row = triggerRows.find(item => (
        String(this.getRowUUID(resolvedTarget.targetTable, item) || "") === String(record.targetUuid || "")
      ));
      if (!row) continue;
      const beforeRow = mutation.beforeRows.find(item => (
        String(this.getRowUUID(resolvedTarget.targetTable, item) || "") === String(record.targetUuid || "")
      ));
      const currentResult = await this.formDataService.runPostMutationTasks(
        mutation.targetNocodeId,
        mutation.targetTableId,
        [row],
        mutation.action,
        {
          triggerTodo: shouldTriggerTargetProcess,
          triggerContext,
          causedByTodoId: options.todoId,
          causedByTaskId: record.id,
          beforeMutationRows: beforeRow ? [beforeRow] : [],
        },
        true,
      );
      if (currentResult.triggered) result = currentResult;
      if (mutation.action === DataChangeType.DELETE && !currentResult.triggered) {
        const uuidField = getUUIDSystemField(resolvedTarget.targetTable.fields);
        await this.formDataService.moveRowsToRecycleBin(
          resolvedTarget.targetFormData,
          mutation.targetNocodeId,
          mutation.targetTableId,
          [row],
          [[resolvedTarget.targetFormData.uid, mutation.targetTableId, uuidField.uid]],
        );
      }
    }
    return result;
  }

  private async runImmediateCrossTableTriggerRecords(
    options: BaseTodoOptions,
    resolvedTarget: ResolvedProcessTargetTable,
    mutation: FlowNodeMutationResult,
    records: FlowImmediateMutation[],
    shouldTriggerTargetProcess = true,
  ) {
    for (const record of records) {
      record.triggerStatus = "running";
      record.triggerAttemptCount = (record.triggerAttemptCount || 0) + 1;
      record.triggerLastError = undefined;
      record.triggerNextRetryAt = undefined;
      try {
        await this.flowImmediateMutationRepository.persistAndFlush(record);
      } catch (err) {
        record.triggerStatus = "failed";
        record.triggerLastError = this.getFlowErrorMessage(err);
        record.triggerNextRetryAt = record.triggerAttemptCount < IMMEDIATE_CROSS_TABLE_RETRY_LIMIT
          ? Date.now() + IMMEDIATE_CROSS_TABLE_RETRY_DELAY_MS
          : undefined;
        try {
          await this.flowImmediateMutationRepository.persistAndFlush(record);
        } catch (persistErr) {
          this.logger.error(`persist async cross-table flow trigger failure state failed: ${record.id}`, persistErr);
        }
        this.logger.error(`mark async cross-table flow trigger running failed: ${record.id}`, err);
        continue;
      }

      try {
        await this.runImmediateCrossTableTriggers(
          options,
          resolvedTarget,
          mutation,
          [record],
          shouldTriggerTargetProcess,
        );
      } catch (err) {
        record.triggerStatus = "failed";
        record.triggerLastError = this.getFlowErrorMessage(err);
        record.triggerNextRetryAt = record.triggerAttemptCount < IMMEDIATE_CROSS_TABLE_RETRY_LIMIT
          ? Date.now() + IMMEDIATE_CROSS_TABLE_RETRY_DELAY_MS
          : undefined;
        try {
          await this.flowImmediateMutationRepository.persistAndFlush(record);
        } catch (persistErr) {
          this.logger.error(`persist async cross-table flow trigger failure state failed: ${record.id}`, persistErr);
        }
        this.logger.error(`async cross-table flow trigger failed: ${record.id}`, err);
        continue;
      }

      record.triggerStatus = "success";
      record.triggeredAt = Date.now();
      try {
        await this.flowImmediateMutationRepository.persistAndFlush(record);
      } catch (err) {
        this.logger.error(`persist async cross-table flow trigger success state failed: ${record.id}`, err);
      }
    }
  }

  private scheduleImmediateCrossTableTriggers(
    options: BaseTodoOptions,
    resolvedTarget: ResolvedProcessTargetTable,
    mutation: FlowNodeMutationResult,
    records: FlowImmediateMutation[],
    shouldTriggerTargetProcess = true,
  ) {
    for (const record of records) {
      record.triggerStatus = "pending";
      record.triggerAttemptCount = record.triggerAttemptCount || 0;
    }
    this.flowImmediateMutationRepository.persistAndFlush(records).then(() => {
      setImmediate(() => {
        this.runImmediateCrossTableTriggerRecords(options, resolvedTarget, mutation, records, shouldTriggerTargetProcess)
          .catch(err => this.logger.error("async cross-table flow trigger batch failed", err));
      });
    }).catch(err => {
      this.logger.error("persist async cross-table flow trigger task failed", err);
      setImmediate(() => {
        this.runImmediateCrossTableTriggerRecords(options, resolvedTarget, mutation, records, shouldTriggerTargetProcess)
          .catch(triggerErr => this.logger.error("async cross-table flow trigger batch failed", triggerErr));
      });
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'Asia/Shanghai' })
  private async retryImmediateCrossTableTriggers() {
    if (this.immediateCrossTableRetryRunning) return;
    this.immediateCrossTableRetryRunning = true;
    try {
      const staleRecords = await this.flowImmediateMutationRepository.find({
        source: "cross_table_node",
        triggerStatus: "pending",
        createdAt: { $lte: Date.now() - IMMEDIATE_CROSS_TABLE_STALE_MS },
      }, { orderBy: { createdAt: "ASC" }, limit: 20 });
      if (staleRecords.length) {
        for (const record of staleRecords) {
          record.triggerStatus = "failed";
          record.triggerNextRetryAt = Date.now();
          record.triggerLastError = "async trigger state timed out and was recovered";
        }
        await this.flowImmediateMutationRepository.persistAndFlush(staleRecords);
      }
      const records = await this.flowImmediateMutationRepository.find({
        source: "cross_table_node",
        triggerStatus: "failed",
        triggerAttemptCount: { $lt: IMMEDIATE_CROSS_TABLE_RETRY_LIMIT },
        triggerNextRetryAt: { $lte: Date.now() },
      }, { orderBy: { createdAt: "ASC" }, limit: 20 });
      for (const record of records) {
        const startRecord = await this.flowExecutionRecordsRepository.findOne({
          todoId: record.todoId,
          type: ProcessNodeType.START,
        });
        if (!startRecord) continue;
        const nocodeBody = await this.getFlowNocodeBody(record.targetNocodeId).catch(() => null);
        const targetTable = nocodeBody?.formData?.tables?.find(item => item.uid === record.targetTableId);
        if (!nocodeBody || !targetTable) {
          record.triggerLastError = "target form or table not found";
          record.triggerNextRetryAt = undefined;
          await this.flowImmediateMutationRepository.persistAndFlush(record);
          continue;
        }
        const options: BaseTodoOptions = {
          nocodeId: startRecord.nocodeId,
          tableId: startRecord.tableId,
          uuid: startRecord.uuid,
          todoId: record.todoId,
        };
        await this.runImmediateCrossTableTriggerRecords(options, {
          targetNocodeId: record.targetNocodeId,
          targetFormData: nocodeBody.formData,
          targetTable,
          isCrossAppTarget: record.targetNocodeId !== startRecord.nocodeId,
        }, {
          action: record.action,
          targetNocodeId: record.targetNocodeId,
          targetTableId: record.targetTableId,
          targetUuid: record.targetUuid,
          beforeRows: record.beforeSnapshot || [],
          afterRows: record.afterSnapshot || [],
        }, [record], record.triggerTargetProcess ?? true);
      }
    } catch (err) {
      this.logger.error("retry async cross-table flow triggers failed", err);
    } finally {
      this.immediateCrossTableRetryRunning = false;
    }
  }

  private async captureTodoDisplaySnapshot(options: BaseTodoOptions) {
    if (!options.todoId) return null;
    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options);
    const triggerRowSnapshot = await this.getTriggerRowSnapshot(options.todoId);
    const displayRowSnapshot = currentRowContext?.currentRow || triggerRowSnapshot;
    if (displayRowSnapshot) {
      await this.updateFlowExecutionContext(options.todoId, {
        displayRowSnapshot: deepClone(displayRowSnapshot),
      });
    }
    return displayRowSnapshot ? deepClone(displayRowSnapshot) : null;
  }

  private async preparePostFinishPlan(options: BaseTodoOptions, completionRowSnapshot?: Row | null) {
    if (!options.todoId) return null;
    const plan = await this.flowPostFinishPlanRepository.findOne({ todoId: options.todoId });
    if (!plan || plan.status === "discarded") return plan;
    const startRecord = await this.getStartRecord(options);
    const triggerRowSnapshot = await this.getTriggerRowSnapshot(options.todoId);
    plan.completionRowSnapshot = this.isDeleteTriggeredStartRecord(startRecord)
      ? deepClone(triggerRowSnapshot)
      : completionRowSnapshot
        ? deepClone(completionRowSnapshot)
        : deepClone(triggerRowSnapshot);
    plan.finishReason = "normal_finish";
    plan.status = "prepared";
    await this.flowPostFinishPlanRepository.persistAndFlush(plan);
    return plan;
  }

  private async activatePostFinishPlan(plan?: FlowPostFinishPlan | null) {
    if (!plan || plan.status === "discarded") return;
    plan.status = "ready";
    await this.flowPostFinishPlanRepository.persistAndFlush(plan);
    setImmediate(() => {
      this.executePostFinishPlan(plan.id).catch(err => this.logger.error(`execute post finish plan failed: ${plan.id}`, err));
    });
  }

  private async executePostFinishTask(plan: FlowPostFinishPlan, task: FlowPostFinishTask) {
    const runtimeOptions: PostFinishRuntimeTodoOptions = {
      nocodeId: plan.nocodeId,
      tableId: plan.tableId,
      uuid: plan.uuid,
      todoId: plan.todoId,
      runtimeCurrentRowSnapshot: deepClone(plan.completionRowSnapshot),
      causedByTaskId: task.id,
    };
    if (task.taskType === "trigger_event") {
      const targetNocodeBody = await this.getFlowNocodeBody(task.targetNocodeId);
      const targetTable = targetNocodeBody.formData.tables.find(item => item.uid === task.targetTableId);
      const inputUUID = targetTable
        ? this.getRowUUID(targetTable, task.inputSnapshot)
        : task.inputSnapshot?.[SystemField.UUID];
      const useCompletionSnapshot = task.action !== DataChangeType.ADD
        && task.targetNocodeId === plan.nocodeId
        && task.targetTableId === plan.tableId
        && (!inputUUID || String(inputUUID) === String(plan.uuid));
      const triggerRow = useCompletionSnapshot ? plan.completionRowSnapshot : task.inputSnapshot;
      const rows = [deepClone(triggerRow || plan.completionRowSnapshot)].filter(Boolean);
      const currentTriggerContext = await this.getCurrentFlowTriggerContext(runtimeOptions);
      const triggerContext = currentTriggerContext;
      const result = await this.tryTriggerTodo(
        task.targetNocodeId,
        task.targetTableId,
        rows,
        task.action,
        triggerContext,
        undefined,
        false,
        {
          causedByTodoId: plan.todoId,
          causedByTaskId: task.id,
          beforeMutationRows: task.beforeSnapshot ? [deepClone(task.beforeSnapshot)] : [],
        },
      );
      task.resultSnapshot = result;
      return;
    }
    if (task.taskType === "report_data") {
      const nocodeBody = await this.getFlowNocodeBody(task.targetNocodeId);
      const targetTable = nocodeBody.formData.tables.find(item => item.uid === task.targetTableId);
      if (!targetTable) throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      const triggerContext = await this.getCurrentFlowTriggerContext(runtimeOptions);
      const uuidField = getUUIDSystemField(targetTable.fields);
      const inputRow = deepClone(task.inputSnapshot || {});
      const stableUUID = `${task.id}:0`;
      if (uuidField?.uid) inputRow[uuidField.uid] ||= stableUUID;
      const existingRow = uuidField?.uid
        ? await this.loadRollbackRowByUUID(nocodeBody.formData, task.targetNocodeId, targetTable, String(inputRow[uuidField.uid]))
        : null;
      if (existingRow) {
        await this.formDataService.runPostMutationTasks(
          task.targetNocodeId,
          task.targetTableId,
          [existingRow],
          DataChangeType.ADD,
          {
            triggerContext,
            causedByTodoId: plan.todoId,
            causedByTaskId: task.id,
          },
          true,
        );
        task.resultSnapshot = [existingRow];
        return;
      }
      const result = await this.formDataService.addData(
        nocodeBody.formData,
        task.targetNocodeId,
        task.targetTableId,
        [inputRow],
        {
          validatePermission: false,
          triggerContext,
          causedByTodoId: plan.todoId,
          causedByTaskId: task.id,
          failOnPostMutationError: true,
        },
      );
      task.resultSnapshot = result?.data;
      return;
    }
    if (task.nodeType === ProcessNodeType.ADD_DATA) {
      task.resultSnapshot = await this.startAddDataNode(runtimeOptions, task.nodeSnapshot, undefined);
    } else if (task.nodeType === ProcessNodeType.EDIT_DATA) {
      task.resultSnapshot = await this.startEditDataNode(runtimeOptions, task.nodeSnapshot, undefined);
    } else if (task.nodeType === ProcessNodeType.DELETE_DATA) {
      task.resultSnapshot = await this.startDeleteDataNode(runtimeOptions, task.nodeSnapshot);
    }
  }

  private async executePostFinishPlan(planId: string) {
    await RequestContext.createAsync(this.orm.em, async () => {
      await this.executePostFinishPlanInContext(planId);
    });
  }

  private async executePostFinishPlanInContext(planId: string) {
    await this.lock.acquire(`post-finish-plan:${planId}`, async () => {
      const plan = await this.flowPostFinishPlanRepository.findOne({ id: planId });
      if (!plan || !["ready", "running"].includes(plan.status)) return;
      plan.status = "running";
      plan.startedAt ||= Date.now();
      await this.flowPostFinishPlanRepository.persistAndFlush(plan);
      const tasks = await this.flowPostFinishTaskRepository.find({ planId });
      tasks.sort((left, right) => this.compareSequencePath(left.sequencePath, right.sequencePath));
      for (const task of tasks) {
        if (["success", "discarded"].includes(task.status)) continue;
        task.status = "running";
        task.startedAt = Date.now();
        task.attemptCount += 1;
        await this.flowPostFinishTaskRepository.persistAndFlush(task);
        try {
          await this.executePostFinishTask(plan, task);
          task.status = "success";
          task.successCount += 1;
          task.lastError = undefined;
        } catch (err) {
          task.status = (err as Error & { mutationCommitted?: boolean })?.mutationCommitted
            ? "partial_failed"
            : "failed";
          task.failedCount += 1;
          task.lastError = this.getFlowErrorMessage(err);
          this.logger.error(`post finish task failed: ${task.id}`, err);
        }
        task.finishedAt = Date.now();
        await this.flowPostFinishTaskRepository.persistAndFlush(task);
        await this.syncPostFinishTaskRecord(task);
      }
      const succeeded = tasks.filter(item => item.status === "success").length;
      const failed = tasks.filter(item => item.status === "failed").length;
      const partialFailed = tasks.filter(item => item.status === "partial_failed").length;
      plan.status = failed === 0 && partialFailed === 0
        ? "success"
        : (succeeded > 0 || partialFailed > 0) ? "partial_failed" : "failed";
      plan.finishedAt = Date.now();
      plan.lastError = tasks.find(item => item.lastError)?.lastError;
      await this.flowPostFinishPlanRepository.persistAndFlush(plan);
    });
  }

  private async syncPostFinishTaskRecord(task: FlowPostFinishTask) {
    if (!task.executionRecordId) return;
    const record = await this.flowExecutionRecordsRepository.findOne({ id: task.executionRecordId });
    if (!record) return;
    record.metas = record.metas || {};
    record.metas.__post_finish__ = {
      ...(record.metas.__post_finish__ || {}),
      tip: task.lastError || task.status,
      postFinishTaskId: task.id,
      postFinishTaskStatus: task.status,
      postFinishTaskAttemptCount: task.attemptCount,
    } as any;
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
  }

  private async recoverPostFinishPlans() {
    const plans = await this.flowPostFinishPlanRepository.find({
      status: { $in: ["prepared", "ready", "running"] },
    });
    for (const plan of plans) {
      if (plan.status === "prepared") {
        const endRecord = await this.flowExecutionRecordsRepository.findOne({
          todoId: plan.todoId,
          type: ProcessNodeType.END,
          status: ProcessNodeStatus.FINISHED,
        });
        if (!endRecord) continue;
      }
      const runningTasks = await this.flowPostFinishTaskRepository.find({ planId: plan.id, status: "running" });
      for (const task of runningTasks) task.status = "pending";
      if (runningTasks.length) await this.flowPostFinishTaskRepository.persistAndFlush(runningTasks);
      plan.status = "ready";
      await this.flowPostFinishPlanRepository.persistAndFlush(plan);
      await this.executePostFinishPlan(plan.id);
    }
  }

  private getRowUUID(table: Table, row?: Row | null) {
    const uuidField = getUUIDSystemField(table.fields);
    return row?.[uuidField?.uid] || row?.[SystemField.UUID];
  }

  private getRollbackChangedFieldUIDs(table: Table, beforeRow: Row = {}, afterRow: Row = {}, configured: string[] = []) {
    const configuredRootUIDs = configured
      .map(uid => uid?.split(".")?.[0])
      .filter(uid => {
        const field = uid ? table.fields.find(item => item.uid === uid) : null;
        return !!field && !isSystemField(field);
      });
    if (configuredRootUIDs.length) {
      return Array.from(new Set(configuredRootUIDs));
    }
    return table.fields
      .filter(field => !isSystemField(field) && !equals(beforeRow?.[field.uid], afterRow?.[field.uid]))
      .map(field => field.uid);
  }

  private async loadRollbackRowByUUID(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    uuid: string,
  ) {
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField?.uid || !uuid) return null;
    const [bucket] = await this.formDataService._getData(formData, [table.uid], nocodeId, {
      filters: {
        [table.uid]: [{ [uuidField.uid]: uuid }],
      },
      stage: {
        $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING, FormDataStage.DELETED, FormDataStage.DRAFT],
      },
    });
    const rows = await this.formDataService.fillSubFormField(bucket?.rows || [], nocodeId, table, formData);
    return rows?.[0] || null;
  }

  private async loadPersistedMutationRows(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    rows: Row[],
  ) {
    return await Promise.all(rows.map(async row => {
      const uuid = String(this.getRowUUID(table, row) || "");
      if (!uuid) return row;
      return await this.loadRollbackRowByUUID(formData, nocodeId, table, uuid) || row;
    }));
  }

  private async rollbackImmediateMutation(mutation: FlowImmediateMutation, reason: FlowRollbackReason) {
    const flowRelation = mutation.source === "cross_table_node" ? "upstream" : "current";
    const rollbackPolicy = mutation.rollbackPolicy || (
      mutation.source !== "trigger"
        ? "reverse"
        : mutation.action === DataChangeType.ADD
          ? "keep"
          : mutation.action === DataChangeType.EDIT
            ? "restore"
            : "cancel_delete"
    );
    if (rollbackPolicy === "keep") {
      mutation.status = "rolled_back";
      mutation.rolledBackAt = Date.now();
      await this.flowImmediateMutationRepository.persistAndFlush(mutation);
      return;
    }
    const nocodeBody = await this.getFlowNocodeBody(mutation.targetNocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(item => item.uid === mutation.targetTableId);
    const uuidField = getUUIDSystemField(table?.fields || []);
    if (!table || !uuidField?.uid) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    const beforeRows = mutation.beforeSnapshot || [];
    const afterRows = mutation.afterSnapshot || [];
    if (rollbackPolicy === "restore" && (!mutation.targetUuid || isEmpty(beforeRows))) {
      throw new Error("flow trigger rollback snapshot missing");
    }
    const snapshotRows = mutation.action === DataChangeType.ADD ? afterRows : beforeRows;
    const conflicts: Array<{ uuid: string, fields?: string[], reason?: string }> = [];

    for (let index = 0; index < snapshotRows.length; index++) {
      const beforeRow = beforeRows[index] || {};
      const afterRow = afterRows[index] || {};
      const uuid = String(this.getRowUUID(table, afterRow) || this.getRowUUID(table, beforeRow) || "");
      if (!uuid) continue;
      const currentRow = await this.loadRollbackRowByUUID(formData, mutation.targetNocodeId, table, uuid);

      if (mutation.action === DataChangeType.ADD) {
        if (!currentRow) continue;
        const changedFields = table.fields.filter(field => !isSystemField(field)).map(field => field.uid);
        const hasExternalChange = changedFields.some(uid => !equals(currentRow?.[uid], afterRow?.[uid]));
        if (hasExternalChange) {
          conflicts.push({ uuid, reason: "row_changed_after_flow_mutation" });
          continue;
        }
        await this.formDataService.moveRowsToRecycleBin(
          formData,
          mutation.targetNocodeId,
          mutation.targetTableId,
          [currentRow],
          [[formData.uid, table.uid, uuidField.uid]],
        );
        continue;
      }

      if (!currentRow && mutation.action === DataChangeType.DELETE) {
        conflicts.push({ uuid, reason: "row_not_found" });
        continue;
      }

      if (!currentRow) {
        conflicts.push({ uuid, reason: "row_not_found" });
        continue;
      }

      if (mutation.action === DataChangeType.DELETE) {
        const stageField = table.fields.find(field => field.meta.name === SystemField.DATA_STAGE);
        const restoredRow = deepClone(currentRow);
        if (stageField?.uid) {
          restoredRow[stageField.uid] = beforeRow?.[stageField.uid] ?? FormDataStage.NORMAL;
        }
        await this.formDataService.restoreRowsFromSnapshot(
          formData,
          mutation.targetNocodeId,
          mutation.targetTableId,
          [restoredRow],
          [[formData.uid, table.uid, uuidField.uid]],
          "main",
          { allowDataOwnerUpdate: true, ignoreUpdatePermissionDataStatus: true },
        );
        continue;
      }

      const restoredRow = deepClone(currentRow);
      const conflictFields: string[] = [];
      const changedFields = this.getRollbackChangedFieldUIDs(table, beforeRow, afterRow, mutation.changedFieldUids);
      for (const fieldUID of changedFields) {
        const currentValue = currentRow?.[fieldUID];
        const beforeValue = beforeRow?.[fieldUID];
        const afterValue = afterRow?.[fieldUID];
        if (equals(currentValue, afterValue)) {
          restoredRow[fieldUID] = deepClone(beforeValue);
        } else if (!equals(currentValue, beforeValue)) {
          conflictFields.push(fieldUID);
        }
      }
      if (conflictFields.length) conflicts.push({ uuid, fields: conflictFields });
      await this.formDataService.restoreRowsFromSnapshot(
        formData,
        mutation.targetNocodeId,
        mutation.targetTableId,
        [restoredRow],
        [[formData.uid, table.uid, uuidField.uid]],
        "main",
        { allowDataOwnerUpdate: true, ignoreUpdatePermissionDataStatus: true },
      );
    }

    mutation.status = conflicts.length ? "conflict" : "rolled_back";
    mutation.conflictDetail = conflicts.length ? conflicts : undefined;
    mutation.rolledBackAt = Date.now();
    await this.flowImmediateMutationRepository.persistAndFlush(mutation);
  }

  private async assessCrossTableTakeover(todoId: string, mutations: FlowImmediateMutation[]) {
    const mutationIds = mutations.map(item => item.id);
    const derivedContexts = await this.flowExecutionContextRepository.find({
      causedByTodoId: todoId,
      causedByTaskId: { $in: mutationIds },
    });
    const derivedTodoIds = derivedContexts.map(item => item.todoId).filter(Boolean);
    const terminalStatuses = [
      ProcessNodeStatus.FINISHED,
      ProcessNodeStatus.REJECTED,
      ProcessNodeStatus.CANCELED,
    ];
    if (derivedContexts.some(item => !terminalStatuses.includes(item.finalStatus))) {
      return { reason: "derived_flow_running", derivedTodoIds };
    }
    if (derivedTodoIds.length) {
      const humanRecords = await this.flowExecutionRecordsRepository.find({
        todoId: { $in: derivedTodoIds },
        type: {
          $in: [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA],
        },
      });
      const hasHumanRecord = humanRecords.some(record => (
        [record.paddingOperators, record.operators, record.submitRecords]
          .some(items => Array.isArray(items) && items.length > 0)
      ));
      if (hasHumanRecord) {
        return { reason: "derived_flow_human", derivedTodoIds };
      }
    }

    // 社区版没有审计日志接管检测，默认继续回滚流程变更。
    return null;
  }

  private async rollbackDirectCrossTableMutations(
    todoId: string,
    mutations: FlowImmediateMutation[],
    reason: FlowRollbackReason,
  ) {
    const groups = new Map<string, FlowImmediateMutation[]>();
    for (const mutation of mutations) {
      const key = `${mutation.targetNocodeId}:${mutation.targetTableId}:${mutation.targetUuid || ""}`;
      groups.set(key, [...(groups.get(key) || []), mutation]);
    }
    const orderedGroups = [...groups.values()].sort((left, right) => (
      Math.max(...right.map(item => item.sequence)) - Math.max(...left.map(item => item.sequence))
    ));
    for (const group of orderedGroups) {
      const takeover = await this.assessCrossTableTakeover(todoId, group);
      if (takeover) {
        for (const mutation of group) {
          mutation.status = "skipped";
          mutation.conflictDetail = {
            ...takeover,
            targetUuid: mutation.targetUuid,
            message: "target data was taken over; rollback skipped",
          };
          mutation.rolledBackAt = Date.now();
        }
        await this.flowImmediateMutationRepository.persistAndFlush(group);
        const mutation = group[0];
        const nocodeBody = await this.getFlowNocodeBody(mutation.targetNocodeId).catch(() => null);
        const table = nocodeBody?.formData?.tables?.find(item => item.uid === mutation.targetTableId);
        const row = nocodeBody && table && mutation.targetUuid
          ? await this.loadRollbackRowByUUID(nocodeBody.formData, mutation.targetNocodeId, table, mutation.targetUuid)
          : null;
        if (nocodeBody && row) {
        }
        continue;
      }
      for (const mutation of [...group].sort((left, right) => right.sequence - left.sequence)) {
        try {
          await this.rollbackImmediateMutation(mutation, reason);
        } catch (err) {
          mutation.status = "failed";
          mutation.conflictDetail = { message: this.getFlowErrorMessage(err) };
          await this.flowImmediateMutationRepository.persistAndFlush(mutation);
          this.logger.error(`rollback direct cross-table mutation failed: ${mutation.id}`, err);
        }
      }
    }
  }

  private async discardPendingPostFinishTasks(todoId: string) {
    const tasks = await this.flowPostFinishTaskRepository.find({
      todoId,
      status: "pending",
    });
    for (const task of tasks) {
      task.status = "discarded";
      task.finishedAt = Date.now();
    }
    if (tasks.length) {
      await this.flowPostFinishTaskRepository.persistAndFlush(tasks);
      for (const task of tasks) await this.syncPostFinishTaskRecord(task);
    }
  }

  private async rollbackAppliedFlowMutations(todoId: string, reason: FlowRollbackReason) {
    const mutations = await this.flowImmediateMutationRepository.find({
      todoId,
      status: "applied",
    });
    const directCrossTableMutations = mutations.filter(item => item.source === "cross_table_node");
    mutations.sort((left, right) => right.sequence - left.sequence);
    for (const mutation of mutations.filter(item => item.source !== "cross_table_node")) {
      try {
        await this.rollbackImmediateMutation(mutation, reason);
      } catch (err) {
        mutation.status = "failed";
        mutation.conflictDetail = { message: this.getFlowErrorMessage(err) };
        await this.flowImmediateMutationRepository.persistAndFlush(mutation);
        this.logger.error(`rollback immediate mutation failed: ${mutation.id}`, err);
      }
    }
    await this.rollbackDirectCrossTableMutations(todoId, directCrossTableMutations, reason);
  }

  private async rollbackBeforeContinueAfterReject(options: BaseTodoOptions) {
    if (!options.todoId) return;
    await this.discardPendingPostFinishTasks(options.todoId);
    await this.rollbackAppliedFlowMutations(options.todoId, "continue_reject");
  }

  private async discardPostFinishPlanAndRollback(
    options: BaseTodoOptions,
    finishReason: "terminal_reject" | "cancel",
  ) {
    if (!options.todoId) return;
    const executionContext = await this.getFlowExecutionContext(options.todoId);
    if (!executionContext?.displayRowSnapshot) {
      await this.captureTodoDisplaySnapshot(options);
    }
    const plan = await this.flowPostFinishPlanRepository.findOne({ todoId: options.todoId });
    if (plan && plan.status !== "discarded") {
      plan.status = "discarded";
      plan.finishReason = finishReason;
      plan.finishedAt = Date.now();
      const tasks = await this.flowPostFinishTaskRepository.find({ planId: plan.id });
      for (const task of tasks) {
        if (!['success', 'partial_failed'].includes(task.status)) task.status = "discarded";
      }
      if (tasks.length) {
        await this.flowPostFinishTaskRepository.persistAndFlush(tasks);
        for (const task of tasks) await this.syncPostFinishTaskRecord(task);
      }
      await this.flowPostFinishPlanRepository.persistAndFlush(plan);
    }
    await this.rollbackAppliedFlowMutations(
      options.todoId,
      finishReason === "cancel" ? "cancel" : "reject",
    );
    await this.updateFlowExecutionContext(options.todoId, {
      finalStatus: finishReason === "cancel" ? ProcessNodeStatus.CANCELED : ProcessNodeStatus.REJECTED,
    });
  }

  private async finalizeCurrentProcessRowDelete(options: BaseTodoOptions) {
    if (!options.todoId) return;
    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const table = nocodeBody.formData.tables.find(item => item.uid === options.tableId);
    if (!table) return;
    const mutations = await this.flowImmediateMutationRepository.find({
      todoId: options.todoId,
      source: "current_form_node",
      action: DataChangeType.DELETE,
      status: "applied",
    });
    for (const mutation of mutations) {
      const targetBody = mutation.targetNocodeId === options.nocodeId
        ? nocodeBody
        : await this.getFlowNocodeBody(mutation.targetNocodeId);
      const targetTable = targetBody.formData.tables.find(item => item.uid === mutation.targetTableId);
      const uuidField = getUUIDSystemField(targetTable?.fields || []);
      if (!targetTable || !uuidField?.uid || isEmpty(mutation.beforeSnapshot)) continue;
      await this.formDataService.moveRowsToRecycleBin(
        targetBody.formData,
        mutation.targetNocodeId,
        mutation.targetTableId,
        mutation.beforeSnapshot,
        [[targetBody.formData.uid, targetTable.uid, uuidField.uid]],
      );
    }
  }

  private async assertCrossAppWritePermission(
    sourceNocodeBody: Pick<NocodeBody, "settings">,
    resolvedTarget: ResolvedProcessTargetTable,
    action: DataChangeType,
  ) {
    if (!resolvedTarget.isCrossAppTarget) {
      return;
    }

    if (resolvedTarget.targetTable.meta?.extra?.primaryTable) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }

    const forms = sourceNocodeBody?.settings?.crossApp?.forms || [];
    const hasWritePermission = forms.some(item => {
      return item?.nocodeId === resolvedTarget.targetNocodeId
        && item?.tableUID === resolvedTarget.targetTable.uid;
    });
    if (!hasWritePermission) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }

    const account = await this.formDataService.getAccount().catch(() => null);
    await this.projectService.assertCrossAppFlowWritePermission(
      resolvedTarget.targetNocodeId,
      resolvedTarget.targetTable.uid,
      action,
      account || undefined,
    );
  }

  private normalizeProcessVersion(version?: number | null) {
    return Number.isInteger(version) && version > 0 ? version : 1;
  }

  private getNodeTimeoutConfig(node?: ProcessFlow | null) {
    return (node?.options as any)?.timeout || null;
  }

  private getTimeoutMeta(record: FlowExecutionRecords) {
    return record.metas?.[TIMEOUT_META_KEY];
  }

  private ensureTimeoutMeta(record: FlowExecutionRecords) {
    const metas = record.metas || {};
    const meta = metas[TIMEOUT_META_KEY] || this.ensureFlowRecordMeta(record, TIMEOUT_META_KEY);
    meta.timeoutRuleExecutedAtMap = meta.timeoutRuleExecutedAtMap || {};
    metas[TIMEOUT_META_KEY] = meta;
    record.metas = metas;
    return meta;
  }

  private async getFlowByExecutionRecord(record: FlowExecutionRecords, nocodeBodyOverride?: NocodeBody | null) {
    const nocodeBody = !nocodeBodyOverride
      ? await getNocodeBody(this.nocodesDir, record.nocodeId).catch(() => null)
      : nocodeBodyOverride;
    const process = nocodeBody?.formData?.formOptions?.[record.tableId]?.process;
    if (!process) {
      return null;
    }
    const flows = await this.getInstanceFlows(process, {
      nocodeId: record.nocodeId,
      tableId: record.tableId,
      uuid: record.uuid,
      todoId: record.todoId,
    }, record);
    return getFlowById(flows, record.flowId) || null;
  }

  private buildTodoProcessingTime(record: FlowExecutionRecords, flow?: ProcessFlow | null) {
    const timeout = this.getNodeTimeoutConfig(flow);
    const timeoutMeta = this.getTimeoutMeta(record);
    const deadlineAt = Number(timeoutMeta?.timeoutDeadlineAt);
    if (!timeout?.enabled || !Number.isFinite(deadlineAt)) {
      return { deadlineAt: null };
    }

    return { deadlineAt };
  }

  private async getTimeoutExecutorUserId(record: FlowExecutionRecords) {
    const admin = await this.workbenchService.getAdmin().catch(() => null);
    if (admin?.id) {
      return admin.id;
    }
    const validPendingUsers = await this.workbenchService.filterValidUsers(record.paddingOperators || []).catch(() => []);
    if (validPendingUsers?.[0]?.id) {
      return validPendingUsers[0].id;
    }
    const validOperators = await this.workbenchService.filterValidUsers(record.operators || []).catch(() => []);
    if (validOperators?.[0]?.id) {
      return validOperators[0].id;
    }
    return null;
  }

  private getTimeoutRuleBaseOptions(record: FlowExecutionRecords) {
    return {
      nocodeId: record.nocodeId,
      tableId: record.tableId,
      uuid: record.uuid,
      todoId: record.todoId,
      flowId: record.flowId,
      id: record.id,
    };
  }

  private async buildTimeoutSubmitOptions(record: FlowExecutionRecords, flow: ProcessFlow): Promise<SubmitTodoOptions | null> {
    const baseOptions = this.getTimeoutRuleBaseOptions(record);
    if (flow.type === ProcessNodeType.REPORT_DATA) {
      const row = await this.getTimeoutReportSubmitRow(record);
      if (!row) {
        this.logger.warn(`Skip timeout submit rule because report row is missing, recordId=${record.id}, flowId=${flow.uid}`);
        return null;
      }
      return {
        ...baseOptions,
        row,
      };
    }

    const startRecord = await this.getStartRecord(baseOptions);
    if (this.isEmptyRowTrigger(startRecord)) {
      return {
        ...baseOptions,
        row: {},
      };
    }

    const currentRowContext = await this.resolveRuntimeCurrentRowContext(baseOptions, { startRecord });
    if (!currentRowContext?.currentRow) {
      this.logger.warn(`Skip timeout submit rule because current row is missing, recordId=${record.id}, flowId=${flow.uid}`);
      return null;
    }

    return {
      ...baseOptions,
      row: currentRowContext.currentRow,
    };
  }

  private async executeTimeoutSubmitRule(record: FlowExecutionRecords, flow: ProcessFlow, rule: ProcessTimeoutRule) {
    const submitOptions = await this.buildTimeoutSubmitOptions(record, flow);
    if (!submitOptions) {
      this.logger.warn(`Skip timeout submit rule because submit options are unavailable, recordId=${record.id}, flowId=${flow.uid}, ruleId=${rule.uid}`);
      return false;
    }

    try {
      const result = await this.autoSubmitTodo(submitOptions);
      return Boolean(result?.isFinish);
    } catch (error) {
      this.logger.warn(`Execute timeout submit rule failed, recordId=${record.id}, flowId=${flow.uid}, ruleId=${rule.uid}: ${error.message}`);
      return false;
    }
  }

  private async buildTimeoutBackOptions(record: FlowExecutionRecords, flow: ProcessFlow, rule: ProcessTimeoutRule): Promise<BackTodoOptions | null> {
    if (!canRollbackFlow(flow) || !rule.backNodeId) {
      return null;
    }

    const nocodeBody = await this.getFlowNocodeBody(record.nocodeId).catch(() => null);
    const process = nocodeBody?.formData?.formOptions?.[record.tableId]?.process;
    if (!process) {
      return null;
    }
    const flows = await this.getInstanceFlows(process, this.getTimeoutRuleBaseOptions(record), record);
    const runtimeFlow = getFlowById(flows, record.flowId);
    if (!runtimeFlow || !canRollbackFlow(runtimeFlow)) {
      return null;
    }
    const hasRevertRange = Object.prototype.hasOwnProperty.call(runtimeFlow?.options ?? {}, 'revertRange');
    const rollbackTargetFlows = getRollbackTargetFlows(
      flows,
      record.flowId,
      hasRevertRange ? (runtimeFlow?.options?.revertRange || []) : undefined,
    );
    if (!rollbackTargetFlows.some(item => item.uid === rule.backNodeId)) {
      this.logger.warn(`Skip timeout back rule because target node is invalid, recordId=${record.id}, flowId=${flow.uid}, backNodeId=${rule.backNodeId}`);
      return null;
    }

    const submitOptions = await this.buildTimeoutSubmitOptions(record, flow);
    if (!submitOptions) {
      return null;
    }

    return {
      ...submitOptions,
      backId: rule.backNodeId,
    };
  }

  private async executeTimeoutBackRule(record: FlowExecutionRecords, flow: ProcessFlow, rule: ProcessTimeoutRule) {
    const userId = await this.getTimeoutExecutorUserId(record);
    if (!userId) {
      this.logger.warn(`Skip timeout back rule because executor is missing, recordId=${record.id}, flowId=${flow.uid}, ruleId=${rule.uid}`);
      return false;
    }

    const backOptions = await this.buildTimeoutBackOptions(record, flow, rule);
    if (!backOptions) {
      this.logger.warn(`Skip timeout back rule because back options are unavailable, recordId=${record.id}, flowId=${flow.uid}, ruleId=${rule.uid}`);
      return false;
    }

      try {
        await this.backTodo(backOptions, userId);
        const metas = record.metas || {};
        metas[userId] = metas[userId] || {};
        metas[userId].timeoutAutoAction = "back";
        record.metas = metas;
        await this.flowExecutionRecordsRepository.persistAndFlush(record);
        return true;
      } catch (error) {
        this.logger.warn(`Execute timeout back rule failed, recordId=${record.id}, flowId=${flow.uid}, ruleId=${rule.uid}: ${error.message}`);
        return false;
      }
  }

  private async getTimeoutReportSubmitRow(record: FlowExecutionRecords): Promise<Row | null> {
    const context = record.todoId
      ? await this.flowExecutionContextRepository.findOne({ todoId: record.todoId }).catch(() => null)
      : null;
    if (context?.data && typeof context.data === "object" && !Array.isArray(context.data)) {
      return context.data;
    }
    const todo = record.todoId
      ? await this.getTodo({ nocodeId: record.nocodeId, tableUID: record.tableId, uuid: record.uuid }, await this.getTimeoutExecutorUserId(record) || "")
        .catch(() => null)
      : null;
    const todoData = todo?.data;
    if (todoData && typeof todoData === "object" && !Array.isArray(todoData)) {
      return todoData;
    }
    return null;
  }

  private getEnabledProcessVersion(process?: NocodeProcess | null) {
    if (!process?.enabled) {
      return null;
    }
    const version = this.normalizeProcessVersion(process?.version);
    return this.getFlowsByVersion(process, version).length ? version : null;
  }

  private getRecordProcessVersion(record?: Pick<FlowExecutionRecords, "processVersion"> | null) {
    return this.normalizeProcessVersion(record?.processVersion);
  }

  private getFlowsByVersion(process?: NocodeProcess | null, version?: number | null) {
    return getFlows(process, this.normalizeProcessVersion(version)) || [];
  }

  private async getProcessVersionDeleteRecordCount(nocodeId: string, tableId: TableUID, version: number) {
    const normalizedVersion = this.normalizeProcessVersion(version);
    const exactCount = await this.flowExecutionRecordsRepository.count({
      nocodeId,
      tableId,
      processVersion: normalizedVersion,
    } as FilterQuery<FlowExecutionRecords>);
    if (normalizedVersion !== 1) {
      return exactCount;
    }
    const legacyCount = await this.flowExecutionRecordsRepository.count({
      nocodeId,
      tableId,
      processVersion: null,
    } as FilterQuery<FlowExecutionRecords>);
    return exactCount + legacyCount;
  }

  async getProcessVersionDeletable(nocodeId: string, tableId: TableUID, version: number) {
    const body = await getNocodeBody(this.nocodesDir, nocodeId).catch(() => null);
    const process = body?.formData?.formOptions?.[tableId]?.process;
    if (!process || !Number.isInteger(version) || version <= 0 || !this.getFlowsByVersion(process, version).length) {
      return {
        canDelete: false,
        hasData: false,
        versionStatus: null,
      };
    }

    const versionStatus = getProcessVersionStatus(process, version) || ProcessVersionStatus.DESIGNING;
    if (versionStatus === ProcessVersionStatus.DESIGNING) {
      return {
        canDelete: true,
        hasData: false,
        versionStatus,
      };
    }

    const hasData = await this.getProcessVersionDeleteRecordCount(nocodeId, tableId, version) > 0;

    return {
      canDelete: versionStatus === ProcessVersionStatus.HISTORY ? !hasData : false,
      hasData,
      versionStatus,
    };
  }

  private async getInstanceProcessVersion(
    options: Partial<BaseTodoOptions>,
    record?: Pick<FlowExecutionRecords, "processVersion"> | null,
  ) {
    if (Number.isInteger(record?.processVersion) && record.processVersion > 0) {
      return record.processVersion;
    }
    const startRecord = await this.getStartRecord(options);
    return this.getRecordProcessVersion(startRecord);
  }

  private async getInstanceFlows(
    process: NocodeProcess | null | undefined,
    options: Partial<BaseTodoOptions>,
    record?: Pick<FlowExecutionRecords, "processVersion"> | null,
  ) {
    if (!process) {
      return [];
    }
    const version = await this.getInstanceProcessVersion(options, record);
    return this.getFlowsByVersion(process, version);
  }

  async getRuntimeFlows(
    process: NocodeProcess | null | undefined,
    options: Partial<BaseTodoOptions>,
    record?: Pick<FlowExecutionRecords, "processVersion"> | null,
  ) {
    return await this.getInstanceFlows(process, options, record);
  }

  async findScheduledFlowExecution(runId: string): Promise<string | null> {
    if (!runId) return null;
    const record = await this.flowExecutionRecordsRepository.findOne({ scheduledRunId: runId, type: ProcessNodeType.START }, { refresh: true });
    if (!record?.todoId) return null;
    const progress = (Object.values(record.metas || {}) as FlowExecutionRecordMeta[])
      .find(meta => meta?.scheduledStartProgress)?.scheduledStartProgress;
    if (progress === "next_node_enqueued") return record.todoId;
    // Older rows do not have the progress marker. An END record is the only
    // durable evidence that their continuation completed before this marker
    // was introduced; an isolated START must be retried.
    const endRecord = await this.flowExecutionRecordsRepository.findOne({
      todoId: record.todoId,
      type: ProcessNodeType.END,
    }, { refresh: true });
    return endRecord ? record.todoId : null;
  }

  async startScheduledFlow(options: ScheduledFlowStartOptions): Promise<string | null> {
    const account = await this.workbenchService.getAdmin();
    if (!account) throw new Error("scheduled flow initiator is unavailable");
    return this.withTodoOperationLock(`scheduled-flow:${options.runId}`, () => RequestStorage.runWithRequest(
      { account, scheduledNocodeBodies: new Map<string, NocodeBody>() } as any,
      () => RequestContext.createAsync(this.orm.em, () => this.startScheduledFlowInContext(options)),
    ));
  }

  private async startScheduledFlowInContext(options: ScheduledFlowStartOptions): Promise<string | null> {
    await this.assertScheduledFlowLease(options);
    const existingStart = await this.flowExecutionRecordsRepository.findOne({
      scheduledRunId: options.runId,
      type: ProcessNodeType.START,
    }, { refresh: true });
    const body = await this.getFlowNocodeBody(options.nocodeId);
    if (!body?.formData) throw new Error(`scheduled flow body is unavailable: ${options.nocodeId}`);
    const process = body.formData.formOptions[options.tableId]?.process;
    const version = this.normalizeProcessVersion(Number(options.processVersion));
    const flows = this.getFlowsByVersion(process, version);
    const branch = this.findScheduledStartBranch(flows, options.nodeUid);
    const triggerFlow = getFlowById(flows, options.nodeUid);
    if (!process?.enabled || getProcessVersionStatus(process, version) !== ProcessVersionStatus.ENABLED || !flows.length || !branch || !triggerFlow) {
      throw new Error("scheduled process version or trigger node is unavailable");
    }
    if (options.initiatorUserId !== ADMIN_USERNAME) throw new Error("scheduled flow initiator is unavailable");
    const emptyRowTrigger = !options.uuid && !existingStart?.uuid;
    const scheduledLease = options.leaseOwner === undefined || options.leaseVersion === undefined
      ? undefined
      : { runId: options.runId, leaseOwner: options.leaseOwner, leaseVersion: options.leaseVersion };
    const todoOptions: ScheduledTodoOptions = {
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: existingStart?.uuid || options.uuid || unique(32),
      todoId: options.todoId,
      source: TODOTriggerType.TIME,
      entryId: branch.uid,
      scheduledLease,
    };
    const startNode = { ...triggerFlow, type: ProcessNodeType.START } as ProcessFlow;
    const account = await this.workbenchService.getAdmin();
    const start = existingStart
      ? { todoId: existingStart.todoId || options.todoId, record: existingStart }
      : await this.createScheduledStartRecord(options, todoOptions, startNode, version, account.id, {
      [account.id]: {
        source: TODOTriggerType.TIME,
        entryId: branch.uid,
        timeTaskRepeat: triggerFlow.options?.repeat,
        timeTaskTriggerMode: triggerFlow.options?.triggerMode,
        singleOnceTimeTask: triggerFlow.options?.repeat === TimeTaskRepeat.ONECE && isTimeTaskSingleTriggerMode(triggerFlow.options),
        emptyRowTrigger,
        scheduledStartProgress: "recorded",
      },
    });
    if (!start) return null;
    const startRecord = start.record;
    const todoId = start.todoId || options.todoId;
    const scheduledTodoOptions: ScheduledTodoOptions = {
      ...todoOptions,
      todoId,
      uuid: startRecord?.uuid || todoOptions.uuid,
      scheduledLease,
    };
    if (scheduledLease && todoId) this.scheduledLeaseByTodo.set(todoId, scheduledLease);
    try {
      await this.assertScheduledLease(scheduledTodoOptions);
      const startMeta = this.getRecordMetaByUserId(startRecord, account.id);
      const progress = startMeta?.scheduledStartProgress;
      if (progress !== "row_updated" && progress !== "next_node_enqueued") {
        await this.assertScheduledLease(scheduledTodoOptions);
        await this.updateFlowData(scheduledTodoOptions, { status: ProcessNodeStatus.IN_PROGRESS, stage: FormDataStage.EDITING, version });
        if (startRecord) await this.markScheduledStartProgress(startRecord, account.id, "row_updated", scheduledTodoOptions);
      }
      const nextNode = getNextFlow(flows, triggerFlow.uid);
      if (progress !== "next_node_enqueued") {
        await this.assertScheduledLease(scheduledTodoOptions);
        await this.resumeScheduledContinuation(scheduledTodoOptions, flows, nextNode, account.id);
        if (startRecord) await this.markScheduledStartProgress(startRecord, account.id, "next_node_enqueued", scheduledTodoOptions);
      }
      return todoId;
    } finally {
      if (todoId) this.scheduledLeaseByTodo.delete(todoId);
    }
  }

  private isScheduledWaitingNode(node: ProcessFlow) {
    return [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(node.type);
  }

  private async resumeScheduledContinuation(
    options: BaseTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow | null | undefined,
    initiatorId: string,
  ): Promise<void> {
    if (!node) return;
    await this.assertScheduledLease(options);

    const existing = await this.getLatestFlowRecordByTodoId(options.todoId, node.uid);
    if (!existing) {
      await this.addNextNode(options, nodes, node, initiatorId);
      return;
    }

    if (existing.status === ProcessNodeStatus.IN_PROGRESS) {
      // Manual nodes deliberately stop the chain here. A transient node with
      // an unfinished record must remain retryable instead of being reported
      // as a successfully enqueued continuation.
      if (this.isScheduledWaitingNode(node)) return;
      throw new Error(`scheduled continuation node is incomplete: ${node.uid}`);
    }

    // An earlier attempt may have persisted this node and failed while
    // recursively creating a later node. Follow the durable execution records
    // until the first missing node instead of creating a duplicate record.
    await this.resumeScheduledContinuation(options, nodes, getNextFlow(nodes, node.uid), initiatorId);
  }

  private async markScheduledStartProgress(
    record: FlowExecutionRecords,
    accountId: string,
    progress: "recorded" | "row_updated" | "next_node_enqueued",
    options?: BaseTodoOptions,
  ) {
    const lease = options ? this.getScheduledLease(options) : undefined;
    if (!lease) {
      const existingMeta = this.getRecordMetaByUserId(record, accountId) || {};
      record.metas = {
        ...(record.metas || {}),
        [accountId]: {
          ...existingMeta,
          scheduledStartProgress: progress,
        },
      };
      await this.flowExecutionRecordsRepository.persistAndFlush(record);
      return;
    }

    await this.entityManager.transactional(async em => {
      await this.assertScheduledLeaseInTransaction(em, lease);
      const current = await em.findOne(FlowExecutionRecords, { id: record.id }, { refresh: true });
      if (!current) return;
      const existingMeta = this.getRecordMetaByUserId(current, accountId) || {};
      current.metas = {
        ...(current.metas || {}),
        [accountId]: {
          ...existingMeta,
          scheduledStartProgress: progress,
        },
      };
      em.persist(current);
      await em.flush();
      // Roll back the marker if the lease expired while the record was being
      // flushed. The next worker can then resume from the prior durable step.
      await this.assertScheduledLeaseInTransaction(em, lease);
      record.metas = current.metas;
    });
  }

  private async createScheduledStartRecord(
    options: ScheduledFlowStartOptions,
    todoOptions: AddTodoOptions,
    startNode: ProcessFlow,
    version: number,
    accountId: string,
    metas: Record<string, FlowExecutionRecordMeta>,
  ): Promise<{ todoId: string, record?: FlowExecutionRecords } | null> {
    return this.entityManager.transactional(async em => {
      // The no-op write takes the system.sqlite write lease before lifecycle
      // reads, so recycle-bin commit and scheduled flow creation are ordered.
      const running = await em.nativeUpdate(FlowScheduledRun, {
        id: options.runId,
        scheduleId: options.scheduleId,
        configHash: options.configHash,
        lifecycleEpoch: options.lifecycleEpoch,
        state: "running",
        ...(options.leaseOwner === undefined ? {} : { leaseOwner: options.leaseOwner }),
        ...(options.leaseVersion === undefined ? {} : { leaseVersion: options.leaseVersion, leaseUntil: { $gt: Date.now() } }),
      }, { state: "running" });
      if (!running) return null;
      const existing = await em.findOne(FlowExecutionRecords, {
        scheduledRunId: options.runId,
        type: ProcessNodeType.START,
      }, { refresh: true });
      if (existing) return { todoId: existing.todoId, record: existing };
      const definition = await em.findOne(FlowScheduleDefinition, {
        id: options.scheduleId,
        nocodeId: options.nocodeId,
        tableId: options.tableId,
        processVersion: String(options.processVersion),
        nodeUid: options.nodeUid,
        configHash: options.configHash,
        lifecycleEpoch: options.lifecycleEpoch,
        state: "active",
      }, { refresh: true });
      const nocode = await em.findOne(Nocode, { id: options.nocodeId }, { refresh: true });
      if (!definition || !nocode || nocode.deleted === true) return null;
      const record = await this.createRecord(todoOptions, startNode, ProcessNodeStatus.FINISHED, version, {
        runId: options.runId,
        scheduledFor: options.scheduledFor,
      }, false);
      record.flowId = ProcessNodeType.START;
      record.operators = [accountId];
      record.metas = metas;
      const lease = this.getScheduledLease(todoOptions);
      await this.assertScheduledLeaseInTransaction(em, lease);
      await this.flowExecutionRecordsRepository.persistAndFlush(record);
      // If the lease expired while the record was being flushed, throw inside
      // the surrounding transaction so the START row is rolled back rather
      // than becoming an orphan that a later attempt must repair.
      await this.assertScheduledLeaseInTransaction(em, lease);
      return { todoId: record.todoId || options.todoId, record };
    });
  }

  private findScheduledStartBranch(flows: ProcessFlow[], uid: string): ProcessBranch | null {
    for (const start of (flows || []).filter(flow => flow.type === ProcessNodeType.START)) {
      const branch = (start.branches || []).find(item => item.flows?.[0]?.uid === uid);
      if (branch) return branch;
    }
    return null;
  }


  private buildJsonArrayContainsCondition(fieldName: string, value: string, exists: boolean): any {
    const type = this.entityManager.config.get("type");
    const escapedValue = JSON.stringify(value);
    const jsonArrayValue = JSON.stringify([value]);
    
    const fieldNameOnly = fieldName.includes('.') ? fieldName.split('.')[1] : fieldName;
    
    if (type === "mongo") {
      if (exists) {
        return {
          [fieldNameOnly]: value
        };
      } else {
        return {
          $or: [
            { [fieldNameOnly]: { $exists: false } },
            { [fieldNameOnly]: null },
            { [fieldNameOnly]: { $ne: value } }
          ]
        };
      }
    } else if (type === "sqlite" || type === "better-sqlite") {
      // SQLite: 使用 json_each
      if (exists) {
        return {
          __rawSql: `EXISTS (
            SELECT 1 FROM json_each(${fieldName})
            WHERE json_each.value = ?
          )`,
          __params: [value]
        };
      } else {
        return {
          __rawSql: `NOT EXISTS (
            SELECT 1 FROM json_each(${fieldName})
            WHERE json_each.value = ?
          )`,
          __params: [value]
        };
      }
    } else if (type === "mysql" || type === "mariadb") {
      // MySQL 5.7+: 使用 JSON_CONTAINS
      if (exists) {
        return {
          __rawSql: `JSON_CONTAINS(${fieldName}, ?) = 1`,
          __params: [escapedValue]
        };
      } else {
        return {
          __rawSql: `(${fieldName} IS NULL OR JSON_CONTAINS(${fieldName}, ?) IS NULL OR JSON_CONTAINS(${fieldName}, ?) = 0)`,
          __params: [escapedValue, escapedValue]
        };
      }
    } else if (type === "postgresql") {
      // PostgreSQL: 使用 @> 操作符（需�?jsonb 类型�?
      if (exists) {
        return {
          __rawSql: `${fieldName}::jsonb @> ?::jsonb`,
          __params: [jsonArrayValue]
        };
      } else {
        return {
          __rawSql: `(${fieldName} IS NULL OR NOT (${fieldName}::jsonb @> ?::jsonb))`,
          __params: [jsonArrayValue]
        };
      }
    } else {
      // 通用方案：使�?JSON 字符串匹配（适用于大多数数据库）
      const pattern = `%"${value}"%`; // 匹配 JSON 字符串格�?
      if (exists) {
        return {
          __rawSql: `${fieldName} LIKE ?`,
          __params: [pattern]
        };
      } else {
        return {
          __rawSql: `(${fieldName} IS NULL OR ${fieldName} NOT LIKE ?)`,
          __params: [pattern]
        };
      }
    }
  }

  private applyJsonArrayFilterCondition(qb: any, condition: OperatorMap<string>) {
    const dbType = this.entityManager.config.get("type");
    if (condition.$eq) {
      if (dbType === "mongo") {
        qb.andWhere({ operators: { $size: 1, $elemMatch: { $eq: condition.$eq } } });
      } else if (dbType === "sqlite" || dbType === "better-sqlite") {
        qb.andWhere(`json_extract(r.operators, '$[0]') = ?`, [condition.$eq]);
      } else if (dbType === "mysql" || dbType === "mariadb") {
        qb.andWhere(`JSON_EXTRACT(r.operators, '$[0]') = ?`, [JSON.stringify(condition.$eq)]);
      } else if (dbType === "postgresql") {
        qb.andWhere(`(r.operators::jsonb->>0) = ?`, [condition.$eq]);
      }
    } else if (condition.$ne) {
      if (dbType === "mongo") {
        qb.andWhere({
          $or: [
            { operators: { $not: { $size: 1 } } },
            { operators: { $not: { $elemMatch: { $eq: condition.$ne } } } }
          ]
        });
      } else if (dbType === "sqlite" || dbType === "better-sqlite") {
        qb.andWhere(`json_extract(r.operators, '$[0]') != ?`, [condition.$ne]);
      } else if (dbType === "mysql" || dbType === "mariadb") {
        qb.andWhere(`JSON_EXTRACT(r.operators, '$[0]') != ?`, [JSON.stringify(condition.$ne)]);
      } else if (dbType === "postgresql") {
        qb.andWhere(`(r.operators::jsonb->>0) != ?`, [condition.$ne]);
      }
    } else if (condition.$in && Array.isArray(condition.$in)) {
      if (dbType === "mongo") {
        qb.andWhere({ operators: { $size: 1, $elemMatch: { $in: condition.$in } } });
      } else if (dbType === "sqlite" || dbType === "better-sqlite") {
        const placeholders = condition.$in.map(() => '?').join(',');
        qb.andWhere(`json_extract(r.operators, '$[0]') IN (${placeholders})`, condition.$in);
      } else if (dbType === "mysql" || dbType === "mariadb") {
        const placeholders = condition.$in.map(() => '?').join(',');
        qb.andWhere(`JSON_EXTRACT(r.operators, '$[0]') IN (${placeholders})`, condition.$in.map(v => JSON.stringify(v)));
      } else if (dbType === "postgresql") {
        const placeholders = condition.$in.map((_, i) => `$${i + 1}`).join(',');
        qb.andWhere(`(r.operators::jsonb->>0) IN (${placeholders})`, condition.$in);
      }
    } else if (condition.$nin && Array.isArray(condition.$nin)) {
      if (dbType === "mongo") {
        qb.andWhere({
          $or: [
            { operators: { $not: { $size: 1 } } },
            { operators: { $not: { $elemMatch: { $in: condition.$nin } } } }
          ]
        });
      } else if (dbType === "sqlite" || dbType === "better-sqlite") {
        const placeholders = condition.$nin.map(() => '?').join(',');
        qb.andWhere(`json_extract(r.operators, '$[0]') NOT IN (${placeholders})`, condition.$nin);
      } else if (dbType === "mysql" || dbType === "mariadb") {
        const placeholders = condition.$nin.map(() => '?').join(',');
        qb.andWhere(`JSON_EXTRACT(r.operators, '$[0]') NOT IN (${placeholders})`, condition.$nin.map(v => JSON.stringify(v)));
      } else if (dbType === "postgresql") {
        const placeholders = condition.$nin.map((_, i) => `$${i + 1}`).join(',');
        qb.andWhere(`(r.operators::jsonb->>0) NOT IN (${placeholders})`, condition.$nin);
      }
    }
  }

  private applyJsonArrayCondition(qb: any, condition: any, prefix?: string): void {
    if (condition && condition.__rawSql) {
      const sql = prefix ? `${prefix} ${condition.__rawSql}` : condition.__rawSql;
      qb.andWhere(sql, condition.__params);
    } else {
      qb.andWhere(condition);
    }
  }

  private async compatibleTodos() {
    const qb = this.entityManager.createQueryBuilder<FlowExecutionRecords>("FlowExecutionRecords", "r");
    qb.where({
      status: ProcessNodeStatus.IN_PROGRESS,
    })
    qb.andWhere(`
      r.padding_operators IS NULL
    `)
    const records = await qb.getResult();
    if (isEmpty(records)) return;
    const recordGroups = records.reduce((prev, item) => {
      if (!prev[item.nocodeId]) prev[item.nocodeId] = { };
      if (!prev[item.nocodeId][item.tableId]) prev[item.nocodeId][item.tableId] = [];
      prev[item.nocodeId][item.tableId].push(item);
      return prev;
    }, {});

    const deletedRecords = [];
    const updateRecords = [];
    for (const nocodeId in recordGroups) {
      const group = recordGroups[nocodeId];
      const meta = await this.projectService.getNocodeMeta(nocodeId, false);
      if (!meta) {
        deletedRecords.push(...Object.values(group).flat(Infinity));
        continue;
      }
      const body = await getNocodeBody(this.nocodesDir, nocodeId).catch(() => null) as NocodeBody;
      for (const tableId in group) {
        const records: FlowExecutionRecords[] = group[tableId];
        const table = body?.formData?.tables?.find(item => item.uid === tableId);
        const process = body?.formData?.formOptions?.[tableId]?.process;
        if (!table || !process) {
          deletedRecords.push(...records);
          continue;
        }
        const flowVersionMap = new Map<number, ProcessFlow[]>();
        for (const record of records) {
          const processVersion = this.getRecordProcessVersion(record);
          let flows = flowVersionMap.get(processVersion);
          if (!flows) {
            flows = this.getFlowsByVersion(process, processVersion);
            flowVersionMap.set(processVersion, flows);
          }
          const flow = getFlowById(flows, record.flowId);
          if (!flow) {
            deletedRecords.push(record);
            continue;
          }
          let owners = await this.getOwnersByNode({
            nocodeId,
            tableId: tableId as TableUID,
            uuid: record.uuid,
            todoId: record.todoId,
          }, flow);
          if (record.transfer) {
            owners = owners.map(item => record.transferRecords[item]);
          }
          record.paddingOperators = owners;
          updateRecords.push(record);
        }
      }
    }
    await this.flowExecutionRecordsRepository.persistAndFlush(updateRecords);
    // TODO 删除�?deletedRecords
  }

  async initPluginTriggerNodesByFormData(option: { formData: NocodeFormData, nocodeId: string, time?: number, tableUIDs?: Iterable<string> }) {
    const { formData, nocodeId, time, tableUIDs } = option
    if (!formData || !Array.isArray(formData.tables)) return
    const targetTableUIDs = tableUIDs ? new Set(tableUIDs) : null
    const nowDate = Number.isInteger(time) ? new Date(time) : new Date()
    const nowTime = nowDate.getTime()
    for (const table of formData.tables) {
      if (targetTableUIDs && !targetTableUIDs.has(table.uid)) {
        continue;
      }
    }
  }

  private async updateFlowExecutionContext(
    todoId: string,
    data: Partial<Pick<FlowExecutionContext, "data" | "skipNodeIds" | "viewActionTriggerContext" | "triggerRowSnapshot" | "displayRowSnapshot" | "displaySnapshotAction" | "finalStatus" | "triggerContext" | "causedByTodoId" | "causedByTaskId">>,
    entityManager: EntityManager = this.entityManager,
    assumeNew = false,
  ) {
    await this.assertScheduledLeaseContext(this.scheduledLeaseByTodo.get(todoId));
    const repository = entityManager.getRepository(FlowExecutionContext);
    let context = assumeNew ? null : await repository.findOne({ todoId });
    if (!context) {
      context = new FlowExecutionContext();
      context.todoId = todoId;
    }
    if ("data" in data) {
      context.data = data.data;
    }
    if ("skipNodeIds" in data) {
      context.skipNodeIds = data.skipNodeIds;
    }
    if ("viewActionTriggerContext" in data) {
      context.viewActionTriggerContext = data.viewActionTriggerContext;
    }
    if ("triggerRowSnapshot" in data) {
      context.triggerRowSnapshot = data.triggerRowSnapshot;
    }
    if ("displayRowSnapshot" in data) {
      context.displayRowSnapshot = data.displayRowSnapshot;
    }
    if ("displaySnapshotAction" in data) {
      context.displaySnapshotAction = data.displaySnapshotAction;
    }
    if ("finalStatus" in data) {
      context.finalStatus = data.finalStatus;
    }
    if ("triggerContext" in data) {
      context.triggerContext = data.triggerContext;
    }
    if ("causedByTodoId" in data) {
      context.causedByTodoId = data.causedByTodoId;
    }
    if ("causedByTaskId" in data) {
      context.causedByTaskId = data.causedByTaskId;
    }
    await repository.persistAndFlush(context);
  }

  private async clearSkipNodeIds(todoId?: string) {
    if (!todoId) return;
    await this.updateFlowExecutionContext(todoId, { skipNodeIds: [] });
  }

  private async clearFlowExecutionState(todoId?: string) {
    if (!todoId) {
      return;
    }

    const contexts = await this.flowExecutionContextRepository.find({ todoId });
    if (!isEmpty(contexts)) {
      await this.flowExecutionContextRepository.removeAndFlush(contexts);
    }

    const branchRecords = await this.flowBranchRecordsRepository.find({ todoId });
    if (!isEmpty(branchRecords)) {
      await this.flowBranchRecordsRepository.removeAndFlush(branchRecords);
    }

    const executionRecords = await this.flowExecutionRecordsRepository.find({ todoId });
    if (!isEmpty(executionRecords)) {
      await this.flowExecutionRecordsRepository.removeAndFlush(executionRecords);
    }
  }

  private getFlowTriggerTargetKey(nocodeId: string, tableUID: TableUID) {
    return `${nocodeId}:${tableUID}`;
  }

  private async getCurrentFlowTriggerContext(options: BaseTodoOptions) {
    if (!options.todoId) {
      return;
    }
    const context = await this.flowExecutionContextRepository.findOne({ todoId: options.todoId });
    return context?.triggerContext || this.buildBaseFlowTriggerContext(options.nocodeId, options.tableId, options.todoId);
  }

  private buildBaseFlowTriggerContext(nocodeId: string, tableUID: TableUID, todoId: string): FlowTriggerContext {
    return {
      originNocodeId: nocodeId,
      originTableId: tableUID,
      originTodoId: todoId,
      importTaskId: undefined,
      triggerDepth: 0,
      triggerPath: [],
      visitedTargets: [
        this.getFlowTriggerTargetKey(nocodeId, tableUID),
      ],
    };
  }

  private buildNextTriggeredFlowContext(parentContext: FlowTriggerContext, nocodeId: string, tableUID: TableUID): FlowTriggerContext {
    const targetKey = this.getFlowTriggerTargetKey(nocodeId, tableUID);
    return {
      originNocodeId: parentContext.originNocodeId,
      originTableId: parentContext.originTableId,
      originTodoId: parentContext.originTodoId,
      importTaskId: parentContext.importTaskId,
      triggerDepth: parentContext.triggerDepth + 1,
      triggerPath: [
        ...(parentContext.triggerPath || []),
        targetKey,
      ],
      visitedTargets: Array.from(new Set([
        ...(parentContext.visitedTargets || []),
        targetKey,
      ])),
    };
  }

  private buildCrossAppTriggerMeta(
    resolvedTarget: ResolvedProcessTargetTable,
    action: DataChangeType,
    triggerResult?: FlowTriggerResult,
  ): Record<string, unknown> {
    if (!resolvedTarget.isCrossAppTarget) {
      return {};
    }

    return {
      crossAppWriteTargetNocodeId: resolvedTarget.targetNocodeId,
      crossAppWriteTargetTableUID: resolvedTarget.targetTable.uid,
      crossAppWriteAction: action,
      ...(triggerResult?.triggeredTodoId ? { crossAppTriggeredTodoId: triggerResult.triggeredTodoId } : {}),
      ...(triggerResult?.skippedReason ? { crossAppTriggerSkippedReason: triggerResult.skippedReason } : {}),
    };
  }

  private setRecordStashed(record: FlowExecutionRecords, userId: string, stashed: boolean) {
    if (stashed) {
      record.isStashed = true;
      record.stashTime = Date.now();
      record.stashOperatorId = userId;
      return;
    }
    record.isStashed = false;
    record.stashTime = undefined;
    record.stashOperatorId = undefined;
  }

  private clearRecordStashed(record: FlowExecutionRecords) {
    record.isStashed = false;
    record.stashTime = undefined;
    record.stashOperatorId = undefined;
  }

  private getRecordOwners(record: FlowExecutionRecords) {
    return Array.isArray(record?.paddingOperators)
      ? record.paddingOperators.filter((item): item is string => typeof item === "string" && !!item)
      : [];
  }

  private buildFlowRecordStashSnapshot(record: FlowExecutionRecords) {
    return {
      isStashed: record.isStashed,
      stashTime: record.stashTime,
      stashOperatorId: record.stashOperatorId,
      metas: record.metas ? deepClone(record.metas) : undefined,
    };
  }

  private getRecordMetaByUserId(record: FlowExecutionRecords, userId?: string) {
    if (!record?.metas) {
      return null;
    }
    if (userId && record.metas[userId]) {
      return record.metas[userId];
    }
    const operatorId = record?.operators?.[0] || record?.paddingOperators?.[0] || "";
    if (operatorId && record.metas[operatorId]) {
      return record.metas[operatorId];
    }
    return Object.values(record.metas)[0] || null;
  }

  private canOperateFlowRecord(record: FlowExecutionRecords, userId: string, owners?: string[]) {
    const resolvedOwners = Array.isArray(owners)
      ? owners.filter((item): item is string => typeof item === "string" && !!item)
      : this.getRecordOwners(record);
    if (!resolvedOwners.length) {
      return false;
    }
    return resolvedOwners.includes(userId);
  }

  private getReportDataStashedTargetMeta(
    record: FlowExecutionRecords,
    userId?: string,
  ): Pick<FlowExecutionRecordMeta, "stashedTargetNocodeId" | "stashedTargetTableUID" | "stashedTargetUUID"> | null {
    const meta = this.getRecordMetaByUserId(record, userId);
    if (!meta?.stashedTargetNocodeId || !meta?.stashedTargetTableUID || !meta?.stashedTargetUUID) {
      return null;
    }
    return {
      stashedTargetNocodeId: meta.stashedTargetNocodeId,
      stashedTargetTableUID: meta.stashedTargetTableUID,
      stashedTargetUUID: meta.stashedTargetUUID,
    };
  }

  private getNodeStashContext(contextData: any, flowId?: string): FlowNodeStashContext | null {
    if (!flowId || !contextData || typeof contextData !== "object") {
      return null;
    }
    const stashData = contextData[`__nodeStash__:${flowId}`];
    if (!stashData || typeof stashData !== "object") {
      return null;
    }
    return stashData;
  }

  private setNodeStashContext(contextData: any, flowId: string, value: FlowNodeStashContext | null) {
    const nextContextData = contextData && typeof contextData === "object"
      ? deepClone(contextData)
      : {};
    const key = `__nodeStash__:${flowId}`;
    if (value) {
      nextContextData[key] = value;
    } else {
      delete nextContextData[key];
    }
    return nextContextData;
  }

  private getReportDataStashContext(contextData: any, flowId?: string): ReportDataStashContext | null {
    if (!flowId || !contextData || typeof contextData !== "object") {
      return null;
    }
    const stashData = contextData[`__reportDataStash__:${flowId}`];
    if (!stashData || typeof stashData !== "object") {
      return null;
    }
    return stashData;
  }

  private setReportDataStashContext(contextData: any, flowId: string, value: ReportDataStashContext | null) {
    const nextContextData = contextData && typeof contextData === "object"
      ? deepClone(contextData)
      : {};
    const key = `__reportDataStash__:${flowId}`;
    if (value) {
      nextContextData[key] = value;
    } else {
      delete nextContextData[key];
    }
    return nextContextData;
  }

  private getDataChangeSubmittedTargetContext(contextData: any, flowId?: string): DataChangeSubmittedTargetContext | null {
    if (!flowId || !contextData || typeof contextData !== "object") {
      return null;
    }
    const targetData = contextData[`__submittedTarget__:${flowId}`];
    if (!targetData || typeof targetData !== "object") {
      return null;
    }
    return targetData;
  }

  private setDataChangeSubmittedTargetContext(
    contextData: any,
    flowId: string,
    value: DataChangeSubmittedTargetContext | null,
  ) {
    const nextContextData = contextData && typeof contextData === "object"
      ? deepClone(contextData)
      : {};
    const key = `__submittedTarget__:${flowId}`;
    if (value) {
      nextContextData[key] = value;
    } else {
      delete nextContextData[key];
    }
    return nextContextData;
  }

  private async getTodoDataChangeSubmittedTargetUUID(todoId?: string, flowId?: string) {
    if (!todoId || !flowId) {
      return "";
    }
    const executionContext = await this.getFlowExecutionContext(todoId);
    return String(this.getDataChangeSubmittedTargetContext(executionContext?.data, flowId)?.targetUUID || "");
  }

  private async setTodoDataChangeSubmittedTargetUUID(todoId: string | undefined, flowId: string, targetUUID?: string | null) {
    if (!todoId || !flowId) {
      return;
    }
    const executionContext = await this.getFlowExecutionContext(todoId);
    const nextContextData = this.setDataChangeSubmittedTargetContext(
      executionContext?.data,
      flowId,
      targetUUID ? { targetUUID: String(targetUUID) } : null,
    );
    await this.updateFlowExecutionContext(todoId, { data: nextContextData });
  }

  private async getLatestFlowRecordByTodoId(
    todoId: string | undefined,
    flowId: string | undefined,
  ) {
    if (!todoId || !flowId) {
      return null;
    }
    return await this.flowExecutionRecordsRepository.findOne({
      todoId,
      flowId,
    }, {
      orderBy: {
        startTime: "DESC",
      },
      refresh: true,
    });
  }

  private async moveTodoFlowContext(
    todoId: string | undefined,
    sourceFlowId: string | undefined,
    targetFlowId: string | undefined,
    options: {
      moveNodeStash?: boolean,
      moveReportStash?: boolean,
      moveSubmittedTarget?: boolean,
    } = {},
  ) {
    if (!todoId || !sourceFlowId || !targetFlowId || sourceFlowId === targetFlowId) {
      return;
    }
    const executionContext = await this.getFlowExecutionContext(todoId);
    if (!executionContext) {
      return;
    }
    let nextContextData = deepClone(executionContext.data && typeof executionContext.data === "object"
      ? executionContext.data
      : {});
    if (options.moveNodeStash) {
      const nodeStashContext = this.getNodeStashContext(nextContextData, sourceFlowId);
      nextContextData = this.setNodeStashContext(nextContextData, sourceFlowId, null);
      nextContextData = this.setNodeStashContext(nextContextData, targetFlowId, nodeStashContext);
    }
    if (options.moveReportStash) {
      const reportDataStashContext = this.getReportDataStashContext(nextContextData, sourceFlowId);
      nextContextData = this.setReportDataStashContext(nextContextData, sourceFlowId, null);
      nextContextData = this.setReportDataStashContext(nextContextData, targetFlowId, reportDataStashContext);
    }
    if (options.moveSubmittedTarget) {
      const submittedTargetContext = this.getDataChangeSubmittedTargetContext(nextContextData, sourceFlowId);
      nextContextData = this.setDataChangeSubmittedTargetContext(nextContextData, sourceFlowId, null);
      nextContextData = this.setDataChangeSubmittedTargetContext(nextContextData, targetFlowId, submittedTargetContext);
    }
    await this.updateFlowExecutionContext(todoId, { data: nextContextData });
  }

  private async getFlowExecutionContext(todoId?: string) {
    if (!todoId) {
      return null;
    }
    return await this.flowExecutionContextRepository.findOne({ todoId });
  }

  private async setFlowNodeStashContext(
    todoId: string | undefined,
    flowId: string,
    value: FlowNodeStashContext | null,
    rollbackContext?: StashMutationRollbackContext,
  ) {
    if (!todoId) {
      return;
    }
    const executionContext = await this.getFlowExecutionContext(todoId);
    if (rollbackContext) {
      rollbackContext.executionContextExisted = !!executionContext;
      rollbackContext.executionContextDataSnapshot = executionContext?.data;
    }
    const nextContextData = this.setNodeStashContext(executionContext?.data, flowId, value);
    await this.updateFlowExecutionContext(todoId, { data: nextContextData });
  }

  private async clearTodoNodeStashContext(
    todoId: string | undefined,
    flowId: string | undefined,
    clearReportDataStashContext = false,
  ) {
    if (!todoId || !flowId) {
      return;
    }
    try {
      const executionContext = await this.getFlowExecutionContext(todoId);
      if (!executionContext) {
        return;
      }
      let nextContextData = this.setNodeStashContext(executionContext.data, flowId, null);
      if (clearReportDataStashContext) {
        nextContextData = this.setReportDataStashContext(nextContextData, flowId, null);
      }
      await this.updateFlowExecutionContext(todoId, { data: nextContextData });
    } catch (error) {
      this.logger.error("clear node stash context failed", error);
    }
  }

  private async loadRowByUUID(
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    uuid: string,
  ) {
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField?.uid) {
      return null;
    }
    const [bucket] = await this.formDataService._getData(formData, [table.uid], nocodeId, {
      filters: {
        [table.uid]: [{
          [uuidField.uid]: uuid,
        }],
      },
    });
    const row = bucket?.rows?.find(item => String(item?.[uuidField.uid]) === String(uuid)) || bucket?.rows?.[0] || null;
    if (!row) {
      return null;
    }
    const [filledRow] = await this.formDataService.fillSubFormField([row], nocodeId, table, formData, {}, false, true);
    return filledRow || row;
  }

  private async writeReportDataRow(
    options: SubmitTodoOptions,
    flowRecord: FlowExecutionRecords,
    userId: string,
    reportResolvedTarget: ResolvedProcessTargetTable,
    deferTrigger = false,
  ): Promise<ReportDataWriteResult> {
    const targetUUIDField = getUUIDSystemField(reportResolvedTarget.targetTable.fields);
    const stashedTargetMeta = this.getReportDataStashedTargetMeta(flowRecord, userId);
    const stashedTargetUUID = (
      stashedTargetMeta?.stashedTargetNocodeId === reportResolvedTarget.targetNocodeId
      && stashedTargetMeta?.stashedTargetTableUID === reportResolvedTarget.targetTable.uid
    ) ? stashedTargetMeta.stashedTargetUUID : null;

    if (stashedTargetUUID && targetUUIDField?.uid) {
      const existedRow = await this.loadRowByUUID(
        reportResolvedTarget.targetFormData,
        reportResolvedTarget.targetNocodeId,
        reportResolvedTarget.targetTable,
        stashedTargetUUID,
      );
      if (existedRow) {
        const nextRow = {
          ...deepClone(options.row || {}),
          [targetUUIDField.uid]: stashedTargetUUID,
        };
        const normalizedExistedRow = {
          ...deepClone(existedRow),
          [targetUUIDField.uid]: stashedTargetUUID,
        };
        if (!equals(normalizedExistedRow, nextRow)) {
          const updated = await this.formDataService.updateData(
            reportResolvedTarget.targetFormData,
            reportResolvedTarget.targetNocodeId,
            reportResolvedTarget.targetTable.uid,
            [nextRow],
            [[reportResolvedTarget.targetFormData.uid, reportResolvedTarget.targetTable.uid, targetUUIDField.uid]],
          );
          const row = Array.isArray(updated?.data) ? (updated.data[0] || null) : existedRow;
          return {
            row,
            targetUUID: stashedTargetUUID,
          };
        }
        return {
          row: existedRow,
          targetUUID: stashedTargetUUID,
        };
      }
    }

    const triggerContext = await this.getCurrentFlowTriggerContext(options);
    const crossAppTriggerResult: FlowTriggerResult = {
      triggered: false,
    };
    const addOptions: TriggerOptions = {
      ...(deferTrigger ? { triggerTodo: false } : {}),
      ...(triggerContext ? { triggerContext } : {}),
      ...(reportResolvedTarget.isCrossAppTarget ? { crossAppTriggerResult } : {}),
    };
    const added = await this.formDataService.addData(
      reportResolvedTarget.targetFormData,
      reportResolvedTarget.targetNocodeId,
      reportResolvedTarget.targetTable.uid,
      [deepClone(options.row || {})],
      addOptions,
    );
    const row = Array.isArray(added?.data) ? (added.data[0] || null) : null;
    const targetUUID = row?.[SystemField.UUID] || row?.[targetUUIDField?.uid];
    if (targetUUID) {
      const meta = this.ensureFlowRecordMeta(flowRecord, userId);
      meta.stashedTargetNocodeId = reportResolvedTarget.targetNocodeId;
      meta.stashedTargetTableUID = reportResolvedTarget.targetTable.uid;
      meta.stashedTargetUUID = String(targetUUID);
      if (reportResolvedTarget.isCrossAppTarget) {
        Object.assign(
          meta,
          this.buildCrossAppTriggerMeta(reportResolvedTarget, DataChangeType.ADD, crossAppTriggerResult),
        );
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
    }
    return {
      row,
      targetUUID: targetUUID ? String(targetUUID) : null,
    };
  }

  private async rollbackStashMutation(
    options: SubmitTodoOptions,
    flowRecord: FlowExecutionRecords,
    rollbackContext: StashMutationRollbackContext,
  ) {
    const {
      flowRecordSnapshot,
      sourceRowSnapshot,
      sourceStage,
      executionContextDataSnapshot,
      reportResolvedTarget,
      reportTargetUUID,
      reportPreviousRowSnapshot,
    } = rollbackContext;

    if (options.todoId && (rollbackContext.executionContextExisted || executionContextDataSnapshot !== undefined)) {
      await this.updateFlowExecutionContext(options.todoId, {
        data: executionContextDataSnapshot,
      });
    }

    const shouldDeleteReportTargetRow = reportResolvedTarget && reportTargetUUID && !reportPreviousRowSnapshot;
    if (shouldDeleteReportTargetRow) {
      const rollbackTargetRow = await this.loadRowByUUID(
        reportResolvedTarget.targetFormData,
        reportResolvedTarget.targetNocodeId,
        reportResolvedTarget.targetTable,
        reportTargetUUID,
      );
      if (rollbackTargetRow) {
        await this.cancelInProgressTodosBeforeDelete(
          reportResolvedTarget.targetFormData,
          reportResolvedTarget.targetNocodeId,
          reportResolvedTarget.targetTable.uid,
          [rollbackTargetRow],
        ).catch((err) => {
          this.logger.error("rollback report target todo failed", err);
        });
      }
    }

    if (reportResolvedTarget && reportTargetUUID) {
      if (reportPreviousRowSnapshot) {
        const targetUUIDField = getUUIDSystemField(reportResolvedTarget.targetTable.fields);
        if (targetUUIDField?.uid) {
          await this.formDataService.tryUpdateData(
            reportResolvedTarget.targetFormData,
            reportResolvedTarget.targetNocodeId,
            reportResolvedTarget.targetTable.uid,
            [{
              ...deepClone(reportPreviousRowSnapshot),
              [targetUUIDField.uid]: reportTargetUUID,
            }],
            [[reportResolvedTarget.targetFormData.uid, reportResolvedTarget.targetTable.uid, targetUUIDField.uid]],
            null,
            {
              triggerTodo: false,
              validatePermission: false,
              allowDataOwnerUpdate: true,
            },
            {
              restoreFromSnapshot: true,
            },
          );
        }
      } else {
        await this.formDataService.deleteDataByUUID(
          reportResolvedTarget.targetNocodeId,
          reportResolvedTarget.targetTable.uid,
          String(reportTargetUUID),
        );
      }
    }

    if (sourceRowSnapshot) {
      const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
      const formData = nocodeBody.formData;
      const table = formData.tables.find(t => t.uid === options.tableId);
      const uuidField = getUUIDSystemField(table?.fields || []);
      if (table && uuidField?.uid) {
        await this.formDataService.tryUpdateData(
          formData,
          options.nocodeId,
          options.tableId,
          [{
            ...deepClone(sourceRowSnapshot),
            [uuidField.uid]: options.uuid,
          }],
          [[formData.uid, options.tableId, uuidField.uid]],
          sourceStage ?? null,
          {
            triggerTodo: false,
            validatePermission: false,
            allowDataOwnerUpdate: true,
            ignoreUpdatePermissionDataStatus: true,
          },
          {
            restoreFromSnapshot: true,
          },
        );
      }
    }

    if (flowRecordSnapshot) {
      flowRecord.isStashed = flowRecordSnapshot.isStashed;
      flowRecord.stashTime = flowRecordSnapshot.stashTime;
      flowRecord.stashOperatorId = flowRecordSnapshot.stashOperatorId;
      flowRecord.metas = flowRecordSnapshot.metas ? deepClone(flowRecordSnapshot.metas) : flowRecordSnapshot.metas;
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
    }
  }

  private cloneBranchRecord(record?: FlowBranchRecords | null) {
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      flowId: record.flowId,
      todoId: record.todoId,
      uuid: record.uuid,
      status: record.status,
      branchIds: deepClone(record.branchIds || []),
    };
  }

  private async buildSubmitTodoRollbackContext(
    options: SubmitTodoOptions,
    flowRecord: FlowExecutionRecords,
    flow: ProcessFlow,
    reportResolvedTarget?: ResolvedProcessTargetTable | null,
  ): Promise<SubmitTodoRollbackContext> {
    const context: SubmitTodoRollbackContext = {
      currentRecordSnapshot: flowRecord ? deepClone(flowRecord) : null,
      nextNodeRecordIdsBeforeSubmit: new Set(),
    };
    const startRecord = await this.getStartRecord(options);
    context.startRecordSnapshot = startRecord ? deepClone(startRecord) : null;
    const executionContext = await this.getFlowExecutionContext(options.todoId);
    context.executionContextExisted = !!executionContext;
    context.executionContextSnapshot = executionContext
      ? {
          data: deepClone(executionContext.data),
          skipNodeIds: deepClone(executionContext.skipNodeIds),
          viewActionTriggerContext: deepClone(executionContext.viewActionTriggerContext),
          triggerRowSnapshot: deepClone(executionContext.triggerRowSnapshot),
          triggerContext: deepClone(executionContext.triggerContext),
        }
      : null;

    const branchRecords = await this.flowBranchRecordsRepository.find({
      uuid: options.uuid,
      ...(options.todoId ? { todoId: options.todoId } : {}),
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    context.branchRecordSnapshots = branchRecords
      .map(record => this.cloneBranchRecord(record))
      .filter(Boolean);

    const currentRecords = await this.flowExecutionRecordsRepository.find({
      uuid: options.uuid,
      ...(options.todoId ? { todoId: options.todoId } : {}),
    });
    for (const record of currentRecords) {
      context.nextNodeRecordIdsBeforeSubmit.add(record.id);
    }

    if (flow.type !== ProcessNodeType.REPORT_DATA && options.uuid) {
      const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
      const formData = nocodeBody.formData;
      const table = formData.tables.find(item => item.uid === options.tableId);
      const sourceRow = table
        ? await this.loadRowByUUID(formData, options.nocodeId, table, options.uuid)
        : null;
      context.sourceRowSnapshot = sourceRow ? deepClone(sourceRow) : null;
      context.sourceRowExisted = !!sourceRow;
      if (table) {
        const stageField = table.fields.find(field => field.meta.name === SystemField.DATA_STAGE);
        context.sourceRowStage = sourceRow?.[stageField?.uid] ?? sourceRow?.[SystemField.DATA_STAGE] ?? null;
      }
      if (flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE) {
        context.submittedTargetUUID = await this.getTodoDataChangeSubmittedTargetUUID(options.todoId, flow.uid);
      }
    }

    if (reportResolvedTarget) {
      const reportUUID = this.getReportDataStashedTargetMeta(flowRecord)?.stashedTargetUUID || String(options.uuid || "");
      const reportRow = reportUUID
        ? await this.loadRowByUUID(
            reportResolvedTarget.targetFormData,
            reportResolvedTarget.targetNocodeId,
            reportResolvedTarget.targetTable,
            reportUUID,
          )
        : null;
      context.reportTargetSnapshot = {
        resolvedTarget: reportResolvedTarget,
        row: reportRow ? deepClone(reportRow) : null,
        uuid: reportRow?.[SystemField.UUID] || reportUUID || null,
      };
    }

    return context;
  }

  private async restoreFlowExecutionContextSnapshot(
    todoId: string | undefined,
    snapshot: SubmitTodoRollbackContext["executionContextSnapshot"],
    existed?: boolean,
  ) {
    if (!todoId) {
      return;
    }
    if (!existed && !snapshot) {
      await this.clearFlowExecutionState(todoId);
      return;
    }
    await this.updateFlowExecutionContext(todoId, {
      data: deepClone(snapshot?.data),
      skipNodeIds: deepClone(snapshot?.skipNodeIds),
      viewActionTriggerContext: deepClone(snapshot?.viewActionTriggerContext),
      triggerRowSnapshot: deepClone(snapshot?.triggerRowSnapshot),
      triggerContext: deepClone(snapshot?.triggerContext),
    });
  }

  private async rollbackSubmittedSourceRow(
    options: SubmitTodoOptions,
    rollbackContext: SubmitTodoRollbackContext,
  ) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(item => item.uid === options.tableId);
    const uuidField = getUUIDSystemField(table?.fields || []);
    if (!table || !uuidField?.uid) {
      return;
    }
    if (!rollbackContext.sourceRowExisted) {
      await this.formDataService.deleteDataByUUID(options.nocodeId, options.tableId, String(options.uuid));
      return;
    }
    if (!rollbackContext.sourceRowSnapshot) {
      return;
    }
    await this.formDataService.restoreRowsFromSnapshot(
      formData,
      options.nocodeId,
      options.tableId,
      [{
        ...deepClone(rollbackContext.sourceRowSnapshot),
        [uuidField.uid]: options.uuid,
      }],
      [[formData.uid, options.tableId, uuidField.uid]],
      "main",
      {
        allowDataOwnerUpdate: true,
        ignoreUpdatePermissionDataStatus: true,
      },
    );
  }

  private async rollbackSubmittedReportTarget(
    rollbackContext: SubmitTodoRollbackContext,
  ) {
    const snapshot = rollbackContext.reportTargetSnapshot;
    if (!snapshot?.resolvedTarget) {
      return;
    }
    const { resolvedTarget, row, uuid } = snapshot;
    const reportTargetUUID = rollbackContext.reportTargetUUID || uuid;
    if (!reportTargetUUID) {
      return;
    }
    if (!row) {
      await this.formDataService.deleteDataByUUID(
        resolvedTarget.targetNocodeId,
        resolvedTarget.targetTable.uid,
        String(reportTargetUUID),
      );
      return;
    }
    const uuidField = getUUIDSystemField(resolvedTarget.targetTable.fields);
    if (!uuidField?.uid) {
      return;
    }
    await this.formDataService.restoreRowsFromSnapshot(
      resolvedTarget.targetFormData,
      resolvedTarget.targetNocodeId,
      resolvedTarget.targetTable.uid,
      [{
        ...deepClone(row),
        [uuidField.uid]: reportTargetUUID,
      }],
      [[resolvedTarget.targetFormData.uid, resolvedTarget.targetTable.uid, uuidField.uid]],
      "main",
      {
        allowDataOwnerUpdate: true,
      },
    );
  }

  private async rollbackSubmitTodoMutation(
    options: SubmitTodoOptions,
    rollbackContext: SubmitTodoRollbackContext,
  ) {
    await this.restoreFlowExecutionContextSnapshot(
      options.todoId,
      rollbackContext.executionContextSnapshot,
      rollbackContext.executionContextExisted,
    );

    const existingBranchRecords = await this.flowBranchRecordsRepository.find({
      uuid: options.uuid,
      ...(options.todoId ? { todoId: options.todoId } : {}),
    });
    const branchRecordMap = new Map(existingBranchRecords.map(record => [record.id, record]));
    const snapshotBranchIds = new Set<string>();
    for (const snapshot of rollbackContext.branchRecordSnapshots || []) {
      snapshotBranchIds.add(snapshot.id);
      const current = branchRecordMap.get(snapshot.id);
      if (!current) continue;
      current.status = snapshot.status;
      current.branchIds = deepClone(snapshot.branchIds || []);
    }
    const extraBranchRecords = existingBranchRecords.filter(record => !snapshotBranchIds.has(record.id));
    if (extraBranchRecords.length) {
      await this.flowBranchRecordsRepository.removeAndFlush(extraBranchRecords);
    }
    const rollbackBranchRecords = existingBranchRecords.filter(record => snapshotBranchIds.has(record.id));
    if (rollbackBranchRecords.length) {
      await this.flowBranchRecordsRepository.persistAndFlush(rollbackBranchRecords);
    }

    const currentRecords = await this.flowExecutionRecordsRepository.find({
      uuid: options.uuid,
      ...(options.todoId ? { todoId: options.todoId } : {}),
    });
    const currentRecordMap = new Map(currentRecords.map(record => [record.id, record]));
    const recordsToRestore: FlowExecutionRecords[] = [];
    const restoredRecordIds = new Set<string>();
    if (rollbackContext.currentRecordSnapshot) {
      const currentRecord = currentRecordMap.get(rollbackContext.currentRecordSnapshot.id);
      if (currentRecord) {
        Object.assign(currentRecord, deepClone(rollbackContext.currentRecordSnapshot));
        recordsToRestore.push(currentRecord);
        restoredRecordIds.add(currentRecord.id);
      }
    }
    if (rollbackContext.startRecordSnapshot) {
      const startRecord = currentRecordMap.get(rollbackContext.startRecordSnapshot.id);
      if (startRecord) {
        Object.assign(startRecord, deepClone(rollbackContext.startRecordSnapshot));
        recordsToRestore.push(startRecord);
        restoredRecordIds.add(startRecord.id);
      }
    }
    const extraRecords = currentRecords.filter(record => {
      if (restoredRecordIds.has(record.id)) {
        return false;
      }
      return !(rollbackContext.nextNodeRecordIdsBeforeSubmit?.has(record.id));
    });
    if (extraRecords.length) {
      await this.flowExecutionRecordsRepository.removeAndFlush(extraRecords);
    }
    if (recordsToRestore.length) {
      await this.flowExecutionRecordsRepository.persistAndFlush(recordsToRestore);
    }

    await this.rollbackSubmittedReportTarget(rollbackContext);
    await this.rollbackSubmittedSourceRow(options, rollbackContext);
  }

  private async matchDataChangeTriggerBranch(
    nocodeBody: NocodeBody,
    nocodeId: string,
    tableUID: TableUID,
    source: DataChangeType,
    row: Row | undefined,
    options: {
      requireAllowStash?: boolean,
      useWorker?: boolean,
      workerQueue?: "p0" | "p1",
    } = {},
  ) {
    if (!row) {
      return null;
    }
    const process = nocodeBody.formData.formOptions[tableUID]?.process;
    const flows = getFlows(process);
    if (!process?.enabled || isEmpty(flows?.[0]?.branches)) {
      return null;
    }
    const table = nocodeBody.formData.tables.find(t => t.uid === tableUID);
    if (!table) {
      return null;
    }

    const branches = flows[0].branches.filter(branch => {
      const triggerNode = branch?.flows?.[0];
      if (triggerNode?.type !== ProcessNodeType.TRIGGER_DATA_CHANGE) {
        return false;
      }
      if (!triggerNode.options?.changeType?.includes(source)) {
        return false;
      }
      if (options.requireAllowStash && triggerNode.options?.allowStash !== true) {
        return false;
      }
      return branch.flows?.length >= 2;
    });
    if (isEmpty(branches)) {
      return null;
    }

    for (const branch of branches) {
      const triggerNode = branch.flows[0];
      const sourceTableRows = {
        [tableUID]: [row],
      };
      const { sourceTables, conditions } = triggerNode.options || {};
      const triggerConditionsEnabled = isDataChangeTriggerConditionsEnabled(triggerNode.options);
      if (triggerConditionsEnabled && !isEmpty(conditions)) {
        if (sourceTables) {
          await Promise.all(sourceTables.map(async (item) => {
            const filterRule = item.filterRule;
            sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, nocodeId, item.tableUID, filterRule, row, {
              fillSubTable: true,
              formulaRuntime: createFormulaRuntimeByData(row, table.fields),
            });
          }));
        }
        const normalizedConditions = await this.normalizeBranchConditions(
          {
            nocodeId,
            tableId: tableUID,
            uuid: String(row?.[SystemField.UUID] || ""),
          },
          flows,
          deepClone(conditions || []),
          sourceTableRows,
          null,
        );
        let isMeet: ReturnType<typeof isMeetConditionsByRow>;
        const conditionWorkerFlag = globalThis.process?.env?.FLOW_EXECUTION_TRIGGER_CONDITION_WORKER;
        const useWorker = options.useWorker === true
          && conditionWorkerFlag !== "false"
          && (globalThis.process?.env?.FLOW_EXECUTION_WORKER_MODE || "tinypool") === "tinypool"
          // Condition evaluation is pure and the pool deliberately runs it
          // without a database requirement.  Do not disable this offload
          // merely because the configured ORM type has no Gateway support.
          && Boolean(this.flowWorkerPool);
        if (useWorker) {
          try {
            const workerResult = await this.flowWorkerPool!.evaluateTriggerConditions({
              row,
              conditions: normalizedConditions,
              sourceTableRows,
              fields: table.fields,
            }, options.workerQueue || "p1");
            // Keep the worker protocol's optional diagnostic field compatible
            // with the legacy inline predicate contract.
            isMeet = {
              valid: workerResult.valid,
              errorMsg: workerResult.errorMsg || "",
            };
          } catch (error) {
            if ((options.workerQueue || "p1") === "p1") throw error;
            this.logWorkerFallback("P0 trigger condition worker failed; falling back inline", error);
            isMeet = isMeetConditionsByRow(row, normalizedConditions, sourceTableRows, table.fields);
          }
        } else {
          isMeet = isMeetConditionsByRow(row, normalizedConditions, sourceTableRows, table.fields);
        }
        if (!isMeet?.valid) {
          continue;
        }
      }
      return {
        branch,
        flows,
      };
    }

    return null;
  }

  async getDataChangeTriggerRowUUIDs(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[] = [],
    source: DataChangeType,
    triggerContext?: FlowTriggerContext,
  ) {
    if (isEmpty(rows) || ![DataChangeType.ADD, DataChangeType.EDIT, DataChangeType.DELETE].includes(source)) {
      return [];
    }

    // 与正式触发保持一致，先拦截循环触发和层级过深的场景。
    const targetKey = this.getFlowTriggerTargetKey(nocodeId, tableUID);
    const triggerPath = triggerContext?.triggerPath || [];
    const originKey = triggerContext
      ? this.getFlowTriggerTargetKey(triggerContext.originNocodeId, triggerContext.originTableId)
      : "";
    const currentFlowKey = triggerPath.at(-1) || originKey;
    const isSameTableTarget = Boolean(triggerContext && currentFlowKey === targetKey);
    const targetOccurrenceCount = triggerPath.filter(item => item === targetKey).length
      + (originKey === targetKey ? 1 : 0);
    const sameTableTriggerCount = isSameTableTarget
      ? Math.max(0, targetOccurrenceCount - 1)
      : 0;
    if (
      (isSameTableTarget && sameTableTriggerCount >= MAX_SAME_TABLE_TRIGGER_COUNT)
      || (triggerContext?.triggerDepth ?? 0) >= MAX_TRIGGER_DEPTH
      || (triggerContext?.visitedTargets?.includes(targetKey) && !isSameTableTarget)
    ) {
      return [];
    }

    const nocodeBody = await this.getFlowNocodeBody(nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(item => item.uid === tableUID);
    const process = formData.formOptions[tableUID]?.process;
    const flows = getFlows(process);
    if (!table || !process?.enabled || isEmpty(flows?.[0]?.branches)) {
      return [];
    }

    const candidateBranches = flows[0].branches.filter(branch => (
      branch.flows[0]?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      && branch.flows[0]?.options?.changeType?.includes(source)
      && branch.flows?.length >= 2
    ));
    if (isEmpty(candidateBranches)) {
      return [];
    }

    // 使用保存后的完整数据和既有分支匹配逻辑，避免仅因存在流程就误标记为排队中。
    // 活跃流程和业务行都按批次读取，避免批量提交时产生 2N 次数据库往返。
    const matchedUUIDs: string[] = [];
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField?.uid) return matchedUUIDs;
    const inputUUIDs = Array.from(new Set(rows
      .map(inputRow => String(this.getRowUUID(table, inputRow) || ""))
      .filter(Boolean)));
    if (!inputUUIDs.length) return matchedUUIDs;

    const activeUUIDs = new Set<string>();
    for (let offset = 0; offset < inputUUIDs.length; offset += DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) {
      const activeRecords = await this.flowExecutionRecordsRepository.find({
        uuid: { $in: inputUUIDs.slice(offset, offset + DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) },
        nocodeId,
        tableId: tableUID,
        status: ProcessNodeStatus.IN_PROGRESS,
      }, { fields: ["uuid"] });
      for (const record of activeRecords) {
        const uuid = String(record.uuid || "");
        if (uuid) activeUUIDs.add(uuid);
      }
    }
    const candidateUUIDs = inputUUIDs.filter(uuid => !activeUUIDs.has(uuid));
    if (!candidateUUIDs.length) return matchedUUIDs;

    // An unconditional data-change entry matches every non-active candidate.
    // Avoid re-reading and serially matching 10k rows when no condition can
    // change that result; conditional branches keep the strict path below.
    if (candidateBranches.some(branch => {
      const options = branch.flows[0]?.options || {};
      return !isDataChangeTriggerConditionsEnabled(options) || isEmpty(options.conditions);
    })) {
      return candidateUUIDs;
    }

    const currentRowByUUID = new Map<string, Row>();
    for (let offset = 0; offset < candidateUUIDs.length; offset += DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) {
      const uuidChunk = candidateUUIDs.slice(offset, offset + DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE);
      const buckets = await this.formDataService._getData(formData, [tableUID], nocodeId, {
        filters: {
          [tableUID]: [{
            [uuidField.uid]: { $in: uuidChunk },
          }],
        },
        stage: this.getDefaultReadableStageCondition(),
      });
      const currentRows = await this.formDataService.fillSubFormField(
        buckets[0]?.rows || [],
        nocodeId,
        table,
        formData,
      );
      for (const currentRow of currentRows || []) {
        const uuid = String(this.getRowUUID(table, currentRow) || "");
        if (uuid) currentRowByUUID.set(uuid, currentRow);
      }
    }
    for (const uuid of candidateUUIDs) {
      const matched = await this.matchDataChangeTriggerBranch(
        nocodeBody,
        nocodeId,
        tableUID,
        source,
        currentRowByUUID.get(uuid),
      );
      if (matched?.branch) matchedUUIDs.push(uuid);
    }

    return Array.from(new Set(matchedUUIDs));
  }

  private async findReusableDataChangeStashTodo(
    nocodeId: string,
    tableId: TableUID,
    uuid: string,
    source: TODOTriggerType,
    branchId: string,
    userId: string,
  ) {
    const startRecords = await this.flowExecutionRecordsRepository.find({
      nocodeId,
      tableId,
      uuid,
      type: ProcessNodeType.START,
    }, {
      orderBy: {
        startTime: "DESC",
      },
    });
    if (isEmpty(startRecords)) {
      return null;
    }

    for (const startRecord of startRecords) {
      const startMeta = this.getRecordMetaByUserId(startRecord, userId);
      if (startMeta?.source !== source || startMeta?.entryId !== branchId || !startRecord.todoId) {
        continue;
      }

      const triggerRecord = await this.flowExecutionRecordsRepository.findOne({
        nocodeId,
        tableId,
        uuid,
        todoId: startRecord.todoId,
        type: ProcessNodeType.TRIGGER_DATA_CHANGE,
        status: ProcessNodeStatus.IN_PROGRESS,
      }, {
        orderBy: {
          startTime: "DESC",
        },
      });
      if (!triggerRecord) {
        continue;
      }

      return {
        todoId: startRecord.todoId,
        startRecord,
        triggerRecord,
      };
    }

    return null;
  }

  private async stashDataChangeTriggerTodo(options: AddTodoOptions) {
    const account = await this.formDataService.getAccount();
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId].process;
    if (!process?.enabled) throw new Error(global.i18next.t('formFlowService.enableProcessFirstTips'));
    const processVersion = this.getEnabledProcessVersion(process);
    if (!processVersion) throw new Error(global.i18next.t('formFlowService.enableProcessFirstTips'));
    const dataChangeType = options.source === TODOTriggerType.EDIT
      ? DataChangeType.EDIT
      : DataChangeType.ADD;
    const matched = await this.matchDataChangeTriggerBranch(
      nocodeBody,
      options.nocodeId,
      options.tableId,
      dataChangeType,
      options.triggerRowSnapshot,
      {
        requireAllowStash: true,
      },
    );
    const branch = matched?.branch;
    const flows = matched?.flows || this.getFlowsByVersion(process, processVersion);
    if (!branch || branch.flows?.length < 2) {
      throw new Error(global.i18next.t('formFlowService.stashEntryInvalid'));
    }
    const startNode = flows[0];
    const triggerNode = branch.flows[0];
    if (triggerNode.options?.allowStash !== true) {
      throw new Error(global.i18next.t('formFlowService.stashEntryInvalid'));
    }
    const reusableTodo = await this.findReusableDataChangeStashTodo(
      options.nocodeId,
      options.tableId,
      options.uuid,
      options.source,
      branch.uid,
      account.id,
    );
    if (reusableTodo?.todoId) {
      const triggerContext = options.triggerContext || this.buildBaseFlowTriggerContext(options.nocodeId, options.tableId, reusableTodo.todoId);
      if (options.triggerRowSnapshot || triggerContext) {
        const executionContext = await this.getFlowExecutionContext(reusableTodo.todoId);
        const nextContextData = options.triggerRowSnapshot
          ? this.setNodeStashContext(executionContext?.data, triggerNode.uid, {
              row: deepClone(options.triggerRowSnapshot),
              source: options.source,
            })
          : executionContext?.data;
        await this.updateFlowExecutionContext(reusableTodo.todoId, {
          ...(nextContextData ? {
            data: nextContextData,
          } : {}),
          ...(options.triggerRowSnapshot ? {
            triggerRowSnapshot: deepClone(options.triggerRowSnapshot),
            displaySnapshotAction: options.source as unknown as DataChangeType,
          } : {}),
          triggerContext,
        });
      }
      this.setRecordStashed(reusableTodo.triggerRecord, account.id, true);
      const triggerMeta = this.ensureFlowRecordMeta(reusableTodo.triggerRecord, account.id);
      triggerMeta.updateTime = Date.now();
      await this.flowExecutionRecordsRepository.persistAndFlush(reusableTodo.triggerRecord);
      return reusableTodo.todoId;
    }

    const todoId = unique(32);
    try {
      const startRecord = await this.createRecord(options, startNode, ProcessNodeStatus.FINISHED, processVersion);
      startRecord.todoId = todoId;
      startRecord.operators = [account.id];
      startRecord.metas = {
        [account.id]: {
          source: options.source,
          entryId: branch.uid,
        }
      };
      await this.flowExecutionRecordsRepository.persistAndFlush(startRecord);

      const record = await this.createRecord({ ...options, todoId }, triggerNode, ProcessNodeStatus.IN_PROGRESS, processVersion);
      record.paddingOperators = [account.id];
      record.operators = [];
      this.setRecordStashed(record, account.id, true);
      await this.flowExecutionRecordsRepository.persistAndFlush(record);

      const triggerContext = options.triggerContext || this.buildBaseFlowTriggerContext(options.nocodeId, options.tableId, todoId);
      if (options.triggerRowSnapshot || triggerContext) {
        const nextContextData = options.triggerRowSnapshot
          ? this.setNodeStashContext({}, triggerNode.uid, {
              row: deepClone(options.triggerRowSnapshot),
              source: options.source,
            })
          : undefined;
        await this.updateFlowExecutionContext(todoId, {
          ...(nextContextData ? {
            data: nextContextData,
          } : {}),
          ...(options.triggerRowSnapshot ? {
            triggerRowSnapshot: deepClone(options.triggerRowSnapshot),
            displaySnapshotAction: options.source as unknown as DataChangeType,
          } : {}),
          triggerContext,
        });
      }
      return todoId;
    } catch (error) {
      try {
        await this.clearFlowExecutionState(todoId);
      } catch (rollbackError) {
        this.logger.error("stash data change trigger rollback failed", rollbackError);
      }
      throw error;
    }
  }

  async createDataChangeStashTodo(
    nocodeId: string,
    tableUID: TableUID,
    row: Row,
    source: DataChangeType,
    triggerContext?: FlowTriggerContext,
  ): Promise<FlowTriggerResult> {
    if (!row) {
      return { triggered: false };
    }
    const todoId = await this.stashDataChangeTriggerTodo({
      nocodeId,
      tableId: tableUID,
      uuid: String(row[SystemField.UUID] || ""),
      source: source === DataChangeType.EDIT ? TODOTriggerType.EDIT : TODOTriggerType.ADD,
      entryId: "",
      stashRequested: true,
      triggerContext,
      triggerRowSnapshot: deepClone(row),
    }).catch((err) => {
      if (err?.message === global.i18next.t('formFlowService.stashEntryInvalid')) {
        return "";
      }
      throw err;
    });
    if (!todoId) {
      return {
        triggered: false,
        skippedReason: "no-process",
      };
    }
    return {
      triggered: true,
      triggeredTodoId: todoId,
    };
  }

  private getTimeTaskStartMeta(startRecord?: FlowExecutionRecords | null) {
    if (!startRecord?.metas) return null;
    return Object.values(startRecord.metas).find(meta => meta?.source === TODOTriggerType.TIME) || null;
  }

  private getOperationTriggerStartMeta(startRecord?: FlowExecutionRecords | null) {
    if (!startRecord?.metas) return null;
    return Object.values(startRecord.metas).find(meta => meta?.source === TODOTriggerType.OPERATION) || null;
  }

  private getEmptyRowTriggerStartMeta(startRecord?: FlowExecutionRecords | null) {
    if (!startRecord?.metas) return null;
    return Object.values(startRecord.metas).find(meta => meta?.emptyRowTrigger) || null;
  }

  private isEmptyRowTrigger(startRecord?: FlowExecutionRecords | null) {
    return Boolean(this.getEmptyRowTriggerStartMeta(startRecord));
  }

  private isOperationEmptyRowTrigger(startRecord?: FlowExecutionRecords | null) {
    const startMeta = this.getEmptyRowTriggerStartMeta(startRecord);
    return startMeta?.source === TODOTriggerType.OPERATION && Boolean(startMeta?.emptyRowTrigger);
  }

  private async getDeleteTriggerRowSnapshot(todoId?: string) {
    if (!todoId) return null;
    const context = await this.flowExecutionContextRepository.findOne({ todoId });
    return context?.triggerRowSnapshot || null;
  }

  private async getTriggerRowSnapshot(todoId?: string) {
    if (!todoId) return null;
    const context = await this.flowExecutionContextRepository.findOne({ todoId });
    return context?.triggerRowSnapshot || null;
  }

  private createEmptyRowTriggerError(message: string, code: EmptyRowTriggerErrorCode): EmptyRowTriggerError {
    const err = new Error(message) as EmptyRowTriggerError;
    err.emptyRowTriggerError = true;
    err.emptyRowTriggerErrorCode = code;
    return err;
  }

  private isEmptyRowTriggerError(err: unknown): err is EmptyRowTriggerError {
    return Boolean((err as EmptyRowTriggerError)?.emptyRowTriggerError);
  }

  private isSubTableField(field: Field) {
    return Boolean(field?.subTableFields?.length || field?.meta?.extra?.subTableUID?.length);
  }

  private createVirtualEmptyCurrentRow(table: Table): Row {
    const row: Row = {};
    for (const field of table.fields || []) {
      row[field.uid] = this.isSubTableField(field) ? [] : null;
    }
    return row;
  }

  private mergeDeleteTriggerSnapshotRow(currentTable: Table, liveRow?: Row | null, snapshotRow?: Row | null) {
    if (!snapshotRow && !liveRow) return null;
    if (!snapshotRow) return liveRow ? deepClone(liveRow) : null;

    const mergedRow = deepClone(snapshotRow);
    if (!liveRow) return mergedRow;

    for (const field of currentTable.fields || []) {
      if (!isSystemField(field)) continue;
      mergedRow[field.uid] = deepClone(liveRow[field.uid]);
    }
    return mergedRow;
  }

  private async resolveRuntimeCurrentRowContext(
    options: BaseTodoOptions,
    params?: {
      formData?: NocodeFormData,
      currentTable?: Table,
      startRecord?: FlowExecutionRecords | null,
    },
  ): Promise<RuntimeCurrentRowContext | null> {
    const formData = params?.formData || (await getNocodeBody(this.nocodesDir, options.nocodeId)).formData;
    const currentTable = params?.currentTable || formData.tables.find(t => t.uid === options.tableId);
    if (!currentTable) return null;
    const startRecord = params?.startRecord ?? await this.getStartRecord(options);
    const runtimeSnapshot = (options as PostFinishRuntimeTodoOptions).runtimeCurrentRowSnapshot;
    if (runtimeSnapshot) {
      return {
        formData,
        currentTable,
        currentRows: [deepClone(runtimeSnapshot)],
        currentRow: deepClone(runtimeSnapshot),
        hasPhysicalRow: true,
        startRecord,
      };
    }
    const isDeleteTriggered = this.isDeleteTriggeredStartRecord(startRecord);
    const stage = this.getTodoReadableStageCondition(startRecord);
    const uuidField = getUUIDSystemField(currentTable.fields);
    const currentRowUUID = await this.getRuntimeCurrentRowUUID(options, startRecord);
    const buckets = await this.formDataService._getData(formData, [options.tableId], options.nocodeId, {
      filters: {
        [options.tableId]: [{
          [uuidField.uid]: currentRowUUID,
        }]
      },
      stage,
    });
    const currentRows = await this.formDataService.fillSubFormField(buckets[0]?.rows, options.nocodeId, currentTable, formData);
    const deleteTriggerRowSnapshot = isDeleteTriggered
      ? await this.getDeleteTriggerRowSnapshot(options.todoId || startRecord?.todoId)
      : null;
    if (isDeleteTriggered && deleteTriggerRowSnapshot) {
      const currentRow = this.mergeDeleteTriggerSnapshotRow(currentTable, currentRows?.[0], deleteTriggerRowSnapshot);
      if (currentRow) {
        return {
          formData,
          currentTable,
          currentRows: [currentRow],
          currentRow,
          hasPhysicalRow: !isEmpty(currentRows),
          startRecord,
        };
      }
    }
    if (!isEmpty(currentRows)) {
      return {
        formData,
        currentTable,
        currentRows,
        currentRow: currentRows[0],
        hasPhysicalRow: true,
        startRecord,
      };
    }
    if (!this.isEmptyRowTrigger(startRecord)) {
      return {
        formData,
        currentTable,
        currentRows: [],
        currentRow: null,
        hasPhysicalRow: false,
        startRecord,
      };
    }
    const virtualCurrentRow = this.createVirtualEmptyCurrentRow(currentTable);
    return {
      formData,
      currentTable,
      currentRows: [],
      currentRow: virtualCurrentRow,
      hasPhysicalRow: false,
      startRecord,
    };
  }

  private async getRuntimeCurrentRowUUID(
    options: BaseTodoOptions,
    startRecord?: FlowExecutionRecords | null,
  ) {
    const todoId = options.todoId || startRecord?.todoId;
    if (todoId) {
      const context = await this.flowExecutionContextRepository.findOne({ todoId });
      const targetUUID = context?.viewActionTriggerContext?.tableUID === options.tableId
        ? context.viewActionTriggerContext.targetUUIDs?.find(item => typeof item === "string" && item)
        : "";
      if (targetUUID) {
        return targetUUID;
      }
    }

    return options.uuid;
  }

  private async isRuntimeCurrentRowInStage(
    options: BaseTodoOptions,
    stage: FormDataStage,
    startRecord?: FlowExecutionRecords | null,
  ) {
    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const formData = nocodeBody?.formData;
    const currentTable = formData?.tables?.find(t => t.uid === options.tableId);
    if (!formData || !currentTable) {
      return false;
    }
    const uuidField = getUUIDSystemField(currentTable.fields);
    const currentRowUUID = await this.getRuntimeCurrentRowUUID(options, startRecord);
    if (!uuidField?.uid || !currentRowUUID) {
      return false;
    }

    const buckets = await this.formDataService._getData(formData, [options.tableId], options.nocodeId, {
      filters: {
        [options.tableId]: [{
          [uuidField.uid]: currentRowUUID,
        }]
      },
      stage,
    });
    return !isEmpty(buckets[0]?.rows);
  }

  private async ensureNodeSupportsEmptyRowTrigger(
    options: BaseTodoOptions,
    node: ProcessFlow,
    startRecord?: FlowExecutionRecords | null,
  ) {
    const useStartRecord = startRecord ?? await this.getStartRecord(options);
    if (!this.isEmptyRowTrigger(useStartRecord)) {
      return;
    }
    if (
      [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(node.type)
      && !this.isOperationEmptyRowTrigger(useStartRecord)
    ) {
      throw this.createEmptyRowTriggerError(
        global.i18next.t('formFlowService.emptyRowApprovalNotSupported'),
        "approval-not-supported",
      );
    }
  }

  private getProcessNodeOwner(node: ProcessFlow): ProcessNodeOwner | undefined {
    if (node.type === ProcessNodeType.APPROVAL) {
      return node.options?.approver;
    }
    if (node.type === ProcessNodeType.TRANSACT) {
      return node.options?.transactor;
    }
    if (node.type === ProcessNodeType.NOTIFY) {
      return node.options?.notifier;
    }
    if (node.type === ProcessNodeType.REPORT_DATA) {
      return node.options?.reporter;
    }
    return undefined;
  }

  private isCurrentRowOwnerConfig(owner?: ProcessNodeOwner) {
    return Boolean(owner?.[ProcessNodeOwnerType.FORM_MEMBER]?.length || owner?.[ProcessNodeOwnerType.FORM_DEPARTMENT]);
  }

  private async ensureNodeOwnerSupportsEmptyRowTrigger(
    options: BaseTodoOptions,
    node: ProcessFlow,
    startRecord?: FlowExecutionRecords | null,
  ) {
    const useStartRecord = startRecord ?? await this.getStartRecord(options);
    if (!this.isEmptyRowTrigger(useStartRecord)) {
      return;
    }
    if (this.isCurrentRowOwnerConfig(this.getProcessNodeOwner(node))) {
      throw this.createEmptyRowTriggerError(
        global.i18next.t('formFlowService.emptyRowFieldOwnerNotSupported'),
        "field-owner-not-supported",
      );
    }
  }

  private ensureEmptyRowAutoRelatedSupported(node: ProcessFlow, hasPhysicalRow: boolean) {
    if (hasPhysicalRow) {
      return;
    }
    const targetFields = Array.isArray(node.options?.targetFields) ? node.options.targetFields : [];
    const batchFields = node.type === ProcessNodeType.ADD_DATA && Array.isArray(node.options?.batchFields)
      ? node.options.batchFields
      : [];
    if ([...targetFields, ...batchFields].some(item => item?.type === TargetFieldFillType.AUTO_RELATED)) {
      throw this.createEmptyRowTriggerError(
        global.i18next.t('formFlowService.emptyRowAutoRelatedNotSupported'),
        "auto-related-not-supported",
      );
    }
  }

  private async getTodoFinalStatus(options: BaseTodoOptions) {
    const query: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
    };
    if (options.todoId) query.todoId = options.todoId;
    const flowRecords = await this.flowExecutionRecordsRepository.find(query, {
      orderBy: {
        startTime: "ASC",
      },
    });
    if (isEmpty(flowRecords)) return ProcessNodeStatus.FINISHED;

    const { allFlows } = await this.getAllFlows(options);
    const activeFlowRecords: FlowExecutionRecords[] = [];
    const approvalStatusMap = new Map<string, ProcessNodeStatus>();

    for (const record of flowRecords) {
      if (record.status === ProcessNodeStatus.BACK) {
        const backId = Object.values(record.metas || {}).find(meta => meta.backId)?.backId;
        if (!backId) continue;

        const backFlowType = getFlowById(allFlows, backId)?.type;
        let rollbackIndex = -1;
        for (let i = activeFlowRecords.length - 1; i >= 0; i--) {
          const activeRecord = activeFlowRecords[i];
          if (activeRecord.flowId !== backId) continue;
          if (!backFlowType || activeRecord.type === backFlowType) {
            rollbackIndex = i;
            break;
          }
        }
        if (rollbackIndex === -1) continue;

        const rollbackRecords = activeFlowRecords.splice(rollbackIndex);
        for (const rollbackRecord of rollbackRecords) {
          if (rollbackRecord.type === ProcessNodeType.APPROVAL) {
            approvalStatusMap.delete(rollbackRecord.flowId);
          }
        }
        continue;
      }

      activeFlowRecords.push(record);
      if (
        record.type === ProcessNodeType.APPROVAL &&
        [ProcessNodeStatus.FINISHED, ProcessNodeStatus.REJECTED, ProcessNodeStatus.SKIPPED].includes(record.status)
      ) {
        if (
          record.status === ProcessNodeStatus.REJECTED
          && getFlowById(allFlows, record.flowId)?.options?.continueAfterReject
        ) {
          continue;
        }
        approvalStatusMap.set(record.flowId, record.status);
      }
    }

    return Array.from(approvalStatusMap.values()).some(status => status === ProcessNodeStatus.REJECTED)
      ? ProcessNodeStatus.REJECTED
      : ProcessNodeStatus.FINISHED;
  }

  private async applyFinishedFlowResult(
    options: BaseTodoOptions,
    finalStatus: ProcessNodeStatus,
  ) {
    const startRecord = await this.getStartRecord(options);
    const meta = Object.values(startRecord?.metas || {}).find(meta => meta.source);
    if (meta?.source === TODOTriggerType.DELETE) {
      await this.updateFlowData(options, {
        status: finalStatus,
        node: { type: "update", value: [] },
      });
      const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
      const table = nocodeBody.formData.tables.find(item => item.uid === options.tableId);
      const uuidField = getUUIDSystemField(table?.fields || []);
      if (table && uuidField?.uid) {
        await this.formDataService.moveRowsToRecycleBin(
          nocodeBody.formData,
          options.nocodeId,
          options.tableId,
          [{ [uuidField.uid]: options.uuid }],
          [[nocodeBody.formData.uid, table.uid, uuidField.uid]],
        );
      }
      return;
    }
    await this.updateFlowData(options, {
      stage: FormDataStage.NORMAL,
      status: finalStatus,
      node: {
        type: "update",
        value: [],
      },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'Asia/Shanghai' })
  private async timeoutTask() {
    if (this.timeoutTaskRunning) {
      this.logger.log("flow-timeout-scan-skip-overlap", { reason: "previous-run-still-active" });
      return;
    }
    this.timeoutTaskRunning = true;
    try {
      await this.runTimeoutTask();
    } finally {
      this.timeoutTaskRunning = false;
    }
  }

  private async runTimeoutTask() {
    const records = await this.flowExecutionRecordsRepository.find({
      status: ProcessNodeStatus.IN_PROGRESS,
      type: {
        $in: [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA],
      },
    }, {
      // Timeout evaluation and automatic submit/back actions do not need the
      // large historical JSON columns (transfer/submit snapshots, etc.).
      // Keep the entity fields required by those actions and persistence only.
      fields: [
        "id",
        "flowId",
        "type",
        "status",
        "operators",
        "paddingOperators",
        "nocodeId",
        "tableId",
        "uuid",
        "processVersion",
        "todoId",
        "metas",
      ],
    });
    if (!records.length) {
      return;
    }

    const now = Date.now();
    let hasUpdated = false;

    const updatedRecords = new Set<FlowExecutionRecords>();
    let configuredRecordCount = 0;
    let dueRecordCount = 0;
    let dueRuleCount = 0;
    let flowLoadDurationMs = 0;
    let actionDurationMs = 0;
    const bodyPromises = new Map<string, Promise<NocodeBody | null>>();
    const flowPromises = new Map<string, Promise<ProcessFlow | null>>();
    const getBody = (nocodeId: string) => {
      const existing = bodyPromises.get(nocodeId);
      if (existing) return existing;
      const promise = getNocodeBody(this.nocodesDir, nocodeId).catch(() => null);
      bodyPromises.set(nocodeId, promise);
      return promise;
    };
    const getFlow = (record: FlowExecutionRecords, body: NocodeBody | null) => {
      // A process/version/flow node is immutable for the duration of this
      // scan. Reuse the parsed node instead of rebuilding it for every row.
      const version = this.normalizeProcessVersion(record.processVersion);
      const cacheKey = Number.isInteger(record.processVersion) && record.processVersion > 0
        ? `${record.nocodeId}:${record.tableId}:${version}:${record.flowId}`
        : undefined;
      if (!cacheKey) {
        return this.getFlowByExecutionRecord(record, body);
      }
      const existing = flowPromises.get(cacheKey);
      if (existing) return existing;
      const promise = this.getFlowByExecutionRecord(record, body);
      flowPromises.set(cacheKey, promise);
      return promise;
    };

    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      const record = records[recordIndex];
      const timeoutMeta = this.getTimeoutMeta(record);
      if (!timeoutMeta || !Number.isFinite(timeoutMeta.timeoutDeadlineAt || NaN)) {
        continue;
      }

      await new Promise<void>(resolve => setImmediate(resolve));
      configuredRecordCount += 1;

      if (timeoutMeta.timeoutDeadlineAt > now) {
        continue;
      }
      const flowLoadStartedAt = Date.now();
      const flow = await getFlow(record, await getBody(record.nocodeId));
      flowLoadDurationMs += Date.now() - flowLoadStartedAt;

      // const flow = await this.getFlowByExecutionRecord(record);
      if (!flow) {
        continue;
      }
      const timeout = this.getNodeTimeoutConfig(flow);
      const dueRules = getDueTimeoutRules(timeout, timeoutMeta.timeoutDeadlineAt, timeoutMeta.timeoutRuleExecutedAtMap || {}, now);
      if (!dueRules.length) {
        continue;
      }
      dueRecordCount += 1;
      dueRuleCount += dueRules.length;

      timeoutMeta.timeoutRuleExecutedAtMap = timeoutMeta.timeoutRuleExecutedAtMap || {};
      for (const rule of dueRules) {
        await new Promise<void>(resolve => setImmediate(resolve));
        const actionStartedAt = Date.now();
        let executed = false;
        if (rule.action === ProcessTimeoutActionType.REMIND) {
          executed = true;
        } else if (rule.action === ProcessTimeoutActionType.SUBMIT) {
          executed = await this.executeTimeoutSubmitRule(record, flow, rule);
        } else if (rule.action === ProcessTimeoutActionType.BACK) {
          executed = await this.executeTimeoutBackRule(record, flow, rule);
        }
        actionDurationMs += Date.now() - actionStartedAt;
        if (!executed) {
          continue;
        }
        timeoutMeta.timeoutRuleExecutedAtMap[rule.uid] = now;
        hasUpdated = true;
        updatedRecords.add(record);
      }
    }

    if (hasUpdated) {
      await this.flowExecutionRecordsRepository.persistAndFlush(Array.from(updatedRecords));
    }
  }

  /**
   * Build immutable, worker-safe trigger snapshots. ORM entities and services
   * stay on the main thread; workers only evaluate the copied condition data.
   */
  private async buildTriggerPlanCandidates(
    nocodeBody: NocodeBody,
    nocodeId: string,
    tableUID: TableUID,
    flows: ProcessFlow[],
    table: Table,
    branches: ProcessBranch[],
    candidates: Array<{ uuid: string; row: Row | undefined }>,
  ): Promise<FlowWorkerTriggerPlanCandidate[]> {
    const snapshots: FlowWorkerTriggerPlanCandidate[] = [];
    for (const candidate of candidates) {
      const snapshot: FlowWorkerTriggerPlanCandidate = {
        uuid: candidate.uuid,
        ...(candidate.row ? { row: deepClone(candidate.row) } : {}),
        branches: [],
      };
      if (candidate.row) {
        for (const branch of branches) {
          const triggerNode = branch.flows[0];
          if (!triggerNode) continue;
          const options = triggerNode.options || {};
          const sourceTableRows: Record<TableUID, Row[]> = {
            [tableUID]: [candidate.row],
          };
          let conditions: ConditionBranchConditionGroup[] = [];
          if (isDataChangeTriggerConditionsEnabled(options) && !isEmpty(options.conditions)) {
            await Promise.all((options.sourceTables || []).map(async item => {
              sourceTableRows[item.uid] = await this.getTableRows(
                nocodeBody,
                nocodeId,
                item.tableUID,
                item.filterRule,
                candidate.row!,
                {
                  fillSubTable: true,
                  formulaRuntime: createFormulaRuntimeByData(candidate.row!, table.fields),
                },
              );
            }));
            conditions = await this.normalizeBranchConditions(
              { nocodeId, tableId: tableUID, uuid: candidate.uuid },
              flows,
              deepClone(options.conditions || []),
              sourceTableRows,
              null,
            );
          }
          snapshot.branches.push({
            branchUid: branch.uid,
            triggerNodeUid: triggerNode.uid,
            changeTypes: (options.changeType || []).map(String),
            conditions,
            sourceTableRows,
          });
        }
      }
      snapshots.push(snapshot);
    }
    return snapshots;
  }

  async tryTriggerTodo(
    nocodeId: string,
    tableUID: TableUID,
    data: DataRows,
    source: DataChangeType,
    triggerContext?: FlowTriggerContext,
    importTaskId?: string,
    stashRequested = false,
    mutationOptions: Pick<TriggerOptions, "beforeMutationRows" | "causedByTodoId" | "causedByTaskId" | "skipNodeIds" | "runtimeAccount" | "conditionWorkerQueue" | "flowWorkerContext"> = {},
  ): Promise<FlowTriggerResult> {
    const currentImportTaskId = importTaskId || triggerContext?.importTaskId;
    if (isEmpty(data)) return { triggered: false };
    const targetKey = this.getFlowTriggerTargetKey(nocodeId, tableUID);
    const triggerPath = triggerContext?.triggerPath || [];
    const originKey = triggerContext
      ? this.getFlowTriggerTargetKey(triggerContext.originNocodeId, triggerContext.originTableId)
      : "";
    const currentFlowKey = triggerPath.at(-1) || originKey;
    const isSameTableTarget = Boolean(triggerContext && currentFlowKey === targetKey);
    const targetOccurrenceCount = triggerPath.filter(item => item === targetKey).length
      + (originKey === targetKey ? 1 : 0);
    const sameTableTriggerCount = isSameTableTarget
      ? Math.max(0, targetOccurrenceCount - 1)
      : 0;
    if (isSameTableTarget && sameTableTriggerCount >= MAX_SAME_TABLE_TRIGGER_COUNT) {
      return {
        triggered: false,
        skippedReason: "visited-target",
      };
    }
    if (triggerContext?.triggerDepth >= MAX_TRIGGER_DEPTH) {
      return {
        triggered: false,
        skippedReason: "depth-limit",
      };
    }
    if (triggerContext?.visitedTargets?.includes(targetKey) && !isSameTableTarget) {
      return {
        triggered: false,
        skippedReason: "visited-target",
      };
    }
    const nocodeBody = await this.getFlowNocodeBody(nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(t => t.uid === tableUID);
    if (!table) {
      return {
        triggered: false,
        skippedReason: "target-invalid",
      };
    }
    const uuidField = getUUIDSystemField(table.fields);
    const formOptions = formData.formOptions;
    const process = formOptions[tableUID]?.process;
    const flows = getFlows(process);
    if (!process?.enabled || isEmpty(flows?.[0]?.branches)) {
      return {
        triggered: false,
        skippedReason: "no-process",
      };
    }
    const candidateBranches = flows[0].branches.filter(b => (
      b.flows[0]?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      && b.flows[0]?.options?.changeType?.includes(source)
      && b.flows?.length >= 2
    ));
    if (isEmpty(candidateBranches)) {
      return {
        triggered: false,
        skippedReason: "no-process",
      };
    }

    const tableOption = formData.options.tables.find(item => item.uid === table.meta.uid);
    const canReuseInsertedRows = source === DataChangeType.ADD
      && !!tableOption
      && !table.fields.some(field => field.meta?.extra?.widgetType === FormWidgetType.SUBFORM)
      && candidateBranches.every(branch => {
        const triggerOptions = branch.flows[0]?.options;
        return !isDataChangeTriggerConditionsEnabled(triggerOptions) || isEmpty(triggerOptions?.conditions);
      });

    const triggeredTodoByUUID = new Map<string, string>();
    if (mutationOptions.causedByTaskId) {
      const existingContexts = await this.flowExecutionContextRepository.find({
        causedByTaskId: mutationOptions.causedByTaskId,
      });
      const existingTodoIds = existingContexts.map(item => item.todoId).filter(Boolean);
      if (existingTodoIds.length) {
        const startRecords = await this.flowExecutionRecordsRepository.find({
          todoId: { $in: existingTodoIds },
          type: ProcessNodeType.START,
        });
        for (const startRecord of startRecords) {
          triggeredTodoByUUID.set(String(startRecord.uuid), startRecord.todoId);
        }
      }
    }
    const activeUUIDs = new Set<string>();
    // Candidate UUIDs still readable in the business store. Only filled for the
    // ADD snapshot path, which does not read the rows themselves.
    const readableUUIDs = new Set<string>();
    const currentRowByUUID = new Map<string, Row>();
    const beforeMutationRowsByUUID = new Map<string, Row[]>();
    for (const beforeRow of mutationOptions.beforeMutationRows || []) {
      const uuid = String(beforeRow?.[SystemField.UUID] || beforeRow?.[uuidField?.uid] || "");
      if (!uuid) continue;
      const existing = beforeMutationRowsByUUID.get(uuid);
      if (existing) existing.push(beforeRow);
      else beforeMutationRowsByUUID.set(uuid, [beforeRow]);
    }
    const inputUUIDs = Array.from(new Set(data
      .map(row => String(this.getRowUUID(table, row) || ""))
      .filter(Boolean)));
    if (uuidField?.uid && inputUUIDs.length) {
      // Batch the read-side checks so imports do not issue one active-flow
      // query and one data query for every row. Side-effect creation below
      // remains sequential and keeps its existing idempotency boundary.
      for (let offset = 0; offset < inputUUIDs.length; offset += DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) {
        const activeRecords = await this.flowExecutionRecordsRepository.find({
          uuid: { $in: inputUUIDs.slice(offset, offset + DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) },
          nocodeId,
          tableId: tableUID,
          status: ProcessNodeStatus.IN_PROGRESS,
        }, { fields: ["uuid"] });
        for (const activeRecord of activeRecords) {
          const uuid = String(activeRecord.uuid || "");
          if (uuid) activeUUIDs.add(uuid);
        }
      }
      if (!canReuseInsertedRows) {
        const candidateUUIDs = inputUUIDs.filter(uuid => (
          !activeUUIDs.has(uuid) && !triggeredTodoByUUID.has(uuid)
        ));
        for (let offset = 0; offset < candidateUUIDs.length; offset += DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) {
          const uuidChunk = candidateUUIDs.slice(offset, offset + DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE);
          const buckets = await this.formDataService._getData(formData, [tableUID], nocodeId, {
            filters: {
              [tableUID]: [{
                [uuidField.uid]: { $in: uuidChunk },
              }],
            },
            stage: this.getDefaultReadableStageCondition(),
          });
          const currentRows = await this.formDataService.fillSubFormField(
            buckets[0]?.rows || [],
            nocodeId,
            table,
            formData,
          );
          for (const currentRow of currentRows || []) {
            const uuid = String(this.getRowUUID(table, currentRow) || "");
            if (uuid) currentRowByUUID.set(uuid, currentRow);
          }
        }
      } else {
        // The snapshot path trusts the task payload, so a queued task that
        // outlives its rows (delete-all moves them to the recycle bin) would
        // otherwise still create flows for data nobody can see. Confirm the
        // rows are still in a readable stage with one batched distinct read
        // instead of loading them, which keeps the "known rows" optimization
        // intact. Read permission is skipped so the probe matches the plain row
        // read used by the non-snapshot path.
        const candidateUUIDs = inputUUIDs.filter(uuid => (
          !activeUUIDs.has(uuid) && !triggeredTodoByUUID.has(uuid)
        ));
        for (let offset = 0; offset < candidateUUIDs.length; offset += DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE) {
          const uuidChunk = candidateUUIDs.slice(offset, offset + DATA_CHANGE_TRIGGER_LOOKUP_BATCH_SIZE);
          const readable = await this.formDataService._distinct(formData, nocodeId, tableUID, uuidField.uid, {
            filters: {
              [tableUID]: [{
                [uuidField.uid]: { $in: uuidChunk },
              }],
            },
            stage: this.getDefaultReadableStageCondition(),
          }, { skipReadPermission: true });
          for (const item of readable || []) {
            const uuid = String(item?.value ?? "");
            if (uuid) readableUUIDs.add(uuid);
          }
        }
      }
    }
    let triggeredTodoId: string | undefined;
    const handledUUIDs = new Set<string>();
    const candidates: Array<{
      uuid: string;
      row: Row | undefined;
      beforeMutationRows: Row[];
    }> = [];
    for (const [rowIndex, _row] of data.entries()) {
      if (rowIndex > 0 && rowIndex % 20 === 0) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
      const uuid = String(this.getRowUUID(table, _row) || "");
      if (!uuid) continue;
      if (handledUUIDs.has(uuid)) continue;
      const existingTriggeredTodoId = triggeredTodoByUUID.get(String(uuid));
      if (existingTriggeredTodoId) {
        triggeredTodoId ||= existingTriggeredTodoId;
        handledUUIDs.add(uuid);
        continue;
      }
      if (activeUUIDs.has(uuid)) {
        handledUUIDs.add(uuid);
        continue;
      }
      // Snapshot rows are only trusted while they are still readable: a row that
      // moved to the recycle bin (or into a draft) while this task was queued
      // must not start a flow.
      if (canReuseInsertedRows && !readableUUIDs.has(uuid)) {
        handledUUIDs.add(uuid);
        continue;
      }
      const beforeMutationRows = beforeMutationRowsByUUID.get(uuid) || [];
      let row: Row | undefined;
      if (canReuseInsertedRows) {
        row = transformFormDataRow(_row, tableOption.columns);
      } else {
        const beforeMutationRow = beforeMutationRows[0];
        const currentRow = currentRowByUUID.get(uuid);
        row = source === DataChangeType.DELETE && beforeMutationRow
          ? {
            ...(currentRow || {}),
            ...deepClone(beforeMutationRow),
          }
          : source === DataChangeType.DELETE && mutationOptions.causedByTaskId
            ? deepClone(_row)
            : currentRow;
      }
      candidates.push({ uuid, row, beforeMutationRows });
      // Reserve the UUID before matching so duplicate input rows cannot
      // create duplicate todos when matches are evaluated concurrently.
      handledUUIDs.add(uuid);
    }

    const matchedCandidates: Array<{
      candidate: (typeof candidates)[number];
      matched: Awaited<ReturnType<typeof this.matchDataChangeTriggerBranch>>;
    }> = [];
    // Condition evaluation is read-only after source rows are loaded. It may
    // P1 uses the worker plan/execution path by default. The inline matcher
    // remains a bounded failure fallback so a worker fault cannot drop a
    // trigger.
    const conditionWorkerQueue = mutationOptions.conditionWorkerQueue || (currentImportTaskId ? "p1" : "p0");
    const workerMode = globalThis.process?.env?.FLOW_EXECUTION_WORKER_MODE || "tinypool";
    const triggerPlanWorkerFlag = globalThis.process?.env?.FLOW_EXECUTION_TRIGGER_PLAN_WORKER;
    const useTriggerPlanWorker = (triggerPlanWorkerFlag === "true"
      || (triggerPlanWorkerFlag !== "false" && workerMode === "tinypool" && conditionWorkerQueue === "p1"))
      && Boolean(this.flowWorkerPool);
    const conditionWorkerFlag = globalThis.process?.env?.FLOW_EXECUTION_TRIGGER_CONDITION_WORKER;
    const useConditionWorker = conditionWorkerFlag !== "false"
      && workerMode === "tinypool"
      && Boolean(this.flowWorkerPool);
    if (canReuseInsertedRows) {
      for (const candidate of candidates) {
        matchedCandidates.push({
          candidate,
          matched: { branch: candidateBranches[0], flows },
        });
      }
    } else if (useTriggerPlanWorker) {
      const planWidth = Math.max(1, this.flowWorkerPool?.getMaxConcurrency(conditionWorkerQueue) || 1);
      const planBatchSize = 100 * planWidth;
      for (let offset = 0; offset < candidates.length; offset += planBatchSize) {
        const chunk = candidates.slice(offset, offset + planBatchSize);
        try {
          const snapshots = await this.buildTriggerPlanCandidates(
            nocodeBody,
            nocodeId,
            tableUID,
            flows,
            table,
            candidateBranches,
            chunk,
          );
          const plans = await this.flowWorkerPool!.planTriggerCandidates({
            source,
            tableUID,
            fields: table.fields,
            flows,
            candidates: snapshots,
            queueClass: conditionWorkerQueue,
          });
          const branchByUid = new Map(candidateBranches.map(branch => [branch.uid, branch]));
          const planByUUID = new Map(plans.map(plan => [plan.uuid, plan]));
          for (const candidate of chunk) {
            const plan = planByUUID.get(candidate.uuid);
            if (plan?.matched && (!plan.branchUid || !branchByUid.has(plan.branchUid))) {
              // A matched plan without a branch that belongs to this immutable
              // snapshot is unsafe: treating it as unmatched would silently
              // drop a trigger. Let the chunk fall back to the inline matcher.
              throw new Error("Trigger plan worker returned an unknown branch");
            }
            const branch = plan?.matched && plan.branchUid ? branchByUid.get(plan.branchUid) : undefined;
            matchedCandidates.push({
              candidate,
              matched: branch ? { branch, flows } : null,
            });
          }
        } catch (error) {
          if (conditionWorkerQueue === "p1") throw error;
          this.logWorkerFallback("P0 trigger plan worker failed; falling back inline", error);
          for (const candidate of chunk) {
            matchedCandidates.push({
              candidate,
              matched: await this.matchDataChangeTriggerBranch(
                nocodeBody,
                nocodeId,
                tableUID,
                source,
                candidate.row,
              ),
            });
          }
        }
        if (offset + planBatchSize < candidates.length) {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
      }
    } else if (useConditionWorker) {
      // Keep worker fan-out below Tinypool's actual capacity. Submitting a
      // fixed batch of 20 can exceed maxQueue when the pool has only 1-2
      // workers, causing avoidable inline fallback and latency spikes.
      const conditionBatchSize = Math.max(1, Math.min(
        20,
        this.flowWorkerPool?.getMaxConcurrency(conditionWorkerQueue) || 1,
      ));
      for (let offset = 0; offset < candidates.length; offset += conditionBatchSize) {
        const chunk = candidates.slice(offset, offset + conditionBatchSize);
        const matches = await Promise.all(chunk.map(async candidate => ({
          candidate,
          matched: await this.matchDataChangeTriggerBranch(
            nocodeBody,
            nocodeId,
            tableUID,
            source,
            candidate.row,
            { useWorker: true, workerQueue: conditionWorkerQueue },
          ),
        })));
        matchedCandidates.push(...matches);
        if (offset + conditionBatchSize < candidates.length) {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
      }
    } else {
      for (const candidate of candidates) {
        matchedCandidates.push({
          candidate,
          matched: await this.matchDataChangeTriggerBranch(
            nocodeBody,
            nocodeId,
            tableUID,
            source,
            candidate.row,
          ),
        });
      }
    }

    const matched = matchedCandidates.filter(item => item.matched?.branch);
    const concurrency = getTriggerTodoConcurrency(
      Boolean(currentImportTaskId) || conditionWorkerQueue === "p1",
      Boolean(this.flowWorkerPool),
    );
    // Only import/batch triggers use bounded parallelism. Interactive writes
    // remain serialized by default, while each concurrent item still owns its
    // own todo/record transaction and UUID idempotency boundary.
    const failedErrors: unknown[] = [];
    const runMatchedCandidate = ({ candidate, matched: matchedBranch }: (typeof matched)[number]) => {
      const branch = matchedBranch!.branch!;
      const triggerRowSnapshot = candidate.row ? deepClone(candidate.row) : undefined;
      return this.withTriggerTodoLock(nocodeId, tableUID, candidate.uuid, () => this.addTodo({
        nocodeId,
        tableId: tableUID,
        uuid: candidate.uuid,
        importTaskId: currentImportTaskId,
        source: source as unknown as TODOTriggerType,
        entryId: branch.uid,
        stashRequested,
        triggerRowSnapshot,
        skipNodeIds: mutationOptions.skipNodeIds,
        ...(triggerContext ? {
          triggerContext: {
            ...this.buildNextTriggeredFlowContext(triggerContext, nocodeId, tableUID),
            importTaskId: currentImportTaskId || triggerContext.importTaskId,
          },
        } : {}),
      }, undefined, {
        ...mutationOptions,
        beforeMutationRows: candidate.beforeMutationRows,
      }, mutationOptions.runtimeAccount ? {
        account: mutationOptions.runtimeAccount,
        nocodeBody,
      } : undefined));
    };
    const canExecuteThroughWorker = workerMode === "tinypool"
      && conditionWorkerQueue === "p1"
      // A durable P1 task offloads its node route below. Keeping an outer
      // candidate worker blocked while addTodo submits another job to the
      // same pool can exhaust all threads and deadlock nested dispatch.
      && !mutationOptions.flowWorkerContext
      && Boolean(this.flowWorkerPool)
      && typeof this.flowWorkerPool?.executeTriggerCandidates === "function";
    const executeInline = async (entry: (typeof matched)[number]) => await runMatchedCandidate(entry);
    if (canExecuteThroughWorker) {
      try {
        const entriesByUUID = new Map(matched.map(entry => [entry.candidate.uuid, entry]));
        const workerCandidates: FlowWorkerTriggerExecutionCandidate[] = matched.map(({ candidate, matched: matchedBranch }) => ({
          uuid: candidate.uuid,
          entryId: matchedBranch!.branch!.uid,
        }));
        const workerResults = await this.flowWorkerPool!.executeTriggerCandidates(
          workerCandidates,
          workerCandidate => {
            const entry = entriesByUUID.get(workerCandidate.uuid);
            if (!entry || entry.matched?.branch?.uid !== workerCandidate.entryId) {
              throw new Error("Flow worker trigger candidate identity mismatch");
            }
            return executeInline(entry);
          },
          conditionWorkerQueue,
          concurrency,
        );
        for (const result of workerResults) {
          if (result.error) failedErrors.push(new Error(result.error));
          else if (result.todoId) triggeredTodoId ||= result.todoId;
        }
      } catch (error) {
        if (conditionWorkerQueue === "p1") throw error;
        this.logWorkerFallback("P0 trigger execution worker failed; falling back inline", error);
        for (const entry of matched) {
          try {
            const todoId = await executeInline(entry);
            if (todoId) triggeredTodoId ||= todoId;
          } catch (entryError) {
            failedErrors.push(entryError);
            this.logger.error("Data-change flow trigger failed for one UUID", entryError);
          }
        }
      }
    } else for (let offset = 0; offset < matched.length; offset += concurrency) {
      const chunk = matched.slice(offset, offset + concurrency);
      if (concurrency === 1) {
        // Keep the historical fail-fast behavior unless bounded fan-out was
        // explicitly enabled.
        const todoId = await runMatchedCandidate(chunk[0]);
        if (todoId) triggeredTodoId ||= todoId;
        continue;
      }
      const results = await Promise.allSettled(chunk.map(runMatchedCandidate));
      const todoIds: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value) todoIds.push(result.value);
          continue;
        }
        failedErrors.push(result.reason);
        this.logger.error("Data-change flow trigger failed for one UUID", result.reason);
      }
      triggeredTodoId ||= todoIds.find(Boolean);
      if (offset + concurrency < matched.length) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
    }
    if (failedErrors.length) {
      throw failedErrors[0];
    }
    return triggeredTodoId ? {
      triggered: true,
      triggeredTodoId,
    } : {
      triggered: false,
    };
  }

  /**
   * Excel 导入后台汇总优化入口。
   * 仅处理“新增 + 无触发条件 + 首个节点为历史数据编辑”的安全子集，
   * 并在批量更新完成后跳过原流程中的重复编辑节点；其他流程继续走原逻辑。
   */
  async supportsImportBatchAggregation(nocodeId: string, tableUID: TableUID): Promise<boolean> {
    const nocodeBody = await this.getFlowNocodeBody(nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(item => item.uid === tableUID);
    const process = formData.formOptions[tableUID]?.process;
    const flows = getFlows(process);
    if (!table || table.fields.some(field => field.meta?.extra?.widgetType === FormWidgetType.SUBFORM)
      || !process?.enabled || isEmpty(flows?.[0]?.branches)) return false;

    return flows[0].branches.some(item => {
      const triggerNode = item.flows?.[0];
      const editNode = item.flows?.[1];
      const editOptions = editNode?.options;
      const formulaTarget = editOptions?.targetFields?.find(field => field.type === TargetFieldFillType.FORMULA);
      const primaryConditions = editOptions?.primarySourceTable?.filterRule?.conditions || [];
      const targetConditions = editOptions?.targetTableFilterRule?.conditions || [];
      return triggerNode?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
        && triggerNode.options?.changeType?.includes(DataChangeType.ADD)
        && !isDataChangeTriggerConditionsEnabled(triggerNode.options)
        && editNode?.type === ProcessNodeType.EDIT_DATA
        && Boolean(getFormulaStr(formulaTarget?.value || "").trim())
        && editOptions?.targetFields?.length === 1
        && editOptions.targetTableDataScope === EditDataTargetScope.HISTORY
        && Boolean(editOptions.targetTableUID && editOptions.primarySourceTable?.tableUID)
        && primaryConditions.length > 0
        && primaryConditions.every(condition => condition.type === "FORM" && condition.func === "=" && condition.uid && condition.value)
        && targetConditions.length > 0
        && targetConditions.every(condition => condition.type === "FORM" && condition.func === "=" && condition.uid && condition.value);
    });
  }

  async runImportBatchAggregation(
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
  ): Promise<ImportBatchAggregationResult> {
    if (isEmpty(rows)) return { handled: false };

    const nocodeBody = await this.getFlowNocodeBody(nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(item => item.uid === tableUID);
    const process = formData.formOptions[tableUID]?.process;
    const flows = getFlows(process);
    if (!table || table.fields.some(field => field.meta?.extra?.widgetType === FormWidgetType.SUBFORM)
      || !process?.enabled || isEmpty(flows?.[0]?.branches)) {
      return { handled: false };
    }

    const branch = flows[0].branches.find(item => {
      const triggerNode = item.flows?.[0];
      const editNode = item.flows?.[1];
      return triggerNode?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
        && triggerNode.options?.changeType?.includes(DataChangeType.ADD)
        && !isDataChangeTriggerConditionsEnabled(triggerNode.options)
        && editNode?.type === ProcessNodeType.EDIT_DATA;
    });
    const editNode = branch?.flows?.[1];
    const editOptions = editNode?.options;
    const formulaTarget = editOptions?.targetFields?.find(item => item.type === TargetFieldFillType.FORMULA);
    const formula = getFormulaStr(formulaTarget?.value || "").trim();
    const primarySourceTable = editOptions?.primarySourceTable;
    const primaryConditions = primarySourceTable?.filterRule?.conditions || [];
    const targetConditions = editOptions?.targetTableFilterRule?.conditions || [];
    if (
      !branch || !editNode || !editOptions || !formulaTarget || !formula ||
      editOptions.targetFields?.length !== 1 ||
      editOptions.targetTableDataScope !== EditDataTargetScope.HISTORY ||
      !editOptions.targetTableUID || !primarySourceTable?.tableUID ||
      primaryConditions.length === 0 ||
      primaryConditions.some(item => item.type !== "FORM" || item.func !== "=" || !item.uid || !item.value) ||
      targetConditions.length === 0 ||
      targetConditions.some(item => item.type !== "FORM" || item.func !== "=" || !item.uid || !item.value)
    ) {
      return { handled: false };
    }

    const targetTable = formData.tables.find(item => item.uid === editOptions.targetTableUID);
    const targetUUIDField = getUUIDSystemField(targetTable?.fields || []);
    const targetField = targetTable?.fields.find(item => item.uid === formulaTarget.fieldUID);
    if (!targetTable || !targetUUIDField || !targetField) {
      return { handled: false };
    }
    const isSubTargetTable = !!targetTable.meta?.extra?.primaryTable && !!primarySourceTable;
    const primaryTableUID = targetTable.meta?.extra?.primaryTable?.[1];
    const primaryTable = formData.tables.find(item => item.uid === primaryTableUID);
    const targetKeyField = targetTable.fields.find(field => field.meta.name === SystemField.KEY);
    const primaryUUIDField = getUUIDSystemField(primaryTable?.fields || []);
    if (isSubTargetTable && (!primaryTableUID || !primaryTable || !targetKeyField || !primaryUUIDField)) {
      return { handled: false };
    }

    const groupMap = new Map<string, { row: Row, query: Row }>();
    for (const row of rows) {
      const query: Row = {};
      for (const condition of primaryConditions) {
        query[condition.value] = row[condition.value];
      }
      const key = JSON.stringify(primaryConditions.map(condition => row[condition.value]));
      if (!groupMap.has(key)) groupMap.set(key, { row, query });
    }

    const aggregationGroups: Array<{ row: Row, sourceRows: Row[] }> = [];
    for (const { row, query } of groupMap.values()) {
      const sourceBuckets = await this.formDataService._getData(formData, [tableUID], nocodeId, {
        filters: { [tableUID]: [query] },
        stage: this.getDefaultReadableStageCondition(),
      });
      const sourceRows = sourceBuckets[0]?.rows || [];
      aggregationGroups.push({ row, sourceRows });
    }

    const totals = await this.evaluateImportBatchAggregationFormulas(
      formula,
      aggregationGroups,
      tableUID,
      table.fields,
    );
    if (totals.some(total => total === undefined)) return { handled: false };

    const updates = new Map<string, Row>();
    for (let index = 0; index < aggregationGroups.length; index += 1) {
      const { row } = aggregationGroups[index];
      const total = totals[index];
      if (total === undefined) return { handled: false };
      let targetFilters = {};
      if (isSubTargetTable) {
        const primaryFilters = transformFilterRule(
          primarySourceTable.filterRule,
          row,
          { formulaRuntime: createFormulaRuntimeByData(row, table.fields) },
        );
        const primaryRows = await this.formDataService._distinct(
          formData,
          nocodeId,
          primaryTableUID,
          primaryUUIDField.uid,
          {
            filters: {
              [primaryTableUID]: [primaryFilters],
            },
          },
        );
        targetFilters = {
          [editOptions.targetTableUID]: [{
            [targetKeyField.uid]: primaryRows.map(item => item.value).filter(Boolean),
          }],
        };
      }
      const targetRows = await this.getTableRows(
        nocodeBody,
        nocodeId,
        editOptions.targetTableUID,
        editOptions.targetTableFilterRule,
        row,
        {
          fillSubTable: false,
          stage: this.getDefaultReadableStageCondition(),
          filters: targetFilters,
        },
      );
      for (const targetRow of targetRows) {
        const uuid = String(targetRow?.[targetUUIDField.uid] || "");
        if (!uuid) continue;
        updates.set(uuid, {
          [targetUUIDField.uid]: targetRow[targetUUIDField.uid],
          [targetField.uid]: total,
        });
      }
    }

    if (updates.size === 0) return { handled: false };

    await this.formDataService.updateData(
      formData,
      nocodeId,
      editOptions.targetTableUID,
      [...updates.values()],
      [[formData.uid, editOptions.targetTableUID, targetUUIDField.uid]],
      null,
      "main",
      { validateCurrentTable: true },
    );

    return {
      handled: true,
      skipNodeIds: [editNode.uid],
    };
  }

  private async evaluateImportBatchAggregationFormulas(
    formula: string,
    groups: Array<{ row: Row, sourceRows: Row[] }>,
    sourceTableUID: TableUID,
    sourceFields: Field[],
  ): Promise<Array<unknown | undefined>> {
    const inputs = groups.map(group => ({
      formula,
      sourceRows: group.sourceRows,
      sourceTableUID,
      currentRow: group.row,
      sourceFields,
    }));
    const formulaWorkerFlag = process.env.FLOW_EXECUTION_IMPORT_FORMULA_WORKER;
    const useWorker = formulaWorkerFlag !== "false"
      && (process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool") === "tinypool"
      // Formula aggregation is pure; FlowWorkerPool uses a database-free
      // pool for this path, so ORM type must not gate the optimization.
      && Boolean(this.flowWorkerPool);
    if (useWorker) {
      try {
        const results = await this.flowWorkerPool!.evaluateImportFormulaBatch(inputs);
        return results.map(result => result.handled ? result.value : undefined);
      } catch (error) {
        throw error;
      }
    }
    return inputs.map(input => evaluateImportBatchAggregationFormula(
      input.formula,
      input.sourceRows,
      input.sourceTableUID,
      input.currentRow,
      input.sourceFields,
    ));
  }

  private async getOperationTriggerContext(
    options: Pick<OperationTriggerOptions | ViewOperationTriggerOptions, "nocodeId" | "tableId" | "processId" | "triggerNodeId">,
  ) {
    if (!options.processId || options.processId !== options.tableId) {
      throw new Error(global.i18next.t('formFlowService.operationTriggerCurrentFormOnly'));
    }

    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const process = nocodeBody?.formData?.formOptions?.[options.tableId]?.process;
    const flows = getFlows(process);
    if (!process?.enabled || isEmpty(flows?.[0]?.branches)) {
      throw new Error(global.i18next.t('formFlowService.currentFormProcessDisabled'));
    }

    const branch = flows[0].branches.find(item => (
      item?.flows?.[0]?.uid === options.triggerNodeId
      && item?.flows?.[0]?.type === ProcessNodeType.TRIGGER_OPERATION
    ));
    if (!branch) {
      throw new Error(global.i18next.t('formFlowService.operationTriggerNodeInvalid'));
    }

    return branch;
  }

  private assertOperationTriggerMode(triggerNode: ProcessFlow | undefined, expectedMode: OperationTriggerMode) {
    if (!triggerNode || triggerNode.type !== ProcessNodeType.TRIGGER_OPERATION) {
      throw new Error(global.i18next.t('formFlowService.operationTriggerNodeInvalid'));
    }
    if (getOperationTriggerMode(triggerNode.options) === expectedMode) {
      return;
    }
    throw new Error(global.i18next.t(
      expectedMode === OperationTriggerMode.VIEW_CONTEXT_ONCE
        ? 'formFlowService.operationTriggerOnceModeInvalid'
        : 'formFlowService.operationTriggerEachModeInvalid',
    ));
  }

  async assertOperationTriggerAvailable(options: OperationTriggerOptions) {
    const entryId = await this.assertOperationTriggerConfiguration(options);
    const activeRecord = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (activeRecord) {
      throw new Error(global.i18next.t('formFlowService.operationTriggerActiveRecordExists'));
    }

    return entryId;
  }

  async assertOperationTriggerConfiguration(
    options: Pick<OperationTriggerOptions, "nocodeId" | "tableId" | "processId" | "triggerNodeId">,
  ) {
    const branch = await this.getOperationTriggerContext(options);
    this.assertOperationTriggerMode(branch.flows?.[0], OperationTriggerMode.EACH_RECORD);
    return branch.uid;
  }

  async getActiveOperationTriggerUUIDs(
    nocodeId: string,
    tableId: TableUID,
    uuids: string[] = [],
  ) {
    const normalizedUUIDs = [...new Set((uuids || []).map(uuid => String(uuid || "").trim()).filter(Boolean))];
    if (!normalizedUUIDs.length) {
      return new Set<string>();
    }
    const records = await this.flowExecutionRecordsRepository.find({
      nocodeId,
      tableId,
      uuid: { $in: normalizedUUIDs },
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    return new Set(records.map(record => String(record.uuid || "")).filter(Boolean));
  }

  private async resolveViewOperationTriggerContext(options: ViewOperationTriggerOptions) {
    const branch = await this.getOperationTriggerContext(options);
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const process = nocodeBody?.formData?.formOptions?.[options.tableId]?.process;
    const flows = getFlows(process);
    const triggerNode = branch?.flows?.[0];
    if (!process?.enabled || isEmpty(flows?.[0]?.branches)) {
      throw new Error(global.i18next.t('formFlowService.currentFormProcessDisabled'));
    }
    if (!triggerNode || triggerNode.type !== ProcessNodeType.TRIGGER_OPERATION) {
      throw new Error(global.i18next.t('formFlowService.operationTriggerNodeInvalid'));
    }

    return {
      flows,
      branch,
      triggerNode,
      processVersion: this.getEnabledProcessVersion(process) || 1,
    };
  }

  private async assertViewOperationTriggerAvailable(options: ViewOperationTriggerOptions) {
    const { branch, triggerNode } = await this.resolveViewOperationTriggerContext(options);
    this.assertOperationTriggerMode(triggerNode, OperationTriggerMode.VIEW_CONTEXT_ONCE);
    return branch.uid;
  }

  private getOperationTriggerLockKey(options: OperationTriggerOptions) {
    return [
      "operation-trigger",
      options.nocodeId,
      options.tableId,
      options.uuid,
    ].join(":");
  }

  private async withOperationTriggerLocks<T>(
    optionsList: OperationTriggerOptions[],
    handler: () => Promise<T>,
  ): Promise<T> {
    const lockKeys = [...new Set(
      optionsList
        .map(item => this.getOperationTriggerLockKey(item))
        .filter(Boolean),
    )].sort();

    if (!lockKeys.length) {
      return await handler();
    }

    const acquireLocks = async (index: number): Promise<T> => {
      if (index >= lockKeys.length) {
        return await handler();
      }
      return await this.lock.acquire(lockKeys[index], async () => {
        return await acquireLocks(index + 1);
      });
    };

    return await acquireLocks(0);
  }

  private async getOperationTriggerRowSnapshot(options: OperationTriggerOptions) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody?.formData;
    const table = formData?.tables?.find(item => item.uid === options.tableId);
    if (!formData || !table) {
      return null;
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) {
      return null;
    }

    const buckets = await this.formDataService._getData(formData, [options.tableId], options.nocodeId, {
      filters: {
        [options.tableId]: [{
          [uuidField.uid]: options.uuid,
        }],
      },
      enabledStage: false,
    });
    const row = buckets?.[0]?.rows?.[0];
    if (!row) {
      return null;
    }

    const rowSnapshot: Row = {
      [uuidField.uid]: row[uuidField.uid],
    };
    for (const fieldName of [
      SystemField.STATUS,
      SystemField.CURRENT_NODE,
      SystemField.DATA_STAGE,
      SystemField.TODO_ID,
      SystemField.UPDATE_TIME,
      SystemField.UPDATE_OWNER,
    ]) {
      const field = table.fields.find(item => item.meta.name === fieldName);
      if (!field) {
        continue;
      }
      rowSnapshot[field.uid] = deepClone(row[field.uid]);
    }
    return rowSnapshot;
  }

  private async createOperationTriggerCompensationContext(
    options: OperationTriggerOptions,
    mode: FlowCompensationMode,
  ): Promise<FlowCompensationContext> {
    return {
      mode,
      options,
      rowSnapshot: await this.getOperationTriggerRowSnapshot(options),
      compensationActions: [],
    };
  }

  private registerFlowCompensationAction(
    compensationContext: FlowCompensationContext | undefined,
    compensationAction: () => Promise<void>,
  ) {
    if (!compensationContext || compensationContext.mode === "none") {
      return;
    }
    compensationContext.compensationActions.push(compensationAction);
  }

  private async restoreFlowCompensationRowSnapshot(compensationContext: FlowCompensationContext) {
    if (!compensationContext.rowSnapshot) {
      return;
    }

    const nocodeBody = await getNocodeBody(this.nocodesDir, compensationContext.options.nocodeId);
    const formData = nocodeBody?.formData;
    const table = formData?.tables?.find(item => item.uid === compensationContext.options.tableId);
    if (!formData || !table) {
      return;
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) {
      return;
    }

    await this.formDataService.restoreRowsFromSnapshot(
      formData,
      compensationContext.options.nocodeId,
      compensationContext.options.tableId,
      [deepClone(compensationContext.rowSnapshot)],
      [[formData.uid, table.uid, uuidField.uid]],
      "main",
    );
  }

  private async clearOperationTriggerExecutionState(todoId?: string) {
    await this.clearFlowExecutionState(todoId);
  }

  private async rollbackFlowCompensationContext(compensationContext?: FlowCompensationContext) {
    if (!compensationContext || compensationContext.mode === "none") {
      return [];
    }

    const rollbackErrors: string[] = [];
    for (const compensationAction of [...compensationContext.compensationActions].reverse()) {
      try {
        await compensationAction();
      } catch (error) {
        rollbackErrors.push(this.getFlowErrorMessage(error));
      }
    }

    try {
      await this.restoreFlowCompensationRowSnapshot(compensationContext);
    } catch (error) {
      rollbackErrors.push(this.getFlowErrorMessage(error));
    }

    try {
      await this.clearOperationTriggerExecutionState(compensationContext.todoId);
    } catch (error) {
      rollbackErrors.push(this.getFlowErrorMessage(error));
    }

    return rollbackErrors;
  }

  private async addOperationTriggerTodo(
    options: OperationTriggerOptions,
    entryId: string,
    compensationContext?: FlowCompensationContext,
  ) {
    await this.addTodo({
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
      source: TODOTriggerType.OPERATION,
      entryId,
      operationId: options.operationId,
    }, compensationContext, {
      flowWorkerContext: options.flowWorkerContext,
    });
  }

  private async commitOperationTrigger(
    options: OperationTriggerOptions,
    entryId: string,
    mode: FlowCompensationMode = "best_effort",
  ) {
    const compensationContext = await this.createOperationTriggerCompensationContext(options, mode);
    try {
      await this.addOperationTriggerTodo(options, entryId, compensationContext);
      return compensationContext;
    } catch (error) {
      const rollbackErrors = await this.rollbackFlowCompensationContext(compensationContext);
      if (!isEmpty(rollbackErrors)) {
        throw new Error(global.i18next.t("formFlowService.rollbackFailed", {
          error: this.getFlowErrorMessage(error),
          rollbackErrors: rollbackErrors.join(global.i18next.t("formFlowService.rollbackFailureJoiner")),
        }));
      }
      throw error;
    }
  }

  async validateSubmitRows(
    formData: NocodeFormData,
    nocodeId: string,
    targetTableUID: TableUID,
    rows: Row[],
    options: {
      primaryTable?: Table | null,
      fullReplace?: boolean,
    } = {},
  ) {
    const resolvedTarget = this.resolveProcessTargetTable(nocodeId, {
      formData,
    }, targetTableUID);
    return await this.checkSubmitRows(
      resolvedTarget.targetFormData,
      resolvedTarget.targetNocodeId,
      options.primaryTable || null,
      resolvedTarget.targetTable,
      rows,
      {
        fullReplace: options.fullReplace,
      },
    );
  }

  private appendSubmitValidationMessages(target: string[], messages: string[] = []) {
    for (const message of messages) {
      const text = String(message || "").trim();
      if (!text || target.includes(text)) continue;
      target.push(text);
    }
    return target;
  }

  async triggerOperation(options: OperationTriggerOptions) {
    await this.withOperationTriggerLocks([options], async () => {
      const entryId = await this.assertOperationTriggerAvailable(options);
      const compensationContext = await this.commitOperationTrigger(options, entryId, "best_effort");
      await this.throwIfOperationTriggerImmediatelyFailedWithRollback(compensationContext);
    });
  }

  async triggerViewOperation(options: ViewOperationTriggerOptions) {
    const { flows, branch, triggerNode, processVersion } = await this.resolveViewOperationTriggerContext(options);
    await this.assertViewOperationTriggerAvailable(options);

    const account = await this.formDataService.getAccount();
    const todoId = unique(32);
    const uuid = unique(32);

    try {
      const startNode = flows[0];
      const record = await this.createRecord({
        nocodeId: options.nocodeId,
        tableId: options.tableId,
        uuid,
        todoId,
      }, startNode, ProcessNodeStatus.FINISHED, processVersion);
      record.operators = [account.id];
      record.metas = {
        [account.id]: {
          source: TODOTriggerType.OPERATION,
          entryId: branch.uid,
          operationId: options.operationId,
          operationDisplayName: options.actionDisplayName,
          emptyRowTrigger: options.triggerContext.matchedCount === 0,
        },
      };
      await this.flowExecutionRecordsRepository.persistAndFlush(record);
      await this.updateFlowExecutionContext(todoId, {
        viewActionTriggerContext: options.triggerContext,
      });

      const nextNode = getNextFlow(flows, triggerNode.uid);
      if (nextNode) {
        await this.addNextNode({
          nocodeId: options.nocodeId,
          tableId: options.tableId,
          uuid,
          todoId,
          flowWorkerContext: options.flowWorkerContext,
        }, flows, nextNode, account.id);
      }

      await this.throwIfOperationTriggerImmediatelyFailed(todoId);
    } catch (error) {
      const rollbackErrors: string[] = [];
      try {
        await this.clearOperationTriggerExecutionState(todoId);
      } catch (rollbackError) {
        rollbackErrors.push(this.getFlowErrorMessage(rollbackError));
      }

      if (!isEmpty(rollbackErrors)) {
        throw new Error(`${this.getFlowErrorMessage(error)}${global.i18next.t('formFlowService.rollbackFailurePrefix')}${rollbackErrors.join(global.i18next.t('formFlowService.rollbackFailureJoiner'))}`);
      }
      throw error;
    }
  }

  private getOperationTriggerFailureSuggestion(message: string) {
    const lowerMessage = (message || "").toLowerCase();
    if (message.includes("唯一") || message.includes("重复") || lowerMessage.includes("unique")) {
      return global.i18next.t("formFlowService.retryAfterChangingDuplicateValue");
    }
    if (
      (
        message.includes("流程")
        && (
          message.includes("尚未结束")
          || message.includes("进行中")
        )
      )
      || message.includes("重复触发")
    ) {
      return global.i18next.t("formFlowService.checkFlowStatusBeforeRetry");
    }
    if (message.includes("不存在") || message.includes("已被删除")) {
      return global.i18next.t("formFlowService.refreshListBeforeRetry");
    }
    if (message.includes("权限") || lowerMessage.includes("permission") || lowerMessage.includes("noperm")) {
      return global.i18next.t("formFlowService.contactAdminForPermission");
    }
    if (message.includes("未启用") || message.includes("触发节点") || message.includes("配置")) {
      return global.i18next.t("formFlowService.checkFlowConfigBeforeRetry");
    }
    return global.i18next.t("formFlowService.retryFailedRowsAfterFix");
  }

  private buildOperationTriggerFailedItem(
    options: OperationTriggerOptions,
    index: number,
    message: string,
  ): OperationTriggerFailedItem {
    return {
      index: options.batchIndex || index,
      uuid: options.uuid,
      dataTitle: options.dataTitle || options.uuid,
      message,
      suggestion: this.getOperationTriggerFailureSuggestion(message),
    };
  }

  private getOperationTriggerRecordComment(record?: FlowExecutionRecords) {
    for (const meta of Object.values(record?.metas || {})) {
      const comment = String(meta?.comment || "").trim();
      if (comment) {
        return comment;
      }
    }
    return "";
  }

  private async getOperationTriggerImmediateFailureMessage(todoId?: string) {
    if (!todoId) {
      return null;
    }

    const records = await this.flowExecutionRecordsRepository.find({ todoId }, {
      orderBy: {
        startTime: "DESC",
      },
    });
    if (isEmpty(records) || records.some(record => record.status === ProcessNodeStatus.IN_PROGRESS)) {
      return null;
    }

    const rejectedRecord = records.find(record => (
      record.status === ProcessNodeStatus.REJECTED
      && !!this.getOperationTriggerRecordComment(record)
    )) || records.find(record => (
      record.status === ProcessNodeStatus.REJECTED
      && record.type !== ProcessNodeType.END
    )) || records.find(record => record.status === ProcessNodeStatus.REJECTED);

    if (!rejectedRecord) {
      return null;
    }

    return this.getOperationTriggerRecordComment(rejectedRecord)
      || global.i18next.t("formFlowService.flowExecutionFailed");
  }

  private async throwIfOperationTriggerImmediatelyFailed(todoId?: string) {
    const immediateFailureMessage = await this.getOperationTriggerImmediateFailureMessage(todoId);
    if (immediateFailureMessage) {
      throw new Error(immediateFailureMessage);
    }
  }

  private async throwIfOperationTriggerImmediatelyFailedWithRollback(
    compensationContext?: FlowCompensationContext,
  ) {
    try {
      await this.throwIfOperationTriggerImmediatelyFailed(compensationContext?.todoId);
    } catch (error) {
      const rollbackErrors = await this.rollbackFlowCompensationContext(compensationContext);
      if (!isEmpty(rollbackErrors)) {
        throw new Error(`${this.getFlowErrorMessage(error)}${global.i18next.t('formFlowService.rollbackFailurePrefix')}${rollbackErrors.join(global.i18next.t('formFlowService.rollbackFailureJoiner'))}`);
      }
      throw error;
    }
  }

  async triggerOperations(optionsList: OperationTriggerOptions[]): Promise<OperationTriggerBatchResult> {
    const result: OperationTriggerBatchResult = {
      attemptedCount: optionsList.length,
      successCount: 0,
      failedCount: 0,
      failedItems: [],
    };
    if (isEmpty(optionsList)) {
      return result;
    }

    return await this.withOperationTriggerLocks(optionsList, async () => {
      for (let index = 0; index < optionsList.length; index++) {
        const options = optionsList[index];
        try {
          const entryId = await this.assertOperationTriggerAvailable(options);
          const compensationContext = await this.commitOperationTrigger(options, entryId, "best_effort");
          await this.throwIfOperationTriggerImmediatelyFailedWithRollback(compensationContext);
          result.successCount += 1;
        } catch (error) {
          const message = this.getFlowErrorMessage(error);
          this.logger.error(
            `Operation trigger failed: ${options.nocodeId}:${options.tableId}:${options.uuid}`,
            error instanceof Error ? error.stack : String(error),
          );
          result.failedCount += 1;
          result.failedItems.push(this.buildOperationTriggerFailedItem(
            options,
            index + 1,
            message,
          ));
        }
      }
      return result;
    });
  }

  private reorderAccountsByConfiguredUserOrder(accounts: Account[], configuredUserIds: string[] = []) {
    if (accounts.length <= 1 || configuredUserIds.length <= 1) {
      return accounts;
    }

    const configuredIndex = new Map(
      configuredUserIds
        .filter(id => typeof id === "string" && id)
        .map((id, index) => [id, index])
    );
    const matchedPositions: number[] = [];
    const matchedAccounts: Account[] = [];

    accounts.forEach((account, index) => {
      if (!configuredIndex.has(account.id)) {
        return;
      }
      matchedPositions.push(index);
      matchedAccounts.push(account);
    });

    if (matchedAccounts.length <= 1) {
      return accounts;
    }

    matchedAccounts.sort((a, b) => configuredIndex.get(a.id)! - configuredIndex.get(b.id)!);

    const result = [...accounts];
    matchedPositions.forEach((position, index) => {
      result[position] = matchedAccounts[index];
    });
    return result;
  }

  private normalizePendingOperatorIds(userIds?: string[]) {
    return Array.isArray(userIds)
      ? userIds.filter(item => typeof item === "string" && item)
      : [];
  }

  private reorderUserIdsByConfiguredOrder(userIds: string[], configuredUserIds: string[] = []) {
    if (userIds.length <= 1 || configuredUserIds.length <= 1) {
      return userIds;
    }

    const configuredIndex = new Map(
      configuredUserIds
        .filter(id => typeof id === "string" && id)
        .map((id, index) => [id, index])
    );
    const matchedPositions: number[] = [];
    const matchedUserIds: string[] = [];

    userIds.forEach((userId, index) => {
      if (!configuredIndex.has(userId)) {
        return;
      }
      matchedPositions.push(index);
      matchedUserIds.push(userId);
    });

    if (matchedUserIds.length <= 1) {
      return userIds;
    }

    matchedUserIds.sort((a, b) => configuredIndex.get(a)! - configuredIndex.get(b)!);

    const result = [...userIds];
    matchedPositions.forEach((position, index) => {
      result[position] = matchedUserIds[index];
    });
    return result;
  }

  private getConfiguredFlowUserOrder(flow?: ProcessFlow) {
    if (flow?.type === ProcessNodeType.APPROVAL) {
      return flow.options?.approver?.[ProcessNodeOwnerType.ASSIGNEE]?.users || [];
    }

    if (flow?.type === ProcessNodeType.TRANSACT) {
      return flow.options?.transactor?.[ProcessNodeOwnerType.ASSIGNEE]?.users || [];
    }

    return [];
  }

  private getOrderedPendingOperatorIds(flow: ProcessFlow | undefined, owners?: string[]) {
    const pendingOperatorIds = this.normalizePendingOperatorIds(owners);
    if (!flow || pendingOperatorIds.length <= 1) {
      return pendingOperatorIds;
    }

    return this.reorderUserIdsByConfiguredOrder(
      pendingOperatorIds,
      this.getConfiguredFlowUserOrder(flow),
    );
  }

  private isSequentialApprovalFlow(flow?: ProcessFlow) {
    return flow?.type === ProcessNodeType.APPROVAL
      && (
        flow.options?.categoryRule === ApprovalCategoryRule.STEP_BY_STEP
        || flow.options?.approverType === ApproverType.SEQUENTIAL
      );
  }

  private isSequentialTransactFlow(flow?: ProcessFlow) {
    return flow?.type === ProcessNodeType.TRANSACT
      && flow.options?.transactorType === ApproverType.SEQUENTIAL;
  }

  private getNextSequentialOperatorIds(owners: string[], operators: string[]) {
    const isHandledPrefix = operators.every((operatorId, index) => owners[index] === operatorId);
    if (isHandledPrefix) {
      const nextOperatorId = owners[operators.length];
      if (nextOperatorId) {
        return [nextOperatorId];
      }
    }

    const handledOperatorIds = new Set(operators);
    const fallbackOperatorId = owners.find(item => !handledOperatorIds.has(item));
    return fallbackOperatorId ? [fallbackOperatorId] : [];
  }

  private getActivePendingOperatorIds(flow: ProcessFlow | undefined, owners?: string[], operators?: string[]) {
    const pendingOperatorIds = this.getOrderedPendingOperatorIds(flow, owners);
    if (!flow || !pendingOperatorIds.length) {
      return pendingOperatorIds;
    }

    const handledOperatorIds = this.normalizePendingOperatorIds(operators);
    if (this.isSequentialApprovalFlow(flow) || this.isSequentialTransactFlow(flow)) {
      return this.getNextSequentialOperatorIds(pendingOperatorIds, handledOperatorIds);
    }

    if ([ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(flow.type)) {
      const handledOperatorIdSet = new Set(handledOperatorIds);
      return pendingOperatorIds.filter(item => !handledOperatorIdSet.has(item));
    }

    return pendingOperatorIds;
  }

  private getOwnerOrder(owner: ProcessNodeOwner) {
    const defaultOrder = [
      ProcessNodeOwnerType.SUBMITTER,
      ProcessNodeOwnerType.ASSIGNEE,
      ProcessNodeOwnerType.DEPARTMENT_MANAGER,
      ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER,
      ProcessNodeOwnerType.FORM_MEMBER,
      ProcessNodeOwnerType.FORM_DEPARTMENT,
    ];

    if (!Array.isArray(owner?.ownerOrder)) {
      return defaultOrder;
    }

    const ownerOrder = owner.ownerOrder.filter(type => defaultOrder.includes(type) && (
      type === ProcessNodeOwnerType.SUBMITTER ? owner[type] : type in owner
    ));
    const missingTypes = defaultOrder.filter(type => (
      type === ProcessNodeOwnerType.SUBMITTER ? owner[type] : type in owner
    ) && !ownerOrder.includes(type));
    return [...ownerOrder, ...missingTypes];
  }

  /**
   * Only these nodes wait for a human. Every other node runs on its own and
   * must not be reported as somebody's pending todo.
   */
  private isPendingOperatorFlow(flow: ProcessFlow) {
    return [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(flow.type);
  }

  /**
   * Whether a pending todo has passed its node deadline. Kept next to
   * `buildTodoProcessingTime` so counting overtime todos does not need a
   * converted todo object per record.
   */
  private isOvertimeTodoRecord(record: FlowExecutionRecords, flow?: ProcessFlow) {
    const deadlineAt = this.buildTodoProcessingTime(record, flow).deadlineAt;
    return typeof deadlineAt === "number" && deadlineAt <= Date.now();
  }

  private async filterMyTodoRecordsByCurrentOperator(
    records: FlowExecutionRecords[],
    formDatas: any[],
    userId: string,
  ): Promise<Array<{ record: FlowExecutionRecords, flow?: ProcessFlow }>> {
    if (!records.length) {
      return [];
    }

    const formDataMap = new Map(formDatas.map(item => [item.nocodeId, item.formData as NocodeFormData]));
    const visibleRecords = await Promise.all(records.map(async record => {
      const formData = formDataMap.get(record.nocodeId);
      const process = formData?.formOptions?.[record.tableId]?.process;
      if (!process) {
        return { record };
      }

      const flows = await this.getInstanceFlows(process, {
        nocodeId: record.nocodeId,
        tableId: record.tableId,
        uuid: record.uuid,
        todoId: record.todoId,
      }, record);
      const flow = getFlowById(flows, record.flowId);
      if (!flow) {
        return { record };
      }

      // A running automatic node (data change, branch, plugin...) keeps the
      // executing account in paddingOperators so the flow panel can show its
      // node owner. While the flow waits in the execution queue that record is
      // IN_PROGRESS but nobody can act on it, so it must not show up as a todo;
      // stashed records keep their node until their submitter commits.
      if (record.isStashed !== true && !this.isPendingOperatorFlow(flow)) {
        return null;
      }

      return this.getActivePendingOperatorIds(flow, record.paddingOperators, record.operators).includes(userId)
        ? { record, flow }
        : null;
    }));

    return visibleRecords.filter(Boolean) as Array<{ record: FlowExecutionRecords, flow?: ProcessFlow }>;
  }

  private async getOwners(options: BaseTodoOptions, owner: ProcessNodeOwner, initiatorId: string) {
    const users = [];
    if (!owner) return users;

    let currentRowContext: any = null;
    let currentTable: Table | undefined;
    const getCurrentRowContext = async () => {
      if (!currentRowContext) {
        const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
        const formData = nocodeBody.formData as NocodeFormData;
        currentTable = formData.tables.find(t => t.uid === options.tableId);
        currentRowContext = await this.resolveRuntimeCurrentRowContext(options, {
          formData,
          currentTable,
        });
      }
      return {
        row: currentRowContext?.currentRow,
        table: currentTable,
      };
    };

    for (const ownerType of this.getOwnerOrder(owner)) {
      if (ownerType === ProcessNodeOwnerType.SUBMITTER && owner[ProcessNodeOwnerType.SUBMITTER]) {
        users.push(initiatorId);
      }

      if (ownerType === ProcessNodeOwnerType.ASSIGNEE && owner[ProcessNodeOwnerType.ASSIGNEE]) {
        const data = this.reorderAccountsByConfiguredUserOrder(
          await this.workbenchService.getUsers(owner[ProcessNodeOwnerType.ASSIGNEE]),
          owner[ProcessNodeOwnerType.ASSIGNEE]?.users || [],
        );
        for (const user of data) {
          if (users.includes(user.id)) continue;
          users.push(user.id);
        }
      }

      if (ownerType === ProcessNodeOwnerType.DEPARTMENT_MANAGER && owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER]) {
        const data = await this.workbenchService.getDepartmentManagerByLevel(initiatorId, owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER]);
        users.push(...data);
      }

      if (ownerType === ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER && owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]) {
        const data = await this.workbenchService.getDepartmentManagerByLevel(initiatorId, owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]);
        users.push(...data);
      }

      if (ownerType === ProcessNodeOwnerType.FORM_MEMBER && owner[ProcessNodeOwnerType.FORM_MEMBER]) {
        const { row, table } = await getCurrentRowContext();
        if (!row) {
          return Array.from(new Set(users));
        }
        const data = owner[ProcessNodeOwnerType.FORM_MEMBER]
          .flatMap(fieldId => this.normalizeFieldOwnerValueToIds(
            this.getCurrentRowFieldValue(row, table, fieldId),
            "user",
          ));
        users.push(...data);
      }

      if (ownerType === ProcessNodeOwnerType.FORM_DEPARTMENT && owner[ProcessNodeOwnerType.FORM_DEPARTMENT]) {
        const { row, table } = await getCurrentRowContext();
        if (!row) {
          return Array.from(new Set(users));
        }
        const data = this.normalizeFieldOwnerValueToIds(
          this.getCurrentRowFieldValue(row, table, owner[ProcessNodeOwnerType.FORM_DEPARTMENT].value),
          "department",
        );
        if (data.length) {
          const departments = await this.workbenchService.getDepartmentsByIds(data);
          const managers = departments.map(d => d.managers).flat();
          users.push(...managers);
        }
      }
    }
    return Array.from(new Set(users));
  }

  private getCurrentRowFieldValue(row: Row, table: Table, fieldId: string) {
    if (!row || !fieldId) {
      return undefined;
    }

    const field = table?.fields?.find(item =>
      item.uid === fieldId
      || item.meta?.uid === fieldId
      || item.meta?.name === fieldId
    );
    const candidateKeys = Array.from(new Set([
      fieldId,
      field?.uid,
      field?.meta?.uid,
      field?.meta?.name,
    ].filter(Boolean)));

    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        return row[key];
      }
    }

    return undefined;
  }

  private normalizeFieldOwnerValueToIds(
    value: any,
    type: "user" | "department",
  ): string[] {
    const normalizedValues = this.normalizeFieldOwnerValue(value, type);
    return Array.from(new Set(
      normalizedValues
        .map(item => {
          if (typeof item === "object") {
            return item?.id ?? item?.uid ?? item?.value;
          }
          return item;
        })
        .map(item => String(item ?? "").trim())
        .filter(Boolean)
    ));
  }

  private normalizeFieldOwnerValue(
    value: any,
    type: "user" | "department",
  ): any[] {
    if (Array.isArray(value)) {
      return value.flatMap(item => this.normalizeFieldOwnerValue(item, type));
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    }

    if (value && typeof value === "object") {
      const groupedValue = type === "user" ? value?.users : value?.departments;
      if (Array.isArray(groupedValue)) {
        return groupedValue.flatMap(item => this.normalizeFieldOwnerValue(item, type));
      }

      const directId = value?.id ?? value?.uid ?? value?.value;
      if (directId !== undefined && directId !== null && directId !== "") {
        return [directId];
      }
    }

    if (value === undefined || value === null || value === "") {
      return [];
    }

    return [value];
  }

  async getOwnersByNode(options: BaseTodoOptions, node: ProcessFlow, initiatorId?: string): Promise<string[]> {
    if (!node) return [];
    if (!initiatorId) {
      const startRecord = await this.getStartRecord(options);
      if (!startRecord) return [];
      initiatorId = startRecord.operators[0];
    }
    let users = [];
    if (node.type === ProcessNodeType.APPROVAL) {
      const { approver, categoryRule, approverEmpty, approverEmptyAdmin, approverEmptyUsers } = node.options;
      if (categoryRule === ApprovalCategoryRule.NORMAL) {
        delete approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER];
        users = await this.getOwners(options, approver, initiatorId);
      } else {
        users = await this.getOwners(options, { [ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]: approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER] }, initiatorId);
      }
      const accounts = await this.workbenchService.filterValidUsers(users);
      if (isEmpty(accounts)) {
        if (approverEmpty === OwnerEmptyHandle.ASSIGNEE) {
          users = approverEmptyUsers;
        } else if (approverEmpty === OwnerEmptyHandle.ADMIN) {
          users = [approverEmptyAdmin];
        } else if (approverEmpty === OwnerEmptyHandle.AUTO_APPROVE) {
          return [];
        }
      }
    } else if (node.type === ProcessNodeType.TRANSACT) {
      const { transactor, transactorEmpty, transactorEmptyAdmin, transactorEmptyUsers } = node.options
      users = await this.getOwners(options, transactor, initiatorId);
      const accounts = await this.workbenchService.filterValidUsers(users);
      if (isEmpty(accounts)) {
        if (transactorEmpty === OwnerEmptyHandle.ASSIGNEE) {
          users = transactorEmptyUsers;
        } else {
          users = [transactorEmptyAdmin];
        }
      }
    } else if (node.type === ProcessNodeType.NOTIFY) {
      const { notifier } = node.options
      users = await this.getOwners(options, notifier, initiatorId);
    } else if (node.type === ProcessNodeType.REPORT_DATA) {
      const { reporter, reporterEmpty, reporterEmptyAdmin, reporterEmptyUser } = node.options
      users = await this.getOwners(options, reporter, initiatorId);
      const accounts = await this.workbenchService.filterValidUsers(users);
      if (isEmpty(accounts)) {
        if (reporterEmpty === OwnerEmptyHandle.ASSIGNEE) {
          users = [reporterEmptyUser];
        } else {
          users = [reporterEmptyAdmin];
        }
      }
    }
    const accounts = await this.workbenchService.filterValidUsers(users);
    if (isEmpty(accounts)) {
      const admin = await this.workbenchService.getAdmin();
      return [admin.id];
    }
    // 转交�?
    // const query: FilterQuery<FlowExecutionRecords> = {
    //   nocodeId: options.nocodeId,
    //   uuid: options.uuid,
    //   flowId: node.uid,
    //   type: node.type,
    //   transfer: {
    //     $ne: null
    //   },
    // };
    // if (options.todoId) {
    //   query.todoId = options.todoId;
    // }
    // const flowRecord = await this.flowExecutionRecordsRepository.findOne(query, { orderBy: { startTime: "DESC" } });
    // if (!isEmpty(flowRecord?.transfer)) {
    //   return users.map(id => (flowRecord.transfer[id] || id));
    // }
    return users;
  }

  async getFlowsPaddingOperators(options: BaseTodoOptions, flows: ProcessFlow[]) {
    const query: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
      flowId: {
        $in: flows.map(f => f.uid),
      },
      status: ProcessNodeStatus.IN_PROGRESS, 
    }
    if (options.todoId) query.todoId = options.todoId;
    const records = await this.flowExecutionRecordsRepository.find(query);
    return records.reduce<Record<string, string[]>>((p, r) => {
      let operatorIds = Array.isArray(r.paddingOperators)
        ? r.paddingOperators.filter((item): item is string => typeof item === "string" && item.length > 0)
        : [];
      if (!operatorIds.length && isDataProcessingNode(r.type)) {
        operatorIds = Object.keys(r.metas || {}).filter(Boolean);
      }
      if (operatorIds.length) {
        p[r.flowId] = operatorIds;
      }
      return p;
    }, {});
  }

  private async createRecord(
    options: BaseTodoOptions,
    node: ProcessFlow,
    status = ProcessNodeStatus.IN_PROGRESS,
    processVersion?: number,
    scheduled?: { runId: string, scheduledFor: number },
    persist = true,
    entityManager: EntityManager = this.entityManager,
  ) {
    await this.assertScheduledLease(options);
    const flowExecutionRecord = new FlowExecutionRecords();
    flowExecutionRecord.nocodeId = options.nocodeId;
    flowExecutionRecord.tableId = options.tableId;
    flowExecutionRecord.uuid = options.uuid;
    flowExecutionRecord.processVersion = Number.isInteger(processVersion) && processVersion > 0
      ? processVersion
      : options.todoId
        ? await this.getInstanceProcessVersion(options)
        : 1;
    flowExecutionRecord.flowId = node.uid;
    flowExecutionRecord.type = node.type;
    flowExecutionRecord.status = status;
    flowExecutionRecord.startTime = Date.now();
    if (status !== ProcessNodeStatus.IN_PROGRESS) {
      flowExecutionRecord.endTime = flowExecutionRecord.startTime + 1000;
    }
    if (options.todoId) flowExecutionRecord.todoId = options.todoId;
    if (scheduled) {
      flowExecutionRecord.scheduledRunId = scheduled.runId;
      flowExecutionRecord.scheduledFor = scheduled.scheduledFor;
    }
    if (persist) {
      await entityManager.persistAndFlush(flowExecutionRecord);
    } else {
      entityManager.persist(flowExecutionRecord);
    }
    return flowExecutionRecord;
  }

  private async initializeNodeTimeoutMeta(
    options: BaseTodoOptions,
    node: ProcessFlow,
    record: FlowExecutionRecords,
    startRecord?: FlowExecutionRecords | null,
  ) {
    const timeout = this.getNodeTimeoutConfig(node);
    if (!timeout?.enabled) {
      return;
    }

    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options, { startRecord });
    const triggerRowSnapshot = await this.getTriggerRowSnapshot(options.todoId || startRecord?.todoId);
    const deadlineAt = resolveTimeoutDeadlineAt(timeout.deadline, {
      currentRow: triggerRowSnapshot || currentRowContext?.currentRow,
      nodeArrivedAt: record.startTime,
    });
    if (!Number.isFinite(deadlineAt || NaN)) {
      return;
    }

    const timeoutMeta = this.ensureTimeoutMeta(record);
    timeoutMeta.timeoutDeadlineAt = deadlineAt as number;
    timeoutMeta.timeoutRuleExecutedAtMap = timeoutMeta.timeoutRuleExecutedAtMap || {};
  }

  private async startApprovalNode(options: BaseTodoOptions, node: ProcessFlow, initiatorId: string) {
    await this.ensureNodeSupportsEmptyRowTrigger(options, node);
    let owners = await this.getOwnersByNode(options, node, initiatorId);
    const isFinish = isEmpty(owners) && node.options.approverEmpty === OwnerEmptyHandle.AUTO_APPROVE;
    const record = await this.createRecord(options, node, isFinish ? ProcessNodeStatus.FINISHED : ProcessNodeStatus.IN_PROGRESS);
    if (!isFinish) {
      record.paddingOperators = owners;
      await this.initializeNodeTimeoutMeta(options, node, record);
      await this.flowExecutionRecordsRepository.persistAndFlush(record);
    }
    return record;
  }

  private async startTransactNode(options: BaseTodoOptions, node: ProcessFlow, initiatorId: string) {
    await this.ensureNodeSupportsEmptyRowTrigger(options, node);
    const owners = await this.getOwnersByNode(options, node, initiatorId);
    if (isEmpty(owners)) {
      // TODO 错误处理
      throw new Error(global.i18next.t('formFlowService.noHandlerForHandleNode'));
    }
    const record = await this.createRecord(options, node);
    record.paddingOperators = owners;
    await this.initializeNodeTimeoutMeta(options, node, record);
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
  }

  private async startNotifyNode(options: BaseTodoOptions, node: ProcessFlow, initiatorId: string) {
    await this.ensureNodeOwnerSupportsEmptyRowTrigger(options, node);
    const owners = await this.getOwnersByNode(options, node, initiatorId);
    if (isEmpty(owners)) {
      // TODO 错误处理
      this.logger.error(global.i18next.t('formFlowService.noCcPersonForCcNode'));
    }
    const record = await this.createRecord(options, node, ProcessNodeStatus.FINISHED);
    record.operators = owners;
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
  }

  private async startReportDataNode(options: BaseTodoOptions, node: ProcessFlow, initiatorId: string) {
    await this.ensureNodeOwnerSupportsEmptyRowTrigger(options, node);
    const owners = await this.getOwnersByNode(options, node, initiatorId);
    if (isEmpty(owners)) {
      // TODO 错误处理
      throw new Error(global.i18next.t('formFlowService.noFillerForFillNode'));
    }
    const record = await this.createRecord(options, node);
    record.paddingOperators = owners;
    await this.initializeNodeTimeoutMeta(options, node, record);
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
  }

  private async getStartRecord(options: Partial<BaseTodoOptions>) {
    const query: FilterQuery<FlowExecutionRecords> = {
      type: ProcessNodeType.START,
      uuid: options.uuid,
    }
    if (options.nocodeId) {
      query.nocodeId = options.nocodeId;
    }
    if (options.tableId) {
      query.tableId = options.tableId;
    }
    if (options.todoId) {
      query.todoId = options.todoId;
    }
    return await this.flowExecutionRecordsRepository.findOne(query);
  }

  private async getNodeConditionValue(
    options: BaseTodoOptions,
    nodes: ProcessFlow[],
    startRecord: FlowExecutionRecords | null,
    nodeId: string,
  ) {
    const targetNode = getFlowById(nodes, nodeId);
    if (!targetNode) return;

    if (isTriggerNode(targetNode.type)) {
      const startId = startRecord?.operators?.[0];
      return startRecord?.metas?.[startId]?.source;
    }

    if (targetNode.type === ProcessNodeType.APPROVAL) {
      const query: FilterQuery<FlowExecutionRecords> = {
        nocodeId: options.nocodeId,
        tableId: options.tableId,
        uuid: options.uuid,
        flowId: nodeId,
        type: ProcessNodeType.APPROVAL,
        status: {
          $in: [ProcessNodeStatus.FINISHED, ProcessNodeStatus.REJECTED, ProcessNodeStatus.SKIPPED],
        },
      };
      if (options.todoId) query.todoId = options.todoId;
      const record = await this.flowExecutionRecordsRepository.findOne(query, {
        orderBy: {
          startTime: "DESC",
        },
      });
      if (record?.status === ProcessNodeStatus.SKIPPED) return;
      return record?.status;
    }

    return;
  }

  private async normalizeBranchConditions(
    options: BaseTodoOptions,
    nodes: ProcessFlow[],
    conditions: ConditionBranchCondition[][] = [],
    sourceTableRows: Record<string, Row[]>,
    startRecord: FlowExecutionRecords | null,
  ) {
    const nodeConditionValueMap = new Map<string, string | undefined>();

    return await Promise.all((conditions || []).map(async (conditionGroup) => {
      return await Promise.all(conditionGroup.map(async (condition) => {
        if (condition.type === FormConditionValueType.FORMULA) {
          condition.formula = replaceColFieldsByFormula(condition.formula, (keys) => {
            const [sourceUID, fieldId, subFieldId] = keys;
            const rows = sourceTableRows[sourceUID];
            const fieldValue = rows?.map(row => row[fieldId]);
            if (isEmpty(fieldValue)) return null;

            if (subFieldId) {
              return fieldValue.flatMap(rows => rows.map(item => item[subFieldId]));
            }
            return fieldValue;
          });

          condition.formula = replaceByFormula(condition.formula, (keys) => {
            const [sourceUID, fieldId, subFieldId] = keys;
            const rows = sourceTableRows[sourceUID];
            if (isEmpty(rows)) return null;
            let fieldValue = rows[0]?.[fieldId];
            fieldValue = Number.isNaN(fieldValue) ? 0 : fieldValue;
            if (subFieldId) {
              return fieldValue.map(row => row[subFieldId]);
            }
            return fieldValue;
          });
        } else if (condition.type === FormConditionValueType.NODE) {
          const nodeId = condition.uid;
          if (!nodeId) {
            condition.uid = undefined;
            return condition;
          }
          if (!nodeConditionValueMap.has(nodeId)) {
            nodeConditionValueMap.set(nodeId, await this.getNodeConditionValue(options, nodes, startRecord, nodeId));
          }
          condition.uid = nodeConditionValueMap.get(nodeId);
        }
        return condition;
      }));
    }));
  }

  private async continueFlowAtNode(
    options: WorkerNodeTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow | undefined,
    initiatorId: string,
    compensationContext?: FlowCompensationContext,
  ) {
    if (!node) return;
    if (options.flowWorkerContinuation) {
      options.flowWorkerContinuation.nextNodeIds.push(node.uid);
      return;
    }
    await this.addNextNode(options, nodes, node, initiatorId, compensationContext);
  }

  private async evaluateFlowBranchConditions(
    options: WorkerNodeTodoOptions,
    row: Row,
    conditions: ConditionBranchCondition[][],
    sourceTableRows: Record<TableUID, Row[]>,
    fields: Field[],
  ) {
    const context = options.flowWorkerContext;
    const conditionWorkerFlag = process.env.FLOW_EXECUTION_TRIGGER_CONDITION_WORKER;
    // A worker-driven node (`flowWorkerContinuation`) already occupies this
    // queue class' pool: the worker command drives the node and waits for this
    // answer, while Tinypool treats a worker running an abortable task as fully
    // occupied. Offloading here would queue behind that very command and stall
    // until the RPC budget expires, so evaluate inline instead.
    if (context && !options.flowWorkerContinuation && this.flowWorkerPool && conditionWorkerFlag !== "false"
      && (process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool") === "tinypool") {
      try {
        return await this.flowWorkerPool.evaluateTriggerConditions({
          row,
          conditions,
          sourceTableRows,
          fields,
        }, context.queueClass || "p1");
      } catch (error) {
        if ((context.queueClass || "p1") === "p1") throw error;
        this.logWorkerFallback("P0 flow branch condition worker failed; falling back inline", error);
      }
    }
    return isMeetConditionsByRow(row, conditions, sourceTableRows, fields);
  }

  private async enterConditionBranch(
    options: WorkerNodeTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow,
    initiatorId: string,
    compensationContext?: FlowCompensationContext,
  ) {
    const branches = node.branches;
    const conditionBranches = branches.slice(0, -1);
    let branch = branches.at(-1);
    // 拿到当前数据
    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(t => t.uid === options.tableId);
    const startRecord = await this.getStartRecord(options);
    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options, {
      formData,
      currentTable: table,
      startRecord,
    });
    if (!currentRowContext?.currentRow) return;
    const { currentRows, currentRow: row } = currentRowContext;

    const sourceTableRows = {
      [options.tableId]: currentRows,
    };
    for (const conditionBranch of conditionBranches) {
      const conditionNode = conditionBranch.flows[0];
      let { sourceTables, conditions } = conditionNode.options || {};
      if (sourceTables) {
        await Promise.all(sourceTables.map(async (item) => {
          const filterRule = item.filterRule;
          sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, options.nocodeId, item.tableUID, filterRule, row, {
            fillSubTable: true,
            formulaRuntime: createFormulaRuntimeByData(row, table.fields),
          });
        }));
      }
      const normalizedConditions = deepClone(conditions || []);
      conditions = await this.normalizeBranchConditions(options, nodes, normalizedConditions, sourceTableRows, startRecord);
      const isMeet = await this.evaluateFlowBranchConditions(options, row, conditions, sourceTableRows, table.fields);
      if (isMeet?.valid) {
        branch = conditionBranch;
        break;
      }
    }
    const nextNode = getNextFlow(nodes, branch.flows[0].uid);
    if (branch.flows.length <= 1) {
      // TODO 判断是否是最后执行的那个节点
      return await this.continueFlowAtNode(options, nodes, nextNode, initiatorId, compensationContext);
    } else {
      return await this.continueFlowAtNode(options, nodes, nextNode, initiatorId, compensationContext);
    }
  }

  private async enterParallelBranch(
    options: WorkerNodeTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow,
    initiatorId: string,
    compensationContext?: FlowCompensationContext,
  ) {
    const allBranches = node.branches;
    const conditionBranches = allBranches.slice(0, -1);
    let branches = allBranches.slice(-1);

    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(t => t.uid === options.tableId);
    const startRecord = await this.getStartRecord(options);
    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options, {
      formData,
      currentTable: table,
      startRecord,
    });
    if (!currentRowContext?.currentRow) return;
    const { currentRows, currentRow: row } = currentRowContext;

    const sourceTableRows = {
      [options.tableId]: currentRows,
    };
    const meetBranches = await Promise.all(conditionBranches.map(async branch => {
      let { conditions, sourceTables } = branch.flows[0]?.options || {};
      if (isEmpty(conditions)) return branch;
      if (sourceTables) {
        await Promise.all(sourceTables.map(async (item) => {
          const filterRule = item.filterRule;
          sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, options.nocodeId, item.tableUID, filterRule, row, {
            fillSubTable: true,
            formulaRuntime: createFormulaRuntimeByData(row, table.fields),
          });
        }));
      }
      const normalizedConditions = deepClone(conditions || []);
      conditions = await this.normalizeBranchConditions(options, nodes, normalizedConditions, sourceTableRows, startRecord);
      const isMeet = await this.evaluateFlowBranchConditions(options, row, conditions, sourceTableRows, table.fields);
      if (isMeet?.valid) {
        return branch;
      }
    })).then((data) => data.filter(Boolean));
    if (!isEmpty(meetBranches)) {
      branches = meetBranches;
    }
    branches = branches.filter(b => b.flows.length > 1);
    if (isEmpty(branches)) {
      const nextNode = getNextFlow(nodes, node.uid);
      await this.continueFlowAtNode(options, nodes, nextNode, initiatorId, compensationContext);
      return;
    }
    
    const flowBranchRecord = new FlowBranchRecords();
    flowBranchRecord.flowId = node.uid;
    flowBranchRecord.uuid = options.uuid;
    flowBranchRecord.branchIds = branches.map(b => b.flows[0].uid);
    flowBranchRecord.status = ProcessNodeStatus.IN_PROGRESS;
    if (options.todoId) {
      flowBranchRecord.todoId = options.todoId;
    }
    await this.flowBranchRecordsRepository.persistAndFlush(flowBranchRecord);
    for (const branch of branches) {
      const nextNode = getNextFlow(nodes, branch.flows[0].uid);
      await this.continueFlowAtNode(options, nodes, nextNode, initiatorId, compensationContext);
    }
  }

  private async getTableRows(nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">, nocodeId: string, tableUID: TableUID, filterRule: FilterRule, row: Row, options?: GetTableRowsOptions) {
    const logic = filterRule?.logic || LogicalOperator.AND;
    const conditions = (filterRule?.conditions || []).filter((item) => {
      return !(
        isEmpty(item?.uid)
        && isEmpty(item?.func)
        && isEmpty(item?.value)
        && isEmpty(item?.formula)
      );
    });
    const { formulaRuntime } = options || {};
    const { main, ...subGroup } = conditions.reduce<Record<string, FormCondition[]>>((prev, item) => {
      const arr = item.uid?.split(".") || [];
      if (arr.length > 1) {
        if (!prev[arr[0]]) prev[arr[0]] = [];
        prev[arr[0]].push(item);
      } else {
        prev.main.push(item);
      }
      return prev;
    }, { main: []});
    const sourceData = getNocodeDataSourceTableByUID(nocodeBody, tableUID, {
      nocodeId,
      includeSchemaSources: true,
    }, true);
    const sourceFormData = sourceData?.connection as NocodeFormData;
    const sourceNocodeId = sourceData?.connection?.nocodeId || nocodeId;
    const table = sourceData?.table;
    if (!sourceFormData || !table) return [];
    let uuids = [];
    let hasEffectiveSubGroupConditions = false;
    const subWhereCondition: Record<string, WhereCondition> = {};
    if (!isEmpty(subGroup)) {
      const promises = [];
      for (const fieldId in subGroup) {
        const field = table.fields.find(f => f.uid === fieldId);
        const subTableUID = field.meta.extra?.subTableUID;
        if (!subTableUID) continue;
        const subTable = sourceFormData.tables.find(t => t.uid === subTableUID[1]);
        const keyField = subTable.fields.find(f => f.meta.name === SystemField.KEY);
        const normalizedConditions = this.normalizeFilterConditionsBySourceValue(subGroup[fieldId]);
        if (isEmpty(normalizedConditions)) continue;
        hasEffectiveSubGroupConditions = true;
        const whereCondition = transformFilterRule({
          logic,
          conditions: normalizedConditions,
        }, row, { formulaRuntime });
        subWhereCondition[fieldId] = whereCondition;
        promises.push(this.formDataService.distinct(sourceNocodeId, subTable.uid, keyField.uid, {
          filters: {
            [subTable.uid]: [whereCondition],
          }
        }))
      }
      if (!isEmpty(promises)) {
        const uuidGroup = await Promise.all(promises);
        uuids = logic === LogicalOperator.AND ? intersection(...uuidGroup) : Array.from(new Set(uuidGroup.flat()));
      }
    }
    const normalizedMainConditions = this.normalizeFilterConditionsBySourceValue(main);
    if (
      hasEffectiveSubGroupConditions
      && isEmpty(uuids)
      && (
        logic === LogicalOperator.AND
        || isEmpty(normalizedMainConditions)
      )
    ) {
      return [];
    }
    const whereCondition = isEmpty(normalizedMainConditions)
      ? null
      : transformFilterRule({
        logic,
        conditions: normalizedMainConditions,
      }, row, { formulaRuntime });
    const operator = logic === LogicalOperator.AND ? "$and" : "$or";
    const uuidField = getUUIDSystemField(table.fields);
    let prev = options?.filters?.[tableUID] || [];
    prev = Array.isArray(prev) ? prev : [prev];
    const tableFilters = [...prev];
    if (isEmpty(uuids)) {
      if (whereCondition) {
        tableFilters.push(whereCondition);
      }
    } else if (whereCondition) {
      tableFilters.push({
        [operator]: [
          {
            [uuidField.uid]: {
              $in: uuids,
            }
          },
          whereCondition,
        ]
      });
    } else {
      tableFilters.push({
        [uuidField.uid]: {
          $in: uuids,
        }
      });
    }
    const _filters = {
      ...(options?.filters || {}),
    }
    if (tableFilters.length > 0) {
      _filters[tableUID] = tableFilters;
    } else {
      delete _filters[tableUID];
    }
    const buckets = await this.formDataService._getData(sourceFormData, [tableUID], sourceNocodeId, {
      filters: _filters,
      orderBy: options?.orderBy || SortType.DESC,
      stage: options?.stage,
      ...(options?.limit === undefined ? {} : { limit: options.limit }),
    }, options?.fieldUIDs ? {
      fieldUIDsMap: {
        [tableUID]: Array.from(new Set([uuidField.uid, ...options.fieldUIDs])),
      },
    } : undefined);
    const rows = buckets[0]?.rows || [];
    if (options?.fillSubTable) {
      return await this.formDataService.fillSubFormField(rows, sourceNocodeId, table, sourceFormData, subWhereCondition);
    }
    return rows;
  }

  async matchScheduledTriggerConditions(options: {
    nocodeBody: NocodeBody,
    nocodeId: string,
    table: Table,
    rows: Row[],
    sourceTables: NonNullable<TimeTaskOptions["sourceTables"]>,
    conditions: NonNullable<TimeTaskOptions["conditions"]>,
    sourceFieldIds?: Record<string, string[]>,
  }): Promise<Set<string>> {
    if (isEmpty(options.conditions)) {
      return new Set(options.rows
        .map(row => String(row[SystemField.UUID] || ""))
        .filter(Boolean));
    }

    const referencedSourceUIDs = new Set<string>();
    const sourceNeedsAllRows = new Set<string>();
    const sourceNeedsSubTable = new Set<string>();
    const sourceUIDs = new Set(options.sourceTables.map(sourceTable => sourceTable.uid));
    const collectSourceReference = (keys: string[], allRows = false) => {
      const sourceUID = keys[0];
      if (!sourceUID || !sourceUIDs.has(sourceUID)) return;
      referencedSourceUIDs.add(sourceUID);
      if (allRows) sourceNeedsAllRows.add(sourceUID);
      if (keys.length > 2) sourceNeedsSubTable.add(sourceUID);
    };
    const collectConditionReferences = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(collectConditionReferences);
        return;
      }
      if (!value || typeof value !== "object") return;
      const condition = value as Record<string, unknown>;
      if (typeof condition.uid === "string") {
        collectSourceReference(condition.uid.split("."), condition.type === FormConditionValueType.FILTER_ROW);
      }
      if (typeof condition.formula === "string") {
        replaceByFormula(condition.formula, keys => {
          collectSourceReference(keys, true);
          return "";
        });
      }
      Object.entries(condition).forEach(([key, child]) => {
        if (key !== "uid" && key !== "formula") collectConditionReferences(child);
      });
    };
    collectConditionReferences(options.conditions);

    const rowConcurrency = 4;
    const matched = new Set<string>();
    const staticSourceRows = new Map<string, Promise<Row[]>>();
    const evaluateRow = async (row: Row) => {
      const sourceTableRows: Record<string, Row[]> = { [options.table.uid]: [row] };
      for (const sourceTable of options.sourceTables.filter(item => referencedSourceUIDs.has(item.uid))) {
        const fieldUIDs = options.sourceFieldIds?.[sourceTable.uid] || [];
        const needsAllRows = sourceNeedsAllRows.has(sourceTable.uid);
        const fillSubTable = sourceNeedsSubTable.has(sourceTable.uid);
        const readSourceRows = () => this.getTableRows(
          options.nocodeBody,
          options.nocodeId,
          sourceTable.tableUID,
          sourceTable.filterRule,
          row,
          {
            fillSubTable,
            fieldUIDs,
            ...(needsAllRows ? {} : { limit: 1 }),
          },
        );
        if (!this.isStaticScheduledSourceFilter(sourceTable)) {
          sourceTableRows[sourceTable.uid] = await readSourceRows();
          continue;
        }
        const cacheKey = JSON.stringify([sourceTable.uid, sourceTable.tableUID, sourceTable.filterRule, fieldUIDs, fillSubTable, needsAllRows]);
        let rowsPromise = staticSourceRows.get(cacheKey);
        if (!rowsPromise) {
          rowsPromise = readSourceRows().catch(error => {
            staticSourceRows.delete(cacheKey);
            throw error;
          });
          staticSourceRows.set(cacheKey, rowsPromise);
        }
        sourceTableRows[sourceTable.uid] = await rowsPromise;
      }
      const conditions = deepClone(options.conditions);
      return isEmpty(conditions) || isMeetConditionsByRow(row, conditions, sourceTableRows, options.table.fields)?.valid
        ? String(row[SystemField.UUID] || "")
        : "";
    };
    for (let index = 0; index < options.rows.length; index += rowConcurrency) {
      const results = await Promise.all(options.rows.slice(index, index + rowConcurrency).map(evaluateRow));
      results.forEach(recordId => {
        if (recordId) matched.add(recordId);
      });
      if (index + rowConcurrency < options.rows.length) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
    }
    matched.delete("");
    return matched;
  }

  private isStaticScheduledSourceFilter(sourceTable: NonNullable<TimeTaskOptions["sourceTables"]>[number]) {
    if (sourceTable.sourceType === "current-subform" || sourceTable.currentSubTableFieldUID) return false;
    return (sourceTable.filterRule?.conditions || []).every(condition => (
      (condition.type || FormConditionValueType.FORM) === FormConditionValueType.CUSTOM
      && condition.func !== RuleFunc.DYNAMIC
    ));
  }

  private mergeTableRows(sourceTableRows: Record<string, Row[]>, targetFields: TargetFieldFillRule[]) {
    const targetFieldsMap = targetFields.map(item => {
      return item.value?.split('.')?.[0];
    })
    const flattenRows = (rows: Row[], sourceID: string) => {
      const result = []
      for(const row of rows) {
        let _row: Row = {}
        for(const key of Object.keys(row)) {
          _row[`${sourceID}.${key}`] = row[key];
        }
        result.push(_row);
      }
      return result
    };

    const mergedRows: Row[] = [];
    const sourceUIDS = Object.keys(sourceTableRows).filter(uid => targetFieldsMap.includes(uid));

    let maxLength = 0;
    for (const sourceUID of sourceUIDS) {
      const rows = sourceTableRows[sourceUID] = flattenRows(sourceTableRows[sourceUID], sourceUID);
      maxLength = Math.max(maxLength, rows.length);
    }
    for (let i = 0; i < maxLength; i++) {
      const _row: Row = {};
      for (const sourceUID of sourceUIDS) {
        const rows = sourceTableRows[sourceUID];
        if (i < rows.length) {
          Object.assign(_row, rows[i]);
        }
      }
      mergedRows.push(_row);
    }
    return mergedRows;
  }

  private getProcessLinkageRules(formData: NocodeFormData, table: Table): FormLinkageRule[] {
    const rootTable = table.meta?.extra?.primaryTable?.at(-1) || table.uid;
    const widget = formData.formOptions?.[rootTable]?.widget;
    return filterCircularLinkageRules((widget?.options?.['fields-filling'] || []) as FormLinkageRule[]).rules;
  }

  private getProcessFieldPathByWidgetUID(formData: NocodeFormData, table: Table, widgetUID: string) {
    const directField = table.fields.find(field => field.meta?.uid === widgetUID || field.uid === widgetUID);
    if (directField) return directField.uid;
    for (const parentField of table.fields) {
      const subTableUID = parentField.meta?.extra?.subTableUID?.at(-1);
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      const subField = subTable?.fields.find(field => field.meta?.uid === widgetUID || field.uid === widgetUID);
      if (subField) return `${parentField.uid}.${subField.uid}`;
    }
    return null;
  }

  private getProcessLinkageFillValue(field: Field, linkageField: string, sourceRows: Row[]) {
    if (field.meta?.extra?.widgetType === FormWidgetType.TREE_MULTIPLE_SELECT) {
      return getLinkageFillData(linkageField, sourceRows);
    }
    if (field.meta?.extra?.widgetType === FormWidgetType.TREE_SELECT) {
      return getLinkageFillData(linkageField, sourceRows)[0] ?? null;
    }
    return sourceRows.length ? getLinkageFillValue(linkageField, sourceRows) : null;
  }

  private async applyProcessLinkageFill(
    rows: Row[],
    formData: NocodeFormData,
    nocodeId: string,
    table: Table,
    explicitFieldUIDs: Set<string>,
  ) {
    const rules = this.getProcessLinkageRules(formData, table);
    const changedFieldUIDs = new Set<string>();
    if (!rules.length || !rows.length) return changedFieldUIDs;
    const targetBody = await this.getFlowNocodeBody(nocodeId, formData);
    const rootTableUID = table.meta?.extra?.primaryTable?.at(-1) || table.uid;
    const rootTable = formData.tables.find(item => item.uid === rootTableUID) || table;
    const parentField = rootTable.fields.find(field => field.meta?.extra?.subTableUID?.at(-1) === table.uid);
    const childKeyField = table === rootTable
      ? undefined
      : table.fields.find(field => field.meta?.name === SystemField.KEY);
    const rootRowsByUUID = new Map<string, Row>();
    if (table !== rootTable) {
      const rootUUIDField = getUUIDSystemField(rootTable.fields);
      const rootUUIDs = [...new Set(rows
        .map(row => row[childKeyField?.uid || ""])
        .filter(value => !isEmpty(value))
        .map(value => String(value)))];
      if (childKeyField && rootUUIDField && rootUUIDs.length) {
        const rootRows = await this.getTableRows(
          targetBody,
          nocodeId,
          rootTable.uid,
          { logic: LogicalOperator.AND, conditions: [] },
          {},
          {
            filters: {
              [rootTable.uid]: [{
                [rootUUIDField.uid]: { $in: rootUUIDs },
              }],
            },
            fillSubTable: true,
          },
        );
        for (const rootRow of rootRows) {
          const uuid = rootRow[rootUUIDField.uid];
          if (!isEmpty(uuid)) rootRowsByUUID.set(String(uuid), rootRow);
        }
      }
    }
    for (let round = 0; round < rules.length; round++) {
      let changed = false;
      for (const rule of rules) {
        const linkageTableUID = rule.linkageTable?.[1];
        const hasEffectiveConditions = rule.conditions?.some(condition => !(
          isEmpty(condition?.uid)
          && isEmpty(condition?.func)
          && isEmpty(condition?.value)
          && isEmpty(condition?.formula)
        ));
        if (!linkageTableUID || !hasEffectiveConditions) continue;
        for (const row of rows) {
          const rootRow = table === rootTable
            ? row
            : rootRowsByUUID.get(String(row[childKeyField?.uid || ""])) || row;
          const conditionRow = table === rootTable ? row : { ...rootRow, ...row };
          const formulaFields = table === rootTable
            ? table.fields
            : [...rootTable.fields, ...table.fields];
          const resolveConditions = async (conditions: FormLinkageCondition[] = []) => await Promise.all(conditions.map(async condition => {
            const nextCondition = deepClone(condition);
            if ((nextCondition.type || FormConditionValueType.FORM) !== FormConditionValueType.FORM) {
              return nextCondition;
            }
            if (nextCondition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
              const comparisonUID = nextCondition.comparisonUid || nextCondition.value;
              nextCondition.type = FormConditionValueType.CUSTOM;
              nextCondition.value = await this.resolveProcessDefaultRelatedComparisonValues(
                targetBody,
                nocodeId,
                rootTable,
                rootRow,
                comparisonUID,
              );
              return nextCondition;
            }
            const fieldPath = this.getProcessFieldPathByWidgetUID(formData, rootTable, nextCondition.value);
            nextCondition.value = table === rootTable || !parentField || !fieldPath?.startsWith(`${parentField.uid}.`)
              ? fieldPath
              : fieldPath.slice(parentField.uid.length + 1);
            return nextCondition;
          }));
          const conditions = await resolveConditions(rule.conditions);
          const sourceData = getNocodeDataSourceTableByUID(targetBody, linkageTableUID, {
            nocodeId,
            includeSchemaSources: true,
          }, true);
          const sourceTable = sourceData?.table;
          if (!sourceTable) continue;
          const filters: Record<string, WhereCondition[]> = {};
          if (sourceTable?.meta?.extra?.primaryTable && rule.subTableSetting?.conditions?.length) {
            const sourceFormData = sourceData.connection as NocodeFormData;
            const sourceNocodeId = sourceData.connection?.nocodeId || nocodeId;
            const primaryTableUID = sourceTable.meta.extra.primaryTable.at(-1);
            const primaryTable = sourceFormData.tables.find(item => item.uid === primaryTableUID);
            const primaryRows = await this.getTableRows(
              targetBody,
              sourceNocodeId,
              primaryTableUID,
              {
                logic: rule.subTableSetting.logic,
                conditions: await resolveConditions(rule.subTableSetting.conditions),
              },
              conditionRow,
              { formulaRuntime: createFormulaRuntimeByData(conditionRow, formulaFields) },
            );
            const primaryUUIDField = getUUIDSystemField(primaryTable?.fields || []);
            const sourceKeyField = sourceTable.fields.find(field => field.meta?.name === SystemField.KEY);
            if (sourceKeyField && primaryUUIDField) {
              filters[sourceTable.uid] = [{
                [sourceKeyField.uid]: {
                  $in: primaryRows.map(primaryRow => primaryRow[primaryUUIDField.uid]),
                },
              }];
            }
          }
          const sourceRows = await this.getTableRows(
            targetBody,
            nocodeId,
            linkageTableUID,
            { logic: rule.logic, conditions },
            conditionRow,
            {
              fillSubTable: true,
              filters,
              formulaRuntime: createFormulaRuntimeByData(conditionRow, formulaFields),
            },
          );
          for (const fillRule of rule.fillWidgets || []) {
            if (fillRule.linkageSubFields?.length) {
              const targetParentField = rootTable.fields.find(field => field.meta?.uid === fillRule.fillWidget || field.uid === fillRule.fillWidget);
              if (!targetParentField || (parentField && targetParentField.uid !== parentField.uid)) continue;
              const targetSubTable = formData.tables.find(item => item.uid === targetParentField.meta?.extra?.subTableUID?.at(-1));
              const targetSubRows = table === rootTable
                ? (Array.isArray(row[targetParentField.uid]) ? row[targetParentField.uid] : [])
                : [row];
              for (const subRule of fillRule.linkageSubFields) {
                const targetSubField = targetSubTable?.fields.find(field => field.meta?.uid === subRule.fillWidget || field.uid === subRule.fillWidget);
                if (!targetSubField) continue;
                const targetFieldPath = `${targetParentField.uid}.${targetSubField.uid}`;
                if (explicitFieldUIDs.has(targetFieldPath) || explicitFieldUIDs.has(targetSubField.uid)) continue;
                const value = this.getProcessLinkageFillValue(targetSubField, subRule.linkageField, sourceRows);
                for (const targetSubRow of targetSubRows) {
                  if (equals(targetSubRow[targetSubField.uid], value)) continue;
                  targetSubRow[targetSubField.uid] = deepClone(value);
                  changedFieldUIDs.add(table === rootTable ? targetFieldPath : targetSubField.uid);
                  changed = true;
                }
              }
              continue;
            }
            if (table !== rootTable || !fillRule.linkageField) continue;
            const targetField = table.fields.find(field => field.meta?.uid === fillRule.fillWidget || field.uid === fillRule.fillWidget);
            if (!targetField || explicitFieldUIDs.has(targetField.uid)) continue;
            const value = this.getProcessLinkageFillValue(targetField, fillRule.linkageField, sourceRows);
            if (!equals(row[targetField.uid], value)) {
              row[targetField.uid] = deepClone(value);
              changedFieldUIDs.add(targetField.uid);
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }
    return changedFieldUIDs;
  }

  private async calculateProcessDefaultQuickComputeValue(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
    targetNocodeId: string,
    targetField: Field,
    row: Row,
    rootRow: Row,
    targetTable: Table,
    runtimeFields: Field[],
    queryCache?: Map<string, ReturnType<FormDataService["autoComputeDistinct"]>>,
    relatedValueQueryCache?: Map<string, Promise<unknown[]>>,
  ) {
    const extra = targetField.meta?.extra || {};
    const [connectionUID, tableUID, fieldUID] = extra.otherTableFieldUID || [];
    if (!connectionUID || !tableUID || !fieldUID) {
      return null;
    }

    try {
      const source = getNocodeDataSourceByUID(nocodeBody, connectionUID, {
        nocodeId: targetNocodeId,
        includeSchemaSources: true,
      });
      const sourceNocodeId = source?.nocodeId || targetNocodeId;
      const filters: Record<string, WhereCondition[]> = {};
      if (!isEmpty(extra.dataFilter?.conditions)) {
        const filterRow = resolveProcessDefaultQuickComputeFilterRow(String(targetField.uid), row, rootRow);
        const dataFilter = deepClone(extra.dataFilter) as FilterRule;
        await Promise.all(dataFilter.conditions.map(async (condition) => {
          const linkageCondition = condition as FormLinkageCondition;
          const conditionType = linkageCondition.type || FormConditionValueType.FORM;
          if (
            conditionType !== FormConditionValueType.FORM
            || linkageCondition.comparisonOfForm !== SelectIdOfForm.LINKAGE
          ) {
            return;
          }
          const comparisonUID = linkageCondition.comparisonUid
            || (typeof linkageCondition.value === "string" ? linkageCondition.value : "");
          if (!comparisonUID) {
            return;
          }
          const relatedValues = await this.resolveProcessDefaultRelatedComparisonValues(
            nocodeBody,
            targetNocodeId,
            targetTable,
            rootRow,
            comparisonUID,
            relatedValueQueryCache,
          );
          linkageCondition.type = FormConditionValueType.CUSTOM;
          if (relatedValues.length > 0) {
            linkageCondition.value = relatedValues;
          }
        }));
        filters[tableUID] = [transformFilterRule(
          dataFilter,
          filterRow,
          { formulaRuntime: createFormulaRuntimeByData(filterRow, runtimeFields) },
        )];
      }
      const queryCacheKey = JSON.stringify([sourceNocodeId, tableUID, fieldUID, filters]);
      let valuesPromise = queryCache?.get(queryCacheKey);
      if (valuesPromise && queryCache) {
        queryCache.delete(queryCacheKey);
        queryCache.set(queryCacheKey, valuesPromise);
      }
      if (!valuesPromise) {
        valuesPromise = this.formDataService.autoComputeDistinct(
          sourceNocodeId,
          tableUID,
          fieldUID,
          { filters },
        );
        if (queryCache) {
          if (queryCache.size >= PROCESS_DEFAULT_QUICK_COMPUTE_CACHE_LIMIT) {
            const oldestQueryCacheKey = queryCache.keys().next().value;
            if (oldestQueryCacheKey !== undefined) {
              queryCache.delete(oldestQueryCacheKey);
            }
          }
          queryCache.set(queryCacheKey, valuesPromise);
        }
      }
      const values = await valuesPromise;
      return calculateProcessDistinctAggregation(
        values,
        extra.aggregateType as AggregationType,
        extra.decimalPlaces,
      );
    } catch (err) {
      this.logger.error(`process default quick compute error:`, err);
      throw err;
    }
  }

  private async resolveProcessDefaultRelatedComparisonValues(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources" | "otherDataSourceSchemas">,
    targetNocodeId: string,
    targetTable: Table,
    rootRow: Row,
    comparisonUID: string,
    queryCache?: Map<string, Promise<unknown[]>>,
  ) {
    const relatedFields = targetTable.fields.flatMap((field) => {
      const extra = field.meta?.extra;
      if (extra?.widgetType !== FormWidgetType.RELATED_DATA) {
        return [];
      }
      const [connectionUID, tableUID] = extra.relatedTableUID || [];
      const source = getNocodeDataSourceByUID(nocodeBody, connectionUID, {
        nocodeId: targetNocodeId,
        includeSchemaSources: true,
      });
      const table = source?.tables?.find(item => item.uid === tableUID);
      if (!source || !table?.fields.some(item => item.uid === comparisonUID)) {
        return [];
      }
      const uuidField = getUUIDSystemField(table.fields);
      if (!uuidField?.uid) {
        return [];
      }
      const rawValues = Array.isArray(rootRow[field.uid]) ? rootRow[field.uid] : [rootRow[field.uid]];
      const relatedUUIDs = rawValues.map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          return String(item);
        }
        if (!item || typeof item !== "object") {
          return "";
        }
        const uuid = (item as Row)[uuidField.uid];
        return typeof uuid === "string" || typeof uuid === "number" ? String(uuid) : "";
      }).filter(Boolean);
      if (!relatedUUIDs.length) {
        return [];
      }
      return [{
        source: source as NocodeFormData,
        sourceNocodeId: source.nocodeId || targetNocodeId,
        tableUID,
        uuidFieldUID: uuidField.uid,
        relatedUUIDs,
      }];
    });

    const values = await Promise.all(relatedFields.map(async (item) => {
      const cacheKey = JSON.stringify([
        item.sourceNocodeId,
        item.tableUID,
        item.uuidFieldUID,
        item.relatedUUIDs,
        comparisonUID,
      ]);
      let valuesPromise = queryCache?.get(cacheKey);
      if (valuesPromise && queryCache) {
        queryCache.delete(cacheKey);
        queryCache.set(cacheKey, valuesPromise);
      }
      if (!valuesPromise) {
        valuesPromise = this.formDataService._getData(
          item.source,
          [item.tableUID],
          item.sourceNocodeId,
          {
            filters: {
              [item.tableUID]: [{
                [item.uuidFieldUID]: {
                  $in: item.relatedUUIDs,
                },
              }],
            },
          },
        ).then((buckets) => {
          return (buckets[0]?.rows || []).flatMap((relatedRow) => {
            const value = relatedRow[comparisonUID];
            return Array.isArray(value) ? value.flat(Infinity) : [value];
          }).filter(Boolean);
        });
        if (queryCache) {
          if (queryCache.size >= PROCESS_DEFAULT_QUICK_COMPUTE_CACHE_LIMIT) {
            const oldestQueryCacheKey = queryCache.keys().next().value;
            if (oldestQueryCacheKey !== undefined) {
              queryCache.delete(oldestQueryCacheKey);
            }
          }
          queryCache.set(cacheKey, valuesPromise);
        }
      }
      return await valuesPromise;
    }));
    return [...new Set(values.flat(Infinity))];
  }

  private async applyProcessDesignDefaults(options: {
    rows: Row[],
    fieldUIDs: string[],
    targetNocodeId: string,
    targetFormData: NocodeFormData,
    targetTable: Table,
    initiatorId?: string,
    createMissingSubRows?: boolean,
    clearUnconfiguredFields?: boolean,
    subRowIndexesByRow?: Array<Record<string, number[]>>,
  }) {
    const needsInitiatorDepartments = options.fieldUIDs.some((fieldUID) => {
      const targetField = resolveProcessTargetField(fieldUID, options.targetTable, options.targetFormData);
      const extra = targetField?.meta?.extra;
      return extra?.widgetType === FormWidgetType.DEPARTMENT_SELECT
        && Array.isArray(extra.defaultValueDynamic)
        && extra.defaultValueDynamic.includes(Dynamic.CURRENT_DEPARTMENT);
    });
    const initiatorUser = options.initiatorId && needsInitiatorDepartments
      ? await this.workbenchService.getUserById(options.initiatorId).catch(() => null)
      : null;
    let targetNocodeBodyPromise: Promise<NocodeBody> | null = null;
    const quickComputeQueryCache = new Map<string, ReturnType<FormDataService["autoComputeDistinct"]>>();
    const relatedValueQueryCache = new Map<string, Promise<unknown[]>>();
    try {
      return await applyProcessFieldDefaults({
        rows: options.rows,
        fieldUIDs: options.fieldUIDs,
        targetTable: options.targetTable,
        formData: options.targetFormData,
        initiator: options.initiatorId ? {
          id: options.initiatorId,
          departments: initiatorUser?.departments || [],
        } : null,
        createMissingSubRows: options.createMissingSubRows,
        clearUnconfiguredFields: options.clearUnconfiguredFields,
        subRowIndexesByRow: options.subRowIndexesByRow,
        calculateQuickCompute: async (targetField, row, rootRow) => {
          targetNocodeBodyPromise ||= this.getFlowNocodeBody(options.targetNocodeId, options.targetFormData);
          const targetNocodeBody = await targetNocodeBodyPromise;
          const [parentFieldUID, subFieldUID] = String(targetField.uid).split('.');
          const parentField = options.targetTable.fields.find(field => field.uid === parentFieldUID);
          const subTableUID = parentField?.meta?.extra?.subTableUID?.at(-1);
          const subTable = subFieldUID
            ? options.targetFormData.tables.find(table => table.uid === subTableUID)
            : null;
          return await this.calculateProcessDefaultQuickComputeValue(
            targetNocodeBody,
            options.targetNocodeId,
            targetField,
            row,
            rootRow,
            options.targetTable,
            subFieldUID
              ? [...options.targetTable.fields, ...(subTable?.fields || [])]
              : options.targetTable.fields,
            quickComputeQueryCache,
            relatedValueQueryCache,
          );
        },
      });
    } catch (err) {
      if (err instanceof ProcessDefaultDependencyCycleError) {
        const fields = err.fieldUIDs.map((fieldUID) => {
          return resolveProcessTargetField(fieldUID, options.targetTable, options.targetFormData)?.alias || fieldUID;
        }).join(', ');
        throw new Error(global.i18next.t('formFlowService.defaultValueDependencyCycle', { fields }));
      }
      throw err;
    }
  }

  private async shouldSkipCurrentTableReTrigger(
    options: BaseTodoOptions,
    targetNocodeId?: string,
    targetTableUID?: TableUID,
  ) {
    if (!options.todoId || !targetNocodeId || !targetTableUID) {
      return false;
    }

    if (targetNocodeId !== options.nocodeId || targetTableUID !== options.tableId) {
      return false;
    }

    const startRecord = await this.getStartRecord(options);
    const source = Object.values(startRecord?.metas || {}).find(meta => meta.source)?.source;
    return [TODOTriggerType.ADD, TODOTriggerType.EDIT, TODOTriggerType.DELETE].includes(source as TODOTriggerType);
  }

  private shouldTriggerTargetProcess(
    node: ProcessFlow,
    options: BaseTodoOptions,
    resolvedTarget: ResolvedProcessTargetTable,
  ) {
    const isCurrentFormTarget = this.isCurrentProcessFormTarget(options, resolvedTarget.targetFormData, resolvedTarget);
    return node.options?.triggerTargetProcess ?? !isCurrentFormTarget;
  }

  private async createPrimaryTableFormulaRollbackAction(
    formData: NocodeFormData,
    nocodeId: string,
    currentRow: Row,
    currentTable: Table,
    primarySourceTable?: { tableUID?: TableUID; filterRule?: FilterRule } | null,
  ) {
    if (!primarySourceTable?.tableUID) {
      return null;
    }

    const primaryTable = formData.tables.find(t => t.uid === primarySourceTable.tableUID);
    if (!primaryTable) {
      return null;
    }

    const formulaFields = this.getPrimaryTableFormulaFields(primaryTable);
    if (isEmpty(formulaFields)) {
      return null;
    }

    const nocodeBody = await this.getFlowNocodeBody(nocodeId, formData);
    const rows = await this.getTableRows(nocodeBody, nocodeId, primarySourceTable.tableUID, primarySourceTable.filterRule, currentRow, {
      fillSubTable: true,
      formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields),
    });
    if (isEmpty(rows)) {
      return null;
    }

    const uuidField = getUUIDSystemField(primaryTable.fields);
    const rollbackRows = rows.map(row => {
      const rollbackRow: Row = {
        [uuidField.uid]: row[uuidField.uid],
      };
      for (const field of formulaFields) {
        rollbackRow[field.uid] = deepClone(row[field.uid]);
      }
      return rollbackRow;
    });
    const key: OptionFieldUID = [formData.uid, primaryTable.uid, uuidField.uid];

    return async () => {
      await this.formDataService.updateData(
        formData,
        nocodeId,
        primaryTable.uid,
        deepClone(rollbackRows),
        [key],
        null,
        "main",
        {
          validateCurrentTable: true,
        },
      );
    };
  }

  /*
  private async refreshPrimaryTableFormulaRowsWithRollback(
    formData: NocodeFormData,
    nocodeId: string,
    currentRow: Row,
    currentTable: Table,
    primarySourceTable: { tableUID?: TableUID; filterRule?: FilterRule } | null | undefined,
    rollbackAction: () => Promise<void>,
  ) {
    const rollbackPrimaryFormula = await this.createPrimaryTableFormulaRollbackAction(
      formData,
      nocodeId,
      currentRow,
      currentTable,
      primarySourceTable,
    );

    try {
      await this.refreshPrimaryTableFormulaRows(formData, nocodeId, currentRow, currentTable, primarySourceTable);
    } catch (err) {
      const rollbackErrors: string[] = [];

      try {
        await rollbackAction();
      } catch (rollbackErr) {
        this.logger.error(`rollback sub table data after primary formula refresh error failed`, rollbackErr);
        rollbackErrors.push(`${global.i18next.t('formFlowService.subTableRollbackFailPrefix')}${this.getFlowErrorMessage(rollbackErr)}`);
      }

      if (rollbackPrimaryFormula) {
        try {
          await rollbackPrimaryFormula();
        } catch (rollbackErr) {
          this.logger.error(`restore primary table formula after refresh error failed`, rollbackErr);
          rollbackErrors.push(`${global.i18next.t('formFlowService.primaryFormulaRollbackFailPrefix')}${this.getFlowErrorMessage(rollbackErr)}`);
        }
      }

      if (!isEmpty(rollbackErrors)) {
        throw new Error(`${this.getFlowErrorMessage(err)}；${rollbackErrors.join("；")}`);
      }
      throw err;
    }
  }
  */

  private async executeSubTableMutationWithPrimaryFormulaRollback<T = void>(
    formData: NocodeFormData,
    nocodeId: string,
    currentRow: Row,
    currentTable: Table,
    primarySourceTable: { tableUID?: TableUID; filterRule?: FilterRule } | null | undefined,
    executeAction: () => Promise<T>,
    rollbackAction: () => Promise<void>,
    options: {
      isMutationCommitted?: (result?: T) => boolean;
    } = {},
  ) {
    const rollbackPrimaryFormula = await this.createPrimaryTableFormulaRollbackAction(
      formData,
      nocodeId,
      currentRow,
      currentTable,
      primarySourceTable,
    );

    let mutationCommitted = false;
    try {
      const result = await executeAction();
      mutationCommitted = options.isMutationCommitted?.(result) ?? true;
      if (!mutationCommitted) {
        return;
      }
      await this.refreshPrimaryTableFormulaRows(formData, nocodeId, currentRow, currentTable, primarySourceTable);
    } catch (err) {
      if (!mutationCommitted) {
        mutationCommitted = (err as Error & { mutationCommitted?: boolean })?.mutationCommitted === true
          || !!options.isMutationCommitted?.();
      }
      if (!mutationCommitted) {
        throw err;
      }

      const rollbackErrors: string[] = [];

      try {
        await rollbackAction();
      } catch (rollbackErr) {
        this.logger.error(`rollback sub table data after primary formula refresh error failed`, rollbackErr);
        rollbackErrors.push(`sub table rollback failed: ${this.getFlowErrorMessage(rollbackErr)}`);
      }

      if (rollbackPrimaryFormula) {
        try {
          await rollbackPrimaryFormula();
        } catch (rollbackErr) {
          this.logger.error(`restore primary table formula after refresh error failed`, rollbackErr);
          rollbackErrors.push(`primary table formula rollback failed: ${this.getFlowErrorMessage(rollbackErr)}`);
        }
      }

      if (!isEmpty(rollbackErrors)) {
        throw new Error(`${this.getFlowErrorMessage(err)}; ${rollbackErrors.join("; ")}`);
      }
      throw err;
    }
  }

  private async startAddDataNode(
    options: BaseTodoOptions,
    node: ProcessFlow,
    initiatorId?: string,
    compensationContext?: FlowCompensationContext,
  ): Promise<DataProcessingNodeStartResult> {
    const {
      targetTableUID,
      sourceTables = [],
      primarySourceTable,
      targetFields = [],
      batchEnabled,
      batchFields = [],
      batchNumber,
    } = node.options || {};
    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const formData = nocodeBody.formData;
    const currentTable = formData.tables.find(t => t.uid === options.tableId);
    const resolvedTarget = this.resolveProcessTargetTable(options.nocodeId, nocodeBody, targetTableUID);
    const { targetNocodeId, targetFormData, targetTable } = resolvedTarget;
    const shouldTriggerTargetProcess = this.shouldTriggerTargetProcess(node, options, resolvedTarget);
    const isSubTable = targetTable?.meta?.extra?.primaryTable && primarySourceTable;
    const nodeImportTaskId = options.importTaskId;
    const primaryTable = formData.tables.find(t => t.uid === primarySourceTable?.tableUID);
    if (!currentTable) {
      return {
        messages: [],
      };
    }
    await this.assertCrossAppWritePermission(nocodeBody, resolvedTarget, DataChangeType.ADD);
    const uuidField = getUUIDSystemField(currentTable.fields);
    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options, {
      formData,
      currentTable,
    });
    if (!currentRowContext?.currentRow) {
      return {
        messages: [],
      };
    }
    const { currentRows, currentRow, hasPhysicalRow } = currentRowContext;
    this.ensureEmptyRowAutoRelatedSupported(node, hasPhysicalRow);
    const sourceTableRows: Record<string, Row[]> = {
      [options.tableId]: currentRows,
    };
    const targetSourceUID = getProcessTargetSourceUID(targetTableUID, options.tableId);
    if (targetSourceUID !== targetTableUID) {
      sourceTableRows[targetSourceUID] = currentRows;
    }

    await Promise.all(sourceTables.map(async (item) => {
      const filterRule = item.filterRule;
      sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, options.nocodeId, item.tableUID, filterRule, currentRow, {
        fillSubTable: true,
        formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields),
      });
    }));

    if (isSubTable) {
      if (!primaryTable) {
        return {
          messages: [],
        };
      }
      sourceTableRows[primarySourceTable.uid] = await this.getTableRows(nocodeBody, options.nocodeId, primarySourceTable.tableUID, primarySourceTable.filterRule, currentRow, {
        fillSubTable: true,
        formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields),
      });
      const keyField = targetTable.fields.find(f => f.meta.name === SystemField.KEY);
      if (!keyField) {
        return {
          messages: [],
        };
      }
      const uuidField = getUUIDSystemField(primaryTable.fields);
      targetFields.push({
        fieldUID: keyField.uid,
        type: TargetFieldFillType.FIELD,
        value: `${primarySourceTable.uid}.${uuidField.uid}`,
      })
    }
    const formulaSourceTables: Record<string, Table> = {};
    for (const table of [...formData.tables, ...(targetFormData?.tables || [])]) {
      formulaSourceTables[table.uid] = table;
    }
    formulaSourceTables[options.tableId] = currentTable;
    if (targetTable) {
      formulaSourceTables[targetSourceUID] = targetTable;
    }
    for (const sourceTable of sourceTables) {
      const sourceData = getNocodeDataSourceTableByUID(nocodeBody, sourceTable.tableUID, {
        nocodeId: options.nocodeId,
        includeSchemaSources: true,
      }, true);
      if (sourceData?.table) {
        formulaSourceTables[sourceTable.uid] = sourceData.table;
      }
    }
    if (primarySourceTable) {
      const sourceData = getNocodeDataSourceTableByUID(nocodeBody, primarySourceTable.tableUID, {
        nocodeId: options.nocodeId,
        includeSchemaSources: true,
      }, true);
      if (sourceData?.table) {
        formulaSourceTables[primarySourceTable.uid] = sourceData.table;
      }
    }
    const mergedRows = this.mergeTableRows(deepClone(sourceTableRows), targetFields.filter(item => item.type === TargetFieldFillType.FIELD));
    const dataContext = await this.flowExecutionContextRepository.findOne({ todoId: options.todoId });
    const rows = [];

    for (let i = 0; i < Math.max(1, mergedRows.length); i++) {
      const mergedRow = mergedRows[i];
      const row = {};
      const otherRows = []
      const modelSubFields = {}

      for (const item of targetFields) {
        const isSubField = item.fieldUID?.split(".")?.length > 1;
        if (!isSubField) {
          row[item.fieldUID] = null;
        }
        if (item.type === TargetFieldFillType.CUSTOM) {
          const normalizedValue = this.normalizeCustomTargetFieldValue(item.fieldUID, item.value, targetTable);
          if(isSubField) {
            if(!row[item.fieldUID.split(".")[0]]?.length) {
              row[item.fieldUID.split(".")[0]] = [{}];
            }
            for(const f of row[item.fieldUID.split(".")[0]]) {
              f[item.fieldUID.split(".")[1]] = normalizedValue;
            }
          } else {
            row[item.fieldUID] = normalizedValue;
            for(const otherRow of otherRows) {
              otherRow[item.fieldUID] = normalizedValue;
            }
          }
        } else if (item.type === TargetFieldFillType.FIELD) {
          const keyArr = item.fieldUID?.split(".");
          const arr = item.value?.split(".");

          if (this.isDataOwnerTargetField(item.fieldUID, targetTable) && typeof item.value === "string" && !item.value.includes(".")) {
            row[item.fieldUID] = this.getDataOwnerFieldMappedValue(currentRow, item.value, initiatorId);
            continue;
          }
          if (isEmpty(arr)) continue;

          const fieldId = keyArr[0];
          const subFieldId = keyArr[1];

          const sourceUID = arr[0];
          const sourceFieldUID = arr[1];
          const sourceSubFieldUID = arr[2];

          const isFillSubTable = keyArr.length > 1; // 是否填充子表
          const isSubTable = arr.length > 2; // 填充源是否是子表
          
          const fieldValue = mergedRow?.[`${sourceUID}.${sourceFieldUID}`]
            ?? ((sourceUID === options.tableId || sourceTableRows[sourceUID] === currentRows) ? currentRow?.[sourceFieldUID] : undefined);
          if (isEmpty(fieldValue)) continue;

          if(isFillSubTable) { // 子表被填�?
            row[fieldId] = row[fieldId] || [];
            if(!modelSubFields[fieldId]) {
              modelSubFields[fieldId] = {};
            }
            const modelSubField = modelSubFields[fieldId];
            if (isSubTable) { // 子表填子�?
              for(let j = 0; j < fieldValue.length; j++) {
                if(j >= row[fieldId].length) {
                  row[fieldId].push(deepClone(modelSubField));
                } else if (j === 0 && this.shouldReusePlaceholderSubRow(row[fieldId])) {
                  row[fieldId][j] = deepClone(modelSubField);
                }
                row[fieldId][j][subFieldId] = fieldValue[j][sourceSubFieldUID];
              }
            } else { // 主表填子�?
              if(row[fieldId].length < 1) {
                row[fieldId].push(deepClone(modelSubField));
              }
              for(let j = 0; j < row[fieldId].length; j++) {
                row[fieldId][j][subFieldId] = fieldValue;
              }
              modelSubField[subFieldId] = fieldValue;
            }
            for(const item of otherRows) {
              item[fieldId] = deepClone(row[fieldId]);
            }
          } else { // 主表被填�?
            if(isSubTable) { // 子表填主�?
              for(let j = 0; j < fieldValue.length; j++) {
                if(j >= otherRows.length) {
                  otherRows.push(deepClone(row));
                }
                otherRows[j][fieldId] = fieldValue[j][sourceSubFieldUID];
              }
            } else { // 主表填主�?
              row[fieldId] = fieldValue;
              for(const item of otherRows) {
                item[fieldId] = fieldValue;
              }
            }
          }
        } else if (item.type === TargetFieldFillType.FORMULA) {
          const arr = item.fieldUID?.split(".")
          const fieldId = arr[0];
          const subFieldId = arr[1];
          const emptyCheckReferenceKeys = getFormulaEmptyCheckReferenceKeys(item.value);
          let subformLength = 0
          let colFormula = replaceColFieldsByFormula(item.value, (keys) => {
            const [sourceUID, fieldId, subFieldId] = keys;
            const rows = sourceTableRows[sourceUID];
            const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
            const fieldValue = rows?.map(row => row[fieldId]);
            if (isEmpty(fieldValue)) return null;
            if (subFieldId) {
              return fieldValue.flatMap(rows => rows.map(item => normalizeFormulaNumericValue(item[subFieldId], shouldNormalizeFormulaValues)));
            } else {
              return fieldValue.map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
            }
          })
          let formula = replaceByFormula(colFormula, (keys) => {
            const [sourceUID, fieldId, subFieldId] = keys;
            const rows = sourceTableRows[sourceUID];
            const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
            if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
            let fieldValue = rows[0]?.[fieldId];
            if (subFieldId) {
              fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
              subformLength = Math.max(fieldValue.length, subformLength);
              return normalizeFormulaNumericValue(fieldValue[i]?.[subFieldId], shouldNormalizeFormulaValues);
            } else {
              fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
              return fieldValue;
            }
          });
          if (subFieldId) { // 子表单字�?
            if (!row[fieldId]) row[fieldId] = [];
            if(!modelSubFields[fieldId]) {
              modelSubFields[fieldId] = {}
            }
            const modelSubField = modelSubFields[fieldId];

            try {
              const field = targetTable.fields.find(f => f.uid === fieldId);
              const subTable = targetFormData.tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);

              if(subformLength) {
                for(let j = 0; j < row[fieldId].length && j < subformLength; j++) {
                  formula = replaceByFormula(colFormula, (keys) => {
                    const [sourceUID, fieldId, subFieldId] = keys;
                    const rows = sourceTableRows[sourceUID];
                    const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                      && !emptyCheckReferenceKeys.has(keys.join(','));
                    if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                    let fieldValue = rows[i]?.[fieldId];
                    if (subFieldId) {
                      fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                      subformLength = Math.max(fieldValue.length, subformLength);
                      return normalizeFormulaNumericValue(fieldValue[j]?.[subFieldId], shouldNormalizeFormulaValues);
                    } else {
                      fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                      return fieldValue;
                    }
                  });

                  const formulaRuntime = createFormulaRuntimeByData(row[fieldId][j], subTable.fields);
                  row[fieldId][j][subFieldId] = formulaRuntime.evaluate(formula);
                }
              } else {
                if(row[fieldId].length < 1) {
                  row[fieldId].push(deepClone(modelSubField));
                }
                for(let j = 0; j < row[fieldId].length; j++) {
                  formula = replaceByFormula(colFormula, (keys) => {
                    const [sourceUID, fieldId, subFieldId] = keys;
                    const rows = sourceTableRows[sourceUID];
                    const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                      && !emptyCheckReferenceKeys.has(keys.join(','));
                    if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                    let fieldValue = rows[i]?.[fieldId];
                    if (subFieldId) {
                      fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                      subformLength = Math.max(fieldValue.length, subformLength);
                      return normalizeFormulaNumericValue(fieldValue[j]?.[subFieldId], shouldNormalizeFormulaValues);
                    } else {
                      fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                      return fieldValue;
                    }
                  });

                  const formulaRuntime = createFormulaRuntimeByData(row[fieldId][j], subTable.fields);
                  row[fieldId][j][subFieldId] = formulaRuntime.evaluate(formula);
                }
                for(const item of otherRows) {
                  item[fieldId] = deepClone(row[fieldId]);
                }
              }
            } catch (err) {
              this.logger.error(`add data evaluate formula error:`, err);
            }
          } else {
            try {
              if(subformLength) {
                for(let j = 0; j < subformLength; j++) {
                  if(j >= otherRows.length) {
                    otherRows.push(deepClone(row));
                  }
                  formula = replaceByFormula(colFormula, (keys) => {
                    const [sourceUID, fieldId, subFieldId] = keys;
                    const rows = sourceTableRows[sourceUID];
                    const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                      && !emptyCheckReferenceKeys.has(keys.join(','));
                    if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                    let fieldValue = rows[i]?.[fieldId];
                    if (subFieldId) {
                      fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                      return normalizeFormulaNumericValue(fieldValue[j]?.[subFieldId], shouldNormalizeFormulaValues);
                    } else {
                      fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                      return fieldValue;
                    }
                  });
                  const formulaRuntime = createFormulaRuntimeByData(otherRows[j], currentTable.fields);
                  otherRows[j][fieldId] = formulaRuntime.evaluate(formula);
                }
              } else {
                const formulaRuntime = createFormulaRuntimeByData(mergedRow || currentRow, currentTable.fields);
                row[fieldId] = formulaRuntime.evaluate(formula);
                for(const item of otherRows) {
                  const formulaRuntime = createFormulaRuntimeByData(item, currentTable.fields);
                  item[fieldId] = formulaRuntime.evaluate(formula);
                }
              }
            } catch (err) {
              this.logger.error(`add data evaluate formula error:`, err);
            }
          }
        } else if (item.type === TargetFieldFillType.EMPTY) {
          if (isSubField) {
            const [fieldId, subFieldId] = item.fieldUID.split(".");
            if (!row[fieldId]?.length) {
              row[fieldId] = [{}];
            }
            for (const subRow of row[fieldId]) {
              subRow[subFieldId] = null;
            }
            for (const otherRow of otherRows) {
              otherRow[fieldId] = deepClone(row[fieldId]);
            }
          } else {
            row[item.fieldUID] = null;
          }
        } else if (item.type === TargetFieldFillType.AUTO_RELATED) {
          const value = [currentRow[uuidField.uid]];
          if(isSubField) {
            if(!row[item.fieldUID.split(".")[0]]?.length) {
              row[item.fieldUID.split(".")[0]] = [{}];
            }
            for(const f of row[item.fieldUID.split(".")[0]]) {
              f[item.fieldUID.split(".")[1]] = value;
            }
          } else {
            row[item.fieldUID] = value;
          }
        }
      }
      if (!isEmpty(otherRows) && !isEmpty(row)) {
        for (const otherRow of otherRows) {
          rows.push({
            ...deepClone(row),
            ...otherRow,
          })
        }
      } else if (!isEmpty(otherRows)) {
        rows.push(...otherRows);
      } else {
        rows.push(row);
      }
    }
    const batchRowsStartIndex = rows.length;
    const generatedBatchRows = [];
    if(batchEnabled) {
      let count
      if(batchNumber.type === TargetFieldFillType.FIELD) {
        const arr = (batchNumber.value as string)?.split(".");
        if (arr.length === 1) {
          count = Number(currentRow[batchNumber.value] || 0);
        } else {
          const sourceUID = arr[0];
          const sourceFieldUID = arr[1];
          const isSubTable = arr.length > 2;
          const rows = sourceTableRows[sourceUID];
          const fieldValue = rows?.[0]?.[sourceFieldUID];
          if (isSubTable) {
            const subFieldUID = arr[2];
            count = fieldValue?.[0]?.[subFieldUID] || 0;
          } else {
            count = fieldValue || 0;
          }
        }
      } else {
        count = Number(batchNumber.value);
      }
      let batchRows = deepClone(rows);
      for(let j = 1; j < count; j++) {
        const tempRows = []
        for (let i = 0; i < batchRows.length; i++) {
          const row = deepClone(batchRows[i] || {});
          for (const item of batchFields) {
            row[item.fieldUID] = null;
            if (item.type === TargetFieldFillType.CUSTOM) {
              row[item.fieldUID] = this.normalizeCustomTargetFieldValue(item.fieldUID, item.value, targetTable);
            } else if (item.type === TargetFieldFillType.FIELD) {
              const arr = item.value?.split(".");
              if (this.isDataOwnerTargetField(item.fieldUID, targetTable) && typeof item.value === "string" && !item.value.includes(".")) {
                row[item.fieldUID] = this.getDataOwnerFieldMappedValue(currentRow, item.value, initiatorId);
                continue;
              }
              if (isEmpty(arr)) continue;
              const isSubTable = arr.length > 2;
              const sourceUID = arr[0];
              const sourceFieldUID = arr[1];
              
              const rows = sourceTableRows[sourceUID];
              if (isEmpty(rows)) continue;
              const fieldValue = rows[0][sourceFieldUID];
              if (isEmpty(fieldValue)) continue;
              if (isSubTable) {
                const subFieldUID = arr[2];
                const subRow = fieldValue[i];
                row[item.fieldUID] = subRow?.[subFieldUID];
              } else {
                row[item.fieldUID] = fieldValue;
              }
            } else if (item.type === TargetFieldFillType.FORMULA) {
              const emptyCheckReferenceKeys = getFormulaEmptyCheckReferenceKeys(item.value);
              let formula = replaceColFieldsByFormula(item.value, (keys) => {
                const [sourceUID, fieldId, subFieldId] = keys;
                const rows = sourceTableRows[sourceUID];
                const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                  && !emptyCheckReferenceKeys.has(keys.join(','));
                const fieldValue = rows?.map(row => row[fieldId]);
                if (isEmpty(fieldValue)) return null;
                if (subFieldId) {
                  return fieldValue.flatMap(rows => rows.map(item => normalizeFormulaNumericValue(item[subFieldId], shouldNormalizeFormulaValues)));
                } else {
                  return fieldValue.map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
                }
              })
              formula = replaceByFormula(formula, (keys) => {
                const [sourceUID, fieldId, subFieldId] = keys;
                const _rows = batchRows;
                const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                  && !emptyCheckReferenceKeys.has(keys.join(','));
                if (isEmpty(_rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                let fieldValue = _rows[i]?.[fieldId];
                if (subFieldId) {
                  return (Array.isArray(fieldValue) ? fieldValue : []).map(row => normalizeFormulaNumericValue(row[subFieldId], shouldNormalizeFormulaValues));
                } else {
                  fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                  return fieldValue;
                }
              })
              try {
                const formulaRuntime = createFormulaRuntimeByData(row, targetTable.fields);
                row[item.fieldUID] = formulaRuntime.evaluate(formula);
              } catch (err) {
                this.logger.error(`add data evaluate formula error:`, err);
              }
            } else if (item.type === TargetFieldFillType.AUTO_RELATED) {
              const isSubField = item.fieldUID?.split(".")?.length > 1;
              const value = [currentRow[uuidField.uid]];
              if(isSubField) {
                if(!row[item.fieldUID.split(".")[0]]?.length) {
                  row[item.fieldUID.split(".")[0]] = [{}];
                }
                for(const f of row[item.fieldUID.split(".")[0]]) {
                  f[item.fieldUID.split(".")[1]] = value;
                }
              } else {
                row[item.fieldUID] = value;
              }
            } else {
              row[item.fieldUID] = batchRows[i]?.[item.fieldUID];
            }
          }
          rows.push(row);
          tempRows.push(row);
          generatedBatchRows.push(deepClone(row));
        }
        batchRows = deepClone(tempRows)
      }
    }
    const addDefaultFieldUIDs: string[] = [];
    for (const targetField of targetTable.fields) {
      if (targetField.meta?.extra?.widgetType === FormWidgetType.SUBFORM) {
        const subTableUID = targetField.meta?.extra?.subTableUID?.at(-1);
        const subTable = targetFormData.tables.find(table => table.uid === subTableUID);
        for (const subField of subTable?.fields || []) {
          const fieldUID = `${targetField.uid}.${subField.uid}`;
          const fillRule = targetFields.find(item => item.fieldUID === fieldUID);
          if (!fillRule || fillRule.type === TargetFieldFillType.EMPTY) {
            addDefaultFieldUIDs.push(fieldUID);
          }
        }
        continue;
      }
      const fillRule = targetFields.find(item => item.fieldUID === targetField.uid);
      if (!fillRule || fillRule.type === TargetFieldFillType.EMPTY) {
        addDefaultFieldUIDs.push(targetField.uid);
      }
    }
    const addDefaultResult = await this.applyProcessDesignDefaults({
      rows,
      fieldUIDs: addDefaultFieldUIDs,
      targetNocodeId,
      targetFormData,
      targetTable,
      initiatorId,
      createMissingSubRows: true,
      clearUnconfiguredFields: false,
    });
    const calculatedDefaultFields = addDefaultResult.targetFields.filter(field => (
      addDefaultResult.configuredFieldUIDs.has(String(field.uid))
    ));
    restoreProcessBatchFieldValues({
      rows,
      generatedBatchRows,
      batchFields,
      batchRowsStartIndex,
    });
    let linkageFields: Field[] = [];
    if (node.options?.allowLinkageFill) {
      const explicitFieldUIDs = new Set([
        ...targetFields.filter(item => item.type !== TargetFieldFillType.EMPTY).map(item => String(item.fieldUID)),
        ...batchFields.filter(item => item.type !== TargetFieldFillType.EMPTY).map(item => String(item.fieldUID)),
      ]);
      const linkageFieldUIDs = await this.applyProcessLinkageFill(rows, targetFormData, targetNocodeId, targetTable, explicitFieldUIDs);
      linkageFields = [...linkageFieldUIDs]
        .map(fieldUID => resolveProcessTargetField(fieldUID, targetTable, targetFormData))
        .filter((field): field is Field => !!field);
      const formulaFields = getFormulaFields(linkageFields, targetTable.fields, targetFormData.tables)
        .filter(field => !explicitFieldUIDs.has(String(field.uid)));
      rowsDefaultValueCalculation(
        rows,
        { formulaFields, defaultFields: [] },
        targetTable,
        targetFormData,
      );
    }
    this.normalizeProcessNumberFieldValues(
      rows,
      targetTable,
      formData,
      this.getProcessNumberNormalizationFieldUIDs([...targetFields, ...batchFields], [...calculatedDefaultFields, ...linkageFields]),
    );
    const targetUUidField = getUUIDSystemField(targetTable.fields);
    const postFinishTaskId = (options as PostFinishRuntimeTodoOptions).causedByTaskId;
    const existingAddedRows: Row[] = [];
    if (postFinishTaskId && targetUUidField?.uid) {
      for (let index = 0; index < rows.length; index++) {
        rows[index][targetUUidField.uid] ||= `${postFinishTaskId}:${index}`;
      }
      for (let index = rows.length - 1; index >= 0; index--) {
        const existed = await this.loadRollbackRowByUUID(
          targetFormData,
          targetNocodeId,
          targetTable,
          String(rows[index][targetUUidField.uid]),
        );
        if (existed) {
          existingAddedRows.unshift(existed);
          rows.splice(index, 1);
        }
      }
    }
    if (!rows.length && existingAddedRows.length) {
      const retryTriggerContext = await this.getCurrentFlowTriggerContext(options);
      await this.formDataService.runPostMutationTasks(
        targetNocodeId,
        targetTable.uid,
        existingAddedRows,
        DataChangeType.ADD,
        {
          triggerTodo: shouldTriggerTargetProcess,
          triggerContext: retryTriggerContext,
          causedByTodoId: options.todoId,
          causedByTaskId: postFinishTaskId,
        },
        true,
      );
      return {
        messages: [],
        mutation: {
          action: DataChangeType.ADD,
          targetNocodeId,
          targetTableId: targetTable.uid,
          beforeRows: [],
          afterRows: existingAddedRows,
          changedFieldUids: [...targetFields, ...batchFields].map(item => item.fieldUID),
        },
      };
    }
    await this.formDataService.validateTableUniqueRows(targetFormData, targetNocodeId, targetTable.uid, rows);
    const submitCheckResult = await this.checkSubmitRows(targetFormData, targetNocodeId, primaryTable, targetTable, rows);
    const skipReTrigger = await this.shouldSkipCurrentTableReTrigger(options, targetNocodeId, targetTable.uid);
    const deferCurrentFormTrigger = (options as PostFinishRuntimeTodoOptions).deferCurrentFormTrigger === true;
    const queueDerivedBatch = !deferCurrentFormTrigger && rows.length > 1;
    const prepareDerivedBatch = rows.length > 1 && (
      queueDerivedBatch
      || targetNocodeId !== options.nocodeId
      || targetTable.uid !== options.tableId
    );
    const triggerContext = await this.getCurrentFlowTriggerContext(options);
    const crossAppTriggerResult: FlowTriggerResult = {
      triggered: false,
    };
    const isTimeTask = (options as AddTodoOptions).source === TODOTriggerType.TIME;
    const derivedEventId = `flow-node:${options.todoId}:${(options as PostFinishRuntimeTodoOptions).mutationOccurrenceId || (options as PostFinishRuntimeTodoOptions).causedByTaskId}:add`;
    const derivedIntent = prepareDerivedBatch
      ? await this.formDataService.prepareFlowDerivedPostMutation({
        eventId: derivedEventId,
        source: DataChangeType.ADD,
        formData: targetFormData,
        nocodeId: targetNocodeId,
        tableUID: targetTable.uid,
        rows,
        causedByTodoId: options.todoId,
        causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
      })
      : null;
    const key: OptionFieldUID = [targetFormData.uid, targetTable.uid, targetUUidField.uid];
    let addedRows: Row[] = [...existingAddedRows];
    let addMutationCommitted = false;
    const addData = async () => {
      try {
      const addOptions: Parameters<FormDataService["addData"]>[5] = {
        uniqueValidation: {
          validateCurrentTable: true,
        },
      };
      if (isTimeTask) {
        const createOwnerField = getCreateOwnerSystemField(targetTable.fields);
        if (initiatorId && createOwnerField?.uid) {
          for (const row of rows) {
            row[createOwnerField.uid] ||= initiatorId;
          }
          addOptions.keepSubmitter = true;
        }
      }
      const triggerOptions: TriggerOptions = {
        ...((!shouldTriggerTargetProcess || skipReTrigger || deferCurrentFormTrigger || queueDerivedBatch) ? { triggerTodo: false } : {}),
        validatePermission: false,
        causedByTodoId: options.todoId,
        causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
        failOnPostMutationError: !!(options as PostFinishRuntimeTodoOptions).causedByTaskId,
      };
      if (triggerContext) {
        triggerOptions.triggerContext = triggerContext;
      }
      if (nodeImportTaskId) {
        triggerOptions.importTaskId = nodeImportTaskId;
      }
      if (resolvedTarget.isCrossAppTarget) {
        triggerOptions.crossAppTriggerResult = crossAppTriggerResult;
      }
      const result = await this.formDataService.addData(
        targetFormData,
        targetNocodeId,
        targetTable.uid,
        rows,
        triggerOptions,
        addOptions,
      );
      addMutationCommitted = true;
      const resultRows = Array.isArray(result?.data) ? result.data : rows;
      const persistedAddedRows = deepClone(await this.loadPersistedMutationRows(
        targetFormData,
        targetNocodeId,
        targetTable,
        resultRows,
      ));
      addedRows.push(...persistedAddedRows);
      if (queueDerivedBatch && persistedAddedRows.length) {
        await this.formDataService.enqueueFlowDerivedPostMutation({
          preparedTaskId: derivedIntent?.taskId,
          eventId: derivedEventId,
          source: DataChangeType.ADD,
          formData: targetFormData,
          nocodeId: targetNocodeId,
          tableUID: targetTable.uid,
          rows: persistedAddedRows,
          triggerContext,
          causedByTodoId: options.todoId,
          causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
        });
      }
      return result;
      } catch (error) {
        if (addMutationCommitted && error && typeof error === "object") {
          (error as Error & { mutationCommitted?: boolean }).mutationCommitted = true;
        }
        await this.formDataService.failFlowDerivedPostMutation(derivedIntent?.taskId, error);
        throw error;
      }
    };
    const rollbackAddedRows = async () => {
      const rollbackRows = rows.filter(row => row[targetUUidField.uid]);
      if (isEmpty(rollbackRows)) {
        return;
      }
      await this.formDataService.tryDeleteData(
        targetFormData,
        targetNocodeId,
        targetTable.uid,
        rollbackRows,
        [key],
        {
          triggerTodo: false,
          validatePermission: false,
        },
      );
    };
    if (isSubTable) {
      await this.executeSubTableMutationWithPrimaryFormulaRollback(
        formData,
        options.nocodeId,
        currentRow,
        currentTable,
        primarySourceTable,
        addData,
        rollbackAddedRows,
        {
          isMutationCommitted: () => rows.some(row => !isUniqueFieldEmpty(row?.[targetUUidField.uid])),
        },
      );
      this.registerFlowCompensationAction(compensationContext, rollbackAddedRows);
      return {
        messages: submitCheckResult.messages,
        recordMeta: this.buildCrossAppTriggerMeta(resolvedTarget, DataChangeType.ADD, crossAppTriggerResult),
        mutation: {
          action: DataChangeType.ADD,
          preparedTaskId: derivedIntent?.taskId,
          targetNocodeId,
          targetTableId: targetTable.uid,
          beforeRows: [],
          afterRows: addedRows,
          changedFieldUids: [...targetFields, ...batchFields].map(item => item.fieldUID),
        },
      };
    }
    this.registerFlowCompensationAction(compensationContext, rollbackAddedRows);
    await addData();
    if (isSubTable) {
      // 需要对主表进行一次公式检查的更改
    }
    return {
      messages: submitCheckResult.messages,
      recordMeta: this.buildCrossAppTriggerMeta(resolvedTarget, DataChangeType.ADD, crossAppTriggerResult),
      mutation: {
        action: DataChangeType.ADD,
        preparedTaskId: derivedIntent?.taskId,
        targetNocodeId,
        targetTableId: targetTable.uid,
        beforeRows: [],
        afterRows: addedRows,
        changedFieldUids: [...targetFields, ...batchFields].map(item => item.fieldUID),
      },
    };
  }

  private shouldReusePlaceholderSubRow(subRows: Row[] = []) {
    if (!Array.isArray(subRows) || subRows.length !== 1) {
      return false;
    }
    const [firstRow] = subRows;
    return !!firstRow && typeof firstRow === "object" && Object.keys(firstRow).length === 0;
  }

  private getProcessNumberNormalizationFieldUIDs(
    targetFields: TargetFieldFillRule[] = [],
    extraFields: Field[] = [],
  ) {
    return [
      ...targetFields.map(item => item?.fieldUID),
      ...extraFields.map(field => field?.uid),
    ].filter((uid): uid is FieldUID => typeof uid === "string" && uid.length > 0);
  }

  private normalizeProcessNumberFieldValues(
    rows: Row[],
    targetTable: Table,
    formData: NocodeFormData,
    fieldUIDs: string[],
  ) {
    if (!Array.isArray(rows) || !fieldUIDs.length) {
      return;
    }
    for (const row of rows) {
      normalizeRowNumberFieldValues(row, targetTable, formData, fieldUIDs);
    }
  }

  private async checkSubmitRows(
    targetFormData: NocodeFormData,
    targetNocodeId: string,
    primaryTable: Table | null,
    targetTable: Table,
    rows: Row[],
    options: { fullReplace?: boolean } = {},
  ): Promise<SubmitRowsCheckResult> {
    if (!Array.isArray(rows) || isEmpty(rows)) {
      return {
        messages: [],
      };
    }

    const messages: string[] = [];

    if (primaryTable) {
      const soul = targetFormData.formOptions?.[primaryTable.uid]?.widget;
      const field = primaryTable.fields.find(field => field.meta?.extra?.subTableUID?.[1] === targetTable.uid);
      const subSoul = findWidgetSoulByUID([soul], field?.meta?.uid);
      const subValidateRule = subSoul?.options?.["submit-valid"] as FormValidRule;
      const res = await this.formDataService.validateSubFormSubmit(targetNocodeId, rows, subValidateRule, targetTable.uid, {
        fullReplace: options.fullReplace,
      });
      if (res && !res?.valid) {
        throw new Error(res.error);
      }
      this.appendSubmitValidationMessages(messages, res?.messages);
    } else {
      const soul = targetFormData.formOptions?.[targetTable.uid]?.widget;
      const subTableFieldUIDs = targetTable.fields.filter(field => !!field.meta?.extra?.subTableUID?.[1])?.map(field => [field.uid, field.meta?.extra?.subTableUID?.[1]]);
      const validateRule = soul.options["submit-valid"] as FormValidRule;
      const parentUuidField = getUUIDSystemField(targetTable.fields);
      for (const row of rows) {
        const res = await this.formDataService.validateFormSubmit(targetNocodeId, row, validateRule, false, {
          connectionUID: targetFormData.uid,
          tableUID: targetTable.uid,
        });
        if (res && !res?.valid) {
          throw new Error(res.error);
        }
        this.appendSubmitValidationMessages(messages, res?.messages);
      }
      for (const [fieldId, subTableUID] of subTableFieldUIDs) {
        const subTable = targetFormData.tables.find(item => item.uid === subTableUID);
        if (!subTable) {
          continue;
        }
        const relationField = subTable?.fields.find(item => item.meta.name === SystemField.KEY);
        const subRows: Row[] = [];
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          const currentSubRows = Array.isArray(row?.[fieldId]) ? row[fieldId] : [];
          const parentRelationValue = parentUuidField && !isUniqueFieldEmpty(row?.[parentUuidField.uid])
            ? row[parentUuidField.uid]
            : `__parent_row_index__:${index}`;
          for (const subRow of currentSubRows) {
            if (relationField && isUniqueFieldEmpty(subRow?.[relationField.uid])) {
              subRows.push({
                ...subRow,
                [relationField.uid]: parentRelationValue,
              });
            } else {
              subRows.push(subRow);
            }
          }
        }
        const nestedResult = await this.checkSubmitRows(targetFormData, targetNocodeId, targetTable, subTable, subRows, {
          fullReplace: true,
        });
        this.appendSubmitValidationMessages(messages, nestedResult?.messages);
      }
    }

    return {
      messages,
    };
  }

  private sortTargetRowsByCurrentRow(targetRows ,currentRow ,conditions) {
    // 1. 找到等号条件（现在只支持一个）
    const equalCondition = conditions.find(c => c.func === '=' && c.type === 'FORM');
    if (!equalCondition) return targetRows;

    // 2. 解析 value
    const [currentField, subField] = equalCondition.value.split('.');
    const baseArray = currentRow[currentField];

    if (!Array.isArray(baseArray)) {
      return targetRows;
    }

    // 3. 建立顺序映射�?
    const orderMap = new Map<any, number>();
    let index = 0;

    for (const item of baseArray) {
      if (item && typeof item === 'object') {
        const key = subField ? item[subField] : item;
        if (key !== undefined && !orderMap.has(key)) {
          orderMap.set(key, index++);
        }
      }
    }

    // 4. 排序 targetRows
    return [...targetRows].sort((a, b) => {
      const aVal = a[equalCondition.uid];
      const bVal = b[equalCondition.uid];

      const aIndex = orderMap.has(aVal) ? orderMap.get(aVal)! : Infinity;
      const bIndex = orderMap.has(bVal) ? orderMap.get(bVal)! : Infinity;

      return aIndex - bIndex;
    });
  }

  private normalizeFilterConditionsBySourceValue(conditions: FormCondition[] = []) {
    return conditions.map((item) => {
      if (item.type !== FormConditionValueType.FORM || item.value?.split(".")?.length <= 1) {
        return item;
      }

      const nextItem = deepClone(item);
      if (nextItem.func === RuleFunc.EQUAL) {
        nextItem.func = RuleFunc.IN;
      } else if (nextItem.func === RuleFunc.NOT_EQUAL) {
        nextItem.func = RuleFunc.NOT_IN;
      }
      return nextItem;
    });
  }

  private getEffectiveFilterConditions(filterRule?: FilterRule | null) {
    return (filterRule?.conditions || []).filter((item) => {
      return !(
        isEmpty(item?.uid)
        && isEmpty(item?.func)
        && isEmpty(item?.value)
        && isEmpty(item?.formula)
      );
    });
  }

  private resolveFilterValueFromRow(
    row: Row | null | undefined,
    fieldPath: string[],
    func?: RuleFunc,
    collectSubTableValues = false,
  ) {
    if (!row || isEmpty(fieldPath)) {
      return undefined;
    }
    if (fieldPath.length === 1) {
      return row[fieldPath[0]];
    }

    const [fieldId, subFieldId] = fieldPath;
    const subRows = Array.isArray(row[fieldId]) ? row[fieldId] : [];
    if (collectSubTableValues || [RuleFunc.IN, RuleFunc.NOT_IN].includes(func)) {
      return subRows.map(item => item?.[subFieldId]);
    }
    return subRows[0]?.[subFieldId];
  }

  private resolveCurrentSubTableFilterConditionValue(
    condition: FormCondition,
    currentRow: Row,
    currentTable: Table | null,
    targetRow: Row,
    targetSourceUID: string,
    targetSubRow?: Row,
    targetFieldUID?: string,
  ) {
    const type = condition.type || FormConditionValueType.FORM;
    if (type === FormConditionValueType.FORM) {
      const rawValue = String(condition.value || "");
      const parts = rawValue.split(".").filter(Boolean);
      if (parts.length <= 1) {
        return this.resolveFilterValueFromRow(currentRow, parts, condition.func);
      }

      const [sourceUID, ...fieldPath] = parts;
      if (sourceUID === targetSourceUID) {
        if (fieldPath.length > 1) {
          if (targetSubRow && targetFieldUID && fieldPath[0] === targetFieldUID) {
            return this.resolveFilterValueFromRow(targetSubRow, fieldPath.slice(1), condition.func);
          }
          return this.resolveFilterValueFromRow(targetRow, fieldPath, condition.func, true);
        }
        return this.resolveFilterValueFromRow(targetRow, fieldPath, condition.func);
      }
      if (currentTable && sourceUID === currentTable.uid) {
        return this.resolveFilterValueFromRow(currentRow, fieldPath, condition.func);
      }
      return this.resolveFilterValueFromRow(currentRow, parts, condition.func);
    }

    if (type === FormConditionValueType.FORMULA) {
      try {
        return evaluateFormulaWithRuntime(
          condition.formula ?? condition.value,
          createFormulaRuntimeByData(currentRow, currentTable?.fields || []),
        );
      } catch (err) {
        return condition.value;
      }
    }

    return hasConfiguredValue(condition.fixedValue) ? condition.fixedValue : condition.value;
  }

  private isCurrentSubTableSourceRowMatched(
    subRow: Row,
    filterRule: FilterRule | undefined,
    currentRow: Row,
    currentTable: Table | null,
    targetRow: Row,
    targetSourceUID: string,
    targetSubRow?: Row,
    targetFieldUID?: string,
  ) {
    const conditions = this.getEffectiveFilterConditions(filterRule);
    if (isEmpty(conditions)) {
      return true;
    }

    const matched = conditions.map((condition) => {
      let func = condition.func;
      const value = this.resolveCurrentSubTableFilterConditionValue(
        condition,
        currentRow,
        currentTable,
        targetRow,
        targetSourceUID,
        targetSubRow,
        targetFieldUID,
      );

      if (Array.isArray(value) && func === RuleFunc.EQUAL) {
        func = RuleFunc.IN;
      } else if (Array.isArray(value) && func === RuleFunc.NOT_EQUAL) {
        func = RuleFunc.NOT_IN;
      }

      return evaluateCondition(subRow, transformCondition({
        ...condition,
        func,
        value,
      }));
    });

    return (filterRule?.logic || LogicalOperator.AND) === LogicalOperator.OR
      ? matched.some(Boolean)
      : matched.every(Boolean);
  }

  private getCurrentSubTableSourceRow(
    currentRow: Row,
    currentTable: Table,
    targetRow: Row,
    targetSourceUID: string,
    currentSubTableFilters?: Array<CurrentSubTableFilter | null | undefined>,
  ) {
    if (isEmpty(currentSubTableFilters)) {
      return currentRow;
    }

    const nextRow = deepClone(currentRow);
    for (const currentSubTableFilter of currentSubTableFilters) {
      if (!currentSubTableFilter?.fieldUID) {
        continue;
      }
      const conditions = this.getEffectiveFilterConditions(currentSubTableFilter.filterRule);
      if (isEmpty(conditions)) {
        continue;
      }
      const subRows = Array.isArray(currentRow?.[currentSubTableFilter.fieldUID])
        ? currentRow[currentSubTableFilter.fieldUID]
        : [];
      if (isEmpty(subRows)) {
        continue;
      }
      nextRow[currentSubTableFilter.fieldUID] = subRows.filter(subRow => {
        return this.isCurrentSubTableSourceRowMatched(
          subRow,
          currentSubTableFilter.filterRule,
          currentRow,
          currentTable,
          targetRow,
          targetSourceUID,
        );
      });
    }
    return nextRow;
  }

  private getEditNodeExistingSubRows(row: Row, fieldId: string) {
    const subRows: Row[] = Array.isArray(row?.[fieldId]) ? row[fieldId] : [];
    row[fieldId] = subRows;
    return subRows;
  }

  private getEditNodeMatchedSubRowIndexes(
    originalRow: Row,
    fieldId: string,
    filterRule: FilterRule | undefined,
    currentRow: Row,
    currentTable: Table,
  ) {
    const subRows: Row[] = Array.isArray(originalRow?.[fieldId]) ? originalRow[fieldId] : [];
    if (isEmpty(subRows)) {
      return [];
    }

    const allIndexes = subRows.map((_, index) => index);
    if (isEmpty(filterRule?.conditions)) {
      return allIndexes;
    }

    const mainConditions = filterRule.conditions.filter(condition => (condition.uid?.split(".")?.length || 0) <= 1);
    const targetConditions = filterRule.conditions.filter(condition => condition.uid?.split(".")?.[0] === fieldId);
    if (isEmpty(targetConditions)) {
      return allIndexes;
    }

    const formulaRuntime = createFormulaRuntimeByData(currentRow, currentTable.fields);
    const subWhereCondition = transformFilterRule({
      logic: filterRule.logic || LogicalOperator.AND,
      conditions: this.normalizeFilterConditionsBySourceValue(targetConditions),
    }, currentRow, {
      formulaRuntime,
    });
    const subMatchedIndexes = subRows.reduce<number[]>((prev, subRow, index) => {
      if (evaluateCondition(subRow, subWhereCondition)) {
        prev.push(index);
      }
      return prev;
    }, []);

    if (isEmpty(mainConditions)) {
      return subMatchedIndexes;
    }

    const mainWhereCondition = transformFilterRule({
      logic: filterRule.logic || LogicalOperator.AND,
      conditions: this.normalizeFilterConditionsBySourceValue(mainConditions),
    }, currentRow, {
      formulaRuntime,
    });
    const mainMatched = evaluateCondition(originalRow, mainWhereCondition);
    if (filterRule.logic === LogicalOperator.OR) {
      return mainMatched ? allIndexes : subMatchedIndexes;
    }
    return mainMatched ? subMatchedIndexes : [];
  }

  private getEditNodeMatchedSubRowsByIndexes(
    row: Row,
    fieldId: string,
    matchedIndexes: number[],
  ) {
    const subRows = this.getEditNodeExistingSubRows(row, fieldId);
    return matchedIndexes.reduce<Row[]>((prev, index) => {
      if (index < 0 || index >= subRows.length) {
        return prev;
      }
      if (!subRows[index]) {
        subRows[index] = {};
      }
      prev.push(subRows[index]);
      return prev;
    }, []);
  }

  private getEditNodeSubTableSourceValue(fieldValue: Row[], sourceSubFieldUID: string, index: number) {
    if (!Array.isArray(fieldValue) || fieldValue.length === 0) {
      return undefined;
    }
    const sourceRow = fieldValue[Math.min(index, fieldValue.length - 1)];
    return sourceRow?.[sourceSubFieldUID];
  }

  private isNumericFormulaSourceField(
    formulaTables: Record<string, Table>,
    sourceUID: string,
    fieldId: string,
    subFieldId?: string,
  ) {
    const sourceTable = formulaTables[sourceUID];
    const field = sourceTable?.fields.find(item => item.uid === fieldId || item.meta?.uid === fieldId);
    if (!field) {
      return false;
    }
    if (!subFieldId) {
      return (field.revisedType || field.type) === "number";
    }
    const subTableUID = field.meta?.extra?.subTableUID?.at(-1);
    const subTable = formulaTables[subTableUID] || {
      fields: field.subTableFields || [],
    } as Table;
    const subField = subTable.fields.find(item => item.uid === subFieldId || item.meta?.uid === subFieldId);
    return !!subField && (subField.revisedType || subField.type) === "number";
  }

  private getMatchedCurrentSubTableSourceRow(
    targetRow: Row,
    targetSubRow: Row,
    targetFieldUID: string,
    sourceFieldUID: string,
    currentRow: Row,
    currentTable: Table,
    targetSourceUID: string,
    currentSubTableFilters: CurrentSubTableFilter[] = [],
  ) {
    const currentSubTableFilter = currentSubTableFilters.find(item => item?.fieldUID === sourceFieldUID);
    if (!currentSubTableFilter?.fieldUID) {
      return null;
    }
    const sourceRows = Array.isArray(currentRow?.[sourceFieldUID]) ? currentRow[sourceFieldUID] : [];
    if (isEmpty(sourceRows)) {
      return null;
    }
    return sourceRows.find(sourceRow => {
      return this.isCurrentSubTableSourceRowMatched(
        sourceRow,
        currentSubTableFilter.filterRule,
        currentRow,
        currentTable,
        targetRow,
        targetSourceUID,
        targetSubRow,
        targetFieldUID,
      );
    }) || null;
  }

  private isDataOwnerTargetField(fieldUID: string, table?: Table) {
    if (!table || !isDataOwnerEnabledTable(table)) {
      return false;
    }
    if (fieldUID === SystemField.DATA_OWNER) {
      return true;
    }

    const rootFieldUID = fieldUID?.split(".")?.[0];
    if (!rootFieldUID || !table?.fields?.length) {
      return false;
    }

    const targetField = table.fields.find(field => field.uid === rootFieldUID || field.meta?.uid === rootFieldUID);
    return targetField?.meta?.name === SystemField.DATA_OWNER;
  }

  private normalizeCustomTargetFieldValue(fieldUID: string, value: any, table?: Table) {
    if (!this.isDataOwnerTargetField(fieldUID, table)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0] ?? "";
    }

    if (value && typeof value === "object") {
      return value.id ?? "";
    }

    return value ?? "";
  }

  private getDataOwnerFieldMappedValue(currentRow: Row | undefined, fieldValue: string, initiatorId?: string | null) {
    if (fieldValue === FLOW_DATA_OWNER_SOURCE_SUBMITTER) {
      return initiatorId || null;
    }
    const resolvedValue = currentRow?.[fieldValue];
    if (isEmpty(resolvedValue)) {
      return initiatorId || null;
    }
    if (Array.isArray(resolvedValue)) {
      return resolvedValue[0] ?? initiatorId ?? null;
    }
    if (resolvedValue && typeof resolvedValue === "object") {
      return resolvedValue.id ?? initiatorId ?? null;
    }
    return resolvedValue;
  }

  private isFlowFormulaEmptyValueError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return /Unexpected type of argument in function (addScalar|subtractScalar|multiplyScalar|divideScalar|mod)\b/.test(message)
      && /actual:\s.*(?:null|undefined)/.test(message);
  }

  private async startEditDataNode(
    options: BaseTodoOptions,
    node: ProcessFlow,
    initiatorId?: string,
    compensationContext?: FlowCompensationContext,
  ): Promise<DataProcessingNodeStartResult> {
    const {
      targetTableUID,
      targetTableFilterRule,
      sourceTables = [],
      primarySourceTable,
      currentSubTableFilter,
      currentSubTableFilters = [],
      targetFields = [],
      targetTableDataScope = EditDataTargetScope.HISTORY,
    } = node.options || {};
    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const formData = nocodeBody.formData;
    const currentTable = formData.tables.find(t => t.uid === options.tableId);
    const resolvedTarget = this.resolveProcessTargetTable(options.nocodeId, nocodeBody, targetTableUID);
    const { targetNocodeId, targetFormData, targetTable, isCrossAppTarget } = resolvedTarget;
    const shouldTriggerTargetProcess = this.shouldTriggerTargetProcess(node, options, resolvedTarget);
    const isSubTargetTable = !!targetTable?.meta?.extra?.primaryTable && !!primarySourceTable;
    const primaryTable = formData.tables.find(t => t.uid === primarySourceTable?.tableUID);
    const normalizedTargetTableFilterRule = targetTableFilterRule || {
      conditions: [],
      logic: LogicalOperator.AND,
    };
    const nodeImportTaskId = options.importTaskId;
    if (!currentTable) {
      return {
        messages: [],
      };
    }
    await this.assertCrossAppWritePermission(nocodeBody, resolvedTarget, DataChangeType.EDIT);
    const uuidField = getUUIDSystemField(currentTable.fields);
    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options, {
      formData,
      currentTable,
    });
    if (!currentRowContext?.currentRow) {
      return {
        messages: [],
      };
    }
    const { currentRows, currentRow, hasPhysicalRow, startRecord } = currentRowContext;
    const operationTriggerStartMeta = this.getOperationTriggerStartMeta(startRecord);
    this.ensureEmptyRowAutoRelatedSupported(node, hasPhysicalRow);
    if (isCrossAppTarget && targetTableDataScope === EditDataTargetScope.CURRENT) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    if (!hasPhysicalRow && targetTableDataScope === EditDataTargetScope.CURRENT) {
      throw this.createEmptyRowTriggerError(
        global.i18next.t('formFlowService.emptyRowEditCurrentNotSupported'),
        "edit-current-not-supported",
      );
    }
    const isEditingSubField = targetFields.some(item => item.fieldUID?.split(".")?.length > 1);
    let targetRows: Row[] = [];
    if (targetTableDataScope === EditDataTargetScope.CURRENT) {
      if (targetTableUID === options.tableId) {
        targetRows = deepClone(currentRows || []);
      } else {
        const subTableField = currentTable.fields.find(field => field.meta?.extra?.subTableUID?.[1] === targetTableUID);
        targetRows = deepClone(subTableField ? (currentRow?.[subTableField.uid] || []) : []);
        if (!isEmpty(targetRows) && !isEmpty(normalizedTargetTableFilterRule.conditions)) {
          const whereCondition = transformFilterRule(
            normalizedTargetTableFilterRule,
            currentRow,
            { formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields) },
          );
          targetRows = targetRows.filter(row => evaluateCondition(row, whereCondition));
        }
      }
    } else {
      let filters = {}
      // 如果目标表单是子表，需要根据主表的过滤规则来筛选子表的数据范围
      if(isSubTargetTable) {
        const keyField = targetTable.fields.find(f => f.meta.name === SystemField.KEY)
        const primaryTableUID = targetTable.meta.extra.primaryTable[1]
        const primaryTable = formData.tables.find(t => t.uid === primaryTableUID)
        if (!keyField || !primaryTable) {
          return {
            messages: [],
          };
        }
        const primaryUUID = getUUIDSystemField(primaryTable.fields).uid
        const primaryFilters = transformFilterRule(primarySourceTable.filterRule, currentRow, { formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields) });
        const res = await this.formDataService._distinct(formData, options.nocodeId, primaryTableUID, primaryUUID, {
          filters: {
            [primaryTableUID]: [primaryFilters],
          },
        })

        filters = {
          [targetTableUID]: [{
            [keyField.uid]: res.map(item => item.value).filter(Boolean),
          }]
        };
      }

      targetRows = await this.getTableRows(nocodeBody, options.nocodeId, targetTableUID, deepClone(normalizedTargetTableFilterRule), currentRow, {
        fillSubTable: !isEditingSubField,
        formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields),
        orderBy: SortType.ASC,
        stage: this.getDefaultReadableStageCondition(),
        filters,
      });
      if (isEditingSubField) {
        targetRows = await this.formDataService.fillSubFormField(targetRows, targetNocodeId, targetTable, targetFormData);
      }
      // 排序 targetRows
      targetRows = this.sortTargetRowsByCurrentRow(targetRows, currentRow, deepClone(normalizedTargetTableFilterRule.conditions));
    }
    if (isEmpty(targetRows)) {
      return {
        messages: [],
      };
    }
    const originalTargetRows = deepClone(targetRows);
    const targetStageField = targetTable.fields.find(field => field.meta.name === SystemField.DATA_STAGE);
    const targetSourceUID = getProcessTargetSourceUID(targetTableUID, options.tableId);
    const sourceTableRows: Record<string, Row[]> = {
      [options.tableId]: currentRows,
      [targetSourceUID]: targetRows,
    };

    await Promise.all(sourceTables.map(async (item) => {
      const filterRule = item.filterRule;
      sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, options.nocodeId, item.tableUID, filterRule, currentRow, {
        fillSubTable: true,
        formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields),
      });
    }));
    const formulaSourceTables: Record<string, Table> = {};
    for (const table of [...formData.tables, ...(targetFormData?.tables || [])]) {
      formulaSourceTables[table.uid] = table;
    }
    formulaSourceTables[options.tableId] = currentTable;
    if (targetTable) {
      formulaSourceTables[targetSourceUID] = targetTable;
    }
    for (const sourceTable of sourceTables) {
      const sourceData = getNocodeDataSourceTableByUID(nocodeBody, sourceTable.tableUID, {
        nocodeId: options.nocodeId,
        includeSchemaSources: true,
      }, true);
      if (sourceData?.table) {
        formulaSourceTables[sourceTable.uid] = sourceData.table;
      }
    }
    if (primarySourceTable) {
      const sourceData = getNocodeDataSourceTableByUID(nocodeBody, primarySourceTable.tableUID, {
        nocodeId: options.nocodeId,
        includeSchemaSources: true,
      }, true);
      if (sourceData?.table) {
        formulaSourceTables[primarySourceTable.uid] = sourceData.table;
      }
    }
    const dataContext = await this.flowExecutionContextRepository.findOne({ todoId: options.todoId });

    const defaultValueTargetFields = targetFields.filter(item => item.type === TargetFieldFillType.DEFAULT);

    const mergedRows = this.mergeTableRows(deepClone(sourceTableRows), targetFields.filter(item => item.type === TargetFieldFillType.FIELD))
    const editDefaultSubRowIndexesByRow: Array<Record<string, number[]>> = [];
    const rows = targetRows.map((targetRow, index) => {
      const normalizedCurrentSubTableFilters = [
        ...currentSubTableFilters,
        ...(currentSubTableFilter ? [currentSubTableFilter] : []),
      ].filter((item): item is CurrentSubTableFilter => !!item?.fieldUID);
      // 当前子表筛选先统一收窄源子表数据；只有写入目标子表时，才再按目标子表行做逐行匹配。
      const currentSourceRow = this.getCurrentSubTableSourceRow(
        currentRow,
        currentTable,
        targetRow,
        targetSourceUID,
        normalizedCurrentSubTableFilters,
      );
      const getMatchedCurrentSubSourceRow = (targetSubRow: Row, targetFieldUID: string, sourceFieldUID: string) => {
        return this.getMatchedCurrentSubTableSourceRow(
          targetRow,
          targetSubRow,
          targetFieldUID,
          sourceFieldUID,
          currentRow,
          currentTable,
          targetSourceUID,
          normalizedCurrentSubTableFilters,
        );
      };
      const hasCurrentSubTableFilter = (sourceFieldUID: string) => {
        return normalizedCurrentSubTableFilters.some(filter => filter.fieldUID === sourceFieldUID);
      };
      const getCurrentSubTableSourceSubFieldValue = (
        targetSubRow: Row,
        targetFieldUID: string,
        sourceFieldUID: string,
        sourceSubFieldUID: string,
        sourceFieldValue: Row[],
        sourceRowIndex: number,
      ) => {
        if (hasCurrentSubTableFilter(sourceFieldUID)) {
          return getMatchedCurrentSubSourceRow(targetSubRow, targetFieldUID, sourceFieldUID)?.[sourceSubFieldUID];
        }
        return this.getEditNodeSubTableSourceValue(sourceFieldValue, sourceSubFieldUID, sourceRowIndex);
      };
      const currentSourceRows = [currentSourceRow];
      const getSourceRows = (sourceUID: string) => {
        return sourceUID === options.tableId ? currentSourceRows : sourceTableRows[sourceUID];
      };
      const originalTargetRow = originalTargetRows[index] || deepClone(targetRow);
      const row = deepClone(targetRow);
      const modelRow = deepClone(row)
      const matchedSubRowIndexCache: Record<string, number[]> = {};
      for(const fieldId of Object.keys(modelRow)) {
        if (Array.isArray(modelRow[fieldId])) {
          modelRow[fieldId] = [{}];
        }
      }
      const getMatchedSubRows = (fieldId: string) => {
        if (!(fieldId in matchedSubRowIndexCache)) {
          matchedSubRowIndexCache[fieldId] = this.getEditNodeMatchedSubRowIndexes(
            targetRow,
            fieldId,
            normalizedTargetTableFilterRule,
            currentRow,
            currentTable,
          );
        }
        return this.getEditNodeMatchedSubRowsByIndexes(row, fieldId, matchedSubRowIndexCache[fieldId]);
      };
      const getMatchedOriginalSubRows = (fieldId: string) => {
        const matchedIndexes = matchedSubRowIndexCache[fieldId] || [];
        const originalSubRows: Row[] = Array.isArray(originalTargetRow?.[fieldId]) ? originalTargetRow[fieldId] : [];
        return matchedIndexes.reduce<Row[]>((prev, subRowIndex) => {
          if (subRowIndex < 0 || subRowIndex >= originalSubRows.length) {
            return prev;
          }
          prev.push(originalSubRows[subRowIndex] || {});
          return prev;
        }, []);
      };
      for (const item of targetFields) {
        if (item.type === TargetFieldFillType.CUSTOM) {
          const normalizedValue = this.normalizeCustomTargetFieldValue(item.fieldUID, item.value, targetTable);
          const isSubField = item.fieldUID?.split(".")?.length > 1;
          if(isSubField) {
            const [fieldId, subFieldId] = item.fieldUID.split(".");
            const subRows = getMatchedSubRows(fieldId);
            for(const subRow of subRows) {
              subRow[subFieldId] = normalizedValue;
            }
          } else {
            row[item.fieldUID] = normalizedValue;
          }
        } else if (item.type === TargetFieldFillType.FIELD) {
          const keyArr = item.fieldUID?.split(".");
          const arr = item.value?.split(".");

          if (this.isDataOwnerTargetField(item.fieldUID, targetTable) && typeof item.value === "string" && !item.value.includes(".")) {
            row[item.fieldUID] = this.getDataOwnerFieldMappedValue(currentRow, item.value, initiatorId);
            continue;
          }
          if (isEmpty(arr)) continue;

          const fieldId = keyArr[0];
          const subFieldId = keyArr[1];

          const isSubTable = arr.length > 2;
          const sourceUID = arr[0] as TableUID;
          const sourceFieldUID = arr[1];
          const sourceSubFieldUID = arr[2];

          const _row = mergedRows[index] || mergedRows.at(-1);
          const fieldValue = sourceUID === options.tableId
            ? currentSourceRow?.[sourceFieldUID]
            : (_row?.[`${sourceUID}.${sourceFieldUID}`]
              ?? ((sourceTableRows[sourceUID] === currentRows) ? currentRow?.[sourceFieldUID] : undefined));
          if (isEmpty(fieldValue)) continue;
          if (keyArr.length > 1) {
            const subRows = getMatchedSubRows(fieldId);
            const originalSubRows = getMatchedOriginalSubRows(fieldId);
            if (isSubTable) {
              for (let j = 0; j < subRows.length; j++) {
                const subRow = subRows[j] || {};
                if (sourceUID === options.tableId) {
                  const matchedValue = getCurrentSubTableSourceSubFieldValue(
                    originalSubRows[j] || {},
                    fieldId,
                    sourceFieldUID,
                    sourceSubFieldUID,
                    fieldValue,
                    j,
                  );
                  if (matchedValue === undefined) {
                    continue;
                  }
                  subRow[subFieldId] = matchedValue;
                } else {
                  subRow[subFieldId] = this.getEditNodeSubTableSourceValue(fieldValue, sourceSubFieldUID, j);
                }
                subRows[j] = subRow;
              }
            } else {
              for (let j = 0; j < subRows.length; j++) {
                const subRow = subRows[j] || {};
                subRow[subFieldId] = fieldValue;
                subRows[j] = subRow;
              }
            }
            continue;
          }

          if (keyArr.length > 1) { // 子表被修�?
            if (!row[fieldId]) row[fieldId] = [];
            if(isSubTable) { // 子表修改子表
              for(let j = 0; j < fieldValue.length; j++) {
                const _subRow = fieldValue[j];
                let subRow = row[fieldId][j] || deepClone(modelRow[fieldId][0]);
                subRow[subFieldId] = _subRow[sourceSubFieldUID];
                row[fieldId][j] = subRow;
              }
            } else { // 主表修改子表
              for(let j = 0; j < row[fieldId].length; j++) {
                const subRow = row[fieldId][j] || {};
                subRow[subFieldId] = fieldValue;
                row[fieldId][j] = subRow;
              }
              modelRow[fieldId][0][subFieldId] = deepClone(fieldValue);
            }
          } else { // 主表被修�?
            if (isSubTable) { // 子表修改主表
              row[fieldId] = fieldValue[index > fieldValue.length - 1 ? fieldValue.length - 1 : index][sourceSubFieldUID];
            } else {  // 主表修改主表
              row[fieldId] = fieldValue;
            }
          }
        } else if (item.type === TargetFieldFillType.FORMULA) {
          const keyArr = item.fieldUID?.split(".");
          const fieldId = keyArr[0];
          const subFieldId = keyArr[1];
          const targetSubTableFieldUID = fieldId;
          const emptyCheckReferenceKeys = getFormulaEmptyCheckReferenceKeys(item.value);
          let subformLength = 0

          let colFormula = replaceColFieldsByFormula(item.value, (keys) => {
            const [sourceUID, fieldId, subFieldId] = keys;
            const rows = getSourceRows(sourceUID);
            const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
            const fieldValue = rows?.map(row => row[fieldId]);
            if (isEmpty(fieldValue)) return null;
            if (subFieldId) {
              return fieldValue.flatMap(rows => rows.map(item => normalizeFormulaNumericValue(item[subFieldId], shouldNormalizeFormulaValues)));
            } else {
              return fieldValue.map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
            }
          })
          let formula = replaceByFormula(colFormula, (keys) => {
            const [sourceUID, fieldId, subFieldId] = keys;
            const rows = getSourceRows(sourceUID);
            const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
            if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
            let fieldValue = rows[index > rows.length - 1 ? rows.length - 1 : index]?.[fieldId];
            if (subFieldId) {
              fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
              subformLength = fieldValue.length;
              // 原代码获取了子表的第index行的子字段数据（fieldValue[fieldValue.length > index ? index : fieldValue.length - 1]?.[subFieldId];）
              // index是主表的索引，而这里误用到了“子表单行定位”上
              // 实际流程应用场景，需要获取子表所有行该字段的数据集合
              return fieldValue.map(row => normalizeFormulaNumericValue(row[subFieldId], shouldNormalizeFormulaValues));
            } else {
              fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
              return fieldValue;
            }
          })

          if(subFieldId) {
            const field = targetTable.fields.find(f => f.uid === fieldId);
            const subTable = targetFormData.tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);
            if (!subTable) {
              continue;
            }
            const subRows = getMatchedSubRows(fieldId);
            const originalSubRows = getMatchedOriginalSubRows(fieldId);

            if(subformLength) {
              for(let j = 0; j < subRows.length; j++) {
                const subRow = subRows[j] || {};
                let shouldSkipCurrentSubTableWrite = false;
                formula = replaceByFormula(colFormula, (keys) => {
                  const [sourceUID, fieldId, subFieldId] = keys;
                  const rows = getSourceRows(sourceUID);
                  const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                    && !emptyCheckReferenceKeys.has(keys.join(','));
                  if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                  let fieldValue = rows[index > rows.length - 1 ? rows.length - 1 : index]?.[fieldId];
                  if (subFieldId) {
                    fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                    if (sourceUID === options.tableId) {
                      const matchedValue = getCurrentSubTableSourceSubFieldValue(
                        originalSubRows[j] || {},
                        targetSubTableFieldUID,
                        fieldId,
                        subFieldId,
                        fieldValue,
                        j,
                      );
                      if (matchedValue === undefined) {
                        shouldSkipCurrentSubTableWrite = true;
                        return null;
                      }
                      return normalizeFormulaNumericValue(matchedValue, shouldNormalizeFormulaValues);
                    }
                    subformLength = fieldValue.length;
                    return normalizeFormulaNumericValue(fieldValue[fieldValue.length > 0 ? (fieldValue.length > j ? j : fieldValue.length - 1) : 0]?.[subFieldId], shouldNormalizeFormulaValues);
                  } else {
                    fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                    return fieldValue;
                  }
                })
                if (shouldSkipCurrentSubTableWrite) {
                  continue;
                }
                const formulaRuntime = createFormulaRuntimeByData(subRow, subTable.fields);
                subRow[subFieldId] = formulaRuntime.evaluate(formula);
                subRows[j] = subRow;
              }
            } else {
              for(let j = 0; j < subRows.length; j++) {
                const subRow = subRows[j] || {};
                let shouldSkipCurrentSubTableWrite = false;
                formula = replaceByFormula(colFormula, (keys) => {
                  const [sourceUID, fieldId, subFieldId] = keys;
                  const rows = getSourceRows(sourceUID);
                  const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                    && !emptyCheckReferenceKeys.has(keys.join(','));
                  if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                  let fieldValue = rows[index > rows.length - 1 ? rows.length - 1 : index]?.[fieldId];
                  if (subFieldId) {
                    fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                    if (sourceUID === options.tableId) {
                      const matchedValue = getCurrentSubTableSourceSubFieldValue(
                        originalSubRows[j] || {},
                        targetSubTableFieldUID,
                        fieldId,
                        subFieldId,
                        fieldValue,
                        j,
                      );
                      if (matchedValue === undefined) {
                        shouldSkipCurrentSubTableWrite = true;
                        return null;
                      }
                      return normalizeFormulaNumericValue(matchedValue, shouldNormalizeFormulaValues);
                    }
                    subformLength = fieldValue.length;
                    return normalizeFormulaNumericValue(fieldValue[fieldValue.length > j ? j : fieldValue.length - 1]?.[subFieldId], shouldNormalizeFormulaValues);
                  } else {
                    fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                    return fieldValue;
                  }
                })
                if (shouldSkipCurrentSubTableWrite) {
                  continue;
                }
                const formulaRuntime = createFormulaRuntimeByData(subRow, subTable.fields);
                subRow[subFieldId] = formulaRuntime.evaluate(formula);
                subRows[j] = subRow;
              }
            }
            continue;
          }

          if(subFieldId) {
            if(!row[item.fieldUID]) row[item.fieldUID] = [];

            const field = currentTable.fields.find(f => f.uid === fieldId);
            const subTable = formData.tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);

            if(subformLength) {
              for(let j = 0; j < subformLength && j < row[item.fieldUID].length; j++) {
                let subRow = row[item.fieldUID][j] || deepClone(modelRow[item.fieldUID][0]);
                formula = replaceByFormula(colFormula, (keys) => {
                  const [sourceUID, fieldId, subFieldId] = keys;
                  const rows = getSourceRows(sourceUID);
                  const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                    && !emptyCheckReferenceKeys.has(keys.join(','));
                  if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                  let fieldValue = rows[index > rows.length - 1 ? rows.length - 1 : index]?.[fieldId];
                  if (subFieldId) {
                    fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                    subformLength = fieldValue.length;
                    return normalizeFormulaNumericValue(fieldValue[fieldValue.length > j ? j : fieldValue.length - 1]?.[subFieldId], shouldNormalizeFormulaValues);
                  } else {
                    fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                    return fieldValue;
                  }
                })
                const formulaRuntime = createFormulaRuntimeByData(row[item.fieldUID][j], subTable.fields);
                subRow[subFieldId] = formulaRuntime.evaluate(formula);
                row[item.fieldUID][j] = subRow;
              }
            } else {
              for(let j = 0; j < row[item.fieldUID].length; j++) {
                const subRow = row[item.fieldUID][j] || {};
                formula = replaceByFormula(colFormula, (keys) => {
                  const [sourceUID, fieldId, subFieldId] = keys;
                  const rows = getSourceRows(sourceUID);
                  const shouldNormalizeFormulaValues = this.isNumericFormulaSourceField(formulaSourceTables, sourceUID, fieldId, subFieldId)
                    && !emptyCheckReferenceKeys.has(keys.join(','));
                  if (isEmpty(rows)) return subFieldId ? [] : (shouldNormalizeFormulaValues ? 0 : null);
                  let fieldValue = rows[index > rows.length - 1 ? rows.length - 1 : index]?.[fieldId];
                  if (subFieldId) {
                    fieldValue = Array.isArray(fieldValue) ? fieldValue : [];
                    subformLength = fieldValue.length;
                    return normalizeFormulaNumericValue(fieldValue[fieldValue.length > j ? j : fieldValue.length - 1]?.[subFieldId], shouldNormalizeFormulaValues);
                  } else {
                    fieldValue = normalizeFormulaNumericValue(fieldValue, shouldNormalizeFormulaValues)
                    return fieldValue;
                  }
                })
                const formulaRuntime = createFormulaRuntimeByData(row[item.fieldUID][j], subTable.fields);
                subRow[subFieldId] = formulaRuntime.evaluate(formula);
                row[item.fieldUID][j] = subRow;
              }
            }
          } else {
            try {
              const formulaRuntime = createFormulaRuntimeByData(row, currentTable.fields);
                row[item.fieldUID] = formulaRuntime.evaluate(formula);
            } catch (err) {
              this.logger.error(`edit data evaluate formula error:`, err);
            }
          }
        } else if (item.type === TargetFieldFillType.EMPTY) {
          const isSubField = item.fieldUID?.split(".")?.length > 1;
          if (isSubField) {
            const [fieldId, subFieldId] = item.fieldUID.split(".");
            const subRows = getMatchedSubRows(fieldId);
            for (const subRow of subRows) {
              subRow[subFieldId] = null;
            }
            continue;
          }
          if (isSubField) {
            const [fieldId, subFieldId] = item.fieldUID.split(".");
            if (!row[fieldId]?.length) {
              row[fieldId] = [{}];
            }
            for (const subRow of row[fieldId]) {
              subRow[subFieldId] = null;
            }
          } else {
            row[item.fieldUID] = null;
          }
        } else if (item.type === TargetFieldFillType.AUTO_RELATED) {
          const isSubField = item.fieldUID?.split(".")?.length > 1;
          const value = [currentRow[uuidField.uid]];
          if(isSubField) {
            const [fieldId, subFieldId] = item.fieldUID.split(".");
            const subRows = getMatchedSubRows(fieldId);
            for(const subRow of subRows) {
              subRow[subFieldId] = value;
            }
            continue;
          }
          if(isSubField) {
            if(!row[item.fieldUID.split(".")[0]]?.length) {
              row[item.fieldUID.split(".")[0]] = [{}];
            }
            for(const f of row[item.fieldUID.split(".")[0]]) {
              f[item.fieldUID.split(".")[1]] = value;
            }
          } else {
            row[item.fieldUID] = value;
          }
        }
      }

      for (const item of defaultValueTargetFields) {
        const [fieldUID, subFieldUID] = item.fieldUID?.split('.') || [];
        if (fieldUID && subFieldUID) {
          getMatchedSubRows(fieldUID);
        }
      }
      editDefaultSubRowIndexesByRow[index] = { ...matchedSubRowIndexCache };
      return row;
    });

    await this.applyProcessDesignDefaults({
      rows,
      fieldUIDs: defaultValueTargetFields.map(item => item.fieldUID),
      targetNocodeId,
      targetFormData,
      targetTable,
      initiatorId,
      subRowIndexesByRow: editDefaultSubRowIndexesByRow,
    });

    let linkageFieldUIDs = new Set<string>();
    if (node.options?.allowLinkageFill) {
      const explicitFieldUIDs = new Set(
        targetFields.filter(item => item.type !== TargetFieldFillType.EMPTY).map(item => String(item.fieldUID)),
      );
      linkageFieldUIDs = await this.applyProcessLinkageFill(rows, targetFormData, targetNocodeId, targetTable, explicitFieldUIDs);
    }
    const linkageFields = [...linkageFieldUIDs]
      .map(fieldUID => resolveProcessTargetField(fieldUID, targetTable, targetFormData))
      .filter((field): field is Field => !!field);

    const isUseField = [
      ...targetFields
        .filter(item => item.type !== TargetFieldFillType.EMPTY)
        .map(item => resolveProcessTargetField(item.fieldUID, targetTable, targetFormData))
        .filter((field): field is Field => !!field),
      ...linkageFields,
    ];

    const formulaFields = getFormulaFields(isUseField, targetTable.fields, targetFormData.tables);

    try {
      rowsDefaultValueCalculation(rows, {formulaFields, defaultFields: []}, targetTable, targetFormData);
    } catch (err) {
      this.logger.error(`edit data formula calculation error:`, err);
    }
    this.normalizeProcessNumberFieldValues(
      rows,
      targetTable,
      formData,
      this.getProcessNumberNormalizationFieldUIDs(targetFields, [...formulaFields, ...linkageFields]),
    );

    const targetUUidField = getUUIDSystemField(targetTable.fields);
    const key: OptionFieldUID = [targetFormData.uid, targetTable.uid, targetUUidField.uid];
    await this.formDataService.validateTableUniqueRows(targetFormData, targetNocodeId, targetTable.uid, rows);
    const submitCheckResult = await this.checkSubmitRows(targetFormData, targetNocodeId, primaryTable, targetTable, rows);
    const skipReTrigger = await this.shouldSkipCurrentTableReTrigger(options, targetNocodeId, targetTable.uid);
    const deferCurrentFormTrigger = (options as PostFinishRuntimeTodoOptions).deferCurrentFormTrigger === true;
    const queueDerivedBatch = !deferCurrentFormTrigger && rows.length > 1;
    const triggerContext = await this.getCurrentFlowTriggerContext(options);
    const crossAppTriggerResult: FlowTriggerResult = {
      triggered: false,
    };
    const ignoreUpdatePermissionDataStatus = (
      targetTableDataScope === EditDataTargetScope.CURRENT
      && targetTable.uid === options.tableId
      && Boolean(operationTriggerStartMeta)
    );
    const prepareDerivedBatch = rows.length > 1 && (
      queueDerivedBatch
      || targetNocodeId !== options.nocodeId
      || targetTable.uid !== options.tableId
    );
    const derivedEventId = `flow-node:${options.todoId}:${(options as PostFinishRuntimeTodoOptions).mutationOccurrenceId || (options as PostFinishRuntimeTodoOptions).causedByTaskId}:edit`;
    const derivedIntent = prepareDerivedBatch
      ? await this.formDataService.prepareFlowDerivedPostMutation({
        eventId: derivedEventId,
        source: DataChangeType.EDIT,
        formData: targetFormData,
        nocodeId: targetNocodeId,
        tableUID: targetTable.uid,
        rows,
        beforeMutationRows: originalTargetRows,
        causedByTodoId: options.todoId,
        causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
      })
      : null;
    let updatedRows = deepClone(rows);
    let updateMutationCommitted = false;
    const updateData = async () => {
      try {
      const result = await (() => {
          const triggerOptions: TriggerOptions = {
            ...((!shouldTriggerTargetProcess || skipReTrigger || deferCurrentFormTrigger || queueDerivedBatch) ? { triggerTodo: false } : {}),
            allowDataOwnerUpdate: true,
            ignoreUpdatePermissionDataStatus,
            validatePermission: false,
            causedByTodoId: options.todoId,
            causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
            failOnPostMutationError: !!(options as PostFinishRuntimeTodoOptions).causedByTaskId,
          };
          if (triggerContext) {
            triggerOptions.triggerContext = triggerContext;
          }
          if (nodeImportTaskId) {
            triggerOptions.importTaskId = nodeImportTaskId;
          }
          if (resolvedTarget.isCrossAppTarget) {
            triggerOptions.crossAppTriggerResult = crossAppTriggerResult;
          }
          return this.formDataService.tryUpdateData(
            targetFormData,
            targetNocodeId,
            targetTable.uid,
            rows,
            [key],
            null,
            triggerOptions,
            {
              validateCurrentTable: true,
            },
          );
        })();
      updateMutationCommitted = true;
      const persistedRows = await this.loadPersistedMutationRows(targetFormData, targetNocodeId, targetTable, rows);
      updatedRows = deepClone(persistedRows);
      if (queueDerivedBatch && persistedRows.length) {
        await this.formDataService.enqueueFlowDerivedPostMutation({
          preparedTaskId: derivedIntent?.taskId,
          eventId: derivedEventId,
          source: DataChangeType.EDIT,
          formData: targetFormData,
          nocodeId: targetNocodeId,
          tableUID: targetTable.uid,
          rows: persistedRows,
          beforeMutationRows: originalTargetRows,
          triggerContext,
          causedByTodoId: options.todoId,
          causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
        });
      }
      return result;
      } catch (error) {
        if (updateMutationCommitted && error && typeof error === "object") {
          (error as Error & { mutationCommitted?: boolean }).mutationCommitted = true;
        }
        await this.formDataService.failFlowDerivedPostMutation(derivedIntent?.taskId, error);
        throw error;
      }
    };
    const rollbackEditedRows = async () => {
      await this.formDataService.restoreRowsFromSnapshot(
        targetFormData,
        targetNocodeId,
        targetTable.uid,
        deepClone(originalTargetRows),
        [key],
        "main",
        {
          allowDataOwnerUpdate: true,
        },
      );
    };
    if (isSubTargetTable) {
      await this.executeSubTableMutationWithPrimaryFormulaRollback(
        formData,
        options.nocodeId,
        currentRow,
        currentTable,
        primarySourceTable,
        updateData,
        rollbackEditedRows,
      );
      this.registerFlowCompensationAction(compensationContext, rollbackEditedRows);
      return {
        messages: submitCheckResult.messages,
        recordMeta: this.buildCrossAppTriggerMeta(resolvedTarget, DataChangeType.EDIT, crossAppTriggerResult),
        mutation: {
          action: DataChangeType.EDIT,
          preparedTaskId: derivedIntent?.taskId,
          targetNocodeId,
          targetTableId: targetTable.uid,
          beforeRows: originalTargetRows,
          afterRows: updatedRows,
          changedFieldUids: [...new Set([
            ...targetFields.map(item => item.fieldUID),
            ...linkageFieldUIDs,
          ])],
        },
      };
    }
    await updateData();
    this.registerFlowCompensationAction(compensationContext, rollbackEditedRows);
    return {
      messages: submitCheckResult.messages,
      recordMeta: this.buildCrossAppTriggerMeta(resolvedTarget, DataChangeType.EDIT, crossAppTriggerResult),
      mutation: {
        action: DataChangeType.EDIT,
        preparedTaskId: derivedIntent?.taskId,
        targetNocodeId,
        targetTableId: targetTable.uid,
        beforeRows: originalTargetRows,
        afterRows: updatedRows,
        changedFieldUids: [...new Set([
          ...targetFields.map(item => item.fieldUID),
          ...linkageFieldUIDs,
        ])],
      },
    };
  }

      // 不允许重复的检�?
  private async startDeleteDataNode(
    options: BaseTodoOptions,
    node: ProcessFlow,
    compensationContext?: FlowCompensationContext,
  ): Promise<DataProcessingNodeStartResult> {
    const { targetTableUID, primarySourceTable, targetTableFilterRule } = node.options;
    const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
    const formData = nocodeBody.formData;
    const currentTable = formData.tables.find(t => t.uid === options.tableId);
    const resolvedTarget = this.resolveProcessTargetTable(options.nocodeId, nocodeBody, targetTableUID);
    const { targetNocodeId, targetFormData, targetTable } = resolvedTarget;
    const shouldTriggerTargetProcess = this.shouldTriggerTargetProcess(node, options, resolvedTarget);
    const isSubTable = targetTable?.meta?.extra?.primaryTable && primarySourceTable;
    const nodeImportTaskId = options.importTaskId;
    if (!currentTable) {
      return {
        messages: [],
      };
    }
    await this.assertCrossAppWritePermission(nocodeBody, resolvedTarget, DataChangeType.DELETE);
    const currentRowContext = await this.resolveRuntimeCurrentRowContext(options, {
      formData,
      currentTable,
    });
    if (!currentRowContext?.currentRow) {
      return {
        messages: [],
      };
    }
    const { currentRow: row, hasPhysicalRow } = currentRowContext;
    if (!hasPhysicalRow && (isSubTable || (
      targetNocodeId === options.nocodeId
      && targetTable.uid === options.tableId
    ))) {
      throw this.createEmptyRowTriggerError(
        global.i18next.t('formFlowService.emptyRowDeleteCurrentNotSupported'),
        "delete-current-not-supported",
      );
    }

    let filters = {}
    if (isSubTable) {
      const keyField = targetTable.fields.find(f => f.meta.name === SystemField.KEY)
      const primaryTableUID = targetTable.meta.extra.primaryTable[1]
      const primaryTable = formData.tables.find(t => t.uid === primaryTableUID)
      if (!keyField || !primaryTable) {
        return {
          messages: [],
        };
      }
      const primaryUUID = getUUIDSystemField(primaryTable.fields).uid
      const primaryFilters = transformFilterRule(primarySourceTable.filterRule, row, { formulaRuntime: createFormulaRuntimeByData(row, currentTable.fields) });
      const res = await this.formDataService._distinct(formData, options.nocodeId, primaryTableUID, primaryUUID, {
        filters: {
          [primaryTableUID]: [primaryFilters],
        },
      })

      filters = {
        [targetTableUID]: [{
          [keyField.uid]: res.map(item => item.value).filter(Boolean),
        }]
      };
    }
    const targetRows = await this.getTableRows(nocodeBody, options.nocodeId, targetTableUID, targetTableFilterRule, row, {
      fillSubTable: false,
      formulaRuntime: createFormulaRuntimeByData(row, currentTable.fields),
      stage: this.getDefaultReadableStageCondition(),
      filters,
    });
    if (isEmpty(targetRows)) {
      return {
        messages: [],
      };
    }
    const originalTargetRows = await this.formDataService.fillSubFormField(
      deepClone(targetRows),
      targetNocodeId,
      targetTable,
      targetFormData,
      {},
      false,
      false,
      "main",
      true,
      undefined,
      this.getDefaultReadableStageCondition(),
    );
    const targetUUidField = getUUIDSystemField(targetTable.fields);
    const key: OptionFieldUID = [targetFormData.uid, targetTable.uid, targetUUidField.uid];
    const skipReTrigger = await this.shouldSkipCurrentTableReTrigger(options, targetNocodeId, targetTable.uid);
    const deferCurrentFormTrigger = (options as PostFinishRuntimeTodoOptions).deferCurrentFormTrigger === true;
    const queueDerivedBatch = !deferCurrentFormTrigger && targetRows.length > 1;
    const prepareDerivedBatch = targetRows.length > 1 && (
      queueDerivedBatch
      || targetNocodeId !== options.nocodeId
      || targetTable.uid !== options.tableId
    );
    const deleteOptions: TriggerOptions = {
      ...((!shouldTriggerTargetProcess || skipReTrigger || deferCurrentFormTrigger || queueDerivedBatch) ? { triggerTodo: false } : {}),
      validatePermission: false,
      causedByTodoId: options.todoId,
      causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
      skipCancelInProgressTodos: true,
      failOnPostMutationError: !!(options as PostFinishRuntimeTodoOptions).causedByTaskId,
      ...(deferCurrentFormTrigger ? {
        deleteStage: FormDataStage.DELETING,
      } : {}),
    };
    const triggerContext = await this.getCurrentFlowTriggerContext(options);
    const crossAppTriggerResult: FlowTriggerResult = {
      triggered: false,
    };
    const derivedEventId = `flow-node:${options.todoId}:${(options as PostFinishRuntimeTodoOptions).mutationOccurrenceId || (options as PostFinishRuntimeTodoOptions).causedByTaskId}:delete`;
    const derivedIntent = prepareDerivedBatch
      ? await this.formDataService.prepareFlowDerivedPostMutation({
        eventId: derivedEventId,
        source: DataChangeType.DELETE,
        formData: targetFormData,
        nocodeId: targetNocodeId,
        tableUID: targetTable.uid,
        rows: originalTargetRows,
        beforeMutationRows: originalTargetRows,
        causedByTodoId: options.todoId,
        causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
      })
      : null;
    if (triggerContext) {
      deleteOptions.triggerContext = triggerContext;
    }
    if (nodeImportTaskId) {
      deleteOptions.importTaskId = nodeImportTaskId;
    }
    if (resolvedTarget.isCrossAppTarget) {
      deleteOptions.crossAppTriggerResult = crossAppTriggerResult;
    }
    let deleteResult: any;
    let deleteMutationCommitted = false;
    const deleteData = async () => {
      try {
      deleteResult = await this.formDataService.tryDeleteData(targetFormData, targetNocodeId, targetTable.uid, targetRows, [key], deleteOptions);
      deleteMutationCommitted = deleteResult?.mutationApplied === true || deleteResult?.success === true;
      if (queueDerivedBatch) {
        await this.formDataService.enqueueFlowDerivedPostMutation({
          preparedTaskId: derivedIntent?.taskId,
          eventId: derivedEventId,
          source: DataChangeType.DELETE,
          formData: targetFormData,
          nocodeId: targetNocodeId,
          tableUID: targetTable.uid,
          rows: originalTargetRows,
          beforeMutationRows: originalTargetRows,
          triggerContext,
          causedByTodoId: options.todoId,
          causedByTaskId: (options as PostFinishRuntimeTodoOptions).causedByTaskId,
        });
      }
      return deleteResult;
      } catch (error) {
        if (deleteMutationCommitted && error && typeof error === "object") {
          (error as Error & { mutationCommitted?: boolean }).mutationCommitted = true;
        }
        await this.formDataService.failFlowDerivedPostMutation(derivedIntent?.taskId, error);
        throw error;
      }
    };
    if (isSubTable) {
      await this.executeSubTableMutationWithPrimaryFormulaRollback(
        formData,
        options.nocodeId,
        row,
        currentTable,
        primarySourceTable,
        deleteData,
        async () => {
          await this.formDataService.restoreRowsFromSnapshot(
            targetFormData,
            targetNocodeId,
            targetTable.uid,
            deepClone(originalTargetRows),
            [key],
            "main",
            { triggerTodo: false, allowDataOwnerUpdate: true, ignoreUpdatePermissionDataStatus: true },
          );
        },
        {
          isMutationCommitted: (res) => res?.mutationApplied === true,
        },
      );
      this.registerFlowCompensationAction(compensationContext, async () => {
        await this.formDataService.restoreRowsFromSnapshot(
          targetFormData,
          targetNocodeId,
          targetTable.uid,
          deepClone(originalTargetRows),
          [key],
          "main",
          { triggerTodo: false, allowDataOwnerUpdate: true, ignoreUpdatePermissionDataStatus: true },
        );
      });
      return {
        messages: [],
        recordMeta: this.buildCrossAppTriggerMeta(resolvedTarget, DataChangeType.DELETE, crossAppTriggerResult),
        mutation: {
          action: DataChangeType.DELETE,
          preparedTaskId: derivedIntent?.taskId,
          targetNocodeId,
          targetTableId: targetTable.uid,
          beforeRows: originalTargetRows,
          afterRows: [],
        },
      };
    }
    await deleteData();
    this.registerFlowCompensationAction(compensationContext, async () => {
      await this.formDataService.restoreRowsFromSnapshot(
        targetFormData,
        targetNocodeId,
        targetTable.uid,
        deepClone(originalTargetRows),
        [key],
        "main",
        { triggerTodo: false, allowDataOwnerUpdate: true, ignoreUpdatePermissionDataStatus: true },
      );
    });
    if (isSubTable) {
      // 需要对主表进行一次公式检查的更改
    }
    return {
      messages: [],
      recordMeta: this.buildCrossAppTriggerMeta(resolvedTarget, DataChangeType.DELETE, crossAppTriggerResult),
      mutation: {
        action: DataChangeType.DELETE,
        preparedTaskId: derivedIntent?.taskId,
        targetNocodeId,
        targetTableId: targetTable.uid,
        beforeRows: originalTargetRows,
        afterRows: [],
      },
    };
  }

  private getFlowErrorMessage(err: unknown) {
    if (this.isFlowFormulaEmptyValueError(err)) {
      return global.i18next.t('formFlowService.formulaValueEmpty');
    }
    return err instanceof Error ? err.message : String(err);
  }

  private getPrimaryTableFormulaFields(table: Table) {
    return table.fields.filter(field => {
      if (field.meta?.subType === "subForm") {
        return false;
      }
      return !isSystemField(field)
        && field.meta?.extra?.defaultValueType == 'formula'
        && !isEmpty(getFormulaStr(field.meta?.extra?.formula));
    });
  }

  private async refreshPrimaryTableFormulaRows(
    formData: NocodeFormData,
    nocodeId: string,
    currentRow: Row,
    currentTable: Table,
    primarySourceTable?: { tableUID?: TableUID; filterRule?: FilterRule } | null,
  ) {
    if (!primarySourceTable?.tableUID) {
      return;
    }

    const nocodeBody = await this.getFlowNocodeBody(nocodeId, formData);
    const rows = await this.getTableRows(nocodeBody, nocodeId, primarySourceTable.tableUID, primarySourceTable.filterRule, currentRow, {
      fillSubTable: true,
      formulaRuntime: createFormulaRuntimeByData(currentRow, currentTable.fields),
    });
    const primaryTable = formData.tables.find(t => t.uid === primarySourceTable.tableUID);
    if (!primaryTable || isEmpty(rows)) {
      return;
    }

    rowsDefaultValueCalculation(rows, {
      formulaFields: this.getPrimaryTableFormulaFields(primaryTable),
      defaultFields: [],
    }, primaryTable, formData);
    const uuidField = getUUIDSystemField(primaryTable.fields);
    await this.formDataService.updateData(
      formData,
      nocodeId,
      primarySourceTable.tableUID,
      rows,
      [[ formData.uid, primaryTable.uid, uuidField.uid ]],
      null,
      "main",
      {
        validateCurrentTable: true,
      },
    );
  }

  private async createNodeCommentRecord(
    options: BaseTodoOptions,
    node: ProcessFlow,
    status: ProcessNodeStatus,
    comment = "",
    extraMeta: Record<string, unknown> = {},
  ) {
    const record = await this.createRecord(options, node, status);
    const account = await this.formDataService.getAccount();
    if (status === ProcessNodeStatus.IN_PROGRESS && isDataProcessingNode(node.type)) {
      record.paddingOperators = [account.id];
      record.operators = [];
    }
    const meta: Record<string, unknown> = {
      ...extraMeta,
    };
    if (comment) {
      meta.comment = comment;
    }
    if (!isEmpty(meta)) {
      record.metas = {
        [account.id]: meta as any,
      };
    }
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
    return record;
  }

  private async createDataProcessingRecord(
    options: BaseTodoOptions,
    node: ProcessFlow,
    status: ProcessNodeStatus,
    comment = "",
    tip = "",
    extraMeta: Record<string, unknown> = {},
  ) {
    const { targetTableUID } = node.options || {};
    return await this.createNodeCommentRecord(options, node, status, comment, {
      targetTableUID,
      ...(tip ? { tip } : {}),
      ...extraMeta,
    });
  }

  private async finishDataProcessingRecord(
    record: FlowExecutionRecords,
    node: ProcessFlow,
    status: ProcessNodeStatus,
    comment = "",
    tip = "",
    extraMeta: Record<string, unknown> = {},
  ) {
    const account = await this.formDataService.getAccount();
    const { targetTableUID } = node.options || {};
    const metas = record.metas || {};
    const meta: Record<string, unknown> = {
      ...(metas[account.id] || {}),
      targetTableUID,
      ...(tip ? { tip } : {}),
      ...extraMeta,
    };
    if (comment) {
      meta.comment = comment;
    }
    record.status = status;
    record.endTime = Date.now();
    record.metas = {
      ...metas,
      [account.id]: meta as any,
    };
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
    return record;
  }

  private async rejectNodeWithComment(
    options: BaseTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow,
    comment: string,
    extraMeta: Record<string, unknown> = {},
    existingRecord?: FlowExecutionRecords,
  ) {
    if (existingRecord) {
      await this.finishDataProcessingRecord(
        existingRecord,
        node,
        ProcessNodeStatus.REJECTED,
        comment,
        "",
        extraMeta,
      );
    } else {
      await this.createNodeCommentRecord(options, node, ProcessNodeStatus.REJECTED, comment, extraMeta);
    }
    const endNode = nodes.at(-1);
    if (endNode && endNode.uid !== node.uid) {
      await this.createRecord(options, endNode, ProcessNodeStatus.REJECTED);
    }
    await this.discardPostFinishPlanAndRollback(options, "terminal_reject");
    await this.updateFlowData(options, { stage: FormDataStage.NORMAL, status: ProcessNodeStatus.REJECTED, node: { type: "update", value: [] } });
    await this.clearSkipNodeIds(options.todoId);
  }

  private async rejectDataProcessingNode(
    options: BaseTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow,
    comment: string,
    extraMeta: Record<string, unknown> = {},
    existingRecord?: FlowExecutionRecords,
  ) {
    const { targetTableUID } = node.options || {};
    await this.rejectNodeWithComment(options, nodes, node, comment, {
      targetTableUID,
      ...extraMeta,
    }, existingRecord);
  }

  private async updateFlowData(options: BaseTodoOptions, data: UpdateFlowData) {
    await this.assertScheduledLease(options);
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(t => t.uid === options.tableId);
    const startRecord = await this.getStartRecord(options);
    if (this.isEmptyRowTrigger(startRecord)) {
      return;
    }
    const uuidField = getUUIDSystemField(table.fields);
    const isDeleteTriggered = this.isDeleteTriggeredStartRecord(startRecord);
    const deleteStage = isDeleteTriggered ? [FormDataStage.DELETED] : [];
    let stageFilter: FormDataStageWhereCondition = {
      $in: [FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING, FormDataStage.NORMAL, ...deleteStage]
    };
    if (data.stage === FormDataStage.NORMAL) {  // 更新为正常阶段
      stageFilter = {
        $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING, ...deleteStage]
      }
    } else if (data.stage) {
      // 首次删除流程状态更新的来源可能已经是 DELETED；普通流程仍沿用提交态匹配。
      stageFilter = isDeleteTriggered
        ? { $in: [FormDataStage.NORMAL, FormDataStage.ADDING, FormDataStage.EDITING, FormDataStage.DELETING, FormDataStage.DELETED] }
        : FormDataStage.NORMAL;
    }
    const buckets = await this.formDataService._getData(formData, [options.tableId], options.nocodeId, {
      filters: {
        [options.tableId]: [{
          [uuidField.uid]: options.uuid,
        }]
      },
      stage: stageFilter,
    });
    const rows = buckets[0]?.rows || [];
    if (isEmpty(rows)) return;
    const nodeField = table.fields.find(field => field.meta.name === SystemField.CURRENT_NODE);
    const statusField = table.fields.find(field => field.meta.name === SystemField.STATUS);
    const updateRows = rows.map(row => {
      const nextRow = {
        [uuidField.uid]: row[uuidField.uid],
      };
      if (data.node) {
        const currentNodeIds = Array.isArray(row[nodeField.uid])
          ? [...row[nodeField.uid]]
          : row[nodeField.uid] ? String(row[nodeField.uid]).split(",") : [];
        const value = data.node.value;
        if (data.node.type === "add") {
          currentNodeIds.push(...value);
        } else if (data.node.type === "delete") {
          nextRow[nodeField.uid] = currentNodeIds.filter(item => !value.includes(item));
        } else if (data.node.type === "update") {
          nextRow[nodeField.uid] = value;
        }
        nextRow[nodeField.uid] = Array.from(new Set((nextRow[nodeField.uid] || currentNodeIds).filter(Boolean)));
      }
      if (data.status) {
        nextRow[statusField.uid] = data.status;
      }
      if (data.todoId) {
        nextRow[SystemField.TODO_ID] = data.todoId;
      }
      if (data.version) {
        nextRow[SystemField.TODO_VERSION] = data.version;
      }
      return nextRow;
    });
    const stageField = table.fields.find(field => field.meta.name === SystemField.DATA_STAGE);
    const currentStage = stageField?.uid
      ? rows[0]?.[stageField.uid]
      : rows[0]?.[SystemField.DATA_STAGE];
    // 删除流程的记录已先进入回收站；后台开始流程时只更新流程状态，不能改回 DELETING，否则会重新出现在主表。
    const stageToApply = isDeleteTriggered
      && data.stage === FormDataStage.DELETING
      && currentStage === FormDataStage.DELETED
      ? undefined
      : data.stage;
    await this.assertScheduledLease(options);
    await this.formDataService.updateData(
      formData,
      options.nocodeId,
      options.tableId,
      updateRows,
      [[formData.uid, table.uid, uuidField.uid]],
      stageToApply,
      "main",
      {
        skipValidation: true,
        skipLock: true,
        skipSubTableSync: true,
        skipSubTableDeduplicationRebuild: true,
      },
    );
  }

  private async executeTerminalFlowNode(
    options: BaseTodoOptions,
    node: ProcessFlow,
  ) {
    const finalStatus = await this.getTodoFinalStatus(options);
    const displayRowSnapshot = await this.captureTodoDisplaySnapshot(options);
    const postFinishPlan = finalStatus === ProcessNodeStatus.FINISHED
      ? await this.preparePostFinishPlan(options, displayRowSnapshot)
      : null;
    await this.createRecord(options, node, finalStatus);
    const startRecord = await this.getStartRecord(options);
    const meta = Object.values(startRecord?.metas || {}).find(meta => meta?.source);
    if (meta?.source === TODOTriggerType.DELETE) {
      await this.applyFinishedFlowResult(options, finalStatus);
    } else {
      const updateData: UpdateFlowData = { status: finalStatus, node: { type: "update", value: [] } };
      if (!(await this.isRuntimeCurrentRowInStage(options, FormDataStage.DELETING, startRecord))) {
        updateData.stage = FormDataStage.NORMAL;
      }
      await this.updateFlowData(options, updateData);
    }
    await this.finalizeCurrentProcessRowDelete(options);
    if (options.todoId) {
      await this.updateFlowExecutionContext(options.todoId, { finalStatus });
    }
    await this.clearSkipNodeIds(options.todoId);
    await this.activatePostFinishPlan(postFinishPlan);
  }

  private getWorkerNodeStepKey(todoId: string, nodeId: string) {
    return `node:${todoId}:${nodeId}`;
  }

  private createWorkerNodeStepError(code: string, message: string) {
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    return error;
  }

  private setWorkerNodeStepActive(taskId: string, step: FlowNodeExecutionStep, active: boolean) {
    let steps = this.activeWorkerNodeSteps.get(taskId);
    if (active) {
      if (!steps) {
        steps = new Map();
        this.activeWorkerNodeSteps.set(taskId, steps);
      }
      steps.set(step.idempotencyKey, step);
      return;
    }
    steps?.delete(step.idempotencyKey);
    if (!steps?.size) this.activeWorkerNodeSteps.delete(taskId);
  }

  private async beginWorkerNodeStep(
    options: WorkerNodeTodoOptions,
    step: FlowNodeExecutionStep,
  ): Promise<WorkerNodeStepBeginResult> {
    const context = options.flowWorkerContext;
    if (!context || !options.todoId) {
      throw this.createWorkerNodeStepError("FLOW_NODE_STEP_CONTEXT_MISSING", "Flow worker node context is missing");
    }
    const em = this.orm.em.fork();
    const transactional = (em as unknown as {
      transactional?: (callback: (tx: EntityManager) => Promise<WorkerNodeStepBeginResult>) => Promise<WorkerNodeStepBeginResult>;
    }).transactional;
    if (!transactional) {
      throw this.createWorkerNodeStepError("FLOW_NODE_STEP_STORE_UNAVAILABLE", "Flow worker node step store is unavailable");
    }
    const stepKey = this.getWorkerNodeStepKey(options.todoId, step.nodeId);
    const readExisting = async (): Promise<WorkerNodeStepBeginResult | undefined> => {
      const existing = await em.findOne(FlowTaskStepExecution, { taskId: context.taskId, stepKey });
      return existing ? {
        status: existing.status,
        owned: false,
        stop: (existing.resultSnapshot as { stop?: boolean } | undefined)?.stop === true,
        nextNodeIds: (existing.resultSnapshot as { nextNodeIds?: string[] } | undefined)?.nextNodeIds,
      } : undefined;
    };
    const startedAt = Date.now();
    const phaseDurationMs: Record<string, number> = {};
    let phaseStartedAt = startedAt;
    const markPhase = (name: string) => {
      const now = Date.now();
      phaseDurationMs[name] = now - phaseStartedAt;
      phaseStartedAt = now;
    };
    try {
      const result = await transactional.call(em, async tx => {
        markPhase("transaction-wait");
        const now = Date.now();
        const task = await tx.findOne(ViewActionTriggerTask, {
          id: context.taskId,
          status: "running",
          leaseOwner: context.leaseOwner,
          leaseVersion: context.leaseVersion,
          leaseUntil: { $gt: now },
        });
        markPhase("load-task");
        if (!task) {
          throw this.createWorkerNodeStepError("FLOW_LEASE_LOST", "Flow worker task lease is no longer valid");
        }
        const existing = await tx.findOne(FlowTaskStepExecution, { taskId: context.taskId, stepKey });
        markPhase("load-step");
        if (existing) return {
          status: existing.status,
          owned: false,
          stop: (existing.resultSnapshot as { stop?: boolean } | undefined)?.stop === true,
          nextNodeIds: (existing.resultSnapshot as { nextNodeIds?: string[] } | undefined)?.nextNodeIds,
        };
        const execution = tx.create(FlowTaskStepExecution, {
          taskId: context.taskId,
          stepKey,
          idempotencyKey: step.idempotencyKey,
          status: "started",
          attempt: task.attemptCount || 1,
          leaseOwner: context.leaseOwner,
          leaseVersion: context.leaseVersion,
          startedAt: now,
          updatedAt: now,
        });
        tx.persist(execution);
        await tx.flush();
        markPhase("flush-step");
        return { status: "started", owned: true };
      });
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 500) {
        this.logger.warn(`[flow-node-step-begin] ${JSON.stringify({ durationMs, phaseDurationMs })}`);
      }
      return result;
    } catch (error) {
      // A concurrent insert can lose the unique(taskId, stepKey) race. Reuse
      // its durable state instead of attempting the node side effect again.
      if (!(error instanceof UniqueConstraintViolationException)) throw error;
      const existing = await readExisting();
      if (existing) return existing;
      throw error;
    }
  }

  private async completeWorkerNodeStep(
    options: WorkerNodeTodoOptions,
    step: FlowNodeExecutionStep,
    result: FlowWorkerNodeGatewayResult,
  ) {
    const context = options.flowWorkerContext;
    if (!context || !options.todoId) return false;
    const em = this.orm.em.fork();
    const transactional = (em as unknown as {
      transactional?: (callback: (tx: EntityManager) => Promise<boolean>) => Promise<boolean>;
    }).transactional;
    if (!transactional) return false;
    const stepKey = this.getWorkerNodeStepKey(options.todoId, step.nodeId);
    return await transactional.call(em, async tx => {
      const now = Date.now();
      const fenced = await tx.nativeUpdate(ViewActionTriggerTask, {
        id: context.taskId,
        status: "running",
        leaseOwner: context.leaseOwner,
        leaseVersion: context.leaseVersion,
        leaseUntil: { $gt: now },
      }, { updatedAt: now });
      if (fenced !== 1) return false;
      const updated = await tx.nativeUpdate(FlowTaskStepExecution, {
        taskId: context.taskId,
        stepKey,
        status: "started",
        leaseOwner: context.leaseOwner,
        leaseVersion: context.leaseVersion,
      }, {
        status: "succeeded",
        resultSnapshot: {
          nodeId: step.nodeId,
          action: step.action,
          stop: result.stop,
          nextNodeIds: result.nextNodeIds,
        },
        errorCode: null,
        errorMessage: null,
        finishedAt: now,
        updatedAt: now,
      });
      if (updated === 1) return true;
      const existing = await tx.findOne(FlowTaskStepExecution, { taskId: context.taskId, stepKey });
      return existing?.status === "succeeded";
    });
  }

  private async markWorkerNodeStepUnknown(
    options: WorkerNodeTodoOptions,
    step: FlowNodeExecutionStep,
    error: unknown,
  ) {
    const context = options.flowWorkerContext;
    if (!context || !options.todoId) return;
    const em = this.orm.em.fork();
    const now = Date.now();
    await em.nativeUpdate(FlowTaskStepExecution, {
      taskId: context.taskId,
      stepKey: this.getWorkerNodeStepKey(options.todoId, step.nodeId),
      status: "started",
      leaseOwner: context.leaseOwner,
      leaseVersion: context.leaseVersion,
    }, {
      status: "unknown",
      errorCode: "FLOW_NODE_STEP_RESULT_UNKNOWN",
      errorMessage: this.getFlowErrorMessage(error).slice(0, 2000),
      finishedAt: now,
      updatedAt: now,
    });
  }

  private async executeWorkerFlowNode(
    options: WorkerNodeTodoOptions,
    nodes: ProcessFlow[],
    step: FlowNodeExecutionStep,
    initiatorId: string,
    compensationContext?: FlowCompensationContext,
  ) {
    // Serialize duplicate delivery of the same worker step in this process.
    // The durable task lease still owns crash recovery; this lock prevents a
    // late RPC and a concurrent retry from entering the side effect together.
    return await this.lock.acquire(`flow-worker-step:${step.idempotencyKey}`, async () => {
      const begin = await this.beginWorkerNodeStep(options, step);
      if (begin.status === "succeeded") {
        return { stop: begin.stop === true, nextNodeIds: begin.nextNodeIds || [] };
      }
      if (!begin.owned) {
        throw this.createWorkerNodeStepError(
          begin.status === "failed" ? "FLOW_NODE_STEP_FAILED" : "FLOW_NODE_STEP_RESULT_UNKNOWN",
          `Flow worker node step cannot be replayed: ${step.nodeId}:${begin.status}`,
        );
      }
      const context = options.flowWorkerContext!;
      this.setWorkerNodeStepActive(context.taskId, step, true);
      try {
        let stop = false;
        await this.assertScheduledLease(options);
        const node = getFlowById(nodes, step.nodeId);
        if (!node || node.type !== step.nodeType) throw new Error("Flow worker node identity mismatch");
        const continuation = { nextNodeIds: [] as string[] };
        const workerOptions = { ...options, flowWorkerContinuation: continuation };
        if (step.action === "skip") {
          await this.createRecord(options, node, ProcessNodeStatus.SKIPPED);
          const branchFlow = getOwnerBranchFlow(nodes, node.uid);
          if (branchFlow?.type === ProcessNodeType.PARALLEL_BRANCH) {
            const branch = branchFlow.branches.find(item => getFlowById(item.flows, node.uid));
            const lastNode = branch?.flows.at(-1);
            if (branch && lastNode?.uid === node.uid) {
              const isFinish = await this.completeParallelBranch(options, branchFlow, branch.flows[0].uid);
              if (!isFinish) stop = true;
            }
          }
          if (!stop) {
            await this.continueFlowAtNode(workerOptions, nodes, getNextFlow(nodes, node.uid), initiatorId);
          }
        } else if (step.action === "auto-approval") {
          await this.createRecord(options, node, ProcessNodeStatus.FINISHED);
          await this.continueFlowAtNode(workerOptions, nodes, getNextFlow(nodes, node.uid), initiatorId);
        } else if (step.action === "notify") {
          try {
            await this.startNotifyNode(options, node, initiatorId);
          } catch (error) {
            if (this.isEmptyRowTriggerError(error)) {
              this.logger.error(`start notify node error: ${node.type}`, error);
              await this.rejectNodeWithComment(options, nodes, node, this.getFlowErrorMessage(error));
              stop = true;
            } else {
              throw error;
            }
          }
          if (!stop) {
            await this.continueFlowAtNode(workerOptions, nodes, getNextFlow(nodes, node.uid), initiatorId);
          }
        } else if (step.action === "terminal") {
          await this.executeTerminalFlowNode(options, node);
          stop = true;
        } else if (step.action === "execute") {
          await this.addNextNode(workerOptions, nodes, node, initiatorId, compensationContext);
        } else {
          throw new Error(`Unsupported flow worker node action: ${step.action}`);
        }
        if (step.action === "execute" && continuation.nextNodeIds.length === 0) {
          stop = true;
        }
        const result = { stop, nextNodeIds: continuation.nextNodeIds };
        if (!(await this.completeWorkerNodeStep(options, step, result))) {
          throw this.createWorkerNodeStepError("FLOW_NODE_STEP_COMMIT_REJECTED", "Flow worker node result could not be fenced");
        }
        return result;
      } catch (error) {
        await this.markWorkerNodeStepUnknown(options, step, error);
        throw error;
      } finally {
        this.setWorkerNodeStepActive(context.taskId, step, false);
      }
    });
  }

  private async tryExecuteWorkerFlowNodes(
    options: WorkerNodeTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow,
    initiatorId: string,
    compensationContext?: FlowCompensationContext,
  ): Promise<boolean> {
    const context = options.flowWorkerContext;
    if (!context || !options.todoId || !this.flowWorkerPool
      || (process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool") !== "tinypool") {
      return false;
    }
    try {
      const result = await this.flowWorkerPool.executeFlowNodes(
        {
          taskId: context.taskId,
          todoId: options.todoId,
          leaseOwner: context.leaseOwner,
          leaseVersion: context.leaseVersion,
          flows: buildFlowNodeExecutionSnapshot(nodes),
          startNodeId: node.uid,
          skipNodeIds: options.skipNodeIds,
        },
        async step => await this.executeWorkerFlowNode(options, nodes, step, initiatorId, compensationContext),
        context.queueClass || "p1",
      );
      return result.handled;
    } catch (error) {
      const activeSteps = [...(this.activeWorkerNodeSteps.get(context.taskId)?.values() || [])];
      await Promise.all(activeSteps.map(async step => {
        await this.markWorkerNodeStepUnknown(options, step, error);
      }));
      throw error;
    }
  }

  private async addNextNode(
    options: WorkerNodeTodoOptions,
    nodes: ProcessFlow[],
    node: ProcessFlow,
    initiatorId: string,
    compensationContext?: FlowCompensationContext,
  ) {
    if (!node) return;
    await this.assertScheduledLease(options);

    if (!Array.isArray(options.skipNodeIds) && options.todoId) {
      const context = await this.flowExecutionContextRepository.findOne({ todoId: options.todoId });
      if (Array.isArray(context?.skipNodeIds)) {
        options = {
          ...options,
          skipNodeIds: context.skipNodeIds,
        };
      }
    }

    if (!options.flowWorkerContinuation
      && await this.tryExecuteWorkerFlowNodes(options, nodes, node, initiatorId, compensationContext)) {
      return;
    }

    if (options.skipNodeIds?.includes(node.uid)) {
      await this.createRecord(options, node, ProcessNodeStatus.SKIPPED);
      const branchFlow = getOwnerBranchFlow(nodes, node.uid);
      if (branchFlow && branchFlow?.type === ProcessNodeType.PARALLEL_BRANCH) {
        const branch = branchFlow.branches.find(b => getFlowById(b.flows, node.uid));
        const lastNode = branch.flows.at(-1);
        if (lastNode.uid === node.uid) {
          const isFinish = await this.completeParallelBranch(options, branchFlow, branch.flows[0].uid);
          if (!isFinish) return;
        }
      }

      const nextNode = getNextFlow(nodes, node.uid);
      if (nextNode) {
        await this.continueFlowAtNode(options, nodes, nextNode, initiatorId, compensationContext);
      }
      return;
    }

    let toNext = false;
    if (node.type === ProcessNodeType.APPROVAL) {
      const { category } = node.options;
      if (category === ApprovalCategory.AUTO_APPROVE) {
        await this.createRecord(options, node, ProcessNodeStatus.FINISHED);
        toNext = true;
      } else if (category === ApprovalCategory.AUTO_REJECT) {
        await this.createRecord(options, node, ProcessNodeStatus.REJECTED);
        await this.createRecord(options, nodes.at(-1), ProcessNodeStatus.REJECTED);
        // const startRecord = await this.getStartRecord(options);
        // const meta = Object.values(startRecord.metas).find(meta => meta.source);
        // if (meta.source === TODOTriggerType.ADD) {
        //   await this.formDataService.deleteDataByUUID(options.nocodeId, options.tableId, options.uuid);
        // } else {
        // }
        await this.discardPostFinishPlanAndRollback(options, "terminal_reject");
        await this.updateFlowData(options, { stage: FormDataStage.NORMAL, status: ProcessNodeStatus.REJECTED, node: { type: "update", value: [] } });
      } else {
        let record: FlowExecutionRecords;
        try {
          record = await this.startApprovalNode(options, node, initiatorId);
        } catch (err) {
          if (this.isEmptyRowTriggerError(err)) {
            this.logger.error(`start approval node error: ${node.type}`, err);
            await this.rejectNodeWithComment(options, nodes, node, this.getFlowErrorMessage(err));
            return;
          }
          throw err;
        }
        if (record.status === ProcessNodeStatus.FINISHED) {
          toNext = true;
        }
      }
    } else if (node.type === ProcessNodeType.TRANSACT) {
      try {
        await this.startTransactNode(options, node, initiatorId);
      } catch (err) {
        if (this.isEmptyRowTriggerError(err)) {
          this.logger.error(`start transact node error: ${node.type}`, err);
          await this.rejectNodeWithComment(options, nodes, node, this.getFlowErrorMessage(err));
          return;
        }
        throw err;
      }
    } else if (node.type === ProcessNodeType.NOTIFY) {
      try {
        await this.startNotifyNode(options, node, initiatorId);
      } catch (err) {
        if (this.isEmptyRowTriggerError(err)) {
          this.logger.error(`start notify node error: ${node.type}`, err);
          await this.rejectNodeWithComment(options, nodes, node, this.getFlowErrorMessage(err));
          return;
        }
        throw err;
      }
      toNext = true;
    } else if (node.type === ProcessNodeType.REPORT_DATA) {
      try {
        await this.startReportDataNode(options, node, initiatorId);
      } catch (err) {
        if (this.isEmptyRowTriggerError(err)) {
          this.logger.error(`start report data node error: ${node.type}`, err);
          await this.rejectNodeWithComment(options, nodes, node, this.getFlowErrorMessage(err));
          return;
        }
        throw err;
      }
    } else if (isDataProcessingNode(node.type)) {
      let startResult: DataProcessingNodeStartResult = {
        messages: [],
      };
      let processingRecord: FlowExecutionRecords | null = null;
      try {
        const nocodeBody = await this.getFlowNocodeBody(options.nocodeId);
        const resolvedTarget = this.resolveProcessTargetTable(options.nocodeId, nocodeBody, node.options?.targetTableUID);
        const isCurrentFormTarget = this.isCurrentProcessFormTarget(options, nocodeBody.formData, resolvedTarget);
        const shouldTriggerTargetProcess = node.options?.triggerTargetProcess ?? !isCurrentFormTarget;
        const crossTableExecutionMode = isCurrentFormTarget
          ? CrossTableExecutionMode.IMMEDIATE
          : await this.getInstanceCrossTableExecutionMode(options, nodes);
        const waitCrossTableFlowCompletion = !isCurrentFormTarget && crossTableExecutionMode === CrossTableExecutionMode.IMMEDIATE
          ? await this.getInstanceWaitCrossTableFlowCompletion(options, nodes)
          : false;
        if (!isCurrentFormTarget && crossTableExecutionMode !== CrossTableExecutionMode.IMMEDIATE) {
          await this.assertCrossAppWritePermission(nocodeBody, resolvedTarget, this.getDataProcessingAction(node.type));
          const task = await this.queuePostFinishTask(options, nodes, node, resolvedTarget, "data_action");
          startResult.recordMeta = {
            postFinishTaskId: task?.id,
            postFinishTaskStatus: task?.status,
          };
        } else {
          processingRecord = await this.createDataProcessingRecord(
            options,
            node,
            ProcessNodeStatus.IN_PROGRESS,
          );
          await this.updateFlowData(options, {
            status: ProcessNodeStatus.IN_PROGRESS,
            node: { type: "add", value: [node.uid] },
          });
          const occurrenceId = unique(32);
          const immediateOptions: PostFinishRuntimeTodoOptions = {
            ...options,
            deferCurrentFormTrigger: true,
            mutationOccurrenceId: occurrenceId,
          };
          if (node.type === ProcessNodeType.ADD_DATA) {
            startResult = await this.startAddDataNode(immediateOptions, node, initiatorId, compensationContext);
          } else if (node.type === ProcessNodeType.EDIT_DATA) {
            startResult = await this.startEditDataNode(immediateOptions, node, initiatorId, compensationContext);
          } else if (node.type === ProcessNodeType.DELETE_DATA) {
            startResult = await this.startDeleteDataNode(immediateOptions, node, compensationContext);
          }
          if (startResult.mutation && isCurrentFormTarget) {
            const mutationRecord = await this.recordImmediateMutation(options.todoId, "current_form_node", startResult.mutation, occurrenceId);
            const triggerRows = startResult.mutation.action === DataChangeType.DELETE
              ? startResult.mutation.beforeRows
              : startResult.mutation.afterRows;
            for (let index = 0; index < triggerRows.length && shouldTriggerTargetProcess; index++) {
              const triggerRow = triggerRows[index];
              const triggerUUID = this.getRowUUID(resolvedTarget.targetTable, triggerRow);
              const beforeRow = startResult.mutation.beforeRows.find(row => (
                String(this.getRowUUID(resolvedTarget.targetTable, row) || "") === String(triggerUUID || "")
              )) || startResult.mutation.beforeRows[index];
              await this.queuePostFinishTask(
                options,
                nodes,
                node,
                resolvedTarget,
                "trigger_event",
                triggerRow,
                startResult.mutation.action,
                beforeRow,
              );
            }
            startResult.recordMeta = {
              ...(startResult.recordMeta || {}),
              immediateMutationId: mutationRecord?.id,
            };
          } else if (startResult.mutation) {
            let mutationRecords: FlowImmediateMutation[];
            try {
              mutationRecords = await this.recordCrossTableImmediateMutations(
                options.todoId,
                resolvedTarget.targetTable,
                startResult.mutation,
                occurrenceId,
                shouldTriggerTargetProcess,
              );
            } catch (err) {
              try {
                await this.compensateCrossTableMutationBeforeTrigger(resolvedTarget, startResult.mutation);
                const persistedMutationRecords = (err as Error & {
                  persistedMutationRecords?: FlowImmediateMutation[],
                }).persistedMutationRecords || [];
                if (persistedMutationRecords.length) {
                  for (const mutationRecord of persistedMutationRecords) {
                    mutationRecord.status = "rolled_back";
                    mutationRecord.rolledBackAt = Date.now();
                    mutationRecord.conflictDetail = { reason: "mutation_record_persistence_failed" };
                  }
                  await this.flowImmediateMutationRepository.persistAndFlush(persistedMutationRecords);
                }
              } catch (compensationErr) {
                this.logger.error("compensate cross-table mutation before derived flow trigger failed", compensationErr);
                throw new Error(`${this.getFlowErrorMessage(err)}; ${this.getFlowErrorMessage(compensationErr)}`);
              }
              await this.formDataService.failFlowDerivedPostMutation(startResult.mutation.preparedTaskId, err);
              throw err;
            }
            let triggerResult: FlowTriggerResult = { triggered: false };
            if (waitCrossTableFlowCompletion) {
              triggerResult = await this.runImmediateCrossTableTriggers(
                options,
                resolvedTarget,
                startResult.mutation,
                mutationRecords,
                shouldTriggerTargetProcess,
              );
            } else {
              this.scheduleImmediateCrossTableTriggers(
                options,
                resolvedTarget,
                startResult.mutation,
                mutationRecords,
                shouldTriggerTargetProcess,
              );
            }
            startResult.recordMeta = {
              ...(startResult.recordMeta || {}),
              immediateMutationIds: mutationRecords.map(item => item.id),
              ...(waitCrossTableFlowCompletion ? {} : { crossAppTriggerAsync: true }),
              ...this.buildCrossAppTriggerMeta(resolvedTarget, startResult.mutation.action, triggerResult),
            };
          }
        }
      } catch (err) {
        this.logger.error(`start data processing node error: ${node.type}`, err);
        await this.rejectDataProcessingNode(
          options,
          nodes,
          node,
          this.getFlowErrorMessage(err),
          {},
          processingRecord,
        );
        return;
      }
      if (processingRecord) {
        await this.finishDataProcessingRecord(
          processingRecord,
          node,
          ProcessNodeStatus.FINISHED,
          "",
          startResult.messages.join('\n'),
          startResult.recordMeta,
        );
        await this.updateFlowData(options, {
          node: { type: "delete", value: [node.uid] },
        });
      } else {
        processingRecord = await this.createDataProcessingRecord(
          options,
          node,
          ProcessNodeStatus.FINISHED,
          "",
          startResult.messages.join('\n'),
          startResult.recordMeta,
        );
      }
      const postFinishTaskId = startResult.recordMeta?.postFinishTaskId as string;
      if (postFinishTaskId) {
        const postFinishTask = await this.flowPostFinishTaskRepository.findOne({ id: postFinishTaskId });
        if (postFinishTask) {
          postFinishTask.executionRecordId = processingRecord.id;
          await this.flowPostFinishTaskRepository.persistAndFlush(postFinishTask);
        }
      }
      toNext = true;
    } else if (node.type === ProcessNodeType.CONDITION_BRANCH) {
      await this.enterConditionBranch(options, nodes, node, initiatorId, compensationContext);
      return;
    } else if (node.type === ProcessNodeType.PARALLEL_BRANCH) {
      await this.enterParallelBranch(options, nodes, node, initiatorId, compensationContext);
      return;
    } else if (node.type === ProcessNodeType.END) {
      await this.executeTerminalFlowNode(options, node);
      return;
    } else if ([
      ProcessNodeType.START,
      ProcessNodeType.TRIGGER_DATA_CHANGE,
      ProcessNodeType.TRIGGER_TIME_TASK,
      ProcessNodeType.TRIGGER_MANUAL,
      ProcessNodeType.TRIGGER_OPERATION,
      ProcessNodeType.BRANCH_SETTING,
      ProcessNodeType.JUNCTION,
    ].includes(node.type)) {
      toNext = true;
    }

    if (toNext) {
      const branchFlow = getOwnerBranchFlow(nodes, node.uid);
      if (branchFlow && branchFlow?.type === ProcessNodeType.PARALLEL_BRANCH) {
        const branch = branchFlow.branches.find(b => getFlowById(b.flows, node.uid));
        const lastNode = branch.flows.at(-1);
        if (lastNode.uid === node.uid) {
          const isFinish = await this.completeParallelBranch(options, branchFlow, branch.flows[0].uid);
          if (!isFinish) return;
        }
      }
      const nextNode = getNextFlow(nodes, node.uid);
      await this.continueFlowAtNode(options, nodes, nextNode, initiatorId, compensationContext);
    } else {
      await this.updateFlowData(options, { status: ProcessNodeStatus.IN_PROGRESS, node: { type: "add", value: [node.uid] } });
    }
  }

  private async addTodo(
    options: AddTodoOptions,
    compensationContext?: FlowCompensationContext,
    mutationOptions: Pick<TriggerOptions, "beforeMutationRows" | "causedByTodoId" | "causedByTaskId" | "runtimeAccount" | "flowWorkerContext"> = {},
    runtimeContext?: AddTodoRuntimeContext,
  ) {
    const startedAt = Date.now();
    const phaseDurationMs: Record<string, number> = {};
    let phaseStartedAt = startedAt;
    const markPhase = (phase: string) => {
      const now = Date.now();
      phaseDurationMs[phase] = now - phaseStartedAt;
      phaseStartedAt = now;
    };
    if (options.stashRequested && [TODOTriggerType.ADD, TODOTriggerType.EDIT].includes(options.source)) {
      return await this.stashDataChangeTriggerTodo(options);
    }

    const account = runtimeContext?.account || await this.formDataService.getAccount();
    const nocodeBody = runtimeContext?.nocodeBody || await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const currentTable = formData.tables.find(item => item.uid === options.tableId);
    const process = formData.formOptions[options.tableId].process;
    if (!process?.enabled) throw new Error(global.i18next.t('formFlowService.enableProcessFirstTips'));
    const processVersion = this.getEnabledProcessVersion(process);
    if (!processVersion) throw new Error(global.i18next.t('formFlowService.enableProcessFirstTips'));
    const flows = this.getFlowsByVersion(process, processVersion);
    const startNode = flows[0];
    markPhase("load-context");

    const initializationEm = this.orm.em.fork();
    const record = await this.createRecord(
      options,
      startNode,
      ProcessNodeStatus.FINISHED,
      processVersion,
      undefined,
      false,
      initializationEm,
    );
    record.operators = [account.id];
    const todoId = unique(32);
    if (compensationContext && compensationContext.mode !== "none") {
      compensationContext.todoId = todoId;
    }
    record.todoId = todoId;
    record.metas = {
      ...(record.metas || {}),
      [account.id]: {
        source: options.source,
        entryId: options.entryId,
        operationId: options.operationId,
      }
    }
    const triggerContext = options.triggerContext || this.buildBaseFlowTriggerContext(options.nocodeId, options.tableId, todoId);
    if ([TODOTriggerType.ADD, TODOTriggerType.EDIT, TODOTriggerType.DELETE].includes(options.source)) {
      const beforeRows = mutationOptions.beforeMutationRows || [];
      const triggerRow = options.triggerRowSnapshot || await this.loadRollbackRowByUUID(formData, options.nocodeId, currentTable, options.uuid);
      await this.recordImmediateMutation(todoId, "trigger", {
        action: options.source as unknown as DataChangeType,
        targetNocodeId: options.nocodeId,
        targetTableId: options.tableId,
        targetUuid: options.uuid,
        beforeRows: deepClone(beforeRows),
        afterRows: triggerRow ? [deepClone(triggerRow)] : [],
      }, unique(32), false, 1, initializationEm);
    }
    if (options.triggerRowSnapshot || triggerContext) {
      await this.updateFlowExecutionContext(todoId, {
        ...(options.triggerRowSnapshot ? {
          triggerRowSnapshot: deepClone(options.triggerRowSnapshot),
          ...([TODOTriggerType.ADD, TODOTriggerType.EDIT, TODOTriggerType.DELETE].includes(options.source) ? {
            displaySnapshotAction: options.source as unknown as DataChangeType,
          } : {}),
        } : {}),
        triggerContext,
        ...(Array.isArray(options.skipNodeIds) ? { skipNodeIds: deepClone(options.skipNodeIds) } : {}),
        causedByTodoId: mutationOptions.causedByTodoId,
        causedByTaskId: mutationOptions.causedByTaskId,
      }, initializationEm, true);
    }
    markPhase("persist-start");

    // 把数据变成处于流程中的状�?
    const stage = (options.source === TODOTriggerType.ADD) ? FormDataStage.ADDING : (options.source === TODOTriggerType.DELETE) ? FormDataStage.DELETING : FormDataStage.EDITING;
    await this.updateFlowData(options, { status: ProcessNodeStatus.IN_PROGRESS, stage, todoId, version: processVersion });
    markPhase("update-flow-data");

    // 开始下一个节�?
    const branch = startNode.branches.find(b => b.uid === options.entryId);
    const nextNode = getNextFlow(flows, branch.flows[0].uid);
    await this.addNextNode({
      ...options,
      todoId,
      skipNodeIds: options.skipNodeIds || [],
      ...(mutationOptions.flowWorkerContext ? { flowWorkerContext: mutationOptions.flowWorkerContext } : {}),
    }, flows, nextNode, account.id, compensationContext);
    markPhase("execute-node");
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 500) {
      this.logger.warn(`[flow-add-todo] ${JSON.stringify({
        durationMs,
        phaseDurationMs,
        source: options.source,
        worker: Boolean(mutationOptions.flowWorkerContext),
      })}`);
    }
    return todoId;
  }

  async stashTodo(options: SubmitTodoOptions, userId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    const flowRecord = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!flowRecord)  throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    const rollbackContext: StashMutationRollbackContext = {
      flowRecordSnapshot: this.buildFlowRecordStashSnapshot(flowRecord),
    };
    this.clearRecordStashed(flowRecord);
    const flows = await this.getInstanceFlows(process, options, flowRecord);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) throw new Error(global.i18next.t('formFlowService.processNotFound'));
    if (![ProcessNodeType.TRIGGER_DATA_CHANGE, ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(flow.type)) {
      throw new Error(global.i18next.t('formFlowService.stashNotSupported'));
    }
    const stashable = flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      ? flow.options?.allowStash === true
      : flow.options?.allowStash === true;
    if (!stashable) {
      throw new Error(global.i18next.t('formFlowService.stashNotEnabled'));
    }
    if (flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE) {
      const startRecord = await this.getStartRecord(options);
      const triggerSource = Object.values(startRecord?.metas || {}).find(meta => meta.source)?.source;
      if (![TODOTriggerType.ADD, TODOTriggerType.EDIT].includes(triggerSource as TODOTriggerType)) {
        throw new Error(global.i18next.t('formFlowService.stashNotSupported'));
      }
    }

    let reportResolvedTarget: ResolvedProcessTargetTable | null = null;
    try {
      if (flow.type === ProcessNodeType.REPORT_DATA) {
        const flowNocodeBody = await this.getFlowNocodeBody(options.nocodeId);
        reportResolvedTarget = this.resolveProcessTargetTable(options.nocodeId, flowNocodeBody, flow.options.targetTableUID);
        const executionContext = await this.getFlowExecutionContext(options.todoId);
        const reportStashContext = this.getReportDataStashContext(executionContext?.data, flow.uid);
        const reportStashRow = !isEmpty(options.row)
          ? deepClone(options.row || {})
          : deepClone(reportStashContext?.row || {});
        rollbackContext.executionContextExisted = !!executionContext;
        rollbackContext.executionContextDataSnapshot = executionContext?.data;
        const nextContextData = this.setReportDataStashContext(
          executionContext?.data,
          flow.uid,
          {
            row: reportStashRow,
            targetNocodeId: reportResolvedTarget.targetNocodeId,
            targetTableUID: reportResolvedTarget.targetTable.uid,
            targetUUID: this.getReportDataStashedTargetMeta(flowRecord, userId)?.stashedTargetUUID,
          },
        );
        const nextNodeStashData = this.setNodeStashContext(
          nextContextData,
          flow.uid,
          {
            row: reportStashRow,
            targetNocodeId: reportResolvedTarget.targetNocodeId,
            targetTableUID: reportResolvedTarget.targetTable.uid,
          },
        );
        await this.updateFlowExecutionContext(options.todoId, { data: nextNodeStashData });
      } else {
        await this.setFlowNodeStashContext(
          options.todoId,
          flow.uid,
          {
            row: deepClone(options.row || {}),
          },
          rollbackContext,
        );
      }

      this.setRecordStashed(flowRecord, userId, true);
      const meta = this.ensureFlowRecordMeta(flowRecord, userId);
      if (this.hasOpinionContent(options)) {
        this.applyOpinionToMeta(meta, options);
      } else {
        meta.updateTime = Date.now();
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
      return { isStashed: true };
    } catch (error) {
      if (reportResolvedTarget) {
        const latestStashedTargetMeta = this.getReportDataStashedTargetMeta(flowRecord, userId);
        if (
          latestStashedTargetMeta?.stashedTargetNocodeId === reportResolvedTarget.targetNocodeId
          && latestStashedTargetMeta?.stashedTargetTableUID === reportResolvedTarget.targetTable.uid
          && latestStashedTargetMeta?.stashedTargetUUID
        ) {
          rollbackContext.reportTargetUUID = latestStashedTargetMeta.stashedTargetUUID;
        }
      }
      try {
        await this.rollbackStashMutation(options, flowRecord, rollbackContext);
      } catch (rollbackError) {
        this.logger.error("stash todo rollback failed", rollbackError);
      }
      throw error;
    }
  }

  private async getNormalUUIDs(formDatas?: any[], records?: Array<Pick<FlowExecutionRecords, "uuid" | "nocodeId" | "tableId"> & { todoId?: string }>) {
    const groups = records.reduce((prev, item) => {
      if (!prev[item.nocodeId]) prev[item.nocodeId] = {};
      if (!prev[item.nocodeId][item.tableId]) prev[item.nocodeId][item.tableId] = [];
      prev[item.nocodeId][item.tableId].push(item.uuid);
      return prev;
    }, {});
    const promises: Promise<string[]>[] = [];
    for (const nocodeId in groups) {
      const formData: NocodeFormData = formDatas.find(item => item.nocodeId === nocodeId)?.formData;
      if (!formData) continue;
      for (const tableId in groups[nocodeId]) {
        const uuids = groups[nocodeId][tableId];
        const table = formData.tables.find(t => t.uid === tableId);
        if (!table) continue;
        const uuidField = getUUIDSystemField(table.fields);
        const res = this.formDataService._distinct(formData, nocodeId, tableId as TableUID, uuidField.uid, {
          filters: {
            [tableId]: [{
              [uuidField.uid]: {
                $in: uuids,
              }
            }]
          },
          stage: this.getDefaultReadableStageCondition(),
        })?.then((res) => res.map(item => item.value));
        promises.push(res);
      }
    }
    const results = await Promise.all(promises);
    const physicalUUIDs = results.flat(Infinity) as string[];
    const missingRecords = records.filter(record => !physicalUUIDs.includes(record.uuid) && record.todoId);
    if (!missingRecords.length) return physicalUUIDs;
    const contexts = await this.flowExecutionContextRepository.find({
      todoId: { $in: missingRecords.map(record => record.todoId).filter(Boolean) },
    });
    const snapshotTodoIds = new Set(contexts.filter(context => context.displayRowSnapshot).map(context => context.todoId));
    return [
      ...physicalUUIDs,
      ...missingRecords.filter(record => snapshotTodoIds.has(record.todoId)).map(record => record.uuid),
    ];
  }

  private async appendTodoUUIDVisibilityCondition(
    qb: QueryBuilder<FlowExecutionRecords>,
    formDatas: any[],
    flowUUIDs: Array<Pick<FlowExecutionRecords, "uuid" | "nocodeId" | "tableId" | "type"> & { isStashed?: boolean }>,
  ) {
    if (!flowUUIDs.length) {
      return;
    }
    const timeTaskUUIDs = flowUUIDs.filter(item => item.uuid?.length > 20)?.map(item => item.uuid) || [];
    const normalRecords = flowUUIDs.filter(item => item.isStashed !== true);
    const normalUUIDs = normalRecords.length ? await this.getNormalUUIDs(formDatas, normalRecords) : [];
    const visibleUUIDs = [...new Set([...normalUUIDs, ...timeTaskUUIDs])];
    const hasStashedRecords = flowUUIDs.some(item => item.isStashed === true);

    if (!visibleUUIDs.length && !hasStashedRecords) {
      qb.andWhere({
        uuid: {
          $in: [],
        }
      });
      return;
    }

    if (!visibleUUIDs.length) {
      qb.andWhere({
        isStashed: true,
      });
      return;
    }

    if (!hasStashedRecords) {
      qb.andWhere({
        uuid: {
          $in: visibleUUIDs,
        }
      });
      return;
    }

    qb.andWhere({
      $or: [
        {
          uuid: {
            $in: visibleUUIDs,
          }
        },
        {
          isStashed: true,
        },
      ],
    });
  }

  async getStartTodoOwners(category: TodoCategory, userId: string, nocodeId?: string) {
    const processNocodesData = await this.getHasProcessNocodes();
    const formDatas = processNocodesData.map(item => ({ nocodeId: item.nocodeMeta.id, formData: item.nocodeBody.formData }));
    const adminAccount = await this.workbenchService.getAdmin().catch(() => null);
    const adminAccountId = adminAccount?.id;

    const qb = this.entityManager.createQueryBuilder<FlowExecutionRecords>("FlowExecutionRecords", "r");
    let query: FilterQuery<FlowExecutionRecords> = {};
    if (nocodeId) {
      query = {
        nocodeId: nocodeId,
      }
    }
    qb.where("1=1");

    let records: FlowExecutionRecords[] = [];
    if (category === TodoCategory.MY_TODO) {
      query = {
        ...query,
        status: ProcessNodeStatus.IN_PROGRESS,
      }
      qb.andWhere(query);
      const flowUUIDs = await qb.clone().select(["r.uuid", "r.nocode_id", "r.table_id", "r.todo_id", "r.type", "r.is_stashed"], true).execute();
      await this.appendTodoUUIDVisibilityCondition(qb, formDatas, flowUUIDs);
      const deletedUsersCondition = this.buildJsonArrayContainsCondition('r.deleted_users', userId, false);
      this.applyJsonArrayCondition(qb, deletedUsersCondition, 'r.deleted_users IS NULL OR');
      
      const paddingOperatorsCondition = this.buildJsonArrayContainsCondition('r.padding_operators', userId, true);
      if (paddingOperatorsCondition.__rawSql) {
        qb.andWhere(`r.padding_operators IS NOT NULL AND ${paddingOperatorsCondition.__rawSql}`, paddingOperatorsCondition.__params);
      } else {
        qb.andWhere({
          $and: [
            { paddingOperators: { $exists: true, $ne: null } },
            paddingOperatorsCondition
          ]
        });
      }
      
      const operatorsCondition = this.buildJsonArrayContainsCondition('r.operators', userId, false);
      this.applyJsonArrayCondition(qb, operatorsCondition, 'r.operators IS NULL OR');
      records = await qb.getResult();
    } else {
      if (category === TodoCategory.MY_PROCESSED) {
        query = {
          ...query,
          type: {
            $in: [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA]
          }
        }
      } else if (category === TodoCategory.CC_ME) {
        query = {
          ...query,
          type: ProcessNodeType.NOTIFY,
        }
      }
      qb.andWhere(query);
      const operatorsCondition2 = this.buildJsonArrayContainsCondition('r.operators', userId, true);
      if (operatorsCondition2.__rawSql) {
        qb.andWhere(`r.operators IS NOT NULL AND ${operatorsCondition2.__rawSql}`, operatorsCondition2.__params);
      } else {
        qb.andWhere({
          $and: [
            { operators: { $exists: true, $ne: null } },
            operatorsCondition2
          ]
        });
      }
      
      const deletedUsersCondition2 = this.buildJsonArrayContainsCondition('r.deleted_users', userId, false);
      if (deletedUsersCondition2.__rawSql) {
        qb.andWhere(`r.deleted_users IS NULL OR ${deletedUsersCondition2.__rawSql}`, deletedUsersCondition2.__params);
      } else {
        qb.andWhere(deletedUsersCondition2);
      }

      const flowUUIDs = await qb.clone().select(["r.uuid", "r.nocode_id", "r.table_id", "r.todo_id"], true).execute();
      if (flowUUIDs.length) {
        const timeTaskUUIDs = flowUUIDs.filter(item => item.uuid?.length > 20)?.map(item => item.uuid) || [];
        const uuids = await this.getNormalUUIDs(formDatas, flowUUIDs);
        if (uuids.length) {
          qb.andWhere({
            uuid: {
              $in: [...uuids, ...timeTaskUUIDs],
            }
          })
        }
      }
      qb.groupBy("todo_id");
      const tasks = await qb.getResult();
      const todoIds = tasks.map(task => task.todoId);
      records = await this.flowExecutionRecordsRepository.find({
        todoId: {
          $in: todoIds,
        },
        $or: [
          { status: ProcessNodeStatus.IN_PROGRESS },
          { type: ProcessNodeType.END }
        ]
      }, { groupBy: "todoId" });
      for (const record of records) {
        if (record.type === ProcessNodeType.END) {
          const currentFlow = tasks.find(task => task.todoId === record.todoId);
          record['currentFlowId'] = currentFlow.flowId;
        }
      }
    }

    let result = [];
    for (const item of records) {
      const startRecord = await this.getStartRecord({ uuid: item.uuid, nocodeId: nocodeId, todoId: item.todoId });
      const flowStartOperator = startRecord?.operators?.[0];
      result.push(flowStartOperator && flowStartOperator !== "0" ? flowStartOperator : adminAccountId);
    }

    return Array.from(new Set(result));
  }

  async getPageTodos(options: GetTodosParams & { formDatas: any[] }, userId: string, onlyCount: true): Promise<number>
  async getPageTodos(options: GetTodosParams & { formDatas: any[] }, userId: string, onlyCount?: false): Promise<GetTodosResult>
  async getPageTodos(options: GetTodosParams & { formDatas: any[] }, userId: string, onlyCount = false) {
    let query: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
    };
    const qb = this.entityManager.createQueryBuilder<FlowExecutionRecords>("FlowExecutionRecords", "r");
    qb.where("1=1");
    if (options.formDatas) {
      // search table alias
      const queries = options.formDatas.map(item => {
        const nocodeId = item.nocodeId;
        const formData: NocodeFormData = item.formData;
        const tableUIDs = formData.tables.filter(table => {
          let matched = true;
          if (options.searchValue) {
            matched = table.alias?.includes(options.searchValue);
          }
          return matched && isProcessTable(formData.formOptions?.[table.uid]);
        }).map(table => table.uid);
        return {
          nocodeId,
          tableId: {
            $in: tableUIDs,
          }
        };
      })
      if (queries.length > 1) {
        qb.andWhere({
          $or: queries,
        })
      } else {
        qb.andWhere(queries[0]);
      }
      query = {};
    }

    const isMyTodo = options.category === TodoCategory.MY_TODO;
    const isMyInitiated = options.category === TodoCategory.MY_INITIATED;
    const needFilterOvertimeTodos = isMyTodo && options.todoPendingFilter === "overtime";

    const orderBy = options.orderBy || "DESC";
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    let records: FlowExecutionRecords[] = [];
    let count = 0;
    type TodoListFilter = Exclude<GetTodosParams["filter"], string | undefined>;
    let filter: TodoListFilter | null = null;
    if (typeof options.filter === "string") {
      try {
        filter = JSON.parse(options.filter) as TodoListFilter;
      } catch (error) {
        filter = null;
      }
    } else if (options.filter && typeof options.filter === "object") {
      filter = options.filter as TodoListFilter;
    }

    if (!isEmpty(filter)) {
      const filterQb = qb.clone();
      filterQb.andWhere({
        type: ProcessNodeType.START,
      })
      let needExec = false;
      if (!isMyInitiated && filter.operators) {
        const operatorCondition = filter.operators as any;
        this.applyJsonArrayFilterCondition(filterQb, operatorCondition);
        needExec = true;
      }
      if (filter.startTime) {
        filterQb.andWhere({
          startTime: filter.startTime,
        })
        needExec = true;
      }
      if (isMyTodo && typeof filter.isStashed === "boolean") {
        if (filter.isStashed) {
          qb.andWhere({
            isStashed: true,
          });
        } else {
          qb.andWhere({
            $or: [
              { isStashed: false },
              { isStashed: null },
            ],
          });
        }
      }
      if (needExec) {
        const todoIdList = await filterQb.select(["r.todo_id"], true).execute();
        qb.andWhere({
          todoId: {
            $in: todoIdList?.map(item => item.todoId)?.filter(Boolean),
          }
        })
      }

      if (!isMyTodo && filter.status) {
        const filterQb = qb.clone();
        filterQb.andWhere({
          $or: [
            { status: ProcessNodeStatus.IN_PROGRESS },
            { type: ProcessNodeType.END }
          ],  
          status: filter.status,
        });
        const todoIdList = await filterQb.select(["r.todo_id"], true).execute();
        qb.andWhere({
          todoId: {
            $in: todoIdList?.map(item => item.todoId)?.filter(Boolean),
          }
        })
      }
    }
    if (isMyTodo) {
      query = {
        ...query,
        status: ProcessNodeStatus.IN_PROGRESS,
      }
      qb.andWhere(query);
      // Only a human node (or a stashed record waiting for its submitter) can
      // be somebody's pending todo. Automatic nodes keep running on their own
      // while they wait in the execution queue, so excluding them here keeps
      // the scan at the real todo set instead of materializing every in-flight
      // node record of the user.
      qb.andWhere({
        $or: [
          { type: { $in: [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA] } },
          { isStashed: true },
        ],
      });
      const flowUUIDs = await qb.clone().select(["r.uuid", "r.nocode_id", "r.table_id", "r.todo_id", "r.type", "r.is_stashed"], true).execute();
      await this.appendTodoUUIDVisibilityCondition(qb, options.formDatas, flowUUIDs);
      const deletedUsersCondition = this.buildJsonArrayContainsCondition('r.deleted_users', userId, false);
      this.applyJsonArrayCondition(qb, deletedUsersCondition, 'r.deleted_users IS NULL OR');
      
      const paddingOperatorsCondition = this.buildJsonArrayContainsCondition('r.padding_operators', userId, true);
      if (paddingOperatorsCondition.__rawSql) {
        qb.andWhere(`r.padding_operators IS NOT NULL AND ${paddingOperatorsCondition.__rawSql}`, paddingOperatorsCondition.__params);
      } else {
        qb.andWhere({
          $and: [
            { paddingOperators: { $exists: true, $ne: null } },
            paddingOperatorsCondition
          ]
        });
      }
      
      const operatorsCondition = this.buildJsonArrayContainsCondition('r.operators', userId, false);
      this.applyJsonArrayCondition(qb, operatorsCondition, 'r.operators IS NULL OR');
      qb.orderBy({
        "startTime": orderBy,
      });
      const matches = await this.filterMyTodoRecordsByCurrentOperator(await qb.getResult(), options.formDatas, userId);
      if (needFilterOvertimeTodos) {
        // Overtime state lives on the record's node timeout deadline, so filter before converting. Building a full todo object
        // per record only to count it was the dominant cost of this endpoint.
        const filtered = matches.filter(({ record, flow }) => this.isOvertimeTodoRecord(record, flow));
        count = filtered.length;
        if (onlyCount) return count;
        records = filtered.slice(offset, offset + pageSize).map(match => match.record);
      } else {
        count = matches.length;
        if (onlyCount) return count;
        records = matches.slice(offset, offset + pageSize).map(match => match.record);
      }
    } else {
      if (isMyInitiated) {
        query = {
          ...query,
          type: ProcessNodeType.START,
        }
      } else if (options.category === TodoCategory.MY_PROCESSED) {
        query = {
          ...query,
          type: {
            $in: [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA]
          }
        }
      } else if (options.category === TodoCategory.CC_ME) {
        query = {
          ...query,
          type: ProcessNodeType.NOTIFY,
        }
      }
      qb.andWhere(query);
      const operatorsCondition2 = this.buildJsonArrayContainsCondition('r.operators', userId, true);
      if (operatorsCondition2.__rawSql) {
        qb.andWhere(`r.operators IS NOT NULL AND ${operatorsCondition2.__rawSql}`, operatorsCondition2.__params);
      } else {
        qb.andWhere({
          $and: [
            { operators: { $exists: true, $ne: null } },
            operatorsCondition2
          ]
        });
      }
      
      const deletedUsersCondition2 = this.buildJsonArrayContainsCondition('r.deleted_users', userId, false);
      if (deletedUsersCondition2.__rawSql) {
        qb.andWhere(`r.deleted_users IS NULL OR ${deletedUsersCondition2.__rawSql}`, deletedUsersCondition2.__params);
      } else {
        qb.andWhere(deletedUsersCondition2);
      }

      const flowUUIDs = await qb.clone().select(["r.uuid", "r.nocode_id", "r.table_id", "r.todo_id"], true).execute();
      if (flowUUIDs.length) {
        const timeTaskUUIDs = flowUUIDs.filter(item => item.uuid?.length > 20)?.map(item => item.uuid) || [];
        const uuids = await this.getNormalUUIDs(options.formDatas, flowUUIDs);
        if (uuids.length) {
          qb.andWhere({
            uuid: {
              $in: [...uuids, ...timeTaskUUIDs],
            }
          })
        }
      }

      count = await qb.getCount("todoId", true);
      if (onlyCount) return count;
      qb.groupBy("todo_id");
      qb.orderBy({
        "startTime": orderBy,
      });
      qb.limit(pageSize, offset);
      const tasks = await qb.getResult();
      const todoIds = tasks.map(task => task.todoId);
      records = await this.flowExecutionRecordsRepository.find({
        todoId: {
          $in: todoIds,
        },
        $or: [
          { status: ProcessNodeStatus.IN_PROGRESS },
          { type: ProcessNodeType.END }
        ]
      }, { groupBy: "todoId", orderBy: { startTime: orderBy } });
      for (const record of records) {
        if (record.type === ProcessNodeType.END) {
          const currentFlow = tasks.find(task => task.todoId === record.todoId);
          record['currentFlowId'] = currentFlow.flowId;
        }
      }
    }

    const todos = await this.convertTodos(records, options.formDatas, userId);
    return {
      todos,
      count,
      page,
      pageSize,
    }
  }

  private resolveFieldAuthValue(value: unknown): number {
    if (value === FieldAuthValue.VISIBLE_EDITABLE) return FieldAuthValue.VISIBLE_EDITABLE;
    if (value === FieldAuthValue.VISIBLE) return FieldAuthValue.VISIBLE;
    return 0;
  }

  private getFieldAuthValue(
    fieldAuth: "all" | Record<string, unknown> | undefined,
    field: Field,
    defaultWhenMissing: number,
  ): number {
    if (!fieldAuth || fieldAuth === "all") return FieldAuthValue.VISIBLE_EDITABLE;
    const value = fieldAuth[field.meta?.uid] ?? fieldAuth[field.uid];
    if (value === undefined) return defaultWhenMissing;
    return this.resolveFieldAuthValue(value);
  }

  private async getMemberFieldAuth(
    nocodeBody: NocodeBody | undefined,
    tableId: TableUID,
    userId: string,
    memberRangeUsersCache: Map<string, string[]>,
    isAdmin: boolean,
  ): Promise<"all" | Record<string, number>> {
    if (isAdmin) return "all";
    const permissions = nocodeBody?.permissions?.field?.[tableId]?.[PermissionCategory.GET];
    if (isEmpty(permissions)) return "all";
    const fieldsAuth: Record<string, number> = {};
    let hasMatchedPermission = false;
    let hasCustomFieldRange = false;
    for (const permission of permissions) {
      if (permission.memberRange.rangeType === PermissionRangeType.CUSTOM) {
        const rangeKey = JSON.stringify(permission.memberRange.range ?? {});
        let userIds = memberRangeUsersCache.get(rangeKey);
        if (!userIds) {
          const users = await this.workbenchService.getUsers(permission.memberRange.range);
          userIds = users.map(user => user.id);
          memberRangeUsersCache.set(rangeKey, userIds);
        }
        if (!userIds.includes(userId)) continue;
      }
      hasMatchedPermission = true;
      if (permission.fieldRange.rangeType === PermissionRangeType.ALL) continue;
      hasCustomFieldRange = true;
      assignFieldsAuth(fieldsAuth, permission.fieldRange.range || {});
    }
    if (!hasMatchedPermission) return "all";
    if (!hasCustomFieldRange || isEmpty(fieldsAuth)) return "all";
    return fieldsAuth;
  }

  private async canUserViewTodoData(
    options: Pick<BaseTodoOptions, "nocodeId" | "tableId" | "uuid">,
    userId: string,
    params?: {
      startRecord?: FlowExecutionRecords | null,
      stage?: FormDataStageWhereCondition,
    },
  ) {
    const stage = params?.stage || this.getTodoReadableStageCondition(params?.startRecord);
    return await this.formDataService.canUserReadDataByUUID(
      options.nocodeId,
      options.tableId,
      userId,
      options.uuid,
      {
        stage,
      },
    );
  }

  private isTransferRangeConfigured(transferRange?: OrganizeOptionValue) {
    return !!(
      transferRange?.users?.length ||
      transferRange?.roles?.length ||
      transferRange?.departments?.length
    );
  }

  private async getTransferBaseUsers(transferRange?: OrganizeOptionValue): Promise<Account[]> {
    const users = this.isTransferRangeConfigured(transferRange)
      ? await this.workbenchService.getUsers({
          users: transferRange?.users || [],
          roles: transferRange?.roles || [],
          departments: transferRange?.departments || [],
        })
      : await this.workbenchService.getAllUsers();
    return users.filter(user => user?.user !== ADMIN_USERNAME);
  }

  private async getTransferTodoContext(
    options: GetTransferTodoUsersOptions,
    userId: string,
  ): Promise<TransferTodoContext> {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    if (!process) {
      throw new Error(global.i18next.t('formFlowService.processNodeNotFound'));
    }
    const record = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!record) {
      throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    }
    const flows = await this.getInstanceFlows(process, options, record);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) {
      throw new Error(global.i18next.t('formFlowService.processNodeNotFound'));
    }

    const startRecord = await this.getStartRecord(options);
    const canViewCurrentData = await this.canUserViewTodoData(options, userId, {
      startRecord,
    });
    const canForceTransfer = !canViewCurrentData
      && [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(flow.type);
    if (!flow.options?.allowTransfer && !canForceTransfer) {
      throw new Error(global.i18next.t('formFlowService.nodeNotSupportTransfer'));
    }

    let owners = record.paddingOperators;
    if (!owners) {
      owners = await this.getOwnersByNode(options, flow, startRecord?.operators?.[0]);
    }
    if (
      [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(flow.type)
      && !this.getActivePendingOperatorIds(flow, owners, record.operators).includes(userId)
    ) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }

    return {
      flow,
      record,
      startRecord,
      owners,
      canViewCurrentData,
    };
  }

  private getHandoverFlowOwnerConfig(node: ProcessFlow) {
    if (node.type === ProcessNodeType.APPROVAL) {
      return {
        owner: node.options?.approver,
        emptyUsersKey: "approverEmptyUsers" as const,
        emptyUserKey: null,
      };
    }
    if (node.type === ProcessNodeType.TRANSACT) {
      return {
        owner: node.options?.transactor,
        emptyUsersKey: "transactorEmptyUsers" as const,
        emptyUserKey: null,
      };
    }
    if (node.type === ProcessNodeType.REPORT_DATA) {
      return {
        owner: node.options?.reporter,
        emptyUsersKey: null,
        emptyUserKey: "reporterEmptyUser" as const,
      };
    }
    return {
      owner: undefined,
      emptyUsersKey: null,
      emptyUserKey: null,
    };
  }

  private replaceArrayUserId(users: string[] = [], fromUserId: string, toUserId: string) {
    const sourceUsers = Array.isArray(users) ? users : [];
    const hasSourceUser = sourceUsers.includes(fromUserId);
    if (!hasSourceUser) {
      return {
        users: sourceUsers,
        changed: false,
      };
    }
    const nextUsers = sourceUsers.map((userId) => userId === fromUserId ? toUserId : userId);
    return {
      users: Array.from(new Set(nextUsers.filter(Boolean))),
      changed: true,
    };
  }

  private replaceFlowOwnerNodeUserIds(
    node: ProcessFlow,
    fromUserId: string,
    toUserId: string,
  ) {
    const config = this.getHandoverFlowOwnerConfig(node);
    let changed = false;
    let changedCount = 0;

    const assignee = config.owner?.[ProcessNodeOwnerType.ASSIGNEE];
    if (assignee?.users?.length) {
      const result = this.replaceArrayUserId(assignee.users, fromUserId, toUserId);
      if (result.changed) {
        assignee.users = result.users;
        changed = true;
        changedCount += 1;
      }
    }

    if (config.emptyUsersKey) {
      const result = this.replaceArrayUserId(node.options?.[config.emptyUsersKey], fromUserId, toUserId);
      if (result.changed) {
        node.options[config.emptyUsersKey] = result.users;
        changed = true;
        changedCount += 1;
      }
    }

    if (config.emptyUserKey && node.options?.[config.emptyUserKey] === fromUserId) {
      node.options[config.emptyUserKey] = toUserId;
      changed = true;
      changedCount += 1;
    }

    for (const branch of node.branches || []) {
      for (const flow of branch.flows || []) {
        const branchResult = this.replaceFlowOwnerNodeUserIds(flow, fromUserId, toUserId);
        if (branchResult.changed) {
          changed = true;
          changedCount += branchResult.changedCount;
        }
      }
    }

    return {
      changed,
      changedCount,
    };
  }

  private replaceSelectedFlowOwnerNodeUserIds(
    node: ProcessFlow,
    fromUserId: string,
    toUserId: string,
    targetNodeIds: Set<string>,
  ) {
    let changed = false;
    let changedCount = 0;
    const shouldReplaceCurrentNode = targetNodeIds.has(node.uid);

    if (shouldReplaceCurrentNode) {
      const currentResult = this.replaceFlowOwnerNodeUserIds(node, fromUserId, toUserId);
      changed = currentResult.changed;
      changedCount += currentResult.changedCount;
    } else {
      for (const branch of node.branches || []) {
        for (const flow of branch.flows || []) {
          const branchResult = this.replaceSelectedFlowOwnerNodeUserIds(flow, fromUserId, toUserId, targetNodeIds);
          if (branchResult.changed) {
            changed = true;
            changedCount += branchResult.changedCount;
          }
        }
      }
    }

    return {
      changed,
      changedCount,
    };
  }

  private async getInProgressRecordsByPaddingOperator(userId: string) {
    const qb = this.entityManager.createQueryBuilder<FlowExecutionRecords>("FlowExecutionRecords", "r");
    qb.where({ status: ProcessNodeStatus.IN_PROGRESS });
    const paddingOperatorsCondition = this.buildJsonArrayContainsCondition('r.padding_operators', userId, true);
    if (paddingOperatorsCondition.__rawSql) {
      qb.andWhere(`r.padding_operators IS NOT NULL AND ${paddingOperatorsCondition.__rawSql}`, paddingOperatorsCondition.__params);
    } else {
      qb.andWhere({
        $and: [
          { paddingOperators: { $exists: true, $ne: null } },
          paddingOperatorsCondition,
        ],
      } as any);
    }
    qb.orderBy({ startTime: "DESC" });
    return await qb.getResultList();
  }

  private async buildMemberHandoverTodoRecordItems(records: FlowExecutionRecords[]) {
    if (!records.length) {
      return [];
    }
    const nocodeNameMap = new Map<string, string>();
    const tableNameMap = new Map<string, string>();
    for (const record of records) {
      if (!nocodeNameMap.has(record.nocodeId)) {
        const meta = await this.projectService.getNocodeMeta(record.nocodeId, false).catch(() => null);
        nocodeNameMap.set(record.nocodeId, meta?.name || record.nocodeId);
      }
      const tableKey = `${record.nocodeId}:${record.tableId}`;
      if (!tableNameMap.has(tableKey)) {
        const body = await getNocodeBody(this.nocodesDir, record.nocodeId).catch(() => null);
        const table = body?.formData?.tables?.find((item) => item.uid === record.tableId);
        tableNameMap.set(tableKey, table?.alias || record.tableId);
      }
    }
    return records.map((record) => ({
      id: record.id,
      nocodeId: record.nocodeId,
      nocodeName: nocodeNameMap.get(record.nocodeId) || record.nocodeId,
      tableId: record.tableId,
      tableName: tableNameMap.get(`${record.nocodeId}:${record.tableId}`) || record.tableId,
      uuid: record.uuid,
      todoId: record.todoId,
      flowId: record.flowId,
      startTime: record.startTime,
    }));
  }

  public async previewMemberTodoHandover(fromUserId: string): Promise<MemberHandoverPreviewItem[]> {
    const records = await this.getInProgressRecordsByPaddingOperator(fromUserId);
    const validRecords = records.filter((record) => Array.isArray(record.paddingOperators) && record.paddingOperators.includes(fromUserId));
    return [{
      id: "todos",
      name: global.i18next.t('OrganizeMemberManagerMain.handoverTodo'),
      count: validRecords.length,
      items: await this.buildMemberHandoverTodoRecordItems(validRecords),
    }];
  }

  public async handoverMemberTodos(fromUserId: string, toUserId: string, selectedRecordIds?: string[]) {
    const records = await this.getInProgressRecordsByPaddingOperator(fromUserId);
    const selectedIdSet = Array.isArray(selectedRecordIds) && selectedRecordIds.length
      ? new Set(selectedRecordIds.filter(Boolean))
      : null;
    const summary: MemberHandoverSummary = {
      movedCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    };
    const changedRecords: FlowExecutionRecords[] = [];
    for (const record of records) {
      if (selectedIdSet && !selectedIdSet.has(record.id)) {
        continue;
      }
      if (!Array.isArray(record.paddingOperators) || !record.paddingOperators.includes(fromUserId)) {
        summary.skippedCount += 1;
        continue;
      }
      if (!Array.isArray(record.transferRecords)) {
        record.transferRecords = [];
      }
      record.transferRecords.push({
        from: fromUserId,
        to: toUserId,
        time: Date.now(),
      });
      record.paddingOperators = record.paddingOperators.map((userId) => userId === fromUserId ? toUserId : userId);
      changedRecords.push(record);
      summary.movedCount += 1;
    }
    if (changedRecords.length) {
      await this.flowExecutionRecordsRepository.persistAndFlush(changedRecords);
    }
    return summary;
  }

  public async previewMemberFlowOwnerHandover(fromUserId: string): Promise<MemberHandoverPreviewItem[]> {
    const runningRecords = await this.getInProgressRecordsByPaddingOperator(fromUserId);
    const runningItems = await this.buildMemberHandoverTodoRecordItems(
      runningRecords.filter((record) => Array.isArray(record.paddingOperators) && record.paddingOperators.includes(fromUserId)),
    );

    const processNocodes = await this.getHasProcessNocodes();
    const futureItems: Array<Record<string, any>> = [];
    for (const item of processNocodes) {
      const formOptions = item.nocodeBody?.formData?.formOptions || {};
      for (const [tableId, formOption] of Object.entries(formOptions)) {
        const flows = getFlows(formOption?.process);
        if (!formOption?.process?.enabled || isEmpty(flows)) {
          continue;
        }
        const queue = [...(flows || [])];
        while (queue.length) {
          const node = queue.shift();
          if (!node) {
            continue;
          }
          const config = this.getHandoverFlowOwnerConfig(node);
          const assigneeUsers = config.owner?.[ProcessNodeOwnerType.ASSIGNEE]?.users || [];
          const emptyUsers = config.emptyUsersKey ? (node.options?.[config.emptyUsersKey] || []) : [];
          const emptyUser = config.emptyUserKey ? node.options?.[config.emptyUserKey] : "";
          const matched = assigneeUsers.includes(fromUserId)
            || emptyUsers.includes(fromUserId)
            || emptyUser === fromUserId;
          if (matched) {
            const table = item.nocodeBody.formData.tables.find((current) => current.uid === tableId);
            futureItems.push({
              id: `${item.nocodeMeta.id}::${tableId}::${node.uid}`,
              nocodeId: item.nocodeMeta.id,
              nocodeName: item.nocodeMeta.name,
              tableId,
              tableName: table?.alias || tableId,
              flowId: node.uid,
              flowName: node.options?.name || global.i18next.t('formFlowService.unknownNode'),
            });
          }
          for (const branch of node.branches || []) {
            queue.push(...(branch.flows || []));
          }
        }
      }
    }
    return [{
      id: "flowOwners",
      name: global.i18next.t('OrganizeMemberManagerMain.handoverFlowOwner'),
      count: runningItems.length + futureItems.length,
      items: [
        ...runningItems.map((item) => ({
          ...item,
          type: "running",
        })),
        ...futureItems.map((item) => ({
          ...item,
          type: "future",
        })),
      ],
    }];
  }

  public async handoverMemberFlowOwners(fromUserId: string, toUserId: string, selectedItemIds?: string[]) {
    const summary: MemberHandoverSummary = {
      movedCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    };
    const selectedIdSet = Array.isArray(selectedItemIds) && selectedItemIds.length
      ? new Set(selectedItemIds.filter(Boolean))
      : null;

    const runningRecords = await this.getInProgressRecordsByPaddingOperator(fromUserId);
    const changedRunningRecords: FlowExecutionRecords[] = [];
    for (const record of runningRecords) {
      if (selectedIdSet && !selectedIdSet.has(record.id)) {
        continue;
      }
      if (!Array.isArray(record.paddingOperators) || !record.paddingOperators.includes(fromUserId)) {
        summary.skippedCount += 1;
        continue;
      }
      record.paddingOperators = record.paddingOperators.map((userId) => userId === fromUserId ? toUserId : userId);
      changedRunningRecords.push(record);
      summary.movedCount += 1;
    }
    if (changedRunningRecords.length) {
      await this.flowExecutionRecordsRepository.persistAndFlush(changedRunningRecords);
    }

    const processNocodes = await this.getHasProcessNocodes();
    for (const item of processNocodes) {
      let changed = false;
      let totalChangedCount = 0;
      const formOptions = item.nocodeBody?.formData?.formOptions || {};
      for (const [tableId, formOption] of Object.entries(formOptions)) {
        const flows = getFlows(formOption?.process);
        if (!formOption?.process?.enabled || isEmpty(flows)) {
          continue;
        }
        let changedCount = 0;
        const selectedNodeIds = selectedIdSet
          ? new Set(
            Array.from(selectedIdSet)
              .filter((id) => id.startsWith(`${item.nocodeMeta.id}::${tableId}::`))
              .map((id) => id.split("::")[2])
              .filter(Boolean),
          )
          : null;
        for (const flow of flows || []) {
          const result = selectedNodeIds
            ? this.replaceSelectedFlowOwnerNodeUserIds(flow, fromUserId, toUserId, selectedNodeIds)
            : this.replaceFlowOwnerNodeUserIds(flow, fromUserId, toUserId);
          if (result.changed) {
            changed = true;
            changedCount += result.changedCount;
          }
        }
        totalChangedCount += changedCount;
      }
      if (changed) {
        await saveNocodeBody(this.nocodesDir, item.nocodeMeta.id, item.nocodeBody);
        summary.movedCount += totalChangedCount;
      }
    }
    return summary;
  }

  private async convertTodos(records: FlowExecutionRecords[], formDatas: any[], userId: string) {
    const account = await this.formDataService.getAccount().catch(() => null);
    const isAdmin = isSystemAdminAccount(account);
    const startRecordPromiseCache = new Map<string, Promise<FlowExecutionRecords | null>>();
    const getStartRecordForTodo = async (item: FlowExecutionRecords) => {
      const key = this.getTodoStartRecordCacheKey(item);
      let promise = startRecordPromiseCache.get(key);
      if (!promise) {
        promise = this.getStartRecord({
          uuid: item.uuid,
          nocodeId: item.nocodeId,
          tableId: item.tableId,
          todoId: item.todoId,
        });
        startRecordPromiseCache.set(key, promise);
      }
      return await promise;
    };
    const startRecordEntries = await Promise.all(records.map(async item => {
      const key = this.getTodoStartRecordCacheKey(item);
      return [key, await getStartRecordForTodo(item)] as const;
    }));
    const startRecordMap = new Map(startRecordEntries);
    const nocodeGroup = records.reduce<Record<string, {
      nocodeId: string,
      readableStageKey: string,
      readableStage: FormDataStageWhereCondition,
      tables: TableUID[],
      filters: Record<string, WhereCondition>,
      formData: NocodeFormData,
    }>>((prev, item) => {
      const { nocodeId, tableId, uuid } = item;
      const startRecord = startRecordMap.get(this.getTodoStartRecordCacheKey(item));
      const readableStageKey = this.getTodoReadableStageCacheKey(startRecord);
      const groupKey = `${nocodeId}:${readableStageKey}`;
      if (!prev[groupKey]) {
        const formData = formDatas.find(f => f.nocodeId === nocodeId);
        if (!formData) return prev;
        prev[groupKey] = {
          nocodeId,
          readableStageKey,
          readableStage: this.getTodoReadableStageCondition(startRecord),
          tables: [],
          filters: {},
          formData: formData.formData,
        };
      }
      if (!prev[groupKey].tables.includes(tableId)) prev[groupKey].tables.push(tableId);
      const table = prev[groupKey]?.formData?.tables?.find(t => t.uid === tableId);
      if (!table) return prev;
      const uuidField = getUUIDSystemField(table.fields);
      if (!prev[groupKey].filters[tableId]) prev[groupKey].filters[tableId] = { [uuidField.uid]: { $in: [] } };
      if (!prev[groupKey].filters[tableId][uuidField.uid]['$in'].includes(uuid)) prev[groupKey].filters[tableId][uuidField.uid]['$in'].push(uuid);
      return prev;
    }, { });

    const allBuckets = await Promise.all(Object.entries(nocodeGroup).map(async ([groupKey, { nocodeId, tables, filters, formData, readableStage }]) => {
      const buckets = await this.formDataService._getData(formData, tables, nocodeId, {
        stage: readableStage,
        filters,
      });
      return { groupKey, buckets };
    }));
    const groupedNocodeIds = Array.from(new Set(Object.values(nocodeGroup).map(group => group.nocodeId)));
    const nocodeBodies = await Promise.all(groupedNocodeIds.map(async (nocodeId) => {
      const body = await getNocodeBody(this.nocodesDir, nocodeId).catch(() => null);
      return { nocodeId, body };
    }));
    const nocodeBodyMap = nocodeBodies.reduce<Record<string, NocodeBody>>((prev, item) => {
      if (item.body) prev[item.nocodeId] = item.body;
      return prev;
    }, {});
    const memberRangeUsersCache = new Map<string, string[]>();
    const fieldPermissionAuthCache = new Map<string, "all" | Record<string, number>>();
    const canViewCurrentDataCache = new Map<string, boolean>();
    const targetBodyCache = new Map<string, NocodeBody | null>();
    const flowExecutionContextCache = new Map<string, Promise<FlowExecutionContext | null>>();
    const getCachedFlowExecutionContext = async (todoId?: string) => {
      if (!todoId) return null;
      let promise = flowExecutionContextCache.get(todoId);
      if (!promise) {
        promise = this.getFlowExecutionContext(todoId);
        flowExecutionContextCache.set(todoId, promise);
      }
      return await promise;
    };
    return await Promise.all(records.map(async (item) => {
      const { nocodeId, tableId, uuid } = item;
      const startRecord = startRecordMap.get(this.getTodoStartRecordCacheKey(item));
      const readableStageKey = this.getTodoReadableStageCacheKey(startRecord);
      const groupKey = `${nocodeId}:${readableStageKey}`;
      const buckets = allBuckets?.find(b => b.groupKey === groupKey)?.buckets;
      const bucket = buckets?.find(b => b.tableId === tableId);
      const formData = nocodeGroup[groupKey]?.formData;
      const table = formData?.tables?.find(t => t.uid === tableId);
      const uuidField = getUUIDSystemField(table?.fields);
      const row = bucket?.rows?.find(row => row[uuidField?.uid] === uuid) || {};
      const process: NocodeProcess = formData?.formOptions?.[tableId]?.process;
      const flows = await this.getInstanceFlows(process, {
        nocodeId,
        tableId,
        uuid,
        todoId: item.todoId,
      }, item);
      const allowCancel = await this.getInstanceAllowCancel({
        nocodeId,
        tableId,
        uuid,
        todoId: item.todoId,
      }, flows, startRecord);
      const flow = getFlowById(flows, item.flowId);
      const currentFlow = getFlowById(flows, (item as any).currentFlowId);
      const flowFieldAuth = currentFlow?.options?.fieldAuth || flow?.options?.fieldAuth || "all";
      const fieldPermissionAuthCacheKey = `${nocodeId}:${tableId}`;
      let permissionFieldAuth = fieldPermissionAuthCache.get(fieldPermissionAuthCacheKey);
      if (permissionFieldAuth === undefined) {
        permissionFieldAuth = await this.getMemberFieldAuth(
          nocodeBodyMap[nocodeId],
          tableId,
          userId,
          memberRangeUsersCache,
          isAdmin,
        );
        fieldPermissionAuthCache.set(fieldPermissionAuthCacheKey, permissionFieldAuth);
      }
      let requireComments = false;
      if (flow?.type === ProcessNodeType.APPROVAL) {
        requireComments = !!flow.options?.requireApprovalComments;
      } else if (flow?.type === ProcessNodeType.TRANSACT) {
        requireComments = !!flow.options?.requireTransactComments;
      }
      let paddingOperators: string[] = item.paddingOperators;
      const startMeta = Object.values(startRecord?.metas || {}).find(meta => typeof meta?.singleOnceTimeTask === "boolean");
      const emptyRowStartMeta = this.getEmptyRowTriggerStartMeta(startRecord);
      const operationTriggerActionName = this.isOperationEmptyRowTrigger(startRecord)
        ? String(emptyRowStartMeta?.operationDisplayName || "").trim()
        : undefined;
      if (flow && (item.status === ProcessNodeStatus.IN_PROGRESS) && !paddingOperators) {
        paddingOperators = await this.getOwnersByNode({ nocodeId: nocodeId, tableId, uuid, todoId: item.todoId }, flow, startRecord?.operators?.[0]);
      }
      const activePaddingOperators = flow && item.status === ProcessNodeStatus.IN_PROGRESS
        ? this.getActivePendingOperatorIds(flow, paddingOperators, item.operators)
        : paddingOperators;
      let canViewCurrentData = true;
      if (
        [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(item.type)
        && item.status === ProcessNodeStatus.IN_PROGRESS
      ) {
        const canViewCacheKey = `${nocodeId}:${tableId}:${uuid}:${userId}:${readableStageKey}`;
        const cachedCanViewCurrentData = canViewCurrentDataCache.get(canViewCacheKey);
        if (cachedCanViewCurrentData !== undefined) {
          canViewCurrentData = cachedCanViewCurrentData;
        } else {
          canViewCurrentData = await this.canUserViewTodoData({ nocodeId, tableId, uuid }, userId, {
            startRecord,
          });
          canViewCurrentDataCache.set(canViewCacheKey, canViewCurrentData);
        }
      }
      let reportData: Row | null = null;
      let todoData: Row = row;
      let reportTargetNocodeId: string | undefined;
      let reportTargetTableId: TableUID | undefined;
      let reportTargetUUID: string | undefined;
      let formName = table?.alias || global.i18next.t('formFlowService.unknownForm');
      let fields = bucket?.fields?.filter(field => {
        if (isSystemField(field)) return true;
        const permissionAuthValue = this.getFieldAuthValue(permissionFieldAuth, field, 0);
        const flowAuthValue = this.getFieldAuthValue(flowFieldAuth, field, 0);
        return Math.min(permissionAuthValue, flowAuthValue) > 0;
      }) || [];
      const executionContext = await getCachedFlowExecutionContext(item.todoId);
      const upstreamContext = executionContext?.causedByTodoId
        ? await getCachedFlowExecutionContext(executionContext.causedByTodoId).catch(() => null)
        : null;
      const upstreamTermination = upstreamContext?.finalStatus === ProcessNodeStatus.CANCELED
        ? "canceled"
        : upstreamContext?.finalStatus === ProcessNodeStatus.REJECTED
          ? "rejected"
          : undefined;
      const isCompletedTodo = [
        ProcessNodeStatus.FINISHED,
        ProcessNodeStatus.REJECTED,
        ProcessNodeStatus.CANCELED,
      ].includes(executionContext?.finalStatus);
      if (isCompletedTodo && executionContext?.displayRowSnapshot) {
        todoData = deepClone(executionContext.displayRowSnapshot);
      }
      const shouldApplyStashContext = item.status === ProcessNodeStatus.IN_PROGRESS && item.isStashed === true;
      const nodeStashContext = shouldApplyStashContext
        ? this.getNodeStashContext(executionContext?.data, flow?.uid)
        : null;
      if (nodeStashContext?.row && flow?.type !== ProcessNodeType.REPORT_DATA) {
        todoData = nodeStashContext.row as Row;
      }

      if (flow?.type === ProcessNodeType.REPORT_DATA && flow.options?.targetTableUID) {
        const targetBody = await this.getFlowNocodeBody(nocodeId).catch(() => null);
        if (targetBody) {
          const resolvedTarget = this.resolveProcessTargetTable(nocodeId, targetBody, flow.options.targetTableUID);
          const targetPermissionKey = `${resolvedTarget.targetNocodeId}:${resolvedTarget.targetTable.uid}`;
          let targetPermissionFieldAuth = fieldPermissionAuthCache.get(targetPermissionKey);
          if (targetPermissionFieldAuth === undefined) {
            let targetPermissionBody = targetBody;
            if (resolvedTarget.targetNocodeId !== nocodeId) {
              targetPermissionBody = targetBodyCache.get(resolvedTarget.targetNocodeId);
              if (targetPermissionBody === undefined) {
                targetPermissionBody = await this.getFlowNocodeBody(resolvedTarget.targetNocodeId).catch(() => null);
                targetBodyCache.set(resolvedTarget.targetNocodeId, targetPermissionBody);
              }
            }
            targetPermissionFieldAuth = await this.getMemberFieldAuth(
              targetPermissionBody || undefined,
              resolvedTarget.targetTable.uid,
              userId,
              memberRangeUsersCache,
              isAdmin,
            );
            fieldPermissionAuthCache.set(targetPermissionKey, targetPermissionFieldAuth);
          }
          fields = resolvedTarget.targetTable.fields.filter(field => {
            if (isSystemField(field)) return true;
            const permissionAuthValue = this.getFieldAuthValue(targetPermissionFieldAuth, field, 0);
            const flowAuthValue = this.getFieldAuthValue(flowFieldAuth, field, 0);
            return Math.min(permissionAuthValue, flowAuthValue) > 0;
          });
          formName = resolvedTarget.targetTable.alias || formName;
          reportTargetNocodeId = resolvedTarget.targetNocodeId;
          reportTargetTableId = resolvedTarget.targetTable.uid;
          const reportStashContext = shouldApplyStashContext
            ? this.getReportDataStashContext(executionContext?.data, flow.uid)
            : null;
          if (
            reportStashContext?.targetNocodeId === resolvedTarget.targetNocodeId
            && reportStashContext?.targetTableUID === resolvedTarget.targetTable.uid
            && reportStashContext?.row
          ) {
            reportData = reportStashContext.row;
            todoData = reportStashContext.row as Row;
            reportTargetUUID = String(
              reportStashContext.targetUUID
              || reportStashContext.row?.[SystemField.UUID]
              || "",
            ) || undefined;
          } else {
            const stashedTargetMeta = this.getReportDataStashedTargetMeta(item, userId);
            if (
              stashedTargetMeta
              && stashedTargetMeta.stashedTargetNocodeId === resolvedTarget.targetNocodeId
              && stashedTargetMeta.stashedTargetTableUID === resolvedTarget.targetTable.uid
              && stashedTargetMeta.stashedTargetUUID
            ) {
              reportData = await this.loadRowByUUID(
                resolvedTarget.targetFormData,
                resolvedTarget.targetNocodeId,
                resolvedTarget.targetTable,
                stashedTargetMeta.stashedTargetUUID,
              );
              reportTargetUUID = stashedTargetMeta.stashedTargetUUID;
            }
          }
          if (!reportTargetUUID && reportData?.[SystemField.UUID]) {
            reportTargetUUID = String(reportData[SystemField.UUID]);
          }
        }
      }
      return {
        flowName: flow?.options?.name || global.i18next.t('formFlowService.unknownNode'),
        formName,
        flowStartTime: startRecord?.startTime,
        flowStartOperator: startRecord?.operators?.[0],
        allowCancel,
        ...item,
        processVersion: this.getRecordProcessVersion(item),
        currentFlowId: (item as any).currentFlowId,
        isStashed: item.isStashed,
        stashTime: item.stashTime,
        stashOperatorId: item.stashOperatorId,
        paddingOperators: activePaddingOperators,
        data: todoData,
        reportData,
        reportTargetNocodeId,
        reportTargetTableId,
        reportTargetUUID,
        canViewCurrentData,
        requireComments,
        singleOnceTimeTask: startMeta?.singleOnceTimeTask,
        operationTriggerActionName,
        processingTime: this.buildTodoProcessingTime(item, currentFlow || flow),
        ...(!isCompletedTodo && executionContext?.causedByTodoId && upstreamTermination ? {
          upstream: {
            todoId: executionContext.causedByTodoId,
            termination: upstreamTermination,
          },
        } : {}),
        flows,
        fields, /*
          if (isSystemField(field)) return true;
          // TODO: 这里得考虑一下结束还有抄送的节点或者没有可见权限的节点
          const permissionAuthValue = this.getFieldAuthValue(permissionFieldAuth, field, 0);
          const flowAuthValue = this.getFieldAuthValue(flowFieldAuth, field, 0);
          return Math.min(permissionAuthValue, flowAuthValue) > 0;
        */
      } as TODO;
    }))
  }

  async getTodo(options: GetTodoParams, userId: string) {
    const findLatestRecord = async (query: FilterQuery<FlowExecutionRecords>) => {
      return await this.flowExecutionRecordsRepository.findOne(query, {
        orderBy: {
          startTime: "DESC",
        }
      });
    };

    let record: FlowExecutionRecords | null = null;

    if (options.id) {
      record = await findLatestRecord({
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        uuid: options.uuid,
        id: options.id,
      });
    }

    if (!record && options.todoId) {
      record = await findLatestRecord({
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        uuid: options.uuid,
        todoId: options.todoId,
        status: ProcessNodeStatus.IN_PROGRESS,
      });

      if (!record) {
        record = await findLatestRecord({
          nocodeId: options.nocodeId,
          tableId: options.tableUID,
          uuid: options.uuid,
          todoId: options.todoId,
        });
      }
    }

    if (!record) {
      const activeRecord = await findLatestRecord({
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        uuid: options.uuid,
        status: ProcessNodeStatus.IN_PROGRESS,
      });
      record = activeRecord || await findLatestRecord({
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        uuid: options.uuid,
      });
    }
    if (!record) return null;
    const body = await getNocodeBody(this.nocodesDir, options.nocodeId).catch(() => null);
    if (!body) return null;
    const formDatas = [{ nocodeId: options.nocodeId, formData: body.formData }];
    const todos = await this.convertTodos([record], formDatas, userId);
    return todos[0] ?? null;
  }

  private decorateBranchFlows(flows: ProcessFlow[]) {
    return flows.map(flow => {
      if (!isBranchNode(flow.type)) return flow;

      if (!flow.options) {
        const isConditionBranch = flow.type === ProcessNodeType.CONDITION_BRANCH;
        flow.options = {
          name: isConditionBranch ? global.i18next.t('formFlowService.conditionBranchNode') : global.i18next.t('formFlowService.parallelBranchNode'),
        }
      }

      flow.branches = (flow.branches || []).map((branch, index) => {
        branch['flowName'] = index === flow.branches.length - 1
          ? global.i18next.t('formFlowService.otherBranch')
          : branch.flows[0]?.options?.name;
        branch.flows = this.decorateBranchFlows(branch.flows);
        return branch;
      });
      return flow;
    });
  }

  private async getProcessFlowTemplates(options: BaseTodoOptions) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const process = nocodeBody.formData.formOptions[options.tableId]?.process;
    if (!process) return { allFlows: [], entryFlows: [] };

    const startRecord = await this.getStartRecord(options);
    const allFlows = this.decorateBranchFlows(deepClone(
      this.getFlowsByVersion(process, this.getRecordProcessVersion(startRecord)) || []
    ));
    const entryId = Object.values(startRecord?.metas || {}).find(meta => meta.entryId)?.entryId;
    const startFlow = allFlows[0];
    const followingTopLevelFlows = allFlows.slice(1);
    const branch = startFlow?.branches?.find(b => entryId ? (b.uid === entryId) : (b.flows[0].type === ProcessNodeType.TRIGGER_DATA_CHANGE));

    if (!startFlow || !branch) {
      return { allFlows, entryFlows: [] };
    }

    return {
      allFlows,
      entryFlows: [
        { ...deepClone(startFlow), branches: [] },
        ...deepClone(branch.flows),
        ...deepClone(followingTopLevelFlows),
      ],
    };
  }

  private getDisplayFlowPath(
    flows: ProcessFlow[],
    flowId: string,
    ancestors: DisplayFlowAncestor[] = [],
  ): DisplayFlowPath | null {
    for (const flow of flows || []) {
      if (flow.uid === flowId) {
        return {
          flow,
          ancestors,
        };
      }
      for (const branch of flow.branches || []) {
        const found = this.getDisplayFlowPath(branch.flows, flowId, [...ancestors, { flow, branch }]);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private createDisplayBranchFlow(flow: ProcessFlow) {
    return {
      ...deepClone(flow),
      branches: [],
      flowName: flow?.options?.name,
    };
  }

  private createDisplayBranch(branch: ProcessBranch) {
    return {
      ...deepClone(branch),
      flows: [],
      flowName: branch['flowName'] || branch.flows?.[0]?.options?.name,
    };
  }

  private createDisplayRecord(flow: ProcessFlow, record: FlowExecutionRecords) {
    return {
      ...deepClone(flow),
      ...record,
      options: deepClone(flow?.options),
      flowName: flow?.options?.name || flow['flowName'],
    };
  }

  private hasDisplayFlowReference(
    flows: ProcessFlow[],
    targetFlow: ProcessFlow,
  ) {
    for (const flow of flows || []) {
      if (flow === targetFlow) {
        return true;
      }
      for (const branch of flow.branches || []) {
        if (this.hasDisplayFlowReference(branch.flows, targetFlow)) {
          return true;
        }
      }
    }

    return false;
  }

  private insertRollbackReplayFlows(
    flows: ProcessFlow[],
    rollbackReplayPlan?: ReturnType<typeof getRollbackReplayPlan>,
    lockedFlow?: ProcessFlow | null,
  ) {
    if (!rollbackReplayPlan) {
      return {
        inserted: false,
        insertedAtCurrentLevel: false,
        insertedFlows: null,
      };
    }

    const insertAfterIndex = flows.findLastIndex(item => item.uid === rollbackReplayPlan.insertAfterFlowId);
    const canInsertInCurrentFlows = insertAfterIndex > -1 && (
      flows.some(item => item.uid === rollbackReplayPlan.backFlowId)
      || (lockedFlow ? this.hasDisplayFlowReference(flows, lockedFlow) : false)
    );
    if (canInsertInCurrentFlows) {
      const replayFlows = deepClone(rollbackReplayPlan.replayFlows).map(replayFlow => {
        delete replayFlow["status"];
        return replayFlow;
      });
      flows.splice(insertAfterIndex + 1, 0, ...replayFlows);
      return {
        inserted: true,
        insertedAtCurrentLevel: true,
        insertedFlows: flows,
      };
    }

    for (const flow of flows || []) {
      for (const branch of flow.branches || []) {
        const result = this.insertRollbackReplayFlows(branch.flows, rollbackReplayPlan, lockedFlow);
        if (result.inserted) {
          return {
            inserted: true,
            insertedAtCurrentLevel: false,
            insertedFlows: result.insertedFlows,
          };
        }
      }
    }

    return {
      inserted: false,
      insertedAtCurrentLevel: false,
      insertedFlows: null,
    };
  }

  private getOrCreateDisplayBranchFlows(
    flows: ProcessFlow[],
    branchFlow: ProcessFlow,
    branch: ProcessBranch,
  ) {
    const lastFlow = flows.at(-1);
    let displayBranchFlow = lastFlow?.uid === branchFlow.uid && isBranchNode(lastFlow.type)
      ? lastFlow
      : null;

    if (!displayBranchFlow) {
      displayBranchFlow = this.createDisplayBranchFlow(branchFlow);
      flows.push(displayBranchFlow);
    }

    let displayBranch = displayBranchFlow.branches?.find(item => item.uid === branch.uid);
    if (!displayBranch) {
      displayBranch = this.createDisplayBranch(branch);
      displayBranchFlow.branches = displayBranchFlow.branches || [];
      displayBranchFlow.branches.push(displayBranch);
    }

    return displayBranch.flows;
  }

  private appendDisplayRecord(
    flows: ProcessFlow[],
    path: DisplayFlowPath,
    record: FlowExecutionRecords,
  ) {
    let currentFlows = flows;
    for (const ancestor of path.ancestors) {
      currentFlows = this.getOrCreateDisplayBranchFlows(currentFlows, ancestor.flow, ancestor.branch);
    }
    currentFlows.push(this.createDisplayRecord(path.flow, record));
  }

  private appendDisplayFlow(
    flows: ProcessFlow[],
    path: DisplayFlowPath,
  ) {
    let currentFlows = flows;
    for (const ancestor of path.ancestors) {
      currentFlows = this.getOrCreateDisplayBranchFlows(currentFlows, ancestor.flow, ancestor.branch);
    }
    currentFlows.push(deepClone(path.flow));
  }

  private isParallelBranchPath(path?: DisplayFlowPath | null) {
    return !!path?.ancestors?.some((ancestor) => ancestor.flow.type === ProcessNodeType.PARALLEL_BRANCH);
  }

  private getParallelBranchAncestor(path?: DisplayFlowPath | null) {
    return [...(path?.ancestors || [])]
      .reverse()
      .find((ancestor) => ancestor.flow.type === ProcessNodeType.PARALLEL_BRANCH) || null;
  }

  private appendParallelBranchTail(
    displayFlows: ProcessFlow[],
    displayTemplateFlows: ProcessFlow[],
    path: DisplayFlowPath,
  ) {
    const parallelBranchAncestor = this.getParallelBranchAncestor(path);
    if (!parallelBranchAncestor) {
      return;
    }

    const branchFlows = parallelBranchAncestor.branch.flows || [];
    const branchFlowIndex = branchFlows.findIndex((flow) => flow.uid === path.flow.uid);
    if (branchFlowIndex < 0) {
      return;
    }

    const parallelBranchDisplayPath = this.getDisplayFlowPath(displayFlows, parallelBranchAncestor.flow.uid);
    const parallelBranchDisplayFlow = parallelBranchDisplayPath?.flow;
    const displayBranch = parallelBranchDisplayFlow?.branches?.find((branch) => branch.uid === parallelBranchAncestor.branch.uid);
    if (!displayBranch) {
      return;
    }

    const existingFlowIds = new Set((displayBranch.flows || []).map((flow) => flow.uid));
    for (const branchFlow of branchFlows.slice(branchFlowIndex + 1)) {
      if (existingFlowIds.has(branchFlow.uid)) {
        continue;
      }
      const branchFlowPath = this.getDisplayFlowPath(displayTemplateFlows, branchFlow.uid);
      if (!branchFlowPath?.flow) {
        continue;
      }
      displayBranch.flows.push(deepClone(branchFlowPath.flow));
      existingFlowIds.add(branchFlow.uid);
    }
  }

  private appendAdditionalActiveParallelBranchTails(
    displayFlows: ProcessFlow[],
    displayTemplateFlows: ProcessFlow[],
    activeParallelTails: ActiveParallelTail[],
    skippedFlowIds: Set<string>,
  ) {
    for (const activeParallelTail of activeParallelTails) {
      if (skippedFlowIds.has(activeParallelTail.record.flowId)) {
        continue;
      }
      this.appendParallelBranchTail(displayFlows, displayTemplateFlows, activeParallelTail.path);
    }
  }

  async getFlowRecords(options: GetFlowRecordsParams) {
    return await this.getFlowRecordsLegacy(options);
  }

  async getAllFlows(options: BaseTodoOptions) {
    const { allFlows, entryFlows } = await this.getProcessFlowTemplates(options);
    if (isEmpty(allFlows) || isEmpty(entryFlows)) {
      return {
        allFlows,
        flows: [],
      };
    }

    const filterFLows = (flows: ProcessFlow[]) => {
      return flows.map(flow => {
        if (isBranchNode(flow.type)) {
          if (isBranchNode(flow.type) && !flow.options) {
            const isConditionBranch = flow.type === ProcessNodeType.CONDITION_BRANCH;
            flow.options = {
              name: isConditionBranch ? global.i18next.t('formFlowService.conditionBranchNode') : global.i18next.t('formFlowService.parallelBranchNode'),
            }
          }
          flow.branches = flow.branches.map((branch, index) => {
            if (isBranchNode(flow.type)) {
              if (index === flow.branches.length - 1) {
                branch['flowName'] = global.i18next.t('formFlowService.otherBranch');
              } else {
                branch['flowName'] = branch.flows[0]?.options?.name;
              }
            }
            branch.flows = filterFLows(branch.flows);
            return branch;
          });
          return flow;
        } else {
          if(!isTriggerNode(flow.type) && ![ProcessNodeType.BRANCH_SETTING].includes(flow.type)) {
            delete flow['status']
            return flow;
          }
        }
      })?.filter(Boolean);
    }

    return {
      allFlows,
      entryFlows,
      flows: filterFLows(deepClone(entryFlows)),
    }
  }

  async getFlowRecordsLegacy(options: GetFlowRecordsParams) {
    const query: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
      uuid: options.uuid,
    };
    if (options.todoId) {
      query.todoId = options.todoId;
    }
    const flowRecords = await this.flowExecutionRecordsRepository.find(query, {
      orderBy: {
        startTime: "ASC",
      }
    })
    const startRecord = flowRecords.find(item => item.type === ProcessNodeType.START);
    const {
      entryFlows = [],
      flows: displayTemplateFlows,
    } = await this.getAllFlows(options);
    const displayFlows: ProcessFlow[] = [];
    const activeParallelTails: ActiveParallelTail[] = [];

    for (const record of flowRecords) {
      const path = this.getDisplayFlowPath(entryFlows, record.flowId);
      if (!path?.flow) {
        continue;
      }
      this.appendDisplayRecord(displayFlows, path, record);
      if (record.status === ProcessNodeStatus.IN_PROGRESS && this.isParallelBranchPath(path)) {
        activeParallelTails.push({
          record,
          path,
        });
      }
    }

    const lastRecord = flowRecords.at(-1);
    const lastRollbackMeta = lastRecord?.status === ProcessNodeStatus.BACK
      ? Object.values(lastRecord?.metas || {}).find(meta => meta.backId)
      : null;
    const tailAnchorFlowId = lastRollbackMeta?.backId || lastRecord?.flowId;
    const followingFlows = tailAnchorFlowId
      ? getFollowingFlows(entryFlows, tailAnchorFlowId)
      : [];

    for (const flow of followingFlows || []) {
      const path = this.getDisplayFlowPath(displayTemplateFlows, flow.uid);
      if (!path?.flow) {
        continue;
      }
      this.appendDisplayFlow(displayFlows, path);
    }

    this.appendAdditionalActiveParallelBranchTails(
      displayFlows,
      displayTemplateFlows,
      activeParallelTails,
      new Set(lastRecord?.flowId ? [lastRecord.flowId] : []),
    );

    const decorateDisplayFlows = async (flows: ProcessFlow[]) => {
      return await Promise.all(flows.map(async flow => {
        let paddingOperators: string[] = [];
        if (!flow['status'] || flow['status'] === ProcessNodeStatus.IN_PROGRESS) {
          if ([ProcessNodeType.REPORT_DATA ,ProcessNodeType.TRANSACT, ProcessNodeType.APPROVAL, ProcessNodeType.NOTIFY].includes(flow?.type)) {
            let owners: string[] = flow['paddingOperators'];
            if (!flow['status'] || !owners) {
              owners = await this.getOwnersByNode(options, flow, startRecord.operators[0]);
            }
            paddingOperators = owners;
          }
        }
        if (flow.branches) {
          flow.branches = await Promise.all(flow.branches.map(async branch => {
            branch.flows = await decorateDisplayFlows(branch.flows);
            return branch;
          }))
        }
        return {
          ...flow,
          paddingOperators,
          flowName: flow?.options?.name || flow['flowName'],
        }
      }))
    }

    return await decorateDisplayFlows(displayFlows);
  }

  async getAllFlowsLegacy(options: BaseTodoOptions) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const process = nocodeBody.formData.formOptions[options.tableId]?.process;
    if (!process) return { allFlows: [], flows: [] };
    const startRecord = await this.getStartRecord(options);
    const flows = deepClone(
      this.getFlowsByVersion(process, this.getRecordProcessVersion(startRecord)) || []
    );
    const entryId = Object.values(startRecord.metas || {}).find(meta => meta.entryId)?.entryId;
    const branch = flows[0].branches.find(b => entryId ? (b.uid === entryId) : (b.flows[0].type === ProcessNodeType.TRIGGER_DATA_CHANGE));
    if (!branch) return { allFlows: [], flows: [] };
    const decorateBranchFlows = (flows: ProcessFlow[]) => {
      return flows.map(flow => {
        if (!isBranchNode(flow.type)) return flow;

        if (!flow.options) {
          const isConditionBranch = flow.type === ProcessNodeType.CONDITION_BRANCH;
          flow.options = {
            name: isConditionBranch ? global.i18next.t('formFlowService.conditionBranchNode') : global.i18next.t('formFlowService.parallelBranchNode'),
          }
        }

        flow.branches = (flow.branches || []).map((branch, index) => {
          branch['flowName'] = index === flow.branches.length - 1
            ? global.i18next.t('formFlowService.otherBranch')
            : branch.flows[0]?.options?.name;
          branch.flows = decorateBranchFlows(branch.flows);
          return branch;
        });
        return flow;
      });
    }
    const filterFLows = (flows: ProcessFlow[]) => {
      return flows.map(flow => {
        if (isBranchNode(flow.type)) {
          if (isBranchNode(flow.type) && !flow.options) {
            const isConditionBranch = flow.type === ProcessNodeType.CONDITION_BRANCH;
            flow.options = {
              name: isConditionBranch ? global.i18next.t('formFlowService.conditionBranchNode') : global.i18next.t('formFlowService.parallelBranchNode'),
            }
          }
          flow.branches = flow.branches.map((branch, index) => {
            if (isBranchNode(flow.type)) {
              if (index === flow.branches.length - 1) {
                branch['flowName'] = global.i18next.t('formFlowService.otherBranch');
              } else {
                branch['flowName'] = branch.flows[0]?.options?.name;
              }
            }
            branch.flows = filterFLows(branch.flows);
            return branch;
          });
          return flow;
        } else {
          if(!isTriggerNode(flow.type) && ![ProcessNodeType.BRANCH_SETTING].includes(flow.type)) {
            delete flow['status']
            return flow;
          }
        }
      })?.filter(Boolean);
    }
    return {
      allFlows: decorateBranchFlows(deepClone(flows)),
      flows: filterFLows([flows[0], ...branch.flows, flows[1]]),
    }
  }

  private normalizeOpinionFiles(files?: FlowOpinionFile[]) {
    return (files || [])
      .filter((file) => file?.name && file?.url)
      .map((file) => ({
        uid: file.uid || unique(),
        name: file.name,
        status: file.status || 'success',
        size: file.size,
        url: file.url,
      }));
  }

  private hasOpinionContent(options: Pick<SubmitTodoOptions, "comment" | "commentImages" | "commentFiles">) {
    return !!(
      options.comment ||
      options.commentImages?.length ||
      options.commentFiles?.length
    );
  }

  private applyOpinionToMeta(
    meta: Record<string, any>,
    options: Pick<SubmitTodoOptions, "comment" | "commentImages" | "commentFiles">,
    time = Date.now(),
  ) {
    const images = this.normalizeOpinionFiles(options.commentImages);
    const files = this.normalizeOpinionFiles(options.commentFiles);

    meta.updateTime = time;
    if (options.comment) {
      meta.comment = options.comment;
    }
    if (images.length) {
      meta.commentImages = images;
    }
    if (files.length) {
      meta.commentFiles = files;
    }

    return meta;
  }

  private ensureFlowRecordMeta(record: FlowExecutionRecords, userId: string): FlowExecutionRecordMeta {
    const metas = record.metas || {};
    metas[userId] = metas[userId] || {};
    record.metas = metas;
    return metas[userId];
  }

  private buildOpinionSubmitRecord(
    userId: string,
    options: Pick<SubmitTodoOptions, "comment" | "commentImages" | "commentFiles">,
    extra: Partial<SubmitRecord> = {},
  ) {
    const time = extra.time || Date.now();
    const record: SubmitRecord = {
      userId,
      time,
      ...extra,
    };
    const images = this.normalizeOpinionFiles(options.commentImages);
    const files = this.normalizeOpinionFiles(options.commentFiles);

    if (options.comment) {
      record.comment = options.comment;
    }
    if (images.length) {
      record.commentImages = images;
    }
    if (files.length) {
      record.commentFiles = files;
    }

    return record;
  }

  private async resolveSubmitTodoRuntimeContext(options: SubmitTodoOptions): Promise<SubmitTodoRuntimeContext> {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    const flowRecord = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!flowRecord) throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));

    const flows = await this.getInstanceFlows(process, options, flowRecord);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) throw new Error(global.i18next.t('formFlowService.processNotFound'));

    const table = formData.tables.find(t => t.uid === options.tableId);
    if (!table) {
      throw new Error(global.i18next.t('formFlowService.processNotFound'));
    }

    const uuidFiled = getUUIDSystemField(table.fields);
    if (!uuidFiled) {
      throw new Error(global.i18next.t('formFlowService.processNotFound'));
    }

    return {
      nocodeBody,
      formData,
      process,
      flowRecord,
      flows,
      flow,
      table,
      uuidFiled,
    };
  }

  private async resolveFlowRecordOwners(
    options: Pick<BaseTodoOptions, "nocodeId" | "tableId" | "uuid" | "todoId">,
    flowRecord: FlowExecutionRecords,
    flow: ProcessFlow,
  ) {
    const owners = Array.isArray(flowRecord.paddingOperators) && flowRecord.paddingOperators.length
      ? flowRecord.paddingOperators
      : await (async () => {
          const startRecord = await this.getStartRecord(options);
          return this.getOwnersByNode(options, flow, startRecord?.operators?.[0]);
        })();

    return Array.from(new Set((owners || []).filter((item): item is string => typeof item === "string" && item.length > 0)));
  }

  private getPendingFlowRecordOwners(owners: string[] = [], operators: string[] = []) {
    const handledOperatorSet = new Set((operators || []).filter((item): item is string => typeof item === "string" && item.length > 0));
    return owners.filter(userId => !handledOperatorSet.has(userId));
  }

  private applyTimeoutAutoActionToMetas(
    record: FlowExecutionRecords,
    userIds: string[] = [],
    action: FlowExecutionRecordMeta["timeoutAutoAction"],
  ) {
    const updateTime = Date.now();
    userIds
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .forEach((userId) => {
        const meta = this.ensureFlowRecordMeta(record, userId);
        meta.updateTime = updateTime;
        meta.timeoutAutoAction = action;
      });
  }

  private async createImplicitNotifyRecord(options: BaseTodoOptions, flow: ProcessFlow, notifyUserIds: string[] = []) {
    if (!notifyUserIds.length) {
      return;
    }

    const record = await this.createRecord(options, { ...flow, type: ProcessNodeType.NOTIFY }, ProcessNodeStatus.FINISHED);
    record.operators = notifyUserIds;
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
  }

  private async resolveTimeoutAutoSubmitUserId(record: FlowExecutionRecords) {
    const pendingUserIds = this.getPendingFlowRecordOwners(record.paddingOperators || [], record.operators || []);
    if (pendingUserIds[0]) {
      return pendingUserIds[0];
    }

    const validPendingUsers = await this.workbenchService.filterValidUsers(record.paddingOperators || []).catch(() => []);
    if (validPendingUsers?.[0]?.id) {
      return validPendingUsers[0].id;
    }

    return await this.getTimeoutExecutorUserId(record);
  }

  private async submitApprovalTodo(options: SubmitTodoOptions, flows: ProcessFlow[], flow: ProcessFlow, userId: string) {
    const { approverType, categoryRule } = flow.options;
    const flowRecord = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!flowRecord) throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    let owners = flowRecord.paddingOperators;
    if (!owners) {
      const startRecord = await this.getStartRecord(options);
      owners = await this.getOwnersByNode(options, flow, startRecord.operators[0]);
    }
    if (categoryRule === ApprovalCategoryRule.NORMAL && approverType !== ApproverType.SEQUENTIAL) {
      if (approverType === ApproverType.OR) {
        flowRecord.operators = [userId];
        flowRecord.status = ProcessNodeStatus.FINISHED;
        flowRecord.endTime = Date.now();
        if (this.hasOpinionContent(options)) {
          this.applyOpinionToMeta(this.ensureFlowRecordMeta(flowRecord, userId), options, flowRecord.endTime);
        }
        await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
        // 隐含的抄送：给其他审批人员抄送一�?
        const notifyOwners = owners.filter(id => id !== userId);
        if (!isEmpty(notifyOwners)) {
          const record = await this.createRecord(options, { ...flow, type: ProcessNodeType.NOTIFY }, ProcessNodeStatus.FINISHED);
          record.operators = notifyOwners;
          await this.flowExecutionRecordsRepository.persistAndFlush(record);
        }
        return true;
      } else if (approverType === ApproverType.AND) {
        const metas = flowRecord.metas || {};
        if (!metas[userId]) metas[userId] = {};
        
        if (!flowRecord.operators) flowRecord.operators = [];
        if (!flowRecord.operators.includes(userId)) {
          flowRecord.operators.push(userId);
          if (this.hasOpinionContent(options)) {
            this.applyOpinionToMeta(metas[userId], options);
          } else {
            metas[userId].updateTime = Date.now();
          }
        }
        flowRecord.metas = metas;
        // const startRecord = await this.getStartRecord(options);
        // const users = await this.getOwnersByNode(options, flow, startRecord.operators[0]);
        const isFinish = owners.every(id => flowRecord.operators.includes(id));
        if (isFinish) {
          flowRecord.status = ProcessNodeStatus.FINISHED;
          flowRecord.endTime = Date.now();
        }
        await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
        if (isFinish) {
          return true;
        }
      }
    } else {
      // 逐级审批
      const currentOperatorIds = this.getActivePendingOperatorIds(flow, owners, flowRecord.operators);
      if (!currentOperatorIds.includes(userId)) throw new Error(global.i18next.t('formFlowService.noApprovePerm'));
      const operators = flowRecord.operators || [];
      operators.push(userId);
      flowRecord.operators = operators;
      const meta = this.ensureFlowRecordMeta(flowRecord, userId);
      meta.updateTime = Date.now();
      if (this.hasOpinionContent(options)) {
        this.applyOpinionToMeta(meta, options, meta.updateTime);
      }
      const isFinish = operators.length === owners.length && owners.every(id => operators.includes(id));
      if (isFinish) {
        flowRecord.status = ProcessNodeStatus.FINISHED;
        flowRecord.endTime = Date.now();
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
      if (isFinish) {
        return true;
      }
    }
  }

  private async submitTransactTodo(options: SubmitTodoOptions, flows: ProcessFlow[], flow: ProcessFlow, userId: string) {
    const { transactorType, requireSatisfyCondition } = flow.options;
    const flowRecord = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!flowRecord)  throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    let isSatisfy = true;
    let isFinish = true;
    let _errorMsg = "";
    
    let owners = flowRecord.paddingOperators;
    if (!owners) {
      const startRecord = await this.getStartRecord(options);
      owners = await this.getOwnersByNode(options, flow, startRecord.operators[0]);
    }
    if (transactorType === ApproverType.AND) {
      if (!flowRecord.operators) flowRecord.operators = [];
      if (!flowRecord.operators.includes(userId)) {
        flowRecord.operators.push(userId);
      }
      isFinish = owners.every(id => flowRecord.operators.includes(id));
      if (requireSatisfyCondition) {
        const submitRecords = flowRecord.submitRecords || [];
        submitRecords.push(this.buildOpinionSubmitRecord(userId, options))
        flowRecord.submitRecords = submitRecords;
        if (isFinish) {
          const { valid: isSatisfy, errorMsg } = await this.isSatisfyFinishConditions(flow, options.nocodeId, options.tableId, options.row);
          submitRecords.push({
            userId,
            time: Date.now(),
            satisfy: isSatisfy,
          })
          if (!isSatisfy) {
            _errorMsg = errorMsg || global.i18next.t('formFlowService.handleNotMeetFinishCond');
            isFinish = false;
            flowRecord.operators = [];
          }
        }
      } else {
        const metas = flowRecord.metas || {};
        if (!metas[userId]) metas[userId] = {};
        if (this.hasOpinionContent(options)) {
          this.applyOpinionToMeta(metas[userId], options);
        } else {
          metas[userId].updateTime = Date.now();
        }
        flowRecord.metas = metas;
      }
      if (isFinish) {
        flowRecord.status = ProcessNodeStatus.FINISHED;
        flowRecord.endTime = Date.now();
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
    } else if (transactorType === ApproverType.SEQUENTIAL) {
      const currentOperatorIds = this.getActivePendingOperatorIds(flow, owners, flowRecord.operators);
      if (!currentOperatorIds.includes(userId)) throw new Error(global.i18next.t('formFlowService.noHandlePerm'));
      const operators = flowRecord.operators || [];
      flowRecord.operators = operators;
      operators.push(userId);
      isFinish = operators.length === owners.length && owners.every(id => operators.includes(id));

      if (requireSatisfyCondition) {
        const submitRecords = flowRecord.submitRecords || [];
        submitRecords.push(this.buildOpinionSubmitRecord(userId, options));
        flowRecord.submitRecords = submitRecords;
        if (isFinish) {
          const res = await this.isSatisfyFinishConditions(flow, options.nocodeId, options.tableId, options.row);
          isSatisfy = res.valid;
          submitRecords.push({
            userId,
            time: Date.now(),
            satisfy: isSatisfy,
          })
          if (!isSatisfy) {
            _errorMsg = res.errorMsg || global.i18next.t('formFlowService.handleNotMeetFinishCond');
            isFinish = false;
            flowRecord.operators = [];
          }
        }
      } else {
        const meta = this.ensureFlowRecordMeta(flowRecord, userId);
        meta.updateTime = Date.now();
        if (this.hasOpinionContent(options)) {
          this.applyOpinionToMeta(meta, options, meta.updateTime);
        }
      }

      if (isFinish) {
        flowRecord.status = ProcessNodeStatus.FINISHED;
        flowRecord.endTime = Date.now();
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
    } else {
      if (requireSatisfyCondition) {
        const submitRecords = flowRecord.submitRecords || [];
        submitRecords.push(this.buildOpinionSubmitRecord(userId, options))
        flowRecord.submitRecords = submitRecords;
        const res = await this.isSatisfyFinishConditions(flow, options.nocodeId, options.tableId, options.row);
        isSatisfy = res.valid;
        submitRecords.push({
          userId,
          time: Date.now(),
          satisfy: isSatisfy,
        })
        if (!isSatisfy) {
          _errorMsg = res.errorMsg || global.i18next.t('formFlowService.handleNotMeetFinishCond');
          isFinish = false;
        }
      } else {
        if (this.hasOpinionContent(options)) {
          this.applyOpinionToMeta(this.ensureFlowRecordMeta(flowRecord, userId), options);
        }
      }
      if (isFinish) {
        flowRecord.operators = [userId];
        flowRecord.status = ProcessNodeStatus.FINISHED;
        flowRecord.endTime = Date.now();
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
      if (isFinish) {
        // 隐含的抄送：给其他办理人员抄送一�?
        // const startRecord = await this.getStartRecord(options);
        // const owners = await this.getOwnersByNode(options, flow, startRecord.operators[0]);
        const notifyOwners = owners.filter(id => id !== userId);
        if (!isEmpty(notifyOwners)) {
          const record = await this.createRecord(options, { ...flow, type: ProcessNodeType.NOTIFY }, ProcessNodeStatus.FINISHED);
          record.operators = notifyOwners;
          await this.flowExecutionRecordsRepository.persistAndFlush(record);
        }
      }
    }

    return {
      isFinish,
      errorMsg: _errorMsg,
    };
  }

  private async autoSubmitApprovalTodo(
    options: SubmitTodoOptions,
    flow: ProcessFlow,
    flowRecord: FlowExecutionRecords,
    owners: string[],
  ): Promise<AutoSubmitTodoResult> {
    const handledUserIds = Array.isArray(flowRecord.operators)
      ? flowRecord.operators.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const pendingUserIds = this.getPendingFlowRecordOwners(owners, handledUserIds);
    if (!pendingUserIds.length) {
      return {
        isFinish: flowRecord.status === ProcessNodeStatus.FINISHED,
        autoHandledUserIds: [],
      };
    }

    const { approverType, categoryRule } = flow.options;

    if (categoryRule === ApprovalCategoryRule.NORMAL && approverType === ApproverType.OR) {
      const autoHandledUserIds = [pendingUserIds[0]];
      flowRecord.operators = autoHandledUserIds;
      flowRecord.status = ProcessNodeStatus.FINISHED;
      flowRecord.endTime = Date.now();
      this.applyTimeoutAutoActionToMetas(flowRecord, autoHandledUserIds, "submit");
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);

      const notifyOwners = owners.filter(id => id !== autoHandledUserIds[0]);
      await this.createImplicitNotifyRecord(options, flow, notifyOwners);

      return {
        isFinish: true,
        autoHandledUserIds,
      };
    }

    const autoHandledUserIds = pendingUserIds;
    const autoHandledSet = new Set(autoHandledUserIds);
    const handledSet = new Set(handledUserIds);

    flowRecord.operators = owners.filter(userId => handledSet.has(userId) || autoHandledSet.has(userId));
    flowRecord.status = ProcessNodeStatus.FINISHED;
    flowRecord.endTime = Date.now();
    this.applyTimeoutAutoActionToMetas(flowRecord, autoHandledUserIds, "submit");
    await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);

    return {
      isFinish: true,
      autoHandledUserIds,
    };
  }

  private async autoSubmitTransactTodo(
    options: SubmitTodoOptions,
    flow: ProcessFlow,
    flowRecord: FlowExecutionRecords,
    owners: string[],
  ): Promise<AutoSubmitTodoResult> {
    const { transactorType, requireSatisfyCondition } = flow.options;
    const handledUserIds = Array.isArray(flowRecord.operators)
      ? flowRecord.operators.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const pendingUserIds = this.getPendingFlowRecordOwners(owners, handledUserIds);
    if (!pendingUserIds.length) {
      return {
        isFinish: flowRecord.status === ProcessNodeStatus.FINISHED,
        autoHandledUserIds: [],
      };
    }

    let isFinish = true;
    let errorMsg = "";

    if (transactorType === ApproverType.AND || transactorType === ApproverType.SEQUENTIAL) {
      const autoHandledUserIds = pendingUserIds;
      const autoHandledSet = new Set(autoHandledUserIds);
      const handledSet = new Set(handledUserIds);
      flowRecord.operators = owners.filter(userId => handledSet.has(userId) || autoHandledSet.has(userId));

      if (requireSatisfyCondition) {
        const submitRecords = flowRecord.submitRecords || [];
        autoHandledUserIds.forEach((userId) => {
          submitRecords.push(this.buildOpinionSubmitRecord(userId, options));
        });
        flowRecord.submitRecords = submitRecords;

        const res = await this.isSatisfyFinishConditions(flow, options.nocodeId, options.tableId, options.row);
        isFinish = res.valid;
        submitRecords.push({
          userId: autoHandledUserIds.at(-1),
          time: Date.now(),
          satisfy: isFinish,
        });
        if (!isFinish) {
          errorMsg = res.errorMsg || global.i18next.t('formFlowService.handleNotMeetFinishCond');
          flowRecord.operators = [];
          await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
          return {
            isFinish,
            errorMsg,
            autoHandledUserIds: [],
          };
        }
      }

      flowRecord.status = ProcessNodeStatus.FINISHED;
      flowRecord.endTime = Date.now();
      this.applyTimeoutAutoActionToMetas(flowRecord, autoHandledUserIds, "submit");
      await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);

      return {
        isFinish,
        errorMsg,
        autoHandledUserIds,
      };
    }

    const autoHandledUserIds = [pendingUserIds[0]];

    if (requireSatisfyCondition) {
      const submitRecords = flowRecord.submitRecords || [];
      submitRecords.push(this.buildOpinionSubmitRecord(autoHandledUserIds[0], options));
      flowRecord.submitRecords = submitRecords;

      const res = await this.isSatisfyFinishConditions(flow, options.nocodeId, options.tableId, options.row);
      isFinish = res.valid;
      submitRecords.push({
        userId: autoHandledUserIds[0],
        time: Date.now(),
        satisfy: isFinish,
      });
      if (!isFinish) {
        errorMsg = res.errorMsg || global.i18next.t('formFlowService.handleNotMeetFinishCond');
        await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
        return {
          isFinish,
          errorMsg,
          autoHandledUserIds: [],
        };
      }
    }

    flowRecord.operators = autoHandledUserIds;
    flowRecord.status = ProcessNodeStatus.FINISHED;
    flowRecord.endTime = Date.now();
    this.applyTimeoutAutoActionToMetas(flowRecord, autoHandledUserIds, "submit");
    await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);

    const notifyOwners = owners.filter(id => id !== autoHandledUserIds[0]);
    await this.createImplicitNotifyRecord(options, flow, notifyOwners);

    return {
      isFinish,
      errorMsg,
      autoHandledUserIds,
    };
  }

  private async autoSubmitTodo(options: SubmitTodoOptions): Promise<AutoSubmitTodoResult> {
    const runtimeContext = await this.resolveSubmitTodoRuntimeContext(options);
    const { formData, flowRecord, flows, flow, table, uuidFiled } = runtimeContext;

    if (flow.type === ProcessNodeType.REPORT_DATA) {
      const userId = await this.resolveTimeoutAutoSubmitUserId(flowRecord);
      if (!userId) {
        return {
          isFinish: false,
          autoHandledUserIds: [],
        };
      }

      const result = await this.submitTodo(options, userId);
      if (result?.isFinish) {
        const latestRecord = await this.flowExecutionRecordsRepository.findOne({ id: flowRecord.id }) || flowRecord;
        this.applyTimeoutAutoActionToMetas(latestRecord, [userId], "submit");
        await this.flowExecutionRecordsRepository.persistAndFlush(latestRecord);
      }

      return {
        isFinish: Boolean(result?.isFinish),
        errorMsg: result?.errorMsg,
        autoHandledUserIds: result?.isFinish ? [userId] : [],
      };
    }

    const owners = await this.resolveFlowRecordOwners(options, flowRecord, flow);
    let result: AutoSubmitTodoResult = {
      isFinish: false,
      autoHandledUserIds: [],
    };

    if (flow.type === ProcessNodeType.APPROVAL) {
      result = await this.autoSubmitApprovalTodo(options, flow, flowRecord, owners);
    } else if (flow.type === ProcessNodeType.TRANSACT) {
      result = await this.autoSubmitTransactTodo(options, flow, flowRecord, owners);
    }

    if (!result.isFinish) {
      return result;
    }

    const startRecord = await this.getStartRecord(options);
    if (!this.isEmptyRowTrigger(startRecord)) {
      const stageField = table.fields.find(f => f.meta.name === SystemField.DATA_STAGE);
      const stage = stageField ? options.row[stageField.uid] : undefined;
      await this.formDataService.updateData(
        formData,
        options.nocodeId,
        options.tableId,
        [{ ...options.row, [uuidFiled.uid]: options.uuid }],
        [[formData.uid, options.tableId, uuidFiled.uid]],
        stage,
      ).catch(() => {});
    }

    const branchFlow = getOwnerBranchFlow(flows, options.flowId);
    if (branchFlow && branchFlow?.type === ProcessNodeType.PARALLEL_BRANCH) {
      const branch = branchFlow.branches.find(b => getFlowById(b.flows, flow.uid));
      const lastFlow = branch?.flows?.at(-1);
      if (lastFlow?.uid === flow.uid) {
        const isFinish = await this.completeParallelBranch(options, branchFlow, branch.flows[0].uid);
        if (!isFinish) {
          await this.updateFlowData(options, { node: { type: "delete", value: [options.flowId] } });
          return result;
        }
      }
    }

    await this.updateFlowData(options, { node: { type: "delete", value: [options.flowId] } });
    const node = getNextFlow(flows, options.flowId);
    await this.addNextNode(options, flows, node, startRecord?.operators?.[0]);

    return result;
  }

  private async completeParallelBranch(options: BaseTodoOptions, branchFlow: ProcessFlow, branchId: string) {
    const query: FilterQuery<FlowBranchRecords> = {
      uuid: options.uuid,
      flowId: branchFlow.uid,
      status: ProcessNodeStatus.IN_PROGRESS,
    };
    if (options.todoId) query.todoId = options.todoId;
    const record = await this.flowBranchRecordsRepository.findOne(query);
    if (!record) return true;

    record.branchIds = (record.branchIds || []).filter(id => id !== branchId);
    if (record.branchIds.length === 0) {
      record.status = ProcessNodeStatus.FINISHED;
      await this.flowBranchRecordsRepository.persistAndFlush(record);
      return true;
    }

    await this.flowBranchRecordsRepository.persistAndFlush(record);
    return false;
  }

  private getFlowIds(flows: ProcessFlow[] = []) {
    const flowIds: string[] = [];
    for (const flow of flows) {
      flowIds.push(flow.uid);
      for (const branch of flow.branches || []) {
        flowIds.push(...this.getFlowIds(branch.flows));
      }
    }
    return flowIds;
  }

  private getParallelBranchFlowIds(flows: ProcessFlow[] = []) {
    const flowIds: string[] = [];
    for (const flow of flows) {
      if (flow.type === ProcessNodeType.PARALLEL_BRANCH) {
        flowIds.push(flow.uid);
      }
      for (const branch of flow.branches || []) {
        flowIds.push(...this.getParallelBranchFlowIds(branch.flows));
      }
    }
    return flowIds;
  }

  private getExitedParallelBranchFlows(flows: ProcessFlow[], currentFlowId: string, targetFlowId: string) {
    const branchFlows: ProcessFlow[] = [];
    let cursorFlowId = currentFlowId;

    while (cursorFlowId) {
      const branchFlow = getOwnerBranchFlow(flows, cursorFlowId);
      if (!branchFlow) break;

      if (branchFlow.type === ProcessNodeType.PARALLEL_BRANCH) {
        const currentBranch = branchFlow.branches.find(branch => getFlowById(branch.flows, cursorFlowId));
        const isTargetInCurrentBranch = !!getFlowById(currentBranch?.flows || [], targetFlowId);
        if (!isTargetInCurrentBranch) {
          branchFlows.push(branchFlow);
        }
      }

      cursorFlowId = branchFlow.uid;
    }

    return branchFlows;
  }

  private async rollbackParallelBranchRecords(
    options: BackTodoOptions,
    flows: ProcessFlow[],
    currentRecord: FlowExecutionRecords,
    userId: string,
  ) {
    const exitedParallelBranchFlows = this.getExitedParallelBranchFlows(flows, options.flowId, options.backId);
    if (isEmpty(exitedParallelBranchFlows)) return [currentRecord.flowId];

    const branchFlowIds = Array.from(new Set(
      exitedParallelBranchFlows.flatMap(branchFlow => {
        return branchFlow.branches.flatMap(branch => this.getFlowIds(branch.flows));
      })
    ));

    const query: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
      status: ProcessNodeStatus.IN_PROGRESS,
      flowId: {
        $in: branchFlowIds,
      },
    };
    if (options.todoId) query.todoId = options.todoId;

    const parallelRecords = await this.flowExecutionRecordsRepository.find(query);
    const siblingRecords = parallelRecords.filter(record => record.id !== currentRecord.id);
    const flowIdsToDelete = new Set<string>([currentRecord.flowId]);

    for (const siblingRecord of siblingRecords) {
      siblingRecord.status = ProcessNodeStatus.BACK;
      siblingRecord.endTime = Date.now();
      const metas = siblingRecord.metas || {};
      metas[userId] = metas[userId] || {};
      metas[userId].updateTime = Date.now();
      metas[userId].back = true;
      metas[userId].backId = options.backId;
      siblingRecord.metas = metas;
      flowIdsToDelete.add(siblingRecord.flowId);
    }

    if (!isEmpty(siblingRecords)) {
      await this.flowExecutionRecordsRepository.persistAndFlush(siblingRecords);
    }

    const parallelBranchRecordFlowIds = Array.from(new Set(
      exitedParallelBranchFlows.flatMap(branchFlow => {
        return [
          branchFlow.uid,
          ...branchFlow.branches.flatMap(branch => this.getParallelBranchFlowIds(branch.flows)),
        ];
      })
    ));

    const branchRecordQuery: FilterQuery<FlowBranchRecords> = {
      uuid: options.uuid,
      status: ProcessNodeStatus.IN_PROGRESS,
      flowId: {
        $in: parallelBranchRecordFlowIds,
      },
    };
    if (options.todoId) branchRecordQuery.todoId = options.todoId;

    const branchRecords = await this.flowBranchRecordsRepository.find(branchRecordQuery);
    for (const branchRecord of branchRecords) {
      branchRecord.status = ProcessNodeStatus.BACK;
      branchRecord.branchIds = [];
    }
    if (!isEmpty(branchRecords)) {
      await this.flowBranchRecordsRepository.persistAndFlush(branchRecords);
    }

    return Array.from(flowIdsToDelete);
  }

  private async isSatisfyFinishConditions(node: ProcessFlow, nocodeId: string, tableUID: string, row: Row): Promise<Partial<ReturnType<typeof isMeetConditionsByRow>>> {
    const { requireSatisfyCondition, finishCondition } = node.options;
    if (!requireSatisfyCondition) return { valid: true };
    const nocodeBody = await this.getFlowNocodeBody(nocodeId);
    const table = this.resolveProcessTargetTable(nocodeId, nocodeBody, tableUID as TableUID).targetTable;
    const { sourceTables, conditions } = finishCondition;
    const sourceTableRows = {
      [tableUID]: [row],
    };
    await Promise.all(sourceTables.map(async (item) => {
      const filterRule = item.filterRule;
      sourceTableRows[item.uid] = await this.getTableRows(nocodeBody, nocodeId, item.tableUID, filterRule, row, {
        fillSubTable: true,
        formulaRuntime: createFormulaRuntimeByData(row, table?.fields),
      });
    }));
    return isMeetConditionsByRow(row, conditions, sourceTableRows, table?.fields);
  }

  async submitTodo(options: SubmitTodoOptions, userId: string) {
    return await this.withTodoOperationLock(options.todoId, () => this.submitTodoInternal(options, userId));
  }

  private async submitTodoInternal(options: SubmitTodoOptions, userId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    // 先拿到当前进行中的实例记录，再按实例绑定版本读取流程定义。
    const flowRecord = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!flowRecord)  throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    const flows = await this.getInstanceFlows(process, options, flowRecord);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) throw new Error(global.i18next.t('formFlowService.processNotFound'));
    const executionContext = await this.getFlowExecutionContext(options.todoId);
    const nodeStashContext = this.getNodeStashContext(executionContext?.data, flow.uid);
    const reportStashContext = flow.type === ProcessNodeType.REPORT_DATA
      ? this.getReportDataStashContext(executionContext?.data, flow.uid)
      : null;
    const submitRow = flow.type === ProcessNodeType.REPORT_DATA
      ? (
        !isEmpty(options.row)
          ? deepClone(options.row || {})
          : deepClone(reportStashContext?.row || {})
      )
      : (
        !isEmpty(options.row)
          ? deepClone(options.row || {})
          : deepClone(nodeStashContext?.row || {})
      );
    const reportSubmitRow = flow.type === ProcessNodeType.REPORT_DATA
      ? submitRow
      : null;
    let reportResolvedTarget: ResolvedProcessTargetTable | null = null;
    if (flow.type === ProcessNodeType.REPORT_DATA) {
      const flowNocodeBody = await this.getFlowNocodeBody(options.nocodeId);
      reportResolvedTarget = this.resolveProcessTargetTable(options.nocodeId, flowNocodeBody, flow.options.targetTableUID);
    }
    const rollbackContext = await this.buildSubmitTodoRollbackContext(options, flowRecord, flow, reportResolvedTarget);
    this.clearRecordStashed(flowRecord);
    const table = formData.tables.find(t => t.uid === options.tableId);
    const uuidFiled = getUUIDSystemField(table.fields);
    const startRecord = await this.getStartRecord(options);
    const triggerSource = this.getStartRecordSource(startRecord);
    let submittedMutation: FlowImmediateMutation | null = null;
    const writeCurrentRowIfNeeded = async () => {
      if (flow.type === ProcessNodeType.REPORT_DATA || this.isEmptyRowTrigger(startRecord)) {
        return;
      }
      const stageField = table.fields.find(f => f.meta.name === SystemField.DATA_STAGE);
      const stage = submitRow?.[stageField.uid];
      if (flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE && triggerSource === TODOTriggerType.ADD) {
        const targetUUID = rollbackContext.submittedTargetUUID || options.uuid;
        const shouldUpdateSubmittedRow = !!rollbackContext.submittedTargetUUID || !!rollbackContext.sourceRowExisted;
        const nextRow = deepClone(submitRow || {});
        if (shouldUpdateSubmittedRow) {
          await this.formDataService.updateData(
            formData,
            options.nocodeId,
            options.tableId,
            [{ ...nextRow, [uuidFiled.uid]: targetUUID }],
            [[formData.uid, options.tableId, uuidFiled.uid]],
            stage,
          );
        } else {
          if (uuidFiled?.uid) {
            nextRow[uuidFiled.uid] = targetUUID;
          }
          nextRow[SystemField.UUID] = targetUUID;
          await this.formDataService.addData(
            formData,
            options.nocodeId,
            options.tableId,
            [nextRow],
            {
              triggerTodo: false,
              validatePermission: false,
            },
            {
              stage,
            },
          );
          await this.setTodoDataChangeSubmittedTargetUUID(options.todoId, flow.uid, targetUUID);
          rollbackContext.submittedTargetUUID = targetUUID;
        }
      } else {
        await this.formDataService.updateData(
          formData,
          options.nocodeId,
          options.tableId,
          [{ ...submitRow, [uuidFiled.uid]: options.uuid }],
          [[formData.uid, options.tableId, uuidFiled.uid]],
          stage,
        );
      }
      if (flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE) {
        const processVersion = await this.getInstanceProcessVersion(options, flowRecord);
        await this.updateFlowData(options, {
          status: ProcessNodeStatus.IN_PROGRESS,
          stage: triggerSource === TODOTriggerType.ADD ? FormDataStage.ADDING : FormDataStage.EDITING,
          todoId: options.todoId,
          version: processVersion,
          node: { type: "update", value: [flow.uid] },
        });
      }
      const afterRow = await this.loadRollbackRowByUUID(formData, options.nocodeId, table, options.uuid);
      if (afterRow && rollbackContext.sourceRowSnapshot) {
        submittedMutation = await this.recordImmediateMutation(options.todoId, "submit_todo", {
          action: DataChangeType.EDIT,
          targetNocodeId: options.nocodeId,
          targetTableId: options.tableId,
          beforeRows: [rollbackContext.sourceRowSnapshot],
          afterRows: [afterRow],
          changedFieldUids: Object.keys(submitRow || {}),
        });
      }
    };

    let shouldClearReportStashContext = false;
    let isFinish = false;
    let errorMsg = "";
    try {
      if (flow.type === ProcessNodeType.APPROVAL) {
        await writeCurrentRowIfNeeded();
        isFinish = await this.submitApprovalTodo({ ...options, row: submitRow }, flows, flow, userId);
      } else if (flow.type === ProcessNodeType.TRANSACT) {
        await writeCurrentRowIfNeeded();
        const res = await this.submitTransactTodo({ ...options, row: submitRow }, flows, flow, userId);
        isFinish = res.isFinish;
        errorMsg = res.errorMsg;
      } else {
        if (flow.type !== ProcessNodeType.REPORT_DATA) {
          await writeCurrentRowIfNeeded();
        }
        let isSatisfy = true;
        const { requireSatisfyCondition } = flow.options;
        if (flow.type === ProcessNodeType.REPORT_DATA) {
          const flowNocodeBody = await this.getFlowNocodeBody(options.nocodeId);
          await this.assertCrossAppWritePermission(flowNocodeBody, reportResolvedTarget, DataChangeType.ADD);
          const res = await this.isSatisfyFinishConditions(flow, options.nocodeId, flow.options.targetTableUID, reportSubmitRow);
          isSatisfy = !!res.valid;
          errorMsg = !res.valid ? (res.errorMsg || global.i18next.t('formFlowService.fillNotMeetFinishCond')) : "";
          if (isSatisfy) {
            const isCurrentFormTarget = this.isCurrentProcessFormTarget(options, formData, reportResolvedTarget);
            if (!isCurrentFormTarget) {
              const reportTask = await this.queuePostFinishTask(
                options,
                flows,
                flow,
                reportResolvedTarget,
                "report_data",
                reportSubmitRow,
                DataChangeType.ADD,
              );
              if (reportTask) {
                reportTask.executionRecordId = flowRecord.id;
                await this.flowPostFinishTaskRepository.persistAndFlush(reportTask);
              }
            } else {
              const reportWriteResult = await this.writeReportDataRow({
                ...options,
                row: reportSubmitRow,
              }, flowRecord, userId, reportResolvedTarget, true);
              if (reportWriteResult?.targetUUID) {
                rollbackContext.reportTargetUUID = reportWriteResult.targetUUID;
              }
              if (reportWriteResult?.row) {
                const beforeRow = rollbackContext.reportTargetSnapshot?.row;
                const mutation = await this.recordImmediateMutation(options.todoId, "report_data", {
                  action: beforeRow ? DataChangeType.EDIT : DataChangeType.ADD,
                  targetNocodeId: reportResolvedTarget.targetNocodeId,
                  targetTableId: reportResolvedTarget.targetTable.uid,
                  beforeRows: beforeRow ? [beforeRow] : [],
                  afterRows: [reportWriteResult.row],
                });
                const triggerTask = await this.queuePostFinishTask(
                  options,
                  flows,
                  flow,
                  reportResolvedTarget,
                  "trigger_event",
                  reportWriteResult.row,
                  beforeRow ? DataChangeType.EDIT : DataChangeType.ADD,
                  beforeRow,
                );
                if (mutation && triggerTask) {
                  triggerTask.resultSnapshot = { immediateMutationId: mutation.id };
                  await this.flowPostFinishTaskRepository.persistAndFlush(triggerTask);
                }
              }
            }
            shouldClearReportStashContext = true;
          }
        }
        if (requireSatisfyCondition) {
          const submitRecords = flowRecord.submitRecords || [];
          submitRecords.push(this.buildOpinionSubmitRecord(userId, options));
          submitRecords.push({
            userId,
            time: Date.now(),
            satisfy: isSatisfy,
          });
          flowRecord.submitRecords = submitRecords;
        }
        if (isSatisfy) {
          if (this.hasOpinionContent(options)) {
            this.applyOpinionToMeta(this.ensureFlowRecordMeta(flowRecord, userId), options);
          }
          flowRecord.operators = [userId];
          flowRecord.endTime = Date.now();
          flowRecord.status = ProcessNodeStatus.FINISHED;
          isFinish = true;
        }
        await this.flowExecutionRecordsRepository.persistAndFlush(flowRecord);
      }

      let returnedAfterParallelBranch = false;
      if (isFinish) {
        const branchFlow = getOwnerBranchFlow(flows, options.flowId);
        if (branchFlow && branchFlow?.type === ProcessNodeType.PARALLEL_BRANCH) {
          const branch = branchFlow.branches.find(b => getFlowById(b.flows, flow.uid));
          const lastFlow = branch.flows.at(-1);
          if (lastFlow.uid === flow.uid) {
            const branchFinished = await this.completeParallelBranch(options, branchFlow, branch.flows[0].uid);
            if (!branchFinished) {
              await this.updateFlowData(options, { node: { type: "delete", value: [options.flowId] } });
              returnedAfterParallelBranch = true;
            }
          }
        }
        if (!returnedAfterParallelBranch) {
          await this.updateFlowData(options, { node: { type: "delete", value: [options.flowId] } });
          const node = getNextFlow(flows, options.flowId);
          await this.addNextNode(options, flows, node, startRecord.operators[0]);
        }
      }

      if (options.todoId && (isFinish || shouldClearReportStashContext)) {
        await this.clearTodoNodeStashContext(options.todoId, flow.uid, shouldClearReportStashContext);
      }

      return {
        isFinish,
        errorMsg,
      };
    } catch (error) {
      try {
        await this.rollbackSubmitTodoMutation(options, rollbackContext);
        if (submittedMutation?.status === "applied") {
          submittedMutation.status = "rolled_back";
          submittedMutation.rolledBackAt = Date.now();
          await this.flowImmediateMutationRepository.persistAndFlush(submittedMutation);
        }
      } catch (rollbackError) {
        this.logger.error("rollback submit todo failed", rollbackError);
      }
      throw error;
    }
  }

  async backTodo(options: BackTodoOptions, userId: string) {
    return await this.withTodoOperationLock(options.todoId, () => this.backTodoInternal(options, userId));
  }

  private async backTodoInternal(options: BackTodoOptions, userId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    // 先定位实例记录，后续的 flows 必须按该实例绑定的版本来解析。
    const flowQuery: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    };
    if (options.todoId) flowQuery.todoId = options.todoId;
    const record = await this.flowExecutionRecordsRepository.findOne(flowQuery);
    if (!record)  throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    const flows = await this.getInstanceFlows(process, options, record);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) throw new Error(global.i18next.t('formFlowService.processNotFound'));
    if (!canRollbackFlow(flow)) throw new Error(global.i18next.t('formFlowService.rejectNotAllowed'));
    const backFlow = getFlowById(flows, options.backId);
    if (!backFlow) throw new Error(global.i18next.t('formFlowService.rejectNodeNotFound'));

    const hasRevertRange = Object.prototype.hasOwnProperty.call(flow?.options ?? {}, 'revertRange');
    const rollbackTargetFlows = getRollbackTargetFlows(
      flows,
      options.flowId,
      hasRevertRange ? (flow?.options?.revertRange || []) : undefined,
    );
    const canRollback = rollbackTargetFlows.some(item => item.uid === options.backId);
    if (!canRollback) throw new Error(global.i18next.t('formFlowService.rejectNodeNotFound'));
    const sourceStashSnapshot = this.buildFlowRecordStashSnapshot(record);
    const shouldMoveStashState = sourceStashSnapshot?.isStashed === true;
    const executionContext = shouldMoveStashState && record.todoId
      ? await this.getFlowExecutionContext(record.todoId)
      : null;
    const sourceNodeStashContext = shouldMoveStashState
      ? this.getNodeStashContext(executionContext?.data, flow.uid)
      : null;
    const latestBackFlowRecord = await this.getLatestFlowRecordByTodoId(record.todoId, backFlow.uid);
    const sourceReportTargetMeta = backFlow.type === ProcessNodeType.REPORT_DATA
      ? this.getReportDataStashedTargetMeta(latestBackFlowRecord || record)
      : null;
    const sourceSubmittedTargetUUID = backFlow.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      ? (
        await this.getTodoDataChangeSubmittedTargetUUID(record.todoId, backFlow.uid)
        || await this.getTodoDataChangeSubmittedTargetUUID(record.todoId, flow.uid)
      )
      : "";
    this.clearRecordStashed(record);
    record.status = ProcessNodeStatus.BACK;
    record.endTime = Date.now();
    if (record.operators) {
      record.operators.push(userId);
    } else {
      record.operators = [userId];
    }
    const metas = record.metas || {};
    metas[userId] = metas[userId] || {};
    if (this.hasOpinionContent(options)) {
      this.applyOpinionToMeta(metas[userId], options);
    } else {
      metas[userId].updateTime = Date.now();
    }
    metas[userId].back = true;
    metas[userId].backId = options.backId;
    record.metas = metas;
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
    if (shouldMoveStashState) {
      await this.moveTodoFlowContext(record.todoId, flow.uid, backFlow.uid, {
        moveNodeStash: true,
      });
      if (backFlow.type === ProcessNodeType.REPORT_DATA && sourceNodeStashContext?.row && backFlow.options?.targetTableUID) {
        const flowNocodeBody = await this.getFlowNocodeBody(options.nocodeId);
        const resolvedTarget = this.resolveProcessTargetTable(options.nocodeId, flowNocodeBody, backFlow.options.targetTableUID);
        const targetExecutionContext = await this.getFlowExecutionContext(record.todoId);
        const nextContextData = this.setReportDataStashContext(targetExecutionContext?.data, backFlow.uid, {
          row: deepClone(sourceNodeStashContext.row),
          targetNocodeId: resolvedTarget.targetNocodeId,
          targetTableUID: resolvedTarget.targetTable.uid,
          targetUUID: (
            sourceReportTargetMeta?.stashedTargetNocodeId === resolvedTarget.targetNocodeId
            && sourceReportTargetMeta?.stashedTargetTableUID === resolvedTarget.targetTable.uid
          ) ? sourceReportTargetMeta.stashedTargetUUID : undefined,
        });
        await this.updateFlowExecutionContext(record.todoId, { data: nextContextData });
      }
    } else {
      await this.clearTodoNodeStashContext(record.todoId, flow.uid, flow.type === ProcessNodeType.REPORT_DATA);
    }
    if (backFlow.type === ProcessNodeType.TRIGGER_DATA_CHANGE && sourceSubmittedTargetUUID) {
      await this.setTodoDataChangeSubmittedTargetUUID(record.todoId, backFlow.uid, sourceSubmittedTargetUUID);
    }
    const deletedFlowIds = await this.rollbackParallelBranchRecords(options, flows, record, userId);
    await this.updateFlowData(options, { node: { type: "delete", value: deletedFlowIds } });
    await this.clearSkipNodeIds(options.todoId);

    const backedRecord = await this.createRecord(options, backFlow);
    const startRecord = await this.getStartRecord(options);
    if (isRollbackSubmitNode(backFlow)) {
      backedRecord.paddingOperators = startRecord.operators;
    } else {
      backedRecord.paddingOperators = await this.getOwnersByNode(options, backFlow, startRecord.operators?.[0])
    }
    if (shouldMoveStashState) {
      backedRecord.isStashed = true;
      backedRecord.stashTime = sourceStashSnapshot.stashTime;
      backedRecord.stashOperatorId = sourceStashSnapshot.stashOperatorId;
    }
    const reportTargetMetaOwnerId = backedRecord.stashOperatorId
      || backedRecord.paddingOperators?.find(item => typeof item === "string" && item)
      || startRecord.operators?.[0];
    if (backFlow.type === ProcessNodeType.REPORT_DATA && sourceReportTargetMeta && reportTargetMetaOwnerId) {
      const backedMeta = this.ensureFlowRecordMeta(backedRecord, reportTargetMetaOwnerId);
      backedMeta.stashedTargetNocodeId = sourceReportTargetMeta.stashedTargetNocodeId;
      backedMeta.stashedTargetTableUID = sourceReportTargetMeta.stashedTargetTableUID;
      backedMeta.stashedTargetUUID = sourceReportTargetMeta.stashedTargetUUID;
    }
    await this.flowExecutionRecordsRepository.persistAndFlush(backedRecord);
    await this.updateFlowData(options, { node: { type: "add", value: [backedRecord.flowId] } });
  }

  private async continueAfterRejectedApproval(
    options: RejectTodoOptions,
    flows: ProcessFlow[],
    flow: ProcessFlow,
    initiatorId: string,
  ) {
    const skipNodeIds = flow.options.rejectSkipNodeIds || [];
    const nextNode = getNextFlow(flows, flow.uid);
    await this.updateFlowData(options, { node: { type: "delete", value: [flow.uid] } });
    if (options.todoId) {
      await this.updateFlowExecutionContext(options.todoId, { skipNodeIds });
    }

    const branchFlow = getOwnerBranchFlow(flows, flow.uid);
    if (branchFlow && branchFlow?.type === ProcessNodeType.PARALLEL_BRANCH) {
      const branch = branchFlow.branches.find(b => getFlowById(b.flows, flow.uid));
      const isNextInCurrentBranch = nextNode ? !!getFlowById(branch.flows, nextNode.uid) : false;
      if (!isNextInCurrentBranch) {
        const isFinish = await this.completeParallelBranch(options, branchFlow, branch.flows[0].uid);
        if (!isFinish) return;
      }
    }

    if (nextNode) {
      await this.addNextNode({ ...options, skipNodeIds }, flows, nextNode, initiatorId);
    }
  }

  async rejectTodo(options: RejectTodoOptions, userId: string) {
    return await this.withTodoOperationLock(options.todoId, () => this.rejectTodoInternal(options, userId));
  }

  private async rejectTodoInternal(options: RejectTodoOptions, userId: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    // 先定位实例记录，后续的 flows 必须按该实例绑定的版本来解析。
    const record = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!record)  throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    const flows = await this.getInstanceFlows(process, options, record);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) throw new Error(global.i18next.t("formFlowService.processNodeNotFound"));
    if (flow.type !== ProcessNodeType.APPROVAL) throw new Error(global.i18next.t('formFlowService.nodeNotSupportReject'));
    this.clearRecordStashed(record);
    if (record.operators) {
      record.operators.push(userId);
    } else {
      record.operators = [userId];
    }
    record.status = ProcessNodeStatus.REJECTED;
    record.endTime = Date.now();
    const metas = record.metas || {};
    metas[userId] = metas[userId] || {};
    if (this.hasOpinionContent(options)) {
      this.applyOpinionToMeta(metas[userId], options);
    } else {
      metas[userId].updateTime = Date.now();
    }
    metas[userId].reject = true;
    record.metas = metas;
    await this.flowExecutionRecordsRepository.persistAndFlush(record);
    await this.clearTodoNodeStashContext(record.todoId, flow.uid);

    const { category, categoryRule, approverType } = flow.options;
    if (!((category === ApprovalCategory.MANUAL && categoryRule === ApprovalCategoryRule.STEP_BY_STEP) || (approverType === ApproverType.SEQUENTIAL))) {
      let owners = record.paddingOperators;
      if (!owners) {
        const startRecord = await this.getStartRecord(options);
        owners = await this.getOwnersByNode(options, flow, startRecord.operators[0]);
      }
      const notifyOwners = owners.filter(id => !record.operators.includes(id));
      if (!isEmpty(notifyOwners)) {
        const record = await this.createRecord(options, { ...flow, type: ProcessNodeType.NOTIFY }, ProcessNodeStatus.FINISHED);
        record.operators = notifyOwners;
        await this.flowExecutionRecordsRepository.persistAndFlush(record);
      }
    }
    const startRecord = await this.getStartRecord(options);
    if (flow.options.continueAfterReject) {
      if (flow.options.rollbackDataBeforeReject) {
        try {
          await this.rollbackBeforeContinueAfterReject(options);
        } catch (err) {
          this.logger.error(`rollback before continue after reject failed: ${options.todoId}`, err);
        }
      }
      await this.continueAfterRejectedApproval(options, flows, flow, startRecord.operators[0]);
      return;
    }
    await this.createRecord(options, flows.at(-1), ProcessNodeStatus.REJECTED);
    await this.discardPostFinishPlanAndRollback(options, "terminal_reject");
    await this.updateFlowData(options, { stage: FormDataStage.NORMAL, status: ProcessNodeStatus.REJECTED, node: { type: "update", value: [] } });
    await this.clearSkipNodeIds(options.todoId);
  }

  async cancelTodo(options: CancelTodoOptions, userId: string) {
    return await this.withTodoOperationLock(options.todoId, async () => {
      const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
      const process = nocodeBody.formData.formOptions[options.tableId]?.process;
      const startRecord = await this.getStartRecord(options);
      if (!startRecord) {
        throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
      }
      if (startRecord.operators?.[0] !== userId) {
        throw new Error(global.i18next.t('formDataService.noPerm'));
      }
      const flows = await this.getInstanceFlows(process, options, startRecord);
      if (!await this.getInstanceAllowCancel(options, flows, startRecord)) {
        throw new Error(global.i18next.t('formFlowService.cancelNotAllowed'));
      }

      const activeRecordQuery: FilterQuery<FlowExecutionRecords> = {
        nocodeId: options.nocodeId,
        tableId: options.tableId,
        uuid: options.uuid,
        todoId: options.todoId,
        status: ProcessNodeStatus.IN_PROGRESS,
      };
      let activeRecords = await this.flowExecutionRecordsRepository.find(activeRecordQuery, {
        orderBy: { startTime: "ASC" },
      });
      const canceledEndRecord = await this.flowExecutionRecordsRepository.findOne({
        nocodeId: options.nocodeId,
        tableId: options.tableId,
        uuid: options.uuid,
        todoId: options.todoId,
        type: ProcessNodeType.END,
        status: ProcessNodeStatus.CANCELED,
      });
      if (canceledEndRecord) {
        canceledEndRecord.operators = Array.isArray(canceledEndRecord.operators) ? canceledEndRecord.operators : [];
        if (!canceledEndRecord.operators.includes(userId)) canceledEndRecord.operators.push(userId);
        const endMetas = canceledEndRecord.metas || {};
        endMetas[userId] = endMetas[userId] || {};
        endMetas[userId].cancel = true;
        canceledEndRecord.metas = endMetas;
        await this.flowExecutionRecordsRepository.persistAndFlush(canceledEndRecord);
        return;
      }
      if (isEmpty(activeRecords)) {
        activeRecords = (await this.flowExecutionRecordsRepository.find({
          nocodeId: options.nocodeId,
          tableId: options.tableId,
          uuid: options.uuid,
          todoId: options.todoId,
          status: ProcessNodeStatus.CANCELED,
        })).filter(record => record.type !== ProcessNodeType.END);
        if (isEmpty(activeRecords)) {
          throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
        }
      }

      const cancelTime = Date.now();
      const clearedFlowIds = new Set<string>();
      for (const record of activeRecords) {
        this.clearRecordStashed(record);
        record.status = ProcessNodeStatus.CANCELED;
        record.endTime = cancelTime;
        const metas = record.metas || {};
        metas[userId] = metas[userId] || {};
        metas[userId].cancel = true;
        metas[userId].updateTime = cancelTime;
        record.metas = metas;
        if (record.flowId && !clearedFlowIds.has(record.flowId)) {
          await this.clearTodoNodeStashContext(record.todoId, record.flowId, record.type === ProcessNodeType.REPORT_DATA);
          clearedFlowIds.add(record.flowId);
        }
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(activeRecords);

      const branchRecords = await this.flowBranchRecordsRepository.find({
        uuid: options.uuid,
        todoId: options.todoId,
        status: ProcessNodeStatus.IN_PROGRESS,
      });
      for (const branchRecord of branchRecords) {
        branchRecord.status = ProcessNodeStatus.CANCELED;
        branchRecord.branchIds = [];
      }
      if (!isEmpty(branchRecords)) {
        await this.flowBranchRecordsRepository.persistAndFlush(branchRecords);
      }

      await this.discardPostFinishPlanAndRollback(options, "cancel");
      await this.updateFlowData(options, { stage: FormDataStage.NORMAL, status: ProcessNodeStatus.CANCELED, node: { type: "update", value: [] } });
      await this.updateFlowExecutionContext(options.todoId, { finalStatus: ProcessNodeStatus.CANCELED });
      await this.clearSkipNodeIds(options.todoId);

      const endNode = flows.at(-1);
      if (endNode) {
        const endRecord = await this.createRecord(options, endNode, ProcessNodeStatus.CANCELED);
        endRecord.operators = [userId];
        endRecord.metas = {
          [userId]: {
            cancel: true,
            updateTime: cancelTime,
          },
        };
        await this.flowExecutionRecordsRepository.persistAndFlush(endRecord);
      }
    });
  }

  private async finishFlowExecutionRecords(
    records: FlowExecutionRecords[],
    options: {
      nocodeId: string,
      tableId: TableUID,
      flows?: ProcessFlow[],
      rowMap?: Map<string, Row>,
      statusFieldUid?: string,
      currentNodeFieldUid?: string,
      userId?: string,
      finalStatus?: ProcessNodeStatus,
      applyFinalResult?: (todoOptions: BaseTodoOptions, finalStatus: ProcessNodeStatus) => Promise<void>,
      finishMeta?: (meta: FlowExecutionRecordMeta) => void,
      decorateEndRecord?: (record: FlowExecutionRecords) => void,
      handlePostFinishPlan?: boolean,
    },
  ) {
    if (isEmpty(records)) {
      return;
    }

    const { nocodeId, tableId, flows = [], rowMap, statusFieldUid, currentNodeFieldUid, userId, finalStatus = ProcessNodeStatus.FINISHED, applyFinalResult, finishMeta, decorateEndRecord, handlePostFinishPlan = true } = options;
    const endNode = flows.at(-1)?.type === ProcessNodeType.END ? flows.at(-1) : null;
    const recordGroups = records.reduce<Record<string, FlowExecutionRecords[]>>((prev, record) => {
      const key = record.todoId || `__uuid__:${record.uuid}`;
      if (!prev[key]) {
        prev[key] = [];
      }
      prev[key].push(record);
      return prev;
    }, {});

    for (const groupedRecords of Object.values(recordGroups)) {
      if (isEmpty(groupedRecords)) {
        continue;
      }

      const baseRecord = groupedRecords[0];
      const clearedContextFlowIds = new Set<string>();
      const finishTime = Date.now();
      for (const record of groupedRecords) {
        this.clearRecordStashed(record);
        record.status = ProcessNodeStatus.FINISHED;
        record.endTime = finishTime;
        if (record.todoId && record.flowId && !clearedContextFlowIds.has(record.flowId)) {
          await this.clearTodoNodeStashContext(record.todoId, record.flowId, record.type === ProcessNodeType.REPORT_DATA);
          clearedContextFlowIds.add(record.flowId);
        }
        if (!userId) {
          continue;
        }
        if (!Array.isArray(record.operators)) {
          record.operators = [];
        }
        if (!record.operators.includes(userId)) {
          record.operators.push(userId);
        }
        const metas = record.metas || {};
        metas[userId] = metas[userId] || {};
        metas[userId].updateTime = finishTime;
        finishMeta?.(metas[userId]);
        record.metas = metas;
      }
      await this.flowExecutionRecordsRepository.persistAndFlush(groupedRecords);

      const todoOptions: BaseTodoOptions = {
        nocodeId,
        tableId,
        uuid: baseRecord.uuid,
        todoId: baseRecord.todoId,
      };
      const displayRowSnapshot = await this.captureTodoDisplaySnapshot(todoOptions);
      const postFinishPlan = handlePostFinishPlan && finalStatus === ProcessNodeStatus.FINISHED
        ? await this.preparePostFinishPlan(todoOptions, displayRowSnapshot)
        : null;
      if (endNode) {
        const endRecord = await this.createRecord(todoOptions, endNode, finalStatus);
        decorateEndRecord?.(endRecord);
        await this.flowExecutionRecordsRepository.persistAndFlush(endRecord);
      }
      if (applyFinalResult) {
        await applyFinalResult(todoOptions, finalStatus);
      } else {
        await this.updateFlowData(todoOptions, {
          stage: FormDataStage.NORMAL,
          status: finalStatus,
          node: {
            type: "update",
            value: [],
          },
        });
      }
      await this.finalizeCurrentProcessRowDelete(todoOptions);
      if (baseRecord.todoId) {
        await this.updateFlowExecutionContext(baseRecord.todoId, { finalStatus });
      }
      await this.clearSkipNodeIds(baseRecord.todoId);
      await this.activatePostFinishPlan(postFinishPlan);

      const branchRecordQuery: FilterQuery<FlowBranchRecords> = {
        uuid: baseRecord.uuid,
        status: ProcessNodeStatus.IN_PROGRESS,
      };
      if (baseRecord.todoId) {
        branchRecordQuery.todoId = baseRecord.todoId;
      }
      const branchRecords = await this.flowBranchRecordsRepository.find(branchRecordQuery);
      for (const branchRecord of branchRecords) {
        branchRecord.status = ProcessNodeStatus.FINISHED;
        branchRecord.branchIds = [];
      }
      if (!isEmpty(branchRecords)) {
        await this.flowBranchRecordsRepository.persistAndFlush(branchRecords);
      }

      const row = rowMap?.get(String(baseRecord.uuid));
      if (row) {
        if (statusFieldUid) {
          row[statusFieldUid] = finalStatus;
        }
        if (currentNodeFieldUid) {
          row[currentNodeFieldUid] = [];
        }
      }

    }
  }

  async finishTodo(options: FinishTodoOptions, userId: string, isAdmin = false) {
    return await this.withTodoOperationLock(options.todoId, () => this.finishTodoInternal(options, userId, isAdmin));
  }

  private async finishTodoInternal(options: FinishTodoOptions, userId: string, isAdmin = false) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId);
    const formData = nocodeBody.formData;
    const process = formData.formOptions[options.tableId]?.process;
    const record = await this.flowExecutionRecordsRepository.findOne({
      nocodeId: options.nocodeId,
      uuid: options.uuid,
      id: options.id,
      status: ProcessNodeStatus.IN_PROGRESS,
    });
    if (!record) throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    const flows = await this.getInstanceFlows(process, options, record);
    const flow = getFlowById(flows, options.flowId);
    if (!flow) throw new Error(global.i18next.t('formFlowService.processNodeNotFound'));
    if (record.flowId !== options.flowId) {
      throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'));
    }
    let owners = this.getRecordOwners(record);
    if (!owners.length) {
      const startRecord = await this.getStartRecord(options);
      owners = await this.getOwnersByNode(options, flow, startRecord?.operators?.[0]);
    }
    if (!isAdmin && !this.canOperateFlowRecord(record, userId, owners)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    if (!isAdmin && !flow.options?.allowFinishFlow) {
      throw new Error(global.i18next.t('formFlowService.finishFlowNotEnabled'));
    }

    const finalStatus = await this.getTodoFinalStatus({
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
      todoId: record.todoId,
    });
    const activeRecordQuery: FilterQuery<FlowExecutionRecords> = {
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      uuid: options.uuid,
      status: ProcessNodeStatus.IN_PROGRESS,
    };
    if (record.todoId) {
      activeRecordQuery.todoId = record.todoId;
    }
    const activeRecords = await this.flowExecutionRecordsRepository.find(activeRecordQuery, {
      orderBy: {
        startTime: "ASC",
      },
    });

    await this.finishFlowExecutionRecords(isEmpty(activeRecords) ? [record] : activeRecords, {
      nocodeId: options.nocodeId,
      tableId: options.tableId,
      flows,
      userId,
      finalStatus,
      finishMeta: (meta) => {
        meta.finishFlow = true;
      },
      applyFinalResult: async (todoOptions, status) => {
        await this.applyFinishedFlowResult(todoOptions, status);
      },
      decorateEndRecord: (endRecord) => {
        if (!userId) {
          return;
        }
        endRecord.operators = Array.isArray(endRecord.operators) ? endRecord.operators : [];
        if (!endRecord.operators.includes(userId)) {
          endRecord.operators.push(userId);
        }
        endRecord.metas = endRecord.metas || {};
        endRecord.metas[userId] = endRecord.metas[userId] || {};
        endRecord.metas[userId].updateTime = endRecord.endTime || Date.now();
      },
    });
    return {
      success: true,
      status: finalStatus,
    };
  }

  async cancelInProgressTodosBeforeDelete(
    formData: NocodeFormData,
    nocodeId: string,
    tableId: TableUID,
    rows: Row[] = [],
  ) {
    if (isEmpty(rows)) {
      return;
    }

    const table = formData.tables.find(item => item.uid === tableId);
    const uuidField = getUUIDSystemField(table?.fields || []);
    if (!table || !uuidField?.uid) {
      return;
    }

    const statusField = table.fields.find(field => field.meta.name === SystemField.STATUS);
    const currentNodeField = table.fields.find(field => field.meta.name === SystemField.CURRENT_NODE);
    const rowMap = new Map<string, Row>();
    const uuids = rows
      .map(row => {
        const uuid = row?.[uuidField.uid];
        if (!uuid) {
          return "";
        }
        rowMap.set(String(uuid), row);
        return String(uuid);
      })
      .filter(Boolean);

    if (!uuids.length) {
      return;
    }

    const activeRecords = await this.flowExecutionRecordsRepository.find({
      nocodeId,
      tableId,
      uuid: {
        $in: uuids,
      },
      status: ProcessNodeStatus.IN_PROGRESS,
    }, {
      orderBy: {
        startTime: "ASC",
      },
    });
    if (isEmpty(activeRecords)) {
      return;
    }

    const process = formData.formOptions[tableId]?.process;
    const flows = getFlows(process) || [];
    const account = await this.formDataService.getAccount().catch(() => null);
    const userId = account?.id;
    await this.finishFlowExecutionRecords(activeRecords, {
      nocodeId,
      tableId,
      flows,
      rowMap,
      statusFieldUid: statusField?.uid,
      currentNodeFieldUid: currentNodeField?.uid,
      userId,
      handlePostFinishPlan: false,
    });
  }

  async transferTodo(options: TransferTodoOptions, userId: string) {
    if (userId && userId === options.transferOwner)
      throw new Error(global.i18next.t('formFlowService.cannotTransferToUser'));
    const { record, owners } = await this.getTransferTodoContext(options, userId);
    const transferUserIds = await this.getTransferTodoUsers(options, userId);
    if (!transferUserIds.includes(options.transferOwner)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }

    // 记录转交记录
    if (!Array.isArray(record.transferRecords)) {
      record.transferRecords = [];
    }
    record.transferRecords.push({
      from: userId,
      to: options.transferOwner,
      time: Date.now(),
    });

    if (!record.paddingOperators) {
      record.paddingOperators = owners;
    }
    const transferOwner = options.transferOwner;
    const index = record.paddingOperators.findIndex(id => id === userId);
    if (index < 0) throw new Error(global.i18next.t('formFlowService.illegalOperation'));
    record.paddingOperators[index] = transferOwner;

    // if (!Object.values(transfer).includes(userId)) {
    //   transfer[userId] = transferOwner;
    // } else {
    //   for (const key in transfer) {
    //     if (!Object.hasOwn(transfer, key)) continue;

    //     const value = transfer[key];

    //     if (value === userId) {
    //       if (key === transferOwner) {
    //         delete transfer[key];
    //       } else {
    //         transfer[key] = transferOwner;
    //       }
    //     }
    //   }
    // }

    await this.flowExecutionRecordsRepository.persistAndFlush(record);
    await this.updateFlowData(options, { status: ProcessNodeStatus.IN_PROGRESS });
  }

  async getTransferTodoUsers(options: GetTransferTodoUsersOptions, userId: string) {
    const { flow, owners, startRecord } = await this.getTransferTodoContext(options, userId);
    const baseUsers = await this.getTransferBaseUsers(flow.options?.transferRange);
    const candidateUsers = baseUsers.filter(user => (
      user?.id
      && user.id !== userId
      && !owners.includes(user.id)
    ));
    const readableUsers = await Promise.all(candidateUsers.map(async user => ({
      id: user.id,
      canViewCurrentData: await this.canUserViewTodoData(options, user.id, {
        startRecord,
      }),
    })));
    return readableUsers
      .filter(item => item.canViewCurrentData)
      .map(item => item.id);
  }

  async deleteTodo(options: DeleteTodoOptions, userId: string) {
    const query: FilterQuery<FlowExecutionRecords> = {
      tableId: options.tableId,
      nocodeId: options.nocodeId,
      uuid: options.uuid,
    };
    if (options.todoId) query.todoId = options.todoId;
    const records = await this.flowExecutionRecordsRepository.find(query);
    // const needDeleteRecords = records.filter(record => {
    //   return record.operators?.includes(userId) || record.paddingOperators?.includes(userId)
    // })
    if (isEmpty(records)) throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'))
    
      for (const record of records) {
        if (!Array.isArray(record.deletedUsers)) {
          record.deletedUsers = []
        }
        if (!record.deletedUsers.includes(userId)) {
          record.deletedUsers.push(userId)
        }
      }

    await this.flowExecutionRecordsRepository.persistAndFlush(records);
  }

  async deleteTodos(options: DeleteTodoOptions[], userId: string) {
    const qb = this.entityManager.createQueryBuilder<FlowExecutionRecords>("FlowExecutionRecords", "r");
    for (const option of options) {
      const query: FilterQuery<FlowExecutionRecords> = {
        tableId: option.tableId,
        nocodeId: option.nocodeId,
        uuid: option.uuid,
      };
      if (option.todoId) query.todoId = option.todoId;
      qb.orWhere(query);
    }
    const records = await qb.getResult();
    const needDeleteRecords = records.filter(record => record.operators?.includes(userId))
    if (isEmpty(needDeleteRecords)) throw new Error(global.i18next.t('formFlowService.statusChangedRefreshTips'))
    
      for (const record of needDeleteRecords) {
        if (!Array.isArray(record.deletedUsers)) {
          record.deletedUsers = []
        }
        if (!record.deletedUsers.includes(userId)) {
          record.deletedUsers.push(userId)
        }
      }

    await this.flowExecutionRecordsRepository.persistAndFlush(needDeleteRecords);
  }

  async getAllCategoryTodoCount(userId: string, categories: TodoCategory[], includeTodoPendingCategories = false) {
    const nocodeMetas = await this.nocodeRepository.find({
      $or: [
        { deleted: { $ne: true } },
        { deleted: null },
      ]
    });
    const formDatas = await Promise.all(nocodeMetas.map(async (nocodeMeta) => {
      const nocodeBody: NocodeBody = await getNocodeBody(this.nocodesDir, nocodeMeta.id).catch(() => null);
      if (!nocodeBody) return null;
      const formData = nocodeBody.formData;
      const formOptions = formData?.formOptions || {};
      const [ tableId, process ] = Object.entries(formOptions).find(([tableId, formOption]) => isProcessTable(formOption)) || [];
      if (!process) return null;
      return {
        nocodeId: nocodeMeta.id,
        formData: nocodeBody.formData,
      }
    })).then((res) => res?.filter(Boolean));
    if (isEmpty(formDatas)) return {};
    const promises: Promise<number>[] = [];
    if (!categories) {
      categories = Object.values(TodoCategory).filter(item => item !== TodoCategory.INITIATE_PROCESS);
    }
    for (const category of categories) {
      const count = this.getPageTodos({ category, formDatas }, userId, true);
      promises.push(count);
    }
    const allCount = await Promise.all(promises);
    const result = categories.reduce((prev, item, i) => {
      prev[item] = allCount[i];
      return prev;
    }, {});
    if (includeTodoPendingCategories) {
      const overtimeCount = this.getPageTodos({ category: TodoCategory.MY_TODO, todoPendingFilter: "overtime", formDatas }, userId, true);
      result[TodoSubCategory.EXPIRED] = await overtimeCount;
    }
    return result;
  }

  async getAllCategoryTodoCountByNocodeId(userId: string, nocodeId: string, categories: TodoCategory[], includeTodoPendingCategories = false) {
    const meta = await this.projectService.getNocodeMeta(nocodeId, false);
    if (!meta) return {};
    const nocodeBody: NocodeBody = await getNocodeBody(this.nocodesDir, nocodeId).catch(() => null);
    const formOptions = nocodeBody?.formData?.formOptions;
    const [ tableId, process ] = Object.entries(formOptions || {}).find(([tableId, formOption]) => isProcessTable(formOption)) || [];
    if (!process) return {};
    if (!categories) {
      categories = Object.values(TodoCategory).filter(item => item !== TodoCategory.INITIATE_PROCESS);
    }
    const promises: Promise<number>[] = [];
    for (const category of categories) {
      const count = this.getPageTodos({ category, formDatas: [{ nocodeId, formData: nocodeBody?.formData }] }, userId, true);
      promises.push(count);
    }
    const allCount = await Promise.all(promises);
    const result = categories.reduce((prev, item, i) => {
      prev[item] = allCount[i];
      return prev;
    }, {});
    if (includeTodoPendingCategories) {
      const overtimeCount = this.getPageTodos({ category: TodoCategory.MY_TODO, todoPendingFilter: "overtime", formDatas: [{ nocodeId, formData: nocodeBody?.formData }] }, userId, true);
      result[TodoSubCategory.EXPIRED] = await overtimeCount;
    }
    return result;
  }

  async getAllTodos(options: GetTodosParams, userId: string) {
    const processNocodesData = await this.getHasProcessNocodes();
    const formDatas = processNocodesData.map(item => ({ nocodeId: item.nocodeMeta.id, formData: item.nocodeBody.formData }));

    if (isEmpty(formDatas)) return {
      count: 0,
      todos: [],
      page: options.page || 1,
      pageSize: options.pageSize || 20,
    };
    return await this.getPageTodos({ ...options, formDatas }, userId);
  }

  async getTodosByNocodeId(options: GetTodosParams, userId: string) {
    const meta = await this.projectService.getNocodeMeta(options.nocodeId, false);
    if (!meta) return {
      count: 0,
      todos: [],
      page: options.page || 1,
      pageSize: options.pageSize || 20,
    };
    const nocodeBody: NocodeBody = await getNocodeBody(this.nocodesDir, options.nocodeId).catch(() => null);
    const formOptions = nocodeBody?.formData?.formOptions;
    const [ tableId, process ] = Object.entries(formOptions || {}).find(([tableId, formOption]) => isProcessTable(formOption)) || [];
    if (!process) return {
      count: 0,
      todos: [],
      page: options.page || 1,
      pageSize: options.pageSize || 20,
    }
    return await this.getPageTodos({ ...options, formDatas: [{ nocodeId: options.nocodeId, formData: nocodeBody.formData }] }, userId);
  }

  async getHasProcessNocodes() {
    const nocodeMetas = await this.nocodeRepository.find({
      $or: [
        { deleted: { $ne: true } },
        { deleted: null },
      ]
    });

    const nocodes = await Promise.all(nocodeMetas.map(async (nocodeMeta) => {
      const nocodeBody: NocodeBody = await getNocodeBody(this.nocodesDir, nocodeMeta.id).catch(() => null);
      if (!nocodeBody) return null;
      const formData = nocodeBody.formData;
      const formOptions = formData?.formOptions || {};
      const [ tableId, process ] = Object.entries(formOptions).find(([tableId, formOption]) => isProcessTable(formOption)) || [];
      if (!process) return null;
      return {
        nocodeMeta,
        nocodeBody,
      }
    })).then((res) => res?.filter(Boolean));

    return nocodes;
  }

  async getProcessNocodeSimplifyDatas() {
    const processNocodesData = await this.getHasProcessNocodes();
    const nocodeNames = processNocodesData.map(item => {
      const formOptions = item.nocodeBody?.formData?.formOptions || {};
      const hasProcessTables = item.nocodeBody.formData.tables.filter(table => isProcessTable(formOptions?.[table.uid]))
      if (!isEmpty(hasProcessTables)) {
        return {
          name: item.nocodeMeta.name,
          id: item.nocodeMeta.id,
          iconColor: item.nocodeBody?.snapshot?.color,
          icon: item.nocodeBody?.snapshot?.icon,
        }
      }
    }).filter(Boolean);
    return nocodeNames;
  }
}
