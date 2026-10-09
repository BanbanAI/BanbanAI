import {
  AI_ASSISTANT_SUPPORTING_KPI_KEYS,
} from '@common/types/ai'
import type {
  AiAssistantChartBlock,
  AiAssistantChartHintPayload,
  AiAssistantChartPayload,
  AiCrossAppPresentationMetadata,
  AiAssistantMarkdownBlock,
  AiAssistantMessageBlock,
  AiAssistantTableBlock,
  AiAssistantTableColumn,
  AiAssistantTableMergeRule,
  AiAssistantAnalysisConclusion,
  AiAssistantSupportingData,
  AiAssistantSupportingKpi,
  AiAssistantSupportingKpiKey,
  AiAssistantPrimaryViewItem,
  AiAssistantPrimaryViewKey,
  AiAssistantPrimaryViews,
  AiAssistantTableViewVariant,
  AiAssistantTableViews,
  AiAssistantArtifactBlock,
  AiAssistantFormulaResultBlock,
  AiAssistantFormulaResultItem,
  AiAssistantFlowPatchResultBlock,
} from '@common/types/ai'
import { normalizeFormulaText } from './formula'
import { normalizeNocodeEditorFormulaPlan } from './nocodeEditorFormulaDomain'
import { buildAiAssistantFlowPatchResultOperationLines } from './aiFlowPatchResultPresentation'
import { sanitizeLegacyBanbanChartOption } from './ai-chart-option-sanitizer'
import {
  isMarkdownFenceClosingLine,
  parseMarkdownFenceOpeningLine,
} from './markdownFence'
import { stripNocodeEditorAppBuilderPlanningFence } from './nocodeEditorAppBuilderPlanningFence'
import { sanitizeNocodeEditorUnsupportedBlueprintProtocol } from './nocodeEditorUnsupportedBlueprintProtocol'
import { stripWorkbenchAppBuilderHandoffIntentLikeFences } from './workbenchAppBuilderHandoffIntent'
import i18next from 'i18next'

const CHART_BLOCK_PATTERN = /```(?:banban-chart|echarts)\s*([\s\S]*?)```/gi
const CHART_HINT_BLOCK_PATTERN = /```banban-chart-hint\s*([\s\S]*?)```/gi
const MIN_CHART_HEIGHT = 220
const MAX_CHART_HEIGHT = 520
const MIN_CHART_WIDTH = 480
const SUPPORTED_KPI_SEMANTIC_TYPES = [
  'record_count',
  'dimension_value_count',
  'time_bucket_count',
  'group_combination_count',
] as const
const SUPPORTED_TIME_GRANULARITIES = [
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'year',
] as const
const MAX_CHART_WIDTH = 2400
const MAX_TABLE_COLUMNS = 12
const MAX_TABLE_ROWS = 200
const PIPE_TABLE_SEPARATOR_CELL_PATTERN = /^:?-{3,}:?$/
const TABLE_COLUMN_ROLES: Array<NonNullable<AiAssistantTableColumn['role']>> = ['dimension', 'metric', 'text']
const TABLE_COLUMN_ALIGNS: Array<NonNullable<AiAssistantTableColumn['align']>> = ['left', 'center', 'right']
const HIDDEN_TABLE_COLUMN_LABELS = new Set([
  'matchedcount',
])

const normalizeTableColumnLabelKey = (value: unknown) => (
  String(value || '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim()
)

export const isAiAssistantTableColumnHidden = (column?: Pick<AiAssistantTableColumn, 'key' | 'label'> | null) => {
  if (!column) {
    return false
  }

  const normalizedLabel = normalizeTableColumnLabelKey(column.label)
  if (HIDDEN_TABLE_COLUMN_LABELS.has(normalizedLabel)) {
    return true
  }

  const normalizedKey = normalizeTableColumnLabelKey(column.key)
  return normalizedKey === 'matchedcount'
}

const clampChartHeight = (value: number | undefined) => {
  if (!Number.isFinite(Number(value))) {
    return 320
  }
  return Math.min(MAX_CHART_HEIGHT, Math.max(MIN_CHART_HEIGHT, Math.round(Number(value))))
}

const clampChartMinWidth = (value: number | undefined) => {
  if (!Number.isFinite(Number(value))) {
    return undefined
  }
  return Math.min(MAX_CHART_WIDTH, Math.max(MIN_CHART_WIDTH, Math.round(Number(value))))
}

const splitPipeTableCells = (line: string) => {
  const normalizedLine = String(line || '').trim()
  if (!normalizedLine.includes('|')) {
    return null
  }

  let content = normalizedLine
  if (content.startsWith('|')) {
    content = content.slice(1)
  }
  if (content.endsWith('|')) {
    content = content.slice(0, -1)
  }

  const cells = content
    .split('|')
    .map(cell => cell.trim())

  return cells.length ? cells : null
}

const parsePipeTableContentCells = (line: string, expectedColumnCount?: number) => {
  const cells = splitPipeTableCells(line)
  if (!cells || cells.length < 2) {
    return null
  }
  if (cells.some(cell => !cell.length)) {
    return null
  }
  if (expectedColumnCount && cells.length !== expectedColumnCount) {
    return null
  }
  return cells
}

const parsePipeTableSeparatorCells = (line: string) => {
  const cells = splitPipeTableCells(line)
  if (!cells?.length) {
    return null
  }
  if (cells.some(cell => !PIPE_TABLE_SEPARATOR_CELL_PATTERN.test(cell))) {
    return null
  }
  return cells
}

const buildPipeTableSeparatorLine = (cells: string[], columnCount: number) => {
  const fallbackCell = cells[cells.length - 1] || '---'
  const normalizedCells = Array.from({ length: columnCount }, (_, index) => cells[index] || fallbackCell)
  return `| ${normalizedCells.join(' | ')} |`
}

const parseFencedCodeBlockMarker = (line: string) => {
  return parseMarkdownFenceOpeningLine(line)?.marker || null
}

const repairMalformedPipeTables = (value: string) => {
  const lines = String(value || '').split('\n')
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headerCells = parsePipeTableContentCells(lines[index])
    if (!headerCells) {
      continue
    }

    const separatorCells = parsePipeTableSeparatorCells(lines[index + 1])
    if (!separatorCells || separatorCells.length >= headerCells.length) {
      continue
    }

    const firstDataRowCells = parsePipeTableContentCells(lines[index + 2], headerCells.length)
    if (!firstDataRowCells) {
      continue
    }

    lines[index + 1] = buildPipeTableSeparatorLine(separatorCells, headerCells.length)
  }

  return lines.join('\n')
}

