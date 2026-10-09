import type {
  NocodeEditorFormulaContextSnapshot,
  NocodeEditorFormulaApplyCheckpoint,
  NocodeEditorFormulaEvidenceField,
  NocodeEditorFormulaFormEvidence,
  NocodeEditorFormulaPath,
  NocodeEditorFormulaPlan,
  NocodeEditorFormulaPlanDisplayMode,
  NocodeEditorFormulaPlanItem,
  NocodeEditorFormulaSpec,
  NocodeEditorResolvedFormulaWrite,
  NocodeEditorFormulaTarget,
} from '@common/types/nocodeEditorFormula'
import { normalizeNocodeEditorConfirmationPayload } from './nocodeEditorConfirmationNormalization'
import type { NocodeEditorPlanningScope } from './nocodeEditorPlanningScope'

const FORMULA_PATHS = new Set<NocodeEditorFormulaPath>([
  'default-formula',
  'compute-formula',
])

const EXECUTION_INTENTS = new Set<NocodeEditorFormulaPlan['executionIntent']>([
  'plan_only',
  'plan_and_apply',
])

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
)

const normalizeOptionalText = (value: unknown): string | undefined => {
  const normalized = normalizeText(value)
  return normalized || undefined
}

const normalizeDraftRevision = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
)

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const normalizeFormulaPath = (value: unknown): NocodeEditorFormulaPath | null => {
  const formulaPath = normalizeText(value) as NocodeEditorFormulaPath
  return FORMULA_PATHS.has(formulaPath) ? formulaPath : null
}

const normalizeNocodeEditorFormulaTarget = (
  value: unknown,
): NocodeEditorFormulaTarget | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const fieldName = normalizeText(value.fieldName)
  if (!fieldName) {
    return null
  }

  return {
    ...(normalizeOptionalText(value.formKey) ? { formKey: normalizeOptionalText(value.formKey) } : {}),
    ...(normalizeOptionalText(value.formName) ? { formName: normalizeOptionalText(value.formName) } : {}),
    ...(normalizeOptionalText(value.fieldKey) ? { fieldKey: normalizeOptionalText(value.fieldKey) } : {}),
    fieldName,
  }
}

export const normalizeNocodeEditorFormulaSpecList = (
  value: unknown,
): NocodeEditorFormulaSpec[] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const formulaSettings: NocodeEditorFormulaSpec[] = []
  const formulaPaths = new Set<NocodeEditorFormulaPath>()

  for (const item of value) {
    if (!isPlainObject(item)) {
      return null
    }

    const formulaPath = normalizeFormulaPath(item.formulaPath)
    const formula = typeof item.formula === 'string'
      ? item.formula
      : ''
    if (!formulaPath || !formula.trim() || formulaPaths.has(formulaPath)) {
      return null
    }

    formulaPaths.add(formulaPath)
    const explanation = normalizeOptionalText(item.explanation)
    formulaSettings.push({
      formulaPath,
      formula,
      ...(explanation ? { explanation } : {}),
    })
  }

  return formulaSettings
}

const normalizeNocodeEditorFormulaPlanItem = (
  value: unknown,
): NocodeEditorFormulaPlanItem | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const itemKey = normalizeText(value.itemKey)
  const target = normalizeNocodeEditorFormulaTarget(value.target)
  const formulaSettings = normalizeNocodeEditorFormulaSpecList(value.formulaSettings)
  if (!itemKey || !target || !formulaSettings?.length) {
    return null
  }

  return { itemKey, target, formulaSettings }
}

