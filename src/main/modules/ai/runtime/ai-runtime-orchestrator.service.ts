import { Injectable } from '@nestjs/common'
import type { AiCrossAppPresentationMetadata } from '@common/types/ai'
import {
  parseAiAssistantMessageContent,
  resolveAiAssistantMessageText,
  sanitizeAiAssistantVisibleContent,
} from '@common/utils/aiMessageBlocks'
import {
  isMarkdownFenceClosingLine,
  parseMarkdownFenceOpeningLine,
} from '@common/utils/markdownFence'
import {
  inspectWorkbenchAppBuilderHandoffIntentLikeFence,
  WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO,
} from '@common/utils/workbenchAppBuilderHandoffIntent'
import { normalizeAiExcelAnalysisContext } from '@common/utils/aiExcelAnalysis'
import { resolveReadAppDataDisplayName, resolveReadAppDataDisplaySummaryFallback } from '@common/utils/aiToolDisplay'
import { isLikelyToolProtocolText, normalizeInterimText } from '@common/utils/aiToolProtocol'
import {
  normalizeWorkbenchAiFormFillContext,
  normalizeWorkbenchAiFormFillToolInput,
  WORKBENCH_AI_FILL_CURRENT_FORM_TOOL,
} from '@common/utils/workbenchAiFormFill'
import { unique } from '@common/utils/unique'
import {
  AiChatStreamPayload,
  AiMessageRole,
  AiRuntimeExecutionStrategy,
  AiReadAppDataAnalysisResult,
  AiSearchConvergence,
  AiStreamEventType,
  AiThreadRuntimeContextKind,
  AiThreadRuntimeState,
  AiThreadVerifiedTarget,
  AiToolExecutionContext,
} from '../ai.types'
import { AiConfigService } from '../config/ai-config.service'
import { AiThreadEntity } from '../entities'
import { AiAttachmentService } from '../thread/ai-attachment.service'
import { AI_READ_ATTACHMENT_TOOL_NAME } from '../thread/ai-attachment-tool'
import { AiAnswerComposerService } from '../llm/ai-answer-composer.service'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiAnalysisChartBuilderService } from './ai-analysis-chart-builder.service'
import { AiAnalysisChartContextService } from './ai-analysis-chart-context.service'
import { AiCrossAppAnalysisBundleService } from './ai-cross-app-analysis-bundle.service'
import { AiAnalysisEvidenceBlockBuilderService } from './ai-analysis-evidence-block-builder.service'
import { AiAnalysisChartPolicyService } from './ai-analysis-chart-policy.service'
import { buildAiAnalysisSupportingData } from './ai-analysis-supporting-data.util'
import { AiAnalysisTableBlockBuilderService } from './ai-analysis-table-block-builder.service'
import { buildAnalysisConclusionItems } from './ai-analysis-conclusion.util'
import { resolveMultiFormAnalysisPlanPresentation } from './ai-multi-form-analysis-plan.util'
import { AiScenarioPolicyService } from './ai-scenario-policy.service'
import { AiRuntimeStateReducerService } from './ai-runtime-state-reducer.service'
import { projectGetAppMemoryForPrompt } from '../utils/ai-get-app-memory-projection.util'
import { AiThreadService } from '../thread/ai-thread.service'
import {
  AppBuilderHandoffService,
  buildWorkbenchHandoffAssistantContent,
  buildWorkbenchHandoffPreviewMetadata,
} from '../workbench-ai/app-builder-handoff.service'

type AiToolDisplayStatus = 'running' | 'success' | 'error' | 'skipped'
type AiHistorySnapshotBuildMode = 'full' | 'compact' | 'minimal'
type AiHistorySnapshotBuildContext = {
  mode: AiHistorySnapshotBuildMode
  truncated: boolean
}

const buildPrimaryViews = (options: {
  defaultKey: 'chart' | 'table'
  chartEnabled: boolean
  tableEnabled: boolean
  chartDisabledReason?: string
}) => ({
  defaultKey: options.defaultKey,
  items: [
    {
      key: 'chart' as const,
      enabled: options.chartEnabled,
      ...(options.chartDisabledReason ? { disabledReason: options.chartDisabledReason } : {}),
    },
    {
      key: 'table' as const,
      enabled: options.tableEnabled,
    },
  ],
})

export const attachWorkbenchAppBuilderHandoffMetadataSafely = async (options: {
  appBuilderHandoffService?: {
    maybeBuildFromAssistantTurn: (payload: any) => Promise<any>
  }
  threadService: {
    updateMessageMetadata: (messageId: string, metadata: Record<string, any>) => Promise<any>
    updateMessageContentAndMetadata?: (
      messageId: string,
      content: string,
      metadata: Record<string, any>,
    ) => Promise<any>
  }
  assistantMetadata: Record<string, any>
  assistantMessageId: string
  handoffInput: any
}) => {
  if (!options.appBuilderHandoffService) {
    return null
  }

  try {
    const handoffResult = await options.appBuilderHandoffService.maybeBuildFromAssistantTurn({
      ...options.handoffInput,
      assistantMessageId: options.assistantMessageId,
    })

    if (handoffResult?.issue) {
      delete options.assistantMetadata.appBuilderHandoff
      options.assistantMetadata.appBuilderHandoffIssue = handoffResult.issue
      await options.threadService.updateMessageMetadata(
        options.assistantMessageId,
        options.assistantMetadata,
      )
      return null
    }

    if (handoffResult?.handoff) {
      const assistantContent = buildWorkbenchHandoffAssistantContent(handoffResult)
      const assistantBlocks: any[] = []
      const nextMetadata = {
        ...options.assistantMetadata,
        blocks: assistantBlocks,
        appBuilderHandoffIssue: undefined,
        appBuilderHandoff: buildWorkbenchHandoffPreviewMetadata(
          handoffResult.handoff,
          handoffResult.clarification || null,
        ),
      }
      if (!options.threadService.updateMessageContentAndMetadata) {
        throw new Error('message content update unavailable')
      }
      await options.threadService.updateMessageContentAndMetadata(
        options.assistantMessageId,
        assistantContent,
        nextMetadata,
      )
      Object.assign(options.assistantMetadata, nextMetadata)
      return {
        handoff: handoffResult.handoff,
        clarification: handoffResult.clarification || null,
        assistantContent,
        assistantBlocks,
      }
    }

    return null
  } catch (error) {
    options.assistantMetadata.appBuilderHandoffError = {
      message: error instanceof Error ? error.message : String(error),
    }
    try {
      await options.threadService.updateMessageMetadata(options.assistantMessageId, options.assistantMetadata)
    } catch {
      // Handoff metadata is auxiliary; never let it dominate the main assistant answer.
    }
    return null
  }
}

