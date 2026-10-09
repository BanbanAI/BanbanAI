import { Injectable, Logger } from "@nestjs/common";
import { MikroORM } from "@mikro-orm/core";
import Piscina from "piscina";
import { join } from "path";
import { randomUUID } from "crypto";
import { MessageChannel, MessagePort } from "node:worker_threads";
import type { ConditionBranchConditionGroup, Field, ProcessFlow, Row, TableUID } from "@common/types/project";
import { ViewActionTriggerTask } from "./entities/view-action-trigger-task";
import type { BuildFlowKernelPlanInput, BuildFlowNodeExecutionPlanInput, FlowKernelPlan, FlowNodeExecutionPlan, FlowNodeExecutionStep } from "./flow-execution-kernel";

export type FlowWorkerTaskRef = {
  taskId: string;
  queueClass: "p0" | "p1" | "p2";
  leaseOwner: string;
  leaseVersion: number;
  leaseUntil: number;
  attempt: number;
};

export type FlowWorkerValidationResult = {
  taskId: string;
  leaseOwner: string;
  leaseVersion: number;
  accepted: boolean;
  status?: string;
  requestId?: string;
  sequence?: number;
};

export type FlowWorkerExecutionPlan = FlowWorkerValidationResult & {
  stepKey: string;
  taskType: "data_mutation" | "view_action_trigger";
  rowCount: number;
  idempotencyKey: string;
  recordConcurrency: number;
};

type FlowWorkerTaskSnapshot = {
  status: string;
  leaseOwner?: string;
  leaseVersion?: number;
  leaseUntil?: number;
};

export type FlowWorkerRuntimeProbeResult = {
  threadId: number;
  runtimeId: string;
  dbType: string;
};

export type FlowWorkerFormulaResult = {
  handled: boolean;
  value?: unknown;
};

export type FlowWorkerFormulaInput = {
  formula: string;
  sourceRows: Row[];
  sourceTableUID: TableUID;
  currentRow: Row;
  sourceFields: Field[];
};

export type FlowWorkerPoolDrainResult = {
  drained: boolean;
  inFlight: number;
};

export type FlowWorkerConditionInput = {
  row: Row;
  conditions: ConditionBranchConditionGroup[];
  sourceTableRows: Record<TableUID, Row[]>;
  fields: Field[];
};

export type FlowWorkerConditionResult = {
  valid: boolean;
  errorMsg?: string;
};

/** Plain trigger snapshots; workers never receive ORM entities or services. */
export type FlowWorkerTriggerPlanBranch = {
  branchUid: string;
  triggerNodeUid: string;
  changeTypes: string[];
  conditions: ConditionBranchConditionGroup[];
  sourceTableRows: Record<TableUID, Row[]>;
};

export type FlowWorkerTriggerPlanCandidate = {
  uuid: string;
  row?: Row;
  branches: FlowWorkerTriggerPlanBranch[];
};

export type FlowWorkerTriggerPlanInput = {
  source: string;
  tableUID: TableUID;
  fields: Field[];
  flows: ProcessFlow[];
  candidates: FlowWorkerTriggerPlanCandidate[];
  queueClass?: "p0" | "p1";
};

export type FlowWorkerTriggerPlanItem = {
  uuid: string;
  matched: boolean;
  branchUid?: string;
  triggerNodeUid?: string;
  nextNodeUid?: string;
};

export type FlowWorkerTriggerExecutionCandidate = {
  uuid: string;
  entryId: string;
  /**
   * Optional for direct callers. The production scheduler intentionally sends
   * only UUID/branch metadata; mutation snapshots remain in the main thread.
   */
  triggerRowSnapshot?: Row;
  beforeMutationRows?: Row[];
};

export type FlowWorkerTriggerExecutionResult = {
  uuid: string;
  todoId?: string;
  error?: string;
};

export type FlowWorkerNodeExecutionResult = {
  requestId: string;
  sequence: number;
  handled: boolean;
  plan: FlowNodeExecutionPlan;
};

export type FlowWorkerNodeGatewayResult = {
  stop: boolean;
  nextNodeIds: string[];
};

export class FlowWorkerPayloadError extends TypeError {
  readonly code = "FLOW_PAYLOAD_NOT_SERIALIZABLE";

  constructor(label: string, cause?: unknown) {
    super(`Flow worker payload is not serializable: ${label}`, { cause });
    this.name = "FlowWorkerPayloadError";
  }
}

export class FlowWorkerTimeoutError extends Error {
  readonly code = "FLOW_WORKER_TIMEOUT";
  readonly retryable = true;
  readonly idempotent = true;

  constructor(label: string, timeoutMs: number) {
    super(`Flow worker ${label} timed out after ${timeoutMs}ms`);
    this.name = "FlowWorkerTimeoutError";
  }
}

export class FlowGatewayActiveTimeoutError extends Error {
  readonly code = "FLOW_GATEWAY_ACTIVE_TIMEOUT";
  readonly retryable = false;
  readonly idempotent = false;

  constructor(label: string, timeoutMs: number) {
    super(`Flow worker ${label} Gateway remained active for more than ${timeoutMs}ms`);
    this.name = "FlowGatewayActiveTimeoutError";
  }
}

export class FlowGatewayUnavailableError extends Error {
  readonly retryable = true;
  readonly idempotent = true;

  constructor(readonly code: "FLOW_GATEWAY_CIRCUIT_OPEN" | "FLOW_GATEWAY_CAPACITY_EXCEEDED") {
    super(code);
    this.name = "FlowGatewayUnavailableError";
  }
}

const getPositiveInt = (name: string, fallback: number, max = 16) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
};

