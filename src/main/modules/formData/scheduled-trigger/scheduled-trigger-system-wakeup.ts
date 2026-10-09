import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { performance } from "perf_hooks"
import { ScheduledTriggerSignal } from "./scheduled-trigger-signal"

export type ScheduledSystemWakeReason = "system_resume" | "clock_changed"

type ClockTimer = unknown

export type ClockDiscontinuityMonitorOptions = {
  wallNow?: () => number
  monotonicNow?: () => number
  setTimeout?: (callback: () => void, delay: number) => ClockTimer
  clearTimeout?: (timer: ClockTimer) => void
  intervalMs?: number
  discontinuityThresholdMs?: number
}

const CLOCK_CHECK_INTERVAL_MS = 60_000
const CLOCK_DISCONTINUITY_THRESHOLD_MS = 5_000

/**
 * Samples clocks only; normal checks never touch scheduler storage. A delayed
 * callback or wall-clock jump is the signal to re-read durable queue heads.
 */
export class ClockDiscontinuityMonitor {
  private readonly wallNow: () => number
  private readonly monotonicNow: () => number
  private readonly setTimer: (callback: () => void, delay: number) => ClockTimer
  private readonly clearTimer: (timer: ClockTimer) => void
  private readonly intervalMs: number
  private readonly discontinuityThresholdMs: number
  private timer?: ClockTimer
  private lastWallAt = 0
  private lastMonotonicAt = 0
  private running = false

  constructor(
    private readonly onDiscontinuity: (reason: ScheduledSystemWakeReason) => void,
    options: ClockDiscontinuityMonitorOptions = {},
  ) {
    this.wallNow = options.wallNow || (() => Date.now())
    this.monotonicNow = options.monotonicNow || (() => performance.now())
    this.setTimer = options.setTimeout || ((callback, delay) => setTimeout(callback, delay))
    this.clearTimer = options.clearTimeout || (timer => clearTimeout(timer as ReturnType<typeof setTimeout>))
    this.intervalMs = Math.max(1, options.intervalMs || CLOCK_CHECK_INTERVAL_MS)
    this.discontinuityThresholdMs = Math.max(1, options.discontinuityThresholdMs || CLOCK_DISCONTINUITY_THRESHOLD_MS)
  }

  start() {
    if (this.running) return
    this.running = true
    this.resync()
    this.arm()
  }

  stop() {
    this.running = false
    if (this.timer !== undefined) this.clearTimer(this.timer)
    this.timer = undefined
  }

  resync() {
    this.lastWallAt = this.wallNow()
    this.lastMonotonicAt = this.monotonicNow()
  }

  private arm() {
    if (!this.running || this.timer !== undefined) return
    this.timer = this.setTimer(() => {
      this.timer = undefined
      if (!this.running) return
      this.sample()
      this.arm()
    }, this.intervalMs)
  }

  private sample() {
    const wallAt = this.wallNow()
    const monotonicAt = this.monotonicNow()
    const wallElapsed = wallAt - this.lastWallAt
    const monotonicElapsed = monotonicAt - this.lastMonotonicAt
    const drift = wallElapsed - monotonicElapsed
    this.lastWallAt = wallAt
    this.lastMonotonicAt = monotonicAt

    const reason = Math.abs(drift) > this.discontinuityThresholdMs
      ? "clock_changed"
      : monotonicElapsed > this.intervalMs + this.discontinuityThresholdMs
        ? "system_resume"
        : undefined
    if (!reason) return
    try {
      this.onDiscontinuity(reason)
    } catch {
      // Clock monitoring must survive an observer failure.
    }
  }
}

@Injectable()
export class ScheduledTriggerSystemWake implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly monitor: ClockDiscontinuityMonitor

  constructor(private readonly signal: ScheduledTriggerSignal) {
    this.monitor = new ClockDiscontinuityMonitor(() => this.notify())
  }

  onApplicationBootstrap() {
    this.monitor.start()
  }

  onApplicationShutdown() {
    this.monitor.stop()
  }

  notify() {
    this.monitor.resync()
    this.signal.wake("lifecycle")
  }
}

export type ResumeEventSource = {
  on(event: "resume", listener: () => void): unknown
  removeListener(event: "resume", listener: () => void): unknown
}

export const bindScheduledTriggerResume = (
  source: ResumeEventSource,
  systemWake: Pick<ScheduledTriggerSystemWake, "notify">,
) => {
  const listener = () => systemWake.notify()
  source.on("resume", listener)
  return () => source.removeListener("resume", listener)
}
