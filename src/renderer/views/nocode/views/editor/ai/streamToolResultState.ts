import type {
  AiAssistantFormulaResultBlock,
  AiAssistantMessageBlock,
} from '@common/types/ai'
import i18next from 'i18next'
import { reduceNocodeEditorAssistantContent } from './streamContentState'

type ToolResultContentInput = {
  currentContent: string
  thinkingText: string
  streamKey?: string
  summaryContent?: string
  metadata?: Record<string, unknown> | null
}

const shouldReplaceAssistantContentWithSummary = (metadata?: Record<string, unknown> | null) => (
  Boolean(metadata?.summaryReplacesAssistantContent)
)

const isBlueprintSummaryStage = (metadata?: Record<string, unknown> | null) => (
  String(metadata?.summaryStage || '').trim().toLowerCase() === 'blueprint'
)

const getSummarySuppressionReason = (metadata?: Record<string, unknown> | null) => (
  String(metadata?.summarySuppressionReason || '').trim()
)

const normalizeContent = (value: unknown) => String(value || '').trim()

export const hasNocodeEditorFormulaResultBlock = (
  blocks: AiAssistantMessageBlock[] = [],
) => blocks.some(block => block.type === 'formula-result')

export const mergeNocodeEditorFormulaResultBlocks = (
  blocks: AiAssistantMessageBlock[] = [],
) => {
  const formulaBlocks = blocks
    .filter((block): block is AiAssistantFormulaResultBlock => block.type === 'formula-result')

  if (formulaBlocks.length <= 1) {
    return formulaBlocks
  }

  const items = formulaBlocks.flatMap(block => block.items || [])
  if (!items.length) {
    return [] as AiAssistantFormulaResultBlock[]
  }

  const explicitTitle = formulaBlocks
    .map(block => normalizeContent(block.title))
    .find(Boolean)
  const title = explicitTitle || (items.length > 1 ? i18next.t('streamToolResultState.updatedFieldFormulas', { count: items.length }) : '')

  return [{
    type: 'formula-result',
    ...(title ? { title } : {}),
    items,
  }]
}

export const shouldPreferNocodeEditorFormulaResultBlock = (input: {
  blocks?: AiAssistantMessageBlock[]
  content?: string
}) => (
  hasNocodeEditorFormulaResultBlock(input.blocks || [])
  && !normalizeContent(input.content)
)

export const isNocodeEditorSuppressedIntermediateSummary = (
  metadata?: Record<string, unknown> | null,
) => (
  Boolean(metadata?.suppressedIntermediateSummary)
  && getSummarySuppressionReason(metadata) === 'transient_failed_app_plan_followed_by_success'
)

export const shouldMergeNocodeEditorToolResultBlocks = (
  metadata: Record<string, unknown> | null | undefined,
  blocks: unknown[],
) => blocks.length > 0 && !isNocodeEditorSuppressedIntermediateSummary(metadata)

export const shouldRenderNocodeEditorToolResultSummaryInAssistantContent = (
  metadata?: Record<string, unknown> | null,
) => !metadata?.hiddenFromTimeline

export const reduceNocodeEditorToolResultAssistantContent = (input: ToolResultContentInput) => {
  const summaryContent = normalizeContent(input.summaryContent)
  if (isNocodeEditorSuppressedIntermediateSummary(input.metadata)) {
    return input.currentContent
  }

  if (!summaryContent) {
    return input.currentContent
  }

  if (
    shouldReplaceAssistantContentWithSummary(input.metadata)
    || isBlueprintSummaryStage(input.metadata)
  ) {
    return summaryContent
  }

  return reduceNocodeEditorAssistantContent({
    currentContent: input.currentContent,
    thinkingText: input.thinkingText,
    streamKey: input.streamKey,
    event: 'done',
    finalContent: summaryContent,
    doneFallbackText: summaryContent,
  })
}

export const applyNocodeEditorToolResultSummaryToAssistantContent = (input: ToolResultContentInput) => {
  if (!shouldRenderNocodeEditorToolResultSummaryInAssistantContent(input.metadata)) {
    return input.currentContent
  }

  return reduceNocodeEditorToolResultAssistantContent(input)
}
