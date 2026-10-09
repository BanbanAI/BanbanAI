import { Body, Controller, Get, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common'
import { Request, Response } from 'express'
import type { AiThreadModelSelection } from '@common/types/ai-provider'
import { NoLocalAuthGuard } from '../../auth/guards/local-auth.guard'
import { getAccountId } from '@main/utils/account'
import { AiChatStreamPayload, AiShareBootstrapRequest, AiShareStreamRequest, AiStreamEventType, AiThreadVisitorProfile } from '../ai.types'
import { AiConfigService } from '../config/ai-config.service'
import { AiRuntimeOrchestratorService } from '../runtime/ai-runtime-orchestrator.service'
import { AiThreadService } from '../thread/ai-thread.service'
import { AiShareService } from './ai-share.service'

type PublicSelectionResolver = (selection?: AiThreadModelSelection | null) => AiThreadModelSelection

@Controller('ai')
export class AiShareController {
  constructor(
    private readonly threadService: AiThreadService,
    private readonly shareService: AiShareService,
    private readonly aiConfigService: AiConfigService,
    private readonly runtimeOrchestrator: AiRuntimeOrchestratorService,
  ) {}

  @Get('agents/:agentId/share')
  async getOwnerAgentShare(@Req() req: Request, @Param('agentId') agentId: string) {
    return await this.shareService.getOwnerShareByAgent(getAccountId(req.account), agentId)
  }

  @Post('agents/:agentId/share')
  async setOwnerAgentShare(
    @Req() req: Request,
    @Param('agentId') agentId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return await this.shareService.setShareEnabledByAgent(getAccountId(req.account), agentId, enabled)
  }

  @Get('threads/:threadId/share')
  async getOwnerShare(@Req() req: Request, @Param('threadId') threadId: string) {
    return await this.shareService.getOwnerShare(getAccountId(req.account), threadId)
  }

  @Post('threads/:threadId/share')
  async setOwnerShare(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return await this.shareService.setShareEnabled(getAccountId(req.account), threadId, enabled)
  }

  @NoLocalAuthGuard()
  @Post('share/bootstrap')
  async bootstrapShare(@Req() req: Request, @Body() body: AiShareBootstrapRequest) {
    const { share, agent, ownerThread } = await this.resolveSharedOwnerThread(body.shareToken)
    if (!ownerThread || ownerThread.deleteTime) {
      throw new UnauthorizedException('Thread is not available')
    }

    const visitorKey = String(body.visitorKey || '').trim()
    if (!visitorKey) {
      throw new UnauthorizedException('visitorKey is required')
    }

    let visitorThread = await this.threadService.ensureVisitorThread(agent, visitorKey)
    visitorThread = await this.threadService.touchVisitorThreadProfile(
      visitorThread.id,
      this.buildVisitorProfile(req, body.metadata),
    ) || visitorThread
    const messages = await this.threadService.listMessagesByThreadId(visitorThread.id, 100, 0)
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    const publicThread = this.toPublicThreadSelection(visitorThread, resolvePublicSelection)
    return {
      share,
      thread: publicThread,
      ownerThread: {
        id: ownerThread.id,
        agentId: ownerThread.agentId,
        title: ownerThread.title,
      },
      messages: messages.map(message => this.toPublicMessageSelection(message, resolvePublicSelection)),
    }
  }

  @NoLocalAuthGuard()
  @Get('share/messages')
  async listShareMessages(
    @Query('shareToken') shareToken: string,
    @Query('visitorKey') visitorKey: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { visitorThread } = await this.resolveVisitorThread(shareToken, visitorKey)
    const messages = await this.threadService.listMessagesByThreadId(
      visitorThread.id,
      Number(limit || 50),
      Number(offset || 0),
    )
    const resolvePublicSelection = await this.aiConfigService.createPublicSelectionResolver()
    return messages.map(message => this.toPublicMessageSelection(message, resolvePublicSelection))
  }

  @NoLocalAuthGuard()
  @Post('share/ping')
  async ping(@Body('token') token: string) {
    const agent = await this.shareService.resolveEnabledAgent(token);
    if (!agent) {
      throw new Error('Share is not available');
    }
  }

  @NoLocalAuthGuard()
  @Post('share/stream')
  async streamSharedThread(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: AiShareStreamRequest,
  ) {
    const { agent, ownerThread, visitorThread: resolvedVisitorThread } = await this.resolveVisitorThread(body.shareToken, body.visitorKey)
    const visitorThread = await this.threadService.touchVisitorThreadProfile(
      resolvedVisitorThread.id,
      this.buildVisitorProfile(req, body.metadata),
    ) || resolvedVisitorThread
    const abortController = new AbortController()
    this.initSseResponse(res)
    let closed = false
    const handleDisconnect = () => {
      if (!abortController.signal.aborted) {
        abortController.abort()
      }
      closed = true
      if (!res.writableEnded) {
        res.end()
      }
    }
    req.on('aborted', handleDisconnect)
    req.on('close', handleDisconnect)
    res.on('close', handleDisconnect)

    try {
      const traceId = String(body.traceId || body.metadata?.traceId || '').trim() || undefined
      const selection = await this.aiConfigService.resolveModelSelection(visitorThread, null)
      await this.runtimeOrchestrator.streamTurn({
        thread: visitorThread,
        message: String(body.message || '').trim(),
        traceId,
        requestMetadata: body.metadata || undefined,
        providerId: selection.providerId,
        modelId: selection.modelId,
        model: selection.model,
        explicitAppIds: visitorThread.appScope?.appIds || [],
        isShareMode: true,
        toolContext: {
          accountId: agent.ownerAccountId,
          accountName: `share:${agent.ownerAccountId}`,
          appScope: visitorThread.appScope,
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
          threadId: visitorThread.id,
          conversationId: visitorThread.id,
          event: AiStreamEventType.ERROR,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            agentId: visitorThread.agentId,
          },
        })
      }
    } finally {
      if (!closed && !res.writableEnded) {
        res.end()
      }
    }
  }

  private async resolveVisitorThread(shareToken: string, visitorKey: string) {
    const { share, agent, ownerThread } = await this.resolveSharedOwnerThread(shareToken)
    const normalizedVisitorKey = String(visitorKey || '').trim()
    if (!normalizedVisitorKey) {
      throw new UnauthorizedException('visitorKey is required')
    }
    const visitorThread = await this.threadService.ensureVisitorThread(agent, normalizedVisitorKey)
    return {
      share,
      agent,
      ownerThread,
      visitorThread,
    }
  }

  private async resolveSharedOwnerThread(shareToken: string) {
    const agent = await this.shareService.resolveEnabledAgent(String(shareToken || '').trim())
    if (!agent) {
      throw new UnauthorizedException('Share is not available')
    }
    const ownerThread = await this.threadService.getOwnerThreadByAgentId(agent.ownerAccountId, agent.id)
    if (!ownerThread || ownerThread.deleteTime) {
      throw new UnauthorizedException('Thread is not available')
    }
    return {
      share: this.shareService.toShareInfo(agent),
      agent,
      ownerThread,
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

  private buildVisitorProfile(req: Request, metadata?: Record<string, any> | null): AiThreadVisitorProfile {
    const now = Date.now()
    const referrer = this.normalizeText(metadata?.referrer) || this.resolveRequestHeader(req, 'referer')
    const origin = this.normalizeText(metadata?.pageOrigin) || this.resolveRequestHeader(req, 'origin')
    const userAgent = this.resolveRequestHeader(req, 'user-agent')
    const platform = this.normalizeText(metadata?.platform) || this.resolveRequestPlatform(req, userAgent)
    const language = this.normalizeText(metadata?.language) || this.resolveRequestLanguage(req)
    const embedded = Boolean(metadata?.embedded)
    const referrerDomain = this.extractHostname(referrer)
    const originDomain = this.extractHostname(origin)

    return {
      firstSeenAt: now,
      lastSeenAt: now,
      sourceDomain: embedded
        ? (referrerDomain || originDomain)
        : originDomain,
      referrer,
      origin,
      platform,
      language,
      os: this.resolveOs(userAgent),
      browser: this.resolveBrowser(userAgent),
      userAgent,
      ip: this.resolveRequestIp(req),
    }
  }

  private resolveRequestHeader(req: Request, key: string) {
    const value = req.headers[key]
    if (Array.isArray(value)) {
      return String(value[0] || '').trim()
    }
    return String(value || '').trim()
  }

  private resolveRequestIp(req: Request) {
    const forwarded = req.headers['x-forwarded-for']
    let ip = ''

    if (Array.isArray(forwarded)) {
      ip = forwarded[0] || ''
    } else if (typeof forwarded === 'string') {
      ip = forwarded.split(',')[0]?.trim() || ''
    }

    if (!ip) {
      const realIp = req.headers['x-real-ip']
      if (Array.isArray(realIp)) {
        ip = realIp[0] || ''
      } else if (typeof realIp === 'string') {
        ip = realIp
      }
    }

    if (!ip) {
      ip = req.socket?.remoteAddress || req.ip || ''
    }

    return String(ip || '').replace(/^::ffff:/, '').trim()
  }

  private resolveRequestPlatform(req: Request, userAgent: string) {
    const secChUaPlatform = this.resolveRequestHeader(req, 'sec-ch-ua-platform').replace(/^"(.*)"$/, '$1').trim()
    if (secChUaPlatform) {
      return secChUaPlatform
    }
    return this.resolveOs(userAgent)
  }

  private resolveRequestLanguage(req: Request) {
    const acceptLanguage = this.resolveRequestHeader(req, 'accept-language')
    return acceptLanguage.split(',')[0]?.trim() || ''
  }

  private resolveOs(userAgent: string) {
    const ua = userAgent.toLowerCase()
    if (!ua) {
      return ''
    }
    if (ua.includes('windows nt 10.0')) {
      return 'Windows 10/11'
    }
    if (ua.includes('windows')) {
      return 'Windows'
    }
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      return 'iOS'
    }
    if (ua.includes('android')) {
      return 'Android'
    }
    if (ua.includes('mac os x') || ua.includes('macintosh')) {
      return 'macOS'
    }
    if (ua.includes('linux')) {
      return 'Linux'
    }
    return ''
  }

  private resolveBrowser(userAgent: string) {
    const ua = userAgent.toLowerCase()
    if (!ua) {
      return ''
    }
    if (ua.includes('micromessenger')) {
      return 'WeChat'
    }
    if (ua.includes('edg/')) {
      return 'Edge'
    }
    if (ua.includes('opr/') || ua.includes('opera')) {
      return 'Opera'
    }
    if (ua.includes('chrome/') && !ua.includes('edg/') && !ua.includes('opr/')) {
      return 'Chrome'
    }
    if (ua.includes('firefox/')) {
      return 'Firefox'
    }
    if (ua.includes('safari/') && !ua.includes('chrome/')) {
      return 'Safari'
    }
    if (ua.includes('trident/') || ua.includes('msie')) {
      return 'Internet Explorer'
    }
    return ''
  }

  private extractHostname(value?: string | null) {
    const normalized = this.normalizeText(value)
    if (!normalized) {
      return ''
    }

    try {
      const url = /^[a-z]+:\/\//i.test(normalized)
        ? normalized
        : normalized.startsWith('//')
          ? `https:${normalized}`
          : `https://${normalized}`
      return new URL(url).hostname || ''
    } catch {
      return normalized
        .replace(/^[a-z]+:\/\//i, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]
        .split(':')[0]
        .trim()
    }
  }

  private normalizeText(value?: string | null) {
    return String(value || '').trim()
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

  private toPublicMessageSelection<T extends { metadata?: Record<string, any> | null }>(
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
