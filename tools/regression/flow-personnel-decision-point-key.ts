import assert from 'node:assert/strict'

import {
  buildFlowDecisionStepLookup,
  isApprovalOwnerDecision,
  resolveFlowDependencyDecisionPointRef,
  resolveFlowQuestionDecisionPointRef,
} from '../../src/common/utils/nocodeEditorFlowDecisionIdentity'
import { healFlowSchemeDecisionKeys } from '../../src/common/utils/nocodeEditorFlowDecisionKeyHealing'
import { normalizeUnifiedFlowIssues } from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import { NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS } from '../../src/common/utils/nocodeEditorFlowPersonnelSourceOptions'

const sourceOptions = NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS.map(option => ({ ...option }))

// 同一道审批人来源题在三条路径上的身份：确认题、依赖诊断、已落库的 issue。
const ownerSourceQuestion = {
  id: 'q_dept_owner_source',
  decisionKey: 'flow.approval.owner',
  title: '部门主管由谁审批？',
  questionKind: 'single_select' as const,
  decisionScope: { kind: 'step' as const, id: 'step_dept_approval' },
  options: sourceOptions,
}
const scopedOwnerSourceDependency = {
  id: 'flow-personnel:step_dept_approval:source',
  decisionKey: 'flow.approval.owner',
  kind: 'org_anchor_missing',
  requiredFor: 'approval_owner' as const,
  scopeKind: 'step' as const,
  scopeKey: 'step_dept_approval',
  riskLevel: 'high' as const,
  resolutionStatus: 'unresolved' as const,
  materializationStatus: 'not_available' as const,
  summary: '审批人来源尚未确定',
}

// 1) 有步骤作用域、没有 steps 查找表：三路径都必须落到同一个审批人来源键
const questionRef = resolveFlowQuestionDecisionPointRef({ question: ownerSourceQuestion })
assert.ok(questionRef)
assert.equal(questionRef.key, 'flow.approval.owner.source:step_dept_approval')
assert.equal(questionRef.kind, 'personnel')

const dependencyRef = resolveFlowDependencyDecisionPointRef(scopedOwnerSourceDependency)
assert.ok(dependencyRef)
assert.equal(dependencyRef.key, questionRef.key)
assert.equal(dependencyRef.kind, 'personnel')

const [storedIssue] = normalizeUnifiedFlowIssues([{
  issueId: 'flow-personnel-decision-invalid',
  userMessage: '部门主管由谁审批还没确定',
  questionPayload: ownerSourceQuestion,
}])
assert.ok(storedIssue)
assert.equal(storedIssue.decisionPointKey, questionRef.key)

// 2) 缺步骤键时不产出伪全局人员键：三路径统一回落到原始决策键
const unscopedOwnerSourceQuestion = {
  id: 'q_global_owner_source',
  decisionKey: 'flow.approval.owner',
  title: '审批人由谁担任？',
  questionKind: 'single_select' as const,
  options: sourceOptions,
}
const unscopedQuestionRef = resolveFlowQuestionDecisionPointRef({
  question: unscopedOwnerSourceQuestion,
})
assert.ok(unscopedQuestionRef)
assert.equal(unscopedQuestionRef.key, 'decision:flow.approval.owner')
assert.equal(unscopedQuestionRef.kind, 'decision')

const unscopedDependencyRef = resolveFlowDependencyDecisionPointRef({
  ...scopedOwnerSourceDependency,
  id: 'legacy-approval-owner',
  scopeKind: undefined,
  scopeKey: undefined,
})
assert.ok(unscopedDependencyRef)
assert.equal(unscopedDependencyRef.key, unscopedQuestionRef.key)

const [unscopedStoredIssue] = normalizeUnifiedFlowIssues([{
  issueId: 'flow-personnel-decision-invalid',
  userMessage: '审批人由谁担任还没确定',
  questionPayload: unscopedOwnerSourceQuestion,
}])
assert.ok(unscopedStoredIssue)
assert.equal(unscopedStoredIssue.decisionPointKey, unscopedQuestionRef.key)
// 裸键会让卡片和依赖各自认为决策点不同，正是这次要消掉的漂移。
assert.notEqual(unscopedQuestionRef.key, 'flow.approval.owner')

// 3) 审批人识别：键优先，其次才看步骤类型
assert.equal(
  isApprovalOwnerDecision({ stepKey: 'step_dept_approval', slot: 'source' }, {
    decisionKey: 'flow.approval.owner',
  }),
  true,
)
assert.equal(
  isApprovalOwnerDecision({ stepKey: 'step_dept_approval', slot: 'source' }, {
    decisionKey: 'flow.approval.owner.source:step_dept_approval',
  }),
  true,
)
const steps = buildFlowDecisionStepLookup({
  mainPath: [
    { key: 'step_submit', kind: 'start', title: '提交申请' },
    { key: 'step_dept_approval', kind: 'approval', title: '部门主管审批' },
    { key: 'step_finance', kind: 'transact', title: '财务办理' },
  ],
  branches: [],
} as never)
assert.equal(
  isApprovalOwnerDecision({ stepKey: 'step_dept_approval', slot: 'source' }, {
    decisionKey: 'flow.personnel:step_dept_approval:source',
    steps,
  }),
  true,
)
assert.equal(
  isApprovalOwnerDecision({ stepKey: 'step_finance', slot: 'source' }, {
    decisionKey: 'flow.personnel:step_finance:source',
    steps,
  }),
  false,
)

// 4) 键愈合与决策点身份取同一套题键：只带 questionId 的题也能继承上一版答案键
const healed = healFlowSchemeDecisionKeys({
  scheme: {
    title: '费用报销审批流程',
    mainPath: [{ key: 'step_dept_approval', kind: 'approval', title: '部门主管审批' }],
    branches: [],
    confirmation: {
      status: 'pending',
      questions: [{
        questionId: 'q_owner_source_round_2',
        title: '部门主管由谁审批？',
        decisionScope: { kind: 'step', id: 'step_dept_approval' },
        producesFacts: ['approval_owner'],
      }],
    },
  },
  previousQuestions: [{
    decisionKey: 'flow.approval.owner.source:step_dept_approval',
    title: '部门主管由谁审批？',
    decisionScope: { kind: 'step', id: 'step_dept_approval' },
    producesFacts: ['approval_owner'],
    confirmed: true,
    selectedOptionValue: 'department_manager',
  }],
  answeredDecisions: [{
    decisionKey: 'flow.approval.owner.source:step_dept_approval',
    confirmed: true,
    selectedOptionValue: 'department_manager',
  }],
})
assert.deepEqual(healed.healed, [{
  from: 'q_owner_source_round_2',
  to: 'flow.approval.owner.source:step_dept_approval',
  reason: 'fact',
}])
const [healedQuestion] = (healed.scheme as {
  confirmation: { questions: Array<Record<string, unknown>> }
}).confirmation.questions
assert.equal(healedQuestion.decisionKey, 'flow.approval.owner.source:step_dept_approval')

console.log('flow-personnel-decision-point-key: ok')
