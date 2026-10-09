import type {
  AiActionResult,
} from '../ai.types'
import type {
  AiAssistantAppPlanArtifactBlock,
  AiAssistantArtifactBlock,
  AiAssistantConfirmationCardPresentation,
  AiAssistantContentPlanArtifactBlock,
  AiAssistantFormulaPlanArtifactBlock,
  AiAssistantFormulaResultItem,
  AiAssistantFormulaTargetResultItem,
  AiAssistantFlowSchemeArtifactBlock,
  AiAssistantFlowPlanArtifactBlock,
  AiAssistantFlowPatchResultBlock,
  AiAssistantFormPlanArtifactBlock,
  AiAssistantMessageBlock,
} from '@common/types/ai'
import {
  resolveAiAssistantMessageBlocks,
} from '@common/utils/aiMessageBlocks'
import {
  buildAiAssistantFlowPatchResultOperationLines,
} from '@common/utils/aiFlowPatchResultPresentation'
import {
  normalizeNocodeEditorArtifactBlocks,
} from '@common/utils/nocodeEditorArtifactBlocks'
import {
  resolveBlueprintWidgetTypeLabelFromAny,
} from '@common/utils/nocodeEditorBlueprintWidgetLabel'
import {
  resolveNocodeEditorBlueprintDisplayTitle,
} from '@common/utils/nocodeEditorBlueprintTitle'
import {
  normalizeNocodeEditorContentPlan,
} from '@common/utils/nocodeEditorContentPlan'
import {
  buildSharedAppPlanConfirmationCardPresentation,
  buildSharedApplicationStructurePreview,
  buildSharedFormPlanConfirmationCardPresentation,
} from '@common/utils/nocodeEditorConfirmationCardPresentation'
import {
  normalizeNocodeEditorFlowPlan,
  resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  normalizeNocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  normalizeFlowIssueRoutingResult,
  projectFlowIssueRouteToLegacyFields,
  routeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  normalizeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowUnifiedIssue'
import {
  isFlowGroundingReturnToPlanMetadata,
  resolveFlowGroundingReturnFlowSchemeTitle,
  resolveFlowGroundingReturnPlanningContextKey,
} from '@common/utils/nocodeEditorFlowGroundingReturnToPlan'
import {
  buildFlowGroundingConvergenceResultSummary as buildSharedFlowGroundingConvergenceResultSummary,
  buildFlowSchemeDependencyFromGroundingDiagnostic,
  isNocodeEditorFlowGroundingOwnerUsage,
  type NocodeEditorFlowSchemeGroundingDiagnostic,
} from '@common/utils/nocodeEditorFlowSchemeGrounding'
import {
  containsTechnicalFlowText,
  normalizeText,
  normalizeVisibleFlowGroundingQuestions,
} from '@common/utils/nocodeEditorFlowGroundingPresentation'
import {
  convertNocodeEditorFlowBlueprintToFlowPlan,
  normalizeNocodeEditorFlowBlueprint,
} from '@common/utils/nocodeEditorFlowBlueprint'
import {
  resolveSingleFormPlanningDisplayTitle,
  resolveSolutionPlanningDisplayTitle,
} from '@common/utils/nocodeEditorPlanningTitle'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'
import {
  buildNocodeEditorContentPlanConfirmation,
  buildNocodeEditorContentPlanMarkdownBlock,
} from './nocode-editor-content-plan.util'
import {
  buildNocodeEditorFlowPlanConfirmation,
} from './nocode-editor-flow-plan.util'
import {
  buildNocodeEditorFormPlanLeadText,
} from './nocode-editor-form-plan.util'
import {
  buildNocodeEditorConfirmationPayload,
} from './nocode-editor-confirmation.util'
import {
  projectBlueprintConfirmation,
} from '@common/utils/nocodeEditorBlueprintConfirmationProjection'
import {
  isNocodeEditorHiddenTimelineTool,
} from '@common/utils/nocodeEditorAiToolVisibility'
import {
  resolveNocodeEditorIndustrySkeletonCarryover,
} from '@common/utils/nocodeEditorIndustrySkeleton'
import {
  buildNocodeEditorVersionLabel,
} from '@common/utils/nocodeEditorVersionLabel'
import {
  resolveNocodeEditorAppBuilderExecutionLevelLabel,
  resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel,
  resolveNocodeEditorAppBuilderPlanningModeLabel,
} from '@common/utils/nocodeEditorAppBuilderPlanningLabels'
import {
  normalizeNocodeEditorPostFormFlowSignals,
} from '@common/utils/nocodeEditorPostFormFlowSignals'
import {
  normalizeNocodeEditorPostFormFlowOpportunity,
} from '@common/utils/nocodeEditorPostFormFlowOpportunity'
import {
  buildNocodeEditorPostFormFlowInlineMessageLines,
  normalizeNocodeEditorPostFormFlowFollowUp,
} from '@common/utils/nocodeEditorPostFormFlowFollowUp'
import {
  normalizeNocodeEditorPostFormFlowRelease,
} from '@common/utils/nocodeEditorPostFormFlowRelease'
import { normalizeFormulaText } from '@common/utils/formula'
import {
  normalizeNocodeEditorFormulaPlan,
} from '@common/utils/nocodeEditorFormulaDomain'
import {
  normalizeNocodeEditorFormulaActions,
  normalizeNocodeEditorFormulaTargetResults,
} from '@common/utils/nocodeEditorFormulaActions'

type NocodeEditorToolResultAssistantMessage = {
  content: string
  metadata?: Record<string, unknown>
}

export type NocodeEditorToolResultSummaryStage =
  | 'plain-assistant'
  | 'app-plan'
  | 'content-plan'
  | 'formula-plan'
  | 'flow-scheme'
  | 'flow-plan'
  | 'form-plan'
  | 'blueprint'

type NocodeEditorContinuityHint = {
  kind: string
  text: string
  sourceConversationId?: string
  sourceTaskId?: string
}

type UnknownRecord = Record<string, unknown>

type FlattenedSerializedWidget = {
  uid: string
  name: string
  type: string
  enumSourceType: string
  enumOptionCount: number
}

const TOOL_RESULT_MESSAGE_NAMES = new Set([
  'editor_get_host_context',
  'editor_open_form',
  'editor_stage_app_plan',
  'editor_stage_solution_outline',
  'editor_get_staged_app_plan',
  'editor_clear_staged_app_plan',
  'editor_stage_single_form_plan',
  'editor_stage_content_plan',
  'editor_stage_formula_plan',
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
  'editor_create_form',
  'editor_stage_app_blueprint',
  'editor_get_staged_app_blueprint',
  'editor_clear_staged_app_blueprint',
  'editor_apply_staged_app_blueprint',
  'editor_get_form_summary',
  'editor_get_relation_context',
  'editor_get_targeted_form_summaries',
  'editor_get_all_form_summaries',
  'editor_get_widget_option_schema',
  'editor_get_widget_option_choices',
  'editor_add_fields',
  'editor_delete_field',
  'editor_replace_field',
  'editor_bind_field_source',
  'editor_set_field_formulas',
  'editor_set_field_options',
  'editor_set_enum_options',
])

const FORMULA_FIELD_TOOL_NAMES = new Set([
  'editor_set_field_formulas',
  'editor_set_field_options',
])

const isFormulaFieldToolName = (value: unknown) => (
  FORMULA_FIELD_TOOL_NAMES.has(String(value || '').trim())
)

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const toRecord = (value: unknown): UnknownRecord => (
  isRecord(value) ? value : {}
)

const toUnknownArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
)

const normalizeQuestionList = (value: unknown) => (
  toUnknownArray(value)
    .map(item => normalizeText(item))
    .filter(Boolean)
)

const normalizeFlowGroundingUserMessage = (value: unknown) => {
  const message = normalizeText(value)
  return !message || containsTechnicalFlowText(message)
    ? global.i18next.t('nocodeEditorToolResultMessages.flowGroundingConfirmationRequired')
    : message
}

const resolvePlanningConvergenceLateQuestions = (result: AiActionResult) => {
  const explicitQuestions = normalizeVisibleFlowGroundingQuestions({
    questions: result?.metadata?.planningConvergenceLateQuestions,
  }).map(question => question.title)
  if (explicitQuestions.length) {
    return explicitQuestions
  }
  const flowGroundingQuestions = Array.isArray(result?.metadata?.flowGroundingQuestions)
    ? result.metadata.flowGroundingQuestions
    : []
  return normalizeVisibleFlowGroundingQuestions({
    questions: flowGroundingQuestions,
    diagnostics: normalizeFlowGroundingDiagnostics(result?.metadata?.flowGroundingDiagnostics),
  }).map(question => question.title)
}

const resolveBlueprintClarificationKind = (result: AiActionResult) => (
  String(result?.metadata?.blueprintClarificationKind || '').trim()
)

const formatBusinessVersionLabel = (revision: number, fallback: string) => (
  buildNocodeEditorVersionLabel(revision) || fallback
)

const formatWidgetTypeDisplay = (value: unknown) => (
  resolveBlueprintWidgetTypeLabelFromAny(value)
  || String(value || '').trim()
)

const formatWidgetNameWithType = (name: string, widgetType: unknown) => {
  const normalizedName = String(name || '').trim()
  const typeLabel = formatWidgetTypeDisplay(widgetType)
  return normalizedName
    ? `${normalizedName}${typeLabel ? `(${typeLabel})` : ''}`
    : ''
}

const appendDraftRefreshStatus = (message: string, output?: UnknownRecord | null) => {
  if (!output?.partialOk || output?.draftRefreshOk !== false) {
    return message
  }
  const error = String(output?.draftRefreshError || '').trim()
  return error
    ? global.i18next.t('nocodeEditorToolResultMessages.draftRefreshFailedWithReason', { message, error })
    : global.i18next.t('nocodeEditorToolResultMessages.draftRefreshFailed', { message })
}

const shouldRenderFormPlanSummary = (result: AiActionResult) => (
  String(result?.name || '').trim() === 'editor_stage_single_form_plan'
)

const toPositiveNumber = (value: unknown) => {
  const normalized = Number(value || 0)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined
}

const buildArtifactVersion = (revision?: number, stagedAt?: number, finishedAt?: number) => {
  if (!revision && !stagedAt && !finishedAt) {
    return undefined
  }
  return `${revision || 0}:${stagedAt || 0}:${finishedAt || 0}`
}

const buildFormPlanConfirmationCardPresentation = (
  result: AiActionResult,
  outline?: unknown,
  solutionPresentation?: unknown,
) => {
  const presentation = buildSharedFormPlanConfirmationCardPresentation({
    outline: outline || result?.output?.outline,
    solutionPresentation: solutionPresentation || toRecord(result?.metadata?.formPlanPresentation),
  })
  return presentation || undefined
}

const buildBlueprintConfirmationCardPresentation = (input: {
  summary?: unknown
  openQuestions?: string[]
}): AiAssistantConfirmationCardPresentation | null => {
  const summary = String(input.summary || '').trim()
  const openQuestions = input.openQuestions || []
  if (!summary && !openQuestions.length) {
    return null
  }

  return {
    goal: summary || undefined,
    nextSteps: openQuestions.length
      ? [
        global.i18next.t('nocodeEditorToolResultMessages.confirmItemsInOrder'),
        global.i18next.t('nocodeEditorToolResultMessages.confirmThenGenerateBlueprint'),
      ]
      : [
        global.i18next.t('nocodeEditorToolResultMessages.reviewBlueprintPagesAndFields'),
        global.i18next.t('nocodeEditorToolResultMessages.generateAfterReview'),
      ],
    aiHandling: openQuestions.length
      ? global.i18next.t('nocodeEditorToolResultMessages.waitForBlueprintConfirmation')
      : global.i18next.t('nocodeEditorToolResultMessages.continueFromBlueprintAfterConfirmation'),
    pendingTitle: openQuestions.length
      ? global.i18next.t('nocodeEditorToolResultMessages.pendingItemCount', { count: openQuestions.length })
      : undefined,
  }
}

const isArtifactBlock = (block: AiAssistantMessageBlock): block is AiAssistantArtifactBlock => block.type === 'artifact'

const isMissingArtifactValue = (value: unknown) => (
  value === undefined
  || value === null
  || value === ''
)

const mergeArtifactBlocksWithPrimary = (
  primary: AiAssistantArtifactBlock,
  blocks: AiAssistantArtifactBlock[],
): AiAssistantArtifactBlock => {
  const merged: Record<string, unknown> = {
    ...primary,
  }

  for (const block of blocks) {
    for (const [key, value] of Object.entries(block)) {
      if (!isMissingArtifactValue(merged[key])) {
        continue
      }
      if (isMissingArtifactValue(value)) {
        continue
      }
      merged[key] = value
    }
  }

  return merged as AiAssistantArtifactBlock
}

const projectBlueprintArtifactBlockConfirmation = (
  block: AiAssistantArtifactBlock,
  lateQuestions?: unknown,
): AiAssistantArtifactBlock => {
  if (block.kind !== 'blueprint') {
    return block
  }

  const blueprint = toRecord((block as any).blueprint)
  const rawConfirmation = (block as any).confirmation ?? blueprint.confirmation
  const projection = projectBlueprintConfirmation({
    confirmation: rawConfirmation,
    openQuestions: blueprint.openQuestions,
    lateQuestions,
    summary: blueprint.summary || (block as any).summary,
  })
  const rawConfirmationRecord = toRecord(rawConfirmation)
  const isEmptyBlueprintGate = (
    rawConfirmationRecord.preferredSurface === 'gate'
    && Array.isArray(rawConfirmationRecord.questions)
    && rawConfirmationRecord.questions.length === 0
  )
  const confirmation = projection.confirmation || (isEmptyBlueprintGate ? rawConfirmation : undefined)

  return {
    ...block,
    blueprint: {
      ...blueprint,
      openQuestions: projection.openQuestions,
      confirmation: confirmation || undefined,
    },
    confirmation: confirmation || undefined,
  } as AiAssistantArtifactBlock
}

const resolveMetadataArtifactBlocks = (value: unknown) => {
  const blocks = resolveAiAssistantMessageBlocks(value)
  const artifacts = blocks.filter(isArtifactBlock)
  const nonArtifacts = blocks.filter(block => !isArtifactBlock(block))
  return {
    artifacts,
    nonArtifacts,
  }
}

const resolveFlowPlanBundleFromToolResult = (result: AiActionResult) => {
  const toolName = String(result?.name || '').trim()
  if (
    toolName !== 'editor_stage_flow_blueprint'
    && toolName !== 'editor_apply_staged_flow'
  ) {
    return null
  }

  const output = toRecord(result?.output)
  const resolveBundle = (rawPlan: unknown) => {
    const flowPlan = normalizeNocodeEditorFlowPlan(rawPlan)
    return flowPlan
      ? {
          rawPlan,
          rawPlanRecord: toRecord(rawPlan),
          flowPlan,
        }
      : null
  }

  if (toolName === 'editor_stage_flow_blueprint') {
    return resolveBundle(output.flowPlan)
      || resolveBundle(
        convertNocodeEditorFlowBlueprintToFlowPlan(
          normalizeNocodeEditorFlowBlueprint(output.blueprint),
        ),
      )
  }

  return resolveBundle(result?.metadata?.flowPlan)
    || resolveBundle(output.flowPlan)
}

