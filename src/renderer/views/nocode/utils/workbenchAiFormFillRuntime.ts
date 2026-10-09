import type { NocodeFormData } from '@common/types/nocode'
import type { Field, Row, Table } from '@common/types/project'
import { isSystemField } from '@common/utils'
import type {
  WorkbenchAiFormFillContextSnapshot,
  WorkbenchAiFormFillFieldContext,
  WorkbenchAiFormFillIssue,
  WorkbenchAiFormFillResult,
  WorkbenchAiFormFillToolInput,
  WorkbenchAiFormFillUndoResult,
  WorkbenchAiUnsupportedFormFillField,
} from '@common/utils/workbenchAiFormFill'
import type { AbstractForm, FormElement } from '@renderer/b2/controllers/form';
import { deepClone, equals } from '@common/utils/object'
import i18next from 'i18next'
import { nextTick } from 'vue'

const UNSUPPORTED_FIELD_TYPES = new Map<string, string>([
  ['widget.form.image-uploader', 'unsupportedImageField'],
  ['widget.form.file-uploader', 'unsupportedFileField'],
  ['widget.form.selectData', 'unsupportedSelectDataField'],
  ['widget.form.relatedData', 'unsupportedRelatedDataField'],
  ['widget.form.searchForm', 'unsupportedSearchFormField'],
  ['widget.form.autoCompute', 'unsupportedAutoComputeField'],
  ['widget.form.position', 'unsupportedPositionField'],
])

type FormFillRuntimeOptions = {
  contextId: string
  appId: string
  appName?: string
  formMode: 'add' | 'edit'
  getForm: () => AbstractForm | null | undefined
  getTable: () => Table | null | undefined
  getFormData: () => NocodeFormData | null | undefined
  ensureEditable?: () => Promise<boolean>
  getWidgetElement?: (widget: FormElement) => HTMLElement | null | undefined
  setWidgetValue?: (widget: FormElement, value: unknown) => void
}

type AppliedFieldChange = {
  kind: 'field'
  fieldId: string
  fieldName: string
  previousValue: unknown
  appliedValue: unknown
}

type AppliedSubformChange = {
  kind: 'subform'
  fieldId: string
  fieldName: string
  fieldIds: string[]
  previousValue: Row[]
  appliedValue: Row[]
}

type AppliedChange = AppliedFieldChange | AppliedSubformChange

type SubformManualChanges = {
  updatedRows: Map<number, Map<string, unknown>>
  removedRows: Set<number>
  appendedRows: Row[]
}

type FillOperation = {
  id: string
  changes: AppliedChange[]
}

type OrganizationSearchItem = {
  id?: string
  name?: string
  realname?: string
  user?: string
  departmentName?: string
  departmentPath?: string
  children?: OrganizationSearchItem[]
}

type FieldValueResolution =
  | { value: unknown; issues?: undefined }
  | { value?: undefined; issues: WorkbenchAiFormFillIssue[] }

const normalizeText = (value: unknown) => String(value || '').trim()

const isEmptyValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

const flattenDepartments = (
  items: OrganizationSearchItem[] = [],
  parentPath = '',
): OrganizationSearchItem[] => items.flatMap(item => {
  const departmentPath = [parentPath, normalizeText(item.name)].filter(Boolean).join(' / ')
  return [
    { ...item, departmentPath },
    ...flattenDepartments(Array.isArray(item.children) ? item.children : [], departmentPath),
  ]
})

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const getSubformRowToken = (row: Row, index: number) => (
  normalizeText(Reflect.get(row, '__uuid__') || Reflect.get(row, '_uuid')) || `row:${index}`
)

const getSubformRows = (widget: FormElement): Row[] => (
  Array.isArray(widget.currentValue) ? widget.currentValue as Row[] : []
)

const setSubformRowFieldValue = (row: Row, fieldId: string, value: unknown) => {
  if (value === undefined) {
    delete row[fieldId]
    return
  }
  row[fieldId] = deepClone(value)
}

const findSubformRowIndex = (rows: Row[], rowToken: string, rowIndex: number) => {
  const index = rows.findIndex((row, index) => getSubformRowToken(row, index) === rowToken)
  return index >= 0
    ? index
    : rowToken === `row:${rowIndex}` && rows[rowIndex]
      ? rowIndex
      : -1
}

