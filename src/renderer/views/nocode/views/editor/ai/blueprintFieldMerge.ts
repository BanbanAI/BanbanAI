import type {
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from './types'
import {
  buildBlueprintFieldIdentityPathTokens,
  createBlueprintFieldIdentityIndex,
  getBlueprintFieldNameIdentityKey,
  getBlueprintFieldStableIdentityKey,
  normalizeBlueprintIdentityToken,
  resolveBlueprintFieldIdentity,
  resolveBlueprintFieldIdentityMatch,
  resolveBlueprintFieldPath,
} from './blueprintFieldIdentity'
import type { BlueprintFieldDeletionMatcher } from './blueprintDeletionIdentity'
import { isBlueprintFieldMarkedDeleted } from './blueprintDeletionIdentity'

const cloneValue = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

const pickFirstDefined = <T,>(...values: Array<T | undefined>) => values.find(value => value !== undefined)

type BlueprintFieldPathPatchResolution =
  | {
    kind: 'existing'
    fieldKey: string
    fieldChain: NocodeEditorAiAppBlueprintField[]
  }
  | {
    kind: 'childAddition'
    containerKey: string
    childKey: string
    containerFieldChain: NocodeEditorAiAppBlueprintField[]
  }
  | {
    kind: 'ambiguous'
    fieldKey: string
    candidatePaths: NocodeEditorAiAppBlueprintField[][]
  }
  | { kind: 'unresolved' }

type BlueprintFieldMergeOptions = {
  updateMode?: 'patch' | 'replace'
  deletionMatcher?: BlueprintFieldDeletionMatcher
  fieldPath?: readonly NocodeEditorAiAppBlueprintField[]
}

// 路径解析复用统一标识口径；字段链带上 parentPath，供路径级 patch 精确定位。
const resolveBlueprintFieldPathPatch = (
  fieldKey: unknown,
  fields: readonly NocodeEditorAiAppBlueprintField[] = [],
  basePath: readonly NocodeEditorAiAppBlueprintField[] = [],
): BlueprintFieldPathPatchResolution | null => {
  const resolution = resolveBlueprintFieldPath(fieldKey, fields)
  if (!resolution) {
    return null
  }
  if (resolution.kind === 'existing') {
    const leafKey = getBlueprintFieldStableIdentityKey(resolution.leafField)
    return leafKey
      ? {
        kind: 'existing',
        fieldKey: leafKey,
        fieldChain: [...basePath, ...resolution.fieldChain],
      }
      : { kind: 'unresolved' }
  }
  if (resolution.kind === 'childAddition') {
    const containerKey = getBlueprintFieldStableIdentityKey(resolution.containerField)
    return containerKey
      ? {
        kind: 'childAddition',
        containerKey,
        childKey: resolution.childSegment,
        containerFieldChain: [...basePath, ...resolution.fieldChain],
      }
      : { kind: 'unresolved' }
  }
  if (resolution.kind === 'ambiguous') {
    return {
      kind: 'ambiguous',
      fieldKey: String(fieldKey || '').trim(),
      candidatePaths: resolution.candidates.map(candidate => [
        ...basePath,
        ...resolution.fieldChain,
        candidate,
      ]),
    }
  }
  return resolution
}

const mergeBlueprintFieldWithExisting = (
  nextField: NocodeEditorAiAppBlueprintField,
  currentField?: NocodeEditorAiAppBlueprintField,
  options: BlueprintFieldMergeOptions = {},
): NocodeEditorAiAppBlueprintField => {
  const currentChildren = Array.isArray(currentField?.children) ? currentField.children : []
  const currentChildLookupMaps = createBlueprintFieldIdentityIndex(currentChildren)
  const fieldPath = options.fieldPath || (currentField ? [currentField] : [nextField])

  const mergedChildren = options.updateMode === 'patch'
    ? mergeBlueprintFieldsWithExistingInternal(
      Array.isArray(nextField.children) ? nextField.children : [],
      currentChildren,
      {
        deletionMatcher: options.deletionMatcher,
        parentPath: fieldPath,
      },
    )
    : Array.isArray(nextField.children)
      ? nextField.children.map((child) => {
        const currentChild = resolveBlueprintFieldIdentity(child, currentChildLookupMaps)
        return mergeBlueprintFieldWithExisting(child, currentChild)
      })
      : currentField?.children

  const nextFieldKey = String(nextField.fieldKey || '').trim()
  const currentFieldKey = String(currentField?.fieldKey || '').trim()

  return {
    ...cloneValue(currentField || {}),
    ...cloneValue(nextField),
    // patch 只更新业务属性，身份由既有字段保持；否则按名称兜底命中时会静默改写公式依赖的 fieldKey
    fieldKey: options.updateMode === 'patch' && currentFieldKey
      ? currentFieldKey
      : nextFieldKey || currentFieldKey || undefined,
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

type BlueprintFieldDescendantEntry = {
  field: NocodeEditorAiAppBlueprintField
  path: NocodeEditorAiAppBlueprintField[]
}

type BlueprintFieldDescendantIndex = {
  byStableKey: Map<string, BlueprintFieldDescendantEntry[]>
  byNormalizedStableKey: Map<string, BlueprintFieldDescendantEntry[]>
  byNameKey: Map<string, BlueprintFieldDescendantEntry[]>
}

type BlueprintFieldDescendantMatch =
  | { kind: 'matched'; entry: BlueprintFieldDescendantEntry }
  | { kind: 'ambiguous'; entries: BlueprintFieldDescendantEntry[] }
  | { kind: 'none' }

const appendBlueprintFieldDescendantEntry = (
  entries: Map<string, BlueprintFieldDescendantEntry[]>,
  key: string,
  entry: BlueprintFieldDescendantEntry,
) => {
  if (!key) {
    return
  }
  const existing = entries.get(key)
  if (existing) {
    existing.push(entry)
    return
  }
  entries.set(key, [entry])
}

const buildBlueprintFieldDescendantIndex = (
  fields: NocodeEditorAiAppBlueprintField[] = [],
  basePath: readonly NocodeEditorAiAppBlueprintField[] = [],
): BlueprintFieldDescendantIndex => {
  const byStableKey = new Map<string, BlueprintFieldDescendantEntry[]>()
  const byNormalizedStableKey = new Map<string, BlueprintFieldDescendantEntry[]>()
  const byNameKey = new Map<string, BlueprintFieldDescendantEntry[]>()
  const visit = (
    field: NocodeEditorAiAppBlueprintField,
    fieldPath: NocodeEditorAiAppBlueprintField[],
  ) => {
    const children = Array.isArray(field?.children) ? field.children : []
    children.forEach((child) => {
      const childPath = [...fieldPath, child]
      const entry = { field: child, path: childPath }
      const stableKey = getBlueprintFieldStableIdentityKey(child)
      appendBlueprintFieldDescendantEntry(byStableKey, stableKey, entry)
      appendBlueprintFieldDescendantEntry(
        byNormalizedStableKey,
        normalizeBlueprintIdentityToken(stableKey),
        entry,
      )
      appendBlueprintFieldDescendantEntry(byNameKey, getBlueprintFieldNameIdentityKey(child), entry)
      visit(child, childPath)
    })
  }
  fields.forEach(field => visit(field, [...basePath, field]))
  return { byStableKey, byNormalizedStableKey, byNameKey }
}

const resolveBlueprintFieldDescendantEntries = (
  entries: BlueprintFieldDescendantEntry[] | undefined,
): BlueprintFieldDescendantMatch => {
  if (!entries?.length) {
    return { kind: 'none' }
  }
  if (entries.length === 1) {
    return { kind: 'matched', entry: entries[0] }
  }
  return { kind: 'ambiguous', entries }
}

// 子字段更新只接受唯一命中；名称兜底仅用于无 key、无点路径的 patch 片段。
const resolveBlueprintFieldDescendantMatch = (
  field: NocodeEditorAiAppBlueprintField,
  index: BlueprintFieldDescendantIndex,
  options: { allowNameFallback?: boolean } = {},
): BlueprintFieldDescendantMatch => {
  const stableKey = getBlueprintFieldStableIdentityKey(field)
  if (stableKey) {
    const byStableKey = index.byStableKey.get(stableKey)
    if (byStableKey?.length) {
      return resolveBlueprintFieldDescendantEntries(byStableKey)
    }
    const normalizedStableKey = normalizeBlueprintIdentityToken(stableKey)
    const byNormalizedStableKey = normalizedStableKey
      ? index.byNormalizedStableKey.get(normalizedStableKey)
      : undefined
    if (byNormalizedStableKey?.length) {
      return resolveBlueprintFieldDescendantEntries(byNormalizedStableKey)
    }
  }
  if (options.allowNameFallback) {
    const nameKey = getBlueprintFieldNameIdentityKey(field)
    const byNameKey = nameKey ? index.byNameKey.get(nameKey) : undefined
    if (byNameKey?.length) {
      return resolveBlueprintFieldDescendantEntries(byNameKey)
    }
  }
  return { kind: 'none' }
}

const formatBlueprintFieldLabel = (
  field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined,
) => String(field?.name || '').trim() || String(field?.fieldKey || '').trim() || '未命名字段'

const formatBlueprintFieldPathLabel = (
  fieldPath: readonly NocodeEditorAiAppBlueprintField[],
) => fieldPath.map(field => formatBlueprintFieldLabel(field)).filter(Boolean).join('.')

const formatBlueprintFieldCandidatePaths = (
  candidatePaths: ReadonlyArray<readonly NocodeEditorAiAppBlueprintField[]>,
  limit = 3,
) => {
  const labels = candidatePaths
    .map(candidatePath => formatBlueprintFieldPathLabel(candidatePath))
    .filter(Boolean)
  const visible = labels.slice(0, limit).join('、')
  return labels.length > limit ? `${visible} 等 ${labels.length} 个` : visible
}

const buildDescendantPatchAmbiguityError = (
  referenceLabel: string,
  entries: BlueprintFieldDescendantEntry[],
) => new Error(
  `patch 的字段${referenceLabel}在当前表单的多个子字段中存在多个匹配：`
  + `${formatBlueprintFieldCandidatePaths(entries.map(entry => entry.path))}。`
  + '无法确定更新目标。请改用「父字段.子字段」完整路径（父/子均可使用真实 fieldKey 或字段名），'
  + '或先调用 editor_get_staged_app_blueprint（detail="structure"）核对当前暂存结构后重试。',
)

const buildTopLevelPatchAmbiguityError = (
  referenceLabel: string,
  matches: NocodeEditorAiAppBlueprintField[],
) => new Error(
  `patch 的字段${referenceLabel}在当前表单的多个顶层字段中存在多个匹配：`
  + `${formatBlueprintFieldCandidatePaths(matches.map(field => [field]))}。`
  + '请改用真实 fieldKey 或「父字段.子字段」路径，'
  + '或先调用 editor_get_staged_app_blueprint（detail="structure"）核对当前暂存结构后重试。',
)

const buildPathPatchAmbiguityError = (
  fieldKey: string,
  candidatePaths: ReadonlyArray<readonly NocodeEditorAiAppBlueprintField[]>,
) => new Error(
  `patch 的字段路径「${fieldKey}」存在多个匹配：`
  + `${formatBlueprintFieldCandidatePaths(candidatePaths)}。`
  + '请改用带稳定 fieldKey 的「父字段.子字段」路径，例如 field-detail.field-amount；'
  + '或先调用 editor_get_staged_app_blueprint（detail="structure"）核对当前暂存结构后重试。',
)

const throwDuplicateBlueprintFieldPatchError = (label: string) => {
  throw new Error(
    `patch 中有多个字段片段指向同一个字段「${label}」。请合并为一条字段片段后重试。`,
  )
}

type BlueprintFieldPathPatchEntry = {
  patch: NocodeEditorAiAppBlueprintField
  targetPath: NocodeEditorAiAppBlueprintField[]
  targetPathTokens: string[]
}

type BlueprintFieldPathPatchIndex = Map<string, BlueprintFieldPathPatchEntry[]>

const isSameBlueprintFieldPath = (
  left: readonly NocodeEditorAiAppBlueprintField[],
  right: readonly NocodeEditorAiAppBlueprintField[],
) => left.length === right.length && left.every((field, index) => field === right[index])

const hasSameBlueprintFieldPathTokens = (
  left: readonly string[],
  right: readonly string[],
) => {
  if (left.length !== right.length) {
    return false
  }
  const leftTokens = new Set(left)
  return right.every(token => leftTokens.has(token))
}

// 同一字段路径会同时生成 key 路径与名称路径两套 token；
// 只有两套 token 全部吻合才算命中，避免重复子字段 key 在遍历时被错误消费。
const findBlueprintFieldPathPatch = (
  patches: BlueprintFieldPathPatchIndex,
  targetPath: readonly NocodeEditorAiAppBlueprintField[],
) => {
  const fieldTokens = buildBlueprintFieldIdentityPathTokens(targetPath)
  if (!fieldTokens.length) {
    return undefined
  }
  const candidates = new Set<BlueprintFieldPathPatchEntry>()
  fieldTokens.forEach((token) => {
    patches.get(token)?.forEach(entry => candidates.add(entry))
  })
  return Array.from(candidates).find(entry => (
    hasSameBlueprintFieldPathTokens(entry.targetPathTokens, fieldTokens)
  ))
}

const registerBlueprintFieldPathPatch = (
  patches: BlueprintFieldPathPatchIndex,
  targetPath: readonly NocodeEditorAiAppBlueprintField[],
  patch: NocodeEditorAiAppBlueprintField,
) => {
  const tokens = buildBlueprintFieldIdentityPathTokens(targetPath)
  if (!tokens.length) {
    throw new Error(
      `patch 的字段「${formatBlueprintFieldPathLabel(targetPath)}」缺少可用于定位的 fieldKey 或名称，无法确定更新目标。`
      + '请先调用 editor_get_staged_app_blueprint（detail="structure"）核对当前暂存结构，再按真实标识重试。',
    )
  }
  for (const token of tokens) {
    for (const existing of patches.get(token) || []) {
      if (isSameBlueprintFieldPath(existing.targetPath, targetPath)) {
        // 子字段追加与容器自身更新可以合并；纯属性更新重复出现仍视为模型重复提交
        const hasChildrenPatch = Boolean(
          existing.patch.children?.length || patch.children?.length,
        )
        if (hasChildrenPatch) {
          existing.patch = mergeBlueprintFieldWithExisting(patch, existing.patch, {
            updateMode: 'patch',
          })
          return existing
        }
        throwDuplicateBlueprintFieldPatchError(formatBlueprintFieldPathLabel(targetPath))
      }
      if (hasSameBlueprintFieldPathTokens(existing.targetPathTokens, tokens)) {
        throw new Error(
          `patch 的字段路径「${formatBlueprintFieldPathLabel(targetPath)}」与目标「${formatBlueprintFieldPathLabel(existing.targetPath)}」的标识冲突，无法唯一确定更新目标。`
          + '请改用带稳定 fieldKey 的完整「父字段.子字段」路径后重试。',
        )
      }
    }
  }
  const entry = { patch, targetPath: [...targetPath], targetPathTokens: tokens }
  tokens.forEach((token) => {
    const entries = patches.get(token)
    if (entries) {
      entries.push(entry)
      return
    }
    patches.set(token, [entry])
  })
  return entry
}

const takeBlueprintFieldPathPatch = (
  patches: BlueprintFieldPathPatchIndex,
  fieldPath: readonly NocodeEditorAiAppBlueprintField[],
) => {
  const entry = findBlueprintFieldPathPatch(patches, fieldPath)
  if (!entry) {
    return undefined
  }
  entry.targetPathTokens.forEach((token) => {
    const entries = patches.get(token)
    if (!entries) {
      return
    }
    const remaining = entries.filter(item => item !== entry)
    if (remaining.length) {
      patches.set(token, remaining)
      return
    }
    patches.delete(token)
  })
  return entry.patch
}

// 按完整字段路径应用 patch，滚动多条子表里出现同 key 时也不会命中错误分支
const applyBlueprintFieldPatches = (
  field: NocodeEditorAiAppBlueprintField,
  patches: BlueprintFieldPathPatchIndex,
  options: BlueprintFieldMergeOptions,
  fieldPath: NocodeEditorAiAppBlueprintField[],
): NocodeEditorAiAppBlueprintField => {
  const patch = takeBlueprintFieldPathPatch(patches, fieldPath)
  const nextField = patch
    ? mergeBlueprintFieldWithExisting(patch, field, {
      updateMode: 'patch',
      deletionMatcher: options.deletionMatcher,
      fieldPath,
    })
    : field
  let changed = Boolean(patch)
  const children = Array.isArray(nextField?.children) ? nextField.children : []
  if (!children.length) {
    return changed ? nextField : field
  }
  const nextChildren: NocodeEditorAiAppBlueprintField[] = []
  children.forEach((child) => {
    const childPath = [...fieldPath, child]
    if (isBlueprintFieldMarkedDeleted(child, options.deletionMatcher, childPath)) {
      changed = true
      return
    }
    const patchedChild = applyBlueprintFieldPatches(child, patches, options, childPath)
    if (patchedChild !== child) {
      changed = true
    }
    nextChildren.push(patchedChild)
  })
  if (!changed) {
    return field
  }
  return {
    ...cloneValue(nextField),
    children: nextChildren,
  }
}

const mergeBlueprintFieldsWithExistingInternal = (
  nextFields: NocodeEditorAiAppBlueprintField[],
  currentFields: NocodeEditorAiAppBlueprintField[],
  options: BlueprintFieldMergeOptions & {
    parentPath?: readonly NocodeEditorAiAppBlueprintField[]
  } = {},
) => {
  const parentPath = options.parentPath || []
  const deletionMatcher = options.deletionMatcher
  const currentFieldIdentityIndex = createBlueprintFieldIdentityIndex(currentFields)
  const currentDescendantFieldIndex = buildBlueprintFieldDescendantIndex(currentFields, parentPath)
  const descendantFieldPatches: BlueprintFieldPathPatchIndex = new Map()
  const nextFieldByCurrent = new Map<NocodeEditorAiAppBlueprintField, NocodeEditorAiAppBlueprintField>()
  const addedFields: NocodeEditorAiAppBlueprintField[] = []

  nextFields.forEach((nextField) => {
    const nextFieldKey = getBlueprintFieldStableIdentityKey(nextField)
    const nextFieldLabel = nextFieldKey
      ? `fieldKey「${nextFieldKey}」`
      : `「${formatBlueprintFieldLabel(nextField)}」`
    // 「父.子」点路径先解析为嵌套字段的原位更新/子字段追加，避免沉淀出顶层同名字段副本
    const pathResolution = resolveBlueprintFieldPathPatch(nextFieldKey, currentFields, parentPath)
    if (pathResolution?.kind === 'ambiguous') {
      throw buildPathPatchAmbiguityError(pathResolution.fieldKey, pathResolution.candidatePaths)
    }
    if (pathResolution?.kind === 'existing') {
      registerBlueprintFieldPathPatch(
        descendantFieldPatches,
        pathResolution.fieldChain,
        {
          ...cloneValue(nextField),
          fieldKey: pathResolution.fieldKey,
        },
      )
      return
    }
    if (pathResolution?.kind === 'childAddition') {
      const containerPath = pathResolution.containerFieldChain
      const existingContainerPatch = findBlueprintFieldPathPatch(
        descendantFieldPatches,
        containerPath,
      )
      const childFieldPatch = {
        ...cloneValue(nextField),
        fieldKey: pathResolution.childKey,
      }
      if (existingContainerPatch) {
        existingContainerPatch.patch.children = [
          ...(Array.isArray(existingContainerPatch.patch.children)
            ? existingContainerPatch.patch.children
            : []),
          childFieldPatch,
        ]
      } else {
        const containerField = containerPath[containerPath.length - 1]
        registerBlueprintFieldPathPatch(
          descendantFieldPatches,
          containerPath,
          {
            fieldKey: pathResolution.containerKey,
            name: String(containerField?.name || '').trim() || pathResolution.containerKey,
            children: [childFieldPatch],
          },
        )
      }
      return
    }

    const currentFieldMatch = resolveBlueprintFieldIdentityMatch(nextField, currentFieldIdentityIndex)
    if (currentFieldMatch.kind === 'ambiguous') {
      throw buildTopLevelPatchAmbiguityError(nextFieldLabel, currentFieldMatch.matches)
    }
    if (currentFieldMatch.kind === 'matched') {
      if (nextFieldByCurrent.has(currentFieldMatch.field)) {
        throwDuplicateBlueprintFieldPatchError(formatBlueprintFieldLabel(currentFieldMatch.field))
      }
      nextFieldByCurrent.set(currentFieldMatch.field, nextField)
      return
    }
    // 裸 key / 无 key 名称兜底都只接受唯一子字段命中；多命中必须让模型改用「父.子」路径
    const descendantMatch = resolveBlueprintFieldDescendantMatch(
      nextField,
      currentDescendantFieldIndex,
      { allowNameFallback: !nextFieldKey && !pathResolution },
    )
    if (descendantMatch.kind === 'ambiguous') {
      throw buildDescendantPatchAmbiguityError(nextFieldLabel, descendantMatch.entries)
    }
    if (descendantMatch.kind === 'matched') {
      registerBlueprintFieldPathPatch(
        descendantFieldPatches,
        descendantMatch.entry.path,
        nextField,
      )
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

  const mergedFields = [
    ...currentFields.flatMap((currentField) => {
      const currentFieldPath = [...parentPath, currentField]
      if (isBlueprintFieldMarkedDeleted(currentField, deletionMatcher, currentFieldPath)) {
        return []
      }
      const nextField = nextFieldByCurrent.get(currentField)
      const mergedField = nextField
        ? mergeBlueprintFieldWithExisting(nextField, currentField, {
          updateMode: 'patch',
          deletionMatcher,
          fieldPath: currentFieldPath,
        })
        : cloneValue(currentField)
      return [
        applyBlueprintFieldPatches(
          mergedField,
          descendantFieldPatches,
          { updateMode: 'patch', deletionMatcher },
          currentFieldPath,
        ),
      ]
    }),
    ...addedFields
      .filter(field => !isBlueprintFieldMarkedDeleted(
        field,
        deletionMatcher,
        [...parentPath, field],
      ))
      .map((field) => {
        const fieldPath = [...parentPath, field]
        const mergedField = mergeBlueprintFieldWithExisting(field, undefined, {
          updateMode: 'patch',
          deletionMatcher,
          fieldPath,
        })
        return applyBlueprintFieldPatches(
          mergedField,
          descendantFieldPatches,
          { updateMode: 'patch', deletionMatcher },
          fieldPath,
        )
      }),
  ]
  if (descendantFieldPatches.size) {
    const targetLabels = Array.from(new Set(
      Array.from(descendantFieldPatches.values())
        .flat()
        .map(entry => formatBlueprintFieldPathLabel(entry.targetPath)),
    ))
    throw new Error(
      `patch 的字段路径未能应用到当前暂存蓝图：${targetLabels.join('、')}。`
      + '目标可能已被删除或不存在；请先调用 editor_get_staged_app_blueprint（detail="structure"）核对结构后重试。',
    )
  }
  return mergedFields
}

export const mergeBlueprintFieldsWithExisting = (
  nextFields: NocodeEditorAiAppBlueprintField[],
  currentFields: NocodeEditorAiAppBlueprintField[],
  deletionMatcher?: BlueprintFieldDeletionMatcher,
) => mergeBlueprintFieldsWithExistingInternal(nextFields, currentFields, { deletionMatcher })

export const mergeBlueprintFormWithExisting = (
  nextForm: NocodeEditorAiAppBlueprintForm,
  currentForm?: NocodeEditorAiAppBlueprintForm,
  options: BlueprintFieldMergeOptions = {},
): NocodeEditorAiAppBlueprintForm => {
  const currentFieldIdentityIndex = createBlueprintFieldIdentityIndex(
    Array.isArray(currentForm?.fields) ? currentForm.fields : [],
  )

  return {
    ...cloneValue(currentForm || {}),
    ...cloneValue(nextForm),
    formKey: String(nextForm.formKey || currentForm?.formKey || '').trim() || undefined,
    // patch 片段可能只带 formKey，不能让空表名覆盖暂存蓝图的表单身份。
    tableName: String(nextForm.tableName || currentForm?.tableName || '').trim(),
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
        options.deletionMatcher,
      )
      : nextForm.fields.map(field => mergeBlueprintFieldWithExisting(
        field,
        resolveBlueprintFieldIdentity(field, currentFieldIdentityIndex),
      )),
  }
}
