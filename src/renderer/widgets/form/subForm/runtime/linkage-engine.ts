import { RowStore } from "./row-store";
import { ChangeSet, RowContext, RowId, RowPatch } from "./types";

export type LinkageResolveContext = {
  readonly row: RowContext;
  readonly signal: AbortSignal;
};

export type LinkageRule = {
  readonly id: string;
  readonly sourceFields: readonly string[];
  readonly targetFields: readonly string[];
  readonly getKey: (row: RowContext) => string | undefined;
  readonly resolve: (context: LinkageResolveContext) => Promise<Readonly<Record<string, unknown>>> | Readonly<Record<string, unknown>>;
};

type LinkageTask = {
  rule: LinkageRule;
  rowId: RowId;
  key: string;
};

type SharedRequest = {
  promise: Promise<Readonly<Record<string, unknown>>>;
  controller: AbortController;
};

type LinkageMetrics = {
  scheduled: number;
  deduped: number;
  completed: number;
  discarded: number;
  failed: number;
};

const intersects = (left: readonly string[], right: readonly string[]) => {
  const values = new Set(left);
  return right.some(value => values.has(value));
};

export class LinkageEngine {
  private readonly rules: readonly LinkageRule[];
  private readonly inFlight = new Map<string, SharedRequest>();
  private readonly taskControllers = new Map<string, AbortController>();
  private readonly controllers = new Set<AbortController>();
  private readonly pendingRuns = new Set<Promise<void>>();
  private readonly queuedTasks: LinkageTask[] = [];
  private activeRequests = 0;
  private disposed = false;
  private readonly concurrency: number;
  private readonly metricsState: LinkageMetrics = { scheduled: 0, deduped: 0, completed: 0, discarded: 0, failed: 0 };
  private readonly stopListening: () => boolean;

  constructor(
    private readonly store: RowStore,
    rules: readonly LinkageRule[],
    options: { concurrency?: number } = {},
  ) {
    this.rules = rules;
    this.concurrency = Math.max(1, options.concurrency || 4);
    this.stopListening = store.subscribe(changeSet => this.enqueueChangeSet(changeSet));
  }

  get metrics(): Readonly<LinkageMetrics> {
    return { ...this.metricsState };
  }

  async runAll(rowIds: readonly RowId[] = this.store.rowIds) {
    const changes: ChangeSet = {
      transactionId: "initial-linkage-run",
      changes: [],
      changedRows: rowIds,
      changedFields: this.rules.flatMap(rule => rule.sourceFields),
      addedRows: rowIds,
      deletedRows: [],
    };
    this.enqueueChangeSet(changes);
    await this.flush();
  }

  async flush() {
    while (this.pendingRuns.size || this.queuedTasks.length || this.activeRequests) {
      const pending = [...this.pendingRuns];
      if (pending.length) await Promise.allSettled(pending);
      else await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopListening();
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.queuedTasks.splice(0);
    this.inFlight.clear();
    this.taskControllers.clear();
  }

  private enqueueChangeSet(changeSet: ChangeSet) {
    if (this.disposed) return;
    const run = this.processChangeSet(changeSet);
    this.pendingRuns.add(run);
    void run.finally(() => this.pendingRuns.delete(run));
  }

  private async processChangeSet(changeSet: ChangeSet) {
    const deletedRows = new Set(changeSet.deletedRows);
    const changedFields = new Set(changeSet.changedFields);
    for (const rule of this.rules) {
      if (!changeSet.addedRows.length && !intersects([...changedFields], rule.sourceFields)) continue;
      for (const rowId of changeSet.changedRows) {
        if (deletedRows.has(rowId)) continue;
        const row = this.store.getRow(rowId);
        if (!row) continue;
        const key = rule.getKey(row);
        if (!key) continue;
        const taskKey = `${rule.id}\u0000${rowId}`;
        this.taskControllers.get(taskKey)?.abort();
        for (let index = this.queuedTasks.length - 1; index >= 0; index -= 1) {
          const queued = this.queuedTasks[index];
          if (`${queued.rule.id}\u0000${queued.rowId}` === taskKey) this.queuedTasks.splice(index, 1);
        }
        this.queuedTasks.push({ rule, rowId, key });
        this.metricsState.scheduled += 1;
      }
    }
    await this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    while (!this.disposed && this.queuedTasks.length && this.activeRequests < this.concurrency) {
      const task = this.queuedTasks.shift()!;
      this.activeRequests += 1;
      void this.executeTask(task).finally(() => {
        this.activeRequests -= 1;
        void this.drainQueue();
      });
    }
    if (this.activeRequests) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return this.drainQueue();
    }
  }

  private async executeTask(task: LinkageTask) {
    const row = this.store.getRow(task.rowId);
    if (!row || !this.isTaskInputCurrent(task, row)) {
      this.metricsState.discarded += 1;
      return;
    }
    const requestKey = `${task.rule.id}\u0000${task.key}`;
    const taskKey = `${task.rule.id}\u0000${task.rowId}`;
    this.taskControllers.get(taskKey)?.abort();
    const taskController = new AbortController();
    this.taskControllers.set(taskKey, taskController);
    let request = this.inFlight.get(requestKey);
    if (request) {
      this.metricsState.deduped += 1;
    } else {
      const controller = new AbortController();
      this.controllers.add(controller);
      request = {
        promise: Promise.resolve(task.rule.resolve({ row, signal: controller.signal })),
        controller,
      };
      this.inFlight.set(requestKey, request);
      void request.promise.then(() => {
        this.inFlight.delete(requestKey);
        this.controllers.delete(controller);
      }, () => {
        this.inFlight.delete(requestKey);
        this.controllers.delete(controller);
      });
    }
    try {
      const values = await this.awaitWithAbort(request.promise, taskController.signal);
      const latestRow = this.store.getRow(task.rowId);
      if (!latestRow || !this.isTaskInputCurrent(task, latestRow)) {
        this.metricsState.discarded += 1;
        return;
      }
      const patch: RowPatch = {
        rowId: task.rowId,
        values: Object.fromEntries(task.rule.targetFields
          .filter(fieldId => Object.prototype.hasOwnProperty.call(values, fieldId))
          .map(fieldId => [fieldId, values[fieldId]])),
      };
      if (Object.keys(patch.values).length) {
        await this.store.transact(tx => tx.patchRow(patch, "linkage"));
      }
      this.metricsState.completed += 1;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        this.metricsState.discarded += 1;
      } else {
        this.metricsState.failed += 1;
      }
    } finally {
      if (this.taskControllers.get(taskKey) === taskController) this.taskControllers.delete(taskKey);
    }
  }

  private isTaskInputCurrent(task: LinkageTask, row: RowContext): boolean {
    const key = task.rule.getKey(row);
    return key !== undefined && key === task.key;
  }

  private awaitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(value => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      }, error => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      });
    });
  }
}
