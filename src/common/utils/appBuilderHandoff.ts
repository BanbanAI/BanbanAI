import type {
  AppBuilderCreationMode,
  AppBuilderHandoff,
  AppBuilderHandoffStatus,
} from '@common/types/appBuilderHandoff'
import type { AiAttachmentReference } from '@common/types/aiAttachment'

const APP_BUILDER_CREATION_MODES = new Set<AppBuilderCreationMode>([
  'create_new_app',
  'extend_existing_app',
  'undecided',
])
const APP_BUILDER_HANDOFF_STATUSES = new Set<AppBuilderHandoffStatus>([
  'ready',
  'continuing',
  'consumed',
  'abandoned',
])

const APP_BUILDER_INTENT_KINDS = new Set(['create_app', 'create_form'])
const APP_BUILDER_SOURCE_KINDS = new Set(['user_request', 'analysis_inference'])
const APP_BUILDER_REFERENCE_KINDS = new Set(['analysis_fact', 'metric', 'dimension', 'record_pattern'])
const APP_BUILDER_MATERIAL_EXCEL_EXTENSIONS = new Set(['xls', 'xlsx'])
const APP_BUILDER_MATERIAL_EXCEL_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export const normalizeAppBuilderHandoff = (value: unknown): AppBuilderHandoff | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, any>
  const creationMode = String(raw.scope?.creationMode || '').trim()
  if (!APP_BUILDER_CREATION_MODES.has(creationMode as AppBuilderCreationMode)) {
    return null
  }

  const intentKind = String(raw.intent?.kind || '').trim()
  if (!APP_BUILDER_INTENT_KINDS.has(intentKind)) {
    return null
  }

  const intentConfidence = normalizeRequiredConfidence(raw.intent?.confidence)
  if (intentConfidence === null) {
    return null
  }

  return {
    version: 'v1',
    handoffId: String(raw.handoffId || '').trim(),
    ...withOptional('status', normalizeStatus(raw.status)),
    source: {
      threadId: String(raw.source?.threadId || '').trim(),
      messageId: String(raw.source?.messageId || '').trim(),
      agentType: 'analysis',
      trigger: raw.source?.trigger === 'assistant_suggested' ? 'assistant_suggested' : 'explicit_user_request',
    },
    intent: {
      kind: intentKind as AppBuilderHandoff['intent']['kind'],
      confidence: intentConfidence,
      entryTitle: String(raw.intent?.entryTitle || '').trim(),
    },
    scope: {
      creationMode: creationMode as AppBuilderCreationMode,
      ...withOptional('createdApp', normalizeCreatedApp(raw.scope?.createdApp)),
      ...withOptional('targetApp', normalizeTargetApp(raw.scope?.targetApp)),
      ...withOptional('candidateApps', normalizeCandidateApps(raw.scope?.candidateApps)),
    },
    draft: {
      appName: String(raw.draft?.appName || '').trim() || undefined,
      goal: String(raw.draft?.goal || '').trim(),
      summary: String(raw.draft?.summary || '').trim(),
      candidateForms: normalizeCandidateForms(raw.draft?.candidateForms),
      candidateFlows: normalizeTextArray(raw.draft?.candidateFlows),
      openQuestions: normalizeTextArray(raw.draft?.openQuestions),
      assumptions: normalizeTextArray(raw.draft?.assumptions),
    },
    ...withOptional('materials', normalizeMaterials(raw.materials)),
    references: normalizeReferences(raw.references),
  }
}

const normalizeStatus = (value: unknown): AppBuilderHandoffStatus | undefined => {
  const status = String(value || '').trim()
  return APP_BUILDER_HANDOFF_STATUSES.has(status as AppBuilderHandoffStatus)
    ? status as AppBuilderHandoffStatus
    : undefined
}

const withOptional = <K extends string, V>(key: K, value: V | undefined) => (
  value === undefined ? {} : { [key]: value } as Record<K, V>
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const clampConfidence = (value: number) => Math.min(1, Math.max(0, value))

const parseConfidenceValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (Array.isArray(value) || typeof value === 'boolean') {
    return null
  }
  if (typeof value === 'string' && !value.trim()) {
    return null
  }
  const normalized = Number(value)
  return Number.isFinite(normalized) ? clampConfidence(normalized) : null
}

const normalizeRequiredConfidence = (value: unknown) => parseConfidenceValue(value)

const normalizeOptionalConfidence = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  return parseConfidenceValue(value) ?? undefined
}

