import assert from 'node:assert/strict'

import {
  projectBlueprintConfirmation,
} from '../../src/common/utils/nocodeEditorBlueprintConfirmationProjection'
import {
  areConfirmationResponsesAlreadyApplied,
  isConfirmationResponseAlreadyApplied,
} from '../../src/common/utils/nocodeEditorConfirmationResponseMatching'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '../../src/common/types/nocodeEditorConfirmation'

const classTarget = {
  kind: 'field-source' as const,
  formKey: 'form-student',
  formName: '学生信息管理',
  fieldKey: 'f-class',
  fieldName: '班级',
}

const completedClassQuestion = {
  id: 'blueprint-question-1',
  decisionKey: 'student.class.source',
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
  decisionTarget: classTarget,
}

const completedConfirmation = {
  stage: 'blueprint' as const,
  status: 'pending' as const,
  questions: [completedClassQuestion],
}

const sameTargetLateQuestion = {
  id: 'blueprint-late-question-1',
  title: '请确认“班级”的数据来源',
  domain: 'form' as const,
  questionKind: 'note_only' as const,
  decisionTarget: classTarget,
}

const sameTargetProjection = projectBlueprintConfirmation({
  confirmation: completedConfirmation,
  openQuestions: ['“班级”字段的数据来源是什么？'],
  lateQuestions: [sameTargetLateQuestion],
})

assert.equal(sameTargetProjection.pendingQuestions.length, 0)
assert.equal(sameTargetProjection.openQuestions.length, 0)
assert.equal(sameTargetProjection.confirmation?.questions.length, 1)
assert.equal(sameTargetProjection.confirmation?.questions[0].id, 'blueprint-question-1')
assert.equal(sameTargetProjection.confirmation?.questions[0].confirmed, true)

const distinctTargetLateQuestion = {
  id: 'blueprint-late-question-2',
  title: '“请假天数”如何计算？',
  domain: 'form' as const,
  questionKind: 'note_only' as const,
  decisionTarget: {
    kind: 'field-source' as const,
    formKey: 'form-leave',
    formName: '学生请假申请表',
    fieldKey: 'f-days',
    fieldName: '请假天数',
  },
}

const distinctTargetProjection = projectBlueprintConfirmation({
  confirmation: completedConfirmation,
  openQuestions: [],
  lateQuestions: [distinctTargetLateQuestion],
})

assert.equal(distinctTargetProjection.pendingQuestions.length, 1)
assert.equal(distinctTargetProjection.pendingQuestions[0].id, 'blueprint-late-question-2')
assert.equal(distinctTargetProjection.pendingQuestions[0].decisionTarget?.formKey, 'form-leave')
assert.equal(distinctTargetProjection.pendingQuestions[0].decisionTarget?.formName, '学生请假申请表')
assert.equal(distinctTargetProjection.pendingQuestions[0].decisionTarget?.fieldName, '请假天数')
assert.equal(distinctTargetProjection.confirmation?.status, 'pending')
assert.ok(distinctTargetProjection.confirmation?.questions.some(
  question => question.id === 'blueprint-question-1' && question.confirmed === true,
))

const appliedConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [completedClassQuestion],
}
const confirmedQuestion = completedClassQuestion as unknown as NocodeEditorAiConfirmQuestion

