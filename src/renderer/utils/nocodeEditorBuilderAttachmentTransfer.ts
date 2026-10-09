import type { AiAttachment } from '@common/types/aiAttachment'

const pendingAttachments = new Map<string, AiAttachment[]>()

const normalizeNocodeId = (value: unknown) => String(value || '').trim()

export const stageNocodeEditorBuilderAttachments = (
  nocodeId: unknown,
  attachments: AiAttachment[],
) => {
  const key = normalizeNocodeId(nocodeId)
  if (!key || !attachments.length) {
    return
  }
  pendingAttachments.set(key, attachments.map(attachment => ({ ...attachment })))
}

export const takeNocodeEditorBuilderAttachments = (nocodeId: unknown) => {
  const key = normalizeNocodeId(nocodeId)
  if (!key) {
    return []
  }
  const attachments = pendingAttachments.get(key) || []
  pendingAttachments.delete(key)
  return attachments
}

export const clearNocodeEditorBuilderAttachments = (nocodeId: unknown) => {
  const key = normalizeNocodeId(nocodeId)
  if (key) {
    pendingAttachments.delete(key)
  }
}
