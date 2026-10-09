import { Injectable } from '@nestjs/common'
import {
  AiReadAppDataAnalysisResult,
  AiThreadCrossAppAnalysisBundle,
  AiThreadCrossAppAnalysisSlice,
  AiThreadRecordAnalysisSnapshot,
  AiThreadRuntimeState,
} from '../ai.types'
import { formatAiNumericValue } from '../utils/ai-numeric-display'
import { normalizeCrossAppAnalysisBundle } from './ai-cross-app-analysis-bundle.util'
import {
  isSameRecordAnalysisSnapshot,
  normalizeRecordAnalysisSnapshot,
  normalizeRecordAnalysisSnapshots,
  resolveRecordAnalysisSnapshotsFromOutputs,
} from './ai-record-analysis-snapshot.util'

type ResolveLatestVerifiedAnalysisOptions = {
  userMessage: string
  successfulToolOutputs?: any[]
  runtimeState?: AiThreadRuntimeState | null
  allowMaterializedRuntimeBundle?: boolean
}

type ResolvedVerifiedAnalysis = {
  source: 'current_turn' | 'runtime_state' | 'runtime_bundle'
  analysisResult: AiThreadRecordAnalysisSnapshot['analysisResult']
  snapshot: AiThreadRecordAnalysisSnapshot
  snapshots: AiThreadRecordAnalysisSnapshot[]
  bundle?: AiThreadCrossAppAnalysisBundle
}

type ResolvedVerifiedAnalysisDecision = {
  resolved: ResolvedVerifiedAnalysis | null
  reason?: 'cross_app_snapshot_not_supported' | 'snapshot_app_mismatch' | 'no_verified_analysis'
}

@Injectable()
export class AiAnalysisChartContextService {
  resolveLatestVerifiedAnalysisContext(
    options: ResolveLatestVerifiedAnalysisOptions,
  ): ResolvedVerifiedAnalysis | null {
    const currentTurnSnapshots = this.resolveCurrentTurnSnapshots(options.successfulToolOutputs)
    const currentTurnRuntimeBundleAnalysis = this.resolveCurrentTurnRuntimeBundleAnalysis(
      currentTurnSnapshots,
      options.runtimeState,
    )
    if (currentTurnRuntimeBundleAnalysis) {
      return currentTurnRuntimeBundleAnalysis
    }
    const materializedRuntimeBundleAnalysis = options.allowMaterializedRuntimeBundle
      ? this.resolveMaterializedRuntimeBundleAnalysis(options.runtimeState)
      : null
    if (materializedRuntimeBundleAnalysis) {
      return materializedRuntimeBundleAnalysis
    }
    const runtimeBundleAnalysis = this.resolveReusableRuntimeBundleAnalysis(
      options.userMessage,
      options.runtimeState,
    )
    if (runtimeBundleAnalysis) {
      return runtimeBundleAnalysis
    }

    if (currentTurnSnapshots.length) {
      const currentTurnSnapshot = currentTurnSnapshots[currentTurnSnapshots.length - 1]
      return {
        source: 'current_turn',
        analysisResult: currentTurnSnapshot.analysisResult,
        snapshot: currentTurnSnapshot,
        snapshots: currentTurnSnapshots,
      }
    }

    const runtimeStateSnapshots = this.resolveReusableRuntimeStateSnapshots(
      options.userMessage,
      options.runtimeState,
    )
    if (!runtimeStateSnapshots.length) {
      return null
    }
    const runtimeStateSnapshot = runtimeStateSnapshots[runtimeStateSnapshots.length - 1]

    return {
      source: 'runtime_state',
      analysisResult: runtimeStateSnapshot.analysisResult,
      snapshot: runtimeStateSnapshot,
      snapshots: runtimeStateSnapshots,
    }
  }

  resolveLatestVerifiedAnalysis(
    options: ResolveLatestVerifiedAnalysisOptions,
  ): ResolvedVerifiedAnalysis | null {
    return this.resolveLatestVerifiedAnalysisDecision(options).resolved
  }

