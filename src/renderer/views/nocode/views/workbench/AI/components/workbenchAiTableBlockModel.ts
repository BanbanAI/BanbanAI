import type {
  AiAssistantTableBlock,
  AiAssistantTableColumn,
  AiAssistantTableViewVariant,
} from '@common/types/ai'

export type AiTableCellSpan = {
  visible: boolean
  rowspan: number
}

export type AiTableCellSpans = Array<Record<string, AiTableCellSpan>>

type AiTableRow = AiAssistantTableBlock['rows'][number]

export type AiTableRenderCell = {
  column: AiAssistantTableColumn
  value: string
  rowspan?: number
  alignClass: string
}

export type AiTableRenderRow = {
  row: AiTableRow
  cells: AiTableRenderCell[]
}

export type AiTableViewLabels = {
  summaryTableViewLabel: string
  detailTableViewLabel: string
}

export const formatAiTableCellValue = (value: AiTableRow[string]) => String(value ?? '')

export const resolveAiTableViewLabel = (
  view: Pick<AiAssistantTableViewVariant, 'key' | 'label' | 'title'>,
  labels: AiTableViewLabels,
) => {
  if (view.key === 'summary') {
    return labels.summaryTableViewLabel
  }
  if (view.key === 'detail') {
    return labels.detailTableViewLabel
  }
  return String(view.label || view.title || view.key).trim()
}

const resolveAiTableAlign = (column: AiAssistantTableColumn) => {
  if (column.align) {
    return column.align
  }
  return column.role === 'metric' ? 'right' : 'left'
}

export const resolveAiTableAlignClass = (column: AiAssistantTableColumn) => `is-align-${resolveAiTableAlign(column)}`

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const resolveValidMergeConfig = (block: AiAssistantTableBlock) => {
  const columnKeys = new Set(block.columns.map(column => column.key))
  const merge = block.merge
  if (!merge?.columns?.length || !merge.groupBy?.length) {
    return { mergeColumns: new Set<string>(), groupBy: [] as string[] }
  }
  const mergeColumns = new Set(merge.columns.filter(key => columnKeys.has(key)))
  const groupBy = merge.groupBy.filter(key => columnKeys.has(key))
  return { mergeColumns, groupBy }
}

const groupKeyForRow = (row: AiTableRow, groupBy: string[]) => groupBy
  .map(key => `${key}:${String(row[key] ?? '')}`)
  .join('\u0001')

export const buildAiTableCellSpans = (block: AiAssistantTableBlock): AiTableCellSpans => {
  const spans = block.rows.map(() => Object.fromEntries(block.columns.map(column => [
    column.key,
    { visible: true, rowspan: 1 },
  ])) as Record<string, AiTableCellSpan>)

  const { mergeColumns, groupBy } = resolveValidMergeConfig(block)
  if (!mergeColumns.size || !groupBy.length) {
    return spans
  }

  let groupStart = 0
  while (groupStart < block.rows.length) {
    const currentGroupKey = groupKeyForRow(block.rows[groupStart], groupBy)
    let groupEnd = groupStart + 1
    while (groupEnd < block.rows.length && groupKeyForRow(block.rows[groupEnd], groupBy) === currentGroupKey) {
      groupEnd += 1
    }

    const groupSize = groupEnd - groupStart
    for (const column of block.columns) {
      if (!mergeColumns.has(column.key)) {
        continue
      }
      spans[groupStart][column.key] = { visible: true, rowspan: groupSize }
      for (let rowIndex = groupStart + 1; rowIndex < groupEnd; rowIndex += 1) {
        spans[rowIndex][column.key] = { visible: false, rowspan: 0 }
      }
    }

    groupStart = groupEnd
  }

  return spans
}

export const resolveAiTableCellRowspan = (
  cellSpans: AiTableCellSpans,
  block: AiAssistantTableBlock,
  rowIndex: number,
  column: AiAssistantTableColumn,
): number | undefined => {
  const { mergeColumns } = resolveValidMergeConfig(block)
  const rowspan = cellSpans[rowIndex]?.[column.key]?.rowspan || 1
  if (!mergeColumns.has(column.key) || rowspan <= 1) {
    return undefined
  }
  return rowspan
}

export const buildAiTableText = (block: AiAssistantTableBlock) => {
  const header = block.columns.map(column => column.label).join('\t')
  const rows = block.rows.map(row => block.columns
    .map(column => formatAiTableCellValue(row[column.key]))
    .join('\t'))
  return [header, ...rows].join('\n')
}

export const buildAiTableRenderRows = (
  block: AiAssistantTableBlock,
  cellSpans: AiTableCellSpans = buildAiTableCellSpans(block),
): AiTableRenderRow[] => block.rows.map((row, rowIndex) => ({
  row,
  cells: block.columns.flatMap((column) => {
    const span = cellSpans[rowIndex]?.[column.key] || { visible: true, rowspan: 1 }
    if (!span.visible) {
      return []
    }
    return [{
      column,
      value: formatAiTableCellValue(row[column.key]),
      rowspan: resolveAiTableCellRowspan(cellSpans, block, rowIndex, column),
      alignClass: resolveAiTableAlignClass(column),
    }]
  }),
}))

export const buildAiTableFallbackHtml = (
  block: AiAssistantTableBlock,
  cellSpans: AiTableCellSpans = buildAiTableCellSpans(block),
) => {
  const headerHtml = block.columns
    .map(column => `<th class="${escapeHtml(resolveAiTableAlignClass(column))}">${escapeHtml(column.label)}</th>`)
    .join('')
  const bodyHtml = buildAiTableRenderRows(block, cellSpans).map((renderRow) => {
    const cells = renderRow.cells.map((cell) => {
      const rowspan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : ''
      return `<td${rowspan} class="${escapeHtml(cell.alignClass)}">${escapeHtml(cell.value)}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table class="ai-table-block__table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
}
