import { Injectable } from '@nestjs/common'
import { AiAnalysisChartDecision, AiAnalysisChartKind, AiReadAppDataAnalysisResult } from '../ai.types'

@Injectable()
export class AiAnalysisChartPolicyService {
  decide(options: {
    userMessage: string
    analysisResult: AiReadAppDataAnalysisResult
    hintedKind?: AiAnalysisChartKind | null
  }): AiAnalysisChartDecision {
    const userMessage = String(options.userMessage || '').trim()
    const analysisResult = options.analysisResult || {} as AiReadAppDataAnalysisResult
    const metricDefs = Array.isArray(analysisResult.metricDefs) ? analysisResult.metricDefs : []
    const groupDefs = Array.isArray(analysisResult.groupDefs) ? analysisResult.groupDefs : []
    const rows = Array.isArray(analysisResult.rows) ? analysisResult.rows : []
    const topNApplied = analysisResult?.meta?.topNApplied === true
    const hintedKind = this.normalizeChartKind(options.hintedKind)
    const explicitKind = this.resolveExplicitChartKind(userMessage)
    const compareMultiSeriesLayout = this.resolveCompareMultiSeriesLayout(analysisResult)

    if (this.isChartDisabledByUser(userMessage)) {
      return {
        allowed: false,
        reason: 'user_disabled_chart',
        candidates: [],
        userForced: true,
      }
    }

    if (groupDefs.length >= 2 && !compareMultiSeriesLayout) {
      return {
        allowed: false,
        reason: 'multi_dimension_too_complex',
        candidates: [],
      }
    }

    if (!groupDefs.length) {
      return {
        allowed: false,
        reason: 'single_value_no_chart_needed',
        candidates: [],
      }
    }

    if (rows.length <= 1) {
      return {
        allowed: false,
        reason: 'too_few_rows',
        candidates: [],
      }
    }

    if (explicitKind) {
      const explicitDecision = this.buildExplicitKindDecision({
        kind: explicitKind,
        metricDefs,
        groupDefs,
        rows,
        topNApplied,
        compareMultiSeriesLayout,
      })
      if (explicitDecision) {
        return explicitDecision
      }
    }

    if (compareMultiSeriesLayout) {
      return this.buildCompareMultiSeriesDecision({
        compareMultiSeriesLayout,
        hintedKind,
      })
    }

    if (this.isCorrelationIntent(userMessage) && metricDefs.length === 2) {
      return {
        allowed: true,
        candidates: ['scatter'],
        preferred: 'scatter',
        resolvedKind: 'scatter',
      }
    }

    if (metricDefs.length >= 2) {
      return {
        allowed: false,
        reason: 'multi_metric_deferred',
        candidates: [],
      }
    }

    if (rows.length > 20 && !topNApplied) {
      return {
        allowed: false,
        reason: 'too_many_rows_without_topn',
        candidates: [],
      }
    }

    const groupDef = groupDefs[0] || null
    if (groupDef?.timeGranularity || this.isTimeField(groupDef?.field) || this.isTimeField(groupDef?.key)) {
      const candidates: AiAnalysisChartKind[] = ['line']
      const resolvedKind = this.resolveDecisionKind(candidates, 'line', hintedKind)
      return {
        allowed: true,
        candidates,
        preferred: 'line',
        resolvedKind,
      }
    }

    if (this.isShareIntent(userMessage) && rows.length <= 6) {
      const candidates: AiAnalysisChartKind[] = ['donut', 'horizontal-bar']
      const resolvedKind = this.resolveDecisionKind(candidates, 'donut', hintedKind)
      return {
        allowed: true,
        candidates,
        preferred: 'donut',
        resolvedKind,
      }
    }

    const preferred = this.shouldPreferHorizontalBar(rows, groupDef?.key)
      ? 'horizontal-bar'
      : 'bar'
    const candidates: AiAnalysisChartKind[] = ['bar', 'horizontal-bar']
    const resolvedKind = this.resolveDecisionKind(candidates, preferred, hintedKind)

    return {
      allowed: true,
      candidates,
      preferred,
      resolvedKind,
    }
  }

