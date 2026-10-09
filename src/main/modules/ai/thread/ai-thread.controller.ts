import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, Res, UnauthorizedException, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common'
import { Request, Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import type { AiThreadModelSelection } from '@common/types/ai-provider'
import { aiModelSupportsImageInput, aiModelSupportsOpenAiArrayContent } from '@common/utils/aiModelCapabilities'
import { getAccountId, getAccountName } from '@main/utils/account'
import { AiConfigService } from '../config/ai-config.service'
import {
  AiChatStreamPayload,
  AiClientToolResultRequest,
  AiMessageRole,
  AiStreamEventType,
  AiThreadStreamRequest,
} from '../ai.types'
import { AiRuntimeOrchestratorService } from '../runtime/ai-runtime-orchestrator.service'
import { AiLocalToolService } from '../tools/local-tool.service'
import { AiThreadService } from './ai-thread.service'
import { AiClientToolBridgeService } from '../nocode-editor/client-tool-bridge.service'
import { AiAttachmentService } from './ai-attachment.service'
import { AiAttachmentUploadExceptionFilter } from './ai-attachment-upload-exception.filter'

type PublicSelectionResolver = (selection?: AiThreadModelSelection | null) => AiThreadModelSelection

@Controller('ai/threads')
export class AiThreadController {
  constructor(
    @Inject(AiThreadService)
    private readonly threadService: AiThreadService,
    @Inject(AiConfigService)
    private readonly aiConfigService: AiConfigService,
    private readonly runtimeOrchestrator: AiRuntimeOrchestratorService,
    private readonly localToolService: AiLocalToolService,
    private readonly clientToolBridge: AiClientToolBridgeService,
    private readonly attachmentService: AiAttachmentService,
  ) {}

  @Get()
  async listThreads(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sharing') sharing?: string,
    @Query('includeHidden') includeHidden?: string,
  ) {
    const threads = await this.threadService.listOwnerThreads(
      getAccountId(req.account),
      Number(limit || 100),
      Number(offset || 0),
      sharing !== undefined ? (sharing === 'true') : undefined,
      includeHidden === 'true',
    )
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    return threads.map(thread => this.toPublicThreadSelection(thread, resolvePublicSelection))
  }

  @Get('accessible-apps')
  async listAccessibleApps(@Req() req: Request) {
    const apps = await this.localToolService.listAccessibleAppsForContext({
      accountId: getAccountId(req.account),
      accountName: getAccountName(req.account),
      accountUser: req.account?.user,
      accountIsAdmin: Boolean(req.account?.isAdmin),
    })

    return apps.map(item => ({
      id: item.id,
      name: item.name || item.id,
    }))
  }

  @Post()
  async createThread(
    @Req() req: Request,
    @Body() body: { title?: string; appScope?: { appIds?: string[] }; providerId?: string | null; modelId?: string | null; model?: string | null },
  ) {
    const selection = await this.aiConfigService.resolveModelSelection(null, body)
    const thread = await this.threadService.createOwnerThread(getAccountId(req.account), {
      title: body.title,
      appScope: this.normalizeOptionalAppScope(body),
      ...selection,
    })
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    return this.toPublicThreadSelection(thread, resolvePublicSelection)
  }

  @Post('unhide-all')
  async unhideAllThreads(@Req() req: Request) {
    return await this.threadService.unhideAllOwnerThreads(getAccountId(req.account))
  }

  @Post('delete-unshared')
  async deleteUnsharedThreads(@Req() req: Request) {
    const accountId = getAccountId(req.account)
    const { deletedThreadIds, ...result } = await this.threadService.deleteUnsharedOwnerThreads(accountId)
    await Promise.all(deletedThreadIds.map(threadId => (
      this.attachmentService.cleanupThread(accountId, threadId).catch(() => undefined)
    )))
    return result
  }

  @Post(':threadId/update')
  async updateThread(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body: { title?: string; pinned?: boolean; appScope?: { appIds?: string[] }; providerId?: string | null; modelId?: string | null; model?: string | null },
  ) {
    const currentThread = await this.threadService.assertOwnerThread(getAccountId(req.account), threadId)
    const nextSelection = this.hasModelSelectionPatch(body)
      ? await this.aiConfigService.resolveModelSelection(currentThread, body)
      : null
    const thread = await this.threadService.updateOwnerThread(getAccountId(req.account), threadId, {
      title: body.title,
      pinned: body.pinned,
      appScope: this.normalizeOptionalAppScope(body),
      ...(nextSelection ? { ...nextSelection } : {}),
    })
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    return this.toPublicThreadSelection(thread, resolvePublicSelection)
  }

  @Post(':threadId/hide')
  async hideThread(@Req() req: Request, @Param('threadId') threadId: string) {
    return await this.threadService.hideOwnerThread(getAccountId(req.account), threadId)
  }

  @Post(':threadId/delete')
  async deleteThread(@Req() req: Request, @Param('threadId') threadId: string) {
    const accountId = getAccountId(req.account)
    const result = await this.threadService.deleteOwnerThread(accountId, threadId)
    await this.attachmentService.cleanupThread(accountId, threadId).catch(() => undefined)
    return result
  }

  @Get(':threadId/messages')
  async listThreadMessages(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const messages = await this.threadService.listMessagesForOwner(
      getAccountId(req.account),
      threadId,
      Number(limit || 50),
      Number(offset || 0),
    )
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    return messages.map(message => this.toPublicMessageSelection(message, resolvePublicSelection))
  }

  @Post(':threadId/attachments')
  @UseFilters(AiAttachmentUploadExceptionFilter)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadAttachment(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number },
  ) {
    await this.threadService.assertOwnerPrivateThread(getAccountId(req.account), threadId)
    return await this.attachmentService.upload(getAccountId(req.account), threadId, file)
  }

  @Delete(':threadId/attachments/:attachmentId')
  async deleteAttachment(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return await this.attachmentService.delete(getAccountId(req.account), threadId, attachmentId)
  }

  @Post(':threadId/attachments/preflight')
  async preflightAttachments(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body: {
      attachments?: unknown[]
      providerId?: string | null
      modelId?: string | null
      model?: string | null
    },
  ) {
    const accountId = getAccountId(req.account)
    const thread = await this.threadService.assertOwnerPrivateThread(accountId, threadId)
    const selection = await this.aiConfigService.resolveModelSelection(thread, body)
    const runtimeConfig = await this.aiConfigService.resolveRuntimeConfig(thread, selection)
    await this.attachmentService.prepareProviderParts(
      accountId,
      thread.id,
      body.attachments,
      aiModelSupportsImageInput(runtimeConfig) && aiModelSupportsOpenAiArrayContent(runtimeConfig),
    )
    return { ok: true }
  }

  @Post(':threadId/attachments/:attachmentId/import-session')
  async createAttachmentImportSession(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.threadService.assertOwnerPrivateThread(getAccountId(req.account), threadId)
    return await this.attachmentService.createImportSession(
      getAccountId(req.account),
      threadId,
      attachmentId,
    )
  }

  @Get(':threadId/attachments/:attachmentId/content')
  async readAttachment(
    @Req() req: Request,
    @Res() res: Response,
    @Param('threadId') threadId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const { entity, buffer } = await this.attachmentService.read(getAccountId(req.account), threadId, attachmentId)
    res.setHeader('Content-Type', entity.mimeType)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Length', String(buffer.length))
    const disposition = entity.kind === 'image' ? 'inline' : 'attachment'
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(entity.originalName)}`)
    res.send(buffer)
  }

  @Get(':threadId/app-builder-handoff/:handoffId')
  async getAppBuilderHandoff(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('handoffId') handoffId: string,
  ) {
    return await this.threadService.getAppBuilderHandoffForOwner(
      getAccountId(req.account),
      threadId,
      handoffId,
    )
  }

  @Post(':threadId/app-builder-handoff/:handoffId/resolve')
  async resolveAppBuilderHandoff(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('handoffId') handoffId: string,
    @Body() body: {
      creationMode?: 'create_new_app' | 'extend_existing_app'
      targetAppId?: string
      targetAppName?: string
    },
  ) {
    return await this.threadService.resolveAppBuilderHandoffForOwner(
      getAccountId(req.account),
      threadId,
      handoffId,
      body,
    )
  }

  @Post(':threadId/app-builder-handoff/:handoffId/continue')
  async continueAppBuilderHandoff(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('handoffId') handoffId: string,
  ) {
    return await this.threadService.continueAppBuilderHandoffForOwner(
      getAccountId(req.account),
      threadId,
      handoffId,
    )
  }

  @Post(':threadId/app-builder-handoff/:handoffId/consume')
  async consumeAppBuilderHandoff(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('handoffId') handoffId: string,
  ) {
    return await this.threadService.consumeAppBuilderHandoffForOwner(
      getAccountId(req.account),
      threadId,
      handoffId,
    )
  }

  @Post(':threadId/app-builder-handoff/:handoffId/release')
  async releaseAppBuilderHandoff(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('handoffId') handoffId: string,
  ) {
    return await this.threadService.releaseAppBuilderHandoffForOwner(
      getAccountId(req.account),
      threadId,
      handoffId,
    )
  }

  @Get(':threadId/visitor-threads')
  async listVisitorThreads(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const result = await this.threadService.listVisitorThreads(
      getAccountId(req.account),
      threadId,
      Number(limit || 50),
      Number(offset || 0),
      startTime ? Number(startTime) : undefined,
      endTime ? Number(endTime) : undefined,
    )
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    return {
      ...result,
      items: result.items.map(item => this.toPublicThreadSelection(item, resolvePublicSelection)),
    }
  }

  @Post('stream')
  async streamThread(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: AiThreadStreamRequest,
  ) {
    if (!req.account) {
      throw new UnauthorizedException('Account is required')
    }

    const accountId = getAccountId(req.account)
    let thread = body.threadId
      ? await this.threadService.assertOwnerThread(accountId, body.threadId)
      : null
    const selection = await this.aiConfigService.resolveModelSelection(thread, body)
    if (thread && this.hasModelSelectionPatch(body)) {
      await this.threadService.updateOwnerThread(accountId, thread.id, {
        providerId: selection.providerId,
        modelId: selection.modelId,
        model: selection.model,
        modelSelectionSource: selection.modelSelectionSource,
      })
      thread.providerId = selection.providerId
      thread.modelId = selection.modelId
      thread.model = selection.model
      thread.modelSelectionSource = selection.modelSelectionSource
    }

    if (!thread) {
      const createdThread = await this.threadService.createOwnerThread(accountId, {
        appScope: Array.isArray(body.nocodeIds) && body.nocodeIds.length
          ? { appIds: body.nocodeIds }
          : null,
        providerId: selection.providerId,
        modelId: selection.modelId,
        model: selection.model,
        modelSelectionSource: selection.modelSelectionSource,
      })
      thread = await this.threadService.getThreadById(createdThread.id)
    }

    if (!thread) {
      throw new Error('Thread not found')
    }

    const attachmentReferences = body.metadata?.attachments
    if (Array.isArray(attachmentReferences) && attachmentReferences.length) {
      const runtimeConfig = await this.aiConfigService.resolveRuntimeConfig(thread, selection)
      await this.attachmentService.prepareProviderParts(
        accountId,
        thread.id,
        attachmentReferences,
        aiModelSupportsImageInput(runtimeConfig) && aiModelSupportsOpenAiArrayContent(runtimeConfig),
      )
    }

    const abortController = new AbortController()
    this.initSseResponse(res)
    let closed = false
    const abortWithReason = (reason: string) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason)
      }
    }
    const handleDisconnect = (reason: string) => {
      abortWithReason(reason)
      closed = true
      if (!res.writableEnded) {
        res.end()
      }
    }
    req.on('aborted', () => handleDisconnect('req_aborted'))
    req.on('close', () => handleDisconnect('req_close'))
    res.on('close', () => handleDisconnect('res_close'))

    try {
      const traceId = String(body.traceId || body.metadata?.traceId || '').trim() || undefined
      await this.runtimeOrchestrator.streamTurn({
        thread,
        message: String(body.message || '').trim(),
        traceId,
        requestMetadata: body.metadata || undefined,
        currentPageFormFillContext: body.runtimeContext?.currentFormFillContext,
        currentPageFormFillUnavailable: body.runtimeContext?.currentFormFillUnavailable === true,
        explicitAppIds: body.nocodeIds,
        providerId: selection.providerId,
        modelId: selection.modelId,
        model: selection.model,
        isShareMode: false,
        toolContext: {
          accountId,
          accountName: getAccountName(req.account),
          accountUser: req.account?.user,
          accountIsAdmin: Boolean(req.account?.isAdmin),
          appScope: thread.appScope,
          signal: abortController.signal,
        },
        signal: abortController.signal,
        emit: payload => {
          if (!closed && !res.writableEnded) {
            this.writeSseEvent(res, payload)
          }
        },
      })
    } catch (error) {
      if (!abortController.signal.aborted && !closed && !res.writableEnded) {
        this.writeSseEvent(res, {
          threadId: thread.id,
          conversationId: thread.id,
          event: AiStreamEventType.ERROR,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            agentId: thread.agentId,
          },
        })
      }
    } finally {
      if (!closed && !res.writableEnded) {
        res.end()
      }
    }
  }

  @Post('client-tool-result')
  async submitClientToolResult(
    @Req() req: Request,
    @Body() body: AiClientToolResultRequest,
  ) {
    if (!req.account) {
      throw new UnauthorizedException('Account is required')
    }
    await this.threadService.assertOwnerThread(getAccountId(req.account), body.conversationId)
    return this.clientToolBridge.resolveResult(body)
  }

  private initSseResponse(res: Response) {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
  }

  private writeSseEvent(res: Response, payload: AiChatStreamPayload) {
    const eventName = payload.event || AiStreamEventType.DELTA
    res.write(`event: ${eventName}\n`)
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  private normalizeOptionalAppScope(body?: { appScope?: { appIds?: string[] } | null }) {
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'appScope')) {
      return undefined
    }

    const appIds = Array.isArray(body.appScope?.appIds)
      ? body.appScope.appIds
      : []

    return body.appScope
      ? { appIds }
      : null
  }

  private hasModelSelectionPatch(value?: { providerId?: string | null; modelId?: string | null; model?: string | null }) {
    if (!value) {
      return false
    }
    return (
      Object.prototype.hasOwnProperty.call(value, 'providerId')
      || Object.prototype.hasOwnProperty.call(value, 'modelId')
      || Object.prototype.hasOwnProperty.call(value, 'model')
    )
  }

  private toPublicThreadSelection<T extends { providerId?: string | null; modelId?: string | null; model?: string | null }>(
    thread: T,
    resolvePublicSelection: PublicSelectionResolver,
  ) {
    const selection = resolvePublicSelection(thread)
    const { contextState, ...publicThread } = thread as T & { contextState?: unknown }
    void contextState
    return {
      ...publicThread,
      providerId: selection.providerId || null,
      modelId: selection.modelId || null,
      model: selection.model || null,
    }
  }

  private toPublicMessageSelection<T extends { metadata?: Record<string, unknown> | null }>(
    message: T,
    resolvePublicSelection: PublicSelectionResolver,
  ) {
    const modelSelection = message?.metadata?.modelSelection
    if (!modelSelection || typeof modelSelection !== 'object' || Array.isArray(modelSelection)) {
      return message
    }

    const selection = resolvePublicSelection(modelSelection)
    return {
      ...message,
      metadata: {
        ...(message.metadata || {}),
        modelSelection: {
          providerId: selection.providerId || null,
          modelId: selection.modelId || null,
          model: selection.model || null,
        },
      },
    }
  }
}
