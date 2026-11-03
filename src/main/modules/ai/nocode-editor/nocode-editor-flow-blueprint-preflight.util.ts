import {
  DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET,
  createFlowBlueprintPreflightState,
  resolveFlowBlueprintPreflightAllowedToolNames,
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

const FLOW_BLUEPRINT_STRUCTURE_NODE_LIMIT = 40
const FLOW_BLUEPRINT_STRUCTURE_TRUNCATION_NOTICE =
  '（以上骨架只保留前 40 个节点，完整结构以已保存的流程方案为准。）'

// 诊断顺序由校验器决定，不保证可操作性；恢复提示应先说最该动手改的那类问题。
const FLOW_BLUEPRINT_FAILURE_CODE_PRIORITY: RegExp[] = [
  /personnel|structure|approval_owner|target_context/u,
  /branch|node_type/u,
  /enum|field|trigger_change_type|owner_type|owner_sources|notify_/u,
  /budget|limit/u,
]

const resolveFlowBlueprintFailureCode = (
  diagnostics: Array<Record<string, unknown>>,
  issues: Array<Record<string, unknown>>,
) => {
  const codes = [
    ...diagnostics.map(item => normalizeText(item.code)),
    ...issues.map(item => normalizeText(item.issueId)),
  ].filter(Boolean)
  if (!codes.length) {
    return ''
  }
  for (const priority of FLOW_BLUEPRINT_FAILURE_CODE_PRIORITY) {
    const matched = codes.find(code => priority.test(code))
    if (matched) {
      return matched
    }
  }
  return codes[0]
}

// 蓝图契约失败同样是可续跑信号：模型需要在上一次失败原因上重试，
// 而不是在下一轮把同一份错误结构再发一次。
const isRestorableBlueprintFailure = (result: Record<string, unknown>) => {
  if (normalizeText(result.error).includes('已收敛流程方案')) {
    return true
  }
  const issues = toRecord(result.metadata).flowUnifiedIssues
  return Array.isArray(issues) && issues.some(issue => (
    normalizeText(toRecord(issue).issueId) === 'flow-blueprint-contract-invalid'
  ))
}

// 只保留结构身份字段，避免把失败蓝图的完整配置塞回上下文；模型需要的是
// nodeKey/branchKey 的稳定骨架，而不是再抄一遍 options。
const buildFlowBlueprintStructureHint = (value: unknown): { hint: string; truncated: boolean } => {
  const blueprint = toRecord(value)
  const triggerBranches = Array.isArray(blueprint.triggerBranches)
    ? blueprint.triggerBranches
    : []
  if (!triggerBranches.length) {
    return { hint: '', truncated: false }
  }
  let nodeCount = 0
  let truncated = false
  const pruneNodes = (value: unknown): Array<Record<string, unknown>> => (
    (Array.isArray(value) ? value : []).flatMap((nodeValue) => {
      if (nodeCount >= FLOW_BLUEPRINT_STRUCTURE_NODE_LIMIT) {
        truncated = true
        return []
      }
      const node = toRecord(nodeValue)
      const nodeKey = normalizeText(node.nodeKey)
      const type = normalizeText(node.type)
      if (!nodeKey && !type) {
        return []
      }
      nodeCount += 1
      // 失败蓝图可能把分支写进 options：提示骨架也要能读出分支身份，
      // 否则“沿用结构”的指令会让模型继续复制错误位置。
      const nodeOptions = toRecord(node.options)
      const sourceBranches = Array.isArray(node.branches) && node.branches.length
        ? node.branches
        : Array.isArray(nodeOptions.branches)
          ? nodeOptions.branches
          : null
      const branches = sourceBranches
        ? sourceBranches.map((branchValue) => {
          const branch = toRecord(branchValue)
          return {
            branchKey: normalizeText(branch.branchKey) || undefined,
            label: normalizeText(branch.label) || undefined,
            nodes: pruneNodes(branch.nodes),
          }
        })
        : undefined
      return [{
        nodeKey: nodeKey || undefined,
        type: type || undefined,
        name: normalizeText(node.name) || undefined,
        ...(branches ? { branches } : {}),
        ...(Array.isArray(node.nodes) ? { nodes: pruneNodes(node.nodes) } : {}),
      }]
    })
  )
  const hint = JSON.stringify({
    triggerBranches: triggerBranches.map((branchValue) => {
      const branch = toRecord(branchValue)
      return {
        branchKey: normalizeText(branch.branchKey) || undefined,
        label: normalizeText(branch.label) || undefined,
        nodes: pruneNodes(branch.nodes),
      }
    }),
  })
  return { hint, truncated }
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
  const allowedToolNames = resolveFlowBlueprintPreflightAllowedToolNames(state)
  if (!allowedToolNames) {
    return actions
  }

  const allowedTools = new Set<string>(allowedToolNames)
  return actions.filter(action => allowedTools.has(String(action.name || '').trim()))
}

// 与 projection 同源：预算耗尽的工具不能再出现在模型可见的“允许动作”里。
export const buildFlowBlueprintPreflightActionGuidance = (
  state: FlowBlueprintPreflightState | null | undefined,
): string => {
  const allowedToolNames = resolveFlowBlueprintPreflightAllowedToolNames(state) || []
  const canRefreshSummary = allowedToolNames.includes('editor_get_flow_summary')
  const canFetchNodeExamples = allowedToolNames.includes('editor_get_flow_node_examples')
  if (canRefreshSummary && canFetchNodeExamples) {
    return '本轮只允许按需补一次 editor_get_flow_summary、按需补一次 editor_get_flow_node_examples，最后调用 editor_stage_flow_blueprint。'
  }
  if (canRefreshSummary) {
    return '本轮只允许按需补一次 editor_get_flow_summary，最后调用 editor_stage_flow_blueprint。'
  }
  if (canFetchNodeExamples) {
    return '本轮只允许按需补一次 editor_get_flow_node_examples，最后调用 editor_stage_flow_blueprint。'
  }
  return '流程摘要和节点示例本轮都已读取过，本轮只能调用 editor_stage_flow_blueprint。'
}

export const restoreFlowBlueprintPreflightStateFromHistory = (input: {
  messages: FlowBlueprintPreflightHistoryMessage[]
  userMessage: string
  latestTaskSummary?: Record<string, unknown> | null
  now: number
  isInternalContinuation?: boolean
}): FlowBlueprintPreflightState | null => {
  const userMessage = normalizeText(input.userMessage).toLowerCase()
  if (
    !input.isInternalContinuation
    && !FLOW_BLUEPRINT_CONTINUATION_MARKERS.some(marker => userMessage.includes(marker))
  ) {
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
  let latestConvergedBlueprintFailure: Record<string, unknown> | null = null
  for (const item of historyResults) {
    const toolName = normalizeText(item.result.name)
    if (toolName === 'editor_plan_flow_scheme') {
      latestSchemeIndex = item.index
      latestSchemeResult = item.result
    }
    if (
      toolName === 'editor_stage_flow_blueprint'
      && item.result.ok === false
      && isRestorableBlueprintFailure(item.result)
    ) {
      latestConvergedBlueprintFailureIndex = item.index
      latestConvergedBlueprintFailure = item.result
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
  if (hasConvergedBlueprintFailure && latestConvergedBlueprintFailure) {
    state = applyFlowBlueprintFailureToPreflightState(state, latestConvergedBlueprintFailure)
  }
  return state
}

// 同一轮内的失败也要回填：否则 stop decision 只能看到初始 state，
// 收口文案会退回“蓝图没有生成完成”，与已暂存的旧版本互相矛盾。
export const applyFlowBlueprintFailureToPreflightState = (
  state: FlowBlueprintPreflightState,
  failedResult: Record<string, unknown> | null | undefined,
): FlowBlueprintPreflightState => {
  if (!failedResult) {
    return state
  }
  const failedMetadata = toRecord(failedResult.metadata)
  const failedToolInput = toRecord(failedMetadata.input)
  const structure = buildFlowBlueprintStructureHint(failedToolInput.blueprint)
  const structureHint = structure.hint
    ? (structure.truncated
      ? `${structure.hint}\n${FLOW_BLUEPRINT_STRUCTURE_TRUNCATION_NOTICE}`
      : structure.hint)
    : ''
  const failureIssues = Array.isArray(failedMetadata.flowUnifiedIssues)
    ? failedMetadata.flowUnifiedIssues.map(toRecord)
    : []
  const failureDiagnostics = failureIssues.flatMap(issue => (
    Array.isArray(issue.diagnostics)
      ? (issue.diagnostics as unknown[]).map(toRecord)
      : []
  ))
  const lastFailureCode = resolveFlowBlueprintFailureCode(failureDiagnostics, failureIssues)
  return {
    ...state,
    blueprintStructureHint: structureHint || state.blueprintStructureHint,
    lastFailureCode: lastFailureCode || state.lastFailureCode,
  }
}

const buildFlowBlueprintPreflightReminderMessage = () => [
  '当前流程方案复核已经通过，preflight 所需证据也已补齐。',
  '不要回到 editor_plan_flow_scheme，也不要重复读取已存在的 flow summary / node examples。',
  '请直接调用 editor_stage_flow_blueprint，基于当前已确认方案继续生成流程蓝图。',
].join('\n')

// 恢复提示同时服务“模型怎么续跑”和回归断言：失败原因优先于结构骨架，
// 人员来源类失败不能再要求模型沿用上一份失败蓝图。
export const buildRestoredFlowBlueprintPreflightPrompt = (
  state: FlowBlueprintPreflightState,
) => [
  '上一次生成在 blueprint_preflight 阶段中断，已从持久化工具历史恢复预检进度。',
  state.nodeExampleFetchCount > 0
    ? '流程节点示例已经读取完成，不要重复读取。'
    : '已有预检证据可以复用，不要回到流程方案规划。',
  state.lastFailureCode
    ? state.lastFailureCode === 'flow_personnel_source_mismatch'
      ? '上一次蓝图失败原因：人员来源与已确认方案不一致。请逐个核对审批/办理节点的负责人来源与方案步骤一致，分支复用同一方案步骤时来源也必须一致。'
      : state.lastFailureCode === 'flow_branch_branches_in_options_unsupported'
        ? '上一次蓝图失败原因：分支节点的 branches 写进了 options，运行时读不到分支内的节点。请把 branches 移到节点级后重新提交。'
        : `上一次蓝图失败原因：${state.lastFailureCode}。`
    : null,
  state.blueprintStructureHint && state.lastFailureCode !== 'flow_personnel_source_mismatch'
    ? [
      '上一次失败蓝图的结构骨架如下。请沿用其中的 nodeKey/branchKey，不要新增或重复生成同名人员节点：',
      state.blueprintStructureHint,
    ].join('\n')
    : null,
  '请基于已确认并已保存的流程方案直接调用 editor_stage_flow_blueprint，不要重复提问或重复提交确认。',
]
  .filter((line): line is string => Boolean(line))
  .join('\n')

// 拦截文案同样会回给模型，所以和 projection 共用预算口径；未知 state 时退回不含具体工具的兜底说法。
const buildFlowBlueprintPreflightBlockError = (
  state: FlowBlueprintPreflightState | null | undefined,
) => (
  state
    ? `当前正在准备流程蓝图：${buildFlowBlueprintPreflightActionGuidance(state)}`
    : '当前正在准备流程蓝图，只允许补读流程摘要、读取节点示例或继续生成流程蓝图。'
)

export const resolveFlowBlueprintPreflightToolDecision = (input: {
  active: boolean
  toolName: string
  state?: FlowBlueprintPreflightState | null
}): FlowBlueprintPreflightToolDecision => {
  if (!input.active) {
    return { kind: 'allow' }
  }
  // 拦截白名单必须与投影/文案同源：预算耗尽的补读工具也要被拦住，
  // 否则模型会反复补读同一份证据，直到轮次超时。
  const allowedToolNames = input.state
    ? resolveFlowBlueprintPreflightAllowedToolNames(input.state)
    : null
  const allowedTools = new Set<string>(allowedToolNames || FLOW_BLUEPRINT_PREFLIGHT_ALLOWED_TOOLS)
  return allowedTools.has(String(input.toolName || '').trim())
    ? { kind: 'allow' }
    : {
      kind: 'block',
      error: buildFlowBlueprintPreflightBlockError(input.state),
    }
}

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
    assistantMessage: global.i18next.t(
      state.lastFailureCode === 'flow_personnel_source_mismatch'
        ? 'nocodeEditorChatService.flowBlueprintPreparationStoppedPersonnelMismatch'
        : 'nocodeEditorChatService.flowBlueprintPreparationStopped',
    ),
  }
}
