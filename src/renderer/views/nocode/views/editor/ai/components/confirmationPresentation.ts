import {
  resolveNocodeEditorAppBuilderExecutionLevelLabel,
  resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel,
} from '@common/utils/nocodeEditorAppBuilderPlanningLabels'
import {
  buildSharedFormPlanConfirmationCardPresentation,
} from '@common/utils/nocodeEditorConfirmationCardPresentation'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import { getNocodeEditorAppPlanningAiHandlingText } from '@common/utils/nocodeEditorConfirmationCopy'
import i18next from 'i18next'
import type { PlanningCardPhase } from '../planningCardPhase'
import {
  resolveNocodeEditorFormulaPlanPresentation,
} from '../formulaPlanPresentation'

export type NocodeEditorAiConfirmationPresentation = {
  goal?: string
  coreObjects?: string[]
  planningItems?: string[]
  scope?: string
  nextSteps?: string[]
  aiHandling?: string
  pendingTitle?: string
}

type ConfirmationSectionKey =
  | 'goal'
  | 'coreObjects'
  | 'planningItems'
  | 'scope'
  | 'nextSteps'
  | 'aiHandling'
  | 'pending'

const normalizeText = (value: string) => (
  String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
)

const normalizeUnknownText = (value: unknown) => String(value || '').trim()

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const normalizeHeading = (value: string) => (
  String(value || '')
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*\*(.*?)\*\*$/, '$1')
    .replace(/^__(.*?)__$/, '$1')
    .replace(/[：:]\s*$/, '')
    .trim()
)

const normalizeParagraph = (value: string) => (
  normalizeText(value)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
)

const normalizeListItems = (value: string) => (
  normalizeText(value)
    .split('\n')
    .map((line) => line.trim().replace(/^[-*+]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean)
)

const isPlanningCompanionItemLine = (line: string) => {
  const trimmedLine = String(line || '').trim()
  return (
    /^[-*+]\s+/.test(trimmedLine)
    || /^\d+[.)]\s+/.test(trimmedLine)
    || /^\|.*\|$/.test(trimmedLine)
  )
}

const normalizeSectionLines = (value: string) => {
  const lines = normalizeText(value)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (!lines.length) {
    return ''
  }

  const listItemCount = lines.filter(line => /^[-*+]\s+|^\d+[.)]\s+/.test(line)).length
  if (listItemCount === lines.length) {
    return normalizeListItems(value).join('\n')
  }

  return lines.join('\n')
}

const shouldStripConfirmationWrapperLine = (line: string) => {
  const normalizedLine = normalizeHeading(line)
  if (!normalizedLine) {
    return false
  }

  return (
    normalizedLine === '规划待确认'
    || normalizedLine === '确认完成'
    || /^待确认\s*\d+\s*项$/.test(normalizedLine)
    || /^\d+\s*项待确认$/.test(normalizedLine)
    || /^已确认\s*\d+\s*项$/.test(normalizedLine)
  )
}

const shouldStripConfirmationResidualLine = (line: string) => {
  const normalizedLine = normalizeText(line).replace(/\s+/g, '')
  if (!normalizedLine) {
    return false
  }

  return (
    normalizedLine.includes('下面会先给你目标、本轮范围和待确认项')
    || normalizedLine.includes('如果你不想逐项确认，也可以直接回复“忽略待确认，按默认方案继续”')
    || normalizedLine.includes('如果你选择“忽略待确认，按默认方案继续”')
    || normalizedLine.includes('如果你选择“忽略待确认，按默认方案继续”')
    || normalizedLine.includes('如果你选择"忽略待确认，按默认方案继续"')
    || normalizedLine.includes('后续你仍可以继续调整')
    || normalizedLine.includes('优先生成确定性内容')
    || normalizedLine.includes('先按可回改方式处理')
  )
}

