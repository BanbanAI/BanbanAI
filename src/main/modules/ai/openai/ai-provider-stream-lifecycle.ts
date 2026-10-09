export type AiProviderStreamTimeoutPhase = 'first_event' | 'idle' | 'total'

export class AiProviderStreamTimeoutError extends Error {
  readonly code = 'AI_PROVIDER_STREAM_TIMEOUT'

  constructor(
    readonly phase: AiProviderStreamTimeoutPhase,
    readonly timeoutMs: number,
  ) {
    super(`AI provider stream ${phase} timeout after ${timeoutMs}ms`)
    this.name = 'AiProviderStreamTimeoutError'
  }
}

export type AiProviderStreamLifecycle = {
  signal: AbortSignal
  markProviderEvent: () => void
  throwIfTimedOut: () => void
  dispose: () => void
}

type TimerApi = {
  setTimeout: (callback: () => void, timeoutMs: number) => unknown
  clearTimeout: (handle: unknown) => void
}

type CreateAiProviderStreamLifecycleOptions = {
  firstEventTimeoutMs: number
  idleTimeoutMs: number
  totalTimeoutMs: number
  parentSignal?: AbortSignal
  timerApi?: TimerApi
}

const defaultTimerApi: TimerApi = {
  setTimeout: (callback, timeoutMs) => globalThis.setTimeout(callback, timeoutMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

const normalizeTimeoutMs = (value: number) => Math.max(1, Math.round(Number(value || 0)))

export const createAiProviderStreamLifecycle = (
  options: CreateAiProviderStreamLifecycleOptions,
): AiProviderStreamLifecycle => {
  const firstEventTimeoutMs = normalizeTimeoutMs(options.firstEventTimeoutMs)
  const idleTimeoutMs = normalizeTimeoutMs(options.idleTimeoutMs)
  const totalTimeoutMs = normalizeTimeoutMs(options.totalTimeoutMs)
  const timerApi = options.timerApi || defaultTimerApi
  const controller = new AbortController()

  let closed = false
  let firstProviderEventSeen = false
  let timeoutError: AiProviderStreamTimeoutError | null = null
  let firstEventTimer: unknown = null
  let idleTimer: unknown = null
  let totalTimer: unknown = null
  let removeParentAbortListener: (() => void) | null = null

  const clearTimer = (handle: unknown) => {
    if (handle === null || handle === undefined) {
      return null
    }
    timerApi.clearTimeout(handle)
    return null
  }

  const clearAllTimers = () => {
    firstEventTimer = clearTimer(firstEventTimer)
    idleTimer = clearTimer(idleTimer)
    totalTimer = clearTimer(totalTimer)
  }

  const close = () => {
    if (closed) {
      return
    }
    closed = true
    clearAllTimers()
    removeParentAbortListener?.()
    removeParentAbortListener = null
  }

  const parentSignal = options.parentSignal
  if (parentSignal) {
    const onParentAbort = () => {
      if (closed || timeoutError || controller.signal.aborted) {
        return
      }
      close()
      controller.abort(parentSignal.reason)
    }

    if (parentSignal.aborted) {
      onParentAbort()
    } else {
      parentSignal.addEventListener('abort', onParentAbort)
      removeParentAbortListener = () => {
        parentSignal.removeEventListener('abort', onParentAbort)
      }
    }
  }

  const triggerTimeout = (
    phase: AiProviderStreamTimeoutPhase,
    timeoutMs: number,
  ) => {
    if (closed || timeoutError) {
      return
    }
    timeoutError = new AiProviderStreamTimeoutError(phase, timeoutMs)
    close()
    if (!controller.signal.aborted) {
      controller.abort(timeoutError)
    }
  }

  const resetIdleTimer = () => {
    if (closed || controller.signal.aborted || timeoutError) {
      return
    }
    idleTimer = clearTimer(idleTimer)
    idleTimer = timerApi.setTimeout(() => {
      triggerTimeout('idle', idleTimeoutMs)
    }, idleTimeoutMs)
  }

  firstEventTimer = timerApi.setTimeout(() => {
    triggerTimeout('first_event', firstEventTimeoutMs)
  }, firstEventTimeoutMs)

  totalTimer = timerApi.setTimeout(() => {
    triggerTimeout('total', totalTimeoutMs)
  }, totalTimeoutMs)

  return {
    signal: controller.signal,
    markProviderEvent: () => {
      if (closed || controller.signal.aborted || timeoutError) {
        return
      }
      if (!firstProviderEventSeen) {
        firstProviderEventSeen = true
        firstEventTimer = clearTimer(firstEventTimer)
      }
      resetIdleTimer()
    },
    throwIfTimedOut: () => {
      if (timeoutError) {
        throw timeoutError
      }
    },
    dispose: () => {
      close()
    },
  }
}
