import { Injectable } from '@nestjs/common'
import {
  AI_APP_MEMORY_WARMUP_CONTEXT_STRATEGIES,
  AI_APP_MEMORY_WARMUP_SKIP_REASONS,
  AI_SEMANTIC_BOOTSTRAP_PENDING_SOURCE_SCOPE_LIMIT,
  AI_SEMANTIC_BOOTSTRAP_PENDING_REASONS,
  AiAppEntryPoint,
  AiAppKind,
  AiAppMemoryManifest,
  AiAppMemoryWarmupContextStrategy,
  AiAppMemoryWarmupSkipReason,
  AiAppSemanticProfile,
  AiAppSemanticSourceFact,
  AiAppMemoryWarmupState,
  AiMemoryChangeSeverity,
  AiMemoryLevelState,
  AiMemoryLevelStatus,
  AiSemanticBootstrapPending,
  AiSemanticBootstrapPendingReason,
  AiSemanticDeepHitWatermark,
  AiSourceMemory,
} from '../ai.types'
import { AI_APP_MEMORY_VERSION } from './ai-app-memory.diff'
import { AiScannedAppSnapshot, AiScannedSourceSnapshot } from './ai-app-memory.scanner'

@Injectable()
export class AiAppMemoryBuilder {
  buildCatalogManifest(options: {
    snapshot: AiScannedAppSnapshot
    sourceIndex: AiAppMemoryManifest['sourceIndex']
    existingManifest?: AiAppMemoryManifest | null
    now?: number
  }): AiAppMemoryManifest {
    const now = options.now || Date.now()
    return {
      appId: options.snapshot.appId,
      appName: options.snapshot.appName,
      appKind: options.snapshot.appKind,
      status: 'ready',
      levels: this.buildLevels(
        'ready',
        options.existingManifest?.levels?.structure || 'missing',
        options.existingManifest?.levels?.semantic || 'missing',
      ),
      version: AI_APP_MEMORY_VERSION,
      generatedAt: options.existingManifest?.generatedAt || now,
      updatedAt: now,
      fingerprint: options.snapshot.fingerprint,
      appSummary: this.buildCatalogAppSummary(options.snapshot, options.sourceIndex),
      viewProfile: options.snapshot.viewProfile,
      workflowProfile: options.snapshot.workflowProfile,
      semanticProfile: this.buildDefaultSemanticProfile(options.existingManifest?.semanticProfile),
      semanticProfileSourceFacts: this.buildDefaultSemanticSourceFacts(
        options.existingManifest?.semanticProfileSourceFacts,
      ),
      sourceIndex: options.sourceIndex,
      routeIndex: options.existingManifest?.routeIndex || {
        recordRoutes: [],
      },
      entryPoints: this.buildWarmupAwareEntryPoints(
        options.snapshot.appKind,
        options.sourceIndex,
      ),
      warmupState: this.buildWarmupState(options.existingManifest?.warmupState),
      readPolicies: this.buildReadPolicies(),
    }
  }

  buildStructuredManifest(options: {
    snapshot: AiScannedAppSnapshot
    existingManifest?: AiAppMemoryManifest | null
    sourceIndex: AiAppMemoryManifest['sourceIndex']
    now?: number
  }): AiAppMemoryManifest {
    const now = options.now || Date.now()
    const appCatalog = this.combineLevelStatuses(
      options.sourceIndex.map(item => item.levels.catalog),
    )
    const appStructure = this.combineLevelStatuses(
      options.sourceIndex.map(item => item.levels.structure),
    )
    const appSemantic = this.combineLevelStatuses(
      options.sourceIndex.map(item => item.levels.semantic),
    )

    return {
      appId: options.snapshot.appId,
      appName: options.snapshot.appName,
      appKind: options.snapshot.appKind,
      status: 'ready',
      levels: this.buildLevels(appCatalog, appStructure, appSemantic),
      version: AI_APP_MEMORY_VERSION,
      generatedAt: options.existingManifest?.generatedAt || now,
      updatedAt: now,
      fingerprint: options.snapshot.fingerprint,
      appSummary: this.buildCatalogAppSummary(options.snapshot, options.sourceIndex),
      viewProfile: options.snapshot.viewProfile,
      workflowProfile: options.snapshot.workflowProfile,
      semanticProfile: this.buildDefaultSemanticProfile(options.existingManifest?.semanticProfile),
      semanticProfileSourceFacts: this.buildDefaultSemanticSourceFacts(
        options.existingManifest?.semanticProfileSourceFacts,
      ),
      sourceIndex: options.sourceIndex,
      routeIndex: {
        recordRoutes: options.sourceIndex
          .filter(source => source.kind === 'table' || source.kind === 'document-table')
          .map(source => {
            const snapshotSource = options.snapshot.sources.find(item => item.sourceId === source.sourceId)
            return snapshotSource
              ? this.buildRecordRouteItem(snapshotSource)
              : this.buildFallbackRecordRouteItem(source)
          }),
      },
      entryPoints: this.buildWarmupAwareEntryPoints(
        options.snapshot.appKind,
        options.sourceIndex,
      ),
      warmupState: this.buildWarmupState(options.existingManifest?.warmupState),
      readPolicies: this.buildReadPolicies(),
    }
  }

