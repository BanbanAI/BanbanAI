import type { Ref } from 'vue'
import type { NocodeEditorAiConfirmPayload } from '@common/types/nocodeEditorConfirmation'
import type { AiAssistantConfirmationCardPresentation } from '@common/types/ai'
import type { NocodeEditorIndustrySkeletonCarryover } from '@common/utils/nocodeEditorIndustrySkeleton'
import type { FlowIssueRoutingResult } from '@common/utils/nocodeEditorFlowIssueRouter'
import type {
  FlowIssueStateResolutionLike,
  UnifiedFlowIssue,
} from '@common/utils/nocodeEditorFlowUnifiedIssue'
import type {
  NocodeEditorFlowEntryIntent,
  NocodeEditorFlowEntryIntentState,
} from '@common/utils/nocodeEditorFlowEntryIntent'
import type {
  NocodeEditorFlowIntentSignal,
} from '@common/utils/nocodeEditorFlowIntentSignal'
import type {
  NocodeEditorPendingFlowIntent,
  NocodeEditorPendingFlowIntentStatus,
} from '@common/utils/nocodeEditorPendingFlowIntent'
import type {
  NocodeEditorPostFormFlowSignals,
} from '@common/utils/nocodeEditorPostFormFlowSignals'
import type { NocodeEditorPlanningScope } from '@common/utils/nocodeEditorPlanningScope'
import type {
  NocodeEditorFormulaContextSnapshot,
  NocodeEditorFormulaApplyResult,
  NocodeEditorFormulaPlan,
  NocodeEditorFormulaPlanOrigin,
  NocodeEditorFormulaSpec,
  NocodeEditorFormulaTaskStatus,
} from '@common/types/nocodeEditorFormula'
import type { NocodeEditorPostFormFlowRelease } from '@common/utils/nocodeEditorPostFormFlowRelease'
import type {
  NocodeEditorPostFormFlowOpportunity,
} from '@common/utils/nocodeEditorPostFormFlowOpportunity'
import type {
  NocodeEditorPostFormFlowFollowUp,
} from '@common/utils/nocodeEditorPostFormFlowFollowUp'
import type { ExcelFieldItem } from '@common/types/excel'
import { getNocodeEditorBlueprintFormApplyTargetIdentity } from '../../../../../../common/utils/nocodeEditorBlueprintFormNormalization'
import type {
  NocodeEditorFlowPlan,
} from '@common/utils/nocodeEditorFlowPlan'
import type {
  NocodeEditorFlowPatch,
  NocodeEditorFlowPatchResult,
} from '@common/utils/nocodeEditorFlowPatch'
import type {
  NocodeEditorFlowBlueprint,
  NocodeEditorFlowBlueprintMismatchReason,
} from '@common/utils/nocodeEditorFlowBlueprint'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemePlanningStatus,
  NocodeEditorFlowSchemeReviewResult,
} from '@common/utils/nocodeEditorFlowScheme'
import type { FormDesignValidationIssue } from '../form/designValidation'
import type {
  NocodeEditorAiBlueprintAppliedPhase,
  NocodeEditorAiBlueprintPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import type {
  NocodeEditorAiTaskSeed,
  NocodeEditorAiTaskStoreValue,
} from '@common/utils/nocodeEditorAiTaskSession'
import type { Nocode, NocodeStructure } from '@common/types/nocode'

export type {
  FlowIssueStateResolutionLike,
  NocodeEditorAiTaskSeed,
  NocodeEditorAiTaskStoreValue,
  UnifiedFlowIssue,
}

export enum NocodeEditorAiMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export type NocodeEditorAiMessageArtifactKind =
  | 'nocode-app'
  | 'app-plan'
  | 'form-plan'
  | 'content-plan'
  | 'formula-plan'
  | 'flow-scheme'
  | 'flow-plan'
  | 'blueprint'
export type NocodeEditorAiArtifactBlockStatus = 'loading' | 'ready' | 'error'
export type NocodeEditorAiBoardBlueprintBlock = {
  blockKey: string
  title?: string
  dataSource?: {
    sourceId?: string
    tableId?: string
  }
}
export type NocodeEditorAiSummaryStage =
  | 'plain-assistant'
  | 'app-plan'
  | 'form-plan'
  | 'content-plan'
  | 'formula-plan'
  | 'flow-scheme'
  | 'flow-plan'
  | 'blueprint'
export type NocodeEditorAiFlowSummarySnapshotRef = {
  planningContextKey?: string
  formId?: string
  evidenceFingerprint?: string
  updatedAt?: number
}
export type NocodeEditorAiFlowNodeExampleCoverage = {
  planningContextKey?: string
  coveredNodeTypes?: string[]
  missingNodeTypes?: string[]
  hasConditionOperatorGuide?: boolean
  updatedAt?: number
}
export type NocodeEditorAiSummaryMetadata = {
  summaryStage?: NocodeEditorAiSummaryStage
  flowBlueprintPreflightPhase?: string
  flowSummarySnapshotRef?: NocodeEditorAiFlowSummarySnapshotRef | null
  flowNodeExampleCoverage?: NocodeEditorAiFlowNodeExampleCoverage | null
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
  postFormFlowFollowUp?: NocodeEditorPostFormFlowFollowUp | null
  postFormFlowRelease?: NocodeEditorPostFormFlowRelease | null
  planningScope?: NocodeEditorPlanningScope
}

export enum NocodeEditorAiStreamEventType {
  START = 'start',
  DELTA = 'delta',
  TOOL_CALL = 'tool-call',
  TOOL_RESULT = 'tool-result',
  DONE = 'done',
  ERROR = 'error',
}

export type NocodeEditorAiMode =
  | 'idle'
  | 'form-design'
  | 'process-setting'
  | 'page-design'
  | 'app-setting'

export type NocodeEditorAiHostContext = {
  nocodeId: string
  mode: NocodeEditorAiMode
  currentActiveId: string
  activeFormId: string
  activeFormName: string
  settingVisible: boolean
  availableForms: Array<{
    tableId?: string
    name?: string
    groupName?: string
    targetIdentityKey: string
  }>
  dirty: {
    form: boolean
    page: boolean
    aiDraft: boolean
  }
}

export type NocodeEditorAiSettingContextType = 'default-formula'
export type NocodeEditorAiSettingTargetContextType = 'default-formula-target'

export type AiDefaultFormulaContext = {
  type: 'default-formula'
  widgetId: string
  widgetTitle: string
  currentFormula: string
  rules: string[]
  fieldList: Array<{
    token: string
    title: string
    valueType: string
    sourceType: 'current-row' | 'current-history' | 'linked-table' | 'other-table'
    disabled?: boolean
    disabledReason?: string
  }>
  formulaList: Array<{
    name: string
    category: string
    kind: 'normal' | 'column' | 'context'
    usage?: string
    defaultArgTail?: string
    summary?: string
  }>
}

export type AiDefaultFormulaTargetContext = {
  type: 'default-formula-target'
  widgetId: string
  widgetTitle: string
}

export type NocodeEditorAiTaskContext = AiDefaultFormulaContext | null
export type NocodeEditorAiSettingTargetContext = AiDefaultFormulaTargetContext | null
export type NocodeEditorAiSettingContext = AiDefaultFormulaContext | null

export type NocodeEditorAiSettingContextHost = {
  getCurrentTaskContext: () => Promise<NocodeEditorAiTaskContext | null | undefined> | NocodeEditorAiTaskContext | null | undefined
  getCurrentSettingTargetContext: () => NocodeEditorAiSettingTargetContext
  getCurrentSettingContext: () => NocodeEditorAiSettingContext
}

export type NocodeEditorAiImportedHandoffContext = {
  handoffId?: string
  creationMode?: 'create_new_app' | 'extend_existing_app' | 'undecided'
  intentKind?: 'create_app' | 'create_form'
  entryTitle?: string
  targetAppName?: string
  originalGoal?: string
  materialSummary?: string
}

export type {
  NocodeEditorFlowEntryIntent,
  NocodeEditorFlowIntentSignal,
  NocodeEditorFlowEntryIntentState,
  NocodeEditorPendingFlowIntent,
  NocodeEditorPendingFlowIntentStatus,
  NocodeEditorPostFormFlowSignals,
  NocodeEditorPostFormFlowOpportunity,
  NocodeEditorPostFormFlowFollowUp,
}

export type NocodeEditorAiMessage = {
  id: string
  role: NocodeEditorAiMessageRole
  content: string
  sequence?: number
  createTime?: number
  traceId?: string | null
  metadata?: Record<string, unknown> | null
  artifactKind?: NocodeEditorAiMessageArtifactKind
  artifactVersion?: string
}

export type NocodeEditorAiChatRequest = {
  conversationId?: string
  message: string
  providerId?: string
  modelId?: string
  model?: string
  modelSelectionSource?: 'default' | 'explicit'
  traceId?: string
  scene: 'nocode-editor'
  metadata?: Record<string, unknown>
  scenePayload?: {
    nocodeId?: string
    activeFormId?: string
    activeFormName?: string
    currentActiveId?: string
    mode?: NocodeEditorAiMode
    taskContextType?: NocodeEditorAiSettingContextType
    settingTargetContextType?: NocodeEditorAiSettingTargetContextType
    settingContextType?: NocodeEditorAiSettingContextType
    selectedWidgetId?: string
    draftRevision?: number
    stagedPlanningSummary?: string
    stagedFlowSummary?: string
    stagedBlueprintSummary?: string
    pendingBlueprintRepeatIntent?: boolean
    pendingBlueprintClarificationSummary?: string
    pendingBlueprintClarificationKind?: 'planning-question' | 'explicit-confirmation'
    pendingBlueprintBlockedBlueprintId?: string
    entryFlowIntent?: NocodeEditorFlowEntryIntent
    flowIntent?: NocodeEditorFlowIntentSignal | null
    pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
    postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
    postFormFlowFollowUp?: NocodeEditorPostFormFlowFollowUp | null
    postFormFlowRelease?: NocodeEditorPostFormFlowRelease | null
    planningScope?: NocodeEditorPlanningScope
    industrySkeletonContext?: NocodeEditorIndustrySkeletonCarryover | null
    importedHandoffContext?: NocodeEditorAiImportedHandoffContext
  }
}

export type NocodeEditorAiChatStreamPayload = {
  conversationId?: string
  event: NocodeEditorAiStreamEventType
  text?: string
  error?: string
  finishReason?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  metadata?: Record<string, unknown>
}

export type NocodeEditorAiStreamErrorKind =
  | 'payload_too_large'
  | 'provider_timeout'
  | 'provider_output_overflow'
  | 'stream_error'

export type NocodeEditorAiStreamErrorMetadata = {
  traceId?: string
  errorKind?: NocodeEditorAiStreamErrorKind
  retryable?: boolean
  userMessagePersisted?: boolean
  recoveryAction?: 'continue_generation'
  timeoutPhase?: 'first_event' | 'idle' | 'total'
  timeoutMs?: number
}

export type NocodeEditorAiThreadMessage = {
  id: string
  role: NocodeEditorAiMessageRole
  content: string
  sequence?: number
  createTime?: number
  traceId?: string | null
  metadata?: Record<string, unknown> | null
}

export type NocodeEditorAiClientToolResultRequest = {
  conversationId: string
  callId: string
  toolName: string
  ok: boolean
  output?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export type NocodeEditorAiBlueprintOption = {
  label: string
  value: string
}

export type NocodeEditorAiBlueprintDefaultValue = string | number | boolean | string[]

export type NocodeEditorAiExcelBlueprintSource = {
  kind: 'excel'
  fileName: string
  worksheet: string
  titleRowIndex: number
  uploadSourceType?: 'excel' | 'zip' | ''
}

export type NocodeEditorAiExcelImportHandle = {
  fullPath: string
  sessionId?: string
}

export type NocodeEditorAiExcelColumnBinding = {
  excelField: `col-${number}`
  fieldKey: string
  fieldName: string
  parentExcelField?: `col-${number}`
  parentFieldKey?: string
}

export type NocodeEditorAiExcelBlueprintImportContext = {
  source: NocodeEditorAiExcelBlueprintSource
  formKey: string
  tableName: string
  columns: NocodeEditorAiExcelColumnBinding[]
}

export type NocodeEditorAiExcelBlueprintDraftInput = {
  source: NocodeEditorAiExcelBlueprintSource
  importHandle: NocodeEditorAiExcelImportHandle
  tableName: string
  groupName?: string
  excelFields: ExcelFieldItem[]
  columnValues?: Partial<Record<`col-${number}`, string[]>>
}

export type NocodeEditorAiBlueprintFieldSource = {
  formKey?: string
  formName?: string
  fieldKey?: string
  fieldName?: string
}

export type NocodeEditorAiSolutionOutlineForm = {
  formKey?: string
  tableName: string
  groupName?: string
  groupNameExplicit?: boolean
  description?: string
}

export type NocodeEditorAiSolutionOutlineModule = {
  moduleKey?: string
  name: string
  description?: string
  color?: string
  formKeys?: string[]
}

export type NocodeEditorAiSolutionOutlineFlow = {
  from: string
  to: string
  label?: string
}

export type NocodeEditorAiSolutionOutline = {
  id?: string
  title?: string
  summary?: string
  forms: NocodeEditorAiSolutionOutlineForm[]
  modules: NocodeEditorAiSolutionOutlineModule[]
  flows?: NocodeEditorAiSolutionOutlineFlow[]
  assumptions?: string[]
  openQuestions?: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
  flowIntent?: NocodeEditorFlowIntentSignal | null
}

export type NocodeEditorAiAppBlueprintField = {
  fieldKey?: string
  name: string
  widgetType?: string
  description?: string
  required?: boolean
  placeholder?: string
  validationFormat?: string
  enumOptions?: Array<string | NocodeEditorAiBlueprintOption>
  defaultValue?: NocodeEditorAiBlueprintDefaultValue
  source?: NocodeEditorAiBlueprintFieldSource
  formulaSettings?: NocodeEditorFormulaSpec[]
  children?: NocodeEditorAiAppBlueprintField[]
  notes?: string[]
  excelSource?: {
    excelField: `col-${number}`
    title: string
    type?: string
    parentExcelField?: `col-${number}`
  }
}

export type NocodeEditorAiAppBlueprintForm = {
  formKey?: string
  tableName: string
  groupName?: string
  description?: string
  fields: NocodeEditorAiAppBlueprintField[]
  excelImportContext?: NocodeEditorAiExcelBlueprintImportContext
}

export const selectNocodeEditorAiBlueprintFormsByTargetFormKeys = <TForm extends Partial<NocodeEditorAiAppBlueprintForm>>(
  forms: TForm[] | null | undefined,
  targetFormKeys?: string[] | null,
) => {
  const formList = Array.isArray(forms) ? forms : []
  const hasExplicitTargetFormKeys = Array.isArray(targetFormKeys)
  const targetFormKeySet = new Set(
    (hasExplicitTargetFormKeys ? targetFormKeys : [])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  )
  if (hasExplicitTargetFormKeys && !targetFormKeySet.size) {
    return []
  }

  return formList.flatMap((form, index) => (
    (!hasExplicitTargetFormKeys || targetFormKeySet.has(getNocodeEditorBlueprintFormApplyTargetIdentity(form)))
      ? [{ form, index }]
      : []
  ))
}

export type NocodeEditorAiAppBlueprint = {
  id?: string
  title?: string
  summary?: string
  forms: NocodeEditorAiAppBlueprintForm[]
  assumptions?: string[]
  openQuestions?: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
}

export type NocodeEditorAiBlueprintApplyFormResult = {
  applyTargetKey: string
  formKey: string
  tableId: string
  tableName: string
  description?: string
  created: boolean
  reused: boolean
  fieldsCreated: string[]
  fieldsReused: string[]
  fieldsUpdated: string[]
  fieldWarnings: string[]
  fieldBindings?: NocodeEditorAiBlueprintFieldBinding[]
  formulaApply?: NocodeEditorFormulaApplyResult
}

export type NocodeEditorAiBlueprintFieldBinding = {
  tableId?: string
  fieldKey: string
  fieldName: string
  widgetId: string
  widgetType?: string
  parentFieldKey?: string
  parentWidgetId?: string
  token?: string
  formulaPaths?: Array<'default-formula' | 'compute-formula'>
}

export type NocodeEditorAiBlueprintFormulaSummary = {
  status: NocodeEditorFormulaTaskStatus
  updated: number
  skipped: number
  failed: number
  issues?: NocodeEditorFormulaApplyResult['issues']
}

export type NocodeEditorAiExcelImportAfterBlueprintResult = {
  ok: boolean
  tableId: string
  tableName: string
  successImportCount: number
  total: number
  addedCount?: number
  updatedCount?: number
  warnings: string[]
}

export type NocodeEditorAiBlueprintApplyResult = {
  planningScope: NocodeEditorPlanningScope
  ok: boolean
  persistenceMode?: 'saved' | 'draft_only'
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  blueprintId: string
  startedAt: number
  finishedAt: number
  forms: NocodeEditorAiBlueprintApplyFormResult[]
  warnings: string[]
  excelImportResults?: NocodeEditorAiExcelImportAfterBlueprintResult[]
  postFormFlowSignals?: NocodeEditorPostFormFlowSignals | null
  postFormFlowOpportunity?: NocodeEditorPostFormFlowOpportunity | null
  postFormFlowFollowUp?: NocodeEditorPostFormFlowFollowUp | null
  postFormFlowRelease?: NocodeEditorPostFormFlowRelease | null
  formulaSummary?: NocodeEditorAiBlueprintFormulaSummary
  summary: {
    formsCreated: number
    formsReused: number
    fieldsCreated: number
    fieldsReused: number
    fieldsUpdated: number
  }
}

export type NocodeEditorAiBlueprintApplyScope = 'all' | 'group' | 'single'

export type NocodeEditorAiBlueprintApplyOptions = {
  scope?: NocodeEditorAiBlueprintApplyScope
  targetFormKeys?: string[]
  onProgress?: (payload: {
    stage: 'detected' | 'saving-previous-blueprint' | 'form-completed'
    totalFormCount?: number
    formResult?: NocodeEditorAiBlueprintApplyFormResult | null
  }) => Promise<void> | void
}

export type NocodeEditorAiDraftIssueTargetKind =
  | 'form_field'
  | 'process_node'
  | 'page'
  | 'app_setting'

export type NocodeEditorAiDraftIssueSource =
  | 'form_design_validation'
  | 'process_validation'
  | 'page_validation'
  | 'app_setting_validation'

export type NocodeEditorAiDraftIssueLocator = {
  tab?: 'form-design' | 'process-setting' | 'page-design' | 'app-setting'
  formId?: string
  formLabel?: string
  widgetId?: string
  optionPath?: string[]
  processNodeId?: string
  pageId?: string
  settingKey?: string
}

export type NocodeEditorAiDraftActionIssue = {
  id: string
  targetKind: NocodeEditorAiDraftIssueTargetKind
  targetId: string
  targetLabel: string
  groupKey: string
  groupLabel: string
  code: string
  message: string
  blockingSave: boolean
  source: NocodeEditorAiDraftIssueSource
  locator: NocodeEditorAiDraftIssueLocator
  formDesignIssue?: FormDesignValidationIssue
}

export type NocodeEditorAiDraftIssueGroup = {
  key: string
  label: string
  issues: NocodeEditorAiDraftActionIssue[]
}

export type NocodeEditorAiDraftIssueLocateResult = {
  ok: boolean
  reason?: 'unsupported_target' | 'target_not_found' | 'tab_switch_blocked' | 'runtime_unavailable'
  message?: string
}

export type NocodeEditorAiFlowIssueLocator = {
  tab?: 'process-setting'
  formId?: string
  formLabel?: string
  processNodeId?: string
}

export type NocodeEditorAiFlowActionIssue = {
  id: string
  targetKind: 'process_node'
  targetId: string
  schemeNodeKey?: string
  targetLabel: string
  groupKey: 'process_node'
  groupLabel: string
  code: string
  message: string
  fieldKey?: string
  fieldLabel?: string
  displayMessage?: string
  locator: NocodeEditorAiFlowIssueLocator
}

export type NocodeEditorAiFlowIssueState = {
  mode: 'flow_issue'
  issueCount: number
  summary: string
  actionIssues: NocodeEditorAiFlowActionIssue[]
  updatedAt: number
  resolvedAt?: number
  resolvedFormIds?: string[]
}

export type NocodeEditorAiFlowRuntimeIssueVerdict = {
  formId: string
  settled: boolean
  state: NocodeEditorAiFlowIssueState | null
}

export type NocodeEditorAiFlowIssueLocateResult = {
  ok: boolean
  reason?: 'unsupported_target' | 'target_not_found' | 'tab_switch_blocked' | 'runtime_unavailable'
  message?: string
}

export type NocodeEditorAiDraftSaveOptions = {
  persistToApp?: boolean
  skipProcessValidation?: boolean
}

export type NocodeEditorAiDraftSaveResult = {
  ok: boolean
  persistedToSession: boolean
  persistedToApp?: boolean
  hasBlockingIssues: boolean
  issues: FormDesignValidationIssue[]
  flowIssueState?: NocodeEditorAiFlowIssueState | null
  summary?: string
  error?: string
  formId?: string
  formLabel?: string
}

export type NocodeEditorAiDraftPersistenceState = {
  mode: 'clean' | 'draft_only'
  issueCount: number
  summary: string
  issues: FormDesignValidationIssue[]
  actionIssues: NocodeEditorAiDraftActionIssue[]
  updatedAt: number
  persistedToApp?: boolean
  dirty?: boolean
  resolved?: boolean
  resolvedAt?: number
  resolvedSummary?: string
  resolvedIssues?: NocodeEditorAiDraftActionIssue[]
  sourceTraceId?: string
  sourceBlueprintIdentityKey?: string
  sourceBlueprintVersionKey?: string
  sourceFormId?: string
}

export type NocodeEditorAiDraftPersistenceRefreshResult = {
  draftResult: NocodeEditorAiDraftSaveResult
  draftPersistenceState: NocodeEditorAiDraftPersistenceState | null
  draftRefreshOk: boolean
  draftRefreshError?: string
}

export type NocodeEditorAiFieldToolDraftRefreshOutput = {
  draftPersistenceState: NocodeEditorAiDraftPersistenceState | null
  draftRefreshOk: boolean
  persistenceMode?: 'draft_only'
  partialOk?: true
  draftRefreshError?: string
}

export type NocodeEditorNavigationPersistenceReason =
  | 'draft_sync_failed'
  | 'formal_save_failed'
  | 'project_save_failed'

export type NocodeEditorNavigationPersistenceIntent =
  | 'internal_switch'
  | 'exit_editor'

export type NocodeEditorNavigationPersistenceResult = {
  mode: 'saved' | 'draft_only' | 'unchanged' | 'failed'
  reason?: NocodeEditorNavigationPersistenceReason
  message?: string
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  flowIssueState?: NocodeEditorAiFlowIssueState | null
}

export type NocodeEditorAiBlueprintWorkbenchItemKind =
  | 'ai_blueprint'
  | 'current_form_snapshot'
export type NocodeEditorAiBlueprintDisplayStatus =
  | NocodeEditorAiBlueprintPhase
  | 'current_form_snapshot'
export type NocodeEditorAiAppliedBlueprintSource = 'ai-apply' | 'current-forms'

export type NocodeEditorAiAppliedBlueprintRecord = {
  recordId: string
  blueprintId: string
  itemKind: NocodeEditorAiBlueprintWorkbenchItemKind
  status: NocodeEditorAiBlueprintDisplayStatus
  phase: NocodeEditorAiBlueprintAppliedPhase | null
  source?: NocodeEditorAiAppliedBlueprintSource | string
  title?: string
  summary?: string
  sortIndex?: number
  revision?: number
  stagedAt?: number
  createdAt: number
  updatedAt: number
  appliedAt?: number
  applyResult?: NocodeEditorAiBlueprintApplyResult | null
  blueprint: NocodeEditorAiAppBlueprint
}

export type NocodeEditorAiAiBlueprintDisplayItem = {
  itemKind: 'ai_blueprint'
  id: string
  identityKey: string
  contentSignatureKey?: string
  planningScope: NocodeEditorPlanningScope
  phase: NocodeEditorAiBlueprintPhase
  status: NocodeEditorAiBlueprintPhase
  source?: NocodeEditorAiAppliedBlueprintSource | 'ai-staged' | string
  title: string
  summary?: string
  sortIndex?: number
  createdAt?: number
  updatedAt: number
  appliedAt?: number
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  traceId?: string | null
  sourcePlanningContextKey?: string | null
  applyResult: NocodeEditorAiBlueprintApplyResult | null
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  blueprint: NocodeEditorAiAppBlueprint
  applyBlueprint?: NocodeEditorAiAppBlueprint
}

export type NocodeEditorAiCurrentFormSnapshotDisplayItem = {
  itemKind: 'current_form_snapshot'
  id: string
  identityKey: string
  phase: null
  status: 'current_form_snapshot'
  source: 'current-forms'
  title: string
  summary?: string
  sortIndex?: number
  createdAt?: number
  updatedAt: number
  appliedAt?: number
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  traceId?: string | null
  sourcePlanningContextKey?: null
  applyResult: null
  draftPersistenceState: null
  blueprint: NocodeEditorAiAppBlueprint
  applyBlueprint?: NocodeEditorAiAppBlueprint
}

export type NocodeEditorAiStageBlueprintDisplayItem =
  | NocodeEditorAiAiBlueprintDisplayItem
  | NocodeEditorAiCurrentFormSnapshotDisplayItem

export type NocodeEditorAiGeneratedBlueprintPageTarget = {
  item: NocodeEditorAiStageBlueprintDisplayItem
  formKey?: string
  tableName?: string
  tab?: 'form-design' | 'process-setting'
}

export type NocodeEditorAiAppliedBlueprintSnapshot = {
  pendingIdentityKey?: string
  pendingIdentityKeys?: string[]
  title?: string
  summary?: string
  createdAt?: number
  updatedAt?: number
  sortIndex?: number
  revision?: number
  stagedAt?: number
  result: NocodeEditorAiBlueprintApplyResult
  blueprint: NocodeEditorAiAppBlueprint
}

export type NocodeEditorAiLatestConversationPayload = {
  conversationId: string
  taskId?: string
  scopeKey?: string
  source?: NocodeEditorAiTaskSeed['source'] | string
  taskSummary?: Record<string, unknown> | null
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: 'default' | 'explicit' | null
  lastActiveTime?: number
}

export type NocodeEditorAiTimelineMeta = {
  limit: number
  offset: number
  rawMessageCount: number
  returnedMessageCount: number
  hasMoreBefore: boolean
}

export type NocodeEditorAiContinuityHint = {
  kind: 'app-context-inherited' | 'summary-replaced' | 'history-windowed'
  text: string
  sourceConversationId?: string
  sourceTaskId?: string
}

export type NocodeEditorAiDoneMetadata = {
  finalContent?: string
  blocks?: unknown[]
  artifactBlocks?: unknown[]
  continuityHints?: NocodeEditorAiContinuityHint[]
  appBuilderPlanningSummary?: string
  appBuilderPlanningArtifacts?: unknown[]
  appBuilderPlanningOutline?: Record<string, unknown>
  assistantMessageId?: string
}

export type NocodeEditorAiConversationMessagesPayload = {
  messages: NocodeEditorAiThreadMessage[]
  taskSummary?: Record<string, unknown> | null
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: 'default' | 'explicit' | null
  timeline: NocodeEditorAiTimelineMeta
}

export type NocodeEditorAiStagedBlueprintState = {
  phase: 'staged'
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint | null
  applyResult: null
  draftPersistenceState: NocodeEditorAiDraftPersistenceState | null
  sourcePlanningContextKey?: string | null
}

export type NocodeEditorAiAppliedDraftBlueprintState = {
  phase: 'applied_draft'
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint | null
  applyResult: NocodeEditorAiBlueprintApplyResult
  draftPersistenceState: NocodeEditorAiDraftPersistenceState
  sourcePlanningContextKey?: string | null
}

export type NocodeEditorAiAppliedSavedBlueprintState = {
  phase: 'applied_saved'
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint | null
  applyResult: NocodeEditorAiBlueprintApplyResult
  draftPersistenceState: NocodeEditorAiDraftPersistenceState | null
  sourcePlanningContextKey?: string | null
}

export type NocodeEditorAiStagedAppBlueprint =
  | NocodeEditorAiStagedBlueprintState
  | NocodeEditorAiAppliedDraftBlueprintState
  | NocodeEditorAiAppliedSavedBlueprintState

export type NocodeEditorAiAppPlanArtifact = {
  type: string
  name: string
  executionLevel?: 'executable_now' | 'need_confirm' | 'planning_only' | string
  purpose?: string
}

export type NocodeEditorAiAppPlan = {
  id?: string
  mode: 'greenfield' | 'delta-extension' | string
  goal: string
  objects: string[]
  artifacts: NocodeEditorAiAppPlanArtifact[]
  openQuestions: string[]
  outline?: NocodeEditorAiSolutionOutline | null
  flowIntent?: NocodeEditorFlowIntentSignal | null
}

export type NocodeEditorAiApplicationStructurePreview = {
  enabled: boolean
  previewMode?: 'app-plan' | 'form-plan'
  focusFormKey?: string
  focusFormName?: string
  highlightModuleKeys?: string[]
}

export type NocodeEditorAiStagedAppPlan = {
  revision: number
  stagedAt?: number
  plan: NocodeEditorAiAppPlan | null
}

export type NocodeEditorAiStagedFormPlan = {
  revision: number
  stagedAt?: number
  outline: NocodeEditorAiSolutionOutline | null
  applicationStructurePreview?: NocodeEditorAiApplicationStructurePreview | null
  flowIntent?: NocodeEditorFlowIntentSignal | null
}

export type NocodeEditorAiFlowApplyResult = {
  ok: boolean
  startedAt: number
  finishedAt: number
  summary: {
    triggerBranchCount: number
    totalNodeCount: number
    branchCount: number
  }
  warnings: string[]
  flowIssueState?: NocodeEditorAiFlowIssueState | null
  flowUnifiedIssues?: UnifiedFlowIssue[] | null
  flowIssueRouting?: FlowIssueRoutingResult | null
}

export type NocodeEditorAiStagedFlowPlan = {
  revision: number
  stagedAt?: number
  sourceSchemeRevision?: number
  flowPlan: NocodeEditorFlowPlan | null
  applyResult?: NocodeEditorAiFlowApplyResult | null
}

export type NocodeEditorAiStagedFlowScheme = {
  revision: number
  stagedAt?: number
  scheme: NocodeEditorFlowScheme | null
  planningStatus?: NocodeEditorFlowSchemePlanningStatus
  reviewResult?: NocodeEditorFlowSchemeReviewResult | null
  flowUnifiedIssues?: UnifiedFlowIssue[] | null
  flowIssueRouting?: FlowIssueRoutingResult | null
}

export type NocodeEditorAiStagedFlowBlueprint = {
  revision: number
  stagedAt?: number
  sourceSchemeRevision?: number
  blueprint: NocodeEditorFlowBlueprint | null
  mismatchReasons?: NocodeEditorFlowBlueprintMismatchReason[] | null
  applyResult?: NocodeEditorAiFlowApplyResult | null
}

export type NocodeEditorAiArtifactBlock = {
  type: 'artifact'
  kind: NocodeEditorAiMessageArtifactKind
  planningScope?: NocodeEditorPlanningScope
  status?: NocodeEditorAiArtifactBlockStatus
  version?: string
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  flowBlueprintPreflightPhase?: string
  error?: string
  sourcePlanningContextKey?: string | null
  industrySkeletonContext?: NocodeEditorIndustrySkeletonCarryover | null
  confirmation?: NocodeEditorAiConfirmPayload | null
  flowIntent?: NocodeEditorFlowIntentSignal | null
  confirmationCardPresentation?: AiAssistantConfirmationCardPresentation | null
  app?: {
    nocodeId?: string
    name?: string
    description?: string
  } | null
  applicationStructurePreview?: NocodeEditorAiApplicationStructurePreview | null
  appPlan?: NocodeEditorAiAppPlan | null
  outline?: NocodeEditorAiSolutionOutline | null
  formPlanPresentation?: {
    moduleCount?: number
    formCount?: number
    planningItemCount?: number
    nodes?: Array<Record<string, unknown>>
  } | null
  plan?: Record<string, any> | null
  sourceContext?: Pick<NocodeEditorFormulaContextSnapshot, 'taskId' | 'taskScopeKey' | 'nocodeId' | 'formId' | 'draftRevision' | 'evidenceFingerprint' | 'capturedAt'> | null
  formulaPlan?: NocodeEditorFormulaPlan | null
  formulaPresentation?: {
    goal?: string
    planningItems?: string[]
    scope?: string
    pendingTitle?: string
    loading?: boolean
  } | null
  scheme?: NocodeEditorFlowScheme | null
  planningStatus?: NocodeEditorFlowSchemePlanningStatus
  flowUnifiedIssues?: UnifiedFlowIssue[] | null
  flowIssueRouting?: FlowIssueRoutingResult | null
  flowPlan?: NocodeEditorFlowPlan | null
  flowBlueprint?: NocodeEditorFlowBlueprint | null
  sourceSchemeRevision?: number
  mismatchReasons?: NocodeEditorFlowBlueprintMismatchReason[] | null
  flowApplyResult?: NocodeEditorAiFlowApplyResult | null
  flowIssueState?: NocodeEditorAiFlowIssueState | null
  blueprint?: NocodeEditorAiAppBlueprint | null
  phase?: NocodeEditorAiBlueprintPhase
  applyResult?: NocodeEditorAiBlueprintApplyResult | null
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
}

export type NocodeEditorAiRuntime = {
  getHostContext: () => Promise<NocodeEditorAiHostContext>
  setActiveFormulaTaskContext: (
    getter?: () => NocodeEditorAiActiveFormulaTaskContext | null | undefined,
    refresh?: () => Promise<void> | void,
  ) => void
  saveCurrentFormBeforeBlueprintApply?: () => Promise<{ ok: boolean; message?: string }>
  resetTaskContextGuard: () => void
  createForm: (input: { tableName?: string; groupName?: string }) => Promise<NocodeEditorAiCreateFormResult>
  openForm: (input: {
    tableId?: string
    tableName?: string
    tab?: 'form-design' | 'process-setting'
  }) => Promise<NocodeEditorAiOpenFormResult>
  openFormulaResultTarget: (input: NocodeEditorAiOpenFormulaResultTargetInput) => Promise<{ ok: boolean; reason?: string }>
  viewFlowPatchResult: (input: NocodeEditorAiViewFlowPatchResultInput) => Promise<NocodeEditorAiViewFlowPatchResult>
  getStagedFormPlan: () => Promise<NocodeEditorAiStagedFormPlan>
  getStagedAppPlan: () => Promise<NocodeEditorAiStagedAppPlan>
  getStagedFlowScheme: () => Promise<NocodeEditorAiStagedFlowScheme>
  getStagedFlowPlan: () => Promise<NocodeEditorAiStagedFlowPlan>
  getStagedFlowBlueprint: () => Promise<NocodeEditorAiStagedFlowBlueprint>
  getStagedAppBlueprint: () => Promise<NocodeEditorAiStagedAppBlueprint>
  restoreStagedFormPlan: (value: NocodeEditorAiStagedFormPlan | null) => Promise<NocodeEditorAiStagedFormPlan>
  restoreStagedAppPlan: (value: NocodeEditorAiStagedAppPlan | null) => Promise<NocodeEditorAiStagedAppPlan>
  restoreStagedFlowScheme: (value: NocodeEditorAiStagedFlowScheme | null) => Promise<NocodeEditorAiStagedFlowScheme>
  restoreStagedFlowPlan: (value: NocodeEditorAiStagedFlowPlan | null) => Promise<NocodeEditorAiStagedFlowPlan>
  restoreStagedFlowBlueprint: (value: NocodeEditorAiStagedFlowBlueprint | null) => Promise<NocodeEditorAiStagedFlowBlueprint>
  restoreStagedAppBlueprint: (value: NocodeEditorAiStagedAppBlueprint | null) => Promise<NocodeEditorAiStagedAppBlueprint>
  stageExcelBlueprintDraft: (input: NocodeEditorAiExcelBlueprintDraftInput) => Promise<NocodeEditorAiStagedAppBlueprint>
  applyStagedFlow: () => Promise<NocodeEditorAiFlowApplyResult>
  applyStagedAppBlueprint: (options?: NocodeEditorAiBlueprintApplyOptions) => Promise<NocodeEditorAiBlueprintApplyResult>
  applyStagedAppBlueprintAndImportExcel?: (options?: NocodeEditorAiBlueprintApplyOptions) => Promise<NocodeEditorAiBlueprintApplyResult>
  clearStagedFormPlan: () => Promise<NocodeEditorAiStagedFormPlan>
  clearStagedAppPlan: () => Promise<NocodeEditorAiStagedAppPlan>
  clearStagedFlowScheme: () => Promise<NocodeEditorAiStagedFlowScheme>
  clearStagedFlowPlan: () => Promise<NocodeEditorAiStagedFlowPlan>
  clearStagedFlowBlueprint: () => Promise<NocodeEditorAiStagedFlowBlueprint>
  clearStagedAppBlueprint: () => Promise<NocodeEditorAiStagedAppBlueprint>
  locateDraftIssue: (issue: NocodeEditorAiDraftActionIssue) => Promise<NocodeEditorAiDraftIssueLocateResult>
  locateFlowIssue: (issue: NocodeEditorAiFlowActionIssue) => Promise<NocodeEditorAiFlowIssueLocateResult>
  executeTool: (toolName: string, input?: Record<string, unknown>) => Promise<unknown>
}

export type NocodeEditorAiActiveFormulaTaskContext = {
  taskId?: string
  taskScopeKey: string
  planningScope: NocodeEditorPlanningScope
  activeFormId: string
  carriedTaskScopeKey?: string
  carriedTargetFormId?: string
  taskSummary?: Record<string, unknown> | null
}

export type NocodeEditorAiStagedFormulaPlan = {
  origin: NocodeEditorFormulaPlanOrigin
  planningScope: NocodeEditorPlanningScope
  revision: number
  stagedAt: number
  sourceContext: NocodeEditorFormulaContextSnapshot
  plan: NocodeEditorFormulaPlan
  formulaPlanFingerprint: string
}

export type NocodeEditorAiCreateFormResult = {
  ok: boolean
  reason?: string
  tableId?: string
  tableName?: string
  groupId?: string
  groupName?: string
  reusedExisting?: boolean
}

export type NocodeEditorAiOpenFormResult = {
  ok: boolean
  reason?: string
  tableId?: string
  tableName?: string
}

export type NocodeEditorAiOpenFormulaResultTargetInput = {
  tableId: string
  tableName?: string
  widgetId: string
}

export type NocodeEditorAiFormSummary = Record<string, any> & {
  tableId?: string
  tableName?: string
  widgets?: Array<Record<string, any>>
  availableWidgetTypes?: Array<{
    type?: string
    name?: string
    aliases?: string[]
  }>
}

export type NocodeEditorAiWidgetOptionChoicesResult = {
  widgetId?: string
  optionPath?: string[]
  choices?: Array<Record<string, any>>
}

export type NocodeEditorAiAddFieldsResult = {
  created?: Array<Record<string, any>>
  failed?: Array<Record<string, any>>
}

export type NocodeEditorAiViewFlowPatchResultInput = {
  formId: string
  formName?: string
  draftVersion: number
}

export type NocodeEditorAiViewFlowPatchResult = {
  ok: boolean
  reason?: string
}

export type NocodeEditorAiFlowPatchMutation = {
  mutationId: string
  result: NocodeEditorFlowPatchResult
}

export type NocodeEditorAiProjectRuntime = {
  projectChanged?: boolean
  projectData?: { name?: string } | null
  project?: { name?: string } | null
  saveProject?: (noMessage?: boolean) => Promise<boolean | void> | boolean | void
}

export type NocodeEditorAiFormRuntime = {
  getAiEditorContext?: () => Promise<Record<string, any> | null | undefined> | Record<string, any> | null | undefined
  switchAiTab?: (tab: 'form-design' | 'process-setting') => Promise<unknown> | unknown
  getAiFormSummary?: () => Promise<NocodeEditorAiFormSummary | null | undefined> | NocodeEditorAiFormSummary | null | undefined
  getAiDefaultFormulaTaskContext?: () => Promise<NocodeEditorAiTaskContext | null | undefined> | NocodeEditorAiTaskContext | null | undefined
  openAiFormulaPanel?: (input: { widgetId: string }) => Promise<Record<string, any> | null | undefined> | Record<string, any> | null | undefined
  getAiFlowSummary?: () => Promise<Record<string, any> | null | undefined> | Record<string, any> | null | undefined
  validateAiFlowPlan?: (input: { plan: NocodeEditorFlowPlan }) => Promise<Record<string, any> | null | undefined> | Record<string, any> | null | undefined
  applyAiFlowPlan?: (input: { plan: NocodeEditorFlowPlan }) => Promise<NocodeEditorAiFlowApplyResult | null | undefined> | NocodeEditorAiFlowApplyResult | null | undefined
  applyAiFlowPatch?: (input: { patch: NocodeEditorFlowPatch }) => Promise<NocodeEditorAiFlowPatchMutation | null | undefined> | NocodeEditorAiFlowPatchMutation | null | undefined
  finalizeAiFlowPatch?: (input: { mutationId: string }) => Promise<boolean> | boolean
  rollbackAiFlowPatch?: (input: { mutationId: string }) => Promise<boolean> | boolean
  viewAiFlowPatchResult?: (input: { draftVersion: number; nodeKey?: string }) => Promise<boolean> | boolean
  getAiWidgetOptionSchema?: (input: { widgetId: string }) => Promise<Record<string, any> | null | undefined> | Record<string, any> | null | undefined
  getAiWidgetOptionChoices?: (input: { widgetId: string; optionKey?: string; optionPath?: string[] }) => Promise<NocodeEditorAiWidgetOptionChoicesResult | null | undefined> | NocodeEditorAiWidgetOptionChoicesResult | null | undefined
  addAiFields?: (input: { fields: Array<Record<string, unknown>> }) => Promise<NocodeEditorAiAddFieldsResult | null | undefined> | NocodeEditorAiAddFieldsResult | null | undefined
  replaceAiField?: (input: { widgetId: string; widgetType: string; name?: string }) => Promise<unknown> | unknown
  deleteAiField?: (input: { widgetId: string }) => Promise<unknown> | unknown
  setAiFieldOptions?: (input: { widgetId: string; changes: Array<Record<string, unknown>> }) => Promise<unknown> | unknown
  save?: (noMessage?: boolean) => Promise<boolean | string> | boolean | string
  saveAiDraft?: (options?: NocodeEditorAiDraftSaveOptions) => Promise<NocodeEditorAiDraftSaveResult> | NocodeEditorAiDraftSaveResult
  refreshAiDraftPersistenceState?: () => Promise<NocodeEditorAiDraftPersistenceRefreshResult>
  persistForNavigation?: (
    intent?: NocodeEditorNavigationPersistenceIntent,
  ) => Promise<NocodeEditorNavigationPersistenceResult> | NocodeEditorNavigationPersistenceResult
  focusAiDraftIssue?: (issue: NocodeEditorAiDraftActionIssue) => Promise<NocodeEditorAiDraftIssueLocateResult> | NocodeEditorAiDraftIssueLocateResult
  focusAiFlowIssue?: (issue: NocodeEditorAiFlowActionIssue) => Promise<NocodeEditorAiFlowIssueLocateResult> | NocodeEditorAiFlowIssueLocateResult
  currentFlowIssueState?: NocodeEditorAiFlowIssueState | null
  hasLocalChanges?: boolean
  isChanged?: boolean
}

export type NocodeEditorAiHostRuntimeOptions = {
  nocodeId: string
  nocode: Ref<Nocode>
  structure?: Ref<NocodeStructure[]>
  settingVisible: Ref<boolean>
  isShowFormCreate: Ref<boolean>
  activeFormId: Ref<string>
  currentActiveId: Ref<string>
  activeProjectId: Ref<string>
  aiDraftDirty?: Ref<boolean>
  aiDraftStatus?: Ref<NocodeEditorAiDraftPersistenceState | null>
  aiDraftSourceStatus?: Ref<NocodeEditorAiDraftPersistenceState | null>
  formCreateRef: Ref<NocodeEditorAiFormRuntime | undefined>
  projectEditorRef: Ref<NocodeEditorAiProjectRuntime | undefined>
  formulaOverlayHost?: Ref<((payload: {
    formWidget: any
    value?: unknown
    componentProps?: Record<string, unknown>
    onConfirm: (value: unknown) => void
  }) => boolean) | undefined>
  formulaOverlayDraftHost?: Ref<((payload: {
    widgetId: string
    value: unknown
    tableId?: string
    tableName?: string
    fieldName?: string
    formulaPath?: 'default-formula' | 'compute-formula'
    explanation?: string
  }) => Promise<Record<string, any> | null | undefined> | Record<string, any> | null | undefined) | undefined>
  getCurrentTaskContext?: () => Promise<NocodeEditorAiTaskContext | null | undefined> | NocodeEditorAiTaskContext | null | undefined
  getActiveFormulaTaskContext?: () => NocodeEditorAiActiveFormulaTaskContext | null | undefined
  createForm: (input: { tableName?: string; groupName?: string }) => Promise<NocodeEditorAiCreateFormResult>
  showFormCreate: (table: unknown, askSave?: boolean) => Promise<boolean>
  hideFormCreate?: (showChangeTip?: boolean) => Promise<boolean>
  openProject?: (projectId: string, projectName?: string) => Promise<void>
  handleSyncConflict?: (error: unknown) => boolean
  markAiDraftDirty?: (dirty: boolean) => void
  markAiDraftStatus?: (state: NocodeEditorAiDraftPersistenceState | null) => void
}
