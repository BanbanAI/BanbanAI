import {
  isSameNocodeEditorBlueprintFormName,
  normalizeNocodeEditorBlueprintIdentityToken,
  type NocodeEditorBlueprintFieldLike,
  type NocodeEditorBlueprintFormLike,
} from './nocodeEditorBlueprintFormNormalization'

type BlueprintSourceLike = Record<string, unknown>

const trimString = (value: unknown) => String(value || '').trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const hasSourceIdentity = (source: BlueprintSourceLike) => (
  Boolean(trimString(source.formKey))
  || Boolean(trimString(source.formName))
  || Boolean(trimString(source.fieldKey))
  || Boolean(trimString(source.fieldName))
)

const collectFields = (fields: NocodeEditorBlueprintFieldLike[] | undefined): NocodeEditorBlueprintFieldLike[] => {
  const collected: NocodeEditorBlueprintFieldLike[] = []
  const visit = (items: NocodeEditorBlueprintFieldLike[]) => {
    items.forEach((field) => {
      collected.push(field)
      visit(Array.isArray(field.children) ? field.children : [])
    })
  }
  visit(Array.isArray(fields) ? fields : [])
  return collected
}

const resolveSourceForm = (
  forms: NocodeEditorBlueprintFormLike[],
  source: BlueprintSourceLike,
) => {
  const formKey = trimString(source.formKey)
  if (formKey) {
    const byKey = forms.find(form => trimString(form.formKey) === formKey)
    if (byKey) {
      return byKey
    }
  }
  const formName = trimString(source.formName)
  if (formName) {
    return forms.find(form => isSameNocodeEditorBlueprintFormName(form.tableName, formName)) || null
  }
  return null
}

const resolveSourceField = (
  form: NocodeEditorBlueprintFormLike,
  source: BlueprintSourceLike,
) => {
  const fields = collectFields(form.fields)
  const fieldKey = trimString(source.fieldKey)
  if (fieldKey) {
    const byKey = fields.find(field => trimString(field.fieldKey) === fieldKey)
    if (byKey) {
      return byKey
    }
  }
  const fieldName = normalizeNocodeEditorBlueprintIdentityToken(source.fieldName)
  if (fieldName) {
    return fields.find(field => normalizeNocodeEditorBlueprintIdentityToken(field.name) === fieldName) || null
  }
  return null
}

const backfillSource = (
  source: unknown,
  forms: NocodeEditorBlueprintFormLike[],
): BlueprintSourceLike | undefined => {
  if (!isRecord(source) || !hasSourceIdentity(source)) {
    return source as BlueprintSourceLike | undefined
  }
  const form = resolveSourceForm(forms, source)
  const field = form ? resolveSourceField(form, source) : null
  const nextSource = { ...source }
  let changed = false
  if (form) {
    if (!trimString(nextSource.formName) && trimString(form.tableName)) {
      nextSource.formName = form.tableName
      changed = true
    }
    if (!trimString(nextSource.formKey) && trimString(form.formKey)) {
      nextSource.formKey = form.formKey
      changed = true
    }
  }
  if (field) {
    if (!trimString(nextSource.fieldName) && trimString(field.name)) {
      nextSource.fieldName = field.name
      changed = true
    }
    if (!trimString(nextSource.fieldKey) && trimString(field.fieldKey)) {
      nextSource.fieldKey = field.fieldKey
      changed = true
    }
  }
  return changed ? nextSource : source
}

const backfillFields = <TField extends NocodeEditorBlueprintFieldLike>(
  fields: TField[],
  forms: NocodeEditorBlueprintFormLike[],
): TField[] => {
  let changed = false
  const nextFields = fields.map((field) => {
    const nextSource = backfillSource(field.source, forms)
    const children = Array.isArray(field.children) ? field.children as TField[] : []
    const nextChildren = children.length ? backfillFields(children, forms) : children
    const sourceChanged = nextSource !== field.source
    const childrenChanged = nextChildren !== children
    if (!sourceChanged && !childrenChanged) {
      return field
    }
    changed = true
    return {
      ...field,
      ...(sourceChanged ? { source: nextSource } : {}),
      ...(childrenChanged ? { children: nextChildren } : {}),
    }
  })
  return changed ? nextFields : fields
}

/**
 * 字段 source 常只带 formKey（模型按规划键引用表单），或只带表名。
 * 展示、回读和后续 patch 都需要完整身份，这里用蓝图自身的表单把缺失的
 * formKey/formName、fieldKey/fieldName 补齐；只补空值，不覆盖模型已有选择。
 */
export const backfillNocodeEditorBlueprintSourceIdentities = <TBlueprint extends { forms?: unknown }>(
  blueprint: TBlueprint | null | undefined,
): TBlueprint | null | undefined => {
  if (!blueprint || !Array.isArray(blueprint.forms)) {
    return blueprint
  }
  const forms = blueprint.forms as NocodeEditorBlueprintFormLike[]
  let changed = false
  const nextForms = forms.map((form) => {
    const fields = Array.isArray(form.fields) ? form.fields : []
    const nextFields = backfillFields(fields, forms)
    if (nextFields === fields) {
      return form
    }
    changed = true
    return { ...form, fields: nextFields }
  })
  return changed ? { ...blueprint, forms: nextForms } : blueprint
}
