import {
  findNocodeEditorArtifactBlockMergeIndex,
  getNocodeEditorArtifactBlockMergeKey,
  getNocodeEditorBlueprintArtifactIdentityKey,
  getNocodeEditorBlueprintArtifactScopedIdentityKey,
  isNocodeEditorArtifactBlock,
  normalizeNocodeEditorArtifactBlockSelections,
  normalizeNocodeEditorArtifactBlocks,
} from './nocodeEditorArtifactBlocks'
import {
  mergeNocodeEditorFormulaActions,
  mergeNocodeEditorFormulaTargetResults,
} from './nocodeEditorFormulaActions'
import {
  buildLogicalPlanningConfirmationContextKey,
  isSamePlanningConfirmationContext,
} from './nocodeEditorPlanningConfirmationIdentity'

type NocodeEditorHistoryMessageLike = {
  id?: unknown
  role?: unknown
  content?: unknown
  sequence?: unknown
  createTime?: unknown
  traceId?: unknown
  metadata?: Record<string, unknown> | null
}

const normalizeTraceId = (value: unknown) => String(value || '').trim()
const normalizeContent = (value: unknown) => String(value || '').trim()
const normalizeSummaryStage = (value: unknown) => String(value || '').trim().toLowerCase()
const OPTIMISTIC_USER_RECONCILE_MAX_TIME_GAP_MS = 5000
const TRANSIENT_FAILED_APP_PLAN_NO_FORM_SUMMARY = '应用规划暂存失败：规划至少需要包含一个表单'
const APP_PLAN_SUCCESS_SUMMARY_MARKERS = [
  '已暂存成功',
  '应用结构预览已暂存',
]
const APP_PLAN_PENDING_CONFIRMATION_MARKERS = [
  '我会先停在应用规划确认阶段',
]
const normalizeArtifactSummaryStage = (value: unknown) => {
  const kind = String(value || '').trim()
  if (
    kind === 'app-plan'
    || kind === 'form-plan'
    || kind === 'content-plan'
    || kind === 'flow-scheme'
    || kind === 'flow-plan'
    || kind === 'blueprint'
  ) {
    return kind
  }
  return ''
}

const getTraceId = (message: NocodeEditorHistoryMessageLike) => (
  normalizeTraceId(message?.traceId || message?.metadata?.traceId)
)

const inferSummaryStageFromBlocks = (message: NocodeEditorHistoryMessageLike) => {
  const blocks = Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks : []
  const stages = new Set<string>()
  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      continue
    }
    const stage = normalizeArtifactSummaryStage((block as Record<string, unknown>).kind)
    if (stage) {
      stages.add(stage)
    }
  }
  return stages.size === 1 ? [...stages][0] : ''
}

const getSummaryStage = (message: NocodeEditorHistoryMessageLike) => (
  normalizeSummaryStage(message?.metadata?.summaryStage)
  || inferSummaryStageFromBlocks(message)
)

const isAssistantMessage = (message: NocodeEditorHistoryMessageLike) => (
  String(message?.role || '').trim() === 'assistant'
)

const isUserMessage = (message: NocodeEditorHistoryMessageLike) => (
  String(message?.role || '').trim() === 'user'
)

const isToolResultSummaryMessage = (message: NocodeEditorHistoryMessageLike) => (
  Boolean(message?.metadata?.toolResultSummary)
)

const isHiddenFromTimelineMessage = (message: NocodeEditorHistoryMessageLike) => (
  Boolean(message?.metadata?.hiddenFromTimeline)
)

const hasArrayPayload = (value: unknown) => (
  Array.isArray(value) && value.length > 0
)

const hasObjectPayload = (value: unknown) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const isResolvedDraftPersistenceState = (value: unknown) => (
  isRecord(value) && value.resolved === true
)

const isHiddenDraftIssueCompletionSyncMessage = (message: NocodeEditorHistoryMessageLike) => (
  isHiddenFromTimelineMessage(message)
  && Boolean(message?.metadata?.draftIssueCompletionSync)
)

const isHiddenFlowIssueCompletionSyncMessage = (message: NocodeEditorHistoryMessageLike) => (
  isHiddenFromTimelineMessage(message)
  && Boolean(message?.metadata?.flowIssueCompletionSync)
)

const getFlowIssueStateUpdatedAt = (value: unknown) => (
  isRecord(value) ? Number(value.updatedAt || value.resolvedAt || 0) || 0 : 0
)

const hasFlowIssueStatePayload = (message: NocodeEditorHistoryMessageLike) => {
  if (isRecord(message?.metadata?.flowIssueActionList)) {
    return true
  }
  if (message?.metadata?.flowAppliedFromAction) {
    return true
  }
  const blocks = Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks : []
  return blocks.some(block => (
    isRecord(block) && isRecord((block as Record<string, unknown>).flowIssueState)
  ))
}

// 流程待补配置补齐后落库的隐藏同步消息：把最新的收敛结果回填到同 trace 的可见消息上
const foldHiddenFlowIssueCompletionSyncStates = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => {
  const latestStateByTraceId = new Map<string, { state: Record<string, unknown>; updatedAt: number }>()
  for (const message of messages) {
    if (!isHiddenFlowIssueCompletionSyncMessage(message)) {
      continue
    }
    const traceId = getTraceId(message)
    const state = message.metadata?.flowIssueActionList
    if (!traceId || !isRecord(state)) {
      continue
    }
    const updatedAt = getFlowIssueStateUpdatedAt(state)
    const existing = latestStateByTraceId.get(traceId)
    if (!existing || updatedAt >= existing.updatedAt) {
      latestStateByTraceId.set(traceId, { state, updatedAt })
    }
  }
  if (!latestStateByTraceId.size) {
    return messages
  }

  let changed = false
  const nextMessages = messages.map((message) => {
    if (
      !isAssistantMessage(message)
      || isHiddenFromTimelineMessage(message)
      || !hasFlowIssueStatePayload(message)
    ) {
      return message
    }
    const traceId = getTraceId(message)
    const folded = traceId ? latestStateByTraceId.get(traceId) : undefined
    if (!folded || getFlowIssueStateUpdatedAt(message.metadata?.flowIssueActionList) >= folded.updatedAt) {
      return message
    }
    changed = true
    return {
      ...message,
      metadata: {
        ...(message.metadata || {}),
        flowIssueActionList: folded.state,
      },
    } as T
  })

  return changed ? nextMessages : messages
}

