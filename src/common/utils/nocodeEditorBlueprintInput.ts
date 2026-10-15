export const NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID = 'BLUEPRINT_INPUT_INVALID'
export const NOCODE_EDITOR_BLUEPRINT_FORMS_CONFLICT = 'BLUEPRINT_FORMS_CONFLICT'
export const NOCODE_EDITOR_BLUEPRINT_IDENTITY_CONFLICT = 'BLUEPRINT_IDENTITY_CONFLICT'
export const NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE = 'BLUEPRINT_PLANNING_SCOPE_INCOMPLETE'
export const NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED = 'BLUEPRINT_REPLACE_NOT_AUTHORIZED'
export const NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS = 'BLUEPRINT_PLANNING_SCOPE_EXTRA_FORMS'

type BlueprintFormLike = {
  formKey?: unknown
  tableName?: unknown
  name?: unknown
}

export type NocodeEditorBlueprintFormIdentityLike = BlueprintFormLike

type BlueprintInputRecord = Record<string, unknown>

export type NocodeEditorBlueprintInputNormalizationResult =
  | {
      ok: true
      input: BlueprintInputRecord
      migratedTopLevelForms: boolean
    }
  | {
      ok: false
      code: typeof NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID
        | typeof NOCODE_EDITOR_BLUEPRINT_FORMS_CONFLICT
        | typeof NOCODE_EDITOR_BLUEPRINT_IDENTITY_CONFLICT
      message: string
    }

export type NocodeEditorBlueprintScopeValidationResult =
  | { ok: true }
  | {
      ok: false
      code: typeof NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE | typeof NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED
        | typeof NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS
      message: string
      missingForms: Array<{
        formKey?: string
        tableName: string
      }>
      unexpectedForms?: Array<{
        formKey?: string
        tableName: string
      }>
    }

const isRecord = (value: unknown): value is BlueprintInputRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const hasOwn = (value: BlueprintInputRecord, key: string) => (
  Object.prototype.hasOwnProperty.call(value, key)
)

const normalizeForComparison = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeForComparison)
  }
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeForComparison(value[key])
        return result
      }, {})
  }
  return value
}

const areFormsEqual = (left: unknown[], right: unknown[]) => (
  JSON.stringify(normalizeForComparison(left)) === JSON.stringify(normalizeForComparison(right))
)

const BLUEPRINT_TOOL_CONTROL_KEYS = new Set([
  'updateMode',
  'deletedFormKeys',
  'deletedFields',
  'latestCompletedPlanningConfirmation',
  'latestCompletedBlueprintConfirmation',
  'planningContinuation',
  'planningCarryover',
  '__currentUserMessage',
])

export const normalizeNocodeEditorBlueprintToolInput = (
  value: unknown,
): NocodeEditorBlueprintInputNormalizationResult => {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID,
      message: '蓝图参数必须是对象，并在 blueprint.forms 中提供表单列表。',
    }
  }

  const input = { ...value }
  const hasBlueprint = hasOwn(input, 'blueprint')
  if (hasBlueprint && !isRecord(input.blueprint)) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID,
      message: 'blueprint 必须是对象，并在 blueprint.forms 中提供表单列表。',
    }
  }

  const blueprint = hasBlueprint && isRecord(input.blueprint)
    ? { ...input.blueprint }
    : {}
  const hasNestedForms = hasOwn(blueprint, 'forms')
  const hasTopLevelForms = hasOwn(input, 'forms')
  const nestedForms = blueprint.forms
  const topLevelForms = input.forms

  if (hasNestedForms && !Array.isArray(nestedForms)) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID,
      message: 'blueprint.forms 必须是数组。',
    }
  }
  if (hasTopLevelForms && !Array.isArray(topLevelForms)) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID,
      message: '顶层 forms 无法兼容迁移，请改为 blueprint.forms 数组。',
    }
  }
  if (
    Array.isArray(nestedForms)
    && Array.isArray(topLevelForms)
    && !areFormsEqual(nestedForms, topLevelForms)
  ) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_FORMS_CONFLICT,
      message: '顶层 forms 与 blueprint.forms 内容冲突，请只保留唯一的 blueprint.forms。',
    }
  }

  const forms = Array.isArray(nestedForms)
    ? nestedForms
    : Array.isArray(topLevelForms)
      ? topLevelForms
      : null
  if (!forms) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID,
      message: '缺少 blueprint.forms，请在 blueprint 对象中提供完整表单列表。',
    }
  }

  const identityConflict = findBlueprintIdentityConflict(forms)
  if (identityConflict) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_IDENTITY_CONFLICT,
      message: identityConflict,
    }
  }

  delete input.forms
  if (!Array.isArray(nestedForms) && Array.isArray(topLevelForms)) {
    const migratedBlueprint: BlueprintInputRecord = { ...blueprint }
    for (const [key, value] of Object.entries(input)) {
      if (
        !BLUEPRINT_TOOL_CONTROL_KEYS.has(key)
        && key !== 'forms'
        && key !== 'blueprint'
      ) {
        migratedBlueprint[key] = value
        delete input[key]
      }
    }
    input.blueprint = migratedBlueprint
  }
  input.blueprint = {
    ...(isRecord(input.blueprint) ? input.blueprint : {}),
    ...blueprint,
    forms,
  }
  return {
    ok: true,
    input,
    migratedTopLevelForms: !Array.isArray(nestedForms) && Array.isArray(topLevelForms),
  }
}

