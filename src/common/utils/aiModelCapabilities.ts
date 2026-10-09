export const AI_MODEL_CAPABILITIES = {
  FUNCTION_CALL: 'function-call',
  REASONING: 'reasoning',
  IMAGE_RECOGNITION: 'image-recognition',
  IMAGE_GENERATION: 'image-generation',
  AUDIO_RECOGNITION: 'audio-recognition',
  AUDIO_GENERATION: 'audio-generation',
  AUDIO_TRANSCRIPT: 'audio-transcript',
  VIDEO_RECOGNITION: 'video-recognition',
  VIDEO_GENERATION: 'video-generation',
  STRUCTURED_OUTPUT: 'structured-output',
  FILE_INPUT: 'file-input',
  WEB_SEARCH: 'web-search',
  RERANK: 'rerank',
  EMBEDDING: 'embedding',
  CODE_EXECUTION: 'code-execution',
  FILE_SEARCH: 'file-search',
  COMPUTER_USE: 'computer-use',
} as const

export type AiModelCapability = typeof AI_MODEL_CAPABILITIES[keyof typeof AI_MODEL_CAPABILITIES]

export const AI_MODEL_MODALITIES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  VECTOR: 'vector',
} as const

export type AiModelModality = typeof AI_MODEL_MODALITIES[keyof typeof AI_MODEL_MODALITIES]

export const AI_MODEL_ENDPOINT_TYPES = {
  OPENAI_CHAT_COMPLETIONS: 'openai-chat-completions',
  OPENAI_RESPONSES: 'openai-responses',
  OLLAMA_CHAT: 'ollama-chat',
} as const

export type AiModelEndpointType = typeof AI_MODEL_ENDPOINT_TYPES[keyof typeof AI_MODEL_ENDPOINT_TYPES]

export type AiModelCapabilityFields = {
  capabilities: AiModelCapability[]
  inputModalities: AiModelModality[]
  outputModalities: AiModelModality[]
  endpointTypes: AiModelEndpointType[]
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  supportsStreaming: boolean
}

const capabilityValues = new Set<string>(Object.values(AI_MODEL_CAPABILITIES))
const modalityValues = new Set<string>(Object.values(AI_MODEL_MODALITIES))
const endpointTypeValues = new Set<string>(Object.values(AI_MODEL_ENDPOINT_TYPES))

export const normalizeAiModelCapabilities = (value: unknown): AiModelCapability[] => (
  Array.isArray(value)
    ? [...new Set(value.map(item => String(item || '').trim()).filter(item => capabilityValues.has(item)))] as AiModelCapability[]
    : []
)

export const normalizeAiModelModalities = (value: unknown, fallback: AiModelModality[] = ['text']): AiModelModality[] => {
  const normalized = Array.isArray(value)
    ? [...new Set(value.map(item => String(item || '').trim()).filter(item => modalityValues.has(item)))] as AiModelModality[]
    : []
  return normalized.length ? normalized : [...fallback]
}

export const normalizeAiModelEndpointTypes = (
  value: unknown,
  fallback: AiModelEndpointType[] = [AI_MODEL_ENDPOINT_TYPES.OPENAI_CHAT_COMPLETIONS],
): AiModelEndpointType[] => {
  const normalized = Array.isArray(value)
    ? [...new Set(value.map(item => String(item || '').trim()).filter(item => endpointTypeValues.has(item)))] as AiModelEndpointType[]
    : []
  return normalized.length ? normalized : [...fallback]
}

export const aiModelSupportsImageInput = (model?: Partial<AiModelCapabilityFields> | null) => (
  normalizeAiModelCapabilities(model?.capabilities).includes(AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION)
  && normalizeAiModelModalities(model?.inputModalities).includes(AI_MODEL_MODALITIES.IMAGE)
)

export const aiModelSupportsOpenAiArrayContent = (model?: Partial<AiModelCapabilityFields> | null) => (
  normalizeAiModelEndpointTypes(model?.endpointTypes).includes(AI_MODEL_ENDPOINT_TYPES.OPENAI_CHAT_COMPLETIONS)
)

const withImageInput = (capabilities: AiModelCapability[] = []): AiModelCapabilityFields => ({
  capabilities: [...new Set([...capabilities, AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION])],
  inputModalities: [AI_MODEL_MODALITIES.TEXT, AI_MODEL_MODALITIES.IMAGE],
  outputModalities: [AI_MODEL_MODALITIES.TEXT],
  endpointTypes: [AI_MODEL_ENDPOINT_TYPES.OPENAI_CHAT_COMPLETIONS],
  supportsStreaming: true,
})

/**
 * Small local registry for models commonly exposed through OpenAI-compatible
 * gateways. Unknown models remain text-only until a provider catalog declares more.
 */
export const resolveKnownAiModelCapabilities = (modelId: unknown): Partial<AiModelCapabilityFields> | null => {
  const model = String(modelId || '').trim().toLowerCase()
  if (!model) return null

  if (
    /(?:^|[/-])(?:gpt-4o(?:-mini)?|gpt-4\.1(?:-mini|-nano)?|gpt-4\.5(?:-preview)?|gpt-5(?:[.-][\w.-]+)?|o3(?:-pro)?|o4-mini)(?:$|[:/-])/.test(model)
    || /(?:^|[/-])(?:qwen(?:2|3)?[^/]*[-.]vl|qwen3\.6-plus|gemini-|claude-(?:3|4)|pixtral|mistral-small-3\.1|glm-4v|glm-4\.5v|llama-3\.[23]-vision)/.test(model)
  ) {
    return withImageInput()
  }

  return null
}
