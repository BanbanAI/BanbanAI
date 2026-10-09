import type { AiAssistantMessageBlock } from '@common/types/ai'
import { resolveAiAssistantMessageBlocks } from '@common/utils/aiMessageBlocks'
import { stripNocodeEditorAppBuilderPlanningFence } from '@common/utils/nocodeEditorAppBuilderPlanningFence'
import type { NocodeEditorAiContinuityHint, NocodeEditorAiDoneMetadata } from './types'

export type NocodeEditorDonePresentation = {
  finalContent: string
  blocks: AiAssistantMessageBlock[]
  continuityHints?: NocodeEditorAiContinuityHint[]
  appBuilderPlanningSummary?: string
  appBuilderPlanningArtifacts?: unknown[]
  appBuilderPlanningOutline?: Record<string, unknown>
  assistantMessageId?: string
}

const resolveDoneBlocks = (metadata?: NocodeEditorAiDoneMetadata | null) => {
  const metadataBlocks = resolveAiAssistantMessageBlocks(metadata?.blocks)
  if (metadataBlocks.length) {
    return metadataBlocks
  }

  return resolveAiAssistantMessageBlocks(metadata?.artifactBlocks)
}

const resolveContinuityHints = (value: unknown): NocodeEditorAiContinuityHint[] | undefined => (
  Array.isArray(value)
    ? value.filter((item): item is NocodeEditorAiContinuityHint => Boolean(item && typeof item === 'object'))
    : undefined
)

export const resolveNocodeEditorDonePresentation = (
  metadata?: NocodeEditorAiDoneMetadata | null,
): NocodeEditorDonePresentation => ({
  finalContent: stripNocodeEditorAppBuilderPlanningFence(String(metadata?.finalContent || '').trim()),
  blocks: resolveDoneBlocks(metadata),
  continuityHints: resolveContinuityHints(metadata?.continuityHints),
  appBuilderPlanningSummary: String(metadata?.appBuilderPlanningSummary || '').trim() || undefined,
  appBuilderPlanningArtifacts: Array.isArray(metadata?.appBuilderPlanningArtifacts)
    ? metadata.appBuilderPlanningArtifacts
    : undefined,
  appBuilderPlanningOutline: metadata?.appBuilderPlanningOutline
    && typeof metadata.appBuilderPlanningOutline === 'object'
    && !Array.isArray(metadata.appBuilderPlanningOutline)
    ? metadata.appBuilderPlanningOutline as Record<string, unknown>
    : undefined,
  assistantMessageId: String(metadata?.assistantMessageId || '').trim() || undefined,
})
