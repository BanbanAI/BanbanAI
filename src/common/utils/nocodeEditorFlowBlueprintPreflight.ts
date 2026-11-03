export type FlowBlueprintPreflightPhase =
  | 'idle'
  | 'summary'
  | 'examples'
  | 'waiting_blueprint'
  | 'timed_out'

export type FlowSummarySnapshotRef = {
  planningContextKey: string
  formId: string
  sourceActionId: string
  updatedAt: number
  evidenceFingerprint: string
  hasOrganizationEvidence: boolean
  availableFormIds: string[]
  currentFlowShape: string
}

export type FlowNodeExampleCoverage = {
  planningContextKey: string
  requestedNodeTypes: string[]
  coveredNodeTypes: string[]
  missingNodeTypes: string[]
  hasConditionOperatorGuide: boolean
  updatedAt: number
}

export type FlowBlueprintPreflightState = {
  phase: FlowBlueprintPreflightPhase
  planningContextKey: string
  schemeRevision: number
  summaryRefreshCount: number
  nodeExampleFetchCount: number
  reminderCount: number
  noProgressRoundCount: number
  startedAt: number
  lastProgressAt: number
  deadlineAt: number
  summarySnapshotRef?: FlowSummarySnapshotRef | null
  nodeExampleCoverage?: FlowNodeExampleCoverage | null
  // 失败蓝图的结构骨架（nodeKey/branchKey）。自动续跑是独立回合，历史会被压缩成摘要，
  // 模型容易重新生成同名无 key 节点；恢复预检时把骨架带回去，保持结构连续。
  blueprintStructureHint?: string | null
  // 上一次蓝图失败的归类码。恢复提示要说明失败原因，避免模型沿用导致同一原因再次失败。
  lastFailureCode?: string | null
}

export const DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_TOTAL_TIMEOUT_MS = 20_000
export const DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_NO_PROGRESS_TIMEOUT_MS = 8_000
export const DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_SUMMARY_REFRESH_BUDGET = 1
export const DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_NODE_EXAMPLE_FETCH_BUDGET = 1
export const DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET = 1

const FLOW_BLUEPRINT_PREFLIGHT_PHASES = new Set<FlowBlueprintPreflightPhase>([
  'idle',
  'summary',
  'examples',
  'waiting_blueprint',
  'timed_out',
])

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNumber = (value: unknown, fallback = 0) => {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) {
    return fallback
  }
  return Math.max(0, Math.floor(normalized))
}

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map(item => normalizeText(item))
      .filter(Boolean)
    : []
)

const normalizePhase = (value: unknown, fallback: FlowBlueprintPreflightPhase) => {
  const normalized = normalizeText(value) as FlowBlueprintPreflightPhase
  return FLOW_BLUEPRINT_PREFLIGHT_PHASES.has(normalized) ? normalized : fallback
}

const normalizeSummarySnapshotRef = (value: FlowSummarySnapshotRef | null | undefined) => {
  if (!value) {
    return value === null ? null : undefined
  }

  return {
    planningContextKey: normalizeText(value.planningContextKey),
    formId: normalizeText(value.formId),
    sourceActionId: normalizeText(value.sourceActionId),
    updatedAt: normalizeNumber(value.updatedAt),
    evidenceFingerprint: normalizeText(value.evidenceFingerprint),
    hasOrganizationEvidence: value.hasOrganizationEvidence === true,
    availableFormIds: normalizeStringList(value.availableFormIds),
    currentFlowShape: normalizeText(value.currentFlowShape),
  }
}

const normalizeNodeExampleCoverage = (value: FlowNodeExampleCoverage | null | undefined) => {
  if (!value) {
    return value === null ? null : undefined
  }

  return {
    planningContextKey: normalizeText(value.planningContextKey),
    requestedNodeTypes: normalizeStringList(value.requestedNodeTypes),
    coveredNodeTypes: normalizeStringList(value.coveredNodeTypes),
    missingNodeTypes: normalizeStringList(value.missingNodeTypes),
    hasConditionOperatorGuide: value.hasConditionOperatorGuide === true,
    updatedAt: normalizeNumber(value.updatedAt),
  }
}

const normalizeBlueprintStructureHint = (value: unknown) => (
  typeof value === 'string' && value.trim() ? value.trim() : null
)

const normalizeFailureCode = (value: unknown) => normalizeText(value) || null

