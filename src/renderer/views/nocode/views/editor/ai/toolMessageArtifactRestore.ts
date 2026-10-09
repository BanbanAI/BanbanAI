import type {
  AiAssistantAppPlanArtifactBlock,
  AiAssistantArtifactBlock,
  AiAssistantBlueprintArtifactBlock,
} from '@common/types/ai'
import {
  normalizeNocodeEditorFormulaPlan,
} from '@common/utils/nocodeEditorFormulaDomain'
import {
  normalizeNocodeEditorConfirmationPayload,
} from '@common/utils/nocodeEditorConfirmationNormalization'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'
import {
  normalizeNocodeEditorPlanningScopeValue,
} from '@common/utils/nocodeEditorPostFormFlowScope'
import {
  buildSharedAppPlanConfirmationCardPresentation,
  buildSharedApplicationStructurePreview,
  buildSharedFormPlanConfirmationCardPresentation,
} from '@common/utils/nocodeEditorConfirmationCardPresentation'
import {
  resolveSingleFormPlanningDisplayTitle,
} from '@common/utils/nocodeEditorPlanningTitle'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  buildNocodeEditorAiSolutionPresentation,
} from '@renderer/views/nocode/components/ai/solutionArtifactPresentation'
import {
  normalizeNocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  projectBlueprintConfirmation,
} from '@common/utils/nocodeEditorBlueprintConfirmationProjection'
import i18next from 'i18next'

type ToolHistoryMessageLike = {
  role?: unknown
  content?: unknown
  metadata?: Record<string, unknown> | null
}

type PersistedToolPayload = {
  name: string
  ok: boolean
  output: Record<string, any> | null
}

const isRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNumber = (value: unknown) => {
  const nextValue = Number(value || 0)
  return nextValue > 0 ? nextValue : undefined
}

const hasOwnProperty = (value: Record<string, any>, key: string) => (
  Object.prototype.hasOwnProperty.call(value, key)
)

const getOutputDraftPersistenceState = (output: Record<string, any>) => (
  hasOwnProperty(output, 'draftPersistenceState')
    ? output.draftPersistenceState
    : undefined
)

const isResolvedDraftPersistenceState = (value: unknown) => (
  isRecord(value) && value.resolved === true
)

const mergeDraftPersistenceState = (metadataState: unknown, outputState: unknown) => {
  if (outputState === undefined) {
    return metadataState
  }
  if (metadataState === undefined || metadataState === null) {
    return outputState
  }
  if (outputState === null) {
    return metadataState
  }
  if (isResolvedDraftPersistenceState(outputState) && !isResolvedDraftPersistenceState(metadataState)) {
    return outputState
  }
  if (isResolvedDraftPersistenceState(metadataState) && !isResolvedDraftPersistenceState(outputState)) {
    return metadataState
  }
  if (isRecord(metadataState) && isRecord(outputState)) {
    return {
      ...metadataState,
      ...outputState,
    }
  }
  return outputState
}

const parsePersistedToolPayload = (
  message: ToolHistoryMessageLike,
): PersistedToolPayload | null => {
  if (normalizeText(message.role).toLowerCase() !== 'tool') {
    return null
  }

  if (Boolean(message.metadata?.hiddenFromTimeline)) {
    return null
  }

  const content = normalizeText(message.content)
  if (!content) {
    return null
  }

  try {
    const parsed = JSON.parse(content)
    if (!isRecord(parsed)) {
      return null
    }

    return {
      name: normalizeText(parsed.name),
      ok: parsed.ok === true,
      output: isRecord(parsed.output) ? parsed.output : null,
    }
  } catch {
    return null
  }
}

