import { Injectable } from '@nestjs/common'
import { AiConfigService } from '../config/ai-config.service'
import { isAiRuntimeUserActionableError } from '../errors/ai-runtime-error'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiOpenAiService } from '../openai/ai-openai.service'

@Injectable()
export class AiAppMemorySemanticService {
  private static readonly STRUCTURED_JSON_TIMEOUT_MS = 90000

  constructor(
    private readonly aiConfigService: AiConfigService,
    private readonly openAiService: AiOpenAiService,
    private readonly agentLogService: AiAgentLogService,
  ) {
    void this.agentLogService
  }

  async analyzeAppSnapshot(input: {
    appId: string
    appName: string
    appKind: string
    appSummary: Record<string, any>
    viewProfile: Record<string, any>
    workflowProfile: Record<string, any>
    sourceCatalog: Array<{ sourceId: string }>
    selectedSourceIds: string[]
    sources: Record<string, any>[]
  }, options: { signal?: AbortSignal } = {}) {
    this.throwIfAborted(options.signal)
    const featureFlags = await this.aiConfigService.getFeatureFlags()
    this.throwIfAborted(options.signal)
    if (featureFlags.semanticWarmupEnabled === false) {
      return this.buildEmptySemanticOutput(input)
    }

    const prompt = this.buildSemanticPrompt(input)
    let raw: any
    try {
      raw = await this.requestSemanticJson(prompt, options)
    } catch (error) {
      if (isAiRuntimeUserActionableError(error) && error.code === 'AI_RUNTIME_PURPOSE_UNAVAILABLE') {
        return this.buildEmptySemanticOutput(input)
      }
      throw error
    }
    this.throwIfAborted(options.signal)
    return this.normalizeSemanticOutput(raw, input)
  }

  private buildEmptySemanticOutput(input: {
    sourceCatalog: Array<{ sourceId: string }>
    selectedSourceIds: string[]
    sources: Array<{ sourceId?: string } | Record<string, any>>
  }) {
    const allowedSourceIds = new Set(
      (Array.isArray(input.sourceCatalog) ? input.sourceCatalog : [])
        .map(item => String(item?.sourceId || '').trim())
        .filter(Boolean),
    )
    const selectedSourceIds = (Array.isArray(input.selectedSourceIds) ? input.selectedSourceIds : [])
      .map(item => String(item || '').trim())
      .filter(sourceId => sourceId && allowedSourceIds.has(sourceId))
    const selectedSourceIdSet = new Set(selectedSourceIds)

    return {
      app: {
        summary: '',
        primaryUseCases: [],
        keyEntities: [],
        keyActions: [],
        featureTags: [],
        relationOverview: [],
        sourceRoleHints: [],
        doNotUseFor: [],
        confidence: 0,
      },
      appSourceFacts: selectedSourceIds.map(sourceId => ({
        sourceId,
        relationFacts: [],
        roleFacts: [],
      })),
      sources: (Array.isArray(input.sources) ? input.sources : [])
        .filter(item => selectedSourceIdSet.has(String(item?.sourceId || '').trim()))
        .map(item => ({
          sourceId: item.sourceId,
          observedSummary: '',
          typicalQuestions: [],
          doNotUseFor: [],
          confidence: 0,
        })),
    }
  }

  private buildSemanticPrompt(input: Record<string, any>) {
    const selectedSourceIds = (Array.isArray(input.selectedSourceIds) ? input.selectedSourceIds : [])
      .map((item: any) => String(item || '').trim())
      .filter(Boolean)
    const sourceCatalog = (Array.isArray(input.sourceCatalog) ? input.sourceCatalog : [])
      .map((item: any) => ({
        sourceId: item?.sourceId,
        sourceName: item?.sourceName,
        kind: item?.kind,
        role: item?.role,
        viewTypes: item?.viewTypes,
        hasWorkflow: item?.hasWorkflow,
        rowCountBucket: item?.rowCountBucket,
      }))
    const selectedSources = (Array.isArray(input.sources) ? input.sources : [])
      .map((source: any) => ({
        sourceId: source?.sourceId,
        sourceName: source?.sourceName,
        role: source?.role,
        kind: source?.kind,
        viewTypes: source?.viewTypes,
        queryHints: source?.queryHints,
        relations: source?.relations,
        fields: Array.isArray(source?.fields)
          ? source.fields.map((field: any) => ({
              id: field?.id,
              name: field?.name,
              type: field?.type,
              semanticType: field?.semanticType,
              displayMeta: field?.displayMeta,
            }))
          : [],
      }))
    return [
      'Return valid JSON for semantic warmup.',
      'Only produce source-bound facts that can be traced to selectedSources.',
      'Return these top-level keys only: appSourceFacts, sources.',
      'appSourceFacts items: { sourceId, relationFacts, roleFacts }.',
      'sources items: { sourceId, observedSummary, typicalQuestions, sourceLimits, confidence }.',
      'Use sourceLimits for source-level situations where the source should not be used.',
      'Do not return routing guidance, recommended next calls, raw record values, high-level app summaries, or markdown.',
      JSON.stringify({
        appId: input.appId,
        appName: input.appName,
        appKind: input.appKind,
        appSummary: input.appSummary,
        viewProfile: input.viewProfile,
        workflowProfile: input.workflowProfile,
        sourceCatalog,
        selectedSourceIds,
        selectedSources,
      }),
    ].join('\n')
  }

