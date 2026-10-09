const GENERIC_BLUEPRINT_TITLES = new Set([
  '蓝图',
  '蓝图草案',
  '当前蓝图',
  '未命名蓝图',
])

const normalizeText = (value: unknown) => String(value || '').trim()

export const normalizeNocodeEditorBlueprintTitle = (value: unknown) => (
  normalizeText(value)
    .replace(/\s*[-－—]\s*蓝图草案\s*$/u, '')
    .replace(/^蓝图草案$/u, '')
    .trim()
)

export const isGenericNocodeEditorBlueprintTitle = (value: unknown) => (
  GENERIC_BLUEPRINT_TITLES.has(normalizeNocodeEditorBlueprintTitle(value))
)

export const resolveNocodeEditorBlueprintPrimaryFormName = (forms: unknown) => {
  if (!Array.isArray(forms) || forms.length !== 1) {
    return ''
  }

  const form = forms[0]
  if (!form || typeof form !== 'object' || Array.isArray(form)) {
    return ''
  }

  return normalizeText((form as Record<string, unknown>).tableName || (form as Record<string, unknown>).name)
}

export const resolveNocodeEditorBlueprintDisplayTitle = (input: {
  title?: unknown
  forms?: unknown
  fallback?: unknown
}) => {
  const normalizedTitle = normalizeNocodeEditorBlueprintTitle(input.title)
  if (normalizedTitle && !isGenericNocodeEditorBlueprintTitle(normalizedTitle)) {
    return normalizedTitle
  }

  const primaryFormName = resolveNocodeEditorBlueprintPrimaryFormName(input.forms)
  if (primaryFormName) {
    return primaryFormName
  }

  if (normalizedTitle) {
    return normalizedTitle
  }

  return normalizeText(input.fallback)
}