const buildAppPlanArtifactBlockFromOutput = (
  output: Record<string, any>,
): AiAssistantAppPlanArtifactBlock | null => {
  const plan = isRecord(output.plan) ? output.plan : null
  if (!plan) {
    return null
  }
  const rawOutline = isRecord(plan.outline) ? plan.outline : {}
  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'app-plan',
    structuredConfirmation: rawOutline.confirmation,
    legacyConfirmation: plan.confirmation,
    legacyOpenQuestions: [
      ...(Array.isArray(plan.openQuestions) ? plan.openQuestions : Array.isArray(plan.open_questions) ? plan.open_questions : []),
      ...(Array.isArray(rawOutline.openQuestions) ? rawOutline.openQuestions : []),
    ],
    summary: normalizeText(plan.goal || rawOutline.summary) || undefined,
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

  return {
    type: 'artifact',
    kind: 'app-plan',
    status: 'ready',
    revision: normalizeNumber(output.revision),
    stagedAt: normalizeNumber(output.stagedAt),
    title: normalizeText(plan.goal) || i18next.t('toolMessageArtifactRestore.appPlan'),
    summary: normalizeText(plan.goal) || undefined,
    confirmation: projection.confirmation || undefined,
    confirmationCardPresentation: buildSharedAppPlanConfirmationCardPresentation({
      summary: normalizeText(plan.goal),
      goal: normalizeText(plan.goal),
      mode: plan.mode,
      objects: plan.objects,
      artifacts: plan.artifacts,
      openQuestions: projection.openQuestions,
      confirmation: projection.confirmation,
    }) || undefined,
    applicationStructurePreview: buildSharedApplicationStructurePreview({
      previewMode: 'app-plan',
      outline: canonicalOutline,
    }) || undefined,
    appPlan: canonicalPlan as AiAssistantAppPlanArtifactBlock['appPlan'],
  }
}

const buildFormPlanArtifactBlockFromOutput = (
  output: Record<string, any>,
): AiAssistantArtifactBlock | null => {
  const outline = normalizeNocodeEditorPlanningOutline(output.outline, {
    confirmationStage: 'form-plan',
    legacyConfirmation: output.confirmation,
    legacyOpenQuestions: output.openQuestions,
  })
  if (!outline) {
    return null
  }

  const formPlanPresentation = buildNocodeEditorAiSolutionPresentation(
    outline as any,
    [],
  )

  return {
    type: 'artifact',
    kind: 'form-plan',
    status: 'ready',
    revision: normalizeNumber(output.revision),
    stagedAt: normalizeNumber(output.stagedAt),
    title: resolveSingleFormPlanningDisplayTitle({
      outline: outline as any,
    }),
    summary: normalizeText(outline.summary) || undefined,
    outline,
    formPlanPresentation,
    confirmation: outline.confirmation || undefined,
    confirmationCardPresentation: buildSharedFormPlanConfirmationCardPresentation({
      outline: outline as any,
      solutionPresentation: formPlanPresentation,
    }) || undefined,
    applicationStructurePreview: buildSharedApplicationStructurePreview({
      previewMode: 'form-plan',
      outline,
      presentation: formPlanPresentation as any,
    }) || undefined,
  }
}

const normalizeFormulaPlanSourceContext = (value: unknown) => {
  if (!isRecord(value)) {
    return null
  }

  const taskScopeKey = normalizeText(value.taskScopeKey)
  const taskId = normalizeText(value.taskId)
  const nocodeId = normalizeText(value.nocodeId)
  const formId = normalizeText(value.formId)
  const evidenceFingerprint = normalizeText(value.evidenceFingerprint)
  const capturedAt = normalizeNumber(value.capturedAt)
  if (!taskScopeKey || !nocodeId || !formId || !evidenceFingerprint || !capturedAt) {
    return null
  }

  const draftRevision = normalizeNumber(value.draftRevision)
  return {
    ...(taskId ? { taskId } : {}),
    taskScopeKey,
    nocodeId,
    formId,
    ...(draftRevision ? { draftRevision } : {}),
    evidenceFingerprint,
    capturedAt,
  }
}

const buildFormulaPlanArtifactBlockFromOutput = (
  output: Record<string, any>,
): AiAssistantArtifactBlock | null => {
  const plan = normalizeNocodeEditorFormulaPlan(output.plan)
  const sourceContext = normalizeFormulaPlanSourceContext(output.sourceContext)
  if (!plan || !sourceContext) {
    return null
  }

  const confirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'form-plan',
    confirmation: output.confirmation || plan.confirmation,
    openQuestions: plan.openQuestions,
    summary: plan.summary,
  })
  const formulaPlan = {
    ...plan,
    ...(confirmation ? { confirmation } : {}),
  }

  return {
    type: 'artifact',
    kind: 'formula-plan',
    status: 'ready',
    version: [normalizeNumber(output.revision), normalizeNumber(output.stagedAt)].filter(Boolean).join(':') || undefined,
    revision: normalizeNumber(output.revision),
    stagedAt: normalizeNumber(output.stagedAt),
    planningScope: normalizeText(output.planningScope) || undefined,
    title: formulaPlan.title,
    summary: formulaPlan.summary,
    sourceContext,
    confirmation: confirmation || undefined,
    formulaPlan,
  } as AiAssistantArtifactBlock
}

