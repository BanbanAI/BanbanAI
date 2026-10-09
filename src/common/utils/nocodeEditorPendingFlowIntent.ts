import type { NocodeEditorFlowEntryIntent } from './nocodeEditorFlowEntryIntent'

export type NocodeEditorPendingFlowIntentStatus =
  | 'pending_after_form_apply'
  | 'in_progress'
  | 'completed'

export type NocodeEditorPendingFlowIntent = {
  status: NocodeEditorPendingFlowIntentStatus
  sourceUserMessage: string
  evidence: string[]
  targetFormId?: string
  targetFormName?: string
  createdAt: number
  updatedAt: number
  completedByTool?: 'editor_apply_staged_flow' | 'editor_patch_flow'
}

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

const normalizeEntryFlowIntent = (value: unknown): NocodeEditorFlowEntryIntent | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const state = normalizeText(value.state) as NocodeEditorFlowEntryIntent['state']
  if (state !== 'explicit_positive' && state !== 'explicit_negative' && state !== 'none') {
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

export const normalizeNocodeEditorPendingFlowIntent = (
  value: unknown,
  fallbackNow = Date.now(),
): NocodeEditorPendingFlowIntent | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const status = normalizeText(value.status) as NocodeEditorPendingFlowIntentStatus
  if (
    status !== 'pending_after_form_apply'
    && status !== 'in_progress'
    && status !== 'completed'
  ) {
    return null
  }
  const sourceUserMessage = normalizeText(value.sourceUserMessage)
  if (!sourceUserMessage) {
    return null
  }
  const createdAt = normalizeTimestamp(value.createdAt, fallbackNow)
  const updatedAt = normalizeTimestamp(value.updatedAt, createdAt)
  return {
    status,
    sourceUserMessage,
    evidence: Array.isArray(value.evidence)
      ? value.evidence.map(item => normalizeText(item)).filter(Boolean)
      : [],
    targetFormId: normalizeText(value.targetFormId) || undefined,
    targetFormName: normalizeText(value.targetFormName) || undefined,
    createdAt,
    updatedAt,
    completedByTool: (
      normalizeText(value.completedByTool) === 'editor_apply_staged_flow'
      || normalizeText(value.completedByTool) === 'editor_patch_flow'
    )
      ? normalizeText(value.completedByTool) as NocodeEditorPendingFlowIntent['completedByTool']
      : undefined,
  }
}

export const buildNocodeEditorPendingFlowIntentFromEntryFlowIntent = (input: {
  entryFlowIntent?: NocodeEditorFlowEntryIntent | null
  targetFormId?: unknown
  targetFormName?: unknown
  now?: unknown
}) => {
  const entryFlowIntent = normalizeEntryFlowIntent(input.entryFlowIntent)
  if (entryFlowIntent?.state !== 'explicit_positive') {
    return null
  }

  const entryTargetFormName = normalizeText(entryFlowIntent.targetFormName)
  const targetFormName = normalizeText(input.targetFormName)
  if (entryTargetFormName && targetFormName && entryTargetFormName !== targetFormName) {
    return null
  }

  const now = normalizeTimestamp(input.now, Date.now())
  return {
    status: 'pending_after_form_apply' as const,
    sourceUserMessage: entryFlowIntent.sourceUserMessage,
    evidence: entryFlowIntent.evidence,
    targetFormId: normalizeText(input.targetFormId) || undefined,
    targetFormName: (
      targetFormName
      || entryTargetFormName
      || undefined
    ),
    createdAt: now,
    updatedAt: now,
  }
}

export const matchNocodeEditorPendingFlowIntentTarget = (input: {
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  targetFormId?: unknown
  targetFormName?: unknown
}) => {
  const pendingFlowIntent = input.pendingFlowIntent || null
  if (!pendingFlowIntent) {
    return false
  }
  const pendingTargetFormId = normalizeText(pendingFlowIntent.targetFormId)
  const pendingTargetFormName = normalizeText(pendingFlowIntent.targetFormName)
  const targetFormId = normalizeText(input.targetFormId)
  const targetFormName = normalizeText(input.targetFormName)

  if (!pendingTargetFormId && !pendingTargetFormName) {
    return false
  }

  if (pendingTargetFormId && targetFormId) {
    return pendingTargetFormId === targetFormId
  }

  return Boolean(
    pendingTargetFormName
    && targetFormName
    && pendingTargetFormName === targetFormName,
  )
}
