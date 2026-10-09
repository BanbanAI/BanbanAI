import { createHash } from 'node:crypto'
import { getEncoding, type TiktokenEncoding, type TiktokenModel } from 'js-tiktoken'
import { getEncodingNameForModel } from 'js-tiktoken/lite'
import type { AiProviderMessage } from '../ai.types'

export type AiTokenEstimateContext = {
  model?: string | null
  providerType?: string | null
}

export type AiContextWindowSettings = {
  contextWindow?: number | null
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
}

export type AiContextProjection = {
  messages: AiProviderMessage[]
  compacted: boolean
  sourceFingerprint?: string
  sourceMessageCount: number
  estimatedTokens: number
}

export class AiContextWindowService {
  static readonly PRODUCT_MAX_INPUT_TOKENS = 258_000
  static readonly DEFAULT_CONTEXT_WINDOW = 128_000
  static readonly COMPACTION_TRIGGER_RATIO = 0.8
  static readonly COMPACTION_TARGET_RATIO = 0.1
  static readonly RECENT_MESSAGE_COUNT = 4
  // Image payloads are sent as data URLs, but providers charge image tokens by
  // the rendered image rather than by the Base64 string length.
  static readonly IMAGE_INPUT_TOKEN_ESTIMATE = 1_024
  private readonly encodingCache = new Map<string, ReturnType<typeof getEncoding>>()

  resolveInputBudget(settings: AiContextWindowSettings) {
    const contextWindow = this.toPositiveNumber(settings.contextWindow) || AiContextWindowService.DEFAULT_CONTEXT_WINDOW
    const maxInputTokens = this.toPositiveNumber(settings.maxInputTokens)
    const maxOutputTokens = this.toPositiveNumber(settings.maxOutputTokens) || 0
    const outputReservedBudget = Math.max(1, contextWindow - maxOutputTokens)
    return Math.max(1, Math.min(
      AiContextWindowService.PRODUCT_MAX_INPUT_TOKENS,
      maxInputTokens || Number.POSITIVE_INFINITY,
      outputReservedBudget,
    ))
  }

