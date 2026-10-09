import type {
  AiAttachmentIntentHint,
  AiAttachmentIntentReason,
  AiAttachmentIntentRoute,
  AiAttachmentKind,
  AiAttachmentUploadHandle,
  AiAttachmentMessageMetadata,
  AiAttachmentReference,
  AiAttachmentUserTurnInput,
} from '@common/types/aiAttachment'
import {
  AI_ATTACHMENT_ARCHIVE_EXTENSIONS,
  AI_ATTACHMENT_AUDIO_EXTENSIONS,
  AI_ATTACHMENT_DOCUMENT_EXTENSIONS,
  AI_ATTACHMENT_IMAGE_EXTENSIONS,
  AI_ATTACHMENT_SPREADSHEET_EXTENSIONS,
  AI_ATTACHMENT_TEXT_EXTENSIONS,
} from '@common/utils/aiAttachmentFormats'
import i18next from 'i18next'

const CREATE_PATTERNS = [
  /(新建|创建|生成|搭建|建表|建应用|建表单|做成系统|做成应用|做成表单|扩展已有应用|扩展现有应用|按.*建表)/i,
]

const ANALYZE_PATTERNS = [
  /(分析|统计|检查|看看|看一下|查看|识别|总结|提取|梳理|解释)/i,
]

const ANALYZE_THEN_CREATE_PATTERNS = [
  /先.*(分析|统计|看看|看一下|检查).*(再|后).*(创建|新建|生成|搭建|建表|做成)/i,
]

const AMBIGUOUS_PATTERNS = [
  /^看一下这个$/i,
  /^看看这个$/i,
  /^这个怎么处理$/i,
  /^怎么处理这个$/i,
  /^处理一下这个$/i,
]

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeExtension = (value: unknown) => normalizeText(value).replace(/^\./, '').toLowerCase()

export const stripAiAttachmentFileExtension = (value: unknown) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }

  const fileName = normalized.split(/[\\/]/).pop() || normalized
  return fileName.replace(/\.[^./\\]+$/, '') || fileName
}

const normalizeAttachmentKind = (value: unknown): AiAttachmentKind | null => {
  const normalized = normalizeText(value)
  if (['excel', 'image', 'document', 'text', 'audio', 'archive', 'file'].includes(normalized)) {
    return normalized as AiAttachmentKind
  }
  return null
}

const normalizeAttachmentUploadHandle = (value: unknown): AiAttachmentUploadHandle | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const raw = value as Record<string, unknown>
  const id = normalizeText(raw.id)
  const fullPath = normalizeText(raw.fullPath)
  const sessionId = normalizeText(raw.sessionId)
  const originFilePath = normalizeText(raw.originFilePath)
  if (!id || !fullPath) {
    return undefined
  }

  return {
    id,
    fullPath,
    ...(sessionId ? { sessionId } : {}),
    ...(originFilePath ? { originFilePath } : {}),
  }
}

const normalizeIntentRoute = (value: unknown): AiAttachmentIntentRoute | null => {
  const normalized = normalizeText(value)
  if (normalized === 'create' || normalized === 'analyze' || normalized === 'clarify') {
    return normalized
  }
  return null
}

const normalizeIntentReason = (value: unknown): AiAttachmentIntentReason | null => {
  const normalized = normalizeText(value)
  if (
    normalized === 'explicit_create'
    || normalized === 'explicit_analyze'
    || normalized === 'analyze_then_create'
    || normalized === 'mixed_goal'
    || normalized === 'attachment_only'
    || normalized === 'ambiguous'
  ) {
    return normalized
  }
  return null
}

