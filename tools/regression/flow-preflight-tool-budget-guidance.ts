import assert from 'node:assert/strict'

import {
  createFlowBlueprintPreflightState,
  resolveFlowBlueprintPreflightAllowedToolNames,
  updateFlowBlueprintPreflightProgress,
  type FlowBlueprintPreflightState,
} from '../../src/common/utils/nocodeEditorFlowBlueprintPreflight'
import {
  buildFlowBlueprintPreflightActionGuidance,
  projectFlowBlueprintPreflightActions,
  resolveFlowBlueprintPreflightToolDecision,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-blueprint-preflight.util'
import { buildNocodeEditorToolUnavailableRetryMessage } from '../../src/main/modules/ai/nocode-editor/nocode-editor-lost-tool-intent-retry.util'

const actions = [
  { name: 'editor_get_flow_summary' },
  { name: 'editor_get_flow_node_examples' },
  { name: 'editor_stage_flow_blueprint' },
  { name: 'editor_plan_flow_scheme' },
]

const createState = () => createFlowBlueprintPreflightState({
  planningContextKey: 'planning-context',
  schemeRevision: 1,
  now: 1,
})

const fresh = createState()
const afterSummary = updateFlowBlueprintPreflightProgress(fresh, {
  toolName: 'editor_get_flow_summary',
  now: 2,
})
const afterNodeExamples = updateFlowBlueprintPreflightProgress(fresh, {
  toolName: 'editor_get_flow_node_examples',
  now: 2,
})
const afterBoth = updateFlowBlueprintPreflightProgress(afterSummary, {
  toolName: 'editor_get_flow_node_examples',
  now: 3,
})

const cases: Array<{ state: FlowBlueprintPreflightState; expected: string[] }> = [
  {
    state: fresh,
    expected: [
      'editor_get_flow_summary',
      'editor_get_flow_node_examples',
      'editor_stage_flow_blueprint',
    ],
  },
  {
    state: afterSummary,
    expected: ['editor_get_flow_node_examples', 'editor_stage_flow_blueprint'],
  },
  {
    state: afterNodeExamples,
    expected: ['editor_get_flow_summary', 'editor_stage_flow_blueprint'],
  },
  {
    state: afterBoth,
    expected: ['editor_stage_flow_blueprint'],
  },
]

for (const item of cases) {
  assert.deepEqual(
    resolveFlowBlueprintPreflightAllowedToolNames(item.state),
    item.expected,
  )
  assert.deepEqual(
    projectFlowBlueprintPreflightActions(actions, item.state).map(action => action.name),
    item.expected,
  )

  // 文案宣传的工具必须与实际下发的一致，否则模型会调用已删除的编辑器工具。
  const guidance = buildFlowBlueprintPreflightActionGuidance(item.state)
  for (const toolName of ['editor_get_flow_summary', 'editor_get_flow_node_examples']) {
    assert.equal(
      guidance.includes(toolName),
      item.expected.includes(toolName),
      `${toolName} 在文案中的出现应与投影一致`,
    )
  }
  assert.match(guidance, /editor_stage_flow_blueprint/)

  // 拦截错误文案同样回给模型，也不能宣传预算已耗尽的工具。
  const blocked = resolveFlowBlueprintPreflightToolDecision({
    active: true,
    toolName: 'editor_plan_flow_scheme',
    state: item.state,
  })
  assert.equal(blocked.kind, 'block')
  if (blocked.kind === 'block') {
    assert.equal(blocked.error, `当前正在准备流程蓝图：${guidance}`)
  }
  assert.equal(
    resolveFlowBlueprintPreflightToolDecision({
      active: true,
      toolName: 'editor_stage_flow_blueprint',
      state: item.state,
    }).kind,
    'allow',
  )
}

// 未知 state 时退回不含具体工具的兜底说法，避免误报预算已耗尽。
const fallbackBlocked = resolveFlowBlueprintPreflightToolDecision({
  active: true,
  toolName: 'editor_plan_flow_scheme',
})
assert.equal(fallbackBlocked.kind, 'block')
if (fallbackBlocked.kind === 'block') {
  assert.equal(
    fallbackBlocked.error,
    '当前正在准备流程蓝图，只允许补读流程摘要、读取节点示例或继续生成流程蓝图。',
  )
}

// 拦截必须与投影同源：两项证据都读过后，再调补读工具就要被拦住。
for (const consumedToolName of ['editor_get_flow_summary', 'editor_get_flow_node_examples']) {
  const consumedBlocked = resolveFlowBlueprintPreflightToolDecision({
    active: true,
    toolName: consumedToolName,
    state: afterBoth,
  })
  assert.equal(consumedBlocked.kind, 'block')
  if (consumedBlocked.kind === 'block') {
    assert.match(consumedBlocked.error, /本轮只能调用 editor_stage_flow_blueprint/)
  }
}
assert.equal(
  resolveFlowBlueprintPreflightToolDecision({
    active: true,
    toolName: 'editor_get_flow_summary',
    state: afterSummary,
  }).kind,
  'block',
)
assert.equal(
  resolveFlowBlueprintPreflightToolDecision({
    active: true,
    toolName: 'editor_get_flow_node_examples',
    state: afterSummary,
  }).kind,
  'allow',
)

// 不在预检阶段时不做收敛。
assert.equal(resolveFlowBlueprintPreflightAllowedToolNames(null), null)
assert.equal(projectFlowBlueprintPreflightActions(actions, null).length, actions.length)

const unavailable = buildNocodeEditorToolUnavailableRetryMessage({
  droppedToolNames: ['editor_get_flow_node_examples', 'bad name'],
  availableToolNames: ['editor_stage_flow_blueprint', '非法 工具名'],
})
assert.match(unavailable, /"editor_get_flow_node_examples"/)
assert.doesNotMatch(unavailable, /bad name/)
assert.match(unavailable, /"editor_stage_flow_blueprint"/)
assert.doesNotMatch(unavailable, /非法 工具名/)

// 没有可用工具时不能拼出空列表文案。
assert.match(
  buildNocodeEditorToolUnavailableRetryMessage({ droppedToolNames: [] }),
  /本轮没有可用工具/,
)

console.log('flow-preflight-tool-budget-guidance: ok')
