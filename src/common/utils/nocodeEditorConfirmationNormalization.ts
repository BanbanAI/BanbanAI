import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionScopeKind,
  NocodeEditorAiConfirmQuestionKind,
  NocodeEditorAiConfirmQuestionOption,
  NocodeEditorAiConfirmStage,
  NocodeEditorAiConfirmStatus,
  NocodeEditorAiConfirmSurface,
  NocodeEditorConfirmationDecisionKeySource,
} from '@common/types/nocodeEditorConfirmation'
import {
  getNocodeEditorCompletedDefaultsContinueLabel,
} from './nocodeEditorConfirmationCopy'
import {
  inferNocodeEditorConfirmationQuestionOptions,
  isBinaryNocodeEditorConfirmationQuestionTitle,
} from './nocodeEditorConfirmationOptions'
import {
  buildStablePlanningQuestionId,
  reconcilePlanningConfirmation,
} from './nocodeEditorPlanningQuestionContract'
import {
  containsExplicitPlanningTechnicalText,
  normalizePlanningVisibleConfirmation,
  normalizePlanningVisibleQuestion,
} from './nocodeEditorPlanningQuestionPresentation'
import {
  normalizeNocodeEditorPlanningQuestionDomain,
} from './nocodeEditorQuestionStagePolicy'

type UnknownRecord = Record<string, unknown>

export type NormalizeNocodeEditorConfirmationPayloadOptions = {
  stage: NocodeEditorAiConfirmStage
  confirmation?: unknown
  openQuestions?: unknown
  preferredSurface?: NocodeEditorAiConfirmSurface
  summary?: unknown
  planningQuestionContract?: boolean
  planningQuestionPresentation?: boolean
  preserveTrustedDecisionKeySource?: boolean
}

