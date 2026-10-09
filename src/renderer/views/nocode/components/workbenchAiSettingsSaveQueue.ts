type SaveQueueRequest<TPayload> = {
  snapshot: string
  payload: TPayload
}

type SaveQueueWaiter<TResult> = {
  resolve: (value: TResult | null) => void
  reject: (reason?: unknown) => void
}

export const createSingleFlightSaveQueue = <TPayload, TResult>(options: {
  persist: (payload: TPayload) => Promise<TResult | null>
  getSavedSnapshot: (result: TResult) => string
}) => {
  let inFlight = false
  let pendingRequest: SaveQueueRequest<TPayload> | null = null
  let waiters: SaveQueueWaiter<TResult>[] = []

  const flushWaiters = () => {
    const currentWaiters = waiters
    waiters = []
    return currentWaiters
  }

  const resolveWaiters = (value: TResult | null) => {
    for (const waiter of flushWaiters()) {
      waiter.resolve(value)
    }
  }

  const rejectWaiters = (error: unknown) => {
    for (const waiter of flushWaiters()) {
      waiter.reject(error)
    }
  }

  const run = async (initialRequest: SaveQueueRequest<TPayload>) => {
    inFlight = true
    try {
      let currentRequest: SaveQueueRequest<TPayload> | null = initialRequest
      while (currentRequest) {
        const saved = await options.persist(currentRequest.payload)
        if (!saved) {
          resolveWaiters(null)
          return null
        }

        const savedSnapshot = options.getSavedSnapshot(saved)
        const nextRequest = pendingRequest
        pendingRequest = null

        if (!nextRequest || nextRequest.snapshot === savedSnapshot) {
          resolveWaiters(saved)
          return saved
        }

        currentRequest = nextRequest
      }

      resolveWaiters(null)
      return null
    } catch (error) {
      rejectWaiters(error)
      throw error
    } finally {
      inFlight = false
      pendingRequest = null
    }
  }

  const save = (request: SaveQueueRequest<TPayload>) => {
    const promise = new Promise<TResult | null>((resolve, reject) => {
      waiters.push({ resolve, reject })
    })

    if (inFlight) {
      pendingRequest = request
      return promise
    }

    void run(request)
    return promise
  }

  const queueLatestIfRunning = (request: SaveQueueRequest<TPayload>) => {
    if (!inFlight) return false
    pendingRequest = request
    return true
  }

  return {
    save,
    queueLatestIfRunning,
  }
}
