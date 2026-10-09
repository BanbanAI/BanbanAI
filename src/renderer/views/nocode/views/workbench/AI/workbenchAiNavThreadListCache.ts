export type WorkbenchAiThreadListSyncAction = 'skip' | 'load' | 'mark-dirty' | 'queue-reload'

export type WorkbenchAiThreadListSyncContext = {
  expanded: boolean,
  threadsExpanded: boolean,
  hasLoaded: boolean,
  loading: boolean,
  dirty: boolean,
  force?: boolean,
}

export const resolveWorkbenchAiThreadListSyncAction = ({
  expanded,
  threadsExpanded,
  hasLoaded,
  loading,
  dirty,
  force = false,
}: WorkbenchAiThreadListSyncContext): WorkbenchAiThreadListSyncAction => {
  if (loading) {
    return force ? 'queue-reload' : 'skip'
  }

  if (!expanded || !threadsExpanded) {
    return force ? 'mark-dirty' : 'skip'
  }

  if (force) {
    return 'load'
  }

  return !hasLoaded || dirty ? 'load' : 'skip'
}
