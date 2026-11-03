import assert from 'node:assert/strict'

import type { NocodeEditorConfirmationDecision } from '../../src/common/utils/nocodeEditorConfirmationDecisionProjection'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeStep,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import type { NocodeEditorFlowPersonnelRequirement } from '../../src/common/utils/nocodeEditorFlowPersonnel'
import {
  collectRawFlowPersonnelRequirementNotices,
  normalizeNocodeEditorFlowPersonnelRequirement,
} from '../../src/common/utils/nocodeEditorFlowPersonnel'
import {
  materializeFlowPersonnelDecisionAnswers,
} from '../../src/common/utils/nocodeEditorFlowPersonnelDecisionMaterialization'
import { normalizeNocodeEditorFlowScheme } from '../../src/common/utils/nocodeEditorFlowScheme'
import { buildUnifiedFlowIssuesFromFlowScheme } from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import {
  assessAndDecorateFlowSchemePersonnelDependencies,
  reconcilePersonnelQuestionsWithRequirements,
} from '../../src/renderer/views/nocode/views/editor/ai/flowPersonnelDependencyAssessment'

const STEP_KEY = 'approval_dept_manager'
const LEVEL_DECISION_KEY = `flow.personnel:${STEP_KEY}:approval_level`
const CONTEXT_KEY = 'logical:flow-scheme:ir11iybhxagd:t_71b0wynlfzju'

const approvalStep = (
  key: string,
  title: string,
  personnelRequirement?: NocodeEditorFlowPersonnelRequirement,
): NocodeEditorFlowSchemeStep => ({
  key,
  kind: 'approval',
  title,
  intent: `由${title}处理`,
  ...(personnelRequirement ? { personnelRequirement } : {}),
})

const createScheme = (steps: NocodeEditorFlowSchemeStep[]): NocodeEditorFlowScheme => ({
  title: '报销审批流程',
  summary: '员工提交报销申请后，经部门主管审批完成',
  target: { formId: 't_expense', formName: '报销申请' },
  trigger: { type: 'submit', description: '员工提交报销申请后触发审批流程' },
  mainPath: steps,
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: [],
})

const levelDecision = (
  overrides: Partial<NocodeEditorConfirmationDecision> = {},
): NocodeEditorConfirmationDecision => ({
  questionId: `flow-personnel:${STEP_KEY}:level`,
  questionTitle: '“部门主管审批”的审批人取哪一级部门主管？',
  decisionKey: LEVEL_DECISION_KEY,
  selectedOptionValue: 'up2',
  answerSummary: '向上 2 级',
  ...overrides,
})

const stepRequirement = (scheme: NocodeEditorFlowScheme, key = STEP_KEY) => (
  scheme.mainPath.find(step => step.key === key)?.personnelRequirement
)

const dependencyIds = (scheme: NocodeEditorFlowScheme) => (
  assessAndDecorateFlowSchemePersonnelDependencies({ scheme }).dependencies || []
).map(item => item.id)

const levelQuestions = (scheme: NocodeEditorFlowScheme) => (
  buildUnifiedFlowIssuesFromFlowScheme({ scheme })
    .map(issue => issue.questionPayload)
    .filter(question => question?.personnelDecision?.slot === 'approval_level')
)

// 1) 主路径：已确认层级回写配置后，评估不再派生层级依赖，也不再出层级题。
const baseScheme = createScheme([
  approvalStep(STEP_KEY, '部门主管审批', { sourceType: 'department_manager' }),
])
const baseResult = materializeFlowPersonnelDecisionAnswers({
  scheme: baseScheme,
  decisions: [levelDecision()],
})
assert.deepEqual(baseResult.applied, [{
  decisionKey: LEVEL_DECISION_KEY,
  stepKey: STEP_KEY,
  slot: 'approval_level',
  departmentManager: { mode: 'up', level: 2 },
}])
assert.deepEqual(stepRequirement(baseResult.scheme), {
  sourceType: 'department_manager',
  departmentManager: { mode: 'up', level: 2 },
})
assert.equal(dependencyIds(baseResult.scheme).includes(`flow-personnel:${STEP_KEY}:level`), false)
assert.deepEqual(levelQuestions(baseResult.scheme), [])