const repairMalformedPipeTablesOutsideFencedCodeBlocks = (value: string) => {
  const segments: string[] = []
  const textLines: string[] = []
  const fencedCodeBlockLines: string[] = []
  let openingMarker: string | null = null

  const flushTextLines = () => {
    if (!textLines.length) {
      return
    }
    segments.push(repairMalformedPipeTables(textLines.join('\n')))
    textLines.length = 0
  }

  const lines = String(value || '').split('\n')
  for (const line of lines) {
    if (!openingMarker) {
      const fencedCodeBlockMarker = parseFencedCodeBlockMarker(line)
      if (!fencedCodeBlockMarker) {
        textLines.push(line)
        continue
      }

      flushTextLines()
      openingMarker = fencedCodeBlockMarker
      fencedCodeBlockLines.push(line)
      continue
    }

    fencedCodeBlockLines.push(line)
    if (!isMarkdownFenceClosingLine(line, openingMarker)) {
      continue
    }

    segments.push(fencedCodeBlockLines.join('\n'))
    fencedCodeBlockLines.length = 0
    openingMarker = null
  }

  flushTextLines()
  if (fencedCodeBlockLines.length) {
    segments.push(fencedCodeBlockLines.join('\n'))
  }

  return segments.join('\n')
}

const normalizeMarkdownText = (value: string) => (
  repairMalformedPipeTablesOutsideFencedCodeBlocks(
    String(value || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
)

export const sanitizeAiAssistantVisibleContent = (value: string) => {
  return stripWorkbenchAppBuilderHandoffIntentLikeFences(value)
}

const normalizeSupportingKpi = (value: unknown): AiAssistantSupportingKpi | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const key = String(value.key || '').trim()
  const numericValue = String(value.value ?? '').trim()
  const semanticType = String(value.semanticType || '').trim()
  const businessObjectLabel = String(value.businessObjectLabel || '').trim()
  const dimensionLabel = String(value.dimensionLabel || '').trim()
  const timeGranularity = String(value.timeGranularity || '').trim()
  const combinationLabels = Array.isArray(value.combinationLabels)
    ? value.combinationLabels.map(item => String(item || '').trim()).filter(Boolean)
    : []

  if (
    !AI_ASSISTANT_SUPPORTING_KPI_KEYS.includes(key as AiAssistantSupportingKpiKey)
    || !numericValue
  ) {
    return null
  }

  return {
    key: key as AiAssistantSupportingKpiKey,
    value: numericValue,
    ...(SUPPORTED_KPI_SEMANTIC_TYPES.includes(semanticType as any)
      ? { semanticType: semanticType as AiAssistantSupportingKpi['semanticType'] }
      : {}),
    ...(businessObjectLabel ? { businessObjectLabel } : {}),
    ...(dimensionLabel ? { dimensionLabel } : {}),
    ...(SUPPORTED_TIME_GRANULARITIES.includes(timeGranularity as any)
      ? { timeGranularity: timeGranularity as AiAssistantSupportingKpi['timeGranularity'] }
      : {}),
    ...(combinationLabels.length ? { combinationLabels } : {}),
  }
}

const normalizeSupportingData = (value: unknown): AiAssistantSupportingData | undefined => {
  if (!isPlainObject(value)) {
    return undefined
  }

  const seenKpiKeys = new Set<AiAssistantSupportingKpiKey>()
  const kpis = Array.isArray(value.kpis)
    ? value.kpis
      .map(item => normalizeSupportingKpi(item))
      .filter((item): item is AiAssistantSupportingKpi => {
        if (!item || seenKpiKeys.has(item.key)) {
          return false
        }

        seenKpiKeys.add(item.key)
        return true
      })
    : []

  if (!kpis.length) {
    return undefined
  }

  return { kpis }
}

const normalizeAnalysisConclusion = (value: unknown): AiAssistantAnalysisConclusion | undefined => {
  if (!isPlainObject(value)) {
    return undefined
  }

  const items = Array.isArray(value.items)
    ? value.items.map(item => String(item ?? '').trim()).filter(Boolean)
    : []
  const supportingData = normalizeSupportingData(value.supportingData)

  if (!items.length && !supportingData?.kpis.length) {
    return undefined
  }

  return {
    items,
    ...(supportingData ? { supportingData } : {}),
  }
}

const isMarkdownBlock = (block: AiAssistantMessageBlock): block is AiAssistantMarkdownBlock => block.type === 'markdown'

const getMessageBlockSignature = (block: AiAssistantMessageBlock) => {
  if (block.type === 'markdown') {
    return `markdown:${normalizeMarkdownText(block.text)}`
  }

  if (block.type === 'artifact') {
    const hasVersion = 'version' in block ? String(block.version || '').trim() : ''
    const hasRevision = 'revision' in block ? String(block.revision || '').trim() : ''
    const hasStagedAt = 'stagedAt' in block ? String(block.stagedAt || '').trim() : ''
    return [
      'artifact',
      block.kind,
      hasVersion || hasRevision,
      hasStagedAt,
      String(block.status || '').trim(),
      String(block.title || '').trim(),
      String(block.summary || block.message || block.error || '').trim(),
    ].join(':')
  }

  if (block.type === 'table') {
    return [
      'table',
      String(block.title || '').trim(),
      JSON.stringify(block.columns || []),
      JSON.stringify(block.rows || []),
    ].join(':')
  }

  if (block.type === 'formula-result') {
    return [
      'formula-result',
      String(block.title || '').trim(),
      JSON.stringify(block.items || []),
    ].join(':')
  }

  if (block.type === 'flow-patch-result') {
    return [
      'flow-patch-result',
      block.formId,
      String(block.draftVersion),
      JSON.stringify(block.operations),
    ].join(':')
  }

  return [
    'chart',
    block.lib,
    String(block.title || '').trim(),
    String(clampChartHeight(block.height)),
    JSON.stringify(block.option || {}),
  ].join(':')
}

const appendMarkdownBlock = (blocks: AiAssistantMessageBlock[], text: string) => {
  const normalizedText = normalizeMarkdownText(text)
  if (!normalizedText) {
    return
  }

  const lastBlock = blocks[blocks.length - 1]
  if (lastBlock?.type === 'markdown') {
    lastBlock.text = normalizeMarkdownText(`${lastBlock.text}\n\n${normalizedText}`)
    return
  }

  blocks.push({
    type: 'markdown',
    text: normalizedText,
  })
}

const normalizeChartBlock = (
  payload: AiAssistantChartPayload,
  options?: {
    sanitizeLegacyColors?: boolean
  },
): AiAssistantChartBlock | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  if (!payload.option || typeof payload.option !== 'object' || Array.isArray(payload.option)) {
    return null
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : undefined
  const fallbackText = typeof payload.fallbackText === 'string' && payload.fallbackText.trim()
    ? payload.fallbackText.trim()
    : undefined
  const analysisConclusion = normalizeAnalysisConclusion(payload.analysisConclusion)
  const dataTable = normalizeTableViewVariant(payload.dataTable)
  const primaryViews = normalizePrimaryViews(payload.primaryViews)
  const presentation = normalizeCrossAppPresentationMetadata(payload.presentation)

  return {
    type: 'chart',
    lib: 'echarts',
    title,
    height: clampChartHeight(payload.height),
    minWidth: clampChartMinWidth(payload.minWidth),
    fallbackText,
    ...(analysisConclusion ? { analysisConclusion } : {}),
    ...(dataTable ? { dataTable } : {}),
    ...(primaryViews ? { primaryViews } : {}),
    ...(presentation ? { presentation } : {}),
    option: options?.sanitizeLegacyColors
      ? sanitizeLegacyBanbanChartOption(payload.option) as Record<string, any>
      : payload.option,
  }
}

const normalizeChartHint = (payload: AiAssistantChartHintPayload | null | undefined) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const type = String(payload.type || '').trim() as AiAssistantChartHintPayload['type']
  if (!['line', 'bar', 'horizontal-bar', 'donut', 'scatter'].includes(type || '')) {
    return null
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : undefined

  return {
    type,
    title,
  }
}

const isPlainObject = (value: unknown): value is Record<string, any> => (
  Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
)

function normalizePrimaryViews(payload: unknown): AiAssistantPrimaryViews | undefined {
  if (!isPlainObject(payload)) {
    return undefined
  }

  const items = Array.isArray(payload.items)
    ? payload.items
      .map((item: any): AiAssistantPrimaryViewItem | null => {
        const key = String(item?.key || '').trim()
        if (key !== 'chart' && key !== 'table') {
          return null
        }

        const disabledReason = typeof item?.disabledReason === 'string' && item.disabledReason.trim()
          ? item.disabledReason.trim()
          : undefined

        return disabledReason
          ? {
              key: key as AiAssistantPrimaryViewKey,
              enabled: item?.enabled !== false,
              disabledReason,
            }
          : {
              key: key as AiAssistantPrimaryViewKey,
              enabled: item?.enabled !== false,
            }
      })
      .filter((item): item is AiAssistantPrimaryViewItem => item !== null)
    : []

  if (!items.length) {
    return undefined
  }

  const requestedDefaultKey = String(payload.defaultKey || '').trim()
  const fallbackDefaultKey: AiAssistantPrimaryViewKey = items.find(item => item.enabled)?.key || items[0].key
  const defaultKey: AiAssistantPrimaryViewKey = items.some(item => item.key === requestedDefaultKey)
    ? requestedDefaultKey as AiAssistantPrimaryViewKey
    : fallbackDefaultKey

  return {
    defaultKey,
    items,
  }
}

const normalizeTableColumn = (payload: unknown): AiAssistantTableColumn | null => {
  if (!isPlainObject(payload)) {
    return null
  }

  const key = typeof payload.key === 'string' ? payload.key.trim() : ''
  const label = typeof payload.label === 'string' ? payload.label.trim() : ''
  if (!key || !label) {
    return null
  }

  const role = TABLE_COLUMN_ROLES.includes(payload.role)
    ? payload.role as AiAssistantTableColumn['role']
    : undefined
  const align = TABLE_COLUMN_ALIGNS.includes(payload.align)
    ? payload.align as AiAssistantTableColumn['align']
    : undefined

  return {
    key,
    label,
    ...(role ? { role } : {}),
    ...(align ? { align } : {}),
  }
}

const normalizeTableColumns = (payload: unknown) => {
  if (!Array.isArray(payload)) {
    return []
  }

  const columns: AiAssistantTableColumn[] = []
  const seenKeys = new Set<string>()
  for (const item of payload) {
    const column = normalizeTableColumn(item)
    if (!column || isAiAssistantTableColumnHidden(column) || seenKeys.has(column.key)) {
      continue
    }

    columns.push(column)
    seenKeys.add(column.key)
    if (columns.length >= MAX_TABLE_COLUMNS) {
      break
    }
  }

  return columns
}

const normalizeTableCellValue = (value: unknown): string | number | null | undefined => {
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

const normalizeTableRows = (payload: unknown, columns: AiAssistantTableColumn[]) => {
  if (!Array.isArray(payload)) {
    return []
  }

  const rows: AiAssistantTableBlock['rows'] = []
  for (const item of payload) {
    if (!isPlainObject(item)) {
      continue
    }

    const row: Record<string, string | number | null> = {}
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(item, column.key)) {
        continue
      }

      const value = normalizeTableCellValue(item[column.key])
      if (value !== undefined) {
        row[column.key] = value
      }
    }

    if (Object.keys(row).length) {
      rows.push(row)
    }
    if (rows.length >= MAX_TABLE_ROWS) {
      break
    }
  }

  return rows
}

