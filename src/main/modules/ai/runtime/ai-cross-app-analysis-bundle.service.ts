import { Injectable } from '@nestjs/common'
import type {
  AiCrossAppAlignmentLimitationReason,
  AiCrossAppAlignmentState,
  AiReadAppDataAnalysisResult,
  AiReadAppDataTimeGranularity,
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
} from './ai-record-analysis-snapshot.util'

@Injectable()
export class AiCrossAppAnalysisBundleService {
  resolveRuntimeStateWithLatestBundle(
    runtimeState?: AiThreadRuntimeState | null,
  ): AiThreadRuntimeState | null | undefined {
    if (!runtimeState) {
      return runtimeState
    }

    const currentProfile = this.normalizeConversationProfile(runtimeState.currentProfile)
    const latestCrossAppAlignmentState = this.resolveLatestCrossAppAlignmentState(runtimeState, currentProfile)
    if (currentProfile === 'records_query') {
      return {
        ...runtimeState,
        latestCrossAppAlignmentState,
        latestCrossAppAnalysisBundle: undefined,
      }
    }

    const existingBundle = normalizeCrossAppAnalysisBundle(runtimeState.latestCrossAppAnalysisBundle)
    if (currentProfile === 'cross_app_compare') {
      const nextBundle = latestCrossAppAlignmentState?.status
        && latestCrossAppAlignmentState.status !== 'fully_comparable'
        ? undefined
        : (this.buildCompareBundleFromRuntimeState(runtimeState) || existingBundle)
      return {
        ...runtimeState,
        latestCrossAppAlignmentState,
        latestCrossAppAnalysisBundle: nextBundle,
      }
    }

    if (currentProfile === 'cross_app_merge') {
      const nextBundle = latestCrossAppAlignmentState?.status
        && latestCrossAppAlignmentState.status !== 'fully_comparable'
        ? undefined
        : (this.buildMergeBundleFromRuntimeState(runtimeState) || existingBundle)
      return {
        ...runtimeState,
        latestCrossAppAlignmentState,
        latestCrossAppAnalysisBundle: nextBundle,
      }
    }

    return {
      ...runtimeState,
      latestCrossAppAlignmentState,
      latestCrossAppAnalysisBundle: existingBundle || undefined,
    }
  }

  private resolveLatestCrossAppAlignmentState(
    runtimeState?: AiThreadRuntimeState | null,
    currentProfile?: AiThreadRuntimeState['currentProfile'],
  ): AiCrossAppAlignmentState | undefined {
    const mode = currentProfile === 'cross_app_merge'
      ? 'merge'
      : currentProfile === 'cross_app_compare'
        ? 'compare'
        : undefined
    if (!mode) {
      return undefined
    }

    const snapshots = this.resolveCandidateSnapshots(runtimeState)
    const alignedSnapshots = this.resolveAlignedSnapshotsByLatestSignature(snapshots)
    if (alignedSnapshots.length < 2) {
      return undefined
    }

    const collapsedSnapshots = this.collapseAlignedSnapshotsByApp(alignedSnapshots)
    if (collapsedSnapshots.length < 2) {
      return undefined
    }

    const firstSnapshot = collapsedSnapshots[0]
    const requestSignature = this.normalizeText(firstSnapshot?.requestSignature)
    const scope = this.buildAlignmentScope(runtimeState, collapsedSnapshots)
    const limitationReasons: AiCrossAppAlignmentLimitationReason[] = []

    if (!this.hasCompatibleMetricAlignment(collapsedSnapshots)) {
      limitationReasons.push('metric_definition_mismatch')
      return this.buildAlignmentState({
        status: 'unresolved',
        mode,
        scope,
        firstSnapshot,
        requestSignature,
        limitationReasons,
      })
    }

    const groupLimitationReason = mode === 'compare'
      ? this.resolveCompareGroupLimitation(collapsedSnapshots)
      : this.resolveMergeGroupLimitation(collapsedSnapshots)
    if (groupLimitationReason) {
      limitationReasons.push(groupLimitationReason)
    }

    if (this.isSampleIncomplete(scope.appIds, collapsedSnapshots)) {
      limitationReasons.push('sample_incomplete')
    }

    if (!limitationReasons.length) {
      return this.buildAlignmentState({
        status: 'fully_comparable',
        mode,
        scope,
        firstSnapshot,
        requestSignature,
      })
    }

    const status = limitationReasons.every(reason =>
      reason === 'granularity_mismatch' || reason === 'sample_incomplete',
    )
      ? 'partially_comparable'
      : 'unresolved'

    return this.buildAlignmentState({
      status,
      mode,
      scope,
      firstSnapshot,
      requestSignature,
      limitationReasons,
    })
  }

