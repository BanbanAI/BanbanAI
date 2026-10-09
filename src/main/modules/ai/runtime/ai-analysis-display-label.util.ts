import type { AiNumericDisplayMeta } from '../ai.types'
import { describeAiFieldDisplay } from '../utils/ai-numeric-display'

const ANALYSIS_LABEL_MAP: Record<string, string> = {
  get app() { return global.i18next.t('aiAnalysisDisplayLabel.app') },
  get application() { return global.i18next.t('aiAnalysisDisplayLabel.app') },
  get department() { return global.i18next.t('aiAnalysisDisplayLabel.department') },
  get status() { return global.i18next.t('aiAnalysisDisplayLabel.status') },
  get category() { return global.i18next.t('aiAnalysisDisplayLabel.category') },
  get type() { return global.i18next.t('aiAnalysisDisplayLabel.type') },
  get channel() { return global.i18next.t('aiAnalysisDisplayLabel.channel') },
  get customer() { return global.i18next.t('aiAnalysisDisplayLabel.customer') },
  get sales() { return global.i18next.t('aiAnalysisDisplayLabel.sales') },
  get 'sales amount'() { return global.i18next.t('aiAnalysisDisplayLabel.sales') },
  get sales_amount() { return global.i18next.t('aiAnalysisDisplayLabel.sales') },
  get total_sales() { return global.i18next.t('aiAnalysisDisplayLabel.sales') },
  get sales_total() { return global.i18next.t('aiAnalysisDisplayLabel.sales') },
  get order() { return global.i18next.t('aiAnalysisDisplayLabel.order') },
  get orders() { return global.i18next.t('aiAnalysisDisplayLabel.orderCount') },
  get order_count() { return global.i18next.t('aiAnalysisDisplayLabel.orderCount') },
  get count() { return global.i18next.t('aiAnalysisDisplayLabel.count') },
  get amount() { return global.i18next.t('aiAnalysisDisplayLabel.amount') },
  get month() { return global.i18next.t('aiAnalysisDisplayLabel.month') },
  get week() { return global.i18next.t('aiAnalysisDisplayLabel.week') },
  get quarter() { return global.i18next.t('aiAnalysisDisplayLabel.quarter') },
  get year() { return global.i18next.t('aiAnalysisDisplayLabel.year') },
  get day() { return global.i18next.t('aiAnalysisDisplayLabel.date') },
  get date() { return global.i18next.t('aiAnalysisDisplayLabel.date') },
  get time() { return global.i18next.t('aiAnalysisDisplayLabel.time') },
  get created_at() { return global.i18next.t('aiAnalysisDisplayLabel.createdAt') },
  get updated_at() { return global.i18next.t('aiAnalysisDisplayLabel.updatedAt') },
  get avg_order_value() { return global.i18next.t('aiAnalysisDisplayLabel.averageOrderValue') },
  get repurchase_rate() { return global.i18next.t('aiAnalysisDisplayLabel.repurchaseRate') },
}

const ANALYSIS_LABEL_TOKEN_MAP: Record<string, string> = {
  get app() { return global.i18next.t('aiAnalysisDisplayLabel.app') },
  get application() { return global.i18next.t('aiAnalysisDisplayLabel.app') },
  get department() { return global.i18next.t('aiAnalysisDisplayLabel.department') },
  get status() { return global.i18next.t('aiAnalysisDisplayLabel.status') },
  get category() { return global.i18next.t('aiAnalysisDisplayLabel.category') },
  get type() { return global.i18next.t('aiAnalysisDisplayLabel.type') },
  get channel() { return global.i18next.t('aiAnalysisDisplayLabel.channel') },
  get customer() { return global.i18next.t('aiAnalysisDisplayLabel.customer') },
  get sales() { return global.i18next.t('aiAnalysisDisplayLabel.sales') },
  get order() { return global.i18next.t('aiAnalysisDisplayLabel.order') },
  get orders() { return global.i18next.t('aiAnalysisDisplayLabel.orderCount') },
  get count() { return global.i18next.t('aiAnalysisDisplayLabel.count') },
  get amount() { return global.i18next.t('aiAnalysisDisplayLabel.amount') },
  get total() { return global.i18next.t('aiAnalysisDisplayLabel.total') },
  get avg() { return global.i18next.t('aiAnalysisDisplayLabel.average') },
  get average() { return global.i18next.t('aiAnalysisDisplayLabel.average') },
  get value() { return global.i18next.t('aiAnalysisDisplayLabel.value') },
  get rate() { return global.i18next.t('aiAnalysisDisplayLabel.rate') },
  get ratio() { return global.i18next.t('aiAnalysisDisplayLabel.ratio') },
  get percent() { return global.i18next.t('aiAnalysisDisplayLabel.percent') },
  get repurchase() { return global.i18next.t('aiAnalysisDisplayLabel.repurchase') },
  get month() { return global.i18next.t('aiAnalysisDisplayLabel.month') },
  get week() { return global.i18next.t('aiAnalysisDisplayLabel.week') },
  get quarter() { return global.i18next.t('aiAnalysisDisplayLabel.quarter') },
  get year() { return global.i18next.t('aiAnalysisDisplayLabel.year') },
  get day() { return global.i18next.t('aiAnalysisDisplayLabel.date') },
  get date() { return global.i18next.t('aiAnalysisDisplayLabel.date') },
  get time() { return global.i18next.t('aiAnalysisDisplayLabel.time') },
  get created() { return global.i18next.t('aiAnalysisDisplayLabel.created') },
  get updated() { return global.i18next.t('aiAnalysisDisplayLabel.updated') },
  get at() { return global.i18next.t('aiAnalysisDisplayLabel.time') },
}

