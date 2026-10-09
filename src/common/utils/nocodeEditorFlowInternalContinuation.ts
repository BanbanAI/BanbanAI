export type NocodeEditorFlowInternalContinuation = {
  kind: 'flow_blueprint'
  key: string
  planningContextKey: string
  schemeRevision: number
}

type FlowBlueprintInternalContinuationIdentity = Pick<
  NocodeEditorFlowInternalContinuation,
  'planningContextKey' | 'schemeRevision'
>

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

export const buildFlowBlueprintInternalContinuationKey = (
  input: FlowBlueprintInternalContinuationIdentity,
) => {
  const planningContextKey = typeof input?.planningContextKey === 'string'
    ? input.planningContextKey.trim()
    : ''
  const schemeRevision = input?.schemeRevision
  if (
    !planningContextKey
    || typeof schemeRevision !== 'number'
    || !Number.isInteger(schemeRevision)
    || schemeRevision <= 0
  ) {
    return ''
  }

  return `flow-blueprint:${planningContextKey}:${schemeRevision}`
}

export const normalizeNocodeEditorFlowInternalContinuation = (
  value: unknown,
): NocodeEditorFlowInternalContinuation | null => {
  if (!isRecord(value) || value.kind !== 'flow_blueprint') {
    return null
  }

  const planningContextKey = typeof value.planningContextKey === 'string'
    ? value.planningContextKey.trim()
    : ''
  const schemeRevision = value.schemeRevision
  const providedKey = typeof value.key === 'string' ? value.key.trim() : ''
  if (
    !planningContextKey
    || !providedKey
    || typeof schemeRevision !== 'number'
    || !Number.isInteger(schemeRevision)
    || schemeRevision <= 0
  ) {
    return null
  }

  const key = buildFlowBlueprintInternalContinuationKey({
    planningContextKey,
    schemeRevision,
  })
  if (!key || providedKey !== key) {
    return null
  }

  return {
    kind: 'flow_blueprint',
    key,
    planningContextKey,
    schemeRevision,
  }
}
