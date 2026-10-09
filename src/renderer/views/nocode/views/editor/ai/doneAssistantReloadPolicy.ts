import {
  compareNocodeEditorArtifactBlocks,
  isNocodeEditorArtifactBlock,
} from '../../../../../../common/utils/nocodeEditorArtifactBlocks'

type DoneReloadMessageLike = {
  role?: unknown
  traceId?: unknown
  metadata?: Record<string, unknown> | null
}

const normalizeTraceId = (value: unknown) => String(value || '').trim()

const isAssistantMessage = (message?: DoneReloadMessageLike | null) => (
  String(message?.role || '').trim() === 'assistant'
)

const extractFlowPlanArtifactBlocks = (value: unknown) => (
  Array.isArray(value)
    ? value.filter((block) => (
      isNocodeEditorArtifactBlock(block)
      && String(block.kind || '').trim() === 'flow-plan'
    ))
    : []
)

const pickLatestFlowPlanArtifactBlock = (
  blocks: Array<Record<string, unknown>>,
) => blocks.reduce<Record<string, unknown> | null>((latest, block) => {
  if (!latest) {
    return block
  }
  return compareNocodeEditorArtifactBlocks(block, latest) > 0 ? block : latest
}, null)

export const shouldForceFlowPlanAuthoritativeReloadAfterDone = (input: {
  traceId?: unknown
  doneBlocks?: unknown
  messages?: DoneReloadMessageLike[]
}) => {
  const doneFlowPlanBlocks = extractFlowPlanArtifactBlocks(input.doneBlocks)
  if (!doneFlowPlanBlocks.length) {
    return false
  }

  const traceId = normalizeTraceId(input.traceId)
  if (!traceId) {
    return false
  }

  const traceMessages = (input.messages || []).filter(message => (
    normalizeTraceId(message?.traceId || message?.metadata?.traceId) === traceId
  ))
  if (!traceMessages.length) {
    return false
  }

  const currentFlowPlanBlocks = traceMessages.flatMap((message) => (
    isAssistantMessage(message)
      ? extractFlowPlanArtifactBlocks(message?.metadata?.blocks)
      : []
  ))
  if (!currentFlowPlanBlocks.length) {
    return true
  }

  const latestCurrentFlowPlanBlock = pickLatestFlowPlanArtifactBlock(currentFlowPlanBlocks)
  const latestDoneFlowPlanBlock = pickLatestFlowPlanArtifactBlock(doneFlowPlanBlocks)
  if (!latestCurrentFlowPlanBlock || !latestDoneFlowPlanBlock) {
    return false
  }

  return compareNocodeEditorArtifactBlocks(
    latestCurrentFlowPlanBlock,
    latestDoneFlowPlanBlock,
  ) < 0
}
