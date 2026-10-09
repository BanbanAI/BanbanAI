import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ProjectService } from '../../project/project.services'
import { AiConfigService } from '../config/ai-config.service'
import {
  AI_SEMANTIC_BOOTSTRAP_PENDING_SOURCE_SCOPE_LIMIT,
  AiAppMemoryManifest,
  AiAppMemoryWarmupLedger,
  AiAppMemoryWarmupLedgerEvent,
  AiAppMemoryWarmupMaintenanceState,
  AiAppMemoryWarmupPhase,
  AiAppMemoryWarmupTrace,
  AiAppMemoryWarmupTraceQuery,
  AiAppMemoryWarmupPhaseState,
  AiAppMemoryWarmupStatus,
  AiSemanticBootstrapPending,
  AiToolExecutionContext,
  AiWarmupSchedulerDebugState,
} from '../ai.types'
import { AI_APP_MEMORY_VERSION } from './ai-app-memory.diff'
import { AiAppMemoryManager } from './ai-app-memory.manager'
import { AiAppMemoryStore } from './ai-app-memory.store'
import { AiWarmupActivityService } from './ai-warmup-activity.service'
import {
  buildWarmupIdleDecision,
  clampWarmupGlobalConcurrency,
  clampWarmupIdleSweepBatchSize,
} from './ai-warmup-idle-policy'
import { resolveAiAppKind } from '../utils/ai-app-kind.util'
import { PREFERENCES } from '@main/constants'
import { Preferences } from '@main/modules/common'

type WarmupTargetLevel = 'catalog' | 'structure'
type SemanticScheduleReason = AiAppMemoryWarmupTrace['semanticScheduleReason']
type PendingScopeFields = {
  requestedSourceIds?: string[]
  mergedSourceIds?: string[]
  lastTriggerReason?: AiSemanticBootstrapPending['reason']
  lastTriggerTraceId?: string
  lastTriggerToolCallId?: string
  lastTriggerAt?: number
}
type SemanticBootstrapPendingWithScope = AiSemanticBootstrapPending & PendingScopeFields
type WarmupTraceWithScope = AiAppMemoryWarmupTrace & {
  semanticRequestedSourceIds?: string[]
  semanticMergedSourceIds?: string[]
  semanticSelectedSourceIds?: string[]
  semanticContextStrategy?: AiAppMemoryWarmupPhaseState['contextStrategy']
  semanticSkippedReason?: AiAppMemoryWarmupPhaseState['skipReason']
}

type EnsureAppMemoryResult = Awaited<ReturnType<AiAppMemoryManager['ensureAppMemory']>>
type RefreshSemanticMemoryResult = Awaited<ReturnType<AiAppMemoryManager['refreshSemanticMemory']>>
type WarmupTaskResult = EnsureAppMemoryResult | RefreshSemanticMemoryResult | null
type WarmupCancellationContext = {
  startedEpoch: number
  active: boolean
  controller?: AbortController
  cancellationRecorded?: boolean
}
type ScheduledWarmupTask = {
  taskKey: string
  task: Promise<WarmupTaskResult>
  reused: boolean
}
type PrimeAppMemoriesResult = {
  scheduledCount: number
  settledCount: number
  timeoutCount: number
  failedCount: number
  durationMs: number
}

type RecentHit = {
  lastHitAt: number
  exposureHits: number
  confirmedHits: number
  memoryHits: number
  readHits: number
}

const SEMANTIC_SCHEDULE_REASONS: SemanticScheduleReason[] = [
  'create',
  'import',
  'publish',
  'ai-permission',
  'search_top1',
  'get_app_memory',
]

type WarmupTaskMeta = {
  appId: string
  phase: AiAppMemoryWarmupPhase
  queuedAt: number
  startedAt?: number
  cancellation?: WarmupCancellationContext
}

type WarmupStatePatch = Partial<AiAppMemoryWarmupPhaseState> & {
  status?: AiAppMemoryWarmupStatus
  updatedAt?: number
  queueDepth?: number
  message?: string
  clearRetryBackoff?: boolean
}

type DeepWarmupOutcome = {
  message?: string
  shouldClearBootstrapPending: boolean
  skipReason?: AiAppMemoryWarmupPhaseState['skipReason']
}

type ResolvedPendingSemanticScope = {
  requestedSourceIds: string[]
  mergedSourceIds: string[]
  selectedSourceIds: string[]
  contextStrategy: AiAppMemoryWarmupPhaseState['contextStrategy']
  allowLegacySelection: boolean
  hasPermissionScopedPending: boolean
}

const MAX_GENERIC_BOOTSTRAP_RETRY_COUNT = 5

@Injectable()
export class AiAppMemoryWarmupService {
  private static readonly MAX_TRACE_COUNT = 100
  private readonly logger = new Logger('AiAppMemoryWarmupService')
  private readonly inFlight = new Map<string, Promise<WarmupTaskResult>>()
  private readonly inFlightByPhase = new Map<string, string>()
  private readonly taskMeta = new Map<string, WarmupTaskMeta>()
  private readonly recentHits = new Map<string, RecentHit>()
  private readonly knownManifests = new Map<string, AiAppMemoryManifest>()
  private readonly ledgerEvents: AiAppMemoryWarmupLedgerEvent[] = []
  private warmupTraces: AiAppMemoryWarmupTrace[] = []
  private maintenanceState: AiAppMemoryWarmupMaintenanceState = {}
  private recentForegroundActivityAt = 0
  private activeForegroundRequests = 0
  private ledgerWriteChain = Promise.resolve()
  private traceWriteChain = Promise.resolve()
  private tracesHydrated = false
  private readonly semanticBootstrapPendingByAppId = new Map<string, SemanticBootstrapPendingWithScope>()
  private readonly pendingMutationChains = new Map<string, Promise<void>>()
  private ledgerBootstrapPendingHydrated = false
  private idleSweepRunning = false
  private schedulerPausedReason: string | undefined
  private schedulerLastDecision: AiWarmupSchedulerDebugState | undefined
  private canceledByActivityCount = 0
  private skippedBecauseActiveCount = 0

  constructor(
    private readonly manager: AiAppMemoryManager,
    private readonly store: AiAppMemoryStore,
    private readonly projectService: ProjectService,
    private readonly aiConfigService: AiConfigService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    private readonly activityService: AiWarmupActivityService = new AiWarmupActivityService(),
  ) {
    this.activityService.subscribe(() => this.abortActiveIdleWarmups())
  }

  async runWithForegroundActivity<T>(task: () => Promise<T>) {
    this.activeForegroundRequests += 1
    this.touchForegroundActivity('ai-tool:start')
    try {
      return await task()
    } finally {
      this.activeForegroundRequests = Math.max(0, this.activeForegroundRequests - 1)
      this.touchForegroundActivity('ai-tool:finish')
    }
  }

  touchForegroundActivity(reason = 'foreground') {
    this.recentForegroundActivityAt = Date.now()
    this.activityService.touchForegroundAiActivity({ reason })
    void this.persistLedger()
  }

  recordSearchExposure(appIds: string[]) {
    this.touchForegroundActivity()
    this.bumpRecentHits(appIds, {
      exposureHits: 1,
    })
  }

  recordConfirmedAppAccess(appId: string, kind: 'memory' | 'read') {
    this.touchForegroundActivity()
    this.bumpRecentHits([appId], {
      confirmedHits: 1,
      memoryHits: kind === 'memory' ? 1 : 0,
      readHits: kind === 'read' ? 1 : 0,
    })
  }

  async scheduleBootstrapWarmup(appId: string, reason: 'create' | 'import' | 'publish') {
    const featureFlags = await this.aiConfigService.getFeatureFlags()
    if (featureFlags.semanticWarmupEnabled === false) {
      return
    }
    this.activityService.touchServerWriteActivity({ appId, reason })
    await this.markBootstrapPending(appId, reason)
  }

  async scheduleSemanticWarmup(
    appId: string,
    reason: 'search_top1' | 'get_app_memory',
    options?: {
      requestedSourceIds?: string[]
      traceId?: string
      toolCallId?: string
    },
  ) {
    const featureFlags = await this.aiConfigService.getFeatureFlags()
    if (featureFlags.semanticWarmupEnabled === false) {
      return
    }
    this.activityService.touchForegroundAiActivity({ appId, reason })
    await this.markBootstrapPending(appId, reason, options)
  }

  async invalidateSemanticMemory(appId: string, reason: 'ai-permission') {
    await this.manager.invalidateSemanticMemory(appId, reason)
    const featureFlags = await this.aiConfigService.getFeatureFlags()
    if (featureFlags.semanticWarmupEnabled !== false) {
      await this.markBootstrapPending(appId, reason)
    }
  }

  async primeAppMemories(
    appIds: string[],
    context: AiToolExecutionContext,
    target: WarmupTargetLevel,
    joinTimeoutMs: number,
  ) {
    const startedAt = Date.now()
    const featureFlags = await this.aiConfigService.getFeatureFlags()
    if (featureFlags.semanticWarmupEnabled === false) {
      return {
        scheduledCount: 0,
        settledCount: 0,
        timeoutCount: 0,
        failedCount: 0,
        durationMs: Math.max(0, Date.now() - startedAt),
      } satisfies PrimeAppMemoriesResult
    }
    const normalizedAppIds = [...new Set(appIds.map(item => String(item || '').trim()).filter(Boolean))]
    const promises = normalizedAppIds
      .map(appId => this.enqueueWarmup(appId, context, this.toWarmupPhase(target)))
    if (joinTimeoutMs <= 0) {
      return {
        scheduledCount: promises.length,
        settledCount: 0,
        timeoutCount: 0,
        failedCount: 0,
        durationMs: Math.max(0, Date.now() - startedAt),
      } satisfies PrimeAppMemoriesResult
    }

    const timeoutSentinel = Symbol('warmup-timeout')
    const results = await Promise.allSettled(
      promises.map(promise => this.withTimeout(promise, joinTimeoutMs, timeoutSentinel)),
    )
    let settledCount = 0
    let timeoutCount = 0
    let failedCount = 0

    for (const item of results) {
      if (item.status === 'rejected') {
        failedCount += 1
        continue
      }
      if (item.value === timeoutSentinel) {
        timeoutCount += 1
        continue
      }
      settledCount += 1
    }

    return {
      scheduledCount: promises.length,
      settledCount,
      timeoutCount,
      failedCount,
      durationMs: Math.max(0, Date.now() - startedAt),
    } satisfies PrimeAppMemoriesResult
  }

  async ensureAppMemory(
    appId: string,
    context: AiToolExecutionContext,
    target: WarmupTargetLevel,
  ): Promise<EnsureAppMemoryResult> {
    const phase = this.toWarmupPhase(target)
    return await this.enqueueWarmup(appId, context, phase)
  }

  async getWarmupLedgerSnapshot() {
    await this.hydrateLedgerBootstrapPending()
    await this.hydrateKnownManifests()
    return this.buildWarmupLedger()
  }

  async recordToolTrace(trace: WarmupTraceWithScope) {
    await this.hydrateWarmupTraces()
    const normalized = this.normalizeWarmupTrace(trace)
    this.warmupTraces.unshift(normalized)
    if (this.warmupTraces.length > AiAppMemoryWarmupService.MAX_TRACE_COUNT) {
      this.warmupTraces.splice(AiAppMemoryWarmupService.MAX_TRACE_COUNT)
    }
    await this.persistTraces()
    return normalized
  }

