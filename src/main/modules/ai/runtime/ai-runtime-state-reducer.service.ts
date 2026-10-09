import { Injectable } from '@nestjs/common'
import {
  AiConversationProfile,
  AiCrossAppScopeTransition,
  AiPendingCrossAppResolutionState,
  AiRuntimeExecutionStrategy,
  AiSearchConvergence,
  AiThreadAppScope,
  AiThreadRecordAnalysisSnapshot,
  AiThreadRuntimeContextKind,
  AiThreadRuntimeState,
  AiThreadVerifiedTarget,
} from '../ai.types'
import {
  isSameRecordAnalysisSnapshot,
  normalizeRecordAnalysisSnapshot,
  normalizeRecordAnalysisSnapshots,
  resolveLatestRecordAnalysisSnapshotFromOutputs,
  resolveRecordAnalysisSnapshotsFromOutputs,
} from './ai-record-analysis-snapshot.util'
import {
  hasCrossAppAnalysisBundleIdentityMismatch,
  normalizeCrossAppAnalysisBundle,
} from './ai-cross-app-analysis-bundle.util'

type ReduceRuntimeStateOptions = {
  batchRuntimeStateEnabled?: boolean
  materialize?: boolean
}

@Injectable()
export class AiRuntimeStateReducerService {
  reduceRuntimeState(
    previousState: AiThreadRuntimeState | null | undefined,
    outputs: any[],
    options: ReduceRuntimeStateOptions = {},
  ): AiThreadRuntimeState | null {
    const successfulOutputs = Array.isArray(outputs) ? outputs.filter(Boolean) : []
    const reducedState = !successfulOutputs.length && previousState
      ? previousState
      : (
          options.batchRuntimeStateEnabled !== false
            ? this.deriveBatchRuntimeState(previousState, successfulOutputs)
            : this.deriveLegacyRuntimeState(previousState, successfulOutputs)
        )

    return options.materialize
      ? this.materializeRuntimeState(reducedState || previousState)
      : reducedState
  }

  materializeRuntimeState(runtimeState?: AiThreadRuntimeState | null): AiThreadRuntimeState {
    const nextState: AiThreadRuntimeState = {
      ...(runtimeState || {}),
      currentProfile: this.normalizeProfile(runtimeState?.currentProfile),
      currentAppId: this.normalizeText(runtimeState?.currentAppId) || undefined,
      currentAppName: this.normalizeText(runtimeState?.currentAppName) || undefined,
      currentIntent: this.normalizeIntent(runtimeState?.currentIntent),
      currentContextKind: this.normalizeContextKind(runtimeState?.currentContextKind),
      currentTopAppId: this.normalizeText(runtimeState?.currentTopAppId) || undefined,
      currentAccessibleAppsSignature: this.normalizeText(runtimeState?.currentAccessibleAppsSignature) || undefined,
      currentSearchSignature: this.normalizeText(runtimeState?.currentSearchSignature) || undefined,
      currentSearchConvergence: this.normalizeSearchConvergence(runtimeState?.currentSearchConvergence),
      currentSearchWeakSignature: this.normalizeText(runtimeState?.currentSearchWeakSignature) || undefined,
      currentTopCandidateStableRounds: this.normalizeFiniteNumber(
        runtimeState?.currentTopCandidateStableRounds ?? runtimeState?.diagnostics?.currentTopCandidateStableRounds,
      ),
      currentSourceId: this.normalizeText(runtimeState?.currentSourceId) || undefined,
      currentSourceName: this.normalizeText(runtimeState?.currentSourceName) || undefined,
      currentBatchAppId: this.normalizeText(runtimeState?.currentBatchAppId) || undefined,
      currentBatchTargetIds: this.normalizeIds(runtimeState?.currentBatchTargetIds),
      verifiedTargets: this.mergeVerifiedTargets([], runtimeState?.verifiedTargets),
      recordAnalysisSnapshots: this.resolveMaterializedRecordAnalysisSnapshots(runtimeState),
      activeRecordAnalysisSnapshots: this.resolveMaterializedActiveRecordAnalysisSnapshots(runtimeState),
      latestRecordAnalysisSnapshot: this.resolveMaterializedLatestRecordAnalysisSnapshot(runtimeState),
      latestCrossAppScopeTransition: this.normalizeScopeTransition(runtimeState?.latestCrossAppScopeTransition),
      latestCrossAppAnalysisBundle: this.resolveMaterializedCrossAppAnalysisBundle(runtimeState),
      pendingCrossAppResolution: this.normalizePendingCrossAppResolution(runtimeState?.pendingCrossAppResolution),
      lastExecutionStrategy: this.normalizeExecutionStrategy(
        runtimeState?.lastExecutionStrategy ?? runtimeState?.diagnostics?.lastExecutionStrategy,
      ) || undefined,
      lastBatchPartial: this.normalizeOptionalBoolean(
        runtimeState?.lastBatchPartial ?? runtimeState?.diagnostics?.lastBatchPartial,
      ),
      recentSourceIds: this.normalizeIds(runtimeState?.recentSourceIds),
    }

    nextState.diagnostics = this.buildDiagnostics(nextState)
    return nextState
  }

