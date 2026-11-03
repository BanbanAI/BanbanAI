export type AiProviderChunkActivity = {
  hasText: boolean
  hasReasoning: boolean
  hasToolArguments: boolean
  meaningful: boolean
  alive: boolean
}

export type AiProviderChunkLike = {
  content?: unknown
  additional_kwargs?: Record<string, unknown> | null
  usage_metadata?: unknown
  response_metadata?: Record<string, unknown> | null
  tool_call_chunks?: Array<{ args?: unknown }> | null
  invalid_tool_call_chunks?: Array<{ args?: unknown }> | null
}

const hasTextValue = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0
)

const hasReasoningValue = (value: unknown): boolean => {
  if (hasTextValue(value)) {
    return true
  }
  if (Array.isArray(value)) {
    return value.some(item => (
      hasTextValue(item)
      || Boolean(item && typeof item === 'object' && hasTextValue((item as { text?: unknown }).text))
    ))
  }
  return Boolean(
    value
    && typeof value === 'object'
    && hasTextValue((value as { text?: unknown }).text),
  )
}

const hasToolArgumentDelta = (chunk: AiProviderChunkLike) => {
  const streamedToolCalls = Array.isArray(chunk.tool_call_chunks)
    ? chunk.tool_call_chunks
    : null
  const streamedInvalidToolCalls = Array.isArray(chunk.invalid_tool_call_chunks)
    ? chunk.invalid_tool_call_chunks
    : null
  if (streamedToolCalls || streamedInvalidToolCalls) {
    return [...(streamedToolCalls || []), ...(streamedInvalidToolCalls || [])]
      .some(item => typeof item?.args === 'string' && item.args.length > 0)
  }

  const additionalToolCalls = chunk.additional_kwargs?.tool_calls
  if (!Array.isArray(additionalToolCalls)) {
    return false
  }
  return additionalToolCalls.some((item) => {
    const fn = item && typeof item === 'object'
      ? (item as { function?: { arguments?: unknown } }).function
      : null
    return typeof fn?.arguments === 'string' && fn.arguments.length > 0
  })
}

const hasTokenUsage = (chunk: AiProviderChunkLike) => {
  const usageMetadata = chunk.usage_metadata
  if (usageMetadata && typeof usageMetadata === 'object') {
    const usageRecord = usageMetadata as Record<string, unknown>
    return ['input_tokens', 'output_tokens', 'total_tokens'].some(key => (
      Number(usageRecord[key]) > 0
    ))
  }
  const additionalUsage = chunk.additional_kwargs?.usage
  if (additionalUsage && typeof additionalUsage === 'object') {
    return true
  }
  const responseMetadata = chunk.response_metadata || {}
  const usage = responseMetadata.tokenUsage ?? responseMetadata.usage
  return Boolean(usage && typeof usage === 'object')
}

// meaningful 表示上游有实质进展；alive 服务于超时判定。
// 纯思考帧在 delta 转换后 content 为空，但仍是上游活着的证据；
// 只有纯 usage 收尾帧不具备活性，不能让最后一帧重置 idle。
export const resolveAiProviderChunkActivity = (input: {
  chunk: AiProviderChunkLike
  text: string
}): AiProviderChunkActivity => {
  const hasText = input.text.trim().length > 0
  const additionalKwargs = input.chunk.additional_kwargs || {}
  const hasReasoning = hasReasoningValue(
    additionalKwargs.reasoning_content ?? additionalKwargs.reasoning,
  )
  const hasToolArguments = hasToolArgumentDelta(input.chunk)
  const meaningful = hasText || hasReasoning || hasToolArguments
  return {
    hasText,
    hasReasoning,
    hasToolArguments,
    meaningful,
    alive: meaningful || !hasTokenUsage(input.chunk),
  }
}