export const createFlowBlueprintPreflightState = (input: {
  planningContextKey: string
  schemeRevision: number
  now: number
  phase?: FlowBlueprintPreflightPhase
  summarySnapshotRef?: FlowSummarySnapshotRef | null
  nodeExampleCoverage?: FlowNodeExampleCoverage | null
}): FlowBlueprintPreflightState => {
  const now = normalizeNumber(input.now)

  return {
    phase: normalizePhase(input.phase, 'summary'),
    planningContextKey: normalizeText(input.planningContextKey),
    schemeRevision: normalizeNumber(input.schemeRevision),
    summaryRefreshCount: 0,
    nodeExampleFetchCount: 0,
    reminderCount: 0,
    noProgressRoundCount: 0,
    startedAt: now,
    lastProgressAt: now,
    deadlineAt: now + DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_TOTAL_TIMEOUT_MS,
    summarySnapshotRef: normalizeSummarySnapshotRef(input.summarySnapshotRef) ?? null,
    nodeExampleCoverage: normalizeNodeExampleCoverage(input.nodeExampleCoverage) ?? null,
    blueprintStructureHint: null,
    lastFailureCode: null,
  }
}

export const updateFlowBlueprintPreflightProgress = (
  state: FlowBlueprintPreflightState,
  input: {
    toolName: string
    now: number
    summarySnapshotRef?: FlowSummarySnapshotRef | null
    nodeExampleCoverage?: FlowNodeExampleCoverage | null
  },
): FlowBlueprintPreflightState => {
  const toolName = normalizeText(input.toolName)
  const nextSummarySnapshotRef = normalizeSummarySnapshotRef(input.summarySnapshotRef)
  const nextNodeExampleCoverage = normalizeNodeExampleCoverage(input.nodeExampleCoverage)
  const nextState: FlowBlueprintPreflightState = {
    ...state,
    phase: normalizePhase(state.phase, 'summary'),
    planningContextKey: normalizeText(state.planningContextKey),
    schemeRevision: normalizeNumber(state.schemeRevision),
    summaryRefreshCount: normalizeNumber(state.summaryRefreshCount),
    nodeExampleFetchCount: normalizeNumber(state.nodeExampleFetchCount),
    reminderCount: normalizeNumber(state.reminderCount),
    noProgressRoundCount: 0,
    startedAt: normalizeNumber(state.startedAt),
    lastProgressAt: normalizeNumber(input.now, normalizeNumber(state.lastProgressAt)),
    deadlineAt: normalizeNumber(state.deadlineAt),
    summarySnapshotRef: nextSummarySnapshotRef === undefined
      ? normalizeSummarySnapshotRef(state.summarySnapshotRef) ?? null
      : nextSummarySnapshotRef,
    nodeExampleCoverage: nextNodeExampleCoverage === undefined
      ? normalizeNodeExampleCoverage(state.nodeExampleCoverage) ?? null
      : nextNodeExampleCoverage,
    blueprintStructureHint: normalizeBlueprintStructureHint(state.blueprintStructureHint),
    lastFailureCode: normalizeFailureCode(state.lastFailureCode),
  }

  if (toolName === 'editor_get_flow_summary') {
    return {
      ...nextState,
      phase: 'waiting_blueprint',
      summaryRefreshCount: nextState.summaryRefreshCount + 1,
    }
  }

  if (toolName === 'editor_get_flow_node_examples') {
    return {
      ...nextState,
      phase: 'waiting_blueprint',
      nodeExampleFetchCount: nextState.nodeExampleFetchCount + 1,
    }
  }

  if (toolName === 'editor_stage_flow_blueprint') {
    return {
      ...nextState,
      phase: 'waiting_blueprint',
    }
  }

  return nextState
}

// 投影与提示词文案同源；各写一份会让文案继续宣传预算已耗尽的工具。null = 不在预检，不收敛。
export const resolveFlowBlueprintPreflightAllowedToolNames = (
  state: FlowBlueprintPreflightState | null | undefined,
): string[] | null => {
  if (!state) {
    return null
  }
  const names: string[] = []
  if (
    normalizeNumber(state.summaryRefreshCount)
    < DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_SUMMARY_REFRESH_BUDGET
  ) {
    names.push('editor_get_flow_summary')
  }
  if (
    normalizeNumber(state.nodeExampleFetchCount)
    < DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_NODE_EXAMPLE_FETCH_BUDGET
  ) {
    names.push('editor_get_flow_node_examples')
  }
  names.push('editor_stage_flow_blueprint')
  return names
}