@Injectable()
export class AiRuntimeOrchestratorService {
  private static readonly TOOL_DISPLAY_SUMMARY_LIMIT = 160
  private static readonly TOOL_OUTPUT_PREVIEW_LIMIT = 1200
  private static readonly TOOL_HISTORY_PROMPT_SNAPSHOT_LIMITS: Record<string, number> = {
    search_apps: 600,
    get_app_memory: 900,
    read_app_data: 1400,
  }
  private static readonly LEGACY_CHART_FENCE_PATTERN = /```(?:banban-chart|echarts)\s*[\s\S]*?```/gi
  private static readonly ANALYSIS_EVIDENCE_TRAILING_SECTION_PATTERN =
    /(?:\n{2,}|^)(?:#{1,6}\s*)?(?:\*\*)?\u6570\u636e\u6765\u6e90(?:\*\*)?[：:]?\s*(?:\n|$)[\s\S]*?(?:\n|^)(?:#{1,6}\s*)?(?:\*\*)?\u7edf\u8ba1\u8bf4\u660e(?:\*\*)?[：:]?\s*(?:\n|$)[\s\S]*$/u

  constructor(
    private readonly threadService: AiThreadService,
    private readonly answerComposer: AiAnswerComposerService,
    private readonly aiConfigService: AiConfigService,
    private readonly agentLogService: AiAgentLogService,
    private readonly scenarioPolicyService: AiScenarioPolicyService,
    private readonly runtimeStateReducerService: AiRuntimeStateReducerService,
    private readonly analysisChartPolicyService: AiAnalysisChartPolicyService,
    private readonly analysisChartBuilderService: AiAnalysisChartBuilderService,
    private readonly analysisChartContextService: AiAnalysisChartContextService,
    private readonly analysisEvidenceBlockBuilderService: AiAnalysisEvidenceBlockBuilderService = new AiAnalysisEvidenceBlockBuilderService(),
    private readonly crossAppAnalysisBundleService: AiCrossAppAnalysisBundleService = new AiCrossAppAnalysisBundleService(),
    private readonly analysisTableBlockBuilderService: AiAnalysisTableBlockBuilderService = new AiAnalysisTableBlockBuilderService(),
    private readonly appBuilderHandoffService?: AppBuilderHandoffService,
    private readonly attachmentService?: AiAttachmentService,
  ) {}

  async streamTurn(options: {
    thread: AiThreadEntity
    message: string
    traceId?: string
    requestMetadata?: Record<string, any>
    currentPageFormFillContext?: unknown
    currentPageFormFillUnavailable?: boolean
    explicitAppIds?: string[]
    toolContext: AiToolExecutionContext
    providerId?: string
    modelId?: string
    model?: string
    isShareMode: boolean
    signal?: AbortSignal
    emit?: (payload: AiChatStreamPayload) => void
  }) {
    const normalizedMessage = String(options.message || '').trim()
    const agentId = String(options.thread.agentId || '').trim()
    const traceId = this.normalizeTraceId(options.traceId) || this.createTurnTraceId()
    this.throwIfAborted(options.signal)
    if (!normalizedMessage) {
      throw new Error('message is required')
    }

    const scenarioPolicy = await this.scenarioPolicyService.resolvePolicy({
      userMessage: normalizedMessage,
      runtimeState: options.thread.runtimeState,
    })
    const runtimeStateWithScopeTransition = this.scenarioPolicyService.applyScopeTransition(
      options.thread.runtimeState,
      {
        userMessage: normalizedMessage,
        profile: scenarioPolicy.profile,
      },
    )
    const runtimeStateWithProfile = this.scenarioPolicyService.attachProfile(
      runtimeStateWithScopeTransition || options.thread.runtimeState,
      scenarioPolicy.profile,
    )

    const nextModelSelection = this.normalizeModelSelection({
      providerId: options.providerId,
      modelId: options.modelId,
      model: options.model,
    })
    const publicModelSelection = await this.aiConfigService.toPublicSelection(
      this.hasModelSelectionPatch(nextModelSelection)
        ? nextModelSelection
        : this.normalizeModelSelection(options.thread),
    )
    if (this.hasModelSelectionPatch(publicModelSelection) && this.isModelSelectionChanged(options.thread, publicModelSelection)) {
      await this.threadService.updateThreadById(options.thread.id, publicModelSelection)
      options.thread.providerId = publicModelSelection.providerId
      options.thread.modelId = publicModelSelection.modelId
      options.thread.model = publicModelSelection.model
    }

    const editMetadata = await this.threadService.supersedeOwnerMessageTurn({
      ownerAccountId: options.thread.ownerAccountId,
      threadId: options.thread.id,
      messageId: String(options.requestMetadata?.editedFromMessageId || '').trim(),
      supersededByTraceId: traceId,
    })
    const historyMessages = await this.threadService.listAllMessagesByThreadId(options.thread.id)
    const allowResolvedCrossAppChartFollowup = this.shouldAllowResolvedCrossAppChartFollowup({
      userMessage: normalizedMessage,
      previousRuntimeState: options.thread.runtimeState,
      nextProfile: scenarioPolicy.profile,
      historyMessages,
    })
    const runtimeStateForTurn = this.promoteResolvedCrossAppChartFollowupRuntimeState(
      runtimeStateWithProfile,
      allowResolvedCrossAppChartFollowup,
    )
    const normalizedAppIds = this.normalizeIds(options.explicitAppIds)
    const toolContext: AiToolExecutionContext = {
      ...options.toolContext,
      conversationProfile: scenarioPolicy.profile,
      threadId: options.thread.id,
      traceId,
      signal: options.signal,
      query: normalizedMessage,
      currentPageFormFillContext: normalizeWorkbenchAiFormFillContext(options.currentPageFormFillContext),
      appScope: normalizedAppIds.length
        ? { appIds: normalizedAppIds }
        : options.toolContext.appScope,
    }

    const userMessage = await this.threadService.appendMessage(options.thread, {
      role: AiMessageRole.USER,
      traceId,
      content: normalizedMessage,
      metadata: {
        ...(options.requestMetadata || {}),
        ...(editMetadata || {}),
        appScope: normalizedAppIds,
        shareMode: options.isShareMode,
        conversationProfile: scenarioPolicy.profile,
        modelSelection: this.normalizeModelSelection(options.thread),
      },
    })

    await this.attachmentService?.bind(
      options.thread.ownerAccountId,
      options.thread.id,
      options.requestMetadata?.attachments,
      userMessage.id,
    )

    this.throwIfAborted(options.signal)

    this.emit(options.emit, {
      threadId: options.thread.id,
      conversationId: options.thread.id,
      event: AiStreamEventType.START,
      metadata: {
        connected: true,
        transport: 'sse',
        threadId: options.thread.id,
        agentId,
        userMessageId: userMessage.id,
        traceId,
        providerId: options.thread.providerId || undefined,
        modelId: options.thread.modelId || undefined,
        model: options.thread.model || undefined,
        modelSelectionSource: options.thread.modelSelectionSource || undefined,
        conversationProfile: scenarioPolicy.profile,
        modelSelection: this.normalizeModelSelection(options.thread),
      },
    })

    const featureFlags = scenarioPolicy.featureFlags

    const toolCalls: Array<{
      id: string
      name: string
      displayName?: string
      displayStatus?: AiToolDisplayStatus
      displaySummary?: string
      displayHidden?: boolean
      groupId?: string
      traceId?: string
      input?: Record<string, any>
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
    }> = []
    const toolCallGroups: Array<{
      id: string
      callIds: string[]
      timeline: Array<{
        id: string
        type: 'tool-call' | 'interim-text'
        refId: string
      }>
      closed: boolean
    }> = []
    const interimTexts: Array<{
      id: string
      text: string
      round?: number
    }> = []
    const abortDiagnosticsState: {
      lastStage?: string
      lastRound?: number
      lastToolName?: string
      lastToolCallId?: string
    } = {}
    const pendingDelta = {
      text: '',
      round: 0,
      interim: false,
    }
    const handoffIntentDeltaFilter = this.createAppBuilderHandoffIntentDeltaFilter()
    let trailingVisibleDeltaFlushed = false
    const successfulToolOutputs: any[] = []
    let contextCompactionForAssistant: {
      status: 'completed'
      estimatedTokens?: number
      sourceMessageCount?: number
      updatedAt: number
    } | null = null
    const flushTrailingVisibleDeltaIfNeeded = () => {
      if (trailingVisibleDeltaFlushed) {
        return ''
      }
      trailingVisibleDeltaFlushed = true
      const trailingVisibleDeltaText = handoffIntentDeltaFilter.flush()
      if (!trailingVisibleDeltaText) {
        return ''
      }
      pendingDelta.text += trailingVisibleDeltaText
      this.emit(options.emit, {
        threadId: options.thread.id,
        conversationId: options.thread.id,
        event: AiStreamEventType.DELTA,
        text: trailingVisibleDeltaText,
        metadata: {
          traceId,
        },
      })
      return trailingVisibleDeltaText
    }

    const answer = await (async () => {
      try {
        return await this.answerComposer.compose({
          threadId: options.thread.id,
          traceId,
          providerId: options.thread.providerId || undefined,
          modelId: options.thread.modelId || undefined,
          userMessage: normalizedMessage,
          userMetadata: options.requestMetadata || undefined,
          currentFormFillContext: toolContext.currentPageFormFillContext,
          currentFormFillUnavailable: options.currentPageFormFillUnavailable === true,
          disableBuiltinAppTools: options.requestMetadata?.disableBuiltinAppTools === true,
          historyMessages: historyMessages
            .reverse()
            .map(item => ({
              role: item.role,
              content: item.role === AiMessageRole.ASSISTANT
                ? resolveAiAssistantMessageText(item.content, item.metadata?.blocks)
                : item.content,
              metadata: item.metadata || null,
            })),
          isShareMode: options.isShareMode,
          runtimeState: runtimeStateForTurn,
          contextState: options.thread.contextState,
          toolContext,
          model: options.thread.model || options.model,
          signal: options.signal,
          onRoundStart: async payload => {
            abortDiagnosticsState.lastStage = 'round_start'
            abortDiagnosticsState.lastRound = payload.round
          },
          onContextCompaction: async payload => {
            const compaction = payload.metadata || {}
            this.emit(options.emit, {
              threadId: options.thread.id,
              conversationId: options.thread.id,
              event: payload.status === 'start'
                ? AiStreamEventType.CONTEXT_COMPACTION_START
                : AiStreamEventType.CONTEXT_COMPACTION_COMPLETED,
              metadata: payload.status === 'completed'
                ? {
                    round: payload.round,
                    traceId,
                    estimatedTokens: Number(payload.metadata?.estimatedTokens || 0) || undefined,
                    sourceMessageCount: Number(payload.metadata?.sourceMessageCount || 0) || undefined,
                  }
                : {
                    round: payload.round,
                    traceId,
                  },
            })
            if (payload.status === 'completed') {
              const sourceFingerprint = String(compaction.sourceFingerprint || '').trim()
              const reused = Boolean(
                sourceFingerprint
                && sourceFingerprint === String(options.thread.contextState?.sourceFingerprint || '').trim(),
              )
              if (!reused) {
                contextCompactionForAssistant = {
                  status: 'completed',
                  estimatedTokens: Number(compaction.estimatedTokens || 0) || undefined,
                  sourceMessageCount: Number(compaction.sourceMessageCount || 0) || undefined,
                  updatedAt: Date.now(),
                }
                await this.threadService.updateThreadById(options.thread.id, {
                  contextState: {
                    version: 1,
                    sourceFingerprint: sourceFingerprint || undefined,
                    summary: String(compaction.summary || '').trim() || undefined,
                    sourceMessageCount: Number(compaction.sourceMessageCount || 0) || undefined,
                    estimatedTokens: Number(compaction.estimatedTokens || 0) || undefined,
                    updatedAt: Date.now(),
                  },
                })
              }
            }
          },
          onDelta: async (payload) => {
            abortDiagnosticsState.lastStage = payload.interim ? 'interim_delta' : 'delta'
            abortDiagnosticsState.lastRound = payload.round
            const visibleText = payload.text
              ? handoffIntentDeltaFilter.push(payload.text)
              : ''
            if (visibleText) {
              pendingDelta.text += visibleText
              pendingDelta.round = payload.round
              pendingDelta.interim = payload.interim
            }
            if (visibleText || !payload.text) {
              this.emit(options.emit, {
                threadId: options.thread.id,
                conversationId: options.thread.id,
                event: AiStreamEventType.DELTA,
                text: visibleText,
                metadata: {
                  round: payload.round,
                  interim: payload.interim,
                  clearInterim: payload.clearInterim === true,
                  traceId,
                },
              })
            }
          },
          onToolCall: async (payload) => {
            abortDiagnosticsState.lastStage = 'tool_call'
            abortDiagnosticsState.lastRound = payload.round
            abortDiagnosticsState.lastToolName = payload.name
            abortDiagnosticsState.lastToolCallId = payload.id
            const traceExtras = this.buildToolTraceExtras({
              strategy: payload.strategy,
              batchSize: payload.batchSize,
              queued: payload.queued,
              executionGroup: payload.executionGroup,
              targetIds: payload.targetIds,
            }, featureFlags.batchToolTraceEnabled)
            const displayExtras = this.buildToolDisplayExtras({
              name: payload.name,
              input: payload.input,
              strategy: payload.strategy,
              queued: payload.queued,
            })
            const currentFormFillInput = payload.name === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL
              && toolContext.currentPageFormFillContext
              ? normalizeWorkbenchAiFormFillToolInput(
                payload.input,
                toolContext.currentPageFormFillContext,
              )
              : null
            const toolGroup = this.ensureOpenToolCallGroup(toolCallGroups)
            this.capturePendingInterimText(interimTexts, pendingDelta, toolGroup, payload.round)
            this.appendToolCallGroupTimelineItem(toolGroup, {
              type: 'tool-call',
              refId: payload.id,
            })
            toolGroup.callIds.push(payload.id)
            toolCalls.push({
              id: payload.id,
              name: payload.name,
              groupId: toolGroup.id,
              traceId,
              input: payload.input,
              round: payload.round,
              ...displayExtras,
              ...traceExtras,
            })
            this.emit(options.emit, {
              threadId: options.thread.id,
              conversationId: options.thread.id,
              event: AiStreamEventType.TOOL_CALL,
              metadata: {
                toolCallId: payload.id,
                toolGroupId: toolGroup.id,
                toolName: payload.name,
                input: currentFormFillInput || payload.input,
                round: payload.round,
                traceId,
                target: currentFormFillInput ? 'client' : 'main',
                formContextId: currentFormFillInput
                  ? toolContext.currentPageFormFillContext?.contextId
                  : undefined,
                ...displayExtras,
                ...traceExtras,
              },
            })
          },
          onToolResult: async (payload) => {
            abortDiagnosticsState.lastStage = 'tool_result'
            abortDiagnosticsState.lastRound = payload.round
            abortDiagnosticsState.lastToolName = payload.name
            abortDiagnosticsState.lastToolCallId = payload.callId
            await this.logDiagnosticStage(options.thread.id, 'AI DIAG runtime_on_tool_result_enter', {
              threadId: options.thread.id,
              traceId,
              toolCallId: payload.callId,
              round: payload.round,
              toolName: payload.name,
              ok: payload.ok,
              durationMs: payload.durationMs,
              resultStatus: String(payload.output?.status || '').trim() || undefined,
              resultKind: String(payload.output?.result?.kind || '').trim() || undefined,
            })
            try {
              const traceExtras = this.buildToolTraceExtras({
                strategy: payload.strategy,
                batchSize: payload.batchSize,
                partial: payload.partial,
                reused: payload.reused,
                policyBlocked: payload.policyBlocked,
                queued: payload.queued,
                executionGroup: payload.executionGroup,
                targetIds: payload.targetIds,
                succeededTargetIds: payload.succeededTargetIds,
                failedTargetIds: payload.failedTargetIds,
              }, featureFlags.batchToolTraceEnabled)
              const stateExtras = this.buildToolStateExtras(payload)
              const repeatExtras = this.buildToolRepeatExtras(payload)
              const displayExtras = this.buildToolDisplayExtras({
                name: payload.name,
                input: payload.input,
                output: payload.output,
                ok: payload.ok,
                policyBlocked: payload.policyBlocked,
                reused: payload.reused,
                queued: payload.queued,
                strategy: payload.strategy,
                searchRepeatBlocked: payload.searchRepeatBlocked,
                searchStopReason: payload.searchStopReason,
                searchConvergence: payload.searchConvergence,
                dominantTopCandidate: payload.dominantTopCandidate,
                noNewCandidates: payload.noNewCandidates,
                topCandidateStable: payload.topCandidateStable,
                topCandidateAppId: payload.topCandidateAppId,
                repeatedCall: payload.repeatedCall,
                noNewInformation: payload.noNewInformation,
                repeatNotice: payload.repeatNotice,
              })
              const matchedCall = toolCalls.find(item => item.id === payload.callId)
              const outputPreview = payload.ok
                ? this.buildToolOutputPreview(payload.output, payload.name)
                : null
              const historyPromptSnapshot = payload.ok
                ? this.buildToolHistoryPromptSnapshot(payload.name, payload.output, payload.input)
                : null
              if (matchedCall) {
                matchedCall.ok = payload.ok
                matchedCall.input = payload.input ?? matchedCall.input
                matchedCall.outputPreview = outputPreview?.text
                matchedCall.outputTruncated = outputPreview?.truncated
                matchedCall.historyPromptSnapshot = historyPromptSnapshot?.text
                matchedCall.historyPromptSnapshotTruncated = historyPromptSnapshot?.truncated
                matchedCall.error = payload.error
                matchedCall.durationMs = payload.durationMs
                matchedCall.round = payload.round
                Object.assign(matchedCall, traceExtras)
                Object.assign(matchedCall, stateExtras)
                Object.assign(matchedCall, repeatExtras)
                Object.assign(matchedCall, displayExtras)
              }
              if (payload.ok) {
                successfulToolOutputs.push(payload.output)
              }
              this.emit(options.emit, {
                threadId: options.thread.id,
                conversationId: options.thread.id,
                event: AiStreamEventType.TOOL_RESULT,
                metadata: {
                  toolCallId: payload.callId,
                  toolGroupId: matchedCall?.groupId,
                  toolName: payload.name,
                  ok: payload.ok,
                  input: payload.input,
                  outputPreview: outputPreview?.text,
                  outputTruncated: outputPreview?.truncated,
                  error: payload.ok ? undefined : payload.error,
                  durationMs: payload.durationMs,
                  round: payload.round,
                  traceId,
                  ...displayExtras,
                  ...traceExtras,
                  ...stateExtras,
                  ...repeatExtras,
                },
              })
              await this.logDiagnosticStage(options.thread.id, 'AI DIAG runtime_on_tool_result_exit', {
                threadId: options.thread.id,
                traceId,
                toolCallId: payload.callId,
                round: payload.round,
                toolName: payload.name,
                ok: payload.ok,
                outputPreviewLength: outputPreview?.text?.length || 0,
                historyPromptSnapshotLength: historyPromptSnapshot?.text?.length || 0,
                historyPromptSnapshotTruncated: historyPromptSnapshot?.truncated || false,
                successfulToolOutputCount: successfulToolOutputs.length,
              })
            } catch (error) {
              await this.logDiagnosticStage(options.thread.id, 'AI DIAG runtime_on_tool_result_error', {
                threadId: options.thread.id,
                traceId,
                toolCallId: payload.callId,
                round: payload.round,
                toolName: payload.name,
                error: this.serializeDiagnosticError(error),
              })
              throw error
            }
          },
        })
      } catch (error) {
        if (this.isAbortError(error, options.signal)) {
          await this.logDiagnosticStage(options.thread.id, 'AI DIAG runtime_stream_aborted', {
            stage: 'runtime_stream_aborted',
            threadId: options.thread.id,
            traceId,
            abortReason: this.normalizeAbortReason(options.signal?.reason),
            lastStage: abortDiagnosticsState.lastStage,
            lastRound: abortDiagnosticsState.lastRound,
            lastToolName: abortDiagnosticsState.lastToolName,
            lastToolCallId: abortDiagnosticsState.lastToolCallId,
          })
        }
        flushTrailingVisibleDeltaIfNeeded()
        throw error
      }
    })()
    flushTrailingVisibleDeltaIfNeeded()
    this.throwIfAborted(options.signal)

    this.closeOpenToolCallGroup(toolCallGroups)
    const nextRuntimeState = this.scenarioPolicyService.attachProfile(
      this.crossAppAnalysisBundleService.resolveRuntimeStateWithLatestBundle(
        this.deriveRuntimeState(
          runtimeStateForTurn,
          successfulToolOutputs,
          featureFlags.batchRuntimeStateEnabled,
        ),
      ),
      scenarioPolicy.profile,
    )
    const nextRuntimeStateWithPendingResolution = this.scenarioPolicyService.syncPendingCrossAppResolution(
      nextRuntimeState,
      {
        profile: scenarioPolicy.profile,
        assistantContent: answer.text,
      },
    ) || null
    const assistantPresentation = this.buildAssistantAnswerPresentation({
      answerText: answer.text,
      userMessage: normalizedMessage,
      successfulToolOutputs,
      runtimeState: nextRuntimeStateWithPendingResolution,
      deterministicAnalysisChartEnabled: featureFlags.deterministicAnalysisChartEnabled === true,
      allowResolvedCrossAppChartFollowup,
    })
    const assistantContent = sanitizeAiAssistantVisibleContent(assistantPresentation.assistantContent)
    const assistantBlocks = assistantPresentation.assistantBlocks
    const devDiagnostics = this.shouldExposeDevDiagnostics()
      ? answer.diagnostics || undefined
      : undefined

    await this.threadService.updateThreadById(options.thread.id, {
      appScope: normalizedAppIds.length ? { appIds: normalizedAppIds } : options.thread.appScope,
      providerId: options.thread.providerId || null,
      modelId: options.thread.modelId || null,
      model: options.thread.model || null,
      runtimeState: nextRuntimeStateWithPendingResolution,
    })
    this.throwIfAborted(options.signal)

    const assistantMetadata: Record<string, any> = {
      usage: answer.usage || null,
      finishReason: answer.finishReason,
      conversationProfile: scenarioPolicy.profile,
      toolCalls: toolCalls.map(item => ({
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        displayStatus: item.displayStatus,
        displaySummary: item.displaySummary,
        displayHidden: item.displayHidden,
        groupId: item.groupId,
        traceId: item.traceId || traceId,
        input: item.input,
        ok: item.ok,
        outputPreview: item.outputPreview,
        outputTruncated: item.outputTruncated,
        historyPromptSnapshot: item.historyPromptSnapshot,
        historyPromptSnapshotTruncated: item.historyPromptSnapshotTruncated,
        error: item.error,
        durationMs: item.durationMs,
        round: item.round,
        repeatedCall: item.repeatedCall,
        noNewInformation: item.noNewInformation,
        repeatNotice: item.repeatNotice,
        repeatHint: item.repeatHint,
        duplicateBlocked: item.duplicateBlocked,
        repeatedCount: item.repeatedCount,
        consecutiveRepeatedCount: item.consecutiveRepeatedCount,
        ...this.buildToolTraceExtras(item, featureFlags.batchToolTraceEnabled),
        ...this.buildToolStateExtras(item),
        ...this.buildToolRepeatExtras(item),
      })),
      toolCallGroups: toolCallGroups.map(item => ({
        id: item.id,
        callIds: item.callIds,
        timeline: item.timeline.map(timelineItem => ({
          id: timelineItem.id,
          type: timelineItem.type,
          refId: timelineItem.refId,
        })),
        closed: item.closed,
      })),
      interimTexts: interimTexts.map(item => ({
        id: item.id,
        text: item.text,
        round: item.round,
      })),
      blocks: assistantBlocks,
      devDiagnostics,
    }
    if (contextCompactionForAssistant) {
      assistantMetadata.contextCompaction = contextCompactionForAssistant
    }

    const assistantMessage = await this.threadService.appendMessage(options.thread, {
      role: AiMessageRole.ASSISTANT,
      traceId,
      content: assistantContent,
      metadata: assistantMetadata,
    })

    const isExcelAnalysisMode = Boolean(
      options.requestMetadata?.disableBuiltinAppTools === true
      && normalizeAiExcelAnalysisContext(options.requestMetadata?.excelAnalysisContext),
    )
    const handoffAttachment = isExcelAnalysisMode
      ? null
      : await attachWorkbenchAppBuilderHandoffMetadataSafely({
        appBuilderHandoffService: this.appBuilderHandoffService,
        threadService: this.threadService,
        assistantMetadata,
        assistantMessageId: assistantMessage.id,
        handoffInput: {
          thread: options.thread,
          userMessage: normalizedMessage,
          assistantText: answer.text,
          assistantOutcome: {
            finishReason: answer.finishReason,
            fallback: answer.finishReason === 'fallback' || Boolean(answer.diagnostics?.fallback),
          },
          assistantBlocks,
          historyMessages,
        },
      })
    const finalAssistantContent = sanitizeAiAssistantVisibleContent(handoffAttachment?.assistantContent || assistantContent)
    const finalAssistantBlocks = handoffAttachment?.assistantBlocks || assistantBlocks

    this.emit(options.emit, {
      threadId: options.thread.id,
      conversationId: options.thread.id,
      event: AiStreamEventType.DONE,
      usage: answer.usage,
      finishReason: answer.finishReason,
      metadata: {
        threadId: options.thread.id,
        agentId,
        traceId,
        providerId: options.thread.providerId || undefined,
        modelId: options.thread.modelId || undefined,
        model: options.thread.model || undefined,
        conversationProfile: scenarioPolicy.profile,
        modelSelection: this.normalizeModelSelection(options.thread),
        finalContent: finalAssistantContent,
        blocks: finalAssistantBlocks,
        appBuilderHandoff: assistantMetadata.appBuilderHandoff || null,
        appBuilderHandoffIssue: assistantMetadata.appBuilderHandoffIssue || null,
        devDiagnostics,
      },
    })

    return {
      threadId: options.thread.id,
      text: finalAssistantContent,
    }
  }

  buildAssistantAnswerPresentation(options: {
    answerText: string
    userMessage: string
    successfulToolOutputs: any[]
    runtimeState?: AiThreadRuntimeState | null
    deterministicAnalysisChartEnabled: boolean
    allowResolvedCrossAppChartFollowup?: boolean
  }) {
    const planPresentation = resolveMultiFormAnalysisPlanPresentation({
      answerText: options.answerText,
      successfulToolOutputs: options.successfulToolOutputs,
    })
    const parsedAnswer = parseAiAssistantMessageContent(planPresentation.assistantContent)
    const baseAssistantContent = parsedAnswer.hasStructuredBlocks || parsedAnswer.chartHint
      ? parsedAnswer.content
      : planPresentation.assistantContent
    const crossAppPresentation = this.buildCrossAppPresentationMetadata(options.runtimeState)
    const parsedBlocks = this.applyCrossAppPresentationToBlocks(
      Array.isArray(parsedAnswer.blocks) ? parsedAnswer.blocks : [],
      crossAppPresentation,
    )
    const evidenceContext = this.analysisChartContextService.resolveLatestVerifiedAnalysisContext({
      userMessage: options.userMessage,
      successfulToolOutputs: options.successfulToolOutputs,
      runtimeState: options.runtimeState,
      allowMaterializedRuntimeBundle: true,
    })
    const evidenceBlock = evidenceContext?.snapshots?.length
      ? this.analysisEvidenceBlockBuilderService.buildMarkdownBlock(evidenceContext.snapshots, {
        compact: !options.successfulToolOutputs.length,
      })
      : null
    const shouldStripAssistantChartBlocks = this.shouldStripAssistantChartBlocks(options.runtimeState)

    if (!options.deterministicAnalysisChartEnabled) {
      if (!evidenceBlock && !planPresentation.planBlock) {
        return {
          assistantContent: baseAssistantContent,
          assistantBlocks: parsedAnswer.hasStructuredBlocks
            ? (
              shouldStripAssistantChartBlocks
                ? this.stripDeterministicLegacyChartBlocks(parsedBlocks)
                : parsedBlocks
            )
            : [],
        }
      }

      const assistantContent = this.stripAssistantBodyEvidence(
        this.stripLegacyChartFences(baseAssistantContent),
        Boolean(evidenceBlock),
      )
      const legacyCompatibleBlocks = shouldStripAssistantChartBlocks
        ? this.stripDeterministicLegacyChartBlocks(parsedBlocks, Boolean(evidenceBlock))
        : this.stripLegacyChartFenceBlocks(parsedBlocks, Boolean(evidenceBlock))
      const baseBlocks = parsedAnswer.hasStructuredBlocks
        ? legacyCompatibleBlocks
        : this.materializeAssistantBodyMarkdownBlocks(
          assistantContent,
          Boolean(planPresentation.planBlock) || Boolean(evidenceBlock),
        )

      if (!evidenceBlock) {
        return {
          assistantContent,
          assistantBlocks: this.composeAssistantPresentationBlocks(
            baseBlocks,
            planPresentation.planBlock,
          ),
        }
      }

      return {
        assistantContent,
        assistantBlocks: this.composeAssistantPresentationBlocks(
          baseBlocks,
          planPresentation.planBlock,
          undefined,
          undefined,
          evidenceBlock,
        ),
      }
    }

    let latestVerifiedAnalysis = this.analysisChartContextService.resolveLatestVerifiedAnalysis({
      userMessage: options.userMessage,
      successfulToolOutputs: options.successfulToolOutputs,
      runtimeState: options.runtimeState,
      allowMaterializedRuntimeBundle: true,
    })
    if (
      !latestVerifiedAnalysis?.analysisResult
      && options.allowResolvedCrossAppChartFollowup
    ) {
      latestVerifiedAnalysis = this.analysisChartContextService
        .resolveLatestVerifiedAnalysisForResolvedCrossAppChoiceFollowup({
          userMessage: options.userMessage,
          successfulToolOutputs: options.successfulToolOutputs,
          runtimeState: options.runtimeState,
          allowMaterializedRuntimeBundle: true,
        })
    }

    if (!latestVerifiedAnalysis?.analysisResult) {
      const assistantContent = this.stripAssistantBodyEvidence(
        this.stripLegacyChartFences(baseAssistantContent),
        Boolean(evidenceBlock),
      )
      const preserveAssistantChartBlocksWithoutVerifiedAnalysis = (
        !shouldStripAssistantChartBlocks
        && !evidenceContext?.snapshots?.length
      )
      const deterministicBlocks = preserveAssistantChartBlocksWithoutVerifiedAnalysis
        ? this.stripLegacyChartFenceBlocks(parsedBlocks, Boolean(evidenceBlock))
        : this.stripDeterministicLegacyChartBlocks(parsedBlocks, Boolean(evidenceBlock))
      const baseBlocks = parsedAnswer.hasStructuredBlocks
        ? deterministicBlocks
        : this.materializeAssistantBodyMarkdownBlocks(
          assistantContent,
          Boolean(planPresentation.planBlock) || Boolean(evidenceBlock),
        )

      if (!evidenceBlock) {
        return {
          assistantContent,
          assistantBlocks: this.composeAssistantPresentationBlocks(
            baseBlocks,
            planPresentation.planBlock,
          ),
        }
      }

      return {
        assistantContent,
        assistantBlocks: this.composeAssistantPresentationBlocks(
          baseBlocks,
          planPresentation.planBlock,
          undefined,
          undefined,
          evidenceBlock,
        ),
      }
    }

    const structuredViews = this.analysisTableBlockBuilderService.buildStructuredViewsFromAnalysisResult({
      title: this.resolveVerifiedAnalysisDisplayTitle(latestVerifiedAnalysis),
      analysisResult: latestVerifiedAnalysis.analysisResult as AiReadAppDataAnalysisResult,
      presentation: crossAppPresentation,
    })
    const assistantContent = this.stripAssistantBodyEvidence(
      this.stripLegacyChartFences(baseAssistantContent),
      Boolean(evidenceBlock),
    )
    const deterministicBlocks = this.stripDeterministicLegacyChartBlocks(parsedBlocks, Boolean(evidenceBlock))
    const baseBlocks = parsedAnswer.hasStructuredBlocks
      ? deterministicBlocks
      : this.materializeAssistantBodyMarkdownBlocks(
        assistantContent,
        Boolean(planPresentation.planBlock) || Boolean(evidenceBlock),
      )
    const markdownOnlyBaseBlocks = this.stripChartBlocks(baseBlocks)
    if (!structuredViews) {
      return {
        assistantContent,
        assistantBlocks: this.composeAssistantPresentationBlocks(
          markdownOnlyBaseBlocks,
          planPresentation.planBlock,
          undefined,
          [],
          evidenceBlock,
        ),
      }
    }

    const analysisResult = latestVerifiedAnalysis.analysisResult as AiReadAppDataAnalysisResult
    const conclusionItems = buildAnalysisConclusionItems(assistantContent)
    const supportingData = buildAiAnalysisSupportingData({
      analysisResult,
      snapshot: latestVerifiedAnalysis.snapshot || null,
      snapshots: latestVerifiedAnalysis.snapshots || [],
    })
    const analysisConclusion = (conclusionItems.length || supportingData)
      ? {
        items: conclusionItems,
        ...(supportingData ? { supportingData } : {}),
      }
      : undefined
    const analysisConclusionSupportingOnly = supportingData
      ? {
        items: [],
        supportingData,
      }
      : undefined
    const hintedKind = String(parsedAnswer.chartHint?.type || '').trim()
    const decision = this.analysisChartPolicyService.decide({
      userMessage: options.userMessage,
      analysisResult,
      hintedKind: hintedKind as any,
    })
    const shouldCollapseMarkdownTableBodyForBlockedChart = this.containsMarkdownTable(assistantContent)
    const groupedTableBlock = {
      ...structuredViews.primaryTable,
      ...(analysisConclusion ? { analysisConclusion } : {}),
      ...(structuredViews.tableViews ? { views: structuredViews.tableViews } : {}),
      primaryViews: buildPrimaryViews({
        defaultKey: 'table',
        chartEnabled: false,
        tableEnabled: true,
        chartDisabledReason: decision.reason || 'table_only_result',
      }),
    }
    const groupedTableBlockWithoutConclusion = {
      ...structuredViews.primaryTable,
      ...(analysisConclusionSupportingOnly ? { analysisConclusion: analysisConclusionSupportingOnly } : {}),
      ...(structuredViews.tableViews ? { views: structuredViews.tableViews } : {}),
      primaryViews: buildPrimaryViews({
        defaultKey: 'table',
        chartEnabled: false,
        tableEnabled: true,
        chartDisabledReason: decision.reason || 'table_only_result',
      }),
    }
    const blocksWithoutCharts = this.composeAssistantPresentationBlocks(
      shouldCollapseMarkdownTableBodyForBlockedChart ? [] : markdownOnlyBaseBlocks,
      planPresentation.planBlock,
      [shouldCollapseMarkdownTableBodyForBlockedChart ? groupedTableBlock : groupedTableBlockWithoutConclusion],
      [],
      evidenceBlock,
    )

    if (!decision.allowed) {
      return {
        assistantContent,
        assistantBlocks: blocksWithoutCharts,
      }
    }

    const resolvedKind = decision.resolvedKind

    if (!resolvedKind) {
      return {
        assistantContent,
        assistantBlocks: blocksWithoutCharts,
      }
    }

    try {
      const chartBlock = this.analysisChartBuilderService.build(
        resolvedKind,
        analysisResult,
        parsedAnswer.chartHint?.title,
        crossAppPresentation,
      )
      return {
        assistantContent,
        assistantBlocks: this.composeAssistantPresentationBlocks(
          markdownOnlyBaseBlocks,
          planPresentation.planBlock,
          [],
          [{
            ...chartBlock,
            ...(analysisConclusion ? { analysisConclusion } : {}),
            dataTable: structuredViews.chartDataTable,
            primaryViews: buildPrimaryViews({
              defaultKey: 'chart',
              chartEnabled: true,
              tableEnabled: true,
            }),
          }],
          evidenceBlock,
        ),
      }
    } catch {
      return {
        assistantContent,
        assistantBlocks: blocksWithoutCharts,
      }
    }
  }

  private materializeAssistantBodyMarkdownBlocks(content: string, shouldMaterialize: boolean) {
    if (!shouldMaterialize) {
      return []
    }

    const normalized = String(content || '').trim()
    if (!normalized) {
      return []
    }

    return [{
      type: 'markdown',
      text: normalized,
    }]
  }

  private composeAssistantPresentationBlocks(
    baseBlocks: any[],
    planBlock?: any,
    tableBlocks?: any[],
    chartBlocks?: any[],
    evidenceBlock?: any,
  ) {
    const normalizedBaseBlocks = Array.isArray(baseBlocks) ? baseBlocks : []
    const existingTableBlocks = normalizedBaseBlocks.filter((item: any) => item?.type === 'table')
    const existingChartBlocks = normalizedBaseBlocks.filter((item: any) => item?.type === 'chart')
    const nextBlocks = [
      ...normalizedBaseBlocks.filter((item: any) => item?.type === 'markdown'),
      ...(planBlock ? [planBlock] : []),
      ...existingTableBlocks,
      ...(Array.isArray(tableBlocks) ? tableBlocks : []),
      ...existingChartBlocks,
      ...(Array.isArray(chartBlocks) ? chartBlocks : []),
    ]
    return this.appendAnalysisEvidenceBlock(nextBlocks, evidenceBlock)
  }

  private applyCrossAppPresentationToBlocks(
    blocks: any[],
    presentation?: AiCrossAppPresentationMetadata,
  ) {
    if (!presentation) {
      return Array.isArray(blocks) ? blocks : []
    }

    return (Array.isArray(blocks) ? blocks : []).map((block: any) => (
      block?.type === 'chart' || block?.type === 'table'
        ? {
          ...block,
          presentation: block.presentation || presentation,
        }
        : block
    ))
  }

  private buildCrossAppPresentationMetadata(
    runtimeState?: AiThreadRuntimeState | null,
  ): AiCrossAppPresentationMetadata | undefined {
    const alignmentState = runtimeState?.latestCrossAppAlignmentState
    if (!alignmentState?.status) {
      return undefined
    }

    return {
      status: alignmentState.status,
      limitationReasons: Array.isArray(alignmentState.limitationReasons)
        ? alignmentState.limitationReasons
        : undefined,
      scopeLabels: {
        apps: Array.isArray(alignmentState.scope?.appIds) ? alignmentState.scope.appIds : [],
        sources: Array.isArray(alignmentState.scope?.sourceIds) ? alignmentState.scope.sourceIds : [],
      },
      alignmentSummary: {
        metrics: Array.isArray(alignmentState.alignmentBasis?.metricKeys)
          ? alignmentState.alignmentBasis.metricKeys
          : [],
        groups: Array.isArray(alignmentState.alignmentBasis?.groupKeys)
          ? alignmentState.alignmentBasis.groupKeys
          : [],
        grain: alignmentState.alignmentBasis?.timeGranularity ?? null,
      },
      transition: runtimeState?.latestCrossAppScopeTransition,
    }
  }

  private stripChartBlocks(blocks: any[]) {
    return (Array.isArray(blocks) ? blocks : [])
      .filter((item: any) => item?.type !== 'chart')
  }

  private resolveVerifiedAnalysisDisplayTitle(latestVerifiedAnalysis: any) {
    const snapshot = latestVerifiedAnalysis?.snapshot || {}
    return String(
      snapshot.targetName
      || snapshot.appName
      || '',
    ).trim() || undefined
  }

  private appendAnalysisEvidenceBlock(blocks: any[], evidenceBlock: any) {
    const nextBlocks = Array.isArray(blocks) ? [...blocks] : []
    if (evidenceBlock) {
      nextBlocks.push(evidenceBlock)
    }
    return nextBlocks
  }

  private stripLegacyChartFences(content: string) {
    return String(content || '')
      .replace(AiRuntimeOrchestratorService.LEGACY_CHART_FENCE_PATTERN, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private stripAssistantBodyEvidence(content: string, shouldStrip: boolean) {
    const normalized = String(content || '').trim()
    if (!normalized || !shouldStrip) {
      return normalized
    }

    return normalized
      .replace(AiRuntimeOrchestratorService.ANALYSIS_EVIDENCE_TRAILING_SECTION_PATTERN, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private stripLegacyChartFenceBlocks(blocks: any[], stripEvidence = false) {
    return (Array.isArray(blocks) ? blocks : [])
      .map((block: any) => {
        if (block?.type !== 'markdown') {
          return block
        }

        const nextText = this.stripAssistantBodyEvidence(
          this.stripLegacyChartFences(String(block?.text || '')),
          stripEvidence,
        )
        if (!nextText) {
          return null
        }

        return {
          ...block,
          text: nextText,
        }
      })
      .filter((block: any) => block)
  }

  private stripDeterministicLegacyChartBlocks(blocks: any[], stripEvidence = false) {
    return this.stripChartBlocks(
      this.stripLegacyChartFenceBlocks(blocks, stripEvidence),
    )
  }

  private containsMarkdownTable(content: string) {
    const normalized = String(content || '').replace(/\r\n/g, '\n')
    return /\|[^\n]+\|\n\|\s*:?-{3,}.*\|\n\|[^\n]+\|/m.test(normalized)
  }

  private shouldStripAssistantChartBlocks(
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    return this.normalizeConversationProfile(runtimeState?.currentProfile) === 'cross_app_unresolved'
  }

  private shouldAllowResolvedCrossAppChartFollowup(options: {
    userMessage: string
    previousRuntimeState?: AiThreadRuntimeState | null
    nextProfile?: string | null
    historyMessages?: Array<{
      role?: string
      content?: string
      sequence?: number
    }>
  }) {
    if (!this.scenarioPolicyService.consumesPendingCrossAppResolution(
      options.userMessage,
      options.previousRuntimeState,
      options.nextProfile as any,
    )) {
      return false
    }

    const latestHistoricalUserMessage = this.resolveLatestHistoricalUserMessage(options.historyMessages)
    if (!latestHistoricalUserMessage) {
      return false
    }

    return this.analysisChartContextService.isDisplayOnlyChartCommandMessage(
      latestHistoricalUserMessage,
      {
        allowFallback: true,
      },
    )
  }

  private promoteResolvedCrossAppChartFollowupRuntimeState(
    runtimeState?: AiThreadRuntimeState | null,
    allowResolvedCrossAppChartFollowup?: boolean,
  ): AiThreadRuntimeState | undefined {
    if (!runtimeState || allowResolvedCrossAppChartFollowup !== true) {
      return runtimeState || undefined
    }

    const currentProfile = this.normalizeConversationProfile(runtimeState.currentProfile)
    if (currentProfile !== 'cross_app_compare' && currentProfile !== 'cross_app_merge') {
      return runtimeState
    }

    if (runtimeState.currentIntent === 'aggregation') {
      return runtimeState
    }

    return {
      ...runtimeState,
      currentIntent: 'aggregation' as const,
    }
  }

  private resolveLatestHistoricalUserMessage(historyMessages?: Array<{
    role?: string
    content?: string
    sequence?: number
  }>) {
    return (Array.isArray(historyMessages) ? historyMessages : [])
      .slice()
      .sort((left, right) => Number(right?.sequence || 0) - Number(left?.sequence || 0))
      .find(item => item?.role === AiMessageRole.USER || String(item?.role || '').trim().toLowerCase() === 'user')
      ?.content
      ?.trim()
  }

  private createTurnTraceId() {
    return `ai-turn-${unique(16)}`
  }

  private createAppBuilderHandoffIntentDeltaFilter() {
    const fenceMarkerPrefixes = ['```', '~~~']
    const pendingFenceLinePrefixes = [
      '```',
      '~~~',
      ' ```',
      ' ~~~',
      '  ```',
      '  ~~~',
      '   ```',
      '   ~~~',
    ]
    let buffer = ''
    let insideHandoffIntentBlock = false
    let activeHandoffMarker = ''
    let insideJsonCandidateBlock = false
    let activeJsonCandidateMarker = ''
    let jsonCandidateBuffer = ''

    const resolvePrefixTailLength = (value: string, prefixes: string[]) => {
      let bestLength = 0
      for (const prefix of prefixes) {
        const maxLength = Math.min(value.length, prefix.length - 1)
        for (let length = maxLength; length > 0; length -= 1) {
          if (!prefix.startsWith(value.slice(value.length - length))) {
            continue
          }
          if (length > bestLength) {
            bestLength = length
          }
          break
        }
      }
      return bestLength
    }

    const findNextFenceMarkerIndex = (value: string) => {
      let nextIndex = -1
      for (const marker of fenceMarkerPrefixes) {
        const markerIndex = value.indexOf(marker)
        if (markerIndex !== -1 && (nextIndex === -1 || markerIndex < nextIndex)) {
          nextIndex = markerIndex
        }
      }
      return nextIndex
    }

    const findLineBreakIndex = (value: string) => value.search(/\r?\n/)

    const lineBreakLengthAt = (value: string, index: number) => (
      value[index] === '\r' && value[index + 1] === '\n' ? 2 : 1
    )

    const isPotentialOpeningFenceMarker = (markerIndex: number) => {
      const lineStartIndex = buffer.lastIndexOf('\n', markerIndex - 1) + 1
      const linePrefix = buffer.slice(lineStartIndex, markerIndex)
      return /^ {0,3}$/.test(linePrefix)
        ? lineStartIndex
        : -1
    }

    const isHandoffOpeningLine = (line: string) => (
      parseMarkdownFenceOpeningLine(line)?.info === WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO
    )

    const isJsonCandidateOpeningLine = (line: string) => {
      const opening = parseMarkdownFenceOpeningLine(line)
      return opening?.marker === '```' && opening.info === 'json'
    }

    const finalizeJsonCandidateBlock = () => {
      const candidate = jsonCandidateBuffer
      insideJsonCandidateBlock = false
      activeJsonCandidateMarker = ''
      jsonCandidateBuffer = ''
      if (!candidate) {
        return ''
      }
      const inspection = inspectWorkbenchAppBuilderHandoffIntentLikeFence(candidate)
      return inspection.kind === 'parsed' && inspection.sourceKind === 'tolerant-json'
        ? ''
        : candidate
    }

    const process = (flush = false) => {
      let output = ''

      while (buffer) {
        if (insideHandoffIntentBlock) {
          const lineBreakIndex = findLineBreakIndex(buffer)
          if (lineBreakIndex === -1) {
            if (flush) {
              if (isMarkdownFenceClosingLine(buffer, activeHandoffMarker)) {
                insideHandoffIntentBlock = false
                activeHandoffMarker = ''
              }
              buffer = ''
            }
            break
          }

          const nextIndex = lineBreakIndex + lineBreakLengthAt(buffer, lineBreakIndex)
          const line = buffer.slice(0, nextIndex)
          buffer = buffer.slice(nextIndex)
          if (isMarkdownFenceClosingLine(line, activeHandoffMarker)) {
            insideHandoffIntentBlock = false
            activeHandoffMarker = ''
          }
          continue
        }

        if (insideJsonCandidateBlock) {
          const lineBreakIndex = findLineBreakIndex(buffer)
          if (lineBreakIndex === -1) {
            if (flush) {
              jsonCandidateBuffer += buffer
              buffer = ''
              output += finalizeJsonCandidateBlock()
            }
            break
          }

          const nextIndex = lineBreakIndex + lineBreakLengthAt(buffer, lineBreakIndex)
          const line = buffer.slice(0, nextIndex)
          buffer = buffer.slice(nextIndex)
          jsonCandidateBuffer += line
          if (isMarkdownFenceClosingLine(line, activeJsonCandidateMarker)) {
            output += finalizeJsonCandidateBlock()
          }
          continue
        }

        const markerIndex = findNextFenceMarkerIndex(buffer)
        if (markerIndex === -1) {
          const keepLength = flush ? 0 : resolvePrefixTailLength(buffer, pendingFenceLinePrefixes)
          const emitLength = buffer.length - keepLength
          if (emitLength > 0) {
            output += buffer.slice(0, emitLength)
          }
          buffer = keepLength ? buffer.slice(emitLength) : ''
          break
        }

        const lineStartIndex = isPotentialOpeningFenceMarker(markerIndex)
        if (lineStartIndex === -1) {
          output += buffer.slice(0, markerIndex + fenceMarkerPrefixes[0].length)
          buffer = buffer.slice(markerIndex + fenceMarkerPrefixes[0].length)
          continue
        }

        const lineBreakIndex = findLineBreakIndex(buffer.slice(lineStartIndex))
        if (lineBreakIndex === -1) {
          if (flush) {
            const line = buffer.slice(lineStartIndex)
            const opening = parseMarkdownFenceOpeningLine(line)
            output += buffer.slice(0, lineStartIndex)
            if (opening && opening.info === WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO) {
              insideHandoffIntentBlock = true
              activeHandoffMarker = opening.marker
            } else if (isJsonCandidateOpeningLine(line)) {
              output += line
            } else {
              output += line
            }
            buffer = ''
            break
          }
          output += buffer.slice(0, lineStartIndex)
          buffer = buffer.slice(lineStartIndex)
          break
        }

        const lineEndIndex = lineStartIndex + lineBreakIndex + lineBreakLengthAt(buffer, lineStartIndex + lineBreakIndex)
        const line = buffer.slice(lineStartIndex, lineEndIndex)
        const opening = parseMarkdownFenceOpeningLine(line)
        output += buffer.slice(0, lineStartIndex)
        buffer = buffer.slice(lineEndIndex)
        if (!opening) {
          output += line
          continue
        }
        if (isHandoffOpeningLine(line)) {
          insideHandoffIntentBlock = true
          activeHandoffMarker = opening.marker
          continue
        }
        if (isJsonCandidateOpeningLine(line)) {
          insideJsonCandidateBlock = true
          activeJsonCandidateMarker = opening.marker
          jsonCandidateBuffer = line
          continue
        }
        output += line
      }

      return output
    }

    return {
      push: (text: string) => {
        buffer += String(text || '')
        return process(false)
      },
      flush: () => process(true),
    }
  }

  private shouldExposeDevDiagnostics() {
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase()
    if (nodeEnv && nodeEnv !== 'production') {
      return true
    }

    return Boolean(
      process.env.VITE_DEV_SERVER_URL
      || process.env.npm_lifecycle_event === 'dev'
      || process.argv.some(arg => /vite/i.test(String(arg || ''))),
    )
  }

  private normalizeTraceId(value?: string) {
    const normalized = String(value || '').trim()
    return normalized || ''
  }

  private normalizeConversationProfile(value?: string | null) {
    const normalized = String(value || '').trim()
    return [
      'records_query',
      'cross_app_compare',
      'cross_app_merge',
      'cross_app_unresolved',
    ].includes(normalized)
      ? normalized as AiThreadRuntimeState['currentProfile']
      : undefined
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return
    }

    const error = new Error('AI thread request aborted')
    error.name = 'AbortError'
    throw error
  }

  private isAbortError(error: unknown, signal?: AbortSignal) {
    if (signal?.aborted) {
      return true
    }

    const candidate = error as { name?: string; message?: string; code?: string }
    const name = String(candidate?.name || '').trim()
    const message = String(candidate?.message || '').trim()
    return name === 'AbortError'
      || candidate?.code === 'ABORT_ERR'
      || /aborted/i.test(message)
      || /aborterror/i.test(message)
  }

  private normalizeAbortReason(reason: unknown) {
    if (typeof reason === 'string') {
      return String(reason || '').trim() || undefined
    }
    if (reason instanceof Error) {
      return String(reason.message || reason.name || '').trim() || undefined
    }
    return String(reason || '').trim() || undefined
  }

  private emit(emit: ((payload: AiChatStreamPayload) => void) | undefined, payload: AiChatStreamPayload) {
    emit?.(payload)
  }

  private async logDiagnosticStage(threadId: string, title: string, payload: Record<string, any>) {
    await this.agentLogService.log(
      threadId,
      title,
      this.safeDiagnosticStringify(payload),
    )
  }

  private safeDiagnosticStringify(value: any) {
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

  private normalizeIds(value?: string[]) {
    return Array.isArray(value)
      ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))]
      : []
  }

  private buildToolDisplayExtras(payload: {
    name?: string
    input?: Record<string, any>
    output?: any
    ok?: boolean
    policyBlocked?: boolean
    reused?: boolean
    queued?: boolean
    strategy?: AiRuntimeExecutionStrategy
    searchRepeatBlocked?: boolean
    searchStopReason?: string
    searchConvergence?: AiSearchConvergence
    dominantTopCandidate?: boolean
    noNewCandidates?: boolean
    topCandidateStable?: boolean
    topCandidateAppId?: string
    repeatedCall?: boolean
    noNewInformation?: boolean
    repeatNotice?: string
  }) {
    const toolName = String(payload.name || '').trim()
    const displayStatus = this.resolveToolDisplayStatus(payload)
    const displaySummary = this.buildToolDisplaySummary(toolName, displayStatus, payload)
    return {
      displayName: this.resolveToolDisplayName(toolName, payload.input),
      displayStatus,
      displaySummary,
      displayHidden: this.shouldHideToolDisplay(payload),
    }
  }

  private buildToolDisplaySummary(
    toolName: string,
    displayStatus: AiToolDisplayStatus,
    payload: {
      input?: Record<string, any>
      output?: any
      searchRepeatBlocked?: boolean
      searchStopReason?: string
      searchConvergence?: AiSearchConvergence
      dominantTopCandidate?: boolean
      noNewCandidates?: boolean
      topCandidateStable?: boolean
      topCandidateAppId?: string
      repeatedCall?: boolean
      noNewInformation?: boolean
      repeatNotice?: string
    },
  ) {
    const summary = this.resolveToolDisplaySummary(toolName, displayStatus, payload)
    return this.truncatePlainText(summary, AiRuntimeOrchestratorService.TOOL_DISPLAY_SUMMARY_LIMIT) || undefined
  }

  private resolveToolDisplayName(toolName: string, input?: Record<string, any>) {
    if (toolName === 'search_apps') return global.i18next.t('aiRuntimeOrchestratorService.searchApps')
    if (toolName === 'get_app_memory') return global.i18next.t('aiRuntimeOrchestratorService.analyzeAppStructure')
    if (toolName === 'read_app_data') return resolveReadAppDataDisplayName(input)
    if (toolName === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL) return global.i18next.t('aiRuntimeOrchestratorService.fillCurrentForm')
    return toolName || global.i18next.t('aiRuntimeOrchestratorService.unknownTool')
  }

  private resolveToolDisplayStatus(payload: {
    ok?: boolean
    policyBlocked?: boolean
    strategy?: AiRuntimeExecutionStrategy
  }): AiToolDisplayStatus {
    if (payload.policyBlocked || payload.strategy === 'blocked_by_policy') {
      return 'skipped'
    }
    if (payload.ok === false) {
      return 'error'
    }
    if (payload.ok === true) {
      return 'success'
    }
    return 'running'
  }

  private shouldHideToolDisplay(payload: {
    policyBlocked?: boolean
    reused?: boolean
    strategy?: AiRuntimeExecutionStrategy
    searchRepeatBlocked?: boolean
    searchStopReason?: string
  }) {
    const keepVisibleReasons = new Set([
      'search_missing_explicit_app_name_keyword',
      'weak_search_disambiguation_stop_loss',
      'read_app_data_failure_search_reentry_forbidden',
      'search_repeat_hard_cap',
      'search_repeat_no_new_keywords',
    ])
    const keepVisible = payload.searchRepeatBlocked === true
      || keepVisibleReasons.has(String(payload.searchStopReason || '').trim())
    return Boolean(
      (payload.policyBlocked && !keepVisible)
      || payload.reused
      || (payload.strategy === 'blocked_by_policy' && !keepVisible),
    )
  }

  private resolveToolDisplaySummary(
    toolName: string,
    displayStatus: AiToolDisplayStatus,
    payload: {
      input?: Record<string, any>
      output?: any
      searchRepeatBlocked?: boolean
      searchStopReason?: string
      searchConvergence?: AiSearchConvergence
      dominantTopCandidate?: boolean
      noNewCandidates?: boolean
      topCandidateStable?: boolean
      topCandidateAppId?: string
    },
  ) {
    if (displayStatus === 'skipped') {
      if (payload.searchStopReason === 'search_missing_explicit_app_name_keyword') {
        return global.i18next.t('aiRuntimeOrchestratorService.explicitAppNameRequired')
      }
      if (payload.searchStopReason === 'weak_search_disambiguation_stop_loss') {
        return global.i18next.t('aiRuntimeOrchestratorService.confirmWeakCandidates')
      }
      if (payload.searchStopReason === 'read_app_data_failure_search_reentry_forbidden') {
        return global.i18next.t('aiRuntimeOrchestratorService.stayInCurrentApp')
      }
      if (payload.searchStopReason === 'search_repeat_hard_cap') {
        return global.i18next.t('aiRuntimeOrchestratorService.repeatedSearchStopped')
      }
      if (payload.searchStopReason === 'search_repeat_no_new_keywords') {
        return global.i18next.t('aiRuntimeOrchestratorService.noNewSearchKeywords')
      }
      if (toolName === 'search_apps' && payload.searchRepeatBlocked) {
        if (payload.searchStopReason === 'read_app_data_failure_search_reentry_forbidden') {
          return global.i18next.t('aiRuntimeOrchestratorService.stayInCurrentApp')
        }
        if (payload.searchStopReason === 'search_repeat_hard_cap') {
          return global.i18next.t('aiRuntimeOrchestratorService.repeatedSearchStopped')
        }
        return global.i18next.t('aiRuntimeOrchestratorService.noNewSearchKeywords')
      }
      return global.i18next.t('aiRuntimeOrchestratorService.stepSkipped')
    }
    if (displayStatus === 'error') {
      if (toolName === 'search_apps') return global.i18next.t('aiRuntimeOrchestratorService.searchAppsFailed')
      if (toolName === 'get_app_memory') return global.i18next.t('aiRuntimeOrchestratorService.analyzeAppStructureFailed')
      if (toolName === 'read_app_data') return resolveReadAppDataDisplaySummaryFallback('error', payload.input)
      if (toolName === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL) return global.i18next.t('aiRuntimeOrchestratorService.fillCurrentFormFailed')
      return global.i18next.t('aiRuntimeOrchestratorService.toolFailed')
    }
    if (displayStatus === 'running') {
      return this.resolvePendingToolSummary(toolName, payload.input)
    }
    return this.resolveCompletedToolSummary(toolName, payload.output, payload)
  }

  private resolvePendingToolSummary(toolName: string, input?: Record<string, any>) {
    if (toolName === 'search_apps') {
      return global.i18next.t('aiRuntimeOrchestratorService.searchingApps')
    }
    if (toolName === 'get_app_memory') {
      return global.i18next.t('aiRuntimeOrchestratorService.analyzingAppStructure')
    }
    if (toolName === 'read_app_data') {
      return resolveReadAppDataDisplaySummaryFallback('running', input)
    }
    if (toolName === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL) {
      return global.i18next.t('aiRuntimeOrchestratorService.fillingCurrentForm')
    }
    return global.i18next.t('aiRuntimeOrchestratorService.processingTool')
  }

  private resolveCompletedToolSummary(
    toolName: string,
    output: any,
    payload?: {
      searchConvergence?: AiSearchConvergence
      dominantTopCandidate?: boolean
      noNewCandidates?: boolean
      topCandidateStable?: boolean
      topCandidateAppId?: string
    },
  ) {
    if (toolName === 'search_apps') {
      return this.resolveSearchToolSummary(output, payload)
    }
    if (toolName === 'get_app_memory') {
      return this.resolveMemoryToolSummary(output)
    }
    if (toolName === 'read_app_data') {
      return this.resolveReadAppDataToolSummary(output)
    }
    if (toolName === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL) {
      return String(output?.summary || '').trim()
        || global.i18next.t('aiRuntimeOrchestratorService.fillCurrentFormCompleted')
    }
    return global.i18next.t('aiRuntimeOrchestratorService.toolCompleted')
  }

  private resolveSearchToolSummary(
    output: any,
    payload?: {
      searchConvergence?: AiSearchConvergence
      dominantTopCandidate?: boolean
      noNewCandidates?: boolean
      topCandidateStable?: boolean
      topCandidateAppId?: string
      requiresDisambiguation?: boolean
      repeatedCall?: boolean
      noNewInformation?: boolean
      repeatNotice?: string
    },
  ) {
    const topCandidateName = String(
      output?.apps?.[0]?.appName
      || output?.apps?.[0]?.appId
      || payload?.topCandidateAppId
      || '',
    ).trim()
    const requiresDisambiguation = typeof output?.requiresDisambiguation === 'boolean'
      ? output.requiresDisambiguation
      : payload?.requiresDisambiguation === true
    const repeatedCall = typeof output?.repeatedCall === 'boolean'
      ? output.repeatedCall
      : payload?.repeatedCall === true
    const noNewInformation = typeof output?.noNewInformation === 'boolean'
      ? output.noNewInformation
      : payload?.noNewInformation === true
    const repeatNotice = this.normalizeToolDisplayText(output?.repeatNotice || payload?.repeatNotice)
    const hasRepeatedNoNewInformation = repeatedCall || noNewInformation
    if (hasRepeatedNoNewInformation && payload?.noNewCandidates && topCandidateName) {
      return global.i18next.t('aiRuntimeOrchestratorService.reusedCandidateNeedsReview', { appName: topCandidateName })
    }
    if (hasRepeatedNoNewInformation && repeatNotice) {
      return global.i18next.t('aiRuntimeOrchestratorService.repeatNoticeNeedsReview', { notice: repeatNotice })
    }
    if (payload?.searchConvergence === 'weak' && requiresDisambiguation) {
      if (topCandidateName) {
        return global.i18next.t('aiRuntimeOrchestratorService.candidateNeedsReview', { appName: topCandidateName })
      }
      return global.i18next.t('aiRuntimeOrchestratorService.candidatesNeedReview')
    }
    if (payload?.searchConvergence === 'clear' && payload?.dominantTopCandidate && topCandidateName) {
      return global.i18next.t('aiRuntimeOrchestratorService.highConfidenceCandidate', { appName: topCandidateName })
    }
    if (payload?.searchConvergence === 'clear' && topCandidateName) {
      return global.i18next.t('aiRuntimeOrchestratorService.candidateLocated', { appName: topCandidateName })
    }
    if (payload?.noNewCandidates && payload?.topCandidateStable && topCandidateName) {
      return global.i18next.t('aiRuntimeOrchestratorService.candidateStable', { appName: topCandidateName })
    }
    const accessibleCount = Number(output?.totalAccessible)
    if (Number.isFinite(accessibleCount) && accessibleCount >= 0) {
      return global.i18next.t('aiRuntimeOrchestratorService.searchCompletedWithCount', { count: accessibleCount })
    }
    return this.normalizeToolDisplayText(output?.summary) || global.i18next.t('aiRuntimeOrchestratorService.searchCompleted')
  }

  private resolveMemoryToolSummary(output: any) {
    const appName = String(output?.app?.appName || output?.app?.name || '').trim()
    const sourceCount = Number(output?.app?.counts?.sourceCount)
    if (appName && Number.isFinite(sourceCount)) {
      return global.i18next.t('aiRuntimeOrchestratorService.appStructureAnalyzedWithSources', {
        appName,
        count: sourceCount,
      })
    }
    if (appName) {
      return global.i18next.t('aiRuntimeOrchestratorService.appStructureAnalyzed', { appName })
    }
    return global.i18next.t('aiRuntimeOrchestratorService.appStructureAnalysisCompleted')
  }

  private resolveReadAppDataToolSummary(output: any) {
    const mode = String(output?.resolved?.mode || '').trim().toLowerCase()
    if (mode === 'aggregate') {
      const analysisResult = output?.result?.analysisResult
      if (analysisResult && typeof analysisResult === 'object') {
        const rowCount = this.resolveNumericDisplayValue(
          analysisResult?.meta?.rowCount,
          output?.result?.resultCount,
        )
        const metricCount = Array.isArray(analysisResult?.metricDefs) ? analysisResult.metricDefs.length : 0
        if (rowCount !== null && metricCount > 0) {
          return global.i18next.t('aiRuntimeOrchestratorService.statisticsWithRowsAndMetrics', {
            metrics: metricCount,
            rows: rowCount,
          })
        }
        if (metricCount > 0) {
          return global.i18next.t('aiRuntimeOrchestratorService.statisticsWithMetrics', { count: metricCount })
        }
      }
      const answerText = this.normalizeToolDisplayText(output?.result?.answerText)
      if (answerText) {
        return answerText
      }
      const total = this.resolveNumericDisplayValue(
        output?.result?.mergedTotal,
        output?.result?.total,
        output?.result?.matchedCount,
      )
      if (total !== null) {
        return global.i18next.t('aiRuntimeOrchestratorService.statisticsWithCount', { count: total })
      }
      return global.i18next.t('aiRuntimeOrchestratorService.statisticsCompleted')
    }

    const rows = this.resolveNumericDisplayValue(
      output?.result?.mergedReturnedRows,
      output?.result?.returnedRows,
      output?.result?.mergedResultCount,
      output?.result?.resultCount,
      output?.result?.matchedCount,
    )
    if (rows !== null) {
      return global.i18next.t('aiRuntimeOrchestratorService.recordsRead', { count: rows })
    }
    return global.i18next.t('aiRuntimeOrchestratorService.appDataReadCompleted')
  }

  private resolveNumericDisplayValue(...values: any[]) {
    for (const value of values) {
      const nextValue = Number(value)
      if (Number.isFinite(nextValue) && nextValue >= 0) {
        return nextValue
      }
    }
    return null
  }

  /*
  private normalizeToolDisplayText(value: any, maxLength = Number.POSITIVE_INFINITY) {
    const normalized = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!normalized) {
      return ''
    }
    if (normalized.length <= maxLength) {
      return normalized
    }
    return `${normalized.slice(0, maxLength - 1)}…`
  }

  }
  */

  private normalizeToolDisplayText(value: any, maxLength = Number.POSITIVE_INFINITY) {
    const normalized = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
    return this.truncatePlainText(normalized, maxLength)
  }

  private truncatePlainText(text: any, maxLength: number) {
    const normalized = String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!normalized) {
      return ''
    }
    if (!Number.isFinite(maxLength) || maxLength <= 0 || normalized.length <= maxLength) {
      return normalized
    }
    if (maxLength <= 3) {
      return normalized.slice(0, maxLength)
    }
    return `${normalized.slice(0, maxLength - 3)}...`
  }

  private buildToolTraceExtras(
    payload: {
      strategy?: AiRuntimeExecutionStrategy
      batchSize?: number
      partial?: boolean
      reused?: boolean
      policyBlocked?: boolean
      queued?: boolean
      executionGroup?: string
      targetIds?: string[]
      succeededTargetIds?: string[]
      failedTargetIds?: string[]
    },
    enabled: boolean,
  ) {
    if (!enabled) {
      return {}
    }

    const batchSize = Number(payload.batchSize)
    const targetIds = this.normalizeIds(payload.targetIds)
    const succeededTargetIds = this.normalizeIds(payload.succeededTargetIds)
    const failedTargetIds = this.normalizeIds(payload.failedTargetIds)
    return {
      strategy: payload.strategy,
      batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : undefined,
      partial: typeof payload.partial === 'boolean' ? payload.partial : undefined,
      reused: typeof payload.reused === 'boolean' ? payload.reused : undefined,
      policyBlocked: typeof payload.policyBlocked === 'boolean' ? payload.policyBlocked : undefined,
      queued: typeof payload.queued === 'boolean' ? payload.queued : undefined,
      executionGroup: String(payload.executionGroup || '').trim() || undefined,
      targetIds: targetIds.length ? targetIds : undefined,
      succeededTargetIds: succeededTargetIds.length ? succeededTargetIds : undefined,
      failedTargetIds: failedTargetIds.length ? failedTargetIds : undefined,
    }
  }

  private buildToolStateExtras(payload: {
    searchConvergence?: AiSearchConvergence
    topCandidateAppId?: string
    searchResultSignature?: string
    searchCandidateWeakSignature?: string
    topScoreRatio?: number
    dominantTopCandidate?: boolean
    noNewCandidates?: boolean
    topCandidateStable?: boolean
    stableTopCandidateRounds?: number
  }) {
    const searchConvergence = this.normalizeSearchConvergence(payload.searchConvergence)
    const topScoreRatio = Number(payload.topScoreRatio)
    const stableTopCandidateRounds = Number(payload.stableTopCandidateRounds)
    return {
      searchConvergence,
      topCandidateAppId: String(payload.topCandidateAppId || '').trim() || undefined,
      searchResultSignature: String(payload.searchResultSignature || '').trim() || undefined,
      searchCandidateWeakSignature: String(payload.searchCandidateWeakSignature || '').trim() || undefined,
      topScoreRatio: Number.isFinite(topScoreRatio) && topScoreRatio > 0
        ? topScoreRatio
        : undefined,
      dominantTopCandidate: typeof payload.dominantTopCandidate === 'boolean'
        ? payload.dominantTopCandidate
        : undefined,
      noNewCandidates: typeof payload.noNewCandidates === 'boolean' ? payload.noNewCandidates : undefined,
      topCandidateStable: typeof payload.topCandidateStable === 'boolean' ? payload.topCandidateStable : undefined,
      stableTopCandidateRounds: Number.isFinite(stableTopCandidateRounds) && stableTopCandidateRounds > 0
        ? stableTopCandidateRounds
        : undefined,
    }
  }

  private buildToolRepeatExtras(payload: {
    repeatedCall?: boolean
    noNewInformation?: boolean
    repeatNotice?: string
    repeatHint?: string
    duplicateBlocked?: boolean
    repeatedCount?: number
    consecutiveRepeatedCount?: number
    searchRepeatBlocked?: boolean
    searchStopReason?: string
  }) {
    const repeatedCount = Number(payload.repeatedCount)
    const consecutiveRepeatedCount = Number(payload.consecutiveRepeatedCount)
    return {
      repeatedCall: typeof payload.repeatedCall === 'boolean' ? payload.repeatedCall : undefined,
      noNewInformation: typeof payload.noNewInformation === 'boolean' ? payload.noNewInformation : undefined,
      repeatNotice: String(payload.repeatNotice || '').trim() || undefined,
      repeatHint: String(payload.repeatHint || '').trim() || undefined,
      duplicateBlocked: typeof payload.duplicateBlocked === 'boolean' ? payload.duplicateBlocked : undefined,
      repeatedCount: Number.isFinite(repeatedCount) && repeatedCount > 0 ? repeatedCount : undefined,
      consecutiveRepeatedCount: Number.isFinite(consecutiveRepeatedCount) && consecutiveRepeatedCount > 0
        ? consecutiveRepeatedCount
        : undefined,
      searchRepeatBlocked: typeof payload.searchRepeatBlocked === 'boolean'
        ? payload.searchRepeatBlocked
        : undefined,
      searchStopReason: String(payload.searchStopReason || '').trim() || undefined,
    }
  }

  private deriveRuntimeState(
    previousState: AiThreadRuntimeState | null | undefined,
    outputs: any[],
    batchRuntimeStateEnabled: boolean,
  ): AiThreadRuntimeState | null {
    return this.runtimeStateReducerService.reduceRuntimeState(previousState, outputs, {
      batchRuntimeStateEnabled,
    })
  }

  private extractVerifiedTargetsFromReadOutput(output: any): AiThreadVerifiedTarget[] {
    const appId = String(output?.resolved?.appId || '').trim()
    if (!appId) {
      return []
    }

    const appName = String(output?.resolved?.appName || '').trim() || undefined
    const mode = this.normalizeReadMode(output?.resolved?.mode)
    if (!mode) {
      return []
    }

    const rawTargets = Array.isArray(output?.resolved?.targets) && output.resolved.targets.length
      ? output.resolved.targets
      : (output?.resolved?.target ? [output.resolved.target] : [])

    return rawTargets
      .map((item: any) => {
        const targetId = String(item?.id || '').trim()
        const targetType = this.normalizeTargetType(item?.type)
        if (!targetId || !targetType) {
          return null
        }
        const verifiedTarget: AiThreadVerifiedTarget = {
          appId,
          appName,
          targetId,
          targetName: String(item?.name || '').trim() || undefined,
          targetType,
          mode,
        }
        return verifiedTarget
      })
      .filter((item): item is AiThreadVerifiedTarget => Boolean(item))
  }

  private mergeVerifiedTargets(
    nextTargets: AiThreadVerifiedTarget[] = [],
    previousTargets?: AiThreadVerifiedTarget[] | null,
  ) {
    return Array.from(new Map(
      [
        ...nextTargets,
        ...(Array.isArray(previousTargets) ? previousTargets : []),
      ].map(item => [`${item.appId}:${item.targetType}:${item.targetId}:${item.mode}`, item] as const),
    ).values()).slice(0, 12)
  }

  private mergeRecentIds(nextIds: string[] = [], previousIds?: string[] | null, limit = 8) {
    return [
      ...this.normalizeIds(nextIds),
      ...this.normalizeIds(previousIds),
    ].filter((item, index, array) => Boolean(item) && array.indexOf(item) === index).slice(0, limit)
  }

  private resolveOutputAppId(output: any) {
    return String(output?.resolved?.appId || output?.app?.appId || '').trim()
  }

  private resolveOutputAppName(output: any) {
    return String(output?.resolved?.appName || output?.app?.appName || '').trim()
  }

  private normalizeReadMode(value: any): 'records' | 'aggregate' | null {
    const normalized = String(value || '').trim().toLowerCase()
    return ['records', 'aggregate'].includes(normalized)
      ? normalized as 'records' | 'aggregate'
      : null
  }

  private normalizeTargetType(value: any): 'source' | null {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'source'
      ? 'source'
      : null
  }

  private normalizeExecutionStrategy(value: any): AiRuntimeExecutionStrategy | null {
    const normalized = String(value || '').trim()
    return ['hard_serial', 'batch', 'parallel_safe', 'blocked_by_policy'].includes(normalized)
      ? normalized as AiRuntimeExecutionStrategy
      : null
  }

  private normalizeSearchConvergence(value: any): AiSearchConvergence | undefined {
    const normalized = String(value || '').trim()
    return ['none', 'weak', 'clear'].includes(normalized)
      ? normalized as AiSearchConvergence
      : undefined
  }

  private isBatchReadOutput(output: any) {
    const kind = String(output?.result?.kind || '').trim().toLowerCase()
    const targets = this.extractVerifiedTargetsFromReadOutput(output)
    return kind.startsWith('batch_')
      || targets.length > 1
      || this.normalizeExecutionStrategy(output?.result?.executionSummary?.strategy) === 'batch'
  }

  private ensureOpenToolCallGroup(groups: Array<{
    id: string
    callIds: string[]
    timeline: Array<{
      id: string
      type: 'tool-call' | 'interim-text'
      refId: string
    }>
    closed: boolean
  }>) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && !lastGroup.closed) {
      return lastGroup
    }

