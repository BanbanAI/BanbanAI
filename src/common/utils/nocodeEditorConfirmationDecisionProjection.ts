import type {
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmStage,
  NocodeEditorConfirmationDecisionKeySource,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from './nocodeEditorConfirmationNormalization'
import {
  isSamePlanningConfirmationContext,
} from './nocodeEditorPlanningConfirmationIdentity'

export const NOCODE_EDITOR_APPROVAL_OWNER_FORM_MEMBER_FIELD_OPTION_VALUE = 'use-existing-owner-field'

export type NocodeEditorConfirmationDecision = {
  questionId: string
  questionTitle: string
  decisionKey: string
  decisionKeySource?: NocodeEditorConfirmationDecisionKeySource
  selectedOptionValue?: string
  answerSummary?: string
  answerDetail?: string
  planningContextKey?: string
  approvalOwnerSource?: 'form_member_field'
}

export type NocodeEditorConfirmationDecisionProjection = {
  planningContextKey?: string
  questions: NocodeEditorAiConfirmQuestion[]
  decisions: NocodeEditorConfirmationDecision[]
}

type ProjectNocodeEditorConfirmationDecisionsInput = {
  stage: NocodeEditorAiConfirmStage
  confirmation?: unknown
  planningContextKey?: unknown
  expectedPlanningContextKey?: unknown
  fallbackPlanningContextKey?: unknown
  preserveTrustedDecisionKeySource?: boolean
}

const normalizeText = (value: unknown) => String(value ?? '').trim()
const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)
const normalizePlanningContextKey = (value: unknown) => (
  typeof value === 'string' ? normalizeText(value) : ''
)

const isCompletedQuestion = (question: NocodeEditorAiConfirmQuestion) => {
  if (question.confirmed === false) {
    return false
  }

  return question.confirmed === true
    || Boolean(
      normalizeText(question.selectedOptionValue)
      || normalizeText(question.answerSummary)
      || normalizeText(question.answerDetail)
      || question.options?.some(option => option.selected),
    )
}

const resolveSelectedOption = (question: NocodeEditorAiConfirmQuestion) => {
  const selectedOptionValue = normalizeText(question.selectedOptionValue)
  return question.options?.find(option => (
    option.selected === true
    || (selectedOptionValue && normalizeText(option.value) === selectedOptionValue)
  )) || null
}

const isApprovalOwnerQuestion = (question: NocodeEditorAiConfirmQuestion) => (
  /审批(?:人|人员|对象|负责人|来源|由谁)/u.test(normalizeText(question.title))
)

const isExplicitFormMemberFieldDecisionTitle = (
  question: NocodeEditorAiConfirmQuestion,
) => {
  const title = normalizeText(question.title)
  if (!title || /[?？]|还是|或者|或|支持|候选|备选|可选|选择项/u.test(title)) {
    return false
  }

  return /^(?:审批人|审批人员)(?:来源)?(?:来自表单(?:(?:成员|人员)?字段|成员|人员)(?:中)?(?:选择)?|(?:由|从)表单(?:(?:成员|人员)?字段|成员|人员)(?:中)?选择)[。.!！]?$/u
    .test(title)
}

const isExistingOwnerFieldOptionValue = (value: unknown) => (
  new RegExp(`^${NOCODE_EDITOR_APPROVAL_OWNER_FORM_MEMBER_FIELD_OPTION_VALUE}(?::|$)`, 'i')
    .test(normalizeText(value))
)

const hasFormMemberFieldDecisionText = (value: unknown) => (
  /表单(?:成员|人员|字段)|(?:成员|人员)字段|表单字段选择|由表单字段选择|member[\s_-]*field/u
    .test(normalizeText(value))
)

const hasNonFieldOwnerSourceText = (value: unknown) => (
  /固定(?:为)?[^，。；、\s]{0,16}|指定(?:为)?(?:角色|人员|成员)|部门负责人|部门主管|直属(?:领导|上级)|提交人上级|上级审批|角色(?:审批|处理|$)/u
    .test(normalizeText(value))
)

const resolveApprovalOwnerSource = (input: {
  question: NocodeEditorAiConfirmQuestion
  selectedOptionValue: string
  selectedOptionLabel: string
  answerSummary: string
}) => {
  if (!isApprovalOwnerQuestion(input.question)) {
    return undefined
  }
  if (isExistingOwnerFieldOptionValue(input.selectedOptionValue)) {
    return 'form_member_field' as const
  }

  const decisionText = [
    input.selectedOptionValue,
    input.selectedOptionLabel,
    input.answerSummary,
  ].filter(Boolean).join(' ')
  if (!decisionText) {
    return isExplicitFormMemberFieldDecisionTitle(input.question)
      ? 'form_member_field' as const
      : undefined
  }
  if (hasNonFieldOwnerSourceText(decisionText)) {
    return undefined
  }
  return hasFormMemberFieldDecisionText(decisionText)
    ? 'form_member_field' as const
    : undefined
}

