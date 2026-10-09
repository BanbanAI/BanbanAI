import type { ProcessFlow } from '@common/types/project'
import type { NocodeEditorAiFlowIssueState } from '../../ai/types'
import { resolveCurrentFlowIssueProcessNodeId } from './resolveCanvasFlowIssueState'

export const buildProcessNodeIssueMap = (
  state: NocodeEditorAiFlowIssueState | null,
  currentFlows: ProcessFlow[] = [],
) => {
  const issueMap: Record<string, string[]> = {};

  (state?.actionIssues || []).forEach((issue) => {
    const processNodeId = resolveCurrentFlowIssueProcessNodeId({
      issue,
      currentFlows,
    })
    const message = String(issue.displayMessage || issue.message || '').trim()
    if (!processNodeId || !message) {
      return
    }
    issueMap[processNodeId] = [
      ...(issueMap[processNodeId] || []),
      message,
    ]
  })

  return Object.fromEntries(
    Object.entries(issueMap).map(([processNodeId, messages]) => ([
      processNodeId,
      Array.from(new Set(messages)).join('；'),
    ])),
  )
}