const resolveFlowPlanValidationWaitText = (rawPlan: unknown) => {
  const validation = toRecord(toRecord(rawPlan).validation)
  if (!Object.keys(validation).length) {
    return ''
  }

  const status = String(validation.status || '').trim()
  const summary = String(validation.summary || '').trim()
  const needsValidation = (
    validation.compilable === false
    || ['failed', 'not_validated', 'pending'].includes(status)
  )
  if (!needsValidation) {
    return ''
  }

  return summary
    ? global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintValidationGapWithSummary', { summary })
    : global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintValidationGap')
}

const buildFlowPlanPendingConfirmationMarkdownBlock = (
  result: AiActionResult,
): AiAssistantMessageBlock | null => {
  const bundle = resolveFlowPlanBundleFromToolResult(result)
  const pendingQuestions = resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(bundle?.flowPlan)
  if (!bundle?.flowPlan || !pendingQuestions.length) {
    return null
  }

  return {
    type: 'markdown',
    text: [
      global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintPendingConfirmationTitle'),
      global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintLabel', { title: bundle.flowPlan.title }),
      global.i18next.t('nocodeEditorToolResultMessages.pendingConfirmationList', {
        questions: pendingQuestions.map(question => `- ${question}`).join('\n'),
      }),
    ].join('\n\n'),
  }
}

const resolveFormulaResultItems = (value: unknown): AiAssistantFormulaResultItem[] => {
  return normalizeNocodeEditorFormulaActions(value)
}

const resolveFormulaTargetResults = (value: unknown): AiAssistantFormulaTargetResultItem[] => (
  normalizeNocodeEditorFormulaTargetResults(value)
)

const buildFormulaResultContent = (value: unknown) => {
  const items = Array.isArray(value)
    ? value as AiAssistantFormulaResultItem[]
    : resolveFormulaResultItems(value)
  if (!items.length) {
    return ''
  }

  const resolveFormulaFieldName = (item: AiAssistantFormulaResultItem) => {
    const fieldName = String(item.fieldName || '').trim()
    const tableName = String(item.tableName || '').trim()
    if (!fieldName) {
      return tableName
    }
    if (!tableName || fieldName.includes('.')) {
      return fieldName
    }
    return `${tableName}.${fieldName}`
  }

  const formatFormulaDisplayText = (formula: string) => (
    String(formula || '').trim().replace(/\s*\*\s*/g, ' × ')
  )

  const lines = items.map((item) => {
    const formula = formatFormulaDisplayText(item.displayFormula || item.formula)
    return global.i18next.t('nocodeEditorToolResultMessages.formulaResultItem', {
      fieldName: resolveFormulaFieldName(item),
      formula,
    })
  })

  if (lines.length === 1) {
    return [
      global.i18next.t('nocodeEditorToolResultMessages.formulaUpdatedHeading'),
      lines[0],
    ].join('\n')
  }

  return [
    global.i18next.t('nocodeEditorToolResultMessages.formulasUpdatedHeading', { count: lines.length }),
    ...lines.map(line => `- ${line}`),
  ].join('\n')
}

const resolveFormulaResultDisplayFieldName = (item: {
  fieldName?: string
  tableName?: string
}) => {
  const fieldName = String(item.fieldName || '').trim()
  const tableName = String(item.tableName || '').trim()
  if (!fieldName) {
    return tableName
  }
  if (!tableName || fieldName.includes('.')) {
    return fieldName
  }
  return `${tableName}.${fieldName}`
}

const formatFormulaResultDisplayText = (formula: string) => (
  String(formula || '').trim().replace(/\s*\*\s*/g, ' × ')
)

const buildFormulaTargetResultContent = (value: unknown) => {
  const items = resolveFormulaTargetResults(value)
  if (!items.length) {
    return ''
  }

  const updatedCount = items.filter(item => item.status === 'updated').length
  const draftCount = items.filter(item => item.status === 'draft').length
  const lines = items.map((item) => {
    const fieldName = resolveFormulaResultDisplayFieldName(item)
    if (item.status === 'skipped') {
      return global.i18next.t('nocodeEditorToolResultMessages.formulaSkippedItem', {
        fieldName,
        reason: item.reason,
      })
    }

    if (item.status === 'failed') {
      return global.i18next.t('nocodeEditorToolResultMessages.formulaSkippedItem', {
        fieldName,
        reason: item.reason,
      })
    }

    const formula = formatFormulaResultDisplayText(item.displayFormula || item.formula)
    const explanation = String(item.explanation || '').trim()
    if (item.status === 'draft') {
      return explanation
        ? global.i18next.t('nocodeEditorToolResultMessages.formulaDraftItemWithExplanation', {
          fieldName,
          formula,
          explanation,
        })
        : global.i18next.t('nocodeEditorToolResultMessages.formulaDraftItem', { fieldName, formula })
    }
    return explanation
      ? global.i18next.t('nocodeEditorToolResultMessages.formulaAppliedItemWithExplanation', {
        fieldName,
        formula,
        explanation,
      })
      : global.i18next.t('nocodeEditorToolResultMessages.formulaAppliedItem', { fieldName, formula })
  })

  const countText = [
    updatedCount
      ? global.i18next.t('nocodeEditorToolResultMessages.formulaUpdatedCount', { count: updatedCount })
      : '',
    draftCount
      ? global.i18next.t('nocodeEditorToolResultMessages.formulaDraftCount', { count: draftCount })
      : '',
  ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))

  return [
    countText
      ? global.i18next.t('nocodeEditorToolResultMessages.formulasProcessedWithCounts', {
        count: items.length,
        counts: countText,
      })
      : global.i18next.t('nocodeEditorToolResultMessages.formulasProcessed', { count: items.length }),
    ...lines,
  ].join('\n')
}

export const buildNocodeEditorMergedFormulaResultAssistantMessage = (
  results: AiActionResult[],
): NocodeEditorToolResultAssistantMessage | null => {
  const targetResults = (results || [])
    .flatMap(result => resolveFormulaTargetResults(result?.output?.formulaTargetResults))
  const items = (results || [])
    .flatMap(result => resolveFormulaResultItems(result?.output?.formulaUpdates))
  const persistenceMode = (results || []).some(result => (
    String(result?.output?.persistenceMode || '').trim() === 'draft_only'
  ))
    ? 'draft_only'
    : undefined

  if (!items.length && !targetResults.length) {
    return null
  }

  return {
    content: targetResults.length
      ? buildFormulaTargetResultContent(targetResults)
      : buildFormulaResultContent(items),
    metadata: {
      toolName: 'editor_set_field_formulas',
      toolResultSummary: true,
      ok: true,
      summaryStage: 'plain-assistant',
      formulaActions: items,
      ...(targetResults.length ? { formulaTargetResults: targetResults } : {}),
      ...(persistenceMode ? { persistenceMode } : {}),
    },
  }
}

const buildAppPlanArtifactBlockForResult = (result: AiActionResult): AiAssistantAppPlanArtifactBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_plan') {
    return null
  }
  const output = toRecord(result.output)
  const plan = isRecord(output.plan) ? output.plan : null
  if (!plan) {
    return null
  }
  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  const rawOutline = isRecord(plan.outline) ? plan.outline : {}
  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'app-plan',
    structuredConfirmation: rawOutline.confirmation,
    legacyConfirmation: plan.confirmation,
    legacyOpenQuestions: [
      ...normalizeQuestionList(
        Array.isArray(plan.openQuestions) ? plan.openQuestions : plan.open_questions,
      ),
      ...normalizeQuestionList(rawOutline.openQuestions),
    ],
    legacyOpenQuestionsMode: 'fallback-only',
    summary: String(plan.goal || rawOutline.summary || '').trim() || undefined,
  })
  const canonicalOutline = {
    ...rawOutline,
    openQuestions: projection.openQuestions,
    confirmation: projection.confirmation,
  }
  const canonicalPlan: Record<string, unknown> = {
    ...plan,
    openQuestions: projection.openQuestions,
    outline: canonicalOutline,
  }
  delete canonicalPlan.confirmation
  const industrySkeletonContext = resolveNocodeEditorIndustrySkeletonCarryover(
    result?.metadata?.industrySkeletonContext,
  )
  return {
    type: 'artifact',
    kind: 'app-plan',
    status: result.ok ? 'ready' : 'error',
    version: buildArtifactVersion(revision, stagedAt),
    revision: revision || undefined,
    stagedAt: stagedAt || undefined,
    title: String(plan.goal || global.i18next.t('nocodeEditorToolResultMessages.appPlan')).trim()
      || global.i18next.t('nocodeEditorToolResultMessages.appPlan'),
    summary: String(plan.goal || '').trim() || undefined,
    industrySkeletonContext,
    applicationStructurePreview: buildSharedApplicationStructurePreview({
      previewMode: 'app-plan',
      outline: canonicalOutline,
    }),
    appPlan: canonicalPlan as AiAssistantAppPlanArtifactBlock['appPlan'],
    confirmation: projection.confirmation,
    confirmationCardPresentation: buildSharedAppPlanConfirmationCardPresentation({
      summary: String(plan.goal || '').trim(),
      goal: String(plan.goal || '').trim(),
      mode: plan.mode,
      objects: plan.objects,
      artifacts: plan.artifacts,
      openQuestions: projection.openQuestions,
      confirmation: projection.confirmation,
    }),
  }
}

const buildLegacySolutionArtifactBlockForResult = (result: AiActionResult): AiAssistantArtifactBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_stage_solution_outline') {
    return null
  }
  const output = toRecord(result.output)
  const outline = isRecord(output.outline) ? output.outline : null
  if (!outline) {
    return null
  }
  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  return {
    type: 'artifact',
    kind: 'solution',
    status: result.ok ? 'ready' : 'error',
    version: buildArtifactVersion(revision, stagedAt),
    revision,
    stagedAt,
    title: resolveSolutionPlanningDisplayTitle({
      title: outline.title,
      modules: outline.modules,
    }),
    summary: String(outline.summary || '').trim() || undefined,
    outline,
  } as unknown as AiAssistantArtifactBlock
}

const buildFormPlanArtifactBlockForResult = (result: AiActionResult): AiAssistantFormPlanArtifactBlock | null => {
  if (!shouldRenderFormPlanSummary(result)) {
    return null
  }

  const output = toRecord(result?.output)
  const outline = normalizeNocodeEditorPlanningOutline(output.outline, {
    confirmationStage: 'form-plan',
    legacyConfirmation: output.confirmation,
    legacyOpenQuestions: output.openQuestions,
    legacyOpenQuestionsMode: 'fallback-only',
  })
  if (!outline) {
    return null
  }

  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  const formPlanPresentation = isRecord(result?.metadata?.formPlanPresentation)
    ? result.metadata.formPlanPresentation
    : {
      formCount: outline.forms.length,
      moduleCount: outline.modules.length,
      planningItemCount: 0,
    }
  const industrySkeletonContext = resolveNocodeEditorIndustrySkeletonCarryover(
    result?.metadata?.industrySkeletonContext,
  )

  return {
    type: 'artifact',
    kind: 'form-plan',
    status: 'ready',
    version: buildArtifactVersion(revision, stagedAt),
    revision,
    stagedAt,
    title: resolveSingleFormPlanningDisplayTitle({
      outline,
    }),
    summary: String(outline.summary || '').trim() || undefined,
    outline,
    formPlanPresentation: formPlanPresentation as AiAssistantFormPlanArtifactBlock['formPlanPresentation'],
    industrySkeletonContext,
    applicationStructurePreview: buildSharedApplicationStructurePreview({
      previewMode: 'form-plan',
      outline,
      presentation: formPlanPresentation ? toRecord(formPlanPresentation) : null,
    }),
    confirmation: outline.confirmation,
    confirmationCardPresentation: buildFormPlanConfirmationCardPresentation(
      result,
      outline,
      formPlanPresentation,
    ),
  }
}

const buildContentPlanArtifactBlockForResult = (result: AiActionResult): AiAssistantContentPlanArtifactBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_stage_content_plan') {
    return null
  }

  const output = toRecord(result?.output)
  const rawPlan = toRecord(output.plan)
  const plan = normalizeNocodeEditorContentPlan(rawPlan)
  if (!plan) {
    return null
  }

  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)

  return {
    type: 'artifact',
    kind: 'content-plan',
    status: 'ready',
    version: buildArtifactVersion(revision, stagedAt),
    revision,
    stagedAt,
    title: String(plan.title || '').trim()
      || global.i18next.t('nocodeEditorToolResultMessages.contentPlan'),
    summary: String(plan.summary || '').trim() || undefined,
    plan,
    confirmation: buildNocodeEditorContentPlanConfirmation({
      ...plan,
      confirmation: rawPlan.confirmation,
    }),
  }
}

const buildFormulaPlanPresentation = (plan: NonNullable<ReturnType<typeof normalizeNocodeEditorFormulaPlan>>) => {
  const formulaPathLabel = (formulaPath: string) => (
    formulaPath === 'default-formula'
      ? global.i18next.t('formulaPlanPresentation.path.default-formula')
      : global.i18next.t('formulaPlanPresentation.path.compute-formula')
  )
  const planningItems = plan.items.flatMap(item => (
    item.formulaSettings.map(setting => (
      global.i18next.t('formulaPlanPresentation.formulaItem', {
        fieldName: item.target.fieldName,
        formulaPath: formulaPathLabel(setting.formulaPath),
        formula: setting.formula,
      })
    ))
  ))
  const formNames = Array.from(new Set(
    plan.items
      .map(item => String(item.target.formName || '').trim())
      .filter(Boolean),
  ))
  return {
    goal: plan.summary,
    ...(planningItems.length ? { planningItems } : {}),
    ...(formNames.length ? { scope: formNames.join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator')) } : {}),
    ...(plan.openQuestions.length
      ? { pendingTitle: global.i18next.t('formulaPlanPresentation.pendingTitle', { count: plan.openQuestions.length }) }
      : {}),
  }
}

const normalizeFormulaPlanSourceContext = (value: unknown) => {
  const source = toRecord(value)
  const taskId = String(source.taskId || '').trim()
  const taskScopeKey = String(source.taskScopeKey || '').trim()
  const nocodeId = String(source.nocodeId || '').trim()
  const formId = String(source.formId || '').trim()
  const evidenceFingerprint = String(source.evidenceFingerprint || '').trim()
  const capturedAt = Number(source.capturedAt || 0)
  if (!taskScopeKey || !nocodeId || !formId || !evidenceFingerprint || !Number.isFinite(capturedAt) || capturedAt <= 0) {
    return null
  }
  const draftRevision = Number(source.draftRevision)
  return {
    ...(taskId ? { taskId } : {}),
    taskScopeKey,
    nocodeId,
    formId,
    ...(Number.isFinite(draftRevision) && draftRevision >= 0 ? { draftRevision } : {}),
    evidenceFingerprint,
    capturedAt,
  }
}

const buildFormulaPlanArtifactBlockForResult = (result: AiActionResult): AiAssistantFormulaPlanArtifactBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_stage_formula_plan') {
    return null
  }

  const output = toRecord(result.output)
  const plan = normalizeNocodeEditorFormulaPlan(output.plan)
  const sourceContext = normalizeFormulaPlanSourceContext(output.sourceContext)
  if (!plan || !sourceContext) {
    return null
  }

  const confirmation = buildNocodeEditorConfirmationPayload({
    stage: 'form-plan',
    confirmation: output.confirmation || plan.confirmation,
    summary: plan.summary,
    openQuestions: plan.openQuestions,
  })
  const formulaPlan = {
    ...plan,
    ...(confirmation ? { confirmation } : {}),
  }
  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  const formulaPresentation = buildFormulaPlanPresentation(formulaPlan)

  return {
    type: 'artifact',
    kind: 'formula-plan',
    status: result.ok ? 'ready' : 'error',
    version: buildArtifactVersion(revision, stagedAt),
    revision,
    stagedAt,
    title: formulaPlan.title,
    summary: formulaPlan.summary,
    planningScope: String(output.planningScope || '').trim() as AiAssistantFormulaPlanArtifactBlock['planningScope'],
    sourceContext,
    confirmation: confirmation || undefined,
    confirmationCardPresentation: formulaPresentation,
    formulaPlan,
    formulaPresentation,
  }
}

