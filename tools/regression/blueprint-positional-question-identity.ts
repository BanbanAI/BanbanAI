import assert from 'node:assert/strict'

import {
  projectBlueprintConfirmation,
  reconcileBlueprintConfirmationDecisions,
} from '../../src/common/utils/nocodeEditorBlueprintConfirmationProjection'

const target = {
  kind: 'field-source' as const,
  formKey: 'form-leave',
  formName: '学生请假申请表',
  fieldKey: 'f-days',
  fieldName: '请假天数',
}

// 上一轮已答的迟到题只有位置型 id，题面与下一轮不同。
const completedLegacyLateQuestion = {
  id: 'blueprint-late-question-1',
  title: '“班级”字段的数据来源是什么？',
  domain: 'form' as const,
  questionKind: 'single_select' as const,
  options: [
    { value: 'manual', label: '手填', selected: true },
    { value: 'relation', label: '关联学生档案' },
  ],
  selectedOptionValue: 'manual',
  answerSummary: '手填',
  confirmed: true,
}

const nextRoundDifferentLateQuestion = {
  id: 'blueprint-late-question-1',
  title: '“请假天数”如何计算？',
  domain: 'form' as const,
  questionKind: 'note_only' as const,
  decisionTarget: target,
}

// 1) 同编号不同题面：新题必须展示，不能被上一轮的 blueprint-late-question-1 吞掉
const differentQuestionProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [completedLegacyLateQuestion],
  },
  openQuestions: [],
  lateQuestions: [nextRoundDifferentLateQuestion],
})
assert.equal(differentQuestionProjection.pendingQuestions.length, 1)
assert.equal(differentQuestionProjection.pendingQuestions[0].title, '“请假天数”如何计算？')
assert.ok(differentQuestionProjection.confirmation?.questions.some(
  question => question.id === 'blueprint-late-question-1' && question.confirmed === true,
))

// 2) 完全相同的题干仍按题面合并，避免重复卡
const sameTitleProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [completedLegacyLateQuestion],
  },
  openQuestions: [],
  lateQuestions: [{
    ...nextRoundDifferentLateQuestion,
    title: completedLegacyLateQuestion.title,
    decisionTarget: undefined,
  }],
})
assert.equal(sameTitleProjection.pendingQuestions.length, 0)

// 3) ensureUniqueQuestionIds 生成的 -N 后缀同样不进入已完成身份
const suffixedQuestionProjection = reconcileBlueprintConfirmationDecisions({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [{
      id: 'blueprint-question-1-2',
      title: '“请假天数”如何计算？',
      questionKind: 'note_only',
      decisionTarget: target,
    }],
  },
  completedConfirmation: {
    stage: 'blueprint',
    status: 'completed',
    questions: [{
      id: 'blueprint-question-1-2',
      title: '“班级”字段的数据来源是什么？',
      questionKind: 'note_only',
      confirmed: true,
      answerSummary: '手填',
    }],
  },
})
assert.equal(suffixedQuestionProjection.pendingQuestions.length, 1)
assert.equal(suffixedQuestionProjection.pendingQuestions[0].title, '“请假天数”如何计算？')

// 4) 只排除位置型 id：稳定 id 与 decisionKey 仍然参与已完成判定
const stableIdProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [{
      ...completedLegacyLateQuestion,
      id: 'q_stable_1',
      title: '“班级”字段的数据来源是什么？',
    }],
  },
  openQuestions: [],
  lateQuestions: [{
    ...nextRoundDifferentLateQuestion,
    id: 'q_stable_1',
  }],
})
assert.equal(stableIdProjection.pendingQuestions.length, 0)

const decisionKeyProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [{
      ...completedLegacyLateQuestion,
      id: 'blueprint-question-1',
      decisionKey: 'student.leave.days',
    }],
  },
  openQuestions: [],
  lateQuestions: [{
    ...nextRoundDifferentLateQuestion,
    id: 'blueprint-late-question-2',
    decisionKey: 'student.leave.days',
  }],
})
assert.equal(decisionKeyProjection.pendingQuestions.length, 0)

console.log('blueprint-positional-question-identity: ok')
