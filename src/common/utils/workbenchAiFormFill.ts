export const WORKBENCH_AI_FILL_CURRENT_FORM_TOOL = 'fill_current_form'

export type WorkbenchAiFormFillWriteMode = 'fill_empty' | 'replace'
export type WorkbenchAiFormMode = 'add' | 'edit'

export type WorkbenchAiFormFillOption = {
  label: string
  value: string
}

export type WorkbenchAiFormFillFieldContext = {
  id: string
  name: string
  type: string
  required?: boolean
  hasValue?: boolean
  options?: WorkbenchAiFormFillOption[]
  children?: WorkbenchAiFormFillFieldContext[]
  rows?: WorkbenchAiFormFillSubformRowContext[]
}

export type WorkbenchAiFormFillSubformRowContext = {
  rowToken: string
  fields: WorkbenchAiFormFillFieldContext[]
}

export type WorkbenchAiUnsupportedFormFillField = {
  id: string
  name: string
  type: string
  reason: string
}

export type WorkbenchAiFormFillContextSnapshot = {
  contextId: string
  appId: string
  appName?: string
  tableId: string
  tableName?: string
  formMode: WorkbenchAiFormMode
  fields: WorkbenchAiFormFillFieldContext[]
  unsupportedFields?: WorkbenchAiUnsupportedFormFillField[]
}

export type WorkbenchAiFormFillFieldInput = {
  fieldId: string
  value: unknown
  writeMode?: WorkbenchAiFormFillWriteMode
}

export type WorkbenchAiFormFillSubformRowInput = {
  rowToken?: string
  fields: WorkbenchAiFormFillFieldInput[]
}

export type WorkbenchAiFormFillSubformInput = {
  fieldId: string
  operation?: 'append_rows' | 'update_rows'
  rows: WorkbenchAiFormFillSubformRowInput[]
}

export type WorkbenchAiFormFillToolInput = {
  contextId?: string
  fields?: WorkbenchAiFormFillFieldInput[]
  subforms?: WorkbenchAiFormFillSubformInput[]
}

export type WorkbenchAiFormFillIssue = {
  fieldId?: string
  fieldName?: string
  reason: string
  candidates?: Array<{ label: string; value: string }>
}

export type WorkbenchAiFormFillResult = {
  tool: typeof WORKBENCH_AI_FILL_CURRENT_FORM_TOOL
  status: 'applied' | 'partial' | 'not_applied'
  contextId: string
  operationId?: string
  appliedFieldIds: string[]
  appliedFieldNames: string[]
  skipped: WorkbenchAiFormFillIssue[]
  unresolved: WorkbenchAiFormFillIssue[]
  requiresUserSubmit: true
  summary: string
}

