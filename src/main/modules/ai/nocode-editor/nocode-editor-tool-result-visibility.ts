import type { AiActionResult } from '../ai.types'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  NOCODE_EDITOR_DEFERRED_FAILED_STAGE_SUMMARY_REASON,
  NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON,
  isNocodeEditorTransientFailedStageSummaryReason,
} from '@common/utils/nocodeEditorToolResultSummaryState'
import {
  normalizeFlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  buildNocodeEditorToolResultAssistantMessage,
  resolveNocodeEditorToolResultSummaryStage,
} from './nocode-editor-tool-result-messages'

export type NocodeEditorToolResultVisibilityMetadata = {
  suppressPersistedSummary?: boolean
  suppressSummaryContent?: boolean
  suppressStreamBlocks?: boolean
  suppressedIntermediateSummary?: boolean
  summarySuppressionReason?: string
}

export type DeferredNocodeEditorFailedStageSummary = {
  stage: string
  result: AiActionResult
  content: string
  metadata: Record<string, unknown>
}

const toArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
)

const normalizeQuestions = (value: unknown) => (
  toArray(value)
    .map(item => String(item || '').trim())
    .filter(Boolean)
)

const hasPendingConfirmationQuestion = (value: unknown) => (
  toArray(value).some(item => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && (item as Record<string, unknown>).confirmed !== true
  ))
)

const hasPositiveRevision = (value: unknown) => Number(value || 0) > 0

const hasNamedForm = (value: unknown) => (
  Array.isArray(value)
  && value.some(item => (
    item
    && typeof item === 'object'
    && !Array.isArray(item)
    && String((item as Record<string, unknown>).tableName || '').trim()
  ))
)

export const isCompletedNocodeEditorFormPlanResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_single_form_plan' || !result?.ok) {
    return false
  }

  const outline = normalizeNocodeEditorPlanningOutline(result?.output?.outline, {
    confirmationStage: 'form-plan',
  })
  if (!hasPositiveRevision(result?.output?.revision) || !hasNamedForm(outline?.forms)) {
    return false
  }
  const confirmation = outline?.confirmation
  const confirmationStatus = String(confirmation?.status || '').trim()
  if (confirmationStatus) {
    return confirmationStatus === 'completed'
      && !hasPendingConfirmationQuestion(confirmation?.questions)
  }
  if (hasPendingConfirmationQuestion(confirmation?.questions)) {
    return false
  }
  return normalizeQuestions(outline?.openQuestions).length === 0
}

export const isReadyNocodeEditorBlueprintResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_blueprint' || !result?.ok) {
    return false
  }

  const blueprint = result?.output?.blueprint
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    return false
  }

  return hasPositiveRevision(result?.output?.revision)
    && hasNamedForm(blueprint?.forms)
    && normalizeQuestions(blueprint?.openQuestions).length === 0
    && normalizeQuestions(result?.metadata?.planningConvergenceLateQuestions).length === 0
}

export const isCompletedNocodeEditorAppPlanResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_plan' || !result?.ok) {
    return false
  }

  const plan = result?.output?.plan
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return false
  }

  const planRecord = plan as Record<string, unknown>
  if (
    !hasPositiveRevision(result?.output?.revision)
    || !String(planRecord.goal || '').trim()
    || !Array.isArray(planRecord.objects)
    || !Array.isArray(planRecord.artifacts)
    || !Array.isArray(planRecord.openQuestions)
  ) {
    return false
  }
  const outline = planRecord.outline && typeof planRecord.outline === 'object' && !Array.isArray(planRecord.outline)
    ? planRecord.outline as Record<string, unknown>
    : null
  const confirmations = [
    planRecord.confirmation,
    outline?.confirmation,
  ].filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
  for (const confirmationRecord of confirmations) {
    const confirmationStatus = String(confirmationRecord.status || '').trim()
    if (
      (confirmationStatus && confirmationStatus !== 'completed')
      || hasPendingConfirmationQuestion(confirmationRecord.questions)
    ) {
      return false
    }
  }

  return normalizeQuestions(planRecord.openQuestions).length === 0
}

