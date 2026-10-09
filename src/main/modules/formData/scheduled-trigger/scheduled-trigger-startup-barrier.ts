import { Injectable } from "@nestjs/common";

/** Gates due dispatch until the first durable configuration replay is stable. */
@Injectable()
export class ScheduledTriggerStartupBarrier {
  private ready = false;
  private readonly listeners = new Set<() => void>();

  get isReady() {
    return this.ready;
  }

  subscribe(listener: () => void) {
    if (this.ready) {
      listener();
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  release() {
    if (this.ready) return false;
    this.ready = true;
    for (const listener of this.listeners) listener();
    this.listeners.clear();
    return true;
  }
}
