import type { ExcelFileData } from '@common/types/excel'
import { buildAiAttachmentPromptLines, resolveAiAttachmentIntent } from '@common/utils/aiAttachmentIntent'
import type {
  AiExcelAnalysisColumnContext,
  AiExcelAnalysisConfirmPayload,
  AiExcelAnalysisContext,
  AiExcelAnalysisRequestPayload,
} from '@common/types/aiExcelAnalysis'
import { AiAttachmentMessageMetadata } from '@common/types/aiAttachment'
import i18next from 'i18next'

type BuildAiExcelAnalysisPayloadOptions = {
  fileData: ExcelFileData
  worksheet: string
  titleRowIndex: number
  titleRowHeight: number
  fullPath: string
  sessionId?: string
  distinctColumnValues?: string[][]
}

function normalizeCellText(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function hasExplicitExcelCreateSwitchIntent(text: string) {
  return /(按这个\s*excel.*(建表|创建|建应用|建表单)|按这个表.*(建表|创建)|先别分析|不要再分析|不用再分析|不分析了|直接.*(建表|创建|建应用|建表单)|改成.*(建表|创建))/i.test(text)
}

function collectPreviewSampleValues(rows: unknown[][], colIndex: number, sampleLimit = 5) {
  const values: string[] = []
  for (const row of rows) {
    const text = normalizeCellText(row?.[colIndex])
    if (!text) {
      continue
    }
    values.push(text)
    if (values.length >= sampleLimit) {
      break
    }
  }
  return values
}

function buildColumnContext(options: {
  headers: unknown[]
  typeDataRow: string[]
  previewRows: unknown[][]
  distinctColumnValues?: string[][]
}): AiExcelAnalysisColumnContext[] {
  const { headers, typeDataRow, previewRows, distinctColumnValues } = options
  return headers
    .map((header, colIndex) => {
      const title = normalizeCellText(header) || `col-${colIndex}`
      const distinctValuesSample = Array.isArray(distinctColumnValues?.[colIndex])
        ? distinctColumnValues[colIndex]
          .map(item => normalizeCellText(item))
          .filter(Boolean)
          .slice(0, 10)
        : []
      return {
        columnKey: `col-${colIndex}` as const,
        title,
        inferredType: normalizeCellText(typeDataRow?.[colIndex]) || 'unknown',
        sampleValues: collectPreviewSampleValues(previewRows, colIndex),
        distinctValuesSample,
      }
    })
    .filter(column => !!column.title)
}

export function buildAiExcelAnalysisConfirmPayload(
  options: BuildAiExcelAnalysisPayloadOptions,
): AiExcelAnalysisConfirmPayload {
  const {
    fileData,
    worksheet,
    titleRowIndex,
    titleRowHeight,
    fullPath,
    sessionId,
    distinctColumnValues,
  } = options
  const sheet = fileData.originSheetsData?.[worksheet]
  const rows = sheet?.rows ?? []
  const headers = rows?.[titleRowIndex] ?? []
  const firstDataRowIndex = titleRowIndex + titleRowHeight
  const previewRows = rows.slice(firstDataRowIndex, firstDataRowIndex + 10)
  const typeDataRow = sheet?.typeData?.[firstDataRowIndex] ?? []
  const columns = buildColumnContext({
    headers,
    typeDataRow,
    previewRows,
    distinctColumnValues,
  })

  const context: AiExcelAnalysisContext = {
    fileName: fileData.fileName,
    worksheet,
    availableWorksheets: Array.isArray(fileData.sheets) ? fileData.sheets : [],
    titleRowIndex,
    titleRowHeight,
    previewRowCount: previewRows.length,
    columnCount: columns.length,
    columns,
  }

  return {
    mode: 'analysis',
    context,
    runtimeHandle: {
      fullPath,
      ...(sessionId ? { sessionId } : {}),
    },
  }
}

export function normalizeAiExcelAnalysisContext(value: unknown): AiExcelAnalysisContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>
  const fileName = normalizeCellText(raw.fileName)
  const worksheet = normalizeCellText(raw.worksheet)
  if (!fileName || !worksheet) {
    return null
  }

  const availableWorksheets = Array.isArray(raw.availableWorksheets)
    ? raw.availableWorksheets.map(item => normalizeCellText(item)).filter(Boolean)
    : []
  const titleRowIndex = Number(raw.titleRowIndex)
  const titleRowHeight = Number(raw.titleRowHeight)
  const previewRowCount = Number(raw.previewRowCount)
  const columnCount = Number(raw.columnCount)
  const columns = Array.isArray(raw.columns)
    ? raw.columns
      .map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }
        const column = item as Record<string, unknown>
        const title = normalizeCellText(column.title)
        if (!title) {
          return null
        }
        return {
          columnKey: `col-${index}` as const,
          title,
          inferredType: normalizeCellText(column.inferredType) || 'unknown',
          sampleValues: Array.isArray(column.sampleValues)
            ? column.sampleValues.map(value => normalizeCellText(value)).filter(Boolean)
            : [],
          distinctValuesSample: Array.isArray(column.distinctValuesSample)
            ? column.distinctValuesSample.map(value => normalizeCellText(value)).filter(Boolean)
            : [],
        } satisfies AiExcelAnalysisColumnContext
      })
      .filter(Boolean) as AiExcelAnalysisColumnContext[]
    : []

  return {
    fileName,
    worksheet,
    availableWorksheets,
    titleRowIndex: Number.isFinite(titleRowIndex) ? titleRowIndex : 0,
    titleRowHeight: Number.isFinite(titleRowHeight) ? titleRowHeight : 1,
    previewRowCount: Number.isFinite(previewRowCount) ? previewRowCount : columns.length,
    columnCount: Number.isFinite(columnCount) ? columnCount : columns.length,
    columns,
  }
}