export const isSuccessfulNocodeEditorBlueprintStageResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_blueprint' || !result?.ok) {
    return false
  }

  const blueprint = result?.output?.blueprint
  return Boolean(
    Number(result?.output?.revision || 0) > 0
    && blueprint
    && typeof blueprint === 'object'
    && !Array.isArray(blueprint)
    && Array.isArray((blueprint as Record<string, unknown>).forms)
    && ((blueprint as Record<string, unknown>).forms as unknown[]).length > 0,
  )
}

export const isSuccessfulNocodeEditorFlowBlueprintStageResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_stage_flow_blueprint' || !result?.ok) {
    return false
  }

  const blueprint = result?.output?.blueprint || result?.output?.flowPlan || result?.metadata?.flowPlan
  return Boolean(
    Number(result?.output?.revision || 0) > 0
    && Number(result?.output?.sourceSchemeRevision || 0) > 0
    && blueprint
    && typeof blueprint === 'object'
    && !Array.isArray(blueprint)
    && String((blueprint as Record<string, unknown>).title || '').trim()
    && Array.isArray((blueprint as Record<string, unknown>).triggerBranches),
  )
}

export const isSuccessfulNocodeEditorAppBlueprintApplyResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_apply_staged_app_blueprint' || !result?.ok) {
    return false
  }

  const summary = result?.output?.summary
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return false
  }

  const summaryRecord = summary as Record<string, unknown>
  const countEntries = Object.entries(summaryRecord).filter(([key]) => (
    /^(forms|fields)(Created|Reused|Updated|Deleted)$/.test(key)
  ))
  return countEntries.length > 0
    && countEntries.every(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0)
    && countEntries.some(([, value]) => Number(value) > 0)
}

export const isSuccessfulNocodeEditorFlowApplyResult = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_apply_staged_flow' || !result?.ok) {
    return false
  }

  const output = result?.output
  const summary = output?.summary
  const flowPlan = output?.flowPlan || result?.metadata?.flowPlan
  if (
    !summary || typeof summary !== 'object' || Array.isArray(summary)
    || !flowPlan || typeof flowPlan !== 'object' || Array.isArray(flowPlan)
  ) {
    return false
  }

  const totalNodeCount = Number((summary as Record<string, unknown>).totalNodeCount)
  return Number.isFinite(totalNodeCount) && totalNodeCount > 0
}

const resolveStageSummaryStage = (result: AiActionResult) => {
  const stage = resolveNocodeEditorToolResultSummaryStage(result)
  return stage === 'plain-assistant' ? '' : stage
}

export const resolveDeferredNocodeEditorFailedStageSummary = (
  result: AiActionResult,
  pending: Map<string, DeferredNocodeEditorFailedStageSummary>,
) => {
  if (!result?.metadata?.deferredFailedStageSummary) {
    return null
  }

  const stage = resolveStageSummaryStage(result)
  const summary = stage ? pending.get(stage) : null
  return summary?.result.callId === result.callId ? summary : null
}

// mark 阶段已设置 suppressSummaryContent，后续重建的 summary.content 恒为空；
// 只允许非空内容刷新暂存摘要，否则回合末红卡会因空内容被 materialize 跳过。
export const refreshDeferredNocodeEditorFailedStageSummary = (
  pending: DeferredNocodeEditorFailedStageSummary,
  content: string,
  metadata: Record<string, unknown>,
) => {
  if (content) {
    pending.content = content
  }
  pending.metadata = metadata
}

export const discardDeferredNocodeEditorFailedStageSummariesOnAbort = (
  signal: Pick<AbortSignal, 'aborted'> | null | undefined,
  pending: Map<string, DeferredNocodeEditorFailedStageSummary>,
) => {
  if (!signal?.aborted) {
    return false
  }

  pending.clear()
  return true
}

const resolveRouteClassFailureRouting = (result: AiActionResult) => (
  normalizeFlowIssueRoutingResult(result?.metadata?.flowIssueRouting)
  || normalizeFlowIssueRoutingResult(result?.output?.flowIssueRouting)
)

