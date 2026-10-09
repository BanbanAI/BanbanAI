import { isCrossAppAnalysisGroupKey } from './ai-analysis-display-label.util'

const ANALYSIS_CHART_PALETTE = ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E8684A'] as const

const SEMANTIC_COLOR_MAP: Record<string, string> = {
  已完成: '#5AD8A6',
  已折旧: '#F6BD16',
  已报废: '#E8684A',
  正常: '#5B8FF9',
}

const BAR_BORDER_RADIUS = 8
const SCATTER_ITEM_COLOR = ANALYSIS_CHART_PALETTE[0]

type BuildCategoricalItemColorsOptions = {
  groupKey?: string
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function getAnalysisChartPalette() {
  return [...ANALYSIS_CHART_PALETTE]
}

function getStablePaletteColor(label: string) {
  return ANALYSIS_CHART_PALETTE[getStablePaletteIndex(label)]
}

function getStablePaletteIndex(label: string) {
  let hash = 0
  for (let index = 0; index < label.length; index += 1) {
    hash = ((hash << 5) - hash + label.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % ANALYSIS_CHART_PALETTE.length
}

function resolveCategoricalColorSubject(label: string, options?: BuildCategoricalItemColorsOptions) {
  const normalizedLabel = String(label || '').trim()
  const normalizedGroupKey = String(options?.groupKey || '').trim()
  if (!normalizedLabel) {
    return ''
  }

  if (!isCrossAppAnalysisGroupKey(normalizedGroupKey)) {
    return normalizedLabel
  }

  const [appLabel] = normalizedLabel.split(' / ')
  return String(appLabel || normalizedLabel).trim()
}

function resolveAvailablePaletteIndex(preferredIndex: number, reservedIndexes: Set<number>) {
  if (reservedIndexes.size >= ANALYSIS_CHART_PALETTE.length) {
    return preferredIndex
  }

  for (let offset = 0; offset < ANALYSIS_CHART_PALETTE.length; offset += 1) {
    const candidateIndex = (preferredIndex + offset) % ANALYSIS_CHART_PALETTE.length
    if (!reservedIndexes.has(candidateIndex)) {
      return candidateIndex
    }
  }

  return preferredIndex
}

export function getSemanticColor(label: string | undefined) {
  const normalizedLabel = String(label || '').trim()
  if (!normalizedLabel) {
    return ANALYSIS_CHART_PALETTE[0]
  }
  return SEMANTIC_COLOR_MAP[normalizedLabel] || getStablePaletteColor(normalizedLabel)
}

export function getBarItemStyle(horizontal: boolean) {
  return {
    borderRadius: horizontal
      ? [0, BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0]
      : [BAR_BORDER_RADIUS, BAR_BORDER_RADIUS, 0, 0],
  }
}

export function getLineSeriesStyle(color: string = ANALYSIS_CHART_PALETTE[0]) {
  return {
    color,
    lineStyle: { color, width: 3 },
    itemStyle: { color },
    areaStyle: { color: hexToRgba(color, 0.16) },
  }
}

export function getScatterSeriesStyle(color: string = SCATTER_ITEM_COLOR) {
  return {
    color,
    itemStyle: { color },
  }
}

export function getCategoricalItemColors(
  labels: string[],
  options?: BuildCategoricalItemColorsOptions,
) {
  const reservedIndexes = new Set<number>()
  const assignedColors = new Map<string, string>()
  const subjects = labels.map((label, index) => {
    const subject = resolveCategoricalColorSubject(label, options)
    return subject || `__blank__${index}`
  })
  const uniqueSubjects = [...new Set(subjects.filter(Boolean))].sort((left, right) => left.localeCompare(right))

  uniqueSubjects.forEach(subject => {
    const semanticColor = SEMANTIC_COLOR_MAP[subject]
    if (semanticColor) {
      assignedColors.set(subject, semanticColor)
      const semanticPaletteIndex = (ANALYSIS_CHART_PALETTE as readonly string[]).indexOf(semanticColor)
      if (semanticPaletteIndex >= 0) {
        reservedIndexes.add(semanticPaletteIndex)
      }
      return
    }

    const preferredIndex = getStablePaletteIndex(subject)
    const paletteIndex = resolveAvailablePaletteIndex(preferredIndex, reservedIndexes)
    reservedIndexes.add(paletteIndex)
    assignedColors.set(subject, ANALYSIS_CHART_PALETTE[paletteIndex])
  })

  return labels.map((label, index) => {
    const subject = resolveCategoricalColorSubject(label, options) || `__blank__${index}`
    return assignedColors.get(subject) || getSemanticColor(String(label || '').trim() || subject)
  })
}
