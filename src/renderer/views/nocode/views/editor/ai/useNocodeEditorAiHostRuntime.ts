import { computed, nextTick, ref } from 'vue'
import axios from 'axios'
import { filterNocodeEditorDraftIssueOpenQuestions } from '../../../../../../common/utils/nocodeEditorDraftIssueOpenQuestions'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiBlueprintApplyOptions,
  NocodeEditorAiBlueprintApplyScope,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiBlueprintApplyFormResult,
  NocodeEditorAiBlueprintApplyResult,
  NocodeEditorAiBlueprintOption,
  NocodeEditorAiExcelBlueprintDraftInput,
  NocodeEditorAiExcelBlueprintImportContext,
  NocodeEditorAiExcelImportAfterBlueprintResult,
  NocodeEditorAiExcelImportHandle,
  NocodeEditorAiFormRuntime,
  NocodeEditorAiHostRuntimeOptions,
  NocodeEditorAiMode,
  NocodeEditorAiRuntime,
  NocodeEditorAiAppPlan,
  NocodeEditorAiApplicationStructurePreview,
  NocodeEditorAiFlowApplyResult,
  NocodeEditorAiStagedAppBlueprint,
  NocodeEditorAiStagedAppPlan,
  NocodeEditorAiStagedFormPlan,
  NocodeEditorAiStagedFlowBlueprint,
  NocodeEditorAiStagedFlowScheme,
  NocodeEditorAiStagedFlowPlan,
  NocodeEditorAiSolutionOutline,
  NocodeEditorAiSolutionOutlineFlow,
  NocodeEditorAiSolutionOutlineForm,
  NocodeEditorAiSolutionOutlineModule,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiDraftIssueLocateResult,
  NocodeEditorAiDraftSaveResult,
  NocodeEditorAiBlueprintFieldSource,
  NocodeEditorAiActiveFormulaTaskContext,
  NocodeEditorAiStagedFormulaPlan,
  NocodeEditorAiTaskContext,
  NocodeEditorAiDraftPersistenceRefreshResult,
  NocodeEditorAiFieldToolDraftRefreshOutput,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueLocateResult,
  NocodeEditorAiViewFlowPatchResultInput,
  NocodeEditorAiViewFlowPatchResult,
} from './types'
import { selectNocodeEditorAiBlueprintFormsByTargetFormKeys } from './types'
import {
  buildBlueprintDraftPersistenceState,
  mergeDraftIssuesIntoBlueprintOpenQuestions,
} from './blueprintDraftSaveState'
import {
  hasCrossBlueprintDraftBlockingIssues,
  resolveCrossBlueprintDraftContinuation,
} from './crossBlueprintDraftContinuation'
import {
  buildBlueprintArtifactVersionFromParts,
  getNocodeEditorAiBlueprintIdentityKey,
} from './blueprintArtifactIdentity'
import {
  createAppliedDraftBlueprintState,
  createAppliedSavedBlueprintState,
  createStagedBlueprintState,
} from './blueprintLifecycle'
import {
  applyBlueprintFormulaPlan,
  buildBlueprintFormulaPlan,
  normalizeBlueprintFormulaSettings,
  resolveBlueprintFormulaPaths,
  resolveBlueprintFormulaApplyStatus,
  summarizeBlueprintFormulaApply,
} from './blueprintFormulaApply'
import {
  normalizeBlueprintDefaultValue,
  resolveBlueprintDefaultValueChanges,
} from './blueprintDefaultValue'
import { buildCurrentRowFormulaTokenByTitle } from './formulaFieldTokens'
import { buildNocodeEditorPostFormFlowReleaseContext } from './postFormFlowReleaseContext'
import { shouldPlanningSupersedeBlueprint } from './planningBlueprintSupersession'
import { resolveSupportedBlueprintWidgetType } from './blueprintWidgetTypeSupport'
import {
  inferBlueprintFieldIntent,
  resolveBlueprintExplicitWidgetType as resolveExplicitBlueprintWidgetType,
} from './blueprintFieldIntent'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiPlanningContinuation,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorBlueprintToolInput,
  validateNocodeEditorBlueprintReplaceScope,
} from '@common/utils/nocodeEditorBlueprintInput'
import { NocodeStructureType, type NocodeStructure } from '@common/types/nocode'
import { isBuiltinField } from '@common/utils'
import type { FormOptions, Table, Field } from '@common/types/project'
import {
  analyzeNocodeEditorRelationSignals,
  buildNocodeEditorRelationContextFromTables,
  mergeNocodeEditorRelationContexts,
  type NocodeEditorRelationSignalAnalysis,
  type NocodeEditorRelationContext,
} from '@common/utils/nocodeEditorRelationContext'
import {
  resolveNocodeEditorBlueprintDisplayTitle,
} from '@common/utils/nocodeEditorBlueprintTitle'
import {
  projectBlueprintConfirmation,
} from '@common/utils/nocodeEditorBlueprintConfirmationProjection'
import {
  buildPlanningConfirmationContextKey,
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'
import {
  buildNocodeEditorPlanningFormReferenceIndex,
  resolveNocodeEditorPlanningCanonicalFormKey,
  resolveNocodeEditorPlanningFormAlias,
  resolveNocodeEditorPlanningGenericFormReference,
} from '@common/utils/nocodeEditorPlanningFormReference'
import {
  normalizeNocodeEditorFlowIntentSignal,
} from '@common/utils/nocodeEditorFlowIntentSignal'
import {
  getNocodeEditorBlueprintFormApplyTargetIdentity,
  getNocodeEditorBlueprintFormIdentity as getNocodeEditorBlueprintMergeIdentity,
  mergeSingleFormBlueprintFragments,
} from '@common/utils/nocodeEditorBlueprintFormNormalization'
import {
  collectNocodeEditorPostFormFlowSignals,
} from '@common/utils/nocodeEditorPostFormFlowSignals'
import {
  resolveNocodeEditorPostFormFlowRelease,
} from '@common/utils/nocodeEditorPostFormFlowRelease'
import {
  buildExcelBlueprintDraft,
  buildExcelImportMappingsFromApplyResult,
  compactExcelImportContextForModel,
} from './excelBlueprintDraft'
import { normalizeNocodeEditorContentPlan } from '@common/utils/nocodeEditorContentPlan'
import {
  buildNocodeEditorFormulaEvidenceFingerprint,
  buildNocodeEditorFormulaPlanFingerprint,
  normalizeNocodeEditorFormulaPlan,
  resolveFormulaContextRefreshAction,
  resolveNocodeEditorFormulaAdvance,
  resolveNocodeEditorFormulaPlanningScope as resolveFormulaDomainPlanningScope,
  resolveNocodeEditorFormulaPlanDisplayMode,
} from '@common/utils'
import type {
  NocodeEditorFormulaApplyResult,
  NocodeEditorFormulaContextSnapshot,
  NocodeEditorFormulaPath,
  NocodeEditorFormulaPreflightIssue,
  NocodeEditorResolvedFormulaWrite,
} from '@common/types/nocodeEditorFormula'
import {
  preflightNocodeEditorFormulaPlan,
  type NocodeEditorFormulaPreflightForm,
} from '@common/utils/nocodeEditorFormulaPreflight'
import {
  normalizeNocodeEditorFlowPlanToolInput,
  normalizeNocodeEditorFlowPlan,
  resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles,
  type NocodeEditorFlowPlan,
  type NocodeEditorFlowPlanDiagnostic,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  convertNocodeEditorFlowBlueprintToFlowPlan,
  normalizeNocodeEditorFlowBlueprint,
  validateNocodeEditorFlowBlueprintContract,
  type NocodeEditorFlowBlueprint,
  type NocodeEditorFlowBlueprintMismatchReason,
} from '@common/utils/nocodeEditorFlowBlueprint'
import {
  normalizeNocodeEditorFlowScheme,
  normalizeNocodeEditorFlowSchemeReviewResult,
  type NocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  projectNocodeEditorConfirmationDecisions,
  type NocodeEditorConfirmationDecision,
} from '@common/utils/nocodeEditorConfirmationDecisionProjection'
import {
  reconcileNocodeEditorConfirmationDecisions,
} from '@common/utils/nocodeEditorConfirmationDecisionReconciliation'
import {
  convergeNocodeEditorFlowSchemeApprovalOwners,
} from '@common/utils/nocodeEditorFlowSchemeApprovalOwnerConvergence'
import type {
  FlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  normalizeFlowIssueRoutingResult,
  projectFlowIssueRouteToLegacyFields,
  routeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import type {
  FlowIssueStateResolutionLike,
  UnifiedFlowIssue,
  UnifiedFlowIssueSourceStage,
} from '@common/utils/nocodeEditorFlowUnifiedIssue'
import {
  buildUnifiedFlowIssuesFromDecisionConflicts,
  buildUnifiedFlowIssuesFromExecutionBlocker,
  buildUnifiedFlowIssuesFromFlowIssueState,
  buildUnifiedFlowIssuesFromFlowScheme,
  buildUnifiedFlowIssuesFromGrounding,
  normalizeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowUnifiedIssue'
import {
  NocodeEditorFlowPatchError,
  normalizeNocodeEditorFlowPatch,
  type NocodeEditorFlowPatchResult,
} from '@common/utils/nocodeEditorFlowPatch'
import {
  decorateFlowSchemeWithConvergence,
} from './flowSchemeConvergence'
import {
  assertUniqueFlowSchemeStepKeys,
  assessAndDecorateFlowSchemePersonnelDependencies,
  hasFlowSchemePersonnelRequirements,
} from './flowPersonnelDependencyAssessment'
import {
  buildPlannedFlowFieldMaterializationPlan,
  markFlowDependenciesMaterialized,
  materializePlannedFlowFieldRequests,
  partitionFlowGroundingDiagnosticsByPlannedDependencies,
  rebaseFlowPlanPlannedPersonnelFields,
  resolvePlannedFlowFieldNameConflicts,
  type PlannedFlowFieldMaterializationResult,
} from './flowPlannedDependencyMaterialization'
import {
  validateFlowBlueprintPersonnelRequirements,
} from './flowPersonnelBlueprintPreflight'
import {
  isFlowPlanApplyContextReady,
  requiresFlowSchemeForFlowPlan,
} from './flowSchemeArtifactState'
import {
  resolveNocodeEditorBlueprintPlanningCarryover,
  type NocodeEditorBlueprintPlanningCarryover,
} from './nocodeEditorBlueprintPlanningCarryover'
import {
  alignPlanningOutlineIdentityToContextKey,
  resolvePlanningContinuationSourceContextKey,
} from './planningContinuationContext'
import type { NocodeEditorPlanningScope } from '@common/utils/nocodeEditorPlanningScope'
import {
  isNocodeEditorPostFormFlowEnabledForScope,
  normalizeNocodeEditorPlanningScopeValue,
} from '@common/utils/nocodeEditorPostFormFlowScope'
import { normalizeFormulaResultTargetErrorReason } from './formulaResultTargetError'
import { asArray, asRecord } from '../form/ai-form-process-runtime'
import { validateFlowPlanGrounding } from '../form/ai-flow-plan-grounding'
import {
  buildFlowGroundingBusinessUserMessage,
  buildFlowGroundingIssueGroups,
  projectFlowGroundingQuestions,
} from '../form/ai-flow-plan-grounding-questions'

const FORM_TOOL_NAMES = new Set([
  'editor_get_form_summary',
  'editor_get_widget_option_schema',
  'editor_get_widget_option_choices',
  'editor_add_fields',
  'editor_delete_field',
  'editor_replace_field',
  'editor_bind_field_source',
  'editor_set_field_formulas',
  'editor_set_field_options',
])
const CURRENT_TASK_CONTEXT_TOOL_NAME = 'editor_get_current_task_context'

export const buildFormulaToolItems = (input: {
  resolvedWrites: NocodeEditorResolvedFormulaWrite[]
  issues: NocodeEditorFormulaPreflightIssue[]
}) => {
  const updatedByTarget = new Map<string, Record<string, any>>()
  for (const write of input.resolvedWrites || []) {
    const targetKey = [write.itemKey, write.tableId, write.widgetId].join('::')
    const existing = updatedByTarget.get(targetKey)
    const item = existing || {
      status: 'updated',
      widgetId: write.widgetId,
      tableId: write.tableId,
      ...(write.tableName ? { tableName: write.tableName } : {}),
      fieldName: write.fieldName,
      ...(write.explanation ? { explanation: write.explanation } : {}),
      changes: [],
    }
    item.changes.push({
      key: write.formulaPath,
      value: write.formula,
    })
    updatedByTarget.set(targetKey, item)
  }

  const skippedItemKeys = new Set<string>()
  const skipped = (input.issues || []).flatMap(issue => {
    if (skippedItemKeys.has(issue.itemKey)) return []
    skippedItemKeys.add(issue.itemKey)
    const fieldName = String(issue.target?.fieldName || '').trim()
    const reason = String(issue.message || issue.code || '').trim()
    return fieldName && reason
      ? [{
        status: 'skipped',
        fieldName,
        reason,
      }]
      : []
  })

  return [
    ...updatedByTarget.values(),
    ...skipped,
  ]
}

export const resolveNocodeEditorFormulaPlanningScope = (input: {
  origin: 'standalone'
  carriedPlanningScope?: NocodeEditorPlanningScope | null
  carriedTaskScopeKey?: string | null
  carriedTargetFormId?: string | null
  sourceTaskScopeKey?: string | null
  sourceFormId?: string | null
  sameTaskScope: boolean
  sameTargetForm: boolean
  taskSummary?: Record<string, unknown> | null
}): NocodeEditorPlanningScope => {
  const pendingFlowIntent = input.taskSummary?.pendingFlowIntent
  const pendingFlowTargetFormId = String(
    pendingFlowIntent && typeof pendingFlowIntent === 'object' && !Array.isArray(pendingFlowIntent)
      ? (pendingFlowIntent as Record<string, unknown>).targetFormId || ''
      : '',
  ).trim()
  const carriedTaskScopeKey = String(input.carriedTaskScopeKey || '').trim()
  const carriedTargetFormId = String(input.carriedTargetFormId || '').trim()
  const sourceTaskScopeKey = String(input.sourceTaskScopeKey || '').trim()
  const sourceFormId = String(input.sourceFormId || '').trim()
  const persistedTaskScopeKey = String(input.taskSummary?.taskScopeKey || '').trim()
  const persistedTargetFormId = String(input.taskSummary?.targetFormId || '').trim()
  const hasExplicitPendingFlowIntent = Boolean(
    pendingFlowIntent
    && typeof pendingFlowIntent === 'object'
    && !Array.isArray(pendingFlowIntent)
    && (pendingFlowIntent as Record<string, unknown>).status === 'pending_after_form_apply',
  )
  const isFormBuildingTask = input.carriedPlanningScope === 'form'
    && input.taskSummary?.planningScope === 'form'
  const hasMatchingPersistedContinuation = Boolean(
    carriedTaskScopeKey
    && carriedTargetFormId
    && sourceTaskScopeKey
    && sourceFormId
    && persistedTaskScopeKey === carriedTaskScopeKey
    && persistedTargetFormId === carriedTargetFormId
    && pendingFlowTargetFormId === carriedTargetFormId
    && carriedTaskScopeKey === sourceTaskScopeKey
    && carriedTargetFormId === sourceFormId,
  )

  return resolveFormulaDomainPlanningScope({
    origin: input.origin,
    carriedPlanningScope: input.carriedPlanningScope,
    sameTaskScope: Boolean(
      isFormBuildingTask
      && hasExplicitPendingFlowIntent
      && hasMatchingPersistedContinuation
      && input.sameTaskScope,
    ),
    sameTargetForm: input.sameTargetForm,
  })
}

const createFormulaStageError = (message: string, code: string) => {
  const error = new Error(message) as Error & { code?: string }
  error.code = code
  return error
}

const OUTLINE_TOOL_NAMES = new Set([
  'editor_stage_single_form_plan',
  'editor_stage_content_plan',
])

const BLUEPRINT_TOOL_NAMES = new Set([
  'editor_stage_app_blueprint',
  'editor_get_staged_app_blueprint',
  'editor_apply_staged_app_blueprint',
  'editor_clear_staged_app_blueprint',
])

const FLOW_TOOL_NAMES = new Set([
  'editor_get_flow_summary',
  'editor_patch_flow',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
])

const FLOW_RUNTIME_ISSUE_RESOLUTIONS: Record<string, FlowIssueStateResolutionLike> = {
  approval_approver_missing: {
    userActionRequired: true,
    returnToStage: 'flow-scheme',
    questionKind: 'note_only',
  },
  transact_transactor_missing: {
    userActionRequired: true,
    returnToStage: 'flow-scheme',
    questionKind: 'note_only',
  },
  notify_notifier_missing: {
    userActionRequired: true,
    returnToStage: 'flow-scheme',
    questionKind: 'note_only',
  },
  report_data_target_form_missing: {
    userActionRequired: true,
    returnToStage: 'flow-scheme',
    questionKind: 'note_only',
  },
  add_data_target_form_missing: {
    userActionRequired: true,
    returnToStage: 'flow-scheme',
    questionKind: 'note_only',
  },
}

class FlowGroundingConfirmationError extends Error {
  flowGroundingDiagnostics: ReturnType<typeof validateFlowPlanGrounding>
  flowGroundingQuestions: ReturnType<typeof projectFlowGroundingQuestions>
  flowGroundingUserMessage: string
  flowGroundingReturnToStage = 'flow-scheme' as const
  blockedNextAction = 'editor_stage_flow_blueprint' as const
  requiredNextAction = 'editor_plan_flow_scheme' as const
  flowSchemePlanningStatus: 'needs_confirmation' | 'ready_for_review' = 'needs_confirmation'
  flowUnifiedIssues: UnifiedFlowIssue[]
  flowIssueRouting: FlowIssueRoutingResult

  constructor(input: {
    planningContextKey?: string
    diagnostics: ReturnType<typeof validateFlowPlanGrounding>
  }) {
    const diagnostics = input.diagnostics
    const groups = buildFlowGroundingIssueGroups(diagnostics)
    const userMessage = buildFlowGroundingBusinessUserMessage(diagnostics)
    super(userMessage)
    this.name = 'FlowGroundingConfirmationError'
    this.flowGroundingDiagnostics = diagnostics
    this.flowGroundingQuestions = projectFlowGroundingQuestions(groups)
    this.flowGroundingUserMessage = userMessage
    this.flowUnifiedIssues = buildUnifiedFlowIssuesFromGrounding({
      planningContextKey: input.planningContextKey,
      userMessage,
      groups,
      blockedNextAction: this.blockedNextAction,
    })
    this.flowIssueRouting = routeUnifiedFlowIssues(this.flowUnifiedIssues)
    const projection = projectFlowIssueRouteToLegacyFields({
      issues: this.flowUnifiedIssues,
      routing: this.flowIssueRouting,
      planningContextKey: input.planningContextKey,
      stage: 'flow-plan',
    })
    this.flowGroundingReturnToStage = projection.flowGroundingReturnToStage || 'flow-scheme'
    this.blockedNextAction = projection.blockedNextAction === 'editor_stage_flow_blueprint'
      ? 'editor_stage_flow_blueprint'
      : this.blockedNextAction
    this.requiredNextAction = projection.requiredNextAction || 'editor_plan_flow_scheme'
    this.flowSchemePlanningStatus = projection.planningStatus
    this.flowGroundingUserMessage = projection.flowGroundingUserMessage || userMessage
  }
}

class FlowExecutionBlockerError extends Error {
  flowUnifiedIssues: UnifiedFlowIssue[]
  flowIssueRouting: FlowIssueRoutingResult
  blockedNextAction: 'editor_stage_flow_blueprint' | 'editor_apply_staged_flow'

  constructor(input: {
    issueId: string
    sourceStage: UnifiedFlowIssueSourceStage
    planningContextKey?: string
    blockedNextAction: 'editor_stage_flow_blueprint' | 'editor_apply_staged_flow'
    userMessage: string
    code?: string
    path?: string
  }) {
    super(input.userMessage)
    this.name = 'FlowExecutionBlockerError'
    this.blockedNextAction = input.blockedNextAction
    this.flowUnifiedIssues = buildUnifiedFlowIssuesFromExecutionBlocker({
      issueId: input.issueId,
      sourceStage: input.sourceStage,
      planningContextKey: input.planningContextKey,
      blockedNextAction: input.blockedNextAction,
      userMessage: input.userMessage,
      code: input.code,
      path: input.path,
    })
    this.flowIssueRouting = routeUnifiedFlowIssues(this.flowUnifiedIssues)
  }
}

const cloneValue = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

type TBlueprint = {
  forms?: NocodeEditorAiAppBlueprint['forms']
}

const normalizeSingleFormBlueprintFragments = <T extends TBlueprint>(blueprint: T): T => {
  const normalizedForms = Array.isArray(blueprint.forms) ? blueprint.forms : []
  const bucketedForms = new Map<string, typeof normalizedForms>()

  for (const form of normalizedForms) {
    const bucketKey = String(form?.formKey || '').trim()
      ? `form:${String(form?.formKey || '').trim()}`
      : `target:${getNocodeEditorBlueprintFormApplyTargetIdentity(form)}`
    const currentBucket = bucketedForms.get(bucketKey) || []
    currentBucket.push(form)
    bucketedForms.set(bucketKey, currentBucket)
  }

  return {
    ...blueprint,
    forms: [...bucketedForms.values()].flatMap(forms => (
      mergeSingleFormBlueprintFragments(forms)
    )) as T['forms'],
  }
}

const canContinueAfterNavigationPersistence = (result: { mode?: string } | null | undefined) => (
  result?.mode === 'saved'
  || result?.mode === 'unchanged'
  || result?.mode === 'draft_only'
)

const normalizeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const isSameToken = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeToken(left)
  const normalizedRight = normalizeToken(right)
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight
}

const valuesEqual = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

const createBlueprintId = () => `bp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const createSolutionOutlineId = () => `sol-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

const buildFieldToolDraftRefreshOutput = (
  draftState?: NocodeEditorAiDraftPersistenceRefreshResult,
): NocodeEditorAiFieldToolDraftRefreshOutput => ({
  draftPersistenceState: draftState?.draftPersistenceState || null,
  draftRefreshOk: Boolean(draftState?.draftRefreshOk),
  ...(draftState?.draftPersistenceState?.mode === 'draft_only' ? { persistenceMode: 'draft_only' } : {}),
  partialOk: !draftState?.draftRefreshOk ? true : undefined,
  draftRefreshError: draftState?.draftRefreshError,
})

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

const normalizeOptionPath = (change: Record<string, any> | null | undefined) => {
  if (Array.isArray(change?.path) && change!.path.length) {
    return change.path.map(item => String(item || '').trim()).filter(Boolean)
  }
  const key = String(change?.key || '').trim()
  return key ? [key] : []
}

const isFormulaSettingPath = (path: string[]) => {
  const normalizedPath = path.join('.')
  return normalizedPath === 'default-formula'
    || normalizedPath === 'compute-formula'
}

const hasFormulaSettingChanges = (input: Record<string, any> | null | undefined) => {
  const changes = [
    ...(Array.isArray(input?.changes) ? input.changes : []),
    ...(Array.isArray(input?.items)
      ? input.items.flatMap((item: Record<string, any>) => (
        Array.isArray(item?.changes) ? item.changes : []
      ))
      : []),
  ]
  return changes.some(change => {
    const path = normalizeOptionPath(change)
    return isFormulaSettingPath(path)
      || path.some(part => part === 'default-formula' || part === 'compute-formula')
  })
}

const BARE_FORMULA_FIELD_TOKEN_RE = /(^|[^A-Za-z0-9_\u4e00-\u9fa5])([a-z][a-z0-9_]{5,}(?:\.[a-z][a-z0-9_]{5,})?)(?!\s*\()/g

const normalizeFormulaSettingValue = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return String((value as Record<string, any>).formula || '').trim()
  }
  return ''
}

const findFormulaSettingChange = (changes: Array<Record<string, any>>) => {
  for (const change of changes) {
    const path = normalizeOptionPath(change)
    if (!isFormulaSettingPath(path)) {
      continue
    }

    const formula = normalizeFormulaSettingValue(change?.value)
    if (!formula) {
      continue
    }

    return {
      change,
      path,
      formula,
      formulaPath: path.join('.') as 'default-formula' | 'compute-formula',
    }
  }

  return null
}

const findBareFormulaFieldTokens = (formula: string) => {
  const inspectText = String(formula || '')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/"[^"]*"|'[^']*'/g, ' ')
  const tokens: string[] = []
  let match: RegExpExecArray | null
  while ((match = BARE_FORMULA_FIELD_TOKEN_RE.exec(inspectText))) {
    tokens.push(match[2])
  }
  return Array.from(new Set(tokens))
}

const assertValidFormulaFieldReferenceFormat = (
  changes: Array<Record<string, any>>,
  fieldLabel: string,
) => {
  for (const change of changes) {
    if (!isFormulaSettingPath(normalizeOptionPath(change))) {
      continue
    }
    const formula = normalizeFormulaSettingValue(change?.value)
    const bareTokens = findBareFormulaFieldTokens(formula)
    if (bareTokens.length) {
      throw new Error(
        `字段 ${fieldLabel} 的公式引用格式不正确：${bareTokens.join('、')}。字段引用必须使用 [[字段token,字段标题]] 完整格式，不要只传字段 id 或 widgetId。`,
      )
    }
  }
}

const isPlainRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

type NocodeEditorAiSolutionOutlineWithConfirmation = NocodeEditorAiSolutionOutline & {
  confirmation?: NocodeEditorAiConfirmPayload | null
}

const resolveAppPlanOutlineConfirmation = (
  plan?: Pick<NocodeEditorAiAppPlan, 'outline'> | null,
) => (
  ((plan?.outline as NocodeEditorAiSolutionOutlineWithConfirmation | null | undefined)?.confirmation) || null
)

const hasMeaningfulBlueprintSource = (value: unknown) => {
  if (!value || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  return ['formKey', 'formName', 'fieldKey', 'fieldName']
    .some(key => String(source[key] || '').trim().length > 0)
}

export const mergeBlueprintOpenQuestions = (...values: unknown[]) => Array.from(new Set(
  values.flatMap(value => normalizeStringArray(value)),
))

export const subtractBlueprintOpenQuestions = (source: unknown, resolved: unknown) => {
  const resolvedSet = new Set(normalizeStringArray(resolved))
  return normalizeStringArray(source).filter(question => !resolvedSet.has(question))
}

const resolveBlueprintPlanningCarryover = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
) => resolveNocodeEditorBlueprintPlanningCarryover(confirmation)

const resolveBlueprintPlanningCarryoverFromOutline = (
  outline?: NocodeEditorAiSolutionOutline | null,
) => {
  return resolveBlueprintPlanningCarryover(
    ((outline as NocodeEditorAiSolutionOutlineWithConfirmation | null | undefined)?.confirmation) || null,
  )
}

const isBlueprintFieldClarificationQuestion = (question: string) => {
  const normalizedQuestion = String(question || '').trim()
  if (!normalizedQuestion) {
    return false
  }

  return [
    /^“.*”这类字段通常来自其他表单数据。请确认它要关联哪个表单、显示哪个字段？$/,
    /^“.*”是一个多选集合字段。.*请确认 source；如果是自定义选项，请明确需要哪些值。$/,
    /^“.*”需要记录单个时间点、时间范围，还是仅记录时分秒？$/,
    /^“.*”更适合上传图片证据，还是通用文件附件？$/,
    /^“.*”需要作为流程节点自动选人，还是只是表单展示字段？$/,
    /^“.*”是要选择一个部门，还是选择该部门对应的负责人成员？$/,
    /^“.*”是组织内成员，还是业务档案中的负责人？$/,
    /^这里的“.*”是组织内成员，还是业务档案中的人员？$/,
  ].some(pattern => pattern.test(normalizedQuestion))
}

const pickFirstDefined = <T,>(...values: Array<T | undefined>) => values.find(value => value !== undefined)

const normalizeBlueprintIdentityToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s\-_/\\]/g, '')
  .replace(/[？?！!，,。、“”"'‘’：:；;（）()【】\[\]《》<>]/g, '')

const GENERIC_BLUEPRINT_WIDGET_TYPES = new Set([
  '',
  'widget.form.textInput',
  'widget.form.numberInput',
])

const MASTER_FORM_SUFFIX_REGEXP = /(档案|信息|管理|资料|台账|列表|清单|字典|基础数据|基础资料|主数据|记录|表单|表)$/
const RELATION_FIELD_PREFIX_REGEXP = /^(所属|关联|选择|对应|目标|默认|来源|参考|引用|绑定)/
const RELATION_FIELD_SUFFIX_REGEXP = /(名称|姓名|信息|资料|id|Id|ID)$/
const DEFAULT_OUTLINE_GROUP_NAME = '未分组'

const normalizeEnumOptions = (value: unknown): NocodeEditorAiBlueprintOption[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const normalized = item.trim()
        if (!normalized) return null
        return {
          label: normalized,
          value: normalized,
        }
      }
      if (!item || typeof item !== 'object') return null
      const label = String((item as any).label || (item as any).value || '').trim()
      const optionValue = String((item as any).value || (item as any).label || '').trim()
      if (!label || !optionValue) return null
      return {
        label,
        value: optionValue,
      }
    })
    .filter(Boolean) as NocodeEditorAiBlueprintOption[]
}

const VALIDATION_FORMAT_VALUE_MAP: Record<string, string> = {
  none: 'none',
  mobilephone: 'mobile-phone',
  cellphone: 'mobile-phone',
  phone: 'mobile-phone',
  telephone: 'telephone',
  landline: 'telephone',
  idnumber: 'ID-number',
  idcard: 'ID-number',
  identitycard: 'ID-number',
  email: 'email',
  mail: 'email',
  licenseplate: 'license-plate',
}

const normalizeValidationFormat = (value: unknown) => {
  const normalized = normalizeToken(value)
  if (!normalized) return undefined
  return VALIDATION_FORMAT_VALUE_MAP[normalized]
    || VALIDATION_FORMAT_VALUE_MAP[normalized.replace(/号码|号|格式/g, '')]
    || undefined
}

type BlueprintSourceField = Record<string, any>
type BlueprintFieldBuildContext = {
  tableMap?: Map<string, Table>
  widgetMap?: Map<string, Record<string, any>>
}

const getWidgetTreeChildren = (widget: Record<string, any>) => {
  const children = Array.isArray(widget?.children) ? widget.children : []
  if (children.length) {
    return children
  }
  return Array.isArray(widget?.widgets) ? widget.widgets : []
}

const getBlueprintFieldExtra = (field: BlueprintSourceField) => {
  const metaExtra = field?.meta?.extra
  if (metaExtra && typeof metaExtra === 'object') {
    return metaExtra as Record<string, any>
  }
  const rawExtra = field?.extra
  if (rawExtra && typeof rawExtra === 'object') {
    return rawExtra as Record<string, any>
  }
  return {}
}

const getBlueprintFieldName = (field: BlueprintSourceField) => String(
  field?.alias
  || field?.meta?.name
  || field?.name
  || '',
).trim()

const getBlueprintFieldMetaUid = (field: BlueprintSourceField) => String(
  field?.meta?.uid
  || field?.uid
  || '',
).trim()

const normalizeBlueprintFieldPlaceholder = (
  field: BlueprintSourceField,
  widget?: Record<string, any> | null,
) => {
  const extra = getBlueprintFieldExtra(field)
  const widgetOptions = widget?.options && typeof widget.options === 'object'
    ? widget.options
    : {}
  const placeholder = String(extra.placeholder || widgetOptions.placeholder || '').trim()
  return placeholder || undefined
}

const inferValidationFormat = (name: string, current?: unknown) => {
  const normalizedCurrent = normalizeValidationFormat(current)
  if (normalizedCurrent) {
    return normalizedCurrent
  }

  if (/(邮箱|电子邮箱|e-?mail|email)/i.test(name)) {
    return 'email'
  }

  if (/(身份证|身份证号|居民身份证|id\s*card|identity)/i.test(name)) {
    return 'ID-number'
  }

  return undefined
}

const getRawBlueprintFieldChildren = (field: Record<string, any>) => {
  const candidates = [field?.children, field?.subFields, field?.fields, field?.widgets]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }
  return []
}

const isGenericBlueprintWidgetType = (value: unknown) => GENERIC_BLUEPRINT_WIDGET_TYPES.has(resolveExplicitBlueprintWidgetType(value))

const guessWidgetType = (
  field: Record<string, any>,
  context?: {
    resolvedSource?: Record<string, any> | null
    formName?: string
    planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null
  },
) => {
  const explicitWidgetType = resolveExplicitBlueprintWidgetType(field?.widgetType)
  const name = String(field?.name || '').trim()
  if (!name) {
    return 'widget.form.textInput'
  }

  const description = String(field?.description || '').trim()
  const notes = normalizeStringArray(field?.notes)
  const fieldText = [name, description, ...notes].join(' ')
  const children = Array.isArray(field?.children) ? field.children : getRawBlueprintFieldChildren(field)
  const hasResolvedSource = hasMeaningfulBlueprintSource(context?.resolvedSource) || hasMeaningfulBlueprintSource(field?.source)
  const canResolveRelationSource = hasMeaningfulBlueprintSource(context?.resolvedSource)
  const enumOptions = normalizeEnumOptions(field?.enumOptions)

  if (children.length || /(明细|子项|条目|清单)(表|列表)?$/i.test(name)) {
    return 'widget.form.subform'
  }

  if (/(签名|手写签名|签字|signature|handwritten)/i.test(fieldText)) {
    return 'widget.form.handwrittenSignature'
  }

  if (hasResolvedSource && (isGenericBlueprintWidgetType(explicitWidgetType) || !explicitWidgetType)) {
    return 'widget.form.treeSelect'
  }

  const shouldDeferExplicitTreeSelectToIntent = (
    explicitWidgetType === 'widget.form.treeSelect'
    && !hasResolvedSource
  )

  if (
    explicitWidgetType
    && !isGenericBlueprintWidgetType(explicitWidgetType)
    && !shouldDeferExplicitTreeSelectToIntent
  ) {
    return explicitWidgetType
  }

  const intentDecision = inferBlueprintFieldIntent({
    formName: String(context?.formName || '').trim(),
    fieldName: name,
    explicitWidgetType,
    description,
    notes,
    hasSource: hasResolvedSource,
    canResolveRelationSource,
    hasChildren: children.length > 0,
    enumOptionsCount: enumOptions.length,
    planningCarryover: context?.planningCarryover,
  })

  if (
    intentDecision.trustedExplicitWidgetType
    && intentDecision.trustedExplicitWidgetType === explicitWidgetType
  ) {
    return explicitWidgetType
  }
  if (intentDecision.requiresClarification) {
    return undefined
  }
  if (intentDecision.widgetType) {
    return intentDecision.widgetType
  }
  if (intentDecision.intent === 'free-text-name') {
    return 'widget.form.textInput'
  }

  if (/(地址|住址|所在地|收货地址|发货地址|联系地址|配送地址)/.test(fieldText)) {
    return 'widget.form.address'
  }

  if (/(金额|单价|总价|售价|进价|成本价|成本金额|合计金额|应收|应付|实收|实付|优惠金额|税额|余额)/.test(fieldText)) {
    return 'widget.form.amountInput'
  }

  if (/(编号|编码|单号|单据号|流水号|序号)$/.test(name) && !/(身份证|手机号|电话|邮编|工号|学号|卡号|证号)/.test(name)) {
    return 'widget.form.serialNumber'
  }

  if (/(是否启用|是否加急|是否通过|是否公开|是否默认|是否可见|是否允许)/.test(fieldText)) {
    return /(是否通过|是\/否|通过\/不通过)/.test(fieldText)
      ? 'widget.form.radioGroup'
      : 'widget.form.switch'
  }

  if (hasResolvedSource && /(标签|技能|角色|适用范围|参与角色|覆盖区域|适用品类)/.test(fieldText)) {
    return 'widget.form.treeMultipleSelect'
  }

  if (/(时间范围|日期范围|起止时间|起止日期|开始至结束|开始时间到结束时间|开始日期到结束日期)/.test(fieldText)) {
    return 'widget.form.dateRangePicker'
  }

  if (/(上课时间|营业时间|时间段|时分秒|钟点|几点|上班时间|下班时间|班次时间)/.test(fieldText)) {
    return 'widget.form.timePicker'
  }

  if (/(现场照片|图片|截图|头像|封面|证件照|照片)/.test(fieldText)) {
    return 'widget.form.image-uploader'
  }

  if (/(合同附件|报销凭证|证明材料|上传文件|文件附件|资料附件|证件材料|审批附件|附件材料)/.test(fieldText)) {
    return 'widget.form.file-uploader'
  }

  if (/^.+附件$/.test(name)) {
    return 'widget.form.file-uploader'
  }

  if (enumOptions.length) {
    if (/(标签|技能|角色|适用范围|参与角色|覆盖区域|适用品类)/.test(fieldText)) {
      return 'widget.form.checkboxGroup'
    }
    return enumOptions.length <= 4 ? 'widget.form.radioGroup' : 'widget.form.treeSelect'
  }

  if (/(手机|电话|联系方式|联系电话)/.test(name)) {
    return 'widget.form.phoneInput'
  }
  if (/(日期|时间|生日|入职日期|下单日期|采购日期|出库日期|入库日期|交货日期)/.test(fieldText)) {
    return 'widget.form.datePicker'
  }
  if (/(备注|说明|描述|详情|原因|摘要)/.test(fieldText)) {
    return 'widget.form.textarea'
  }
  if (/(学分|学时|数量|库存|件数|箱数|分数|总分|次数|天数|重量|率)/.test(fieldText)) {
    return 'widget.form.numberInput'
  }
  if (/(性别|状态|类型|性质|类别)/.test(name)) {
    return 'widget.form.radioGroup'
  }
  if (/^(所属|关联|选择)?(院系|店铺|门店|负责人)$/.test(name) || /(所属院系)/.test(name)) {
    return 'widget.form.treeSelect'
  }
  return explicitWidgetType || 'widget.form.textInput'
}

