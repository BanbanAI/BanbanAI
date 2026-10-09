export type BeforeQuitEvent = {
  preventDefault(): void
}

export type ElectronAppLike = {
  on(event: "before-quit", listener: (event: BeforeQuitEvent) => void): void
  removeListener?(event: "before-quit", listener: (event: BeforeQuitEvent) => void): void
  quit(): void
}

export type NestApplicationLike = {
  close(): Promise<void>
}

const DEFAULT_NEST_SHUTDOWN_TIMEOUT_MS = 15_000

/** Let Nest finish its shutdown hooks before allowing Electron to exit. */
export function bindNestApplicationShutdown(
  app: ElectronAppLike,
  nestApp: NestApplicationLike,
  shutdownTimeoutMs = DEFAULT_NEST_SHUTDOWN_TIMEOUT_MS,
) {
  let closePromise: Promise<void> | undefined
  let shutdownComplete = false

  const onBeforeQuit = (event: BeforeQuitEvent) => {
    if (shutdownComplete) return
    event.preventDefault()
    if (closePromise) return

    const closeOperation = Promise.resolve()
      .then(() => nestApp.close())
      .catch(error => {
        console.error("Nest application shutdown failed", error)
      })
    let timeout: ReturnType<typeof setTimeout> | undefined
    closePromise = Promise.race([
      closeOperation,
      new Promise<void>(resolve => {
        timeout = setTimeout(() => {
          console.warn(`Nest application shutdown timed out after ${shutdownTimeoutMs}ms`)
          resolve()
        }, Math.max(1, shutdownTimeoutMs))
      }),
    ]).then(() => {
      if (timeout) clearTimeout(timeout)
    }).then(() => {
      shutdownComplete = true
      app.removeListener?.("before-quit", onBeforeQuit)
      app.quit()
    })
  }

  app.on("before-quit", onBeforeQuit)
  return () => app.removeListener?.("before-quit", onBeforeQuit)
}
