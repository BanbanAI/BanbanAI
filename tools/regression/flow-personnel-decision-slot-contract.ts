import assert from 'node:assert/strict'

import { validateRawFlowPersonnelDecisionSlots } from '../../src/common/utils/nocodeEditorFlowDecisionIdentity'
import { validateFlowStructureAssumptions } from '../../src/common/utils/nocodeEditorFlowStructureAssumption'
import { projectModelActionableFlowDecisionDiagnostics } from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE,
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS,
  FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { resolveRepeatedFlowSchemeError } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'

const fiveSourceOptions = [
  { value: 'submitter', label: '提交人自己' },
  { value: 'assignee', label: '指定成员/角色' },
  { value: 'department_manager', label: '部门主管' },
  { value: 'form_member_field', label: '表单内成员字段' },
  { value: 'form_department_field', label: '表单内部门字段' },
]

const rawScheme = (questions: unknown[]) => ({
  scheme: {
    title: '费用报销申请审批流程方案',
    mainPath: [{ key: 'step_start', kind: 'start', title: '提交申请' }],
    branches: [],
    confirmation: { status: 'pending', questions },
  },
})

// 截图场景原样：触发方式二选一题带着人员来源决策，财务来源题才是真正的人员题。
const triggerQuestion = {
  id: 'q_trigger_type',
  decisionKey: 'flow.trigger.type',
  title: '报销申请由什么方式触发？',
  questionKind: 'binary',
  changes: ['trigger_type'],
  dependsOn: [],
  options: [{ value: 'manual', label: '员工手动提交' }, { value: 'scheduled', label: '定时汇总生成' }],
  personnelDecision: { stepKey: 'step_dept_approval', slot: 'source' },
}
const financeSourceQuestion = {
  id: 'q_finance_source',
  decisionKey: 'flow.approval.owner.source',
  title: '财务审批由谁审批？',
  questionKind: 'single_select',
  changes: ['binding'],
  dependsOn: [],
  options: fiveSourceOptions,
  personnelDecision: { stepKey: 'step_finance_approval', slot: 'source' },
}

// 1) 触发方式题挂人员决策 → 只报这一处，合法来源题不受影响
assert.deepEqual(
  validateRawFlowPersonnelDecisionSlots(rawScheme([triggerQuestion, financeSourceQuestion])),
  [{
    code: 'personnel_decision_question_kind_invalid',
    message: '确认题“报销申请由什么方式触发？”问的不是人员，却带着人员决策标记。人员决策只能写在询问人员来源或绑定对象的单选题上，请把这题恢复成普通业务确认题，并为对应步骤单独提出人员题。',
    decisionKey: 'flow.trigger.type',
  }],
)

// 2) 补充说明题同样不能承载人员决策
assert.deepEqual(
  validateRawFlowPersonnelDecisionSlots(rawScheme([{
    id: 'q_amount_split',
    decisionKey: 'flow.split_basis',
    title: '是否需要按金额分流？',
    questionKind: 'note_only',
    personnelDecision: { stepKey: 'step_dept_approval', slot: 'approval_level' },
  }])).map(item => item.code),
  ['personnel_decision_question_kind_invalid'],
)

// 3) 单选题标成人员来源题，但选项是业务结构选项
assert.deepEqual(
  validateRawFlowPersonnelDecisionSlots(rawScheme([{
    id: 'q_trigger_select',
    decisionKey: 'flow.trigger.type',
    title: '报销申请由什么方式触发？',
    questionKind: 'single_select',
    options: [
      { value: 'manual', label: '员工手动提交' },
      { value: 'scheduled', label: '定时汇总生成' },
    ],
    personnelDecision: { stepKey: 'step_dept_approval', slot: 'source' },
  }])).map(item => item.code),
  ['personnel_decision_slot_options_invalid'],
)

