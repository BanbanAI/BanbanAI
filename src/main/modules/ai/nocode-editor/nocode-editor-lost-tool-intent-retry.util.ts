export type NocodeEditorLostToolIntentRetryReason =
  | 'unverified_blueprint_update_claim'
  | 'unrecognized_tool_name'
  | 'malformed_tool_arguments'
  | 'empty_or_unparsable_round'

export type NocodeEditorDroppedToolCall = {
  name: string
  reason: 'unknown_tool' | 'invalid_arguments'
}

export const NOCODE_EDITOR_UNVERIFIED_BLUEPRINT_UPDATE_RETRY_MESSAGE =
  '上一轮声称已经更新蓝图，但本轮没有成功的 editor_stage_app_blueprint 工具结果，因此蓝图实际上没有更新。如果用户正在回答当前蓝图待确认问题，请基于当前暂存蓝图和已记录的确认结论调用 editor_stage_app_blueprint(updateMode=patch) 写回；如果仍无法执行，就明确说明尚未更新，不要声称已完成。'

const NOCODE_EDITOR_UNVERIFIED_BLUEPRINT_CREATE_RETRY_MESSAGE =
  '上一轮声称已经更新蓝图，但本轮没有成功的 editor_stage_app_blueprint 工具结果，因此蓝图实际上没有更新。当前宿主没有暂存蓝图，请直接调用 editor_stage_app_blueprint(updateMode=replace) 提交完整蓝图快照；如果仍无法执行，就明确说明尚未更新，不要声称已完成。'

// 参数畸形时只要求重发同一次调用，避免泛化指令让模型重新规划整条方案（会显著拉长这一轮）。
export const NOCODE_EDITOR_MALFORMED_TOOL_ARGUMENTS_RETRY_MESSAGE =
  '上一轮的工具调用参数不是合法 JSON，因此没有被执行。请只重新输出同一次工具调用，并确保 arguments 是严格合法的 JSON：不要改变意图，不要增删内容，不要重复准备性正文。'

export const NOCODE_EDITOR_LOST_TOOL_INTENT_RETRY_MESSAGE =
  '上一轮没有形成有效的可执行结果，可能是工具调用损坏，也可能是模型空响应。请重新输出同一意图的有效工具调用或明确答复，不要只重复准备性文案，也不要返回空内容。'

export const NOCODE_EDITOR_UNRECOGNIZED_TOOL_NAME_RETRY_MESSAGE =
  '上一轮请求了当前不可用的工具，宿主没有执行任何操作。请重新发起同一意图的工具调用，并只使用本次请求工具定义中给出的准确工具名；不要自行拼接或改写工具名，也不要只输出准备性正文。'

export const NOCODE_EDITOR_INVALID_TOOL_ARGUMENTS_RETRY_MESSAGE =
  '上一轮的工具参数没有通过工具定义校验，因此没有被执行。请重新发起同一意图的工具调用，并严格按该工具的参数定义提供内容；不要改变意图，不要重复准备性正文。'

// 工具名会被拼进系统指令，只接受规范标识，避免把协议碎片等异常内容带进去。
const NOCODE_EDITOR_TOOL_NAME_PATTERN = /^[a-z0-9_]{1,64}$/i

const normalizeDroppedToolCalls = (value: unknown): NocodeEditorDroppedToolCall[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? item as Record<string, unknown>
        : null
      const name = String(record?.name || '').trim()
      if (!name) {
        return null
      }
      return {
        name,
        reason: String(record?.reason || '').trim() === 'unknown_tool'
          ? 'unknown_tool' as const
          : 'invalid_arguments' as const,
      }
    })
    .filter((item): item is NocodeEditorDroppedToolCall => Boolean(item))
}

