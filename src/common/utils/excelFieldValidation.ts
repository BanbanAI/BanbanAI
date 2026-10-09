import type { Department, NocodeUser } from '@common/types/account'
import type {
  ExcelFieldItem,
  ExcelFieldValidationInput,
  ExcelFieldValidationResult,
  ExcelLocation,
  ExcelSubformColMaps,
  SheetData,
} from '@common/types/excel'
import type { NocodeBody } from '@common/types/nocode'
import type { Field, FieldType, FieldUID } from '@common/types/project'
import i18next from 'i18next'

import { processCellData } from '@common/utils/validate'

const NUMBER_WIDGET_TYPES = new Set([
  'widget.form.numberInput',
  'widget.form.amountInput',
])

const ARRAY_WIDGET_TYPES = new Set([
  'widget.form.checkboxGroup',
  'widget.form.treeMultipleSelect',
  'widget.form.memberSelect',
  'widget.form.departmentSelect',
])

const OBJECT_WIDGET_TYPES = new Set([
  'widget.form.subform',
  'widget.form.address',
])

const DEFAULT_FAILED_EXAMPLES_LIMIT = 5

const resolveColumnIndex = (excelField: string) => {
  const matched = /^col-(\d+)$/.exec(String(excelField || '').trim())
  return matched ? Number(matched[1]) : -1
}

const getRowspanValues = (sheetData: SheetData, rowIndex: number) => (
  sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1]
)

const getRowHeight = (sheetData: SheetData, rowIndex: number) => (
  Math.max(...getRowspanValues(sheetData, rowIndex))
)

const resolveTitleRowHeightFromInput = (input: ExcelFieldValidationInput) => {
  const mappingKeys = Object.keys(input.mapping || {})
  const isOnlySubformField = mappingKeys.length > 0
    && mappingKeys.every(col => Boolean(input.subformMappings?.[col]))

  let titleRowHeight = getRowHeight(input.sheetData, input.titleRowIndex)
  if (isOnlySubformField) {
    titleRowHeight += getRowHeight(input.sheetData, input.titleRowIndex + titleRowHeight)
  }
  return titleRowHeight
}

export function resolveExcelStorageFieldType(widgetType?: string): FieldType {
  const normalized = String(widgetType || '').trim()
  if (NUMBER_WIDGET_TYPES.has(normalized)) return 'number'
  if (ARRAY_WIDGET_TYPES.has(normalized)) return 'array'
  if (OBJECT_WIDGET_TYPES.has(normalized)) return 'object'
  return 'string'
}

export function resolveExcelFieldValueTypeFromWidgetType(widgetType?: string): FieldType {
  return resolveExcelStorageFieldType(widgetType)
}

export function createExcelValidationField(options: {
  uid: string
  alias: string
  widgetType: string
  isRequired?: boolean
}): Field {
  const uid = options.uid as FieldUID
  return {
    uid,
    alias: options.alias,
    type: resolveExcelStorageFieldType(options.widgetType),
    meta: {
      uid,
      name: options.alias,
      extra: {
        widgetType: options.widgetType,
        isRequired: options.isRequired,
      },
    },
  } as Field
}

function resolveStatus(successCount: number, totalCount: number): ExcelFieldValidationResult['status'] {
  if (totalCount <= 0) return 'all-success'
  if (successCount === 0) return 'all-fail'
  if (successCount < totalCount) return 'some-success'
  return 'all-success'
}

function resolveSeverity(status: ExcelFieldValidationResult['status']): ExcelFieldValidationResult['severity'] {
  if (status === 'not-import') return 'skip'
  if (status === 'all-success') return 'pass'
  if (status === 'some-success') return 'warning'
  return 'error'
}

function collectImportableRowIndexes(sheetData: SheetData, firstDataRowIndex: number): number[] {
  const indexes: number[] = []
  for (let rowIndex = firstDataRowIndex; rowIndex < sheetData.rows.length; rowIndex++) {
    const curRowspanArr = getRowspanValues(sheetData, rowIndex)
    const minRowspan = Math.min(...curRowspanArr)
    if (minRowspan <= 0) continue
    indexes.push(rowIndex)
  }
  return indexes
}

export async function validateExcelColumnAgainstField(options: {
  sheetData: SheetData
  titleRowIndex: number
  titleRowHeight: number
  colIndex: number
  field?: Field
  nocodeBody: NocodeBody
  subformMappings?: ExcelSubformColMaps
  userList?: NocodeUser[]
  departmentList?: Department[]
  relatedDataImportMap?: Record<string, Set<string>>
  maxExamples?: number
}): Promise<ExcelFieldValidationResult> {
  if (!options.field) {
    return {
      status: 'not-import',
      severity: 'skip',
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      failedExamples: [],
      reason: i18next.t('excelFieldValidation.importFieldNotSelected'),
    }
  }

  if (options.sheetData.isSheetNull || options.colIndex < 0) {
    return {
      status: 'all-success',
      severity: 'pass',
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      failedExamples: [],
    }
  }

  const maxExamples = options.maxExamples ?? DEFAULT_FAILED_EXAMPLES_LIMIT
  const rowIndexes = collectImportableRowIndexes(
    options.sheetData,
    options.titleRowIndex + options.titleRowHeight,
  )
  let successCount = 0
  const failedExamples: ExcelFieldValidationResult['failedExamples'] = []

  for (const rowIndex of rowIndexes) {
    const value = options.sheetData.rows[rowIndex]?.[options.colIndex]
    const cellLocation: ExcelLocation = { c: options.colIndex, r: rowIndex }
    const processRes = await processCellData(
      value,
      cellLocation,
      options.field,
      options.sheetData,
      options.titleRowIndex,
      options.nocodeBody,
      options.subformMappings,
      options.userList,
      options.departmentList,
      options.relatedDataImportMap,
    )

    if (processRes.valid) {
      successCount += 1
      continue
    }

    if (failedExamples.length < maxExamples) {
      failedExamples.push({
        rowIndex,
        colIndex: options.colIndex,
        value,
        reason: processRes.reason || i18next.t('excelFieldValidation.fieldTypeMismatch'),
      })
    }
  }

  const totalCount = rowIndexes.length
  const status = resolveStatus(successCount, totalCount)
  return {
    status,
    severity: resolveSeverity(status),
    totalCount,
    successCount,
    failedCount: totalCount - successCount,
    failedExamples,
    reason: failedExamples[0]?.reason,
  }
}

export async function validateExcelField(
  input: ExcelFieldValidationInput,
): Promise<ExcelFieldValidationResult> {
  const colIndex = resolveColumnIndex(input.excelField?.excelField)
  const titleRowHeight = resolveTitleRowHeightFromInput(input)

  return validateExcelColumnAgainstField({
    sheetData: input.sheetData,
    titleRowIndex: input.titleRowIndex,
    titleRowHeight,
    colIndex,
    field: input.field,
    nocodeBody: input.nocodeBody,
    subformMappings: input.subformMappings,
    userList: input.userList,
    departmentList: input.departmentList,
    relatedDataImportMap: input.relatedDataImportMap,
    maxExamples: input.maxFailedExamples,
  })
}

export function resolveExcelFieldValidationStatus(result?: ExcelFieldValidationResult): ExcelFieldItem['fieldMatchResult'] {
  return result?.status || 'not-import'
}
