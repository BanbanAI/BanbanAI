import type { NocodeEditorFlowEntryIntent } from './nocodeEditorFlowEntryIntent'
import type { NocodeEditorPlanningScope } from './nocodeEditorPlanningScope'
import { isNocodeEditorPostFormFlowEnabledForScope } from './nocodeEditorPostFormFlowScope'
import {
  normalizeNocodeEditorPendingFlowIntent,
} from './nocodeEditorPendingFlowIntent'
import type { NocodeEditorPendingFlowIntent } from './nocodeEditorPendingFlowIntent'
import {
  normalizeNocodeEditorPostFormFlowOpportunity,
} from './nocodeEditorPostFormFlowOpportunity'
import type { NocodeEditorPostFormFlowOpportunity } from './nocodeEditorPostFormFlowOpportunity'
import {
  normalizeNocodeEditorPostFormFlowSignals,
} from './nocodeEditorPostFormFlowSignals'
import type {
  NocodeEditorPostFormFlowSignalCategory,
  NocodeEditorPostFormFlowSignals,
} from './nocodeEditorPostFormFlowSignals'

export type NocodeEditorPostFormFlowFollowUpMode = 'visible-follow-up'

export type NocodeEditorPostFormFlowFollowUpStatus = 'available'

export type NocodeEditorPostFormFlowFollowUpKind =
  | 'explicit_flow_clarification'
  | 'flow_recommendation'

export type NocodeEditorPostFormFlowFollowUpRecommendation =
  | 'suggested'
  | 'consider'
  | 'not_suggested'

export type NocodeEditorPostFormFlowExplicitClarificationFollowUp = {
  planningScope: 'form'
  mode: NocodeEditorPostFormFlowFollowUpMode
  status: NocodeEditorPostFormFlowFollowUpStatus
  kind: 'explicit_flow_clarification'
  reasonSummary: string
  questionText: string
  autoContinueDelaySeconds: 20
  autoContinueMessage: string
  targetFormId?: string
  targetFormName?: string
  createdAt: number
  updatedAt: number
}

export type NocodeEditorPostFormFlowRecommendationFollowUp = {
  planningScope: 'form'
  mode: NocodeEditorPostFormFlowFollowUpMode
  status: NocodeEditorPostFormFlowFollowUpStatus
  kind: 'flow_recommendation'
  recommendation: NocodeEditorPostFormFlowFollowUpRecommendation
  reasonSummary: string
  targetFormId?: string
  targetFormName?: string
  createdAt: number
  updatedAt: number
}

export type NocodeEditorPostFormFlowFollowUp =
  | NocodeEditorPostFormFlowExplicitClarificationFollowUp
  | NocodeEditorPostFormFlowRecommendationFollowUp

export const NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_QUESTION =
  '继续补流程前，我想先确认：这条流程是提交记录后自动发起，还是由用户点击按钮手动发起？'

export const NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_MESSAGE =
  '如果你没有异议，我就按默认流程继续规划。'

const POST_FORM_FLOW_FOLLOW_UP_MODE: NocodeEditorPostFormFlowFollowUpMode = 'visible-follow-up'
const POST_FORM_FLOW_FOLLOW_UP_STATUS: NocodeEditorPostFormFlowFollowUpStatus = 'available'
const POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_DELAY_SECONDS = 20 as const
const EXPLICIT_FLOW_REASON_SUMMARY = '当前表单已经生成完成，原始需求里的流程部分还没有落地，建议继续创建流程，把提交后的审批、办理或确认动作一起规划完整。'
const SUGGESTED_REASON_SUMMARY = '当前表单的使用场景和字段结构都出现了流程承接线索，建议继续创建流程，把提交后的审批、办理或确认动作一起规划完整。'
const CONSIDER_REASON_SUMMARY = '当前表单只出现了部分流程承接线索，字段结构或使用场景仍不够完整；可考虑先确认是否需要审批、办理或通知流程。'
const NOT_SUGGESTED_REASON_SUMMARY = '当前表单的使用场景和结构里都缺少明显流程承接线索，默认先完成表单；如确实需要流程，可以再说明触发方式、审批或办理场景。'

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeTimestamp = (value: unknown, fallback: number) => {
  const normalized = Math.max(0, Math.round(Number(value || 0)))
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const POST_FORM_FLOW_STRUCTURE_CATEGORIES: NocodeEditorPostFormFlowSignalCategory[] = [
  'participant',
  'lifecycle',
  'evidence',
  'schedule',
  'collaboration',
]

const buildFlowRecommendationReasonSummary = (
  recommendation: NocodeEditorPostFormFlowFollowUpRecommendation,
) => {
  if (recommendation === 'suggested') {
    return SUGGESTED_REASON_SUMMARY
  }
  if (recommendation === 'consider') {
    return CONSIDER_REASON_SUMMARY
  }
  return NOT_SUGGESTED_REASON_SUMMARY
}

const decideFlowRecommendation = (input: {
  postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
}): NocodeEditorPostFormFlowFollowUpRecommendation => {
  if (input.postFormFlowOpportunity?.status !== 'available') {
    return 'not_suggested'
  }

  const postFormFlowSignals = normalizeNocodeEditorPostFormFlowSignals(input.postFormFlowSignals)
  const categories = Array.isArray(postFormFlowSignals?.stats?.categories)
    ? postFormFlowSignals.stats.categories
    : input.postFormFlowOpportunity.categories
  const categorySet = new Set(categories)
  const hasScenarioEvidence = categorySet.has('scenario')
  const hasStructureEvidence = POST_FORM_FLOW_STRUCTURE_CATEGORIES.some(category => categorySet.has(category))

  if (hasScenarioEvidence && hasStructureEvidence) {
    return 'suggested'
  }

  return 'consider'
}

const normalizeEntryFlowIntent = (value: unknown): NocodeEditorFlowEntryIntent | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const state = normalizeText(value.state) as NocodeEditorFlowEntryIntent['state']
  if (state !== 'explicit_positive' && state !== 'explicit_negative' && state !== 'none') {
    return null
  }
  const sourceUserMessage = normalizeText(value.sourceUserMessage)
  if (!sourceUserMessage && state !== 'explicit_negative') {
    return null
  }
  return {
    state,
    sourceUserMessage,
    evidence: Array.isArray(value.evidence)
      ? value.evidence.map(item => normalizeText(item)).filter(Boolean)
      : [],
    targetFormName: normalizeText(value.targetFormName) || undefined,
  }
}