const normalizeBlueprintField = (
  field: Record<string, any>,
  context: {
    fieldIndex: number
    keyPrefix: string
  },
): NocodeEditorAiAppBlueprintField | null => {
  const name = String(field?.name || '').trim()
  if (!name) return null

  const fieldKey = String(field?.fieldKey || '').trim() || undefined
  const children = getRawBlueprintFieldChildren(field)
    .map((child, childIndex) => normalizeBlueprintField(child, {
      fieldIndex: childIndex,
      keyPrefix: `${context.keyPrefix}${context.fieldIndex + 1}-child-`,
    }))
    .filter(Boolean) as NocodeEditorAiAppBlueprintField[]
  const enumOptions = normalizeEnumOptions(field?.enumOptions)
  const widgetType = guessWidgetType({
    ...(field || {}),
    enumOptions,
    children,
  })

  return {
    fieldKey,
    name,
    widgetType,
    description: String(field?.description || '').trim() || undefined,
    required: typeof field?.required === 'boolean' ? field.required : undefined,
    placeholder: String(field?.placeholder || '').trim() || undefined,
    validationFormat: inferValidationFormat(name, field?.validationFormat),
    enumOptions,
    defaultValue: normalizeBlueprintDefaultValue(field?.defaultValue),
    source: field?.source && typeof field.source === 'object'
      ? {
        formKey: String(field.source.formKey || '').trim() || undefined,
        formName: String(field.source.formName || '').trim() || undefined,
        fieldKey: String(field.source.fieldKey || '').trim() || undefined,
        fieldName: String(field.source.fieldName || '').trim() || undefined,
      }
      : undefined,
    formulaSettings: field?.formulaSettings !== undefined
      ? cloneValue(field.formulaSettings) as any
      : undefined,
    excelSource: field?.excelSource && typeof field.excelSource === 'object'
      ? {
        excelField: String(field.excelSource.excelField || '').trim() as `col-${number}`,
        title: String(field.excelSource.title || '').trim(),
        type: String(field.excelSource.type || '').trim() || undefined,
        parentExcelField: String(field.excelSource.parentExcelField || '').trim() as `col-${number}` || undefined,
      }
      : undefined,
    children: children.length ? children : undefined,
    notes: normalizeStringArray(field?.notes),
  }
}

const normalizeBlueprint = (
  input: Record<string, any>,
  options: { allowEmptyForms?: boolean } = {},
): NocodeEditorAiAppBlueprint => {
  const rawBlueprint = (input?.blueprint && typeof input.blueprint === 'object')
    ? input.blueprint
    : input
  const rawForms = Array.isArray(rawBlueprint?.forms) ? rawBlueprint.forms : []
  const forms = rawForms
    .map((form, formIndex) => {
      const tableName = String(form?.tableName || form?.name || '').trim()
      if (!tableName) return null
      const fields = (Array.isArray(form?.fields) ? form.fields : [])
        .map((field, fieldIndex) => normalizeBlueprintField(field, {
          fieldIndex,
          keyPrefix: `field-${formIndex + 1}-`,
        }))
        .filter(Boolean) as NocodeEditorAiAppBlueprint['forms'][number]['fields']

      return {
        formKey: String(form?.formKey || '').trim() || undefined,
        tableName,
        groupName: String(form?.groupName || '').trim() || undefined,
        description: String(form?.description || '').trim() || undefined,
        excelImportContext: form?.excelImportContext?.source && typeof form.excelImportContext === 'object'
          ? {
            source: {
              kind: 'excel',
              fileName: String(form.excelImportContext.source.fileName || '').trim(),
              worksheet: String(form.excelImportContext.source.worksheet || '').trim(),
              titleRowIndex: Number(form.excelImportContext.source.titleRowIndex || 0),
              uploadSourceType: String(form.excelImportContext.source.uploadSourceType || '').trim() as 'excel' | 'zip' | '' || undefined,
            },
            formKey: String(form.excelImportContext.formKey || form?.formKey || tableName).trim(),
            tableName: String(form.excelImportContext.tableName || tableName).trim(),
            columns: Array.isArray(form.excelImportContext.columns)
              ? form.excelImportContext.columns.map((column: Record<string, any>) => ({
                excelField: String(column.excelField || '').trim() as `col-${number}`,
                fieldKey: String(column.fieldKey || '').trim(),
                fieldName: String(column.fieldName || '').trim(),
                parentExcelField: String(column.parentExcelField || '').trim() as `col-${number}` || undefined,
                parentFieldKey: String(column.parentFieldKey || '').trim() || undefined,
              })).filter((column: Record<string, any>) => column.excelField && column.fieldKey && column.fieldName)
              : [],
          }
          : undefined,
        fields,
      }
    })
    .filter(Boolean) as NocodeEditorAiAppBlueprint['forms']

  const mergedForms = mergeSingleFormBlueprintFragments(forms)

  if (!mergedForms.length && !options.allowEmptyForms) {
    throw new Error('蓝图至少需要包含一个表单')
  }

  return enhanceBlueprint({
    id: String(rawBlueprint?.id || '').trim() || undefined,
    title: String(rawBlueprint?.title || '').trim() || undefined,
    summary: String(rawBlueprint?.summary || '').trim() || undefined,
    forms: mergedForms,
    assumptions: normalizeStringArray(rawBlueprint?.assumptions),
    openQuestions: normalizeStringArray(rawBlueprint?.openQuestions),
    ...(
      rawBlueprint?.confirmation && typeof rawBlueprint.confirmation === 'object'
        ? { confirmation: cloneValue(rawBlueprint.confirmation) }
        : {}
    ),
  })
}

const normalizeOutlineGroupName = (value: unknown) => String(value || '').trim()

const shouldCarryBlueprintFormGroupName = (options: {
  groupName?: unknown
  groupNameExplicit?: unknown
  blueprintFormCount?: number
  outlineFormCount?: number
  moduleCount?: number
}) => {
  const groupName = String(options.groupName || '').trim()
  if (!groupName) {
    return false
  }

  const blueprintFormCount = Number(options.blueprintFormCount || 0)
  const outlineFormCount = Number(options.outlineFormCount || 0)
  const moduleCount = Number(options.moduleCount || 0)

  return (
    options.groupNameExplicit === true
    || blueprintFormCount > 1
    || outlineFormCount > 1
    || moduleCount > 1
  )
}

const normalizeOutlineForm = (
  form: Record<string, any>,
  index: number,
): NocodeEditorAiSolutionOutlineForm | null => {
  const tableName = String(form?.tableName || form?.name || '').trim()
  if (!tableName) return null

  return {
    formKey: String(form?.formKey || `form-${index + 1}`).trim(),
    tableName,
    groupName: normalizeOutlineGroupName(form?.groupName || form?.moduleName || form?.group) || undefined,
    groupNameExplicit: form?.groupNameExplicit === true,
    description: String(form?.description || '').trim() || undefined,
  }
}

const buildOutlineFormKeyMap = (forms: NocodeEditorAiSolutionOutlineForm[]) => {
  return buildNocodeEditorPlanningFormReferenceIndex(forms)
}

const deriveOutlineModulesFromForms = (
  forms: NocodeEditorAiSolutionOutlineForm[],
): NocodeEditorAiSolutionOutlineModule[] => {
  const groups = new Map<string, NocodeEditorAiSolutionOutlineModule>()
  for (const form of forms) {
    const groupName = String(form.groupName || DEFAULT_OUTLINE_GROUP_NAME).trim() || DEFAULT_OUTLINE_GROUP_NAME
    const moduleKey = `module-${groups.size + 1}`
    const existing = groups.get(groupName)
    if (existing) {
      existing.formKeys = [...(existing.formKeys || []), String(form.formKey || '').trim()].filter(Boolean)
      continue
    }
    groups.set(groupName, {
      moduleKey,
      name: groupName,
      formKeys: [String(form.formKey || '').trim()].filter(Boolean),
    })
  }
  return Array.from(groups.values())
}

const normalizeOutlineFlows = (
  value: unknown,
  forms: NocodeEditorAiSolutionOutlineForm[],
): NocodeEditorAiSolutionOutlineFlow[] => {
  if (!Array.isArray(value)) return []

  const formKeyMap = buildOutlineFormKeyMap(forms)
  const result: NocodeEditorAiSolutionOutlineFlow[] = []
  const appended = new Set<string>()

  const pickFirstReference = (values: unknown[]) => (
    values.find(value => String(value || '').trim())
  )
  const resolveEndpoint = (options: {
    canonical: unknown[]
    alias: unknown[]
    generic: unknown[]
  }) => {
    const canonical = pickFirstReference(options.canonical)
    if (canonical !== undefined) {
      return resolveNocodeEditorPlanningCanonicalFormKey(formKeyMap, canonical)
    }
    const alias = pickFirstReference(options.alias)
    if (alias !== undefined) {
      return resolveNocodeEditorPlanningFormAlias(formKeyMap, alias)
    }
    return resolveNocodeEditorPlanningGenericFormReference(
      formKeyMap,
      pickFirstReference(options.generic),
    )
  }

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    const from = resolveEndpoint({
      canonical: [record.fromFormKey, record.sourceFormKey],
      alias: [record.fromTableName, record.sourceTableName],
      generic: [record.from, record.source],
    })
    const to = resolveEndpoint({
      canonical: [record.toFormKey, record.targetFormKey],
      alias: [record.toTableName, record.targetTableName],
      generic: [record.to, record.target],
    })
    if (!from || !to || from === to) {
      continue
    }
    const key = `${from}::${to}::${String(record.label || '').trim()}`
    if (appended.has(key)) {
      continue
    }
    appended.add(key)
    result.push({
      from,
      to,
      label: String(record.label || record.name || '').trim() || undefined,
    })
  }

  return result
}

const normalizeSolutionOutline = (
  input: Record<string, any>,
  titleFallback = '应用结构',
): NocodeEditorAiSolutionOutline => {
  const rawOutline = (input?.outline && typeof input.outline === 'object')
    ? input.outline
    : input
  const forms = (Array.isArray(rawOutline?.forms) ? rawOutline.forms : [])
    .map((form, formIndex) => normalizeOutlineForm(form, formIndex))
    .filter(Boolean) as NocodeEditorAiSolutionOutlineForm[]

  if (!forms.length) {
    throw new Error('规划至少需要包含一个表单')
  }

  const formKeyMap = buildOutlineFormKeyMap(forms)
  const modules = (
    Array.isArray(rawOutline?.modules) ? rawOutline.modules : Array.isArray(rawOutline?.groups) ? rawOutline.groups : []
  )
    .map((module, moduleIndex) => {
      const name = String(module?.name || module?.groupName || '').trim()
      if (!name) return null
      const usesCanonicalKeys = Array.isArray(module?.formKeys)
      const explicitRefs = usesCanonicalKeys
        ? module.formKeys
        : Array.isArray(module?.formNames) ? module.formNames : []
      const resolveFormReference = usesCanonicalKeys
        ? resolveNocodeEditorPlanningCanonicalFormKey
        : resolveNocodeEditorPlanningFormAlias
      const formKeys = explicitRefs
        .map((item: unknown) => resolveFormReference(formKeyMap, item))
        .filter(Boolean)
      return {
        moduleKey: String(module?.moduleKey || `module-${moduleIndex + 1}`).trim(),
        name,
        description: String(module?.description || '').trim() || undefined,
        color: String(module?.color || '').trim() || undefined,
        formKeys,
      }
    })
    .filter(Boolean) as NocodeEditorAiSolutionOutlineModule[]

  const normalizedModules = modules.length ? modules : deriveOutlineModulesFromForms(forms)
  const flows = normalizeOutlineFlows(rawOutline?.flows || rawOutline?.links || rawOutline?.relations, forms)

  const normalizedOutline = Object.assign({
    id: String(rawOutline?.id || createSolutionOutlineId()).trim(),
    title: String(rawOutline?.title || titleFallback).trim() || titleFallback,
    summary: String(rawOutline?.summary || '').trim() || undefined,
    forms,
    modules: normalizedModules,
    flows,
    assumptions: normalizeStringArray(rawOutline?.assumptions),
    openQuestions: normalizeStringArray(rawOutline?.openQuestions),
    flowIntent: normalizeNocodeEditorFlowIntentSignal(rawOutline?.flowIntent || input?.flowIntent),
  }, (
    rawOutline?.confirmation && typeof rawOutline.confirmation === 'object'
      ? { confirmation: cloneValue(rawOutline.confirmation) }
      : {}
  ))

  return normalizedOutline as NocodeEditorAiSolutionOutline
}

const shouldEnableFormPlanStructurePreview = (options: {
  outline?: NocodeEditorAiSolutionOutline | null
  relationAnalysis?: NocodeEditorRelationSignalAnalysis | null
}) => {
  const outline = options.outline
  if (!outline) {
    return false
  }

  if (Array.isArray(outline.flows) && outline.flows.length > 0) {
    return true
  }

  if (Array.isArray(outline.forms) && outline.forms.length > 1) {
    return true
  }

  return String(options.relationAnalysis?.signalLevel || '').trim() === 'strong'
}

const buildApplicationStructurePreview = (options: {
  outline?: NocodeEditorAiSolutionOutline | null
  previewMode: NocodeEditorAiApplicationStructurePreview['previewMode']
  enabled: boolean
}): NocodeEditorAiApplicationStructurePreview | null => {
  if (!options.enabled || !options.outline) {
    return null
  }

  const outline = options.outline
  return {
    enabled: true,
    previewMode: options.previewMode,
    focusFormKey: String(outline.forms?.[0]?.formKey || '').trim() || undefined,
    focusFormName: String(outline.forms?.[0]?.tableName || '').trim() || undefined,
    highlightModuleKeys: Array.isArray(outline.modules)
      ? outline.modules
        .map(item => String(item?.moduleKey || item?.name || '').trim())
        .filter(Boolean)
      : [],
  }
}

const buildFallbackAppPlanOutlineInput = (options: {
  goal: string
  objects: string[]
  artifacts: Array<{
    type?: string
    name: string
    purpose?: string
  }>
  openQuestions: string[]
}) => {
  const forms = options.artifacts
    .map((artifact, index) => {
      const tableName = String(artifact?.name || '').trim()
      if (!tableName) {
        return null
      }

      return {
        formKey: `artifact-${index + 1}`,
        tableName,
        description: String(artifact?.purpose || '').trim() || undefined,
      }
    })
    .filter(Boolean) as NocodeEditorAiSolutionOutlineForm[]

  return {
    title: options.goal ? `${options.goal}应用结构` : '应用结构',
    summary: options.objects.length
      ? `围绕 ${options.objects.slice(0, 4).join('、')} 梳理当前应用结构。`
      : undefined,
    forms,
    modules: forms.length
      ? [{
        moduleKey: 'module-1',
        name: options.goal || '整体结构',
        description: options.objects.length
          ? `围绕 ${options.objects.slice(0, 4).join('、')} 梳理当前应用结构`
          : undefined,
        formKeys: forms.map(item => item.formKey),
      }]
      : [],
    openQuestions: options.openQuestions,
  }
}

const hasRenderableOutlineForms = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const forms = Array.isArray((value as Record<string, any>).forms)
    ? (value as Record<string, any>).forms
    : []

  return forms.some(form => String(form?.tableName || form?.name || '').trim())
}

const mergeAppPlanOutlineForms = (
  rawForms: unknown,
  fallbackForms: Array<Record<string, any>>,
) => {
  const normalizedRawForms = Array.isArray(rawForms)
    ? rawForms
      .map((form, formIndex) => normalizeOutlineForm(form, formIndex))
      .filter((item): item is NocodeEditorAiSolutionOutlineForm => Boolean(item))
    : []

  if (!normalizedRawForms.length) {
    return fallbackForms
      .map((form, index) => normalizeOutlineForm(form, index))
      .filter((item): item is NocodeEditorAiSolutionOutlineForm => Boolean(item))
  }

  const mergedForms = [...normalizedRawForms]
  const seenTableNames = new Set(
    mergedForms
      .map(form => normalizeToken(form.tableName))
      .filter(Boolean),
  )

  for (const form of fallbackForms) {
    const tableName = String(form?.tableName || '').trim()
    const normalizedTableName = normalizeToken(tableName)
    if (!normalizedTableName || seenTableNames.has(normalizedTableName)) {
      continue
    }
    const normalizedFallbackForm = normalizeOutlineForm(form, mergedForms.length)
    if (!normalizedFallbackForm) {
      continue
    }
    mergedForms.push(normalizedFallbackForm)
    seenTableNames.add(normalizedTableName)
  }

  return mergedForms
}

const resolveAppPlanOutlineInput = (options: {
  rawOutline: unknown
  fallbackOutline: Record<string, any>
}) => {
  const rawOutline = options.rawOutline && typeof options.rawOutline === 'object' && !Array.isArray(options.rawOutline)
    ? options.rawOutline as Record<string, any>
    : null

  if (!rawOutline) {
    return options.fallbackOutline
  }

  return {
    ...options.fallbackOutline,
    ...rawOutline,
    title: String(rawOutline.title || options.fallbackOutline.title || '').trim() || options.fallbackOutline.title,
    summary: String(rawOutline.summary || options.fallbackOutline.summary || '').trim() || options.fallbackOutline.summary,
    forms: hasRenderableOutlineForms(rawOutline)
      ? mergeAppPlanOutlineForms(rawOutline.forms, options.fallbackOutline.forms)
      : options.fallbackOutline.forms,
    modules: Array.isArray(rawOutline.modules) && rawOutline.modules.length
      ? rawOutline.modules
      : options.fallbackOutline.modules,
    flows: Array.isArray(rawOutline.flows) && rawOutline.flows.length
      ? rawOutline.flows
      : options.fallbackOutline.flows,
    openQuestions: Array.from(new Set([
      ...(Array.isArray(options.fallbackOutline.openQuestions) ? options.fallbackOutline.openQuestions : []),
      ...(Array.isArray(rawOutline.openQuestions) ? rawOutline.openQuestions : []),
    ])),
    confirmation: rawOutline.confirmation || options.fallbackOutline.confirmation,
  }
}

const flattenWidgetTree = (widgets: Array<Record<string, any>> = []) => {
  const result: Array<Record<string, any>> = []
  const visit = (items: Array<Record<string, any>>) => {
    for (const item of items) {
      result.push(item)
      const childWidgets = getWidgetTreeChildren(item)
      if (childWidgets.length) {
        visit(childWidgets)
      }
    }
  }
  visit(widgets)
  return result
}

type BlueprintReadDetail = 'status' | 'structure'

const normalizeBlueprintReadDetail = (value: unknown): BlueprintReadDetail | '' => {
  const normalized = String(value || '').trim()
  return normalized === 'status' || normalized === 'structure' ? normalized : ''
}

const compactStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
)

const compactEnumOptionsSummary = (value: unknown) => {
  const enumOptions = normalizeEnumOptions(value)
  if (!enumOptions.length) {
    return undefined
  }
  return {
    count: enumOptions.length,
    preview: enumOptions.slice(0, 12).map(item => ({
      label: item.label,
      value: item.value,
    })),
  }
}

const countBlueprintFields = (fields: NocodeEditorAiAppBlueprintField[] = []): number => (
  fields.reduce((total, field) => total + 1 + countBlueprintFields(getBlueprintFieldChildren(field)), 0)
)

const compactBlueprintFieldSource = (source: NocodeEditorAiBlueprintFieldSource | undefined) => {
  if (!source || typeof source !== 'object') {
    return undefined
  }
  const result = {
    formKey: String(source.formKey || '').trim() || undefined,
    formName: String(source.formName || '').trim() || undefined,
    tableId: String((source as any).tableId || '').trim() || undefined,
    tableName: String((source as any).tableName || '').trim() || undefined,
    fieldKey: String(source.fieldKey || '').trim() || undefined,
    fieldName: String(source.fieldName || '').trim() || undefined,
  }
  return Object.values(result).some(Boolean) ? result : undefined
}

const compactBlueprintField = (
  field: NocodeEditorAiAppBlueprintField,
  parentKey = '',
): Record<string, any> => {
  const children = getBlueprintFieldChildren(field)
  const enumOptions = compactEnumOptionsSummary(field.enumOptions)
  return {
    uid: String(field.fieldKey || field.name || '').trim(),
    fieldKey: String(field.fieldKey || '').trim() || undefined,
    name: String(field.name || '').trim(),
    widgetType: String(field.widgetType || '').trim() || undefined,
    required: typeof field.required === 'boolean' ? field.required : undefined,
    readonly: (field as any).readonly === true || undefined,
    parent: parentKey || undefined,
    source: compactBlueprintFieldSource(field.source),
    excelSource: field.excelSource
      ? {
        excelField: String(field.excelSource.excelField || '').trim() || undefined,
        title: String(field.excelSource.title || '').trim() || undefined,
        type: String(field.excelSource.type || '').trim() || undefined,
        parentExcelField: String(field.excelSource.parentExcelField || '').trim() || undefined,
      }
      : undefined,
    enumOptions,
    childCount: children.length || undefined,
    children: children.length
      ? children.map(child => compactBlueprintField(child, String(field.fieldKey || field.name || '').trim()))
      : undefined,
  }
}

const compactBlueprintStructure = (blueprint: NocodeEditorAiAppBlueprint | null | undefined) => {
  if (!blueprint) {
    return null
  }
  const forms = Array.isArray(blueprint.forms) ? blueprint.forms : []
  return {
    id: String(blueprint.id || '').trim() || undefined,
    title: String(blueprint.title || '').trim() || undefined,
    summary: String(blueprint.summary || '').trim() || undefined,
    forms: forms.map((form) => {
      const fields = Array.isArray(form.fields) ? form.fields : []
      return {
        formKey: String(form.formKey || '').trim() || undefined,
        tableId: String((form as any).tableId || '').trim() || undefined,
        tableName: String(form.tableName || '').trim(),
        groupName: String(form.groupName || '').trim() || undefined,
        description: String(form.description || '').trim() || undefined,
        excelImportContext: compactExcelImportContextForModel(form),
        fieldCount: countBlueprintFields(fields),
        fields: fields.map(field => compactBlueprintField(field)),
      }
    }),
    assumptions: compactStringList(blueprint.assumptions),
    openQuestions: compactStringList(blueprint.openQuestions),
  }
}

const compactApplyResult = (result: NocodeEditorAiBlueprintApplyResult | null | undefined) => {
  if (!result || typeof result !== 'object') {
    return null
  }
  return {
    planningScope: normalizeNocodeEditorPlanningScopeValue(result.planningScope),
    ok: Boolean(result.ok),
    persistenceMode: result.persistenceMode || undefined,
    blueprintId: String(result.blueprintId || '').trim() || undefined,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    summary: result.summary ? cloneValue(result.summary) : undefined,
    warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
    forms: Array.isArray(result.forms)
      ? result.forms.map(form => ({
        applyTargetKey: String(form.applyTargetKey || '').trim() || undefined,
        formKey: String(form.formKey || '').trim() || undefined,
        tableId: String(form.tableId || '').trim() || undefined,
        tableName: String(form.tableName || '').trim() || undefined,
        description: String(form.description || '').trim() || undefined,
        created: Boolean(form.created),
        reused: Boolean(form.reused),
        fieldsCreatedCount: Array.isArray(form.fieldsCreated) ? form.fieldsCreated.length : 0,
        fieldsReusedCount: Array.isArray(form.fieldsReused) ? form.fieldsReused.length : 0,
        fieldsUpdatedCount: Array.isArray(form.fieldsUpdated) ? form.fieldsUpdated.length : 0,
        fieldWarningCount: Array.isArray(form.fieldWarnings) ? form.fieldWarnings.length : 0,
      }))
      : [],
  }
}

const compactDraftPersistenceState = (state: unknown) => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return null
  }
  const value = state as Record<string, any>
  const actionIssues = Array.isArray(value.actionIssues) ? value.actionIssues : []
  return {
    mode: String(value.mode || '').trim() || undefined,
    issueCount: Number(value.issueCount || actionIssues.length || 0),
    summary: String(value.summary || '').trim() || undefined,
    updatedAt: Number(value.updatedAt || 0) || undefined,
    sourceBlueprintIdentityKey: String(value.sourceBlueprintIdentityKey || '').trim() || undefined,
    sourceBlueprintVersionKey: String(value.sourceBlueprintVersionKey || '').trim() || undefined,
    actionIssues: actionIssues.map(item => ({
      id: String(item?.id || '').trim() || undefined,
      targetKind: String(item?.targetKind || '').trim() || undefined,
      targetId: String(item?.targetId || '').trim() || undefined,
      targetLabel: String(item?.targetLabel || '').trim() || undefined,
      groupKey: String(item?.groupKey || '').trim() || undefined,
      groupLabel: String(item?.groupLabel || '').trim() || undefined,
      code: String(item?.code || '').trim() || undefined,
      message: String(item?.message || '').trim() || undefined,
      blockingSave: item?.blockingSave === true,
      source: String(item?.source || '').trim() || undefined,
      locator: item?.locator && typeof item.locator === 'object'
        ? cloneValue(item.locator)
        : undefined,
    })),
  }
}

const buildBlueprintStatusCounts = (blueprint: NocodeEditorAiAppBlueprint | null | undefined) => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint!.forms : []
  const fieldCount = forms.reduce((total, form) => (
    total + countBlueprintFields(Array.isArray(form.fields) ? form.fields : [])
  ), 0)
  return {
    formCount: forms.length,
    fieldCount,
    openQuestionCount: compactStringList(blueprint?.openQuestions).length,
  }
}

const compactStagedAppBlueprintForModel = (
  value: any,
  input: Record<string, any> = {},
) => {
  const phase = value?.phase || 'staged'
  const explicitDetail = normalizeBlueprintReadDetail(input?.detail)
  const detail: BlueprintReadDetail = explicitDetail || (phase === 'staged' ? 'structure' : 'status')
  const detailDefaultedFromLegacy = !explicitDetail && phase === 'staged'
  const blueprint = value?.blueprint || null
  const title = resolveNocodeEditorBlueprintDisplayTitle({
    title: blueprint?.title,
    forms: blueprint?.forms,
    fallback: '未命名蓝图',
  })
  const counts = buildBlueprintStatusCounts(blueprint)
  const applyResult = compactApplyResult(value?.applyResult || null)
  const draftPersistenceState = compactDraftPersistenceState(value?.draftPersistenceState || null)
  const blueprintRef = {
    id: String(blueprint?.id || applyResult?.blueprintId || '').trim() || undefined,
    title: title || undefined,
    phase,
    revision: Number(value?.revision || 0),
    stagedAt: value?.stagedAt,
    sourcePlanningContextKey: String(value?.sourcePlanningContextKey || '').trim() || undefined,
    planningScope: normalizeNocodeEditorPlanningScopeValue(value?.planningScope),
  }

  return {
    compactContract: 'nocode-editor-blueprint@1',
    detail,
    detailDefaultedFromLegacy: detailDefaultedFromLegacy || undefined,
    phase,
    revision: Number(value?.revision || 0),
    stagedAt: value?.stagedAt,
    planningScope: normalizeNocodeEditorPlanningScopeValue(value?.planningScope),
    blueprintRef,
    title: title || undefined,
    summary: String(blueprint?.summary || '').trim() || undefined,
    counts,
    applyResult,
    draftPersistenceState,
    blueprint: detail === 'structure' ? compactBlueprintStructure(blueprint) : undefined,
  }
}

const compactWidgetSummary = (widget: Record<string, any>, parentUid = ''): Record<string, any> => {
  const uid = String(widget?.uid || widget?.widgetId || '').trim()
  const type = String(widget?.type || widget?.widgetType || '').trim()
  const children = getWidgetTreeChildren(widget)
  const enumOptionsPreview = Array.isArray(widget?.enumOptionsPreview)
    ? widget.enumOptionsPreview.slice(0, 12).map((item: Record<string, any>) => ({
      label: String(item?.label || item?.value || '').trim(),
      value: String(item?.value || item?.label || '').trim(),
    })).filter((item: Record<string, string>) => item.label || item.value)
    : []
  return {
    uid,
    type,
    name: String(widget?.name || '').trim(),
    parentUid: String(widget?.parentUid || parentUid || '').trim() || undefined,
    enumSourceType: String(widget?.enumSourceType || '').trim() || undefined,
    enumOptionCount: Number(widget?.enumOptionCount || enumOptionsPreview.length || 0) || undefined,
    enumOptionsPreview,
    children: children.length ? children.map(child => compactWidgetSummary(child, uid)) : undefined,
  }
}

const compactAvailableWidgetTypes = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => ({
      category: String(item?.category || '').trim() || undefined,
      type: String(item?.type || '').trim() || undefined,
      name: String(item?.name || '').trim() || undefined,
      aliases: Array.isArray(item?.aliases)
        ? item.aliases.map((alias: unknown) => String(alias || '').trim()).filter(Boolean)
        : [],
    })).filter(item => item.type || item.name)
    : []
)

const compactFormSummaryForModel = (summary: Record<string, any> | null | undefined) => {
  const widgets = Array.isArray(summary?.widgets) ? summary!.widgets : []
  const compactWidgets = widgets.map(widget => compactWidgetSummary(widget))
  return {
    compactContract: 'nocode-editor-form-summary@1',
    tableId: String(summary?.tableId || '').trim() || undefined,
    tableName: String(summary?.tableName || '').trim() || undefined,
    selectedWidgetId: String(summary?.selectedWidgetId || '').trim() || undefined,
    widgets: compactWidgets,
    fieldCount: flattenWidgetTree(compactWidgets).length,
    availableWidgetTypes: compactAvailableWidgetTypes(summary?.availableWidgetTypes),
    summarySource: String(summary?.summarySource || '').trim() || undefined,
  }
}

const getBlueprintFieldChildren = (field: NocodeEditorAiAppBlueprintField) => {
  if (!Array.isArray(field?.children)) return []
  return field.children.filter(item => Boolean(String(item?.name || '').trim()))
}

const getWidgetScopeKey = (name: unknown, parentUid: unknown = '') => `${String(parentUid || '').trim()}::${normalizeToken(name)}`

const buildScopedWidgetMap = (widgets: Array<Record<string, any>> = []) => {
  const result = new Map<string, Record<string, any>>()
  for (const widget of widgets) {
    if (!String(widget?.name || '').trim()) {
      continue
    }
    result.set(getWidgetScopeKey(widget.name, widget.parentUid), widget)
  }
  return result
}

const flattenChoiceTree = (choices: any[] = [], parentLabels: string[] = [], result: Array<Record<string, any>> = []) => {
  for (const item of choices) {
    if (Array.isArray(item)) {
      flattenChoiceTree(item, parentLabels, result)
      continue
    }
    if (!item || typeof item !== 'object') {
      continue
    }
    const currentLabel = String(item.label || '').trim()
    const currentValue = String(item.value || '').trim()
    const pathLabels = [...parentLabels, currentLabel].filter(Boolean)
    const children = Array.isArray(item.children) ? item.children : []
    if (!children.length && (currentLabel || currentValue)) {
      result.push({
        label: currentLabel,
        value: currentValue,
        pathLabels,
      })
    }
    if (children.length) {
      flattenChoiceTree(children, pathLabels, result)
    }
  }
  return result
}

const listSchemaOptions = (schema: any) => (Array.isArray(schema?.groups) ? schema.groups : [])
  .flatMap(group => Array.isArray(group?.options) ? group.options : [])

const findSchemaOption = (
  schema: any,
  options: {
    keys?: string[]
    labels?: string[]
    typeIncludes?: string[]
  },
) => {
  const schemaOptions = listSchemaOptions(schema)
  return schemaOptions.find((item) => {
    const keys = options.keys || []
    const labels = options.labels || []
    const typeIncludes = options.typeIncludes || []
    const pathValues = Array.isArray(item?.path) ? item.path : []
    const itemKey = String(item?.key || '').trim()
    const itemLabel = String(item?.label || '').trim()
    const itemType = String(item?.type || '').trim()

    if (keys.some(key => isSameToken(itemKey, key) || pathValues.some(path => isSameToken(path, key)))) {
      return true
    }
    if (labels.some(label => normalizeToken(itemLabel).includes(normalizeToken(label)))) {
      return true
    }
    if (typeIncludes.some(type => normalizeToken(itemType).includes(normalizeToken(type)))) {
      return true
    }
    return false
  })
}

const normalizeFieldWarnings = (warnings: string[]) => Array.from(new Set(warnings.filter(Boolean)))

const pushBlueprintFieldBinding = (
  formResult: NocodeEditorAiBlueprintApplyFormResult,
  input: {
    tableId?: string
    fieldKey?: string
    fieldName?: string
    widgetId?: string
    widgetType?: string
    parentFieldKey?: string
    parentWidgetId?: string
  },
) => {
  const fieldKey = String(input.fieldKey || '').trim()
  const fieldName = String(input.fieldName || '').trim()
  const widgetId = String(input.widgetId || '').trim()
  if (!fieldKey || !fieldName || !widgetId) {
    return
  }

  const bindings = Array.isArray(formResult.fieldBindings) ? formResult.fieldBindings : []
  const exists = bindings.some(item => (
    item.fieldKey === fieldKey
    && item.widgetId === widgetId
    && String(item.parentWidgetId || '').trim() === String(input.parentWidgetId || '').trim()
  ))
  if (exists) {
    formResult.fieldBindings = bindings
    return
  }

  formResult.fieldBindings = [
    ...bindings,
    {
      tableId: String(input.tableId || '').trim() || undefined,
      fieldKey,
      fieldName,
      widgetId,
      widgetType: String(input.widgetType || '').trim() || undefined,
      parentFieldKey: String(input.parentFieldKey || '').trim() || undefined,
      parentWidgetId: String(input.parentWidgetId || '').trim() || undefined,
    },
  ]
}

const isDraftSaveFailed = (result: unknown) => result === false || (
  Boolean(result)
  && typeof result === 'object'
  && (result as NocodeEditorAiDraftSaveResult).ok === false
)

const matchesSourceFormName = (pathLabels: string[] = [], expectedFormName: string) => {
  const expectedTokens = getBlueprintFormAliasTokens(expectedFormName)
  if (!expectedTokens.length) {
    return false
  }

  return pathLabels.some((label) => {
    const labelTokens = getBlueprintFormAliasTokens(label)
    return labelTokens.some(token => expectedTokens.includes(token))
  })
}

type NocodeEditorAiFieldSourceChoiceSnapshot = {
  label: string
  value: string
  path: string
}

type NocodeEditorAiFieldSourceBindingMatchType = 'contextual-match' | 'unique-field-fallback'

type NocodeEditorAiFieldSourceBindingResult = {
  widgetId: string
  formName: string
  fieldName: string
  boundChoice: Record<string, any>
  matchType: NocodeEditorAiFieldSourceBindingMatchType
  diagnostics: {
    contextualMatches: NocodeEditorAiFieldSourceChoiceSnapshot[]
    sameFieldChoices: NocodeEditorAiFieldSourceChoiceSnapshot[]
  }
  warningMessage?: string
}

const formatFieldSourceChoicePath = (pathLabels: string[] = [], label?: string) => {
  const normalizedPath = pathLabels
    .map(item => String(item || '').trim())
    .filter(Boolean)
  if (normalizedPath.length) {
    return normalizedPath.join(' > ')
  }
  return String(label || '').trim()
}

const snapshotFieldSourceChoice = (choice: Record<string, any>): NocodeEditorAiFieldSourceChoiceSnapshot => ({
  label: String(choice?.label || '').trim(),
  value: String(choice?.value || '').trim(),
  path: (() => {
    const formattedPath = formatFieldSourceChoicePath(
      Array.isArray(choice?.pathLabels) ? choice.pathLabels : [],
      String(choice?.label || '').trim(),
    )
    const choiceValue = String(choice?.value || '').trim()
    if (!choiceValue) {
      return formattedPath
    }
    if (!formattedPath || formattedPath === String(choice?.label || '').trim()) {
      return `${formattedPath || '未命名候选'} (${choiceValue})`
    }
    return `${formattedPath} (${choiceValue})`
  })(),
})

const buildFieldSourceAmbiguousError = (input: {
  formName: string
  fieldName: string
  choices: Array<Record<string, any>>
  contextual: boolean
}) => {
  const snapshots = input.choices.map(snapshotFieldSourceChoice)
  const summary = snapshots
    .map(item => `「${item.path || item.label || item.value}」`)
    .join('、')
  if (input.contextual) {
    return `表「${input.formName}」下存在多个同名字段「${input.fieldName}」，无法自动绑定。候选：${summary}`
  }
  return `未命中表「${input.formName}」上下文，且发现 ${snapshots.length} 个同名字段「${input.fieldName}」，无法自动绑定。候选：${summary}`
}

const pickBlueprintSourceField = (fields: NocodeEditorAiAppBlueprintField[] = []) => {
  const candidates = fields.filter(item => String(item?.name || '').trim())
  if (!candidates.length) return null

  const priorityMatchers = [
    /(名称|姓名|标题|简称|班级名称|课程名称|部门名称|院系名称)/,
    /(编号|编码|学号|工号)/,
  ]

  for (const matcher of priorityMatchers) {
    const matched = candidates.find(item => matcher.test(String(item.name || '').trim()))
    if (matched) {
      return matched
    }
  }

  return candidates[0]
}

