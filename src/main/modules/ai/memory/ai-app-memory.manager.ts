import { Injectable } from '@nestjs/common'
import {
  AiAppMemoryManifest,
  AiAppSemanticSourceFact,
  AiMemoryChangeSeverity,
  AiMemoryLevelState,
  AiSourceMemory,
  AiToolExecutionContext,
} from '../ai.types'
import { buildPermissionSafeDerivedSummary } from '../utils/ai-semantic-derived-summary.util'
import { AiAppMemoryBuilder } from './ai-app-memory.builder'
import { AI_APP_MEMORY_VERSION, AiAppMemoryDiffService } from './ai-app-memory.diff'
import { AiAppMemorySemanticService } from './ai-app-memory-semantic.service'
import { AiAppMemoryScanner, AiScannedAppSnapshot } from './ai-app-memory.scanner'
import { AiAppMemoryStore } from './ai-app-memory.store'

@Injectable()
export class AiAppMemoryManager {
  constructor(
    private readonly store: AiAppMemoryStore,
    private readonly scanner: AiAppMemoryScanner,
    private readonly diffService: AiAppMemoryDiffService,
    private readonly builder: AiAppMemoryBuilder,
    private readonly semanticService?: AiAppMemorySemanticService,
  ) {}

  async getManifest(appId: string) {
    return await this.store.readManifest(appId)
  }

