import type {
  AiFeatureFlags,
  AiModelCatalog,
  AiModelCatalogItem,
  AiProviderConfig,
  AiProviderTestResult,
  AiSettings,
  AiThreadModelSelection,
  AiModelValidationResult,
} from '@common/types/ai-provider'
import type {
  AiAttachment,
  AiAttachmentIntentHint,
  AiAttachmentSelectionEventPayload,
  AiAttachmentMessageMetadata,
  AiAttachmentReference,
} from '@common/types/aiAttachment'
import type { AiExcelAnalysisContext } from '@common/types/aiExcelAnalysis'
import type { WorkbenchAiFormFillContextSnapshot } from '@common/utils/workbenchAiFormFill'

export enum AiMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export enum AiStreamEventType {
  START = 'start',
  DELTA = 'delta',
  ACTION_CALL = 'action-call',
  ACTION_RESULT = 'action-result',
  TOOL_CALL = 'tool-call',
  TOOL_RESULT = 'tool-result',
  DONE = 'done',
  ERROR = 'error',
  CONTEXT_COMPACTION_START = 'context_compaction_start',
  CONTEXT_COMPACTION_COMPLETED = 'context_compaction_completed',
}

export type AiTokenUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type AiPromptDiagnostics = {
  totalChars: number
  estimatedTokens: number
  messageCount: number
  historyMessageCount: number
  actionResultCount: number
  systemPromptChars: number
  historyMessageChars: number
  historicalToolSummaryChars: number
  currentActionResultChars: number
  historyPromptSnapshotChars: number
}

export type AiToolProgressDiagnostics = {
  actionResultCount: number
  firstNoNewInformationRound?: number
  lastEffectiveToolResult?: {
    round: number
    tool: string
    resultKind?: string
    appId?: string
    targetId?: string
    path?: string
    truncated?: boolean
    nextOffset?: number
  }
}

export type AiTurnFallbackDiagnostics = {
  stage: string
  traceId?: string
  providerId?: string
  modelId?: string
  model?: string
  errorName?: string
  errorMessage?: string
}

export type AiReasoningLevel = 'low' | 'medium' | 'high'

export type AiReasoningMode = 'builtin-route' | 'parameter' | 'model-map' | 'provider-default'

export type AiTurnDiagnosticsRound = {
  round: number
  startedAt: number
  firstTokenAt?: number
  completedAt: number
  durationMs: number
  firstTokenLatencyMs?: number
  provider?: string
  requestedModel?: string
  publicModel?: string
  effectiveModel?: string
  effectiveModelId?: string
  routePolicyId?: string
  routeVersion?: string
  fallbackHit?: boolean
  requestedReasoningLevel?: AiReasoningLevel
  effectiveReasoningLevel?: AiReasoningLevel
  reasoningMode?: AiReasoningMode
  reasoningReasonCodes?: string[]
  finishReason?: string
  toolCallCount: number
  usage: AiTokenUsage
  promptDiagnostics?: AiPromptDiagnostics
}

export type AiTurnDiagnostics = {
  startedAt: number
  completedAt: number
  totalDurationMs: number
  totalRounds: number
  totalToolCalls: number
  usage: AiTokenUsage
  providers: string[]
  requestedModels: string[]
  publicModels: string[]
  effectiveModels: string[]
  rounds: AiTurnDiagnosticsRound[]
  toolProgress?: AiToolProgressDiagnostics
  fallback?: AiTurnFallbackDiagnostics
}

export type AiThreadAppScope = {
  appIds: string[]
}

export type AiThreadVisitorProfile = {
  firstSeenAt?: number
  lastSeenAt?: number
  sourceDomain?: string
  referrer?: string
  origin?: string
  platform?: string
  language?: string
  os?: string
  browser?: string
  userAgent?: string
  ip?: string
}

export type AiThreadRuntimeIntent = 'records' | 'aggregation' | 'clarify'
export type AiThreadRuntimeContextKind = 'single_target' | 'batch' | 'comparison'
export type AiSearchConvergence = 'none' | 'weak' | 'clear'
export type AiReadAppDataMode = 'records' | 'aggregate'
export type AiReadAppDataTargetType = 'source'
export type AiRuntimeExecutionStrategy = 'hard_serial' | 'batch' | 'parallel_safe' | 'blocked_by_policy'
export type AiConversationProfile =
  | 'records_query'
  | 'cross_app_compare'
  | 'cross_app_merge'
  | 'cross_app_unresolved'

export type AiThreadVerifiedTarget = {
  appId: string
  appName?: string
  targetId: string
  targetName?: string
  targetType: AiReadAppDataTargetType
  mode: AiReadAppDataMode
}

