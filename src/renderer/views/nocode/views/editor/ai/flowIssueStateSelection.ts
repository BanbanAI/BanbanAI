import type {
  NocodeEditorAiFlowIssueState,
  NocodeEditorAiMessage,
} from './types'

type ResolveMessageFlowIssueState = (
  message: NocodeEditorAiMessage,
) => NocodeEditorAiFlowIssueState | null | undefined

const resolveDefaultMessageFlowIssueState: ResolveMessageFlowIssueState = (message) => {
  const state = message.metadata?.flowIssueActionList as NocodeEditorAiFlowIssueState | null | undefined
  if (!state || state.mode !== 'flow_issue') {
    return null
  }
  return Array.isArray(state.actionIssues) && state.actionIssues.length > 0
    ? state
    : null
}

export const resolveActiveFlowIssueState = (
  messages: NocodeEditorAiMessage[],
  resolveMessageState: ResolveMessageFlowIssueState = resolveDefaultMessageFlowIssueState,
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const state = resolveMessageState(messages[index])
    if (state) {
      return state
    }
  }
  return null
}