type NormalizeQuestionOptions = {
  planningQuestionContract?: boolean
  planningQuestionPresentation?: boolean
  preserveTrustedDecisionKeySource?: boolean
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const resolveQuestionId = (input: {
  value: unknown
  stage: NocodeEditorAiConfirmStage
  title: string
  index: number
  planningQuestionContract?: boolean
}) => {
  if (
    input.planningQuestionContract
    && (input.stage === 'app-plan' || input.stage === 'form-plan')
  ) {
    return buildStablePlanningQuestionId({
      stage: input.stage,
      explicitId: isRecord(input.value) ? input.value.id : undefined,
      title: input.title,
    })
  }

  return isRecord(input.value) && normalizeText(input.value.id)
    || `${input.stage}-question-${input.index + 1}`
}

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const normalizeConfirmationScalarValue = (value: unknown) => {
  if (typeof value === 'string') {
    return normalizeText(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).trim()
  }
  return ''
}

const normalizeConfirmationPlanningContextKey = (value: unknown) => (
  typeof value === 'string' ? normalizeText(value) : ''
)

const resolveOptionLabelFromValue = (
  options: NocodeEditorAiConfirmQuestionOption[],
  optionValue: string,
) => {
  const normalizedOptionValue = normalizeText(optionValue)
  if (!normalizedOptionValue) {
    return ''
  }

  const matchedOption = options.find(option => (
    normalizeText(option.value) === normalizedOptionValue
  ))
  return normalizeText(matchedOption?.label || matchedOption?.value)
}

const resolveNormalizedQuestionConfirmed = (
  explicitConfirmed: boolean | undefined,
  hasAnswer: boolean,
) => {
  if (explicitConfirmed === true) {
    return true
  }
  if (explicitConfirmed === false) {
    return false
  }
  return hasAnswer ? true : undefined
}

const isExplicitlyUnconfirmedQuestion = (
  question?: Partial<NocodeEditorAiConfirmQuestion> | null,
) => question?.confirmed === false

export const normalizeNocodeEditorConfirmationSurface = (
  value: unknown,
): NocodeEditorAiConfirmSurface | undefined => {
  const surface = normalizeText(value)
  if (surface === 'inline' || surface === 'drawer' || surface === 'gate') {
    return surface
  }
  return undefined
}

const normalizeNocodeEditorConfirmationStage = (
  value: unknown,
): NocodeEditorAiConfirmStage | undefined => {
  const stage = normalizeText(value)
  if (
    stage === 'app-plan'
    || stage === 'form-plan'
    || stage === 'content-plan'
    || stage === 'flow-scheme'
    || stage === 'flow-plan'
    || stage === 'blueprint'
  ) {
    return stage
  }
  if (stage === 'solution') {
    return 'app-plan'
  }
  return undefined
}

const normalizeNocodeEditorConfirmationStatus = (
  value: unknown,
): NocodeEditorAiConfirmStatus | undefined => {
  const status = normalizeText(value)
  if (status === 'pending' || status === 'completed') {
    return status
  }
  return undefined
}

const normalizeNocodeEditorConfirmationRequiredNextAction = (
  value: unknown,
): NocodeEditorAiConfirmPayload['requiredNextAction'] => (
  value === 'editor_plan_flow_scheme' ? value : undefined
)

const normalizeNocodeEditorConfirmationBlockedNextAction = (
  value: unknown,
): NocodeEditorAiConfirmPayload['blockedNextAction'] => (
  value === 'editor_stage_flow_blueprint' ? value : undefined
)

export const normalizeNocodeEditorConfirmationQuestionOption = (
  value: unknown,
): NocodeEditorAiConfirmQuestionOption | null => {
  if (typeof value === 'string') {
    const text = normalizeText(value)
    if (!text) {
      return null
    }
    return {
      value: text,
      label: text,
    }
  }

  if (!isRecord(value)) {
    return null
  }

  const label = normalizeText(value.label)
  const optionValue = normalizeConfirmationScalarValue(value.value) || label
  if (!label || !optionValue) {
    return null
  }

  const description = normalizeText(value.description)
  return {
    value: optionValue,
    label,
    description: description || undefined,
    selected: typeof value.selected === 'boolean' ? value.selected : undefined,
  }
}

const isValidQuestionKind = (value: string): value is NocodeEditorAiConfirmQuestionKind => (
  value === 'note_only'
  || value === 'binary'
  || value === 'single_select'
)

export const normalizeNocodeEditorConfirmationQuestionKind = (
  value: unknown,
): NocodeEditorAiConfirmQuestionKind | undefined => {
  const questionKind = normalizeText(value)
  return isValidQuestionKind(questionKind) ? questionKind : undefined
}

const normalizeNocodeEditorConfirmationQuestionScopeKind = (
  value: unknown,
): NocodeEditorAiConfirmQuestionScopeKind | undefined => {
  const scopeKind = normalizeText(value)
  if (scopeKind === 'overview' || scopeKind === 'trigger-branch') {
    return scopeKind
  }
  return undefined
}

const resolveDecisionKeySource = (input: {
  stage: NocodeEditorAiConfirmStage
  questionId: string
  decisionKey: string
  rawSource: unknown
  preserveTrustedDecisionKeySource: boolean
}): NocodeEditorConfirmationDecisionKeySource | undefined => {
  if (input.stage !== 'flow-scheme') {
    return undefined
  }
  if (!input.decisionKey) {
    return input.questionId ? 'legacy_question_id' : undefined
  }
  return input.preserveTrustedDecisionKeySource
    && input.rawSource === 'legacy_question_id'
    && input.decisionKey === input.questionId
    ? 'legacy_question_id'
    : undefined
}

const inferNocodeEditorConfirmationQuestionKind = (options: {
  title: string
  explicitQuestionKind?: NocodeEditorAiConfirmQuestionKind
  options?: NocodeEditorAiConfirmQuestionOption[]
}) => {
  if (options.explicitQuestionKind) {
    return options.explicitQuestionKind
  }

  if (Array.isArray(options.options) && options.options.length > 0) {
    return isBinaryNocodeEditorConfirmationQuestionTitle(options.title)
      ? 'binary'
      : 'single_select'
  }

  return isBinaryNocodeEditorConfirmationQuestionTitle(options.title)
    ? 'binary'
    : 'note_only'
}

const isCollectionStyleQuestion = (question: {
  title?: string
  description?: string
  options?: NocodeEditorAiConfirmQuestionOption[]
  questionKind?: NocodeEditorAiConfirmQuestionKind
}) => {
  if (question.questionKind !== 'single_select') {
    return false
  }

  const title = normalizeText(question.title)
  const description = normalizeText(question.description)
  const options = Array.isArray(question.options) ? question.options : []
  if (!title || options.length < 2) {
    return false
  }

  const titleSuggestsCollection = /哪些|哪几|哪类|哪种|还需要|需要补|补哪些|补充哪些|需要哪些|哪些资料|哪些材料|哪些附件|哪些文件/.test(title)
  const needOptionCount = options.filter(option => /^需要/.test(normalizeText(option.label || option.value))).length
  const optionDefinitionSignals = (
    /有哪些(?:可选)?(?:选项|状态|结果|类型)|(?:选项|状态|结果|类型)有哪些|可选项有哪些/.test(title)
    || /例如[:：][^\n]*(?:\/|、|，|,)[^\n]*/.test(description)
    || (/选项$/.test(title) && /例如[:：]/.test(description))
  )
  return titleSuggestsCollection || needOptionCount >= 2 || optionDefinitionSignals
}

const mergeOptionsIntoDescription = (
  description: string,
  options: NocodeEditorAiConfirmQuestionOption[],
) => {
  const optionText = options
    .map(option => normalizeText(option.label || option.value))
    .filter(Boolean)
    .join('；')
  if (!optionText) {
    return description
  }

  const mergedText = `候选项参考：${optionText}`
  if (!description) {
    return mergedText
  }
  if (description.includes(mergedText) || description.includes(optionText)) {
    return description
  }

  return `${description}\n${mergedText}`
}

const downgradeToNoteOnly = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  const options = Array.isArray(question.options) ? question.options : []
  const selectedOption = options.find(option => (
    option.selected
    || normalizeText(option.value) === normalizeText(question.selectedOptionValue)
  )) || null
  const answerSummary = normalizeText(question.answerSummary)
    || normalizeText(selectedOption?.label || selectedOption?.value)
  const answerDetail = normalizeText(question.answerDetail)
  const confirmed = resolveNormalizedQuestionConfirmed(
    question.confirmed,
    Boolean(answerSummary || answerDetail),
  )

  return {
    ...question,
    questionKind: 'note_only',
    options: undefined,
    selectedOptionValue: undefined,
    description: mergeOptionsIntoDescription(normalizeText(question.description), options) || undefined,
    confirmed,
    answerSummary: answerSummary || undefined,
    answerDetail: answerDetail || undefined,
  }
}

