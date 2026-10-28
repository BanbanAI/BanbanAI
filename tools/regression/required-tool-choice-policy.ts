import assert from 'node:assert/strict'

import {
  buildProviderToolChoiceModelKey,
  shouldUseProviderRequiredToolChoice,
} from '../../src/main/modules/ai/openai/ai-provider-tool-choice'

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
