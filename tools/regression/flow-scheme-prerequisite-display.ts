import assert from 'node:assert/strict'

import { buildUnifiedFlowIssuesFromFlowSchemeNotReady } from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import { resolvePlanningArtifactDisplayState } from '../../src/renderer/views/nocode/views/editor/ai/planningArtifactDisplay'
import { isFlowSchemePrerequisiteMissingBlock } from '../../src/renderer/views/nocode/components/ai/artifactBlock'

;(global as Record<string, unknown>).i18next = {
  t: (key: string) => key,
  resolvedLanguage: 'zh-CN',
  language: 'zh-CN',
}

const issues = buildUnifiedFlowIssuesFromFlowSchemeNotReady({})
const block = {
  type: 'artifact',
  kind: 'flow-scheme',
  status: 'ready',
  title: '报销申请表审批流程方案',
  summary: '流程方案尚未生成或确认，请先生成并确认流程方案，再暂存流程蓝图。',
  planningStatus: 'needs_confirmation',
  scheme: {
    title: '报销申请表审批流程方案',
    summary: '流程方案尚未生成或确认，请先生成并确认流程方案，再暂存流程蓝图。',
    trigger: { type: 'unknown', description: '需要确认' },
    mainPath: [],
    branches: [],
    confirmedFacts: [],
    assumptions: [],
    openQuestions: [{
      key: 'flow-scheme-not-ready-for-blueprint',
      title: '先生成并确认流程方案',
      reason: '流程方案尚未生成或确认',
      scopeKind: 'global',
    }],
  },
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    requiredNextAction: 'editor_plan_flow_scheme',
    questions: [{
      id: 'flow-scheme-not-ready-for-blueprint',
      title: '先生成并确认流程方案',
      questionKind: 'note_only',
      required: true,
      allowFreeText: true,
    }],
  },
  flowUnifiedIssues: issues,
} as any

assert.equal(isFlowSchemePrerequisiteMissingBlock(block), true)
const state = resolvePlanningArtifactDisplayState({ block })
assert.equal(state.renderAsConfirmation, false)
assert.equal(state.renderAsGenericArtifact, false)

console.log('flow-scheme-prerequisite-display: ok')
