import assert from 'node:assert/strict'

import {
  normalizeNocodeEditorFlowScheme,
  type NocodeEditorFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import { validateFlowPersonnelQuestionContracts } from '../../src/common/utils/nocodeEditorFlowDecisionIdentity'
import {
  FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE,
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { resolveRepeatedFlowSchemeError } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'

type UnknownRecord = Record<string, unknown>

const approvalStep = (key: string) => ({
  key,
  kind: 'approval',
  title: '部门主管审批',
  intent: '由部门主管审批报销申请',
})

const rawScheme = (input: {
  steps?: UnknownRecord[]
  questions: UnknownRecord[]
}): UnknownRecord => ({
  title: '报销申请审批流程方案',
  summary: '员工提交报销申请后由部门主管审批',
  trigger: { type: 'submit', description: '员工提交报销申请时触发' },
  mainPath: input.steps || [
    { key: 'step_submit', kind: 'add-data', title: '提交报销申请' },
    approvalStep('step_dept_approval'),
  ],
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: [],
  dependencies: [],
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: input.questions,
  },
})

const normalizeScheme = (raw: UnknownRecord): NocodeEditorFlowScheme => {
  const scheme = normalizeNocodeEditorFlowScheme(raw)
  assert.ok(scheme, 'fixture scheme should normalize')
  return scheme
}

// 现场原样（应用 wvcvxsk8vek7，12:25）：模型自造四个来源选项，既没标 personnelDecision，
// 也没给 decisionScope/结构化 decisionKey，旧校验因此整条放过。
const fabricatedOwnerQuestion = (overrides: UnknownRecord = {}): UnknownRecord => ({
  id: 'q_approval_owner',
  decisionKey: 'approval_owner',
  title: '审批人是谁？',
  questionKind: 'single_select',
  changes: ['binding'],
  dependsOn: [],
  allowFreeText: true,
  options: [
    { value: 'submitter_manager', label: '提交人的直属主管' },
    { value: 'fixed_role', label: '指定角色' },
    { value: 'fixed_user', label: '指定成员' },
    { value: 'form_field', label: '表单中的某个成员字段' },
  ],
  ...overrides,
})

const canonicalSourceQuestion = (overrides: UnknownRecord = {}): UnknownRecord => ({
  id: 'q_approval_source',
  decisionKey: 'flow.approval.owner.source',
  title: '报销申请由谁审批？',
  questionKind: 'single_select',
  changes: ['binding'],
  dependsOn: [],
  options: [
    { value: 'submitter', label: '提交人自己' },
    { value: 'assignee', label: '指定成员/角色' },
    { value: 'department_manager', label: '部门主管' },
    { value: 'form_member_field', label: '表单内成员字段' },
    { value: 'form_department_field', label: '表单内部门字段' },
  ],
  ...overrides,
})

// 1) 唯一审批步骤：从选项认出 source 槽位，并用该步骤补 stepKey
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    questions: [fabricatedOwnerQuestion()],
  }))).map(item => ({
    code: item.code,
    questionId: item.questionId,
    decisionKey: item.decisionKey,
    stepKey: item.stepKey,
    slot: item.slot,
  })),
  [{
    code: 'personnel_decision_missing',
    questionId: 'q_approval_owner',
    decisionKey: 'approval_owner',
    stepKey: 'step_dept_approval',
    slot: 'source',
  }],
)

// 2) 多个审批步骤：不替模型猜 stepKey
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    steps: [
      { key: 'step_submit', kind: 'add-data', title: '提交报销申请' },
      approvalStep('step_dept_approval'),
      approvalStep('step_finance_approval'),
    ],
    questions: [fabricatedOwnerQuestion()],
  }))).map(item => [item.code, item.stepKey, item.slot]),
  [['personnel_decision_missing', '', 'source']],
)

// 3) 方案里没有可承载人员来源的步骤：仍报缺声明，不因补不到 stepKey 就放过
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    steps: [{ key: 'step_submit', kind: 'add-data', title: '提交报销申请' }],
    questions: [fabricatedOwnerQuestion()],
  }))).map(item => [item.code, item.stepKey, item.slot]),
  [['personnel_decision_missing', '', 'source']],
)

// 4) 规范五选项但同样漏标 personnelDecision：仍属契约缺失
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    questions: [canonicalSourceQuestion()],
  }))).map(item => [item.code, item.stepKey, item.slot]),
  [['personnel_decision_missing', 'step_dept_approval', 'source']],
)

// 5) 已声明 decisionScope 的题沿用原推断路径
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    questions: [fabricatedOwnerQuestion({
      id: 'q_finance_owner',
      decisionKey: 'flow.approval.owner.source',
      decisionScope: { kind: 'step', id: 'step_dept_approval' },
    })],
  }))).map(item => [item.code, item.stepKey, item.slot]),
  [['personnel_decision_missing', 'step_dept_approval', 'source']],
)

// 6) 补齐 personnelDecision 后通过
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    questions: [canonicalSourceQuestion({
      personnelDecision: { stepKey: 'step_dept_approval', slot: 'source' },
    })],
  }))),
  [],
)

// 7) 已作答的历史题是结论，不再拦截
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    questions: [fabricatedOwnerQuestion({
      confirmed: true,
      selectedOptionValue: 'fixed_role',
    })],
  }))),
  [],
)

// 8) 业务结构题（触发方式、是否分流）不因标题或选项被误判成人员题
assert.deepEqual(
  validateFlowPersonnelQuestionContracts(normalizeScheme(rawScheme({
    questions: [{
      id: 'q_trigger_type',
      decisionKey: 'flow.trigger.type',
      title: '报销申请由什么方式触发？',
      questionKind: 'single_select',
      dependsOn: [],
      options: [
        { value: 'manual', label: '员工手动提交' },
        { value: 'scheduled', label: '定时汇总生成' },
      ],
    }],
  }))),
  [],
)

// 9) 同一类缺失换题重试 → 按人员槽位类止损，交给用户补人
const failedSchemeResult = (decisionKey: string) => ({
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: {
    flowUnifiedIssues: [{
      issueId: 'flow-personnel-question-contract-invalid',
      userMessage: '人员确认题缺少 personnelDecision（stepKey 与 slot），无法与流程步骤和人员配置对齐，请补齐后重试。',
      diagnostics: [{
        code: 'personnel_decision_missing',
        message: '确认题“审批人是谁？”属于人员决策题，但未声明 personnelDecision.stepKey 与 personnelDecision.slot。',
        decisionKey,
      }],
    }],
  },
})
assert.equal(
  resolveRepeatedFlowSchemeError([
    failedSchemeResult('approval_owner'),
    failedSchemeResult('finance_approval_owner'),
  ]),
  FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE,
)

// 10) 缺失诊断要能回传给模型自修，不能只留在界面
assert.equal(
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS.has('flow-personnel-question-contract-invalid'),
  true,
)

console.log('flow-personnel-decision-missing-contract: ok')
