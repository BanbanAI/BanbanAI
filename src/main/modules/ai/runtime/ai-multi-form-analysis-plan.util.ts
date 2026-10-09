import type { AiAssistantMarkdownBlock } from '@common/types/ai'

type AiMultiFormAnalysisPlanStatus = 'auto_continue' | 'need_clarify' | 'partial' | 'done' | string

type AiMultiFormAnalysisPlanStep = {
  title?: string
  reason?: string
  status?: string
}

type AiMultiFormAnalysisPlanSource = {
  sourceId?: string
  sourceName?: string
  reason?: string
}

type AiMultiFormAnalysisPlanState = {
  goalSummary?: string
  appId?: string
  appName?: string
  primarySourceId?: string
  primarySourceName?: string
  secondarySources?: AiMultiFormAnalysisPlanSource[]
  excludedSources?: AiMultiFormAnalysisPlanSource[]
  steps?: AiMultiFormAnalysisPlanStep[]
  status?: AiMultiFormAnalysisPlanStatus
  uncertaintyReasons?: string[]
}

type ValidatedAiMultiFormAnalysisPlan = Omit<AiMultiFormAnalysisPlanState, 'secondarySources' | 'excludedSources' | 'steps'> & {
  secondarySources: Array<Required<Pick<AiMultiFormAnalysisPlanSource, 'sourceId' | 'sourceName'>> & Pick<AiMultiFormAnalysisPlanSource, 'reason'>>
  excludedSources: Array<Required<Pick<AiMultiFormAnalysisPlanSource, 'sourceId' | 'sourceName'>> & Pick<AiMultiFormAnalysisPlanSource, 'reason'>>
  steps: Array<Required<Pick<AiMultiFormAnalysisPlanStep, 'title'>> & Pick<AiMultiFormAnalysisPlanStep, 'reason' | 'status'>>
}

