import { Injectable } from '@nestjs/common'
import { AiClientToolResultRequest } from '../ai.types'

type PendingToolCall = {
  resolve: (value: AiClientToolResultRequest) => void
  reject: (reason?: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

type WaitForClientToolResultOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

@Injectable()
export class AiClientToolBridgeService {
  private readonly pendingCalls = new Map<string, PendingToolCall>()
  private readonly resolvedResults = new Map<string, AiClientToolResultRequest>()

  waitForResult(
    conversationId: string,
    callId: string,
    timeoutMs?: number,
    signal?: AbortSignal,
  ): Promise<AiClientToolResultRequest>
  waitForResult(
    conversationId: string,
    callId: string,
    options?: WaitForClientToolResultOptions,
  ): Promise<AiClientToolResultRequest>
  waitForResult(
    conversationId: string,
    callId: string,
    options: number | WaitForClientToolResultOptions = 120000,
    legacySignal?: AbortSignal,
  ) {
    const key = this.buildKey(conversationId, callId)
    const timeoutMs = typeof options === 'number'
      ? options
      : Number(options.timeoutMs || 120000)
    const signal = typeof options === 'number' ? legacySignal : options.signal
    const earlyResult = this.resolvedResults.get(key)
    if (earlyResult) {
      this.resolvedResults.delete(key)
      return Promise.resolve(earlyResult)
    }
    const existing = this.pendingCalls.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      existing.reject(new Error(global.i18next.t('clientToolBridgeService.previousCallSuperseded')))
      this.pendingCalls.delete(key)
    }

    if (signal?.aborted) {
      return Promise.reject(new Error(global.i18next.t('clientToolBridgeService.waitAborted', { callId })))
    }

    return new Promise<AiClientToolResultRequest>((resolve, reject) => {
      const onAbort = () => pendingCall.reject(new Error(global.i18next.t('clientToolBridgeService.waitAborted', { callId })))
      const cleanup = () => {
        clearTimeout(pendingCall.timer)
        signal?.removeEventListener('abort', onAbort)
        if (this.pendingCalls.get(key) === pendingCall) {
          this.pendingCalls.delete(key)
        }
      }
      const pendingCall: PendingToolCall = {
        resolve: (value) => {
          cleanup()
          resolve(value)
        },
        reject: (reason) => {
          cleanup()
          reject(reason)
        },
        timer: setTimeout(() => {
          pendingCall.reject(new Error(global.i18next.t('clientToolBridgeService.resultTimeout', { callId })))
        }, timeoutMs),
      }

      this.pendingCalls.set(key, pendingCall)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  resolveResult(payload: AiClientToolResultRequest) {
    const key = this.buildKey(payload.conversationId, payload.callId)
    const pending = this.pendingCalls.get(key)
    if (!pending) {
      this.resolvedResults.set(key, payload)
      return {
        success: true,
        buffered: true,
      }
    }
    pending.resolve(payload)
    return {
      success: true,
    }
  }

  rejectConversation(conversationId: string, reason?: string) {
    const prefix = `${conversationId}:`
    for (const [key, pending] of this.pendingCalls.entries()) {
      if (!key.startsWith(prefix)) {
        continue
      }
      pending.reject(new Error(reason || global.i18next.t('clientToolBridgeService.conversationClosed')))
      this.pendingCalls.delete(key)
    }
    for (const key of this.resolvedResults.keys()) {
      if (key.startsWith(prefix)) {
        this.resolvedResults.delete(key)
      }
    }
  }

  private buildKey(conversationId: string, callId: string) {
    return `${String(conversationId || '').trim()}:${String(callId || '').trim()}`
  }
}
