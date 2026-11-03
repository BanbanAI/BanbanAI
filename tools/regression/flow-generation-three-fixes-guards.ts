import assert from 'node:assert/strict'

import { normalizeNocodeEditorAiMessageHistory } from '../../src/common/utils/nocodeEditorAiMessageHistory'
import { validateNocodeEditorFlowBlueprintContract } from '../../src/common/utils/nocodeEditorFlowBlueprint'
import {
  createFlowBlueprintPreflightState,
  DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET,
  type FlowBlueprintPreflightState,
} from '../../src/common/utils/nocodeEditorFlowBlueprintPreflight'
import {
  applyFlowBlueprintFailureToPreflightState,
  buildRestoredFlowBlueprintPreflightPrompt,
  projectFlowBlueprintPreflightActions,
  resolveFlowBlueprintPreflightStopDecision,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-blueprint-preflight.util'
import { shouldHideFlowBlueprintPreflightFallbackSchemeArtifact } from '../../src/renderer/views/nocode/views/editor/ai/flowSchemeArtifactState'
import { initTestI18n } from './test-i18n'

initTestI18n()

const createFlowPlanMessage = (input: {
  id: string
  traceId: string
  revision?: number
  stagedAt?: number
}) => ({
  id: input.id,
  role: 'assistant',
  content: '流程蓝图已暂存。',
  traceId: input.traceId,
  metadata: {
    toolResultSummary: true,
    summaryStage: 'flow-plan',
    blocks: [{
      type: 'artifact',
      kind: 'flow-plan',
      status: 'ready',
      ...(input.revision === undefined ? {} : { revision: input.revision }),
      ...(input.stagedAt === undefined ? {} : { stagedAt: input.stagedAt }),
      title: '报销申请单审批流程',
      flowPlan: {
        id: 'flow-reimbursement',
        title: '报销申请单审批流程',
        target: {
          formId: 't_vzmoy3stf3lt',
          formName: '报销申请单',
        },
      },
    }],
  },
})

const countFlowPlanBlocks = (messages: Array<ReturnType<typeof createFlowPlanMessage>>) => (
  messages.reduce((total, message) => (
    total + (Array.isArray(message?.metadata?.blocks)
      ? message.metadata.blocks.filter(block => block?.kind === 'flow-plan').length
      : 0)
  ), 0)
)

const versionedMessages = normalizeNocodeEditorAiMessageHistory([
  createFlowPlanMessage({
    id: 'flow-plan-v1',
    traceId: 'trace-v1',
    revision: 1,
    stagedAt: 1792660044806,
  }),
  createFlowPlanMessage({
    id: 'flow-plan-v2',
    traceId: 'trace-v2',
    revision: 2,
    stagedAt: 1792660333578,
  }),
])
assert.equal(versionedMessages.length, 2)
assert.equal(countFlowPlanBlocks(versionedMessages), 2)

const duplicateVersionMessages = normalizeNocodeEditorAiMessageHistory([
  createFlowPlanMessage({
    id: 'flow-plan-v1-a',
    traceId: 'trace-v1-a',
    revision: 1,
    stagedAt: 1792660044806,
  }),
  createFlowPlanMessage({
    id: 'flow-plan-v1-b',
    traceId: 'trace-v1-b',
    revision: 1,
    stagedAt: 1792660044806,
  }),
])
assert.equal(duplicateVersionMessages.length, 1)
assert.equal(countFlowPlanBlocks(duplicateVersionMessages), 1)

const legacyMessages = normalizeNocodeEditorAiMessageHistory([
  createFlowPlanMessage({
    id: 'flow-plan-legacy-a',
    traceId: 'trace-legacy-a',
  }),
  createFlowPlanMessage({
    id: 'flow-plan-legacy-b',
    traceId: 'trace-legacy-b',
  }),
])
assert.equal(legacyMessages.length, 1)
assert.equal(countFlowPlanBlocks(legacyMessages), 1)

const fallbackSchemeBlock = {
  kind: 'flow-scheme',
  status: 'ready',
}
const preflightFailedMetadata = {
  finishReason: 'blueprint_preflight_no_progress',
}
assert.equal(
  shouldHideFlowBlueprintPreflightFallbackSchemeArtifact({
    block: fallbackSchemeBlock,
    messageMetadata: preflightFailedMetadata,
    pendingQuestionCount: 0,
  }),
  true,
)
assert.equal(
  shouldHideFlowBlueprintPreflightFallbackSchemeArtifact({
    block: fallbackSchemeBlock,
    messageMetadata: preflightFailedMetadata,
    pendingQuestionCount: 1,
  }),
  false,
)
assert.equal(
  shouldHideFlowBlueprintPreflightFallbackSchemeArtifact({
    block: fallbackSchemeBlock,
    messageMetadata: { finishReason: 'stop' },
    pendingQuestionCount: 0,
  }),
  false,
)
assert.equal(
  shouldHideFlowBlueprintPreflightFallbackSchemeArtifact({
    block: { kind: 'flow-plan', status: 'ready' },
    messageMetadata: preflightFailedMetadata,
    pendingQuestionCount: 0,
  }),
  false,
)

const preflightActions = [
  { name: 'editor_get_flow_summary' },
  { name: 'editor_get_flow_node_examples' },
  { name: 'editor_stage_flow_blueprint' },
]
const projectPreflightToolNames = (input: {
  summaryRefreshCount: number
  nodeExampleFetchCount: number
}) => {
  const state: FlowBlueprintPreflightState = {
    ...createFlowBlueprintPreflightState({
      planningContextKey: '',
      schemeRevision: 1,
      now: 1,
    }),
    summaryRefreshCount: input.summaryRefreshCount,
    nodeExampleFetchCount: input.nodeExampleFetchCount,
  }
  return projectFlowBlueprintPreflightActions(preflightActions, state)
    .map(action => action.name)
}

assert.deepEqual(projectPreflightToolNames({
  summaryRefreshCount: 0,
  nodeExampleFetchCount: 0,
}), [
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_stage_flow_blueprint',
])
assert.deepEqual(projectPreflightToolNames({
  summaryRefreshCount: 1,
  nodeExampleFetchCount: 0,
}), [
  'editor_get_flow_node_examples',
  'editor_stage_flow_blueprint',
])
assert.deepEqual(projectPreflightToolNames({
  summaryRefreshCount: 1,
  nodeExampleFetchCount: 1,
}), [
  'editor_stage_flow_blueprint',
])

// 分支写进 options 时，契约必须直接指出位置；否则规范化会静默丢分支，
// 人员校验只能报“节点缺失”，用户看到的是与卡片矛盾的另一类失败。
const misplacedBranchBlueprint = {
  title: '报销单审批流程',
  summary: '按金额分流审批。',
  target: { formId: 't_oputad50j9mk', formName: '报销单' },
  triggerBranches: [{
    triggerNode: { nodeKey: 'trigger-submit', type: 'trigger-data-change' },
    nodes: [{
      nodeKey: 'condition-amount',
      type: 'condition-branch',
      name: '按报销总金额分流',
      options: {
        branches: [{
          branchKey: 'branch-low',
          nodes: [{
            nodeKey: 'step-finance-low',
            type: 'approval',
            options: { approver: { assignee: { roles: ['role-finance'] } } },
          }],
        }],
      },
    }],
  }],
}
const misplacedBranchValidation = validateNocodeEditorFlowBlueprintContract(misplacedBranchBlueprint)
assert.equal(misplacedBranchValidation.valid, false)
assert.equal(misplacedBranchValidation.diagnostics[0]?.code, 'flow_branch_branches_in_options_unsupported')
assert.equal(
  misplacedBranchValidation.diagnostics[0]?.path,
  'triggerBranches[0].nodes[0].options.branches',
)

const misplacedNode = misplacedBranchBlueprint.triggerBranches[0].nodes[0]
const correctlyPlacedBlueprint = {
  ...misplacedBranchBlueprint,
  triggerBranches: [{
    ...misplacedBranchBlueprint.triggerBranches[0],
    nodes: [{
      nodeKey: misplacedNode.nodeKey,
      type: misplacedNode.type,
      name: misplacedNode.name,
      branches: misplacedNode.options.branches,
    }],
  }],
}
assert.equal(validateNocodeEditorFlowBlueprintContract(correctlyPlacedBlueprint).valid, true)

const exhaustedPreflightState: FlowBlueprintPreflightState = {
  ...createFlowBlueprintPreflightState({
    planningContextKey: 'logical:flow-scheme:test:t_oputad50j9mk',
    schemeRevision: 3,
    now: 1,
    phase: 'waiting_blueprint',
  }),
  reminderCount: DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET,
}
const failedBranchResult = {
  name: 'editor_stage_flow_blueprint',
  ok: false,
  metadata: {
    input: { blueprint: misplacedBranchBlueprint },
    flowUnifiedIssues: [{
      issueId: 'flow-blueprint-contract-invalid',
      diagnostics: [{
        code: 'flow_branch_branches_in_options_unsupported',
        path: 'triggerBranches[0].nodes[0].options.branches',
      }],
    }],
  },
}
const failedPreflightState = applyFlowBlueprintFailureToPreflightState(
  exhaustedPreflightState,
  failedBranchResult,
)
assert.equal(failedPreflightState.lastFailureCode, 'flow_branch_branches_in_options_unsupported')
// 结构骨架要把 options.branches 提升出来，恢复提示才不会继续沿用错误位置。
assert.equal(String(failedPreflightState.blueprintStructureHint).includes('branch-low'), true)

const stopDecision = resolveFlowBlueprintPreflightStopDecision({
  state: failedPreflightState,
  now: 1,
  hasSuccessfulBlueprintCall: false,
  madeProgressThisRound: false,
})
assert.equal(stopDecision.kind, 'finish')
if (stopDecision.kind === 'finish') {
  // 暂存区可能还留着旧版本，收口文案不能断言“蓝图没有生成完成”。
  assert.equal(stopDecision.assistantMessage.includes('本次流程蓝图没有继续生成'), true)
  assert.equal(stopDecision.assistantMessage.includes('已停止自动重试'), true)
  assert.equal(stopDecision.assistantMessage.includes('人员来源'), false)
}

const restoredPrompt = buildRestoredFlowBlueprintPreflightPrompt(failedPreflightState)
assert.equal(restoredPrompt.includes('branches 写进了 options'), true)

const personnelStopDecision = resolveFlowBlueprintPreflightStopDecision({
  state: { ...failedPreflightState, lastFailureCode: 'flow_personnel_source_mismatch' },
  now: 1,
  hasSuccessfulBlueprintCall: false,
  madeProgressThisRound: false,
})
assert.equal(personnelStopDecision.kind, 'finish')
if (personnelStopDecision.kind === 'finish') {
  assert.equal(personnelStopDecision.assistantMessage.includes('本次流程蓝图里的人员来源'), true)
}

console.log('flow generation three fixes guards: ok')
