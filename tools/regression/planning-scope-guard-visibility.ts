import assert from 'node:assert/strict'

import type { AiActionResult } from '../../src/main/modules/ai/ai.types'
import { buildNocodeEditorToolResultStreamMetadata } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stream-payload'
import {
  resolveBlueprintScopeRecoveryPlanningGuard,
  resolvePlanningContinuationToolGuard,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-planning-convergence.util'
import { isNocodeEditorGuardFailureStreamMetadata } from '../../src/common/utils/nocodeEditorToolResultSummaryState'

;(global as Record<string, unknown>).i18next = {
  t: (key: string) => key,
}

const buildGuardMetadata = (name: string, metadata: Record<string, unknown>) => (
  buildNocodeEditorToolResultStreamMetadata({
    result: {
      callId: `call_${name}`,
      name,
      kind: 'tool',
      ok: false,
      error: `${name} blocked`,
      metadata: {
        executor: 'server-guard',
        suppressPersistedSummary: true,
        suppressSummaryContent: true,
        suppressStreamBlocks: true,
        ...metadata,
      },
    } as AiActionResult,
    traceId: `trace_${name}`,
  }) as Record<string, unknown>
)

// 守卫拒绝只是模型可见的纠偏反馈：渲染端必须能识别并跳过失败卡。
const scopeGuardMetadata = buildGuardMetadata('editor_stage_app_plan', {
  blockedByPlanningScope: true,
})
assert.equal(scopeGuardMetadata.blockedByPlanningScope, true)
assert.equal(scopeGuardMetadata.ok, false)
assert.deepEqual(scopeGuardMetadata.blocks, [])
assert.equal(scopeGuardMetadata.summaryContent, '')
assert.equal(isNocodeEditorGuardFailureStreamMetadata(scopeGuardMetadata), true)

const continuationGuard = resolvePlanningContinuationToolGuard({
  toolName: 'editor_stage_app_plan',
  userMessage: '忽略待确认，按默认方案继续',
  confirmationStage: 'app-plan',
  planningContextKey: 'planning-ctx-continuation',
  taskSummary: {
    planningConfirmationStatus: 'completed',
    planningConfirmationContextKey: 'planning-ctx-continuation',
    planningMode: '',
  },
})
assert.equal(continuationGuard.blocked, true)

const continuationGuardMetadata = buildGuardMetadata('editor_stage_app_plan', {
  blockedByCompletedPlanningContinuation: true,
  blockedPlanningKind: continuationGuard.planningKind,
  requiredToolName: continuationGuard.expectedToolName,
})
assert.equal(continuationGuardMetadata.blockedByCompletedPlanningContinuation, true)
assert.deepEqual(continuationGuardMetadata.blocks, [])
assert.equal(continuationGuardMetadata.summaryContent, '')
assert.equal(isNocodeEditorGuardFailureStreamMetadata(continuationGuardMetadata), true)

const scopeRecoveryGuard = resolveBlueprintScopeRecoveryPlanningGuard({
  toolName: 'editor_stage_single_form_plan',
  scopeErrorSeen: true,
  plannedForms: [{ formKey: 'form-1', tableName: '员工档案表' }],
})
assert.equal(scopeRecoveryGuard.blocked, true)

const scopeRecoveryGuardMetadata = buildGuardMetadata('editor_stage_single_form_plan', {
  blockedByBlueprintScopeRecovery: true,
  requiredToolName: scopeRecoveryGuard.expectedToolName,
})
assert.equal(scopeRecoveryGuardMetadata.blockedByBlueprintScopeRecovery, true)
assert.deepEqual(scopeRecoveryGuardMetadata.blocks, [])
assert.equal(isNocodeEditorGuardFailureStreamMetadata(scopeRecoveryGuardMetadata), true)

const suppressedOnlyMetadata = buildGuardMetadata('editor_stage_app_plan', {})
assert.equal(isNocodeEditorGuardFailureStreamMetadata(suppressedOnlyMetadata), false)

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
assert.equal(regularMetadata.blockedByCompletedPlanningContinuation, undefined)
assert.equal(regularMetadata.blockedByBlueprintScopeRecovery, undefined)
assert.equal(isNocodeEditorGuardFailureStreamMetadata(regularMetadata), false)

console.log('planning-scope-guard-visibility: ok')
