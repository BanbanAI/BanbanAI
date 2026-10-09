type CoordinationReadyState = 'pending' | 'ready' | 'failed' | 'disposed'

export const createCoordinationReadyGate = () => {
  let version = 0
  let state: CoordinationReadyState = 'pending'
  const waiters = new Set<(ready: boolean) => void>()

  const settleWaiters = (ready: boolean) => {
    waiters.forEach(resolve => resolve(ready))
    waiters.clear()
  }

  return {
    reset() {
      if (state === 'disposed') return version
      version += 1
      state = 'pending'
      return version
    },
    resolve(targetVersion: number, ready: boolean) {
      if (state === 'disposed' || targetVersion !== version) return
      state = ready ? 'ready' : 'failed'
      settleWaiters(ready)
    },
    wait(): Promise<boolean> {
      if (state === 'ready') return Promise.resolve(true)
      if (state === 'failed' || state === 'disposed') return Promise.resolve(false)
      return new Promise(resolve => waiters.add(resolve))
    },
    dispose() {
      if (state === 'disposed') return
      version += 1
      state = 'disposed'
      settleWaiters(false)
    },
  }
}
