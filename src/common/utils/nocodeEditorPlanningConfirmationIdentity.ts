const normalizePlanningConfirmationKeyPart = (value: unknown) => (
  String(value || '').replace(/\s+/g, ' ').trim()
)

export const buildPlanningConfirmationContextKey = (input: {
  stage?: string | null
  outlineId?: string | null
  primaryFormKey?: string | null
  revision?: number | null
  stagedAt?: number | null
}) => {
  const stage = normalizePlanningConfirmationKeyPart(input.stage)
  const outlineId = normalizePlanningConfirmationKeyPart(input.outlineId)
  const primaryFormKey = normalizePlanningConfirmationKeyPart(input.primaryFormKey)
  const revision = Number(input.revision || 0)
  const stagedAt = Number(input.stagedAt || 0)
  if (!outlineId && !primaryFormKey && !revision && !stagedAt) {
    return ''
  }
  return [
    stage,
    outlineId,
    primaryFormKey,
    revision,
    stagedAt,
  ].join(':')
}

export const buildLogicalPlanningConfirmationContextKey = (input: {
  stage?: string | null
  outlineId?: string | null
  primaryFormKey?: string | null
}) => {
  const stage = normalizePlanningConfirmationKeyPart(input.stage)
  const outlineId = normalizePlanningConfirmationKeyPart(input.outlineId)
  const primaryFormKey = normalizePlanningConfirmationKeyPart(input.primaryFormKey)
  if (!outlineId && !primaryFormKey) {
    return ''
  }
  return [
    'logical',
    stage,
    outlineId,
    primaryFormKey,
  ].join(':')
}

const parsePlanningConfirmationContextKey = (value?: string | null) => {
  const parts = String(value || '').trim().split(':')
  if (parts[0] === 'logical') {
    return {
      stage: parts[1] || '',
      outlineId: parts[2] || '',
      primaryFormKey: parts.slice(3).join(':') || '',
    }
  }

  return {
    stage: parts[0] || '',
    outlineId: parts[1] || '',
    primaryFormKey: parts[2] || '',
  }
}

export const isSamePlanningConfirmationContext = (
  left?: string | null,
  right?: string | null,
) => {
  const normalizedLeft = String(left || '').trim()
  const normalizedRight = String(right || '').trim()
  if (!normalizedLeft || !normalizedRight) {
    return false
  }
  if (normalizedLeft === normalizedRight) {
    return true
  }

  const parsedLeft = parsePlanningConfirmationContextKey(normalizedLeft)
  const parsedRight = parsePlanningConfirmationContextKey(normalizedRight)
  return Boolean(
    parsedLeft.stage
    && parsedLeft.stage === parsedRight.stage
    && parsedLeft.outlineId === parsedRight.outlineId
    && parsedLeft.primaryFormKey
    && parsedLeft.primaryFormKey === parsedRight.primaryFormKey,
  )
}

export const canFallbackToTraceScopedPlanningConfirmation = (input: {
  candidateContextKey?: string | null
  preferredTraceId?: string | null
  candidateTraceId?: string | null
}) => !input.candidateContextKey
  && Boolean(input.preferredTraceId)
  && String(input.preferredTraceId).trim() === String(input.candidateTraceId || '').trim()