export const inferAiAttachmentKind = (options: {
  fileName?: unknown
  name?: unknown
  mimeType?: unknown
}): AiAttachmentKind => {
  const mimeType = normalizeText(options.mimeType).toLowerCase()
  const extension = normalizeExtension(
    normalizeText(options.fileName ?? options.name).split('.').pop() || '',
  )

  if (
    AI_ATTACHMENT_SPREADSHEET_EXTENSIONS.includes(extension)
    || AI_ATTACHMENT_ARCHIVE_EXTENSIONS.includes(extension)
  ) {
    return 'excel'
  }
  if (mimeType.startsWith('image/') || AI_ATTACHMENT_IMAGE_EXTENSIONS.includes(extension)) {
    return 'image'
  }
  if (mimeType.startsWith('audio/') || AI_ATTACHMENT_AUDIO_EXTENSIONS.includes(extension)) {
    return 'audio'
  }
  if (AI_ATTACHMENT_TEXT_EXTENSIONS.includes(extension)) {
    return 'text'
  }
  if (AI_ATTACHMENT_DOCUMENT_EXTENSIONS.includes(extension)) {
    return 'document'
  }
  return 'file'
}

export const normalizeAiAttachmentReference = (value: unknown): AiAttachmentReference | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>
  const id = normalizeText(raw.id)
  const name = normalizeText(raw.name)
  const kind = normalizeAttachmentKind(raw.kind)
  if (!id || !name || !kind) {
    return null
  }

  const mimeType = normalizeText(raw.mimeType)
  const size = Number(raw.size || 0)
  const extension = normalizeExtension(raw.extension)
  const uploadHandle = normalizeAttachmentUploadHandle(raw.uploadHandle)
  const remoteAttachmentId = normalizeText(
    (raw.remoteHandle && typeof raw.remoteHandle === 'object' && !Array.isArray(raw.remoteHandle))
      ? (raw.remoteHandle as Record<string, unknown>).attachmentId
      : raw.remoteAttachmentId,
  )
  const classification = normalizeText(raw.classification)
  return {
    id,
    kind,
    name,
    ...(mimeType ? { mimeType } : {}),
    ...(Number.isFinite(size) && size > 0 ? { size } : {}),
    ...(extension ? { extension } : {}),
    ...(classification === 'excel' || classification === 'zip_excel_import_candidate' || classification === 'generic_zip'
      ? { classification }
      : {}),
    ...(uploadHandle ? { uploadHandle } : {}),
    ...(remoteAttachmentId ? { remoteHandle: { attachmentId: remoteAttachmentId } } : {}),
  }
}

export const normalizeAiAttachmentMessageMetadata = (
  value: unknown,
): AiAttachmentMessageMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { attachments: [] }
  }

  const raw = value as Record<string, unknown>
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
      .map(item => normalizeAiAttachmentReference(item))
      .filter(Boolean) as AiAttachmentReference[]
    : []

  const rawIntent = raw.attachmentIntent
  if (!rawIntent || typeof rawIntent !== 'object' || Array.isArray(rawIntent)) {
    return { attachments }
  }

  const route = normalizeIntentRoute((rawIntent as Record<string, unknown>).route)
  const reason = normalizeIntentReason((rawIntent as Record<string, unknown>).reason)
  const summary = normalizeText((rawIntent as Record<string, unknown>).summary)
  if (!route || !reason) {
    return { attachments }
  }

  return {
    attachments,
    attachmentIntent: {
      route,
      reason,
      ...(summary ? { summary } : {}),
    },
  }
}

const hasPattern = (patterns: RegExp[], value: string) => patterns.some(pattern => pattern.test(value))