assert.equal(isConfirmationResponseAlreadyApplied(appliedConfirmation, {
  question: confirmedQuestion,
  option: { value: 'manual', label: '手填' },
}), true)
assert.equal(isConfirmationResponseAlreadyApplied(appliedConfirmation, {
  question: confirmedQuestion,
  option: { value: 'relation', label: '关联学生档案' },
}), false)
const duplicateLabelConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [{
    id: 'blueprint-question-3',
    title: '“班级”是否手填？',
    questionKind: 'single_select',
    options: [
      { value: 'yes', label: '是', selected: true },
      { value: 'no', label: '是' },
    ],
    selectedOptionValue: 'yes',
    answerSummary: '是',
    confirmed: true,
  }],
}
assert.equal(isConfirmationResponseAlreadyApplied(duplicateLabelConfirmation, {
  question: duplicateLabelConfirmation.questions[0],
  option: { value: 'no', label: '是' },
}), false)
assert.equal(isConfirmationResponseAlreadyApplied(appliedConfirmation, {
  question: confirmedQuestion,
  note: '手填',
}), true)
assert.equal(isConfirmationResponseAlreadyApplied(appliedConfirmation, {
  question: confirmedQuestion,
  note: '改为关联学生档案',
}), false)
assert.equal(isConfirmationResponseAlreadyApplied(appliedConfirmation, {
  question: {
    ...confirmedQuestion,
    id: 'unknown-question',
    decisionKey: 'unknown.decision',
    title: '另一个问题',
  },
  option: { value: 'manual', label: '手填' },
}), false)
assert.equal(areConfirmationResponsesAlreadyApplied(appliedConfirmation, []), false)
assert.equal(areConfirmationResponsesAlreadyApplied(appliedConfirmation, [
  { question: confirmedQuestion, option: { value: 'manual', label: '手填' } },
]), true)
assert.equal(areConfirmationResponsesAlreadyApplied(appliedConfirmation, [
  { question: confirmedQuestion, option: { value: 'manual', label: '手填' } },
  {
    question: {
      ...confirmedQuestion,
      id: 'blueprint-question-2',
      decisionKey: 'student.leave.days',
      title: '“请假天数”如何计算？',
      decisionTarget: distinctTargetLateQuestion.decisionTarget,
    },
    note: '按开始和结束日期自动计算',
  },
]), false)

// optional 题未作答不应把蓝图确认投影留在待答态。
const optionalConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [
    completedClassQuestion,
    {
      id: 'blueprint-question-optional',
      title: '是否需要导出学生名单？',
      questionKind: 'single_select',
      required: false,
    },
  ],
}
const optionalProjection = projectBlueprintConfirmation({ confirmation: optionalConfirmation })
assert.equal(optionalProjection.pendingQuestions.length, 0)
assert.equal(optionalProjection.openQuestions.length, 0)

const requiredFollowUpConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [
    completedClassQuestion,
    {
      id: 'blueprint-question-required',
      title: '是否需要导出学生名单？',
      questionKind: 'single_select',
      required: true,
    },
  ],
}
const requiredFollowUpProjection = projectBlueprintConfirmation({ confirmation: requiredFollowUpConfirmation })
assert.equal(requiredFollowUpProjection.pendingQuestions.length, 1)
assert.equal(requiredFollowUpProjection.pendingQuestions[0].id, 'blueprint-question-required')

const titleOnlyQuestion = {
  title: '“班级”字段的数据来源是什么？',
} as unknown as NocodeEditorAiConfirmQuestion
const titleOnlyConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'completed',
  questions: [{
    title: '“班级”字段的数据来源是什么？',
    answerSummary: '手填',
    confirmed: true,
  } as unknown as NocodeEditorAiConfirmQuestion],
}
// 没有稳定身份的历史题：题面唯一时仍可匹配。
assert.equal(isConfirmationResponseAlreadyApplied(titleOnlyConfirmation, {
  question: titleOnlyQuestion,
  note: '手填',
}), true)

// 稳定身份未知时不能靠同名题命中已答题。
assert.equal(isConfirmationResponseAlreadyApplied(titleOnlyConfirmation, {
  question: {
    id: 'unknown-question',
    decisionKey: 'unknown.decision',
    title: titleOnlyQuestion.title,
  } as unknown as NocodeEditorAiConfirmQuestion,
  note: '手填',
}), false)

const duplicatedTitleConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'completed',
  questions: [
    {
      title: '是否手填？',
      answerSummary: '是',
      confirmed: true,
    },
    {
      title: '是否手填？',
      answerSummary: '否',
      confirmed: true,
    },
  ] as unknown as NocodeEditorAiConfirmQuestion[],
}
// 题面重复时不能按题面合并。
assert.equal(isConfirmationResponseAlreadyApplied(duplicatedTitleConfirmation, {
  question: { title: '是否手填？' } as unknown as NocodeEditorAiConfirmQuestion,
  note: '是',
}), false)

const incompleteStableConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [
    { id: 'q-pending', title: '同一题面', confirmed: false },
    { id: 'q-done', title: '同一题面', answerSummary: '是', confirmed: true },
  ],
}
// 稳定身份命中未完成题时，不再回落到同名已答题。
assert.equal(isConfirmationResponseAlreadyApplied(incompleteStableConfirmation, {
  question: { id: 'q-pending', title: '同一题面' } as NocodeEditorAiConfirmQuestion,
  note: '是',
}), false)

console.log('blueprint-confirmation-late-question-dedupe: ok')
