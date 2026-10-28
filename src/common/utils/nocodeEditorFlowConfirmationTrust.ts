import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import {
  buildLogicalPlanningConfirmationContextKey,
  isSamePlanningConfirmationContext,
} from './nocodeEditorPlanningConfirmationIdentity'
import { findFlowSafeDefaultRule } from './nocodeEditorFlowSafeDefaults'

const normalizeText = (value: unknown) => String(value ?? '').trim()
const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

export const isCurrentFlowSchemeRevision = (replyRevision: unknown, currentRevision: unknown) => (
  typeof replyRevision === 'number'
  && Number.isSafeInteger(replyRevision)
  && replyRevision > 0
  && typeof currentRevision === 'number'
  && Number.isSafeInteger(currentRevision)
  && currentRevision > 0
  && replyRevision === currentRevision
)

export const buildNocodeEditorFlowSchemePlanningContextKey = (input: {
  schemeIdentity?: unknown
  targetFormId?: unknown
  targetFormName?: unknown
}) => {
  const schemeIdentity = normalizeText(input.schemeIdentity)
  const targetFormIdentity = normalizeText(input.targetFormId || input.targetFormName)
  if (!schemeIdentity || !targetFormIdentity) {
    return ''
  }

  return buildLogicalPlanningConfirmationContextKey({
    stage: 'flow-scheme',
    outlineId: schemeIdentity,
    primaryFormKey: targetFormIdentity,
  })
}

export type NocodeEditorFlowSchemeConfirmationRejectionCode =
  | 'flow_confirmation_context_missing'
  | 'flow_confirmation_context_mismatch'
  | 'flow_confirmation_revision_stale'

export type NocodeEditorFlowSchemeConfirmationRejection = {
  code: NocodeEditorFlowSchemeConfirmationRejectionCode
  confirmationStage: string
  missingFields?: string[]
  expected?: string
  actual?: string
  replyRevision?: number
  currentRevision?: number
}

export type NocodeEditorFlowSchemeConfirmationTrustContext = {
  planningContextKey: string
  continuationPlanningContextKey: string
  targetFormId: string
  targetFormName?: string
  flowConfirmationDecisions: Array<Record<string, unknown>>
  schemeRevision: number
}

export type NocodeEditorFlowSchemeConfirmationTrustResult = {
  context: NocodeEditorFlowSchemeConfirmationTrustContext | null
  rejection: NocodeEditorFlowSchemeConfirmationRejection | null
}

