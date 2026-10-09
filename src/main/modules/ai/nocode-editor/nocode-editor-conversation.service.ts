import { EntityManager, EntityRepository } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { buildNocodeEditorAiConversationId } from '../../../../common/utils/nocodeEditorAiConversation'
import { normalizeNocodeEditorFlowInternalContinuation } from '../../../../common/utils/nocodeEditorFlowInternalContinuation'
import { AiMessageRole } from '../ai.types'
import {
  AiNocodeEditorConversationEntity,
  AiNocodeEditorMessageEntity,
} from '../entities'
import { AiAttachmentService } from '../thread/ai-attachment.service'

type EnsureConversationPayload = {
  ownerAccountId: string
  nocodeId: string
  title?: string
  conversationId?: string
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: 'default' | 'explicit' | null
  taskId?: string
  scopeKey?: string
  source?: string
}

type AppendConversationMessagePayload = {
  role: AiMessageRole
  content: string
  traceId?: string | null
  metadata?: Record<string, unknown> | null
}

const INTERNAL_CONTINUATION_SCAN_PAGE_SIZE = 100

@Injectable()
export class AiNocodeEditorConversationService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly attachmentService: AiAttachmentService,
  ) {}

  buildConversationId(ownerAccountId: string, nocodeId: string, taskId?: string) {
    return buildNocodeEditorAiConversationId({
      accountId: ownerAccountId,
      nocodeId,
      taskId,
    })
  }

  async getOwnerConversation(ownerAccountId: string, conversationId: string) {
    const { conversationRepository } = this.createRepositories()
    const normalizedConversationId = this.normalizeConversationId(conversationId)
    if (!ownerAccountId || !normalizedConversationId) {
      return null
    }

    return await conversationRepository.findOne({
      id: normalizedConversationId,
      ownerAccountId: this.normalizeAccountId(ownerAccountId),
    })
  }

  async ensureConversation(payload: EnsureConversationPayload) {
    const { conversationRepository } = this.createRepositories()
    const ownerAccountId = this.normalizeAccountId(payload.ownerAccountId)
    const nocodeId = this.normalizeNocodeId(payload.nocodeId)
    const taskId = this.normalizeTaskId(payload.taskId)
    const scopeKey = this.normalizeScopeKey(payload.scopeKey)
    const source = this.normalizeSource(payload.source)
    const hasModelSelectionPatch = this.hasModelSelectionPatch(payload)
    const providerId = this.normalizeModelSelectionValue(payload.providerId)
    const modelId = this.normalizeModelSelectionValue(payload.modelId)
    const model = this.normalizeModelSelectionValue(payload.model)
    if (!ownerAccountId || !nocodeId) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.missingAccountOrApp'))
    }

    const explicitConversationId = this.normalizeConversationId(payload.conversationId)
    const conversationId = explicitConversationId || this.buildConversationId(
      ownerAccountId,
      nocodeId,
      taskId,
    )
    if (!conversationId) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.missingConversationId'))
    }

    let conversation = await conversationRepository.findOne({
      id: conversationId,
      ownerAccountId,
    })

    if (conversation && conversation.nocodeId !== nocodeId) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.conversationAppMismatch'))
    }

    if (!conversation) {
      conversation = new AiNocodeEditorConversationEntity()
      conversation.id = conversationId
      conversation.ownerAccountId = ownerAccountId
      conversation.nocodeId = nocodeId
      conversation.title = this.normalizeTitle(payload.title)
      conversation.providerId = providerId || null
      conversation.modelId = modelId || null
      conversation.model = model || null
      conversation.modelSelectionSource = hasModelSelectionPatch
        ? this.resolveModelSelectionSource(payload.modelSelectionSource, providerId, modelId, model)
        : null
      conversation.taskId = taskId
      conversation.scopeKey = scopeKey
      conversation.source = source
      conversation.taskSummary = null
      conversation.createTime = Date.now()
      conversation.updateTime = conversation.createTime
      conversation.lastActiveTime = conversation.createTime
      await conversationRepository.persistAndFlush(conversation)
      return conversation
    }

    let shouldPersist = false
    if (hasModelSelectionPatch) {
      const nextSource = this.resolveModelSelectionSource(payload.modelSelectionSource, providerId, modelId, model)
      if (
        conversation.providerId !== (providerId || null)
        || conversation.modelId !== (modelId || null)
        || conversation.model !== (model || null)
        || conversation.modelSelectionSource !== nextSource
      ) {
        conversation.providerId = providerId || null
        conversation.modelId = modelId || null
        conversation.model = model || null
        conversation.modelSelectionSource = nextSource
        shouldPersist = true
      }
    }
    if (
      payload.title
      && conversation.title === AiNocodeEditorConversationEntity.DEFAULT_TITLE
    ) {
      conversation.title = this.normalizeTitle(payload.title)
      shouldPersist = true
    }

    if (taskId && conversation.taskId !== taskId) {
      conversation.taskId = taskId
      shouldPersist = true
    }
    if (scopeKey && conversation.scopeKey !== scopeKey) {
      conversation.scopeKey = scopeKey
      shouldPersist = true
    }
    if (source && conversation.source !== source) {
      conversation.source = source
      shouldPersist = true
    }
    if (shouldPersist) {
      const now = Date.now()
      conversation.updateTime = now
      conversation.lastActiveTime = now
      await conversationRepository.persistAndFlush(conversation)
    }
    return conversation
  }

  async findLatestConversationForApp(ownerAccountId: string, nocodeId: string, excludeConversationId?: string) {
    const { conversationRepository } = this.createRepositories()
    const normalizedOwnerAccountId = this.normalizeAccountId(ownerAccountId)
    const normalizedNocodeId = this.normalizeNocodeId(nocodeId)
    const normalizedExcludeConversationId = this.normalizeConversationId(excludeConversationId)
    if (!normalizedOwnerAccountId || !normalizedNocodeId) {
      return null
    }

    const conversations = await conversationRepository.find({
      ownerAccountId: normalizedOwnerAccountId,
      nocodeId: normalizedNocodeId,
      taskId: {
        $ne: '',
      },
      ...(normalizedExcludeConversationId
        ? {
          id: {
            $ne: normalizedExcludeConversationId,
          },
        }
        : {}),
    }, {
      orderBy: {
        lastActiveTime: 'DESC',
        updateTime: 'DESC',
        createTime: 'DESC',
      },
      limit: 1,
    })

    return conversations[0] || null
  }

  async deleteOwnerConversation(ownerAccountId: string, conversationId: string) {
    const conversation = await this.getOwnerConversation(ownerAccountId, conversationId)
    if (!conversation) return { deleted: false }
    const cleaned = await this.attachmentService.cleanupThread(ownerAccountId, conversation.id)
    if (!cleaned.cleaned) throw new Error('Failed to clean nocode editor AI attachments')
    const { conversationRepository, messageRepository } = this.createRepositories()
    await messageRepository.nativeDelete({ conversationId: conversation.id, ownerAccountId: this.normalizeAccountId(ownerAccountId) })
    await conversationRepository.nativeDelete({ id: conversation.id, ownerAccountId: this.normalizeAccountId(ownerAccountId) })
    return { deleted: true, conversationId: conversation.id }
  }

  async deleteConversationsForApps(nocodeIds: string[]) {
    const normalizedNocodeIds = [...new Set(nocodeIds
      .map(nocodeId => this.normalizeNocodeId(nocodeId))
      .filter(Boolean))]
    if (!normalizedNocodeIds.length) {
      return { conversationCount: 0 }
    }

    const { conversationRepository, messageRepository } = this.createRepositories()
    const conversations = await conversationRepository.find({
      nocodeId: { $in: normalizedNocodeIds },
    })
    const cleanupResults = await Promise.all(conversations.map(conversation => (
      this.attachmentService.cleanupThread(conversation.ownerAccountId, conversation.id)
    )))
    const appCleanupResults = await Promise.all(normalizedNocodeIds.map(nocodeId => (
      this.attachmentService.cleanupNocodeEditorAppStorage(nocodeId)
    )))
    if (
      cleanupResults.some(result => !result.cleaned)
      || appCleanupResults.some(result => !result.cleaned)
    ) {
      throw new Error('Failed to clean nocode editor AI attachments')
    }

    const conversationIds = conversations.map(conversation => conversation.id)
    if (conversationIds.length) {
      await messageRepository.nativeDelete({ conversationId: { $in: conversationIds } })
      await conversationRepository.nativeDelete({ id: { $in: conversationIds } })
    }
    return { conversationCount: conversationIds.length }
  }

  async updateConversationTaskSummary(ownerAccountId: string, conversationId: string, summary: Record<string, unknown> | null) {
    const { conversationRepository } = this.createRepositories()
    const conversation = await this.getOwnerConversation(ownerAccountId, conversationId)
    if (!conversation) {
      return null
    }

    const now = Date.now()
    conversation.taskSummary = summary && typeof summary === 'object' && !Array.isArray(summary)
      ? summary
      : null
    conversation.updateTime = now
    conversation.lastActiveTime = now
    await conversationRepository.persistAndFlush(conversation)
    return conversation
  }

  async listMessagesForConversation(
    ownerAccountId: string,
    conversationId: string,
    limit = 50,
    offset = 0,
    options?: {
      includeToolMessages?: boolean
      includeTimelineMeta?: boolean
    },
  ) {
    const { messageRepository } = this.createRepositories()
    const conversation = await this.getOwnerConversation(ownerAccountId, conversationId)
    if (!conversation) {
      return []
    }

    const roles = options?.includeToolMessages
      ? [AiMessageRole.USER, AiMessageRole.ASSISTANT, AiMessageRole.TOOL]
      : [AiMessageRole.USER, AiMessageRole.ASSISTANT]

    const messages = await messageRepository.find({
      conversationId: conversation.id,
      ownerAccountId: this.normalizeAccountId(ownerAccountId),
      role: {
        $in: roles,
      },
    }, {
      limit,
      offset,
      orderBy: {
        sequence: 'DESC',
      },
    })
    const visibleMessages = messages.filter(message => !this.isMessageSuperseded(message))

    if (!options?.includeTimelineMeta) {
      return visibleMessages
    }

    const rawMessageCount = await messageRepository.count({
      conversationId: conversation.id,
      ownerAccountId: this.normalizeAccountId(ownerAccountId),
      role: {
        $in: roles,
      },
    })

    return {
      messages: visibleMessages,
      taskSummary: conversation.taskSummary || null,
      providerId: conversation.providerId || null,
      modelId: conversation.modelId || null,
      model: conversation.model || null,
      modelSelectionSource: conversation.modelSelectionSource || null,
      timeline: {
        limit,
        offset,
        rawMessageCount,
        returnedMessageCount: visibleMessages.length,
        hasMoreBefore: rawMessageCount > offset + messages.length,
      },
    }
  }

  async hasInternalContinuationKey(
    ownerAccountId: string,
    conversationId: string,
    continuationKey: string,
  ) {
    const normalizedContinuationKey = String(continuationKey || '').trim()
    if (!normalizedContinuationKey) {
      return false
    }

    const { messageRepository } = this.createRepositories()
    const conversation = await this.getOwnerConversation(ownerAccountId, conversationId)
    if (!conversation) {
      return false
    }

    let beforeSequence: number | null = null
    let beforeId = ''
    while (beforeSequence === null || beforeId) {
      const messages = await messageRepository.find({
        conversationId: conversation.id,
        ownerAccountId: this.normalizeAccountId(ownerAccountId),
        role: AiMessageRole.ASSISTANT,
        ...(beforeSequence === null
          ? {}
          : {
            $or: [{
              sequence: {
                $lt: beforeSequence,
              },
            }, {
              sequence: beforeSequence,
              id: {
                $lt: beforeId,
              },
            }],
          }),
      }, {
        limit: INTERNAL_CONTINUATION_SCAN_PAGE_SIZE,
        orderBy: {
          sequence: 'DESC',
          id: 'DESC',
        },
      })

      if (messages.some(message => (
        message.metadata?.internalContinuationCompleted === true
        &&
        normalizeNocodeEditorFlowInternalContinuation(
          message.metadata?.nocodeEditorInternalContinuation,
        )?.key === normalizedContinuationKey
      ))) {
        return true
      }
      if (messages.length < INTERNAL_CONTINUATION_SCAN_PAGE_SIZE) {
        return false
      }

      const lastMessage = messages[messages.length - 1]
      const nextBeforeSequence = Number(lastMessage?.sequence)
      const nextBeforeId = String(lastMessage?.id || '').trim()
      if (
        !Number.isFinite(nextBeforeSequence)
        || !nextBeforeId
        || (beforeSequence === nextBeforeSequence && beforeId === nextBeforeId)
      ) {
        return false
      }
      beforeSequence = nextBeforeSequence
      beforeId = nextBeforeId
    }
    return false
  }

  async appendMessage(
    conversation: Pick<AiNocodeEditorConversationEntity, 'id' | 'ownerAccountId' | 'nocodeId' | 'title'>,
    payload: AppendConversationMessagePayload,
  ) {
    const { conversationRepository, messageRepository } = this.createRepositories()
    const sequence = await messageRepository.count({ conversationId: conversation.id }) + 1
    const message = new AiNocodeEditorMessageEntity()
    message.conversationId = this.normalizeConversationId(conversation.id)
    message.ownerAccountId = this.normalizeAccountId(conversation.ownerAccountId)
    message.role = payload.role
    message.sequence = sequence
    message.content = String(payload.content || '')
    message.traceId = this.normalizeTraceId(payload.traceId)
    message.metadata = payload.metadata ?? null
    message.createTime = Date.now()
    await messageRepository.persistAndFlush(message)

    const managedConversation = await conversationRepository.findOne({
      id: this.normalizeConversationId(conversation.id),
      ownerAccountId: this.normalizeAccountId(conversation.ownerAccountId),
    })
    if (managedConversation) {
      if (!managedConversation.taskId && this.normalizeTaskId(payload.metadata?.taskId)) {
        managedConversation.taskId = this.normalizeTaskId(payload.metadata?.taskId)
      }
      if (!managedConversation.scopeKey && this.normalizeScopeKey(payload.metadata?.taskScopeKey || payload.metadata?.scopeKey)) {
        managedConversation.scopeKey = this.normalizeScopeKey(payload.metadata?.taskScopeKey || payload.metadata?.scopeKey)
      }
      if (!managedConversation.source && this.normalizeSource(payload.metadata?.taskSource || payload.metadata?.source)) {
        managedConversation.source = this.normalizeSource(payload.metadata?.taskSource || payload.metadata?.source)
      }
      if (
        payload.role === AiMessageRole.USER
        && (!managedConversation.title || managedConversation.title === AiNocodeEditorConversationEntity.DEFAULT_TITLE)
      ) {
        managedConversation.title = this.buildConversationTitle(payload.content)
      }
      managedConversation.updateTime = Date.now()
      managedConversation.lastActiveTime = managedConversation.updateTime
      await conversationRepository.persistAndFlush(managedConversation)
    }

    return message
  }

  async supersedeOwnerMessageTurn(options: {
    ownerAccountId: string
    conversationId: string
    messageId: string
    supersededByTraceId?: string
  }) {
    const { messageRepository } = this.createRepositories()
    const conversation = await this.getOwnerConversation(options.ownerAccountId, options.conversationId)
    const messageId = String(options.messageId || '').trim()
    if (!conversation || !messageId) {
      return null
    }

    const sourceMessage = await messageRepository.findOne({
      id: messageId,
      conversationId: conversation.id,
      ownerAccountId: this.normalizeAccountId(options.ownerAccountId),
      role: AiMessageRole.USER,
    })
    if (!sourceMessage) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.currentConversationUserMessageOnly'))
    }
    if (this.isMessageSuperseded(sourceMessage)) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.messageChangedRefresh'))
    }
    await this.assertLatestVisibleUserMessage(messageRepository, sourceMessage)

    if (!this.normalizeTraceId(sourceMessage.traceId)) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.messageTurnMissing'))
    }

    const now = Date.now()
    const tailMessages = await messageRepository.find({
      conversationId: conversation.id,
      ownerAccountId: this.normalizeAccountId(options.ownerAccountId),
      sequence: {
        $gte: sourceMessage.sequence,
      },
    })
    for (const message of tailMessages) {
      if (this.isMessageSuperseded(message)) {
        continue
      }
      message.metadata = {
        ...this.normalizeMetadata(message.metadata),
        supersededAt: now,
        supersededByTraceId: this.normalizeTraceId(options.supersededByTraceId) || undefined,
      }
    }
    await messageRepository.persistAndFlush(tailMessages)

    const sourceMetadata = this.normalizeMetadata(sourceMessage.metadata)
    const editRootMessageId = String(sourceMetadata.editRootMessageId || sourceMessage.id).trim()
    const editRevision = Math.max(1, Number(sourceMetadata.editRevision || 0) + 1)
    return {
      editedFromMessageId: sourceMessage.id,
      editRootMessageId,
      editRevision,
    }
  }

  private buildConversationTitle(content: string) {
    const text = String(content || '').replace(/\s+/g, ' ').trim()
    if (!text) {
      return AiNocodeEditorConversationEntity.DEFAULT_TITLE
    }
    return text.slice(0, 24)
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return { ...(value as Record<string, unknown>) }
  }

  private isMessageSuperseded(message?: { metadata?: Record<string, unknown> | null }) {
    return Boolean(this.normalizeMetadata(message?.metadata).supersededAt)
  }

  private isMessageHiddenFromTimeline(message?: { metadata?: Record<string, unknown> | null }) {
    return Boolean(this.normalizeMetadata(message?.metadata).hiddenFromTimeline)
  }

  private async assertLatestVisibleUserMessage(
    messageRepository: EntityRepository<AiNocodeEditorMessageEntity>,
    sourceMessage: AiNocodeEditorMessageEntity,
  ) {
    const latestMessages = await messageRepository.find({
      conversationId: sourceMessage.conversationId,
      ownerAccountId: sourceMessage.ownerAccountId,
      role: AiMessageRole.USER,
    }, {
      limit: 20,
      orderBy: {
        sequence: 'DESC',
      },
    })
    const latestVisibleUserMessage = latestMessages.find(message => (
      !this.isMessageSuperseded(message)
      && !this.isMessageHiddenFromTimeline(message)
    ))
    if (latestVisibleUserMessage && latestVisibleUserMessage.id !== sourceMessage.id) {
      throw new Error(global.i18next.t('nocodeEditorConversationService.latestUserMessageOnly'))
    }
  }

  private normalizeTitle(value?: string) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim()
    return normalized || AiNocodeEditorConversationEntity.DEFAULT_TITLE
  }

  private normalizeAccountId(value: unknown) {
    return String(value || '').trim()
  }

  private normalizeNocodeId(value: unknown) {
    return String(value || '').trim()
  }

  private normalizeConversationId(value: unknown) {
    return String(value || '').trim()
  }

  private normalizeTraceId(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private normalizeTaskId(value?: unknown) {
    return String(value || '').trim()
  }

  private normalizeScopeKey(value?: unknown) {
    return String(value || '').trim()
  }

  private normalizeSource(value?: unknown) {
    return String(value || '').trim()
  }

  private normalizeModelSelectionValue(value?: unknown) {
    return String(value || '').trim()
  }

  private hasModelSelectionPatch(value?: EnsureConversationPayload) {
    return Boolean(value && (
      value.providerId !== undefined
      || value.modelId !== undefined
      || value.model !== undefined
      || value.modelSelectionSource !== undefined
    ))
  }

  private resolveModelSelectionSource(
    requestedSource: EnsureConversationPayload['modelSelectionSource'],
    providerId: string,
    modelId: string,
    model: string,
  ) {
    if (requestedSource === 'default' || requestedSource === 'explicit') {
      return requestedSource
    }
    return providerId || modelId || model ? 'explicit' : 'default'
  }

  private createRepositories() {
    const em = this.entityManager.fork()
    return {
      conversationRepository: em.getRepository(AiNocodeEditorConversationEntity),
      messageRepository: em.getRepository(AiNocodeEditorMessageEntity),
    }
  }
}