  private buildExplicitKindDecision(options: {
    kind: AiAnalysisChartKind
    metricDefs: Array<any>
    groupDefs: Array<any>
    rows: Array<any>
    topNApplied: boolean
    compareMultiSeriesLayout?: ReturnType<AiAnalysisChartPolicyService['resolveCompareMultiSeriesLayout']>
  }): AiAnalysisChartDecision | null {
    const { kind, metricDefs, groupDefs, rows, topNApplied, compareMultiSeriesLayout } = options

    if (rows.length > 20 && !topNApplied) {
      return {
        allowed: false,
        reason: 'too_many_rows_without_topn',
        candidates: [],
        userForced: true,
      }
    }

    if (kind === 'scatter') {
      if (metricDefs.length === 2) {
        return {
          allowed: true,
          candidates: ['scatter'],
          preferred: 'scatter',
          resolvedKind: 'scatter',
          userForced: true,
        }
      }
      return {
        allowed: false,
        reason: 'explicit_scatter_requires_two_metrics',
        candidates: [],
        userForced: true,
      }
    }

    if (compareMultiSeriesLayout) {
      if (kind === 'bar' || kind === 'horizontal-bar' || kind === 'line') {
        return {
          allowed: true,
          candidates: [kind],
          preferred: kind,
          resolvedKind: kind,
          userForced: true,
        }
      }

      return {
        allowed: false,
        reason: 'multi_dimension_too_complex',
        candidates: [],
        userForced: true,
      }
    }

    if (metricDefs.length >= 2) {
      return {
        allowed: false,
        reason: 'explicit_chart_kind_requires_single_metric',
        candidates: [],
        userForced: true,
      }
    }

    if (!groupDefs.length || rows.length <= 1) {
      return null
    }

    return {
      allowed: true,
      candidates: [kind],
      preferred: kind,
      resolvedKind: kind,
      userForced: true,
    }
  }

  private resolveDecisionKind(
    candidates: AiAnalysisChartKind[],
    preferred: AiAnalysisChartKind,
    hintedKind?: AiAnalysisChartKind | null,
  ) {
    return hintedKind && candidates.includes(hintedKind)
      ? hintedKind
      : preferred
  }

  private resolveExplicitChartKind(message: string): AiAnalysisChartKind | null {
    if (!message) {
      return null
    }

    const mapping: Array<{ kind: AiAnalysisChartKind; patterns: RegExp[] }> = [
      { kind: 'scatter', patterns: [/(?:改成|换成|切换成|用|画|绘制|生成).*(?:散点图)/i, /(?:散点图)/i] },
      { kind: 'donut', patterns: [/(?:改成|换成|切换成|用|画|绘制|生成).*(?:环图|饼图)/i, /(?:环图|饼图)/i] },
      { kind: 'horizontal-bar', patterns: [/(?:改成|换成|切换成|用|画|绘制|生成).*(?:条形图)/i, /(?:条形图)/i] },
      { kind: 'bar', patterns: [/(?:改成|换成|切换成|用|画|绘制|生成).*(?:柱状图)/i, /(?:柱状图)/i] },
      { kind: 'line', patterns: [/(?:改成|换成|切换成|用|画|绘制|生成).*(?:折线图)/i, /(?:折线图)/i] },
    ]

    for (const item of mapping) {
      if (item.patterns.some(pattern => pattern.test(message))) {
        return item.kind
      }
    }
    return null
  }