  pruneRuntimeStateByAppScope(
    runtimeState: AiThreadRuntimeState | null | undefined,
    appScope?: AiThreadAppScope | null,
  ): AiThreadRuntimeState {
    const state = this.materializeRuntimeState(runtimeState)
    const allowedAppIds = this.normalizeIds(appScope?.appIds)
    if (!allowedAppIds.length) {
      return state
    }

    const allowedAppIdSet = new Set(allowedAppIds)
    const rawVerifiedTargets = Array.isArray(state.verifiedTargets) ? state.verifiedTargets : []
    const verifiedTargets = this.mergeVerifiedTargets(
      [],
      rawVerifiedTargets.filter(item => {
        const appId = this.normalizeText(item?.appId)
        return Boolean(appId && allowedAppIdSet.has(appId))
      }),
    )
    const currentAppId = this.normalizeText(state.currentAppId) || undefined
    const currentBatchAppId = this.normalizeText(state.currentBatchAppId) || undefined
    const preservedCurrentAppId = currentAppId && allowedAppIdSet.has(currentAppId)
      ? currentAppId
      : undefined
    const preservedBatchAppId = currentBatchAppId && allowedAppIdSet.has(currentBatchAppId)
      ? currentBatchAppId
      : undefined
    const preservedRecordAnalysisSnapshots = (state.recordAnalysisSnapshots || [])
      .filter(item => allowedAppIdSet.has(item.appId))
    const preservedActiveRecordAnalysisSnapshots = (state.activeRecordAnalysisSnapshots || [])
      .filter(item => allowedAppIdSet.has(item.appId))
    const preservedRecordAnalysisSnapshot = preservedRecordAnalysisSnapshots.length
      ? preservedRecordAnalysisSnapshots[preservedRecordAnalysisSnapshots.length - 1]
      : undefined
    const preservedCrossAppAnalysisBundle = this.resolvePrunedCrossAppAnalysisBundle(
      state.latestCrossAppAnalysisBundle,
      allowedAppIdSet,
    )
    const recentSourceIds = this.normalizeIds(state.recentSourceIds)
    const safeSourceIdSet = new Set(
      verifiedTargets
        .filter(item => this.normalizeText(item?.targetType) === 'source')
        .map(item => this.normalizeText(item?.targetId))
        .filter(Boolean),
    )
    const preservedRecentSourceIds = recentSourceIds.filter(item => safeSourceIdSet.has(item))
    const currentBatchTargetIds = this.normalizeIds(state.currentBatchTargetIds)
    const preservedBatchTargetIds = preservedBatchAppId
      ? currentBatchTargetIds.filter(item =>
          verifiedTargets.some(target =>
            this.normalizeText(target?.appId) === preservedBatchAppId
            && this.normalizeText(target?.targetId) === item,
          ))
      : []
    const currentSourceId = preservedCurrentAppId ? this.normalizeText(state.currentSourceId) || undefined : undefined
    const isCurrentSourceVerified = currentSourceId
      ? verifiedTargets.some(target =>
          this.normalizeText(target?.appId) === preservedCurrentAppId
          && this.normalizeText(target?.targetType) === 'source'
          && this.normalizeText(target?.targetId) === currentSourceId,
        )
      : false
    const hasRetainedContext = Boolean(
      verifiedTargets.length
      || preservedCurrentAppId
      || preservedBatchAppId
      || preservedRecentSourceIds.length
      || preservedRecordAnalysisSnapshot,
    )
    const pendingCrossAppResolution = this.resolvePrunedPendingCrossAppResolution({
      pendingCrossAppResolution: state.pendingCrossAppResolution,
      verifiedTargets,
      activeRecordAnalysisSnapshots: preservedActiveRecordAnalysisSnapshots,
      latestCrossAppAnalysisBundle: preservedCrossAppAnalysisBundle,
    })
    const currentProfile = this.resolvePrunedProfile({
      currentProfile: state.currentProfile,
      hasRetainedContext,
      pendingCrossAppResolution,
      verifiedTargets,
      activeRecordAnalysisSnapshots: preservedActiveRecordAnalysisSnapshots,
      latestCrossAppAnalysisBundle: preservedCrossAppAnalysisBundle,
    })

    return this.materializeRuntimeState({
      currentProfile,
      currentAppId: preservedCurrentAppId,
      currentAppName: preservedCurrentAppId ? this.normalizeText(state.currentAppName) || undefined : undefined,
      currentIntent: hasRetainedContext ? state.currentIntent : undefined,
      currentContextKind: verifiedTargets.length > 1
        ? 'comparison'
        : preservedBatchAppId && preservedBatchTargetIds.length > 1
          ? 'batch'
          : hasRetainedContext
            ? 'single_target'
            : undefined,
      currentTopAppId: this.normalizeText(state.currentTopAppId) || undefined,
      currentAccessibleAppsSignature: this.normalizeText(state.currentAccessibleAppsSignature) || undefined,
      currentSearchSignature: this.normalizeText(state.currentSearchSignature) || undefined,
      currentSearchConvergence: this.normalizeSearchConvergence(state.currentSearchConvergence),
      currentSearchWeakSignature: this.normalizeText(state.currentSearchWeakSignature) || undefined,
      currentTopCandidateStableRounds: state.currentTopCandidateStableRounds,
      currentSourceId: isCurrentSourceVerified ? currentSourceId : undefined,
      currentSourceName: isCurrentSourceVerified ? this.normalizeText(state.currentSourceName) || undefined : undefined,
      currentBatchAppId: preservedBatchAppId,
      currentBatchTargetIds: preservedBatchTargetIds,
      verifiedTargets,
      recordAnalysisSnapshots: preservedRecordAnalysisSnapshots,
      activeRecordAnalysisSnapshots: preservedActiveRecordAnalysisSnapshots,
      latestRecordAnalysisSnapshot: preservedRecordAnalysisSnapshot,
      latestCrossAppScopeTransition: state.latestCrossAppScopeTransition,
      latestCrossAppAnalysisBundle: preservedCrossAppAnalysisBundle,
      pendingCrossAppResolution,
      lastExecutionStrategy: state.lastExecutionStrategy,
      lastBatchPartial: state.lastBatchPartial,
      recentSourceIds: preservedRecentSourceIds,
    })
  }

