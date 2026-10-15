type MaybeString = string | null | undefined

export type NocodeEditorBlueprintFieldLike = {
  fieldKey?: string
  name?: string
  widgetType?: string
  description?: string
  required?: boolean
  placeholder?: string
  validationFormat?: string
  enumOptions?: any[]
  source?: Record<string, any>
  notes?: string[]
  children?: NocodeEditorBlueprintFieldLike[]
  [key: string]: any
}

export type NocodeEditorBlueprintFormLike = {
  formKey?: string
  tableName?: string
  groupName?: string
  description?: string
  fields?: NocodeEditorBlueprintFieldLike[]
  [key: string]: any
}

const trimString = (value: MaybeString) => String(value || '').trim()

const pickFirstNonEmpty = (...values: MaybeString[]) => values.find(value => Boolean(trimString(value)))

const pickFirstDefined = <T,>(...values: Array<T | undefined>) => values.find(value => value !== undefined)

const cloneArray = <T,>(value: T[] | undefined) => (Array.isArray(value) ? [...value] : undefined)

const cloneObject = <T extends Record<string, any> | undefined>(value: T) => (value ? { ...value } : undefined)

export const normalizeNocodeEditorBlueprintIdentityToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s\-_/\\]/g, '')
  .replace(/[，。、“”"'‘’；：？！【】[\]（）()<>]/g, '')

export const getNocodeEditorBlueprintFormIdentity = (form?: NocodeEditorBlueprintFormLike | null) => (
  trimString(form?.formKey) || normalizeNocodeEditorBlueprintIdentityToken(form?.tableName)
)

// formKey 相同即可确认同一表单；key 漂移时再以表名兜底，
// 避免同一张表因模型重新生成了 formKey 而被 patch 成并列副本。
export const isSameNocodeEditorBlueprintForm = (
  left?: NocodeEditorBlueprintFormLike | null,
  right?: NocodeEditorBlueprintFormLike | null,
) => {
  const leftFormKey = trimString(left?.formKey)
  const rightFormKey = trimString(right?.formKey)
  if (leftFormKey && rightFormKey && leftFormKey === rightFormKey) {
    return true
  }

  const leftGroupName = normalizeNocodeEditorBlueprintIdentityToken(left?.groupName)
  const rightGroupName = normalizeNocodeEditorBlueprintIdentityToken(right?.groupName)
  if (leftGroupName && rightGroupName && leftGroupName !== rightGroupName) {
    return false
  }

  const leftTableName = normalizeNocodeEditorBlueprintIdentityToken(left?.tableName)
  const rightTableName = normalizeNocodeEditorBlueprintIdentityToken(right?.tableName)
  return Boolean(leftTableName && rightTableName && leftTableName === rightTableName)
}

export const getNocodeEditorBlueprintFormApplyTargetIdentity = (form?: NocodeEditorBlueprintFormLike | null) => {
  const formKey = trimString(form?.formKey)
  if (formKey) {
    return formKey
  }

  const groupName = normalizeNocodeEditorBlueprintIdentityToken(form?.groupName)
  const tableName = normalizeNocodeEditorBlueprintIdentityToken(form?.tableName)
  if (!groupName && !tableName) {
    return ''
  }

  return `group:${groupName}|table:${tableName}`
}

export const getNocodeEditorBlueprintFieldIdentity = (field?: NocodeEditorBlueprintFieldLike | null) => (
  trimString(field?.fieldKey) || normalizeNocodeEditorBlueprintIdentityToken(field?.name)
)

// 两侧都有 fieldKey 时只按 key 判断；缺少任一 key 时才按字段名兜底。
export const isSameNocodeEditorBlueprintField = (
  left?: NocodeEditorBlueprintFieldLike | null,
  right?: NocodeEditorBlueprintFieldLike | null,
) => {
  const leftFieldKey = trimString(left?.fieldKey)
  const rightFieldKey = trimString(right?.fieldKey)
  if (leftFieldKey && rightFieldKey) {
    return leftFieldKey === rightFieldKey
  }

  const leftName = normalizeNocodeEditorBlueprintIdentityToken(left?.name)
  const rightName = normalizeNocodeEditorBlueprintIdentityToken(right?.name)
  return Boolean(leftName && rightName && leftName === rightName)
}

const shouldMergeForms = (
  currentForm: NocodeEditorBlueprintFormLike,
  nextForm: NocodeEditorBlueprintFormLike,
) => isSameNocodeEditorBlueprintForm(currentForm, nextForm)

const shouldMergeFields = (
  currentField: NocodeEditorBlueprintFieldLike,
  nextField: NocodeEditorBlueprintFieldLike,
) => isSameNocodeEditorBlueprintField(currentField, nextField)

const normalizeField = <TField extends NocodeEditorBlueprintFieldLike>(field: TField, children: TField[]): TField => ({
  ...field,
  fieldKey: trimString(field.fieldKey) || undefined,
  name: trimString(field.name) || '',
  widgetType: trimString(field.widgetType) || undefined,
  description: trimString(field.description) || undefined,
  placeholder: trimString(field.placeholder) || undefined,
  validationFormat: trimString(field.validationFormat) || undefined,
  enumOptions: cloneArray(field.enumOptions),
  source: cloneObject(field.source),
  notes: cloneArray(field.notes),
  children: children.length ? children : undefined,
})

const mergeField = <TField extends NocodeEditorBlueprintFieldLike>(
  currentField: TField,
  nextField: TField,
  nextChildren: TField[],
): TField => {
  const mergedChildren = mergeNocodeEditorBlueprintFields([
    ...((Array.isArray(currentField.children) ? currentField.children : []) as TField[]),
    ...nextChildren,
  ])

  return {
    ...currentField,
    ...nextField,
    fieldKey: pickFirstNonEmpty(currentField.fieldKey, nextField.fieldKey) || undefined,
    name: pickFirstNonEmpty(currentField.name, nextField.name) || '',
    widgetType: pickFirstNonEmpty(currentField.widgetType, nextField.widgetType) || undefined,
    description: pickFirstNonEmpty(currentField.description, nextField.description) || undefined,
    required: pickFirstDefined(currentField.required, nextField.required),
    placeholder: pickFirstNonEmpty(currentField.placeholder, nextField.placeholder) || undefined,
    validationFormat: pickFirstNonEmpty(currentField.validationFormat, nextField.validationFormat) || undefined,
    enumOptions: cloneArray(pickFirstDefined(currentField.enumOptions, nextField.enumOptions)),
    source: cloneObject(pickFirstDefined(currentField.source, nextField.source)),
    notes: cloneArray(pickFirstDefined(currentField.notes, nextField.notes)),
    children: mergedChildren.length ? mergedChildren : undefined,
  }
}

export const mergeNocodeEditorBlueprintFields = <TField extends NocodeEditorBlueprintFieldLike>(
  fields: TField[] | null | undefined,
): TField[] => {
  const mergedFields: TField[] = []

  for (const field of Array.isArray(fields) ? fields : []) {
    const normalizedChildren = mergeNocodeEditorBlueprintFields(field.children as TField[] | undefined)
    const normalizedField = normalizeField(field, normalizedChildren)
    const existingIndex = mergedFields.findIndex(currentField => shouldMergeFields(currentField, normalizedField))

    if (existingIndex < 0) {
      mergedFields.push(normalizedField)
      continue
    }

    mergedFields[existingIndex] = mergeField(mergedFields[existingIndex], normalizedField, normalizedChildren)
  }

  return mergedFields
}

export const mergeNocodeEditorBlueprintForms = <TForm extends NocodeEditorBlueprintFormLike>(
  forms: TForm[] | null | undefined,
): TForm[] => {
  const mergedForms: TForm[] = []

  for (const form of Array.isArray(forms) ? forms : []) {
    const normalizedFields = mergeNocodeEditorBlueprintFields(form.fields)
    const existingIndex = mergedForms.findIndex(currentForm => shouldMergeForms(currentForm, form))

    if (existingIndex < 0) {
      mergedForms.push({
        ...form,
        formKey: trimString(form.formKey) || undefined,
        tableName: trimString(form.tableName) || '',
        groupName: pickFirstNonEmpty(form.groupName) || undefined,
        description: pickFirstNonEmpty(form.description) || undefined,
        fields: normalizedFields,
      })
      continue
    }

    const currentForm = mergedForms[existingIndex]
    mergedForms[existingIndex] = {
      ...currentForm,
      ...form,
      formKey: pickFirstNonEmpty(currentForm.formKey, form.formKey) || undefined,
      tableName: pickFirstNonEmpty(currentForm.tableName, form.tableName) || '',
      groupName: pickFirstNonEmpty(currentForm.groupName, form.groupName) || undefined,
      description: pickFirstNonEmpty(currentForm.description, form.description) || undefined,
      fields: mergeNocodeEditorBlueprintFields([
        ...((Array.isArray(currentForm.fields) ? currentForm.fields : []) as NocodeEditorBlueprintFieldLike[]),
        ...normalizedFields,
      ]) as TForm['fields'],
    }
  }

  return mergedForms
}

export const mergeSingleFormBlueprintFragments = mergeNocodeEditorBlueprintForms
