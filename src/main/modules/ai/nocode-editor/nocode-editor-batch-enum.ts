import type { AiActionResult, AiChatRequest } from '../ai.types'

type EnumFieldSummary = {
  tableId: string
  tableName: string
  widgetId: string
  name: string
  enumSourceType: string
  enumOptionCount: number
  enumOptionsPreview: string[]
}

type EnumSummary = {
  formCount: number
  enumFieldCount: number
  customEnumFieldCount: number
  customEnumFieldWithOptionsCount: number
  customEnumFieldWithoutOptionsCount: number
  customEnumFieldAlreadyChineseCount: number
  customEnumFieldNeedingChineseUpdateCount: number
  relationEnumFieldCount: number
  customEnumFields: EnumFieldSummary[]
  relationEnumFields: EnumFieldSummary[]
}

const BATCH_SCOPE_REGEXP = /(所有|全部|整个应用|全局)/
const ENUM_REQUEST_REGEXP = /(单选|下拉|多选|选项|枚举|中文)/

const normalizePreviewOptions = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (item && typeof item === 'object') {
        const label = String((item as any).label || (item as any).value || '').trim()
        return label
      }
      return ''
    })
    .filter(Boolean)
}

const normalizeEnumField = (table: Record<string, any>, widget: Record<string, any>): EnumFieldSummary => {
  const enumOptionsPreview = normalizePreviewOptions(widget?.enumOptionsPreview)
  const enumOptionCount = Math.max(
    Number(widget?.enumOptionCount || 0),
    enumOptionsPreview.length,
  )

  return {
    tableId: String(table?.tableId || '').trim(),
    tableName: String(table?.tableName || '').trim(),
    widgetId: String(widget?.uid || widget?.widgetId || '').trim(),
    name: String(widget?.name || '').trim(),
    enumSourceType: String(widget?.enumSourceType || '').trim(),
    enumOptionCount,
    enumOptionsPreview,
  }
}

const hasLatinLetters = (value: string) => /[A-Za-z]/.test(String(value || '').trim())

const fieldNeedsChineseUpdate = (field: EnumFieldSummary) => {
  if (field.enumOptionCount <= 0) {
    return false
  }
  if (!field.enumOptionsPreview.length) {
    return false
  }
  return field.enumOptionsPreview.some(hasLatinLetters)
}

export const isBatchEnumUpdateRequest = (value: unknown) => {
  const content = String(value || '').trim()
  return BATCH_SCOPE_REGEXP.test(content) && ENUM_REQUEST_REGEXP.test(content)
}

export const summarizeEnumOnlyFormSummariesOutput = (output: unknown): EnumSummary => {
  const forms = Array.isArray((output as any)?.forms) ? (output as any).forms : []
  const customEnumFields: EnumFieldSummary[] = []
  const relationEnumFields: EnumFieldSummary[] = []

  for (const form of forms) {
    const widgets = Array.isArray(form?.widgets) ? form.widgets : []
    for (const widget of widgets) {
      const field = normalizeEnumField(form, widget)
      if (!field.widgetId || !field.name || !field.enumSourceType) {
        continue
      }

      if (field.enumSourceType === 'from-table') {
        relationEnumFields.push(field)
        continue
      }

      customEnumFields.push(field)
    }
  }

  const customEnumFieldWithOptionsCount = customEnumFields.filter(item => item.enumOptionCount > 0).length
  const customEnumFieldWithoutOptionsCount = customEnumFields.length - customEnumFieldWithOptionsCount
  const customEnumFieldNeedingChineseUpdateCount = customEnumFields.filter(fieldNeedsChineseUpdate).length
  const customEnumFieldAlreadyChineseCount = customEnumFields
    .filter(item => item.enumOptionCount > 0)
    .filter(item => !fieldNeedsChineseUpdate(item))
    .length

  return {
    formCount: forms.length,
    enumFieldCount: customEnumFields.length + relationEnumFields.length,
    customEnumFieldCount: customEnumFields.length,
    customEnumFieldWithOptionsCount,
    customEnumFieldWithoutOptionsCount,
    customEnumFieldAlreadyChineseCount,
    customEnumFieldNeedingChineseUpdateCount,
    relationEnumFieldCount: relationEnumFields.length,
    customEnumFields,
    relationEnumFields,
  }
}

const formatFieldList = (fields: EnumFieldSummary[], maxCount = 6) => {
  return fields
    .slice(0, maxCount)
    .map(item => item.tableName ? `${item.tableName} / ${item.name}` : item.name)
    .filter(Boolean)
    .join(global.i18next.t('nocodeEditorBatchEnum.listSeparator'))
}

export const buildBatchEnumInspectionAssistantText = (summary: EnumSummary) => {
  if (summary.customEnumFieldCount <= 0) {
    const relationText = summary.relationEnumFieldCount > 0
      ? global.i18next.t('nocodeEditorBatchEnum.relationFieldsCannotOverride', {
        count: summary.relationEnumFieldCount,
      })
      : global.i18next.t('nocodeEditorBatchEnum.noCustomEnumFields')
    return global.i18next.t('nocodeEditorBatchEnum.noEditableFieldsSummary', { relationText })
  }

  if (summary.customEnumFieldWithOptionsCount > 0) {
    if (summary.customEnumFieldNeedingChineseUpdateCount <= 0) {
      const relationText = summary.relationEnumFieldCount > 0
        ? global.i18next.t('nocodeEditorBatchEnum.relationFieldsPreserved', {
          count: summary.relationEnumFieldCount,
        })
        : ''
      return global.i18next.t('nocodeEditorBatchEnum.optionsAlreadyChinese', {
        count: summary.customEnumFieldWithOptionsCount,
        relationText,
      })
    }
    return ''
  }

  const emptyFieldText = formatFieldList(summary.customEnumFields)
  const relationText = summary.relationEnumFieldCount > 0
    ? global.i18next.t('nocodeEditorBatchEnum.relationFieldCount', {
      count: summary.relationEnumFieldCount,
    })
    : ''
  const fieldHintText = emptyFieldText
    ? global.i18next.t('nocodeEditorBatchEnum.fieldsWithoutOptions', { fields: emptyFieldText })
    : ''

  return global.i18next.t('nocodeEditorBatchEnum.noOptionsConfigured', {
    count: summary.customEnumFieldCount,
    relationText,
    fieldHintText,
  })
}

export const resolveBatchEnumEarlyExitText = (options: {
  request: AiChatRequest
  results: AiActionResult[]
}) => {
  const content = String(options.request.metadata?.userFacingContent || options.request.message || '').trim()
  if (!isBatchEnumUpdateRequest(content)) {
    return ''
  }

  const latestSummary = [...(Array.isArray(options.results) ? options.results : [])]
    .reverse()
    .find(item => item.ok && item.name === 'editor_get_all_form_summaries')
  if (!latestSummary) {
    return ''
  }

  const summary = summarizeEnumOnlyFormSummariesOutput(latestSummary.output)
  if (
    summary.customEnumFieldWithOptionsCount > 0
    && summary.customEnumFieldNeedingChineseUpdateCount > 0
  ) {
    return ''
  }

  return buildBatchEnumInspectionAssistantText(summary)
}
