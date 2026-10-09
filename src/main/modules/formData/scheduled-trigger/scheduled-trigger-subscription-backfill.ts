import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { ScheduledTriggerRepository } from "./scheduled-trigger.repository";
import { ScheduledTriggerSignal } from "./scheduled-trigger-signal";
import { WakeupCoordinator, WakeupPumpResult } from "./wakeup-coordinator";

const BACKFILL_BATCH_SIZE = 16;
const BACKFILL_LOW_WATERMARK = 32;
const BACKFILL_HIGH_WATERMARK = 48;
const BACKFILL_LEASE_MS = 30_000;
const BACKFILL_BATCH_YIELD_MS = 25;

/** One-time bridge for subscriptions that predate the durable scheduler. */
@Injectable()
export class ScheduledTriggerSubscriptionBackfill implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("ScheduledTriggerSubscriptionBackfill");
  private readonly owner = `schedule-subscription-backfill-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  private readonly wakeup: WakeupCoordinator;
  private unsubscribe?: () => boolean;
  private completed = false;

  constructor(
    private readonly repository: ScheduledTriggerRepository,
    @Optional() @Inject(ScheduledTriggerSignal) private readonly signal?: ScheduledTriggerSignal,
  ) {
    this.wakeup = new WakeupCoordinator(() => this.processOneBatch(), {
      onError: error => this.logger.warn("scheduled subscription backfill failed", error),
    });
    this.unsubscribe = this.signal?.subscribe(reason => {
      if (reason === "definition" || reason === "lease" || reason === "lifecycle") this.wakeup.wake();
    });
  }

  onApplicationBootstrap() {
    this.wakeup.start();
  }

  async onApplicationShutdown() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.wakeup.stop();
  }

  async processOneBatch(now = Date.now()): Promise<WakeupPumpResult> {
    if (this.completed) return {};
    const result = await this.repository.advanceSubscriptionBackfill({
      owner: this.owner,
      now,
      leaseMs: BACKFILL_LEASE_MS,
      limit: BACKFILL_BATCH_SIZE,
      lowWatermark: BACKFILL_LOW_WATERMARK,
      highWatermark: BACKFILL_HIGH_WATERMARK,
    });
    if (result.state === "leased") return { nextAt: result.nextAt };
    if (result.state === "progressed") return { nextAt: now + BACKFILL_BATCH_YIELD_MS };
    if (result.state === "completed") {
      this.completed = true;
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    }
    return {};
  }
}