  private deriveBatchRuntimeState(
    previousState: AiThreadRuntimeState | null | undefined,
    successfulOutputs: any[],
  ): AiThreadRuntimeState | null {
    const searchOutputs = successfulOutputs.filter(item => item?.tool === 'search_apps')
    const readOutputs = successfulOutputs.filter(item => item?.tool === 'read_app_data')
    const memoryOutputs = successfulOutputs.filter(item => item?.tool === 'get_app_memory')
    const latestSearch = [...searchOutputs].reverse().find(Boolean)
    const latestRead = [...readOutputs].reverse().find(Boolean)
    const latestMemory = [...memoryOutputs].reverse().find(Boolean)
    const latestReadTargets = latestRead ? this.extractVerifiedTargetsFromReadOutput(latestRead) : []
    const turnVerifiedTargets = readOutputs.flatMap(item => this.extractVerifiedTargetsFromReadOutput(item))
    const verifiedTargets = this.mergeVerifiedTargets(turnVerifiedTargets, previousState?.verifiedTargets)
    const recordAnalysisSnapshots = this.resolveRecordAnalysisSnapshots(previousState, readOutputs)
    const activeRecordAnalysisSnapshots = this.resolveActiveRecordAnalysisSnapshots(previousState, readOutputs)
    const latestRecordAnalysisSnapshot = this.resolveLatestRecordAnalysisSnapshot(previousState, readOutputs, recordAnalysisSnapshots)
    const contextAppIds = this.normalizeIds([
      ...readOutputs.map(item => this.resolveOutputAppId(item)),
      ...memoryOutputs.map(item => this.resolveOutputAppId(item)),
    ])
    const contextKind: AiThreadRuntimeContextKind | undefined = contextAppIds.length > 1
      ? 'comparison'
      : latestRead && this.isBatchReadOutput(latestRead)
        ? 'batch'
        : (latestRead || latestMemory || verifiedTargets.length ? 'single_target' : previousState?.currentContextKind)
    const currentAppId = contextKind === 'comparison'
      ? undefined
      : this.normalizeText(
          this.resolveOutputAppId(latestRead)
          || this.resolveOutputAppId(latestMemory)
          || previousState?.currentAppId,
        ) || undefined
    const currentAppName = contextKind === 'comparison'
      ? undefined
      : this.normalizeText(
          this.resolveOutputAppName(latestRead)
          || this.resolveOutputAppName(latestMemory)
          || previousState?.currentAppName,
        ) || undefined
    const latestSingleSourceTarget = contextKind === 'single_target'
      ? latestReadTargets.find(item => item.targetType === 'source') || null
      : null
    const preservePreviousSingleTarget = !latestRead
      && contextKind === 'single_target'
      && currentAppId
      && currentAppId === this.normalizeText(previousState?.currentAppId)
    const currentSourceId = latestSingleSourceTarget?.targetId
      || (preservePreviousSingleTarget ? this.normalizeText(previousState?.currentSourceId) || undefined : undefined)
    const currentSourceName = latestSingleSourceTarget?.targetName
      || (preservePreviousSingleTarget ? this.normalizeText(previousState?.currentSourceName) || undefined : undefined)
    const currentIntent = this.resolveCurrentIntent(
      latestRead?.resolved?.mode,
      latestSearch?.intent,
      previousState?.currentIntent,
    )
    const currentTopCandidateStableRounds = Number.isFinite(Number(latestSearch?.stableTopCandidateRounds))
      ? Math.max(0, Number(latestSearch?.stableTopCandidateRounds))
      : this.normalizeFiniteNumber(previousState?.currentTopCandidateStableRounds)
    const recentSourceIds = this.mergeRecentIds(
      turnVerifiedTargets
        .filter(item => item.targetType === 'source')
        .map(item => item.targetId),
      previousState?.recentSourceIds,
    )
    const lastExecutionStrategy = this.normalizeExecutionStrategy(
      latestRead?.result?.executionSummary?.strategy,
    ) || previousState?.lastExecutionStrategy || previousState?.diagnostics?.lastExecutionStrategy
    const lastBatchPartial = contextKind === 'batch' && latestRead
      ? Boolean(latestRead?.result?.partial)
      : this.normalizeOptionalBoolean(previousState?.lastBatchPartial ?? previousState?.diagnostics?.lastBatchPartial)
    const latestCrossAppAnalysisBundle = this.resolveCarriedCrossAppAnalysisBundle({
      previousState,
      currentProfile: previousState?.currentProfile,
      currentContextKind: contextKind,
      verifiedTargets,
      activeRecordAnalysisSnapshots,
      latestRecordAnalysisSnapshot,
    })

    return {
      currentProfile: previousState?.currentProfile,
      currentAppId,
      currentAppName,
      currentIntent,
      currentContextKind: contextKind,
      currentTopAppId: this.normalizeText(
        latestSearch?.topCandidateAppId || previousState?.currentTopAppId,
      ) || undefined,
      currentAccessibleAppsSignature: this.normalizeText(
        latestSearch?.accessibleAppsSignature || previousState?.currentAccessibleAppsSignature,
      ) || undefined,
      currentSearchSignature: this.normalizeText(
        latestSearch?.resultSignature || previousState?.currentSearchSignature,
      ) || undefined,
      currentSearchConvergence: this.normalizeSearchConvergence(
        latestSearch?.convergence,
      ) || this.normalizeSearchConvergence(previousState?.currentSearchConvergence),
      currentSearchWeakSignature: this.normalizeText(
        latestSearch?.candidateWeakSignature || previousState?.currentSearchWeakSignature,
      ) || undefined,
      currentTopCandidateStableRounds,
      currentSourceId,
      currentSourceName,
      currentBatchAppId: contextKind === 'batch'
        ? this.normalizeText(latestRead?.resolved?.appId || currentAppId) || undefined
        : undefined,
      currentBatchTargetIds: contextKind === 'batch'
        ? latestReadTargets.map(item => item.targetId)
        : [],
      verifiedTargets,
      recordAnalysisSnapshots,
      activeRecordAnalysisSnapshots,
      latestRecordAnalysisSnapshot,
      latestCrossAppScopeTransition: this.resolveNextScopeTransition(previousState, readOutputs),
      latestCrossAppAnalysisBundle,
      lastExecutionStrategy,
      lastBatchPartial,
      recentSourceIds,
    }
  }