export const buildFlowSchemeConfirmationContextForClientToolCall = (input: {
  latestTaskSummary?: Record<string, unknown> | null
  requestedFormId?: unknown
  activeFormId?: unknown
  activeFormName?: unknown
  continuationPlanningContextKey?: unknown
  continuationSchemeRevision?: unknown
  incomingFlowConfirmationDecisions?: unknown
  allowSummaryRestore?: boolean
  confirmationStage?: unknown
}): NocodeEditorFlowSchemeConfirmationTrustResult => {
  const summary = input.latestTaskSummary || null
  const summaryFlowConfirmationDecisions = Array.isArray(summary?.flowConfirmationDecisions)
    ? summary.flowConfirmationDecisions.filter((item) => isRecord(item))
    : []
  const continuationSchemeRevisionNumber = Number(input.continuationSchemeRevision || 0)
  const hasValidContinuationRevision = Number.isSafeInteger(continuationSchemeRevisionNumber)
    && continuationSchemeRevisionNumber > 0
  const continuationPlanningContextKeyFromRequest = normalizeText(input.continuationPlanningContextKey)
  const summaryRevisionForRestore = Number(summary?.flowConfirmationSchemeRevision || 0)
  const canRestoreSummaryContext = input.allowSummaryRestore === true
    && summaryFlowConfirmationDecisions.length > 0
    && (!continuationPlanningContextKeyFromRequest
      || isSamePlanningConfirmationContext(
        continuationPlanningContextKeyFromRequest,
        normalizeText(summary?.flowConfirmationContextKey),
      ))
    && (!hasValidContinuationRevision
      || isCurrentFlowSchemeRevision(continuationSchemeRevisionNumber, summaryRevisionForRestore))
  const continuationPlanningContextKey = normalizeText(input.continuationPlanningContextKey)
    || (canRestoreSummaryContext ? normalizeText(summary?.flowConfirmationContextKey) : '')
  const continuationSchemeRevision = !hasValidContinuationRevision
    && canRestoreSummaryContext
      ? summary?.flowConfirmationSchemeRevision
    : input.continuationSchemeRevision
  // 蓝图工作台没有激活表单；工具明确指定的目标表单才是这次方案的身份。
  const declaredTargetFormId = normalizeText(input.requestedFormId)
  const targetFormId = declaredTargetFormId || normalizeText(input.activeFormId)
  const summaryPlanningContextKey = normalizeText(summary?.flowConfirmationContextKey)
  const summaryTargetFormId = normalizeText(summary?.flowConfirmationTargetFormId)
  const summaryRevision = summary?.flowConfirmationSchemeRevision
  const rawIncomingFlowConfirmationDecisions = Array.isArray(input.incomingFlowConfirmationDecisions)
    ? input.incomingFlowConfirmationDecisions.filter((item) => isRecord(item))
    : []
  const incomingFlowConfirmationDecisions = rawIncomingFlowConfirmationDecisions.filter((item) => (
    isSamePlanningConfirmationContext(
      normalizeText(item.planningContextKey),
      continuationPlanningContextKey,
    )
  ))
  const hasIncomingDecisions = incomingFlowConfirmationDecisions.length > 0
  const planningContextKey = hasIncomingDecisions
    ? continuationPlanningContextKey
    : summaryPlanningContextKey
  const confirmationTargetFormId = summaryTargetFormId || (
    hasIncomingDecisions ? targetFormId : ''
  )
  const confirmationStage = normalizeText(input.confirmationStage)

  // 没有任何待保护答案时（首版暂存、纯重建方案）缺上下文不构成拒绝：
  // strip 此时是空操作，拒绝只会把"上下文未建立"的噪音诊断带回模型并诱发多余重问。
  const resolveMissingContextRejection = (missingFields: string[]) => {
    if (!rawIncomingFlowConfirmationDecisions.length && !summaryFlowConfirmationDecisions.length) {
      return { context: null, rejection: null } as NocodeEditorFlowSchemeConfirmationTrustResult
    }
    return {
      context: null,
      rejection: {
        code: 'flow_confirmation_context_missing' as const,
        confirmationStage,
        missingFields,
      },
    }
  }

  const missingFields: string[] = []
  if (!planningContextKey || !continuationPlanningContextKey) {
    missingFields.push('flowConfirmationContextKey')
  }
  if (!confirmationTargetFormId || !targetFormId) {
    missingFields.push('flowConfirmationTargetFormId')
  }
  if (missingFields.length) {
    return resolveMissingContextRejection(missingFields)
  }

  // 回复归属由确认上下文决定：渲染层的“当前打开的表单”只表示用户此刻在浏览哪张表，
  // 用户切回别的表单后回答卡片时不能据此判为不一致（那会让已确认的答案作废并重新提问）。
  // 只有工具显式声明了另一个目标表单，才说明这次回复不属于该确认上下文。
  if (declaredTargetFormId && confirmationTargetFormId !== declaredTargetFormId) {
    return {
      context: null,
      rejection: {
        code: 'flow_confirmation_context_mismatch',
        confirmationStage,
        expected: confirmationTargetFormId,
        actual: declaredTargetFormId,
      },
    }
  }
  if (!isSamePlanningConfirmationContext(planningContextKey, continuationPlanningContextKey)) {
    return {
      context: null,
      rejection: {
        code: 'flow_confirmation_context_mismatch',
        confirmationStage,
        expected: summaryPlanningContextKey,
        actual: continuationPlanningContextKey,
      },
    }
  }

  // The renderer checks the card revision against the live staged scheme.
  const hasEffectiveRevision = isCurrentFlowSchemeRevision(
    continuationSchemeRevision,
    continuationSchemeRevision,
  )
  const hasMismatchedSummaryRevision = !hasIncomingDecisions
    && Boolean(summaryRevision)
    && !isCurrentFlowSchemeRevision(continuationSchemeRevision, summaryRevision)
  if (!hasEffectiveRevision || hasMismatchedSummaryRevision) {
    return {
      context: null,
      rejection: {
        code: 'flow_confirmation_revision_stale',
        confirmationStage,
        replyRevision: Number(continuationSchemeRevision || 0) || 0,
        currentRevision: Number(summaryRevision || 0) || 0,
      },
    }
  }

  const currentSummaryFlowConfirmationDecisions = summaryFlowConfirmationDecisions.filter((item) => (
    isRecord(item)
    && isSamePlanningConfirmationContext(
      normalizeText(item.planningContextKey),
      planningContextKey,
    )
  ))
  const flowConfirmationDecisions = incomingFlowConfirmationDecisions.length
    ? incomingFlowConfirmationDecisions
    : currentSummaryFlowConfirmationDecisions
  if (!flowConfirmationDecisions.length) {
    return resolveMissingContextRejection(['flowConfirmationDecisions'])
  }

  return {
    context: {
      planningContextKey,
      continuationPlanningContextKey,
      targetFormId: confirmationTargetFormId,
      targetFormName: normalizeText(summary?.flowConfirmationTargetFormName)
        || normalizeText(input.activeFormName)
        || undefined,
      flowConfirmationDecisions,
      schemeRevision: Number(continuationSchemeRevision),
    },
    rejection: null,
  }
}

