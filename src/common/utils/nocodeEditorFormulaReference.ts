import type {
  NocodeEditorFormulaPath,
  NocodeEditorFormulaPlanItem,
  NocodeEditorFormulaPreflightIssue,
  NocodeEditorFormulaSpec,
  NocodeEditorFormulaReferenceIssueCode,
} from '@common/types/nocodeEditorFormula'

export type NocodeEditorFormulaFieldBinding = {
  fieldKey?: string
  parentFieldKey?: string
  fieldName: string
  widgetId: string
  token?: string
  fieldPath?: string
  sourceScope?: 'blueprint' | 'current-form' | 'linked-table' | 'other-table'
  sourceFormKey?: string
  valueType?: string
  widgetType?: string
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

const getFieldPath = (binding: NocodeEditorFormulaFieldBinding) => (
  normalizeText(binding.fieldPath)
  || [normalizeText(binding.parentFieldKey), normalizeText(binding.fieldKey)].filter(Boolean).join('.')
  || normalizeText(binding.fieldKey)
)

const getReferenceCandidates = (input: {
  fieldKey: string
  fieldName: string
  bindings: NocodeEditorFormulaFieldBinding[]
}) => {
  const exactCandidates = input.fieldKey
    ? input.bindings.filter(binding => getFieldPath(binding) === input.fieldKey)
    : []
  // 历史蓝图可能使用了未写入字段身份的自定义 key；只有标题唯一时才允许回退。
  return exactCandidates.length
    ? exactCandidates
    : input.bindings.filter(binding => normalizeText(binding.fieldName) === input.fieldName)
}

const isSubformBinding = (binding?: NocodeEditorFormulaFieldBinding) => (
  Boolean(binding && normalizeText(binding.widgetType).includes('subform'))
)

type FormulaFieldPlaceholder = {
  end: number
  fieldKey: string
  fieldName: string
}

const parseFormulaFieldPlaceholder = (
  formula: string,
  start: number,
): FormulaFieldPlaceholder | undefined => {
  if (!formula.startsWith('[[', start)) return undefined
  const endIndex = formula.indexOf(']]', start + 2)
  if (endIndex === -1) return undefined
  const match = /^field:([^,\]\r\n]*),([^\]\r\n]+)$/.exec(formula.slice(start + 2, endIndex))
  if (!match) return undefined
  return {
    end: endIndex + 2,
    fieldKey: normalizeText(match[1]),
    fieldName: normalizeText(match[2]),
  }
}

const resolveLegacySubformPair = (
  parent: FormulaFieldPlaceholder,
  child: FormulaFieldPlaceholder,
  bindings: NocodeEditorFormulaFieldBinding[],
) => {
  const parentCandidates = getReferenceCandidates({
    fieldKey: parent.fieldKey,
    fieldName: parent.fieldName,
    bindings,
  })
  if (parentCandidates.length !== 1 || !isSubformBinding(parentCandidates[0])) {
    return undefined
  }

  const parentPath = getFieldPath(parentCandidates[0])
  const scopedChildren = bindings.filter(binding => {
    const fieldPath = getFieldPath(binding)
    const belongsToParent = normalizeText(binding.parentFieldKey) === parentPath
      || fieldPath.startsWith(`${parentPath}.`)
    return belongsToParent && !isSubformBinding(binding)
  })
  const exactChildCandidates = child.fieldKey
    ? scopedChildren.filter(binding => {
      const fieldPath = getFieldPath(binding)
      return normalizeText(binding.fieldKey) === child.fieldKey
        || fieldPath === child.fieldKey
        || fieldPath === `${parentPath}.${child.fieldKey}`
    })
    : []
  const childCandidates = exactChildCandidates.length
    ? exactChildCandidates
    : scopedChildren.filter(binding => normalizeText(binding.fieldName) === child.fieldName)
  if (childCandidates.length !== 1) return undefined

  const childPath = getFieldPath(childCandidates[0])
  return childPath.startsWith(`${parentPath}.`)
    ? `[[field:${childPath},${normalizeText(childCandidates[0].fieldName)}]]`
    : undefined
}

type LegacySubformReferenceNormalization = {
  formula: string
  invalidParentPlaceholders: string[]
}

/**
 * 兼容旧蓝图的子表引用：[[parent]].[[child]] 统一折叠为叶子字段路径。
 * 只有父容器和子字段都能通过绑定元数据唯一定位时才转换，避免猜测同名字段。
 * 扫描过程跳过字符串字面量，避免修改公式中的示例文本。
 */
