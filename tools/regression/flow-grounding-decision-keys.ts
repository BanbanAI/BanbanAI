import assert from 'node:assert/strict'

import {
  buildFlowGroundingConfirmationQuestions,
  buildFlowGroundingOpenQuestionKey,
  normalizeVisibleQuestion,
} from '../../src/common/utils/nocodeEditorFlowGroundingPresentation'
import type {
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from '../../src/common/utils/nocodeEditorFlowSchemeGrounding'
import {
  reconcileNocodeEditorConfirmationDecisions,
} from '../../src/common/utils/nocodeEditorConfirmationDecisionReconciliation'

const buildDiagnostic = (
  input: Partial<NocodeEditorFlowSchemeGroundingDiagnostic> & { code: string },
): NocodeEditorFlowSchemeGroundingDiagnostic => ({
  message: 'grounding diagnostic',
  ...input,
})

const conditionMissing = (
  input: Partial<NocodeEditorFlowSchemeGroundingDiagnostic> = {},
) => buildDiagnostic({
  code: 'grounding_condition_field_missing',
  fieldRef: { fieldId: 'field-amount', fieldName: '报销总金额' },
  targetFormId: 'form-expense',
  targetFormName: '报销单',
  ...input,
})

// 1. 同一分支的两条条件诊断合并为 1 题，键与 id 都带作用域。
const sameBranchQuestions = buildFlowGroundingConfirmationQuestions([
  conditionMissing({ branchKey: 'branch-1', nodeKey: 'node-a' }),
  conditionMissing({ branchKey: 'branch-1', nodeKey: 'node-b' }),
])
assert.equal(sameBranchQuestions.length, 1)
assert.equal(sameBranchQuestions[0].decisionKey, 'flow.condition.field:branch-1')
assert.equal(sameBranchQuestions[0].id, 'flow-grounding-condition-field-missing:branch-1')
assert.equal(sameBranchQuestions[0].scopeKind, 'trigger-branch')
assert.equal(sameBranchQuestions[0].branchKey, 'branch-1')

// 2. 两个分支各一条诊断拆成 2 题，id 与决策键都唯一。
const splitBranchQuestions = buildFlowGroundingConfirmationQuestions([
  conditionMissing({ branchKey: 'branch-1' }),
  conditionMissing({ branchKey: 'branch-2' }),
])
assert.equal(splitBranchQuestions.length, 2)
assert.deepEqual(
  splitBranchQuestions.map(question => question.decisionKey),
  ['flow.condition.field:branch-1', 'flow.condition.field:branch-2'],
)
assert.equal(new Set(splitBranchQuestions.map(question => question.id)).size, 2)

// 3. 无 branchKey 无 nodeKey 时保持 global 作用域与旧 id。
const globalQuestions = buildFlowGroundingConfirmationQuestions([conditionMissing()])
assert.equal(globalQuestions[0].decisionKey, 'flow.condition.field:global')
assert.equal(globalQuestions[0].id, 'flow-grounding-condition-field-missing')
assert.equal(globalQuestions[0].scopeKind, 'overview')

// 4. 同一作用域下 missing 与 forbidden 共用决策键前缀。
const missingAndForbiddenQuestions = buildFlowGroundingConfirmationQuestions([
  conditionMissing({ branchKey: 'branch-1' }),
  buildDiagnostic({
    code: 'grounding_condition_field_forbidden',
    branchKey: 'branch-1',
    fieldRef: { fieldId: 'field-amount', fieldName: '报销总金额' },
  }),
])
assert.equal(missingAndForbiddenQuestions.length, 2)
assert.deepEqual(
  missingAndForbiddenQuestions.map(question => question.decisionKey),
  ['flow.condition.field:branch-1', 'flow.condition.field:branch-1'],
)
assert.notEqual(missingAndForbiddenQuestions[0].id, missingAndForbiddenQuestions[1].id)

// 5. 单条诊断写入 decisionTarget，后续确定性消费无需再猜字段。
const [singleTargetQuestion] = globalQuestions
assert.deepEqual(singleTargetQuestion.decisionTarget, {
  kind: 'field-source',
  formKey: 'form-expense',
  formName: '报销单',
  fieldKey: 'field-amount',
  fieldName: '报销总金额',
})

// 6. owner 诊断不生成决策键，行为与改造前一致。
const [ownerQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_owner_field_missing',
    branchKey: 'branch-1',
    ownerUsage: 'approval_owner',
  }),
])
assert.equal(ownerQuestion.decisionKey, undefined)
assert.equal(ownerQuestion.id, 'flow-grounding-owner-field')
assert.equal(ownerQuestion.scopeKind, 'overview')
assert.equal(ownerQuestion.decisionTarget, undefined)

// 7. 渲染层归一化保留模型题上的身份字段。
const preservedQuestion = normalizeVisibleQuestion({
  id: 'model-question',
  decisionKey: 'flow.condition.field:branch-1',
  decisionKeySource: 'explicit',
  decisionTarget: {
    kind: 'field-source',
    formKey: 'form-expense',
    formName: '报销单',
    fieldKey: 'field-amount',
    fieldName: '报销总金额',
  },
  title: '条件判断字段选择',
  questionKind: 'single_select',
  options: [{ value: 'choose-another-condition-field', label: '改用其他判断字段' }],
})
assert.equal(preservedQuestion?.decisionKey, 'flow.condition.field:branch-1')
assert.equal(preservedQuestion?.decisionKeySource, 'explicit')
assert.deepEqual(preservedQuestion?.decisionTarget, {
  kind: 'field-source',
  formKey: 'form-expense',
  formName: '报销单',
  fieldKey: 'field-amount',
  fieldName: '报销总金额',
})
// 旧卡没有 decisionKey 时保持原 id 与原行为。
const legacyVisibleQuestion = normalizeVisibleQuestion({
  id: 'flow-grounding-condition-field-missing',
  title: 'AI 规划的条件判断还缺少字段',
  questionKind: 'single_select',
  options: [{ value: 'choose-another-condition-field', label: '改用其他判断字段' }],
})
assert.equal(legacyVisibleQuestion?.id, 'flow-grounding-condition-field-missing')
assert.equal(legacyVisibleQuestion?.decisionKey, undefined)

