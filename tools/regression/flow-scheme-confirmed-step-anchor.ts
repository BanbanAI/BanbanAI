import assert from 'node:assert/strict'

import type { NocodeEditorFlowScheme } from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  reconcileFlowSchemeConfirmedAnchors,
  validateFlowSchemeReferences,
} from '../../src/common/utils/nocodeEditorFlowSchemeReferences'

const asScheme = (value: Record<string, unknown>) => value as unknown as NocodeEditorFlowScheme

const confirmedOwnerQuestion = (input: {
  stepKey: string
  sourceType: string
  selectedValue?: string
  answerSummary?: string
}) => ({
  id: 'q-approval-owner',
  decisionKey: 'flow.approval.owner.source',
  title: '审批人来源',
  questionKind: 'single_select',
  options: [{
    value: input.selectedValue || input.sourceType,
    label: input.sourceType,
    selected: true,
    personnelCandidate: { sourceType: input.sourceType, status: 'supported' },
  }],
  personnelDecision: { stepKey: input.stepKey, slot: 'source' },
  decisionScope: { kind: 'step', id: input.stepKey },
  confirmed: true,
  selectedOptionValue: input.selectedValue || input.sourceType,
  answerSummary: input.answerSummary || input.sourceType,
})

const pendingLevelQuestion = (stepKey: string) => ({
  id: 'q-dept-manager-level',
  decisionKey: 'flow.approval.owner.dept_manager_level',
  title: '部门主管审批层级',
  questionKind: 'single_select',
  options: [{ value: 'up-1', label: '直属部门主管' }],
  personnelDecision: { stepKey, slot: 'source' },
  decisionScope: { kind: 'step', id: stepKey },
})

const previousSingleApproval = () => asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '报销申请单提交后由部门字段人员审批',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [{
    key: 'step-approval-main',
    kind: 'approval',
    title: '审批报销申请',
    intent: '审批人审核报销申请',
    personnelRequirement: {
      sourceType: 'form_department',
      fieldRef: { fieldId: 'f_q5vfey59gfr6', fieldName: '报销部门', expectedType: 'departmentSelect' },
    },
  }],
  branches: [],
  confirmation: {
    stage: 'flow-scheme',
    status: 'completed',
    questions: [confirmedOwnerQuestion({ stepKey: 'step-approval-main', sourceType: 'form_department' })],
  },
})

// 1) 用户改成分支结构后，旧确认没有可承载的步骤：按“被本轮调整作废”处理，不再阻断暂存
const restructuredScheme = asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '按金额分流审批',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [],
  branches: [
    {
      key: 'branch-low',
      title: '1000元以内',
      when: '合计金额 <= 1000',
      steps: [{
        key: 'step-approval-finance-low',
        kind: 'approval',
        title: '财务审批',
        intent: '财务审批',
        personnelRequirement: { sourceType: 'fixed_roles', roleRefs: [{ id: 'role-finance', name: '财务' }] },
      }],
    },
    {
      key: 'branch-high',
      title: '1000元以上',
      when: '合计金额 > 1000',
      steps: [
        {
          key: 'step-approval-finance-high',
          kind: 'approval',
          title: '财务审批',
          intent: '财务审批',
          personnelRequirement: { sourceType: 'fixed_roles', roleRefs: [{ id: 'role-finance', name: '财务' }] },
        },
        {
          key: 'step-approval-dept-mgr',
          kind: 'approval',
          title: '部门主管审批',
          intent: '部门主管审批',
          personnelRequirement: { sourceType: 'department_manager', departmentManager: { mode: 'up', level: 1 } },
        },
      ],
    },
  ],
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [pendingLevelQuestion('step-approval-dept-mgr')],
  },
})

const restructured = reconcileFlowSchemeConfirmedAnchors({
  scheme: restructuredScheme,
  previousScheme: previousSingleApproval(),
})
assert.deepEqual(restructured.blockers, [])
assert.equal(restructured.notices.length, 1)
assert.equal(restructured.notices[0].code, 'flow_confirmed_decision_superseded_by_replan')
assert.equal(restructured.notices[0].message.includes('step-approval-main'), false)
assert.equal(restructured.scheme.confirmation?.questions.length, 1)
assert.deepEqual(validateFlowSchemeReferences(restructured.scheme, previousSingleApproval()), [])

// 2) 方案仍保留该确认题、只是步骤改名：唯一候选时把锚点迁移过去，而不是报删除
const renamedStepScheme = asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '审批步骤改名',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [{
    key: 'step-approval-finance',
    kind: 'approval',
    title: '财务审批',
    intent: '审批人审核报销申请',
    personnelRequirement: {
      sourceType: 'form_department',
      fieldRef: { fieldId: 'f_q5vfey59gfr6', fieldName: '报销部门', expectedType: 'departmentSelect' },
    },
  }],
  branches: [],
  confirmation: {
    stage: 'flow-scheme',
    status: 'completed',
    questions: [confirmedOwnerQuestion({ stepKey: 'step-approval-main', sourceType: 'form_department' })],
  },
})
const renamed = reconcileFlowSchemeConfirmedAnchors({
  scheme: renamedStepScheme,
  previousScheme: previousSingleApproval(),
})
assert.deepEqual(renamed.blockers, [])
assert.equal(renamed.notices[0].code, 'flow_confirmed_step_reanchored')
assert.equal(renamed.scheme.confirmation?.questions[0].personnelDecision?.stepKey, 'step-approval-finance')
assert.equal(renamed.scheme.confirmation?.questions[0].decisionScope?.id, 'step-approval-finance')
assert.deepEqual(validateFlowSchemeReferences(renamed.scheme, previousSingleApproval()), [])