  resolveLatestVerifiedAnalysisForResolvedCrossAppChoiceFollowup(
    options: ResolveLatestVerifiedAnalysisOptions,
  ): ResolvedVerifiedAnalysis | null {
    const currentProfile = this.normalizeConversationProfile(options.runtimeState?.currentProfile)
    if (currentProfile !== 'cross_app_compare' && currentProfile !== 'cross_app_merge') {
      return null
    }

    const resolved = this.resolveLatestVerifiedAnalysisContext(options)
    if (!resolved) {
      return null
    }

    const safetyDecision = this.resolveSnapshotSemanticSafetyDecision(
      resolved,
      options.runtimeState,
    )
    return safetyDecision.allowed
      ? resolved
      : null
  }

  isDisplayOnlyChartCommandMessage(
    userMessage: string,
    options: {
      allowFallback?: boolean
    } = {},
  ) {
    const normalizedUserMessage = String(userMessage || '').trim()
    if (!normalizedUserMessage) {
      return false
    }

    return this.hasDisplayOnlyChartCommand(normalizedUserMessage)
      || (
        options.allowFallback === true
        && this.hasDisplayOnlyChartCommandFallback(normalizedUserMessage)
      )
  }

  resolveLatestVerifiedAnalysisDecision(
    options: ResolveLatestVerifiedAnalysisOptions,
  ): ResolvedVerifiedAnalysisDecision {
    const resolved = this.resolveLatestVerifiedAnalysisContext(options)
    if (!resolved) {
      return {
        resolved: null,
        reason: 'no_verified_analysis',
      }
    }

    const normalizedUserMessage = String(options.userMessage || '').trim()
    const runtimeFollowupSource = resolved.source === 'runtime_state' || resolved.source === 'runtime_bundle'
    const canUseDisplayOnlyChartFallback = (
      runtimeFollowupSource
      && options.runtimeState?.currentIntent === 'aggregation'
    )
    const hasDisplayOnlyChartCommand = this.isDisplayOnlyChartCommandMessage(
      normalizedUserMessage,
      {
        allowFallback: canUseDisplayOnlyChartFallback,
      },
    )

    if (
      runtimeFollowupSource
      && !hasDisplayOnlyChartCommand
    ) {
      return {
        resolved: null,
        reason: 'no_verified_analysis',
      }
    }

    const safetyDecision = this.resolveSnapshotSemanticSafetyDecision(
      resolved,
      options.runtimeState,
    )
    if (!safetyDecision.allowed) {
      return {
        resolved: null,
        reason: safetyDecision.reason,
      }
    }

    return {
      resolved,
    }
  }

  private resolveCurrentTurnSnapshots(successfulToolOutputs?: any[]) {
    return resolveRecordAnalysisSnapshotsFromOutputs(successfulToolOutputs || []) || []
  }

  private resolveReusableRuntimeStateSnapshots(
    userMessage: string,
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    if (runtimeState?.currentIntent !== 'aggregation') {
      return []
    }

    const normalizedMessage = String(userMessage || '').trim()
    if (!normalizedMessage) {
      return []
    }

    if (this.hasNewAggregationSignal(normalizedMessage)) {
      return []
    }

    const normalizedSnapshots = normalizeRecordAnalysisSnapshots(runtimeState?.recordAnalysisSnapshots)
    const latestSnapshot = normalizeRecordAnalysisSnapshot(runtimeState?.latestRecordAnalysisSnapshot)
    if (!latestSnapshot) {
      return normalizedSnapshots?.length ? normalizedSnapshots : []
    }
    if (!normalizedSnapshots?.length) {
      return [latestSnapshot]
    }

    const lastSnapshot = normalizedSnapshots[normalizedSnapshots.length - 1]
    return isSameRecordAnalysisSnapshot(lastSnapshot, latestSnapshot)
      ? normalizedSnapshots
      : [latestSnapshot]
  }

