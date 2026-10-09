export type RelationContextSaveHeaders = {
  'x-sign'?: string | string[]
}

export type RelationContextSaveOutcome = {
  headers?: RelationContextSaveHeaders
}

export type RelationContextSaveDegradationOptions = {
  saveMain: () => Promise<RelationContextSaveOutcome>
  syncRelationContext: () => Promise<void>
  applyMainSideEffects?: (outcome: RelationContextSaveOutcome) => void
  observeRelationContextError?: (error: unknown) => void
}

export const saveWithRelationContextDegradation = async ({
  saveMain,
  syncRelationContext,
  applyMainSideEffects,
  observeRelationContextError,
}: RelationContextSaveDegradationOptions): Promise<true> => {
  const outcome = await saveMain()
  applyMainSideEffects?.(outcome)

  try {
    await syncRelationContext()
  } catch (error) {
    observeRelationContextError?.(error)
  }

  return true
}
