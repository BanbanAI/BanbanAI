import assert from 'node:assert/strict'

import {
  healFlowSchemeDecisionKeys,
} from '../../src/common/utils/nocodeEditorFlowDecisionKeyHealing'
import {
  normalizeNocodeEditorFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowScheme'

const PLANNING_CONTEXT_KEY = 'flow-scheme:scheme_1793151052169:t_xj5ehxyy00os'
const CURRENT_KEY = 'flow.structure.amount_split'
const PREVIOUS_KEY = 'flow.amount.condition'
const DOWNSTREAM_KEY = 'flow.amount.split.owner'
const FLOW_SCOPE = { kind: 'flow', id: 't_xj5ehxyy00os' }
const QUESTION_TITLE = '按报销总金额分流审批'
const LEDGER_ANSWER = '1000元以内：财务审批；1000元以上：财务审批 → 部门主管审批'

const buildScheme = (input?: {
  scope?: Record<string, unknown>
  producesFacts?: string[]
  title?: string
  changes?: string[]
  splitAnswered?: boolean
}) => ({
  target: { formId: 't_xj5ehxyy00os', formName: '报销单' },
  title: '报销单审批流程',
  summary: '提交报销单后按合计金额分流审批。',
  trigger: { type: 'submit', description: '提交报销单后自动发起审批' },
  mainPath: [],
  branches: [],
  confirmedFacts: [],
  assumptions: [{
    text: '按金额分流',
    impact: 'structure',
    decisionKey: CURRENT_KEY,
    dependentDecisionKeys: [DOWNSTREAM_KEY],
  }],
  openQuestions: [{
    key: CURRENT_KEY,
    title: QUESTION_TITLE,
    reason: '需要确认分流结构',
  }],
  dependencies: [{
    id: 'dep-split',
    decisionKey: CURRENT_KEY,
    kind: 'field_missing',
    requiredFor: 'condition',
    scopeKind: 'global',
    riskLevel: 'low',
    resolutionStatus: 'unresolved',
    materializationStatus: 'not_available',
    summary: '缺少分流条件字段',
  }],
  confirmation: {
    status: 'pending',
    decisionContractVersion: 2,
    factSnapshot: {},
    questions: [{
      id: 'q-split',
      decisionKey: CURRENT_KEY,
      title: input?.title || QUESTION_TITLE,
      questionKind: 'note_only',
      required: true,
      dependsOn: [],
      decisionScope: input?.scope || FLOW_SCOPE,
      requiresFacts: [],
      producesFacts: input?.producesFacts || [CURRENT_KEY],
      changes: input?.changes || ['topology', 'scope'],
      ...(input?.splitAnswered ? { confirmed: true, answerSummary: '本轮已答' } : {}),
    }, {
      id: 'q-owner',
      decisionKey: DOWNSTREAM_KEY,
      title: '分流审批人来源',
      questionKind: 'note_only',
      required: false,
      dependsOn: [CURRENT_KEY],
      prerequisites: [{ decisionKey: CURRENT_KEY, operator: 'equals', values: ['yes'] }],
      decisionScope: FLOW_SCOPE,
      requiresFacts: [],
      producesFacts: [],
      changes: ['meaning'],
    }],
  },
})

const previousQuestion = (overrides?: Record<string, unknown>) => ({
  id: 'prev-split',
  decisionKey: PREVIOUS_KEY,
  title: QUESTION_TITLE,
  questionKind: 'note_only',
  decisionScope: FLOW_SCOPE,
  requiresFacts: [],
  producesFacts: [CURRENT_KEY],
  changes: ['topology', 'scope'],
  ...overrides,
})

const ANSWERED_LEDGER = [{
  decisionKey: PREVIOUS_KEY,
  confirmed: true,
  answerSummary: LEDGER_ANSWER,
}]

// 正例：账本里有上一版同锚点题的答案，本轮换了键 → 改回上一版键并重写全部引用。
const healed = healFlowSchemeDecisionKeys({
  scheme: buildScheme(),
  previousQuestions: [previousQuestion()],
  answeredDecisions: ANSWERED_LEDGER,
})
assert.deepEqual(healed.healed, [{
  from: CURRENT_KEY,
  to: PREVIOUS_KEY,
  reason: 'fact',
}])
const healedScheme = healed.scheme as any
assert.equal(healedScheme.confirmation.questions[0].decisionKey, PREVIOUS_KEY)
assert.equal(healedScheme.openQuestions[0].key, PREVIOUS_KEY)
assert.equal(healedScheme.dependencies[0].decisionKey, PREVIOUS_KEY)
assert.equal(healedScheme.assumptions[0].decisionKey, PREVIOUS_KEY)
assert.deepEqual(healedScheme.assumptions[0].dependentDecisionKeys, [DOWNSTREAM_KEY])
assert.deepEqual(healedScheme.confirmation.questions[1].dependsOn, [PREVIOUS_KEY])
assert.equal(healedScheme.confirmation.questions[1].prerequisites[0].decisionKey, PREVIOUS_KEY)
// 下游题自己的键不受影响。
assert.equal(healedScheme.confirmation.questions[1].decisionKey, DOWNSTREAM_KEY)

// 愈合后的方案经 normalize 与答案账本合并：该题已答、status=completed。
// 只保留被愈合的题：无关联的下游题即使 required=false 也会被既有对账记为 unresolved。
const normalized = normalizeNocodeEditorFlowScheme({
  ...healedScheme,
  confirmation: {
    ...healedScheme.confirmation,
    questions: [healedScheme.confirmation.questions[0]],
  },
}, {
  trustedAnswers: {
    planningContextKey: PLANNING_CONTEXT_KEY,
    decisions: [{ decisionKey: PREVIOUS_KEY, answerSummary: LEDGER_ANSWER }],
  },
})
assert.ok(normalized)
assert.equal(normalized!.confirmation?.status, 'completed')
const normalizedSplit = normalized!.confirmation?.questions
  .find(question => question.decisionKey === PREVIOUS_KEY)
assert.ok(normalizedSplit)
assert.equal(normalizedSplit!.confirmed, true)

// title 锚点分支：producesFacts 无交集，但题面与 changes 同时重合。
const titleHealed = healFlowSchemeDecisionKeys({
  scheme: buildScheme({ producesFacts: ['flow.structure.other'] }),
  previousQuestions: [previousQuestion({ producesFacts: [] })],
  answeredDecisions: ANSWERED_LEDGER,
})
assert.deepEqual(titleHealed.healed, [{
  from: CURRENT_KEY,
  to: PREVIOUS_KEY,
  reason: 'title',
}])

// 反例 1：scope 不同 → 不愈合。
const scopeMismatch = healFlowSchemeDecisionKeys({
  scheme: buildScheme({ scope: { kind: 'flow', id: 't_other' } }),
  previousQuestions: [previousQuestion()],
  answeredDecisions: ANSWERED_LEDGER,
})
assert.deepEqual(scopeMismatch.healed, [])

// 反例 2：两个候选同时命中 → 不愈合。
const ambiguous = healFlowSchemeDecisionKeys({
  scheme: buildScheme(),
  previousQuestions: [
    previousQuestion(),
    previousQuestion({ id: 'prev-split-2', decisionKey: 'flow.amount.condition_v2' }),
  ],
  answeredDecisions: [
    ...ANSWERED_LEDGER,
    { decisionKey: 'flow.amount.condition_v2', confirmed: true, answerSummary: LEDGER_ANSWER },
  ],
})
assert.deepEqual(ambiguous.healed, [])

// 反例 3：本轮题已有答案 → 不覆盖。
const alreadyAnswered = healFlowSchemeDecisionKeys({
  scheme: buildScheme({ splitAnswered: true }),
  previousQuestions: [previousQuestion()],
  answeredDecisions: [
    ...ANSWERED_LEDGER,
    { decisionKey: CURRENT_KEY, confirmed: true, answerSummary: '本轮已答' },
  ],
})
assert.deepEqual(alreadyAnswered.healed, [])

// 反例 4：上一版题存在、但答案账本里没有它 → 不愈合。
const missingLedger = healFlowSchemeDecisionKeys({
  scheme: buildScheme(),
  previousQuestions: [previousQuestion()],
  answeredDecisions: [{ decisionKey: 'flow.unrelated', confirmed: true, answerSummary: '无关答案' }],
})
assert.deepEqual(missingLedger.healed, [])

// 反例 5：上一版只有 assumptions、confirmation.questions 为空 → 不愈合（§2 场景由 #2 解）。
const assumptionsOnly = healFlowSchemeDecisionKeys({
  scheme: buildScheme(),
  previousQuestions: [],
  answeredDecisions: ANSWERED_LEDGER,
})
assert.deepEqual(assumptionsOnly.healed, [])

// 反例 6：confirmation 为 null → 原样返回，不抛错。
const nullConfirmationScheme = { ...buildScheme(), confirmation: null }
const nullConfirmation = healFlowSchemeDecisionKeys({
  scheme: nullConfirmationScheme,
  previousQuestions: [previousQuestion()],
  answeredDecisions: ANSWERED_LEDGER,
})
assert.equal(nullConfirmation.scheme, nullConfirmationScheme)
assert.deepEqual(nullConfirmation.healed, [])

console.log('flow-decision-key-heal: ok')
console.log('  正例:', healed.healed.map(item => `${item.from} -> ${item.to} (${item.reason})`).join(', '))
console.log('  愈合后 status:', normalized!.confirmation?.status)