  private resolveSnapshotSemanticSafetyDecision(
    resolved: ResolvedVerifiedAnalysis,
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    if (resolved.source === 'runtime_bundle') {
      return this.resolveBundleSemanticSafetyDecision(resolved, runtimeState)
    }

    const currentProfile = this.normalizeConversationProfile(runtimeState?.currentProfile)
    if (this.isCrossAppProfile(currentProfile)) {
      return {
        allowed: false,
        reason: 'cross_app_snapshot_not_supported' as const,
      }
    }

    if (resolved.source === 'current_turn') {
      if (currentProfile === 'records_query') {
        return {
          allowed: true,
        }
      }

      if (!currentProfile && this.normalizeContextKind(runtimeState?.currentContextKind) === 'comparison') {
        return {
          allowed: false,
          reason: 'cross_app_snapshot_not_supported' as const,
        }
      }

      return {
        allowed: true,
      }
    }

    const currentContextKind = this.normalizeContextKind(runtimeState?.currentContextKind)
    if (currentContextKind === 'comparison') {
      return {
        allowed: false,
        reason: 'snapshot_app_mismatch' as const,
      }
    }

    const verifiedAppIds = this.collectDistinctVerifiedAppIds(runtimeState)
    if (verifiedAppIds.length > 1) {
      return {
        allowed: false,
        reason: 'snapshot_app_mismatch' as const,
      }
    }
    if (verifiedAppIds.length === 1 && verifiedAppIds[0] !== resolved.snapshot.appId) {
      return {
        allowed: false,
        reason: 'snapshot_app_mismatch' as const,
      }
    }

    return {
      allowed: true,
    }
  }

  private resolveBundleSemanticSafetyDecision(
    resolved: ResolvedVerifiedAnalysis,
    runtimeState?: AiThreadRuntimeState | null,
  ) {
    const currentProfile = this.normalizeConversationProfile(runtimeState?.currentProfile)
    const normalizedBundle = normalizeCrossAppAnalysisBundle(resolved.bundle)
    if (!normalizedBundle) {
      return {
        allowed: false,
        reason: 'cross_app_snapshot_not_supported' as const,
      }
    }

    const bundleMatchesProfile = (
      (currentProfile === 'cross_app_compare' && normalizedBundle.mode === 'compare')
      || (currentProfile === 'cross_app_merge' && normalizedBundle.mode === 'merge')
    )
    if (!bundleMatchesProfile) {
      return {
        allowed: false,
        reason: 'cross_app_snapshot_not_supported' as const,
      }
    }

    return {
      allowed: true,
    }
  }

  private resolveReusableRuntimeBundleAnalysis(
    userMessage: string,
    runtimeState?: AiThreadRuntimeState | null,
  ): ResolvedVerifiedAnalysis | null {
    if (runtimeState?.currentIntent !== 'aggregation') {
      return null
    }

    const normalizedMessage = String(userMessage || '').trim()
    if (!normalizedMessage || this.hasNewAggregationSignal(normalizedMessage)) {
      return null
    }

    const currentProfile = this.normalizeConversationProfile(runtimeState?.currentProfile)
    if (currentProfile !== 'cross_app_compare' && currentProfile !== 'cross_app_merge') {
      return null
    }

    const bundle = normalizeCrossAppAnalysisBundle(runtimeState?.latestCrossAppAnalysisBundle)
    if (!bundle) {
      return null
    }
    if (currentProfile === 'cross_app_compare' && bundle.mode !== 'compare') {
      return null
    }
    if (currentProfile === 'cross_app_merge' && bundle.mode !== 'merge') {
      return null
    }

    const snapshots = this.buildSnapshotsFromBundleSlices(bundle.slices)
    if (snapshots.length < 2) {
      return null
    }

    const analysisResult = bundle.mode === 'compare'
      ? this.buildCompareBundleAnalysisResult(bundle)
      : this.buildMergeBundleAnalysisResult(bundle)
    if (!analysisResult) {
      return null
    }

    return {
      source: 'runtime_bundle',
      analysisResult,
      snapshot: snapshots[snapshots.length - 1],
      snapshots,
      bundle,
    }
  }

