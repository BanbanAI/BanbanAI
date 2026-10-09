import { Dynamic, type Account } from '@common/types/account'
import { AggregationType, FormConditionValueType, FormWidgetType, type NocodeFormData } from '@common/types/nocode'
import { TargetFieldFillType, type Field, type FieldUID, type Row, type Table, type TargetFieldFillRule } from '@common/types/project'
import { findWidgetSoulByUID } from '@common/utils/element'
import { normalizeNumberFieldValue } from '@common/utils/fieldValue'
import { collectFormulaFields, getFormulaStr, rowsDefaultValueCalculation } from '@common/utils/formula'
import { hasConfiguredValue } from '@common/utils/other'
import { deepClone, isEmpty } from '@common/utils/object'
import dayjs from 'dayjs'
import { isEmpty as isLodashEmpty } from 'lodash'

type ProcessDefaultInitiator = Pick<Account, 'id' | 'departments'>

export class ProcessDefaultDependencyCycleError extends Error {
  readonly fieldUIDs: string[]

  constructor(fieldUIDs: string[]) {
    super('PROCESS_DEFAULT_DEPENDENCY_CYCLE')
    this.name = 'ProcessDefaultDependencyCycleError'
    this.fieldUIDs = fieldUIDs
  }
}

export type ApplyProcessFieldDefaultsOptions = {
  rows: Row[]
  fieldUIDs: string[]
  targetTable: Table
  formData: NocodeFormData
  initiator?: ProcessDefaultInitiator | null
  now?: Date
  createMissingSubRows?: boolean
  clearUnconfiguredFields?: boolean
  subRowIndexesByRow?: Array<Record<string, number[]>>
  calculateQuickCompute?: (field: Field, row: Row, rootRow: Row) => Promise<unknown>
}

export type ApplyProcessFieldDefaultsResult = {
  configuredFieldUIDs: Set<string>
  targetFields: Field[]
}

export type RestoreProcessBatchFieldValuesOptions = {
  rows: Row[]
  generatedBatchRows: Row[]
  batchFields: TargetFieldFillRule[]
  batchRowsStartIndex: number
}

type ProcessDistinctValue = {
  value: unknown
  count: number
}

export const resolveProcessDefaultQuickComputeFilterRow = (
  fieldUID: string,
  row: Row,
  rootRow: Row = row,
) => {
  const [parentFieldUID, subFieldUID] = fieldUID.split('.')
  if (!parentFieldUID || !subFieldUID) {
    return row
  }
  return {
    ...rootRow,
    [parentFieldUID]: [row],
  }
}

export const calculateProcessDistinctAggregation = (
  values: ProcessDistinctValue[] = [],
  aggregateType: AggregationType = AggregationType.SUM,
  decimal = 2,
) => {
  if (aggregateType === AggregationType.COUNT) {
    return values.reduce((total, item) => total + (item.count ?? 0), 0)
  }
  if (aggregateType === AggregationType.FILLED || aggregateType === AggregationType.UNFILLED) {
    const filledCount = values.reduce((total, item) => {
      const value = item.value === '' ? null : item.value
      return total + (!isLodashEmpty(value) ? (item.count ?? 0) : 0)
    }, 0)
    if (aggregateType === AggregationType.FILLED) {
      return filledCount
    }
    return values.reduce((total, item) => total + (item.count ?? 0), 0) - filledCount
  }
  if (aggregateType === AggregationType.SUM) {
    return values.reduce((total, item) => total + Number(item.value ?? 0) * (item.count ?? 0), 0)
  }
  if (aggregateType === AggregationType.AVE) {
    const totalCount = values.reduce((total, item) => total + (item.count ?? 0), 0)
    if (!totalCount) {
      return 0
    }
    const sum = values.reduce((total, item) => total + Number(item.value ?? 0) * (item.count ?? 0), 0)
    return Number((sum / totalCount).toFixed(decimal))
  }
  if (aggregateType === AggregationType.MAX) {
    const result = Math.max(...values.map(item => Number(item.value ?? Number.NEGATIVE_INFINITY)))
    return result === Number.NEGATIVE_INFINITY ? null : result
  }
  if (aggregateType === AggregationType.MIN) {
    const result = Math.min(...values.map(item => Number(item.value ?? Number.POSITIVE_INFINITY)))
    return result === Number.POSITIVE_INFINITY ? null : result
  }
  return null
}