  private buildCompareBundleFromRuntimeState(runtimeState?: AiThreadRuntimeState | null) {
    const snapshots = this.resolveCandidateSnapshots(runtimeState)
    const alignedSnapshots = this.resolveAlignedSnapshotsByLatestSignature(snapshots)
    if (alignedSnapshots.length < 2) {
      return undefined
    }

    if (!this.hasCompatibleCompareAlignment(alignedSnapshots)) {
      return undefined
    }

    const requestSignature = this.normalizeText(alignedSnapshots[0]?.requestSignature)
    const requestSummary = alignedSnapshots[0]?.requestSummary
    if (!requestSignature || !requestSummary) {
      return undefined
    }

    const collapsedSnapshots = this.collapseAlignedSnapshotsByApp(alignedSnapshots)
    const expectedAppIds = this.collectDistinctAppIds(collapsedSnapshots)
    if (expectedAppIds.length < 2 || expectedAppIds.length !== collapsedSnapshots.length) {
      return undefined
    }

    const firstSnapshot = collapsedSnapshots[0]
    return {
      mode: 'compare',
      status: 'complete',
      expectedAppIds,
      requestSignature,
      requestSummary,
      alignmentSummary: {
        kind: 'compare',
        metricKeys: this.collectMetricKeys(firstSnapshot.analysisResult),
        groupKeys: this.collectGroupKeys(firstSnapshot.analysisResult),
        timeGranularity: this.resolvePrimaryTimeGranularity(firstSnapshot.analysisResult),
      },
      slices: collapsedSnapshots.map(snapshot => this.buildSlice(snapshot)),
    } satisfies AiThreadCrossAppAnalysisBundle
  }

  private buildMergeBundleFromRuntimeState(runtimeState?: AiThreadRuntimeState | null) {
    const snapshots = this.resolveCandidateSnapshots(runtimeState)
    const alignedSnapshots = this.resolveAlignedSnapshotsByLatestSignature(snapshots)
    if (alignedSnapshots.length < 2) {
      return undefined
    }

    if (!this.hasCompatibleMergeAlignment(alignedSnapshots)) {
      return undefined
    }

    const requestSignature = this.normalizeText(alignedSnapshots[0]?.requestSignature)
    const requestSummary = alignedSnapshots[0]?.requestSummary
    const mergeKey = this.normalizeText(alignedSnapshots[0]?.analysisResult?.groupDefs?.[0]?.key)
    if (!requestSignature || !requestSummary || !mergeKey) {
      return undefined
    }

    const collapsedSnapshots = this.collapseAlignedSnapshotsByApp(alignedSnapshots)
    const expectedAppIds = this.collectDistinctAppIds(collapsedSnapshots)
    if (expectedAppIds.length < 2 || expectedAppIds.length !== collapsedSnapshots.length) {
      return undefined
    }

    const firstSnapshot = collapsedSnapshots[0]
    return {
      mode: 'merge',
      status: 'complete',
      expectedAppIds,
      requestSignature,
      requestSummary,
      alignmentSummary: {
        kind: 'merge',
        metricKeys: this.collectMetricKeys(firstSnapshot.analysisResult),
        groupKeys: this.collectGroupKeys(firstSnapshot.analysisResult),
        mergeKey,
      },
      slices: collapsedSnapshots.map(snapshot => this.buildSlice(snapshot)),
    } satisfies AiThreadCrossAppAnalysisBundle
  }

  private buildAlignmentState(options: {
    status: AiCrossAppAlignmentState['status']
    mode: 'compare' | 'merge'
    scope: AiCrossAppAlignmentState['scope']
    firstSnapshot: AiThreadRecordAnalysisSnapshot
    requestSignature?: string
    limitationReasons?: AiCrossAppAlignmentLimitationReason[]
  }): AiCrossAppAlignmentState {
    const alignmentBasis = {
      mode: options.mode,
      metricKeys: this.collectMetricKeys(options.firstSnapshot?.analysisResult),
      groupKeys: this.collectGroupKeys(options.firstSnapshot?.analysisResult),
      timeGranularity: this.resolvePrimaryTimeGranularity(options.firstSnapshot?.analysisResult),
      mergeKey: options.mode === 'merge'
        ? this.normalizeText(options.firstSnapshot?.analysisResult?.groupDefs?.[0]?.key) || undefined
        : undefined,
    }

    return {
      status: options.status,
      scope: options.scope,
      alignmentBasis,
      limitationReasons: options.limitationReasons?.length
        ? [...new Set(options.limitationReasons)]
        : undefined,
      bundleRef: options.status === 'fully_comparable' && options.requestSignature
        ? {
            mode: options.mode,
            requestSignature: options.requestSignature,
          }
        : undefined,
    }
  }

