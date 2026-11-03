import assert from 'node:assert/strict'

import {
  validateRawFlowDecisionContract,
} from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import { normalizeNocodeEditorFlowScheme } from '../../src/common/utils/nocodeEditorFlowScheme'

const baseConfirmation = (questions: Record<string, unknown>[]) => ({
  status: 'pending',
  decisionContractVersion: 2,
  factSnapshot: {},
  questions,
})

// 日志 editor_47nygwhv5oz1…27ed4p：表单域问题只写了 scopeKind，没有 decisionScope 与事实数组。
const formOptionScheme = () => ({
  title: '报销审批流程',
  summary: '提交后由审批人统一审核',
  trigger: { type: 'submit', description: '员工提交报销申请表单后自动发起审批流程' },
  mainPath: [{
    key: 'step_approval',
    kind: 'approval',
    title: '审批报销申请',
    intent: '由审批人对报销申请进行审核',
  }],
  branches: [],
  openQuestions: [],
  confirmation: baseConfirmation([{
    id: 'q_expense_types',
    decisionKey: 'form.expense_type_options',
    title: '费用类型有哪些常见选项？',
    domain: 'form',
    questionKind: 'note_only',
    description: '例如：交通费、餐饮费、住宿费、办公用品、通讯费、差旅费等。',
    allowFreeText: true,
    dependsOn: [],
  }]),
})

// 日志 editor_2bxcevgnevgf…joyp94：三道题都只写了 scopeKind: overview，没有 decisionScope 与事实数组。
const twoStepScheme = () => ({
  title: '报销审批流程',
  summary: '员工提交报销申请后，经部门主管和财务审批完成报销流程',
  trigger: { type: 'submit', description: '员工提交报销表单后触发审批流程' },
  mainPath: [
    {
      key: 'dept_approval',
      kind: 'approval',
      title: '部门主管审批',
      intent: '由报销人所在部门的主管审批报销申请',
    },
    {
      key: 'finance_approval',
      kind: 'approval',
      title: '财务审批',
      intent: '由财务人员审核报销的合规性和金额',
    },
  ],
  branches: [],
  openQuestions: [],
  confirmation: baseConfirmation([
    {
      id: 'q1',
      decisionKey: 'amount_branch',
      title: '是否需要按报销金额设置不同的审批流程',
      questionKind: 'binary',
      domain: 'flow',
      scopeKind: 'overview',
      description: '例如：金额超过5000元需要总经理审批',
      options: [
        { value: 'yes', label: '是，按金额分流' },
        { value: 'no', label: '否，统一流程' },
      ],
      dependsOn: [],
    },
    {
      id: 'q2',
      decisionKey: 'dept_approver_source',
      title: '部门主管审批的审批人来源',
      questionKind: 'single_select',
      domain: 'flow',
      scopeKind: 'overview',
      options: [
        { value: 'dept_manager', label: '提交人所在部门的主管' },
        { value: 'fixed_users', label: '指定固定人员' },
        { value: 'fixed_roles', label: '指定固定角色' },
      ],
      dependsOn: [],
    },
    {
      id: 'q3',
      decisionKey: 'finance_approver_source',
      title: '财务审批的审批人来源',
      questionKind: 'single_select',
      domain: 'flow',
      scopeKind: 'overview',
      options: [
        { value: 'fixed_roles', label: '财务角色' },
        { value: 'fixed_users', label: '指定固定人员' },
        { value: 'dept_manager', label: '财务部主管' },
      ],
      dependsOn: [],
    },
  ]),
})