  estimateTextTokens(value: unknown, context?: AiTokenEstimateContext) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
    const normalizedText = String(text || '')
    const encoding = this.resolveEncoding(context)
    if (encoding) {
      return encoding.encode(normalizedText).length
    }
    return this.estimateUnknownModelTokens(normalizedText)
  }

  estimateContentTokens(value: unknown, context?: AiTokenEstimateContext) {
    if (Array.isArray(value)) {
      return value.reduce((total, item) => total + this.estimateContentTokens(item, context), 0)
    }

    if (value && typeof value === 'object') {
      const part = value as Record<string, unknown>
      const type = String(part.type || '').trim().toLowerCase()
      if (type === 'image' || type === 'image_url') {
        return AiContextWindowService.IMAGE_INPUT_TOKEN_ESTIMATE
      }
      if (type === 'text' && 'text' in part) {
        return this.estimateTextTokens(part.text, context)
      }
    }

    return this.estimateTextTokens(value, context)
  }

  estimateMessagesTokens(messages: AiProviderMessage[], context?: AiTokenEstimateContext) {
    return messages.reduce((total, message) => total + this.estimateContentTokens(message.content, context) + 4, 0)
  }

  shouldCompact(estimatedTokens: number, inputBudget: number) {
    return estimatedTokens >= inputBudget * AiContextWindowService.COMPACTION_TRIGGER_RATIO
  }

  buildSourceFingerprint(messages: AiProviderMessage[]) {
    return createHash('sha256')
      .update(JSON.stringify(messages.map(message => ({
        role: message.role,
        content: message.content,
        metadata: message.metadata?.attachments || message.metadata?.toolCalls || null,
      }))))
      .digest('hex')
  }

  projectHistory(options: {
    history: AiProviderMessage[]
    summary?: string | null
    inputBudget: number
    currentEvidenceTokens?: number
    tokenContext?: AiTokenEstimateContext
  }): AiContextProjection {
    const history = options.history || []
    const sourceFingerprint = this.buildSourceFingerprint(history)
    const { old, recent } = this.splitHistory(history)
    const summaryMessage = options.summary?.trim()
      ? [{
          role: 'system' as AiProviderMessage['role'],
          content: `以下是较早对话的压缩摘要，仅用于保持上下文连续性：\n${options.summary.trim()}`,
          metadata: { contextCompaction: true },
        }]
      : []
    const projected = [...summaryMessage, ...recent]
    const estimatedTokens = this.estimateMessagesTokens(projected, options.tokenContext) + Math.max(0, options.currentEvidenceTokens || 0)
    return {
      messages: projected,
      compacted: old.length > 0,
      sourceFingerprint,
      sourceMessageCount: old.length,
      estimatedTokens,
    }
  }

  splitHistory(history: AiProviderMessage[]) {
    let start = Math.max(0, history.length - AiContextWindowService.RECENT_MESSAGE_COUNT)
    while (start > 0 && history[start]?.role === 'tool') {
      start -= 1
    }
    if (start > 0 && history[start]?.role === 'assistant' && Array.isArray(history[start]?.metadata?.toolCalls)) {
      start -= 1
    }
    return {
      old: history.slice(0, start),
      recent: history.slice(start),
    }
  }

  buildFallbackSummary(messages: AiProviderMessage[]) {
    return messages
      .map(message => `${message.role}: ${String(message.content || '').trim()}`)
      .filter(item => item.length > 7)
      .join('\n')
      .slice(0, 12_000)
  }

  private toPositiveNumber(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }

  private resolveEncoding(context?: AiTokenEstimateContext) {
    const model = String(context?.model || '').trim().toLowerCase()
    if (!model) {
      return null
    }
    const encodingName = this.resolveEncodingName(model)
    if (!encodingName) {
      return null
    }
    let encoding = this.encodingCache.get(encodingName)
    if (!encoding) {
      try {
        encoding = getEncoding(encodingName)
        this.encodingCache.set(encodingName, encoding)
      } catch {
        return null
      }
    }
    return encoding
  }

  private resolveEncodingName(model: string): TiktokenEncoding | null {
    try {
      return getEncodingNameForModel(model as TiktokenModel)
    } catch {
      // Continue with family matching for model versions newer than this tokenizer package.
    }

    if (/^(?:chatgpt-4o|gpt-4o|gpt-4\.(?:1|5))(?:$|[-.])/.test(model)) {
      return 'o200k_base'
    }
    if (/^o\d+(?:$|[-.])/.test(model)) {
      return 'o200k_base'
    }

    const gptVersion = /^gpt-(\d+)(?:$|[-.])/.exec(model)
    if (gptVersion) {
      const majorVersion = Number(gptVersion[1])
      if (majorVersion >= 5) {
        return 'o200k_base'
      }
      if (majorVersion >= 3) {
        return 'cl100k_base'
      }
    }
    if (/^text-embedding-/.test(model)) {
      return 'cl100k_base'
    }
    return null
  }

  private estimateUnknownModelTokens(text: string) {
    let cjkCharacters = 0
    let nonAsciiCharacters = 0
    let asciiCharacters = 0
    for (const character of text) {
      const codePoint = character.codePointAt(0) || 0
      if (
        (codePoint >= 0x2e80 && codePoint <= 0x9fff)
        || (codePoint >= 0xac00 && codePoint <= 0xd7af)
        || (codePoint >= 0x3040 && codePoint <= 0x30ff)
      ) {
        cjkCharacters += 1
      } else if (codePoint > 0x7f) {
        nonAsciiCharacters += 1
      } else {
        asciiCharacters += 1
      }
    }
    return Math.max(0, Math.ceil((cjkCharacters + nonAsciiCharacters + asciiCharacters / 3) * 1.1))
  }
}
