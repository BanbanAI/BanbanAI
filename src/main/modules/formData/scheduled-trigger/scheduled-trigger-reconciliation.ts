import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ScheduleDefinitionService } from "./schedule-definition-service";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { WakeupCoordinator, WakeupPumpResult } from "./wakeup-coordinator";

const RECONCILIATION_BATCH_SIZE = 200;
const RECONCILIATION_INTERVAL_MS = 30 * 60 * 1_000;
const RECONCILIATION_BUSY_DELAY_MS = 5 * 60 * 1_000;
const RECONCILIATION_DRAIN_DELAY_MS = 60_000;
const RECONCILIATION_INITIAL_DELAY_MS = 5 * 60 * 1_000;

@Injectable()
export class ScheduledTriggerReconciliation implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("ScheduledTriggerReconciliation");
  private readonly wakeup = new WakeupCoordinator(() => this.runOnce(Date.now()), {
    onError: error => this.logger.warn("scheduled projection reconciliation failed", error),
  });

  constructor(
    private readonly repository: ScheduledTriggerRepository,
    private readonly definitions: ScheduleDefinitionService,
  ) {}

  onApplicationBootstrap() {
    this.wakeup.armAt(Date.now() + RECONCILIATION_INITIAL_DELAY_MS);
  }

  async onApplicationShutdown() {
    await this.wakeup.stop();
  }

  async runOnce(now: number): Promise<WakeupPumpResult> {
    if (await this.repository.countActiveRuns() > 0) {
      return { nextAt: now + RECONCILIATION_BUSY_DELAY_MS };
    }
    const scanned = await this.definitions.reconcileOneProjectionBatch(RECONCILIATION_BATCH_SIZE, now);
    return {
      nextAt: now + (scanned >= RECONCILIATION_BATCH_SIZE
        ? RECONCILIATION_DRAIN_DELAY_MS
        : RECONCILIATION_INTERVAL_MS),
    };
  }
}