const isVisibleDraftIssueActionListMessage = (message: NocodeEditorHistoryMessageLike) => (
  !isHiddenFromTimelineMessage(message)
  && isRecord(message?.metadata?.draftIssueActionList)
)

const hasBlueprintArtifactBlock = (blocks: unknown[]) => (
  blocks.some(block => (
    isNocodeEditorArtifactBlock(block)
    && getNocodeEditorArtifactBlockMergeKey(block).startsWith('artifact:blueprint:')
  ))
)

const getDraftPersistenceStateBlueprintIdentityKey = (value: unknown) => (
  isRecord(value) ? normalizeContent(value.sourceBlueprintIdentityKey) : ''
)

const getDraftPersistenceStateSourceTraceId = (value: unknown) => (
  isRecord(value) ? normalizeTraceId(value.sourceTraceId) : ''
)

const getBlueprintApplyParentTraceId = (message: NocodeEditorHistoryMessageLike) => {
  const metadata = isRecord(message?.metadata) ? message.metadata : null
  if (!metadata?.blueprintApplyProgressItem) {
    return ''
  }

  return normalizeTraceId(metadata.blueprintApplyParentTraceId)
}

const hasDraftPersistenceStateMatchingCompletion = (
  candidate: unknown,
  resolvedState: unknown,
) => {
  if (!isRecord(candidate) || !isRecord(resolvedState)) {
    return false
  }

  const resolvedIdentityKey = getDraftPersistenceStateBlueprintIdentityKey(resolvedState)
  const candidateIdentityKey = getDraftPersistenceStateBlueprintIdentityKey(candidate)
  if (resolvedIdentityKey && candidateIdentityKey && resolvedIdentityKey === candidateIdentityKey) {
    return true
  }

  const resolvedSourceTraceId = getDraftPersistenceStateSourceTraceId(resolvedState)
  const candidateSourceTraceId = getDraftPersistenceStateSourceTraceId(candidate)
  if (resolvedSourceTraceId && candidateSourceTraceId && resolvedSourceTraceId === candidateSourceTraceId) {
    return true
  }

  return false
}

const hasRenderableAssistantHistoryPayload = (message: NocodeEditorHistoryMessageLike) => {
  const metadata = message?.metadata || null
  return Boolean(
    hasArrayPayload(metadata?.blocks)
    || hasArrayPayload(metadata?.continuityHints)
    || hasObjectPayload(metadata?.draftIssueActionList)
    || hasObjectPayload(metadata?.appBuilderPlanningOutline)
    || hasArrayPayload(metadata?.appBuilderPlanningArtifacts)
    || normalizeContent(metadata?.appBuilderPlanningSummary),
  )
}

const shouldKeepNocodeEditorAiHistoryMessage = (
  message: NocodeEditorHistoryMessageLike,
) => {
  if (!isAssistantMessage(message) || isHiddenFromTimelineMessage(message)) {
    return true
  }

  if (normalizeContent(message.content)) {
    return true
  }

  return hasRenderableAssistantHistoryPayload(message)
}

const hasSuccessfulAppPlanSummaryMarker = (content: string) => (
  APP_PLAN_SUCCESS_SUMMARY_MARKERS.some(marker => content.includes(marker))
)

const hasAppPlanPendingConfirmationMarker = (content: string) => (
  APP_PLAN_PENDING_CONFIRMATION_MARKERS.some(marker => content.includes(marker))
)

const hasArtifactBlockKind = (
  message: NocodeEditorHistoryMessageLike,
  kind: string,
) => (
  Array.isArray(message?.metadata?.blocks)
  && message.metadata.blocks.some((block) => (
    block
    && typeof block === 'object'
    && !Array.isArray(block)
    && String((block as Record<string, unknown>).kind || '').trim() === kind
  ))
)

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeContent(item)).filter(Boolean)
    : []
)

const hasUnconfirmedConfirmationQuestion = (value: unknown) => (
  Array.isArray(value)
  && value.some(item => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && (item as Record<string, unknown>).confirmed !== true
  ))
)

const hasPendingAppPlanQuestionsInBlocks = (
  message: NocodeEditorHistoryMessageLike,
) => {
  const blocks = Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks : []
  for (const block of blocks) {
    if (
      !block
      || typeof block !== 'object'
      || Array.isArray(block)
      || String((block as Record<string, unknown>).kind || '').trim() !== 'app-plan'
    ) {
      continue
    }

    const record = block as Record<string, unknown>
    const appPlan = record.appPlan && typeof record.appPlan === 'object' && !Array.isArray(record.appPlan)
      ? record.appPlan as Record<string, unknown>
      : null
    if (normalizeStringList(appPlan?.openQuestions).length > 0) {
      return true
    }

    const confirmation = record.confirmation && typeof record.confirmation === 'object' && !Array.isArray(record.confirmation)
      ? record.confirmation as Record<string, unknown>
      : null
    if (
      String(confirmation?.status || '').trim() === 'pending'
      || hasUnconfirmedConfirmationQuestion(confirmation?.questions)
    ) {
      return true
    }
  }
  return false
}

const isTransientFailedAppPlanNoFormSummaryMessage = (
  message: NocodeEditorHistoryMessageLike,
) => {
  if (!isAssistantMessage(message) || isHiddenFromTimelineMessage(message)) {
    return false
  }

  const content = normalizeContent(message.content)
  const summaryStage = getSummaryStage(message)
  if (summaryStage && summaryStage !== 'app-plan') {
    return false
  }

  return Boolean(
    content.includes(TRANSIENT_FAILED_APP_PLAN_NO_FORM_SUMMARY)
    && !hasSuccessfulAppPlanSummaryMarker(content)
    && !hasArtifactBlockKind(message, 'app-plan')
  )
}

const isVisibleSuccessfulAppPlanSummaryMessage = (
  message: NocodeEditorHistoryMessageLike,
) => {
  if (!isAssistantMessage(message) || isHiddenFromTimelineMessage(message)) {
    return false
  }

  if (getSummaryStage(message) !== 'app-plan') {
    return false
  }

  const content = normalizeContent(message.content)
  return Boolean(
    hasSuccessfulAppPlanSummaryMarker(content)
    || hasArtifactBlockKind(message, 'app-plan')
    || message?.metadata?.ok === true
  )
}

