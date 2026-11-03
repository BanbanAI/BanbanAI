import assert from 'node:assert/strict'

import type { NocodeEditorAiConfirmQuestion } from '../../src/common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeQuestion,
  NocodeEditorFlowSchemeStep,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import type {
  NocodeEditorFlowPersonnelRequirement,
} from '../../src/common/utils/nocodeEditorFlowPersonnel'
import {
  buildFlowDecisionStepLookup,
  inferFlowPersonnelDecision,
} from '../../src/common/utils/nocodeEditorFlowDecisionIdentity'
import {
  buildNocodeEditorFlowPersonnelSourceOptions,
} from '../../src/common/utils/nocodeEditorFlowPersonnelSourceOptions'
import {
  deriveFlowSchemePersonnelRequirementsFromClues,
} from '../../src/common/utils/nocodeEditorFlowPersonnelClueDerivation'
import {
  projectFlowDecisionQuestions,
} from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  buildUnifiedFlowIssuesFromFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import type {
  NocodeEditorFlowPersonnelSourceEvidence,
} from '../../src/common/utils/nocodeEditorFlowPersonnelSourceAnchor'
import {
  assessAndDecorateFlowSchemePersonnelDependencies,
  reconcilePersonnelQuestionsWithRequirements,
} from '../../src/renderer/views/nocode/views/editor/ai/flowPersonnelDependencyAssessment'

const DEPT_STEP_KEY = 'dept_approval'
const FINANCE_STEP_KEY = 'finance_approval'
const DEPT_SOURCE_KEY = `flow.approval.owner.source.${DEPT_STEP_KEY}`
const FINANCE_SOURCE_KEY = `flow.approval.owner.source.${FINANCE_STEP_KEY}`

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

const deptRequirement: NocodeEditorFlowPersonnelRequirement = {
  sourceType: 'department_manager',
  departmentManager: { mode: 'up', level: 1 },
}

const financeRequirement: NocodeEditorFlowPersonnelRequirement = {
  sourceType: 'fixed_roles',
  roleRefs: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
}

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

const amountQuestion: NocodeEditorAiConfirmQuestion = {
  id: 'q_amount',
  decisionKey: 'flow.amount_branch',
  title: '是否需要按报销金额分流？',
  questionKind: 'binary',
  required: true,
  options: [{ value: 'yes', label: '是' }, { value: 'no', label: '否' }],
  decisionScope: { kind: 'flow', id: 'main' },
  dependsOn: [],
}

const openQuestion = (key: string, scopeKey?: string): NocodeEditorFlowSchemeQuestion => ({
  key,
  title: key,
  reason: key,
  scopeKind: scopeKey ? 'step' : 'global',
  ...(scopeKey ? { scopeKey } : {}),
})

const sourceDependency = (
  stepKey: string,
  decisionKey: string,
): NocodeEditorFlowSchemeDependency => ({
  id: `flow-personnel:${stepKey}:source`,
  decisionKey,
  kind: 'org_anchor_missing',
  requiredFor: 'approval_owner',
  scopeKind: 'step',
  scopeKey: stepKey,
  riskLevel: 'low',
  resolutionStatus: 'unresolved',
  materializationStatus: 'not_available',
  summary: '',
})

const createScheme = (input: {
  steps: NocodeEditorFlowSchemeStep[]
  questions?: NocodeEditorAiConfirmQuestion[]
  openQuestions?: NocodeEditorFlowSchemeQuestion[]
  dependencies?: NocodeEditorFlowSchemeDependency[]
}): NocodeEditorFlowScheme => ({
  title: '报销审批流程',
  summary: '员工提交报销申请后，经部门主管和财务审批完成',
  target: { formId: 't_expense', formName: '报销申请' },
  trigger: { type: 'submit', description: '员工提交报销申请后触发审批流程' },
  mainPath: input.steps,
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: input.openQuestions || [],
  ...(input.dependencies ? { dependencies: input.dependencies } : {}),
  ...(input.questions ? {
    confirmation: {
      stage: 'flow-scheme',
      status: 'pending',
      decisionContractVersion: 2,
      factSnapshot: {},
      questions: input.questions,
    },
  } : {}),
})

