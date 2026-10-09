type UnknownRecord = Record<string, unknown>

const normalizeText = (value: unknown) => String(value || '').trim()

const asRecord = (value: unknown): UnknownRecord | null => (
  value
  && typeof value === 'object'
  && !Array.isArray(value)
    ? value as UnknownRecord
    : null
)

export const isFlowGroundingReturnToPlanMetadata = (value: unknown) => {
  const record = asRecord(value)
  if (!record) {
    return false
  }

  return (
    normalizeText(record.flowGroundingReturnToStage) === 'flow-scheme'
    && normalizeText(record.requiredNextAction) === 'editor_plan_flow_scheme'
    && normalizeText(record.blockedNextAction) === 'editor_stage_flow_blueprint'
  )
}

export const resolveFlowGroundingReturnPlanningContextKey = (value: unknown) => {
  const record = asRecord(value)
  if (!record) {
    return ''
  }

  return normalizeText(
    record.planningContextKey
    || record.flowSchemePlanningContextKey
    || record.sourcePlanningContextKey,
  )
}

export const resolveFlowGroundingReturnFlowSchemeTitle = (value: unknown) => {
  const record = asRecord(value)
  if (!record) {
    return ''
  }

  const scheme = asRecord(record.scheme)
  return normalizeText(
    record.flowSchemeTitle
    || record.flowSchemeDisplayTitle
    || scheme?.title,
  )
}
