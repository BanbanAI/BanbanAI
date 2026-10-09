import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorPlanningQuestionStage,
} from '../types/nocodeEditorConfirmation'

export const EXPLICIT_PLANNING_TECHNICAL_TEXT_PATTERN = /(?:\b(?:nodeKey|branchKey|nodeId|branchId|fieldId|fieldUID|tableId|sourceId|ownerPolicy|conditionPolicy|writePolicy)\s*(?:=|:)|\b(?:flowSummary|flowPlan|taskContext)\b|\bnot-rendered\b)/i

export const containsExplicitPlanningTechnicalText = (value: unknown) => (
  EXPLICIT_PLANNING_TECHNICAL_TEXT_PATTERN.test(String(value ?? '').trim())
)

const collectPlanningQuestionVisibleText = (
  question: NocodeEditorAiConfirmQuestion,
) => [
  question.title,
  question.description,
  ...(question.options || []).flatMap(option => [option.label, option.description]),
].filter((item): item is string => Boolean(item))

export const normalizePlanningVisibleQuestion = (input: {
  stage: NocodeEditorPlanningQuestionStage
  question: NocodeEditorAiConfirmQuestion
}): NocodeEditorAiConfirmQuestion => {
  if (!collectPlanningQuestionVisibleText(input.question)
    .some(containsExplicitPlanningTechnicalText)) {
    return input.question
  }

  return {
    ...input.question,
    id: input.question.id,
    domain: input.question.domain,
    title: input.stage === 'form-plan'
      ? '这项表单信息需要确认'
      : '这项应用规划信息需要确认',
    description: '请使用业务名称补充需要确认的字段、来源、关系或范围。',
    questionKind: 'note_only',
    required: input.question.required,
    allowFreeText: true,
    options: undefined,
    confirmed: input.question.confirmed,
    selectedOptionValue: input.question.selectedOptionValue,
    answerSummary: input.question.answerSummary,
    answerDetail: input.question.answerDetail,
  }
}

export const normalizePlanningVisibleConfirmation = (input: {
  stage: NocodeEditorPlanningQuestionStage
  confirmation: NocodeEditorAiConfirmPayload | null
}): NocodeEditorAiConfirmPayload | null => {
  if (!input.confirmation) {
    return null
  }

  const questions = input.confirmation.questions.map(question => (
    normalizePlanningVisibleQuestion({ stage: input.stage, question })
  ))
  return questions.every((question, index) => question === input.confirmation?.questions[index])
    ? input.confirmation
    : { ...input.confirmation, questions }
}
