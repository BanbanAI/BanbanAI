import type { ProcessFlow } from '@common/types/project'
import type {
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueState,
} from '../../ai/types'

type IssueResolutionLevel = 'direct' | 'fallback' | 'none'

type FlowNodeSummary = {
  uid: string
  title: string
}

const normalizeText = (value: unknown) => String(value || '').trim()

const collectFlowNodeSummaries = (
  flows: ProcessFlow[] = [],
  result: FlowNodeSummary[] = [],
) => {
  flows.forEach((flow) => {
    if (!flow) {
      return
    }
    result.push({
      uid: normalizeText(flow.uid),
      title: normalizeText(flow.options?.name),
    })
    if (Array.isArray(flow.branches)) {
      flow.branches.forEach((branch) => {
        collectFlowNodeSummaries(branch?.flows || [], result)
      })
    }
  })
  return result
}

const findDirectResolvedProcessNodeId = (
  issue: NocodeEditorAiFlowActionIssue,
  currentFlows: ProcessFlow[] = [],
) => {
  const nodeIds = new Set(
    collectFlowNodeSummaries(currentFlows)
      .map(item => item.uid)
      .filter(Boolean),
  )
  const candidates = [
    normalizeText(issue.locator?.processNodeId),
    normalizeText(issue.targetId),
  ].filter(Boolean)
  return candidates.find(candidate => nodeIds.has(candidate)) || ''
}

const findFallbackResolvedProcessNodeId = (
  issue: NocodeEditorAiFlowActionIssue,
  currentFlows: ProcessFlow[] = [],
) => {
  const targetLabel = normalizeText(issue.targetLabel)
  if (!targetLabel) {
    return ''
  }
  const matchedNodes = collectFlowNodeSummaries(currentFlows)
    .filter(item => item.title === targetLabel)
  return matchedNodes.length === 1
    ? matchedNodes[0].uid
    : ''
}

const resolveIssueResolutionLevel = (
  issue: NocodeEditorAiFlowActionIssue,
  currentFlows: ProcessFlow[] = [],
): IssueResolutionLevel => {
  if (findDirectResolvedProcessNodeId(issue, currentFlows)) {
    return 'direct'
  }
  if (findFallbackResolvedProcessNodeId(issue, currentFlows)) {
    return 'fallback'
  }
  return 'none'
}

const resolveIssueStateResolutionLevel = (
  state: NocodeEditorAiFlowIssueState | null,
  currentFlows: ProcessFlow[] = [],
): IssueResolutionLevel => {
  const issues = Array.isArray(state?.actionIssues)
    ? state!.actionIssues
    : []
  if (issues.some(issue => resolveIssueResolutionLevel(issue, currentFlows) === 'direct')) {
    return 'direct'
  }
  if (issues.some(issue => resolveIssueResolutionLevel(issue, currentFlows) === 'fallback')) {
    return 'fallback'
  }
  return 'none'
}

export const resolveCurrentFlowIssueProcessNodeId = (input: {
  issue: NocodeEditorAiFlowActionIssue
  currentFlows?: ProcessFlow[]
}) => {
  return findDirectResolvedProcessNodeId(input.issue, input.currentFlows || [])
    || findFallbackResolvedProcessNodeId(input.issue, input.currentFlows || [])
}

export const resolveCanvasFlowIssueState = (input: {
  aiFlowIssueState?: NocodeEditorAiFlowIssueState | null
  runtimeFlowIssueState?: NocodeEditorAiFlowIssueState | null
  runtimeFlowIssueStateSettled?: boolean
  currentFlows?: ProcessFlow[]
}) => {
  const currentFlows = input.currentFlows || []
  const aiFlowIssueState = input.aiFlowIssueState || null
  const runtimeFlowIssueState = input.runtimeFlowIssueState || null
  if (input.runtimeFlowIssueStateSettled === true && !runtimeFlowIssueState) {
    return null
  }
  const aiResolutionLevel = resolveIssueStateResolutionLevel(aiFlowIssueState, currentFlows)
  const runtimeResolutionLevel = resolveIssueStateResolutionLevel(runtimeFlowIssueState, currentFlows)

  if (aiResolutionLevel === 'direct') {
    return aiFlowIssueState
  }
  if (runtimeResolutionLevel === 'direct') {
    return runtimeFlowIssueState
  }
  if (aiResolutionLevel === 'fallback') {
    return aiFlowIssueState
  }
  if (runtimeResolutionLevel === 'fallback') {
    return runtimeFlowIssueState
  }
  return aiFlowIssueState || runtimeFlowIssueState || null
}