  private deriveLegacyRuntimeState(
    previousState: AiThreadRuntimeState | null | undefined,
    successfulOutputs: any[],
  ): AiThreadRuntimeState | null {
    const latestSearch = [...successfulOutputs].reverse().find(item => item?.tool === 'search_apps')
    const latestRead = [...successfulOutputs].reverse().find(item => item?.tool === 'read_app_data')
    const latestMemory = [...successfulOutputs].reverse().find(item => item?.tool === 'get_app_memory')
    const turnVerifiedTargets = successfulOutputs
      .filter(item => item?.tool === 'read_app_data')
      .flatMap(item => this.extractVerifiedTargetsFromReadOutput(item))
    const verifiedTargets = this.mergeVerifiedTargets(turnVerifiedTargets, previousState?.verifiedTargets)
    const recordAnalysisSnapshots = this.resolveRecordAnalysisSnapshots(previousState, latestRead ? [latestRead] : [])
    const activeRecordAnalysisSnapshots = this.resolveActiveRecordAnalysisSnapshots(previousState, latestRead ? [latestRead] : [])
    const latestRecordAnalysisSnapshot = this.resolveLatestRecordAnalysisSnapshot(
      previousState,
      latestRead ? [latestRead] : [],
      recordAnalysisSnapshots,
    )
    const currentIntent = this.resolveCurrentIntent(
      latestRead?.resolved?.mode,
      latestSearch?.intent,
      previousState?.currentIntent,
    )
    const currentSourceId = this.normalizeText(
      latestRead?.resolved?.target?.type === 'source'
        ? latestRead?.resolved?.target?.id
        : previousState?.currentSourceId,
    ) || undefined
    const currentSourceName = this.normalizeText(
      latestRead?.resolved?.target?.type === 'source'
        ? latestRead?.resolved?.target?.name
        : previousState?.currentSourceName,
    ) || undefined
    const latestCrossAppAnalysisBundle = this.resolveCarriedCrossAppAnalysisBundle({
      previousState,
      currentProfile: previousState?.currentProfile,
      currentContextKind: previousState?.currentContextKind,
      verifiedTargets,
      activeRecordAnalysisSnapshots,
      latestRecordAnalysisSnapshot,
    })

    return {
      currentProfile: previousState?.currentProfile,
      currentAppId: this.normalizeText(
        latestRead?.resolved?.appId
        || latestMemory?.app?.appId
        || previousState?.currentAppId,
      ) || undefined,
      currentAppName: this.normalizeText(
        latestRead?.resolved?.appName
        || latestMemory?.app?.appName
        || previousState?.currentAppName,
      ) || undefined,
      currentIntent,
      currentContextKind: previousState?.currentContextKind,
      currentTopAppId: this.normalizeText(
        latestSearch?.topCandidateAppId || previousState?.currentTopAppId,
      ) || undefined,
      currentAccessibleAppsSignature: this.normalizeText(
        latestSearch?.accessibleAppsSignature || previousState?.currentAccessibleAppsSignature,
      ) || undefined,
      currentSearchSignature: this.normalizeText(
        latestSearch?.resultSignature || previousState?.currentSearchSignature,
      ) || undefined,
      currentSearchConvergence: this.normalizeSearchConvergence(
        latestSearch?.convergence,
      ) || this.normalizeSearchConvergence(previousState?.currentSearchConvergence),
      currentSearchWeakSignature: this.normalizeText(
        latestSearch?.candidateWeakSignature || previousState?.currentSearchWeakSignature,
      ) || undefined,
      currentTopCandidateStableRounds: Number.isFinite(Number(latestSearch?.stableTopCandidateRounds))
        ? Math.max(0, Number(latestSearch?.stableTopCandidateRounds))
        : this.normalizeFiniteNumber(
            previousState?.currentTopCandidateStableRounds ?? previousState?.diagnostics?.currentTopCandidateStableRounds,
      ),
      currentSourceId,
      currentSourceName,
      currentBatchAppId: this.isBatchReadOutput(latestRead)
        ? this.normalizeText(latestRead?.resolved?.appId) || undefined
        : this.normalizeText(previousState?.currentBatchAppId) || undefined,
      currentBatchTargetIds: this.isBatchReadOutput(latestRead)
        ? this.normalizeIds(turnVerifiedTargets.map(item => item.targetId))
        : this.normalizeIds(previousState?.currentBatchTargetIds),
      verifiedTargets,
      recordAnalysisSnapshots,
      activeRecordAnalysisSnapshots,
      latestRecordAnalysisSnapshot,
      latestCrossAppScopeTransition: this.resolveNextScopeTransition(previousState, latestRead ? [latestRead] : []),
      latestCrossAppAnalysisBundle,
      lastExecutionStrategy: previousState?.lastExecutionStrategy || previousState?.diagnostics?.lastExecutionStrategy,
      lastBatchPartial: this.normalizeOptionalBoolean(
        previousState?.lastBatchPartial ?? previousState?.diagnostics?.lastBatchPartial,
      ),
      recentSourceIds: this.mergeRecentIds(
        currentSourceId ? [currentSourceId] : [],
        previousState?.recentSourceIds,
      ),
    }
  }

