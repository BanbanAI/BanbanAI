import { AiActionResult } from '../ai.types'
import {
  buildNocodeEditorMergedFormulaResultAssistantMessage,
  buildNocodeEditorToolResultAssistantMessage,
  resolveNocodeEditorToolResultSummaryStage,
} from './nocode-editor-tool-result-messages'
import {
  buildNocodeEditorContinuityHints,
} from './nocode-editor-task-context.util'
import {
  isNocodeEditorHiddenTimelineTool,
} from '@common/utils/nocodeEditorAiToolVisibility'
import {
  resolveFlowGroundingReturnFlowSchemeTitle,
} from '@common/utils/nocodeEditorFlowGroundingReturnToPlan'

const toBlocks = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const FORMULA_FIELD_TOOL_NAMES = new Set([
  'editor_set_field_formulas',
  'editor_set_field_options',
])

const isFormulaFieldToolName = (value: unknown) => (
  FORMULA_FIELD_TOOL_NAMES.has(String(value || '').trim())
)

const resolveStreamFlowIssueRouting = (value: unknown) => {
  if (!isRecord(value)) {
    return undefined
  }
  const outcome = String(value.outcome || '').trim()
  if (!outcome) {
    return undefined
  }
  const activeIssues = Array.isArray(value.activeIssues) ? value.activeIssues : []
  if (outcome !== 'auto_continue' && activeIssues.length === 0) {
    return undefined
  }
  return value
}

const extractArtifactKindsFromBlocks = (value: unknown) => {
  const blocks = toBlocks(value)
  return Array.from(new Set(
    blocks
      .map(item => String(isRecord(item) ? item.kind || '' : '').trim())
      .filter(Boolean),
  ))
}

const extractFormPlanPresentation = (metadata: Record<string, unknown> | null | undefined) => (
  metadata?.formPlanPresentation && typeof metadata.formPlanPresentation === 'object'
    ? metadata.formPlanPresentation
    : undefined
)

const extractFormulaPlanPresentation = (metadata: Record<string, unknown> | null | undefined) => (
  metadata?.formulaPlanPresentation && typeof metadata.formulaPlanPresentation === 'object'
    ? metadata.formulaPlanPresentation
    : undefined
)

const shouldReplaceAssistantContentWithSummary = (result: AiActionResult) => {
  const toolName = String(result?.name || '').trim()
  if (isFormulaFieldToolName(toolName)) {
    const output = isRecord(result?.output) ? result.output : null
    return (
      (Array.isArray(output?.formulaUpdates) && output.formulaUpdates.length > 0)
      || (Array.isArray(output?.formulaTargetResults) && output.formulaTargetResults.length > 0)
    )
  }
  return false
}

const isFormulaResultToolResult = (result: AiActionResult) => {
  if (!isFormulaFieldToolName(result?.name)) {
    return false
  }
  const output = isRecord(result?.output) ? result.output : null
  return (
    (Array.isArray(output?.formulaUpdates) && output.formulaUpdates.length > 0)
    || (Array.isArray(output?.formulaTargetResults) && output.formulaTargetResults.length > 0)
  )
}

export const mergeNocodeEditorFormulaToolResultsForStream = (
  results: AiActionResult[] = [],
) => {
  const mergedResults: AiActionResult[] = []
  let pendingFormulaResults: AiActionResult[] = []

  const flushPendingFormulaResults = () => {
    if (!pendingFormulaResults.length) {
      return
    }

    if (pendingFormulaResults.length === 1) {
      mergedResults.push(pendingFormulaResults[0])
      pendingFormulaResults = []
      return
    }

    const mergedSummary = buildNocodeEditorMergedFormulaResultAssistantMessage(pendingFormulaResults)
    if (!mergedSummary) {
      mergedResults.push(...pendingFormulaResults)
      pendingFormulaResults = []
      return
    }

    const firstResult = pendingFormulaResults[0]
    const formulaUpdates = pendingFormulaResults
      .flatMap((result) => {
        const output = isRecord(result?.output) ? result.output : null
        return Array.isArray(output?.formulaUpdates) ? output.formulaUpdates : []
      })
    const formulaTargetResults = pendingFormulaResults
      .flatMap((result) => {
        const output = isRecord(result?.output) ? result.output : null
        return Array.isArray(output?.formulaTargetResults) ? output.formulaTargetResults : []
      })
    mergedResults.push({
      ...firstResult,
      callId: firstResult.callId,
      output: {
        ...(isRecord(firstResult?.output) ? firstResult.output : {}),
        formulaUpdates,
        ...(formulaTargetResults.length ? { formulaTargetResults } : {}),
      },
      metadata: {
        ...(firstResult.metadata || {}),
        formulaActions: mergedSummary.metadata?.formulaActions,
        formulaTargetResults: mergedSummary.metadata?.formulaTargetResults,
        actionIds: pendingFormulaResults
          .map(result => String(result?.callId || '').trim())
          .filter(Boolean),
      },
    })
    pendingFormulaResults = []
  }

  for (const result of results || []) {
    if (isFormulaResultToolResult(result)) {
      pendingFormulaResults.push(result)
      continue
    }
    if (!isNocodeEditorHiddenTimelineTool(result?.name)) {
      flushPendingFormulaResults()
    }
    mergedResults.push(result)
  }

  flushPendingFormulaResults()
  return mergedResults
}

