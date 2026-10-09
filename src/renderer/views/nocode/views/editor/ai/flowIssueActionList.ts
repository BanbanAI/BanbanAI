import type {
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueState,
} from './types'
import i18next from 'i18next'

export type NocodeEditorAiFlowActionIssueGroup = {
  key: string
  label: string
  issues: Array<NocodeEditorAiFlowActionIssue & {
    mergedMessages: string[]
    mergedFieldLabels: string[]
  }>
}

const dedupeStrings = (
  values: string[],
) => Array.from(new Set(values.map(item => String(item || '').trim()).filter(Boolean)))

const getEnglishIssueMessage = (
  issue: NocodeEditorAiFlowActionIssue,
) => {
  switch (issue.code) {
    case 'approval_approver_missing':
      return i18next.t('flowIssueActionList.approverMissing')
    case 'approval_same_as_submitter_missing':
      return i18next.t('flowIssueActionList.sameAsSubmitterMissing')
    case 'notify_notifier_missing':
      return i18next.t('flowIssueActionList.notifierMissing')
    default:
      return ''
  }
}

const buildFlowIssueDisplayMessage = (
  issue: NocodeEditorAiFlowActionIssue,
) => {
  if (/^en(?:-|$)/i.test(i18next.resolvedLanguage || i18next.language || '')) {
    const englishMessage = getEnglishIssueMessage(issue)
    if (englishMessage) {
      return englishMessage
    }
  }
  const displayMessage = String(issue.displayMessage || '').trim()
  if (displayMessage) {
    return displayMessage
  }
  const fieldLabel = String(issue.fieldLabel || '').trim()
  if (fieldLabel) {
    return i18next.t('flowIssueActionList.fieldConfigIncomplete', { field: fieldLabel })
  }
  return String(issue.message || '').trim() || i18next.t('flowIssueActionList.configIncomplete')
}

export const resolveFlowActionIssueFormId = (
  issue: NocodeEditorAiFlowActionIssue,
) => String(issue?.locator?.formId || '').trim()

export const resolveResolvedFlowActionFormIds = (
  state?: NocodeEditorAiFlowIssueState | null,
) => dedupeStrings((state?.resolvedFormIds || []).map(item => String(item || '').trim()))

// 已补齐的表单不再提示：保留仍未补齐的部分，全部补齐时列表自然为空
export const resolveFlowActionIssueListByResolvedFormIds = (
  state: NocodeEditorAiFlowIssueState,
  resolvedFormIds: string[],
) => {
  const resolvedFormIdSet = new Set(dedupeStrings(resolvedFormIds))
  const actionIssues = (state.actionIssues || []).filter(issue => (
    !resolvedFormIdSet.has(resolveFlowActionIssueFormId(issue))
  ))
  const mergedResolvedFormIds = dedupeStrings([
    ...resolveResolvedFlowActionFormIds(state),
    ...resolvedFormIdSet,
  ])
  if (actionIssues.length === (state.actionIssues || []).length) {
    return mergedResolvedFormIds.length === resolveResolvedFlowActionFormIds(state).length
      ? state
      : { ...state, resolvedFormIds: mergedResolvedFormIds }
  }
  const issueNodeCount = new Set(
    actionIssues.map(issue => String(issue.targetId || issue.targetLabel || '').trim()).filter(Boolean),
  ).size
  return {
    ...state,
    issueCount: issueNodeCount,
    summary: actionIssues.length ? '' : state.summary,
    actionIssues,
    updatedAt: Date.now(),
    resolvedAt: actionIssues.length ? state.resolvedAt : (state.resolvedAt || Date.now()),
    resolvedFormIds: mergedResolvedFormIds,
  }
}

export const groupFlowActionIssues = (
  issues: NocodeEditorAiFlowActionIssue[],
) : NocodeEditorAiFlowActionIssueGroup[] => {
  if (!issues.length) {
    return []
  }

  const mergedByNode = new Map<string, NocodeEditorAiFlowActionIssueGroup['issues'][number]>()
  issues.forEach((issue) => {
    const nodeKey = `${String(issue.targetId || '').trim()}::${String(issue.groupKey || 'process_node').trim()}`
    const existing = mergedByNode.get(nodeKey)
    const mergedMessages = [buildFlowIssueDisplayMessage(issue)]
    const mergedFieldLabels = dedupeStrings([String(issue.fieldLabel || '').trim()])
    if (!existing) {
      mergedByNode.set(nodeKey, {
        ...issue,
        displayMessage: '',
        mergedMessages,
        mergedFieldLabels,
      })
      return
    }

    existing.mergedMessages = dedupeStrings([
      ...existing.mergedMessages,
      ...mergedMessages,
    ])
    existing.mergedFieldLabels = dedupeStrings([
      ...existing.mergedFieldLabels,
      ...mergedFieldLabels,
    ])
  })

  return [{
    key: 'process_node',
    label: i18next.t('flowIssueActionList.workflowNode'),
    issues: Array.from(mergedByNode.values()),
  }]
}