const normalizeFlowGroundingConfirmationQuestions = (
  value: unknown,
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[] = [],
) => normalizeVisibleFlowGroundingQuestions({
  questions: value,
  diagnostics,
  preferDiagnostics: true,
})

const normalizeFlowGroundingDiagnostics = (value: unknown): NocodeEditorFlowSchemeGroundingDiagnostic[] => (
  toUnknownArray(value)
    .map((item): NocodeEditorFlowSchemeGroundingDiagnostic | null => {
      const diagnostic = toRecord(item)
      const code = String(diagnostic.code || '').trim()
      const message = String(diagnostic.message || '').trim()
      if (!code || !message) {
        return null
      }
      return {
        code,
        message,
        nodeKey: String(diagnostic.nodeKey || '').trim() || undefined,
        nodeName: String(diagnostic.nodeName || '').trim() || undefined,
        branchKey: String(diagnostic.branchKey || '').trim() || undefined,
        branchLabel: String(diagnostic.branchLabel || '').trim() || undefined,
        ownerUsage: isNocodeEditorFlowGroundingOwnerUsage(diagnostic.ownerUsage)
          ? diagnostic.ownerUsage
          : undefined,
        compatibleFields: toUnknownArray(diagnostic.compatibleFields)
          .flatMap((item) => {
            const field = toRecord(item)
            const fieldId = normalizeText(field.fieldId)
            const fieldName = normalizeText(field.fieldName)
            if (!fieldId || !fieldName) {
              return []
            }
            return [{
              fieldId,
              fieldName,
              ownerPolicy: normalizeText(field.ownerPolicy) || undefined,
              matchReason: normalizeText(field.matchReason) || undefined,
            }]
          }),
        candidateCount: Number.isFinite(Number(diagnostic.candidateCount))
          ? Number(diagnostic.candidateCount)
          : undefined,
      }
    })
    .filter((item): item is NocodeEditorFlowSchemeGroundingDiagnostic => Boolean(item))
)

type FlowGroundingDependencyQuestionInput = {
  title?: unknown
  scopeKind?: unknown
}

const buildFlowGroundingDependencies = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
  questions: FlowGroundingDependencyQuestionInput[],
) => {
  if (diagnostics.length > 0) {
    return diagnostics.flatMap((diagnostic) => {
      const dependency = buildFlowSchemeDependencyFromGroundingDiagnostic(diagnostic)
      return dependency ? [dependency] : []
    })
  }

  return questions.map((question, index) => {
    const title = normalizeText(question.title)
      || global.i18next.t('nocodeEditorToolResultMessages.flowDependencyPending')
    const requiredFor = /条件|判断|分流/u.test(title)
      ? 'condition' as const
      : /通知/u.test(title)
        ? 'notify_target' as const
        : /审批/u.test(title)
          ? 'approval_owner' as const
          : 'owner_binding' as const
    return {
      id: `flow-grounding-dependency-${index + 1}`,
      kind: 'field_missing' as const,
      requiredFor,
      scopeKind: question.scopeKind === 'trigger-branch' ? 'branch' as const : 'global' as const,
      scopeKey: undefined,
      scopeTitle: undefined,
      riskLevel: 'high' as const,
      resolutionStatus: 'unresolved' as const,
      materializationStatus: 'not_available' as const,
      summary: title,
    }
  })
}

const resolveFlowIssueProjectionForResult = (result: AiActionResult) => {
  const metadata = toRecord(result?.metadata)
  const output = toRecord(result?.output)
  const metadataIssues = normalizeUnifiedFlowIssues(metadata.flowUnifiedIssues)
  const outputIssues = normalizeUnifiedFlowIssues(output.flowUnifiedIssues)
  const metadataRouting = normalizeFlowIssueRoutingResult(metadata.flowIssueRouting)
  const outputRouting = normalizeFlowIssueRoutingResult(output.flowIssueRouting)
  const inputRouting = metadataRouting || outputRouting
  const routingIssues = normalizeUnifiedFlowIssues(inputRouting)
  const flowUnifiedIssues = metadataIssues.length
    ? metadataIssues
    : outputIssues.length
      ? outputIssues
      : routingIssues
  const shouldProjectEmptyAutoContinue = !flowUnifiedIssues.length && inputRouting?.outcome === 'auto_continue'
  const routedFlowIssues = flowUnifiedIssues.length
    ? routeUnifiedFlowIssues(flowUnifiedIssues)
    : shouldProjectEmptyAutoContinue
      ? routeUnifiedFlowIssues([])
    : null
  const flowIssueRouting = routedFlowIssues
    ? {
        ...routedFlowIssues,
        blockedNextAction: routedFlowIssues.blockedNextAction || inputRouting?.blockedNextAction,
        userMessage: routedFlowIssues.userMessage || inputRouting?.userMessage,
    }
    : null

  if ((!flowUnifiedIssues.length && !shouldProjectEmptyAutoContinue) || !flowIssueRouting) {
    return null
  }

  const planningContextKey = String(
    metadata.planningContextKey
    || output.planningContextKey
    || flowUnifiedIssues[0]?.planningContextKey
    || '',
  ).trim()
  const projection = projectFlowIssueRouteToLegacyFields({
    issues: flowUnifiedIssues,
    routing: flowIssueRouting || routeUnifiedFlowIssues(flowUnifiedIssues),
    planningContextKey: planningContextKey || undefined,
    stage: String(result?.name || '').trim() === 'editor_plan_flow_scheme' ? 'flow-scheme' : 'flow-plan',
  })

  return {
    flowUnifiedIssues,
    flowIssueRouting,
    projection,
    planningContextKey,
  }
}

const buildFlowIssueArtifactFields = (
  flowIssueProjection: ReturnType<typeof resolveFlowIssueProjectionForResult>,
): UnknownRecord => (
  flowIssueProjection
    ? {
        flowUnifiedIssues: flowIssueProjection.flowUnifiedIssues,
        flowIssueRouting: flowIssueProjection.flowIssueRouting,
      }
    : {}
)

const hasRawFlowIssueRoutingPayload = (
  value: UnknownRecord,
) => Object.prototype.hasOwnProperty.call(value, 'flowIssueRouting')

const buildFlowGroundingFlowSchemeArtifactBlockForResult = (
  result: AiActionResult,
): AiAssistantFlowSchemeArtifactBlock | null => {
  const metadata = toRecord(result?.metadata)
  const output = toRecord(result?.output)
  const flowIssueProjection = resolveFlowIssueProjectionForResult(result)
  if (flowIssueProjection) {
    if (
      flowIssueProjection.flowIssueRouting.outcome !== 'return_to_flow_scheme'
      || (
        !flowIssueProjection.projection.openQuestions.length
        && !flowIssueProjection.projection.confirmation?.questions?.length
      )
    ) {
      return null
    }

    const message = normalizeFlowGroundingUserMessage(flowIssueProjection.projection.userMessage)
    const flowSchemeTitle = resolveFlowGroundingReturnFlowSchemeTitle({
      ...toRecord(result?.output),
      ...metadata,
    }) || global.i18next.t('nocodeEditorToolResultMessages.flowScheme')
    const questions = flowIssueProjection.projection.confirmation?.questions || []
    const diagnostics = flowIssueProjection.flowUnifiedIssues.flatMap(issue => (
      Array.isArray(issue.diagnostics) ? issue.diagnostics : []
    )) as NocodeEditorFlowSchemeGroundingDiagnostic[]
    const dependencies = buildFlowGroundingDependencies(diagnostics, questions)
    const resultSummary = buildSharedFlowGroundingConvergenceResultSummary({
      dependencies,
    })

    return {
      type: 'artifact',
      kind: 'flow-scheme',
      status: 'ready',
      title: flowSchemeTitle,
      summary: message,
      message,
      error: message,
      planningStatus: flowIssueProjection.projection.planningStatus,
      scheme: {
        title: flowSchemeTitle,
        summary: message,
        trigger: {
          type: 'unknown',
          description: global.i18next.t('nocodeEditorToolResultMessages.flowGroundingConfirmationRequired'),
        },
        mainPath: [],
        branches: [],
        confirmedFacts: [],
        assumptions: [],
        openQuestions: flowIssueProjection.projection.openQuestions,
        dependencies,
        convergence: {
          businessStatus: 'pending',
          dependencyStatus: dependencies.length > 0 ? 'pending' : 'resolved',
          materializationStatus: 'all_existing',
          unresolvedQuestionCount: flowIssueProjection.projection.openQuestions.length,
          unresolvedDependencyCount: dependencies.length,
          plannedDependencyCount: 0,
          requiredDeferredConfigCount: 0,
          optionalDeferredConfigCount: 0,
          deferredConfigItemCount: 0,
        },
      },
      confirmation: flowIssueProjection.projection.confirmation
        ? {
            ...flowIssueProjection.projection.confirmation,
            resultSummary: resultSummary.length ? resultSummary : undefined,
          }
        : null,
      ...buildFlowIssueArtifactFields(flowIssueProjection),
    } as AiAssistantFlowSchemeArtifactBlock
  }

  if (hasRawFlowIssueRoutingPayload(metadata) || hasRawFlowIssueRoutingPayload(output)) {
    return null
  }

  if (!isFlowGroundingReturnToPlanMetadata(metadata)) {
    return null
  }

  const diagnostics = normalizeFlowGroundingDiagnostics(metadata.flowGroundingDiagnostics)
  const questions = normalizeFlowGroundingConfirmationQuestions(
    metadata.flowGroundingQuestions,
    diagnostics,
  )

  const message = normalizeFlowGroundingUserMessage(metadata.flowGroundingUserMessage)
  const planningContextKey = resolveFlowGroundingReturnPlanningContextKey({
    ...toRecord(result?.output),
    ...metadata,
  })
  const flowSchemeTitle = resolveFlowGroundingReturnFlowSchemeTitle({
    ...toRecord(result?.output),
    ...metadata,
  }) || global.i18next.t('nocodeEditorToolResultMessages.flowScheme')
  const openQuestions = questions.map((question, index) => ({
    key: question.id || `flow-grounding-confirmation-${index + 1}`,
    title: question.title,
    reason: question.description || question.title,
    scopeKind: question.scopeKind === 'trigger-branch' ? 'branch' as const : 'global' as const,
  }))
  const dependencies = buildFlowGroundingDependencies(diagnostics, questions)
  const resultSummary = buildSharedFlowGroundingConvergenceResultSummary({
    dependencies,
  })

  return {
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'ready',
    title: flowSchemeTitle,
    summary: message,
    message,
    error: message,
    planningStatus: 'needs_confirmation',
    scheme: {
      title: flowSchemeTitle,
      summary: message,
      trigger: {
        type: 'unknown',
        description: global.i18next.t('nocodeEditorToolResultMessages.flowGroundingConfirmationRequired'),
      },
      mainPath: [],
      branches: [],
      confirmedFacts: [],
      assumptions: [],
      openQuestions,
      dependencies,
      convergence: {
        businessStatus: 'pending',
        dependencyStatus: dependencies.length > 0 ? 'pending' : 'resolved',
        materializationStatus: 'all_existing',
        unresolvedQuestionCount: openQuestions.length,
        unresolvedDependencyCount: dependencies.length,
        plannedDependencyCount: 0,
        requiredDeferredConfigCount: 0,
        optionalDeferredConfigCount: 0,
        deferredConfigItemCount: 0,
      },
    },
    confirmation: {
      stage: 'flow-scheme',
      status: 'pending',
      planningContextKey,
      questions,
      resultSummary: resultSummary.length ? resultSummary : undefined,
      requiredNextAction: 'editor_plan_flow_scheme',
      blockedNextAction: 'editor_stage_flow_blueprint',
    },
  }
}

const buildFlowSchemeArtifactBlockForResult = (result: AiActionResult): AiAssistantFlowSchemeArtifactBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_plan_flow_scheme') {
    return null
  }

  const output = toRecord(result?.output)
  const scheme = normalizeNocodeEditorFlowScheme(output.scheme)
  if (!scheme) {
    return null
  }

  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  const flowIssueProjection = resolveFlowIssueProjectionForResult(result)
  const projectedScheme = flowIssueProjection
    ? {
        ...scheme,
        openQuestions: flowIssueProjection.projection.openQuestions,
        confirmation: flowIssueProjection.projection.confirmation,
      }
    : scheme
  const planningStatus = String(
    flowIssueProjection?.projection.planningStatus
    || output.planningStatus
    || '',
  ).trim() || undefined

  return {
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'ready',
    version: buildArtifactVersion(revision, stagedAt),
    revision,
    stagedAt,
    title: String(projectedScheme.title || '').trim()
      || global.i18next.t('nocodeEditorToolResultMessages.flowScheme'),
    summary: String(projectedScheme.summary || '').trim() || undefined,
    scheme: projectedScheme,
    planningStatus: planningStatus as AiAssistantFlowSchemeArtifactBlock['planningStatus'],
    confirmation: projectedScheme.confirmation || undefined,
    ...buildFlowIssueArtifactFields(flowIssueProjection),
  } as AiAssistantFlowSchemeArtifactBlock
}

const buildFlowPlanArtifactBlockForResult = (result: AiActionResult): AiAssistantFlowPlanArtifactBlock | null => {
  const toolName = String(result?.name || '').trim()
  if (
    toolName !== 'editor_stage_flow_blueprint'
    && toolName !== 'editor_apply_staged_flow'
  ) {
    return null
  }

  const output = toRecord(result?.output)
  const bundle = resolveFlowPlanBundleFromToolResult(result)
  if (!bundle?.flowPlan) {
    return null
  }

  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  const flowApplyResult = toolName === 'editor_apply_staged_flow'
    ? toRecord(output)
    : toRecord(output.applyResult)
  const flowIssueProjection = resolveFlowIssueProjectionForResult(result)

  return {
    type: 'artifact',
    kind: 'flow-plan',
    status: 'ready',
    version: buildArtifactVersion(revision, stagedAt, toPositiveNumber(flowApplyResult?.finishedAt)),
    revision,
    stagedAt,
    sourceSchemeRevision: toPositiveNumber(output.sourceSchemeRevision) || undefined,
    title: String(bundle.flowPlan.title || '').trim()
      || global.i18next.t('nocodeEditorToolResultMessages.flowBlueprint'),
    summary: String(bundle.flowPlan.summary || '').trim() || undefined,
    flowPlan: bundle.flowPlan,
    flowApplyResult: Object.keys(flowApplyResult).length ? flowApplyResult : null,
    confirmation: buildNocodeEditorFlowPlanConfirmation({
      ...bundle.flowPlan,
      confirmation: bundle.flowPlan.confirmation,
      ignoreOpenQuestionsFallback: bundle.rawPlanRecord._flowValidationKeepsConfirmationQuestionsLlmOnly === true,
    }),
    ...buildFlowIssueArtifactFields(flowIssueProjection),
  } as AiAssistantFlowPlanArtifactBlock
}