  buildDefaultSemanticProfile(current?: Partial<AiAppSemanticProfile> | null): AiAppSemanticProfile {
    return {
      summary: String(current?.summary || '').trim(),
      derivedSummary: String(current?.derivedSummary || '').trim(),
      businessDomain: String(current?.businessDomain || '').trim() || undefined,
      primaryUseCases: this.uniqueStrings(current?.primaryUseCases || []),
      keyEntities: this.uniqueStrings(current?.keyEntities || []),
      keyActions: this.uniqueStrings(current?.keyActions || []),
      featureTags: this.uniqueStrings(current?.featureTags || []),
      relationOverview: this.uniqueStrings(current?.relationOverview || []),
      sourceRoleHints: this.uniqueStrings(current?.sourceRoleHints || []),
      doNotUseFor: this.uniqueStrings(current?.doNotUseFor || []),
      confidence: Math.max(0, Math.min(1, Number(current?.confidence || 0))),
      evidenceCount: Math.max(0, Math.round(Number(current?.evidenceCount || 0))),
      lastVerifiedAt: Number(current?.lastVerifiedAt || 0) || undefined,
      generatedBy: current?.generatedBy === 'llm' || current?.generatedBy === 'llm+verified'
        ? current.generatedBy
        : 'heuristic',
    }
  }

  buildDefaultSemanticSourceFacts(current?: Array<Partial<AiAppSemanticSourceFact>> | null): AiAppSemanticSourceFact[] {
    const facts = Array.isArray(current) ? current : []
    return facts
      .map(item => ({
        sourceId: String(item?.sourceId || '').trim(),
        relationFacts: this.uniqueStrings(item?.relationFacts || []),
        roleFacts: this.uniqueStrings(item?.roleFacts || []),
      }))
      .filter(item => item.sourceId)
  }

  buildCatalogSourceMemory(options: {
    source: AiScannedSourceSnapshot
    existingMemory?: AiSourceMemory | null
    severity?: AiMemoryChangeSeverity
    now?: number
  }): AiSourceMemory {
    const now = options.now || Date.now()
    const severity = options.severity || 'none'
    const existingMemory = options.existingMemory || null

    return {
      sourceId: options.source.sourceId,
      sourceName: options.source.sourceName,
      kind: existingMemory?.kind || options.source.kind,
      role: options.source.role,
      levels: this.buildLevels(
        'ready',
        this.resolveStructureStatusForCatalog(existingMemory?.levels?.structure, severity),
        this.resolveSemanticStatusForChange(existingMemory?.levels?.semantic, severity),
      ),
      catalogFingerprint: options.source.catalogFingerprint,
      structureFingerprint: existingMemory?.structureFingerprint,
      updatedAt: now,
      description: existingMemory?.description || `数据源“${options.source.sourceName}”包含 ${options.source.fields.length} 个字段。`,
      viewTypes: options.source.viewTypes || [],
      hasWorkflow: Boolean(options.source.hasWorkflow),
      dataProfile: this.mergeSourceDataProfile(
        options.source.dataProfile,
        existingMemory?.dataProfile,
        options.source.fields,
        true,
      ),
      fields: options.source.fields,
      relations: existingMemory?.relations || [],
      queryHints: options.source.queryHints,
      semanticSummary: {
        typicalQuestions: existingMemory?.semanticSummary?.typicalQuestions || [],
        doNotUseFor: existingMemory?.semanticSummary?.doNotUseFor || [],
        observedSummary: existingMemory?.semanticSummary?.observedSummary || '',
        observationNotes: existingMemory?.semanticSummary?.observationNotes || [],
        evidenceCount: Number(existingMemory?.semanticSummary?.evidenceCount || 0),
        confidence: this.adjustConfidence(
          Number(existingMemory?.semanticSummary?.confidence || 0),
          severity,
        ),
        lastVerifiedAt: existingMemory?.semanticSummary?.lastVerifiedAt,
      },
    }
  }

