import assert from 'node:assert/strict'

import {
  resolveAiArtifactDefaultHandledQuestions,
  resolveAiArtifactPendingQuestions,
} from '../../src/renderer/views/nocode/components/ai/artifactBlock'
import type { AiAssistantArtifactBlock } from '../../src/common/types/ai'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '../../src/common/types/nocodeEditorConfirmation'
import {
  projectBlueprintConfirmation,
} from '../../src/common/utils/nocodeEditorBlueprintConfirmationProjection'
import {
  isNocodeEditorDefaultHandledConfirmationQuestion,
  isNocodeEditorPendingDecisionQuestion,
} from '../../src/common/utils/nocodeEditorConfirmationQuestionGrouping'

const defaultHandledQuestions: NocodeEditorAiConfirmQuestion[] = [
  {
    id: 'assumption-required-false',
    title: '学生信息字段来源',
    description: '当前应用没有学生表，学生姓名、学号、班级先按手填文本处理。',
    questionKind: 'note_only',
    required: false,
    uncertainty: { category: 'safe_default', reasonCode: 'no-student-table' },
  },
  {
    id: 'assumption-deferred-optional',
    title: '班级字段后续可升级为关联字段',
    questionKind: 'note_only',
    uncertainty: { category: 'deferred_optional', reasonCode: 'optional-upgrade' },
  },
]

const decisionQuestion: NocodeEditorAiConfirmQuestion = {
  id: 'decision-class-source',
  title: '班级字段要关联哪个表单？',
  questionKind: 'single_select',
  required: true,
  uncertainty: { category: 'business_decision', reasonCode: 'missing-source' },
  options: [
    { value: 'student', label: '关联学生表' },
    { value: 'manual', label: '继续手填' },
  ],
}

const confirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [...defaultHandledQuestions, decisionQuestion],
}

const createBlueprintBlock = (
  payload: NocodeEditorAiConfirmPayload,
  openQuestions: string[] = [],
) => ({
  kind: 'blueprint',
  blueprint: {
    forms: [],
    confirmation: payload,
    openQuestions,
  },
}) as unknown as AiAssistantArtifactBlock

assert.equal(isNocodeEditorDefaultHandledConfirmationQuestion(defaultHandledQuestions[0]), true)
assert.equal(isNocodeEditorDefaultHandledConfirmationQuestion(defaultHandledQuestions[1]), true)
assert.equal(isNocodeEditorDefaultHandledConfirmationQuestion(decisionQuestion), false)
assert.equal(isNocodeEditorPendingDecisionQuestion(defaultHandledQuestions[0]), false)
assert.equal(isNocodeEditorPendingDecisionQuestion(decisionQuestion), true)
// 已完成的问题即使带 safe_default 也不再计入说明项。
assert.equal(isNocodeEditorDefaultHandledConfirmationQuestion({
  ...defaultHandledQuestions[0],
  confirmed: true,
}), false)

const block = createBlueprintBlock(confirmation)
assert.deepEqual(
  resolveAiArtifactPendingQuestions(block).map(question => question.id),
  ['decision-class-source'],
)
assert.deepEqual(
  resolveAiArtifactDefaultHandledQuestions(block).map(question => question.id),
  ['assumption-required-false', 'assumption-deferred-optional'],
)

// 迟到问题合并时，已按默认处理的说明项不能被投影丢掉。
const projection = projectBlueprintConfirmation({
  confirmation,
  lateQuestions: [{
    id: 'late-question',
    title: '补一个迟到问题',
    questionKind: 'note_only',
    required: true,
  }],
})
assert.deepEqual(
  projection.pendingQuestions.map(question => question.id).sort(),
  ['decision-class-source', 'late-question'],
)
assert.deepEqual(
  (projection.confirmation?.questions || []).map(question => question.id).sort(),
  [
    'assumption-deferred-optional',
    'assumption-required-false',
    'decision-class-source',
    'late-question',
  ],
)
assert.equal(
  projection.openQuestions.includes('学生信息字段来源'),
  false,
)
assert.equal(
  projection.openQuestions.includes('班级字段后续可升级为关联字段'),
  false,
)
assert.equal(
  projection.confirmation?.questions?.some(question => question.id === 'assumption-required-false'),
  true,
)
assert.equal(
  projection.confirmation?.questions?.some(question => question.id === 'assumption-deferred-optional'),
  true,
)

console.log('blueprint-default-handled-questions: ok')