  async primeCatalogMemories(appIds: string[], context: AiToolExecutionContext) {
    const normalizedIds = [...new Set(
      (Array.isArray(appIds) ? appIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]

    await Promise.all(
      normalizedIds.map(async appId => {
        try {
          await this.ensureAppMemory(appId, context, 'catalog')
        } catch {
          // Catalog priming should never block the main request flow.
        }
      }),
    )
  }

  async ensureAppMemory(
    appId: string,
    context: AiToolExecutionContext,
    target: 'catalog' | 'structure' = 'catalog',
  ) {
    const catalogResult = await this.ensureCatalogMemory(appId, context)
    if (target === 'catalog') {
      return catalogResult
    }
    return await this.ensureStructureMemory(appId, context, catalogResult.manifest)
  }

  async refreshHotspotMemory(
    appId: string,
    context: AiToolExecutionContext,
    options: {
      sourceIds?: string[]
    } = {},
  ) {
    const manifest = await this.store.readManifest(appId)
    if (!manifest) {
      return await this.ensureAppMemory(appId, context, 'structure')
    }

    const targetSourceIds = new Set(
      (Array.isArray(options.sourceIds) ? options.sourceIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )
    if (!targetSourceIds.size) {
      return {
        manifest,
        refreshedSourceIds: [] as string[],
      }
    }

    const snapshot = await this.scanner.scanApp(appId, context, 'structure', {
      enumSketchSourceIds: [...targetSourceIds],
      targetSourceIds: [...targetSourceIds],
    })
    const sourceById = new Map(snapshot.sources.map(item => [item.sourceId, item] as const))
    const existingSourceMap = await this.readSourceMemoryMap(appId, [...targetSourceIds])
    const nextManifest: AiAppMemoryManifest = {
      ...manifest,
      sourceIndex: [...manifest.sourceIndex],
    }
    const now = Date.now()
    const refreshedSourceIds: string[] = []
    const nextRecordRouteMap = new Map(
      (Array.isArray(nextManifest.routeIndex?.recordRoutes) ? nextManifest.routeIndex.recordRoutes : [])
        .map(item => [item.sourceId, item] as const),
    )

    for (let index = 0; index < nextManifest.sourceIndex.length; index += 1) {
      const sourceIndexItem = nextManifest.sourceIndex[index]
      if (!targetSourceIds.has(sourceIndexItem.sourceId)) {
        continue
      }
      const source = sourceById.get(sourceIndexItem.sourceId)
      if (!source) {
        continue
      }
      const memory = this.builder.buildStructuredSourceMemory({
        source,
        existingMemory: existingSourceMap.get(source.sourceId) || null,
        severity: 'none',
        now,
        preserveExistingEnumSketches: false,
      })
      await this.store.writeSourceMemory(appId, memory)
      nextManifest.sourceIndex[index] = this.builder.buildSourceIndexItem(memory, source.manifestKind)
      if (source.manifestKind === 'table' || source.manifestKind === 'document-table') {
        nextRecordRouteMap.set(source.sourceId, this.builder.buildRecordRouteItem(memory))
      }
      refreshedSourceIds.push(source.sourceId)
    }

    nextManifest.routeIndex = {
      recordRoutes: nextManifest.sourceIndex
        .filter(item => item.kind === 'table' || item.kind === 'document-table')
        .map(item => nextRecordRouteMap.get(item.sourceId) || this.builder.buildFallbackRecordRouteItem(item)),
    }
    nextManifest.appSummary = this.builder.buildCatalogAppSummary(snapshot, nextManifest.sourceIndex)
    nextManifest.entryPoints = this.builder.buildWarmupAwareEntryPoints(
      nextManifest.appKind,
      nextManifest.sourceIndex,
    )
    nextManifest.levels = this.buildManifestLevels(nextManifest)
    nextManifest.version = AI_APP_MEMORY_VERSION
    nextManifest.updatedAt = now
    await this.store.writeManifest(appId, nextManifest)

    return {
      manifest: nextManifest,
      refreshedSourceIds,
    }
  }

  async refreshSemanticMemory(
    appId: string,
    context: AiToolExecutionContext,
    options: {
      selectedSourceIds?: string[]
    } = {},
  ) {
    const ensured = await this.ensureAppMemory(appId, context, 'structure')
    const manifest = ensured.manifest
    const selectedSourceIds = this.normalizeSemanticSelection(manifest, options.selectedSourceIds)
    const semanticTargetSourceIds = selectedSourceIds.length
      ? selectedSourceIds
      : manifest.sourceIndex.map(item => item.sourceId)
    const scanOptions = selectedSourceIds.length
      ? {
          enumSketchSourceIds: semanticTargetSourceIds,
          targetSourceIds: semanticTargetSourceIds,
        }
      : undefined
    const snapshot = await this.scanner.scanApp(appId, context, 'structure', scanOptions)
    const sourceMemories = await this.readSourceMemoryMap(
      appId,
      semanticTargetSourceIds,
    )
    const sourceById = new Map(snapshot.sources.map(item => [item.sourceId, item] as const))
    const selectedSources = semanticTargetSourceIds
      .map(sourceId => {
        const source = sourceById.get(sourceId)
        const memory = sourceMemories.get(sourceId)
        if (!source || !memory) {
          return null
        }

        return this.buildSemanticSelectedSourcePayload(source, memory)
      })
      .filter(Boolean) as Record<string, any>[]

    this.throwIfAborted(context.signal)
    const semantic = this.semanticService
      ? await this.semanticService.analyzeAppSnapshot({
          appId: snapshot.appId,
          appName: snapshot.appName,
          appKind: snapshot.appKind,
          appSummary: snapshot.appSummary as Record<string, any>,
          viewProfile: snapshot.viewProfile as Record<string, any>,
          workflowProfile: snapshot.workflowProfile as Record<string, any>,
          sourceCatalog: manifest.sourceIndex.map(item => ({
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            kind: item.kind,
            role: item.role,
            levels: item.levels,
            viewTypes: item.viewTypes,
            hasWorkflow: item.hasWorkflow,
            rowCountBucket: item.rowCountBucket,
          })),
          selectedSourceIds: semanticTargetSourceIds,
          sources: selectedSources,
        }, {
          signal: context.signal,
        })
      : {
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
          appSourceFacts: [],
          sources: [],
        }
    this.throwIfAborted(context.signal)

    const refreshedSourceIds = await this.applySemanticSourceUpdates(
      appId,
      manifest,
      Array.isArray(semantic?.sources) ? semantic.sources : [],
      sourceMemories,
      context.signal,
    )
    this.throwIfAborted(context.signal)
    if (!refreshedSourceIds.length && semanticTargetSourceIds.length) {
      manifest.semanticProfileSourceFacts = this.mergeSemanticProfileSourceFacts(
        manifest.semanticProfileSourceFacts,
        this.buildStructureFallbackSemanticFacts(semanticTargetSourceIds, sourceMemories),
      )
    } else {
      manifest.semanticProfileSourceFacts = this.mergeSemanticProfileSourceFacts(
        manifest.semanticProfileSourceFacts,
        Array.isArray(semantic?.appSourceFacts) ? semantic.appSourceFacts : [],
      )
    }
    const semanticFacts = this.buildSemanticProfileFacts(manifest.semanticProfileSourceFacts)
    manifest.semanticProfile = this.builder.buildDefaultSemanticProfile({
      ...manifest.semanticProfile,
      ...semantic?.app,
      summary: '',
      derivedSummary: buildPermissionSafeDerivedSummary({
        relationOverview: semanticFacts.relationOverview,
        sourceRoleHints: semanticFacts.sourceRoleHints,
        sourceCount: refreshedSourceIds.length,
      }),
      relationOverview: semanticFacts.relationOverview,
      sourceRoleHints: semanticFacts.sourceRoleHints,
      confidence: Math.max(
        Number(manifest.semanticProfile?.confidence || 0),
        Number(semantic?.app?.confidence || 0),
      ),
      evidenceCount: Math.max(
        Number(manifest.semanticProfile?.evidenceCount || 0),
        refreshedSourceIds.length,
      ),
      lastVerifiedAt: Date.now(),
      generatedBy: refreshedSourceIds.length
        ? 'llm'
        : semanticFacts.relationOverview.length || semanticFacts.sourceRoleHints.length
          ? 'heuristic'
          : manifest.semanticProfile?.generatedBy,
    })
    const refreshedSourceIdSet = new Set(refreshedSourceIds)
    manifest.sourceIndex = manifest.sourceIndex.map(item => refreshedSourceIdSet.has(item.sourceId)
      ? {
          ...item,
          levels: {
            ...item.levels,
            semantic: 'ready',
          },
        }
      : item)
    manifest.levels = this.buildManifestSemanticAwareLevels(manifest)
    manifest.version = AI_APP_MEMORY_VERSION
    manifest.updatedAt = Date.now()
    this.throwIfAborted(context.signal)
    await this.store.writeManifest(appId, manifest)
    this.throwIfAborted(context.signal)

    return {
      manifest,
      refreshedSourceIds,
      selectedSourceIds: semanticTargetSourceIds,
    }
  }

  async getSourceMemory(appId: string, sourceId: string) {
    return await this.store.readSourceMemory(appId, sourceId)
  }

  async recordSourceObservation(options: {
    appId: string
    sourceId: string
    query?: string
    summary?: string
    capabilitySummary?: string
    note?: string
  }) {
    const memory = await this.store.readSourceMemory(options.appId, options.sourceId)
    if (!memory) {
      return null
    }

    const summary = this.normalizeObservationText(options.summary)
    const normalizedQuery = this.normalizeObservationText(options.query)
    const normalizedNote = this.normalizeObservationText(options.note)
    const capabilitySummary = this.normalizeObservationText(options.capabilitySummary)
    const capabilityNote = capabilitySummary ? `capability:${capabilitySummary}` : ''
    const repeatedSummary = summary && this.normalizeObservationText(memory.semanticSummary?.observedSummary) === summary
    const repeatedCapability = capabilityNote && (memory.semanticSummary?.observationNotes || []).includes(capabilityNote)
    const repeatedQuery = normalizedQuery && (memory.semanticSummary?.typicalQuestions || []).includes(normalizedQuery)
    const repeatedNote = normalizedNote && (memory.semanticSummary?.observationNotes || []).includes(normalizedNote)
    if ((repeatedSummary || repeatedCapability) && repeatedQuery && repeatedNote) {
      return memory
    }

    const nextEvidenceCount = Math.max(0, Number(memory.semanticSummary?.evidenceCount || 0)) + 1
    const nextConfidence = this.computeObservationConfidence(
      Number(memory.semanticSummary?.confidence || 0),
      nextEvidenceCount,
    )
    const nextObservedSummary = memory.semanticSummary?.observedSummary
      ? memory.semanticSummary.observedSummary
      : (summary || capabilitySummary)
    const observationNotes = this.uniqueStrings([
      ...(memory.semanticSummary?.observationNotes || []),
      capabilityNote,
      normalizedQuery,
      normalizedNote,
    ]).slice(-8)
    const typicalQuestions = this.uniqueStrings([
      ...(memory.semanticSummary?.typicalQuestions || []),
      normalizedQuery,
    ]).slice(-8)

    memory.semanticSummary = {
      typicalQuestions,
      doNotUseFor: memory.semanticSummary?.doNotUseFor || [],
      observedSummary: nextObservedSummary || '',
      observationNotes,
      evidenceCount: nextEvidenceCount,
      confidence: nextConfidence,
      lastVerifiedAt: Date.now(),
    }
    memory.levels = {
      ...memory.levels,
      semantic: nextEvidenceCount >= 3 || nextConfidence >= 0.85 ? 'ready' : 'partial',
    }
    memory.updatedAt = Date.now()
    await this.store.writeSourceMemory(options.appId, memory)
    await this.refreshManifestLevels(options.appId)
    return memory
  }

  async invalidateSemanticMemory(appId: string, reason: 'structure' | 'ai-permission' | 'version') {
    const manifest = await this.store.readManifest(appId)
    if (!manifest) {
      return null
    }

    const sourceMemories = await this.readSourceMemoryMap(
      appId,
      manifest.sourceIndex.map(item => item.sourceId),
    )
    manifest.semanticProfile = this.builder.buildDefaultSemanticProfile({
      ...manifest.semanticProfile,
      summary: '',
      derivedSummary: '',
      primaryUseCases: [],
      keyEntities: [],
      keyActions: [],
      featureTags: [],
      doNotUseFor: [],
      confidence: 0,
      evidenceCount: 0,
      generatedBy: 'heuristic',
    })
    manifest.levels = {
      ...manifest.levels,
      semantic: 'stale',
    }
    manifest.sourceIndex = manifest.sourceIndex.map(item => ({
      ...item,
      levels: { ...item.levels, semantic: 'stale' },
    }))
    for (const memory of sourceMemories.values()) {
      if (!memory) {
        continue
      }
      memory.levels = { ...memory.levels, semantic: 'stale' }
      memory.semanticSummary = {
        ...memory.semanticSummary,
        evidenceCount: 0,
        confidence: 0,
      }
      memory.updatedAt = Date.now()
      await this.store.writeSourceMemory(appId, memory)
    }
    manifest.updatedAt = Date.now()
    await this.store.writeManifest(appId, manifest)

    return { manifest, reason }
  }

  async markManifestFailed(appId: string, manifest: AiAppMemoryManifest | null, error: unknown) {
    const nextManifest: AiAppMemoryManifest = manifest || {
      appId,
      appName: appId,
      appKind: 'form',
      status: 'failed',
      levels: this.builder.buildLevels('failed', 'failed', 'failed'),
      version: AI_APP_MEMORY_VERSION,
      generatedAt: Date.now(),
      updatedAt: Date.now(),
      fingerprint: {
        metaHash: '',
        bodyHash: '',
        schemaHash: '',
      },
      appSummary: {
        purpose: '',
        domainKeywords: [],
        answerBoundaries: [],
      },
      viewProfile: {
        summary: '',
        documentViews: [],
        formViewSourceIds: [],
        tableViewSourceIds: [],
      },
      workflowProfile: {
        hasWorkflow: false,
        sourceIds: [],
        summary: '',
      },
      semanticProfile: this.builder.buildDefaultSemanticProfile(),
      semanticProfileSourceFacts: [],
      sourceIndex: [],
      routeIndex: {
        recordRoutes: [],
      },
      entryPoints: [],
      warmupState: this.builder.buildWarmupState(),
      readPolicies: this.builder.buildReadPolicies(),
    }
    nextManifest.status = 'failed'
    nextManifest.levels = this.builder.buildLevels('failed', 'failed', 'failed')
    nextManifest.updatedAt = Date.now()
    nextManifest.warmupState = {
      ...this.builder.buildWarmupState(nextManifest.warmupState),
      lastError: error instanceof Error ? error.message : String(error),
    }
    await this.store.writeManifest(appId, nextManifest)
  }

  private async ensureCatalogMemory(appId: string, context: AiToolExecutionContext) {
    const existingManifest = await this.store.readManifest(appId)
    const snapshot = await this.scanner.scanApp(appId, context, 'catalog')
    const sourceIds = this.collectSourceIds(snapshot, existingManifest)
    const existingSources = await this.readSourceMemoryMap(appId, sourceIds)
    const diff = this.diffService.plan(snapshot, existingManifest, 'catalog', {
      existingSources,
    })
    const now = Date.now()

    if (diff.mode === 'noop' && existingManifest) {
      const nextAppSummary = this.builder.buildCatalogAppSummary(
        snapshot,
        existingManifest.sourceIndex,
      )
      if (JSON.stringify(existingManifest.appSummary) !== JSON.stringify(nextAppSummary)) {
        const nextManifest = {
          ...existingManifest,
          appSummary: nextAppSummary,
          updatedAt: now,
        }
        await this.store.writeManifest(appId, nextManifest)
        return {
          manifest: nextManifest,
          diff,
        }
      }
      return {
        manifest: existingManifest,
        diff,
      }
    }

    if (diff.mode === 'rebuild') {
      await this.store.clearAppMemory(appId)
    } else {
      await this.store.removeSourceMemories(appId, diff.removedSources)
    }

    const nextSourceMemories = await Promise.all(snapshot.sources.map(async source => {
      const severity = this.findSourceSeverity(diff, source.sourceId)
      const existingSource = diff.mode === 'rebuild'
        ? null
        : (severity === 'breaking' ? null : (existingSources.get(source.sourceId) || null))
      const memory = this.builder.buildCatalogSourceMemory({
        source,
        existingMemory: existingSource,
        severity,
        now,
      })
      await this.store.writeSourceMemory(appId, memory)
      return {
        source,
        memory,
      }
    }))

    const manifest = this.builder.buildCatalogManifest({
      snapshot,
      sourceIndex: nextSourceMemories.map(({ source, memory }) => this.builder.buildSourceIndexItem(memory, source.manifestKind)),
      existingManifest: diff.mode === 'rebuild' ? null : existingManifest,
      now,
    })

    manifest.version = AI_APP_MEMORY_VERSION
    manifest.levels = this.buildManifestLevels(manifest)
    await this.store.writeManifest(appId, manifest)

    return {
      manifest,
      diff,
    }
  }

  private async ensureStructureMemory(
    appId: string,
    context: AiToolExecutionContext,
    currentManifest: AiAppMemoryManifest,
  ) {
    const snapshot = await this.scanner.scanApp(appId, context, 'structure')
    const sourceIds = this.collectSourceIds(snapshot, currentManifest)
    const existingSources = await this.readSourceMemoryMap(appId, sourceIds)
    const diff = this.diffService.plan(snapshot, currentManifest, 'structure', {
      existingSources,
    })
    const now = Date.now()
    const normalizedManifestLevels = this.buildManifestLevels(currentManifest)
    const hasManifestLevelDrift = JSON.stringify(currentManifest.levels) !== JSON.stringify(normalizedManifestLevels)
    const baseManifest = hasManifestLevelDrift
      ? {
        ...currentManifest,
        levels: normalizedManifestLevels,
        updatedAt: now,
      }
      : currentManifest

    if (diff.mode === 'noop' && baseManifest.levels.structure === 'ready') {
      if (hasManifestLevelDrift) {
        await this.store.writeManifest(appId, baseManifest)
      }
      return {
        manifest: baseManifest,
        diff,
      }
    }

    if (diff.mode === 'rebuild') {
      await this.store.clearAppMemory(appId)
    } else {
      await this.store.removeSourceMemories(appId, diff.removedSources)
    }

    const nextSourceMemories = await Promise.all(snapshot.sources.map(async source => {
      const severity = this.findSourceSeverity(diff, source.sourceId)
      const existingSource = diff.mode === 'rebuild'
        ? null
        : (severity === 'breaking' ? null : (existingSources.get(source.sourceId) || null))
      const memory = this.builder.buildStructuredSourceMemory({
        source,
        existingMemory: existingSource,
        severity,
        now,
        preserveExistingEnumSketches: true,
      })
      await this.store.writeSourceMemory(appId, memory)
      return {
        source,
        memory,
      }
    }))

    const manifest = this.builder.buildStructuredManifest({
      snapshot,
      existingManifest: diff.mode === 'rebuild' ? null : baseManifest,
      sourceIndex: nextSourceMemories.map(({ source, memory }) => this.builder.buildSourceIndexItem(memory, source.manifestKind)),
      now,
    })
    manifest.version = AI_APP_MEMORY_VERSION
    manifest.levels = this.buildManifestLevels(manifest)
    await this.store.writeManifest(appId, manifest)

    return {
      manifest,
      diff,
    }
  }

  private async refreshManifestLevels(appId: string) {
    const manifest = await this.store.readManifest(appId)
    if (!manifest) {
      return
    }

    const sourceMemoryMap = await this.readSourceMemoryMap(
      appId,
      manifest.sourceIndex.map(item => item.sourceId),
    )

    manifest.sourceIndex = manifest.sourceIndex.map(item => ({
      ...item,
      levels: sourceMemoryMap.get(item.sourceId)?.levels || item.levels,
      sourceName: sourceMemoryMap.get(item.sourceId)?.sourceName || item.sourceName,
    }))
    manifest.levels = this.buildManifestSemanticAwareLevels(manifest)
    manifest.updatedAt = Date.now()
    await this.store.writeManifest(appId, manifest)
  }

  private buildManifestLevels(manifest: AiAppMemoryManifest): AiMemoryLevelState {
    return this.buildManifestSemanticAwareLevels(manifest)
  }

  private buildManifestSemanticAwareLevels(manifest: AiAppMemoryManifest): AiMemoryLevelState {
    const levels = this.builder.buildLevels(
      this.builder.combineLevelStatuses(manifest.sourceIndex.map(item => item.levels.catalog)),
      this.builder.combineLevelStatuses(manifest.sourceIndex.map(item => item.levels.structure)),
      this.builder.combineLevelStatuses(manifest.sourceIndex.map(item => item.levels.semantic)),
    )
    const profile = manifest.semanticProfile || this.builder.buildDefaultSemanticProfile()
    const hasStableAppFacts = (profile.relationOverview || []).length > 0
      || (profile.sourceRoleHints || []).length > 0
    const hasConservativeHighLevelFields = Boolean(String(profile.summary || '').trim())
      || (profile.primaryUseCases || []).length > 0
      || (profile.keyEntities || []).length > 0
      || (profile.keyActions || []).length > 0
      || (profile.featureTags || []).length > 0
      || (profile.doNotUseFor || []).length > 0
    const hasAppSemantic = hasStableAppFacts || hasConservativeHighLevelFields
    if (!hasAppSemantic) {
      return {
        ...levels,
        semantic: levels.semantic === 'ready' ? 'partial' : levels.semantic,
      }
    }
    if (levels.semantic === 'missing') {
      return {
        ...levels,
        semantic: 'partial',
      }
    }
    return levels
  }

  private mergeSemanticProfileSourceFacts(current: any, incoming: AiAppSemanticSourceFact[]) {
    const factMap = new Map<string, AiAppSemanticSourceFact>()
    for (const item of Array.isArray(current) ? current : []) {
      const sourceId = String(item?.sourceId || '').trim()
      if (!sourceId) {
        continue
      }
      factMap.set(sourceId, {
        sourceId,
        relationFacts: this.uniqueStrings(item?.relationFacts || []),
        roleFacts: this.uniqueStrings(item?.roleFacts || []),
      })
    }
    for (const item of incoming) {
      const sourceId = String(item?.sourceId || '').trim()
      if (!sourceId) {
        continue
      }
      factMap.set(sourceId, {
        sourceId,
        relationFacts: this.uniqueStrings(item?.relationFacts || []),
        roleFacts: this.uniqueStrings(item?.roleFacts || []),
      })
    }
    return [...factMap.values()]
  }

  private buildSemanticProfileFacts(sourceFacts: Array<{ relationFacts: string[]; roleFacts: string[] }>) {
    return {
      relationOverview: this.uniqueStrings(sourceFacts.flatMap(item => item.relationFacts || [])),
      sourceRoleHints: this.uniqueStrings(sourceFacts.flatMap(item => item.roleFacts || [])),
    }
  }

  private buildStructureFallbackSemanticFacts(
    selectedSourceIds: string[],
    sourceMemories: Map<string, AiSourceMemory | null>,
  ): AiAppSemanticSourceFact[] {
    return selectedSourceIds
      .map(sourceId => {
        const memory = sourceMemories.get(sourceId)
        if (!memory) {
          return null
        }
        const relationFacts = (Array.isArray(memory.relations) ? memory.relations : [])
          .map(item => {
            const targetSourceId = String(item?.targetSourceId || '').trim()
            if (!targetSourceId) {
              return ''
            }
            return targetSourceId === memory.sourceId
              ? `${memory.sourceName} 存在自关联记录`
              : `${memory.sourceName} 关联 ${targetSourceId}`
          })
          .filter(Boolean)
        const roleFacts = this.uniqueStrings([
          memory.role === 'transaction'
            ? `${memory.sourceName} 更适合承载时间序列或业务流水记录`
            : memory.role === 'log'
              ? `${memory.sourceName} 更适合承载日志类记录`
              : `${memory.sourceName} 更适合承载主数据或实体台账`,
        ])
        if (!relationFacts.length && !roleFacts.length) {
          return null
        }
        return {
          sourceId: memory.sourceId,
          relationFacts: this.uniqueStrings(relationFacts),
          roleFacts,
        } satisfies AiAppSemanticSourceFact
      })
      .filter(Boolean) as AiAppSemanticSourceFact[]
  }

  private buildSemanticSelectedSourcePayload(
    source: AiScannedAppSnapshot['sources'][number],
    memory: AiSourceMemory,
  ) {
    return {
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      role: source.role,
      kind: source.kind,
      viewTypes: source.viewTypes,
      queryHints: memory.queryHints,
      relations: memory.relations,
      fields: memory.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        semanticType: field.semanticType,
        displayMeta: field.displayMeta,
      })),
    }
  }

