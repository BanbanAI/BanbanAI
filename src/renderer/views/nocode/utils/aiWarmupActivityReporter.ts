import axios from 'axios'
import type { InjectionKey } from 'vue'

export type AiWarmupRendererActivityType =
  | 'pointer'
  | 'keyboard'
  | 'wheel'
  | 'visibility'
  | 'route'
  | 'open_app'
  | 'editor'
  | 'save'
  | 'submit'
  | 'publish'
  | 'import'

type ReporterOptions = {
  resolveAppId?: () => string | undefined | null
  throttleMs?: number
}

export type AiWarmupActivityReporter = {
  report: (type: AiWarmupRendererActivityType) => void
}

type InstalledReporter = AiWarmupActivityReporter & {
  dispose: () => void
}

export const AI_WARMUP_ACTIVITY_REPORTER: InjectionKey<AiWarmupActivityReporter> = Symbol(
  'AI_WARMUP_ACTIVITY_REPORTER',
)

const IMMEDIATE_ACTIVITY_TYPES = new Set<AiWarmupRendererActivityType>([
  'visibility',
  'route',
  'open_app',
  'editor',
  'save',
  'submit',
  'publish',
  'import',
])

export function installAiWarmupActivityReporter(options: ReporterOptions = {}): InstalledReporter {
  const throttleMs = Math.max(1000, Math.round(Number(options.throttleMs || 12000)) || 12000)
  let lastSentAt = 0
  let pendingTimer: number | null = null

  const postActivity = (type: AiWarmupRendererActivityType) => {
    const appId = String(options.resolveAppId?.() || '').trim() || undefined
    void axios.post('/ai/warmup/activity', {
      type,
      appId,
      at: Date.now(),
      routeHash: window.location.hash || '',
      visible: !document.hidden,
    }).catch(() => undefined)
  }

  const clearPendingTimer = () => {
    if (pendingTimer === null) {
      return
    }
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }

  const report = (type: AiWarmupRendererActivityType) => {
    const now = Date.now()
    const shouldSendNow = IMMEDIATE_ACTIVITY_TYPES.has(type) || now - lastSentAt >= throttleMs
    if (shouldSendNow) {
      clearPendingTimer()
      lastSentAt = now
      postActivity(type)
      return
    }
    if (pendingTimer !== null) {
      return
    }
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null
      lastSentAt = Date.now()
      postActivity(type)
    }, Math.max(0, throttleMs - (now - lastSentAt)))
  }

  const onPointer = () => report('pointer')
  const onKeyboard = () => report('keyboard')
  const onWheel = () => report('wheel')
  const onVisibility = () => report('visibility')
  const onRoute = () => report('route')

  window.addEventListener('pointerdown', onPointer, { passive: true })
  window.addEventListener('keydown', onKeyboard)
  window.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('hashchange', onRoute)
  document.addEventListener('visibilitychange', onVisibility)
  report('visibility')

  return {
    report,
    dispose() {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKeyboard)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('hashchange', onRoute)
      document.removeEventListener('visibilitychange', onVisibility)
      clearPendingTimer()
    },
  }
}