export const normalizeNocodeEditorFormulaPlan = (
  value: unknown,
): NocodeEditorFormulaPlan | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const title = normalizeText(value.title)
  const summary = normalizeText(value.summary)
  const executionIntent = normalizeText(value.executionIntent) as NocodeEditorFormulaPlan['executionIntent']
  if (!title || !summary || !EXECUTION_INTENTS.has(executionIntent)) {
    return null
  }

  if (!Array.isArray(value.items) || !Array.isArray(value.openQuestions)) {
    return null
  }
  if (!value.openQuestions.every(item => typeof item === 'string')) {
    return null
  }

  const itemKeys = new Set<string>()
  const items: NocodeEditorFormulaPlanItem[] = []
  for (const item of value.items) {
    const normalizedItem = normalizeNocodeEditorFormulaPlanItem(item)
    if (!normalizedItem || itemKeys.has(normalizedItem.itemKey)) {
      return null
    }
    itemKeys.add(normalizedItem.itemKey)
    items.push(normalizedItem)
  }

  const openQuestions = value.openQuestions
    .map(normalizeText)
    .filter(Boolean)
  const confirmation = value.confirmation === undefined
    ? undefined
    : normalizeNocodeEditorConfirmationPayload({
      stage: 'form-plan',
      confirmation: value.confirmation,
      openQuestions,
      summary,
    })

  return {
    title,
    summary,
    executionIntent,
    items,
    openQuestions,
    ...(
      confirmation !== undefined
        ? { confirmation }
        : {}
    ),
  }
}

export const resolveNocodeEditorFormulaPlanDisplayMode = (
  plan?: NocodeEditorFormulaPlan | null,
): NocodeEditorFormulaPlanDisplayMode => {
  if (!plan) return 'status'
  if (plan.openQuestions.length > 0) return 'decision'
  if (plan.executionIntent === 'plan_only') return 'summary'
  return 'hidden'
}

export type NocodeEditorFormulaAdvance =
  | 'blocked'
  | 'await_user'
  | 'show_summary'
  | 'continue_apply'

export const resolveNocodeEditorFormulaAdvance = (input: {
  plan?: NocodeEditorFormulaPlan | null
}): NocodeEditorFormulaAdvance => {
  const plan = input?.plan
  if (!plan) return 'blocked'
  if (plan.openQuestions.length) return 'await_user'
  if (plan.executionIntent === 'plan_only') return 'show_summary'
  return 'continue_apply'
}

export const resolveNocodeEditorFormulaPlanningScope = (input: {
  origin: 'standalone' | 'blueprint'
  carriedPlanningScope?: NocodeEditorPlanningScope | null
  sameTaskScope?: boolean
  sameTargetForm?: boolean
}): NocodeEditorPlanningScope => {
  if (input.origin === 'blueprint') {
    return input.carriedPlanningScope === 'app' || input.carriedPlanningScope === 'form'
      ? input.carriedPlanningScope
      : 'unknown'
  }

  return input.carriedPlanningScope === 'form'
    && input.sameTaskScope === true
    && input.sameTargetForm === true
    ? 'form'
    : 'local'
}

const FORMULA_STAGE_GUARDED_TOOL_NAMES = new Set([
  'editor_create_form',
  'editor_add_fields',
  'editor_delete_field',
  'editor_replace_field',
  'editor_bind_field_source',
  'editor_set_field_options',
  'editor_set_enum_options',
  'editor_patch_flow',
  'editor_apply_staged_flow',
  'editor_apply_staged_app_blueprint',
  'editor_set_field_formulas',
])

export type NocodeEditorFormulaStageBatchAction =
  | 'allow'
  | 'block_duplicate_stage'
  | 'block_duplicate_executor'
  | 'block_stage_mutation'
  | 'block_gate_mutation'
  | 'consume_formula_executor'