const stripBlueprintFormSuffixes = (value: unknown) => {
  let current = String(value || '').trim()
  if (!current) return ''

  while (MASTER_FORM_SUFFIX_REGEXP.test(current)) {
    current = current.replace(MASTER_FORM_SUFFIX_REGEXP, '').trim()
  }

  return current || String(value || '').trim()
}

const getBlueprintFormAliasTokens = (value: unknown) => {
  const rawName = String(value || '').trim()
  const strippedName = stripBlueprintFormSuffixes(rawName)
  return Array.from(new Set([
    normalizeToken(rawName),
    normalizeToken(strippedName),
  ].filter(Boolean)))
}

const getBlueprintRelationFieldTokens = (field: Partial<NocodeEditorAiAppBlueprintField>) => {
  const result = new Set<string>()
  const addToken = (value: unknown) => {
    const normalized = normalizeToken(value)
    if (normalized) {
      result.add(normalized)
    }
  }

  const rawName = String(field?.name || '').trim()
  if (!rawName) {
    return []
  }

  addToken(rawName)
  const strippedName = rawName
    .replace(RELATION_FIELD_PREFIX_REGEXP, '')
    .replace(RELATION_FIELD_SUFFIX_REGEXP, '')
    .trim()
  if (strippedName && strippedName !== rawName) {
    addToken(strippedName)
  }

  if (field?.source?.formName) {
    addToken(field.source.formName)
    addToken(stripBlueprintFormSuffixes(field.source.formName))
  }

  return Array.from(result)
}

const inferBlueprintFieldSource = (
  blueprint: NocodeEditorAiAppBlueprint,
  currentForm: NocodeEditorAiAppBlueprint['forms'][number] | undefined,
  field: NocodeEditorAiAppBlueprintField,
) => {
  const relationFieldTokens = getBlueprintRelationFieldTokens(field)
  if (!relationFieldTokens.length) {
    return null
  }

  let bestMatch: NocodeEditorAiAppBlueprint['forms'][number] | null = null
  let bestScore = -1

  for (const candidateForm of blueprint.forms) {
    if (
      currentForm
      && (
        (candidateForm.formKey && candidateForm.formKey === currentForm.formKey)
        || isSameToken(candidateForm.tableName, currentForm.tableName)
      )
    ) {
      continue
    }

    const formAliasTokens = getBlueprintFormAliasTokens(candidateForm.tableName)
    if (!formAliasTokens.length) {
      continue
    }

    let score = -1
    for (const relationToken of relationFieldTokens) {
      if (!relationToken) continue
      if (formAliasTokens.includes(relationToken)) {
        score = Math.max(score, 100)
      } else if (formAliasTokens.some(item => item && relationToken === `${item}档案`)) {
        score = Math.max(score, 95)
      }
    }

    if (score < 0) {
      continue
    }
    if (MASTER_FORM_SUFFIX_REGEXP.test(candidateForm.tableName)) {
      score += 5
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = candidateForm
    }
  }

  if (!bestMatch) {
    return null
  }

  const targetField = pickBlueprintSourceField(bestMatch.fields || [])
  return {
    formKey: bestMatch.formKey || undefined,
    formName: bestMatch.tableName,
    fieldKey: targetField?.fieldKey,
    fieldName: targetField?.name,
  }
}

type EnhanceBlueprintOptions = {
  collectFieldClarifications?: boolean
  planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null
}

const appendBlueprintOpenQuestion = (
  blueprint: NocodeEditorAiAppBlueprint,
  question: string | undefined,
) => {
  const normalizedQuestion = String(question || '').trim()
  if (!normalizedQuestion) {
    return
  }
  blueprint.openQuestions = mergeBlueprintOpenQuestions(blueprint.openQuestions, [normalizedQuestion])
}

const getBlueprintFieldClarificationQuestion = (
  currentForm: NocodeEditorAiAppBlueprint['forms'][number] | undefined,
  field: NocodeEditorAiAppBlueprintField,
  resolvedSource: NocodeEditorAiBlueprintFieldSource | null | undefined,
  planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null,
) => {
  const children = Array.isArray(field.children) ? field.children : []
  const decision = inferBlueprintFieldIntent({
    formName: String(currentForm?.tableName || '').trim(),
    fieldName: field.name,
    explicitWidgetType: field.widgetType,
    description: field.description,
    notes: field.notes,
    hasSource: hasMeaningfulBlueprintSource(resolvedSource) || hasMeaningfulBlueprintSource(field.source),
    canResolveRelationSource: hasMeaningfulBlueprintSource(resolvedSource),
    hasChildren: children.length > 0,
    enumOptionsCount: normalizeEnumOptions(field.enumOptions).length,
    planningCarryover,
  })

  return decision.requiresClarification ? decision.clarificationQuestion : undefined
}

const collectBlueprintFieldClarification = (
  blueprint: NocodeEditorAiAppBlueprint,
  currentForm: NocodeEditorAiAppBlueprint['forms'][number] | undefined,
  field: NocodeEditorAiAppBlueprintField,
  resolvedSource: NocodeEditorAiBlueprintFieldSource | null | undefined,
  planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null,
) => {
  appendBlueprintOpenQuestion(
    blueprint,
    getBlueprintFieldClarificationQuestion(currentForm, field, resolvedSource, planningCarryover),
  )
}

export const deriveBlueprintClarificationQuestions = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
  options: {
    planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null
  } = {},
) => {
  if (!blueprint) {
    return []
  }

  const questions: string[] = []
  const visitField = (
    currentForm: NocodeEditorAiAppBlueprint['forms'][number],
    field: NocodeEditorAiAppBlueprintField,
  ) => {
    const resolvedSource = field.source || inferBlueprintFieldSource(blueprint, currentForm, field)
    const question = getBlueprintFieldClarificationQuestion(
      currentForm,
      field,
      resolvedSource,
      options.planningCarryover,
    )
    if (question) {
      questions.push(question)
    }
    if (Array.isArray(field.children) && field.children.length) {
      field.children.forEach(child => visitField(currentForm, child))
    }
  }

  blueprint.forms.forEach(form => {
    form.fields.forEach(field => visitField(form, field))
  })

  return mergeBlueprintOpenQuestions(questions)
}

export const resolveStageBlueprintOpenQuestions = (options: {
  currentBlueprint?: NocodeEditorAiAppBlueprint | null
  nextBlueprint: NocodeEditorAiAppBlueprint
  stagedBlueprint: NocodeEditorAiAppBlueprint
  planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null
}) => {
  const currentDerivedQuestions = deriveBlueprintClarificationQuestions(options.currentBlueprint, {
    planningCarryover: options.planningCarryover,
  })
  const staleQuestions = subtractBlueprintOpenQuestions(
    options.currentBlueprint?.openQuestions,
    currentDerivedQuestions,
  )
  const stagedDerivedQuestions = deriveBlueprintClarificationQuestions(options.stagedBlueprint, {
    planningCarryover: options.planningCarryover,
  })
  const nextQuestionSet = new Set(normalizeStringArray(options.nextBlueprint.openQuestions))
  const stagedQuestionSet = new Set(stagedDerivedQuestions)
  const preservedQuestions = staleQuestions.filter(question => (
    stagedQuestionSet.has(question)
    || (!isBlueprintFieldClarificationQuestion(question) && nextQuestionSet.has(question))
  ))
  const nextQuestions = normalizeStringArray(options.nextBlueprint.openQuestions).filter(question => (
    stagedQuestionSet.has(question)
    || !isBlueprintFieldClarificationQuestion(question)
  ))
  return mergeBlueprintOpenQuestions(
    preservedQuestions,
    nextQuestions,
    stagedDerivedQuestions,
  )
}

const enhanceBlueprintField = (
  blueprint: NocodeEditorAiAppBlueprint,
  currentForm: NocodeEditorAiAppBlueprint['forms'][number] | undefined,
  field: NocodeEditorAiAppBlueprintField,
  options: EnhanceBlueprintOptions = {},
) => {
  const resolvedSource = field.source || inferBlueprintFieldSource(blueprint, currentForm, field)
  if (resolvedSource) {
    field.source = {
      formKey: resolvedSource.formKey,
      formName: resolvedSource.formName,
      fieldKey: resolvedSource.fieldKey,
      fieldName: resolvedSource.fieldName,
    }
  }

  field.widgetType = guessWidgetType(field, {
    resolvedSource,
    formName: currentForm?.tableName,
    planningCarryover: options.planningCarryover,
  })

  if (options.collectFieldClarifications) {
    collectBlueprintFieldClarification(
      blueprint,
      currentForm,
      field,
      resolvedSource,
      options.planningCarryover,
    )
  }

  if (Array.isArray(field.children) && field.children.length) {
    field.children.forEach(child => enhanceBlueprintField(blueprint, currentForm, child, options))
  }
}

const enhanceBlueprint = (
  blueprint: NocodeEditorAiAppBlueprint,
  options: EnhanceBlueprintOptions = {},
) => {
  blueprint.forms.forEach(form => {
    form.fields.forEach(field => enhanceBlueprintField(blueprint, form, field, options))
  })
  return blueprint
}

export const deriveSolutionOutlineFromBlueprint = (
  blueprint: NocodeEditorAiAppBlueprint,
): NocodeEditorAiSolutionOutline => {
  const forms = blueprint.forms.map((form, formIndex) => ({
    formKey: String(form.formKey || `form-${formIndex + 1}`).trim(),
    tableName: form.tableName,
    groupName: normalizeOutlineGroupName(form.groupName) || undefined,
    description: form.description,
  }))
  const modules = deriveOutlineModulesFromForms(forms)
  const formKeyMap = buildOutlineFormKeyMap(forms)
  const flows: NocodeEditorAiSolutionOutlineFlow[] = []
  const appended = new Set<string>()

  for (const [formIndex, form] of blueprint.forms.entries()) {
    const currentFormKey = resolveNocodeEditorPlanningCanonicalFormKey(
      formKeyMap,
      forms[formIndex]?.formKey,
    )
    if (!currentFormKey) {
      continue
    }
    const visitFields = (fields: NocodeEditorAiAppBlueprintField[] = []) => {
      for (const field of fields) {
        const sourceFormKey = String(field?.source?.formKey || '').trim()
        const sourceFormName = String(field?.source?.formName || '').trim()
        const resolvedSourceKey = sourceFormKey
          ? resolveNocodeEditorPlanningCanonicalFormKey(formKeyMap, sourceFormKey)
          : resolveNocodeEditorPlanningFormAlias(formKeyMap, sourceFormName)
        if (resolvedSourceKey && resolvedSourceKey !== currentFormKey) {
          const label = String(field.name || '').trim() || undefined
          const key = `${resolvedSourceKey}::${currentFormKey}::${label || ''}`
          if (!appended.has(key)) {
            appended.add(key)
            flows.push({
              from: resolvedSourceKey,
              to: currentFormKey,
              label,
            })
          }
        }
        if (Array.isArray(field?.children) && field.children.length) {
          visitFields(field.children)
        }
      }
    }
    visitFields(form.fields)
  }

  return {
    id: createSolutionOutlineId(),
    title: blueprint.title || '应用结构',
    summary: blueprint.summary,
    forms,
    modules,
    flows,
    assumptions: cloneValue(blueprint.assumptions || []),
    openQuestions: cloneValue(blueprint.openQuestions || []),
  }
}

const flattenNocodeStructureForms = (
  nodes: NocodeStructure[] = [],
  groupName = '',
  result = new Map<string, string>(),
) => {
  for (const node of nodes) {
    if (!node) {
      continue
    }
    if (node.type === NocodeStructureType.GROUP) {
      flattenNocodeStructureForms(node.children || [], String(node.name || '').trim(), result)
      continue
    }
    if (node.type === NocodeStructureType.FORM && node.id) {
      result.set(String(node.id || '').trim(), groupName)
    }
  }
  return result
}

const normalizeBlueprintFieldDescription = (
  field: BlueprintSourceField,
  widget?: Record<string, any> | null,
) => {
  const extra = getBlueprintFieldExtra(field)
  const widgetOptions = widget?.options && typeof widget.options === 'object'
    ? widget.options
    : {}
  const description = String(
    extra.description
      || widgetOptions['show-description']
      || widgetOptions['description-content']
      || '',
  ).trim()
  return description || normalizeBlueprintFieldPlaceholder(field, widget)
}

const normalizeBlueprintFieldRequired = (
  field: BlueprintSourceField,
  widget?: Record<string, any> | null,
) => {
  const extra = getBlueprintFieldExtra(field)
  if (typeof extra.isRequired === 'boolean') {
    return extra.isRequired
  }
  const widgetRequired = widget?.options?.required
  if (typeof widgetRequired === 'boolean') {
    return widgetRequired
  }
  return undefined
}

const normalizeBlueprintFieldValidationFormat = (field: BlueprintSourceField) => (
  normalizeValidationFormat(getBlueprintFieldExtra(field).validationFormat)
)

const normalizeBlueprintFieldWidgetType = (
  field: BlueprintSourceField,
  widget?: Record<string, any> | null,
) => {
  const extra = getBlueprintFieldExtra(field)
  const widgetType = String(extra.widgetType || widget?.type || '').trim()
  if (widgetType) {
    return resolveExplicitBlueprintWidgetType(widgetType)
  }

  const subType = String(field?.meta?.subType || field?.subType || '').trim()
  if (subType) {
    return resolveExplicitBlueprintWidgetType(subType)
  }

  return resolveExplicitBlueprintWidgetType(field?.type) || guessWidgetType({
    name: getBlueprintFieldName(field),
    widgetType: field?.type,
  })
}

const buildBlueprintFieldLineageSignature = (field: unknown): string => {
  const fieldRecord = field && typeof field === 'object'
    ? field as Record<string, unknown>
    : {}
  const token = normalizeBlueprintIdentityToken(fieldRecord.fieldKey || fieldRecord.key || fieldRecord.name)
  const children = Array.isArray(fieldRecord.children)
    ? fieldRecord.children
      .map(buildBlueprintFieldLineageSignature)
      .filter(Boolean)
      .sort()
    : []
  if (!token && !children.length) {
    return ''
  }
  return children.length ? `${token || 'field'}(${children.join('|')})` : token
}

const collectBlueprintFieldLineageTokens = (fields: unknown): string[] => {
  if (!Array.isArray(fields)) {
    return []
  }

  return fields
    .map(buildBlueprintFieldLineageSignature)
    .filter(Boolean)
}

const getBlueprintLineageKey = (blueprint: NocodeEditorAiAppBlueprint | null | undefined) => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  if (!forms.length) {
    return ''
  }

  return forms
    .map((form) => {
      const formKey = normalizeBlueprintIdentityToken(form?.formKey)
      const groupName = normalizeBlueprintIdentityToken(form?.groupName)
      const tableName = normalizeBlueprintIdentityToken(form?.tableName)
      const fields = collectBlueprintFieldLineageTokens(form?.fields).sort()
      return [
        formKey,
        groupName || 'nogroup',
        tableName || 'noname',
        fields.join('|'),
      ].join('::')
    })
    .sort()
    .join('||')
}

const getBlueprintPlanningContextKey = (
  blueprint: (NocodeEditorAiAppBlueprint & { confirmation?: NocodeEditorAiConfirmPayload | null }) | null | undefined,
  sourcePlanningContextKey?: string | null,
) => String(
  sourcePlanningContextKey
  || blueprint?.confirmation?.planningContextKey
  || '',
).trim() || null

const shouldCarryCurrentBlueprintId = (options: {
  nextBlueprint: NocodeEditorAiAppBlueprint
  currentBlueprint?: NocodeEditorAiAppBlueprint | null
  currentSourcePlanningContextKey?: string | null
  nextSourcePlanningContextKey?: string | null
}) => {
  const currentBlueprint = options.currentBlueprint || null
  if (!currentBlueprint?.id) {
    return false
  }

  const currentId = String(currentBlueprint.id || '').trim()
  const nextId = String(options.nextBlueprint.id || '').trim()
  if (nextId && nextId !== currentId) {
    return false
  }

  const currentPlanningContextKey = getBlueprintPlanningContextKey(
    currentBlueprint as NocodeEditorAiAppBlueprint & { confirmation?: NocodeEditorAiConfirmPayload | null },
    options.currentSourcePlanningContextKey,
  )
  const nextPlanningContextKey = getBlueprintPlanningContextKey(
    options.nextBlueprint as NocodeEditorAiAppBlueprint & { confirmation?: NocodeEditorAiConfirmPayload | null },
    options.nextSourcePlanningContextKey,
  )

  if (currentPlanningContextKey && nextPlanningContextKey) {
    return isSamePlanningConfirmationContext(currentPlanningContextKey, nextPlanningContextKey)
  }

  const currentLineageKey = getBlueprintLineageKey(currentBlueprint)
  const nextLineageKey = getBlueprintLineageKey(options.nextBlueprint)
  if (currentLineageKey && nextLineageKey && currentLineageKey !== nextLineageKey) {
    return false
  }

  return true
}

const getBlueprintFieldStableIdentityKey = (field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined) => (
  String(field?.fieldKey || '').trim()
)

const getBlueprintFieldNameIdentityKey = (field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined) => (
  normalizeBlueprintIdentityToken(field?.name)
)

const buildBlueprintFieldLookupMaps = (fields: NocodeEditorAiAppBlueprintField[] = []) => {
  const stableMap = new Map<string, NocodeEditorAiAppBlueprintField>()
  const nameMap = new Map<string, NocodeEditorAiAppBlueprintField>()

  fields.forEach((field) => {
    const stableKey = getBlueprintFieldStableIdentityKey(field)
    if (stableKey) {
      stableMap.set(stableKey, field)
    }
    const nameKey = getBlueprintFieldNameIdentityKey(field)
    if (nameKey && !nameMap.has(nameKey)) {
      nameMap.set(nameKey, field)
    }
  })

  return {
    stableMap,
    nameMap,
  }
}

const resolveCurrentBlueprintField = (
  nextField: NocodeEditorAiAppBlueprintField,
  lookupMaps: ReturnType<typeof buildBlueprintFieldLookupMaps>,
) => {
  const stableKey = getBlueprintFieldStableIdentityKey(nextField)
  if (stableKey) {
    const matchedByStable = lookupMaps.stableMap.get(stableKey)
    if (matchedByStable) {
      return matchedByStable
    }
  }

  const nameKey = getBlueprintFieldNameIdentityKey(nextField)
  if (nameKey) {
    return lookupMaps.nameMap.get(nameKey)
  }

  return undefined
}

const mergeBlueprintFieldWithExisting = (
  nextField: NocodeEditorAiAppBlueprintField,
  currentField?: NocodeEditorAiAppBlueprintField,
  options: {
    updateMode?: 'patch' | 'replace'
    deletedFieldKeys?: Set<string>
  } = {},
): NocodeEditorAiAppBlueprintField => {
  const currentChildren = Array.isArray(currentField?.children) ? currentField.children : []
  const currentChildLookupMaps = buildBlueprintFieldLookupMaps(currentChildren)

  const mergedChildren = options.updateMode === 'patch'
    ? mergeBlueprintFieldsWithExisting(
      Array.isArray(nextField.children) ? nextField.children : [],
      currentChildren,
      options.deletedFieldKeys,
    )
    : Array.isArray(nextField.children)
      ? nextField.children.map((child) => {
        const currentChild = resolveCurrentBlueprintField(child, currentChildLookupMaps)
        return mergeBlueprintFieldWithExisting(child, currentChild)
      })
      : currentField?.children

  return {
    ...cloneValue(currentField || {}),
    ...cloneValue(nextField),
    fieldKey: String(nextField.fieldKey || currentField?.fieldKey || '').trim() || undefined,
    widgetType: String(nextField.widgetType || currentField?.widgetType || '').trim() || undefined,
    description: pickFirstDefined(
      String(nextField.description || '').trim() || undefined,
      currentField?.description,
    ),
    required: typeof nextField.required === 'boolean'
      ? nextField.required
      : currentField?.required,
    placeholder: pickFirstDefined(
      String(nextField.placeholder || '').trim() || undefined,
      currentField?.placeholder,
    ),
    validationFormat: pickFirstDefined(
      String(nextField.validationFormat || '').trim() || undefined,
      currentField?.validationFormat,
    ),
    enumOptions: Array.isArray(nextField.enumOptions)
      ? cloneValue(nextField.enumOptions)
      : currentField?.enumOptions,
    source: nextField.source
      ? cloneValue(nextField.source)
      : currentField?.source
        ? cloneValue(currentField.source)
        : undefined,
    notes: nextField.notes?.length
      ? cloneValue(nextField.notes)
      : currentField?.notes
        ? cloneValue(currentField.notes)
        : undefined,
    children: mergedChildren?.length ? mergedChildren : undefined,
  }
}

const mergeBlueprintFieldsWithExisting = (
  nextFields: NocodeEditorAiAppBlueprintField[],
  currentFields: NocodeEditorAiAppBlueprintField[],
  deletedFieldKeys: Set<string> = new Set(),
) => {
  const currentFieldLookupMaps = buildBlueprintFieldLookupMaps(currentFields)
  const nextFieldByCurrent = new Map<NocodeEditorAiAppBlueprintField, NocodeEditorAiAppBlueprintField>()
  const addedFields: NocodeEditorAiAppBlueprintField[] = []

  nextFields.forEach((nextField) => {
    const currentField = resolveCurrentBlueprintField(nextField, currentFieldLookupMaps)
    if (currentField && !nextFieldByCurrent.has(currentField)) {
      nextFieldByCurrent.set(currentField, nextField)
      return
    }
    addedFields.push(nextField)
  })

  return [
    ...currentFields.flatMap((currentField) => {
      if (deletedFieldKeys.has(getBlueprintFieldStableIdentityKey(currentField))) {
        return []
      }
      const nextField = nextFieldByCurrent.get(currentField)
      return [nextField
        ? mergeBlueprintFieldWithExisting(nextField, currentField, {
          updateMode: 'patch',
          deletedFieldKeys,
        })
        : cloneValue(currentField)]
    }),
    ...addedFields
      .filter(field => !deletedFieldKeys.has(getBlueprintFieldStableIdentityKey(field)))
      .map(field => mergeBlueprintFieldWithExisting(field, undefined, {
        updateMode: 'patch',
        deletedFieldKeys,
      })),
  ]
}

const mergeBlueprintFormWithExisting = (
  nextForm: NocodeEditorAiAppBlueprintForm,
  currentForm?: NocodeEditorAiAppBlueprintForm,
  options: {
    updateMode?: 'patch' | 'replace'
    deletedFieldKeys?: Set<string>
  } = {},
): NocodeEditorAiAppBlueprintForm => {
  const currentFieldLookupMaps = buildBlueprintFieldLookupMaps(
    Array.isArray(currentForm?.fields) ? currentForm.fields : [],
  )

  return {
    ...cloneValue(currentForm || {}),
    ...cloneValue(nextForm),
    formKey: String(nextForm.formKey || currentForm?.formKey || '').trim() || undefined,
    groupName: pickFirstDefined(
      String(nextForm.groupName || '').trim() || undefined,
      currentForm?.groupName,
    ),
    description: pickFirstDefined(
      String(nextForm.description || '').trim() || undefined,
      currentForm?.description,
    ),
    fields: options.updateMode === 'patch'
      ? mergeBlueprintFieldsWithExisting(
        nextForm.fields,
        Array.isArray(currentForm?.fields) ? currentForm.fields : [],
        options.deletedFieldKeys,
      )
      : nextForm.fields.map(field => mergeBlueprintFieldWithExisting(
        field,
        resolveCurrentBlueprintField(field, currentFieldLookupMaps),
      )),
  }
}

export const mergeBlueprintWithCurrent = (
  nextBlueprint: NocodeEditorAiAppBlueprint,
  currentBlueprint?: NocodeEditorAiAppBlueprint | null,
  options: {
    updateMode?: 'patch' | 'replace'
    deletedFormKeys?: string[]
    deletedFields?: Array<{
      formKey: string
      fieldKeys: string[]
    }>
  } = {},
) => {
  if (!currentBlueprint) {
    return nextBlueprint
  }

  const currentFormMap = new Map(
    currentBlueprint.forms
      .map(form => [getNocodeEditorBlueprintMergeIdentity(form), form] as const)
      .filter(([key]) => Boolean(key)),
  )

  const updateMode = options.updateMode || 'replace'
  const deletedFormKeySet = new Set(options.deletedFormKeys || [])
  const deletedFieldKeyMap = new Map(
    (options.deletedFields || []).map(item => [item.formKey, new Set(item.fieldKeys)] as const),
  )
  const forms = updateMode === 'patch'
    ? [
      ...currentBlueprint.forms.flatMap((currentForm) => {
        const formKey = String(currentForm.formKey || '').trim()
        if (formKey && deletedFormKeySet.has(formKey)) {
          return []
        }
        const identity = getNocodeEditorBlueprintMergeIdentity(currentForm)
        const nextForm = nextBlueprint.forms.find(form => (
          getNocodeEditorBlueprintMergeIdentity(form) === identity
        ))
        return [nextForm
          ? mergeBlueprintFormWithExisting(nextForm, currentForm, {
            updateMode: 'patch',
            deletedFieldKeys: deletedFieldKeyMap.get(formKey),
          })
          : {
            ...cloneValue(currentForm),
            fields: mergeBlueprintFieldsWithExisting(
              [],
              currentForm.fields,
              deletedFieldKeyMap.get(formKey),
            ),
          }]
      }),
      ...nextBlueprint.forms
        .filter(form => !currentFormMap.has(getNocodeEditorBlueprintMergeIdentity(form)))
        .filter(form => !deletedFormKeySet.has(String(form.formKey || '').trim()))
        .map(form => mergeBlueprintFormWithExisting(form, undefined, {
          updateMode: 'patch',
          deletedFieldKeys: deletedFieldKeyMap.get(String(form.formKey || '').trim()),
        })),
    ]
    : nextBlueprint.forms.map(form => mergeBlueprintFormWithExisting(
      form,
      currentFormMap.get(getNocodeEditorBlueprintMergeIdentity(form)),
    ))

  return enhanceBlueprint({
    ...cloneValue(currentBlueprint),
    ...cloneValue(nextBlueprint),
    id: String(nextBlueprint.id || currentBlueprint.id || createBlueprintId()).trim(),
    title: String(nextBlueprint.title || currentBlueprint.title || '蓝图').trim() || '蓝图',
    summary: pickFirstDefined(
      String(nextBlueprint.summary || '').trim() || undefined,
      currentBlueprint.summary,
    ),
    assumptions: nextBlueprint.assumptions?.length
      ? cloneValue(nextBlueprint.assumptions)
      : cloneValue(currentBlueprint.assumptions || []),
    openQuestions: mergeBlueprintOpenQuestions(
      currentBlueprint.openQuestions,
      nextBlueprint.openQuestions,
    ),
    forms,
  })
}

const normalizeBlueprintFieldEnumOptions = (
  field: BlueprintSourceField,
  widget?: Record<string, any> | null,
) => {
  const extra = getBlueprintFieldExtra(field)
  const widgetOptions = widget?.options && typeof widget.options === 'object'
    ? widget.options
    : {}
  const candidates = [
    extra.options,
    extra.enumOptions,
    extra.choices,
    widget?.enumOptionsPreview,
    widgetOptions.options,
    widgetOptions.choices,
    widgetOptions['radiogroup-value-text-color-option']?.options,
  ]

  for (const candidate of candidates) {
    const normalizedOptions = normalizeEnumOptions(candidate)
    if (normalizedOptions.length) {
      return normalizedOptions
    }
  }

  return []
}

const getBlueprintSourceFieldChildren = (
  field: BlueprintSourceField,
  context: BlueprintFieldBuildContext,
) => {
  const currentChildren = Array.isArray(field?.subTableFields)
    ? field.subTableFields.filter(child => !isBuiltinField(child))
    : []
  if (currentChildren.length) {
    return currentChildren
  }

  const extra = getBlueprintFieldExtra(field)
  const subTableUID = Array.isArray(extra.subTableUID)
    ? String(extra.subTableUID[1] || '').trim()
    : ''
  if (subTableUID) {
    const subTable = context.tableMap?.get(subTableUID)
    const subTableFields = Array.isArray(subTable?.fields)
      ? subTable.fields.filter(child => !isBuiltinField(child))
      : []
    if (subTableFields.length) {
      return subTableFields
    }
  }

  return Array.isArray(extra.subColumns) ? extra.subColumns : []
}

const buildBlueprintFieldFromTableField = (
  field: BlueprintSourceField,
  index: number,
  context: BlueprintFieldBuildContext = {},
): NocodeEditorAiAppBlueprintField | null => {
  const fieldName = getBlueprintFieldName(field)
  if (!fieldName) {
    return null
  }

  const widget = context.widgetMap?.get(getBlueprintFieldMetaUid(field)) || null
  const childFields = getBlueprintSourceFieldChildren(field, context)
    .map((child, childIndex) => buildBlueprintFieldFromTableField(child, childIndex, context))
    .filter(Boolean) as NocodeEditorAiAppBlueprintField[]

  const enumOptions = normalizeBlueprintFieldEnumOptions(field, widget)
  return {
    fieldKey: String(field?.uid || `field-${index + 1}`).trim(),
    name: fieldName,
    widgetType: normalizeBlueprintFieldWidgetType(field, widget),
    description: normalizeBlueprintFieldDescription(field, widget),
    required: normalizeBlueprintFieldRequired(field, widget),
    placeholder: normalizeBlueprintFieldPlaceholder(field, widget),
    validationFormat: normalizeBlueprintFieldValidationFormat(field),
    enumOptions,
    children: childFields.length ? childFields : undefined,
  }
}

const buildBlueprintWidgetMapByTable = (formOptions: FormOptions = {}) => {
  const result = new Map<string, Map<string, Record<string, any>>>()

  Object.entries(formOptions).forEach(([tableId, formOption]) => {
    const rootWidgets = Array.isArray(formOption?.widget?.widgets)
      ? formOption.widget.widgets as Array<Record<string, any>>
      : []
    const widgetMap = new Map<string, Record<string, any>>()

    flattenWidgetTree(rootWidgets).forEach((widget) => {
      const uid = String(widget?.uid || '').trim()
      if (!uid) {
        return
      }
      widgetMap.set(uid, widget)
    })

    result.set(String(tableId || '').trim(), widgetMap)
  })

  return result
}

const normalizeSchemaFieldEnumSourceType = (field: Field) => {
  const sourceType = String(
    field?.meta?.extra?.enumSourceType
      || field?.meta?.extra?.['select-choices-type']
      || '',
  ).trim()
  if (sourceType) {
    return sourceType
  }

  const enumOptions = normalizeEnumOptions(field?.meta?.extra?.options || field?.meta?.extra?.enumOptions)
  return enumOptions.length ? 'custom' : ''
}

const buildAiWidgetSummaryFromSchemaField = (
  field: Field,
  index: number,
  parentUid = '',
): Record<string, any> | null => {
  if (field?.meta?.isSystem) {
    return null
  }

  const fieldName = String(field?.alias || field?.meta?.name || '').trim()
  if (!fieldName) {
    return null
  }

  const uid = String(field?.uid || `schema-field-${index + 1}`).trim()
  const widgetType = normalizeBlueprintFieldWidgetType(field) || 'widget.form.textInput'
  const enumOptionsPreview = normalizeEnumOptions(field?.meta?.extra?.options || field?.meta?.extra?.enumOptions)
  const enumSourceType = normalizeSchemaFieldEnumSourceType(field)
  const childFields = Array.isArray(field?.subTableFields)
    ? field.subTableFields
      .map((child, childIndex) => buildAiWidgetSummaryFromSchemaField(child, childIndex, uid))
      .filter(Boolean) as Array<Record<string, any>>
    : []

  return {
    uid,
    type: widgetType,
    name: fieldName,
    parentUid,
    enumSourceType: enumSourceType || undefined,
    enumOptionCount: enumSourceType ? enumOptionsPreview.length : undefined,
    enumOptionsPreview: enumSourceType === 'custom' ? enumOptionsPreview : [],
    children: childFields,
  }
}

const buildAiSchemaFallbackSummaryFromTable = (table?: Table | null) => {
  const widgets = (Array.isArray(table?.fields) ? table!.fields : [])
    .map((field, fieldIndex) => buildAiWidgetSummaryFromSchemaField(field, fieldIndex))
    .filter(Boolean) as Array<Record<string, any>>

  return {
    tableId: String(table?.uid || '').trim(),
    tableName: String(table?.alias || '').trim(),
    widgets,
  }
}

export const buildCurrentAppBlueprint = (
  tables: Table[] = [],
  structure: NocodeStructure[] = [],
  formOptions: FormOptions = {},
  appName = '',
): NocodeEditorAiAppBlueprint | null => {
  const visibleTables = tables.filter(item => !item?.meta?.extra?.primaryTable)
  if (!visibleTables.length) {
    return null
  }

  const groupNameMap = flattenNocodeStructureForms(structure)
  const tableMap = new Map(
    tables
      .map(table => [String(table?.uid || '').trim(), table] as const)
      .filter(([tableId]) => Boolean(tableId)),
  )
  const widgetMapByTable = buildBlueprintWidgetMapByTable(formOptions)
  const forms = visibleTables.map((table, tableIndex) => ({
    formKey: String(table?.uid || `form-${tableIndex + 1}`).trim(),
    tableName: String(table?.alias || '').trim() || `未命名表单${tableIndex + 1}`,
    groupName: String(groupNameMap.get(String(table?.uid || '').trim()) || '').trim() || undefined,
    description: String(table?.meta?.description || '').trim() || undefined,
    fields: (Array.isArray(table?.fields) ? table.fields : [])
      .filter(field => !isBuiltinField(field))
      .map((field, fieldIndex) => buildBlueprintFieldFromTableField(field, fieldIndex, {
        tableMap,
        widgetMap: widgetMapByTable.get(String(table?.uid || '').trim()),
      }))
      .filter(Boolean) as NocodeEditorAiAppBlueprintField[],
  }))

  return enhanceBlueprint({
    id: `current-app-${Date.now()}`,
    title: appName ? `${appName}当前蓝图` : '当前蓝图',
    summary: visibleTables.length ? `当前应用已包含 ${visibleTables.length} 个表单。` : undefined,
    forms,
    assumptions: [],
    openQuestions: [],
  })
}

