import assert from 'node:assert/strict'

import {
  ensurePendingFlowQuestionsAnswerable,
} from '../../src/common/utils/nocodeEditorFlowQuestionAnswerSpace'
import {
  normalizeNocodeEditorFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import type { NocodeEditorAiConfirmQuestion } from '../../src/common/types/nocodeEditorConfirmation'

const buildQuestion = (
  overrides: Partial<NocodeEditorAiConfirmQuestion> = {},
): NocodeEditorAiConfirmQuestion => ({
  id: 'q-1',
  decisionKey: 'flow.trigger.type',
  title: '触发方式',
  questionKind: 'note_only',
  required: true,
  allowFreeText: true,
  dependsOn: [],
  ...overrides,
})

// 1. 结构决策被宿主打回待确认后，触发方式要补成可点选答案。
const triggerQuestion = ensurePendingFlowQuestionsAnswerable({
  stage: 'flow-scheme',
  status: 'pending',
  questions: [buildQuestion()],
})!.questions![0]
assert.equal(triggerQuestion.questionKind, 'single_select')
assert.deepEqual(
  triggerQuestion.options?.map(option => option.value),
  ['submit', 'update', 'manual', 'schedule'],
)
assert.ok(triggerQuestion.options?.every(option => Boolean(option.label)))
assert.ok(String(triggerQuestion.description || '').includes('触发方式'))
assert.equal(triggerQuestion.confirmed, undefined)
assert.equal(triggerQuestion.allowFreeText, true)

// 2. 已确认的记录题不动（不能把用户的确认结果重新变成待答）。
const confirmedQuestion = buildQuestion({
  confirmed: true,
  answerSummary: '提交后自动发起',
})
assert.deepEqual(
  ensurePendingFlowQuestionsAnswerable({
    stage: 'flow-scheme',
    status: 'completed',
    questions: [confirmedQuestion],
  })!.questions,
  [confirmedQuestion],
)

// 3. required=false 的说明项不动。
const noteQuestion = buildQuestion({ questionKind: 'note_only', required: false })
assert.deepEqual(
  ensurePendingFlowQuestionsAnswerable({
    stage: 'flow-scheme',
    status: 'pending',
    questions: [noteQuestion],
  })!.questions,
  [noteQuestion],
)

// 4. 其他决策键没有词表时，只补一句可执行的说明，不虚构选项。
const unknownKeyQuestion = buildQuestion({
  decisionKey: 'flow.approval.owner.source',
  title: '审批人来源',
})
const describedQuestion = ensurePendingFlowQuestionsAnswerable({
  stage: 'flow-scheme',
  status: 'pending',
  questions: [unknownKeyQuestion],
})!.questions![0]
assert.equal(describedQuestion.questionKind, 'note_only')
assert.equal(describedQuestion.options, undefined)
assert.ok(String(describedQuestion.description || '').includes('审批人来源'))

// 5. 已有至少两个选项的题保持原样。
const selectQuestion = buildQuestion({
  questionKind: 'single_select',
  options: [
    { value: 'submit', label: '提交后自动发起' },
    { value: 'manual', label: '手动发起' },
  ],
})
assert.deepEqual(
  ensurePendingFlowQuestionsAnswerable({
    stage: 'flow-scheme',
    status: 'pending',
    questions: [selectQuestion],
  })!.questions,
  [selectQuestion],
)

// 6. 端到端：复现“模型自答被剥离后只剩空壳触发方式”的方案，归一化后必须带选项。
const normalized = normalizeNocodeEditorFlowScheme({
  id: 'reimbursement-approval-flow',
  title: '报销申请审批流程',
  summary: '员工提交报销申请后，由部门主管审批，审批通过后自动更新审批状态',
  target: { formId: 't_cyd9xn5lk5yb', formName: '报销申请' },
  trigger: { type: 'submit', description: '提交表单后自动发起审批流程' },
  mainPath: [
    {
      key: 'approval-dept-manager',
      kind: 'approval',
      title: '部门主管审批',
      personnelRequirement: {
        sourceType: 'department_manager',
        departmentManager: { mode: 'up', level: 1 },
      },
    },
  ],
  branches: [],
  confirmedFacts: ['表单已有审批状态字段'],
  assumptions: [],
  openQuestions: [{ key: 'flow.trigger.type', title: '触发方式', reason: '触发方式', scopeKind: 'global' }],
  decisionContractVersion: 2,
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    decisionContractVersion: 2,
    questions: [{
      id: 'q-1',
      decisionKey: 'flow.trigger.type',
      title: '触发方式',
      questionKind: 'note_only',
      scopeKind: 'overview',
      required: true,
      allowFreeText: true,
      decisionScope: { kind: 'flow', id: 'reimbursement-approval-flow' },
      requiresFacts: [],
      producesFacts: ['trigger_type'],
      changes: ['topology'],
      dependencySources: {},
      dependsOn: [],
      confirmed: false,
    }],
    decisionSnapshot: {},
  },
})!

const normalizedTrigger = (normalized.confirmation?.questions || [])
  .find(question => question.decisionKey === 'flow.trigger.type')
assert.ok(normalizedTrigger, '归一化后触发方式题不能丢失')
assert.equal(normalizedTrigger.questionKind, 'single_select')
assert.equal(normalizedTrigger.options?.length, 4)
assert.equal(normalizedTrigger.confirmed, false)
assert.ok(String(normalizedTrigger.description || '').includes('触发方式'))
assert.equal(normalized.confirmation?.status, 'pending')
assert.ok((normalized.openQuestions || []).some(question => question.key === 'flow.trigger.type'))

console.log('flow-pending-question-answer-space: ok')
