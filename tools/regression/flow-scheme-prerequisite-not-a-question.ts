import assert from 'node:assert/strict'

import {
  buildUnifiedFlowIssuesFromFlowSchemeNotReady,
  isFlowSchemePrerequisiteMissingIssue,
} from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import {
  projectFlowIssueRouteToLegacyFields,
  routeUnifiedFlowIssues,
} from '../../src/common/utils/nocodeEditorFlowIssueRouter'

const issues = buildUnifiedFlowIssuesFromFlowSchemeNotReady({
  planningContextKey: 'ctx-1',
  blockedNextAction: 'editor_stage_flow_blueprint',
  userMessage: '流程方案尚未生成或确认，请先生成并确认流程方案，再暂存流程蓝图。',
})

assert.equal(issues.length, 1)
assert.equal(issues[0].questionPayload ?? null, null)
assert.equal(isFlowSchemePrerequisiteMissingIssue(issues[0]), true)

const routing = routeUnifiedFlowIssues(issues)
assert.equal(routing.outcome, 'return_to_flow_scheme')

const projection = projectFlowIssueRouteToLegacyFields({
  issues,
  routing,
  planningContextKey: 'ctx-1',
})
assert.equal(projection.flowPrerequisiteMissing, true)
assert.equal(projection.requiredNextAction, 'editor_plan_flow_scheme')
assert.equal(projection.confirmation, null)
assert.deepEqual(projection.openQuestions, [])
assert.equal(projection.blockedNextAction, 'editor_stage_flow_blueprint')

console.log('flow-scheme-prerequisite-not-a-question: ok')