const normalizeLegacySubformReferences = (
  formula: string,
  bindings: NocodeEditorFormulaFieldBinding[],
): LegacySubformReferenceNormalization => {
  let normalized = ''
  let index = 0
  let quote = ''
  const invalidParentPlaceholders: string[] = []

  while (index < formula.length) {
    const character = formula[index]
    if (quote) {
      normalized += character
      if (character === '\\' && index + 1 < formula.length) {
        normalized += formula[index + 1]
        index += 2
        continue
      }
      if (character === quote) quote = ''
      index += 1
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      normalized += character
      index += 1
      continue
    }

    const parent = parseFormulaFieldPlaceholder(formula, index)
    if (!parent) {
      normalized += character
      index += 1
      continue
    }

    let childStart = parent.end
    while (/\s/.test(formula[childStart] || '')) childStart += 1
    if (formula[childStart] === '.') {
      childStart += 1
      while (/\s/.test(formula[childStart] || '')) childStart += 1
      const child = parseFormulaFieldPlaceholder(formula, childStart)
      const replacement = child
        ? resolveLegacySubformPair(parent, child, bindings)
        : undefined
      if (child && replacement) {
        normalized += replacement
        index = child.end
        continue
      }
      const parentCandidates = getReferenceCandidates({
        fieldKey: parent.fieldKey,
        fieldName: parent.fieldName,
        bindings,
      })
      if (child && parentCandidates.length === 1 && !isSubformBinding(parentCandidates[0])) {
        invalidParentPlaceholders.push(`[[field:${parent.fieldKey},${parent.fieldName}]]`)
      }
    }

    normalized += formula.slice(index, parent.end)
    index = parent.end
  }

  return { formula: normalized, invalidParentPlaceholders }
}

const createReferenceIssue = (input: {
  code: NocodeEditorFormulaReferenceIssueCode
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
  const normalizedFormula = normalizeLegacySubformReferences(
    String(input.setting?.formula || ''),
    input.bindings,
  )
  const formula = normalizedFormula.formula
  const issues: NocodeEditorFormulaPreflightIssue[] = normalizedFormula.invalidParentPlaceholders.map(placeholder => (
    createReferenceIssue({
      code: 'formula_reference_parent_invalid',
      item: input.item,
      message: `公式引用 ${placeholder} 的父级不是子表单容器。`,
    })
  ))
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
          code: 'formula_reference_field_key_unknown',
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
          code: 'formula_reference_field_key_unknown',
          item: input.item,
          message: `公式引用 ${placeholder} 不符合 [[field:fieldKey,字段标题]] 格式。`,
        }))
        index = endIndex + 2
        continue
      }

      const candidates = getReferenceCandidates({
        fieldKey,
        fieldName,
        bindings: input.bindings,
      })
      if (candidates.length !== 1) {
        issues.push(createReferenceIssue({
          code: candidates.length ? 'formula_reference_ambiguous' : 'formula_reference_field_key_unknown',
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
      const pathParts = fieldKey.split('.').filter(Boolean)
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join('.')
        const parentBinding = input.bindings.find(candidate => getFieldPath(candidate) === parentPath)
        if (parentBinding && !isSubformBinding(parentBinding)) {
          issues.push(createReferenceIssue({
            code: 'formula_reference_parent_invalid',
            item: input.item,
            message: `公式引用 ${placeholder} 的父级不是子表单容器。`,
          }))
          index = endIndex + 2
          continue
        }
      }
      if (binding.sourceScope && binding.sourceScope !== 'blueprint' && !normalizeText(binding.sourceFormKey)) {
        issues.push(createReferenceIssue({
          code: 'formula_reference_source_unknown',
          item: input.item,
          message: `公式引用 ${placeholder} 缺少可验证的外部字段来源。`,
        }))
        index = endIndex + 2
        continue
      }
      if (isSubformBinding(binding) && getFieldPath(binding) === fieldKey) {
        issues.push(createReferenceIssue({
          code: 'formula_reference_container_not_scalar',
          item: input.item,
          message: `公式引用 ${placeholder} 指向子表单容器，请改为引用其中的具体字段。`,
        }))
        index = endIndex + 2
        continue
      }
      if (!token || !normalizeText(binding.widgetId)) {
        issues.push(createReferenceIssue({
          code: 'formula_reference_runtime_token_missing',
          item: input.item,
          message: `公式引用 ${placeholder} 缺少可写入的字段 token。`,
        }))
        index = endIndex + 2
        continue
      }

      resolvedFormula += /^\[\[[^,\]\r\n]+,[^\]\r\n]+\]\]$/.test(normalizeText(binding.token))
        ? normalizeText(binding.token)
        : `[[${token},${binding.fieldName}]]`
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
      code: 'formula_reference_field_key_unknown',
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