// 路由类失败（需用户重新确认流程方案）是本回合的终态：不会在同回合被重试成功覆盖，
// 必须当轮可见（失败说明 + 重新确认卡片），不能走“延迟失败摘要”的隐藏路径。
export const isRouteClassFailedStageSummaryResult = (result: AiActionResult) => (
  resolveRouteClassFailureRouting(result)?.outcome === 'return_to_flow_scheme'
)

export const markDeferredNocodeEditorFailedStageSummaries = (
  results: AiActionResult[],
  pending: Map<string, DeferredNocodeEditorFailedStageSummary>,
) => {
  const delayedToolNames = new Set([
    'editor_stage_app_plan',
    'editor_stage_single_form_plan',
    'editor_stage_content_plan',
    'editor_stage_formula_plan',
    'editor_stage_app_blueprint',
    'editor_plan_flow_scheme',
    'editor_stage_flow_blueprint',
  ])

  for (const result of results || []) {
    const stage = resolveStageSummaryStage(result)
    if (!stage) {
      continue
    }

    if (result?.ok === true) {
      pending.delete(stage)
      continue
    }

    if (
      result?.ok !== false
      || !delayedToolNames.has(String(result?.name || '').trim())
      || result?.metadata?.executor === 'server-guard'
      || result?.metadata?.duplicateBlocked
      || result?.metadata?.toolPolicyViolation
      || result?.metadata?.suppressPersistedSummary
      || isRouteClassFailedStageSummaryResult(result)
      || isNocodeEditorTransientFailedStageSummaryReason(result?.metadata?.summarySuppressionReason)
    ) {
      continue
    }

    const summary = buildNocodeEditorToolResultAssistantMessage(result)
    if (!summary || summary.metadata?.ok !== false) {
      continue
    }

    result.metadata = {
      ...(result.metadata || {}),
      deferredFailedStageSummary: true,
      suppressSummaryContent: true,
      suppressStreamBlocks: true,
      suppressedIntermediateSummary: true,
      summarySuppressionReason: NOCODE_EDITOR_DEFERRED_FAILED_STAGE_SUMMARY_REASON,
    }
    pending.set(stage, {
      stage,
      result,
      content: summary.content,
      metadata: summary.metadata,
    })
  }
}

export const resolveNocodeEditorToolResultVisibilityMetadata = (
  results: AiActionResult[],
): Record<string, NocodeEditorToolResultVisibilityMetadata> => {
  const normalizedResults = results || []
  const metadataByCallId: Record<string, NocodeEditorToolResultVisibilityMetadata> = {}

  for (let index = 0; index < normalizedResults.length; index += 1) {
    const result = normalizedResults[index]
    const stage = resolveStageSummaryStage(result)
    if (
      !result?.callId
      || !stage
      || result?.ok
      || result?.metadata?.duplicateBlocked
      || result?.metadata?.toolPolicyViolation
    ) {
      continue
    }

    const hasLaterSuccessfulSameStage = normalizedResults
      .slice(index + 1)
      .some(item => Boolean(item?.ok) && resolveStageSummaryStage(item) === stage)

    if (!hasLaterSuccessfulSameStage) {
      continue
    }

    metadataByCallId[result.callId] = {
      suppressPersistedSummary: true,
      suppressSummaryContent: true,
      suppressStreamBlocks: true,
      suppressedIntermediateSummary: true,
      summarySuppressionReason: NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON,
    }
  }

  return metadataByCallId
}

export const applyNocodeEditorToolResultVisibilityMetadata = (
  results: AiActionResult[],
) => {
  const metadataByCallId = resolveNocodeEditorToolResultVisibilityMetadata(results)
  return (results || []).map((result) => {
    const visibilityMetadata = metadataByCallId[result?.callId]
    if (!visibilityMetadata) {
      return result
    }
    result.metadata = {
      ...(result.metadata || {}),
      ...visibilityMetadata,
    }
    return result
  })
}