export function resolveLatestAiExcelAnalysisContext(values: unknown[]): AiExcelAnalysisContext | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const candidate = normalizeAiExcelAnalysisContext(
        (value as Record<string, unknown>).excelAnalysisContext ?? value,
      )
      if (candidate) {
        return candidate
      }
      continue
    }

    const candidate = normalizeAiExcelAnalysisContext(value)
    if (candidate) {
      return candidate
    }
  }

  return null
}

export function resolveAiExcelAnalysisContextAfterMessageLoad(options: {
  prepend?: boolean
  loadedMessageMetadata: unknown[]
  existingMessageMetadata?: unknown[]
}): AiExcelAnalysisContext | null {
  const loadedMessageMetadata = Array.isArray(options.loadedMessageMetadata)
    ? options.loadedMessageMetadata
    : []
  const existingMessageMetadata = Array.isArray(options.existingMessageMetadata)
    ? options.existingMessageMetadata
    : []
  const mergedMessageMetadata = options.prepend
    ? [...loadedMessageMetadata, ...existingMessageMetadata]
    : loadedMessageMetadata
  return resolveLatestAiExcelAnalysisContext(mergedMessageMetadata)
}

export function resolveAiExcelAnalysisFollowupBehavior(options: {
  context?: AiExcelAnalysisContext | null
  userFacingContent: string
  baseRequestMetadata?: Record<string, unknown> | null
  disableToolFlag?: 'disableBuiltinAppTools' | 'disableNocodeEditorTools'
}) {
  const context = normalizeAiExcelAnalysisContext(options.context)
  const userFacingContent = normalizeCellText(options.userFacingContent)
  if (!context || !userFacingContent) {
    return null
  }
  if (hasExplicitExcelCreateSwitchIntent(userFacingContent)) {
    return {
      mode: 'switch-to-create' as const,
      assistantReply: i18next.t('aiExcelAnalysis.switchToCreate'),
    }
  }

  const attachmentIntent = resolveAiAttachmentIntent({
    text: userFacingContent,
    attachments: [],
  })
  if (attachmentIntent.route === 'create') {
    return {
      mode: 'switch-to-create' as const,
      assistantReply: i18next.t('aiExcelAnalysis.switchToCreate'),
    }
  }
  if (attachmentIntent.route === 'clarify') {
    return {
      mode: 'clarify' as const,
      assistantReply: i18next.t('aiExcelAnalysis.clarifyAnalyzeOrCreate'),
    }
  }

  return {
    mode: 'continue-analysis' as const,
    requestPayload: buildAiExcelAnalysisContextRequestPayload({
      context,
      userFacingContent,
      baseRequestMetadata: options.baseRequestMetadata,
      disableToolFlag: options.disableToolFlag || 'disableBuiltinAppTools',
    }),
  }
}

