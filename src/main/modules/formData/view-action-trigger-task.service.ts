import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { EntityManager, FilterQuery, MikroORM, RequestContext, RequiredEntityData, UniqueConstraintViolationException } from "@mikro-orm/core";
import { createHash } from "crypto";
import AsyncLock from "async-lock";
import type { Request } from "express";
import {
  EnqueueViewActionTriggerBlockedItem,
  EnqueueViewActionTriggerRequest,
  EnqueueViewActionTriggerResult,
  ExecuteViewActionEditContext,
  ExecuteViewActionRequest,
  FlowTriggerContext,
  FormTableRuntime,
  NocodeFormData,
  ViewActionFieldId,
  ViewActionTriggerPrecheckResult,
} from "@common/types/nocode";
import { DataChangeType, OptionFieldUID, ProcessNodeType, Row, TableUID } from "@common/types/project";
import type { Account } from "@common/types/account";
import { getFlows, getUUIDSystemField } from "@common/utils";
import { RequestStorage } from "@main/middleware";
import { WorkbenchService } from "../workbench/workbench.service";
import { FormDataService } from "./form-data.service";
import {
  ViewActionTriggerActiveRecord,
  ViewActionTriggerBatch,
  ViewActionTriggerTask,
  ViewActionTriggerTaskStatus,
  DataMutationTaskAction,
  DataMutationTaskPayload,
  PersistentTaskQueueClass,
  ViewActionTriggerTaskExecutionPhase,
  PersistentTaskRequestContext,
  FlowTaskStepExecution,
  FlowTaskStepExecutionStatus,
} from "./entities";
import { FlowWorkerPool, FlowWorkerTaskRef } from "./flow-worker-pool";

export type FlowSchedulerQueue = Extract<PersistentTaskQueueClass, "p0" | "p1">;
export type FlowSchedulerResult = {
  outcome: Exclude<ViewActionTriggerTaskStatus, "preparing" | "queued" | "running">;
  flowExecutionId?: string;
  errorCode?: string;
  errorMessage?: string;
  resultPayload?: unknown;
};