  private async applySemanticSourceUpdates(
    appId: string,
    manifest: AiAppMemoryManifest,
    semanticSources: Array<Record<string, any>>,
    sourceMemories: Map<string, AiSourceMemory | null>,
    signal?: AbortSignal,
  ) {
    const refreshedSourceIds: string[] = []
    const manifestSourceIdSet = new Set(manifest.sourceIndex.map(item => item.sourceId))
    for (const item of semanticSources) {
      this.throwIfAborted(signal)
      const sourceId = String(item?.sourceId || '').trim()
      if (!sourceId || !manifestSourceIdSet.has(sourceId)) {
        continue
      }
      const memory = sourceMemories.get(sourceId)
      if (!memory) {
        continue
      }
      memory.semanticSummary = {
        ...memory.semanticSummary,
        observedSummary: String(item?.observedSummary || '').trim(),
        typicalQuestions: this.uniqueStrings(item?.typicalQuestions || []),
        doNotUseFor: this.uniqueStrings(item?.doNotUseFor || []),
        evidenceCount: Math.max(
          Number(memory.semanticSummary?.evidenceCount || 0),
          Number(item?.evidenceCount || 1),
        ),
        confidence: Math.max(
          Number(memory.semanticSummary?.confidence || 0),
          Number(item?.confidence || 0),
        ),
        lastVerifiedAt: Date.now(),
      }
      memory.levels = {
        ...memory.levels,
        semantic: Number(item?.confidence || 0) >= 0.6 ? 'ready' : 'partial',
      }
      memory.updatedAt = Date.now()
      this.throwIfAborted(signal)
      await this.store.writeSourceMemory(appId, memory)
      this.throwIfAborted(signal)
      refreshedSourceIds.push(memory.sourceId)
    }
    return refreshedSourceIds
  }

