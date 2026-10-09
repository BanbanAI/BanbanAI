export const WORKBENCH_AI_NAV_COLLAPSED_WIDTH = 52
export const WORKBENCH_AI_NAV_EXPANDED_WIDTH = 256
export const WORKBENCH_AI_CHAT_WIDTH = 400

export type WorkbenchAiSidebarLayoutInput = {
  navExpanded: boolean
  chatVisible: boolean
  chatWidthPx?: number
}

export type WorkbenchAiSidebarLayout = {
  navWidthPx: number
  chatWidthPx: number
  chatOffsetPx: number
  layoutWidthPx: number
  navOverlay: boolean
}

export const resolveWorkbenchAiSidebarLayout = ({
  navExpanded,
  chatVisible,
  chatWidthPx,
}: WorkbenchAiSidebarLayoutInput): WorkbenchAiSidebarLayout => {
  const navWidthPx = navExpanded
    ? WORKBENCH_AI_NAV_EXPANDED_WIDTH
    : WORKBENCH_AI_NAV_COLLAPSED_WIDTH
  const resolvedChatWidthPx = chatVisible
    ? Math.max(0, Math.round(Number(chatWidthPx || WORKBENCH_AI_CHAT_WIDTH)))
    : 0

  return {
    navWidthPx,
    chatWidthPx: resolvedChatWidthPx,
    chatOffsetPx: navWidthPx,
    layoutWidthPx: navWidthPx + resolvedChatWidthPx,
    navOverlay: false,
  }
}
