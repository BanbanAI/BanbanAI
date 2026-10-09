import {
  DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET,
  createFlowBlueprintPreflightState,
  updateFlowBlueprintPreflightProgress,
  type FlowBlueprintPreflightState,
} from '@common/utils/nocodeEditorFlowBlueprintPreflight'

export type FlowBlueprintPreflightStopDecision =
  | { kind: 'continue' }
  | {
      kind: 'remind'
      nextState: FlowBlueprintPreflightState
      systemMessage: string
    }
  | {
      kind: 'finish'
      finishReason: 'blueprint_preflight_no_progress'
      assistantMessage: string
    }

export type FlowBlueprintPreflightToolDecision =
  | { kind: 'allow' }
  | { kind: 'block'; error: string }

const FLOW_BLUEPRINT_PREFLIGHT_ALLOWED_TOOLS = new Set([
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_stage_flow_blueprint',
])

const FLOW_BLUEPRINT_PREFLIGHT_FINAL_TOOLS = new Set([
  'editor_stage_flow_blueprint',
])

const FLOW_BLUEPRINT_CONTINUATION_MARKERS = [
  '继续生成',
  '继续创建流程',
  '继续生成流程',
  'continue generating',
]

type FlowBlueprintPreflightHistoryMessage = {
  metadata?: Record<string, unknown> | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const toRecord = (value: unknown) => isRecord(value) ? value : {}

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeNumber = (value: unknown, fallback = 0) => {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) {
    return fallback
  }
  return Math.max(0, Math.floor(normalized))
}

const restoreFlowBlueprintPreflightCheckpoint = (input: {
  latestTaskSummary?: Record<string, unknown> | null
  now: number
}) => {
  const summary = toRecord(input.latestTaskSummary)
  const nodeExampleFetchCount = normalizeNumber(
    summary.flowBlueprintPreflightNodeExampleFetchCount,
  )
  if (
    summary.flowBlueprintPreflightActive !== true
    || normalizeText(summary.flowBlueprintPreflightPhase) !== 'waiting_blueprint'
    || nodeExampleFetchCount < 1
  ) {
    return null
  }

  const state = createFlowBlueprintPreflightState({
    planningContextKey: normalizeText(summary.flowConfirmationContextKey),
    schemeRevision: normalizeNumber(summary.flowBlueprintPreflightSchemeRevision),
    now: input.now,
    phase: 'waiting_blueprint',
  })
  return {
    ...state,
    summaryRefreshCount: normalizeNumber(
      summary.flowBlueprintPreflightSummaryRefreshCount,
    ),
    nodeExampleFetchCount,
    lastProgressAt: normalizeNumber(
      summary.flowBlueprintPreflightUpdatedAt,
      input.now,
    ),
  }
}

export const projectFlowBlueprintPreflightActions = <T extends { name: string }>(
  actions: T[],
  state: FlowBlueprintPreflightState | null | undefined,
) => {
  if (!state) {
    return actions
  }

  const allowedTools = normalizeNumber(state.nodeExampleFetchCount) > 0
    ? FLOW_BLUEPRINT_PREFLIGHT_FINAL_TOOLS
    : FLOW_BLUEPRINT_PREFLIGHT_ALLOWED_TOOLS
  return actions.filter(action => allowedTools.has(String(action.name || '').trim()))
}