const resolveSectionKey = (heading: string): ConfirmationSectionKey | null => {
  const normalizedHeading = normalizeHeading(heading)
  if (!normalizedHeading) {
    return null
  }

  if (
    normalizedHeading === '目标'
    || normalizedHeading === '目标说明'
    || normalizedHeading === '应用目标'
  ) {
    return 'goal'
  }
  if (normalizedHeading === '核心对象') {
    return 'coreObjects'
  }
  if (normalizedHeading === '规划清单') {
    return 'planningItems'
  }
  if (normalizedHeading === '本轮范围') {
    return 'scope'
  }
  if (normalizedHeading === '下一步你可以这样做') {
    return 'nextSteps'
  }
  if (normalizedHeading === 'AI 会怎么处理') {
    return 'aiHandling'
  }
  if (normalizedHeading === '待确认项' || /^待确认\s*\d+\s*项$/.test(normalizedHeading)) {
    return 'pending'
  }

  return null
}

const mergeStringList = (current: string[] = [], next: string[] = []) => {
  const seen = new Set<string>()
  const merged: string[] = []

  for (const item of [...current, ...next]) {
    const normalizedItem = String(item || '').trim()
    if (!normalizedItem || seen.has(normalizedItem)) {
      continue
    }
    seen.add(normalizedItem)
    merged.push(normalizedItem)
  }

  return merged
}

export const mergeConfirmationPresentation = (
  current?: NocodeEditorAiConfirmationPresentation | null,
  next?: NocodeEditorAiConfirmationPresentation | null,
): NocodeEditorAiConfirmationPresentation | null => {
  if (!current && !next) {
    return null
  }

  const merged: NocodeEditorAiConfirmationPresentation = {
    goal: current?.goal || next?.goal,
    coreObjects: mergeStringList(current?.coreObjects, next?.coreObjects),
    planningItems: mergeStringList(current?.planningItems, next?.planningItems),
    scope: current?.scope || next?.scope,
    nextSteps: mergeStringList(current?.nextSteps, next?.nextSteps),
    aiHandling: current?.aiHandling || next?.aiHandling,
    pendingTitle: current?.pendingTitle || next?.pendingTitle,
  }

  if (
    !merged.goal
    && !merged.coreObjects?.length
    && !merged.planningItems?.length
    && !merged.scope
    && !merged.nextSteps?.length
    && !merged.aiHandling
    && !merged.pendingTitle
  ) {
    return null
  }

  return merged
}

export const resolveConfirmationAiHandlingText = (
  options: {
    block?: unknown
    presentation?: NocodeEditorAiConfirmationPresentation | null
    summary?: string
    goalText?: string
    phase?: PlanningCardPhase | ''
  },
) => {
  const record = toRecord(options.block)
  const blockKind = normalizeUnknownText(record.kind)

  if (options.phase === 'next-stage-loading' && blockKind === 'app-plan') {
    return i18next.t('confirmationPresentation.expandingDetailedBlueprint')
  }

  if (blockKind === 'app-plan') {
    return getNocodeEditorAppPlanningAiHandlingText();
  }

  if (blockKind === 'flow-scheme' && options.phase === 'ready-no-confirmation') {
    const planningStatus = normalizeUnknownText(record.planningStatus)
    if (planningStatus === 'ready_for_review') {
      return i18next.t('confirmationPresentation.reviewingFlowScheme')
    }

    return i18next.t('confirmationPresentation.flowSchemeStaged')
  }

  const presentationAiHandling = normalizeParagraph(String(options.presentation?.aiHandling || ''))
  if (presentationAiHandling) {
    return presentationAiHandling
  }

  const summary = normalizeText(String(options.summary || ''))
  const goalText = normalizeText(String(options.goalText || ''))
  if (summary && summary !== goalText) {
    return summary
  }

  return i18next.t('confirmationPresentation.confirmationNextSteps')
}

