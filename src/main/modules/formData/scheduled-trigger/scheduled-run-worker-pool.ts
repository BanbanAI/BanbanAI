import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { FlowScheduledRun } from "../entities";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { ScheduledTriggerSignal } from "./scheduled-trigger-signal";
import { WakeupCoordinator, WakeupPumpResult } from "./wakeup-coordinator";

export type ScheduledFlowStartResult = {
  status: "started" | "already_started" | "skipped" | "canceled";
  workflowExecutionId?: string;
};

export interface ScheduledFlowStarter {
  startScheduledFlow(run: FlowScheduledRun): Promise<ScheduledFlowStartResult>;
  reconcileScheduledFlow?(run: FlowScheduledRun): Promise<ScheduledFlowStartResult | null>;
}

export const SCHEDULED_FLOW_STARTER = Symbol("SCHEDULED_FLOW_STARTER");

export type WorkerPoolOptions = {
  globalConcurrency: number;
  perScheduleConcurrency: number;
  leaseMs: number;
  batchSize: number;
  maxAttempts: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  shutdownTimeoutMs: number;
};

const DEFAULT_OPTIONS: WorkerPoolOptions = {
  globalConcurrency: 8,
  perScheduleConcurrency: 2,
  leaseMs: 60_000,
  batchSize: 8,
  maxAttempts: 5,
  retryDelayMs: 10_000,
  maxRetryDelayMs: 300_000,
  shutdownTimeoutMs: 10_000,
};

