import type {
  AiAttachment,
  AiAttachmentReference,
  AiAttachmentUploadHandle,
} from '../types/aiAttachment'

type AiExcelCreateCompletionMetadata = {
  excelCreateCompletion?: {
    attachmentId?: string
  }
}

type MessageLike = {
  metadata?: unknown
}

export type AiExcelImportSourceInstance = {
  fullPath: string
  sessionId?: string
}

const createTransientAttachmentId = (prefix: string) => (
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
)

const cloneUploadHandle = (uploadHandle?: AiAttachmentUploadHandle) => {
  const fullPath = String(uploadHandle?.fullPath || '').trim()
  if (!fullPath) {
    return null
  }

  return {
    id: createTransientAttachmentId('attachment-upload'),
    fullPath,
    sessionId: String(uploadHandle?.sessionId || '').trim() || undefined,
    originFilePath: String(uploadHandle?.originFilePath || '').trim() || undefined,
  } satisfies AiAttachmentUploadHandle
}

export const cloneAiExcelAttachmentForComposer = (
  attachment?: AiAttachmentReference | null,
): AiAttachment | null => {
  if (!attachment || attachment.kind !== 'excel') {
    return null
  }

  const uploadHandle = cloneUploadHandle(attachment.uploadHandle)
  if (!uploadHandle) {
    return null
  }

  return {
    id: createTransientAttachmentId('attachment'),
    kind: 'excel',
    name: String(attachment.name || '').trim(),
    mimeType: String(attachment.mimeType || '').trim() || undefined,
    size: typeof attachment.size === 'number' ? attachment.size : undefined,
    extension: String(attachment.extension || '').trim() || undefined,
    uploadHandle,
    source: 'uploaded',
    status: 'ready',
  }
}

export const resolveAiExcelImportSourceInstance = (
  source?: Pick<AiAttachmentUploadHandle, 'fullPath' | 'sessionId'> | null,
): AiExcelImportSourceInstance | null => {
  const fullPath = String(source?.fullPath || '').trim()
  if (!fullPath) {
    return null
  }

  return {
    fullPath,
    sessionId: String(source?.sessionId || '').trim() || undefined,
  }
}

export const isSameAiExcelImportSourceInstance = (
  left?: Pick<AiExcelImportSourceInstance, 'fullPath' | 'sessionId'> | null,
  right?: Pick<AiExcelImportSourceInstance, 'fullPath' | 'sessionId'> | null,
) => {
  const leftFullPath = String(left?.fullPath || '').trim()
  const rightFullPath = String(right?.fullPath || '').trim()
  const leftSessionId = String(left?.sessionId || '').trim()
  const rightSessionId = String(right?.sessionId || '').trim()

  if (leftSessionId && rightSessionId) {
    return leftSessionId === rightSessionId
  }

  return Boolean(leftFullPath) && leftFullPath === rightFullPath
}

export const buildAiExcelCreateCompletionMetadata = (
  attachmentId?: string | null,
): AiExcelCreateCompletionMetadata => {
  const normalizedAttachmentId = String(attachmentId || '').trim()
  if (!normalizedAttachmentId) {
    return {}
  }

  return {
    excelCreateCompletion: {
      attachmentId: normalizedAttachmentId,
    },
  }
}

export const collectAiExcelCreateCompletionAttachmentIds = (
  messages: MessageLike[],
): Set<string> => {
  const attachmentIds = new Set<string>()

  for (const message of messages) {
    const metadata = message?.metadata
    if (!metadata || typeof metadata !== 'object') {
      continue
    }
    const completion = (metadata as AiExcelCreateCompletionMetadata).excelCreateCompletion
    const attachmentId = String(completion?.attachmentId || '').trim()
    if (!attachmentId) {
      continue
    }
    attachmentIds.add(attachmentId)
  }

  return attachmentIds
}
