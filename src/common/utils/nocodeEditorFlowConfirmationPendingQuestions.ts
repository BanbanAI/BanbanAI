import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'
import {
  projectFlowDecisionContract,
  type FlowDecisionDiagnostic,
  type FlowDecisionState,
} from './nocodeEditorFlowDecisionGraph'

const text = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

export const flowConfirmationQuestionKey = (question: NocodeEditorAiConfirmQuestion) => (
  text(question.decisionKey) || text(question.id)
)

const isAnsweredQuestion = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || text(question.selectedOptionValue)
  || text(question.answerSummary)
  || text(question.answerDetail)
  || question.options?.some(option => option.selected === true),
)

export type FlowConfirmationQuestionContract = {
  invalid: boolean
  diagnostics: FlowDecisionDiagnostic[]
  states: Map<string, FlowDecisionState>
  readyKeys: Set<string>
}

/**
 * 卡片、抽屉、按钮与 readiness 门禁统一使用同一份决策契约投影，避免两侧对
 * “哪些题还算待答”给出不同答案（例如一方放行、另一方仍在等确认）。
 */
export const projectFlowConfirmationQuestionContract = (input: {
  questions: NocodeEditorAiConfirmQuestion[]
  factSnapshot?: Record<string, unknown> | null
  decisionSnapshot?: Record<string, string>
}): FlowConfirmationQuestionContract => {
  const questions = Array.isArray(input.questions) ? input.questions : []
  const factSnapshot = isRecord(input.factSnapshot) ? input.factSnapshot : {}
  const contract = projectFlowDecisionContract(questions, factSnapshot, input.decisionSnapshot)
  const diagnostics = contract.diagnostics || []
  return {
    invalid: diagnostics.length > 0,
    diagnostics,
    states: contract.states,
    readyKeys: new Set(contract.ready.map(question => flowConfirmationQuestionKey(question))),
  }
}

export const resolveFlowConfirmationPendingQuestionProjection = (input: {
  questions: NocodeEditorAiConfirmQuestion[]
  factSnapshot?: Record<string, unknown> | null
  decisionSnapshot?: Record<string, string>
  restrictToDecisionKeys?: Iterable<string> | null
  requireReady?: boolean
}): {
  pendingQuestions: NocodeEditorAiConfirmQuestion[]
  contract: FlowConfirmationQuestionContract
} => {
  const questions = Array.isArray(input.questions) ? input.questions : []
  const contract = projectFlowConfirmationQuestionContract({
    questions,
    factSnapshot: input.factSnapshot,
    decisionSnapshot: input.decisionSnapshot,
  })
  if (contract.invalid) {
    return { pendingQuestions: [], contract }
  }
  const restrict = input.restrictToDecisionKeys
    ? new Set(Array.from(input.restrictToDecisionKeys).map(text).filter(Boolean))
    : null
  const pendingQuestions = questions.filter((question) => {
    const key = flowConfirmationQuestionKey(question)
    if (!key || question.required === false || isAnsweredQuestion(question)) return false
    if (contract.states.get(key) === 'inapplicable') return false
    if (input.requireReady && !contract.readyKeys.has(key)) return false
    if (restrict && !restrict.has(key)) return false
    return true
  })
  return { pendingQuestions, contract }
}