const buildBlueprintArtifactBlockForResult = (result: AiActionResult): AiAssistantArtifactBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_stage_app_blueprint') {
    return null
  }

  const output = toRecord(result?.output)
  const blueprint = isRecord(output.blueprint) ? output.blueprint : null
  if (!blueprint) {
    return null
  }

  const revision = toPositiveNumber(output.revision)
  const stagedAt = toPositiveNumber(output.stagedAt)
  const gateMode = String(result?.metadata?.blueprintApplyGate?.mode || '').trim()
  const industrySkeletonContext = resolveNocodeEditorIndustrySkeletonCarryover(
    result?.metadata?.industrySkeletonContext,
  )
  const planningConvergenceLateQuestions = resolvePlanningConvergenceLateQuestions(result)
  const blueprintConfirmationProjection = projectBlueprintConfirmation({
    confirmation: blueprint.confirmation,
    openQuestions: blueprint.openQuestions,
    lateQuestions: planningConvergenceLateQuestions,
    summary: blueprint.summary,
  })
  const openQuestions = blueprintConfirmationProjection.openQuestions
  const projectedBlueprint: Record<string, unknown> = {
    ...blueprint,
    openQuestions,
    confirmation: blueprintConfirmationProjection.confirmation || undefined,
  }
  const blueprintConfirmation = blueprintConfirmationProjection.confirmation
  const gateConfirmation = gateMode === 'require_explicit_confirmation'
    ? buildNocodeEditorConfirmationPayload({
      stage: 'blueprint',
      summary: projectedBlueprint.summary,
      confirmation: {
        ...(blueprintConfirmation || {}),
        preferredSurface: blueprintConfirmation?.preferredSurface || (openQuestions.length ? undefined : 'gate'),
        questions: blueprintConfirmation?.questions || [],
        continueLabel: global.i18next.t('nocodeEditorToolResultMessages.generateFromBlueprint'),
      },
    })
    : null

  return {
    type: 'artifact',
    kind: 'blueprint',
    status: 'ready',
    version: buildArtifactVersion(revision, stagedAt),
    revision,
    stagedAt,
    title: resolveNocodeEditorBlueprintDisplayTitle({
      title: projectedBlueprint.title,
      forms: Array.isArray(projectedBlueprint.forms) ? projectedBlueprint.forms : [],
      fallback: global.i18next.t('nocodeEditorToolResultMessages.blueprintDraft'),
    }) || global.i18next.t('nocodeEditorToolResultMessages.blueprintDraft'),
    summary: String(projectedBlueprint.summary || '').trim() || undefined,
    blueprint: projectedBlueprint,
    industrySkeletonContext,
    confirmation: gateConfirmation || blueprintConfirmation,
    confirmationCardPresentation: buildBlueprintConfirmationCardPresentation({
      summary: projectedBlueprint.summary,
      openQuestions,
    }),
  }
}

export const buildNocodeEditorToolResultArtifactBlocks = (
  result: AiActionResult,
): AiAssistantArtifactBlock[] => {
  const { artifacts: metadataArtifactBlocks } = resolveMetadataArtifactBlocks(result?.metadata?.artifactBlocks)
  const toolName = String(result?.name || '').trim()
  if (toolName === 'editor_patch_flow') {
    return []
  }
  const filteredMetadataArtifactBlocks = toolName === 'editor_stage_app_blueprint'
    ? metadataArtifactBlocks.filter(block => block.kind === 'blueprint')
    : metadataArtifactBlocks
  const synthesizedBlocks = [
    buildAppPlanArtifactBlockForResult(result),
    buildLegacySolutionArtifactBlockForResult(result),
    buildFormPlanArtifactBlockForResult(result),
    buildContentPlanArtifactBlockForResult(result),
    buildFormulaPlanArtifactBlockForResult(result),
    buildFlowSchemeArtifactBlockForResult(result),
    buildFlowGroundingFlowSchemeArtifactBlockForResult(result),
    buildFlowPlanArtifactBlockForResult(result),
    buildBlueprintArtifactBlockForResult(result),
  ].filter((block): block is AiAssistantArtifactBlock => Boolean(block))

  const allArtifactBlocks = [
    ...filteredMetadataArtifactBlocks,
    ...synthesizedBlocks,
  ]
  const latestArtifactBlocks = normalizeNocodeEditorArtifactBlocks(
    allArtifactBlocks.map(block => ({ ...block })),
  ) as AiAssistantArtifactBlock[]
  const planningConvergenceLateQuestions = resolvePlanningConvergenceLateQuestions(result)

  return latestArtifactBlocks.map(block => (
    projectBlueprintArtifactBlockConfirmation(
      mergeArtifactBlocksWithPrimary(
        block,
        allArtifactBlocks.filter(item => item.kind === block.kind),
      ),
      planningConvergenceLateQuestions,
    )
  ))
}

const buildFlowPatchResultBlockForResult = (
  result: AiActionResult,
): AiAssistantFlowPatchResultBlock | null => {
  if (String(result?.name || '').trim() !== 'editor_patch_flow' || result?.ok !== true) {
    return null
  }
  const output = toRecord(result.output)
  if (output.ok === false) {
    return null
  }
  const [block] = resolveAiAssistantMessageBlocks([{
    type: 'flow-patch-result',
    formId: output.formId,
    formName: output.formName,
    sourceVersion: output.sourceVersion,
    draftVersion: output.draftVersion,
    createdDraftVersion: output.createdDraftVersion,
    activeVersion: output.activeVersion,
    activeVersionUnchanged: output.activeVersionUnchanged,
    operations: output.appliedOperations,
    warnings: Array.isArray(output.warnings) ? output.warnings : undefined,
  }])
  return block?.type === 'flow-patch-result' ? block : null
}

const resolveToolResultMetadataBlocks = (result: AiActionResult) => {
  const { nonArtifacts } = resolveMetadataArtifactBlocks(result?.metadata?.artifactBlocks)
  const toolName = String(result?.name || '').trim()
  const filteredNonArtifacts = toolName === 'editor_patch_flow'
    ? []
    : toolName === 'editor_stage_app_plan' || toolName === 'editor_stage_single_form_plan'
      ? nonArtifacts.filter(block => block.type !== 'markdown')
      : nonArtifacts
  const contentPlan = resolveContentPlanFromToolResult(result)
  const contentPlanBlock = buildNocodeEditorContentPlanMarkdownBlock(contentPlan)
  const flowPlanMarkdownBlock = buildFlowPlanPendingConfirmationMarkdownBlock(result)
  const flowPatchResultBlock = buildFlowPatchResultBlockForResult(result)

  return [
    ...filteredNonArtifacts,
    ...(flowPlanMarkdownBlock ? [flowPlanMarkdownBlock] : []),
    ...buildNocodeEditorToolResultArtifactBlocks(result),
    ...(contentPlanBlock ? [contentPlanBlock] : []),
    ...(flowPatchResultBlock ? [flowPatchResultBlock] : []),
  ]
}

export const resolveNocodeEditorToolResultSummaryStage = (
  result: AiActionResult,
): NocodeEditorToolResultSummaryStage => {
  const toolName = String(result?.name || '').trim()
  if (toolName === 'editor_stage_app_blueprint') {
    return 'blueprint'
  }
  if (toolName === 'editor_stage_app_plan') {
    return 'app-plan'
  }
  if (toolName === 'editor_stage_single_form_plan') {
    return 'form-plan'
  }
  if (toolName === 'editor_stage_content_plan') {
    return 'content-plan'
  }
  if (toolName === 'editor_stage_formula_plan') {
    return 'formula-plan'
  }
  if (toolName === 'editor_plan_flow_scheme') {
    return 'flow-scheme'
  }
  if (
    toolName === 'editor_stage_flow_blueprint'
    || toolName === 'editor_apply_staged_flow'
  ) {
    return 'flow-plan'
  }
  return 'plain-assistant'
}

export const buildNocodeEditorToolResultAssistantMessage = (
  result: AiActionResult,
  options?: {
    continuityHints?: NocodeEditorContinuityHint[]
  },
): NocodeEditorToolResultAssistantMessage | null => {
  const toolName = String(result?.name || '').trim()
  if (!TOOL_RESULT_MESSAGE_NAMES.has(toolName)) {
    return null
  }
  if (result?.metadata?.duplicateBlocked || result?.metadata?.toolPolicyViolation) {
    return null
  }

  const semanticFailure = resolveSemanticFailure(result)
  const blocks = resolveToolResultMetadataBlocks(result)
  const summaryStage = resolveNocodeEditorToolResultSummaryStage(result)
  const planningConvergenceLateQuestions = resolvePlanningConvergenceLateQuestions(result)
  const metadata: Record<string, unknown> = {
    toolName,
    toolResultSummary: true,
    ok: !semanticFailure,
    summaryStage,
  }
  for (const key of [
    'suppressPersistedSummary',
    'suppressSummaryContent',
    'suppressStreamBlocks',
    'suppressedIntermediateSummary',
    'summarySuppressionReason',
  ]) {
    if (result?.metadata?.[key] !== undefined) {
      metadata[key] = result.metadata[key]
    }
  }
  if (result?.metadata?.blueprintApplyGate) {
    metadata.blueprintApplyGate = result.metadata.blueprintApplyGate
  }
  if (planningConvergenceLateQuestions.length) {
    metadata.planningConvergenceLateQuestions = planningConvergenceLateQuestions
  }
  for (const key of [
    'blueprintClarificationRequired',
    'blueprintClarificationKind',
    'blockedBlueprintId',
  ]) {
    if (result?.metadata?.[key] !== undefined) {
      metadata[key] = result.metadata[key]
    }
  }
  const toolResultContinuityHints = Array.isArray(options?.continuityHints)
    ? options?.continuityHints.filter(item => item && typeof item === 'object')
    : []
  if (toolResultContinuityHints.length) {
    metadata['continuityHints'] = toolResultContinuityHints
  }
  if (isNocodeEditorHiddenTimelineTool(toolName)) {
    metadata.hiddenFromTimeline = true
  }
  const formulaActions = isFormulaFieldToolName(toolName)
    ? resolveFormulaResultItems(result?.output?.formulaUpdates)
    : []
  const formulaTargetResults = isFormulaFieldToolName(toolName)
    ? resolveFormulaTargetResults(result?.output?.formulaTargetResults)
    : []
  if (formulaActions.length) {
    metadata.formulaActions = formulaActions
  }
  if (formulaTargetResults.length) {
    metadata.formulaTargetResults = formulaTargetResults
  }
  const flowIssueProjection = resolveFlowIssueProjectionForResult(result)
  if (flowIssueProjection) {
    metadata.flowUnifiedIssues = flowIssueProjection.flowUnifiedIssues
    metadata.flowIssueRouting = flowIssueProjection.flowIssueRouting
  }
  if (Object.prototype.hasOwnProperty.call(result?.metadata || {}, 'postFormFlowSignals')) {
    metadata.postFormFlowSignals = result?.metadata?.postFormFlowSignals === null
      ? null
      : normalizeNocodeEditorPostFormFlowSignals(result?.metadata?.postFormFlowSignals)
  } else {
    const postFormFlowSignals = normalizeNocodeEditorPostFormFlowSignals(
      result?.output?.postFormFlowSignals,
    )
    if (postFormFlowSignals) {
      metadata.postFormFlowSignals = postFormFlowSignals
    }
  }
  if (Object.prototype.hasOwnProperty.call(result?.metadata || {}, 'postFormFlowOpportunity')) {
    metadata.postFormFlowOpportunity = result?.metadata?.postFormFlowOpportunity === null
      ? null
      : normalizeNocodeEditorPostFormFlowOpportunity(result?.metadata?.postFormFlowOpportunity)
  } else {
    const postFormFlowOpportunity = normalizeNocodeEditorPostFormFlowOpportunity(
      result?.output?.postFormFlowOpportunity,
    )
    if (postFormFlowOpportunity) {
      metadata.postFormFlowOpportunity = postFormFlowOpportunity
    }
  }
  if (Object.prototype.hasOwnProperty.call(result?.metadata || {}, 'postFormFlowFollowUp')) {
    metadata.postFormFlowFollowUp = result?.metadata?.postFormFlowFollowUp === null
      ? null
      : normalizeNocodeEditorPostFormFlowFollowUp(result?.metadata?.postFormFlowFollowUp)
  } else {
    const postFormFlowFollowUp = normalizeNocodeEditorPostFormFlowFollowUp(
      result?.output?.postFormFlowFollowUp,
    )
    if (postFormFlowFollowUp) {
      metadata.postFormFlowFollowUp = postFormFlowFollowUp
    }
  }
  if (Object.prototype.hasOwnProperty.call(result?.metadata || {}, 'postFormFlowRelease')) {
    metadata.postFormFlowRelease = result?.metadata?.postFormFlowRelease === null
      ? null
      : normalizeNocodeEditorPostFormFlowRelease(result?.metadata?.postFormFlowRelease)
  } else {
    const postFormFlowRelease = normalizeNocodeEditorPostFormFlowRelease(
      result?.output?.postFormFlowRelease,
    )
    if (postFormFlowRelease) {
      metadata.postFormFlowRelease = postFormFlowRelease
    }
  }
  if (blocks.length) {
    metadata.blocks = blocks
  }
  const formulaPlanBlock = blocks.find(block => block.type === 'artifact' && block.kind === 'formula-plan')
  if (formulaPlanBlock?.formulaPresentation) {
    metadata.formulaPlanPresentation = formulaPlanBlock.formulaPresentation
  }
  if (semanticFailure) {
    metadata.error = semanticFailure
  }

  const rawContent = semanticFailure
    ? buildFailureMessage(toolName, semanticFailure, result)
    : buildSuccessMessage(result)
  const content = result?.metadata?.suppressSummaryContent ? '' : rawContent

  if (!content && !blocks.length) {
    return null
  }

  return {
    content,
    metadata,
  }
}

const resolveSemanticFailure = (result: AiActionResult) => {
  if (!result?.ok) {
    return String(
      result?.error || global.i18next.t('nocodeEditorToolResultMessages.toolExecutionFailed'),
    ).trim() || global.i18next.t('nocodeEditorToolResultMessages.toolExecutionFailed')
  }

  const toolName = String(result?.name || '').trim()
  const output = result?.output
  if (toolName === 'editor_create_form' || toolName === 'editor_open_form') {
    if (output?.ok === false) {
      return resolveReasonText(output?.reason)
        || global.i18next.t('nocodeEditorToolResultMessages.executionFailed')
    }
  }

  if (toolName === 'editor_add_fields') {
    const created = Array.isArray(output?.created) ? output.created : []
    const failed = Array.isArray(output?.failed) ? output.failed : []
    if (!created.length && failed.length) {
      return joinFailureMessages(
        failed.map((item) => (
          global.i18next.t('nocodeEditorToolResultMessages.fieldFailureItem', {
            fieldName: resolveFieldLabel(item),
            error: String(
              item?.error || global.i18next.t('nocodeEditorToolResultMessages.creationFailed'),
            ),
          })
        )),
      ) || global.i18next.t('nocodeEditorToolResultMessages.fieldCreationFailed')
    }
  }

  if (toolName === 'editor_set_enum_options') {
    const applied = Array.isArray(output?.applied) ? output.applied : []
    const failed = Array.isArray(output?.failed) ? output.failed : []
    if (!applied.length && failed.length) {
      return joinFailureMessages(
        failed.map((item) => (
          global.i18next.t('nocodeEditorToolResultMessages.fieldFailureItem', {
            fieldName: resolveFieldLabel(item),
            error: resolveReasonText(item?.reason)
              || global.i18next.t('nocodeEditorToolResultMessages.optionUpdateFailed'),
          })
        )),
      ) || global.i18next.t('nocodeEditorToolResultMessages.fieldOptionUpdateFailed')
    }
  }

  return ''
}