  private buildCompareMultiSeriesDecision(options: {
    compareMultiSeriesLayout: NonNullable<ReturnType<AiAnalysisChartPolicyService['resolveCompareMultiSeriesLayout']>>
    hintedKind?: AiAnalysisChartKind | null
  }): AiAnalysisChartDecision {
    const { compareMultiSeriesLayout, hintedKind } = options
    const candidates: AiAnalysisChartKind[] = compareMultiSeriesLayout.isTimeSeries
      ? ['line', 'bar']
      : ['bar', 'horizontal-bar']
    const preferred: AiAnalysisChartKind = compareMultiSeriesLayout.isTimeSeries
      ? 'line'
      : this.shouldPreferHorizontalBarLabels(compareMultiSeriesLayout.categoryLabels)
        ? 'horizontal-bar'
        : 'bar'

    return {
      allowed: true,
      candidates,
      preferred,
      resolvedKind: this.resolveDecisionKind(candidates, preferred, hintedKind),
    }
  }

  private resolveCompareMultiSeriesLayout(
    analysisResult: AiReadAppDataAnalysisResult,
  ) {
    const metricDefs = Array.isArray(analysisResult?.metricDefs) ? analysisResult.metricDefs : []
    const groupDefs = Array.isArray(analysisResult?.groupDefs) ? analysisResult.groupDefs : []
    const rows = Array.isArray(analysisResult?.rows) ? analysisResult.rows : []
    if (metricDefs.length !== 1 || groupDefs.length !== 2 || rows.length <= 1) {
      return null
    }

    const compareGroup = groupDefs[0]
    const categoryGroup = groupDefs[1]
    const compareKey = String(compareGroup?.key || '').trim()
    const categoryKey = String(categoryGroup?.key || '').trim()
    if (compareKey !== '__compare_app' || !categoryKey) {
      return null
    }

    const categoryLabels = [...new Set(
      rows
        .map(row => String(row?.display?.dimensions?.[categoryKey] || row?.dimensions?.[categoryKey] || '').trim())
        .filter(Boolean),
    )]
    const compareLabels = [...new Set(
      rows
        .map(row => String(row?.display?.dimensions?.[compareKey] || row?.dimensions?.[compareKey] || '').trim())
        .filter(Boolean),
    )]
    if (categoryLabels.length < 1 || compareLabels.length < 2) {
      return null
    }

    return {
      categoryKey,
      categoryLabels,
      isTimeSeries: Boolean(
        categoryGroup?.timeGranularity
        || this.isTimeField(categoryGroup?.field)
        || this.isTimeField(categoryGroup?.key),
      ),
    }
  }

  private normalizeChartKind(value?: string | null): AiAnalysisChartKind | null {
    const normalized = String(value || '').trim()
    return normalized === 'line'
      || normalized === 'bar'
      || normalized === 'horizontal-bar'
      || normalized === 'donut'
      || normalized === 'scatter'
      ? normalized
      : null
  }

  private isTimeField(value?: string | null) {
    const normalized = String(value || '').trim()
    return /(时间|日期|月份|周|日|hour|day|week|month|year|date|time)/i.test(normalized)
  }

  private isShareIntent(message: string) {
    return /(占比|构成|比例|份额|分布|share|ratio|percent)/i.test(message)
  }

  private isCorrelationIntent(message: string) {
    return /(相关|关系|关联|是否成正比|correlation|relationship|scatter)/i.test(message)
  }

  private isChartDisabledByUser(message: string) {
    return /(不要图|不需要图|别用图|只给我结论|no chart|without chart)/i.test(message)
  }

  private shouldPreferHorizontalBar(rows: Array<any>, groupKey?: string) {
    const key = String(groupKey || '').trim()
    const maxLabelLength = rows.reduce((currentMax, item) => {
      const label = String(item?.display?.dimensions?.[key] || item?.dimensions?.[key] || '').trim()
      return Math.max(currentMax, label.length)
    }, 0)
    return maxLabelLength >= 6
  }

  private shouldPreferHorizontalBarLabels(labels: string[]) {
    const maxLabelLength = (Array.isArray(labels) ? labels : []).reduce((currentMax, item) => {
      return Math.max(currentMax, String(item || '').trim().length)
    }, 0)
    return maxLabelLength >= 6
  }
}
