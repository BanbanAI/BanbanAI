import { filterNocodeEditorDraftIssueOpenQuestions } from '../../../../common/utils/nocodeEditorDraftIssueOpenQuestions'
import {
  getNocodeEditorCompletedDefaultsResultSummary,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  isDefaultContinueReplyMessage,
} from '@common/utils/nocodeEditorPlanningConfirmationReply'
import {
  normalizeNocodeEditorFlowIntentSignal,
  resolveNocodeEditorFlowEntryIntentWithSignal,
  type NocodeEditorFlowIntentSignal,
} from '@common/utils/nocodeEditorFlowIntentSignal'
import {
  isNocodeEditorCompleteNewFormIntent,
} from '@common/utils/nocodeEditorSingleFormPlan'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  buildNocodeEditorPendingFlowIntentFromEntryFlowIntent,
  matchNocodeEditorPendingFlowIntentTarget,
  normalizeNocodeEditorPendingFlowIntent,
  type NocodeEditorPendingFlowIntent,
} from '@common/utils/nocodeEditorPendingFlowIntent'
import {
  normalizeNocodeEditorPostFormFlowSignals,
  type NocodeEditorPostFormFlowSignals,
} from '@common/utils/nocodeEditorPostFormFlowSignals'
import {
  clearNocodeEditorPostFormFlowOpportunity,
  consumeNocodeEditorPostFormFlowOpportunity,
  decideNocodeEditorPostFormFlowOpportunity,
  normalizeNocodeEditorPostFormFlowOpportunity,
  type NocodeEditorPostFormFlowOpportunity,
} from '@common/utils/nocodeEditorPostFormFlowOpportunity'
import {
  decideNocodeEditorPostFormFlowFollowUp,
  normalizeNocodeEditorPostFormFlowFollowUp,
  type NocodeEditorPostFormFlowFollowUp,
} from '@common/utils/nocodeEditorPostFormFlowFollowUp'
import {
  normalizeNocodeEditorPostFormFlowRelease,
  resolveNocodeEditorPostFormFlowRelease,
  type NocodeEditorPostFormFlowRelease,
  type NocodeEditorPostFormFlowReleaseIssue,
} from '@common/utils/nocodeEditorPostFormFlowRelease'
import {
  isNocodeEditorAppCreationIntent,
  resolveNocodeEditorPlanningScope,
  type NocodeEditorPlanningScope,
} from '@common/utils/nocodeEditorPlanningScope'
import {
  isNocodeEditorPostFormFlowEnabledForScope,
  normalizeNocodeEditorPlanningScopeValue,
} from '@common/utils/nocodeEditorPostFormFlowScope'
import { AiMessageRole, type AiProviderMessage } from '../ai.types'
import {
  projectNocodeEditorProviderMessagesForContext,
  projectNocodeEditorTaskSummaryForProvider,
} from './nocode-editor-provider-context-projection.util'
import {
  normalizeNocodeEditorFlowScheme,
  type NocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  buildFlowGroundingConvergenceResultSummary,
} from '@common/utils/nocodeEditorFlowSchemeGrounding'
import {
  normalizeNocodeEditorFlowBlueprint,
  convertNocodeEditorFlowBlueprintToFlowPlan,
} from '@common/utils/nocodeEditorFlowBlueprint'
import {
  normalizeFlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  projectNocodeEditorConfirmationDecisions,
  type NocodeEditorConfirmationDecision,
} from '@common/utils/nocodeEditorConfirmationDecisionProjection'
import {
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  buildStablePlanningQuestionId,
} from '@common/utils/nocodeEditorPlanningQuestionContract'
import type {
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'

type NocodeEditorTaskContextObject = Record<string, unknown>

type NocodeEditorTaskSummaryLike = {
  planningScope?: NocodeEditorPlanningScope
  userGoal?: string
  entryFlowIntent?: NocodeEditorFlowEntryIntentLike | null
  currentBlueprintTitle?: string
  currentFlowTitle?: string
  planningSummary?: string
  planningMode?: string
  planningOpenQuestions?: string[]
  planningConfirmationStatus?: string
  planningConfirmationQuestions?: string[]
  planningConfirmationResultSummary?: string[]
  planningConfirmationContextKey?: string
  planningConfirmationQuestionRecords?: NocodeEditorAiConfirmQuestion[]
  planningConfirmationDecisions?: NocodeEditorConfirmationDecision[]
  flowSummary?: string
  flowOpenQuestions?: string[]
  flowConfirmationStatus?: string
  flowConfirmationQuestions?: string[]
  flowConfirmationResultSummary?: string[]
  flowConfirmationContextKey?: string
  flowConfirmationTargetFormId?: string
  flowConfirmationTargetFormName?: string
  flowConfirmationQuestionRecords?: NocodeEditorAiConfirmQuestion[]
  flowConfirmationDecisions?: NocodeEditorConfirmationDecision[]
  flowBusinessStatus?: string
  flowDependencyStatus?: string
  flowMaterializationStatus?: string
  flowValidationStatus?: string
  flowValidationSummary?: string
  flowBlueprintPreflightActive?: boolean
  flowBlueprintPreflightPhase?: string
  flowBlueprintPreflightSchemeRevision?: number
  flowBlueprintPreflightSummaryRefreshCount?: number
  flowBlueprintPreflightNodeExampleFetchCount?: number
  flowBlueprintPreflightUpdatedAt?: number
  flowSummarySnapshotRef?: {
    planningContextKey?: string
    formId?: string
    evidenceFingerprint?: string
    updatedAt?: number
  } | null
  flowNodeExampleCoverage?: {
    planningContextKey?: string
    coveredNodeTypes?: string[]
    missingNodeTypes?: string[]
    hasConditionOperatorGuide?: boolean
    updatedAt?: number
  } | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
  postFormFlowFollowUp?: NocodeEditorPostFormFlowFollowUp | null
  postFormFlowRelease?: NocodeEditorPostFormFlowRelease | null
  flowIntent?: NocodeEditorFlowIntentSignal | null
  activeFormName?: string
  latestAction?: string
  openQuestions?: string[]
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  flowPatchResult?: {
    sourceVersion?: number
    draftVersion?: number
    createdDraftVersion?: boolean
    activeVersion?: number
    appliedOperations: Array<{
      op: 'add' | 'update' | 'remove' | 'move'
      nodeKey?: string
      tempKey?: string
      nodeName?: string
    }>
  } | null
  blueprintApplyGate?: NocodeEditorTaskContextObject | null
  formulaPlan?: NocodeEditorTaskContextObject | null
  updatedAt?: number
} | null | undefined

type NocodeEditorFlowEntryIntentLike = {
  state: 'explicit_positive' | 'explicit_negative' | 'none'
  sourceUserMessage: string
  evidence: string[]
  targetFormName?: string
}

type NocodeEditorTaskModelToolExchangeCallLike = {
  id?: unknown
  name?: unknown
  input?: unknown
}

type NocodeEditorTaskModelToolExchangeResultLike = {
  callId?: unknown
  name?: unknown
  output?: unknown
  metadata?: NocodeEditorTaskContextObject | null
}

type NocodeEditorTaskMetadataLike = NocodeEditorTaskContextObject & {
  blueprintApplyGate?: NocodeEditorTaskContextObject | null
  hiddenFromTimeline?: unknown
  modelToolExchangeCall?: NocodeEditorTaskModelToolExchangeCallLike | null
  modelToolExchangeResult?: NocodeEditorTaskModelToolExchangeResultLike | null
  planningConvergenceLateQuestions?: unknown
  summaryStage?: unknown
  taskSummary?: NocodeEditorTaskSummaryLike
  toolResultSummary?: unknown
  traceId?: unknown
  userFacingContent?: unknown
}

type NocodeEditorTaskActionResultLike = {
  name?: string
  ok?: boolean
  output?: NocodeEditorTaskContextObject | null
  metadata?: NocodeEditorTaskMetadataLike | null
}

type NocodeEditorTaskHistoryMessageLike = {
  role?: unknown
  content?: unknown
  metadata?: NocodeEditorTaskMetadataLike | null
}

export type NocodeEditorContinuityHint = {
  kind: 'app-context-inherited' | 'summary-replaced'
  text: string
  sourceConversationId?: string
  sourceTaskId?: string
}

const isPlainObject = (value: unknown): value is NocodeEditorTaskContextObject => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const asRecord = (value: unknown): NocodeEditorTaskContextObject => (
  isPlainObject(value) ? value : {}
)

export const isNocodeEditorRealBlueprintArtifactBlock = (value: unknown): value is NocodeEditorTaskContextObject => (
  isPlainObject(value)
  && String(value.type || '').trim() === 'artifact'
  && String(value.kind || '').trim() === 'blueprint'
  && isPlainObject(value.blueprint)
)

const isNocodeEditorRealFlowSchemeArtifactBlock = (value: unknown): value is NocodeEditorTaskContextObject => (
  isPlainObject(value)
  && String(value.type || '').trim() === 'artifact'
  && String(value.kind || '').trim() === 'flow-scheme'
  && isPlainObject(value.scheme)
)

const isNocodeEditorRealFlowArtifactBlock = (value: unknown): value is NocodeEditorTaskContextObject => (
  isPlainObject(value)
  && String(value.type || '').trim() === 'artifact'
  && String(value.kind || '').trim() === 'flow-plan'
  && isPlainObject(value.flowPlan)
)

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()
const isNocodeEditorFreshCreationRequest = (input: {
  userMessage?: unknown
  planningScope: NocodeEditorPlanningScope
}) => (
  (input.planningScope === 'app' && isNocodeEditorAppCreationIntent(input.userMessage))
  || (
    input.planningScope === 'form'
    && isNocodeEditorCompleteNewFormIntent({ userMessage: input.userMessage })
  )
)
const normalizePlanningContextKey = (value: unknown) => (
  typeof value === 'string' ? normalizeText(value) : ''
)
const normalizeFlowPatchVersion = (value: unknown) => {
  const normalized = Math.max(0, Math.round(Number(value || 0)))
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined
}
const normalizeFlowPatchResult = (value: unknown) => {
  if (!isPlainObject(value)) {
    return null
  }
  const appliedOperations = Array.isArray(value.appliedOperations)
    ? value.appliedOperations
      .filter(isPlainObject)
      .map((operation) => {
        const op = normalizeText(operation.op)
        if (op !== 'add' && op !== 'update' && op !== 'remove' && op !== 'move') {
          return null
        }
        return {
          op,
          ...(normalizeText(operation.nodeKey)
            ? { nodeKey: normalizeText(operation.nodeKey) }
            : {}),
          ...(normalizeText(operation.tempKey)
            ? { tempKey: normalizeText(operation.tempKey) }
            : {}),
          ...(normalizeText(operation.nodeName)
            ? { nodeName: normalizeText(operation.nodeName) }
            : {}),
        }
      })
      .filter((operation): operation is NonNullable<typeof operation> => Boolean(operation))
    : []
  const sourceVersion = normalizeFlowPatchVersion(value.sourceVersion)
  const draftVersion = normalizeFlowPatchVersion(value.draftVersion)
  const activeVersion = normalizeFlowPatchVersion(value.activeVersion)
  if (!sourceVersion && !draftVersion && !activeVersion && !appliedOperations.length) {
    return null
  }
  return {
    sourceVersion,
    draftVersion,
    createdDraftVersion: Boolean(value.createdDraftVersion),
    activeVersion,
    appliedOperations,
  }
}
const normalizeQuestionKey = (value: unknown) => normalizeText(value).toLowerCase()
const normalizeTaskSummaryUpdatedAt = (value: unknown) => {
  const normalized = Math.max(0, Math.round(Number(value || 0)))
  return Number.isFinite(normalized) ? normalized : 0
}

const FLOW_GOAL_CARRYOVER_ACTIONS = new Set([
  'editor_stage_single_form_plan',
  'editor_stage_app_plan',
  'editor_stage_app_blueprint',
  'editor_apply_staged_app_blueprint',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
])

const normalizePendingFlowIntent = normalizeNocodeEditorPendingFlowIntent
const normalizePostFormFlowSignals = normalizeNocodeEditorPostFormFlowSignals
const normalizePostFormFlowOpportunity = normalizeNocodeEditorPostFormFlowOpportunity
const normalizePostFormFlowFollowUp = normalizeNocodeEditorPostFormFlowFollowUp
const normalizePostFormFlowRelease = normalizeNocodeEditorPostFormFlowRelease
const postFormFlowOpportunityLifecycleStatuses = ['available', 'consumed', 'cleared'] as const

const normalizePostFormFlowPersistenceMode = (value: unknown) => {
  const normalized = normalizeText(value)
  return normalized === 'saved' || normalized === 'draft_only'
    ? normalized
    : null
}

const resolveActionResultPostFormFlowRelease = (input: {
  result?: NocodeEditorTaskActionResultLike | null
  scenePayload?: NocodeEditorTaskContextObject | null
  latestTaskSummary?: NocodeEditorTaskSummaryLike
  planningScope: NocodeEditorPlanningScope
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
}) => {
  const metadata = asRecord(input.result?.metadata)
  const output = asRecord(input.result?.output)
  const scenePayload = asRecord(input.scenePayload)
  const latestTaskSummary = asRecord(input.latestTaskSummary)
  const sources = [metadata, output, scenePayload, latestTaskSummary]

  for (const source of sources) {
    const release = normalizePostFormFlowRelease(source.postFormFlowRelease)
    if (release) {
      return release
    }
  }

  const persistenceMode = sources
    .map(source => normalizePostFormFlowPersistenceMode(
      source.persistenceMode || asRecord(source.draftPersistenceState).mode,
    ))
    .find(Boolean) || 'draft_only'
  const issues = sources
    .map(source => Array.isArray(source.postFormFlowIssues)
      ? source.postFormFlowIssues as NocodeEditorPostFormFlowReleaseIssue[]
      : null)
    .find((value): value is NocodeEditorPostFormFlowReleaseIssue[] => Boolean(value))
  const formulaSummary = sources
    .map(source => isPlainObject(source.formulaSummary) ? source.formulaSummary : null)
    .find(Boolean)

  return resolveNocodeEditorPostFormFlowRelease({
    planningScope: input.planningScope,
    persistenceMode,
    issues,
    formulaSummary: formulaSummary as Parameters<
      typeof resolveNocodeEditorPostFormFlowRelease
    >[0]['formulaSummary'],
    pendingFlowIntent: input.pendingFlowIntent,
  })
}

const POST_FORM_FLOW_MAINLINE_ACTIONS = new Set([
  'editor_get_flow_summary',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
])

const isNocodeEditorFlowMainlineAction = (input: {
  actionName?: unknown
  actionTab?: unknown
}) => {
  const actionName = normalizeText(input.actionName)
  if (POST_FORM_FLOW_MAINLINE_ACTIONS.has(actionName)) {
    return true
  }
  return actionName === 'editor_open_form'
    && normalizeText(input.actionTab) === 'process-setting'
}

const normalizeEntryFlowIntent = (value: unknown): NocodeEditorFlowEntryIntentLike | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const state = normalizeText(value.state) as NocodeEditorFlowEntryIntentLike['state']
  if (state !== 'explicit_positive' && state !== 'explicit_negative' && state !== 'none') {
    return null
  }
  const sourceUserMessage = normalizeText(value.sourceUserMessage)
  if (!sourceUserMessage) {
    return null
  }
  return {
    state,
    sourceUserMessage,
    evidence: Array.isArray(value.evidence)
      ? value.evidence.map(item => normalizeText(item)).filter(Boolean)
      : [],
    targetFormName: normalizeText(value.targetFormName) || undefined,
  }
}

const resolveFlowIntentSignalFromRecord = (value: unknown): NocodeEditorFlowIntentSignal | null => {
  if (!isPlainObject(value)) {
    return null
  }
  return normalizeNocodeEditorFlowIntentSignal(value.flowIntent)
    || normalizeNocodeEditorFlowIntentSignal(asRecord(value.outline).flowIntent)
    || normalizeNocodeEditorFlowIntentSignal(asRecord(value.appPlan).flowIntent)
    || normalizeNocodeEditorFlowIntentSignal(asRecord(asRecord(value.appPlan).outline).flowIntent)
    || normalizeNocodeEditorFlowIntentSignal(asRecord(value.plan).flowIntent)
    || normalizeNocodeEditorFlowIntentSignal(asRecord(asRecord(value.plan).outline).flowIntent)
}