const normalizeTableMergeKeys = (payload: unknown, columnKeys: Set<string>) => {
  if (!Array.isArray(payload)) {
    return []
  }

  const keys: string[] = []
  const seenKeys = new Set<string>()
  for (const item of payload) {
    const key = typeof item === 'string' ? item.trim() : ''
    if (!key || !columnKeys.has(key) || seenKeys.has(key)) {
      continue
    }

    keys.push(key)
    seenKeys.add(key)
  }

  return keys
}

const normalizeTableMergeRule = (
  payload: unknown,
  columns: AiAssistantTableColumn[],
): AiAssistantTableMergeRule | undefined => {
  if (!isPlainObject(payload)) {
    return undefined
  }

  const columnKeys = new Set(columns.map(column => column.key))
  const mergeColumns = normalizeTableMergeKeys(payload.columns, columnKeys)
  const groupBy = normalizeTableMergeKeys(payload.groupBy, columnKeys)
  if (!mergeColumns.length || !groupBy.length) {
    return undefined
  }

  return {
    columns: mergeColumns,
    groupBy,
  }
}

const normalizeTableViewVariant = (payload: unknown): AiAssistantTableViewVariant | null => {
  if (!isPlainObject(payload)) {
    return null
  }

  const key = typeof payload.key === 'string' ? payload.key.trim() : ''
  if (!key) {
    return null
  }

  const columns = normalizeTableColumns(payload.columns)
  const rows = normalizeTableRows(payload.rows, columns)
  if (!columns.length || !rows.length) {
    return null
  }

  const label = typeof payload.label === 'string' && payload.label.trim()
    ? payload.label.trim()
    : undefined
  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : undefined
  const merge = normalizeTableMergeRule(payload.merge, columns)

  return {
    key,
    ...(label ? { label } : {}),
    ...(title ? { title } : {}),
    columns,
    rows,
    ...(merge ? { merge } : {}),
  }
}