export const normalizeNocodeEditorBlueprintFormIdentity = (value: unknown) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\]+/g, '')
)

const findBlueprintIdentityConflict = (forms: unknown[]) => {
  const formKeysByTableName = new Map<string, string>()

  for (const value of forms) {
    if (!isRecord(value)) {
      continue
    }
    const tableName = normalizeNocodeEditorBlueprintFormIdentity(value.tableName || value.name)
    const formKey = String(value.formKey || '').trim()
    if (tableName && formKey) {
      const existingFormKey = formKeysByTableName.get(tableName)
      if (existingFormKey && existingFormKey !== formKey) {
        return `表名「${String(value.tableName || value.name || '').trim()}」对应多个不同的 formKey，请统一表单身份后重试。`
      }
      formKeysByTableName.set(tableName, formKey)
    }

    const conflict = findBlueprintFieldIdentityConflict(value.fields)
    if (conflict) {
      return `表单「${String(value.tableName || value.name || '').trim()}」${conflict}`
    }
  }

  return ''
}

const findBlueprintFieldIdentityConflict = (fields: unknown): string => {
  if (!Array.isArray(fields)) {
    return ''
  }

  const fieldKeysByName = new Map<string, string>()
  for (const value of fields) {
    if (!isRecord(value)) {
      continue
    }
    const name = normalizeNocodeEditorBlueprintFormIdentity(value.name)
    const fieldKey = String(value.fieldKey || '').trim()
    if (name && fieldKey) {
      const existingFieldKey = fieldKeysByName.get(name)
      if (existingFieldKey && existingFieldKey !== fieldKey) {
        return `字段名「${String(value.name || '').trim()}」对应多个不同的 fieldKey，请统一字段身份后重试。`
      }
      fieldKeysByName.set(name, fieldKey)
    }

    const childConflict = findBlueprintFieldIdentityConflict(value.children)
    if (childConflict) {
      return childConflict
    }
  }

  return ''
}

const normalizeForm = (value: BlueprintFormLike) => ({
  formKey: String(value?.formKey || '').trim(),
  tableName: String(value?.tableName || value?.name || '').trim(),
})

/**
 * 规划阶段与蓝图阶段都可能由模型生成 formKey。表名唯一时，规划中的
 * formKey 才是当前任务的稳定身份；把它回填到蓝图表单可以避免模型临时
 * 生成的别名触发范围校验，而不会放宽同名多表单的身份约束。
 */
export const alignNocodeEditorBlueprintFormIdentities = <TForm extends NocodeEditorBlueprintFormIdentityLike>(
  plannedForms: readonly NocodeEditorBlueprintFormIdentityLike[] | null | undefined,
  proposedForms: readonly TForm[] | null | undefined,
): TForm[] => {
  const plannedByTableName = new Map<string, NocodeEditorBlueprintFormIdentityLike[]>()
  for (const form of Array.isArray(plannedForms) ? plannedForms : []) {
    const tableName = normalizeNocodeEditorBlueprintFormIdentity(
      isRecord(form) ? form.tableName || form.name : '',
    )
    if (!tableName) {
      continue
    }
    const entries = plannedByTableName.get(tableName) || []
    entries.push(form)
    plannedByTableName.set(tableName, entries)
  }

  const proposedByTableName = new Map<string, number>()
  for (const form of Array.isArray(proposedForms) ? proposedForms : []) {
    const tableName = normalizeNocodeEditorBlueprintFormIdentity(
      isRecord(form) ? form.tableName || form.name : '',
    )
    if (tableName) {
      proposedByTableName.set(tableName, (proposedByTableName.get(tableName) || 0) + 1)
    }
  }

  return (Array.isArray(proposedForms) ? proposedForms : []).map((form) => {
    const tableName = normalizeNocodeEditorBlueprintFormIdentity(
      isRecord(form) ? form.tableName || form.name : '',
    )
    const candidates = tableName ? plannedByTableName.get(tableName) || [] : []
    if (candidates.length !== 1 || proposedByTableName.get(tableName) !== 1) {
      return form
    }

    const plannedForm = candidates[0]
    const plannedFormKey = String(plannedForm?.formKey || '').trim()
    if (!plannedFormKey || !isRecord(form)) {
      return form
    }

    if (String(form.formKey || '').trim() === plannedFormKey) {
      return form
    }

    return {
      ...form,
      formKey: plannedFormKey,
    }
  })
}

