import type { AiReasoningMode } from '../ai.types'

export type ProviderRequiredToolChoicePolicyInput = {
  requested: boolean
  supportsRequiredToolChoice: boolean
  reasoningMode?: AiReasoningMode
  rejectedByProvider?: boolean
}

export const buildProviderToolChoiceModelKey = (input: {
  providerId?: string | null
  modelId?: string | null
  model?: string | null
}) => {
  const providerId = String(input.providerId || '').trim()
  const model = String(input.modelId || input.model || '').trim()
  return providerId && model ? `${providerId}|${model}` : ''
}

export type ProviderRequiredToolChoiceFallbackReason =
  | ''
  | 'not_requested'
  | 'capability_unverified'
  | 'builtin_route'
  | 'provider_rejected'

// 回退原因单独返回：调用方需要按原因区分日志级别，能力未验证必须能被告警发现。
export const resolveProviderRequiredToolChoiceDecision = (
  input: ProviderRequiredToolChoicePolicyInput,
): {
  toolChoice: 'required' | 'auto'
  fallbackReason: ProviderRequiredToolChoiceFallbackReason
} => {
  if (!input.requested) {
    return { toolChoice: 'auto', fallbackReason: 'not_requested' }
  }
  if (!input.supportsRequiredToolChoice) {
    return { toolChoice: 'auto', fallbackReason: 'capability_unverified' }
  }
  // 网关托管推理（builtin-route）由服务端决定是否进入思考模式，这些模型会以 400
  // 拒绝 tool_choice=required/object；必须在请求前回退到 auto，而不是先失败一次。
  if (input.reasoningMode === 'builtin-route') {
    return { toolChoice: 'auto', fallbackReason: 'builtin_route' }
  }
  if (input.rejectedByProvider) {
    return { toolChoice: 'auto', fallbackReason: 'provider_rejected' }
  }
  return { toolChoice: 'required', fallbackReason: '' }
}

export const shouldUseProviderRequiredToolChoice = (
  input: ProviderRequiredToolChoicePolicyInput,
) => resolveProviderRequiredToolChoiceDecision(input).toolChoice === 'required'
