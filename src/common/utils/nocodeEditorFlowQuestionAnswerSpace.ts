import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
} from '@common/types/nocodeEditorConfirmation'
import { FLOW_DECISION_CANONICAL_VALUES } from './nocodeEditorFlowDecisionValueAliases'

const text = (value: unknown) => String(value ?? '').trim()

const FLOW_DECISION_OPTION_LABELS: Record<string, Record<string, string>> = {
  'flow.trigger.type': {
    submit: '提交后自动发起',
    update: '数据更新后发起',
    manual: '手动发起',
    schedule: '定时触发',
  },
}

const FLOW_DECISION_OPTION_DESCRIPTIONS: Record<string, string> = {
  'flow.trigger.type': '选择这条流程的触发方式：提交记录后自动发起、数据更新后发起、手动发起或定时触发。',
}

const isAnsweredQuestion = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || text(question.selectedOptionValue)
  || text(question.answerSummary)
  || text(question.answerDetail)
  || question.options?.some(option => option.selected === true),
)

const buildCanonicalOptions = (
  decisionKey: string,
): {
  options: NocodeEditorAiConfirmQuestionOption[]
  description?: string
} | null => {
  const labels = FLOW_DECISION_OPTION_LABELS[decisionKey]
  if (!labels) {
    return null
  }
  const options = (FLOW_DECISION_CANONICAL_VALUES[decisionKey] || [])
    .filter(value => value !== 'unknown' && labels[value])
    .map(value => ({ value, label: labels[value], selected: false }))
  return options.length >= 2
    ? { options, description: FLOW_DECISION_OPTION_DESCRIPTIONS[decisionKey] }
    : null
}

const ensureQuestionAnswerSpace = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  if (question.required === false || isAnsweredQuestion(question)) {
    return question
  }
  if ((question.options?.length || 0) >= 2) {
    return question
  }

  const decisionKey = text(question.decisionKey) || text(question.id)
  const canonical = buildCanonicalOptions(decisionKey)
  if (canonical) {
    return {
      ...question,
      questionKind: 'single_select',
      options: canonical.options,
      description: text(question.description) || canonical.description,
      allowFreeText: true,
    }
  }

  if (question.questionKind === 'note_only' && !text(question.description)) {
    return {
      ...question,
      description: `请补充说明“${text(question.title) || '这项决策'}”的具体要求，或说明你希望怎么处理。`,
      allowFreeText: true,
    }
  }

  return question
}

/**
 * 待答的确认题必须是可作答的：结构决策被打回待确认时，原来可能是 note_only 空壳，
 * 或题型需要选项却没有选项。已知决策键按规范词表补选项；其余题至少补一句说明。
 * 只处理 required 且未作答的题，不触碰已确认记录和说明项。
 */
export const ensurePendingFlowQuestionsAnswerable = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
): NocodeEditorAiConfirmPayload | null => {
  if (!confirmation) {
    return confirmation
  }
  const questions = (confirmation.questions || []).map(ensureQuestionAnswerSpace)
  return { ...confirmation, questions }
}