const WORKER_RPC_TIMEOUT_MS = getPositiveInt(
  "FLOW_EXECUTION_WORKER_RPC_TIMEOUT_MS",
  60_000,
  120_000,
);

const P0_PREPARE_TIMEOUT_MS = getPositiveInt(
  "FLOW_EXECUTION_P0_PREPARE_TIMEOUT_MS",
  750,
  10_000,
);

const GATEWAY_MAX_ACTIVE_MS = getPositiveInt(
  "FLOW_EXECUTION_GATEWAY_MAX_ACTIVE_MS",
  120_000,
  30 * 60_000,
);

const GATEWAY_MAX_IN_FLIGHT = getPositiveInt(
  "FLOW_EXECUTION_GATEWAY_MAX_IN_FLIGHT",
  8,
  256,
);

const GATEWAY_P0_RESERVED_SLOTS = Math.min(
  GATEWAY_MAX_IN_FLIGHT,
  getPositiveInt("FLOW_EXECUTION_P0_RESERVED_SLOTS", 1, 256),
);

// Capacity pressure is transient: another Gateway call may be settling while
// a worker is ready to send the next node command. Wait in bounded slices so
// the worker does not turn ordinary backpressure into an unconfirmed step.
const GATEWAY_ADMISSION_WAIT_MS = getPositiveInt(
  "FLOW_EXECUTION_GATEWAY_ADMISSION_WAIT_MS",
  30_000,
  120_000,
);

// Keep an idle worker alive during a long P1 batch. Piscina treats zero as
// an immediate idle-reap timeout; repeatedly reaping/creating the second
// worker adds lifecycle churn and can race with a task being handed back to
// the pool while the main-process Gateway is still settling.
const WORKER_IDLE_TIMEOUT_MS = getPositiveInt(
  "FLOW_EXECUTION_WORKER_IDLE_TIMEOUT_MS",
  60_000,
  30 * 60_000,
);

const assertCloneable = (value: unknown, label: string) => {
  try {
    structuredClone(value);
  } catch (error) {
    throw new FlowWorkerPayloadError(label, error);
  }
};

const assertTaskRef = (task: FlowWorkerTaskRef) => {
  if (!task || typeof task !== "object") throw new FlowWorkerPayloadError("task-ref");
  if (typeof task.taskId !== "string" || !task.taskId) throw new FlowWorkerPayloadError("task-ref.taskId");
  if (!(["p0", "p1", "p2"] as const).includes(task.queueClass)) {
    throw new FlowWorkerPayloadError("task-ref.queueClass");
  }
  if (typeof task.leaseOwner !== "string" || !task.leaseOwner) {
    throw new FlowWorkerPayloadError("task-ref.leaseOwner");
  }
  if (!Number.isInteger(task.leaseVersion) || task.leaseVersion < 1) {
    throw new FlowWorkerPayloadError("task-ref.leaseVersion");
  }
  if (!Number.isFinite(task.leaseUntil) || task.leaseUntil <= 0) {
    throw new FlowWorkerPayloadError("task-ref.leaseUntil");
  }
  if (!Number.isInteger(task.attempt) || task.attempt < 1) {
    throw new FlowWorkerPayloadError("task-ref.attempt");
  }
  assertCloneable(task, "task-ref");
};

/**
 * Deadline for a call that may sit in Piscina's queue before a worker picks it
 * up. A call that was not dispatched immediately is waiting for a busy worker
 * and is bounded by `queueWaitMs` instead of its own timeout; once the worker
 * reports `startedAt()`, the call's own budget applies again.
 */
type FlowWorkerQueueAwareBudget = {
  startedAt: () => number;
  queueWaitMs: number;
};

@Injectable()
export class FlowWorkerPool {
  private readonly logger = new Logger(FlowWorkerPool.name);
  private readonly pools = new Map<"p0" | "p1", Piscina>();
  private readonly inFlight = new Set<Promise<unknown>>();
  private readonly activeGatewayPromises = new Set<Promise<unknown>>();
  private readonly activeGatewayByQueue: Record<"p0" | "p1", number> = { p0: 0, p1: 0 };
  private gatewayCircuitOpen = false;
  private stopped = false;
  private shutdownPromise?: Promise<void>;
  private rpcSequence = 0;

  constructor(private readonly orm: MikroORM) {}

  /**
   * Whether the optional protocol-only Gateway probe can read this ORM
   * dialect. Worker creation itself never depends on this value because
   * workers do not open database connections.
   */
  isDatabaseSupported() {
    const type = this.orm.config.get("type");
    return type === "sqlite"
      || type === "better-sqlite"
      || type === "mysql"
      || type === "mariadb";
  }

  private getPool(queueClass: "p0" | "p1", requireDatabase = true) {
    if (this.stopped) throw new Error("Flow worker pool is stopped");
    if (requireDatabase && !this.isDatabaseSupported()) {
      throw new Error(`Flow worker database type is unsupported: ${this.orm.config.get("type")}`);
    }
    const existing = this.pools.get(queueClass);
    if (existing) return existing;
    const filename = join(__dirname, "flow-worker.js");
    const maxThreads = this.getMaxThreads(queueClass);
    const pool = new Piscina({
      filename,
      minThreads: 1,
      maxThreads,
      // Keep a finite backlog for node RPCs. Four P1 workers can submit up to
      // four bounded record calls each; this prevents Piscina's queue guard
      // from turning normal fan-out into an unconfirmed task result.
      maxQueue: maxThreads * 8,
      concurrentTasksPerWorker: 1,
      idleTimeout: WORKER_IDLE_TIMEOUT_MS,
      // Workers are intentionally database-free. All durable reads/writes
      // stay behind the main-process ORM Gateway.
    });
    // Piscina emits this for worker bootstrap/runtime failures. Keep the
    // original error and queue class in the main-process log so an in-flight
    // task can be distinguished from an intentional shutdown/reap.
    (pool as unknown as {
      on(event: "error", listener: (error: unknown) => void): void;
    }).on("error", error => {
      this.logger.error(`[flow-worker-pool-error] ${JSON.stringify({
        queueClass,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })}`);
    });
    this.pools.set(queueClass, pool);
    return pool;
  }