  private extractVerifiedTargetsFromReadOutput(output: any): AiThreadVerifiedTarget[] {
    const appId = this.normalizeText(output?.resolved?.appId)
    if (!appId) {
      return []
    }

    const appName = this.normalizeText(output?.resolved?.appName) || undefined
    const mode = this.normalizeReadMode(output?.resolved?.mode)
    if (!mode) {
      return []
    }

    const rawTargets = Array.isArray(output?.resolved?.targets) && output.resolved.targets.length
      ? output.resolved.targets
      : (output?.resolved?.target ? [output.resolved.target] : [])

    return rawTargets
      .map((item: any) => {
        const targetId = this.normalizeText(item?.id)
        const targetType = this.normalizeTargetType(item?.type)
        if (!targetId || !targetType) {
          return null
        }
        const verifiedTarget: AiThreadVerifiedTarget = {
          appId,
          appName,
          targetId,
          targetName: this.normalizeText(item?.name) || undefined,
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

  private resolveLatestRecordAnalysisSnapshot(
    previousState: AiThreadRuntimeState | null | undefined,
    readOutputs: any[],
    recordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[],
  ): AiThreadRecordAnalysisSnapshot | undefined {
    if (Array.isArray(recordAnalysisSnapshots) && recordAnalysisSnapshots.length) {
      return recordAnalysisSnapshots[recordAnalysisSnapshots.length - 1]
    }

    if (!Array.isArray(readOutputs) || !readOutputs.length) {
      return normalizeRecordAnalysisSnapshot(previousState?.latestRecordAnalysisSnapshot)
    }

    return resolveLatestRecordAnalysisSnapshotFromOutputs(
      readOutputs,
      previousState?.latestRecordAnalysisSnapshot,
    )
  }

  private resolveRecordAnalysisSnapshots(
    previousState: AiThreadRuntimeState | null | undefined,
    readOutputs: any[],
  ) {
    return resolveRecordAnalysisSnapshotsFromOutputs(
      readOutputs,
      previousState?.recordAnalysisSnapshots,
    ) || this.resolveMaterializedRecordAnalysisSnapshots(previousState)
  }

  private resolveActiveRecordAnalysisSnapshots(
    previousState: AiThreadRuntimeState | null | undefined,
    readOutputs: any[],
  ) {
    const snapshotsFromOutputs = resolveRecordAnalysisSnapshotsFromOutputs(readOutputs)
    if (snapshotsFromOutputs?.length) {
      return snapshotsFromOutputs
    }

    return this.resolveMaterializedActiveRecordAnalysisSnapshots(previousState)
  }

  private resolveMaterializedRecordAnalysisSnapshots(
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    const normalizedSnapshots = normalizeRecordAnalysisSnapshots(runtimeState?.recordAnalysisSnapshots)
    const latestSnapshot = normalizeRecordAnalysisSnapshot(runtimeState?.latestRecordAnalysisSnapshot)
    if (!latestSnapshot) {
      return normalizedSnapshots?.length ? normalizedSnapshots : undefined
    }
    if (!normalizedSnapshots?.length) {
      return [latestSnapshot]
    }

    const lastSnapshot = normalizedSnapshots[normalizedSnapshots.length - 1]
    return isSameRecordAnalysisSnapshot(lastSnapshot, latestSnapshot)
      ? normalizedSnapshots
      : [latestSnapshot]
  }

  private resolveMaterializedActiveRecordAnalysisSnapshots(
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    const normalizedActiveSnapshots = normalizeRecordAnalysisSnapshots(runtimeState?.activeRecordAnalysisSnapshots)
    if (Array.isArray(runtimeState?.activeRecordAnalysisSnapshots)) {
      return normalizedActiveSnapshots?.length
        ? normalizedActiveSnapshots
        : []
    }

    if (normalizedActiveSnapshots?.length) {
      return normalizedActiveSnapshots
    }

    return this.resolveMaterializedRecordAnalysisSnapshots(runtimeState)
  }

  private resolveMaterializedLatestRecordAnalysisSnapshot(
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    const normalizedSnapshots = this.resolveMaterializedRecordAnalysisSnapshots(runtimeState)
    return normalizedSnapshots?.length
      ? normalizedSnapshots[normalizedSnapshots.length - 1]
      : undefined
  }

  private resolveMaterializedCrossAppAnalysisBundle(
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    return normalizeCrossAppAnalysisBundle(runtimeState?.latestCrossAppAnalysisBundle)
  }

  private normalizePendingCrossAppResolution(
    value?: AiPendingCrossAppResolutionState | null,
  ): AiPendingCrossAppResolutionState | undefined {
    if (value?.kind !== 'compare_merge_choice') {
      return undefined
    }

    const normalizedChoices = (Array.isArray(value?.choices) ? value.choices : [])
      .map(item => {
        const key = item?.key === '1' || item?.key === '2'
          ? item.key
          : undefined
        const profile = item?.profile === 'cross_app_compare' || item?.profile === 'cross_app_merge'
          ? item.profile
          : undefined
        if (!key || !profile) {
          return null
        }

        const aliases = [...new Set(
          (Array.isArray(item?.aliases) ? item.aliases : [])
            .map(alias => this.normalizePendingChoiceAlias(alias))
            .filter(Boolean),
        )] as string[]

        return {
          key,
          profile,
          aliases,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const compareChoice = normalizedChoices.find(item =>
      item.key === '1' && item.profile === 'cross_app_compare',
    )
    const mergeChoice = normalizedChoices.find(item =>
      item.key === '2' && item.profile === 'cross_app_merge',
    )

    if (!compareChoice || !mergeChoice || normalizedChoices.length !== 2) {
      return undefined
    }

    return {
      kind: 'compare_merge_choice',
      choices: [compareChoice, mergeChoice],
    }
  }

  private resolvePrunedCrossAppAnalysisBundle(
    bundle: AiThreadRuntimeState['latestCrossAppAnalysisBundle'],
    allowedAppIdSet: Set<string>,
  ) {
    const normalizedBundle = normalizeCrossAppAnalysisBundle(bundle)
    if (!normalizedBundle) {
      return undefined
    }

    const expectedAppIds = normalizedBundle.expectedAppIds.filter(appId => allowedAppIdSet.has(appId))
    if (expectedAppIds.length !== normalizedBundle.expectedAppIds.length) {
      return undefined
    }

    const slices = normalizedBundle.slices.filter(item => allowedAppIdSet.has(this.normalizeText(item.appId)))
    if (slices.length !== normalizedBundle.slices.length) {
      return undefined
    }

    return {
      ...normalizedBundle,
      expectedAppIds,
      slices,
    }
  }

  private resolvePrunedPendingCrossAppResolution(options: {
    pendingCrossAppResolution?: AiPendingCrossAppResolutionState
    verifiedTargets?: AiThreadVerifiedTarget[]
    activeRecordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
    latestCrossAppAnalysisBundle?: AiThreadRuntimeState['latestCrossAppAnalysisBundle']
  }) {
    const pendingCrossAppResolution = this.normalizePendingCrossAppResolution(options.pendingCrossAppResolution)
    if (!pendingCrossAppResolution) {
      return undefined
    }

    return this.hasEffectiveCrossAppContext(options)
      ? pendingCrossAppResolution
      : undefined
  }

  private resolvePrunedProfile(options: {
    currentProfile?: AiConversationProfile | null
    hasRetainedContext: boolean
    pendingCrossAppResolution?: AiPendingCrossAppResolutionState
    verifiedTargets?: AiThreadVerifiedTarget[]
    activeRecordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
    latestCrossAppAnalysisBundle?: AiThreadRuntimeState['latestCrossAppAnalysisBundle']
  }): AiConversationProfile | undefined {
    const currentProfile = this.normalizeProfile(options.currentProfile)
    if (
      currentProfile !== 'cross_app_compare'
      && currentProfile !== 'cross_app_merge'
      && currentProfile !== 'cross_app_unresolved'
    ) {
      return currentProfile
    }

    if (options.pendingCrossAppResolution || this.hasEffectiveCrossAppContext(options)) {
      return currentProfile
    }

    return options.hasRetainedContext
      ? 'records_query'
      : undefined
  }

  private hasEffectiveCrossAppContext(options: {
    verifiedTargets?: AiThreadVerifiedTarget[]
    activeRecordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
    latestCrossAppAnalysisBundle?: AiThreadRuntimeState['latestCrossAppAnalysisBundle']
  }) {
    if (this.collectDistinctVerifiedAppIds(options.verifiedTargets).length >= 2) {
      return true
    }

    const activeSnapshotAppIds = [...new Set(
      (Array.isArray(options.activeRecordAnalysisSnapshots) ? options.activeRecordAnalysisSnapshots : [])
        .map(item => this.normalizeText(item?.appId))
        .filter(Boolean),
    )]
    if (activeSnapshotAppIds.length >= 2) {
      return true
    }

    const normalizedBundle = normalizeCrossAppAnalysisBundle(options.latestCrossAppAnalysisBundle)
    const bundleAppIds = [...new Set([
      ...(normalizedBundle?.expectedAppIds || []),
      ...(normalizedBundle?.slices || []).map(item => this.normalizeText(item?.appId)),
    ].filter(Boolean))]

    return bundleAppIds.length >= 2
  }

  private resolveCarriedCrossAppAnalysisBundle(options: {
    previousState?: AiThreadRuntimeState | null
    currentProfile?: AiThreadRuntimeState['currentProfile']
    currentContextKind?: AiThreadRuntimeContextKind
    verifiedTargets?: AiThreadVerifiedTarget[]
    activeRecordAnalysisSnapshots?: AiThreadRecordAnalysisSnapshot[]
    latestRecordAnalysisSnapshot?: AiThreadRecordAnalysisSnapshot
  }) {
    const previousBundle = normalizeCrossAppAnalysisBundle(options.previousState?.latestCrossAppAnalysisBundle)
    if (!previousBundle) {
      return undefined
    }

    const currentProfile = this.normalizeProfile(options.currentProfile)
    if (currentProfile === 'records_query') {
      return undefined
    }

    const currentContextKind = this.normalizeContextKind(options.currentContextKind)
    if (currentContextKind && currentContextKind !== 'comparison') {
      return undefined
    }

    const verifiedAppIds = this.collectDistinctVerifiedAppIds(options.verifiedTargets)
    if (verifiedAppIds.length === 1) {
      return undefined
    }

    const latestScopeTransition = this.normalizeScopeTransition(options.previousState?.latestCrossAppScopeTransition)
    if (
      (latestScopeTransition === 'expand' || latestScopeTransition === 'invalidate')
      && !(Array.isArray(options.activeRecordAnalysisSnapshots) && options.activeRecordAnalysisSnapshots.length)
    ) {
      return undefined
    }

    const latestRecordAnalysisSnapshot = normalizeRecordAnalysisSnapshot(options.latestRecordAnalysisSnapshot)
    if (
      latestRecordAnalysisSnapshot
      && hasCrossAppAnalysisBundleIdentityMismatch(previousBundle, {
        expectedAppIds: verifiedAppIds.length ? verifiedAppIds : undefined,
        requestSignature: latestRecordAnalysisSnapshot.requestSignature,
      })
    ) {
      return undefined
    }

    return previousBundle
  }

  private resolveNextScopeTransition(
    previousState: AiThreadRuntimeState | null | undefined,
    readOutputs: any[],
  ) {
    const previousTransition = this.normalizeScopeTransition(previousState?.latestCrossAppScopeTransition)
    if (!Array.isArray(readOutputs) || !readOutputs.length) {
      return previousTransition
    }

    return previousTransition === 'expand' || previousTransition === 'invalidate'
      ? undefined
      : previousTransition
  }

  private collectDistinctVerifiedAppIds(value?: AiThreadVerifiedTarget[] | null) {
    return [...new Set(
      (Array.isArray(value) ? value : [])
        .map(item => this.normalizeText(item?.appId))
        .filter(Boolean),
    )].sort()
  }

  private mergeRecentIds(nextIds: string[] = [], previousIds?: string[] | null, limit = 8) {
    return [
      ...this.normalizeIds(nextIds),
      ...this.normalizeIds(previousIds),
    ].filter((item, index, array) => Boolean(item) && array.indexOf(item) === index).slice(0, limit)
  }

  private resolveOutputAppId(output: any) {
    return this.normalizeText(output?.resolved?.appId || output?.app?.appId)
  }

  private resolveOutputAppName(output: any) {
    return this.normalizeText(output?.resolved?.appName || output?.app?.appName)
  }

  private resolveCurrentIntent(
    readMode: any,
    searchIntent: any,
    fallback?: string | null,
  ): AiThreadRuntimeState['currentIntent'] {
    const rawIntent = this.normalizeText(readMode || searchIntent || fallback).toLowerCase()
    return rawIntent === 'aggregate'
      ? 'aggregation'
      : (rawIntent === 'records' || rawIntent === 'clarify'
          ? rawIntent as AiThreadRuntimeState['currentIntent']
          : undefined)
  }

  private normalizeReadMode(value: any): 'records' | 'aggregate' | null {
    const normalized = this.normalizeText(value).toLowerCase()
    return normalized === 'records' || normalized === 'aggregate'
      ? normalized as 'records' | 'aggregate'
      : null
  }

  private normalizeTargetType(value: any): 'source' | null {
    const normalized = this.normalizeText(value).toLowerCase()
    return normalized === 'source'
      ? 'source'
      : null
  }

  private normalizeExecutionStrategy(value: any): AiRuntimeExecutionStrategy | null {
    const normalized = this.normalizeText(value)
    return ['hard_serial', 'batch', 'parallel_safe', 'blocked_by_policy'].includes(normalized)
      ? normalized as AiRuntimeExecutionStrategy
      : null
  }

  private normalizeSearchConvergence(value: any): AiSearchConvergence | undefined {
    const normalized = this.normalizeText(value)
    return ['none', 'weak', 'clear'].includes(normalized)
      ? normalized as AiSearchConvergence
      : undefined
  }

  private isBatchReadOutput(output: any) {
    const kind = this.normalizeText(output?.result?.kind).toLowerCase()
    const targets = this.extractVerifiedTargetsFromReadOutput(output)
    return kind.startsWith('batch_')
      || targets.length > 1
      || this.normalizeExecutionStrategy(output?.result?.executionSummary?.strategy) === 'batch'
  }

  private buildDiagnostics(runtimeState: AiThreadRuntimeState) {
    const diagnostics = {
      currentTopCandidateStableRounds: this.normalizeFiniteNumber(runtimeState.currentTopCandidateStableRounds),
      lastExecutionStrategy: runtimeState.lastExecutionStrategy,
      lastBatchPartial: this.normalizeOptionalBoolean(runtimeState.lastBatchPartial),
    }

    return Object.values(diagnostics).some(value => value !== undefined && value !== null)
      ? diagnostics
      : undefined
  }

  private normalizeIds(value?: string[]) {
    return Array.isArray(value)
      ? [...new Set(value.map(item => this.normalizeText(item)).filter(Boolean))]
      : []
  }

  private normalizeScopeTransition(value?: string | null): AiCrossAppScopeTransition | undefined {
    const normalized = this.normalizeText(value)
    return ['inherit', 'narrow', 'expand', 'invalidate'].includes(normalized)
      ? normalized as AiCrossAppScopeTransition
      : undefined
  }

  private normalizeProfile(value?: string | null): AiConversationProfile | undefined {
    const normalized = this.normalizeText(value)
    return ['records_query', 'cross_app_compare', 'cross_app_merge', 'cross_app_unresolved'].includes(normalized)
      ? normalized as AiConversationProfile
      : undefined
  }

  private normalizeIntent(value?: string | null): AiThreadRuntimeState['currentIntent'] {
    const normalized = this.normalizeText(value).toLowerCase()
    return normalized === 'records'
      || normalized === 'aggregation'
      || normalized === 'clarify'
      ? normalized as AiThreadRuntimeState['currentIntent']
      : undefined
  }

  private normalizeContextKind(value?: string | null): AiThreadRuntimeContextKind | undefined {
    const normalized = this.normalizeText(value)
    return ['single_target', 'batch', 'comparison'].includes(normalized)
      ? normalized as AiThreadRuntimeContextKind
      : undefined
  }

  private normalizeText(value?: any) {
    return String(value || '').trim()
  }

  private normalizePendingChoiceAlias(value?: any) {
    const normalized = this.normalizeText(value)
      .replace(/\s+/g, '')
      .toLowerCase()
    return normalized || undefined
  }

  private normalizeOptionalBoolean(value?: boolean | null) {
    return typeof value === 'boolean' ? value : undefined
  }

  private normalizeFiniteNumber(value?: number | null) {
    return Number.isFinite(Number(value))
      ? Math.max(0, Number(value))
      : undefined
  }
}