  private resolveCandidateSnapshots(runtimeState?: AiThreadRuntimeState | null) {
    if (Array.isArray(runtimeState?.activeRecordAnalysisSnapshots)) {
      const activeSnapshots = normalizeRecordAnalysisSnapshots(runtimeState.activeRecordAnalysisSnapshots)
      return activeSnapshots?.length
        ? activeSnapshots
        : []
    }

    const normalizedSnapshots = normalizeRecordAnalysisSnapshots(runtimeState?.recordAnalysisSnapshots)
    const latestSnapshot = normalizeRecordAnalysisSnapshot(runtimeState?.latestRecordAnalysisSnapshot)
    if (!latestSnapshot) {
      return normalizedSnapshots || []
    }
    if (!normalizedSnapshots?.length) {
      return [latestSnapshot]
    }

    const lastSnapshot = normalizedSnapshots[normalizedSnapshots.length - 1]
    return isSameRecordAnalysisSnapshot(lastSnapshot, latestSnapshot)
      ? normalizedSnapshots
      : [...normalizedSnapshots, latestSnapshot]
  }

  private resolveAlignedSnapshotsByLatestSignature(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const latestSnapshot = snapshots[snapshots.length - 1]
    const latestSignature = this.normalizeText(latestSnapshot?.requestSignature)
    if (!latestSignature) {
      return []
    }

    return snapshots.filter(snapshot => this.normalizeText(snapshot.requestSignature) === latestSignature)
  }

  private buildAlignmentScope(
    runtimeState: AiThreadRuntimeState | null | undefined,
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const verifiedTargets = Array.isArray(runtimeState?.verifiedTargets)
      ? runtimeState.verifiedTargets.filter(item => item?.mode === 'aggregate' && item?.targetType === 'source')
      : []
    const appIdsFromVerifiedTargets = [...new Set(
      verifiedTargets
        .map(item => this.normalizeText(item?.appId))
        .filter(Boolean),
    )].sort()
    const sourceIdsFromVerifiedTargets = [...new Set(
      verifiedTargets
        .map(item => this.normalizeText(item?.targetId))
        .filter(Boolean),
    )].sort()

    return {
      appIds: appIdsFromVerifiedTargets.length
        ? appIdsFromVerifiedTargets
        : this.collectDistinctAppIds(snapshots),
      sourceIds: sourceIdsFromVerifiedTargets.length
        ? sourceIdsFromVerifiedTargets
        : [...new Set(
            snapshots
              .map(snapshot => this.normalizeText(snapshot?.targetId))
              .filter(Boolean),
          )].sort(),
    }
  }

  private isSampleIncomplete(
    expectedAppIds: string[],
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const actualAppIds = this.collectDistinctAppIds(snapshots)
    return expectedAppIds.length >= 2
      && actualAppIds.length >= 2
      && actualAppIds.length < expectedAppIds.length
      && actualAppIds.every(appId => expectedAppIds.includes(appId))
  }

  private hasCompatibleCompareAlignment(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const [firstSnapshot, ...restSnapshots] = snapshots
    return restSnapshots.every(snapshot =>
      this.hasCompatibleMetricDefs(firstSnapshot.analysisResult, snapshot.analysisResult)
      && this.hasCompatibleGroupDefs(firstSnapshot.analysisResult, snapshot.analysisResult)
    )
  }

  private hasCompatibleMetricAlignment(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const [firstSnapshot, ...restSnapshots] = snapshots
    return restSnapshots.every(snapshot =>
      this.hasCompatibleMetricDefs(firstSnapshot.analysisResult, snapshot.analysisResult),
    )
  }

