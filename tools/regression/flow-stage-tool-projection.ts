import assert from 'node:assert/strict'

import {
  isNocodeEditorFlowStageEntryTool,
  projectNocodeEditorStageActions,
  resolveNocodeEditorToolStageFromNames,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-actions.util'

const actionDefinitions = [
  { name: 'editor_get_flow_summary' },
  { name: 'editor_plan_flow_scheme' },
  { name: 'editor_stage_flow_blueprint' },
  { name: 'editor_patch_flow' },
  { name: 'editor_stage_app_plan' },
  { name: 'editor_stage_app_blueprint' },
  { name: 'editor_get_staged_app_blueprint' },
  { name: 'editor_apply_staged_app_blueprint' },
  { name: 'editor_clear_staged_app_blueprint' },
  { name: 'editor_stage_single_form_plan' },
  { name: 'editor_stage_content_plan' },
  { name: 'editor_stage_formula_plan' },
  { name: 'editor_get_form_schema' },
  { name: 'read_attachment' },
]

// 流程轮只剔除其它阶段的 plan/blueprint 工具。
assert.deepEqual(
  projectNocodeEditorStageActions(actionDefinitions, 'flow').map(action => action.name),
  [
    'editor_get_flow_summary',
    'editor_plan_flow_scheme',
    'editor_stage_flow_blueprint',
    'editor_patch_flow',
    'editor_get_form_schema',
    'read_attachment',
  ],
)

// 未识别阶段时保持原样，避免误删工具。
assert.equal(
  projectNocodeEditorStageActions(actionDefinitions, null).length,
  actionDefinitions.length,
)
assert.equal(
  projectNocodeEditorStageActions(actionDefinitions, undefined).length,
  actionDefinitions.length,
)

// 没有实际剔除时保持原引用，调用点据此跳过 system prompt 重建。
const alreadyProjectedActions = [
  { name: 'editor_plan_flow_scheme' },
  { name: 'editor_stage_flow_blueprint' },
]
assert.equal(
  projectNocodeEditorStageActions(alreadyProjectedActions, 'flow'),
  alreadyProjectedActions,
)

// 过滤后为空时回退原列表，不能把工具集清空。
const onlyNonFlowActions = [
  { name: 'editor_stage_app_plan' },
  { name: 'editor_stage_app_blueprint' },
]
assert.deepEqual(
  projectNocodeEditorStageActions(onlyNonFlowActions, 'flow'),
  onlyNonFlowActions,
)

// 流程入口工具用于把后续轮次粘在流程阶段。
for (const toolName of [
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_patch_flow',
  'editor_apply_staged_flow',
]) {
  assert.equal(isNocodeEditorFlowStageEntryTool(toolName), true)
  assert.equal(resolveNocodeEditorToolStageFromNames(['read_attachment', toolName]), 'flow')
}
for (const toolName of [
  'editor_stage_app_plan',
  'editor_stage_single_form_plan',
  'editor_get_form_schema',
  'read_attachment',
  '',
  null,
  undefined,
]) {
  assert.equal(isNocodeEditorFlowStageEntryTool(toolName), false)
}
assert.equal(resolveNocodeEditorToolStageFromNames([]), null)
assert.equal(resolveNocodeEditorToolStageFromNames(null), null)

console.log('flow-stage-tool-projection: ok')