const buildFlowSchemeArtifactBlockFromOutput = (
  output: Record<string, unknown>,
): AiAssistantArtifactBlock | null => {
  const rawScheme = isRecord(output.scheme) ? output.scheme : null
  const scheme = normalizeNocodeEditorFlowScheme(rawScheme)
  if (!scheme) {
    return null
  }

  const planningStatus = (
    output.planningStatus === 'needs_confirmation'
    || output.planningStatus === 'ready_for_review'
  )
    ? output.planningStatus
    : undefined

  return {
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'ready',
    revision: normalizeNumber(output.revision),
    stagedAt: normalizeNumber(output.stagedAt),
    title: scheme.title,
    summary: scheme.summary,
    confirmation: normalizeNocodeEditorConfirmationPayload({
      stage: 'flow-scheme',
      confirmation: rawScheme?.confirmation || scheme.confirmation,
      openQuestions: scheme.openQuestions,
      summary: scheme.summary,
    }) || undefined,
    scheme,
    planningStatus,
    reviewResult: output.reviewResult === null
      ? null
      : isRecord(output.reviewResult)
        ? output.reviewResult
        : undefined,
    flowUnifiedIssues: output.flowUnifiedIssues === null
      ? null
      : Array.isArray(output.flowUnifiedIssues)
        ? output.flowUnifiedIssues
        : undefined,
    flowIssueRouting: output.flowIssueRouting === null
      ? null
      : isRecord(output.flowIssueRouting)
        ? output.flowIssueRouting
        : undefined,
  } as AiAssistantArtifactBlock
}

const buildBlueprintArtifactBlockFromOutput = (
  output: Record<string, any>,
  metadata?: Record<string, unknown> | null,
): AiAssistantBlueprintArtifactBlock | null => {
  const blueprint = isRecord(output.blueprint) ? output.blueprint : null
  if (!blueprint) {
    return null
  }

  const sourcePlanningContextKey = normalizeText(output.sourcePlanningContextKey)
  const projection = projectBlueprintConfirmation({
    confirmation: blueprint.confirmation,
    openQuestions: blueprint.openQuestions,
    lateQuestions: metadata?.planningConvergenceLateQuestions,
    summary: blueprint.summary,
  })
  const projectedBlueprint = {
    ...blueprint,
    openQuestions: projection.openQuestions,
    confirmation: projection.confirmation || undefined,
  }

  return {
    type: 'artifact',
    kind: 'blueprint',
    status: 'ready',
    planningScope: normalizeNocodeEditorPlanningScopeValue(
      output.planningScope || metadata?.planningScope,
    ),
    revision: normalizeNumber(output.revision),
    stagedAt: normalizeNumber(output.stagedAt),
    sourcePlanningContextKey: sourcePlanningContextKey || undefined,
    confirmation: projection.confirmation
      ? {
        ...projection.confirmation,
        planningContextKey: projection.confirmation.planningContextKey || sourcePlanningContextKey || undefined,
      }
      : sourcePlanningContextKey
        ? { planningContextKey: sourcePlanningContextKey } as AiAssistantBlueprintArtifactBlock['confirmation']
        : undefined,
    blueprint: projectedBlueprint,
    phase: output.phase as AiAssistantBlueprintArtifactBlock['phase'],
    applyResult: isRecord(output.applyResult) ? output.applyResult : output.applyResult ?? undefined,
    draftPersistenceState: getOutputDraftPersistenceState(output),
  }
}

const isArtifactBlock = (value: unknown): value is AiAssistantArtifactBlock => (
  isRecord(value)
  && normalizeText(value.type) === 'artifact'
  && Boolean(normalizeText(value.kind))
)

const isBlueprintArtifactBlock = (value: unknown): value is AiAssistantBlueprintArtifactBlock => (
  isArtifactBlock(value)
  && value.kind === 'blueprint'
)

const projectRestoredBlueprintArtifactBlock = (
  block: AiAssistantBlueprintArtifactBlock,
  metadata?: Record<string, unknown> | null,
): AiAssistantBlueprintArtifactBlock => {
  const blueprint = isRecord(block.blueprint) ? block.blueprint : {}
  const projection = projectBlueprintConfirmation({
    confirmation: block.confirmation ?? blueprint.confirmation,
    openQuestions: blueprint.openQuestions,
    lateQuestions: metadata?.planningConvergenceLateQuestions,
    summary: blueprint.summary || block.summary,
  })

  return {
    ...block,
    planningScope: normalizeNocodeEditorPlanningScopeValue(
      block.planningScope || metadata?.planningScope,
    ),
    confirmation: projection.confirmation || undefined,
    blueprint: {
      ...blueprint,
      openQuestions: projection.openQuestions,
      confirmation: projection.confirmation || undefined,
    },
  }
}

