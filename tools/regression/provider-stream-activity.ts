import assert from 'node:assert/strict'

import { resolveAiProviderChunkActivity } from '../../src/main/modules/ai/openai/ai-provider-chunk-activity'

const activityOf = (chunk: Parameters<typeof resolveAiProviderChunkActivity>[0]['chunk'], text = '') => (
  resolveAiProviderChunkActivity({ chunk, text })
)

// 角色帧、usage 帧、纯保活帧不能算活性证据，否则 idle 计时器会被无限重置。
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
})

console.log('provider-stream-activity: ok')
