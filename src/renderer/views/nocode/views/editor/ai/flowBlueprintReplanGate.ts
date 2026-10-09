export const FLOW_SCHEME_REPLANNED_IN_CURRENT_TURN_FLAG = 'flowSchemeReplannedInCurrentTurn'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

export const markFlowSchemeReplannedInCurrentTurn = (
  requestMetadata?: Record<string, unknown> | null,
) => ({
  ...(requestMetadata || {}),
  [FLOW_SCHEME_REPLANNED_IN_CURRENT_TURN_FLAG]: true,
})

export const shouldBlockFlowBlueprintUntilSchemeReplanned = (input: {
  toolName: string
  requestMetadata?: Record<string, unknown> | null
}) => {
  if (
    String(input.toolName || '').trim() !== 'editor_stage_flow_blueprint'
    || input.requestMetadata?.[FLOW_SCHEME_REPLANNED_IN_CURRENT_TURN_FLAG] === true
  ) {
    return false
  }

  const requestMetadata = input.requestMetadata || {}
  if (Object.prototype.hasOwnProperty.call(requestMetadata, 'flowIssueRouting')) {
    const flowIssueRouting = isRecord(requestMetadata.flowIssueRouting)
      ? requestMetadata.flowIssueRouting
      : null
    return String(flowIssueRouting?.outcome || '').trim() === 'return_to_flow_scheme'
  }

  return (
    requestMetadata.requiredNextAction === 'editor_plan_flow_scheme'
    && requestMetadata.blockedNextAction === 'editor_stage_flow_blueprint'
  )
}
