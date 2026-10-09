export const AI_ATTACHMENT_IMAGE_EXTENSIONS: readonly string[] = [
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp',
]

export const AI_ATTACHMENT_DOCUMENT_EXTENSIONS: readonly string[] = [
  'pdf', 'docx', 'pptx',
]

export const AI_ATTACHMENT_SPREADSHEET_EXTENSIONS: readonly string[] = ['xls', 'xlsx']

export const AI_ATTACHMENT_TEXT_EXTENSIONS: readonly string[] = [
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'yaml', 'yml', 'log', 'html',
]

export const AI_ATTACHMENT_ARCHIVE_EXTENSIONS: readonly string[] = ['zip']

export const AI_ATTACHMENT_AUDIO_EXTENSIONS: readonly string[] = [
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg',
]

export const WORKBENCH_AI_ATTACHMENT_PICKER_EXTENSIONS: readonly string[] = [
  ...AI_ATTACHMENT_IMAGE_EXTENSIONS,
  ...AI_ATTACHMENT_DOCUMENT_EXTENSIONS,
  ...AI_ATTACHMENT_SPREADSHEET_EXTENSIONS,
  ...AI_ATTACHMENT_TEXT_EXTENSIONS,
  ...AI_ATTACHMENT_ARCHIVE_EXTENSIONS,
]

export const AI_ATTACHMENT_UPLOAD_EXTENSIONS: readonly string[] = [
  ...WORKBENCH_AI_ATTACHMENT_PICKER_EXTENSIONS,
  ...AI_ATTACHMENT_AUDIO_EXTENSIONS,
]

export const WORKBENCH_AI_ATTACHMENT_ACCEPT = WORKBENCH_AI_ATTACHMENT_PICKER_EXTENSIONS
  .map(extension => `.${extension}`)
  .join(',')

export const matchesAiAttachmentAccept = (
  file: { name: string; type?: string },
  accept: string,
) => {
  const acceptedTypes = accept
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
  if (!acceptedTypes.length) {
    return true
  }

  const fileName = String(file.name || '').toLowerCase()
  const fileMimeType = String(file.type || '').toLowerCase()
  const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
  return acceptedTypes.some((item) => {
    if (item.startsWith('.')) {
      return extension === item.slice(1)
    }
    if (item.endsWith('/*')) {
      return fileMimeType.startsWith(item.slice(0, -1))
    }
    if (item.includes('/')) {
      return fileMimeType === item
    }
    return fileName.endsWith(item)
  })
}
