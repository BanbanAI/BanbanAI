import { AiMessageRole, type AiActionResult, type AiEditorMode, type AiProviderMessage } from '../ai.types'
import { isBlueprintAppliedPhase } from '@common/utils/nocodeEditorBlueprintLifecycle'
import { resolveNocodeEditorCompleteNewFormIntentFromMessages } from '@common/utils/nocodeEditorSingleFormPlan'

export type NocodeEditorBlueprintApplyGate = {
  mode: 'require_explicit_confirmation' | 'allow_immediate_apply'
  reason:
    | 'complete_new_form_default'
    | 'user_requested_direct_apply'
    | 'user_requested_empty_shell'
  stagedRevision?: number
  stagedAt?: number
  status?: 'pending' | 'consumed'
  consumedBy?: 'ai_apply_success' | 'manual_apply'
}

const DIRECT_APPLY_KEYWORDS = [
  '直接落地',
  '不用先给我确认',
  '不用确认',
  '直接生成',
  '直接创建',
]

const EMPTY_SHELL_KEYWORDS = [
  '空白表单',
  '表单壳子',
  '搭个壳子',
  '先开一个表单',
]

const NEW_FORM_ACTION_KEYWORDS = [
  '创建',
  '新建',
  '搭建',
  '做一个',
  '做个',
  '生成一个',
]

const NEW_FORM_OBJECT_KEYWORDS = [
  '问卷',
  '登记表',
  '申请单',
  '台账',
  '表单',
]

const INCREMENTAL_EDIT_HINTS = [
  '当前表单',
  '这个表单',
  '当前字段',
  '这个字段',
  '新增字段',
  '加字段',
  '补一个字段',
  '删字段',
  '调整字段',
  '改成',
  '改为',
  '继续补',
]

void NEW_FORM_ACTION_KEYWORDS
void NEW_FORM_OBJECT_KEYWORDS
void INCREMENTAL_EDIT_HINTS

const EXPLICIT_CONFIRM_TEXTS = new Set([
  '可以',
  '可以生成',
  '可以直接生成',
  '继续',
  '继续生成',
  '没问题',
  '就这样',
  '确认',
  '确认生成',
  '直接生成',
  '按蓝图生成',
])

type BlueprintGateTimelineItem =
  | {
      kind: 'message'
      message: Pick<AiProviderMessage, 'role' | 'content' | 'metadata'>
    }
  | {
      kind: 'result'
      result: AiActionResult
    }

