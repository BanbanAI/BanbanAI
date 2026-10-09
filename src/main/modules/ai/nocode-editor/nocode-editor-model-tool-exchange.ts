import { AIMessage, ToolMessage } from '@langchain/core/messages'
import {
  AiMessageRole,
  AiModelToolExchangeCall,
  AiModelToolExchangeResult,
  AiProviderMessage,
} from '../ai.types'

const isPlainObject = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const getToolExchangeCall = (message: AiProviderMessage): AiModelToolExchangeCall | null => {
  const value = message?.metadata?.modelToolExchangeCall
  return isPlainObject(value) ? value as AiModelToolExchangeCall : null
}

const getToolExchangeResult = (message: AiProviderMessage): AiModelToolExchangeResult | null => {
  const value = message?.metadata?.modelToolExchangeResult
  return isPlainObject(value) ? value as AiModelToolExchangeResult : null
}

export const normalizeNocodeEditorModelToolExchangeMessage = (message: AiProviderMessage) => {
  const content = String(message?.content || '').trim()
  const toolExchangeCall = getToolExchangeCall(message)
  const toolExchangeResult = getToolExchangeResult(message)

  if (message.role === AiMessageRole.TOOL) {
    if (!toolExchangeResult) {
      return null
    }

    const toolCallId = String(
      message.toolCallId
      || toolExchangeResult?.callId
      || message?.metadata?.toolCallId
      || '',
    ).trim()
    if (!toolCallId || !content) {
      return null
    }

    // Provider-facing tool content may be context-projected. Do not rebuild it from metadata output here.
    return new ToolMessage({
      content,
      tool_call_id: toolCallId,
      status: toolExchangeResult?.ok === false ? 'error' : 'success',
      metadata: {
        toolName: String(toolExchangeResult?.name || '').trim() || undefined,
      },
    })
  }

  if (!toolExchangeCall) {
    return null
  }

  return new AIMessage({
    content,
    tool_calls: [{
      id: String(toolExchangeCall.id || '').trim(),
      name: String(toolExchangeCall.name || '').trim(),
      args: isPlainObject(toolExchangeCall.input)
        ? toolExchangeCall.input
        : {},
    }],
  })
}