// 2) 自由文本答案：从 answerSummary 解析方向和级数。
const textResult = materializeFlowPersonnelDecisionAnswers({
  scheme: baseScheme,
  decisions: [levelDecision({ selectedOptionValue: undefined, answerSummary: '向下 3 级' })],
})
assert.deepEqual(stepRequirement(textResult.scheme), {
  sourceType: 'department_manager',
  departmentManager: { mode: 'down', level: 3 },
})

// 3) 来源已被改成固定角色：不用旧层级覆盖新来源。
const roleScheme = createScheme([
  approvalStep(STEP_KEY, '部门主管审批', {
    sourceType: 'fixed_roles',
    roleRefs: [{ id: 'r_finance', name: '财务' }],
  }),
])
const roleResult = materializeFlowPersonnelDecisionAnswers({
  scheme: roleScheme,
  decisions: [levelDecision()],
})
assert.deepEqual(roleResult.applied, [])
assert.deepEqual(roleResult.skipped, [{
  decisionKey: LEVEL_DECISION_KEY,
  stepKey: STEP_KEY,
  reason: 'source_conflict',
}])
assert.equal(roleResult.scheme, roleScheme)

// 4) 答案无法解析：不猜层级，留给后续追问。
const unparsedResult = materializeFlowPersonnelDecisionAnswers({
  scheme: baseScheme,
  decisions: [levelDecision({ selectedOptionValue: '自定义', answerSummary: '' })],
})
assert.deepEqual(unparsedResult.applied, [])
assert.deepEqual(unparsedResult.skipped.map(item => item.reason), ['level_unparsed'])

// 5) 节点不存在 / 非审批节点：分别给出明确跳过原因。
const missingResult = materializeFlowPersonnelDecisionAnswers({
  scheme: baseScheme,
  decisions: [levelDecision({ decisionKey: 'flow.personnel:missing_step:approval_level' })],
})
assert.deepEqual(missingResult.skipped.map(item => item.reason), ['step_missing'])
const notifyScheme = createScheme([{
  key: STEP_KEY,
  kind: 'notify',
  title: '通知部门主管',
  intent: '通知部门主管',
}])
const notifyResult = materializeFlowPersonnelDecisionAnswers({
  scheme: notifyScheme,
  decisions: [levelDecision()],
})
assert.deepEqual(notifyResult.skipped.map(item => item.reason), ['step_not_approval'])

// 6) 幂等：同一决策重复执行不改变结果。
const twice = materializeFlowPersonnelDecisionAnswers({
  scheme: baseResult.scheme,
  decisions: [levelDecision()],
})
assert.deepEqual(twice.scheme, baseResult.scheme)

// 7) P1：department_manager + fieldRef 不再整条降级，层级保留，另给非阻断提示。
const rawDepartmentManagerRequirement = {
  sourceType: 'department_manager',
  fieldRef: { fieldId: 'f_y7h3ndbils9a', fieldName: '报销部门', expectedType: 'departmentSelect' },
  departmentManager: { mode: 'up', level: 2 },
}
assert.deepEqual(
  normalizeNocodeEditorFlowPersonnelRequirement(rawDepartmentManagerRequirement),
  {
    sourceType: 'department_manager',
    departmentManager: { mode: 'up', level: 2 },
  },
)
const notices = collectRawFlowPersonnelRequirementNotices({
  mainPath: [{
    key: STEP_KEY,
    kind: 'approval',
    personnelRequirement: rawDepartmentManagerRequirement,
  }],
})
assert.equal(notices.length, 1)
assert.equal(notices[0].code, 'personnel_field_ref_ignored_for_department_manager')
assert.equal(notices[0].stepKey, STEP_KEY)

// 8) P1 不误伤：form_member + fieldRef 仍正常归一化，不产生提示。
assert.deepEqual(
  normalizeNocodeEditorFlowPersonnelRequirement({
    sourceType: 'form_member',
    fieldRef: { fieldId: 'f_member', fieldName: '申请人', expectedType: 'memberSelect' },
  }),
  {
    sourceType: 'form_member',
    fieldRef: { fieldId: 'f_member', fieldName: '申请人', expectedType: 'memberSelect' },
  },
)
assert.deepEqual(collectRawFlowPersonnelRequirementNotices({
  mainPath: [{
    key: STEP_KEY,
    kind: 'approval',
    personnelRequirement: {
      sourceType: 'form_member',
      fieldRef: { fieldId: 'f_member', fieldName: '申请人' },
    },
  }],
}), [])

