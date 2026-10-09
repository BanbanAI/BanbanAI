import { Body, Controller, Post } from '@nestjs/common'
import type { AiWarmupActivityKind } from '../ai.types'
import { AiWarmupActivityService } from './ai-warmup-activity.service'

@Controller('ai/warmup')
export class AiWarmupActivityController {
  constructor(
    private readonly activityService: AiWarmupActivityService,
  ) {}

  @Post('activity')
  async nocodeActivity(
    @Body() body?: {
      type?: AiWarmupActivityKind | string
      appId?: string
      at?: number
      routeHash?: string
      visible?: boolean
    },
  ) {
    const receivedAt = Date.now()
    const type = this.normalizeType(body?.type)
    const visible = body?.visible !== false
    if (!visible && type !== 'visibility') {
      return {
        ok: true,
        ignored: true,
        activityEpoch: this.activityService.getCurrentEpoch(),
      }
    }
    this.activityService.touchUserActivity({
      type,
      appId: body?.appId,
      at: receivedAt,
      reason: `renderer:${type}`,
    })
    return {
      ok: true,
      activityEpoch: this.activityService.getCurrentEpoch(),
    }
  }

  private normalizeType(value: unknown): AiWarmupActivityKind {
    const normalized = String(value || '').trim()
    if ([
      'pointer',
      'keyboard',
      'wheel',
      'visibility',
      'route',
      'open_app',
      'editor',
      'save',
      'submit',
      'publish',
      'import',
    ].includes(normalized)) {
      return normalized as AiWarmupActivityKind
    }
    return 'pointer'
  }
}