const buildFailureMessage = (toolName: string, error: string, result?: AiActionResult) => {
  const gateMode = String(result?.metadata?.blueprintApplyGate?.mode || '').trim()
  const blueprintClarificationKind = resolveBlueprintClarificationKind(result as AiActionResult)
  const planningConvergenceLateQuestions = resolvePlanningConvergenceLateQuestions(result as AiActionResult)
  const normalizedError = String(error || '').trim()
  if (toolName === 'editor_stage_formula_plan') {
    const formulaErrorMessages: Record<string, string> = {
      FORMULA_PLAN_INVALID: global.i18next.t('nocodeEditorToolResultMessages.formulaPlanInvalid'),
      FORMULA_CONTEXT_UNAVAILABLE: global.i18next.t('nocodeEditorToolResultMessages.formulaContextUnavailable'),
      FORMULA_CONTEXT_STALE: global.i18next.t('formulaPlanPresentation.contextStale'),
    }
    if (formulaErrorMessages[normalizedError]) {
      return formulaErrorMessages[normalizedError]
    }
  }
  const isFlowGroundingTool = (
    toolName === 'editor_stage_flow_blueprint'
    || toolName === 'editor_apply_staged_flow'
  )
  const flowGroundingDiagnostics = normalizeFlowGroundingDiagnostics(
    result?.metadata?.flowGroundingDiagnostics,
  )
  const flowGroundingQuestions = normalizeFlowGroundingConfirmationQuestions(
    result?.metadata?.flowGroundingQuestions,
    flowGroundingDiagnostics,
  )
  const hasStructuredFlowGroundingQuestions = flowGroundingQuestions.length > 0
  const hasFlowGroundingConfirmationMetadata = (
    typeof result?.metadata?.flowGroundingUserMessage === 'string'
    || flowGroundingQuestions.length > 0
    || result?.metadata?.flowGroundingReturnToStage === 'flow-scheme'
    || result?.metadata?.requiredNextAction === 'editor_plan_flow_scheme'
    || result?.metadata?.blockedNextAction === 'editor_stage_flow_blueprint'
  )
  const hasRawFlowGroundingDiagnosticError = (
    normalizedError.includes('可回写字段')
    || normalizedError.includes('条件字段')
    || normalizedError.includes('字段取值来源')
    || normalizedError.includes('不能作为审批人')
    || normalizedError.includes('不能作为办理人')
    || normalizedError.includes('writePolicy=')
    || normalizedError.includes('conditionPolicy=')
    || normalizedError.includes('ownerPolicy=')
    || containsTechnicalFlowText(normalizedError)
  )
  const activeFormName = String(result?.metadata?.activeFormName || '').trim()
  const editorMode = String(result?.metadata?.editorMode || '').trim()
  const flowTargetFormName = String(
    (result?.metadata?.flowPlan as Record<string, any> | undefined)?.target?.formName
      || (result?.output as Record<string, any> | undefined)?.flowPlan?.target?.formName
      || '',
  ).trim()
  const navigationTargetFormName = flowTargetFormName || activeFormName
  if (toolName === 'editor_patch_flow') {
    const errorCode = String(result?.metadata?.flowPatchErrorCode || '').trim()
    const messages: Record<string, string> = {
      flow_patch_conflict: global.i18next.t('nocodeEditorToolResultMessages.flowPatchConflict'),
      flow_patch_reference_blocked: global.i18next.t('nocodeEditorToolResultMessages.flowPatchReferenceBlocked'),
      flow_patch_validation_failed: global.i18next.t('nocodeEditorToolResultMessages.flowPatchValidationFailed'),
      requires_full_rebuild: global.i18next.t('nocodeEditorToolResultMessages.flowPatchRequiresFullRebuild'),
    }
    if (messages[errorCode]) {
      return messages[errorCode]
    }
  }
  if (
    toolName === 'editor_stage_app_blueprint'
    && result?.metadata?.executor === 'server-guard'
    && result?.metadata?.blueprintClarificationRequired
  ) {
    if (blueprintClarificationKind === 'planning-question' && planningConvergenceLateQuestions.length > 0) {
      return [
        global.i18next.t('nocodeEditorToolResultMessages.blueprintQuestionsPending'),
        ...planningConvergenceLateQuestions.map((question, index) => `${index + 1}. ${question}`),
      ].join('\n')
    }
    if (blueprintClarificationKind === 'explicit-confirmation') {
      return global.i18next.t('nocodeEditorToolResultMessages.blueprintExplicitConfirmationRequired')
    }
    return global.i18next.t('nocodeEditorToolResultMessages.blueprintClarificationRequired')
  }
  if (
    toolName === 'editor_apply_staged_app_blueprint'
    && result?.metadata?.executor === 'server-guard'
    && gateMode === 'require_explicit_confirmation'
  ) {
    return global.i18next.t('nocodeEditorToolResultMessages.blueprintApplyConfirmationRequired')
  }
  if (
    toolName === 'editor_get_flow_summary'
    && normalizedError === global.i18next.t('nocodeEditorToolResultMessages.formEditorNotOpen')
  ) {
    if (navigationTargetFormName) {
      return global.i18next.t('nocodeEditorToolResultMessages.openTargetFormBeforeReadingFlow', {
        formName: navigationTargetFormName,
      })
    }
    if (editorMode && editorMode !== 'form-design' && editorMode !== 'process-setting') {
      return global.i18next.t('nocodeEditorToolResultMessages.openFormBeforeReadingFlow')
    }
    return global.i18next.t('nocodeEditorToolResultMessages.switchToFormBeforeReadingFlow')
  }
  if (
    isFlowGroundingTool
    && (hasFlowGroundingConfirmationMetadata || hasRawFlowGroundingDiagnosticError)
  ) {
    const businessMessage = normalizeFlowGroundingUserMessage(result?.metadata?.flowGroundingUserMessage)
    if (planningConvergenceLateQuestions.length > 0) {
      if (hasStructuredFlowGroundingQuestions) {
        return [
          businessMessage,
          global.i18next.t('nocodeEditorToolResultMessages.flowPlanQuestionsReturnedForConfirmation', {
            count: planningConvergenceLateQuestions.length,
          }),
        ].join('\n')
      }
      return [
        businessMessage,
        global.i18next.t('nocodeEditorToolResultMessages.flowPlanQuestionsReturnedForConfirmation', {
          count: planningConvergenceLateQuestions.length,
        }),
        ...planningConvergenceLateQuestions.map((question, index) => `${index + 1}. ${question}`),
      ].join('\n')
    }
    return businessMessage
  }

  const prefixMap: Record<string, string> = {
    editor_get_host_context: global.i18next.t('nocodeEditorToolResultMessages.readEditorStateFailed'),
    editor_open_form: global.i18next.t('nocodeEditorToolResultMessages.openFormFailed'),
    editor_get_current_task_context: global.i18next.t('nocodeEditorToolResultMessages.readTaskContextFailed'),
    editor_stage_app_plan: global.i18next.t('nocodeEditorToolResultMessages.stageAppPlanFailed'),
    editor_get_staged_app_plan: global.i18next.t('nocodeEditorToolResultMessages.readAppPlanFailed'),
    editor_clear_staged_app_plan: global.i18next.t('nocodeEditorToolResultMessages.clearAppPlanFailed'),
    editor_stage_single_form_plan: global.i18next.t('nocodeEditorToolResultMessages.stageFormPlanFailed'),
    editor_stage_content_plan: global.i18next.t('nocodeEditorToolResultMessages.stageContentPlanFailed'),
    editor_stage_formula_plan: global.i18next.t('nocodeEditorToolResultMessages.stageFormulaPlanFailed'),
    editor_get_flow_summary: global.i18next.t('nocodeEditorToolResultMessages.readFlowSummaryFailed'),
    editor_get_flow_node_examples: global.i18next.t('nocodeEditorToolResultMessages.readFlowNodeExamplesFailed'),
    editor_plan_flow_scheme: global.i18next.t('nocodeEditorToolResultMessages.stageFlowSchemeFailed'),
    editor_stage_flow_blueprint: global.i18next.t('nocodeEditorToolResultMessages.stageFlowBlueprintFailed'),
    editor_apply_staged_flow: global.i18next.t('nocodeEditorToolResultMessages.applyFlowFailed'),
    editor_patch_flow: global.i18next.t('nocodeEditorToolResultMessages.patchFlowFailed'),
    editor_create_form: global.i18next.t('nocodeEditorToolResultMessages.createFormFailed'),
    editor_stage_app_blueprint: global.i18next.t('nocodeEditorToolResultMessages.stageBlueprintFailed'),
    editor_get_staged_app_blueprint: global.i18next.t('nocodeEditorToolResultMessages.readBlueprintFailed'),
    editor_clear_staged_app_blueprint: global.i18next.t('nocodeEditorToolResultMessages.clearBlueprintFailed'),
    editor_apply_staged_app_blueprint: global.i18next.t('nocodeEditorToolResultMessages.generateFromBlueprintFailed'),
    editor_get_form_summary: global.i18next.t('nocodeEditorToolResultMessages.readFormSummaryFailed'),
    editor_get_relation_context: global.i18next.t('nocodeEditorToolResultMessages.readRelationContextFailed'),
    editor_get_targeted_form_summaries: global.i18next.t('nocodeEditorToolResultMessages.readTargetFormSummariesFailed'),
    editor_get_all_form_summaries: global.i18next.t('nocodeEditorToolResultMessages.readAppFormSummariesFailed'),
    editor_get_widget_option_schema: global.i18next.t('nocodeEditorToolResultMessages.readFieldSettingsFailed'),
    editor_get_widget_option_choices: global.i18next.t('nocodeEditorToolResultMessages.readFieldChoicesFailed'),
    editor_add_fields: global.i18next.t('nocodeEditorToolResultMessages.addFieldsFailed'),
    editor_delete_field: global.i18next.t('nocodeEditorToolResultMessages.deleteFieldFailed'),
    editor_replace_field: global.i18next.t('nocodeEditorToolResultMessages.replaceFieldFailed'),
    editor_bind_field_source: global.i18next.t('nocodeEditorToolResultMessages.bindFieldSourceFailed'),
    editor_set_field_formulas: global.i18next.t('nocodeEditorToolResultMessages.updateFieldFormulaFailed'),
    editor_set_field_options: global.i18next.t('nocodeEditorToolResultMessages.updateFieldSettingsFailed'),
    editor_set_enum_options: global.i18next.t('nocodeEditorToolResultMessages.updateFieldOptionsFailed'),
  }
  const prefix = prefixMap[toolName]
    || global.i18next.t('nocodeEditorToolResultMessages.toolExecutionFailed')
  return global.i18next.t('nocodeEditorToolResultMessages.failureWithReason', { prefix, error })
}