const getItemId = (item: unknown) => {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item)
  }
  if (!item || typeof item !== 'object') {
    return ''
  }
  const value = item as Record<string, unknown>
  const id = value.id ?? value.uid ?? value.value
  return typeof id === 'string' || typeof id === 'number' ? String(id) : ''
}

const appendUnique = (values: string[], value: unknown) => {
  const id = getItemId(value)
  if (id && !values.includes(id)) {
    values.push(id)
  }
}

const resolveOrganizeDefaultValue = (field: Field, initiator?: ProcessDefaultInitiator | null) => {
  const extra = field.meta?.extra || {}
  const values: string[] = []
  const defaultValues = Array.isArray(extra.defaultValue) ? extra.defaultValue : [extra.defaultValue]
  defaultValues.forEach(item => appendUnique(values, item))

  const dynamicValues = Array.isArray(extra.defaultValueDynamic) ? extra.defaultValueDynamic : []
  if (extra.widgetType === FormWidgetType.MEMBER_SELECT && dynamicValues.includes(Dynamic.CURRENT_USER)) {
    appendUnique(values, initiator?.id)
  }
  if (extra.widgetType === FormWidgetType.DEPARTMENT_SELECT && dynamicValues.includes(Dynamic.CURRENT_DEPARTMENT)) {
    (initiator?.departments || []).forEach(item => appendUnique(values, item))
  }
  return values
}

const isOrganizeField = (field: Field) => [
  FormWidgetType.MEMBER_SELECT,
  FormWidgetType.DEPARTMENT_SELECT,
].includes(field.meta?.extra?.widgetType as FormWidgetType)

const isQuickComputeField = (field: Field) => {
  const extra = field.meta?.extra
  return extra?.defaultValueType === 'formula'
    && extra?.defaultComputeType === 'quickCompute'
    && Array.isArray(extra?.otherTableFieldUID)
    && extra.otherTableFieldUID.length >= 3
}

const isFormulaField = (field: Field) => {
  const extra = field.meta?.extra
  return extra?.defaultValueType === 'formula'
    && extra?.defaultComputeType !== 'quickCompute'
    && !isEmpty(getFormulaStr(extra?.formula))
}

const getCalculatedFieldReferences = (field: Field, formData: NocodeFormData) => {
  if (isFormulaField(field)) {
    return collectFormulaFields(getFormulaStr(field.meta?.extra?.formula), formData.tables)
  }
  if (!isQuickComputeField(field)) {
    return []
  }

  return (field.meta?.extra?.dataFilter?.conditions || []).flatMap((condition) => {
    const type = condition.type || FormConditionValueType.FORM
    if (type === FormConditionValueType.FORM && typeof condition.value === 'string') {
      return [condition.value]
    }
    if (type === FormConditionValueType.FORMULA) {
      const formula = condition.formula ?? condition.value
      return typeof formula === 'string' ? collectFormulaFields(formula, formData.tables) : []
    }
    return []
  })
}

