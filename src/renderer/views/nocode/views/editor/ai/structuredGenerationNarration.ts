import type { AiAssistantMessageBlock } from '@common/types/ai'

const STRUCTURED_GENERATION_ARTIFACT_KINDS = new Set([
  'app-plan',
  'form-plan',
  'content-plan',
  'formula-plan',
  'flow-scheme',
  'flow-plan',
  'blueprint',
])

export const hasStructuredGenerationArtifact = (
  blocks: AiAssistantMessageBlock[] = [],
) => blocks.some((block) => (
  block.type === 'artifact'
  && (block.status === 'ready' || block.status === 'loading')
  && STRUCTURED_GENERATION_ARTIFACT_KINDS.has(String(block.kind || '').trim())
))

export const shouldHideStructuredGenerationNarration = (input: {
  metadata?: Record<string, unknown> | null
  blocks?: AiAssistantMessageBlock[]
}) => (
  input.metadata?.structuredGenerationActive === true
  || (
    hasStructuredGenerationArtifact(input.blocks || [])
    && input.metadata?.blueprintAppliedFromAction !== true
    && !(input.blocks || []).some(block => block.type === 'artifact' && block.status === 'error')
    && !(input.blocks || []).some(block => (
      block.type === 'artifact'
      && block.status === 'ready'
      && (
        ('flowApplyResult' in block && Boolean(block.flowApplyResult))
        || ('applyResult' in block && Boolean(block.applyResult))
      )
    ))
  )
)