  private resolveCompareGroupLimitation(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ): AiCrossAppAlignmentLimitationReason | undefined {
    const [firstSnapshot, ...restSnapshots] = snapshots
    let hasGranularityMismatch = false

    for (const snapshot of restSnapshots) {
      if (this.hasCompatibleGroupDefs(firstSnapshot.analysisResult, snapshot.analysisResult)) {
        continue
      }

      if (this.isGranularityComparableGroupAlignment(firstSnapshot.analysisResult, snapshot.analysisResult)) {
        hasGranularityMismatch = true
        continue
      }

      return 'field_mismatch'
    }

    return hasGranularityMismatch
      ? 'granularity_mismatch'
      : undefined
  }

  private hasCompatibleMergeAlignment(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const [firstSnapshot, ...restSnapshots] = snapshots
    const mergeKey = this.normalizeText(firstSnapshot?.analysisResult?.groupDefs?.[0]?.key)
    if (!mergeKey) {
      return false
    }

    if (!this.hasRowsCompatibleWithMergeKey(firstSnapshot.analysisResult, mergeKey)) {
      return false
    }

    return restSnapshots.every(snapshot =>
      this.hasCompatibleMetricDefs(firstSnapshot.analysisResult, snapshot.analysisResult)
      && this.hasCompatibleGroupDefs(firstSnapshot.analysisResult, snapshot.analysisResult)
      && this.normalizeText(snapshot.analysisResult?.groupDefs?.[0]?.key) === mergeKey
      && this.hasRowsCompatibleWithMergeKey(snapshot.analysisResult, mergeKey)
    )
  }

  private resolveMergeGroupLimitation(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ): AiCrossAppAlignmentLimitationReason | undefined {
    return this.hasCompatibleMergeAlignment(snapshots)
      ? undefined
      : 'field_mismatch'
  }

  private hasCompatibleMetricDefs(
    left?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
    right?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
  ) {
    const leftMetrics = Array.isArray(left?.metricDefs) ? left.metricDefs : []
    const rightMetrics = Array.isArray(right?.metricDefs) ? right.metricDefs : []
    if (!leftMetrics.length || leftMetrics.length !== rightMetrics.length) {
      return false
    }

    return leftMetrics.every((item, index) => {
      const rightMetric = rightMetrics[index]
      return this.normalizeText(item?.key) === this.normalizeText(rightMetric?.key)
        && this.normalizeText(item?.op) === this.normalizeText(rightMetric?.op)
        && this.normalizeText(item?.displayMeta?.unit) === this.normalizeText(rightMetric?.displayMeta?.unit)
        && this.normalizeText(item?.displayMeta?.unitPosition) === this.normalizeText(rightMetric?.displayMeta?.unitPosition)
        && Boolean(item?.displayMeta?.isPercent) === Boolean(rightMetric?.displayMeta?.isPercent)
    })
  }

  private hasCompatibleGroupDefs(
    left?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
    right?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
  ) {
    const leftGroups = Array.isArray(left?.groupDefs) ? left.groupDefs : []
    const rightGroups = Array.isArray(right?.groupDefs) ? right.groupDefs : []
    if (!leftGroups.length || leftGroups.length !== rightGroups.length) {
      return false
    }

    return leftGroups.every((item, index) => {
      const rightGroup = rightGroups[index]
      return this.normalizeText(item?.key) === this.normalizeText(rightGroup?.key)
        && this.normalizeText(item?.timeGranularity) === this.normalizeText(rightGroup?.timeGranularity)
    })
  }

  private isGranularityComparableGroupAlignment(
    left?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
    right?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
  ) {
    const leftGroups = Array.isArray(left?.groupDefs) ? left.groupDefs : []
    const rightGroups = Array.isArray(right?.groupDefs) ? right.groupDefs : []
    if (!leftGroups.length || !rightGroups.length) {
      return false
    }

    const leftKeys = leftGroups
      .map(item => this.normalizeText(item?.key))
      .filter(Boolean)
    const rightKeys = rightGroups
      .map(item => this.normalizeText(item?.key))
      .filter(Boolean)
    if (!leftKeys.length || !rightKeys.length) {
      return false
    }

    if (leftKeys[0] && leftKeys[0] === rightKeys[0]) {
      return true
    }

    return leftKeys.some(key => rightKeys.includes(key))
  }

  private hasRowsCompatibleWithMergeKey(
    result?: AiReadAppDataAnalysisResult | AiThreadRecordAnalysisSnapshot['analysisResult'],
    mergeKey?: string,
  ) {
    const normalizedMergeKey = this.normalizeText(mergeKey)
    const rows = Array.isArray(result?.rows) ? result.rows : []
    if (!normalizedMergeKey) {
      return false
    }

    if (!rows.length) {
      return true
    }

    return rows.every(row => {
      const rawValue = this.normalizeText(row?.dimensions?.[normalizedMergeKey])
      const displayValue = this.normalizeText(row?.display?.dimensions?.[normalizedMergeKey])
      return Boolean(rawValue || displayValue)
    })
  }