const sortCalculatedDefaultFields = (fields: Field[], formData: NocodeFormData) => {
  const fieldByUID = new Map(fields.map(field => [String(field.uid), field]))
  const dependents = new Map<string, string[]>()
  const dependenciesByFieldUID = new Map<string, Set<string>>()
  const dependencyCount = new Map<string, number>()

  for (const field of fields) {
    const fieldUID = String(field.uid)
    const dependencies = new Set<string>()
    for (const reference of getCalculatedFieldReferences(field, formData)) {
      const referenceParts = String(reference).split('.')
      const candidates = [
        String(reference),
        referenceParts.slice(-2).join('.'),
        referenceParts.at(-1) || '',
      ]
      const dependencyUID = candidates.find(candidate => fieldByUID.has(candidate))
      if (dependencyUID) {
        dependencies.add(dependencyUID)
      }
    }
    dependenciesByFieldUID.set(fieldUID, dependencies)
    dependencyCount.set(fieldUID, dependencies.size)
    for (const dependencyUID of dependencies) {
      const nextDependents = dependents.get(dependencyUID) || []
      nextDependents.push(fieldUID)
      dependents.set(dependencyUID, nextDependents)
    }
  }

  const pending = fields
    .map(field => String(field.uid))
    .filter(fieldUID => dependencyCount.get(fieldUID) === 0)
  const sortedFields: Field[] = []
  for (let index = 0; index < pending.length; index++) {
    const fieldUID = pending[index]
    sortedFields.push(fieldByUID.get(fieldUID)!)
    for (const dependentUID of dependents.get(fieldUID) || []) {
      const nextCount = (dependencyCount.get(dependentUID) || 0) - 1
      dependencyCount.set(dependentUID, nextCount)
      if (nextCount === 0) {
        pending.push(dependentUID)
      }
    }
  }

  if (sortedFields.length !== fields.length) {
    const sortedFieldUIDs = new Set(sortedFields.map(field => String(field.uid)))
    const cyclicFieldUIDs = fields
      .map(field => String(field.uid))
      .filter(fieldUID => !sortedFieldUIDs.has(fieldUID))
      .filter((fieldUID) => {
        const visited = new Set<string>()
        const pendingDependencies = [...(dependenciesByFieldUID.get(fieldUID) || [])]
        while (pendingDependencies.length > 0) {
          const dependencyUID = pendingDependencies.pop()!
          if (dependencyUID === fieldUID) {
            return true
          }
          if (visited.has(dependencyUID)) {
            continue
          }
          visited.add(dependencyUID)
          pendingDependencies.push(...(dependenciesByFieldUID.get(dependencyUID) || []))
        }
        return false
      })
    throw new ProcessDefaultDependencyCycleError(
      cyclicFieldUIDs,
    )
  }
  return sortedFields
}

const resolveProcessAddressDefaultValue = (
  field: Field,
  targetTable: Table,
  formData: NocodeFormData,
) => {
  if (field.meta?.extra?.widgetType !== FormWidgetType.ADDRESS || !field.meta?.uid) {
    return undefined
  }
  const formTableUID = targetTable.meta?.extra?.primaryTable?.at(-1) || targetTable.uid
  const rootWidget = formData.formOptions?.[formTableUID]?.widget
  const fieldWidget = rootWidget ? findWidgetSoulByUID([rootWidget], field.meta.uid) : null
  return fieldWidget?.options?.['default-value']
}

const hasProcessDefault = (field: Field, targetTable: Table, formData: NocodeFormData) => {
  const extra = field.meta?.extra || {}
  if (isQuickComputeField(field) || isFormulaField(field)) {
    return true
  }
  if (extra.defaultValueType === 'currentDate' || extra.defaultValueType === 'currentTime') {
    return true
  }
  if (isOrganizeField(field)) {
    return hasConfiguredValue(extra.defaultValue) || hasConfiguredValue(extra.defaultValueDynamic)
  }
  if (extra.widgetType === FormWidgetType.SWITCH) {
    return extra.defaultValue !== undefined && extra.defaultValue !== null
  }
  if (extra.widgetType === FormWidgetType.DATE_RANGE_PICKER) {
    return Array.isArray(extra.defaultValue) && extra.defaultValue.some(hasConfiguredValue)
  }
  if (
    extra.widgetType === FormWidgetType.PHONE_INPUT
    || extra.widgetType === FormWidgetType.POSITION
  ) {
    return hasConfiguredValue(extra.defaultValue)
  }
  if (extra.widgetType === FormWidgetType.ADDRESS) {
    return hasConfiguredValue(extra.defaultValue)
      || hasConfiguredValue(resolveProcessAddressDefaultValue(field, targetTable, formData))
  }
  return (
    (extra.defaultValueType && extra.defaultValueType !== 'formula')
    || extra.linkType === 'form'
  ) && hasConfiguredValue(extra.defaultValue)
}