  private resolveCurrentTurnRuntimeBundleAnalysis(
    currentTurnSnapshots: AiThreadRecordAnalysisSnapshot[],
    runtimeState?: AiThreadRuntimeState | null,
  ): ResolvedVerifiedAnalysis | null {
    if (runtimeState?.currentIntent !== 'aggregation') {
      return null
    }

    const currentProfile = this.normalizeConversationProfile(runtimeState?.currentProfile)
    if (currentProfile !== 'cross_app_compare' && currentProfile !== 'cross_app_merge') {
      return null
    }

    if ((Array.isArray(currentTurnSnapshots) ? currentTurnSnapshots : []).length < 2) {
      return null
    }

    const bundle = normalizeCrossAppAnalysisBundle(runtimeState?.latestCrossAppAnalysisBundle)
    if (!bundle) {
      return null
    }
    if (currentProfile === 'cross_app_compare' && bundle.mode !== 'compare') {
      return null
    }
    if (currentProfile === 'cross_app_merge' && bundle.mode !== 'merge') {
      return null
    }

    const currentTurnAppIds = this.collectDistinctSnapshotAppIds(currentTurnSnapshots)
    if (!currentTurnAppIds.length || !this.hasSameAppSet(currentTurnAppIds, bundle.expectedAppIds)) {
      return null
    }

    const currentTurnRequestSignatures = [...new Set(
      currentTurnSnapshots
        .map(snapshot => this.normalizeText(snapshot?.requestSignature))
        .filter(Boolean),
    )]
    if (currentTurnRequestSignatures.length !== 1 || currentTurnRequestSignatures[0] !== bundle.requestSignature) {
      return null
    }

    const snapshots = this.buildSnapshotsFromBundleSlices(bundle.slices)
    if (snapshots.length < 2 || !this.hasSameAppSet(this.collectDistinctSnapshotAppIds(snapshots), currentTurnAppIds)) {
      return null
    }

    const analysisResult = bundle.mode === 'compare'
      ? this.buildCompareBundleAnalysisResult(bundle)
      : this.buildMergeBundleAnalysisResult(bundle)
    if (!analysisResult) {
      return null
    }

    return {
      source: 'runtime_bundle',
      analysisResult,
      snapshot: snapshots[snapshots.length - 1],
      snapshots,
      bundle,
    }
  }

  private resolveMaterializedRuntimeBundleAnalysis(
    runtimeState?: AiThreadRuntimeState | null,
  ): ResolvedVerifiedAnalysis | null {
    if (runtimeState?.currentIntent !== 'aggregation') {
      return null
    }

    const currentProfile = this.normalizeConversationProfile(runtimeState?.currentProfile)
    if (currentProfile !== 'cross_app_compare' && currentProfile !== 'cross_app_merge') {
      return null
    }

    const bundle = normalizeCrossAppAnalysisBundle(runtimeState?.latestCrossAppAnalysisBundle)
    if (!bundle) {
      return null
    }
    if (currentProfile === 'cross_app_compare' && bundle.mode !== 'compare') {
      return null
    }
    if (currentProfile === 'cross_app_merge' && bundle.mode !== 'merge') {
      return null
    }

    const currentSnapshots = normalizeRecordAnalysisSnapshots(runtimeState?.recordAnalysisSnapshots)
    const currentAppIds = this.collectDistinctSnapshotAppIds(currentSnapshots || [])
    if (!currentAppIds.length || !this.hasSameAppSet(currentAppIds, bundle.expectedAppIds)) {
      return null
    }

    const currentRequestSignatures = [...new Set(
      (Array.isArray(currentSnapshots) ? currentSnapshots : [])
        .map(snapshot => this.normalizeText(snapshot?.requestSignature))
        .filter(Boolean),
    )]
    if (currentRequestSignatures.length !== 1 || currentRequestSignatures[0] !== bundle.requestSignature) {
      return null
    }

    const snapshots = this.buildSnapshotsFromBundleSlices(bundle.slices)
    if (snapshots.length < 2 || !this.hasSameAppSet(this.collectDistinctSnapshotAppIds(snapshots), currentAppIds)) {
      return null
    }

    const analysisResult = bundle.mode === 'compare'
      ? this.buildCompareBundleAnalysisResult(bundle)
      : this.buildMergeBundleAnalysisResult(bundle)
    if (!analysisResult) {
      return null
    }

    return {
      source: 'runtime_bundle',
      analysisResult,
      snapshot: snapshots[snapshots.length - 1],
      snapshots,
      bundle,
    }
  }

  private buildSnapshotsFromBundleSlices(slices?: AiThreadCrossAppAnalysisSlice[]) {
    return (Array.isArray(slices) ? slices : [])
      .map(slice => {
        const appId = String(slice?.appId || '').trim()
        if (!appId || !slice?.analysisResult) {
          return null
        }

        return normalizeRecordAnalysisSnapshot({
          appId,
          appName: slice.appName,
          targetId: slice.targetId,
          targetName: slice.targetName,
          targetType: slice.targetType,
          mode: 'aggregate',
          requestSignature: slice.requestSignature,
          requestSummary: slice.requestSummary,
          analysisResult: slice.analysisResult,
        })
      })
      .filter((item): item is AiThreadRecordAnalysisSnapshot => Boolean(item))
  }