type PendingGateMatch = {
  gate: NocodeEditorBlueprintApplyGate
  index: number
}

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, '').trim()
const normalizeConfirmationText = (value: unknown) => normalizeText(value)
  .replace(/[，。！？、；：,.!?;:"'“”‘’（）()[\]{}]/g, '')
const includesAny = (text: string, keywords: string[]) => keywords.some(keyword => text.includes(keyword))
const toSafeNumber = (value: unknown) => {
  const normalized = Number(value || 0)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined
}

const buildPendingGate = (
  mode: NocodeEditorBlueprintApplyGate['mode'],
  reason: NocodeEditorBlueprintApplyGate['reason'],
  base: Pick<NocodeEditorBlueprintApplyGate, 'stagedRevision' | 'stagedAt'>,
): NocodeEditorBlueprintApplyGate => ({
  mode,
  reason,
  status: 'pending',
  ...base,
})

const normalizeGate = (value: unknown): NocodeEditorBlueprintApplyGate | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const gate = value as Record<string, unknown>
  const mode = String(gate.mode || '').trim()
  const reason = String(gate.reason || '').trim()
  if (
    mode !== 'require_explicit_confirmation'
    && mode !== 'allow_immediate_apply'
  ) {
    return null
  }
  if (
    reason !== 'complete_new_form_default'
    && reason !== 'user_requested_direct_apply'
    && reason !== 'user_requested_empty_shell'
  ) {
    return null
  }

  const status = String(gate.status || '').trim()
  const consumedBy = String(gate.consumedBy || '').trim()

  return {
    mode,
    reason,
    stagedRevision: toSafeNumber(gate.stagedRevision),
    stagedAt: toSafeNumber(gate.stagedAt),
    status: status === 'consumed' ? 'consumed' : 'pending',
    consumedBy: consumedBy === 'ai_apply_success' || consumedBy === 'manual_apply'
      ? consumedBy
      : undefined,
  }
}

const buildTimeline = (options: {
  history: Array<Pick<AiProviderMessage, 'role' | 'content' | 'metadata'>>
  roundResults?: AiActionResult[]
}) => {
  const timeline: BlueprintGateTimelineItem[] = []

  for (const message of Array.isArray(options.history) ? options.history : []) {
    timeline.push({
      kind: 'message',
      message,
    })
  }

  for (const result of Array.isArray(options.roundResults) ? options.roundResults : []) {
    timeline.push({
      kind: 'result',
      result,
    })
  }

  return timeline
}

const getTimelineGate = (item: BlueprintGateTimelineItem) => {
  if (item.kind === 'message') {
    return normalizeGate(item.message?.metadata?.blueprintApplyGate)
  }
  return normalizeGate(item.result?.metadata?.blueprintApplyGate)
}

const matchesGateVersion = (
  gate: Pick<NocodeEditorBlueprintApplyGate, 'stagedRevision' | 'stagedAt'> | null | undefined,
  stagedRevision: unknown,
  stagedAt: unknown,
) => {
  if (!gate) {
    return false
  }

  const leftRevision = toSafeNumber(gate.stagedRevision)
  const rightRevision = toSafeNumber(stagedRevision)
  if (leftRevision && rightRevision && leftRevision !== rightRevision) {
    return false
  }

  const leftStagedAt = toSafeNumber(gate.stagedAt)
  const rightStagedAt = toSafeNumber(stagedAt)
  if (leftStagedAt && rightStagedAt && leftStagedAt !== rightStagedAt) {
    return false
  }

  return Boolean(leftRevision || leftStagedAt)
}

const hasAppliedBlueprintArtifact = (
  metadata: Record<string, any> | null | undefined,
  gate: NocodeEditorBlueprintApplyGate | null | undefined,
) => {
  const blocks = Array.isArray(metadata?.blocks) ? metadata.blocks : []
  return blocks.some((block) => (
    block
    && typeof block === 'object'
    && !Array.isArray(block)
    && String(block.kind || '').trim() === 'blueprint'
    && isBlueprintAppliedPhase(block.phase)
    && matchesGateVersion(gate, block.revision, block.stagedAt)
  ))
}

const findLatestPendingGate = (options: {
  history: Array<Pick<AiProviderMessage, 'role' | 'content' | 'metadata'>>
  roundResults?: AiActionResult[]
}): PendingGateMatch | null => {
  const timeline = buildTimeline(options)
  let latestPending: PendingGateMatch | null = null

  for (let index = 0; index < timeline.length; index += 1) {
    const item = timeline[index]
    const gate = getTimelineGate(item)
    if (gate) {
      if (gate.status === 'consumed') {
        if (
          latestPending
          && matchesGateVersion(latestPending.gate, gate.stagedRevision, gate.stagedAt)
        ) {
          latestPending = null
        }
        continue
      }

      latestPending = {
        gate,
        index,
      }
      continue
    }

    if (
      item.kind === 'message'
      && latestPending
      && hasAppliedBlueprintArtifact(item.message.metadata, latestPending.gate)
    ) {
      latestPending = null
    }
  }

  return latestPending
}

const looksLikeCompleteNewFormIntent = (options: {
  text: string
  recentUserMessages?: unknown[]
  editorMode?: AiEditorMode | string
  activeFormId?: string
}) => resolveNocodeEditorCompleteNewFormIntentFromMessages({
  userMessages: Array.isArray(options.recentUserMessages) && options.recentUserMessages.length
    ? options.recentUserMessages
    : [options.text],
  editorMode: options.editorMode,
  activeFormId: options.activeFormId,
})

export const isExplicitBlueprintApplyConfirmation = (value: unknown) => {
  const text = normalizeConfirmationText(value)
  if (!text) {
    return false
  }
  return EXPLICIT_CONFIRM_TEXTS.has(text)
}

export const resolveBlueprintApplyGateForStage = (options: {
  userMessage: string
  recentUserMessages?: unknown[]
  editorMode?: AiEditorMode | string
  activeFormId?: string
  previousGate?: NocodeEditorBlueprintApplyGate | null
  stageOutput?: {
    revision?: number
    stagedAt?: number
  }
}): NocodeEditorBlueprintApplyGate | null => {
  const text = normalizeText(options.userMessage)
  const base = {
    stagedRevision: toSafeNumber(options.stageOutput?.revision),
    stagedAt: toSafeNumber(options.stageOutput?.stagedAt),
  }

  if (!text) {
    return options.previousGate?.status === 'pending'
      ? buildPendingGate(options.previousGate.mode, options.previousGate.reason, base)
      : null
  }

  if (includesAny(text, DIRECT_APPLY_KEYWORDS)) {
    return buildPendingGate('allow_immediate_apply', 'user_requested_direct_apply', base)
  }

  if (includesAny(text, EMPTY_SHELL_KEYWORDS)) {
    return buildPendingGate('allow_immediate_apply', 'user_requested_empty_shell', base)
  }

  if (options.previousGate?.status === 'pending') {
    return buildPendingGate(options.previousGate.mode, options.previousGate.reason, base)
  }

  if (looksLikeCompleteNewFormIntent({
    text,
    recentUserMessages: options.recentUserMessages,
    editorMode: options.editorMode,
    activeFormId: options.activeFormId,
  })) {
    return buildPendingGate('require_explicit_confirmation', 'complete_new_form_default', base)
  }

  return null
}

export const getLatestPendingBlueprintApplyGate = (options: {
  history: Array<Pick<AiProviderMessage, 'role' | 'content' | 'metadata'>>
  roundResults?: AiActionResult[]
}) => findLatestPendingGate(options)?.gate || null

export const shouldBlockAgentBlueprintApply = (options: {
  history: Array<Pick<AiProviderMessage, 'role' | 'content' | 'metadata'>>
  roundResults?: AiActionResult[]
}) => {
  const pendingGateMatch = findLatestPendingGate(options)
  if (!pendingGateMatch) {
    return {
      blocked: false,
      gate: null,
    }
  }

  if (pendingGateMatch.gate.mode !== 'require_explicit_confirmation') {
    return {
      blocked: false,
      gate: pendingGateMatch.gate,
    }
  }

  const timeline = buildTimeline(options)
  for (let index = pendingGateMatch.index + 1; index < timeline.length; index += 1) {
    const item = timeline[index]
    if (item.kind !== 'message') {
      continue
    }
    if (item.message.role !== AiMessageRole.USER) {
      continue
    }
    if (isExplicitBlueprintApplyConfirmation(item.message.content)) {
      return {
        blocked: false,
        gate: pendingGateMatch.gate,
      }
    }
  }

  return {
    blocked: true,
    gate: pendingGateMatch.gate,
  }
}