const resolveDirectDefaultValue = (
  field: Field,
  targetTable: Table,
  formData: NocodeFormData,
  initiator: ProcessDefaultInitiator | null | undefined,
  now: Date,
) => {
  const extra = field.meta?.extra || {}
  if (extra.defaultValueType === 'currentDate') {
    return dayjs(now).format('YYYY-MM-DD HH:mm:ss')
  }
  if (extra.defaultValueType === 'currentTime') {
    return dayjs(now).format('HH:mm:ss')
  }
  if (isOrganizeField(field)) {
    return resolveOrganizeDefaultValue(field, initiator)
  }
  if (extra.widgetType === FormWidgetType.ADDRESS && !hasConfiguredValue(extra.defaultValue)) {
    return deepClone(resolveProcessAddressDefaultValue(field, targetTable, formData))
  }
  return deepClone(extra.defaultValue)
}

const normalizeDefaultValue = (value: unknown): unknown => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeDefaultValue(item))
  }
  return value ?? null
}

const cloneDefaultValue = (value: unknown) => {
  const normalizedValue = normalizeDefaultValue(value)
  return normalizedValue && typeof normalizedValue === 'object'
    ? deepClone(normalizedValue)
    : normalizedValue
}

export const restoreProcessBatchFieldValues = ({
  rows,
  generatedBatchRows,
  batchFields,
  batchRowsStartIndex,
}: RestoreProcessBatchFieldValuesOptions) => {
  for (let index = 0; index < generatedBatchRows.length; index++) {
    const rowIndex = batchRowsStartIndex + index
    if (!rows[rowIndex]) continue
    for (const item of batchFields) {
      if (item.type === TargetFieldFillType.EMPTY) continue
      const fieldPath = item.fieldUID?.split('.') || []
      if (fieldPath.length > 1) {
        const [fieldId, subFieldId] = fieldPath
        const batchSubRows = generatedBatchRows[index]?.[fieldId]
        if (!Array.isArray(batchSubRows)) continue
        rows[rowIndex][fieldId] = rows[rowIndex][fieldId] || []
        for (let subIndex = 0; subIndex < batchSubRows.length; subIndex++) {
          rows[rowIndex][fieldId][subIndex] = rows[rowIndex][fieldId][subIndex] || {}
          rows[rowIndex][fieldId][subIndex][subFieldId] = deepClone(batchSubRows[subIndex]?.[subFieldId])
        }
        continue
      }
      rows[rowIndex][item.fieldUID] = deepClone(generatedBatchRows[index]?.[item.fieldUID])
    }
  }
}

const resolveProcessSubformDefaultRows = (
  parentField: Field,
  targetTable: Table,
  formData: NocodeFormData,
) => {
  const rootWidget = formData.formOptions?.[targetTable.uid]?.widget
  const subformWidget = rootWidget && parentField.meta?.uid
    ? findWidgetSoulByUID([rootWidget], parentField.meta.uid)
    : null
  const configuredRows = subformWidget?.options?.['default-value']
  if (Array.isArray(configuredRows)) {
    const subTableUID = parentField.meta?.extra?.subTableUID?.at(-1)
    const subFields = formData.tables?.find(table => table.uid === subTableUID)?.fields || []
    const fieldUIDMap = new Map<string, string>()
    subFields.forEach((field) => {
      fieldUIDMap.set(String(field.uid), String(field.uid))
      if (field.meta?.uid) {
        fieldUIDMap.set(String(field.meta.uid), String(field.uid))
      }
    })
    return configuredRows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return {}
      }
      return Object.entries(row).reduce<Row>((result, [key, value]) => {
        result[fieldUIDMap.get(key) || key] = cloneDefaultValue(value)
        return result
      }, {})
    })
  }
  const legacyRows = parentField.meta?.extra?.defaultValue
  return Array.isArray(legacyRows) ? cloneDefaultValue(legacyRows) as Row[] : []
}