  private collectDistinctSnapshotAppIds(snapshots: AiThreadRecordAnalysisSnapshot[]) {
    return [...new Set(
      (Array.isArray(snapshots) ? snapshots : [])
        .map(snapshot => this.normalizeText(snapshot?.appId))
        .filter(Boolean),
    )].sort()
  }

  private hasSameAppSet(left: string[], right: string[]) {
    const normalizedLeft = [...new Set((Array.isArray(left) ? left : []).map(item => this.normalizeText(item)).filter(Boolean))].sort()
    const normalizedRight = [...new Set((Array.isArray(right) ? right : []).map(item => this.normalizeText(item)).filter(Boolean))].sort()
    if (normalizedLeft.length !== normalizedRight.length) {
      return false
    }
    return normalizedLeft.every((item, index) => item === normalizedRight[index])
  }

  private buildCompareBundleAnalysisResult(
    bundle: AiThreadCrossAppAnalysisBundle,
  ): AiReadAppDataAnalysisResult | null {
    if (bundle.mode !== 'compare') {
      return null
    }

    const firstSlice = bundle.slices[0]
    const firstResult = firstSlice?.analysisResult
    const metricDefs = Array.isArray(firstResult?.metricDefs)
      ? firstResult.metricDefs.map(item => ({
          key: item.key,
          op: item.op,
          field: item.field,
          displayMeta: item.displayMeta,
        }))
      : []
    const originalGroupDefs = Array.isArray(firstResult?.groupDefs)
      ? firstResult.groupDefs.map(item => ({
          key: item.key,
          field: item.field,
          timeGranularity: item.timeGranularity,
          displayMeta: item.displayMeta,
        }))
      : []
    if (!metricDefs.length || !originalGroupDefs.length) {
      return null
    }

    const compareAppDimensionKey = '__compare_app'
    const groupDefs = [{
      key: compareAppDimensionKey,
      field: 'app',
      timeGranularity: null,
    }, ...originalGroupDefs]
    const rows = bundle.slices.flatMap(slice => this.buildCompareBundleRows({
      slice,
      metricDefs,
      groupDefs,
      compareAppDimensionKey,
    }))
    if (!rows.length) {
      return null
    }

    const totals = metricDefs.reduce<Record<string, number | null>>((accumulator, metricDef) => {
      const metricKey = this.normalizeText(metricDef?.key)
      if (!metricKey) {
        return accumulator
      }

      const metricTotal = rows.reduce((sum, row) => {
        const value = Number(row?.metrics?.[metricKey])
        return Number.isFinite(value) ? sum + value : sum
      }, 0)
      accumulator[metricKey] = metricTotal
      return accumulator
    }, {})

    const matchedCount = bundle.slices.reduce((sum, slice) => {
      const count = Number(slice?.analysisResult?.meta?.matchedCount || 0)
      return sum + (Number.isFinite(count) ? count : 0)
    }, 0)

    return {
      metricDefs,
      groupDefs,
      rows,
      totals,
      totalsDisplay: this.buildMetricDisplayMap({
        metricDefs,
        metrics: totals,
      }),
      meta: {
        sourceCount: bundle.slices.length,
        matchedCount,
        groupCount: rows.length,
        rowCount: rows.length,
        topNApplied: bundle.slices.some(slice => slice?.analysisResult?.meta?.topNApplied === true),
        truncated: bundle.slices.some(slice => slice?.analysisResult?.meta?.truncated === true),
        mergeStrategy: 'single',
      },
    }
  }

