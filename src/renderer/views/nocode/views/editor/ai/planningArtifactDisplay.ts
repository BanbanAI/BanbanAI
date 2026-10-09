import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiStagedAppPlan,
  NocodeEditorAiStagedFormPlan,
  NocodeEditorAiStagedFormulaPlan,
} from './types'
import {
  resolveAiArtifactConfirmationStatus,
  shouldRenderAiArtifactInlineConfirmation,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import { doesAppPlanArtifactMatchStagedState } from './appPlanArtifactState'
import { shouldAutoContinueFlowBlueprintFromScheme } from './flowSchemeAutoContinue'
import { resolveNocodeEditorFormulaPlanDisplayMode } from '@common/utils/nocodeEditorFormulaDomain'

type ResolvePlanningArtifactDisplayStateInput = {
  block: NocodeEditorAiArtifactBlock
  stagedAppPlan?: NocodeEditorAiStagedAppPlan | null
  stagedFormPlan?: NocodeEditorAiStagedFormPlan | null
  stagedFormulaPlan?: NocodeEditorAiStagedFormulaPlan | null
  allowHistoricalCompletedFlowSchemeCard?: boolean
}

export type PlanningArtifactDisplayState = {
  renderAsConfirmation: boolean
  renderAsGenericArtifact: boolean
  readonly: boolean
}

const normalizePositiveNumber = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

const isSameFormulaSourceContext = (
  blockSourceContext: Record<string, unknown> | null | undefined,
  stagedSourceContext: Record<string, unknown> | null | undefined,
) => {
  const blockContext = blockSourceContext || {}
  const stagedContext = stagedSourceContext || {}
  const normalizeText = (value: unknown) => String(value || '').trim()
  const normalizeDraftRevision = (value: unknown) => {
    const revision = Number(value)
    return Number.isFinite(revision) ? revision : null
  }

  return (
    normalizeText(blockContext.taskId) === normalizeText(stagedContext.taskId)
    && normalizeText(blockContext.taskScopeKey) === normalizeText(stagedContext.taskScopeKey)
    && normalizeText(blockContext.nocodeId) === normalizeText(stagedContext.nocodeId)
    && normalizeText(blockContext.formId) === normalizeText(stagedContext.formId)
    && normalizeDraftRevision(blockContext.draftRevision) === normalizeDraftRevision(stagedContext.draftRevision)
    && normalizeText(blockContext.evidenceFingerprint) === normalizeText(stagedContext.evidenceFingerprint)
  )
}

export const resolvePlanningArtifactDisplayState = (
  input: ResolvePlanningArtifactDisplayStateInput,
): PlanningArtifactDisplayState => {
  const {
    block,
    stagedAppPlan,
    stagedFormPlan,
    stagedFormulaPlan,
    allowHistoricalCompletedFlowSchemeCard = false,
  } = input

  if (block.kind === 'formula-plan') {
    const isReady = block.status === 'ready'
    if (!isReady) {
      return {
        renderAsConfirmation: false,
        renderAsGenericArtifact: true,
        readonly: false,
      }
    }

    const blockRevision = normalizePositiveNumber(block.revision)
    const stagedRevision = normalizePositiveNumber(stagedFormulaPlan?.revision)
    const blockStagedAt = normalizePositiveNumber(block.stagedAt)
    const stagedAt = normalizePositiveNumber(stagedFormulaPlan?.stagedAt)
    const isCurrent = Boolean(
      stagedFormulaPlan?.plan
      && blockRevision > 0
      && stagedRevision > 0
      && blockStagedAt > 0
      && stagedAt > 0
      && blockRevision === stagedRevision
      && blockStagedAt === stagedAt
      && isSameFormulaSourceContext(
        block.sourceContext as Record<string, unknown> | null | undefined,
        stagedFormulaPlan.sourceContext as Record<string, unknown> | null | undefined,
      ),
    )
    const displayMode = resolveNocodeEditorFormulaPlanDisplayMode(block.formulaPlan)
    if (!isCurrent) {
      return {
        renderAsConfirmation: false,
        renderAsGenericArtifact: true,
        readonly: true,
      }
    }
    if (displayMode === 'decision') {
      return {
        renderAsConfirmation: true,
        renderAsGenericArtifact: false,
        readonly: false,
      }
    }
    if (displayMode === 'hidden' && isCurrent) {
      return {
        renderAsConfirmation: false,
        renderAsGenericArtifact: false,
        readonly: false,
      }
    }

    return {
      renderAsConfirmation: false,
      renderAsGenericArtifact: true,
      readonly: !isCurrent,
    }
  }

  if (block.kind === 'app-plan') {
    const isCurrent = doesAppPlanArtifactMatchStagedState(block, stagedAppPlan)
    const isReady = block.status === 'ready'
    return {
      renderAsConfirmation: isReady,
      renderAsGenericArtifact: !isReady,
      readonly: isReady && !isCurrent,
    }
  }

  if (block.kind === 'form-plan') {
    const blockRevision = normalizePositiveNumber(block.revision)
    const stagedRevision = normalizePositiveNumber(stagedFormPlan?.revision)
    const blockStagedAt = normalizePositiveNumber(block.stagedAt)
    const stagedAt = normalizePositiveNumber(stagedFormPlan?.stagedAt)
    const isCurrent = Boolean(
      stagedFormPlan?.outline
      && block.status === 'ready'
      && blockRevision > 0
      && stagedRevision > 0
      && blockStagedAt > 0
      && stagedAt > 0
      && blockRevision === stagedRevision
      && blockStagedAt === stagedAt,
    )
    const isReady = block.status === 'ready'
    return {
      renderAsConfirmation: isReady,
      renderAsGenericArtifact: !isReady,
      readonly: isReady && !isCurrent,
    }
  }

  if (
    block.kind === 'flow-scheme'
    && allowHistoricalCompletedFlowSchemeCard
    && resolveAiArtifactConfirmationStatus(block) === 'completed'
  ) {
    return {
      renderAsConfirmation: true,
      renderAsGenericArtifact: false,
      readonly: false,
    }
  }

  if (block.kind === 'flow-scheme' && shouldAutoContinueFlowBlueprintFromScheme(block)) {
    return {
      renderAsConfirmation: false,
      renderAsGenericArtifact: false,
      readonly: false,
    }
  }

  const renderAsConfirmation = shouldRenderAiArtifactInlineConfirmation(block)
  return {
    renderAsConfirmation,
    renderAsGenericArtifact: !renderAsConfirmation,
    readonly: false,
  }
}
