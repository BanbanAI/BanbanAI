import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { hasNocodeEditorPendingFlowSchemeConfirmation } from '../../src/common/utils/nocodeEditorArtifactBlocks'
import {
  NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON,
  buildNocodeEditorModelContractRepairStreamMetadata,
  isNocodeEditorModelContractRepairFailure,
  isNocodeEditorSuppressedFailedStageSummaryReason,
  shouldShowNocodeEditorFailedStageArtifact,
} from '../../src/common/utils/nocodeEditorToolResultSummaryState'
import { buildNocodeEditorToolResultStreamMetadata } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stream-payload'
import { buildFlowSchemeStopLossQuestions } from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { isNocodeEditorSuppressedIntermediateSummary } from '../../src/renderer/views/nocode/views/editor/ai/streamToolResultState'
import { initTestI18n } from './test-i18n'

// 面板与 stream-payload 会走 i18next；用真实语言包断言收口题业务文案。
initTestI18n()

const structureFailureMetadata = {
  suppressPersistedSummary: true,
  suppressSummaryContent: true,
  suppressStreamBlocks: true,
  suppressedIntermediateSummary: true,
  summarySuppressionReason: NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON,
  flowUnifiedIssues: [{
    issueId: 'flow-structure-assumption-unconfirmed',
    diagnostics: [
      { code: 'structure_assumption_question_missing', assumptionText: '默认两级审批', decisionKey: 'flow.approval.structure' },
      { code: 'structure_assumption_decision_missing', assumptionText: '审批分两级' },
    ],
  }],
}

// (a) 显式标记经 callback metadata 进入 stream 后，flow-scheme 不再产出错误卡
assert.equal(isNocodeEditorSuppressedFailedStageSummaryReason('model_contract_repair'), true)
assert.equal(isNocodeEditorModelContractRepairFailure({ suppressedIntermediateSummary: true, summarySuppressionReason: 'model_contract_repair' }), true)
// 只有三个 suppress 不能触发豁免：防“靠组合推断”
assert.equal(isNocodeEditorModelContractRepairFailure({
  suppressPersistedSummary: true,
  suppressSummaryContent: true,
  suppressStreamBlocks: true,
}), false)
assert.equal(isNocodeEditorModelContractRepairFailure({
  suppressedIntermediateSummary: true,
  summarySuppressionReason: 'transient_failed_stage_followed_by_success',
}), false)
// 面板 catch 用的就是这份函数：可修 → 五件套；不可修 / 空 → null
assert.deepEqual(
  buildNocodeEditorModelContractRepairStreamMetadata({ modelSelfRepairable: true }),
  {
    suppressPersistedSummary: true,
    suppressSummaryContent: true,
    suppressStreamBlocks: true,
    suppressedIntermediateSummary: true,
    summarySuppressionReason: NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON,
  },
)
assert.equal(buildNocodeEditorModelContractRepairStreamMetadata({}), null)
assert.equal(buildNocodeEditorModelContractRepairStreamMetadata(null), null)
// 接线断言：面板必须调用同一份 helper，否则会出现“测试绿、线上没接线”（允许 prettier 换行）
const panelSource = fs.readFileSync(
  path.resolve(__dirname, '../../src/renderer/views/nocode/views/editor/ai/NocodeEditorAiPanel.vue'),
  'utf8',
)
assert.match(
  panelSource,
  /buildNocodeEditorModelContractRepairStreamMetadata\(\s*error\b/,
)

const streamMetadata = buildNocodeEditorToolResultStreamMetadata({
  traceId: 'trace-structure-assumption',
  result: {
    callId: 'call-flow-scheme-1',
    name: 'editor_plan_flow_scheme',
    kind: 'tool',
    ok: false,
    error: '流程方案把一部分结构选择当成了默认假设，用户还没机会确认或否决。',
    output: { ok: false, flowUnifiedIssues: structureFailureMetadata.flowUnifiedIssues },
    metadata: structureFailureMetadata,
  } as any,
})
assert.equal(streamMetadata.suppressedIntermediateSummary, true)
assert.equal(streamMetadata.summarySuppressionReason, NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON)
// 面板通用豁免（ignoredGuardFailure）与 !ok 分支豁免都走同一个判定
assert.equal(isNocodeEditorSuppressedIntermediateSummary(streamMetadata as any), true)
assert.equal(shouldShowNocodeEditorFailedStageArtifact({ metadata: streamMetadata as any }), false)

// (b) 收口卡题目要带假设原文；缺原文时出不了题（证明 P0-2 必要）
const questions = buildFlowSchemeStopLossQuestions([{
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: structureFailureMetadata,
}])
assert.deepEqual(questions.map(question => question.title), [
  '按“默认两级审批”来吗？',
  '按“审批分两级”来吗？',
])
assert.equal(questions[0]?.allowFreeText, true)
const withoutAssumptionText = buildFlowSchemeStopLossQuestions([{
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: {
    flowUnifiedIssues: [{
      issueId: 'flow-structure-assumption-unconfirmed',
      diagnostics: [
        { code: 'structure_assumption_question_missing', decisionKey: 'flow.approval.structure' },
      ],
    }],
  },
}])
assert.equal(withoutAssumptionText.length, 0)

// (c) 需要用户处理的失败仍保留可见卡；pending 确认卡不被错误卡覆盖
const targetFormNotFound = {
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: { flowUnifiedIssues: [{ issueId: 'flow-scheme-target-form-not-found' }] },
}
assert.equal(shouldShowNocodeEditorFailedStageArtifact({ metadata: targetFormNotFound.metadata }), true)
assert.equal(shouldShowNocodeEditorFailedStageArtifact({
  metadata: targetFormNotFound.metadata,
  hasPendingConfirmation: true,
}), false)

const pendingBlocks = [{
  type: 'artifact',
  kind: 'flow-scheme',
  status: 'ready',
  confirmation: { status: 'pending', planningContextKey: 'plan:flow:outline-1:form-expense' },
}]
assert.equal(hasNocodeEditorPendingFlowSchemeConfirmation({
  blocks: pendingBlocks,
  planningContextKey: 'plan:flow:outline-1:form-expense',
}), true)
assert.equal(hasNocodeEditorPendingFlowSchemeConfirmation({
  blocks: pendingBlocks,
  planningContextKey: 'plan:flow:outline-2:form-other',
}), false)
assert.equal(hasNocodeEditorPendingFlowSchemeConfirmation({
  blocks: [{
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'error',
    error: '流程方案生成失败',
  }],
  planningContextKey: 'plan:flow:outline-1:form-expense',
}), false)

// 语言包兜底话术：存在且不含实现词
const zhLang = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../src/locales/zh-CN/lang.json'),
  'utf8',
))
const fallbackCopy = String(zhLang?.nocodeEditorChatService?.flowSchemeStopLossNeedsUserInput || '')
assert.equal(Boolean(fallbackCopy), true)
for (const technical of ['decisionKey', 'issue', 'validate', 'tool', 'metadata']) {
  assert.equal(fallbackCopy.includes(technical), false)
}

console.log('flow-scheme-repair-signal-suppression: passed')
