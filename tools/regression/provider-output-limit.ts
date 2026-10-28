import assert from 'node:assert/strict'

import { ChatOpenAI } from '@langchain/openai'

import {
  NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS,
  NOCODE_EDITOR_MAX_OUTPUT_TOKENS,
  WORKBENCH_DEFAULT_OUTPUT_TOKENS,
  applyNocodeEditorOutputLimit,
  buildChatModelOutputOptions,
  resolveOutputLimitModelKwargs,
} from '../../src/main/modules/ai/openai/ai-provider-output-policy'

// 编辑器场景默认下发 16,384 输出上限；上限要真正离开 modelKwargs 走到 ChatOpenAI。
const nocodeEditorLimit = resolveOutputLimitModelKwargs({ scene: 'nocode-editor' })
assert.equal(nocodeEditorLimit.effectiveOutputTokens, NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)
assert.equal(nocodeEditorLimit.modelKwargs.max_tokens, NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)

const nocodeEditorOutputOptions = buildChatModelOutputOptions({
  modelKwargs: nocodeEditorLimit.modelKwargs,
  effectiveOutputTokens: nocodeEditorLimit.effectiveOutputTokens,
})
assert.equal(nocodeEditorOutputOptions.maxTokens, NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS)

const chatCompletionsMaxTokens = (model: ChatOpenAI) => (
  (model.invocationParams() as { max_tokens?: number }).max_tokens
)

// LangChain 的 invocationParams 会先用 this.maxTokens 覆盖 modelKwargs.max_tokens，
// 所以只把上限塞进 modelKwargs 会在 SDK 层变成 undefined，等于没有上限。
const legacyModel = new ChatOpenAI({
  apiKey: 'regression-test-key',
  model: 'gpt-4o-mini',
  modelKwargs: nocodeEditorLimit.modelKwargs,
  useResponsesApi: false,
})
assert.equal(chatCompletionsMaxTokens(legacyModel), undefined)

const nocodeEditorModel = new ChatOpenAI({
  apiKey: 'regression-test-key',
  model: 'gpt-4o-mini',
  ...nocodeEditorOutputOptions,
  useResponsesApi: false,
})
assert.equal(
  chatCompletionsMaxTokens(nocodeEditorModel),
  NOCODE_EDITOR_DEFAULT_OUTPUT_TOKENS,
)

// 其它场景保持 8,192 默认值，不因本次改动被抬成编辑器上限。
const workbenchLimit = resolveOutputLimitModelKwargs({ scene: 'workbench' })
assert.equal(workbenchLimit.effectiveOutputTokens, WORKBENCH_DEFAULT_OUTPUT_TOKENS)
assert.equal(workbenchLimit.modelKwargs.max_tokens, WORKBENCH_DEFAULT_OUTPUT_TOKENS)

// 显式配置也不能突破场景硬上限。
const oversizedLimit = resolveOutputLimitModelKwargs({
  scene: 'nocode-editor',
  modelKwargs: { max_tokens: NOCODE_EDITOR_MAX_OUTPUT_TOKENS * 4 },
})
assert.equal(oversizedLimit.effectiveOutputTokens, NOCODE_EDITOR_MAX_OUTPUT_TOKENS)
assert.equal(oversizedLimit.modelKwargs.max_tokens, NOCODE_EDITOR_MAX_OUTPUT_TOKENS)
assert.equal(
  applyNocodeEditorOutputLimit({
    scene: 'nocode-editor',
    modelKwargs: oversizedLimit.modelKwargs,
  })?.max_tokens,
  NOCODE_EDITOR_MAX_OUTPUT_TOKENS,
)

console.log('provider-output-limit: ok')
