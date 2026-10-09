export type WorkbenchAiNavChatActionsInput = {
  threadId: string
  activeThreadId?: string
  hoveredThreadId?: string
  openedDropdownThreadId?: string
}

export const shouldRenderWorkbenchAiNavChatActions = ({
  threadId,
  activeThreadId = '',
  hoveredThreadId = '',
  openedDropdownThreadId = '',
}: WorkbenchAiNavChatActionsInput) => {
  const normalizedThreadId = String(threadId || '').trim()

  if (!normalizedThreadId) {
    return false
  }

  return normalizedThreadId === String(activeThreadId || '').trim()
    || normalizedThreadId === String(hoveredThreadId || '').trim()
    || normalizedThreadId === String(openedDropdownThreadId || '').trim()
}
