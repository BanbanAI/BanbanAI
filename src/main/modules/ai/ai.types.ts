import type {
  AiFeatureFlags,
  AiModelCatalog,
  AiProviderConfig,
  AiSettings,
  AiThreadModelSelection,
  AiThreadModelSelectionSource,
} from '@common/types/ai-provider'
import type { AiAttachmentReference } from '@common/types/aiAttachment'
import type { WorkbenchAiFormFillContextSnapshot } from '@common/utils/workbenchAiFormFill'
import type {
  AppBuilderCreationMode,
  AppBuilderHandoffIntentKind,
} from '@common/types/appBuilderHandoff'

export enum AiMessageRole {
  SYSTEM = 'system',
  DEVELOPER = 'developer',
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

export type AiThreadContextState = {
  version: 1
  summarizedThroughSequence?: number
  sourceFingerprint?: string
  summary?: string
  sourceMessageCount?: number
  estimatedTokens?: number
  updatedAt?: number
}

export enum AiActionKind {
  FUNCTION = 'function',
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
  contextCompacted?: boolean
  contextBudgetTokens?: number
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

export type AiRuntimePurpose =
  | 'interactive-default'
  | 'ai-semantic-warmup'

export type AiReasoningMode = 'builtin-route' | 'parameter' | 'model-map' | 'provider-default'

export type AiReasoningDecision = {
  level: AiReasoningLevel
  source?: 'auto' | 'manual'
  reasonCodes?: string[]
}

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

export type AiToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, any>
  notes?: string[]
  groupKey?: string
  groupTitle?: string
  mcpServerId?: string
  mcpServerName?: string
  source?: 'builtin' | 'external'
}

export type AiMcpServerTransport = 'builtin' | 'streamable-http' | 'sse' | 'stdio'

export type AiMcpServerDefinition = {
  id: string
  name: string
  transport: AiMcpServerTransport
  source: 'builtin' | 'imported'
  description?: string
  enabled?: boolean
  endpoint?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools?: AiToolDefinition[]
}

export type AiActionDefinition = {
  name: string
  kind: AiActionKind
  description: string
  inputSchema: Record<string, any>
  outputSchema?: Record<string, any>
  notes?: string[]
}

export type AiActionCall = {
  id: string
  name: string
  kind: AiActionKind
  input: Record<string, any>
  reason?: string
}

export type AiActionResult = {
  callId: string
  name: string
  kind: AiActionKind
  ok: boolean
  output?: any
  error?: string
  metadata?: Record<string, any>
}

export type AiEntityRef = {
  id: string
  name: string
  alias?: string
  appId?: string
  appName?: string
}

export type AiConversationEntityMemory = {
  currentApp?: AiEntityRef | null
  currentForm?: AiEntityRef | null
  recentApps?: AiEntityRef[]
  recentForms?: AiEntityRef[]
}

export type AiToolAppScope = {
  appIds?: string[]
  appNames?: string[]
}

export type AiToolExecutionContext = {
  accountId: string
  accountName?: string
  accountUser?: string
  accountIsAdmin?: boolean
  nocodeId?: string
  conversationProfile?: AiConversationProfile
  threadId?: string
  traceId?: string
  toolCallId?: string
  toolRound?: number
  query?: string
  memory?: AiConversationEntityMemory
  appScope?: AiToolAppScope
  currentPageFormFillContext?: WorkbenchAiFormFillContextSnapshot | null
  signal?: AbortSignal
  suppressWarmupTrace?: boolean
}

export type AiContextStorageTopology = {
  formData: string
  systemData: string
  appConfig: string
}

export type AiContextSnapshot = {
  accountId: string
  accountName?: string
  nocodeId?: string
  promptVersion: string
  appOverview?: Record<string, any> | null
  formSummaries: Array<Record<string, any>>
  entityMemory?: AiConversationEntityMemory
  actionSummary: Array<Pick<AiActionDefinition, 'name' | 'kind' | 'description'>>
  conversationHints?: Record<string, any>
  metadata?: Record<string, any>
}

import type {
  NocodeEditorFlowEntryIntent,
} from '@common/utils/nocodeEditorFlowEntryIntent'
import type { NocodeEditorFlowIntentSignal } from '@common/utils/nocodeEditorFlowIntentSignal'
import type { NocodeEditorIndustrySkeletonCarryover } from '@common/utils/nocodeEditorIndustrySkeleton'
import type { NocodeEditorPlanningScope } from '@common/utils/nocodeEditorPlanningScope'
import type { NocodeEditorPendingFlowIntent } from '@common/utils/nocodeEditorPendingFlowIntent'

export type AiChatRequest = {
  agentId?: string
  conversationId?: string
  visitorId?: string
  channel?: 'owner' | 'public'
  scene?: AiScene
  message: string
  traceId?: string
  nocodeId?: string
  nocodeIds?: string[]
  providerId?: string
  modelId?: string
  model?: string
  modelSelectionSource?: AiThreadModelSelectionSource
  promptVersion?: string
  maxHistoryMessages?: number
  maxActionRounds?: number
  metadata?: Record<string, any>
  scenePayload?: AiScenePayload
}

export type AiScene = 'workbench-chat' | 'nocode-editor'

export type AiEditorMode =
  | 'idle'
  | 'form-design'
  | 'process-setting'
  | 'page-design'
  | 'app-setting'

export type AiEditorSettingContextType = 'default-formula'
export type AiEditorSettingTargetContextType = 'default-formula-target'

export type AiDefaultFormulaContext = {
  type: 'default-formula'
  widgetId: string
  widgetTitle: string
  currentFormula: string
  rules: string[]
  fieldList: Array<{
    token: string
    title: string
    valueType: string
    sourceType: 'current-row' | 'current-history' | 'linked-table' | 'other-table'
    disabled?: boolean
    disabledReason?: string
  }>
  formulaList: Array<{
    name: string
    category: string
    kind: 'normal' | 'column' | 'context'
    usage?: string
    defaultArgTail?: string
    summary?: string
  }>
}

export type AiDefaultFormulaTargetContext = {
  type: 'default-formula-target'
  widgetId: string
  widgetTitle: string
}

export type AiEditorTaskContext = AiDefaultFormulaContext | null
export type AiEditorSettingTargetContext = AiDefaultFormulaTargetContext | null
export type AiEditorSettingContext = AiDefaultFormulaContext | null

export type AiImportedHandoffContext = {
  handoffId?: string
  creationMode?: AppBuilderCreationMode
  intentKind?: AppBuilderHandoffIntentKind
  entryTitle?: string
  targetAppName?: string
  originalGoal?: string
  materialSummary?: string
}

export type AiScenePayload = {
  nocodeId?: string
  activeFormId?: string
  activeFormName?: string
  currentActiveId?: string
  mode?: AiEditorMode
  taskContextType?: AiEditorSettingContextType
  settingTargetContextType?: AiEditorSettingTargetContextType
  settingContextType?: AiEditorSettingContextType
  selectedWidgetId?: string
  draftRevision?: number
  stagedPlanningSummary?: string
  stagedFlowSummary?: string
  stagedBlueprintSummary?: string
  pendingBlueprintRepeatIntent?: boolean
  pendingBlueprintClarificationSummary?: string
  pendingBlueprintClarificationKind?: 'planning-question' | 'explicit-confirmation'
  pendingBlueprintBlockedBlueprintId?: string
  entryFlowIntent?: NocodeEditorFlowEntryIntent
  flowIntent?: NocodeEditorFlowIntentSignal | null
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  planningScope?: NocodeEditorPlanningScope
  industrySkeletonContext?: NocodeEditorIndustrySkeletonCarryover | null
  importedHandoffContext?: AiImportedHandoffContext
}

export type AiProviderMessage = {
  role: AiMessageRole
  content: string
  name?: string
  toolCallId?: string
  metadata?: Record<string, any>
}

export type AiModelToolExchangeCall = {
  id: string
  name: string
  kind?: AiActionKind
  input?: Record<string, any>
  reason?: string
}

export type AiModelToolExchangeResult = {
  callId: string
  name: string
  ok: boolean
  output?: any
  error?: string
  metadata?: Record<string, any>
}

export type AiRelayTurnRequest = {
  accountId: string
  accountName?: string
  conversationId?: string
  providerId?: string
  modelId?: string
  model: string
  reasoning?: AiReasoningDecision
  promptVersion: string
  systemPrompt: string
  messages: AiProviderMessage[]
  actions: AiActionDefinition[]
  actionResults: AiActionResult[]
  context: AiContextSnapshot
  metadata?: Record<string, any>
  signal?: AbortSignal
}

export type AiRelayStreamEvent =
  | {
      type: AiStreamEventType.CONTEXT_COMPACTION_START | AiStreamEventType.CONTEXT_COMPACTION_COMPLETED
      raw?: any
    }
  | {
      type: AiStreamEventType.DELTA
      text: string
    }
  | {
      type: AiStreamEventType.ACTION_CALL
      action: AiActionCall
    }
  | {
      type: AiStreamEventType.ACTION_RESULT
      result: AiActionResult
    }
  | {
      type: AiStreamEventType.DONE
      usage?: Partial<AiTokenUsage>
      finishReason?: string
      raw?: any
    }
  | {
      type: AiStreamEventType.ERROR
      error: string
      raw?: any
    }

export type AiChatStreamPayload = {
  threadId?: string
  conversationId?: string
  event: AiStreamEventType
  text?: string
  usage?: AiTokenUsage
  finishReason?: string
  error?: string
  metadata?: AiChatStreamMetadata
}

export type AiAppBuilderHandoffPreviewMetadata = {
  handoffId: string
  creationMode: AppBuilderCreationMode
  status?: 'ready' | 'continuing' | 'consumed' | 'abandoned'
  entryTitle?: string
  targetAppName?: string
  excelAttachment?: AiAttachmentReference
}

export type AiAppBuilderHandoffIssueMetadata = {
  actionType: 'app-builder-handoff-issue'
  issueCode: string
  title: string
  summary: string
  sourceThreadId: string
}

export type AiChatStreamMetadata = Record<string, any> & {
  appBuilderHandoff?: AiAppBuilderHandoffPreviewMetadata
  appBuilderHandoffIssue?: AiAppBuilderHandoffIssueMetadata
}

export type NocodeEditorStreamErrorKind =
  | 'payload_too_large'
  | 'provider_timeout'
  | 'provider_output_overflow'
  | 'stream_error'

export type NocodeEditorStreamErrorMetadata = {
  scene: 'nocode-editor'
  traceId?: string
  persistedError: boolean
  errorKind: NocodeEditorStreamErrorKind
  retryable: boolean
  userMessagePersisted: boolean
  recoveryAction?: 'continue_generation'
  timeoutPhase?: 'first_event' | 'idle' | 'total'
  timeoutMs?: number
}

export type AiClientToolResultRequest = {
  conversationId: string
  callId: string
  toolName: string
  ok: boolean
  output?: any
  error?: string
  metadata?: Record<string, any>
}

export type AiProviderChatRequest = {
  model: string
  systemPrompt: string
  messages: AiProviderMessage[]
  tools: AiToolDefinition[]
  metadata?: Record<string, any>
}

export type AiProviderStreamEvent =
  | {
      type: AiStreamEventType.DELTA
      text: string
    }
  | {
      type: AiStreamEventType.TOOL_CALL
      toolName: string
      input?: any
    }
  | {
      type: AiStreamEventType.TOOL_RESULT
      toolName: string
      output?: any
    }
  | {
      type: AiStreamEventType.DONE
      usage?: Partial<AiTokenUsage>
      finishReason?: string
      raw?: any
    }

export type AiThreadKind = 'private' | 'share-visitor'

export type AiConversationProfile =
  | 'records_query'
  | 'cross_app_compare'
  | 'cross_app_merge'
  | 'cross_app_unresolved'
export type AiThreadRuntimeIntent = 'records' | 'aggregation' | 'clarify'
export type AiThreadRuntimeContextKind = 'single_target' | 'batch' | 'comparison'
export type AiSearchConvergence = 'none' | 'weak' | 'clear'
export type AiEvidenceStrength = 'none' | 'weak' | 'moderate' | 'strong'
export type AiReadAppDataMode = 'records' | 'aggregate'
export type AiReadAppDataTargetType = 'source'
export type AiReadAppDataExecutionPreference = 'auto' | 'batch' | 'serial' | 'parallel'
export type AiReadAppDataReturnMode = 'per_target' | 'merged' | 'both'
export type AiReadAppDataPartialPolicy = 'allow_partial' | 'require_all'
export type AiReadAppDataTimeGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
export type AiReadAppDataAnalysisMetricOp = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max'
export type AiReadAppDataAnalysisCompareOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne'
export type AiReadAppDataAnalysisOrderDirection = 'asc' | 'desc'
export type AiRuntimeExecutionStrategy = 'hard_serial' | 'batch' | 'parallel_safe' | 'blocked_by_policy'
export type AiAnalysisChartKind = 'line' | 'bar' | 'horizontal-bar' | 'donut' | 'scatter'

export type AiReadAppDataAnalysisMetric = {
  op: AiReadAppDataAnalysisMetricOp
  field?: string
  as: string
}

export type AiReadAppDataAnalysisGroup = {
  field: string
  as?: string
  timeGranularity?: AiReadAppDataTimeGranularity | null
}

export type AiReadAppDataAnalysisHaving = {
  metric: string
  op: AiReadAppDataAnalysisCompareOp
  value: string | number | boolean | null
}

export type AiReadAppDataAnalysisOrderBy = {
  metric?: string
  group?: string
  direction?: AiReadAppDataAnalysisOrderDirection
}

export type AiReadAppDataAnalysis = {
  metrics: AiReadAppDataAnalysisMetric[]
  groupBy?: AiReadAppDataAnalysisGroup[]
  having?: AiReadAppDataAnalysisHaving[]
  orderBy?: AiReadAppDataAnalysisOrderBy[]
  topN?: number
}

// Display-only numeric metadata for AI text, table and chart rendering.
export type AiNumericDisplayMeta = {
  unit?: string
  unitPosition?: 'prefix' | 'suffix'
  isPercent?: boolean
  decimalPlaces?: number
  thousandSeparator?: string
  decimalSeparator?: string
}

export type AiAnalysisDisplayCell = string

export type AiAnalysisDisplayRow = {
  dimensions: Record<string, AiAnalysisDisplayCell>
  metrics: Record<string, AiAnalysisDisplayCell>
}

export type AiReadAppDataAnalysisResult = {
  metricDefs: Array<{
    key: string
    op: AiReadAppDataAnalysisMetricOp
    field?: string
    displayMeta?: AiNumericDisplayMeta
  }>
  groupDefs: Array<{
    key: string
    field: string
    timeGranularity?: AiReadAppDataTimeGranularity | null
    displayMeta?: AiNumericDisplayMeta
  }>
  rows: Array<{
    dimensions: Record<string, string>
    metrics: Record<string, number | null>
    display: AiAnalysisDisplayRow
  }>
  totals: Record<string, number | null>
  totalsDisplay: Record<string, AiAnalysisDisplayCell>
  meta: {
    sourceCount: number
    matchedCount: number
    groupCount: number
    rowCount: number
    topNApplied: boolean
    truncated: boolean
    scanLimit?: number
    mergeStrategy: 'single'
  }
}

export type AiAnalysisChartDecision = {
  allowed: boolean
  reason?: string
  candidates: AiAnalysisChartKind[]
  preferred?: AiAnalysisChartKind
  resolvedKind?: AiAnalysisChartKind
  userForced?: boolean
}

export type AiSearchEvidenceBreakdown = {
  matchedCount: number
  exactNameMatchCount?: number
  topScore?: number
  topScoreGap?: number
  topScoreRatio?: number
  topCandidateExactNameMatch?: boolean
  dominantTopCandidate?: boolean
}

export type AiSearchAppEvidenceBreakdown = {
  exactAppNameMatch?: boolean
  appNameScore?: number
  appSummaryScore?: number
  semanticScore?: number
  sourceScore?: number
  recordRouteScore?: number
  recordsScore?: number
  tableNameScore?: number
  weakCapabilityScore?: number
  queryShape?: 'aggregation_like' | 'general_records' | 'unknown'
  structuralFitScore?: number
  distinctivenessScore?: number
  mismatchPenalty?: number
  leadEvidenceKind?: 'exact_name' | 'structural_fit' | 'semantic' | 'mixed'
}

export type AiSearchAppsOutput = {
  tool: 'search_apps'
  accessibleAppsSignature?: string
  keywords: string[]
  intent: 'records' | 'unknown'
  totalAccessible: number
  totalMatched: number
  totalReturned: number
  truncated: boolean
  convergence: AiSearchConvergence
  topScore: number
  topScoreGap: number
  topScoreRatio?: number
  topCandidateAppId: string
  dominantTopCandidate?: boolean
  resultSignature: string
  candidateWeakSignature?: string
  noNewCandidates?: boolean
  topCandidateStable?: boolean
  stableTopCandidateRounds?: number
  requiresDisambiguation: boolean
  ambiguitySignals: string[]
  evidenceStrength: AiEvidenceStrength
  evidenceBreakdown: AiSearchEvidenceBreakdown
  summary: string
  apps: Array<{
    appId: string
    appName: string
    score: number
    summary: string
    matchReasons: string[]
    memoryStatus: string
    levels: AiMemoryLevelState
    capabilities: {
      sourceCount: number
      supportsRecords: boolean
    }
    evidenceStrength: AiEvidenceStrength
    evidenceBreakdown: AiSearchAppEvidenceBreakdown
  }>
}

export type AiAppMemoryDataShape = 'workflow' | 'master' | 'transaction' | 'form' | 'document' | 'mixed'
export type AiAppKind = 'document' | 'form' | 'mixed'
export type AiAppViewType = 'document' | 'form' | 'table'
export type AiRowCountBucket = 'empty' | 'small' | 'medium' | 'large' | 'huge' | 'unknown'
export type AiAppMemoryWarmupPhase = 'catalog' | 'profile' | 'deep'
export type AiAppMemoryWarmupStatus = 'missing' | 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'expired'
export type AiAppMemoryWarmupTraceKind = 'search_apps' | 'prime_search_app_memories' | 'get_app_memory' | 'read_app_data'
export const AI_SEMANTIC_BOOTSTRAP_PENDING_REASONS = [
  'create',
  'import',
  'publish',
  'ai-permission',
  'search_top1',
  'get_app_memory',
] as const
export type AiSemanticBootstrapPendingReason = typeof AI_SEMANTIC_BOOTSTRAP_PENDING_REASONS[number]
export const AI_SEMANTIC_BOOTSTRAP_PENDING_SOURCE_SCOPE_LIMIT = 4
export const AI_APP_MEMORY_WARMUP_CONTEXT_STRATEGIES = [
  'request_only',
  'request_plus_merged',
  'legacy_hotspot',
] as const
export type AiAppMemoryWarmupContextStrategy = typeof AI_APP_MEMORY_WARMUP_CONTEXT_STRATEGIES[number]
export const AI_APP_MEMORY_WARMUP_SKIP_REASONS = [
  'no_permission_scoped_targets',
  'no_effective_progress',
  'no_eligible_sources',
] as const
export type AiAppMemoryWarmupSkipReason = typeof AI_APP_MEMORY_WARMUP_SKIP_REASONS[number]

export type AiDocumentContract = {
  source: 'explicit-view' | 'detected-structure'
  viewId?: string
  sourceId: string
  sourceName: string
  directorySourceId: string
  directorySourceName: string
  titleFieldId: string
  catalogFieldId: string
  catalogTitleFieldId?: string
  contentFieldId: string
  publishedFieldId?: string
}

export type AiAppViewProfile = {
  summary: string
  // Document views are treated as form-record views, not full-text content sources.
  documentViews: Array<{
    viewId: string
    viewName: string
    sourceId: string
    sourceName: string
    contract: AiDocumentContract
  }>
  formViewSourceIds: string[]
  tableViewSourceIds: string[]
}

export type AiWorkflowProfile = {
  hasWorkflow: boolean
  sourceIds: string[]
  summary: string
}

export type AiSourceEnumSketch = {
  fieldId: string
  fieldName: string
  values: Array<{
    value: string
    count: number
  }>
  sampleSize: number
  truncated: boolean
}

export type AiSourceDataProfile = {
  rowCountBucket: AiRowCountBucket
  rowCountApprox?: number
  lastCountedAt?: number
  viewTypes?: AiAppViewType[]
  hasWorkflow?: boolean
  enumSketches?: AiSourceEnumSketch[]
}

export type AiAppEntryPoint = {
  mode: 'records'
  targetType: 'source'
  targetId: string
  label: string
  summary: string
  priority: number
}

// `sourceRoleHints` must describe source-bound facts only, for example
// "fee_form records fee applications". It must never encode
// "read fee_form first" or any other recommended next step.
//
// In this rollout, app-level persisted semantics are intentionally limited:
// `relationOverview` and `sourceRoleHints` are the only required stable
// source-bound app fields. `summary` / `primaryUseCases` / `keyEntities` /
// `keyActions` / `featureTags` / `doNotUseFor` may remain empty unless they
// can be deterministically rebuilt from persisted source facts and source
// semantic summaries.
//
// `derivedSummary` must be permission-safe and deterministically rebuilt from
// persisted source facts. It must never contain broad app semantics that
// cannot be mapped back to surviving sourceIds after AI permission filtering.
export type AiAppSemanticProfile = {
  summary: string
  derivedSummary: string
  businessDomain?: string
  primaryUseCases: string[]
  keyEntities: string[]
  keyActions: string[]
  featureTags: string[]
  relationOverview: string[]
  sourceRoleHints: string[]
  doNotUseFor: string[]
  confidence: number
  evidenceCount: number
  lastVerifiedAt?: number
  generatedBy: 'heuristic' | 'llm' | 'llm+verified'
}

export type AiAppSemanticSourceFact = {
  sourceId: string
  relationFacts: string[]
  roleFacts: string[]
}

export type AiSemanticBootstrapPending = {
  appId: string
  requestedAt: number
  reason: AiSemanticBootstrapPendingReason
  requestedSourceIds?: string[]
  mergedSourceIds?: string[]
  lastTriggerReason?: AiSemanticBootstrapPendingReason
  lastTriggerTraceId?: string
  lastTriggerToolCallId?: string
  lastTriggerAt?: number
  retryCount?: number
  lastAttemptAt?: number
  nextRetryAt?: number
  lastError?: string
  autoRetryStoppedAt?: number
}

export type AiSemanticDeepHitWatermark = {
  lastHitAt: number
  exposureHits: number
  confirmedHits: number
  memoryHits: number
  readHits: number
}

export type AiDeepWarmupReasonCode =
  | 'no_eligible_sources'
  | 'invalid_result_payload'
  | 'no_effective_progress'
  | 'provider_auth'
  | 'provider_quota'
  | 'provider_timeout'
  | 'provider_unknown'

export type AiDeepWarmupScheduleReason =
  | 'bootstrap'
  | 'hotspot'

export type AiDeepWarmupNonEligibleReason =
  | 'empty_source_index'
  | 'no_record_sources'
  | 'no_structure_ready_record_sources'

export type AiAppMemoryWarmupPhaseState = {
  status: AiAppMemoryWarmupStatus
  updatedAt?: number
  durationMs?: number
  lastError?: string
  taskKey?: string
  fingerprint?: string
  retryCount?: number
  nextRetryAt?: number
  hitWatermark?: AiSemanticDeepHitWatermark
  reasonCode?: AiDeepWarmupReasonCode
  scheduleReason?: AiDeepWarmupScheduleReason
  eligibleSourceCount?: number
  nonEligibleReason?: AiDeepWarmupNonEligibleReason
  requestedSourceCount?: number
  mergedSourceCount?: number
  selectedSourceCount?: number
  contextStrategy?: AiAppMemoryWarmupContextStrategy
  skipReason?: AiAppMemoryWarmupSkipReason
}

export type AiAppMemoryWarmupState = {
  phases: {
    catalog: AiAppMemoryWarmupPhaseState
    profile: AiAppMemoryWarmupPhaseState
    deep: AiAppMemoryWarmupPhaseState
  }
  queueDepth?: number
  lastWarmAt?: number
  lastError?: string
  semanticBootstrapPending?: AiSemanticBootstrapPending
}

export type AiAppMemoryWarmupLedgerEvent = {
  id: string
  kind?: 'warmup' | 'maintenance'
  appId?: string
  phase?: AiAppMemoryWarmupPhase
  status: AiAppMemoryWarmupStatus
  taskKey?: string
  updatedAt: number
  durationMs?: number
  queueDepth?: number
  message?: string
  lastError?: string
}

export type AiAppMemoryWarmupMaintenanceState = {
  lastSweepAt?: number
  lastCleanupAt?: number
  expiredTaskCount?: number
  zombieTaskCount?: number
  prunedHitCount?: number
  cleanedAppCount?: number
  zombieTaskKeys?: string[]
}

export type AiWarmupActivityKind =
  | 'pointer'
  | 'keyboard'
  | 'wheel'
  | 'visibility'
  | 'route'
  | 'open_app'
  | 'editor'
  | 'save'
  | 'submit'
  | 'publish'
  | 'import'
  | 'foreground_ai'
  | 'server_write'

export type AiWarmupActivitySnapshot = {
  lastUserActivityAt: number
  lastForegroundAiActivityAt: number
  lastServerWriteActivityAt: number
  lastWarmupStartedAt?: number
  lastWarmupCanceledAt?: number
  lastActivityReason?: string
  lastCancelReason?: string
  activityEpoch: number
  globalIdleAgeMs: number
  scopedIdleAgeByAppId: Record<string, number>
}

export type AiWarmupSchedulerDebugState = {
  idleEligible: boolean
  idleAgeMs: number
  requiredIdleMs: number
  pausedReason?: string
  nextEligibleAt?: number
  activityEpoch: number
  queueDepth: number
  runningTaskKey?: string
  lastCanceledAt?: number
  canceledCount: number
  skippedBecauseActiveCount: number
}

export type AiAppMemoryWarmupLedger = {
  updatedAt: number
  isIdle: boolean
  activeForegroundRequests: number
  lastForegroundActivityAt: number
  activity: AiWarmupActivitySnapshot
  scheduler: AiWarmupSchedulerDebugState
  queueDepth: number
  inFlightKeys: string[]
  maintenance: AiAppMemoryWarmupMaintenanceState
  apps: Record<string, {
    appId: string
    appName: string
    appKind: AiAppKind
    levels: AiMemoryLevelState
    warmupState: AiAppMemoryWarmupState
  }>
  semanticBootstrapPendingApps?: Record<string, AiSemanticBootstrapPending>
  events: AiAppMemoryWarmupLedgerEvent[]
}

export type AiAppMemoryWarmupTrace = {
  id: string
  kind: AiAppMemoryWarmupTraceKind
  traceId?: string
  toolCallId?: string
  round?: number
  appId?: string
  updatedAt: number
  durationMs?: number
  intent?: 'records' | 'unknown'
  keywords?: string[]
  accessibleAppCount?: number
  manifestReadyCount?: number
  coldAppCount?: number
  coldPrimeAppIds?: string[]
  neutralStructurePrimeAppIds?: string[]
  topCandidateStructurePrimeAppIds?: string[]
  returnedAppIds?: string[]
  topCandidateAppId?: string
  convergence?: AiSearchConvergence
  requiresDisambiguation?: boolean
  targetLevel?: 'catalog' | 'structure'
  appIds?: string[]
  joinTimeoutMs?: number
  scheduledCount?: number
  settledCount?: number
  timeoutCount?: number
  failedCount?: number
  requestedLevel?: 'catalog' | 'structure'
  beforeCatalogLevel?: string
  beforeStructureLevel?: string
  afterCatalogLevel?: string
  afterStructureLevel?: string
  onsiteBuildMs?: number
  warmupStateBefore?: AiAppMemoryWarmupState
  warmupStateAfter?: AiAppMemoryWarmupState
  mode?: AiReadAppDataMode
  targetIds?: string[]
  sourceIds?: string[]
  resultKind?: string
  partial?: boolean
  failedTargetCount?: number
  semanticScheduled?: boolean
  semanticScheduleReason?: AiSemanticBootstrapPending['reason']
  semanticRequestedSourceIds?: string[]
  semanticMergedSourceIds?: string[]
  semanticSelectedSourceIds?: string[]
  semanticContextStrategy?: AiAppMemoryWarmupContextStrategy
  semanticSkippedReason?: AiAppMemoryWarmupSkipReason
  semanticWarmupHit?: boolean
  semanticSummaryAvailable?: boolean
  derivedSummaryAvailable?: boolean
}

export type AiAppMemoryWarmupTraceQuery = {
  kind?: AiAppMemoryWarmupTraceKind
  traceId?: string
  appId?: string
  limit?: number
}

export type AiAppMemoryEvidenceProfile = {
  dataShape?: AiAppMemoryDataShape
  businessObjects?: string[]
  recordRouteHints?: string[]
  actionHints?: string[]
  statusHints?: string[]
  attributeHints?: string[]
  timeFieldHints?: string[]
  metricHints?: string[]
  relationHints?: string[]
  contentHints?: string[]
  semanticFitHints?: string[]
  doNotUseFor?: string[]
}

export type AiGetAppMemoryOutput = {
  tool: 'get_app_memory'
  accessibleAppsSignature?: string
  request: {
    level: 'catalog' | 'structure'
    focus: {
      sourceIds: string[]
    }
  }
  app: {
    appId: string
    appName: string
    appKind: AiAppKind
    summary: string
    domainKeywords: string[]
    answerBoundaries: string[]
    memoryStatus: string
    levels: AiMemoryLevelState
    viewProfile: AiAppViewProfile
    workflowProfile: AiWorkflowProfile
    entryPoints: AiAppEntryPoint[]
    warmupState: AiAppMemoryWarmupState
    semanticProfile: AiAppSemanticProfile
    counts: {
      sourceCount: number
    }
  }
  evidenceProfile: AiAppMemoryEvidenceProfile
  sources: Array<{
    sourceId: string
    sourceName: string
    tableId: string
    tableName: string
    kind: string
    role: string
    memoryStatus: string
    levels: AiMemoryLevelState
    summary: string
    whenToUse: string
    viewTypes: AiAppViewType[]
    hasWorkflow: boolean
    rowCountBucket: AiRowCountBucket
    dataProfile?: AiSourceDataProfile
    keyFields: Array<{
      id: string
      name: string
      type: string
      semanticType?: string
      displayMeta?: AiNumericDisplayMeta
    }>
    recordRouteHints?: string[]
    typicalQuestions?: string[]
    fields: AiSourceMemory['fields']
    relations: AiSourceMemory['relations']
    queryHints: AiSourceMemory['queryHints']
    doNotUseFor: string[]
  }>
}

export type AiReadAppDataTargetRef = {
  type: AiReadAppDataTargetType
  id: string
  appId?: string | null
  name?: string
  path?: string
}

export type AiReadAppDataResolvedRequest = {
  executionPreference: AiReadAppDataExecutionPreference
  returnMode: AiReadAppDataReturnMode
  partialPolicy: AiReadAppDataPartialPolicy
  usedLegacyTarget: boolean
  filters?: Record<string, unknown> | unknown[]
  groupBy?: string
  timeGranularity?: AiReadAppDataTimeGranularity | null
  minCount?: number
  topN?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  analysis?: AiReadAppDataAnalysis
}

export type AiReadAppDataExecutionSummary = {
  strategy: AiRuntimeExecutionStrategy
  executionPreference: AiReadAppDataExecutionPreference
  returnMode: AiReadAppDataReturnMode
  partialPolicy: AiReadAppDataPartialPolicy
  batchSize: number
  partial: boolean
  succeededCount: number
  failedCount: number
  queuedCount: number
  timedOutCount: number
  achievedConcurrency: number
  durationMs?: number
  circuitBroken: boolean
}

export type AiReadAppDataSucceededTarget = {
  id: string
  name?: string
}

export type AiReadAppDataFailedTarget = AiReadAppDataSucceededTarget & {
  error: string
  timedOut?: boolean
  queued?: boolean
}

export type AiReadAppDataPerTargetResult = {
  target: AiReadAppDataTargetRef
  ok: boolean
  kind?: 'record_analysis' | 'record_total' | 'record_aggregate' | 'record_rows'
  answerText?: string
  itemsText?: string
  total?: number
  matchedCount?: number
  returnedRows?: number
  resultCount?: number
  fields?: string[]
  records?: Array<Record<string, unknown>>
  aggregation?: Record<string, unknown> | null
  analysisResult?: AiReadAppDataAnalysisResult | null
  error?: string
  durationMs: number
  timedOut?: boolean
  queued?: boolean
}

export type AiReadAppDataResult =
  | {
      kind: 'record_analysis'
      summary: string
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      returnedRows: number
      resultCount: number
      fields: string[]
      records: Array<Record<string, unknown>>
      aggregation: Record<string, unknown> | null
      analysisResult: AiReadAppDataAnalysisResult
      executionSummary: AiReadAppDataExecutionSummary
    }
  | {
      kind: 'record_total'
      summary: string
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      fields: string[]
      records: Array<Record<string, unknown>>
      aggregation: Record<string, unknown> | null
      executionSummary: AiReadAppDataExecutionSummary
    }
  | {
      kind: 'record_aggregate' | 'record_rows'
      summary: string
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      returnedRows: number
      resultCount: number
      fields: string[]
      records: Array<Record<string, unknown>>
      aggregation: Record<string, unknown> | null
      executionSummary: AiReadAppDataExecutionSummary
    }
  | {
      kind: 'batch_record_rows' | 'batch_record_total' | 'batch_record_aggregate'
      summary: string
      answerText: string
      itemsText: string
      mergedTotal: number
      mergedResultCount: number
      mergedReturnedRows: number
      mergedFields: string[]
      mergedRecords: Array<Record<string, unknown>>
      mergedAggregation: Record<string, unknown> | null
      perTargetResults: AiReadAppDataPerTargetResult[]
      partial: boolean
      failedTargets: AiReadAppDataFailedTarget[]
      succeededTargets: AiReadAppDataSucceededTarget[]
      executionSummary: AiReadAppDataExecutionSummary
    }

export type AiReadAppDataEvidenceItem =
  | {
      kind: 'record'
      index: number
      preview: string
      record: Record<string, unknown>
    }

export type AiReadAppDataDecision = {
  relativeTimeFilterMissing?: boolean
  relativeTimeRiskHint?: string
}

export type AiReadAppDataOutput = {
  tool: 'read_app_data'
  accessibleAppsSignature?: string
  status: 'ok' | 'partial' | 'need_clarify'
  summary: string
  relativeTimeFilterMissing?: boolean
  decision?: AiReadAppDataDecision
  resolved: {
    appId: string
    appName: string
    mode: AiReadAppDataMode
    target?: AiReadAppDataTargetRef
    targets: AiReadAppDataTargetRef[]
    request: AiReadAppDataResolvedRequest
  }
  result: AiReadAppDataResult
  evidence: AiReadAppDataEvidenceItem[]
}

export type AiThreadVerifiedTarget = {
  appId: string
  appName?: string
  targetId: string
  targetName?: string
  targetType: AiReadAppDataTargetType
  mode: AiReadAppDataMode
}

export type AiThreadRecordAnalysisSnapshotResult = {
  metricDefs?: AiReadAppDataAnalysisResult['metricDefs']
  groupDefs?: AiReadAppDataAnalysisResult['groupDefs']
  rows?: AiReadAppDataAnalysisResult['rows']
  totals?: AiReadAppDataAnalysisResult['totals']
  totalsDisplay?: AiReadAppDataAnalysisResult['totalsDisplay']
  meta?: Partial<AiReadAppDataAnalysisResult['meta']>
}

export type AiThreadCrossAppAnalysisRequestSummary = {
  mode: 'aggregate'
  filters?: Record<string, unknown> | unknown[]
  groupBy?: string
  timeGranularity?: AiReadAppDataTimeGranularity | null
  topN?: number
  analysis?: {
    metrics: Array<{
      op: AiReadAppDataAnalysisMetricOp
      field?: string
      as: string
    }>
    groupBy?: Array<{
      field: string
      as?: string
      timeGranularity?: AiReadAppDataTimeGranularity | null
    }>
    having?: Array<{
      metric: string
      op: AiReadAppDataAnalysisCompareOp
      value: string | number | boolean | null
    }>
    orderBy?: Array<{
      metric?: string
      group?: string
      direction?: AiReadAppDataAnalysisOrderDirection
    }>
    topN?: number
  }
}

export type AiThreadRecordAnalysisSnapshot = {
  appId: string
  appName?: string
  targetId?: string
  targetName?: string
  targetType?: AiReadAppDataTargetType
  mode: 'aggregate'
  requestSignature?: string
  requestSummary?: AiThreadCrossAppAnalysisRequestSummary
  analysisResult: AiThreadRecordAnalysisSnapshotResult
}

export type AiThreadCrossAppAnalysisSlice = {
  appId: string
  appName?: string
  targetId?: string
  targetName?: string
  targetType?: AiReadAppDataTargetType
  requestSignature?: string
  requestSummary?: AiThreadCrossAppAnalysisRequestSummary
  analysisResult: AiThreadRecordAnalysisSnapshotResult
}

export type AiThreadCrossAppCompareAlignmentSummary = {
  kind: 'compare'
  metricKeys: string[]
  groupKeys: string[]
  timeGranularity?: AiReadAppDataTimeGranularity | null
}

export type AiThreadCrossAppMergeAlignmentSummary = {
  kind: 'merge'
  metricKeys: string[]
  groupKeys: string[]
  mergeKey: string
}

export type AiThreadCrossAppCompareBundle = {
  mode: 'compare'
  status: 'complete'
  expectedAppIds: string[]
  requestSignature: string
  requestSummary: AiThreadCrossAppAnalysisRequestSummary
  alignmentSummary: AiThreadCrossAppCompareAlignmentSummary
  slices: AiThreadCrossAppAnalysisSlice[]
}

export type AiThreadCrossAppMergeBundle = {
  mode: 'merge'
  status: 'complete'
  expectedAppIds: string[]
  requestSignature: string
  requestSummary: AiThreadCrossAppAnalysisRequestSummary
  alignmentSummary: AiThreadCrossAppMergeAlignmentSummary
  slices: AiThreadCrossAppAnalysisSlice[]
}

export type AiThreadCrossAppAnalysisBundle =
  | AiThreadCrossAppCompareBundle
  | AiThreadCrossAppMergeBundle

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
    timeGranularity?: AiReadAppDataTimeGranularity | null
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

export type AiPendingCrossAppResolutionChoice = {
  key: '1' | '2'
  profile: 'cross_app_compare' | 'cross_app_merge'
  aliases: string[]
}

export type AiPendingCrossAppResolutionState = {
  kind: 'compare_merge_choice'
  choices: [
    AiPendingCrossAppResolutionChoice,
    AiPendingCrossAppResolutionChoice,
  ]
}

export type AiThreadRuntimeDiagnostics = {
  currentTopCandidateStableRounds?: number
  lastExecutionStrategy?: AiRuntimeExecutionStrategy
  lastBatchPartial?: boolean
}

export type AiThreadRuntimeState = {
  scene?: AiScene
  currentProfile?: AiConversationProfile
  currentAppId?: string
  currentAppName?: string
  currentIntent?: AiThreadRuntimeIntent
  currentContextKind?: AiThreadRuntimeContextKind
  currentTopAppId?: string
  currentAccessibleAppsSignature?: string
  currentSearchSignature?: string
  currentSearchConvergence?: AiSearchConvergence
  currentSearchWeakSignature?: string
  currentTopCandidateStableRounds?: number
  diagnostics?: AiThreadRuntimeDiagnostics
  currentSourceId?: string
  currentSourceName?: string
  currentBatchAppId?: string
  currentBatchTargetIds?: string[]
  verifiedTargets?: AiThreadVerifiedTarget[]
  recordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
  activeRecordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
  latestRecordAnalysisSnapshot?: AiThreadRecordAnalysisSnapshot
  latestCrossAppScopeTransition?: AiCrossAppScopeTransition
  latestCrossAppAlignmentState?: AiCrossAppAlignmentState
  latestCrossAppAnalysisBundle?: AiThreadCrossAppAnalysisBundle
  pendingCrossAppResolution?: AiPendingCrossAppResolutionState
  lastExecutionStrategy?: AiRuntimeExecutionStrategy
  lastBatchPartial?: boolean
  recentSourceIds?: string[]
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

export type AiThreadAppScope = {
  appIds: string[]
}

export type AiAgent = {
  id: string
  ownerAccountId: string
  name: string
  appScope?: AiThreadAppScope | null
  pinned?: boolean
  pinTime?: number | null
  sharing?: boolean
  shareToken?: string | null
  createTime?: number
  updateTime?: number
  deleteTime?: number | null
}

export type AiThread = {
  id: string
  agentId: string
  ownerAccountId: string
  kind: AiThreadKind
  title: string
  appScope?: AiThreadAppScope | null
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: AiThreadModelSelectionSource | null
  pinned?: boolean
  pinTime?: number | null
  visitorKey?: string | null
  visitorProfile?: AiThreadVisitorProfile | null
  runtimeState?: AiThreadRuntimeState | null
  contextState?: AiThreadContextState | null
  createTime?: number
  updateTime?: number
  deleteTime?: number | null
}

export type AiThreadShare = {
  id: string
  agentId: string
  shareToken: string
  enabled: boolean
  createTime?: number
  updateTime?: number
}

export type AiSourceMemoryRole = 'transaction' | 'master' | 'log'
export type AiMemoryLevelStatus = 'missing' | 'ready' | 'partial' | 'stale' | 'failed'
export type AiMemoryChangeSeverity = 'none' | 'meta' | 'additive' | 'breaking' | 'removed'

export type AiMemoryLevelState = {
  catalog: AiMemoryLevelStatus
  structure: AiMemoryLevelStatus
  semantic: AiMemoryLevelStatus
}

export type AiSourceMemoryField = {
  id: string
  name: string
  type: string
  semanticType?: string
  nullable?: boolean
  displayMeta?: AiNumericDisplayMeta
}

export type AiSourceMemory = {
  sourceId: string
  sourceName: string
  kind: 'table' | 'document-table'
  role: AiSourceMemoryRole
  levels: AiMemoryLevelState
  catalogFingerprint: string
  structureFingerprint?: string
  updatedAt: number
  description: string
  viewTypes: AiAppViewType[]
  hasWorkflow: boolean
  dataProfile: AiSourceDataProfile
  fields: AiSourceMemoryField[]
  relations: Array<{
    fieldId: string
    targetSourceId: string
    relationType: 'one-to-one' | 'one-to-many' | 'self'
  }>
  queryHints: {
    keywordFields: string[]
    filterFields: string[]
    timeFields: string[]
    metricFields: string[]
    entityFields: string[]
  }
  semanticSummary: {
    typicalQuestions: string[]
    doNotUseFor: string[]
    observedSummary?: string
    observationNotes?: string[]
    evidenceCount: number
    confidence: number
    lastVerifiedAt?: number
  }
}

export type AiAppMemoryManifest = {
  appId: string
  appName: string
  appKind: AiAppKind
  status: 'ready' | 'building' | 'stale' | 'failed'
  levels: AiMemoryLevelState
  version: string
  generatedAt: number
  updatedAt: number
  fingerprint: {
    metaHash: string
    bodyHash: string
    schemaHash: string
  }
  appSummary: {
    purpose: string
    domainKeywords: string[]
    answerBoundaries: string[]
  }
  viewProfile: AiAppViewProfile
  workflowProfile: AiWorkflowProfile
  semanticProfile: AiAppSemanticProfile
  semanticProfileSourceFacts: AiAppSemanticSourceFact[]
  sourceIndex: Array<{
    sourceId: string
    sourceName: string
    kind: 'table' | 'document-table'
    role: AiSourceMemoryRole
    levels: AiMemoryLevelState
    catalogFingerprint: string
    structureFingerprint?: string
    viewTypes: AiAppViewType[]
    hasWorkflow: boolean
    rowCountBucket: AiRowCountBucket
  }>
  routeIndex: {
    recordRoutes: Array<{
      sourceId: string
      sourceName: string
      role: AiSourceMemoryRole
      keywords: string[]
      entityFields: string[]
      timeFields: string[]
      metricFields: string[]
    }>
  }
  entryPoints: AiAppEntryPoint[]
  warmupState: AiAppMemoryWarmupState
  readPolicies: {
    clarifyRules: string[]
    recordLookupRules: string[]
    aggregationRules: string[]
    fallbackRules: string[]
  }
}

export type AiMemoryUpdateMode = 'noop' | 'patch' | 'rebuild'

export type AiMemoryDiffPlan = {
  appId: string
  mode: AiMemoryUpdateMode
  reasons: string[]
  changedSources: string[]
  removedSources: string[]
  sourceDiffs: Array<{
    sourceId: string
    severity: AiMemoryChangeSeverity
    reasons: string[]
  }>
}

export type AiThreadStreamRequest = {
  threadId?: string
  message: string
  nocodeIds?: string[]
  providerId?: string
  modelId?: string
  model?: string
  traceId?: string
  metadata?: Record<string, any>
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
  metadata?: Record<string, any>
}

export type AiResolvedModelSelection = Required<Pick<AiThreadModelSelection, 'providerId' | 'modelId' | 'model'>> & {
  modelSelectionSource: AiThreadModelSelectionSource
}

export type {
  AiFeatureFlags,
  AiModelCatalog,
  AiProviderConfig,
  AiSettings,
  AiThreadModelSelection,
  AiThreadModelSelectionSource,
}