export type AiThreadRecordAnalysisSnapshot = {
  appId: string
  appName?: string
  targetId?: string
  targetName?: string
  targetType?: AiReadAppDataTargetType
  mode: 'aggregate'
  requestSignature?: string
  requestSummary?: {
    mode: 'aggregate'
    filters?: Record<string, unknown> | unknown[]
    groupBy?: string
    timeGranularity?: string | null
    topN?: number
    analysis?: {
      metrics: Array<Record<string, any>>
      groupBy?: Array<Record<string, any>>
      having?: Array<Record<string, any>>
      orderBy?: Array<Record<string, any>>
      topN?: number
    }
  }
  analysisResult: {
    metricDefs?: Array<Record<string, any>>
    groupDefs?: Array<Record<string, any>>
    rows?: Array<Record<string, any>>
    totals?: Record<string, number>
    totalsDisplay?: Record<string, string>
    meta?: Record<string, any>
  }
}

export type AiThreadCrossAppAnalysisSlice = {
  appId: string
  appName?: string
  targetId?: string
  targetName?: string
  targetType?: AiReadAppDataTargetType
  requestSignature?: string
  requestSummary?: AiThreadRecordAnalysisSnapshot['requestSummary']
  analysisResult: AiThreadRecordAnalysisSnapshot['analysisResult']
}

export type AiThreadCrossAppAnalysisBundle =
  | {
      mode: 'compare'
      status: 'complete'
      expectedAppIds: string[]
      requestSignature: string
      requestSummary: NonNullable<AiThreadRecordAnalysisSnapshot['requestSummary']>
      alignmentSummary: {
        kind: 'compare'
        metricKeys: string[]
        groupKeys: string[]
        timeGranularity?: string | null
      }
      slices: AiThreadCrossAppAnalysisSlice[]
    }

export type AiCrossAppComparabilityStatus =
  | 'fully_comparable'
  | 'partially_comparable'
  | 'unresolved'

export type AiCrossAppAlignmentLimitationReason =
  | 'field_mismatch'
  | 'granularity_mismatch'
  | 'metric_definition_mismatch'
  | 'sample_incomplete'

export type AiCrossAppAlignmentState = {
  status: AiCrossAppComparabilityStatus
  scope: {
    appIds: string[]
    sourceIds: string[]
  }
  alignmentBasis?: {
    mode?: 'compare' | 'merge'
    metricKeys?: string[]
    groupKeys?: string[]
    timeGranularity?: string | null
    mergeKey?: string
  }
  limitationReasons?: AiCrossAppAlignmentLimitationReason[]
  bundleRef?: {
    mode: 'compare' | 'merge'
    requestSignature: string
  }
}

export type AiCrossAppScopeTransition =
  | 'inherit'
  | 'narrow'
  | 'expand'
  | 'invalidate'
  | {
      mode: 'merge'
      status: 'complete'
      expectedAppIds: string[]
      requestSignature: string
      requestSummary: NonNullable<AiThreadRecordAnalysisSnapshot['requestSummary']>
      alignmentSummary: {
        kind: 'merge'
        metricKeys: string[]
        groupKeys: string[]
        mergeKey: string
      }
      slices: AiThreadCrossAppAnalysisSlice[]
    }

export type AiThreadSummary = {
  id: string
  agentId: string
  ownerAccountId: string
  kind: 'private' | 'share-visitor'
  title: string
  appScope?: AiThreadAppScope | null
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: 'default' | 'explicit' | null
  pinned?: boolean
  pinTime?: number | null
  visitorKey?: string | null
  visitorProfile?: AiThreadVisitorProfile | null
  runtimeState?: {
    currentProfile?: AiConversationProfile
    currentAppId?: string
    currentAppName?: string
    currentIntent?: AiThreadRuntimeIntent
    currentContextKind?: AiThreadRuntimeContextKind
    currentTopAppId?: string
    currentSearchSignature?: string
    currentSearchConvergence?: AiSearchConvergence
    currentSearchWeakSignature?: string
    currentSourceId?: string
    currentSourceName?: string
    currentBatchAppId?: string
    currentBatchTargetIds?: string[]
    diagnostics?: {
      currentTopCandidateStableRounds?: number
      lastExecutionStrategy?: AiRuntimeExecutionStrategy
      lastBatchPartial?: boolean
    } | null
    verifiedTargets?: AiThreadVerifiedTarget[]
    recordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
    activeRecordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
    latestRecordAnalysisSnapshot?: AiThreadRecordAnalysisSnapshot
    latestCrossAppScopeTransition?: AiCrossAppScopeTransition
    latestCrossAppAlignmentState?: AiCrossAppAlignmentState
    latestCrossAppAnalysisBundle?: AiThreadCrossAppAnalysisBundle
    lastExecutionStrategy?: AiRuntimeExecutionStrategy
    lastBatchPartial?: boolean
    recentSourceIds?: string[]
  } | null
  createTime?: number
  updateTime?: number
  hiddenTime?: number | null
  deleteTime?: number | null
  sharing?: boolean
  shareToken?: string
}

