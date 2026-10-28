import assert from 'node:assert/strict'

import { AiProviderStreamTimeoutError } from '../../src/main/modules/ai/openai/ai-provider-stream-lifecycle'
import {
  resolveNocodeEditorProviderRoundRetryDecision,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-stream-error'

const totalTimeout = new AiProviderStreamTimeoutError('total', 300_000)
const firstEventTimeout = new AiProviderStreamTimeoutError('first_event', 90_000)

// total 超时且本轮没有工具调用：允许用最小上下文重试一次。
// 流程预读结果等消息并不都参与压缩，压缩后体积是否变小不能作为能否重试的前提；
// 重试轮改用更短的 total timeout 兜住最坏等待。
const totalTimeoutDecision = resolveNocodeEditorProviderRoundRetryDecision({
  error: totalTimeout,
  retryCount: 0,
  hasRoundOutput: false,
  hasRoundToolCall: false,
  aborted: false,
})
assert.equal(totalTimeoutDecision.retry, true)
assert.equal(totalTimeoutDecision.forceCompact, true)
assert.equal(totalTimeoutDecision.reason, 'total_timeout_compact')

// 压缩后体积没有变小时，仍然要重试一次（历史策略），但不能宣称走了 compact；
// 本轮半成品正文仍要清空，否则重试后的输出会和旧内容拼接。
const ineffectiveCompactionDecision = resolveNocodeEditorProviderRoundRetryDecision({
  error: totalTimeout,
  retryCount: 0,
  hasRoundOutput: false,
  hasRoundToolCall: false,
  aborted: false,
  compactionEffective: false,
})
assert.equal(ineffectiveCompactionDecision.retry, true)
assert.equal(ineffectiveCompactionDecision.forceCompact, true)
assert.equal(ineffectiveCompactionDecision.reason, 'total_timeout_retry')

// 首事件超时不涉及压缩，保持原有重试。
const firstEventDecision = resolveNocodeEditorProviderRoundRetryDecision({
  error: firstEventTimeout,
  retryCount: 0,
  hasRoundOutput: false,
  hasRoundToolCall: false,
  aborted: false,
})
assert.equal(firstEventDecision.retry, true)
assert.equal(firstEventDecision.forceCompact, false)
assert.equal(firstEventDecision.reason, 'first_event_timeout')

// 已经产生输出、已重试过、或主动取消：都不再重试。
assert.equal(resolveNocodeEditorProviderRoundRetryDecision({
  error: firstEventTimeout,
  retryCount: 0,
  hasRoundOutput: true,
  hasRoundToolCall: false,
  aborted: false,
}).retry, false)
assert.equal(resolveNocodeEditorProviderRoundRetryDecision({
  error: totalTimeout,
  retryCount: 0,
  hasRoundOutput: true,
  hasRoundToolCall: true,
  aborted: false,
}).retry, false)
assert.equal(resolveNocodeEditorProviderRoundRetryDecision({
  error: totalTimeout,
  retryCount: 1,
  hasRoundOutput: false,
  hasRoundToolCall: false,
  aborted: false,
}).retry, false)
assert.equal(resolveNocodeEditorProviderRoundRetryDecision({
  error: totalTimeout,
  retryCount: 0,
  hasRoundOutput: false,
  hasRoundToolCall: false,
  aborted: true,
}).retry, false)

console.log('provider-timeout-retry-policy: ok')
