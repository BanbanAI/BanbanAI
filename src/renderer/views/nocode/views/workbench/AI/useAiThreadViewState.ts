import { computed, ref } from 'vue'
import type { AiMessage, AiThreadSummary } from './types'
import type { AiExcelAnalysisContext } from '@common/types/aiExcelAnalysis'
import type { AiExcelImportSourceInstance } from '@common/utils/aiExcelCreateFormState'

type AiThreadViewModelSelectionSource = NonNullable<AiThreadSummary['modelSelectionSource']>

type AiThreadViewState = {
  threadId: string
  agentId: string
  appIds: string[]
  modelSelectionSource: AiThreadViewModelSelectionSource
  providerId: string
  modelId: string
  model: string
  sharing: boolean
  shareToken: string
  runtimeState: AiThreadSummary['runtimeState']
  messages: AiMessage[]
  isAssistantResponding: boolean
  isInitialLoading: boolean
  messageOffset: number
  hasMoreHistory: boolean
  isLoadingHistory: boolean
  activeAssistantMessageId: string
  activeExcelAnalysisContext: AiExcelAnalysisContext | null
  pendingCreateRouteExcelByTraceId: Record<string, AiExcelImportSourceInstance>
}

type UseAiThreadViewStateOptions = {
  emitThreadChange: (threadId: string) => void
  normalizeIdList: (value?: string[] | null) => string[]
}

const DRAFT_THREAD_STATE_KEY = '__draft__'
const DEFAULT_MODEL_SELECTION_SOURCE: AiThreadViewModelSelectionSource = 'default'
const DRAFT_MODEL_SELECTION_SOURCE: AiThreadViewModelSelectionSource = 'explicit'

const normalizeModelSelectionSource = (
  value?: string | null,
): AiThreadViewModelSelectionSource => (
  String(value || '').trim().toLowerCase() === 'explicit'
    ? 'explicit'
    : DEFAULT_MODEL_SELECTION_SOURCE
)

const hasResolvedModelSelection = (
  selection?: Pick<AiThreadSummary, 'providerId' | 'modelId' | 'model'> | null,
) => Boolean(
  String(selection?.providerId || '').trim()
  || String(selection?.modelId || '').trim()
  || String(selection?.model || '').trim(),
)

const applyThreadModelSelectionState = (
  state: Pick<AiThreadViewState, 'modelSelectionSource' | 'providerId' | 'modelId' | 'model'>,
  selection?: Pick<AiThreadSummary, 'providerId' | 'modelId' | 'model'> | null,
  source?: AiThreadSummary['modelSelectionSource'],
) => {
  const normalizedSource = normalizeModelSelectionSource(source)
  state.modelSelectionSource = normalizedSource
  if (normalizedSource !== 'explicit') {
    state.providerId = ''
    state.modelId = ''
    state.model = ''
    return
  }
  state.providerId = String(selection?.providerId || '').trim()
  state.modelId = String(selection?.modelId || '').trim()
  state.model = String(selection?.model || '').trim()
}

const syncThreadModelSelectionState = (
  state: Pick<AiThreadViewState, 'modelSelectionSource' | 'providerId' | 'modelId' | 'model'>,
  thread?: Pick<AiThreadSummary, 'providerId' | 'modelId' | 'model' | 'modelSelectionSource'> | null,
) => {
  if (
    thread?.providerId === undefined
    && thread?.modelId === undefined
    && thread?.model === undefined
    && thread?.modelSelectionSource === undefined
  ) {
    return
  }
  if (thread?.modelSelectionSource == null) {
    if (state.modelSelectionSource === 'explicit' && hasResolvedModelSelection(thread)) {
      applyThreadModelSelectionState(state, thread, 'explicit')
    }
    return
  }
  applyThreadModelSelectionState(state, thread, thread?.modelSelectionSource)
}

const syncStreamModelSelectionState = (
  state: Pick<AiThreadViewState, 'modelSelectionSource' | 'providerId' | 'modelId' | 'model'>,
  selection?: Pick<AiThreadSummary, 'providerId' | 'modelId' | 'model'> | null,
  source?: AiThreadSummary['modelSelectionSource'],
) => {
  const hasResolvedSelection = hasResolvedModelSelection(selection)
  if (!hasResolvedSelection || (source == null && state.modelSelectionSource !== 'explicit')) {
    return
  }
  applyThreadModelSelectionState(state, selection, source || 'explicit')
}

const buildThreadModelSelectionRequest = (
  state: Pick<AiThreadViewState, 'modelSelectionSource' | 'providerId' | 'modelId' | 'model'>,
) => {
  if (state.modelSelectionSource !== 'explicit') {
    return {}
  }

  return {
    providerId: state.providerId || undefined,
    modelId: state.modelId || undefined,
    model: state.model || undefined,
  }
}