const filterTransientFailedAppPlanSummariesBeforeLaterSuccess = <T extends NocodeEditorHistoryMessageLike>(
  messages: T[],
) => {
  const latestVisibleSuccessfulAppPlanIndexByTrace = new Map<string, number>()

  messages.forEach((message, index) => {
    const traceId = getTraceId(message)
    if (!traceId || !isVisibleSuccessfulAppPlanSummaryMessage(message)) {
      return
    }
    latestVisibleSuccessfulAppPlanIndexByTrace.set(traceId, index)
  })

  return messages.filter((message, index) => {
    const traceId = getTraceId(message)
    if (!traceId) {
      return true
    }

    const latestSuccessIndex = latestVisibleSuccessfulAppPlanIndexByTrace.get(traceId)
    if (latestSuccessIndex === undefined || index >= latestSuccessIndex) {
      return true
    }

    return !isTransientFailedAppPlanNoFormSummaryMessage(message)
  })
}

const sanitizeTransientFailedAppPlanSummaryContent = (
  message: NocodeEditorHistoryMessageLike,
  content: string,
) => {
  const normalizedContent = normalizeContent(content)
  const summaryStage = getSummaryStage(message)
  if (
    !normalizedContent.includes(TRANSIENT_FAILED_APP_PLAN_NO_FORM_SUMMARY)
    || !hasSuccessfulAppPlanSummaryMarker(normalizedContent)
    || (summaryStage && summaryStage !== 'app-plan')
  ) {
    return normalizedContent
  }

  const cleanedContent = normalizedContent
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => item !== TRANSIENT_FAILED_APP_PLAN_NO_FORM_SUMMARY)
    .join('\n\n')

  return cleanedContent || normalizedContent
}

const isVisibleFlowPlanSummaryMessage = (
  message: NocodeEditorHistoryMessageLike,
) => (
  isAssistantMessage(message)
  && !isHiddenFromTimelineMessage(message)
  && isToolResultSummaryMessage(message)
  && getSummaryStage(message) === 'flow-plan'
)

const getFlowPlanArtifactBlock = (
  message: NocodeEditorHistoryMessageLike,
) => {
  const blocks = Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks : []
  return blocks.find((block) => (
    isNocodeEditorArtifactBlock(block)
    && String(block.kind || '').trim() === 'flow-plan'
  )) as Record<string, unknown> | undefined
}

const getFlowPlanBlockScopeKey = (
  block?: unknown,
) => {
  if (!isNocodeEditorArtifactBlock(block) || String(block.kind || '').trim() !== 'flow-plan') {
    return ''
  }

  const confirmation = (
    block.confirmation
    && typeof block.confirmation === 'object'
    && !Array.isArray(block.confirmation)
  ) ? block.confirmation as Record<string, unknown> : null
  const explicitPlanningContextKey = normalizeContent(confirmation?.planningContextKey)
  if (explicitPlanningContextKey) {
    return explicitPlanningContextKey
  }

  const flowPlan = (
    block.flowPlan
    && typeof block.flowPlan === 'object'
    && !Array.isArray(block.flowPlan)
  ) ? block.flowPlan as Record<string, unknown> : null
  const target = (
    flowPlan?.target
    && typeof flowPlan.target === 'object'
    && !Array.isArray(flowPlan.target)
  ) ? flowPlan.target as Record<string, unknown> : null
  return buildLogicalPlanningConfirmationContextKey({
    stage: 'flow-plan',
    outlineId: normalizeContent(flowPlan?.id || flowPlan?.title || block.title),
    primaryFormKey: normalizeContent(target?.formId || target?.formName),
  })
}

const getFlowPlanSummaryScopeKey = (
  message: NocodeEditorHistoryMessageLike,
) => {
  const flowBlock = getFlowPlanArtifactBlock(message)
  if (!flowBlock) {
    return ''
  }
  return getFlowPlanBlockScopeKey(flowBlock)
}

const findFlowPlanSummaryScopeEntry = (
  entries: Array<{ scopeKey: string; index: number }>,
  scopeKey: string,
) => (
  entries.find(entry => isSamePlanningConfirmationContext(entry.scopeKey, scopeKey))
)

const collapseSupersededFlowPlanSummaries = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => {
  const latestVisibleFlowPlanSummaryIndexByTrace = new Map<string, number>()
  const latestVisibleFlowPlanSummaryEntries: Array<{ scopeKey: string; index: number }> = []

  messages.forEach((message, index) => {
    if (!isVisibleFlowPlanSummaryMessage(message)) {
      return
    }

    const scopeKey = getFlowPlanSummaryScopeKey(message)
    if (scopeKey) {
      const existingEntry = findFlowPlanSummaryScopeEntry(
        latestVisibleFlowPlanSummaryEntries,
        scopeKey,
      )
      if (existingEntry) {
        existingEntry.scopeKey = scopeKey
        existingEntry.index = index
      } else {
        latestVisibleFlowPlanSummaryEntries.push({
          scopeKey,
          index,
        })
      }
      return
    }

    const traceId = getTraceId(message)
    if (traceId) {
      latestVisibleFlowPlanSummaryIndexByTrace.set(traceId, index)
    }
  })

  return messages.filter((message, index) => {
    if (!isVisibleFlowPlanSummaryMessage(message)) {
      return true
    }

    const scopeKey = getFlowPlanSummaryScopeKey(message)
    if (scopeKey) {
      const latestEntry = findFlowPlanSummaryScopeEntry(
        latestVisibleFlowPlanSummaryEntries,
        scopeKey,
      )
      return !latestEntry || index >= latestEntry.index
    }

    const traceId = getTraceId(message)
    if (!traceId) {
      return true
    }

    const latestIndex = latestVisibleFlowPlanSummaryIndexByTrace.get(traceId)
    return latestIndex === undefined || index >= latestIndex
  })
}

