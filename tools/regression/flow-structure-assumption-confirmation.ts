import assert from 'node:assert/strict'

import type { NocodeEditorAiConfirmQuestion } from '../../src/common/types/nocodeEditorConfirmation'
import { validateFlowStructureAssumptions } from '../../src/common/utils/nocodeEditorFlowStructureAssumption'
import { resolveFlowConfirmationPendingQuestionProjection } from '../../src/common/utils/nocodeEditorFlowConfirmationPendingQuestions'
import { normalizeNocodeEditorFlowScheme } from '../../src/common/utils/nocodeEditorFlowScheme'

const question = (
  patch: Partial<NocodeEditorAiConfirmQuestion> & Pick<NocodeEditorAiConfirmQuestion, 'id' | 'title'>,
): NocodeEditorAiConfirmQuestion => ({
  decisionKey: 'q',
  questionKind: 'single_select',
  dependsOn: [],
  prerequisites: [],
  decisionScope: { kind: 'flow', id: 'reimbursement-approval-flow' },
  requiresFacts: [],
  producesFacts: [],
  changes: [],
  options: [{ value: 'a', label: 'A' }],
  ...patch,
})

const splitBasisQuestion = question({
  id: 'q_split_basis',
  decisionKey: 'flow.split_basis',
  title: '是否按金额分流？',
  changes: ['topology'],
  options: [
    { value: 'by_amount', label: '按金额分流' },
    { value: 'no_split', label: '不分流' },
  ],
})

const thresholdQuestion = question({
  id: 'q_amount_threshold',
  decisionKey: 'amount_threshold',
  title: '金额分流阈值是多少？',
  dependsOn: ['flow.split_basis'],
  prerequisites: [{
    decisionKey: 'flow.split_basis',
    operator: 'in',
    values: ['by_amount'],
  }],
  changes: ['strategy'],
  options: [
    { value: '5000', label: '5000元' },
    { value: '10000', label: '10000元' },
  ],
  allowFreeText: true,
})

const structureAssumption = {
  text: '采用金额分流模式，小额只需主管审批，大额需主管+财务双重审批',
  impact: 'structure',
  decisionKey: 'flow.split_basis',
  dependentDecisionKeys: ['amount_threshold'],
}

const scheme = (
  assumptions: unknown[],
  questions: NocodeEditorAiConfirmQuestion[] = [splitBasisQuestion, thresholdQuestion],
) => ({
  title: '报销申请审批流程方案',
  summary: '员工提交报销申请后，按报销总金额分流',
  trigger: { type: 'submit', description: '员工提交报销申请时自动发起' },
  mainPath: [],
  branches: [],
  confirmedFacts: [],
  assumptions,
  openQuestions: [{
    key: 'flow.split_basis',
    title: '是否按金额分流？',
    reason: '用户没有指定分流依据',
    scopeKind: 'global',
  }],
  confirmation: {
    status: 'pending',
    decisionContractVersion: 2,
    factSnapshot: {},
    questions,
  },
})

// 1) 合法：结构假设绑定了结构题，下游题声明了 prerequisites
assert.deepEqual(
  validateFlowStructureAssumptions(scheme([structureAssumption])),
  [],
)

// 2) 截图场景的前后顺序：结构题先出，阈值题等结构确认后再出
const projection = (decisionSnapshot?: Record<string, string>) => (
  resolveFlowConfirmationPendingQuestionProjection({
    questions: [splitBasisQuestion, thresholdQuestion],
    factSnapshot: {},
    decisionSnapshot,
    requireReady: true,
  })
)
assert.deepEqual(
  projection().pendingQuestions.map(item => item.decisionKey),
  ['flow.split_basis'],
)
assert.deepEqual(
  projection({ 'flow.split_basis': 'by_amount' }).pendingQuestions.map(item => item.decisionKey),
  ['amount_threshold'],
)
assert.deepEqual(projection({ 'flow.split_basis': 'no_split' }).pendingQuestions, [])

// 3) 纯字符串假设：新提交必须声明 impact
assert.deepEqual(
  validateFlowStructureAssumptions(scheme(['采用金额分流模式'])).map(item => item.code),
  ['assumption_impact_missing'],
)

// 4) 结构假设没绑定 decisionKey
assert.deepEqual(
  validateFlowStructureAssumptions(scheme([{ text: '采用金额分流模式', impact: 'structure' }]))
    .map(item => item.code),
  ['structure_assumption_decision_missing'],
)

// 5) 绑定的题不存在
assert.deepEqual(
  validateFlowStructureAssumptions(scheme([{
    ...structureAssumption,
    decisionKey: 'missing_question',
  }])).map(item => item.code),
  ['structure_assumption_question_missing'],
)

// 6) 结构题的 changes 不合法（模型写 condition 被过滤后的效果）
assert.deepEqual(
  validateFlowStructureAssumptions(scheme([structureAssumption], [
    { ...splitBasisQuestion, changes: [] },
    thresholdQuestion,
  ])).map(item => item.code),
  ['structure_assumption_question_not_structural'],
)

// 7) 下游题只写 dependsOn、没写 prerequisites
assert.deepEqual(
  validateFlowStructureAssumptions(scheme([structureAssumption], [
    splitBasisQuestion,
    { ...thresholdQuestion, prerequisites: [] },
  ])).map(item => item.code),
  ['structure_assumption_dependent_without_prerequisite'],
)

// 8) 旧暂存方案的字符串假设可以正常读取，不因形状老而报错
const legacyNormalized = normalizeNocodeEditorFlowScheme(scheme(['默认不发送额外通知']))
assert.equal(legacyNormalized?.assumptions[0]?.impact, 'detail')
assert.equal(legacyNormalized?.assumptions[0]?.text, '默认不发送额外通知')

console.log('flow-structure-assumption-confirmation: ok')