const buildSuccessMessage = (result: AiActionResult) => {
  const toolName = String(result?.name || '').trim()
  const output = result?.output || {}

  if (toolName === 'editor_patch_flow') {
    const block = buildFlowPatchResultBlockForResult(result)
    if (!block) {
      return global.i18next.t('nocodeEditorToolResultMessages.flowPatchCompleted')
    }
    const operationLines = buildAiAssistantFlowPatchResultOperationLines(block.operations)
    return [
      global.i18next.t('nocodeEditorToolResultMessages.flowDraftUpdated', { version: block.draftVersion }),
      ...operationLines,
      block.activeVersionUnchanged && block.activeVersion
        ? global.i18next.t('nocodeEditorToolResultMessages.activeFlowVersionUnchanged', { version: block.activeVersion })
        : global.i18next.t('nocodeEditorToolResultMessages.flowDraftNotActivated'),
    ].join('\n')
  }

  if (toolName === 'editor_stage_formula_plan') {
    const plan = normalizeNocodeEditorFormulaPlan(output?.plan)
    const title = String(plan?.title || '').trim()
    return title
      ? global.i18next.t('nocodeEditorToolResultMessages.namedFormulaPlanStaged', { title })
      : global.i18next.t('formulaPlanPresentation.title')
  }

  if (toolName === 'editor_get_host_context') {
    return buildHostContextMessage(output)
  }

  if (toolName === 'editor_open_form') {
    const formName = String(output?.tableName || '').trim()
    const targetTab = String(result?.metadata?.input?.tab || '').trim()
    if (targetTab === 'process-setting' && formName) {
      return global.i18next.t('nocodeEditorToolResultMessages.flowSettingsOpened', { formName })
    }
    return formName
      ? global.i18next.t('nocodeEditorToolResultMessages.formOpened', { formName })
      : global.i18next.t('nocodeEditorToolResultMessages.targetFormOpened')
  }

  if (toolName === 'editor_get_current_task_context') {
    const targetName = String(output?.widgetTitle || output?.widgetId || '').trim()
    return targetName
      ? global.i18next.t('nocodeEditorToolResultMessages.formulaTaskContextRefreshed', { targetName })
      : global.i18next.t('nocodeEditorToolResultMessages.taskContextRefreshed')
  }

  if (toolName === 'editor_stage_app_plan') {
    const plan = output?.plan || {}
    const revision = Number(output?.revision || 0)
    const goal = String(plan?.goal || '').trim()
    const objects = Array.isArray(plan?.objects) ? plan.objects : []
    const artifacts = Array.isArray(plan?.artifacts) ? plan.artifacts : []
    const openQuestions = Array.isArray(plan?.openQuestions) ? plan.openQuestions : []
    const scope = [
      objects.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.coreObjectCount', { count: objects.length })
        : '',
      artifacts.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.plannedArtifactCount', { count: artifacts.length })
        : '',
      openQuestions.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.pendingQuestionCount', { count: openQuestions.length })
        : '',
    ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
    const title = goal
      ? global.i18next.t('nocodeEditorToolResultMessages.namedAppPlan', { goal })
      : global.i18next.t('nocodeEditorToolResultMessages.appPlan')
    return [
      global.i18next.t('nocodeEditorToolResultMessages.artifactStaged', {
        title,
        version: revision > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
            version: formatBusinessVersionLabel(
              revision,
              global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
            ),
          })
          : '',
        scope: scope
          ? global.i18next.t('nocodeEditorToolResultMessages.scopeSuffix', { scope })
          : '',
      }),
      global.i18next.t('nocodeEditorToolResultMessages.appPlanNotAppliedNotice'),
      openQuestions.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.waitForAppPlanConfirmation')
        : global.i18next.t('nocodeEditorToolResultMessages.createBlueprintNext'),
    ].join('\n')
  }

  if (toolName === 'editor_stage_solution_outline') {
    const outline = output?.outline || {}
    const revision = Number(output?.revision || 0)
    const title = resolveSolutionPlanningDisplayTitle({
      title: outline?.title,
      modules: outline?.modules,
    })
    const forms = Array.isArray(outline?.forms) ? outline.forms : []
    const modules = Array.isArray(outline?.modules) ? outline.modules : []
    const openQuestions = Array.isArray(outline?.openQuestions) ? outline.openQuestions : []
    const scope = [
      modules.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.moduleCount', { count: modules.length })
        : '',
      forms.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.formCount', { count: forms.length })
        : '',
      openQuestions.length > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.pendingQuestionCount', { count: openQuestions.length })
        : '',
    ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
    return [
      global.i18next.t('nocodeEditorToolResultMessages.artifactStaged', {
        title,
        version: revision > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
            version: formatBusinessVersionLabel(
              revision,
              global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
            ),
          })
          : '',
        scope: scope
          ? global.i18next.t('nocodeEditorToolResultMessages.scopeSuffix', { scope })
          : '',
      }),
      global.i18next.t('nocodeEditorToolResultMessages.solutionPlanNotAppliedNotice'),
    ].join('\n')
  }

  if (toolName === 'editor_stage_single_form_plan') {
    const outline = output?.outline
    const formPlanLeadText = shouldRenderFormPlanSummary(result)
      ? buildNocodeEditorFormPlanLeadText({
        outline,
        solutionPresentation: toRecord(result?.metadata?.formPlanPresentation),
      })
      : ''
    if (formPlanLeadText) {
      return formPlanLeadText
    }
    const formPlanPresentation = toRecord(result?.metadata?.formPlanPresentation)
    const formCount = Number(
      formPlanPresentation.formCount
      || (Array.isArray(outline?.forms) ? outline.forms.length : 0),
    )
    const moduleCount = Number(
      formPlanPresentation.moduleCount
      || (Array.isArray(outline?.modules) ? outline.modules.length : 0),
    )
    const planningItemCount = Number(formPlanPresentation.planningItemCount || 0)
    const revision = Number(output?.revision || 0)
    const title = String(outline?.title || '').trim()
    const scope = [
      planningItemCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.planningItemCount', { count: planningItemCount })
        : '',
      moduleCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.moduleCount', { count: moduleCount })
        : '',
      formCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.formCount', { count: formCount })
        : '',
    ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
    const formPlanTitle = title
      ? global.i18next.t('nocodeEditorToolResultMessages.namedFormPlan', { title })
      : global.i18next.t('nocodeEditorToolResultMessages.formPlan')
    return [
      global.i18next.t('nocodeEditorToolResultMessages.artifactStaged', {
        title: formPlanTitle,
        version: revision > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
            version: formatBusinessVersionLabel(
              revision,
              global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
            ),
          })
          : '',
        scope: scope
          ? global.i18next.t('nocodeEditorToolResultMessages.scopeSuffix', { scope })
          : '',
      }),
      global.i18next.t('nocodeEditorToolResultMessages.reviewGeneratedPages'),
      global.i18next.t('nocodeEditorToolResultMessages.waitForBlueprintConfirmation'),
      global.i18next.t('nocodeEditorToolResultMessages.formPlanNotAppliedNotice'),
    ].join('\n')
  }

  if (toolName === 'editor_stage_content_plan') {
    const plan = resolveContentPlanFromToolResult(result)
    return plan
      ? global.i18next.t('nocodeEditorToolResultMessages.namedContentPlanStaged', { title: plan.title })
      : global.i18next.t('nocodeEditorToolResultMessages.contentPlanStaged')
  }

  const preflightPhase = String((result.metadata?.flowBlueprintPreflight as any)?.phase || '').trim()

  if (toolName === 'editor_get_flow_summary') {
    const tableName = String(output?.forms?.currentForm?.tableName || '').trim()
    const triggerBranchCount = Number(output?.forms?.currentForm?.currentFlow?.triggerBranchCount || 0)
    const totalNodeCount = Number(output?.forms?.currentForm?.currentFlow?.totalNodeCount || 0)
    const availableNodeTypeCount = Array.isArray(output?.availableFlowNodes?.nodeTypes) ? output.availableFlowNodes.nodeTypes.length : 0
    const otherForms = Array.isArray(output?.forms?.availableForms) ? output.forms.availableForms.length : 0
    const organizationUserCount = Array.isArray(output?.organization?.users) ? output.organization.users.length : 0
    const leadLine = preflightPhase === 'summary'
      ? global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintPreflightSummaryRead')
      : (tableName
        ? global.i18next.t('nocodeEditorToolResultMessages.namedFlowSummaryRead', { tableName })
        : global.i18next.t('nocodeEditorToolResultMessages.currentFlowSummaryRead'))
    return [
      leadLine,
      triggerBranchCount > 0 || totalNodeCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.flowStructureSummary', {
          triggerBranchCount,
          totalNodeCount,
        })
        : global.i18next.t('nocodeEditorToolResultMessages.flowDraftEmpty'),
      organizationUserCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.organizationContextReady', {
          count: organizationUserCount,
        })
        : '',
      availableNodeTypeCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.flowNodeCatalogReady', {
          count: availableNodeTypeCount,
        })
        : '',
      otherForms > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.relatedFormSummariesReady', {
          count: otherForms,
        })
        : '',
    ].filter(Boolean).join('\n')
  }

  if (toolName === 'editor_get_flow_node_examples') {
    const requestedNodeTypes = Array.isArray(output?.requestedNodeTypes) ? output.requestedNodeTypes : []
    const examples = Array.isArray(output?.examples) ? output.examples : []
    const missingNodeTypes = Array.isArray(output?.missingNodeTypes) ? output.missingNodeTypes : []
    const hasConditionOperatorGuide = Boolean(output?.conditionOperatorGuide)
    const leadLine = preflightPhase === 'examples'
      ? global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintPreflightExamplesRead', {
        requested: requestedNodeTypes.length,
        matched: examples.length,
      })
      : global.i18next.t('nocodeEditorToolResultMessages.flowNodeExamplesRead', {
        requested: requestedNodeTypes.length,
        matched: examples.length,
      })
    return [
      leadLine,
      missingNodeTypes.length
        ? global.i18next.t('nocodeEditorToolResultMessages.flowNodeTypesMissing', {
          types: formatPreviewList(missingNodeTypes.map(item => String(item || '').trim()), 12),
        })
        : '',
      hasConditionOperatorGuide
        ? global.i18next.t('nocodeEditorToolResultMessages.conditionOperatorGuideIncluded')
        : '',
    ].filter(Boolean).join('\n')
  }

  if (toolName === 'editor_plan_flow_scheme') {
    const scheme = normalizeNocodeEditorFlowScheme(output?.scheme)
    const revision = Number(output?.revision || 0)
    const questionCount = Array.isArray(scheme?.openQuestions) ? scheme.openQuestions.length : 0
    const stepCount = Array.isArray(scheme?.mainPath) ? scheme.mainPath.length : 0
    const title = scheme?.title
      ? global.i18next.t('nocodeEditorToolResultMessages.namedFlowScheme', { title: scheme.title })
      : global.i18next.t('nocodeEditorToolResultMessages.flowScheme')
    return [
      global.i18next.t('nocodeEditorToolResultMessages.flowSchemeStagedSummary', {
        title,
        version: revision > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
            version: formatBusinessVersionLabel(
              revision,
              global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
            ),
          })
          : '',
        steps: stepCount > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.mainPathStepsSuffix', { count: stepCount })
          : '',
      }),
      questionCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.pendingQuestionsRemain', { count: questionCount })
        : global.i18next.t('nocodeEditorToolResultMessages.flowSchemeReadyForBlueprint'),
    ].join('\n')
  }

  if (toolName === 'editor_stage_flow_blueprint') {
    const bundle = resolveFlowPlanBundleFromToolResult(result)
    const plan = bundle?.flowPlan || null
    const revision = Number(output?.revision || 0)
    const triggerBranchCount = Array.isArray(plan?.triggerBranches) ? plan!.triggerBranches.length : 0
    const title = plan?.title
      ? global.i18next.t('nocodeEditorToolResultMessages.namedFlowBlueprint', { title: plan.title })
      : global.i18next.t('nocodeEditorToolResultMessages.flowBlueprint')
    const leadLine = global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintStagedSummary', {
      title,
      version: revision > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
          version: formatBusinessVersionLabel(
            revision,
            global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
          ),
        })
        : '',
      branches: triggerBranchCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.triggerBranchesSuffix', {
          count: triggerBranchCount,
        })
        : '',
    })
    const pendingQuestions = resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(plan)
    if (pendingQuestions.length > 0) {
      return [
        leadLine,
        global.i18next.t('nocodeEditorToolResultMessages.flowPlanPendingQuestionsRemain', {
          count: pendingQuestions.length,
        }),
        global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintWaitingForPlanConfirmation'),
      ].join('\n')
    }
    const validationWaitText = resolveFlowPlanValidationWaitText(bundle?.rawPlan)
    if (validationWaitText) {
      return [
        leadLine,
        validationWaitText,
        global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintWaitingForValidation'),
      ].join('\n')
    }
    return [
      leadLine,
      global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintNotAppliedNotice'),
      global.i18next.t('nocodeEditorToolResultMessages.flowBlueprintApplyInstruction'),
    ].join('\n')
  }

  if (toolName === 'editor_apply_staged_flow') {
    const summary = toRecord(output?.summary)
    const triggerBranchCount = Number(summary.triggerBranchCount || 0)
    const totalNodeCount = Number(summary.totalNodeCount || 0)
    const branchCount = Number(summary.branchCount || 0)
    const warningCount = Array.isArray(output?.warnings) ? output.warnings.length : 0
    return [
      global.i18next.t('nocodeEditorToolResultMessages.flowAppliedSummary', {
        triggerBranchCount,
        totalNodeCount,
        branchCount,
        warnings: warningCount > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.warningCountSuffix', { count: warningCount })
          : '',
      }),
      global.i18next.t('nocodeEditorToolResultMessages.flowNotPublishedNotice'),
    ].join('\n')
  }

  if (toolName === 'editor_get_staged_app_plan') {
    const plan = output?.plan
    return plan?.goal
      ? global.i18next.t('nocodeEditorToolResultMessages.currentNamedAppPlan', {
        goal: String(plan.goal).trim(),
      })
      : global.i18next.t('nocodeEditorToolResultMessages.noStagedAppPlan')
  }

  if (toolName === 'editor_clear_staged_app_plan') {
    return global.i18next.t('nocodeEditorToolResultMessages.blueprintClarificationRequired')
  }

  if (toolName === 'editor_create_form') {
    const formName = String(output?.tableName || '').trim()
    if (output?.reusedExisting) {
      return formName
        ? global.i18next.t('nocodeEditorToolResultMessages.namedFormReused', { formName })
        : global.i18next.t('nocodeEditorToolResultMessages.formReused')
    }
    return formName
      ? global.i18next.t('nocodeEditorToolResultMessages.namedFormCreated', { formName })
      : global.i18next.t('nocodeEditorToolResultMessages.formCreated')
  }

  if (toolName === 'editor_stage_app_blueprint') {
    const blueprint = output?.blueprint
    const formCount = Array.isArray(blueprint?.forms) ? blueprint.forms.length : 0
    const fieldCount = countBlueprintFields(blueprint?.forms)
    const revision = Number(output?.revision || 0)
    const title = resolveNocodeEditorBlueprintDisplayTitle({
      title: blueprint?.title,
      forms: blueprint?.forms,
      fallback: global.i18next.t('nocodeEditorToolResultMessages.blueprint'),
    })
    const gateMode = String(result?.metadata?.blueprintApplyGate?.mode || '').trim()
    const planningConvergenceLateQuestions = resolvePlanningConvergenceLateQuestions(result)
    const scope = [
      formCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.formCount', { count: formCount })
        : '',
      fieldCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.fieldCount', { count: fieldCount })
        : '',
    ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
    const openQuestionCount = Array.isArray(blueprint?.openQuestions)
      ? blueprint.openQuestions.filter((item: unknown) => String(item || '').trim()).length
      : 0
    if (planningConvergenceLateQuestions.length > 0) {
      return [
        global.i18next.t('nocodeEditorToolResultMessages.artifactStaged', {
          title: title
            ? global.i18next.t('nocodeEditorToolResultMessages.namedBlueprint', { title })
            : global.i18next.t('nocodeEditorToolResultMessages.blueprint'),
          version: revision > 0
            ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
              version: formatBusinessVersionLabel(
                revision,
                global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
              ),
            })
            : '',
          scope: scope
            ? global.i18next.t('nocodeEditorToolResultMessages.scopeSuffix', { scope })
            : '',
        }),
        global.i18next.t('nocodeEditorToolResultMessages.planConclusionPreserved'),
        global.i18next.t('nocodeEditorToolResultMessages.lateBlueprintQuestionsFound', {
          count: planningConvergenceLateQuestions.length,
        }),
        global.i18next.t('nocodeEditorToolResultMessages.waitForBlueprintConfirmation'),
      ].join('\n')
    }
    const nextStepLine = openQuestionCount > 0
      ? (
        gateMode === 'require_explicit_confirmation'
          ? global.i18next.t('nocodeEditorToolResultMessages.blueprintQuestionsWithApplyGate', {
            count: openQuestionCount,
          })
          : global.i18next.t('nocodeEditorToolResultMessages.blueprintQuestionsWithoutApplyGate', {
            count: openQuestionCount,
          })
      )
      : gateMode === 'require_explicit_confirmation'
        ? global.i18next.t('nocodeEditorToolResultMessages.blueprintStagedWithApplyGate')
        : global.i18next.t('nocodeEditorToolResultMessages.reviewBlueprintBeforeApply')
    return [
      global.i18next.t('nocodeEditorToolResultMessages.artifactStaged', {
        title: title
          ? global.i18next.t('nocodeEditorToolResultMessages.namedBlueprint', { title })
          : global.i18next.t('nocodeEditorToolResultMessages.blueprint'),
        version: revision > 0
          ? global.i18next.t('nocodeEditorToolResultMessages.currentVersionSuffix', {
            version: formatBusinessVersionLabel(
              revision,
              global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
            ),
          })
          : '',
        scope: scope
          ? global.i18next.t('nocodeEditorToolResultMessages.scopeSuffix', { scope })
          : '',
      }),
      global.i18next.t('nocodeEditorToolResultMessages.blueprintNotAppliedNotice'),
      nextStepLine,
    ].join('\n')
  }

  if (toolName === 'editor_get_staged_app_blueprint') {
    return buildStagedAppBlueprintMessage(output)
  }

  if (toolName === 'editor_clear_staged_app_blueprint') {
    return global.i18next.t('nocodeEditorToolResultMessages.blueprintCleared')
  }

  if (toolName === 'editor_apply_staged_app_blueprint') {
    const summary = output?.summary || {}
    const warningCount = Array.isArray(output?.warnings) ? output.warnings.length : 0
    const followUpLines = buildNocodeEditorPostFormFlowInlineMessageLines(
      result?.metadata?.postFormFlowFollowUp || result?.output?.postFormFlowFollowUp,
    )
    const base = global.i18next.t('nocodeEditorToolResultMessages.blueprintAppliedSummary', {
      formsCreated: Number(summary.formsCreated || 0),
      formsReused: Number(summary.formsReused || 0),
      fieldsCreated: Number(summary.fieldsCreated || 0),
      fieldsReused: Number(summary.fieldsReused || 0),
      fieldsUpdated: Number(summary.fieldsUpdated || 0),
    })
    return [
      warningCount > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.summaryWithWarnings', {
          summary: base,
          count: warningCount,
        })
        : base,
      global.i18next.t('nocodeEditorToolResultMessages.blueprintApplyScopeNotice'),
      global.i18next.t('nocodeEditorToolResultMessages.reviewGeneratedPages'),
      ...followUpLines,
    ].join('\n')
  }

  if (toolName === 'editor_get_form_summary') {
    return buildFormSummaryMessage(output)
  }

  if (toolName === 'editor_get_relation_context') {
    const analysis = toRecord(output?.analysis)
    const signalLevel = String(analysis?.signalLevel || 'none').trim() || 'none'
    const candidateTargets = Array.isArray(analysis?.candidateTargets) ? analysis.candidateTargets : []
    const candidateNames = candidateTargets
      .map(item => String((item as Record<string, unknown>)?.tableName || '').trim())
      .filter(Boolean)
    const openQuestions = Array.isArray(analysis?.openQuestions)
      ? analysis.openQuestions.map(item => String(item || '').trim()).filter(Boolean)
      : []

    if (signalLevel === 'strong') {
      return global.i18next.t('nocodeEditorToolResultMessages.strongRelationContextFound', {
        forms: formatPreviewList(candidateNames, 3)
          || global.i18next.t('nocodeEditorToolResultMessages.relatedForms'),
      })
    }

    if (signalLevel === 'weak') {
      return openQuestions.length
        ? global.i18next.t('nocodeEditorToolResultMessages.weakRelationContextWithQuestions')
        : global.i18next.t('nocodeEditorToolResultMessages.weakRelationContext')
    }

    return global.i18next.t('nocodeEditorToolResultMessages.noRequiredRelationContext')
  }

  if (toolName === 'editor_get_targeted_form_summaries') {
    const forms = Array.isArray(output?.forms) ? output.forms : []
    const readableCount = forms.filter(item => !item?.error).length
    return global.i18next.t('nocodeEditorToolResultMessages.targetedFormSummariesRead', {
      count: readableCount,
    })
  }

  if (toolName === 'editor_get_all_form_summaries') {
    return buildAllFormSummariesMessage(result)
  }

  if (toolName === 'editor_get_widget_option_schema') {
    return buildWidgetOptionSchemaMessage(result)
  }

  if (toolName === 'editor_get_widget_option_choices') {
    return buildWidgetOptionChoicesMessage(result)
  }

  if (toolName === 'editor_add_fields') {
    const created = Array.isArray(output?.created) ? output.created : []
    const failed = Array.isArray(output?.failed) ? output.failed : []
    const createdNames = created
      .map((item) => String(item?.name || '').trim())
      .filter(Boolean)
    if (createdNames.length === 1 && !failed.length) {
      return global.i18next.t('nocodeEditorToolResultMessages.fieldAdded', {
        fieldName: createdNames[0],
      })
    }
    if (createdNames.length > 0) {
      return global.i18next.t('nocodeEditorToolResultMessages.fieldsAdded', {
        count: createdNames.length,
        fieldNames: createdNames.join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator')),
        failures: failed.length
          ? global.i18next.t('nocodeEditorToolResultMessages.fieldCreationFailureSuffix', {
            count: failed.length,
          })
          : '',
      })
    }
    return global.i18next.t('nocodeEditorToolResultMessages.addFieldsRequestCompleted')
  }

  if (toolName === 'editor_delete_field') {
    const fieldName = String(output?.name || '').trim()
    return fieldName
      ? global.i18next.t('nocodeEditorToolResultMessages.fieldDeleted', { fieldName })
      : global.i18next.t('nocodeEditorToolResultMessages.deleteFieldRequestCompleted')
  }

  if (toolName === 'editor_replace_field') {
    const fieldName = String(output?.name || '').trim()
    const widgetType = String(output?.widgetType || '').trim()
    const widgetTypeLabel = formatWidgetTypeDisplay(widgetType)
    if (output?.replaced === false) {
      return fieldName
        ? global.i18next.t('nocodeEditorToolResultMessages.namedFieldTypeUnchanged', { fieldName })
        : global.i18next.t('nocodeEditorToolResultMessages.fieldTypeUnchanged')
    }
    return fieldName && widgetTypeLabel
      ? global.i18next.t('nocodeEditorToolResultMessages.fieldTypeReplaced', {
        fieldName,
        widgetType: widgetTypeLabel,
      })
      : global.i18next.t('nocodeEditorToolResultMessages.fieldTypeUpdated')
  }
  if (toolName === 'editor_bind_field_source') {
    const formName = String(output?.formName || '').trim()
    const fieldName = String(output?.fieldName || '').trim()
    const message = formName && fieldName
      ? global.i18next.t('nocodeEditorToolResultMessages.fieldSourceBound', { formName, fieldName })
      : global.i18next.t('nocodeEditorToolResultMessages.fieldSourceBoundDefault')
    return appendDraftRefreshStatus(message, output)
  }

  if (isFormulaFieldToolName(toolName)) {
    const applied = Array.isArray(output?.applied) ? output.applied : []
    const fieldName = resolveFieldLabel(output)
    const formulaTargetResults = resolveFormulaTargetResults(output?.formulaTargetResults)
    if (formulaTargetResults.length) {
      return buildFormulaTargetResultContent(formulaTargetResults)
    }
    const formulaUpdates = resolveFormulaResultItems(output?.formulaUpdates)
    if (formulaUpdates.length) {
      return buildFormulaResultContent(formulaUpdates)
    }
    if (!applied.length) {
      const message = fieldName
        ? global.i18next.t('nocodeEditorToolResultMessages.namedFieldSettingsUnchanged', { fieldName })
        : global.i18next.t('nocodeEditorToolResultMessages.fieldSettingsUnchanged')
      return appendDraftRefreshStatus(message, output)
    }
    let message = ''
    if (hasFormulaFieldOptionApplied(applied)) {
      message = fieldName
        ? global.i18next.t('nocodeEditorToolResultMessages.namedFieldFormulaUpdated', { fieldName })
        : global.i18next.t('nocodeEditorToolResultMessages.fieldFormulaUpdated')
    } else {
      message = fieldName
        ? global.i18next.t('nocodeEditorToolResultMessages.namedFieldSettingsUpdated', { fieldName })
        : global.i18next.t('nocodeEditorToolResultMessages.fieldSettingsUpdated', {
          count: applied.length,
        })
    }
    return appendDraftRefreshStatus(message, output)
  }

  if (toolName === 'editor_set_enum_options') {
    const applied = Array.isArray(output?.applied) ? output.applied : []
    const failed = Array.isArray(output?.failed) ? output.failed : []
    const updatedCount = applied.filter(item => !item?.skipped).length
    const skippedCount = applied.filter(item => item?.skipped).length
    const parts: string[] = []
    parts.push(global.i18next.t('nocodeEditorToolResultMessages.enumFieldsProcessed', {
      count: applied.length,
    }))
    if (updatedCount > 0) {
      parts.push(global.i18next.t('nocodeEditorToolResultMessages.enumFieldsUpdated', {
        count: updatedCount,
      }))
    }
    if (skippedCount > 0) {
      parts.push(global.i18next.t('nocodeEditorToolResultMessages.enumFieldsUnchanged', {
        count: skippedCount,
      }))
    }
    return global.i18next.t('nocodeEditorToolResultMessages.enumFieldsUpdateSummary', {
      summary: parts.join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator')),
      failures: failed.length
        ? global.i18next.t('nocodeEditorToolResultMessages.fieldUpdateFailureSuffix', {
          count: failed.length,
        })
        : '',
    })
  }

  return ''
}

