import type {
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from './types'
import {
  getBlueprintFieldNameIdentityKey,
  getBlueprintFieldStableIdentityKey,
  isBlueprintFieldMarkedDeleted,
  normalizeBlueprintIdentityToken,
} from './blueprintDeletionIdentity'

const cloneValue = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

const pickFirstDefined = <T,>(...values: Array<T | undefined>) => values.find(value => value !== undefined)

export type BlueprintFieldPathPatchResolution =
  | { kind: 'existing', fieldKey: string }
  | { kind: 'childAddition', containerKey: string, childKey: string }
  | { kind: 'unresolved' }

const isBlueprintFieldPathKey = (fieldKey: string) => {
  if (!fieldKey.includes('.')) {
    return false
  }
  const segments = fieldKey.split('.')
  return segments.length >= 2 && segments.every(segment => segment.trim().length > 0)
}

const findBlueprintFieldByPathSegment = (
  fields: NocodeEditorAiAppBlueprintField[],
  segment: string,
): NocodeEditorAiAppBlueprintField | undefined => {
  const rawSegment = segment.trim()
  if (!rawSegment) {
    return undefined
  }
  const byStableKey = fields.find(field => getBlueprintFieldStableIdentityKey(field) === rawSegment)
  if (byStableKey) {
    return byStableKey
  }
  const segmentToken = normalizeBlueprintIdentityToken(rawSegment)
  if (!segmentToken) {
    return undefined
  }
  const byNormalizedKey = fields.find((field) => {
    const stableKey = getBlueprintFieldStableIdentityKey(field)
    return Boolean(stableKey) && normalizeBlueprintIdentityToken(stableKey) === segmentToken
  })
  if (byNormalizedKey) {
    return byNormalizedKey
  }
  return fields.find(field => getBlueprintFieldNameIdentityKey(field) === segmentToken)
}

const isBlueprintFieldContainerLike = (field: NocodeEditorAiAppBlueprintField | undefined) => (
  Boolean(field) && (
    Array.isArray(field?.children)
    || /subform|subtable/i.test(String(field?.widgetType || ''))
  )
)

// 模型偶尔把「父字段key.子字段key」整体当作 fieldKey 提交（公式引用口径的延伸）；
// 这里把它解析回真实嵌套字段：命中已有子字段=原位更新，父容器命中且叶子是新 key=追加子字段。
// 分段匹配口径与删除清单一致：真实 fieldKey → 归一化 fieldKey → 归一化字段名。
export const resolveBlueprintFieldPathPatch = (
  fieldKey: unknown,
  fields: NocodeEditorAiAppBlueprintField[] = [],
): BlueprintFieldPathPatchResolution | null => {
  const rawKey = String(fieldKey || '').trim()
  if (!isBlueprintFieldPathKey(rawKey)) {
    return null
  }
  const segments = rawKey.split('.').map(segment => segment.trim())
  let cursorFields = fields
  let resolvedCount = 0
  let lastResolved: NocodeEditorAiAppBlueprintField | undefined
  for (const segment of segments) {
    const found = findBlueprintFieldByPathSegment(cursorFields, segment)
    if (!found) {
      break
    }
    resolvedCount += 1
    lastResolved = found
    cursorFields = Array.isArray(found.children) ? found.children : []
  }
  if (resolvedCount === segments.length) {
    const leafKey = getBlueprintFieldStableIdentityKey(lastResolved)
    return leafKey ? { kind: 'existing', fieldKey: leafKey } : { kind: 'unresolved' }
  }
  if (
    resolvedCount === segments.length - 1
    && isBlueprintFieldContainerLike(lastResolved)
  ) {
    const containerKey = getBlueprintFieldStableIdentityKey(lastResolved)
    return containerKey
      ? { kind: 'childAddition', containerKey, childKey: segments[segments.length - 1] }
      : { kind: 'unresolved' }
  }
  return { kind: 'unresolved' }
}

const buildBlueprintFieldLookupMaps = (fields: NocodeEditorAiAppBlueprintField[] = []) => {
  const stableMap = new Map<string, NocodeEditorAiAppBlueprintField>()
  const nameMap = new Map<string, NocodeEditorAiAppBlueprintField>()

  fields.forEach((field) => {
    const stableKey = getBlueprintFieldStableIdentityKey(field)
    if (stableKey) {
      stableMap.set(stableKey, field)
    }
    const nameKey = getBlueprintFieldNameIdentityKey(field)
    if (nameKey && !nameMap.has(nameKey)) {
      nameMap.set(nameKey, field)
    }
  })

  return {
    stableMap,
    nameMap,
  }
}

const resolveCurrentBlueprintField = (
  nextField: NocodeEditorAiAppBlueprintField,
  lookupMaps: ReturnType<typeof buildBlueprintFieldLookupMaps>,
) => {
  const stableKey = getBlueprintFieldStableIdentityKey(nextField)
  if (stableKey) {
    const matchedByStable = lookupMaps.stableMap.get(stableKey)
    if (matchedByStable) {
      return matchedByStable
    }
  }

  const nameKey = getBlueprintFieldNameIdentityKey(nextField)
  if (nameKey) {
    return lookupMaps.nameMap.get(nameKey)
  }

  return undefined
}

const mergeBlueprintFieldWithExisting = (
  nextField: NocodeEditorAiAppBlueprintField,
  currentField?: NocodeEditorAiAppBlueprintField,
  options: {
    updateMode?: 'patch' | 'replace'
    deletedFieldKeys?: Set<string>
  } = {},
): NocodeEditorAiAppBlueprintField => {
  const currentChildren = Array.isArray(currentField?.children) ? currentField.children : []
  const currentChildLookupMaps = buildBlueprintFieldLookupMaps(currentChildren)

  const mergedChildren = options.updateMode === 'patch'
    ? mergeBlueprintFieldsWithExisting(
      Array.isArray(nextField.children) ? nextField.children : [],
      currentChildren,
      options.deletedFieldKeys,
    )
    : Array.isArray(nextField.children)
      ? nextField.children.map((child) => {
        const currentChild = resolveCurrentBlueprintField(child, currentChildLookupMaps)
        return mergeBlueprintFieldWithExisting(child, currentChild)
      })
      : currentField?.children

  return {
    ...cloneValue(currentField || {}),
    ...cloneValue(nextField),
    fieldKey: String(nextField.fieldKey || currentField?.fieldKey || '').trim() || undefined,
    // 片段归一化会把缺失的 name 物化成空串；空名补丁不得覆盖既有字段名（nameless 父壳会把既有名称清空）
    name: pickFirstDefined(
      String(nextField.name || '').trim() || undefined,
      currentField?.name,
    ) || '',
    widgetType: String(nextField.widgetType || currentField?.widgetType || '').trim() || undefined,
    description: pickFirstDefined(
      String(nextField.description || '').trim() || undefined,
      currentField?.description,
    ),
    required: typeof nextField.required === 'boolean'
      ? nextField.required
      : currentField?.required,
    placeholder: pickFirstDefined(
      String(nextField.placeholder || '').trim() || undefined,
      currentField?.placeholder,
    ),
    validationFormat: pickFirstDefined(
      String(nextField.validationFormat || '').trim() || undefined,
      currentField?.validationFormat,
    ),
    enumOptions: Array.isArray(nextField.enumOptions)
      ? cloneValue(nextField.enumOptions)
      : currentField?.enumOptions,
    source: nextField.source
      ? cloneValue(nextField.source)
      : currentField?.source
        ? cloneValue(currentField.source)
        : undefined,
    notes: nextField.notes?.length
      ? cloneValue(nextField.notes)
      : currentField?.notes
        ? cloneValue(currentField.notes)
        : undefined,
    children: mergedChildren?.length ? mergedChildren : undefined,
  }
}

const buildBlueprintFieldDescendantIndex = (fields: NocodeEditorAiAppBlueprintField[] = []) => {
  const descendantByFieldKey = new Map<string, NocodeEditorAiAppBlueprintField>()
  const visit = (field: NocodeEditorAiAppBlueprintField) => {
    const children = Array.isArray(field?.children) ? field.children : []
    children.forEach((child) => {
      const stableKey = getBlueprintFieldStableIdentityKey(child)
      if (stableKey && !descendantByFieldKey.has(stableKey)) {
        descendantByFieldKey.set(stableKey, child)
      }
      visit(child)
    })
  }
  fields.forEach(visit)
  return descendantByFieldKey
}

// patch 的 fieldKey 命中子表单子字段时原位更新，避免在表单顶层新增同 key 的重复字段
const applyDescendantBlueprintFieldPatches = (
  field: NocodeEditorAiAppBlueprintField,
  descendantPatches: Map<string, NocodeEditorAiAppBlueprintField>,
  deletedFieldKeys: Set<string>,
): NocodeEditorAiAppBlueprintField => {
  const children = Array.isArray(field?.children) ? field.children : []
  if (!children.length) {
    return field
  }
  let changed = false
  const nextChildren: NocodeEditorAiAppBlueprintField[] = []
  children.forEach((child) => {
    const childStableKey = getBlueprintFieldStableIdentityKey(child)
    if (isBlueprintFieldMarkedDeleted(child, deletedFieldKeys)) {
      changed = true
      return
    }
    const childWithDescendantPatches = applyDescendantBlueprintFieldPatches(
      child,
      descendantPatches,
      deletedFieldKeys,
    )
    const patch = childStableKey ? descendantPatches.get(childStableKey) : undefined
    if (patch) {
      changed = true
      descendantPatches.delete(childStableKey)
      nextChildren.push(mergeBlueprintFieldWithExisting(patch, childWithDescendantPatches, {
        updateMode: 'patch',
        deletedFieldKeys,
      }))
      return
    }
    if (childWithDescendantPatches !== child) {
      changed = true
    }
    nextChildren.push(childWithDescendantPatches)
  })
  if (!changed) {
    return field
  }
  return {
    ...cloneValue(field),
    children: nextChildren,
  }
}

export const mergeBlueprintFieldsWithExisting = (
  nextFields: NocodeEditorAiAppBlueprintField[],
  currentFields: NocodeEditorAiAppBlueprintField[],
  deletedFieldKeys: Set<string> = new Set(),
) => {
  const currentFieldLookupMaps = buildBlueprintFieldLookupMaps(currentFields)
  const currentDescendantFieldByKey = buildBlueprintFieldDescendantIndex(currentFields)
  const descendantFieldPatches = new Map<string, NocodeEditorAiAppBlueprintField>()
  const nextFieldByCurrent = new Map<NocodeEditorAiAppBlueprintField, NocodeEditorAiAppBlueprintField>()
  const addedFields: NocodeEditorAiAppBlueprintField[] = []

  nextFields.forEach((nextField) => {
    const nextFieldKey = getBlueprintFieldStableIdentityKey(nextField)
    // 「父.子」点路径先解析为嵌套字段的原位更新/子字段追加，避免沉淀出顶层同名字段副本
    const pathResolution = resolveBlueprintFieldPathPatch(nextFieldKey, currentFields)
    if (pathResolution?.kind === 'existing') {
      if (!descendantFieldPatches.has(pathResolution.fieldKey)) {
        descendantFieldPatches.set(pathResolution.fieldKey, {
          ...cloneValue(nextField),
          fieldKey: pathResolution.fieldKey,
        })
      }
      return
    }
    if (pathResolution?.kind === 'childAddition') {
      const containerPatch = descendantFieldPatches.get(pathResolution.containerKey)
      const childFieldPatch = {
        ...cloneValue(nextField),
        fieldKey: pathResolution.childKey,
      }
      if (containerPatch) {
        containerPatch.children = [
          ...(Array.isArray(containerPatch.children) ? containerPatch.children : []),
          childFieldPatch,
        ]
      } else {
        const containerField = currentFieldLookupMaps.stableMap.get(pathResolution.containerKey)
          || currentDescendantFieldByKey.get(pathResolution.containerKey)
        descendantFieldPatches.set(pathResolution.containerKey, {
          fieldKey: pathResolution.containerKey,
          name: containerField?.name || pathResolution.containerKey,
          children: [childFieldPatch],
        })
      }
      return
    }

    const currentField = resolveCurrentBlueprintField(nextField, currentFieldLookupMaps)
    if (currentField && !nextFieldByCurrent.has(currentField)) {
      nextFieldByCurrent.set(currentField, nextField)
      return
    }
    if (
      !currentField
      && nextFieldKey
      && currentDescendantFieldByKey.has(nextFieldKey)
      && !descendantFieldPatches.has(nextFieldKey)
    ) {
      descendantFieldPatches.set(nextFieldKey, nextField)
      return
    }
    // 点路径完全无法解析且没有命中任何既有字段时会落成新字段——「顶层同名字段副本」事故的入口，显式失败让模型按真实标识重试
    if (pathResolution?.kind === 'unresolved') {
      throw new Error(
        `patch 的字段 fieldKey「${nextFieldKey}」形如“父字段.子字段”路径，但无法在当前暂存蓝图中解析到对应字段。`
        + '修改子表子字段必须通过其父字段表达（父字段 key 与子字段 key 用 . 连接，或在父字段 children 中携带子字段）；'
        + '请先调用 editor_get_staged_app_blueprint（detail="structure"）核对当前暂存结构，再按真实 fieldKey 重试。',
      )
    }
    // 缺 name 的字段片段无法锚定既有字段又无法作为新字段落地时显式失败；静默沉淀会产生无名字段（4b7315iw80l4 事故形态）
    if (!String(nextField.name || '').trim()) {
      throw new Error(
        `patch 的字段「${nextFieldKey || '未命名'}」没有 name，且未命中当前暂存蓝图中的既有字段。`
        + '修改既有字段请携带其真实 fieldKey（或完整「父.子」路径）；新增字段必须提供 name。'
        + '请先调用 editor_get_staged_app_blueprint（detail="structure"）核对当前暂存结构，再按真实标识重试。',
      )
    }
    addedFields.push(nextField)
  })

  return [
    ...currentFields.flatMap((currentField) => {
      if (isBlueprintFieldMarkedDeleted(currentField, deletedFieldKeys)) {
        return []
      }
      const nextField = nextFieldByCurrent.get(currentField)
      let mergedField = nextField
        ? mergeBlueprintFieldWithExisting(nextField, currentField, {
          updateMode: 'patch',
          deletedFieldKeys,
        })
        : cloneValue(currentField)
      // 点路径追加的子字段以「容器自身补丁」形式收口（顶层容器不经过子级递归补丁通道）
      const mergedFieldKey = getBlueprintFieldStableIdentityKey(mergedField)
      const selfPatch = mergedFieldKey ? descendantFieldPatches.get(mergedFieldKey) : undefined
      if (mergedFieldKey && selfPatch) {
        descendantFieldPatches.delete(mergedFieldKey)
        mergedField = mergeBlueprintFieldWithExisting(selfPatch, mergedField, {
          updateMode: 'patch',
          deletedFieldKeys,
        })
      }
      return [
        applyDescendantBlueprintFieldPatches(
          mergedField,
          descendantFieldPatches,
          deletedFieldKeys,
        ),
      ]
    }),
    ...addedFields
      .filter(field => !isBlueprintFieldMarkedDeleted(field, deletedFieldKeys))
      .map(field => mergeBlueprintFieldWithExisting(field, undefined, {
        updateMode: 'patch',
        deletedFieldKeys,
      })),
  ]
}

export const mergeBlueprintFormWithExisting = (
  nextForm: NocodeEditorAiAppBlueprintForm,
  currentForm?: NocodeEditorAiAppBlueprintForm,
  options: {
    updateMode?: 'patch' | 'replace'
    deletedFieldKeys?: Set<string>
  } = {},
): NocodeEditorAiAppBlueprintForm => {
  const currentFieldLookupMaps = buildBlueprintFieldLookupMaps(
    Array.isArray(currentForm?.fields) ? currentForm.fields : [],
  )

  return {
    ...cloneValue(currentForm || {}),
    ...cloneValue(nextForm),
    formKey: String(nextForm.formKey || currentForm?.formKey || '').trim() || undefined,
    groupName: pickFirstDefined(
      String(nextForm.groupName || '').trim() || undefined,
      currentForm?.groupName,
    ),
    description: pickFirstDefined(
      String(nextForm.description || '').trim() || undefined,
      currentForm?.description,
    ),
    fields: options.updateMode === 'patch'
      ? mergeBlueprintFieldsWithExisting(
        nextForm.fields,
        Array.isArray(currentForm?.fields) ? currentForm.fields : [],
        options.deletedFieldKeys,
      )
      : nextForm.fields.map(field => mergeBlueprintFieldWithExisting(
        field,
        resolveCurrentBlueprintField(field, currentFieldLookupMaps),
      )),
  }
}