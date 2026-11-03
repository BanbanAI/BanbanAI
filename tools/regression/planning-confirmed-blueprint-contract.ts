import assert from 'node:assert/strict'

import {
  isNocodeEditorBlueprintExpectedAfterPlanningConfirmation,
  resolveNocodeEditorStageOutputContract,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'

const contract = {
  id: 'blueprint-after-planning-confirmation',
  applicable: true,
  prerequisiteToolNames: [],
  satisfyingOutputToolNames: ['editor_stage_app_blueprint'],
  retryLimit: 1,
}

// 本次会话场景：规划确认完成、模型只输出正文
assert.equal(isNocodeEditorBlueprintExpectedAfterPlanningConfirmation({
  confirmationStage: 'form-plan',
  planningConfirmationStatus: 'completed',
  results: [],
}), true)

const satisfied = resolveNocodeEditorStageOutputContract({
  contract,
  results: [{ name: 'editor_stage_app_blueprint', ok: true }],
  retryCount: 0,
})
assert.equal(satisfied.kind, 'satisfied')

const retry = resolveNocodeEditorStageOutputContract({
  contract,
  results: [],
  retryCount: 0,
})
assert.equal(retry.kind, 'retry')

const exhausted = resolveNocodeEditorStageOutputContract({
  contract,
  results: [],
  retryCount: 1,
})
assert.equal(exhausted.kind, 'exhausted')

// 模型重新暂存规划：交给新规划卡，不强制蓝图
assert.equal(isNocodeEditorBlueprintExpectedAfterPlanningConfirmation({
  confirmationStage: 'form-plan',
  planningConfirmationStatus: 'completed',
  results: [{ name: 'editor_stage_single_form_plan', ok: true }],
}), false)

// 不是规划确认答复：不启用
assert.equal(isNocodeEditorBlueprintExpectedAfterPlanningConfirmation({
  confirmationStage: undefined,
  planningConfirmationStatus: 'completed',
  results: [],
}), false)

// 蓝图确认阶段已有独立兜底，这里不重复
assert.equal(isNocodeEditorBlueprintExpectedAfterPlanningConfirmation({
  confirmationStage: 'blueprint',
  planningConfirmationStatus: 'completed',
  results: [],
}), false)

console.log('planning-confirmed-blueprint-contract: ok')
