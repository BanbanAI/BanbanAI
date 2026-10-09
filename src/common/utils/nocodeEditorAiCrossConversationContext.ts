export const NOCODE_EDITOR_SUPPRESS_CROSS_CONVERSATION_CONTEXT_FLAG = 'suppressCrossConversationContext'

export const hasNocodeEditorSuppressCrossConversationContext = (
  metadata: unknown,
): boolean => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false
  }

  return (metadata as Record<string, unknown>)[NOCODE_EDITOR_SUPPRESS_CROSS_CONVERSATION_CONTEXT_FLAG] === true
}
