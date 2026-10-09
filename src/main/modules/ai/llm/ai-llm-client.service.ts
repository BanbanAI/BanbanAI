import { Injectable } from '@nestjs/common'
import { extractToolProtocolSignals, isLikelyToolProtocolText, normalizeInterimText } from '@common/utils/aiToolProtocol'
import {
  normalizeWorkbenchAiFormFillContext,
  normalizeWorkbenchAiFormFillToolInput,
  WORKBENCH_AI_FILL_CURRENT_FORM_TOOL,
} from '@common/utils/workbenchAiFormFill'
import {
  AiActionCall,
  AiActionDefinition,
  AiActionKind,
  AiActionResult,
  AiConversationProfile,
  AiReasoningDecision,
  AiReasoningMode,
  AiFeatureFlags,
  AiMessageRole,
  AiPromptDiagnostics,
  AiRuntimeExecutionStrategy,
  AiSearchConvergence,
  AiStreamEventType,
  AiTurnDiagnostics,
  AiTurnDiagnosticsRound,
  AiThreadRuntimeState,
  AiThreadContextState,
  AiTokenUsage,
  AiToolDefinition,
  AiToolExecutionContext,
  AiToolProgressDiagnostics,
} from '../ai.types'
import { AiConfigService } from '../config/ai-config.service'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiOpenAiService } from '../openai/ai-openai.service'
import { AiReasoningPolicyService } from '../runtime/ai-reasoning-policy.service'
import { buildRepeatedSearchUnsupportedIntentMessage } from '../runtime/ai-records-only-policy'
import { AiScenarioPolicyService } from '../runtime/ai-scenario-policy.service'
import { AiCrossAppAnalysisBundleService } from '../runtime/ai-cross-app-analysis-bundle.service'
import { AiRuntimeStateReducerService } from '../runtime/ai-runtime-state-reducer.service'
import { AiLocalToolService } from '../tools/local-tool.service'
import { collectPromptExplicitAppNameSignals, hasExactExplicitAppNameKeyword } from '../utils/ai-explicit-app-name-signal.util'
import { AiClientToolBridgeService } from '../nocode-editor/client-tool-bridge.service'
import { AiAttachmentService } from '../thread/ai-attachment.service'
import {
  AI_READ_ATTACHMENT_TOOL_NAME,
  type AiAttachmentReadBudget,
  collectAiAttachmentReferences,
  withAiReadAttachmentTool,
} from '../thread/ai-attachment-tool'

type DynamicRecord = AiActionCall['input']
type DynamicValue = AiActionResult['output']

type RawToolCall = {
  id: string
  name: string
  kind: AiActionKind
  input: DynamicRecord
}

type PlannedToolCall = {
  id: string
  name: string
  kind: AiActionKind
  input: DynamicRecord
  strategy: AiRuntimeExecutionStrategy
  executionGroup: string
  batchSize: number
  targetIds: string[]
  mergedFromCallIds: string[]
}

type PlannedToolWave = {
  strategy: AiRuntimeExecutionStrategy
  executionGroup: string
  calls: PlannedToolCall[]
}

type PlannedBlockedToolCall = {
  call: PlannedToolCall
  result: AiActionResult
}

type ToolRoundPlan = {
  waves: PlannedToolWave[]
  blocked: PlannedBlockedToolCall[]
  guardMessage: string
}

type ToolStateGuardReason =
  | 'search_missing_explicit_app_name_keyword'
  | 'weak_search_disambiguation_stop_loss'
  | 'search_repeat_no_new_keywords'
  | 'search_repeat_hard_cap'
  | 'read_app_data_failure_search_reentry_forbidden'
  | 'weak_search_read_requires_disambiguation'
  | 'same_app_compare_search_reentry_forbidden'
  | 'same_app_compare_coverage_sufficient'

type ToolStateGuard = {
  reason: ToolStateGuardReason
  message: string
  metadata?: DynamicRecord
}

type ExecutedToolCallRecord = {
  name: string
  input: DynamicRecord
  result: AiActionResult
}

type ProgressAdvanceGuard = {
  message: string
  suppressBufferedText?: boolean
  fallbackText?: string
}

type RepeatedToolCallState = {
  round: number
  count: number
  consecutiveCount: number
}

type ActiveTurnDiagnosticsRound = {
  round: number
  startedAt: number
  firstTokenAt?: number
  provider?: string
  requestedModel?: string
  publicModel?: string
  effectiveModel?: string
  effectiveModelId?: string
  routePolicyId?: string
  routeVersion?: string
  fallbackHit?: boolean
  requestedReasoningLevel?: AiReasoningDecision['level']
  effectiveReasoningLevel?: AiReasoningDecision['level']
  reasoningMode?: AiReasoningMode
  reasoningReasonCodes?: string[]
  finishReason?: string
  usage: AiTokenUsage
  promptDiagnostics?: AiPromptDiagnostics
}

type RoundDecisionContext = {
  runtimeState: AiThreadRuntimeState
  conversationProfile?: AiConversationProfile
  featureFlags: AiFeatureFlags
}

@Injectable()
export class AiLlmClientService {
  private static readonly MAX_TOOL_ROUNDS = 12
  private static readonly MAX_PARALLEL_TOOL_CALLS_PER_WAVE = 4

  constructor(
    private readonly openAiService: AiOpenAiService,
    private readonly localToolService: AiLocalToolService,
    private readonly aiConfigService: AiConfigService,
    private readonly agentLogService: AiAgentLogService,
    private readonly reasoningPolicyService: AiReasoningPolicyService,
    private readonly scenarioPolicyService: AiScenarioPolicyService,
    private readonly runtimeStateReducerService: AiRuntimeStateReducerService,
    private readonly clientToolBridge: AiClientToolBridgeService,
    private readonly crossAppAnalysisBundleService: AiCrossAppAnalysisBundleService = new AiCrossAppAnalysisBundleService(),
    private readonly attachmentService?: AiAttachmentService,
  ) {}

  async streamAnswer(options: {
    threadId: string
    traceId?: string
    providerId?: string
    modelId?: string
    model?: string
    disableBuiltinAppTools?: boolean
    systemPrompt: string
    userMessage?: string
    userPrompt: string
    userMetadata?: DynamicRecord | null
    historyMessages: Array<{ role: AiMessageRole; content: string; metadata?: DynamicRecord | null }>
    runtimeState?: AiThreadRuntimeState | null
    contextState?: AiThreadContextState | null
    toolContext: AiToolExecutionContext
    signal?: AbortSignal
    onDelta?: (payload: {
      text: string
      round: number
      interim: boolean
      clearInterim?: boolean
    }) => void | Promise<void>
    onToolCall?: (payload: {
      id: string
      name: string
      input: DynamicRecord
      round: number
      strategy: AiRuntimeExecutionStrategy
      batchSize: number
      executionGroup: string
      targetIds: string[]
      queued?: boolean
    }) => void | Promise<void>
    onToolResult?: (payload: {
      callId: string
      name: string
      ok: boolean
      output?: DynamicValue
      error?: string
      input?: DynamicRecord
      round: number
      durationMs: number
      strategy: AiRuntimeExecutionStrategy
      batchSize: number
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
      executionGroup: string
      targetIds: string[]
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
    }) => void | Promise<void>
    onRoundStart?: (payload: {
      round: number
    }) => void | Promise<void>
    onContextCompaction?: (payload: {
      status: 'start' | 'completed'
      metadata?: Record<string, any>
      round: number
    }) => void | Promise<void>
  }) {
    this.throwIfAborted(options.signal)
    const intentPrompt = this.normalizeOptionalText(options.userMessage) || options.userPrompt
    const builtinAppTools = options.disableBuiltinAppTools === true
      ? []
      : this.localToolService.listTools('builtin-app')
        .filter(tool => tool.name !== WORKBENCH_AI_FILL_CURRENT_FORM_TOOL
          || Boolean(normalizeWorkbenchAiFormFillContext(options.toolContext.currentPageFormFillContext)))
    const historicalAttachmentReferences = collectAiAttachmentReferences(options.historyMessages)
    const accessibleHistoricalAttachments = this.attachmentService && historicalAttachmentReferences.length
      ? await this.attachmentService.listAccessibleReferences(
        options.toolContext.accountId,
        options.threadId,
        historicalAttachmentReferences,
      )
      : []
    const actions = withAiReadAttachmentTool(
      this.buildActionDefinitions(builtinAppTools),
      accessibleHistoricalAttachments.length > 0,
    )
    const messages = [
      ...options.historyMessages.filter(item => this.shouldKeepHistoryMessage(item)),
      {
        role: AiMessageRole.USER,
        content: options.userPrompt,
        metadata: options.userMetadata || null,
      },
    ]

    const actionResults: AiActionResult[] = []
    const executedToolCalls: ExecutedToolCallRecord[] = []
    const successfulToolResultCache = new Map<string, AiActionResult>()
    const repeatedToolCallCounts = new Map<string, RepeatedToolCallState>()
    const attachmentReadBudget: AiAttachmentReadBudget = { totalTextLength: 0 }
    const usage = this.createEmptyUsage()
    let finishReason = 'stop'
    let finalText = ''
    let conversationProfile = this.resolveConversationProfile(options.runtimeState, options.toolContext)
    const initialFeatureFlags = await this.aiConfigService.getFeatureFlags(conversationProfile)
    const answerStartedAt = Date.now()
    const modelRounds: AiTurnDiagnosticsRound[] = []
    let parallelToolCallsDisabledForSilentRetry = false
    let seededPreToolVisiblePlan = false
    const finalizeAnswer = (text: string, nextFinishReason: string) => ({
      text,
      usage: this.normalizeUsage(usage),
      finishReason: nextFinishReason,
      diagnostics: this.buildTurnDiagnostics(answerStartedAt, Date.now(), usage, modelRounds, actionResults),
    })

    for (let round = 1; round <= AiLlmClientService.MAX_TOOL_ROUNDS; round += 1) {
      this.throwIfAborted(options.signal)
      await options.onRoundStart?.({
        round,
      })
      const roundContext = await this.buildRoundDecisionContext({
        userPrompt: intentPrompt,
        runtimeState: options.runtimeState,
        actionResults,
        fallbackConversationProfile: conversationProfile,
        batchRuntimeStateEnabled: initialFeatureFlags.batchRuntimeStateEnabled,
      })
      conversationProfile = roundContext.conversationProfile
      const chunks: string[] = []
      const roundInterimBuffer: string[] = []
      const toolCalls: RawToolCall[] = []
      const roundResults: AiActionResult[] = []
      let streamedRoundInterimToUi = false
      let roundParallelToolCalls = false
      let roundParallelToolCallsRetried = false
      let roundParallelToolCallsRetryReason = ''
      const reasoningDecision = this.reasoningPolicyService.resolveDecision({
        userMessage: intentPrompt,
        conversationProfile: roundContext.conversationProfile,
        runtimeState: roundContext.runtimeState,
        round,
        actionResults,
      })
      const currentRoundDiagnostics: ActiveTurnDiagnosticsRound = {
        round,
        startedAt: Date.now(),
        requestedModel: this.normalizeOptionalText(options.model),
        requestedReasoningLevel: reasoningDecision.level,
        reasoningReasonCodes: reasoningDecision.reasonCodes,
        usage: this.createEmptyUsage(),
      }
      let currentRoundCompleted = false
      let preToolVisiblePlanEmitted = false
      const roundTraceId = options.traceId || options.toolContext.traceId
      const parallelToolCallsMetadata = this.buildParallelToolCallsMetadata(
        this.shouldEnableParallelToolCalls(roundContext.runtimeState, actionResults),
        parallelToolCallsDisabledForSilentRetry,
      )
      const currentAccessibleAppsSignature = await this.resolveCurrentAccessibleAppsSignature(
        options.toolContext,
        roundContext.featureFlags,
      ) || (
        roundContext.featureFlags.searchAppsCatalogInvalidateEnabled === false
          ? (String(roundContext.runtimeState?.currentAccessibleAppsSignature || '').trim() || undefined)
          : undefined
      )

      if (!seededPreToolVisiblePlan) {
        const earlyVisiblePlanText = (
          this.normalizeConversationProfile(roundContext.conversationProfile) === 'records_query'
          && this.isSameAppMultiFormComparePrompt(intentPrompt)
        )
          ? this.buildSameAppMultiFormComparePlanText()
          : ''
        if (earlyVisiblePlanText) {
          await options.onDelta?.({
            text: earlyVisiblePlanText,
            round,
            interim: true,
          })
          seededPreToolVisiblePlan = true
          preToolVisiblePlanEmitted = true
        }
      }

      await this.logDiagnosticStage(options.threadId, 'AI DIAG model_round_start', {
        stage: 'model_round_start',
        threadId: options.threadId,
        traceId: roundTraceId,
        round,
        providerId: options.providerId || undefined,
        modelId: options.modelId || undefined,
        requestedModel: currentRoundDiagnostics.requestedModel,
        conversationProfile: roundContext.conversationProfile || undefined,
        toolCount: actions.length,
        toolNames: actions.map(item => item.name),
        parallelToolCalls: parallelToolCallsMetadata.parallelToolCalls === true,
        parallelToolCallsRetried: parallelToolCallsMetadata.parallelToolCallsRetried === true,
        parallelToolCallsRetryReason: String(parallelToolCallsMetadata.parallelToolCallsRetryReason || '').trim() || undefined,
        reasoningDecision: {
          level: reasoningDecision.level,
          reasonCodes: reasoningDecision.reasonCodes,
        },
        runtimeDiagnostics: this.buildRuntimeDiagnostics(roundContext.runtimeState),
      })

      try {
        for await (const event of this.openAiService.streamTurn({
          accountId: options.toolContext.accountId,
          accountName: options.toolContext.accountName,
          conversationId: options.threadId,
          providerId: options.providerId,
          modelId: options.modelId,
          model: options.model || '',
          reasoning: reasoningDecision,
          promptVersion: 'thread-memory-v2',
          systemPrompt: options.systemPrompt,
          messages,
          actions,
          actionResults,
          context: {
            accountId: options.toolContext.accountId,
            accountName: options.toolContext.accountName,
            promptVersion: 'thread-memory-v2',
            formSummaries: [],
            actionSummary: actions.map(item => ({
              name: item.name,
              kind: item.kind,
              description: item.description,
            })),
          },
          metadata: {
            runtime: 'thread-memory',
            round,
            traceId: options.traceId || options.toolContext.traceId,
            conversationProfile: roundContext.conversationProfile,
            appScope: options.toolContext.appScope,
            currentAccessibleAppsSignature,
            currentContextKind: roundContext.runtimeState?.currentContextKind,
            verifiedTargets: roundContext.runtimeState?.verifiedTargets,
            recordAnalysisSnapshots: roundContext.runtimeState?.recordAnalysisSnapshots,
            latestCrossAppAnalysisBundle: roundContext.runtimeState?.latestCrossAppAnalysisBundle,
            deterministicAnalysisChartEnabled: roundContext.featureFlags.deterministicAnalysisChartEnabled === true,
            analysisChartModelHintEnabled: roundContext.featureFlags.analysisChartModelHintEnabled === true,
            analysisChartSnapshot: roundContext.runtimeState?.latestRecordAnalysisSnapshot,
            currentIntent: roundContext.runtimeState?.currentIntent,
            contextState: options.contextState,
            ...parallelToolCallsMetadata,
          },
          signal: options.signal,
        })) {
          this.throwIfAborted(options.signal)
          if (event.type === AiStreamEventType.CONTEXT_COMPACTION_START) {
            await options.onContextCompaction?.({ status: 'start', round })
          }
          if (event.type === AiStreamEventType.CONTEXT_COMPACTION_COMPLETED) {
            await options.onContextCompaction?.({
              status: 'completed',
              round,
              metadata: event.raw?.contextCompaction || event.raw,
            })
          }
          if (event.type === AiStreamEventType.DELTA) {
            if (!currentRoundDiagnostics.firstTokenAt) {
              currentRoundDiagnostics.firstTokenAt = Date.now()
            }
            chunks.push(event.text)
            this.appendRoundInterimBuffer(roundInterimBuffer, event.text)
            if (event.text) {
              streamedRoundInterimToUi = true
              await options.onDelta?.({
                text: event.text,
                round,
                interim: true,
              })
            }
            this.throwIfAborted(options.signal)
          }

          if (event.type === AiStreamEventType.ACTION_CALL) {
            if (!preToolVisiblePlanEmitted && !streamedRoundInterimToUi && !toolCalls.length) {
              const preToolVisiblePlanText = this.resolvePreToolVisiblePlanText(
                this.readRoundInterimBuffer(roundInterimBuffer),
                intentPrompt,
                roundContext.conversationProfile,
              )
              if (preToolVisiblePlanText) {
                await options.onDelta?.({
                  text: preToolVisiblePlanText,
                  round,
                  interim: true,
                })
                preToolVisiblePlanEmitted = true
              }
            }
            toolCalls.push(event.action)
          }

          if (event.type === AiStreamEventType.DONE) {
            const roundFinishReason = String(event.finishReason || finishReason)
            const roundUsage = this.normalizeUsage(event.usage) || this.createEmptyUsage()
            roundParallelToolCalls = event.raw?.parallelToolCalls === true
            roundParallelToolCallsRetried = event.raw?.parallelToolCallsRetried === true
            roundParallelToolCallsRetryReason = String(event.raw?.parallelToolCallsRetryReason || '').trim()
            this.mergeUsage(usage, event.usage)
            finishReason = roundFinishReason
            modelRounds.push(this.finalizeTurnDiagnosticsRound(currentRoundDiagnostics, {
              completedAt: Date.now(),
              provider: this.normalizeOptionalText(event.raw?.provider),
              requestedModel: this.normalizeOptionalText(event.raw?.requestedModel) || currentRoundDiagnostics.requestedModel,
              publicModel: this.normalizeOptionalText(event.raw?.publicModel || event.raw?.model),
              effectiveModel: this.normalizeOptionalText(event.raw?.effectiveModel),
              effectiveModelId: this.normalizeOptionalText(event.raw?.effectiveModelId),
              routePolicyId: this.normalizeOptionalText(event.raw?.routePolicyId),
              routeVersion: this.normalizeOptionalText(event.raw?.routeVersion),
              fallbackHit: typeof event.raw?.fallbackHit === 'boolean'
                ? event.raw.fallbackHit
                : undefined,
              requestedReasoningLevel: this.normalizeReasoningLevel(event.raw?.requestedReasoningLevel)
                || currentRoundDiagnostics.requestedReasoningLevel,
              effectiveReasoningLevel: this.normalizeReasoningLevel(event.raw?.effectiveReasoningLevel),
              reasoningMode: this.normalizeReasoningMode(event.raw?.reasoningMode),
              reasoningReasonCodes: this.normalizeReasoningReasonCodes(event.raw?.reasoningReasonCodes)
                || currentRoundDiagnostics.reasoningReasonCodes,
              finishReason: roundFinishReason,
              toolCallCount: toolCalls.length,
              usage: roundUsage,
              promptDiagnostics: this.normalizePromptDiagnostics(event.raw?.promptDiagnostics),
            }))
            currentRoundCompleted = true
          }
        }
      } catch (error) {
        if (!currentRoundCompleted) {
          modelRounds.push(this.finalizeTurnDiagnosticsRound(currentRoundDiagnostics, {
            completedAt: Date.now(),
            finishReason: 'error',
            toolCallCount: toolCalls.length,
            usage: this.createEmptyUsage(),
          }))
          currentRoundCompleted = true
        }
        await this.logDiagnosticStage(options.threadId, 'AI DIAG model_round_error', {
          stage: 'model_round_error',
          threadId: options.threadId,
          traceId: roundTraceId,
          round,
          providerId: options.providerId || undefined,
          modelId: options.modelId || undefined,
          requestedModel: currentRoundDiagnostics.requestedModel,
          conversationProfile: roundContext.conversationProfile || undefined,
          toolCount: actions.length,
          toolNames: actions.map(item => item.name),
          toolCallCount: toolCalls.length,
          parallelToolCalls: parallelToolCallsMetadata.parallelToolCalls === true,
          parallelToolCallsRetried: parallelToolCallsMetadata.parallelToolCallsRetried === true,
          parallelToolCallsRetryReason: String(parallelToolCallsMetadata.parallelToolCallsRetryReason || '').trim() || undefined,
          reasoningDecision: {
            level: reasoningDecision.level,
            reasonCodes: reasoningDecision.reasonCodes,
          },
          runtimeDiagnostics: this.buildRuntimeDiagnostics(roundContext.runtimeState),
          aborted: Boolean(options.signal?.aborted),
          error: this.serializeDiagnosticError(error),
        })
        const aggregateFallbackText = this.buildLatestAggregateAnswerFallback(executedToolCalls, intentPrompt)
        if (aggregateFallbackText) {
          await options.onDelta?.({
            text: aggregateFallbackText,
            round,
            interim: false,
          })
          return finalizeAnswer(aggregateFallbackText, 'stop')
        }
        throw error
      }

      // read_app_data 必须保留模型原始参数；缺少 target.id 时交给 LocalTool 显式报错，
      // Runtime 只允许在失败后给恢复提示，不能自动补 target 执行。
      const plannedToolCalls = toolCalls
      const bufferedRoundText = this.readRoundInterimBuffer(roundInterimBuffer)
      const hasToolCalls = plannedToolCalls.length > 0
      const shouldDropBufferedRoundText = this.shouldDropRoundInterimBuffer(bufferedRoundText, hasToolCalls)
      const toolProtocolConflict = hasToolCalls
        ? this.detectToolProtocolConflict(bufferedRoundText, plannedToolCalls)
        : null

      if (toolProtocolConflict) {
        this.clearRoundInterimBuffer(roundInterimBuffer)
        await this.logDiagnosticStage(options.threadId, 'AI Tool Protocol Conflict', toolProtocolConflict)
        this.appendSystemGuardMessage(messages, this.buildToolProtocolConflictGuardMessage(toolProtocolConflict))
        continue
      }

      const satisfiedReadAppDataFallback = hasToolCalls
        ? this.buildReadAppDataAnswerFallback(executedToolCalls, plannedToolCalls, intentPrompt)
        : ''
      if (satisfiedReadAppDataFallback) {
        if (shouldDropBufferedRoundText) {
          this.clearRoundInterimBuffer(roundInterimBuffer)
        } else if (streamedRoundInterimToUi) {
          this.clearRoundInterimBuffer(roundInterimBuffer)
        } else if (bufferedRoundText.trim()) {
          await this.flushRoundInterimBufferAsUiText(roundInterimBuffer, round, options.onDelta, {
            interim: true,
          })
        }
        await options.onDelta?.({
          text: satisfiedReadAppDataFallback,
          round,
          interim: false,
        })
        return finalizeAnswer(satisfiedReadAppDataFallback, 'stop')
      }

      if (!plannedToolCalls.length) {
        finalText = chunks.join('')
        const progressAdvanceGuard = this.buildProgressAdvanceGuard(
          roundContext.runtimeState,
          actionResults,
          intentPrompt,
          roundContext.conversationProfile,
          finalText || bufferedRoundText,
        )
        if (this.shouldRetrySilentParallelToolCalls({
          parallelToolCalls: roundParallelToolCalls,
          retried: roundParallelToolCallsRetried || parallelToolCallsDisabledForSilentRetry,
          text: finalText || bufferedRoundText,
          progressAdvanceGuard,
        })) {
          parallelToolCallsDisabledForSilentRetry = true
          this.clearRoundInterimBuffer(roundInterimBuffer)
          await this.logDiagnosticStage(options.threadId, 'AI Parallel Tool Calls Fallback', {
            round,
            traceId: options.traceId || options.toolContext.traceId,
            retryReason: 'silent_no_tool_call',
            previousRetryReason: roundParallelToolCallsRetryReason || undefined,
            hadBufferedText: Boolean(bufferedRoundText.trim()),
            hadFinalText: Boolean(String(finalText || '').trim()),
            progressAdvanceGuarded: Boolean(progressAdvanceGuard),
          })
          if (progressAdvanceGuard) {
            const guardFallbackText = this.resolveProgressAdvanceGuardFallback(
              messages,
              progressAdvanceGuard,
            )
            if (guardFallbackText) {
              await options.onDelta?.({
                text: guardFallbackText,
                round,
                interim: false,
              })
              return finalizeAnswer(guardFallbackText, 'stop')
            }
            this.appendSystemGuardMessage(messages, progressAdvanceGuard.message)
          }
          continue
        }
        if (progressAdvanceGuard) {
          const guardFallbackText = this.resolveProgressAdvanceGuardFallback(
            messages,
            progressAdvanceGuard,
          )
          if (guardFallbackText) {
            if (progressAdvanceGuard.suppressBufferedText) {
              this.clearRoundInterimBuffer(roundInterimBuffer)
              if (streamedRoundInterimToUi) {
                await options.onDelta?.({
                  text: '',
                  round,
                  interim: false,
                  clearInterim: true,
                })
              }
            }
            await options.onDelta?.({
              text: guardFallbackText,
              round,
              interim: false,
            })
            return finalizeAnswer(guardFallbackText, 'stop')
          }
          if (progressAdvanceGuard.suppressBufferedText) {
            this.clearRoundInterimBuffer(roundInterimBuffer)
            if (streamedRoundInterimToUi) {
              await options.onDelta?.({
                text: '',
                round,
                interim: false,
                clearInterim: true,
              })
            }
          } else if (bufferedRoundText.trim()) {
            await this.flushRoundInterimBufferAsUiText(roundInterimBuffer, round, options.onDelta, {
              interim: true,
              normalize: false,
            })
          }
          this.appendSystemGuardMessage(messages, progressAdvanceGuard.message)
          continue
        }
        const emittedBufferedText = bufferedRoundText.trim()
          ? await this.flushRoundInterimBufferAsUiText(roundInterimBuffer, round, options.onDelta, {
            interim: false,
            normalize: false,
          })
          : ''
        if (!String(finalText || '').trim()) {
          finalText = this.buildLatestAggregateAnswerFallback(executedToolCalls, intentPrompt)
            || '抱歉，我没有拿到足够明确的结果。请换一种说法，或明确告诉我你想查哪个应用、哪类数据。'
        }
        if (finalText && (!chunks.length || finalText !== emittedBufferedText)) {
          await options.onDelta?.({
            text: finalText,
            round,
            interim: false,
          })
        }
        return finalizeAnswer(finalText, finishReason)
      }

      if (shouldDropBufferedRoundText) {
        this.clearRoundInterimBuffer(roundInterimBuffer)
      } else if (preToolVisiblePlanEmitted) {
        this.clearRoundInterimBuffer(roundInterimBuffer)
      } else if (streamedRoundInterimToUi) {
        this.clearRoundInterimBuffer(roundInterimBuffer)
      } else if (bufferedRoundText.trim()) {
        await this.flushRoundInterimBufferAsUiText(roundInterimBuffer, round, options.onDelta, {
          interim: true,
        })
      }

      const roundPlan = await this.planToolCallsForRound(
        plannedToolCalls,
        round,
        options.toolContext,
        options.traceId || options.toolContext.traceId,
        roundContext,
        actionResults,
        executedToolCalls,
        intentPrompt,
      )

      for (const blocked of roundPlan.blocked) {
        await options.onToolCall?.({
          id: blocked.call.id,
          name: blocked.call.name,
          input: blocked.call.input,
          round,
          strategy: blocked.call.strategy,
          batchSize: blocked.call.batchSize,
          executionGroup: blocked.call.executionGroup,
          targetIds: blocked.call.targetIds,
          queued: true,
        })
        roundResults.push(blocked.result)
        actionResults.push(blocked.result)
        executedToolCalls.push({
          name: blocked.call.name,
          input: blocked.call.input,
          result: blocked.result,
        })
        const blockedEffectiveRuntimeState = this.buildEffectiveRuntimeState(
          options.runtimeState,
          actionResults,
          initialFeatureFlags.batchRuntimeStateEnabled,
        )
        const blockedChainState = this.extractToolChainState(
          blocked.result.output,
          blockedEffectiveRuntimeState,
        )
        await options.onToolResult?.({
          callId: blocked.result.callId,
          name: blocked.result.name,
          ok: blocked.result.ok,
          output: blocked.result.output,
          error: blocked.result.error,
          input: blocked.call.input,
          round,
          durationMs: 0,
          strategy: blocked.call.strategy,
          batchSize: blocked.call.batchSize,
          partial: false,
          reused: false,
          policyBlocked: true,
          searchRepeatBlocked: typeof blocked.result.metadata?.searchRepeatBlocked === 'boolean'
            ? blocked.result.metadata.searchRepeatBlocked
            : undefined,
          searchStopReason: String(blocked.result.metadata?.searchStopReason || '').trim() || undefined,
          queued: true,
          executionGroup: blocked.call.executionGroup,
          targetIds: blocked.call.targetIds,
          succeededTargetIds: [],
          failedTargetIds: blocked.call.targetIds,
          ...blockedChainState,
        })
      }

      for (const wave of roundPlan.waves) {
        for (const toolCall of wave.calls) {
          await options.onToolCall?.({
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input,
            round,
            strategy: toolCall.strategy,
            batchSize: toolCall.batchSize,
            executionGroup: toolCall.executionGroup,
            targetIds: toolCall.targetIds,
          })
        }

        const waveResults = await this.executePlannedWave(
          wave,
          options.toolContext,
          round,
          successfulToolResultCache,
          repeatedToolCallCounts,
          attachmentReadBudget,
        )

        for (const { call, result, durationMs } of waveResults) {
          const decoratedOutput = result.ok
            ? this.decorateToolResultForPromptAndState(
              result.output,
              roundContext.runtimeState,
              actionResults,
              intentPrompt,
            )
            : result.output
          const decoratedResult = decoratedOutput === result.output
            ? result
            : {
              ...result,
              output: decoratedOutput,
            }

          roundResults.push(decoratedResult)
          actionResults.push(decoratedResult)
          executedToolCalls.push({
            name: call.name,
            input: call.input,
            result: decoratedResult,
          })
          const executionMeta = this.extractToolExecutionMeta(decoratedResult.output, call)
          const effectiveRuntimeState = this.buildEffectiveRuntimeState(
            options.runtimeState,
            actionResults,
            initialFeatureFlags.batchRuntimeStateEnabled,
          )
          const chainState = this.extractToolChainState(
            decoratedResult.output,
            effectiveRuntimeState,
          )
          await this.logDiagnosticStage(options.threadId, 'AI DIAG before_on_tool_result', {
            threadId: options.threadId,
            traceId: options.traceId || options.toolContext.traceId,
            toolCallId: decoratedResult.callId,
            round,
            toolName: decoratedResult.name,
            ok: decoratedResult.ok,
            durationMs,
            strategy: executionMeta.strategy,
            batchSize: executionMeta.batchSize,
            appId: String(decoratedResult.output?.resolved?.appId || call.input?.appId || '').trim() || undefined,
            targetIds: executionMeta.targetIds,
            resultStatus: String(decoratedResult.output?.status || '').trim() || undefined,
            resultKind: String(decoratedResult.output?.result?.kind || '').trim() || undefined,
            resultPath: String(
              decoratedResult.output?.result?.path
              || decoratedResult.output?.resolved?.target?.path
              || '',
            ).trim() || undefined,
            error: decoratedResult.error || undefined,
          })
          await options.onToolResult?.({
            callId: decoratedResult.callId,
            name: decoratedResult.name,
            ok: decoratedResult.ok,
            output: decoratedResult.output,
            error: decoratedResult.error,
            input: call.input,
            round,
            durationMs,
            strategy: executionMeta.strategy,
            batchSize: executionMeta.batchSize,
            partial: executionMeta.partial,
            reused: Boolean(decoratedResult.metadata?.reused),
            policyBlocked: Boolean(decoratedResult.metadata?.policyBlocked),
            repeatedCall: typeof decoratedResult.output?.repeatedCall === 'boolean'
              ? decoratedResult.output.repeatedCall
              : undefined,
            noNewInformation: typeof decoratedResult.output?.noNewInformation === 'boolean'
              ? decoratedResult.output.noNewInformation
              : (typeof decoratedResult.metadata?.noNewInformation === 'boolean'
                ? decoratedResult.metadata.noNewInformation
                : undefined),
            repeatNotice: String(decoratedResult.output?.repeatNotice || '').trim() || undefined,
            repeatHint: String(decoratedResult.output?.decision?.repeatHint || '').trim() || undefined,
            duplicateBlocked: typeof decoratedResult.metadata?.duplicateBlocked === 'boolean'
              ? decoratedResult.metadata.duplicateBlocked
              : undefined,
            repeatedCount: Number.isFinite(Number(decoratedResult.output?.repeatedCount ?? decoratedResult.metadata?.repeatedCount))
              ? Number(decoratedResult.output?.repeatedCount ?? decoratedResult.metadata?.repeatedCount)
              : undefined,
            consecutiveRepeatedCount: Number.isFinite(Number(
              decoratedResult.output?.consecutiveRepeatedCount ?? decoratedResult.metadata?.consecutiveRepeatedCount,
            ))
              ? Number(decoratedResult.output?.consecutiveRepeatedCount ?? decoratedResult.metadata?.consecutiveRepeatedCount)
              : undefined,
            searchRepeatBlocked: typeof decoratedResult.metadata?.searchRepeatBlocked === 'boolean'
              ? decoratedResult.metadata.searchRepeatBlocked
              : undefined,
            searchStopReason: String(decoratedResult.metadata?.searchStopReason || '').trim() || undefined,
            queued: Boolean(decoratedResult.metadata?.queued),
            executionGroup: call.executionGroup,
            targetIds: executionMeta.targetIds,
            succeededTargetIds: executionMeta.succeededTargetIds,
            failedTargetIds: executionMeta.failedTargetIds,
            ...chainState,
          })
          await this.logDiagnosticStage(options.threadId, 'AI DIAG after_on_tool_result', {
            threadId: options.threadId,
            traceId: options.traceId || options.toolContext.traceId,
            toolCallId: decoratedResult.callId,
            round,
            toolName: decoratedResult.name,
            ok: decoratedResult.ok,
            resultStatus: String(decoratedResult.output?.status || '').trim() || undefined,
            resultKind: String(decoratedResult.output?.result?.kind || '').trim() || undefined,
            resultPath: String(
              decoratedResult.output?.result?.path
              || decoratedResult.output?.resolved?.target?.path
              || '',
            ).trim() || undefined,
            topScoreRatio: Number.isFinite(Number(decoratedResult.output?.topScoreRatio))
              ? Number(decoratedResult.output?.topScoreRatio)
              : undefined,
            dominantTopCandidate: typeof decoratedResult.output?.dominantTopCandidate === 'boolean'
              ? decoratedResult.output.dominantTopCandidate
              : undefined,
          })
        }
      }

      const formFillAnswerFallback = this.buildCurrentFormFillAnswerFallback(roundResults)
      if (formFillAnswerFallback) {
        await options.onDelta?.({
          text: formFillAnswerFallback,
          round,
          interim: false,
        })
        return finalizeAnswer(formFillAnswerFallback, 'stop')
      }

      if (roundPlan.guardMessage) {
        this.appendSystemGuardMessage(messages, roundPlan.guardMessage)
      }

      const failureRecoveryMessage = this.buildFailureRecoveryMessageV2WithRecovery(roundResults, actionResults)
      if (failureRecoveryMessage) {
        this.appendSystemGuardMessage(messages, failureRecoveryMessage)
      }

      const blockedWeakReadClarifyFallback = this.buildBlockedWeakReadClarifyFallback(roundResults, actionResults)
      if (blockedWeakReadClarifyFallback) {
        await options.onDelta?.({
          text: blockedWeakReadClarifyFallback,
          round,
          interim: false,
        })
        return finalizeAnswer(blockedWeakReadClarifyFallback, 'stop')
      }

      const duplicateGuardTriggered = roundResults.some(result => Boolean(result.metadata?.duplicateBlocked))
      if (duplicateGuardTriggered) {
        this.appendSystemGuardMessage(messages, this.buildDuplicateRoundGuardMessage())
      }
    }

    const aggregateFallbackText = this.buildLatestAggregateAnswerFallback(executedToolCalls, intentPrompt)
    if (aggregateFallbackText) {
      return finalizeAnswer(aggregateFallbackText, 'stop')
    }

    const weakSearchClarifyFallbackText = this.buildWeakSearchClarifyFallback(
      executedToolCalls,
      intentPrompt,
      conversationProfile,
    )
    if (weakSearchClarifyFallbackText) {
      await options.onDelta?.({
        text: weakSearchClarifyFallbackText,
        round: Math.max(1, modelRounds[modelRounds.length - 1]?.round || AiLlmClientService.MAX_TOOL_ROUNDS),
        interim: false,
      })
      return finalizeAnswer(weakSearchClarifyFallbackText, 'stop')
    }

    throw this.createToolLoopExceededError(answerStartedAt, Date.now(), usage, modelRounds, actionResults)
  }

