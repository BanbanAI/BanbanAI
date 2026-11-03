import assert from 'node:assert/strict'

import { createFlowBlueprintPreflightState } from '../../src/common/utils/nocodeEditorFlowBlueprintPreflight'
import {
  applyFlowBlueprintFailureToPreflightState,
  buildRestoredFlowBlueprintPreflightPrompt,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-blueprint-preflight.util'

const createState = () => createFlowBlueprintPreflightState({
  planningContextKey: 'planning-context',
  schemeRevision: 1,
  now: 1,
})

const buildNodes = (count: number) => Array.from({ length: count }, (_, index) => ({
  nodeKey: `node_${index + 1}`,
  type: 'transact',
}))

const buildFailure = (input: {
  nodeCount?: number
  issues: Array<{ issueId: string; diagnostics?: Array<{ code: string }> }>
}) => ({
  metadata: {
    input: {
      blueprint: {
        triggerBranches: [{
          branchKey: 'branch_submit',
          nodes: buildNodes(input.nodeCount ?? 3),
        }],
      },
    },
    flowUnifiedIssues: input.issues,
  },
})

// 诊断顺序不保证可操作性：第一份 issue 只有枚举问题，人员来源不一致排在后面，
// 恢复提示仍应先说人员来源，因为那是模型必须改结构才能过的阻塞项。
const personnelPriority = applyFlowBlueprintFailureToPreflightState(
  createState(),
  buildFailure({
    issues: [
      {
        issueId: 'flow-blueprint-contract-invalid',
        diagnostics: [{ code: 'flow_field_value_options_invalid' }],
      },
      {
        issueId: 'flow-personnel-source-mismatch',
        diagnostics: [{ code: 'flow_personnel_source_mismatch' }],
      },
    ],
  }),
)
assert.equal(personnelPriority.lastFailureCode, 'flow_personnel_source_mismatch')
assert.match(
  buildRestoredFlowBlueprintPreflightPrompt(personnelPriority),
  /人员来源与已确认方案不一致/,
)

// 分支位置问题优先于枚举/字段问题，但不压过结构骨架本身。
const branchPriority = applyFlowBlueprintFailureToPreflightState(
  createState(),
  buildFailure({
    issues: [{
      issueId: 'flow-blueprint-contract-invalid',
      diagnostics: [
        { code: 'flow_notify_receivers_unsupported' },
        { code: 'flow_branch_branches_in_options_unsupported' },
      ],
    }],
  }),
)
assert.equal(branchPriority.lastFailureCode, 'flow_branch_branches_in_options_unsupported')
assert.match(
  buildRestoredFlowBlueprintPreflightPrompt(branchPriority),
  /branches 写进了 options/,
)

// 没有诊断时退回 issueId，保持既有行为。
const issueFallback = applyFlowBlueprintFailureToPreflightState(
  createState(),
  buildFailure({ issues: [{ issueId: 'flow-blueprint-unknown-failure' }] }),
)
assert.equal(issueFallback.lastFailureCode, 'flow-blueprint-unknown-failure')

// 骨架截断必须在提示里说清楚，否则模型会把“前 40 个节点”当成完整结构。
const truncatedFailure = applyFlowBlueprintFailureToPreflightState(
  createState(),
  buildFailure({
    nodeCount: 60,
    issues: [{
      issueId: 'flow-blueprint-contract-invalid',
      diagnostics: [{ code: 'flow_node_type_unsupported' }],
    }],
  }),
)
const truncatedHint = truncatedFailure.blueprintStructureHint || ''
assert.match(truncatedHint, /只保留前 40 个节点/)
assert.match(truncatedHint, /以已保存的流程方案为准/)
const parsedHint = JSON.parse(truncatedHint.split('\n')[0])
const keptNodeCount = parsedHint.triggerBranches
  .flatMap((branch: { nodes?: unknown[] }) => branch.nodes || [])
  .length
assert.equal(keptNodeCount, 40)
assert.match(
  buildRestoredFlowBlueprintPreflightPrompt(truncatedFailure),
  /只保留前 40 个节点/,
)

// 未截断时不追加提示，避免误导模型以为还有未展示结构。
const completeFailure = applyFlowBlueprintFailureToPreflightState(
  createState(),
  buildFailure({
    nodeCount: 3,
    issues: [{
      issueId: 'flow-blueprint-contract-invalid',
      diagnostics: [{ code: 'flow_node_type_unsupported' }],
    }],
  }),
)
assert.doesNotMatch(completeFailure.blueprintStructureHint || '', /只保留前 40 个节点/)

console.log('flow-blueprint-failure-code-priority: ok')