  buildCatalogAppSummary(
    snapshot: AiScannedAppSnapshot,
    sourceIndex: AiAppMemoryManifest['sourceIndex'],
  ) {
    const businessKeywords = this.buildAppBusinessKeywordPool(
      [
        ...(Array.isArray(snapshot?.appSummary?.domainKeywords) ? snapshot.appSummary.domainKeywords : []),
        snapshot?.appName || '',
      ],
      sourceIndex,
      Array.isArray(snapshot?.sources) ? snapshot.sources : [],
    )

    return {
      purpose: snapshot.appSummary?.purpose
        || `应用“${snapshot.appName}”当前包含 ${sourceIndex.length} 个可读数据源。`,
      domainKeywords: businessKeywords.slice(0, 24),
      answerBoundaries: this.uniqueStrings([
        ...(Array.isArray(snapshot?.appSummary?.answerBoundaries) ? snapshot.appSummary.answerBoundaries : []),
        '当前应用 AI 只查询表单记录和聚合数据。',
      ]).slice(0, 12),
    }
  }

  buildStructuredSourceMemory(options: {
    source: AiScannedSourceSnapshot
    existingMemory?: AiSourceMemory | null
    severity?: AiMemoryChangeSeverity
    now?: number
    preserveExistingEnumSketches?: boolean
  }): AiSourceMemory {
    const now = options.now || Date.now()
    const severity = options.severity || 'none'
    const existingMemory = options.existingMemory || null

    return {
      sourceId: options.source.sourceId,
      sourceName: options.source.sourceName,
      kind: options.source.kind,
      role: options.source.role,
      levels: this.buildLevels(
        'ready',
        'ready',
        this.resolveSemanticStatusForStructuredSource(existingMemory?.levels?.semantic, severity, options.source),
      ),
      catalogFingerprint: options.source.catalogFingerprint,
      structureFingerprint: options.source.structureFingerprint,
      updatedAt: now,
      description: options.source.description,
      viewTypes: options.source.viewTypes || [],
      hasWorkflow: Boolean(options.source.hasWorkflow),
      dataProfile: this.mergeSourceDataProfile(
        options.source.dataProfile,
        existingMemory?.dataProfile,
        options.source.fields,
        Boolean(options.preserveExistingEnumSketches),
      ),
      fields: options.source.fields,
      relations: options.source.relations,
      queryHints: options.source.queryHints,
      semanticSummary: {
        typicalQuestions: this.uniqueStrings([
          ...options.source.semanticSummary.typicalQuestions,
          ...(existingMemory?.semanticSummary?.typicalQuestions || []),
        ]),
        doNotUseFor: options.source.semanticSummary.doNotUseFor || existingMemory?.semanticSummary?.doNotUseFor || [],
        observedSummary: existingMemory?.semanticSummary?.observedSummary || '',
        observationNotes: existingMemory?.semanticSummary?.observationNotes || [],
        evidenceCount: Number(existingMemory?.semanticSummary?.evidenceCount || 0),
        confidence: Math.max(
          options.source.semanticSummary.confidence || 0,
          this.adjustConfidence(
            Number(existingMemory?.semanticSummary?.confidence || 0),
            severity,
          ),
        ),
        lastVerifiedAt: existingMemory?.semanticSummary?.lastVerifiedAt,
      },
    }
  }

  buildSourceIndexItem(
    sourceMemory: AiSourceMemory,
    manifestKind: AiAppMemoryManifest['sourceIndex'][number]['kind'] = 'table',
  ): AiAppMemoryManifest['sourceIndex'][number] {
    return {
      sourceId: sourceMemory.sourceId,
      sourceName: sourceMemory.sourceName,
      kind: manifestKind,
      role: sourceMemory.role,
      levels: sourceMemory.levels,
      catalogFingerprint: sourceMemory.catalogFingerprint,
      structureFingerprint: sourceMemory.structureFingerprint,
      viewTypes: sourceMemory.viewTypes || [],
      hasWorkflow: Boolean(sourceMemory.hasWorkflow),
      rowCountBucket: sourceMemory.dataProfile?.rowCountBucket || 'unknown',
    }
  }