  private buildSlice(snapshot: AiThreadRecordAnalysisSnapshot): AiThreadCrossAppAnalysisSlice {
    return {
      appId: snapshot.appId,
      appName: snapshot.appName,
      targetId: snapshot.targetId,
      targetName: snapshot.targetName,
      targetType: snapshot.targetType,
      requestSignature: snapshot.requestSignature,
      requestSummary: snapshot.requestSummary,
      analysisResult: snapshot.analysisResult,
    }
  }

  private collapseAlignedSnapshotsByApp(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const groupedSnapshots = new Map<string, AiThreadRecordAnalysisSnapshot[]>()

    snapshots.forEach(snapshot => {
      const appId = this.normalizeText(snapshot?.appId)
      if (!appId) {
        return
      }

      const existingSnapshots = groupedSnapshots.get(appId) || []
      existingSnapshots.push(snapshot)
      groupedSnapshots.set(appId, existingSnapshots)
    })

    return [...groupedSnapshots.values()]
      .map(group => this.mergeSnapshotGroup(group))
      .filter((item): item is AiThreadRecordAnalysisSnapshot => Boolean(item))
  }

  private mergeSnapshotGroup(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const normalizedSnapshots = (Array.isArray(snapshots) ? snapshots : [])
      .map(snapshot => normalizeRecordAnalysisSnapshot(snapshot))
      .filter((item): item is AiThreadRecordAnalysisSnapshot => Boolean(item))
    if (!normalizedSnapshots.length) {
      return undefined
    }

    if (normalizedSnapshots.length === 1) {
      return normalizedSnapshots[0]
    }

    const firstSnapshot = normalizedSnapshots[0]
    return {
      ...firstSnapshot,
      analysisResult: this.mergeAnalysisResults(normalizedSnapshots),
    }
  }

  private mergeAnalysisResults(
    snapshots: AiThreadRecordAnalysisSnapshot[],
  ) {
    const firstResult = snapshots[0]?.analysisResult
    const metricDefs = Array.isArray(firstResult?.metricDefs)
      ? firstResult.metricDefs.map(item => ({
          key: item?.key,
          op: item?.op,
          field: item?.field,
          displayMeta: item?.displayMeta,
        }))
      : []
    const groupDefs = Array.isArray(firstResult?.groupDefs)
      ? firstResult.groupDefs.map(item => ({
          key: item?.key,
          field: item?.field,
          timeGranularity: item?.timeGranularity,
          displayMeta: item?.displayMeta,
        }))
      : []
    const groupKeys = groupDefs
      .map(item => this.normalizeText(item?.key))
      .filter(Boolean)
    const metricKeys = metricDefs
      .map(item => this.normalizeText(item?.key))
      .filter(Boolean)
    const mergedRows = new Map<string, {
      dimensions: Record<string, string>
      displayDimensions: Record<string, string>
      metrics: Record<string, number | null>
    }>()

    snapshots.forEach(snapshot => {
      const rows = Array.isArray(snapshot?.analysisResult?.rows)
        ? snapshot.analysisResult.rows
        : []
      rows.forEach(row => {
        const normalizedDimensions = Object.fromEntries(
          groupKeys
            .map(key => {
              const rawValue = this.normalizeText(row?.dimensions?.[key])
              const displayValue = this.normalizeText(row?.display?.dimensions?.[key]) || rawValue
              const resolvedValue = rawValue || displayValue
              return resolvedValue
                ? [key, resolvedValue]
                : null
            })
            .filter((item): item is [string, string] => Boolean(item)),
        )
        const displayDimensions = Object.fromEntries(
          groupKeys
            .map(key => {
              const normalizedValue = normalizedDimensions[key]
              const displayValue = this.normalizeText(row?.display?.dimensions?.[key]) || normalizedValue
              return displayValue
                ? [key, displayValue]
                : null
            })
            .filter((item): item is [string, string] => Boolean(item)),
        )
        const identity = groupKeys
          .map(key => this.normalizeText(normalizedDimensions[key] || displayDimensions[key]))
          .join('\u0001')
        if (!identity) {
          return
        }

        const existingRow = mergedRows.get(identity) || {
          dimensions: normalizedDimensions,
          displayDimensions,
          metrics: Object.fromEntries(metricKeys.map(key => [key, null])),
        }

        metricKeys.forEach(key => {
          const rawValue = row?.metrics?.[key]
          const numericValue = Number(rawValue)
          if (!Number.isFinite(numericValue)) {
            return
          }

          const previousValue = Number(existingRow.metrics[key] ?? 0)
          existingRow.metrics[key] = previousValue + numericValue
        })

        mergedRows.set(identity, existingRow)
      })
    })

    const rows = [...mergedRows.values()].map(item => ({
      dimensions: item.dimensions,
      metrics: Object.fromEntries(metricKeys.map(key => [key, item.metrics[key] ?? null])),
      display: {
        dimensions: item.displayDimensions,
        metrics: Object.fromEntries(metricDefs.map(metricDef => {
          const metricKey = this.normalizeText(metricDef?.key)
          return [
            metricKey,
            formatAiNumericValue(item.metrics[metricKey] ?? null, metricDef?.displayMeta),
          ]
        })),
      },
    }))

    const totals = Object.fromEntries(metricDefs.map(metricDef => {
      const metricKey = this.normalizeText(metricDef?.key)
      const total = rows.reduce((sum, row) => {
        const value = Number(row?.metrics?.[metricKey])
        return Number.isFinite(value) ? sum + value : sum
      }, 0)
      return [metricKey, total]
    }))

    const totalsDisplay = Object.fromEntries(metricDefs.map(metricDef => {
      const metricKey = this.normalizeText(metricDef?.key)
      return [
        metricKey,
        formatAiNumericValue(
          Number.isFinite(Number(totals[metricKey])) ? Number(totals[metricKey]) : null,
          metricDef?.displayMeta,
        ),
      ]
    }))

    return {
      metricDefs,
      groupDefs,
      rows,
      totals,
      totalsDisplay,
      meta: {
        sourceCount: this.sumMetaCount(snapshots, 'sourceCount') || snapshots.length,
        matchedCount: this.sumMetaCount(snapshots, 'matchedCount'),
        groupCount: rows.length,
        rowCount: rows.length,
        topNApplied: snapshots.some(snapshot => snapshot?.analysisResult?.meta?.topNApplied === true),
        truncated: snapshots.some(snapshot => snapshot?.analysisResult?.meta?.truncated === true),
        mergeStrategy: 'single' as const,
      },
    }
  }