  private buildCompareBundleRows(options: {
    slice: AiThreadCrossAppAnalysisSlice
    metricDefs: AiReadAppDataAnalysisResult['metricDefs']
    groupDefs: AiReadAppDataAnalysisResult['groupDefs']
    compareAppDimensionKey: string
  }) {
    const metricKeys = (Array.isArray(options.metricDefs) ? options.metricDefs : [])
      .map(metricDef => this.normalizeText(metricDef?.key))
      .filter(Boolean)
    const groupKeys = (Array.isArray(options.groupDefs) ? options.groupDefs : [])
      .map(groupDef => this.normalizeText(groupDef?.key))
      .filter(Boolean)
      .filter(groupKey => groupKey !== options.compareAppDimensionKey)
    if (!metricKeys.length || !groupKeys.length) {
      return []
    }

    const appLabel = String(
      options.slice?.appName
      || options.slice?.targetName
      || options.slice?.appId
      || 'App',
    ).trim()

    return (Array.isArray(options.slice?.analysisResult?.rows) ? options.slice.analysisResult.rows : [])
      .map(row => {
        const dimensions: Record<string, string> = {
          [options.compareAppDimensionKey]: appLabel,
        }
        const displayDimensions: Record<string, string> = {
          [options.compareAppDimensionKey]: appLabel,
        }

        groupKeys.forEach(groupKey => {
          const rawValue = this.normalizeText(row?.dimensions?.[groupKey])
          const displayValue = this.normalizeText(row?.display?.dimensions?.[groupKey])
          dimensions[groupKey] = rawValue || displayValue || ''
          displayDimensions[groupKey] = displayValue || rawValue || ''
        })

        const metrics = Object.fromEntries(
          metricKeys.map(metricKey => [metricKey, row?.metrics?.[metricKey] ?? null]),
        )

        return {
          dimensions,
          metrics,
          display: {
            dimensions: displayDimensions,
            metrics: this.buildMetricDisplayMap({
              metricDefs: options.metricDefs,
              metrics,
              preferredDisplayMetrics: row?.display?.metrics,
            }),
          },
        }
      })
      .filter(row =>
        this.normalizeText(row?.dimensions?.[options.compareAppDimensionKey]),
      )
  }

  private buildMergeBundleAnalysisResult(
    bundle: AiThreadCrossAppAnalysisBundle,
  ): AiReadAppDataAnalysisResult | null {
    if (bundle.mode !== 'merge') {
      return null
    }

    const firstSlice = bundle.slices[0]
    const firstResult = firstSlice?.analysisResult
    const firstGroupDef = firstResult?.groupDefs?.[0]
    const mergeKey = String(bundle.alignmentSummary.mergeKey || firstGroupDef?.key || '').trim()
    const mergeField = String(firstGroupDef?.field || mergeKey).trim()
    if (!mergeKey || !mergeField) {
      return null
    }

    const metricDefs = Array.isArray(firstResult?.metricDefs)
      ? firstResult.metricDefs.map(item => ({
          key: item.key,
          op: item.op,
          field: item.field,
          displayMeta: item.displayMeta,
        }))
      : []
    if (!metricDefs.length) {
      return null
    }

    const mergedRows = new Map<string, {
      rawValue: string
      displayValue: string
      metrics: Record<string, number | null>
    }>()

    bundle.slices.forEach(slice => {
      const rows = Array.isArray(slice?.analysisResult?.rows) ? slice.analysisResult.rows : []
      rows.forEach(row => {
        const rawGroupValue = String(row?.dimensions?.[mergeKey] || '').trim()
        const displayGroupValue = String(row?.display?.dimensions?.[mergeKey] || rawGroupValue).trim()
        const mergeIdentity = rawGroupValue || displayGroupValue
        if (!mergeIdentity) {
          return
        }

        const existing = mergedRows.get(mergeIdentity) || {
          rawValue: rawGroupValue || displayGroupValue,
          displayValue: displayGroupValue || rawGroupValue,
          metrics: Object.fromEntries(metricDefs.map(item => [item.key, 0])),
        }

        if (!existing.rawValue && rawGroupValue) {
          existing.rawValue = rawGroupValue
        }
        if (!existing.displayValue && (displayGroupValue || rawGroupValue)) {
          existing.displayValue = displayGroupValue || rawGroupValue
        }

        metricDefs.forEach(metricDef => {
          const metricKey = String(metricDef.key || '').trim()
          const nextValue = row?.metrics?.[metricKey]
          if (!metricKey || nextValue === null || nextValue === undefined) {
            return
          }

          const numericNextValue = Number(nextValue)
          if (!Number.isFinite(numericNextValue)) {
            return
          }

          const previousValue = Number(existing.metrics[metricKey] || 0)
          existing.metrics[metricKey] = previousValue + numericNextValue
        })

        mergedRows.set(mergeIdentity, existing)
      })
    })

    const rows = [...mergedRows.values()].map(item => ({
      dimensions: {
        [mergeKey]: item.rawValue,
      },
      metrics: item.metrics,
      display: {
        dimensions: {
          [mergeKey]: item.displayValue || item.rawValue,
        },
        metrics: this.buildMetricDisplayMap({
          metricDefs,
          metrics: item.metrics,
        }),
      },
    }))
    if (!rows.length) {
      return null
    }

    const totals = metricDefs.reduce<Record<string, number | null>>((accumulator, metricDef) => {
      const metricKey = String(metricDef.key || '').trim()
      if (!metricKey) {
        return accumulator
      }

      const metricTotal = rows.reduce((sum, row) => {
        const value = Number(row?.metrics?.[metricKey] || 0)
        return Number.isFinite(value) ? sum + value : sum
      }, 0)
      accumulator[metricKey] = metricTotal
      return accumulator
    }, {})

    const matchedCount = bundle.slices.reduce((sum, slice) => {
      const count = Number(slice?.analysisResult?.meta?.matchedCount || 0)
      return sum + (Number.isFinite(count) ? count : 0)
    }, 0)

    return {
      metricDefs,
      groupDefs: [{
        key: mergeKey,
        field: mergeField,
        timeGranularity: firstGroupDef?.timeGranularity || null,
      }],
      rows,
      totals,
      totalsDisplay: this.buildMetricDisplayMap({
        metricDefs,
        metrics: totals,
      }),
      meta: {
        sourceCount: bundle.slices.length,
        matchedCount,
        groupCount: rows.length,
        rowCount: rows.length,
        topNApplied: bundle.slices.some(slice => slice?.analysisResult?.meta?.topNApplied === true),
        truncated: bundle.slices.some(slice => slice?.analysisResult?.meta?.truncated === true),
        mergeStrategy: 'single',
      },
    }
  }

