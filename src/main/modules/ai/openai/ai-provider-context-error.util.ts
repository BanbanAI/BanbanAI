export type AiProviderContextErrorKind = 'token' | 'body' | 'none'

type ErrorRecord = Record<string, unknown>

const getRecord = (value: unknown): ErrorRecord => (
  value && typeof value === 'object' ? value as ErrorRecord : {}
)

export const classifyAiProviderContextError = (error: unknown): AiProviderContextErrorKind => {
  const root = getRecord(error)
  const response = getRecord(root.response)
  const responseData = getRecord(response.data)
  const payload = getRecord(root.error || responseData.error || response.data)
  const status = Number(root.status || root.statusCode || response.status || 0)
  const codes = [root.code, payload.code, payload.type]
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean)
  const code = codes.join(' ')
  const message = [root.message, payload.message, payload.param]
    .map(value => String(value || ''))
    .join(' ')
    .toLowerCase()

  if ([401, 403, 429].includes(status)) {
    return 'none'
  }
  if (codes.includes('ai_provider_request_body_too_large')) {
    return 'body'
  }
  if (codes.includes('ai_context_window_exceeded')) {
    return 'token'
  }
  if (/context_length_exceeded|maximum_context_length|token_limit_exceeded|prompt_too_long/.test(code)) {
    return 'token'
  }
  if (/context.{0,24}(window|length|limit)|(?:window|length|limit).{0,24}context|input tokens?|prompt.{0,20}too long|maximum context/.test(message)) {
    return 'token'
  }
  if (status === 413 || /payload_too_large|request_entity_too_large|content_length_exceeded/.test(code)) {
    return 'body'
  }
  if (/payload.{0,20}too large|request.{0,20}(body|entity).{0,20}(large|size)|body.{0,20}(too large|exceed)/.test(message)) {
    return 'body'
  }
  return 'none'
}
