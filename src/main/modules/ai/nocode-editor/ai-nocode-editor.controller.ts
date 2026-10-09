import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Request, Response } from 'express'
import { getAccountId, getAccountName } from '@main/utils/account'
import {
  AiChatRequest,
  AiChatStreamPayload,
  AiClientToolResultRequest,
  AiMessageRole,
  AiStreamEventType,
  AiToolExecutionContext,
} from '../ai.types'
import type { NocodeEditorRelationContext } from '@common/utils/nocodeEditorRelationContext'
import { AiNocodeEditorAppAccessService } from './ai-nocode-editor-app-access.service'
import { NocodeEditorBlueprintStoreService } from './nocode-editor-blueprint-store.service'
import { NocodeEditorRelationContextStoreService } from './nocode-editor-relation-context.store.service'
import { AiNocodeEditorChatService } from './nocode-editor-chat.service'
import { AiNocodeEditorConversationService } from './nocode-editor-conversation.service'
import { AiAttachmentService } from '../thread/ai-attachment.service'
import { AiAttachmentUploadExceptionFilter } from '../thread/ai-attachment-upload-exception.filter'
import { AiOpenAiService } from '../openai/ai-openai.service'
import { NocodeEditorConversationMigrationService } from './nocode-editor-conversation-migration.service'
import { getRuntime } from '@main/runtime'

@Controller('ai')
export class AiNocodeEditorController {
  constructor(
    private readonly aiNocodeEditorChatService: AiNocodeEditorChatService,
    private readonly aiNocodeEditorConversationService: AiNocodeEditorConversationService,
    private readonly nocodeEditorBlueprintStoreService: NocodeEditorBlueprintStoreService,
    private readonly nocodeEditorRelationContextStoreService: NocodeEditorRelationContextStoreService,
    private readonly aiNocodeEditorAppAccessService: AiNocodeEditorAppAccessService,
    private readonly attachmentService: AiAttachmentService,
    private readonly openAiService: AiOpenAiService,
    private readonly migrationService: NocodeEditorConversationMigrationService,
  ) {}

  @Get('nocode-editor/conversations/:conversationId/export')
  async exportConversation(
    @Param('conversationId') conversationId: string,
    @Query('nocodeId') nocodeId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const context = await this.assertEditorAttachmentConversation(req, conversationId, { nocodeId })
    const buffer = await this.migrationService.exportConversation(context.accountId, conversationId)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="nocode-editor-ai-conversation.zip"')
    res.setHeader('Content-Length', String(buffer.length))
    res.send(buffer)
  }

  @Post('nocode-editor/conversations/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async importConversation(
    @Body() body: { nocodeId?: string },
    @UploadedFile() file: { buffer?: Buffer },
    @Req() req: Request,
  ) {
    const context = this.resolveExecutionContext(req)
    if (getRuntime().isProduction) {
      throw new ForbiddenException('AI_CONVERSATION_IMPORT_ADMIN_REQUIRED')
    }
    const nocodeId = String(body?.nocodeId || '').trim()
    if (!nocodeId || !file?.buffer) throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertWritableNocode(req, nocodeId)
    return await this.migrationService.importConversation(context.accountId, safeNocodeId, file.buffer)
  }

  @Delete('nocode-editor/conversations/:conversationId')
  async clearConversation(
    @Param('conversationId') conversationId: string,
    @Query('nocodeId') nocodeId: string,
    @Req() req: Request,
  ) {
    const context = await this.assertEditorAttachmentConversation(req, conversationId, { nocodeId })
    return await this.aiNocodeEditorConversationService.deleteOwnerConversation(context.accountId, conversationId)
  }

  @Patch('nocode-editor/conversations/:conversationId/model-selection')
  async updateConversationModelSelection(
    @Param('conversationId') conversationId: string,
    @Body() body: {
      nocodeId?: string
      taskId?: string
      providerId?: string
      modelId?: string
      model?: string
      modelSelectionSource?: 'explicit'
    },
    @Req() req: Request,
  ) {
    const context = await this.assertEditorAttachmentConversation(req, conversationId, body)
    const selection = await this.openAiService.resolveModelSelection(body.model, {
      providerId: body.providerId,
      modelId: body.modelId,
      modelSelectionSource: 'explicit',
    })
    const conversation = await this.aiNocodeEditorConversationService.ensureConversation({
      ownerAccountId: context.accountId,
      nocodeId: context.nocodeId,
      conversationId,
      taskId: String(body.taskId || '').trim() || undefined,
      providerId: selection.providerId,
      modelId: selection.modelId,
      model: selection.model,
      modelSelectionSource: selection.modelSelectionSource,
    })
    return {
      providerId: conversation.providerId,
      modelId: conversation.modelId,
      model: conversation.model,
      modelSelectionSource: conversation.modelSelectionSource,
    }
  }

