import type { Field } from '../../../../common/types/project'

import type { AiNumericDisplayMeta } from '../ai.types'

function uniqueNonEmptyTexts(values: string[]) {
  return Array.from(new Set(values.map(item => String(item || '').trim()).filter(Boolean)))
}

function formatNumberForDisplay(value: number, meta: AiNumericDisplayMeta): string {
  const decimalPlaces = meta.decimalPlaces
  if (!Number.isFinite(decimalPlaces)) {
    return String(value)
  }

  const thousandSeparator = meta.thousandSeparator ?? ''
  const decimalSeparator = meta.decimalSeparator ?? '.'
  const fixedText = value.toFixed(decimalPlaces)
  const [integerText, decimalText] = fixedText.split('.')
  const formattedInteger = thousandSeparator
    ? integerText.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator)
    : integerText

  if (decimalText === undefined) {
    return formattedInteger
  }

  return `${formattedInteger}${decimalSeparator}${decimalText}`
}

export function pickAiNumericDisplayMeta(field: Field | null | undefined): AiNumericDisplayMeta | undefined {
  if (!field || field.type !== 'number') {
    return undefined
  }

  const extra = field.meta?.extra
  if (!extra) {
    return undefined
  }

  const meta: AiNumericDisplayMeta = {}

  if (typeof extra.unit === 'string' && extra.unit) {
    meta.unit = extra.unit
  }
  if (extra.unitPosition === 'prefix' || extra.unitPosition === 'suffix') {
    meta.unitPosition = extra.unitPosition
  }
  if (extra.isPercent === true) {
    meta.isPercent = true
  }
  if (Number.isFinite(extra.decimalPlaces)) {
    meta.decimalPlaces = Number(extra.decimalPlaces)
  }
  if (typeof extra.thousandSeparator === 'string') {
    meta.thousandSeparator = extra.thousandSeparator
  }
  if (typeof extra.decimalSeparator === 'string') {
    meta.decimalSeparator = extra.decimalSeparator
  }

  if (Object.keys(meta).length === 0) {
    return undefined
  }

  return meta
}

export function formatAiNumericValue(value: number | null | undefined, meta?: AiNumericDisplayMeta): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ''
  }

  if (!meta) {
    return String(value)
  }

  const scaledValue = meta.isPercent ? value * 100 : value
  const numberText = formatNumberForDisplay(Math.abs(scaledValue), meta)

  const prefix = meta.isPercent ? '' : meta.unitPosition === 'prefix' ? meta.unit ?? '' : ''
  const suffix = meta.isPercent ? '%' : meta.unitPosition === 'suffix' ? meta.unit ?? '' : ''

  return `${scaledValue < 0 ? '-' : ''}${prefix}${numberText}${suffix}`
}

export function describeAiFieldDisplay(name: string, meta?: AiNumericDisplayMeta): string {
  if (!meta) {
    return name
  }

  if (meta.isPercent) {
    return `${name}（%）`
  }

  if (!meta.unit) {
    return name
  }

  if (meta.unitPosition === 'prefix') {
    return global.i18next.t('aiNumericDisplay.unitPrefixLabel', {
      name,
      unit: meta.unit,
    })
  }

  return `${name}（${meta.unit}）`
}

export function describeAiFieldPrompt(name: string, meta?: AiNumericDisplayMeta): string {
  const normalizedName = String(name || '').trim()
  if (!normalizedName) {
    return ''
  }

  if (!meta) {
    return normalizedName
  }

  if (meta.isPercent) {
    return `${normalizedName} [百分比]`
  }

  if (!meta.unit) {
    return normalizedName
  }

  if (meta.unitPosition === 'prefix') {
    return `${normalizedName} [前缀单位=${meta.unit}]`
  }

  return `${normalizedName} [单位=${meta.unit}]`
}

export function buildAiFieldLookupNames(name: string, meta?: AiNumericDisplayMeta) {
  const normalizedName = String(name || '').trim()
  if (!normalizedName) {
    return []
  }

  return uniqueNonEmptyTexts([
    normalizedName,
    describeAiFieldDisplay(normalizedName, meta),
    describeAiFieldPrompt(normalizedName, meta),
  ])
}
