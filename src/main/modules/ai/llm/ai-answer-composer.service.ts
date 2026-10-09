import { Injectable } from '@nestjs/common'
import {
  AiActionCall,
  AiActionResult,
  AiMessageRole,
  AiRuntimeExecutionStrategy,
  AiSearchConvergence,
  AiTurnDiagnostics,
  AiTurnFallbackDiagnostics,
  AiThreadRuntimeState,
  AiThreadContextState,
  AiToolExecutionContext,
} from '../ai.types'
import type { WorkbenchAiFormFillContextSnapshot } from '@common/utils/workbenchAiFormFill'
import { isAiRuntimeUserActionableError } from '../errors/ai-runtime-error'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiLlmClientService } from './ai-llm-client.service'
import { AiPromptTemplateService } from './ai-prompt-template.service'

type DynamicRecord = AiActionCall['input']
type DynamicValue = AiActionResult['output']

@Injectable()
export class AiAnswerComposerService {
  constructor(
    private readonly llmClient: AiLlmClientService,
    private readonly promptTemplateService: AiPromptTemplateService,
    private readonly agentLogService: AiAgentLogService,
  ) {}

  async compose(options: {
    threadId: string
    traceId?: string
    providerId?: string
    modelId?: string
    userMessage: string
    userMetadata?: DynamicRecord | null
    currentFormFillContext?: WorkbenchAiFormFillContextSnapshot | null
    currentFormFillUnavailable?: boolean
    disableBuiltinAppTools?: boolean
    historyMessages: Array<{ role: AiMessageRole; content: string; metadata?: DynamicRecord | null }>
    isShareMode: boolean
    runtimeState?: AiThreadRuntimeState | null
    contextState?: AiThreadContextState | null
    toolContext: AiToolExecutionContext
    model?: string
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
    const systemPrompt = this.promptTemplateService.buildSystemPrompt({
      isShareMode: options.isShareMode,
      runtimeState: options.runtimeState,
    })
    const userPrompt = this.promptTemplateService.buildUserPrompt({
      userMessage: options.userMessage,
      metadata: options.userMetadata || null,
      currentFormFillContext: options.currentFormFillContext || null,
      currentFormFillUnavailable: options.currentFormFillUnavailable === true,
    })

    try {
      return await this.llmClient.streamAnswer({
        threadId: options.threadId,
        traceId: options.traceId,
        providerId: options.providerId,
        modelId: options.modelId,
        model: options.model,
        disableBuiltinAppTools: options.disableBuiltinAppTools === true,
        systemPrompt,
        userMessage: options.userMessage,
        userPrompt,
        userMetadata: options.userMetadata || null,
        historyMessages: options.historyMessages,
        runtimeState: options.runtimeState,
        contextState: options.contextState,
        toolContext: options.toolContext,
        signal: options.signal,
        onRoundStart: options.onRoundStart,
        onContextCompaction: options.onContextCompaction,
        onDelta: options.onDelta,
        onToolCall: options.onToolCall,
        onToolResult: options.onToolResult,
      })
    } catch (error) {
      if (this.isAbortError(error, options.signal) || isAiRuntimeUserActionableError(error)) {
        throw error
      }
      await this.logFallbackDiagnostic(options, error)
      const fallbackText = global.i18next.t('aiAnswerComposerService.answerFailed')
      await options.onDelta?.({
        text: fallbackText,
        round: 0,
        interim: false,
      })
      return {
        text: fallbackText,
        usage: undefined,
        finishReason: 'fallback',
        diagnostics: this.buildFallbackDiagnostics(options, error),
      }
    }
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

  private async logFallbackDiagnostic(
    options: {
      threadId: string
      traceId?: string
      providerId?: string
      modelId?: string
      model?: string
      toolContext: AiToolExecutionContext
    },
    error: unknown,
  ) {
    await this.agentLogService.log(
      options.threadId,
      'AI DIAG answer_composer_fallback',
      JSON.stringify({
        stage: 'answer_composer_fallback',
        threadId: options.threadId,
        traceId: options.traceId || options.toolContext.traceId || undefined,
        providerId: options.providerId || undefined,
        modelId: options.modelId || undefined,
        model: options.model || undefined,
        error: this.serializeDiagnosticError(error),
      }, null, 2),
    )
  }

  private buildFallbackDiagnostics(
    options: {
      traceId?: string
      providerId?: string
      modelId?: string
      model?: string
      toolContext: AiToolExecutionContext
    },
    error: unknown,
  ): AiTurnDiagnostics {
    const fallback = this.buildFallbackDiagnosticPayload(options, error)
    const diagnostics = this.extractErrorDiagnostics(error)
    if (diagnostics) {
      return {
        ...diagnostics,
        fallback,
      }
    }

    return {
      startedAt: Date.now(),
      completedAt: Date.now(),
      totalDurationMs: 0,
      totalRounds: 0,
      totalToolCalls: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      providers: [],
      requestedModels: [],
      publicModels: [],
      effectiveModels: [],
      rounds: [],
      fallback,
    }
  }

  private buildFallbackDiagnosticPayload(
    options: {
      traceId?: string
      providerId?: string
      modelId?: string
      model?: string
      toolContext: AiToolExecutionContext
    },
    error: unknown,
  ): AiTurnFallbackDiagnostics {
    const serializedError = this.serializeDiagnosticError(error)
    return {
      stage: 'answer_composer_fallback',
      traceId: options.traceId || options.toolContext.traceId || undefined,
      providerId: options.providerId || undefined,
      modelId: options.modelId || undefined,
      model: options.model || undefined,
      errorName: serializedError.name,
      errorMessage: serializedError.message,
    }
  }

  private extractErrorDiagnostics(error: unknown): AiTurnDiagnostics | undefined {
    const diagnostics = (error as { diagnostics?: AiTurnDiagnostics } | null | undefined)?.diagnostics
    if (!diagnostics || typeof diagnostics !== 'object' || !Array.isArray(diagnostics.rounds)) {
      return undefined
    }
    return diagnostics
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

}