const collapseSupersededFlowPlanBlocks = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => {
  const latestVisibleFlowPlanBlockEntries: Array<{ scopeKey: string; index: number }> = []

  messages.forEach((message, index) => {
    if (!isAssistantMessage(message) || isHiddenFromTimelineMessage(message)) {
      return
    }

    const blocks = Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks : []
    blocks.forEach((block) => {
      const scopeKey = getFlowPlanBlockScopeKey(block)
      if (!scopeKey) {
        return
      }

      const existingEntry = findFlowPlanSummaryScopeEntry(
        latestVisibleFlowPlanBlockEntries,
        scopeKey,
      )
      if (existingEntry) {
        existingEntry.scopeKey = scopeKey
        existingEntry.index = index
      } else {
        latestVisibleFlowPlanBlockEntries.push({
          scopeKey,
          index,
        })
      }
    })
  })

  const nextMessages = [...messages]
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex]
    if (!isAssistantMessage(message) || isHiddenFromTimelineMessage(message)) {
      continue
    }

    const blocks = Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks : []
    if (!blocks.length) {
      continue
    }

    let changed = false
    const nextBlocks = blocks.filter((block) => {
      const scopeKey = getFlowPlanBlockScopeKey(block)
      if (!scopeKey) {
        return true
      }

      const latestEntry = findFlowPlanSummaryScopeEntry(
        latestVisibleFlowPlanBlockEntries,
        scopeKey,
      )
      if (!latestEntry || messageIndex >= latestEntry.index) {
        return true
      }

      changed = true
      return false
    })

    if (!changed) {
      continue
    }

    nextMessages[messageIndex] = {
      ...message,
      metadata: {
        ...(message.metadata || {}),
        blocks: nextBlocks,
      },
    } as T
  }

  return nextMessages
}

const sanitizeHistoryAssistantMessage = <T extends NocodeEditorHistoryMessageLike>(message: T): T => {
  if (!isAssistantMessage(message)) {
    return message
  }

  const nextContent = sanitizeTransientFailedAppPlanSummaryContent(
    message,
    normalizeContent(message.content),
  )

  if (nextContent === normalizeContent(message.content)) {
    return message
  }

  return {
    ...message,
    content: nextContent,
  }
}

// const hasActionResults = (message: NocodeEditorHistoryMessageLike) => (
//   Array.isArray(message?.metadata?.actionResults) && message.metadata.actionResults.length > 0
// )

const countArtifactBlocks = (message: NocodeEditorHistoryMessageLike) => (
  Array.isArray(message?.metadata?.blocks) ? message.metadata.blocks.length : 0
)

const hasAuthoritativeSequence = (message: NocodeEditorHistoryMessageLike) => (
  normalizePositiveSequence(message?.sequence) !== null
)

const shouldPreferAuthoritativeAssistantSnapshot = (
  left: NocodeEditorHistoryMessageLike,
  right: NocodeEditorHistoryMessageLike,
) => (
  isAssistantMessage(left)
  && isAssistantMessage(right)
  && hasAuthoritativeSequence(right)
  && !hasAuthoritativeSequence(left)
  && isHiddenFromTimelineMessage(left) === isHiddenFromTimelineMessage(right)
)

const mergeAssistantContent = (
  left: NocodeEditorHistoryMessageLike,
  right: NocodeEditorHistoryMessageLike,
) => {
  if (shouldPreferAuthoritativeAssistantSnapshot(left, right)) {
    return normalizeContent(right?.content)
  }

  const leftContent = normalizeContent(left?.content)
  const rightContent = normalizeContent(right?.content)
  const leftHidden = isHiddenFromTimelineMessage(left)
  const rightHidden = isHiddenFromTimelineMessage(right)

  if (leftHidden !== rightHidden) {
    return leftHidden ? rightContent : leftContent
  }

  if (!leftContent) {
    return rightContent
  }
  if (!rightContent) {
    return leftContent
  }
  if (leftContent === rightContent) {
    return rightContent
  }
  if (rightContent.includes(leftContent)) {
    return rightContent
  }
  if (leftContent.includes(rightContent)) {
    return leftContent
  }

  return `${leftContent}\n\n${rightContent}`
}

const getBlockSignature = (block: unknown) => {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return JSON.stringify(block)
  }

  if (isNocodeEditorArtifactBlock(block)) {
    return getNocodeEditorArtifactBlockMergeKey(block) || JSON.stringify(block)
  }

  return JSON.stringify(block)
}

const mergeMessageBlocks = (left: unknown, right: unknown) => {
  const mergedBlocks: unknown[] = []
  const nonArtifactIndexBySignature = new Map<string, number>()

  for (const block of [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]) {
    if (isNocodeEditorArtifactBlock(block)) {
      mergedBlocks.push(block)
      continue
    }

    const signature = getBlockSignature(block)
    const existingIndex = nonArtifactIndexBySignature.get(signature)
    if (existingIndex === undefined) {
      nonArtifactIndexBySignature.set(signature, mergedBlocks.length)
      mergedBlocks.push(block)
    } else {
      mergedBlocks[existingIndex] = block
    }
  }

  const artifactBlocks = mergedBlocks.filter(isNocodeEditorArtifactBlock)
  const winnerSelections = normalizeNocodeEditorArtifactBlockSelections(artifactBlocks as Record<string, any>[])
  const winnerArtifactIdentityKeys = new Set<string>()
  const winnerSelectionByIdentityKey = new Map<string, (typeof winnerSelections)[number]>()
  winnerSelections.forEach((item) => {
    const identityKey = isNocodeEditorArtifactBlock(item.block)
      ? (
        getNocodeEditorArtifactBlockMergeKey(item.source)
        || getNocodeEditorBlueprintArtifactIdentityKey(item.source)
        || item.key
      )
      : item.key
    if (!identityKey) {
      return
    }
    winnerArtifactIdentityKeys.add(identityKey)
    winnerSelectionByIdentityKey.set(identityKey, item)
  })

  const emittedArtifactKeys = new Set<string>()
  const orderedBlocks: unknown[] = []
  let legacyArtifactIndex = 0

  for (const block of mergedBlocks) {
    if (!isNocodeEditorArtifactBlock(block)) {
      orderedBlocks.push(block)
      continue
    }

    const mergeKey = getNocodeEditorArtifactBlockMergeKey(block)
    const identityKey = mergeKey || getNocodeEditorBlueprintArtifactIdentityKey(block)
    const key = identityKey || `legacy-artifact:${legacyArtifactIndex++}`
    if (
      (identityKey && !winnerArtifactIdentityKeys.has(identityKey))
      || emittedArtifactKeys.has(key)
    ) {
      continue
    }

    if (identityKey) {
      const selection = winnerSelectionByIdentityKey.get(identityKey)
      if (selection && selection.source !== block) {
        continue
      }
    }

    emittedArtifactKeys.add(key)
    const winningBlock = identityKey ? (winnerSelectionByIdentityKey.get(identityKey)?.block || block) : block
    orderedBlocks.push(winningBlock)
  }

  return orderedBlocks
}

