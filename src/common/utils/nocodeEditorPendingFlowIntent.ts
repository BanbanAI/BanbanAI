import type { NocodeEditorFlowEntryIntent } from './nocodeEditorFlowEntryIntent'
import { resolveNocodeEditorAppliedPrimaryForm } from './nocodeEditorAppliedFlowTarget'

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

// completed 是终态：已完成的挂账不再作为“当前活动挂账”续跑；但重绑判定仍需要它记住
// 这条显式需求原本属于哪张表单，因此判定侧要使用 normalizeNocodeEditorPendingFlowIntent。
export const normalizeActiveNocodeEditorPendingFlowIntent = (
  value: unknown,
  fallbackNow = Date.now(),
): NocodeEditorPendingFlowIntent | null => {
  const pendingFlowIntent = normalizeNocodeEditorPendingFlowIntent(value, fallbackNow)
  return pendingFlowIntent?.status === 'completed' ? null : pendingFlowIntent
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

// 蓝图落地后的挂账闸门：目标必须能从本次应用批次里解析出来。
// 解析不到时不建挂账——宁可这一轮不续跑，也不能拿入口意图里旧表单的名字顶上，
// 否则上一张表单已完成的流程需求会被新表单“复活”。
export const resolveNocodeEditorPendingFlowIntentAfterBlueprintApply = (input: {
  entryFlowIntent?: NocodeEditorFlowEntryIntent | null
  appliedForms?: readonly unknown[] | null
  primaryFormKey?: unknown
  primaryFormName?: unknown
  now?: unknown
}): NocodeEditorPendingFlowIntent | null => {
  const targetIdentity = resolveNocodeEditorAppliedPrimaryForm(input.appliedForms, {
    primaryFormKey: input.primaryFormKey,
    primaryFormName: input.primaryFormName,
  })
  if (!targetIdentity.targetFormId && !targetIdentity.targetFormName) {
    return null
  }
  return buildNocodeEditorPendingFlowIntentFromEntryFlowIntent({
    entryFlowIntent: input.entryFlowIntent,
    targetFormId: targetIdentity.targetFormId,
    targetFormName: targetIdentity.targetFormName,
    now: input.now,
  })
}

// 入口意图一旦在某张表单上落成过挂账，就永久沿用那张表单；后续轮次（补确认、应用蓝图）只允许继承，
// 不允许因为当前激活表单换了就重新绑定，否则另一张表的流程要求会被带到新表单上。
export const bindNocodeEditorFlowEntryIntentTarget = (input: {
  entryFlowIntent?: NocodeEditorFlowEntryIntent | null
  pendingFlowIntent?: unknown
}): NocodeEditorFlowEntryIntent | null => {
  const entryFlowIntent = normalizeEntryFlowIntent(input.entryFlowIntent)
  if (entryFlowIntent?.state !== 'explicit_positive') {
    return entryFlowIntent
  }
  if (normalizeText(entryFlowIntent.targetFormName)) {
    return entryFlowIntent
  }
  const pendingFlowIntent = normalizeNocodeEditorPendingFlowIntent(input.pendingFlowIntent)
  if (
    !pendingFlowIntent
    || normalizeText(pendingFlowIntent.sourceUserMessage) !== normalizeText(entryFlowIntent.sourceUserMessage)
    || !normalizeText(pendingFlowIntent.targetFormName)
  ) {
    return entryFlowIntent
  }
  return {
    ...entryFlowIntent,
    targetFormName: normalizeText(pendingFlowIntent.targetFormName),
  }
}

// 一条显式流程需求只允许绑定一张目标表单：入口意图已固化目标、或同源既有挂账已绑定过目标时，
// 不允许再向另一张表单重建挂账（否则表单切换后会把原始需求里的流程要求错误带过去）。
export const shouldBlockNocodeEditorPendingFlowIntentRebind = (input: {
  entryFlowIntent?: NocodeEditorFlowEntryIntent | null
  existingPendingFlowIntent?: unknown
  candidateTargetFormId?: unknown
  candidateTargetFormName?: unknown
}) => {
  const entryFlowIntent = normalizeEntryFlowIntent(input.entryFlowIntent)
  if (entryFlowIntent?.state !== 'explicit_positive') {
    return false
  }
  const existingPendingFlowIntent = normalizeNocodeEditorPendingFlowIntent(
    input.existingPendingFlowIntent,
  )
  const candidateTargetFormId = normalizeText(input.candidateTargetFormId)
  const candidateTargetFormName = normalizeText(input.candidateTargetFormName)

  const entryTargetFormName = normalizeText(entryFlowIntent.targetFormName)
  if (
    entryTargetFormName
    && candidateTargetFormName
    && entryTargetFormName !== candidateTargetFormName
  ) {
    return true
  }

  const existingSourceUserMessage = normalizeText(existingPendingFlowIntent?.sourceUserMessage)
  if (
    !existingSourceUserMessage
    || existingSourceUserMessage !== normalizeText(entryFlowIntent.sourceUserMessage)
  ) {
    return false
  }
  const existingTargetFormId = normalizeText(existingPendingFlowIntent?.targetFormId)
  if (existingTargetFormId && candidateTargetFormId) {
    return existingTargetFormId !== candidateTargetFormId
  }
  const existingTargetFormName = normalizeText(existingPendingFlowIntent?.targetFormName)
  return Boolean(
    existingTargetFormName
    && candidateTargetFormName
    && existingTargetFormName !== candidateTargetFormName,
  )
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

// 挂账是“某张表单上还没落地的流程要求”：只有目标身份能对上时才属于这张表单。
// 任一侧缺少身份都无法确认归属，按“不属于”处理（安全态），避免把旧表单的
// 流程要求续跑到另一张表单上。
export const isNocodeEditorPendingFlowIntentForTarget = (input: {
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
  if (!pendingTargetFormId && !pendingTargetFormName) {
    return false
  }
  const targetFormId = normalizeText(input.targetFormId)
  const targetFormName = normalizeText(input.targetFormName)
  if (!targetFormId && !targetFormName) {
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