const FLOW_APPROVAL_OWNER_QUESTION_DESCRIPTION = '请说明该节点的审批人如何确定。例如：使用表单中的成员字段，或在流程中指定固定人员、角色、部门主管、提交人上级。'
export const NOCODE_EDITOR_FLOW_APPROVAL_OWNER_EMPTY_HANDLER_DESCRIPTION = '请选择审批人字段为空时的处理策略：不设置兜底处理、自动通过、由管理员处理或由指定人员处理。'
const LEGACY_FLOW_APPROVAL_OWNER_EMPTY_HANDLER_DESCRIPTION = '请选择审批人字段为空时的处理策略：none（不设置兜底处理）、auto_approve（自动通过）、admin（由管理员处理）、fixed_users（由指定人员处理）。'

export const normalizeNocodeEditorConfirmationVisibleDescription = (value: unknown) => {
  const description = normalizeText(value)
  return description === LEGACY_FLOW_APPROVAL_OWNER_EMPTY_HANDLER_DESCRIPTION
    ? NOCODE_EDITOR_FLOW_APPROVAL_OWNER_EMPTY_HANDLER_DESCRIPTION
    : description
}

const normalizeLegacyFlowApprovalOwnerQuestionCopy = (input: {
  stage: NocodeEditorAiConfirmStage
  title: string
  description: string
}) => {
  const visibleDescription = normalizeNocodeEditorConfirmationVisibleDescription(input.description)
  if (
    input.stage === 'flow-scheme'
    && visibleDescription !== input.description
  ) {
    return {
      title: input.title,
      description: visibleDescription,
    }
  }

  const titleMatch = input.title.match(
    /^(.+?(?:审批|审核|复核)(?:节点)?)的人员来源(?:尚未确定|未确定|待确定|不明确|待明确)[？?]?$/u,
  )
  if (
    input.stage !== 'flow-scheme'
    || !titleMatch
  ) {
    return {
      title: input.title,
      description: input.description,
    }
  }

  const approvalNodeTitle = normalizeText(titleMatch[1])
  const hasDefaultDescription = !input.description
    || input.description === `请补充或确认：${input.title}`
  return {
    title: `如何确定“${approvalNodeTitle}”的审批人？`,
    description: hasDefaultDescription
      ? FLOW_APPROVAL_OWNER_QUESTION_DESCRIPTION
      : input.description,
  }
}

