import type { AppBuilderHandoff } from '@common/types/appBuilderHandoff'
import type { AiAttachment, AiAttachmentReference } from '@common/types/aiAttachment'
import { buildAiAttachmentMessageMetadata } from '@common/utils/aiAttachmentIntent'
import { resolveAppBuilderHandoffExcelAttachmentReference } from '@common/utils/appBuilderHandoff'
import i18next from 'i18next'

export const IMPORTED_HANDOFF_AUTO_REPLAY_FLAG = 'importedHandoffAutoReplay'
export const IMPORTED_HANDOFF_VISIBLE_CARD_FLAG = 'importedHandoffVisibleCard'
export const IMPORTED_HANDOFF_IMPORTED_FLAG = 'handoffImported'

type MessageLike = {
  metadata?: Record<string, unknown> | null
}

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const getMessageMetadataRecord = (message: MessageLike | null | undefined) => (
  isRecord(message?.metadata) ? message.metadata : null
)

const resolveImportedHandoffTitle = (handoff: AppBuilderHandoff) => (
  normalizeText(handoff.intent?.entryTitle)
  || normalizeText(handoff.draft?.appName)
  || normalizeText(handoff.draft?.candidateForms?.[0]?.name)
)

const resolveImportedHandoffMaterialAttachments = (
  handoff: AppBuilderHandoff,
): AiAttachmentReference[] => (
  (handoff.materials?.attachments || [])
    .map((attachment, index) => {
      const name = normalizeText(attachment?.name)
      const uploadHandleId = normalizeText(attachment?.uploadHandle?.id)
      const uploadHandleFullPath = normalizeText(attachment?.uploadHandle?.fullPath)
      if (!name || !uploadHandleFullPath) {
        return null
      }

      return {
        id: uploadHandleId || `${normalizeText(handoff.handoffId) || 'handoff'}-excel-material-${index + 1}`,
        kind: 'excel' as const,
        name,
        ...(normalizeText(attachment?.mimeType) ? { mimeType: normalizeText(attachment?.mimeType) } : {}),
        ...(normalizeText(attachment?.extension) ? { extension: normalizeText(attachment?.extension) } : {}),
        ...(Number.isFinite(Number(attachment?.size)) && Number(attachment?.size) > 0
          ? { size: Number(attachment?.size) }
          : {}),
        uploadHandle: {
          id: uploadHandleId || `${normalizeText(handoff.handoffId) || 'handoff'}-excel-material-${index + 1}`,
          fullPath: uploadHandleFullPath,
          ...(normalizeText(attachment?.uploadHandle?.sessionId)
            ? { sessionId: normalizeText(attachment?.uploadHandle?.sessionId) }
            : {}),
          ...(normalizeText(attachment?.uploadHandle?.originFilePath)
            ? { originFilePath: normalizeText(attachment?.uploadHandle?.originFilePath) }
            : {}),
        },
      }
    })
    .filter(Boolean) as AiAttachmentReference[]
)

export const buildImportedHandoffComposerAttachments = (
  handoff: AppBuilderHandoff,
): AiAttachment[] => {
  const excelAttachment = resolveAppBuilderHandoffExcelAttachmentReference(handoff)
  if (!excelAttachment) {
    return []
  }

  return [{
    ...excelAttachment,
    status: 'ready',
    source: 'uploaded',
  }]
}

const resolveImportedHandoffMaterialSummary = (handoff: AppBuilderHandoff) => (
  resolveImportedHandoffMaterialAttachments(handoff)
    .map(item => normalizeText(item.name))
    .filter(Boolean)
    .join('、')
)

const resolveImportedHandoffCreationModeText = (handoff: AppBuilderHandoff) => {
  const mode = normalizeText(handoff.scope?.creationMode)
  if (mode === 'create_new_app') {
    return i18next.t('appBuilderHandoffAutoReplay.createNewApp')
  }
  if (mode === 'extend_existing_app') {
    return i18next.t('appBuilderHandoffAutoReplay.extendCurrentApp')
  }
  return i18next.t('appBuilderHandoffAutoReplay.creationScopePending')
}

const hasAutoReplayMarker = (
  metadata: Record<string, unknown> | null,
  handoffId: string,
) => {
  if (!metadata) {
    return false
  }
  if (
    metadata[IMPORTED_HANDOFF_AUTO_REPLAY_FLAG] === true
    && normalizeText(metadata.handoffId) === handoffId
  ) {
    return true
  }

  const requestMetadata = isRecord(metadata.requestMetadata)
    ? metadata.requestMetadata
    : null
  return Boolean(
    requestMetadata?.[IMPORTED_HANDOFF_AUTO_REPLAY_FLAG] === true
    && normalizeText(requestMetadata?.handoffId) === handoffId,
  )
}

export const hasImportedHandoffAutoReplayInMessages = (
  messages: MessageLike[] | null | undefined,
  handoffId: string,
) => {
  const normalizedHandoffId = normalizeText(handoffId)
  if (!normalizedHandoffId) {
    return false
  }

  const normalizedMessages = Array.isArray(messages) ? messages : []
  return normalizedMessages.some(message => hasAutoReplayMarker(
    getMessageMetadataRecord(message),
    normalizedHandoffId,
  ))
}

