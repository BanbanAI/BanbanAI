import { Injectable } from '@nestjs/common'
import type { AiAssistantChartBlock, AiCrossAppPresentationMetadata } from '@common/types/ai'
import { AiAnalysisChartKind, AiReadAppDataAnalysisResult } from '../ai.types'
import {
  getAnalysisChartPalette,
  getBarItemStyle,
  getCategoricalItemColors,
  getLineSeriesStyle,
  getScatterSeriesStyle,
  getSemanticColor,
} from './ai-analysis-chart-style'
import { formatAnalysisGroupLabel, formatAnalysisMetricLabel } from './ai-analysis-display-label.util'

type ChartSeriesValue = number | null
type CompareMultiSeriesLayout = {
  categoryKey: string
  categoryLabel: string
  categoryLabels: string[]
  metricLabel: string
  seriesValues: Array<{
    name: string
    values: ChartSeriesValue[]
  }>
}

const DEFAULT_CARTESIAN_GRID_TOP = 24
const MIN_NAMED_AXIS_GRID_TOP = 40
const NAMED_AXIS_GRID_RIGHT = 56
const HORIZONTAL_BAR_GRID_LEFT = 16
const HORIZONTAL_BAR_GRID_TOP = 72
const HORIZONTAL_BAR_GRID_TOP_COMPACT = 104
const HORIZONTAL_BAR_GRID_RIGHT = 56
const HORIZONTAL_BAR_GRID_RIGHT_COMPACT = 88
const HORIZONTAL_BAR_X_AXIS_NAME_GAP = 30
const HORIZONTAL_BAR_MIN_HEIGHT = 280
const HORIZONTAL_BAR_MIN_WIDTH_THRESHOLD = 6
const HORIZONTAL_BAR_MIN_WIDTH_FLOOR = 640
const HORIZONTAL_BAR_MIN_PLOT_WIDTH = 360
const CATEGORY_AXIS_LABEL_MARGIN = 12
const VERTICAL_BAR_MAX_WIDTH = 36
const VERTICAL_BAR_CATEGORY_GAP = '56%'
const HORIZONTAL_BAR_MAX_WIDTH = 32
const HORIZONTAL_BAR_CATEGORY_GAP = '44%'

@Injectable()
export class AiAnalysisChartBuilderService {
  build(
    kind: AiAnalysisChartKind,
    result: AiReadAppDataAnalysisResult,
    title?: string,
    presentation?: AiCrossAppPresentationMetadata,
  ): AiAssistantChartBlock {
    const block = (() => {
      switch (kind) {
      case 'line':
        return this.buildLineChart(result, title)
      case 'bar':
        return this.buildBarChart(result, title, false)
      case 'horizontal-bar':
        return this.buildBarChart(result, title, true)
      case 'donut':
        return this.buildDonutChart(result, title)
      case 'scatter':
        return this.buildScatterChart(result, title)
      default:
        return this.buildBarChart(result, title, false)
      }
    })()

    return presentation
      ? {
          ...block,
          presentation,
        }
      : block
  }

  private buildLineChart(result: AiReadAppDataAnalysisResult, title?: string): AiAssistantChartBlock {
    const compareMultiSeriesLayout = this.resolveCompareMultiSeriesLayout(result)
    if (compareMultiSeriesLayout) {
      return this.buildCompareMultiSeriesLineChart(compareMultiSeriesLayout, title)
    }

    const labels = this.getCategoryLabels(result)
    const seriesName = this.getPrimaryMetricLabel(result)
    const lineColor = getSemanticColor(seriesName)
    return {
      type: 'chart',
      lib: 'echarts',
      title,
      height: 320,
      minWidth: this.resolveCategoricalChartMinWidth(labels),
      option: {
        color: [lineColor],
        tooltip: { trigger: 'item' },
        grid: this.buildCartesianGrid({ left: 48, right: NAMED_AXIS_GRID_RIGHT, top: DEFAULT_CARTESIAN_GRID_TOP, bottom: 40, containLabel: true }, seriesName),
        xAxis: {
          type: 'category',
          data: labels,
          name: this.getPrimaryGroupLabel(result),
        },
        yAxis: {
          type: 'value',
          name: seriesName,
        },
        series: [{
          type: 'line',
          name: seriesName,
          smooth: true,
          data: this.getPrimaryMetricValues(result),
          ...getLineSeriesStyle(lineColor),
        }],
      },
    }
  }