const resolveMetadataFlowIntentSignal = (
  metadata?: NocodeEditorTaskContextObject | null,
): NocodeEditorFlowIntentSignal | null => {
  const normalizedMetadata = asRecord(metadata)
  const directSignal = resolveFlowIntentSignalFromRecord(normalizedMetadata)
  if (directSignal) {
    return directSignal
  }

  const taskSummarySignal = resolveFlowIntentSignalFromRecord(asRecord(normalizedMetadata.taskSummary))
  if (taskSummarySignal) {
    return taskSummarySignal
  }

  const requestSceneSignal = resolveFlowIntentSignalFromRecord(asRecord(normalizedMetadata.requestScenePayload))
  if (requestSceneSignal) {
    return requestSceneSignal
  }

  const blocks = Array.isArray(normalizedMetadata.blocks)
    ? normalizedMetadata.blocks
    : Array.isArray(normalizedMetadata.artifactBlocks)
      ? normalizedMetadata.artifactBlocks
      : []
  for (const block of blocks) {
    const blockSignal = resolveFlowIntentSignalFromRecord(block)
    if (blockSignal) {
      return blockSignal
    }
  }

  return null
}

const resolveActionResultFlowIntentSignal = (
  action?: NocodeEditorTaskActionResultLike | null,
) => {
  const actionName = normalizeText(action?.name)
  const outline = actionName === 'editor_stage_single_form_plan'
    ? normalizeNocodeEditorPlanningOutline(action?.output?.outline, {
      confirmationStage: 'form-plan',
    })
    : actionName === 'editor_stage_app_plan'
      ? normalizeNocodeEditorPlanningOutline(asRecord(action?.output?.plan).outline, {
        confirmationStage: 'app-plan',
      })
      : null

  return outline?.flowIntent
    || resolveFlowIntentSignalFromRecord(action?.metadata)
    || resolveFlowIntentSignalFromRecord(action?.output)
}

const resolveLatestPlanningFlowIntentSignal = (input: {
  latestTaskSummary?: NocodeEditorTaskContextObject | null
  scenePayload?: NocodeEditorTaskContextObject | null
  latestSuccessfulAction?: NocodeEditorTaskActionResultLike | null
  assistantBlocks?: NocodeEditorTaskContextObject[]
  allowHistoricalCarryover?: boolean
}) => {
  const actionSignal = resolveActionResultFlowIntentSignal(input.latestSuccessfulAction)
  if (actionSignal) {
    return actionSignal
  }

  const blocks = Array.isArray(input.assistantBlocks) ? input.assistantBlocks : []
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const blockSignal = resolveFlowIntentSignalFromRecord(blocks[index])
    if (blockSignal) {
      return blockSignal
    }
  }

  if (input.allowHistoricalCarryover === false) {
    return null
  }

  const sceneSignal = resolveFlowIntentSignalFromRecord(input.scenePayload)
  if (sceneSignal) {
    return sceneSignal
  }
  const summarySignal = resolveFlowIntentSignalFromRecord(input.latestTaskSummary)
  if (summarySignal) {
    return summarySignal
  }

  return null
}

const resolveLatestActionTab = (value: unknown) => {
  const metadata = isPlainObject(value) ? value : {}
  const input = isPlainObject(metadata.input) ? metadata.input : {}
  return normalizeText(input.tab)
}

const resolveSingleAppliedBlueprintTargetIdentity = (forms: NocodeEditorTaskContextObject[]) => {
  const tableIds = Array.from(new Set(
    forms
      .map(form => normalizeText(form.tableId))
      .filter(Boolean),
  ))
  const tableNames = Array.from(new Set(
    forms
      .map(form => normalizeText(form.tableName))
      .filter(Boolean),
  ))

  return {
    targetFormId: tableIds.length === 1 ? tableIds[0] : undefined,
    targetFormName: tableNames.length === 1 ? tableNames[0] : undefined,
  }
}

const resolveLatestActionTargetIdentity = (input: {
  latestAction?: NocodeEditorTaskActionResultLike | null
  scenePayload?: NocodeEditorTaskContextObject | null
}) => {
  const latestAction = input.latestAction || null
  const actionName = normalizeText(latestAction?.name)
  const output = asRecord(latestAction?.output)
  const metadata = asRecord(latestAction?.metadata)
  const actionInput = asRecord(metadata.input)
  const scenePayload = asRecord(input.scenePayload)

  if (actionName === 'editor_open_form') {
    return {
      targetFormId: normalizeText(output.tableId || actionInput.tableId) || undefined,
      targetFormName: normalizeText(output.tableName || actionInput.tableName) || undefined,
    }
  }

  if (actionName === 'editor_apply_staged_flow') {
    return {
      targetFormId: normalizeText(scenePayload.activeFormId || output.tableId || metadata.tableId) || undefined,
      targetFormName: normalizeText(scenePayload.activeFormName || output.tableName || metadata.tableName) || undefined,
    }
  }

  if (actionName === 'editor_patch_flow') {
    return {
      targetFormId: normalizeText(output.formId || metadata.tableId || scenePayload.activeFormId) || undefined,
      targetFormName: normalizeText(output.formName || metadata.tableName || scenePayload.activeFormName) || undefined,
    }
  }

  if (
    actionName === 'editor_get_flow_summary'
    || actionName === 'editor_plan_flow_scheme'
    || actionName === 'editor_stage_flow_blueprint'
  ) {
    return {
      targetFormId: normalizeText(scenePayload.activeFormId || output.tableId || metadata.tableId) || undefined,
      targetFormName: normalizeText(scenePayload.activeFormName || output.tableName || metadata.tableName) || undefined,
    }
  }

  if (actionName === 'editor_apply_staged_app_blueprint') {
    const forms = Array.isArray(output.forms)
      ? output.forms.filter(isPlainObject)
      : []
    const targetIdentity = resolveSingleAppliedBlueprintTargetIdentity(forms)
    return {
      targetFormId: targetIdentity.targetFormId,
      targetFormName: targetIdentity.targetFormName,
    }
  }

  return {
    targetFormId: undefined,
    targetFormName: undefined,
  }
}

const resolveNextPendingFlowIntent = (input: {
  latest?: NocodeEditorPendingFlowIntent | null
  latestAction?: string
  latestActionTab?: string
  latestActionTargetFormId?: string
  latestActionTargetFormName?: string
  appliedFormIntent?: NocodeEditorPendingFlowIntent | null
  now: number
}) => {
  if (input.appliedFormIntent) {
    return input.appliedFormIntent
  }
  const latest = input.latest || null
  if (!latest) {
    return null
  }
  if (
    latest.status === 'pending_after_form_apply'
    && input.latestAction === 'editor_open_form'
    && input.latestActionTab === 'process-setting'
    && matchNocodeEditorPendingFlowIntentTarget({
      pendingFlowIntent: latest,
      targetFormId: input.latestActionTargetFormId,
      targetFormName: input.latestActionTargetFormName,
    })
  ) {
    return {
      ...latest,
      targetFormId: normalizeText(input.latestActionTargetFormId) || latest.targetFormId,
      targetFormName: normalizeText(input.latestActionTargetFormName) || latest.targetFormName,
      status: 'in_progress' as const,
      updatedAt: input.now,
    }
  }
  if (
    (
      input.latestAction === 'editor_apply_staged_flow'
      || input.latestAction === 'editor_patch_flow'
    )
    && matchNocodeEditorPendingFlowIntentTarget({
      pendingFlowIntent: latest,
      targetFormId: input.latestActionTargetFormId,
      targetFormName: input.latestActionTargetFormName,
    })
  ) {
    return {
      ...latest,
      targetFormId: normalizeText(input.latestActionTargetFormId) || latest.targetFormId,
      targetFormName: normalizeText(input.latestActionTargetFormName) || latest.targetFormName,
      status: 'completed' as const,
      completedByTool: input.latestAction as 'editor_apply_staged_flow' | 'editor_patch_flow',
      updatedAt: input.now,
    }
  }
  return latest
}

const matchPostFormTargetIdentity = (input: {
  targetFormId?: unknown
  targetFormName?: unknown
  latestActionTargetFormId?: unknown
  latestActionTargetFormName?: unknown
}) => {
  const targetFormId = normalizeText(input.targetFormId)
  const targetFormName = normalizeText(input.targetFormName)
  const latestActionTargetFormId = normalizeText(input.latestActionTargetFormId)
  const latestActionTargetFormName = normalizeText(input.latestActionTargetFormName)

  if (!targetFormId && !targetFormName) {
    return true
  }
  if (targetFormId && latestActionTargetFormId) {
    return targetFormId === latestActionTargetFormId
  }
  if (targetFormName && latestActionTargetFormName) {
    return targetFormName === latestActionTargetFormName
  }
  return false
}

const buildResetTaskSummaryForFreshNewFormRequest = (input: {
  latestTaskSummary: NocodeEditorTaskContextObject
  userMessage?: unknown
  entryFlowIntent: NocodeEditorFlowEntryIntentLike
  planningScope: Extract<NocodeEditorPlanningScope, 'app' | 'form'>
  updatedAt?: unknown
}) => ({
  ...input.latestTaskSummary,
  userGoal: normalizeText(input.userMessage).slice(0, 120),
  entryFlowIntent: input.entryFlowIntent,
  flowIntent: null,
  planningScope: input.planningScope,
  activeFormId: '',
  activeFormName: '',
  currentBlueprintTitle: '',
  currentFlowTitle: '',
  planningSummary: '',
  planningMode: '',
  planningOpenQuestions: [],
  planningConfirmationStatus: '',
  planningConfirmationQuestions: [],
  planningConfirmationResultSummary: [],
  planningConfirmationContextKey: '',
  planningConfirmationQuestionRecords: [],
  planningConfirmationDecisions: [],
  flowSummary: '',
  flowOpenQuestions: [],
  flowConfirmationStatus: '',
  flowConfirmationQuestions: [],
  flowConfirmationResultSummary: [],
  flowConfirmationContextKey: '',
  flowConfirmationTargetFormId: '',
  flowConfirmationTargetFormName: '',
  flowConfirmationQuestionRecords: [],
  flowConfirmationDecisions: [],
  flowBusinessStatus: '',
  flowDependencyStatus: '',
  flowMaterializationStatus: '',
  flowValidationStatus: '',
  flowValidationSummary: '',
  flowBlueprintPreflightActive: false,
  flowBlueprintPreflightPhase: '',
  flowBlueprintPreflightSchemeRevision: 0,
  flowBlueprintPreflightSummaryRefreshCount: 0,
  flowBlueprintPreflightNodeExampleFetchCount: 0,
  flowBlueprintPreflightUpdatedAt: 0,
  flowSummarySnapshotRef: null,
  flowNodeExampleCoverage: null,
  postFormFlowSignals: null,
  postFormFlowOpportunity: clearNocodeEditorPostFormFlowOpportunity({
    opportunity: normalizePostFormFlowOpportunity(input.latestTaskSummary.postFormFlowOpportunity),
    clearReason: 'fresh_new_form',
    now: input.updatedAt,
  }),
  postFormFlowFollowUp: null,
  postFormFlowRelease: null,
  latestAction: '',
  openQuestions: [],
  pendingFlowIntent: null,
  flowPatchResult: null,
  blueprintApplyGate: null,
  formulaPlan: null,
  updatedAt: Math.max(0, Math.round(Number(input.updatedAt || Date.now()))),
})

export const reconcileNocodeEditorScenePayloadWithTaskSummary = (input: {
  scenePayload?: NocodeEditorTaskContextObject | null
  taskSummary?: NocodeEditorTaskSummaryLike | null
}) => {
  const scenePayload = isPlainObject(input.scenePayload)
    ? { ...input.scenePayload }
    : {}
  const taskSummary = isPlainObject(input.taskSummary)
    ? input.taskSummary
    : null
  if (!taskSummary) {
    return scenePayload
  }

  ;[
    'planningScope',
    'pendingFlowIntent',
    'postFormFlowFollowUp',
    'postFormFlowOpportunity',
    'postFormFlowRelease',
    'postFormFlowSignals',
  ].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(taskSummary, key)) {
      return
    }
    scenePayload[key] = (taskSummary as NocodeEditorTaskContextObject)[key] ?? null
  })

  return scenePayload
}

const resolveActionResultPostFormFlowSignals = (
  result?: NocodeEditorTaskActionResultLike | null,
) => {
  const output = asRecord(result?.output)
  const metadata = asRecord(result?.metadata)
  return normalizePostFormFlowSignals(output.postFormFlowSignals)
    || normalizePostFormFlowSignals(metadata.postFormFlowSignals)
}

const resolveActionResultPlanningScope = (
  result?: NocodeEditorTaskActionResultLike | null,
) => {
  const output = asRecord(result?.output)
  const metadata = asRecord(result?.metadata)
  return normalizeNocodeEditorPlanningScopeValue(
    output.planningScope || metadata.planningScope,
  )
}

const normalizeProviderMessageRole = (value: unknown): AiMessageRole => {
  const role = normalizeText(value).toLowerCase()
  if (
    role === AiMessageRole.SYSTEM
    || role === AiMessageRole.DEVELOPER
    || role === AiMessageRole.USER
    || role === AiMessageRole.ASSISTANT
    || role === AiMessageRole.TOOL
  ) {
    return role
  }
  return AiMessageRole.USER
}

const normalizeLineSummary = (label: string, value: unknown) => {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
  if (!lines.length) {
    return ''
  }
  if (lines.length <= 8) {
    return `${label}：${lines.join(' / ')}`
  }
  const compacted = lines.filter(line => /^(方案标题|蓝图标题|模块数|表单数|字段总数|当前焦点表单|待确认)/.test(line))
  return `${label}：${(compacted.length ? compacted : lines.slice(0, 4)).join(' / ')}`
}

const normalizeOpenQuestions = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => normalizeText(item))
      .filter(Boolean)
      .slice(0, 3)
    : []
)

const buildFlowIssueRoutingSummary = (routingValue: unknown) => {
  const routing = normalizeFlowIssueRoutingResult(routingValue)
  if (!routing) return []
  if (routing.outcome === 'return_to_flow_scheme') {
    return routing.activeIssues
      .map(issue => normalizeText(issue.questionPayload?.title) || normalizeText(issue.userMessage))
      .filter(Boolean)
  }
  if (routing.outcome === 'execution_blocker' || routing.outcome === 'system_error') {
    return routing.activeIssues
      .map(issue => normalizeText(issue.userMessage))
      .filter(Boolean)
      .slice(0, 3)
  }
  return []
}

const normalizeOpenQuestionsWithoutLimit = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => normalizeText(item))
      .filter(Boolean)
    : []
)

const normalizeConfirmationQuestionTitles = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => normalizeText((item as Record<string, unknown>)?.title))
      .filter(Boolean)
      .slice(0, 6)
    : []
)

const buildConfirmationDecisionContextLines = (value: unknown) => (
  Array.isArray(value)
    ? value
      .filter(isPlainObject)
      .map((item) => {
        const questionId = normalizeText(item.questionId)
        const questionTitle = normalizeText(item.questionTitle)
        const selectedOptionValue = normalizeText(item.selectedOptionValue)
        const answerSummary = normalizeText(item.answerSummary)
        const planningContextKey = normalizeText(item.planningContextKey)
        const approvalOwnerSource = normalizeText(item.approvalOwnerSource)
        return [
          questionId ? `问题=${questionId}` : '',
          questionTitle ? `标题=${questionTitle}` : '',
          selectedOptionValue ? `选项=${selectedOptionValue}` : '',
          answerSummary ? `结论=${answerSummary}` : '',
          approvalOwnerSource ? `审批人来源=${approvalOwnerSource}` : '',
          planningContextKey ? `上下文=${planningContextKey}` : '',
        ].filter(Boolean).join('；')
      })
      .filter(Boolean)
      .slice(0, 6)
    : []
)

const hasPendingFlowSchemeConvergence = (
  scheme?: NocodeEditorFlowScheme | null,
) => (
  scheme?.convergence?.businessStatus === 'pending'
  || scheme?.convergence?.dependencyStatus === 'pending'
)