  buildReadPolicies() {
    return {
      clarifyRules: [
        '当命中多个应用且当前没有显式选中应用时，应先向用户确认应用。',
        '当存在多个可读数据源且目标仍不明确时，应先确认目标再读。',
      ],
      recordLookupRules: [
        '统计、筛选、分组、前 N、时间趋势这类问题，应优先使用记录型数据源。',
        '文档视图也按底层表单记录处理，不走正文阅读路径。',
      ],
      aggregationRules: [
        '聚合统计属于记录型读取，应通过 aggregate 模式完成。',
      ],
      fallbackRules: [
        '在选择数据源之前，先确保至少已有基础目录记忆。',
        '在真正路由读数请求之前，应先补齐到结构层记忆。',
        '语义记忆只能来自已验证的读取结果，不能靠猜测写入。',
      ],
    }
  }

  buildRecordRouteItem(
    source: Pick<AiSourceMemory, 'sourceId' | 'sourceName' | 'role' | 'fields' | 'dataProfile' | 'queryHints' | 'semanticSummary'>,
  ): AiAppMemoryManifest['routeIndex']['recordRoutes'][number] {
    return {
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      role: source.role,
      keywords: this.buildRecordRouteKeywords(source),
      entityFields: source.queryHints.entityFields || [],
      timeFields: source.queryHints.timeFields || [],
      metricFields: source.queryHints.metricFields || [],
    }
  }

  buildFallbackRecordRouteItem(
    source: Pick<AiAppMemoryManifest['sourceIndex'][number], 'sourceId' | 'sourceName' | 'role'>,
  ): AiAppMemoryManifest['routeIndex']['recordRoutes'][number] {
    return {
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      role: source.role,
      keywords: [source.sourceName],
      entityFields: [],
      timeFields: [],
      metricFields: [],
    }
  }

  buildRecordRouteKeywords(
    source: Pick<AiSourceMemory, 'sourceName' | 'fields' | 'dataProfile' | 'role' | 'queryHints' | 'semanticSummary'>,
  ) {
    return this.buildBusinessKeywordCandidates(source).slice(0, 48)
  }

  combineLevelStatuses(values: AiMemoryLevelStatus[]) {
    const normalized = values.filter(Boolean)
    if (!normalized.length) {
      return 'missing'
    }
    if (normalized.includes('failed')) {
      return 'failed'
    }
    if (normalized.includes('stale')) {
      return 'stale'
    }
    if (normalized.every(item => item === 'ready')) {
      return 'ready'
    }
    if (normalized.every(item => item === 'missing')) {
      return 'missing'
    }
    return 'partial'
  }

  buildLevels(
    catalog: AiMemoryLevelStatus,
    structure: AiMemoryLevelStatus,
    semantic: AiMemoryLevelStatus,
  ): AiMemoryLevelState {
    return {
      catalog,
      structure,
      semantic,
    }
  }