const resolveDraftOnlyBlueprintState = (result: AiActionResult) => {
  if (String(result?.name || '').trim() !== 'editor_apply_staged_app_blueprint') {
    return null
  }
  const output = isRecord(result?.output) ? result.output : null
  if (String(output?.persistenceMode || '').trim() !== 'draft_only') {
    return null
  }
  const draftPersistenceState = isRecord(output?.draftPersistenceState)
    ? output.draftPersistenceState
    : null
  return String(draftPersistenceState?.mode || '').trim() === 'draft_only'
    ? draftPersistenceState
    : null
}

const resolveLatestDraftOnlyBlueprintState = (results: AiActionResult[]) => {
  for (const result of [...(results || [])].reverse()) {
    const draftPersistenceState = resolveDraftOnlyBlueprintState(result)
    if (draftPersistenceState) {
      return draftPersistenceState
    }
  }
  return null
}

export const filterNocodeEditorToolResultsPendingStreamEmit = (
  results: AiActionResult[],
  emittedCallIds: Set<string>,
) => (
  (results || []).filter(result => !emittedCallIds.has(String(result?.callId || '').trim()))
)

export const buildNocodeEditorToolResultStreamMetadata = (options: {
  result: AiActionResult
  traceId: string
  continuityHints?: unknown[]
}) => {
  const { result, traceId } = options
  const clientRenderedToolResult = (
    String(result?.name || '').trim() === 'editor_apply_staged_flow'
    && result?.metadata?.clientRenderedToolResult === true
  )
  const summary = buildNocodeEditorToolResultAssistantMessage(result)
  const summaryStage = resolveNocodeEditorToolResultSummaryStage(result)
  const summaryBlocks = toBlocks(summary?.metadata?.blocks)
  const toolResultContinuityHints = Array.isArray(options.continuityHints)
    ? options.continuityHints
    : buildNocodeEditorContinuityHints({
      currentConversationId: '',
      latestAppConversation: null,
      summaryReplacesAssistantContent: shouldReplaceAssistantContentWithSummary(result),
    })
  const artifactKinds = extractArtifactKindsFromBlocks(summaryBlocks)
  const suppressSummaryContent = Boolean(result.metadata?.suppressSummaryContent)
  const suppressStreamBlocks = Boolean(result.metadata?.suppressStreamBlocks)
  const draftPersistenceState = resolveDraftOnlyBlueprintState(result)
  const output = isRecord(result.output) ? result.output : {}
  const flowIssueRouting = resolveStreamFlowIssueRouting(result.metadata?.flowIssueRouting)
    || resolveStreamFlowIssueRouting(output.flowIssueRouting)
  return {
    round: result.metadata?.round,
    duplicateBlocked: Boolean(result.metadata?.duplicateBlocked),
    duplicateType: result.metadata?.duplicateType,
    toolPolicyViolation: result.metadata?.toolPolicyViolation,
    scene: 'nocode-editor',
    target: 'client',
    actionId: result.callId,
    actionName: result.name,
    kind: result.kind,
    ok: result.ok,
    error: result.error,
    toolName: result.name,
    traceId,
    artifactUpdated: artifactKinds.length > 0,
    artifactKinds,
    clientRenderedToolResult: clientRenderedToolResult || undefined,
    flowIssueActionList: clientRenderedToolResult
      ? result.metadata?.flowIssueActionList
      : undefined,
    summaryContent: clientRenderedToolResult
      ? ''
      : (suppressSummaryContent ? '' : summary?.content),
    summaryReplacesAssistantContent: shouldReplaceAssistantContentWithSummary(result),
    continuityHints: toolResultContinuityHints,
    blocks: clientRenderedToolResult ? [] : (suppressStreamBlocks ? [] : summaryBlocks),
    formulaActions: Array.isArray(summary?.metadata?.formulaActions)
      ? summary.metadata.formulaActions
      : undefined,
    formulaTargetResults: Array.isArray(summary?.metadata?.formulaTargetResults)
      ? summary.metadata.formulaTargetResults
      : undefined,
    persistenceMode: summary?.metadata?.persistenceMode === 'draft_only'
      ? 'draft_only'
      : undefined,
    postFormFlowSignals: summary?.metadata?.postFormFlowSignals,
    postFormFlowOpportunity: summary?.metadata?.postFormFlowOpportunity,
    postFormFlowFollowUp: summary?.metadata?.postFormFlowFollowUp,
    postFormFlowRelease: summary?.metadata?.postFormFlowRelease,
    flowGroundingDiagnostics: Array.isArray(result.metadata?.flowGroundingDiagnostics)
      ? result.metadata.flowGroundingDiagnostics
      : undefined,
    flowGroundingQuestions: Array.isArray(result.metadata?.flowGroundingQuestions)
      ? result.metadata.flowGroundingQuestions
      : undefined,
    flowGroundingUserMessage: typeof result.metadata?.flowGroundingUserMessage === 'string'
      ? result.metadata.flowGroundingUserMessage
      : undefined,
    flowUnifiedIssues: Array.isArray(result.metadata?.flowUnifiedIssues)
      ? result.metadata.flowUnifiedIssues
      : Array.isArray(output.flowUnifiedIssues)
        ? output.flowUnifiedIssues
        : undefined,
    flowIssueRouting,
    flowSchemeTitle: resolveFlowGroundingReturnFlowSchemeTitle(result.metadata),
    flowGroundingReturnToStage: result.metadata?.flowGroundingReturnToStage === 'flow-scheme'
      ? 'flow-scheme'
      : undefined,
    flowBlueprintPreflightPhase: typeof result.metadata?.flowBlueprintPreflight === 'object'
      && result.metadata?.flowBlueprintPreflight
      && typeof (result.metadata.flowBlueprintPreflight as any).phase === 'string'
        ? String((result.metadata.flowBlueprintPreflight as any).phase)
        : undefined,
    flowSummarySnapshotRef: typeof result.metadata?.flowBlueprintPreflight === 'object'
      ? (result.metadata.flowBlueprintPreflight as any).summarySnapshotRef
      : undefined,
    flowNodeExampleCoverage: typeof result.metadata?.flowBlueprintPreflight === 'object'
      ? (result.metadata.flowBlueprintPreflight as any).nodeExampleCoverage
      : undefined,
    blockedNextAction: [
      'editor_stage_flow_blueprint',
      'editor_apply_staged_flow',
      'editor_patch_flow',
    ].includes(String(result.metadata?.blockedNextAction || '').trim())
      ? result.metadata?.blockedNextAction
      : undefined,
    flowPatchErrorCode: typeof result.metadata?.flowPatchErrorCode === 'string'
      ? result.metadata.flowPatchErrorCode
      : undefined,
    requiresFullRebuild: result.metadata?.requiresFullRebuild === true || undefined,
    requiredNextAction: result.metadata?.requiredNextAction === 'editor_plan_flow_scheme'
      ? 'editor_plan_flow_scheme'
      : undefined,
    flowSchemePlanningStatus: result.metadata?.flowSchemePlanningStatus === 'needs_confirmation'
      ? 'needs_confirmation'
      : undefined,
    toolResultSummary: Boolean(summary?.metadata?.toolResultSummary),
    summaryStage,
    hiddenFromTimeline: Boolean(summary?.metadata?.hiddenFromTimeline),
    blueprintApplyGate: summary?.metadata?.blueprintApplyGate,
    blockedByFlowApplyAuthorization: Boolean(result.metadata?.blockedByFlowApplyAuthorization) || undefined,
    flowApplyBlockedReason: result.metadata?.flowApplyBlockedReason,
    blueprintClarificationRequired: Boolean(summary?.metadata?.blueprintClarificationRequired) || undefined,
    blueprintClarificationKind: summary?.metadata?.blueprintClarificationKind,
    blockedBlueprintId: summary?.metadata?.blockedBlueprintId,
    blockedByPlanningConfirmation: Boolean(result.metadata?.blockedByPlanningConfirmation) || undefined,
    blockedPlanningKind: result.metadata?.blockedPlanningKind,
    blockedCompletedPlanning: Boolean(result.metadata?.blockedCompletedPlanning) || undefined,
    planningConvergenceLateQuestions: Array.isArray(result.metadata?.planningConvergenceLateQuestions)
      ? result.metadata.planningConvergenceLateQuestions
      : Array.isArray(summary?.metadata?.planningConvergenceLateQuestions)
        ? summary.metadata.planningConvergenceLateQuestions
        : undefined,
    formPlanPresentation: extractFormPlanPresentation(result.metadata),
    formulaPlanPresentation: extractFormulaPlanPresentation(summary?.metadata)
      || extractFormulaPlanPresentation(result.metadata),
    draftPersistenceState: draftPersistenceState || undefined,
    draftIssueActionList: draftPersistenceState || undefined,
    suppressPersistedSummary: Boolean(result.metadata?.suppressPersistedSummary) || undefined,
    suppressSummaryContent: suppressSummaryContent || undefined,
    suppressStreamBlocks: suppressStreamBlocks || undefined,
    blockedAfterFlowPatchSuccess: Boolean(result.metadata?.blockedAfterFlowPatchSuccess) || undefined,
    deferredForFlowPatchBatch: Boolean(result.metadata?.deferredForFlowPatchBatch) || undefined,
    suppressedIntermediateSummary: Boolean(result.metadata?.suppressedIntermediateSummary) || undefined,
    summarySuppressionReason: result.metadata?.summarySuppressionReason,
  }
}

