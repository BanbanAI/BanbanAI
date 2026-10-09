import { buildNocodeEditorAiTaskConversationId } from './nocodeEditorAiTaskSession'

const normalizeConversationIdPart = (value: unknown) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '')

export const buildLegacyNocodeEditorAiConversationId = (value: {
  accountId?: unknown
  nocodeId?: unknown
}) => {
  const accountId = normalizeConversationIdPart(value.accountId)
  const nocodeId = normalizeConversationIdPart(value.nocodeId)
  if (!accountId || !nocodeId) {
    return ''
  }

  return `editor_${nocodeId}_${accountId}`
}

export const buildNocodeEditorAiConversationId = (value: {
  accountId?: unknown
  nocodeId?: unknown
  taskId?: unknown
}) => value.taskId
  ? buildNocodeEditorAiTaskConversationId(value)
  : buildLegacyNocodeEditorAiConversationId(value)

export const shouldResumeNocodeEditorAiConversation = (
  messages?: ArrayLike<unknown> | null,
) => Number(messages?.length || 0) > 0