export const resolveAiAttachmentIntent = (
  input: Partial<AiAttachmentUserTurnInput>,
): AiAttachmentIntentHint => {
  const text = normalizeText(input.text)
  const attachments = Array.isArray(input.attachments) ? input.attachments : []
  const hasCreate = hasPattern(CREATE_PATTERNS, text)
  const hasAnalyze = hasPattern(ANALYZE_PATTERNS, text)
  const analyzeThenCreate = hasPattern(ANALYZE_THEN_CREATE_PATTERNS, text)
  const ambiguous = hasPattern(AMBIGUOUS_PATTERNS, text)

  if (analyzeThenCreate) {
    return {
      route: 'analyze',
      reason: 'analyze_then_create',
      summary: buildAiAttachmentIntentSummary({
        route: 'analyze',
        reason: 'analyze_then_create',
      }),
    }
  }

  if (hasCreate && !hasAnalyze) {
    return {
      route: 'create',
      reason: 'explicit_create',
      summary: buildAiAttachmentIntentSummary({
        route: 'create',
        reason: 'explicit_create',
      }),
    }
  }

  if (hasAnalyze && !hasCreate) {
    return {
      route: 'analyze',
      reason: 'explicit_analyze',
      summary: buildAiAttachmentIntentSummary({
        route: 'analyze',
        reason: 'explicit_analyze',
      }),
    }
  }

  if (hasCreate && hasAnalyze) {
    return {
      route: 'clarify',
      reason: 'mixed_goal',
      summary: buildAiAttachmentIntentSummary({
        route: 'clarify',
        reason: 'mixed_goal',
      }),
    }
  }

  const hasDualUseAttachment = attachments.some(item => item.kind === 'excel')
  if (input.generalAttachmentsDefaultToAnalyze && attachments.length && !hasDualUseAttachment) {
    return {
      route: 'analyze',
      reason: 'explicit_analyze',
      summary: buildAiAttachmentIntentSummary({
        route: 'analyze',
        reason: 'explicit_analyze',
      }),
    }
  }

  if (!text && attachments.length) {
    return {
      route: 'clarify',
      reason: 'attachment_only',
      summary: buildAiAttachmentIntentSummary({
        route: 'clarify',
        reason: 'attachment_only',
      }),
    }
  }

  if (ambiguous || attachments.length) {
    return {
      route: 'clarify',
      reason: ambiguous ? 'ambiguous' : 'attachment_only',
      summary: buildAiAttachmentIntentSummary({
        route: 'clarify',
        reason: ambiguous ? 'ambiguous' : 'attachment_only',
      }),
    }
  }

  return {
    route: 'clarify',
    reason: 'ambiguous',
    summary: buildAiAttachmentIntentSummary({
      route: 'clarify',
      reason: 'ambiguous',
    }),
  }
}

export const buildAiAttachmentIntentSummary = (intent: {
  route: AiAttachmentIntentRoute
  reason: AiAttachmentIntentReason
}) => {
  if (intent.route === 'create') {
    return i18next.t('aiAttachmentIntent.createRouteDetected')
  }
  if (intent.route === 'analyze') {
    return i18next.t('aiAttachmentIntent.analysisRouteDetected')
  }
  if (intent.reason === 'mixed_goal') {
    return i18next.t('aiAttachmentIntent.mixedGoalNeedsClarification')
  }
  if (intent.reason === 'attachment_only') {
    return i18next.t('aiAttachmentIntent.attachmentOnlyNeedsIntent')
  }
  return i18next.t('aiAttachmentIntent.ambiguousIntentNeedsClarification')
}

export const buildAiAttachmentMessageMetadata = (
  attachments: AiAttachmentReference[],
  attachmentIntent: AiAttachmentIntentHint,
): AiAttachmentMessageMetadata => ({
  attachments,
  attachmentIntent: {
    route: attachmentIntent.route,
    reason: attachmentIntent.reason,
    summary: attachmentIntent.summary || buildAiAttachmentIntentSummary(attachmentIntent),
  },
})

export const formatAiAttachmentKindLabel = (kind: AiAttachmentKind) => {
  if (kind === 'excel') {
    return 'Excel'
  }
  if (kind === 'image') {
    return i18next.t('aiAttachmentIntent.image')
  }
  if (kind === 'audio') {
    return i18next.t('aiAttachmentIntent.audio')
  }
  if (kind === 'document') {
    return i18next.t('aiAttachmentIntent.document')
  }
  if (kind === 'text') {
    return i18next.t('aiAttachmentIntent.text')
  }
  if (kind === 'archive') {
    return i18next.t('aiAttachmentIntent.archive')
  }
  return i18next.t('aiAttachmentIntent.file')
}