  private buildBarChart(result: AiReadAppDataAnalysisResult, title: string | undefined, horizontal: boolean): AiAssistantChartBlock {
    const compareMultiSeriesLayout = this.resolveCompareMultiSeriesLayout(result)
    if (compareMultiSeriesLayout) {
      return this.buildCompareMultiSeriesBarChart(compareMultiSeriesLayout, title, horizontal)
    }

    const rawLabels = this.getCategoryLabels(result)
    const labels = horizontal
      ? rawLabels.map(label => this.formatHorizontalBarLabel(label))
      : rawLabels
    const horizontalLayout = horizontal
      ? this.resolveHorizontalBarLayout(labels)
      : null
    const groupKey = this.getPrimaryGroupKey(result)
    const itemColors = getCategoricalItemColors(rawLabels, { groupKey })
    const seriesName = this.getPrimaryMetricLabel(result)
    const values = this.getPrimaryMetricValues(result)
    const axisCategory = {
      type: 'category',
      data: labels,
      name: horizontal ? undefined : this.getPrimaryGroupLabel(result),
      nameLocation: horizontal ? undefined : 'end',
      nameGap: horizontal ? undefined : 16,
      nameTextStyle: horizontal
        ? undefined
        : {
            align: 'right',
            verticalAlign: 'top',
          },
      axisLabel: horizontal
        ? {
            hideOverlap: false,
            margin: CATEGORY_AXIS_LABEL_MARGIN,
          }
        : {
            hideOverlap: false,
            interval: 0,
            margin: CATEGORY_AXIS_LABEL_MARGIN,
          },
    }
    const axisValue = {
      type: 'value',
      name: seriesName,
      position: horizontal ? 'top' : undefined,
      nameLocation: horizontal ? 'end' : undefined,
      nameGap: horizontal ? HORIZONTAL_BAR_X_AXIS_NAME_GAP : undefined,
      splitNumber: horizontal ? 4 : undefined,
      axisLabel: horizontal
        ? {
            hideOverlap: false,
            margin: 10,
            showMinLabel: true,
            showMaxLabel: true,
          }
        : undefined,
      nameTextStyle: horizontal
        ? {
            padding: [0, 0, 0, 0],
            align: 'right',
            verticalAlign: 'top',
          }
        : undefined,
    }
    const yAxisName = String((horizontal ? axisCategory : axisValue).name || '').trim()

    return {
      type: 'chart',
      lib: 'echarts',
      title,
      height: horizontal
        ? this.resolveHorizontalBarHeight(labels, horizontalLayout?.top)
        : Math.min(420, Math.max(320, 220 + labels.length * 28)),
      minWidth: horizontal ? horizontalLayout?.minWidth : this.resolveCategoricalChartMinWidth(labels),
      option: {
        color: getAnalysisChartPalette(),
        tooltip: { trigger: 'item' },
        grid: this.buildCartesianGrid({
          left: horizontal ? (horizontalLayout?.left ?? HORIZONTAL_BAR_GRID_LEFT) : 48,
          right: horizontal ? (horizontalLayout?.right ?? HORIZONTAL_BAR_GRID_RIGHT) : NAMED_AXIS_GRID_RIGHT,
          top: horizontal ? (horizontalLayout?.top ?? HORIZONTAL_BAR_GRID_TOP) : DEFAULT_CARTESIAN_GRID_TOP,
          bottom: horizontal ? 20 : 40,
          containLabel: true,
        }, yAxisName),
        xAxis: horizontal ? axisValue : axisCategory,
        yAxis: horizontal ? axisCategory : axisValue,
        series: [{
          type: 'bar',
          name: seriesName,
          ...this.resolveBarSeriesLayout(horizontal),
          data: values.map((value, index) => ({
            value,
            itemStyle: {
              ...getBarItemStyle(horizontal),
              color: itemColors[index],
            },
          })),
        }],
      },
    }
  }