const alignMergedBlocksToAuthoritative = (
  mergedBlocks: unknown[],
  authoritativeBlocks: unknown,
) => {
  const authoritativeList = Array.isArray(authoritativeBlocks)
    ? authoritativeBlocks
    : []
  const authoritativeArtifacts = Array.isArray(authoritativeBlocks)
    ? authoritativeBlocks.filter(isNocodeEditorArtifactBlock) as Record<string, any>[]
    : []
  if (!authoritativeList.length) {
    return mergedBlocks
  }

  const filteredMergedBlocks = mergedBlocks.filter((block) => {
    if (!isNocodeEditorArtifactBlock(block)) {
      return true
    }

    return findNocodeEditorArtifactBlockMergeIndex(authoritativeArtifacts, block) >= 0
  })

  const remainingBlocks = [...filteredMergedBlocks]
  const orderedBlocks: unknown[] = []

  for (const authoritativeBlock of authoritativeList) {
    if (!isNocodeEditorArtifactBlock(authoritativeBlock)) {
      const signature = getBlockSignature(authoritativeBlock)
      const index = remainingBlocks.findIndex(block => (
        !isNocodeEditorArtifactBlock(block)
        && getBlockSignature(block) === signature
      ))
      if (index >= 0) {
        orderedBlocks.push(remainingBlocks.splice(index, 1)[0])
      }
      continue
    }

    const index = remainingBlocks.findIndex(block => (
      isNocodeEditorArtifactBlock(block)
      && findNocodeEditorArtifactBlockMergeIndex([block], authoritativeBlock) >= 0
    ))
    if (index >= 0) {
      orderedBlocks.push(remainingBlocks.splice(index, 1)[0])
    }
  }

  return [
    ...orderedBlocks,
    ...remainingBlocks,
  ]
}

const collapseSupersededBlueprintBlocks = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => {
  const latestBlocks = normalizeNocodeEditorArtifactBlocks(
    messages.flatMap(message => (
      Array.isArray(message.metadata?.blocks)
        ? message.metadata.blocks.filter(isNocodeEditorArtifactBlock)
        : []
    )) as Record<string, any>[],
  )
  const latestBlueprintBlocksByKey = new Map<string, unknown>()
  const latestBlueprintBlocksByScopedIdentity = new Map<string, unknown>()
  const latestBlueprintBlocksByIdentity = new Map<string, unknown>()
  for (const block of latestBlocks) {
    const key = getNocodeEditorArtifactBlockMergeKey(block)
    if (key.startsWith('artifact:blueprint:')) {
      latestBlueprintBlocksByKey.set(key, block)
      const scopedIdentityKey = getNocodeEditorBlueprintArtifactScopedIdentityKey(block)
      if (scopedIdentityKey) {
        latestBlueprintBlocksByScopedIdentity.set(scopedIdentityKey, block)
      }
      const identityKey = getNocodeEditorBlueprintArtifactIdentityKey(block)
      if (identityKey) {
        latestBlueprintBlocksByIdentity.set(identityKey, block)
      }
    }
  }

  const emittedBlueprintKeys = new Set<string>()
  const nextMessages = [...messages]
  const foldedDraftIssueActionListsByMessageIndex = new Map<number, unknown>()

  const findDraftIssueActionListAnchorIndex = (
    resolvedState: unknown,
    fallbackIndex: number,
  ) => {
    let firstVisibleDraftIssueIndex = -1
    let firstMatchingVisibleDraftIssueIndex = -1
    let firstUnresolvedVisibleDraftIssueIndex = -1
    for (let index = 0; index < messages.length; index += 1) {
      const candidate = messages[index]
      if (!isVisibleDraftIssueActionListMessage(candidate)) {
        continue
      }
      const candidateDraftIssueActionList = candidate.metadata?.draftIssueActionList

      if (firstVisibleDraftIssueIndex < 0) {
        firstVisibleDraftIssueIndex = index
      }
      if (
        firstUnresolvedVisibleDraftIssueIndex < 0
        && !isResolvedDraftPersistenceState(candidateDraftIssueActionList)
      ) {
        firstUnresolvedVisibleDraftIssueIndex = index
      }

      if (hasDraftPersistenceStateMatchingCompletion(candidateDraftIssueActionList, resolvedState)) {
        if (firstMatchingVisibleDraftIssueIndex < 0) {
          firstMatchingVisibleDraftIssueIndex = index
        }
        if (!isResolvedDraftPersistenceState(candidateDraftIssueActionList)) {
          return index
        }
      }
    }

    return firstUnresolvedVisibleDraftIssueIndex >= 0
      ? firstUnresolvedVisibleDraftIssueIndex
      : firstMatchingVisibleDraftIssueIndex >= 0
      ? firstMatchingVisibleDraftIssueIndex
      : (firstVisibleDraftIssueIndex >= 0 ? firstVisibleDraftIssueIndex : fallbackIndex)
  }

  const resolveLatestBlueprintBlock = (block: Record<string, any>) => {
    const key = getNocodeEditorArtifactBlockMergeKey(block)
    const scopedIdentityKey = getNocodeEditorBlueprintArtifactScopedIdentityKey(block)
    const identityKey = getNocodeEditorBlueprintArtifactIdentityKey(block)
    return latestBlueprintBlocksByKey.get(key)
      || (scopedIdentityKey ? latestBlueprintBlocksByScopedIdentity.get(scopedIdentityKey) : undefined)
      || (identityKey ? latestBlueprintBlocksByIdentity.get(identityKey) : undefined)
  }

  const resolveBlueprintEmissionKey = (
    block: Record<string, any>,
    latestBlock?: unknown,
  ) => {
    const latestRecord = isNocodeEditorArtifactBlock(latestBlock) ? latestBlock : block
    return getNocodeEditorArtifactBlockMergeKey(latestRecord)
      || getNocodeEditorBlueprintArtifactScopedIdentityKey(latestRecord)
      || getNocodeEditorBlueprintArtifactIdentityKey(latestRecord)
      || getNocodeEditorArtifactBlockMergeKey(block)
  }

  const shouldRetainVisibleUnresolvedDraftIssueActionList = (input: {
    message: NocodeEditorHistoryMessageLike
    nextBlocks: unknown[]
    removedBlueprintBlock: boolean
  }) => (
    input.removedBlueprintBlock
    && !hasBlueprintArtifactBlock(input.nextBlocks)
    && isVisibleDraftIssueActionListMessage(input.message)
    && !isResolvedDraftPersistenceState(input.message.metadata?.draftIssueActionList)
  )

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex]
    const blocks = Array.isArray(message.metadata?.blocks) ? message.metadata.blocks : []
    if (!blocks.length) {
      continue
    }
    let foldedDraftIssueActionList = foldedDraftIssueActionListsByMessageIndex.get(messageIndex)
    let removedBlueprintBlock = false
    const nextBlocks: unknown[] = []
    for (const block of blocks) {
      if (!isNocodeEditorArtifactBlock(block)) {
        nextBlocks.push(block)
        continue
      }
      const key = getNocodeEditorArtifactBlockMergeKey(block)
      if (!key.startsWith('artifact:blueprint:')) {
        nextBlocks.push(block)
        continue
      }

      const latestBlock = resolveLatestBlueprintBlock(block)
      const emissionKey = resolveBlueprintEmissionKey(block, latestBlock)
      if (!latestBlock || emittedBlueprintKeys.has(emissionKey)) {
        removedBlueprintBlock = true
        continue
      }

      emittedBlueprintKeys.add(emissionKey)
      nextBlocks.push(latestBlock)
      if (
        isNocodeEditorArtifactBlock(latestBlock)
        && isResolvedDraftPersistenceState(latestBlock.draftPersistenceState)
      ) {
        const draftIssueAnchorIndex = findDraftIssueActionListAnchorIndex(
          latestBlock.draftPersistenceState,
          messageIndex,
        )
        if (draftIssueAnchorIndex === messageIndex) {
          foldedDraftIssueActionList = latestBlock.draftPersistenceState
        } else {
          foldedDraftIssueActionListsByMessageIndex.set(
            draftIssueAnchorIndex,
            latestBlock.draftPersistenceState,
          )
        }
      }
    }

    const nextMetadata = {
      ...(message.metadata || {}),
      blocks: nextBlocks,
    } as Record<string, unknown>
    if (
      foldedDraftIssueActionList
      && !isResolvedDraftPersistenceState(nextMetadata.draftIssueActionList)
    ) {
      nextMetadata.draftIssueActionList = foldedDraftIssueActionList
    }
    if (
      removedBlueprintBlock
      && !foldedDraftIssueActionList
      && !shouldRetainVisibleUnresolvedDraftIssueActionList({
        message,
        nextBlocks,
        removedBlueprintBlock,
      })
    ) {
      delete nextMetadata.draftIssueActionList
    }

    if (
      nextBlocks.length === blocks.length
      && nextBlocks.every((block, index) => block === blocks[index])
      && nextMetadata.draftIssueActionList === message.metadata?.draftIssueActionList
    ) {
      continue
    }
    nextMessages[messageIndex] = {
      ...message,
      metadata: nextMetadata,
    } as T
  }

  return nextMessages
}