export const resolveNocodeEditorFormulaStageBatchAction = (input: {
  hasFormulaStage: boolean
  toolName?: string
  formulaStageAccepted: boolean
  formulaStageGateReady?: boolean
  formulaStageOpenedThisBatch?: boolean
  formulaExecutorConsumedThisBatch?: boolean
  isMutatingEditorTool?: boolean
}): NocodeEditorFormulaStageBatchAction => {
  const toolName = normalizeText(input.toolName)
  const isMutatingEditorTool = input.isMutatingEditorTool === true
    || FORMULA_STAGE_GUARDED_TOOL_NAMES.has(toolName)
  if (
    input.formulaStageOpenedThisBatch
    && toolName === 'editor_set_field_formulas'
  ) {
    return 'block_stage_mutation'
  }
  if (
    input.formulaExecutorConsumedThisBatch
    && toolName === 'editor_set_field_formulas'
  ) {
    return 'block_duplicate_executor'
  }
  if (input.formulaStageGateReady) {
    if (toolName === 'editor_set_field_formulas') {
      return 'consume_formula_executor'
    }
    if (isMutatingEditorTool) {
      return 'block_gate_mutation'
    }
  }
  if (toolName === 'editor_stage_formula_plan') {
    return input.formulaStageAccepted ? 'block_duplicate_stage' : 'allow'
  }
  if (input.hasFormulaStage && isMutatingEditorTool) {
    return 'block_stage_mutation'
  }
  return 'allow'
}

export const buildNocodeEditorFormulaTargetFingerprint = (
  item: NocodeEditorFormulaPlanItem,
  setting: NocodeEditorFormulaSpec,
) => stableSerialize({
  itemKey: item.itemKey,
  target: item.target,
  formulaPath: setting.formulaPath,
  formula: setting.formula,
})

export const buildNocodeEditorFormulaCheckpointTargetKey = (input: {
  itemKey: string
  formulaPath: NocodeEditorFormulaPath
}) => `${input.itemKey}:${input.formulaPath}`

export const canReuseCheckpointTarget = (input: {
  checkpoint?: NocodeEditorFormulaApplyCheckpoint | null
  plan: NocodeEditorFormulaPlan
  contextFingerprint: string
  item: NocodeEditorFormulaPlanItem
  setting: NocodeEditorFormulaSpec
  resolvedWrite: NocodeEditorResolvedFormulaWrite
  currentRuntimeFormula?: string | null
}): boolean => {
  const checkpoint = input.checkpoint
  const contextFingerprint = normalizeText(input.contextFingerprint)
  const currentRuntimeFormula = normalizeText(input.currentRuntimeFormula)
  if (!checkpoint || !contextFingerprint || !currentRuntimeFormula) {
    return false
  }
  if (
    checkpoint.planFingerprint !== buildNocodeEditorFormulaPlanFingerprint(input.plan)
    || checkpoint.contextFingerprint !== contextFingerprint
  ) {
    return false
  }

  const target = checkpoint.targets[buildNocodeEditorFormulaCheckpointTargetKey({
    itemKey: input.resolvedWrite.itemKey,
    formulaPath: input.resolvedWrite.formulaPath,
  })]
  return (
    target?.status === 'updated'
    && target.targetFingerprint === buildNocodeEditorFormulaTargetFingerprint(input.item, input.setting)
    && normalizeText(input.resolvedWrite.formula) === currentRuntimeFormula
  )
}

export const buildNocodeEditorFormulaPlanFingerprint = (
  plan: NocodeEditorFormulaPlan,
) => stableSerialize({
  executionIntent: plan.executionIntent,
  items: [...plan.items]
    .sort((left, right) => left.itemKey.localeCompare(right.itemKey))
    .flatMap(item => [...item.formulaSettings]
      .sort((left, right) => left.formulaPath.localeCompare(right.formulaPath))
      .map(setting => buildNocodeEditorFormulaTargetFingerprint(item, setting))),
})

