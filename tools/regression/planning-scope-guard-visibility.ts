import assert from 'node:assert/strict'

import type { AiActionResult } from '../../src/main/modules/ai/ai.types'
import { buildNocodeEditorToolResultStreamMetadata } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stream-payload'

;(global as Record<string, unknown>).i18next = {
  t: (key: string) => key,
}

const guardResult = {
  callId: 'call_planning_scope_guard',
  name: 'editor_stage_app_plan',
  kind: 'tool',
  ok: false,
  error: '当前需求的规划范围是单表单（form），不能调用 editor_stage_app_plan。',
  metadata: {
    executor: 'server-guard',
    blockedByPlanningScope: true,
    suppressPersistedSummary: true,
    suppressSummaryContent: true,
    suppressStreamBlocks: true,
  },
} as AiActionResult

const guardMetadata = buildNocodeEditorToolResultStreamMetadata({
  result: guardResult,
  traceId: 'trace_planning_scope_guard',
}) as Record<string, unknown>

// 守卫拒绝只是模型可见的纠偏反馈：渲染端必须能识别并跳过失败卡。
assert.equal(guardMetadata.blockedByPlanningScope, true)
assert.equal(guardMetadata.ok, false)
assert.deepEqual(guardMetadata.blocks, [])
assert.equal(guardMetadata.summaryContent, '')

const ignoredGuardFailure = Boolean(
  guardMetadata.duplicateBlocked
  || guardMetadata.toolPolicyViolation
  || guardMetadata.blockedByPlanningScope
)
assert.equal(ignoredGuardFailure, true)

const regularResult = {
  callId: 'call_regular',
  name: 'editor_get_relation_context',
  kind: 'tool',
  ok: true,
  metadata: {},
} as AiActionResult

const regularMetadata = buildNocodeEditorToolResultStreamMetadata({
  result: regularResult,
  traceId: 'trace_regular',
}) as Record<string, unknown>

assert.equal(regularMetadata.blockedByPlanningScope, undefined)

console.log('planning-scope-guard-visibility: ok')
