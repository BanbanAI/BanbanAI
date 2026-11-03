import type { AiProviderContextErrorKind } from './ai-provider-context-error.util'

type ContextRecoveryEvent = {
  type?: unknown
  text?: unknown
}

export const isAiContextRecoveryRequested = (metadata?: Record<string, unknown> | null) => (
  Number(metadata?.contextRecoveryAttempt || 0) > 0
  || metadata?.recoveryAction === 'compact_context'
)

export async function* streamWithContextRecovery<
  TRequest extends { metadata?: Record<string, unknown> },
  TEvent extends ContextRecoveryEvent,
>(options: {
  request: TRequest
  stream: (request: TRequest) => AsyncIterable<TEvent>
  classify: (error: unknown) => AiProviderContextErrorKind
  createRecoveryRequest: (request: TRequest, kind: Exclude<AiProviderContextErrorKind, 'none'>) => TRequest
  createExhaustedError: (
    error: unknown,
    kind: Exclude<AiProviderContextErrorKind, 'none'>,
    recoveryAttempt: number,
  ) => Error
}) {
  let providerOutputStarted = false
  try {
    for await (const event of options.stream(options.request)) {
      if (event.type === 'delta' && event.text) providerOutputStarted = true
      yield event
    }
  } catch (error) {
    const kind = options.classify(error)
    const recoveryAttempt = Number(options.request.metadata?.contextRecoveryAttempt || 0)
    if (kind === 'none') throw error
    if (providerOutputStarted || recoveryAttempt > 0) {
      throw options.createExhaustedError(error, kind, recoveryAttempt)
    }

    try {
      const recoveryRequest = options.createRecoveryRequest(options.request, kind)
      for await (const event of options.stream(recoveryRequest)) {
        if (event.type === 'delta' && event.text) providerOutputStarted = true
        yield event
      }
    } catch (retryError) {
      const retryKind = options.classify(retryError)
      if (retryKind === 'none') throw retryError
      throw options.createExhaustedError(retryError, retryKind, 1)
    }
  }
}
