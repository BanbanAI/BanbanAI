import assert from 'node:assert/strict'

import type { NocodeEditorAiConfirmQuestion } from '../../src/common/types/nocodeEditorConfirmation'
import {
  projectFlowDecisionQuestions,
  validateRawFlowDecisionContract,
} from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  resolveFlowConfirmationPendingQuestionProjection,
} from '../../src/common/utils/nocodeEditorFlowConfirmationPendingQuestions'
import { normalizeNocodeEditorFlowScheme } from '../../src/common/utils/nocodeEditorFlowScheme'

const createScheme = (input: {
  openQuestionKeys: string[]
  dependsOnApprovalLevels: boolean
  deptManagerChanges?: NocodeEditorAiConfirmQuestion['changes']
}) => {
  const questions: NocodeEditorAiConfirmQuestion[] = [
    {
      id: 'q1',
      decisionKey: 'approval_levels',
      title: '审批层级',
      description: '选择报销申请的审批层级结构',
      questionKind: 'single_select',
      options: [
        { value: 'two_levels', label: '两级审批' },
        { value: 'three_levels', label: '三级审批' },
      ],
      required: true,
      dependsOn: [],
      decisionScope: { kind: 'flow', id: 'flow-reimbursement' },
      requiresFacts: [],
      producesFacts: [],
      changes: ['topology'],
    },
    {
      id: 'q2',
      decisionKey: 'dept_manager_source',
      title: '部门负责人来源',
      description: '确认部门负责人审批节点的审批人来源',
      questionKind: 'binary',
      options: [
        { value: 'yes', label: '是' },
        { value: 'no', label: '否' },
      ],
      required: true,
      ...(input.dependsOnApprovalLevels ? { dependsOn: ['approval_levels'] } : { dependsOn: [] }),
      decisionScope: { kind: 'step', id: 'dept_approval' },
      requiresFacts: [],
      producesFacts: [],
      changes: input.deptManagerChanges ?? ['binding'],
    },
    {
      id: 'q3',
      decisionKey: 'attachment_note',
      title: '附件说明',
      description: '可选补充附件说明',
      questionKind: 'note_only',
      required: false,
      options: [],
      dependsOn: [],
      decisionScope: { kind: 'flow', id: 'flow-reimbursement' },
      requiresFacts: [],
      producesFacts: [],
      changes: [],
    },
  ]
  return {
    title: '报销申请单审批流程',
    summary: '员工提交报销申请后，先确认审批层级，再由部门负责人审批。',
    trigger: { type: 'submit', description: '提交报销申请单后自动发起审批流程' },
    target: { formId: 't_form', formName: '报销申请单' },
    mainPath: [{
      key: 'dept_approval',
      kind: 'approval',
      title: '部门负责人审批',
      intent: '由部门负责人审批报销申请',
    }],
    branches: [],
    confirmedFacts: [],
    assumptions: [],
    openQuestions: input.openQuestionKeys.map(key => ({
      key,
      title: key === 'approval_levels' ? '审批层级' : '部门负责人来源',
      reason: key === 'approval_levels' ? '确认审批层级结构' : '确认审批人来源',
      scopeKind: key === 'approval_levels' ? 'global' : 'step',
      ...(key === 'approval_levels' ? {} : { scopeKey: 'dept_approval' }),
    })),
    confirmation: {
      decisionContractVersion: 2,
      factSnapshot: {},
      questions,
    },
  }
}

// 依赖题还没轮到却被写进 openQuestions，不再让整份方案失败。
const linkedScheme = createScheme({
  openQuestionKeys: ['approval_levels', 'dept_manager_source'],
  dependsOnApprovalLevels: true,
})
assert.deepEqual(validateRawFlowDecisionContract(linkedScheme), [])
const linkedStates = projectFlowDecisionQuestions(linkedScheme.confirmation.questions).states
assert.equal(linkedStates.get('approval_levels'), 'ready')
assert.equal(linkedStates.get('dept_manager_source'), 'blocked_by_prerequisite')
assert.equal(linkedStates.get('attachment_note'), 'ready')

const linkedSchemeNormalized = normalizeNocodeEditorFlowScheme(linkedScheme)
assert.ok(linkedSchemeNormalized)
assert.deepEqual(
  linkedSchemeNormalized.openQuestions.map(question => question.key).sort(),
  ['approval_levels', 'dept_manager_source'],
)
// required:false 的可选问题不能被补成必答。
const optionalQuestion = linkedSchemeNormalized.confirmation?.questions
  .find(question => question.decisionKey === 'attachment_note')
assert.equal(optionalQuestion?.required, false)
assert.equal(
  linkedSchemeNormalized.openQuestions.some(question => question.key === 'attachment_note'),
  false,
)
const linkedPendingInput = {
  questions: linkedSchemeNormalized.confirmation!.questions,
  factSnapshot: linkedSchemeNormalized.confirmation!.factSnapshot,
  restrictToDecisionKeys: linkedSchemeNormalized.openQuestions.map(question => question.key),
  requireReady: true,
}
assert.deepEqual(
  resolveFlowConfirmationPendingQuestionProjection(linkedPendingInput)
    .pendingQuestions.map(question => question.decisionKey),
  ['approval_levels'],
)
// 前置题答完后，后置题不需要重新暂存方案就能变成可答题。
assert.deepEqual(
  resolveFlowConfirmationPendingQuestionProjection({
    ...linkedPendingInput,
    decisionSnapshot: { approval_levels: 'two_levels' },
  }).pendingQuestions.map(question => question.decisionKey),
  ['dept_manager_source'],
)

// 可答题被漏写时归一化会补齐，避免 readiness 一直 pending 却没有卡片可答。
const omittedScheme = createScheme({
  openQuestionKeys: ['approval_levels'],
  dependsOnApprovalLevels: false,
  deptManagerChanges: [],
})
assert.deepEqual(validateRawFlowDecisionContract(omittedScheme), [])
const omittedSchemeNormalized = normalizeNocodeEditorFlowScheme(omittedScheme)
assert.ok(omittedSchemeNormalized)
assert.deepEqual(
  omittedSchemeNormalized.openQuestions.map(question => question.key).sort(),
  ['approval_levels', 'dept_manager_source'],
)
const synthesized = omittedSchemeNormalized.openQuestions
  .find(question => question.key === 'dept_manager_source')
assert.equal(synthesized?.title, '部门负责人来源')
assert.equal(synthesized?.scopeKind, 'step')
assert.equal(synthesized?.scopeKey, 'dept_approval')

// 后置题声明了 lower-tier 变化时会被层级排序挡住，不再补进本轮 openQuestions。
const orderedSchemeNormalized = normalizeNocodeEditorFlowScheme(createScheme({
  openQuestionKeys: ['approval_levels'],
  dependsOnApprovalLevels: false,
}))
assert.ok(orderedSchemeNormalized)
assert.deepEqual(
  orderedSchemeNormalized.openQuestions.map(question => question.key),
  ['approval_levels'],
)

// 凭空造出来的键仍然是硬错误，并且回传原因。
assert.deepEqual(
  validateRawFlowDecisionContract(createScheme({
    openQuestionKeys: ['approval_levels', 'invented_key'],
    dependsOnApprovalLevels: true,
  })),
  [{ code: 'open_question_confirmation_mismatch', decisionKey: 'invented_key', reason: 'unknown_key' }],
)

console.log('flow decision open question projection: ok')
