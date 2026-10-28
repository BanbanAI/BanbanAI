import assert from 'node:assert/strict'
import i18next from 'i18next'

import {
  resolveAiArtifactCurrentRoundQuestions,
  resolveAiArtifactPendingQuestions,
  resolveAiArtifactQuestions,
  resolveAiArtifactStatusTag,
} from '../../src/renderer/views/nocode/components/ai/artifactBlock'
import type { AiAssistantFlowSchemeArtifactBlock } from '../../src/common/types/ai'

const CUMULATIVE_QUESTIONS = [
  {
    id: 'q1',
    decisionKey: 'trigger_mode',
    title: '流程触发方式',
    confirmed: true,
    answerSummary: '提交后自动发起',
  },
  {
    id: 'q2',
    decisionKey: 'amount_branching',
    title: '是否按报销金额分流',
    confirmed: true,
    answerSummary: '否',
  },
  {
    id: 'q3',
    decisionKey: 'flow.approval.owner.source',
    title: '审批人来源',
    confirmed: true,
    answerSummary: '指定成员/角色',
  },
]

const createFlowSchemeBlock = (input: {
  openQuestionKeys: string[]
  status?: 'pending' | 'completed'
  questions?: typeof CUMULATIVE_QUESTIONS
}): AiAssistantFlowSchemeArtifactBlock => {
  const questions = input.questions || CUMULATIVE_QUESTIONS
  const confirmation = {
    stage: 'flow-scheme',
    schemeRevision: 2,
    status: input.status || 'completed',
    questions,
  }
  return {
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'ready',
    revision: 2,
    title: '报销申请审批流程',
    confirmation,
    scheme: {
      revision: 2,
      title: '报销申请审批流程',
      openQuestions: input.openQuestionKeys.map(key => ({
        key,
        title: key,
        reason: key,
      })),
      confirmation,
    },
  } as unknown as AiAssistantFlowSchemeArtifactBlock
}

const completedV2Block = createFlowSchemeBlock({
  openQuestionKeys: ['flow.approval.owner.source'],
})
assert.deepEqual(
  resolveAiArtifactQuestions(completedV2Block).map(question => question.title),
  ['流程触发方式', '是否按报销金额分流', '审批人来源'],
)
assert.deepEqual(
  resolveAiArtifactCurrentRoundQuestions(completedV2Block).map(question => question.title),
  ['审批人来源'],
)

const pendingV2Block = createFlowSchemeBlock({
  openQuestionKeys: ['flow.approval.owner.source'],
  status: 'pending',
  questions: CUMULATIVE_QUESTIONS.map(question => (
    question.decisionKey === 'flow.approval.owner.source'
      ? { ...question, confirmed: false, answerSummary: '' }
      : question
  )),
})
assert.deepEqual(
  resolveAiArtifactPendingQuestions(pendingV2Block).map(question => question.title),
  ['审批人来源'],
)
assert.deepEqual(
  resolveAiArtifactCurrentRoundQuestions(pendingV2Block).map(question => question.title),
  ['审批人来源'],
)

const blockWithoutOpenQuestions = createFlowSchemeBlock({ openQuestionKeys: [] })
assert.deepEqual(
  resolveAiArtifactCurrentRoundQuestions(blockWithoutOpenQuestions).map(question => question.title),
  ['流程触发方式', '是否按报销金额分流', '审批人来源'],
)

const nonFlowBlock = {
  type: 'artifact',
  kind: 'form-plan',
  status: 'ready',
  confirmation: {
    stage: 'form-plan',
    status: 'completed',
    questions: CUMULATIVE_QUESTIONS,
  },
} as unknown as AiAssistantFlowSchemeArtifactBlock
assert.deepEqual(
  resolveAiArtifactCurrentRoundQuestions(nonFlowBlock),
  resolveAiArtifactQuestions(nonFlowBlock),
)

// 历史 completed 状态仍可能带着新的待确认项，状态标签必须先看待答数。
const completedStatusWithPendingQuestion = createFlowSchemeBlock({
  openQuestionKeys: ['flow.approval.owner.source'],
  status: 'completed',
  questions: CUMULATIVE_QUESTIONS.map(question => (
    question.decisionKey === 'flow.approval.owner.source'
      ? { ...question, confirmed: false, answerSummary: '' }
      : question
  )),
})
assert.deepEqual(
  resolveAiArtifactPendingQuestions(completedStatusWithPendingQuestion).map(question => question.title),
  ['审批人来源'],
)
assert.equal(
  resolveAiArtifactStatusTag(completedStatusWithPendingQuestion),
  i18next.t('artifactBlock.pendingConfirmation'),
)
assert.equal(
  resolveAiArtifactStatusTag(completedV2Block),
  i18next.t('nocodeEditorAiConfirmationCard.confirmedComplete'),
)

console.log('flow-scheme current-round confirmed questions regression passed')