const PLAN_FENCE_PATTERN = /```banban-analysis-plan\s*([\s\S]*?)```/i
const PLAN_FENCE_START_PATTERN = /```banban-analysis-plan\b/i

export function resolveMultiFormAnalysisPlanPresentation(options: {
  answerText: string
  successfulToolOutputs: any[]
}) {
  const answerText = String(options.answerText || '').replace(/\r\n/g, '\n')
  const fallbackPlanBlock = buildFallbackSameAppPlanBlock(options.successfulToolOutputs)
  const match = answerText.match(PLAN_FENCE_PATTERN)
  if (!match) {
    return {
      assistantContent: stripDanglingPlanFence(answerText).trim(),
      planBlock: fallbackPlanBlock,
    }
  }

  const assistantContent = answerText
    .replace(PLAN_FENCE_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  let parsed: AiMultiFormAnalysisPlanState | null = null
  try {
    parsed = JSON.parse(String(match[1] || '').trim()) as AiMultiFormAnalysisPlanState
  } catch {
    return {
      assistantContent,
      planBlock: fallbackPlanBlock,
    }
  }

  const validated = validateSameAppPlan(parsed, options.successfulToolOutputs)
  return {
    assistantContent,
    planBlock: validated
      ? buildPlanMarkdownBlock(validated)
      : fallbackPlanBlock,
  }
}

function buildFallbackSameAppPlanBlock(successfulToolOutputs: any[]) {
  const fallbackPlan = buildFallbackSameAppPlan(successfulToolOutputs)
  return fallbackPlan ? buildPlanMarkdownBlock(fallbackPlan) : null
}

function buildFallbackSameAppPlan(successfulToolOutputs: any[]): ValidatedAiMultiFormAnalysisPlan | null {
  const orderedAppSources = collectOrderedReadAppSources(successfulToolOutputs)
  if (orderedAppSources.length !== 1) {
    return null
  }

  const [onlyApp] = orderedAppSources
  if (onlyApp.sources.length < 2) {
    return null
  }

  const [primarySource, ...secondarySources] = onlyApp.sources
  return {
    appId: onlyApp.appId,
    appName: onlyApp.appName,
    goalSummary: undefined,
    primarySourceId: primarySource.sourceId,
    primarySourceName: primarySource.sourceName,
    secondarySources,
    excludedSources: [],
    steps: [],
    status: undefined,
    uncertaintyReasons: [],
  }
}

function validateSameAppPlan(plan: AiMultiFormAnalysisPlanState | null, successfulToolOutputs: any[]) {
  if (!plan || typeof plan !== 'object') {
    return null
  }

  const availableSources = collectAvailableSources(successfulToolOutputs)
  const appId = normalizeText(plan.appId)
  if (!appId) {
    return null
  }

  const appSources = availableSources.get(appId)
  if (!appSources) {
    return null
  }

  const primarySourceId = normalizeText(plan.primarySourceId)
  const canonicalPrimarySourceName = primarySourceId && appSources.has(primarySourceId)
    ? appSources.get(primarySourceId) || primarySourceId
    : undefined
  const claimedSourceIds = new Set<string>(canonicalPrimarySourceName && primarySourceId ? [primarySourceId] : [])

  return {
    ...plan,
    appId,
    appName: normalizeText(plan.appName) || undefined,
    goalSummary: normalizeText(plan.goalSummary) || undefined,
    primarySourceId: canonicalPrimarySourceName ? primarySourceId : undefined,
    primarySourceName: canonicalPrimarySourceName || undefined,
    secondarySources: normalizePlanSources(plan.secondarySources, appSources, claimedSourceIds),
    excludedSources: normalizePlanSources(plan.excludedSources, appSources, claimedSourceIds),
    steps: normalizePlanSteps(plan.steps),
    status: normalizeText(plan.status) || undefined,
    uncertaintyReasons: normalizeStringList(plan.uncertaintyReasons),
  }
}

function collectAvailableSources(successfulToolOutputs: any[]) {
  const appSourceMap = new Map<string, Map<string, string>>()

  for (const output of Array.isArray(successfulToolOutputs) ? successfulToolOutputs : []) {
    if (output?.tool === 'get_app_memory') {
      const appId = normalizeText(output?.app?.appId)
      if (!appId) {
        continue
      }

      const sourceMap = ensureAppSourceMap(appSourceMap, appId)
      for (const source of Array.isArray(output?.sources) ? output.sources : []) {
        const sourceId = normalizeText(source?.sourceId)
        if (!sourceId) {
          continue
        }
        sourceMap.set(sourceId, normalizeText(source?.sourceName) || sourceId)
      }
    }

    if (output?.tool === 'read_app_data') {
      const appId = normalizeText(output?.resolved?.appId)
      if (!appId) {
        continue
      }

      const sourceMap = ensureAppSourceMap(appSourceMap, appId)
      const targets = Array.isArray(output?.resolved?.targets) && output.resolved.targets.length
        ? output.resolved.targets
        : (output?.resolved?.target ? [output.resolved.target] : [])

      for (const target of targets) {
        if (normalizeText(target?.type) !== 'source') {
          continue
        }

        const sourceId = normalizeText(target?.id)
        if (!sourceId) {
          continue
        }

        if (!sourceMap.has(sourceId)) {
          sourceMap.set(sourceId, normalizeText(target?.name) || sourceId)
        }
      }
    }
  }

  return appSourceMap
}

function collectOrderedReadAppSources(successfulToolOutputs: any[]) {
  const appSourceMap = new Map<string, {
    appId: string
    appName?: string
    seenSourceIds: Set<string>
    sources: Array<Required<Pick<AiMultiFormAnalysisPlanSource, 'sourceId' | 'sourceName'>>>
  }>()

  for (const output of Array.isArray(successfulToolOutputs) ? successfulToolOutputs : []) {
    if (output?.tool !== 'read_app_data') {
      continue
    }

    if (!isAnalysisLikeReadResult(output)) {
      continue
    }

    const appId = normalizeText(output?.resolved?.appId)
    if (!appId) {
      continue
    }

    const targets = Array.isArray(output?.resolved?.targets) && output.resolved.targets.length
      ? output.resolved.targets
      : (output?.resolved?.target ? [output.resolved.target] : [])
    if (!targets.length) {
      continue
    }

    let appState = appSourceMap.get(appId)
    if (!appState) {
      appState = {
        appId,
        appName: normalizeText(output?.resolved?.appName) || undefined,
        seenSourceIds: new Set<string>(),
        sources: [],
      }
      appSourceMap.set(appId, appState)
    }

    for (const target of targets) {
      if (normalizeText(target?.type) !== 'source') {
        continue
      }

      const sourceId = normalizeText(target?.id)
      if (!sourceId || appState.seenSourceIds.has(sourceId)) {
        continue
      }

      appState.seenSourceIds.add(sourceId)
      appState.sources.push({
        sourceId,
        sourceName: normalizeText(target?.name) || sourceId,
      })
    }
  }

  return [...appSourceMap.values()].map(item => ({
    appId: item.appId,
    appName: item.appName,
    sources: item.sources,
  }))
}

function ensureAppSourceMap(appSourceMap: Map<string, Map<string, string>>, appId: string) {
  const existing = appSourceMap.get(appId)
  if (existing) {
    return existing
  }

  const next = new Map<string, string>()
  appSourceMap.set(appId, next)
  return next
}

function normalizePlanSources(
  sources: AiMultiFormAnalysisPlanSource[] | undefined,
  appSources: Map<string, string>,
  claimedSourceIds: Set<string>,
) {
  const seen = new Set<string>()

  return (Array.isArray(sources) ? sources : [])
    .map(item => {
      const sourceId = normalizeText(item?.sourceId)
      if (!sourceId || !appSources.has(sourceId) || seen.has(sourceId) || claimedSourceIds.has(sourceId)) {
        return null
      }

      seen.add(sourceId)
      claimedSourceIds.add(sourceId)
      return {
        sourceId,
        sourceName: appSources.get(sourceId) || sourceId,
        reason: normalizeText(item?.reason) || undefined,
      }
    })
    .filter((item): item is ReturnType<typeof normalizePlanSources>[number] => Boolean(item))
}

function normalizePlanSteps(steps: AiMultiFormAnalysisPlanStep[] | undefined) {
  return (Array.isArray(steps) ? steps : [])
    .map(item => {
      const title = normalizeText(item?.title)
      if (!title) {
        return null
      }

      return {
        title,
        reason: normalizeText(item?.reason) || undefined,
        status: normalizeText(item?.status) || undefined,
      }
    })
    .filter((item): item is ReturnType<typeof normalizePlanSteps>[number] => Boolean(item))
}

function buildPlanMarkdownBlock(plan: ValidatedAiMultiFormAnalysisPlan): AiAssistantMarkdownBlock {
  const secondary = plan.secondarySources
    .map(item => global.i18next.t('aiMultiFormAnalysisPlan.sourceItem', {
      sourceName: item.sourceName,
      reason: item.reason
        ? global.i18next.t('aiMultiFormAnalysisPlan.parenthesizedReason', { reason: item.reason })
        : '',
    }))
  const excluded = plan.excludedSources
    .map(item => global.i18next.t('aiMultiFormAnalysisPlan.sourceItem', {
      sourceName: item.sourceName,
      reason: item.reason
        ? global.i18next.t('aiMultiFormAnalysisPlan.parenthesizedReason', { reason: item.reason })
        : '',
    }))
  const steps = plan.steps
    .map(item => global.i18next.t('aiMultiFormAnalysisPlan.stepItem', {
      title: item.title,
      reason: item.reason
        ? global.i18next.t('aiMultiFormAnalysisPlan.parenthesizedReason', { reason: item.reason })
        : '',
      status: renderStepStatus(item.status),
    }))

  return {
    type: 'markdown',
    text: [
      global.i18next.t('aiMultiFormAnalysisPlan.heading'),
      plan.goalSummary
        ? global.i18next.t('aiMultiFormAnalysisPlan.goalLine', { goal: plan.goalSummary })
        : '',
      plan.primarySourceName
        ? global.i18next.t('aiMultiFormAnalysisPlan.primarySourceLine', {
          sourceName: plan.primarySourceName,
        })
        : '',
      secondary.length ? global.i18next.t('aiMultiFormAnalysisPlan.secondarySourcesHeading') : '',
      ...secondary,
      excluded.length ? global.i18next.t('aiMultiFormAnalysisPlan.excludedSourcesHeading') : '',
      ...excluded,
      steps.length ? global.i18next.t('aiMultiFormAnalysisPlan.stepsHeading') : '',
      ...steps,
      plan.status
        ? global.i18next.t('aiMultiFormAnalysisPlan.statusLine', {
          status: renderPlanStatus(plan.status),
        })
        : '',
      plan.uncertaintyReasons?.length
        ? global.i18next.t('aiMultiFormAnalysisPlan.uncertaintyLine', {
          reasons: plan.uncertaintyReasons.join(global.i18next.t('aiMultiFormAnalysisPlan.sectionSeparator')),
        })
        : '',
    ].filter(Boolean).join('\n'),
  }
}

function renderPlanStatus(status?: AiMultiFormAnalysisPlanStatus) {
  if (status === 'auto_continue') {
    return global.i18next.t('aiMultiFormAnalysisPlan.autoContinue')
  }
  if (status === 'need_clarify') {
    return global.i18next.t('aiMultiFormAnalysisPlan.needClarification')
  }
  if (status === 'partial') {
    return global.i18next.t('aiMultiFormAnalysisPlan.partial')
  }
  if (status === 'done') {
    return global.i18next.t('aiMultiFormAnalysisPlan.done')
  }
  return global.i18next.t('aiMultiFormAnalysisPlan.unknown')
}

function renderStepStatus(status?: string) {
  if (status === 'completed') {
    return global.i18next.t('aiMultiFormAnalysisPlan.stepCompleted')
  }
  if (status === 'running') {
    return global.i18next.t('aiMultiFormAnalysisPlan.stepRunning')
  }
  if (status === 'pending') {
    return global.i18next.t('aiMultiFormAnalysisPlan.stepPending')
  }
  if (status === 'skipped') {
    return global.i18next.t('aiMultiFormAnalysisPlan.stepSkipped')
  }
  return ''
}

function normalizeStringList(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map(item => normalizeText(item))
    .filter(Boolean)
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function stripDanglingPlanFence(answerText: string) {
  const match = PLAN_FENCE_START_PATTERN.exec(answerText)
  if (!match) {
    return answerText
  }

  return answerText
    .slice(0, match.index)
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

function isAnalysisLikeReadResult(output: any) {
  const resultKind = normalizeText(output?.result?.kind).toLowerCase()
  return resultKind === 'record_analysis'
    || resultKind === 'record_aggregate'
    || resultKind === 'batch_record_aggregate'
}