const normalizeTableViews = (payload: unknown): AiAssistantTableViews | undefined => {
  if (!isPlainObject(payload)) {
    return undefined
  }

  const items = Array.isArray(payload.items)
    ? payload.items
      .map(item => normalizeTableViewVariant(item))
      .filter((item): item is AiAssistantTableViewVariant => Boolean(item))
    : []

  if (!items.length) {
    return undefined
  }

  const requestedDefaultKey = typeof payload.defaultKey === 'string' ? payload.defaultKey.trim() : ''
  const defaultKey = items.some(item => item.key === requestedDefaultKey)
    ? requestedDefaultKey
    : items[0].key

  return {
    defaultKey,
    items,
  }
}

const normalizeTableBlock = (payload: unknown): AiAssistantTableBlock | null => {
  if (!isPlainObject(payload)) {
    return null
  }

  const columns = normalizeTableColumns(payload.columns)
  if (!columns.length) {
    return null
  }

  const rows = normalizeTableRows(payload.rows, columns)
  if (!rows.length) {
    return null
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : undefined
  const merge = normalizeTableMergeRule(payload.merge, columns)
  const analysisConclusion = normalizeAnalysisConclusion(payload.analysisConclusion)
  const views = normalizeTableViews(payload.views)
  const primaryViews = normalizePrimaryViews(payload.primaryViews)
  const presentation = normalizeCrossAppPresentationMetadata(payload.presentation)

  return {
    type: 'table',
    ...(title ? { title } : {}),
    columns,
    rows,
    ...(merge ? { merge } : {}),
    ...(analysisConclusion ? { analysisConclusion } : {}),
    ...(views ? { views } : {}),
    ...(primaryViews ? { primaryViews } : {}),
    ...(presentation ? { presentation } : {}),
  }
}

const normalizeArtifactBlock = (value: unknown): AiAssistantArtifactBlock | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const rawBlock = value as Record<string, any>
  if (rawBlock.type !== 'artifact') {
    return null
  }

  const kind = String(rawBlock.kind || '').trim()
  if (!['nocode-app', 'app-plan', 'form-plan', 'content-plan', 'formula-plan', 'flow-scheme', 'flow-plan', 'blueprint'].includes(kind)) {
    return null
  }

  if (kind === 'formula-plan') {
    const formulaPlan = normalizeNocodeEditorFormulaPlan(rawBlock.formulaPlan)
    const sourceContext = normalizeFormulaPlanSourceContext(rawBlock.sourceContext)
    if (!formulaPlan || !sourceContext) {
      return null
    }

    return {
      ...rawBlock,
      type: 'artifact',
      kind: 'formula-plan',
      sourceContext,
      formulaPlan,
    } as AiAssistantArtifactBlock
  }

  return {
    ...rawBlock,
    type: 'artifact',
    kind: kind as AiAssistantArtifactBlock['kind'],
  } as AiAssistantArtifactBlock
}