export const buildNocodeEditorDoneStreamMetadata = (options: {
  assistantMessageId: string
  traceId: string
  actionCount: number
  finalContent: string
  actionResults: AiActionResult[]
  unsupportedBlueprintAutoRepairAttempts?: number
  unsupportedBlueprintAutoRepairFailed?: boolean
  continuityHints?: unknown[]
  blocks?: unknown[]
  appBuilderPlanningSummary?: string
  appBuilderPlanningArtifacts?: unknown[]
  appBuilderPlanningOutline?: Record<string, unknown>
}) => {
  const draftPersistenceState = resolveLatestDraftOnlyBlueprintState(options.actionResults)
  const unsupportedBlueprintAutoRepairAttempts = Math.max(
    0,
    Math.round(Number(options.unsupportedBlueprintAutoRepairAttempts || 0)),
  )
  const artifactKinds = Array.from(new Set([
    ...extractArtifactKindsFromBlocks(options.blocks),
    ...options.actionResults.flatMap((result) => {
      const summary = buildNocodeEditorToolResultAssistantMessage(result)
      return extractArtifactKindsFromBlocks(summary?.metadata?.blocks)
    }),
  ]))

  return {
    scene: 'nocode-editor',
    assistantMessageId: options.assistantMessageId,
    traceId: options.traceId,
    actionCount: options.actionCount,
    finalContent: options.finalContent,
    artifactKinds,
    continuityHints: options.continuityHints || [],
    blocks: toBlocks(options.blocks),
    appBuilderPlanningSummary: String(options.appBuilderPlanningSummary || '').trim() || undefined,
    appBuilderPlanningArtifacts: toBlocks(options.appBuilderPlanningArtifacts),
    appBuilderPlanningOutline: options.appBuilderPlanningOutline
      && typeof options.appBuilderPlanningOutline === 'object'
      && !Array.isArray(options.appBuilderPlanningOutline)
      ? options.appBuilderPlanningOutline
      : undefined,
    unsupportedBlueprintAutoRepairAttempts: unsupportedBlueprintAutoRepairAttempts || undefined,
    unsupportedBlueprintAutoRepairFailed: (
      unsupportedBlueprintAutoRepairAttempts > 0
      || Boolean(options.unsupportedBlueprintAutoRepairFailed)
    )
      ? Boolean(options.unsupportedBlueprintAutoRepairFailed)
      : undefined,
    draftPersistenceState: draftPersistenceState || undefined,
    draftIssueActionList: draftPersistenceState || undefined,
  }
}
