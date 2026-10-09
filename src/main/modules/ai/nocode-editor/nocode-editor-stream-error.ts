import type {
  NocodeEditorStreamErrorKind,
  NocodeEditorStreamErrorMetadata,
} from '../ai.types'
import { AiProviderOutputLimitError } from '../openai/ai-provider-output-policy'
import { AiProviderStreamTimeoutError } from '../openai/ai-provider-stream-lifecycle'

const toErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
)

export const resolveNocodeEditorStreamErrorKind = (
  error: unknown,
): NocodeEditorStreamErrorKind => {
  const message = toErrorMessage(error).trim().toLowerCase()
  if (/(\b413\b|payload too large|request entity too large)/.test(message)) {
    return 'payload_too_large'
  }
  if (error instanceof AiProviderStreamTimeoutError || /timeout|timed out/.test(message)) {
    return 'provider_timeout'
  }
  if (
    error instanceof AiProviderOutputLimitError
    || /backend buffer overflow|buffer overflow/.test(message)
  ) {
    return 'provider_output_overflow'
  }
  return 'stream_error'
}

export const shouldRetryNocodeEditorFirstEventTimeout = (options: {
  error: unknown
  retryCount: number
  hasRoundOutput: boolean
  aborted: boolean
}) => (
  options.error instanceof AiProviderStreamTimeoutError
  && options.error.phase === 'first_event'
  && options.retryCount < 1
  && !options.hasRoundOutput
  && !options.aborted
)

export const resolveNocodeEditorStreamErrorUserMessage = (
  errorKind: NocodeEditorStreamErrorKind,
) => {
  if (errorKind === 'payload_too_large') {
    return global.i18next.t('nocodeEditorStreamError.payloadTooLarge')
  }
  if (errorKind === 'provider_timeout') {
    return global.i18next.t('nocodeEditorStreamError.providerTimeout')
  }
  if (errorKind === 'provider_output_overflow') {
    return global.i18next.t('nocodeEditorStreamError.providerOutputOverflow')
  }
  return global.i18next.t('nocodeEditorStreamError.streamError')
}

export const normalizeNocodeEditorStreamError = (options: {
  error: unknown
  traceId?: string
  userMessagePersisted: boolean
}) => {
  const errorKind = resolveNocodeEditorStreamErrorKind(options.error)
  const timeoutError = options.error instanceof AiProviderStreamTimeoutError
    ? options.error
    : null
  const retryable = errorKind !== 'payload_too_large'
  const recoveryAction = (
    retryable
    && options.userMessagePersisted
    && options.traceId
    && (
      errorKind === 'provider_timeout'
      || errorKind === 'provider_output_overflow'
    )
  )
    ? 'continue_generation'
    : undefined
  const metadata: NocodeEditorStreamErrorMetadata = {
    scene: 'nocode-editor',
    traceId: options.traceId || undefined,
    persistedError: true,
    errorKind,
    retryable,
    userMessagePersisted: options.userMessagePersisted,
    recoveryAction,
    timeoutPhase: timeoutError?.phase,
    timeoutMs: timeoutError?.timeoutMs,
  }

  return {
    userMessage: resolveNocodeEditorStreamErrorUserMessage(errorKind),
    metadata,
    diagnostic: options.error instanceof Error
      ? `${options.error.message}\n${options.error.stack || ''}`.trim()
      : String(options.error || ''),
  }
}