export const deriveConfirmationPresentationFromArtifactBlock = (
  block: unknown,
): NocodeEditorAiConfirmationPresentation | null => {
  const record = toRecord(block)
  const blockKind = normalizeUnknownText(record.kind)
  if (blockKind === 'formula-plan') {
    const presentation = resolveNocodeEditorFormulaPlanPresentation(record as any)
    if (presentation) {
      return {
        goal: presentation.goal,
        planningItems: presentation.planningItems,
        scope: presentation.scope,
        pendingTitle: presentation.pendingTitle,
      }
    }
  }
  if (blockKind === 'form-plan') {
    const outline = normalizeNocodeEditorPlanningOutline(record.outline, {
      confirmationStage: 'form-plan',
    })
    const normalizedPresentation = outline
      ? buildSharedFormPlanConfirmationCardPresentation({
        outline: outline as any,
        solutionPresentation: toRecord(record.formPlanPresentation) as any,
      })
      : null
    if (normalizedPresentation) {
      return normalizedPresentation
    }
  }
  const explicitPresentation = toRecord(record.confirmationCardPresentation)
  if (Object.keys(explicitPresentation).length) {
    const presentation: NocodeEditorAiConfirmationPresentation = {
      goal: normalizeUnknownText(explicitPresentation.goal) || undefined,
      coreObjects: Array.isArray(explicitPresentation.coreObjects)
        ? explicitPresentation.coreObjects.map(item => normalizeUnknownText(item)).filter(Boolean)
        : [],
      planningItems: Array.isArray(explicitPresentation.planningItems)
        ? explicitPresentation.planningItems.map(item => normalizeUnknownText(item)).filter(Boolean)
        : [],
      scope: blockKind === 'form-plan'
        ? undefined
        : normalizeUnknownText(explicitPresentation.scope) || undefined,
      nextSteps: Array.isArray(explicitPresentation.nextSteps)
        ? explicitPresentation.nextSteps.map(item => normalizeUnknownText(item)).filter(Boolean)
        : [],
      aiHandling: normalizeUnknownText(explicitPresentation.aiHandling) || undefined,
      pendingTitle: normalizeUnknownText(explicitPresentation.pendingTitle) || undefined,
    }

    if (!presentation.coreObjects?.length) {
      delete presentation.coreObjects
    }
    if (!presentation.planningItems?.length) {
      delete presentation.planningItems
    }
    if (!presentation.nextSteps?.length) {
      delete presentation.nextSteps
    }

    return presentation
  }

  const outline = toRecord(record.outline)
  const appPlan = toRecord(record.appPlan)
  const planningArtifacts = Array.isArray(record.planningArtifacts)
    ? record.planningArtifacts
    : Array.isArray(appPlan.artifacts)
      ? appPlan.artifacts
    : []

  const coreObjects = record.kind === 'app-plan'
    ? (Array.isArray(appPlan.objects)
      ? appPlan.objects.map(item => normalizeUnknownText(item)).filter(Boolean)
      : [])
    : []

  const planningItems = planningArtifacts
    .map((item: unknown) => {
      const artifact = toRecord(item)
      const name = normalizeUnknownText(artifact.name)
      if (!name) {
        return ''
      }
      return `${name}：${resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel(artifact.type)}，${resolveNocodeEditorAppBuilderExecutionLevelLabel(artifact.executionLevel ?? artifact.execution_level)}`
    })
    .filter(Boolean)

  const executionLevelGroups = planningArtifacts.reduce<Record<string, string[]>>((summary, item) => {
    const artifact = toRecord(item)
    const name = normalizeUnknownText(artifact.name)
    if (!name) {
      return summary
    }
    const label = resolveNocodeEditorAppBuilderExecutionLevelLabel(artifact.executionLevel ?? artifact.execution_level)
    summary[label] = [...(summary[label] || []), name]
    return summary
  }, {})
  const scope = Object.entries(executionLevelGroups)
    .map(([label, names]) => `${label}：${names.join('、')}`)
    .join('\n')

  const presentation: NocodeEditorAiConfirmationPresentation = {
    coreObjects,
    planningItems,
    scope: scope || undefined,
  }

  if (!presentation.coreObjects?.length) {
    delete presentation.coreObjects
  }
  if (!presentation.planningItems?.length) {
    delete presentation.planningItems
  }

  if (!presentation.coreObjects?.length && !presentation.planningItems?.length && !presentation.scope) {
    return null
  }

  return presentation
}