@Injectable()
export class ScheduledRunWorkerPool implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("ScheduledRunWorkerPool");
  private readonly options: WorkerPoolOptions;
  private readonly activeBySchedule = new Map<string, number>();
  private readonly wakeup: WakeupCoordinator;
  private readonly unsubscribe?: () => boolean;
  private readonly activeExecutions = new Set<Promise<void>>();
  private readonly activeLeaseStops = new Set<() => void>();
  private activeCount = 0;
  private lastScheduleId?: string;
  private stopped = false;
  private finalizationAllowed = true;

  constructor(
    private readonly repository: ScheduledTriggerRepository,
    @Inject(SCHEDULED_FLOW_STARTER) private readonly starter: ScheduledFlowStarter,
    @Optional() options?: Partial<WorkerPoolOptions>,
    @Optional() signal?: ScheduledTriggerSignal,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.wakeup = new WakeupCoordinator(() => this.pump(), {
      onError: error => this.logger.error("scheduled worker pump failed", error instanceof Error ? error.stack : String(error)),
    });
    this.unsubscribe = signal?.subscribe(reason => {
      if (reason === "run" || reason === "lease" || reason === "lifecycle") this.wake(reason);
    });
  }

  onApplicationBootstrap() {
    this.wakeup.start();
  }

  wake(_reason = "event") {
    void _reason;
    if (!this.stopped) this.wakeup.wake();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.unsubscribe?.();
    await this.wakeup.stop();
    for (const stopLeaseRenewal of this.activeLeaseStops) stopLeaseRenewal();
    const activeExecutions = [...this.activeExecutions];
    if (!activeExecutions.length) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = await Promise.race([
      Promise.allSettled(activeExecutions).then(() => false),
      new Promise<boolean>(resolve => {
        timeout = setTimeout(() => resolve(true), Math.max(1, this.options.shutdownTimeoutMs));
      }),
    ]);
    if (timeout) clearTimeout(timeout);
    if (timedOut) {
      // Do not let a flow that outlives Nest's shutdown deadline write a
      // terminal state through an ORM that is about to close. Its running
      // lease is intentionally left to expire and recover on the next start.
      this.finalizationAllowed = false;
      this.logger.warn(`scheduled worker shutdown timed out after ${this.options.shutdownTimeoutMs}ms; active leases will recover on the next start`);
    }
  }

  async onApplicationShutdown() {
    await this.stop();
  }

  async tick(now = Date.now()): Promise<number> {
    if (this.stopped) return 0;
    // Lease recovery is independent of local capacity. If every worker slot
    // is occupied, an expired lease still needs to become durable retry work
    // and must not wait for a fixed polling tick.
    await this.repository.recoverExpiredLeases(now);
    await this.repository.requeueReadyRetries(now, this.options.batchSize);
    if (this.activeCount >= this.options.globalConcurrency) return 0;
    let capacity = Math.min(this.options.batchSize, this.options.globalConcurrency - this.activeCount);
    const scheduleIds = this.repository.findQueuedScheduleIds
      ? await this.repository.findQueuedScheduleIds(now, Math.max(this.options.batchSize * 8, 64), this.lastScheduleId)
      : [undefined];
    const runs: FlowScheduledRun[] = [];
    for (const scheduleId of scheduleIds) {
      if (capacity <= 0) break;
      if (scheduleId) this.lastScheduleId = scheduleId;
      const active = scheduleId ? this.activeBySchedule.get(scheduleId) || 0 : 0;
      const scheduleCapacity = Math.min(capacity, this.options.perScheduleConcurrency - active);
      if (scheduleCapacity <= 0) continue;
      const leased = await this.repository.leaseQueuedRuns({ owner: this.owner, now, leaseMs: this.options.leaseMs, limit: scheduleCapacity, scheduleId });
      runs.push(...leased);
      capacity -= leased.length;
    }
    for (const run of runs) {
      const scheduleActive = this.activeBySchedule.get(run.scheduleId) || 0;
      this.activeCount += 1;
      this.activeBySchedule.set(run.scheduleId, scheduleActive + 1);
      const execution = this.execute(run).catch(error => {
        this.logger.error(`scheduled run ${run.id} execution failed`, error instanceof Error ? error.stack : String(error));
      });
      this.activeExecutions.add(execution);
      void execution.then(
        () => this.activeExecutions.delete(execution),
        () => this.activeExecutions.delete(execution),
      );
    }
    return runs.length;
  }

  private async pump(): Promise<WakeupPumpResult> {
    const started = await this.tick(Date.now());
    const nextLease = await this.repository.findEarliestRunLeaseUntil();
    // When all local slots are occupied, completion/recovery signals are the
    // wake source. Do not arm a timer for already-available queued rows or it
    // would turn the high-water condition into a tight retry loop.
    if (this.activeCount >= this.options.globalConcurrency) return { nextAt: nextLease };
    const nextAvailable = await this.repository.findEarliestRunAvailableAt();
    if (started === 0 && nextAvailable !== undefined && nextAvailable <= Date.now()) {
      // Due work that could not be leased is blocked by a per-schedule slot.
      // The running task's completion signal (or its lease expiry) is the next
      // useful wakeup; repeatedly querying the same due row would busy-loop.
      return { nextAt: nextLease };
    }
    const nextAt = [nextAvailable, nextLease].filter((value): value is number => value !== undefined).sort((a, b) => a - b)[0];
    return { nextAt };
  }

  private readonly owner = `worker-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

  private async execute(run: FlowScheduledRun) {
    const lease = this.startLeaseRenewal(run);
    this.activeLeaseStops.add(lease.stop);
    try {
      const result = run.attemptCount > this.options.maxAttempts
        ? await this.starter.reconcileScheduledFlow?.(run)
        : await this.starter.startScheduledFlow(run);
      if (lease.isLost()) throw this.createLeaseLostError(run);
      if (!result) {
        if (!this.finalizationAllowed) return;
        const finished = await this.repository.finishRun({
          runId: run.id,
          owner: this.owner,
          ...(run.leaseVersion === undefined ? {} : { leaseVersion: run.leaseVersion }),
          now: Date.now(),
          state: "dead_letter",
          errorCode: "MAX_ATTEMPTS",
          errorMessage: "Scheduled flow could not be reconciled after the maximum attempts",
        });
        if (!finished) this.logger.warn(`scheduled run ${run.id} lease fencing lost before finalization`);
        return;
      }
      if (result.workflowExecutionId) {
        if (!this.finalizationAllowed) return;
        const attached = await this.repository.attachWorkflowExecution(
          run.id,
          result.workflowExecutionId,
          this.owner,
          run.leaseVersion,
          Date.now(),
        );
        if (!attached) throw this.createLeaseLostError(run);
      }
      if (!this.finalizationAllowed) return;
      const state = result.status === "canceled" ? "canceled" : result.status === "skipped" ? "skipped" : "succeeded";
      const finished = await this.repository.finishRun({
        runId: run.id,
        owner: this.owner,
        ...(run.leaseVersion === undefined ? {} : { leaseVersion: run.leaseVersion }),
        now: Date.now(),
        state,
      });
      if (!finished) this.logger.warn(`scheduled run ${run.id} lease fencing lost before finalization`);
    } catch (error) {
      if (lease.isLost() || (error as { code?: string })?.code === "SCHEDULED_RUN_LEASE_LOST") {
        this.logger.warn(`scheduled run ${run.id} execution abandoned after lease fencing`);
        return;
      }
      if (!this.finalizationAllowed) {
        this.logger.warn(`scheduled run ${run.id} execution abandoned after shutdown deadline`);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const permanent = (error as { permanent?: boolean })?.permanent === true;
      const state = permanent || run.attemptCount >= this.options.maxAttempts ? "dead_letter" : "retry_wait";
      const retryDelay = Math.min(this.options.maxRetryDelayMs, this.options.retryDelayMs * 2 ** Math.max(0, run.attemptCount - 1));
      const finished = await this.repository.finishRun({
        runId: run.id,
        owner: this.owner,
        ...(run.leaseVersion === undefined ? {} : { leaseVersion: run.leaseVersion }),
        now: Date.now(),
        state,
        availableAt: state === "retry_wait" ? Date.now() + retryDelay : undefined,
        errorCode: permanent ? "PERMANENT_ERROR" : "TRANSIENT_ERROR",
        errorMessage: message,
      });
      if (finished) this.logger.warn(`scheduled run ${run.id} ${state}: ${message.slice(0, 200)}`);
      else this.logger.warn(`scheduled run ${run.id} lease fencing lost before retry state was persisted`);
    } finally {
      lease.stop();
      this.activeLeaseStops.delete(lease.stop);
      this.activeCount -= 1;
      const count = (this.activeBySchedule.get(run.scheduleId) || 1) - 1;
      if (count > 0) this.activeBySchedule.set(run.scheduleId, count); else this.activeBySchedule.delete(run.scheduleId);
      this.wake("run");
    }
  }

  private createLeaseLostError(run: FlowScheduledRun) {
    const error = new Error(`scheduled run lease lost: ${run.id}`) as Error & { code?: string };
    error.code = "SCHEDULED_RUN_LEASE_LOST";
    return error;
  }

  /** Keep long-running flows fenced to this worker's lease generation. */
  private startLeaseRenewal(run: FlowScheduledRun) {
    const renew = (this.repository as unknown as {
      renewRunLease?: (input: { runId: string; owner: string; leaseVersion: number; now: number; leaseMs: number }) => Promise<boolean>;
    }).renewRunLease;
    if (!renew || !run.leaseOwner || run.leaseVersion === undefined) return { stop: () => undefined, isLost: () => false };
    let stopped = false;
    let lost = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delay = Math.max(1, Math.floor(this.options.leaseMs / 3));
    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(async () => {
        timer = undefined;
        if (stopped) return;
        try {
          const renewed = await renew.call(this.repository, {
            runId: run.id,
            owner: run.leaseOwner!,
            leaseVersion: run.leaseVersion!,
            now: Date.now(),
            leaseMs: this.options.leaseMs,
          });
          if (!renewed) {
            lost = true;
            this.logger.warn(`scheduled run ${run.id} lease fencing lost; stale worker will not finalize it`);
            return;
          }
        } catch (error) {
          lost = true;
          this.logger.warn(`scheduled run ${run.id} lease renewal failed`, error);
          return;
        }
        schedule();
      }, delay);
      const unref = (timer as unknown as { unref?: () => void }).unref;
      unref?.call(timer);
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
}