const hasSubformRowFieldDiff = (currentRow: Row, appliedRow: Row, fieldIds: string[]) => (
  fieldIds.some(fieldId => !equals(currentRow[fieldId], appliedRow[fieldId]))
)

const diffSubformValue = (
  previousRows: Row[],
  appliedRows: Row[],
  currentRows: Row[],
  fieldIds: string[],
) => {
  const changes: SubformManualChanges = {
    updatedRows: new Map(),
    removedRows: new Set(),
    appendedRows: [],
  }

  previousRows.forEach((previousRow, previousRowIndex) => {
    const rowToken = getSubformRowToken(previousRow, previousRowIndex)
    const appliedRowIndex = findSubformRowIndex(appliedRows, rowToken, previousRowIndex)
    const currentRowIndex = findSubformRowIndex(currentRows, rowToken, previousRowIndex)
    if (appliedRowIndex >= 0 && currentRowIndex < 0) {
      changes.removedRows.add(previousRowIndex)
    }
  })

  currentRows.forEach((currentRow, currentRowIndex) => {
    const rowToken = getSubformRowToken(currentRow, currentRowIndex)
    const previousRowIndex = findSubformRowIndex(previousRows, rowToken, currentRowIndex)
    const appliedRowIndex = findSubformRowIndex(appliedRows, rowToken, currentRowIndex)
    if (previousRowIndex >= 0) {
      if (appliedRowIndex < 0) return
      const appliedRow = appliedRows[appliedRowIndex]
      if (!hasSubformRowFieldDiff(currentRow, appliedRow, fieldIds)) return
      const updatedRow = changes.updatedRows.get(previousRowIndex) || new Map<string, unknown>()
      fieldIds.forEach(fieldId => {
        if (!equals(currentRow[fieldId], appliedRow[fieldId])) {
          updatedRow.set(fieldId, deepClone(currentRow[fieldId]))
        }
      })
      changes.updatedRows.set(previousRowIndex, updatedRow)
      return
    }

    if (appliedRowIndex < 0 || hasSubformRowFieldDiff(currentRow, appliedRows[appliedRowIndex], fieldIds)) {
      changes.appendedRows.push(deepClone(currentRow))
    }
  })

  return changes
}

const mergeSubformValue = (previousRows: Row[], changes: SubformManualChanges) => {
  const restoredRows = deepClone(previousRows)
  for (const [index, updatedRow] of changes.updatedRows) {
    for (const [fieldId, value] of updatedRow) {
      setSubformRowFieldValue(restoredRows[index], fieldId, value)
    }
  }
  Array.from(changes.removedRows)
    .sort((left, right) => right - left)
    .forEach(index => restoredRows.splice(index, 1))
  restoredRows.push(...changes.appendedRows)

  return restoredRows
}

const normalizeNamedValues = (value: unknown) => {
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap(item => typeof item === 'string'
    ? item.split(/[,，、]/g)
    : [item])
    .map(item => isRecord(item)
      ? normalizeText(item.name || item.label || item.value || item.id)
      : normalizeText(item))
    .filter(Boolean)
}

const getWidgetType = (field: Field, widget?: FormElement | null) => (
  normalizeText(widget?.getSoul?.().type || field?.meta?.extra?.widgetType)
)

const getWidgetOptions = (widget?: FormElement | null, field?: Field | null) => {
  const getOption = (key: string) => widget?.getOption?.(key, { skipDefault: true })
    ?? field?.meta?.extra?.[key]
  const type = getWidgetType(field as Field, widget)
  const optionKey = type === 'widget.form.radioGroup'
    ? 'radiogroup-value-text-color-option'
    : type === 'widget.form.checkboxGroup'
      ? 'checkbox-option'
      : type === 'widget.form.treeSelect' || type === 'widget.form.treeMultipleSelect'
        ? 'treeselect-value-text-option'
        : ''
  const options = optionKey ? getOption(optionKey)?.options : []
  return Array.isArray(options)
    ? options.map(item => {
      const value = normalizeText(item?.value ?? item?.label)
      return value ? { label: normalizeText(item?.label || value), value } : null
    }).filter(Boolean) as Array<{ label: string; value: string }>
    : []
}

const findFormWidget = (form: AbstractForm, fieldId: string) => (
  (form.formInputs || []).find(item => item.fieldId === fieldId) || null
)