  buildWarmupState(current?: AiAppMemoryWarmupState | null): AiAppMemoryWarmupState {
    const pending = this.buildSemanticBootstrapPending(current?.semanticBootstrapPending)
    const deepHitWatermark = this.buildSemanticDeepHitWatermark(current?.phases?.deep?.hitWatermark)
    const deepStatus = current?.phases?.deep?.status || 'missing'
    const deepRetryCount = Math.max(0, Number(current?.phases?.deep?.retryCount || 0)) || undefined
    const deepNextRetryAt = Number(current?.phases?.deep?.nextRetryAt || 0) || undefined
    const deepContextStrategy = this.normalizeDeepContextStrategy(current?.phases?.deep?.contextStrategy)
    const deepSkipReason = this.normalizeDeepSkipReason(current?.phases?.deep?.skipReason)
    const buildPhaseRetryBackoff = (phase: AiAppMemoryWarmupState['phases'][keyof AiAppMemoryWarmupState['phases']]) => ({
      retryCount: Math.max(0, Number(phase?.retryCount || 0)) || undefined,
      nextRetryAt: Number(phase?.nextRetryAt || 0) || undefined,
    })
    return {
      phases: {
        catalog: {
          status: current?.phases?.catalog?.status || 'missing',
          updatedAt: Number(current?.phases?.catalog?.updatedAt || 0) || undefined,
          durationMs: Number(current?.phases?.catalog?.durationMs || 0) || undefined,
          lastError: String(current?.phases?.catalog?.lastError || '').trim() || undefined,
          taskKey: String(current?.phases?.catalog?.taskKey || '').trim() || undefined,
          fingerprint: String(current?.phases?.catalog?.fingerprint || '').trim() || undefined,
          ...buildPhaseRetryBackoff(current?.phases?.catalog),
        },
        profile: {
          status: current?.phases?.profile?.status || 'missing',
          updatedAt: Number(current?.phases?.profile?.updatedAt || 0) || undefined,
          durationMs: Number(current?.phases?.profile?.durationMs || 0) || undefined,
          lastError: String(current?.phases?.profile?.lastError || '').trim() || undefined,
          taskKey: String(current?.phases?.profile?.taskKey || '').trim() || undefined,
          fingerprint: String(current?.phases?.profile?.fingerprint || '').trim() || undefined,
          ...buildPhaseRetryBackoff(current?.phases?.profile),
        },
        deep: {
          status: deepStatus,
          updatedAt: Number(current?.phases?.deep?.updatedAt || 0) || undefined,
          durationMs: deepStatus === 'missing'
            ? undefined
            : Number(current?.phases?.deep?.durationMs || 0) || undefined,
          lastError: deepStatus === 'missing'
            ? undefined
            : String(current?.phases?.deep?.lastError || '').trim() || undefined,
          taskKey: deepStatus === 'missing'
            ? undefined
            : String(current?.phases?.deep?.taskKey || '').trim() || undefined,
          fingerprint: String(current?.phases?.deep?.fingerprint || '').trim() || undefined,
          retryCount: deepStatus === 'missing' ? undefined : deepRetryCount,
          nextRetryAt: deepStatus === 'missing' ? undefined : deepNextRetryAt,
          hitWatermark: deepStatus === 'missing' ? undefined : deepHitWatermark || undefined,
          reasonCode: deepStatus === 'missing' ? undefined : current?.phases?.deep?.reasonCode || undefined,
          scheduleReason: deepStatus === 'missing' ? undefined : current?.phases?.deep?.scheduleReason || undefined,
          eligibleSourceCount: deepStatus === 'missing'
            ? undefined
            : Number.isFinite(Number(current?.phases?.deep?.eligibleSourceCount))
              ? Number(current?.phases?.deep?.eligibleSourceCount)
              : undefined,
          nonEligibleReason: deepStatus === 'missing'
            ? undefined
            : current?.phases?.deep?.nonEligibleReason || undefined,
          requestedSourceCount: deepStatus === 'missing'
            ? undefined
            : this.normalizeOptionalCount(current?.phases?.deep?.requestedSourceCount),
          mergedSourceCount: deepStatus === 'missing'
            ? undefined
            : this.normalizeOptionalCount(current?.phases?.deep?.mergedSourceCount),
          selectedSourceCount: deepStatus === 'missing'
            ? undefined
            : this.normalizeOptionalCount(current?.phases?.deep?.selectedSourceCount),
          contextStrategy: deepStatus === 'missing' ? undefined : deepContextStrategy,
          skipReason: deepStatus === 'missing' ? undefined : deepSkipReason,
        },
      },
      queueDepth: Number(current?.queueDepth || 0) || undefined,
      lastWarmAt: Number(current?.lastWarmAt || 0) || undefined,
      lastError: String(current?.lastError || '').trim() || undefined,
      semanticBootstrapPending: pending || undefined,
    }
  }

  private buildSemanticDeepHitWatermark(
    current?: AiSemanticDeepHitWatermark | null,
  ): AiSemanticDeepHitWatermark | undefined {
    if (!current) {
      return undefined
    }
    const lastHitAt = Number(current.lastHitAt || 0)
    if (!lastHitAt) {
      return undefined
    }
    return {
      lastHitAt,
      exposureHits: Math.max(0, Number(current.exposureHits || 0)),
      confirmedHits: Math.max(0, Number(current.confirmedHits || 0)),
      memoryHits: Math.max(0, Number(current.memoryHits || 0)),
      readHits: Math.max(0, Number(current.readHits || 0)),
    }
  }

  buildEntryPoints(
    appKind: AiAppKind,
    sourceIndex: AiAppMemoryManifest['sourceIndex'],
  ): AiAppEntryPoint[] {
    void appKind
    const recordEntries = sourceIndex
      .filter(source => source.kind === 'table' || source.kind === 'document-table')
      .map((source, index) => ({
        mode: 'records' as const,
        targetType: 'source' as const,
        targetId: source.sourceId,
        label: source.sourceName,
        summary: source.hasWorkflow
          ? `${source.sourceName} 适合记录查询，也常用于提交流程和审批跟踪。`
          : `${source.sourceName} 适合记录查询、筛选和统计。`,
        priority: Math.max(10, 80 - index),
      }))

    return recordEntries.slice(0, 8)
  }

