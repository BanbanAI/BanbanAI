import type { NocodeEditorAiConfirmPayload } from './nocodeEditorConfirmation'
import type { NocodeEditorIndustrySkeletonCarryover } from '@common/utils/nocodeEditorIndustrySkeleton'
import type { NocodeEditorPlanningScope } from '@common/utils/nocodeEditorPlanningScope'
import type { NocodeEditorAiBlueprintPhase } from '@common/utils/nocodeEditorBlueprintLifecycle'
import type {
  NocodeEditorFormulaContextSnapshot,
  NocodeEditorFormulaPlan,
} from './nocodeEditorFormula'

export type AiAssistantMarkdownBlock = {
  type: 'markdown'
  text: string
}

export const AI_ASSISTANT_SUPPORTING_KPI_KEYS = ['matchedRecords', 'groupCount'] as const

export type AiAssistantSupportingKpiKey = typeof AI_ASSISTANT_SUPPORTING_KPI_KEYS[number]

export type AiAssistantSupportingKpiSemanticType =
  | 'record_count'
  | 'dimension_value_count'
  | 'time_bucket_count'
  | 'group_combination_count'

export type AiAssistantSupportingTimeGranularity =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'

export type AiAssistantSupportingKpi = {
  key: AiAssistantSupportingKpiKey
  value: string
  semanticType?: AiAssistantSupportingKpiSemanticType
  businessObjectLabel?: string
  dimensionLabel?: string
  timeGranularity?: AiAssistantSupportingTimeGranularity
  combinationLabels?: string[]
}

export type AiAssistantSupportingData = {
  kpis: AiAssistantSupportingKpi[]
}

export type AiAssistantAnalysisConclusion = {
  items: string[]
  supportingData?: AiAssistantSupportingData
}

export type AiCrossAppPresentationMetadata = {
  status: 'fully_comparable' | 'partially_comparable' | 'unresolved'
  limitationReasons?: string[]
  scopeLabels?: {
    apps?: string[]
    sources?: string[]
  }
  alignmentSummary?: {
    metrics?: string[]
    groups?: string[]
    grain?: string | null
  }
  transition?: 'inherit' | 'narrow' | 'expand' | 'invalidate'
}

export type AiAssistantPrimaryViewKey = 'chart' | 'table'

export type AiAssistantPrimaryViewItem = {
  key: AiAssistantPrimaryViewKey
  enabled: boolean
  disabledReason?: string
}

export type AiAssistantPrimaryViews = {
  defaultKey: AiAssistantPrimaryViewKey
  items: AiAssistantPrimaryViewItem[]
}

export type AiAssistantArtifactBlockStatus = 'loading' | 'ready' | 'error'

export type AiAssistantAppPlanArtifact = {
  type: string
  name: string
  executionLevel?: string
  purpose?: string
}

export type AiAssistantApplicationStructurePreview = {
  enabled: boolean
  previewMode?: 'app-plan' | 'form-plan' | string
  focusFormKey?: string
  focusFormName?: string
  highlightModuleKeys?: string[]
  metadata?: Record<string, any> | null
}

export type AiAssistantConfirmationCardPresentation = {
  goal?: string
  coreObjects?: string[]
  planningItems?: string[]
  scope?: string
  nextSteps?: string[]
  aiHandling?: string
  pendingTitle?: string
}

export type AiAssistantNocodeAppArtifactBlock = {
  type: 'artifact'
  kind: 'nocode-app'
  status?: AiAssistantArtifactBlockStatus
  title?: string
  summary?: string
  message?: string
  error?: string
  app?: {
    nocodeId?: string
    name?: string
    description?: string
  } | null
}