const normalizeSource = (value: unknown) => {
  const source = String(value || '').trim()
  return APP_BUILDER_SOURCE_KINDS.has(source) ? source as 'user_request' | 'analysis_inference' : undefined
}

const normalizeCreatedApp = (value: unknown): AppBuilderHandoff['scope']['createdApp'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const appId = String(value.appId || '').trim()
  const appName = String(value.appName || '').trim()
  const createdAt = Number(value.createdAt || 0)
  if (!appId) {
    return undefined
  }

  return {
    appId,
    ...(appName ? { appName } : {}),
    ...(Number.isFinite(createdAt) && createdAt > 0 ? { createdAt } : {}),
  }
}

const normalizeTargetApp = (value: unknown): AppBuilderHandoff['scope']['targetApp'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const appId = String(value.appId || '').trim()
  const appName = String(value.appName || '').trim()
  const confidence = normalizeOptionalConfidence(value.confidence)
  const source = normalizeSource(value.source)
  const targetApp = {
    ...(appId ? { appId } : {}),
    ...(appName ? { appName } : {}),
    ...(confidence === undefined ? {} : { confidence }),
    ...(source ? { source } : {}),
  }
  return Object.keys(targetApp).length > 0 ? targetApp : undefined
}

const normalizeCandidateApps = (value: unknown): AppBuilderHandoff['scope']['candidateApps'] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value
    .map(item => {
      if (!isRecord(item)) {
        return null
      }

      const appName = String(item.appName || '').trim()
      const confidence = normalizeOptionalConfidence(item.confidence)
      const source = normalizeSource(item.source)
      if (!appName || confidence === undefined || !source) {
        return null
      }

      const appId = String(item.appId || '').trim()
      return {
        ...(appId ? { appId } : {}),
        appName,
        confidence,
        source,
      }
    })
    .filter(Boolean) as NonNullable<AppBuilderHandoff['scope']['candidateApps']>
  return items.length > 0 ? items : undefined
}

const normalizeCandidateForms = (value: unknown): AppBuilderHandoff['draft']['candidateForms'] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => {
      if (!isRecord(item)) {
        return null
      }

      const name = String(item.name || '').trim()
      if (!name) {
        return null
      }

      const purpose = String(item.purpose || '').trim()
      return {
        name,
        ...(purpose ? { purpose } : {}),
        fields: normalizeCandidateFields(item.fields),
      }
    })
    .filter(Boolean) as AppBuilderHandoff['draft']['candidateForms']
}

const normalizeCandidateFields = (value: unknown): AppBuilderHandoff['draft']['candidateForms'][number]['fields'] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => {
      if (!isRecord(item)) {
        return null
      }

      const name = String(item.name || '').trim()
      if (!name) {
        return null
      }

      const type = String(item.type || '').trim()
      const description = String(item.description || '').trim()
      const source = normalizeSource(item.source)
      return {
        name,
        ...(type ? { type } : {}),
        ...(typeof item.required === 'boolean' ? { required: item.required } : {}),
        ...(description ? { description } : {}),
        ...(source ? { source } : {}),
      }
    })
    .filter(Boolean) as AppBuilderHandoff['draft']['candidateForms'][number]['fields']
}

const normalizeTextArray = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    : []
)

type AppBuilderHandoffMaterialAttachment = NonNullable<
  NonNullable<AppBuilderHandoff['materials']>['attachments']
>[number]
type AppBuilderHandoffMaterialUploadHandle = AppBuilderHandoffMaterialAttachment['uploadHandle']

const normalizeMaterialExtension = (value: unknown) => (
  String(value || '').trim().replace(/^\./, '').toLowerCase()
)

const normalizeMaterialMimeType = (value: unknown) => (
  String(value || '').trim().split(';')[0].trim().toLowerCase()
)

const resolveMaterialNameExtension = (value: string) => (
  normalizeMaterialExtension((value.split('.').pop() || ''))
)

export const isAppBuilderHandoffExcelMaterialFile = (options: {
  name?: unknown
  mimeType?: unknown
  extension?: unknown
}) => {
  const extension = normalizeMaterialExtension(options.extension)
  const nameExtension = resolveMaterialNameExtension(String(options.name || ''))
  const mimeType = normalizeMaterialMimeType(options.mimeType)
  return (
    APP_BUILDER_MATERIAL_EXCEL_EXTENSIONS.has(extension)
    || APP_BUILDER_MATERIAL_EXCEL_EXTENSIONS.has(nameExtension)
    || APP_BUILDER_MATERIAL_EXCEL_MIME_TYPES.has(mimeType)
  )
}