  private buildCompareMultiSeriesLineChart(
    layout: CompareMultiSeriesLayout,
    title?: string,
  ): AiAssistantChartBlock {
    const seriesNames = layout.seriesValues.map(item => item.name)
    const seriesColors = seriesNames.map(name => getSemanticColor(name))
    return {
      type: 'chart',
      lib: 'echarts',
      title,
      height: 340,
      minWidth: this.resolveCategoricalChartMinWidth(layout.categoryLabels),
      option: {
        color: seriesColors,
        legend: {
          top: 0,
          data: seriesNames,
        },
        tooltip: { trigger: 'axis' },
        grid: this.buildCartesianGrid(
          { left: 48, right: NAMED_AXIS_GRID_RIGHT, top: 64, bottom: 40, containLabel: true },
          layout.metricLabel,
        ),
        xAxis: {
          type: 'category',
          data: layout.categoryLabels,
          name: layout.categoryLabel,
        },
        yAxis: {
          type: 'value',
          name: layout.metricLabel,
        },
        series: layout.seriesValues.map((item, index) => ({
          type: 'line',
          name: item.name,
          smooth: true,
          data: item.values,
          ...getLineSeriesStyle(seriesColors[index]),
        })),
      },
    }
  }

  private buildCompareMultiSeriesBarChart(
    layout: CompareMultiSeriesLayout,
    title: string | undefined,
    horizontal: boolean,
  ): AiAssistantChartBlock {
    const rawLabels = layout.categoryLabels
    const labels = horizontal
      ? rawLabels.map(label => this.formatHorizontalBarLabel(label))
      : rawLabels
    const horizontalLayout = horizontal
      ? this.resolveHorizontalBarLayout(labels)
      : null
    const seriesNames = layout.seriesValues.map(item => item.name)
    const seriesColors = seriesNames.map(name => getSemanticColor(name))
    const axisCategory = {
      type: 'category',
      data: labels,
      name: horizontal ? undefined : layout.categoryLabel,
      nameLocation: horizontal ? undefined : 'end',
      nameGap: horizontal ? undefined : 16,
      nameTextStyle: horizontal
        ? undefined
        : {
            align: 'right',
            verticalAlign: 'top',
          },
      axisLabel: horizontal
        ? {
            hideOverlap: false,
            margin: CATEGORY_AXIS_LABEL_MARGIN,
          }
        : {
            hideOverlap: false,
            interval: 0,
            margin: CATEGORY_AXIS_LABEL_MARGIN,
          },
    }
    const axisValue = {
      type: 'value',
      name: layout.metricLabel,
      position: horizontal ? 'top' : undefined,
      nameLocation: horizontal ? 'end' : undefined,
      nameGap: horizontal ? HORIZONTAL_BAR_X_AXIS_NAME_GAP : undefined,
      splitNumber: horizontal ? 4 : undefined,
      axisLabel: horizontal
        ? {
            hideOverlap: false,
            margin: 10,
            showMinLabel: true,
            showMaxLabel: true,
          }
        : undefined,
      nameTextStyle: horizontal
        ? {
            padding: [0, 0, 0, 0],
            align: 'right',
            verticalAlign: 'top',
          }
        : undefined,
    }
    const yAxisName = String((horizontal ? axisCategory : axisValue).name || '').trim()

    return {
      type: 'chart',
      lib: 'echarts',
      title,
      height: horizontal
        ? this.resolveHorizontalBarHeight(labels, horizontalLayout?.top)
        : Math.min(420, Math.max(320, 220 + labels.length * 28)),
      minWidth: horizontal ? horizontalLayout?.minWidth : this.resolveCategoricalChartMinWidth(labels),
      option: {
        color: seriesColors,
        legend: {
          top: 0,
          data: seriesNames,
        },
        tooltip: { trigger: 'axis' },
        grid: this.buildCartesianGrid({
          left: horizontal ? (horizontalLayout?.left ?? HORIZONTAL_BAR_GRID_LEFT) : 48,
          right: horizontal ? (horizontalLayout?.right ?? HORIZONTAL_BAR_GRID_RIGHT) : NAMED_AXIS_GRID_RIGHT,
          top: horizontal ? Math.max(horizontalLayout?.top ?? HORIZONTAL_BAR_GRID_TOP, 104) : 64,
          bottom: horizontal ? 20 : 40,
          containLabel: true,
        }, yAxisName),
        xAxis: horizontal ? axisValue : axisCategory,
        yAxis: horizontal ? axisCategory : axisValue,
        series: layout.seriesValues.map((item, index) => ({
          type: 'bar',
          name: item.name,
          ...this.resolveBarSeriesLayout(horizontal),
          data: item.values,
          itemStyle: {
            ...getBarItemStyle(horizontal),
            color: seriesColors[index],
          },
        })),
      },
    }
  }

