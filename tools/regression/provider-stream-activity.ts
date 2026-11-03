import assert from 'node:assert/strict'

import { resolveAiProviderChunkActivity } from '../../src/main/modules/ai/openai/ai-provider-chunk-activity'

const activityOf = (chunk: Parameters<typeof resolveAiProviderChunkActivity>[0]['chunk'], text = '') => (
  resolveAiProviderChunkActivity({ chunk, text })
)

// meaningful 只看正文/reasoning/工具参数增量；alive 才是超时活性证据。
assert.equal(activityOf({ content: '' }).meaningful, false)
assert.equal(activityOf({ content: '   \n' }, '   \n').meaningful, false)
assert.equal(activityOf({
  content: '',
  additional_kwargs: { role: 'assistant' },
}).meaningful, false)
assert.equal(activityOf({
  content: '',
  additional_kwargs: { usage: { prompt_tokens: 100 } },
}).meaningful, false)
assert.equal(activityOf({
  content: '',
  tool_call_chunks: [{ args: '' }],
}).meaningful, false)

// 纯思考/角色/空帧虽然不算 UI 进展，但仍是上游还活着的证据。
assert.equal(activityOf({ content: '' }).alive, true)
assert.equal(activityOf({ content: '   \n' }, '   \n').alive, true)
assert.equal(activityOf({
  content: '',
  additional_kwargs: { role: 'assistant' },
}).alive, true)
assert.equal(activityOf({
  content: '',
  tool_call_chunks: [{ args: '' }],
}).alive, true)

// 纯 usage 收尾帧不能重置 idle，否则卡死后最后一帧会把超时再往后推。
assert.equal(activityOf({
  content: '',
  additional_kwargs: { usage: { prompt_tokens: 100 } },
}).alive, false)
assert.equal(activityOf({
  content: '',
  usage_metadata: { input_tokens: 100, output_tokens: 0, total_tokens: 100 },
}).alive, false)
assert.equal(activityOf({
  content: '',
  response_metadata: { tokenUsage: { totalTokens: 100 } },
}).alive, false)

// 正文、reasoning、工具参数增量都算有效进度。
assert.equal(activityOf({ content: '正在' }, '正在').meaningful, true)
assert.equal(activityOf({
  content: '',
  additional_kwargs: { reasoning_content: '思考中' },
}).meaningful, true)
assert.equal(activityOf({
  content: '',
  additional_kwargs: { reasoning_content: [{ text: '思考中' }] },
}).meaningful, true)
assert.equal(activityOf({
  content: '',
  additional_kwargs: { reasoning: { text: '思考中' } },
}).meaningful, true)
assert.equal(activityOf({
  content: '',
  tool_call_chunks: [{ args: '{"name"' }],
}).meaningful, true)
assert.equal(activityOf({
  content: '',
  invalid_tool_call_chunks: [{ args: '{"name"' }],
}).meaningful, true)
assert.equal(activityOf({
  content: '',
  additional_kwargs: {
    tool_calls: [{ function: { name: 'editor_patch_flow', arguments: '{"node' } }],
  },
}).meaningful, true)

const textActivity = activityOf({ content: '正文' }, '正文')
assert.deepEqual(textActivity, {
  hasText: true,
  hasReasoning: false,
  hasToolArguments: false,
  meaningful: true,
  alive: true,
})

assert.equal(activityOf({
  content: '',
  additional_kwargs: { reasoning_content: '思考中' },
}).alive, true)

console.log('provider-stream-activity: ok')