const isAppliedBlueprintMetadataBlock = (
  block: AiAssistantBlueprintArtifactBlock,
  output: Record<string, any>,
) => {
  const persistenceMode = normalizeText(output.persistenceMode)
  const expectedPhase = persistenceMode === 'draft_only' ? 'applied_draft' : 'applied_saved'
  if (normalizeText(block.phase) !== expectedPhase) {
    return false
  }

  const outputBlueprintId = normalizeText(output.blueprintId || output.applyResult?.blueprintId)
  if (!outputBlueprintId) {
    return false
  }

  const blockBlueprintId = normalizeText((block as any).blueprint?.id || (block as any).applyResult?.blueprintId)
  return blockBlueprintId === outputBlueprintId
}

const buildArtifactBlocksFromMetadata = (
  metadata?: Record<string, unknown> | null,
) => {
  const blocks = Array.isArray(metadata?.artifactBlocks)
    ? metadata?.artifactBlocks
    : Array.isArray(metadata?.blocks)
      ? metadata?.blocks
      : []

  return blocks.filter(isArtifactBlock)
}

const mergeOutputDraftPersistenceStateIntoBlocks = (
  blocks: AiAssistantBlueprintArtifactBlock[],
  output: Record<string, any>,
) => {
  if (!hasOwnProperty(output, 'draftPersistenceState')) {
    return blocks
  }

  return blocks.map(block => (
    {
      ...block,
      draftPersistenceState: mergeDraftPersistenceState(
        block.draftPersistenceState,
        output.draftPersistenceState,
      ),
    }
  ))
}

export const buildArtifactBlocksFromPersistedToolMessage = (
  message: ToolHistoryMessageLike,
): AiAssistantArtifactBlock[] => {
  const payload = parsePersistedToolPayload(message)
  if (!payload?.name || !payload.ok || !payload.output) {
    return []
  }

  if (payload.name === 'editor_stage_app_plan') {
    const block = buildAppPlanArtifactBlockFromOutput(payload.output)
    return block ? [block] : []
  }

  if (payload.name === 'editor_stage_single_form_plan') {
    const block = buildFormPlanArtifactBlockFromOutput(payload.output)
    return block ? [block] : []
  }

  if (payload.name === 'editor_stage_formula_plan') {
    const block = buildFormulaPlanArtifactBlockFromOutput(payload.output)
    return block ? [block] : []
  }

  if (payload.name === 'editor_plan_flow_scheme') {
    const block = buildFlowSchemeArtifactBlockFromOutput(payload.output)
    return block ? [block] : []
  }

  if (payload.name === 'editor_stage_app_blueprint') {
    const block = buildBlueprintArtifactBlockFromOutput(payload.output, message.metadata || null)
    return block ? [block] : []
  }

  if (payload.name === 'editor_apply_staged_app_blueprint') {
    const metadataBlocks = buildArtifactBlocksFromMetadata(message.metadata)
      .filter(isBlueprintArtifactBlock)
      .filter(block => isAppliedBlueprintMetadataBlock(block, payload.output))
    if (metadataBlocks.length) {
      return mergeOutputDraftPersistenceStateIntoBlocks(
        metadataBlocks.map(block => projectRestoredBlueprintArtifactBlock(block, message.metadata || null)),
        payload.output,
      )
    }

    const block = buildBlueprintArtifactBlockFromOutput(payload.output, message.metadata || null)
    return block ? [block] : []
  }

  if (
    payload.name === 'editor_set_field_formulas'
    || payload.name === 'editor_set_field_options'
    || payload.name === 'editor_bind_field_source'
  ) {
    const metadataBlocks = buildArtifactBlocksFromMetadata(message.metadata)
      .filter(isBlueprintArtifactBlock)
    if (metadataBlocks.length) {
      return mergeOutputDraftPersistenceStateIntoBlocks(
        metadataBlocks.map(block => projectRestoredBlueprintArtifactBlock(block, message.metadata || null)),
        payload.output,
      )
    }

    const block = buildBlueprintArtifactBlockFromOutput(payload.output, message.metadata || null)
    return block ? [block] : []
  }

  return []
}
