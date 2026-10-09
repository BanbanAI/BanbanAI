import type {
  AiAssistantSupportingData,
  AiAssistantSupportingKpi as SharedAiAssistantSupportingKpi,
  AiAssistantSupportingKpiKey,
  AiAssistantSupportingTimeGranularity,
  AiAssistantChartBlock,
  AiAssistantMarkdownBlock,
  AiAssistantMessageBlock,
  AiAssistantTableBlock,
} from '@common/types/ai'
import type { AiAttachmentReference } from '@common/types/aiAttachment'
import type { AppBuilderCreationMode } from '@common/types/appBuilderHandoff'
import { normalizeAiAttachmentReference } from '@common/utils/aiAttachmentIntent'
import { resolveAppBuilderHandoffExcelAttachmentReference } from '@common/utils/appBuilderHandoff'
import i18next from 'i18next'

export type AiAssistantStructuredBlock = AiAssistantChartBlock | AiAssistantTableBlock

export type AiAnalysisEvidenceLink = {
  label: string
  href: string
}

export type AiAnalysisEvidenceSummary = {
  sourceTitle: string
  statsTitle: string
  sourceLinks: AiAnalysisEvidenceLink[]
  statsLines: string[]
  sourceSummaryText: string
  summaryText: string
  detailText: string
  markdownText: string
}

export type AiAnalysisSupportingKpi = SharedAiAssistantSupportingKpi & {
  text?: string
}

export type AiAnalysisSupportingKpiKey = AiAssistantSupportingKpiKey

export type AiAnalysisSupportingData = Omit<AiAssistantSupportingData, 'kpis'> & {
  kpis?: AiAnalysisSupportingKpi[]
  deltaLabel?: string
}

export type AiAnalysisSupportingDisplayCopy = {
  recordPrefix: string
  recordSuffix: string
  defaultRecordLabel: string
  groupPrefix: string
  defaultGroupLabel: string
  combinationSuffix: string
  timeBucketLabels: Record<AiAssistantSupportingTimeGranularity, string>
}

export type AiAssistantMarkdownRenderableItem = {
  type: 'markdown'
  block: AiAssistantMarkdownBlock
}

export type AiAssistantStructuredRenderableItem = {
  type: 'structured'
  block: AiAssistantStructuredBlock
  evidence: AiAnalysisEvidenceSummary | null
  leadingSummaryText?: string
}

export type AiAssistantRenderableItem =
  | AiAssistantMarkdownRenderableItem
  | AiAssistantStructuredRenderableItem

export type WorkbenchAiAppBuilderHandoffPreview = {
  actionType: 'app-builder-handoff'
  handoffId: string
  creationMode: AppBuilderCreationMode
  status?: 'ready' | 'continuing' | 'consumed' | 'abandoned'
  title: string
  summary: string
  materialsSummary?: string
  excelAttachment?: AiAttachmentReference
  sourceThreadId: string
  targetApp?: {
    appId?: string
    appName?: string
  } | null
  candidateApps?: Array<{
    appId?: string
    appName: string
  }>
  clarification?: {
    required: boolean
    question: string
    options: Array<{
      value: Exclude<AppBuilderCreationMode, 'undecided'>
      label: string
    }>
  } | null
}

export type WorkbenchAiAppBuilderHandoffIssueCode =
  | 'missing_entry_title'
  | 'invalid_creation_mode'
  | 'invalid_intent_kind'
  | 'invalid_json'

export type WorkbenchAiAppBuilderHandoffIssuePreview = {
  actionType: 'app-builder-handoff-issue'
  issueCode: WorkbenchAiAppBuilderHandoffIssueCode
  title: string
  summary: string
  sourceThreadId: string
}

export type WorkbenchAiAppBuilderHandoffResolvePayload = {
  handoffId: string
  creationMode: Exclude<AppBuilderCreationMode, 'undecided'>
  targetAppId?: string
  targetAppName?: string
}

export type WorkbenchAiAppBuilderHandoffContinueIntent = 'clarify' | 'continue' | 'none'

type AiAssistantTableRenderableItem = AiAssistantStructuredRenderableItem & {
  block: AiAssistantTableBlock
}

type AiAssistantStructuredTablePreviewPayload = {
  title: string
  tableHtml: string
  tableText: string
  tableViewKey?: string
  evidence?: AiAnalysisEvidenceSummary | null
}

