export type NocodeEditorAiTaskSeed = {
  taskId: string
  source: 'builder-home' | 'builder-editor' | 'manual-reset' | 'resume'
  createdAt: number
}

export type NocodeEditorAiTaskStoreValue = NocodeEditorAiTaskSeed & {
  accountId: string
  nocodeId: string
  conversationId: string
  scopeKey: string
  updatedAt: number
}

type NocodeEditorAiTaskRestoreValue = {
  conversationId?: unknown
  scopeKey?: unknown
}

const normalizeTaskPart = (value: unknown) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '')

const normalizeTimestamp = (value: unknown, fallback = Date.now()) => {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) {
    return Math.max(0, Math.round(fallback))
  }
  return Math.max(0, Math.round(normalized))
}

export const buildNocodeEditorAiTaskConversationId = (value: {
  accountId?: unknown
  nocodeId?: unknown
  taskId?: unknown
}) => {
  const accountId = normalizeTaskPart(value.accountId)
  const nocodeId = normalizeTaskPart(value.nocodeId)
  const taskId = normalizeTaskPart(value.taskId)
  if (!accountId || !nocodeId || !taskId) {
    return ''
  }
  return `editor_${nocodeId}_${accountId}_${taskId}`
}

export const buildNocodeEditorAiTaskStorageKey = (value: {
  accountId?: unknown
  nocodeId?: unknown
}) => {
  const accountId = normalizeTaskPart(value.accountId)
  const nocodeId = normalizeTaskPart(value.nocodeId)
  if (!accountId || !nocodeId) {
    return ''
  }
  return `nocode-editor-ai-task:${accountId}:${nocodeId}`
}

export const shouldReuseNocodeEditorAiCurrentConversationForTask = (value: {
  currentConversationId?: string | null
  legacyConversationId?: string | null
  hasTaskSeed?: boolean
}) => {
  const currentConversationId = String(value.currentConversationId || '').trim()
  const legacyConversationId = String(value.legacyConversationId || '').trim()

  return Boolean(
    !value.hasTaskSeed
    && currentConversationId
    && legacyConversationId
    && currentConversationId === legacyConversationId
  )
}

export const resolveNocodeEditorAiBoundConversationId = (value: {
  currentConversationId?: string | null
  taskConversationId?: string | null
}) => {
  const currentConversationId = String(value.currentConversationId || '').trim()
  const taskConversationId = String(value.taskConversationId || '').trim()

  return currentConversationId || taskConversationId
}

export const createNextNocodeEditorTaskSeed = (
  now = Date.now(),
  source: NocodeEditorAiTaskSeed['source'] = 'manual-reset',
): NocodeEditorAiTaskSeed => {
  const createdAt = normalizeTimestamp(now)
  return {
    taskId: `task_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    createdAt,
  }
}

export const resolveNocodeEditorAiSubmitTaskSource = (value: {
  taskSeed?: Pick<NocodeEditorAiTaskSeed, 'taskId' | 'source'> | null
  aiEntrySource?: string | null
}): NocodeEditorAiTaskSeed['source'] => {
  if (value.taskSeed?.taskId) {
    return value.taskSeed.source
  }
  if (
    value.aiEntrySource === 'builder-home'
    || value.aiEntrySource === 'builder-editor'
  ) {
    return value.aiEntrySource
  }
  return 'resume'
}

export const shouldSkipNocodeEditorAiConversationReset = (value: {
  previousConversationId?: string | null
  nextConversationId?: string | null
  isInitializingConversation?: boolean
  pendingBootstrapReason?: string | null
}) => {
  if (value.nextConversationId === value.previousConversationId) {
    return true
  }
  if (value.isInitializingConversation) {
    return true
  }
  if (value.pendingBootstrapReason === 'submit-bootstrap') {
    return true
  }
  return false
}

export const shouldStartNewNocodeEditorConversationForImportedHandoff = (value: {
  currentConversationId?: string | null
  currentNocodeId?: unknown
  targetNocodeId?: unknown
  forceNewConversation?: boolean
}) => {
  if (value.forceNewConversation === true) {
    return true
  }

  const currentConversationId = String(value.currentConversationId || '').trim()
  if (!currentConversationId) {
    return true
  }

  const currentNocodeId = normalizeTaskPart(value.currentNocodeId)
  const targetNocodeId = normalizeTaskPart(value.targetNocodeId)
  if (currentNocodeId && targetNocodeId && currentNocodeId !== targetNocodeId) {
    return true
  }

  return false
}

export const resolveNocodeEditorTaskScopeKey = (value: {
  nocodeId?: unknown
  mode?: unknown
  activeFormId?: unknown
}) => {
  const nocodeId = normalizeTaskPart(value.nocodeId)
  const mode = String(value.mode || '').trim()
  const activeFormId = normalizeTaskPart(value.activeFormId)
  if (!nocodeId) {
    return ''
  }
  if (mode === 'form-design' && activeFormId) {
    return `${nocodeId}:form:${activeFormId}`
  }
  return `${nocodeId}:app`
}

export const resolveNocodeEditorTaskScopeKeyFromContext = (value: {
  nocodeId?: unknown
  mode?: unknown
  activeFormId?: unknown
  currentActiveId?: unknown
  routeActiveId?: unknown
  availableFormIds?: unknown[]
}) => {
  const availableFormIds = Array.isArray(value.availableFormIds)
    ? value.availableFormIds
      .map(item => normalizeTaskPart(item))
      .filter(Boolean)
    : []
  const availableFormIdSet = new Set(availableFormIds)
  const routeActiveId = normalizeTaskPart(value.routeActiveId)
  const currentActiveId = normalizeTaskPart(value.currentActiveId)
  let mode = String(value.mode || '').trim()
  let activeFormId = normalizeTaskPart(value.activeFormId)

  const isKnownFormId = (input: string) => Boolean(
    input
    && (!availableFormIdSet.size || availableFormIdSet.has(input))
  )

  if (!activeFormId) {
    activeFormId = [routeActiveId, currentActiveId].find(isKnownFormId) || ''
  }

  if (isKnownFormId(activeFormId)) {
    mode = 'form-design'
  }

  return resolveNocodeEditorTaskScopeKey({
    nocodeId: value.nocodeId,
    mode,
    activeFormId,
  })
}

export const pickNocodeEditorAiTaskRestoreCandidate = <
  TStored extends NocodeEditorAiTaskRestoreValue | null | undefined,
  TLatest extends NocodeEditorAiTaskRestoreValue | null | undefined,
>(value: {
  currentScopeKey?: unknown
  storedTask?: TStored
  latestConversation?: TLatest
}) => {
  const currentScopeKey = String(value.currentScopeKey || '').trim()
  const storedTask = value.storedTask
  const latestConversation = value.latestConversation
  const storedScopeKey = String(storedTask?.scopeKey || '').trim()
  const latestScopeKey = String(latestConversation?.scopeKey || '').trim()
  const storedConversationId = String(storedTask?.conversationId || '').trim()
  const latestConversationId = String(latestConversation?.conversationId || '').trim()

  if (currentScopeKey) {
    if (storedConversationId && storedScopeKey === currentScopeKey) {
      return storedTask || null
    }
    if (latestConversationId && latestScopeKey === currentScopeKey) {
      return latestConversation || null
    }
  }

  if (storedConversationId) {
    return storedTask || null
  }
  if (latestConversationId) {
    return latestConversation || null
  }
  return null
}
