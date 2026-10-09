import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core'
import { Injectable, Optional } from '@nestjs/common'
import type { AppBuilderHandoff } from '@common/types/appBuilderHandoff'
import {
  AiMessageRole,
  AiThread,
  AiThreadAppScope,
  AiThreadContextState,
  AiThreadModelSelection,
  AiThreadRuntimeState,
  AiThreadVisitorProfile,
} from '../ai.types'
import {
  AiAgentEntity,
  AiMessageEntity,
  AiThreadEntity,
} from '../entities'
import { AiRuntimeStateReducerService } from '../runtime/ai-runtime-state-reducer.service'
import {
  AppBuilderHandoffService,
  buildWorkbenchHandoffPreviewMetadata,
} from '../workbench-ai/app-builder-handoff.service'

type ThreadUpdatePayload = {
  title?: string
  appScope?: AiThreadAppScope | null
  providerId?: string | null
  modelId?: string | null
  model?: string | null
  modelSelectionSource?: AiThreadModelSelection['modelSelectionSource']
  pinned?: boolean
  visitorProfile?: AiThreadVisitorProfile | null
  runtimeState?: AiThreadRuntimeState | null
  contextState?: AiThreadContextState | null
}

type AppendMessagePayload = {
  role: AiMessageRole
  content: string
  traceId?: string | null
  metadata?: Record<string, unknown> | null
}

type AgentRepositoryBundle = {
  agentRepository: EntityRepository<AiAgentEntity>
}

type ThreadAgentRepositoryBundle = AgentRepositoryBundle & {
  threadRepository: EntityRepository<AiThreadEntity>
}