const resolveContentPlanFromToolResult = (result: AiActionResult) => (
  String(result?.name || '').trim() === 'editor_stage_content_plan'
    ? normalizeNocodeEditorContentPlan(result?.output?.plan)
    : null
)

const resolveFlowPlanFromToolResult = (result: AiActionResult) => {
  return resolveFlowPlanBundleFromToolResult(result)?.flowPlan || null
}

const buildHostContextMessage = (input: unknown) => {
  const output: UnknownRecord & { dirty: UnknownRecord } = {
    ...toRecord(input),
    dirty: toRecord(toRecord(input).dirty),
  }

  const mode = String(output?.mode || 'idle').trim() || 'idle'
  const activeFormName = String(output?.activeFormName || '').trim()
  const forms = Array.isArray(output?.availableForms) ? output.availableForms : []
  const formNames = forms
    .map(item => String(item?.name || '').trim())
    .filter(Boolean)
  const dirtyFlags = [
    output?.dirty?.form
      ? global.i18next.t('nocodeEditorToolResultMessages.formHasUnsavedChanges')
      : '',
    output?.dirty?.page
      ? global.i18next.t('nocodeEditorToolResultMessages.pageHasUnsavedChanges')
      : '',
    output?.dirty?.aiDraft
      ? global.i18next.t('nocodeEditorToolResultMessages.aiDraftHasUnsavedChanges')
      : '',
  ].filter(Boolean)

  return [
    global.i18next.t('nocodeEditorToolResultMessages.editorStateRead', {
      mode,
      activeForm: activeFormName
        ? global.i18next.t('nocodeEditorToolResultMessages.activeFormSuffix', { formName: activeFormName })
        : '',
    }),
    formNames.length
      ? global.i18next.t('nocodeEditorToolResultMessages.availableForms', {
        forms: formatPreviewList(formNames, 12),
      })
      : global.i18next.t('nocodeEditorToolResultMessages.noAvailableForms'),
    dirtyFlags.length
      ? global.i18next.t('nocodeEditorToolResultMessages.unsavedState', {
        states: dirtyFlags.join(global.i18next.t('nocodeEditorToolResultMessages.sectionSeparator')),
      })
      : global.i18next.t('nocodeEditorToolResultMessages.noUnsavedChanges'),
    global.i18next.t('nocodeEditorToolResultMessages.readOnlyResultNotice'),
  ].filter(Boolean).join('\n')
}

const buildStagedAppBlueprintMessage = (input: unknown) => {
  const output = toRecord(input)
  const blueprint = isRecord(output?.blueprint) ? output.blueprint : null
  const revision = Number(output?.revision || 0)
  const phase = String(output?.phase || '').trim()
  const detail = String(output?.detail || '').trim()
  const counts = toRecord(output?.counts)
  const blueprintRef = toRecord(output?.blueprintRef)
  const titleFromStatus = String(output?.title || blueprintRef?.title || '').trim()
  const summaryFromStatus = String(output?.summary || '').trim()
  const hasBlueprintStatus = Boolean(
    titleFromStatus
    || output?.blueprintRef
    || Number(counts?.formCount || 0) > 0
    || Number(counts?.fieldCount || 0) > 0
    || output?.applyResult
    || output?.draftPersistenceState
  )
  if (!blueprint) {
    if (hasBlueprintStatus) {
      const applySummary = toRecord(toRecord(output?.applyResult).summary)
      const applyLine = Object.keys(applySummary).length
        ? global.i18next.t('nocodeEditorToolResultMessages.latestBlueprintApplySummary', {
          formsCreated: Number(applySummary.formsCreated || 0),
          formsReused: Number(applySummary.formsReused || 0),
          fieldsCreated: Number(applySummary.fieldsCreated || 0),
          fieldsReused: Number(applySummary.fieldsReused || 0),
          fieldsUpdated: Number(applySummary.fieldsUpdated || 0),
        })
        : ''
      const draftState = toRecord(output?.draftPersistenceState)
      return [
        global.i18next.t('nocodeEditorToolResultMessages.blueprintStatusRead', {
          title: titleFromStatus || global.i18next.t('nocodeEditorToolResultMessages.unnamedBlueprint'),
          version: revision > 0
            ? global.i18next.t('nocodeEditorToolResultMessages.parenthesizedCurrentVersion', {
              version: formatBusinessVersionLabel(
                revision,
                global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
              ),
            })
            : '',
          phase: phase
            ? global.i18next.t('nocodeEditorToolResultMessages.phaseSuffix', { phase })
            : '',
          detail: detail
            ? global.i18next.t('nocodeEditorToolResultMessages.detailSuffix', { detail })
            : '',
        }),
        summaryFromStatus
          ? global.i18next.t('nocodeEditorToolResultMessages.summaryLine', { summary: summaryFromStatus })
          : '',
        Number(counts?.formCount || 0) || Number(counts?.fieldCount || 0)
          ? global.i18next.t('nocodeEditorToolResultMessages.blueprintStructureCount', {
            forms: Number(counts?.formCount || 0),
            fields: Number(counts?.fieldCount || 0),
            questions: Number(counts?.openQuestionCount || 0),
          })
          : '',
        draftState?.summary
          ? global.i18next.t('nocodeEditorToolResultMessages.draftStateLine', {
            summary: String(draftState.summary).trim(),
          })
          : '',
        applyLine,
        global.i18next.t('nocodeEditorToolResultMessages.readOnlyResultNotice'),
      ].filter(Boolean).join('\n')
    }
    return global.i18next.t('nocodeEditorToolResultMessages.noStagedBlueprintRead', {
      version: revision > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.parenthesizedCurrentVersion', {
          version: formatBusinessVersionLabel(
            revision,
            global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
          ),
        })
        : '',
    })
  }
  const displayTitle = resolveNocodeEditorBlueprintDisplayTitle({
    title: blueprint?.title,
    forms: blueprint?.forms,
    fallback: global.i18next.t('nocodeEditorToolResultMessages.unnamedBlueprint'),
  })

  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  const openQuestions = Array.isArray(blueprint?.openQuestions) ? blueprint.openQuestions : []
  const formLines = forms
    .map((form) => {
      const fields = flattenBlueprintFields(form?.fields)
      const fieldPreview = formatPreviewList(
        fields.map(field => {
          const widgetType = field.type || (field as Record<string, unknown>).widgetType
          return `${field.name}${resolveBlueprintWidgetTypeLabelFromAny(widgetType) ? `(${resolveBlueprintWidgetTypeLabelFromAny(widgetType)})` : ''}`
        }),
        24,
      )
      return global.i18next.t('nocodeEditorToolResultMessages.blueprintFormItem', {
        groupName: String(form?.groupName || '').trim()
          || global.i18next.t('nocodeEditorToolResultMessages.ungrouped'),
        tableName: String(form?.tableName || '').trim(),
        count: fields.length,
        fields: fieldPreview
          ? global.i18next.t('nocodeEditorToolResultMessages.fieldPreviewSuffix', {
            fields: fieldPreview,
          })
          : '',
      })
    })
    .filter(Boolean)
  const questionLines = openQuestions
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .map(item => `- ${item}`)

  const lastApplySummary = toRecord(output?.applyResult).summary
  const applyResult = isRecord(lastApplySummary)
    ? lastApplySummary
    : null
  const applyLine = applyResult
    ? global.i18next.t('nocodeEditorToolResultMessages.latestBlueprintApplySummaryWithReview', {
      formsCreated: Number(applyResult.formsCreated || 0),
      formsReused: Number(applyResult.formsReused || 0),
      fieldsCreated: Number(applyResult.fieldsCreated || 0),
      fieldsReused: Number(applyResult.fieldsReused || 0),
      fieldsUpdated: Number(applyResult.fieldsUpdated || 0),
    })
    : global.i18next.t('nocodeEditorToolResultMessages.blueprintNotGeneratedYet')

  return [
    global.i18next.t('nocodeEditorToolResultMessages.blueprintRead', {
      title: displayTitle || global.i18next.t('nocodeEditorToolResultMessages.unnamedBlueprint'),
      version: revision > 0
        ? global.i18next.t('nocodeEditorToolResultMessages.parenthesizedCurrentVersion', {
          version: formatBusinessVersionLabel(
            revision,
            global.i18next.t('nocodeEditorToolResultMessages.currentVersion'),
          ),
        })
        : '',
    }),
    blueprint?.summary
      ? global.i18next.t('nocodeEditorToolResultMessages.summaryLine', {
        summary: String(blueprint.summary).trim(),
      })
      : '',
    formLines.length
      ? global.i18next.t('nocodeEditorToolResultMessages.blueprintFormsSection', {
        forms: formLines.join('\n'),
      })
      : global.i18next.t('nocodeEditorToolResultMessages.blueprintHasNoForms'),
    questionLines.length
      ? global.i18next.t('nocodeEditorToolResultMessages.pendingQuestionsSection', {
        questions: questionLines.join('\n'),
      })
      : '',
    applyLine,
    global.i18next.t('nocodeEditorToolResultMessages.readOnlyResultNotice'),
  ].filter(Boolean).join('\n')
}

