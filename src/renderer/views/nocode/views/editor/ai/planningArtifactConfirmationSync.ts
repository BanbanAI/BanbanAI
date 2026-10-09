import type { NocodeEditorAiConfirmPayload } from '@common/types/nocodeEditorConfirmation'
import {
  applyNocodeEditorFlowPlanConfirmation,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  resolveAiArtifactConfirmation,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiSolutionOutline,
} from './types'

type NocodeEditorAiSolutionOutlineWithConfirmation = NocodeEditorAiSolutionOutline & {
  confirmation?: NocodeEditorAiConfirmPayload | null
}

type NocodeEditorAiAppPlanWithConfirmation = NonNullable<NocodeEditorAiArtifactBlock['appPlan']> & {
  outline?: NocodeEditorAiSolutionOutlineWithConfirmation | null
}

const clonePlanningArtifactValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
)

const withClonedConfirmation = <T extends Record<string, unknown>>(
  value: T | null | undefined,
  confirmation: NocodeEditorAiConfirmPayload,
) => (
  value
    ? {
      ...clonePlanningArtifactValue(value),
      confirmation: clonePlanningArtifactValue(confirmation),
    }
    : value
)

const withClonedOutlineConfirmation = (
  outline: NocodeEditorAiSolutionOutlineWithConfirmation | null | undefined,
  confirmation: NocodeEditorAiConfirmPayload,
) => (
  outline
    ? {
      ...clonePlanningArtifactValue(outline),
      confirmation: clonePlanningArtifactValue(confirmation),
    }
    : outline
)

export const reconcilePlanningArtifactConfirmation = (
  block: NocodeEditorAiArtifactBlock,
  carryoverConfirmation?: NocodeEditorAiConfirmPayload | null,
) => {
  const currentConfirmation = resolveAiArtifactConfirmation(block)

  if (block.kind === 'flow-plan') {
    const nextFlowPlan = applyNocodeEditorFlowPlanConfirmation(
      block.flowPlan
        ? {
          ...clonePlanningArtifactValue(block.flowPlan),
          ...(currentConfirmation
            ? { confirmation: clonePlanningArtifactValue(currentConfirmation) }
            : {}),
        }
        : null,
      carryoverConfirmation ? clonePlanningArtifactValue(carryoverConfirmation) : undefined,
    )
    const nextConfirmation = nextFlowPlan?.confirmation
      || currentConfirmation
      || carryoverConfirmation
      || null

    return {
      ...block,
      confirmation: nextConfirmation ? clonePlanningArtifactValue(nextConfirmation) : undefined,
      flowPlan: nextFlowPlan ? clonePlanningArtifactValue(nextFlowPlan) : block.flowPlan,
    }
  }

  const nextConfirmation = carryoverConfirmation || currentConfirmation
  if (!nextConfirmation) {
    return block
  }

  const nextBlock: NocodeEditorAiArtifactBlock = {
    ...block,
    confirmation: clonePlanningArtifactValue(nextConfirmation),
  }

  if (block.kind === 'form-plan') {
    const nextOutline = withClonedOutlineConfirmation(block.outline, nextConfirmation)
    return nextOutline
      ? {
        ...nextBlock,
        outline: nextOutline,
      }
      : nextBlock
  }

  if (block.kind === 'app-plan') {
    const nextAppPlan = block.appPlan
      ? clonePlanningArtifactValue(block.appPlan) as NocodeEditorAiAppPlanWithConfirmation
      : null
    if (nextAppPlan?.outline) {
      nextAppPlan.outline = withClonedOutlineConfirmation(nextAppPlan.outline, nextConfirmation) || null
    }

    const nextBlockOutline = withClonedOutlineConfirmation(block.outline, nextConfirmation)

    return {
      ...nextBlock,
      appPlan: nextAppPlan || block.appPlan,
      ...(nextBlockOutline
        ? {
          outline: nextBlockOutline,
        }
        : {}),
    }
  }

  if (block.kind === 'content-plan') {
    const nextPlan = withClonedConfirmation(block.plan, nextConfirmation)
    return nextPlan
      ? {
        ...nextBlock,
        plan: nextPlan,
      }
      : nextBlock
  }

  if (block.kind === 'formula-plan') {
    const nextFormulaPlan = withClonedConfirmation(block.formulaPlan, nextConfirmation)
    return nextFormulaPlan
      ? {
        ...nextBlock,
        formulaPlan: nextFormulaPlan,
      }
      : nextBlock
  }

  if (block.kind === 'flow-scheme') {
    const nextScheme = withClonedConfirmation(block.scheme, nextConfirmation)
    return nextScheme
      ? {
        ...nextBlock,
        scheme: nextScheme,
      }
      : nextBlock
  }

  return nextBlock
}
