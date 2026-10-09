import { Injectable } from "@nestjs/common"

export type ScheduledTriggerSignalReason =
  | "definition"
  | "subscription_backfill"
  | "projection"
  | "cursor"
  | "run"
  | "lease"
  | "lifecycle"

export type ScheduledTriggerSignalListener = (reason: ScheduledTriggerSignalReason) => void

/** In-process hint bus. Durable rows remain the source of truth. */
@Injectable()
export class ScheduledTriggerSignal {
  private readonly listeners = new Set<ScheduledTriggerSignalListener>()

  subscribe(listener: ScheduledTriggerSignalListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  wake(reason: ScheduledTriggerSignalReason) {
    for (const listener of this.listeners) {
      try {
        listener(reason)
      } catch {
        // A signal listener must not make the committed mutation fail.
      }
    }
  }
}