  private buildActionDefinitions(tools: AiToolDefinition[]): AiActionDefinition[] {
    return tools.map(tool => ({
      name: tool.name,
      kind: AiActionKind.FUNCTION,
      description: tool.description,
      inputSchema: tool.inputSchema,
      notes: tool.notes,
    }))
  }

  private appendRoundInterimBuffer(buffer: string[], text: string) {
    if (!text) {
      return
    }

    buffer.push(text)
  }

  private readRoundInterimBuffer(buffer: string[]) {
    return buffer.join('')
  }

  private clearRoundInterimBuffer(buffer: string[]) {
    buffer.length = 0
  }

  private shouldDropRoundInterimBuffer(text: string, hasToolCalls: boolean) {
    if (!hasToolCalls) {
      return false
    }

    return isLikelyToolProtocolText(normalizeInterimText(text))
  }

  private resolvePreToolVisiblePlanText(
    bufferedText: string,
    userPrompt?: string,
    conversationProfile?: AiConversationProfile,
  ) {
    const normalizedBufferedText = normalizeInterimText(bufferedText || '').trim()
    if (normalizedBufferedText && !isLikelyToolProtocolText(normalizedBufferedText)) {
      return normalizedBufferedText
    }

    const resolvedConversationProfile = this.normalizeConversationProfile(conversationProfile)
    if (
      resolvedConversationProfile === 'records_query'
      && this.isSameAppMultiFormComparePrompt(userPrompt)
    ) {
      return this.buildSameAppMultiFormComparePlanText()
    }

    if (
      resolvedConversationProfile === 'records_query'
      && this.isBroadScopeSameAppAnalysisPrompt(userPrompt)
    ) {
      return this.buildBroadScopeSameAppPlanText()
    }
    return ''
  }

  private buildBroadScopeSameAppPlanText() {
    return '我先确认这个应用里适合总览的关键数据表，再决定是直接分析，还是先帮你收窄到更具体的切口。'
  }

  private buildSameAppMultiFormComparePlanText() {
    return '我会先定位并确认这次要分析的表，再按统一口径分别读取数据，并比较差异或对照统计结果。'
  }

  private async flushRoundInterimBufferAsUiText(
    buffer: string[],
    round: number,
    onDelta: ((payload: { text: string; round: number; interim: boolean; clearInterim?: boolean }) => void | Promise<void>) | undefined,
    options: { interim: boolean; normalize?: boolean },
  ) {
    const rawText = this.readRoundInterimBuffer(buffer)
    this.clearRoundInterimBuffer(buffer)

    const text = options.normalize === false
      ? rawText
      : normalizeInterimText(rawText)
    if (!String(text || '').trim()) {
      return ''
    }

    await onDelta?.({
      text,
      round,
      interim: options.interim,
    })
    return text
  }

  private async planToolCallsForRound(
    toolCalls: RawToolCall[],
    round: number,
    toolContext?: AiToolExecutionContext,
    traceId?: string,
    roundContext?: RoundDecisionContext,
    actionResults: AiActionResult[] = [],
    executedToolCalls: ExecutedToolCallRecord[] = [],
    userPrompt?: string,
  ): Promise<ToolRoundPlan> {
    const effectiveRuntimeState = roundContext?.runtimeState
    const resolvedConversationProfile = this.normalizeConversationProfile(roundContext?.conversationProfile)
    const featureFlags = roundContext?.featureFlags || await this.aiConfigService.getFeatureFlags(
      resolvedConversationProfile,
    )
    const executionGroup = `wave-${round}-1`

    if (!toolCalls.length) {
      return {
        waves: [],
        blocked: [],
        guardMessage: '',
      }
    }

    const guardFiltering = await this.applyToolCallStateGuards(
      toolCalls,
      toolContext,
      effectiveRuntimeState,
      actionResults,
      executedToolCalls,
      featureFlags,
      resolvedConversationProfile,
      round,
      traceId,
      executionGroup,
      userPrompt,
    )
    const activeToolCalls = guardFiltering.allowedToolCalls
    if (!activeToolCalls.length) {
      return {
        waves: [],
        blocked: guardFiltering.blocked,
        guardMessage: guardFiltering.guardMessages.join(' '),
      }
    }

    const allReadAppData = activeToolCalls.every(item => item.name === 'read_app_data')
    const allGetAppMemory = activeToolCalls.every(item => item.name === 'get_app_memory')

    if (allReadAppData) {
      const splitMultiTargetAnalysisPlan = this.planSplitSingleReadAppDataAnalysisCall(activeToolCalls, round)
      if (splitMultiTargetAnalysisPlan) {
        return this.mergeToolRoundPlans(splitMultiTargetAnalysisPlan, guardFiltering)
      }

      const batchCall = featureFlags.batchReadAppDataEnabled
        ? this.planBatchReadAppDataCall(activeToolCalls, round)
        : null
      if (batchCall) {
        return this.mergeToolRoundPlans({
          waves: [{
            strategy: 'batch',
            executionGroup,
            calls: [batchCall],
          }],
          blocked: [],
          guardMessage: '',
        }, guardFiltering)
      }

      if (featureFlags.dynamicToolParallelEnabled && this.areParallelSafeReadCalls(activeToolCalls)) {
        return this.mergeToolRoundPlans({
          waves: [{
            strategy: 'parallel_safe',
            executionGroup,
            calls: activeToolCalls.map(item => this.toPlannedToolCall(item, 'parallel_safe', executionGroup)),
          }],
          blocked: [],
          guardMessage: '',
        }, guardFiltering)
      }

      return this.mergeToolRoundPlans(this.buildSerialExecutionPlan(
        activeToolCalls,
        round,
        'hard_serial',
      ), guardFiltering)
    }

    if (allGetAppMemory && featureFlags.dynamicToolParallelEnabled && this.areParallelSafeMemoryCalls(activeToolCalls)) {
      return this.mergeToolRoundPlans({
        waves: [{
          strategy: 'parallel_safe',
          executionGroup,
          calls: activeToolCalls.map(item => this.toPlannedToolCall(item, 'parallel_safe', executionGroup)),
        }],
        blocked: [],
        guardMessage: '',
      }, guardFiltering)
    }

    return this.mergeToolRoundPlans(this.buildSingleExecutionPlan(
      activeToolCalls,
      round,
      traceId,
      'hard_serial',
      '当前这组工具调用存在依赖关系或不满足并行策略。请先根据已执行结果收敛，再继续调用。',
    ), guardFiltering)
  }

  private mergeToolRoundPlans(
    basePlan: ToolRoundPlan,
    guardFiltering: {
      blocked: PlannedBlockedToolCall[]
      guardMessages: string[]
    },
  ): ToolRoundPlan {
    return {
      waves: basePlan.waves,
      blocked: [...guardFiltering.blocked, ...basePlan.blocked],
      guardMessage: [
        ...guardFiltering.guardMessages,
        String(basePlan.guardMessage || '').trim(),
      ].filter(Boolean).join(' '),
    }
  }

  private async applyToolCallStateGuards(
    toolCalls: RawToolCall[],
    toolContext: AiToolExecutionContext | undefined,
    runtimeState: AiThreadRuntimeState | null | undefined,
    actionResults: AiActionResult[],
    executedToolCalls: ExecutedToolCallRecord[],
    featureFlags: AiFeatureFlags,
    conversationProfile: AiConversationProfile | undefined,
    round: number,
    traceId: string | undefined,
    executionGroup: string,
    userPrompt?: string,
  ) {
    const allowedToolCalls: RawToolCall[] = []
    const blocked: PlannedBlockedToolCall[] = []
    const guardMessages: string[] = []
    const projectedActionResults = [...actionResults]

    for (const toolCall of toolCalls) {
      const guard = await this.resolveToolCallStateGuard(
        toolCall,
        toolContext,
        runtimeState,
        projectedActionResults,
        executedToolCalls,
        featureFlags,
        conversationProfile,
        userPrompt,
      )
      if (!guard) {
        allowedToolCalls.push(toolCall)
        const projectedResult = this.buildProjectedAllowedToolResultForGuards(toolCall)
        if (projectedResult) {
          projectedActionResults.push(projectedResult)
        }
        continue
      }

      if (!guardMessages.includes(guard.message)) {
        guardMessages.push(guard.message)
      }

      const plannedCall = this.toPlannedToolCall(toolCall, 'blocked_by_policy', executionGroup)
      const blockedResult = this.buildBlockedToolResult(
        toolCall,
        plannedCall,
        round,
        traceId,
        guard,
      )
      blocked.push({
        call: plannedCall,
        result: blockedResult,
      })
      projectedActionResults.push(blockedResult)
    }

    return {
      allowedToolCalls,
      blocked,
      guardMessages,
    }
  }

  private buildProjectedAllowedToolResultForGuards(toolCall: RawToolCall): AiActionResult | null {
    if (toolCall.name !== 'get_app_memory') {
      return null
    }

    const appId = this.normalizeOptionalText(toolCall.input?.appId)
    if (!appId) {
      return null
    }

    return {
      callId: toolCall.id,
      name: toolCall.name,
      kind: toolCall.kind,
      ok: true,
      output: {
        tool: 'get_app_memory',
        app: {
          appId,
          appName: appId,
        },
        memoryStatus: 'queued',
      },
      metadata: {
        queued: true,
        projectedForGuard: true,
      },
    }
  }

  private async resolveToolCallStateGuard(
    toolCall: RawToolCall,
    toolContext: AiToolExecutionContext | undefined,
    runtimeState: AiThreadRuntimeState | null | undefined,
    actionResults: AiActionResult[],
    executedToolCalls: ExecutedToolCallRecord[],
    featureFlags: AiFeatureFlags,
    conversationProfile: AiConversationProfile | undefined,
    userPrompt?: string,
  ): Promise<ToolStateGuard | null> {
    if (toolCall.name === 'search_apps') {
      const sameAppCompareSearchReentryGuard = this.buildSameAppCompareSearchReentryGuard(
        actionResults,
        conversationProfile,
        userPrompt,
      )
      if (sameAppCompareSearchReentryGuard) {
        return sameAppCompareSearchReentryGuard
      }
      const readAppDataFailureSearchReentryGuard = this.buildReadAppDataFailureSearchReentryGuard(
        executedToolCalls,
        runtimeState,
        conversationProfile,
        userPrompt,
      )
      if (readAppDataFailureSearchReentryGuard) {
        return readAppDataFailureSearchReentryGuard
      }
      if (featureFlags.searchAppsWeakRepeatGuardEnabled) {
        const searchRepeatGuard = this.buildSearchRepeatGuard(
          toolCall.input,
          executedToolCalls,
          conversationProfile,
          {
            currentAccessibleAppsSignature: await this.resolveCurrentAccessibleAppsSignature(
              toolContext,
              featureFlags,
            ),
            catalogInvalidateEnabled: featureFlags.searchAppsCatalogInvalidateEnabled,
            fallbackTtlMs: featureFlags.searchAppsRepeatGuardFallbackTtlMs,
            now: Date.now(),
          },
        )
        if (searchRepeatGuard) {
          return searchRepeatGuard
        }
      }
      return null
    }

    if (toolCall.name === 'get_app_memory' || toolCall.name === 'read_app_data') {
      const explicitAppNameRetryGuard = this.buildExplicitAppNameRetryGuard(
        toolCall,
        actionResults,
        executedToolCalls,
        conversationProfile,
        userPrompt,
      )
      if (explicitAppNameRetryGuard) {
        return explicitAppNameRetryGuard
      }
      const weakDisambiguationStopLossGuard = this.buildWeakDisambiguationStopLossGuard(
        toolCall,
        actionResults,
        conversationProfile,
      )
      if (weakDisambiguationStopLossGuard) {
        return weakDisambiguationStopLossGuard
      }
      const weakSearchReadGuard = this.buildWeakSearchReadGuard(
        toolCall,
        actionResults,
        conversationProfile,
      )
      if (weakSearchReadGuard) {
        return weakSearchReadGuard
      }
      const sameAppCompareCoverageGuard = this.buildSameAppCompareCoverageGuard(
        toolCall,
        actionResults,
        conversationProfile,
        userPrompt,
      )
      if (sameAppCompareCoverageGuard) {
        return sameAppCompareCoverageGuard
      }
    }

    return null
  }