// 3) 旧确认消失且新方案留了没配置人员来源的审批步骤：仍视为结论丢失并阻断
const ungroundedScheme = asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '新增一步但没配置人员',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [{
    key: 'step-approval-extra',
    kind: 'approval',
    title: '复核',
    intent: '复核',
  }],
  branches: [],
  confirmation: { stage: 'flow-scheme', status: 'completed', questions: [] },
})
const ungrounded = reconcileFlowSchemeConfirmedAnchors({
  scheme: ungroundedScheme,
  previousScheme: previousSingleApproval(),
})
assert.equal(ungrounded.blockers.length, 1)
assert.equal(ungrounded.blockers[0].code, 'flow_confirmed_step_removed')
assert.deepEqual(ungrounded.blockers[0].candidateStepKeys, ['step-approval-extra'])
assert.equal(ungrounded.blockers[0].message.includes('step-approval-extra'), false)

// 4) 上一版一个人员步骤在新方案里按分支拆成多个同来源步骤：结论已落到全部承接步骤，不阻断
//    （现场：单审批步骤 → 立项/结项两条分支各一个部门主管审批）
const splitScheme = asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '两个同名审批步骤',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [],
  branches: [
    {
      key: 'branch-low',
      title: '1000元以内',
      when: '<= 1000',
      steps: [{
        key: 'step-approval-finance-low',
        kind: 'approval',
        title: '财务审批',
        intent: '财务审批',
        personnelRequirement: { sourceType: 'form_department' },
      }],
    },
    {
      key: 'branch-high',
      title: '1000元以上',
      when: '> 1000',
      steps: [{
        key: 'step-approval-finance-high',
        kind: 'approval',
        title: '财务审批',
        intent: '财务审批',
        personnelRequirement: { sourceType: 'form_department' },
      }],
    },
  ],
  confirmation: {
    stage: 'flow-scheme',
    status: 'completed',
    questions: [confirmedOwnerQuestion({ stepKey: 'step-approval-main', sourceType: 'form_department' })],
  },
})
const split = reconcileFlowSchemeConfirmedAnchors({
  scheme: splitScheme,
  previousScheme: previousSingleApproval(),
})
assert.deepEqual(split.blockers, [])
assert.equal(split.notices.length, 1)
assert.equal(split.notices[0].code, 'flow_confirmed_step_applied_to_split_steps')
assert.deepEqual(
  split.notices[0].candidateStepKeys,
  ['step-approval-finance-low', 'step-approval-finance-high'],
)
assert.equal(split.scheme.confirmation?.questions[0].personnelDecision?.stepKey, 'step-approval-finance-low')
assert.equal(split.scheme.confirmation?.questions[0].decisionScope?.id, 'step-approval-finance-low')
assert.deepEqual(validateFlowSchemeReferences(split.scheme, previousSingleApproval()), [])

// 4b) 多个承接步骤但来源不一致时仍然无法判断归属：保持阻断
const mixedSourceScheme = asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '两个来源不同的审批步骤',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [],
  branches: [
    {
      key: 'branch-low',
      title: '1000元以内',
      when: '<= 1000',
      steps: [{
        key: 'step-approval-finance-low',
        kind: 'approval',
        title: '审批报销申请',
        intent: '审批报销申请',
        personnelRequirement: { sourceType: 'form_department' },
      }],
    },
    {
      key: 'branch-high',
      title: '1000元以上',
      when: '> 1000',
      steps: [{
        key: 'step-approval-finance-high',
        kind: 'approval',
        title: '审批报销申请',
        intent: '审批报销申请',
        personnelRequirement: { sourceType: 'fixed_roles', roleRefs: [{ id: 'role-finance', name: '财务' }] },
      }],
    },
  ],
  confirmation: {
    stage: 'flow-scheme',
    status: 'completed',
    questions: [confirmedOwnerQuestion({ stepKey: 'step-approval-main', sourceType: 'form_department' })],
  },
})
const mixedSource = reconcileFlowSchemeConfirmedAnchors({
  scheme: mixedSourceScheme,
  previousScheme: previousSingleApproval(),
})
assert.equal(mixedSource.blockers.length, 1)
assert.equal(mixedSource.blockers[0].code, 'flow_confirmed_step_removed')

// 5) 修订把步骤清空仍按原规则阻断
const emptied = asScheme({
  id: 'flow-scheme-reimbursement-001',
  title: '报销申请单审批流程',
  summary: '空方案',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [],
  branches: [],
  confirmation: { stage: 'flow-scheme', status: 'completed', questions: [] },
})
assert.equal(
  validateFlowSchemeReferences(emptied, previousSingleApproval())
    .some(item => item.code === 'flow_scheme_empty_after_revision'),
  true,
)

console.log('flow-scheme-confirmed-step-anchor: ok')