export const resolveProcessTargetField = (fieldUID: string, targetTable: Table, formData: NocodeFormData) => {
  const [parentFieldUID, subFieldUID] = fieldUID.split('.')
  const parentField = targetTable.fields.find(field => field.uid === parentFieldUID)
  if (!parentField) {
    return null
  }
  if (!subFieldUID) {
    return parentField
  }
  const subTableUID = parentField.meta?.extra?.subTableUID?.at(-1)
  const subTable = formData.tables.find(table => table.uid === subTableUID)
  const subField = subTable?.fields.find(field => field.uid === subFieldUID)
  return subField ? { ...subField, uid: fieldUID as FieldUID } : null
}

const getTargetSubRows = (
  row: Row,
  parentFieldUID: string,
  indexes: number[] | undefined,
  createMissingSubRows: boolean,
) => {
  let subRows: Row[] = Array.isArray(row[parentFieldUID]) ? row[parentFieldUID] : []
  if (!subRows.length && createMissingSubRows) {
    subRows = [{}]
    row[parentFieldUID] = subRows
  }
  if (indexes === undefined) {
    return subRows
  }
  return indexes.reduce<Row[]>((result, index) => {
    if (index >= 0 && index < subRows.length) {
      subRows[index] ||= {}
      result.push(subRows[index])
    }
    return result
  }, [])
}

const setFieldValue = (
  row: Row,
  fieldUID: string,
  value: unknown,
  indexes: number[] | undefined,
  createMissingSubRows: boolean,
) => {
  const [parentFieldUID, subFieldUID] = fieldUID.split('.')
  if (!subFieldUID) {
    row[parentFieldUID] = cloneDefaultValue(value)
    return
  }
  for (const subRow of getTargetSubRows(row, parentFieldUID, indexes, createMissingSubRows)) {
    subRow[subFieldUID] = cloneDefaultValue(value)
  }
}

const copyCalculatedFieldValue = (
  targetRow: Row,
  calculatedRow: Row,
  targetField: Field,
  indexes: number[] | undefined,
  createMissingSubRows: boolean,
) => {
  const fieldUID = String(targetField.uid)
  const [parentFieldUID, subFieldUID] = fieldUID.split('.')
  if (!subFieldUID) {
    setFieldValue(
      targetRow,
      fieldUID,
      normalizeNumberFieldValue(calculatedRow?.[parentFieldUID], targetField),
      indexes,
      createMissingSubRows,
    )
    return
  }
  const targetSubRows = getTargetSubRows(targetRow, parentFieldUID, indexes, createMissingSubRows)
  const calculatedSubRows: Row[] = Array.isArray(calculatedRow?.[parentFieldUID]) ? calculatedRow[parentFieldUID] : []
  const sourceIndexes = indexes === undefined ? targetSubRows.map((_, index) => index) : indexes
  targetSubRows.forEach((subRow, index) => {
    subRow[subFieldUID] = cloneDefaultValue(normalizeNumberFieldValue(
      calculatedSubRows[sourceIndexes[index]]?.[subFieldUID],
      targetField,
    ))
  })
}