export const normalizeNocodeEditorConfirmationQuestion = (
  value: unknown,
  index: number,
  stage: NocodeEditorAiConfirmStage,
  normalizationOptions: NormalizeQuestionOptions = {},
): NocodeEditorAiConfirmQuestion | null => {
  if (typeof value === 'string') {
    const title = normalizeText(value)
    if (!title) {
      return null
    }

    const questionKind = inferNocodeEditorConfirmationQuestionKind({ title })
    const options = inferNocodeEditorConfirmationQuestionOptions({
      title,
      questionKind,
    }) || []

    return {
      id: resolveQuestionId({
        value,
        stage,
        title,
        index,
        planningQuestionContract: normalizationOptions.planningQuestionContract,
      }),
      title,
      questionKind,
      options: options.length ? options : undefined,
    }
  }

  if (!isRecord(value)) {
    return null
  }

  const normalizedLegacyCopy = normalizeLegacyFlowApprovalOwnerQuestionCopy({
    stage,
    title: normalizeText(value.title ?? value.question ?? value.name),
    description: normalizeText(value.description),
  })
  const title = normalizedLegacyCopy.title
  if (!title) {
    return null
  }
  const questionId = resolveQuestionId({
    value,
    stage,
    title,
    index,
    planningQuestionContract: normalizationOptions.planningQuestionContract,
  })

  const normalizedOptions = Array.isArray(value.options)
    ? value.options
      .map(item => normalizeNocodeEditorConfirmationQuestionOption(item))
      .filter((item): item is NocodeEditorAiConfirmQuestionOption => Boolean(item))
    : []
  const explicitQuestionKind = normalizeNocodeEditorConfirmationQuestionKind(value.questionKind)
  const questionKind = inferNocodeEditorConfirmationQuestionKind({
    title,
    explicitQuestionKind,
    options: normalizedOptions,
  })
  const resolvedOptions = inferNocodeEditorConfirmationQuestionOptions({
    title,
    questionKind,
    options: normalizedOptions,
  }) || []
  const dependsOn = normalizeStringList(value.dependsOn ?? value.depends_on)
  const description = normalizedLegacyCopy.description
  const scopeKind = normalizeNocodeEditorConfirmationQuestionScopeKind(
    value.scopeKind ?? value.scope_kind,
  )
  const branchKey = normalizeText(value.branchKey ?? value.branch_key)
  const selectedOptionValue = normalizeConfirmationScalarValue(
    value.selectedOptionValue ?? value.selected_option_value,
  )
    || resolvedOptions.find(item => item.selected)?.value
  const answerSummary = normalizeConfirmationScalarValue(value.answerSummary ?? value.answer_summary)
  const answerDetail = normalizeConfirmationScalarValue(value.answerDetail ?? value.answer_detail)
  const explicitConfirmed = typeof value.confirmed === 'boolean'
    ? value.confirmed
    : undefined
  const confirmed = resolveNormalizedQuestionConfirmed(
    explicitConfirmed,
    Boolean(selectedOptionValue || answerSummary || answerDetail),
  )
  const preservePlanningAnswerFields = (
    (
      normalizationOptions.planningQuestionContract === true
      || normalizationOptions.planningQuestionPresentation === true
    )
    && (stage === 'app-plan' || stage === 'form-plan')
  )

  const decisionKey = normalizeText(value.decisionKey ?? value.decision_key)
  const decisionKeySource = resolveDecisionKeySource({
    stage,
    questionId,
    decisionKey,
    rawSource: value.decisionKeySource,
    preserveTrustedDecisionKeySource: normalizationOptions.preserveTrustedDecisionKeySource === true,
  })
  const question: NocodeEditorAiConfirmQuestion = {
    id: questionId,
    decisionKey: decisionKey || undefined,
    ...(decisionKeySource ? { decisionKeySource } : {}),
    title,
    domain: normalizeNocodeEditorPlanningQuestionDomain(value.domain),
    questionKind,
    scopeKind: scopeKind || undefined,
    branchKey: scopeKind === 'trigger-branch'
      ? branchKey || undefined
      : undefined,
    description: description || undefined,
    required: typeof value.required === 'boolean' ? value.required : undefined,
    allowFreeText: typeof value.allowFreeText === 'boolean'
      ? value.allowFreeText
      : typeof value.allow_free_text === 'boolean'
        ? value.allow_free_text
        : undefined,
    options: resolvedOptions.length ? resolvedOptions : undefined,
    dependsOn: dependsOn.length ? dependsOn : undefined,
    confirmed,
    selectedOptionValue: questionKind === 'note_only' && !preservePlanningAnswerFields
      ? undefined
      : selectedOptionValue || undefined,
    answerSummary: answerSummary || undefined,
    answerDetail: answerDetail || undefined,
  }

  if (question.questionKind === 'note_only') {
    const selectedOptionLabel = resolveOptionLabelFromValue(
      normalizedOptions,
      selectedOptionValue,
    )
    const safeSelectedOptionLabel = (
      preservePlanningAnswerFields
      && containsExplicitPlanningTechnicalText(selectedOptionLabel)
    )
      ? ''
      : selectedOptionLabel
    const noteOnlyAnswerSummary = question.answerSummary
      || safeSelectedOptionLabel
      || (preservePlanningAnswerFields ? '' : selectedOptionValue)
    return {
      ...question,
      options: undefined,
      answerSummary: noteOnlyAnswerSummary || undefined,
    }
  }

  if (isCollectionStyleQuestion(question)) {
    return downgradeToNoteOnly(question)
  }

  return question
}