const TASK_ERROR_LIMIT = 500;
const REQUEST_CONTEXT_VALUE_LIMIT = 512;
const SAFE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
  "x-flow-event-id",
  "x-nocode-id",
  "x-request-id",
  "x-sign",
]);
const getConcurrency = (name: string, fallback: number, max = 16) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
};
const P0_CONCURRENCY = getConcurrency(
  "FLOW_EXECUTION_P0_CONCURRENCY",
  getConcurrency("FLOW_EXECUTION_P0_WORKER_THREADS", 1),
);
const P1_CONCURRENCY = getConcurrency("FLOW_EXECUTION_P1_CONCURRENCY", 2);
const P1_BATCH_CONCURRENCY = getConcurrency("FLOW_EXECUTION_P1_BATCH_CONCURRENCY", 2);
// Inline mode preserves the historical single-batch behavior. Tinypool mode
// permits one initiator to use both bounded P1 slots so a single import can
// actually benefit from multiple workers; operators can lower this value.
const P1_INITIATOR_CONCURRENCY = getConcurrency(
  "FLOW_EXECUTION_P1_INITIATOR_CONCURRENCY",
  (process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool") === "tinypool" ? 2 : 1,
);
const IMPORT_CHUNK_SIZE = Math.min(500, Math.max(25, getConcurrency("FLOW_EXECUTION_IMPORT_CHUNK_SIZE", 100, 500)));
const TASK_LEASE_MS = 60_000;
const TASK_SHUTDOWN_TIMEOUT_MS = Math.max(1_000, Number(process.env.FLOW_EXECUTION_SHUTDOWN_TIMEOUT_MS) || 10_000);
const TASK_MAX_ATTEMPTS = 3;
const TASK_RETRY_BASE_MS = 1_000;
const TASK_RETRY_MAX_MS = 60_000;
const GATEWAY_ADMISSION_RETRY_MS = 1_000;
const configuredMaxPendingP1 = Number(process.env.FLOW_EXECUTION_MAX_PENDING_P1);
const MAX_PENDING_P1 = Number.isInteger(configuredMaxPendingP1) && configuredMaxPendingP1 >= 0
  ? Math.min(configuredMaxPendingP1, 1_000_000)
  : 100_000;

type MutationTaskResult = {
  data?: Row[];
  delegatedRows?: Row[];
  queueState?: DataMutationTaskPayload["queueState"];
  success?: boolean;
  [key: string]: unknown;
};

type PostMutationTaskOptions = {
  preparedTaskId?: string;
  eventId: string;
  action: Extract<DataMutationTaskAction, "add" | "update" | "delete" | "delete_all">;
  auditAction: Extract<DataMutationTaskPayload["auditAction"], "addData" | "updateData" | "deleteData" | "deleteAllData">;
  formData: NocodeFormData;
  nocodeId: string;
  tableUID: TableUID;
  rows: Row[];
  beforeMutationRows?: Row[];
  queueState?: DataMutationTaskPayload["queueState"];
  /**
   * P0 callers already have the committed rows and form definition. Defer
   * row-level branch matching to the task execution path so the HTTP request
   * does not re-read business data before persisting the outbox event.
   */
  deferMatching?: boolean;
  /** Interactive mutations use P0; explicit bulk operations must opt into P1. */
  queueClass?: "p0" | "p1";
  runtime?: FormTableRuntime;
  request?: Request;
};

type PostMutationIntentOptions = Omit<PostMutationTaskOptions,
  "preparedTaskId" | "beforeMutationRows" | "queueState" | "deferMatching"
> & {
  /** Mutation-specific immutable input such as keys and edited field IDs. */
  requestIdentity?: unknown;
};

export type BulkPostMutationOptions = {
  preparedTaskId?: string;
  eventId: string;
  source: DataChangeType.ADD | DataChangeType.EDIT | DataChangeType.DELETE;
  auditAction: Extract<DataMutationTaskPayload["auditAction"], "addData" | "updateData" | "deleteData" | "deleteAllData">;
  formData: NocodeFormData;
  nocodeId: string;
  tableUID: TableUID;
  rows: Row[];
  beforeMutationRows?: Row[];
  queueState?: DataMutationTaskPayload["queueState"];
  triggerContext?: FlowTriggerContext;
  causedByTodoId?: string;
  causedByTaskId?: string;
  finalizeDeleteWithoutFlow?: boolean;
  runtimeAccount?: Account;
  request?: Request;
};

type ViewActionTriggerTaskRequest = ExecuteViewActionRequest & {
  queueState?: DataMutationTaskPayload["queueState"];
};

type StepExecutionResult = {
  status: FlowTaskStepExecutionStatus;
  resultSnapshot?: unknown;
  owned?: boolean;
};

@Injectable()
export class ViewActionTriggerTaskService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ViewActionTriggerTaskService.name);
  private readonly enqueueLock = new AsyncLock({ timeout: 60 * 1000 });
  private readonly taskQueueLock = new AsyncLock({ timeout: 60 * 1000 });
  private pumpPromise?: Promise<void>;
  private readonly queuePumpPromises: Partial<Record<FlowSchedulerQueue, Promise<void>>> = {};
  private readonly activeByQueue: Record<PersistentTaskQueueClass, number> = { p0: 0, p1: 0, p2: 0 };
  private readonly activeByBatch = new Map<string, number>();
  private readonly activeByBatchAndQueue = new Map<string, number>();
  private readonly activeByInitiator = new Map<string, number>();
  private readonly schedulerId = `main-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  private readonly startupRecoveryCutoff = Date.now();
  private readonly activeExecutions = new Set<Promise<void>>();
  private readonly activeLeaseStops = new Set<() => void>();
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private gatewayAdmissionRetryTimer?: ReturnType<typeof setTimeout>;
  private pumpScheduled = false;
  private workerFallbackCount = 0;
  private shutdownPromise?: Promise<{ drained: boolean }>;
  private finalizationAllowed = true;
  private stopped = false;

  constructor(
    private readonly orm: MikroORM,
    private readonly formDataService: FormDataService,
    private readonly workbenchService: WorkbenchService,
    @Optional() private readonly flowWorkerPool?: FlowWorkerPool,
  ) {}

  private logWorkerFallback(message: string) {
    this.workerFallbackCount += 1;
    if (this.workerFallbackCount === 1 || (this.workerFallbackCount & (this.workerFallbackCount - 1)) === 0) {
      this.logger.warn(`${message}; fallbackCount=${this.workerFallbackCount}`);
    }
  }

  private asRetryableWorkerError(error: unknown) {
    const workerError = error instanceof Error ? error : new Error(this.errorMessage(error));
    const metadata = workerError as Error & { retryable?: boolean; idempotent?: boolean };
    metadata.retryable = true;
    metadata.idempotent = true;
    return metadata;
  }

  onApplicationBootstrap() {
    this.formDataService.registerFlowDerivedPostMutationEnqueuer?.(
      options => this.enqueueBulkPostMutation({
        ...options,
        auditAction: options.source === DataChangeType.ADD
          ? "addData"
          : options.source === DataChangeType.EDIT ? "updateData" : "deleteData",
      }),
      async options => await this.preparePostMutationIntent({
        eventId: options.eventId,
        action: options.source === DataChangeType.ADD
          ? "add"
          : options.source === DataChangeType.EDIT ? "update" : "delete",
        auditAction: options.source === DataChangeType.ADD
          ? "addData"
          : options.source === DataChangeType.EDIT ? "updateData" : "deleteData",
        formData: options.formData,
        nocodeId: options.nocodeId,
        tableUID: options.tableUID,
        rows: options.rows,
        queueClass: "p1",
        requestIdentity: {
          causedByTodoId: options.causedByTodoId,
          causedByTaskId: options.causedByTaskId,
        },
      }),
      async (taskId, error) => await this.failPostMutationIntent(taskId, error),
    );
    setImmediate(() => {
      const warmup = this.flowWorkerPool && typeof this.flowWorkerPool.warmup === "function"
        ? this.flowWorkerPool.warmup().catch(error => {
          this.logger.warn(`flow worker warmup failed; continuing with lazy startup: ${this.errorMessage(error)}`);
        })
        : Promise.resolve();
      void warmup.then(() => this.recoverInterruptedTasks(this.startupRecoveryCutoff))
        .then(() => this.startPumpIfEnabled())
        .catch(error => this.logger.error("recover view action trigger tasks failed", this.errorMessage(error)));
    });
  }

  async onApplicationShutdown() {
    await this.stopAndDrain(TASK_SHUTDOWN_TIMEOUT_MS);
  }

  /**
   * Stop accepting new work and drain the currently running scheduler work.
   * The promise is shared so Electron can safely invoke this from more than
   * one shutdown signal without double-destroying Tinypool or ORM resources.
   */
  async stopAndDrain(timeoutMs = TASK_SHUTDOWN_TIMEOUT_MS): Promise<{ drained: boolean }> {
    if (this.shutdownPromise) return await this.shutdownPromise;
    const budget = Math.max(0, Number(timeoutMs) || TASK_SHUTDOWN_TIMEOUT_MS);
    this.shutdownPromise = (async () => {
      const startedAt = Date.now();
      this.stopped = true;
      if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
      if (this.gatewayAdmissionRetryTimer) clearTimeout(this.gatewayAdmissionRetryTimer);
      this.gatewayAdmissionRetryTimer = undefined;
      let drained = true;
      const waitFor = async (promise: Promise<unknown>, remaining: number) => {
        if (remaining <= 0) return false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = await Promise.race([
          promise.then(() => false),
          new Promise<boolean>(resolve => {
            timer = setTimeout(() => resolve(true), remaining);
          }),
        ]);
        if (timer) clearTimeout(timer);
        return !timedOut;
      };
      if (this.pumpPromise && !(await waitFor(this.pumpPromise, budget))) {
        drained = false;
        this.finalizationAllowed = false;
        this.logger.warn(`view action trigger pump shutdown timed out after ${budget}ms`);
      }
      const executions = [...this.activeExecutions];
      if (executions.length) {
        const remaining = Math.max(0, budget - (Date.now() - startedAt));
        if (!(await waitFor(Promise.allSettled(executions), remaining))) {
          drained = false;
          this.finalizationAllowed = false;
          this.logger.warn(`view action trigger shutdown timed out after ${budget}ms; active leases will recover on next start`);
        }
      }
      // Keep renewals alive while the shutdown budget is draining active
      // executions. Once the budget is exhausted (or all executions settled),
      // no further lease extension is needed before pool teardown.
      for (const stopLeaseRenewal of this.activeLeaseStops) stopLeaseRenewal();
      const remaining = Math.max(0, budget - (Date.now() - startedAt));
      if (this.flowWorkerPool) {
        // The scheduler is the single lifecycle owner. Keep worker admission
        // open while already-claimed executions drain because they may still
        // need to submit their next node RPC. Only then close and destroy it.
        if (typeof this.flowWorkerPool.stopAccepting === "function") {
          this.flowWorkerPool.stopAccepting();
        }
        if (!(await waitFor(this.flowWorkerPool.shutdown(), remaining))) drained = false;
      }
      return { drained };
    })();
    return await this.shutdownPromise;
  }

  async precheck(request: ExecuteViewActionRequest): Promise<ViewActionTriggerPrecheckResult> {
    const result = await this.formDataService.precheckViewActionTrigger(request);
    const executableUUIDs = result.items.filter(item => item.executable).map(item => item.uuid);
    if (!executableUUIDs.length) {
      return result;
    }

    const em = this.orm.em.fork();
    const activeRecords = await em.find(ViewActionTriggerActiveRecord, {
      nocodeId: request.nocodeId,
      tableId: request.tableUID,
      uuid: { $in: executableUUIDs },
    });
    const activeUUIDs = new Set(activeRecords.map(item => item.uuid));
    if (!activeUUIDs.size) {
      return result;
    }

    const items = result.items.map(item => {
      if (!item.executable || !activeUUIDs.has(item.uuid)) {
        return item;
      }
      return {
        ...item,
        executable: false,
        reasonCode: "task_queued",
        message: global.i18next.t("formFlowService.operationTriggerActiveRecordExists"),
      };
    });
    return {
      ...result,
      executableCount: items.filter(item => item.executable).length,
      blockedCount: items.filter(item => !item.executable).length,
      items,
    };
  }

  async enqueueMutation(options: {
    action: DataMutationTaskAction;
    auditAction: DataMutationTaskPayload["auditAction"];
    formData: NocodeFormData;
    nocodeId: string;
    tableUID: TableUID;
    rows?: Row[];
    keys?: OptionFieldUID[];
    runtime?: FormTableRuntime;
    stashFlow?: boolean;
    updateFieldIds?: ViewActionFieldId[];
    viewActionContext?: ExecuteViewActionEditContext;
    triggerTodo: boolean;
    /** Interactive mutations default to P0; batch/import callers must opt in. */
    queueClass?: "p0" | "p1";
    request?: Request;
  }) {
    const account = await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) {
      throw new Error(global.i18next.t("formDataService.noPerm"));
    }

    const queueClass = options.queueClass === "p1" ? "p1" : "p0";
    const admissionLock = queueClass === "p0"
      ? "persistent-task-enqueue-p0"
      : "persistent-task-enqueue";
    return await this.taskQueueLock.acquire(admissionLock, async () => {
      const rows = Array.isArray(options.rows) ? options.rows : [];
      const queueState = !options.triggerTodo || options.action === "add"
        ? null
        : await this.formDataService.prepareDataChangeFlowQueue(
          options.nocodeId,
          options.tableUID,
          rows,
          options.action === "update" ? DataChangeType.EDIT : DataChangeType.DELETE,
        );
      if (queueState === undefined) {
        throw new Error(`Prepare data change flow queue failed: ${options.nocodeId}:${options.tableUID}`);
      }

      const context = this.captureRequestContext(options.request);
      const payload: DataMutationTaskPayload = {
        action: options.action,
        auditAction: options.auditAction,
        formData: options.formData,
        nocodeId: options.nocodeId,
        tableUID: options.tableUID,
        rows,
        keys: options.keys,
        runtime: options.runtime,
        stashFlow: options.stashFlow,
        triggerTodo: options.triggerTodo,
        updateFieldIds: options.updateFieldIds,
        viewActionContext: options.viewActionContext,
        queueState,
      };
      const now = Date.now();
      const em = this.orm.em.fork();
      const task = em.create(ViewActionTriggerTask, {
        batchId: undefined,
        initiatorId,
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        viewId: undefined,
        actionId: undefined,
        uuid: `mutation:${now}:${Math.random().toString(36).slice(2, 10)}`,
        dataTitle: options.action,
        sequence: 1,
        requestPayload: {},
        taskType: "data_mutation",
        queueClass,
        priority: queueClass === "p1" ? 0 : 100,
        availableAt: now,
        mutationAction: options.action,
        mutationPayload: payload,
        requestContext: context,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
      try {
        await em.persistAndFlush(task);
      } catch (error) {
        if (queueState) {
          await this.formDataService.restoreQueuedDataChangeFlowRows(
            options.nocodeId,
            options.tableUID,
            queueState,
          );
        }
        throw error;
      }
      this.schedulePump();
      return {
        success: true,
        taskId: task.id,
        queued: true,
        data: [],
      };
    });
  }

  /**
   * Delete-all is admitted as one durable P1 operation. The worker processes
   * it in cursor pages, avoiding a full-table snapshot in the HTTP request.
   */
  async enqueueDeleteAll(options: {
    eventId: string;
    formData: NocodeFormData;
    nocodeId: string;
    tableUID: TableUID;
    runtime?: FormTableRuntime;
    request?: Request;
  }) {
    const account = await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) throw new Error(global.i18next.t("formDataService.noPerm"));
    const eventId = String(options.eventId || "").trim();
    if (!eventId) throw new Error("Delete-all event ID is required");
    const dedupeKey = `delete-all:${this.digest({
      initiatorId,
      eventId,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
    })}`;

    return await this.taskQueueLock.acquire("persistent-task-enqueue", async () => {
      const em = this.orm.em.fork();
      const existing = await em.findOne(ViewActionTriggerTask, { dedupeKey });
      if (existing) {
        return {
          success: true,
          taskId: existing.id,
          queued: existing.status === "queued" || existing.status === "running",
          replayed: true,
          data: [],
        };
      }
      const now = Date.now();
      const task = em.create(ViewActionTriggerTask, {
        initiatorId,
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        uuid: `delete-all:${eventId}`,
        dataTitle: "delete_all",
        sequence: 1,
        requestPayload: {},
        taskType: "data_mutation",
        queueClass: "p1",
        priority: 0,
        availableAt: now,
        mutationAction: "delete_all",
        mutationPayload: {
          eventId,
          action: "delete_all",
          auditAction: "deleteAllData",
          formData: options.formData,
          nocodeId: options.nocodeId,
          tableUID: options.tableUID,
          runtime: options.runtime,
          triggerTodo: true,
          postMutationOnly: true,
          postMutationKind: "bulk",
          pagedDeleteAll: true,
          deleteAllCursor: "",
        },
        requestContext: this.captureRequestContext(options.request),
        dedupeKey,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
      await em.transactional(async tx => {
        await this.assertP1Capacity(tx, 1);
        tx.persist(task);
        await tx.flush();
      });
      this.schedulePump();
      return { success: true, taskId: task.id, queued: true, replayed: false, data: [] };
    });
  }

  /**
   * Persist an intent before the business-store mutation starts. The intent is
   * not claimable until enqueuePostMutation confirms that the mutation
   * committed and atomically changes it to queued.
   */
  async preparePostMutationIntent(options: PostMutationIntentOptions) {
    const eventId = String(options.eventId || "").trim();
    if (!eventId) throw new Error("Post-mutation flow event ID is required");
    const source = options.action === "add"
      ? DataChangeType.ADD
      : options.action === "update"
        ? DataChangeType.EDIT
        : DataChangeType.DELETE;
    const account = await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) throw new Error(global.i18next.t("formDataService.noPerm"));
    const dedupeKey = `post-mutation:${this.digest({
      initiatorId,
      eventId,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      action: options.action,
    })}`;
    const queueClass = options.queueClass === "p1" ? "p1" : "p0";
    const requestDigest = this.canonicalDigest({
      action: options.action,
      auditAction: options.auditAction,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      rows: Array.isArray(options.rows) ? options.rows : [],
      runtime: options.runtime ?? null,
      requestIdentity: options.requestIdentity ?? null,
    });
    const admissionLock = queueClass === "p0"
      ? `persistent-task-enqueue-p0:${dedupeKey}`
      : "persistent-task-enqueue";

    return await this.taskQueueLock.acquire(admissionLock, async () => {
      const em = this.orm.em.fork();
      const existing = await em.findOne(ViewActionTriggerTask, { dedupeKey });
      if (existing) {
        if (existing.mutationPayload?.requestDigest !== requestDigest) {
          throw new Error("Post-mutation flow event ID does not match the original request");
        }
        return {
          taskId: existing.id,
          prepared: existing.status === "preparing",
          replayed: true,
          status: existing.status,
          queued: existing.status === "queued",
        };
      }
      // Dedupe must win over the current flow configuration: a retry of an
      // accepted event cannot execute the business mutation again merely
      // because an administrator edited or disabled the flow meanwhile.
      if (!this.hasPotentialDataChangeFlow(options.formData, options.tableUID, source)) {
        return null;
      }
      const now = Date.now();
      const payload: DataMutationTaskPayload = {
        eventId,
        requestDigest,
        action: options.action,
        auditAction: options.auditAction,
        nocodeId: options.nocodeId,
        tableUID: options.tableUID,
        rows: Array.isArray(options.rows) ? options.rows : [],
        runtime: options.runtime,
        triggerTodo: true,
        postMutationOnly: true,
        conditionWorkerQueue: queueClass,
        beforeMutationRows: [],
      };
      const task = em.create(ViewActionTriggerTask, {
        batchId: undefined,
        initiatorId,
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        viewId: undefined,
        actionId: undefined,
        uuid: `mutation-intent:${now}:${Math.random().toString(36).slice(2, 10)}`,
        dataTitle: options.action,
        sequence: 1,
        requestPayload: {},
        taskType: "data_mutation",
        queueClass,
        priority: queueClass === "p0" ? 100 : 0,
        availableAt: now,
        mutationAction: options.action,
        mutationPayload: payload,
        requestContext: this.captureRequestContext(options.request),
        dedupeKey,
        status: "preparing",
        errorCode: "mutation_commit_pending",
        errorMessage: "Business mutation has not been confirmed",
        createdAt: now,
        updatedAt: now,
      });
      try {
        if (queueClass === "p1") {
          await em.transactional(async tx => {
            await this.assertP1Capacity(tx, 1);
            tx.persist(task);
            await tx.flush();
          });
        } else {
          await em.persistAndFlush(task);
        }
      } catch (error) {
        const concurrent = await em.findOne(ViewActionTriggerTask, { dedupeKey });
        if (!concurrent) throw error;
        if (concurrent.mutationPayload?.requestDigest !== requestDigest) {
          throw new Error("Post-mutation flow event ID does not match the original request");
        }
        return {
          taskId: concurrent.id,
          prepared: concurrent.status === "preparing",
          replayed: true,
          status: concurrent.status,
          queued: concurrent.status === "queued",
        };
      }
      return { taskId: task.id, prepared: true, replayed: false, status: "preparing" as const, queued: false };
    });
  }

  async failPostMutationIntent(taskId: string, error: unknown) {
    if (!taskId) return;
    const now = Date.now();
    const mutationCommitted = (error as { mutationCommitted?: unknown })?.mutationCommitted === true;
    await this.orm.em.fork().nativeUpdate(ViewActionTriggerTask, {
      id: taskId,
      status: "preparing",
    }, {
      status: mutationCommitted ? "unknown" : "failed",
      errorCode: mutationCommitted ? "mutation_commit_unknown" : "mutation_failed_before_commit",
      errorMessage: this.errorMessage(error).slice(0, TASK_ERROR_LIMIT),
      finishedAt: now,
      updatedAt: now,
    });
  }

  async enqueuePostMutation(options: PostMutationTaskOptions) {
    const eventId = String(options.eventId || "").trim();
    if (!eventId) throw new Error("Post-mutation flow event ID is required");
    const rows = Array.isArray(options.rows) ? options.rows : [];
    if (!rows.length && !options.preparedTaskId) {
      return null;
    }

    const account = await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) {
      throw new Error(global.i18next.t("formDataService.noPerm"));
    }

    const context = this.captureRequestContext(options.request);
    const dedupeKey = `post-mutation:${this.digest({
      initiatorId,
      eventId,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      action: options.action,
    })}`;

    const queueClass = options.queueClass === "p1" ? "p1" : "p0";
    // Interactive P0 admission must not wait behind P1 batch preparation.
    // Explicit bulk mutations share the bounded P1 admission lane.
    const admissionLock = queueClass === "p0"
      ? `persistent-task-enqueue-p0:${dedupeKey}`
      : "persistent-task-enqueue";
    return await this.taskQueueLock.acquire(admissionLock, async () => {
      const em = this.orm.em.fork();
      // P0 交互任务不修改业务行的流程状态为 QUEUED，数据已经提交，
      // 这里只持久化后置触发事件并尽快调度。
      // Resolve the durable identity before inspecting the current flow
      // configuration. A retry must return the original task even when the
      // flow was edited while that task was waiting.
      const existingTask = await em.findOne(ViewActionTriggerTask, { dedupeKey });
      const preparedTask = options.preparedTaskId && existingTask?.id === options.preparedTaskId
        && existingTask.status === "preparing"
        ? existingTask
        : null;
      if (existingTask && !preparedTask) {
        const existingPayload = existingTask.mutationPayload;
        const sameEvent = existingPayload && this.digest({
          action: existingPayload.action,
          nocodeId: existingPayload.nocodeId,
          tableUID: existingPayload.tableUID,
          rows: existingPayload.rows || [],
          beforeMutationRows: existingPayload.beforeMutationRows || [],
        }) === this.digest({
          action: options.action,
          nocodeId: options.nocodeId,
          tableUID: options.tableUID,
          rows,
          beforeMutationRows: options.beforeMutationRows || [],
        });
        if (!sameEvent) {
          throw new Error("Post-mutation flow event ID does not match the original mutation");
        }
        return {
          taskId: existingTask.id,
          queued: existingTask.status === "queued",
        };
      }

      if (!rows.length && preparedTask) {
        const now = Date.now();
        await em.nativeUpdate(ViewActionTriggerTask, {
          id: preparedTask.id,
          status: "preparing",
        }, {
          status: "completed",
          errorCode: undefined,
          errorMessage: undefined,
          resultPayload: { triggered: false },
          finishedAt: now,
          updatedAt: now,
        });
        return null;
      }

      const source = options.action === "add"
        ? DataChangeType.ADD
        : options.action === "update"
          ? DataChangeType.EDIT
          : DataChangeType.DELETE;
      if (options.deferMatching && !preparedTask) {
        if (!this.hasPotentialDataChangeFlow(options.formData, options.tableUID, source)) {
          return null;
        }
      } else if (!preparedTask) {
        const matchedUUIDs = options.action === "delete" || options.action === "delete_all"
          ? ["__delete__"]
          : await this.formDataService.getDataChangeFlowTaskRowUUIDs(
            options.nocodeId,
            options.tableUID,
            rows,
            source,
          );
        if (!matchedUUIDs.length) return null;
      }

      const queueState = options.queueState ?? null;
      if (queueState === undefined) {
        throw new Error(`Prepare data change flow queue failed: ${options.nocodeId}:${options.tableUID}`);
      }
      const payload: DataMutationTaskPayload = {
        eventId,
        requestDigest: preparedTask?.mutationPayload?.requestDigest,
        action: options.action,
        auditAction: options.auditAction,
        nocodeId: options.nocodeId,
        tableUID: options.tableUID,
        rows,
        runtime: options.runtime,
        triggerTodo: true,
        queueState,
        postMutationOnly: true,
        conditionWorkerQueue: queueClass,
        beforeMutationRows: options.beforeMutationRows || [],
      };
      const now = Date.now();
      const task = preparedTask || em.create(ViewActionTriggerTask, {
        batchId: undefined,
        initiatorId,
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        viewId: undefined,
        actionId: undefined,
        uuid: `mutation:${now}:${Math.random().toString(36).slice(2, 10)}`,
        dataTitle: options.action,
        sequence: 1,
        requestPayload: {},
        taskType: "data_mutation",
        queueClass,
        priority: queueClass === "p0" ? 100 : 0,
        availableAt: now,
        mutationAction: options.action,
        mutationPayload: payload,
        requestContext: context,
        dedupeKey,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
      try {
        if (preparedTask) {
          const promote = async (tx: EntityManager) => {
            const updated = await tx.nativeUpdate(ViewActionTriggerTask, {
              id: preparedTask.id,
              status: "preparing",
              dedupeKey,
            }, {
              mutationPayload: payload,
              requestContext: context,
              status: "queued",
              errorCode: undefined,
              errorMessage: undefined,
              updatedAt: now,
            });
            if (updated !== 1) throw new Error("Post-mutation intent could not be promoted");
          };
          if (queueClass === "p1") await em.transactional(promote);
          else await promote(em);
        } else if (queueClass === "p1") {
          await em.transactional(async tx => {
            await this.assertP1Capacity(tx, 1);
            tx.persist(task);
            await tx.flush();
          });
        } else {
          await em.persistAndFlush(task);
        }
      } catch (error) {
        const existingAfterConflict = await em.findOne(ViewActionTriggerTask, { dedupeKey });
        if (existingAfterConflict && !preparedTask) {
          const existingPayload = existingAfterConflict.mutationPayload;
          const sameEvent = existingPayload && this.digest({
            action: existingPayload.action,
            nocodeId: existingPayload.nocodeId,
            tableUID: existingPayload.tableUID,
            rows: existingPayload.rows || [],
            beforeMutationRows: existingPayload.beforeMutationRows || [],
          }) === this.digest({
            action: options.action,
            nocodeId: options.nocodeId,
            tableUID: options.tableUID,
            rows,
            beforeMutationRows: options.beforeMutationRows || [],
          });
          if (!sameEvent) {
            if (queueState) {
              await this.formDataService.restoreQueuedDataChangeFlowRows(
                options.nocodeId,
                options.tableUID,
                queueState,
              );
            }
            throw new Error("Post-mutation flow event ID does not match the original mutation");
          }
          return {
            taskId: existingAfterConflict.id,
            queued: existingAfterConflict.status === "queued",
          };
        }
        if (preparedTask) {
          await em.nativeUpdate(ViewActionTriggerTask, {
            id: preparedTask.id,
            status: "preparing",
          }, {
            status: "unknown",
            errorCode: "mutation_commit_unknown",
            errorMessage: this.errorMessage(error).slice(0, TASK_ERROR_LIMIT),
            finishedAt: Date.now(),
            updatedAt: Date.now(),
          }).catch(() => undefined);
        }
        if (queueState) {
          await this.formDataService.restoreQueuedDataChangeFlowRows(
            options.nocodeId,
            options.tableUID,
            queueState,
          );
        }
        throw error;
      }
      this.schedulePump();
      return {
        taskId: task.id,
        // The mutation itself has completed, but the post-mutation flow is
        // durable and asynchronous. Report that state truthfully so clients
        // do not mistake an accepted task for a completed flow.
        queued: true,
      };
    });
  }

  async enqueueImportPostMutation(options: {
    formData: NocodeFormData;
    nocodeId: string;
    tableUID: TableUID;
    rows: Row[];
    source?: DataChangeType.ADD | DataChangeType.EDIT;
    beforeMutationRows?: Row[];
    importTaskId?: string;
    runtimeAccount?: Account;
    queueState?: DataMutationTaskPayload["queueState"];
    preparedTaskId?: string;
    requestDigest?: string;
    eventId?: string;
    request?: Request;
  }) {
    const rows = Array.isArray(options.rows) ? options.rows : [];
    if (!rows.length) {
      return null;
    }

    const account = options.runtimeAccount || await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) {
      throw new Error(global.i18next.t("formDataService.noPerm"));
    }

    const source = options.source || DataChangeType.ADD;
    const action: Extract<DataMutationTaskAction, "add" | "update"> = source === DataChangeType.EDIT
      ? "update"
      : "add";
    const auditAction: Extract<DataMutationTaskPayload["auditAction"], "addData" | "updateData"> = source === DataChangeType.EDIT
      ? "updateData"
      : "addData";
    const batchKey = this.digest({
      kind: "import-post-mutation",
      source,
      importTaskId: options.importTaskId || null,
      eventId: options.eventId || null,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      // A stable import event is the idempotency boundary. Generated UUIDs
      // may be added by the business write and must not change the batch key.
      ...(options.eventId ? {} : { rows }),
    });
    const idempotencyKey = `import:${batchKey}`;

    // Snapshot preparation changes row status to QUEUED. Serialize imports
    // targeting the same table so their snapshots cannot overwrite each other;
    // imports for different tables may prepare concurrently. Final persistence
    // remains fenced by the shared admission lock below.
    return await this.enqueueLock.acquire(
      `import-post-mutation-preparation:${options.nocodeId}:${options.tableUID}`,
      async () => {
        const em = this.orm.em.fork();
        const preparedTask = options.preparedTaskId
          ? await em.findOne(ViewActionTriggerTask, { id: options.preparedTaskId, status: "preparing" })
          : undefined;
        if (options.preparedTaskId && !preparedTask) {
          const existingPrepared = await em.findOne(ViewActionTriggerTask, { id: options.preparedTaskId });
          if (existingPrepared && ["queued", "running", "completed"].includes(existingPrepared.status) && existingPrepared.batchId) {
            const existingTasks = await em.find(ViewActionTriggerTask, { batchId: existingPrepared.batchId }, {
              orderBy: { chunkSequence: "ASC", sequence: "ASC" },
            });
            return {
              taskId: existingTasks[0]?.id || existingPrepared.id,
              taskIds: existingTasks.map(task => task.id),
              batchId: existingPrepared.batchId,
              queued: true,
            };
          }
          throw new Error("Import post-mutation intent is no longer preparing");
        }
        if (preparedTask && options.requestDigest
          && preparedTask.mutationPayload?.requestDigest !== options.requestDigest) {
          throw new Error("Import post-mutation intent does not match the original import");
        }
        // Check the stable import batch identity before marking rows as QUEUED.
        // Repeated observer callbacks must not mutate row state when a batch already exists.
        const legacyTask = await em.findOne(ViewActionTriggerTask, { dedupeKey: batchKey });
        if (legacyTask) {
          return { taskId: legacyTask.id, taskIds: [legacyTask.id], queued: legacyTask.status === "queued" };
        }
        const existingBatch = await em.findOne(ViewActionTriggerBatch, { initiatorId, idempotencyKey });
        if (existingBatch) {
          const existingTasks = await em.find(ViewActionTriggerTask, { batchId: existingBatch.id }, {
            orderBy: { chunkSequence: "ASC", sequence: "ASC" },
          });
          if (existingTasks.length) {
            return {
              taskId: existingTasks[0].id,
              taskIds: existingTasks.map(task => task.id),
              batchId: existingBatch.id,
              queued: existingTasks.some(task => task.status === "queued"),
            };
          }
        }

        let queueState = options.queueState;
        if (queueState === undefined) {
          queueState = await this.formDataService.prepareDataChangeFlowQueue(
            options.nocodeId,
            options.tableUID,
            rows,
            source,
            undefined,
            {
              skipStatusUpdate: source === DataChangeType.ADD,
              knownRows: source === DataChangeType.ADD ? rows : undefined,
            },
          );
        }
        if (queueState === undefined) {
          throw new Error(`Prepare import flow queue failed: ${options.nocodeId}:${options.tableUID}`);
        }
        if (queueState === null) {
          return null;
        }

        const flowRows = queueState.previousRows.length ? queueState.previousRows : rows;
        const table = options.formData.tables?.find(item => item.uid === options.tableUID);
        const uuidField = getUUIDSystemField(table?.fields || []);
        const beforeRowsByUUID = new Map((options.beforeMutationRows || []).map(row => [
          String(row?.[uuidField?.uid] || ""),
          row,
        ]));
        const chunks: Row[][] = [];
        for (let offset = 0; offset < flowRows.length; offset += IMPORT_CHUNK_SIZE) {
          chunks.push(flowRows.slice(offset, offset + IMPORT_CHUNK_SIZE));
        }
        if (!chunks.length) return null;
        const now = Date.now();
        const batch = em.create(ViewActionTriggerBatch, {
          initiatorId,
          idempotencyKey,
          requestDigest: batchKey,
          nocodeId: options.nocodeId,
          tableId: options.tableUID,
          viewId: "",
          actionId: "import",
          batchType: "import",
          acceptedCount: flowRows.length,
          blockedCount: 0,
          totalCount: flowRows.length,
          totalChunks: chunks.length,
          completedChunks: 0,
          failedChunks: 0,
          unknownChunks: 0,
          batchStatus: "queued",
          createdAt: now,
          updatedAt: now,
        });
        const tasks = chunks.map((chunk, index) => {
          const chunkId = `${batch.id}:${index}`;
          const chunkQueueState = { previousRows: queueState.previousRows.slice(index * IMPORT_CHUNK_SIZE, (index + 1) * IMPORT_CHUNK_SIZE) };
          const chunkBeforeMutationRows = uuidField?.uid
            ? chunk.map(row => beforeRowsByUUID.get(String(row?.[uuidField.uid] || ""))).filter(Boolean) as Row[]
            : (options.beforeMutationRows || []).slice(index * IMPORT_CHUNK_SIZE, (index + 1) * IMPORT_CHUNK_SIZE);
          const payload: DataMutationTaskPayload = {
            ...(preparedTask?.mutationPayload?.requestDigest
              ? { requestDigest: preparedTask.mutationPayload.requestDigest }
              : options.requestDigest ? { requestDigest: options.requestDigest } : {}),
            ...(options.eventId ? { eventId: options.eventId } : {}),
            action,
            auditAction,
            nocodeId: options.nocodeId,
            tableUID: options.tableUID,
            // When the queue snapshot exists it is the canonical row payload;
            // omitting `rows` avoids storing the same JSON twice per chunk.
            rows: queueState.previousRows.length ? undefined : chunk,
            triggerTodo: true,
            postMutationOnly: true,
            postMutationKind: "import",
            importTaskId: options.importTaskId,
            queueState: chunkQueueState,
            beforeMutationRows: chunkBeforeMutationRows,
            runBatchAggregation: source === DataChangeType.ADD && index === 0,
          };
          const taskValues: RequiredEntityData<ViewActionTriggerTask> = {
            batchId: batch.id,
            initiatorId,
            nocodeId: options.nocodeId,
            tableId: options.tableUID,
            viewId: undefined,
            actionId: undefined,
            uuid: `import:${source}:${options.importTaskId || batch.id}:${index}`,
            dataTitle: `import-post-mutation-${index + 1}/${chunks.length}`,
            sequence: index + 1,
            chunkId,
            chunkSequence: index,
            chunkSize: chunk.length,
            dependsOnTaskId: undefined,
            requestPayload: {},
            taskType: "data_mutation" as const,
            queueClass: "p1" as const,
            priority: index === 0 ? 1 : 0,
            availableAt: now,
            mutationAction: action,
            mutationPayload: payload,
            requestContext: this.captureRequestContext(options.request),
            dedupeKey: index === 0 && preparedTask ? preparedTask.dedupeKey : `${batchKey}:${index}`,
            status: "queued",
            createdAt: now,
            updatedAt: now,
          };
          if (index === 0 && preparedTask) {
            Object.assign(preparedTask, taskValues);
            return preparedTask;
          }
          return em.create(ViewActionTriggerTask, taskValues);
        });
        // The first chunk performs the optional batch aggregation pass. Persist
        // the dependency so multiple P1 workers cannot start row flows before
        // that pass has reached a confirmed terminal state.
        for (const task of tasks.slice(1)) {
          task.dependsOnTaskId = tasks[0].id;
        }
        try {
          await this.taskQueueLock.acquire("persistent-task-enqueue", async () => em.transactional(async tx => {
            // The durable intent already occupies the first chunk slot. Only
            // newly-created chunks consume additional P1 admission capacity.
            await this.assertP1Capacity(tx, Math.max(0, tasks.length - (preparedTask ? 1 : 0)));
            tx.persist([batch, ...tasks]);
            await tx.flush();
          }));
        } catch (error) {
          // A second scheduler may win the database-level dedupe race. In that
          // case its task owns the queue state; do not restore rows underneath it.
          const existingAfterConflict = await em.findOne(ViewActionTriggerBatch, { initiatorId, idempotencyKey });
          if (existingAfterConflict) {
            const existingTasks = await em.find(ViewActionTriggerTask, { batchId: existingAfterConflict.id }, {
              orderBy: { chunkSequence: "ASC", sequence: "ASC" },
            });
            if (existingTasks.length) {
              return {
                taskId: existingTasks[0].id,
                taskIds: existingTasks.map(item => item.id),
                batchId: existingAfterConflict.id,
                queued: existingTasks.some(item => item.status === "queued"),
              };
            }
          }
          if (preparedTask) {
            await this.failImportPostMutationIntent(preparedTask.id, error, true).catch(() => undefined);
          }
          await this.formDataService.restoreQueuedDataChangeFlowRows(
            options.nocodeId,
            options.tableUID,
            queueState,
          );
          throw error;
        }
        this.schedulePump();
        return { taskId: tasks[0].id, taskIds: tasks.map(task => task.id), batchId: batch.id, queued: true };
      });
  }

  /** Persist an unclaimable import intent before the business rows are written. */
  async prepareImportPostMutationIntent(options: {
    formData: NocodeFormData;
    nocodeId: string;
    tableUID: TableUID;
    rows: Row[];
    source?: DataChangeType.ADD | DataChangeType.EDIT;
    beforeMutationRows?: Row[];
    importTaskId?: string;
    eventId?: string;
    runtimeAccount?: Account;
    request?: Request;
  }) {
    const rows = Array.isArray(options.rows) ? options.rows : [];
    if (!rows.length) return null;
    const account = options.runtimeAccount || await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) throw new Error(global.i18next.t("formDataService.noPerm"));
    const source = options.source || DataChangeType.ADD;
    const action = source === DataChangeType.EDIT ? "update" as const : "add" as const;
    const eventId = options.eventId || `import:${options.importTaskId || this.digest({
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      source,
      rows,
    })}:${source}`;
    const dedupeKey = `import-intent:${this.digest({ initiatorId, eventId, nocodeId: options.nocodeId, tableUID: options.tableUID })}`;
    const requestDigest = this.canonicalDigest({
      eventId,
      source,
      importTaskId: options.importTaskId || null,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      rows,
      beforeMutationRows: options.beforeMutationRows || [],
    });
    return await this.enqueueLock.acquire(
      `import-post-mutation-preparation:${options.nocodeId}:${options.tableUID}`,
      async () => {
        const em = this.orm.em.fork();
        const existing = await em.findOne(ViewActionTriggerTask, { dedupeKey });
        if (existing) {
          if (existing.mutationPayload?.requestDigest !== requestDigest) {
            throw new Error("Import event does not match the original request");
          }
          return { taskId: existing.id, eventId, requestDigest, prepared: existing.status === "preparing", replayed: true, status: existing.status };
        }
        const now = Date.now();
        const task = em.create(ViewActionTriggerTask, {
          initiatorId,
          nocodeId: options.nocodeId,
          tableId: options.tableUID,
          uuid: `import-intent:${now}:${Math.random().toString(36).slice(2, 10)}`,
          dataTitle: `import-${source}`,
          sequence: 1,
          requestPayload: {},
          taskType: "data_mutation",
          queueClass: "p1",
          priority: 1,
          availableAt: now,
          mutationAction: action,
          mutationPayload: {
            eventId,
            requestDigest,
            action,
            auditAction: source === DataChangeType.EDIT ? "updateData" : "addData",
            nocodeId: options.nocodeId,
            tableUID: options.tableUID,
            rows,
            triggerTodo: true,
            postMutationOnly: true,
            postMutationKind: "import",
            importTaskId: options.importTaskId,
            conditionWorkerQueue: "p1",
          },
          requestContext: this.captureRequestContext(options.request),
          dedupeKey,
          status: "preparing",
          errorCode: "mutation_commit_pending",
          errorMessage: "Import business mutation has not been confirmed",
          createdAt: now,
          updatedAt: now,
        });
        await em.transactional(async tx => {
          await this.assertP1Capacity(tx, 1);
          tx.persist(task);
          await tx.flush();
        });
        return { taskId: task.id, eventId, requestDigest, prepared: true, replayed: false, status: "preparing" as const };
      },
    );
  }

  async failImportPostMutationIntent(taskId: string, error: unknown, mutationCommitted = false) {
    const wrapped = Object.assign(error instanceof Error ? error : new Error(String(error)), { mutationCommitted });
    await this.failPostMutationIntent(taskId, wrapped);
  }

  async enqueueBulkPostMutation(options: BulkPostMutationOptions) {
    const rows = Array.isArray(options.rows) ? options.rows : [];
    if (!rows.length) {
      if (options.preparedTaskId) {
        const now = Date.now();
        await this.orm.em.fork().nativeUpdate(ViewActionTriggerTask, {
          id: options.preparedTaskId,
          status: "preparing",
        }, {
          status: "completed",
          errorCode: undefined,
          errorMessage: undefined,
          resultPayload: { triggered: false },
          finishedAt: now,
          updatedAt: now,
        });
      }
      return null;
    }

    const account = options.runtimeAccount || await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) throw new Error(global.i18next.t("formDataService.noPerm"));

    const action: Extract<DataMutationTaskAction, "add" | "update" | "delete" | "delete_all"> = options.source === DataChangeType.ADD
      ? "add"
      : options.source === DataChangeType.EDIT
        ? "update"
        : options.auditAction === "deleteAllData" ? "delete_all" : "delete";
    const batchKey = this.digest({
      kind: "bulk-post-mutation",
      eventId: options.eventId,
      initiatorId,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
      action,
    });
    const idempotencyKey = `bulk:${batchKey}`;

    return await this.taskQueueLock.acquire("persistent-task-enqueue", async () => {
      const em = this.orm.em.fork();
      const existingBatch = await em.findOne(ViewActionTriggerBatch, { initiatorId, idempotencyKey });
      if (existingBatch) {
        const existingTasks = await em.find(ViewActionTriggerTask, { batchId: existingBatch.id }, {
          orderBy: { chunkSequence: "ASC", sequence: "ASC" },
        });
        if (existingTasks.length) {
          return {
            taskId: existingTasks[0].id,
            taskIds: existingTasks.map(task => task.id),
            batchId: existingBatch.id,
            queued: existingTasks.some(task => task.status === "queued"),
          };
        }
      }

      const preparedTask = options.preparedTaskId
        ? await em.findOne(ViewActionTriggerTask, { id: options.preparedTaskId, status: "preparing" })
        : null;
      if (options.preparedTaskId && !preparedTask) {
        throw new Error("Post-mutation batch intent could not be promoted");
      }

      const table = options.formData.tables?.find(item => item.uid === options.tableUID);
      const uuidField = getUUIDSystemField(table?.fields || []);
      const uuidOf = (row: Row) => String(row?.[uuidField?.uid] || "");
      const beforeRowsByUUID = new Map((options.beforeMutationRows || []).map(row => [uuidOf(row), row]));
      const queuedRowsByUUID = new Map((options.queueState?.previousRows || []).map(row => [uuidOf(row), row]));
      const chunks: Row[][] = [];
      for (let offset = 0; offset < rows.length; offset += IMPORT_CHUNK_SIZE) {
        chunks.push(rows.slice(offset, offset + IMPORT_CHUNK_SIZE));
      }

      const now = Date.now();
      const batch = em.create(ViewActionTriggerBatch, {
        initiatorId,
        idempotencyKey,
        requestDigest: batchKey,
        nocodeId: options.nocodeId,
        tableId: options.tableUID,
        viewId: "",
        actionId: "bulk-post-mutation",
        batchType: "bulk",
        acceptedCount: rows.length,
        blockedCount: 0,
        totalCount: rows.length,
        totalChunks: chunks.length,
        completedChunks: 0,
        failedChunks: 0,
        unknownChunks: 0,
        batchStatus: "queued",
        createdAt: now,
        updatedAt: now,
      });
      const tasks = chunks.map((chunk, index) => {
        const chunkQueueRows = uuidField?.uid
          ? chunk.map(row => queuedRowsByUUID.get(uuidOf(row))).filter(Boolean) as Row[]
          : (options.queueState?.previousRows || []).slice(index * IMPORT_CHUNK_SIZE, (index + 1) * IMPORT_CHUNK_SIZE);
        const chunkBeforeRows = uuidField?.uid
          ? chunk.map(row => beforeRowsByUUID.get(uuidOf(row))).filter(Boolean) as Row[]
          : (options.beforeMutationRows || []).slice(index * IMPORT_CHUNK_SIZE, (index + 1) * IMPORT_CHUNK_SIZE);
        const canonicalDeleteSnapshot = (action === "delete" || action === "delete_all")
          && chunkQueueRows.length === chunk.length;
        const payload: DataMutationTaskPayload = {
          eventId: options.eventId,
          action,
          auditAction: options.auditAction,
          nocodeId: options.nocodeId,
          tableUID: options.tableUID,
          rows: canonicalDeleteSnapshot ? undefined : chunk,
          triggerTodo: true,
          postMutationOnly: true,
          postMutationKind: "bulk",
          queueState: options.queueState === null
            ? null
            : { previousRows: chunkQueueRows },
          beforeMutationRows: canonicalDeleteSnapshot ? undefined : chunkBeforeRows,
          triggerContext: options.triggerContext,
          causedByTodoId: options.causedByTodoId,
          causedByTaskId: options.causedByTaskId,
          finalizeDeleteWithoutFlow: options.finalizeDeleteWithoutFlow,
          conditionWorkerQueue: "p1",
        };
        const task = index === 0 && preparedTask
          ? preparedTask
          : new ViewActionTriggerTask();
        Object.assign(task, {
          batchId: batch.id,
          initiatorId,
          nocodeId: options.nocodeId,
          tableId: options.tableUID,
          viewId: undefined,
          actionId: undefined,
          uuid: index === 0 && preparedTask?.uuid
            ? preparedTask.uuid
            : `bulk:${options.eventId}:${index}`,
          dataTitle: `bulk-post-mutation-${index + 1}/${chunks.length}`,
          sequence: index + 1,
          chunkId: `${batch.id}:${index}`,
          chunkSequence: index,
          chunkSize: chunk.length,
          dependsOnTaskId: undefined,
          requestPayload: {},
          taskType: "data_mutation",
          queueClass: "p1",
          priority: 0,
          availableAt: now,
          mutationAction: action,
          mutationPayload: {
            ...payload,
            ...(index === 0 && preparedTask?.mutationPayload?.requestDigest
              ? { requestDigest: preparedTask.mutationPayload.requestDigest }
              : {}),
          },
          requestContext: index === 0 && preparedTask?.requestContext
            ? preparedTask.requestContext
            : this.captureRequestContext(options.request),
          dedupeKey: index === 0 && preparedTask?.dedupeKey
            ? preparedTask.dedupeKey
            : `${batchKey}:${index}`,
          status: "queued",
          errorCode: undefined,
          errorMessage: undefined,
          createdAt: index === 0 && preparedTask?.createdAt ? preparedTask.createdAt : now,
          updatedAt: now,
        });
        return task;
      });

      try {
        await em.transactional(async tx => {
          // A prepared intent means the business mutation is already
          // committed. Correctness takes precedence over the admission cap at
          // this point; the cap must not strand a committed delete-all event.
          if (!preparedTask) await this.assertP1Capacity(tx, tasks.length);
          tx.persist([batch, ...tasks]);
          await tx.flush();
        });
      } catch (error) {
        if (preparedTask) {
          const now = Date.now();
          await this.orm.em.fork().nativeUpdate(ViewActionTriggerTask, {
            id: preparedTask.id,
            status: "preparing",
          }, {
            status: "unknown",
            errorCode: "mutation_commit_unknown",
            errorMessage: this.errorMessage(error).slice(0, TASK_ERROR_LIMIT),
            finishedAt: now,
            updatedAt: now,
          }).catch(() => undefined);
        }
        throw error;
      }
      this.schedulePump();
      return {
        taskId: tasks[0].id,
        taskIds: tasks.map(task => task.id),
        batchId: batch.id,
        queued: true,
      };
    });
  }

  async getTaskStatus(taskId: string) {
    const task = await this.orm.em.fork().findOne(ViewActionTriggerTask, { id: taskId });
    return task ? {
      ...this.getTaskTiming(task),
      taskId: task.id,
      status: task.status,
      queueClass: task.queueClass,
      batchId: task.batchId,
      executionPhase: task.executionPhase,
      attemptCount: task.attemptCount,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
    } : null;
  }

  async getBatchStatus(batchId: string) {
    const batch = await this.orm.em.fork().findOne(ViewActionTriggerBatch, { id: batchId }, {
      fields: [
        "id",
        "batchStatus",
        "totalChunks",
        "completedChunks",
        "failedChunks",
        "unknownChunks",
        "updatedAt",
      ],
    });
    return batch ? {
      batchId: batch.id,
      status: batch.batchStatus,
      totalChunks: batch.totalChunks,
      completedChunks: batch.completedChunks,
      failedChunks: batch.failedChunks,
      unknownChunks: batch.unknownChunks,
      updatedAt: batch.updatedAt,
    } : null;
  }

  attach(taskId: string, res: import("express").Response) {
    void this.attachTask(taskId, res);
  }

  private async attachTask(taskId: string, res: import("express").Response) {
    const em = this.orm.em.fork();
    const task = await em.findOne(ViewActionTriggerTask, { id: taskId });
    if (!task) {
      res.status(404).end();
      return;
    }
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write("event: form-mutation-task\n");
    res.write(`data: ${JSON.stringify(this.toTaskSnapshot(task))}\n\n`);
    if (["completed", "failed", "blocked", "stale", "unknown"].includes(task.status)) {
      res.end();
      return;
    }
    const timer = setInterval(() => {
      void this.writeTaskSnapshot(taskId, res, timer);
    }, 500);
    (timer as unknown as { unref?: () => void }).unref?.();
    res.once("close", () => clearInterval(timer));
  }

  private async writeTaskSnapshot(taskId: string, res: import("express").Response, timer: ReturnType<typeof setInterval>) {
    if (res.destroyed || res.writableEnded) {
      clearInterval(timer);
      return;
    }
    const em = this.orm.em.fork();
    const task = await em.findOne(ViewActionTriggerTask, { id: taskId });
    if (!task) {
      clearInterval(timer);
      res.end();
      return;
    }
    res.write("event: form-mutation-task\n");
    res.write(`data: ${JSON.stringify(this.toTaskSnapshot(task))}\n\n`);
    if (["completed", "failed", "blocked", "stale", "unknown"].includes(task.status)) {
      clearInterval(timer);
      res.end();
    }
  }

  async enqueue(request: EnqueueViewActionTriggerRequest, req?: Request): Promise<EnqueueViewActionTriggerResult> {
    const account = await this.formDataService.getAccount();
    const initiatorId = String(account?.id || "").trim();
    if (!initiatorId) {
      throw new Error(global.i18next.t("formDataService.noPerm"));
    }

    const requestContext = this.captureRequestContext(req);

    const idempotencyKey = String(request.idempotencyKey || "").trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new Error("Invalid view action trigger idempotency key");
    }

    const targetUUIDs = [...new Set((request.targetUUIDs || []).map(uuid => String(uuid || "").trim()).filter(Boolean))];
    if (!targetUUIDs.length) {
      throw new Error(global.i18next.t("formDataService.selectDataFirst"));
    }

    const payload = this.normalizePayload(request, targetUUIDs);
    const requestDigest = this.digest({
      nocodeId: payload.nocodeId,
      tableUID: payload.tableUID,
      viewId: payload.viewId,
      actionId: payload.actionId,
      targetUUIDs,
      filterRule: payload.filterRule,
      searchValue: payload.searchValue,
      filters: payload.filters,
    });
    const lockKey = `view-action-trigger-enqueue:${payload.nocodeId}:${payload.tableUID}`;

    return await this.enqueueLock.acquire(lockKey, async () => {
      const em = this.orm.em.fork();
      const existing = await em.findOne(ViewActionTriggerBatch, { initiatorId, idempotencyKey });
      if (existing) {
        if (existing.requestDigest !== requestDigest) {
          throw new Error("View action trigger idempotency key does not match the original request");
        }
        return await this.toEnqueueResult(em, existing);
      }

      const precheck = await this.precheck(payload);
      const precheckByUUID = new Map(precheck.items.map(item => [item.uuid, item]));
      const queueUUIDs = targetUUIDs.filter(uuid => precheckByUUID.get(uuid)?.executable);
      let queueStatesByUUID: Record<string, NonNullable<DataMutationTaskPayload["queueState"]>> = {};
      try {
        const preparedQueueStates = await this.formDataService.prepareViewActionTriggerQueue(
          payload.nocodeId,
          payload.tableUID,
          queueUUIDs,
        );
        if (preparedQueueStates === undefined) {
          throw new Error(`Prepare view action trigger queue failed: ${payload.nocodeId}:${payload.tableUID}`);
        }
        queueStatesByUUID = preparedQueueStates || {};
        const acceptedUUIDs = new Set<string>();

        const result = await this.taskQueueLock.acquire("persistent-task-enqueue", async () => em.transactional(async tx => {
          const batch = tx.create(ViewActionTriggerBatch, {
            initiatorId,
            idempotencyKey,
            requestDigest,
            nocodeId: payload.nocodeId,
            tableId: payload.tableUID,
            viewId: payload.viewId,
            actionId: payload.actionId,
            totalCount: targetUUIDs.length,
            totalChunks: 1,
            batchStatus: "queued",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          const activeRecords = await tx.find(ViewActionTriggerActiveRecord, {
            nocodeId: payload.nocodeId,
            tableId: payload.tableUID,
            uuid: { $in: targetUUIDs },
          });
          const activeUUIDs = new Set(activeRecords.map(item => item.uuid));
          const tasks: ViewActionTriggerTask[] = [];
          const newActiveRecords: ViewActionTriggerActiveRecord[] = [];
          const blockedItems: EnqueueViewActionTriggerBlockedItem[] = [];

          targetUUIDs.forEach((uuid, index) => {
            const check = precheckByUUID.get(uuid);
            const blockedByExistingTask = activeUUIDs.has(uuid);
            const executable = Boolean(check?.executable)
              && Boolean(queueStatesByUUID[uuid])
              && !blockedByExistingTask;
            const reasonCode = blockedByExistingTask ? "task_queued" : (check?.reasonCode || "record_unavailable");
            const message = blockedByExistingTask
              ? global.i18next.t("formFlowService.operationTriggerActiveRecordExists")
              : (check?.message || global.i18next.t("formDataService.recordNotFound"));
            const task = tx.create(ViewActionTriggerTask, {
              batchId: batch.id,
              initiatorId,
              nocodeId: payload.nocodeId,
              tableId: payload.tableUID,
              viewId: payload.viewId,
              actionId: payload.actionId,
              uuid,
              dataTitle: check?.dataTitle || uuid,
              sequence: index + 1,
              requestPayload: {
                ...payload,
                targetUUIDs: [uuid],
                queueState: queueStatesByUUID[uuid] || null,
              },
              requestContext,
              queueClass: "p1",
              priority: 0,
              availableAt: Date.now(),
              status: executable ? "queued" : "blocked",
              ...(executable ? {} : {
                errorCode: reasonCode,
                errorMessage: message.slice(0, TASK_ERROR_LIMIT),
                finishedAt: Date.now(),
              }),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            tasks.push(task);
            if (executable) {
              acceptedUUIDs.add(uuid);
              newActiveRecords.push(tx.create(ViewActionTriggerActiveRecord, {
                taskId: task.id,
                nocodeId: payload.nocodeId,
                tableId: payload.tableUID,
                uuid,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }));
            } else {
              blockedItems.push({ uuid, reasonCode, message });
            }
          });

          await this.assertP1Capacity(tx, newActiveRecords.length);
          batch.acceptedCount = newActiveRecords.length;
          batch.blockedCount = blockedItems.length;
          batch.totalCount = targetUUIDs.length;
          batch.totalChunks = tasks.filter(task => task.status === "queued").length;
          if (batch.totalChunks === 0) batch.batchStatus = "completed";
          batch.updatedAt = Date.now();
          tx.persist([batch, ...tasks, ...newActiveRecords]);
          await tx.flush();
          const result = {
            batchId: batch.id,
            acceptedCount: batch.acceptedCount,
            blockedCount: batch.blockedCount,
            blockedItems,
          };
          return result;
        }));
        await Promise.all(Object.entries(queueStatesByUUID)
          .filter(([uuid]) => !acceptedUUIDs.has(uuid))
          .map(([, queueState]) => this.formDataService.restoreQueuedDataChangeFlowRows(
            payload.nocodeId,
            payload.tableUID,
            queueState,
          )));
        if (result.acceptedCount > 0) {
          this.schedulePump();
        }
        return result;
      } catch (error) {
        await Promise.all(Object.values(queueStatesByUUID).map(queueState => (
          this.formDataService.restoreQueuedDataChangeFlowRows(
            payload.nocodeId,
            payload.tableUID,
            queueState,
          )
        )));
        throw error;
      }
    });
  }

  private normalizePayload(
    request: EnqueueViewActionTriggerRequest,
    targetUUIDs: string[],
  ): ExecuteViewActionRequest {
    return {
      nocodeId: request.nocodeId,
      tableUID: request.tableUID,
      viewId: request.viewId,
      actionId: request.actionId,
      targetUUIDs,
      filterRule: request.filterRule,
      searchValue: request.searchValue,
      filters: request.filters,
    };
  }

  private async toEnqueueResult(
    em: EntityManager,
    batch: ViewActionTriggerBatch,
  ): Promise<EnqueueViewActionTriggerResult> {
    const blockedTasks = await em.find(ViewActionTriggerTask, {
      batchId: batch.id,
      status: "blocked",
      startedAt: null,
    }, {
      orderBy: {
        sequence: "ASC",
      },
    });
    return {
      batchId: batch.id,
      acceptedCount: batch.acceptedCount,
      blockedCount: batch.blockedCount,
      blockedItems: blockedTasks.map(task => ({
        uuid: task.uuid,
        reasonCode: task.errorCode || "blocked",
        message: task.errorMessage || global.i18next.t("formDataService.recordNotFound"),
      })),
    };
  }

  private async recoverInterruptedTasks(recoverPreparingBefore?: number) {
    await this.recoverInterruptedTasksAt(Date.now(), recoverPreparingBefore);
  }

  /**
   * Lightweight check on the already loaded form definition: no matching
   * data-change branch means neither the post-mutation outbox nor the
   * delete-all durable P1 queue has work to do.
   */
  hasPotentialDataChangeFlow(
    formData: NocodeFormData,
    tableUID: TableUID,
    source: DataChangeType,
  ) {
    const process = formData?.formOptions?.[tableUID]?.process;
    if (!process?.enabled) return false;
    const flows = getFlows(process) || [];
    return (flows[0]?.branches || []).some(branch => {
      const trigger = branch.flows?.[0];
      return trigger?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
        && trigger.options?.changeType?.includes(source)
        && (branch.flows?.length || 0) >= 2;
    },
    );
  }

  private async recoverInterruptedTasksAt(now: number, recoverPreparingBefore?: number): Promise<number> {
    const em = this.orm.em.fork();
    const preparingIntents = recoverPreparingBefore === undefined
      ? []
      : await em.find(ViewActionTriggerTask, {
        status: "preparing",
        createdAt: { $lt: recoverPreparingBefore },
      }, { fields: ["id"] });
    let recoveredPreparing = 0;
    for (const intent of preparingIntents) {
      recoveredPreparing += await em.nativeUpdate(ViewActionTriggerTask, {
        id: intent.id,
        status: "preparing",
      }, {
        status: "unknown",
        errorCode: "mutation_commit_unknown",
        errorMessage: "Application stopped before the business mutation receipt was confirmed",
        finishedAt: now,
        updatedAt: now,
      });
    }
    if (recoveredPreparing > 0) {
      this.logger.error(`Recovered ${recoveredPreparing} unconfirmed post-mutation intent(s) as unknown`);
    }
    // Legacy running rows may not have a lease yet. Keep the conditional
    // update per task so a worker that renews between the scan and write is
    // not clobbered, and update batch counters in the same transaction.
    const expiredTasks = await em.find(ViewActionTriggerTask, {
      status: "running",
      $or: [
        { leaseUntil: { $lte: now } },
        { leaseUntil: null },
      ],
    }, { fields: ["id", "batchId", "leaseOwner", "leaseVersion", "executionPhase", "startedAt"] });
    const recovered = await em.transactional(async tx => {
      let count = 0;
      for (const candidate of expiredTasks) {
        // `executing` (and the legacy `side_effect_unknown`) means the
        // side-effect window was entered.  Before that point the task is safe
        // to retry; after it, the result must be reconciled first.
        const sideEffectMayHaveStarted = candidate.executionPhase === "executing"
          || candidate.executionPhase === "side_effect_unknown"
          // A running row from before executionPhase was introduced has no
          // evidence that it stopped before its first side effect. Treat it
          // conservatively until a step-level reconciliation record exists.
          || (!candidate.executionPhase && candidate.startedAt != null);
        // A worker can crash after the business operation committed but before
        // the task terminal update. A durable succeeded step is enough to
        // repair that terminal update without replaying the operation.
        const confirmedStep = sideEffectMayHaveStarted
          ? await tx.findOne(FlowTaskStepExecution, {
            taskId: candidate.id,
            status: "succeeded",
            stepKey: { $in: ["data-mutation", "post-mutation-flow", "view-action-trigger"] },
          })
          : null;
        const recoveryStatus = confirmedStep
          ? "completed"
          : sideEffectMayHaveStarted ? "unknown" : "queued";
        const updated = await tx.nativeUpdate(ViewActionTriggerTask, {
          id: candidate.id,
          status: "running",
          leaseOwner: candidate.leaseOwner ?? null,
          leaseVersion: candidate.leaseVersion ?? null,
          $or: [
            { leaseUntil: { $lte: now } },
            { leaseUntil: null },
          ],
        }, {
          status: recoveryStatus,
          errorCode: confirmedStep ? null : sideEffectMayHaveStarted ? "process_interrupted" : undefined,
          errorMessage: confirmedStep ? null : sideEffectMayHaveStarted
            ? "Task execution was interrupted after entering a side-effect window; result requires reconciliation"
            : undefined,
          resultPayload: confirmedStep?.resultSnapshot ?? null,
          updatedAt: now,
          finishedAt: recoveryStatus === "queued" ? null : now,
          startedAt: sideEffectMayHaveStarted ? candidate.startedAt : null,
          availableAt: now,
          leaseOwner: null,
          leaseUntil: null,
          executionPhase: null,
        });
        if (updated !== 1) continue;
        count += 1;
        if (recoveryStatus === "unknown") {
          await this.markUnknownBatchTasks(tx, candidate, now);
        } else if (recoveryStatus === "completed") {
          if (candidate.batchId) {
            const batch = await tx.findOne(ViewActionTriggerBatch, { id: candidate.batchId });
            if (batch) {
              batch.completedChunks += 1;
              batch.batchStatus = batch.unknownChunks > 0
                ? "unknown"
                : batch.completedChunks + batch.failedChunks >= batch.totalChunks && batch.totalChunks > 0
                  ? (batch.failedChunks > 0 ? "failed" : "completed")
                  : "running";
              batch.updatedAt = now;
              tx.persist(batch);
            }
          }
          const nativeDelete = (tx as unknown as {
            nativeDelete?: (entity: typeof ViewActionTriggerActiveRecord, filter: Record<string, unknown>) => Promise<number>;
          }).nativeDelete;
          if (nativeDelete) {
            await nativeDelete.call(tx, ViewActionTriggerActiveRecord, { taskId: candidate.id });
          }
        }
      }
      return count;
    });
    if (recovered) {
      this.logger.warn(`recovered ${recovered} expired view action trigger tasks`);
    }
    const nextLease = await em.findOne(ViewActionTriggerTask, {
      status: "running",
      leaseUntil: { $gt: now },
    }, { orderBy: { leaseUntil: "ASC" }, fields: ["leaseUntil"] });
    if (nextLease?.leaseUntil && !this.stopped) {
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = undefined;
        void this.recoverInterruptedTasks().then(() => this.schedulePump()).catch(error => {
          this.logger.error("recover expired view action trigger tasks failed", this.errorMessage(error));
        });
      }, Math.max(100, nextLease.leaseUntil - Date.now()));
      (this.recoveryTimer as unknown as { unref?: () => void }).unref?.();
    }
    return recoveredPreparing + recovered;
  }

  private startPumpIfEnabled() {
    const workerMode = process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool";
    if (!["inline", "protocol", "tinypool"].includes(workerMode)) {
      this.logger.error(`Unsupported FLOW_EXECUTION_WORKER_MODE=${workerMode}; flow tasks remain queued`);
      return;
    }
    return this.pump();
  }

  /**
   * Coalesce wakeups generated by batch enqueue/finalization. The durable
   * task table remains the source of truth; this only bounds event-loop work.
   */
  private schedulePump() {
    if (this.stopped || this.pumpScheduled) return;
    this.pumpScheduled = true;
    setImmediate(() => {
      this.pumpScheduled = false;
      void this.startPumpIfEnabled();
    });
  }

  private canClaimWorkerTask(queueClass: FlowSchedulerQueue) {
    const workerMode = process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool";
    if (workerMode !== "tinypool" || !this.flowWorkerPool
      || typeof this.flowWorkerPool.canAcceptGatewayWork !== "function") return true;
    return this.flowWorkerPool.canAcceptGatewayWork(queueClass);
  }

  private scheduleGatewayAdmissionRetry() {
    if (this.stopped || this.gatewayAdmissionRetryTimer) return;
    this.gatewayAdmissionRetryTimer = setTimeout(() => {
      this.gatewayAdmissionRetryTimer = undefined;
      this.schedulePump();
    }, GATEWAY_ADMISSION_RETRY_MS);
    (this.gatewayAdmissionRetryTimer as unknown as { unref?: () => void }).unref?.();
  }

  private async pump() {
    if (this.stopped) return;
    if (this.pumpPromise) return await this.pumpPromise;
    // Run queue admission independently. A slow P1 dependency scan or
    // database lock must not hold the P0 admission loop behind an await.
    this.pumpPromise = Promise.all(
      (["p0", "p1"] as FlowSchedulerQueue[]).map(queueClass => this.pumpQueue(queueClass)),
    ).then(() => undefined).catch(error => {
      this.logger.error("view action trigger pump failed", this.errorMessage(error));
    }).finally(() => {
      this.pumpPromise = undefined;
    });
    await this.pumpPromise;
  }

  private async pumpQueue(queueClass: FlowSchedulerQueue) {
    const existing = this.queuePumpPromises[queueClass];
    if (existing) return await existing;
    const configuredLimit = queueClass === "p0" ? P0_CONCURRENCY : P1_CONCURRENCY;
    const workerMode = process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool";
    const workerLimit = workerMode === "tinypool"
      && this.flowWorkerPool
      && typeof this.flowWorkerPool.getMaxConcurrency === "function"
      ? this.flowWorkerPool.getMaxConcurrency(queueClass)
      : configuredLimit;
    const limit = Math.max(1, Math.min(configuredLimit, workerLimit));
    const promise = (async () => {
      while (!this.stopped && this.activeByQueue[queueClass] < limit) {
        if (!this.canClaimWorkerTask(queueClass)) {
          this.scheduleGatewayAdmissionRetry();
          break;
        }
        const task = await this.claimNextTask(queueClass);
        if (!task) break;
        if (this.stopped) {
          await this.releaseClaimedTask(task);
          break;
        }
        // Recheck after the claim transaction. A different active task may
        // have opened the circuit while this task was being claimed.
        if (!this.canClaimWorkerTask(queueClass)) {
          await this.releaseClaimedTask(task);
          this.scheduleGatewayAdmissionRetry();
          break;
        }
        this.activeByQueue[queueClass] += 1;
        if (task.batchId) {
          this.activeByBatch.set(task.batchId, (this.activeByBatch.get(task.batchId) || 0) + 1);
          const batchQueueKey = `${task.batchId}:${queueClass}`;
          this.activeByBatchAndQueue.set(batchQueueKey, (this.activeByBatchAndQueue.get(batchQueueKey) || 0) + 1);
        }
        if (queueClass === "p1" && task.initiatorId) {
          this.activeByInitiator.set(task.initiatorId, (this.activeByInitiator.get(task.initiatorId) || 0) + 1);
        }
        const execution = this.execute(task).catch(error => {
          this.logger.error(`view action trigger task execution failed: ${task.id}`, this.errorMessage(error));
        });
        this.activeExecutions.add(execution);
        void execution.finally(() => {
          this.activeExecutions.delete(execution);
          this.activeByQueue[queueClass] = Math.max(0, this.activeByQueue[queueClass] - 1);
          if (task.batchId) {
            const remaining = Math.max(0, (this.activeByBatch.get(task.batchId) || 1) - 1);
            if (remaining) this.activeByBatch.set(task.batchId, remaining);
            else this.activeByBatch.delete(task.batchId);
            const batchQueueKey = `${task.batchId}:${queueClass}`;
            const queueRemaining = Math.max(0, (this.activeByBatchAndQueue.get(batchQueueKey) || 1) - 1);
            if (queueRemaining) this.activeByBatchAndQueue.set(batchQueueKey, queueRemaining);
            else this.activeByBatchAndQueue.delete(batchQueueKey);
          }
          if (queueClass === "p1" && task.initiatorId) {
            const remaining = Math.max(0, (this.activeByInitiator.get(task.initiatorId) || 1) - 1);
            if (remaining) this.activeByInitiator.set(task.initiatorId, remaining);
            else this.activeByInitiator.delete(task.initiatorId);
          }
          this.schedulePump();
        });
      }
    })().catch(error => {
      this.logger.error(`view action trigger ${queueClass} pump failed`, this.errorMessage(error));
    }).finally(() => {
      if (this.queuePumpPromises[queueClass] === promise) {
        delete this.queuePumpPromises[queueClass];
      }
    });
    this.queuePumpPromises[queueClass] = promise;
    await promise;
  }

  private async claimNextTask(queueClass: PersistentTaskQueueClass): Promise<ViewActionTriggerTask | null> {
    const em = this.orm.em.fork();
    const taskId = await em.transactional(async tx => {
      const now = Date.now();
      const saturatedBatchIds = [...this.activeByBatch.entries()]
        .filter(([, active]) => active >= P1_BATCH_CONCURRENCY)
        .map(([batchId]) => batchId);
      const saturatedInitiatorIds = queueClass === "p1"
        ? [...this.activeByInitiator.entries()]
          .filter(([, active]) => active >= P1_INITIATOR_CONCURRENCY)
          .map(([initiatorId]) => initiatorId)
        : [];
      const excludedBatchIds = new Set(saturatedBatchIds);
      const queueFilter: FilterQuery<ViewActionTriggerTask> = {
        status: "queued",
        queueClass: queueClass === "p1" ? { $in: ["p1", null] } : queueClass,
        $and: [
          {
            $or: [
              { availableAt: { $lte: now } },
              { availableAt: null },
            ],
          },
        ],
      };
      if (queueClass === "p1" && saturatedInitiatorIds.length) {
        queueFilter.$and?.push({
          $or: [
            { initiatorId: null },
            { initiatorId: { $nin: saturatedInitiatorIds } },
          ],
        });
      }
      // A dependency-blocked import batch must not occupy the whole candidate
      // window while its prerequisite runs. Exclude such batches in SQL and
      // retry the bounded lookup so later batches can make progress.
      for (let scan = 0; scan < 4; scan += 1) {
        if (queueClass === "p1" && excludedBatchIds.size) {
          queueFilter.$and?.push({
            $or: [
              { batchId: null },
              { batchId: { $nin: [...excludedBatchIds] } },
            ],
          });
        }
        const candidates = await tx.find(ViewActionTriggerTask, queueFilter, {
          orderBy: {
            priority: "DESC",
            createdAt: "ASC",
            sequence: "ASC",
            id: "ASC",
          },
          limit: Math.max(8, P1_BATCH_CONCURRENCY * 8),
        });
        const dependencyIds = [...new Set(candidates
          .map(task => task.dependsOnTaskId)
          .filter((id): id is string => Boolean(id)))];
        const dependencies = dependencyIds.length
          ? await tx.find(ViewActionTriggerTask, {
            id: { $in: dependencyIds },
          }, { fields: ["id", "status"] })
          : [];
        const dependencyById = new Map(dependencies.map(dependency => [dependency.id, dependency]));
        let dependencyBatchExcluded = false;
        for (const task of candidates) {
          if (queueClass === "p1" && task.batchId
            && (this.activeByBatchAndQueue.get(`${task.batchId}:${queueClass}`) || 0) >= P1_BATCH_CONCURRENCY) {
            continue;
          }
          if (queueClass === "p1" && task.initiatorId
            && (this.activeByInitiator.get(task.initiatorId) || 0) >= P1_INITIATOR_CONCURRENCY) {
            continue;
          }
          if (task.dependsOnTaskId) {
            const dependency = dependencyById.get(task.dependsOnTaskId);
            // A dependency that is still running/queued, or whose result is
            // unknown, must fence this chunk. A confirmed failure is terminal:
            // the row-level flow can still run after aggregation fallback.
            if (!dependency || dependency.status === "unknown") {
              const markedUnknown = await tx.nativeUpdate(ViewActionTriggerTask, {
                id: task.id,
                status: "queued",
              }, {
                status: "unknown",
                errorCode: dependency ? "dependency_unknown" : "dependency_missing",
                errorMessage: dependency
                  ? "A prerequisite batch chunk has an unconfirmed result"
                  : "A prerequisite batch chunk is missing",
                updatedAt: now,
                finishedAt: now,
              });
              if (markedUnknown === 1) await this.markUnknownBatchTasks(tx, task, now);
              continue;
            }
            if (!["completed", "failed", "blocked", "stale"].includes(dependency.status)) {
              if (queueClass === "p1" && task.batchId) {
                excludedBatchIds.add(task.batchId);
                dependencyBatchExcluded = true;
              }
              continue;
            }
          }
          const updatedCount = await tx.nativeUpdate(
            ViewActionTriggerTask,
            { id: task.id, status: "queued" },
            {
              status: "running",
              startedAt: now,
              updatedAt: now,
              leaseOwner: this.schedulerId,
              leaseUntil: now + TASK_LEASE_MS,
              leaseVersion: (task.leaseVersion || 0) + 1,
              attemptCount: (task.attemptCount || 0) + 1,
              executionPhase: "claimed",
            },
          );
          if (updatedCount === 1) {
            return task.id;
          }
        }
        if (!dependencyBatchExcluded || !candidates.length) break;
      }
      return null;
    });
    return taskId
      ? await this.orm.em.fork().findOne(ViewActionTriggerTask, { id: taskId })
      : null;
  }

  private async execute(task: ViewActionTriggerTask) {
    const lease = this.startLeaseRenewal(task);
    this.activeLeaseStops.add(lease.stop);
    try {
      const workerMode = process.env.FLOW_EXECUTION_WORKER_MODE || "tinypool";
      if (workerMode === "tinypool") {
        if (!this.flowWorkerPool) {
          if ((task.queueClass || "p1") === "p1") {
            throw this.asRetryableWorkerError(new Error("Tinypool flow execution requested without a worker pool"));
          }
          this.logWorkerFallback("Tinypool P0 execution requested without a worker pool; falling back inline");
        } else {
          let workerResult: Awaited<ReturnType<FlowWorkerPool["prepareFlowTask"]>> | undefined;
          try {
            workerResult = await this.flowWorkerPool.prepareFlowTask({
              taskId: task.id,
              queueClass: task.queueClass || "p1",
              leaseOwner: task.leaseOwner || this.schedulerId,
              leaseVersion: task.leaseVersion || 1,
              leaseUntil: task.leaseUntil || Date.now() + TASK_LEASE_MS,
              attempt: task.attemptCount || 1,
            }, task.taskType, this.getStepKey(task), task.taskType === "data_mutation" ? (task.mutationPayload?.rows?.length || 0) : 1);
          } catch (error) {
            // Preparation is side-effect free. P1 must retry instead of
            // moving a whole batch back onto the main thread; P0 may use the
            // bounded inline compatibility path to preserve interactivity.
            const code = String((error as { code?: unknown })?.code || "").toUpperCase();
            if ((task.queueClass || "p1") === "p1"
              || code === "FLOW_GATEWAY_CIRCUIT_OPEN"
              || code === "FLOW_GATEWAY_CAPACITY_EXCEEDED") {
              throw this.asRetryableWorkerError(error);
            }
            this.logWorkerFallback(`Tinypool P0 preparation failed; falling back inline: ${this.errorMessage(error)}`);
          }
          if (workerResult?.accepted === false) {
            await this.finish(task, "unknown", "worker_lease_rejected", "Worker rejected the task lease");
            return;
          }
        }
      }
      if (workerMode !== "inline" && workerMode !== "protocol" && workerMode !== "tinypool") {
        await this.releaseClaimedTask(task);
        return;
      }
      // Protocol mode verifies the structured-clone and Gateway boundary
      // without changing the main-process side-effect ownership.
      if (workerMode === "protocol") {
        if (!this.flowWorkerPool) throw new Error("Flow worker pool is unavailable");
        if (this.flowWorkerPool.isDatabaseSupported()) {
          try {
            const workerResult = await this.flowWorkerPool.loadTaskRef({
              taskId: task.id,
              // Rows created before queue classification may still contain NULL;
              // the P1 claim path deliberately accepts those legacy rows.
              queueClass: task.queueClass || "p1",
              leaseOwner: task.leaseOwner || this.schedulerId,
              leaseVersion: task.leaseVersion || 1,
              leaseUntil: task.leaseUntil || Date.now() + TASK_LEASE_MS,
              attempt: task.attemptCount || 1,
            });
            if (workerResult.accepted === false) {
              await this.finish(task, "unknown", "worker_lease_rejected", "Worker rejected the task lease");
              return;
            }
          } catch (error) {
            this.logWorkerFallback(`Flow worker protocol probe failed; falling back inline: ${this.errorMessage(error)}`);
          }
        }
      }
      if (lease.isLost()) {
        await this.finish(task, "unknown", "lease_lost", "Task lease is no longer valid");
        return;
      }
      const account = await this.workbenchService.getUserById(task.initiatorId);
      if (account.disabled || account.resigned) {
        await this.restoreTaskQueueState(task);
        await this.finish(task, "blocked", "initiator_unavailable", global.i18next.t("formDataService.noPerm"));
        return;
      }
      await RequestStorage.runWithRequest({
        ...this.sanitizeRequestContext(task.requestContext),
        account,
      } as Request, async () => {
        await RequestContext.createAsync(this.orm.em, async () => {
          if (lease.isLost()) {
            await this.finish(task, "unknown", "lease_lost", "Task lease is no longer valid");
            return;
          }
          if (task.taskType === "data_mutation") {
            if (!(await this.markExecutionPhase(task, "prepared"))) return;
            if (!(await this.markExecutionPhase(task, "executing"))) return;
            const stepKey = this.getStepKey(task);
            const step = await this.beginStepExecution(task, stepKey);
            if (step.status === "succeeded") {
              await this.finish(task, "completed", undefined, undefined, step.resultSnapshot);
              return;
            }
            if (step.status === "unknown") {
              await this.finish(task, "unknown", "step_result_unknown", "Step result requires reconciliation");
              return;
            }
            if (step.status === "failed") {
              await this.finish(task, "failed", "step_failed", "Step previously failed with a confirmed result", step.resultSnapshot);
              return;
            }
            if (step.owned === false) return;
            const result = await this.executeDataMutation(task, account);
            if (!(await this.completeStepExecution(task, stepKey, result))) {
              await this.finish(task, "unknown", "lease_lost", "Step completed but its lease could not be confirmed");
              return;
            }
            if (!this.finalizationAllowed || lease.isLost()) {
              if (lease.isLost()) await this.finish(task, "unknown", "lease_lost", "Task lease expired during execution");
              return;
            }
            await this.finish(task, "completed", undefined, undefined, result);
            return;
          }
          const request: ExecuteViewActionRequest = {
            ...task.requestPayload,
            targetUUIDs: [task.uuid],
          } as ExecuteViewActionRequest;
          const precheck = await this.formDataService.precheckViewActionTrigger(request);
          const item = precheck.items.find(current => current.uuid === task.uuid);
          if (!item?.executable) {
            await this.restoreTaskQueueState(task);
            await this.finish(
              task,
              item?.reasonCode === "record_unavailable" ? "stale" : "blocked",
              item?.reasonCode || "record_unavailable",
              item?.message || global.i18next.t("formDataService.recordNotFound"),
            );
            return;
          }
          if (!(await this.markExecutionPhase(task, "prepared"))) return;
          if (!(await this.markExecutionPhase(task, "executing"))) return;
          const stepKey = this.getStepKey(task);
          const step = await this.beginStepExecution(task, stepKey);
          if (step.status === "succeeded") {
            await this.finish(task, "completed", undefined, undefined, step.resultSnapshot);
            return;
          }
          if (step.status === "unknown") {
            await this.finish(task, "unknown", "step_result_unknown", "Step result requires reconciliation");
            return;
          }
          if (step.status === "failed") {
            await this.finish(task, "failed", "step_failed", "Step previously failed with a confirmed result", step.resultSnapshot);
            return;
          }
          if (step.owned === false) return;
          const result = await this.formDataService.executeViewAction(request, {
            flowWorkerContext: task.leaseOwner && task.leaseVersion
              ? {
                taskId: task.id,
                leaseOwner: task.leaseOwner,
                leaseVersion: task.leaseVersion,
                queueClass: task.queueClass === "p0" ? "p0" : "p1",
              }
              : undefined,
          });
          if ((result.successCount || 0) <= 0) {
            const failedItem = result.failedItems?.[0];
            await this.restoreTaskQueueState(task);
            if (!(await this.failStepExecution(
              task,
              stepKey,
              "trigger_failed",
              failedItem?.message || result.message || global.i18next.t("formFlowService.flowExecutionFailed"),
              result,
            ))) {
              await this.finish(task, "unknown", "lease_lost", "Failed step could not be fenced");
              return;
            }
            await this.finish(
              task,
              "failed",
              "trigger_failed",
              failedItem?.message || result.message || global.i18next.t("formFlowService.flowExecutionFailed"),
              result,
            );
            return;
          }
          if (!(await this.completeStepExecution(task, stepKey, result))) {
            await this.finish(task, "unknown", "lease_lost", "Step completed but its lease could not be confirmed");
            return;
          }
          if (!this.finalizationAllowed || lease.isLost()) {
            if (lease.isLost()) await this.finish(task, "unknown", "lease_lost", "Task lease expired during execution");
            return;
          }
          await this.finish(task, "completed", undefined, undefined, result);
        });
      });
    } catch (error) {
      if (!this.finalizationAllowed) return;
      if (lease.isLost()) {
        await this.finish(task, "unknown", "lease_lost", "Task lease expired during execution");
        return;
      }
      if (task.executionPhase === "executing") {
        await this.markStepUnknown(task, this.getStepKey(task), error);
        await this.finish(task, "unknown", "step_result_unknown", this.errorMessage(error));
        return;
      }
      if (this.shouldRetry(task, error)) {
        await this.retryTask(task, error);
        return;
      }
      await this.restoreTaskQueueState(task);
      this.logger.error(`View action trigger task failed: ${task.id}:${task.uuid}`, error instanceof Error ? error.stack : String(error));
      await this.finish(task, "failed", "trigger_failed", this.errorMessage(error));
    } finally {
      lease.stop();
      this.activeLeaseStops.delete(lease.stop);
    }
  }

  private async releaseClaimedTask(task: ViewActionTriggerTask) {
    const em = this.orm.em.fork();
    await em.nativeUpdate(ViewActionTriggerTask, {
      id: task.id,
      status: "running",
      leaseOwner: this.schedulerId,
      leaseVersion: task.leaseVersion,
      leaseUntil: { $gt: Date.now() },
    }, {
      status: "queued",
      startedAt: null,
      leaseOwner: null,
      leaseUntil: null,
      executionPhase: null,
      updatedAt: Date.now(),
    });
  }

  /**
   * Small scheduler port used by contract/integration tests and by a future
   * worker execution adapter. It returns only the serializable lease token,
   * never an ORM entity or repository instance.
   */
  async claim(queueClass: FlowSchedulerQueue): Promise<FlowWorkerTaskRef | null> {
    const task = await this.claimNextTask(queueClass);
    if (!task || !task.leaseOwner || !task.leaseVersion || !task.leaseUntil) return null;
    return {
      taskId: task.id,
      queueClass,
      leaseOwner: task.leaseOwner,
      leaseVersion: task.leaseVersion,
      leaseUntil: task.leaseUntil,
      attempt: task.attemptCount || 1,
    };
  }

  async renew(ref: FlowWorkerTaskRef): Promise<boolean> {
    const now = Date.now();
    // A delayed worker must not renew using a lease token that has already
    // expired locally, even if another actor happened to extend the row.
    if (ref.leaseUntil <= now) return false;
    const updated = await this.orm.em.fork().nativeUpdate(ViewActionTriggerTask, {
      id: ref.taskId,
      status: "running",
      leaseOwner: ref.leaseOwner,
      leaseVersion: ref.leaseVersion,
      leaseUntil: { $gt: now },
    }, {
      leaseUntil: now + TASK_LEASE_MS,
      updatedAt: now,
    });
    if (updated === 1) ref.leaseUntil = now + TASK_LEASE_MS;
    return updated === 1;
  }

  async commit(ref: FlowWorkerTaskRef, result: FlowSchedulerResult): Promise<boolean> {
    const task = await this.orm.em.fork().findOne(ViewActionTriggerTask, { id: ref.taskId });
    if (!task || task.status !== "running" || task.leaseOwner !== ref.leaseOwner || task.leaseVersion !== ref.leaseVersion
      || !task.leaseUntil || task.leaseUntil <= Date.now() || ref.leaseUntil <= Date.now()) {
      return false;
    }
    return await this.finish(task, result.outcome, result.errorCode, result.errorMessage, result.resultPayload, ref.leaseOwner);
  }

  async recoverExpired(now = Date.now(), recoverPreparingBefore?: number): Promise<number> {
    return await this.recoverInterruptedTasksAt(now, recoverPreparingBefore);
  }

  private getStepKey(task: Pick<ViewActionTriggerTask, "taskType" | "mutationPayload">) {
    if (task.taskType === "data_mutation") {
      return task.mutationPayload?.postMutationOnly ? "post-mutation-flow" : "data-mutation";
    }
    return "view-action-trigger";
  }

  private getStepIdempotencyKey(taskId: string, stepKey: string) {
    return `flow-step:${taskId}:${stepKey}`;
  }

  /**
   * Claim the logical step exactly once for the current task lease. A step
   * left in `started`/`unknown` by a crashed worker is intentionally not
   * replayed; only a confirmed success may be used to repair a task terminal
   * state without running the business operation again.
   */
  private async beginStepExecution(task: ViewActionTriggerTask, stepKey: string): Promise<StepExecutionResult> {
    const em = this.orm.em.fork();
    const transactional = (em as unknown as {
      transactional?: (callback: (tx: EntityManager) => Promise<unknown>) => Promise<unknown>;
    }).transactional;
    if (!transactional) {
      // Keep lightweight scheduler unit fixtures compatible; real MikroORM
      // always takes the durable path below.
      return { status: "started" };
    }
    const leaseOwner = task.leaseOwner || this.schedulerId;
    const leaseVersion = task.leaseVersion || 1;
    const now = Date.now();
    const readExisting = async () => {
      const existing = await em.findOne(FlowTaskStepExecution, { taskId: task.id, stepKey });
      if (!existing) return undefined;
      return {
        status: existing.status,
        resultSnapshot: existing.resultSnapshot,
        owned: false,
      } as StepExecutionResult;
    };
    try {
      return await transactional.call(em, async tx => {
        const currentTask = await tx.findOne(ViewActionTriggerTask, {
          id: task.id,
          status: "running",
          leaseOwner,
          leaseVersion,
          leaseUntil: { $gt: now },
        }, { fields: ["id"] });
        if (!currentTask) {
          const error = new Error("Task lease is no longer valid") as Error & { code?: string };
          error.code = "FLOW_LEASE_LOST";
          throw error;
        }
        const existing = await tx.findOne(FlowTaskStepExecution, { taskId: task.id, stepKey });
        if (existing) {
          if (existing.status === "started"
            && (existing.leaseOwner !== leaseOwner || existing.leaseVersion !== leaseVersion)) {
            return { status: "unknown" as const, resultSnapshot: existing.resultSnapshot, owned: false };
          }
          return { status: existing.status, resultSnapshot: existing.resultSnapshot, owned: false };
        }
        const step = tx.create(FlowTaskStepExecution, {
          taskId: task.id,
          stepKey,
          idempotencyKey: this.getStepIdempotencyKey(task.id, stepKey),
          status: "started",
          attempt: task.attemptCount || 1,
          leaseOwner,
          leaseVersion,
          startedAt: now,
          updatedAt: now,
        });
        tx.persist(step);
        await tx.flush();
        return { status: "started" as const, owned: true };
      });
    } catch (error) {
      // A concurrent scheduler may have inserted the unique step row first.
      // Re-read it after the losing transaction rolls back and reuse its
      // durable result instead of executing the side effect twice.
      if (!(error instanceof UniqueConstraintViolationException)) throw error;
      const existing = await readExisting();
      if (existing) return existing;
      throw error;
    }
  }

  private async completeStepExecution(task: ViewActionTriggerTask, stepKey: string, result: unknown) {
    const em = this.orm.em.fork();
    const transactional = (em as unknown as {
      transactional?: (callback: (tx: EntityManager) => Promise<unknown>) => Promise<unknown>;
    }).transactional;
    if (!transactional) return true;
    const now = Date.now();
    const leaseOwner = task.leaseOwner || this.schedulerId;
    const leaseVersion = task.leaseVersion || 1;
    return await transactional.call(em, async tx => {
      const taskUpdated = await tx.nativeUpdate(ViewActionTriggerTask, {
        id: task.id,
        status: "running",
        leaseOwner,
        leaseVersion,
        leaseUntil: { $gt: now },
      }, { updatedAt: now });
      if (taskUpdated !== 1) return false;
      const updated = await tx.nativeUpdate(FlowTaskStepExecution, {
        taskId: task.id,
        stepKey,
        status: "started",
        leaseOwner,
        leaseVersion,
      }, {
        status: "succeeded",
        resultSnapshot: result,
        finishedAt: now,
        updatedAt: now,
        errorCode: null,
        errorMessage: null,
      });
      if (updated === 1) return true;
      // Another executor may have confirmed this exact step first. Reuse its
      // durable success instead of turning a harmless race into `unknown`.
      const existing = await tx.findOne(FlowTaskStepExecution, { taskId: task.id, stepKey });
      return existing?.status === "succeeded";
    });
  }

  private async failStepExecution(
    task: ViewActionTriggerTask,
    stepKey: string,
    errorCode: string,
    errorMessage: string,
    result: unknown,
  ) {
    const em = this.orm.em.fork();
    const transactional = (em as unknown as {
      transactional?: (callback: (tx: EntityManager) => Promise<unknown>) => Promise<unknown>;
    }).transactional;
    if (!transactional) return true;
    const now = Date.now();
    const leaseOwner = task.leaseOwner || this.schedulerId;
    const leaseVersion = task.leaseVersion || 1;
    return await transactional.call(em, async tx => {
      const taskUpdated = await tx.nativeUpdate(ViewActionTriggerTask, {
        id: task.id,
        status: "running",
        leaseOwner,
        leaseVersion,
        leaseUntil: { $gt: now },
      }, { updatedAt: now });
      if (taskUpdated !== 1) return false;
      const updated = await tx.nativeUpdate(FlowTaskStepExecution, {
        taskId: task.id,
        stepKey,
        status: "started",
        leaseOwner,
        leaseVersion,
      }, {
        status: "failed",
        resultSnapshot: result,
        errorCode,
        errorMessage: errorMessage.slice(0, TASK_ERROR_LIMIT),
        finishedAt: now,
        updatedAt: now,
      });
      if (updated === 1) return true;
      const existing = await tx.findOne(FlowTaskStepExecution, { taskId: task.id, stepKey });
      return existing?.status === "failed";
    });
  }

  private async markStepUnknown(task: ViewActionTriggerTask, stepKey: string, error: unknown) {
    const em = this.orm.em.fork();
    const nativeUpdate = (em as unknown as {
      nativeUpdate?: (entity: unknown, filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<number>;
    }).nativeUpdate;
    if (!nativeUpdate) return;
    const now = Date.now();
    await nativeUpdate.call(em, FlowTaskStepExecution, {
      taskId: task.id,
      stepKey,
      status: "started",
      leaseOwner: task.leaseOwner || this.schedulerId,
      leaseVersion: task.leaseVersion || 1,
    }, {
      status: "unknown",
      errorCode: "STEP_RESULT_UNKNOWN",
      errorMessage: this.errorMessage(error).slice(0, TASK_ERROR_LIMIT),
      finishedAt: now,
      updatedAt: now,
    });
  }

  private async markExecutionPhase(
    task: ViewActionTriggerTask,
    executionPhase: ViewActionTriggerTaskExecutionPhase,
  ) {
    const em = this.orm.em.fork();
    const updated = await em.nativeUpdate(ViewActionTriggerTask, {
      id: task.id,
      status: "running",
      leaseOwner: this.schedulerId,
      leaseVersion: task.leaseVersion,
      leaseUntil: { $gt: Date.now() },
    }, {
      executionPhase,
      updatedAt: Date.now(),
    });
    if (updated === 1) {
      task.executionPhase = executionPhase;
      return true;
    }
    return false;
  }

  private shouldRetry(task: ViewActionTriggerTask, error: unknown) {
    if (task.executionPhase === "executing" || task.executionPhase === "side_effect_unknown") return false;
    if ((task.attemptCount || 0) >= TASK_MAX_ATTEMPTS) return false;
    const retryMetadata = error as { code?: unknown; retryable?: unknown; idempotent?: unknown };
    const code = String(retryMetadata?.code || "").toUpperCase();
    if (["FLOW_WORKER_TIMEOUT", "FLOW_GATEWAY_CIRCUIT_OPEN", "FLOW_GATEWAY_CAPACITY_EXCEEDED"].includes(code)) return true;
    if (task.taskType !== "data_mutation" || task.mutationPayload?.postMutationOnly !== true) return false;
    const message = this.errorMessage(error).toLowerCase();
    return ["SQLITE_BUSY", "SQLITE_LOCKED", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(code)
      || message.includes("database is locked")
      || message.includes("deadlock")
      || message.includes("lock wait timeout")
      || (retryMetadata?.retryable === true && retryMetadata?.idempotent === true);
  }

  private async assertP1Capacity(em: EntityManager, additional: number) {
    if (additional <= 0) return;
    if (MAX_PENDING_P1 === 0) {
      throw new Error("P1 flow queue is paused");
    }
    const pending = await em.count(ViewActionTriggerTask, {
      queueClass: { $in: ["p1", null] },
      status: { $in: ["preparing", "queued", "running"] },
    });
    if (pending + additional > MAX_PENDING_P1) {
      throw new Error(`P1 flow queue capacity exceeded (${MAX_PENDING_P1})`);
    }
  }

  private async retryTask(task: ViewActionTriggerTask, error: unknown) {
    const attempt = Math.max(1, task.attemptCount || 1);
    const baseDelay = Math.min(TASK_RETRY_MAX_MS, TASK_RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1)));
    // Deterministic per-task jitter prevents a large batch that hit the same
    // database lock from waking all retries at one instant, while keeping
    // retry timing reproducible in tests and diagnostics.
    const jitterWindow = Math.max(1, Math.floor(baseDelay / 4));
    const jitterSeed = Number.parseInt(createHash("sha1")
      .update(`${task.id}:${attempt}`)
      .digest("hex")
      .slice(0, 8), 16);
    const delay = Math.min(TASK_RETRY_MAX_MS, baseDelay + (jitterSeed % jitterWindow));
    const now = Date.now();
    const em = this.orm.em.fork();
    const updated = await em.nativeUpdate(ViewActionTriggerTask, {
      id: task.id,
      status: "running",
      leaseOwner: this.schedulerId,
      leaseVersion: task.leaseVersion,
      leaseUntil: { $gt: now },
    }, {
      status: "queued",
      availableAt: now + delay,
      startedAt: null,
      finishedAt: null,
      leaseOwner: null,
      leaseUntil: null,
      executionPhase: null,
      errorCode: "transient_retry",
      errorMessage: this.errorMessage(error).slice(0, TASK_ERROR_LIMIT),
      updatedAt: now,
    });
    if (updated === 1 && !this.stopped) {
      const timer = setTimeout(() => this.schedulePump(), delay);
      (timer as unknown as { unref?: () => void }).unref?.();
    }
  }

  private startLeaseRenewal(task: ViewActionTriggerTask) {
    let stopped = false;
    let lost = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const renew = async () => {
      if (stopped || lost) return;
      try {
        const em = this.orm.em.fork();
        const updated = await em.nativeUpdate(ViewActionTriggerTask, {
          id: task.id,
          status: "running",
          leaseOwner: this.schedulerId,
          leaseVersion: task.leaseVersion,
          leaseUntil: { $gt: Date.now() },
        }, { leaseUntil: Date.now() + TASK_LEASE_MS, updatedAt: Date.now() });
        if (updated !== 1) {
          lost = true;
          return;
        }
      } catch (error) {
        lost = true;
        this.logger.warn(`view action trigger lease renewal failed: ${task.id}`, this.errorMessage(error));
        return;
      }
      schedule();
    };
    const schedule = () => {
      if (stopped || lost) return;
      timer = setTimeout(() => {
        timer = undefined;
        void renew();
      }, Math.max(500, Math.floor(TASK_LEASE_MS / 3)));
      (timer as unknown as { unref?: () => void }).unref?.();
    };
    schedule();
    return {
      stop: () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = undefined;
      },
      isLost: () => lost,
    };
  }

  private async restoreTaskQueueState(task: ViewActionTriggerTask) {
    const queueState = task.taskType === "data_mutation"
      ? task.mutationPayload?.queueState
      : (task.requestPayload as ViewActionTriggerTaskRequest)?.queueState;
    if (!queueState) {
      return;
    }
    await this.formDataService.restoreQueuedDataChangeFlowRows(
      task.nocodeId,
      task.tableId,
      queueState,
    );
  }

  private async getBatchAggregationRows(task: ViewActionTriggerTask): Promise<Row[]> {
    if (!task.batchId) return [];
    const chunkTasks = await this.orm.em.fork().find(ViewActionTriggerTask, { batchId: task.batchId }, {
      orderBy: { chunkSequence: "ASC", sequence: "ASC" },
      fields: ["mutationPayload"],
    });
    return chunkTasks.flatMap(chunkTask => this.getTaskRows(chunkTask.mutationPayload));
  }

  private getTaskRows(payload?: DataMutationTaskPayload): Row[] {
    if (Array.isArray(payload?.rows) && payload.rows.length) return payload.rows;
    return Array.isArray(payload?.queueState?.previousRows) ? payload.queueState.previousRows : [];
  }

  private async markUnknownBatchTasks(
    tx: EntityManager,
    task: Pick<ViewActionTriggerTask, "id" | "batchId">,
    now: number,
  ) {
    if (!task.batchId) return;
    const dependentCount = await tx.nativeUpdate(ViewActionTriggerTask, {
      batchId: task.batchId,
      dependsOnTaskId: task.id,
      status: "queued",
    }, {
      status: "unknown",
      errorCode: "dependency_unknown",
      errorMessage: "A prerequisite batch chunk has an unconfirmed result",
      updatedAt: now,
      finishedAt: now,
    });
    const batch = await tx.findOne(ViewActionTriggerBatch, { id: task.batchId });
    if (!batch) return;
    batch.unknownChunks += 1 + dependentCount;
    batch.batchStatus = "unknown";
    batch.updatedAt = now;
    tx.persist(batch);
  }

  private async finish(
    source: ViewActionTriggerTask,
    status: Exclude<ViewActionTriggerTaskStatus, "preparing" | "queued" | "running">,
    errorCode?: string,
    errorMessage?: string,
    result?: unknown,
    leaseOwner = this.schedulerId,
  ): Promise<boolean> {
    const em = this.orm.em.fork();
    return await em.transactional(async tx => {
      const now = Date.now();
      // Fence the terminal write itself.  A read followed by entity flush is
      // insufficient: the lease may expire between those two operations and
      // an old worker could otherwise overwrite a newer worker's state.
      const updated = await tx.nativeUpdate(ViewActionTriggerTask, {
        id: source.id,
        status: "running",
        leaseOwner,
        leaseVersion: source.leaseVersion,
        leaseUntil: { $gt: now },
      }, {
        status,
        errorCode: errorCode ?? null,
        errorMessage: errorMessage ? errorMessage.slice(0, TASK_ERROR_LIMIT) : null,
        resultPayload: result ?? null,
        updatedAt: now,
        finishedAt: now,
        leaseOwner: null,
        leaseUntil: null,
        executionPhase: null,
      });
      if (updated !== 1) {
        return false;
      }
      const task = await tx.findOne(ViewActionTriggerTask, { id: source.id });
      if (!task) return false;
      const unknownDependents = status === "unknown" && task.batchId
        ? await tx.nativeUpdate(ViewActionTriggerTask, {
          batchId: task.batchId,
          dependsOnTaskId: task.id,
          status: "queued",
        }, {
          status: "unknown",
          errorCode: "dependency_unknown",
          errorMessage: "A prerequisite batch chunk has an unconfirmed result",
          updatedAt: now,
          finishedAt: now,
        })
        : 0;
      if (task.batchId) {
        const batch = await tx.findOne(ViewActionTriggerBatch, { id: task.batchId });
        if (batch) {
          batch.batchStatus = "running";
          if (status === "completed") {
            batch.completedChunks += 1;
          } else if (status === "unknown") {
            batch.unknownChunks += 1 + unknownDependents;
            batch.batchStatus = "unknown";
          } else {
            batch.failedChunks += 1;
          }
          const settledChunks = batch.completedChunks + batch.failedChunks;
          if (batch.unknownChunks > 0) {
            batch.batchStatus = "unknown";
          } else if (settledChunks >= batch.totalChunks && batch.totalChunks > 0) {
            batch.batchStatus = batch.failedChunks > 0 ? "failed" : "completed";
          }
          batch.updatedAt = now;
          tx.persist(batch);
        }
      }
      // `unknown` means an external or database side effect may already have
      // happened. Keep the active-record fence until an operator/reconciler
      // confirms the outcome; releasing it here could allow a duplicate flow.
      if (status !== "unknown") {
        const activeRecord = await tx.findOne(ViewActionTriggerActiveRecord, { taskId: task.id });
        if (activeRecord) {
          tx.remove(activeRecord);
        }
      }
      await tx.flush();
      return true;
    });
  }

  private async executeDataMutation(task: ViewActionTriggerTask, runtimeAccount: Account) {
    const payload = task.mutationPayload;
    if (!payload) {
      throw new Error("Persistent data mutation payload is missing");
    }
    const flowWorkerContext = task.leaseOwner && task.leaseVersion
      ? {
        taskId: task.id,
        leaseOwner: task.leaseOwner,
        leaseVersion: task.leaseVersion,
        queueClass: task.queueClass === "p0" ? "p0" as const : "p1" as const,
      }
      : undefined;
    const formData = payload.formData;

    if (payload.pagedDeleteAll && payload.action === "delete_all") {
      let cursor = String(payload.deleteAllCursor || "");
      let successCount = 0;
      let failedCount = 0;
      for (;;) {
        const page = await this.formDataService.tryDeleteAllDataPage(
          formData,
          payload.nocodeId,
          payload.tableUID,
          {
            triggerTodo: true,
            source: DataChangeType.DELETE,
            deferPostMutation: true,
            runtimeAccount,
            flowWorkerContext,
          },
          cursor,
          100,
        );
        if (page.success === false) {
          throw new Error(String(page.errorMessage || page.message || "Delete-all page failed"));
        }
        successCount += Number(page.successCount || page.scannedCount || 0);
        failedCount += Number(page.failedCount || 0);
        const pageRows = Array.isArray(page.delegatedRows) ? page.delegatedRows : [];
        if (pageRows.length) {
          await this.formDataService.runPostMutationTasks(
            payload.nocodeId,
            payload.tableUID,
            pageRows,
            DataChangeType.DELETE,
            {
              triggerTodo: true,
              source: DataChangeType.DELETE,
              runtimeAccount,
              beforeMutationRows: page.queueState?.previousRows || pageRows,
              conditionWorkerQueue: task.queueClass === "p1" ? "p1" : "p0",
              flowWorkerContext,
            },
            true,
            page.queueState || null,
          );
        }
        if (!page.scannedCount) break;
        const nextCursor = String(page.nextCursor || cursor);
        if (nextCursor === cursor) throw new Error("Delete-all cursor did not advance");
        cursor = nextCursor;
      }
      return { success: true, data: [], successCount, failedCount };
    }

    if (payload.postMutationOnly) {
      if (payload.postMutationKind === "import") {
        let skipNodeIds: string[] | undefined;
        try {
          if (payload.action === "add" && payload.runBatchAggregation !== false
            && await this.formDataService.supportsImportBatchAggregation(payload.nocodeId, payload.tableUID)) {
            const aggregationRows = await this.getBatchAggregationRows(task);
            const batchResult = await this.formDataService.runImportBatchAggregation(
              payload.nocodeId,
              payload.tableUID,
              aggregationRows.length ? aggregationRows : payload.rows || [],
            );
            if (batchResult.handled) skipNodeIds = batchResult.skipNodeIds;
          }
        } catch (error) {
          this.logger.warn(`import batch aggregation failed, fallback to row flow: ${this.errorMessage(error)}`);
        }
        const importRows = this.getTaskRows(payload);
        const source = payload.action === "update" ? DataChangeType.EDIT : DataChangeType.ADD;
        return await this.formDataService.runPostMutationTasks(
          payload.nocodeId,
          payload.tableUID,
          importRows,
          source,
          {
            triggerTodo: true,
            source,
            importTaskId: payload.importTaskId,
            skipNodeIds,
            runtimeAccount,
            beforeMutationRows: payload.beforeMutationRows || importRows,
            flowWorkerContext,
          },
          true,
          payload.queueState,
        );
      }
      // QUEUED 仅表示任务仍在等待；正式执行时恢复原状态，继续复用既有 CRUD 权限判断。
      if (payload.queueState) {
        await this.formDataService.restoreQueuedDataChangeFlowRows(
          payload.nocodeId,
          payload.tableUID,
          payload.queueState,
        );
      }
      const source = payload.action === "add"
        ? DataChangeType.ADD
        : payload.action === "update"
          ? DataChangeType.EDIT
          : DataChangeType.DELETE;
      const taskRows = this.getTaskRows(payload);
      const triggerOptions = {
        triggerTodo: true,
        triggerContext: payload.triggerContext,
        causedByTodoId: payload.causedByTodoId,
        causedByTaskId: payload.causedByTaskId || task.id,
        beforeMutationRows: payload.beforeMutationRows || (source === DataChangeType.DELETE ? taskRows : []),
        conditionWorkerQueue: payload.conditionWorkerQueue || (task.queueClass === "p1" ? "p1" as const : "p0" as const),
        flowWorkerContext,
      };
      if (payload.finalizeDeleteWithoutFlow && source === DataChangeType.DELETE) {
        let triggered = false;
        let triggeredTodoId: string | undefined;
        for (const [index, row] of taskRows.entries()) {
          const currentResult = await this.formDataService.runPostMutationTasks(
            payload.nocodeId,
            payload.tableUID,
            [row],
            source,
            {
              ...triggerOptions,
              beforeMutationRows: payload.beforeMutationRows?.[index]
                ? [payload.beforeMutationRows[index]]
                : [row],
            },
            true,
            null,
          );
          if (currentResult.triggered) {
            triggered = true;
            triggeredTodoId ||= currentResult.triggeredTodoId;
          }
          else await this.formDataService.finalizeDerivedDeleteRows(payload.nocodeId, payload.tableUID, [row]);
        }
        return { triggered, triggeredTodoId };
      }
      return await this.formDataService.runPostMutationTasks(
        payload.nocodeId,
        payload.tableUID,
        taskRows,
        source,
        triggerOptions,
        true,
        payload.queueState,
      );
    }
    if (!formData) {
      throw new Error("Persistent data mutation form data is missing");
    }

    let result: MutationTaskResult;
    if (payload.action === "add") {
      result = await this.formDataService.addData(
        formData,
        payload.nocodeId,
        payload.tableUID,
        payload.rows || [],
        {
          triggerTodo: payload.triggerTodo,
          deferPostMutation: true,
          stashFlow: payload.stashFlow,
        },
      );
    } else if (payload.action === "update") {
      result = await this.formDataService.tryUpdateData(
        formData,
        payload.nocodeId,
        payload.tableUID,
        payload.rows || [],
        payload.keys || [],
        null,
        {
          triggerTodo: payload.triggerTodo,
          deferPostMutation: true,
          stashFlow: payload.stashFlow,
        },
        {},
        payload.updateFieldIds,
        payload.viewActionContext,
      );
    } else {
      const deleteOptions = {
        triggerTodo: payload.triggerTodo,
        deferPostMutation: true,
        ...(payload.action === "delete_all" ? {} : { queueState: payload.queueState }),
      };
      result = payload.action === "delete_all"
        ? await this.formDataService.tryDeleteAllData(formData, payload.nocodeId, payload.tableUID, deleteOptions)
        : await this.formDataService.tryDeleteData(
          formData,
          payload.nocodeId,
          payload.tableUID,
          payload.rows || [],
          payload.keys || [],
          deleteOptions,
        );
    }

    if (result?.success === false) {
      throw new Error(String(result.errorMessage || result.message || "Data mutation failed"));
    }

    let queueState = result.queueState !== undefined ? result.queueState : payload.queueState;
    const resultRows = payload.action === "delete" || payload.action === "delete_all"
      ? (result?.delegatedRows || [])
      : (result?.data || this.getTaskRows(payload));
    if (payload.triggerTodo && resultRows.length) {
      if (queueState === null) {
        queueState = await this.formDataService.prepareDataChangeFlowQueue(
          payload.nocodeId,
          payload.tableUID,
          resultRows,
          payload.action === "update" ? DataChangeType.EDIT : payload.action === "add" ? DataChangeType.ADD : DataChangeType.DELETE,
        );
      }
      await this.formDataService.runPostMutationTasks(
        payload.nocodeId,
        payload.tableUID,
        resultRows,
        payload.action === "update" ? DataChangeType.EDIT : payload.action === "add" ? DataChangeType.ADD : DataChangeType.DELETE,
        {
          triggerTodo: payload.triggerTodo,
          beforeMutationRows: queueState?.previousRows || [],
          conditionWorkerQueue: payload.conditionWorkerQueue || (task.queueClass === "p1" ? "p1" : "p0"),
          flowWorkerContext,
        },
        true,
        queueState,
      );
    }
    return result;
  }

  private captureRequestContext(req?: Request) {
    const clientSign = this.limitContextValue(
      (req as Request & { clientSign?: string })?.clientSign
        || this.getHeaderValue(req?.headers?.["x-sign"])
        || (typeof req?.body?.sign === "string" ? req.body.sign : undefined),
    );
    return this.sanitizeRequestContext({
      // Persist only allow-listed transport metadata. The account is always
      // reloaded by ID and is deliberately not copied from the request.
      headers: req?.headers,
      ip: req?.ip || req?.socket?.remoteAddress,
      clientSign,
    });
  }

  private getHeaderValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0];
    return value;
  }

  private limitContextValue(value: unknown) {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized.slice(0, REQUEST_CONTEXT_VALUE_LIMIT) : undefined;
  }

  private sanitizeRequestContext(context?: PersistentTaskRequestContext): PersistentTaskRequestContext {
    const headers = Object.entries(context?.headers || {}).reduce<Record<string, string | undefined>>((result, [name, value]) => {
      const normalizedName = name.toLowerCase();
      if (!SAFE_REQUEST_HEADERS.has(normalizedName)) return result;
      const normalizedValue = this.limitContextValue(this.getHeaderValue(value));
      if (normalizedValue !== undefined) result[normalizedName] = normalizedValue;
      return result;
    }, {});
    const clientSign = this.limitContextValue(
      context?.clientSign || this.getHeaderValue(headers["x-sign"]),
    );
    return {
      headers,
      ip: this.limitContextValue(context?.ip),
      ...(clientSign ? { clientSign } : {}),
    };
  }

  private toTaskSnapshot(task: ViewActionTriggerTask) {
    return {
      ...this.getTaskTiming(task),
      taskId: task.id,
      status: task.status,
      queueClass: task.queueClass,
      batchId: task.batchId,
      executionPhase: task.executionPhase,
      attemptCount: task.attemptCount,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      error: task.errorMessage,
      result: task.resultPayload,
    };
  }

  private getTaskTiming(task: Pick<ViewActionTriggerTask, "status" | "createdAt" | "startedAt" | "finishedAt">) {
    const now = Date.now();
    return {
      queueWaitMs: task.startedAt
        ? Math.max(0, task.startedAt - task.createdAt)
        : task.status === "queued"
          ? Math.max(0, now - task.createdAt)
          : undefined,
      executionMs: task.startedAt
        ? Math.max(0, (task.finishedAt || now) - task.startedAt)
        : undefined,
    };
  }

  private digest(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private canonicalDigest(value: unknown): string {
    const normalize = (current: unknown): unknown => {
      if (Array.isArray(current)) return current.map(normalize);
      if (!current || typeof current !== "object" || Object.getPrototypeOf(current) !== Object.prototype) {
        return current;
      }
      return Object.keys(current as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = normalize((current as Record<string, unknown>)[key]);
          return result;
        }, {});
    };
    return this.digest(normalize(value));
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message || error.name;
    }
    return String(error || "Unknown error");
  }
}
