import type { NocodeEditorAiAppBlueprintField } from './types'

export type BlueprintFieldIdentitySource = Partial<NocodeEditorAiAppBlueprintField> | null | undefined

const BLUEPRINT_FIELD_PATH_TOKEN_SEPARATOR = '\u0000'

export const normalizeBlueprintIdentityToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s\-_/\\]/g, '')
  .replace(/[？?！!，,。、“”"'‘’：:；;（）()【】[\]《》<>]/g, '')

export const getBlueprintFieldStableIdentityKey = (field: BlueprintFieldIdentitySource) => (
  String(field?.fieldKey || '').trim()
)

export const getBlueprintFieldNameIdentityKey = (field: BlueprintFieldIdentitySource) => (
  normalizeBlueprintIdentityToken(field?.name)
)

export const isBlueprintFieldContainerLike = (field: BlueprintFieldIdentitySource) => (
  Boolean(field) && (
    Array.isArray(field?.children)
    || /subform|subtable/i.test(String(field?.widgetType || ''))
  )
)

export type BlueprintFieldIdentityIndex = {
  byStableKey: Map<string, NocodeEditorAiAppBlueprintField[]>
  byNormalizedStableKey: Map<string, NocodeEditorAiAppBlueprintField[]>
  byNameKey: Map<string, NocodeEditorAiAppBlueprintField[]>
}

const appendBlueprintFieldIdentityMatch = (
  matches: Map<string, NocodeEditorAiAppBlueprintField[]>,
  key: string,
  field: NocodeEditorAiAppBlueprintField,
) => {
  if (!key) {
    return
  }
  const existing = matches.get(key)
  if (existing) {
    existing.push(field)
    return
  }
  matches.set(key, [field])
}

export const createBlueprintFieldIdentityIndex = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
): BlueprintFieldIdentityIndex => {
  const byStableKey = new Map<string, NocodeEditorAiAppBlueprintField[]>()
  const byNormalizedStableKey = new Map<string, NocodeEditorAiAppBlueprintField[]>()
  const byNameKey = new Map<string, NocodeEditorAiAppBlueprintField[]>()

  for (const field of Array.isArray(fields) ? fields : []) {
    const stableKey = getBlueprintFieldStableIdentityKey(field)
    appendBlueprintFieldIdentityMatch(byStableKey, stableKey, field)
    appendBlueprintFieldIdentityMatch(
      byNormalizedStableKey,
      normalizeBlueprintIdentityToken(stableKey),
      field,
    )
    appendBlueprintFieldIdentityMatch(byNameKey, getBlueprintFieldNameIdentityKey(field), field)
  }

  return { byStableKey, byNormalizedStableKey, byNameKey }
}

// 路径与 patch 定位共用同一匹配口径：真实 fieldKey → 归一化 fieldKey → 归一化字段名。
export const findBlueprintFieldMatchesInIdentityIndex = (
  reference: unknown,
  index: BlueprintFieldIdentityIndex,
) => {
  const raw = String(reference || '').trim()
  if (!raw) {
    return []
  }
  const byStableKey = index.byStableKey.get(raw)
  if (byStableKey?.length) {
    return byStableKey
  }
  const token = normalizeBlueprintIdentityToken(raw)
  if (!token) {
    return []
  }
  const byNormalizedStableKey = index.byNormalizedStableKey.get(token)
  if (byNormalizedStableKey?.length) {
    return byNormalizedStableKey
  }
  return index.byNameKey.get(token) || []
}

export const findBlueprintFieldInIdentityIndex = (
  reference: unknown,
  index: BlueprintFieldIdentityIndex,
) => findBlueprintFieldMatchesInIdentityIndex(reference, index)[0]

export type BlueprintFieldIdentityMatch =
  | { kind: 'matched'; field: NocodeEditorAiAppBlueprintField }
  | { kind: 'ambiguous'; matches: NocodeEditorAiAppBlueprintField[] }
  | { kind: 'none' }

const resolveBlueprintFieldIdentityMatches = (
  matches: NocodeEditorAiAppBlueprintField[] | undefined,
): BlueprintFieldIdentityMatch => {
  if (!matches?.length) {
    return { kind: 'none' }
  }
  if (matches.length === 1) {
    return { kind: 'matched', field: matches[0] }
  }
  return { kind: 'ambiguous', matches }
}

export const resolveBlueprintFieldIdentityMatch = (
  field: BlueprintFieldIdentitySource,
  index: BlueprintFieldIdentityIndex,
): BlueprintFieldIdentityMatch => {
  const stableKey = getBlueprintFieldStableIdentityKey(field)
  if (stableKey) {
    const byStableKey = index.byStableKey.get(stableKey)
    if (byStableKey?.length) {
      return resolveBlueprintFieldIdentityMatches(byStableKey)
    }
    const normalizedStableKey = normalizeBlueprintIdentityToken(stableKey)
    const byNormalizedStableKey = normalizedStableKey
      ? index.byNormalizedStableKey.get(normalizedStableKey)
      : undefined
    if (byNormalizedStableKey?.length) {
      return resolveBlueprintFieldIdentityMatches(byNormalizedStableKey)
    }
  }
  const nameKey = getBlueprintFieldNameIdentityKey(field)
  return resolveBlueprintFieldIdentityMatches(nameKey ? index.byNameKey.get(nameKey) : undefined)
}

// 兼容读取链路：歧义时仍取第一个，严格 patch 链路使用 resolveBlueprintFieldIdentityMatch。
export const resolveBlueprintFieldIdentity = (
  field: BlueprintFieldIdentitySource,
  index: BlueprintFieldIdentityIndex,
) => {
  const match = resolveBlueprintFieldIdentityMatch(field, index)
  if (match.kind === 'matched') {
    return match.field
  }
  return match.kind === 'ambiguous' ? match.matches[0] : undefined
}

export const findBlueprintFieldMatchesByIdentitySegment = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
  segment: unknown,
) => findBlueprintFieldMatchesInIdentityIndex(segment, createBlueprintFieldIdentityIndex(fields))