// 截图场景：两个节点都已在方案里写明人员配置，模型仍重复提出来源题。
const screenshotScheme = createScheme({
  steps: [
    approvalStep(DEPT_STEP_KEY, '部门主管审批', deptRequirement),
    approvalStep(FINANCE_STEP_KEY, '财务审批', financeRequirement),
  ],
  questions: [amountQuestion, sourceQuestion(DEPT_STEP_KEY), sourceQuestion(FINANCE_STEP_KEY)],
  openQuestions: [
    openQuestion('flow.amount_branch'),
    openQuestion(DEPT_SOURCE_KEY, DEPT_STEP_KEY),
    openQuestion(FINANCE_SOURCE_KEY, FINANCE_STEP_KEY),
  ],
  dependencies: [
    sourceDependency(DEPT_STEP_KEY, DEPT_SOURCE_KEY),
    sourceDependency(FINANCE_STEP_KEY, FINANCE_SOURCE_KEY),
  ],
})
const screenshotResult = reconcilePersonnelQuestionsWithRequirements({ scheme: screenshotScheme })
assert.deepEqual(
  screenshotResult.scheme.confirmation?.questions.map(question => question.decisionKey),
  ['flow.amount_branch'],
)
assert.deepEqual(
  screenshotResult.scheme.openQuestions.map(question => question.key),
  ['flow.amount_branch'],
)
assert.deepEqual(screenshotResult.scheme.dependencies, [])
assert.equal(screenshotResult.scheme.confirmation?.status, 'pending')
assert.deepEqual(
  screenshotResult.reconciled.map(item => `${item.stepKey}:${item.slot}`).sort(),
  ['dept_approval:source', 'finance_approval:source'],
)

// 已答题保留为历史，不因需求已确定而改写结论。
const answeredScheme = createScheme({
  steps: [approvalStep(DEPT_STEP_KEY, '部门主管审批', deptRequirement)],
  questions: [{
    ...sourceQuestion(DEPT_STEP_KEY),
    confirmed: true,
    selectedOptionValue: 'department_manager',
  }],
})
const answeredResult = reconcilePersonnelQuestionsWithRequirements({ scheme: answeredScheme })
assert.deepEqual(answeredResult.reconciled, [])
assert.deepEqual(
  answeredResult.scheme.confirmation?.questions.map(question => question.decisionKey),
  [DEPT_SOURCE_KEY],
)

// 安全态：来源未确定或没有 personnelRequirement 时原样返回。
const unresolvedScheme = createScheme({
  steps: [
    approvalStep(DEPT_STEP_KEY, '部门主管审批', { sourceType: 'unresolved' }),
    approvalStep(FINANCE_STEP_KEY, '财务审批'),
  ],
  questions: [sourceQuestion(DEPT_STEP_KEY), sourceQuestion(FINANCE_STEP_KEY)],
})
const unresolvedResult = reconcilePersonnelQuestionsWithRequirements({ scheme: unresolvedScheme })
assert.equal(unresolvedResult.scheme, unresolvedScheme)
assert.deepEqual(unresolvedResult.reconciled, [])
assert.equal(unresolvedResult.scheme.confirmation?.questions.length, 2)

// 部门主管缺层级：来源题被回收，评估链路只派生层级题。
const missingManagerScheme = createScheme({
  steps: [approvalStep(DEPT_STEP_KEY, '部门主管审批', { sourceType: 'department_manager' })],
  questions: [sourceQuestion(DEPT_STEP_KEY)],
})
const missingManagerResult = reconcilePersonnelQuestionsWithRequirements({ scheme: missingManagerScheme })
assert.deepEqual(
  missingManagerResult.scheme.confirmation?.questions.map(question => question.decisionKey),
  [],
)
const missingManagerAssessed = assessAndDecorateFlowSchemePersonnelDependencies({
  scheme: missingManagerResult.scheme,
})
const missingManagerDependencyIds = (missingManagerAssessed.dependencies || []).map(item => item.id)
assert.ok(missingManagerDependencyIds.includes(`flow-personnel:${DEPT_STEP_KEY}:level`))
assert.equal(missingManagerDependencyIds.some(id => id.endsWith(':source')), false)

// 表单来源：只回收来源题，字段绑定题保留。
const formMemberScheme = createScheme({
  steps: [approvalStep(DEPT_STEP_KEY, '部门主管审批', {
    sourceType: 'form_member',
    fieldRef: { fieldId: 'f_member', fieldName: '申请人' },
  })],
  questions: [
    sourceQuestion(DEPT_STEP_KEY),
    {
      id: 'q_field',
      decisionKey: `flow.approval.owner.field_ref.${DEPT_STEP_KEY}`,
      title: '使用哪个成员字段作为审批人？',
      questionKind: 'single_select',
      required: true,
      options: [
        { value: 'use-existing-owner-field:f_member', label: '申请人' },
        { value: 'use-existing-owner-field:f_approver', label: '审批人' },
      ],
      decisionScope: { kind: 'step', id: DEPT_STEP_KEY },
      dependsOn: [],
    },
  ],
})
const formMemberResult = reconcilePersonnelQuestionsWithRequirements({ scheme: formMemberScheme })
assert.deepEqual(
  formMemberResult.scheme.confirmation?.questions.map(question => question.decisionKey),
  [`flow.approval.owner.field_ref.${DEPT_STEP_KEY}`],
)