  private getMaxThreads(queueClass: "p0" | "p1") {
    const fallbackThreads = queueClass === "p0" ? 1 : getPositiveInt("FLOW_EXECUTION_WORKER_MAX_THREADS", 2);
    return getPositiveInt(
      queueClass === "p0" ? "FLOW_EXECUTION_P0_WORKER_THREADS" : "FLOW_EXECUTION_P1_MAX_THREADS",
      fallbackThreads,
    );
  }

  /**
   * Return the bounded fan-out that callers may submit without exceeding the
   * pool's in-memory queue. This is deliberately the worker count, not the
   * durable queue size: callers must still batch their own inputs.
   */
  getMaxConcurrency(queueClass: "p0" | "p1") {
    return this.getMaxThreads(queueClass);
  }

  async warmup() {
    const runtimes = new Map<"p0" | "p1", string[]>();
    await Promise.all((["p0", "p1"] as const).map(async queueClass => {
      const targetThreads = this.getMaxThreads(queueClass);
      const results = await Promise.all(Array.from({ length: targetThreads }, async (_, index) => (
        await this.runWithTimeout<{ threadId: number; runtimeId: string }>(
          this.getPool(queueClass, false),
          { kind: "runtime-probe", delayMs: 50 },
          `${queueClass}-warmup-${index + 1}`,
        )
      )));
      runtimes.set(queueClass, results.map(result => `${result.threadId}:${result.runtimeId}`));
    }));
    this.logger.log(`[flow-worker-warmup] ${JSON.stringify(Object.fromEntries(runtimes))}`);
  }