export const useNocodeEditorAiHostRuntime = (
  options: NocodeEditorAiHostRuntimeOptions,
): NocodeEditorAiRuntime => {
  const getCurrentTables = () => options.nocode.value?.body?.formData?.tables || []
  const getCurrentStructure = () => options.structure?.value || options.nocode.value?.body?.structure || []
  const getCurrentTable = (input?: { tableId?: string; tableName?: string }) => {
    const tableId = String(input?.tableId || '').trim()
    const tableName = String(input?.tableName || '').trim()
    return getCurrentTables().find(item => String(item?.uid || '').trim() === tableId)
      || getCurrentTables().find(item => String(item?.alias || '').trim() === tableName)
      || null
  }

  const availableForms = computed(() => {
    const tables = getCurrentTables()
    const groupNameMap = flattenNocodeStructureForms(getCurrentStructure())
    return tables
      .filter(item => !item?.meta?.extra?.primaryTable)
      .map((item) => {
        const tableId = String(item?.uid || '').trim()
        const groupName = String(groupNameMap.get(tableId) || '').trim() || undefined
        return {
          tableId: item.uid,
          name: item.alias,
          groupName,
          targetIdentityKey: getNocodeEditorBlueprintFormApplyTargetIdentity({
            tableName: item.alias,
            groupName,
          }),
        }
      })
  })
  const stagedFormPlan = ref<NocodeEditorAiStagedFormPlan>({
    revision: 0,
    outline: null,
    applicationStructurePreview: null,
  })
  const stagedAppPlan = ref<NocodeEditorAiStagedAppPlan>({
    revision: 0,
    plan: null,
  })
  const stagedFlowScheme = ref<NocodeEditorAiStagedFlowScheme>({
    revision: 0,
    scheme: null,
    planningStatus: 'needs_confirmation',
    reviewResult: null,
    flowUnifiedIssues: null,
    flowIssueRouting: null,
  })
  const stagedFlowBlueprint = ref<NocodeEditorAiStagedFlowBlueprint>({
    revision: 0,
    sourceSchemeRevision: undefined,
    blueprint: null,
    mismatchReasons: null,
    applyResult: null,
  })
  const stagedFlowPlan = ref<NocodeEditorAiStagedFlowPlan>({
    revision: 0,
    sourceSchemeRevision: undefined,
    flowPlan: null,
    applyResult: null,
  })
  const stagedAppBlueprint = ref<NocodeEditorAiStagedAppBlueprint>({
    phase: 'staged',
    planningScope: 'unknown',
    revision: 0,
    blueprint: null,
    applyResult: null,
    draftPersistenceState: null,
    sourcePlanningContextKey: null,
  })
  const stagedContentPlan = ref<{
    revision: number
    stagedAt?: number
    plan: Record<string, any> | null
  }>({
    revision: 0,
    plan: null,
  })
  const stagedFormulaPlan = ref<NocodeEditorAiStagedFormulaPlan | null>(null)
  let activeFormulaTaskContextGetter = options.getActiveFormulaTaskContext
  let activeFormulaTaskContextRefresh: (() => Promise<void> | void) | undefined
  const setActiveFormulaTaskContext = (
    getter?: () => NocodeEditorAiActiveFormulaTaskContext | null | undefined,
    refresh?: () => Promise<void> | void,
  ) => {
    activeFormulaTaskContextGetter = getter
    activeFormulaTaskContextRefresh = refresh
  }
  const latestRelationAnalysis = ref<NocodeEditorRelationSignalAnalysis | null>(null)
  const formulaTaskContextGuard = {
    dirty: false,
    currentFormId: '',
  }

  const resetTaskContextGuard = () => {
    formulaTaskContextGuard.dirty = false
    formulaTaskContextGuard.currentFormId = ''
  }

  const markTaskContextGuardDirty = (formId: string) => {
    formulaTaskContextGuard.dirty = true
    formulaTaskContextGuard.currentFormId = String(formId || '').trim()
  }

  const resolveCurrentTaskContext = async (): Promise<NocodeEditorAiTaskContext> => {
    await nextTick()
    try {
      await activeFormulaTaskContextRefresh?.()
    } catch {
      throw createFormulaStageError('formula_context_unavailable', 'FORMULA_CONTEXT_UNAVAILABLE')
    }
    const taskContext = await Promise.resolve(
      options.getCurrentTaskContext?.()
      || options.formCreateRef.value?.getAiDefaultFormulaTaskContext?.()
      || null,
    )
    if (!taskContext) {
      throw new Error('当前表单任务上下文不可用')
    }
    formulaTaskContextGuard.dirty = false
    formulaTaskContextGuard.currentFormId = String(options.activeFormId.value || '').trim()
    return taskContext
  }

  const ensureFormulaTaskContextReady = (input: Record<string, any> | null | undefined) => {
    if (!hasFormulaSettingChanges(input)) {
      return
    }
    const activeFormId = String(options.activeFormId.value || '').trim()
    if (!formulaTaskContextGuard.dirty) {
      return
    }
    if (formulaTaskContextGuard.currentFormId && formulaTaskContextGuard.currentFormId !== activeFormId) {
      return
    }
    throw new Error('当前表单已切换，之前的公式任务上下文已失效。修改公式前，请先调用 editor_get_current_task_context 重新读取当前表单的指定任务上下文。')
  }

  const ensureFormulaStageContextFresh = () => {
    if (!formulaTaskContextGuard.dirty) {
      return
    }
    throw createFormulaStageError('formula_context_stale', 'FORMULA_CONTEXT_STALE')
  }
  const isApplyingStagedFlow = ref(false)
  const pendingExcelImportHandles = new Map<string, NocodeEditorAiExcelImportHandle>()

  const buildExcelImportHandleKey = (blueprintId: string, formKey: string) => (
    `${String(blueprintId || '').trim()}::${String(formKey || '').trim()}`
  )

  const isSameExcelImportHandle = (
    left?: NocodeEditorAiExcelImportHandle | null,
    right?: NocodeEditorAiExcelImportHandle | null,
  ) => {
    const leftFullPath = String(left?.fullPath || '').trim()
    const rightFullPath = String(right?.fullPath || '').trim()
    const leftSessionId = String(left?.sessionId || '').trim()
    const rightSessionId = String(right?.sessionId || '').trim()
    if (leftSessionId && rightSessionId) {
      return leftSessionId === rightSessionId
    }
    return Boolean(leftFullPath) && leftFullPath === rightFullPath
  }

  const releaseExcelImportHandle = async (
    handle?: NocodeEditorAiExcelImportHandle | null,
  ) => {
    const sessionId = String(handle?.sessionId || '').trim()
    if (!sessionId) {
      return
    }
    await axios.post('/nocode/cleanup-import-session', {
      sessionId,
    }).catch(() => null)
  }

  const clearPendingExcelImportHandles = async (
    retainHandles: NocodeEditorAiExcelImportHandle[] = [],
  ) => {
    const retained = Array.isArray(retainHandles) ? retainHandles : []
    const handlesToRelease = Array.from(pendingExcelImportHandles.values())
      .filter(handle => !retained.some(retain => isSameExcelImportHandle(handle, retain)))
    pendingExcelImportHandles.clear()
    for (const handle of handlesToRelease) {
      await releaseExcelImportHandle(handle)
    }
  }

  const getActivePlanningOutline = () => (
    stagedFormPlan.value.outline || stagedAppPlan.value.plan?.outline || null
  )

  const getActivePlanningStage = (): 'app-plan' | 'form-plan' | '' => {
    if (stagedFormPlan.value.outline) {
      return 'form-plan'
    }
    if (stagedAppPlan.value.plan?.outline) {
      return 'app-plan'
    }
    return ''
  }

  const resolvePlanningScopeFromContextKey = (
    value?: string | null,
  ): NocodeEditorPlanningScope => {
    const parts = String(value || '').trim().split(':')
    const stage = parts[0] === 'logical' ? parts[1] : parts[0]
    if (stage === 'form-plan') return 'form'
    if (stage === 'app-plan') return 'app'
    return 'unknown'
  }

  const resolveActiveBlueprintPlanningScope = (
    sourcePlanningContextKey?: string | null,
  ): NocodeEditorPlanningScope => {
    const scopeFromContext = resolvePlanningScopeFromContextKey(sourcePlanningContextKey)
    if (scopeFromContext !== 'unknown') {
      return scopeFromContext
    }
    const activeStage = getActivePlanningStage()
    if (activeStage === 'form-plan') return 'form'
    if (activeStage === 'app-plan') return 'app'
    return 'unknown'
  }

  const normalizeBlueprintGroupNamesForActivePlanning = (
    blueprint: NocodeEditorAiAppBlueprint,
  ) => {
    const activePlanningOutline = getActivePlanningOutline()
    const activePlanningStage = getActivePlanningStage()
    const outlineForms = activePlanningOutline?.forms || []

    blueprint.forms.forEach((form) => {
      const matchedOutlineForm = outlineForms.find(item => (
        (item.formKey && item.formKey === form.formKey)
        || isSameToken(item.tableName, form.tableName)
      ))
      if (activePlanningStage === 'form-plan' && blueprint.forms.length === 1) {
        form.groupName = matchedOutlineForm?.groupNameExplicit === true
          ? matchedOutlineForm.groupName
          : undefined
        return
      }
      if (form.groupName) {
        return
      }
      if (shouldCarryBlueprintFormGroupName({
        groupName: matchedOutlineForm?.groupName,
        groupNameExplicit: matchedOutlineForm?.groupNameExplicit,
        blueprintFormCount: blueprint.forms.length,
        outlineFormCount: outlineForms.length,
        moduleCount: activePlanningOutline?.modules?.length || 0,
      })) {
        form.groupName = matchedOutlineForm?.groupName
      }
    })
  }

  const getLatestCompletedPlanningCarryover = () => (
    resolveBlueprintPlanningCarryoverFromOutline(getActivePlanningOutline())
  )

  const resolveCurrentStagedPlanningContextKey = () => {
    const outline = getActivePlanningOutline()
    const stage = getActivePlanningStage()
    if (!outline || !stage) {
      return ''
    }

    const revision = stage === 'form-plan'
      ? Number(stagedFormPlan.value.revision || 0)
      : Number(stagedAppPlan.value.revision || 0)
    const stagedAt = stage === 'form-plan'
      ? Number(stagedFormPlan.value.stagedAt || 0)
      : Number(stagedAppPlan.value.stagedAt || 0)

    return buildPlanningConfirmationContextKey({
      stage,
      outlineId: outline.id,
      primaryFormKey: outline.forms?.[0]?.formKey || outline.forms?.[0]?.tableName,
      revision,
      stagedAt,
    })
  }

  const resolvePlanningCarryoverForToolInput = (input?: Record<string, any>) => {
    const confirmation = (
      input?.latestCompletedPlanningConfirmation as NocodeEditorAiConfirmPayload | null | undefined
    ) || null
    if (
      confirmation?.planningContextKey
      && !isSamePlanningConfirmationContext(
        confirmation.planningContextKey,
        resolveCurrentStagedPlanningContextKey(),
      )
    ) {
      return {
        resolvedQuestionIds: [],
        resolvedQuestions: [],
        fieldStrategyHints: [],
      }
    }
    const carryoverFromInput = resolveBlueprintPlanningCarryover(confirmation)
    if (
      carryoverFromInput.resolvedQuestionIds.length
      || carryoverFromInput.resolvedQuestions.length
      || carryoverFromInput.fieldStrategyHints.length
    ) {
      return carryoverFromInput
    }
    return getLatestCompletedPlanningCarryover()
  }

  const resolvePlanningContinuationForToolInput = (
    input?: Record<string, any>,
  ) => (
    (input?.planningContinuation as NocodeEditorAiPlanningContinuation | null | undefined)
    || null
  )

  const persistLatestCompletedPlanningConfirmation = (
    confirmation?: NocodeEditorAiConfirmPayload | null,
  ) => {
    const outline = getActivePlanningOutline() as NocodeEditorAiSolutionOutlineWithConfirmation | null
    if (!outline) {
      return
    }
    if (
      confirmation?.planningContextKey
      && !isSamePlanningConfirmationContext(
        confirmation.planningContextKey,
        resolveCurrentStagedPlanningContextKey(),
      )
    ) {
      return
    }

    const carryover = resolveBlueprintPlanningCarryover(confirmation)
    if (
      !carryover.resolvedQuestionIds.length
      && !carryover.resolvedQuestions.length
      && !carryover.fieldStrategyHints.length
    ) {
      return
    }

    const nextConfirmation = cloneValue(confirmation)
    if (valuesEqual(outline.confirmation, nextConfirmation)) {
      return
    }

    outline.confirmation = nextConfirmation
  }

  const rebuildBlueprintOpenQuestionsWithPlanningCarryover = (
    blueprint: NocodeEditorAiAppBlueprint | null | undefined,
    planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null,
  ) => {
    if (!blueprint) {
      return blueprint
    }

    blueprint.openQuestions = mergeBlueprintOpenQuestions(
      normalizeStringArray(blueprint.openQuestions).filter(question => (
        !isBlueprintFieldClarificationQuestion(question)
      )),
      deriveBlueprintClarificationQuestions(blueprint, {
        planningCarryover,
      }),
    )
    return blueprint
  }

  const resolveMode = async (): Promise<NocodeEditorAiMode> => {
    if (options.settingVisible.value) {
      return 'app-setting'
    }
    if (options.isShowFormCreate.value) {
      const editorContext = await Promise.resolve(options.formCreateRef.value?.getAiEditorContext?.())
      const activeTab = String(editorContext?.activeTab || '')
      if (activeTab === 'process-setting') {
        return 'process-setting'
      }
      return 'form-design'
    }
    if (options.activeProjectId.value) {
      return 'page-design'
    }
    return 'idle'
  }

  const getHostContext = async () => {
    const mode = await resolveMode()
    const activeForm = availableForms.value.find(item => item.tableId === options.activeFormId.value)
    return {
      nocodeId: options.nocodeId,
      mode,
      currentActiveId: options.currentActiveId.value || '',
      activeFormId: options.activeFormId.value || '',
      activeFormName: activeForm?.name || '',
      settingVisible: options.settingVisible.value,
      availableForms: availableForms.value,
      dirty: {
        form: Boolean(options.formCreateRef.value?.hasLocalChanges),
        page: Boolean(options.projectEditorRef.value?.projectChanged),
        aiDraft: Boolean(options.aiDraftDirty?.value),
      },
    }
  }

  const buildCurrentRelationContext = () => {
    return buildNocodeEditorRelationContextFromTables({
      appId: options.nocodeId,
      appName: String(options.nocode.value?.meta?.name || '').trim(),
      tables: getCurrentTables(),
      structure: getCurrentStructure(),
    })
  }

  const getRelationContext = async (input?: { requestText?: string; draftFormName?: string }) => {
    const { data } = await axios.get<NocodeEditorRelationContext | null>(
      `/ai/nocode-editor/apps/${options.nocodeId}/relation-context`,
    )

    const persisted = data || null
    const overlay = buildCurrentRelationContext()
    const effective = mergeNocodeEditorRelationContexts({
      persisted,
      overlay,
    })
    const analysis = analyzeNocodeEditorRelationSignals({
      userMessage: String(input?.requestText || '').trim(),
      draftFormName: String(input?.draftFormName || '').trim(),
      context: effective,
    })
    latestRelationAnalysis.value = cloneValue(analysis)

    return {
      persisted,
      overlay,
      effective,
      analysis,
    }
  }

  const getStagedFormPlan = async () => cloneValue(stagedFormPlan.value)
  const getStagedAppPlan = async () => cloneValue(stagedAppPlan.value)
  const getStagedFlowScheme = async () => cloneValue(stagedFlowScheme.value)
  const getStagedFlowPlan = async () => cloneValue(stagedFlowPlan.value)
  const getStagedFlowBlueprint = async () => cloneValue(stagedFlowBlueprint.value)
  const getStagedAppBlueprint = async (): Promise<NocodeEditorAiStagedAppBlueprint> => (
    cloneValue(stagedAppBlueprint.value) as NocodeEditorAiStagedAppBlueprint
  )

  const restoreStagedFormPlan = async (
    value: NocodeEditorAiStagedFormPlan | null,
  ) => {
    const rawOutline = value?.outline
      ? cloneValue(value.outline)
      : null
    const projection = rawOutline
      ? resolveNocodeEditorPlanningQuestionProjection({
        stage: 'form-plan',
        structuredConfirmation: rawOutline.confirmation,
        legacyOpenQuestions: rawOutline.openQuestions,
        summary: rawOutline.summary,
      })
      : null
    const outline = rawOutline
      ? {
        ...rawOutline,
        openQuestions: projection?.openQuestions || [],
        confirmation: projection?.confirmation || null,
      }
      : null

    stagedFormPlan.value = {
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      outline,
      applicationStructurePreview: value?.applicationStructurePreview
        ? cloneValue(value.applicationStructurePreview)
        : null,
    }

    if (outline && stagedAppBlueprint.value.blueprint) {
      rebuildBlueprintOpenQuestionsWithPlanningCarryover(
        stagedAppBlueprint.value.blueprint,
        getLatestCompletedPlanningCarryover(),
      )
    }

    if (!outline && stagedAppBlueprint.value.blueprint) {
      stagedAppBlueprint.value = createStagedBlueprintState({
        planningScope: 'unknown',
        revision: stagedAppBlueprint.value.revision + 1,
        stagedAt: undefined,
        blueprint: null,
        sourcePlanningContextKey: null,
      })
      options.markAiDraftStatus?.(null)
    }

    return cloneValue(stagedFormPlan.value)
  }

  const restoreStagedAppPlan = async (
    value: NocodeEditorAiStagedAppPlan | null,
  ) => {
    const plan = value?.plan
      ? normalizeAppPlan({ plan: cloneValue(value.plan) })
      : null

    stagedAppPlan.value = {
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      plan,
    }

    return cloneValue(stagedAppPlan.value)
  }

  const restoreStagedFlowScheme = async (
    value: NocodeEditorAiStagedFlowScheme | null,
  ) => {
    const rawScheme = value?.scheme
      ? cloneValue(value.scheme)
      : null
    const scheme = rawScheme
      ? decorateStagedFlowScheme(rawScheme)
      : null
    const routingState = resolveFlowSchemeRoutingState({
      scheme,
      planningContextKey: scheme?.confirmation?.planningContextKey,
      flowUnifiedIssues: value?.flowUnifiedIssues,
      flowIssueRouting: value?.flowIssueRouting,
    })
    const projectedScheme = scheme
      ? projectFlowSchemeWithRoutingState(scheme, routingState)
      : null

    stagedFlowScheme.value = {
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      scheme: projectedScheme,
      planningStatus: projectedScheme
        ? routingState.projection?.planningStatus || resolveFlowSchemePlanningStatus(projectedScheme)
        : value?.planningStatus || 'ready_for_review',
      reviewResult: value?.reviewResult ? cloneValue(value.reviewResult) : null,
      flowUnifiedIssues: routingState.flowUnifiedIssues,
      flowIssueRouting: routingState.flowIssueRouting,
    }

    return cloneValue(stagedFlowScheme.value)
  }

  const restoreStagedFlowPlan = async (
    value: NocodeEditorAiStagedFlowPlan | null,
  ) => {
    const restoredFlowPlan = value?.flowPlan ? cloneValue(value.flowPlan) : null
    const flowPlan = asRecord(restoredFlowPlan).validation
      ? stripLegacyFlowValidationState(restoredFlowPlan)
      : restoredFlowPlan

    stagedFlowPlan.value = {
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      sourceSchemeRevision: Number(value?.sourceSchemeRevision || 0) || undefined,
      flowPlan,
      applyResult: value?.applyResult ? cloneValue(value.applyResult) : null,
    }

    return cloneValue(stagedFlowPlan.value)
  }

  const restoreStagedFlowBlueprint = async (
    value: NocodeEditorAiStagedFlowBlueprint | null,
  ) => {
    const blueprint = value?.blueprint
      ? cloneValue(value.blueprint)
      : null
    const legacyFlowPlan = convertNocodeEditorFlowBlueprintToFlowPlan(blueprint)

    stagedFlowBlueprint.value = {
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      sourceSchemeRevision: Number(value?.sourceSchemeRevision || 0) || undefined,
      blueprint,
      mismatchReasons: Array.isArray(value?.mismatchReasons)
        ? cloneValue(value.mismatchReasons)
        : null,
      applyResult: value?.applyResult ? cloneValue(value.applyResult) : null,
    }
    stagedFlowPlan.value = {
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      sourceSchemeRevision: Number(value?.sourceSchemeRevision || 0) || undefined,
      flowPlan: legacyFlowPlan,
      applyResult: value?.applyResult ? cloneValue(value.applyResult) : null,
    }

    return cloneValue(stagedFlowBlueprint.value)
  }

  const restoreStagedAppBlueprint = async (
    value: NocodeEditorAiStagedAppBlueprint | null,
  ): Promise<NocodeEditorAiStagedAppBlueprint> => {
    const planningCarryover = getLatestCompletedPlanningCarryover()
    const blueprint = value?.blueprint
      ? enhanceBlueprint(normalizeSingleFormBlueprintFragments(cloneValue(value.blueprint)), {
        planningCarryover,
      })
      : null
    if (blueprint) {
      rebuildBlueprintOpenQuestionsWithPlanningCarryover(blueprint, planningCarryover)
    }

    const sourcePlanningContextKey = String(value?.sourcePlanningContextKey || '').trim() || null
    const baseInput = {
      planningScope: normalizeNocodeEditorPlanningScopeValue(value?.planningScope),
      revision: Number(value?.revision || 0),
      stagedAt: value?.stagedAt,
      blueprint,
      sourcePlanningContextKey,
    }
    if (value?.phase === 'applied_draft' && value.applyResult && value.draftPersistenceState) {
      stagedAppBlueprint.value = createAppliedDraftBlueprintState({
        ...baseInput,
        applyResult: cloneValue(value.applyResult),
        draftPersistenceState: cloneValue(value.draftPersistenceState),
      })
    } else if (value?.phase === 'applied_saved' && value.applyResult) {
      stagedAppBlueprint.value = createAppliedSavedBlueprintState({
        ...baseInput,
        applyResult: cloneValue(value.applyResult),
      })
    } else {
      stagedAppBlueprint.value = createStagedBlueprintState(baseInput)
    }
    options.markAiDraftStatus?.(((stagedAppBlueprint.value.draftPersistenceState || null) as any) as NocodeEditorAiDraftPersistenceState)

    return cloneValue(stagedAppBlueprint.value) as NocodeEditorAiStagedAppBlueprint
  }

  const stageExcelBlueprintDraft = async (
    input: NocodeEditorAiExcelBlueprintDraftInput,
  ): Promise<NocodeEditorAiStagedAppBlueprint> => {
    const fullPath = String(input?.importHandle?.fullPath || '').trim()
    if (!input?.source || !fullPath) {
      throw new Error('生成 Excel 蓝图草案缺少有效的文件上下文')
    }

    const blueprint = buildExcelBlueprintDraft(input)

    await clearPendingExcelImportHandles([input.importHandle])

    const nextBlueprint = enhanceBlueprint(
      normalizeSingleFormBlueprintFragments(cloneValue(blueprint)),
      {
        collectFieldClarifications: true,
      },
    )
    nextBlueprint.id = String(nextBlueprint.id || createBlueprintId()).trim() || createBlueprintId()

    stagedAppBlueprint.value = createStagedBlueprintState({
      planningScope: 'form',
      revision: stagedAppBlueprint.value.revision + 1,
      stagedAt: Date.now(),
      blueprint: nextBlueprint,
      sourcePlanningContextKey: null,
    })

    const blueprintId = String(nextBlueprint.id || '').trim()
    nextBlueprint.forms.forEach((form) => {
      const formKey = String(form.excelImportContext?.formKey || form.formKey || form.tableName).trim()
      if (!blueprintId || !formKey || !form.excelImportContext) {
        return
      }
      pendingExcelImportHandles.set(
        buildExcelImportHandleKey(blueprintId, formKey),
        cloneValue(input.importHandle),
      )
    })

    options.markAiDraftStatus?.(null)
    return cloneValue(stagedAppBlueprint.value) as NocodeEditorAiStagedAppBlueprint
  }

  const createForm = async (input: { tableName?: string; groupName?: string }) => {
    if (options.projectEditorRef.value?.projectChanged) {
      const saved = await options.projectEditorRef.value.saveProject?.(true)
      if (saved === false) {
        return {
          ok: false,
          reason: 'page_has_unsaved_changes',
        }
      }
    }

    if (options.formCreateRef.value?.hasLocalChanges || options.aiDraftDirty?.value) {
      const persisted = await options.formCreateRef.value?.persistForNavigation?.('internal_switch')
      if (persisted && !canContinueAfterNavigationPersistence(persisted)) {
        return {
          ok: false,
          reason: 'form_has_unsaved_changes',
        }
      }
    }

    return await options.createForm(input)
  }

  const openForm = async (input: { tableId?: string; tableName?: string; tab?: 'form-design' | 'process-setting' }) => {
    const tableId = String(input?.tableId || '').trim()
    const tableName = String(input?.tableName || '').trim()
    const targetTab = input?.tab === 'process-setting' ? 'process-setting' : 'form-design'
    const target = availableForms.value.find(item => item.tableId === tableId)
      || availableForms.value.find(item => item.name === tableName)

    if (!target) {
      return {
        ok: false,
        reason: 'form_not_found',
      }
    }

    if (options.activeFormId.value === target.tableId && options.isShowFormCreate.value) {
      const switched = await options.formCreateRef.value?.switchAiTab?.(targetTab)
      if (switched === false) {
        return {
          ok: false,
          reason: 'active_form_has_unsaved_changes',
        }
      }
      return {
        ok: true,
        tableId: target.tableId,
        tableName: target.name,
      }
    }

    if (options.projectEditorRef.value?.projectChanged) {
      const saved = await options.projectEditorRef.value.saveProject?.(true)
      if (saved === false) {
        return {
          ok: false,
          reason: 'page_has_unsaved_changes',
        }
      }
    }

    if (options.formCreateRef.value?.hasLocalChanges || options.aiDraftDirty?.value) {
      const persisted = await options.formCreateRef.value?.persistForNavigation?.('internal_switch')
      if (persisted && !canContinueAfterNavigationPersistence(persisted)) {
        return {
          ok: false,
          reason: 'form_has_unsaved_changes',
        }
      }
    }

    const table = options.nocode.value?.body?.formData?.tables?.find(item => item.uid === target.tableId)
    if (!table) {
      return {
        ok: false,
        reason: 'form_not_found',
      }
    }

    const ok = await options.showFormCreate(table, false)
    if (!ok) {
      return {
        ok: false,
        reason: 'open_form_failed',
      }
    }

    const switched = await options.formCreateRef.value?.switchAiTab?.(targetTab)
    if (switched === false) {
      return {
        ok: false,
        reason: 'active_form_has_unsaved_changes',
      }
    }
    return {
      ok: true,
      tableId: target.tableId,
      tableName: target.name,
    }
  }

  const openFormulaResultTarget = async (input: {
    tableId: string
    tableName?: string
    widgetId: string
  }) => {
    try {
      const tableId = String(input?.tableId || '').trim()
      const widgetId = String(input?.widgetId || '').trim()
      if (!tableId || !widgetId) {
        return {
          ok: false,
          reason: 'invalid_target',
        }
      }

      const opened = await openForm({
        tableId,
        tableName: input?.tableName,
      })
      if (!opened?.ok) {
        return {
          ok: false,
          reason: opened?.reason || 'open_form_failed',
        }
      }

      const formRuntime = await ensureFormRuntime()
      const formulaTarget = await formRuntime.openAiFormulaPanel?.({ widgetId })
      const widget = formulaTarget?.widget
      if (!widget) {
        return {
          ok: false,
          reason: 'widget_not_found',
        }
      }

      const overlayHost = options.formulaOverlayHost?.value
      if (!overlayHost) {
        return {
          ok: false,
          reason: 'formula_overlay_unavailable',
        }
      }

      const value = String(formulaTarget?.computeFormula || '').trim()
        ? formulaTarget.computeFormula
        : formulaTarget?.defaultFormula

      const handled = overlayHost({
        formWidget: widget,
        value,
        componentProps: {
          includeSelf: formulaTarget?.includeSelf,
          isLimitSubform: formulaTarget?.isLimitSubform,
        },
        onConfirm: () => undefined,
      })

      return {
        ok: Boolean(handled),
        ...(handled ? {} : { reason: 'open_formula_overlay_failed' }),
      }
    } catch (error) {
      const reason = normalizeFormulaResultTargetErrorReason(error)
      if (reason) {
        return {
          ok: false,
          reason,
        }
      }
      throw error
    }
  }

  const locateDraftIssue = async (
    issue: NocodeEditorAiDraftActionIssue,
  ): Promise<NocodeEditorAiDraftIssueLocateResult> => {
    if (issue.targetKind !== 'form_field') {
      return {
        ok: false,
        reason: 'unsupported_target',
        message: '当前版本暂不支持定位流程节点、页面或应用设置。',
      }
    }

    if (issue.locator.formId) {
      const opened = await openForm({
        tableId: issue.locator.formId,
        tableName: issue.locator.formLabel,
      })
      if (!opened?.ok) {
        return {
          ok: false,
          reason: 'target_not_found',
          message: '无法打开该字段所在表单，可能表单已被删除或蓝图已重新生成。',
        }
      }
      await nextTick()
    }

    const result = await options.formCreateRef.value?.focusAiDraftIssue?.(issue)
    return result || {
      ok: false,
      reason: 'runtime_unavailable',
      message: '当前表单编辑器尚未准备好。',
    }
  }

  const locateFlowIssue = async (
    issue: NocodeEditorAiFlowActionIssue,
  ): Promise<NocodeEditorAiFlowIssueLocateResult> => {
    if (issue.locator.formId) {
      const opened = await openForm({
        tableId: issue.locator.formId,
        tableName: issue.locator.formLabel,
        tab: 'process-setting',
      })
      if (!opened?.ok) {
        return {
          ok: false,
          reason: 'target_not_found',
          message: '无法打开该流程所在表单，可能表单已被删除或流程已重新生成。',
        }
      }
      await nextTick()
    }

    const result = await options.formCreateRef.value?.focusAiFlowIssue?.(issue)
    return result || {
      ok: false,
      reason: 'runtime_unavailable',
      message: '当前流程编辑器尚未准备好。',
    }
  }

  const ensureFormRuntime = async (): Promise<NocodeEditorAiFormRuntime> => {
    if (!options.isShowFormCreate.value || !options.formCreateRef.value) {
      throw new Error('当前未打开表单编辑器')
    }

    const switched = await options.formCreateRef.value.switchAiTab?.('form-design')
    if (switched === false) {
      throw new Error('当前表单不在可编辑的表单设计态，且存在未保存变更')
    }
    return options.formCreateRef.value
  }

  const resolveCurrentFormulaStageContext = async (
    activeTaskContext: NocodeEditorAiActiveFormulaTaskContext,
  ): Promise<NocodeEditorFormulaContextSnapshot> => {
    const taskScopeKey = String(activeTaskContext?.taskScopeKey || '').trim()
    const formId = String(options.activeFormId.value || '').trim()
    const contextFormId = String(activeTaskContext?.activeFormId || '').trim()
    if (!taskScopeKey || !formId || contextFormId !== formId) {
      throw createFormulaStageError('formula_context_unavailable', 'FORMULA_CONTEXT_UNAVAILABLE')
    }

    const formRuntime = await ensureFormRuntime()
    const formSummary = await formRuntime.getAiFormSummary?.()
    const summaryFormId = String(formSummary?.tableId || '').trim()
    if (!formSummary || (summaryFormId && summaryFormId !== formId)) {
      throw createFormulaStageError('formula_context_unavailable', 'FORMULA_CONTEXT_UNAVAILABLE')
    }

    const draftRevision = Number(formSummary?.draftRevision ?? formSummary?.draftVersion)
    const evidence = {
      formId,
      fields: flattenWidgetTree(Array.isArray(formSummary.widgets) ? formSummary.widgets : [])
        .map(widget => ({
          widgetId: String(widget?.uid || widget?.widgetId || '').trim(),
          fieldKey: String(widget?.fieldKey || '').trim() || undefined,
          fieldName: String(widget?.fieldName || widget?.name || widget?.title || '').trim() || undefined,
          title: String(widget?.title || widget?.name || '').trim() || undefined,
          valueType: String(widget?.valueType || '').trim() || undefined,
          widgetType: String(widget?.type || widget?.widgetType || '').trim() || undefined,
        }))
        .filter(field => field.widgetId),
    }

    return {
      ...(String(activeTaskContext.taskId || '').trim() ? { taskId: String(activeTaskContext.taskId).trim() } : {}),
      taskScopeKey,
      nocodeId: String(options.nocodeId || '').trim(),
      formId,
      ...(Number.isFinite(draftRevision) ? { draftRevision } : {}),
      evidenceFingerprint: buildNocodeEditorFormulaEvidenceFingerprint(evidence),
      capturedAt: Date.now(),
    }
  }

  const buildCurrentFormulaPreflightForm = async (): Promise<NocodeEditorFormulaPreflightForm> => {
    const formRuntime = await ensureFormRuntime()
    const formSummary = await formRuntime.getAiFormSummary?.()
    const tableId = String(formSummary?.tableId || options.activeFormId.value || '').trim()
    if (!formSummary || !tableId) {
      throw createFormulaStageError('formula_context_unavailable', 'FORMULA_CONTEXT_UNAVAILABLE')
    }

    const formulaContext = await formRuntime.getAiDefaultFormulaTaskContext?.()
    const formulaFields = Array.isArray(formulaContext?.fieldList)
      ? formulaContext.fieldList
      : []
    const tokenByTitle = buildCurrentRowFormulaTokenByTitle(formulaFields)
    const fields = flattenWidgetTree(Array.isArray(formSummary.widgets) ? formSummary.widgets : [])
      .map(widget => {
        const widgetId = String(widget?.uid || widget?.widgetId || '').trim()
        const fieldName = String(widget?.fieldName || widget?.name || widget?.title || '').trim()
        const fieldKey = String(widget?.fieldKey || fieldName || '').trim()
        const token = tokenByTitle.get(fieldName) || widgetId
        const widgetType = String(widget?.widgetType || widget?.type || '').trim()
        return widgetId && fieldName && token
          ? {
            widgetId,
            fieldKey,
            fieldName,
            token,
            formulaPaths: resolveBlueprintFormulaPaths({
              widgetType,
              formulaPaths: widget?.formulaPaths,
            }) as NocodeEditorFormulaPath[],
          }
          : null
      })
      .filter((field): field is NonNullable<typeof field> => Boolean(field))

    return {
      formKey: tableId,
      formName: String(formSummary.tableName || '').trim() || undefined,
      tableId,
      fields,
    }
  }

const normalizeFormulaExecutorItemsForComparison = (value: unknown) => (
  (Array.isArray(value) ? value : []).map(item => {
      const status = String(item?.status || '').trim()
      if (status === 'skipped') {
        return {
          status,
          fieldName: String(item?.fieldName || item?.name || '').trim(),
          reason: String(item?.reason || '').trim(),
        }
      }

      return {
        status,
        widgetId: String(item?.widgetId || '').trim(),
        changes: (Array.isArray(item?.changes) ? item.changes : []).map(change => ({
          path: Array.isArray(change?.path) && change.path.length
            ? change.path.map(part => String(part || '').trim()).filter(Boolean).join('.')
            : String(change?.key || '').trim(),
          value: change?.value,
          unset: change?.unset === true,
        })),
      }
    })
  )

  const ensureStagedFormulaExecutorContext = async () => {
    const stagedPlan = stagedFormulaPlan.value
    if (!stagedPlan) {
      throw createFormulaStageError('formula_plan_required', 'FORMULA_PLAN_REQUIRED')
    }
    if (resolveNocodeEditorFormulaAdvance({ plan: stagedPlan.plan }) !== 'continue_apply') {
      throw createFormulaStageError('formula_plan_required', 'FORMULA_PLAN_REQUIRED')
    }
    const activeTaskContext = activeFormulaTaskContextGetter?.()
    if (!activeTaskContext) {
      throw createFormulaStageError('formula_context_stale', 'FORMULA_CONTEXT_STALE')
    }
    const currentContext = await resolveCurrentFormulaStageContext(activeTaskContext)
    const refreshAction = resolveFormulaContextRefreshAction({
      snapshot: stagedPlan.sourceContext,
      ...currentContext,
    })
    if (refreshAction !== 'continue') {
      throw createFormulaStageError('formula_context_stale', 'FORMULA_CONTEXT_STALE')
    }

    const expectedPlanFingerprint = buildNocodeEditorFormulaPlanFingerprint(stagedPlan.plan)
    if (!stagedPlan.formulaPlanFingerprint || stagedPlan.formulaPlanFingerprint !== expectedPlanFingerprint) {
      throw createFormulaStageError('formula_plan_required', 'FORMULA_PLAN_REQUIRED')
    }

    const preflight = preflightNocodeEditorFormulaPlan({
      plan: stagedPlan.plan,
      forms: [await buildCurrentFormulaPreflightForm()],
    })
    return buildFormulaToolItems(preflight)
  }

  const tryApplyFormulaOverlayDraft = async (input: {
    widgetId: string
    tableId?: string
    tableName?: string
    fieldName?: string
    explanation?: string
    changes: Array<Record<string, any>>
  }) => {
    const formulaChange = findFormulaSettingChange(input.changes)
    if (!formulaChange) {
      return null
    }

    const overlayDraftHost = options.formulaOverlayDraftHost?.value
    if (!overlayDraftHost) {
      return null
    }

    const overlayDraftResult = await overlayDraftHost({
      widgetId: input.widgetId,
      value: formulaChange.change?.value,
      ...(input.tableId ? { tableId: input.tableId } : {}),
      ...(input.tableName ? { tableName: input.tableName } : {}),
      ...(input.fieldName ? { fieldName: input.fieldName } : {}),
      formulaPath: formulaChange.formulaPath,
      ...(input.explanation ? { explanation: input.explanation } : {}),
    })
    if (!overlayDraftResult) {
      return null
    }

    const draftResult = overlayDraftResult && typeof overlayDraftResult === 'object'
      ? overlayDraftResult as Record<string, any>
      : {}
    const draftTarget = {
      status: 'draft',
      tableId: String(draftResult.tableId || input.tableId || '').trim(),
      tableName: String(draftResult.tableName || input.tableName || '').trim(),
      widgetId: input.widgetId,
      fieldName: String(draftResult.fieldName || input.fieldName || input.widgetId).trim(),
      formula: formulaChange.formula,
      formulaPath: formulaChange.formulaPath,
      ...(input.explanation ? { explanation: input.explanation } : {}),
      draftOnly: true,
      overlayDraft: true,
    }

    return {
      itemResult: {
        widgetId: input.widgetId,
        tableId: draftTarget.tableId,
        tableName: draftTarget.tableName,
        name: draftTarget.fieldName,
        applied: [],
        formulaUpdates: [],
        formulaDraftUpdates: [draftTarget],
        draftOnly: true,
        overlayDraft: true,
      },
      targetResult: draftTarget,
    }
  }

  const ensureProcessRuntime = async (): Promise<NocodeEditorAiFormRuntime> => {
    if (!options.isShowFormCreate.value || !options.formCreateRef.value) {
      throw new Error('当前未打开表单编辑器')
    }

    const switched = await options.formCreateRef.value.switchAiTab?.('process-setting')
    if (switched === false) {
      throw new Error('当前表单不在可编辑的流程设计态，且存在未保存变更')
    }
    return options.formCreateRef.value
  }

  const syncCurrentAiDraft = async (syncOptions: {
    persistToApp?: boolean
    skipProcessValidation?: boolean
  } = {}) => {
    if (!options.formCreateRef.value?.hasLocalChanges) {
      return {
        ok: true,
        persistedToSession: true,
        persistedToApp: Boolean(syncOptions.persistToApp),
        hasBlockingIssues: false,
        issues: [],
      } satisfies NocodeEditorAiDraftSaveResult
    }
    if (!options.formCreateRef.value?.saveAiDraft) {
      throw new Error('当前编辑器不支持 AI 草稿同步')
    }
    const result = await options.formCreateRef.value.saveAiDraft({
      persistToApp: Boolean(syncOptions.persistToApp),
      skipProcessValidation: Boolean(syncOptions.skipProcessValidation),
    })
    if (!isDraftSaveFailed(result)) {
      const hasBlockingDraft = result.hasBlockingIssues
        || result.flowIssueState?.mode === 'flow_issue'
        || result.persistedToApp !== true
      options.markAiDraftDirty?.(hasBlockingDraft)
    }
    return result
  }

  const viewFlowPatchResult = async (
    input: NocodeEditorAiViewFlowPatchResultInput,
  ): Promise<NocodeEditorAiViewFlowPatchResult> => {
    const formId = String(input?.formId || '').trim()
    const draftVersion = Number(input?.draftVersion)
    if (!formId || !Number.isInteger(draftVersion) || draftVersion <= 0) {
      return { ok: false, reason: '流程修改记录缺少有效的目标表单或草稿版本' }
    }

    const target = availableForms.value.find(item => item.tableId === formId)
    if (!target) {
      return { ok: false, reason: '未找到流程修改记录对应的表单' }
    }

    const opened = await openForm({
      tableId: target.tableId,
      tableName: target.name,
      tab: 'process-setting',
    })
    if (!opened.ok) {
      return { ok: false, reason: `无法打开目标表单流程页：${opened.reason || '打开失败'}` }
    }
    await nextTick()
    if (String(options.activeFormId.value || '').trim() !== target.tableId) {
      return { ok: false, reason: '目标表单未成功切换，请稍后重试' }
    }

    try {
      const formRuntime = await ensureProcessRuntime()
      if (!formRuntime.viewAiFlowPatchResult) {
        return { ok: false, reason: '当前流程编辑器不支持查看历史草稿' }
      }
      const viewed = await formRuntime.viewAiFlowPatchResult({ draftVersion })
      return viewed === true
        ? { ok: true }
        : { ok: false, reason: `无法切换到流程草稿 V${draftVersion}` }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error || '')
      return { ok: false, reason: reason || `无法查看流程草稿 V${draftVersion}` }
    }
  }

  const saveCurrentFormBeforeBlueprintApply = async (): Promise<{ ok: boolean; message?: string }> => {
    const formRuntime = options.formCreateRef.value
    if (!formRuntime) {
      return { ok: false, message: '当前表单编辑器不可用，暂时无法保存后继续生成' }
    }
    if (!formRuntime.hasLocalChanges && !options.aiDraftDirty?.value) {
      return { ok: true }
    }
    if (!formRuntime.save) {
      return { ok: false, message: '当前表单缺少保存能力，暂时无法继续生成' }
    }

    try {
      const saveResult = await formRuntime.save?.(true)
      if (saveResult === false || saveResult === 'blocked' || saveResult === 'failed') {
        return { ok: false, message: '当前表单保存失败，请补齐配置后重试' }
      }
      if (formRuntime.hasLocalChanges) {
        return { ok: false, message: '当前表单保存后仍有未处理修改，请检查后重试' }
      }
      options.markAiDraftDirty?.(false)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '')
      return { ok: false, message: message || '当前表单保存失败，请补齐配置后重试' }
    }
  }

  const getDraftPersistenceSourceMarkers = (
    state?: NocodeEditorAiDraftPersistenceState | null,
  ) => ({
    sourceTraceId: String(state?.sourceTraceId || '').trim() || undefined,
    sourceBlueprintIdentityKey: String(state?.sourceBlueprintIdentityKey || '').trim() || undefined,
    sourceBlueprintVersionKey: String(state?.sourceBlueprintVersionKey || '').trim() || undefined,
    sourceFormId: String(state?.sourceFormId || '').trim() || undefined,
  })

  const getDraftPersistenceSourceState = () => (
    options.aiDraftSourceStatus?.value
    || options.aiDraftStatus?.value
    || null
  )

  const getStagedBlueprintMarker = (input?: {
    phase?: NocodeEditorAiStagedAppBlueprint['phase']
    applyResult?: NocodeEditorAiBlueprintApplyResult | null
  }) => ({
    identityKey: String(getNocodeEditorAiBlueprintIdentityKey({
      blueprint: stagedAppBlueprint.value.blueprint,
      revision: stagedAppBlueprint.value.revision,
      stagedAt: stagedAppBlueprint.value.stagedAt,
      sourcePlanningContextKey: stagedAppBlueprint.value.sourcePlanningContextKey,
    }) || '').trim() || undefined,
    versionKey: String(buildBlueprintArtifactVersionFromParts({
      revision: stagedAppBlueprint.value.revision,
      stagedAt: stagedAppBlueprint.value.stagedAt,
      phase: input?.phase || stagedAppBlueprint.value.phase,
      applyResult: input?.applyResult || stagedAppBlueprint.value.applyResult,
    }) || '').trim() || undefined,
  })

  const shouldAttemptCrossBlueprintAutosave = () => {
    const hasDirtyState = Boolean(
      options.formCreateRef.value?.hasLocalChanges
      || options.projectEditorRef.value?.projectChanged
      || options.aiDraftDirty?.value
      || (options.aiDraftStatus?.value?.mode === 'draft_only' && options.aiDraftStatus?.value?.dirty !== false)
    )
    if (!hasDirtyState) {
      return false
    }

    const sourceState = getDraftPersistenceSourceState()
    const sourceMarker = getDraftPersistenceSourceMarkers(sourceState)
    const currentBlueprintMarker = getStagedBlueprintMarker()
    const activeFormId = String(options.activeFormId.value || '').trim() || undefined
    const hasSourceMarker = Boolean(
      sourceMarker.sourceBlueprintVersionKey
      || sourceMarker.sourceBlueprintIdentityKey
    )
    if (!hasSourceMarker) {
      return false
    }
    if (sourceMarker.sourceFormId && activeFormId && sourceMarker.sourceFormId !== activeFormId) {
      return false
    }

    if (
      sourceMarker.sourceBlueprintVersionKey
      && currentBlueprintMarker.versionKey
    ) {
      return sourceMarker.sourceBlueprintVersionKey !== currentBlueprintMarker.versionKey
    }

    if (
      sourceMarker.sourceBlueprintIdentityKey
      && currentBlueprintMarker.identityKey
    ) {
      return sourceMarker.sourceBlueprintIdentityKey !== currentBlueprintMarker.identityKey
    }

    return false
  }

  const completeBlueprintPersistenceAfterDraftSync = async (persistOptions: {
    formalSaveFailureMessage: string
    projectSaveFailureMessage: string
  }) => {
    const formRuntime = options.formCreateRef.value
    const hasDirtyFormState = Boolean(formRuntime?.hasLocalChanges || options.aiDraftDirty?.value)

    if (formRuntime?.save && hasDirtyFormState) {
      const saved = await formRuntime.save(true)
      if (saved === 'blocked' || saved === 'failed' || saved === false) {
        throw new Error(persistOptions.formalSaveFailureMessage)
      }
    }

    if (options.projectEditorRef.value?.projectChanged) {
      const saved = await options.projectEditorRef.value.saveProject?.(true)
      if (saved === false) {
        throw new Error(persistOptions.projectSaveFailureMessage)
      }
    }
  }

  type BlueprintPersistOutcome =
    | { mode: 'saved' }
    | { mode: 'draft_only'; draft: NocodeEditorAiDraftSaveResult }

  const runBlueprintPersistencePipeline = async (input: {
    formRuntime?: NocodeEditorAiFormRuntime | null
    draftSyncFailureMessage: string
    formalSaveFailureMessage: string
    projectSaveFailureMessage: string
    preferCallerDraftSyncFailureMessage?: boolean
    skipProcessValidation?: boolean
  }): Promise<BlueprintPersistOutcome> => {
    const formRuntime = input.formRuntime
    const draftResult = await formRuntime?.saveAiDraft?.({
      persistToApp: true,
      skipProcessValidation: Boolean(input.skipProcessValidation),
    })
    if (draftResult && draftResult.ok === false) {
      throw new Error(input.preferCallerDraftSyncFailureMessage
        ? input.draftSyncFailureMessage || draftResult.error || '蓝图草稿同步失败'
        : draftResult.error || input.draftSyncFailureMessage || '蓝图草稿同步失败')
    }

    if (draftResult && hasCrossBlueprintDraftBlockingIssues(draftResult)) {
      return { mode: 'draft_only', draft: draftResult }
    }

    await completeBlueprintPersistenceAfterDraftSync({
      formalSaveFailureMessage: input.formalSaveFailureMessage,
      projectSaveFailureMessage: input.projectSaveFailureMessage,
    })

    return { mode: 'saved' }
  }

  const persistAppliedBlueprint = async (): Promise<BlueprintPersistOutcome> => {
    const formRuntime = options.formCreateRef.value
    return await runBlueprintPersistencePipeline({
      formRuntime,
      draftSyncFailureMessage: '蓝图已写入编辑器，但草稿同步失败',
      formalSaveFailureMessage: '蓝图已写入编辑器，但正式保存失败，请先完成配置后再保存',
      projectSaveFailureMessage: '已按蓝图生成，但自动保存失败，请先手动保存后再刷新页面',
    })
  }

  const ensureReadyForCrossBlueprintApply = async (
    applyOptions?: NocodeEditorAiBlueprintApplyOptions,
    targetExistingFormIds: Set<string> = new Set(),
  ): Promise<{ persistedPreviousFormDraft: boolean }> => {
    const PREVIOUS_BLUEPRINT_DRAFT_ONLY_MESSAGE = '上一份蓝图已写入草稿，但还有待补配置，请先补齐后再继续按蓝图生成'
    const PREVIOUS_BLUEPRINT_NOT_PERSISTED_MESSAGE = '上一份蓝图未保存完成，暂不能继续按蓝图生成'
    const currentDraftStatus = getDraftPersistenceSourceState()
    const sourceBlueprintVersionKey = String(currentDraftStatus?.sourceBlueprintVersionKey || '').trim() || undefined
    const sourceBlueprintIdentityKey = String(currentDraftStatus?.sourceBlueprintIdentityKey || '').trim() || undefined
    const sourceTraceId = String(currentDraftStatus?.sourceTraceId || '').trim() || undefined
    const sourceFormId = String(currentDraftStatus?.sourceFormId || '').trim() || undefined
    const activeFormId = String(options.activeFormId.value || '').trim() || undefined
    const draftSourceFormId = sourceFormId || activeFormId
    const targetsSourceForm = Boolean(
      draftSourceFormId
      && targetExistingFormIds.has(draftSourceFormId),
    )
    const hasCurrentFlowIssues = Boolean(
      options.formCreateRef.value?.currentFlowIssueState?.mode === 'flow_issue',
    )
    const shouldPersistCurrentFlowDraft = Boolean(
      hasCurrentFlowIssues
      && options.formCreateRef.value?.hasLocalChanges
    )
    const requiresSameTargetProtection = Boolean(
      targetsSourceForm
      && (
        hasCurrentFlowIssues
        || (
          currentDraftStatus?.mode === 'draft_only'
          && currentDraftStatus.resolved !== true
          && Number(currentDraftStatus.issueCount || 0) > 0
        )
      ),
    )
    if (
      !shouldAttemptCrossBlueprintAutosave()
      && !requiresSameTargetProtection
      && !shouldPersistCurrentFlowDraft
    ) {
      return { persistedPreviousFormDraft: false }
    }

    await applyOptions?.onProgress?.({
      stage: 'saving-previous-blueprint',
    })

    if (
      !options.formCreateRef.value?.hasLocalChanges
      && targetsSourceForm
      && hasCurrentFlowIssues
    ) {
      throw new Error(PREVIOUS_BLUEPRINT_DRAFT_ONLY_MESSAGE)
    }

    if (
      !options.formCreateRef.value?.hasLocalChanges
      && currentDraftStatus?.mode === 'draft_only'
      && (currentDraftStatus.dirty !== false || requiresSameTargetProtection)
    ) {
      options.markAiDraftStatus?.(currentDraftStatus)
      const continuation = resolveCrossBlueprintDraftContinuation({
        saveResult: {
          ok: true,
          persistedToSession: true,
          persistedToApp: currentDraftStatus.persistedToApp === true,
          hasBlockingIssues: true,
        },
        targetsSourceForm,
      })
      if (continuation.kind === 'block') {
        throw new Error(continuation.reason === 'same_target_incomplete'
          ? PREVIOUS_BLUEPRINT_DRAFT_ONLY_MESSAGE
          : PREVIOUS_BLUEPRINT_NOT_PERSISTED_MESSAGE)
      }
      return { persistedPreviousFormDraft: true }
    }

    const formRuntime = options.formCreateRef.value
    // 跨蓝图预保存仍通过 formRuntime?.saveAiDraft?.({ persistToApp: true }) 进入共享持久化链路。
    const persistOutcome = await runBlueprintPersistencePipeline({
      formRuntime,
      draftSyncFailureMessage: PREVIOUS_BLUEPRINT_NOT_PERSISTED_MESSAGE,
      formalSaveFailureMessage: PREVIOUS_BLUEPRINT_NOT_PERSISTED_MESSAGE,
      projectSaveFailureMessage: PREVIOUS_BLUEPRINT_NOT_PERSISTED_MESSAGE,
      preferCallerDraftSyncFailureMessage: true,
      skipProcessValidation: true,
    })
    if (persistOutcome.mode === 'draft_only') {
      const draftState = buildBlueprintDraftPersistenceState(persistOutcome.draft, {
        sourceTraceId,
        sourceBlueprintIdentityKey,
        sourceBlueprintVersionKey,
        sourceFormId: activeFormId || sourceFormId,
      })
      options.markAiDraftStatus?.(draftState)
      const continuation = resolveCrossBlueprintDraftContinuation({
        saveResult: persistOutcome.draft,
        targetsSourceForm,
      })
      if (continuation.kind === 'block') {
        throw new Error(continuation.reason === 'same_target_incomplete'
          ? PREVIOUS_BLUEPRINT_DRAFT_ONLY_MESSAGE
          : PREVIOUS_BLUEPRINT_NOT_PERSISTED_MESSAGE)
      }
      return { persistedPreviousFormDraft: true }
    }
    options.markAiDraftStatus?.(null)
    return { persistedPreviousFormDraft: false }
  }

  const restoreHostFocus = async (snapshot: {
    mode: NocodeEditorAiMode
    activeFormId: string
    activeProjectId: string
    activeProjectName: string
  }) => {
    if (snapshot.mode === 'form-design' || snapshot.mode === 'process-setting') {
      if (!snapshot.activeFormId) return
      const reopened = await openForm({
        tableId: snapshot.activeFormId,
        tab: snapshot.mode === 'process-setting' ? 'process-setting' : 'form-design',
      })
      if (!reopened?.ok) {
        throw new Error(`restore_active_form_failed:${reopened?.reason || 'open_form_failed'}`)
      }
      return
    }

    if (snapshot.mode === 'page-design') {
      if (!snapshot.activeProjectId || !options.openProject) return
      await options.hideFormCreate?.(false)
      await options.openProject(snapshot.activeProjectId, snapshot.activeProjectName || undefined)
      return
    }

    if (snapshot.mode === 'app-setting') {
      if (options.isShowFormCreate.value) {
        await options.hideFormCreate?.(false)
      }
      options.settingVisible.value = true
      return
    }

    if (snapshot.mode === 'idle' && options.isShowFormCreate.value) {
      await options.hideFormCreate?.(false)
    }
  }

  const withPreservedActiveForm = async <T>(handler: () => Promise<T>) => {
    const originalMode = await resolveMode()
    const originalFormId = String(options.activeFormId.value || '').trim()
    const originalProjectId = String(options.activeProjectId.value || '').trim()
    const originalProjectName = String(
      options.projectEditorRef.value?.projectData?.name
      || options.projectEditorRef.value?.project?.name
      || '',
    ).trim()
    try {
      return await handler()
    } finally {
      const currentMode = await resolveMode()
      const currentFormId = String(options.activeFormId.value || '').trim()
      const currentProjectId = String(options.activeProjectId.value || '').trim()
      if (
        currentMode !== originalMode
        || currentFormId !== originalFormId
        || currentProjectId !== originalProjectId
      ) {
        await restoreHostFocus({
          mode: originalMode,
          activeFormId: originalFormId,
          activeProjectId: originalProjectId,
          activeProjectName: originalProjectName,
        })
      }
    }
  }

  const getAllFormSummaries = async (input?: { enumOnly?: boolean }) => {
    const enumOnly = Boolean(input?.enumOnly)
    return await withPreservedActiveForm(async () => {
      const summaries: Array<Record<string, any>> = []
      for (const form of availableForms.value) {
        const opened = await openForm({
          tableId: form.tableId,
        })
        if (!opened?.ok) {
          summaries.push({
            tableId: form.tableId,
            tableName: form.name,
            error: opened?.reason || 'open_form_failed',
          })
          continue
        }
        const formRuntime = await ensureFormRuntime()
        const summary = await formRuntime.getAiFormSummary?.()
        const widgets = Array.isArray(summary?.widgets) ? summary.widgets : []
        const compactEnumWidgets = flattenWidgetTree(widgets)
          .filter(item => Boolean(String(item?.enumSourceType || '').trim()))
          .map(item => ({
            uid: item.uid,
            type: item.type,
            name: item.name,
            parentUid: item.parentUid || '',
            enumSourceType: item.enumSourceType,
            enumOptionCount: item.enumOptionCount,
            enumOptionsPreview: Array.isArray(item.enumOptionsPreview) ? item.enumOptionsPreview : [],
          }))
        summaries.push({
          tableId: summary?.tableId || form.tableId,
          tableName: summary?.tableName || form.name,
          widgets: enumOnly ? compactEnumWidgets : widgets,
        })
      }
      return {
        forms: summaries,
      }
    })
  }

  const getTargetedFormSummaries = async (input?: {
    targets?: Array<{ tableId?: string; tableName?: string }>
  }) => {
    const signalLevel = String(latestRelationAnalysis.value?.signalLevel || '').trim()
    if (signalLevel && signalLevel !== 'strong') {
      const firstQuestion = Array.isArray(latestRelationAnalysis.value?.openQuestions)
        ? String(latestRelationAnalysis.value?.openQuestions?.[0] || '').trim()
        : ''
      throw new Error(firstQuestion || 'relation_signal_not_strong')
    }

    const targetMap = new Set(
      (Array.isArray(input?.targets) ? input!.targets : [])
        .flatMap(item => [String(item?.tableId || '').trim(), String(item?.tableName || '').trim()])
        .filter(Boolean),
    )

    if (!targetMap.size) {
      return {
        forms: [],
      }
    }

    return await withPreservedActiveForm(async () => {
      const summaries: Array<Record<string, any>> = []
      for (const form of availableForms.value.filter(item => targetMap.has(String(item.tableId || '').trim()) || targetMap.has(String(item.name || '').trim()))) {
        const opened = await openForm({
          tableId: form.tableId,
        })
        if (!opened?.ok) {
          summaries.push({
            tableId: form.tableId,
            tableName: form.name,
            error: opened?.reason || 'open_form_failed',
          })
          continue
        }
        const formRuntime = await ensureFormRuntime()
        const summary = await formRuntime.getAiFormSummary?.()
        const runtimeWidgets = Array.isArray(summary?.widgets) ? summary.widgets : []
        const table = getCurrentTable({
          tableId: summary?.tableId || form.tableId,
          tableName: summary?.tableName || form.name,
        })
        const schemaFallback = !runtimeWidgets.length
          ? buildAiSchemaFallbackSummaryFromTable(table)
          : null
        const fallbackWidgets = Array.isArray(schemaFallback?.widgets) ? schemaFallback.widgets : []
        summaries.push(compactFormSummaryForModel({
          tableId: summary?.tableId || schemaFallback?.tableId || form.tableId,
          tableName: summary?.tableName || schemaFallback?.tableName || form.name,
          widgets: runtimeWidgets.length ? runtimeWidgets : fallbackWidgets,
          summarySource: runtimeWidgets.length ? 'runtime' : fallbackWidgets.length ? 'schema-fallback' : 'runtime-empty',
          availableWidgetTypes: Array.isArray(summary?.availableWidgetTypes) ? summary.availableWidgetTypes : [],
        }))
      }
      return {
        forms: summaries,
      }
    })
  }

  const setEnumOptions = async (input: {
    updates?: Array<{
      tableId?: string
      tableName?: string
      widgetId?: string
      options?: Array<string | NocodeEditorAiBlueprintOption>
    }>
  }) => {
    const updates = Array.isArray(input?.updates)
      ? input.updates
      : []

    if (!updates.length) {
      return {
        ok: true,
        applied: [],
        failed: [],
      }
    }

    return await withPreservedActiveForm(async () => {
      const applied: Array<Record<string, any>> = []
      const failed: Array<Record<string, any>> = []
      let currentTargetKey = ''
      let formRuntime: NocodeEditorAiFormRuntime | null = null

      for (const update of updates) {
        const tableId = String(update?.tableId || '').trim()
        const tableName = String(update?.tableName || '').trim()
        const widgetId = String(update?.widgetId || '').trim()
        const enumOptions = normalizeEnumOptions(update?.options)

        if (!widgetId) {
          failed.push({
            tableId,
            tableName,
            widgetId,
            reason: 'widget_id_required',
          })
          continue
        }

        const targetKey = tableId || tableName || '__current__'
        if (targetKey !== currentTargetKey) {
          if (tableId || tableName) {
            const opened = await openForm({
              tableId,
              tableName,
            })
            if (!opened?.ok) {
              failed.push({
                tableId,
                tableName,
                widgetId,
                reason: opened?.reason || 'open_form_failed',
              })
              continue
            }
          }
          formRuntime = await ensureFormRuntime()
          currentTargetKey = targetKey
        }

        if (!formRuntime) {
          failed.push({
            tableId,
            tableName,
            widgetId,
            reason: 'form_runtime_unavailable',
          })
          continue
        }

        const schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
        const choiceTypeOption = findSchemaOption(schema, {
          keys: ['select-choices-type'],
        })
        const enumOption = findSchemaOption(schema, {
          keys: [
            'radiogroup-value-text-color-option',
            'treeselect-value-text-option',
            'checkbox-option',
          ],
          labels: ['选项设置', '选项'],
          typeIncludes: ['colored-array'],
        })

        if (!enumOption) {
          failed.push({
            tableId,
            tableName,
            widgetId,
            reason: 'enum_option_not_found',
          })
          continue
        }

        const currentValue = enumOption.currentValue && typeof enumOption.currentValue === 'object'
          ? enumOption.currentValue
          : {}
        const nextValue = {
          ...currentValue,
          isColored: Boolean((currentValue as any)?.isColored),
          options: enumOptions,
        }
        const changes: Array<Record<string, any>> = []

        if (choiceTypeOption && !valuesEqual(choiceTypeOption.currentValue, 'custom')) {
          changes.push({
            path: choiceTypeOption.path,
            value: 'custom',
          })
        }

        if (!valuesEqual((currentValue as any)?.options || [], enumOptions)) {
          changes.push({
            path: enumOption.path,
            value: nextValue,
          })
        }

        if (!changes.length) {
          applied.push({
            tableId,
            tableName,
            widgetId,
            skipped: true,
          })
          continue
        }

        await formRuntime.setAiFieldOptions?.({
          widgetId,
          changes,
        })

        applied.push({
          tableId,
          tableName,
          widgetId,
          optionCount: enumOptions.length,
        })
      }

      if (options.formCreateRef.value?.hasLocalChanges) {
        await syncCurrentAiDraft()
      }

      return {
        ok: failed.length === 0,
        applied,
        failed,
      }
    })
  }

  const getFlowSummary = async () => {
    const formRuntime = await ensureProcessRuntime()
    return await formRuntime.getAiFlowSummary?.()
  }

  const patchFlow = async (
    input: Record<string, unknown>,
  ): Promise<NocodeEditorFlowPatchResult> => {
    try {
      const normalized = normalizeNocodeEditorFlowPatch(input)
      if (normalized.ok === false) {
        throw new NocodeEditorFlowPatchError(normalized.code, normalized.message)
      }

      const formRuntime = await ensureProcessRuntime()
      const applyAiFlowPatch = formRuntime.applyAiFlowPatch
      const finalizeAiFlowPatch = formRuntime.finalizeAiFlowPatch
      const rollbackAiFlowPatch = formRuntime.rollbackAiFlowPatch
      if (
        typeof applyAiFlowPatch !== 'function'
        || typeof finalizeAiFlowPatch !== 'function'
        || typeof rollbackAiFlowPatch !== 'function'
      ) {
        throw new Error('当前流程编辑器不支持节点级局部修改事务')
      }

      const mutation = await applyAiFlowPatch.call(formRuntime, { patch: normalized.patch })
      if (!mutation) {
        throw new Error('当前流程编辑器不支持节点级局部修改')
      }

      try {
        const draftResult = await syncCurrentAiDraft({
          persistToApp: true,
          skipProcessValidation: true,
        })
        if (
          draftResult.ok === false
          || draftResult.persistedToSession === false
          || draftResult.persistedToApp === false
        ) {
          throw new Error(draftResult.error || '流程草稿同步失败')
        }
      } catch (error) {
        const syncError = error instanceof Error ? error : new Error(String(error))
        try {
          const rollbackResult = await rollbackAiFlowPatch.call(formRuntime, {
            mutationId: mutation.mutationId,
          })
          if (rollbackResult === false) {
            Object.assign(syncError, {
              flowPatchRollbackFailed: true,
              flowPatchRollbackResult: false,
              flowPatchRollbackError: '流程局部修改回滚未生效',
            })
          }
        } catch (rollbackError) {
          Object.assign(syncError, {
            flowPatchRollbackFailed: true,
            flowPatchRollbackError: rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
          })
        }
        throw syncError
      }

      try {
        const finalized = await finalizeAiFlowPatch.call(formRuntime, {
          mutationId: mutation.mutationId,
        })
        if (finalized === false) {
          throw new Error('流程局部修改已持久化，但事务状态确认失败')
        }
      } catch (error) {
        const finalizeError = error instanceof Error ? error : new Error(String(error))
        Object.assign(finalizeError, {
          flowPatchPersisted: true,
          flowPatchFinalizeFailed: true,
          flowPatchFinalizeError: finalizeError.message,
        })
        throw finalizeError
      }

      return mutation.result
    } catch (error) {
      if (error instanceof NocodeEditorFlowPatchError) {
        const flowUnifiedIssues = buildUnifiedFlowIssuesFromExecutionBlocker({
          issueId: error.code,
          sourceStage: 'patch',
          blockedNextAction: 'editor_patch_flow',
          userMessage: error.message,
          code: error.code,
        })
        Object.assign(error, {
          flowPatchErrorCode: error.code,
          requiresFullRebuild: error.code === 'requires_full_rebuild',
          flowUnifiedIssues,
          flowIssueRouting: routeUnifiedFlowIssues(flowUnifiedIssues),
          blockedNextAction: 'editor_patch_flow',
        })
      }
      throw error
    }
  }

  const stageFormPlan = async (
    input: Record<string, any>,
    titleFallback = '表单规划',
  ) => {
    const previousStagedBlueprint = stagedAppBlueprint.value
    const latestCompletedPlanningConfirmation = (
      input?.latestCompletedPlanningConfirmation as NocodeEditorAiConfirmPayload | null | undefined
    ) || null
    const planningContinuation = resolvePlanningContinuationForToolInput(input)
    const planningContextKey = latestCompletedPlanningConfirmation?.planningContextKey || planningContinuation?.planningContextKey
    const normalizedFormPlanOutline = normalizeNocodeEditorPlanningOutline(
      normalizeSolutionOutline(input, titleFallback),
      {
        titleFallback,
        confirmationStage: 'form-plan',
        legacyConfirmation: input?.confirmation,
        legacyOpenQuestions: input?.openQuestions,
        legacyOpenQuestionsMode: 'fallback-only',
      },
    )
    if (!normalizedFormPlanOutline) {
      throw new Error('规划至少需要包含一个表单')
    }
    const outline = alignPlanningOutlineIdentityToContextKey(
      normalizedFormPlanOutline as NocodeEditorAiSolutionOutline,
      planningContextKey,
      {
        force: Boolean(latestCompletedPlanningConfirmation),
        forceReason: latestCompletedPlanningConfirmation ? 'confirmed-same-chain' : undefined,
      },
    )
    const applicationStructurePreview = buildApplicationStructurePreview({
      outline,
      previewMode: 'form-plan',
      enabled: shouldEnableFormPlanStructurePreview({
        outline,
        relationAnalysis: latestRelationAnalysis.value,
      }),
    })
    stagedFormPlan.value = {
      revision: stagedFormPlan.value.revision + 1,
      stagedAt: Date.now(),
      outline: {
        ...outline,
        flowIntent: normalizeNocodeEditorFlowIntentSignal(outline.flowIntent || input?.outline?.flowIntent || input?.flowIntent),
      },
      applicationStructurePreview,
    }
    if (
      previousStagedBlueprint.blueprint
      && shouldPlanningSupersedeBlueprint({
        planningRevision: stagedFormPlan.value.revision,
        planningStagedAt: stagedFormPlan.value.stagedAt,
        blueprintRevision: previousStagedBlueprint.revision,
        blueprintStagedAt: previousStagedBlueprint.stagedAt,
      })
    ) {
      stagedAppBlueprint.value = createStagedBlueprintState({
        planningScope: 'unknown',
        revision: previousStagedBlueprint.revision + 1,
        stagedAt: undefined,
        blueprint: null,
        sourcePlanningContextKey: null,
      })
      options.markAiDraftStatus?.(null)
    }
    return cloneValue(stagedFormPlan.value)
  }

  const normalizeAppPlan = (input: Record<string, any>): NocodeEditorAiAppPlan => {
    const raw = input?.plan && typeof input.plan === 'object'
      ? input.plan as Record<string, any>
      : {}
    const artifacts = Array.isArray(raw.artifacts)
      ? raw.artifacts
        .map((item: Record<string, any>) => ({
          type: String(item?.type || 'artifact').trim() || 'artifact',
          name: String(item?.name || '').trim(),
          executionLevel: String(item?.executionLevel || item?.execution_level || '').trim() || undefined,
          purpose: String(item?.purpose || '').trim() || undefined,
        }))
        .filter((item: { name: string }) => item.name)
      : []
    const openQuestionsSource = Array.isArray(raw.openQuestions)
      ? raw.openQuestions
      : raw.open_questions
    const goal = String(raw.goal || '').trim()
    const objects = normalizeStringArray(raw.objects)
    const openQuestions = normalizeStringArray(openQuestionsSource)
    const outline = normalizeSolutionOutline({
      outline: resolveAppPlanOutlineInput({
        rawOutline: raw.outline,
        fallbackOutline: buildFallbackAppPlanOutlineInput({
          goal,
          objects,
          artifacts,
          openQuestions,
        }),
      }),
      flowIntent: raw.flowIntent,
    }, goal ? `${goal}应用结构` : '应用结构')
    const flowIntent = normalizeNocodeEditorFlowIntentSignal(raw.flowIntent || outline.flowIntent)
    const projection = resolveNocodeEditorPlanningQuestionProjection({
      stage: 'app-plan',
      structuredConfirmation: outline.confirmation,
      legacyConfirmation: raw.confirmation,
      legacyOpenQuestions: [
        ...openQuestions,
        ...(Array.isArray(outline.openQuestions) ? outline.openQuestions : []),
      ],
      legacyOpenQuestionsMode: 'fallback-only',
      summary: goal || outline.summary,
    })
    const plan: NocodeEditorAiAppPlan = {
      id: String(raw.id || '').trim() || undefined,
      mode: String(raw.mode || '').trim() || 'greenfield',
      goal,
      objects,
      artifacts,
      openQuestions: projection.openQuestions,
      outline: {
        ...outline,
        openQuestions: projection.openQuestions,
        confirmation: projection.confirmation,
        flowIntent,
      },
      flowIntent,
    }
    if (!plan.goal) {
      throw new Error('应用规划缺少目标说明')
    }
    if (!plan.artifacts.length) {
      throw new Error('应用规划至少需要包含一个制品')
    }
    return plan
  }

  const stageAppPlan = async (input: Record<string, any>) => {
    const previousStagedBlueprint = stagedAppBlueprint.value
    const plan = normalizeAppPlan(input)
    const latestCompletedPlanningConfirmation = (
      input?.latestCompletedPlanningConfirmation as NocodeEditorAiConfirmPayload | null | undefined
    ) || null
    const planningContinuation = resolvePlanningContinuationForToolInput(input)
    const planningContextKey = latestCompletedPlanningConfirmation?.planningContextKey || planningContinuation?.planningContextKey
    plan.outline = alignPlanningOutlineIdentityToContextKey(
      plan.outline,
      planningContextKey,
      {
        force: Boolean(latestCompletedPlanningConfirmation),
        forceReason: latestCompletedPlanningConfirmation ? 'confirmed-same-chain' : undefined,
      },
    )
    stagedAppPlan.value = {
      revision: stagedAppPlan.value.revision + 1,
      stagedAt: Date.now(),
      plan,
    }
    if (
      previousStagedBlueprint.blueprint
      && shouldPlanningSupersedeBlueprint({
        planningRevision: stagedAppPlan.value.revision,
        planningStagedAt: stagedAppPlan.value.stagedAt,
        blueprintRevision: previousStagedBlueprint.revision,
        blueprintStagedAt: previousStagedBlueprint.stagedAt,
      })
    ) {
      stagedAppBlueprint.value = createStagedBlueprintState({
        planningScope: 'unknown',
        revision: previousStagedBlueprint.revision + 1,
        stagedAt: undefined,
        blueprint: null,
        sourcePlanningContextKey: null,
      })
      options.markAiDraftStatus?.(null)
    }
    return cloneValue(stagedAppPlan.value)
  }

  const stageContentPlan = async (input: Record<string, any>) => {
    const plan = normalizeNocodeEditorContentPlan(input?.plan, { forNewStage: true })
    if (!plan) {
      throw new Error('内容规划缺少标题、摘要或目标对象')
    }

    stagedContentPlan.value = {
      revision: stagedContentPlan.value.revision + 1,
      stagedAt: Date.now(),
      plan,
    }

    return {
      ok: true,
      ...cloneValue(stagedContentPlan.value),
      revision: stagedContentPlan.value.revision,
    }
  }

  const stageFormulaPlan = async (input: Record<string, any>) => {
    const plan = normalizeNocodeEditorFormulaPlan(input?.plan)
    if (!plan) {
      throw createFormulaStageError('formula_plan_invalid', 'FORMULA_PLAN_INVALID')
    }

    ensureFormulaStageContextFresh()

    const activeTaskContext = activeFormulaTaskContextGetter?.()
    if (!activeTaskContext) {
      throw createFormulaStageError('formula_context_unavailable', 'FORMULA_CONTEXT_UNAVAILABLE')
    }

    const sourceContext = await resolveCurrentFormulaStageContext(activeTaskContext)
    const preflight = preflightNocodeEditorFormulaPlan({
      plan,
      forms: [await buildCurrentFormulaPreflightForm()],
    })
    const formulaAdvance = resolveNocodeEditorFormulaAdvance({ plan })
    const planningScope = resolveNocodeEditorFormulaPlanningScope({
      origin: 'standalone',
      carriedPlanningScope: normalizeNocodeEditorPlanningScopeValue(activeTaskContext.planningScope),
      carriedTaskScopeKey: activeTaskContext.carriedTaskScopeKey,
      carriedTargetFormId: activeTaskContext.carriedTargetFormId,
      sourceTaskScopeKey: sourceContext.taskScopeKey,
      sourceFormId: sourceContext.formId,
      sameTaskScope: String(activeTaskContext.carriedTaskScopeKey || '').trim() === sourceContext.taskScopeKey,
      sameTargetForm: String(activeTaskContext.carriedTargetFormId || '').trim() === sourceContext.formId,
      taskSummary: activeTaskContext.taskSummary || null,
    })
    const nextStagedFormulaPlan: NocodeEditorAiStagedFormulaPlan = {
      origin: 'standalone',
      planningScope,
      revision: Number(stagedFormulaPlan.value?.revision || 0) + 1,
      stagedAt: Date.now(),
      sourceContext,
      plan,
      formulaPlanFingerprint: buildNocodeEditorFormulaPlanFingerprint(plan),
    }
    stagedFormulaPlan.value = nextStagedFormulaPlan

    return {
      ok: true,
      ...cloneValue(nextStagedFormulaPlan),
      displayMode: resolveNocodeEditorFormulaPlanDisplayMode(plan),
      formulaAdvance,
      checkpoint: null,
      shouldContinueApply: formulaAdvance === 'continue_apply',
      preflight: {
        resolvedWriteCount: preflight.resolvedWrites.length,
        issueCount: preflight.issues.length,
      },
    }
  }

  const inferFlowValidationFieldLabel = (diagnostic: NocodeEditorFlowPlanDiagnostic) => {
    const explicitFieldLabel = String(diagnostic.fieldLabel || '').trim()
    if (explicitFieldLabel) {
      return explicitFieldLabel
    }

    const diagnosticMessage = String(diagnostic.message || '').trim()
    if (!diagnosticMessage) {
      return ''
    }

    if (diagnosticMessage.includes('目标表单')) return '目标表单'
    if (diagnosticMessage.includes('来源表单')) return '来源表单'
    if (diagnosticMessage.includes('审批人')) return '审批人'
    if (diagnosticMessage.includes('办理人')) return '办理人'
    if (diagnosticMessage.includes('通知对象')) return '通知对象'
    if (diagnosticMessage.includes('填报人')) return '填报人'
    if (diagnosticMessage.includes('新增字段映射')) return '新增字段映射'
    if (diagnosticMessage.includes('更新字段映射')) return '更新字段映射'
    if (diagnosticMessage.includes('删除条件')) return '删除条件'
    if (diagnosticMessage.includes('触发事件')) return '触发事件'
    if (diagnosticMessage.includes('定时规则')) return '定时规则'

    return ''
  }

  const buildFlowValidationQuestionTitle = (diagnostic: NocodeEditorFlowPlanDiagnostic) => {
    const fieldLabel = inferFlowValidationFieldLabel(diagnostic)
    const nodeName = String(diagnostic.nodeName || '').trim()
    const branchLabel = String(diagnostic.branchLabel || '').trim()

    if (fieldLabel && nodeName) {
      return `请补充“${nodeName}”的${fieldLabel}`
    }
    if (fieldLabel && branchLabel) {
      return `请补充“${branchLabel}”的${fieldLabel}`
    }
    if (fieldLabel) {
      return `请补充${fieldLabel}`
    }
    if (nodeName) {
      return `请补充“${nodeName}”的必要配置`
    }
    if (branchLabel) {
      return `请补充“${branchLabel}”分支的必要配置`
    }

    return '请补充当前流程蓝图缺失的必要配置'
  }

  const stripLegacyFlowValidationState = (
    flowPlan: NocodeEditorFlowPlan,
  ) => {
    const legacyValidation = asRecord(asRecord(flowPlan).validation)
    const validationQuestionTitles = new Set(
      asArray(legacyValidation.diagnostics)
        .map(item => String(buildFlowValidationQuestionTitle(item as NocodeEditorFlowPlanDiagnostic) || '').trim())
        .filter(Boolean),
    )
    const openQuestions = normalizeStringArray(flowPlan.openQuestions)
      .filter(question => !validationQuestionTitles.has(String(question || '').trim()))
    return normalizeNocodeEditorFlowPlan({
      ...flowPlan,
      openQuestions,
    }) || {
      ...flowPlan,
      openQuestions,
    }
  }

  const buildFlowValidationFailurePayload = (
    error: unknown,
  ) => {
    const message = error instanceof Error ? error.message : String(error || '').trim()
    return {
      status: 'failed',
      compilable: false,
      summary: message || '当前流程蓝图还有生成前待补配置。',
      diagnostics: [{
        id: 'flow-diagnostic-dry-run-error',
        code: 'dry_run_error',
        level: 'error',
        message: message || '当前流程蓝图还有生成前待补配置。',
        scopeKind: 'overview',
      }],
    }
  }

  const normalizeFlowValidationPayload = (
    validationResult: Record<string, any> | null | undefined,
  ) => {
    const validation = asRecord(validationResult?.validation)
    const status = String(validation.status || '').trim()
      || (validationResult?.compilable === false ? 'failed' : 'passed')
    const compilable = typeof validation.compilable === 'boolean'
      ? validation.compilable
      : validationResult?.compilable !== false
    return {
      ...validation,
      status,
      compilable,
      summary: String(validation.summary || '').trim()
        || (compilable ? '当前流程规划已通过流程 dry-run 校验。' : '当前流程蓝图还有生成前待补配置。'),
      diagnostics: Array.isArray(validation.diagnostics) ? validation.diagnostics : [],
    }
  }

  const resolveFlowValidationOpenQuestions = (
    validation: Record<string, any>,
  ) => {
    const status = String(validation.status || '').trim()
    const compilable = validation.compilable !== false
    if (status === 'not_validated') {
      return []
    }
    if (compilable && status !== 'failed') {
      return []
    }
    const questions = asArray(validation.diagnostics)
      .map(item => String(buildFlowValidationQuestionTitle(item as NocodeEditorFlowPlanDiagnostic) || '').trim())
      .filter(Boolean)
    return normalizeStringArray(questions.length ? questions : ['请补充当前流程蓝图缺失的必要配置'])
  }

  const attachFlowValidationToPlan = (
    flowPlan: NocodeEditorFlowPlan,
    validation: Record<string, any>,
  ): NocodeEditorFlowPlan => {
    const validationQuestions = resolveFlowValidationOpenQuestions(validation)
    const openQuestions = normalizeStringArray([
      ...(flowPlan.openQuestions || []),
      ...validationQuestions,
    ])
    const normalized = normalizeNocodeEditorFlowPlan({
      ...flowPlan,
      openQuestions,
      ...(validationQuestions.length
        ? { _flowValidationKeepsConfirmationQuestionsLlmOnly: true }
        : {}),
    }) || {
      ...flowPlan,
      openQuestions,
    }
    return {
      ...normalized,
      validation,
      ...(validationQuestions.length
        ? { _flowValidationKeepsConfirmationQuestionsLlmOnly: true }
        : {}),
    } as NocodeEditorFlowPlan
  }

  const buildFlowNotValidatedPlan = (
    flowPlan: NocodeEditorFlowPlan,
  ): NocodeEditorFlowPlan => attachFlowValidationToPlan(flowPlan, {
    status: 'not_validated',
    compilable: false,
    summary: '当前流程蓝图还未在目标表单上下文完成 dry-run 校验；切到目标表单后才能按蓝图生成表单流程。',
    diagnostics: [],
  })

  const validateFlowPlanWithRuntime = async (
    flowPlan: NocodeEditorFlowPlan,
    formRuntime: NocodeEditorAiFormRuntime,
  ) => {
    if (!formRuntime.validateAiFlowPlan) {
      throw new Error('当前表单流程校验能力不可用，请刷新后重试')
    }
    try {
      const validationResult = await formRuntime.validateAiFlowPlan({ plan: flowPlan })
      const validation = asRecord(validationResult?.validation)
      const hasValidationStatus = Boolean(String(validation.status || '').trim())
      const hasCompilableResult = typeof validation.compilable === 'boolean'
        || typeof validationResult?.compilable === 'boolean'
      if (validationResult?.ok !== true || (!hasValidationStatus && !hasCompilableResult)) {
        throw new Error('当前表单流程校验能力不可用，请刷新后重试')
      }
      return attachFlowValidationToPlan(
        flowPlan,
        normalizeFlowValidationPayload(validationResult),
      )
    } catch (error) {
      return attachFlowValidationToPlan(
        flowPlan,
        buildFlowValidationFailurePayload(error),
      )
    }
  }

  const assertFlowPlanCanPassOptimizerStrictValidation = (
    flowPlan: NocodeEditorFlowPlan,
  ) => {
    const validation = asRecord((flowPlan as Record<string, any>).validation)
    const validationStatus = String(validation.status || '').trim()
    const validationPassed = validationStatus === 'passed' && validation.compilable === true
    if (!validationPassed) {
      const validationSummary = String(validation.summary || '').trim()
      throw new Error(`流程规划未通过流程校验：${validationSummary || '当前流程蓝图缺少必要配置'}`)
    }
    const validationQuestions = resolveFlowValidationOpenQuestions(validation)
    const planningQuestions = normalizeStringArray(flowPlan.openQuestions)
    const confirmationQuestions = resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(flowPlan)
    const unresolvedQuestions = normalizeStringArray([
      ...validationQuestions,
      ...planningQuestions,
      ...confirmationQuestions,
    ])
    if (unresolvedQuestions.length) {
      throw new Error(`流程规划未通过流程校验：${unresolvedQuestions[0]}`)
    }
  }

  const decorateStagedFlowScheme = (
    scheme: NocodeEditorFlowScheme,
  ) => decorateFlowSchemeWithConvergence({
    scheme: {
      ...scheme,
      convergence: null,
    },
    deriveDependencies: false,
    deriveDeferredConfigItems: false,
  })

  const resolveFlowSchemePlanningStatus = (
    scheme: NocodeEditorFlowScheme,
  ) => (
    scheme.convergence?.businessStatus === 'pending'
      || scheme.convergence?.dependencyStatus === 'pending'
      ? 'needs_confirmation'
      : 'ready_for_review'
  )

  const buildFlowSchemeRoutingState = (input: {
    scheme?: NocodeEditorFlowScheme | null
    planningContextKey?: string | null
    internalIssues?: UnifiedFlowIssue[]
  }) => {
    const flowUnifiedIssues = [
      ...buildUnifiedFlowIssuesFromFlowScheme({
        scheme: input.scheme || null,
        planningContextKey: String(input.planningContextKey || '').trim() || undefined,
      }),
      ...(input.internalIssues || []),
    ]
    const flowIssueRouting = routeUnifiedFlowIssues(flowUnifiedIssues)
    const projection = projectFlowIssueRouteToLegacyFields({
      issues: flowUnifiedIssues,
      routing: flowIssueRouting,
      planningContextKey: String(input.planningContextKey || '').trim() || undefined,
      stage: 'flow-scheme',
    })
    return {
      flowUnifiedIssues,
      flowIssueRouting,
      projection,
    }
  }

  const resolveFlowSchemeRoutingState = (input: {
    scheme?: NocodeEditorFlowScheme | null
    planningContextKey?: string | null
    flowUnifiedIssues?: unknown
    flowIssueRouting?: unknown
  }) => {
    if (!input.scheme) {
      return {
        flowUnifiedIssues: null,
        flowIssueRouting: null,
        projection: null,
      }
    }

    const inputFlowUnifiedIssues = normalizeUnifiedFlowIssues(input.flowUnifiedIssues)
    const flowUnifiedIssues = inputFlowUnifiedIssues.length
      ? inputFlowUnifiedIssues
      : buildUnifiedFlowIssuesFromFlowScheme({
        scheme: input.scheme,
        planningContextKey: String(input.planningContextKey || '').trim() || undefined,
      })
    const inputFlowIssueRouting = normalizeFlowIssueRoutingResult(input.flowIssueRouting)
    const derivedRouting = routeUnifiedFlowIssues(flowUnifiedIssues)
    const canCarryInputRoutingDetails = derivedRouting.activeIssues.length > 0
    const flowIssueRouting: FlowIssueRoutingResult = {
      ...derivedRouting,
      blockedNextAction: derivedRouting.blockedNextAction
        || (canCarryInputRoutingDetails ? inputFlowIssueRouting?.blockedNextAction : undefined),
      userMessage: derivedRouting.userMessage
        || (canCarryInputRoutingDetails ? inputFlowIssueRouting?.userMessage : undefined),
    }
    const projection = projectFlowIssueRouteToLegacyFields({
      issues: flowUnifiedIssues,
      routing: flowIssueRouting,
      planningContextKey: String(input.planningContextKey || '').trim() || undefined,
      stage: 'flow-scheme',
    })
    return {
      flowUnifiedIssues,
      flowIssueRouting,
      projection,
    }
  }

  const projectFlowSchemeWithRoutingState = (
    scheme: NocodeEditorFlowScheme,
    routingState: ReturnType<typeof buildFlowSchemeRoutingState> | ReturnType<typeof resolveFlowSchemeRoutingState>,
  ): NocodeEditorFlowScheme => {
    if (
      routingState.flowIssueRouting?.outcome === 'return_to_flow_scheme'
      && routingState.projection
    ) {
      return {
        ...scheme,
        openQuestions: routingState.projection.openQuestions,
        confirmation: routingState.projection.confirmation,
      }
    }

    const completedQuestions = (scheme.confirmation?.questions || []).filter(question => (
      question.confirmed === true
      || Boolean(question.selectedOptionValue || question.answerSummary || question.answerDetail)
      || Boolean(question.options?.some(option => option.selected))
    ))
    if (routingState.flowIssueRouting?.outcome === 'system_error') {
      return {
        ...scheme,
        openQuestions: [],
        confirmation: completedQuestions.length
          ? {
              ...scheme.confirmation,
              status: 'completed',
              questions: completedQuestions,
            }
          : null,
      }
    }

    return completedQuestions.length ? scheme : {
      ...scheme,
      confirmation: null,
    }
  }

  const resolveCurrentFlowPlanningContextKey = (fallback?: unknown) => (
    String(
      fallback
      || stagedFlowScheme.value.scheme?.confirmation?.planningContextKey
      || stagedFlowScheme.value.flowIssueRouting?.activeIssues?.[0]?.planningContextKey
      || '',
    ).trim()
  )

  const stageFlowScheme = async (input: Record<string, any>) => {
    const scheme = normalizeNocodeEditorFlowScheme(input?.scheme || input)
    if (!scheme) {
      throw new Error('流程方案缺少标题、摘要或触发信息')
    }

    const hostContext = await getHostContext()
    const targetedScheme: NocodeEditorFlowScheme = {
      ...scheme,
      target: {
        formId: scheme.target?.formId || hostContext?.activeFormId || undefined,
        formName: scheme.target?.formName || hostContext?.activeFormName || undefined,
      },
    }
    const activeFormId = String(hostContext?.activeFormId || '').trim()
    const activeFormName = String(hostContext?.activeFormName || '').trim()
    const targetFormId = String(targetedScheme.target?.formId || '').trim()
    const targetFormName = String(targetedScheme.target?.formName || '').trim()
    const schemePlanningContextKey = String(targetedScheme.confirmation?.planningContextKey || '').trim()
    const trustedConfirmationContext = asRecord(input?.__flowSchemeConfirmationContext)
    const trustedPlanningContextKey = String(trustedConfirmationContext.planningContextKey || '').trim()
    const trustedContinuationPlanningContextKey = String(
      trustedConfirmationContext.continuationPlanningContextKey || '',
    ).trim()
    const trustedTargetFormId = String(trustedConfirmationContext.targetFormId || '').trim()
    const trustedTargetFormName = String(trustedConfirmationContext.targetFormName || '').trim()
    const trustedTargetMatches = Boolean(
      (trustedTargetFormId && targetFormId && trustedTargetFormId === targetFormId)
      || (
        !trustedTargetFormId
        && trustedTargetFormName
        && targetFormName
        && isSameToken(trustedTargetFormName, targetFormName)
      ),
    )
    const trustedContextMatches = Boolean(
      trustedPlanningContextKey
      && trustedContinuationPlanningContextKey
      && isSamePlanningConfirmationContext(
        trustedPlanningContextKey,
        trustedContinuationPlanningContextKey,
      )
      && (!schemePlanningContextKey || isSamePlanningConfirmationContext(
        trustedPlanningContextKey,
        schemePlanningContextKey,
      ))
      && trustedTargetMatches,
    )
    const planningContextKey = trustedContextMatches
      ? trustedPlanningContextKey
      : schemePlanningContextKey
    const trustedFlowConfirmationDecisions = Array.isArray(trustedConfirmationContext.flowConfirmationDecisions)
      ? trustedConfirmationContext.flowConfirmationDecisions.filter((item): item is NocodeEditorConfirmationDecision => {
        const decision = asRecord(item)
        return Boolean(
          trustedContextMatches
          && isSamePlanningConfirmationContext(
            String(decision.planningContextKey || '').trim(),
            trustedPlanningContextKey,
          ),
        )
      })
      : []
    const flowConfirmationDecisions = trustedPlanningContextKey
      ? trustedFlowConfirmationDecisions
      : projectNocodeEditorConfirmationDecisions({
        stage: 'flow-scheme',
        confirmation: targetedScheme.confirmation,
        planningContextKey,
        expectedPlanningContextKey: planningContextKey || undefined,
        fallbackPlanningContextKey: planningContextKey || undefined,
      }).decisions
    const decisionReconciliation = reconcileNocodeEditorConfirmationDecisions({
      confirmation: targetedScheme.confirmation,
      previousDecisions: flowConfirmationDecisions,
      expectedPlanningContextKey: planningContextKey || undefined,
    })
    const decisionReconciledScheme: NocodeEditorFlowScheme = {
      ...targetedScheme,
      confirmation: decisionReconciliation.confirmation,
      openQuestions: targetedScheme.openQuestions.filter(question => (
        !decisionReconciliation.resolvedDecisionKeys.includes(question.key)
      )),
    }
    const targetIsCurrentForm = Boolean(
      (targetFormId && activeFormId && targetFormId === activeFormId)
      || (!targetFormId && targetFormName && activeFormName && targetFormName === activeFormName),
    )
    const requiresPersonnelEvidence = hasFlowSchemePersonnelRequirements(decisionReconciledScheme)
    const requiresApprovalFieldEvidence = flowConfirmationDecisions.some(
      item => item.approvalOwnerSource === 'form_member_field',
    )
    let flowSummary: unknown = null
    if (targetIsCurrentForm && (requiresPersonnelEvidence || requiresApprovalFieldEvidence)) {
      try {
        flowSummary = await getFlowSummary()
      } catch {
        flowSummary = null
      }
    }
    assertUniqueFlowSchemeStepKeys(decisionReconciledScheme)
    const assessedScheme = assessAndDecorateFlowSchemePersonnelDependencies({
      scheme: decisionReconciledScheme,
      flowSummary,
    })
    const approvalOwnerConvergence = convergeNocodeEditorFlowSchemeApprovalOwners({
      scheme: assessedScheme,
      flowSummary,
      flowConfirmationDecisions,
      planningContextKey,
    })
    const decoratedScheme = decorateStagedFlowScheme(assessedScheme)
    const decisionConflictIssues = buildUnifiedFlowIssuesFromDecisionConflicts({
      conflicts: decisionReconciliation.conflicts,
      planningContextKey,
    })
    const routingState = buildFlowSchemeRoutingState({
      scheme: decoratedScheme,
      planningContextKey,
      internalIssues: [
        ...decisionConflictIssues,
        ...approvalOwnerConvergence.issues,
      ],
    })
    const projectedScheme = projectFlowSchemeWithRoutingState(decoratedScheme, routingState)
    const reviewResult = normalizeNocodeEditorFlowSchemeReviewResult(input?.reviewResult)
    stagedFlowScheme.value = {
      revision: stagedFlowScheme.value.revision + 1,
      stagedAt: Date.now(),
      scheme: projectedScheme,
      planningStatus: routingState.projection.planningStatus,
      reviewResult,
      flowUnifiedIssues: routingState.flowUnifiedIssues,
      flowIssueRouting: routingState.flowIssueRouting,
    }

    return cloneValue(stagedFlowScheme.value)
  }

  const stageFlowBlueprint = async (input: Record<string, any>) => {
    const rawBlueprint = input?.blueprint || input
    const contractValidation = validateNocodeEditorFlowBlueprintContract(rawBlueprint)
    if (!contractValidation.valid) {
      const firstDiagnostic = contractValidation.diagnostics[0]
      throw new FlowExecutionBlockerError({
        issueId: 'flow-blueprint-contract-invalid',
        sourceStage: 'flow-plan',
        planningContextKey: stagedFlowScheme.value.scheme?.confirmation?.planningContextKey,
        blockedNextAction: 'editor_stage_flow_blueprint',
        userMessage: '流程蓝图节点配置不符合当前运行时约定，请基于节点示例修复后重新生成流程蓝图。',
        code: firstDiagnostic?.code,
        path: firstDiagnostic?.path,
      })
    }
    const blueprint = normalizeNocodeEditorFlowBlueprint(rawBlueprint)
    if (!blueprint) {
      throw new Error('流程蓝图缺少标题、摘要或触发分支结构')
    }
    const inputFlowPlan = normalizeNocodeEditorFlowPlanToolInput(rawBlueprint)

    const sourceSchemeRevision = Number(input?.sourceSchemeRevision || 0)
    const currentScheme = stagedFlowScheme.value.scheme
    const currentSchemeRevision = Number(stagedFlowScheme.value.revision || 0)
    const mismatchReasons: NocodeEditorFlowBlueprintMismatchReason[] = []
    const hostContext = await getHostContext()

    const targetedBlueprint: NocodeEditorFlowBlueprint = {
      ...blueprint,
      target: {
        formId: blueprint.target?.formId || currentScheme?.target?.formId || hostContext?.activeFormId || undefined,
        formName: blueprint.target?.formName || currentScheme?.target?.formName || hostContext?.activeFormName || undefined,
      },
    }
    const blueprintFlowPlan = convertNocodeEditorFlowBlueprintToFlowPlan(targetedBlueprint)
    const targetedFlowPlan = inputFlowPlan
      ? normalizeNocodeEditorFlowPlan({
        ...inputFlowPlan,
        target: {
          formId: inputFlowPlan.target?.formId || targetedBlueprint.target?.formId || undefined,
          formName: inputFlowPlan.target?.formName || targetedBlueprint.target?.formName || undefined,
        },
      })
      : blueprintFlowPlan
    if (!targetedFlowPlan) {
      throw new Error('流程蓝图缺少标题、摘要或触发分支结构')
    }
    const targetFormId = String(targetedFlowPlan.target?.formId || '').trim()
    const targetFormName = String(targetedFlowPlan.target?.formName || '').trim()
    const activeFormId = String(options.activeFormId.value || '').trim()
    const activeFormName = activeFormId
      ? String(
        options.nocode.value?.body?.formData?.tables?.find(item => item.uid === activeFormId)?.alias || '',
      ).trim()
      : ''
    const isTargetFormAlreadyOpen = Boolean(
      options.isShowFormCreate.value
      && (
        (targetFormId && activeFormId === targetFormId)
        || (targetFormName && activeFormName === targetFormName)
        || (!targetFormId && !targetFormName)
      )
    )

    let validatedFlowPlan = targetedFlowPlan
    if (isTargetFormAlreadyOpen) {
      const formRuntime = options.formCreateRef.value
      if (!formRuntime) {
        throw new Error('当前未打开表单编辑器')
      }
      const flowSummary = await formRuntime.getAiFlowSummary?.()
      if (flowSummary) {
        if (currentScheme) {
          const personnelPreflight = validateFlowBlueprintPersonnelRequirements({
            plan: targetedFlowPlan,
            scheme: currentScheme,
            flowSummary,
          })
          if (personnelPreflight.diagnostics.length) {
            const firstDiagnostic = personnelPreflight.diagnostics[0]
            const isApprovalOwnerDiagnostic = String(firstDiagnostic?.code || '')
              .startsWith('blueprint_approval_owner_')
            throw new FlowExecutionBlockerError({
              issueId: isApprovalOwnerDiagnostic
                ? 'flow-blueprint-approval-owner-reference-inconsistent'
                : 'flow-blueprint-personnel-reference-inconsistent',
              sourceStage: 'flow-plan',
              planningContextKey: currentScheme?.confirmation?.planningContextKey,
              blockedNextAction: 'editor_stage_flow_blueprint',
              userMessage: isApprovalOwnerDiagnostic
                ? '流程蓝图内部的审批人字段引用与已收敛流程方案不一致，请基于当前方案重新生成流程蓝图。'
                : '流程蓝图内部的人员来源与已收敛流程方案不一致，请基于当前方案重新生成流程蓝图。',
              code: firstDiagnostic?.code,
            })
          }
        }
        const groundingDiagnostics = validateFlowPlanGrounding({
          plan: targetedFlowPlan,
          summary: flowSummary,
        })
        const groundingPartition = partitionFlowGroundingDiagnosticsByPlannedDependencies({
          diagnostics: groundingDiagnostics,
          dependencies: currentScheme?.dependencies || [],
          targetFormId: targetFormId || activeFormId || undefined,
          targetFormName: targetFormName || activeFormName || undefined,
        })
        if (groundingPartition.blocking.length > 0) {
          throw new FlowGroundingConfirmationError({
            planningContextKey: currentScheme?.confirmation?.planningContextKey,
            diagnostics: groundingPartition.blocking,
          })
        }
      }
      validatedFlowPlan = await validateFlowPlanWithRuntime(targetedFlowPlan, formRuntime)
    } else {
      validatedFlowPlan = buildFlowNotValidatedPlan(targetedFlowPlan)
    }
    if (input?.__aiFlowPlanOptimizerStrictValidation) {
      assertFlowPlanCanPassOptimizerStrictValidation(validatedFlowPlan)
    }

    if (sourceSchemeRevision > 0 && currentSchemeRevision > 0 && sourceSchemeRevision !== currentSchemeRevision) {
      mismatchReasons.push('source_scheme_revision_mismatch')
    }
    if (
      currentScheme?.target
      && targetedBlueprint.target
      && (
        (currentScheme.target.formId && targetedBlueprint.target.formId && currentScheme.target.formId !== targetedBlueprint.target.formId)
        || (
          currentScheme.target.formName
          && targetedBlueprint.target.formName
          && !isSameToken(currentScheme.target.formName, targetedBlueprint.target.formName)
        )
      )
    ) {
      mismatchReasons.push('target_mismatch')
    }
    const revision = stagedFlowBlueprint.value.revision + 1
    const stagedAt = Date.now()
    const applyResult = null
    stagedFlowBlueprint.value = {
      revision,
      stagedAt,
      sourceSchemeRevision: sourceSchemeRevision || currentSchemeRevision || undefined,
      blueprint: targetedBlueprint,
      mismatchReasons: mismatchReasons.length ? mismatchReasons : null,
      applyResult,
    }
    stagedFlowPlan.value = {
      revision,
      stagedAt,
      sourceSchemeRevision: sourceSchemeRevision || currentSchemeRevision || undefined,
      flowPlan: validatedFlowPlan,
      applyResult,
    }

    return {
      ...cloneValue(stagedFlowBlueprint.value),
      flowPlan: cloneValue(validatedFlowPlan),
    }
  }

  const stageAppBlueprint = async (input: Record<string, any>) => {
    const normalizedInputResult = normalizeNocodeEditorBlueprintToolInput(input)
    if ('message' in normalizedInputResult) {
      throw Object.assign(new Error(normalizedInputResult.message), {
        blueprintInputErrorCode: normalizedInputResult.code,
      })
    }
    input = normalizedInputResult.input
    const currentUserMessage = String(input.__currentUserMessage || '').trim()
    delete input.__currentUserMessage
    const currentBlueprint = stagedAppBlueprint.value.blueprint
    const updateMode = String(input?.updateMode || '').trim()
    if (updateMode !== 'patch' && updateMode !== 'replace') {
      throw new Error('蓝图暂存必须明确指定 updateMode=patch 或 updateMode=replace')
    }
    const deletedFormKeys = normalizeStringArray(input?.deletedFormKeys)
    const deletedFields = (Array.isArray(input?.deletedFields) ? input.deletedFields : [])
      .map((item: Record<string, unknown>) => ({
        formKey: String(item?.formKey || '').trim(),
        fieldKeys: normalizeStringArray(item?.fieldKeys),
      }))
      .filter(item => item.formKey && item.fieldKeys.length)
    if (updateMode === 'replace' && (deletedFormKeys.length || deletedFields.length)) {
      throw new Error('updateMode=replace 时不能同时传入显式删除清单')
    }
    if (updateMode === 'patch' && !currentBlueprint) {
      throw new Error('当前没有可供 patch 的暂存蓝图，新建蓝图请使用 updateMode=replace')
    }
    const nextBlueprint = normalizeBlueprint(input, {
      allowEmptyForms: updateMode === 'patch',
    })
    const nextBlueprintFormula = normalizeBlueprintFormulaSettings(nextBlueprint)
    const normalizedNextBlueprint = nextBlueprintFormula.blueprint
    const currentBlueprintId = String(currentBlueprint?.id || '').trim()
    const nextBlueprintId = String(normalizedNextBlueprint.id || '').trim()
    if (
      updateMode === 'patch'
      && currentBlueprintId
      && nextBlueprintId
      && nextBlueprintId !== currentBlueprintId
    ) {
      throw new Error('updateMode=patch 必须沿用当前蓝图 ID')
    }
    const latestCompletedPlanningConfirmation = (
      input?.latestCompletedPlanningConfirmation as NocodeEditorAiConfirmPayload | null | undefined
    ) || null
    const planningContinuation = resolvePlanningContinuationForToolInput(input)
    const sourcePlanningContextKey = resolvePlanningContinuationSourceContextKey({
      latestCompletedPlanningContextKey: latestCompletedPlanningConfirmation?.planningContextKey
        || planningContinuation?.planningContextKey,
      currentPlanningContextKey: resolveCurrentStagedPlanningContextKey(),
    }) || null
    const planningScope = resolveActiveBlueprintPlanningScope(sourcePlanningContextKey)
    const activePlanningOutline = getActivePlanningOutline()
    const activePlanningContextKey = resolveCurrentStagedPlanningContextKey()
    const hasConfirmedPlanningScope = Boolean(
      latestCompletedPlanningConfirmation
      && (
        !sourcePlanningContextKey
        || !activePlanningContextKey
        || sourcePlanningContextKey === activePlanningContextKey
      )
    )
    const scopeValidation = validateNocodeEditorBlueprintReplaceScope({
      updateMode,
      plannedForms: hasConfirmedPlanningScope ? activePlanningOutline?.forms || [] : [],
      proposedForms: normalizedNextBlueprint.forms,
      hasCurrentBlueprint: Boolean(currentBlueprint),
      currentUserMessage,
    })
    if ('message' in scopeValidation) {
      throw Object.assign(new Error(scopeValidation.message), {
        blueprintScopeErrorCode: scopeValidation.code,
        blueprintScopeMissingForms: scopeValidation.missingForms,
      })
    }
    const currentSourcePlanningContextKey = stagedAppBlueprint.value.sourcePlanningContextKey || null
    const shouldCarryBlueprintId = updateMode === 'patch'
      ? Boolean(currentBlueprint)
      : shouldCarryCurrentBlueprintId({
        nextBlueprint: normalizedNextBlueprint,
        currentBlueprint,
        currentSourcePlanningContextKey,
        nextSourcePlanningContextKey: sourcePlanningContextKey,
      })
    const blueprintBase = shouldCarryBlueprintId ? currentBlueprint : null
    const blueprintInput = shouldCarryBlueprintId || normalizedNextBlueprint.id
      ? normalizedNextBlueprint
      : {
        ...normalizedNextBlueprint,
        id: createBlueprintId(),
      }
    const planningCarryover = resolvePlanningCarryoverForToolInput(input)
    const blueprint = enhanceBlueprint(
      normalizeSingleFormBlueprintFragments(
        mergeBlueprintWithCurrent(
          blueprintInput,
          blueprintBase,
          {
            updateMode,
            deletedFormKeys,
            deletedFields,
          },
        ),
      ),
      {
        collectFieldClarifications: true,
        planningCarryover,
      },
    ) as NocodeEditorAiAppBlueprint & {
      confirmation?: NocodeEditorAiConfirmPayload | null
    }
    if (!blueprint.forms.length) {
      throw new Error('蓝图至少需要保留一个表单')
    }
    blueprint.openQuestions = resolveStageBlueprintOpenQuestions({
      currentBlueprint,
      nextBlueprint: normalizedNextBlueprint,
      stagedBlueprint: blueprint,
      planningCarryover,
    })
    blueprint.openQuestions = Array.from(new Set([
      ...blueprint.openQuestions,
      ...nextBlueprintFormula.issues.map(issue => issue.message),
    ]))
    const scopedBlueprintConfirmation = projectBlueprintConfirmation({
      confirmation: blueprint.confirmation,
      openQuestions: blueprint.openQuestions,
      summary: blueprint.summary,
    })
    blueprint.openQuestions = scopedBlueprintConfirmation.openQuestions
    blueprint.confirmation = scopedBlueprintConfirmation.confirmation || undefined
    blueprint.id = String(blueprint.id || (shouldCarryBlueprintId ? currentBlueprint?.id : '') || createBlueprintId()).trim()
      || createBlueprintId()
    blueprint.title = resolveNocodeEditorBlueprintDisplayTitle({
      title: blueprint.title || currentBlueprint?.title,
      forms: blueprint.forms,
      fallback: '蓝图',
    }) || '蓝图'
    normalizeBlueprintGroupNamesForActivePlanning(blueprint)
    if (latestCompletedPlanningConfirmation) {
      persistLatestCompletedPlanningConfirmation(latestCompletedPlanningConfirmation)
    }
    stagedAppBlueprint.value = createStagedBlueprintState({
      planningScope,
      revision: stagedAppBlueprint.value.revision + 1,
      stagedAt: Date.now(),
      blueprint,
      sourcePlanningContextKey,
    })
    options.markAiDraftStatus?.(null)
    return cloneValue(stagedAppBlueprint.value) as NocodeEditorAiStagedAppBlueprint
  }

  const clearStagedFormPlan = async () => {
    await clearPendingExcelImportHandles()
    stagedFormPlan.value = {
      revision: stagedFormPlan.value.revision + 1,
      stagedAt: undefined,
      outline: null,
      applicationStructurePreview: null,
    }
    stagedAppPlan.value = {
      revision: stagedAppPlan.value.revision + 1,
      stagedAt: undefined,
      plan: null,
    }
    stagedAppBlueprint.value = createStagedBlueprintState({
      planningScope: 'unknown',
      revision: stagedAppBlueprint.value.revision + 1,
      stagedAt: undefined,
      blueprint: null,
      sourcePlanningContextKey: null,
    })
    options.markAiDraftStatus?.(null)
    return cloneValue(stagedFormPlan.value)
  }

  const clearStagedAppPlan = async () => {
    await clearPendingExcelImportHandles()
    stagedAppPlan.value = {
      revision: stagedAppPlan.value.revision + 1,
      stagedAt: undefined,
      plan: null,
    }
    stagedFormPlan.value = {
      revision: stagedFormPlan.value.revision + 1,
      stagedAt: undefined,
      outline: null,
      applicationStructurePreview: null,
    }
    stagedAppBlueprint.value = createStagedBlueprintState({
      planningScope: 'unknown',
      revision: stagedAppBlueprint.value.revision + 1,
      stagedAt: undefined,
      blueprint: null,
      sourcePlanningContextKey: null,
    })
    options.markAiDraftStatus?.(null)
    return cloneValue(stagedAppPlan.value)
  }

  const clearStagedAppBlueprint = async (): Promise<NocodeEditorAiStagedAppBlueprint> => {
    await clearPendingExcelImportHandles()
    stagedAppBlueprint.value = createStagedBlueprintState({
      planningScope: 'unknown',
      revision: stagedAppBlueprint.value.revision + 1,
      stagedAt: undefined,
      blueprint: null,
      sourcePlanningContextKey: null,
    })
    options.markAiDraftStatus?.(null)
    return cloneValue(stagedAppBlueprint.value) as NocodeEditorAiStagedAppBlueprint as NocodeEditorAiStagedAppBlueprint
  }

  const clearStagedFlowScheme = async () => {
    stagedFlowScheme.value = {
      revision: stagedFlowScheme.value.revision + 1,
      stagedAt: undefined,
      scheme: null,
      planningStatus: 'needs_confirmation',
      reviewResult: null,
      flowUnifiedIssues: null,
      flowIssueRouting: null,
    }
    return cloneValue(stagedFlowScheme.value)
  }

  const clearStagedFlowPlan = async () => {
    stagedFlowPlan.value = {
      revision: stagedFlowPlan.value.revision + 1,
      stagedAt: undefined,
      sourceSchemeRevision: undefined,
      flowPlan: null,
      applyResult: null,
    }
    return cloneValue(stagedFlowPlan.value)
  }

  const clearStagedFlowBlueprint = async () => {
    stagedFlowBlueprint.value = {
      revision: stagedFlowBlueprint.value.revision + 1,
      stagedAt: undefined,
      sourceSchemeRevision: undefined,
      blueprint: null,
      mismatchReasons: null,
      applyResult: null,
    }
    stagedFlowPlan.value = {
      revision: stagedFlowPlan.value.revision + 1,
      stagedAt: undefined,
      sourceSchemeRevision: undefined,
      flowPlan: null,
      applyResult: null,
    }
    return cloneValue(stagedFlowBlueprint.value)
  }

  const resolveBlueprintSource = (
    blueprint: NocodeEditorAiAppBlueprint,
    field: NocodeEditorAiAppBlueprintField,
  ) => {
    if (!field.source) return null
    const formByKey = blueprint.forms.find(item => item.formKey === field.source?.formKey)
    const formByNameToken = normalizeToken(field.source?.formName)
    const formByName = blueprint.forms.find((item) => {
      const aliasTokens = getBlueprintFormAliasTokens(item.tableName)
      return aliasTokens.includes(formByNameToken)
    })
    const targetForm = formByKey || formByName || null
    const targetField = targetForm?.fields.find(item => item.fieldKey === field.source?.fieldKey)
      || targetForm?.fields.find(item => isSameToken(item.name, field.source?.fieldName))
      || pickBlueprintSourceField(targetForm?.fields || [])
      || null

    return {
      tableName: targetForm?.tableName || field.source?.formName || '',
      fieldName: targetField?.name || field.source?.fieldName || '',
    }
  }

  const bindFieldSourceByName = async (
    formRuntime: NocodeEditorAiFormRuntime,
    input: {
      widgetId: string
      formName: string
      fieldName: string
    },
  ): Promise<NocodeEditorAiFieldSourceBindingResult> => {
    const widgetId = String(input?.widgetId || '').trim()
    const formName = String(input?.formName || '').trim()
    const fieldName = String(input?.fieldName || '').trim()
    if (!widgetId || !formName || !fieldName) {
      throw new Error('绑定字段来源时缺少 widgetId、formName 或 fieldName')
    }

    let schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
    const choiceTypeOption = findSchemaOption(schema, {
      keys: ['select-choices-type'],
    })
    if (!choiceTypeOption) {
      throw new Error(`字段 ${widgetId} 暂不支持配置来自他表数据`)
    }

    if (!valuesEqual(choiceTypeOption.currentValue, 'from-table')) {
      await formRuntime.setAiFieldOptions?.({
        widgetId,
        changes: [{
          path: choiceTypeOption.path,
          value: 'from-table',
        }],
      })
      schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
    }

    const latestOtherTableOption = findSchemaOption(schema, {
      keys: ['other-table-field'],
      labels: ['他表字段', '选择他表字段'],
    })
    if (!latestOtherTableOption) {
      throw new Error(`字段 ${widgetId} 未找到“他表字段”设置项`)
    }

    const choiceResult = await formRuntime.getAiWidgetOptionChoices?.({
      widgetId,
      optionPath: latestOtherTableOption.path,
    })
    const targetChoices = flattenChoiceTree(Array.isArray(choiceResult?.choices) ? choiceResult.choices : [])
    const sameFieldChoices = targetChoices.filter(item => normalizeToken(item.label) === normalizeToken(fieldName))
    const contextualMatches = sameFieldChoices.filter(item => matchesSourceFormName(item.pathLabels || [], formName))
    const diagnostics = {
      contextualMatches: contextualMatches.map(snapshotFieldSourceChoice),
      sameFieldChoices: sameFieldChoices.map(snapshotFieldSourceChoice),
    }

    if (contextualMatches.length > 1) {
      throw new Error(buildFieldSourceAmbiguousError({
        formName,
        fieldName,
        choices: contextualMatches,
        contextual: true,
      }))
    }

    let matchedChoice = contextualMatches[0]
    let matchType: NocodeEditorAiFieldSourceBindingMatchType = 'contextual-match'
    if (!matchedChoice && sameFieldChoices.length === 1) {
      matchedChoice = sameFieldChoices[0]
      matchType = 'unique-field-fallback'
    }

    if (!matchedChoice?.value) {
      if (sameFieldChoices.length > 1) {
        throw new Error(buildFieldSourceAmbiguousError({
          formName,
          fieldName,
          choices: sameFieldChoices,
          contextual: false,
        }))
      }
      throw new Error(`未找到来自表「${formName}」的字段「${fieldName}」`)
    }

    if (!valuesEqual(latestOtherTableOption.currentValue, matchedChoice.value)) {
      await formRuntime.setAiFieldOptions?.({
        widgetId,
        changes: [{
          path: latestOtherTableOption.path,
          value: matchedChoice.value,
        }],
      })
    }

    return {
      widgetId,
      formName,
      fieldName,
      boundChoice: matchedChoice,
      matchType,
      diagnostics,
      warningMessage: matchType === 'unique-field-fallback'
        ? `字段「${fieldName}」未命中表「${formName}」上下文，已按唯一同名字段回退到「${formatFieldSourceChoicePath(matchedChoice.pathLabels || [], matchedChoice.label)}」`
        : undefined,
    }
  }

  const applyFieldSpecialOptions = async (
    blueprint: NocodeEditorAiAppBlueprint,
    field: NocodeEditorAiAppBlueprintField,
    widgetId: string,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
    formRuntime: NocodeEditorAiFormRuntime,
    options?: {
      deferSource?: boolean
      sourceOnly?: boolean
    },
  ) => {
    let updated = false
    const warnings: string[] = []
    let schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })

    const source = resolveBlueprintSource(blueprint, field)
    if (source?.tableName && source?.fieldName) {
      if (!options?.deferSource) {
        try {
          const bindResult = await bindFieldSourceByName(formRuntime, {
            widgetId,
            formName: source.tableName,
            fieldName: source.fieldName,
          })
          if (bindResult.warningMessage) {
            warnings.push(bindResult.warningMessage)
          }
          updated = true
          schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : String(error))
        }
      }
    } else if (!options?.sourceOnly && (field.enumOptions || []).length) {
      const enumOptions = normalizeEnumOptions(field.enumOptions)
      const choiceTypeOption = findSchemaOption(schema, {
        keys: ['select-choices-type'],
      })
      if (choiceTypeOption && !valuesEqual(choiceTypeOption.currentValue, 'custom')) {
        await formRuntime.setAiFieldOptions?.({
          widgetId,
          changes: [{
            path: choiceTypeOption.path,
            value: 'custom',
          }],
        })
        updated = true
        schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
      }

      const enumOption = findSchemaOption(schema, {
        keys: [
          'radiogroup-value-text-color-option',
          'treeselect-value-text-option',
          'checkbox-option',
        ],
        labels: ['选项设置'],
        typeIncludes: ['colored-array'],
      })

      if (!enumOption) {
        warnings.push(`字段「${field.name}」暂不支持自动写入枚举选项`)
      } else {
        const currentValue = enumOption.currentValue && typeof enumOption.currentValue === 'object'
          ? enumOption.currentValue
          : {}
        const nextValue = {
          ...currentValue,
          isColored: Boolean((currentValue as any)?.isColored),
          options: enumOptions,
        }
        if (!valuesEqual((currentValue as any)?.options || [], enumOptions)) {
          await formRuntime.setAiFieldOptions?.({
            widgetId,
            changes: [{
              path: enumOption.path,
              value: nextValue,
            }],
          })
          updated = true
        }
      }
    } else if (!options?.sourceOnly) {
      const choiceTypeOption = findSchemaOption(schema, {
        keys: ['select-choices-type'],
      })
      const enumOption = findSchemaOption(schema, {
        keys: [
          'radiogroup-value-text-color-option',
          'treeselect-value-text-option',
          'checkbox-option',
        ],
        labels: ['选项设置'],
        typeIncludes: ['colored-array'],
      })

      if (choiceTypeOption && enumOption) {
        const currentValue = enumOption.currentValue && typeof enumOption.currentValue === 'object'
          ? enumOption.currentValue
          : {}
        const nextValue = {
          ...currentValue,
          isColored: Boolean((currentValue as any)?.isColored),
          options: [],
        }
        const changes: Array<Record<string, any>> = []

        if (!valuesEqual(choiceTypeOption.currentValue, 'custom')) {
          changes.push({
            path: choiceTypeOption.path,
            value: 'custom',
          })
        }

        if (!valuesEqual((currentValue as any)?.options || [], [])) {
          changes.push({
            path: enumOption.path,
            value: nextValue,
          })
        }

        if (changes.length) {
          await formRuntime.setAiFieldOptions?.({
            widgetId,
            changes,
          })
          updated = true
        }

        warnings.push(`字段「${field.name}」缺少明确 enumOptions，当前未自动猜测业务选项`)
      }
    }

    formResult.fieldWarnings.push(...warnings)
    return updated
  }

  const applyFieldSimpleOptions = async (
    field: NocodeEditorAiAppBlueprintField,
    widgetId: string,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
    formRuntime: NocodeEditorAiFormRuntime,
  ) => {
    const schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
    const changes: Array<Record<string, any>> = []
    const warnings: string[] = []

    if (typeof field.required === 'boolean') {
      const requiredOption = findSchemaOption(schema, {
        keys: ['required'],
        labels: ['必填'],
      })
      if (!requiredOption) {
        warnings.push(`字段「${field.name}」未找到必填设置项`)
      } else if (!valuesEqual(requiredOption.currentValue, field.required)) {
        changes.push({
          path: requiredOption.path,
          value: field.required,
        })
      }
    }

    if (field.placeholder) {
      const placeholderOption = findSchemaOption(schema, {
        keys: ['placeholder'],
        labels: ['提示文字', '提示文本', 'placeholder'],
      })
      if (!placeholderOption) {
        warnings.push(`字段「${field.name}」未找到提示文字设置项`)
      } else if (!valuesEqual(placeholderOption.currentValue, field.placeholder)) {
        changes.push({
          path: placeholderOption.path,
          value: field.placeholder,
        })
      }
    }

    if (field.description) {
      const showDescriptionOption = findSchemaOption(schema, {
        keys: ['show-description'],
        labels: ['显示描述', '显示说明'],
      })
      const descriptionContentOption = findSchemaOption(schema, {
        keys: ['description-content'],
        labels: ['描述内容', '说明内容', '字段说明', '描述'],
      })

      if (!descriptionContentOption) {
        warnings.push(`字段「${field.name}」未找到描述内容设置项`)
      } else {
        if (showDescriptionOption && !valuesEqual(showDescriptionOption.currentValue, true)) {
          changes.push({
            path: showDescriptionOption.path,
            value: true,
          })
        }
        if (!valuesEqual(descriptionContentOption.currentValue, field.description)) {
          changes.push({
            path: descriptionContentOption.path,
            value: field.description,
          })
        }
      }
    }

    if (field.validationFormat) {
      const validationFormatOption = findSchemaOption(schema, {
        keys: ['validation-format'],
        labels: ['限定格式', '输入格式'],
      })
      if (!validationFormatOption) {
        warnings.push(`字段「${field.name}」未找到限定格式设置项`)
      } else if (!valuesEqual(validationFormatOption.currentValue, field.validationFormat)) {
        changes.push({
          path: validationFormatOption.path,
          value: field.validationFormat,
        })
      }
    }

    if (changes.length) {
      await formRuntime.setAiFieldOptions?.({
        widgetId,
        changes,
      })
    }
    formResult.fieldWarnings.push(...warnings)
    return changes.length > 0
  }

  const applyFieldDefaultValue = async (
    field: NocodeEditorAiAppBlueprintField,
    widgetId: string,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
    formRuntime: NocodeEditorAiFormRuntime,
  ) => {
    const defaultValue = normalizeBlueprintDefaultValue(field.defaultValue)
    if (defaultValue === undefined) {
      return false
    }

    try {
      const schema = await formRuntime.getAiWidgetOptionSchema?.({ widgetId })
      const resolution = resolveBlueprintDefaultValueChanges({
        fieldName: field.name,
        widgetType: field.widgetType,
        defaultValue,
        schema,
      })
      if (resolution.warning) {
        formResult.fieldWarnings.push(resolution.warning)
      }
      if (!resolution.changes.length) {
        return false
      }
      await formRuntime.setAiFieldOptions?.({
        widgetId,
        changes: resolution.changes,
      })
      return true
    } catch (error) {
      formResult.fieldWarnings.push(
        `字段「${field.name}」静态默认值设置失败：${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }

  const getFormWidgets = async (formRuntime: NocodeEditorAiFormRuntime) => {
    const summary = await formRuntime.getAiFormSummary?.()
    return flattenWidgetTree(Array.isArray(summary?.widgets) ? summary.widgets : [])
  }

  const getFormSummarySnapshot = async (formRuntime: NocodeEditorAiFormRuntime) => {
    return await formRuntime.getAiFormSummary?.() || {}
  }

  const maybeReplaceFieldWidgetType = async (
    field: NocodeEditorAiAppBlueprintField,
    widget: Record<string, any>,
    formRuntime: NocodeEditorAiFormRuntime,
  ) => {
    const expectedWidgetType = resolveExplicitBlueprintWidgetType(field.widgetType)
    const currentWidgetType = resolveExplicitBlueprintWidgetType(widget?.type)
    const widgetId = String(widget?.widgetId || widget?.uid || '').trim()

    if (!expectedWidgetType || !currentWidgetType || !widgetId || expectedWidgetType === currentWidgetType) {
      return {
        updated: false,
        widget,
      }
    }

    if (!formRuntime.replaceAiField) {
      return {
        updated: false,
        widget,
      }
    }

    await formRuntime.replaceAiField({
      widgetId,
      widgetType: expectedWidgetType,
      name: field.name,
    })

    const latestWidgetMap = buildScopedWidgetMap(await getFormWidgets(formRuntime))
    return {
      updated: true,
      widget: latestWidgetMap.get(getWidgetScopeKey(field.name, widget?.parentUid)),
    }
  }

  const ensureBlueprintFieldsInContainer = async (
    fields: NocodeEditorAiAppBlueprintField[],
    parentWidgetId: string,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
    formRuntime: NocodeEditorAiFormRuntime,
  ) => {
    if (!fields.length) {
      return
    }

    const summary = await getFormSummarySnapshot(formRuntime)
    const currentWidgetMap = buildScopedWidgetMap(
      flattenWidgetTree(Array.isArray(summary?.widgets) ? summary.widgets : []),
    )
    const availableWidgetTypes = Array.isArray(summary?.availableWidgetTypes) ? summary.availableWidgetTypes : []
    const fieldsToCreate = fields
      .filter(field => !currentWidgetMap.get(getWidgetScopeKey(field.name, parentWidgetId)))
      .map((field) => {
        const requestedWidgetType = field.widgetType || guessWidgetType(field)
        const resolvedWidgetType = resolveSupportedBlueprintWidgetType({
          requestedType: requestedWidgetType,
          availableWidgetTypes,
        })
        if (resolvedWidgetType.fallback && resolvedWidgetType.widgetType !== requestedWidgetType) {
          formResult.fieldWarnings.push(
            `字段「${field.name}」组件类型「${requestedWidgetType || '未指定'}」当前不可用，已自动改为「${resolvedWidgetType.widgetType}」`,
          )
        }
        return {
          requestId: field.fieldKey || field.name,
          widgetType: resolvedWidgetType.widgetType,
          name: field.name,
          containerWidgetId: parentWidgetId || undefined,
        }
      })

    if (fieldsToCreate.length) {
      const createResult = await formRuntime.addAiFields?.({
        fields: fieldsToCreate,
      })
      for (const createdField of createResult?.created || []) {
        formResult.fieldsCreated.push(String(createdField?.name || '').trim())
      }
      for (const failedField of createResult?.failed || []) {
        formResult.fieldWarnings.push(
          `字段「${String(failedField?.name || failedField?.requestId || '未命名字段').trim() || '未命名字段'}」创建失败：${String(failedField?.error || '未知错误')}`,
        )
      }
    }

    const latestWidgetMap = buildScopedWidgetMap(await getFormWidgets(formRuntime))
    for (const field of fields) {
      const widget = latestWidgetMap.get(getWidgetScopeKey(field.name, parentWidgetId))
      const children = getBlueprintFieldChildren(field)
      if (!widget) {
        formResult.fieldWarnings.push(`字段「${field.name}」未找到对应组件，已跳过后续处理`)
        continue
      }
      if (children.length) {
        await ensureBlueprintFieldsInContainer(children, String(widget.uid || ''), formResult, formRuntime)
      }
    }
  }

  const applyBlueprintFieldSettingsInContainer = async (
    blueprint: NocodeEditorAiAppBlueprint,
    fields: NocodeEditorAiAppBlueprintField[],
    parentWidgetId: string,
    parentFieldKey: string,
    widgetMap: Map<string, Record<string, any>>,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
    formRuntime: NocodeEditorAiFormRuntime,
    options?: {
      deferRelations?: boolean
    },
  ) => {
    for (const field of fields) {
      try {
        let currentWidgetMap = widgetMap
        let widget = currentWidgetMap.get(getWidgetScopeKey(field.name, parentWidgetId))
        let widgetId = String(widget?.widgetId || widget?.uid || '').trim()
        if (!widgetId) {
          formResult.fieldWarnings.push(`字段「${field.name}」未找到对应组件，已跳过设置`)
          continue
        }

        if (!formResult.fieldsCreated.includes(field.name)) {
          formResult.fieldsReused.push(field.name)
        }

        let fieldUpdated = false
        const replacedResult = await maybeReplaceFieldWidgetType(field, widget, formRuntime)
        if (replacedResult.updated) {
          fieldUpdated = true
          currentWidgetMap = buildScopedWidgetMap(await getFormWidgets(formRuntime))
          widget = currentWidgetMap.get(getWidgetScopeKey(field.name, parentWidgetId))
          widgetId = String(widget?.widgetId || widget?.uid || '').trim()
        } else if (replacedResult.widget) {
          widget = replacedResult.widget
        }

        if (!widgetId) {
          formResult.fieldWarnings.push(`字段「${field.name}」替换组件后未找到对应字段，已跳过设置`)
          continue
        }

        pushBlueprintFieldBinding(formResult, {
          tableId: formResult.tableId,
          fieldKey: String(field.fieldKey || field.name || '').trim(),
          fieldName: field.name,
          widgetId,
          widgetType: String(widget?.type || widget?.widgetType || field.widgetType || '').trim() || undefined,
          parentFieldKey: parentFieldKey || undefined,
          parentWidgetId: parentWidgetId || undefined,
        })

        fieldUpdated = await applyFieldSpecialOptions(
          blueprint,
          field,
          widgetId,
          formResult,
          formRuntime,
          { deferSource: options?.deferRelations },
        ) || fieldUpdated
        fieldUpdated = await applyFieldDefaultValue(
          field,
          widgetId,
          formResult,
          formRuntime,
        ) || fieldUpdated
        fieldUpdated = await applyFieldSimpleOptions(field, widgetId, formResult, formRuntime) || fieldUpdated

        if (fieldUpdated) {
          formResult.fieldsUpdated.push(field.name)
        }

        const children = getBlueprintFieldChildren(field)
        if (children.length) {
          await applyBlueprintFieldSettingsInContainer(
            blueprint,
            children,
            widgetId,
            String(field.fieldKey || field.name || '').trim(),
            currentWidgetMap,
            formResult,
            formRuntime,
            options,
          )
        }
      } catch (error) {
        formResult.fieldWarnings.push(`字段「${field.name}」设置失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  const enrichBlueprintFormulaBindings = async (
    formRuntime: NocodeEditorAiFormRuntime,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
  ) => {
    const formSummary = await formRuntime.getAiFormSummary?.()
    const formulaContext = await formRuntime.getAiDefaultFormulaTaskContext?.()
    const formulaFields = Array.isArray(formulaContext?.fieldList) ? formulaContext.fieldList : []
    const tokenByTitle = buildCurrentRowFormulaTokenByTitle(formulaFields)
    const widgets = flattenWidgetTree(Array.isArray(formSummary?.widgets) ? formSummary.widgets : [])
    const widgetById = new Map(widgets.map(widget => [
      String(widget?.uid || widget?.widgetId || '').trim(),
      widget,
    ]))

    formResult.fieldBindings = (formResult.fieldBindings || []).map(binding => {
      const widget = widgetById.get(String(binding.widgetId || '').trim())
      const widgetType = String(widget?.type || widget?.widgetType || binding.widgetType || '').trim()
      return {
        ...binding,
        tableId: formResult.tableId,
        widgetType: widgetType || undefined,
        token: tokenByTitle.get(binding.fieldName) || binding.widgetId,
        formulaPaths: resolveBlueprintFormulaPaths({
          widgetType,
          formulaPaths: widget?.formulaPaths,
        }),
      }
    })
  }

  const applyDeferredBlueprintRelations = async (
    blueprint: NocodeEditorAiAppBlueprint,
    fields: NocodeEditorAiAppBlueprintField[],
    parentFieldKey: string,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
    formRuntime: NocodeEditorAiFormRuntime,
  ) => {
    for (const field of fields) {
      const fieldKey = String(field.fieldKey || field.name || '').trim()
      const binding = (formResult.fieldBindings || []).find(item => (
        item.fieldKey === fieldKey
        && String(item.parentFieldKey || '').trim() === parentFieldKey
      ))
      if (binding && resolveBlueprintSource(blueprint, field)) {
        await applyFieldSpecialOptions(
          blueprint,
          field,
          binding.widgetId,
          formResult,
          formRuntime,
          { sourceOnly: true },
        )
      }
      const children = getBlueprintFieldChildren(field)
      if (children.length) {
        await applyDeferredBlueprintRelations(
          blueprint,
          children,
          fieldKey,
          formResult,
          formRuntime,
        )
      }
    }
  }

  const buildBlueprintFormulaApplyResultForForm = (
    formulaApply: NocodeEditorFormulaApplyResult,
    formResult: NocodeEditorAiBlueprintApplyFormResult,
  ): NocodeEditorFormulaApplyResult => {
    const targetResults = formulaApply.targetResults.filter(item => item.tableId === formResult.tableId)
    const issues = formulaApply.issues.filter(issue => (
      String(issue.target.formKey || '').trim() === String(formResult.formKey || '').trim()
    ))
    if (!targetResults.length && !issues.length) {
      return {
        status: 'not_applicable',
        targetResults: [],
        issues: [],
        checkpoint: null,
      }
    }

    return {
      status: resolveBlueprintFormulaApplyStatus(targetResults),
      ...(formulaApply.persistenceMode ? { persistenceMode: formulaApply.persistenceMode } : {}),
      targetResults,
      issues,
      checkpoint: formulaApply.checkpoint,
    }
  }

  const applyStagedAppBlueprint = async (
    applyOptions?: NocodeEditorAiBlueprintApplyOptions,
  ): Promise<NocodeEditorAiBlueprintApplyResult> => {
    const planningCarryover = getLatestCompletedPlanningCarryover()
    const normalizedStagedBlueprint = stagedAppBlueprint.value.blueprint
      ? normalizeBlueprintFormulaSettings(cloneValue(stagedAppBlueprint.value.blueprint)).blueprint
      : null
    const blueprint = normalizedStagedBlueprint
      ? enhanceBlueprint(
        normalizeSingleFormBlueprintFragments(normalizedStagedBlueprint),
        {
          collectFieldClarifications: true,
          planningCarryover,
        },
      )
      : null
    if (blueprint) {
      normalizeBlueprintGroupNamesForActivePlanning(blueprint)
    }
    rebuildBlueprintOpenQuestionsWithPlanningCarryover(blueprint, planningCarryover)
    if (blueprint) {
      stagedAppBlueprint.value = {
        ...stagedAppBlueprint.value,
        blueprint: cloneValue(blueprint),
      }
    }
    if (!blueprint) {
      throw new Error('当前没有可应用的蓝图草案')
    }

    const hasExplicitTargetFormKeys = Array.isArray(applyOptions?.targetFormKeys)
    const requestedTargetFormKeys = new Set(
      hasExplicitTargetFormKeys
        ? applyOptions.targetFormKeys.map(value => String(value || '').trim()).filter(Boolean)
        : [],
    )
    const targetForms = blueprint.forms.filter((form) => {
      if (!hasExplicitTargetFormKeys) {
        return true
      }
      const formKey = getNocodeEditorBlueprintFormApplyTargetIdentity(form)
      return Boolean(formKey && requestedTargetFormKeys.has(formKey))
    })
    if (!targetForms.length) {
      const scopeLabel = applyOptions?.scope === 'group'
        ? '褰撳墠鍒嗙粍'
        : applyOptions?.scope === 'single'
          ? '褰撳墠琛ㄥ崟'
          : '褰撳墠鑼冨洿'
      throw new Error(`${scopeLabel}娌℃湁鍙敓鎴愮殑鐩爣琛ㄥ崟`)
    }

    const targetExistingFormIds = new Set(
      targetForms.map((form) => {
        const formLookupKey = getNocodeEditorBlueprintFormApplyTargetIdentity({
          tableName: form.tableName,
          groupName: form.groupName,
        })
        return availableForms.value.find(item => item.targetIdentityKey === formLookupKey)?.tableId || ''
      }).filter(Boolean),
    )
    const crossBlueprintPreparation = await ensureReadyForCrossBlueprintApply(
      applyOptions,
      targetExistingFormIds,
    )

    const hostContext = await getHostContext()
    if (hostContext?.dirty?.page) {
      throw new Error('当前页面存在未保存变更，请先处理后再按蓝图生成')
    }
    if (hostContext?.dirty?.form && !crossBlueprintPreparation.persistedPreviousFormDraft) {
      throw new Error('当前表单存在未保存变更，请先处理后再按蓝图生成')
    }

    const planningScope = normalizeNocodeEditorPlanningScopeValue(
      stagedAppBlueprint.value.planningScope,
    )
    const startedAt = Date.now()
    const results: NocodeEditorAiBlueprintApplyFormResult[] = []
    const tableMap = new Map<string, { tableId: string; tableName: string }>()
    const warnings: string[] = []

    await applyOptions?.onProgress?.({
      stage: 'detected',
      totalFormCount: targetForms.length,
    })

    for (const form of targetForms) {
      const formTargetKey = getNocodeEditorBlueprintFormApplyTargetIdentity(form)
      const formLookupKey = getNocodeEditorBlueprintFormApplyTargetIdentity({
        tableName: form.tableName,
        groupName: form.groupName,
      })
      const existing = availableForms.value.find(item => item.targetIdentityKey === formLookupKey)
      if (existing) {
        tableMap.set(formTargetKey, {
          tableId: existing.tableId,
          tableName: existing.name,
        })
        results.push({
          applyTargetKey: formTargetKey,
          formKey: form.formKey || form.tableName,
          tableId: existing.tableId,
          tableName: existing.name,
          description: String(form.description || '').trim() || undefined,
          created: false,
          reused: true,
          fieldsCreated: [],
          fieldsReused: [],
          fieldsUpdated: [],
          fieldWarnings: [],
          fieldBindings: [],
        })
        continue
      }

      const created = await createForm({
        tableName: form.tableName,
        groupName: form.groupName,
      })
      if (!created?.ok || !created?.tableId) {
        throw new Error(`创建表单失败: ${form.tableName}${created?.reason ? `（${created.reason}）` : ''}`)
      }
      tableMap.set(formTargetKey, {
        tableId: created.tableId,
        tableName: created.tableName || form.tableName,
      })
      results.push({
        applyTargetKey: formTargetKey,
        formKey: form.formKey || form.tableName,
        tableId: created.tableId,
        tableName: created.tableName || form.tableName,
        description: String(form.description || '').trim() || undefined,
        created: !created?.reusedExisting,
        reused: Boolean(created?.reusedExisting),
        fieldsCreated: [],
        fieldsReused: [],
        fieldsUpdated: [],
        fieldWarnings: [],
        fieldBindings: [],
      })
    }

    const blueprintFormulaPlan = buildBlueprintFormulaPlan({
      blueprint,
      formResults: results,
    })
    const shouldDeferBlueprintRelations = blueprintFormulaPlan.plan.items.length > 0

    for (let index = 0; index < targetForms.length; index += 1) {
      const form = targetForms[index]
      const formTargetKey = getNocodeEditorBlueprintFormApplyTargetIdentity(form)
      const formResult = results[index]
      const target = tableMap.get(formTargetKey)
      if (!target) {
        formResult.fieldWarnings.push(`表单「${form.tableName}」未找到映射，已跳过字段创建`)
        continue
      }

      try {
        if (index > 0) {
          await syncCurrentAiDraft()
        }

        const opened = await openForm({
          tableId: target.tableId,
        })
        if (!opened?.ok) {
          throw new Error(`打开表单失败${opened?.reason ? `（${opened.reason}）` : ''}`)
        }
        await nextTick()
        const formRuntime = await ensureFormRuntime()
        await ensureBlueprintFieldsInContainer(form.fields, '', formResult, formRuntime)
      } catch (error) {
        formResult.fieldWarnings.push(`表单「${form.tableName}」字段创建失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (targetForms.length) {
      await syncCurrentAiDraft()
    }

    for (let index = 0; index < targetForms.length; index += 1) {
      const form = targetForms[index]
      const formTargetKey = getNocodeEditorBlueprintFormApplyTargetIdentity(form)
      const formResult = results[index]
      const target = tableMap.get(formTargetKey)
      if (!target) {
        formResult.fieldWarnings.push(`表单「${form.tableName}」未找到映射，已跳过字段设置`)
        continue
      }

      try {
        if (index > 0) {
          await syncCurrentAiDraft()
        }

        const opened = await openForm({
          tableId: target.tableId,
        })
        if (!opened?.ok) {
          throw new Error(`打开表单失败${opened?.reason ? `（${opened.reason}）` : ''}`)
        }
        await nextTick()
        const formRuntime = await ensureFormRuntime()
        const widgetMap = buildScopedWidgetMap(await getFormWidgets(formRuntime))
        await applyBlueprintFieldSettingsInContainer(
          blueprint,
          form.fields,
          '',
          '',
          widgetMap,
          formResult,
          formRuntime,
          { deferRelations: shouldDeferBlueprintRelations },
        )
      } catch (error) {
        formResult.fieldWarnings.push(`表单「${form.tableName}」字段设置失败：${error instanceof Error ? error.message : String(error)}`)
      }

      formResult.fieldWarnings = normalizeFieldWarnings(formResult.fieldWarnings)
      warnings.push(...formResult.fieldWarnings)
      await applyOptions?.onProgress?.({
        stage: 'form-completed',
        totalFormCount: targetForms.length,
        formResult: cloneValue(formResult),
      })
    }

    const formulaRuntimeByWidgetId = new Map<string, NocodeEditorAiFormRuntime>()
    if (blueprintFormulaPlan.plan.items.length) {
      for (let index = 0; index < targetForms.length; index += 1) {
        const form = targetForms[index]
        const formResult = results[index]
        const target = tableMap.get(getNocodeEditorBlueprintFormApplyTargetIdentity(form))
        if (!target) continue
        const opened = await openForm({ tableId: target.tableId })
        if (!opened?.ok) continue
        await nextTick()
        const formRuntime = await ensureFormRuntime()
        await enrichBlueprintFormulaBindings(formRuntime, formResult)
        for (const binding of formResult.fieldBindings || []) {
          formulaRuntimeByWidgetId.set(binding.widgetId, formRuntime)
        }
      }
    }

    const previousBlueprintApplyResult = stagedAppBlueprint.value.applyResult
    const previousFormulaApplyForms = (
      previousBlueprintApplyResult
      && typeof previousBlueprintApplyResult === 'object'
      && Array.isArray((previousBlueprintApplyResult as { forms?: unknown }).forms)
    )
      ? (previousBlueprintApplyResult as NocodeEditorAiBlueprintApplyResult).forms
      : []
    const formulaCheckpoint = previousFormulaApplyForms
      .map(formResult => formResult.formulaApply?.checkpoint)
      .find(checkpoint => checkpoint)
      || null
    const formulaContextFingerprint = results
      .flatMap(formResult => formResult.fieldBindings || [])
      .map(binding => [
        String(binding.tableId || '').trim(),
        String(binding.widgetId || '').trim(),
        String(binding.fieldKey || '').trim(),
        (binding.formulaPaths || []).join(','),
      ].join(':'))
      .sort()
      .join('|')
    let formulaApply = await applyBlueprintFormulaPlan({
      formulaPlan: blueprintFormulaPlan,
      formResults: results,
      getBindings: () => results.flatMap(formResult => formResult.fieldBindings || []),
      checkpoint: formulaCheckpoint,
      contextFingerprint: formulaContextFingerprint,
      getRuntimeFormula: async ({ widgetId, formulaPath }) => {
        const formRuntime = formulaRuntimeByWidgetId.get(widgetId)
        const schema = await formRuntime?.getAiWidgetOptionSchema?.({ widgetId })
        const formulaOption = findSchemaOption(schema, { keys: [formulaPath] })
        return typeof formulaOption?.currentValue === 'string'
          ? formulaOption.currentValue
          : undefined
      },
      setAiFieldOptions: async ({ widgetId, changes }) => {
        const formRuntime = formulaRuntimeByWidgetId.get(widgetId)
        if (!formRuntime?.setAiFieldOptions) {
          throw new Error('公式目标字段未找到可写入的表单运行态。')
        }
        await formRuntime.setAiFieldOptions({ widgetId, changes })
      },
    })
    for (const formResult of results) {
      formResult.formulaApply = buildBlueprintFormulaApplyResultForForm(
        formulaApply,
        formResult,
      )
    }

    if (shouldDeferBlueprintRelations) {
      for (let index = 0; index < targetForms.length; index += 1) {
        const form = targetForms[index]
        const formResult = results[index]
        const target = tableMap.get(getNocodeEditorBlueprintFormApplyTargetIdentity(form))
        if (!target) continue
        const opened = await openForm({ tableId: target.tableId })
        if (!opened?.ok) continue
        await nextTick()
        const formRuntime = await ensureFormRuntime()
        await applyDeferredBlueprintRelations(
          blueprint,
          form.fields,
          '',
          formResult,
          formRuntime,
        )
      }
    }

    if (targetForms.length) {
      await syncCurrentAiDraft()
    }

    const summary = {
      formsCreated: results.filter(item => item.created).length,
      formsReused: results.filter(item => item.reused).length,
      fieldsCreated: results.reduce((total, item) => total + item.fieldsCreated.length, 0),
      fieldsReused: results.reduce((total, item) => total + item.fieldsReused.length, 0),
      fieldsUpdated: results.reduce((total, item) => total + item.fieldsUpdated.length, 0),
    }
    const normalizedWarnings = normalizeFieldWarnings(
      results.flatMap(formResult => formResult.fieldWarnings),
    )
    const postFormFlowSignals = isNocodeEditorPostFormFlowEnabledForScope(planningScope)
      ? collectNocodeEditorPostFormFlowSignals({
        userGoal: blueprint.title,
        blueprintTitle: blueprint.title,
        blueprintSummary: blueprint.summary,
        forms: results,
      })
      : null
    const persistOutcome = await persistAppliedBlueprint()

    if (persistOutcome.mode === 'draft_only') {
      formulaApply = {
        ...formulaApply,
        persistenceMode: 'draft_only',
        targetResults: formulaApply.targetResults.map(targetResult => (
          targetResult.status === 'updated'
            ? {
              ...targetResult,
              status: 'draft' as const,
              draftOnly: true as const,
              overlayDraft: true as const,
            }
            : targetResult
        )),
        checkpoint: null,
      }
      const { formulaSummary } = summarizeBlueprintFormulaApply({
        formulaApply,
        persistenceMode: 'draft_only',
      })
      for (const formResult of results) {
        if (formResult.formulaApply) {
          formResult.formulaApply = buildBlueprintFormulaApplyResultForForm(formulaApply, formResult)
        }
      }
      const draftBlueprint = mergeDraftIssuesIntoBlueprintOpenQuestions(
        blueprint,
        persistOutcome.draft.issues,
      )
      const provisionalResult: NocodeEditorAiBlueprintApplyResult = {
        planningScope,
        ok: true,
        persistenceMode: 'draft_only',
        draftPersistenceState: null,
        blueprintId: blueprint.id || draftBlueprint.id || '',
        startedAt,
        finishedAt: Date.now(),
        forms: results,
        warnings: normalizedWarnings,
        postFormFlowSignals: postFormFlowSignals?.hasEvidence ? postFormFlowSignals : null,
        formulaSummary,
        summary,
      }
      const appliedDraftMarker = getStagedBlueprintMarker({
        phase: 'applied_draft',
        applyResult: provisionalResult,
      })
      const draftState = buildBlueprintDraftPersistenceState(persistOutcome.draft, {
        sourceBlueprintIdentityKey: appliedDraftMarker.identityKey,
        sourceBlueprintVersionKey: appliedDraftMarker.versionKey,
        sourceFormId: String(options.activeFormId.value || '').trim() || undefined,
      })
      const postFormFlowReleaseContext = buildNocodeEditorPostFormFlowReleaseContext({
        planningScope,
        persistenceMode: 'draft_only',
        draftPersistenceState: draftState,
        formulaSummary,
        formulaApplyResults: results
          .map(item => item.formulaApply)
          .filter((item): item is NocodeEditorFormulaApplyResult => Boolean(item)),
        fieldBindings: results.flatMap(item => item.fieldBindings || []),
      })
      const result: NocodeEditorAiBlueprintApplyResult = {
        ...provisionalResult,
        draftPersistenceState: draftState,
        postFormFlowRelease: resolveNocodeEditorPostFormFlowRelease(
          postFormFlowReleaseContext,
        ),
      }
      options.markAiDraftStatus?.(draftState)
      stagedAppBlueprint.value = createAppliedDraftBlueprintState({
        planningScope,
        revision: stagedAppBlueprint.value.revision,
        stagedAt: stagedAppBlueprint.value.stagedAt,
        blueprint: draftBlueprint,
        applyResult: result,
        draftPersistenceState: draftState,
        sourcePlanningContextKey: stagedAppBlueprint.value.sourcePlanningContextKey,
      })
      return cloneValue(result)
    }

    const { formulaSummary } = summarizeBlueprintFormulaApply({
      formulaApply,
      persistenceMode: 'saved',
    })
    for (const formResult of results) {
      if (formResult.formulaApply) {
        formResult.formulaApply = {
          ...formResult.formulaApply,
          persistenceMode: 'saved',
        }
      }
    }
    const postFormFlowReleaseContext = buildNocodeEditorPostFormFlowReleaseContext({
      planningScope,
      persistenceMode: 'saved',
      draftPersistenceState: null,
      formulaSummary,
      formulaApplyResults: results
        .map(item => item.formulaApply)
        .filter((item): item is NocodeEditorFormulaApplyResult => Boolean(item)),
      fieldBindings: results.flatMap(item => item.fieldBindings || []),
    })
    const result: NocodeEditorAiBlueprintApplyResult = {
      planningScope,
      ok: true,
      persistenceMode: 'saved',
      draftPersistenceState: null,
      blueprintId: blueprint.id || stagedAppBlueprint.value.blueprint?.id || '',
      startedAt,
      finishedAt: Date.now(),
      forms: results,
      warnings: normalizedWarnings,
      postFormFlowSignals: postFormFlowSignals?.hasEvidence ? postFormFlowSignals : null,
      postFormFlowRelease: resolveNocodeEditorPostFormFlowRelease(
        postFormFlowReleaseContext,
      ),
      formulaSummary,
      summary,
    }

    const appliedBlueprint = {
      ...blueprint,
      openQuestions: filterNocodeEditorDraftIssueOpenQuestions(blueprint.openQuestions),
    }

    options.markAiDraftStatus?.({
      mode: 'clean',
      issueCount: 0,
      summary: '',
      issues: [],
      actionIssues: [],
      updatedAt: Date.now(),
      dirty: false,
      sourceBlueprintIdentityKey: getStagedBlueprintMarker({
        phase: 'applied_saved',
        applyResult: result,
      }).identityKey,
      sourceBlueprintVersionKey: getStagedBlueprintMarker({
        phase: 'applied_saved',
        applyResult: result,
      }).versionKey,
      sourceFormId: String(options.activeFormId.value || '').trim() || undefined,
    })
    stagedAppBlueprint.value = createAppliedSavedBlueprintState({
      planningScope,
      revision: stagedAppBlueprint.value.revision,
      stagedAt: stagedAppBlueprint.value.stagedAt,
      blueprint: cloneValue(appliedBlueprint),
      applyResult: result,
      sourcePlanningContextKey: stagedAppBlueprint.value.sourcePlanningContextKey,
    })

    return cloneValue(result)
  }

  const resolveExcelImportHandleForForm = (
    blueprint: NocodeEditorAiAppBlueprint,
    form: NocodeEditorAiAppBlueprintForm,
  ) => {
    const blueprintId = String(blueprint.id || '').trim()
    const formKey = String(form.excelImportContext?.formKey || form.formKey || form.tableName).trim()
    if (!blueprintId || !formKey) {
      return null
    }
    return pendingExcelImportHandles.get(buildExcelImportHandleKey(blueprintId, formKey)) || null
  }

  const applyStagedAppBlueprintAndImportExcel = async (
    applyOptions?: NocodeEditorAiBlueprintApplyOptions,
  ): Promise<NocodeEditorAiBlueprintApplyResult> => {
    const applyResult = await applyStagedAppBlueprint(applyOptions)
    const blueprint = stagedAppBlueprint.value.blueprint
    if (!blueprint) {
      return applyResult
    }

    if (applyResult.persistenceMode === 'draft_only') {
      return {
        ...applyResult,
        warnings: normalizeFieldWarnings([
          ...(applyResult.warnings || []),
          '当前表单仍有待补配置，本次未导入 Excel 数据，请先补齐后再重试。',
        ]),
        excelImportResults: [],
      }
    }

    const excelImportResults: NocodeEditorAiExcelImportAfterBlueprintResult[] = []
    const importWarnings = [...(applyResult.warnings || [])]
    const formsToImport = selectNocodeEditorAiBlueprintFormsByTargetFormKeys(
      blueprint.forms || [],
      applyOptions?.targetFormKeys,
    )

    for (const { form } of formsToImport) {
      const importContext = form.excelImportContext as NocodeEditorAiExcelBlueprintImportContext | undefined
      if (!importContext) {
        continue
      }

      const importHandle = resolveExcelImportHandleForForm(blueprint, form)
      if (!importHandle?.fullPath) {
        importWarnings.push(`表单「${form.tableName}」缺少可用的 Excel 上传会话，请重新上传后再导入。`)
        continue
      }

      const formResult = applyResult.forms.find(item => item.formKey === (form.formKey || form.tableName))
        || applyResult.forms.find(item => item.tableName === form.tableName)
      if (!formResult?.tableId) {
        importWarnings.push(`表单「${form.tableName}」未找到生成结果，已跳过 Excel 导入。`)
        continue
      }

      const mappingResult = buildExcelImportMappingsFromApplyResult({
        form,
        applyResult,
      })
      const targetTableId = mappingResult.tableId || formResult.tableId
      const targetTableName = mappingResult.tableName || formResult.tableName || form.tableName
      if (!targetTableId) {
        importWarnings.push(`表单「${form.tableName}」未找到可导入的目标表，已跳过 Excel 导入。`)
        continue
      }

      const warnings = Array.isArray(mappingResult.warnings)
        ? mappingResult.warnings.map(item => String(item || '').trim()).filter(Boolean)
        : []

      try {
        const response = await axios.post('/nocode/import-excel-data', {
          nocodeId: options.nocodeId,
          tableUID: targetTableId,
          runtime: undefined,
          extraData: {
            fullPath: importHandle.fullPath,
            worksheet: importContext.source.worksheet,
            sessionId: importHandle.sessionId,
          },
          mapping: mappingResult.mapping,
          subformMappings: mappingResult.subformMappings,
          titleRowIndex: importContext.source.titleRowIndex,
        }, options.nocode.value?.body?.sign ? {
          headers: {
            'x-sign': options.nocode.value.body.sign,
          },
        } : undefined)

        excelImportResults.push({
          ok: true,
          tableId: targetTableId,
          tableName: targetTableName,
          successImportCount: Number(response.data?.successImportCount || 0),
          total: Number(response.data?.total || 0),
          addedCount: Number(response.data?.addedCount || 0),
          updatedCount: Number(response.data?.updatedCount || 0),
          warnings,
        })
        importWarnings.push(...warnings)
        pendingExcelImportHandles.delete(
          buildExcelImportHandleKey(
            String(blueprint.id || '').trim(),
            String(importContext.formKey || form.formKey || form.tableName).trim(),
          ),
        )
        await releaseExcelImportHandle(importHandle)
      } catch (error) {
        if (options.handleSyncConflict?.(error)) {
          pendingExcelImportHandles.delete(
            buildExcelImportHandleKey(
              String(blueprint.id || '').trim(),
              String(importContext.formKey || form.formKey || form.tableName).trim(),
            ),
          )
          await releaseExcelImportHandle(importHandle)
          throw error
        }
        const errorMessage = error instanceof Error ? error.message : String(error)
        excelImportResults.push({
          ok: false,
          tableId: targetTableId,
          tableName: targetTableName,
          successImportCount: 0,
          total: 0,
          warnings: normalizeFieldWarnings([
            ...warnings,
            `表单「${form.tableName}」导入 Excel 数据失败：${errorMessage}`,
          ]),
        })
        importWarnings.push(...warnings, `表单「${form.tableName}」导入 Excel 数据失败：${errorMessage}`)
      }
    }

    const hasFailedImport = excelImportResults.some(item => item.ok === false)

    return {
      ...applyResult,
      ok: applyResult.ok && !hasFailedImport,
      excelImportResults,
      warnings: normalizeFieldWarnings(importWarnings),
    }
  }

  const materializePlannedFlowDependencies = async (input: {
    flowPlan: NocodeEditorFlowPlan
    targetFormId?: string
    targetFormName?: string
  }): Promise<PlannedFlowFieldMaterializationResult & {
    flowPlan: NocodeEditorFlowPlan
    materializationScheme?: NocodeEditorFlowScheme
  }> => {
    const scheme = stagedFlowScheme.value.scheme
    if (!scheme) {
      const requiresFlowScheme = requiresFlowSchemeForFlowPlan({
        flowPlan: input.flowPlan,
        sourceSchemeRevision: stagedFlowPlan.value.sourceSchemeRevision,
      })
      if (requiresFlowScheme) {
        throw new FlowExecutionBlockerError({
          issueId: 'flow-planned-dependency-scheme-unavailable',
          sourceStage: 'apply',
          planningContextKey: resolveCurrentFlowPlanningContextKey(
            input.flowPlan.confirmation?.planningContextKey,
          ),
          blockedNextAction: 'editor_apply_staged_flow',
          userMessage: '当前流程蓝图依赖的流程方案未恢复，暂不能自动补齐流程依赖字段，请刷新会话后重试',
          code: 'flow_scheme_unavailable',
        })
      }
      return {
        materializedDependencyIds: [],
        fieldsCreated: [],
        fieldsReused: [],
        errors: [],
        flowPlan: input.flowPlan,
      }
    }

    if (!isFlowPlanApplyContextReady({
      flowPlan: input.flowPlan,
      sourceSchemeRevision: stagedFlowPlan.value.sourceSchemeRevision,
      flowScheme: scheme,
      flowSchemeRevision: stagedFlowScheme.value.revision,
    })) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-scheme-mismatch',
        sourceStage: 'apply',
        planningContextKey: resolveCurrentFlowPlanningContextKey(
          input.flowPlan.confirmation?.planningContextKey,
        ),
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: '当前流程蓝图与已恢复的流程方案版本不一致，暂不能自动补齐流程依赖字段，请重新生成流程蓝图',
        code: 'flow_scheme_mismatch',
      })
    }

    const planningContextKey = resolveCurrentFlowPlanningContextKey(
      input.flowPlan.confirmation?.planningContextKey,
    )
    const formRuntime = await ensureFormRuntime()
    const formSummary = await formRuntime.getAiFormSummary?.()
    if (!formSummary) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-form-summary-unavailable',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: '当前无法读取目标表单摘要，暂不能自动补齐流程依赖字段',
        code: 'target_form_summary_unavailable',
      })
    }
    const actualTargetFormId = String(formSummary.tableId || '').trim()
    const actualTargetFormName = String(formSummary.tableName || '').trim()
    const expectedTargetFormId = String(input.targetFormId || '').trim()
    const expectedTargetFormName = String(input.targetFormName || '').trim()
    if (!actualTargetFormId && !actualTargetFormName) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-target-form-identity-unavailable',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: '当前无法确认目标表单身份，暂不能自动补齐流程依赖字段',
        code: 'target_form_identity_unavailable',
      })
    }
    const targetFormMismatch = Boolean(
      (expectedTargetFormId && expectedTargetFormId !== actualTargetFormId)
      || (
        !expectedTargetFormId
        && expectedTargetFormName
        && normalizeToken(expectedTargetFormName) !== normalizeToken(actualTargetFormName)
      )
    )
    if (targetFormMismatch) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-target-form-mismatch',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: '当前打开的表单与流程蓝图目标不一致，暂不能自动补齐流程依赖字段',
        code: 'target_form_mismatch',
      })
    }

    const materializationPlan = buildPlannedFlowFieldMaterializationPlan({
      scheme,
      targetFormId: actualTargetFormId || expectedTargetFormId || undefined,
      targetFormName: actualTargetFormName || expectedTargetFormName || undefined,
    })
    if (materializationPlan.errors.length) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-invalid',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: materializationPlan.errors[0],
        code: 'planned_dependency_invalid',
      })
    }
    const availableWidgetTypes = Array.isArray(formSummary.availableWidgetTypes)
      ? formSummary.availableWidgetTypes
      : []
    const resolvedRequests = materializationPlan.requests.map((request) => {
      const resolvedType = resolveSupportedBlueprintWidgetType({
        requestedType: request.expectedType,
        availableWidgetTypes,
      })
      if (resolvedType.fallback && normalizeToken(resolvedType.widgetType) !== normalizeToken(request.expectedType)) {
        throw new Error(`流程依赖字段「${request.fieldName}」的组件类型「${request.expectedType}」当前不可用`)
      }
      return {
        ...request,
        expectedType: resolvedType.widgetType,
      }
    })
    const existingFields = flattenWidgetTree(
      Array.isArray(formSummary.widgets) ? formSummary.widgets : [],
    ).map(widget => ({
      name: getBlueprintFieldName(widget),
      widgetType: String(widget?.type || widget?.widgetType || '').trim() || undefined,
    })).filter(field => Boolean(field.name))
    const nameConflictResolution = resolvePlannedFlowFieldNameConflicts({
      requests: resolvedRequests,
      existingFields,
    })
    if (nameConflictResolution.errors.length) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-name-conflict',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: nameConflictResolution.errors[0],
        code: 'planned_dependency_name_conflict',
      })
    }
    const renamedFieldNameByDependencyId = new Map(
      nameConflictResolution.renamedDependencies.map(item => [item.dependencyId, item.fieldName]),
    )
    const materializationScheme = nameConflictResolution.renamedDependencies.length
      ? {
        ...scheme,
        dependencies: (scheme.dependencies || []).map(dependency => {
          const fieldName = renamedFieldNameByDependencyId.get(dependency.id)
          return fieldName
            ? {
              ...dependency,
              fieldRef: {
                ...dependency.fieldRef,
                fieldName,
              },
            }
            : dependency
        }),
      }
      : scheme
    const result = await materializePlannedFlowFieldRequests({
      requests: nameConflictResolution.requests,
      existingFields,
      createFields: async fields => await formRuntime.addAiFields?.({ fields }),
    })

    if (result.fieldsCreated.length) {
      const draftResult = await syncCurrentAiDraft({ persistToApp: true })
      if (draftResult.ok === false || draftResult.persistedToSession === false) {
        throw new Error(draftResult.error || '流程依赖字段已创建，但保存当前表单草稿失败')
      }
    }

    if (result.errors.length) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-materialization-failed',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: result.errors[0],
        code: 'planned_dependency_materialization_failed',
      })
    }

    const refreshedFlowSummary = await formRuntime.getAiFlowSummary?.()
    if (!refreshedFlowSummary) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-grounding-summary-unavailable',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: '流程依赖字段已处理，但当前无法重新校验流程引用，请稍后重试',
        code: 'flow_summary_unavailable',
      })
    }
    const personnelRebase = rebaseFlowPlanPlannedPersonnelFields({
      plan: input.flowPlan,
      scheme: materializationScheme,
      renamedDependencies: nameConflictResolution.renamedDependencies,
    })
    if (personnelRebase.errors.length) {
      throw new FlowExecutionBlockerError({
        issueId: 'flow-planned-dependency-materialization-failed',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: personnelRebase.errors[0],
        code: 'planned_dependency_materialization_failed',
      })
    }
    const materializationFlowPlan = personnelRebase.plan
    const personnelPreflight = validateFlowBlueprintPersonnelRequirements({
      plan: materializationFlowPlan,
      scheme: materializationScheme,
      flowSummary: refreshedFlowSummary,
    })
    if (personnelPreflight.diagnostics.length) {
      const firstDiagnostic = personnelPreflight.diagnostics[0]
      const isApprovalOwnerDiagnostic = String(firstDiagnostic?.code || '')
        .startsWith('blueprint_approval_owner_')
      throw new FlowExecutionBlockerError({
        issueId: isApprovalOwnerDiagnostic
          ? 'flow-blueprint-approval-owner-reference-inconsistent'
          : 'flow-blueprint-personnel-reference-inconsistent',
        sourceStage: 'apply',
        planningContextKey,
        blockedNextAction: 'editor_apply_staged_flow',
        userMessage: isApprovalOwnerDiagnostic
          ? '流程蓝图内部的审批人字段引用与已收敛流程方案不一致，请基于当前方案重新生成流程蓝图。'
          : '流程蓝图内部的人员来源与已收敛流程方案不一致，请基于当前方案重新生成流程蓝图。',
        code: firstDiagnostic?.code,
      })
    }
    const groundingDiagnostics = validateFlowPlanGrounding({
      plan: materializationFlowPlan,
      summary: refreshedFlowSummary,
    })
    if (groundingDiagnostics.length) {
      throw new FlowGroundingConfirmationError({
        planningContextKey,
        diagnostics: groundingDiagnostics,
      })
    }

    return {
      ...result,
      flowPlan: materializationFlowPlan,
      materializationScheme,
    }
  }

  const applyStagedFlow = async (): Promise<NocodeEditorAiFlowApplyResult> => {
    const flowPlan = (
      stagedFlowPlan.value.flowPlan
        || (
          stagedFlowBlueprint.value.blueprint
            ? convertNocodeEditorFlowBlueprintToFlowPlan(stagedFlowBlueprint.value.blueprint)
            : null
        )
    )
      ? cloneValue(
        (
          stagedFlowPlan.value.flowPlan
          || (
            stagedFlowBlueprint.value.blueprint
              ? convertNocodeEditorFlowBlueprintToFlowPlan(stagedFlowBlueprint.value.blueprint)
              : null
          )
        )!,
      )
      : null
    if (!flowPlan) {
      throw new Error('当前没有可按蓝图生成表单流程的流程蓝图')
    }
    const pendingConfirmationQuestions = resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(flowPlan)
    if (
      (Array.isArray(flowPlan.openQuestions) && flowPlan.openQuestions.length > 0)
      || pendingConfirmationQuestions.length > 0
    ) {
      throw new Error('当前流程规划仍有待确认问题，暂不能直接按蓝图生成表单流程')
    }
    if (isApplyingStagedFlow.value) {
      throw new Error('AI 正在按蓝图生成流程，请稍后再试')
    }

    isApplyingStagedFlow.value = true
    try {
      const targetFormId = String(flowPlan.target?.formId || '').trim()
      const targetFormName = String(flowPlan.target?.formName || '').trim()
      const activeFormId = String(options.activeFormId.value || '').trim()
      const activeFormName = activeFormId
        ? String(
          options.nocode.value?.body?.formData?.tables?.find(item => item.uid === activeFormId)?.alias || '',
        ).trim()
        : ''
      const isTargetFormAlreadyOpen = Boolean(
        options.isShowFormCreate.value
        && (
          (targetFormId && activeFormId === targetFormId)
          || (targetFormName && activeFormName === targetFormName)
        ),
      )

      if ((targetFormId || targetFormName) && !isTargetFormAlreadyOpen) {
        const opened = await openForm({
          tableId: targetFormId,
          tableName: targetFormName,
          tab: 'process-setting',
        })
        if (!opened?.ok) {
          const reason = String(opened?.reason || '').trim()
          if (reason === 'form_not_found') {
            throw new FlowExecutionBlockerError({
              issueId: 'flow-apply-target-form-not-found',
              sourceStage: 'apply',
              planningContextKey: resolveCurrentFlowPlanningContextKey(flowPlan.confirmation?.planningContextKey),
              blockedNextAction: 'editor_apply_staged_flow',
              userMessage: '当前流程蓝图对应的目标表单不存在，暂不能直接按蓝图生成表单流程',
              code: reason,
            })
          }
          if (reason === 'page_has_unsaved_changes') {
            throw new FlowExecutionBlockerError({
              issueId: 'flow-apply-page-has-unsaved-changes',
              sourceStage: 'apply',
              planningContextKey: resolveCurrentFlowPlanningContextKey(flowPlan.confirmation?.planningContextKey),
              blockedNextAction: 'editor_apply_staged_flow',
              userMessage: '当前页面存在未保存变更，请先处理后再按蓝图生成表单流程',
              code: reason,
            })
          }
          if (reason === 'form_has_unsaved_changes' || reason === 'active_form_has_unsaved_changes') {
            throw new FlowExecutionBlockerError({
              issueId: 'flow-apply-form-has-unsaved-changes',
              sourceStage: 'apply',
              planningContextKey: resolveCurrentFlowPlanningContextKey(flowPlan.confirmation?.planningContextKey),
              blockedNextAction: 'editor_apply_staged_flow',
              userMessage: '当前表单存在未保存变更，请先处理后再按蓝图生成表单流程',
              code: reason,
            })
          }
          throw new FlowExecutionBlockerError({
            issueId: 'flow-apply-target-form-open-failed',
            sourceStage: 'apply',
            planningContextKey: resolveCurrentFlowPlanningContextKey(flowPlan.confirmation?.planningContextKey),
            blockedNextAction: 'editor_apply_staged_flow',
            userMessage: '当前流程蓝图对应的目标表单无法打开，暂不能直接按蓝图生成表单流程',
            code: reason || 'open_form_failed',
          })
        }
        await nextTick()
      }

      const refreshedDraft = await options.formCreateRef.value?.refreshAiDraftPersistenceState?.()
      if (!refreshedDraft?.draftRefreshOk) {
        throw new FlowExecutionBlockerError({
          issueId: 'flow-apply-form-readiness-unavailable',
          sourceStage: 'apply',
          planningContextKey: resolveCurrentFlowPlanningContextKey(
            flowPlan.confirmation?.planningContextKey,
          ),
          blockedNextAction: 'editor_apply_staged_flow',
          userMessage: '当前无法确认表单配置是否已更新，请刷新表单状态后再生成流程',
          code: 'form_readiness_unavailable',
        })
      }
      const refreshedDraftPersistenceState = (
        refreshedDraft.draftPersistenceState
        && refreshedDraft.draftPersistenceState.resolved !== true
      )
        ? refreshedDraft.draftPersistenceState
        : null
      const blueprintApplyResult = stagedAppBlueprint.value.applyResult
      const flowApplyReleaseContext = buildNocodeEditorPostFormFlowReleaseContext({
        planningScope: 'form',
        persistenceMode: refreshedDraftPersistenceState ? 'draft_only' : 'saved',
        draftPersistenceState: refreshedDraftPersistenceState,
        formulaSummary: blueprintApplyResult?.formulaSummary,
        formulaApplyResults: (blueprintApplyResult?.forms || [])
          .map(item => item.formulaApply)
          .filter(Boolean) as NonNullable<NocodeEditorAiBlueprintApplyFormResult['formulaApply']>[],
        fieldBindings: (blueprintApplyResult?.forms || []).flatMap(
          item => item.fieldBindings || [],
        ),
        flowScheme: stagedFlowScheme.value.scheme,
      })
      const flowApplyRelease = resolveNocodeEditorPostFormFlowRelease(
        flowApplyReleaseContext,
      )
      if (!flowApplyRelease.canApply) {
        const fieldNames = Array.from(new Set(
          flowApplyRelease.relatedIssues
            .map(issue => String(issue.targetFieldName || '').trim())
            .filter(Boolean),
        ))
        throw new FlowExecutionBlockerError({
          issueId: 'flow-apply-related-form-issues',
          sourceStage: 'apply',
          planningContextKey: resolveCurrentFlowPlanningContextKey(
            flowPlan.confirmation?.planningContextKey,
          ),
          blockedNextAction: 'editor_apply_staged_flow',
          userMessage: fieldNames.length
            ? `当前流程会使用字段“${fieldNames.join('、')}”，请先完善这些字段后再生成流程`
            : '当前表单存在与这条流程直接相关的配置问题，请先完善后再生成流程',
          code: 'flow_related_form_issue',
        })
      }

      const startedAt = Date.now()
      const materializationResult = await materializePlannedFlowDependencies({
        flowPlan,
        targetFormId: targetFormId || undefined,
        targetFormName: targetFormName || undefined,
      })
      const formRuntime = await ensureProcessRuntime()
      const guardedFlowPlan = await validateFlowPlanWithRuntime(materializationResult.flowPlan, formRuntime)
      const guardedPendingConfirmationQuestions = (
        resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(guardedFlowPlan)
      )
      if (
        normalizeStringArray(guardedFlowPlan.openQuestions).length > 0
        || guardedPendingConfirmationQuestions.length > 0
      ) {
        stagedFlowPlan.value = {
          ...stagedFlowPlan.value,
          flowPlan: cloneValue(guardedFlowPlan),
          applyResult: null,
        }
        throw new Error('当前流程规划仍有待确认问题，暂不能直接按蓝图生成表单流程')
      }
      const applied = await formRuntime.applyAiFlowPlan?.({
        plan: guardedFlowPlan,
      })
      if (!applied?.ok) {
        throw new Error('按蓝图生成表单流程失败')
      }

      if (
        materializationResult.materializedDependencyIds.length
        && materializationResult.materializationScheme
      ) {
        const materializedScheme = markFlowDependenciesMaterialized(
          materializationResult.materializationScheme,
          materializationResult.materializedDependencyIds,
        )
        const routingState = buildFlowSchemeRoutingState({
          scheme: materializedScheme,
          planningContextKey: materializedScheme.confirmation?.planningContextKey,
        })
        stagedFlowScheme.value = {
          ...stagedFlowScheme.value,
          scheme: projectFlowSchemeWithRoutingState(materializedScheme, routingState),
          planningStatus: routingState.projection.planningStatus,
          flowUnifiedIssues: routingState.flowUnifiedIssues,
          flowIssueRouting: routingState.flowIssueRouting,
        }
      }

      const draftResult = await syncCurrentAiDraft({
        persistToApp: true,
        skipProcessValidation: true,
      })
      if (draftResult.ok === false || draftResult.persistedToSession === false) {
        throw new Error(draftResult.error || '已按蓝图生成表单流程，但同步当前表单状态失败')
      }

      if (stagedFlowScheme.value.scheme) {
        const reconciledScheme = decorateFlowSchemeWithConvergence({
          scheme: stagedFlowScheme.value.scheme,
          flowIssueState: draftResult.flowIssueState || null,
          deriveDependencies: false,
          deriveDeferredConfigItems: true,
        })
        const routingState = buildFlowSchemeRoutingState({
          scheme: reconciledScheme,
          planningContextKey: reconciledScheme.confirmation?.planningContextKey,
        })
        stagedFlowScheme.value = {
          ...stagedFlowScheme.value,
          scheme: projectFlowSchemeWithRoutingState(reconciledScheme, routingState),
          planningStatus: routingState.projection.planningStatus,
          flowUnifiedIssues: routingState.flowUnifiedIssues,
          flowIssueRouting: routingState.flowIssueRouting,
        }
      }

      const warnings = Array.isArray(applied.warnings)
        ? [...applied.warnings]
        : []
      if (materializationResult.fieldsCreated.length) {
        warnings.push(`已自动创建流程依赖字段：${materializationResult.fieldsCreated.join('、')}`)
      }
      if (draftResult.hasBlockingIssues) {
        warnings.push('当前表单还有未完成的配置项，已先把表单流程同步到当前 AI 会话中')
      }
      if (draftResult.flowIssueState?.mode === 'flow_issue') {
        warnings.push('当前流程还有待补配置，已保存到当前草稿中')
      }
      if (flowApplyRelease.status === 'needs_fix' && flowApplyRelease.issueCount > 0) {
        warnings.push(
          `流程已生成；当前表单另有 ${flowApplyRelease.issueCount} 项不影响本流程的配置仍待完善`,
        )
      }

      const result: NocodeEditorAiFlowApplyResult = {
        ok: true,
        startedAt: Number(applied.startedAt || startedAt) || startedAt,
        finishedAt: Number(applied.finishedAt || Date.now()) || Date.now(),
        summary: {
          triggerBranchCount: Number(applied.summary?.triggerBranchCount || 0),
          totalNodeCount: Number(applied.summary?.totalNodeCount || 0),
          branchCount: Number(applied.summary?.branchCount || 0),
        },
        warnings: normalizeFieldWarnings(warnings),
        flowIssueState: draftResult.flowIssueState || applied.flowIssueState || null,
      }
      const runtimeFlowUnifiedIssues = buildUnifiedFlowIssuesFromFlowIssueState({
        sourceStage: 'runtime',
        planningContextKey: resolveCurrentFlowPlanningContextKey(guardedFlowPlan.confirmation?.planningContextKey),
        blockedNextAction: 'editor_apply_staged_flow',
        flowIssueState: result.flowIssueState,
        issueResolutions: FLOW_RUNTIME_ISSUE_RESOLUTIONS,
      })
      const runtimeFlowIssueRouting = routeUnifiedFlowIssues(runtimeFlowUnifiedIssues)
      const resultWithFlowIssues: NocodeEditorAiFlowApplyResult = {
        ...result,
        flowUnifiedIssues: runtimeFlowUnifiedIssues,
        flowIssueRouting: runtimeFlowIssueRouting,
      }

      stagedFlowPlan.value = {
        ...stagedFlowPlan.value,
        flowPlan: cloneValue(guardedFlowPlan),
        applyResult: cloneValue(resultWithFlowIssues),
      }
      stagedFlowBlueprint.value = {
        ...stagedFlowBlueprint.value,
        applyResult: cloneValue(resultWithFlowIssues),
      }

      return cloneValue(resultWithFlowIssues)
    } finally {
      isApplyingStagedFlow.value = false
    }
  }

  const executeTool = async (toolName: string, input: Record<string, any> = {}) => {
    if (toolName === 'editor_get_host_context') {
      return await getHostContext()
    }

    if (toolName === 'editor_stage_app_plan') {
      return await stageAppPlan(input)
    }

    if (toolName === 'editor_stage_single_form_plan') {
      return await stageFormPlan(input, '表单规划')
    }

    if (toolName === 'editor_stage_content_plan') {
      return await stageContentPlan(input)
    }

    if (toolName === 'editor_stage_formula_plan') {
      return await stageFormulaPlan(input)
    }

    if (toolName === 'editor_get_flow_summary') {
      return await getFlowSummary()
    }

    if (toolName === 'editor_patch_flow') {
      return await patchFlow(input)
    }

    if (toolName === 'editor_plan_flow_scheme') {
      return await stageFlowScheme(input)
    }

    if (toolName === 'editor_stage_flow_blueprint') {
      return await stageFlowBlueprint(input)
    }

    if (toolName === 'editor_apply_staged_flow') {
      return await applyStagedFlow()
    }

    if (toolName === 'editor_get_staged_app_plan') {
      return await getStagedAppPlan()
    }

    if (toolName === 'editor_clear_staged_app_plan') {
      return await clearStagedAppPlan()
    }

    if (toolName === 'editor_create_form') {
      return await createForm(input)
    }

    if (toolName === 'editor_open_form') {
      const previousFormId = String(options.activeFormId.value || '').trim()
      const result = await openForm(input)
      const nextFormId = String(result?.tableId || options.activeFormId.value || '').trim()
      if (result?.ok && nextFormId && previousFormId !== nextFormId) {
        markTaskContextGuardDirty(nextFormId)
      }
      return result
    }

    if (toolName === CURRENT_TASK_CONTEXT_TOOL_NAME) {
      return await resolveCurrentTaskContext()
    }

    if (toolName === 'editor_stage_app_blueprint') {
      return await stageAppBlueprint(input)
    }

    if (toolName === 'editor_get_staged_app_blueprint') {
      return compactStagedAppBlueprintForModel(await getStagedAppBlueprint(), input)
    }

    if (toolName === 'editor_apply_staged_app_blueprint') {
      return await applyStagedAppBlueprint()
    }

    if (toolName === 'editor_clear_staged_app_blueprint') {
      return await clearStagedAppBlueprint()
    }

    if (toolName === 'editor_get_all_form_summaries') {
      return await getAllFormSummaries(input as any)
    }

    if (toolName === 'editor_get_relation_context') {
      return await getRelationContext(input as any)
    }

    if (toolName === 'editor_get_targeted_form_summaries') {
      return await getTargetedFormSummaries(input as any)
    }

    if (toolName === 'editor_set_enum_options') {
      return await setEnumOptions(input as any)
    }

    if (FORM_TOOL_NAMES.has(toolName)) {
      const formRuntime = await ensureFormRuntime()

      if (toolName === 'editor_get_form_summary') {
        const summary = compactFormSummaryForModel(await formRuntime.getAiFormSummary?.() || {})
        return summary
      }
      if (toolName === 'editor_get_widget_option_schema') {
        return await formRuntime.getAiWidgetOptionSchema?.(input as any)
      }
      if (toolName === 'editor_get_widget_option_choices') {
        return await formRuntime.getAiWidgetOptionChoices?.(input as any)
      }
      if (toolName === 'editor_add_fields') {
        return await formRuntime.addAiFields?.(input as any)
      }
      if (toolName === 'editor_delete_field') {
        return await formRuntime.deleteAiField?.(input as any)
      }
      if (toolName === 'editor_replace_field') {
        return await formRuntime.replaceAiField?.(input as any)
      }
      if (toolName === 'editor_bind_field_source') {
        const result = await bindFieldSourceByName(formRuntime, input as any)
        const draftState = await options.formCreateRef.value?.refreshAiDraftPersistenceState?.()
        return {
          ...result,
          ...buildFieldToolDraftRefreshOutput(draftState),
        }
      }
      if (toolName === 'editor_set_field_formulas') {
        const useStagedPlan = input?.useStagedPlan === true
        const hasItems = Object.prototype.hasOwnProperty.call(input || {}, 'items')
        if (useStagedPlan && hasItems) {
          throw createFormulaStageError('formula_plan_required', 'FORMULA_PLAN_REQUIRED')
        }
        const expectedFormulaItems = await ensureStagedFormulaExecutorContext()
        ensureFormulaTaskContextReady(input)
        const items = useStagedPlan
          ? expectedFormulaItems
          : Array.isArray(input?.items) ? input.items : []
        if (!useStagedPlan && (
          JSON.stringify(normalizeFormulaExecutorItemsForComparison(items))
          !== JSON.stringify(normalizeFormulaExecutorItemsForComparison(expectedFormulaItems))
        )) {
          throw createFormulaStageError('formula_plan_required', 'FORMULA_PLAN_REQUIRED')
        }
        if (!items.length) {
          throw new Error('缺少要设置公式的目标字段')
        }
        const itemResults: Array<Record<string, any>> = []
        const formulaTargetResults: Array<Record<string, any>> = []
        for (const item of items) {
          const status = String(item?.status || '').trim()
          if (status !== 'updated' && status !== 'skipped') {
            throw new Error(`公式目标状态无效：${status || 'unknown'}`)
          }
          const widgetId = String(item?.widgetId || '').trim()
          const tableId = String(item?.tableId || '').trim()
          const tableName = String(item?.tableName || '').trim()
          const fieldName = String(item?.fieldName || item?.name || '').trim()
          const explanation = String(item?.explanation || item?.summary || '').trim()
          const reason = String(item?.reason || '').trim()
          const changes = Array.isArray(item?.changes) ? item.changes : []
          if (status === 'skipped') {
            if (!fieldName) {
              throw new Error('存在缺少 fieldName 的未修改公式目标字段')
            }
            if (!reason) {
              throw new Error(`字段 ${fieldName} 缺少未修改原因`)
            }
            formulaTargetResults.push({
              status: 'skipped',
              ...(tableId ? { tableId } : {}),
              ...(tableName ? { tableName } : {}),
              ...(widgetId ? { widgetId } : {}),
              fieldName,
              reason,
            })
            continue
          }
          if (!widgetId) {
            throw new Error('存在缺少 widgetId 的公式目标字段')
          }
          if (!changes.length) {
            throw new Error(`字段 ${widgetId} 缺少公式设置项`)
          }
          assertValidFormulaFieldReferenceFormat(changes, fieldName || widgetId)
          const overlayDraftApply = await tryApplyFormulaOverlayDraft({
            widgetId,
            ...(tableId ? { tableId } : {}),
            ...(tableName ? { tableName } : {}),
            ...(fieldName ? { fieldName } : {}),
            ...(explanation ? { explanation } : {}),
            changes,
          })
          if (overlayDraftApply) {
            itemResults.push(overlayDraftApply.itemResult)
            formulaTargetResults.push(overlayDraftApply.targetResult)
            continue
          }
          try {
            const result = await formRuntime.setAiFieldOptions?.({
              widgetId,
              changes,
            })
            const normalizedResult = result && typeof result === 'object' ? result as Record<string, any> : { widgetId, result }
            itemResults.push(normalizedResult)
            const updates = Array.isArray(normalizedResult?.formulaUpdates) ? normalizedResult.formulaUpdates : []
            for (const update of updates) {
              formulaTargetResults.push({
                ...update,
                status: 'updated',
                ...(explanation ? { explanation } : {}),
              })
            }
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            itemResults.push({ widgetId, error: reason })
            for (const change of changes) {
              const formulaPath = normalizeOptionPath(change)
              if (!isFormulaSettingPath(formulaPath)) {
                continue
              }
              formulaTargetResults.push({
                status: 'failed',
                ...(tableId ? { tableId } : {}),
                ...(tableName ? { tableName } : {}),
                widgetId,
                fieldName: fieldName || widgetId,
                formulaPath: formulaPath.join('.'),
                formula: String(change?.value || ''),
                ...(explanation ? { explanation } : {}),
                reason,
              })
            }
          }
        }
        const draftState = await options.formCreateRef.value?.refreshAiDraftPersistenceState?.()
        const output = {
          items: itemResults,
          applied: itemResults.flatMap(item => (Array.isArray(item?.applied) ? item.applied : [])),
          formulaUpdates: itemResults.flatMap(item => (Array.isArray(item?.formulaUpdates) ? item.formulaUpdates : [])),
          formulaTargetResults,
          ...buildFieldToolDraftRefreshOutput(draftState),
        }
        return output
      }
      if (toolName === 'editor_set_field_options') {
        if (hasFormulaSettingChanges(input)) {
          throw createFormulaStageError('formula_plan_required', 'FORMULA_PLAN_REQUIRED')
        }
        ensureFormulaTaskContextReady(input)
        const widgetId = String(input?.widgetId || '').trim()
        const tableId = String(input?.tableId || '').trim()
        const tableName = String(input?.tableName || '').trim()
        const fieldName = String(input?.fieldName || input?.name || '').trim()
        const explanation = String(input?.explanation || input?.summary || '').trim()
        const changes = Array.isArray(input?.changes) ? input.changes : []
        const formulaChange = findFormulaSettingChange(changes)
        if (widgetId && formulaChange) {
          assertValidFormulaFieldReferenceFormat(changes, fieldName || widgetId)
          const overlayDraftApply = await tryApplyFormulaOverlayDraft({
            widgetId,
            ...(tableId ? { tableId } : {}),
            ...(tableName ? { tableName } : {}),
            ...(fieldName ? { fieldName } : {}),
            ...(explanation ? { explanation } : {}),
            changes,
          })
          if (overlayDraftApply) {
            const draftState = await options.formCreateRef.value?.refreshAiDraftPersistenceState?.()
            return {
              ...overlayDraftApply.itemResult,
              formulaTargetResults: [overlayDraftApply.targetResult],
              ...buildFieldToolDraftRefreshOutput(draftState),
            }
          }
        }
        const result = await formRuntime.setAiFieldOptions?.(input as any)
        const draftState = await options.formCreateRef.value?.refreshAiDraftPersistenceState?.()
        return {
          ...(result && typeof result === 'object' ? result : { result }),
          ...buildFieldToolDraftRefreshOutput(draftState),
        }
      }
    }

    if (OUTLINE_TOOL_NAMES.has(toolName)) {
      throw new Error(`规划工具执行失败: ${toolName}`)
    }

    if (FLOW_TOOL_NAMES.has(toolName)) {
      throw new Error(`流程工具执行失败: ${toolName}`)
    }

    if (BLUEPRINT_TOOL_NAMES.has(toolName)) {
      throw new Error(`蓝图工具执行失败: ${toolName}`)
    }

    throw new Error(`不支持的编辑器工具: ${toolName}`)
  }

  return {
    getHostContext,
    setActiveFormulaTaskContext,
    saveCurrentFormBeforeBlueprintApply,
    resetTaskContextGuard,
    createForm,
    openForm,
    openFormulaResultTarget,
    viewFlowPatchResult,
    getStagedFormPlan,
    getStagedAppPlan,
    getStagedFlowScheme,
    getStagedFlowPlan,
    getStagedFlowBlueprint,
    getStagedAppBlueprint,
    restoreStagedFormPlan,
    restoreStagedAppPlan,
    restoreStagedFlowScheme,
    restoreStagedFlowPlan,
    restoreStagedFlowBlueprint,
    restoreStagedAppBlueprint,
    stageExcelBlueprintDraft,
    applyStagedFlow,
    applyStagedAppBlueprint,
    applyStagedAppBlueprintAndImportExcel,
    clearStagedFormPlan,
    clearStagedAppPlan,
    clearStagedFlowScheme,
    clearStagedFlowPlan,
    clearStagedFlowBlueprint,
    clearStagedAppBlueprint,
    locateDraftIssue,
    locateFlowIssue,
    executeTool,
  }
}