const buildFieldContext = (
  field: Field,
  widget: FormElement | null,
  formData: NocodeFormData,
): { field?: WorkbenchAiFormFillFieldContext; unsupported: WorkbenchAiUnsupportedFormFillField[] } => {
  if (!field || isSystemField(field)) return { unsupported: [] }
  const id = normalizeText(field.uid)
  const name = normalizeText(widget?.title || field.meta?.name || id)
  const type = getWidgetType(field, widget)
  if (!id || !name || !type) return { unsupported: [] }
  const unsupportedReasonKey = UNSUPPORTED_FIELD_TYPES.get(type)
  if (unsupportedReasonKey) {
    return {
      unsupported: [{
        id,
        name,
        type,
        reason: i18next.t(`workbenchAiFormFillRuntime.${unsupportedReasonKey}`),
      }],
    }
  }
  if (widget?.isHidden) return { unsupported: [] }

  const subTableId = field.meta?.extra?.subTableUID?.[1]
  const subTable = subTableId
    ? formData.tables?.find(item => item.uid === subTableId)
    : null
  const childResults = (subTable?.fields || []).map(child => buildFieldContext(child, null, formData))
  const children = childResults.flatMap(item => item.field ? [item.field] : [])
  const options = getWidgetOptions(widget, field)
  const rows = children.length && Array.isArray(widget?.currentValue)
    ? widget.currentValue.map((row: Row, index: number) => ({
      rowToken: getSubformRowToken(row, index),
      fields: children.map(child => ({
        ...child,
        hasValue: !isEmptyValue(row[child.id]),
      })),
    }))
    : []
  return {
    field: {
      id,
      name,
      type,
      required: Boolean(widget?.isRequired || field.meta?.extra?.isRequired),
      hasValue: widget ? !widget.isEmpty() : false,
      ...(options.length ? { options } : {}),
      ...(children.length ? { children } : {}),
      ...(rows.length ? { rows } : {}),
    },
    unsupported: childResults.flatMap(item => item.unsupported),
  }
}

const resolveOrganizationValue = async (
  widget: FormElement,
  field: WorkbenchAiFormFillFieldContext,
  requestedValue: unknown,
): Promise<FieldValueResolution> => {
  const board = widget.getBoard()
  const requested = normalizeNamedValues(requestedValue)
  const isMember = field.type === 'widget.form.memberSelect'
  const source = isMember
    ? await board.getOrganizeUsers() as OrganizationSearchItem[]
    : flattenDepartments(await board.getOrganizeDepartments(undefined, true) as OrganizationSearchItem[])
  const resolvedIds: string[] = []
  const issues: WorkbenchAiFormFillIssue[] = []

  for (const name of requested) {
    const matches = source.filter(item => {
      const labels = isMember
        ? [item?.realname, item?.name, item?.user]
        : [item?.name]
      return labels.some(label => normalizeText(label) === name)
        || normalizeText(item?.id) === name
    })
    if (matches.length === 1) {
      resolvedIds.push(String(matches[0].id))
      continue
    }
    issues.push({
      fieldId: field.id,
      fieldName: field.name,
      reason: matches.length
        ? i18next.t('workbenchAiFormFillRuntime.multipleOrganizationMatches', { name })
        : i18next.t('workbenchAiFormFillRuntime.organizationNotFound', { name }),
      ...(matches.length ? {
        candidates: matches.slice(0, 8).map(item => ({
          label: isMember
            ? i18next.t('workbenchAiFormFillRuntime.organizationCandidate', {
              name: item.realname || item.name || item.user,
              detail: item.departmentName || item.user,
              interpolation: { escapeValue: false },
            })
            : item.departmentPath || item.name,
          value: String(item.id),
        })),
      } : {}),
    })
  }
  return issues.length ? { issues } : { value: resolvedIds }
}