export function buildAiExcelAnalysisPromptLines(context: AiExcelAnalysisContext): string[] {
  const normalizedContext = normalizeAiExcelAnalysisContext(context)
  if (!normalizedContext) {
    return []
  }

  const columnLines = normalizedContext.columns.map((column, index) => {
    const parts = [
      `${index + 1}. ${column.title}`,
      `类型=${column.inferredType || 'unknown'}`,
      column.sampleValues.length ? `样例=${column.sampleValues.join(' / ')}` : '',
      column.distinctValuesSample.length ? `去重样本=${column.distinctValuesSample.join(' / ')}` : '',
    ].filter(Boolean)
    return parts.join('；')
  })

  return [
    '当前任务是分析用户上传的 Excel 文件本身，不是在分析系统内已有应用数据。',
    '不要调用 search_apps、get_app_memory、read_app_data，不要输出 handoff，不要默认转成建表、建应用或蓝图流程。',
    `文件名：${normalizedContext.fileName}`,
    `当前工作表：${normalizedContext.worksheet}`,
    normalizedContext.availableWorksheets.length
      ? `可选工作表：${normalizedContext.availableWorksheets.join('、')}`
      : '',
    `标题行：第 ${normalizedContext.titleRowIndex + 1} 行，标题高度 ${normalizedContext.titleRowHeight} 行`,
    `预览数据行数：${normalizedContext.previewRowCount}`,
    `列数：${normalizedContext.columnCount}`,
    normalizedContext.columns.length
      ? `列摘要：\n${columnLines.join('\n')}`
      : '列摘要：暂无可用列信息',
    '请基于这些结构化信息总结文件主题、字段结构、数据分布、异常点和适合继续追问的分析方向；如果信息不足，直接说明不足之处。',
  ].filter(Boolean)
}

export function buildAiExcelAnalysisContextRequestPayload(options: {
  context: AiExcelAnalysisContext
  userFacingContent: string
  baseRequestMetadata?: Record<string, unknown> | null
  disableToolFlag: 'disableBuiltinAppTools' | 'disableNocodeEditorTools'
}): AiExcelAnalysisRequestPayload {
  const userFacingContent = normalizeCellText(options.userFacingContent)
  const baseRequestMetadata = options.baseRequestMetadata && typeof options.baseRequestMetadata === 'object'
    ? { ...options.baseRequestMetadata }
    : {}
  const attachmentPromptLines = buildAiAttachmentPromptLines(baseRequestMetadata as AiAttachmentMessageMetadata)
  const excelPromptLines = buildAiExcelAnalysisPromptLines(options.context)
  const providerPromptContent = [
    userFacingContent,
    ...attachmentPromptLines,
    ...excelPromptLines,
  ].filter(Boolean).join('\n\n')

  return {
    userFacingContent,
    providerPromptContent,
    requestMetadata: {
      ...baseRequestMetadata,
      excelAnalysisContext: options.context,
      [options.disableToolFlag]: true,
      userFacingContent,
      providerPromptContent,
    },
  }
}

export function buildAiExcelAnalysisRequestPayload(options: {
  confirmPayload: AiExcelAnalysisConfirmPayload
  userFacingContent: string
  baseRequestMetadata?: Record<string, unknown> | null
  disableToolFlag: 'disableBuiltinAppTools' | 'disableNocodeEditorTools'
}): AiExcelAnalysisRequestPayload {
  return buildAiExcelAnalysisContextRequestPayload({
    context: options.confirmPayload.context,
    userFacingContent: options.userFacingContent,
    baseRequestMetadata: options.baseRequestMetadata,
    disableToolFlag: options.disableToolFlag,
  })
}