// 8. shell 方案的 openQuestions[].key 直接复用确认题的决策键。
assert.equal(
  buildFlowGroundingOpenQuestionKey(splitBranchQuestions[0], 0),
  'flow.condition.field:branch-1',
)
assert.equal(
  buildFlowGroundingOpenQuestionKey({ id: 'legacy-id', title: '旧题' }, 2),
  'legacy-id',
)

// 9. 同键跨版本继承：新题换 id、换标题，答案仍按决策键继承。
const decisionKey = 'flow.condition.field:branch-1'
const previousQuestion = {
  id: 'flow-grounding-condition-field-missing:branch-1',
  decisionKey,
  title: 'AI 规划的条件判断引用了表单“报销单”中没有的字段',
  questionKind: 'single_select' as const,
  scopeKind: 'trigger-branch' as const,
  branchKey: 'branch-1',
  required: true,
  options: [
    { value: 'use-existing-condition-field:field-user', label: '改用现有字段“报销人”' },
    { value: 'choose-another-condition-field', label: '改用其他判断字段' },
  ],
}
const reconciliation = reconcileNocodeEditorConfirmationDecisions({
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [{
      id: 'flow-grounding-condition-field-missing:branch-1:replanned',
      decisionKey,
      title: '待确认 1 项 · 条件判断字段选择',
      questionKind: 'single_select',
      scopeKind: 'trigger-branch',
      branchKey: 'branch-1',
      required: true,
      options: previousQuestion.options.map(option => ({ ...option })),
    }],
  },
  previousConfirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [previousQuestion],
  },
  previousDecisions: [{
    questionId: previousQuestion.id,
    questionTitle: previousQuestion.title,
    decisionKey,
    selectedOptionValue: 'choose-another-condition-field',
    answerDetail: '报销总额',
    planningContextKey: 'ctx-expense',
  }],
  expectedPlanningContextKey: 'ctx-expense',
})
assert.deepEqual(reconciliation.inheritedDecisionKeys, [decisionKey])
assert.deepEqual(reconciliation.resolvedDecisionKeys, [decisionKey])
assert.equal(reconciliation.confirmation?.questions[0]?.confirmed, true)
assert.equal(
  reconciliation.confirmation?.questions[0]?.selectedOptionValue,
  'choose-another-condition-field',
)

// 10. missing → forbidden：模板变化但推荐字段集合稳定时，按同一决策键沿用答案。
const compatibleFields = [
  { fieldId: 'field-user', fieldName: '报销人' },
  { fieldId: 'field-dept', fieldName: '报销部门' },
]
const [missingQuestion] = buildFlowGroundingConfirmationQuestions([
  conditionMissing({ branchKey: 'branch-1', compatibleFields }),
])
const [forbiddenQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_condition_field_forbidden',
    branchKey: 'branch-1',
    targetFormId: 'form-expense',
    targetFormName: '报销单',
    fieldRef: { fieldId: 'field-amount', fieldName: '报销总金额' },
    compatibleFields,
  }),
])
assert.equal(missingQuestion.decisionKey, 'flow.condition.field:branch-1')
assert.equal(forbiddenQuestion.decisionKey, 'flow.condition.field:branch-1')
const capabilityChangeReconciliation = reconcileNocodeEditorConfirmationDecisions({
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [forbiddenQuestion],
  },
  previousConfirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [missingQuestion],
  },
  previousDecisions: [{
    questionId: missingQuestion.id,
    questionTitle: missingQuestion.title,
    decisionKey: String(missingQuestion.decisionKey),
    selectedOptionValue: 'choose-another-condition-field',
    answerDetail: '报销总额',
    planningContextKey: 'ctx-expense',
  }],
  expectedPlanningContextKey: 'ctx-expense',
})
assert.deepEqual(
  capabilityChangeReconciliation.inheritedDecisionKeys,
  ['flow.condition.field:branch-1'],
)
assert.equal(capabilityChangeReconciliation.confirmation?.questions[0]?.confirmed, true)

// 补充：五类合成题的能力前缀与顺序写入的 global 兼容 id。
const sourceFieldQuestions = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_source_field_missing',
    branchKey: 'branch-1',
    fieldRef: { fieldId: 'source-amount', fieldName: '金额' },
  }),
  buildDiagnostic({
    code: 'grounding_source_field_conflict',
    nodeKey: 'node-审批',
    message: '来源字段指向“金额”和“部门”冲突',
  }),
])
assert.deepEqual(
  sourceFieldQuestions.map(question => question.decisionKey),
  ['flow.source.field:branch-1', 'flow.source.field:node-审批'],
)

const [sourceTableQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_source_table_missing',
    message: '未找到来源表单“报销明细”',
  }),
])
assert.equal(sourceTableQuestion.decisionKey, 'flow.source.table:global')

const [writeQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_write_field_forbidden',
    fieldRef: { fieldId: 'status', fieldName: '状态' },
  }),
])
assert.equal(writeQuestion.decisionKey, 'flow.write.field:global')

const [sequentialQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({ code: 'grounding_sequential_write_conflict' }),
])
assert.equal(sequentialQuestion.decisionKey, 'flow.write.sequential:global')
assert.equal(sequentialQuestion.id, 'flow-grounding-sequential-write-conflict')

console.log('flow grounding decision keys: ok')