const resolveFallbackSurface = (
  count: number,
): NocodeEditorAiConfirmSurface | undefined => {
  if (count >= 3) {
    return 'drawer'
  }
  if (count >= 1) {
    return 'inline'
  }
  return undefined
}

const hasConfirmedOptionSelection = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  !isExplicitlyUnconfirmedQuestion(question)
  && normalizeText(question.selectedOptionValue)
)

const canQuestionUseSupplementNoteAsAnswer = (
  question: NocodeEditorAiConfirmQuestion,
) => question.allowFreeText !== false

const hasConfirmedTextAnswer = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  !isExplicitlyUnconfirmedQuestion(question)
  && (
    normalizeText(question.answerSummary)
    || normalizeText(question.answerDetail)
  )
)

const hasConfirmedSupplementAnswerSummary = (
  question: NocodeEditorAiConfirmQuestion,
) => Boolean(
  !isExplicitlyUnconfirmedQuestion(question)
  && normalizeText(question.answerSummary)
)

const hasRealCompletedQuestionAnswer = (question: NocodeEditorAiConfirmQuestion) => {
  if (question.questionKind === 'note_only') {
    return hasConfirmedTextAnswer(question)
  }

  const hasOptions = Array.isArray(question.options) && question.options.length > 0
  if (hasOptions) {
    return (
      hasConfirmedOptionSelection(question)
      || (
        canQuestionUseSupplementNoteAsAnswer(question)
        && hasConfirmedSupplementAnswerSummary(question)
      )
    )
  }

  return hasConfirmedTextAnswer(question)
}

const hasStrictCompletedQuestions = (
  questions: NocodeEditorAiConfirmQuestion[],
) => (
  questions.length > 0
  && questions.every(question => hasRealCompletedQuestionAnswer(question))
)