  buildWarmupAwareEntryPoints(
    appKind: AiAppKind,
    sourceIndex: AiAppMemoryManifest['sourceIndex'],
  ): AiAppEntryPoint[] {
    const recordEntries = sourceIndex
      .filter(source => source.kind === 'table' || source.kind === 'document-table')
      .sort((left, right) =>
        this.computeRecordEntryPriority(right) - this.computeRecordEntryPriority(left)
        || left.sourceName.localeCompare(right.sourceName, 'zh-CN'),
      )
      .map((source, index) => ({
        mode: 'records' as const,
        targetType: 'source' as const,
        targetId: source.sourceId,
        label: source.sourceName,
        summary: this.buildRecordEntrySummary(source, appKind),
        priority: Math.max(10, 80 - index),
      }))

    return recordEntries.slice(0, 8)
  }

  private buildRecordEntrySummary(
    source: AiAppMemoryManifest['sourceIndex'][number],
    appKind: AiAppKind,
  ) {
    const parts = [
      `${source.sourceName} 适合记录查询`,
      source.rowCountBucket === 'large' || source.rowCountBucket === 'huge'
        ? '统计汇总'
        : '明细筛选',
      source.hasWorkflow ? '提交流程和审批跟踪' : '',
      appKind === 'document' && source.kind === 'document-table'
        ? '文档视图按记录读取'
        : '',
    ].filter(Boolean)
    return `${parts.join('、')}。`
  }

  private computeRecordEntryPriority(source: AiAppMemoryManifest['sourceIndex'][number]) {
    let score = 0
    if (source.hasWorkflow) score += 8
    if (source.role === 'transaction') score += 6
    if (source.role === 'master') score += 4
    if (source.viewTypes.includes('document')) score += 4
    if (source.viewTypes.includes('form')) score += 3
    if (source.viewTypes.includes('table')) score += 2
    switch (source.rowCountBucket) {
      case 'huge':
        score += 4
        break
      case 'large':
        score += 3
        break
      case 'medium':
        score += 2
        break
      case 'small':
        score += 1
        break
      default:
        break
    }
    return score
  }

  adjustConfidence(previousConfidence: number, severity: AiMemoryChangeSeverity) {
    const normalized = Math.max(0, Math.min(1, Number(previousConfidence || 0)))
    if (severity === 'meta' || severity === 'none') {
      return normalized
    }
    if (severity === 'additive') {
      return Math.max(0.2, Math.round(normalized * 80) / 100)
    }
    if (severity === 'breaking') {
      return Math.max(0.1, Math.round(normalized * 55) / 100)
    }
    return 0
  }

  resolveSemanticStatusForChange(
    currentStatus: AiMemoryLevelStatus | undefined,
    severity: AiMemoryChangeSeverity,
  ): AiMemoryLevelStatus {
    if (severity === 'none' || severity === 'meta') {
      return currentStatus || 'missing'
    }
    if (severity === 'additive') {
      return currentStatus === 'ready' ? 'partial' : currentStatus || 'missing'
    }
    if (severity === 'breaking') {
      return currentStatus === 'missing' ? 'missing' : 'partial'
    }
    return 'missing'
  }

  resolveSemanticStatusForStructuredSource(
    currentStatus: AiMemoryLevelStatus | undefined,
    severity: AiMemoryChangeSeverity,
    source: Pick<AiScannedSourceSnapshot, 'semanticSummary'>,
  ) {
    const nextStatus = this.resolveSemanticStatusForChange(currentStatus, severity)
    if (nextStatus !== 'missing') {
      return nextStatus
    }
    return this.hasSourceSemanticHeuristics(source) ? 'partial' : 'missing'
  }

  resolveStructureStatusForCatalog(
    currentStatus: AiMemoryLevelStatus | undefined,
    severity: AiMemoryChangeSeverity,
  ): AiMemoryLevelStatus {
    if (severity === 'breaking') {
      return currentStatus && currentStatus !== 'missing' ? 'stale' : 'missing'
    }
    return currentStatus || 'missing'
  }