const stripFoldedHiddenDraftIssueCompletionSyncPayload = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => (
  messages.map((message) => {
    if (!isHiddenDraftIssueCompletionSyncMessage(message) || !message.metadata) {
      return message
    }

    const metadata = {
      ...message.metadata,
    } as Record<string, unknown>
    delete metadata.draftIssueActionList
    delete metadata.blocks
    delete metadata.artifactBlocks

    return {
      ...message,
      metadata,
    } as T
  })
)

const hasFormulaActionsMetadata = (metadata?: Record<string, unknown> | null) => (
  Array.isArray(metadata?.formulaActions)
)

const hasFormulaTargetResultsMetadata = (metadata?: Record<string, unknown> | null) => (
  Array.isArray(metadata?.formulaTargetResults)
)

const hasArtifactBlocks = (value: unknown) => (
  Array.isArray(value) && value.some(isNocodeEditorArtifactBlock)
)

const mergeMessageFormulaActions = (
  metadata: Record<string, unknown>,
  left?: Record<string, unknown> | null,
  right?: Record<string, unknown> | null,
) => {
  if (
    !hasFormulaActionsMetadata(left)
    && !hasFormulaActionsMetadata(right)
    && !hasFormulaTargetResultsMetadata(left)
    && !hasFormulaTargetResultsMetadata(right)
  ) {
    return
  }

  const formulaActions = mergeNocodeEditorFormulaActions(
    left?.formulaActions,
    right?.formulaActions,
  )
  if (formulaActions.length) {
    metadata.formulaActions = formulaActions
  } else {
    delete metadata.formulaActions
  }

  const formulaTargetResults = mergeNocodeEditorFormulaTargetResults(
    left?.formulaTargetResults,
    right?.formulaTargetResults,
  )
  if (formulaTargetResults.length) {
    metadata.formulaTargetResults = formulaTargetResults
  } else {
    delete metadata.formulaTargetResults
  }
}

const mergeMessageMetadata = (
  left: Record<string, unknown> | null | undefined,
  right: Record<string, unknown> | null | undefined,
  options?: {
    preferRightAuthoritativeSnapshot?: boolean
  },
) => {
  if (!left && !right) {
    return null
  }

  const leftHidden = Boolean(left?.hiddenFromTimeline)
  const rightHidden = Boolean(right?.hiddenFromTimeline)
  const preserveVisibleMetadata = leftHidden !== rightHidden

  if (preserveVisibleMetadata) {
    const visibleMetadata = leftHidden ? right : left
    const hiddenMetadata = leftHidden ? left : right
    const mergedMetadata = {
      ...(visibleMetadata || {}),
    } as Record<string, unknown>

    const mergedBlocks = alignMergedBlocksToAuthoritative(
      mergeMessageBlocks(hiddenMetadata?.blocks, visibleMetadata?.blocks),
      visibleMetadata?.blocks,
    )
    if (mergedBlocks.length) {
      mergedMetadata.blocks = mergedBlocks
    } else {
      delete mergedMetadata.blocks
    }

    const traceId = normalizeTraceId(visibleMetadata?.traceId || hiddenMetadata?.traceId)
    if (traceId) {
      mergedMetadata.traceId = traceId
    } else {
      delete mergedMetadata.traceId
    }

    mergeMessageFormulaActions(mergedMetadata, hiddenMetadata, visibleMetadata)
    delete mergedMetadata.hiddenFromTimeline
    return mergedMetadata
  }

  if (options?.preferRightAuthoritativeSnapshot) {
    const mergedMetadata = {
      ...(right || {}),
    } as Record<string, unknown>

    const mergedBlocks = alignMergedBlocksToAuthoritative(
      mergeMessageBlocks(left?.blocks, right?.blocks),
      right?.blocks,
    )
    if (mergedBlocks.length) {
      mergedMetadata.blocks = mergedBlocks
    } else {
      delete mergedMetadata.blocks
    }

    const traceId = normalizeTraceId(right?.traceId || left?.traceId)
    if (traceId) {
      mergedMetadata.traceId = traceId
    } else {
      delete mergedMetadata.traceId
    }

    mergeMessageFormulaActions(mergedMetadata, left, right)
    return mergedMetadata
  }

  const mergedMetadata = {
    ...(left || {}),
    ...(right || {}),
  } as Record<string, unknown>

  const mergedHiddenFromTimeline = Boolean(left?.hiddenFromTimeline)
    && Boolean(right?.hiddenFromTimeline)
  if (mergedHiddenFromTimeline) {
    mergedMetadata.hiddenFromTimeline = true
  } else {
    delete mergedMetadata.hiddenFromTimeline
  }

  const mergedBlocks = hasArtifactBlocks(right?.blocks)
    ? alignMergedBlocksToAuthoritative(
      mergeMessageBlocks(left?.blocks, right?.blocks),
      right?.blocks,
    )
    : mergeMessageBlocks(left?.blocks, right?.blocks)
  if (mergedBlocks.length) {
    mergedMetadata.blocks = mergedBlocks
  } else {
    delete mergedMetadata.blocks
  }

  const traceId = normalizeTraceId(right?.traceId || left?.traceId)
  if (traceId) {
    mergedMetadata.traceId = traceId
  } else {
    delete mergedMetadata.traceId
  }

  mergeMessageFormulaActions(mergedMetadata, left, right)
  return mergedMetadata
}