const resolveFieldValue = async (
  widget: FormElement,
  field: WorkbenchAiFormFillFieldContext,
  value: unknown,
): Promise<FieldValueResolution> => {
  if (field.type === 'widget.form.memberSelect' || field.type === 'widget.form.departmentSelect') {
    return await resolveOrganizationValue(widget, field, value)
  }
  if (field.options?.length) {
    const requested = normalizeNamedValues(value)
    const resolved = requested.map(item => field.options?.find(option => (
      option.value === item || option.label === item
    ))).filter(Boolean)
    if (resolved.length !== requested.length) {
      return {
        issues: [{
          fieldId: field.id,
          fieldName: field.name,
          reason: i18next.t('workbenchAiFormFillRuntime.valueNotInOptions'),
          candidates: field.options,
        }],
      }
    }
    const values = resolved.map(item => item!.value)
    const isMultiple = field.type === 'widget.form.checkboxGroup'
      || field.type === 'widget.form.treeMultipleSelect'
    return { value: isMultiple ? values : values[0] }
  }
  if (field.type === 'widget.form.numberInput'
    || field.type === 'widget.form.amountInput'
    || field.type === 'widget.form.rate') {
    const numberValue = Number(value)
    return Number.isFinite(numberValue)
      ? { value: numberValue }
      : { issues: [{
        fieldId: field.id,
        fieldName: field.name,
        reason: i18next.t('workbenchAiFormFillRuntime.invalidNumber'),
      }] }
  }
  if (field.type === 'widget.form.switch') {
    if (typeof value === 'boolean') return { value }
    const normalized = normalizeText(value).toLowerCase()
    if (['true', '是', '开启', '开'].includes(normalized)) return { value: true }
    if (['false', '否', '关闭', '关'].includes(normalized)) return { value: false }
    return { issues: [{
      fieldId: field.id,
      fieldName: field.name,
      reason: i18next.t('workbenchAiFormFillRuntime.invalidSwitchValue'),
    }] }
  }
  return { value }
}

