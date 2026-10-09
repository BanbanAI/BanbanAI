import type {
  NocodeEditorFormulaPath,
  NocodeEditorFormulaPlanItem,
  NocodeEditorFormulaPreflightIssue,
  NocodeEditorFormulaSpec,
} from '@common/types/nocodeEditorFormula'

export type NocodeEditorFormulaFieldBinding = {
  fieldKey?: string
  fieldName: string
  widgetId: string
  token: string
  formulaPaths: NocodeEditorFormulaPath[]
}

type ResolvedFormulaReference = {
  formula?: string
  issues: NocodeEditorFormulaPreflightIssue[]
  referencedWidgetIds: string[]
}

const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
)

const normalizeFormulaToken = (value: unknown): string => {
  const token = normalizeText(value)
  const wrappedToken = /^\[\[([^,\]\r\n]+),[^\]\r\n]+\]\]$/.exec(token)
  return normalizeText(wrappedToken?.[1] || token)
}

const createReferenceIssue = (input: {
  code: 'reference_not_found' | 'reference_ambiguous'
  item: NocodeEditorFormulaPlanItem
  message: string
}): NocodeEditorFormulaPreflightIssue => ({
  code: input.code,
  severity: 'blocking',
  itemKey: input.item.itemKey,
  target: input.item.target,
  message: input.message,
  userActionRequired: false,
})

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const containsBareWidgetId = (formulaSegments: string[], bindings: NocodeEditorFormulaFieldBinding[]) => {
  return bindings.some(binding => {
    const widgetId = normalizeText(binding.widgetId)
    if (!widgetId) return false

    const widgetIdPattern = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(widgetId)}(?=$|[^A-Za-z0-9_-])`)
    return formulaSegments.some(segment => widgetIdPattern.test(segment))
  })
}

const resolveFormulaReferences = (input: {
  item: NocodeEditorFormulaPlanItem
  setting: NocodeEditorFormulaSpec
  bindings: NocodeEditorFormulaFieldBinding[]
}): ResolvedFormulaReference => {
  const formula = String(input.setting?.formula || '')
  const issues: NocodeEditorFormulaPreflightIssue[] = []
  const referencedWidgetIds: string[] = []
  const formulaSegments: string[] = []
  let resolvedFormula = ''
  let segment = ''
  let index = 0
  let quote = ''

  const flushSegment = () => {
    if (segment) {
      formulaSegments.push(segment)
      segment = ''
    }
  }

  while (index < formula.length) {
    const character = formula[index]
    if (quote) {
      resolvedFormula += character
      if (character === '\\' && index + 1 < formula.length) {
        resolvedFormula += formula[index + 1]
        index += 2
        continue
      }
      if (character === quote) {
        quote = ''
      }
      index += 1
      continue
    }

    if (character === '"' || character === "'") {
      flushSegment()
      quote = character
      resolvedFormula += character
      index += 1
      continue
    }

    if (formula.startsWith('[[', index)) {
      flushSegment()
      const endIndex = formula.indexOf(']]', index + 2)
      if (endIndex === -1) {
        issues.push(createReferenceIssue({
          code: 'reference_not_found',
          item: input.item,
          message: '公式包含未闭合的字段引用占位符。',
        }))
        break
      }

      const placeholder = formula.slice(index, endIndex + 2)
      const content = formula.slice(index + 2, endIndex)
      const match = /^field:([^,\]\r\n]*),([^\]\r\n]+)$/.exec(content)
      const fieldKey = normalizeText(match?.[1])
      const fieldName = normalizeText(match?.[2])
      if (!match || !fieldName) {
        issues.push(createReferenceIssue({
          code: 'reference_not_found',
          item: input.item,
          message: `公式引用 ${placeholder} 不符合 [[field:fieldKey,字段标题]] 格式。`,
        }))
        index = endIndex + 2
        continue
      }

      const candidates = fieldKey
        ? input.bindings.filter(binding => normalizeText(binding.fieldKey) === fieldKey)
        : input.bindings.filter(binding => normalizeText(binding.fieldName) === fieldName)
      if (candidates.length !== 1) {
        issues.push(createReferenceIssue({
          code: candidates.length ? 'reference_ambiguous' : 'reference_not_found',
          item: input.item,
          message: candidates.length
            ? `公式引用 ${placeholder} 匹配到多个字段。`
            : `公式引用 ${placeholder} 未匹配到字段。`,
        }))
        index = endIndex + 2
        continue
      }

      const binding = candidates[0]
      const token = normalizeFormulaToken(binding.token)
      if (!token || !normalizeText(binding.widgetId)) {
        issues.push(createReferenceIssue({
          code: 'reference_not_found',
          item: input.item,
          message: `公式引用 ${placeholder} 缺少可写入的字段 token。`,
        }))
        index = endIndex + 2
        continue
      }

      resolvedFormula += `[[${token},${binding.fieldName}]]`
      referencedWidgetIds.push(binding.widgetId)
      index = endIndex + 2
      continue
    }

    resolvedFormula += character
    segment += character
    index += 1
  }

  flushSegment()
  if (!issues.length && containsBareWidgetId(formulaSegments, input.bindings)) {
    issues.push(createReferenceIssue({
      code: 'reference_not_found',
      item: input.item,
      message: '公式不能使用裸 widgetId，字段引用必须使用 [[field:fieldKey,字段标题]]。',
    }))
  }

  return {
    ...(issues.length ? {} : { formula: resolvedFormula }),
    issues,
    referencedWidgetIds: Array.from(new Set(referencedWidgetIds)),
  }
}

export const resolveNocodeEditorFormulaReferences = (input: {
  item: NocodeEditorFormulaPlanItem
  setting: NocodeEditorFormulaSpec
  bindings: NocodeEditorFormulaFieldBinding[]
}): { formula?: string; issues: NocodeEditorFormulaPreflightIssue[] } => {
  const result = resolveFormulaReferences(input)
  return {
    ...(result.formula === undefined ? {} : { formula: result.formula }),
    issues: result.issues,
  }
}

export const collectNocodeEditorFormulaReferenceWidgetIds = (input: {
  item: NocodeEditorFormulaPlanItem
  setting: NocodeEditorFormulaSpec
  bindings: NocodeEditorFormulaFieldBinding[]
}): string[] => resolveFormulaReferences(input).referencedWidgetIds