export const applyProcessFieldDefaults = async ({
  rows,
  fieldUIDs,
  targetTable,
  formData,
  initiator,
  now = new Date(),
  createMissingSubRows = false,
  clearUnconfiguredFields = true,
  subRowIndexesByRow = [],
  calculateQuickCompute,
}: ApplyProcessFieldDefaultsOptions): Promise<ApplyProcessFieldDefaultsResult> => {
  const targetFields = [...new Set(fieldUIDs)]
    .map(fieldUID => resolveProcessTargetField(fieldUID, targetTable, formData))
    .filter((field): field is Field => !!field)
  const configuredFieldUIDs = new Set(
    targetFields
      .filter(field => hasProcessDefault(field, targetTable, formData))
      .map(field => String(field.uid)),
  )
  const formulaFields = targetFields.filter(isFormulaField)
  const quickComputeFields = targetFields.filter(isQuickComputeField)
  const calculatedFields = sortCalculatedDefaultFields([...formulaFields, ...quickComputeFields], formData)
  const directFields = targetFields.filter(field => (
    configuredFieldUIDs.has(String(field.uid))
    && !isFormulaField(field)
    && !isQuickComputeField(field)
  ))

  if (createMissingSubRows) {
    const parentFieldUIDs = [...new Set(targetFields
      .filter(field => String(field.uid).includes('.'))
      .map(field => String(field.uid).split('.')[0]))]
    rows.forEach((row) => {
      for (const parentFieldUID of parentFieldUIDs) {
        if (Array.isArray(row[parentFieldUID]) && row[parentFieldUID].length) {
          continue
        }
        const parentField = targetTable.fields.find(field => field.uid === parentFieldUID)
        if (!parentField) {
          continue
        }
        const parentDefaultRows = resolveProcessSubformDefaultRows(parentField, targetTable, formData)
        const hasConfiguredSubField = targetFields.some(field => (
          configuredFieldUIDs.has(String(field.uid))
          && String(field.uid).startsWith(`${parentFieldUID}.`)
        ))
        if (!parentDefaultRows.length && !hasConfiguredSubField) {
          continue
        }
        row[parentFieldUID] = parentDefaultRows.length
          ? cloneDefaultValue(parentDefaultRows)
          : [{}]
      }
    })
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    for (const targetField of targetFields) {
      const fieldUID = String(targetField.uid)
      if (!clearUnconfiguredFields && !configuredFieldUIDs.has(fieldUID)) {
        continue
      }
      const parentFieldUID = fieldUID.split('.')[0]
      setFieldValue(row, fieldUID, null, subRowIndexesByRow[rowIndex]?.[parentFieldUID], createMissingSubRows)
    }
    for (const targetField of directFields) {
      const fieldUID = String(targetField.uid)
      const parentFieldUID = fieldUID.split('.')[0]
      setFieldValue(
        row,
        fieldUID,
        resolveDirectDefaultValue(targetField, targetTable, formData, initiator, now),
        subRowIndexesByRow[rowIndex]?.[parentFieldUID],
        createMissingSubRows,
      )
    }
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    for (const targetField of calculatedFields) {
      if (isFormulaField(targetField)) {
        const calculatedRow = deepClone(row)
        rowsDefaultValueCalculation(
          [calculatedRow],
          { formulaFields: [targetField], defaultFields: [] },
          targetTable,
          formData,
        )
        const fieldUID = String(targetField.uid)
        const parentFieldUID = fieldUID.split('.')[0]
        copyCalculatedFieldValue(
          row,
          calculatedRow,
          targetField,
          subRowIndexesByRow[rowIndex]?.[parentFieldUID],
          createMissingSubRows,
        )
        continue
      }
      if (!calculateQuickCompute) {
        continue
      }
      const fieldUID = String(targetField.uid)
      const [parentFieldUID, subFieldUID] = fieldUID.split('.')
      if (!subFieldUID) {
        const value = await calculateQuickCompute(targetField, row, row)
        setFieldValue(
          row,
          fieldUID,
          normalizeNumberFieldValue(value, targetField),
          undefined,
          createMissingSubRows,
        )
        continue
      }
      const indexes = subRowIndexesByRow[rowIndex]?.[parentFieldUID]
      const subRows = getTargetSubRows(row, parentFieldUID, indexes, createMissingSubRows)
      for (let index = 0; index < subRows.length; index++) {
        const value = await calculateQuickCompute(targetField, subRows[index], row)
        subRows[index][subFieldUID] = cloneDefaultValue(normalizeNumberFieldValue(value, targetField))
      }
    }
  }

  return {
    configuredFieldUIDs,
    targetFields,
  }
}
