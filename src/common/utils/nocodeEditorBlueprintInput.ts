import { isSamePlanningConfirmationContext } from './nocodeEditorPlanningConfirmationIdentity'

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
  fields?: unknown
}

type BlueprintFieldSourceLike = {
  formKey?: unknown
  formName?: unknown
  tableName?: unknown
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

export type NocodeEditorBlueprintScopeFormIdentity = {
  formKey?: string
  tableName: string
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
      plannedForms?: NocodeEditorBlueprintScopeFormIdentity[]
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
  '__currentTurnTraceId',
])

const hasNonEmptyStringList = (value: unknown) => (
  Array.isArray(value) && value.some(item => String(item || '').trim())
)

// 删除清单本身就能构成一次完整的 patch 指令，不要求再回传未修改的 blueprint.forms。
const hasBlueprintDeletionIntent = (input: BlueprintInputRecord) => (
  hasNonEmptyStringList(input.deletedFormKeys)
  || (
    Array.isArray(input.deletedFields)
    && input.deletedFields.some(item => (
      isRecord(item)
      && String(item.formKey || '').trim()
      && hasNonEmptyStringList(item.fieldKeys)
    ))
  )
)

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
  const isDeletionOnlyPatch = (
    !forms
    && String(input.updateMode || '').trim() === 'patch'
    && hasBlueprintDeletionIntent(input)
  )
  if (!forms && !isDeletionOnlyPatch) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_INPUT_INVALID,
      message: '缺少 blueprint.forms，请在 blueprint 对象中提供表单列表；仅删除表单或字段时，patch 模式可以只传 deletedFormKeys / deletedFields。',
    }
  }
  const normalizedForms = forms || []

  const identityConflict = findBlueprintIdentityConflict(normalizedForms)
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
    forms: normalizedForms,
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

// 规划与蓝图常出现“客户信息表 / 客户信息”这类后缀差；只在唯一匹配时作为兜底，
// 精确身份（formKey、同名表）始终优先。
const stripBlueprintFormNameSuffix = (value: string) => value.replace(/(?:表单|表)$/u, '')