const APP_BUILDER_CREATION_MODES = new Set<AppBuilderCreationMode>([
  'create_new_app',
  'extend_existing_app',
  'undecided',
])
const APP_BUILDER_HANDOFF_STATUSES = new Set([
  'ready',
  'continuing',
  'consumed',
  'abandoned',
] as const)
const APP_BUILDER_HANDOFF_ISSUE_CODES = new Set<WorkbenchAiAppBuilderHandoffIssueCode>([
  'missing_entry_title',
  'invalid_creation_mode',
  'invalid_intent_kind',
  'invalid_json',
])

const EVIDENCE_SOURCE_HEADING = '数据来源'
const EVIDENCE_STATS_HEADING = '统计说明'

const normalizeText = (value?: string | null) => String(value || '').replace(/\r\n/g, '\n').trim()

const normalizeInlineText = (value?: string | null) => String(value || '').replace(/\s+/g, ' ').trim()
const normalizeHandoffClarificationOptionLabel = (value?: string | null) => {
  const label = normalizeInlineText(value)
  if (!label) {
    return ''
  }
  if (label === '加到已有应用') {
    return i18next.t('workbenchAiInsightPanelModel.extendExistingApp')
  }
  return label
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeAppBuilderCreationMode = (value: unknown): AppBuilderCreationMode | null => {
  const mode = String(value || '').trim()
  return APP_BUILDER_CREATION_MODES.has(mode as AppBuilderCreationMode)
    ? mode as AppBuilderCreationMode
    : null
}

const normalizeAppBuilderHandoffStatus = (
  value: unknown,
): WorkbenchAiAppBuilderHandoffPreview['status'] | null => {
  const status = String(value || '').trim()
  return APP_BUILDER_HANDOFF_STATUSES.has(status as NonNullable<WorkbenchAiAppBuilderHandoffPreview['status']>)
    ? status as NonNullable<WorkbenchAiAppBuilderHandoffPreview['status']>
    : null
}

const normalizeAppBuilderHandoffIssueCode = (
  value: unknown,
): WorkbenchAiAppBuilderHandoffIssueCode | null => {
  const issueCode = String(value || '').trim()
  return APP_BUILDER_HANDOFF_ISSUE_CODES.has(issueCode as WorkbenchAiAppBuilderHandoffIssueCode)
    ? issueCode as WorkbenchAiAppBuilderHandoffIssueCode
    : null
}

const hasOwn = (value: UnknownRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const normalizeHandoffTargetApp = (value: unknown): WorkbenchAiAppBuilderHandoffPreview['targetApp'] | undefined => {
  if (value === null) {
    return null
  }
  if (!isRecord(value)) {
    return undefined
  }

  const appId = normalizeInlineText(value.appId)
  const appName = normalizeInlineText(value.appName)
  if (!appId && !appName) {
    return undefined
  }

  return {
    ...(appId ? { appId } : {}),
    ...(appName ? { appName } : {}),
  }
}

const normalizeHandoffCandidateApps = (value: unknown): WorkbenchAiAppBuilderHandoffPreview['candidateApps'] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value
    .map(item => {
      if (!isRecord(item)) {
        return null
      }

      const appName = normalizeInlineText(item.appName)
      if (!appName) {
        return null
      }

      const appId = normalizeInlineText(item.appId)
      return {
        ...(appId ? { appId } : {}),
        appName,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return items.length ? items : undefined
}

const normalizeHandoffClarification = (value: unknown): NonNullable<WorkbenchAiAppBuilderHandoffPreview['clarification']> | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (!isRecord(value)) {
    return null
  }

  const question = normalizeText(value.question)
  const options = Array.isArray(value.options)
    ? value.options
      .map(item => {
        if (!isRecord(item)) {
          return null
        }

        const optionValue = normalizeAppBuilderCreationMode(item.value)
        if (!optionValue || optionValue === 'undecided') {
          return null
        }

        const label = normalizeHandoffClarificationOptionLabel(item.label)
        if (!label) {
          return null
        }

        return {
          value: optionValue,
          label,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : []

  if (!question || !options.length) {
    return null
  }

  return {
    required: Boolean(value.required),
    question,
    options,
  }
}

const normalizeHandoffExcelAttachment = (value: unknown): AiAttachmentReference | undefined => {
  const attachment = normalizeAiAttachmentReference(value)
  return attachment?.kind === 'excel' ? attachment : undefined
}

const resolveRawHandoffExcelAttachment = (payload: UnknownRecord): AiAttachmentReference | undefined => {
  const attachment = resolveAppBuilderHandoffExcelAttachmentReference(payload)
  return attachment || undefined
}

const resolveRawHandoffMaterialsSummary = (payload: UnknownRecord): string | undefined => {
  const attachmentName = normalizeInlineText(
    isRecord(payload.materials)
      && Array.isArray(payload.materials.attachments)
      && isRecord(payload.materials.attachments[0])
      ? payload.materials.attachments[0].name as string | undefined
      : undefined,
  )
  return attachmentName
    ? i18next.t('workbenchAiInsightPanelModel.attachedExcel', { name: attachmentName })
    : undefined
}

export const normalizeWorkbenchAppBuilderHandoffPreview = (
  value: unknown,
): WorkbenchAiAppBuilderHandoffPreview | null => {
  if (!isRecord(value)) {
    return null
  }
  const wrappedHandoff = isRecord(value.handoff)
    ? value.handoff
    : (isRecord(value.appBuilderHandoff) ? value.appBuilderHandoff : null)
  const payload = wrappedHandoff
    ? {
      ...value,
      ...wrappedHandoff,
    }
    : value

  if (payload.actionType && payload.actionType !== 'app-builder-handoff') {
    return null
  }

  const summaryPayload = isRecord(payload.summary) ? payload.summary : null
  const scopePayload = isRecord(payload.scope) ? payload.scope : null
  const sourcePayload = isRecord(payload.source) ? payload.source : null
  const intentPayload = isRecord(payload.intent) ? payload.intent : null
  const draftPayload = isRecord(payload.draft) ? payload.draft : null
  const handoffId = normalizeInlineText(payload.handoffId)
  const creationMode = normalizeAppBuilderCreationMode(payload.creationMode ?? scopePayload?.creationMode)
  const status = normalizeAppBuilderHandoffStatus(payload.status)
  if (!handoffId || !creationMode) {
    return null
  }

  const directTargetApp = hasOwn(payload, 'targetApp')
    ? normalizeHandoffTargetApp(payload.targetApp)
    : undefined
  const scopedTargetApp = normalizeHandoffTargetApp(scopePayload?.targetApp)
  const targetApp = directTargetApp !== undefined ? directTargetApp : scopedTargetApp
  const candidateApps = normalizeHandoffCandidateApps(payload.candidateApps)
    || normalizeHandoffCandidateApps(scopePayload?.candidateApps)
  const clarification = normalizeHandoffClarification(payload.clarification)
  const excelAttachment = normalizeHandoffExcelAttachment(payload.excelAttachment)
    || normalizeHandoffExcelAttachment(summaryPayload?.excelAttachment)
    || resolveRawHandoffExcelAttachment(payload)
  const title = normalizeInlineText(payload.title)
    || normalizeInlineText(summaryPayload?.title)
    || normalizeInlineText(intentPayload?.entryTitle)
    || normalizeInlineText(draftPayload?.appName)
    || i18next.t('workbenchAiInsightPanelModel.appCreationDraft')
  const summary = normalizeText(typeof payload.summary === 'string' ? payload.summary : undefined)
    || normalizeText(summaryPayload?.summary)
    || normalizeText(draftPayload?.summary)
    || normalizeText(draftPayload?.goal)
  const materialsSummary = normalizeInlineText(payload.materialsSummary)
    || normalizeInlineText(summaryPayload?.materialsSummary)
    || resolveRawHandoffMaterialsSummary(payload)
  const sourceThreadId = normalizeInlineText(payload.sourceThreadId)
    || normalizeInlineText(summaryPayload?.sourceThreadId)
    || normalizeInlineText(sourcePayload?.threadId)

  return {
    actionType: 'app-builder-handoff',
    handoffId,
    creationMode,
    ...(status ? { status } : {}),
    title,
    summary,
    ...(materialsSummary ? { materialsSummary } : {}),
    ...(excelAttachment ? { excelAttachment } : {}),
    sourceThreadId,
    ...(targetApp !== undefined ? { targetApp } : {}),
    ...(candidateApps ? { candidateApps } : {}),
    clarification,
  }
}

export const normalizeWorkbenchAppBuilderHandoffIssue = (
  value: unknown,
): WorkbenchAiAppBuilderHandoffIssuePreview | null => {
  if (!isRecord(value)) {
    return null
  }

  const issuePayload = isRecord(value.issue)
    ? value.issue
    : (isRecord(value.appBuilderHandoffIssue) ? value.appBuilderHandoffIssue : null)
  const payload = issuePayload
    ? {
      ...value,
      ...issuePayload,
    }
    : value

  if (payload.actionType !== 'app-builder-handoff-issue') {
    return null
  }

  const summaryPayload = isRecord(payload.summary) ? payload.summary : null
  const sourcePayload = isRecord(payload.source) ? payload.source : null
  const issueCode = normalizeAppBuilderHandoffIssueCode(payload.issueCode ?? payload.code)
  const title = normalizeInlineText(payload.title)
    || normalizeInlineText(summaryPayload?.title)
  const summary = normalizeText(typeof payload.summary === 'string' ? payload.summary : undefined)
    || normalizeText(summaryPayload?.summary)
    || normalizeText(payload.detail)
    || normalizeText(payload.message)
  const sourceThreadId = normalizeInlineText(payload.sourceThreadId)
    || normalizeInlineText(summaryPayload?.sourceThreadId)
    || normalizeInlineText(sourcePayload?.threadId)

  if (!issueCode || !title || !summary || !sourceThreadId) {
    return null
  }

  return {
    actionType: 'app-builder-handoff-issue',
    issueCode,
    title,
    summary,
    sourceThreadId,
  }
}

export const resolveWorkbenchAppBuilderHandoffContinueIntent = (
  handoff?: WorkbenchAiAppBuilderHandoffPreview | null,
): WorkbenchAiAppBuilderHandoffContinueIntent => {
  if (!handoff) {
    return 'none'
  }
  if (
    handoff.creationMode === 'undecided'
    || (handoff.creationMode === 'extend_existing_app' && !normalizeInlineText(handoff.targetApp?.appId))
  ) {
    return 'clarify'
  }
  return 'continue'
}

export const shouldShowWorkbenchAppBuilderHandoffClarification = (
  handoff?: WorkbenchAiAppBuilderHandoffPreview | null,
  clarifying = false,
): boolean => {
  if (!handoff) {
    return false
  }

  if (clarifying) {
    return resolveWorkbenchAppBuilderHandoffContinueIntent(handoff) === 'clarify'
  }

  return (
    handoff.creationMode === 'undecided'
    || (handoff.creationMode === 'extend_existing_app' && !normalizeInlineText(handoff.targetApp?.appId))
  )
}

export const resolveWorkbenchAppBuilderHandoffCandidateKey = (
  candidate?: NonNullable<WorkbenchAiAppBuilderHandoffPreview['candidateApps']>[number] | null,
) => {
  const appId = normalizeInlineText(candidate?.appId)
  const appName = normalizeInlineText(candidate?.appName)
  return appId || appName
}

export const buildWorkbenchAppBuilderHandoffResolvePayload = (payload: {
  handoff: WorkbenchAiAppBuilderHandoffPreview
  creationMode: Exclude<AppBuilderCreationMode, 'undecided'>
  selectedCandidateKey?: string | null
}): WorkbenchAiAppBuilderHandoffResolvePayload | null => {
  if (payload.creationMode === 'create_new_app') {
    return {
      handoffId: payload.handoff.handoffId,
      creationMode: payload.creationMode,
    }
  }

  const selectedCandidateKey = normalizeInlineText(payload.selectedCandidateKey)
  const selectedCandidate = selectedCandidateKey
    ? payload.handoff.candidateApps?.find(candidate => (
      resolveWorkbenchAppBuilderHandoffCandidateKey(candidate) === selectedCandidateKey
    ))
    : null
  const targetApp = normalizeInlineText(payload.handoff.targetApp?.appId)
    ? payload.handoff.targetApp
    : selectedCandidate

  if (!targetApp || !normalizeInlineText(targetApp.appId)) {
    return null
  }

  return {
    handoffId: payload.handoff.handoffId,
    creationMode: payload.creationMode,
    ...(targetApp.appId ? { targetAppId: targetApp.appId } : {}),
    ...(targetApp.appName ? { targetAppName: targetApp.appName } : {}),
  }
}

export const shouldContinueWorkbenchAppBuilderHandoffAfterResolve = (
  payload?: WorkbenchAiAppBuilderHandoffResolvePayload | null,
): boolean => {
  if (!payload) {
    return false
  }
  if (payload.creationMode === 'create_new_app') {
    return true
  }
  return payload.creationMode === 'extend_existing_app' && Boolean(normalizeInlineText(payload.targetAppId))
}

const stripMarkdownDecorations = (value?: string | null) => String(value || '')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  .replace(/[`*_>#]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeLeadingSummaryText = (value?: string | null) => String(value || '')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map(line => stripMarkdownDecorations(line))
  .filter(Boolean)
  .join('\n')

const hasComplexLeadingMarkdownSyntax = (value?: string | null) => {
  const normalizedValue = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!normalizedValue) {
    return false
  }

  return normalizedValue
    .split('\n')
    .some(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        return false
      }

      return (
        /^#{1,6}\s+/.test(trimmedLine)
        || /^>\s+/.test(trimmedLine)
        || /^[-*+]\s+/.test(trimmedLine)
        || /^\d+\.\s+/.test(trimmedLine)
        || /^```/.test(trimmedLine)
        || /`[^`]+`/.test(trimmedLine)
        || /\[([^\]]+)\]\(([^)]+)\)/.test(trimmedLine)
        || /(^|[^\\])[*_~][^*_~]+[*_~]/.test(trimmedLine)
      )
    })
}

const parseMarkdownLink = (value?: string | null) => {
  const match = String(value || '').match(/\[([^\]]+)\]\(([^)]+)\)/)
  if (!match) {
    return null
  }

  const label = String(match[1] || '').trim()
  const href = String(match[2] || '').trim()
  if (!label) {
    return null
  }

  return {
    label,
    href,
  }
}

const pickCompactSummaryLines = (statsLines: string[]) => {
  const meaningfulLines = statsLines.filter(line => /\d/.test(line))
  const sourceLines = meaningfulLines.length ? meaningfulLines : statsLines
  return sourceLines.slice(0, 3)
}

const STABLE_DELTA_LABEL_CUES = [
  '差距',
  '相差',
  '差额',
  '差額',
  'difference',
  'gap',
  'exceed',
  'exceeds',
]

const hasStableDeltaLabelCue = (value: string) => {
  const normalizedValue = value.toLowerCase()
  return STABLE_DELTA_LABEL_CUES.some(cue => normalizedValue.includes(cue.toLowerCase()))
}

const extractStableDeltaLabel = (items: string[]) => {
  for (const item of items) {
    const normalizedItem = stripMarkdownDecorations(item)
      .replace(/[。．.;；，,!！?？\s]+$/g, '')
      .trim()
    if (!normalizedItem || !/\d/.test(normalizedItem)) {
      continue
    }

    if (hasStableDeltaLabelCue(normalizedItem)) {
      return normalizedItem
    }
  }

  return ''
}

export const deriveAiAnalysisSupportingData = (payload: {
  structuredSupportingData?: AiAssistantSupportingData | null
  analysisConclusionItems?: string[] | null
}): AiAnalysisSupportingData | null => {
  const kpis = Array.isArray(payload.structuredSupportingData?.kpis)
    ? payload.structuredSupportingData.kpis
      .map(item => {
        const value = String(item.value ?? '').trim()
        const businessObjectLabel = String(item.businessObjectLabel || '').trim()
        const dimensionLabel = String(item.dimensionLabel || '').trim()
        const combinationLabels = Array.isArray(item.combinationLabels)
          ? item.combinationLabels.map(label => String(label || '').trim()).filter(Boolean)
          : []

        return {
          key: item.key,
          value,
          ...(item.semanticType ? { semanticType: item.semanticType } : {}),
          ...(businessObjectLabel ? { businessObjectLabel } : {}),
          ...(dimensionLabel ? { dimensionLabel } : {}),
          ...(item.timeGranularity ? { timeGranularity: item.timeGranularity } : {}),
          ...(combinationLabels.length ? { combinationLabels } : {}),
        }
      })
      .filter(item => item.value)
    : []

  const analysisConclusionItems = Array.isArray(payload.analysisConclusionItems)
    ? payload.analysisConclusionItems.filter(Boolean)
    : []
  const deltaLabel = extractStableDeltaLabel(analysisConclusionItems)

  if (!kpis.length && !deltaLabel) {
    return null
  }

  return {
    ...(kpis.length ? { kpis } : {}),
    deltaLabel: deltaLabel || undefined,
  }
}

export const formatAiAnalysisSupportingKpiLabel = (
  kpi: AiAnalysisSupportingKpi,
  copy: AiAnalysisSupportingDisplayCopy,
) => {
  if (kpi.key === 'matchedRecords') {
    const businessObjectLabel = String(kpi.businessObjectLabel || '').trim()
    return businessObjectLabel
      ? `${copy.recordPrefix}${businessObjectLabel}${copy.recordSuffix}`
      : `${copy.recordPrefix}${copy.defaultRecordLabel}`
  }

  if (kpi.semanticType === 'time_bucket_count' && kpi.timeGranularity) {
    return `${copy.groupPrefix}${copy.timeBucketLabels[kpi.timeGranularity] || copy.defaultGroupLabel}`
  }

  if (kpi.semanticType === 'dimension_value_count' && kpi.dimensionLabel) {
    return `${copy.groupPrefix}${kpi.dimensionLabel}`
  }

  if (kpi.semanticType === 'group_combination_count' && kpi.combinationLabels?.length) {
    return `${copy.groupPrefix}${kpi.combinationLabels.join('-')}${copy.combinationSuffix}`
  }

  return copy.defaultGroupLabel
}

const buildEvidenceDetailText = (payload: {
  sourceTitle: string
  statsTitle: string
  sourceLinks: AiAnalysisEvidenceLink[]
  statsLines: string[]
}) => {
  const detailLines: string[] = []

  if (payload.sourceLinks.length) {
    detailLines.push(payload.sourceTitle)
    payload.sourceLinks.forEach(link => {
      const hrefText = link.href ? ` (${link.href})` : ''
      detailLines.push(`- ${link.label}${hrefText}`)
    })
  }

  if (payload.statsLines.length) {
    if (detailLines.length) {
      detailLines.push('')
    }
    detailLines.push(payload.statsTitle)
    payload.statsLines.forEach(line => {
      detailLines.push(`- ${line}`)
    })
  }

  return detailLines.join('\n').trim()
}

const isStructuredBlock = (block?: AiAssistantMessageBlock | null): block is AiAssistantStructuredBlock => (
  Boolean(block) && (block.type === 'chart' || block.type === 'table')
)

const isMarkdownBlock = (block?: AiAssistantMessageBlock | null): block is AiAssistantMarkdownBlock => (
  Boolean(block) && block.type === 'markdown'
)

const isTableRenderableItem = (
  itemOrBlock: AiAssistantTableRenderableItem | AiAssistantTableBlock,
): itemOrBlock is AiAssistantTableRenderableItem => (
  (itemOrBlock as AiAssistantStructuredRenderableItem)?.type === 'structured'
  && (itemOrBlock as AiAssistantTableRenderableItem)?.block?.type === 'table'
)

const isTableOnlyOrChartDisabledBlock = (block?: AiAssistantMessageBlock | null): block is AiAssistantTableBlock => {
  if (!block || block.type !== 'table') {
    return false
  }

  const primaryViewItems = Array.isArray(block.primaryViews?.items) ? block.primaryViews.items : []
  if (!primaryViewItems.length) {
    return true
  }

  const chartView = primaryViewItems.find(item => item.key === 'chart')
  return !chartView || chartView.enabled === false
}

const shouldAbsorbLeadingMarkdownIntoStructuredItem = (
  block?: AiAssistantMessageBlock | null,
  leadingBlock?: AiAssistantMessageBlock | null,
) => (
  isTableOnlyOrChartDisabledBlock(block)
  && isMarkdownBlock(leadingBlock)
  && !parseAiAnalysisEvidenceMarkdown(leadingBlock.text)
  && !hasComplexLeadingMarkdownSyntax(leadingBlock.text)
  && Boolean(normalizeText(leadingBlock.text))
)

export const parseAiAnalysisEvidenceMarkdown = (markdownText?: string | null): AiAnalysisEvidenceSummary | null => {
  const normalizedText = normalizeText(markdownText)
  if (!normalizedText) {
    return null
  }

  const sourceLinks: AiAnalysisEvidenceLink[] = []
  const statsLines: string[] = []
  let sourceTitle = i18next.t('workbenchAiInsightPanelModel.evidenceSource')
  let statsTitle = i18next.t('workbenchAiInsightPanelModel.evidenceStats')
  let currentSection: 'source' | 'stats' | '' = ''
  let hasEvidenceHeading = false

  normalizedText.split('\n').forEach(rawLine => {
    const trimmedLine = rawLine.trim()
    if (!trimmedLine || trimmedLine === '---') {
      return
    }

    const headingMatch = trimmedLine.match(/^#{1,6}\s*(.+)$/)
    if (headingMatch) {
      const headingText = stripMarkdownDecorations(headingMatch[1])
      if (headingText === EVIDENCE_SOURCE_HEADING) {
        currentSection = 'source'
        sourceTitle = i18next.t('workbenchAiInsightPanelModel.evidenceSource')
        hasEvidenceHeading = true
        return
      }
      if (headingText === EVIDENCE_STATS_HEADING) {
        currentSection = 'stats'
        statsTitle = i18next.t('workbenchAiInsightPanelModel.evidenceStats')
        hasEvidenceHeading = true
        return
      }

      currentSection = ''
      return
    }

    const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/)
    const rawItemText = bulletMatch?.[1] || trimmedLine
    const plainText = stripMarkdownDecorations(rawItemText)
    if (!plainText) {
      return
    }

    if (currentSection === 'source') {
      const parsedLink = parseMarkdownLink(rawItemText)
      if (parsedLink) {
        sourceLinks.push(parsedLink)
        return
      }

      sourceLinks.push({
        label: plainText,
        href: '',
      })
      return
    }

    if (currentSection === 'stats') {
      statsLines.push(plainText)
    }
  })

  if (!hasEvidenceHeading || (!sourceLinks.length && !statsLines.length)) {
    return null
  }

  const sourceSummaryText = sourceLinks.map(link => link.label).join(' / ')
  const summaryText = pickCompactSummaryLines(statsLines).join(' | ') || sourceSummaryText

  return {
    sourceTitle,
    statsTitle,
    sourceLinks,
    statsLines,
    sourceSummaryText,
    summaryText,
    detailText: buildEvidenceDetailText({
      sourceTitle,
      statsTitle,
      sourceLinks,
      statsLines,
    }),
    markdownText: normalizedText,
  }
}

export const groupAiAssistantRenderableBlocks = (
  blocks: AiAssistantMessageBlock[],
): AiAssistantRenderableItem[] => {
  const groupedItems: AiAssistantRenderableItem[] = []

  for (let index = 0; index < blocks.length; index += 1) {
    const currentBlock = blocks[index]
    if (!isStructuredBlock(currentBlock)) {
      if (shouldAbsorbLeadingMarkdownIntoStructuredItem(blocks[index + 1], currentBlock)) {
        continue
      }

      groupedItems.push({
        type: 'markdown',
        block: currentBlock as AiAssistantMarkdownBlock,
      })
      continue
    }

    const previousBlock = blocks[index - 1]
    const leadingSummaryText = (
      shouldAbsorbLeadingMarkdownIntoStructuredItem(currentBlock, previousBlock)
      && isMarkdownBlock(previousBlock)
    )
      ? normalizeLeadingSummaryText(previousBlock.text)
      : ''
    const nextBlock = blocks[index + 1]
    const evidence = isMarkdownBlock(nextBlock)
      ? parseAiAnalysisEvidenceMarkdown(nextBlock.text)
      : null

    groupedItems.push({
      type: 'structured',
      block: currentBlock,
      evidence,
      leadingSummaryText: leadingSummaryText || undefined,
    })

    if (evidence) {
      index += 1
    }
  }

  return groupedItems
}

export const resolveAiAssistantStructuredTablePreviewContext = (
  itemOrBlock: AiAssistantTableRenderableItem | AiAssistantTableBlock,
  payload: AiAssistantStructuredTablePreviewPayload,
) => {
  const block = isTableRenderableItem(itemOrBlock)
    ? itemOrBlock.block
    : itemOrBlock
  const leadingSummaryText = isTableRenderableItem(itemOrBlock)
    ? String(itemOrBlock.leadingSummaryText || '')
    : ''

  return {
    block,
    title: payload.title || block.title || '',
    tableHtml: payload.tableHtml,
    tableText: payload.tableText,
    tableViewKey: payload.tableViewKey || block.views?.defaultKey || 'base',
    evidence: payload.evidence || null,
    leadingSummaryText,
  }
}