const normalizeFormulaPlanSourceContext = (value: unknown) => {
  if (!isPlainObject(value)) {
    return null
  }

  const taskScopeKey = String(value.taskScopeKey || '').trim()
  const taskId = String(value.taskId || '').trim()
  const nocodeId = String(value.nocodeId || '').trim()
  const formId = String(value.formId || '').trim()
  const evidenceFingerprint = String(value.evidenceFingerprint || '').trim()
  const capturedAt = Number(value.capturedAt || 0)
  if (!taskScopeKey || !nocodeId || !formId || !evidenceFingerprint || !Number.isFinite(capturedAt) || capturedAt <= 0) {
    return null
  }

  const draftRevision = Number(value.draftRevision)
  return {
    ...(taskId ? { taskId } : {}),
    taskScopeKey,
    nocodeId,
    formId,
    ...(Number.isFinite(draftRevision) && draftRevision >= 0 ? { draftRevision } : {}),
    evidenceFingerprint,
    capturedAt,
  }
}

const normalizeFormulaResultItem = (value: unknown): AiAssistantFormulaResultItem | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const tableId = String(value.tableId || '').trim()
  const tableName = String(value.tableName || '').trim()
  const widgetId = String(value.widgetId || '').trim()
  const fieldName = String(value.fieldName || '').trim()
  const formula = normalizeFormulaText(value.formula)
  const displayFormula = String(value.displayFormula || '').trim()
  const formulaPath = String(value.formulaPath || '').trim()

  if (!tableId || !widgetId || !fieldName || !formula) {
    return null
  }

  return {
    tableId,
    ...(tableName ? { tableName } : {}),
    widgetId,
    fieldName,
    formula,
    ...(displayFormula ? { displayFormula } : {}),
    ...(
      formulaPath === 'default-formula' || formulaPath === 'compute-formula'
        ? { formulaPath: formulaPath as AiAssistantFormulaResultItem['formulaPath'] }
        : {}
    ),
  }
}

const normalizeFormulaResultBlock = (value: unknown): AiAssistantFormulaResultBlock | null => {
  if (!isPlainObject(value) || value.type !== 'formula-result') {
    return null
  }

  const items = Array.isArray(value.items)
    ? value.items
      .map(item => normalizeFormulaResultItem(item))
      .filter(Boolean) as AiAssistantFormulaResultItem[]
    : []

  if (!items.length) {
    return null
  }

  const title = String(value.title || '').trim()
  return {
    type: 'formula-result',
    ...(title ? { title } : {}),
    items,
  }
}

const FLOW_PATCH_OPERATION_TYPES = new Set(['add', 'update', 'remove', 'move'])

const normalizeFlowPatchResultBlock = (value: unknown): AiAssistantFlowPatchResultBlock | null => {
  if (!isPlainObject(value) || value.type !== 'flow-patch-result') {
    return null
  }

  const formId = typeof value.formId === 'string' ? value.formId.trim() : ''
  const formName = typeof value.formName === 'string' ? value.formName.trim() : ''
  const sourceVersion = value.sourceVersion
  const draftVersion = value.draftVersion
  const hasActiveVersion = (
    typeof value.activeVersion === 'number'
    && Number.isInteger(value.activeVersion)
    && value.activeVersion > 0
  )
  const activeVersion = value.activeVersion as number
  if (
    !formId
    || typeof sourceVersion !== 'number'
    || !Number.isInteger(sourceVersion)
    || sourceVersion <= 0
    || typeof draftVersion !== 'number'
    || !Number.isInteger(draftVersion)
    || draftVersion <= 0
    || typeof value.createdDraftVersion !== 'boolean'
    || typeof value.activeVersionUnchanged !== 'boolean'
  ) {
    return null
  }

  const operations = Array.isArray(value.operations)
    ? value.operations.flatMap((operation): AiAssistantFlowPatchResultBlock['operations'] => {
      if (!isPlainObject(operation)) {
        return []
      }
      const op = typeof operation.op === 'string' ? operation.op.trim() : ''
      if (!FLOW_PATCH_OPERATION_TYPES.has(op)) {
        return []
      }
      const nodeKey = typeof operation.nodeKey === 'string' ? operation.nodeKey.trim() : ''
      const tempKey = typeof operation.tempKey === 'string' ? operation.tempKey.trim() : ''
      const nodeName = typeof operation.nodeName === 'string' ? operation.nodeName.trim() : ''
      return [{
        op: op as AiAssistantFlowPatchResultBlock['operations'][number]['op'],
        ...(nodeKey ? { nodeKey } : {}),
        ...(tempKey ? { tempKey } : {}),
        ...(nodeName ? { nodeName } : {}),
      }]
    })
    : []
  if (!operations.length) {
    return null
  }

  const warnings = Array.isArray(value.warnings)
    ? value.warnings
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
    : undefined
  return {
    type: 'flow-patch-result',
    formId,
    ...(formName ? { formName } : {}),
    sourceVersion,
    draftVersion,
    createdDraftVersion: value.createdDraftVersion,
    ...(hasActiveVersion ? { activeVersion } : {}),
    activeVersionUnchanged: value.activeVersionUnchanged,
    operations,
    ...(warnings ? { warnings } : {}),
  }
}