// 孤儿 openQuestion：没有对应确认题，但键名指向已确定来源，也要回收。
const orphanScheme = createScheme({
  steps: [approvalStep(DEPT_STEP_KEY, '部门主管审批', deptRequirement)],
  openQuestions: [openQuestion(DEPT_SOURCE_KEY, DEPT_STEP_KEY)],
})
const orphanResult = reconcilePersonnelQuestionsWithRequirements({ scheme: orphanScheme })
assert.deepEqual(orphanResult.scheme.openQuestions, [])
assert.deepEqual(
  orphanResult.reconciled.map(item => `${item.stepKey}:${item.slot}`),
  ['dept_approval:source'],
)

// 带步骤后缀的决策键归一到同一套解析。
const decision = inferFlowPersonnelDecision({
  id: 'q_orphan',
  decisionKey: DEPT_SOURCE_KEY,
  title: '',
}, buildFlowDecisionStepLookup(screenshotScheme))
assert.deepEqual(decision, { stepKey: DEPT_STEP_KEY, slot: 'source' })

// 线索落位后，同一套回收链路直接消掉来源题（不需要模型自己写 personnelRequirement）。
const clueEvidence: NocodeEditorFlowPersonnelSourceEvidence = {
  roles: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
  users: [],
  memberFieldNames: [],
  departmentFieldNames: [],
}
const clueScheme = createScheme({
  steps: [
    {
      key: FINANCE_STEP_KEY,
      kind: 'approval',
      title: '财务审批',
      intent: '',
      actorHint: '财务角色',
    },
    {
      key: DEPT_STEP_KEY,
      kind: 'approval',
      title: '部门主管审批',
      intent: '',
      actorHint: '提交人的部门主管',
    },
  ],
  questions: [sourceQuestion(FINANCE_STEP_KEY), sourceQuestion(DEPT_STEP_KEY)],
})
const clueDerivation = deriveFlowSchemePersonnelRequirementsFromClues({
  scheme: clueScheme,
  evidence: clueEvidence,
  userMessage: '1000 元以内由财务审批，然后由部门主管审批',
})
assert.deepEqual(
  clueDerivation.derived.map(item => `${item.stepKey}:${item.sourceType}`),
  [`${FINANCE_STEP_KEY}:fixed_roles`, `${DEPT_STEP_KEY}:department_manager`],
)
const clueReconciled = reconcilePersonnelQuestionsWithRequirements({ scheme: clueDerivation.scheme })
assert.deepEqual(
  clueReconciled.scheme.confirmation?.questions.map(question => question.decisionKey),
  [],
)
assert.deepEqual(
  clueReconciled.reconciled.map(item => `${item.stepKey}:${item.slot}`).sort(),
  [`${DEPT_STEP_KEY}:source`, `${FINANCE_STEP_KEY}:source`],
)

// 部门主管已定位但缺层级：来源题回收，评估只派生层级题。
const clueAssessed = assessAndDecorateFlowSchemePersonnelDependencies({
  scheme: clueReconciled.scheme,
})
const clueDependencyIds = (clueAssessed.dependencies || []).map(item => item.id)
assert.ok(clueDependencyIds.includes(`flow-personnel:${DEPT_STEP_KEY}:level`))
assert.equal(clueDependencyIds.some(id => id.endsWith(':source')), false)

// 层级题给出可点选项（向上/向下 + 级数），不再是一段只能手填的说明。
const levelQuestion = buildUnifiedFlowIssuesFromFlowScheme({ scheme: clueAssessed })
  .map(issue => issue.questionPayload)
  .find(question => question?.personnelDecision?.slot === 'approval_level')
assert.equal(levelQuestion?.questionKind, 'single_select')
assert.deepEqual(
  levelQuestion?.options?.map(option => option.value),
  ['up1', 'up2', 'up3', 'down1'],
)

// 两个节点都要问来源时，决策键按节点区分才能同轮展示（裸键会被判重复键压成一道）。
const twoSourceScheme = createScheme({
  steps: [
    approvalStep(DEPT_STEP_KEY, '部门主管审批'),
    approvalStep(FINANCE_STEP_KEY, '财务审批'),
  ],
})
const twoSourceAssessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme: twoSourceScheme })
const twoSourceQuestions = buildUnifiedFlowIssuesFromFlowScheme({ scheme: twoSourceAssessed })
  .map(issue => issue.questionPayload)
  .filter((question): question is NocodeEditorAiConfirmQuestion => Boolean(
    question && question.personnelDecision?.slot === 'source',
  ))
assert.deepEqual(
  twoSourceQuestions.map(question => question.decisionKey).sort(),
  [
    `flow.approval.owner.source:${DEPT_STEP_KEY}`,
    `flow.approval.owner.source:${FINANCE_STEP_KEY}`,
  ],
)
assert.equal(projectFlowDecisionQuestions(twoSourceQuestions).ready.length, 2)

console.log('flow personnel question reconciliation: ok')