export const extractConfirmationCompanionPresentation = (text: string) => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return {
      presentation: null as NocodeEditorAiConfirmationPresentation | null,
      remainingText: '',
    }
  }

  const sectionLines: Record<ConfirmationSectionKey, string[]> = {
    goal: [],
    coreObjects: [],
    planningItems: [],
    scope: [],
    nextSteps: [],
    aiHandling: [],
    pending: [],
  }
  const remainingLines: string[] = []
  let currentSection: ConfirmationSectionKey | null = null
  let pendingTitle = ''
  let matchedAnySection = false

  for (const rawLine of normalized.split('\n')) {
    const line = String(rawLine || '')
    const trimmedLine = line.trim()
    const sectionKey = resolveSectionKey(trimmedLine)
    if (sectionKey) {
      currentSection = sectionKey
      matchedAnySection = true
      if (sectionKey === 'pending') {
        pendingTitle = normalizeHeading(trimmedLine)
      }
      continue
    }

    if (/^#{1,6}\s+\S/.test(trimmedLine)) {
      if (shouldStripConfirmationWrapperLine(trimmedLine)) {
        currentSection = null
        continue
      }
      currentSection = null
      remainingLines.push(line)
      continue
    }

    if (
      currentSection === 'planningItems'
      && trimmedLine
      && !isPlanningCompanionItemLine(trimmedLine)
      && sectionLines.planningItems.some(isPlanningCompanionItemLine)
    ) {
      currentSection = null
    }

    if (currentSection) {
      sectionLines[currentSection].push(line)
      continue
    }

    if (shouldStripConfirmationWrapperLine(trimmedLine)) {
      continue
    }

    if (shouldStripConfirmationResidualLine(trimmedLine)) {
      continue
    }

    remainingLines.push(line)
  }

  if (!matchedAnySection) {
    return {
      presentation: null as NocodeEditorAiConfirmationPresentation | null,
      remainingText: normalized,
    }
  }

  const presentation: NocodeEditorAiConfirmationPresentation = {
    goal: normalizeSectionLines(sectionLines.goal.join('\n')) || undefined,
    coreObjects: normalizeListItems(sectionLines.coreObjects.join('\n')),
    planningItems: normalizeListItems(sectionLines.planningItems.join('\n')),
    scope: normalizeSectionLines(sectionLines.scope.join('\n')) || undefined,
    nextSteps: normalizeListItems(sectionLines.nextSteps.join('\n')),
    aiHandling: normalizeParagraph(sectionLines.aiHandling.join('\n')) || undefined,
    pendingTitle: pendingTitle || undefined,
  }

  if (!presentation.coreObjects?.length) {
    delete presentation.coreObjects
  }
  if (!presentation.planningItems?.length) {
    delete presentation.planningItems
  }
  if (!presentation.nextSteps?.length) {
    delete presentation.nextSteps
  }

  return {
    presentation,
    remainingText: normalizeText(remainingLines.join('\n')),
  }
}

export const stripConfirmationCompanionSections = (text: string) => (
  extractConfirmationCompanionPresentation(text).remainingText
)

export const isConfirmationCompanionResidualText = (text: string) => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return false
  }

  if (
    shouldStripConfirmationWrapperLine(normalized)
    || shouldStripConfirmationResidualLine(normalized)
  ) {
    return true
  }

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return Boolean(
    lines.length
    && lines.every(line => (
      shouldStripConfirmationWrapperLine(line)
      || shouldStripConfirmationResidualLine(line)
    )),
  )
}
