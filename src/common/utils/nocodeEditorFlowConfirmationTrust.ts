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
  const incomingFlowConfirmationDecisions = Array.isArray(input.incomingFlowConfirmationDecisions)
    ? input.incomingFlowConfirmationDecisions.filter((item) => (
      isRecord(item)
      && isSamePlanningConfirmationContext(
        normalizeText(item.planningContextKey),
        continuationPlanningContextKey,
      )
    ))
    : []
  const hasIncomingDecisions = incomingFlowConfirmationDecisions.length > 0
  const planningContextKey = hasIncomingDecisions
    ? continuationPlanningContextKey
    : summaryPlanningContextKey
  const confirmationTargetFormId = summaryTargetFormId || (
    hasIncomingDecisions ? targetFormId : ''
  )
  const confirmationStage = normalizeText(input.confirmationStage)

  const missingFields: string[] = []
  if (!planningContextKey || !continuationPlanningContextKey) {
    missingFields.push('flowConfirmationContextKey')
  }
  if (!confirmationTargetFormId || !targetFormId) {
    missingFields.push('flowConfirmationTargetFormId')
  }
  if (missingFields.length) {
    return {
      context: null,
      rejection: {
        code: 'flow_confirmation_context_missing',
        confirmationStage,
        missingFields,
      },
    }
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
    return {
      context: null,
      rejection: {
        code: 'flow_confirmation_context_missing',
        confirmationStage,
        missingFields: ['flowConfirmationDecisions'],
      },
    }
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

export const applyTrustedNocodeEditorFlowAnswers = (input: {
  confirmation?: NocodeEditorAiConfirmPayload | null
  decisions?: Array<{
    decisionKey?: unknown
    questionId?: unknown
    selectedOptionValue?: unknown
    answerSummary?: unknown
    answerDetail?: unknown
  }>
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
