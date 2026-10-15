export type NocodeEditorLostToolIntentRetryReason =
  | 'unverified_blueprint_update_claim'
  | 'malformed_tool_arguments'
  | 'empty_or_unparsable_round'

export const NOCODE_EDITOR_UNVERIFIED_BLUEPRINT_UPDATE_RETRY_MESSAGE =
  '上一轮声称已经更新蓝图，但本轮没有成功的 editor_stage_app_blueprint 工具结果，因此蓝图实际上没有更新。如果用户正在回答当前蓝图待确认问题，请基于当前暂存蓝图和已记录的确认结论调用 editor_stage_app_blueprint(updateMode=patch) 写回；如果仍无法执行，就明确说明尚未更新，不要声称已完成。'

// 参数畸形时只要求重发同一次调用，避免泛化指令让模型重新规划整条方案（会显著拉长这一轮）。
export const NOCODE_EDITOR_MALFORMED_TOOL_ARGUMENTS_RETRY_MESSAGE =
  '上一轮的工具调用参数不是合法 JSON，因此没有被执行。请只重新输出同一次工具调用，并确保 arguments 是严格合法的 JSON：不要改变意图，不要增删内容，不要重复准备性正文。'

export const NOCODE_EDITOR_LOST_TOOL_INTENT_RETRY_MESSAGE =
  '上一轮没有形成有效的可执行结果，可能是工具调用损坏，也可能是模型空响应。请重新输出同一意图的有效工具调用或明确答复，不要只重复准备性文案，也不要返回空内容。'

// 工具名会被拼进系统指令，只接受规范标识，避免把协议碎片等异常内容带进去。
const NOCODE_EDITOR_TOOL_NAME_PATTERN = /^[a-z0-9_]{1,64}$/i

export const resolveNocodeEditorInvalidToolCallName = (
  responseMetadata?: Record<string, any> | null,
): string => {
  const invalidToolCalls = Array.isArray(responseMetadata?.invalidToolCalls)
    ? responseMetadata.invalidToolCalls
    : []
  return String(invalidToolCalls[0]?.name || invalidToolCalls[0]?.function?.name || '').trim()
}

// 失败轮会从模型可见历史中擦除，指令不点名工具时模型只能猜工具（2026-10-13 报销单会话实证：猜错重发了读摘要，重规划时丢了条件分支题）。
export const buildNocodeEditorMalformedToolArgumentsRetryMessage = (invalidToolCallName?: string): string => {
  const toolName = String(invalidToolCallName || '').trim()
  if (!toolName || !NOCODE_EDITOR_TOOL_NAME_PATTERN.test(toolName)) {
    return NOCODE_EDITOR_MALFORMED_TOOL_ARGUMENTS_RETRY_MESSAGE
  }
  return `上一轮对 ${toolName} 的工具调用参数不是合法 JSON，因此没有被执行。请只重新输出同一次 ${toolName} 工具调用，并确保 arguments 是严格合法的 JSON：不要改变意图，不要增删内容，不要重复准备性正文。`
}

export const resolveNocodeEditorLostToolIntentRetry = (context: {
  unverifiedBlueprintUpdateClaim?: boolean
  invalidToolCallCount?: number
  toolCallRepairAttempted?: boolean
  invalidToolCallName?: string
}): { reason: NocodeEditorLostToolIntentRetryReason; message: string } => {
  if (context.unverifiedBlueprintUpdateClaim) {
    return {
      reason: 'unverified_blueprint_update_claim',
      message: NOCODE_EDITOR_UNVERIFIED_BLUEPRINT_UPDATE_RETRY_MESSAGE,
    }
  }

  const malformedToolArguments = Number(context.invalidToolCallCount || 0) > 0
    || context.toolCallRepairAttempted === true
  if (malformedToolArguments) {
    return {
      reason: 'malformed_tool_arguments',
      message: buildNocodeEditorMalformedToolArgumentsRetryMessage(context.invalidToolCallName),
    }
  }

  return {
    reason: 'empty_or_unparsable_round',
    message: NOCODE_EDITOR_LOST_TOOL_INTENT_RETRY_MESSAGE,
  }
}