export const normalizeAppBuilderHandoffExcelMaterialAttachment = (
  value: unknown,
): AppBuilderHandoffMaterialAttachment | null => {
  if (!isRecord(value)) {
    return null
  }

  const name = String(value.name || '').trim()
  const uploadHandle = normalizeMaterialUploadHandle(value.uploadHandle)
  if (!name || !uploadHandle) {
    return null
  }

  const mimeType = String(value.mimeType || '').trim()
  const extension = normalizeMaterialExtension(value.extension)
  if (!isAppBuilderHandoffExcelMaterialFile({ name, mimeType, extension })) {
    return null
  }

  const size = Number(value.size || 0)
  return {
    name,
    ...(mimeType ? { mimeType } : {}),
    ...(extension ? { extension } : {}),
    ...(Number.isFinite(size) && size > 0 ? { size } : {}),
    uploadHandle,
  }
}

export const buildUniqueAppBuilderHandoffExcelMaterials = (
  value: unknown,
): AppBuilderHandoff['materials'] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const attachments = value
    .map(item => normalizeAppBuilderHandoffExcelMaterialAttachment(item))
    .filter(Boolean) as AppBuilderHandoffMaterialAttachment[]

  return attachments.length === 1
    ? { attachments }
    : undefined
}

export const resolveAppBuilderHandoffExcelAttachmentReference = (
  handoff?: Pick<AppBuilderHandoff, 'handoffId' | 'materials'> | null,
): AiAttachmentReference | null => {
  const attachment = handoff?.materials?.attachments?.[0]
  const name = String(attachment?.name || '').trim()
  const fullPath = String(attachment?.uploadHandle?.fullPath || '').trim()
  if (!name || !fullPath) {
    return null
  }

  const fallbackId = `${String(handoff?.handoffId || 'handoff').trim() || 'handoff'}-excel-material-1`
  const attachmentId = String(attachment?.uploadHandle?.id || '').trim() || fallbackId
  const mimeType = String(attachment?.mimeType || '').trim()
  const extension = normalizeMaterialExtension(attachment?.extension)
  const size = Number(attachment?.size || 0)
  const sessionId = String(attachment?.uploadHandle?.sessionId || '').trim()
  const originFilePath = String(attachment?.uploadHandle?.originFilePath || '').trim()

  return {
    id: attachmentId,
    kind: 'excel',
    name,
    ...(mimeType ? { mimeType } : {}),
    ...(extension ? { extension } : {}),
    ...(Number.isFinite(size) && size > 0 ? { size } : {}),
    uploadHandle: {
      id: attachmentId,
      fullPath,
      ...(sessionId ? { sessionId } : {}),
      ...(originFilePath ? { originFilePath } : {}),
    },
  }
}

const normalizeMaterialUploadHandle = (
  value: unknown,
): AppBuilderHandoffMaterialUploadHandle | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const fullPath = String(value.fullPath || '').trim()
  if (!fullPath) {
    return undefined
  }

  const id = String(value.id || '').trim()
  const sessionId = String(value.sessionId || '').trim()
  const originFilePath = String(value.originFilePath || '').trim()
  return {
    fullPath,
    ...(id ? { id } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(originFilePath ? { originFilePath } : {}),
  }
}

const normalizeMaterials = (value: unknown): AppBuilderHandoff['materials'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  return buildUniqueAppBuilderHandoffExcelMaterials(value.attachments)
}

const normalizeReferences = (value: unknown): AppBuilderHandoff['references'] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => {
      if (!isRecord(item) || !isRecord(item.provenance)) {
        return null
      }

      const kind = String(item.kind || '').trim()
      const text = String(item.text || '').trim()
      const messageId = String(item.provenance.messageId || '').trim()
      if (!APP_BUILDER_REFERENCE_KINDS.has(kind) || !text || !messageId) {
        return null
      }

      const appId = String(item.provenance.appId || '').trim()
      const sourceId = String(item.provenance.sourceId || '').trim()
      return {
        kind: kind as AppBuilderHandoff['references'][number]['kind'],
        text,
        provenance: {
          messageId,
          ...(appId ? { appId } : {}),
          ...(sourceId ? { sourceId } : {}),
        },
      }
    })
    .filter(Boolean) as AppBuilderHandoff['references']
}
