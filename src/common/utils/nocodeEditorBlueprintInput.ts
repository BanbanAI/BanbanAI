export const NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID = 'BLUEPRINT_INPUT_INVALID'
export const NOCODE_EDITOR_BLUEPRINT_FORMS_CONFLICT = 'BLUEPRINT_FORMS_CONFLICT'
export const NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE = 'BLUEPRINT_PLANNING_SCOPE_INCOMPLETE'
export const NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED = 'BLUEPRINT_REPLACE_NOT_AUTHORIZED'

type BlueprintFormLike = {
  formKey?: unknown
  tableName?: unknown
  name?: unknown
}

type BlueprintInputRecord = Record<string, unknown>

export type NocodeEditorBlueprintInputNormalizationResult =
  | {
      ok: true
      input: BlueprintInputRecord
      migratedTopLevelForms: boolean
    }
  | {
      ok: false
      code: typeof NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID | typeof NOCODE_EDITOR_BLUEPRINT_FORMS_CONFLICT
      message: string
    }

export type NocodeEditorBlueprintScopeValidationResult =
  | { ok: true }
  | {
      ok: false
      code: typeof NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE | typeof NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED
      message: string
      missingForms: Array<{
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

const normalizeForm = (value: BlueprintFormLike) => ({
  formKey: String(value?.formKey || '').trim(),
  tableName: String(value?.tableName || value?.name || '').trim(),
})

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

export const validateNocodeEditorBlueprintReplaceScope = (input: {
  updateMode?: unknown
  plannedForms?: BlueprintFormLike[] | null
  proposedForms?: BlueprintFormLike[] | null
  hasCurrentBlueprint?: boolean
  currentUserMessage?: unknown
}): NocodeEditorBlueprintScopeValidationResult => {
  if (String(input.updateMode || '').trim() !== 'replace') {
    return { ok: true }
  }

  const plannedForms = (Array.isArray(input.plannedForms) ? input.plannedForms : [])
    .map(normalizeForm)
    .filter(form => form.formKey || form.tableName)
  const proposedForms = (Array.isArray(input.proposedForms) ? input.proposedForms : [])
    .map(normalizeForm)
    .filter(form => form.formKey || form.tableName)
  const missingForms = plannedForms.filter(planned => (
    !proposedForms.some(proposed => isSameForm(planned, proposed))
  ))
  const explicitReplace = hasExplicitReplaceIntent(input.currentUserMessage)
  const explicitReduction = hasExplicitScopeReductionIntent(input.currentUserMessage)

  if (input.hasCurrentBlueprint && !explicitReplace && !explicitReduction) {
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

  if (missingForms.length && !explicitReduction) {
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