  private collectDistinctVerifiedAppIds(runtimeState?: AiThreadRuntimeState | null) {
    return [...new Set(
      (Array.isArray(runtimeState?.verifiedTargets) ? runtimeState?.verifiedTargets : [])
        .map(item => String(item?.appId || '').trim())
      .filter(Boolean),
    )]
  }
  private normalizeConversationProfile(value: unknown) {
    const normalized = String(value || '').trim()
    return ['records_query', 'cross_app_compare', 'cross_app_merge', 'cross_app_unresolved'].includes(normalized)
      ? normalized
      : undefined
  }

  private isCrossAppProfile(value?: string) {
    return value === 'cross_app_compare'
      || value === 'cross_app_merge'
      || value === 'cross_app_unresolved'
  }

  private normalizeContextKind(value: unknown) {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'single_target'
      || normalized === 'batch'
      || normalized === 'comparison'
      ? normalized
      : undefined
  }

  private buildMetricDisplayMap(options: {
    metricDefs?: Array<{ key?: string; displayMeta?: any }>
    metrics?: Record<string, unknown> | null
    preferredDisplayMetrics?: Record<string, unknown> | null
  }) {
    const metrics = options.metrics && typeof options.metrics === 'object' && !Array.isArray(options.metrics)
      ? options.metrics
      : {}

    return Object.fromEntries(Object.entries(metrics).map(([metricKey, value]) => [
      metricKey,
      this.buildMetricDisplayValue({
        metricDefs: options.metricDefs,
        metricKey,
        value,
        preferredDisplay: options.preferredDisplayMetrics?.[metricKey],
      }),
    ]))
  }

  private buildMetricDisplayValue(options: {
    metricDefs?: Array<{ key?: string; displayMeta?: any }>
    metricKey: string
    value: unknown
    preferredDisplay?: unknown
  }) {
    const preferredDisplayText = options.preferredDisplay === null || options.preferredDisplay === undefined
      ? ''
      : String(options.preferredDisplay).trim()
    if (preferredDisplayText) {
      return preferredDisplayText
    }
    if (options.value === null || options.value === undefined) {
      return ''
    }

    const numericValue = Number(options.value)
    if (!Number.isFinite(numericValue)) {
      return String(options.value)
    }

    const metricDef = (Array.isArray(options.metricDefs) ? options.metricDefs : [])
      .find(item => this.normalizeText(item?.key) === this.normalizeText(options.metricKey))

    return formatAiNumericValue(numericValue, metricDef?.displayMeta)
  }

  private normalizeText(value?: unknown) {
    return String(value || '').trim()
  }

