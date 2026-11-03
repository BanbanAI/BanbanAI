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

export type AiProviderOutputLimitKey = 'max_tokens' | 'max_completion_tokens'

export const resolveOutputLimitModelKwargs = (options: {
  scene?: unknown
  modelKwargs?: Record<string, unknown>
  maxOutputTokens?: number | null
  contextWindow?: number | null
  workbenchDefaultOutputTokens?: number | null
  editorDefaultOutputTokens?: number | null
}) => {
  const sourceModelKwargs = options.modelKwargs || {}
  const nextModelKwargs = { ...sourceModelKwargs }
  const completionLimit = normalizeTokenLimit(sourceModelKwargs.max_completion_tokens)
  const legacyLimit = normalizeTokenLimit(sourceModelKwargs.max_tokens)
  // 兼容网关只认 max_completion_tokens：配置里显式给出该键时保留它，不再改写成 max_tokens。
  const preferredLimitKey: AiProviderOutputLimitKey = completionLimit !== null
    ? 'max_completion_tokens'
    : 'max_tokens'
  const explicitLimit = preferredLimitKey === 'max_completion_tokens'
    ? completionLimit
    : (legacyLimit ?? completionLimit)
  const capabilityLimit = normalizeTokenLimit(options.maxOutputTokens)
  const contextWindow = normalizeTokenLimit(options.contextWindow)
  const hardLimit = Math.min(
    AI_SCENE_HARD_OUTPUT_LIMIT,
    capabilityLimit || Number.POSITIVE_INFINITY,
    contextWindow ? Math.max(1, contextWindow - 1) : Number.POSITIVE_INFINITY,
  )
  const sceneDefault = isNocodeEditorScene(options.scene)
    ? (normalizeTokenLimit(options.editorDefaultOutputTokens) || NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)
    : normalizeTokenLimit(options.workbenchDefaultOutputTokens)
  const requestedLimit = explicitLimit ?? sceneDefault
  // 非 nocode 场景不再默认压到 8192：没有显式上限时不带输出上限，预算估算仍按 8192 兜底。
  const effectiveOutputTokens = requestedLimit === null
    ? null
    : Math.min(requestedLimit, hardLimit)
  // 上限键统一从 modelKwargs 剥离，交给 buildChatModelOutputOptions 输出唯一来源。
  delete nextModelKwargs.max_tokens
  delete nextModelKwargs.max_completion_tokens
  return { modelKwargs: nextModelKwargs, effectiveOutputTokens, preferredLimitKey }
}

// ChatOpenAI 的 invocationParams 会在展开 modelKwargs 后用 this.maxTokens 覆盖 max_tokens /
// max_completion_tokens，所以上限只能有一个来源：要么传 maxTokens，要么保留网关要求的键并省略 maxTokens。
export const buildChatModelOutputOptions = (options: {
  modelKwargs?: Record<string, unknown>
  effectiveOutputTokens?: number | null
  preferredLimitKey?: AiProviderOutputLimitKey
}) => {
  const {
    max_tokens: _legacyLimit,
    max_completion_tokens: _completionLimit,
    ...restModelKwargs
  } = options.modelKwargs || {}
  const modelKwargs = options.modelKwargs ? restModelKwargs : undefined
  const effectiveOutputTokens = normalizeTokenLimit(options.effectiveOutputTokens)
  if (options.preferredLimitKey === 'max_completion_tokens' && effectiveOutputTokens !== null) {
    return {
      modelKwargs: {
        ...(modelKwargs || {}),
        max_completion_tokens: effectiveOutputTokens,
      },
    }
  }
  return {
    ...(modelKwargs ? { modelKwargs } : {}),
    ...(effectiveOutputTokens !== null ? { maxTokens: effectiveOutputTokens } : {}),
  }
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
