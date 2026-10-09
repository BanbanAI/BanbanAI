import type { AiReadAppDataAnalysisResult } from '../ai.types'
import { formatAnalysisGroupLabel } from './ai-analysis-display-label.util'

type AnalysisTargetSnapshotLike = {
  targetName?: string | null
}

const BUSINESS_OBJECT_SUFFIXES = [
  '数据源',
  '数据表',
  '记录表',
  '明细表',
  '台账表',
  '档案表',
  '目录表',
  '表单',
  '表格',
  '列表',
  '记录',
  '明细',
  '台账',
  '档案',
  '目录',
]
const BUSINESS_OBJECT_SUFFIX_PATTERN = new RegExp(`(${BUSINESS_OBJECT_SUFFIXES.join('|')})$`, 'u')
const GENERIC_BUSINESS_OBJECT_LABELS = new Set(['目录', '文档', '系统', '我的数据'])
const TIME_BUCKET_OBJECT_LABELS = {
  minute: '分钟',
  hour: '小时',
  day: '天',
  week: '周',
  month: '月份',
  year: '年份',
} as const

export const normalizeAnalysisBusinessObjectLabel = (value?: string | null) => {
  const normalized = String(value || '').trim().replace(BUSINESS_OBJECT_SUFFIX_PATTERN, '').trim()
  if (!normalized || GENERIC_BUSINESS_OBJECT_LABELS.has(normalized)) {
    return ''
  }

  return normalized.length >= 2 ? normalized : ''
}

export const resolveAnalysisBusinessObjectLabel = (options: {
  sourceCount?: number | null
  snapshot?: AnalysisTargetSnapshotLike | null
  snapshots?: Array<AnalysisTargetSnapshotLike | null | undefined> | null
}) => {
  const candidateSnapshots = Array.isArray(options.snapshots) && options.snapshots.length
    ? options.snapshots
    : [options.snapshot]
  const normalizedSnapshotLabels = candidateSnapshots
    .map(item => normalizeAnalysisBusinessObjectLabel(item?.targetName))
  const normalizedLabels = [...new Set(normalizedSnapshotLabels.filter(Boolean))]

  if (candidateSnapshots.length > 1) {
    return normalizedLabels.length === 1 && normalizedSnapshotLabels.every(Boolean)
      ? normalizedLabels[0]
      : ''
  }

  if (normalizedLabels.length === 1) {
    return normalizedLabels[0]
  }

  return Number(options.sourceCount || 0) <= 1
    ? normalizeAnalysisBusinessObjectLabel(options.snapshot?.targetName)
    : ''
}

export const resolveAnalysisGroupSemantic = (
  groupDefs: AiReadAppDataAnalysisResult['groupDefs'] = [],
) => {
  const normalizedDefs = groupDefs.map(item => ({
    label: formatAnalysisGroupLabel(item),
    timeGranularity: String(item?.timeGranularity || '').trim().toLowerCase(),
  }))
  if (!normalizedDefs.length) {
    return null
  }

  if (
    normalizedDefs.length === 1
    && normalizedDefs[0].timeGranularity in TIME_BUCKET_OBJECT_LABELS
  ) {
    return {
      semanticType: 'time_bucket_count' as const,
      timeGranularity: normalizedDefs[0].timeGranularity as keyof typeof TIME_BUCKET_OBJECT_LABELS,
    }
  }

  if (normalizedDefs.length === 1 && normalizedDefs[0].label) {
    return {
      semanticType: 'dimension_value_count' as const,
      dimensionLabel: normalizedDefs[0].label,
    }
  }

  const combinationLabels = normalizedDefs.map(item => item.label).filter(Boolean)
  if (normalizedDefs.length > 1 && combinationLabels.length === normalizedDefs.length) {
    return {
      semanticType: 'group_combination_count' as const,
      combinationLabels,
    }
  }

  return null
}