  private async runWithTimeout<T>(
    pool: Piscina,
    task: unknown,
    label: string,
    transferList?: MessagePort[],
    timeoutMs = WORKER_RPC_TIMEOUT_MS,
    queueAwareBudget?: FlowWorkerQueueAwareBudget,
  ): Promise<T> {
    if (this.stopped) throw new Error("Flow worker pool is stopped");
    const controller = new AbortController();
    const runPromise = pool.run(task, { signal: controller.signal, ...(transferList ? { transferList } : {}) }) as Promise<T>;
    this.inFlight.add(runPromise);
    void runPromise.then(
      () => this.inFlight.delete(runPromise),
      () => this.inFlight.delete(runPromise),
    );
    const submittedAt = Date.now();
    // Piscina keeps a task in its queue when every worker is already holding an
    // abortable task. That wait is not preparation work, so it gets the wider
    // budget; a call that was dispatched immediately keeps the short timeout so
    // a wedged worker still fails fast.
    const queuedAtSubmit = Boolean(queueAwareBudget)
      && Number((pool as unknown as { queueSize?: number }).queueSize ?? 0) > 0;
    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const workerStartedAt = () => queueAwareBudget?.startedAt() || 0;
      const waitingInQueue = () => Boolean(queueAwareBudget) && queuedAtSubmit && !workerStartedAt();
      const deadlineAt = () => {
        const startedAt = workerStartedAt();
        if (startedAt) return startedAt + timeoutMs;
        return submittedAt + (waitingInQueue() ? (queueAwareBudget as FlowWorkerQueueAwareBudget).queueWaitMs : timeoutMs);
      };
      const arm = () => {
        if (settled) return;
        const remaining = deadlineAt() - Date.now();
        if (remaining <= 0) {
          settled = true;
          controller.abort();
          reject(new FlowWorkerTimeoutError(
            label,
            waitingInQueue() ? (queueAwareBudget as FlowWorkerQueueAwareBudget).queueWaitMs : timeoutMs,
          ));
          return;
        }
        // A queued call can be picked up at any moment, which switches the
        // deadline back to its own budget; re-check in bounded slices until then.
        const slice = waitingInQueue() ? Math.min(remaining, 100) : remaining;
        timer = setTimeout(arm, slice);
        (timer as unknown as { unref?: () => void }).unref?.();
      };
      arm();
      runPromise.then(
        value => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(value);
        },
        error => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  /**
   * A Gateway command may already be performing an irreversible operation
   * when the worker times out or exits. Keep the RPC channel alive until that
   * command settles; only side-effect-free worker time may be aborted.
   */
  private async runWithGatewayProtection<T>(
    pool: Piscina,
    task: unknown,
    label: string,
    transferList: MessagePort[],
    isGatewayActive: () => boolean,
    getLastActivityAt: () => number,
  ): Promise<T> {
    if (this.stopped) throw new Error("Flow worker pool is stopped");
    const controller = new AbortController();
    const runPromise = pool.run(task, { signal: controller.signal, transferList }) as Promise<T>;
    this.inFlight.add(runPromise);
    void runPromise.then(
      () => this.inFlight.delete(runPromise),
      () => this.inFlight.delete(runPromise),
    );
    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      let pendingWorkerError: unknown;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        callback();
      };
      const check = () => {
        if (settled) return;
        if (isGatewayActive()) {
          if (Date.now() - getLastActivityAt() >= GATEWAY_MAX_ACTIVE_MS) {
            this.gatewayCircuitOpen = true;
            this.logger.warn(`[flow-worker-abort] ${JSON.stringify({
              label,
              reason: "gateway-active-timeout",
              activeGateway: isGatewayActive(),
              elapsedMs: Date.now() - getLastActivityAt(),
            })}`);
            controller.abort();
            finish(() => reject(new FlowGatewayActiveTimeoutError(label, GATEWAY_MAX_ACTIVE_MS)));
            return;
          }
          timer = setTimeout(check, Math.min(1_000, WORKER_RPC_TIMEOUT_MS));
          (timer as unknown as { unref?: () => void }).unref?.();
          return;
        }
        if (pendingWorkerError !== undefined) {
          finish(() => reject(pendingWorkerError));
          return;
        }
        const remaining = WORKER_RPC_TIMEOUT_MS - (Date.now() - getLastActivityAt());
        if (remaining > 0) {
          timer = setTimeout(check, remaining);
          (timer as unknown as { unref?: () => void }).unref?.();
          return;
        }
        this.logger.warn(`[flow-worker-abort] ${JSON.stringify({
          label,
          reason: "gateway-inactivity-timeout",
          activeGateway: isGatewayActive(),
          elapsedMs: Date.now() - getLastActivityAt(),
        })}`);
        controller.abort();
        finish(() => reject(new FlowWorkerTimeoutError(label, WORKER_RPC_TIMEOUT_MS)));
      };
      timer = setTimeout(check, WORKER_RPC_TIMEOUT_MS);
      (timer as unknown as { unref?: () => void }).unref?.();
      runPromise.then(
        value => finish(() => resolve(value)),
        error => {
          if (!isGatewayActive()) {
            finish(() => reject(error));
            return;
          }
          pendingWorkerError = error;
        },
      );
    });
  }

  private assertGatewayAvailable(queueClass: "p0" | "p1") {
    if (this.gatewayCircuitOpen) {
      throw new FlowGatewayUnavailableError("FLOW_GATEWAY_CIRCUIT_OPEN");
    }
    const totalActive = this.activeGatewayPromises.size;
    const p1Capacity = Math.max(0, GATEWAY_MAX_IN_FLIGHT - GATEWAY_P0_RESERVED_SLOTS);
    if (totalActive >= GATEWAY_MAX_IN_FLIGHT
      || (queueClass === "p1" && this.activeGatewayByQueue.p1 >= p1Capacity)) {
      throw new FlowGatewayUnavailableError("FLOW_GATEWAY_CAPACITY_EXCEEDED");
    }
  }

  private async waitForGatewayAvailable(queueClass: "p0" | "p1") {
    const deadline = Date.now() + GATEWAY_ADMISSION_WAIT_MS;
    let delay = 10;
    for (;;) {
      try {
        this.assertGatewayAvailable(queueClass);
        return;
      } catch (error) {
        if (!(error instanceof FlowGatewayUnavailableError) || Date.now() >= deadline || this.stopped) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, Math.max(1, deadline - Date.now()))));
        delay = Math.min(250, delay * 2);
      }
    }
  }

  canAcceptGatewayWork(queueClass: "p0" | "p1" = "p1") {
    if (this.stopped || this.gatewayCircuitOpen) return false;
    if (this.activeGatewayPromises.size >= GATEWAY_MAX_IN_FLIGHT) return false;
    return queueClass === "p0"
      || this.activeGatewayByQueue.p1 < Math.max(0, GATEWAY_MAX_IN_FLIGHT - GATEWAY_P0_RESERVED_SLOTS);
  }

  private trackGatewayCall<T>(promise: Promise<T>, queueClass: "p0" | "p1"): Promise<T> {
    this.activeGatewayPromises.add(promise);
    this.activeGatewayByQueue[queueClass] += 1;
    const release = () => {
      this.activeGatewayPromises.delete(promise);
      this.activeGatewayByQueue[queueClass] = Math.max(0, this.activeGatewayByQueue[queueClass] - 1);
      if (this.activeGatewayPromises.size === 0) this.gatewayCircuitOpen = false;
    };
    void promise.then(
      release,
      release,
    );
    return promise;
  }

  /**
   * Stop accepting new worker calls while allowing already submitted calls to
   * settle. The durable task state remains owned by the scheduler.
   */
  stopAccepting() {
    this.stopped = true;
  }

  async drain(timeoutMs: number): Promise<FlowWorkerPoolDrainResult> {
    const pending = [...new Set([...this.inFlight, ...this.activeGatewayPromises])];
    if (!pending.length) return { drained: true, inFlight: 0 };
    const budget = Math.max(0, Number(timeoutMs) || 0);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = await Promise.race([
      Promise.allSettled(pending).then(() => false),
      new Promise<boolean>(resolve => {
        timer = setTimeout(() => resolve(true), budget);
      }),
    ]);
    if (timer) clearTimeout(timer);
    const remaining = new Set([...this.inFlight, ...this.activeGatewayPromises]).size;
    return { drained: !timedOut && remaining === 0, inFlight: remaining };
  }

  async loadTaskRef(task: FlowWorkerTaskRef): Promise<FlowWorkerValidationResult> {
    assertTaskRef(task);
    if (task.queueClass === "p2") {
      throw new Error("P2 flow tasks use ScheduledRunWorkerPool and cannot run in FlowWorkerPool");
    }
    const queueClass = task.queueClass;
    const requestId = randomUUID();
    const sequence = ++this.rpcSequence;
    const channel = new MessageChannel();
    const gatewayPort = channel.port1;
    const workerPort = channel.port2;
    let closed = false;
    const gatewayHandler = (message: { requestId?: string; sequence?: number; command?: string; payload?: { taskId?: string } }) => {
      if (closed) return;
      if (message.requestId !== requestId
        || message.sequence !== sequence
        || message.command !== "loadTaskSnapshot"
        || message.payload?.taskId !== task.taskId) {
        gatewayPort.postMessage({ requestId: message.requestId, sequence: message.sequence, error: "FLOW_GATEWAY_COMMAND_REJECTED" });
        return;
      }
      void this.waitForGatewayAvailable(queueClass).then(() => {
        if (closed) return;
        const gatewayPromise = this.loadTaskSnapshot(task.taskId).then(snapshot => {
          if (!closed) gatewayPort.postMessage({ requestId, sequence, payload: snapshot });
        }, error => {
          if (!closed) gatewayPort.postMessage({ requestId, sequence, error: error instanceof Error ? error.message : String(error) });
        });
        void this.trackGatewayCall(gatewayPromise, queueClass);
      }, error => {
        if (!closed) gatewayPort.postMessage({ requestId, sequence, error: error instanceof Error ? error.message : String(error) });
      });
    };
    gatewayPort.on("message", gatewayHandler);
    let result: unknown;
    try {
      result = await this.runWithTimeout(
        // The worker is database-free. The main-process Gateway performs the
        // snapshot read, so pool admission must not depend on ORM dialect.
        this.getPool(queueClass, false),
        { kind: "load-task-ref", task, requestId, sequence, gatewayPort: workerPort },
        "load-task-ref",
        [workerPort],
      );
    } finally {
      closed = true;
      gatewayPort.removeListener("message", gatewayHandler);
      gatewayPort.close();
      // If submission failed before Piscina transferred the port, this is
      // the only owner-side cleanup. Closing a transferred port is harmless.
      workerPort.close();
    }
    const validation = result as FlowWorkerValidationResult;
    if (validation.requestId !== requestId || validation.sequence !== sequence) {
      throw new Error("Flow worker RPC response identity mismatch");
    }
    return validation;
  }

  /**
   * Execute the worker-side orchestration step for a claimed task. The worker
   * receives only scalar task metadata and asks the main-process Gateway for a
   * lease snapshot; ORM entities and business services never cross the thread
   * boundary.
   */
  async prepareFlowTask(task: FlowWorkerTaskRef, taskType: FlowWorkerExecutionPlan["taskType"], stepKey: string, rowCount: number): Promise<FlowWorkerExecutionPlan> {
    assertTaskRef(task);
    if (task.queueClass === "p2") throw new Error("P2 flow tasks use ScheduledRunWorkerPool and cannot run in FlowWorkerPool");
    const queueClass = task.queueClass;
    await this.waitForGatewayAvailable(queueClass);
    if (!stepKey || !Number.isInteger(rowCount) || rowCount < 0) throw new FlowWorkerPayloadError("flow-task-plan");
    const requestId = randomUUID();
    const sequence = ++this.rpcSequence;
    const channel = new MessageChannel();
    const gatewayPort = channel.port1;
    const workerPort = channel.port2;
    let closed = false;
    let workerStartedAt = 0;
    const gatewayHandler = (message: { requestId?: string; sequence?: number; command?: string; payload?: { taskId?: string } }) => {
      if (closed) return;
      // The first Gateway message proves the worker picked the task up. Before
      // that the call is only waiting in Piscina's queue, which must not count
      // against the P0 preparation budget.
      if (!workerStartedAt) workerStartedAt = Date.now();
      if (message.requestId !== requestId || message.sequence !== sequence
        || message.command !== "loadTaskSnapshot" || message.payload?.taskId !== task.taskId) {
        gatewayPort.postMessage({ requestId: message.requestId, sequence: message.sequence, error: "FLOW_GATEWAY_COMMAND_REJECTED" });
        return;
      }
      void this.waitForGatewayAvailable(queueClass).then(() => {
        if (closed) return;
        const gatewayPromise = this.loadTaskSnapshot(task.taskId).then(snapshot => {
          if (!closed) gatewayPort.postMessage({ requestId, sequence, payload: snapshot });
        }, error => {
          if (!closed) gatewayPort.postMessage({ requestId, sequence, error: error instanceof Error ? error.message : String(error) });
        });
        void this.trackGatewayCall(gatewayPromise, queueClass);
      }, error => {
        if (!closed) gatewayPort.postMessage({ requestId, sequence, error: error instanceof Error ? error.message : String(error) });
      });
    };
    gatewayPort.on("message", gatewayHandler);
    try {
      const result = await this.runWithTimeout(
        // The worker is database-free. The main-process Gateway performs the
        // snapshot read, so pool admission must not depend on ORM dialect.
        this.getPool(queueClass, false),
        { kind: "prepare-flow-task", task, taskType, stepKey, rowCount, requestId, sequence, gatewayPort: workerPort },
        "prepare-flow-task",
        [workerPort],
        queueClass === "p0" ? P0_PREPARE_TIMEOUT_MS : WORKER_RPC_TIMEOUT_MS,
        // P0 shares its single worker with flow node execution, so a
        // preparation may legitimately wait behind an older P0 flow instead of
        // spending its own 750ms budget on that queue.
        queueClass === "p0"
          ? { startedAt: () => workerStartedAt, queueWaitMs: WORKER_RPC_TIMEOUT_MS }
          : undefined,
      ) as FlowWorkerExecutionPlan;
      if (result.requestId !== requestId || result.sequence !== sequence || result.taskId !== task.taskId) {
        throw new Error("Flow worker RPC response identity mismatch");
      }
      return result;
    } finally {
      closed = true;
      gatewayPort.removeListener("message", gatewayHandler);
      gatewayPort.close();
      workerPort.close();
    }
  }

  /** Main-process Gateway read. The worker receives only this immutable lease snapshot. */
  private async loadTaskSnapshot(taskId: string): Promise<FlowWorkerTaskSnapshot> {
    const row = await this.orm.em.fork().findOne(ViewActionTriggerTask, { id: taskId }, {
      fields: ["status", "leaseOwner", "leaseVersion", "leaseUntil"],
    });
    if (!row) throw new Error(`Flow worker task not found: ${taskId}`);
    return {
      status: String(row.status),
      ...(row.leaseOwner === undefined ? {} : { leaseOwner: String(row.leaseOwner) }),
      ...(row.leaseVersion === undefined ? {} : { leaseVersion: Number(row.leaseVersion) }),
      ...(row.leaseUntil === undefined ? {} : { leaseUntil: Number(row.leaseUntil) }),
    };
  }

  async probeIsolation(delayMs = 50): Promise<[FlowWorkerRuntimeProbeResult, FlowWorkerRuntimeProbeResult]> {
    const pool = this.getPool("p1", false);
    const results = await Promise.all([
      this.runWithTimeout(pool, { kind: "runtime-probe", delayMs }, "runtime-probe"),
      this.runWithTimeout(pool, { kind: "runtime-probe", delayMs }, "runtime-probe"),
    ]);
    return results as [FlowWorkerRuntimeProbeResult, FlowWorkerRuntimeProbeResult];
  }

  async evaluateImportFormula(input: FlowWorkerFormulaInput): Promise<FlowWorkerFormulaResult> {
    assertCloneable(input, "evaluate-import-formula");
    const result = await this.runWithTimeout(
      this.getPool("p1", false),
      {
        kind: "evaluate-import-formula",
        ...input,
      },
      "evaluate-import-formula",
    );
    return result as FlowWorkerFormulaResult;
  }

  /**
   * Run a bounded batch without filling Piscina's in-memory queue. The
   * durable flow queue remains the source of truth; this helper only batches
   * already-loaded, side-effect-free formula evaluations.
   */
  async evaluateImportFormulaBatch(inputs: FlowWorkerFormulaInput[]): Promise<FlowWorkerFormulaResult[]> {
    if (!inputs.length) return [];
    for (const input of inputs) assertCloneable(input, "evaluate-import-formula");
    const pool = this.getPool("p1", false);
    const width = this.getMaxThreads("p1");
    const results: FlowWorkerFormulaResult[] = [];
    for (let offset = 0; offset < inputs.length; offset += width) {
      const chunk = inputs.slice(offset, offset + width);
      const chunkResults = await Promise.all(chunk.map(async input => {
        return await this.runWithTimeout(
          pool,
          { kind: "evaluate-import-formula", ...input },
          "evaluate-import-formula",
        ) as FlowWorkerFormulaResult;
      }));
      results.push(...chunkResults);
    }
    return results;
  }

  async evaluateTriggerConditions(input: FlowWorkerConditionInput, queueClass: "p0" | "p1" = "p1"): Promise<FlowWorkerConditionResult> {
    assertCloneable(input, "evaluate-trigger-conditions");
    const result = await this.runWithTimeout(
      this.getPool(queueClass, false),
      {
        kind: "evaluate-trigger-conditions",
        ...input,
      },
      "evaluate-trigger-conditions",
    );
    return result as FlowWorkerConditionResult;
  }

  /** Plan trigger candidates in bounded batches using immutable snapshots. */
  async planTriggerCandidates(input: FlowWorkerTriggerPlanInput): Promise<FlowWorkerTriggerPlanItem[]> {
    if (!Array.isArray(input.candidates) || !input.candidates.length) return [];
    const queueClass = input.queueClass || "p1";
    const sharedInput = {
      source: input.source,
      tableUID: input.tableUID,
      fields: input.fields,
      flows: input.flows,
      queueClass,
    };
    assertCloneable(sharedInput, "plan-trigger-candidates.shared");
    const pool = this.getPool(queueClass, false);
    const width = this.getMaxThreads(queueClass);
    const chunkSize = 100;
    const results: FlowWorkerTriggerPlanItem[] = [];
    for (let offset = 0; offset < input.candidates.length; offset += chunkSize * width) {
      const chunks: FlowWorkerTriggerPlanCandidate[][] = [];
      for (let index = 0; index < width; index += 1) {
        const start = offset + index * chunkSize;
        if (start >= input.candidates.length) break;
        chunks.push(input.candidates.slice(start, start + chunkSize));
      }
      const chunkResults = await Promise.all(chunks.map(async candidates => {
        const workerInput = { ...sharedInput, candidates };
        // Validate only the bounded payload that is about to cross the worker
        // boundary. Cloning the complete 10k candidate input before slicing
        // doubled the largest transient allocation in the main process.
        assertCloneable(workerInput, "plan-trigger-candidates.chunk");
        const result = await this.runWithTimeout(
          pool,
          { kind: "plan-trigger-candidates", ...workerInput },
          "plan-trigger-candidates",
        ) as FlowWorkerTriggerPlanItem[];
        // A malformed or truncated worker response must fall back inline;
        // silently treating missing UUIDs as unmatched would lose triggers.
        if (!Array.isArray(result) || result.length !== candidates.length
          || result.some((item, index) => item?.uuid !== candidates[index]?.uuid
            || typeof item.matched !== "boolean"
            // A matched item without a branch identity would be interpreted
            // by the caller as "not matched", silently dropping a trigger.
            || (item.matched === true && (typeof item.branchUid !== "string" || !item.branchUid)))) {
          throw new Error("Flow worker trigger plan response is invalid");
        }
        return result;
      }));
      results.push(...chunkResults.flat());
    }
    return results;
  }

  /**
   * Build only the worker-safe prefix of addNextNode. The caller must execute
   * every step through a fenced Gateway; a plan is not a completion signal.
   */
  async planFlowKernel(input: BuildFlowKernelPlanInput, queueClass: "p0" | "p1" = "p1"): Promise<FlowKernelPlan> {
    assertCloneable(input, "flow-kernel-plan");
    if (!input.flows?.length || !input.startNodeId) {
      return { taskId: input.taskId, ...(input.todoId ? { todoId: input.todoId } : {}), steps: [], workerSafe: false, stopReason: "unknown_node" };
    }
    const result = await this.runWithTimeout(
      this.getPool(queueClass, false),
      { kind: "plan-flow-kernel", ...input },
      "plan-flow-kernel",
    ) as FlowKernelPlan;
    if (!result || result.taskId !== input.taskId || !Array.isArray(result.steps)
      || result.steps.some(step => !step?.nodeId || typeof step.idempotencyKey !== "string")) {
      throw new Error("Flow worker kernel plan response is invalid");
    }
    return result;
  }

  /**
   * Let a worker own flow progression one node at a time. The callback stays
   * in the main process because it is the only owner of ORM entities,
   * transactions and external services; it returns explicit continuations so
   * the worker, rather than the Gateway, drives the remaining route.
   */
  async executeFlowNodes(
    input: BuildFlowNodeExecutionPlanInput,
    executeNode: (step: FlowNodeExecutionStep) => Promise<FlowWorkerNodeGatewayResult>,
    queueClass: "p0" | "p1" = "p1",
  ): Promise<FlowWorkerNodeExecutionResult> {
    await this.waitForGatewayAvailable(queueClass);
    assertCloneable(input, "execute-flow-nodes");
    if (!input.taskId || !input.leaseOwner || !Number.isInteger(input.leaseVersion) || input.leaseVersion < 1) {
      throw new FlowWorkerPayloadError("execute-flow-nodes.identity");
    }
    if (!Array.isArray(input.flows) || !input.startNodeId) {
      throw new FlowWorkerPayloadError("execute-flow-nodes.flow-snapshot");
    }
    const requestId = randomUUID();
    const sequence = ++this.rpcSequence;
    const channel = new MessageChannel();
    const gatewayPort = channel.port1;
    const workerPort = channel.port2;
    let closed = false;
    let nextSequence = sequence + 1;
    const flowStartedAt = Date.now();
    let activeGatewayCalls = 0;
    let lastGatewayActivityAt = flowStartedAt;
    const gatewayHandler = async (message: {
      requestId?: string;
      sequence?: number;
      command?: string;
      payload?: FlowNodeExecutionStep;
    }) => {
      if (closed) return;
      if (message.requestId !== requestId
        || message.sequence !== nextSequence
        || message.command !== "executeFlowNode"
        || !message.payload?.nodeId
        || !message.payload?.idempotencyKey) {
        gatewayPort.postMessage({
          requestId: message.requestId,
          sequence: message.sequence,
          error: "FLOW_GATEWAY_COMMAND_REJECTED",
        });
        return;
      }
      try {
        await this.waitForGatewayAvailable(queueClass);
        if (closed) return;
      } catch (error) {
        gatewayPort.postMessage({
          requestId,
          sequence: message.sequence,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      nextSequence += 1;
      activeGatewayCalls += 1;
      lastGatewayActivityAt = Date.now();
      const snapshotStartedAt = Date.now();
      const gatewayPromise = this.loadTaskSnapshot(input.taskId).then(snapshot => {
        const snapshotMs = Date.now() - snapshotStartedAt;
        if (snapshotMs >= 500) {
          this.logger.warn(`[flow-worker-node-rpc] ${JSON.stringify({
            queueClass,
            flowElapsedMs: Date.now() - flowStartedAt,
            snapshotMs,
          })}`);
        }
        if (snapshot.status !== "running"
          || snapshot.leaseOwner !== input.leaseOwner
          || Number(snapshot.leaseVersion) !== input.leaseVersion
          || Number(snapshot.leaseUntil || 0) <= Date.now()) {
          throw new Error("FLOW_LEASE_LOST");
        }
        return executeNode(message.payload!);
      }).then(payload => {
        const nextNodeIds = Array.isArray(payload?.nextNodeIds) ? payload.nextNodeIds : [];
        if (nextNodeIds.some(nextNodeId => typeof nextNodeId !== "string" || !nextNodeId)) {
          if (!closed) gatewayPort.postMessage({
            requestId,
            sequence: message.sequence,
            error: "FLOW_GATEWAY_CONTINUATION_INVALID",
          });
          return;
        }
        if (!closed) gatewayPort.postMessage({
          requestId,
          sequence: message.sequence,
          payload: {
            handled: true,
            stop: payload.stop === true,
            nextNodeIds,
          },
        });
      }, error => {
        if (!closed) gatewayPort.postMessage({
          requestId,
          sequence: message.sequence,
          error: error instanceof Error ? error.message : String(error),
        });
      }).finally(() => {
        lastGatewayActivityAt = Date.now();
        activeGatewayCalls = Math.max(0, activeGatewayCalls - 1);
      });
      void this.trackGatewayCall(gatewayPromise, queueClass);
    };
    gatewayPort.on("message", gatewayHandler);
    try {
      const result = await this.runWithGatewayProtection(
        this.getPool(queueClass, false),
        {
          kind: "execute-flow-nodes",
          requestId,
          sequence,
          gatewayPort: workerPort,
          input,
        },
        "execute-flow-nodes",
        [workerPort],
        () => activeGatewayCalls > 0,
        () => lastGatewayActivityAt,
      ) as FlowWorkerNodeExecutionResult;
      if (!result || result.requestId !== requestId || !result.plan
        || typeof result.handled !== "boolean") {
        throw new Error("Flow worker node execution response is invalid");
      }
      return result;
    } finally {
      closed = true;
      gatewayPort.removeListener("message", gatewayHandler);
      gatewayPort.close();
      workerPort.close();
    }
  }

  /**
   * Let a bounded Piscina worker drive independent trigger entries. The
   * callback remains in the main process and is the only place allowed to
   * touch ORM/services; the worker only carries the serializable candidate
   * and waits for the Gateway result.
   */
  async executeTriggerCandidates(
    candidates: FlowWorkerTriggerExecutionCandidate[],
    executeCandidate: (candidate: FlowWorkerTriggerExecutionCandidate) => Promise<string | undefined>,
    queueClass: "p0" | "p1" = "p1",
    concurrency?: number,
  ): Promise<FlowWorkerTriggerExecutionResult[]> {
    await this.waitForGatewayAvailable(queueClass);
    if (!candidates.length) return [];
    for (const candidate of candidates) assertCloneable(candidate, "execute-trigger-candidate");
    const pool = this.getPool(queueClass, false);
    const width = Math.max(1, Math.min(
      this.getMaxThreads(queueClass),
      Number.isInteger(concurrency) && (concurrency as number) > 0 ? concurrency as number : this.getMaxThreads(queueClass),
    ));
    const results: FlowWorkerTriggerExecutionResult[] = [];
    for (let offset = 0; offset < candidates.length; offset += width) {
      const chunk = candidates.slice(offset, offset + width);
      const chunkResults = await Promise.all(chunk.map(async candidate => {
        const requestId = randomUUID();
        const sequence = ++this.rpcSequence;
        const channel = new MessageChannel();
        const gatewayPort = channel.port1;
        const workerPort = channel.port2;
        let closed = false;
        let activeGatewayCalls = 0;
        let lastGatewayActivityAt = Date.now();
        const gatewayHandler = async (message: {
          requestId?: string;
          sequence?: number;
          command?: string;
          payload?: FlowWorkerTriggerExecutionCandidate;
        }) => {
          if (closed) return;
          if (message.requestId !== requestId
            || message.sequence !== sequence
            || message.command !== "executeTriggerCandidate"
            || message.payload?.uuid !== candidate.uuid
            || message.payload?.entryId !== candidate.entryId) {
            gatewayPort.postMessage({
              requestId: message.requestId,
              sequence: message.sequence,
              error: "FLOW_GATEWAY_COMMAND_REJECTED",
            });
            return;
          }
          try {
            await this.waitForGatewayAvailable(queueClass);
            if (closed) return;
          } catch (error) {
            gatewayPort.postMessage({
              requestId,
              sequence,
              error: error instanceof Error ? error.message : String(error),
            });
            return;
          }
          activeGatewayCalls += 1;
          lastGatewayActivityAt = Date.now();
          const gatewayPromise = executeCandidate(candidate).then(todoId => {
            if (!closed) gatewayPort.postMessage({ requestId, sequence, payload: { todoId } });
          }, error => {
            if (!closed) gatewayPort.postMessage({
              requestId,
              sequence,
              error: error instanceof Error ? error.message : String(error),
            });
          }).finally(() => {
            lastGatewayActivityAt = Date.now();
            activeGatewayCalls = Math.max(0, activeGatewayCalls - 1);
          });
          void this.trackGatewayCall(gatewayPromise, queueClass);
        };
        gatewayPort.on("message", gatewayHandler);
        try {
          const result = await this.runWithGatewayProtection(
            pool,
            {
              kind: "execute-trigger-candidate",
              candidate,
              requestId,
              sequence,
              gatewayPort: workerPort,
            },
            "execute-trigger-candidate",
            [workerPort],
            () => activeGatewayCalls > 0,
            () => lastGatewayActivityAt,
          ) as { uuid: string; todoId?: string };
          if (result?.uuid !== candidate.uuid) throw new Error("Flow worker trigger execution response is invalid");
          return { uuid: candidate.uuid, ...(result.todoId ? { todoId: result.todoId } : {}) };
        } catch (error) {
          return {
            uuid: candidate.uuid,
            error: error instanceof Error ? error.message : String(error),
          };
        } finally {
          closed = true;
          gatewayPort.removeListener("message", gatewayHandler);
          gatewayPort.close();
          workerPort.close();
        }
      }));
      results.push(...chunkResults);
      if (offset + width < candidates.length) await new Promise<void>(resolve => setImmediate(resolve));
    }
    return results;
  }

  async shutdown() {
    if (this.shutdownPromise) return await this.shutdownPromise;
    this.stopAccepting();
    const pools = [...this.pools.values()];
    this.pools.clear();
    const terminateTimeout = getPositiveInt("FLOW_EXECUTION_WORKER_TERMINATE_TIMEOUT_MS", 10_000, 120_000);
    this.shutdownPromise = Promise.all(pools.map(async pool => {
      try {
        const drainResult = await this.drain(terminateTimeout);
        if (!drainResult.drained) {
          this.logger.warn(`flow worker pool drain timed out with ${drainResult.inFlight} task(s) in flight`);
        }
        await pool.destroy();
      } catch (error) {
        this.logger.warn(`flow worker pool shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })).then(() => undefined);
    await this.shutdownPromise;
  }
}
