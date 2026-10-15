export const NOCODE_EDITOR_MAX_OUTPUT_TOKENS = 32_768
export const NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS = 16_384
export const WORKBENCH_DEFAULT_OUTPUT_TOKENS = 8_192
export const AI_SCENE_HARD_OUTPUT_LIMIT = 32_768

export class AiProviderOutputLimitError extends Error {
  readonly code = 'AI_PROVIDER_OUTPUT_LIMIT'

  constructor(
    readonly finishReason: string,
    readonly invalidToolCallCount: number,
    readonly rawToolCallCount: number,
    readonly parsedToolCallCount: number,
  ) {
    super('模型输出达到长度限制，工具参数不完整，已停止执行。')
    this.name = 'AiProviderOutputLimitError'
  }
}

const isNocodeEditorScene = (scene: unknown) => ['nocode-editor', 'editor'].includes(String(scene || '').trim())

const normalizeTokenLimit = (value: unknown) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue) || numericValue <= 0) {
    return null
  }
  return numericValue
}

export const resolveOutputLimitModelKwargs = (options: {
  scene?: unknown
  modelKwargs?: Record<string, unknown>
  maxOutputTokens?: number | null
  contextWindow?: number | null
  workbenchDefaultOutputTokens?: number | null
  editorDefaultOutputTokens?: number | null
}) => {
  const nextModelKwargs = options.modelKwargs ? { ...options.modelKwargs } : {}
  const completionLimit = normalizeTokenLimit(nextModelKwargs.max_completion_tokens)
  const legacyLimit = normalizeTokenLimit(nextModelKwargs.max_tokens)
  const preferredKey = completionLimit !== null || (
    Object.prototype.hasOwnProperty.call(nextModelKwargs, 'max_completion_tokens') && legacyLimit === null
  )
    ? 'max_completion_tokens'
    : 'max_tokens'
  const sceneDefault = isNocodeEditorScene(options.scene)
    ? (normalizeTokenLimit(options.editorDefaultOutputTokens) || NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)
    : (normalizeTokenLimit(options.workbenchDefaultOutputTokens) || WORKBENCH_DEFAULT_OUTPUT_TOKENS)
  const explicitLimit = preferredKey === 'max_completion_tokens'
    ? (completionLimit ?? legacyLimit)
    : (legacyLimit ?? completionLimit)
  const capabilityLimit = normalizeTokenLimit(options.maxOutputTokens)
  const contextWindow = normalizeTokenLimit(options.contextWindow)
  const hardLimit = Math.min(
    AI_SCENE_HARD_OUTPUT_LIMIT,
    capabilityLimit || Number.POSITIVE_INFINITY,
    contextWindow ? Math.max(1, contextWindow - 1) : Number.POSITIVE_INFINITY,
  )
  const effectiveOutputTokens = Math.min(explicitLimit || sceneDefault, hardLimit)
  delete nextModelKwargs[preferredKey === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens']
  nextModelKwargs[preferredKey] = effectiveOutputTokens
  return { modelKwargs: nextModelKwargs, effectiveOutputTokens }
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
    ? NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS
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