const isSameForm = (left: ReturnType<typeof normalizeForm>, right: ReturnType<typeof normalizeForm>) => {
  if (left.formKey && right.formKey) {
    return left.formKey === right.formKey
  }
  const leftName = normalizeNocodeEditorBlueprintFormIdentity(left.tableName)
  const rightName = normalizeNocodeEditorBlueprintFormIdentity(right.tableName)
  return Boolean(leftName && rightName && leftName === rightName)
}

const hasExplicitReplaceIntent = (value: unknown) => {
  const text = String(value || '').replace(/\s+/g, '')
  if (!text) return false
  return /(重做|重新生成|重新搭建|从头开始|整体替换|替换蓝图|覆盖蓝图)/u.test(text)
}

const hasExplicitScopeReductionIntent = (value: unknown) => {
  const text = String(value || '').replace(/\s+/g, '')
  if (!text) return false
  return /(?:只|仅)(?:保留|搭建|生成|重做)|删除.{0,40}(?:表|表单|模块)|移除.{0,40}(?:表|表单|模块)|缩小(?:规划)?范围|精简(?:规划)?范围/u.test(text)
}

const hasExplicitFormAdditionIntent = (value: unknown, formName: string) => {
  const text = String(value || '').replace(/\s+/g, '')
  const name = String(formName || '').replace(/\s+/g, '')
  if (!text || !name) return false
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`(?:不|别|勿|禁止|无需|不要|不需要)(?:再)?(?:新增|添加|增加|创建|补充|再建|新建)(?:一[个张份]|[个张份]|新的)?(?:名为|叫做)?${escapedName}`, 'u').test(text)) {
    return false
  }
  return new RegExp(`(?:新增|添加|增加|创建|补充|再建|新建)(?:一[个张份]|[个张份]|新的)?(?:名为|叫做)?${escapedName}`, 'u').test(text)
}

export const validateNocodeEditorBlueprintReplaceScope = (input: {
  updateMode?: unknown
  plannedForms?: BlueprintFormLike[] | null
  proposedForms?: BlueprintFormLike[] | null
  currentForms?: BlueprintFormLike[] | null
  hasCurrentBlueprint?: boolean
  currentUserMessage?: unknown
}): NocodeEditorBlueprintScopeValidationResult => {
  const updateMode = String(input.updateMode || '').trim()
  if (updateMode !== 'replace' && updateMode !== 'patch') {
    return { ok: true }
  }

  const plannedForms = (Array.isArray(input.plannedForms) ? input.plannedForms : [])
    .map(normalizeForm)
    .filter(form => form.formKey || form.tableName)
  const proposedForms = (Array.isArray(input.proposedForms) ? input.proposedForms : [])
    .map(normalizeForm)
    .filter(form => form.formKey || form.tableName)
  const currentForms = (Array.isArray(input.currentForms) ? input.currentForms : [])
    .map(normalizeForm)
    .filter(form => form.formKey || form.tableName)
  const missingForms = plannedForms.filter(planned => (
    !proposedForms.some(proposed => isSameForm(planned, proposed))
  ))
  const explicitReplace = hasExplicitReplaceIntent(input.currentUserMessage)
  const explicitReduction = hasExplicitScopeReductionIntent(input.currentUserMessage)
  const knownForms = updateMode === 'patch'
    ? [...currentForms, ...plannedForms]
    : plannedForms
  const unexpectedForms = proposedForms.filter(proposed => (
    knownForms.length > 0
    && !knownForms.some(known => isSameForm(known, proposed))
  ))

  const unauthorizedForms = unexpectedForms.filter(form => (
    !hasExplicitFormAdditionIntent(input.currentUserMessage, form.tableName)
  ))
  if (unauthorizedForms.length) {
    const unexpectedLabels = unauthorizedForms.map(form => form.tableName || form.formKey).filter(Boolean)
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS,
      message: `蓝图新增了未在当前规划范围中的表单：${unexpectedLabels.join('、')}。请先更新表单规划范围；如果这些内容只是字段分组、流程或看板，不要放入 blueprint.forms。`,
      missingForms: missingForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
      unexpectedForms: unauthorizedForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
    }
  }

  if (updateMode === 'replace' && input.hasCurrentBlueprint && !explicitReplace && !explicitReduction) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED,
      message: '当前已有暂存蓝图，本轮用户没有明确要求重做、整体替换或缩小范围。请使用 updateMode=patch 进行局部修改。',
      missingForms: missingForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
    }
  }

  if (updateMode === 'replace' && missingForms.length && !explicitReduction) {
    const missingLabels = missingForms.map(form => form.formKey || form.tableName).filter(Boolean)
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE,
      message: `replace 蓝图缺少已规划表单：${missingLabels.join('、')}。请按已确认范围重新生成完整 blueprint.forms；若用户确实要求缩小范围，需先取得明确指令。`,
      missingForms: missingForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
    }
  }

  return { ok: true }
}