  private buildSemanticBootstrapPending(current?: Partial<AiSemanticBootstrapPending> | null) {
    const appId = String(current?.appId || '').trim()
    if (!appId) {
      return null
    }

    return {
      appId,
      requestedAt: Number(current?.requestedAt || 0) || Date.now(),
      reason: this.normalizePendingReason(current?.reason) ?? 'create',
      requestedSourceIds: this.normalizeSourceIds(current?.requestedSourceIds),
      mergedSourceIds: this.normalizeSourceIds(current?.mergedSourceIds),
      lastTriggerReason: this.normalizePendingReason(current?.lastTriggerReason),
      lastTriggerTraceId: String(current?.lastTriggerTraceId || '').trim() || undefined,
      lastTriggerToolCallId: String(current?.lastTriggerToolCallId || '').trim() || undefined,
      lastTriggerAt: Number(current?.lastTriggerAt || 0) || undefined,
      retryCount: Math.max(0, Math.round(Number(current?.retryCount || 0))) || undefined,
      lastAttemptAt: Number(current?.lastAttemptAt || 0) || undefined,
      nextRetryAt: Number(current?.nextRetryAt || 0) || undefined,
      lastError: String(current?.lastError || '').trim() || undefined,
      autoRetryStoppedAt: Number(current?.autoRetryStoppedAt || 0) || undefined,
    } satisfies AiSemanticBootstrapPending
  }