const normalizeFormulaEvidenceField = (
  value: unknown,
): NocodeEditorFormulaEvidenceField | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const widgetId = normalizeText(value.widgetId)
  if (!widgetId) {
    return null
  }

  const formulaPaths = Array.isArray(value.formulaPaths)
    ? value.formulaPaths
      .map(normalizeFormulaPath)
      .filter((formulaPath): formulaPath is NocodeEditorFormulaPath => Boolean(formulaPath))
      .sort((left, right) => left.localeCompare(right))
    : undefined

  return {
    widgetId,
    ...(normalizeOptionalText(value.fieldKey) ? { fieldKey: normalizeOptionalText(value.fieldKey) } : {}),
    ...(normalizeOptionalText(value.fieldName) ? { fieldName: normalizeOptionalText(value.fieldName) } : {}),
    ...(normalizeOptionalText(value.title) ? { title: normalizeOptionalText(value.title) } : {}),
    ...(normalizeOptionalText(value.valueType) ? { valueType: normalizeOptionalText(value.valueType) } : {}),
    ...(normalizeOptionalText(value.widgetType) ? { widgetType: normalizeOptionalText(value.widgetType) } : {}),
    ...(formulaPaths ? { formulaPaths } : {}),
  }
}

const normalizeFormulaEvidence = (value: unknown): NocodeEditorFormulaFormEvidence => {
  if (!isPlainObject(value)) {
    return {}
  }

  const fields = Array.isArray(value.fields)
    ? value.fields
      .map(normalizeFormulaEvidenceField)
      .filter((field): field is NocodeEditorFormulaEvidenceField => Boolean(field))
      .sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right)))
    : []

  return {
    ...(normalizeOptionalText(value.formId) ? { formId: normalizeOptionalText(value.formId) } : {}),
    fields,
  }
}

export const buildNocodeEditorFormulaEvidenceFingerprint = (
  formSummary: unknown,
) => stableSerialize(normalizeFormulaEvidence(formSummary))

export const buildNocodeEditorFormulaContextFingerprint = (
  snapshot: NocodeEditorFormulaContextSnapshot,
) => {
  const draftRevision = normalizeDraftRevision(snapshot?.draftRevision)

  return stableSerialize({
    taskId: normalizeText(snapshot?.taskId),
    taskScopeKey: normalizeText(snapshot?.taskScopeKey),
    nocodeId: normalizeText(snapshot?.nocodeId),
    formId: normalizeText(snapshot?.formId),
    ...(draftRevision === undefined ? {} : { draftRevision }),
    evidenceFingerprint: normalizeText(snapshot?.evidenceFingerprint),
  })
}

export const isNocodeEditorFormulaContextSnapshotFresh = (input: {
  snapshot?: NocodeEditorFormulaContextSnapshot | null
  taskId?: string
  taskScopeKey?: string
  nocodeId?: string
  formId?: string
  draftRevision?: number
  evidenceFingerprint?: string
}): boolean => {
  const snapshot = input?.snapshot
  if (!snapshot) {
    return false
  }

  const requiredValues = [
    snapshot.taskId,
    snapshot.taskScopeKey,
    snapshot.nocodeId,
    snapshot.formId,
    snapshot.evidenceFingerprint,
    input.taskId,
    input.taskScopeKey,
    input.nocodeId,
    input.formId,
    input.evidenceFingerprint,
  ]
  if (!requiredValues.every(value => typeof value === 'string' && Boolean(value.trim()))) {
    return false
  }

  if (
    snapshot.taskId !== input.taskId
    ||
    snapshot.taskScopeKey !== input.taskScopeKey
    || snapshot.nocodeId !== input.nocodeId
    || snapshot.formId !== input.formId
    || snapshot.evidenceFingerprint !== input.evidenceFingerprint
  ) {
    return false
  }

  const snapshotDraftRevision = normalizeDraftRevision(snapshot.draftRevision)
  const draftRevision = normalizeDraftRevision(input.draftRevision)
  return snapshotDraftRevision !== undefined
    && draftRevision !== undefined
    && snapshotDraftRevision === draftRevision
}

export const resolveFormulaContextRefreshAction = (input: {
  snapshot?: NocodeEditorFormulaContextSnapshot | null
  taskId?: string
  taskScopeKey?: string
  nocodeId?: string
  formId?: string
  draftRevision?: number
  evidenceFingerprint?: string
}): 'continue' | 'refresh_required' => (
  isNocodeEditorFormulaContextSnapshotFresh(input)
    ? 'continue'
    : 'refresh_required'
)