export const createWorkbenchAiFormFillRuntime = (options: FormFillRuntimeOptions) => {
  let latestOperation: FillOperation | null = null
  let highlightTimer: ReturnType<typeof setTimeout> | null = null
  let highlightedElements: HTMLElement[] = []

  const setWidgetValue = (widget: FormElement, value: unknown) => {
    if (options.setWidgetValue) {
      options.setWidgetValue(widget, value)
      return
    }
    widget.trySetInputValue(value)
  }

  const getSnapshot = (): WorkbenchAiFormFillContextSnapshot | null => {
    const form = options.getForm()
    const table = options.getTable()
    const formData = options.getFormData()
    if (!form || !table || !formData) return null
    const widgetMap = new Map((form.formInputs || []).map(widget => [widget.fieldId, widget]))
    const results = (table.fields || []).map(field => buildFieldContext(field, widgetMap.get(field.uid) || null, formData))
    const fields = results.flatMap(item => item.field ? [item.field] : [])
    if (!fields.length) return null
    return {
      contextId: options.contextId,
      appId: options.appId,
      ...(options.appName ? { appName: options.appName } : {}),
      tableId: table.uid,
      tableName: table.alias || table.uid,
      formMode: options.formMode,
      fields,
      unsupportedFields: results.flatMap(item => item.unsupported),
    }
  }

  const highlightWidgets = (widgets: FormElement[]) => {
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightedElements.forEach(element => element.classList.remove('is-ai-form-filled'))
    highlightedElements = [...new Set(widgets.map(widget => (
      options.getWidgetElement?.(widget) || widget.dom
    )).filter(Boolean) as HTMLElement[])]
    highlightedElements.forEach(element => element.classList.add('is-ai-form-filled'))
    highlightTimer = setTimeout(() => {
      highlightedElements.forEach(element => element.classList.remove('is-ai-form-filled'))
      highlightedElements = []
      highlightTimer = null
    }, 4000)
  }

  const applyFill = async (input: WorkbenchAiFormFillToolInput): Promise<WorkbenchAiFormFillResult> => {
    if (input.contextId && input.contextId !== options.contextId) {
      return {
        tool: 'fill_current_form', status: 'not_applied', contextId: options.contextId,
        appliedFieldIds: [], appliedFieldNames: [], skipped: [],
        unresolved: [{ reason: i18next.t('workbenchAiFormFillRuntime.formChangedReason') }],
        requiresUserSubmit: true,
        summary: i18next.t('workbenchAiFormFillRuntime.formChangedSummary'),
      }
    }
    if (options.ensureEditable && !await options.ensureEditable()) {
      return {
        tool: 'fill_current_form', status: 'not_applied', contextId: options.contextId,
        appliedFieldIds: [], appliedFieldNames: [],
        skipped: [{ reason: i18next.t('workbenchAiFormFillRuntime.recordNotEditableReason') }],
        unresolved: [], requiresUserSubmit: true,
        summary: i18next.t('workbenchAiFormFillRuntime.recordNotEditableSummary'),
      }
    }
    const form = options.getForm()
    const table = options.getTable()
    const snapshot = getSnapshot()
    if (!form || !table || !snapshot) {
      return {
        tool: 'fill_current_form', status: 'not_applied', contextId: options.contextId,
        appliedFieldIds: [], appliedFieldNames: [], skipped: [],
        unresolved: [{ reason: i18next.t('workbenchAiFormFillRuntime.formNotLoadedReason') }],
        requiresUserSubmit: true,
        summary: i18next.t('workbenchAiFormFillRuntime.formNotLoadedSummary'),
      }
    }

    const fieldMap = new Map(snapshot.fields.map(field => [field.id, field]))
    const changes: AppliedChange[] = []
    const appliedWidgets: FormElement[] = []
    const skipped: WorkbenchAiFormFillIssue[] = []
    const unresolved: WorkbenchAiFormFillIssue[] = []
    const recordFieldChange = (change: AppliedFieldChange, widget: FormElement) => {
      const existing = changes.find((item): item is AppliedFieldChange => (
        item.kind === 'field' && item.fieldId === change.fieldId
      ))
      if (existing) {
        existing.appliedValue = change.appliedValue
      } else {
        changes.push(change)
      }
      appliedWidgets.push(widget)
    }

    const recordSubformChange = (change: AppliedSubformChange, widget: FormElement) => {
      const existing = changes.find((item): item is AppliedSubformChange => (
        item.kind === 'subform' && item.fieldId === change.fieldId
      ))
      if (!existing) {
        changes.push(change)
        appliedWidgets.push(widget)
        return
      }
      existing.appliedValue = change.appliedValue
      appliedWidgets.push(widget)
    }

    for (const change of input.fields || []) {
      const field = fieldMap.get(change.fieldId)
      const widget = findFormWidget(form, change.fieldId)
      if (!field || !widget || widget.isHidden || widget.isReadonly) {
        skipped.push({
          fieldId: change.fieldId,
          fieldName: field?.name,
          reason: i18next.t('workbenchAiFormFillRuntime.fieldNotEditable'),
        })
        continue
      }
      if ((change.writeMode || 'fill_empty') === 'fill_empty' && !widget.isEmpty()) {
        skipped.push({
          fieldId: field.id,
          fieldName: field.name,
          reason: i18next.t('workbenchAiFormFillRuntime.existingValuePreserved'),
        })
        continue
      }
      const resolved = await resolveFieldValue(widget, field, change.value)
      if (resolved.issues?.length) {
        unresolved.push(...resolved.issues)
        continue
      }
      const previousValue = deepClone(widget.currentValue)
      setWidgetValue(widget, deepClone(resolved.value))
      const appliedValue = deepClone(widget.currentValue)
      if (!equals(previousValue, appliedValue)) {
        recordFieldChange({
          kind: 'field',
          fieldId: field.id,
          fieldName: field.name,
          previousValue,
          appliedValue,
        }, widget)
      }
    }

    for (const subformInput of input.subforms || []) {
      const field = fieldMap.get(subformInput.fieldId)
      const widget = findFormWidget(form, subformInput.fieldId)
      const childMap = new Map((field?.children || []).map(child => [child.id, child]))
      if (!field || !widget || !field.children?.length || widget.isHidden || widget.isReadonly) {
        skipped.push({
          fieldId: subformInput.fieldId,
          fieldName: field?.name,
          reason: i18next.t('workbenchAiFormFillRuntime.subformNotEditable'),
        })
        continue
      }
      const previousValue = deepClone(getSubformRows(widget))
      const nextValue = deepClone(previousValue)
      let rowChanged = false
      for (const [rowIndex, rowInput] of subformInput.rows.entries()) {
        const rowToken = normalizeText(rowInput.rowToken)
        const targetIndex = subformInput.operation === 'update_rows'
          ? nextValue.findIndex((row, index) => (
            rowToken === getSubformRowToken(row, index)
          ))
          : -1
        if (subformInput.operation === 'update_rows' && (!Number.isInteger(targetIndex) || !nextValue[targetIndex])) {
          unresolved.push({
            fieldId: field.id,
            fieldName: field.name,
            reason: i18next.t('workbenchAiFormFillRuntime.unrecognizedSubformRow', {
              index: rowIndex + 1,
            }),
          })
          continue
        }
        const targetRow: Row = targetIndex >= 0 ? { ...nextValue[targetIndex] } : {}
        let currentRowValid = true
        for (const childInput of rowInput.fields) {
          const child = childMap.get(childInput.fieldId)
          if (!child) continue
          if ((childInput.writeMode || 'fill_empty') === 'fill_empty' && !isEmptyValue(targetRow[child.id])) {
            continue
          }
          const resolved = await resolveFieldValue(widget, child, childInput.value)
          if (resolved.issues?.length) {
            unresolved.push(...resolved.issues.map(issue => ({
              ...issue,
              fieldName: `${field.name} / ${child.name}`,
            })))
            currentRowValid = false
            continue
          }
          const previousFieldValue = deepClone(targetRow[child.id])
          targetRow[child.id] = deepClone(resolved.value)
          if (!equals(previousFieldValue, targetRow[child.id])) rowChanged = true
        }
        if (!currentRowValid && !Object.keys(targetRow).length) continue
        if (targetIndex >= 0) nextValue[targetIndex] = targetRow
        else nextValue.push(targetRow)
      }
      if (rowChanged && !equals(previousValue, nextValue)) {
        setWidgetValue(widget, nextValue)
        await nextTick()
        recordSubformChange({
          kind: 'subform',
          fieldId: field.id,
          fieldName: field.name,
          fieldIds: (field.children || []).map(child => child.id),
          previousValue,
          appliedValue: deepClone(getSubformRows(widget)),
        }, widget)
      }
    }

    await nextTick()
    if (changes.length) {
      latestOperation = {
        id: `form-fill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        changes,
      }
      highlightWidgets(appliedWidgets)
    }
    const status = changes.length
      ? (skipped.length || unresolved.length ? 'partial' : 'applied')
      : 'not_applied'
    const summary = changes.length
      ? i18next.t('workbenchAiFormFillRuntime.fillSummary', { count: changes.length })
      : i18next.t('workbenchAiFormFillRuntime.noWritableFields')
    return {
      tool: 'fill_current_form',
      status,
      contextId: options.contextId,
      ...(latestOperation && changes.length ? { operationId: latestOperation.id } : {}),
      appliedFieldIds: changes.map(item => item.fieldId),
      appliedFieldNames: changes.map(item => item.fieldName),
      skipped,
      unresolved,
      requiresUserSubmit: true,
      summary,
    }
  }

  const undoFill = async (operationId: string): Promise<WorkbenchAiFormFillUndoResult> => {
    const form = options.getForm()
    if (!form || !latestOperation || latestOperation.id !== operationId) {
      return {
        status: 'not_available', operationId, restoredFieldNames: [], preservedFieldNames: [],
        summary: i18next.t('workbenchAiFormFillRuntime.undoLatestOnly'),
      }
    }
    const restoredFieldNames: string[] = []
    const preservedFieldNames: string[] = []
    const restoredWidgets: FormElement[] = []
    for (const change of latestOperation.changes) {
      const widget = findFormWidget(form, change.fieldId)
      if (!widget) {
        preservedFieldNames.push(change.fieldName)
        continue
      }
      if (change.kind === 'field') {
        if (!equals(widget.currentValue, change.appliedValue)) {
          preservedFieldNames.push(change.fieldName)
          continue
        }
        setWidgetValue(widget, deepClone(change.previousValue))
        restoredFieldNames.push(change.fieldName)
        restoredWidgets.push(widget)
        continue
      }

      const manualChanges = diffSubformValue(
        change.previousValue,
        change.appliedValue,
        getSubformRows(widget),
        change.fieldIds,
      )
      const hasManualChanges = manualChanges.updatedRows.size
        || manualChanges.removedRows.size
      setWidgetValue(widget, hasManualChanges
        ? mergeSubformValue(change.previousValue, manualChanges)
        : deepClone(change.previousValue))
      restoredFieldNames.push(change.fieldName)
      restoredWidgets.push(widget)
      if (hasManualChanges) preservedFieldNames.push(change.fieldName)
    }
    latestOperation = null
    await nextTick()
    highlightWidgets(restoredWidgets)
    return {
      status: preservedFieldNames.length ? 'partial' : 'undone',
      operationId,
      restoredFieldNames,
      preservedFieldNames,
      summary: preservedFieldNames.length
        ? i18next.t('workbenchAiFormFillRuntime.undoPartialSummary', {
          count: restoredFieldNames.length,
        })
        : i18next.t('workbenchAiFormFillRuntime.undoSummary', {
          count: restoredFieldNames.length,
        }),
    }
  }

  return { getSnapshot, applyFill, undoFill }
}
