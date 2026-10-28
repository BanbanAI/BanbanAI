import assert from 'node:assert/strict'

import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '../../src/common/types/nocodeEditorConfirmation'
import {
  findVerifiedUserQuote,
  settleNocodeEditorFlowQuestionsByUserQuote,
} from '../../src/common/utils/nocodeEditorFlowConfirmationTrust'
import {
  resolveNocodeEditorAiCurrentTurnUserMessages,
} from '../../src/common/utils/nocodeEditorAiCurrentTurnMessages'

// 2026-10-28 真实会话 editor_b39gvfqji2n6_..._fc8t83 的用户原话。
const LONG_USER_TEXT = '1000元以内：财务审批；1000元以上：财务审批 → 部门主管审批'

const noteQuestion = (input: {
  id: string
  decisionKey: string
  userQuote?: string
  confirmed?: boolean
}): NocodeEditorAiConfirmQuestion => ({
  id: input.id,
  decisionKey: input.decisionKey,
  title: '按报销总金额分流审批',
  questionKind: 'note_only',
  required: true,
  dependsOn: [],
  ...(input.userQuote !== undefined ? { userQuote: input.userQuote } : {}),
  ...(input.confirmed !== undefined ? { confirmed: input.confirmed } : {}),
})

const confirmationOf = (questions: NocodeEditorAiConfirmQuestion[]): NocodeEditorAiConfirmPayload => ({
  stage: 'flow-scheme',
  status: 'pending',
  questions,
})

const settleSingle = (input: {
  question: NocodeEditorAiConfirmQuestion
  userTexts: string[]
}) => {
  const result = settleNocodeEditorFlowQuestionsByUserQuote({
    confirmation: confirmationOf([input.question]),
    userTexts: input.userTexts,
  })
  assert.ok(result.confirmation)
  return {
    result,
    question: result.confirmation!.questions[0],
  }
}

// 1. 长句原样复制：片段包含分支（归一化后 ≥ 8 字）通过。
assert.equal(findVerifiedUserQuote({ quote: LONG_USER_TEXT, userTexts: [LONG_USER_TEXT] }), LONG_USER_TEXT)
const longQuoteSettled = settleSingle({
  question: noteQuestion({
    id: 'q_split',
    decisionKey: 'flow.structure.amount_split',
    userQuote: LONG_USER_TEXT,
  }),
  userTexts: [LONG_USER_TEXT],
})
assert.deepEqual(longQuoteSettled.result.settledKeys, ['flow.structure.amount_split'])
assert.deepEqual(longQuoteSettled.result.unverifiedKeys, [])
assert.equal(longQuoteSettled.question.confirmed, true)
assert.equal(longQuoteSettled.question.answerSummary, LONG_USER_TEXT)
assert.equal(longQuoteSettled.question.userQuote, undefined)
assert.equal(longQuoteSettled.result.confirmation?.status, 'completed')

// 2. 长句被模型改写一个词：核对不过，回传 unverified，照常提问。
const rewrittenQuote = '1000元以内：财务审批；1000元以上：财务审批 → 主管审批'
assert.equal(findVerifiedUserQuote({ quote: rewrittenQuote, userTexts: [LONG_USER_TEXT] }), '')
const rewrittenSettled = settleSingle({
  question: noteQuestion({
    id: 'q_split',
    decisionKey: 'flow.structure.amount_split',
    userQuote: rewrittenQuote,
  }),
  userTexts: [LONG_USER_TEXT],
})
assert.deepEqual(rewrittenSettled.result.settledKeys, [])
assert.deepEqual(rewrittenSettled.result.unverifiedKeys, ['flow.structure.amount_split'])
assert.equal(rewrittenSettled.question.confirmed, undefined)
assert.equal(rewrittenSettled.question.userQuote, undefined)
assert.equal(rewrittenSettled.result.confirmation?.status, 'pending')

// 3. 短语整句回复：整条消息即引文分支（归一化后 4 字）通过。
const shortPhraseSettled = settleSingle({
  question: noteQuestion({
    id: 'q_split',
    decisionKey: 'flow.structure.amount_split',
    userQuote: '财务审批',
  }),
  userTexts: ['财务审批'],
})
assert.deepEqual(shortPhraseSettled.result.settledKeys, ['flow.structure.amount_split'])
assert.equal(shortPhraseSettled.question.confirmed, true)

// 4. 通用应答整句回复：2 字，两个分支都不满足。
const genericReply = settleSingle({
  question: noteQuestion({
    id: 'q_split',
    decisionKey: 'flow.structure.amount_split',
    userQuote: '好的',
  }),
  userTexts: ['好的'],
})
assert.deepEqual(genericReply.result.unverifiedKeys, ['flow.structure.amount_split'])

