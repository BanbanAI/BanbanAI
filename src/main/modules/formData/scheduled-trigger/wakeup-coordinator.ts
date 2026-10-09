export type WakeupPumpResult = {
  /** The earliest durable time that may require another pump. */
  nextAt?: number
}

export type WakeupTimer = ReturnType<typeof setTimeout>

export type WakeupCoordinatorOptions = {
  now?: () => number
  setTimeout?: (callback: () => void, delay: number) => WakeupTimer
  clearTimeout?: (timer: WakeupTimer) => void
  maxTimerDelayMs?: number
  minTimerDelayMs?: number
  retryDelayMs?: number
  onError?: (error: unknown) => void
}

const MAX_NODE_TIMER_MS = 2_147_000_000
const MIN_TIMER_DELAY_MS = 1

/**
 * Serializes event and time based wakeups. The timer is only a hint; the pump
 * must re-read durable state before doing work.
 */
export class WakeupCoordinator {
  private readonly now: () => number
  private readonly setTimer: (callback: () => void, delay: number) => WakeupTimer
  private readonly clearTimer: (timer: WakeupTimer) => void
  private readonly maxTimerDelayMs: number
  private readonly minTimerDelayMs: number
  private readonly retryDelayMs: number
  private readonly onError?: (error: unknown) => void
  private timer?: WakeupTimer
  private timerAt?: number
  private timerIsImmediate = false
  private timerIsRetry = false
  private timerGeneration = 0
  private pumping = false
  private pumpingPromise?: Promise<void>
  private pending = false
  private pendingAt?: number
  private stopped = false
  private retryDelay: number

  constructor(
    private readonly pump: () => Promise<WakeupPumpResult | void>,
    options: WakeupCoordinatorOptions = {},
  ) {
    this.now = options.now || (() => Date.now())
    this.setTimer = options.setTimeout || ((callback, delay) => setTimeout(callback, delay))
    this.clearTimer = options.clearTimeout || (timer => clearTimeout(timer))
    this.maxTimerDelayMs = Math.max(1, options.maxTimerDelayMs || MAX_NODE_TIMER_MS)
    this.minTimerDelayMs = Math.max(1, options.minTimerDelayMs || MIN_TIMER_DELAY_MS)
    this.retryDelayMs = Math.max(1, options.retryDelayMs || 1_000)
    this.retryDelay = this.retryDelayMs
    this.onError = options.onError
  }

  start() {
    this.wake()
  }

  wake() {
    if (this.stopped) return
    this.pending = true
    this.pendingAt = undefined
    if (this.pumping) return
    // Coalesce repeated commit signals while an immediate timer is already
    // queued. A future (or stale-after-clock-jump) timer must be pulled
    // forward so a wall-clock change cannot leave the consumer asleep.
    if (this.timer && this.timerIsRetry && this.timerAt !== undefined && this.timerAt > this.now()) return
    if (this.timer && this.timerIsImmediate && this.timerAt !== undefined && this.timerAt <= this.now()) return
    this.cancelTimer()
    this.arm(0)
  }

  /** Arm the earliest durable time. A later time never postpones an earlier arm. */
  armAt(nextAt?: number) {
    if (this.stopped || nextAt === undefined || !Number.isFinite(nextAt)) return
    if (this.pumping) {
      // Keep the earliest timer request made while the current pump is in
      // flight. A future request need not force an immediate second query.
      if (nextAt <= this.now()) {
        this.pending = true
        this.pendingAt = undefined
      } else if (!this.pending && (this.pendingAt === undefined || nextAt < this.pendingAt)) {
        this.pendingAt = nextAt
      }
      return
    }
    const now = this.now()
    if (this.timer && this.timerAt !== undefined) {
      if (this.timerAt <= now) {
        // An already queued immediate wake is the earliest possible target;
        // a later durable deadline must never postpone it.
        if (this.timerIsImmediate) return
      } else if (this.timerAt <= nextAt) {
        return
      }
    }
    this.cancelTimer()
    this.arm(Math.max(0, nextAt - now), nextAt)
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.pending = false
    this.pendingAt = undefined
    this.cancelTimer()
    // A shutdown caller can await this promise so no transaction started by
    // the coordinator is still using scheduler state after teardown.
    await this.pumpingPromise
  }

  get isRunning() {
    return this.pumping
  }

  get hasTimer() {
    return Boolean(this.timer)
  }

