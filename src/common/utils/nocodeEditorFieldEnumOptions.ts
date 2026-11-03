export type NocodeEditorFieldEnumOption = {
  label: string
  value: string
}

type FieldLike = {
  meta?: {
    extra?: Record<string, unknown> | null
  } | null
} | null | undefined

// 单选/多选/下拉控件把选项存在各自的控件选项键下，只读 options/enumOptions 会让这些字段看起来没有选项。
export const NOCODE_EDITOR_FIELD_ENUM_OPTION_KEYS = [
  'radiogroup-value-text-color-option',
  'checkbox-option',
  'treeselect-value-text-option',
] as const

export const normalizeNocodeEditorFieldEnumOptions = (value: unknown): NocodeEditorFieldEnumOption[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const normalized = item.trim()
        return normalized ? { label: normalized, value: normalized } : null
      }
      if (!item || typeof item !== 'object') {
        return null
      }
      const label = String((item as Record<string, unknown>).label || (item as Record<string, unknown>).value || '').trim()
      const optionValue = String((item as Record<string, unknown>).value || (item as Record<string, unknown>).label || '').trim()
      return label && optionValue ? { label, value: optionValue } : null
    })
    .filter((item): item is NocodeEditorFieldEnumOption => Boolean(item))
}

const readFieldExtra = (field: FieldLike) => (
  (field?.meta?.extra && typeof field.meta.extra === 'object' ? field.meta.extra : {}) as Record<string, unknown>
)

export const resolveNocodeEditorFieldEnumOptions = (field: FieldLike): NocodeEditorFieldEnumOption[] => {
  const extra = readFieldExtra(field)
  const candidates: unknown[] = [extra.options, extra.enumOptions, extra.choices]
  NOCODE_EDITOR_FIELD_ENUM_OPTION_KEYS.forEach((key) => {
    const widgetOption = extra[key]
    candidates.push(
      widgetOption && typeof widgetOption === 'object'
        ? (widgetOption as { options?: unknown }).options
        : undefined,
    )
  })
  for (const candidate of candidates) {
    const normalized = normalizeNocodeEditorFieldEnumOptions(candidate)
    if (normalized.length) {
      return normalized
    }
  }
  return []
}

export const resolveNocodeEditorFieldEnumSourceType = (field: FieldLike): string => {
  const extra = readFieldExtra(field)
  const explicit = String(extra.enumSourceType || extra['select-choices-type'] || '').trim()
  if (explicit) {
    return explicit
  }
  return resolveNocodeEditorFieldEnumOptions(field).length ? 'custom' : ''
}