@Injectable()
export class AiThreadService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly runtimeStateReducerService: AiRuntimeStateReducerService,
    @Optional()
    private readonly appBuilderHandoffService?: AppBuilderHandoffService,
  ) {}

  async listOwnerThreads(ownerAccountId: string, limit = 100, offset = 0, sharing?: boolean, includeHidden = false) {
    const { threadRepository, agentRepository } = this.createRepositories()
    
    const filter: FilterQuery<AiThreadEntity> = {
      ownerAccountId,
      kind: 'private',
      deleteTime: null,
    }

    if (!includeHidden) {
      filter.hiddenTime = null
    }

    if (sharing !== undefined) {
      const agents = await agentRepository.find({
        ownerAccountId,
        sharing: Boolean(sharing),
        deleteTime: null,
      }, { fields: ['id'] })
      
      const agentIds = agents.map(item => item.id)
      if (agentIds.length === 0) {
        return []
      }
      filter.agentId = { $in: agentIds }
    }

    const threads = await threadRepository.find(filter, {
      limit,
      offset,
      orderBy: {
        pinned: 'DESC',
        pinTime: 'DESC',
        updateTime: 'DESC',
      },
    })
    const visibleThreads = threads.filter(thread => String(thread.runtimeState?.scene || '').trim() !== 'nocode-editor')

    const agentMap = await this.ensureAgentMapForOwnerThreads(visibleThreads, agentRepository, threadRepository)
    return visibleThreads.map(thread => this.toOwnerThreadSummary(
      this.materializeThreadModelSelectionSource(thread),
      agentMap.get(thread.agentId) || null,
    ))
  }

  async createOwnerThread(ownerAccountId: string, data: Partial<AiThreadEntity> = {}) {
    const { em } = this.createRepositories()
    const now = Date.now()
    const agent = new AiAgentEntity()
    agent.ownerAccountId = ownerAccountId
    agent.name = this.normalizeTitle(data.title)
    agent.appScope = this.normalizeAppScope(data.appScope)
    const modelSelection = this.normalizeModelSelection(data)
    const modelSelectionSource = this.resolveRequestedModelSelectionSource(data)
    agent.providerId = modelSelection.providerId
    agent.modelId = modelSelection.modelId
    agent.model = modelSelection.model
    agent.modelSelectionSource = modelSelectionSource
    agent.pinned = Boolean(data.pinned)
    agent.pinTime = agent.pinned ? now : null
    agent.sharing = false
    agent.shareToken = null
    agent.shareTime = null
    agent.createTime = now
    agent.updateTime = now

    const thread = new AiThreadEntity()
    thread.agentId = agent.id
    thread.ownerAccountId = ownerAccountId
    thread.kind = 'private'
    thread.title = agent.name
    thread.appScope = this.normalizeAppScope(data.appScope)
    thread.providerId = modelSelection.providerId
    thread.modelId = modelSelection.modelId
    thread.model = modelSelection.model
    thread.modelSelectionSource = modelSelectionSource
    thread.pinned = agent.pinned
    thread.pinTime = agent.pinTime
    thread.visitorProfile = this.normalizeVisitorProfile(data.visitorProfile)
    thread.runtimeState = this.normalizeRuntimeState(data.runtimeState)
    thread.contextState = this.normalizeContextState(data.contextState)
    thread.createTime = now
    thread.updateTime = now

    em.persist([agent, thread])
    await em.flush()
    return this.toOwnerThreadSummary(thread, agent)
  }

  async getOwnerThread(ownerAccountId: string, threadId: string) {
    const { threadRepository } = this.createRepositories()
    const thread = await threadRepository.findOne({
      id: threadId,
      ownerAccountId,
      deleteTime: null,
    })
    if (!thread) {
      return null
    }
    await this.ensureAgentForOwnerThread(thread)
    return this.materializeThreadModelSelectionSource(thread)
  }

  async assertOwnerThread(ownerAccountId: string, threadId: string) {
    const thread = await this.getOwnerThread(ownerAccountId, threadId)
    if (!thread) {
      throw new Error('Thread not found or access denied')
    }
    return thread
  }

  async assertOwnerPrivateThread(ownerAccountId: string, threadId: string) {
    const { threadRepository } = this.createRepositories()
    const thread = await threadRepository.findOne({
      id: threadId,
      ownerAccountId,
      kind: 'private',
      deleteTime: null,
    })
    if (!thread) {
      throw new Error('Thread not found or access denied')
    }
    await this.ensureAgentForOwnerThread(thread)
    return thread
  }

  async getOwnerThreadByAgentId(ownerAccountId: string, agentId: string) {
    const { threadRepository } = this.createRepositories()
    const thread = await threadRepository.findOne({
      ownerAccountId,
      agentId,
      kind: 'private',
      deleteTime: null,
    })
    if (!thread) {
      return null
    }
    await this.ensureAgentForOwnerThread(thread)
    return this.materializeThreadModelSelectionSource(thread)
  }

  async updateOwnerThread(ownerAccountId: string, threadId: string, data: ThreadUpdatePayload) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    return await this.applyThreadUpdate(thread, data)
  }

  async updateThreadById(threadId: string, data: ThreadUpdatePayload) {
    const thread = await this.getThreadById(threadId)
    if (!thread) {
      throw new Error('Thread not found')
    }
    return await this.applyThreadUpdate(thread, data)
  }

  async touchVisitorThreadProfile(threadId: string, profile: AiThreadVisitorProfile | null | undefined) {
    const { threadRepository } = this.createRepositories()
    const thread = await threadRepository.findOne({
      id: threadId,
      kind: 'share-visitor',
      deleteTime: null,
    })
    if (!thread) {
      return null
    }

    thread.visitorProfile = this.mergeVisitorProfile(thread.visitorProfile, profile)
    thread.updateTime = Date.now()
    await threadRepository.persistAndFlush(thread)
    return thread
  }

  async deleteOwnerThread(ownerAccountId: string, threadId: string) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    const { em, threadRepository, agentRepository } = this.createRepositories()
    const now = Date.now()
    const agent = await this.getAgentById(thread.agentId, { agentRepository })

    const relatedThreads = await threadRepository.find({
      agentId: thread.agentId,
      deleteTime: null,
    })

    relatedThreads.forEach(item => {
      item.deleteTime = now
      item.updateTime = now
    })

    if (agent) {
      agent.sharing = false
      agent.shareToken = null
      agent.shareTime = null
      agent.deleteTime = now
      agent.updateTime = now
      em.persist(agent)
    }

    em.persist(relatedThreads)
    await em.flush()

    return {
      success: true,
      id: thread.id,
      agentId: thread.agentId,
    }
  }

  async hideOwnerThread(ownerAccountId: string, threadId: string) {
    const thread = await this.assertOwnerPrivateThread(ownerAccountId, threadId)
    const { threadRepository } = this.createRepositories()
    const now = Date.now()

    thread.hiddenTime = now
    thread.updateTime = now
    await threadRepository.persistAndFlush(thread)

    return { success: true, id: thread.id, hiddenTime: now }
  }

  async unhideAllOwnerThreads(ownerAccountId: string) {
    const { em, threadRepository } = this.createRepositories()
    const threads = await threadRepository.find({
      ownerAccountId,
      kind: 'private',
      deleteTime: null,
      hiddenTime: { $ne: null },
    })
    const now = Date.now()

    threads.forEach(thread => {
      thread.hiddenTime = null
      thread.updateTime = now
    })

    if (threads.length) {
      em.persist(threads)
      await em.flush()
    }

    return { success: true, count: threads.length }
  }

  async deleteUnsharedOwnerThreads(ownerAccountId: string) {
    const { em, threadRepository, agentRepository } = this.createRepositories()
    const agents = await agentRepository.find({
      ownerAccountId,
      deleteTime: null,
      sharing: { $ne: true },
    })
    const agentIds = agents.map(agent => agent.id)

    if (!agentIds.length) {
      return { success: true, count: 0, deletedThreadIds: [] as string[] }
    }

    const threads = await threadRepository.find({
      ownerAccountId,
      agentId: { $in: agentIds },
      deleteTime: null,
    })
    const now = Date.now()
    const privateThreadCount = threads.filter(thread => thread.kind === 'private').length

    agents.forEach(agent => {
      agent.deleteTime = now
      agent.updateTime = now
    })
    threads.forEach(thread => {
      thread.deleteTime = now
      thread.updateTime = now
    })

    em.persist([...agents, ...threads])
    await em.flush()

    return {
      success: true,
      count: privateThreadCount,
      deletedThreadIds: threads.map(thread => thread.id),
    }
  }
  
  async listVisitorThreads(ownerAccountId: string, ownerThreadId: string, limit = 50, offset = 0, startTime?: number, endTime?: number) {
    const ownerThread = await this.assertOwnerThread(ownerAccountId, ownerThreadId)
    const { threadRepository } = this.createRepositories()
    
    const filter: FilterQuery<AiThreadEntity> = {
      agentId: ownerThread.agentId,
      kind: 'share-visitor',
      deleteTime: null,
    }

    if (startTime || endTime) {
      const updateTime: { $gte?: number; $lte?: number } = {}
      if (startTime) {
        updateTime.$gte = startTime
      }
      if (endTime) {
        updateTime.$lte = endTime
      }
      filter.updateTime = updateTime
    }

    const [items, total] = await threadRepository.findAndCount(filter, {
      limit,
      offset,
      orderBy: {
        updateTime: 'DESC',
      },
    })

    const itemsWithDuration = await this.attachVisitorThreadConversationDurations(items)

    return {
      items: itemsWithDuration.map(item => this.materializeThreadModelSelectionSource(item)),
      total,
    }
  }

  async listMessagesForOwner(ownerAccountId: string, threadId: string, limit = 50, offset = 0) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    const messages = await this.listMessagesByThreadId(thread.id, limit, offset)
    return await this.hydrateAppBuilderHandoffMessageMetadata(ownerAccountId, thread.id, messages)
  }

  async getAppBuilderHandoffForOwner(ownerAccountId: string, threadId: string, handoffId: string) {
    await this.assertOwnerThread(ownerAccountId, threadId)
    return await this.requireAppBuilderHandoffService().getHandoffForOwner(ownerAccountId, threadId, handoffId)
  }

  async resolveAppBuilderHandoffForOwner(
    ownerAccountId: string,
    threadId: string,
    handoffId: string,
    body: {
      creationMode?: 'create_new_app' | 'extend_existing_app'
      targetAppId?: string
      targetAppName?: string
    },
  ) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    const resolved = await this.requireAppBuilderHandoffService().resolveHandoffForOwner(
      ownerAccountId,
      threadId,
      handoffId,
      body,
    )
    await this.syncAppBuilderHandoffMessageMetadata(ownerAccountId, thread.id, resolved).catch(error => {
      console.warn('Sync app builder handoff message metadata failed:', error)
    })
    return resolved
  }

  async continueAppBuilderHandoffForOwner(ownerAccountId: string, threadId: string, handoffId: string) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    const service = this.requireAppBuilderHandoffService()
    const payload = await service.continueHandoffForOwner(
      ownerAccountId,
      threadId,
      handoffId,
    )
    const latest = await service.getHandoffForOwner(ownerAccountId, thread.id, handoffId)
    await this.syncAppBuilderHandoffMessageMetadata(ownerAccountId, thread.id, latest).catch(error => {
      console.warn('Sync app builder handoff message metadata failed:', error)
    })
    return payload
  }

  async consumeAppBuilderHandoffForOwner(ownerAccountId: string, threadId: string, handoffId: string) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    const consumed = await this.requireAppBuilderHandoffService().consumeHandoffForOwner(
      ownerAccountId,
      threadId,
      handoffId,
    )
    await this.syncAppBuilderHandoffMessageMetadata(ownerAccountId, thread.id, consumed).catch(error => {
      console.warn('Sync app builder handoff message metadata failed:', error)
    })
    return consumed
  }

  async releaseAppBuilderHandoffForOwner(ownerAccountId: string, threadId: string, handoffId: string) {
    const thread = await this.assertOwnerThread(ownerAccountId, threadId)
    const released = await this.requireAppBuilderHandoffService().releaseHandoffForOwner(
      ownerAccountId,
      threadId,
      handoffId,
    )
    await this.syncAppBuilderHandoffMessageMetadata(ownerAccountId, thread.id, released).catch(error => {
      console.warn('Sync app builder handoff message metadata failed:', error)
    })
    return released
  }

  async listMessagesByThreadId(threadId: string, limit = 50, offset = 0) {
    const { messageRepository } = this.createRepositories()
    const messages = await messageRepository.find({
      threadId,
      role: {
        $in: [AiMessageRole.USER, AiMessageRole.ASSISTANT],
      },
    }, {
      limit,
      offset,
      orderBy: {
        sequence: 'DESC',
      },
    })
    return messages.filter(message => !this.isMessageSuperseded(message))
  }

  async listAllMessagesByThreadId(threadId: string) {
    const { messageRepository } = this.createRepositories()
    const messages = await messageRepository.find({
      threadId,
      role: {
        $in: [AiMessageRole.USER, AiMessageRole.ASSISTANT],
      },
    }, {
      orderBy: {
        sequence: 'DESC',
      },
    })
    return messages.filter(message => !this.isMessageSuperseded(message))
  }

  async appendMessage(thread: Pick<AiThreadEntity, 'id' | 'agentId' | 'ownerAccountId' | 'title'>, payload: AppendMessagePayload) {
    const { em, messageRepository, threadRepository, agentRepository } = this.createRepositories()
    const sequence = await messageRepository.count({ threadId: thread.id }) + 1
    const traceId = this.normalizeTraceId(payload.traceId)
    const message = new AiMessageEntity()
    message.threadId = thread.id
    message.ownerAccountId = thread.ownerAccountId
    message.role = payload.role
    message.sequence = sequence
    message.content = payload.content
    message.traceId = traceId
    message.metadata = payload.metadata ?? null
    message.createTime = Date.now()
    await messageRepository.persistAndFlush(message)

    const managedThread = await threadRepository.findOne({ id: thread.id, deleteTime: null })
    if (managedThread) {
      if (
        payload.role === AiMessageRole.USER
        && managedThread.kind === 'private'
        && (!managedThread.title || managedThread.title === AiThreadEntity.DEFAULT_TITLE)
      ) {
        managedThread.title = this.buildThreadTitle(payload.content)
      }
      managedThread.updateTime = Date.now()
      em.persist(managedThread)

      if (managedThread.kind === 'private') {
        const agent = await this.getAgentById(managedThread.agentId, { agentRepository })
        if (agent) {
          this.syncAgentFromOwnerThread(agent, managedThread)
          em.persist(agent)
        }
      }

      await em.flush()
    }

    return message
  }

  async supersedeOwnerMessageTurn(options: {
    ownerAccountId: string
    threadId: string
    messageId: string
    supersededByTraceId?: string
  }) {
    const { messageRepository } = this.createRepositories()
    const thread = await this.assertOwnerThread(options.ownerAccountId, options.threadId)
    const messageId = String(options.messageId || '').trim()
    if (!messageId) {
      return null
    }

    const sourceMessage = await messageRepository.findOne({
      id: messageId,
      threadId: thread.id,
      ownerAccountId: thread.ownerAccountId,
      role: AiMessageRole.USER,
    })
    if (!sourceMessage) {
      throw new Error(global.i18next.t('aiThreadService.currentThreadUserMessageOnly'))
    }
    if (this.isMessageSuperseded(sourceMessage)) {
      throw new Error(global.i18next.t('aiThreadService.messageChangedRefresh'))
    }
    await this.assertLatestVisibleUserMessage(messageRepository, sourceMessage)

    const traceId = this.normalizeTraceId(sourceMessage.traceId)
    if (!traceId) {
      throw new Error(global.i18next.t('aiThreadService.messageTurnMissing'))
    }

    const now = Date.now()
    const turnMessages = await messageRepository.find({
      threadId: thread.id,
      ownerAccountId: thread.ownerAccountId,
      traceId,
    })
    for (const message of turnMessages) {
      if (this.isMessageSuperseded(message)) {
        continue
      }
      message.metadata = {
        ...this.normalizeMessageMetadata(message.metadata),
        supersededAt: now,
        supersededByTraceId: this.normalizeTraceId(options.supersededByTraceId) || undefined,
      }
    }
    await messageRepository.persistAndFlush(turnMessages)

    const sourceMetadata = this.normalizeMessageMetadata(sourceMessage.metadata)
    const editRootMessageId = String(sourceMetadata.editRootMessageId || sourceMessage.id).trim()
    const editRevision = Math.max(1, Number(sourceMetadata.editRevision || 0) + 1)
    return {
      editedFromMessageId: sourceMessage.id,
      editRootMessageId,
      editRevision,
    }
  }

  async updateMessageMetadata(messageId: string, metadata: Record<string, unknown> | null) {
    const { messageRepository } = this.createRepositories()
    const message = await messageRepository.findOne({ id: messageId })
    if (!message) {
      throw new Error('Message not found')
    }
    message.metadata = metadata || null
    await messageRepository.persistAndFlush(message)
    return message
  }

  async updateMessageContentAndMetadata(
    messageId: string,
    content: string,
    metadata: Record<string, unknown> | null,
  ) {
    const { messageRepository } = this.createRepositories()
    const message = await messageRepository.findOne({ id: messageId })
    if (!message) {
      throw new Error('Message not found')
    }
    message.content = String(content || '')
    message.metadata = metadata || null
    await messageRepository.persistAndFlush(message)
    return message
  }

  private normalizeMessageMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return { ...(value as Record<string, unknown>) }
  }

  private isMessageSuperseded(message?: { metadata?: Record<string, unknown> | null }) {
    return Boolean(this.normalizeMessageMetadata(message?.metadata).supersededAt)
  }

  private async assertLatestVisibleUserMessage(
    messageRepository: EntityRepository<AiMessageEntity>,
    sourceMessage: AiMessageEntity,
  ) {
    const latestMessages = await messageRepository.find({
      threadId: sourceMessage.threadId,
      ownerAccountId: sourceMessage.ownerAccountId,
      role: AiMessageRole.USER,
    }, {
      limit: 20,
      orderBy: {
        sequence: 'DESC',
      },
    })
    const latestVisibleUserMessage = latestMessages.find(message => !this.isMessageSuperseded(message))
    if (latestVisibleUserMessage && latestVisibleUserMessage.id !== sourceMessage.id) {
      throw new Error(global.i18next.t('aiThreadService.latestUserMessageOnly'))
    }
  }

  private async syncAppBuilderHandoffMessageMetadata(
    ownerAccountId: string,
    threadId: string,
    handoff: AppBuilderHandoff,
  ) {
    const messageId = String(handoff.source?.messageId || '').trim()
    if (!messageId) {
      return null
    }

    const { messageRepository } = this.createRepositories()
    const message = await messageRepository.findOne({
      id: messageId,
      ownerAccountId,
      threadId,
    })
    if (!message) {
      return null
    }

    const metadata = this.normalizeMessageMetadata(message.metadata)
    metadata.appBuilderHandoff = buildWorkbenchHandoffPreviewMetadata(handoff)
    return await this.updateMessageMetadata(message.id, metadata)
  }

  private async hydrateAppBuilderHandoffMessageMetadata(
    ownerAccountId: string,
    threadId: string,
    messages: AiMessageEntity[],
  ) {
    const appBuilderHandoffService = this.appBuilderHandoffService
    if (!appBuilderHandoffService || !messages.length) {
      return messages
    }

    const uniqueHandoffIds = Array.from(new Set(
      messages
        .map(message => {
          const appBuilderHandoff = this.normalizeMessageMetadata(message.metadata).appBuilderHandoff
          if (!appBuilderHandoff || typeof appBuilderHandoff !== 'object' || Array.isArray(appBuilderHandoff)) {
            return ''
          }
          return String((appBuilderHandoff as Record<string, unknown>).handoffId || '').trim()
        })
        .filter(Boolean),
    ))
    const latestHandoffById = new Map<string, AppBuilderHandoff | null>()
    for (const handoffId of uniqueHandoffIds) {
      latestHandoffById.set(
        handoffId,
        await appBuilderHandoffService.getHandoffForOwner(ownerAccountId, threadId, handoffId).catch(() => null),
      )
    }

    const hydrated: AiMessageEntity[] = []
    for (const message of messages) {
      const metadata = this.normalizeMessageMetadata(message.metadata)
      const currentPreview = metadata.appBuilderHandoff
      const handoffId = currentPreview && typeof currentPreview === 'object' && !Array.isArray(currentPreview)
        ? String((currentPreview as Record<string, unknown>).handoffId || '').trim()
        : ''
      const latest = handoffId ? latestHandoffById.get(handoffId) || null : null
      if (!handoffId || !latest) {
        hydrated.push(message)
        continue
      }

      const nextPreview = buildWorkbenchHandoffPreviewMetadata(latest)
      const nextAppBuilderHandoff = {
        ...(
          currentPreview && typeof currentPreview === 'object' && !Array.isArray(currentPreview)
            ? currentPreview as Record<string, unknown>
            : {}
        ),
        ...nextPreview,
      }
      metadata.appBuilderHandoff = nextAppBuilderHandoff
      message.metadata = metadata
      hydrated.push(message)

      if (JSON.stringify(currentPreview || null) !== JSON.stringify(nextAppBuilderHandoff)) {
        await this.updateMessageMetadata(message.id, metadata)
      }
    }
    return hydrated
  }

  private requireAppBuilderHandoffService() {
    if (!this.appBuilderHandoffService) {
      throw new Error('App builder handoff service is not available')
    }
    return this.appBuilderHandoffService
  }

  private normalizeTraceId(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  async ensureVisitorThread(agent: AiAgentEntity, visitorKey: string) {
    const { threadRepository } = this.createRepositories()
    const normalizedVisitorKey = String(visitorKey || '').trim()
    if (!normalizedVisitorKey) {
      throw new Error('visitorKey is required')
    }

    const existingThread = await threadRepository.findOne({
      ownerAccountId: agent.ownerAccountId,
      kind: 'share-visitor',
      agentId: agent.id,
      visitorKey: normalizedVisitorKey,
      deleteTime: null,
    })
    if (existingThread) {
      const nextAppScope = this.normalizeAppScope(agent.appScope)
      const nextModelSelection = this.normalizeModelSelection({
        providerId: agent.providerId,
        modelId: agent.modelId,
        model: agent.model,
      })
      const nextModelSelectionSource = this.materializeAgentModelSelectionSource(agent).modelSelectionSource || null
      const hasAppScopeChanged = this.isAppScopeChanged(existingThread.appScope, nextAppScope)
      const hasModelSelectionChanged = this.isModelSelectionChanged(
        existingThread,
        {
          ...nextModelSelection,
          modelSelectionSource: nextModelSelectionSource,
        },
      )
      if (hasAppScopeChanged || hasModelSelectionChanged) {
        existingThread.appScope = nextAppScope
        if (hasAppScopeChanged) {
          existingThread.runtimeState = this.pruneRuntimeStateByAppScope(
            existingThread.runtimeState,
            nextAppScope,
          )
        }
        existingThread.providerId = nextModelSelection.providerId
        existingThread.modelId = nextModelSelection.modelId
        existingThread.model = nextModelSelection.model
        existingThread.modelSelectionSource = nextModelSelectionSource
        existingThread.updateTime = Date.now()
        await threadRepository.persistAndFlush(existingThread)
      }
      return this.materializeThreadModelSelectionSource(existingThread)
    }

    const visitorThread = new AiThreadEntity()
    visitorThread.agentId = agent.id
    visitorThread.ownerAccountId = agent.ownerAccountId
    visitorThread.kind = 'share-visitor'
    visitorThread.title = agent.name || 'Shared Chat'
    visitorThread.appScope = this.normalizeAppScope(agent.appScope)
    visitorThread.providerId = agent.providerId || null
    visitorThread.modelId = agent.modelId || null
    visitorThread.model = agent.model || null
    visitorThread.modelSelectionSource = this.materializeAgentModelSelectionSource(agent).modelSelectionSource || null
    visitorThread.visitorKey = normalizedVisitorKey
    visitorThread.visitorProfile = null
    visitorThread.runtimeState = this.normalizeRuntimeState(null)
    visitorThread.createTime = Date.now()
    visitorThread.updateTime = Date.now()
    await threadRepository.persistAndFlush(visitorThread)
    return this.materializeThreadModelSelectionSource(visitorThread)
  }

  async getThreadById(threadId: string) {
    const { threadRepository } = this.createRepositories()
    const thread = await threadRepository.findOne({
      id: threadId,
      deleteTime: null,
    })
    if (!thread) {
      return null
    }
    if (thread.kind === 'private') {
      await this.ensureAgentForOwnerThread(thread)
    }
    return this.materializeThreadModelSelectionSource(thread)
  }

  async getVisitorThread(agentId: string, visitorKey: string) {
    const { threadRepository } = this.createRepositories()
    const thread = await threadRepository.findOne({
      kind: 'share-visitor',
      agentId,
      visitorKey,
      deleteTime: null,
    })
    return this.materializeThreadModelSelectionSource(thread)
  }

  async getAgentById(agentId: string, repositories?: AgentRepositoryBundle) {
    const { agentRepository } = repositories || this.createRepositories()
    if (!agentId) {
      return null
    }
    const agent = await agentRepository.findOne({
      id: agentId,
      deleteTime: null,
    })
    return this.materializeAgentModelSelectionSource(agent)
  }

  async assertOwnerAgent(ownerAccountId: string, agentId: string, repositories?: AgentRepositoryBundle) {
    const { agentRepository } = repositories || this.createRepositories()
    const agent = await agentRepository.findOne({
      id: agentId,
      ownerAccountId,
      deleteTime: null,
    })
    if (!agent) {
      throw new Error('Agent not found or access denied')
    }
    return agent
  }

  async updateAgentSharing(agentId: string, enabled: boolean, repositories?: AgentRepositoryBundle) {
    const { agentRepository } = repositories || this.createRepositories()
    const agent = await this.getAgentById(agentId, repositories)
    if (!agent) {
      throw new Error('Agent not found')
    }

    agent.sharing = Boolean(enabled)
    agent.shareToken = agent.sharing
      ? (String(agent.shareToken || '').trim() || this.createShareToken())
      : null
    agent.shareTime = agent.sharing ? Date.now() : null
    agent.updateTime = Date.now()
    await agentRepository.persistAndFlush(agent)
    return agent
  }

  async resolveSharedAgent(shareToken: string, repositories?: AgentRepositoryBundle) {
    const { agentRepository } = repositories || this.createRepositories()
    const normalizedToken = String(shareToken || '').trim()
    if (!normalizedToken) {
      return null
    }
    return await agentRepository.findOne({
      shareToken: normalizedToken,
      sharing: true,
      deleteTime: null,
    })
  }

  private async applyThreadUpdate(thread: AiThreadEntity, data: ThreadUpdatePayload) {
    const { em, threadRepository, agentRepository } = this.createRepositories()
    const now = Date.now()
    const normalizedAppScope = data.appScope !== undefined
      ? this.normalizeAppScope(data.appScope)
      : undefined
    const hasAppScopeChanged = normalizedAppScope !== undefined
      ? this.isAppScopeChanged(thread.appScope, normalizedAppScope)
      : false
    const normalizedModelSelection = this.normalizeModelSelection(data)
    const normalizedModelSelectionSource = this.normalizeModelSelectionSource(data.modelSelectionSource)
    const shouldUpdateModelSelection = this.hasModelSelectionPatch(data)
    const shouldUpdateModelSelectionSource = this.hasModelSelectionSourcePatch(data)

    if (thread.kind === 'private') {
      const agent = await this.ensureAgentForOwnerThread(thread, { threadRepository, agentRepository })
      if (data.title !== undefined) {
        thread.title = this.normalizeTitle(data.title, thread.title)
      }
      if (normalizedAppScope !== undefined) {
        thread.appScope = normalizedAppScope
      }
      if (data.runtimeState !== undefined) {
        thread.runtimeState = this.normalizeRuntimeState(data.runtimeState)
      }
      if (data.contextState !== undefined) {
        thread.contextState = this.normalizeContextState(data.contextState)
      }
      if (hasAppScopeChanged) {
        thread.runtimeState = this.pruneRuntimeStateByAppScope(thread.runtimeState, normalizedAppScope)
      }
      if (shouldUpdateModelSelection) {
        thread.providerId = normalizedModelSelection.providerId
        thread.modelId = normalizedModelSelection.modelId
        thread.model = normalizedModelSelection.model
      }
      if (shouldUpdateModelSelectionSource) {
        thread.modelSelectionSource = normalizedModelSelectionSource
      }
      if (data.visitorProfile !== undefined) {
        thread.visitorProfile = this.normalizeVisitorProfile(data.visitorProfile)
      }
      if (data.pinned !== undefined) {
        thread.pinned = Boolean(data.pinned)
        thread.pinTime = thread.pinned ? now : null
      }

      thread.updateTime = now
      this.syncAgentFromOwnerThread(agent, thread)
      agent.updateTime = now

      em.persist([thread, agent])
      if (normalizedAppScope !== undefined) {
        const visitorThreads = await threadRepository.find({
          agentId: agent.id,
          kind: 'share-visitor',
          deleteTime: null,
        })
        visitorThreads.forEach(item => {
          item.appScope = normalizedAppScope
          item.runtimeState = this.pruneRuntimeStateByAppScope(item.runtimeState, normalizedAppScope)
          if (shouldUpdateModelSelection) {
            item.providerId = normalizedModelSelection.providerId
            item.modelId = normalizedModelSelection.modelId
            item.model = normalizedModelSelection.model
          }
          if (shouldUpdateModelSelectionSource) {
            item.modelSelectionSource = normalizedModelSelectionSource
          }
          item.updateTime = now
        })
        em.persist(visitorThreads)
      } else if (shouldUpdateModelSelection || shouldUpdateModelSelectionSource) {
        const visitorThreads = await threadRepository.find({
          agentId: agent.id,
          kind: 'share-visitor',
          deleteTime: null,
        })
        visitorThreads.forEach(item => {
          if (shouldUpdateModelSelection) {
            item.providerId = normalizedModelSelection.providerId
            item.modelId = normalizedModelSelection.modelId
            item.model = normalizedModelSelection.model
          }
          if (shouldUpdateModelSelectionSource) {
            item.modelSelectionSource = normalizedModelSelectionSource
          }
          item.updateTime = now
        })
        em.persist(visitorThreads)
      }
      await em.flush()

      return this.toOwnerThreadSummary(thread, agent)
    }

    if (data.title !== undefined) {
      thread.title = this.normalizeTitle(data.title, thread.title)
    }
    if (normalizedAppScope !== undefined) {
      thread.appScope = normalizedAppScope
    }
    if (data.runtimeState !== undefined) {
      thread.runtimeState = this.normalizeRuntimeState(data.runtimeState)
    }
    if (data.contextState !== undefined) {
      thread.contextState = this.normalizeContextState(data.contextState)
    }
    if (hasAppScopeChanged) {
      thread.runtimeState = this.pruneRuntimeStateByAppScope(thread.runtimeState, normalizedAppScope)
    }
    if (shouldUpdateModelSelection) {
      thread.providerId = normalizedModelSelection.providerId
      thread.modelId = normalizedModelSelection.modelId
      thread.model = normalizedModelSelection.model
    }
    if (shouldUpdateModelSelectionSource) {
      thread.modelSelectionSource = normalizedModelSelectionSource
    }
    if (data.visitorProfile !== undefined) {
      thread.visitorProfile = this.normalizeVisitorProfile(data.visitorProfile)
    }
    thread.updateTime = now
    await threadRepository.persistAndFlush(thread)
    return thread
  }

  private async ensureAgentMapForOwnerThreads(
    threads: AiThreadEntity[],
    agentRepository: ReturnType<AiThreadService['createRepositories']>['agentRepository'],
    threadRepository: ReturnType<AiThreadService['createRepositories']>['threadRepository'],
  ) {
    const map = new Map<string, AiAgentEntity>()
    const knownAgentIds = [...new Set(
      threads
        .map(item => String(item.agentId || '').trim())
        .filter(Boolean),
    )]

    if (knownAgentIds.length) {
      const agents = await agentRepository.find({
        id: {
          $in: knownAgentIds,
        },
        deleteTime: null,
      })
      agents.forEach(agent => map.set(agent.id, agent))
    }

    for (const thread of threads) {
      if (map.has(thread.agentId)) {
        continue
      }
      const agent = await this.ensureAgentForOwnerThread(thread, {
        threadRepository,
        agentRepository,
      })
      map.set(agent.id, agent)
    }

    return map
  }

  private async ensureAgentForOwnerThread(
    thread: AiThreadEntity,
    repositories?: ThreadAgentRepositoryBundle,
  ) {
    const { threadRepository, agentRepository } = repositories || this.createRepositories()
    const currentAgentId = String(thread.agentId || '').trim()
    if (currentAgentId) {
      const agent = await agentRepository.findOne({
        id: currentAgentId,
        ownerAccountId: thread.ownerAccountId,
        deleteTime: null,
      })
      if (agent) {
        return this.materializeAgentModelSelectionSource(agent)
      }
    }

    const agent = new AiAgentEntity()
    agent.ownerAccountId = thread.ownerAccountId
    agent.name = this.normalizeTitle(thread.title, AiThreadEntity.DEFAULT_TITLE)
    agent.appScope = this.normalizeAppScope(thread.appScope)
    agent.providerId = thread.providerId || null
    agent.modelId = thread.modelId || null
    agent.model = thread.model || null
    agent.modelSelectionSource = this.materializeThreadModelSelectionSource(thread).modelSelectionSource || null
    agent.pinned = Boolean(thread.pinned)
    agent.pinTime = thread.pinTime || null
    agent.sharing = false
    agent.shareToken = null
    agent.shareTime = null
    agent.createTime = Number(thread.createTime || Date.now())
    agent.updateTime = Date.now()
    await agentRepository.persistAndFlush(agent)

    thread.agentId = agent.id
    thread.updateTime = Date.now()
    await threadRepository.persistAndFlush(thread)
    return this.materializeAgentModelSelectionSource(agent)
  }

  private syncAgentFromOwnerThread(agent: AiAgentEntity, thread: AiThreadEntity) {
    agent.name = this.normalizeTitle(thread.title, agent.name || AiThreadEntity.DEFAULT_TITLE)
    agent.appScope = this.normalizeAppScope(thread.appScope)
    agent.providerId = this.normalizeModelSelection(thread).providerId
    agent.modelId = this.normalizeModelSelection(thread).modelId
    agent.model = this.normalizeModelSelection(thread).model
    agent.modelSelectionSource = this.materializeThreadModelSelectionSource(thread).modelSelectionSource || null
    agent.pinned = Boolean(thread.pinned)
    agent.pinTime = thread.pinTime || null
  }

  private toOwnerThreadSummary(thread: AiThreadEntity, agent: AiAgentEntity | null): AiThread & {
    sharing: boolean
    shareToken: string
  } {
    return {
      ...thread,
      agentId: String(thread.agentId || agent?.id || '').trim(),
      appScope: this.normalizeAppScope(thread.appScope),
      providerId: this.normalizeModelSelection(thread).providerId,
      modelId: this.normalizeModelSelection(thread).modelId,
      model: this.normalizeModelSelection(thread).model,
      modelSelectionSource: this.materializeThreadModelSelectionSource(thread).modelSelectionSource || null,
      sharing: Boolean(agent?.sharing),
      shareToken: String(agent?.shareToken || '').trim(),
    }
  }

  private normalizeTitle(value?: string, fallback = AiThreadEntity.DEFAULT_TITLE) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim()
    return normalized || fallback
  }

  private async attachVisitorThreadConversationDurations(items: AiThreadEntity[]) {
    const threadIds = items
      .map(item => String(item.id || '').trim())
      .filter(Boolean)

    if (!threadIds.length) {
      return items.map(item => ({
        ...item,
        totalConversationDuration: 0,
      }))
    }

    const { messageRepository } = this.createRepositories()
    const messages = await messageRepository.find({
      threadId: {
        $in: threadIds,
      },
      role: {
        $in: [AiMessageRole.USER, AiMessageRole.ASSISTANT],
      },
    }, {
      fields: ['threadId', 'role', 'traceId', 'createTime', 'sequence'],
      orderBy: {
        sequence: 'ASC',
      },
    })

    const messageMap = new Map<string, typeof messages>()
    messages.forEach(message => {
      const threadId = String(message.threadId || '').trim()
      if (!threadId) {
        return
      }
      if (!messageMap.has(threadId)) {
        messageMap.set(threadId, [])
      }
      messageMap.get(threadId)!.push(message)
    })

    return items.map(item => ({
      ...item,
      totalConversationDuration: this.calculateCompletedConversationDuration(messageMap.get(item.id) || []),
    }))
  }

  private calculateCompletedConversationDuration(
    messages: Array<Pick<AiMessageEntity, 'role' | 'traceId' | 'createTime'>>,
  ) {
    const pendingUserMessageByTraceId = new Map<string, number>()
    const pendingUserMessageQueue: number[] = []
    let totalDuration = 0

    messages.forEach(message => {
      const createTime = this.normalizeTimestamp(message.createTime)
      if (!createTime) {
        return
      }

      const traceId = String(message.traceId || '').trim()
      if (message.role === AiMessageRole.USER) {
        if (traceId) {
          pendingUserMessageByTraceId.set(traceId, createTime)
          return
        }
        pendingUserMessageQueue.push(createTime)
        return
      }

      if (message.role !== AiMessageRole.ASSISTANT) {
        return
      }

      let startTime = 0
      if (traceId && pendingUserMessageByTraceId.has(traceId)) {
        startTime = pendingUserMessageByTraceId.get(traceId) || 0
        pendingUserMessageByTraceId.delete(traceId)
      } else if (pendingUserMessageQueue.length) {
        startTime = pendingUserMessageQueue.shift() || 0
      }

      if (startTime > 0 && createTime >= startTime) {
        totalDuration += createTime - startTime
      }
    })

    return totalDuration
  }

  private buildThreadTitle(content: string) {
    const text = String(content || '')
      .replace(/\u200d[\u200b\u200c]+\u200e/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return text ? text.slice(0, 24) : AiThreadEntity.DEFAULT_TITLE
  }

  private normalizeAppScope(value?: AiThreadAppScope | null) {
    const appIds = Array.isArray(value?.appIds)
      ? value.appIds.map(item => String(item || '').trim()).filter(Boolean)
      : []
    return appIds.length
      ? {
        appIds: [...new Set(appIds)],
      }
      : null
  }

  private isAppScopeChanged(
    currentValue?: AiThreadAppScope | null,
    nextValue?: AiThreadAppScope | null,
  ) {
    return JSON.stringify(this.normalizeAppScope(currentValue) || null) !== JSON.stringify(this.normalizeAppScope(nextValue) || null)
  }

  private normalizeModelSelection(value?: AiThreadModelSelection | null) {
    return {
      providerId: this.normalizeOptionalText(value?.providerId) || null,
      modelId: this.normalizeOptionalText(value?.modelId) || null,
      model: this.normalizeOptionalText(value?.model) || null,
    }
  }

  private hasModelSelectionPatch(value?: AiThreadModelSelection | null) {
    if (!value) {
      return false
    }

    return (
      Object.prototype.hasOwnProperty.call(value, 'providerId')
      || Object.prototype.hasOwnProperty.call(value, 'modelId')
      || Object.prototype.hasOwnProperty.call(value, 'model')
    )
  }

  private hasModelSelectionSourcePatch(value?: { modelSelectionSource?: AiThreadModelSelection['modelSelectionSource'] } | null) {
    return Boolean(value && Object.prototype.hasOwnProperty.call(value, 'modelSelectionSource'))
  }

  private isModelSelectionChanged(
    currentValue?: (AiThreadModelSelection & { modelSelectionSource?: AiThreadModelSelection['modelSelectionSource'] }) | null,
    nextValue?: (AiThreadModelSelection & { modelSelectionSource?: AiThreadModelSelection['modelSelectionSource'] }) | null,
  ) {
    const current = this.normalizeModelSelection(currentValue)
    const next = this.normalizeModelSelection(nextValue)
    return (
      current.providerId !== next.providerId
      || current.modelId !== next.modelId
      || current.model !== next.model
      || this.resolveStoredModelSelectionSource(currentValue?.modelSelectionSource, currentValue)
        !== this.resolveStoredModelSelectionSource(nextValue?.modelSelectionSource, nextValue)
    )
  }

  private normalizeModelSelectionSource(value?: string | null): AiThreadModelSelection['modelSelectionSource'] {
    const normalized = this.normalizeOptionalText(value)?.toLowerCase()
    if (normalized === 'default' || normalized === 'explicit') {
      return normalized
    }
    return null
  }

  private resolveRequestedModelSelectionSource(value?: (AiThreadModelSelection & { modelSelectionSource?: string | null }) | null) {
    const normalized = this.normalizeModelSelectionSource(value?.modelSelectionSource)
    if (normalized) {
      return normalized
    }
    return this.hasModelSelectionValue(value) ? 'explicit' : null
  }

  private resolveStoredModelSelectionSource(
    value?: string | null,
    selection?: AiThreadModelSelection | null,
  ): AiThreadModelSelection['modelSelectionSource'] {
    const normalized = this.normalizeModelSelectionSource(value)
    if (normalized) {
      return normalized
    }
    return this.hasModelSelectionValue(selection) ? 'default' : null
  }

  private hasModelSelectionValue(value?: AiThreadModelSelection | null) {
    const normalized = this.normalizeModelSelection(value)
    return Boolean(normalized.providerId || normalized.modelId || normalized.model)
  }

  private materializeThreadModelSelectionSource<
    T extends { modelSelectionSource?: AiThreadModelSelection['modelSelectionSource']; providerId?: string | null; modelId?: string | null; model?: string | null } | null | undefined,
  >(thread: T): T {
    if (!thread) {
      return thread
    }
    thread.modelSelectionSource = this.resolveStoredModelSelectionSource(thread.modelSelectionSource, thread)
    return thread
  }

  private materializeAgentModelSelectionSource<
    T extends { modelSelectionSource?: AiThreadModelSelection['modelSelectionSource']; providerId?: string | null; modelId?: string | null; model?: string | null } | null | undefined,
  >(agent: T): T {
    if (!agent) {
      return agent
    }
    agent.modelSelectionSource = this.resolveStoredModelSelectionSource(agent.modelSelectionSource, agent)
    return agent
  }

  private normalizeRuntimeState(value?: AiThreadRuntimeState | null) {
    return this.runtimeStateReducerService.materializeRuntimeState(value)
  }

  private normalizeContextState(value?: AiThreadContextState | null) {
    if (!value || typeof value !== 'object') {
      return null
    }
    return {
      version: 1 as const,
      summarizedThroughSequence: Number.isFinite(Number(value.summarizedThroughSequence))
        ? Number(value.summarizedThroughSequence)
        : undefined,
      sourceFingerprint: String(value.sourceFingerprint || '').trim() || undefined,
      summary: String(value.summary || '').trim() || undefined,
      sourceMessageCount: Number.isFinite(Number(value.sourceMessageCount))
        ? Number(value.sourceMessageCount)
        : undefined,
      estimatedTokens: Number.isFinite(Number(value.estimatedTokens))
        ? Number(value.estimatedTokens)
        : undefined,
      updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : undefined,
    }
  }

  private pruneRuntimeStateByAppScope(
    runtimeState?: AiThreadRuntimeState | null,
    appScope?: AiThreadAppScope | null,
  ) {
    return this.runtimeStateReducerService.pruneRuntimeStateByAppScope(runtimeState, appScope)
  }

  private mergeVisitorProfile(
    currentValue?: AiThreadVisitorProfile | null,
    nextValue?: AiThreadVisitorProfile | null,
  ) {
    const current = this.normalizeVisitorProfile(currentValue)
    const next = this.normalizeVisitorProfile(nextValue)
    const now = Date.now()

    if (!current && !next) {
      return null
    }

    return this.normalizeVisitorProfile({
      firstSeenAt: current?.firstSeenAt || next?.firstSeenAt || now,
      lastSeenAt: next?.lastSeenAt || now,
      sourceDomain: next?.sourceDomain || current?.sourceDomain,
      referrer: next?.referrer || current?.referrer,
      origin: next?.origin || current?.origin,
      platform: next?.platform || current?.platform,
      language: next?.language || current?.language,
      os: next?.os || current?.os,
      browser: next?.browser || current?.browser,
      userAgent: next?.userAgent || current?.userAgent,
      ip: next?.ip || current?.ip,
    })
  }

  private normalizeVisitorProfile(value?: AiThreadVisitorProfile | null) {
    if (!value) {
      return null
    }

    const firstSeenAt = this.normalizeTimestamp(value.firstSeenAt)
    const lastSeenAt = this.normalizeTimestamp(value.lastSeenAt)
    const sourceDomain = this.normalizeOptionalText(value.sourceDomain)
    const referrer = this.normalizeOptionalText(value.referrer)
    const origin = this.normalizeOptionalText(value.origin)
    const platform = this.normalizeOptionalText(value.platform)
    const language = this.normalizeOptionalText(value.language)
    const os = this.normalizeOptionalText(value.os)
    const browser = this.normalizeOptionalText(value.browser)
    const userAgent = this.normalizeOptionalText(value.userAgent)
    const ip = this.normalizeOptionalText(value.ip)

    if (!firstSeenAt && !lastSeenAt && !sourceDomain && !referrer && !origin && !platform && !language && !os && !browser && !userAgent && !ip) {
      return null
    }

    return {
      firstSeenAt: firstSeenAt || undefined,
      lastSeenAt: lastSeenAt || undefined,
      sourceDomain: sourceDomain || undefined,
      referrer: referrer || undefined,
      origin: origin || undefined,
      platform: platform || undefined,
      language: language || undefined,
      os: os || undefined,
      browser: browser || undefined,
      userAgent: userAgent || undefined,
      ip: ip || undefined,
    }
  }

  private createShareToken() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  }

  private normalizeOptionalText(value?: string | null) {
    return String(value || '').trim()
  }

  private normalizeTimestamp(value?: number | null) {
    const normalized = Number(value || 0)
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return 0
    }
    return Math.round(normalized)
  }

  private createRepositories() {
    const em = this.entityManager.fork()
    return {
      em,
      agentRepository: em.getRepository(AiAgentEntity),
      threadRepository: em.getRepository(AiThreadEntity),
      messageRepository: em.getRepository(AiMessageEntity),
    }
  }
}
