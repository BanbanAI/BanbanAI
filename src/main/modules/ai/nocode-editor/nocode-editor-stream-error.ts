import type {
  NocodeEditorStreamErrorKind,
  NocodeEditorStreamErrorMetadata,
} from '../ai.types'
import { AiProviderOutputLimitError } from '../openai/ai-provider-output-policy'
import { AiProviderStreamTimeoutError } from '../openai/ai-provider-stream-lifecycle'
import { AiRuntimeUserActionableError } from '../errors/ai-runtime-error'

const toErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
)

export const resolveNocodeEditorStreamErrorKind = (
  error: unknown,
): NocodeEditorStreamErrorKind => {
  const message = toErrorMessage(error).trim().toLowerCase()
  if (
    error instanceof AiRuntimeUserActionableError
    && error.code === 'AI_CONTEXT_WINDOW_EXCEEDED'
  ) {
    return 'context_window_exceeded'
  }
  if (
    error instanceof AiRuntimeUserActionableError
    && error.code === 'AI_PROVIDER_REQUEST_BODY_TOO_LARGE'
  ) {
    return 'payload_too_large'
  }
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

export type NocodeEditorProviderRoundRetryReason =
  | 'first_event_timeout'
  | 'total_timeout_compact'
  | 'none'

export type NocodeEditorProviderRoundRetryDecision = {
  retry: boolean
  forceCompact: boolean
  reason: NocodeEditorProviderRoundRetryReason
}

export const resolveNocodeEditorProviderRoundRetryDecision = (options: {
  error: unknown
  retryCount: number
  hasRoundOutput: boolean
  hasRoundToolCall: boolean
  aborted: boolean
}): NocodeEditorProviderRoundRetryDecision => {
  const timeout = options.error instanceof AiProviderStreamTimeoutError
    ? options.error
    : null
  if (options.aborted || options.retryCount >= 1 || !timeout) {
    return { retry: false, forceCompact: false, reason: 'none' }
  }
  if (timeout.phase === 'first_event' && !options.hasRoundOutput) {
    return { retry: true, forceCompact: false, reason: 'first_event_timeout' }
  }
  if (timeout.phase === 'total' && !options.hasRoundToolCall) {
    return { retry: true, forceCompact: true, reason: 'total_timeout_compact' }
  }
  return { retry: false, forceCompact: false, reason: 'none' }
}

export const resolveNocodeEditorStreamErrorUserMessage = (
  errorKind: NocodeEditorStreamErrorKind,
) => {
  if (errorKind === 'payload_too_large') {
    return global.i18next.t('nocodeEditorStreamError.payloadTooLarge')
  }
  if (errorKind === 'context_window_exceeded') {
    return global.i18next.t('nocodeEditorStreamError.contextWindowExceeded')
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
  const retryable = errorKind === 'provider_timeout' || errorKind === 'provider_output_overflow'
  const recoveryAction = !retryable && (
    errorKind === 'payload_too_large' || errorKind === 'context_window_exceeded'
  )
    ? 'compact_context'
    : retryable && options.userMessagePersisted && options.traceId
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
    ...(options.error instanceof AiRuntimeUserActionableError ? options.error.metadata : {}),
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
