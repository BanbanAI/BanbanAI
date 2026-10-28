import assert from 'node:assert/strict'

import type { NocodeEditorAiConfirmQuestion } from '../../src/common/types/nocodeEditorConfirmation'
import {
  projectFlowDecisionContract,
} from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  projectFlowConfirmationQuestionContract,
  resolveFlowConfirmationPendingQuestionProjection,
} from '../../src/common/utils/nocodeEditorFlowConfirmationPendingQuestions'
import {
  buildNocodeEditorFlowPersonnelSourceOptions,
} from '../../src/common/utils/nocodeEditorFlowPersonnelSourceOptions'

const amountBranchQuestion = (): NocodeEditorAiConfirmQuestion => ({
  id: 'q_amount',
  decisionKey: 'flow.amount_branch',
  title: '是否需要按报销金额分流？',
  questionKind: 'binary',
  required: true,
  options: [
    { value: 'yes', label: '是' },
    { value: 'no', label: '否' },
  ],
  decisionScope: { kind: 'flow', id: 'main' },
  dependsOn: [],
})

const sourceQuestion = (stepKey: string): NocodeEditorAiConfirmQuestion => ({
  id: `q_${stepKey}`,
  decisionKey: `flow.approval.owner.source.${stepKey}`,
  title: `${stepKey} 的审批人来源`,
  questionKind: 'single_select',
  required: true,
  options: buildNocodeEditorFlowPersonnelSourceOptions(),
  decisionScope: { kind: 'step', id: stepKey },
  dependsOn: [],
})

// 截图回放：金额分流题与两道来源题都没有声明依赖，运行时按层级补顺序。
const screenshotQuestions = [
  amountBranchQuestion(),
  sourceQuestion('dept_approval'),
  sourceQuestion('finance_approval'),
]
const screenshotContract = projectFlowDecisionContract(screenshotQuestions)
assert.deepEqual(screenshotContract.diagnostics, [])
assert.equal(screenshotContract.states.get('flow.amount_branch'), 'ready')
assert.equal(
  screenshotContract.states.get('flow.approval.owner.source.dept_approval'),
  'blocked_by_prerequisite',
)
assert.equal(
  screenshotContract.states.get('flow.approval.owner.source.finance_approval'),
  'blocked_by_prerequisite',
)
assert.deepEqual(
  screenshotContract.orderDependencies
    .map(edge => `${edge.dependencyKey}->${edge.decisionKey}`)
    .sort(),
  [
    'flow.amount_branch->flow.approval.owner.source.dept_approval',
    'flow.amount_branch->flow.approval.owner.source.finance_approval',
  ],
)
// 排序边只在投影期计算，不回写契约题。
assert.deepEqual(
  screenshotContract.questions.map(question => question.dependsOn),
  [[], [], []],
)

// 待答投影：首轮只出结构题，答完后来源题同轮出现且保持输入顺序。
const pendingProjection = (decisionSnapshot?: Record<string, string>) => (
  resolveFlowConfirmationPendingQuestionProjection({
    questions: screenshotContract.questions,
    factSnapshot: {},
    requireReady: true,
    ...(decisionSnapshot ? { decisionSnapshot } : {}),
  }).pendingQuestions.map(question => question.decisionKey)
)
assert.deepEqual(pendingProjection(), ['flow.amount_branch'])
assert.deepEqual(pendingProjection({ 'flow.amount_branch': 'no' }), [
  'flow.approval.owner.source.dept_approval',
  'flow.approval.owner.source.finance_approval',
])

// 模型显式写了反向依赖：以模型声明为准，运行时不再补边，也不产生环。
const reverseDependencyQuestions = [
  { ...amountBranchQuestion(), dependsOn: ['flow.approval.owner.source.dept_approval'] },
  sourceQuestion('dept_approval'),
]
const reverseDependencyContract = projectFlowDecisionContract(reverseDependencyQuestions)
assert.deepEqual(reverseDependencyContract.orderDependencies, [])
assert.equal(
  reverseDependencyContract.states.get('flow.approval.owner.source.dept_approval'),
  'ready',
)
assert.equal(
  reverseDependencyContract.states.get('flow.amount_branch'),
  'blocked_by_prerequisite',
)
assert.equal(
  reverseDependencyContract.diagnostics.some(item => item.code === 'cycle'),
  false,
)

// 历史方案成环：投影正常返回，环外同层题仍是唯一可答题。
const cyclicQuestions = [
  { ...amountBranchQuestion(), dependsOn: ['flow.approval.owner.source.dept_approval'] },
  { ...sourceQuestion('dept_approval'), dependsOn: ['flow.amount_branch'] },
  { ...amountBranchQuestion(), id: 'q_scope', decisionKey: 'flow.scope_switch', title: '是否只覆盖本部门？' },
]
const cyclicContract = projectFlowDecisionContract(cyclicQuestions)
assert.equal(
  projectFlowConfirmationQuestionContract({ questions: cyclicQuestions }).invalid,
  true,
)
assert.deepEqual(
  cyclicContract.ready.map(question => question.decisionKey),
  ['flow.scope_switch'],
)

// 坏边隔离：只有被点名的题被移出待答列表，无关题仍可回答。
const duplicateFactQuestions = [
  { ...sourceQuestion('dept_approval'), producesFacts: ['flow.owner.source'] },
  { ...sourceQuestion('finance_approval'), producesFacts: ['flow.owner.source'] },
]
const duplicateFactContract = projectFlowConfirmationQuestionContract({
  questions: duplicateFactQuestions,
})
assert.equal(duplicateFactContract.invalid, true)
assert.deepEqual(
  resolveFlowConfirmationPendingQuestionProjection({
    questions: duplicateFactQuestions,
    factSnapshot: {},
    requireReady: true,
  }).pendingQuestions.map(question => question.decisionKey),
  ['flow.approval.owner.source.dept_approval'],
)

// 无结构化信号：不排序，两题同轮可答。
const legacyQuestions: NocodeEditorAiConfirmQuestion[] = [
  {
    id: 'legacy_a',
    decisionKey: 'legacy.option_a',
    title: '选择 A',
    questionKind: 'single_select',
    required: true,
    options: [{ value: 'a1', label: 'A1' }, { value: 'a2', label: 'A2' }],
    dependsOn: [],
  },
  {
    id: 'legacy_b',
    decisionKey: 'legacy.option_b',
    title: '选择 B',
    questionKind: 'single_select',
    required: true,
    options: [{ value: 'b1', label: 'B1' }, { value: 'b2', label: 'B2' }],
    dependsOn: [],
  },
]
const legacyContract = projectFlowDecisionContract(legacyQuestions)
assert.deepEqual(legacyContract.orderDependencies, [])
assert.deepEqual(
  legacyContract.ready.map(question => question.decisionKey).sort(),
  ['legacy.option_a', 'legacy.option_b'],
)

console.log('flow decision order tiers: ok')
