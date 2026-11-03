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

  // 确认已完成且下一阶段加载中：保留加载态，避免方案卡先显示“已完成”再闪成蓝图卡。
  if (matchedBlueprintState === 'loading' && confirmationStatus === 'completed') {
    return 'next-stage-loading'
  }

  if (questionCount <= 0 && confirmationStatus !== 'completed') {
    return 'ready-no-confirmation'
  }
  return confirmationStatus === 'completed' ? 'completed' : 'pending'
}
