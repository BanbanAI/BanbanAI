export type BuildPermissionSafeDerivedSummaryInput = {
  relationOverview?: string[]
  sourceRoleHints?: string[]
  sourceCount?: number
}

const MAX_SUMMARY_LENGTH = 220
const MAX_RELATION_FACTS = 2
const MAX_ROLE_HINTS = 2

function uniqueTexts(values: readonly string[] | undefined) {
  return Array.from(new Set(
    (values || [])
      .map(item => item.trim())
      .filter(Boolean),
  ))
}

function limitTexts(values: readonly string[] | undefined, limit: number) {
  return uniqueTexts(values).slice(0, Math.max(0, limit))
}

function normalizeSourceCount(value?: number) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return 0
  }

  return Math.floor(value)
}

function truncateSummary(value: string, maxLength = MAX_SUMMARY_LENGTH) {
  const normalized = value.trim()
  if (!normalized || maxLength <= 0 || normalized.length <= maxLength) {
    return normalized
  }

  const ellipsis = '...'
  if (maxLength <= ellipsis.length) {
    return ellipsis.slice(0, maxLength)
  }

  return `${normalized.slice(0, Math.max(0, maxLength - ellipsis.length)).trimEnd()}${ellipsis}`
}

// Non-goals:
// 1. 不读取 sourceName 原始文本之外的未过滤事实。
// 2. 不输出“先读哪个 source”之类的 guidance。
// 3. 不推断新的业务域或新的高层业务语义。
// 4. 不依赖权限配置；调用方必须传入已过滤的 relation/source facts。
export function buildPermissionSafeDerivedSummary(
  input: BuildPermissionSafeDerivedSummaryInput,
): string {
  const relationOverview = limitTexts(input?.relationOverview, MAX_RELATION_FACTS)
  const sourceRoleHints = limitTexts(input?.sourceRoleHints, MAX_ROLE_HINTS)

  if (!relationOverview.length && !sourceRoleHints.length) {
    return ''
  }

  const parts: string[] = []
  if (sourceRoleHints.length) {
    parts.push(`当前可见数据主要涉及：${sourceRoleHints.join('；')}。`)
  }

  if (relationOverview.length) {
    const sourceCount = normalizeSourceCount(input?.sourceCount)
    const relationPrefix = sourceRoleHints.length
      ? '稳定关系包括：'
      : sourceCount > 0
        ? `当前可见 ${sourceCount} 个数据源的稳定关系包括：`
        : '当前可见数据的稳定关系包括：'

    parts.push(`${relationPrefix}${relationOverview.join('；')}。`)
  }

  return truncateSummary(parts.join(''))
}