  private buildSameAppCompareSearchReentryGuard(
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
    userPrompt?: string,
  ): ToolStateGuard | null {
    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }
    if (!this.isSameAppMultiFormComparePrompt(userPrompt)) {
      return null
    }

    const readTargets = this.collectSuccessfulReadSourceTargets(actionResults)
    const distinctAppIds = [...new Set(readTargets.map(item => item.appId))]
    if (distinctAppIds.length !== 1 || readTargets.length < 2) {
      return null
    }

    const appLabel = readTargets.find(item => item.appName)?.appName || distinctAppIds[0]
    const visibleTargets = readTargets
      .slice(0, 3)
      .map(item => item.targetName || item.targetId)
      .filter(Boolean)
    const targetLabel = visibleTargets.length ? `（${visibleTargets.join('、')}）` : ''

    return {
      reason: 'same_app_compare_search_reentry_forbidden',
      message: `当前问题已经在同一应用 ${appLabel}${targetLabel} 内成功读取了 ${readTargets.length} 张表。不要再回到 search_apps。请直接基于当前应用继续比较；如果还缺信息，只补读尚未读取的 source，或直接说明缺口。`,
      metadata: {
        appId: distinctAppIds[0],
        verifiedTargetCount: readTargets.length,
        verifiedTargetIds: readTargets.map(item => item.targetId),
        noNewInformation: true,
      },
    }
  }

  private buildReadAppDataFailureSearchReentryGuard(
    executedToolCalls: ExecutedToolCallRecord[],
    runtimeState: AiThreadRuntimeState | null | undefined,
    conversationProfile?: AiConversationProfile,
    userPrompt?: string,
  ): ToolStateGuard | null {
    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }
    if (this.isComparisonRequest(userPrompt) || runtimeState?.currentContextKind === 'comparison') {
      return null
    }

    const latestFailedRead = this.findLatestRecoverableReadAppDataFailure(executedToolCalls)
    if (!latestFailedRead) {
      return null
    }

    const errorDetails = this.extractToolErrorDetails(latestFailedRead.result?.error)
    const failedAppId = this.resolveReadAppDataAppId(latestFailedRead.input)
      || this.normalizeOptionalText(errorDetails?.appId)
    if (!failedAppId) {
      return null
    }

    const runtimeAppId = this.normalizeOptionalText(runtimeState?.currentAppId)
    if (runtimeAppId && runtimeAppId !== failedAppId) {
      return null
    }

    const latestSuccessfulAppContext = [...executedToolCalls].reverse().find(item =>
      item.result?.ok
      && (item.name === 'get_app_memory' || item.name === 'read_app_data')
      && this.resolveExecutedToolCallAppId(item),
    )
    const latestSuccessfulAppContextId = this.resolveExecutedToolCallAppId(latestSuccessfulAppContext)
    if (latestSuccessfulAppContextId && latestSuccessfulAppContextId !== failedAppId) {
      return null
    }

    const latestSameAppMemory = [...executedToolCalls].reverse().find(item =>
      item.result?.ok
      && item.name === 'get_app_memory'
      && this.resolveExecutedToolCallAppId(item) === failedAppId,
    )
    const latestSameAppRead = [...executedToolCalls].reverse().find(item =>
      item.result?.ok
      && item.name === 'read_app_data'
      && this.resolveExecutedToolCallAppId(item) === failedAppId,
    )
    if (!latestSameAppMemory && !latestSameAppRead && runtimeAppId !== failedAppId) {
      return null
    }

    const failedTargetId = this.extractFirstTargetIdByType(latestFailedRead.input, 'source')
      || this.normalizeOptionalText(errorDetails?.sourceId)
      || this.normalizeOptionalText(errorDetails?.tableId)
    const appLabel = this.resolveExecutedToolCallAppName(
      latestSameAppRead || latestSameAppMemory || latestSuccessfulAppContext,
    ) || this.normalizeOptionalText(runtimeState?.currentAppName) || failedAppId
    const targetLabel = failedTargetId ? `，继续复用同一个 target.id=${failedTargetId}` : ''

    return {
      reason: 'read_app_data_failure_search_reentry_forbidden',
      message: `你已经在应用 ${appLabel}（${failedAppId}）内拿到结构证据。本次失败是字段或 target 不匹配，不要重新 search_apps。请继续复用同一个应用ID=${failedAppId}${targetLabel}，优先调用 get_app_memory 查看当前可读字段，或修正 field/target 后重新 read_app_data；如果仍不能唯一确定字段，请直接向用户澄清。`,
      metadata: {
        appId: failedAppId,
        failedTargetId: failedTargetId || undefined,
        searchRepeatBlocked: true,
        searchStopReason: 'read_app_data_failure_search_reentry_forbidden',
        noNewInformation: true,
      },
    }
  }

  private findLatestRecoverableReadAppDataFailure(executedToolCalls: ExecutedToolCallRecord[]) {
    return [...executedToolCalls].reverse().find(item =>
      item.name === 'read_app_data'
      && !item.result?.ok
      && this.isReadAppDataSameAppRecoverableErrorCode(this.extractToolErrorCode(item.result?.error)),
    ) || null
  }

  private collectSuccessfulReadSourceTargets(actionResults: AiActionResult[]) {
    const targets = actionResults.flatMap(result => {
      if (!result?.ok || result.name !== 'read_app_data') {
        return []
      }

      const resolved = result.output?.resolved
      if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
        return []
      }

      const appId = this.normalizeOptionalText(resolved.appId)
      if (!appId) {
        return []
      }
      const appName = this.normalizeOptionalText(resolved.appName)
      const resolvedTargets = Array.isArray(resolved.targets)
        ? resolved.targets
        : (resolved.target ? [resolved.target] : [])

      return resolvedTargets
        .map((target: DynamicValue) => ({
          appId,
          appName,
          targetId: this.normalizeOptionalText(target?.id),
          targetName: this.normalizeOptionalText(target?.name),
          targetType: this.normalizeOptionalText(target?.type),
        }))
        .filter(item => item.targetType === 'source' && item.targetId)
        .map(item => ({
          appId: item.appId,
          appName: item.appName,
          targetId: item.targetId as string,
          targetName: item.targetName,
        }))
    })

    return [...new Map(
      targets.map(item => [`${item.appId}:${item.targetId}`, item] as const),
    ).values()]
  }

  private collectComparedAppIdsFromMemory(actionResults: AiActionResult[]) {
    return Array.from(new Set(
      actionResults
        .filter(result => result?.ok && result.name === 'get_app_memory')
        .map(result => this.normalizeOptionalText(result?.output?.app?.appId))
        .filter(Boolean),
    )) as string[]
  }

  private findLatestSuccessfulSearchResultIndex(actionResults: AiActionResult[]) {
    for (let index = actionResults.length - 1; index >= 0; index -= 1) {
      const result = actionResults[index]
      if (
        result?.ok
        && result.name === 'search_apps'
        && result.output
        && typeof result.output === 'object'
        && !Array.isArray(result.output)
        && result.output.tool === 'search_apps'
      ) {
        return index
      }
    }

    return -1
  }

  private findLatestSuccessfulSearchOutput(actionResults: AiActionResult[]) {
    const latestSearchIndex = this.findLatestSuccessfulSearchResultIndex(actionResults)
    if (latestSearchIndex < 0) {
      return null
    }

    return actionResults[latestSearchIndex]?.output || null
  }

  private findLatestSuccessfulSearchCall(executedToolCalls: ExecutedToolCallRecord[]) {
    return [...executedToolCalls].reverse().find(item =>
      item.name === 'search_apps'
      && item.result?.ok
      && item.result?.output
      && typeof item.result.output === 'object'
      && !Array.isArray(item.result.output)
      && item.result.output.tool === 'search_apps',
    ) || null
  }

  private resolveLatestSearchKeywords(output: DynamicValue, input?: DynamicValue) {
    return [
      ...this.normalizeSearchKeywords(output?.keywords),
      ...this.normalizeSearchKeywords(input?.keywords),
    ].filter((item, index, array) => array.indexOf(item) === index)
  }

  private collectSearchCandidateAppNames(output: DynamicValue) {
    return [...new Set(
      (Array.isArray(output?.apps) ? output.apps : [])
        .map(item => this.normalizeOptionalText(item?.appName))
        .filter(Boolean),
    )] as string[]
  }

  private collectMentionedCandidateAppNames(userPrompt: string | undefined, output: DynamicValue) {
    return collectPromptExplicitAppNameSignals(
      userPrompt,
      this.collectSearchCandidateAppNames(output),
    ).map(item => item.appName)
  }

  private resolvePromptExplicitSearchAppName(userPrompt: string | undefined, output: DynamicValue) {
    return this.collectMentionedCandidateAppNames(userPrompt, output).find(Boolean) || undefined
  }

  private resolveOmittedExplicitAppCandidate(options: {
    userPrompt?: string
    latestSearchOutput: DynamicValue
    latestKeywords: string[]
  }) {
    const mentionedCandidateAppNames = this.collectMentionedCandidateAppNames(
      options.userPrompt,
      options.latestSearchOutput,
    )
    const omittedExplicitAppName = mentionedCandidateAppNames.find(appName =>
      !hasExactExplicitAppNameKeyword(appName, options.latestKeywords),
    )
    if (!omittedExplicitAppName) {
      return null
    }

    const explicitCandidateAppIds = [...new Set(
      (Array.isArray(options.latestSearchOutput?.apps) ? options.latestSearchOutput.apps : [])
        .filter(item => this.normalizeOptionalText(item?.appName) === omittedExplicitAppName)
        .map(item => this.normalizeOptionalText(item?.appId))
        .filter(Boolean),
    )] as string[]
    const explicitAppId = explicitCandidateAppIds.length === 1
      ? explicitCandidateAppIds[0]
      : undefined
    const topCandidateAppId = this.normalizeOptionalText(options.latestSearchOutput?.topCandidateAppId)

    return {
      explicitAppName: omittedExplicitAppName,
      explicitAppId,
      topCandidateAppId,
      mentionedCandidateCount: mentionedCandidateAppNames.length,
      topCandidateMatchesExplicitApp: Boolean(
        explicitAppId
        && topCandidateAppId
        && explicitAppId === topCandidateAppId
      ),
    }
  }

  private resolveExplicitAppNameGuardToolAppId(toolCall: RawToolCall) {
    if (toolCall.name === 'get_app_memory') {
      return this.normalizeOptionalText(toolCall.input?.appId)
    }
    if (toolCall.name === 'read_app_data') {
      return this.normalizeOptionalText(toolCall.input?.appId)
    }
    return undefined
  }

  private hasClearExplicitAppTargetConsistency(
    toolCall: RawToolCall,
    latestSearchOutput: DynamicValue,
    explicitCandidate: {
      explicitAppId?: string
      topCandidateAppId?: string
      topCandidateMatchesExplicitApp: boolean
    },
  ) {
    if (
      this.normalizeSearchConvergence(latestSearchOutput?.convergence) !== 'clear'
      || latestSearchOutput?.requiresDisambiguation === true
    ) {
      return false
    }

    if (
      !explicitCandidate.explicitAppId
      || !explicitCandidate.topCandidateAppId
      || !explicitCandidate.topCandidateMatchesExplicitApp
    ) {
      return false
    }

    const toolAppId = this.resolveExplicitAppNameGuardToolAppId(toolCall)
    return Boolean(toolAppId && toolAppId === explicitCandidate.explicitAppId)
  }

  private buildExplicitAppNameRetryGuard(
    toolCall: RawToolCall,
    actionResults: AiActionResult[],
    executedToolCalls: ExecutedToolCallRecord[],
    conversationProfile?: AiConversationProfile,
    userPrompt?: string,
  ): ToolStateGuard | null {
    if (toolCall.name !== 'get_app_memory' && toolCall.name !== 'read_app_data') {
      return null
    }
    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }

    const latestSearchOutput = this.findLatestSuccessfulSearchOutput(actionResults)
    if (!latestSearchOutput) {
      return null
    }

    const latestSearchCall = this.findLatestSuccessfulSearchCall(executedToolCalls)
    const latestKeywords = this.resolveLatestSearchKeywords(latestSearchOutput, latestSearchCall?.input)
    const explicitCandidate = this.resolveOmittedExplicitAppCandidate({
      userPrompt,
      latestSearchOutput,
      latestKeywords,
    })
    if (!explicitCandidate) {
      return null
    }
    if (this.hasClearExplicitAppTargetConsistency(toolCall, latestSearchOutput, explicitCandidate)) {
      return null
    }

    return {
      reason: 'search_missing_explicit_app_name_keyword',
      message: `用户原话里已经出现显式应用名“${explicitCandidate.explicitAppName}”，但最近一次 search_apps.keywords 没有原样保留它。不要继续 ${toolCall.name}，也不要先向用户澄清；请先重试一次 search_apps，并把“${explicitCandidate.explicitAppName}”原样放回 keywords。`,
      metadata: {
        explicitAppName: explicitCandidate.explicitAppName,
        mentionedCandidateCount: explicitCandidate.mentionedCandidateCount,
        latestKeywordCount: latestKeywords.length,
        searchStopReason: 'search_missing_explicit_app_name_keyword',
        noNewInformation: true,
      },
    }
  }

  private collectComparedMemoryAppIdsAfterSearch(actionResults: AiActionResult[], latestSearchIndex: number) {
    return [...new Set(
      actionResults
        .slice(latestSearchIndex + 1)
        .filter(result =>
          result?.ok
          && result.name === 'get_app_memory'
          && result.output
          && typeof result.output === 'object'
          && !Array.isArray(result.output),
        )
        .map(result => this.normalizeOptionalText(result?.output?.app?.appId))
        .filter(Boolean),
    )] as string[]
  }

  private collectComparedWeakCandidateAppIdsAfterSearch(
    actionResults: AiActionResult[],
    latestSearchIndex: number,
    effectiveCandidateAppIds: string[],
  ) {
    const effectiveCandidateSet = new Set(
      effectiveCandidateAppIds
        .map(appId => this.normalizeOptionalText(appId))
        .filter((appId): appId is string => Boolean(appId)),
    )

    if (!effectiveCandidateSet.size) {
      return [] as string[]
    }

    return [...new Set(
      actionResults
        .slice(latestSearchIndex + 1)
        .filter(result =>
          result?.ok
          && result.name === 'get_app_memory'
          && result.output
          && typeof result.output === 'object'
          && !Array.isArray(result.output),
        )
        .map(result => this.normalizeOptionalText(result?.output?.app?.appId))
        .filter((appId): appId is string => Boolean(appId && effectiveCandidateSet.has(appId))),
    )] as string[]
  }

  private countRepeatedComparedMemoryResultsAfterSearch(actionResults: AiActionResult[], latestSearchIndex: number) {
    const seenAppIds = new Set<string>()
    let repeatedCount = 0

    for (const result of actionResults.slice(latestSearchIndex + 1)) {
      if (
        !result?.ok
        || result.name !== 'get_app_memory'
        || !result.output
        || typeof result.output !== 'object'
        || Array.isArray(result.output)
      ) {
        continue
      }

      const appId = this.normalizeOptionalText(result?.output?.app?.appId)
      if (!appId) {
        continue
      }

      if (seenAppIds.has(appId)) {
        repeatedCount += 1
        continue
      }

      seenAppIds.add(appId)
    }

    return repeatedCount
  }

  private countRepeatedCandidateMemoryResultsAfterSearch(
    actionResults: AiActionResult[],
    latestSearchIndex: number,
    effectiveCandidateAppIds: string[],
  ) {
    const effectiveCandidateSet = new Set(
      effectiveCandidateAppIds
        .map(appId => this.normalizeOptionalText(appId))
        .filter((appId): appId is string => Boolean(appId)),
    )
    if (!effectiveCandidateSet.size) {
      return 0
    }

    const seenAppIds = new Set<string>()
    let repeatedCount = 0
    for (const result of actionResults.slice(latestSearchIndex + 1)) {
      if (
        !result?.ok
        || result.name !== 'get_app_memory'
        || !result.output
        || typeof result.output !== 'object'
        || Array.isArray(result.output)
      ) {
        continue
      }

      const appId = this.normalizeOptionalText(result?.output?.app?.appId)
      if (!appId || !effectiveCandidateSet.has(appId)) {
        continue
      }

      if (seenAppIds.has(appId)) {
        repeatedCount += 1
        continue
      }

      seenAppIds.add(appId)
    }

    return repeatedCount
  }

  private collectEffectiveWeakDisambiguationCandidateAppIds(output: DynamicValue) {
    return [...new Set(
      (Array.isArray(output?.apps) ? output.apps : [])
        .filter(item => Number(item?.score || 0) > 0)
        .map(item => this.normalizeOptionalText(item?.appId))
        .filter(Boolean),
    )].slice(0, 3) as string[]
  }

  private hasNarrowedWeakDisambiguationCandidateSet(
    latestSearchOutput: DynamicValue,
    effectiveCandidateCount: number,
  ) {
    if (!Number.isFinite(effectiveCandidateCount) || effectiveCandidateCount <= 0) {
      return false
    }

    if (effectiveCandidateCount <= 2) {
      return true
    }

    const topScoreRatio = Number.isFinite(Number(latestSearchOutput?.topScoreRatio))
      ? Number(latestSearchOutput.topScoreRatio)
      : 0
    const stableTopCandidateRounds = Number.isFinite(Number(latestSearchOutput?.stableTopCandidateRounds))
      ? Math.max(0, Number(latestSearchOutput.stableTopCandidateRounds))
      : 0

    return latestSearchOutput?.noNewCandidates === true
      && stableTopCandidateRounds >= 2
      && (
        latestSearchOutput?.dominantTopCandidate === true
        || topScoreRatio >= 1.8
      )
  }

  private resolveWeakDisambiguationComparisonThreshold(
    effectiveCandidateCount: number,
    narrowedWeakSet = false,
  ) {
    if (!Number.isFinite(effectiveCandidateCount) || effectiveCandidateCount <= 0) {
      return 0
    }

    if (narrowedWeakSet && effectiveCandidateCount >= 3) {
      return 2
    }

    return Math.min(3, effectiveCandidateCount)
  }

  private countBlockedWeakReadResultsAfterSearch(actionResults: AiActionResult[], latestSearchIndex: number) {
    return actionResults
      .slice(latestSearchIndex + 1)
      .filter(result =>
        result?.name === 'read_app_data'
        && !result.ok
        && result.metadata?.policyBlocked
        && result.metadata?.guardReason === 'weak_search_read_requires_disambiguation',
      )
      .length
  }

  private buildWeakDisambiguationStopLossCoreState(actionResults: AiActionResult[]) {
    const latestSearchIndex = this.findLatestSuccessfulSearchResultIndex(actionResults)
    if (latestSearchIndex < 0) {
      return null
    }

    const latestSearchOutput = actionResults[latestSearchIndex]?.output
    if (
      this.normalizeSearchConvergence(latestSearchOutput?.convergence) !== 'weak'
      || latestSearchOutput?.requiresDisambiguation !== true
    ) {
      return null
    }

    const effectiveCandidateAppIds = this.collectEffectiveWeakDisambiguationCandidateAppIds(latestSearchOutput)
    const effectiveCandidateCount = effectiveCandidateAppIds.length
    const narrowedWeakSet = this.hasNarrowedWeakDisambiguationCandidateSet(
      latestSearchOutput,
      effectiveCandidateCount,
    )
    const comparisonThreshold = this.resolveWeakDisambiguationComparisonThreshold(
      effectiveCandidateCount,
      narrowedWeakSet,
    )
    const comparedMemoryAppIds = this.collectComparedWeakCandidateAppIdsAfterSearch(
      actionResults,
      latestSearchIndex,
      effectiveCandidateAppIds,
    )
    const repeatedComparedMemoryCount = this.countRepeatedCandidateMemoryResultsAfterSearch(
      actionResults,
      latestSearchIndex,
      effectiveCandidateAppIds,
    )
    const blockedWeakReadCount = this.countBlockedWeakReadResultsAfterSearch(
      actionResults,
      latestSearchIndex,
    )
    const stalledWeakEvidenceCount = blockedWeakReadCount + repeatedComparedMemoryCount

    return {
      latestSearchIndex,
      latestSearchOutput,
      effectiveCandidateAppIds,
      effectiveCandidateCount,
      narrowedWeakSet,
      comparisonThreshold,
      comparedMemoryAppIds,
      repeatedComparedMemoryCount,
      blockedWeakReadCount,
      stalledWeakEvidenceCount,
    }
  }

  private resolveWeakDisambiguationStopLossSatisfiedBy(state: {
    comparisonThreshold: number
    comparedMemoryAppIds: string[]
    repeatedComparedMemoryCount: number
    blockedWeakReadCount: number
    stalledWeakEvidenceCount: number
  }) {
    if (state.blockedWeakReadCount >= 3) {
      return 'blocked_weak_read_cap' as const
    }

    if (
      state.comparisonThreshold >= 2
      && state.comparedMemoryAppIds.length >= state.comparisonThreshold
    ) {
      return 'comparison_threshold' as const
    }

    if (state.stalledWeakEvidenceCount >= 3) {
      return 'stalled_no_new_evidence_cap' as const
    }

    return null
  }

  private resolvePendingWeakDisambiguationStopLossSatisfiedBy(
    toolCall: RawToolCall,
    state: {
      comparedMemoryAppIds: string[]
      stalledWeakEvidenceCount: number
    },
  ) {
    if (state.stalledWeakEvidenceCount < 2) {
      return null
    }

    if (toolCall.name === 'read_app_data') {
      return 'stalled_no_new_evidence_cap' as const
    }

    if (toolCall.name !== 'get_app_memory') {
      return null
    }

    const pendingAppId = this.normalizeOptionalText(toolCall.input?.appId)
    if (!pendingAppId || !state.comparedMemoryAppIds.includes(pendingAppId)) {
      return null
    }

    return 'stalled_no_new_evidence_cap' as const
  }

  private buildWeakDisambiguationStopLossState(options: {
    actionResults: AiActionResult[]
    conversationProfile?: AiConversationProfile
  }) {
    if (this.normalizeConversationProfile(options.conversationProfile) !== 'records_query') {
      return null
    }

    const coreState = this.buildWeakDisambiguationStopLossCoreState(options.actionResults)
    if (!coreState) {
      return null
    }

    const stopLossSatisfiedBy = this.resolveWeakDisambiguationStopLossSatisfiedBy(coreState)
    if (!stopLossSatisfiedBy) {
      return null
    }

    return {
      ...coreState,
      stopLossSatisfiedBy,
    }
  }

  private buildWeakDisambiguationStopLossGuard(
    toolCall: RawToolCall,
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
  ): ToolStateGuard | null {
    if (toolCall.name !== 'get_app_memory' && toolCall.name !== 'read_app_data') {
      return null
    }

    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }

    const coreState = this.buildWeakDisambiguationStopLossCoreState(actionResults)
    if (!coreState) {
      return null
    }

    const stopLossSatisfiedBy = this.resolveWeakDisambiguationStopLossSatisfiedBy(coreState)
      || this.resolvePendingWeakDisambiguationStopLossSatisfiedBy(toolCall, coreState)
    if (!stopLossSatisfiedBy) {
      return null
    }

    const state = {
      ...coreState,
      stopLossSatisfiedBy,
    }

    const stopLossReasonText = state.stopLossSatisfiedBy === 'blocked_weak_read_cap'
      ? '已连续 3 次在 weak 状态下尝试直接 read_app_data，仍然没有新增区分性证据。'
      : state.stopLossSatisfiedBy === 'stalled_no_new_evidence_cap'
        ? '已连续多次重复比较相同候选，仍然没有新增区分性证据。'
        : `已比较满 Top${state.comparisonThreshold} 个候选的 get_app_memory，仍然没有新增区分性证据。`

    return {
      reason: 'weak_search_disambiguation_stop_loss',
      message: `当前 search_apps 仍处于 weak + requiresDisambiguation=true，${stopLossReasonText}不要继续在 get_app_memory/read_app_data 之间空转。请直接点名列出最相关的 1 到 3 个候选，让用户明确确认。`,
      metadata: {
        effectiveCandidateCount: state.effectiveCandidateCount,
        comparisonThreshold: state.comparisonThreshold,
        comparedCandidateCount: state.comparedMemoryAppIds.length,
        repeatedComparedMemoryCount: state.repeatedComparedMemoryCount,
        blockedWeakReadCount: state.blockedWeakReadCount,
        stalledWeakEvidenceCount: state.stalledWeakEvidenceCount,
        searchStopReason: 'weak_search_disambiguation_stop_loss',
        noNewInformation: true,
      },
    }
  }

  private normalizeHintFieldList(value: unknown) {
    return Array.from(new Set(
      (Array.isArray(value) ? value : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .sort(),
    ))
  }

  private buildComparableSourceSignature(source: DynamicValue) {
    const timeFields = this.normalizeHintFieldList(source?.queryHints?.timeFields)
    const metricFields = this.normalizeHintFieldList(source?.queryHints?.metricFields)
    const entityFields = this.normalizeHintFieldList(source?.queryHints?.entityFields)

    if (!timeFields.length || !metricFields.length || !entityFields.length) {
      return ''
    }

    return JSON.stringify({
      timeFields,
      metricFields,
      entityFields,
    })
  }

  private collectLatestSameAppComparableSources(actionResults: AiActionResult[]) {
    const latestMemory = [...actionResults].reverse().find(result =>
      result?.ok
      && result.name === 'get_app_memory'
      && result.output?.tool === 'get_app_memory'
      && Array.isArray(result.output?.sources),
    )
    if (!latestMemory) {
      return []
    }

    const sources = latestMemory.output.sources
      .map((source: DynamicValue) => ({
        sourceId: this.normalizeOptionalText(source?.sourceId),
        sourceName: this.normalizeOptionalText(source?.sourceName),
        signature: this.buildComparableSourceSignature(source),
      }))
      .filter(item => item.sourceId && item.signature)

    return sources.filter(source =>
      sources.some(other => other.sourceId !== source.sourceId && other.signature === source.signature),
    ) as Array<{ sourceId: string; sourceName?: string; signature: string }>
  }

  private buildWeakSearchReadGuard(
    toolCall: RawToolCall,
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
  ): ToolStateGuard | null {
    if (toolCall.name !== 'read_app_data') {
      return null
    }
    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }

    const latestSearchIndex = this.findLatestSuccessfulSearchResultIndex(actionResults)
    if (latestSearchIndex < 0) {
      return null
    }

    const latestSearchOutput = actionResults[latestSearchIndex]?.output
    if (
      this.normalizeSearchConvergence(latestSearchOutput?.convergence) !== 'weak'
      || latestSearchOutput?.requiresDisambiguation !== true
    ) {
      return null
    }

    const comparedMemoryAppIds = this.collectComparedWeakCandidateAppIdsAfterSearch(
      actionResults,
      latestSearchIndex,
      this.collectEffectiveWeakDisambiguationCandidateAppIds(latestSearchOutput),
    )
    const pendingAppId = this.resolveReadAppDataAppId(toolCall.input)
    const topCandidateAppId = this.normalizeOptionalText(latestSearchOutput?.topCandidateAppId)
    const comparedHint = comparedMemoryAppIds.length
      ? `你已经比较过 ${comparedMemoryAppIds.slice(0, 3).join('、')} 等候选。`
      : ''
    const topCandidateHint = topCandidateAppId
      ? `当前 Top1 候选是 ${topCandidateAppId}，但仍未完成消歧。`
      : ''

    return {
      reason: 'weak_search_read_requires_disambiguation',
      message: `当前 search_apps 仍是 weak 收敛，且 requiresDisambiguation=true，暂不能直接 read_app_data。${comparedHint}${topCandidateHint}请继续比较候选、优先调用 get_app_memory，或直接向用户澄清应用。`,
      metadata: {
        appId: pendingAppId || undefined,
        noNewInformation: true,
      },
    }
  }

  private buildSameAppCompareCoverageGuard(
    toolCall: RawToolCall,
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
    userPrompt?: string,
  ): ToolStateGuard | null {
    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }
    if (!this.isSameAppMultiFormComparePrompt(userPrompt)) {
      return null
    }

    const readTargets = this.collectSuccessfulReadSourceTargets(actionResults)
    const distinctAppIds = [...new Set(readTargets.map(item => item.appId))]
    if (distinctAppIds.length !== 1) {
      return null
    }

    const distinctTargetIds = [...new Set(readTargets.map(item => item.targetId))]
    if (distinctTargetIds.length < 3) {
      return null
    }

    const coveredAppId = distinctAppIds[0]
    const requestedAppId = this.normalizeOptionalText(toolCall.input?.appId)
    if (requestedAppId && requestedAppId !== coveredAppId) {
      return null
    }

    const coveredTargets = new Map(readTargets.map(item => [item.targetId, item] as const))
    const requestedTargetIds = this.extractToolTargetIds(toolCall.input)
    if (
      toolCall.name === 'read_app_data'
      && (!requestedTargetIds.length || requestedTargetIds.some(targetId => !coveredTargets.has(targetId)))
    ) {
      return null
    }

    const appLabel = readTargets.find(item => item.appName)?.appName || coveredAppId
    const visibleTargets = distinctTargetIds
      .slice(0, 3)
      .map(targetId => coveredTargets.get(targetId)?.targetName || targetId)
      .filter(Boolean)
    const targetLabel = visibleTargets.length ? `（${visibleTargets.join('、')}）` : ''
    const actionHint = toolCall.name === 'get_app_memory'
      ? '不要继续回看 get_app_memory'
      : '不要继续重复读取这些已覆盖的 source'

    return {
      reason: 'same_app_compare_coverage_sufficient',
      message: `当前问题已经在同一应用 ${appLabel}${targetLabel} 内完成了 ${distinctTargetIds.length} 张表的读取覆盖。${actionHint}；请直接基于现有结果完成比较，如信息仍不够就明确说明缺口。`,
      metadata: {
        appId: coveredAppId,
        verifiedTargetCount: distinctTargetIds.length,
        verifiedTargetIds: distinctTargetIds,
        noNewInformation: true,
      },
    }
  }

  private buildSameAppMultiFormReadCoverageAdvanceGuard(
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
    userPrompt?: string,
    draftText?: string,
  ): ProgressAdvanceGuard | null {
    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return null
    }
    if (!this.isSameAppMultiFormComparePrompt(userPrompt)) {
      return null
    }

    const normalizedDraftText = normalizeInterimText(draftText || '').trim()
    if (!normalizedDraftText) {
      return null
    }

    const readTargets = this.collectSuccessfulReadSourceTargets(actionResults)
    const distinctAppIds = [...new Set(readTargets.map(item => item.appId))]
    if (distinctAppIds.length !== 1 || readTargets.length !== 1) {
      return null
    }

    const comparableSources = this.collectLatestSameAppComparableSources(actionResults)
    const comparableSourceIds = comparableSources.map(item => item.sourceId)
    const readSourceIds = [...new Set(readTargets.map(item => item.targetId))]
    const readComparableSourceIds = readSourceIds.filter(sourceId => comparableSourceIds.includes(sourceId))
    const unreadComparableSources = comparableSources.filter(item => !readSourceIds.includes(item.sourceId))

    if (comparableSourceIds.length < 2 || readComparableSourceIds.length !== 1 || !unreadComparableSources.length) {
      return null
    }

    const unreadSourceLabel = unreadComparableSources[0]?.sourceName || unreadComparableSources[0]?.sourceId || '另一张同构表'
    return {
      message: `当前应用内已经识别出 ${comparableSourceIds.length} 张结构同构的相关表，但目前只读取了其中 1 张。不要把单表结果表述成完整多表统计；请继续补读剩余同构 source，或明确说明当前只统计了已读取的表。`,
      suppressBufferedText: true,
      fallbackText: `我目前只读取了其中一张结构上同类的表，${unreadSourceLabel} 还没有读取。要给出完整多表结果，我需要继续补读剩余同构表单；否则我只能先明确说明当前结果只覆盖已读取的表。`,
    }
  }

  private buildCrossAppCompareReadCoverageAdvanceGuard(
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
    draftText?: string,
  ): ProgressAdvanceGuard | null {
    if (this.normalizeConversationProfile(conversationProfile) !== 'cross_app_compare') {
      return null
    }

    const normalizedDraftText = normalizeInterimText(draftText || '').trim()
    if (!normalizedDraftText) {
      return null
    }

    const comparedAppIds = this.collectComparedAppIdsFromMemory(actionResults)
    const readTargets = this.collectSuccessfulReadSourceTargets(actionResults)
    const readAppIds = [...new Set(readTargets.map(item => item.appId))]
    const unreadComparedAppIds = comparedAppIds.filter(appId => !readAppIds.includes(appId))
    if (comparedAppIds.length < 2 || readAppIds.length < 1 || !unreadComparedAppIds.length) {
      return null
    }

    return {
      message: `当前问题属于跨应用对比。你已经比较了 ${comparedAppIds.length} 个候选应用，但只读取了 ${readAppIds.length} 个应用的数据。不要直接输出跨应用结论；请继续读取剩余候选应用，或明确声明当前只是单应用结果。`,
      suppressBufferedText: true,
      fallbackText: '我目前只读取了其中一个候选应用的数据，另一个候选应用还没有读取。要继续做跨应用对比，我需要再补读剩余候选应用；否则只能先给你单应用结果并明确说明范围。',
    }
  }

  private buildProgressAdvanceGuard(
    runtimeState: AiThreadRuntimeState | null | undefined,
    actionResults: AiActionResult[],
    userPrompt?: string,
    conversationProfile?: AiConversationProfile,
    draftText?: string,
  ): ProgressAdvanceGuard | null {
    const weakSearchGuard = this.buildBroadScopeWeakSearchClarifyGuard(
      actionResults,
      userPrompt,
      conversationProfile,
      draftText,
    )
    if (weakSearchGuard) {
      return weakSearchGuard
    }

    const sameAppGuard = this.buildSameAppWideScopeClarifyGuard(
      runtimeState,
      actionResults,
      userPrompt,
      conversationProfile,
      draftText,
    )
    if (sameAppGuard) {
      return sameAppGuard
    }

    const sameAppReadCoverageGuard = this.buildSameAppMultiFormReadCoverageAdvanceGuard(
      actionResults,
      conversationProfile,
      userPrompt,
      draftText,
    )
    if (sameAppReadCoverageGuard) {
      return sameAppReadCoverageGuard
    }

    const crossAppReadCoverageGuard = this.buildCrossAppCompareReadCoverageAdvanceGuard(
      actionResults,
      conversationProfile,
      draftText,
    )
    if (crossAppReadCoverageGuard) {
      return crossAppReadCoverageGuard
    }

    const crossAppGuard = this.buildCrossAppCompareCandidateAdvanceGuard(actionResults, conversationProfile)
    return crossAppGuard || null
  }

  private buildBroadScopeWeakSearchClarifyGuard(
    actionResults: AiActionResult[],
    userPrompt?: string,
    conversationProfile?: AiConversationProfile,
    draftText?: string,
  ): ProgressAdvanceGuard | null {
    const resolvedConversationProfile = this.normalizeConversationProfile(conversationProfile)
    if (resolvedConversationProfile !== 'records_query') {
      return null
    }

    const normalizedDraftText = normalizeInterimText(draftText || '').trim()
    if (!normalizedDraftText || !this.isBroadScopeSameAppAnalysisPrompt(userPrompt)) {
      return null
    }

    if (this.isQualifiedShortClarifyResponse(normalizedDraftText)) {
      return null
    }

    let latestSearchIndex = -1
    for (let index = actionResults.length - 1; index >= 0; index -= 1) {
      const result = actionResults[index]
      if (
        result?.ok
        && result.name === 'search_apps'
        && result.output
        && typeof result.output === 'object'
        && !Array.isArray(result.output)
        && result.output.tool === 'search_apps'
      ) {
        latestSearchIndex = index
        break
      }
    }

    if (latestSearchIndex < 0) {
      return null
    }

    const latestSearchOutput = actionResults[latestSearchIndex]?.output
    if (
      this.normalizeSearchConvergence(latestSearchOutput?.convergence) !== 'weak'
      || latestSearchOutput?.requiresDisambiguation !== true
    ) {
      return null
    }

    const followupResults = actionResults.slice(latestSearchIndex + 1)
    if (followupResults.some(result => result?.ok && result.name === 'read_app_data')) {
      return null
    }

    const hasComparedMemory = followupResults.some(result =>
      result?.ok
      && result.name === 'get_app_memory'
      && result.output
      && typeof result.output === 'object'
      && !Array.isArray(result.output),
    )
    if (!hasComparedMemory) {
      return null
    }

    return {
      message: '当前可行应用还没有收敛到唯一目标。不要展开长方案，也不要先问“是否开始”。请直接向用户澄清要查哪个应用；如果你已有 2 到 3 个候选，就点名让用户选择其中一个。',
      suppressBufferedText: true,
      fallbackText: this.buildWeakSearchClarifyTextFromSearchOutput(latestSearchOutput),
    }
  }

  private buildSameAppWideScopeClarifyGuard(
    runtimeState: AiThreadRuntimeState | null | undefined,
    actionResults: AiActionResult[],
    userPrompt?: string,
    conversationProfile?: AiConversationProfile,
    draftText?: string,
  ): ProgressAdvanceGuard | null {
    const resolvedConversationProfile = this.normalizeConversationProfile(conversationProfile)
    if (resolvedConversationProfile !== 'records_query') {
      return null
    }

    const normalizedDraftText = normalizeInterimText(draftText || '').trim()
    if (!normalizedDraftText || !this.isBroadScopeSameAppAnalysisPrompt(userPrompt)) {
      return null
    }

    if (this.isQualifiedShortClarifyResponse(normalizedDraftText)) {
      return null
    }

    let latestSearchIndex = -1
    for (let index = actionResults.length - 1; index >= 0; index -= 1) {
      const result = actionResults[index]
      if (
        result?.ok
        && result.name === 'search_apps'
        && result.output
        && typeof result.output === 'object'
        && !Array.isArray(result.output)
        && result.output.tool === 'search_apps'
      ) {
        latestSearchIndex = index
        break
      }
    }

    if (latestSearchIndex < 0) {
      return null
    }

    const followupResults = actionResults.slice(latestSearchIndex + 1)
    if (followupResults.some(result => result?.ok && result.name === 'read_app_data')) {
      return null
    }

    const comparedMemoryAppIds = Array.from(new Set(
      followupResults
        .filter(result =>
          result?.ok
          && result.name === 'get_app_memory'
          && result.output
          && typeof result.output === 'object'
          && !Array.isArray(result.output),
        )
        .map(result => String(result?.output?.app?.appId || '').trim())
        .filter(Boolean),
    ))

    if (comparedMemoryAppIds.length !== 1) {
      return null
    }

    const selectedAppId = comparedMemoryAppIds[0]
    const runtimeAppId = String(runtimeState?.currentAppId || '').trim()
    if (runtimeAppId && runtimeAppId !== selectedAppId) {
      return null
    }

    const latestSearchOutput = actionResults[latestSearchIndex]?.output
    if (latestSearchOutput?.requiresDisambiguation === true) {
      return null
    }

    const topCandidateAppId = String(latestSearchOutput?.topCandidateAppId || '').trim()
    if (topCandidateAppId && topCandidateAppId !== selectedAppId) {
      return null
    }

    return {
      message: '当前问题是同一应用内的宽范围分析，且你还没有调用 read_app_data。不要展开长方案，也不要先问“是否开始”。请只用一句极短计划，再立刻补一个收窄追问，引导用户先选时间范围、核心指标或业务模块中的一个切口。',
      suppressBufferedText: true,
      fallbackText: '我先收窄一个切口。你最关心这个应用的时间范围、核心指标，还是某个业务模块？',
    }
  }

  private buildCrossAppCompareCandidateAdvanceGuard(
    actionResults: AiActionResult[],
    conversationProfile?: AiConversationProfile,
  ): ProgressAdvanceGuard | null {
    const resolvedConversationProfile = this.normalizeConversationProfile(conversationProfile)
    if (resolvedConversationProfile !== 'cross_app_compare') {
      return null
    }

    let latestSearchIndex = -1
    for (let index = actionResults.length - 1; index >= 0; index -= 1) {
      const result = actionResults[index]
      if (
        result?.ok
        && result.name === 'search_apps'
        && result.output
        && typeof result.output === 'object'
        && !Array.isArray(result.output)
        && result.output.tool === 'search_apps'
      ) {
        latestSearchIndex = index
        break
      }
    }

    if (latestSearchIndex < 0) {
      return null
    }

    const followupResults = actionResults.slice(latestSearchIndex + 1)
    if (followupResults.some(result => result?.ok && result.name === 'read_app_data')) {
      return null
    }

    const latestSearchOutput = actionResults[latestSearchIndex]?.output
    const candidateAppIds = Array.from(new Set(
      (Array.isArray(latestSearchOutput?.apps) ? latestSearchOutput.apps : [])
        .filter((item: DynamicValue) => Number(item?.score || 0) > 0)
        .map((item: DynamicValue) => String(item?.appId || '').trim())
        .filter(Boolean),
    )).slice(0, 3)

    if (candidateAppIds.length < 2) {
      return null
    }

    const comparedAppIds = new Set(
      followupResults
        .filter(result =>
          result?.ok
          && result.name === 'get_app_memory'
          && candidateAppIds.includes(String(result?.output?.app?.appId || '').trim()),
        )
        .map(result => String(result?.output?.app?.appId || '').trim())
        .filter(Boolean),
    )

    if (comparedAppIds.size >= Math.min(2, candidateAppIds.length)) {
      return null
    }

    return {
      message: comparedAppIds.size
        ? `当前问题属于跨应用对比，最近一次 search_apps 仍返回多个可行候选，且目前只比较了 ${comparedAppIds.size} 个候选的 get_app_memory。请先补充比较前 2 到 3 个候选的应用记忆，再决定是否进入 read_app_data 或直接下结论。`
        : '当前问题属于跨应用对比，最近一次 search_apps 仍返回多个可行候选。请先比较前 2 到 3 个候选的 get_app_memory，再决定是否进入 read_app_data 或直接下结论。',
    }
  }

  private buildEffectiveRuntimeState(
    runtimeState?: AiThreadRuntimeState | null,
    actionResults: AiActionResult[] = [],
    batchRuntimeStateEnabled = true,
  ): AiThreadRuntimeState {
    const successfulOutputs = actionResults
      .filter(result => result?.ok && result.output && typeof result.output === 'object')
      .map(result => result.output)
    const reducedRuntimeState = this.runtimeStateReducerService.reduceRuntimeState(runtimeState, successfulOutputs, {
      batchRuntimeStateEnabled,
      materialize: true,
    }) || this.runtimeStateReducerService.materializeRuntimeState(runtimeState)
    return this.crossAppAnalysisBundleService.resolveRuntimeStateWithLatestBundle(reducedRuntimeState)
      || reducedRuntimeState
  }

  private async buildRoundDecisionContext(options: {
    userPrompt?: string
    runtimeState?: AiThreadRuntimeState | null
    actionResults?: AiActionResult[]
    fallbackConversationProfile?: AiConversationProfile
    batchRuntimeStateEnabled?: boolean
  }): Promise<RoundDecisionContext> {
    const effectiveRuntimeState = this.buildEffectiveRuntimeState(
      options.runtimeState,
      options.actionResults || [],
      options.batchRuntimeStateEnabled !== false,
    )
    const runtimeStateForPolicy = this.scenarioPolicyService.attachProfile(
      effectiveRuntimeState,
      options.fallbackConversationProfile,
    ) || effectiveRuntimeState
    const scenarioPolicy = await this.scenarioPolicyService.resolvePolicy({
      userMessage: options.userPrompt,
      runtimeState: runtimeStateForPolicy,
    })
    const runtimeStateWithScopeTransition = this.scenarioPolicyService.applyScopeTransition(
      effectiveRuntimeState,
      {
        userMessage: options.userPrompt,
        profile: scenarioPolicy.profile,
      },
    ) || effectiveRuntimeState
    return {
      runtimeState: this.scenarioPolicyService.attachProfile(
        runtimeStateWithScopeTransition,
        scenarioPolicy.profile,
      ) || runtimeStateWithScopeTransition,
      conversationProfile: scenarioPolicy.profile,
      featureFlags: scenarioPolicy.featureFlags,
    }
  }

  private normalizeSearchIntent(value: DynamicValue): 'records' | 'unknown' {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'records' ? 'records' : 'unknown'
  }

  private normalizeRuntimeIntent(value: DynamicValue): AiThreadRuntimeState['currentIntent'] {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'records'
      || normalized === 'aggregation'
      || normalized === 'clarify'
      ? normalized as AiThreadRuntimeState['currentIntent']
      : undefined
  }

  private resolveConversationProfile(
    runtimeState?: AiThreadRuntimeState | null,
    toolContext?: AiToolExecutionContext | null,
  ): AiConversationProfile | undefined {
    return this.normalizeConversationProfile(
      runtimeState?.currentProfile || toolContext?.conversationProfile,
    )
  }

  private normalizeConversationProfile(value: DynamicValue): AiConversationProfile | undefined {
    const normalized = String(value || '').trim()
    return ['records_query', 'cross_app_compare', 'cross_app_merge', 'cross_app_unresolved'].includes(normalized)
      ? normalized as AiConversationProfile
      : undefined
  }

  private buildRuntimeDiagnostics(runtimeState: AiThreadRuntimeState) {
    const diagnostics = {
      currentTopCandidateStableRounds: Number.isFinite(Number(runtimeState.currentTopCandidateStableRounds))
        ? Math.max(0, Number(runtimeState.currentTopCandidateStableRounds))
        : undefined,
      lastExecutionStrategy: runtimeState.lastExecutionStrategy,
      lastBatchPartial: typeof runtimeState.lastBatchPartial === 'boolean'
        ? runtimeState.lastBatchPartial
        : undefined,
    }

    return Object.values(diagnostics).some(value => value !== undefined && value !== null)
      ? diagnostics
      : undefined
  }

  private normalizeRuntimeSearchConvergence(value: DynamicValue): AiSearchConvergence | undefined {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'none' || normalized === 'weak' || normalized === 'clear'
      ? normalized as AiSearchConvergence
      : undefined
  }

  private normalizeSearchKeywords(value: DynamicValue) {
    return Array.from(new Set(
      (Array.isArray(value) ? value : [value])
        .map(item => String(item || '').trim().toLowerCase())
        .filter(Boolean),
    ))
  }

  private normalizeSearchConvergence(value: DynamicValue): AiSearchConvergence {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'clear' || normalized === 'weak'
      ? normalized
      : 'none'
  }

  private findActionResultIndex(actionResults: AiActionResult[], callId: string) {
    return Math.max(0, actionResults.findIndex(result => result.callId === callId))
  }

  private buildSingleExecutionPlan(
    toolCalls: RawToolCall[],
    round: number,
    traceId: string | undefined,
    strategy: AiRuntimeExecutionStrategy,
    guardMessage: string,
  ): ToolRoundPlan {
    const executionGroup = `wave-${round}-1`
    const [firstCall, ...blockedCalls] = toolCalls
    const blocked = blockedCalls.map(item => {
      const plannedCall = this.toPlannedToolCall(item, 'blocked_by_policy', executionGroup)
      return {
        call: plannedCall,
        result: this.buildBlockedToolResult(item, plannedCall, round, traceId, guardMessage),
      }
    })

    return {
      waves: firstCall ? [{
        strategy,
        executionGroup,
        calls: [this.toPlannedToolCall(firstCall, strategy, executionGroup)],
      }] : [],
      blocked,
      guardMessage,
    }
  }

  private buildSerialExecutionPlan(
    toolCalls: RawToolCall[],
    round: number,
    strategy: AiRuntimeExecutionStrategy,
  ): ToolRoundPlan {
    const executionGroup = `wave-${round}-1`
    return {
      waves: toolCalls.length ? [{
        strategy,
        executionGroup,
        calls: toolCalls.map(item => this.toPlannedToolCall(item, strategy, executionGroup)),
      }] : [],
      blocked: [],
      guardMessage: '',
    }
  }

  private planSplitSingleReadAppDataAnalysisCall(
    toolCalls: RawToolCall[],
    round: number,
  ): ToolRoundPlan | null {
    const executionGroup = `wave-${round}-1`
    let changed = false
    const plannedCalls: PlannedToolCall[] = []

    for (const toolCall of toolCalls) {
      if (toolCall?.name !== 'read_app_data') {
        plannedCalls.push(this.toPlannedToolCall(toolCall, 'hard_serial', executionGroup))
        continue
      }

      const normalizedInput = this.normalizeReadAppDataInputForCache(toolCall.input)
      const mode = String(normalizedInput.mode || '').trim().toLowerCase()
      const targets = Array.isArray(normalizedInput.targets) ? normalizedInput.targets : []
      const hasRawAnalysis = this.hasRawReadAppDataAnalysisInput(toolCall.input)
      const shouldSplit = (
        mode === 'aggregate'
        && hasRawAnalysis
        && targets.length >= 2
        && targets.every(target => target.type === 'source')
      )
      if (!shouldSplit) {
        plannedCalls.push(this.toPlannedToolCall(toolCall, 'hard_serial', executionGroup))
        continue
      }

      changed = true
      plannedCalls.push(...targets.map((target, index) => {
        const nextInput: DynamicRecord = {
          ...toolCall.input,
          target,
        }
        delete nextInput.targets
        return {
          id: `${toolCall.id}__target_${index + 1}`,
          name: toolCall.name,
          kind: toolCall.kind,
          input: nextInput,
          strategy: 'hard_serial' as const,
          executionGroup,
          batchSize: 1,
          targetIds: [String(target.id || '').trim()],
          mergedFromCallIds: [toolCall.id],
        }
      }))
    }

    if (!changed) {
      return null
    }

    return {
      waves: plannedCalls.length ? [{
        strategy: 'hard_serial',
        executionGroup,
        calls: plannedCalls,
      }] : [],
      blocked: [],
      guardMessage: '',
    }
  }

  private buildBlockedToolResult(
    rawCall: RawToolCall,
    plannedCall: PlannedToolCall,
    round: number,
    traceId: string | undefined,
    guard: ToolStateGuard | string,
  ): AiActionResult {
    const normalizedGuard: {
      message: string
      reason?: ToolStateGuardReason
      metadata?: DynamicRecord
    } = typeof guard === 'string'
      ? {
        message: guard,
      }
      : guard
    return {
      callId: plannedCall.id,
      name: rawCall.name,
      kind: rawCall.kind,
      ok: false,
      error: normalizedGuard.message,
      metadata: {
        round,
        traceId,
        strategy: 'blocked_by_policy',
        batchSize: plannedCall.batchSize,
        targetIds: plannedCall.targetIds,
        executionGroup: plannedCall.executionGroup,
        policyBlocked: true,
        queued: true,
        guardReason: normalizedGuard.reason,
        ...(normalizedGuard.metadata || {}),
      },
    }
  }

  private toPlannedToolCall(
    toolCall: RawToolCall,
    strategy: AiRuntimeExecutionStrategy,
    executionGroup: string,
  ): PlannedToolCall {
    return {
      id: toolCall.id,
      name: toolCall.name,
      kind: toolCall.kind,
      input: toolCall.input,
      strategy,
      executionGroup,
      batchSize: this.resolveToolCallBatchSize(toolCall.input),
      targetIds: this.extractToolTargetIds(toolCall.input),
      mergedFromCallIds: [toolCall.id],
    }
  }

  private planBatchReadAppDataCall(toolCalls: RawToolCall[], round: number): PlannedToolCall | null {
    const readCalls = toolCalls.filter(item => item.name === 'read_app_data')
    if (!readCalls.length || readCalls.length !== toolCalls.length) {
      return null
    }

    const normalizedCalls = readCalls.map(item => {
      const normalizedInput = this.normalizeReadAppDataInputForCache(item.input)
      const mode = String(normalizedInput.mode || '').trim().toLowerCase()
      const appId = String(normalizedInput.appId || '').trim()
      const targets = Array.isArray(normalizedInput.targets) ? normalizedInput.targets : []
      const otherArgs = {
        ...normalizedInput,
      }
      delete otherArgs.appId
      delete otherArgs.targets
      delete otherArgs.target
      return {
        call: item,
        mode,
        appId,
        targets,
        hasRawAnalysis: this.hasRawReadAppDataAnalysisInput(item.input),
        signature: this.stableStringify(otherArgs),
      }
    })

    const first = normalizedCalls[0]
    if (!first?.appId || !['records', 'aggregate'].includes(first.mode)) {
      return null
    }
    if (!normalizedCalls.every(item =>
      item.appId === first.appId
      && item.mode === first.mode
      && item.signature === first.signature
      && item.targets.length > 0
      && item.targets.every(target => target.type === 'source')
    )) {
      return null
    }
    if (normalizedCalls.some(item => item.hasRawAnalysis)) {
      return null
    }

    const mergedTargets = normalizedCalls.flatMap(item => item.targets)
    if (mergedTargets.length <= 1) {
      if (normalizedCalls.length === 1 && this.resolveToolCallBatchSize(first.call.input) > 1) {
        return {
          id: first.call.id,
          name: first.call.name,
          kind: first.call.kind,
          input: first.call.input,
          strategy: 'batch',
          executionGroup: `wave-${round}-1`,
          batchSize: mergedTargets.length,
          targetIds: mergedTargets.map(item => item.id),
          mergedFromCallIds: [first.call.id],
        }
      }
      return null
    }

    const uniqueTargets = Array.from(new Map(
      mergedTargets.map(item => [`${item.type}:${item.id}`, item] as const),
    ).values())
    if (uniqueTargets.length <= 1) {
      return null
    }

    const mergedInput: DynamicRecord = {
      ...first.call.input,
      targets: uniqueTargets,
    }
    if (!String(mergedInput.appId || '').trim() && first.appId) {
      mergedInput.appId = first.appId
    }
    delete mergedInput.target
    return {
      id: `read_app_data_batch_${round}_${first.call.id}`,
      name: 'read_app_data',
      kind: first.call.kind,
      input: mergedInput,
      strategy: 'batch',
      executionGroup: `wave-${round}-1`,
      batchSize: uniqueTargets.length,
      targetIds: uniqueTargets.map(item => item.id),
      mergedFromCallIds: normalizedCalls.map(item => item.call.id),
    }
  }

  private areParallelSafeReadCalls(toolCalls: RawToolCall[]) {
    const appIds = new Set<string>()
    return toolCalls.every(item => {
      const appId = String(item.input?.appId || '').trim()
      const mode = String(item.input?.mode || '').trim().toLowerCase()
      const targets = this.extractReadAppDataTargets(item.input)
      if (!appId || !['records', 'aggregate'].includes(mode) || !targets.length) {
        return false
      }
      if (targets.some(target => target.type !== 'source')) {
        return false
      }
      if (appIds.has(appId)) {
        return false
      }
      appIds.add(appId)
      return true
    })
  }

  private areParallelSafeMemoryCalls(toolCalls: RawToolCall[]) {
    const appIds = new Set<string>()
    return toolCalls.every(item => {
      const appId = String(item.input?.appId || '').trim()
      if (!appId || appIds.has(appId)) {
        return false
      }
      appIds.add(appId)
      return true
    })
  }

  private extractReadAppDataTargets(input: DynamicRecord) {
    const targets = Array.isArray(input?.targets) && input.targets.length
      ? input.targets
      : (input?.target ? [input.target] : [])
    return targets
      .map((item: DynamicValue) => ({
        type: String(item?.type || '').trim().toLowerCase(),
        id: String(item?.id || '').trim(),
      }))
      .filter(item => item.type && item.id)
  }

  private hasRawReadAppDataAnalysisInput(input: DynamicRecord) {
    return Boolean(
      input
      && typeof input === 'object'
      && !Array.isArray(input)
      && input.analysis
      && typeof input.analysis === 'object'
      && !Array.isArray(input.analysis)
    )
  }

  private async executePlannedWave(
    wave: PlannedToolWave,
    toolContext: AiToolExecutionContext,
    round: number,
    successfulToolResultCache: Map<string, AiActionResult>,
    repeatedToolCallCounts: Map<string, RepeatedToolCallState>,
    attachmentReadBudget: AiAttachmentReadBudget,
  ) {
    const results: Array<{ call: PlannedToolCall; result: AiActionResult; durationMs: number }> = []
    const concurrency = wave.strategy === 'parallel_safe'
      ? Math.min(AiLlmClientService.MAX_PARALLEL_TOOL_CALLS_PER_WAVE, wave.calls.length)
      : 1
    let cursor = 0

    const worker = async () => {
      while (cursor < wave.calls.length) {
        const currentIndex = cursor
        cursor += 1
        if (currentIndex >= wave.calls.length) {
          return
        }
        const call = wave.calls[currentIndex]
        const startedAt = Date.now()
        const result = await this.executeToolCall(
          call,
          toolContext,
          round,
          successfulToolResultCache,
          repeatedToolCallCounts,
          attachmentReadBudget,
        )
        results.push({
          call,
          result,
          durationMs: Math.max(0, Date.now() - startedAt),
        })
      }
    }

    await Promise.all(
      Array.from({ length: concurrency }, () => worker()),
    )

    const resultMap = new Map(results.map(item => [item.call.id, item] as const))
    return wave.calls
      .map(call => resultMap.get(call.id))
      .filter((item): item is { call: PlannedToolCall; result: AiActionResult; durationMs: number } => Boolean(item))
  }

  private async executeToolCall(
    toolCall: PlannedToolCall,
    toolContext: AiToolExecutionContext,
    round: number,
    successfulToolResultCache: Map<string, AiActionResult>,
    repeatedToolCallCounts: Map<string, RepeatedToolCallState>,
    attachmentReadBudget: AiAttachmentReadBudget,
  ): Promise<AiActionResult> {
    this.throwIfAborted(toolContext.signal)
    if (toolCall.name === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL) {
      return await this.executeWorkbenchClientFormFillTool(toolCall, toolContext, round)
    }
    const cacheKey = toolCall.name === AI_READ_ATTACHMENT_TOOL_NAME
      ? ''
      : await this.buildToolCallCacheKey(toolCall.name, toolCall.input, toolContext)
    const cachedResult = successfulToolResultCache.get(cacheKey)
    if (cachedResult?.ok && await this.canReuseCachedToolResult(toolCall, cachedResult, toolContext)) {
      const repeatedState = this.buildNextRepeatedToolCallState(repeatedToolCallCounts.get(cacheKey), round)
      repeatedToolCallCounts.set(cacheKey, repeatedState)
      if (this.shouldBlockRepeatedToolCall(toolCall.name, repeatedState)) {
        return {
          callId: toolCall.id,
          name: toolCall.name,
          kind: toolCall.kind,
          ok: false,
          error: this.buildRepeatedToolError(cachedResult.output, toolCall.name),
          metadata: {
            round,
            traceId: toolContext.traceId,
            strategy: toolCall.strategy,
            batchSize: toolCall.batchSize,
            targetIds: toolCall.targetIds,
            executionGroup: toolCall.executionGroup,
            reused: true,
            repeatedCount: repeatedState.count,
            consecutiveRepeatedCount: repeatedState.consecutiveCount,
            noNewInformation: true,
            duplicateBlocked: true,
          },
        }
      }

      return {
        ...cachedResult,
        callId: toolCall.id,
        metadata: {
          ...cachedResult.metadata,
          round,
          traceId: toolContext.traceId,
          strategy: toolCall.strategy,
          batchSize: toolCall.batchSize,
          targetIds: toolCall.targetIds,
          executionGroup: toolCall.executionGroup,
          reused: true,
          repeatedCount: repeatedState.count,
          consecutiveRepeatedCount: repeatedState.consecutiveCount,
          noNewInformation: true,
        },
        output: this.buildRepeatedToolOutput(cachedResult.output, toolCall.name, repeatedState),
      }
    }

    try {
      this.throwIfAborted(toolContext.signal)
      const executeStartedAt = Date.now()
      await this.logDiagnosticStage(toolContext.threadId, 'AI DIAG before_execute_tool', {
        threadId: toolContext.threadId,
        traceId: toolContext.traceId,
        toolCallId: toolCall.id,
        round,
        toolName: toolCall.name,
        appId: String(toolCall.input?.appId || '').trim() || undefined,
        sourceId: this.extractFirstTargetIdByType(toolCall.input, 'source'),
        startedAt: executeStartedAt,
      })
      let output: DynamicValue
      if (toolCall.name === AI_READ_ATTACHMENT_TOOL_NAME) {
        if (!this.attachmentService) throw new Error('AI_ATTACHMENT_PARSE_FAILED')
        output = await this.attachmentService.readForModel(
          toolContext.accountId,
          String(toolContext.threadId || '').trim(),
          toolCall.input,
          attachmentReadBudget,
        )
      } else {
        output = await this.localToolService.execute(toolCall.name, toolCall.input, {
          ...toolContext,
          toolCallId: toolCall.id,
          toolRound: round,
        })
      }
      this.throwIfAborted(toolContext.signal)
      const outputRecord = output
      await this.logDiagnosticStage(toolContext.threadId, 'AI DIAG after_execute_tool', {
        threadId: toolContext.threadId,
        traceId: toolContext.traceId,
        toolCallId: toolCall.id,
        round,
        toolName: toolCall.name,
        appId: String(outputRecord?.resolved?.appId || toolCall.input?.appId || '').trim() || undefined,
        resultStatus: String(outputRecord?.status || '').trim() || undefined,
        resultKind: String(outputRecord?.result?.kind || '').trim() || undefined,
        resultPath: String(
          outputRecord?.result?.path
          || outputRecord?.resolved?.target?.path
          || '',
        ).trim() || undefined,
        durationMs: Math.max(0, Date.now() - executeStartedAt),
      })
      const executionMeta = this.extractToolExecutionMeta(output, toolCall)
      const result: AiActionResult = {
        callId: toolCall.id,
        name: toolCall.name,
        kind: toolCall.kind,
        ok: true,
        output,
        metadata: {
          executedAt: executeStartedAt,
          round,
          traceId: toolContext.traceId,
          strategy: executionMeta.strategy,
          batchSize: executionMeta.batchSize,
          targetIds: executionMeta.targetIds,
          executionGroup: toolCall.executionGroup,
          partial: executionMeta.partial,
          succeededTargetIds: executionMeta.succeededTargetIds,
          failedTargetIds: executionMeta.failedTargetIds,
        },
      }
      if (cacheKey) successfulToolResultCache.set(cacheKey, result)
      return result
    } catch (error) {
      await this.logDiagnosticStage(toolContext.threadId, 'AI DIAG execute_tool_error', {
        threadId: toolContext.threadId,
        traceId: toolContext.traceId,
        toolCallId: toolCall.id,
        round,
        toolName: toolCall.name,
        appId: String(toolCall.input?.appId || '').trim() || undefined,
        sourceId: this.extractFirstTargetIdByType(toolCall.input, 'source'),
        aborted: Boolean(toolContext.signal?.aborted),
        error: this.serializeDiagnosticError(error),
      })
      return {
        callId: toolCall.id,
        name: toolCall.name,
        kind: toolCall.kind,
        ok: false,
        error: this.serializeToolError(error),
        metadata: {
          round,
          traceId: toolContext.traceId,
          strategy: toolCall.strategy,
          batchSize: toolCall.batchSize,
          targetIds: toolCall.targetIds,
          executionGroup: toolCall.executionGroup,
        },
      }
    }
  }

  private async executeWorkbenchClientFormFillTool(
    toolCall: PlannedToolCall,
    toolContext: AiToolExecutionContext,
    round: number,
  ): Promise<AiActionResult> {
    const context = normalizeWorkbenchAiFormFillContext(toolContext.currentPageFormFillContext)
    const input = context ? normalizeWorkbenchAiFormFillToolInput(toolCall.input, context) : null
    if (!context || !input) {
      return {
        callId: toolCall.id,
        name: toolCall.name,
        kind: toolCall.kind,
        ok: false,
        error: context
          ? global.i18next.t('aiLlmClientService.formFillInvalidFields')
          : global.i18next.t('aiLlmClientService.formFillNoCurrentForm'),
        metadata: {
          round,
          traceId: toolContext.traceId,
          strategy: toolCall.strategy,
          executionGroup: toolCall.executionGroup,
          executor: 'client-tool',
        },
      }
    }

    try {
      const result = await this.clientToolBridge.waitForResult(
        String(toolContext.threadId || ''),
        toolCall.id,
        120000,
        toolContext.signal,
      )
      return {
        callId: toolCall.id,
        name: toolCall.name,
        kind: toolCall.kind,
        ok: result.ok,
        output: result.output,
        error: result.error,
        metadata: {
          ...(result.metadata || {}),
          round,
          traceId: toolContext.traceId,
          strategy: toolCall.strategy,
          executionGroup: toolCall.executionGroup,
          executor: 'client-tool',
          contextId: context.contextId,
        },
      }
    } catch (error) {
      return {
        callId: toolCall.id,
        name: toolCall.name,
        kind: toolCall.kind,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          round,
          traceId: toolContext.traceId,
          strategy: toolCall.strategy,
          executionGroup: toolCall.executionGroup,
          executor: 'client-tool',
          contextId: context.contextId,
        },
      }
    }
  }

  private extractToolExecutionMeta(output: DynamicValue, call: PlannedToolCall) {
    const executionSummary = output?.result?.executionSummary || {}
    const succeededTargetIds = Array.isArray(output?.result?.succeededTargets)
      ? output.result.succeededTargets.map((item: DynamicValue) => String(item?.id || '').trim()).filter(Boolean)
      : []
    const failedTargetIds = Array.isArray(output?.result?.failedTargets)
      ? output.result.failedTargets.map((item: DynamicValue) => String(item?.id || '').trim()).filter(Boolean)
      : []
    return {
      strategy: this.normalizeExecutionStrategy(executionSummary?.strategy) || call.strategy,
      batchSize: Number.isFinite(Number(executionSummary?.batchSize))
        ? Number(executionSummary.batchSize)
        : call.batchSize,
      partial: Boolean(output?.result?.partial ?? executionSummary?.partial),
      targetIds: call.targetIds.length
        ? call.targetIds
        : this.extractToolTargetIds(output?.resolved || call.input),
      succeededTargetIds,
      failedTargetIds,
    }
  }

  private extractToolChainState(
    output: DynamicValue,
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    const searchConvergence = this.normalizeSearchConvergence(
      output?.tool === 'search_apps'
        ? output?.convergence
        : runtimeState?.currentSearchConvergence,
    )
    const topCandidateAppId = String(
      output?.tool === 'search_apps'
        ? output?.topCandidateAppId
        : runtimeState?.currentTopAppId
        || '',
    ).trim() || undefined
    const searchResultSignature = String(
      output?.tool === 'search_apps'
        ? output?.resultSignature
        : runtimeState?.currentSearchSignature
        || '',
    ).trim() || undefined
    const searchCandidateWeakSignature = String(
      output?.tool === 'search_apps'
        ? output?.candidateWeakSignature
        : runtimeState?.currentSearchWeakSignature
        || '',
    ).trim() || undefined
    const topScoreRatio = Number.isFinite(Number(
      output?.tool === 'search_apps'
        ? output?.topScoreRatio
        : undefined,
    ))
      ? Number(output.topScoreRatio)
      : undefined
    const stableTopCandidateRounds = Number.isFinite(Number(
      output?.tool === 'search_apps'
        ? output?.stableTopCandidateRounds
        : runtimeState?.currentTopCandidateStableRounds,
    ))
      ? Math.max(0, Number(
        output?.tool === 'search_apps'
          ? output?.stableTopCandidateRounds
          : runtimeState?.currentTopCandidateStableRounds,
      ))
      : undefined
    const topCandidateStable = output?.tool === 'search_apps'
      ? (typeof output?.topCandidateStable === 'boolean'
        ? output.topCandidateStable
        : (stableTopCandidateRounds !== undefined ? stableTopCandidateRounds >= 2 : undefined))
      : undefined
    const dominantTopCandidate = output?.tool === 'search_apps'
      ? (typeof output?.dominantTopCandidate === 'boolean' ? output.dominantTopCandidate : undefined)
      : undefined
    const noNewCandidates = output?.tool === 'search_apps'
      ? (typeof output?.noNewCandidates === 'boolean' ? output.noNewCandidates : undefined)
      : undefined
    const shouldShowSearchState = output?.tool === 'search_apps'

    return {
      searchConvergence: shouldShowSearchState ? searchConvergence : undefined,
      topCandidateAppId: shouldShowSearchState ? topCandidateAppId : undefined,
      searchResultSignature: shouldShowSearchState ? searchResultSignature : undefined,
      searchCandidateWeakSignature: shouldShowSearchState ? searchCandidateWeakSignature : undefined,
      topScoreRatio: shouldShowSearchState ? topScoreRatio : undefined,
      dominantTopCandidate: shouldShowSearchState ? dominantTopCandidate : undefined,
      noNewCandidates: shouldShowSearchState ? noNewCandidates : undefined,
      topCandidateStable: shouldShowSearchState ? topCandidateStable : undefined,
      stableTopCandidateRounds: shouldShowSearchState ? stableTopCandidateRounds : undefined,
    }
  }

  private normalizeExecutionStrategy(value: DynamicValue): AiRuntimeExecutionStrategy | null {
    const normalized = String(value || '').trim()
    return ['hard_serial', 'batch', 'parallel_safe', 'blocked_by_policy'].includes(normalized)
      ? normalized as AiRuntimeExecutionStrategy
      : null
  }

  private resolveToolCallBatchSize(input: DynamicRecord) {
    const targets = this.extractToolTargetIds(input)
    return targets.length || 1
  }

  private extractToolTargetIds(value: DynamicValue) {
    const targets = Array.isArray(value?.targets)
      ? value.targets
      : (value?.target ? [value.target] : [])
    return targets
      .map((item: DynamicValue) => String(item?.id || '').trim())
      .filter(Boolean)
  }

  private extractStructuredToolSignals(toolCalls: RawToolCall[]) {
    const toolNames = new Set<string>()
    const appIds = new Set<string>()
    const sourceIds = new Set<string>()
    const modes = new Set<string>()

    for (const toolCall of toolCalls) {
      const name = String(toolCall?.name || '').trim()
      const input = toolCall?.input || {}
      if (name) {
        toolNames.add(name)
      }

      const appId = String(input?.appId || '').trim()
      if (appId) {
        appIds.add(appId)
      }

      const mode = String(input?.mode || '').trim().toLowerCase()
      if (['records', 'aggregate'].includes(mode)) {
        modes.add(mode)
      }

      const targets = Array.isArray(input?.targets)
        ? input.targets
        : (input?.target ? [input.target] : [])
      for (const target of targets) {
        const targetId = String(target?.id || '').trim()
        const targetAppId = String(target?.appId || '').trim()
        const targetType = String(target?.type || '').trim().toLowerCase()
        if (targetAppId) {
          appIds.add(targetAppId)
        }
        if (!targetId) {
          continue
        }
        if (targetType === 'source') {
          sourceIds.add(targetId)
        }
      }
    }

    return {
      toolNames: Array.from(toolNames),
      appIds: Array.from(appIds),
      sourceIds: Array.from(sourceIds),
      modes: Array.from(modes),
    }
  }

  private detectToolProtocolConflict(rawText: string, toolCalls: RawToolCall[]) {
    const textSignals = extractToolProtocolSignals(rawText)
    const structuredSignals = this.extractStructuredToolSignals(toolCalls)
    const conflictingFields = [
      this.detectUniqueToolSignalConflict('toolName', textSignals.toolNames, structuredSignals.toolNames),
      this.detectUniqueToolSignalConflict('mode', textSignals.modes, structuredSignals.modes),
      this.detectUniqueToolSignalConflict('appId', textSignals.appIds, structuredSignals.appIds),
      this.detectUniqueToolSignalConflict('sourceId', textSignals.sourceIds, structuredSignals.sourceIds),
    ].filter(Boolean) as Array<{ field: string; textValue: string; structuredValue: string }>

    if (!conflictingFields.length) {
      return null
    }

    return {
      textSignals,
      structuredSignals,
      conflictingFields,
    }
  }

  private detectUniqueToolSignalConflict(field: string, textValues: string[], structuredValues: string[]) {
    const normalizedTextValues = this.normalizeDiagnosticValues(textValues)
    const normalizedStructuredValues = this.normalizeDiagnosticValues(structuredValues)
    if (normalizedTextValues.length !== 1 || normalizedStructuredValues.length !== 1) {
      return null
    }
    if (normalizedTextValues[0] === normalizedStructuredValues[0]) {
      return null
    }

    return {
      field,
      textValue: normalizedTextValues[0],
      structuredValue: normalizedStructuredValues[0],
    }
  }

  private buildToolProtocolConflictGuardMessage(conflict: {
    conflictingFields: Array<{ field: string; textValue: string; structuredValue: string }>
  }) {
    const details = conflict.conflictingFields
      .map(item => `${item.field}: 文本=${item.textValue}，结构化调用=${item.structuredValue}`)
      .join('；')
    return `检测到本轮文本草稿中的工具参数与结构化 tool_calls 不一致（${details}）。请只保留一套一致的工具调用参数后重新发送。`
  }

  private normalizeDiagnosticValues(values: string[]) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
  }

  private shouldEnableParallelToolCalls(
    runtimeState?: AiThreadRuntimeState | null,
    actionResults: AiActionResult[] = [],
  ) {
    if (runtimeState?.currentContextKind === 'comparison' || runtimeState?.lastExecutionStrategy === 'parallel_safe') {
      return true
    }

    const distinctAppIds = new Set(
      actionResults
        .filter(item => item.ok)
        .map(item => String(item.output?.resolved?.appId || item.output?.app?.appId || '').trim())
        .filter(Boolean),
    )

    return distinctAppIds.size > 1
  }

  private buildParallelToolCallsMetadata(enabled: boolean, disabledForSilentRetry: boolean) {
    if (!disabledForSilentRetry) {
      return {
        parallelToolCalls: enabled,
      }
    }

    return {
      parallelToolCalls: false,
      parallelToolCallsRetried: true,
      parallelToolCallsRetryReason: 'silent_no_tool_call',
    }
  }

  private shouldRetrySilentParallelToolCalls(options: {
    parallelToolCalls: boolean
    retried: boolean
    text: string
    progressAdvanceGuard?: ProgressAdvanceGuard | null
  }) {
    if (!options.parallelToolCalls || options.retried) {
      return false
    }

    const normalizedText = normalizeInterimText(options.text || '')
    return !normalizedText.trim()
      || Boolean(options.progressAdvanceGuard)
      || isLikelyToolProtocolText(normalizedText)
  }

  private isBroadScopeSameAppAnalysisPrompt(userPrompt?: string) {
    const normalized = normalizeInterimText(userPrompt || '').trim()
    if (!normalized) {
      return false
    }

    const fixedPhrases = [
      '整体经营',
      '整体经营情况',
      '整体情况',
      '整体表现',
      '整体运营',
      '运营情况',
      '运营概况',
      '经营情况',
      '经营概况',
      '总体情况',
      '总体表现',
      '总览',
      '全貌',
      '全盘',
    ]
    if (fixedPhrases.some(phrase => normalized.includes(phrase))) {
      return true
    }

    return /分析(?:这个|该)?(?:应用|系统)(?:的)?(?:整体|总体|经营|运营|概况|全貌|总览)/.test(normalized)
  }

  private isSameAppMultiFormComparePrompt(userPrompt?: string) {
    const normalized = normalizeInterimText(userPrompt || '').trim()
    if (!normalized) {
      return false
    }

    if (!/(?:对比|比较|差异|变化|统计|汇总|总计|分析)/.test(normalized)) {
      return false
    }

    if (/(?:多表|多表单|两(?:个|张).{0,12}表)/.test(normalized)) {
      return true
    }

    const sourceTokenCount = (normalized.match(/表单|表/g) || []).length
    return sourceTokenCount >= 2
  }

  private isQualifiedShortClarifyResponse(text?: string) {
    const normalized = normalizeInterimText(text || '').trim()
    if (!normalized) {
      return false
    }

    if (normalized.length > 120) {
      return false
    }

    if (!/[?？]/.test(normalized)) {
      return false
    }

    if (/(?:是否|要不要)(?:开始|继续)|可以开始了吗?|我会先|然后|最后给出结论|分析思路|完整的经营分析/.test(normalized)) {
      return false
    }

    if (/(先看|想先看|更想看|请先选|请选择|请问|先确认|确认一下|聚焦|切口|关心|最关心|方向|问题|时间范围|指标|维度|业务模块|哪一块|哪个方向|哪类|还是)/.test(normalized)) {
      return true
    }

    if (/哪(?:一|个).{0,6}(?:块|类|项|个方向|方面)/.test(normalized)) {
      return true
    }

    if (/最关心.{0,12}(?:什么|哪)/.test(normalized)) {
      return true
    }

    return false
  }

  private buildFailureRecoveryMessageWithRecovery(roundResults: AiActionResult[], actionResults: AiActionResult[]) {
    const failedResults = roundResults.filter(result =>
      !result.ok
      && !result.metadata?.duplicateBlocked
      && !result.metadata?.policyBlocked
    )
    if (!failedResults.length) {
      return ''
    }

    const failureCodes = failedResults
      .map(result => this.extractToolErrorCode(result.error))
      .filter(Boolean)
    const hasAggregateProtocolConflict = failureCodes.some(code => this.isAggregateProtocolConflictErrorCode(code))

    return [
      '上一条工具调用失败了。请优先基于最近一次已成功返回的结构化结果继续；如需重试，请只复用已经验证过的 app、target 和必要参数。',
      hasAggregateProtocolConflict
        ? '如果这次失败涉及 aggregate 参数协议冲突，重试时请保持与最近一次成功请求一致的协议形态：使用 analysis 时不要再混用 legacy 顶层聚合参数；使用 legacy 顶层聚合参数时不要再混用 analysis。'
        : '',
    ].filter(Boolean).join(' ')
  }

  private buildFailureRecoveryMessageV2WithRecovery(roundResults: AiActionResult[], actionResults: AiActionResult[]) {
    const failedResults = roundResults.filter(result =>
      !result.ok
      && !result.metadata?.duplicateBlocked
      && !result.metadata?.policyBlocked
    )
    if (!failedResults.length) {
      return ''
    }

    const failureCodes = failedResults
      .map(result => this.extractToolErrorCode(result.error))
      .filter(Boolean)
    const readFieldNotFoundFailure = failedResults.find(result =>
      this.extractToolErrorCode(result.error) === 'READ_APP_DATA_FIELD_NOT_FOUND',
    )
    const hasReadTargetRequiredFailure = failureCodes.includes('READ_APP_DATA_TARGET_REQUIRED')
    const hasReadOrderByConflictFailure = failureCodes.includes('READ_APP_DATA_ANALYSIS_ORDER_BY_CONFLICT')
    const hasAggregateProtocolConflict = failureCodes.some(code => this.isAggregateProtocolConflictErrorCode(code))

    return [
      '上一条工具调用失败了。请优先基于最近一次已成功返回的结构化结果继续；如需重试，请只复用已经验证过的 app、target 和必要参数。',
      readFieldNotFoundFailure
        ? this.buildReadAppDataFieldNotFoundRecoveryHint(actionResults, readFieldNotFoundFailure)
        : '',
      hasReadTargetRequiredFailure
        ? this.buildReadAppDataTargetRequiredRecoveryHint(actionResults)
        : '',
      hasReadOrderByConflictFailure
        ? this.buildReadAppDataOrderByConflictRecoveryHint(actionResults)
        : '',
      hasAggregateProtocolConflict
        ? '如果这次失败涉及 aggregate 参数协议冲突，重试时请保持与最近一次成功请求一致的协议形态：使用 analysis 时不要再混用 legacy 顶层聚合参数；使用 legacy 顶层聚合参数时不要再混用 analysis。'
        : '',
    ].filter(Boolean).join(' ')
  }

  private buildReadAppDataFieldNotFoundRecoveryHint(
    actionResults: AiActionResult[],
    failedResult: AiActionResult,
  ) {
    const failedDetails = this.extractToolErrorDetails(failedResult.error)
    const appId = this.normalizeOptionalText(failedDetails?.appId)
      || this.findLatestSuccessfulReadAppId(actionResults)
      || this.findLatestSuccessfulMemoryAppId(actionResults)
    const failedTargetId = this.normalizeOptionalText(failedDetails?.sourceId)
      || this.normalizeOptionalText(failedDetails?.tableId)
    const latestSuccessfulTargetId = this.findLatestSuccessfulReadTargetId(actionResults, appId)
    const preferredTargetId = (
      latestSuccessfulTargetId
      && failedTargetId
      && latestSuccessfulTargetId !== failedTargetId
    )
      ? latestSuccessfulTargetId
      : (failedTargetId || latestSuccessfulTargetId)
    const targetId = preferredTargetId
    const fieldName = this.normalizeOptionalText(failedDetails?.field)

    return [
      '本次 read_app_data 失败的原因是字段不存在，或当前无读取权限。',
      fieldName ? `当前失败字段是“${fieldName}”。` : '',
      appId && targetId
        ? `不要重新 search_apps。请优先留在同一个应用里继续修正，复用 应用ID=${appId} 和 target.id=${targetId}。`
        : appId
          ? `不要重新 search_apps。请优先留在同一个应用里继续修正，复用 应用ID=${appId}。`
          : '不要重新 search_apps。请优先留在当前已验证的应用上下文里继续修正字段或 target。',
      '如果字段名还不确定，请先调用 get_app_memory 查看当前可读字段，再修正 field/target 后重新 read_app_data。',
      '如果现有线索仍不足以唯一确定字段，请直接向用户澄清缺失的字段名或统计口径。',
    ].filter(Boolean).join(' ')
  }

  private findLatestSuccessfulReadAppId(actionResults: AiActionResult[]) {
    return this.normalizeOptionalText(
      [...actionResults].reverse().find(result => result?.ok && result.name === 'read_app_data')?.output?.resolved?.appId,
    )
  }

  private findLatestSuccessfulMemoryAppId(actionResults: AiActionResult[]) {
    return this.normalizeOptionalText(
      [...actionResults].reverse().find(result => result?.ok && result.name === 'get_app_memory')?.output?.app?.appId,
    )
  }

  private findLatestSuccessfulReadTargetId(actionResults: AiActionResult[], appId?: string) {
    const normalizedAppId = this.normalizeOptionalText(appId)
    const latestSuccessfulRead = [...actionResults].reverse().find(result => {
      if (!result?.ok || result.name !== 'read_app_data') {
        return false
      }
      if (!normalizedAppId) {
        return true
      }
      return this.normalizeOptionalText(result.output?.resolved?.appId) === normalizedAppId
    })

    return this.normalizeOptionalText(latestSuccessfulRead?.output?.resolved?.target?.id)
  }

  private buildReadAppDataTargetRequiredRecoveryHint(actionResults: AiActionResult[]) {
    const latestSuccessfulRead = [...actionResults].reverse().find(result =>
      result?.ok && result.name === 'read_app_data',
    )
    const targetTypeHint = 'source target'

    return [
      '本次 read_app_data 失败的原因是缺少显式 target.id。',
      `如果你要继续读取同一个目标，请从最近一次成功工具结果中原样复制 ${targetTypeHint} 的 id，再重新发送 read_app_data。`,
      '如果当前上下文还不能确定唯一目标，请先调用 get_app_memory，再显式传入 target.id 或 targets[].id。',
      '不要只传 appId、mode 或 filters，也不要依赖 Runtime 代你补 target。',
    ].join(' ')
  }

  private buildReadAppDataOrderByConflictRecoveryHint(actionResults: AiActionResult[]) {
    const latestSuccessfulRead = [...actionResults].reverse().find(result =>
      result?.ok && result.name === 'read_app_data',
    )
    const latestResolved = latestSuccessfulRead?.output?.resolved || {}
    const latestAppId = String(latestResolved?.appId || '').trim()
    const latestTargetId = String(latestResolved?.target?.id || '').trim()
    const latestMode = String(latestResolved?.mode || '').trim().toLowerCase()

    return [
      '本次 read_app_data 失败的原因是 analysis.orderBy 的单项同时指定了 metric 和 group。',
      '重试时每个 orderBy 项只能二选一：要么按 metric 排序，要么按 group 排序，不能把两者写在同一项里。',
      '如果是在看时间趋势，请把时间维度放进 analysis.groupBy，并把 analysis.orderBy 改成只按该时间 group 升序排序；不要在同一个 orderBy 项里再附带销售额 metric。',
      latestMode === 'aggregate' && latestAppId && latestTargetId
        ? `继续追问同一份统计时，请复用最近一次成功请求里的 应用ID=${latestAppId} 和 target.id=${latestTargetId}，只增补必要的时间 group 或排序字段。`
        : '',
    ].filter(Boolean).join(' ')
  }

  private buildFailureRecoveryMessage(roundResults: AiActionResult[], actionResults: AiActionResult[]) {
    const failedResults = roundResults.filter(result =>
      !result.ok
      && !result.metadata?.duplicateBlocked
      && !result.metadata?.policyBlocked
    )
    if (!failedResults.length) {
      return ''
    }

    const failureCodes = failedResults
      .map(result => this.extractToolErrorCode(result.error))
      .filter(Boolean)
    const hasAggregateProtocolConflict = failureCodes.some(code => this.isAggregateProtocolConflictErrorCode(code))

    return [
      '上一条工具调用失败了。请优先基于最近一次已成功返回的结构化结果继续；如需重试，请只复用已经验证过的 app、target 和必要参数。',
      hasAggregateProtocolConflict
        ? '如果这次失败涉及 aggregate 参数协议冲突，重试时请保持与最近一次成功请求一致的协议形态：使用 analysis 时不要再混用 legacy 顶层聚合参数；使用 legacy 顶层聚合参数时不要再混用 analysis。'
        : '',
    ].filter(Boolean).join(' ')
  }

  private async buildToolCallCacheKey(
    name: string,
    input: DynamicRecord,
    toolContext?: AiToolExecutionContext,
  ) {
    const normalizedInput = this.normalizeToolCallInputForCache(name, input)
    if (name === 'search_apps' && toolContext) {
      try {
        const featureFlags = await this.aiConfigService.getFeatureFlags(toolContext.conversationProfile)
        if (featureFlags.searchAppsCatalogInvalidateEnabled) {
          return `${name}:${this.stableStringify({
            ...normalizedInput,
            accessibleAppsSignature: await this.localToolService.getAccessibleAppsSignatureForContext(toolContext),
          })}`
        }
      } catch {
        // Fall back to the input-only cache key when signature precheck is unavailable.
      }
    }

    return `${name}:${this.stableStringify(normalizedInput)}`
  }

  private async resolveCurrentAccessibleAppsSignature(
    toolContext?: AiToolExecutionContext,
    featureFlags?: Partial<AiFeatureFlags> | null,
  ) {
    if (!toolContext || featureFlags?.searchAppsCatalogInvalidateEnabled === false) {
      return undefined
    }

    try {
      return String(
        await this.localToolService.getAccessibleAppsSignatureForContext(toolContext),
      ).trim() || undefined
    } catch {
      return undefined
    }
  }

  private async canReuseCachedToolResult(
    toolCall: PlannedToolCall,
    cachedResult: AiActionResult,
    toolContext: AiToolExecutionContext,
  ) {
    const output = cachedResult?.output
    if (!cachedResult?.ok || !output || typeof output !== 'object' || Array.isArray(output)) {
      return true
    }
    if (toolCall.name !== 'get_app_memory' && toolCall.name !== 'read_app_data') {
      return true
    }

    let featureFlags: AiFeatureFlags | null = null
    try {
      featureFlags = await this.aiConfigService.getFeatureFlags(toolContext.conversationProfile)
    } catch {
      featureFlags = null
    }

    if (featureFlags?.searchAppsCatalogInvalidateEnabled !== false) {
      const currentAccessibleAppsSignature = await this.resolveCurrentAccessibleAppsSignature(toolContext, featureFlags)
      const cachedAccessibleAppsSignature = String(output?.accessibleAppsSignature || '').trim() || undefined
      if (currentAccessibleAppsSignature && (!cachedAccessibleAppsSignature || cachedAccessibleAppsSignature !== currentAccessibleAppsSignature)) {
        return false
      }
    }

    if (typeof this.localToolService.canReuseCachedToolOutput !== 'function') {
      return true
    }

    try {
      return await this.localToolService.canReuseCachedToolOutput(toolCall.name, output, toolContext)
    } catch {
      return false
    }
  }

  private buildNextRepeatedToolCallState(previousState: RepeatedToolCallState | undefined, round: number): RepeatedToolCallState {
    const count = (previousState?.count || 0) + 1
    const consecutiveCount = previousState && previousState.round >= round - 1
      ? (previousState.consecutiveCount || 0) + 1
      : 1

    return {
      round,
      count,
      consecutiveCount,
    }
  }

  private normalizeToolCallInputForCache(name: string, input: DynamicRecord) {
    const safeInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
    if (name === 'read_app_data') {
      return this.normalizeReadAppDataInputForCache(safeInput)
    }

    return this.ensureNormalizedRecord(
      this.normalizeToolCacheValue(safeInput, { insideFilters: false }),
    )
  }

  private normalizeReadAppDataInputForCache(input: DynamicRecord) {
    const normalized = this.ensureNormalizedRecord(
      this.normalizeToolCacheValue(input, { insideFilters: false }),
    )
    const normalizedTargets = this.normalizeReadAppDataTargetsForCache(input)
    const resolvedAppId = this.resolveReadAppDataAppId(input)

    const next: DynamicRecord = {
      ...normalized,
    }

    delete next.target
    delete next.targets

    this.normalizeTrimmedStringField(next, 'mode', { lowerCase: true })
    this.normalizeTrimmedStringField(next, 'sortBy')
    this.normalizeTrimmedStringField(next, 'sortOrder', { lowerCase: true })
    this.normalizeTrimmedStringField(next, 'groupBy')
    this.normalizeTrimmedStringField(next, 'timeGranularity', { lowerCase: true })
    this.normalizeTrimmedStringField(next, 'executionPreference', { lowerCase: true })
    this.normalizeTrimmedStringField(next, 'returnMode', { lowerCase: true })
    this.normalizeTrimmedStringField(next, 'partialPolicy', { lowerCase: true })
    if (next.analysis !== undefined) {
      next.analysis = this.normalizeReadAppDataAnalysisForCache(next.analysis)
      if (next.analysis === undefined) {
        delete next.analysis
      }
    }

    if (resolvedAppId) {
      next.appId = resolvedAppId
    } else {
      delete next.appId
    }

    if (normalizedTargets.length) {
      next.targets = normalizedTargets
    }

    return next
  }

  private normalizeReadAppDataAnalysisForCache(value: DynamicValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }

    const hasExplicitMetrics = Object.prototype.hasOwnProperty.call(value, 'metrics')
    const rawMetrics = Array.isArray(value?.metrics)
      ? value.metrics
      : []
    const metrics = (hasExplicitMetrics
      ? rawMetrics
      : [{ op: 'count', as: '__count' }]
    )
      .map((item: DynamicValue) => {
        const op = String(item?.op || '').trim().toLowerCase()
        const rawField = String(item?.field || '').trim()
        const field = op === 'count' && rawField === '*'
          ? ''
          : rawField
        const alias = String(item?.as || '').trim()
        if (!op || !alias) {
          return null
        }
        return {
          op,
          field: field || undefined,
          as: alias,
        }
      })
      .filter(Boolean)
    const groupBy = Array.isArray(value?.groupBy)
      ? value.groupBy
        .map((item: DynamicValue) => {
          const field = String(item?.field || '').trim()
          const alias = String(item?.as || '').trim()
          const timeGranularity = String(item?.timeGranularity || '').trim().toLowerCase()
          if (!field) {
            return null
          }
          return {
            field,
            as: alias || undefined,
            timeGranularity: timeGranularity || undefined,
          }
        })
        .filter(Boolean)
      : []
    const having = Array.isArray(value?.having)
      ? value.having
        .map((item: DynamicValue) => {
          const metric = String(item?.metric || '').trim()
          const op = String(item?.op || '').trim().toLowerCase()
          if (!metric || !op) {
            return null
          }
          return {
            metric,
            op,
            value: item?.value ?? null,
          }
        })
        .filter(Boolean)
      : []
    const orderBy = Array.isArray(value?.orderBy)
      ? value.orderBy
        .map((item: DynamicValue) => {
          const metric = String(item?.metric || '').trim()
          const group = String(item?.group || '').trim()
          const direction = String(item?.direction || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc'
          if (!metric && !group) {
            return null
          }
          return {
            metric: metric || undefined,
            group: group || undefined,
            direction,
          }
        })
        .filter(Boolean)
      : []

    if (!metrics.length && !groupBy.length && !having.length && !orderBy.length && value?.topN === undefined) {
      return undefined
    }

    return {
      metrics,
      groupBy: groupBy.length ? groupBy : undefined,
      having: having.length ? having : undefined,
      orderBy: orderBy.length ? orderBy : undefined,
      topN: value?.topN ?? undefined,
    }
  }

  private normalizeReadAppDataAnalysisForWeakSignature(value: DynamicValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }

    const hasExplicitMetrics = Object.prototype.hasOwnProperty.call(value, 'metrics')
    const rawMetrics = Array.isArray(value?.metrics)
      ? value.metrics
      : []
    const metrics = (hasExplicitMetrics
      ? rawMetrics
      : [{ op: 'count' }]
    )
      .map((item: DynamicValue) => {
        const op = String(item?.op || '').trim().toLowerCase()
        const rawField = String(item?.field || '').trim()
        const field = op === 'count' && rawField === '*'
          ? ''
          : rawField
        if (!op) {
          return null
        }
        return {
          op,
          field: field || undefined,
        }
      })
      .filter(Boolean)
    const groupBy = Array.isArray(value?.groupBy)
      ? value.groupBy
        .map((item: DynamicValue) => {
          const field = String(item?.field || '').trim()
          const timeGranularity = String(item?.timeGranularity || '').trim().toLowerCase()
          if (!field) {
            return null
          }
          return {
            field,
            timeGranularity: timeGranularity || undefined,
          }
        })
        .filter(Boolean)
      : []
    const having = Array.isArray(value?.having)
      ? value.having
        .map((item: DynamicValue) => {
          const metric = String(item?.metric || '').trim()
          const op = String(item?.op || '').trim().toLowerCase()
          if (!metric || !op) {
            return null
          }
          return {
            metric,
            op,
            value: item?.value ?? null,
          }
        })
        .filter(Boolean)
      : []
    const orderBy = Array.isArray(value?.orderBy)
      ? value.orderBy
        .map((item: DynamicValue) => {
          const metric = String(item?.metric || '').trim()
          const group = String(item?.group || '').trim()
          const direction = String(item?.direction || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc'
          if (!metric && !group) {
            return null
          }
          return {
            metric: metric || undefined,
            group: group || undefined,
            direction,
          }
        })
        .filter(Boolean)
      : []

    if (!metrics.length && !groupBy.length && !having.length && !orderBy.length && value?.topN === undefined) {
      return undefined
    }

    return {
      metrics,
      groupBy: groupBy.length ? groupBy : undefined,
      having: having.length ? having : undefined,
      orderBy: orderBy.length ? orderBy : undefined,
      topN: value?.topN ?? undefined,
    }
  }

  private normalizeToolCacheValue(value: DynamicValue, context: { insideFilters: boolean }): DynamicValue {
    if (value === undefined) {
      return undefined
    }
    if (Array.isArray(value)) {
      const normalizedItems = value
        .map(item => this.normalizeToolCacheValue(item, context))
        .filter(item => item !== undefined)
      return normalizedItems.length ? normalizedItems : undefined
    }
    if (!value || typeof value !== 'object') {
      return value
    }

    const normalizedRecord: DynamicRecord = {}
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const normalizedKey = context.insideFilters ? this.normalizeFilterOperatorKey(rawKey) : rawKey
      const normalizedValue = this.normalizeToolCacheValue(rawValue, {
        insideFilters: context.insideFilters || rawKey === 'filters',
      })
      if (normalizedValue === undefined || this.isEmptyNormalizedValue(normalizedValue)) {
        continue
      }
      if (!(normalizedKey in normalizedRecord)) {
        normalizedRecord[normalizedKey] = normalizedValue
        continue
      }
      if (this.stableStringify(normalizedRecord[normalizedKey]) === this.stableStringify(normalizedValue)) {
        continue
      }
      normalizedRecord[normalizedKey] = normalizedValue
    }

    return Object.keys(normalizedRecord).length ? normalizedRecord : undefined
  }

  private normalizeFilterOperatorKey(key: string) {
    const normalizedKey = String(key || '').trim()
    switch (normalizedKey) {
    case 'and':
    case '$and':
      return '$and'
    case 'or':
    case '$or':
      return '$or'
    case 'gt':
    case '$gt':
      return '$gt'
    case 'gte':
    case '$gte':
      return '$gte'
    case 'lt':
    case '$lt':
      return '$lt'
    case 'lte':
    case '$lte':
      return '$lte'
    case 'eq':
    case '$eq':
      return '$eq'
    case 'ne':
    case '$ne':
      return '$ne'
    case 'in':
    case '$in':
      return '$in'
    case 'nin':
    case '$nin':
      return '$nin'
    default:
      return key
    }
  }

  private normalizeReadAppDataTargetsForCache(input: DynamicRecord) {
    const targetMap = new Map<string, { type: string; id: string }>()
    const targets = Array.isArray(input?.targets) && input.targets.length
      ? input.targets
      : (input?.target ? [input.target] : [])

    targets.forEach((item: DynamicValue) => {
      const type = String(item?.type || '').trim().toLowerCase()
      const id = String(item?.id || '').trim()
      if (!type || !id) {
        return
      }
      targetMap.set(`${type}:${id}`, {
        type,
        id,
      })
    })

    return [...targetMap.values()]
      .sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`))
  }

  private extractReadAppDataTargetAppIds(input: DynamicRecord) {
    const targets = Array.isArray(input?.targets) && input.targets.length
      ? input.targets
      : (input?.target ? [input.target] : [])

    return Array.from(new Set(
      targets
        .map((item: DynamicValue) => String(item?.appId || '').trim())
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right))
  }

  private resolveReadAppDataAppId(input: DynamicRecord) {
    const appId = String(input?.appId || '').trim()
    if (appId) {
      return appId
    }

    const targetAppIds = this.extractReadAppDataTargetAppIds(input)
    return targetAppIds.length === 1 ? targetAppIds[0] : ''
  }

  private ensureNormalizedRecord(value: DynamicValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return value as DynamicRecord
  }

  private isEmptyNormalizedValue(value: DynamicValue) {
    if (Array.isArray(value)) {
      return value.length === 0
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length === 0
    }
    return false
  }

  private normalizeTrimmedStringField(
    record: DynamicRecord,
    key: string,
    options: {
      lowerCase?: boolean
    } = {},
  ) {
    if (!(key in record)) {
      return
    }

    const trimmed = String(record[key] || '').trim()
    if (!trimmed) {
      delete record[key]
      return
    }

    record[key] = options.lowerCase ? trimmed.toLowerCase() : trimmed
  }

  private decorateToolResultForPromptAndState(
    output: DynamicValue,
    runtimeState?: AiThreadRuntimeState | null,
    actionResults: AiActionResult[] = [],
    userPrompt?: string,
  ) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return output
    }

    if (output.tool === 'search_apps') {
      return this.decorateSearchOutputWithProgressSignals(output, runtimeState, actionResults, userPrompt)
    }

    return output
  }

  private decorateSearchOutputWithProgressSignals(
    output: DynamicValue,
    runtimeState?: AiThreadRuntimeState | null,
    actionResults: AiActionResult[] = [],
    userPrompt?: string,
  ) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return output
    }

    const explicitAppName = String(
      output?.explicitAppName
      || this.resolvePromptExplicitSearchAppName(userPrompt, output)
      || '',
    ).trim() || undefined
    const weakSignature = String(
      output.candidateWeakSignature
      || this.buildSearchCandidateWeakSignatureFromOutput(output)
      || '',
    ).trim() || undefined
    const latestPreviousSearch = [...actionResults].reverse().find(result =>
      result?.ok
      && result?.output
      && typeof result.output === 'object'
      && !Array.isArray(result.output)
      && result.output.tool === 'search_apps',
    )
    const previousOutput = latestPreviousSearch?.output
    const previousWeakSignature = String(
      previousOutput?.candidateWeakSignature
      || this.buildSearchCandidateWeakSignatureFromOutput(previousOutput)
      || '',
    ).trim() || undefined
    const accessibleAppsSignature = String(output?.accessibleAppsSignature || '').trim() || undefined
    const previousAccessibleAppsSignature = String(previousOutput?.accessibleAppsSignature || '').trim() || undefined
    const topCandidateAppId = String(output.topCandidateAppId || '').trim() || undefined
    const previousTopCandidateAppId = String(previousOutput?.topCandidateAppId || '').trim() || undefined
    const previousStableRounds = Number.isFinite(Number(previousOutput?.stableTopCandidateRounds))
      ? Math.max(0, Number(previousOutput.stableTopCandidateRounds))
      : 0
    const catalogChanged = Boolean(
      accessibleAppsSignature
      && previousAccessibleAppsSignature
      && accessibleAppsSignature !== previousAccessibleAppsSignature,
    )
    const noNewCandidates = Boolean(
      weakSignature
      && previousWeakSignature
      && weakSignature === previousWeakSignature
      && !catalogChanged,
    )
    const currentStableRounds = Number.isFinite(Number(output?.stableTopCandidateRounds))
      ? Math.max(0, Number(output.stableTopCandidateRounds))
      : undefined
    const stableTopCandidateRounds = topCandidateAppId
      ? Math.max(
        currentStableRounds || 0,
        previousTopCandidateAppId && previousTopCandidateAppId === topCandidateAppId && !catalogChanged
          ? previousStableRounds + 1
          : 1,
      )
      : currentStableRounds
    const topCandidateStable = typeof output?.topCandidateStable === 'boolean'
      ? output.topCandidateStable
      : (Number.isFinite(Number(stableTopCandidateRounds)) ? Number(stableTopCandidateRounds) >= 2 : undefined)
    const repeatNotice = noNewCandidates
      ? (String(output?.repeatNotice || '').trim() || '已复用弱等价的 search_apps 候选结果，本轮没有新增候选证据。')
      : (String(output?.repeatNotice || '').trim() || undefined)

    return {
      ...output,
      explicitAppName,
      candidateWeakSignature: weakSignature,
      noNewCandidates: typeof output?.noNewCandidates === 'boolean'
        ? (output.noNewCandidates || noNewCandidates)
        : (noNewCandidates ? true : undefined),
      noNewInformation: typeof output?.noNewInformation === 'boolean'
        ? (output.noNewInformation || noNewCandidates)
        : (noNewCandidates ? true : undefined),
      repeatNotice,
      topCandidateStable,
      stableTopCandidateRounds,
      decision: output?.decision && typeof output.decision === 'object' && !Array.isArray(output.decision)
        ? {
          ...output.decision,
          noNewInformation: output.decision?.noNewInformation || noNewCandidates || undefined,
        }
        : output?.decision,
    }
  }

  private buildSearchCandidateWeakSignatureFromOutput(output: DynamicValue) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return ''
    }

    const intent = this.normalizeSearchIntent(output.intent)
    const matchedCount = Number.isFinite(Number(output.totalMatched))
      ? Math.max(0, Number(output.totalMatched))
      : 0
    const topCandidateAppId = String(
      output.topCandidateAppId
      || (Array.isArray(output.apps) ? output.apps[0]?.appId : '')
      || '',
    ).trim() || 'none'
    const candidateIds = (Array.isArray(output.apps) ? output.apps : [])
      .slice(0, 5)
      .map((item: DynamicValue) => String(item?.appId || '').trim())
      .filter(Boolean)
      .join('|') || 'none'

    return `${intent}:${matchedCount}:top1=${topCandidateAppId}:candidates=${candidateIds}`
  }

  private buildSearchRepeatGuard(
    pendingInput: DynamicRecord,
    executedToolCalls: ExecutedToolCallRecord[],
    conversationProfile?: AiConversationProfile,
    options?: {
      currentAccessibleAppsSignature?: string
      catalogInvalidateEnabled?: boolean
      fallbackTtlMs?: number
      now?: number
    },
  ): ToolStateGuard | null {
    const resolvedConversationProfile = this.normalizeConversationProfile(conversationProfile)
    if (resolvedConversationProfile === 'cross_app_compare') {
      return null
    }

    const successfulSearchCalls = executedToolCalls.filter(item =>
      item.name === 'search_apps'
      && item.result?.ok
      && item.result?.output
      && typeof item.result.output === 'object'
      && !Array.isArray(item.result.output)
      && item.result.output.tool === 'search_apps',
    )
    if (successfulSearchCalls.length < 2) {
      return null
    }

    const latest = successfulSearchCalls[successfulSearchCalls.length - 1]
    const previous = successfulSearchCalls[successfulSearchCalls.length - 2]
    const latestOutput = latest.result.output
    const previousOutput = previous.result.output
    const currentAccessibleAppsSignature = String(options?.currentAccessibleAppsSignature || '').trim()
    const latestAccessibleAppsSignature = String(latestOutput?.accessibleAppsSignature || '').trim()
    if (
      options?.catalogInvalidateEnabled !== false
      && currentAccessibleAppsSignature
      && latestAccessibleAppsSignature
      && currentAccessibleAppsSignature !== latestAccessibleAppsSignature
    ) {
      return null
    }
    if (
      options?.catalogInvalidateEnabled !== false
      && (!currentAccessibleAppsSignature || !latestAccessibleAppsSignature)
    ) {
      const fallbackTtlMs = Math.max(0, Number(options?.fallbackTtlMs || 0))
      const latestExecutedAt = Number(latest.result?.metadata?.executedAt || 0)
      const now = Math.max(latestExecutedAt, Number(options?.now || Date.now()))
      if (fallbackTtlMs > 0 && latestExecutedAt > 0 && now - latestExecutedAt >= fallbackTtlMs) {
        return null
      }
    }
    const latestWeakSignature = String(
      latestOutput?.candidateWeakSignature
      || this.buildSearchCandidateWeakSignatureFromOutput(latestOutput)
      || '',
    ).trim()
    const previousWeakSignature = String(
      previousOutput?.candidateWeakSignature
      || this.buildSearchCandidateWeakSignatureFromOutput(previousOutput)
      || '',
    ).trim()
    const latestTopCandidateAppId = String(latestOutput?.topCandidateAppId || '').trim()
    const previousTopCandidateAppId = String(previousOutput?.topCandidateAppId || '').trim()
    if (
      !latestWeakSignature
      || !previousWeakSignature
      || latestWeakSignature !== previousWeakSignature
      || !latestTopCandidateAppId
      || latestTopCandidateAppId !== previousTopCandidateAppId
    ) {
      return null
    }

    const equivalentStableSearchCount = this.countTrailingEquivalentSearchCalls(successfulSearchCalls)
    const pendingKeywords = this.normalizeSearchKeywords(pendingInput?.keywords)
    const recentKeywordUnion = new Set([
      ...this.normalizeSearchKeywords(latest.input?.keywords),
      ...this.normalizeSearchKeywords(previous.input?.keywords),
    ])
    const hasNewDistinctKeywords = pendingKeywords.some(item => !recentKeywordUnion.has(item))

    if (
      resolvedConversationProfile === 'records_query'
      && this.normalizeSearchConvergence(latestOutput?.convergence) === 'weak'
      && latestOutput?.requiresDisambiguation === true
      && equivalentStableSearchCount >= 2
      && !hasNewDistinctKeywords
    ) {
      return {
        reason: 'weak_search_disambiguation_stop_loss',
        message: '当前 search_apps 仍处于 weak + requiresDisambiguation=true，且最近几轮没有新增区分性关键词或新增候选证据。不要继续空转搜索。请直接点名列出最相关的 1 到 3 个候选让用户确认；如果用户原话已包含显式应用名，则优先围绕该名称说明仍存在的歧义。',
        metadata: {
          searchRepeatBlocked: true,
          searchStopReason: 'weak_search_disambiguation_stop_loss',
          noNewInformation: true,
          equivalentStableSearchCount,
          pendingKeywordCount: pendingKeywords.length,
        },
      }
    }

    const latestNoNewCandidates = typeof latestOutput?.noNewCandidates === 'boolean'
      ? latestOutput.noNewCandidates
      : false
    const latestTopCandidateStable = typeof latestOutput?.topCandidateStable === 'boolean'
      ? latestOutput.topCandidateStable
      : Number(latestOutput?.stableTopCandidateRounds || 0) >= 2
    if (!latestNoNewCandidates || !latestTopCandidateStable) {
      return null
    }

    if (equivalentStableSearchCount >= 3) {
      return {
        reason: 'search_repeat_hard_cap',
        message: resolvedConversationProfile === 'records_query'
          ? '当前问题里已连续多次 search_apps 且候选未变化。继续搜索通常不会带来新增候选证据。请停止重复搜索，基于现有候选继续比较、改用 get_app_memory，或直接向用户澄清。'
          : buildRepeatedSearchUnsupportedIntentMessage({
            includeGetAppMemoryHint: true,
            includeDisambiguationHint: true,
          }),
        metadata: {
          searchRepeatBlocked: true,
          searchStopReason: 'search_repeat_hard_cap',
          noNewInformation: true,
        },
      }
    }

    if (hasNewDistinctKeywords) {
      return null
    }

    if (resolvedConversationProfile !== 'records_query') {
      return null
    }

    return {
      reason: 'search_repeat_no_new_keywords',
      message: '最近两次 search_apps 已返回同一批候选，且没有新增候选证据；当前这次也没有引入新的区分性关键词。不要继续重复搜索。请基于现有候选继续比较、改用 get_app_memory，或直接向用户澄清。',
      metadata: {
        searchRepeatBlocked: true,
        searchStopReason: 'search_repeat_no_new_keywords',
        noNewInformation: true,
      },
    }
  }

  private countTrailingEquivalentSearchCalls(searchCalls: ExecutedToolCallRecord[]) {
    if (!searchCalls.length) {
      return 0
    }

    const latest = searchCalls[searchCalls.length - 1]
    const latestOutput = latest.result?.output
    const latestWeakSignature = String(
      latestOutput?.candidateWeakSignature
      || this.buildSearchCandidateWeakSignatureFromOutput(latestOutput)
      || '',
    ).trim()
    const latestAccessibleAppsSignature = String(latestOutput?.accessibleAppsSignature || '').trim()
    const latestTopCandidateAppId = String(latestOutput?.topCandidateAppId || '').trim()
    if (!latestWeakSignature || !latestTopCandidateAppId) {
      return 0
    }

    let count = 0
    for (let index = searchCalls.length - 1; index >= 0; index -= 1) {
      const currentOutput = searchCalls[index]?.result?.output
      const currentWeakSignature = String(
        currentOutput?.candidateWeakSignature
        || this.buildSearchCandidateWeakSignatureFromOutput(currentOutput)
        || '',
      ).trim()
      const currentAccessibleAppsSignature = String(currentOutput?.accessibleAppsSignature || '').trim()
      const currentTopCandidateAppId = String(currentOutput?.topCandidateAppId || '').trim()
      const catalogMatched = !latestAccessibleAppsSignature
        || !currentAccessibleAppsSignature
        || currentAccessibleAppsSignature === latestAccessibleAppsSignature
      if (!catalogMatched || currentWeakSignature !== latestWeakSignature || currentTopCandidateAppId !== latestTopCandidateAppId) {
        break
      }
      count += 1
    }

    return count
  }

  private shouldBlockRepeatedToolCall(toolName: string, repeatedState: RepeatedToolCallState) {
    if (toolName !== 'read_app_data') {
      return false
    }

    return repeatedState.consecutiveCount >= 2
  }

  private stableStringify(value: DynamicValue): string {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableStringify(item)).join(',')}]`
    }
    if (typeof value !== 'object') {
      return JSON.stringify(value)
    }
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
    return `{${entries.join(',')}}`
  }

  private buildRepeatedToolOutput(output: DynamicValue, toolName: string, repeatedState: RepeatedToolCallState) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return output
    }

    const readAppGuidance = toolName === 'read_app_data' ? this.buildReadAppDataRepeatGuidance(output) : null
    const repeatedHint = readAppGuidance?.repeatHint
      || '当前工具调用与已成功调用的请求语义等价，不会带来新增数据。你可以基于现有结果继续判断；如果仍需检索，请改用不同的输入。'
    const repeatNotice = readAppGuidance?.repeatNotice
      || '已复用语义等价的工具结果。本轮没有新增数据。'

    return {
      ...output,
      repeatedCall: true,
      repeatedCount: repeatedState.count,
      consecutiveRepeatedCount: repeatedState.consecutiveCount,
      noNewInformation: true,
      repeatNotice,
      decision: {
        ...(output.decision && typeof output.decision === 'object' && !Array.isArray(output.decision) ? output.decision : {}),
        repeated: true,
        noNewInformation: true,
        repeatHint: repeatedHint,
      },
    }
  }

  private buildRepeatedToolError(output: DynamicValue, toolName: string) {
    if (toolName === 'read_app_data') {
      return this.buildReadAppDataRepeatGuidance(output).error
    }

    return '重复工具调用已被阻止。这份输入在当前提问里已经成功过了。除非你修改输入，否则不要再次调用。'
  }

  private buildReadAppDataRepeatGuidance(output: DynamicValue) {
    return {
      repeatHint: '当前 read_app_data 调用与已验证请求语义等价，不会带来新增数据。你可以基于现有结果继续判断；如仍需检索，请改用不同的 target、filters 或 mode。',
      repeatNotice: '已复用语义等价的 read_app_data 结果，本轮没有新增数据。',
      error: '连续重复的 read_app_data 调用已被阻止。当前请求不会带来新增数据；你可以基于现有结果继续判断，如仍需检索，请改用不同的 target、filters 或 mode。',
    }
  }

  private buildCurrentFormFillAnswerFallback(roundResults: AiActionResult[]) {
    const result = [...roundResults].reverse().find(item => (
      item.name === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL
      && item.ok
      && item.output?.requiresUserSubmit === true
      && ['applied', 'partial', 'not_applied'].includes(String(item.output?.status || ''))
    ))
    if (!result?.output) return ''

    const appliedFieldNames = Array.isArray(result.output.appliedFieldNames)
      ? result.output.appliedFieldNames.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const issues = [
      ...(Array.isArray(result.output.skipped) ? result.output.skipped : []),
      ...(Array.isArray(result.output.unresolved) ? result.output.unresolved : []),
    ].map((item: DynamicValue) => {
      const fieldName = String(item?.fieldName || '').trim()
      const reason = String(item?.reason || '').trim()
      return reason
        ? (fieldName
            ? global.i18next.t('aiLlmClientService.formFillIssueWithField', { fieldName, reason })
            : reason)
        : ''
    }).filter(Boolean)
    const lines = appliedFieldNames.length
      ? [global.i18next.t('aiLlmClientService.formFillAppliedFields', {
          fields: [...new Set(appliedFieldNames)].join(
            global.i18next.t('aiLlmClientService.formFillListSeparator'),
          ),
        })]
      : [String(result.output.summary || global.i18next.t('aiLlmClientService.formFillNoChanges')).trim()]
    if (issues.length) {
      lines.push(global.i18next.t('aiLlmClientService.formFillNeedsConfirmation', {
        issues: [...new Set(issues)].join(
          global.i18next.t('aiLlmClientService.formFillIssueSeparator'),
        ),
      }))
    }
    lines.push(global.i18next.t('aiLlmClientService.formFillSubmitReminder'))
    return lines.filter(Boolean).join('\n')
  }

  private buildReadAppDataAnswerFallback(
    executedToolCalls: ExecutedToolCallRecord[],
    pendingToolCalls: RawToolCall[],
    userPrompt?: string,
  ) {
    if (this.isComparisonRequest(userPrompt) || pendingToolCalls.length !== 1) {
      return ''
    }

    const [pendingToolCall] = pendingToolCalls
    if (pendingToolCall?.name !== 'read_app_data') {
      return ''
    }

    const matched = [...executedToolCalls].reverse().find(item =>
      item.name === 'read_app_data'
      && item.result.ok
      && this.isAggregateFallbackOutput(item.result.output)
      && this.isEquivalentReadAppDataFallbackRequest(item.input, pendingToolCall.input),
    )

    return matched?.result?.output
      ? this.formatAggregateResultFallback(matched.result.output)
      : ''
  }

  private buildBlockedWeakReadClarifyFallback(roundResults: AiActionResult[], actionResults: AiActionResult[]) {
    const weakStopLossBlocked = roundResults.find(result =>
      result?.metadata?.policyBlocked
      && result.metadata?.guardReason === 'weak_search_disambiguation_stop_loss',
    )
    if (weakStopLossBlocked) {
      const latestSearchOutput = this.findLatestSuccessfulSearchOutput(actionResults)
      if (
        latestSearchOutput
        && this.normalizeSearchConvergence(latestSearchOutput?.convergence) === 'weak'
        && latestSearchOutput?.requiresDisambiguation === true
      ) {
        return this.buildWeakSearchClarifyTextFromSearchOutput(latestSearchOutput)
      }
    }

    const blockedWeakRead = roundResults.find(result =>
      result?.name === 'read_app_data'
      && !result.ok
      && result.metadata?.policyBlocked
      && result.metadata?.guardReason === 'weak_search_read_requires_disambiguation',
    )
    if (!blockedWeakRead) {
      return ''
    }

    const stopLossState = this.buildWeakDisambiguationStopLossCoreState(actionResults)
    if (!stopLossState) {
      return ''
    }

    const stopLossSatisfiedBy = this.resolveWeakDisambiguationStopLossSatisfiedBy(stopLossState)
    if (!stopLossSatisfiedBy) {
      return ''
    }

    return this.buildWeakSearchClarifyTextFromSearchOutput(stopLossState.latestSearchOutput)
  }

  private buildLatestAggregateAnswerFallback(executedToolCalls: ExecutedToolCallRecord[], userPrompt?: string) {
    if (this.isComparisonRequest(userPrompt)) {
      return ''
    }

    const successfulAggregates = executedToolCalls.filter(item =>
      item.name === 'read_app_data'
      && item.result.ok
      && this.isAggregateFallbackOutput(item.result.output),
    )
    if (!successfulAggregates.length) {
      return ''
    }

    // Only reuse aggregate output when all successful aggregate reads prove to be semantically identical.
    if (successfulAggregates.length > 1 && !this.hasConsistentAggregateFallbackHistory(successfulAggregates)) {
      return ''
    }

    const latestSuccessfulAggregate = successfulAggregates[successfulAggregates.length - 1]

    return latestSuccessfulAggregate?.result?.output
      ? this.formatAggregateResultFallback(latestSuccessfulAggregate.result.output)
      : ''
  }

  private buildWeakSearchClarifyFallback(
    executedToolCalls: ExecutedToolCallRecord[],
    userPrompt?: string,
    conversationProfile?: AiConversationProfile,
  ) {
    if (this.isComparisonRequest(userPrompt)) {
      return ''
    }

    if (this.normalizeConversationProfile(conversationProfile) !== 'records_query') {
      return ''
    }

    const latestSuccessfulSearch = [...executedToolCalls].reverse().find(item =>
      item.name === 'search_apps'
      && item.result.ok
      && item.result.output
      && typeof item.result.output === 'object'
      && !Array.isArray(item.result.output)
      && item.result.output.tool === 'search_apps',
    )
    if (!latestSuccessfulSearch) {
      return ''
    }

    const output = latestSuccessfulSearch.result.output
    if (this.normalizeSearchConvergence(output?.convergence) !== 'weak') {
      return ''
    }
    if (output?.requiresDisambiguation !== true) {
      return ''
    }

    return this.buildWeakSearchClarifyTextFromSearchOutput(output)
  }

  private buildWeakSearchClarifyTextFromSearchOutput(output: DynamicValue) {
    const candidateNames = [...new Set(
      (Array.isArray(output?.apps) ? output.apps : [])
        .map((item: DynamicValue) => String(item?.appName || item?.appId || '').trim())
        .filter(Boolean),
    )]
    const visibleCandidates = candidateNames.slice(0, 3)
    const candidateText = visibleCandidates.join('、')
    if (candidateText) {
      return `我找到了多个都可能相关的应用：${candidateText}。为了避免读错数据，请直接告诉我你要查的是哪个应用；如果就是其中之一，也可以直接回复应用名，我再继续查询。`
    }

    return '我目前还不能从现有候选里唯一确定目标应用。请直接告诉我应用名，我再继续查询。'
  }

  private hasConsistentAggregateFallbackHistory(executedToolCalls: ExecutedToolCallRecord[]) {
    const signatures = executedToolCalls.map(item => this.buildReadAppDataSemanticSignature(item.input))
    if (signatures.some(signature => !signature)) {
      return false
    }

    return new Set(signatures).size === 1
  }

  private isComparisonRequest(userPrompt?: string) {
    const text = String(userPrompt || '').trim().toLowerCase()
    if (!text) {
      return false
    }

    return [
      '比较',
      '对比',
      'compare',
      'comparison',
      'cross app',
      '跨 app',
      '跨应用',
      '两个应用',
      '两个 app',
      'vs',
    ].some(item => text.includes(item))
  }

  private buildReadAppDataSemanticSignature(input: DynamicRecord) {
    const appId = this.resolveReadAppDataAppId(input)
    const mode = String(input?.mode || '').trim().toLowerCase()
    const targets = this.extractReadAppDataTargets(input)
      .map(item => `${item.type}:${item.id}`)
      .sort()

    if (!appId || !mode || !targets.length) {
      return ''
    }

    return this.stableStringify({
      appId,
      mode,
      targets,
      filters: input?.filters ?? null,
      groupBy: this.normalizeReadAppDataGroupBy(input?.groupBy),
      timeGranularity: String(input?.timeGranularity || '').trim().toLowerCase(),
      minCount: input?.minCount ?? null,
      topN: input?.topN ?? null,
      limit: input?.limit ?? null,
      sortBy: String(input?.sortBy || '').trim(),
      sortOrder: String(input?.sortOrder || '').trim().toLowerCase(),
      analysis: this.normalizeReadAppDataAnalysisForCache(input?.analysis),
    })
  }

  private buildReadAppDataWeakSemanticSignature(input: DynamicRecord) {
    const appId = this.resolveReadAppDataAppId(input)
    const mode = String(input?.mode || '').trim().toLowerCase()
    const targets = this.extractReadAppDataTargets(input)
      .map(item => `${item.type}:${item.id}`)
      .sort()

    if (!appId || !mode || !targets.length) {
      return ''
    }

    return this.stableStringify({
      appId,
      mode,
      targets,
      filters: input?.filters ?? null,
      groupBy: this.normalizeReadAppDataGroupBy(input?.groupBy),
      timeGranularity: String(input?.timeGranularity || '').trim().toLowerCase(),
      minCount: input?.minCount ?? null,
      topN: input?.topN ?? null,
      limit: input?.limit ?? null,
      sortBy: String(input?.sortBy || '').trim(),
      sortOrder: String(input?.sortOrder || '').trim().toLowerCase(),
      analysis: this.normalizeReadAppDataAnalysisForWeakSignature(input?.analysis),
    })
  }

  private isEquivalentReadAppDataFallbackRequest(
    executedInput: DynamicRecord,
    pendingInput: DynamicRecord,
  ) {
    const pendingStrongSignature = this.buildReadAppDataSemanticSignature(pendingInput)
    const executedStrongSignature = this.buildReadAppDataSemanticSignature(executedInput)
    if (pendingStrongSignature && executedStrongSignature && pendingStrongSignature === executedStrongSignature) {
      return true
    }

    const pendingWeakSignature = this.buildReadAppDataWeakSemanticSignature(pendingInput)
    if (!pendingWeakSignature) {
      return false
    }

    return this.buildReadAppDataWeakSemanticSignature(executedInput) === pendingWeakSignature
  }

  private normalizeReadAppDataGroupBy(value: DynamicValue) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase()
  }

  private isBatchRecordOutput(output: DynamicValue) {
    const kind = String(output?.result?.kind || '').trim().toLowerCase()
    return ['batch_record_total', 'batch_record_aggregate', 'batch_record_rows'].includes(kind)
  }

  private isAnalysisRecordOutput(output: DynamicValue) {
    return String(output?.result?.kind || '').trim().toLowerCase() === 'record_analysis'
  }

  private isAggregateFallbackOutput(output: DynamicValue) {
    const mode = String(output?.resolved?.mode || '').trim().toLowerCase()
    if (mode !== 'aggregate') {
      return false
    }

    if (output?.result?.partial) {
      return false
    }

    return this.isBatchRecordOutput(output) || this.isAnalysisRecordOutput(output)
  }

  private formatAggregateResultFallback(output: DynamicValue) {
    if (this.isBatchRecordOutput(output)) {
      return this.formatBatchResultFallback(output)
    }
    if (this.isAnalysisRecordOutput(output)) {
      return this.formatAnalysisResultFallback(output)
    }
    return ''
  }

  private formatBatchResultFallback(output: DynamicValue) {
    if (!this.isBatchRecordOutput(output)) {
      return ''
    }

    const result = output?.result || {}
    const perTargetResults = Array.isArray(result?.perTargetResults) ? result.perTargetResults : []
    const mergedAggregationText = String(result?.mergedAggregation?.itemsText || result?.itemsText || '').trim()
    const lines = [
      String(result?.answerText || '').trim(),
      Number.isFinite(Number(result?.mergedTotal))
        ? `合计：${Number(result.mergedTotal)}`
        : '',
    ].filter(Boolean)

    if (perTargetResults.length) {
      lines.push('分目标结果：')
      perTargetResults.slice(0, 8).forEach((item: DynamicValue) => {
        const label = String(item?.targetLabel || item?.targetName || item?.targetId || '').trim() || '未命名目标'
        const answerText = String(item?.answerText || item?.itemsText || '').trim()
        const totalText = Number.isFinite(Number(item?.total)) ? `，总数 ${Number(item.total)}` : ''
        lines.push(`- ${label}${totalText}${answerText ? `：${answerText}` : ''}`)
      })
    }

    if (mergedAggregationText) {
      lines.push(mergedAggregationText)
    }

    return lines.filter(Boolean).join('\n')
  }

  private formatAnalysisResultFallback(output: DynamicValue) {
    if (!this.isAnalysisRecordOutput(output)) {
      return ''
    }

    const result = output?.result || {}
    const answerText = String(result?.answerText || '').trim()
    const itemsText = String(result?.itemsText || '').trim()
    const lines = [
      answerText,
      itemsText,
    ].filter(Boolean)

    if (!lines.length) {
      return ''
    }

    return lines.join('\n\n')
  }

  private buildDuplicateRoundGuardMessage() {
    return '上一轮工具调用没有获得新增数据，均为已验证结果的重复请求或被阻止的等价请求。你可以基于现有结果继续判断；如果仍需检索，请改用不同的 target、filters 或 mode。'
  }

  private parseToolErrorPayload(errorText?: string) {
    const text = String(errorText || '').trim()
    if (!text) {
      return null
    }

    try {
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as DynamicRecord
        : null
    } catch {
      return null
    }
  }

  private extractToolErrorCode(errorText?: string) {
    return String(this.parseToolErrorPayload(errorText)?.code || '').trim()
  }

  private extractToolErrorDetails(errorText?: string) {
    const details = this.parseToolErrorPayload(errorText)?.details
    return details && typeof details === 'object' && !Array.isArray(details)
      ? details as DynamicRecord
      : undefined
  }

  private isReadAppDataSameAppRecoverableErrorCode(code?: string) {
    return ['READ_APP_DATA_FIELD_NOT_FOUND'].includes(String(code || '').trim())
  }

  private isAggregateProtocolConflictErrorCode(code: string) {
    return [
      'READ_APP_DATA_AGGREGATE_PROTOCOL_MIXED',
      'READ_APP_DATA_ANALYSIS_LEGACY_GROUP_CONFLICT',
      'READ_APP_DATA_ANALYSIS_LEGACY_HAVING_CONFLICT',
      'READ_APP_DATA_ANALYSIS_LEGACY_ORDER_CONFLICT',
      'READ_APP_DATA_ANALYSIS_LEGACY_TOPN_CONFLICT',
    ].includes(String(code || '').trim())
  }

  private serializeToolError(error: unknown) {
    if (error instanceof Error && (error as Error & { details?: DynamicRecord; code?: string }).details) {
      return JSON.stringify({
        code: (error as Error & { code?: string }).code || error.name || 'TOOL_ERROR',
        message: error.message || '工具执行失败',
        details: (error as Error & { details?: DynamicRecord }).details || null,
      })
    }
    if (error instanceof Error) {
      return error.message || error.name || '工具执行失败'
    }
    if (typeof error === 'string') {
      return error
    }
    if (!error || typeof error !== 'object') {
      return String(error)
    }

    const candidateMessages = [
      (error as DynamicValue).message,
      (error as DynamicValue).error,
      (error as DynamicValue).reason,
      (error as DynamicValue).details?.message,
      (error as DynamicValue).response?.data?.message,
    ]
      .map(item => String(item || '').trim())
      .filter(Boolean)

    if (candidateMessages.length) {
      return candidateMessages[0]
    }

    try {
      const text = JSON.stringify(error)
      return text && text !== '{}' ? text : '工具执行失败'
    } catch {
      return '工具执行失败'
    }
  }

  private appendSystemGuardMessage(
    messages: Array<{ role: AiMessageRole; content: string }>,
    content: string,
  ) {
    const normalized = String(content || '').trim()
    if (!normalized) {
      return
    }

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === AiMessageRole.SYSTEM && String(lastMessage.content || '').trim() === normalized) {
      return
    }

    messages.push({
      role: AiMessageRole.SYSTEM,
      content: normalized,
    })
  }

  private resolveProgressAdvanceGuardFallback(
    messages: Array<{ role: AiMessageRole; content: string }>,
    guard: ProgressAdvanceGuard,
  ) {
    if (!guard.fallbackText) {
      return ''
    }

    const hitCount = messages.filter(item =>
      item?.role === AiMessageRole.SYSTEM
      && String(item.content || '').trim() === guard.message,
    ).length

    return hitCount >= 1
      ? guard.fallbackText
      : ''
  }

  private extractFirstTargetIdByType(input: DynamicRecord, type: 'source') {
    const targets = Array.isArray(input?.targets)
      ? input.targets
      : (input?.target ? [input.target] : [])
    return targets
      .map((item: DynamicValue) => ({
        type: String(item?.type || '').trim().toLowerCase(),
        id: String(item?.id || '').trim(),
      }))
      .find(item => item.type === type && item.id)?.id
  }

  private resolveExecutedToolCallAppId(record?: ExecutedToolCallRecord | null) {
    if (!record) {
      return undefined
    }
    if (record.name === 'get_app_memory') {
      return this.normalizeOptionalText(record.result?.output?.app?.appId || record.input?.appId)
    }
    if (record.name === 'read_app_data') {
      return this.normalizeOptionalText(
        record.result?.output?.resolved?.appId || this.resolveReadAppDataAppId(record.input),
      )
    }
    return this.normalizeOptionalText(record.result?.output?.app?.appId || record.input?.appId)
  }

  private resolveExecutedToolCallAppName(record?: ExecutedToolCallRecord | null) {
    if (!record) {
      return undefined
    }
    if (record.name === 'get_app_memory') {
      return this.normalizeOptionalText(record.result?.output?.app?.appName || record.result?.output?.app?.name)
    }
    if (record.name === 'read_app_data') {
      return this.normalizeOptionalText(record.result?.output?.resolved?.appName)
    }
    return this.normalizeOptionalText(record.result?.output?.app?.appName || record.result?.output?.app?.name)
  }

  private async logDiagnosticStage(threadId: string | undefined, title: string, payload: DynamicRecord) {
    if (!threadId) {
      return
    }

    await this.agentLogService.log(
      threadId,
      title,
      this.safeDiagnosticStringify(payload),
    )
  }

  private safeDiagnosticStringify(value: DynamicValue) {
    const seen = new WeakSet<object>()
    try {
      return JSON.stringify(value, (_, currentValue) => {
        if (typeof currentValue === 'object' && currentValue !== null) {
          if (seen.has(currentValue)) {
            return '[Circular]'
          }
          seen.add(currentValue)
        }
        return currentValue
      }, 2)
    } catch {
      return String(value)
    }
  }

  private serializeDiagnosticError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    return {
      message: String(error),
    }
  }

  private createEmptyUsage(): AiTokenUsage {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }
  }

  private mergeUsage(current: AiTokenUsage, incoming?: Partial<AiTokenUsage>) {
    if (!incoming) {
      return
    }

    current.inputTokens += Math.max(0, Number(incoming.inputTokens || 0))
    current.outputTokens += Math.max(0, Number(incoming.outputTokens || 0))
    current.totalTokens += Math.max(0, Number(incoming.totalTokens || 0))
  }

  private normalizeUsage(usage: Partial<AiTokenUsage> | undefined) {
    if (!usage) {
      return undefined
    }

    return {
      inputTokens: Math.max(0, Math.round(Number(usage.inputTokens || 0))),
      outputTokens: Math.max(0, Math.round(Number(usage.outputTokens || 0))),
      totalTokens: Math.max(0, Math.round(Number(usage.totalTokens || 0))),
    }
  }

  private normalizePromptDiagnostics(value: Partial<AiPromptDiagnostics> | undefined) {
    if (!value || typeof value !== 'object') {
      return undefined
    }

    return {
      totalChars: Math.max(0, Math.round(Number(value.totalChars || 0))),
      estimatedTokens: Math.max(0, Math.round(Number(value.estimatedTokens || 0))),
      messageCount: Math.max(0, Math.round(Number(value.messageCount || 0))),
      historyMessageCount: Math.max(0, Math.round(Number(value.historyMessageCount || 0))),
      actionResultCount: Math.max(0, Math.round(Number(value.actionResultCount || 0))),
      systemPromptChars: Math.max(0, Math.round(Number(value.systemPromptChars || 0))),
      historyMessageChars: Math.max(0, Math.round(Number(value.historyMessageChars || 0))),
      historicalToolSummaryChars: Math.max(0, Math.round(Number(value.historicalToolSummaryChars || 0))),
      currentActionResultChars: Math.max(0, Math.round(Number(value.currentActionResultChars || 0))),
      historyPromptSnapshotChars: Math.max(0, Math.round(Number(value.historyPromptSnapshotChars || 0))),
    }
  }

  private finalizeTurnDiagnosticsRound(
    current: ActiveTurnDiagnosticsRound,
    payload: {
      completedAt: number
      provider?: string
      requestedModel?: string
      publicModel?: string
      effectiveModel?: string
      effectiveModelId?: string
      routePolicyId?: string
      routeVersion?: string
      fallbackHit?: boolean
      requestedReasoningLevel?: AiReasoningDecision['level']
      effectiveReasoningLevel?: AiReasoningDecision['level']
      reasoningMode?: AiReasoningMode
      reasoningReasonCodes?: string[]
      finishReason?: string
      toolCallCount: number
      usage: AiTokenUsage
      promptDiagnostics?: AiPromptDiagnostics
    },
  ): AiTurnDiagnosticsRound {
    const completedAt = Math.max(Number(payload.completedAt || Date.now()), current.startedAt)
    const firstTokenAt = current.firstTokenAt && current.firstTokenAt >= current.startedAt
      ? current.firstTokenAt
      : undefined

    return {
      round: current.round,
      startedAt: current.startedAt,
      firstTokenAt,
      completedAt,
      durationMs: Math.max(0, completedAt - current.startedAt),
      firstTokenLatencyMs: firstTokenAt ? Math.max(0, firstTokenAt - current.startedAt) : undefined,
      provider: this.normalizeOptionalText(payload.provider) || current.provider,
      requestedModel: this.normalizeOptionalText(payload.requestedModel) || current.requestedModel,
      publicModel: this.normalizeOptionalText(payload.publicModel) || current.publicModel,
      effectiveModel: this.normalizeOptionalText(payload.effectiveModel) || current.effectiveModel,
      effectiveModelId: this.normalizeOptionalText(payload.effectiveModelId) || current.effectiveModelId,
      routePolicyId: this.normalizeOptionalText(payload.routePolicyId) || current.routePolicyId,
      routeVersion: this.normalizeOptionalText(payload.routeVersion) || current.routeVersion,
      fallbackHit: typeof payload.fallbackHit === 'boolean' ? payload.fallbackHit : current.fallbackHit,
      requestedReasoningLevel: this.normalizeReasoningLevel(payload.requestedReasoningLevel) || current.requestedReasoningLevel,
      effectiveReasoningLevel: this.normalizeReasoningLevel(payload.effectiveReasoningLevel) || current.effectiveReasoningLevel,
      reasoningMode: this.normalizeReasoningMode(payload.reasoningMode) || current.reasoningMode,
      reasoningReasonCodes: this.normalizeReasoningReasonCodes(payload.reasoningReasonCodes) || current.reasoningReasonCodes,
      finishReason: this.normalizeOptionalText(payload.finishReason) || current.finishReason,
      toolCallCount: Math.max(0, Math.round(Number(payload.toolCallCount || 0))),
      usage: this.normalizeUsage(payload.usage) || this.createEmptyUsage(),
      promptDiagnostics: this.normalizePromptDiagnostics(payload.promptDiagnostics || current.promptDiagnostics),
    }
  }

  private buildToolProgressDiagnostics(actionResults: AiActionResult[] = []): AiToolProgressDiagnostics | undefined {
    if (!actionResults.length) {
      return undefined
    }

    const firstNoNewInformationResult = actionResults.find(result => this.isNoNewInformationActionResult(result))
    const lastEffectiveResult = [...actionResults]
      .reverse()
      .find(result => result?.ok && !this.isNoNewInformationActionResult(result))
    const lastEffectiveToolResult = this.summarizeToolProgressResult(lastEffectiveResult)

    return {
      actionResultCount: actionResults.length,
      firstNoNewInformationRound: firstNoNewInformationResult
        ? this.getActionResultRound(firstNoNewInformationResult)
        : undefined,
      lastEffectiveToolResult,
    }
  }

  private isNoNewInformationActionResult(result: AiActionResult | undefined) {
    const output = result?.output
    return Boolean(
      result?.metadata?.noNewInformation
      || result?.metadata?.duplicateBlocked
      || output?.noNewInformation
      || output?.repeatedCall
      || output?.decision?.noNewInformation,
    )
  }

  private summarizeToolProgressResult(result: AiActionResult | undefined): AiToolProgressDiagnostics['lastEffectiveToolResult'] {
    if (!result?.ok) {
      return undefined
    }

    const output = result.output || {}
    const resolved = output?.resolved || {}
    const target = resolved?.target || {}
    const resultPayload = output?.result || {}
    const coverage = resultPayload?.coverage || {}
    const nextOffset = Number(coverage?.nextOffset)
    return {
      round: this.getActionResultRound(result),
      tool: String(output?.tool || result.name || '').trim() || result.name,
      resultKind: String(resultPayload?.kind || '').trim() || undefined,
      appId: String(resolved?.appId || output?.app?.appId || '').trim() || undefined,
      targetId: String(target?.id || '').trim() || undefined,
      path: String(resultPayload?.path || target?.path || '').trim() || undefined,
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : undefined,
      nextOffset: Number.isFinite(nextOffset) ? nextOffset : undefined,
    }
  }

  private getActionResultRound(result: AiActionResult) {
    const round = Number(result.metadata?.round || 0)
    return Number.isFinite(round) && round > 0 ? Math.round(round) : 1
  }

  private buildTurnDiagnostics(
    startedAt: number,
    completedAt: number,
    usage: AiTokenUsage,
    rounds: AiTurnDiagnosticsRound[],
    actionResults: AiActionResult[] = [],
  ): AiTurnDiagnostics | undefined {
    if (!rounds.length) {
      return undefined
    }

    const normalizedUsage = this.normalizeUsage(usage) || this.createEmptyUsage()
    const uniqueTexts = (values: Array<string | undefined>) => (
      [...new Set(values.map(value => this.normalizeOptionalText(value)).filter(Boolean))] as string[]
    )

    return {
      startedAt,
      completedAt: Math.max(Number(completedAt || Date.now()), startedAt),
      totalDurationMs: Math.max(0, Math.max(Number(completedAt || Date.now()), startedAt) - startedAt),
      totalRounds: rounds.length,
      totalToolCalls: rounds.reduce((sum, item) => sum + Math.max(0, Number(item.toolCallCount || 0)), 0),
      usage: normalizedUsage,
      providers: uniqueTexts(rounds.map(item => item.provider)),
      requestedModels: uniqueTexts(rounds.map(item => item.requestedModel)),
      publicModels: uniqueTexts(rounds.map(item => item.publicModel)),
      effectiveModels: uniqueTexts(rounds.map(item => item.effectiveModel || item.effectiveModelId)),
      rounds,
      toolProgress: this.buildToolProgressDiagnostics(actionResults),
    }
  }

  private createToolLoopExceededError(
    startedAt: number,
    completedAt: number,
    usage: AiTokenUsage,
    rounds: AiTurnDiagnosticsRound[],
    actionResults: AiActionResult[],
  ) {
    const error = new Error('AI tool loop exceeded the maximum number of rounds') as Error & {
      diagnostics?: AiTurnDiagnostics
    }
    error.diagnostics = this.buildTurnDiagnostics(startedAt, completedAt, usage, rounds, actionResults)
    return error
  }

  private normalizeOptionalText(value?: DynamicValue) {
    const normalized = String(value || '').trim()
    return normalized || undefined
  }

  private normalizeReasoningLevel(value?: DynamicValue): AiReasoningDecision['level'] | undefined {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'low' || normalized === 'medium' || normalized === 'high'
      ? normalized as AiReasoningDecision['level']
      : undefined
  }

  private normalizeReasoningMode(value?: DynamicValue): AiReasoningMode | undefined {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'builtin-route'
      || normalized === 'parameter'
      || normalized === 'model-map'
      || normalized === 'provider-default'
      ? normalized as AiReasoningMode
      : undefined
  }

  private normalizeReasoningReasonCodes(value?: DynamicValue) {
    const items = Array.isArray(value) ? value : []
    const normalized = [...new Set(items.map(item => this.normalizeOptionalText(item)).filter(Boolean))] as string[]
    return normalized.length ? normalized : undefined
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return
    }

    const error = new Error('AI answer request aborted')
    error.name = 'AbortError'
    throw error
  }

  private shouldKeepHistoryMessage(
    item: { content: string; metadata?: DynamicRecord | null } | null | undefined,
  ) {
    if (String(item?.content || '').trim()) {
      return true
    }

    const toolCalls = Array.isArray(item?.metadata?.toolCalls)
      ? item?.metadata?.toolCalls
      : []
    return toolCalls.length > 0
  }
}