  async getWarmupTraceSnapshot(query?: AiAppMemoryWarmupTraceQuery) {
    await this.hydrateWarmupTraces()
    const normalizedTraceId = String(query?.traceId || '').trim()
    const normalizedAppId = String(query?.appId || '').trim()
    const filtered = this.warmupTraces.filter(item => {
      if (query?.kind && item.kind !== query.kind) {
        return false
      }
      if (normalizedTraceId && item.traceId !== normalizedTraceId) {
        return false
      }
      if (normalizedAppId && item.appId !== normalizedAppId) {
        return false
      }
      return true
    })
    const limit = Number(query?.limit)
    const sliced = Number.isFinite(limit) && limit > 0
      ? filtered.slice(0, Math.min(Math.round(limit), AiAppMemoryWarmupService.MAX_TRACE_COUNT))
      : filtered
    return sliced.map(item => ({ ...item }))
  }

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'Asia/Shanghai' })
  private async runIdleWarmupSweep() {
    if (this.idleSweepRunning) {
      this.skippedBecauseActiveCount += 1
      this.recordSchedulerDecision({
        idleEligible: false,
        pausedReason: 'sweep_running',
      })
      await this.persistLedger()
      return
    }

    this.idleSweepRunning = true
    try {
      const featureFlags = await this.aiConfigService.getFeatureFlags()
      if (featureFlags.semanticWarmupEnabled === false) {
        return
      }
      const maxConcurrency = clampWarmupGlobalConcurrency(featureFlags.warmupGlobalConcurrency)
      const batchSize = clampWarmupIdleSweepBatchSize(featureFlags.warmupIdleSweepBatchSize)
      const activity = this.activityService.getSnapshot()

      if (this.activeForegroundRequests > 0) {
        this.skippedBecauseActiveCount += 1
        this.recordSchedulerDecision({
          idleEligible: false,
          idleAgeMs: activity.globalIdleAgeMs,
          requiredIdleMs: 45 * 1000,
          pausedReason: 'foreground_ai_active',
        })
        await this.persistLedger()
        return
      }

      // This budget only gates background idle sweeps. Foreground/direct warmups keep their existing enqueue behavior.
      if (this.inFlight.size >= maxConcurrency) {
        this.skippedBecauseActiveCount += 1
        this.recordSchedulerDecision({
          idleEligible: false,
          idleAgeMs: activity.globalIdleAgeMs,
          requiredIdleMs: 0,
          pausedReason: 'background_concurrency_limit',
        })
        await this.persistLedger()
        return
      }

      const cancellation: WarmupCancellationContext | undefined = featureFlags.warmupStopOnUserActivityEnabled === false
        ? undefined
        : {
            startedEpoch: this.activityService.getCurrentEpoch(),
            active: true,
          }

      const metas = await this.listVisibleWarmupMetas()
      if (this.isWarmupCancellationTriggered(cancellation)) {
        this.recordIdleSweepCancellation()
        await this.persistLedger()
        return
      }

      const activeAppIds = new Set<string>()
      const manifestByAppId = new Map<string, AiAppMemoryManifest | null>()
      for (const meta of Array.isArray(metas) ? metas : []) {
        const appId = String(meta?.id || '').trim()
        if (!appId) {
          continue
        }
        activeAppIds.add(appId)
        manifestByAppId.set(appId, await this.readNormalizedManifest(appId))
        if (this.isWarmupCancellationTriggered(cancellation)) {
          this.recordIdleSweepCancellation()
          await this.persistLedger()
          return
        }
      }

      for (const appId of await this.listStoredAppMemoryAppIds()) {
        if (manifestByAppId.has(appId)) {
          continue
        }
        manifestByAppId.set(appId, await this.readNormalizedManifest(appId))
        if (this.isWarmupCancellationTriggered(cancellation)) {
          this.recordIdleSweepCancellation()
          await this.persistLedger()
          return
        }
      }

      await this.runMaintenanceSweep(activeAppIds, manifestByAppId)
      if (this.isWarmupCancellationTriggered(cancellation)) {
        this.recordIdleSweepCancellation()
        await this.persistLedger()
        return
      }

      for (const appId of [...manifestByAppId.keys()]) {
        if (!activeAppIds.has(appId) && !this.shouldRetainInactivePendingBootstrap(manifestByAppId.get(appId) || null)) {
          manifestByAppId.delete(appId)
        }
      }

      const candidates: Array<{
        appId: string
        phase: AiAppMemoryWarmupPhase
        priority: number
        decision: ReturnType<typeof buildWarmupIdleDecision>
      }> = []
      let recordedCandidateDecision = false

      for (const [appId, manifest] of manifestByAppId.entries()) {
        if (this.isWarmupCancellationTriggered(cancellation)) {
          this.recordIdleSweepCancellation()
          await this.persistLedger()
          return
        }
        const hit = this.recentHits.get(appId)
        const recentBoost = this.getRecentHitPriority(hit)
        const next = this.pickCandidatePhase(
          appId,
          manifest,
          hit,
          recentBoost,
          featureFlags,
          activeAppIds.has(appId),
        )
        if (!next) {
          continue
        }
        const decision = this.buildIdleDecision(next.phase, appId, featureFlags)
        if (!decision.idleEligible) {
          this.skippedBecauseActiveCount += 1
          this.recordSchedulerDecision({
            ...decision,
            pausedReason: 'user_activity_recent',
          })
          recordedCandidateDecision = true
          continue
        }
        candidates.push({
          ...next,
          decision,
        })
      }

      const topCandidates = candidates
        .sort((left, right) => right.priority - left.priority || left.appId.localeCompare(right.appId, 'zh-CN'))
        .slice(0, batchSize)

      if (topCandidates.length > 0) {
        this.recordSchedulerDecision(topCandidates[0].decision)
      } else if (!recordedCandidateDecision) {
        this.recordSchedulerDecision({
          idleEligible: true,
          idleAgeMs: this.activityService.getGlobalIdleAgeMs(),
          requiredIdleMs: 0,
        })
      }

      for (const candidate of topCandidates) {
        if (this.isWarmupCancellationTriggered(cancellation)) {
          this.recordIdleSweepCancellation()
          break
        }

        const refreshedCandidate = await this.refreshIdleCandidate(candidate, activeAppIds, featureFlags)
        if (this.isWarmupCancellationTriggered(cancellation)) {
          this.recordIdleSweepCancellation()
          break
        }
        if (!refreshedCandidate || refreshedCandidate.phase !== candidate.phase) {
          continue
        }
        const refreshedDecision = this.buildIdleDecision(refreshedCandidate.phase, refreshedCandidate.appId, featureFlags)
        if (!refreshedDecision.idleEligible) {
          this.skippedBecauseActiveCount += 1
          this.recordSchedulerDecision({
            ...refreshedDecision,
            pausedReason: 'user_activity_recent',
          })
          continue
        }
        if (this.inFlight.size >= maxConcurrency) {
          this.skippedBecauseActiveCount += 1
          this.recordSchedulerDecision({
            idleEligible: false,
            idleAgeMs: this.activityService.getGlobalIdleAgeMs(),
            requiredIdleMs: 0,
            pausedReason: 'background_concurrency_limit',
          })
          break
        }
        try {
          const scheduled = await this.scheduleWarmup(
            refreshedCandidate.appId,
            this.buildBackgroundContext(refreshedCandidate.phase),
            refreshedCandidate.phase,
            cancellation,
          )
          void scheduled.task.catch(error => {
            const errorText = error instanceof Error ? error.message : JSON.stringify(error)
            this.logger.warn(`idle warmup failed appId=${refreshedCandidate.appId} phase=${refreshedCandidate.phase} error=${errorText}`)
          })
          if (this.isWarmupCancellationTriggered(cancellation)) {
            break
          }
        } catch (error) {
          const errorText = error instanceof Error ? error.message : JSON.stringify(error)
          this.logger.warn(`idle warmup failed appId=${refreshedCandidate.appId} phase=${refreshedCandidate.phase} error=${errorText}`)
        }
      }

      const prunedHitCount = this.pruneRecentHits()
      if (prunedHitCount > 0) {
        this.maintenanceState = {
          ...this.maintenanceState,
          lastCleanupAt: Date.now(),
          prunedHitCount,
        }
        this.pushLedgerEvent({
          id: `maintenance:prune-hits:${Date.now()}`,
          kind: 'maintenance',
          status: 'expired',
          updatedAt: Date.now(),
          message: `maintenance pruned ${prunedHitCount} expired recent-hit records`,
        })
      }
      await this.persistLedger()
    } finally {
      this.idleSweepRunning = false
    }
  }

  private async listStoredManifestAppIds() {
    const listManifestAppIds = (this.store as AiAppMemoryStore & {
      listManifestAppIds?: () => Promise<string[]>
    }).listManifestAppIds
    if (typeof listManifestAppIds !== 'function') {
      return []
    }
    const appIds = await listManifestAppIds.call(this.store).catch(() => [])
    return [...new Set((Array.isArray(appIds) ? appIds : []).map(item => String(item || '').trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }

  private async listStoredAppMemoryAppIds() {
    const listAiDirectoryAppIds = (this.store as AiAppMemoryStore & {
      listAiDirectoryAppIds?: () => Promise<string[]>
    }).listAiDirectoryAppIds
    const aiDirectoryAppIds = typeof listAiDirectoryAppIds === 'function'
      ? await listAiDirectoryAppIds.call(this.store).catch(() => [])
      : []
    return [...new Set([
      ...await this.listStoredManifestAppIds(),
      ...(Array.isArray(aiDirectoryAppIds) ? aiDirectoryAppIds : []),
    ].map(item => String(item || '').trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }

  private async enqueueWarmup(
    appId: string,
    context: AiToolExecutionContext,
    phase: 'catalog' | 'profile',
    cancellation?: WarmupCancellationContext,
  ): Promise<EnsureAppMemoryResult>
  private async enqueueWarmup(
    appId: string,
    context: AiToolExecutionContext,
    phase: 'deep',
    cancellation?: WarmupCancellationContext,
  ): Promise<RefreshSemanticMemoryResult | null>
  private async enqueueWarmup(
    appId: string,
    context: AiToolExecutionContext,
    phase: AiAppMemoryWarmupPhase,
    cancellation?: WarmupCancellationContext,
  ): Promise<WarmupTaskResult>
  private async enqueueWarmup(
    appId: string,
    context: AiToolExecutionContext,
    phase: AiAppMemoryWarmupPhase,
    cancellation?: WarmupCancellationContext,
  ): Promise<WarmupTaskResult> {
    const scheduled = await this.scheduleWarmup(appId, context, phase, cancellation)
    return await scheduled.task
  }

  private async scheduleWarmup(
    appId: string,
    context: AiToolExecutionContext,
    phase: AiAppMemoryWarmupPhase,
    cancellation?: WarmupCancellationContext,
  ): Promise<ScheduledWarmupTask> {
    const queuedAt = Date.now()
    const phaseOwnerKey = this.buildPhaseOwnerKey(appId, phase)
    const phaseOwnerTaskKey = this.inFlightByPhase.get(phaseOwnerKey)
    const phaseOwnerTask = phaseOwnerTaskKey ? this.getPhaseOwnerTask(phaseOwnerKey) : null
    if (phaseOwnerTask && phaseOwnerTaskKey) {
      if (!cancellation && !this.promoteWarmupTaskToForeground(phaseOwnerTaskKey)) {
        await phaseOwnerTask.catch(() => null)
        return await this.scheduleWarmup(appId, context, phase, cancellation)
      }
      return {
        taskKey: phaseOwnerTaskKey,
        task: phaseOwnerTask,
        reused: true,
      }
    }

    const taskKey = await this.buildTaskKey(appId, phase)
    const currentTask = this.inFlight.get(taskKey)
    if (currentTask) {
      if (!cancellation && !this.promoteWarmupTaskToForeground(taskKey)) {
        await currentTask.catch(() => null)
        return await this.scheduleWarmup(appId, context, phase, cancellation)
      }
      return {
        taskKey,
        task: currentTask,
        reused: true,
      }
    }

    const taskCancellation = cancellation
      ? {
          ...cancellation,
          active: cancellation.active !== false,
          controller: new AbortController(),
          cancellationRecorded: false,
        }
      : undefined
    const taskContext = taskCancellation?.controller
      ? {
          ...context,
          signal: taskCancellation.controller.signal,
        }
      : context

    this.taskMeta.set(taskKey, {
      appId,
      phase,
      queuedAt,
      cancellation: taskCancellation,
    })
    this.inFlightByPhase.set(phaseOwnerKey, taskKey)
    const task = (async (): Promise<WarmupTaskResult> => {
      await this.updateWarmupState(appId, phase, {
        status: 'queued',
        updatedAt: queuedAt,
        taskKey,
      })
      return await this.runWarmupTask(appId, taskContext, phase, taskKey, taskCancellation)
    })()
    this.inFlight.set(taskKey, task)
    void this.persistLedger()
    void task
      .finally(() => {
        const current = this.inFlight.get(taskKey)
        if (current === task) {
          this.inFlight.delete(taskKey)
        }
        if (this.inFlightByPhase.get(phaseOwnerKey) === taskKey) {
          this.inFlightByPhase.delete(phaseOwnerKey)
        }
        this.taskMeta.delete(taskKey)
        void this.persistLedger()
      })
      .catch(() => undefined)
    return {
      taskKey,
      task,
      reused: false,
    }
  }

  private async runWarmupTask(
    appId: string,
    context: AiToolExecutionContext,
    phase: AiAppMemoryWarmupPhase,
    taskKey: string,
    cancellation?: WarmupCancellationContext,
  ): Promise<WarmupTaskResult> {
    const startedAt = Date.now()
    this.activityService.markWarmupStarted({ taskKey, at: startedAt })
    const taskMeta = this.taskMeta.get(taskKey)
    if (taskMeta) {
      taskMeta.startedAt = startedAt
    }
    const shouldMirrorCatalog = phase === 'profile' && await this.shouldMirrorCatalogPhase(appId)
    const catalogTaskKey = shouldMirrorCatalog
      ? await this.buildTaskKey(appId, 'catalog')
      : undefined

    if (shouldMirrorCatalog && catalogTaskKey) {
      await this.updateWarmupState(appId, 'catalog', {
        status: 'running',
        updatedAt: startedAt,
        taskKey: catalogTaskKey,
      })
    }

    await this.updateWarmupState(appId, phase, {
      status: 'running',
      updatedAt: startedAt,
      taskKey,
    })
    if ((phase === 'catalog' || phase === 'profile')
      && await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)
    ) {
      return null
    }

    let didAttemptDeepSemanticRefresh = false
    let isHotspotDeepRefresh = false
    let deepPhaseDiagnosticPatch: Partial<AiAppMemoryWarmupPhaseState> | undefined
    try {
      let result: WarmupTaskResult = null
      let deepWarmupMessage: string | undefined
      if (phase === 'catalog') {
        result = await this.manager.ensureAppMemory(appId, context, 'catalog')
      } else if (phase === 'profile') {
        result = await this.manager.ensureAppMemory(appId, context, 'structure')
      } else if (phase === 'deep') {
        const deepPlan = await this.buildDeepRefreshPlan(appId)
        const bootstrapPending = await this.getSemanticBootstrapPending(appId)
        const manifest = await this.readNormalizedManifest(appId)
        const eligibility = this.classifyDeepEligibility(manifest)
        const resolvedScope = this.resolvePendingSemanticScope(manifest, bootstrapPending, deepPlan)
        const selectedSourceIds = eligibility.eligibleSourceCount > 0
          ? (
            resolvedScope.selectedSourceIds.length > 0
              ? resolvedScope.selectedSourceIds
              : resolvedScope.allowLegacySelection
                ? this.resolveSemanticDeepSourceIds(manifest, deepPlan, bootstrapPending)
                : []
          )
          : []
        isHotspotDeepRefresh = selectedSourceIds.length > 0
          && deepPlan.sourceIds.length > 0
          && !bootstrapPending
          && resolvedScope.contextStrategy === 'legacy_hotspot'
        if (eligibility.eligibleSourceCount === 0) {
          if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
            return null
          }
          if (bootstrapPending && this.shouldClearBootstrapPendingForNoEligible(eligibility.nonEligibleReason)) {
            await this.clearSemanticBootstrapPending(appId)
          }
          if (await this.updateTerminalWarmupState(appId, phase, taskKey, startedAt, {
            status: 'skipped',
            updatedAt: Date.now(),
            durationMs: Date.now() - startedAt,
            taskKey,
            queueDepth: this.resolveCompletedQueueDepth(taskKey),
            reasonCode: 'no_eligible_sources',
            scheduleReason: bootstrapPending || deepPlan.sourceIds.length === 0 ? 'bootstrap' : 'hotspot',
            eligibleSourceCount: eligibility.eligibleSourceCount,
            nonEligibleReason: eligibility.nonEligibleReason,
            requestedSourceCount: resolvedScope.requestedSourceIds.length,
            mergedSourceCount: resolvedScope.mergedSourceIds.length,
            selectedSourceCount: selectedSourceIds.length,
            contextStrategy: resolvedScope.contextStrategy,
            skipReason: 'no_eligible_sources',
            message: 'deep semantic warmup skipped because no eligible targets were found',
          }, cancellation, catalogTaskKey)) {
            return null
          }
          await this.recordDeepWarmupTrace(appId, context, {
            requestedSourceIds: resolvedScope.requestedSourceIds,
            mergedSourceIds: resolvedScope.mergedSourceIds,
            selectedSourceIds,
            contextStrategy: resolvedScope.contextStrategy,
            skipReason: 'no_eligible_sources',
          })
          return null
        }
        if (!selectedSourceIds.length && resolvedScope.hasPermissionScopedPending) {
          if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
            return null
          }
          if (await this.updateTerminalWarmupState(appId, phase, taskKey, startedAt, {
            status: 'skipped',
            updatedAt: Date.now(),
            durationMs: Date.now() - startedAt,
            taskKey,
            queueDepth: this.resolveCompletedQueueDepth(taskKey),
            reasonCode: 'no_eligible_sources',
            scheduleReason: 'bootstrap',
            eligibleSourceCount: eligibility.eligibleSourceCount,
            requestedSourceCount: resolvedScope.requestedSourceIds.length,
            mergedSourceCount: resolvedScope.mergedSourceIds.length,
            selectedSourceCount: 0,
            contextStrategy: resolvedScope.contextStrategy,
            skipReason: 'no_permission_scoped_targets',
            message: 'deep semantic warmup skipped because permission-scoped selected sources were empty',
          }, cancellation, catalogTaskKey)) {
            return null
          }
          await this.recordDeepWarmupTrace(appId, context, {
            requestedSourceIds: resolvedScope.requestedSourceIds,
            mergedSourceIds: resolvedScope.mergedSourceIds,
            selectedSourceIds: [],
            contextStrategy: resolvedScope.contextStrategy,
            skipReason: 'no_permission_scoped_targets',
          })
          return null
        }
        if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
          return null
        }
        didAttemptDeepSemanticRefresh = true
        const deepResult = await this.manager.refreshSemanticMemory(appId, context, {
          selectedSourceIds,
        })
        result = deepResult
        const deepOutcome = this.resolveDeepWarmupOutcome(deepResult)
        deepWarmupMessage = deepOutcome.message
        deepPhaseDiagnosticPatch = {
          requestedSourceCount: resolvedScope.requestedSourceIds.length,
          mergedSourceCount: resolvedScope.mergedSourceIds.length,
          selectedSourceCount: Array.isArray(deepResult?.selectedSourceIds) ? deepResult.selectedSourceIds.length : selectedSourceIds.length,
          contextStrategy: resolvedScope.contextStrategy,
          skipReason: deepOutcome.skipReason,
        }
        await this.updateWarmupState(appId, phase, {
          updatedAt: Date.now(),
          ...deepPhaseDiagnosticPatch,
        })
        await this.recordDeepWarmupTrace(appId, context, {
          requestedSourceIds: resolvedScope.requestedSourceIds,
          mergedSourceIds: resolvedScope.mergedSourceIds,
          selectedSourceIds: Array.isArray(deepResult?.selectedSourceIds) ? deepResult.selectedSourceIds : selectedSourceIds,
          contextStrategy: resolvedScope.contextStrategy,
          skipReason: deepOutcome.skipReason,
        })
        if (deepOutcome.shouldClearBootstrapPending) {
          await this.consumeSemanticBootstrapPending(appId, deepResult, {
            allowSelectedSourceFallback: true,
          })
        } else {
          throw new Error(deepWarmupMessage || 'deep semantic warmup produced no effective semantic refresh')
        }
      } else {
        if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
          return null
        }
        await this.updateTerminalWarmupState(appId, phase, taskKey, startedAt, {
          status: 'skipped',
          updatedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          taskKey,
          queueDepth: this.resolveCompletedQueueDepth(taskKey),
        }, cancellation, catalogTaskKey)
        return null
      }

      const finishedAt = Date.now()
      if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
        return result
      }
      const queueDepth = this.resolveCompletedQueueDepth(taskKey)

      if (await this.updateTerminalWarmupState(appId, phase, taskKey, startedAt, {
        status: 'succeeded',
        updatedAt: finishedAt,
        durationMs: finishedAt - startedAt,
        taskKey,
        queueDepth,
        message: deepWarmupMessage,
        clearRetryBackoff: phase === 'deep',
        ...(phase === 'deep' && isHotspotDeepRefresh
          ? { hitWatermark: this.buildDeepHitWatermark(this.recentHits.get(appId)) }
          : {}),
      }, cancellation, catalogTaskKey)) {
        return result
      }
      return result
    } catch (error) {
      const finishedAt = Date.now()
      if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
        return null
      }
      const queueDepth = this.resolveCompletedQueueDepth(taskKey)
      const lastError = error instanceof Error ? error.message : String(error)
      const deepRetryPatch = phase === 'deep'
        ? this.buildDeepFailureRetryPatch(appId, lastError, finishedAt)
        : {}

      if (await this.updateTerminalWarmupState(appId, phase, taskKey, startedAt, {
        status: 'failed',
        updatedAt: finishedAt,
        durationMs: finishedAt - startedAt,
        lastError,
        taskKey,
        queueDepth,
        reasonCode: phase === 'deep' ? this.mapDeepFailureReason(lastError) : undefined,
        ...(phase === 'deep' ? deepPhaseDiagnosticPatch : undefined),
        ...deepRetryPatch,
        ...(phase === 'deep' && isHotspotDeepRefresh
          ? { hitWatermark: this.buildDeepHitWatermark(this.recentHits.get(appId)) }
          : {}),
      }, cancellation, catalogTaskKey)) {
        return null
      }
      if (didAttemptDeepSemanticRefresh) {
        await this.markBootstrapFailure(appId, lastError, finishedAt)
      }
      throw error
    }
  }

  private async buildTaskKey(appId: string, phase: AiAppMemoryWarmupPhase) {
    const manifest = await this.readNormalizedManifest(appId)
    const fingerprint = phase === 'catalog'
      ? String(manifest?.fingerprint?.schemaHash || manifest?.fingerprint?.metaHash || 'missing')
      : phase === 'deep'
        ? this.buildDeepTaskFingerprint(manifest, this.recentHits.get(appId))
        : String(manifest?.fingerprint?.bodyHash || manifest?.fingerprint?.schemaHash || 'missing')
    return `warmup:${phase}:${appId}:${fingerprint}`
  }

  private buildPhaseOwnerKey(appId: string, phase: AiAppMemoryWarmupPhase) {
    return `${appId}:${phase}`
  }

  private getPhaseOwnerTask(phaseOwnerKey: string): Promise<WarmupTaskResult> | null {
    const ownerTaskKey = this.inFlightByPhase.get(phaseOwnerKey)
    if (!ownerTaskKey) {
      return null
    }
    const ownerTask = this.inFlight.get(ownerTaskKey)
    if (!ownerTask) {
      this.inFlightByPhase.delete(phaseOwnerKey)
      return null
    }
    return ownerTask
  }

  private promoteWarmupTaskToForeground(taskKey: string) {
    const taskMeta = this.taskMeta.get(taskKey)
    const cancellation = taskMeta?.cancellation
    if (!cancellation) {
      return true
    }
    if (cancellation.controller?.signal.aborted) {
      return false
    }
    cancellation.active = false
    return true
  }

  private abortActiveIdleWarmups() {
    for (const meta of this.taskMeta.values()) {
      const cancellation = meta.cancellation
      if (!cancellation || cancellation.active === false || cancellation.controller?.signal.aborted) {
        continue
      }
      cancellation.controller?.abort()
    }
  }

  private async updateWarmupState(
    appId: string,
    phase: AiAppMemoryWarmupPhase,
    patch: WarmupStatePatch,
  ) {
    const manifest = await this.readNormalizedManifest(appId)
    if (!manifest) {
      return
    }

    const nextWarmupState = this.buildWarmupState(manifest.warmupState)
    const previousPhaseState = nextWarmupState.phases[phase]
    const updatedAt = Number(patch.updatedAt || Date.now())

    if (
      patch.taskKey
      && previousPhaseState?.taskKey
      && previousPhaseState.taskKey !== patch.taskKey
      && (previousPhaseState.status === 'queued' || previousPhaseState.status === 'running')
    ) {
      this.pushLedgerEvent({
        id: `${appId}:${phase}:${updatedAt}:expired`,
        appId,
        phase,
        status: 'expired',
        taskKey: previousPhaseState.taskKey,
        updatedAt,
        message: `superseded by ${patch.taskKey}`,
      })
    }

    const { queueDepth, message, clearRetryBackoff, ...phasePatch } = patch
    nextWarmupState.phases[phase] = {
      ...previousPhaseState,
      ...phasePatch,
    }
    if (clearRetryBackoff) {
      delete nextWarmupState.phases[phase].retryCount
      delete nextWarmupState.phases[phase].nextRetryAt
    }
    nextWarmupState.queueDepth = Number.isFinite(Number(queueDepth))
      ? Number(queueDepth)
      : this.inFlight.size

    if (patch.status === 'succeeded') {
      delete nextWarmupState.phases[phase].lastError
      delete nextWarmupState.phases[phase].reasonCode
      delete nextWarmupState.phases[phase].scheduleReason
      delete nextWarmupState.phases[phase].eligibleSourceCount
      delete nextWarmupState.phases[phase].nonEligibleReason
      nextWarmupState.lastWarmAt = updatedAt
      nextWarmupState.lastError = ''
    } else if (patch.lastError) {
      nextWarmupState.lastError = patch.lastError
    }

    manifest.warmupState = nextWarmupState
    manifest.updatedAt = Date.now()
    await this.store.writeManifest(appId, manifest)
    this.rememberManifest(manifest)
    this.pushLedgerEvent({
      id: `${appId}:${phase}:${updatedAt}:${String(patch.status || previousPhaseState.status || 'missing')}`,
      kind: 'warmup',
      appId,
      phase,
      status: String(patch.status || previousPhaseState.status || 'missing') as AiAppMemoryWarmupLedgerEvent['status'],
      taskKey: String(patch.taskKey || previousPhaseState.taskKey || '').trim() || undefined,
      updatedAt,
      durationMs: Number.isFinite(Number(patch.durationMs)) ? Number(patch.durationMs) : undefined,
      queueDepth: nextWarmupState.queueDepth,
      lastError: String(patch.lastError || '').trim() || undefined,
      message: String(message || '').trim() || this.buildLedgerMessage(appId, phase, patch),
    })
    await this.persistLedger()
  }

  private pickCandidatePhase(
    appId: string,
    manifest: AiAppMemoryManifest | null,
    hit: RecentHit | undefined,
    recentBoost: number,
    featureFlags: Awaited<ReturnType<AiConfigService['getFeatureFlags']>>,
    isActiveApp: boolean,
  ) {
    if (!manifest) {
      return {
        appId,
        phase: 'catalog' as const,
        priority: 100 + recentBoost,
      }
    }

    if (featureFlags.semanticWarmupEnabled === false) {
      return null
    }

    const warmupState = this.buildWarmupState(manifest.warmupState)
    const hasReadableSources = Array.isArray(manifest.sourceIndex) && manifest.sourceIndex.length > 0
    if (!hasReadableSources) {
      const hasCatalogSucceeded = warmupState.phases.catalog.status === 'succeeded'
      const hasProfileSucceeded = warmupState.phases.profile.status === 'succeeded'
      if (hasCatalogSucceeded && hasProfileSucceeded) {
        return null
      }
      if (hasCatalogSucceeded) {
        return null
      }
    }
    const catalogStatus = this.resolveIdleCandidateLevelStatus(
      manifest.levels?.catalog,
      warmupState.phases.catalog.status,
      isActiveApp,
    )
    if (catalogStatus === 'missing' || catalogStatus === 'failed' || catalogStatus === 'stale') {
      return {
        appId,
        phase: 'catalog' as const,
        priority: 90 + recentBoost,
      }
    }

    const structureStatus = this.resolveIdleCandidateLevelStatus(
      manifest.levels?.structure,
      warmupState.phases.profile.status,
      isActiveApp,
    )
    if (structureStatus === 'missing' || structureStatus === 'failed' || structureStatus === 'stale') {
      const bootstrapPending = this.getSemanticBootstrapPendingFromManifest(manifest)
      return {
        appId,
        phase: 'profile' as const,
        priority: (bootstrapPending ? 85 : 70) + recentBoost,
      }
    }

    if (manifest.version !== AI_APP_MEMORY_VERSION) {
      return {
        appId,
        phase: 'profile' as const,
        priority: 60 + recentBoost,
      }
    }

    if (this.isDeepBackoffActive(manifest)) {
      return null
    }

    if (this.shouldScheduleBootstrapSemanticWarmup(manifest, featureFlags.semanticWarmupBootstrapIdleEnabled !== false)) {
      return {
        appId,
        phase: 'deep' as const,
        priority: 80 + recentBoost,
      }
    }

    if (this.shouldScheduleDeepHotspot(manifest, hit)) {
      const deepPlan = this.buildDeepRefreshPlanFromManifest(manifest, hit)
      return {
        appId,
        phase: 'deep' as const,
        priority: 45 + recentBoost + deepPlan.sourceIds.length * 2,
      }
    }

    return null
  }

  private getRecentHitPriority(hit?: RecentHit) {
    if (!hit) {
      return 0
    }
    const ageMs = Date.now() - hit.lastHitAt
    const recencyBoost = ageMs <= 10 * 60 * 1000 ? 10 : ageMs <= 60 * 60 * 1000 ? 5 : 0
    const exposureBoost = Math.min(4, hit.exposureHits)
    return Math.min(20, recencyBoost + exposureBoost + hit.confirmedHits * 3)
  }

  private resolveIdleCandidateLevelStatus(
    levelStatus: AiAppMemoryManifest['levels'][keyof AiAppMemoryManifest['levels']] | undefined,
    phaseStatus: AiAppMemoryWarmupStatus | undefined,
    isActiveApp: boolean,
  ) {
    const normalizedLevelStatus = String(levelStatus || 'missing')
    if (isActiveApp) {
      return normalizedLevelStatus
    }
    if (
      phaseStatus === 'succeeded'
      && (normalizedLevelStatus === 'missing' || normalizedLevelStatus === 'failed' || normalizedLevelStatus === 'stale')
    ) {
      return 'ready'
    }
    return normalizedLevelStatus
  }

  private isIdle() {
    if (this.activeForegroundRequests > 0) {
      return false
    }
    return this.activityService.getGlobalIdleAgeMs() >= 45 * 1000
  }

  private isWarmupCancellationTriggered(cancellation?: WarmupCancellationContext) {
    return Boolean(
      cancellation
      && cancellation.active !== false
      && (
        cancellation.controller?.signal.aborted
        || !this.activityService.isEpochCurrent(cancellation.startedEpoch)
      ),
    )
  }

  private buildIdleDecision(
    phase: AiAppMemoryWarmupPhase,
    appId: string | undefined,
    featureFlags: Awaited<ReturnType<AiConfigService['getFeatureFlags']>>,
  ) {
    const now = Date.now()
    return buildWarmupIdleDecision({
      phase,
      scopedIdleAgeMs: this.activityService.getScopedIdleAgeMs(appId, now),
      globalIdleAgeMs: this.activityService.getGlobalIdleAgeMs(now),
      now,
      flags: featureFlags,
    })
  }

  private recordSchedulerDecision(patch: Partial<AiWarmupSchedulerDebugState>) {
    this.schedulerPausedReason = patch.pausedReason
    const activity = this.activityService.getSnapshot()
    this.schedulerLastDecision = {
      idleEligible: patch.idleEligible ?? this.isIdle(),
      idleAgeMs: Math.max(0, Math.round(Number(patch.idleAgeMs ?? activity.globalIdleAgeMs ?? 0))),
      requiredIdleMs: Math.max(0, Math.round(Number(patch.requiredIdleMs ?? 45 * 1000))),
      pausedReason: patch.pausedReason,
      nextEligibleAt: patch.nextEligibleAt,
      activityEpoch: activity.activityEpoch,
      queueDepth: this.inFlight.size,
      runningTaskKey: [...this.inFlight.keys()][0],
      lastCanceledAt: activity.lastWarmupCanceledAt,
      canceledCount: this.canceledByActivityCount,
      skippedBecauseActiveCount: this.skippedBecauseActiveCount,
    }
  }

  private recordIdleSweepCancellation(taskKey?: string) {
    const at = Date.now()
    this.canceledByActivityCount += 1
    this.activityService.markWarmupCanceled({ taskKey, at, reason: 'user_activity' })
    this.recordSchedulerDecision({
      idleEligible: false,
      idleAgeMs: this.activityService.getGlobalIdleAgeMs(at),
      requiredIdleMs: 45 * 1000,
      pausedReason: 'user_activity_recent',
    })
  }

  private async updateTerminalWarmupState(
    appId: string,
    phase: AiAppMemoryWarmupPhase,
    taskKey: string,
    startedAt: number,
    patch: WarmupStatePatch,
    cancellation?: WarmupCancellationContext,
    catalogTaskKey?: string,
  ) {
    if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
      return true
    }
    if (catalogTaskKey) {
      await this.updateWarmupState(appId, 'catalog', {
        status: patch.status,
        updatedAt: patch.updatedAt,
        durationMs: patch.durationMs,
        lastError: patch.lastError,
        taskKey: catalogTaskKey,
        queueDepth: patch.queueDepth,
      })
      if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
        return true
      }
    }
    await this.updateWarmupState(appId, phase, patch)
    if (await this.expireWarmupIfCanceled(appId, phase, taskKey, startedAt, cancellation, catalogTaskKey)) {
      return true
    }
    return false
  }

  private async expireWarmupIfCanceled(
    appId: string,
    phase: AiAppMemoryWarmupPhase,
    taskKey: string,
    startedAt: number,
    cancellation?: WarmupCancellationContext,
    catalogTaskKey?: string,
  ) {
    if (!this.isWarmupCancellationTriggered(cancellation)) {
      return false
    }
    if (cancellation?.cancellationRecorded) {
      return true
    }
    if (cancellation) {
      cancellation.cancellationRecorded = true
    }
    const canceledAt = Date.now()
    const queueDepth = this.resolveCompletedQueueDepth(taskKey)
    this.canceledByActivityCount += 1
    this.activityService.markWarmupCanceled({ taskKey, at: canceledAt, reason: 'user_activity' })
    this.recordSchedulerDecision({
      idleEligible: false,
      idleAgeMs: this.activityService.getGlobalIdleAgeMs(canceledAt),
      requiredIdleMs: 45 * 1000,
      pausedReason: 'user_activity_recent',
    })
    if (catalogTaskKey) {
      await this.updateWarmupState(appId, 'catalog', {
        status: 'expired',
        updatedAt: canceledAt,
        durationMs: canceledAt - startedAt,
        lastError: 'canceled_by_user_activity',
        taskKey: catalogTaskKey,
        queueDepth,
      })
    }
    await this.updateWarmupState(appId, phase, {
      status: 'expired',
      updatedAt: canceledAt,
      durationMs: canceledAt - startedAt,
      lastError: 'canceled_by_user_activity',
      taskKey,
      queueDepth,
    })
    return true
  }

  private toWarmupPhase(target: WarmupTargetLevel): 'catalog' | 'profile' {
    return target === 'catalog' ? 'catalog' : 'profile'
  }

  private buildBackgroundContext(
    phase: AiAppMemoryWarmupPhase,
    options?: {
      suppressWarmupTrace?: boolean
    },
  ): AiToolExecutionContext {
    return {
      accountId: 'system:warmup',
      accountName: 'system:warmup',
      traceId: `warmup:${phase}:${Date.now()}`,
      query: '',
      suppressWarmupTrace: options?.suppressWarmupTrace === true,
    }
  }

  private shouldScheduleDeepHotspot(manifest: AiAppMemoryManifest, hit?: RecentHit) {
    if (!hit || manifest.levels?.structure !== 'ready') {
      return false
    }
    const heatScore = hit.confirmedHits + hit.readHits * 2
    if (heatScore < 4) {
      return false
    }
    const plan = this.buildDeepRefreshPlanFromManifest(manifest, hit)
    if (!plan.sourceIds.length) {
      return false
    }
    const deepState = this.buildWarmupState(manifest.warmupState).phases.deep
    if (!this.hasNewDeepHotspotEvidence(deepState.hitWatermark, hit)) {
      return false
    }
    const lastUpdatedAt = Number(deepState.updatedAt || 0)
    const minIntervalMs = 30 * 60 * 1000
    if (deepState.status === 'failed' || deepState.status === 'missing' || deepState.status === 'expired') {
      return true
    }
    return Date.now() - lastUpdatedAt >= minIntervalMs
  }

  private buildDeepHitWatermark(hit?: RecentHit) {
    if (!hit) {
      return undefined
    }
    return {
      lastHitAt: Number(hit.lastHitAt || 0),
      exposureHits: Math.max(0, Number(hit.exposureHits || 0)),
      confirmedHits: Math.max(0, Number(hit.confirmedHits || 0)),
      memoryHits: Math.max(0, Number(hit.memoryHits || 0)),
      readHits: Math.max(0, Number(hit.readHits || 0)),
    }
  }

  private hasNewDeepHotspotEvidence(
    watermark: AiAppMemoryWarmupPhaseState['hitWatermark'] | undefined,
    hit: RecentHit,
  ) {
    if (!watermark) {
      return true
    }
    const confirmedHits = Math.max(0, Number(hit.confirmedHits || 0))
    const memoryHits = Math.max(0, Number(hit.memoryHits || 0))
    const readHits = Math.max(0, Number(hit.readHits || 0))
    const watermarkConfirmedHits = Math.max(0, Number(watermark.confirmedHits || 0))
    const watermarkMemoryHits = Math.max(0, Number(watermark.memoryHits || 0))
    const watermarkReadHits = Math.max(0, Number(watermark.readHits || 0))
    if (
      confirmedHits > watermarkConfirmedHits
      || memoryHits > watermarkMemoryHits
      || readHits > watermarkReadHits
    ) {
      return true
    }

    const hasEvidenceCount = confirmedHits > 0 || memoryHits > 0 || readHits > 0
    const isNewerHit = Number(hit.lastHitAt || 0) > Number(watermark.lastHitAt || 0)
    const countersMayHaveReset = confirmedHits < watermarkConfirmedHits
      || memoryHits < watermarkMemoryHits
      || readHits < watermarkReadHits
    return hasEvidenceCount && isNewerHit && countersMayHaveReset
  }

  private async buildDeepRefreshPlan(appId: string) {
    const manifest = await this.readNormalizedManifest(appId)
    return this.buildDeepRefreshPlanFromManifest(manifest, this.recentHits.get(appId))
  }

  private buildDeepRefreshPlanFromManifest(manifest: AiAppMemoryManifest | null, hit?: RecentHit) {
    if (!manifest || !hit) {
      return {
        sourceIds: [] as string[],
      }
    }

    const sourceIds = (manifest.sourceIndex || [])
      .filter(item =>
        item.levels?.structure === 'ready'
        && (item.kind === 'table' || item.kind === 'document-table')
      )
      .sort((left, right) =>
        this.computeDeepSourcePriority(right, manifest, hit) - this.computeDeepSourcePriority(left, manifest, hit)
        || left.sourceName.localeCompare(right.sourceName, 'zh-CN'),
      )
      .slice(0, manifest.appKind === 'mixed' ? 2 : 1)
      .map(item => item.sourceId)

    return {
      sourceIds,
    }
  }

  private computeDeepSourcePriority(
    source: AiAppMemoryManifest['sourceIndex'][number],
    manifest: AiAppMemoryManifest,
    hit: RecentHit,
  ) {
    const workflowBoost = source.hasWorkflow ? 6 : 0
    const viewBoost = source.viewTypes.includes('form') ? 4 : source.viewTypes.includes('table') ? 2 : 0
    const sizeBoost = source.rowCountBucket === 'huge'
      ? 5
      : source.rowCountBucket === 'large'
        ? 4
        : source.rowCountBucket === 'medium'
          ? 2
          : 0
    const mixedBoost = manifest.appKind === 'mixed' ? 2 : 0
    const readBoost = hit.readHits > 0 ? 3 : 0
    return workflowBoost + viewBoost + sizeBoost + mixedBoost + readBoost
  }

  private buildDeepTaskFingerprint(manifest: AiAppMemoryManifest | null, hit?: RecentHit) {
    const plan = this.buildDeepRefreshPlanFromManifest(manifest, hit)
    const pending = this.getSemanticBootstrapPendingFromManifest(manifest)
    const resolvedScope = this.resolvePendingSemanticScope(manifest, pending, plan)
    return [
      String(manifest?.fingerprint?.bodyHash || manifest?.fingerprint?.schemaHash || 'missing'),
      resolvedScope.selectedSourceIds.join(',') || 'no-source',
      resolvedScope.contextStrategy || 'legacy_hotspot',
    ].join('|')
  }

  private async markBootstrapPending(
    appId: string,
    reason: AiSemanticBootstrapPending['reason'],
    options?: {
      requestedSourceIds?: string[]
      traceId?: string
      toolCallId?: string
    },
  ) {
    await this.runPendingMutation(appId, async () => {
      const currentPending = await this.getSemanticBootstrapPending(appId)
      const pending = this.mergeSemanticBootstrapPending(currentPending, {
        appId,
        requestedAt: Date.now(),
        reason,
        retryCount: 0,
        requestedSourceIds: this.normalizePendingSourceIds(options?.requestedSourceIds),
        lastTriggerReason: reason,
        lastTriggerTraceId: String(options?.traceId || '').trim() || undefined,
        lastTriggerToolCallId: String(options?.toolCallId || '').trim() || undefined,
        lastTriggerAt: Date.now(),
      })
      const manifest = await this.readNormalizedManifest(appId)
      if (!manifest) {
        await this.markLedgerBootstrapPending(pending)
        return
      }
      const warmupState = this.buildWarmupState(manifest.warmupState)
      const previousDeepState = warmupState.phases.deep
      const shouldResetFailedDeepPhase = previousDeepState.status === 'failed'
        && this.getSemanticBootstrapPendingPriority(reason)
          > this.getSemanticBootstrapPendingPriority(currentPending?.reason)
      manifest.warmupState = {
        ...warmupState,
        semanticBootstrapPending: pending,
        phases: shouldResetFailedDeepPhase
          ? {
              ...warmupState.phases,
              deep: {
                status: 'missing',
                updatedAt: Date.now(),
              },
            }
          : warmupState.phases,
      }
      manifest.updatedAt = Date.now()
      await this.store.writeManifest(appId, manifest)
      this.rememberManifest(manifest)
      if (previousDeepState.status === 'failed') {
        await this.persistLedger()
        if (shouldResetFailedDeepPhase) {
          await this.updateWarmupState(appId, 'deep', {
            status: 'missing',
            updatedAt: Date.now(),
            message: `semantic bootstrap requested:${reason}`,
          })
        }
        return
      }
      await this.updateWarmupState(appId, 'deep', {
        status: 'missing',
        updatedAt: Date.now(),
        message: `semantic bootstrap requested:${reason}`,
      })
    })
  }

  private async markBootstrapFailure(appId: string, lastError: string, failedAt = Date.now()) {
    await this.runPendingMutation(appId, async () => {
      const current = await this.getSemanticBootstrapPending(appId)
      if (!current) {
        return
      }
      const retryCount = Math.max(0, Number(current.retryCount || 0)) + 1
      if (this.shouldStopBootstrapAutoRetry(lastError, retryCount)) {
        await this.clearSemanticBootstrapPendingInternal(appId)
        return
      }
      const backoffMs = this.resolveBootstrapBackoffMs(lastError, retryCount)
      await this.writeSemanticBootstrapPending(appId, {
        ...current,
        retryCount,
        lastAttemptAt: failedAt,
        nextRetryAt: failedAt + backoffMs,
        lastError,
      })
    })
  }

  private buildDeepFailureRetryPatch(appId: string, lastError: string, failedAt: number) {
    const manifest = this.knownManifests.get(appId) || null
    const currentRetryCount = Math.max(0, Number(manifest?.warmupState?.phases?.deep?.retryCount || 0))
    const retryCount = currentRetryCount + 1
    const backoffMs = this.resolveBootstrapBackoffMs(lastError, retryCount)
    return {
      retryCount,
      nextRetryAt: failedAt + backoffMs,
    }
  }

  private mergeSemanticBootstrapPending(
    current: SemanticBootstrapPendingWithScope | null,
    incoming: SemanticBootstrapPendingWithScope,
  ) {
    const incomingRequestedSourceIds = this.normalizePendingSourceIds((incoming as any)?.requestedSourceIds)
    const incomingLastTriggerReason = this.normalizeSemanticBootstrapPendingReason((incoming as any)?.lastTriggerReason)
    const incomingLastTriggerTraceId = String((incoming as any)?.lastTriggerTraceId || '').trim() || undefined
    const incomingLastTriggerToolCallId = String((incoming as any)?.lastTriggerToolCallId || '').trim() || undefined
    const incomingLastTriggerAt = Number((incoming as any)?.lastTriggerAt || 0) || Number(incoming.requestedAt || 0) || Date.now()
    if (!current) {
      return {
        ...incoming,
        requestedSourceIds: incomingRequestedSourceIds,
        mergedSourceIds: [],
        lastTriggerReason: incomingLastTriggerReason || incoming.reason,
        lastTriggerTraceId: incomingLastTriggerTraceId,
        lastTriggerToolCallId: incomingLastTriggerToolCallId,
        lastTriggerAt: incomingLastTriggerAt,
      }
    }
    const currentRequestedSourceIds = this.normalizePendingSourceIds((current as any)?.requestedSourceIds)
    const currentMergedSourceIds = this.normalizePendingSourceIds((current as any)?.mergedSourceIds)
    const mergedSourceIds = this.mergePendingScopeSourceIds(
      [...currentRequestedSourceIds, ...currentMergedSourceIds],
      incomingRequestedSourceIds,
    )
    if (this.isSemanticBootstrapPendingStopped(current)) {
      return {
        ...incoming,
        retryCount: 0,
        lastAttemptAt: undefined,
        nextRetryAt: undefined,
        lastError: undefined,
        autoRetryStoppedAt: undefined,
        requestedSourceIds: incomingRequestedSourceIds,
        mergedSourceIds,
        lastTriggerReason: incomingLastTriggerReason || incoming.reason,
        lastTriggerTraceId: incomingLastTriggerTraceId,
        lastTriggerToolCallId: incomingLastTriggerToolCallId,
        lastTriggerAt: incomingLastTriggerAt,
      }
    }
    const currentPriority = this.getSemanticBootstrapPendingPriority(current.reason)
    const incomingPriority = this.getSemanticBootstrapPendingPriority(incoming.reason)
    if (incomingPriority < currentPriority) {
      return {
        ...current,
        requestedAt: Math.max(Number(current.requestedAt || 0), Number(incoming.requestedAt || 0)),
        requestedSourceIds: incomingRequestedSourceIds,
        mergedSourceIds,
        lastTriggerReason: incomingLastTriggerReason || incoming.reason,
        lastTriggerTraceId: incomingLastTriggerTraceId,
        lastTriggerToolCallId: incomingLastTriggerToolCallId,
        lastTriggerAt: incomingLastTriggerAt,
      }
    }
    if (incomingPriority === currentPriority) {
      return {
        ...current,
        requestedAt: Math.max(Number(current.requestedAt || 0), Number(incoming.requestedAt || 0)),
        reason: incoming.reason,
        requestedSourceIds: incomingRequestedSourceIds,
        mergedSourceIds,
        lastTriggerReason: incomingLastTriggerReason || incoming.reason,
        lastTriggerTraceId: incomingLastTriggerTraceId,
        lastTriggerToolCallId: incomingLastTriggerToolCallId,
        lastTriggerAt: incomingLastTriggerAt,
      }
    }
    return {
      ...current,
      ...incoming,
      retryCount: incomingPriority > currentPriority
        ? 0
        : Math.max(0, Number(current.retryCount || 0)),
      lastAttemptAt: incomingPriority > currentPriority
        ? undefined
        : current.lastAttemptAt,
      nextRetryAt: incomingPriority > currentPriority
        ? undefined
        : current.nextRetryAt,
      lastError: incomingPriority > currentPriority
        ? undefined
        : current.lastError,
      requestedSourceIds: incomingRequestedSourceIds,
      mergedSourceIds,
      lastTriggerReason: incomingLastTriggerReason || incoming.reason,
      lastTriggerTraceId: incomingLastTriggerTraceId,
      lastTriggerToolCallId: incomingLastTriggerToolCallId,
      lastTriggerAt: incomingLastTriggerAt,
    }
  }

  private getSemanticBootstrapPendingPriority(reason?: AiSemanticBootstrapPending['reason']) {
    switch (reason) {
      case 'ai-permission':
        return 3
      case 'create':
      case 'import':
      case 'publish':
        return 2
      case 'search_top1':
      case 'get_app_memory':
      default:
        return 1
    }
  }

  private async writeSemanticBootstrapPending(appId: string, pending: SemanticBootstrapPendingWithScope) {
    const manifest = await this.readNormalizedManifest(appId)
    if (!manifest) {
      await this.markLedgerBootstrapPending(pending)
      return
    }
    manifest.warmupState = {
      ...this.buildWarmupState(manifest.warmupState),
      semanticBootstrapPending: pending,
    }
    manifest.updatedAt = Date.now()
    await this.store.writeManifest(appId, manifest)
    this.rememberManifest(manifest)
  }

  private async consumeSemanticBootstrapPending(
    appId: string,
    result: RefreshSemanticMemoryResult | null,
    options?: {
      allowSelectedSourceFallback?: boolean
    },
  ) {
    await this.runPendingMutation(appId, async () => {
      const current = await this.getSemanticBootstrapPending(appId)
      if (!current) {
        return
      }
      let consumedSourceIds = this.normalizePendingSourceIds((result as any)?.refreshedSourceIds)
      if (!consumedSourceIds.length && options?.allowSelectedSourceFallback) {
        consumedSourceIds = this.normalizePendingSourceIds((result as any)?.selectedSourceIds)
      }
      if (!consumedSourceIds.length) {
        return
      }
      const requestedSourceIds = this.normalizePendingSourceIds((current as any)?.requestedSourceIds)
        .filter(item => !consumedSourceIds.includes(item))
      const mergedSourceIds = this.normalizePendingSourceIds((current as any)?.mergedSourceIds)
        .filter(item => !consumedSourceIds.includes(item) && !requestedSourceIds.includes(item))
      if (!requestedSourceIds.length && !mergedSourceIds.length) {
        await this.clearSemanticBootstrapPendingInternal(appId)
        return
      }
      await this.writeSemanticBootstrapPending(appId, {
        ...current,
        requestedSourceIds,
        mergedSourceIds,
      })
    })
  }

  private async getSemanticBootstrapPending(appId: string) {
    const manifest = await this.readNormalizedManifest(appId)
    return this.getSemanticBootstrapPendingFromManifest(manifest)
      || this.getLedgerBootstrapPending(appId)
  }

  private getSemanticBootstrapPendingFromManifest(manifest: AiAppMemoryManifest | null): SemanticBootstrapPendingWithScope | null {
    return ((manifest?.warmupState as any)?.semanticBootstrapPending || null) as SemanticBootstrapPendingWithScope | null
  }

  private async markLedgerBootstrapPending(pending: SemanticBootstrapPendingWithScope) {
    await this.hydrateLedgerBootstrapPending()
    this.semanticBootstrapPendingByAppId.set(pending.appId, pending)
    this.pushLedgerEvent({
      id: `${pending.appId}:semantic-bootstrap:${pending.requestedAt}`,
      kind: 'warmup',
      appId: pending.appId,
      phase: 'deep',
      status: 'missing',
      updatedAt: pending.requestedAt,
      message: `semantic bootstrap requested before manifest:${pending.reason}`,
    })
    await this.persistLedger()
  }

  private getLedgerBootstrapPending(appId: string): SemanticBootstrapPendingWithScope | null {
    return this.semanticBootstrapPendingByAppId.get(appId) || null
  }

  private async hydrateLedgerBootstrapPending() {
    if (this.ledgerBootstrapPendingHydrated) {
      return
    }
    this.ledgerBootstrapPendingHydrated = true
    const ledger = await this.store.readWarmupLedger().catch(() => null)
    const pendingMap = ledger?.semanticBootstrapPendingApps || {}
    for (const [appId, pending] of Object.entries(pendingMap)) {
      const normalizedAppId = String(appId || '').trim()
      if (!normalizedAppId) {
        continue
      }
      this.semanticBootstrapPendingByAppId.set(normalizedAppId, {
        appId: normalizedAppId,
        requestedAt: Number((pending as any)?.requestedAt || Date.now()),
        reason: (pending as any)?.reason || 'create',
        retryCount: Math.max(0, Number((pending as any)?.retryCount || 0)),
        lastAttemptAt: Number((pending as any)?.lastAttemptAt || 0) || undefined,
        nextRetryAt: Number((pending as any)?.nextRetryAt || 0) || undefined,
        lastError: String((pending as any)?.lastError || '').trim() || undefined,
        autoRetryStoppedAt: Number((pending as any)?.autoRetryStoppedAt || 0) || undefined,
        requestedSourceIds: this.normalizePendingSourceIds((pending as any)?.requestedSourceIds),
        mergedSourceIds: this.normalizePendingSourceIds((pending as any)?.mergedSourceIds),
        lastTriggerReason: this.normalizeSemanticBootstrapPendingReason((pending as any)?.lastTriggerReason)
          || ((pending as any)?.reason || 'create'),
        lastTriggerTraceId: String((pending as any)?.lastTriggerTraceId || '').trim() || undefined,
        lastTriggerToolCallId: String((pending as any)?.lastTriggerToolCallId || '').trim() || undefined,
        lastTriggerAt: Number((pending as any)?.lastTriggerAt || 0) || Number((pending as any)?.requestedAt || 0) || undefined,
      })
    }
  }

  private async migrateLedgerBootstrapPendingToManifest(manifest: AiAppMemoryManifest) {
    await this.hydrateLedgerBootstrapPending()
    const pending = this.semanticBootstrapPendingByAppId.get(manifest.appId)
    if (!pending || (manifest.warmupState as any)?.semanticBootstrapPending) {
      return manifest
    }
    this.semanticBootstrapPendingByAppId.delete(manifest.appId)
    const nextManifest = {
      ...manifest,
      warmupState: {
        ...this.buildWarmupState(manifest.warmupState),
        semanticBootstrapPending: pending,
      },
      updatedAt: Date.now(),
    }
    await this.store.writeManifest(manifest.appId, nextManifest)
    this.rememberManifest(nextManifest)
    await this.persistLedger()
    return nextManifest
  }

  private async clearSemanticBootstrapPending(appId: string) {
    await this.runPendingMutation(appId, async () => {
      await this.clearSemanticBootstrapPendingInternal(appId)
    })
  }

  private async recordDeepWarmupTrace(
    appId: string,
    context: AiToolExecutionContext,
    scope: {
      requestedSourceIds: string[]
      mergedSourceIds: string[]
      selectedSourceIds: string[]
      contextStrategy?: AiAppMemoryWarmupPhaseState['contextStrategy']
      skipReason?: AiAppMemoryWarmupPhaseState['skipReason']
    },
  ) {
    if (context.suppressWarmupTrace) {
      return
    }

    await this.recordToolTrace({
      id: [
        'deep',
        context.traceId || 'no-trace',
        context.toolCallId || 'no-tool-call',
        appId,
        Date.now(),
      ].join(':'),
      kind: 'get_app_memory',
      traceId: context.traceId,
      toolCallId: context.toolCallId,
      appId,
      updatedAt: Date.now(),
      semanticRequestedSourceIds: scope.requestedSourceIds,
      semanticMergedSourceIds: scope.mergedSourceIds,
      semanticSelectedSourceIds: scope.selectedSourceIds,
      semanticContextStrategy: scope.contextStrategy,
      semanticSkippedReason: scope.skipReason,
    })
  }

  private async clearSemanticBootstrapPendingInternal(appId: string) {
    const manifest = await this.readNormalizedManifest(appId)
    await this.hydrateLedgerBootstrapPending()
    this.semanticBootstrapPendingByAppId.delete(appId)
    if (manifest && (manifest.warmupState as any)?.semanticBootstrapPending) {
      const warmupState = {
        ...this.buildWarmupState(manifest.warmupState),
      } as any
      delete warmupState.semanticBootstrapPending
      manifest.warmupState = warmupState
      manifest.updatedAt = Date.now()
      await this.store.writeManifest(appId, manifest)
      this.rememberManifest(manifest)
    }
    await this.persistLedger()
  }

  private async runPendingMutation<T>(appId: string, task: () => Promise<T>) {
    const normalizedAppId = String(appId || '').trim()
    if (!normalizedAppId) {
      return await task()
    }
    const previous = this.pendingMutationChains.get(normalizedAppId) || Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => {
      release = resolve
    })
    this.pendingMutationChains.set(normalizedAppId, previous.catch(() => undefined).then(() => current))
    await previous.catch(() => undefined)
    try {
      return await task()
    } finally {
      release()
      if (this.pendingMutationChains.get(normalizedAppId) === current) {
        this.pendingMutationChains.delete(normalizedAppId)
      }
    }
  }

  private shouldScheduleBootstrapSemanticWarmup(
    manifest: AiAppMemoryManifest | null,
    bootstrapIdleEnabled: boolean,
  ) {
    if (!bootstrapIdleEnabled || !manifest || manifest.levels?.structure !== 'ready') {
      return false
    }
    const pending = this.getSemanticBootstrapPendingFromManifest(manifest)
    if (!pending) {
      return false
    }
    if (this.isSemanticBootstrapPendingStopped(pending)) {
      return false
    }
    const nextRetryAt = Number(pending.nextRetryAt || 0)
    return !nextRetryAt || nextRetryAt <= Date.now()
  }

  private resolveDeepBackoffUntil(manifest: AiAppMemoryManifest | null) {
    if (!manifest) {
      return 0
    }
    const warmupState = this.buildWarmupState(manifest.warmupState)
    const phaseNextRetryAt = Number(warmupState.phases.deep?.nextRetryAt || 0)
    const pendingNextRetryAt = Number(warmupState.semanticBootstrapPending?.nextRetryAt || 0)
    return Math.max(phaseNextRetryAt, pendingNextRetryAt)
  }

  private isDeepBackoffActive(manifest: AiAppMemoryManifest | null, now = Date.now()) {
    const nextRetryAt = this.resolveDeepBackoffUntil(manifest)
    return Boolean(nextRetryAt && nextRetryAt > now)
  }

  private isSemanticBootstrapPendingStopped(pending: AiSemanticBootstrapPending | null) {
    if (!pending) {
      return false
    }
    if (Number(pending.autoRetryStoppedAt || 0) > 0) {
      return true
    }
    return this.shouldStopBootstrapAutoRetry(
      String(pending.lastError || ''),
      Number(pending.retryCount || 0),
    )
  }

  private shouldStopBootstrapAutoRetry(lastError: string, retryCount: number) {
    if (retryCount < MAX_GENERIC_BOOTSTRAP_RETRY_COUNT) {
      return false
    }
    const normalizedError = String(lastError || '').toLowerCase()
    if (
      normalizedError.includes('401')
      || normalizedError.includes('402')
      || normalizedError.includes('unauthorized')
      || normalizedError.includes('authentication')
      || normalizedError.includes('insufficient points')
      || normalizedError.includes('missing timestamp')
    ) {
      return false
    }
    return true
  }

  private mapDeepFailureReason(lastError: string) {
    const normalized = String(lastError || '').toLowerCase()
    if (normalized.includes('invalid result payload')) return 'invalid_result_payload'
    if (normalized.includes('no effective semantic refresh')) return 'no_effective_progress'
    if (
      normalized.includes('401')
      || normalized.includes('unauthorized')
      || normalized.includes('authentication')
    ) {
      return 'provider_auth'
    }
    if (normalized.includes('402') || normalized.includes('insufficient points')) {
      return 'provider_quota'
    }
    if (
      normalized.includes('timeout')
      || normalized.includes('timed out')
      || normalized.includes('time-out')
      || normalized.includes('504')
    ) {
      return 'provider_timeout'
    }
    return 'provider_unknown'
  }

  private resolveSemanticDeepSourceIds(
    manifest: AiAppMemoryManifest | null,
    deepPlan: { sourceIds: string[] },
    bootstrapPending: AiSemanticBootstrapPending | null,
  ) {
    if (deepPlan.sourceIds.length) {
      return deepPlan.sourceIds
    }
    if (!bootstrapPending || !manifest) {
      return []
    }
    return this.buildBootstrapSemanticSourceIds(manifest)
  }

  private resolvePendingSemanticScope(
    manifest: AiAppMemoryManifest | null,
    bootstrapPending: AiSemanticBootstrapPending | null,
    deepPlan: { sourceIds: string[] },
  ): ResolvedPendingSemanticScope {
    const rawRequestedSourceIds = this.normalizePendingSourceIds((bootstrapPending as any)?.requestedSourceIds)
    const rawMergedSourceIds = this.normalizePendingSourceIds((bootstrapPending as any)?.mergedSourceIds)
    const allowedSourceIds = new Set(
      (Array.isArray(manifest?.sourceIndex) ? manifest?.sourceIndex : [])
        .filter(item =>
          item?.levels?.structure === 'ready'
          && (item.kind === 'table' || item.kind === 'document-table'),
        )
        .map(item => String(item.sourceId || '').trim())
        .filter(Boolean),
    )
    const requestedSourceIds = rawRequestedSourceIds
      .filter(item => allowedSourceIds.has(item))
    const mergedSourceIds = rawMergedSourceIds
      .filter(item => allowedSourceIds.has(item) && !requestedSourceIds.includes(item))
    if (requestedSourceIds.length > 0) {
      return {
        requestedSourceIds,
        mergedSourceIds,
        selectedSourceIds: requestedSourceIds,
        contextStrategy: mergedSourceIds.length > 0 ? 'request_plus_merged' : 'request_only',
        allowLegacySelection: false,
        hasPermissionScopedPending: true,
      }
    }
    if (mergedSourceIds.length > 0) {
      return {
        requestedSourceIds,
        mergedSourceIds,
        selectedSourceIds: mergedSourceIds,
        contextStrategy: 'request_plus_merged',
        allowLegacySelection: false,
        hasPermissionScopedPending: true,
      }
    }
    if (rawRequestedSourceIds.length > 0 || rawMergedSourceIds.length > 0) {
      return {
        requestedSourceIds: [],
        mergedSourceIds: [],
        selectedSourceIds: [],
        contextStrategy: rawMergedSourceIds.length > 0 ? 'request_plus_merged' : 'request_only',
        allowLegacySelection: false,
        hasPermissionScopedPending: true,
      }
    }
    return {
      requestedSourceIds: [],
      mergedSourceIds: [],
      selectedSourceIds: deepPlan.sourceIds.length > 0
        ? deepPlan.sourceIds
        : this.resolveSemanticDeepSourceIds(manifest, deepPlan, bootstrapPending),
      contextStrategy: 'legacy_hotspot',
      allowLegacySelection: true,
      hasPermissionScopedPending: Boolean(bootstrapPending),
    }
  }

  private classifyDeepEligibility(manifest: AiAppMemoryManifest | null) {
    const sourceIndex = Array.isArray(manifest?.sourceIndex) ? manifest.sourceIndex : []
    if (!sourceIndex.length) {
      return {
        eligibleSourceCount: 0,
        nonEligibleReason: 'empty_source_index' as const,
      }
    }

    const recordSources = sourceIndex.filter(item => item.kind === 'table' || item.kind === 'document-table')
    if (!recordSources.length) {
      return {
        eligibleSourceCount: 0,
        nonEligibleReason: 'no_record_sources' as const,
      }
    }

    const structureReadyRecordSources = recordSources.filter(item => item.levels?.structure === 'ready')
    if (!structureReadyRecordSources.length) {
      return {
        eligibleSourceCount: 0,
        nonEligibleReason: 'no_structure_ready_record_sources' as const,
      }
    }

    return {
      eligibleSourceCount: structureReadyRecordSources.length,
      nonEligibleReason: undefined,
    }
  }

  private buildBootstrapSemanticSourceIds(manifest: AiAppMemoryManifest) {
    return (manifest.sourceIndex || [])
      .filter(item =>
        item.levels?.structure === 'ready'
        && (item.kind === 'table' || item.kind === 'document-table'),
      )
      .sort((left, right) =>
        Number(Boolean(right.hasWorkflow)) - Number(Boolean(left.hasWorkflow))
        || this.resolveRolePriority(right.role) - this.resolveRolePriority(left.role)
        || left.sourceName.localeCompare(right.sourceName, 'zh-CN'),
      )
      .slice(0, manifest.appKind === 'mixed' ? 2 : 1)
      .map(item => item.sourceId)
  }

  private resolveRolePriority(role?: string) {
    switch (role) {
      case 'transaction':
        return 3
      case 'master':
        return 2
      case 'log':
        return 1
      default:
        return 0
    }
  }

  private async runMaintenanceSweep(
    activeAppIds: Set<string>,
    manifestByAppId: Map<string, AiAppMemoryManifest | null>,
  ) {
    const now = Date.now()
    const storedAppIds = new Set(await this.listStoredAppMemoryAppIds())
    const zombieThresholdMs = 10 * 60 * 1000
    const stalePhaseThresholdMs = 20 * 60 * 1000
    let expiredTaskCount = 0
    let cleanedAppCount = 0

    for (const [appId, manifest] of manifestByAppId.entries()) {
      if (!activeAppIds.has(appId)) {
        const shouldRetainInactivePendingBootstrap = this.shouldRetainInactivePendingBootstrap(manifest)
        if (shouldRetainInactivePendingBootstrap) {
          this.rememberManifest(manifest)
          continue
        }
        if (storedAppIds.has(appId)) {
          await this.clearStoredAppMemory(appId)
          cleanedAppCount += 1
          this.pushLedgerEvent({
            id: `maintenance:${appId}:clear-app-memory:${now}`,
            kind: 'maintenance',
            appId,
            status: 'expired',
            updatedAt: now,
            message: `${appId} cleared by maintenance sweep because it is no longer visible on workbench home`,
          })
        }
        this.knownManifests.delete(appId)
        this.semanticBootstrapPendingByAppId.delete(appId)
        this.recentHits.delete(appId)
        continue
      }

      if (!manifest) {
        continue
      }

      const nextWarmupState = this.buildWarmupState(manifest.warmupState)
      let changed = false
      if (this.isSemanticBootstrapPendingStopped(nextWarmupState.semanticBootstrapPending || null)) {
        delete (nextWarmupState as any).semanticBootstrapPending
        this.semanticBootstrapPendingByAppId.delete(appId)
        changed = true
        this.pushLedgerEvent({
          id: `maintenance:${appId}:semantic-bootstrap:${now}:cleared`,
          kind: 'maintenance',
          appId,
          phase: 'deep',
          status: 'expired',
          updatedAt: now,
          message: `${appId} semantic bootstrap pending cleared by maintenance sweep`,
        })
      }
      for (const phase of ['catalog', 'profile', 'deep'] as AiAppMemoryWarmupPhase[]) {
        const phaseState = nextWarmupState.phases[phase]
        if (!phaseState || !['queued', 'running'].includes(phaseState.status)) {
          continue
        }
        const updatedAt = Number(phaseState.updatedAt || 0)
        if (!updatedAt || now - updatedAt < stalePhaseThresholdMs) {
          continue
        }
        const taskKey = String(phaseState.taskKey || '').trim()
        if (taskKey && this.inFlight.has(taskKey)) {
          continue
        }
        nextWarmupState.phases[phase] = {
          ...phaseState,
          status: 'expired',
          updatedAt: now,
          lastError: phaseState.lastError || 'maintenance_expired_stale_phase',
        }
        changed = true
        expiredTaskCount += 1
        this.pushLedgerEvent({
          id: `maintenance:${appId}:${phase}:${now}:expired`,
          kind: 'maintenance',
          appId,
          phase,
          status: 'expired',
          taskKey: taskKey || undefined,
          updatedAt: now,
          message: `${appId} ${phase} expired by maintenance sweep`,
        })
      }

      if (changed) {
        manifest.warmupState = nextWarmupState
        manifest.updatedAt = now
        await this.store.writeManifest(appId, manifest)
        this.rememberManifest(manifest)
      }
    }

    for (const appId of [...this.knownManifests.keys()]) {
      if (!activeAppIds.has(appId) && !manifestByAppId.has(appId)) {
        this.knownManifests.delete(appId)
        cleanedAppCount += 1
      }
    }

    const zombieTaskKeys = [...this.taskMeta.entries()]
      .filter(([taskKey, meta]) =>
        this.inFlight.has(taskKey)
        && now - Number(meta.startedAt || meta.queuedAt || now) >= zombieThresholdMs,
      )
      .map(([taskKey]) => taskKey)
      .sort()
    const zombieTaskCount = zombieTaskKeys.length

    this.maintenanceState = {
      ...this.maintenanceState,
      lastSweepAt: now,
      lastCleanupAt: expiredTaskCount > 0 || cleanedAppCount > 0
        ? now
        : this.maintenanceState.lastCleanupAt,
      expiredTaskCount,
      zombieTaskCount,
      cleanedAppCount,
      zombieTaskKeys,
    }

    if (cleanedAppCount > 0) {
      this.pushLedgerEvent({
        id: `maintenance:cleanup-manifests:${now}`,
        kind: 'maintenance',
        status: 'expired',
        updatedAt: now,
        message: `maintenance removed ${cleanedAppCount} inactive manifest snapshots from ledger cache`,
      })
    }
    if (zombieTaskCount > 0) {
      this.pushLedgerEvent({
        id: `maintenance:zombie:${now}`,
        kind: 'maintenance',
        status: 'running',
        updatedAt: now,
        queueDepth: this.inFlight.size,
        message: `maintenance detected ${zombieTaskCount} long-running warmup tasks`,
      })
    }
  }

  private bumpRecentHits(appIds: string[], patch: Partial<RecentHit>) {
    const now = Date.now()
    appIds
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .forEach(appId => {
        const current = this.recentHits.get(appId) || {
          lastHitAt: now,
          exposureHits: 0,
          confirmedHits: 0,
          memoryHits: 0,
          readHits: 0,
        }
        this.recentHits.set(appId, {
          lastHitAt: now,
          exposureHits: current.exposureHits + Number(patch.exposureHits || 0),
          confirmedHits: current.confirmedHits + Number(patch.confirmedHits || 0),
          memoryHits: current.memoryHits + Number(patch.memoryHits || 0),
          readHits: current.readHits + Number(patch.readHits || 0),
        })
      })
  }

  private pruneRecentHits() {
    const expiredBefore = Date.now() - 24 * 60 * 60 * 1000
    let prunedCount = 0
    for (const [appId, hit] of this.recentHits.entries()) {
      if (hit.lastHitAt < expiredBefore) {
        this.recentHits.delete(appId)
        prunedCount += 1
      }
    }
    return prunedCount
  }

  private async withTimeout<T, F = undefined>(promise: Promise<T>, timeoutMs: number, fallbackValue?: F) {
    if (!timeoutMs || timeoutMs <= 0) {
      return await promise
    }
    return await Promise.race([
      promise,
      new Promise<F | undefined>(resolve => {
        const timer = setTimeout(() => resolve(fallbackValue), timeoutMs)
        const unref = (timer as { unref?: () => void }).unref
        if (typeof unref === 'function') {
          unref.call(timer)
        }
      }),
    ])
  }

  private rememberManifest(manifest?: AiAppMemoryManifest | null) {
    if (!manifest?.appId) {
      return
    }
    this.knownManifests.set(manifest.appId, manifest)
  }

  private async refreshIdleCandidate(
    candidate: {
      appId: string
      phase: AiAppMemoryWarmupPhase
      priority: number
    },
    activeAppIds: Set<string>,
    featureFlags: Awaited<ReturnType<AiConfigService['getFeatureFlags']>>,
  ) {
    const manifest = await this.readNormalizedManifest(candidate.appId)
    const hit = this.recentHits.get(candidate.appId)
    const recentBoost = this.getRecentHitPriority(hit)
    return this.pickCandidatePhase(
      candidate.appId,
      manifest,
      hit,
      recentBoost,
      featureFlags,
      activeAppIds.has(candidate.appId),
    )
  }

  private shouldClearBootstrapPendingForNoEligible(
    nonEligibleReason?: ReturnType<AiAppMemoryWarmupService['classifyDeepEligibility']>['nonEligibleReason'],
  ) {
    return nonEligibleReason === 'empty_source_index' || nonEligibleReason === 'no_record_sources'
  }

  private async hydrateKnownManifests() {
    const metas = await this.listVisibleWarmupMetas()
    const knownAppIds = new Set<string>()

    for (const meta of Array.isArray(metas) ? metas : []) {
      const appId = String(meta?.id || '').trim()
      if (!appId) {
        continue
      }
      knownAppIds.add(appId)
      await this.readNormalizedManifest(appId)
    }

    for (const appId of await this.listStoredAppMemoryAppIds()) {
      if (knownAppIds.has(appId)) {
        await this.readNormalizedManifest(appId)
        continue
      }
      const manifest = await this.readNormalizedManifest(appId)
      if (this.shouldRetainInactivePendingBootstrap(manifest)) {
        this.rememberManifest(manifest)
        continue
      }
      await this.clearStoredAppMemory(appId)
      this.knownManifests.delete(appId)
      this.semanticBootstrapPendingByAppId.delete(appId)
      this.recentHits.delete(appId)
    }

    for (const appId of [...this.knownManifests.keys()]) {
      if (!knownAppIds.has(appId) && !this.shouldRetainInactivePendingBootstrap(this.knownManifests.get(appId) || null)) {
        this.knownManifests.delete(appId)
      }
    }
  }

  private async listVisibleWarmupMetas() {
    const listVisibleMetas = (this.projectService as ProjectService & {
      getVisibleWarmupNocodeMetas?: () => Promise<Array<{ id?: string; deleted?: boolean }>>
    }).getVisibleWarmupNocodeMetas
    if (typeof listVisibleMetas !== 'function') {
      const metas = await this.projectService.getAllNocodeMetas().catch(() => [])
      return (Array.isArray(metas) ? metas : [])
        .filter(meta => !meta?.deleted)
    }
    const metas = await listVisibleMetas.call(this.projectService).catch(() => [])
    return Array.isArray(metas) ? metas : []
  }

  private async clearStoredAppMemory(appId: string) {
    const clearAppMemory = (this.store as AiAppMemoryStore & {
      clearAppMemory?: (targetAppId: string) => Promise<void>
    }).clearAppMemory
    if (typeof clearAppMemory !== 'function') {
      return
    }
    await clearAppMemory.call(this.store, appId).catch(() => undefined)
  }

  private async hydrateWarmupTraces() {
    if (this.tracesHydrated) {
      return
    }
    this.tracesHydrated = true
    const traces = await this.store.readWarmupTraces().catch(() => null)
    this.warmupTraces = Array.isArray(traces)
      ? traces
        .map(item => this.normalizeWarmupTrace(item))
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, AiAppMemoryWarmupService.MAX_TRACE_COUNT)
      : []
  }

  private normalizeWarmupTrace(trace: WarmupTraceWithScope): WarmupTraceWithScope {
    const updatedAt = Number(trace?.updatedAt || Date.now())
    const semanticScheduleReason = String(trace?.semanticScheduleReason || '').trim()
    return {
      ...trace,
      id: String(trace?.id || `trace:${updatedAt}:${Math.random().toString(36).slice(2, 8)}`),
      kind: trace?.kind || 'search_apps',
      traceId: String(trace?.traceId || '').trim() || undefined,
      toolCallId: String(trace?.toolCallId || '').trim() || undefined,
      round: Number.isFinite(Number(trace?.round)) ? Number(trace.round) : undefined,
      appId: String(trace?.appId || '').trim() || undefined,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
      durationMs: Number.isFinite(Number(trace?.durationMs)) ? Number(trace.durationMs) : undefined,
      intent: trace?.intent || undefined,
      keywords: Array.isArray(trace?.keywords) ? trace.keywords.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      coldPrimeAppIds: Array.isArray(trace?.coldPrimeAppIds) ? trace.coldPrimeAppIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      neutralStructurePrimeAppIds: Array.isArray(trace?.neutralStructurePrimeAppIds) ? trace.neutralStructurePrimeAppIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      topCandidateStructurePrimeAppIds: Array.isArray(trace?.topCandidateStructurePrimeAppIds) ? trace.topCandidateStructurePrimeAppIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      returnedAppIds: Array.isArray(trace?.returnedAppIds) ? trace.returnedAppIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      appIds: Array.isArray(trace?.appIds) ? trace.appIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      targetIds: Array.isArray(trace?.targetIds) ? trace.targetIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      sourceIds: Array.isArray(trace?.sourceIds) ? trace.sourceIds.map(item => String(item || '').trim()).filter(Boolean) : undefined,
      topCandidateAppId: String(trace?.topCandidateAppId || '').trim() || undefined,
      convergence: trace?.convergence || undefined,
      targetLevel: trace?.targetLevel || undefined,
      joinTimeoutMs: Number.isFinite(Number(trace?.joinTimeoutMs)) ? Number(trace.joinTimeoutMs) : undefined,
      scheduledCount: Number.isFinite(Number(trace?.scheduledCount)) ? Number(trace.scheduledCount) : undefined,
      settledCount: Number.isFinite(Number(trace?.settledCount)) ? Number(trace.settledCount) : undefined,
      timeoutCount: Number.isFinite(Number(trace?.timeoutCount)) ? Number(trace.timeoutCount) : undefined,
      failedCount: Number.isFinite(Number(trace?.failedCount)) ? Number(trace.failedCount) : undefined,
      requestedLevel: trace?.requestedLevel || undefined,
      beforeCatalogLevel: String(trace?.beforeCatalogLevel || '').trim() || undefined,
      beforeStructureLevel: String(trace?.beforeStructureLevel || '').trim() || undefined,
      afterCatalogLevel: String(trace?.afterCatalogLevel || '').trim() || undefined,
      afterStructureLevel: String(trace?.afterStructureLevel || '').trim() || undefined,
      onsiteBuildMs: Number.isFinite(Number(trace?.onsiteBuildMs)) ? Number(trace.onsiteBuildMs) : undefined,
      accessibleAppCount: Number.isFinite(Number(trace?.accessibleAppCount)) ? Number(trace.accessibleAppCount) : undefined,
      manifestReadyCount: Number.isFinite(Number(trace?.manifestReadyCount)) ? Number(trace.manifestReadyCount) : undefined,
      coldAppCount: Number.isFinite(Number(trace?.coldAppCount)) ? Number(trace.coldAppCount) : undefined,
      requiresDisambiguation: trace?.requiresDisambiguation === true,
      mode: trace?.mode || undefined,
      resultKind: String(trace?.resultKind || '').trim() || undefined,
      partial: trace?.partial === true,
      failedTargetCount: Number.isFinite(Number(trace?.failedTargetCount)) ? Number(trace.failedTargetCount) : undefined,
      semanticScheduled: trace?.semanticScheduled === true,
      semanticScheduleReason: SEMANTIC_SCHEDULE_REASONS.includes(semanticScheduleReason as SemanticScheduleReason)
        ? semanticScheduleReason as SemanticScheduleReason
        : undefined,
      semanticRequestedSourceIds: this.normalizePendingSourceIds((trace as any)?.semanticRequestedSourceIds),
      semanticMergedSourceIds: this.normalizePendingSourceIds((trace as any)?.semanticMergedSourceIds),
      semanticSelectedSourceIds: this.normalizePendingSourceIds((trace as any)?.semanticSelectedSourceIds),
      semanticContextStrategy: (trace as any)?.semanticContextStrategy || undefined,
      semanticSkippedReason: (trace as any)?.semanticSkippedReason || undefined,
      semanticWarmupHit: trace?.semanticWarmupHit === true,
      semanticSummaryAvailable: trace?.semanticSummaryAvailable === true,
    }
  }

  private async readNormalizedManifest(appId: string) {
    const manifest = await this.store.readManifest(appId)
    if (!manifest) {
      return null
    }

    const normalized = this.normalizeManifestState(manifest)
    if (normalized.changed) {
      normalized.manifest.updatedAt = Date.now()
      await this.store.writeManifest(appId, normalized.manifest)
    }
    const migrated = await this.migrateLedgerBootstrapPendingToManifest(normalized.manifest)
    this.rememberManifest(migrated)
    return migrated
  }

  private buildWarmupState(state?: AiAppMemoryManifest['warmupState'] | null) {
    const deepStatus = state?.phases?.deep?.status || 'missing'
    const deepRetryCount = Math.max(0, Number(state?.phases?.deep?.retryCount || 0)) || undefined
    const deepNextRetryAt = Number(state?.phases?.deep?.nextRetryAt || 0) || undefined
    return {
      phases: {
        catalog: { ...state?.phases?.catalog, status: state?.phases?.catalog?.status || 'missing' },
        profile: { ...state?.phases?.profile, status: state?.phases?.profile?.status || 'missing' },
        deep: {
          ...state?.phases?.deep,
          status: deepStatus,
          durationMs: deepStatus === 'missing'
            ? undefined
            : Number(state?.phases?.deep?.durationMs || 0) || undefined,
          lastError: deepStatus === 'missing'
            ? undefined
            : String(state?.phases?.deep?.lastError || '').trim() || undefined,
          taskKey: deepStatus === 'missing'
            ? undefined
            : String(state?.phases?.deep?.taskKey || '').trim() || undefined,
          fingerprint: String(state?.phases?.deep?.fingerprint || '').trim() || undefined,
          retryCount: deepStatus === 'missing' ? undefined : deepRetryCount,
          nextRetryAt: deepStatus === 'missing' ? undefined : deepNextRetryAt,
          hitWatermark: deepStatus === 'missing'
            ? undefined
            : state?.phases?.deep?.hitWatermark
            ? {
                lastHitAt: Number(state.phases.deep.hitWatermark.lastHitAt || 0) || undefined,
                exposureHits: Math.max(0, Number(state.phases.deep.hitWatermark.exposureHits || 0)),
                confirmedHits: Math.max(0, Number(state.phases.deep.hitWatermark.confirmedHits || 0)),
                memoryHits: Math.max(0, Number(state.phases.deep.hitWatermark.memoryHits || 0)),
                readHits: Math.max(0, Number(state.phases.deep.hitWatermark.readHits || 0)),
              }
            : undefined,
          reasonCode: deepStatus === 'missing' ? undefined : state?.phases?.deep?.reasonCode || undefined,
          scheduleReason: deepStatus === 'missing' ? undefined : state?.phases?.deep?.scheduleReason || undefined,
          eligibleSourceCount: deepStatus === 'missing'
            ? undefined
            : Number.isFinite(Number(state?.phases?.deep?.eligibleSourceCount))
              ? Number(state?.phases?.deep?.eligibleSourceCount)
              : undefined,
          nonEligibleReason: deepStatus === 'missing'
            ? undefined
            : state?.phases?.deep?.nonEligibleReason || undefined,
          requestedSourceCount: deepStatus === 'missing'
            ? undefined
            : Number.isFinite(Number(state?.phases?.deep?.requestedSourceCount))
              ? Number(state?.phases?.deep?.requestedSourceCount)
              : undefined,
          mergedSourceCount: deepStatus === 'missing'
            ? undefined
            : Number.isFinite(Number(state?.phases?.deep?.mergedSourceCount))
              ? Number(state?.phases?.deep?.mergedSourceCount)
              : undefined,
          selectedSourceCount: deepStatus === 'missing'
            ? undefined
            : Number.isFinite(Number(state?.phases?.deep?.selectedSourceCount))
              ? Number(state?.phases?.deep?.selectedSourceCount)
              : undefined,
          contextStrategy: deepStatus === 'missing'
            ? undefined
            : state?.phases?.deep?.contextStrategy || undefined,
          skipReason: deepStatus === 'missing'
            ? undefined
            : state?.phases?.deep?.skipReason || undefined,
        },
      },
      queueDepth: Number.isFinite(Number(state?.queueDepth)) ? Number(state?.queueDepth) : undefined,
      lastWarmAt: Number.isFinite(Number(state?.lastWarmAt)) ? Number(state?.lastWarmAt) : undefined,
      lastError: String(state?.lastError || '').trim() || undefined,
      semanticBootstrapPending: state?.semanticBootstrapPending
        ? {
            ...state.semanticBootstrapPending,
            appId: String(state.semanticBootstrapPending.appId || '').trim(),
            requestedSourceIds: this.normalizePendingSourceIds((state.semanticBootstrapPending as any)?.requestedSourceIds),
            mergedSourceIds: this.normalizePendingSourceIds((state.semanticBootstrapPending as any)?.mergedSourceIds),
            lastTriggerReason: this.normalizeSemanticBootstrapPendingReason((state.semanticBootstrapPending as any)?.lastTriggerReason)
              || this.normalizeSemanticBootstrapPendingReason((state.semanticBootstrapPending as any)?.reason),
            lastTriggerTraceId: String((state.semanticBootstrapPending as any)?.lastTriggerTraceId || '').trim() || undefined,
            lastTriggerToolCallId: String((state.semanticBootstrapPending as any)?.lastTriggerToolCallId || '').trim() || undefined,
            lastTriggerAt: Number((state.semanticBootstrapPending as any)?.lastTriggerAt || 0) || undefined,
          }
        : undefined,
    }
  }

  private normalizePendingSourceIds(value: any) {
    return [...new Set(
      (Array.isArray(value) ? value : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )].slice(0, AI_SEMANTIC_BOOTSTRAP_PENDING_SOURCE_SCOPE_LIMIT)
  }

  private shouldRetainInactivePendingBootstrap(manifest: AiAppMemoryManifest | null) {
    if (!manifest) {
      return false
    }
    const warmupState = this.buildWarmupState(manifest.warmupState)
    const pending = warmupState.semanticBootstrapPending || null
    if (!pending || this.isSemanticBootstrapPendingStopped(pending)) {
      return false
    }
    return warmupState.phases.profile.status === 'missing'
      || warmupState.phases.deep.status === 'missing'
      || warmupState.phases.deep.status === 'failed'
  }

  private mergePendingScopeSourceIds(existing: string[], requested: string[]) {
    const requestedSet = new Set(this.normalizePendingSourceIds(requested))
    return this.normalizePendingSourceIds(existing.filter(item => !requestedSet.has(String(item || '').trim())))
  }

  private normalizeSemanticBootstrapPendingReason(value: any): AiSemanticBootstrapPending['reason'] | undefined {
    const reason = String(value || '').trim()
    switch (reason) {
      case 'create':
      case 'import':
      case 'publish':
      case 'ai-permission':
      case 'search_top1':
      case 'get_app_memory':
        return reason
      default:
        return undefined
    }
  }

  private resolveCompletedQueueDepth(taskKey: string) {
    return Math.max(0, this.inFlight.size - (this.inFlight.has(taskKey) ? 1 : 0))
  }

  private async shouldMirrorCatalogPhase(appId: string) {
    const manifest = await this.readNormalizedManifest(appId)
    const catalogStatus = String(manifest?.warmupState?.phases?.catalog?.status || manifest?.levels?.catalog || 'missing')
    return catalogStatus === 'missing' || catalogStatus === 'failed' || catalogStatus === 'stale'
  }

  private buildDeepWarmupMessage(result: RefreshSemanticMemoryResult | null) {
    if (
      !result
      || !('refreshedSourceIds' in result)
      || !Array.isArray(result.refreshedSourceIds)
    ) {
      return undefined
    }
    const refreshedSourceIds = result.refreshedSourceIds.join(',')
    return `deep semantic refreshed sources=${refreshedSourceIds}`
  }

  private resolveDeepWarmupOutcome(result: RefreshSemanticMemoryResult | null): DeepWarmupOutcome {
    if (
      !result
      || !('manifest' in result)
      || !('selectedSourceIds' in result)
      || !Array.isArray(result.selectedSourceIds)
      || !('refreshedSourceIds' in result)
      || !Array.isArray(result.refreshedSourceIds)
    ) {
      return {
        message: 'deep semantic warmup returned an invalid result payload',
        shouldClearBootstrapPending: false,
      }
    }

    const semanticLevel = String(result.manifest?.levels?.semantic || '').trim()
    const hasEffectiveProgress = this.hasEffectiveSemanticProgress(result)
    if (result.refreshedSourceIds.length > 0) {
      return {
        message: this.buildDeepWarmupMessage(result),
        shouldClearBootstrapPending: semanticLevel === 'ready' || semanticLevel === 'partial',
      }
    }

    if (result.selectedSourceIds.length > 0 && !hasEffectiveProgress) {
      return {
        message: 'deep semantic warmup produced no effective semantic refresh',
        shouldClearBootstrapPending: false,
        skipReason: 'no_effective_progress',
      }
    }

    return {
      message: this.buildDeepWarmupMessage(result),
      shouldClearBootstrapPending: semanticLevel === 'ready' || semanticLevel === 'partial',
    }
  }

  private hasEffectiveSemanticProgress(result: RefreshSemanticMemoryResult) {
    const profile = result.manifest?.semanticProfile
    if (!profile || typeof profile !== 'object') {
      return false
    }
    return Boolean(String(profile.derivedSummary || '').trim())
      || (Array.isArray(profile.relationOverview) && profile.relationOverview.length > 0)
      || (Array.isArray(profile.sourceRoleHints) && profile.sourceRoleHints.length > 0)
  }

  private resolveBootstrapBackoffMs(lastError: string, retryCount: number) {
    const normalizedError = String(lastError || '').toLowerCase()
    if (normalizedError.includes('402') || normalizedError.includes('insufficient points')) {
      return Math.min(24 * 60 * 60 * 1000, 6 * 60 * 60 * 1000 * (2 ** Math.min(retryCount - 1, 2)))
    }
    if (
      normalizedError.includes('401')
      || normalizedError.includes('unauthorized')
      || normalizedError.includes('authentication')
      || normalizedError.includes('missing timestamp')
    ) {
      return Math.min(24 * 60 * 60 * 1000, 6 * 60 * 60 * 1000 * (2 ** Math.min(retryCount - 1, 2)))
    }
    return Math.min(60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(retryCount - 1, 5)))
  }

  private buildLedgerMessage(appId: string, phase: AiAppMemoryWarmupPhase, patch: WarmupStatePatch) {
    const status = String(patch.status || 'missing').trim() || 'missing'
    const durationText = Number.isFinite(Number(patch.durationMs))
      ? ` (${Number(patch.durationMs)}ms)`
      : ''
    const errorText = String(patch.lastError || '').trim()
    return errorText
      ? `${appId} ${phase} -> ${status}${durationText}: ${errorText}`
      : `${appId} ${phase} -> ${status}${durationText}`
  }

  private pushLedgerEvent(event: AiAppMemoryWarmupLedgerEvent) {
    this.ledgerEvents.push(event)
    if (this.ledgerEvents.length > 80) {
      this.ledgerEvents.splice(0, this.ledgerEvents.length - 80)
    }
  }

  private buildWarmupLedger(): AiAppMemoryWarmupLedger {
    const now = Date.now()
    const activity = this.activityService.getSnapshot(now)
    const fallbackScheduler: AiWarmupSchedulerDebugState = {
      idleEligible: this.isIdle(),
      idleAgeMs: Math.max(0, Math.round(Number(activity.globalIdleAgeMs || 0))),
      requiredIdleMs: 45 * 1000,
      pausedReason: this.schedulerPausedReason || (this.activeForegroundRequests > 0 ? 'foreground_ai_active' : undefined),
      activityEpoch: activity.activityEpoch,
      queueDepth: this.inFlight.size,
      runningTaskKey: [...this.inFlight.keys()][0],
      lastCanceledAt: activity.lastWarmupCanceledAt,
      canceledCount: this.canceledByActivityCount,
      skippedBecauseActiveCount: this.skippedBecauseActiveCount,
    }
    const scheduler = {
      ...(this.schedulerLastDecision || fallbackScheduler),
      activityEpoch: activity.activityEpoch,
      queueDepth: this.inFlight.size,
      runningTaskKey: [...this.inFlight.keys()][0],
      lastCanceledAt: activity.lastWarmupCanceledAt,
      canceledCount: this.canceledByActivityCount,
      skippedBecauseActiveCount: this.skippedBecauseActiveCount,
    }
    const apps = [...this.knownManifests.values()]
      .sort((left, right) => left.appName.localeCompare(right.appName, 'zh-CN'))
      .reduce<AiAppMemoryWarmupLedger['apps']>((result, manifest) => {
        result[manifest.appId] = {
          appId: manifest.appId,
          appName: manifest.appName,
          appKind: resolveAiAppKind({
            appKind: manifest.appKind,
            sourceIndex: manifest.sourceIndex,
            viewProfile: manifest.viewProfile,
          }),
          levels: manifest.levels,
          warmupState: this.buildWarmupState(manifest.warmupState),
        }
        return result
      }, {})

    return {
      updatedAt: now,
      isIdle: this.isIdle(),
      activeForegroundRequests: this.activeForegroundRequests,
      lastForegroundActivityAt: this.recentForegroundActivityAt,
      activity,
      scheduler,
      queueDepth: this.inFlight.size,
      inFlightKeys: [...this.inFlight.keys()].sort(),
      maintenance: {
        ...(this.maintenanceState || {}),
        zombieTaskKeys: Array.isArray(this.maintenanceState?.zombieTaskKeys)
          ? [...this.maintenanceState.zombieTaskKeys]
          : [],
      },
      semanticBootstrapPendingApps: Object.fromEntries(this.semanticBootstrapPendingByAppId),
      apps,
      events: [...this.ledgerEvents],
    }
  }

  private async persistLedger() {
    const ledger = this.buildWarmupLedger()
    this.ledgerWriteChain = this.ledgerWriteChain
      .catch(() => undefined)
      .then(async () => {
        await this.store.writeWarmupLedger(ledger)
      })
      .catch(error => {
        const errorText = error instanceof Error ? error.message : String(error)
        this.logger.warn(`write warmup ledger failed: ${errorText}`)
      })
    await this.ledgerWriteChain
  }

  private async persistTraces() {
    const traces = this.warmupTraces.map(item => ({ ...item }))
    this.traceWriteChain = this.traceWriteChain
      .catch(() => undefined)
      .then(async () => {
        await this.store.writeWarmupTraces(traces)
      })
      .catch(error => {
        const errorText = error instanceof Error ? error.message : String(error)
        this.logger.warn(`write warmup traces failed: ${errorText}`)
      })
    await this.traceWriteChain
  }

  private normalizeManifestState(manifest: AiAppMemoryManifest) {
    const nextWarmupState = this.buildWarmupState(manifest.warmupState)
    const normalizedWarmupState = {
      phases: {
        catalog: { ...nextWarmupState.phases.catalog },
        profile: { ...nextWarmupState.phases.profile },
        deep: { ...nextWarmupState.phases.deep },
      },
      queueDepth: nextWarmupState.queueDepth,
      lastWarmAt: nextWarmupState.lastWarmAt,
      lastError: nextWarmupState.lastError,
      semanticBootstrapPending: nextWarmupState.semanticBootstrapPending,
    }

    let changed = false
    const nextAppKind = resolveAiAppKind({
      appKind: manifest.appKind,
      sourceIndex: manifest.sourceIndex,
      viewProfile: manifest.viewProfile,
    })
    if (manifest.appKind !== nextAppKind) {
      manifest = {
        ...manifest,
        appKind: nextAppKind,
      }
      changed = true
    }

    if (
      normalizedWarmupState.phases.catalog.status === 'missing'
      && (
        manifest.levels?.catalog === 'ready'
        || normalizedWarmupState.phases.profile.status === 'succeeded'
        || normalizedWarmupState.phases.deep.status === 'succeeded'
      )
    ) {
      normalizedWarmupState.phases.catalog = {
        ...normalizedWarmupState.phases.catalog,
        status: 'succeeded',
        updatedAt: normalizedWarmupState.phases.catalog.updatedAt
          || normalizedWarmupState.phases.profile.updatedAt
          || normalizedWarmupState.phases.deep.updatedAt
          || manifest.updatedAt,
      }
      changed = true
    }

    if (
      normalizedWarmupState.phases.profile.status === 'missing'
      && manifest.levels?.structure === 'ready'
    ) {
      normalizedWarmupState.phases.profile = {
        ...normalizedWarmupState.phases.profile,
        status: 'succeeded',
        updatedAt: normalizedWarmupState.phases.profile.updatedAt || manifest.updatedAt,
      }
      changed = true
    }

    const queueDepth = this.inFlight.size
    if (Number(normalizedWarmupState.queueDepth || 0) !== queueDepth) {
      normalizedWarmupState.queueDepth = queueDepth
      changed = true
    }

    const succeededAt = [
      normalizedWarmupState.phases.catalog,
      normalizedWarmupState.phases.profile,
      normalizedWarmupState.phases.deep,
    ]
      .filter(item => item.status === 'succeeded' && Number.isFinite(Number(item.updatedAt)))
      .map(item => Number(item.updatedAt))
    const nextLastWarmAt = succeededAt.length
      ? Math.max(...succeededAt)
      : undefined
    if (normalizedWarmupState.lastWarmAt !== nextLastWarmAt) {
      normalizedWarmupState.lastWarmAt = nextLastWarmAt
      changed = true
    }

    if (
      normalizedWarmupState.lastError
      && ![normalizedWarmupState.phases.catalog, normalizedWarmupState.phases.profile, normalizedWarmupState.phases.deep]
        .some(item => item.status === 'failed')
    ) {
      normalizedWarmupState.lastError = ''
      changed = true
    }

    if (this.clearRecoveredPhaseFailureMetadata(normalizedWarmupState.phases.catalog)) {
      changed = true
    }
    if (this.clearRecoveredPhaseFailureMetadata(normalizedWarmupState.phases.profile)) {
      changed = true
    }
    if (this.clearRecoveredPhaseFailureMetadata(normalizedWarmupState.phases.deep)) {
      changed = true
    }

    if (!changed) {
      return {
        manifest,
        changed,
      }
    }

    return {
      manifest: {
        ...manifest,
        warmupState: normalizedWarmupState,
      },
      changed,
    }
  }

  private clearRecoveredPhaseFailureMetadata(phaseState: AiAppMemoryWarmupPhaseState) {
    if (!phaseState || phaseState.status === 'failed' || phaseState.status === 'skipped') {
      return false
    }

    let changed = false
    const transientKeys: Array<keyof AiAppMemoryWarmupPhaseState> = [
      'lastError',
      'reasonCode',
      'retryCount',
      'nextRetryAt',
      'scheduleReason',
      'eligibleSourceCount',
      'nonEligibleReason',
      'requestedSourceCount',
      'mergedSourceCount',
      'selectedSourceCount',
      'contextStrategy',
      'skipReason',
    ]

    for (const key of transientKeys) {
      if (phaseState[key] !== undefined) {
        delete phaseState[key]
        changed = true
      }
    }

    return changed
  }

}