  private cancelTimer() {
    if (!this.timer) return
    this.clearTimer(this.timer)
    this.timer = undefined
    this.timerAt = undefined
    this.timerIsImmediate = false
    this.timerIsRetry = false
    this.timerGeneration += 1
  }

  private arm(delay: number, targetAt = this.now() + delay, isRetry = false) {
    if (this.stopped || this.timer) return
    const generation = ++this.timerGeneration
    const boundedDelay = Math.min(Math.max(0, delay), this.maxTimerDelayMs)
    const immediate = boundedDelay === 0
    this.timerAt = targetAt
    this.timerIsImmediate = immediate
    this.timerIsRetry = isRetry
    this.timer = this.setTimer(() => {
      if (this.stopped || generation !== this.timerGeneration) return
      const retrySegment = this.timerIsRetry
      this.timer = undefined
      this.timerAt = undefined
      this.timerIsImmediate = false
      this.timerIsRetry = false
      // Node timers are based on a monotonic clock while schedule deadlines
      // are wall-clock timestamps. If a long timer segment fires early (or a
      // machine clock moves backwards), continue the segment without running
      // a database pump yet.
      const remaining = targetAt - this.now()
      if (!immediate && remaining > 0) {
        this.arm(remaining, targetAt, retrySegment)
        return
      }
      void this.run()
    }, boundedDelay)
  }

  private run(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.pumping) return this.pumpingPromise || Promise.resolve()
    const running = this.executePump()
    this.pumpingPromise = running
    // Do not use an unobserved `finally` promise here: an unexpected error in
    // the coordinator must never become an unhandled rejection from a timer.
    void running.then(
      () => { if (this.pumpingPromise === running) this.pumpingPromise = undefined },
      () => { if (this.pumpingPromise === running) this.pumpingPromise = undefined },
    )
    return running
  }

  private async executePump() {
    if (this.stopped || this.pumping) return
    this.pumping = true
    this.pending = false
    this.pendingAt = undefined
    let result: WakeupPumpResult | void
    let retryAt: number | undefined
    try {
      result = await this.pump()
      this.retryDelay = this.retryDelayMs
    } catch (error) {
      if (!this.stopped) {
        try {
          this.onError?.(error)
        } catch {
          // Error reporting must not break the durable retry path.
        }
        retryAt = this.now() + this.retryDelay
        result = { nextAt: retryAt }
        this.retryDelay = Math.min(this.maxTimerDelayMs, this.retryDelay * 2)
      }
    } finally {
      this.pumping = false
      if (!this.stopped) {
        // A failed pump always wins over an immediate pending wake. Otherwise
        // a burst of commit signals can turn a transient database error into a
        // zero-delay busy loop. The pending signal is retained by retrying the
        // same durable read after the bounded backoff.
        if (retryAt !== undefined) {
          this.pending = false
          this.pendingAt = undefined
          this.armRetryAt(retryAt)
        } else if (this.pending) {
          this.pending = false
          this.pendingAt = undefined
          this.arm(0)
        } else {
          const nextAt = [result && result.nextAt, this.pendingAt]
            .filter((value): value is number => value !== undefined && Number.isFinite(value))
            .sort((left, right) => left - right)[0]
          this.pendingAt = undefined
          if (nextAt !== undefined) {
            // A producer that reports an already-due head may have made no
            // progress (for example, because the queue is temporarily locked).
            // Keep the retry non-zero to avoid a setTimeout(0) busy loop while
            // still checking promptly when the durable head is due.
            const isNoProgressRetry = nextAt <= this.now()
            const targetAt = isNoProgressRetry ? this.now() + this.minTimerDelayMs : nextAt
            if (isNoProgressRetry) this.armRetryAt(targetAt)
            else this.armAt(targetAt)
          }
        }
      }
    }
  }

  private armRetryAt(nextAt: number) {
    if (this.stopped || !Number.isFinite(nextAt)) return
    if (this.pumping) {
      if (this.pendingAt === undefined || nextAt < this.pendingAt) this.pendingAt = nextAt
      return
    }
    const now = this.now()
    if (this.timer && this.timerAt !== undefined) {
      if (this.timerAt <= now) {
        if (this.timerIsImmediate) return
      } else if (this.timerAt <= nextAt) {
        return
      }
    }
    this.cancelTimer()
    this.arm(Math.max(0, nextAt - now), nextAt, true)
  }
}