const buildFlowSchemeConvergenceSummary = (
  scheme?: NocodeEditorFlowScheme | null,
) => {
  if (!scheme?.convergence) {
    return []
  }

  const dependencies = Array.isArray(scheme.dependencies) ? scheme.dependencies : []
  const requiredDeferredConfigItems = Array.isArray(scheme.deferredConfigItems)
    ? scheme.deferredConfigItems.filter(item => item.requirementLevel === 'required')
    : []
  const optionalDeferredConfigItems = Array.isArray(scheme.deferredConfigItems)
    ? scheme.deferredConfigItems.filter(item => item.requirementLevel === 'optional')
    : []

  return buildFlowGroundingConvergenceResultSummary({
    dependencies,
    requiredDeferredConfigItems,
    optionalDeferredConfigItems,
    resolved: scheme.convergence.businessStatus === 'resolved' && scheme.convergence.dependencyStatus === 'resolved',
  })
}

const isStructuredPlanningConfirmationReply = (value: unknown) => (
  String(value || '').trim().startsWith('我补充确认这几项')
)

const isPlanningOrFlowConfirmationReply = (value: unknown) => (
  isStructuredPlanningConfirmationReply(value)
  || isDefaultContinueReplyMessage(String(value || '').trim())
)

const parseStructuredPlanningConfirmationReply = (value: unknown) => {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n')
  const answers: Array<{ title: string; answerSummary: string }> = []
  let current: { title: string; answerSummary: string } | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const questionMatch = line.match(/^\d+\.\s*(.+)$/)
    if (questionMatch) {
      current = { title: normalizeText(questionMatch[1]), answerSummary: '' }
      answers.push(current)
      continue
    }

    const optionMatch = line.match(/^选择[：:]\s*(.+)$/)
    if (optionMatch && current) {
      current.answerSummary = normalizeText(optionMatch[1])
      // continue
    }

    // const noteMatch = line.match(/^补充说明[：:]\s*(.+)$/)
    // if (noteMatch && current && !current.answerSummary) {
    //   current.answerSummary = normalizeText(noteMatch[1])
    // }
  }

  return answers.filter(item => item.title)
}

const findLatestPlanningConvergenceLateQuestions = (results: NocodeEditorTaskActionResultLike[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const questions = normalizeOpenQuestions(results[index]?.metadata?.planningConvergenceLateQuestions)
    if (questions.length) {
      return questions
    }
  }
  return []
}

const findLatestSingleFormPlanOutline = (results: NocodeEditorTaskActionResultLike[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_stage_single_form_plan') {
      continue
    }
    const outline = normalizeNocodeEditorPlanningOutline(result.output?.outline, {
      confirmationStage: 'form-plan',
    })
    if (outline) {
      return outline as NocodeEditorTaskContextObject
    }
  }
  return null
}

const findLatestAppPlan = (results: NocodeEditorTaskActionResultLike[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_stage_app_plan') {
      continue
    }
    if (isPlainObject(result.output?.plan)) {
      return result.output!.plan as NocodeEditorTaskContextObject
    }
  }
  return null
}

const findLatestFormulaPlanStage = (results: NocodeEditorTaskActionResultLike[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (
      result?.ok
      && normalizeText(result?.name) === 'editor_stage_formula_plan'
      && isPlainObject(result.output?.plan)
    ) {
      return result
    }
  }
  return null
}

const findLatestFormulaPlanStageIndex = (
  results: NocodeEditorTaskActionResultLike[],
) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (
      result?.ok
      && normalizeText(result?.name) === 'editor_stage_formula_plan'
      && isPlainObject(result.output?.plan)
    ) {
      return index
    }
  }
  return -1
}

const compactFormulaPlanForTaskSummary = (value: unknown) => {
  const plan = asRecord(value)
  const items = Array.isArray(plan.items)
    ? plan.items.filter(isPlainObject).map(item => ({
      itemKey: normalizeText(item.itemKey),
      target: {
        ...(normalizeText(asRecord(item.target).formKey) ? { formKey: normalizeText(asRecord(item.target).formKey) } : {}),
        ...(normalizeText(asRecord(item.target).formName) ? { formName: normalizeText(asRecord(item.target).formName) } : {}),
        ...(normalizeText(asRecord(item.target).fieldKey) ? { fieldKey: normalizeText(asRecord(item.target).fieldKey) } : {}),
        fieldName: normalizeText(asRecord(item.target).fieldName),
      },
      formulaSettings: Array.isArray(item.formulaSettings)
        ? item.formulaSettings.filter(isPlainObject).map(setting => ({
          formulaPath: normalizeText(setting.formulaPath),
          formula: normalizeText(setting.formula),
          ...(normalizeText(setting.explanation) ? { explanation: normalizeText(setting.explanation) } : {}),
        }))
        : [],
    })).filter(item => item.itemKey && item.target.fieldName && item.formulaSettings.length)
    : []
  const confirmation = isPlainObject(plan.confirmation)
    ? plan.confirmation
    : null

  return {
    title: normalizeText(plan.title),
    summary: normalizeText(plan.summary),
    executionIntent: normalizeText(plan.executionIntent),
    items,
    openQuestions: normalizeOpenQuestions(plan.openQuestions),
    confirmation,
  }
}

const compactFormulaStageContextForTaskSummary = (value: unknown) => {
  const context = asRecord(value)
  return {
    ...(normalizeText(context.taskId) ? { taskId: normalizeText(context.taskId) } : {}),
    taskScopeKey: normalizeText(context.taskScopeKey),
    nocodeId: normalizeText(context.nocodeId),
    formId: normalizeText(context.formId),
    ...(Number.isFinite(Number(context.draftRevision)) ? { draftRevision: Number(context.draftRevision) } : {}),
    evidenceFingerprint: normalizeText(context.evidenceFingerprint),
    capturedAt: Math.max(0, Number(context.capturedAt || 0)),
  }
}

const findLatestFormulaCheckpointSummary = (results: NocodeEditorTaskActionResultLike[]) => {
  const result = [...results].reverse().find(item => (
    item?.ok
    && normalizeText(item?.name) === 'editor_set_field_formulas'
    && Array.isArray(item.output?.formulaTargetResults)
  ))
  if (!result) {
    return null
  }

  const rawTargets = result.output!.formulaTargetResults
  if (!rawTargets.length) {
    return {
      status: 'not_applicable',
      targets: [],
    }
  }

  const targets: Array<{ status: string; fieldName: string; reason?: string }> = []
  for (const item of rawTargets) {
    if (!isPlainObject(item)) {
      return null
    }
    const status = normalizeText(item.status)
    const fieldName = normalizeText(item.fieldName)
    if (!['updated', 'draft', 'skipped', 'failed'].includes(status) || !fieldName) {
      return null
    }
    targets.push({
      status,
      fieldName,
      ...(normalizeText(item.reason) ? { reason: normalizeText(item.reason) } : {}),
    })
  }

  const hasSucceeded = targets.some(item => (
    item.status === 'updated' || item.status === 'draft'
  ))
  const hasFailed = targets.some(item => item.status === 'failed')
  return {
    status: hasFailed ? (hasSucceeded ? 'partial' : 'failed') : 'completed',
    targets,
    ...(normalizeText(result.output?.persistenceMode) === 'draft_only'
      ? { persistenceMode: 'draft_only' }
      : {}),
  }
}

const findLatestFlowScheme = (results: NocodeEditorTaskActionResultLike[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_plan_flow_scheme') {
      continue
    }
    if (isPlainObject(result.output?.scheme)) {
      return result.output!.scheme as NocodeEditorTaskContextObject
    }
  }
  return null
}

const getTraceId = (message: NocodeEditorTaskHistoryMessageLike) => normalizeText(
  message?.metadata?.traceId,
)

const isToolExchangeMessage = (message: NocodeEditorTaskHistoryMessageLike) => Boolean(
  message?.metadata?.modelToolExchangeCall
  || message?.metadata?.modelToolExchangeResult,
)

const isSummaryAnchorAssistantMessage = (message: NocodeEditorTaskHistoryMessageLike) => Boolean(
  String(message?.role || '').trim() === 'assistant'
  && (
    Boolean(message?.metadata?.toolResultSummary)
    || isPlainObject(message?.metadata?.blueprintApplyGate)
    || isPlainObject(message?.metadata?.taskSummary)
  ),
)

const APP_PLAN_TOOL_NAME = 'editor_stage_app_plan'
const COMPACTABLE_STAGE_TOOL_NAMES = new Set([
  APP_PLAN_TOOL_NAME,
  'editor_stage_single_form_plan',
  'editor_stage_content_plan',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
  'editor_stage_app_blueprint',
])

const isAppPlanTaskSummary = (value: unknown) => (
  isPlainObject(value)
  && (
    normalizeText(value.latestAction) === APP_PLAN_TOOL_NAME
    || normalizeText(value.planningMode) === 'greenfield'
    || Boolean(normalizeText(value.planningSummary) && normalizeOpenQuestions(value.planningOpenQuestions).length)
  )
)

const isAppPlanSummaryAnchorMessage = (message: NocodeEditorTaskHistoryMessageLike) => (
  String(message?.role || '').trim() === 'assistant'
  && (
    normalizeText(message?.metadata?.summaryStage) === 'app-plan'
    || isAppPlanTaskSummary(message?.metadata?.taskSummary)
  )
)

const parseToolNameFromRawToolContent = (message: NocodeEditorTaskHistoryMessageLike) => {
  if (String(message?.role || '').trim() !== 'tool') {
    return ''
  }
  const content = String(message?.content || '').trim()
  if (!content.startsWith('{')) {
    return ''
  }
  try {
    const parsed = JSON.parse(content)
    return normalizeText(parsed?.name)
  } catch {
    return ''
  }
}

const isCompactableStageToolExchangeMessage = (message: NocodeEditorTaskHistoryMessageLike) => {
  const metadata = asRecord(message?.metadata)
  const toolName = normalizeText(asRecord(metadata.modelToolExchangeCall).name)
    || normalizeText(asRecord(metadata.modelToolExchangeResult).name)
    || parseToolNameFromRawToolContent(message)
  return COMPACTABLE_STAGE_TOOL_NAMES.has(toolName)
}

const isFlowStageToolExchangeMessage = (message: NocodeEditorTaskHistoryMessageLike) => {
  const metadata = asRecord(message?.metadata)
  const toolName = normalizeText(asRecord(metadata.modelToolExchangeCall).name)
    || normalizeText(asRecord(metadata.modelToolExchangeResult).name)
    || parseToolNameFromRawToolContent(message)
  return toolName === 'editor_plan_flow_scheme' || toolName === 'editor_stage_flow_blueprint' || toolName === 'editor_apply_staged_flow'
}

const hasStageSummaryContext = (
  messages: NocodeEditorTaskHistoryMessageLike[],
  latestTaskSummary?: NocodeEditorTaskSummaryLike,
) => Boolean(
  isPlainObject(latestTaskSummary)
  || messages.some(message => (
    isSummaryAnchorAssistantMessage(message)
    || normalizeText(message?.metadata?.summaryStage)
  )),
)

const compactStageHistoryMessagesForProvider = (
  messages: NocodeEditorTaskHistoryMessageLike[],
  latestTaskSummaryMessage?: NocodeEditorTaskHistoryMessageLike,
  latestTaskSummary?: NocodeEditorTaskSummaryLike,
) => {
  const taskSummary = latestTaskSummaryMessage?.metadata?.taskSummary || latestTaskSummary
  if (!hasStageSummaryContext(messages, taskSummary)) {
    return messages
  }

  const latestAction = normalizeText(taskSummary?.latestAction)
  const shouldRetainLatestFlowStageExchange = (
    latestAction === 'editor_plan_flow_scheme'
    || latestAction === 'editor_stage_flow_blueprint'
    || latestAction === 'editor_apply_staged_flow'
  )
  let latestRetainedFlowExchangeCallId = ''
  if (shouldRetainLatestFlowStageExchange) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (!isFlowStageToolExchangeMessage(message)) {
        continue
      }
      const metadata = asRecord(message?.metadata)
      latestRetainedFlowExchangeCallId = normalizeText(asRecord(metadata.modelToolExchangeCall).id)
        || normalizeText(asRecord(metadata.modelToolExchangeResult).callId)
      if (latestRetainedFlowExchangeCallId) {
        break
      }
    }
  }

  return messages.filter(message => (
    (
      !isCompactableStageToolExchangeMessage(message)
      || (
        latestRetainedFlowExchangeCallId
        && isFlowStageToolExchangeMessage(message)
        && (() => {
          const metadata = asRecord(message?.metadata)
          const callId = normalizeText(asRecord(metadata.modelToolExchangeCall).id)
            || normalizeText(asRecord(metadata.modelToolExchangeResult).callId)
          return callId === latestRetainedFlowExchangeCallId
        })()
      )
    )
    && !isAppPlanSummaryAnchorMessage(message)
  ))
}

const findLatestSummaryClusterStartIndex = (messages: NocodeEditorTaskHistoryMessageLike[]) => {
  const latestTaskSummaryIndex = messages
    .map((message, index) => ({ index, message }))
    .reverse()
    .find(item => isPlainObject(item.message?.metadata?.taskSummary))
    ?.index ?? -1

  const latestSummaryAnchorIndex = messages
    .map((message, index) => ({ index, message }))
    .reverse()
    .find(item => isSummaryAnchorAssistantMessage(item.message))
    ?.index ?? -1

  if (latestSummaryAnchorIndex < 0) {
    return latestTaskSummaryIndex
  }

  const latestSummaryAnchorTraceId = getTraceId(messages[latestSummaryAnchorIndex])
  const latestSummaryTraceStartIndex = latestSummaryAnchorTraceId
    ? messages.findIndex(message => getTraceId(message) === latestSummaryAnchorTraceId)
    : latestSummaryAnchorIndex

  if (latestTaskSummaryIndex < 0) {
    return latestSummaryTraceStartIndex
  }

  return Math.min(latestTaskSummaryIndex, latestSummaryTraceStartIndex)
}

const resolveTaskSummaryUpdatedAt = (value: unknown) => normalizeTaskSummaryUpdatedAt(
  asRecord(value).updatedAt,
)

const pickLatestTaskSummary = (input: {
  messages: NocodeEditorTaskHistoryMessageLike[]
  latestTaskSummary?: NocodeEditorTaskSummaryLike
}) => {
  const messageTaskSummaries = input.messages
    .map(message => ({
      message,
      taskSummary: isPlainObject(message.metadata?.taskSummary)
        ? message.metadata?.taskSummary as NocodeEditorTaskContextObject
        : null,
    }))
    .filter((item): item is { message: NocodeEditorTaskHistoryMessageLike; taskSummary: NocodeEditorTaskContextObject } => Boolean(item.taskSummary))

  const latestMessageEntry = [...messageTaskSummaries]
    .sort((left, right) => (
      resolveTaskSummaryUpdatedAt(right.taskSummary) - resolveTaskSummaryUpdatedAt(left.taskSummary)
    ))[0] || null

  const inputTaskSummary = isPlainObject(input.latestTaskSummary)
    ? input.latestTaskSummary as NocodeEditorTaskContextObject
    : null

  if (!latestMessageEntry) {
    return {
      latestTaskSummaryMessage: null,
      latestTaskSummary: inputTaskSummary,
    }
  }

  if (!inputTaskSummary) {
    return {
      latestTaskSummaryMessage: latestMessageEntry.message,
      latestTaskSummary: latestMessageEntry.taskSummary,
    }
  }

  const inputUpdatedAt = resolveTaskSummaryUpdatedAt(inputTaskSummary)
  const messageUpdatedAt = resolveTaskSummaryUpdatedAt(latestMessageEntry.taskSummary)
  if (inputUpdatedAt > messageUpdatedAt) {
    return {
      latestTaskSummaryMessage: null,
      latestTaskSummary: inputTaskSummary,
    }
  }

  return {
    latestTaskSummaryMessage: latestMessageEntry.message,
    latestTaskSummary: latestMessageEntry.taskSummary,
  }
}