  private hasNewAggregationSignal(userMessage: string) {
    const rangeTimePattern = /(?:\u8fd1|\u6700\u8fd1)[\d\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u4e24\u4fe9]+(?:\u4e2a)?(?:\u5929|\u5468|\u661f\u671f|\u6708|\u5b63\u5ea6|\u5e74)/i
    const relativeTimePattern = /(?:\u8fd9|\u8fd9\u4e2a|\u672c|\u4eca|\u4e0a|\u4e0b|\u660e|\u53bb)(?:\u4e2a)?(?:\u5929|\u5468|\u661f\u671f|\u6708|\u5e74|\u5b63\u5ea6)|\u672c\u5e74|\u5e74\u5ea6/i
    const regroupChartPattern = /按(?:照)?(?!图表|条形图|柱状图|折线图|环图|饼图|散点图)[^，。,；;？?\s]{1,12}(?:改成|换成|切换成|画|绘制|生成|展示|显示|呈现)/i
    return /(\u91cd\u65b0\u7edf\u8ba1|\u91cd\u65b0\u67e5\u8be2|\u6309.+\u7edf\u8ba1|\u7b5b\u9009|\u8fc7\u6ee4)/i.test(userMessage)
      || regroupChartPattern.test(userMessage)
      || rangeTimePattern.test(userMessage)
      || relativeTimePattern.test(userMessage)
  }

  private hasDisplayOnlyChartCommand(userMessage: string) {
    return [
      /(?:\u8bf7|(?:\u5e2e|\u7ed9)\u6211)?(?:\u7528)?(?:\u56fe\u8868|\u6761\u5f62\u56fe|\u67f1\u72b6\u56fe|\u6298\u7ebf\u56fe|\u73af\u56fe|\u997c\u56fe|\u6563\u70b9\u56fe)(?:\u6765)?(?:\u5c55\u793a|\u5448\u73b0|\u663e\u793a)/i,
      /(?:\u6539\u6210|\u6362\u6210|\u5207\u6362\u6210)(?:\u56fe\u8868|\u6761\u5f62\u56fe|\u67f1\u72b6\u56fe|\u6298\u7ebf\u56fe|\u73af\u56fe|\u997c\u56fe|\u6563\u70b9\u56fe)/i,
      /(?:\u753b|\u7ed8\u5236|\u751f\u6210)(?:\u4e2a|\u5f20)?(?:\u56fe\u8868|\u6761\u5f62\u56fe|\u67f1\u72b6\u56fe|\u6298\u7ebf\u56fe|\u73af\u56fe|\u997c\u56fe|\u6563\u70b9\u56fe)/i,
      /^(?:\u8f93\u51fa|\u6765\u4e2a|\u6765\u5f20|\u51fa\u4e2a)(?:\u5bf9\u6bd4)?(?:\u56fe\u8868|\u5bf9\u6bd4\u56fe|\u6761\u5f62\u56fe|\u67f1\u72b6\u56fe|\u6298\u7ebf\u56fe|\u73af\u56fe|\u997c\u56fe|\u6563\u70b9\u56fe)(?:\u770b\u770b|\u4e00\u4e0b|\u4e0b|\u5427)?[.!?\u3002\uff01\uff1f]?$/i,
      /^(?:\u5bf9\u6bd4\u56fe\u8868|\u5bf9\u6bd4\u56fe)(?:\u770b\u770b)?$/i,
      /(?:change|switch|show|display|render|turn).*(?:chart|bar chart|line chart|donut chart|pie chart|scatter(?: plot)?|horizontal bar)/i,
      /(?:bar|line|donut|pie|scatter|horizontal bar)\s+chart/i,
    ].some(pattern => pattern.test(userMessage))
  }

  private hasDisplayOnlyChartCommandFallback(userMessage: string) {
    const normalized = String(userMessage || '').trim()
    if (!normalized || normalized.length > 8) {
      return false
    }

    if (/^(?:来个|来张|出个)图(?:看看|一下|下|吧)?[.!?。！？]?$/i.test(normalized)) {
      return true
    }

    return [
      '来个图',
      '来张图',
      '出个图',
    ].includes(normalized)
  }

  private hasChartExplanationSignal(userMessage: string) {
    return /(\u600e\u4e48\u770b|\u4ec0\u4e48|\u4ee3\u8868\u4ec0\u4e48|\u542b\u4e49|\u4e3a\u4f55|\u4e3a\u4ec0\u4e48|\?|\uff1f)/i.test(userMessage)
  }
}