const resolveSafeToolNames = (value: unknown, limit = 3): string[] => (
  (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(name => name && NOCODE_EDITOR_TOOL_NAME_PATTERN.test(name))
    .slice(0, limit)
)

export const hasNocodeEditorUnresolvedToolProtocolSignal = (input: {
  finishReason?: unknown
  droppedToolCallCount?: unknown
  unrecognizedToolCallCount?: unknown
}) => (
  Number(input.unrecognizedToolCallCount || 0) > 0
  || Number(input.droppedToolCallCount || 0) > 0
  || String(input.finishReason || '').trim().toLowerCase() === 'tool_calls'
)

export const resolveNocodeEditorDroppedToolCalls = (
  responseMetadata?: Record<string, unknown> | null,
): NocodeEditorDroppedToolCall[] => normalizeDroppedToolCalls(responseMetadata?.droppedToolCalls)

export const resolveNocodeEditorDroppedToolCallName = (
  responseMetadata?: Record<string, unknown> | null,
): string => resolveNocodeEditorDroppedToolCalls(responseMetadata)[0]?.name || ''

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

const buildNocodeEditorUnrecognizedToolNameRetryMessage = (toolNames: string[]): string => {
  const safeToolNames = resolveSafeToolNames(toolNames)
  if (!safeToolNames.length) {
    return NOCODE_EDITOR_UNRECOGNIZED_TOOL_NAME_RETRY_MESSAGE
  }
  return `上一轮请求的工具 ${safeToolNames.map(name => `"${name}"`).join('、')} 不在本次可用工具列表中，宿主没有执行任何操作。请重新发起同一意图的工具调用，并只使用本次请求工具定义中给出的准确工具名；不要自行拼接或改写工具名，也不要只输出准备性正文。`
}

// 工具被阶段投影/预算删掉后，只说“不可用”不够：模型看不到自己还能用谁，会原样再调一次。
export const buildNocodeEditorToolUnavailableRetryMessage = (input: {
  droppedToolNames?: unknown
  availableToolNames?: unknown
}): string => {
  const droppedToolNames = resolveSafeToolNames(input.droppedToolNames)
  const availableToolNames = resolveSafeToolNames(input.availableToolNames, 5)
  const droppedSentence = droppedToolNames.length
    ? `上一轮请求的工具 ${droppedToolNames.map(name => `"${name}"`).join('、')} 在本轮不可用，宿主没有执行任何操作。`
    : '上一轮没有形成可执行的工具调用。'
  const availableSentence = availableToolNames.length
    ? `本轮可用工具：${availableToolNames.map(name => `"${name}"`).join('、')}。`
    : '本轮没有可用工具。'
  return [
    droppedSentence,
    availableSentence,
    '请只使用本轮可用工具；补读后直接调用 editor_stage_flow_blueprint，不要重复调用已被移除的工具。',
  ].join('\n')
}

const buildNocodeEditorInvalidToolArgumentsRetryMessage = (toolName?: string): string => {
  const safeToolName = String(toolName || '').trim()
  if (!safeToolName || !NOCODE_EDITOR_TOOL_NAME_PATTERN.test(safeToolName)) {
    return NOCODE_EDITOR_INVALID_TOOL_ARGUMENTS_RETRY_MESSAGE
  }
  return `上一轮对 ${safeToolName} 的工具参数没有通过工具定义校验，因此没有被执行。请重新发起同一意图的 ${safeToolName} 调用，并严格按该工具的参数定义提供内容；不要改变意图，不要重复准备性正文。`
}

export const resolveNocodeEditorLostToolIntentRetry = (context: {
  unverifiedBlueprintUpdateClaim?: boolean
  hasStagedBlueprint?: boolean
  invalidToolCallCount?: number
  toolCallRepairAttempted?: boolean
  invalidToolCallName?: string
  droppedToolCalls?: NocodeEditorDroppedToolCall[]
}): { reason: NocodeEditorLostToolIntentRetryReason; message: string } => {
  if (context.unverifiedBlueprintUpdateClaim) {
    return {
      reason: 'unverified_blueprint_update_claim',
      message: context.hasStagedBlueprint === false
        ? NOCODE_EDITOR_UNVERIFIED_BLUEPRINT_CREATE_RETRY_MESSAGE
        : NOCODE_EDITOR_UNVERIFIED_BLUEPRINT_UPDATE_RETRY_MESSAGE,
    }
  }

  const droppedToolCalls = normalizeDroppedToolCalls(context.droppedToolCalls)
  const unrecognizedToolNames = droppedToolCalls
    .filter(item => item.reason === 'unknown_tool')
    .map(item => item.name)
  if (unrecognizedToolNames.length) {
    return {
      reason: 'unrecognized_tool_name',
      message: buildNocodeEditorUnrecognizedToolNameRetryMessage(unrecognizedToolNames),
    }
  }

  const invalidArgumentsToolName = droppedToolCalls
    .find(item => item.reason === 'invalid_arguments')
    ?.name
  const malformedToolArguments = Boolean(invalidArgumentsToolName)
    || Number(context.invalidToolCallCount || 0) > 0
    || context.toolCallRepairAttempted === true
  if (malformedToolArguments) {
    return {
      reason: 'malformed_tool_arguments',
      message: invalidArgumentsToolName
        ? buildNocodeEditorInvalidToolArgumentsRetryMessage(invalidArgumentsToolName)
        : buildNocodeEditorMalformedToolArgumentsRetryMessage(context.invalidToolCallName),
    }
  }

  return {
    reason: 'empty_or_unparsable_round',
    message: NOCODE_EDITOR_LOST_TOOL_INTENT_RETRY_MESSAGE,
  }
}
