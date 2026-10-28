import assert from 'node:assert/strict'

import { buildUnifiedFlowIssuesFromFlowSchemeNotReady } from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import { routeUnifiedFlowIssues } from '../../src/common/utils/nocodeEditorFlowIssueRouter'
import { buildNocodeEditorToolResultArtifactBlocks } from '../../src/main/modules/ai/nocode-editor/nocode-editor-tool-result-messages'

;(global as Record<string, unknown>).i18next = {
  t: (key: string) => key,
}

const issues = buildUnifiedFlowIssuesFromFlowSchemeNotReady({})
const routing = routeUnifiedFlowIssues(issues)

const blocks = buildNocodeEditorToolResultArtifactBlocks({
  callId: 'call_stage_flow_blueprint',
  name: 'editor_stage_flow_blueprint',
  kind: 'tool',
  ok: false,
  error: '流程方案尚未生成或确认，请先生成并确认流程方案，再暂存流程蓝图。',
  metadata: {
    flowUnifiedIssues: issues,
    flowIssueRouting: routing,
  },
} as any)

assert.equal(
  blocks.some(block => block.type === 'artifact' && block.kind === 'flow-scheme'),
  false,
)

console.log('flow-scheme-prerequisite-no-artifact-block: ok')