const mergeAssistantMessages = <T extends NocodeEditorHistoryMessageLike>(left: T, right: T) => {
  const preferRightAuthoritativeSnapshot = shouldPreferAuthoritativeAssistantSnapshot(left, right)
  const mergedMetadata = mergeMessageMetadata(left.metadata || null, right.metadata || null, {
    preferRightAuthoritativeSnapshot,
  })

  return sanitizeHistoryAssistantMessage({
    ...right,
    content: mergeAssistantContent(left, right),
    metadata: mergedMetadata,
    traceId: normalizeTraceId(right.traceId || mergedMetadata?.traceId || left.traceId) || undefined,
  } as T)
}

const normalizeMessageId = (value: unknown) => String(value || '').trim()

const normalizePositiveSequence = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null
}

const normalizeCreateTime = (value: unknown) => {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : null
  }

  if (typeof value === 'string' && value.trim()) {
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) {
      return timestamp
    }
  }

  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null
}

const isOptimisticLocalUserMessage = (message: NocodeEditorHistoryMessageLike) => (
  isUserMessage(message)
  && !hasAuthoritativeSequence(message)
  && normalizeMessageId(message?.id).startsWith('user-')
)

const isSameOptimisticUserMessage = (
  left: NocodeEditorHistoryMessageLike,
  right: NocodeEditorHistoryMessageLike,
) => {
  if (!isUserMessage(left) || !isUserMessage(right)) {
    return false
  }

  const leftContent = normalizeContent(left.content)
  const rightContent = normalizeContent(right.content)
  if (!leftContent || leftContent !== rightContent) {
    return false
  }

  const optimistic = isOptimisticLocalUserMessage(left)
    ? left
    : isOptimisticLocalUserMessage(right)
      ? right
      : null
  if (!optimistic) {
    return false
  }

  const authoritative = optimistic === left ? right : left
  if (!hasAuthoritativeSequence(authoritative)) {
    return false
  }

  const optimisticTraceId = getTraceId(optimistic)
  const authoritativeTraceId = getTraceId(authoritative)
  if (optimisticTraceId && authoritativeTraceId) {
    return optimisticTraceId === authoritativeTraceId
  }
  if (!optimisticTraceId || authoritativeTraceId) {
    return false
  }

  const optimisticCreateTime = normalizeCreateTime(optimistic.createTime)
  const authoritativeCreateTime = normalizeCreateTime(authoritative.createTime)
  if (
    optimisticCreateTime === null
    || authoritativeCreateTime === null
    || authoritativeCreateTime < optimisticCreateTime
  ) {
    return false
  }

  return authoritativeCreateTime - optimisticCreateTime <= OPTIMISTIC_USER_RECONCILE_MAX_TIME_GAP_MS
}

const shouldKeepAssistantMessagesSeparated = (
  left: NocodeEditorHistoryMessageLike,
  right: NocodeEditorHistoryMessageLike,
) => {
  if (!isAssistantMessage(left) || !isAssistantMessage(right)) {
    return false
  }

  const leftSummaryStage = getSummaryStage(left)
  const rightSummaryStage = getSummaryStage(right)

  return Boolean(
    leftSummaryStage
    && rightSummaryStage
    && leftSummaryStage !== rightSummaryStage
  )
}

const isSameLogicalMessage = (
  left: (NocodeEditorHistoryMessageLike & { id?: unknown }) | undefined,
  right: (NocodeEditorHistoryMessageLike & { id?: unknown }) | undefined,
) => {
  if (!left || !right) {
    return false
  }

  if (shouldKeepAssistantMessagesSeparated(left, right)) {
    return false
  }

  const leftId = normalizeMessageId(left.id)
  const rightId = normalizeMessageId(right.id)
  if (leftId && rightId && leftId === rightId) {
    return true
  }

  const leftTraceId = getTraceId(left)
  const rightTraceId = getTraceId(right)
  if (!leftTraceId || !rightTraceId || leftTraceId !== rightTraceId) {
    return false
  }

  return String(left.role || '').trim() === String(right.role || '').trim()
}

const hasSameAssistantTrace = (
  left: NocodeEditorHistoryMessageLike,
  right: NocodeEditorHistoryMessageLike,
) => {
  if (!isAssistantMessage(left) || !isAssistantMessage(right)) {
    return false
  }
  const leftTraceId = getTraceId(left)
  return Boolean(leftTraceId && leftTraceId === getTraceId(right))
}

