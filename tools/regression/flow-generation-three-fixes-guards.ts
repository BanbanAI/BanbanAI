import assert from 'node:assert/strict'

import { normalizeNocodeEditorAiMessageHistory } from '../../src/common/utils/nocodeEditorAiMessageHistory'
import {
  createFlowBlueprintPreflightState,
  type FlowBlueprintPreflightState,
} from '../../src/common/utils/nocodeEditorFlowBlueprintPreflight'
import { projectFlowBlueprintPreflightActions } from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-blueprint-preflight.util'
import { shouldHideFlowBlueprintPreflightFallbackSchemeArtifact } from '../../src/renderer/views/nocode/views/editor/ai/flowSchemeArtifactState'

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

console.log('flow generation three fixes guards: ok')