// 5. 短语只出现在长消息里：不足 8 字且非整条消息，不结算。
const phraseInsideLongMessage = settleSingle({
  question: noteQuestion({
    id: 'q_split',
    decisionKey: 'flow.structure.amount_split',
    userQuote: '财务审批',
  }),
  userTexts: ['先让财务审批吧，其他按你说的来'],
})
assert.deepEqual(phraseInsideLongMessage.result.unverifiedKeys, ['flow.structure.amount_split'])

// 6. 引文来自模型自己的假设：不在用户发言里，核对失败。
const assumptionQuote = settleSingle({
  question: noteQuestion({
    id: 'q_split',
    decisionKey: 'flow.structure.amount_split',
    userQuote: '默认按部门主管审批执行',
  }),
  userTexts: [LONG_USER_TEXT],
})
assert.deepEqual(assumptionQuote.result.unverifiedKeys, ['flow.structure.amount_split'])

// 7. 带选项题不参与 v1 引文结算：用户原话确实表态过也不结算，只清掉 evidence 字段。
const optionQuestion: NocodeEditorAiConfirmQuestion = {
  id: 'q_amount_branch',
  decisionKey: 'flow.amount_branch',
  title: '是否需要按报销金额分流？',
  questionKind: 'binary',
  required: true,
  dependsOn: [],
  options: [
    { value: 'yes', label: '是' },
    { value: 'no', label: '否' },
  ],
  userQuote: '需要按金额分流',
}
const optionSettled = settleSingle({
  question: optionQuestion,
  userTexts: ['需要按金额分流'],
})
assert.deepEqual(optionSettled.result.settledKeys, [])
assert.deepEqual(optionSettled.result.unverifiedKeys, [])
assert.equal(optionSettled.question.confirmed, undefined)
assert.equal(optionSettled.question.userQuote, undefined)
assert.equal(optionSettled.result.confirmation?.status, 'pending')

// status 无条件按最终答案集重算：applyTrustedNocodeEditorFlowAnswers 会先写 completed，
// 部分答案回填时不能在无引文的情况下沿用。
const partiallyAnswered = settleNocodeEditorFlowQuestionsByUserQuote({
  confirmation: {
    stage: 'flow-scheme',
    status: 'completed',
    questions: [
      noteQuestion({ id: 'q_a', decisionKey: 'flow.a', confirmed: true }),
      noteQuestion({ id: 'q_b', decisionKey: 'flow.b' }),
    ],
  },
  userTexts: [],
})
assert.equal(partiallyAnswered.confirmation?.status, 'pending')

const fullyAnswered = settleNocodeEditorFlowQuestionsByUserQuote({
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [
      noteQuestion({ id: 'q_a', decisionKey: 'flow.a', confirmed: true }),
      noteQuestion({ id: 'q_b', decisionKey: 'flow.b', userQuote: '财务审批' }),
    ],
  },
  userTexts: ['财务审批'],
})
assert.equal(fullyAnswered.confirmation?.status, 'completed')
assert.deepEqual(fullyAnswered.settledKeys, ['flow.b'])
// 证据字段不随方案落库：结算与未结算两个分支都清空。
assert.deepEqual(
  fullyAnswered.confirmation?.questions.map(question => question.userQuote),
  [undefined, undefined],
)

// 当前轮解析器：遇到 assistant 即停，同一轮多条用户消息按时间正序返回。
const turnMessages = [
  { role: 'user', content: '历史问题', traceId: 't0' },
  { role: 'assistant', content: '历史回答', traceId: 't0' },
  { role: 'user', content: '本轮第一句', traceId: 't1' },
  { role: 'user', content: '本轮第二句', traceId: 't1' },
  { role: 'assistant', content: '本轮答复', traceId: 't1' },
]
assert.deepEqual(
  resolveNocodeEditorAiCurrentTurnUserMessages(turnMessages, 't1'),
  ['本轮第一句', '本轮第二句'],
)
// traceId 不匹配时退回「最后一条为止」的兜底口径：最后一条是 assistant，本轮为空。
assert.deepEqual(resolveNocodeEditorAiCurrentTurnUserMessages(turnMessages, 't2'), [])

console.log('flow-scheme-user-quote-settlement: ok')
console.log('  长句结算:', longQuoteSettled.result.confirmation?.status, '| 改写引文:', rewrittenSettled.result.unverifiedKeys.join(','))
console.log('  部分回填 status:', partiallyAnswered.confirmation?.status)
