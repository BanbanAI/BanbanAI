import { AiThreadRecordAnalysisSnapshot } from '../ai.types'
import {
  buildCrossAppAnalysisRequestSignature,
  buildCrossAppAnalysisRequestSummaryFromResolvedReadOutput,
} from './ai-cross-app-analysis-bundle.util'

export function resolveLatestRecordAnalysisSnapshotFromOutputs(
  outputs: any[],
  fallbackSnapshot?: AiThreadRecordAnalysisSnapshot | null,
): AiThreadRecordAnalysisSnapshot | undefined {
  const snapshots = resolveRecordAnalysisSnapshotsFromOutputs(outputs)
  if (snapshots?.length) {
    return snapshots[snapshots.length - 1]
  }

  return normalizeRecordAnalysisSnapshot(fallbackSnapshot)
}

export function resolveRecordAnalysisSnapshotsFromOutputs(
  outputs: any[],
  fallbackSnapshots?: Array<AiThreadRecordAnalysisSnapshot | null | undefined> | null,
): AiThreadRecordAnalysisSnapshot[] | undefined {
  const readOutputs = Array.isArray(outputs)
    ? outputs.filter(output => output?.tool === 'read_app_data')
    : []

  if (!readOutputs.length) {
    return normalizeRecordAnalysisSnapshots(fallbackSnapshots)
  }

  const snapshots = normalizeRecordAnalysisSnapshots(
    readOutputs.map(output => buildRecordAnalysisSnapshotFromReadOutput(output)),
  )
  return snapshots?.length
    ? snapshots
    : normalizeRecordAnalysisSnapshots(fallbackSnapshots)
}

export function buildRecordAnalysisSnapshotFromReadOutput(
  output: any,
): AiThreadRecordAnalysisSnapshot | undefined {
  if (normalizeText(output?.tool).toLowerCase() !== 'read_app_data') {
    return undefined
  }

  const appId = normalizeText(output?.resolved?.appId)
  const target = Array.isArray(output?.resolved?.targets) && output.resolved.targets.length
    ? output.resolved.targets[0]
    : output?.resolved?.target
  const targetId = normalizeText(target?.id)
  const targetType = normalizeTargetType(target?.type)
  const mode = normalizeText(output?.resolved?.mode).toLowerCase()
  const kind = normalizeText(output?.result?.kind).toLowerCase()
  const analysisResult = normalizeRecordAnalysisSnapshotResult(output?.result?.analysisResult)
  const requestSummary = buildCrossAppAnalysisRequestSummaryFromResolvedReadOutput(output)
  const requestSignature = buildCrossAppAnalysisRequestSignature(requestSummary)
  if (!appId || mode !== 'aggregate' || kind !== 'record_analysis' || !analysisResult) {
    return undefined
  }

  return {
    appId,
    appName: normalizeText(output?.resolved?.appName) || undefined,
    targetId: targetId || undefined,
    targetName: normalizeText(target?.name) || undefined,
    targetType: targetType || undefined,
    mode: 'aggregate',
    requestSignature,
    requestSummary,
    analysisResult,
  }
}

export function normalizeRecordAnalysisSnapshot(
  value?: AiThreadRecordAnalysisSnapshot | null,
): AiThreadRecordAnalysisSnapshot | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const appId = normalizeText(value.appId)
  const targetId = normalizeText(value.targetId)
  const targetType = normalizeTargetType(value.targetType)
  const analysisResult = normalizeRecordAnalysisSnapshotResult(value.analysisResult)
  const requestSummary = buildCrossAppAnalysisRequestSummaryFromResolvedReadOutput({
    resolved: {
      mode: value.mode,
      request: value.requestSummary,
    },
  })
  const requestSignature = normalizeText(value.requestSignature)
    || buildCrossAppAnalysisRequestSignature(requestSummary)
    || undefined
  if (!appId || normalizeText(value.mode).toLowerCase() !== 'aggregate' || !analysisResult) {
    return undefined
  }

  return {
    appId,
    appName: normalizeText(value.appName) || undefined,
    targetId: targetId || undefined,
    targetName: normalizeText(value.targetName) || undefined,
    targetType: targetType || undefined,
    mode: 'aggregate',
    requestSignature,
    requestSummary,
    analysisResult,
  }
}

export function normalizeRecordAnalysisSnapshots(
  value?: Array<AiThreadRecordAnalysisSnapshot | null | undefined> | null,
): AiThreadRecordAnalysisSnapshot[] | undefined {
  const items = Array.isArray(value) ? value : []
  const dedupedSnapshots = new Map<string, AiThreadRecordAnalysisSnapshot>()

  for (const item of items) {
    const snapshot = normalizeRecordAnalysisSnapshot(item)
    if (!snapshot) {
      continue
    }
    const key = [
      snapshot.appId,
      snapshot.targetType || '',
      snapshot.targetId || '',
      snapshot.targetName || '',
      snapshot.mode,
    ].join(':')
    if (dedupedSnapshots.has(key)) {
      dedupedSnapshots.delete(key)
    }
    dedupedSnapshots.set(key, snapshot)
  }

  const normalizedSnapshots = Array.from(dedupedSnapshots.values()).slice(-8)
  return normalizedSnapshots.length ? normalizedSnapshots : undefined
}

export function isSameRecordAnalysisSnapshot(
  left?: AiThreadRecordAnalysisSnapshot | null,
  right?: AiThreadRecordAnalysisSnapshot | null,
) {
  if (!left || !right) {
    return false
  }

  return normalizeText(left.appId) === normalizeText(right.appId)
    && normalizeText(left.targetId) === normalizeText(right.targetId)
    && normalizeText(left.targetType) === normalizeText(right.targetType)
    && normalizeText(left.mode) === normalizeText(right.mode)
    && normalizeText(left.requestSignature) === normalizeText(right.requestSignature)
    && JSON.stringify(left.analysisResult || {}) === JSON.stringify(right.analysisResult || {})
}

function normalizeRecordAnalysisSnapshotResult(
  value: any,
): AiThreadRecordAnalysisSnapshot['analysisResult'] | undefined {
  if (!isPlainObject(value)) {
    return undefined
  }

  const metricDefs = Array.isArray(value.metricDefs) ? value.metricDefs : undefined
  const groupDefs = Array.isArray(value.groupDefs) ? value.groupDefs : undefined
  const rows = Array.isArray(value.rows) ? value.rows : undefined
  const totals = (isPlainObject(value.totals) ? value.totals : {}) as Record<string, number>
  const totalsDisplay = (isPlainObject(value.totalsDisplay) ? value.totalsDisplay : {}) as Record<string, string>
  const meta = (isPlainObject(value.meta) ? value.meta : undefined) as AiThreadRecordAnalysisSnapshot['analysisResult']['meta']

  return {
    metricDefs,
    groupDefs,
    rows,
    totals,
    totalsDisplay,
    meta,
  }
}

function normalizeTargetType(value: any) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === 'source' || normalized === 'tree'
    ? normalized as AiThreadRecordAnalysisSnapshot['targetType']
    : null
}

function normalizeText(value?: any) {
  return String(value || '').trim()
}

function isPlainObject(value: any): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