const serializeFlowPatchResultBlock = (block: AiAssistantFlowPatchResultBlock) => {
  const operationLines = buildAiAssistantFlowPatchResultOperationLines(block.operations)
  const activeVersionLine = block.activeVersionUnchanged && block.activeVersion
    ? `当前启用版本：V${block.activeVersion}（未受影响）`
    : '当前启用版本：未自动启用此草稿'
  return [
    '[流程草稿修改]',
    `草稿版本：V${block.draftVersion}`,
    ...operationLines,
    activeVersionLine,
  ].join('\n')
}

const resolveFormulaPlanPathLabel = (formulaPath: unknown) => {
  const normalizedPath = String(formulaPath || '').trim()
  if (normalizedPath !== 'default-formula' && normalizedPath !== 'compute-formula') {
    return normalizedPath
  }

  return String(i18next.t(`formulaPlanPresentation.path.${normalizedPath}`, {
    defaultValue: normalizedPath,
  }) || normalizedPath).trim() || normalizedPath
}

const serializeAiAssistantArtifactBlock = (block: AiAssistantArtifactBlock) => {
  if (block.kind === 'nocode-app') {
    return [
      i18next.t('aiMessageBlocks.appCardTag'),
      block.title || block.app?.name || i18next.t('aiMessageBlocks.newApp'),
      block.summary || block.message || '',
    ].filter(Boolean).join('\n')
  }

  if (block.kind === 'app-plan') {
    return [
      i18next.t('aiMessageBlocks.appPlanTag'),
      block.title || block.appPlan?.goal || i18next.t('aiMessageBlocks.appPlan'),
      block.summary || block.message || '',
    ].filter(Boolean).join('\n')
  }

  if (block.kind === 'form-plan') {
    return [
      i18next.t('aiMessageBlocks.formPlanTag'),
      block.title || i18next.t('aiMessageBlocks.appStructurePreview'),
      block.summary || block.message || '',
    ].filter(Boolean).join('\n')
  }

  if (block.kind === 'content-plan') {
    return [
      i18next.t('aiMessageBlocks.contentPlanTag'),
      block.title || i18next.t('aiMessageBlocks.contentPlan'),
      block.summary || block.message || '',
    ].filter(Boolean).join('\n')
  }

  if (block.kind === 'formula-plan') {
    const presentation = block.formulaPresentation
    const presentationItems = Array.isArray(presentation?.planningItems)
      ? presentation.planningItems.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const planningItems = presentationItems.length
      ? presentationItems
      : (block.formulaPlan?.items || []).flatMap(item => (
        item.formulaSettings.map(setting => (
          [
            [item.target.formName, item.target.fieldName].filter(Boolean).join(' / '),
            resolveFormulaPlanPathLabel(setting.formulaPath),
            setting.formula,
          ].filter(Boolean).join('；')
        ))
      ))
    return [
      i18next.t('aiMessageBlocks.formulaPlanTag'),
      block.title || block.formulaPlan?.title || i18next.t('formulaPlanPresentation.title'),
      block.summary || block.formulaPlan?.summary || presentation?.goal || '',
      ...planningItems,
    ].filter(Boolean).join('\n')
  }

  if (block.kind === 'flow-scheme') {
    return [
      i18next.t('aiMessageBlocks.flowSchemeTag'),
      block.title || i18next.t('aiMessageBlocks.flowScheme'),
      block.summary || block.message || '',
    ].filter(Boolean).join('\n')
  }

  if (block.kind === 'flow-plan') {
    return [
      i18next.t('aiMessageBlocks.flowBlueprintTag'),
      block.title || i18next.t('aiMessageBlocks.flowBlueprint'),
      block.summary || block.message || '',
    ].filter(Boolean).join('\n')
  }

  return [
    i18next.t('aiMessageBlocks.blueprintDetailTag'),
    block.title || i18next.t('aiMessageBlocks.blueprintDraft'),
    block.summary || block.message || '',
  ].filter(Boolean).join('\n')
}

const normalizeMessageBlocks = (blocks: AiAssistantMessageBlock[]) => {
  const normalizedBlocks: AiAssistantMessageBlock[] = []

  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      continue
    }

    if (block.type === 'markdown') {
      appendMarkdownBlock(normalizedBlocks, String(block.text || ''))
      continue
    }

    if (block.type === 'artifact') {
      const normalizedArtifactBlock = normalizeArtifactBlock(block)
      if (normalizedArtifactBlock) {
        normalizedBlocks.push(normalizedArtifactBlock)
      }
      continue
    }

    if (block.type === 'chart' && block.lib === 'echarts') {
      const normalizedChartBlock = normalizeChartBlock(block)
      if (normalizedChartBlock) {
        normalizedBlocks.push(normalizedChartBlock)
      }
      continue
    }

    if (block.type === 'table') {
      const normalizedTableBlock = normalizeTableBlock(block)
      if (normalizedTableBlock) {
        normalizedBlocks.push(normalizedTableBlock)
      }
      continue
    }

    if (block.type === 'formula-result') {
      const normalizedFormulaResultBlock = normalizeFormulaResultBlock(block)
      if (normalizedFormulaResultBlock) {
        normalizedBlocks.push(normalizedFormulaResultBlock)
      }
      continue
    }

    if (block.type === 'flow-patch-result') {
      const normalizedFlowPatchResultBlock = normalizeFlowPatchResultBlock(block)
      if (normalizedFlowPatchResultBlock) {
        normalizedBlocks.push(normalizedFlowPatchResultBlock)
      }
    }
  }

  return normalizedBlocks
}

