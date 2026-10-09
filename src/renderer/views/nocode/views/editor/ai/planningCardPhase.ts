import type { AiAssistantArtifactBlock } from '@common/types/ai'
import {
  resolveAiArtifactConfirmationQuestionCount,
  resolveAiArtifactConfirmationStatus,
} from '@renderer/views/nocode/components/ai/artifactBlock'

export type PlanningCardPhase =
  | 'pending'
  | 'ready-no-confirmation'
  | 'completed'
  | 'next-stage-loading'
  | 'error'

export type MatchedPlanningBlueprintSignal = {
  state: 'loading' | 'error' | ''
  message?: string
}

export const resolvePlanningCardPhase = (
  input: {
    block: AiAssistantArtifactBlock
    matchedBlueprintSignal?: MatchedPlanningBlueprintSignal
  },
): PlanningCardPhase | '' => {
  const confirmationStatus = resolveAiArtifactConfirmationStatus(input.block)
  const questionCount = resolveAiArtifactConfirmationQuestionCount(input.block)
  const matchedBlueprintState = input.matchedBlueprintSignal?.state || ''

  if (matchedBlueprintState === 'error' && confirmationStatus === 'completed') {
    return 'error'
  }

  if (matchedBlueprintState === 'loading' && confirmationStatus === 'completed') {
    return 'next-stage-loading'
  }

  if (questionCount <= 0 && confirmationStatus !== 'completed') {
    return 'ready-no-confirmation'
  }
  return confirmationStatus === 'completed' ? 'completed' : 'pending'
}