export const buildFlowSchemeConfirmationContextFromRequest = (input: {
  latestTaskSummary?: Record<string, unknown> | null
  requestedFormId?: unknown
  activeFormId?: unknown
  activeFormName?: unknown
  requestMetadata?: unknown
}) => {
  const metadata = isRecord(input.requestMetadata) ? input.requestMetadata : {}
  const confirmationStage = normalizeText(metadata.confirmationStage)
  const isFlowSchemeReply = confirmationStage === 'flow-scheme'
  return buildFlowSchemeConfirmationContextForClientToolCall({
    latestTaskSummary: input.latestTaskSummary,
    requestedFormId: input.requestedFormId,
    activeFormId: input.activeFormId,
    activeFormName: input.activeFormName,
    continuationPlanningContextKey: isFlowSchemeReply
      ? metadata.planningContextKey || metadata.flowPlanningContextKey
      : undefined,
    continuationSchemeRevision: isFlowSchemeReply ? metadata.flowSchemeRevision : undefined,
    incomingFlowConfirmationDecisions: isFlowSchemeReply
      ? metadata.flowConfirmationDecisions
      : undefined,
    allowSummaryRestore: !isFlowSchemeReply,
    confirmationStage,
  })
}

export const buildTrustedFlowSchemeClientToolInput = (input: {
  toolInput?: unknown
  confirmationContext?: unknown
  rejection?: unknown
  replyVersion?: unknown
}) => {
  const toolInput = isRecord(input.toolInput) ? { ...input.toolInput } : {}
  delete toolInput.__flowSchemeConfirmationContext
  delete toolInput.__flowSchemeConfirmationRejection
  delete toolInput.__flowSchemeReplyVersion

  if (isRecord(input.confirmationContext)) {
    toolInput.__flowSchemeConfirmationContext = input.confirmationContext
  } else if (isRecord(input.rejection)) {
    toolInput.__flowSchemeConfirmationRejection = input.rejection
  }
  if (isCurrentFlowSchemeRevision(input.replyVersion, input.replyVersion)) {
    toolInput.__flowSchemeReplyVersion = input.replyVersion
  }
  return toolInput
}

