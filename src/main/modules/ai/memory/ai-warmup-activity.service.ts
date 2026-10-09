import { Injectable } from '@nestjs/common'
import type { AiWarmupActivityKind, AiWarmupActivitySnapshot } from '../ai.types'

type TouchOptions = {
  type?: AiWarmupActivityKind | string
  appId?: string
  at?: number
  reason?: string
}

@Injectable()
export class AiWarmupActivityService {
  private scopeBaselineAt = Date.now()
  private lastUserActivityAt = this.scopeBaselineAt
  private lastForegroundAiActivityAt = this.scopeBaselineAt
  private lastServerWriteActivityAt = this.scopeBaselineAt
  private lastWarmupStartedAt: number | undefined
  private lastWarmupCanceledAt: number | undefined
  private lastActivityReason: string | undefined
  private lastCancelReason: string | undefined
  private activityEpoch = 0
  private readonly lastActivityByAppId = new Map<string, number>()
  private readonly listeners = new Set<(epoch: number) => void>()

  touchUserActivity(options: TouchOptions = {}) {
    this.touch('user', options)
  }

  touchForegroundAiActivity(options: TouchOptions = {}) {
    this.touch('foreground_ai', options)
  }

  touchServerWriteActivity(options: TouchOptions = {}) {
    this.touch('server_write', options)
  }

  markWarmupStarted(options: { taskKey?: string; at?: number }) {
    this.lastWarmupStartedAt = this.normalizeAt(options.at)
  }

  markWarmupCanceled(options: { taskKey?: string; at?: number; reason: string }) {
    this.lastWarmupCanceledAt = this.normalizeAt(options.at)
    this.lastCancelReason = String(options.reason || '').trim() || 'canceled'
  }

  getCurrentEpoch() {
    return this.activityEpoch
  }

  isEpochCurrent(epoch: number) {
    return Number(epoch) === this.activityEpoch
  }

  subscribe(listener: (epoch: number) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getGlobalIdleAgeMs(now = Date.now()) {
    return Math.max(0, now - Math.max(
      this.lastUserActivityAt,
      this.lastForegroundAiActivityAt,
      this.lastServerWriteActivityAt,
    ))
  }

  getScopedIdleAgeMs(appId?: string, now = Date.now()) {
    const normalizedAppId = String(appId || '').trim()
    const scopedLastActivityAt = normalizedAppId
      ? Number(this.lastActivityByAppId.get(normalizedAppId) || this.scopeBaselineAt)
      : Math.max(this.lastUserActivityAt, this.lastForegroundAiActivityAt, this.lastServerWriteActivityAt)
    return Math.max(0, now - scopedLastActivityAt)
  }

  getSnapshot(now = Date.now()): AiWarmupActivitySnapshot {
    const scopedIdleAgeByAppId: Record<string, number> = {}
    for (const [appId, lastAt] of this.lastActivityByAppId.entries()) {
      scopedIdleAgeByAppId[appId] = Math.max(0, now - lastAt)
    }
    return {
      lastUserActivityAt: this.lastUserActivityAt,
      lastForegroundAiActivityAt: this.lastForegroundAiActivityAt,
      lastServerWriteActivityAt: this.lastServerWriteActivityAt,
      lastWarmupStartedAt: this.lastWarmupStartedAt,
      lastWarmupCanceledAt: this.lastWarmupCanceledAt,
      lastActivityReason: this.lastActivityReason,
      lastCancelReason: this.lastCancelReason,
      activityEpoch: this.activityEpoch,
      globalIdleAgeMs: this.getGlobalIdleAgeMs(now),
      scopedIdleAgeByAppId,
    }
  }

  resetForRegression(now = Date.now()) {
    this.scopeBaselineAt = now
    this.lastUserActivityAt = now
    this.lastForegroundAiActivityAt = now
    this.lastServerWriteActivityAt = now
    this.lastWarmupStartedAt = undefined
    this.lastWarmupCanceledAt = undefined
    this.lastActivityReason = undefined
    this.lastCancelReason = undefined
    this.activityEpoch = 0
    this.lastActivityByAppId.clear()
  }

  private touch(kind: 'user' | 'foreground_ai' | 'server_write', options: TouchOptions) {
    const at = this.normalizeAt(options.at)
    const reason = String(options.reason || options.type || kind).trim()
    if (kind === 'user') {
      this.lastUserActivityAt = Math.max(this.lastUserActivityAt, at)
    } else if (kind === 'foreground_ai') {
      this.lastForegroundAiActivityAt = Math.max(this.lastForegroundAiActivityAt, at)
    } else {
      this.lastServerWriteActivityAt = Math.max(this.lastServerWriteActivityAt, at)
    }
    const appId = String(options.appId || '').trim()
    if (appId) {
      this.lastActivityByAppId.set(appId, Math.max(this.lastActivityByAppId.get(appId) || this.scopeBaselineAt, at))
    }
    this.lastActivityReason = reason
    this.activityEpoch += 1
    for (const listener of [...this.listeners]) {
      try {
        listener(this.activityEpoch)
      } catch {}
    }
  }

  private normalizeAt(value: unknown) {
    const now = Date.now()
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return now
    }
    return Math.min(Math.round(numericValue), now + 5000)
  }
}