// 日志 editor_pr29f97hqith…9e76m0：人员决策题写了 personnelDecision.stepKey，只缺 decisionScope。
const branchPersonnelScheme = () => ({
  title: '报销审批流程（按金额分流）',
  summary: '提交报销申请后，根据报销总额分流',
  target: { formId: 't_lcq8woepvvkf', formName: '报销申请' },
  trigger: { type: 'submit', description: '提交报销申请时触发' },
  mainPath: [],
  branches: [
    {
      key: 'branch-under-2000',
      title: '2000元以内',
      when: '报销总额 <= 2000',
      steps: [{
        key: 'step-finance-1',
        kind: 'approval',
        title: '财务审批',
        intent: '财务角色审核报销单据',
      }],
    },
    {
      key: 'branch-over-2000',
      title: '2000元以上',
      when: '报销总额 > 2000',
      steps: [
        {
          key: 'step-dept-manager',
          kind: 'approval',
          title: '部门主管审批',
          intent: '报销部门的主管审核报销单据',
        },
        {
          key: 'step-finance-2',
          kind: 'approval',
          title: '财务审批',
          intent: '财务角色审核报销单据',
        },
      ],
    },
  ],
  openQuestions: [],
  confirmation: baseConfirmation([{
    id: 'flow-personnel:step-dept-manager:source',
    decisionKey: 'flow.approval.owner.source',
    title: '如何确定“部门主管审批”的审批人？',
    questionKind: 'single_select',
    scopeKind: 'overview',
    description: '请选择该节点的审批人来源。',
    required: true,
    allowFreeText: true,
    options: [
      { value: 'submitter', label: '提交人自己' },
      { value: 'assignee', label: '指定成员/角色' },
      { value: 'department_manager', label: '部门主管' },
      { value: 'form_member_field', label: '表单内成员字段' },
      { value: 'form_department_field', label: '表单内部门字段' },
    ],
    personnelDecision: { stepKey: 'step-dept-manager', slot: 'source' },
    requiresFacts: [],
    producesFacts: [],
    changes: [],
    dependsOn: [],
  }]),
})

// 缺 scope 不再打回整份方案；scope 由人员决策、openQuestions 或流程结构补齐。
assert.deepEqual(validateRawFlowDecisionContract(formOptionScheme()), [])
assert.deepEqual(validateRawFlowDecisionContract(twoStepScheme()), [])
assert.deepEqual(validateRawFlowDecisionContract(branchPersonnelScheme()), [])

const normalizedScopeOf = (scheme: unknown, decisionKey: string) => {
  const normalized = normalizeNocodeEditorFlowScheme(scheme)
  assert.ok(normalized)
  const question = normalized.confirmation?.questions
    .find(item => item.decisionKey === decisionKey)
  assert.ok(question, `归一化后丢了确认题 ${decisionKey}`)
  return { kind: question.decisionScope?.kind, id: question.decisionScope?.id }
}

// 人员决策题按 personnelDecision.stepKey 落到对应节点。
assert.deepEqual(
  normalizedScopeOf(branchPersonnelScheme(), 'flow.approval.owner.source'),
  { kind: 'step', id: 'step-dept-manager' },
)
// 结构上找不到归属的题落到整条流程，仍然保留题目本身。
assert.deepEqual(
  normalizedScopeOf(twoStepScheme(), 'amount_branch'),
  { kind: 'flow', id: 'main' },
)
assert.deepEqual(
  normalizedScopeOf(formOptionScheme(), 'form.expense_type_options'),
  { kind: 'flow', id: 'main' },
)

// openQuestions 已声明归属时优先采信。
const linkedOpenQuestionScheme = {
  ...twoStepScheme(),
  openQuestions: [{
    key: 'dept_approver_source',
    title: '部门主管审批的审批人来源',
    reason: '确认审批人来源',
    scopeKind: 'step',
    scopeKey: 'dept_approval',
  }],
}
assert.deepEqual(validateRawFlowDecisionContract(linkedOpenQuestionScheme), [])
assert.deepEqual(
  normalizedScopeOf(linkedOpenQuestionScheme, 'dept_approver_source'),
  { kind: 'step', id: 'dept_approval' },
)

// 显式写了但指向不存在节点仍然硬失败。
const invalidScopeScheme = branchPersonnelScheme()
invalidScopeScheme.confirmation.questions[0].decisionScope = { kind: 'step', id: 'missing-step' }
assert.deepEqual(
  validateRawFlowDecisionContract(invalidScopeScheme),
  [{ code: 'invalid_decision_scope', decisionKey: 'flow.approval.owner.source', scopeKey: 'missing-step' }],
)

// 事实字段写错类型仍然硬失败，缺省才按空数组处理。
const wrongFactTypeScheme = branchPersonnelScheme()
;(wrongFactTypeScheme.confirmation.questions[0] as Record<string, unknown>).requiresFacts = 'oops'
assert.deepEqual(
  validateRawFlowDecisionContract(wrongFactTypeScheme),
  [{ code: 'invalid_fact_snapshot', decisionKey: 'flow.approval.owner.source' }],
)

console.log('flow decision scope derivation: ok')