const normalizeQuestionAnswerToDefault = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  const uncertainty = question.uncertainty
  if (uncertainty?.category !== 'safe_default') {
    return {
      ...question,
      confirmed: false,
      selectedOptionValue: undefined,
      answerSummary: undefined,
      answerDetail: undefined,
      options: question.options?.map(option => ({ ...option, selected: false })),
    }
  }

  const rule = findFlowSafeDefaultRule(
    normalizeText(uncertainty.nodeType),
    normalizeText(uncertainty.settingPath),
  )
  if (!rule) {
    return {
      ...question,
      confirmed: false,
      selectedOptionValue: undefined,
      answerSummary: undefined,
      answerDetail: undefined,
      options: question.options?.map(option => ({ ...option, selected: false })),
    }
  }

  const defaultValue = String(rule.defaultValue)
  const option = question.options?.find(item => item.value === defaultValue)
  const proposedValue = normalizeText(question.selectedOptionValue)
    || normalizeText(question.options?.find(item => item.selected)?.value)
  const proposedSummary = normalizeText(question.answerSummary)
  const proposedDetail = normalizeText(question.answerDetail)
  if (
    (proposedValue && proposedValue !== defaultValue)
    || (proposedSummary && proposedSummary !== defaultValue && proposedSummary !== option?.label)
    || proposedDetail
  ) {
    return {
      ...question,
      confirmed: false,
      selectedOptionValue: undefined,
      answerSummary: undefined,
      answerDetail: undefined,
      options: question.options?.map(item => ({ ...item, selected: false })),
    }
  }
  return {
    ...question,
    confirmed: true,
    selectedOptionValue: option?.value,
    answerSummary: option?.label || defaultValue,
    answerDetail: undefined,
    options: question.options?.map(item => ({ ...item, selected: item.value === defaultValue })),
  }
}

export const stripUntrustedNocodeEditorFlowAnswers = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
): NocodeEditorAiConfirmPayload | null => {
  if (!confirmation) return null
  const questions = (confirmation.questions || []).map(normalizeQuestionAnswerToDefault)
  const pending = questions.some(question => question.required !== false && question.confirmed !== true)
  return {
    ...confirmation,
    status: pending ? 'pending' : 'completed',
    questions,
    decisionSnapshot: undefined,
    resultSummary: undefined,
    completionSummary: undefined,
  }
}

export type NocodeEditorFlowConfirmationTrustedDecision = {
  decisionKey?: unknown
  questionId?: unknown
  selectedOptionValue?: unknown
  answerSummary?: unknown
  answerDetail?: unknown
}

export const applyTrustedNocodeEditorFlowAnswers = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  decisions?: NocodeEditorFlowConfirmationTrustedDecision[]
}) => {
  const confirmation = input.confirmation
  if (!confirmation) return null

  const decisionsByKey = new Map<string, {
    selectedOptionValue: string
    answerSummary: string
    answerDetail: string
  }>()
  for (const decision of input.decisions || []) {
    const key = normalizeText(decision.decisionKey) || normalizeText(decision.questionId)
    if (!key) continue
    decisionsByKey.set(key, {
      selectedOptionValue: normalizeText(decision.selectedOptionValue),
      answerSummary: normalizeText(decision.answerSummary),
      answerDetail: normalizeText(decision.answerDetail),
    })
  }

  const questions = (confirmation.questions || []).map((question) => {
    const key = normalizeText(question.decisionKey) || normalizeText(question.id)
    const decision = decisionsByKey.get(key)
    if (!decision) return question

    const selectedOptionValue = decision.selectedOptionValue
      || normalizeText(question.selectedOptionValue)
    const answerSummary = decision.answerSummary
      || normalizeText(question.answerSummary)
    const answerDetail = decision.answerDetail
      || normalizeText(question.answerDetail)
    return {
      ...question,
      confirmed: true,
      ...(selectedOptionValue ? { selectedOptionValue } : {}),
      ...(answerSummary ? { answerSummary } : {}),
      ...(answerDetail ? { answerDetail } : {}),
      ...(question.options
        ? {
            options: question.options.map(option => ({
              ...option,
              selected: Boolean(
                selectedOptionValue
                && normalizeText(option.value) === selectedOptionValue,
              ),
            })),
          }
        : {}),
    }
  })

  return {
    ...confirmation,
    status: 'completed' as const,
    questions,
  }
}

const normalizeEvidenceText = (value: unknown) => normalizeText(value)
  .normalize('NFKC')
  .replace(/[\s\p{P}\p{S}]+/gu, '')
  .toLocaleLowerCase()