const dedupeMessageBlocks = (blocks: AiAssistantMessageBlock[]) => {
  const dedupedBlocks: AiAssistantMessageBlock[] = []
  const appendedSignatures = new Set<string>()

  for (const block of normalizeMessageBlocks(blocks)) {
    const signature = getMessageBlockSignature(block)
    if (appendedSignatures.has(signature)) {
      continue
    }
    appendedSignatures.add(signature)

    if (block.type === 'markdown') {
      appendMarkdownBlock(dedupedBlocks, block.text)
      continue
    }

    dedupedBlocks.push(block)
  }

  return dedupedBlocks
}

export const resolveAiAssistantPresentationNotice = (
  presentation?: AiCrossAppPresentationMetadata | null,
) => {
  const normalizedPresentation = normalizeCrossAppPresentationMetadata(presentation)
  if (!normalizedPresentation) {
    return ''
  }

  const parts: string[] = [normalizedPresentation.status]
  if (normalizedPresentation.limitationReasons?.length) {
    parts.push(`reasons=${normalizedPresentation.limitationReasons.join(',')}`)
  }
  if (normalizedPresentation.transition) {
    parts.push(`transition=${normalizedPresentation.transition}`)
  }

  return `cross_app_presentation: ${parts.join(' | ')}`
}

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))]
    : []
)

const normalizeCrossAppPresentationMetadata = (value: unknown): AiCrossAppPresentationMetadata | undefined => {
  if (!isPlainObject(value)) {
    return undefined
  }

  const status = String(value.status || '').trim()
  if (!['fully_comparable', 'partially_comparable', 'unresolved'].includes(status)) {
    return undefined
  }

  const limitationReasons = normalizeStringList(value.limitationReasons)
  const scopeApps = normalizeStringList(value.scopeLabels?.apps)
  const scopeSources = normalizeStringList(value.scopeLabels?.sources)
  const alignmentMetrics = normalizeStringList(value.alignmentSummary?.metrics)
  const alignmentGroups = normalizeStringList(value.alignmentSummary?.groups)
  const grain = typeof value.alignmentSummary?.grain === 'string' || value.alignmentSummary?.grain === null
    ? value.alignmentSummary?.grain ?? null
    : undefined
  const transition = String(value.transition || '').trim()

  return {
    status: status as AiCrossAppPresentationMetadata['status'],
    ...(limitationReasons.length ? { limitationReasons } : {}),
    ...((scopeApps.length || scopeSources.length)
      ? {
          scopeLabels: {
            ...(scopeApps.length ? { apps: scopeApps } : {}),
            ...(scopeSources.length ? { sources: scopeSources } : {}),
          },
        }
      : {}),
    ...((alignmentMetrics.length || alignmentGroups.length || grain !== undefined)
      ? {
          alignmentSummary: {
            ...(alignmentMetrics.length ? { metrics: alignmentMetrics } : {}),
            ...(alignmentGroups.length ? { groups: alignmentGroups } : {}),
            ...(grain !== undefined ? { grain } : {}),
          },
        }
      : {}),
    ...(['inherit', 'narrow', 'expand', 'invalidate'].includes(transition)
      ? { transition: transition as AiCrossAppPresentationMetadata['transition'] }
      : {}),
  }
}

const serializeMarkdownTableCell = (value: string | number | null | undefined) => (
  String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
)

const serializeMarkdownTableTitle = (value: string | undefined) => (
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
)

const serializeAnalysisConclusion = (value?: AiAssistantAnalysisConclusion | null) => {
  const items = value?.items?.map(item => String(item ?? '').trim()).filter(Boolean) || []
  if (!items.length) {
    return ''
  }

  return [
    i18next.t('aiMessageBlocks.analysisConclusionHeading'),
    ...items.map(item => `- ${item}`),
  ].join('\n')
}

const serializeAiAssistantTableLikeBlock = (
  block: {
    title?: string
    label?: string
    columns: AiAssistantTableColumn[]
    rows: Array<Record<string, string | number | null>>
  },
) => {
  const header = block.columns.map(column => serializeMarkdownTableCell(column.label))
  const separator = block.columns.map(() => '---')
  const rows = block.rows.map(row => (
    block.columns.map(column => serializeMarkdownTableCell(row[column.key]))
  ))

  const tableText = [
    header,
    separator,
    ...rows,
  ]
    .map(cells => `| ${cells.join(' | ')} |`)
    .join('\n')
  const title = serializeMarkdownTableTitle(block.title || block.label)
  return title ? `### ${title}\n\n${tableText}` : tableText
}

const resolveDefaultTableView = (block: AiAssistantTableBlock) => (
  block.views?.items.find(item => item.key === block.views?.defaultKey)
  || block.views?.items[0]
)

const serializeAiAssistantTableBlock = (block: AiAssistantTableBlock) => {
  const presentationNotice = resolveAiAssistantPresentationNotice(block.presentation)
  const analysisConclusionText = serializeAnalysisConclusion(block.analysisConclusion)
  const defaultView = resolveDefaultTableView(block)
  const tableText = serializeAiAssistantTableLikeBlock(defaultView || block)

  const parts = [presentationNotice, analysisConclusionText, tableText].filter(Boolean)
  return parts.join('\n\n')
}

const serializeAiAssistantChartBlock = (block: AiAssistantChartBlock) => {
  const payload = {
    title: block.title,
    height: clampChartHeight(block.height),
    minWidth: clampChartMinWidth(block.minWidth),
    fallbackText: block.fallbackText,
    presentation: normalizeCrossAppPresentationMetadata(block.presentation),
    option: block.option,
  }
  const presentationNotice = resolveAiAssistantPresentationNotice(block.presentation)
  const analysisConclusionText = serializeAnalysisConclusion(block.analysisConclusion)
  const chartText = [
    '```banban-chart',
    JSON.stringify(payload, null, 2),
    '```',
  ].join('\n')

  const parts = [presentationNotice, analysisConclusionText, chartText].filter(Boolean)
  return parts.join('\n\n')
}

