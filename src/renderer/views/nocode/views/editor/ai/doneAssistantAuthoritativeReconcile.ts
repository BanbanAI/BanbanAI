import {
  reconcileNocodeEditorAiMessageHistory,
} from '../../../../../../common/utils/nocodeEditorAiMessageHistory'

type DoneAssistantHistoryMessage = {
  id?: unknown
  role?: unknown
  sequence?: unknown
  traceId?: unknown
  metadata?: Record<string, unknown> | null
}

type ReconcileDoneAssistantAuthoritativeMessagesInput<
  T extends DoneAssistantHistoryMessage,
> = {
  current: T[]
  loaded: T[]
  optimisticAssistantId?: string | null
  authoritativeAssistantMessageId?: string | null
  assistantMessageId?: string
}

const normalizeMessageId = (value: unknown) => String(value || '').trim()
const normalizeTraceId = (value: unknown) => String(value || '').trim()
const normalizePositiveSequence = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null
}

const findAssistantMessageById = <T extends DoneAssistantHistoryMessage>(
  messages: T[],
  messageId: string,
) => messages.find(message => (
    isAssistantMessage(message)
    && normalizeMessageId(message.id) === messageId
  ))

const inferAuthoritativeAssistantMessageIdFromOptimisticAssistant = (
  input: ReconcileDoneAssistantAuthoritativeMessagesInput<DoneAssistantHistoryMessage>,
) => {
  const optimisticAssistantId = normalizeMessageId(input.optimisticAssistantId)
  if (!optimisticAssistantId) {
    return ''
  }

  const currentOptimisticAssistant = findAssistantMessageById(
    input.current || [],
    optimisticAssistantId,
  )
  if (!currentOptimisticAssistant) {
    return ''
  }

  const optimisticAssistantMessageId = normalizeMessageId(
    currentOptimisticAssistant.metadata?.assistantMessageId,
  )
  if (optimisticAssistantMessageId) {
    return optimisticAssistantMessageId
  }

  const optimisticTraceId = getTraceId(currentOptimisticAssistant)
  if (!optimisticTraceId) {
    return ''
  }

  let inferredAuthoritativeAssistant: DoneAssistantHistoryMessage | null = null
  for (const message of input.loaded || []) {
    if (!isAssistantMessage(message) || !hasAuthoritativeSequence(message)) {
      continue
    }
    if (getTraceId(message) !== optimisticTraceId) {
      continue
    }
    inferredAuthoritativeAssistant = message
  }

  return normalizeMessageId(inferredAuthoritativeAssistant?.id)
}

const resolveAuthoritativeAssistantMessageId = (
  input: ReconcileDoneAssistantAuthoritativeMessagesInput<DoneAssistantHistoryMessage>,
) => {
  const explicitAuthoritativeAssistantMessageId = (
    normalizeMessageId(input.authoritativeAssistantMessageId)
    || normalizeMessageId(input.assistantMessageId)
  )
  if (explicitAuthoritativeAssistantMessageId) {
    return explicitAuthoritativeAssistantMessageId
  }

  return inferAuthoritativeAssistantMessageIdFromOptimisticAssistant(input)
}

const isAssistantMessage = (message: DoneAssistantHistoryMessage | undefined) => (
  String(message?.role || '').trim() === 'assistant'
)

export const discardNocodeEditorInternalContinuationDeduplicatedAssistant = <
    T extends DoneAssistantHistoryMessage,
>(input: {
  messages: T[]
  optimisticAssistantId?: string | null
}) => {
  const optimisticAssistantId = normalizeMessageId(input.optimisticAssistantId)
  if (!optimisticAssistantId) {
    return input.messages
  }

  return input.messages.filter(message => (
    !isAssistantMessage(message)
    || normalizeMessageId(message.id) !== optimisticAssistantId
  ))
}

const isUserMessage = (message: DoneAssistantHistoryMessage | undefined) => (
  String(message?.role || '').trim() === 'user'
)