const ANALYSIS_TIME_GRANULARITY_LABELS: Record<string, string> = {
  get minute() { return global.i18next.t('aiAnalysisDisplayLabel.byMinute') },
  get hour() { return global.i18next.t('aiAnalysisDisplayLabel.byHour') },
  get day() { return global.i18next.t('aiAnalysisDisplayLabel.byDay') },
  get week() { return global.i18next.t('aiAnalysisDisplayLabel.byWeek') },
  get month() { return global.i18next.t('aiAnalysisDisplayLabel.byMonth') },
  get quarter() { return global.i18next.t('aiAnalysisDisplayLabel.byQuarter') },
  get year() { return global.i18next.t('aiAnalysisDisplayLabel.byYear') },
}

function normalizeLowerText(value: string) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function isAsciiIdentifier(value: string) {
  return /^[a-z0-9_/\-\s]+$/.test(value) && value === value.toLowerCase()
}

function isCamelCaseIdentifier(value: string) {
  return /^[a-z][a-zA-Z0-9]*$/.test(value) && /[A-Z]/.test(value)
}

function toLookupText(value: string) {
  if (isCamelCaseIdentifier(value)) {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  }

  return normalizeLowerText(value)
}

function humanizeIdentifier(value: string): string {
  const normalized = toLookupText(value)
  if (!normalized) {
    return ''
  }

  const exactLabel = ANALYSIS_LABEL_MAP[normalized]
  if (exactLabel) {
    return exactLabel
  }

  if (normalized.includes('/')) {
    return normalized
      .split(/\s*\/\s*/)
      .map(segment => humanizeIdentifier(segment))
      .join(' / ')
  }

  const tokens = normalized.split(/[_\-\s]+/).filter(Boolean)
  if (!tokens.length) {
    return String(value || '').trim()
  }

  const translatedTokens = tokens.map(token => ANALYSIS_LABEL_TOKEN_MAP[token] || token)
  const joined = translatedTokens.join('')
  return joined || String(value || '').trim()
}

export function humanizeAnalysisLabel(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  if (!isAsciiIdentifier(normalized) && !isCamelCaseIdentifier(normalized)) {
    return normalized
  }

  return humanizeIdentifier(normalized)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripMetricUnitSuffix(label: string, displayMeta?: AiNumericDisplayMeta) {
  const normalizedLabel = String(label || '').trim()
  const unit = String(displayMeta?.unit || '').trim()
  if (!normalizedLabel || !unit) {
    return normalizedLabel
  }

  const strippedLabel = normalizedLabel
    .replace(new RegExp(`(?:[_\\-/\\s]+|[（(])${escapeRegExp(unit)}(?:[）)])?$`), '')
    .trim()

  return strippedLabel || normalizedLabel
}

export function formatAnalysisGroupLabel(definition?: {
  key?: string
  field?: string
  timeGranularity?: string | null
}) {
  const rawKey = String(definition?.key || '').trim()
  const rawField = String(definition?.field || '').trim()
  const baseSource = rawKey.includes('/') ? rawKey : (rawField || rawKey)
  const baseLabel = humanizeAnalysisLabel(baseSource)
  const granularity = ANALYSIS_TIME_GRANULARITY_LABELS[normalizeLowerText(String(definition?.timeGranularity || ''))]

  return baseLabel && granularity
    ? global.i18next.t('aiAnalysisDisplayLabel.granularityLabel', { granularity, label: baseLabel })
    : baseLabel
}

export function resolveAnalysisMetricBaseLabel(definition?: {
  key?: string
  field?: string
  displayMeta?: AiNumericDisplayMeta
}) {
  const rawKey = String(definition?.key || '').trim()
  const rawField = String(definition?.field || '').trim()
  const keyLabel = rawKey ? humanizeAnalysisLabel(rawKey) : ''
  const fieldLabel = rawField ? humanizeAnalysisLabel(rawField) : ''
  const shouldPreferKeyLabel = Boolean(
    rawKey
    && (/[\u4e00-\u9fff]/.test(rawKey) || keyLabel !== rawKey),
  )
  const baseLabel = (
    (shouldPreferKeyLabel ? keyLabel : '')
    || (fieldLabel && fieldLabel !== rawField ? fieldLabel : '')
    || keyLabel
    || fieldLabel
    || rawField
    || rawKey
  )

  return stripMetricUnitSuffix(baseLabel, definition?.displayMeta)
}

export function formatAnalysisMetricLabel(definition?: {
  key?: string
  field?: string
  displayMeta?: AiNumericDisplayMeta
}) {
  return describeAiFieldDisplay(
    resolveAnalysisMetricBaseLabel(definition),
    definition?.displayMeta,
  )
}

export function isCrossAppAnalysisGroupKey(value: string) {
  const normalized = normalizeLowerText(value)
  return normalized.startsWith('app / ') || normalized.startsWith('应用 / ')
}
