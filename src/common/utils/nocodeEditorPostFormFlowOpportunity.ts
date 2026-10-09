import type { NocodeEditorFlowEntryIntent } from './nocodeEditorFlowEntryIntent'
import type { NocodeEditorPlanningScope } from './nocodeEditorPlanningScope'
import { isNocodeEditorPostFormFlowEnabledForScope } from './nocodeEditorPostFormFlowScope'
import {
  normalizeNocodeEditorPostFormFlowSignals,
} from './nocodeEditorPostFormFlowSignals'
import type {
  NocodeEditorPostFormFlowSignalCategory,
  NocodeEditorPostFormFlowSignals,
} from './nocodeEditorPostFormFlowSignals'

export type NocodeEditorPostFormFlowOpportunityStatus =
  | 'available'
  | 'consumed'
  | 'cleared'

export type NocodeEditorPostFormFlowOpportunityClearReason =
  | 'explicit_negative'
  | 'fresh_new_form'

export type NocodeEditorPostFormFlowOpportunityConsumedBy =
  | 'flow_mainline_started'

export type NocodeEditorPostFormFlowOpportunity = {
  planningScope: 'form'
  mode: 'context-only'
  status: NocodeEditorPostFormFlowOpportunityStatus
  reasonSummary: string
  categories: NocodeEditorPostFormFlowSignalCategory[]
  targetFormId?: string
  targetFormName?: string
  clearReason?: NocodeEditorPostFormFlowOpportunityClearReason
  consumedBy?: NocodeEditorPostFormFlowOpportunityConsumedBy
  createdAt: number
  updatedAt: number
}

const POST_FORM_FLOW_OPPORTUNITY_MODE = 'context-only'
const POST_FORM_FLOW_OPPORTUNITY_CATEGORY_ORDER: NocodeEditorPostFormFlowSignalCategory[] = [
  'scenario',
  'participant',
  'evidence',
  'lifecycle',
  'schedule',
  'collaboration',
]

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

const normalizeEntryFlowIntentState = (
  value: unknown,
): NocodeEditorFlowEntryIntent['state'] | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const state = normalizeText(value.state) as NocodeEditorFlowEntryIntent['state']
  if (state !== 'explicit_positive' && state !== 'explicit_negative' && state !== 'none') {
    return null
  }
  return state
}