  private async requestSemanticJson(prompt: string, options: { signal?: AbortSignal } = {}) {
    return await this.openAiService.invokeStructuredJson({
      purpose: 'ai-semantic-warmup',
      prompt,
      reasoningLevel: 'low',
      timeoutMs: AiAppMemorySemanticService.STRUCTURED_JSON_TIMEOUT_MS,
      signal: options.signal,
    })
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return
    }
    const error = new Error('This operation was aborted')
    error.name = 'AbortError'
    throw error
  }

  private normalizeSemanticOutput(raw: any, input: Record<string, any>) {
    const allowedSourceIds = new Set(
      (Array.isArray(input.sourceCatalog) ? input.sourceCatalog : [])
        .map((item: any) => String(item?.sourceId || '').trim())
        .filter(Boolean),
    )
    const selectedSourceIds = new Set(
      (Array.isArray(input.selectedSourceIds) ? input.selectedSourceIds : [])
        .map((item: any) => String(item || '').trim())
        .filter(Boolean),
    )
    const appSourceFacts = (Array.isArray(raw?.appSourceFacts) ? raw.appSourceFacts : [])
      .map((item: any) => ({
        sourceId: String(item?.sourceId || '').trim(),
        relationFacts: this.readStringList(item?.relationFacts),
        roleFacts: this.readStringList(item?.roleFacts),
      }))
      .filter((item: any) =>
        item.sourceId
        && allowedSourceIds.has(item.sourceId)
        && selectedSourceIds.has(item.sourceId),
      )
    const relationOverview = this.uniqueStrings(appSourceFacts.flatMap((item: any) => item.relationFacts || []))
    const sourceRoleHints = this.uniqueStrings(appSourceFacts.flatMap((item: any) => item.roleFacts || []))
    const canKeepHighLevelAppFields = false

    return {
      app: {
        summary: canKeepHighLevelAppFields ? String(raw?.app?.summary || '').trim() : '',
        primaryUseCases: canKeepHighLevelAppFields ? this.readStringList(raw?.app?.primaryUseCases) : [],
        keyEntities: canKeepHighLevelAppFields ? this.readStringList(raw?.app?.keyEntities) : [],
        keyActions: canKeepHighLevelAppFields ? this.readStringList(raw?.app?.keyActions) : [],
        featureTags: canKeepHighLevelAppFields ? this.readStringList(raw?.app?.featureTags) : [],
        relationOverview,
        sourceRoleHints,
        doNotUseFor: canKeepHighLevelAppFields ? this.readStringList(raw?.app?.doNotUseFor) : [],
        confidence: Math.max(0, Math.min(1, Number(raw?.app?.confidence || 0))),
      },
      appSourceFacts,
      sources: (Array.isArray(raw?.sources) ? raw.sources : [])
        .map((item: any) => ({
          sourceId: String(item?.sourceId || '').trim(),
          observedSummary: String(item?.observedSummary || '').trim(),
          typicalQuestions: this.readStringList(item?.typicalQuestions),
          doNotUseFor: this.readStringList(Array.isArray(item?.doNotUseFor) ? item.doNotUseFor : item?.sourceLimits),
          confidence: Math.max(0, Math.min(1, Number(item?.confidence || 0))),
        }))
        .filter((item: any) =>
          item.sourceId
          && allowedSourceIds.has(item.sourceId)
          && selectedSourceIds.has(item.sourceId),
        ),
    }
  }

  private uniqueStrings(values: any[]) {
    return [...new Set(
      values
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
  }

  private readStringList(value: any) {
    return this.uniqueStrings(Array.isArray(value) ? value : [])
  }
}
