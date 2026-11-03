import assert from 'node:assert/strict'

import { ChatOpenAI } from '@langchain/openai'

import {
  AI_SCENE_HARD_OUTPUT_LIMIT,
  NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS,
  NOCODE_EDITOR_MAX_OUTPUT_TOKENS,
  buildChatModelOutputOptions,
  resolveOutputLimitModelKwargs,
} from '../../src/main/modules/ai/openai/ai-provider-output-policy'

const invocationParamsOf = (model: ChatOpenAI) => model.invocationParams() as Record<string, unknown>

// undefined 键不会进入请求体，过滤后剩下的才是实际下发的上限键。
const invocationLimitKeys = (model: ChatOpenAI) => (
  ['max_tokens', 'max_completion_tokens'].filter(key => invocationParamsOf(model)[key] !== undefined)
)

const createModel = (options: Record<string, unknown>) => new ChatOpenAI({
  apiKey: 'regression-test-key',
  model: 'gpt-4o-mini',
  ...options,
  useResponsesApi: false,
})

// 编辑器场景默认 16,384，且只允许一个上限来源。
const nocodeEditorLimit = resolveOutputLimitModelKwargs({ scene: 'nocode-editor' })
assert.equal(nocodeEditorLimit.effectiveOutputTokens, NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)
assert.equal(nocodeEditorLimit.preferredLimitKey, 'max_tokens')
assert.deepEqual(nocodeEditorLimit.modelKwargs, {})

const nocodeEditorOptions = buildChatModelOutputOptions(nocodeEditorLimit)
assert.equal(nocodeEditorOptions.maxTokens, NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)
assert.equal(nocodeEditorOptions.modelKwargs?.max_tokens, undefined)
assert.equal(nocodeEditorOptions.modelKwargs?.max_completion_tokens, undefined)

const nocodeEditorModel = createModel(nocodeEditorOptions)
assert.deepEqual(invocationLimitKeys(nocodeEditorModel), ['max_tokens'])
assert.equal(invocationParamsOf(nocodeEditorModel).max_tokens, NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)

// 非 nocode 场景没有显式配置时不再默认压到 8192，而是不带输出上限。
const workbenchLimit = resolveOutputLimitModelKwargs({ scene: 'workbench' })
assert.equal(workbenchLimit.effectiveOutputTokens, null)
assert.equal(workbenchLimit.preferredLimitKey, 'max_tokens')

const workbenchOptions = buildChatModelOutputOptions(workbenchLimit)
assert.equal(workbenchOptions.maxTokens, undefined)
const workbenchModel = createModel(workbenchOptions)
assert.deepEqual(invocationLimitKeys(workbenchModel), [])

// 显式配置的 workbench 默认值仍然生效。
const configuredWorkbenchLimit = resolveOutputLimitModelKwargs({
  scene: 'workbench',
  workbenchDefaultOutputTokens: 4_096,
})
assert.equal(configuredWorkbenchLimit.effectiveOutputTokens, 4_096)

// 显式上限超过场景硬上限时收敛；其它 modelKwargs 原样保留。
const oversizedLimit = resolveOutputLimitModelKwargs({
  scene: 'nocode-editor',
  modelKwargs: {
    max_tokens: NOCODE_EDITOR_MAX_OUTPUT_TOKENS * 4,
    reasoning_effort: 'high',
  },
})
assert.equal(oversizedLimit.effectiveOutputTokens, AI_SCENE_HARD_OUTPUT_LIMIT)
assert.equal(oversizedLimit.preferredLimitKey, 'max_tokens')
assert.deepEqual(oversizedLimit.modelKwargs, { reasoning_effort: 'high' })

// context window 仍是硬上限。
const contextLimited = resolveOutputLimitModelKwargs({
  scene: 'nocode-editor',
  modelKwargs: { max_tokens: AI_SCENE_HARD_OUTPUT_LIMIT },
  contextWindow: 8_000,
})
assert.equal(contextLimited.effectiveOutputTokens, 7_999)

// 兼容网关显式配置 max_completion_tokens：保留该键并省略 maxTokens，
// 否则 SDK 会再注入 max_tokens，形成双键。
const gatewayLimit = resolveOutputLimitModelKwargs({
  scene: 'nocode-editor',
  modelKwargs: {
    max_completion_tokens: 12_000,
    temperature: 0.2,
  },
})
assert.equal(gatewayLimit.preferredLimitKey, 'max_completion_tokens')
assert.equal(gatewayLimit.effectiveOutputTokens, 12_000)
assert.deepEqual(gatewayLimit.modelKwargs, { temperature: 0.2 })

const gatewayOptions = buildChatModelOutputOptions(gatewayLimit)
assert.equal(gatewayOptions.maxTokens, undefined)
assert.equal(gatewayOptions.modelKwargs?.max_tokens, undefined)
assert.equal(gatewayOptions.modelKwargs?.max_completion_tokens, 12_000)

const gatewayModel = createModel(gatewayOptions)
assert.deepEqual(invocationLimitKeys(gatewayModel), ['max_completion_tokens'])
assert.equal(invocationParamsOf(gatewayModel).max_completion_tokens, 12_000)

// 两个键同时存在时以 max_completion_tokens 为准，另一个键不再下发。
const dualKeyLimit = resolveOutputLimitModelKwargs({
  scene: 'nocode-editor',
  modelKwargs: {
    max_tokens: 9_000,
    max_completion_tokens: 12_000,
  },
})
assert.equal(dualKeyLimit.preferredLimitKey, 'max_completion_tokens')
assert.equal(dualKeyLimit.effectiveOutputTokens, 12_000)
assert.deepEqual(dualKeyLimit.modelKwargs, {})

console.log('provider-output-limit: ok')
