import type { AiAssistantSupportingData } from '@common/types/ai'
import type { AiReadAppDataAnalysisResult } from '../ai.types'
import {
  resolveAnalysisBusinessObjectLabel,
  resolveAnalysisGroupSemantic,
} from './ai-analysis-business-label.util'

const toSupportingCount = (value: unknown) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return ''
  }
  return String(numericValue)
}

export const buildAiAnalysisSupportingData = (options: {
  analysisResult?: AiReadAppDataAnalysisResult | null
  snapshot?: { targetName?: string | null } | null
  snapshots?: Array<{ targetName?: string | null } | null | undefined> | null
}): AiAssistantSupportingData | undefined => {
  const kpis: AiAssistantSupportingData['kpis'] = []

  const matchedCount = toSupportingCount(options.analysisResult?.meta?.matchedCount)
  const businessObjectLabel = resolveAnalysisBusinessObjectLabel({
    sourceCount: Number(options.analysisResult?.meta?.sourceCount || 0),
    snapshot: options.snapshot,
    snapshots: options.snapshots,
  })
  if (matchedCount) {
    kpis.push({
      key: 'matchedRecords',
      value: matchedCount,
      semanticType: 'record_count',
      ...(businessObjectLabel ? { businessObjectLabel } : {}),
    })
  }

  const groupCount = toSupportingCount(options.analysisResult?.meta?.groupCount)
  const groupSemantic = resolveAnalysisGroupSemantic(options.analysisResult?.groupDefs || [])
  if (groupCount) {
    kpis.push({
      key: 'groupCount',
      value: groupCount,
      ...(groupSemantic || {}),
    })
  }

  return kpis.length ? { kpis } : undefined
}