  private buildDonutChart(result: AiReadAppDataAnalysisResult, title?: string): AiAssistantChartBlock {
    const groupKey = this.getPrimaryGroupKey(result)
    const metricKey = this.getPrimaryMetricKey(result)
    const seriesName = this.getPrimaryMetricLabel(result)
    const labels = this.getCategoryLabels(result)
    const itemColors = getCategoricalItemColors(labels, { groupKey })
    return {
      type: 'chart',
      lib: 'echarts',
      title,
      height: 360,
      option: {
        color: getAnalysisChartPalette(),
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [{
          type: 'pie',
          name: seriesName,
          radius: ['48%', '72%'],
          data: (Array.isArray(result.rows) ? result.rows : []).map((item, index) => {
            const label = String(item?.display?.dimensions?.[groupKey] || item?.dimensions?.[groupKey] || '').trim()
            return {
              name: label,
              value: item?.metrics?.[metricKey] ?? null,
              itemStyle: { color: itemColors[index] || getSemanticColor(label) },
            }
          }),
        }],
      },
    }
  }

  private buildScatterChart(result: AiReadAppDataAnalysisResult, title?: string): AiAssistantChartBlock {
    const firstMetricKey = String(result?.metricDefs?.[0]?.key || '').trim()
    const secondMetricKey = String(result?.metricDefs?.[1]?.key || '').trim()
    if (!firstMetricKey || !secondMetricKey) {
      return this.buildBarChart(result, title, false)
    }
    const firstMetricLabel = this.getMetricLabel(result, 0)
    const secondMetricLabel = this.getMetricLabel(result, 1)
    const scatterColor = getSemanticColor(firstMetricLabel)
    return {
      type: 'chart',
      lib: 'echarts',
      title,
      height: 340,
      option: {
        color: [scatterColor],
        tooltip: { trigger: 'item' },
        grid: this.buildCartesianGrid({ left: 56, right: NAMED_AXIS_GRID_RIGHT, top: DEFAULT_CARTESIAN_GRID_TOP, bottom: 40, containLabel: true }, secondMetricLabel),
        xAxis: {
          type: 'value',
          name: firstMetricLabel,
        },
        yAxis: {
          type: 'value',
          name: secondMetricLabel,
        },
        series: [{
          type: 'scatter',
          data: (Array.isArray(result.rows) ? result.rows : []).map(item => [
            item?.metrics?.[firstMetricKey] ?? null,
            item?.metrics?.[secondMetricKey] ?? null,
          ]),
          ...getScatterSeriesStyle(scatterColor),
        }],
      },
    }
  }

  private getPrimaryGroupKey(result: AiReadAppDataAnalysisResult) {
    return String(result?.groupDefs?.[0]?.key || '').trim()
  }

  private buildCartesianGrid(
    grid: { left: number; right: number; top?: number; bottom: number; containLabel?: boolean },
    yAxisName?: string,
  ) {
    const normalizedYAxisName = String(yAxisName || '').trim()
    const baseTop = Number(grid.top ?? DEFAULT_CARTESIAN_GRID_TOP)
    return {
      ...grid,
      top: normalizedYAxisName
        ? Math.max(baseTop, MIN_NAMED_AXIS_GRID_TOP)
        : baseTop,
    }
  }

  private resolveCategoricalChartMinWidth(labels: string[]) {
    const normalizedLabels = Array.isArray(labels)
      ? labels.map(label => String(label || '').trim()).filter(Boolean)
      : []
    if (!normalizedLabels.length) {
      return undefined
    }

    const longestLabelWidth = this.resolveMaxLabelVisualWidth(normalizedLabels)
    const perCategoryWidth = Math.min(160, Math.max(72, longestLabelWidth + 24))
    const minWidthFloor = normalizedLabels.length <= 2
      ? (longestLabelWidth > 120 ? 840 : 560)
      : normalizedLabels.length <= HORIZONTAL_BAR_MIN_WIDTH_THRESHOLD
        ? (longestLabelWidth > 120 ? 840 : 640)
        : (longestLabelWidth > 120 ? 840 : 720)
    return Math.min(1800, Math.max(minWidthFloor, normalizedLabels.length * perCategoryWidth + 120))
  }

  private resolveHorizontalBarHeight(labels: string[], top = HORIZONTAL_BAR_GRID_TOP) {
    const totalLineCount = (Array.isArray(labels) ? labels : [])
      .reduce((sum, label) => sum + Math.max(1, String(label || '').split('\n').filter(Boolean).length), 0)
    return Math.min(560, Math.max(HORIZONTAL_BAR_MIN_HEIGHT, 116 + top + totalLineCount * 34))
  }