    const nextGroup = {
      id: `tool-group-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      callIds: [],
      timeline: [],
      closed: false,
    }
    groups.push(nextGroup)
    return nextGroup
  }

  private closeOpenToolCallGroup(groups: Array<{
    id: string
    callIds: string[]
    timeline: Array<{
      id: string
      type: 'tool-call' | 'interim-text'
      refId: string
    }>
    closed: boolean
  }>) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && !lastGroup.closed) {
      lastGroup.closed = true
    }
  }

  private capturePendingInterimText(
    interimTexts: Array<{ id: string; text: string; round?: number }>,
    pendingDelta: { text: string; round: number; interim: boolean },
    toolGroup: {
      id: string
      callIds: string[]
      timeline: Array<{
        id: string
        type: 'tool-call' | 'interim-text'
        refId: string
      }>
      closed: boolean
    },
    round?: number,
  ) {
    if (!pendingDelta.interim) {
      return
    }
    if (round && pendingDelta.round && pendingDelta.round !== round) {
      return
    }

    const text = normalizeInterimText(String(pendingDelta.text || ''))
    if (text && !isLikelyToolProtocolText(text)) {
      const interimText = {
        id: `assistant-delta-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        text,
        round: pendingDelta.round || round || undefined,
      }
      interimTexts.push(interimText)
      this.appendToolCallGroupTimelineItem(toolGroup, {
        type: 'interim-text',
        refId: interimText.id,
      })
    }

    pendingDelta.text = ''
    pendingDelta.round = 0
    pendingDelta.interim = false
  }

  private appendToolCallGroupTimelineItem(
    toolGroup: {
      id: string
      callIds: string[]
      timeline: Array<{
        id: string
        type: 'tool-call' | 'interim-text'
        refId: string
      }>
      closed: boolean
    },
    item: {
      type: 'tool-call' | 'interim-text'
      refId: string
    },
  ) {
    const existingItem = toolGroup.timeline.find(timelineItem =>
      timelineItem.type === item.type && timelineItem.refId === item.refId,
    )
    if (existingItem) {
      return existingItem
    }

    const nextItem = {
      id: `tool-group-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: item.type,
      refId: item.refId,
    }
    toolGroup.timeline.push(nextItem)
    return nextItem
  }

  private buildToolOutputPreview(
    value: any,
    toolName: string,
    maxLength = AiRuntimeOrchestratorService.TOOL_OUTPUT_PREVIEW_LIMIT,
  ) {
    const previewValue = toolName === AI_READ_ATTACHMENT_TOOL_NAME
      ? {
        attachmentId: String(value?.attachmentId || '').trim(),
        name: String(value?.name || '').trim(),
        offset: Number(value?.offset || 0),
        nextOffset: value?.nextOffset ?? null,
        truncated: value?.truncated === true,
        historical: true,
        contentOmitted: true,
      }
      : value
    const text = this.stringifyToolResult(previewValue)
    if (text.length <= maxLength) {
      return {
        text,
        truncated: false,
      }
    }

    return {
      text: text.slice(0, maxLength),
      truncated: true,
    }
  }

  private buildToolHistoryPromptSnapshot(toolName: string, output: any, input?: any) {
    const maxLength = AiRuntimeOrchestratorService.TOOL_HISTORY_PROMPT_SNAPSHOT_LIMITS[toolName]
    if (!maxLength) {
      return null
    }

    for (const mode of ['full', 'compact', 'minimal'] as AiHistorySnapshotBuildMode[]) {
      const context = this.createHistorySnapshotBuildContext(mode)
      const snapshot = this.buildToolHistoryPromptSnapshotObject(toolName, output, context, input)
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        continue
      }

      const text = this.safeJsonStringify(snapshot)
      if (text.length <= maxLength) {
        return {
          text,
          truncated: context.truncated,
        }
      }
    }

    const toolFallback = this.buildToolHistoryPromptSnapshotFallback(toolName, output, input)
    if (toolFallback && typeof toolFallback === 'object' && !Array.isArray(toolFallback)) {
      const fallbackText = this.safeJsonStringify(toolFallback)
      if (fallbackText.length <= maxLength) {
        return {
          text: fallbackText,
          truncated: true,
        }
      }
    }

    const fallback = {
      tool: toolName,
      summary: this.truncatePlainText(output?.summary || output?.result?.summary || output?.result?.answerText, 240),
    }
    return {
      text: this.safeJsonStringify(fallback),
      truncated: true,
    }
  }

  private buildToolHistoryPromptSnapshotObject(
    toolName: string,
    output: any,
    context: AiHistorySnapshotBuildContext,
    input?: any,
  ) {
    if (toolName === 'search_apps') {
      return this.buildSearchAppsHistoryPromptSnapshot(output, context, input)
    }
    if (toolName === 'get_app_memory') {
      return this.buildGetAppMemoryHistoryPromptSnapshot(output, context)
    }
    if (toolName === 'read_app_data') {
      return this.buildReadAppDataHistoryPromptSnapshot(output, context)
    }
    return null
  }

  private buildToolHistoryPromptSnapshotFallback(toolName: string, output: any, input?: any) {
    if (toolName === 'search_apps') {
      return this.buildSearchAppsHistoryPromptSnapshotFallback(output, input)
    }
    if (toolName === 'get_app_memory') {
      return this.buildGetAppMemoryHistoryPromptSnapshotFallback(output)
    }
    if (toolName === 'read_app_data') {
      return this.buildReadAppDataHistoryPromptSnapshotFallback(output)
    }
    return null
  }

  private resolveSearchExplicitAppNameForHistory(output: any, input?: any) {
    return this.normalizeOptionalSnapshotText(
      output?.explicitAppName
      || input?.explicitAppName,
    )
  }

  private buildSearchAppsHistoryPromptSnapshotFallback(output: any, input?: any) {
    const apps = (Array.isArray(output?.apps) ? output.apps : [])
      .slice(0, 1)
      .map((item: any) => this.cleanHistorySnapshotObject({
        appId: this.normalizeOptionalSnapshotText(item?.appId),
        appName: this.truncatePlainText(item?.appName, 16),
        evidenceStrength: this.normalizeOptionalSnapshotText(item?.evidenceStrength),
        matchReasons: (Array.isArray(item?.matchReasons) ? item.matchReasons : [])
          .slice(0, 1)
          .map((reason: any) => this.truncatePlainText(reason, 20))
          .filter(Boolean),
      }))
      .filter(Boolean)

    return this.cleanHistorySnapshotObject({
      tool: 'search_apps',
      summary: this.truncatePlainText(output?.summary, 60),
      explicitAppName: this.resolveSearchExplicitAppNameForHistory(output, input),
      keywords: (Array.isArray(output?.keywords) ? output.keywords : (Array.isArray(input?.keywords) ? input.keywords : []))
        .slice(0, 3)
        .map((item: any) => this.truncatePlainText(item, 24))
        .filter(Boolean),
      intent: this.normalizeOptionalSnapshotText(output?.intent),
      convergence: this.normalizeOptionalSnapshotText(output?.convergence),
      requiresDisambiguation: typeof output?.requiresDisambiguation === 'boolean'
        ? output.requiresDisambiguation
        : undefined,
      evidenceStrength: this.normalizeOptionalSnapshotText(output?.evidenceStrength),
      topCandidateAppId: this.normalizeOptionalSnapshotText(output?.topCandidateAppId),
      accessibleAppsSignature: this.truncatePlainText(output?.accessibleAppsSignature, 48),
      resultSignature: this.truncatePlainText(output?.resultSignature, 64),
      candidateWeakSignature: this.truncatePlainText(output?.candidateWeakSignature, 64),
      noNewCandidates: typeof output?.noNewCandidates === 'boolean' ? output.noNewCandidates : undefined,
      stableTopCandidateRounds: Number.isFinite(Number(output?.stableTopCandidateRounds))
        ? Number(output.stableTopCandidateRounds)
        : undefined,
      apps,
    })
  }

  private buildGetAppMemoryHistoryPromptSnapshotFallback(output: any) {
    const projection = projectGetAppMemoryForPrompt({
      mode: 'history_fallback',
      request: output?.request,
      app: output?.app,
      evidenceProfile: output?.evidenceProfile,
      sources: Array.isArray(output?.sources) ? output.sources : [],
    })

    const sources = projection.sources
      .map((item: any) => this.cleanHistorySnapshotObject({
        sourceId: this.normalizeOptionalSnapshotText(item?.sourceId),
        sourceName: this.truncatePlainText(item?.sourceName, 24),
        role: this.normalizeOptionalSnapshotText(item?.role),
        reasons: (Array.isArray(item?.reasons) ? item.reasons : [])
          .slice(0, 3)
          .map((reason: any) => this.normalizeOptionalSnapshotText(reason))
          .filter(Boolean),
        compacted: item?.compacted === true || undefined,
      }))
      .filter(Boolean)

    return this.cleanHistorySnapshotObject({
      tool: 'get_app_memory',
      accessibleAppsSignature: this.truncatePlainText(output?.accessibleAppsSignature, 48),
      request: this.cleanHistorySnapshotObject({
        level: this.normalizeOptionalSnapshotText(output?.request?.level),
        focus: this.cleanHistorySnapshotObject({
          sourceIds: (Array.isArray(output?.request?.focus?.sourceIds) ? output.request.focus.sourceIds : [])
            .slice(0, 2)
            .map((item: any) => this.normalizeOptionalSnapshotText(item))
            .filter(Boolean),
        }),
      }),
      app: this.cleanHistorySnapshotObject({
        appId: this.normalizeOptionalSnapshotText(output?.app?.appId),
        appName: this.truncatePlainText(output?.app?.appName, 28),
        summary: this.truncatePlainText(output?.app?.summary, 120),
        counts: this.cleanHistorySnapshotObject({
          sourceCount: Number.isFinite(Number(output?.app?.counts?.sourceCount))
            ? Number(output.app.counts.sourceCount)
            : undefined,
        }),
      }),
      evidenceProfile: this.cleanHistorySnapshotObject({
        primaryIntent: this.normalizeOptionalSnapshotText(output?.evidenceProfile?.primaryIntent),
        recordsCoverage: this.normalizeOptionalSnapshotText(output?.evidenceProfile?.recordsCoverage),
        memoryFreshness: this.normalizeOptionalSnapshotText(output?.evidenceProfile?.memoryFreshness),
      }),
      compacted: projection.compacted || undefined,
      omittedSourceCount: projection.omittedSourceCount || undefined,
      sources,
    })
  }

  private buildReadAppDataHistoryPromptSnapshotFallback(output: any) {
    const resultKind = String(output?.result?.kind || '').trim().toLowerCase()

    return this.cleanHistorySnapshotObject({
      tool: 'read_app_data',
      accessibleAppsSignature: this.truncatePlainText(output?.accessibleAppsSignature, 48),
      summary: this.truncatePlainText(output?.summary, 80),
      repeatedCall: typeof output?.repeatedCall === 'boolean' ? output.repeatedCall : undefined,
      noNewInformation: typeof output?.noNewInformation === 'boolean' ? output.noNewInformation : undefined,
      relativeTimeFilterMissing: typeof output?.relativeTimeFilterMissing === 'boolean'
        ? output.relativeTimeFilterMissing
        : undefined,
      decision: this.cleanHistorySnapshotObject({
        relativeTimeRiskHint: this.truncatePlainText(output?.decision?.relativeTimeRiskHint, 120),
      }),
      resolved: this.buildReadAppDataResolvedHistorySnapshotFallback(output?.resolved),
      result: resultKind === 'record_analysis'
        ? this.buildRecordAnalysisHistoryResultSnapshotFallback(output?.result)
        : resultKind.startsWith('batch_')
          ? this.buildBatchReadAppDataHistoryResultSnapshotFallback(output?.result)
          : this.buildDefaultReadAppDataHistoryResultSnapshotFallback(output?.result),
    })
  }

  private buildReadAppDataResolvedHistorySnapshotFallback(resolved: any) {
    if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
      return undefined
    }

    return this.cleanHistorySnapshotObject({
      appId: this.normalizeOptionalSnapshotText(resolved?.appId),
      appName: this.truncatePlainText(resolved?.appName, 20),
      mode: this.normalizeOptionalSnapshotText(resolved?.mode),
      target: this.cleanHistorySnapshotObject({
        type: this.normalizeOptionalSnapshotText(resolved?.target?.type),
        id: this.normalizeOptionalSnapshotText(resolved?.target?.id),
        name: this.truncatePlainText(resolved?.target?.name, 20),
      }),
      request: this.cleanHistorySnapshotObject({
        groupBy: this.normalizeOptionalSnapshotText(resolved?.request?.groupBy),
        topN: Number.isFinite(Number(resolved?.request?.topN)) ? Number(resolved.request.topN) : undefined,
        sortBy: this.normalizeOptionalSnapshotText(resolved?.request?.sortBy),
        sortOrder: this.normalizeOptionalSnapshotText(resolved?.request?.sortOrder),
        filters: this.buildReadAppDataFiltersHistorySnapshotFallback(resolved?.request?.filters),
        analysis: this.cleanHistorySnapshotObject({
          metrics: (Array.isArray(resolved?.request?.analysis?.metrics) ? resolved.request.analysis.metrics : [])
            .slice(0, 2)
            .map((item: any) => this.cleanHistorySnapshotObject({
              as: this.normalizeOptionalSnapshotText(item?.as || item?.key),
              op: this.normalizeOptionalSnapshotText(item?.op),
              field: this.normalizeOptionalSnapshotText(item?.field),
            }))
            .filter(Boolean),
          groupBy: (Array.isArray(resolved?.request?.analysis?.groupBy) ? resolved.request.analysis.groupBy : [])
            .slice(0, 2)
            .map((item: any) => this.cleanHistorySnapshotObject({
              field: this.normalizeOptionalSnapshotText(item?.field),
              as: this.normalizeOptionalSnapshotText(item?.as || item?.key),
              timeGranularity: this.normalizeOptionalSnapshotText(item?.timeGranularity),
            }))
            .filter(Boolean),
        }),
      }),
    })
  }

  private buildReadAppDataFiltersHistorySnapshotFallback(filters: any) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return undefined
    }

    const entries = Object.entries(filters).slice(0, 4)
    return this.cleanHistorySnapshotObject(Object.fromEntries(
      entries.map(([key, value]) => [key, this.buildReadAppDataFilterHistoryValueFallback(value)]),
    ))
  }

  private buildReadAppDataFilterHistoryValueFallback(value: any, depth = 0): any {
    if (value === undefined || value === null) {
      return undefined
    }
    if (typeof value === 'string') {
      return this.truncatePlainText(value, 64)
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }
    if (Array.isArray(value)) {
      return value
        .slice(0, depth === 0 ? 4 : 3)
        .map(item => this.buildReadAppDataFilterHistoryValueFallback(item, depth + 1))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
    }
    if (typeof value !== 'object') {
      return this.truncatePlainText(String(value), 64)
    }

    const entries = Object.entries(value).slice(0, depth === 0 ? 4 : 3)
    return this.cleanHistorySnapshotObject(Object.fromEntries(
      entries.map(([key, item]) => [key, this.buildReadAppDataFilterHistoryValueFallback(item, depth + 1)]),
    ))
  }

  private buildRecordAnalysisHistoryResultSnapshotFallback(result: any) {
    const analysisResult = result?.analysisResult || {}
    const totalsEntries = Object.entries(
      analysisResult?.totals && typeof analysisResult.totals === 'object' && !Array.isArray(analysisResult.totals)
        ? analysisResult.totals
        : {},
    ).slice(0, 2)

    return this.cleanHistorySnapshotObject({
      kind: this.normalizeOptionalSnapshotText(result?.kind),
      answerText: this.truncatePlainText(result?.answerText, 96),
      itemsText: this.truncatePlainText(result?.itemsText, 96),
      analysisResult: this.cleanHistorySnapshotObject({
        metricDefs: (Array.isArray(analysisResult?.metricDefs) ? analysisResult.metricDefs : [])
          .slice(0, 1)
          .map((item: any) => this.cleanHistorySnapshotObject({
            key: this.normalizeOptionalSnapshotText(item?.key),
            op: this.normalizeOptionalSnapshotText(item?.op),
            field: this.normalizeOptionalSnapshotText(item?.field),
          }))
          .filter(Boolean),
        groupDefs: (Array.isArray(analysisResult?.groupDefs) ? analysisResult.groupDefs : [])
          .slice(0, 1)
          .map((item: any) => this.cleanHistorySnapshotObject({
            key: this.normalizeOptionalSnapshotText(item?.key),
            timeGranularity: this.normalizeOptionalSnapshotText(item?.timeGranularity),
          }))
          .filter(Boolean),
        totals: totalsEntries.length
          ? this.cleanHistorySnapshotObject(Object.fromEntries(totalsEntries))
          : undefined,
        rows: (Array.isArray(analysisResult?.rows) ? analysisResult.rows : [])
          .slice(0, 1)
          .map((item: any) => this.buildAnalysisRowHistorySnapshotFallback(item))
          .filter(Boolean),
        meta: this.cleanHistorySnapshotObject({
          matchedCount: Number.isFinite(Number(analysisResult?.meta?.matchedCount))
            ? Number(analysisResult.meta.matchedCount)
            : undefined,
          groupCount: Number.isFinite(Number(analysisResult?.meta?.groupCount))
            ? Number(analysisResult.meta.groupCount)
            : undefined,
          rowCount: Number.isFinite(Number(analysisResult?.meta?.rowCount))
            ? Number(analysisResult.meta.rowCount)
            : undefined,
          topNApplied: typeof analysisResult?.meta?.topNApplied === 'boolean'
            ? analysisResult.meta.topNApplied
            : undefined,
        }),
      }),
    })
  }

  private buildAnalysisRowHistorySnapshotFallback(row: any) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return row === undefined ? undefined : this.truncatePlainText(row, 48)
    }

    return this.cleanHistorySnapshotObject(Object.fromEntries(
      Object.entries(row)
        .slice(0, 3)
        .map(([key, value]) => [
          key,
          typeof value === 'string'
            ? this.truncatePlainText(value, 24)
            : value,
        ]),
    ))
  }

  private buildBatchReadAppDataHistoryResultSnapshotFallback(result: any) {
    return this.cleanHistorySnapshotObject({
      kind: this.normalizeOptionalSnapshotText(result?.kind),
      partial: typeof result?.partial === 'boolean' ? result.partial : undefined,
      executionSummary: this.cleanHistorySnapshotObject({
        strategy: this.normalizeOptionalSnapshotText(result?.executionSummary?.strategy),
        batchSize: Number.isFinite(Number(result?.executionSummary?.batchSize))
          ? Number(result.executionSummary.batchSize)
          : undefined,
        partial: typeof result?.executionSummary?.partial === 'boolean'
          ? result.executionSummary.partial
          : undefined,
      }),
      mergedTotal: Number.isFinite(Number(result?.mergedTotal)) ? Number(result.mergedTotal) : undefined,
      mergedResultCount: Number.isFinite(Number(result?.mergedResultCount)) ? Number(result.mergedResultCount) : undefined,
      mergedReturnedRows: Number.isFinite(Number(result?.mergedReturnedRows)) ? Number(result.mergedReturnedRows) : undefined,
      mergedAggregation: result?.mergedAggregation
        ? this.cleanHistorySnapshotObject({
          kind: this.normalizeOptionalSnapshotText(result?.mergedAggregation?.kind),
          itemsText: this.truncatePlainText(result?.mergedAggregation?.itemsText, 160),
        })
        : undefined,
      perTargetResults: (Array.isArray(result?.perTargetResults) ? result.perTargetResults : [])
        .slice(0, 2)
        .map((item: any) => this.cleanHistorySnapshotObject({
          ok: item?.ok === false ? false : (item?.ok === true ? true : undefined),
          kind: this.normalizeOptionalSnapshotText(item?.kind),
          target: this.cleanHistorySnapshotObject({
            id: this.normalizeOptionalSnapshotText(item?.target?.id),
            name: this.truncatePlainText(item?.target?.name, 24),
          }),
          total: Number.isFinite(Number(item?.total)) ? Number(item.total) : undefined,
          resultCount: Number.isFinite(Number(item?.resultCount)) ? Number(item.resultCount) : undefined,
          returnedRows: Number.isFinite(Number(item?.returnedRows)) ? Number(item.returnedRows) : undefined,
          error: this.truncatePlainText(item?.error, 80),
        }))
        .filter(Boolean),
      succeededTargets: (Array.isArray(result?.succeededTargets) ? result.succeededTargets : [])
        .slice(0, 2)
        .map((item: any) => this.cleanHistorySnapshotObject({
          id: this.normalizeOptionalSnapshotText(item?.id),
          name: this.truncatePlainText(item?.name, 24),
        }))
        .filter(Boolean),
      failedTargets: (Array.isArray(result?.failedTargets) ? result.failedTargets : [])
        .slice(0, 2)
        .map((item: any) => this.cleanHistorySnapshotObject({
          id: this.normalizeOptionalSnapshotText(item?.id),
          name: this.truncatePlainText(item?.name, 24),
          error: this.truncatePlainText(item?.error, 80),
        }))
        .filter(Boolean),
    })
  }

  private buildDefaultReadAppDataHistoryResultSnapshotFallback(result: any) {
    return this.cleanHistorySnapshotObject({
      kind: this.normalizeOptionalSnapshotText(result?.kind),
      path: this.truncatePlainText(result?.path, 96),
      title: this.truncatePlainText(result?.title, 48),
      matchedCount: Number.isFinite(Number(result?.matchedCount)) ? Number(result.matchedCount) : undefined,
      returnedRows: Number.isFinite(Number(result?.returnedRows)) ? Number(result.returnedRows) : undefined,
      total: Number.isFinite(Number(result?.total)) ? Number(result.total) : undefined,
      resultCount: Number.isFinite(Number(result?.resultCount)) ? Number(result.resultCount) : undefined,
      answerText: this.truncatePlainText(result?.answerText, 120),
      itemsText: this.truncatePlainText(result?.itemsText, 160),
      contentText: this.truncatePlainText(result?.contentText, 180),
    })
  }

  private buildSearchAppsHistoryPromptSnapshot(output: any, context: AiHistorySnapshotBuildContext, input?: any) {
    const appLimit = context.mode === 'full' ? 3 : (context.mode === 'compact' ? 2 : 1)
    const reasonLimit = context.mode === 'full' ? 3 : 2
    const appSummaryLimit = context.mode === 'full' ? 80 : (context.mode === 'compact' ? 48 : 0)
    const keywordLimit = context.mode === 'full' ? 4 : (context.mode === 'compact' ? 3 : 2)
    const explicitAppName = this.resolveSearchExplicitAppNameForHistory(output, input)
    const keywords = Array.isArray(output?.keywords)
      ? output.keywords
      : (Array.isArray(input?.keywords) ? input.keywords : [])

    return this.cleanHistorySnapshotObject({
      tool: 'search_apps',
      summary: this.limitHistoryText(output?.summary, context.mode === 'minimal' ? 120 : 180, context),
      explicitAppName,
      keywords: this.takeHistoryItems(keywords, keywordLimit, context, keyword =>
        this.limitHistoryText(keyword, 32, context),
      ),
      intent: this.normalizeOptionalSnapshotText(output?.intent),
      convergence: this.normalizeOptionalSnapshotText(output?.convergence),
      requiresDisambiguation: typeof output?.requiresDisambiguation === 'boolean'
        ? output.requiresDisambiguation
        : undefined,
      evidenceStrength: this.normalizeOptionalSnapshotText(output?.evidenceStrength),
      topCandidateAppId: this.normalizeOptionalSnapshotText(output?.topCandidateAppId),
      accessibleAppsSignature: this.limitHistoryText(output?.accessibleAppsSignature, 64, context),
      resultSignature: this.limitHistoryText(output?.resultSignature, 120, context),
      candidateWeakSignature: this.limitHistoryText(output?.candidateWeakSignature, 120, context),
      noNewCandidates: typeof output?.noNewCandidates === 'boolean' ? output.noNewCandidates : undefined,
      topCandidateStable: typeof output?.topCandidateStable === 'boolean' ? output.topCandidateStable : undefined,
      stableTopCandidateRounds: Number.isFinite(Number(output?.stableTopCandidateRounds))
        ? Number(output.stableTopCandidateRounds)
        : undefined,
      dominantTopCandidate: typeof output?.dominantTopCandidate === 'boolean'
        ? output.dominantTopCandidate
        : undefined,
      topScoreRatio: Number.isFinite(Number(output?.topScoreRatio))
        ? Number(output.topScoreRatio)
        : undefined,
      totalAccessible: Number.isFinite(Number(output?.totalAccessible))
        ? Number(output.totalAccessible)
        : undefined,
      totalMatched: Number.isFinite(Number(output?.totalMatched))
        ? Number(output.totalMatched)
        : undefined,
      totalReturned: Number.isFinite(Number(output?.totalReturned))
        ? Number(output.totalReturned)
        : undefined,
      repeatedCall: typeof output?.repeatedCall === 'boolean' ? output.repeatedCall : undefined,
      repeatNotice: this.limitHistoryText(output?.repeatNotice, 160, context),
      apps: this.takeHistoryItems(output?.apps, appLimit, context, item => this.cleanHistorySnapshotObject({
        appId: this.normalizeOptionalSnapshotText(item?.appId),
        appName: this.normalizeOptionalSnapshotText(item?.appName),
        score: Number.isFinite(Number(item?.score)) ? Number(item.score) : undefined,
        summary: appSummaryLimit > 0 ? this.limitHistoryText(item?.summary, appSummaryLimit, context) : undefined,
        evidenceStrength: this.normalizeOptionalSnapshotText(item?.evidenceStrength),
        memoryStatus: this.normalizeOptionalSnapshotText(item?.memoryStatus),
        matchReasons: this.takeHistoryItems(item?.matchReasons, reasonLimit, context, reason =>
          this.limitHistoryText(reason, context.mode === 'full' ? 72 : 48, context),
        ),
        capabilities: this.cleanHistorySnapshotObject({
          supportsRecords: typeof item?.capabilities?.supportsRecords === 'boolean'
            ? item.capabilities.supportsRecords
            : undefined,
          sourceCount: Number.isFinite(Number(item?.capabilities?.sourceCount))
            ? Number(item.capabilities.sourceCount)
            : undefined,
        }),
      })),
    })
  }

  private buildGetAppMemoryHistoryPromptSnapshot(output: any, context: AiHistorySnapshotBuildContext) {
    const projection = projectGetAppMemoryForPrompt({
      mode: context.mode === 'full' ? 'history_full' : 'history_fallback',
      request: output?.request,
      app: output?.app,
      evidenceProfile: output?.evidenceProfile,
      sources: Array.isArray(output?.sources) ? output.sources : [],
    })

    return this.cleanHistorySnapshotObject({
      tool: 'get_app_memory',
      accessibleAppsSignature: this.limitHistoryText(output?.accessibleAppsSignature, 64, context),
      request: this.buildGetAppMemoryRequestHistorySnapshot(output?.request, context),
      app: this.cleanHistorySnapshotObject({
        appId: this.normalizeOptionalSnapshotText(output?.app?.appId),
        appName: this.normalizeOptionalSnapshotText(output?.app?.appName),
        summary: this.limitHistoryText(output?.app?.summary, context.mode === 'minimal' ? 140 : 220, context),
        counts: this.cleanHistorySnapshotObject({
          sourceCount: Number.isFinite(Number(output?.app?.counts?.sourceCount))
            ? Number(output.app.counts.sourceCount)
            : undefined,
        }),
      }),
      evidenceProfile: this.buildEvidenceProfileHistorySnapshot(output?.evidenceProfile, context),
      compacted: projection.compacted || undefined,
      omittedSourceCount: projection.omittedSourceCount || undefined,
      sources: projection.sources.map(item => this.cleanHistorySnapshotObject({
        sourceId: this.normalizeOptionalSnapshotText(item?.sourceId),
        sourceName: this.normalizeOptionalSnapshotText(item?.sourceName),
        role: this.normalizeOptionalSnapshotText(item?.role),
        summary: this.limitHistoryText(item?.summary, 120, context),
        whenToUse: this.limitHistoryText(item?.whenToUse, 120, context),
        compacted: item?.compacted === true || undefined,
        reasons: this.takeHistoryItems(item?.reasons, 4, context, reason =>
          this.normalizeOptionalSnapshotText(reason),
        ),
        keyFields: this.takeHistoryItems(item?.keyFields, 4, context, field => this.cleanHistorySnapshotObject({
          id: this.normalizeOptionalSnapshotText(field?.id),
          name: this.normalizeOptionalSnapshotText(field?.name),
        })),
        queryHints: this.cleanHistorySnapshotObject({
          timeFields: this.takeHistoryItems(item?.queryHints?.timeFields, 3, context, hint =>
            this.normalizeOptionalSnapshotText(hint),
          ),
          metricFields: this.takeHistoryItems(item?.queryHints?.metricFields, 3, context, hint =>
            this.normalizeOptionalSnapshotText(hint),
          ),
          entityFields: this.takeHistoryItems(item?.queryHints?.entityFields, 3, context, hint =>
            this.normalizeOptionalSnapshotText(hint),
          ),
          filterFields: this.takeHistoryItems(item?.queryHints?.filterFields, 3, context, hint =>
            this.normalizeOptionalSnapshotText(hint),
          ),
        }),
      })),
    })
  }

  private buildGetAppMemoryRequestHistorySnapshot(request: any, context: AiHistorySnapshotBuildContext) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return undefined
    }

    return this.cleanHistorySnapshotObject({
      level: this.normalizeOptionalSnapshotText(request?.level),
      focus: this.cleanHistorySnapshotObject({
        sourceIds: this.takeHistoryItems(request?.focus?.sourceIds, 4, context, item =>
          this.normalizeOptionalSnapshotText(item),
        ),
      }),
    })
  }

  private buildEvidenceProfileHistorySnapshot(value: any, context: AiHistorySnapshotBuildContext) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }

    return this.cleanHistorySnapshotObject({
      primaryIntent: this.normalizeOptionalSnapshotText(value?.primaryIntent),
      recordsCoverage: this.normalizeOptionalSnapshotText(value?.recordsCoverage),
      memoryFreshness: this.normalizeOptionalSnapshotText(value?.memoryFreshness),
      caveats: this.takeHistoryItems(value?.caveats, 3, context, item =>
        this.limitHistoryText(item, 80, context),
      ),
      strengths: this.takeHistoryItems(value?.strengths, 3, context, item =>
        this.limitHistoryText(item, 80, context),
      ),
    })
  }

  private buildReadAppDataHistoryPromptSnapshot(output: any, context: AiHistorySnapshotBuildContext) {
    const resultKind = String(output?.result?.kind || '').trim().toLowerCase()

    return this.cleanHistorySnapshotObject({
      tool: 'read_app_data',
      accessibleAppsSignature: this.limitHistoryText(output?.accessibleAppsSignature, 64, context),
      summary: this.limitHistoryText(output?.summary, context.mode === 'minimal' ? 140 : 220, context),
      repeatedCall: typeof output?.repeatedCall === 'boolean' ? output.repeatedCall : undefined,
      noNewInformation: typeof output?.noNewInformation === 'boolean' ? output.noNewInformation : undefined,
      relativeTimeFilterMissing: typeof output?.relativeTimeFilterMissing === 'boolean'
        ? output.relativeTimeFilterMissing
        : undefined,
      repeatNotice: this.limitHistoryText(output?.repeatNotice, 160, context),
      decision: this.cleanHistorySnapshotObject({
        repeatHint: this.limitHistoryText(output?.decision?.repeatHint, 180, context),
        relativeTimeRiskHint: this.limitHistoryText(output?.decision?.relativeTimeRiskHint, 180, context),
      }),
      resolved: this.buildReadAppDataResolvedHistorySnapshot(output?.resolved, context),
      result: resultKind === 'record_analysis'
        ? this.buildRecordAnalysisHistoryResultSnapshot(output?.result, context)
        : resultKind.startsWith('batch_')
          ? this.buildBatchReadAppDataHistoryResultSnapshot(output?.result, context)
          : this.buildDefaultReadAppDataHistoryResultSnapshot(output?.result, context),
    })
  }

  private buildReadAppDataResolvedHistorySnapshot(resolved: any, context: AiHistorySnapshotBuildContext) {
    if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
      return undefined
    }

    const targetLimit = context.mode === 'full' ? 4 : (context.mode === 'compact' ? 3 : 2)
    return this.cleanHistorySnapshotObject({
      appId: this.normalizeOptionalSnapshotText(resolved?.appId),
      appName: this.normalizeOptionalSnapshotText(resolved?.appName),
      mode: this.normalizeOptionalSnapshotText(resolved?.mode),
      target: this.buildReadAppDataTargetHistorySnapshot(resolved?.target, context),
      targets: this.takeHistoryItems(resolved?.targets, targetLimit, context, item =>
        this.buildReadAppDataTargetHistorySnapshot(item, context),
      ),
      request: this.buildReadAppDataRequestHistorySnapshot(resolved?.request, context),
    })
  }

  private buildReadAppDataTargetHistorySnapshot(target: any, context: AiHistorySnapshotBuildContext) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      return undefined
    }

    return this.cleanHistorySnapshotObject({
      type: this.normalizeOptionalSnapshotText(target?.type),
      id: this.normalizeOptionalSnapshotText(target?.id),
      name: this.normalizeOptionalSnapshotText(target?.name),
      path: this.limitHistoryText(target?.path, 160, context),
      appId: this.normalizeOptionalSnapshotText(target?.appId),
    })
  }

  private buildReadAppDataRequestHistorySnapshot(request: any, context: AiHistorySnapshotBuildContext) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return undefined
    }

    return this.cleanHistorySnapshotObject({
      executionPreference: this.normalizeOptionalSnapshotText(request?.executionPreference),
      returnMode: this.normalizeOptionalSnapshotText(request?.returnMode),
      partialPolicy: this.normalizeOptionalSnapshotText(request?.partialPolicy),
      groupBy: this.normalizeOptionalSnapshotText(request?.groupBy),
      minCount: Number.isFinite(Number(request?.minCount)) ? Number(request.minCount) : undefined,
      topN: Number.isFinite(Number(request?.topN)) ? Number(request.topN) : undefined,
      limit: Number.isFinite(Number(request?.limit)) ? Number(request.limit) : undefined,
      sortBy: this.normalizeOptionalSnapshotText(request?.sortBy),
      sortOrder: this.normalizeOptionalSnapshotText(request?.sortOrder),
      filters: this.buildReadAppDataFiltersHistorySnapshot(request?.filters, context),
      analysis: this.buildReadAppDataAnalysisRequestHistorySnapshot(request?.analysis, context),
    })
  }

  private buildReadAppDataFiltersHistorySnapshot(filters: any, context: AiHistorySnapshotBuildContext) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return undefined
    }

    const entries = Object.entries(filters).slice(0, context.mode === 'minimal' ? 4 : 6)
    if (Object.keys(filters).length > entries.length) {
      context.truncated = true
    }

    return this.cleanHistorySnapshotObject(Object.fromEntries(entries.map(([key, value]) => [
      key,
      this.buildReadAppDataFilterHistorySnapshotValue(value, context),
    ])))
  }

  private buildReadAppDataFilterHistorySnapshotValue(
    value: any,
    context: AiHistorySnapshotBuildContext,
    depth = 0,
  ): any {
    if (value === undefined || value === null) {
      return undefined
    }
    if (typeof value === 'string') {
      return this.limitHistoryText(value, 120, context)
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }
    if (Array.isArray(value)) {
      const limit = depth === 0 ? (context.mode === 'full' ? 6 : 4) : 4
      if (value.length > limit) {
        context.truncated = true
      }
      return value
        .slice(0, limit)
        .map(item => this.buildReadAppDataFilterHistorySnapshotValue(item, context, depth + 1))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
    }
    if (typeof value !== 'object') {
      return this.limitHistoryText(String(value), 120, context)
    }

    const limit = depth === 0 ? 6 : 4
    const entries = Object.entries(value).slice(0, limit)
    if (Object.keys(value).length > entries.length) {
      context.truncated = true
    }

    return this.cleanHistorySnapshotObject(Object.fromEntries(entries.map(([key, item]) => [
      key,
      this.buildReadAppDataFilterHistorySnapshotValue(item, context, depth + 1),
    ])))
  }

  private buildReadAppDataAnalysisRequestHistorySnapshot(analysis: any, context: AiHistorySnapshotBuildContext) {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
      return undefined
    }

    return this.cleanHistorySnapshotObject({
      metrics: this.takeHistoryItems(analysis?.metrics, context.mode === 'full' ? 4 : 3, context, item => this.cleanHistorySnapshotObject({
        as: this.normalizeOptionalSnapshotText(item?.as || item?.key),
        op: this.normalizeOptionalSnapshotText(item?.op),
        field: this.normalizeOptionalSnapshotText(item?.field),
      })),
      groupBy: this.takeHistoryItems(analysis?.groupBy, context.mode === 'full' ? 4 : 3, context, item => this.cleanHistorySnapshotObject({
        field: this.normalizeOptionalSnapshotText(item?.field),
        as: this.normalizeOptionalSnapshotText(item?.as || item?.key),
        timeGranularity: this.normalizeOptionalSnapshotText(item?.timeGranularity),
      })),
    })
  }

  private buildRecordAnalysisHistoryResultSnapshot(result: any, context: AiHistorySnapshotBuildContext) {
    const analysisResult = result?.analysisResult || {}
    const rowLimit = context.mode === 'full' ? 3 : 2

    return this.cleanHistorySnapshotObject({
      kind: this.normalizeOptionalSnapshotText(result?.kind),
      answerText: this.limitHistoryText(result?.answerText, 180, context),
      itemsText: this.limitHistoryText(result?.itemsText, context.mode === 'minimal' ? 200 : 320, context),
      analysisResult: this.cleanHistorySnapshotObject({
        metricDefs: this.takeHistoryItems(analysisResult?.metricDefs, 4, context, item => this.cleanHistorySnapshotObject({
          key: this.normalizeOptionalSnapshotText(item?.key),
          op: this.normalizeOptionalSnapshotText(item?.op),
          field: this.normalizeOptionalSnapshotText(item?.field),
        })),
        groupDefs: this.takeHistoryItems(analysisResult?.groupDefs, 4, context, item => this.cleanHistorySnapshotObject({
          key: this.normalizeOptionalSnapshotText(item?.key),
          timeGranularity: this.normalizeOptionalSnapshotText(item?.timeGranularity),
        })),
        totals: this.buildAnalysisTotalsHistorySnapshot(analysisResult?.totals, context),
        rows: this.takeHistoryItems(analysisResult?.rows, rowLimit, context, item =>
          this.buildAnalysisRowHistorySnapshot(item, context),
        ),
        meta: this.cleanHistorySnapshotObject({
          matchedCount: Number.isFinite(Number(analysisResult?.meta?.matchedCount))
            ? Number(analysisResult.meta.matchedCount)
            : undefined,
          groupCount: Number.isFinite(Number(analysisResult?.meta?.groupCount))
            ? Number(analysisResult.meta.groupCount)
            : undefined,
          rowCount: Number.isFinite(Number(analysisResult?.meta?.rowCount))
            ? Number(analysisResult.meta.rowCount)
            : undefined,
          topNApplied: typeof analysisResult?.meta?.topNApplied === 'boolean'
            ? analysisResult.meta.topNApplied
            : undefined,
        }),
      }),
    })
  }

  private buildAnalysisTotalsHistorySnapshot(totals: any, context: AiHistorySnapshotBuildContext) {
    if (!totals || typeof totals !== 'object' || Array.isArray(totals)) {
      return undefined
    }

    const entries = Object.entries(totals).slice(0, context.mode === 'full' ? 6 : 4)
    if (Object.keys(totals).length > entries.length) {
      context.truncated = true
    }

    return this.cleanHistorySnapshotObject(Object.fromEntries(entries))
  }

  private buildAnalysisRowHistorySnapshot(row: any, context: AiHistorySnapshotBuildContext) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return row === undefined ? undefined : this.limitHistoryText(row, 120, context)
    }

    const entries = Object.entries(row).slice(0, context.mode === 'full' ? 8 : 6)
    if (Object.keys(row).length > entries.length) {
      context.truncated = true
    }

    return this.cleanHistorySnapshotObject(Object.fromEntries(entries.map(([key, value]) => [
      key,
      typeof value === 'string'
        ? this.limitHistoryText(value, 80, context)
        : value,
    ])))
  }

  private buildBatchReadAppDataHistoryResultSnapshot(result: any, context: AiHistorySnapshotBuildContext) {
    const targetLimit = context.mode === 'full' ? 4 : (context.mode === 'compact' ? 3 : 2)

    return this.cleanHistorySnapshotObject({
      kind: this.normalizeOptionalSnapshotText(result?.kind),
      partial: typeof result?.partial === 'boolean' ? result.partial : undefined,
      executionSummary: this.cleanHistorySnapshotObject({
        strategy: this.normalizeOptionalSnapshotText(result?.executionSummary?.strategy),
        batchSize: Number.isFinite(Number(result?.executionSummary?.batchSize))
          ? Number(result.executionSummary.batchSize)
          : undefined,
        partial: typeof result?.executionSummary?.partial === 'boolean'
          ? result.executionSummary.partial
          : undefined,
      }),
      mergedTotal: Number.isFinite(Number(result?.mergedTotal)) ? Number(result.mergedTotal) : undefined,
      mergedResultCount: Number.isFinite(Number(result?.mergedResultCount)) ? Number(result.mergedResultCount) : undefined,
      mergedReturnedRows: Number.isFinite(Number(result?.mergedReturnedRows)) ? Number(result.mergedReturnedRows) : undefined,
      mergedAggregation: result?.mergedAggregation
        ? this.cleanHistorySnapshotObject({
          kind: this.normalizeOptionalSnapshotText(result?.mergedAggregation?.kind),
          itemsText: this.limitHistoryText(result?.mergedAggregation?.itemsText, context.mode === 'minimal' ? 160 : 280, context),
        })
        : undefined,
      perTargetResults: this.takeHistoryItems(result?.perTargetResults, targetLimit, context, item => this.cleanHistorySnapshotObject({
        ok: item?.ok === false ? false : (item?.ok === true ? true : undefined),
        kind: this.normalizeOptionalSnapshotText(item?.kind),
        target: this.cleanHistorySnapshotObject({
          id: this.normalizeOptionalSnapshotText(item?.target?.id),
          name: this.normalizeOptionalSnapshotText(item?.target?.name),
        }),
        total: Number.isFinite(Number(item?.total)) ? Number(item.total) : undefined,
        resultCount: Number.isFinite(Number(item?.resultCount)) ? Number(item.resultCount) : undefined,
        returnedRows: Number.isFinite(Number(item?.returnedRows)) ? Number(item.returnedRows) : undefined,
        error: this.limitHistoryText(item?.error, 120, context),
      })),
      succeededTargets: this.takeHistoryItems(result?.succeededTargets, targetLimit, context, item => this.cleanHistorySnapshotObject({
        id: this.normalizeOptionalSnapshotText(item?.id),
        name: this.normalizeOptionalSnapshotText(item?.name),
      })),
      failedTargets: this.takeHistoryItems(result?.failedTargets, targetLimit, context, item => this.cleanHistorySnapshotObject({
        id: this.normalizeOptionalSnapshotText(item?.id),
        name: this.normalizeOptionalSnapshotText(item?.name),
        error: this.limitHistoryText(item?.error, 120, context),
      })),
    })
  }

  private buildDefaultReadAppDataHistoryResultSnapshot(result: any, context: AiHistorySnapshotBuildContext) {
    return this.cleanHistorySnapshotObject({
      kind: this.normalizeOptionalSnapshotText(result?.kind),
      path: this.limitHistoryText(result?.path, 180, context),
      title: this.limitHistoryText(result?.title, 120, context),
      matchedCount: Number.isFinite(Number(result?.matchedCount)) ? Number(result.matchedCount) : undefined,
      returnedRows: Number.isFinite(Number(result?.returnedRows)) ? Number(result.returnedRows) : undefined,
      total: Number.isFinite(Number(result?.total)) ? Number(result.total) : undefined,
      resultCount: Number.isFinite(Number(result?.resultCount)) ? Number(result.resultCount) : undefined,
      fields: this.takeHistoryItems(result?.fields, context.mode === 'full' ? 12 : 8, context, item =>
        this.normalizeOptionalSnapshotText(item),
      ),
      answerText: this.limitHistoryText(result?.answerText, 220, context),
      itemsText: this.limitHistoryText(result?.itemsText, context.mode === 'minimal' ? 200 : 320, context),
      contentText: this.limitHistoryText(result?.contentText, context.mode === 'full' ? 360 : 220, context),
    })
  }

  private createHistorySnapshotBuildContext(mode: AiHistorySnapshotBuildMode): AiHistorySnapshotBuildContext {
    return {
      mode,
      truncated: mode !== 'full',
    }
  }

  private takeHistoryItems<T>(
    value: any,
    limit: number,
    context: AiHistorySnapshotBuildContext,
    mapper: (item: any, index: number) => T | null | undefined,
  ) {
    const items = Array.isArray(value) ? value : []
    if (!items.length || limit <= 0) {
      if (items.length > 0 && limit <= 0) {
        context.truncated = true
      }
      return undefined
    }
    if (items.length > limit) {
      context.truncated = true
    }
    const visible = items
      .slice(0, limit)
      .map((item, index) => mapper(item, index))
      .filter((item): item is T => item !== null && item !== undefined)
    return visible.length ? visible : undefined
  }

  private limitHistoryText(value: any, maxLength: number, context: AiHistorySnapshotBuildContext) {
    const normalized = this.normalizeOptionalSnapshotText(value)
    if (!normalized) {
      return undefined
    }
    const text = this.truncatePlainText(normalized, maxLength)
    if (text.length < normalized.length) {
      context.truncated = true
    }
    return text
  }

  private normalizeOptionalSnapshotText(value: any) {
    const normalized = String(value || '').trim()
    return normalized || undefined
  }

  private cleanHistorySnapshotObject<T extends Record<string, any>>(value: T) {
    const entries = Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === null || entryValue === '') {
        return false
      }
      if (Array.isArray(entryValue)) {
        return entryValue.length > 0
      }
      if (typeof entryValue === 'object') {
        return Object.keys(entryValue).length > 0
      }
      return true
    })
    return entries.length
      ? Object.fromEntries(entries) as T
      : undefined
  }

  private safeJsonStringify(value: any) {
    const text = this.stringifyToolResult(value)
    return text || '{}'
  }

  private stringifyToolResult(value: any) {
    if (typeof value === 'string') {
      return value
    }

    const seen = new WeakSet<object>()

    try {
      const serialized = JSON.stringify(value, (_, currentValue) => {
        if (typeof currentValue === 'object' && currentValue !== null) {
          if (seen.has(currentValue)) {
            return '[Circular]'
          }
          seen.add(currentValue)
        }
        return currentValue
      })
      return typeof serialized === 'string'
        ? serialized
        : String(value ?? '')
    } catch {
      return String(value ?? '')
    }
  }

  private normalizeModelSelection(value?: { providerId?: string | null; modelId?: string | null; model?: string | null }) {
    return {
      providerId: String(value?.providerId || '').trim() || null,
      modelId: String(value?.modelId || '').trim() || null,
      model: String(value?.model || '').trim() || null,
    }
  }

  private hasModelSelectionPatch(value?: { providerId?: string | null; modelId?: string | null; model?: string | null }) {
    if (!value) {
      return false
    }
    return Boolean(value.providerId || value.modelId || value.model)
  }

  private isModelSelectionChanged(
    currentValue?: { providerId?: string | null; modelId?: string | null; model?: string | null },
    nextValue?: { providerId?: string | null; modelId?: string | null; model?: string | null },
  ) {
    const current = this.normalizeModelSelection(currentValue)
    const next = this.normalizeModelSelection(nextValue)
    return current.providerId !== next.providerId
      || current.modelId !== next.modelId
      || current.model !== next.model
  }
}