const getTraceId = (message: DoneAssistantHistoryMessage | undefined) => (
  normalizeTraceId(message?.traceId || message?.metadata?.traceId)
)

const hasAuthoritativeSequence = (message: DoneAssistantHistoryMessage | undefined) => (
  normalizePositiveSequence(message?.sequence) !== null
)

const isCurrentTurnOptimisticAssistant = <T extends DoneAssistantHistoryMessage>(
  message: T,
  options: {
    optimisticAssistantId: string
    authoritativeAssistantMessageId: string
  },
) => {
  if (!isAssistantMessage(message)) {
    return false
  }

  const messageId = normalizeMessageId(message.id)
  if (messageId && messageId === options.authoritativeAssistantMessageId) {
    return true
  }

  if (options.optimisticAssistantId) {
    return messageId === options.optimisticAssistantId
  }

  return normalizeMessageId(message.metadata?.assistantMessageId) === options.authoritativeAssistantMessageId
}

const findAuthoritativeTurnUser = <T extends DoneAssistantHistoryMessage>(
  loaded: T[],
  authoritativeAssistantMessageId: string,
) => {
  const authoritativeAssistantIndex = loaded.findIndex(message => (
    isAssistantMessage(message)
    && normalizeMessageId(message.id) === authoritativeAssistantMessageId
  ))
  if (authoritativeAssistantIndex < 0) {
    return null
  }

  const authoritativeTraceId = getTraceId(loaded[authoritativeAssistantIndex])
  for (let index = authoritativeAssistantIndex - 1; index >= 0; index -= 1) {
    const message = loaded[index]
    if (!isUserMessage(message)) {
      continue
    }
    const messageTraceId = getTraceId(message)
    if (!authoritativeTraceId || !messageTraceId || messageTraceId === authoritativeTraceId) {
      return message
    }
  }
  return null
}

const findCurrentTurnOptimisticAssistantIndex = <T extends DoneAssistantHistoryMessage>(
  current: T[],
  options: {
    optimisticAssistantId: string
    authoritativeAssistantMessageId: string
  },
) => current.findIndex(message => isCurrentTurnOptimisticAssistant(message, options))

const findCurrentTurnUserIndex = <T extends DoneAssistantHistoryMessage>(
  current: T[],
  assistantIndex: number,
  traceId: string,
) => {
  if (assistantIndex < 0) {
    return -1
  }

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = current[index]
    if (!isUserMessage(message)) {
      continue
    }
    const messageTraceId = getTraceId(message)
    if (!traceId || !messageTraceId || messageTraceId === traceId) {
      return index
    }
  }
  return -1
}

const collectPreTurnLocalMessageIds = <T extends DoneAssistantHistoryMessage>(
  current: T[],
  currentTurnStartIndex: number,
) => {
  const ids: string[] = []
  if (currentTurnStartIndex <= 0) {
    return ids
  }

  for (let index = 0; index < currentTurnStartIndex; index += 1) {
    const message = current[index]
    const id = normalizeMessageId(message.id)
    if (!id || hasAuthoritativeSequence(message)) {
      continue
    }
    ids.push(id)
  }
  return ids
}