  private uniqueStrings(values: string[]) {
    return [...new Set(
      values
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
  }

  private normalizeSourceIds(values?: string[] | null) {
    const normalized = this.uniqueStrings(Array.isArray(values) ? values : [])
    const bounded = normalized.slice(0, AI_SEMANTIC_BOOTSTRAP_PENDING_SOURCE_SCOPE_LIMIT)
    return bounded.length ? bounded : undefined
  }

  private normalizePendingReason(reason?: AiSemanticBootstrapPending['reason']) {
    return this.normalizeAllowedValue(AI_SEMANTIC_BOOTSTRAP_PENDING_REASONS, reason)
  }

  private normalizeDeepContextStrategy(
    value?: AiAppMemoryWarmupState['phases']['deep']['contextStrategy'],
  ) {
    return this.normalizeAllowedValue(AI_APP_MEMORY_WARMUP_CONTEXT_STRATEGIES, value)
  }

  private normalizeDeepSkipReason(
    value?: AiAppMemoryWarmupState['phases']['deep']['skipReason'],
  ) {
    return this.normalizeAllowedValue(AI_APP_MEMORY_WARMUP_SKIP_REASONS, value)
  }

  private normalizeOptionalCount(value: unknown) {
    return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : undefined
  }

  private normalizeAllowedValue<const T extends readonly string[]>(
    allowedValues: T,
    value: unknown,
  ): T[number] | undefined {
    const normalized = String(value || '').trim()
    return normalized && allowedValues.includes(normalized as T[number])
      ? normalized as T[number]
      : undefined
  }

  private buildBusinessKeywordCandidates(
    source: Pick<AiSourceMemory, 'sourceName' | 'fields' | 'dataProfile' | 'role' | 'queryHints' | 'semanticSummary'>,
  ) {
    const fieldNameById = new Map(
      (Array.isArray(source.fields) ? source.fields : [])
        .map(field => [String(field.id || '').trim(), String(field.name || '').trim()] as const),
    )
    const hintedNames = [
      ...this.mapHintFieldNames(fieldNameById, source.queryHints?.entityFields),
      ...this.mapHintFieldNames(fieldNameById, source.queryHints?.timeFields),
      ...this.mapHintFieldNames(fieldNameById, source.queryHints?.metricFields),
    ]
    const typicalQuestionPhrases = (Array.isArray(source.semanticSummary?.typicalQuestions)
      ? source.semanticSummary.typicalQuestions
      : [])
      .flatMap(item => this.extractQuestionPhrases(item))
    const enumKeywords = (Array.isArray(source.dataProfile?.enumSketches) ? source.dataProfile.enumSketches : [])
      .slice(0, 6)
      .flatMap(item => [
        item.fieldName,
        ...item.values.slice(0, 4).map(value => value.value),
      ])

    return this.filterLowSignalKeywords([
      source.sourceName,
      ...hintedNames,
      ...typicalQuestionPhrases,
      ...enumKeywords,
      ...((Array.isArray(source.fields) ? source.fields : [])
        .filter(field => {
          const name = String(field?.name || '').trim()
          return !!name
        })
        .slice(0, 48)
        .map(field => field.name)),
      ...((Array.isArray(source.fields) ? source.fields : [])
        .filter(field => field.semanticType && field.semanticType !== 'relation')
        .slice(0, 24)
        .map(field => field.semanticType || '')),
      source.role,
    ])
  }

  private filterLowSignalKeywords(values: string[]) {
    return this.uniqueStrings(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter(item => !/^\d+$/.test(item))
        .filter(item => !/^字段\d+$/i.test(item))
        .filter(item => !/^数字\d+$/i.test(item))
        .filter(item => !/^单行文本\d+$/i.test(item))
        .filter(item => !/^[a-z]?\d+$/i.test(item))
        .filter(item => {
          const compact = item.replace(/\s+/g, '')
          if (compact.length < 2) {
            return false
          }
          if (/^[a-z0-9_-]+$/i.test(compact) && /\d/.test(compact)) {
            return false
          }
          return true
        }),
    )
  }

  private buildAppBusinessKeywordPool(
    snapshotKeywords: string[],
    sourceIndex: AiAppMemoryManifest['sourceIndex'],
    sourceMemories?: Array<Pick<AiSourceMemory, 'sourceName' | 'fields' | 'dataProfile' | 'role' | 'queryHints' | 'semanticSummary'>>,
  ) {
    const sourceNameFallback = (Array.isArray(sourceIndex) ? sourceIndex : []).map(item => item.sourceName)
    const sourceKeywordPool = (Array.isArray(sourceMemories) ? sourceMemories : [])
      .flatMap(source => this.buildBusinessKeywordCandidates(source))

    return this.filterLowSignalKeywords([
      ...snapshotKeywords,
      ...sourceNameFallback,
      ...sourceKeywordPool,
    ])
  }

  private mapHintFieldNames(fieldNameById: Map<string, string>, hintedIds?: string[]) {
    return (Array.isArray(hintedIds) ? hintedIds : [])
      .map(item => String(item || '').trim())
      .map(item => fieldNameById.get(item) || item)
      .filter(Boolean)
  }

  private extractQuestionPhrases(value: string) {
    const text = String(value || '').trim()
    if (!text) {
      return []
    }

    return text
      .replace(/use\s+/ig, '')
      .replace(/for\s+/ig, '')
      .replace(/[。.,，]/g, ' ')
      .split(/\s+/)
      .map(item => item.trim())
      .filter(Boolean)
      .filter(item => item.length >= 2)
  }

  private hasSourceSemanticHeuristics(source: Pick<AiScannedSourceSnapshot, 'semanticSummary'>) {
    return (
      Number(source.semanticSummary?.confidence || 0) > 0
      || (source.semanticSummary?.typicalQuestions || []).length > 0
      || (source.semanticSummary?.doNotUseFor || []).length > 0
    )
  }

  private mergeSourceDataProfile(
    nextProfile: AiSourceMemory['dataProfile'],
    existingProfile: AiSourceMemory['dataProfile'] | null | undefined,
    fields: AiSourceMemory['fields'],
    preserveExistingEnumSketches: boolean,
  ): AiSourceMemory['dataProfile'] {
    const nextEnumSketches = Array.isArray(nextProfile?.enumSketches) ? nextProfile.enumSketches : []
    const existingEnumSketches = this.normalizeEnumSketches(existingProfile?.enumSketches, fields)
    return {
      ...existingProfile,
      ...nextProfile,
      rowCountBucket: nextProfile?.rowCountBucket || existingProfile?.rowCountBucket || 'unknown',
      viewTypes: Array.isArray(nextProfile?.viewTypes)
        ? nextProfile.viewTypes
        : (Array.isArray(existingProfile?.viewTypes) ? existingProfile.viewTypes : []),
      hasWorkflow: typeof nextProfile?.hasWorkflow === 'boolean'
        ? nextProfile.hasWorkflow
        : Boolean(existingProfile?.hasWorkflow),
      enumSketches: preserveExistingEnumSketches
        ? (nextEnumSketches.length ? nextEnumSketches : existingEnumSketches)
        : nextEnumSketches,
    }
  }

  private normalizeEnumSketches(
    enumSketches: AiSourceMemory['dataProfile']['enumSketches'],
    fields: AiSourceMemory['fields'],
  ) {
    const fieldNameById = new Map(
      (Array.isArray(fields) ? fields : []).map(field => [field.id, field.name] as const),
    )
    return (Array.isArray(enumSketches) ? enumSketches : [])
      .filter(item => fieldNameById.has(item.fieldId))
      .map(item => ({
        ...item,
        fieldName: fieldNameById.get(item.fieldId) || item.fieldName,
      }))
  }
}