export type AiThreadMessage = {
  id: string
  threadId: string
  ownerAccountId: string
  role: AiMessageRole
  sequence: number
  content: string
  name?: string | null
  traceId?: string | null
  metadata?: AiMessageMetadata | null
  createTime: number
}

export type AiToolCallTrace = {
  id: string
  name: string
  displayName?: string
  displayStatus?: 'running' | 'success' | 'error' | 'skipped'
  displaySummary?: string
  displayHidden?: boolean
  groupId?: string | null
  traceId?: string | null
  input?: Record<string, any> | null
  ok?: boolean
  outputPreview?: string
  outputTruncated?: boolean
  historyPromptSnapshot?: string
  historyPromptSnapshotTruncated?: boolean
  error?: string
  durationMs?: number
  round?: number
  strategy?: AiRuntimeExecutionStrategy
  batchSize?: number
  partial?: boolean
  reused?: boolean
  policyBlocked?: boolean
  repeatedCall?: boolean
  noNewInformation?: boolean
  repeatNotice?: string
  repeatHint?: string
  duplicateBlocked?: boolean
  repeatedCount?: number
  consecutiveRepeatedCount?: number
  searchRepeatBlocked?: boolean
  searchStopReason?: string
  queued?: boolean
  executionGroup?: string
  targetIds?: string[]
  succeededTargetIds?: string[]
  failedTargetIds?: string[]
  searchConvergence?: AiSearchConvergence
  topCandidateAppId?: string
  searchResultSignature?: string
  searchCandidateWeakSignature?: string
  topScoreRatio?: number
  dominantTopCandidate?: boolean
  noNewCandidates?: boolean
  topCandidateStable?: boolean
  stableTopCandidateRounds?: number
}

export type AiToolCallGroupTimelineItem = {
  id: string
  type: 'tool-call' | 'interim-text'
  refId: string
}

export type AiToolCallGroupTrace = {
  id: string
  callIds: string[]
  timeline?: AiToolCallGroupTimelineItem[]
  closed?: boolean
}

export type AiInterimTextTrace = {
  id: string
  text: string
  round?: number
  anchorCallId?: string
}

export type AiMessage = {
  id: string
  role: AiMessageRole.USER | AiMessageRole.ASSISTANT
  content: string
  createTime?: number
  traceId?: string | null
  metadata?: AiMessageMetadata | null
}

export type AiComposerAttachment = AiAttachment

export type AiComposerAttachmentEventPayload = AiAttachmentSelectionEventPayload

export type AiMessageMetadata = {
  [key: string]: unknown
  traceId?: string
  attachments?: AiAttachmentReference[]
  attachmentIntent?: AiAttachmentIntentHint
  attachmentSummary?: string
  attachmentSummaryLines?: string[]
  userFacingContent?: string
  providerPromptContent?: string
  excelAnalysisContext?: AiExcelAnalysisContext
  disableBuiltinAppTools?: boolean
  contextCompaction?: {
    status?: 'running' | 'completed'
    estimatedTokens?: number
    sourceMessageCount?: number
    updatedAt?: number
  }
}

export type AiRequestAttachmentMetadata = AiAttachmentMessageMetadata & {
  attachmentSummary?: string
  attachmentSummaryLines?: string[]
  userFacingContent?: string
  providerPromptContent?: string
  excelAnalysisContext?: AiExcelAnalysisContext
  disableBuiltinAppTools?: boolean
}

export type AiThreadStreamRequest = {
  threadId?: string
  message: string
  nocodeIds?: string[]
  providerId?: string
  modelId?: string
  model?: string
  traceId?: string
  metadata?: AiMessageMetadata
  runtimeContext?: {
    currentFormFillContext?: WorkbenchAiFormFillContextSnapshot | null
    currentFormFillUnavailable?: boolean
  }
}

export type AiShareBootstrapRequest = {
  shareToken: string
  visitorKey: string
  metadata?: Record<string, any>
}

export type AiShareStreamRequest = {
  shareToken: string
  visitorKey: string
  message: string
  providerId?: string
  modelId?: string
  model?: string
  traceId?: string
  metadata?: AiMessageMetadata
}

export type AiChatStreamPayload = {
  threadId?: string
  conversationId?: string
  event: AiStreamEventType
  text?: string
  usage?: AiTokenUsage
  finishReason?: string
  error?: string
  metadata?: Record<string, any>
}

export type AiShareInfo = {
  id: string
  agentId: string
  shareToken: string
  enabled: boolean
  createTime?: number
  updateTime?: number
}

export type AiShareBootstrapResult = {
  share: AiShareInfo
  thread: AiThreadSummary
  ownerThread: {
    id: string
    agentId: string
    title: string
  }
  messages: AiThreadMessage[]
}

export type {
  AiFeatureFlags,
  AiModelCatalog,
  AiModelCatalogItem,
  AiModelValidationResult,
  AiProviderConfig,
  AiProviderTestResult,
  AiSettings,
  AiThreadModelSelection,
}