  private resolveBarSeriesLayout(horizontal: boolean) {
    return horizontal
      ? {
          barMaxWidth: HORIZONTAL_BAR_MAX_WIDTH,
          barCategoryGap: HORIZONTAL_BAR_CATEGORY_GAP,
        }
      : {
          barMaxWidth: VERTICAL_BAR_MAX_WIDTH,
          barCategoryGap: VERTICAL_BAR_CATEGORY_GAP,
        }
  }

  private resolveHorizontalBarLayout(labels: string[]) {
    const normalizedLabels = Array.isArray(labels)
      ? labels.map(label => String(label || '').trim()).filter(Boolean)
      : []
    const longestLabelWidth = this.resolveMaxLabelVisualWidth(normalizedLabels)
    const hasMultilineLabel = normalizedLabels.some(label => label.includes('\n'))
    const needsCompactTopGutter = hasMultilineLabel || longestLabelWidth > 96
    const top = needsCompactTopGutter ? HORIZONTAL_BAR_GRID_TOP_COMPACT : HORIZONTAL_BAR_GRID_TOP
    const right = needsCompactTopGutter ? HORIZONTAL_BAR_GRID_RIGHT_COMPACT : HORIZONTAL_BAR_GRID_RIGHT

    return {
      left: HORIZONTAL_BAR_GRID_LEFT,
      right,
      top,
      minWidth: this.resolveHorizontalBarMinWidth(normalizedLabels, longestLabelWidth, right),
    }
  }

  private resolveHorizontalBarMinWidth(labels: string[], longestLabelWidth?: number, right = HORIZONTAL_BAR_GRID_RIGHT) {
    const normalizedLabels = Array.isArray(labels)
      ? labels.map(label => String(label || '').trim()).filter(Boolean)
      : []
    if (!normalizedLabels.length) {
      return undefined
    }

    const resolvedLongestLabelWidth = Number.isFinite(Number(longestLabelWidth))
      ? Number(longestLabelWidth)
      : this.resolveMaxLabelVisualWidth(normalizedLabels)
    const hasMultilineLabel = normalizedLabels.some(label => label.includes('\n'))
    const requiresWideCanvas = hasMultilineLabel
      || normalizedLabels.length > 4
      || resolvedLongestLabelWidth > 84
    if (!requiresWideCanvas) {
      return undefined
    }

    return Math.min(
      1800,
      Math.max(
        HORIZONTAL_BAR_MIN_WIDTH_FLOOR,
        HORIZONTAL_BAR_GRID_LEFT + right + HORIZONTAL_BAR_MIN_PLOT_WIDTH + resolvedLongestLabelWidth,
      ),
    )
  }

  private getPrimaryGroupLabel(result: AiReadAppDataAnalysisResult) {
    return formatAnalysisGroupLabel(result?.groupDefs?.[0])
  }

  private getPrimaryMetricKey(result: AiReadAppDataAnalysisResult) {
    return String(result?.metricDefs?.[0]?.key || '').trim()
  }

  private getMetricLabel(result: AiReadAppDataAnalysisResult, index: number) {
    return formatAnalysisMetricLabel(result?.metricDefs?.[index])
  }

  private getPrimaryMetricLabel(result: AiReadAppDataAnalysisResult) {
    return this.getMetricLabel(result, 0)
  }

  private getCategoryLabels(result: AiReadAppDataAnalysisResult) {
    const groupKey = this.getPrimaryGroupKey(result)
    return (Array.isArray(result.rows) ? result.rows : []).map(item =>
      String(item?.display?.dimensions?.[groupKey] || item?.dimensions?.[groupKey] || '').trim(),
    )
  }

  private getPrimaryMetricValues(result: AiReadAppDataAnalysisResult): ChartSeriesValue[] {
    const metricKey = this.getPrimaryMetricKey(result)
    return (Array.isArray(result.rows) ? result.rows : []).map(item => item?.metrics?.[metricKey] ?? null)
  }