export const resolveAiAssistantMessageBlocks = (rawBlocks?: unknown) => {
  if (!Array.isArray(rawBlocks)) {
    return []
  }

  return normalizeMessageBlocks(rawBlocks as AiAssistantMessageBlock[])
}

export const resolveAiAssistantRenderableBlocks = (content: string, rawBlocks?: unknown) => {
  const parsedBlocks = parseAiAssistantMessageContent(content).blocks
  const metadataBlocks = resolveAiAssistantMessageBlocks(rawBlocks)

  if (!parsedBlocks.length) {
    return metadataBlocks
  }

  if (!metadataBlocks.length) {
    return parsedBlocks
  }

  return dedupeMessageBlocks([
    ...parsedBlocks,
    ...metadataBlocks,
  ])
}

const resolveFormulaResultDisplayFieldName = (item: AiAssistantFormulaResultItem) => {
  const fieldName = String(item.fieldName || '').trim()
  const tableName = String(item.tableName || '').trim()
  if (!fieldName) {
    return tableName
  }
  if (!tableName || fieldName.includes('.')) {
    return fieldName
  }
  return `${tableName}.${fieldName}`
}

const formatFormulaResultDisplayFormula = (item: AiAssistantFormulaResultItem) => (
  String(item.displayFormula || item.formula || '').trim().replace(/\s*\*\s*/g, ' × ')
)

export const serializeAiAssistantMessageBlocks = (rawBlocks?: unknown) => {
  const blocks = resolveAiAssistantMessageBlocks(rawBlocks)
  if (!blocks.length) {
    return ''
  }

  return blocks
    .map(block => {
      if (block.type === 'markdown') {
        return normalizeMarkdownText(block.text)
      }
      if (block.type === 'artifact') {
        return serializeAiAssistantArtifactBlock(block)
      }
      if (block.type === 'table') {
        return serializeAiAssistantTableBlock(block)
      }
      if (block.type === 'formula-result') {
        return block.items
          .map(item => [
            i18next.t('aiMessageBlocks.formulaUpdatedHeading', {
              field: resolveFormulaResultDisplayFieldName(item),
            }),
            '```text',
            formatFormulaResultDisplayFormula(item),
            '```',
          ].join('\n'))
          .join('\n\n')
      }
      if (block.type === 'flow-patch-result') {
        return serializeFlowPatchResultBlock(block)
      }
      return serializeAiAssistantChartBlock(block)
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

export const resolveAiAssistantMessageText = (content: string, rawBlocks?: unknown) => {
  const serializedBlocks = serializeAiAssistantMessageBlocks(rawBlocks)
  if (serializedBlocks) {
    const parsedContent = parseAiAssistantMessageContent(content).content
    return [parsedContent, serializedBlocks]
      .map(part => String(part || '').trim())
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }
  return parseAiAssistantMessageContent(content).content
}

export const parseAiAssistantMessageContent = (content: string) => {
  const normalizedContent = sanitizeNocodeEditorUnsupportedBlueprintProtocol(
    sanitizeAiAssistantVisibleContent(
      stripNocodeEditorAppBuilderPlanningFence(String(content || '')),
    ),
    { replaceWhenDetected: true },
  )
  let contentWithoutHints = ''
  let hintCursor = 0
  let chartHint: ReturnType<typeof normalizeChartHint> = null

  CHART_HINT_BLOCK_PATTERN.lastIndex = 0
  let hintMatch = CHART_HINT_BLOCK_PATTERN.exec(normalizedContent)
  while (hintMatch) {
    const [rawBlock, rawPayload = ''] = hintMatch
    const blockStartIndex = hintMatch.index
    contentWithoutHints += normalizedContent.slice(hintCursor, blockStartIndex)
    try {
      const parsedHint = normalizeChartHint(JSON.parse(rawPayload.trim()) as AiAssistantChartHintPayload)
      if (parsedHint) {
        chartHint = parsedHint
      }
    } catch {
      // Ignore invalid hint payloads and keep parsing.
    }
    hintCursor = blockStartIndex + rawBlock.length
    hintMatch = CHART_HINT_BLOCK_PATTERN.exec(normalizedContent)
  }
  contentWithoutHints += normalizedContent.slice(hintCursor)

  const blocks: AiAssistantMessageBlock[] = []
  let cursor = 0
  let hasStructuredBlocks = false

  CHART_BLOCK_PATTERN.lastIndex = 0
  let match = CHART_BLOCK_PATTERN.exec(contentWithoutHints)
  while (match) {
    const [rawBlock, rawPayload = ''] = match
    const blockStartIndex = match.index

    appendMarkdownBlock(blocks, contentWithoutHints.slice(cursor, blockStartIndex))

    let parsedChartBlock: AiAssistantChartBlock | null = null
    try {
      parsedChartBlock = normalizeChartBlock(
        JSON.parse(rawPayload.trim()) as AiAssistantChartPayload,
        { sanitizeLegacyColors: true },
      )
    } catch {
      parsedChartBlock = null
    }

    if (parsedChartBlock) {
      blocks.push(parsedChartBlock)
      hasStructuredBlocks = true
    } else {
      appendMarkdownBlock(blocks, rawBlock)
    }

    cursor = blockStartIndex + rawBlock.length
    match = CHART_BLOCK_PATTERN.exec(contentWithoutHints)
  }

  appendMarkdownBlock(blocks, contentWithoutHints.slice(cursor))

  return {
    content: blocks
      .filter(isMarkdownBlock)
      .map(block => block.text)
      .join('\n\n')
      .trim(),
    blocks: normalizeMessageBlocks(blocks),
    hasStructuredBlocks,
    chartHint,
  }
}