export type AiAssistantAppPlanArtifactBlock = {
  type: 'artifact'
  kind: 'app-plan'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  industrySkeletonContext?: NocodeEditorIndustrySkeletonCarryover | null
  confirmation?: NocodeEditorAiConfirmPayload | null
  confirmationCardPresentation?: AiAssistantConfirmationCardPresentation | null
  applicationStructurePreview?: AiAssistantApplicationStructurePreview | null
  appPlan?: {
    id?: string
    mode?: string
    goal?: string
    objects?: string[]
    artifacts?: AiAssistantAppPlanArtifact[]
    openQuestions?: string[]
    confirmation?: NocodeEditorAiConfirmPayload | null
    outline?: Record<string, any> | null
  } | null
}

export type AiAssistantFormPlanArtifactBlock = {
  type: 'artifact'
  kind: 'form-plan'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  formPlanPresentation?: {
    moduleCount?: number
    formCount?: number
    planningItemCount?: number
    nodes?: Array<Record<string, any>>
  } | null
  industrySkeletonContext?: NocodeEditorIndustrySkeletonCarryover | null
  confirmation?: NocodeEditorAiConfirmPayload | null
  confirmationCardPresentation?: AiAssistantConfirmationCardPresentation | null
  applicationStructurePreview?: AiAssistantApplicationStructurePreview | null
  outline?: Record<string, any> | null
}

export type AiAssistantContentPlanArtifactBlock = {
  type: 'artifact'
  kind: 'content-plan'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  confirmation?: NocodeEditorAiConfirmPayload | null
  plan?: Record<string, any> | null
}

export type AiAssistantFormulaPlanSourceContext = Pick<
  NocodeEditorFormulaContextSnapshot,
  'taskId' | 'taskScopeKey' | 'nocodeId' | 'formId' | 'draftRevision' | 'evidenceFingerprint' | 'capturedAt'
>

export type AiAssistantFormulaPlanPresentation = {
  goal?: string
  planningItems?: string[]
  scope?: string
  pendingTitle?: string
  loading?: boolean
}

export type AiAssistantFormulaPlanArtifactBlock = {
  type: 'artifact'
  kind: 'formula-plan'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  planningScope?: NocodeEditorPlanningScope
  sourceContext?: AiAssistantFormulaPlanSourceContext | null
  confirmation?: NocodeEditorAiConfirmPayload | null
  confirmationCardPresentation?: AiAssistantConfirmationCardPresentation | null
  formulaPlan?: NocodeEditorFormulaPlan | null
  formulaPresentation?: AiAssistantFormulaPlanPresentation | null
}

export type AiAssistantFlowSchemeArtifactBlock = {
  type: 'artifact'
  kind: 'flow-scheme'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  confirmation?: NocodeEditorAiConfirmPayload | null
  scheme?: Record<string, any> | null
  planningStatus?: 'needs_confirmation' | 'ready_for_review'
}

export type AiAssistantFlowPlanArtifactBlock = {
  type: 'artifact'
  kind: 'flow-plan'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  revision?: number
  stagedAt?: number
  sourceSchemeRevision?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  confirmation?: NocodeEditorAiConfirmPayload | null
  flowPlan?: Record<string, any> | null
  flowApplyResult?: Record<string, any> | null
}

export type AiAssistantBlueprintArtifactBlock = {
  type: 'artifact'
  kind: 'blueprint'
  status?: AiAssistantArtifactBlockStatus
  version?: string
  displayRevision?: number
  displayVersionLabel?: string
  revision?: number
  stagedAt?: number
  title?: string
  summary?: string
  message?: string
  error?: string
  industrySkeletonContext?: NocodeEditorIndustrySkeletonCarryover | null
  sourcePlanningContextKey?: string | null
  planningScope?: NocodeEditorPlanningScope
  confirmation?: NocodeEditorAiConfirmPayload | null
  confirmationCardPresentation?: AiAssistantConfirmationCardPresentation | null
  blueprint?: Record<string, any> | null
  phase?: NocodeEditorAiBlueprintPhase
  applyResult?: Record<string, any> | null
  draftPersistenceState?: Record<string, any> | null
}