export const findBlueprintFieldByIdentitySegment = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
  segment: unknown,
) => findBlueprintFieldMatchesByIdentitySegment(fields, segment)[0]

export const splitBlueprintFieldPathSegments = (value: unknown) => {
  const raw = String(value || '').trim()
  if (!raw.includes('.')) {
    return []
  }
  const segments = raw.split('.').map(segment => segment.trim())
  return segments.length >= 2 && segments.every(Boolean) ? segments : []
}

export type BlueprintFieldPathResolution =
  | {
    kind: 'existing'
    fieldChain: NocodeEditorAiAppBlueprintField[]
    leafField: NocodeEditorAiAppBlueprintField
  }
  | {
    kind: 'childAddition'
    fieldChain: NocodeEditorAiAppBlueprintField[]
    containerField: NocodeEditorAiAppBlueprintField
    childSegment: string
  }
  | {
    kind: 'ambiguous'
    fieldChain: NocodeEditorAiAppBlueprintField[]
    segment: string
    candidates: NocodeEditorAiAppBlueprintField[]
  }
  | { kind: 'unresolved' }

// 解析「父.子」路径：命中已有字段=原位更新，父容器命中且末段不存在=追加子字段。
// 每一段只接受唯一命中；同名/同 key 多命中时返回 ambiguous，禁止静默选第一个。
export const resolveBlueprintFieldPath = (
  fieldKey: unknown,
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined = [],
): BlueprintFieldPathResolution | null => {
  const segments = splitBlueprintFieldPathSegments(fieldKey)
  if (!segments.length) {
    return null
  }

  const fieldChain: NocodeEditorAiAppBlueprintField[] = []
  let cursorFields: readonly NocodeEditorAiAppBlueprintField[] = Array.isArray(fields) ? fields : []
  for (const segment of segments) {
    const matches = findBlueprintFieldMatchesByIdentitySegment(cursorFields, segment)
    if (matches.length > 1) {
      return {
        kind: 'ambiguous',
        fieldChain,
        segment,
        candidates: matches,
      }
    }
    const found = matches[0]
    if (!found) {
      const containerField = fieldChain[fieldChain.length - 1]
      if (
        containerField
        && fieldChain.length === segments.length - 1
        && isBlueprintFieldContainerLike(containerField)
      ) {
        return {
          kind: 'childAddition',
          fieldChain,
          containerField,
          childSegment: segment,
        }
      }
      return { kind: 'unresolved' }
    }
    fieldChain.push(found)
    cursorFields = Array.isArray(found.children) ? found.children : []
  }

  return {
    kind: 'existing',
    fieldChain,
    leafField: fieldChain[fieldChain.length - 1],
  }
}

// 同一条路径同时生成 fieldKey 与字段名两套 token，模型用任一标识表达都能命中同一目标。
export const buildBlueprintFieldIdentityPathTokens = (
  fieldChain: readonly BlueprintFieldIdentitySource[],
) => {
  const stableSegments: string[] = []
  const nameSegments: string[] = []
  for (const field of fieldChain) {
    const stableKey = normalizeBlueprintIdentityToken(getBlueprintFieldStableIdentityKey(field))
    const nameKey = getBlueprintFieldNameIdentityKey(field)
    stableSegments.push(stableKey || nameKey)
    nameSegments.push(nameKey || stableKey)
  }
  return [stableSegments, nameSegments]
    .filter(segments => segments.length && segments.every(Boolean))
    .map(segments => segments.join(BLUEPRINT_FIELD_PATH_TOKEN_SEPARATOR))
}
