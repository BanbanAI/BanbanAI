export const MAX_UNSUPPORTED_BLUEPRINT_REPAIR_ATTEMPTS = 1

export const getNocodeEditorUnsupportedBlueprintProtocolRepairFailedMessage = () => (
  global.i18next.t('nocodeEditorBlueprintAutoRepair.generationFailedAfterRetry')
)

export type UnsupportedBlueprintAutoRepairDecision =
  | { kind: 'continue' }
  | { kind: 'retry'; repairAttempts: 1; systemMessage: string }
  | {
      kind: 'fail'
      finishReason: 'unsupported_blueprint_protocol_after_repair'
      assistantMessage: string
    }

// repairAttempts is the accumulated auto-repair count across rounds.
// The remaining fields describe the current assistant round only.
// Do not fold prior-round tool-call state into the current-round fields here.
export type UnsupportedBlueprintAutoRepairRoundInput = {
  repairAttempts: number
  containsUnsupportedProtocol: boolean
  hasPendingBlueprintToolCall: boolean
  executedToolNames: string[]
}

const BLUEPRINT_TOOL_NAME = 'editor_stage_app_blueprint'

const buildUnsupportedBlueprintRepairSystemMessage = () => [
  '保留同一用户意图，不要改写任务目标，也不要新增无关解释。',
  `立刻改为调用 ${BLUEPRINT_TOOL_NAME} 返回本轮蓝图结果。`,
  '禁止再次输出 banban-app-builder-blueprint 协议块、禁止输出 raw blueprint JSON。',
  '不要只回复解释性自然语言；请直接产出合法工具调用。',
].join('\n')

export const resolveUnsupportedBlueprintAutoRepairDecision = (
  input: UnsupportedBlueprintAutoRepairRoundInput,
): UnsupportedBlueprintAutoRepairDecision => {
  const executedToolNames = Array.isArray(input.executedToolNames)
    ? input.executedToolNames.map(name => String(name || '').trim())
    : []

  const hasExecutedBlueprintTool = executedToolNames.includes(BLUEPRINT_TOOL_NAME)
  const hasValidBlueprintToolRound = Boolean(input.hasPendingBlueprintToolCall)
    || hasExecutedBlueprintTool

  if (!input.containsUnsupportedProtocol || hasValidBlueprintToolRound) {
    return { kind: 'continue' }
  }

  if (input.repairAttempts >= MAX_UNSUPPORTED_BLUEPRINT_REPAIR_ATTEMPTS) {
    return {
      kind: 'fail',
      finishReason: 'unsupported_blueprint_protocol_after_repair',
      assistantMessage: getNocodeEditorUnsupportedBlueprintProtocolRepairFailedMessage(),
    }
  }

  return {
    kind: 'retry',
    repairAttempts: 1,
    systemMessage: buildUnsupportedBlueprintRepairSystemMessage(),
  }
}