  private collectDistinctAppIds(snapshots: AiThreadRecordAnalysisSnapshot[]) {
    return [...new Set(
      snapshots
        .map(snapshot => this.normalizeText(snapshot.appId))
        .filter(Boolean),
    )].sort()
  }

  private collectMetricKeys(result?: AiThreadRecordAnalysisSnapshot['analysisResult']) {
    return (Array.isArray(result?.metricDefs) ? result.metricDefs : [])
      .map(item => this.normalizeText(item?.key))
      .filter(Boolean)
  }

  private collectGroupKeys(result?: AiThreadRecordAnalysisSnapshot['analysisResult']) {
    return (Array.isArray(result?.groupDefs) ? result.groupDefs : [])
      .map(item => this.normalizeText(item?.key))
      .filter(Boolean)
  }

  private resolvePrimaryTimeGranularity(
    result?: AiThreadRecordAnalysisSnapshot['analysisResult'],
  ): AiReadAppDataTimeGranularity | undefined {
    const normalized = this.normalizeText(result?.groupDefs?.[0]?.timeGranularity).toLowerCase()
    return ['minute', 'hour', 'day', 'week', 'month', 'year'].includes(normalized)
      ? normalized as AiReadAppDataTimeGranularity
      : undefined
  }

  private sumMetaCount(
    snapshots: AiThreadRecordAnalysisSnapshot[],
    key: 'sourceCount' | 'matchedCount',
  ) {
    return snapshots.reduce((sum, snapshot) => {
      const value = Number(snapshot?.analysisResult?.meta?.[key] || 0)
      return Number.isFinite(value) ? sum + value : sum
    }, 0)
  }

  private normalizeConversationProfile(value: unknown): AiThreadRuntimeState['currentProfile'] {
    const normalized = this.normalizeText(value)
    return ['records_query', 'cross_app_compare', 'cross_app_merge', 'cross_app_unresolved'].includes(normalized)
      ? normalized as AiThreadRuntimeState['currentProfile']
      : undefined
  }

  private normalizeText(value?: unknown) {
    return String(value || '').trim()
  }
}
