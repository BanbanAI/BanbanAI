import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type { NocodeEditorAiConfirmPayload } from '../../src/common/types/nocodeEditorConfirmation'
import {
  projectModelActionableFlowDecisionDiagnostics,
  type FlowDecisionDiagnostic,
} from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import { reconcileNocodeEditorConfirmationDecisions } from '../../src/common/utils/nocodeEditorConfirmationDecisionReconciliation'
import { normalizeVisibleFlowGroundingQuestions } from '../../src/common/utils/nocodeEditorFlowGroundingPresentation'
import { validateFlowStructureAssumptions } from '../../src/common/utils/nocodeEditorFlowStructureAssumption'
import {
  buildFlowSchemeStopLossMessage,
  buildFlowSchemeStopLossQuestions,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { initTestI18n } from './test-i18n'

initTestI18n()

const validateWithQuestion = (assumption: Record<string, unknown>, question?: Record<string, unknown>) => (
  validateFlowStructureAssumptions({
    scheme: {
      assumptions: [assumption],
      confirmation: {
        questions: question ? [question] : [],
      },
    },
  })
)

// 1) 六条结构假设诊断都带原文，收口卡才有题目可问
const impactMissing = validateWithQuestion({ text: '默认两级审批' })
assert.equal(impactMissing[0]?.code, 'assumption_impact_missing')
assert.equal(impactMissing[0]?.assumptionText, '默认两级审批')

const decisionMissing = validateWithQuestion({ text: '默认按金额分流', impact: 'structure' })
assert.equal(decisionMissing[0]?.code, 'structure_assumption_decision_missing')
assert.equal(decisionMissing[0]?.assumptionText, '默认按金额分流')

const questionMissing = validateWithQuestion({
  text: '审批分两级',
  impact: 'structure',
  decisionKey: 'flow.approval.structure',
})
assert.equal(questionMissing[0]?.code, 'structure_assumption_question_missing')
assert.equal(questionMissing[0]?.assumptionText, '审批分两级')

const questionNotStructural = validateWithQuestion(
  { text: '主管先审批', impact: 'structure', decisionKey: 'flow.approval.structure' },
  { decisionKey: 'flow.approval.structure', changes: ['parameter'] },
)
assert.equal(questionNotStructural[0]?.code, 'structure_assumption_question_not_structural')
assert.equal(questionNotStructural[0]?.assumptionText, '主管先审批')

const dependentMissing = validateWithQuestion({
  text: '沿用当前草稿结构',
  impact: 'structure',
  decisionKey: 'flow.base.structure',
  dependentDecisionKeys: ['flow.approval.structure'],
}, { decisionKey: 'flow.base.structure', changes: ['topology'] })
assert.equal(dependentMissing[0]?.code, 'structure_assumption_dependent_missing')
assert.equal(dependentMissing[0]?.assumptionText, '沿用当前草稿结构')

const dependentWithoutPrerequisite = validateFlowStructureAssumptions({
  scheme: {
    assumptions: [{
      text: '沿用当前草稿结构',
      impact: 'structure',
      decisionKey: 'flow.base.structure',
      dependentDecisionKeys: ['flow.approval.structure'],
    }],
    confirmation: {
      questions: [
        { decisionKey: 'flow.base.structure', changes: ['topology'] },
        { decisionKey: 'flow.approval.structure', changes: ['topology'] },
      ],
    },
  },
})
assert.equal(
  dependentWithoutPrerequisite[0]?.code,
  'structure_assumption_dependent_without_prerequisite',
)
assert.equal(dependentWithoutPrerequisite[0]?.assumptionText, '沿用当前草稿结构')

// 2) 原文只给宿主收口用：模型可见投影不增加字段，避免请求体积回涨
const projected = projectModelActionableFlowDecisionDiagnostics([{
  code: 'structure_assumption_decision_missing',
  message: '结构性假设必须绑定决策键',
  assumptionText: '默认两级审批',
  decisionKey: 'flow.approval.structure',
}] as unknown as FlowDecisionDiagnostic[])
assert.deepEqual(projected, [{
  code: 'structure_assumption_decision_missing',
  message: '结构性假设必须绑定决策键',
  decisionKey: 'flow.approval.structure',
}])

const failedSchemeResult = (diagnostics: Record<string, unknown>[]) => ({
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: {
    flowUnifiedIssues: [{
      issueId: 'flow-structure-assumption-unconfirmed',
      diagnostics,
    }],
  },
})

// 3) 同一假设只出一题；重复诊断不重复问
const duplicateResults = buildFlowSchemeStopLossQuestions([
  failedSchemeResult([
    { code: 'structure_assumption_decision_missing', assumptionText: '默认两级审批' },
    { code: 'structure_assumption_question_missing', assumptionText: '默认两级审批' },
  ]),
])
assert.equal(duplicateResults.length, 1)
assert.equal(duplicateResults[0]?.title, '按“默认两级审批”来吗？')
assert.deepEqual(duplicateResults[0]?.options.map(option => option.value), ['accept-assumption', 'describe-myself'])

// 4) 最多三题；没有假设原文一律不猜
const manyResults = buildFlowSchemeStopLossQuestions([
  failedSchemeResult([
    { code: 'structure_assumption_decision_missing', assumptionText: '默认两级审批' },
    { code: 'structure_assumption_decision_missing', assumptionText: '默认按金额分流' },
    { code: 'structure_assumption_decision_missing', assumptionText: '主管先审批' },
    { code: 'structure_assumption_decision_missing', assumptionText: '财务复核' },
  ]),
])
assert.equal(manyResults.length, 3)
assert.equal(buildFlowSchemeStopLossQuestions([
  failedSchemeResult([{ code: 'structure_assumption_question_missing', decisionKey: 'flow.approval.structure' }]),
]).length, 0)
assert.equal(buildFlowSchemeStopLossQuestions([
  failedSchemeResult([{ code: 'assumption_impact_missing' }]),
]).length, 0)

// 5) 触发止损前已经修好的假设不再提问，只问最后一次失败里还留着的
const latestFailureOnly = buildFlowSchemeStopLossQuestions([
  failedSchemeResult([{ code: 'structure_assumption_decision_missing', assumptionText: '默认两级审批' }]),
  failedSchemeResult([{ code: 'structure_assumption_question_missing', assumptionText: '默认按金额分流' }]),
])
assert.deepEqual(latestFailureOnly.map(question => question.title), ['按“默认按金额分流”来吗？'])

// 5.1) 实机最后一次失败常只有“下游题缺失”，这类诊断也必须能出题，否则收口卡是空的
const dependentOnly = buildFlowSchemeStopLossQuestions([
  failedSchemeResult([
    { code: 'structure_assumption_dependent_missing', assumptionText: '沿用当前草稿结构', decisionKey: 'flow.base.structure', dependencyKey: 'flow.trigger.type' },
    { code: 'structure_assumption_dependent_missing', assumptionText: '沿用当前草稿结构', decisionKey: 'flow.base.structure', dependencyKey: 'flow.approval.structure' },
  ]),
])
assert.deepEqual(dependentOnly.map(question => question.title), ['按“沿用当前草稿结构”来吗？'])

// 6) 已结算的决策键/题目标题不再问；同一题问过两轮仍无解也不再弹卡
const answeredResults = [
  failedSchemeResult([
    { code: 'structure_assumption_question_missing', assumptionText: '默认两级审批', decisionKey: 'flow.approval.structure' },
    { code: 'structure_assumption_decision_missing', assumptionText: '默认按金额分流' },
  ]),
]
assert.equal(buildFlowSchemeStopLossQuestions(answeredResults, {
  answeredDecisionKeys: ['flow.approval.structure'],
}).length, 1)
assert.equal(buildFlowSchemeStopLossQuestions(answeredResults, {
  answeredQuestionTitles: ['按“默认按金额分流”来吗？'],
}).length, 1)
const repeatAsked = buildFlowSchemeStopLossQuestions(answeredResults, {
  askedQuestionCounts: {
    '按“默认两级审批”来吗？': 2,
    '按“默认按金额分流”来吗？': 1,
  },
})
assert.deepEqual(repeatAsked.map(question => question.title), ['按“默认按金额分流”来吗？'])

// 7) 假设原文过长时截断，避免题目变成一整段正文
const longAssumption = '按金额分流并依次经过主管审批、部门经理审批、财务复核和总经理审批后再回写报销单状态'
  .repeat(2)
const longQuestion = buildFlowSchemeStopLossQuestions([
  failedSchemeResult([{ code: 'structure_assumption_decision_missing', assumptionText: longAssumption }]),
])[0]
assert.equal(longQuestion?.title.length, '按“”来吗？'.length + 60 + 3)

// 8) 收口问题能通过面板归一化，按单选出卡，并且文案不含实现词
const visibleQuestions = normalizeVisibleFlowGroundingQuestions({ questions: duplicateResults })
assert.equal(visibleQuestions.length, 1)
assert.equal(visibleQuestions[0]?.questionKind, 'single_select')
assert.equal(visibleQuestions[0]?.allowFreeText, true)
assert.equal(visibleQuestions[0]?.decisionKey, undefined)

const stopLossMessage = buildFlowSchemeStopLossMessage(duplicateResults)
assert.equal(Boolean(stopLossMessage), true)
for (const technical of ['decisionKey', 'stepKey', 'fieldKey', 'formKey', 'branchKey']) {
  assert.equal(stopLossMessage.includes(technical), false)
  assert.equal(String(duplicateResults[0]?.description).includes(technical), false)
}
assert.equal(buildFlowSchemeStopLossMessage([]), '')

// 9) 蓝图失败文案不再把“请重试”当唯一动作，并说明已保留什么
const readLocale = (locale: string) => {
  const localePath = path.resolve(__dirname, `../../src/locales/${locale}/lang.json`)
  return JSON.parse(fs.readFileSync(localePath, 'utf8'))
}
const zhCnChatCopy = readLocale('zh-CN').nocodeEditorChatService
assert.equal(String(zhCnChatCopy.blueprintUpdateNotApplied).includes('请重试'), false)
assert.equal(String(zhCnChatCopy.blueprintUpdateNotApplied).includes('没有丢失'), true)
assert.equal(String(zhCnChatCopy.blueprintRetryHint).includes('按当前蓝图生成'), true)
assert.equal(Boolean(readLocale('zh-CN').nocodeEditorAiPanel.flowSchemeFactStopLoss), true)

// 10) 收口题 id 不再按位置生成：同一假设跨轮稳定，换题不会继承上一题答案
const stopLossQuestionFor = (assumptionText: string, decisionKey?: string) => (
  buildFlowSchemeStopLossQuestions([
    failedSchemeResult([{
      code: 'structure_assumption_decision_missing',
      assumptionText,
      ...(decisionKey ? { decisionKey } : {}),
    }]),
  ])[0]
)
const stableQuestion = stopLossQuestionFor('默认两级审批')!
const sameQuestionNextRound = stopLossQuestionFor('默认两级审批')!
const otherQuestion = stopLossQuestionFor('默认按金额分流')!
const keyedQuestion = stopLossQuestionFor('默认两级审批', 'flow.approval.structure')!

assert.equal(stableQuestion.id, sameQuestionNextRound.id)
assert.equal(/^flow-plan-question-/.test(stableQuestion.id), true)
assert.notEqual(otherQuestion.id, stableQuestion.id)
assert.notEqual(keyedQuestion.id, stableQuestion.id)
assert.equal(keyedQuestion.id, stopLossQuestionFor('默认两级审批', 'flow.approval.structure')!.id)

const previousStopLossDecisions = [{
  questionId: stableQuestion.id,
  questionTitle: stableQuestion.title,
  decisionKey: stableQuestion.id,
  decisionKeySource: 'legacy_question_id' as const,
  selectedOptionValue: 'accept-assumption',
}]
const reconcileStopLossQuestion = (question: typeof stableQuestion) => (
  reconcileNocodeEditorConfirmationDecisions({
    confirmation: {
      stage: 'flow-scheme',
      status: 'pending',
      questions: [question],
    } as NocodeEditorAiConfirmPayload,
    previousDecisions: previousStopLossDecisions,
  })
)
const sameQuestionReconciled = reconcileStopLossQuestion(sameQuestionNextRound)
assert.equal(sameQuestionReconciled.confirmation?.questions[0]?.confirmed, true)
assert.equal(sameQuestionReconciled.confirmation?.status, 'completed')
const otherQuestionReconciled = reconcileStopLossQuestion(otherQuestion)
assert.equal(otherQuestionReconciled.confirmation?.questions[0]?.confirmed, false)
assert.equal(otherQuestionReconciled.confirmation?.status, 'pending')

console.log('flow-scheme-fact-stop-loss: ok')