export const findVerifiedUserQuote = (input: {
  quote?: unknown
  userTexts?: string[] | null
}): string => {
  const rawQuote = normalizeText(input.quote)
  const normalizedQuote = normalizeEvidenceText(rawQuote)
  if (!normalizedQuote) return ''
  const texts = (input.userTexts || [])
    .map(normalizeEvidenceText)
    .filter(Boolean)
  // 整条消息即引文：4 字门槛只挡「好/好的/可以/没问题」这类通用应答，不挡业务短语
  const wholeMessageMatch = normalizedQuote.length >= 4
    && texts.some(text => text === normalizedQuote)
  // 片段包含：只有够长的引文才接受「包含」，防短语被断章取义
  const containedMatch = normalizedQuote.length >= 8
    && texts.some(text => text.includes(normalizedQuote))
  return wholeMessageMatch || containedMatch ? rawQuote.slice(0, 200) : ''
}

// 只结算归一化后为 note_only 的题：带选项题的答案取值是语义判断，v1 不做。
// status 在这里无条件按最终答案集重算：applyTrustedNocodeEditorFlowAnswers 会无条件写
// completed，部分答案回填时那个 completed 是错的，不能在无引文时原样沿用。
export const settleNocodeEditorFlowQuestionsByUserQuote = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  userTexts?: string[] | null
}): {
  confirmation: NocodeEditorAiConfirmPayload | null
  settledKeys: string[]
  unverifiedKeys: string[]
} => {
  const confirmation = input.confirmation
  if (!confirmation) {
    return { confirmation: null, settledKeys: [], unverifiedKeys: [] }
  }
  const settledKeys: string[] = []
  const unverifiedKeys: string[] = []
  const questions = (confirmation.questions || []).map((question) => {
    const key = normalizeText(question.decisionKey) || normalizeText(question.id)
    const quote = normalizeText(question.userQuote)
    // userQuote 是证据，不是方案内容：结算后一律清掉，避免落库与下一轮复命中
    if (!quote || !key || question.questionKind !== 'note_only' || question.confirmed === true) {
      return { ...question, userQuote: undefined }
    }
    const verified = findVerifiedUserQuote({ quote, userTexts: input.userTexts })
    if (!verified) {
      unverifiedKeys.push(key)
      return { ...question, userQuote: undefined }
    }
    settledKeys.push(key)
    return {
      ...question,
      confirmed: true,
      answerSummary: verified,
      answerDetail: undefined,
      userQuote: undefined,
    }
  })
  const pending = questions.some(question => (
    question.required !== false && question.confirmed !== true
  ))
  return {
    confirmation: { ...confirmation, status: pending ? 'pending' : 'completed', questions },
    settledKeys,
    unverifiedKeys,
  }
}

// 模型自答不能当用户确认：先剥离，再回填本轮可信答案，最后按用户本轮原话结算。
// 必须在决策图/待答题投影之前调用——若延后到收尾才剥离，方案会按“已答”算出空 openQuestions
// 和 completed，随后被打回 pending，形成「有待答题却没有 openQuestion」的错位。
export const applyNocodeEditorFlowConfirmationTrust = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  planningContextKey?: unknown
  decisions?: NocodeEditorFlowConfirmationTrustedDecision[]
  userTexts?: string[] | null
}): {
  confirmation: NocodeEditorAiConfirmPayload | null
  settledByUserQuoteKeys: string[]
  unverifiedUserQuoteKeys: string[]
} => {
  const strippedConfirmation = stripUntrustedNocodeEditorFlowAnswers(
    input.confirmation
      ? {
        ...input.confirmation,
        planningContextKey: normalizeText(input.planningContextKey) || undefined,
      }
      : input.confirmation,
  )
  const withDecisions = strippedConfirmation && input.decisions?.length
    ? applyTrustedNocodeEditorFlowAnswers({
      confirmation: strippedConfirmation,
      decisions: input.decisions,
    })
    : strippedConfirmation
  const settled = settleNocodeEditorFlowQuestionsByUserQuote({
    confirmation: withDecisions,
    userTexts: input.userTexts,
  })
  return {
    confirmation: settled.confirmation,
    settledByUserQuoteKeys: settled.settledKeys,
    unverifiedUserQuoteKeys: settled.unverifiedKeys,
  }
}
