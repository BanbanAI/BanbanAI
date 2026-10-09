import i18next from 'i18next'

export const getNocodeEditorAppBuilderPlanningStreamPlaceholder = () => (
  i18next.t('nocodeEditorAppBuilderPlanningStreamGuard.planningPlaceholder')
)

const APP_BUILDER_PLANNING_FENCE_START = '```banban-app-builder-plan'
const FENCE_MARKER = '```'
const getAppBuilderPlanningGenericNarration = () => (
  i18next.t('nocodeEditorAppBuilderPlanningStreamGuard.genericNarration')
)

const APP_BUILDER_PLANNING_HEADINGS = [
  '目标说明',
  '当前规划说明',
  '核心对象',
  '规划清单',
  '本轮范围',
  '待确认项',
  '下一步你可以这样做',
  'AI 会怎么处理',
]

const APP_BUILDER_PLANNING_INTERNAL_TOKENS = [
  'executable_now',
  'planning_only',
  'need_confirm',
  'banban-app-builder-plan',
]

const APP_BUILDER_PLANNING_EARLY_HINTS = [
  '应用搭建规划',
  '应用规划',
  '整体规划',
  '确认卡片',
  '立即执行',
  '后续建议',
  '继续生成',
  '核心模块',
  '表单结构',
  '待确认项',
]

const normalizePlanningStreamText = (value: string) => (
  String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\*\*([^*\n]{2,30})\*\*/g, '$1')
    .trim()
)

const normalizePlanningHeadingText = (value: string) => (
  String(value || '')
    .replace(/\*\*([^*\n]{1,60})\*\*/g, '$1')
    .replace(/^#{1,6}\s*/, '')
    .trim()
)

const countPlanningHeadingHits = (text: string) => (
  APP_BUILDER_PLANNING_HEADINGS.filter(heading => text.includes(heading)).length
)

const hasPlanningTable = (text: string) => (
  /\|\s*类型\s*\|\s*名称\s*\|\s*执行级别\s*\|/.test(text)
  || /\|\s*[^|\n]+\s*\|\s*[^|\n]+\s*\|\s*(?:executable_now|planning_only|need_confirm)\s*\|/.test(text)
)

const hasInternalPlanningToken = (text: string) => (
  APP_BUILDER_PLANNING_INTERNAL_TOKENS.some(token => text.includes(token))
)

const hasPlanningFenceLead = (text: string) => {
  let searchIndex = 0

  while (searchIndex < text.length) {
    const fenceMarkerIndex = text.indexOf(FENCE_MARKER, searchIndex)
    if (fenceMarkerIndex === -1) {
      return false
    }

    const candidate = text.slice(
      fenceMarkerIndex,
      Math.min(text.length, fenceMarkerIndex + APP_BUILDER_PLANNING_FENCE_START.length),
    )
    if (
      candidate.length > FENCE_MARKER.length
      && APP_BUILDER_PLANNING_FENCE_START.startsWith(candidate)
    ) {
      return true
    }

    searchIndex = fenceMarkerIndex + FENCE_MARKER.length
  }

  return false
}

const isPlanningStructureLine = (line: string) => (
  /^#{1,6}\s/.test(line)
  || /^\|.*\|$/.test(line)
  || /^[-*+]\s+/.test(line)
  || /^```/.test(line)
)

const hasNegatedEarlyPlanningHint = (text: string) => (
  /(?:不涉及|不是|不要|无需|无须)[\s\S]{0,16}(?:应用搭建规划|应用规划|确认卡片)/.test(text)
  || /普通(?:教程|说明|文档|回答|示例|内容)/.test(text)
  || /不包含[\s\S]{0,16}(?:执行级别|内部协议)/.test(text)
)

const hasEarlyPlanningHint = (text: string) => {
  if (hasNegatedEarlyPlanningHint(text)) {
    return false
  }

  return APP_BUILDER_PLANNING_EARLY_HINTS.some(hint => text.includes(hint))
    && (
      /(?:整理|生成|创建|搭建|转换)[\s\S]{0,24}(?:应用搭建规划|应用规划|确认卡片)/.test(text)
      || /(?:应用搭建规划|应用规划)[\s\S]{0,48}(?:立即执行|后续建议|确认卡片)/.test(text)
      || /(?:立即执行)[\s\S]{0,32}(?:后续建议|确认卡片)/.test(text)
    )
}

const hasEarlyPlanningNarration = (text: string) => {
  if (hasNegatedEarlyPlanningHint(text)) {
    return false
  }

  return /(?:我先|先帮你|为你|下面)[\s\S]{0,24}(?:整理|生成|创建|搭建)[\s\S]{0,48}(?:整体规划|应用规划|应用搭建规划)/.test(text)
    && /(?:核心模块|表单结构|待确认项|确认后|规划清单)/.test(text)
}

export const extractNocodeEditorAppBuilderPlanningNarrationLead = (value: string) => {
  const text = normalizePlanningStreamText(value)
  if (!text) {
    return ''
  }

  const lines = text.split('\n')
  const leadLines: string[] = []
  let hasLead = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (hasLead) {
        break
      }
      continue
    }

    const normalizedHeading = normalizePlanningHeadingText(line)
    if (
      isPlanningStructureLine(line)
      || APP_BUILDER_PLANNING_HEADINGS.includes(normalizedHeading)
    ) {
      if (hasLead) {
        break
      }
      continue
    }

    if (!hasLead && hasInternalPlanningToken(line)) {
      continue
    }

    hasLead = true
    leadLines.push(line)

    if (leadLines.join('\n').length > 160) {
      break
    }
  }

  const leadText = leadLines.join('\n').trim()
  if (leadText) {
    return leadText
  }

  return (
    hasPlanningFenceLead(text)
    || hasPlanningTable(text)
    || countPlanningHeadingHits(text) > 0
    || hasInternalPlanningToken(text)
  )
    ? getAppBuilderPlanningGenericNarration()
    : text
}

export const isLikelyNocodeEditorAppBuilderPlanningStream = (value: string) => {
  const text = normalizePlanningStreamText(value)
  if (!text) {
    return false
  }

  if (hasPlanningFenceLead(text)) {
    return true
  }

  const headingHits = countPlanningHeadingHits(text)
  if (headingHits >= 2 && (hasPlanningTable(text) || hasInternalPlanningToken(text))) {
    return true
  }

  return hasPlanningTable(text) && hasInternalPlanningToken(text)
}

export const isPotentialNocodeEditorAppBuilderPlanningStream = (value: string) => {
  const text = normalizePlanningStreamText(value)
  if (!text) {
    return false
  }

  return (countPlanningHeadingHits(text) >= 1 && hasEarlyPlanningHint(text))
    || hasEarlyPlanningNarration(text)
}

export const resolveNocodeEditorAppBuilderPlanningStreamVisibleContent = (value: string) => (
  isLikelyNocodeEditorAppBuilderPlanningStream(value)
    ? extractNocodeEditorAppBuilderPlanningNarrationLead(value) || getNocodeEditorAppBuilderPlanningStreamPlaceholder()
    : String(value || '')
)

export const __testNocodeEditorAppBuilderPlanningStreamGuard = {
  normalizePlanningStreamText,
  countPlanningHeadingHits,
  hasPlanningTable,
  hasInternalPlanningToken,
  hasPlanningFenceLead,
  hasNegatedEarlyPlanningHint,
  hasEarlyPlanningHint,
  hasEarlyPlanningNarration,
  extractNocodeEditorAppBuilderPlanningNarrationLead,
}
