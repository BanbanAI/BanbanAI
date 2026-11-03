import { normalizeText } from './nocodeEditorFlowGroundingPresentation'

type TurnMessageLike = { role: string; content?: string; traceId?: string | null }

// role 用字面量比较：NocodeEditorAiMessageRole 只存在于渲染层 types.ts，
// src/common 不反向依赖渲染层。
const USER_ROLE = 'user'
const ASSISTANT_ROLE = 'assistant'

// 本轮 = 当前 trace 的最后一条用户消息，向前到上一条 assistant 消息为止的用户发言。
// 现有 resolveUserMessageHistoryForCurrentTurn 返回的是整段历史，不能直接当「本轮」。
export const resolveNocodeEditorAiCurrentTurnUserMessages = (
  messages: TurnMessageLike[],
  traceId?: string,
) => {
  const normalizedTraceId = normalizeText(traceId)
  let cutoffIndex = messages.length - 1
  if (normalizedTraceId) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.role === USER_ROLE && normalizeText(message.traceId) === normalizedTraceId) {
        cutoffIndex = index
        break
      }
    }
  }
  const turn: string[] = []
  for (let index = cutoffIndex; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === ASSISTANT_ROLE) break
    if (message.role !== USER_ROLE) continue
    const content = String(message.content || '').trim()
    if (content) turn.unshift(content)
  }
  return turn
}
