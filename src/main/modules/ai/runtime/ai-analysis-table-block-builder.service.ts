import { Injectable } from '@nestjs/common'
import type {
  AiAssistantTableBlock,
  AiAssistantTableColumn,
  AiAssistantTableViewVariant,
  AiCrossAppPresentationMetadata,
} from '@common/types/ai'
import type { AiReadAppDataAnalysisResult } from '../ai.types'
import { formatAnalysisGroupLabel, formatAnalysisMetricLabel } from './ai-analysis-display-label.util'

type TableCellValue = string | number | null
type AiAnalysisStructuredViews = {
  primaryTable: AiAssistantTableBlock
  chartDataTable: AiAssistantTableViewVariant
  tableViews?: {
    defaultKey: string
    items: AiAssistantTableViewVariant[]
  }
}

@Injectable()
export class AiAnalysisTableBlockBuilderService {
  buildTableBlocksFromAnalysisResult(input: {
    title?: string
    analysisResult?: AiReadAppDataAnalysisResult | null
    presentation?: AiCrossAppPresentationMetadata
  }): AiAssistantTableBlock[] {
    const context = this.resolveTableBuildContext(input)
    if (!context) {
      return []
    }

    const block = context.shouldExposeTableSwitch
      ? this.buildOneDimensionMultiMetricTable(context.analysisResult, context.groupDefs, context.metricDefs)
      : this.buildRegularTable(context.analysisResult, context.groupDefs, context.metricDefs)

    return [{
      ...block,
      ...(context.title ? { title: context.title } : {}),
      ...(context.presentation ? { presentation: context.presentation } : {}),
    }]
  }

  buildStructuredViewsFromAnalysisResult(input: {
    title?: string
    analysisResult?: AiReadAppDataAnalysisResult | null
    presentation?: AiCrossAppPresentationMetadata
  }): AiAnalysisStructuredViews | null {
    const context = this.resolveTableBuildContext(input)
    if (!context) {
      return null
    }

    const summaryTable = this.buildRegularTable(context.analysisResult, context.groupDefs, context.metricDefs)
    const detailTable = context.shouldExposeTableSwitch
      ? this.buildOneDimensionMultiMetricTable(context.analysisResult, context.groupDefs, context.metricDefs)
      : null
    const chartDataTable = this.buildTableViewVariant('table', summaryTable)

    return {
      primaryTable: {
        ...summaryTable,
        ...(context.title ? { title: context.title } : {}),
        ...(context.presentation ? { presentation: context.presentation } : {}),
      },
      chartDataTable,
      ...(detailTable
        ? {
            tableViews: {
              defaultKey: 'summary',
              items: [
                this.buildTableViewVariant('summary', summaryTable),
                this.buildTableViewVariant('detail', detailTable),
              ],
            },
          }
        : {}),
    }
  }

  private buildOneDimensionMultiMetricTable(
    analysisResult: AiReadAppDataAnalysisResult,
    groupDefs: AiReadAppDataAnalysisResult['groupDefs'],
    metricDefs: AiReadAppDataAnalysisResult['metricDefs'],
  ): Omit<AiAssistantTableBlock, 'title'> {
    const groupDef = groupDefs[0]
    const dimensionKey = this.getDefinitionKey(groupDef)
    const rows = analysisResult.rows.flatMap(row => {
      const dimensionValue = this.resolveDimensionValue(row, dimensionKey)

      return metricDefs.map(metricDef => {
        const metricKey = this.getDefinitionKey(metricDef)
        return {
          [dimensionKey]: dimensionValue,
          __metric_label: formatAnalysisMetricLabel(metricDef),
          __metric_value: this.resolveMetricValue(row, metricKey),
        }
      })
    })

    return {
      type: 'table',
      columns: [
        {
          key: dimensionKey,
          label: formatAnalysisGroupLabel(groupDef),
          role: 'dimension',
          align: 'left',
        },
        {
          key: '__metric_label',
          label: global.i18next.t('aiAnalysisTableBlockBuilder.metric'),
          role: 'text',
          align: 'left',
        },
        {
          key: '__metric_value',
          label: global.i18next.t('aiAnalysisTableBlockBuilder.value'),
          role: 'metric',
          align: 'right',
        },
      ],
      rows,
      merge: {
        columns: [dimensionKey],
        groupBy: [dimensionKey],
      },
    }
  }

