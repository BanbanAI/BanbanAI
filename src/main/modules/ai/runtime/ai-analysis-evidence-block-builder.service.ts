import { Injectable } from '@nestjs/common'
import type { AiAssistantMarkdownBlock } from '@common/types/ai'
import type { AiThreadRecordAnalysisSnapshot } from '../ai.types'
import { normalizeRecordAnalysisSnapshot, normalizeRecordAnalysisSnapshots } from './ai-record-analysis-snapshot.util'
import {
  formatAnalysisGroupLabel,
  formatAnalysisMetricLabel,
  humanizeAnalysisLabel,
  resolveAnalysisMetricBaseLabel,
} from './ai-analysis-display-label.util'

@Injectable()
export class AiAnalysisEvidenceBlockBuilderService {
  buildMarkdownBlock(
    snapshotsOrSnapshot: AiThreadRecordAnalysisSnapshot | AiThreadRecordAnalysisSnapshot[],
    options: { compact: boolean },
  ): AiAssistantMarkdownBlock | null {
    const snapshots = this.resolveSnapshots(snapshotsOrSnapshot)
    if (!snapshots.length) {
      return null
    }

    const sources = snapshots.map(snapshot => this.buildStrictSource(snapshot))
    if (sources.some(source => !source)) {
      return null
    }

    const sourceList = sources as Array<{ label: string; href: string }>
    const statsLines = snapshots.length > 1
      ? snapshots.map((snapshot, index) => {
          const notes = this.buildNotes(snapshot, options)
          const source = sourceList[index]
          return notes.length
            ? global.i18next.t('aiAnalysisEvidenceBlockBuilder.sourceStats', {
              source: source.label,
              stats: notes.join(global.i18next.t('aiAnalysisEvidenceBlockBuilder.sectionSeparator')),
            })
            : ''
        }).filter(Boolean)
      : this.buildNotes(snapshots[0], options)

    if (!statsLines.length) {
      return null
    }

    return {
      type: 'markdown',
      text: [
        '---',
        '',
        global.i18next.t('aiAnalysisEvidenceBlockBuilder.dataSourcesHeading'),
        ...sourceList.map(source => `- [${source.label}](${source.href})`),
        '',
        global.i18next.t('aiAnalysisEvidenceBlockBuilder.statisticsHeading'),
        ...statsLines.map(item => `- ${item}`),
      ].join('\n'),
    }
  }

  private resolveSnapshots(
    snapshotsOrSnapshot: AiThreadRecordAnalysisSnapshot | AiThreadRecordAnalysisSnapshot[],
  ) {
    if (Array.isArray(snapshotsOrSnapshot)) {
      return normalizeRecordAnalysisSnapshots(snapshotsOrSnapshot) || []
    }

    const snapshot = normalizeRecordAnalysisSnapshot(snapshotsOrSnapshot)
    return snapshot ? [snapshot] : []
  }

  private buildStrictSource(snapshot: AiThreadRecordAnalysisSnapshot) {
    const appId = String(snapshot.appId || '').trim()
    const targetId = String(snapshot.targetId || '').trim()
    if (!appId || !targetId) {
      return null
    }

    const label = this.buildSourceLabel(snapshot)

    return {
      label,
      href: `#/app/${appId}/${targetId}`,
    }
  }

  private buildSourceLabel(snapshot: AiThreadRecordAnalysisSnapshot) {
    const appName = String(snapshot.appName || '').trim()
    const targetName = String(snapshot.targetName || '').trim()
    if (appName && targetName) {
      return `${appName}-${targetName}`
    }

    return String(
      targetName
      || snapshot.targetId
      || appName
      || snapshot.appId,
    ).trim() || global.i18next.t('aiAnalysisEvidenceBlockBuilder.dataForm')
  }

  private buildNotes(snapshot: AiThreadRecordAnalysisSnapshot, options: { compact: boolean }) {
    const analysisResult = snapshot.analysisResult || {}
    const meta = analysisResult.meta || {}
    const groupDefs = Array.isArray(analysisResult.groupDefs) ? analysisResult.groupDefs : []
    const metricDefs = Array.isArray(analysisResult.metricDefs) ? analysisResult.metricDefs : []
    const metricLabels = metricDefs
      .map(item => formatAnalysisMetricLabel(item))
      .filter(Boolean)
    const metricBaseLabelMap = new Map(
      metricDefs
        .map(item => {
          const key = String(item?.key || '').trim()
          const label = resolveAnalysisMetricBaseLabel(item)
          return key && label ? [key, label] as const : null
        })
        .filter(Boolean) as Array<readonly [string, string]>,
    )
    const totalSummaries = Object.entries(analysisResult.totalsDisplay || {})
      .slice(0, 3)
      .map(([key, value]) => {
        const normalizedKey = String(key).trim()
        const label = metricBaseLabelMap.get(normalizedKey)
          || humanizeAnalysisLabel(normalizedKey)
          || normalizedKey
        return `${label}=${String(value || '').trim()}`
      })
      .filter(item => !/=$/.test(item))

    return [
      global.i18next.t('aiAnalysisEvidenceBlockBuilder.currentFiltersApplied'),
      Number.isFinite(Number(meta.matchedCount))
        ? global.i18next.t('aiAnalysisEvidenceBlockBuilder.matchedRecords', { count: Number(meta.matchedCount) })
        : '',
      Number.isFinite(Number(meta.groupCount))
        ? this.buildGroupSummary(groupDefs, Number(meta.groupCount))
        : '',
      metricLabels.length
        ? global.i18next.t('aiAnalysisEvidenceBlockBuilder.metrics', {
          metrics: metricLabels.join(global.i18next.t('aiAnalysisEvidenceBlockBuilder.listSeparator')),
        })
        : '',
      totalSummaries.length
        ? global.i18next.t('aiAnalysisEvidenceBlockBuilder.totals', {
          totals: totalSummaries.join(global.i18next.t('aiAnalysisEvidenceBlockBuilder.sectionSeparator')),
        })
        : '',
      meta.topNApplied ? global.i18next.t('aiAnalysisEvidenceBlockBuilder.topNApplied') : '',
      !options.compact && meta.truncated ? global.i18next.t('aiAnalysisEvidenceBlockBuilder.resultTruncated') : '',
    ].filter(Boolean)
  }

  private buildGroupSummary(groupDefs: any[], groupCount: number) {
    if (!groupDefs.length) {
      return ''
    }

    if (groupDefs.length === 1) {
      return global.i18next.t('aiAnalysisEvidenceBlockBuilder.groupSummary', {
        count: groupCount,
        groups: formatAnalysisGroupLabel(groupDefs[0]),
      })
    }

    const labels = groupDefs
      .map(item => this.formatGroupSummaryLabel(item))
      .filter(Boolean)

    if (!labels.length) {
      return ''
    }

    return global.i18next.t('aiAnalysisEvidenceBlockBuilder.groupSummary', {
      count: groupCount,
      groups: labels.join(global.i18next.t('aiAnalysisEvidenceBlockBuilder.listSeparator')),
    })
  }

  private formatGroupSummaryLabel(definition?: {
    key?: string
    field?: string
    timeGranularity?: string | null
  }) {
    const normalizedLabel = formatAnalysisGroupLabel(definition)
    if (normalizedLabel) {
      return normalizedLabel
    }

    const key = String(definition?.key || '').trim()
    const field = String(definition?.field || '').trim()
    const preferredSource = field || key

    return humanizeAnalysisLabel(preferredSource)
      || field
      || key
  }
}