  private normalizeSemanticSelection(manifest: AiAppMemoryManifest, selectedSourceIds?: string[]) {
    const allowedSourceIds = new Set(
      manifest.sourceIndex
        .map(item => String(item.sourceId || '').trim())
        .filter(Boolean),
    )
    const normalized = (Array.isArray(selectedSourceIds) ? selectedSourceIds : [])
      .map(item => String(item || '').trim())
      .filter(item => allowedSourceIds.has(item))
    return [...new Set(normalized)]
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return
    }
    const error = new Error('This operation was aborted')
    error.name = 'AbortError'
    throw error
  }

  private async readSourceMemoryMap(appId: string, sourceIds: string[]) {
    const entries = await Promise.all(
      [...new Set(sourceIds)].map(async sourceId => [sourceId, await this.store.readSourceMemory(appId, sourceId)] as const),
    )
    return new Map(entries)
  }

  private collectSourceIds(snapshot: AiScannedAppSnapshot, manifest?: AiAppMemoryManifest | null) {
    return [
      ...snapshot.sources.map(item => item.sourceId),
      ...(manifest?.sourceIndex || []).map(item => item.sourceId),
    ]
  }

  private findSourceSeverity(diff: { sourceDiffs?: Array<{ sourceId: string; severity: AiMemoryChangeSeverity }> }, sourceId: string) {
    return diff.sourceDiffs?.find(item => item.sourceId === sourceId)?.severity || 'none'
  }

  private computeObservationConfidence(currentConfidence: number, evidenceCount: number) {
    const base = Math.max(0, Math.min(1, Number(currentConfidence || 0)))
    const target = Math.min(1, 0.2 + evidenceCount * 0.22)
    return Math.max(base, Math.round(target * 100) / 100)
  }

  private normalizeObservationText(value?: string | null) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  private uniqueStrings(values: Array<string | undefined>) {
    return [...new Set(
      values
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
  }
}