const buildExplicitFlowClarificationFollowUp = (input: {
  targetFormId?: unknown
  targetFormName?: unknown
  now?: unknown
}): NocodeEditorPostFormFlowExplicitClarificationFollowUp => {
  const now = normalizeTimestamp(input.now, Date.now())
  return {
    planningScope: 'form',
    mode: POST_FORM_FLOW_FOLLOW_UP_MODE,
    status: POST_FORM_FLOW_FOLLOW_UP_STATUS,
    kind: 'explicit_flow_clarification',
    reasonSummary: EXPLICIT_FLOW_REASON_SUMMARY,
    questionText: NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_QUESTION,
    autoContinueDelaySeconds: POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_DELAY_SECONDS,
    autoContinueMessage: NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_MESSAGE,
    targetFormId: normalizeText(input.targetFormId) || undefined,
    targetFormName: normalizeText(input.targetFormName) || undefined,
    createdAt: now,
    updatedAt: now,
  }
}

const buildFlowRecommendationFollowUp = (input: {
  recommendation: NocodeEditorPostFormFlowFollowUpRecommendation
  targetFormId?: unknown
  targetFormName?: unknown
  now?: unknown
}): NocodeEditorPostFormFlowRecommendationFollowUp => {
  const now = normalizeTimestamp(input.now, Date.now())
  return {
    planningScope: 'form',
    mode: POST_FORM_FLOW_FOLLOW_UP_MODE,
    status: POST_FORM_FLOW_FOLLOW_UP_STATUS,
    kind: 'flow_recommendation',
    recommendation: input.recommendation,
    reasonSummary: buildFlowRecommendationReasonSummary(input.recommendation),
    targetFormId: normalizeText(input.targetFormId) || undefined,
    targetFormName: normalizeText(input.targetFormName) || undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export const normalizeNocodeEditorPostFormFlowFollowUp = (
  value: unknown,
  fallbackNow = Date.now(),
): NocodeEditorPostFormFlowFollowUp | null => {
  if (!isPlainObject(value)) {
    return null
  }

  if (!isNocodeEditorPostFormFlowEnabledForScope(value.planningScope)) {
    return null
  }

  const mode = normalizeText(value.mode)
  if (mode !== POST_FORM_FLOW_FOLLOW_UP_MODE) {
    return null
  }

  const status = normalizeText(value.status)
  if (status !== POST_FORM_FLOW_FOLLOW_UP_STATUS) {
    return null
  }

  const kind = normalizeText(value.kind) as NocodeEditorPostFormFlowFollowUpKind
  const createdAt = normalizeTimestamp(value.createdAt, fallbackNow)
  const updatedAt = normalizeTimestamp(value.updatedAt, createdAt)
  const targetFormId = normalizeText(value.targetFormId) || undefined
  const targetFormName = normalizeText(value.targetFormName) || undefined

  if (kind === 'explicit_flow_clarification') {
    return {
      planningScope: 'form',
      mode: POST_FORM_FLOW_FOLLOW_UP_MODE,
      status: POST_FORM_FLOW_FOLLOW_UP_STATUS,
      kind,
      reasonSummary: EXPLICIT_FLOW_REASON_SUMMARY,
      questionText: NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_QUESTION,
      autoContinueDelaySeconds: POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_DELAY_SECONDS,
      autoContinueMessage: NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_MESSAGE,
      targetFormId,
      targetFormName,
      createdAt,
      updatedAt,
    }
  }

  if (kind === 'flow_recommendation') {
    const recommendation = normalizeText(value.recommendation) as NocodeEditorPostFormFlowFollowUpRecommendation
    if (
      recommendation !== 'suggested'
      && recommendation !== 'consider'
      && recommendation !== 'not_suggested'
    ) {
      return null
    }

    return {
      planningScope: 'form',
      mode: POST_FORM_FLOW_FOLLOW_UP_MODE,
      status: POST_FORM_FLOW_FOLLOW_UP_STATUS,
      kind,
      recommendation,
      reasonSummary: buildFlowRecommendationReasonSummary(recommendation),
      targetFormId,
      targetFormName,
      createdAt,
      updatedAt,
    }
  }

  return null
}

export const decideNocodeEditorPostFormFlowFollowUp = (input: {
  planningScope: NocodeEditorPlanningScope
  entryFlowIntent?: NocodeEditorFlowEntryIntent | null
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  targetFormId?: unknown
  targetFormName?: unknown
  now?: unknown
}) => {
  if (!isNocodeEditorPostFormFlowEnabledForScope(input.planningScope)) {
    return null
  }

  const entryFlowIntent = normalizeEntryFlowIntent(input.entryFlowIntent)
  const pendingFlowIntent = normalizeNocodeEditorPendingFlowIntent(input.pendingFlowIntent)
  const postFormFlowOpportunity = normalizeNocodeEditorPostFormFlowOpportunity(
    input.postFormFlowOpportunity,
  )
  const targetFormId = normalizeText(input.targetFormId) || undefined
  const targetFormName = normalizeText(input.targetFormName) || undefined

  if (
    entryFlowIntent?.state === 'explicit_positive'
    && pendingFlowIntent
    && pendingFlowIntent.status === 'pending_after_form_apply'
  ) {
    return buildExplicitFlowClarificationFollowUp({
      targetFormId: targetFormId || pendingFlowIntent.targetFormId,
      targetFormName: targetFormName || pendingFlowIntent.targetFormName || entryFlowIntent.targetFormName,
      now: input.now,
    })
  }

  if (postFormFlowOpportunity?.status === 'available') {
    const recommendation = decideFlowRecommendation({
      postFormFlowOpportunity,
      postFormFlowSignals: input.postFormFlowSignals,
    })
    if (recommendation !== 'not_suggested') {
      return buildFlowRecommendationFollowUp({
        recommendation,
        targetFormId: targetFormId || postFormFlowOpportunity.targetFormId,
        targetFormName: targetFormName || postFormFlowOpportunity.targetFormName,
        now: input.now,
      })
    }
  }

  return buildFlowRecommendationFollowUp({
    recommendation: 'not_suggested',
    targetFormId,
    targetFormName,
    now: input.now,
  })
}

const buildExplicitFlowClarificationMessageLines = (
  followUp: NocodeEditorPostFormFlowExplicitClarificationFollowUp,
) => [
  EXPLICIT_FLOW_REASON_SUMMARY,
  followUp.questionText,
  `如果你没有异议，我会在 ${followUp.autoContinueDelaySeconds} 秒后自动继续流程规划；你也可以直接回复“先不用流程”来取消。`,
]

const buildFlowRecommendationMessageLines = (
  followUp: NocodeEditorPostFormFlowRecommendationFollowUp,
) => {
  return [followUp.reasonSummary]
}

export const buildNocodeEditorPostFormFlowFollowUpMessageLines = (
  followUp?: NocodeEditorPostFormFlowFollowUp | null,
) => {
  const normalized = normalizeNocodeEditorPostFormFlowFollowUp(followUp)
  if (!normalized) {
    return []
  }

  if (normalized.kind === 'explicit_flow_clarification') {
    return buildExplicitFlowClarificationMessageLines(normalized)
  }

  return buildFlowRecommendationMessageLines(normalized)
}

export const buildNocodeEditorPostFormFlowInlineMessageLines = (
  followUp?: NocodeEditorPostFormFlowFollowUp | null,
) => {
  const normalized = normalizeNocodeEditorPostFormFlowFollowUp(followUp)
  if (!normalized) {
    return []
  }

  if (normalized.kind === 'explicit_flow_clarification') {
    return []
  }

  return []
}

export const buildNocodeEditorPostFormFlowTrailingMessageLines = (
  followUp?: NocodeEditorPostFormFlowFollowUp | null,
) => {
  const normalized = normalizeNocodeEditorPostFormFlowFollowUp(followUp)
  if (!normalized || normalized.kind === 'explicit_flow_clarification') {
    return []
  }

  return buildFlowRecommendationMessageLines(normalized)
}
