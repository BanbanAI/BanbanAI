export type AiExcelAnalysisColumnContext = {
  columnKey: `col-${number}`
  title: string
  inferredType: string
  sampleValues: string[]
  distinctValuesSample: string[]
}

export type AiExcelAnalysisContext = {
  fileName: string
 worksheet: string
  availableWorksheets: string[]
  titleRowIndex: number
  titleRowHeight: number
  previewRowCount: number
  columnCount: number
  columns: AiExcelAnalysisColumnContext[]
}

export type AiExcelAnalysisRuntimeHandle = {
  fullPath: string
  sessionId?: string
}

export type AiExcelAnalysisConfirmPayload = {
  mode: 'analysis'
  context: AiExcelAnalysisContext
  runtimeHandle: AiExcelAnalysisRuntimeHandle
}

export type AiExcelAnalysisRequestPayload = {
  userFacingContent: string
  providerPromptContent: string
  requestMetadata: Record<string, unknown>
}