export type AiAssistantArtifactBlock =
  | AiAssistantNocodeAppArtifactBlock
  | AiAssistantAppPlanArtifactBlock
  | AiAssistantFormPlanArtifactBlock
  | AiAssistantContentPlanArtifactBlock
  | AiAssistantFormulaPlanArtifactBlock
  | AiAssistantFlowSchemeArtifactBlock
  | AiAssistantFlowPlanArtifactBlock
  | AiAssistantBlueprintArtifactBlock

export type AiAssistantChartBlock = {
  type: 'chart'
  lib: 'echarts'
  title?: string
  height?: number
  minWidth?: number
  fallbackText?: string
  option: Record<string, any>
  analysisConclusion?: AiAssistantAnalysisConclusion
  dataTable?: AiAssistantTableViewVariant
  primaryViews?: AiAssistantPrimaryViews
  presentation?: AiCrossAppPresentationMetadata
}

export type AiAssistantTableColumn = {
  key: string
  label: string
  role?: 'dimension' | 'metric' | 'text'
  align?: 'left' | 'center' | 'right'
}

export type AiAssistantTableMergeRule = {
  columns: string[]
  groupBy: string[]
}

export type AiAssistantTableViewVariant = {
  key: string
  label?: string
  title?: string
  columns: AiAssistantTableColumn[]
  rows: Array<Record<string, string | number | null>>
  merge?: AiAssistantTableMergeRule
}

export type AiAssistantTableViews = {
  defaultKey: string
  items: AiAssistantTableViewVariant[]
}

export type AiAssistantTableBlock = {
  type: 'table'
  title?: string
  columns: AiAssistantTableColumn[]
  rows: Array<Record<string, string | number | null>>
  merge?: AiAssistantTableMergeRule
  analysisConclusion?: AiAssistantAnalysisConclusion
  views?: AiAssistantTableViews
  primaryViews?: AiAssistantPrimaryViews
  presentation?: AiCrossAppPresentationMetadata
}

export type AiAssistantFormulaResultItem = {
  tableId: string
  tableName?: string
  widgetId: string
  fieldName: string
  formula: string
  displayFormula?: string
  formulaPath?: 'default-formula' | 'compute-formula'
  explanation?: string
}

export type AiAssistantFormulaTargetResultItem =
  | (AiAssistantFormulaResultItem & {
    status: 'updated'
  })
  | (AiAssistantFormulaResultItem & {
    status: 'draft'
    draftOnly?: true
    overlayDraft?: true
  })
  | (AiAssistantFormulaResultItem & {
    status: 'failed'
    reason: string
  })
  | {
    status: 'skipped'
    tableId?: string
    tableName?: string
    widgetId?: string
    fieldName: string
    reason: string
  }

export type AiAssistantFormulaResultBlock = {
  type: 'formula-result'
  title?: string
  items: AiAssistantFormulaResultItem[]
}

export type AiAssistantFlowPatchResultBlock = {
  type: 'flow-patch-result'
  formId: string
  formName?: string
  sourceVersion: number
  draftVersion: number
  createdDraftVersion: boolean
  activeVersion?: number
  activeVersionUnchanged: boolean
  operations: Array<{
    op: 'add' | 'update' | 'remove' | 'move'
    nodeKey?: string
    tempKey?: string
    nodeName?: string
  }>
  warnings?: string[]
}

export type AiAssistantMessageBlock =
  | AiAssistantMarkdownBlock
  | AiAssistantArtifactBlock
  | AiAssistantChartBlock
  | AiAssistantTableBlock
  | AiAssistantFormulaResultBlock
  | AiAssistantFlowPatchResultBlock

export type AiAssistantChartPayload = {
  title?: string
  height?: number
  minWidth?: number
  fallbackText?: string
  option?: Record<string, any>
  analysisConclusion?: AiAssistantAnalysisConclusion
  dataTable?: AiAssistantTableViewVariant
  primaryViews?: AiAssistantPrimaryViews
  presentation?: AiCrossAppPresentationMetadata
}

export type AiAssistantChartHintPayload = {
  type?: 'line' | 'bar' | 'horizontal-bar' | 'donut' | 'scatter'
  title?: string
}