  private resolveCompareMultiSeriesLayout(
    result: AiReadAppDataAnalysisResult,
  ): CompareMultiSeriesLayout | null {
    const groupDefs = Array.isArray(result?.groupDefs) ? result.groupDefs : []
    if (groupDefs.length !== 2 || this.getPrimaryMetricKey(result) === '') {
      return null
    }

    const compareGroupKey = String(groupDefs[0]?.key || '').trim()
    const categoryGroupKey = String(groupDefs[1]?.key || '').trim()
    if (compareGroupKey !== '__compare_app' || !categoryGroupKey) {
      return null
    }

    const metricKey = this.getPrimaryMetricKey(result)
    const isTimeSeries = Boolean(groupDefs[1]?.timeGranularity)
    const categoryEntries: Array<{
      key: string
      label: string
    }> = []
    const seriesOrder: string[] = []
    const seriesValueMap = new Map<string, Map<string, ChartSeriesValue>>()
    const categoryLabelMap = new Map<string, string>()

    ;(Array.isArray(result.rows) ? result.rows : []).forEach(item => {
      const seriesName = String(
        item?.display?.dimensions?.[compareGroupKey]
        || item?.dimensions?.[compareGroupKey]
        || '',
      ).trim()
      const categoryKey = String(item?.dimensions?.[categoryGroupKey] || '').trim()
      const categoryLabel = String(
        item?.display?.dimensions?.[categoryGroupKey]
        || item?.dimensions?.[categoryGroupKey]
        || '',
      ).trim()
      if (!seriesName || !categoryKey || !categoryLabel) {
        return
      }

      if (!seriesValueMap.has(seriesName)) {
        seriesValueMap.set(seriesName, new Map())
        seriesOrder.push(seriesName)
      }
      if (!categoryLabelMap.has(categoryKey)) {
        categoryLabelMap.set(categoryKey, categoryLabel)
        categoryEntries.push({
          key: categoryKey,
          label: categoryLabel,
        })
      }

      const rawValue = item?.metrics?.[metricKey]
      const numericValue = rawValue === null || rawValue === undefined
        ? null
        : Number(rawValue)
      seriesValueMap.get(seriesName)?.set(
        categoryKey,
        numericValue === null || Number.isFinite(numericValue)
          ? numericValue
          : null,
      )
    })

    if (seriesOrder.length < 2 || !categoryEntries.length) {
      return null
    }

    const orderedCategoryEntries = isTimeSeries
      ? [...categoryEntries].sort((left, right) => this.compareCategoryKeys(left.key, right.key))
      : categoryEntries
    const categoryLabels = orderedCategoryEntries.map(item => item.label)

    return {
      categoryKey: categoryGroupKey,
      categoryLabel: formatAnalysisGroupLabel(groupDefs[1]),
      categoryLabels,
      metricLabel: this.getPrimaryMetricLabel(result),
      seriesValues: seriesOrder.map(name => ({
        name,
        values: orderedCategoryEntries.map(item => seriesValueMap.get(name)?.get(item.key) ?? null),
      })),
    }
  }

  private compareCategoryKeys(left: string, right: string) {
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber
    }

    return String(left).localeCompare(String(right))
  }

  private resolveMaxLabelVisualWidth(labels: string[]) {
    return (Array.isArray(labels) ? labels : [])
      .map(label => this.resolveLabelVisualWidth(String(label || '').trim()))
      .reduce((max, current) => Math.max(max, current), 0)
  }

  private resolveLabelVisualWidth(label: string) {
    return String(label || '')
      .split('\n')
      .map(segment => this.estimateLabelVisualWidth(segment.trim()))
      .reduce((max, current) => Math.max(max, current), 0)
  }

  private formatHorizontalBarLabel(label: string) {
    const normalizedLabel = String(label || '').trim()
    if (!normalizedLabel) {
      return ''
    }

    const slashSeparatedParts = normalizedLabel
      .split(/\s*\/\s*/)
      .map(item => item.trim())
      .filter(Boolean)
    if (slashSeparatedParts.length > 1) {
      return slashSeparatedParts.join('\n')
    }

    return normalizedLabel
  }

  private estimateLabelVisualWidth(label: string) {
    return Array.from(String(label || '')).reduce((sum, char) => {
      if (/[\u4e00-\u9fff]/.test(char)) {
        return sum + 12
      }
      if (/\s/.test(char)) {
        return sum + 4
      }
      if (/[A-Z0-9]/.test(char)) {
        return sum + 7
      }
      if (/[a-z]/.test(char)) {
        return sum + 6
      }
      return sum + 6
    }, 0)
  }
}