const movePreTurnLocalMessagesBeforeAuthoritativeTurn = <T extends DoneAssistantHistoryMessage & {
  id?: unknown
}>(options: {
  messages: T[]
  current: T[]
  preTurnLocalMessageIds: string[]
  authoritativeAssistantMessageId: string
  authoritativeTraceId: string
}) => {
  const preTurnLocalMessageIdSet = new Set(options.preTurnLocalMessageIds)
  if (!preTurnLocalMessageIdSet.size) {
    return options.messages
  }

  const mergedLocalMessagesById = new Map<string, T>()
  for (const message of options.messages) {
    const id = normalizeMessageId(message.id)
    if (!id || !preTurnLocalMessageIdSet.has(id) || hasAuthoritativeSequence(message)) {
      continue
    }
    mergedLocalMessagesById.set(id, message)
  }

  const orderedLocalMessages = options.current
    .map((message) => {
      const id = normalizeMessageId(message.id)
      return id ? mergedLocalMessagesById.get(id) || null : null
    })
    .filter((message): message is T => Boolean(message))

  if (!orderedLocalMessages.length) {
    return options.messages
  }

  const localMessageIdSet = new Set(orderedLocalMessages.map(message => normalizeMessageId(message.id)))
  const withoutLocalMessages = options.messages.filter(message => (
    !localMessageIdSet.has(normalizeMessageId(message.id))
  ))

  const authoritativeAssistantIndex = withoutLocalMessages.findIndex(message => (
    isAssistantMessage(message)
    && normalizeMessageId(message.id) === options.authoritativeAssistantMessageId
  ))
  if (authoritativeAssistantIndex < 0) {
    return options.messages
  }

  let insertionIndex = authoritativeAssistantIndex
  for (let index = authoritativeAssistantIndex - 1; index >= 0; index -= 1) {
    const message = withoutLocalMessages[index]
    if (!isUserMessage(message)) {
      continue
    }
    const messageTraceId = getTraceId(message)
    if (
      !options.authoritativeTraceId
      || !messageTraceId
      || messageTraceId === options.authoritativeTraceId
    ) {
      insertionIndex = index
      break
    }
  }

  return [
    ...withoutLocalMessages.slice(0, insertionIndex),
    ...orderedLocalMessages,
    ...withoutLocalMessages.slice(insertionIndex),
  ]
}

export const reconcileDoneAssistantAuthoritativeMessages = <
  T extends DoneAssistantHistoryMessage & {
    id?: unknown
  },
>(input: ReconcileDoneAssistantAuthoritativeMessagesInput<T>) => {
  const authoritativeAssistantMessageId = resolveAuthoritativeAssistantMessageId(input)
  if (!authoritativeAssistantMessageId) {
    return reconcileNocodeEditorAiMessageHistory({
      current: input.current,
      loaded: input.loaded,
    })
  }

  const authoritativeAssistant = findAssistantMessageById(
    input.loaded || [],
    authoritativeAssistantMessageId,
  )
  if (!authoritativeAssistant) {
    return reconcileNocodeEditorAiMessageHistory({
      current: input.current,
      loaded: input.loaded,
    })
  }

  const optimisticAssistantId = normalizeMessageId(input.optimisticAssistantId)
  const current = input.current || []
  const loaded = input.loaded || []
  const currentTurnAssistantOptions = {
    optimisticAssistantId,
    authoritativeAssistantMessageId,
  }
  const currentTurnAssistantIndex = findCurrentTurnOptimisticAssistantIndex(
    current,
    currentTurnAssistantOptions,
  )
  const authoritativeTraceId = getTraceId(authoritativeAssistant)
  const currentTurnUserIndex = findCurrentTurnUserIndex(
    current,
    currentTurnAssistantIndex,
    authoritativeTraceId || getTraceId(current[currentTurnAssistantIndex]),
  )
  const currentTurnStartIndex = currentTurnUserIndex >= 0
    ? currentTurnUserIndex
    : currentTurnAssistantIndex
  const preTurnLocalMessageIds = collectPreTurnLocalMessageIds(current, currentTurnStartIndex)
  const authoritativeTurnUser = findAuthoritativeTurnUser(loaded, authoritativeAssistantMessageId)

  const filteredCurrent = current.filter((message, index) => (
    !(authoritativeTurnUser && index === currentTurnUserIndex)
    && !isCurrentTurnOptimisticAssistant(message, {
      optimisticAssistantId,
      authoritativeAssistantMessageId,
    })
  ))
  const merged = reconcileNocodeEditorAiMessageHistory({
    current: filteredCurrent,
    loaded,
  })

  return movePreTurnLocalMessagesBeforeAuthoritativeTurn({
    messages: merged,
    current,
    preTurnLocalMessageIds,
    authoritativeAssistantMessageId,
    authoritativeTraceId,
  })
}
