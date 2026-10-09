import type { Field } from '@common/types/project'

const AI_METRIC_FIELD_TYPES = new Set([
  'int',
  'integer',
  'float',
  'double',
  'number',
  'money',
  'price',
])

const AI_METRIC_FIELD_KEYWORDS = [
  'amount',
  'count',
  'price',
  'fee',
  'qty',
  'number',
  'score',
  '数量',
  '金额',
  '价格',
  '费用',
  '总额',
  '数值',
  '分数',
] as const

export function normalizeAiComparableText(value: any) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export function buildAiMetricFieldComparable(field: Pick<Field, 'alias' | 'uid' | 'meta'> | null | undefined) {
  return normalizeAiComparableText([
    field?.alias,
    field?.uid,
    field?.meta?.name,
  ].filter(Boolean).join(' '))
}

export function isAiMetricFieldType(fieldType: string) {
  return AI_METRIC_FIELD_TYPES.has(String(fieldType || '').trim().toLowerCase())
}

export function isAiMetricComparableText(comparable: string) {
  return AI_METRIC_FIELD_KEYWORDS.some(keyword => comparable.includes(keyword))
}

export function isAiMetricField(field: Pick<Field, 'alias' | 'uid' | 'type' | 'meta'> | null | undefined) {
  return isAiMetricFieldByParts(String(field?.type || ''), buildAiMetricFieldComparable(field))
}

export function isAiMetricFieldByParts(fieldType: string, comparable: string) {
  return isAiMetricFieldType(fieldType) || isAiMetricComparableText(comparable)
}