const normalizeEntryFlowIntent = (value: unknown): NocodeEditorFlowEntryIntent | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const state = normalizeEntryFlowIntentState(value)
  if (!state) {
    return null
  }
  const sourceUserMessage = normalizeText(value.sourceUserMessage)
  if (!sourceUserMessage) {
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

const normalizeCategories = (
  value: unknown,
): NocodeEditorPostFormFlowSignalCategory[] => POST_FORM_FLOW_OPPORTUNITY_CATEGORY_ORDER.filter(category => (
  Array.isArray(value)
  && value.some(item => normalizeText(item) === category)
))

const shouldCreateOpportunity = (
  categories: NocodeEditorPostFormFlowSignalCategory[],
) => {
  const categorySet = new Set(categories)
  const has = (category: NocodeEditorPostFormFlowSignalCategory) => categorySet.has(category)

  if (has('scenario')) {
    return true
  }

  if (
    has('participant')
    && has('lifecycle')
    && (has('evidence') || has('schedule') || has('collaboration'))
  ) {
    return true
  }

  if (has('participant') && has('evidence') && has('schedule')) {
    return true
  }

  if (
    has('collaboration')
    && has('lifecycle')
    && (has('participant') || has('evidence'))
  ) {
    return true
  }

  return false
}

const buildReasonSummary = (categories: NocodeEditorPostFormFlowSignalCategory[]) => {
  const categoryText = categories.join(', ')
  return `当前表单结构或使用场景命中 ${categoryText} 类中性流程承接机会，只表示可供后续流程规划参考，不表示系统自动进入流程创建。`
}

const normalizeMonotonicUpdatedAt = (value: unknown, previousUpdatedAt: number) => {
  const nextUpdatedAt = normalizeTimestamp(value, previousUpdatedAt)
  return Math.max(previousUpdatedAt, nextUpdatedAt)
}

const transitionNocodeEditorPostFormFlowOpportunity = <TStatus extends 'cleared' | 'consumed'>(input: {
  opportunity?: NocodeEditorPostFormFlowOpportunity | null
  nextStatus: TStatus
  clearReason?: NocodeEditorPostFormFlowOpportunityClearReason
  consumedBy?: NocodeEditorPostFormFlowOpportunityConsumedBy
  now?: unknown
}) => {
  const opportunity = normalizeNocodeEditorPostFormFlowOpportunity(input.opportunity)
  if (!opportunity || opportunity.status !== 'available') {
    return null
  }

  return {
    ...opportunity,
    status: input.nextStatus,
    clearReason: input.nextStatus === 'cleared' ? input.clearReason : undefined,
    consumedBy: input.nextStatus === 'consumed' ? input.consumedBy : undefined,
    updatedAt: normalizeMonotonicUpdatedAt(input.now, opportunity.updatedAt),
  }
}

export const normalizeNocodeEditorPostFormFlowOpportunity = (
  value: unknown,
  fallbackNow = Date.now(),
): NocodeEditorPostFormFlowOpportunity | null => {
  if (!isPlainObject(value)) {
    return null
  }

  if (!isNocodeEditorPostFormFlowEnabledForScope(value.planningScope)) {
    return null
  }

  const mode = normalizeText(value.mode)
  if (mode !== POST_FORM_FLOW_OPPORTUNITY_MODE) {
    return null
  }

  const status = normalizeText(value.status) as NocodeEditorPostFormFlowOpportunityStatus
  if (status !== 'available' && status !== 'consumed' && status !== 'cleared') {
    return null
  }

  const incomingReasonSummary = normalizeText(value.reasonSummary)
  const categories = normalizeCategories(value.categories)
  if (!incomingReasonSummary || !categories.length || !shouldCreateOpportunity(categories)) {
    return null
  }
  const reasonSummary = buildReasonSummary(categories)

  const createdAt = normalizeTimestamp(value.createdAt, fallbackNow)
  const updatedAt = normalizeTimestamp(value.updatedAt, createdAt)
  const clearReason = normalizeText(value.clearReason)
  const consumedBy = normalizeText(value.consumedBy)

  return {
    planningScope: 'form',
    mode: POST_FORM_FLOW_OPPORTUNITY_MODE,
    status,
    reasonSummary,
    categories,
    targetFormId: normalizeText(value.targetFormId) || undefined,
    targetFormName: normalizeText(value.targetFormName) || undefined,
    clearReason: status === 'cleared' && (
      clearReason === 'explicit_negative' || clearReason === 'fresh_new_form'
    )
      ? clearReason
      : undefined,
    consumedBy: status === 'consumed' && consumedBy === 'flow_mainline_started'
      ? 'flow_mainline_started'
      : undefined,
    createdAt,
    updatedAt,
  }
}

export const decideNocodeEditorPostFormFlowOpportunity = (input: {
  planningScope: NocodeEditorPlanningScope
  entryFlowIntent?: NocodeEditorFlowEntryIntent | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  targetFormId?: unknown
  targetFormName?: unknown
  now?: unknown
}): NocodeEditorPostFormFlowOpportunity | null => {
  if (!isNocodeEditorPostFormFlowEnabledForScope(input.planningScope)) {
    return null
  }

  const entryFlowIntentState = normalizeEntryFlowIntentState(input.entryFlowIntent)
  if (
    entryFlowIntentState === 'explicit_positive'
    || entryFlowIntentState === 'explicit_negative'
  ) {
    return null
  }

  const postFormFlowSignals = normalizeNocodeEditorPostFormFlowSignals(input.postFormFlowSignals)
  const categories = normalizeCategories(postFormFlowSignals?.stats?.categories)
  if (!categories.length || !shouldCreateOpportunity(categories)) {
    return null
  }

  const now = normalizeTimestamp(input.now, Date.now())
  return {
    planningScope: 'form' as const,
    mode: POST_FORM_FLOW_OPPORTUNITY_MODE,
    status: 'available' as const,
    reasonSummary: buildReasonSummary(categories),
    categories,
    targetFormId: normalizeText(input.targetFormId) || undefined,
    targetFormName: normalizeText(input.targetFormName) || undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export const clearNocodeEditorPostFormFlowOpportunity = (input: {
  opportunity?: NocodeEditorPostFormFlowOpportunity | null
  clearReason?: NocodeEditorPostFormFlowOpportunityClearReason | null
  now?: unknown
}) => {
  const clearReason = normalizeText(input.clearReason)
  if (
    clearReason !== 'explicit_negative' && clearReason !== 'fresh_new_form'
  ) {
    return null
  }

  return transitionNocodeEditorPostFormFlowOpportunity({
    opportunity: input.opportunity,
    nextStatus: 'cleared',
    clearReason,
    now: input.now,
  })
}

export const consumeNocodeEditorPostFormFlowOpportunity = (input: {
  opportunity?: NocodeEditorPostFormFlowOpportunity | null
  consumedBy?: NocodeEditorPostFormFlowOpportunityConsumedBy | null
  now?: unknown
}) => {
  const consumedBy = normalizeText(input.consumedBy)
  if (consumedBy !== 'flow_mainline_started') {
    return null
  }

  return transitionNocodeEditorPostFormFlowOpportunity({
    opportunity: input.opportunity,
    nextStatus: 'consumed',
    consumedBy: 'flow_mainline_started',
    now: input.now,
  })
}