const getLatestBlueprintApplyGate = (
  messages: NocodeEditorTaskHistoryMessageLike[],
  latestTaskSummary?: NocodeEditorTaskSummaryLike,
) => {
  if (isPlainObject(latestTaskSummary) && 'blueprintApplyGate' in latestTaskSummary) {
    const summaryGate = asRecord(latestTaskSummary).blueprintApplyGate
    if (isPlainObject(summaryGate)) {
      return summaryGate
    }
    if (summaryGate === null) {
      return null
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = asRecord(messages[index]?.metadata)
    const modelToolExchangeResult = asRecord(metadata.modelToolExchangeResult)
    const candidate = metadata.blueprintApplyGate
      || asRecord(modelToolExchangeResult.metadata).blueprintApplyGate
    if (isPlainObject(candidate)) {
      return candidate
    }
  }
  return null
}

export const buildNocodeEditorContinuityHints = (input: {
  currentConversationId?: string
  latestAppConversation?: {
    id: string
    taskId?: string | null
    taskSummary?: Record<string, unknown> | null
  } | null
  summaryReplacesAssistantContent?: boolean
  summaryReplacementNoticeVisible?: boolean
}) => {
  const hints: NocodeEditorContinuityHint[] = []
  const currentConversationId = normalizeText(input.currentConversationId)
  const latestConversationId = normalizeText(input.latestAppConversation?.id)
  const latestTaskId = normalizeText(input.latestAppConversation?.taskId)

  if (
    latestConversationId
    && latestConversationId !== currentConversationId
    && isPlainObject(input.latestAppConversation?.taskSummary)
  ) {
    hints.push({
      kind: 'app-context-inherited',
      text: global.i18next.t('nocodeEditorTaskContext.appContextInherited'),
      sourceConversationId: latestConversationId,
      sourceTaskId: latestTaskId || undefined,
    })
  }

  if (input.summaryReplacesAssistantContent && input.summaryReplacementNoticeVisible) {
    hints.push({
      kind: 'summary-replaced',
      text: global.i18next.t('nocodeEditorTaskContext.summaryReplaced'),
    })
  }

  return hints
}

export const buildNocodeEditorAppContextSnapshot = (input: {
  latestTaskSummary?: NocodeEditorTaskSummaryLike
  stagedPlanningSummary?: string
  stagedFlowSummary?: string
  stagedBlueprintSummary?: string
}) => {
  const latestTaskSummary = input.latestTaskSummary || null
  const lines = [
    latestTaskSummary?.userGoal
      ? `最近任务背景目标（仅供参考，不预设下一步）：${normalizeText(latestTaskSummary.userGoal)}`
      : '',
    latestTaskSummary?.currentBlueprintTitle
      ? `最近相关蓝图：${normalizeText(latestTaskSummary.currentBlueprintTitle)}`
      : '',
    latestTaskSummary?.currentFlowTitle
      ? `最近相关流程：${normalizeText(latestTaskSummary.currentFlowTitle)}`
      : '',
    latestTaskSummary?.planningSummary
      ? `最近规划摘要：${normalizeText(latestTaskSummary.planningSummary)}`
      : '',
    normalizeOpenQuestions(latestTaskSummary?.planningOpenQuestions).length
      ? `最近规划待确认：${normalizeOpenQuestions(latestTaskSummary?.planningOpenQuestions).join('；')}`
      : '',
    latestTaskSummary?.planningConfirmationStatus === 'completed'
      ? '最近规划确认状态：已完成'
      : '',
    Array.isArray(latestTaskSummary?.planningConfirmationQuestions) && latestTaskSummary.planningConfirmationQuestions.length
      ? `最近规划确认记录：${latestTaskSummary.planningConfirmationQuestions.join('；')}`
      : '',
    Array.isArray(latestTaskSummary?.planningConfirmationResultSummary) && latestTaskSummary.planningConfirmationResultSummary.length
      ? `最近规划确认结论：${latestTaskSummary.planningConfirmationResultSummary.join('；')}`
      : '',
    buildConfirmationDecisionContextLines(latestTaskSummary?.planningConfirmationDecisions).length
      ? `最近规划结构化确认结论：${buildConfirmationDecisionContextLines(latestTaskSummary?.planningConfirmationDecisions).join(' / ')}`
      : '',
    latestTaskSummary?.flowSummary
      ? `最近流程摘要：${normalizeText(latestTaskSummary.flowSummary)}`
      : '',
    latestTaskSummary?.flowValidationSummary
      ? `最近流程生成前校验：${normalizeText(latestTaskSummary.flowValidationSummary)}`
      : latestTaskSummary?.flowValidationStatus
        ? `最近流程生成前校验：${normalizeText(latestTaskSummary.flowValidationStatus)}`
        : '',
    normalizePostFormFlowSignals(latestTaskSummary?.postFormFlowSignals)?.summary
      ? `最近表单结构证据：${normalizeText(normalizePostFormFlowSignals(latestTaskSummary?.postFormFlowSignals)?.summary)}`
      : '',
    normalizePostFormFlowOpportunity(latestTaskSummary?.postFormFlowOpportunity)?.status === postFormFlowOpportunityLifecycleStatuses[0]
      ? `最近表单结构机会：${normalizeText(normalizePostFormFlowOpportunity(latestTaskSummary?.postFormFlowOpportunity)?.reasonSummary)}`
      : '',
    normalizePendingFlowIntent(latestTaskSummary?.pendingFlowIntent)?.status
      ? `显式流程续接状态：${normalizePendingFlowIntent(latestTaskSummary?.pendingFlowIntent)?.status}`
      : '',
    normalizePendingFlowIntent(latestTaskSummary?.pendingFlowIntent)?.targetFormName
      ? `显式流程目标表单：${normalizePendingFlowIntent(latestTaskSummary?.pendingFlowIntent)?.targetFormName}`
      : normalizePendingFlowIntent(latestTaskSummary?.pendingFlowIntent)?.targetFormId
        ? `显式流程目标表单 ID：${normalizePendingFlowIntent(latestTaskSummary?.pendingFlowIntent)?.targetFormId}`
        : '',
    normalizeOpenQuestions(latestTaskSummary?.flowOpenQuestions).length
      ? `最近流程待确认：${normalizeOpenQuestions(latestTaskSummary?.flowOpenQuestions).join('；')}`
      : '',
    latestTaskSummary?.flowConfirmationStatus === 'completed'
      ? '最近流程方案确认状态：已完成'
      : '',
    Array.isArray(latestTaskSummary?.flowConfirmationQuestions) && latestTaskSummary.flowConfirmationQuestions.length
      ? `最近流程确认记录：${latestTaskSummary.flowConfirmationQuestions.join('；')}`
      : '',
    Array.isArray(latestTaskSummary?.flowConfirmationResultSummary) && latestTaskSummary.flowConfirmationResultSummary.length
      ? `最近流程确认结论：${latestTaskSummary.flowConfirmationResultSummary.join('；')}`
      : '',
    buildConfirmationDecisionContextLines(latestTaskSummary?.flowConfirmationDecisions).length
      ? `最近流程结构化确认结论：${buildConfirmationDecisionContextLines(latestTaskSummary?.flowConfirmationDecisions).join(' / ')}`
      : '',
    latestTaskSummary?.activeFormName
      ? `最近焦点表单：${normalizeText(latestTaskSummary.activeFormName)}`
      : '',
    latestTaskSummary?.latestAction
      ? `最近动作：${normalizeText(latestTaskSummary.latestAction)}`
      : '',
    normalizeOpenQuestions(latestTaskSummary?.openQuestions).length
      ? `待确认：${normalizeOpenQuestions(latestTaskSummary?.openQuestions).join('；')}`
      : '',
    latestTaskSummary?.blueprintApplyGate?.mode
      ? `最近蓝图确认状态：${normalizeText(latestTaskSummary.blueprintApplyGate.mode)} / ${normalizeText(latestTaskSummary.blueprintApplyGate.status || 'pending')}`
      : '',
    normalizeLineSummary('暂存规划摘要', input.stagedPlanningSummary),
    normalizeLineSummary('暂存流程摘要', input.stagedFlowSummary),
    normalizeLineSummary('暂存蓝图摘要', input.stagedBlueprintSummary),
  ].filter(Boolean)

  return lines.join('\n')
}

export const buildNocodeEditorTaskSummary = (input: {
  latestTaskSummary?: NocodeEditorTaskSummaryLike
  userMessage?: string
  finishReason?: string
  scenePayload?: NocodeEditorTaskContextObject | null
  actionResults?: NocodeEditorTaskActionResultLike[]
  assistantBlocks?: NocodeEditorTaskContextObject[]
  planningSummary?: string
  planningMode?: string
  planningOpenQuestions?: string[]
  updatedAt: number
}) => {
  const importedHandoffContext = asRecord(input.scenePayload?.importedHandoffContext)
  const taskBoundaryUserMessage = normalizeText(importedHandoffContext.originalGoal)
    || normalizeText(input.userMessage)
  const requestPlanningScope = resolveNocodeEditorPlanningScope(taskBoundaryUserMessage).scope
  const normalizedUserMessage = taskBoundaryUserMessage.slice(0, 120)
  const isFreshNewFormRequest = isNocodeEditorFreshCreationRequest({
    userMessage: taskBoundaryUserMessage,
    planningScope: requestPlanningScope,
  })
  const latestSuccessfulAction = [...(input.actionResults || [])]
    .reverse()
    .find(item => item?.ok)
  const latestFlowBlueprintPreflight = isPlainObject(latestSuccessfulAction?.metadata?.flowBlueprintPreflight)
    ? latestSuccessfulAction.metadata.flowBlueprintPreflight as NocodeEditorTaskContextObject
    : null
  const hasSuccessfulFlowBlueprintResult = (input.actionResults || []).some(item => (
    item?.ok
    && [
      'editor_stage_flow_blueprint',
      'editor_apply_staged_flow',
    ].includes(normalizeText(item?.name))
  ))
  const latestFlowScheme = findLatestFlowScheme(input.actionResults || [])
  const latestFlowSchemeBlock = findLatestRealFlowSchemeArtifactBlock({
    actionResults: input.actionResults || [],
    assistantBlocks: input.assistantBlocks || [],
  })
  const latestFlowBlock = findLatestRealFlowArtifactBlock({
    actionResults: input.actionResults || [],
    assistantBlocks: input.assistantBlocks || [],
  })
  const latestBlueprintBlock = findLatestRealBlueprintArtifactBlock({
    actionResults: input.actionResults || [],
    assistantBlocks: input.assistantBlocks || [],
  })
  const latestBlueprintApplyGate = [...(input.actionResults || [])]
    .reverse()
    .map(item => item?.metadata?.blueprintApplyGate)
    .find(gate => isPlainObject(gate))
  const blueprint = isPlainObject(latestBlueprintBlock?.blueprint)
    ? latestBlueprintBlock.blueprint
    : null
  const actionResults = input.actionResults || []
  const latestAppPlan = findLatestAppPlan(actionResults)
  const latestFormulaPlanStage = findLatestFormulaPlanStage(actionResults)
  const latestFormulaPlanStageIndex = findLatestFormulaPlanStageIndex(actionResults)
  const latestAppPlanOutline = isPlainObject(latestAppPlan?.outline)
    ? latestAppPlan.outline
    : null
  const latestAppPlanConfirmation = isPlainObject(latestAppPlanOutline?.confirmation)
    ? latestAppPlanOutline.confirmation as NocodeEditorTaskContextObject
    : null
  const latestSingleFormPlanOutline = findLatestSingleFormPlanOutline(input.actionResults || [])
  const planningConvergenceLateQuestions = findLatestPlanningConvergenceLateQuestions(input.actionResults || [])
  const normalizedFlowScheme = normalizeNocodeEditorFlowScheme(
    latestFlowScheme || latestFlowSchemeBlock?.scheme,
    {
      preserveTrustedDecisionKeySource: Boolean(latestFlowScheme),
    },
  )
  const explicitPlanningSummary = normalizeText(input.planningSummary)
  const fallbackPlanningSummary = normalizeText(latestAppPlan?.goal) || normalizeText(latestSingleFormPlanOutline?.summary)
  const explicitPlanningMode = normalizeText(input.planningMode).slice(0, 40)
  const fallbackPlanningMode = latestAppPlan
    ? normalizeText(latestAppPlan.mode).slice(0, 40) || 'app-plan'
    : latestSingleFormPlanOutline ? 'single-form' : ''
  const planningOpenQuestions = normalizeOpenQuestions(input.planningOpenQuestions)
  const fallbackPlanningOpenQuestions = normalizeOpenQuestions(latestAppPlan?.openQuestions).length
    ? normalizeOpenQuestions(latestAppPlan?.openQuestions)
    : normalizeOpenQuestions(latestSingleFormPlanOutline?.openQuestions)
  const resolvedPlanningOpenQuestions = planningOpenQuestions.length
    ? planningOpenQuestions
    : planningConvergenceLateQuestions.length
      ? planningConvergenceLateQuestions
      : fallbackPlanningOpenQuestions
  const planningConfirmationStatus = normalizeText(latestAppPlanConfirmation?.status)
  const planningConfirmationQuestions = normalizeConfirmationQuestionTitles(
    latestAppPlanConfirmation?.questions,
  )
  const planningConfirmationProjection = projectNocodeEditorConfirmationDecisions({
    stage: 'app-plan',
    confirmation: latestAppPlanConfirmation,
  })
  const planningConfirmationResultSummary = normalizeOpenQuestions(
    latestAppPlanConfirmation?.resultSummary,
  )
  const latestFlowSchemeBlockConfirmation = isPlainObject(latestFlowSchemeBlock?.confirmation)
    ? latestFlowSchemeBlock.confirmation as NocodeEditorTaskContextObject
    : null
  const trustedFlowConfirmation = latestFlowScheme
    ? normalizedFlowScheme?.confirmation || null
    : null
  const flowConfirmation = trustedFlowConfirmation
    || latestFlowSchemeBlockConfirmation
    || normalizedFlowScheme?.confirmation
    || null
  const expectedFlowPlanningContextKey = [
    input.scenePayload?.planningContextKey,
    input.scenePayload?.flowPlanningContextKey,
    latestSuccessfulAction?.output?.planningContextKey,
    latestSuccessfulAction?.metadata?.planningContextKey,
    asRecord(latestFlowBlock?.confirmation).planningContextKey,
    latestFlowBlueprintPreflight?.planningContextKey,
  ].map(normalizePlanningContextKey).find(Boolean) || ''
  const rawFlowOpenQuestions = normalizeOpenQuestions(
    normalizedFlowScheme?.openQuestions?.map(item => item.title),
  )
  const routedFlowQuestions = buildFlowIssueRoutingSummary(latestFlowBlock?.flowIssueRouting)
  const resolvedFlowOpenQuestions = rawFlowOpenQuestions.length
    ? rawFlowOpenQuestions
    : routedFlowQuestions
  const rawFlowConfirmationStatus = normalizeText(flowConfirmation?.status)
  const rawFlowConfirmationQuestions = normalizeConfirmationQuestionTitles(
    flowConfirmation?.questions,
  )
  const flowConfirmationProjection = projectNocodeEditorConfirmationDecisions({
    stage: 'flow-scheme',
    confirmation: flowConfirmation,
    expectedPlanningContextKey: expectedFlowPlanningContextKey || undefined,
    fallbackPlanningContextKey: expectedFlowPlanningContextKey || undefined,
    preserveTrustedDecisionKeySource: Boolean(
      trustedFlowConfirmation
      && flowConfirmation === trustedFlowConfirmation
    ),
  })
  const hasMismatchedFlowConfirmationContext = Boolean(
    expectedFlowPlanningContextKey
    && (
      !flowConfirmationProjection.planningContextKey
      || !isSamePlanningConfirmationContext(
        flowConfirmationProjection.planningContextKey,
        expectedFlowPlanningContextKey,
      )
    )
  )
  const hasUnscopedFlowConfirmation = Boolean(
    flowConfirmation
    && !expectedFlowPlanningContextKey
    && !flowConfirmationProjection.planningContextKey
  )
  const shouldExcludeFlowConfirmation = (
    hasMismatchedFlowConfirmationContext
    || hasUnscopedFlowConfirmation
  )
  const flowConfirmationStatus = shouldExcludeFlowConfirmation
    ? ''
    : rawFlowConfirmationStatus
  const flowConfirmationQuestions = shouldExcludeFlowConfirmation
    ? []
    : rawFlowConfirmationQuestions
  const flowHasPendingConvergence = hasPendingFlowSchemeConvergence(normalizedFlowScheme)
  const explicitFlowConfirmationResultSummary = shouldExcludeFlowConfirmation
    ? []
    : normalizeOpenQuestions(flowConfirmation?.resultSummary)
  const flowConfirmationResultSummary = shouldExcludeFlowConfirmation
    ? []
    : explicitFlowConfirmationResultSummary.length
      ? explicitFlowConfirmationResultSummary
      : normalizeOpenQuestions(
        flowHasPendingConvergence || normalizedFlowScheme?.convergence
          ? buildFlowSchemeConvergenceSummary(normalizedFlowScheme)
          : [],
      )
  const flowBusinessStatus = normalizeText(normalizedFlowScheme?.convergence?.businessStatus)
  const flowDependencyStatus = normalizeText(normalizedFlowScheme?.convergence?.dependencyStatus)
  const flowMaterializationStatus = normalizeText(normalizedFlowScheme?.convergence?.materializationStatus)
  const flowValidation = asRecord(asRecord(latestFlowBlock?.flowPlan).validation)
  const flowValidationStatus = normalizeText(flowValidation.status)
  const flowValidationSummary = normalizeText(flowValidation.summary)
  const rawBlueprintOpenQuestions = normalizeOpenQuestions(blueprint?.openQuestions)
  const blueprintOpenQuestions = latestBlueprintBlock?.applyResult
    ? filterNocodeEditorDraftIssueOpenQuestions(rawBlueprintOpenQuestions)
    : rawBlueprintOpenQuestions
  const formulaStageOpenQuestions = normalizeOpenQuestions(
    asRecord(asRecord(latestFormulaPlanStage?.output).plan).openQuestions,
  )
  const resolvedOpenQuestions = rawFlowOpenQuestions.length
    ? rawFlowOpenQuestions
    : (
      routedFlowQuestions.length
        ? routedFlowQuestions
        : (
          planningConvergenceLateQuestions.length
            ? planningConvergenceLateQuestions
            : (
              formulaStageOpenQuestions.length
                ? formulaStageOpenQuestions
                : blueprintOpenQuestions.length
                  ? blueprintOpenQuestions
                  : resolvedPlanningOpenQuestions
            )
        )
    )
  const latestTaskSummary = isPlainObject(input.latestTaskSummary)
    ? input.latestTaskSummary as NocodeEditorTaskContextObject
    : null
  const formulaStageOutput = asRecord(latestFormulaPlanStage?.output)
  const formulaStagePlan = isPlainObject(formulaStageOutput.plan)
    ? compactFormulaPlanForTaskSummary(formulaStageOutput.plan)
    : null
  const formulaStageSourceContext = compactFormulaStageContextForTaskSummary(
    formulaStageOutput.sourceContext,
  )
  const formulaStagePlanningScope = normalizeNocodeEditorPlanningScopeValue(
    formulaStageOutput.planningScope,
  )
  const expectedFormulaTaskScopeKey = normalizeText(
    input.scenePayload?.taskScopeKey || input.scenePayload?.scopeKey,
  )
  const expectedFormulaFormId = normalizeText(input.scenePayload?.activeFormId)
  const hasFormulaStageContextMismatch = Boolean(
    formulaStagePlan
    && (
      (expectedFormulaTaskScopeKey
        && formulaStageSourceContext.taskScopeKey !== expectedFormulaTaskScopeKey)
      || (expectedFormulaFormId && formulaStageSourceContext.formId !== expectedFormulaFormId)
    )
  )
  const formulaPlan = formulaStagePlan
    ? {
      origin: normalizeText(formulaStageOutput.origin) || 'standalone',
      planningScope: formulaStagePlanningScope,
      revision: Math.max(0, Number(formulaStageOutput.revision || 0)),
      stagedAt: Math.max(0, Number(formulaStageOutput.stagedAt || 0)),
      formulaPlanFingerprint: normalizeText(formulaStageOutput.formulaPlanFingerprint),
      sourceContext: formulaStageSourceContext,
      plan: hasFormulaStageContextMismatch
        ? { ...formulaStagePlan, confirmation: null }
        : formulaStagePlan,
      confirmation: hasFormulaStageContextMismatch
        ? null
        : formulaStagePlan.confirmation,
      checkpoint: hasFormulaStageContextMismatch
        ? null
        : findLatestFormulaCheckpointSummary(
          actionResults.slice(latestFormulaPlanStageIndex + 1),
        ),
    }
    : isFreshNewFormRequest
      ? null
      : isPlainObject(latestTaskSummary?.formulaPlan)
        ? latestTaskSummary.formulaPlan
        : null
  const latestFlowPatchResult = normalizeFlowPatchResult(
    [...(input.actionResults || [])]
      .reverse()
      .find(action => (
        action?.ok && normalizeText(action?.name) === 'editor_patch_flow'
      ))
      ?.output,
  ) || normalizeFlowPatchResult(latestTaskSummary?.flowPatchResult)
  const latestEntryFlowIntent = normalizeEntryFlowIntent(
    latestTaskSummary?.entryFlowIntent,
  )
  const sceneEntryFlowIntent = normalizeEntryFlowIntent(
    input.scenePayload?.entryFlowIntent,
  )
  const latestFlowIntentSignal = resolveLatestPlanningFlowIntentSignal({
    latestTaskSummary,
    scenePayload: input.scenePayload,
    latestSuccessfulAction,
    assistantBlocks: input.assistantBlocks || [],
    allowHistoricalCarryover: !isFreshNewFormRequest,
  })
  const latestPendingFlowIntent = (
    latestTaskSummary
    && Object.prototype.hasOwnProperty.call(latestTaskSummary, 'pendingFlowIntent')
    && latestTaskSummary.pendingFlowIntent === null
  )
    ? null
    : normalizeNocodeEditorPendingFlowIntent(
      latestTaskSummary?.pendingFlowIntent || input.scenePayload?.pendingFlowIntent,
    )
  const appliedPendingFlowIntent = normalizeNocodeEditorPendingFlowIntent(
    latestSuccessfulAction?.metadata?.pendingFlowIntent,
  )
  const latestPostFormFlowSignals = (
    latestTaskSummary
    && Object.prototype.hasOwnProperty.call(latestTaskSummary, 'postFormFlowSignals')
    && latestTaskSummary.postFormFlowSignals === null
  )
    ? null
    : normalizePostFormFlowSignals(latestTaskSummary?.postFormFlowSignals)
  const latestPostFormFlowOpportunity = (
    latestTaskSummary
    && Object.prototype.hasOwnProperty.call(latestTaskSummary, 'postFormFlowOpportunity')
    && latestTaskSummary.postFormFlowOpportunity === null
  )
    ? null
    : normalizePostFormFlowOpportunity(latestTaskSummary?.postFormFlowOpportunity)
  const latestSummaryPostFormFlowFollowUp = normalizePostFormFlowFollowUp(
    latestTaskSummary?.postFormFlowFollowUp,
  )
  const scenePostFormFlowFollowUp = normalizePostFormFlowFollowUp(
    input.scenePayload?.postFormFlowFollowUp,
  )
  const latestPostFormFlowFollowUp = (
    latestTaskSummary
    && Object.prototype.hasOwnProperty.call(latestTaskSummary, 'postFormFlowFollowUp')
    && latestTaskSummary.postFormFlowFollowUp === null
  )
    ? null
    : latestSummaryPostFormFlowFollowUp || scenePostFormFlowFollowUp
  const updatedAt = Math.max(0, Math.round(Number(input.updatedAt || Date.now())))
  const hasRequestScopedEntryFlowIntent = Boolean(
    input.scenePayload
    && Object.prototype.hasOwnProperty.call(input.scenePayload, 'entryFlowIntent')
    && sceneEntryFlowIntent
    && (
      sceneEntryFlowIntent?.state !== 'none'
      || isNocodeEditorCompleteNewFormIntent({
        userMessage: sceneEntryFlowIntent.sourceUserMessage,
      })
    )
  )
  const fallbackEntryFlowIntent = isFreshNewFormRequest
    ? resolveNocodeEditorFlowEntryIntentWithSignal({
        userMessage: taskBoundaryUserMessage,
        modelSignal: null,
      })
    : hasRequestScopedEntryFlowIntent
      ? sceneEntryFlowIntent
      : (
        latestEntryFlowIntent?.state === 'explicit_positive'
        || latestEntryFlowIntent?.state === 'explicit_negative'
      )
        ? latestEntryFlowIntent
        : sceneEntryFlowIntent || latestEntryFlowIntent
  const latestActionForGoalCarryover = normalizeText(
    latestSuccessfulAction?.name
    || latestTaskSummary?.latestAction
    || input.finishReason,
  )
  const latestActionTargetIdentity = resolveLatestActionTargetIdentity({
    latestAction: latestSuccessfulAction,
    scenePayload: input.scenePayload,
  })
  const latestActionName = normalizeText(latestSuccessfulAction?.name || input.finishReason)
  const actionPlanningScope = latestActionName === 'editor_stage_single_form_plan'
    ? 'form'
    : latestActionName === 'editor_stage_app_plan'
      ? 'app'
      : latestActionName === 'editor_apply_staged_app_blueprint'
        ? resolveActionResultPlanningScope(latestSuccessfulAction)
        : formulaStagePlan
          ? formulaStagePlanningScope
          : 'unknown'
  const resolvedPlanningScope = actionPlanningScope !== 'unknown'
    ? actionPlanningScope
    : isFreshNewFormRequest
      ? requestPlanningScope
    : normalizeNocodeEditorPlanningScopeValue(
      input.scenePayload?.planningScope || latestTaskSummary?.planningScope,
    )
  const canUsePostFormFlow = isNocodeEditorPostFormFlowEnabledForScope(
    resolvedPlanningScope,
  )
  const latestActionTab = resolveLatestActionTab(latestSuccessfulAction?.metadata)
  const shouldKeepPriorFlowGoal = (
    isPlanningOrFlowConfirmationReply(taskBoundaryUserMessage)
    && Boolean(normalizeText(latestTaskSummary?.userGoal))
    && (
      latestEntryFlowIntent?.state === 'explicit_positive'
      || normalizeEntryFlowIntent(latestTaskSummary?.entryFlowIntent)?.state === 'explicit_positive'
    )
    && (
      FLOW_GOAL_CARRYOVER_ACTIONS.has(latestActionForGoalCarryover)
    )
  )
  const flowIntentSourceUserMessage = taskBoundaryUserMessage
    || normalizeText(latestTaskSummary?.userGoal)
    || normalizeText(sceneEntryFlowIntent?.sourceUserMessage)
    || normalizeText(latestEntryFlowIntent?.sourceUserMessage)
  const resolvedEntryFlowIntentFromSignal = resolveNocodeEditorFlowEntryIntentWithSignal({
    userMessage: flowIntentSourceUserMessage,
    activeFormName: isFreshNewFormRequest
      ? ''
      : normalizeText(input.scenePayload?.activeFormName) || normalizeText(latestTaskSummary?.activeFormName),
    modelSignal: latestFlowIntentSignal,
  })
  const entryFlowIntent = (
    resolvedEntryFlowIntentFromSignal.state === 'explicit_positive'
    || resolvedEntryFlowIntentFromSignal.state === 'explicit_negative'
  )
    ? resolvedEntryFlowIntentFromSignal
    : fallbackEntryFlowIntent
  const pendingFlowIntent = resolveNextPendingFlowIntent({
    latest: latestPendingFlowIntent,
    latestAction: latestActionName,
    latestActionTab: latestActionTab,
    latestActionTargetFormId: latestActionTargetIdentity.targetFormId,
    latestActionTargetFormName: latestActionTargetIdentity.targetFormName,
    appliedFormIntent: appliedPendingFlowIntent,
    now: updatedAt,
  })
  const resolvedPendingFlowIntent = sceneEntryFlowIntent?.state === 'explicit_negative'
    ? null
    : isFreshNewFormRequest && !appliedPendingFlowIntent
      ? null
      : pendingFlowIntent
  const resolvedPostFormFlowRelease = resolveActionResultPostFormFlowRelease({
    result: latestSuccessfulAction,
    scenePayload: input.scenePayload,
    latestTaskSummary,
    planningScope: resolvedPlanningScope,
    pendingFlowIntent: resolvedPendingFlowIntent,
  })
  const canPublishPostFormFlowFollowUp = Boolean(
    canUsePostFormFlow
    && resolvedPostFormFlowRelease?.shouldRender
    && resolvedPostFormFlowRelease.canPlan
  )
  const actionPostFormFlowSignals = resolveActionResultPostFormFlowSignals(latestSuccessfulAction)
  const resolvedPostFormFlowSignals = entryFlowIntent?.state === 'none'
    ? (
      actionPostFormFlowSignals
      || (isFreshNewFormRequest ? null : latestPostFormFlowSignals)
    )
    : null
  const createdPostFormFlowOpportunity = (
    entryFlowIntent?.state === 'none'
    && latestActionName === 'editor_apply_staged_app_blueprint'
    && canPublishPostFormFlowFollowUp
  )
    ? decideNocodeEditorPostFormFlowOpportunity({
      planningScope: resolvedPlanningScope,
      entryFlowIntent,
      postFormFlowSignals: actionPostFormFlowSignals,
      targetFormId: latestActionTargetIdentity.targetFormId,
      targetFormName: latestActionTargetIdentity.targetFormName,
      now: updatedAt,
    })
    : null
  const resolvedPostFormFlowOpportunity = sceneEntryFlowIntent?.state === 'explicit_negative'
    ? clearNocodeEditorPostFormFlowOpportunity({
      opportunity: latestPostFormFlowOpportunity,
      clearReason: 'explicit_negative',
      now: updatedAt,
    })
    : isFreshNewFormRequest
      && !createdPostFormFlowOpportunity
      && !isNocodeEditorFlowMainlineAction({
        actionName: latestActionName,
        actionTab: latestActionTab,
      })
        ? clearNocodeEditorPostFormFlowOpportunity({
          opportunity: latestPostFormFlowOpportunity,
          clearReason: 'fresh_new_form',
          now: updatedAt,
        })
        : isNocodeEditorFlowMainlineAction({
          actionName: latestActionName,
          actionTab: latestActionTab,
        })
          ? matchPostFormTargetIdentity({
            targetFormId: latestPostFormFlowOpportunity?.targetFormId,
            targetFormName: latestPostFormFlowOpportunity?.targetFormName,
            latestActionTargetFormId: latestActionTargetIdentity.targetFormId,
            latestActionTargetFormName: latestActionTargetIdentity.targetFormName,
          })
            ? consumeNocodeEditorPostFormFlowOpportunity({
              opportunity: latestPostFormFlowOpportunity,
              consumedBy: 'flow_mainline_started',
              now: updatedAt,
            }) || latestPostFormFlowOpportunity
            : latestPostFormFlowOpportunity
          : createdPostFormFlowOpportunity || latestPostFormFlowOpportunity
  const createdPostFormFlowFollowUp = (
    latestActionName === 'editor_apply_staged_app_blueprint'
    && canPublishPostFormFlowFollowUp
  )
    ? decideNocodeEditorPostFormFlowFollowUp({
      planningScope: resolvedPlanningScope,
      entryFlowIntent,
      pendingFlowIntent: resolvedPendingFlowIntent,
      postFormFlowOpportunity: resolvedPendingFlowIntent ? null : resolvedPostFormFlowOpportunity,
      postFormFlowSignals: actionPostFormFlowSignals,
      targetFormId: latestActionTargetIdentity.targetFormId,
      targetFormName: latestActionTargetIdentity.targetFormName,
      now: updatedAt,
    })
    : null
  const resolvedPostFormFlowFollowUp = sceneEntryFlowIntent?.state === 'explicit_negative'
    ? null
    : !canPublishPostFormFlowFollowUp
      ? null
      : isFreshNewFormRequest
        && !createdPostFormFlowFollowUp
        && !isNocodeEditorFlowMainlineAction({
          actionName: latestActionName,
          actionTab: latestActionTab,
        })
        ? null
        : isNocodeEditorFlowMainlineAction({
          actionName: latestActionName,
          actionTab: latestActionTab,
        })
          ? matchPostFormTargetIdentity({
            targetFormId: latestPostFormFlowFollowUp?.targetFormId,
            targetFormName: latestPostFormFlowFollowUp?.targetFormName,
            latestActionTargetFormId: latestActionTargetIdentity.targetFormId,
            latestActionTargetFormName: latestActionTargetIdentity.targetFormName,
          })
            ? null
            : latestPostFormFlowFollowUp
          : createdPostFormFlowFollowUp || latestPostFormFlowFollowUp

  const flowConfirmationTargetFormId = shouldExcludeFlowConfirmation
    ? ''
    : normalizeText(
      normalizedFlowScheme?.target?.formId
      || (latestActionName === 'editor_plan_flow_scheme'
        ? latestActionTargetIdentity.targetFormId
        : '')
      || latestTaskSummary?.flowConfirmationTargetFormId,
    )
  const flowConfirmationTargetFormName = shouldExcludeFlowConfirmation
    ? ''
    : normalizeText(
      normalizedFlowScheme?.target?.formName
      || (latestActionName === 'editor_plan_flow_scheme'
        ? latestActionTargetIdentity.targetFormName
        : '')
      || latestTaskSummary?.flowConfirmationTargetFormName,
    )

  return {
    userGoal: shouldKeepPriorFlowGoal
      ? normalizeText(latestTaskSummary?.userGoal).slice(0, 120)
      : normalizedUserMessage,
    entryFlowIntent,
    flowIntent: latestFlowIntentSignal || (
      isFreshNewFormRequest
        ? null
        : normalizeNocodeEditorFlowIntentSignal(latestTaskSummary?.flowIntent)
    ),
    currentBlueprintTitle: normalizeText(
      latestBlueprintBlock?.title
      || blueprint?.title,
    ).slice(0, 80),
    currentFlowTitle: normalizeText(
      latestFlowBlock?.title
      || normalizedFlowScheme?.title,
    ).slice(0, 80),
    planningSummary: explicitPlanningSummary || fallbackPlanningSummary,
    planningMode: explicitPlanningMode || fallbackPlanningMode,
    planningOpenQuestions: resolvedPlanningOpenQuestions,
    planningConfirmationStatus,
    planningConfirmationQuestions,
    planningConfirmationResultSummary,
    planningConfirmationContextKey: planningConfirmationProjection.planningContextKey || '',
    planningConfirmationQuestionRecords: planningConfirmationProjection.questions,
    planningConfirmationDecisions: planningConfirmationProjection.decisions,
    flowSummary: normalizeText(
      latestFlowBlock?.summary
      || latestFlowSchemeBlock?.summary
      || normalizedFlowScheme?.summary,
    ).slice(0, 200),
    flowOpenQuestions: resolvedFlowOpenQuestions,
    flowConfirmationStatus,
    flowConfirmationQuestions,
    flowConfirmationResultSummary,
    flowConfirmationContextKey: shouldExcludeFlowConfirmation
      ? expectedFlowPlanningContextKey || ''
      : expectedFlowPlanningContextKey
        || flowConfirmationProjection.planningContextKey
        || '',
    flowConfirmationTargetFormId,
    flowConfirmationTargetFormName,
    flowConfirmationQuestionRecords: shouldExcludeFlowConfirmation
      ? []
      : flowConfirmationProjection.questions,
    flowConfirmationDecisions: shouldExcludeFlowConfirmation
      ? []
      : flowConfirmationProjection.decisions,
    flowBusinessStatus,
    flowDependencyStatus,
    flowMaterializationStatus,
    flowValidationStatus,
    flowValidationSummary,
    flowBlueprintPreflightActive: hasSuccessfulFlowBlueprintResult
      ? false
      : latestFlowBlueprintPreflight
        ? true
        : latestTaskSummary?.flowBlueprintPreflightActive === true,
    flowBlueprintPreflightPhase: hasSuccessfulFlowBlueprintResult
      ? ''
      : normalizeText(
        latestFlowBlueprintPreflight?.phase
        || latestTaskSummary?.flowBlueprintPreflightPhase,
      ),
    flowBlueprintPreflightSchemeRevision: hasSuccessfulFlowBlueprintResult
      ? 0
      : Math.max(0, Number(
        latestFlowBlueprintPreflight?.schemeRevision
        || latestTaskSummary?.flowBlueprintPreflightSchemeRevision
        || 0,
      )),
    flowBlueprintPreflightSummaryRefreshCount: hasSuccessfulFlowBlueprintResult
      ? 0
      : Math.max(0, Number(
        latestFlowBlueprintPreflight?.summaryRefreshCount
        || latestTaskSummary?.flowBlueprintPreflightSummaryRefreshCount
        || 0,
      )),
    flowBlueprintPreflightNodeExampleFetchCount: hasSuccessfulFlowBlueprintResult
      ? 0
      : Math.max(0, Number(
        latestFlowBlueprintPreflight?.nodeExampleFetchCount
        || latestTaskSummary?.flowBlueprintPreflightNodeExampleFetchCount
        || 0,
      )),
    flowBlueprintPreflightUpdatedAt: Math.max(
      0,
      Number(
        latestFlowBlueprintPreflight?.lastProgressAt
        || latestFlowBlueprintPreflight?.startedAt
        || latestTaskSummary?.flowBlueprintPreflightUpdatedAt
        || 0,
      ),
    ),
    flowSummarySnapshotRef: isPlainObject(latestFlowBlueprintPreflight?.summarySnapshotRef)
      ? {
        planningContextKey: normalizeText(latestFlowBlueprintPreflight.summarySnapshotRef.planningContextKey),
        formId: normalizeText(latestFlowBlueprintPreflight.summarySnapshotRef.formId),
        evidenceFingerprint: normalizeText(latestFlowBlueprintPreflight.summarySnapshotRef.evidenceFingerprint),
        updatedAt: Math.max(0, Number(latestFlowBlueprintPreflight.summarySnapshotRef.updatedAt || 0)),
      }
      : null,
    flowNodeExampleCoverage: isPlainObject(latestFlowBlueprintPreflight?.nodeExampleCoverage)
      ? {
        planningContextKey: normalizeText(latestFlowBlueprintPreflight.nodeExampleCoverage.planningContextKey),
        coveredNodeTypes: Array.isArray(latestFlowBlueprintPreflight.nodeExampleCoverage.coveredNodeTypes)
          ? latestFlowBlueprintPreflight.nodeExampleCoverage.coveredNodeTypes.map(item => normalizeText(item)).filter(Boolean)
          : [],
        missingNodeTypes: Array.isArray(latestFlowBlueprintPreflight.nodeExampleCoverage.missingNodeTypes)
          ? latestFlowBlueprintPreflight.nodeExampleCoverage.missingNodeTypes.map(item => normalizeText(item)).filter(Boolean)
          : [],
        hasConditionOperatorGuide: Boolean(latestFlowBlueprintPreflight.nodeExampleCoverage.hasConditionOperatorGuide),
        updatedAt: Math.max(0, Number(latestFlowBlueprintPreflight.nodeExampleCoverage.updatedAt || 0)),
      }
      : null,
    planningScope: resolvedPlanningScope,
    postFormFlowSignals: canUsePostFormFlow ? resolvedPostFormFlowSignals : null,
    postFormFlowOpportunity: canUsePostFormFlow && !resolvedPendingFlowIntent
      ? resolvedPostFormFlowOpportunity
      : null,
    postFormFlowFollowUp: canUsePostFormFlow ? resolvedPostFormFlowFollowUp : null,
    postFormFlowRelease: canUsePostFormFlow ? resolvedPostFormFlowRelease : null,
    pendingFlowIntent: canUsePostFormFlow ? resolvedPendingFlowIntent : null,
    flowPatchResult: latestFlowPatchResult,
    activeFormName: isFreshNewFormRequest
      ? ''
      : normalizeText(input.scenePayload?.activeFormName).slice(0, 80),
    latestAction: latestActionName.slice(0, 80),
    openQuestions: resolvedOpenQuestions,
    blueprintApplyGate: latestBlueprintApplyGate || null,
    formulaPlan,
    updatedAt,
  }
}

export const resolveNocodeEditorTaskSummaryForIncomingUserMessage = (input: {
  latestTaskSummary?: NocodeEditorTaskSummaryLike
  userMessage?: string
  updatedAt?: number
  validateFormulaPlanContext?: boolean
  taskId?: string
  taskScopeKey?: string
  activeFormId?: string
}): NocodeEditorTaskSummaryLike => {
  const previousTaskSummary = input.latestTaskSummary || null
  if (!isPlainObject(previousTaskSummary)) {
    return previousTaskSummary
  }

  const latestFormulaPlan = asRecord(previousTaskSummary.formulaPlan)
  const formulaSourceContext = asRecord(latestFormulaPlan.sourceContext)
  const formulaPlan = isPlainObject(previousTaskSummary.formulaPlan)
    ? latestFormulaPlan
    : null
  const shouldInvalidateFormulaPlan = Boolean(
    input.validateFormulaPlanContext === true
    && formulaPlan
    && (
      !normalizeText(input.taskId)
      || !normalizeText(input.taskScopeKey)
      || !normalizeText(input.activeFormId)
      || !normalizeText(formulaSourceContext.taskId)
      || normalizeText(formulaSourceContext.taskId) !== normalizeText(input.taskId)
      || normalizeText(formulaSourceContext.taskScopeKey) !== normalizeText(input.taskScopeKey)
      || normalizeText(formulaSourceContext.formId) !== normalizeText(input.activeFormId)
    )
  )
  const latestTaskSummary = shouldInvalidateFormulaPlan
    ? {
      ...previousTaskSummary,
      formulaPlan: {
        ...formulaPlan,
        plan: {
          ...asRecord(formulaPlan?.plan),
          confirmation: null,
        },
        confirmation: null,
        checkpoint: null,
      },
    }
    : previousTaskSummary

  const reply = String(input.userMessage || '').trim()
  const requestPlanningScope = resolveNocodeEditorPlanningScope(reply).scope
  const isFreshNewFormRequest = isNocodeEditorFreshCreationRequest({
    userMessage: reply,
    planningScope: requestPlanningScope,
  })
  const incomingEntryFlowIntent = resolveNocodeEditorFlowEntryIntentWithSignal({
    userMessage: reply,
    activeFormName: normalizeText(latestTaskSummary.activeFormName),
    modelSignal: latestTaskSummary.flowIntent,
  })
  if (isFreshNewFormRequest) {
    return buildResetTaskSummaryForFreshNewFormRequest({
      latestTaskSummary,
      userMessage: reply,
      entryFlowIntent: {
        ...incomingEntryFlowIntent,
        targetFormName: undefined,
      },
      planningScope: requestPlanningScope === 'app' ? 'app' : 'form',
      updatedAt: input.updatedAt,
    })
  }
  if (incomingEntryFlowIntent.state === 'explicit_negative') {
    const updatedAt = Math.max(0, Math.round(Number(input.updatedAt || Date.now())))
    return {
      ...latestTaskSummary,
      entryFlowIntent: incomingEntryFlowIntent,
      postFormFlowSignals: null,
      postFormFlowOpportunity: clearNocodeEditorPostFormFlowOpportunity({
        opportunity: normalizePostFormFlowOpportunity(latestTaskSummary.postFormFlowOpportunity),
        clearReason: 'explicit_negative',
        now: updatedAt,
      }),
      postFormFlowFollowUp: null,
      pendingFlowIntent: null,
      updatedAt,
    }
  }
  if (incomingEntryFlowIntent.state === 'explicit_positive') {
    return {
      ...latestTaskSummary,
      entryFlowIntent: incomingEntryFlowIntent,
      postFormFlowSignals: null,
      updatedAt: Math.max(0, Math.round(Number(input.updatedAt || Date.now()))),
    }
  }
  const isStructuredReply = isStructuredPlanningConfirmationReply(reply)
  const isDefaultContinueReply = isDefaultContinueReplyMessage(reply)
  if (!isStructuredReply && !isDefaultContinueReply) {
    if (!normalizePostFormFlowFollowUp(latestTaskSummary.postFormFlowFollowUp)) {
      return latestTaskSummary
    }
    return {
      ...latestTaskSummary,
      postFormFlowFollowUp: null,
      updatedAt: Math.max(0, Math.round(Number(input.updatedAt || Date.now()))),
    }
  }

  const resolveStageQuestions = (stage: 'planning' | 'flow') => {
    const status = normalizeText(
      stage === 'planning'
        ? latestTaskSummary.planningConfirmationStatus
        : latestTaskSummary.flowConfirmationStatus,
    )
    const confirmationQuestions = normalizeOpenQuestionsWithoutLimit(
      stage === 'planning'
        ? latestTaskSummary.planningConfirmationQuestions
        : latestTaskSummary.flowConfirmationQuestions,
    )
    const openQuestions = normalizeOpenQuestionsWithoutLimit(
      stage === 'planning'
        ? latestTaskSummary.planningOpenQuestions
        : latestTaskSummary.flowOpenQuestions,
    )

    if (openQuestions.length && (stage === 'flow' || status !== 'completed')) {
      return openQuestions
    }

    return confirmationQuestions.length ? confirmationQuestions : openQuestions
  }

  const resolveStageAllQuestions = (stage: 'planning' | 'flow') => {
    const confirmationQuestions = normalizeOpenQuestionsWithoutLimit(
      stage === 'planning'
        ? latestTaskSummary.planningConfirmationQuestions
        : latestTaskSummary.flowConfirmationQuestions,
    )
    const openQuestions = normalizeOpenQuestionsWithoutLimit(
      stage === 'planning'
        ? latestTaskSummary.planningOpenQuestions
        : latestTaskSummary.flowOpenQuestions,
    )
    return confirmationQuestions.length ? confirmationQuestions : openQuestions
  }

  const resolveStageQuestionRecords = (stage: 'planning' | 'flow') => {
    const records = stage === 'planning'
      ? latestTaskSummary.planningConfirmationQuestionRecords
      : latestTaskSummary.flowConfirmationQuestionRecords
    return Array.isArray(records) ? records : []
  }

  const resolveStagePlanningContextKey = (stage: 'planning' | 'flow') => normalizeText(
    stage === 'planning'
      ? latestTaskSummary.planningConfirmationContextKey
      : latestTaskSummary.flowConfirmationContextKey,
  )

  const resolveStageResultSummary = (stage: 'planning' | 'flow') => normalizeOpenQuestionsWithoutLimit(
    stage === 'planning'
      ? latestTaskSummary.planningConfirmationResultSummary
      : latestTaskSummary.flowConfirmationResultSummary,
  )

  const hasPendingStage = (stage: 'planning' | 'flow') => {
    const status = normalizeText(
      stage === 'planning'
        ? latestTaskSummary.planningConfirmationStatus
        : latestTaskSummary.flowConfirmationStatus,
    )
    const openQuestions = normalizeOpenQuestionsWithoutLimit(
      stage === 'planning'
        ? latestTaskSummary.planningOpenQuestions
        : latestTaskSummary.flowOpenQuestions,
    )
    if (stage === 'flow' && openQuestions.length) {
      return true
    }
    if (status === 'completed') {
      return false
    }

    return resolveStageQuestions(stage).length > 0
  }

  const latestAction = normalizeText(latestTaskSummary.latestAction)
  const pendingPlanning = hasPendingStage('planning')
  const pendingFlow = hasPendingStage('flow')
  const targetStage = pendingFlow && !pendingPlanning
    ? 'flow'
    : pendingPlanning && !pendingFlow
      ? 'planning'
      : pendingFlow && pendingPlanning
        ? (
          latestAction === 'editor_plan_flow_scheme' || latestAction === 'editor_apply_staged_flow'
          || latestAction === 'editor_stage_flow_blueprint'
            ? 'flow'
            : latestAction === 'editor_stage_app_plan' || latestAction === 'editor_stage_single_form_plan'
              ? 'planning'
              : ''
        )
        : ''

  if (!targetStage) {
    return latestTaskSummary
  }

  const questions = resolveStageQuestions(targetStage)
  const allQuestions = resolveStageAllQuestions(targetStage)
  const completionQuestions = allQuestions.length ? allQuestions : questions
  if (!completionQuestions.length) {
    return latestTaskSummary
  }
  const completionQuestionRecords = resolveStageQuestionRecords(targetStage)
  const confirmationStage = targetStage === 'planning'
    ? normalizeText(latestTaskSummary.latestAction) === 'editor_stage_single_form_plan'
      ? 'form-plan'
      : 'app-plan'
    : 'flow-scheme'
  const planningContextKey = resolveStagePlanningContextKey(targetStage)
  const buildLegacyQuestionId = (title: string, index: number) => (
    confirmationStage === 'flow-scheme'
      ? `${confirmationStage}-question-${index + 1}`
      : buildStablePlanningQuestionId({ stage: confirmationStage, title })
  )

  const updatedAt = Math.max(0, Math.round(Number(input.updatedAt || Date.now())))
  const rebuildOpenQuestions = (summary: NocodeEditorTaskSummaryLike) => {
    const flowQuestions = normalizeOpenQuestionsWithoutLimit(summary?.flowOpenQuestions)
    if (flowQuestions.length) {
      return flowQuestions
    }

    return normalizeOpenQuestionsWithoutLimit(summary?.planningOpenQuestions)
  }

  const applyStageCompletion = (input: {
    resultSummary: string[]
    questionRecords?: NocodeEditorAiConfirmQuestion[]
  }) => {
    const questionRecords = input.questionRecords?.length
      ? input.questionRecords
      : completionQuestions.map((title, index) => ({
        id: buildLegacyQuestionId(title, index),
        title,
        confirmed: true,
        answerSummary: input.resultSummary[index],
      }))
    const confirmationProjection = projectNocodeEditorConfirmationDecisions({
      stage: confirmationStage,
      planningContextKey,
      preserveTrustedDecisionKeySource: confirmationStage === 'flow-scheme',
      confirmation: {
        stage: confirmationStage,
        status: 'completed',
        planningContextKey: planningContextKey || undefined,
        questions: questionRecords,
      },
    })
    const nextSummary = {
      ...latestTaskSummary,
      ...(targetStage === 'planning'
        ? {
          planningOpenQuestions: [],
          planningConfirmationStatus: 'completed',
          planningConfirmationQuestions: completionQuestions,
          planningConfirmationResultSummary: input.resultSummary,
          planningConfirmationContextKey: confirmationProjection.planningContextKey || '',
          planningConfirmationQuestionRecords: confirmationProjection.questions,
          planningConfirmationDecisions: confirmationProjection.decisions,
        }
        : {
          flowOpenQuestions: [],
          flowConfirmationStatus: 'completed',
          flowConfirmationQuestions: completionQuestions,
          flowConfirmationResultSummary: input.resultSummary,
          flowConfirmationContextKey: confirmationProjection.planningContextKey || '',
          flowConfirmationQuestionRecords: confirmationProjection.questions,
          flowConfirmationDecisions: confirmationProjection.decisions,
        }),
      updatedAt,
    }

    return {
      ...nextSummary,
      openQuestions: rebuildOpenQuestions(nextSummary),
    }
  }

  if (isDefaultContinueReply) {
    const resultSummary = [getNocodeEditorCompletedDefaultsResultSummary()]
    return applyStageCompletion({
      resultSummary,
      questionRecords: completionQuestionRecords.map((question) => ({
        ...question,
        confirmed: true,
        answerSummary: question.answerSummary || resultSummary[0],
      })),
    })
  }

  const parsedReply = parseStructuredPlanningConfirmationReply(reply)
  if (parsedReply.length < questions.length) {
    return latestTaskSummary
  }

  const existingResultSummary = resolveStageResultSummary(targetStage)
  const existingSummaryByQuestionKey = new Map<string, string>()
  completionQuestions.forEach((question, index) => {
    const answerSummary = normalizeText(existingResultSummary[index])
    if (!answerSummary) {
      return
    }
    existingSummaryByQuestionKey.set(normalizeQuestionKey(question), answerSummary)
  })

  const remainingReplyItems = [...parsedReply]
  const replySummaryByQuestionKey = new Map<string, string>()
  questions.forEach((question) => {
    const questionKey = normalizeQuestionKey(question)
    const matchedIndex = remainingReplyItems.findIndex(item => (
      normalizeQuestionKey(item.title) === questionKey
    ))
    const matchedItem = matchedIndex >= 0
      ? remainingReplyItems.splice(matchedIndex, 1)[0]
      : remainingReplyItems.shift()
    const answerSummary = normalizeText(matchedItem?.answerSummary)
    if (answerSummary) {
      replySummaryByQuestionKey.set(questionKey, answerSummary)
    }
  })

  const completedQuestionRecords = completionQuestions
    .map((question, index) => {
      const questionRecord = completionQuestionRecords[index] || {
        id: buildLegacyQuestionId(question, index),
        title: question,
      }
      const questionKey = normalizeQuestionKey(question)
      const answerSummary = replySummaryByQuestionKey.get(questionKey)
        || existingSummaryByQuestionKey.get(questionKey)
        || normalizeText(questionRecord.answerSummary)
      const selectedOption = questionRecord.options?.find(option => (
        normalizeQuestionKey(option.label || option.value) === normalizeQuestionKey(answerSummary)
        || normalizeQuestionKey(option.value) === normalizeQuestionKey(answerSummary)
      ))
      return {
        ...questionRecord,
        confirmed: true,
        selectedOptionValue: selectedOption?.value || questionRecord.selectedOptionValue,
        answerSummary: answerSummary || undefined,
        options: questionRecord.options?.map(option => ({
          ...option,
          selected: Boolean(selectedOption && option.value === selectedOption.value),
        })),
      }
    })

  return applyStageCompletion({
    resultSummary: completionQuestions
      .map((question) => {
        const questionKey = normalizeQuestionKey(question)
        return replySummaryByQuestionKey.get(questionKey)
          || existingSummaryByQuestionKey.get(questionKey)
          || ''
      })
      .filter(Boolean)
      .slice(0, 6),
    questionRecords: completedQuestionRecords,
  })
}

export const shouldSuppressNocodeEditorStagedFlowSummaryForIncomingUserMessage = (input: {
  latestTaskSummary?: NocodeEditorTaskSummaryLike
  userMessage?: string
}) => {
  const latestTaskSummary = isPlainObject(input.latestTaskSummary)
    ? input.latestTaskSummary as NocodeEditorTaskContextObject
    : null
  if (!latestTaskSummary) {
    return false
  }

  const reply = String(input.userMessage || '').trim()
  if (!isStructuredPlanningConfirmationReply(reply) && !isDefaultContinueReplyMessage(reply)) {
    return false
  }

  const effectiveTaskSummary = resolveNocodeEditorTaskSummaryForIncomingUserMessage({
    latestTaskSummary,
    userMessage: reply,
  })
  const normalizedEffectiveTaskSummary = isPlainObject(effectiveTaskSummary)
    ? effectiveTaskSummary as NocodeEditorTaskContextObject
    : latestTaskSummary

  const latestAction = normalizeText(normalizedEffectiveTaskSummary.latestAction)
  if (latestAction !== 'editor_plan_flow_scheme' && latestAction !== 'editor_stage_flow_blueprint' && latestAction !== 'editor_apply_staged_flow') {
    return false
  }

  return normalizeText(normalizedEffectiveTaskSummary.flowConfirmationStatus) === 'completed'
    && normalizeOpenQuestionsWithoutLimit(normalizedEffectiveTaskSummary.flowOpenQuestions).length === 0
    && normalizeOpenQuestionsWithoutLimit(normalizedEffectiveTaskSummary.flowConfirmationQuestions).length > 0
}

export const findLatestRealBlueprintArtifactBlock = (input: {
  assistantBlocks?: NocodeEditorTaskContextObject[]
  actionResults?: NocodeEditorTaskActionResultLike[]
}) => {
  const latestAssistantBlock = [...(input.assistantBlocks || [])]
    .reverse()
    .find(block => isNocodeEditorRealBlueprintArtifactBlock(block))
  if (latestAssistantBlock) {
    return latestAssistantBlock
  }

  const latestStageResult = [...(input.actionResults || [])]
    .reverse()
    .find(item => (
      item?.ok
      && String(item?.name || '').trim() === 'editor_stage_app_blueprint'
      && isPlainObject(item.output?.blueprint)
    ))
  if (!latestStageResult) {
    return null
  }

  const blueprint = latestStageResult.output!.blueprint as NocodeEditorTaskContextObject
  return {
    type: 'artifact',
    kind: 'blueprint',
    title: normalizeText(blueprint.title).slice(0, 80),
    summary: normalizeText(blueprint.summary).slice(0, 200),
    revision: Number(latestStageResult.output?.revision || 0) || undefined,
    stagedAt: Number(latestStageResult.output?.stagedAt || 0) || undefined,
    blueprint,
    applyResult: isPlainObject(blueprint.applyResult) ? blueprint.applyResult : null,
  }
}

export const findLatestRealFlowSchemeArtifactBlock = (input: {
  assistantBlocks?: NocodeEditorTaskContextObject[]
  actionResults?: NocodeEditorTaskActionResultLike[]
}) => {
  const latestAssistantBlock = [...(input.assistantBlocks || [])]
    .reverse()
    .find(block => isNocodeEditorRealFlowSchemeArtifactBlock(block))
  if (latestAssistantBlock) {
    return latestAssistantBlock
  }

  const latestStageResult = [...(input.actionResults || [])]
    .reverse()
    .find(item => (
      item?.ok
      && String(item?.name || '').trim() === 'editor_plan_flow_scheme'
      && isPlainObject(item.output?.scheme)
    ))
  if (!latestStageResult) {
    return null
  }

  const scheme = latestStageResult.output!.scheme as NocodeEditorTaskContextObject
  return {
    type: 'artifact',
    kind: 'flow-scheme',
    title: normalizeText(scheme.title).slice(0, 80),
    summary: normalizeText(scheme.summary).slice(0, 200),
    revision: Number(latestStageResult.output?.revision || 0) || undefined,
    stagedAt: Number(latestStageResult.output?.stagedAt || 0) || undefined,
    scheme,
    confirmation: isPlainObject((scheme as NocodeEditorTaskContextObject).confirmation)
      ? (scheme as NocodeEditorTaskContextObject).confirmation
      : null,
    planningStatus: normalizeText(latestStageResult.output?.planningStatus) || undefined,
  }
}

export const findLatestRealFlowArtifactBlock = (input: {
  assistantBlocks?: NocodeEditorTaskContextObject[]
  actionResults?: NocodeEditorTaskActionResultLike[]
}) => {
  const latestAssistantBlock = [...(input.assistantBlocks || [])]
    .reverse()
    .find(block => isNocodeEditorRealFlowArtifactBlock(block))
  if (latestAssistantBlock) {
    return latestAssistantBlock
  }

  const latestStageResult = [...(input.actionResults || [])]
    .reverse()
    .find(item => (
      item?.ok
      && (
        String(item?.name || '').trim() === 'editor_stage_flow_blueprint'
        || String(item?.name || '').trim() === 'editor_apply_staged_flow'
      )
      && (
        isPlainObject(item.output?.flowPlan)
        || isPlainObject(item.metadata?.flowPlan)
        || isPlainObject(item.output?.blueprint)
      )
    ))
  if (!latestStageResult) {
    return null
  }

  const flowPlan = itemOutputFlowPlan(latestStageResult)
  return flowPlan
    ? {
      type: 'artifact',
      kind: 'flow-plan',
      title: normalizeText(flowPlan.title).slice(0, 80),
      summary: normalizeText(flowPlan.summary).slice(0, 200),
      revision: Number(latestStageResult.output?.revision || 0) || undefined,
      stagedAt: Number(latestStageResult.output?.stagedAt || 0) || undefined,
      flowPlan,
      confirmation: isPlainObject((flowPlan as NocodeEditorTaskContextObject).confirmation)
        ? (flowPlan as NocodeEditorTaskContextObject).confirmation
        : null,
      flowApplyResult: isPlainObject(latestStageResult.output) ? latestStageResult.output : null,
    }
    : null
}

export const deriveNocodeEditorTaskSummaryFromExternalAssistantMessage = (input: {
  latestTaskSummary?: NocodeEditorTaskSummaryLike
  metadata?: NocodeEditorTaskContextObject | null
  updatedAt?: number
}): NocodeEditorTaskContextObject | null => {
  const metadata = asRecord(input.metadata)
  const explicitTaskSummary = isPlainObject(metadata.taskSummary)
    ? metadata.taskSummary as NocodeEditorTaskContextObject
    : null
  if (explicitTaskSummary) {
    return explicitTaskSummary
  }

  const latestTaskSummary = isPlainObject(input.latestTaskSummary)
    ? {
      ...(input.latestTaskSummary as NocodeEditorTaskContextObject),
    }
    : null
  if (!latestTaskSummary) {
    return null
  }

  const assistantBlocks = Array.isArray(metadata.blocks)
    ? metadata.blocks.filter(isPlainObject) as NocodeEditorTaskContextObject[]
    : []
  const updatedAt = normalizeTaskSummaryUpdatedAt(input.updatedAt) || Date.now()
  const metadataPlanningScope = normalizeNocodeEditorPlanningScopeValue(
    metadata.planningScope,
  )
  const canUsePostFormFlow = isNocodeEditorPostFormFlowEnabledForScope(
    metadataPlanningScope,
  )
  if (metadata.blueprintAppliedFromAction && !canUsePostFormFlow) {
    return {
      ...latestTaskSummary,
      planningScope: metadataPlanningScope,
      latestAction: 'editor_apply_staged_app_blueprint',
      postFormFlowSignals: null,
      postFormFlowOpportunity: null,
      postFormFlowFollowUp: null,
      postFormFlowRelease: null,
      pendingFlowIntent: null,
      openQuestions: [],
      blueprintApplyGate: null,
      updatedAt,
    }
  }
  const hasExplicitMetadataPendingFlowIntent = Object.prototype.hasOwnProperty.call(
    metadata,
    'pendingFlowIntent',
  )
  const metadataPendingFlowIntent = resolveExternalAssistantMessagePendingFlowIntent({
    metadata,
    latestTaskSummary,
  })
  const storedLatestEntryFlowIntent = normalizeEntryFlowIntent(latestTaskSummary.entryFlowIntent)
  const metadataFlowIntentSignal = resolveMetadataFlowIntentSignal(metadata)
  const latestEntryFlowIntent = resolveNocodeEditorFlowEntryIntentWithSignal({
    userMessage: normalizeText(latestTaskSummary.userGoal)
      || normalizeText(storedLatestEntryFlowIntent?.sourceUserMessage),
    activeFormName: normalizeText(latestTaskSummary.activeFormName),
    modelSignal: metadataFlowIntentSignal || latestTaskSummary.flowIntent,
  })
  const resolvedLatestEntryFlowIntent = (
    latestEntryFlowIntent.state === 'explicit_positive'
    || latestEntryFlowIntent.state === 'explicit_negative'
  )
    ? latestEntryFlowIntent
    : storedLatestEntryFlowIntent
  const metadataPostFormFlowSignals = resolvedLatestEntryFlowIntent?.state === 'none'
    ? resolveExternalAssistantMessagePostFormFlowSignals({
      metadata,
      latestTaskSummary,
    })
    : null
  const metadataPostFormFlowOpportunity = metadataPendingFlowIntent
    ? null
    : resolveExternalAssistantMessagePostFormFlowOpportunity({
      metadata,
      latestTaskSummary,
      entryFlowIntent: resolvedLatestEntryFlowIntent,
      postFormFlowSignals: metadataPostFormFlowSignals,
      planningScope: metadataPlanningScope,
      updatedAt,
    })
  const metadataPostFormFlowRelease = resolveActionResultPostFormFlowRelease({
    result: { metadata },
    latestTaskSummary,
    planningScope: metadataPlanningScope,
    pendingFlowIntent: metadataPendingFlowIntent,
  })
  const metadataPostFormFlowFollowUp = resolveExternalAssistantMessagePostFormFlowFollowUp({
    metadata,
    latestTaskSummary,
    entryFlowIntent: resolvedLatestEntryFlowIntent,
    pendingFlowIntent: metadataPendingFlowIntent,
    postFormFlowOpportunity: metadataPostFormFlowOpportunity,
    postFormFlowSignals: metadataPostFormFlowSignals,
    postFormFlowRelease: metadataPostFormFlowRelease,
    planningScope: metadataPlanningScope,
    updatedAt,
  })

  if (metadata.blueprintAppliedFromAction) {
    const latestBlueprintBlock = findLatestRealBlueprintArtifactBlock({
      assistantBlocks,
      actionResults: [],
    })
    const latestBlueprintApplyBlock = latestBlueprintBlock || [...assistantBlocks]
      .reverse()
      .find(block => (
        normalizeText(block.kind) === 'blueprint'
        && isPlainObject(block.applyResult)
      )) || null
    const resolvedPendingFlowIntent = resolveExternalBlueprintApplyPendingFlowIntent({
      metadataPendingFlowIntent: hasExplicitMetadataPendingFlowIntent
        ? metadataPendingFlowIntent
        : null,
      latestEntryFlowIntent: resolvedLatestEntryFlowIntent,
      latestBlueprintBlock: latestBlueprintApplyBlock,
      updatedAt,
    })
    const currentBlueprintTitle = normalizeText(
      latestBlueprintApplyBlock?.title
      || asRecord(latestBlueprintApplyBlock?.blueprint).title
      || latestTaskSummary.currentBlueprintTitle,
    ).slice(0, 80)

    return {
      ...latestTaskSummary,
      planningScope: metadataPlanningScope,
      entryFlowIntent: resolvedLatestEntryFlowIntent,
      flowIntent: metadataFlowIntentSignal || normalizeNocodeEditorFlowIntentSignal(latestTaskSummary.flowIntent),
      currentBlueprintTitle: currentBlueprintTitle || latestTaskSummary.currentBlueprintTitle,
      latestAction: 'editor_apply_staged_app_blueprint',
      postFormFlowSignals: metadataPostFormFlowSignals,
      postFormFlowOpportunity: resolvedPendingFlowIntent
        ? null
        : metadataPostFormFlowOpportunity,
      postFormFlowFollowUp: metadataPostFormFlowRelease.shouldRender
        && metadataPostFormFlowRelease.canPlan
        && resolvedPendingFlowIntent
        ? decideNocodeEditorPostFormFlowFollowUp({
          planningScope: metadataPlanningScope,
          entryFlowIntent: resolvedLatestEntryFlowIntent,
          pendingFlowIntent: resolvedPendingFlowIntent,
          postFormFlowSignals: metadataPostFormFlowSignals,
          targetFormId: resolveExternalBlueprintApplyTargetIdentity({
            blueprintBlock: latestBlueprintApplyBlock,
          }).targetFormId,
          targetFormName: resolveExternalBlueprintApplyTargetIdentity({
            blueprintBlock: latestBlueprintApplyBlock,
          }).targetFormName || resolvedLatestEntryFlowIntent?.targetFormName,
          now: updatedAt,
        })
        : resolvedPendingFlowIntent
          ? null
          : metadataPostFormFlowFollowUp,
      postFormFlowRelease: metadataPostFormFlowRelease,
      pendingFlowIntent: resolvedPendingFlowIntent,
      openQuestions: [],
      blueprintApplyGate: null,
      updatedAt,
    }
  }

  if (metadata.flowAppliedFromAction) {
    const latestFlowBlock = findLatestRealFlowArtifactBlock({
      assistantBlocks,
      actionResults: [],
    })
    const currentFlowTitle = normalizeText(
      latestFlowBlock?.title
      || asRecord(latestFlowBlock?.flowPlan).title
      || latestTaskSummary.currentFlowTitle,
    ).slice(0, 80)
    const flowSummary = normalizeText(
      latestFlowBlock?.summary
      || asRecord(latestFlowBlock?.flowPlan).summary
      || latestTaskSummary.flowSummary,
    ).slice(0, 200)

    return {
      ...latestTaskSummary,
      currentFlowTitle: currentFlowTitle || latestTaskSummary.currentFlowTitle,
      flowSummary: flowSummary || latestTaskSummary.flowSummary,
      latestAction: 'editor_apply_staged_flow',
      postFormFlowSignals: metadataPostFormFlowSignals,
      postFormFlowOpportunity: metadataPendingFlowIntent
        ? null
        : consumeNocodeEditorPostFormFlowOpportunity({
          opportunity: metadataPostFormFlowOpportunity,
          consumedBy: 'flow_mainline_started',
          now: updatedAt,
        }) || metadataPostFormFlowOpportunity,
      postFormFlowFollowUp: null,
      postFormFlowRelease: metadataPostFormFlowRelease,
      pendingFlowIntent: metadataPendingFlowIntent,
      openQuestions: [],
      updatedAt,
    }
  }

  return latestTaskSummary
}

const itemOutputFlowPlan = (result?: NocodeEditorTaskActionResultLike | null) => {
  const output = asRecord(result?.output)
  if (isPlainObject(output.flowPlan)) {
    return output.flowPlan as NocodeEditorTaskContextObject
  }
  const metadata = asRecord(result?.metadata)
  if (isPlainObject(metadata.flowPlan)) {
    return metadata.flowPlan as NocodeEditorTaskContextObject
  }
  const blueprintFlowPlan = convertNocodeEditorFlowBlueprintToFlowPlan(
    normalizeNocodeEditorFlowBlueprint(output.blueprint),
  )
  return blueprintFlowPlan
    ? blueprintFlowPlan as NocodeEditorTaskContextObject
    : null
}

const resolveExternalAssistantMessagePendingFlowIntent = (input: {
  metadata?: NocodeEditorTaskContextObject | null
  latestTaskSummary?: NocodeEditorTaskContextObject | null
}) => {
  const metadata = asRecord(input.metadata)
  if (Object.prototype.hasOwnProperty.call(metadata, 'pendingFlowIntent')) {
    if (metadata.pendingFlowIntent === null) {
      return null
    }
    return normalizeNocodeEditorPendingFlowIntent(metadata.pendingFlowIntent)
  }
  return normalizeNocodeEditorPendingFlowIntent(input.latestTaskSummary?.pendingFlowIntent)
}

const resolveExternalBlueprintApplyTargetIdentity = (input: {
  blueprintBlock?: NocodeEditorTaskContextObject | null
}) => {
  const applyResult = asRecord(input.blueprintBlock?.applyResult)
  const forms = Array.isArray(applyResult.forms)
    ? applyResult.forms.filter(isPlainObject) as NocodeEditorTaskContextObject[]
    : []

  if (forms.length !== 1) {
    return {
      targetFormId: '',
      targetFormName: '',
    }
  }

  const form = forms[0]
  return {
    targetFormId: normalizeText(form.tableId),
    targetFormName: normalizeText(form.tableName || form.formName),
  }
}

const resolveExternalBlueprintApplyPendingFlowIntent = (input: {
  metadataPendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  latestEntryFlowIntent?: NocodeEditorFlowEntryIntentLike | null
  latestBlueprintBlock?: NocodeEditorTaskContextObject | null
  updatedAt: number
}) => {
  if (input.metadataPendingFlowIntent) {
    return input.metadataPendingFlowIntent
  }

  const latestEntryFlowIntent = normalizeEntryFlowIntent(input.latestEntryFlowIntent)
  if (latestEntryFlowIntent?.state !== 'explicit_positive') {
    return null
  }

  const targetIdentity = resolveExternalBlueprintApplyTargetIdentity({
    blueprintBlock: input.latestBlueprintBlock,
  })

  return buildNocodeEditorPendingFlowIntentFromEntryFlowIntent({
    entryFlowIntent: latestEntryFlowIntent,
    targetFormId: targetIdentity.targetFormId || undefined,
    targetFormName: targetIdentity.targetFormName || latestEntryFlowIntent.targetFormName || undefined,
    now: input.updatedAt,
  })
}

const resolveExternalAssistantMessagePostFormFlowSignals = (input: {
  metadata?: NocodeEditorTaskContextObject | null
  latestTaskSummary?: NocodeEditorTaskContextObject | null
}) => {
  const metadata = asRecord(input.metadata)
  if (Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowSignals')) {
    if (metadata.postFormFlowSignals === null) {
      return null
    }
    return normalizePostFormFlowSignals(metadata.postFormFlowSignals)
  }
  return normalizePostFormFlowSignals(input.latestTaskSummary?.postFormFlowSignals)
}

const resolveExternalAssistantMessagePostFormFlowOpportunity = (input: {
  metadata?: NocodeEditorTaskContextObject | null
  latestTaskSummary?: NocodeEditorTaskContextObject | null
  entryFlowIntent?: NocodeEditorFlowEntryIntentLike | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  planningScope: NocodeEditorPlanningScope
  updatedAt?: number
}) => {
  const metadata = asRecord(input.metadata)
  if (Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowOpportunity')) {
    if (metadata.postFormFlowOpportunity === null) {
      return null
    }
    return normalizePostFormFlowOpportunity(metadata.postFormFlowOpportunity)
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowSignals')) {
    if (metadata.postFormFlowSignals === null) {
      return null
    }
    return decideNocodeEditorPostFormFlowOpportunity({
      planningScope: input.planningScope,
      entryFlowIntent: input.entryFlowIntent,
      postFormFlowSignals: input.postFormFlowSignals,
      targetFormId: metadata.targetFormId || input.latestTaskSummary?.activeFormId,
      targetFormName: metadata.targetFormName || input.latestTaskSummary?.activeFormName,
      now: input.updatedAt,
    })
  }
  const latestOpportunity = normalizePostFormFlowOpportunity(input.latestTaskSummary?.postFormFlowOpportunity)
  if (latestOpportunity) {
    return latestOpportunity
  }
  return null
}

const resolveExternalAssistantMessagePostFormFlowFollowUp = (input: {
  metadata?: NocodeEditorTaskContextObject | null
  latestTaskSummary?: NocodeEditorTaskContextObject | null
  entryFlowIntent?: NocodeEditorFlowEntryIntentLike | null
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  postFormFlowRelease?: NocodeEditorPostFormFlowRelease | null
  planningScope: NocodeEditorPlanningScope
  updatedAt?: number
}) => {
  const metadata = asRecord(input.metadata)
  if (!input.postFormFlowRelease?.shouldRender || !input.postFormFlowRelease.canPlan) {
    return null
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowFollowUp')) {
    if (metadata.postFormFlowFollowUp === null) {
      return null
    }
    return normalizePostFormFlowFollowUp(metadata.postFormFlowFollowUp)
  }

  if (
    Object.prototype.hasOwnProperty.call(metadata, 'pendingFlowIntent')
    || Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowOpportunity')
    || Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowSignals')
  ) {
    return decideNocodeEditorPostFormFlowFollowUp({
      planningScope: input.planningScope,
      entryFlowIntent: input.entryFlowIntent,
      pendingFlowIntent: input.pendingFlowIntent,
      postFormFlowOpportunity: input.postFormFlowOpportunity,
      postFormFlowSignals: input.postFormFlowSignals,
      targetFormId: metadata.targetFormId || input.latestTaskSummary?.activeFormId,
      targetFormName: metadata.targetFormName || input.latestTaskSummary?.activeFormName,
      now: input.updatedAt,
    })
  }

  if (Object.prototype.hasOwnProperty.call(metadata, 'flowAppliedFromAction')) {
    return null
  }

  return normalizePostFormFlowFollowUp(input.latestTaskSummary?.postFormFlowFollowUp)
}

export const buildNocodeEditorTaskHistoryForProvider = (input: {
  messages: NocodeEditorTaskHistoryMessageLike[]
  maxVisibleMessages: number
  latestTaskSummary?: NocodeEditorTaskSummaryLike
}): AiProviderMessage[] => {
  const allMessages = Array.isArray(input.messages) ? input.messages : []
  const maxVisibleMessages = Math.max(1, Math.round(Number(input.maxVisibleMessages || 0)) || 1)
  const visibleMessages = allMessages
    .filter((message) => {
      const role = String(message.role || '').trim()
      if (role !== 'user' && role !== 'assistant' && role !== 'tool') {
        return false
      }
      const hasModelToolExchangeCall = Boolean(message.metadata?.modelToolExchangeCall)
      const hasModelToolExchangeResult = Boolean(message.metadata?.modelToolExchangeResult)
      if (message.metadata?.hiddenFromTimeline && !hasModelToolExchangeCall && !hasModelToolExchangeResult) {
        return false
      }
      return true
    })

  const latestSummaryIndex = findLatestSummaryClusterStartIndex(visibleMessages)

  const latestVisibleMessages = latestSummaryIndex >= 0
    ? (() => {
      const summaryTail = visibleMessages.slice(latestSummaryIndex)
      const latestSummaryMessage = visibleMessages[latestSummaryIndex]
      const latestSummaryTraceId = getTraceId(latestSummaryMessage)
      const summaryUser = latestSummaryTraceId
        ? [...visibleMessages.slice(0, latestSummaryIndex)]
          .reverse()
          .find(message => (
            String(message.role || '').trim() === 'user'
            && getTraceId(message) === latestSummaryTraceId
          ))
        : null

      return [
        ...(summaryUser ? [summaryUser] : []),
        ...summaryTail.filter((message, offset) => {
          if (offset === 0) {
            return true
          }
          const role = String(message.role || '').trim()
          if (role === 'user' || role === 'tool') {
            return true
          }
          if (isToolExchangeMessage(message) || isSummaryAnchorAssistantMessage(message)) {
            return true
          }
          return false
        }),
      ]
    })()
    : visibleMessages.slice(-maxVisibleMessages)

  const toolExchangeCallIds = new Set(
    latestVisibleMessages
      .map((message) => {
        const metadata = asRecord(message.metadata)
        return normalizeText(asRecord(metadata.modelToolExchangeCall).id)
      })
      .filter(Boolean),
  )
  const toolExchangeResultCallIds = new Set(
    latestVisibleMessages
      .map((message) => {
        const metadata = asRecord(message.metadata)
        return normalizeText(asRecord(metadata.modelToolExchangeResult).callId)
      })
      .filter(Boolean),
  )

  const pairedMessages = latestVisibleMessages.filter((message) => {
    const metadata = asRecord(message.metadata)
    const callId = normalizeText(asRecord(metadata.modelToolExchangeCall).id)
    if (callId) {
      return toolExchangeResultCallIds.has(callId)
    }
    const resultCallId = normalizeText(asRecord(metadata.modelToolExchangeResult).callId)
    if (resultCallId) {
      return toolExchangeCallIds.has(resultCallId)
    }
    return true
  })

  const {
    latestTaskSummaryMessage,
    latestTaskSummary: latestEffectiveTaskSummary,
  } = pickLatestTaskSummary({
    messages: pairedMessages,
    latestTaskSummary: input.latestTaskSummary,
  })
  const latestUserMessage = [...pairedMessages]
    .reverse()
    .find(message => String(message.role || '').trim() === 'user')
  const latestTaskSummary = resolveNocodeEditorTaskSummaryForIncomingUserMessage({
    latestTaskSummary: latestEffectiveTaskSummary,
    userMessage: String(latestUserMessage?.metadata?.userFacingContent || latestUserMessage?.content || ''),
  })
  const latestBlueprintApplyGate = getLatestBlueprintApplyGate(pairedMessages, latestTaskSummary)
  const compactedMessages = compactStageHistoryMessagesForProvider(
    pairedMessages,
    latestTaskSummaryMessage,
    latestTaskSummary,
  )
  const providerMessages: AiProviderMessage[] = compactedMessages.map(message => ({
    role: normalizeProviderMessageRole(message.role),
    content: String(message.content || ''),
    toolCallId: normalizeText(message.metadata?.modelToolExchangeResult?.callId) || undefined,
    metadata: message.metadata || null,
  }))
  const projectedProviderMessages = projectNocodeEditorProviderMessagesForContext(
    providerMessages,
  )
  const providerTaskSummary = projectNocodeEditorTaskSummaryForProvider(
    latestTaskSummary,
  )

  return [
    providerTaskSummary
      ? {
        role: AiMessageRole.SYSTEM,
        content: `当前任务摘要：${JSON.stringify(providerTaskSummary)}`,
        metadata: {
          scene: 'nocode-editor',
          derivedTaskSummary: true,
        },
      }
      : null,
    latestBlueprintApplyGate
      ? {
        role: AiMessageRole.SYSTEM,
        content: `当前蓝图确认状态：${JSON.stringify(latestBlueprintApplyGate)}`,
        metadata: {
          scene: 'nocode-editor',
          derivedBlueprintApplyGate: true,
          blueprintApplyGate: latestBlueprintApplyGate,
        },
      }
      : null,
    ...projectedProviderMessages.messages,
  ].filter((message): message is AiProviderMessage => Boolean(message))
}