  @Post('chat/stream')
  async streamChat(@Body() body: AiChatRequest, @Req() req: Request, @Res() res: Response) {
    this.assertNocodeEditorScene(body)
    const traceId = String(body.traceId || body.metadata?.traceId || '').trim() || undefined
    this.initSseResponse(res)
    this.writeSseEvent(res, {
      event: AiStreamEventType.START,
      metadata: {
        connected: true,
        transport: 'sse',
        traceId,
      },
    })

    let closed = false
    const abortController = new AbortController()
    const handleDisconnect = (reason: string) => {
      closed = true
      if (!abortController.signal.aborted) {
        abortController.abort(reason)
      }
      if (!res.writableEnded) {
        res.end()
      }
    }
    req.on('aborted', () => handleDisconnect('req_aborted'))
    res.on('close', () => handleDisconnect('res_closed'))
    let delegatedToChatService = false

    try {
      const executionContext = this.resolveExecutionContext(req)
      delegatedToChatService = true
      await this.aiNocodeEditorChatService.streamChat({
        ...executionContext,
        request: this.buildChatRequest(body),
        signal: abortController.signal,
        emit: (payload: AiChatStreamPayload) => {
          if (!closed && !res.writableEnded) {
            this.writeSseEvent(res, payload)
          }
        },
      })
    } catch (error) {
      if (!delegatedToChatService && !closed && !res.writableEnded) {
        this.writeSseEvent(res, {
          conversationId: body.conversationId,
          event: AiStreamEventType.ERROR,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            traceId,
          },
        })
      }
    } finally {
      if (!closed && !res.writableEnded) {
        res.end()
      }
    }
  }

  @Post('chat/client-tool-result')
  async submitClientToolResult(@Body() body: AiClientToolResultRequest) {
    return await this.aiNocodeEditorChatService.resolveClientToolResult({
      body,
    })
  }

  @Post('nocode-editor/conversations/:conversationId/attachments')
  @UseFilters(AiAttachmentUploadExceptionFilter)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadAttachment(
    @Param('conversationId') conversationId: string,
    @Body() body: { nocodeId?: string; taskId?: string },
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number },
    @Req() req: Request,
  ) {
    const attachmentContext = await this.assertEditorAttachmentConversation(req, conversationId, body)
    return await this.attachmentService.upload(
      attachmentContext.accountId,
      conversationId,
      file,
      { nocodeId: attachmentContext.nocodeId },
    )
  }

  @Post('nocode-editor/conversations/:conversationId/attachments/preflight')
  async preflightAttachments(
    @Param('conversationId') conversationId: string,
    @Body() body: {
      nocodeId?: string
      taskId?: string
      attachments?: unknown[]
      providerId?: string
      modelId?: string
      model?: string
    },
    @Req() req: Request,
  ) {
    const { accountId } = await this.assertEditorAttachmentConversation(req, conversationId, body)
    await this.openAiService.prepareAttachmentsForModel({
      accountId,
      accountName: getAccountName(req.account),
      conversationId,
      providerId: body.providerId,
      modelId: body.modelId,
      model: body.model,
      attachments: body.attachments,
    })
    return { ok: true }
  }

  @Delete('nocode-editor/conversations/:conversationId/attachments/:attachmentId')
  async deleteAttachment(
    @Param('conversationId') conversationId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('nocodeId') nocodeId: string,
    @Query('taskId') taskId: string,
    @Req() req: Request,
  ) {
    const { accountId } = await this.assertEditorAttachmentConversation(req, conversationId, { nocodeId, taskId })
    return await this.attachmentService.delete(accountId, conversationId, attachmentId)
  }

  @Get('nocode-editor/conversations/:conversationId/attachments/:attachmentId/content')
  async readAttachment(
    @Param('conversationId') conversationId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('nocodeId') nocodeId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { accountId } = await this.assertEditorAttachmentConversation(req, conversationId, { nocodeId })
    const { entity, buffer } = await this.attachmentService.read(accountId, conversationId, attachmentId)
    res.setHeader('Content-Type', entity.mimeType)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Length', String(buffer.length))
    const disposition = entity.kind === 'image' ? 'inline' : 'attachment'
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(entity.originalName)}`)
    res.send(buffer)
  }

  @Get('nocode-editor/conversations/:conversationId/messages')
  async listConversationMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit: string | number,
    @Query('offset') offset: string | number,
    @Query('includeMeta') includeMeta: string | number,
    @Query('includeTool') includeTool: string | number,
    @Req() req: Request,
  ) {
    const executionContext = this.resolveExecutionContext(req)
    return await this.aiNocodeEditorConversationService.listMessagesForConversation(
      executionContext.accountId,
      conversationId,
      this.normalizeListNumber(limit, 80),
      this.normalizeListNumber(offset, 0),
      {
        includeToolMessages: String(includeTool || '').trim() === '1',
        includeTimelineMeta: String(includeMeta || '').trim() === '1',
      },
    )
  }

  @Post('nocode-editor/conversations/:conversationId/messages')
  async appendConversationMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: {
      role?: AiMessageRole | string
      content?: string
      traceId?: string
      nocodeId?: string
      taskId?: string
      scopeKey?: string
      source?: string
      metadata?: Record<string, unknown>
    },
    @Req() req: Request,
  ) {
    const executionContext = this.resolveExecutionContext(req)
    return await this.aiNocodeEditorChatService.appendExternalConversationMessage({
      accountId: executionContext.accountId,
      conversationId,
      role: body.role,
      nocodeId: body.nocodeId,
      taskId: String(body.taskId || '').trim() || undefined,
      scopeKey: String(body.scopeKey || '').trim() || undefined,
      source: String(body.source || '').trim() || undefined,
      content: String(body.content || ''),
      traceId: String(body.traceId || '').trim() || undefined,
      metadata: body.metadata || null,
    })
  }

  @Get('nocode-editor/apps/:nocodeId/latest-conversation')
  async getLatestConversationForApp(
    @Param('nocodeId') nocodeId: string,
    @Req() req: Request,
  ) {
    const executionContext = this.resolveExecutionContext(req)
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertReadableNocode(req, nocodeId)
    const conversation = await this.aiNocodeEditorConversationService.findLatestConversationForApp(
      executionContext.accountId,
      safeNocodeId,
    )
    if (!conversation) {
      return null
    }
    return {
      conversationId: conversation.id,
      taskId: conversation.taskId || '',
      scopeKey: conversation.scopeKey || '',
      source: conversation.source || '',
      taskSummary: conversation.taskSummary || null,
      providerId: conversation.providerId || null,
      modelId: conversation.modelId || null,
      model: conversation.model || null,
      modelSelectionSource: conversation.modelSelectionSource || null,
      lastActiveTime: Number(conversation.lastActiveTime || conversation.updateTime || 0),
    }
  }

  @Get('nocode-editor/apps/:nocodeId/applied-blueprints')
  async listAppliedBlueprints(
    @Param('nocodeId') nocodeId: string,
    @Req() req: Request,
  ) {
    this.resolveExecutionContext(req)
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertReadableNocode(req, nocodeId)
    return await this.nocodeEditorBlueprintStoreService.listAppliedBlueprints(safeNocodeId)
  }

  @Post('nocode-editor/apps/:nocodeId/applied-blueprints')
  async upsertAppliedBlueprint(
    @Param('nocodeId') nocodeId: string,
    @Body() body: {
      recordId?: string
      blueprintId?: string
      source?: string
      title?: string
      summary?: string
      sortIndex?: number
      revision?: number
      stagedAt?: number
      appliedAt?: number
      itemKind?: 'ai_blueprint' | 'current_form_snapshot'
      phase?: 'applied_draft' | 'applied_saved' | null
      applyResult?: Record<string, unknown> | null
      blueprint: Record<string, unknown>
    },
    @Req() req: Request,
  ) {
    this.resolveExecutionContext(req)
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertWritableNocode(req, nocodeId)
    return await this.nocodeEditorBlueprintStoreService.upsertAppliedBlueprint(safeNocodeId, body)
  }

  @Post('nocode-editor/apps/:nocodeId/applied-blueprints/replace')
  async replaceAppliedBlueprints(
    @Param('nocodeId') nocodeId: string,
    @Body() body: {
      items?: Array<{
        recordId?: string
        blueprintId?: string
        source?: string
        title?: string
        summary?: string
        sortIndex?: number
        revision?: number
        stagedAt?: number
        createdAt?: number
        updatedAt?: number
        appliedAt?: number
        itemKind?: 'ai_blueprint' | 'current_form_snapshot'
        phase?: 'applied_draft' | 'applied_saved' | null
        applyResult?: Record<string, unknown> | null
        blueprint: Record<string, unknown>
      }>
    },
    @Req() req: Request,
  ) {
    this.resolveExecutionContext(req)
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertWritableNocode(req, nocodeId)
    return await this.nocodeEditorBlueprintStoreService.replaceAppliedBlueprints(
      safeNocodeId,
      Array.isArray(body?.items) ? body.items : [],
    )
  }

  @Get('nocode-editor/apps/:nocodeId/relation-context')
  async getRelationContext(
    @Param('nocodeId') nocodeId: string,
    @Req() req: Request,
  ) {
    this.resolveExecutionContext(req)
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertReadableNocode(req, nocodeId)
    return await this.nocodeEditorRelationContextStoreService.readContext(safeNocodeId)
  }

  @Post('nocode-editor/apps/:nocodeId/relation-context/sync')
  async syncRelationContext(
    @Param('nocodeId') nocodeId: string,
    @Body() body: {
      context?: NocodeEditorRelationContext | null
    },
    @Req() req: Request,
  ) {
    this.resolveExecutionContext(req)
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertWritableNocode(req, nocodeId)
    if (!body?.context) {
      throw new BadRequestException(global.i18next.t('aiNocodeEditorController.relationContextRequired'))
    }
    return await this.nocodeEditorRelationContextStoreService.upsertContext(safeNocodeId, body.context)
  }

  private async assertEditorAttachmentConversation(
    req: Request,
    conversationId: string,
    body: { nocodeId?: string; taskId?: string },
  ) {
    const executionContext = this.resolveExecutionContext(req)
    const nocodeId = String(body.nocodeId || '').trim()
    if (!nocodeId) {
      throw new BadRequestException('AI_ATTACHMENT_ACCESS_DENIED')
    }
    const safeNocodeId = await this.aiNocodeEditorAppAccessService.assertReadableNocode(req, nocodeId)
    const normalizedConversationId = String(conversationId || '').trim()
    const existingConversation = await this.aiNocodeEditorConversationService.getOwnerConversation(
      executionContext.accountId,
      normalizedConversationId,
    )
    if (existingConversation) {
      if (existingConversation.nocodeId !== safeNocodeId) {
        throw new BadRequestException('AI_ATTACHMENT_ACCESS_DENIED')
      }
      return { accountId: executionContext.accountId, nocodeId: safeNocodeId }
    }

    const expectedConversationId = this.aiNocodeEditorConversationService.buildConversationId(
      executionContext.accountId,
      safeNocodeId,
      String(body.taskId || '').trim() || undefined,
    )
    if (!expectedConversationId || normalizedConversationId !== expectedConversationId) {
      throw new BadRequestException('AI_ATTACHMENT_ACCESS_DENIED')
    }
    return { accountId: executionContext.accountId, nocodeId: safeNocodeId }
  }

  private assertNocodeEditorScene(body: AiChatRequest) {
    if (body.scene && body.scene !== 'nocode-editor') {
      throw new UnauthorizedException('Only nocode-editor scene is supported by this endpoint')
    }
  }

  private resolveExecutionContext(req: Request): AiToolExecutionContext {
    if (!req.account) {
      throw new UnauthorizedException('Account is required')
    }

    return {
      accountId: getAccountId(req.account),
      accountName: getAccountName(req.account),
      accountUser: req.account?.user,
      accountIsAdmin: Boolean(req.account?.isAdmin),
    }
  }

  private buildChatRequest(body: AiChatRequest): AiChatRequest {
    return {
      ...body,
      scene: 'nocode-editor',
      scenePayload: body.scenePayload,
    }
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

  private normalizeListNumber(value: string | number | undefined, fallback: number) {
    const normalized = Number(value ?? fallback)
    if (!Number.isFinite(normalized) || normalized < 0) {
      return fallback
    }
    return Math.round(normalized)
  }
}