const isSameBlueprintFormName = (left: string, right: string) => {
  if (!left || !right) {
    return false
  }
  if (left === right) {
    return true
  }
  const leftBase = stripBlueprintFormNameSuffix(left)
  const rightBase = stripBlueprintFormNameSuffix(right)
  return Boolean(leftBase && leftBase === rightBase)
}

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
  fields: Array.isArray(value?.fields) ? value.fields : [],
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
    const tableName = stripBlueprintFormNameSuffix(normalizeNocodeEditorBlueprintFormIdentity(
      isRecord(form) ? form.tableName || form.name : '',
    ))
    if (!tableName) {
      continue
    }
    const entries = plannedByTableName.get(tableName) || []
    entries.push(form)
    plannedByTableName.set(tableName, entries)
  }

  const proposedByTableName = new Map<string, number>()
  for (const form of Array.isArray(proposedForms) ? proposedForms : []) {
    const tableName = stripBlueprintFormNameSuffix(normalizeNocodeEditorBlueprintFormIdentity(
      isRecord(form) ? form.tableName || form.name : '',
    ))
    if (tableName) {
      proposedByTableName.set(tableName, (proposedByTableName.get(tableName) || 0) + 1)
    }
  }

  return (Array.isArray(proposedForms) ? proposedForms : []).map((form) => {
    const tableName = stripBlueprintFormNameSuffix(normalizeNocodeEditorBlueprintFormIdentity(
      isRecord(form) ? form.tableName || form.name : '',
    ))
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
  return isSameBlueprintFormName(
    normalizeNocodeEditorBlueprintFormIdentity(left.tableName),
    normalizeNocodeEditorBlueprintFormIdentity(right.tableName),
  )
}

/**
 * 返回本次蓝图范围校验可用的“已规划表单”。
 * 规划确认、自动续跑、或规划与蓝图同处一个用户回合都算生效；
 * 其他历史规划不参与范围校验，避免拦截无关新表单。
 */
export const resolveNocodeEditorBlueprintScopePlannedForms = (input: {
  outlineForms?: readonly NocodeEditorBlueprintFormIdentityLike[] | null
  hasCompletedPlanningConfirmation?: boolean
  hasPlanningContinuationAutoContinue?: boolean
  planningOutlineStagedInCurrentTurn?: boolean
  sourcePlanningContextKey?: string | null
  currentPlanningContextKey?: string | null
}): NocodeEditorBlueprintFormIdentityLike[] => {
  const forms = Array.isArray(input.outlineForms) ? [...input.outlineForms] : []
  if (!forms.length) {
    return []
  }
  const planningChainActive = Boolean(
    input.hasCompletedPlanningConfirmation
    || input.hasPlanningContinuationAutoContinue
    || input.planningOutlineStagedInCurrentTurn,
  )
  if (!planningChainActive) {
    return []
  }
  const sourceKey = String(input.sourcePlanningContextKey || '').trim()
  const currentKey = String(input.currentPlanningContextKey || '').trim()
  if (sourceKey && currentKey && !isSamePlanningConfirmationContext(sourceKey, currentKey)) {
    return []
  }
  return forms
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

const normalizeSourceFormIdentity = (value: unknown) => {
  const source = isRecord(value) ? value as BlueprintFieldSourceLike : null
  return {
    formKey: String(source?.formKey || '').trim(),
    tableName: String(source?.formName || source?.tableName || '').trim(),
  }
}

const collectBlueprintFieldSources = (value: unknown): Array<{ formKey: string; tableName: string }> => {
  if (!Array.isArray(value)) {
    return []
  }
  const sources: Array<{ formKey: string; tableName: string }> = []
  const visit = (fields: unknown[]) => {
    for (const field of fields) {
      if (!isRecord(field)) {
        continue
      }
      const source = normalizeSourceFormIdentity(field.source)
      if (source.formKey || source.tableName) {
        sources.push(source)
      }
      visit(Array.isArray(field.children) ? field.children : [])
    }
  }
  visit(value)
  return sources
}

const matchesFormIdentity = (
  left: { formKey?: string; tableName?: string },
  right: { formKey?: string; tableName?: string },
) => {
  const leftKey = String(left.formKey || '').trim()
  const rightKey = String(right.formKey || '').trim()
  if (leftKey && rightKey && leftKey === rightKey) {
    return true
  }
  const leftName = normalizeNocodeEditorBlueprintFormIdentity(left.tableName)
  const rightName = normalizeNocodeEditorBlueprintFormIdentity(right.tableName)
  return isSameBlueprintFormName(leftName, rightName)
}

// 额外表单只有在被已规划主表的字段 source 实际引用时才允许进入蓝图；
// 用结构关系替代“用户是否说了新增某表”的措辞判断。
const isReferencedByKnownFormSource = (input: {
  target: ReturnType<typeof normalizeForm>
  sourceForms: Array<ReturnType<typeof normalizeForm>>
  knownForms: Array<ReturnType<typeof normalizeForm>>
}) => input.sourceForms.some((sourceForm) => {
  if (matchesFormIdentity(sourceForm, input.target)) {
    return false
  }
  if (!input.knownForms.some(known => matchesFormIdentity(known, sourceForm))) {
    return false
  }
  return collectBlueprintFieldSources(sourceForm.fields)
    .some(source => matchesFormIdentity(source, input.target))
})

// 用户切换到另一张与暂存蓝图完全无关的新表单时，这是新蓝图范围而不是“覆盖当前蓝图”，
// 不能仅凭“存在暂存蓝图”要求重做/替换类措辞；有共同表单（同 formKey 或同表名）才算覆盖。
const startsUnrelatedBlueprintScope = (
  proposedForms: Array<ReturnType<typeof normalizeForm>>,
  currentForms: Array<ReturnType<typeof normalizeForm>>,
) => (
  proposedForms.length > 0
  && !proposedForms.some(proposed => (
    currentForms.some(current => matchesFormIdentity(proposed, current))
  ))
)

const describeBlueprintScopeForms = (
  forms: readonly NocodeEditorBlueprintScopeFormIdentity[],
) => forms
  .map((form) => {
    if (!form.tableName) {
      return form.formKey || ''
    }
    return form.formKey ? `${form.tableName}（formKey=${form.formKey}）` : form.tableName
  })
  .filter(Boolean)
  .join('；')

const toBlueprintScopeFormIdentities = (
  forms: Array<ReturnType<typeof normalizeForm>>,
): NocodeEditorBlueprintScopeFormIdentity[] => forms.map(form => ({
  formKey: form.formKey || undefined,
  tableName: form.tableName,
}))

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

  // patch 模式下，当前暂存蓝图里已经存在的 source 也可作为关联依据：
  // 模型可能只补交新增表，而不重复提交未变化的主表字段。
  const sourceForms = updateMode === 'patch'
    ? [...proposedForms, ...currentForms]
    : proposedForms
  const unauthorizedForms = unexpectedForms.filter(form => (
    !isReferencedByKnownFormSource({
      target: form,
      sourceForms,
      knownForms,
    })
  ))
  if (unauthorizedForms.length) {
    const unexpectedLabels = unauthorizedForms.map(form => form.tableName || form.formKey).filter(Boolean)
    const plannedFormIdentities = toBlueprintScopeFormIdentities(plannedForms)
    const plannedHints = describeBlueprintScopeForms(plannedFormIdentities)
    const plannedHint = plannedHints
      ? `当前已规划表单（必须复用同一 formKey 和表名）：${plannedHints}。请复用这些身份修正 blueprint.forms，并以 updateMode=replace 重新提交完整蓝图；不要重新打开规划。`
      : ''
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS,
      message: `蓝图新增了未在当前规划范围中的表单：${unexpectedLabels.join('、')}。${plannedHint}额外独立表单必须被当前主表字段的 source 实际指向（source.formKey 或 source.formName），并保留已规划主表；请在主表字段中补充关联来源，否则不要加入该表单。不要为此重新开启规划或升级为应用级规划。如果这些内容只是字段分组、流程或看板，不要放入 blueprint.forms。`,
      missingForms: missingForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
      unexpectedForms: unauthorizedForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
      plannedForms: plannedFormIdentities,
    }
  }

  const newBlueprintScope = startsUnrelatedBlueprintScope(proposedForms, currentForms)
  if (
    updateMode === 'replace'
    && input.hasCurrentBlueprint
    && !explicitReplace
    && !explicitReduction
    && !newBlueprintScope
  ) {
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED,
      message: '当前已有暂存蓝图，本轮蓝图与暂存蓝图包含相同表单，但用户没有明确要求重做、整体替换或缩小范围。请使用 updateMode=patch 进行局部修改。',
      missingForms: missingForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
      plannedForms: toBlueprintScopeFormIdentities(plannedForms),
    }
  }

  if (updateMode === 'replace' && missingForms.length && !explicitReduction) {
    const plannedFormIdentities = toBlueprintScopeFormIdentities(plannedForms)
    return {
      ok: false,
      code: NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE,
      message: `replace 蓝图缺少已规划表单：${describeBlueprintScopeForms(toBlueprintScopeFormIdentities(missingForms))}。当前已规划表单（必须复用同一 formKey 和表名）：${describeBlueprintScopeForms(plannedFormIdentities)}。请按已确认范围重新生成完整 blueprint.forms；若用户确实要求缩小范围，需先取得明确指令。`,
      missingForms: missingForms.map(form => ({
        formKey: form.formKey || undefined,
        tableName: form.tableName,
      })),
      plannedForms: plannedFormIdentities,
    }
  }

  return { ok: true }
}