const ensureDraftThreadModelSelectionState = (
  state: Pick<AiThreadViewState, 'threadId' | 'modelSelectionSource' | 'providerId' | 'modelId' | 'model'>,
) => {
  if (String(state.threadId || '').trim()) {
    return
  }
  applyThreadModelSelectionState(state, null, DRAFT_MODEL_SELECTION_SOURCE)
}

const createThreadViewState = (threadId = ''): AiThreadViewState => ({
  threadId,
  agentId: '',
  appIds: [],
  modelSelectionSource: DRAFT_MODEL_SELECTION_SOURCE,
  providerId: '',
  modelId: '',
  model: '',
  sharing: false,
  shareToken: '',
  runtimeState: null,
  messages: [],
  isAssistantResponding: false,
  isInitialLoading: false,
  messageOffset: 0,
  hasMoreHistory: false,
  isLoadingHistory: false,
  activeAssistantMessageId: '',
  activeExcelAnalysisContext: null,
  pendingCreateRouteExcelByTraceId: {},
})

export const useAiThreadViewState = (options: UseAiThreadViewStateOptions) => {
  const threadViewStateMap = new Map<string, AiThreadViewState>()
  const currentThreadStateKey = ref(DRAFT_THREAD_STATE_KEY)
  const currentViewState = ref(createThreadViewState())
  const activeStreamState = ref<AiThreadViewState | null>(null)
  const activeStreamStateKey = ref('')

  threadViewStateMap.set(DRAFT_THREAD_STATE_KEY, currentViewState.value)

  const normalizeThreadStateKey = (threadId?: string | null) => String(threadId || '').trim() || DRAFT_THREAD_STATE_KEY

  const ensureThreadViewState = (threadId?: string | null) => {
    const normalizedThreadId = String(threadId || '').trim()
    const threadStateKey = normalizeThreadStateKey(normalizedThreadId)
    const existingState = threadViewStateMap.get(threadStateKey)
    if (existingState) {
      if (!existingState.threadId && normalizedThreadId) {
        existingState.threadId = normalizedThreadId
      }
      return existingState
    }

    const nextState = createThreadViewState(normalizedThreadId)
    threadViewStateMap.set(threadStateKey, nextState)
    return nextState
  }

  const switchCurrentThreadState = (threadId?: string | null) => {
    const nextThreadStateKey = normalizeThreadStateKey(threadId)
    currentThreadStateKey.value = nextThreadStateKey
    currentViewState.value = ensureThreadViewState(threadId)
  }

  const updateThreadViewStateId = (
    state: AiThreadViewState,
    threadId?: string | null,
    updateOptions?: { emitThreadChange?: boolean },
  ) => {
    const normalizedThreadId = String(threadId || '').trim()
    const previousThreadId = state.threadId
    const threadIdChanged = previousThreadId !== normalizedThreadId
    const previousThreadStateKey = normalizeThreadStateKey(previousThreadId)
    const nextThreadStateKey = normalizeThreadStateKey(normalizedThreadId)

    if (previousThreadStateKey !== nextThreadStateKey) {
      threadViewStateMap.delete(previousThreadStateKey)
      threadViewStateMap.set(nextThreadStateKey, state)
      if (currentThreadStateKey.value === previousThreadStateKey) {
        currentThreadStateKey.value = nextThreadStateKey
      }
      if (activeStreamStateKey.value === previousThreadStateKey) {
        activeStreamStateKey.value = nextThreadStateKey
      }
    }

    state.threadId = normalizedThreadId

    if (threadIdChanged && updateOptions?.emitThreadChange && currentViewState.value === state) {
      options.emitThreadChange(normalizedThreadId)
    }
  }

  const resetThreadViewState = (state: AiThreadViewState) => {
    state.agentId = ''
    state.appIds = []
    applyThreadModelSelectionState(state, null, DRAFT_MODEL_SELECTION_SOURCE)
    state.sharing = false
    state.shareToken = ''
    state.runtimeState = null
    state.messages = []
    state.isAssistantResponding = false
    state.isInitialLoading = false
    state.messageOffset = 0
    state.hasMoreHistory = false
    state.isLoadingHistory = false
    state.activeAssistantMessageId = ''
    state.activeExcelAnalysisContext = null
    state.pendingCreateRouteExcelByTraceId = {}
  }

  const resolveThreadViewStateByStateKey = (threadStateKey?: string | null) => (
    threadStateKey
      ? threadViewStateMap.get(threadStateKey) || null
      : null
  )

  const resolveActiveStreamViewState = () => activeStreamState.value || resolveThreadViewStateByStateKey(activeStreamStateKey.value)

  const createCurrentViewStateField = <K extends keyof AiThreadViewState>(
    key: K,
    set?: (state: AiThreadViewState, value: AiThreadViewState[K]) => void,
  ) => computed({
      get: () => currentViewState.value[key],
      set: (value: AiThreadViewState[K]) => {
        if (set) {
          set(currentViewState.value, value)
          return
        }
        currentViewState.value[key] = value
      },
    })

  const curAiMessageList = createCurrentViewStateField('messages')
  const isAssistantResponding = createCurrentViewStateField('isAssistantResponding')
  const isInitialLoading = createCurrentViewStateField('isInitialLoading')
  const currentThreadId = createCurrentViewStateField('threadId', (state, value) => {
    updateThreadViewStateId(state, value, {
      emitThreadChange: true,
    })
  })
  const currentAgentId = createCurrentViewStateField('agentId')
  const currentThreadAppIds = createCurrentViewStateField('appIds')
  const currentThreadModelSelectionSource = createCurrentViewStateField('modelSelectionSource')
  const currentThreadProviderId = createCurrentViewStateField('providerId')
  const currentThreadModelId = createCurrentViewStateField('modelId')
  const currentThreadModel = createCurrentViewStateField('model')
  const currentThreadSharing = createCurrentViewStateField('sharing')
  const currentThreadShareToken = createCurrentViewStateField('shareToken')
  const messageOffset = createCurrentViewStateField('messageOffset')
  const hasMoreHistory = createCurrentViewStateField('hasMoreHistory')
  const isLoadingHistory = createCurrentViewStateField('isLoadingHistory')
  const activeAssistantMessageId = createCurrentViewStateField('activeAssistantMessageId')
  const activeExcelAnalysisContext = createCurrentViewStateField('activeExcelAnalysisContext')

  const syncThreadViewState = (
    state: AiThreadViewState,
    thread?: Partial<AiThreadSummary>,
    syncOptions?: { emitThreadChange?: boolean },
  ) => {
    if (thread?.id !== undefined) {
      updateThreadViewStateId(state, thread.id, {
        emitThreadChange: syncOptions?.emitThreadChange,
      })
    }
    if (thread?.agentId !== undefined) {
      state.agentId = String(thread.agentId || '').trim()
    }
    if (thread?.appScope !== undefined) {
      state.appIds = options.normalizeIdList(thread.appScope?.appIds)
    }
    syncThreadModelSelectionState(state, thread)
    if (thread?.sharing !== undefined) {
      state.sharing = Boolean(thread.sharing)
    }
    if (thread?.shareToken !== undefined) {
      state.shareToken = String(thread.shareToken || '').trim()
    }
    if (thread?.runtimeState !== undefined) {
      state.runtimeState = thread.runtimeState || null
    }
  }

  const syncCurrentThread = (thread?: Partial<AiThreadSummary>) => {
    syncThreadViewState(currentViewState.value, thread, {
      emitThreadChange: true,
    })
  }

  const resolveShareVisitorMetadata = () => {
    const referrer = typeof document === 'undefined'
      ? ''
      : String(document.referrer || '').trim()
    const platform = typeof navigator === 'undefined'
      ? ''
      : String(navigator.platform || '').trim()
    const language = typeof navigator === 'undefined'
      ? ''
      : String(navigator.language || navigator.languages?.[0] || '').trim()

    let embedded = false
    if (typeof window !== 'undefined') {
      try {
        embedded = window.self !== window.top
      } catch {
        embedded = true
      }
    }

    return {
      referrer,
      embedded,
      platform,
      language,
      pageOrigin: typeof window === 'undefined'
        ? ''
        : String(window.location.origin || '').trim(),
    }
  }

  return {
    activeAssistantMessageId,
    activeExcelAnalysisContext,
    activeStreamState,
    activeStreamStateKey,
    curAiMessageList,
    currentAgentId,
    currentThreadAppIds,
    currentThreadModel,
    currentThreadModelId,
    currentThreadModelSelectionSource,
    currentThreadProviderId,
    currentThreadId,
    currentThreadShareToken,
    currentThreadSharing,
    currentViewState,
    ensureThreadViewState,
    hasMoreHistory,
    isAssistantResponding,
    isInitialLoading,
    isLoadingHistory,
    messageOffset,
    normalizeThreadStateKey,
    resetThreadViewState,
    resolveActiveStreamViewState,
    resolveShareVisitorMetadata,
    switchCurrentThreadState,
    syncCurrentThread,
    syncThreadViewState,
    updateThreadViewStateId,
  }
}

export {
  applyThreadModelSelectionState,
  buildThreadModelSelectionRequest,
  ensureDraftThreadModelSelectionState,
  normalizeModelSelectionSource,
  syncStreamModelSelectionState,
}

export type { AiThreadViewState, AiThreadViewModelSelectionSource }