const buildFormSummaryMessage = (input: unknown) => {
  const output = toRecord(input)
  const tableName = String(output?.tableName || '').trim()
    || global.i18next.t('nocodeEditorToolResultMessages.currentForm')
  const widgets = flattenSerializedWidgets(output?.widgets)
  const selectedWidgetId = String(output?.selectedWidgetId || '').trim()
  const selectedWidget = widgets.find(item => item.uid === selectedWidgetId)
  const availableWidgetTypes = Array.isArray(output?.availableWidgetTypes) ? output.availableWidgetTypes : []
  const widgetTypePreview = formatPreviewList(
    availableWidgetTypes
      .map(item => formatWidgetTypeDisplay(item))
      .filter(Boolean),
    18,
  )
  const widgetPreview = formatPreviewList(
    widgets.map(widget => formatWidgetNameWithType(widget.name, widget.type)),
    32,
  )

  return [
    global.i18next.t('nocodeEditorToolResultMessages.formSummaryRead', {
      tableName,
      count: widgets.length,
    }),
    selectedWidget
      ? global.i18next.t('nocodeEditorToolResultMessages.selectedField', {
        field: formatWidgetNameWithType(selectedWidget.name, selectedWidget.type),
      })
      : global.i18next.t('nocodeEditorToolResultMessages.noFieldSelected'),
    widgets.length
      ? global.i18next.t('nocodeEditorToolResultMessages.fieldList', { fields: widgetPreview })
      : global.i18next.t('nocodeEditorToolResultMessages.noFields'),
    widgetTypePreview
      ? global.i18next.t('nocodeEditorToolResultMessages.availableFieldTypes', {
        fieldTypes: widgetTypePreview,
      })
      : '',
    global.i18next.t('nocodeEditorToolResultMessages.readOnlyResultNotice'),
  ].filter(Boolean).join('\n')
}
const buildAllFormSummariesMessage = (result: AiActionResult) => {
  const output = result?.output || {}
  const forms = Array.isArray(output?.forms) ? output.forms : []
  const enumOnly = Boolean(result?.metadata?.input?.enumOnly)
  if (!forms.length) {
    return enumOnly
      ? global.i18next.t('nocodeEditorToolResultMessages.noFormsForEnumAnalysis')
      : global.i18next.t('nocodeEditorToolResultMessages.noFormsForAnalysis')
  }

  const totalEnumFieldCount = forms.reduce((total, form) => {
    const widgets = flattenSerializedWidgets(form?.widgets)
    return total + widgets.filter(item => Boolean(String(item?.enumSourceType || '').trim())).length
  }, 0)

  const formLines = forms.map((form) => {
    const tableName = String(
      form?.tableName
      || form?.tableId
      || global.i18next.t('nocodeEditorToolResultMessages.unnamedForm'),
    ).trim()
    if (form?.error) {
      return global.i18next.t('nocodeEditorToolResultMessages.formSummaryReadFailedItem', {
        tableName,
        error: resolveReasonText(form.error) || String(form.error).trim(),
      })
    }

    const widgets = flattenSerializedWidgets(form?.widgets)
    if (enumOnly) {
      const enumWidgets = widgets.filter(item => Boolean(String(item?.enumSourceType || '').trim()))
      const enumPreview = formatPreviewList(
        enumWidgets.map((item) => {
          const sourceType = String(item?.enumSourceType || '').trim()
          const optionCount = Number(item?.enumOptionCount || 0)
          const detail = [
            sourceType ? `source=${sourceType}` : '',
            optionCount > 0
              ? global.i18next.t('nocodeEditorToolResultMessages.itemCount', { count: optionCount })
              : '',
          ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
          return `${item.name}${detail ? `(${detail})` : ''}`
        }),
        20,
      )
      return global.i18next.t('nocodeEditorToolResultMessages.enumFormSummaryItem', {
        tableName,
        count: enumWidgets.length,
        fields: enumPreview
          ? global.i18next.t('nocodeEditorToolResultMessages.fieldPreviewSuffix', {
            fields: enumPreview,
          })
          : '',
      })
    }

    const widgetPreview = formatPreviewList(
      widgets.map(item => formatWidgetNameWithType(item.name, item.type)),
      20,
    )
    return global.i18next.t('nocodeEditorToolResultMessages.formSummaryItem', {
      tableName,
      count: widgets.length,
      fields: widgetPreview
        ? global.i18next.t('nocodeEditorToolResultMessages.fieldPreviewSuffix', {
          fields: widgetPreview,
        })
        : '',
    })
  })

  return [
    enumOnly
      ? global.i18next.t('nocodeEditorToolResultMessages.enumFormSummariesRead', {
        forms: forms.length,
        fields: totalEnumFieldCount,
      })
      : global.i18next.t('nocodeEditorToolResultMessages.appFormSummariesRead', {
        count: forms.length,
      }),
    formLines.join('\n'),
    global.i18next.t('nocodeEditorToolResultMessages.readOnlyResultNotice'),
  ].filter(Boolean).join('\n')
}

const buildWidgetOptionSchemaMessage = (result: AiActionResult) => {
  const output = result?.output || {}
  const widgetId = String(output?.widgetId || result?.metadata?.input?.widgetId || '').trim()
  const widgetType = formatWidgetTypeDisplay(output?.widgetType)
  const groups = Array.isArray(output?.groups) ? output.groups : []
  const optionCount = groups.reduce((total, group) => (
    total + (Array.isArray(group?.options) ? group.options.length : 0)
  ), 0)

  if (!groups.length) {
    return global.i18next.t('nocodeEditorToolResultMessages.fieldSettingsSchemaEmpty', {
      widgetId: widgetId || 'unknown',
      widgetType: widgetType
        ? global.i18next.t('nocodeEditorToolResultMessages.fieldTypeSuffix', { widgetType })
        : '',
    })
  }

  const groupLines = groups.map((group) => {
    const options = Array.isArray(group?.options) ? group.options : []
    const optionPreview = formatPreviewList(
      options.map((item) => {
        const path = formatOptionPath(item?.path, item?.key)
        const type = String(item?.type || '').trim()
        const currentValue = stringifyCurrentValue(item?.currentValue)
        const dynamic = item?.hasDynamicChoices
          ? global.i18next.t('nocodeEditorToolResultMessages.readChoicesFirst')
          : ''
        const detail = [
          path ? `path=${path}` : '',
          type ? `type=${type}` : '',
          currentValue ? `current=${currentValue}` : '',
          dynamic,
        ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
        return global.i18next.t('nocodeEditorToolResultMessages.fieldSettingItem', {
          label: String(
            item?.label
            || item?.key
            || path
            || global.i18next.t('nocodeEditorToolResultMessages.unnamedSetting'),
          ).trim(),
          detail: detail ? `(${detail})` : '',
        })
      }),
      24,
    )
    return global.i18next.t('nocodeEditorToolResultMessages.fieldSettingGroupItem', {
      group: String(
        group?.label
        || group?.group
        || global.i18next.t('nocodeEditorToolResultMessages.unnamedGroup'),
      ).trim(),
      options: optionPreview,
    })
  })

  return [
    global.i18next.t('nocodeEditorToolResultMessages.fieldSettingsSchemaRead', {
      widgetId: widgetId || 'unknown',
      widgetType: widgetType
        ? global.i18next.t('nocodeEditorToolResultMessages.fieldTypeSuffix', { widgetType })
        : '',
      groups: groups.length,
      options: optionCount,
    }),
    groupLines.join('\n'),
    global.i18next.t('nocodeEditorToolResultMessages.fieldSettingsReadOnlyNotice'),
  ].filter(Boolean).join('\n')
}

const buildWidgetOptionChoicesMessage = (result: AiActionResult) => {
  const output = result?.output || {}
  const widgetId = String(output?.widgetId || result?.metadata?.input?.widgetId || '').trim()
  const optionPath = formatOptionPath(output?.optionPath, result?.metadata?.input?.optionKey)
  const choices = flattenChoiceItems(output?.choices)
  if (!choices.length) {
    return global.i18next.t('nocodeEditorToolResultMessages.fieldChoicesEmpty', {
      widgetId: widgetId || 'unknown',
      optionPath: optionPath
        ? global.i18next.t('nocodeEditorToolResultMessages.optionPathSuffix', { optionPath })
        : '',
    })
  }

  const choicePreview = formatPreviewList(
    choices.map((item) => {
      const label = String(item?.label || item?.value || '').trim()
      const value = String(item?.value || item?.label || '').trim()
      const hint = item?.path ? `${item.path}` : ''
      const detail = [
        value && value !== label ? `value=${value}` : '',
        hint,
      ].filter(Boolean).join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
      return `${label || value}${detail ? `(${detail})` : ''}`
    }),
    30,
  )

  return global.i18next.t('nocodeEditorToolResultMessages.fieldChoicesRead', {
    widgetId: widgetId || 'unknown',
    optionPath: optionPath
      ? global.i18next.t('nocodeEditorToolResultMessages.optionPathSuffix', { optionPath })
      : '',
    count: choices.length,
    choices: choicePreview,
  })
}

const countBlueprintFields = (forms: unknown) => {
  if (!Array.isArray(forms)) {
    return 0
  }
  return forms.reduce((total, form) => total + countBlueprintFieldList(form?.fields), 0)
}

const countBlueprintFieldList = (fields: unknown) => {
  if (!Array.isArray(fields)) {
    return 0
  }
  return fields.reduce((total, field) => {
    const childCount = countBlueprintFieldList(field?.children)
    return total + 1 + childCount
  }, 0)
}

const flattenBlueprintFields = (fields: unknown, parentPath = ''): Array<{ name: string; type: string }> => {
  if (!Array.isArray(fields)) {
    return []
  }

  return fields.flatMap((field) => {
    const fieldName = String(field?.name || '').trim()
    const currentPath = [parentPath, fieldName].filter(Boolean).join('.')
    const currentItem = currentPath
      ? [{
        name: currentPath,
        type: String(field?.widgetType || '').trim(),
      }]
      : []
    return [
      ...currentItem,
      ...flattenBlueprintFields(field?.children, currentPath),
    ]
  })
}

const flattenSerializedWidgets = (
  widgets: unknown,
  parentPath = '',
): FlattenedSerializedWidget[] => {
  if (!Array.isArray(widgets)) {
    return []
  }

  return widgets.flatMap((widget) => {
    const widgetName = String(widget?.name || '').trim()
    const currentPath = [parentPath, widgetName].filter(Boolean).join('.')
    const currentItem = currentPath
      ? [{
        uid: String(widget?.uid || '').trim(),
        name: currentPath,
        type: String(widget?.type || '').trim(),
        enumSourceType: String(widget?.enumSourceType || '').trim(),
        enumOptionCount: Number(widget?.enumOptionCount || 0),
      }]
      : []
    return [
      ...currentItem,
      ...flattenSerializedWidgets(widget?.children, currentPath),
    ]
  })
}

const flattenChoiceItems = (
  choices: unknown,
  parentPath = '',
): Array<{ label: string; value: string; path: string }> => {
  if (!Array.isArray(choices)) {
    return []
  }

  return choices.flatMap((item) => {
    if (Array.isArray(item)) {
      return flattenChoiceItems(item, parentPath)
    }

    const label = String(item?.label || item?.value || '').trim()
    const value = String(item?.value || item?.label || '').trim()
    const currentPath = [parentPath, label || value].filter(Boolean).join(' / ')
    const currentItem = label || value
      ? [{
        label,
        value,
        path: currentPath,
      }]
      : []

    return [
      ...currentItem,
      ...flattenChoiceItems(item?.children, currentPath),
    ]
  })
}

const resolveFieldLabel = (value: unknown) => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  return String(
    record.name
    || record.tableName
    || record.widgetId
    || record.requestId
    || global.i18next.t('nocodeEditorToolResultMessages.unnamedField'),
  ).trim() || global.i18next.t('nocodeEditorToolResultMessages.unnamedField')
}

const hasFormulaFieldOptionApplied = (value: unknown) => {
  const applied = Array.isArray(value) ? value : []
  return applied.some((item) => {
    const record = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {}
    const path = Array.isArray(record.path)
      ? record.path.map(part => String(part || '').trim()).filter(Boolean)
      : []
    const normalizedPath = path.join('.')
    return normalizedPath === 'default-formula'
      || normalizedPath === 'compute-formula'
  })
}

const joinFailureMessages = (messages: string[]) => {
  return messages
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(global.i18next.t('nocodeEditorToolResultMessages.sectionSeparator'))
}

const formatPreviewList = (items: string[], limit: number) => {
  const normalized = items
    .map(item => String(item || '').trim())
    .filter(Boolean)
  if (!normalized.length) {
    return ''
  }

  if (normalized.length <= limit) {
    return normalized.join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator'))
  }

  return global.i18next.t('nocodeEditorToolResultMessages.previewListTruncated', {
    items: normalized
      .slice(0, limit)
      .join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator')),
    count: normalized.length,
  })
}

const formatOptionPath = (value: unknown, fallbackKey?: unknown) => {
  if (Array.isArray(value)) {
    const paths = value
      .map(item => String(item || '').trim())
      .filter(Boolean)
    if (paths.length) {
      return paths.join('.')
    }
  }

  const key = String(fallbackKey || '').trim()
  return key || ''
}

const stringifyCurrentValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  if (typeof value === 'string') {
    return JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}...` : value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value.slice(0, 6))
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const resolveReasonText = (value: unknown) => {
  const reason = String(value || '').trim()
  if (!reason) {
    return ''
  }
  const reasonMap: Record<string, string> = {
    form_has_unsaved_changes: global.i18next.t('nocodeEditorToolResultMessages.saveFormBeforeContinuing'),
    active_form_has_unsaved_changes: global.i18next.t('nocodeEditorToolResultMessages.unsavedFormCannotSwitch'),
    page_has_unsaved_changes: global.i18next.t('nocodeEditorToolResultMessages.savePageBeforeContinuing'),
    form_not_found: global.i18next.t('nocodeEditorToolResultMessages.targetFormNotFound'),
    open_form_failed: global.i18next.t('nocodeEditorToolResultMessages.openTargetFormFailed'),
    widget_id_required: global.i18next.t('nocodeEditorToolResultMessages.targetFieldRequired'),
    form_runtime_unavailable: global.i18next.t('nocodeEditorToolResultMessages.formEditorUnavailable'),
    enum_option_not_found: global.i18next.t('nocodeEditorToolResultMessages.enumOptionsNotWritable'),
  }
  return reasonMap[reason] || reason
}
