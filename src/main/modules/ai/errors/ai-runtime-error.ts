export const AI_RUNTIME_USER_ACTIONABLE_ERROR_CODES = [
  'AI_CONFIG_DISABLED',
  'AI_MODEL_UNAVAILABLE',
  'AI_MODEL_SELECTION_INVALID',
  'AI_PROVIDER_NOT_FOUND',
  'AI_MODEL_NOT_FOUND',
  'AI_RUNTIME_PURPOSE_UNAVAILABLE',
  'AI_PROVIDER_BASE_URL_MISSING',
  'AI_PROVIDER_API_KEY_MISSING',
  'AI_PROVIDER_AUTH_FAILED',
  'AI_PROVIDER_ACCESS_FORBIDDEN',
  'AI_STRUCTURED_JSON_INVALID',
  'AI_CONTEXT_WINDOW_EXCEEDED',
] as const

export type AiRuntimeUserActionableErrorCode = typeof AI_RUNTIME_USER_ACTIONABLE_ERROR_CODES[number]
export type AiRuntimeUserActionableErrorCategory = 'configuration' | 'selection' | 'permission' | 'runtime'

const AI_RUNTIME_USER_ACTIONABLE_ERROR_CODE_SET = new Set<string>(
  AI_RUNTIME_USER_ACTIONABLE_ERROR_CODES,
)

export class AiRuntimeUserActionableError extends Error {
  readonly code: AiRuntimeUserActionableErrorCode
  readonly category: AiRuntimeUserActionableErrorCategory

  constructor(
    code: AiRuntimeUserActionableErrorCode,
    message: string,
    category: AiRuntimeUserActionableErrorCategory,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'AiRuntimeUserActionableError'
    this.code = code
    this.category = category
    if (cause !== undefined) {
      Object.assign(this, { cause })
    }
  }
}

export function isAiRuntimeUserActionableError(error: unknown) {
  if (error instanceof AiRuntimeUserActionableError) {
    return true
  }

  const code = String((error as { code?: unknown } | null | undefined)?.code || '').trim()
  return AI_RUNTIME_USER_ACTIONABLE_ERROR_CODE_SET.has(code)
}