const isDerivedDefaultsCompletedQuestion = (
  question: NocodeEditorAiConfirmQuestion,
) => (
  Boolean(question.confirmed)
  && !normalizeText(question.selectedOptionValue)
  && !normalizeText(question.answerSummary)
  && !normalizeText(question.answerDetail)
)

const hasDerivedDefaultsCompletedQuestions = (
  confirmation: UnknownRecord | undefined,
  questions: NocodeEditorAiConfirmQuestion[],
) => {
  const continueLabel = normalizeText(
    confirmation?.continueLabel ?? confirmation?.continue_label,
  )
  if (continueLabel !== getNocodeEditorCompletedDefaultsContinueLabel()) {
    return false
  }

  return questions.length > 0
    && questions.every(question => isDerivedDefaultsCompletedQuestion(question))
}

const hasExplicitCompletedSummaryEvidence = (
  confirmation: UnknownRecord | undefined,
) => {
  if (!confirmation) {
    return false
  }

  const completionSummary = normalizeText(
    confirmation.completionSummary ?? confirmation.completion_summary,
  )
  const resultSummary = normalizeStringList(
    confirmation.resultSummary ?? confirmation.result_summary,
  )
  return Boolean(completionSummary || resultSummary.length)
}

const resolveStructuredStatus = (
  value: unknown,
  questions: NocodeEditorAiConfirmQuestion[],
  confirmation?: UnknownRecord,
  mode: {
    trustExplicitCompleted: boolean
  } = {
    trustExplicitCompleted: false,
  },
) => {
  const explicitStatus = normalizeNocodeEditorConfirmationStatus(value)
  if (explicitStatus === 'completed') {
    if (mode.trustExplicitCompleted) {
      return 'completed' as const
    }
    return (
      hasStrictCompletedQuestions(questions)
      || hasDerivedDefaultsCompletedQuestions(confirmation, questions)
      || hasExplicitCompletedSummaryEvidence(confirmation)
    ) ? 'completed' as const : 'pending' as const
  }

  if (explicitStatus) {
    return explicitStatus
  }

  if (hasStrictCompletedQuestions(questions)) {
    return 'completed' as const
  }

  return 'pending' as const
}

const normalizeStructuredConfirmation = (
  options: NormalizeNocodeEditorConfirmationPayloadOptions,
): NocodeEditorAiConfirmPayload | null => {
  if (!isRecord(options.confirmation) || !Array.isArray(options.confirmation.questions)) {
    return null
  }

  const rawQuestions = options.confirmation.questions
  const questions = rawQuestions
    .map((item, index) => normalizeNocodeEditorConfirmationQuestion(
      item,
      index,
      options.stage,
      {
        planningQuestionContract: options.planningQuestionContract,
        planningQuestionPresentation: options.planningQuestionPresentation,
        preserveTrustedDecisionKeySource: options.preserveTrustedDecisionKeySource,
      },
    ))
    .filter((item): item is NocodeEditorAiConfirmQuestion => Boolean(item))

  if (rawQuestions.length > 0 && !questions.length) {
    return null
  }

  const summary = normalizeText(options.confirmation.summary) || normalizeText(options.summary)
  const completionSummary = normalizeText(
    options.confirmation.completionSummary ?? options.confirmation.completion_summary,
  )
  const resultSummary = normalizeStringList(
    options.confirmation.resultSummary ?? options.confirmation.result_summary,
  )
  const trustExplicitPlanningCompleted = (
    (options.stage === 'app-plan' || options.stage === 'form-plan')
    && (
      options.planningQuestionContract === true
      || options.planningQuestionPresentation === true
    )
  )

  return {
    stage: normalizeNocodeEditorConfirmationStage(options.confirmation.stage) || options.stage,
    planningContextKey: normalizeConfirmationPlanningContextKey(
      options.confirmation.planningContextKey ?? options.confirmation.planning_context_key,
    )
      || undefined,
    requiredNextAction: normalizeNocodeEditorConfirmationRequiredNextAction(
      options.confirmation.requiredNextAction ?? options.confirmation.required_next_action,
    ),
    blockedNextAction: normalizeNocodeEditorConfirmationBlockedNextAction(
      options.confirmation.blockedNextAction ?? options.confirmation.blocked_next_action,
    ),
    preferredSurface: options.preferredSurface
      || normalizeNocodeEditorConfirmationSurface(options.confirmation.preferredSurface)
      || resolveFallbackSurface(questions.length),
    status: resolveStructuredStatus(
      options.confirmation.status,
      questions,
      options.confirmation,
      { trustExplicitCompleted: trustExplicitPlanningCompleted },
    ),
    summary: summary || undefined,
    completionSummary: completionSummary || undefined,
    resultSummary: resultSummary.length ? resultSummary : undefined,
    questions,
    allowContinueWithDefaults: typeof options.confirmation.allowContinueWithDefaults === 'boolean'
      ? options.confirmation.allowContinueWithDefaults
      : typeof options.confirmation.allow_continue_with_defaults === 'boolean'
        ? options.confirmation.allow_continue_with_defaults
        : undefined,
    continueLabel: normalizeText(options.confirmation.continueLabel ?? options.confirmation.continue_label) || undefined,
    secondaryActionLabel: normalizeText(
      options.confirmation.secondaryActionLabel ?? options.confirmation.secondary_action_label,
    ) || undefined,
    reviewLabel: normalizeText(options.confirmation.reviewLabel ?? options.confirmation.review_label) || undefined,
  }
}

