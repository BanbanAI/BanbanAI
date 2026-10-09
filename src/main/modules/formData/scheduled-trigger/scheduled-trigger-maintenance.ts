import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { SCHEDULE_POLICY } from "./schedule-policy";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { WakeupCoordinator, WakeupPumpResult } from "./wakeup-coordinator";

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAINTENANCE_BATCH_SIZE = 200;
const MAINTENANCE_INTERVAL_MS = DAY_MS;
const MAINTENANCE_BUSY_DELAY_MS = 5 * 60 * 1_000;
const MAINTENANCE_DRAIN_DELAY_MS = 1_000;
const MAINTENANCE_INITIAL_DELAY_MS = 60_000;

@Injectable()
export class ScheduledTriggerMaintenance implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly wakeup = new WakeupCoordinator(() => this.runOnce(Date.now()));

  constructor(private readonly repository: ScheduledTriggerRepository) {}

  onApplicationBootstrap() {
    this.wakeup.armAt(Date.now() + MAINTENANCE_INITIAL_DELAY_MS);
  }

  async onApplicationShutdown() {
    await this.wakeup.stop();
  }

  async runOnce(now: number): Promise<WakeupPumpResult> {
    if (await this.repository.countActiveRuns() > 0) {
      return { nextAt: now + MAINTENANCE_BUSY_DELAY_MS };
    }
    const successCutoff = now - SCHEDULE_POLICY.successfulRunRetentionDays * DAY_MS;
    const deadLetterCutoff = now - SCHEDULE_POLICY.deadLetterRetentionDays * DAY_MS;
    const removed = [
      await this.repository.purgeRuns(successCutoff, deadLetterCutoff, MAINTENANCE_BATCH_SIZE),
      await this.repository.purgeRetiredScheduleData(MAINTENANCE_BATCH_SIZE),
      await this.repository.purgeFires(successCutoff, MAINTENANCE_BATCH_SIZE),
    ];
    return {
      nextAt: now + (removed.some(count => count >= MAINTENANCE_BATCH_SIZE)
        ? MAINTENANCE_DRAIN_DELAY_MS
        : MAINTENANCE_INTERVAL_MS),
    };
  }
}