export const buildImportedHandoffAutoReplayPrompt = (handoff: AppBuilderHandoff) => {
  const goal = normalizeText(handoff.draft?.goal)
  const title = normalizeText(handoff.intent?.entryTitle)
    || normalizeText(handoff.draft?.appName)
    || normalizeText(handoff.draft?.candidateForms?.[0]?.name)
  const targetAppName = normalizeText(handoff.scope?.targetApp?.appName)
  const materialSummary = resolveImportedHandoffMaterialSummary(handoff)
  const materialAttachmentCount = resolveImportedHandoffMaterialAttachments(handoff).length
  const mode = normalizeText(handoff.scope?.creationMode)
  const modeText = mode === 'create_new_app'
    ? '创建模式：新建应用'
    : mode === 'extend_existing_app'
      ? '创建模式：添加到已有应用'
      : '创建模式：待确认'
  const scopeHint = mode === 'create_new_app'
    ? '范围提示：当前已新建应用容器，请按新应用语境继续推进。creationMode 只决定应用容器的创建方式，不代表必须进入应用级规划；如果需求只包含一张完整表单，即使还包含审批流程意图，也应保持单表单规划。'
    : mode === 'extend_existing_app'
      ? '范围提示：这是一个在当前已打开应用中继续扩展的任务，请保持该语境推进，不要改写已知创建范围。'
      : '范围提示：当前创建范围仍待确认，请保持中性理解，只基于已知信息推进，不要擅自改写已知创建范围。'
  const executionHint = '执行提示：请像用户在当前编辑器直接输入这条需求一样处理，继续走当前编辑器 AI 的正常规划工具链，不要只复述导入草稿。'
  const lines = [
    '【工作台转交】用户在工作台提出了一个创建需求，现在已经进入低代码编辑器。',
    title ? `需求标题：${title}` : '',
    targetAppName ? `目标应用：${targetAppName}` : '',
    modeText,
    materialSummary
      ? `本轮还附带 ${materialAttachmentCount} 个 Excel 创建材料：${materialSummary}`
      : '',
    goal ? `原始需求：${goal}` : '',
    scopeHint,
    executionHint,
  ]

  return lines.map(normalizeText).filter(Boolean).join('\n')
}

export const buildImportedHandoffVisibleUserMessage = (handoff: AppBuilderHandoff) => {
  const goal = normalizeText(handoff.draft?.goal)
  const title = resolveImportedHandoffTitle(handoff)
  const targetAppName = normalizeText(handoff.scope?.targetApp?.appName)
  const modeText = resolveImportedHandoffCreationModeText(handoff)
  const materialSummary = resolveImportedHandoffMaterialSummary(handoff)

  return [
    i18next.t('appBuilderHandoffAutoReplay.visibleTitle'),
    title ? i18next.t('appBuilderHandoffAutoReplay.visibleEntryTitle', { title }) : '',
    targetAppName ? i18next.t('appBuilderHandoffAutoReplay.visibleTargetApp', { appName: targetAppName }) : '',
    i18next.t('appBuilderHandoffAutoReplay.visibleCreationMode', { mode: modeText }),
    goal ? i18next.t('appBuilderHandoffAutoReplay.visibleGoal', { goal }) : '',
    materialSummary ? i18next.t('appBuilderHandoffAutoReplay.visibleExcel', { materialSummary }) : '',
    i18next.t('appBuilderHandoffAutoReplay.visibleContinueTip'),
  ].map(normalizeText).filter(Boolean).join('\n')
}

export const buildImportedHandoffVisibleUserMetadata = (input: {
  handoff: AppBuilderHandoff
  handoffId: string
  handoffSourceThreadId: string
}) => ({
  [IMPORTED_HANDOFF_VISIBLE_CARD_FLAG]: true,
  [IMPORTED_HANDOFF_IMPORTED_FLAG]: true,
  handoffId: normalizeText(input.handoffId || input.handoff.handoffId),
  handoffSourceThreadId: normalizeText(input.handoffSourceThreadId),
  importedHandoffTitle: resolveImportedHandoffTitle(input.handoff),
  importedHandoffTargetAppName: normalizeText(input.handoff.scope?.targetApp?.appName),
  importedHandoffCreationModeText: resolveImportedHandoffCreationModeText(input.handoff),
  importedHandoffGoal: normalizeText(input.handoff.draft?.goal),
})

export const buildImportedHandoffRequestMetadata = (input: {
  handoff: AppBuilderHandoff
  handoffId: string
  handoffSourceThreadId: string
}) => {
  const attachments = resolveImportedHandoffMaterialAttachments(input.handoff)
  const attachmentMetadata = attachments.length
    ? buildAiAttachmentMessageMetadata(attachments, {
      route: 'create',
      reason: 'explicit_create',
      summary: '本轮已附带 Excel 创建材料',
    })
    : {}
  return {
    ...attachmentMetadata,
    [IMPORTED_HANDOFF_AUTO_REPLAY_FLAG]: true,
    handoffId: normalizeText(input.handoffId || input.handoff.handoffId),
    handoffSourceThreadId: normalizeText(input.handoffSourceThreadId),
  }
}

export const isImportedHandoffVisibleUserMessage = (
  message: MessageLike | null | undefined,
) => {
  const metadata = getMessageMetadataRecord(message)
  return Boolean(
    metadata?.[IMPORTED_HANDOFF_VISIBLE_CARD_FLAG]
    || metadata?.[IMPORTED_HANDOFF_AUTO_REPLAY_FLAG]
    || (isRecord(metadata?.requestMetadata) && metadata.requestMetadata[IMPORTED_HANDOFF_AUTO_REPLAY_FLAG]),
  )
}

export const shouldAutoReplayImportedHandoff = (input: {
  handoff: AppBuilderHandoff | null
  handoffId: string
  messages?: MessageLike[] | null
}) => {
  const handoffId = normalizeText(input.handoffId)
  if (!input.handoff || !handoffId) {
    return false
  }
  if (input.handoff.status === 'consumed' || input.handoff.status === 'abandoned') {
    return false
  }
  if (!normalizeText(input.handoff.draft?.goal)) {
    return false
  }
  return !hasImportedHandoffAutoReplayInMessages(input.messages, handoffId)
}
