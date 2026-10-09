type AnimationFrameCallback = (timestamp: number) => void

type TimeoutHandle = number | ReturnType<typeof setTimeout>
type AnimationFrameHandle = number

type BootReadySignalEnv = {
  requestAnimationFrame?: ((callback: AnimationFrameCallback) => AnimationFrameHandle) | null
  setTimeout: (callback: () => void, delay: number) => TimeoutHandle
  clearTimeout: (handle: TimeoutHandle) => void
  visibilityState?: string | null
}

type BootReadySignalOptions = {
  fallbackDelayMs?: number
}

const DEFAULT_FALLBACK_DELAY_MS = 120

export const waitForBootReadySignal = (
  env: BootReadySignalEnv,
  options?: BootReadySignalOptions,
) => new Promise<void>((resolve) => {
  let settled = false
  const fallbackDelayMs = options?.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS

  const finish = () => {
    if (settled) return
    settled = true
    env.clearTimeout(timeoutHandle)
    resolve()
  }

  const timeoutHandle = env.setTimeout(() => {
    finish()
  }, fallbackDelayMs)

  if (env.visibilityState === 'hidden' || typeof env.requestAnimationFrame !== 'function') {
    return
  }

  env.requestAnimationFrame(() => {
    env.requestAnimationFrame?.(() => {
      finish()
    })
  })
})

export type { BootReadySignalEnv, BootReadySignalOptions }