export const normalizeNocodeEditorConfirmationPayload = (
  options: NormalizeNocodeEditorConfirmationPayloadOptions,
): NocodeEditorAiConfirmPayload | null => {
  const structuredConfirmation = normalizeStructuredConfirmation(options)
  if (
    options.planningQuestionContract === true
    && (options.stage === 'app-plan' || options.stage === 'form-plan')
  ) {
    const planningStage = options.stage === 'app-plan' ? 'app-plan' : 'form-plan'
    const legacyOpenQuestions = Array.from(new Set(normalizeStringList(options.openQuestions)))
    const confirmation = reconcilePlanningConfirmation({
      stage: planningStage,
      structuredConfirmation,
      legacyOpenQuestions,
      preferredSurface: options.preferredSurface || resolveFallbackSurface(legacyOpenQuestions.length),
      summary: options.summary,
    }).confirmation
    return confirmation
      ? {
        ...confirmation,
        questions: confirmation.questions.map(question => normalizePlanningVisibleQuestion({
          stage: planningStage,
          question,
        })),
      }
      : null
  }

  const planningPresentationStage = (
    options.planningQuestionPresentation === true
    && (options.stage === 'app-plan' || options.stage === 'form-plan')
  )
    ? options.stage === 'app-plan' ? 'app-plan' : 'form-plan'
    : null

  if (structuredConfirmation) {
    return planningPresentationStage
      ? normalizePlanningVisibleConfirmation({
        stage: planningPresentationStage,
        confirmation: structuredConfirmation,
      })
      : structuredConfirmation
  }

  const openQuestions = Array.from(new Set(normalizeStringList(options.openQuestions)))
  if (!openQuestions.length) {
    return null
  }

  const questions = openQuestions
    .map((title, index) => normalizeNocodeEditorConfirmationQuestion(
      title,
      index,
      options.stage,
      {
        planningQuestionContract: options.planningQuestionContract,
        planningQuestionPresentation: options.planningQuestionPresentation,
        preserveTrustedDecisionKeySource: options.preserveTrustedDecisionKeySource,
      },
    ))
    .filter((item): item is NocodeEditorAiConfirmQuestion => Boolean(item))

  if (!questions.length) {
    return null
  }

  const confirmation: NocodeEditorAiConfirmPayload = {
    stage: options.stage,
    preferredSurface: options.preferredSurface || resolveFallbackSurface(questions.length),
    status: 'pending',
    summary: normalizeText(options.summary) || undefined,
    questions,
  }
  return planningPresentationStage
    ? normalizePlanningVisibleConfirmation({
      stage: planningPresentationStage,
      confirmation,
    })
    : confirmation
}