export type WorkbenchAiFormFillUndoResult = {
  status: 'undone' | 'partial' | 'not_available'
  operationId?: string
  restoredFieldNames: string[]
  preservedFieldNames: string[]
  summary: string
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeFieldContext = (value: unknown): WorkbenchAiFormFillFieldContext | null => {
  if (!isPlainObject(value)) return null
  const id = normalizeText(value.id)
  const name = normalizeText(value.name)
  const type = normalizeText(value.type)
  if (!id || !name || !type) return null

  const options = Array.isArray(value.options)
    ? value.options.map((item): WorkbenchAiFormFillOption | null => {
      if (!isPlainObject(item)) return null
      const label = normalizeText(item.label)
      const optionValue = normalizeText(item.value)
      return label && optionValue ? { label, value: optionValue } : null
    }).filter((item): item is WorkbenchAiFormFillOption => Boolean(item))
    : []
  const children = Array.isArray(value.children)
    ? value.children.map(normalizeFieldContext).filter((item): item is WorkbenchAiFormFillFieldContext => Boolean(item))
    : []
  const childIds = new Set(children.map(child => child.id))
  const rows = children.length && Array.isArray(value.rows)
    ? value.rows.map((item): WorkbenchAiFormFillSubformRowContext | null => {
      if (!isPlainObject(item)) return null
      const rowToken = normalizeText(item.rowToken)
      const fields = Array.isArray(item.fields)
        ? item.fields.map(normalizeFieldContext)
          .filter((field): field is WorkbenchAiFormFillFieldContext => Boolean(field && childIds.has(field.id)))
        : []
      return rowToken && fields.length ? { rowToken, fields } : null
    }).filter((item): item is WorkbenchAiFormFillSubformRowContext => Boolean(item))
    : []

  return {
    id,
    name,
    type,
    ...(typeof value.required === 'boolean' ? { required: value.required } : {}),
    ...(typeof value.hasValue === 'boolean' ? { hasValue: value.hasValue } : {}),
    ...(options.length ? { options } : {}),
    ...(children.length ? { children } : {}),
    ...(rows.length ? { rows } : {}),
  }
}

export const normalizeWorkbenchAiFormFillContext = (
  value: unknown,
): WorkbenchAiFormFillContextSnapshot | null => {
  if (!isPlainObject(value)) return null
  const contextId = normalizeText(value.contextId)
  const appId = normalizeText(value.appId)
  const tableId = normalizeText(value.tableId)
  const formMode = normalizeText(value.formMode)
  const fields = Array.isArray(value.fields)
    ? value.fields.map(normalizeFieldContext).filter((item): item is WorkbenchAiFormFillFieldContext => Boolean(item))
    : []
  if (!contextId || !appId || !tableId || !fields.length || (formMode !== 'add' && formMode !== 'edit')) {
    return null
  }

  const unsupportedFields = Array.isArray(value.unsupportedFields)
    ? value.unsupportedFields.map((item): WorkbenchAiUnsupportedFormFillField | null => {
      if (!isPlainObject(item)) return null
      const id = normalizeText(item.id)
      const name = normalizeText(item.name)
      const type = normalizeText(item.type)
      const reason = normalizeText(item.reason)
      return id && name && type && reason ? { id, name, type, reason } : null
    }).filter((item): item is WorkbenchAiUnsupportedFormFillField => Boolean(item))
    : []

  return {
    contextId,
    appId,
    ...(normalizeText(value.appName) ? { appName: normalizeText(value.appName) } : {}),
    tableId,
    ...(normalizeText(value.tableName) ? { tableName: normalizeText(value.tableName) } : {}),
    formMode,
    fields,
    ...(unsupportedFields.length ? { unsupportedFields } : {}),
  }
}

const normalizeFieldInput = (value: unknown): WorkbenchAiFormFillFieldInput | null => {
  if (!isPlainObject(value)) return null
  const fieldId = normalizeText(value.fieldId)
  if (!fieldId || !Object.prototype.hasOwnProperty.call(value, 'value')) return null
  const writeMode = normalizeText(value.writeMode)
  return {
    fieldId,
    value: value.value,
    ...(writeMode === 'replace' ? { writeMode: 'replace' } : { writeMode: 'fill_empty' }),
  }
}

export const normalizeWorkbenchAiFormFillToolInput = (
  value: unknown,
  context: WorkbenchAiFormFillContextSnapshot,
): WorkbenchAiFormFillToolInput | null => {
  if (!isPlainObject(value)) return null
  const inputContextId = normalizeText(value.contextId)
  if (inputContextId && inputContextId !== context.contextId) return null
  const fieldMap = new Map(context.fields.map(field => [field.id, field]))
  const fields = Array.isArray(value.fields)
    ? value.fields.map(normalizeFieldInput)
      .filter((item): item is WorkbenchAiFormFillFieldInput => Boolean(item && fieldMap.has(item.fieldId)))
    : []
  const subforms = Array.isArray(value.subforms)
    ? value.subforms.map((item): WorkbenchAiFormFillSubformInput | null => {
      if (!isPlainObject(item)) return null
      const fieldId = normalizeText(item.fieldId)
      const field = fieldMap.get(fieldId)
      if (!fieldId || !field?.children?.length || !Array.isArray(item.rows)) return null
      const childIds = new Set(field.children.map(child => child.id))
      const rows = item.rows.map((row): WorkbenchAiFormFillSubformRowInput | null => {
        if (!isPlainObject(row) || !Array.isArray(row.fields)) return null
        const rowFields = row.fields.map(normalizeFieldInput)
          .filter((child): child is WorkbenchAiFormFillFieldInput => Boolean(child && childIds.has(child.fieldId)))
        if (!rowFields.length) return null
        return {
          ...(normalizeText(row.rowToken) ? { rowToken: normalizeText(row.rowToken) } : {}),
          fields: rowFields,
        }
      }).filter((row): row is WorkbenchAiFormFillSubformRowInput => Boolean(row))
      if (!rows.length) return null
      return {
        fieldId,
        operation: item.operation === 'update_rows' ? 'update_rows' : 'append_rows',
        rows,
      }
    }).filter((item): item is WorkbenchAiFormFillSubformInput => Boolean(item))
    : []

  if (!fields.length && !subforms.length) return null
  return {
    contextId: context.contextId,
    ...(fields.length ? { fields } : {}),
    ...(subforms.length ? { subforms } : {}),
  }
}