  private buildRegularTable(
    analysisResult: AiReadAppDataAnalysisResult,
    groupDefs: AiReadAppDataAnalysisResult['groupDefs'],
    metricDefs: AiReadAppDataAnalysisResult['metricDefs'],
  ): Omit<AiAssistantTableBlock, 'title'> {
    const groupColumns = groupDefs.map(groupDef => ({
      key: this.getDefinitionKey(groupDef),
      label: formatAnalysisGroupLabel(groupDef),
      role: 'dimension',
      align: 'left',
    })) satisfies AiAssistantTableColumn[]
    const metricColumns = metricDefs.map(metricDef => ({
      key: this.getDefinitionKey(metricDef),
      label: formatAnalysisMetricLabel(metricDef),
      role: 'metric',
      align: 'right',
    })) satisfies AiAssistantTableColumn[]
    const rows = analysisResult.rows.map(row => {
      const outputRow: Record<string, TableCellValue> = {}

      for (const groupDef of groupDefs) {
        const key = this.getDefinitionKey(groupDef)
        outputRow[key] = this.resolveDimensionValue(row, key)
      }
      for (const metricDef of metricDefs) {
        const key = this.getDefinitionKey(metricDef)
        outputRow[key] = this.resolveMetricValue(row, key)
      }

      return outputRow
    })
    const firstGroupKey = this.getDefinitionKey(groupDefs[0])

    return {
      type: 'table',
      columns: [
        ...groupColumns,
        ...metricColumns,
      ],
      rows,
      ...(firstGroupKey && rows.length > 1
        ? {
            merge: {
              columns: [firstGroupKey],
              groupBy: [firstGroupKey],
            },
          }
        : {}),
    }
  }

  private resolveDimensionValue(
    row: AiReadAppDataAnalysisResult['rows'][number],
    key: string,
  ): TableCellValue {
    if (Object.prototype.hasOwnProperty.call(row.display?.dimensions || {}, key)) {
      return row.display.dimensions[key]
    }
    if (Object.prototype.hasOwnProperty.call(row.dimensions || {}, key)) {
      return row.dimensions[key]
    }
    return null
  }

  private resolveMetricValue(
    row: AiReadAppDataAnalysisResult['rows'][number],
    key: string,
  ): TableCellValue {
    if (Object.prototype.hasOwnProperty.call(row.display?.metrics || {}, key)) {
      return row.display.metrics[key]
    }
    if (Object.prototype.hasOwnProperty.call(row.metrics || {}, key)) {
      return row.metrics[key]
    }
    return null
  }

  private getDefinitionKey(definition?: { key?: string }) {
    return String(definition?.key || '').trim()
  }

  private resolveTableBuildContext(input: {
    title?: string
    analysisResult?: AiReadAppDataAnalysisResult | null
    presentation?: AiCrossAppPresentationMetadata
  }) {
    const analysisResult = input.analysisResult
    const groupDefs = (Array.isArray(analysisResult?.groupDefs) ? analysisResult.groupDefs : [])
      .filter(definition => this.getDefinitionKey(definition))
    const metricDefs = (Array.isArray(analysisResult?.metricDefs) ? analysisResult.metricDefs : [])
      .filter(definition => this.getDefinitionKey(definition))
    const rows = Array.isArray(analysisResult?.rows) ? analysisResult.rows : []

    if (!analysisResult || !rows.length || !groupDefs.length || !metricDefs.length) {
      return null
    }

    return {
      analysisResult,
      groupDefs,
      metricDefs,
      title: typeof input.title === 'string' && input.title.trim()
        ? input.title.trim()
        : undefined,
      presentation: input.presentation,
      shouldExposeTableSwitch: groupDefs.length === 1 && metricDefs.length > 1,
    }
  }

  private buildTableViewVariant(
    key: string,
    table: Omit<AiAssistantTableBlock, 'title'>,
  ): AiAssistantTableViewVariant {
    return {
      key,
      columns: table.columns,
      rows: table.rows,
      ...(table.merge ? { merge: table.merge } : {}),
    }
  }
}
