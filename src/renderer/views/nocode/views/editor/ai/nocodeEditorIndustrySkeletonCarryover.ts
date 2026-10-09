import type { AiAssistantArtifactBlock } from '@common/types/ai'
import {
  resolveNocodeEditorIndustrySkeletonCarryover,
  type NocodeEditorIndustrySkeletonCarryover,
} from '@common/utils/nocodeEditorIndustrySkeleton'

const toRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null
)

const resolveBlockCarryover = (
  block?: AiAssistantArtifactBlock | null,
): NocodeEditorIndustrySkeletonCarryover | null => {
  const rawValue = toRecord(block)?.industrySkeletonContext
  return resolveNocodeEditorIndustrySkeletonCarryover(rawValue)
}

export const resolveActiveNocodeEditorIndustrySkeletonContext = (options: {
  appPlanBlock?: AiAssistantArtifactBlock | null
  blueprintBlock?: AiAssistantArtifactBlock | null
  formPlanBlock?: AiAssistantArtifactBlock | null
  solutionBlock?: AiAssistantArtifactBlock | null
}) => (
  resolveBlockCarryover(options?.blueprintBlock)
  || resolveBlockCarryover(options?.formPlanBlock)
  || resolveBlockCarryover(options?.appPlanBlock)
  || resolveBlockCarryover(options?.solutionBlock)
  || null
)
