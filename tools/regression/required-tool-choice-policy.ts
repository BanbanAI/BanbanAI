import assert from 'node:assert/strict'

import {
  buildProviderToolChoiceModelKey,
  resolveProviderRequiredToolChoiceDecision,
  shouldUseProviderRequiredToolChoice,
} from '../../src/main/modules/ai/openai/ai-provider-tool-choice'

// 三种回退必须可区分，调用方才能把“能力未验证”升级为 warn。
assert.equal(resolveProviderRequiredToolChoiceDecision({
  requested: false,
  supportsRequiredToolChoice: true,
}).fallbackReason, 'not_requested')
assert.equal(resolveProviderRequiredToolChoiceDecision({
  requested: true,
  supportsRequiredToolChoice: false,
}).fallbackReason, 'capability_unverified')
assert.equal(resolveProviderRequiredToolChoiceDecision({
  requested: true,
  supportsRequiredToolChoice: true,
  reasoningMode: 'builtin-route',
}).fallbackReason, 'builtin_route')
assert.equal(resolveProviderRequiredToolChoiceDecision({
  requested: true,
  supportsRequiredToolChoice: true,
  rejectedByProvider: true,
}).fallbackReason, 'provider_rejected')
assert.deepEqual(resolveProviderRequiredToolChoiceDecision({
  requested: true,
  supportsRequiredToolChoice: true,
}), { toolChoice: 'required', fallbackReason: '' })

assert.equal(shouldUseProviderRequiredToolChoice({
  requested: false,
  supportsRequiredToolChoice: true,
}), false)

assert.equal(shouldUseProviderRequiredToolChoice({
  requested: true,
  supportsRequiredToolChoice: false,
}), false)

// 网关托管推理（思考模式）会以 400 拒绝 required，必须在请求前回退。
assert.equal(shouldUseProviderRequiredToolChoice({
  requested: true,
  supportsRequiredToolChoice: true,
  reasoningMode: 'builtin-route',
}), false)

// 运行时已经被 400 拒绝过的模型不再重复尝试。
assert.equal(shouldUseProviderRequiredToolChoice({
  requested: true,
  supportsRequiredToolChoice: true,
  reasoningMode: 'provider-default',
  rejectedByProvider: true,
}), false)

assert.equal(shouldUseProviderRequiredToolChoice({
  requested: true,
  supportsRequiredToolChoice: true,
  reasoningMode: 'provider-default',
  rejectedByProvider: false,
}), true)

assert.equal(buildProviderToolChoiceModelKey({
  providerId: 'banbanai',
  modelId: 'qwen3.7-plus',
}), 'banbanai|qwen3.7-plus')
assert.equal(buildProviderToolChoiceModelKey({
  providerId: 'banbanai',
  model: 'qwen3.7-plus',
}), 'banbanai|qwen3.7-plus')
assert.equal(buildProviderToolChoiceModelKey({ modelId: 'qwen3.7-plus' }), '')

console.log('required-tool-choice-policy: ok')
