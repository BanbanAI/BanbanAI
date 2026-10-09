export const NOCODE_EDITOR_MAX_OUTPUT_TOKENS = 16_384

export class AiProviderOutputLimitError extends Error {
  readonly code = 'AI_PROVIDER_OUTPUT_LIMIT'

  constructor(
    readonly finishReason: string,
    readonly invalidToolCallCount: number,
    readonly rawToolCallCount: number,
    readonly parsedToolCallCount: number,
  ) {
    super('AI provider output limit reached before tool calls completed')
    this.name = 'AiProviderOutputLimitError'
  }
}

const isNocodeEditorScene = (scene: unknown) => String(scene || '').trim() === 'nocode-editor'

const normalizeTokenLimit = (value: unknown) => {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }
  return numericValue
}

export const applyNocodeEditorOutputLimit = (options: {
  scene?: unknown
  modelKwargs?: Record<string, unknown>
}) => {
  const clonedModelKwargs = options.modelKwargs
    ? { ...options.modelKwargs }
    : undefined

  if (!isNocodeEditorScene(options.scene)) {
    return clonedModelKwargs
  }

  const nextModelKwargs: Record<string, unknown> = clonedModelKwargs
    ? { ...clonedModelKwargs }
    : {}
  const preferredKey = Object.prototype.hasOwnProperty.call(nextModelKwargs, 'max_completion_tokens')
    ? 'max_completion_tokens'
    : 'max_tokens'
  const currentLimit = normalizeTokenLimit(nextModelKwargs[preferredKey])
  nextModelKwargs[preferredKey] = currentLimit === null
    ? NOCODE_EDITOR_MAX_OUTPUT_TOKENS
    : Math.min(currentLimit, NOCODE_EDITOR_MAX_OUTPUT_TOKENS)
  return nextModelKwargs
}

export const throwIfIncompleteToolOutputAtLimit = (options: {
  scene?: unknown
  finishReason?: unknown
  invalidToolCallCount: number
  rawToolCalls: unknown[]
  parsedToolCallCount: number
}) => {
  if (!isNocodeEditorScene(options.scene)) {
    return
  }

  const finishReason = String(options.finishReason || '').trim().toLowerCase()
  if (finishReason !== 'length') {
    return
  }

  const invalidToolCallCount = Math.max(0, Math.round(Number(options.invalidToolCallCount || 0)))
  const rawToolCallCount = Array.isArray(options.rawToolCalls)
    ? options.rawToolCalls.length
    : 0
  const parsedToolCallCount = Math.max(0, Math.round(Number(options.parsedToolCallCount || 0)))
  const hasIncompleteToolOutput = (
    invalidToolCallCount > 0
    || rawToolCallCount > parsedToolCallCount
  )

  if (!hasIncompleteToolOutput) {
    return
  }

  throw new AiProviderOutputLimitError(
    finishReason,
    invalidToolCallCount,
    rawToolCallCount,
    parsedToolCallCount,
  )
}