const findReconcileMessageIndex = <T extends NocodeEditorHistoryMessageLike & {
  id?: unknown
}>(messages: T[], message: T) => {
  const messageId = normalizeMessageId(message.id)
  if (messageId) {
    const idIndex = messages.findIndex(item => normalizeMessageId(item.id) === messageId)
    if (idIndex >= 0) {
      return idIndex
    }
  }

  if (isUserMessage(message)) {
    const optimisticUserIndex = messages.findIndex(item => isSameOptimisticUserMessage(item, message))
    if (optimisticUserIndex >= 0) {
      return optimisticUserIndex
    }
  }

  if (isAssistantMessage(message)) {
    const messageStage = getSummaryStage(message)
    if (messageStage) {
      const sameStageIndex = messages.findIndex(item => (
        hasSameAssistantTrace(item, message)
        && getSummaryStage(item) === messageStage
      ))
      if (sameStageIndex >= 0) {
        return sameStageIndex
      }
      // Staged artifact messages must not be reconciled into earlier same-trace
      // narration, or later cards can be copied onto previous planning cards.
      return -1
    }

    const sameStageLessIndex = messages.findIndex(item => (
      hasSameAssistantTrace(item, message)
      && !getSummaryStage(item)
    ))
    if (sameStageLessIndex >= 0) {
      return sameStageLessIndex
    }
  }

  return messages.findIndex(item => isSameLogicalMessage(item, message))
}

const pickPreferredDuplicateMessage = <T extends NocodeEditorHistoryMessageLike>(left: T, right: T) => {
  const leftHasAuthoritativeSequence = hasAuthoritativeSequence(left)
  const rightHasAuthoritativeSequence = hasAuthoritativeSequence(right)
  if (leftHasAuthoritativeSequence !== rightHasAuthoritativeSequence) {
    return rightHasAuthoritativeSequence ? right : left
  }

  const leftSequence = normalizePositiveSequence(left?.sequence)
  const rightSequence = normalizePositiveSequence(right?.sequence)
  if (
    leftSequence !== null
    && rightSequence !== null
    && leftSequence !== rightSequence
  ) {
    return rightSequence > leftSequence ? right : left
  }

  const leftToolSummary = isToolResultSummaryMessage(left)
  const rightToolSummary = isToolResultSummaryMessage(right)
  if (leftToolSummary !== rightToolSummary) {
    return rightToolSummary ? right : left
  }

  const leftBlockCount = countArtifactBlocks(left)
  const rightBlockCount = countArtifactBlocks(right)
  if (leftBlockCount !== rightBlockCount) {
    return rightBlockCount > leftBlockCount ? right : left
  }

  return right
}

export const normalizeNocodeEditorAiMessageHistory = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => {
  // Temporarily disable same-trace tool summary suppression because it hides
  // the final assistant reply after the editor AI stream finishes.
  // const traceIdsWithToolSummaries = new Set(
  //   (messages || [])
  //     .filter(message => isAssistantMessage(message) && isToolResultSummaryMessage(message))
  //     .map(getTraceId)
  //     .filter(Boolean),
  // )
  //
  // const filtered = (messages || []).filter((message) => {
  //   if (!isAssistantMessage(message)) {
  //     return true
  //   }
  //
  //   const traceId = getTraceId(message)
  //   if (!traceId || !traceIdsWithToolSummaries.has(traceId)) {
  //     return true
  //   }
  //
  //   if (isToolResultSummaryMessage(message)) {
  //     return true
  //   }
  //
  //   return !hasActionResults(message)
  // })
  const filtered = filterTransientFailedAppPlanSummariesBeforeLaterSuccess(messages || [])
    .filter(shouldKeepNocodeEditorAiHistoryMessage)

  const deduped: T[] = []
  for (const message of foldHiddenFlowIssueCompletionSyncStates(filtered)) {
    const previous = deduped[deduped.length - 1]
    if (
      previous
      && isAssistantMessage(previous)
      && isAssistantMessage(message)
      && getTraceId(previous)
      && getTraceId(previous) === getTraceId(message)
      && !shouldKeepAssistantMessagesSeparated(previous, message)
    ) {
      const preferred = pickPreferredDuplicateMessage(previous, message)
      const fallback = preferred === previous ? message : previous
      deduped[deduped.length - 1] = mergeAssistantMessages(fallback, preferred) as T
      continue
    }

    deduped.push(message)
  }

  return stripFoldedHiddenDraftIssueCompletionSyncPayload(
    collapseSupersededBlueprintBlocks(
      collapseSupersededFlowPlanBlocks(
        collapseSupersededFlowPlanSummaries(deduped),
      ),
    ),
  )
    .map(message => sanitizeHistoryAssistantMessage(message))
}

export const sortNocodeEditorAiMessageHistory = <T extends NocodeEditorHistoryMessageLike>(messages: T[]) => (
  [...(messages || [])]
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const leftTraceId = getTraceId(left.message)
      const rightTraceId = getTraceId(right.message)
      const leftParentTraceId = getBlueprintApplyParentTraceId(left.message)
      const rightParentTraceId = getBlueprintApplyParentTraceId(right.message)
      if (leftParentTraceId && leftParentTraceId === rightTraceId) {
        return 1
      }
      if (rightParentTraceId && rightParentTraceId === leftTraceId) {
        return -1
      }

      const leftSequence = normalizePositiveSequence(left.message?.sequence)
      const rightSequence = normalizePositiveSequence(right.message?.sequence)
      const leftHasSequence = leftSequence !== null
      const rightHasSequence = rightSequence !== null

      if (leftHasSequence && rightHasSequence && leftSequence !== rightSequence) {
        return leftSequence - rightSequence
      }

      if (leftHasSequence !== rightHasSequence) {
        return leftHasSequence ? -1 : 1
      }

      const leftCreateTime = normalizeCreateTime(left.message?.createTime)
      const rightCreateTime = normalizeCreateTime(right.message?.createTime)
      if (leftCreateTime !== null && rightCreateTime !== null && leftCreateTime !== rightCreateTime) {
        return leftCreateTime - rightCreateTime
      }

      if (leftCreateTime !== null || rightCreateTime !== null) {
        return leftCreateTime !== null ? -1 : 1
      }

      return left.index - right.index
    })
    .map(item => item.message)
)

export const reconcileNocodeEditorAiMessageHistory = <T extends NocodeEditorHistoryMessageLike & {
  id?: unknown
}>(input: {
  current: T[]
  loaded: T[]
}) => {
  const merged = [...(input.loaded || [])]

  for (const message of input.current || []) {
    const existingIndex = findReconcileMessageIndex(merged, message)
    if (existingIndex < 0) {
      merged.push(message)
      continue
    }

    const existing = merged[existingIndex]
    if (isAssistantMessage(existing) && isAssistantMessage(message)) {
      const preferred = pickPreferredDuplicateMessage(existing, message)
      const fallback = preferred === existing ? message : existing
      merged[existingIndex] = mergeAssistantMessages(fallback, preferred) as T
      continue
    }
  }

  return sortNocodeEditorAiMessageHistory(
    normalizeNocodeEditorAiMessageHistory(merged),
  )
}
