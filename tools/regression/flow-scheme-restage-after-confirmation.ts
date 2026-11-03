import assert from 'node:assert/strict'

import {
  buildFlowSchemeRestageAfterConfirmationContract,
  resolveNocodeEditorStageOutputContract,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'

const contract = buildFlowSchemeRestageAfterConfirmationContract({
  confirmationStage: 'flow-scheme',
  hasStagedFlowScheme: true,
  previousSchemeRevision: 8,
})

const resolve = (results: Array<Record<string, unknown>>, retryCount = 0) => (
  resolveNocodeEditorStageOutputContract({
    contract,
    results,
    retryCount,
    hasRetryRoundAvailable: true,
  })
)

// 1. 只有正文、没有工具结果：要求补轮。
assert.equal(resolve([]).kind, 'retry')

// 2. 调了别的读取工具也不算完成。
assert.equal(resolve([{ name: 'editor_get_flow_summary', ok: true }]).kind, 'retry')

// 3. 版本号没有前进：不算真正重新暂存。
assert.equal(resolve([{
  name: 'editor_plan_flow_scheme',
  ok: true,
  output: { revision: 8, scheme: { title: '项目管理表流程方案', openQuestions: [], confirmation: {} } },
}]).kind, 'retry')

// 4. 版本号前进且结构完整：通过。
assert.equal(resolve([{
  name: 'editor_plan_flow_scheme',
  ok: true,
  output: { revision: 9, scheme: { title: '项目管理表流程方案', openQuestions: [], confirmation: {} } },
}]).kind, 'satisfied')

// 5. 只允许补一轮。
assert.equal(resolve([], 1).kind, 'exhausted')

// 6. 其他阶段不生效。
const blueprintContract = buildFlowSchemeRestageAfterConfirmationContract({
  confirmationStage: 'blueprint',
  hasStagedFlowScheme: true,
  previousSchemeRevision: 8,
})
assert.equal(
  resolveNocodeEditorStageOutputContract({
    contract: blueprintContract,
    results: [],
    retryCount: 0,
    hasRetryRoundAvailable: true,
  }).kind,
  'not_applicable',
)

// 7. 宿主没有暂存方案时不强推重新暂存。
const noStagedContract = buildFlowSchemeRestageAfterConfirmationContract({
  confirmationStage: 'flow-scheme',
  hasStagedFlowScheme: false,
  previousSchemeRevision: 8,
})
assert.equal(
  resolveNocodeEditorStageOutputContract({
    contract: noStagedContract,
    results: [],
    retryCount: 0,
    hasRetryRoundAvailable: true,
  }).kind,
  'not_applicable',
)

console.log('flow-scheme-restage-after-confirmation: ok')