export const formatAiAttachmentRouteLabel = (route: AiAttachmentIntentRoute) => {
  if (route === 'create') {
    return i18next.t('aiAttachmentIntent.create')
  }
  if (route === 'analyze') {
    return i18next.t('aiAttachmentIntent.analyze')
  }
  return i18next.t('aiAttachmentIntent.clarify')
}

export const hasExcelLikeAttachment = (attachments: AiAttachmentReference[]) => (
  (attachments || []).some(item => item.kind === 'excel')
)

export const hasAiAttachmentUploadHandle = (
  attachment?: Pick<AiAttachmentReference, 'uploadHandle'> | null,
) => Boolean(normalizeText(attachment?.uploadHandle?.fullPath))

export const resolveAiAttachmentImportSourcePath = (
  attachment?: Pick<AiAttachmentReference, 'uploadHandle'> | null,
) => (
  normalizeText(attachment?.uploadHandle?.originFilePath)
  || normalizeText(attachment?.uploadHandle?.fullPath)
  || undefined
)

export const resolveUniqueReadyExcelAttachment = <T extends AiAttachmentReference>(
  attachments: T[],
): T | null => {
  const excelAttachments = (attachments || []).filter(item => (
    item.kind === 'excel' && hasAiAttachmentUploadHandle(item)
  ))

  return excelAttachments.length === 1
    ? excelAttachments[0]
    : null
}

export const resolveLatestExcelAttachment = <T extends { kind?: string }>(
  attachments: T[],
): T | null => {
  const excelAttachments = (attachments || []).filter(item => item.kind === 'excel')
  return excelAttachments.length
    ? excelAttachments[excelAttachments.length - 1]
    : null
}

export const replaceCurrentExcelAttachment = <T extends { kind?: string }>(
  attachments: T[],
  nextExcel?: T | null,
): T[] => {
  const preservedAttachments = (attachments || []).filter(item => item.kind !== 'excel')
  return nextExcel
    ? [...preservedAttachments, nextExcel]
    : preservedAttachments
}

export const buildAiAttachmentFallbackRequestText = (
  attachmentIntent: AiAttachmentIntentHint,
) => {
  if (attachmentIntent.route === 'create') {
    return i18next.t('aiAttachmentIntent.createFromAttachmentRequest')
  }
  if (attachmentIntent.route === 'analyze') {
    return i18next.t('aiAttachmentIntent.analyzeAttachmentRequest')
  }
  return i18next.t('aiAttachmentIntent.clarifyAttachmentRequest')
}

export const buildAiAttachmentPromptLines = (
  metadata: AiAttachmentMessageMetadata,
) => {
  const normalized = normalizeAiAttachmentMessageMetadata(metadata)
  if (!normalized.attachments.length) {
    return []
  }

  const lines = [
    '本轮附件摘要：',
    ...normalized.attachments.map(item => `- [${formatAiAttachmentKindLabel(item.kind)}] ${item.name}`),
  ]

  const attachmentIntent = normalized.attachmentIntent
  if (!attachmentIntent) {
    return lines
  }

  lines.push(`附件路由骨架：${formatAiAttachmentRouteLabel(attachmentIntent.route)}。`)
  if (attachmentIntent.route === 'create') {
    lines.push('约束：附件只是创建材料，不代表你已经读取过文件内容；只有用户明确要求创建时才允许输出创建交接。')
  } else if (attachmentIntent.route === 'analyze') {
    lines.push('约束：本轮按附件分析处理，不要输出创建交接，也不要把附件分析伪装成 search_apps、get_app_memory、read_app_data 三工具链。')
  } else {
    lines.push('约束：不要默认把附件当成创建或分析命令；先用一句很短的问题澄清当前是要创建还是分析。')
  }

  return lines
}