const resolveSelectedOptionValue = (input: {
  question: NocodeEditorAiConfirmQuestion
  selectedOptionValue: string
  selectedOptionLabel: string
  answerSummary: string
}) => {
  if (isExistingOwnerFieldOptionValue(input.selectedOptionValue)) {
    return input.selectedOptionValue
  }
  const approvalOwnerSource = resolveApprovalOwnerSource(input)
  return approvalOwnerSource === 'form_member_field'
    ? NOCODE_EDITOR_APPROVAL_OWNER_FORM_MEMBER_FIELD_OPTION_VALUE
    : input.selectedOptionValue
}

export const projectNocodeEditorConfirmationDecisions = (
  input: ProjectNocodeEditorConfirmationDecisionsInput,
): NocodeEditorConfirmationDecisionProjection => {
  const rawConfirmation = isRecord(input.confirmation)
    ? input.confirmation
    : null
  const normalizedConfirmation = normalizeNocodeEditorConfirmationPayload({
    stage: input.stage,
    confirmation: input.confirmation,
    preserveTrustedDecisionKeySource: input.preserveTrustedDecisionKeySource,
  })
  const candidatePlanningContextKey = normalizePlanningContextKey(input.planningContextKey)
    || normalizePlanningContextKey(
      rawConfirmation?.planningContextKey ?? rawConfirmation?.planning_context_key,
    )
    || undefined
  const expectedPlanningContextKey = normalizePlanningContextKey(input.expectedPlanningContextKey)
  const fallbackPlanningContextKey = normalizePlanningContextKey(input.fallbackPlanningContextKey)
  const questions = normalizedConfirmation?.questions || []

  if (
    expectedPlanningContextKey
    && candidatePlanningContextKey
    && !isSamePlanningConfirmationContext(
      candidatePlanningContextKey,
      expectedPlanningContextKey,
    )
  ) {
    return {
      planningContextKey: candidatePlanningContextKey,
      questions,
      decisions: [],
    }
  }

  const planningContextKey = candidatePlanningContextKey
    || (
      expectedPlanningContextKey
      && fallbackPlanningContextKey
      && isSamePlanningConfirmationContext(
        fallbackPlanningContextKey,
        expectedPlanningContextKey,
      )
        ? fallbackPlanningContextKey
        : undefined
    )
  if (!planningContextKey) {
    return {
      planningContextKey: undefined,
      questions,
      decisions: [],
    }
  }

  const decisions = questions
    .filter(isCompletedQuestion)
    .map((question): NocodeEditorConfirmationDecision => {
      const decisionKey = normalizeText(question.decisionKey) || normalizeText(question.id)
      const decisionKeySource = question.decisionKeySource
        || (normalizeText(question.decisionKey) ? 'explicit' : 'legacy_question_id')
      const selectedOption = resolveSelectedOption(question)
      const selectedOptionValue = normalizeText(question.selectedOptionValue || selectedOption?.value)
      const selectedOptionLabel = normalizeText(selectedOption?.label || selectedOption?.value)
      const answerSummary = normalizeText(question.answerSummary || selectedOptionLabel)
      const answerDetail = normalizeText(question.answerDetail)
      const resolvedSelectedOptionValue = resolveSelectedOptionValue({
        question,
        selectedOptionValue,
        selectedOptionLabel,
        answerSummary,
      })
      const approvalOwnerSource = resolveApprovalOwnerSource({
        question,
        selectedOptionValue: resolvedSelectedOptionValue,
        selectedOptionLabel,
        answerSummary,
      })

      return {
        questionId: normalizeText(question.id),
        questionTitle: normalizeText(question.title),
        decisionKey,
        decisionKeySource,
        selectedOptionValue: resolvedSelectedOptionValue || undefined,
        answerSummary: answerSummary || undefined,
        answerDetail: answerDetail || undefined,
        planningContextKey,
        approvalOwnerSource,
      }
    })
    .filter(decision => Boolean(decision.decisionKey))
    .slice(0, 6)

  return {
    planningContextKey,
    questions,
    decisions,
  }
}