// 9) 端到端复现线上场景：第 4 版原始参数（含 fieldRef、模型自答）+ 用户答案。
const levelQuestion = (confirmed: boolean) => ({
  id: `flow-personnel:${STEP_KEY}:level`,
  decisionKey: LEVEL_DECISION_KEY,
  title: '“部门主管审批”的审批人取哪一级部门主管？',
  questionKind: 'single_select',
  required: true,
  options: [
    { value: 'up1', label: '向上 1 级' },
    { value: 'up2', label: '向上 2 级' },
    { value: 'up3', label: '向上 3 级' },
    { value: 'down1', label: '向下 1 级' },
  ],
  decisionScope: { kind: 'step', id: STEP_KEY },
  dependsOn: [],
  personnelDecision: { stepKey: STEP_KEY, slot: 'approval_level' },
  ...(confirmed ? { confirmed: true, selectedOptionValue: 'up2', answerSummary: '向上 2 级' } : {}),
})

const createRawScheme = (personnelRequirement: unknown) => ({
  title: '报销审批流程',
  summary: '员工提交报销申请后，经部门主管审批完成',
  target: { formId: 't_expense', formName: '报销申请' },
  trigger: { type: 'submit', description: '员工提交报销申请后触发审批流程' },
  mainPath: [{
    key: STEP_KEY,
    kind: 'approval',
    title: '部门主管审批',
    intent: '由部门主管审批',
    actorHint: '提交人的部门主管',
    personnelRequirement,
  }],
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: [{
    key: LEVEL_DECISION_KEY,
    title: '“部门主管审批”的审批人取哪一级部门主管？',
    reason: '需要确认审批层级',
    scopeKind: 'step',
    scopeKey: STEP_KEY,
  }],
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    decisionContractVersion: 2,
    factSnapshot: {},
    questions: [levelQuestion(true)],
  },
})

const normalizeWithTrustedAnswer = (personnelRequirement: unknown) => {
  const scheme = normalizeNocodeEditorFlowScheme(createRawScheme(personnelRequirement), {
    trustedAnswers: {
      planningContextKey: CONTEXT_KEY,
      decisions: [levelDecision()],
      userTexts: ['向上 2 级'],
    },
  })
  assert.ok(scheme)
  return scheme!
}

const liveScheme = normalizeWithTrustedAnswer(rawDepartmentManagerRequirement)
assert.equal(liveScheme.confirmation?.status, 'completed')
const liveQuestion = liveScheme.confirmation?.questions.find(
  question => question.decisionKey === LEVEL_DECISION_KEY,
)
assert.equal(liveQuestion?.confirmed, true)
assert.equal(liveQuestion?.selectedOptionValue, 'up2')
const liveMaterialized = materializeFlowPersonnelDecisionAnswers({
  scheme: liveScheme,
  decisions: [levelDecision()],
})
assert.deepEqual(stepRequirement(liveMaterialized.scheme), {
  sourceType: 'department_manager',
  departmentManager: { mode: 'up', level: 2 },
})
const liveReconciled = reconcilePersonnelQuestionsWithRequirements({
  scheme: liveMaterialized.scheme,
})
assert.equal(liveReconciled.scheme.confirmation?.status, 'completed')
assert.deepEqual(liveReconciled.scheme.openQuestions, [])
assert.equal(
  dependencyIds(liveReconciled.scheme).includes(`flow-personnel:${STEP_KEY}:level`),
  false,
)
assert.deepEqual(levelQuestions(liveReconciled.scheme), [])

// 10) 对照组：模型没带 fieldRef、也没带层级时，P0 仍独立生效。
const bareScheme = normalizeWithTrustedAnswer({ sourceType: 'department_manager' })
const bareMaterialized = materializeFlowPersonnelDecisionAnswers({
  scheme: bareScheme,
  decisions: [levelDecision()],
})
assert.deepEqual(stepRequirement(bareMaterialized.scheme), {
  sourceType: 'department_manager',
  departmentManager: { mode: 'up', level: 2 },
})
const bareReconciled = reconcilePersonnelQuestionsWithRequirements({
  scheme: bareMaterialized.scheme,
})
assert.equal(bareReconciled.scheme.confirmation?.status, 'completed')
assert.equal(
  dependencyIds(bareReconciled.scheme).includes(`flow-personnel:${STEP_KEY}:level`),
  false,
)

console.log('flow personnel confirmed decision materialization: ok')
