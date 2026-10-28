import assert from 'node:assert/strict'

import {
  buildUnifiedFlowIssuesFromFlowSchemeNotReady,
  type UnifiedFlowIssue,
} from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import { routeUnifiedFlowIssues } from '../../src/common/utils/nocodeEditorFlowIssueRouter'
import { getLatestFlowSchemeWaitingResult } from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-waiting.util'

const notReadyIssues = buildUnifiedFlowIssuesFromFlowSchemeNotReady({})
const notReadyResult = {
  callId: 'call_not_ready',
  name: 'editor_stage_flow_blueprint',
  kind: 'tool',
  ok: false,
  error: '流程方案尚未生成或确认，请先生成并确认流程方案，再暂存流程蓝图。',
  metadata: {
    flowUnifiedIssues: notReadyIssues,
    flowIssueRouting: routeUnifiedFlowIssues(notReadyIssues),
  },
} as any

assert.equal(getLatestFlowSchemeWaitingResult([notReadyResult]), null)

const groundingIssue: UnifiedFlowIssue = {
  issueId: 'approval-owner-missing',
  sourceStage: 'flow-plan',
  category: 'business_gap',
  severity: 'blocking',
  userActionRequired: true,
  returnToStage: 'flow-scheme',
  userMessage: '请确认部门负责人审批人来源',
  questionPayload: {
    id: 'approval_owner',
    title: '部门负责人审批人来源',
    questionKind: 'single_select',
    required: true,
    options: [
      { value: 'direct_manager', label: '直属上级' },
      { value: 'department_owner', label: '部门负责人' },
    ],
  },
}
const groundingResult = {
  callId: 'call_grounding',
  name: 'editor_stage_flow_blueprint',
  kind: 'tool',
  ok: false,
  error: '请确认部门负责人审批人来源',
  metadata: {
    flowUnifiedIssues: [groundingIssue],
    flowIssueRouting: routeUnifiedFlowIssues([groundingIssue]),
  },
} as any

assert.equal(getLatestFlowSchemeWaitingResult([groundingResult]), groundingResult)

console.log('flow-scheme-prerequisite-waiting-guard: ok')
