import assert from 'node:assert/strict'

import {
  healFlowSchemeDecisionStepScopes,
} from '../../src/common/utils/nocodeEditorFlowDecisionKeyHealing'
import {
  validateRawFlowDecisionContract,
} from '../../src/common/utils/nocodeEditorFlowDecisionGraph'

const confirmedSourceQuestion = (input: {
  stepKey: string
  confirmed?: boolean
}) => ({
  id: 'q-approval-owner',
  decisionKey: 'flow.approval.owner.source',
  title: '审批人来源',
  questionKind: 'single_select',
  options: [{
    value: 'department_manager',
    label: '部门主管',
    selected: true,
    personnelCandidate: { sourceType: 'department_manager', status: 'supported' },
  }],
  personnelDecision: { stepKey: input.stepKey, slot: 'source' },
  decisionScope: { kind: 'step', id: input.stepKey },
  ...(input.confirmed === false
    ? {}
    : { confirmed: true, selectedOptionValue: 'department_manager' }),
})

const buildScheme = (input: {
  stepKeys: string[]
  question: Record<string, unknown>
}) => ({
  id: 'flow-scheme-project-001',
  title: '项目管理表流程',
  summary: '立项与结项审批',
  trigger: { type: 'submit', description: '提交后自动发起' },
  decisionContractVersion: 2,
  mainPath: [],
  branches: input.stepKeys.length
    ? [{
      key: 'branch-approval',
      title: '审批分支',
      steps: input.stepKeys.map(key => ({
        key,
        kind: 'approval',
        title: '审批',
        intent: '审批',
        personnelRequirement: { sourceType: 'department_manager' },
      })),
    }]
    : [],
  openQuestions: [],
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [input.question],
  },
})

const hasScopeDiagnostic = (scheme: unknown) => (
  validateRawFlowDecisionContract(scheme)
    .some(item => item.code === 'invalid_decision_scope')
)

// 1) 现场用例：单步骤方案拆成两条分支，旧 decisionScope.step 已不存在，但上一版同锚点题确认过该步骤。
//    契约校验会因为残留作用域把合法修订判错，愈合后应交由按锚点重锚接管。
const staleScheme = buildScheme({
  stepKeys: ['step-approval-setup', 'step-approval-close'],
  question: confirmedSourceQuestion({ stepKey: 'step-approval' }),
})
assert.equal(hasScopeDiagnostic(staleScheme), true)

const healed = healFlowSchemeDecisionStepScopes({
  scheme: staleScheme,
  previousQuestions: [confirmedSourceQuestion({ stepKey: 'step-approval' })],
})
assert.equal(healed.healed.length, 1)
assert.equal(healed.healed[0].decisionKey, 'flow.approval.owner.source')
assert.equal(healed.healed[0].staleStepKey, 'step-approval')
assert.equal(
  (healed.scheme as any).confirmation.questions[0].decisionScope,
  undefined,
)
assert.deepEqual(
  (healed.scheme as any).confirmation.questions[0].personnelDecision,
  { stepKey: 'step-approval', slot: 'source' },
)
assert.equal(hasScopeDiagnostic(healed.scheme), false)

// 2) 作用域仍指向本轮存在的步骤：不需要愈合，也不能顺手摘掉显式作用域。
const validScheme = buildScheme({
  stepKeys: ['step-approval-setup'],
  question: confirmedSourceQuestion({ stepKey: 'step-approval-setup' }),
})
const validHealing = healFlowSchemeDecisionStepScopes({
  scheme: validScheme,
  previousQuestions: [confirmedSourceQuestion({ stepKey: 'step-approval-setup' })],
})
assert.equal(validHealing.healed.length, 0)
assert.equal(validHealing.scheme, validScheme)

// 3) 上一版同锚点题没确认过这个步骤：模型本轮新写的无效步骤仍由契约校验拦住。
const unknownScopeHealing = healFlowSchemeDecisionStepScopes({
  scheme: buildScheme({
    stepKeys: ['step-approval-setup', 'step-approval-close'],
    question: confirmedSourceQuestion({ stepKey: 'step-approval-typo' }),
  }),
  previousQuestions: [confirmedSourceQuestion({ stepKey: 'step-approval' })],
})
assert.equal(unknownScopeHealing.healed.length, 0)
assert.equal(hasScopeDiagnostic(unknownScopeHealing.scheme), true)

// 4) 上一版同锚点题尚未确认：没有可继承的结论，不做愈合。
const unconfirmedHealing = healFlowSchemeDecisionStepScopes({
  scheme: buildScheme({
    stepKeys: ['step-approval-setup', 'step-approval-close'],
    question: confirmedSourceQuestion({ stepKey: 'step-approval' }),
  }),
  previousQuestions: [confirmedSourceQuestion({ stepKey: 'step-approval', confirmed: false })],
})
assert.equal(unconfirmedHealing.healed.length, 0)

// 5) 没有上一版方案：保持原样。
const noPreviousHealing = healFlowSchemeDecisionStepScopes({
  scheme: staleScheme,
  previousQuestions: [],
})
assert.equal(noPreviousHealing.healed.length, 0)
assert.equal(noPreviousHealing.scheme, staleScheme)

console.log('flow-decision-step-scope-heal: ok')
