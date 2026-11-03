import assert from 'node:assert/strict'

import {
  projectBlueprintConfirmation,
} from '../../src/common/utils/nocodeEditorBlueprintConfirmationProjection'

const structuredNotice = {
  id: 'blueprint-student-fields-notice',
  title: '学生信息字段来源',
  description: '当前应用中没有学生表，学生姓名、学号、班级字段暂时按手填文本处理，如果后续创建了学生表，可以升级为关联字段。',
  questionKind: 'note_only' as const,
  required: false,
  uncertainty: {
    category: 'safe_default' as const,
    reasonCode: 'student-fields-default',
  },
}

const duplicateOpenQuestion = '当前应用中没有找到学生表。学生姓名、学号、班级字段暂时按手填文本处理，后续如有学生表可升级为关联字段。'

const duplicateProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [structuredNotice],
  },
  openQuestions: [duplicateOpenQuestion],
})

assert.equal(duplicateProjection.confirmation?.questions.length, 1)
assert.equal(duplicateProjection.confirmation?.questions[0].id, structuredNotice.id)
assert.equal(duplicateProjection.pendingQuestions.length, 0)
assert.equal(duplicateProjection.openQuestions.length, 0)

const questionOpenQuestion = '“年级”字段从哪里获取？请说明关联的表单和字段。'

const questionProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [structuredNotice],
  },
  openQuestions: [questionOpenQuestion],
})

assert.equal(questionProjection.confirmation?.questions.length, 2)
assert.ok(questionProjection.confirmation?.questions.some(
  question => question.title === questionOpenQuestion,
))
assert.ok(questionProjection.confirmation?.questions.some(
  question => question.id === structuredNotice.id,
))

const conflictingFieldNotice = '当前应用中没有找到学生表。学生姓名、学号、年级字段暂时按手填文本处理，后续如有学生表可升级为关联字段。'

const conflictingFieldProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [structuredNotice],
  },
  openQuestions: [conflictingFieldNotice],
})

assert.equal(conflictingFieldProjection.confirmation?.questions.length, 2)
assert.ok(conflictingFieldProjection.confirmation?.questions.some(
  question => question.title === conflictingFieldNotice,
))
assert.ok(conflictingFieldProjection.confirmation?.questions.some(
  question => question.id === structuredNotice.id,
))

const unrelatedNotice = '报销单需要保留纸质发票。'

const unrelatedProjection = projectBlueprintConfirmation({
  confirmation: {
    stage: 'blueprint',
    status: 'pending',
    questions: [structuredNotice],
  },
  openQuestions: [unrelatedNotice],
})

assert.equal(unrelatedProjection.confirmation?.questions.length, 2)
assert.ok(unrelatedProjection.confirmation?.questions.some(
  question => question.title === unrelatedNotice,
))

console.log('blueprint-open-question-notice-dedupe: ok')
