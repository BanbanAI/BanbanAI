import type {
  NocodeEditorAiChatStreamPayload,
  NocodeEditorAiMessage,
  NocodeEditorAiStreamErrorKind,
  NocodeEditorAiStreamErrorMetadata,
} from './types'

export type SubmitMessageResult =
  | 'not_started'
  | 'completed'
  | 'aborted'
  | 'aborted_after_user_message_persisted'
  | 'failed'
  | 'failed_after_user_message_persisted'

const STREAM_ERROR_FALLBACK_MESSAGE = 'AI 生成失败，请稍后重试。'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeTraceId = (value: unknown) => String(value || '').trim() || undefined

export const isUserMessageCommitAck = (metadata: unknown) => (
  Boolean(normalizeTraceId(isRecord(metadata) ? metadata.userMessageId : undefined))
)

export const resolveNocodeEditorStreamErrorRecovery = (
  payload: Pick<NocodeEditorAiChatStreamPayload, 'error' | 'metadata'>,
) => {
  const rawMetadata = isRecord(payload.metadata) ? payload.metadata : {}
  const metadata: NocodeEditorAiStreamErrorMetadata = {
    traceId: normalizeTraceId(rawMetadata.traceId),
    errorKind: (
      rawMetadata.errorKind === 'payload_too_large'
      || rawMetadata.errorKind === 'provider_timeout'
      || rawMetadata.errorKind === 'provider_output_overflow'
      || rawMetadata.errorKind === 'stream_error'
    )
      ? rawMetadata.errorKind as NocodeEditorAiStreamErrorKind
      : undefined,
    retryable: rawMetadata.retryable === true,
    userMessagePersisted: rawMetadata.userMessagePersisted === true,
    recoveryAction: rawMetadata.recoveryAction === 'continue_generation'
      ? 'continue_generation'
      : undefined,
    timeoutPhase: (
      rawMetadata.timeoutPhase === 'first_event'
      || rawMetadata.timeoutPhase === 'idle'
      || rawMetadata.timeoutPhase === 'total'
    )
      ? rawMetadata.timeoutPhase
      : undefined,
    timeoutMs: Number.isFinite(Number(rawMetadata.timeoutMs))
      ? Number(rawMetadata.timeoutMs)
      : undefined,
  }
  const userMessage = (
    metadata.errorKind
      ? String(payload.error || '').trim() || STREAM_ERROR_FALLBACK_MESSAGE
      : STREAM_ERROR_FALLBACK_MESSAGE
  )

  return {
    userMessage,
    metadata,
    canContinueGeneration: Boolean(
      metadata.retryable
      && metadata.recoveryAction === 'continue_generation'
      && metadata.traceId,
    ),
  }
}

export const resolveSubmitFailureResult = (options: {
  userMessagePersisted: boolean
  aborted: boolean
}): SubmitMessageResult => {
  if (options.aborted) {
    return options.userMessagePersisted
      ? 'aborted_after_user_message_persisted'
      : 'aborted'
  }
  return options.userMessagePersisted
    ? 'failed_after_user_message_persisted'
    : 'failed'
}

export const shouldKeepCommittedConfirmation = (result: SubmitMessageResult) => (
  result === 'aborted_after_user_message_persisted'
  || result === 'failed_after_user_message_persisted'
)

export const resolveMessageTraceId = (message?: NocodeEditorAiMessage | null) => (
  normalizeTraceId(message?.traceId || message?.metadata?.traceId)
)

export const buildContinueGenerationRequest = (options: {
  retryOfTraceId?: string
  errorKind?: NocodeEditorAiStreamErrorKind
}) => ({
  userFacingContent: '继续生成',
  providerPromptContent: '请基于这次对话里已经确认并已保存的信息继续生成，不要重复询问或重复提交确认。',
  requestMetadata: {
    recoveryAction: 'continue_generation' as const,
    retryOfTraceId: normalizeTraceId(options.retryOfTraceId),
    previousErrorKind: options.errorKind,
  },
})