export const restoreFlowBlueprintPreflightStateFromHistory = (input: {
  messages: FlowBlueprintPreflightHistoryMessage[]
  userMessage: string
  latestTaskSummary?: Record<string, unknown> | null
  now: number
}): FlowBlueprintPreflightState | null => {
  const userMessage = normalizeText(input.userMessage).toLowerCase()
  if (!FLOW_BLUEPRINT_CONTINUATION_MARKERS.some(marker => userMessage.includes(marker))) {
    return null
  }
  const checkpointState = restoreFlowBlueprintPreflightCheckpoint({
    latestTaskSummary: input.latestTaskSummary,
    now: input.now,
  })

  const historyResults = (Array.isArray(input.messages) ? input.messages : [])
    .map((message, index) => ({
      index,
      result: toRecord(toRecord(message?.metadata).modelToolExchangeResult),
    }))
    .filter(item => normalizeText(item.result.name))

  let latestSchemeIndex = -1
  let latestSchemeResult: Record<string, unknown> | null = null
  let latestConvergedBlueprintFailureIndex = -1
  for (const item of historyResults) {
    const toolName = normalizeText(item.result.name)
    if (toolName === 'editor_plan_flow_scheme') {
      latestSchemeIndex = item.index
      latestSchemeResult = item.result
    }
    if (
      toolName === 'editor_stage_flow_blueprint'
      && item.result.ok === false
      && normalizeText(item.result.error).includes('已收敛流程方案')
    ) {
      latestConvergedBlueprintFailureIndex = item.index
    }
  }

  if (latestSchemeIndex < 0 || !latestSchemeResult) {
    if (latestConvergedBlueprintFailureIndex < 0) {
      return checkpointState
    }
    const hasLaterSuccessfulFlowResult = historyResults.some(item => (
      item.index > latestConvergedBlueprintFailureIndex
      && item.result.ok === true
      && [
        'editor_stage_flow_blueprint',
        'editor_apply_staged_flow',
      ].includes(normalizeText(item.result.name))
    ))
    if (hasLaterSuccessfulFlowResult) {
      return null
    }
    return updateFlowBlueprintPreflightProgress(
      createFlowBlueprintPreflightState({
        planningContextKey: normalizeText(toRecord(input.latestTaskSummary).flowConfirmationContextKey),
        schemeRevision: 0,
        now: input.now,
        phase: 'waiting_blueprint',
      }),
      {
        toolName: 'editor_get_flow_node_examples',
        now: input.now,
      },
    )
  }

  {
    const output = toRecord(latestSchemeResult.output)
    const scheme = toRecord(output.scheme)
    const confirmation = toRecord(scheme.confirmation)
    const routing = toRecord(output.flowIssueRouting)
    const openQuestions = Array.isArray(scheme.openQuestions)
      ? scheme.openQuestions.filter(question => normalizeText(question))
      : []
    const isAutoContinuedReadyForReview = (
      normalizeText(output.planningStatus) === 'ready_for_review'
      && normalizeText(routing.outcome) === 'auto_continue'
    )
    const isCompleted = latestSchemeResult.ok === true
      && openQuestions.length === 0
      && (
        normalizeText(confirmation.status) === 'completed'
        || isAutoContinuedReadyForReview
      )
    if (!isCompleted) {
      return null
    }
  }

  const laterResults = historyResults.filter(item => item.index > latestSchemeIndex)
  if (laterResults.some(item => [
    'editor_stage_flow_blueprint',
    'editor_apply_staged_flow',
  ].includes(normalizeText(item.result.name)) && item.result.ok === true)) {
    return null
  }

  const preflightEvidence = laterResults.filter(item => [
    'editor_get_flow_summary',
    'editor_get_flow_node_examples',
  ].includes(normalizeText(item.result.name)) && item.result.ok === true)
  const hasConvergedBlueprintFailure = (
    latestConvergedBlueprintFailureIndex > latestSchemeIndex
  )
  if (!preflightEvidence.length && !hasConvergedBlueprintFailure) {
    return checkpointState
  }

  const schemeOutput = toRecord(latestSchemeResult.output)
  const scheme = toRecord(schemeOutput.scheme)
  const confirmation = toRecord(scheme.confirmation)
  const latestTaskSummary = toRecord(input.latestTaskSummary)
  let state = createFlowBlueprintPreflightState({
    planningContextKey: normalizeText(
      schemeOutput.planningContextKey
      || confirmation.planningContextKey
      || latestTaskSummary.flowConfirmationContextKey,
    ),
    schemeRevision: Number(schemeOutput.revision || 0),
    now: input.now,
    phase: 'summary',
  })

  for (const item of preflightEvidence) {
    state = updateFlowBlueprintPreflightProgress(state, {
      toolName: normalizeText(item.result.name),
      now: input.now,
    })
  }
  if (hasConvergedBlueprintFailure && state.nodeExampleFetchCount === 0) {
    state = updateFlowBlueprintPreflightProgress(state, {
      toolName: 'editor_get_flow_node_examples',
      now: input.now,
    })
  }
  return state
}

const buildFlowBlueprintPreflightReminderMessage = () => [
  '当前流程方案复核已经通过，preflight 所需证据也已补齐。',
  '不要回到 editor_plan_flow_scheme，也不要重复读取已存在的 flow summary / node examples。',
  '请直接调用 editor_stage_flow_blueprint，基于当前已确认方案继续生成流程蓝图。',
].join('\n')

export const resolveFlowBlueprintPreflightToolDecision = (input: {
  active: boolean
  toolName: string
}): FlowBlueprintPreflightToolDecision => (
  !input.active || FLOW_BLUEPRINT_PREFLIGHT_ALLOWED_TOOLS.has(String(input.toolName || '').trim())
    ? { kind: 'allow' }
    : {
      kind: 'block',
      error: '当前正在准备流程蓝图，只允许补读流程摘要、读取节点示例或继续生成流程蓝图。',
    }
)

export const resolveFlowBlueprintPreflightStopDecision = (input: {
  state: FlowBlueprintPreflightState | null | undefined
  now: number
  hasSuccessfulBlueprintCall: boolean
  madeProgressThisRound?: boolean
}): FlowBlueprintPreflightStopDecision => {
  const state = input.state
  if (!state || input.hasSuccessfulBlueprintCall || input.madeProgressThisRound) {
    return { kind: 'continue' }
  }

  const noProgressRoundCount = normalizeNumber(state.noProgressRoundCount) + 1

  if (
    normalizeNumber(state.reminderCount) < DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET
  ) {
    return {
      kind: 'remind',
      nextState: {
        ...state,
        reminderCount: normalizeNumber(state.reminderCount) + 1,
        noProgressRoundCount,
      },
      systemMessage: buildFlowBlueprintPreflightReminderMessage(),
    }
  }

  return {
    kind: 'finish',
    finishReason: 'blueprint_preflight_no_progress',
    assistantMessage: '流程蓝图准备未继续推进，请重新继续。',
  }
}