// 4) 五来源选项、已绑定对象的选题都不误报
assert.deepEqual(
  validateRawFlowPersonnelDecisionSlots(rawScheme([
    financeSourceQuestion,
    {
      id: 'q_owner_field',
      decisionKey: 'flow.approval.owner.field',
      title: '用哪个成员字段确定审批人？',
      questionKind: 'single_select',
      options: [{
        value: 'field_manager',
        label: '直属主管字段',
        personnelCandidate: { sourceType: 'form_member', status: 'existing', refId: 'fld_manager', refName: '直属主管' },
      }],
      personnelDecision: { stepKey: 'step_dept_approval', slot: 'binding' },
    },
  ])),
  [],
)

// 5) 已作答的历史题是结论，不再按题型拦截
assert.deepEqual(
  validateRawFlowPersonnelDecisionSlots(rawScheme([{
    ...triggerQuestion,
    confirmed: true,
    selectedOptionValue: 'manual',
  }])),
  [],
)

// 6) 同一份方案里结构假设和人员挂错题同时存在：两类诊断必须同轮拿到，模型才能一次改完
const mixedScheme = {
  ...rawScheme([triggerQuestion]).scheme,
  assumptions: [{
    text: '默认按金额分流，5000 元以上走财务审批',
    impact: 'structure',
    decisionKey: 'flow.split_basis',
    dependentDecisionKeys: [],
  }],
}
assert.deepEqual(
  validateFlowStructureAssumptions(mixedScheme).map(item => item.code),
  ['structure_assumption_question_missing'],
)
assert.deepEqual(
  validateRawFlowPersonnelDecisionSlots(mixedScheme).map(item => item.code),
  ['personnel_decision_question_kind_invalid'],
)

// 7) 新问题属于模型可自修类，诊断要能回传给模型
assert.equal(FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS.has('flow-personnel-decision-slot-invalid'), true)
assert.deepEqual(
  projectModelActionableFlowDecisionDiagnostics([{
    code: 'personnel_decision_slot_options_invalid',
    message: '确认题“报销申请由什么方式触发？”标记为人员来源决策，但选项不是人员来源选项',
    decisionKey: 'flow.trigger.type',
  }]),
  [{
    code: 'personnel_decision_slot_options_invalid',
    message: '确认题“报销申请由什么方式触发？”标记为人员来源决策，但选项不是人员来源选项',
    decisionKey: 'flow.trigger.type',
  }],
)

const failedSchemeResult = (code: string, decisionKey: string, diagnostics?: unknown[]) => ({
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: {
    flowUnifiedIssues: [{
      issueId: 'flow-personnel-decision-slot-invalid',
      userMessage: '流程方案里有确认题的决策类型和题目内容对不上',
      diagnostics: diagnostics || [{ code, message: '人员决策挂错题', decisionKey }],
    }],
  },
})

// 8) 人员挂错题在不同题目间来回搬 → 按类聚合止损
assert.equal(
  resolveRepeatedFlowSchemeError([
    failedSchemeResult('personnel_decision_question_kind_invalid', 'flow.trigger.type'),
    failedSchemeResult('personnel_decision_slot_options_invalid', 'flow.condition.amount'),
  ]),
  FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE,
)

// 9) 结构假设与人员挂错题混在一轮时，仍先按结构假设止损，不改变原有优先级
assert.equal(
  resolveRepeatedFlowSchemeError([
    failedSchemeResult('personnel_decision_question_kind_invalid', 'flow.trigger.type', [
      { code: 'structure_assumption_question_missing', message: '结构假设引用的确认题缺失', decisionKey: 'flow.split_basis' },
      { code: 'personnel_decision_question_kind_invalid', message: '人员决策挂错题', decisionKey: 'flow.trigger.type' },
    ]),
    failedSchemeResult('personnel_decision_question_kind_invalid', 'flow.trigger.type', [
      { code: 'structure_assumption_question_missing', message: '结构假设引用的确认题缺失', decisionKey: 'flow.split_basis' },
      { code: 'personnel_decision_slot_options_invalid', message: '人员决策挂错题', decisionKey: 'flow.trigger.type' },
    ]),
  ]),
  FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE,
)

console.log('flow-personnel-decision-slot-contract: ok')
