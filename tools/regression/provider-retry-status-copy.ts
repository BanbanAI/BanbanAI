import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { resolveNocodeEditorProviderRetryCopyKey } from '../../src/common/utils/nocodeEditorProviderRetryCopy'

// 只有 total 超时会真正压缩上下文；首包超时是原样重发。
assert.equal(
  resolveNocodeEditorProviderRetryCopyKey('total_timeout_compact'),
  'nocodeEditorAiPanel.streamRetrying',
)
for (const retryReason of ['first_event_timeout', 'total_timeout_retry', '', undefined, null, 'unexpected']) {
  assert.equal(
    resolveNocodeEditorProviderRetryCopyKey(retryReason),
    'nocodeEditorAiPanel.streamRetryingWithoutCompaction',
  )
}

for (const locale of ['zh-CN', 'zh-TW', 'en']) {
  const langPath = path.resolve(__dirname, `../../src/locales/${locale}/lang.json`)
  const lang = JSON.parse(fs.readFileSync(langPath, 'utf8'))
  assert.ok(lang.nocodeEditorAiPanel?.streamRetrying, `${locale} 缺少 streamRetrying`)
  assert.ok(
    lang.nocodeEditorAiPanel?.streamRetryingWithoutCompaction,
    `${locale} 缺少 streamRetryingWithoutCompaction`,
  )
}

console.log('provider-retry-status-copy: ok')
