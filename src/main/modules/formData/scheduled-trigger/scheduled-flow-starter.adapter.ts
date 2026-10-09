import { Injectable } from "@nestjs/common";
import { FormFlowService } from "../form-flow.service";
import { FlowScheduledRun } from "../entities";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { ScheduledFlowStartResult, ScheduledFlowStarter } from "./scheduled-run-worker-pool";

@Injectable()
export class ScheduledFlowStarterAdapter implements ScheduledFlowStarter {
  constructor(private readonly formFlowService: FormFlowService, private readonly repository: ScheduledTriggerRepository) {}

  private async assertLease(run: FlowScheduledRun): Promise<void> {
    const hasRunLease = (this.repository as ScheduledTriggerRepository & {
      hasRunLease?: (runId: string, owner: string, leaseVersion: number, now?: number) => Promise<boolean>;
    }).hasRunLease;
    if (!hasRunLease || !run.leaseOwner || run.leaseVersion === undefined) return;
    if (await hasRunLease.call(this.repository, run.id, run.leaseOwner, run.leaseVersion, Date.now())) return;
    const error = new Error(`scheduled run lease lost: ${run.id}`) as Error & { code?: string };
    error.code = "SCHEDULED_RUN_LEASE_LOST";
    throw error;
  }

  async reconcileScheduledFlow(run: FlowScheduledRun): Promise<ScheduledFlowStartResult | null> {
    await this.assertLease(run);
    const existing = await this.formFlowService.findScheduledFlowExecution(run.id);
    return existing ? { status: "already_started", workflowExecutionId: existing } : null;
  }

  async startScheduledFlow(run: FlowScheduledRun): Promise<ScheduledFlowStartResult> {
    await this.assertLease(run);
    const existing = await this.reconcileScheduledFlow(run);
    if (existing) return existing;
    const definition = await this.repository.findRunnableDefinition(run.scheduleId, run.configHash, run.lifecycleEpoch);
    if (!definition) return { status: "canceled" };
    await this.assertLease(run);
    const todoId = await this.formFlowService.startScheduledFlow({
      runId: run.id,
      todoId: run.todoId,
      scheduleId: run.scheduleId,
      configHash: run.configHash,
      lifecycleEpoch: run.lifecycleEpoch,
      nocodeId: definition.nocodeId,
      tableId: definition.tableId as never,
      uuid: run.recordId,
      processVersion: definition.processVersion,
      nodeUid: definition.nodeUid,
      scheduledFor: run.scheduledFor,
      initiatorUserId: "admin",
      ...(run.leaseOwner === undefined ? {} : { leaseOwner: run.leaseOwner }),
      ...(run.leaseVersion === undefined ? {} : { leaseVersion: run.leaseVersion }),
    });
    if (!todoId) return { status: "canceled" };
    return { status: "started", workflowExecutionId: todoId };
  }
}
