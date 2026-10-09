export type AiAttachmentKind =
  | 'excel'
  | 'image'
  | 'document'
  | 'text'
  | 'audio'
  | 'archive'
  | 'file'

export type AiAttachmentIntentRoute = 'create' | 'analyze' | 'clarify'

export type AiAttachmentIntentReason =
  | 'explicit_create'
  | 'explicit_analyze'
  | 'analyze_then_create'
  | 'mixed_goal'
  | 'attachment_only'
  | 'ambiguous'

export type AiAttachmentReference = {
  id: string
  kind: AiAttachmentKind
  name: string
  mimeType?: string
  size?: number
  extension?: string
  classification?: 'excel' | 'zip_excel_import_candidate' | 'generic_zip'
  uploadHandle?: AiAttachmentUploadHandle
  remoteHandle?: {
    attachmentId: string
  }
}

export type AiAttachmentStatus = 'ready' | 'uploading' | 'error'

export type AiAttachmentSource = 'local' | 'uploaded'

export type AiAttachmentUploadHandle = {
  id: string
  fullPath: string
  sessionId?: string
  originFilePath?: string
}

export type AiAttachment = AiAttachmentReference & {
  status?: AiAttachmentStatus
  source?: AiAttachmentSource
  url?: string
  previewUrl?: string
  file?: File
  uploadHandle?: AiAttachmentUploadHandle
}

export type AiAttachmentIntentHint = {
  route: AiAttachmentIntentRoute
  reason: AiAttachmentIntentReason
  summary?: string
}

export type AiAttachmentMessageMetadata = {
  attachments: AiAttachmentReference[]
  attachmentIntent?: AiAttachmentIntentHint
}

export type AiAttachmentSelectionEventPayload = {
  attachment: AiAttachment
  attachments: AiAttachment[]
  attachmentIntent: AiAttachmentIntentHint
}

export type AiAttachmentUserTurnInput = {
  text: string
  attachments: AiAttachmentReference[]
  generalAttachmentsDefaultToAnalyze?: boolean
}
