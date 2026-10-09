import {
  WORKBENCH_AI_NAV_COLLAPSED_WIDTH,
  WORKBENCH_AI_NAV_EXPANDED_WIDTH,
} from './workbenchAiSidebarLayout'

export const WORKBENCH_AI_CHAT_MIN_WIDTH = 400
export const WORKBENCH_AI_CHAT_PREFERRED_MAX_WIDTH = 960
export const WORKBENCH_AI_PAGE_MIN_WIDTH = 1040
export const WORKBENCH_AI_LAYOUT_GAP_PX = 0
export const WORKBENCH_AI_SIDEBAR_WIDTH_STORAGE_KEY = 'WORKBENCH_AI_SIDEBAR_WIDTH'

export type WorkbenchAiSidebarWidthStorageState = {
  preferredWidthPx?: number
  widthPx?: number
}

export type WorkbenchAiSidebarResizeBounds = {
  minWidthPx: number
  maxWidthPx: number
  requiresNavCollapseBeforeGrow: boolean
}

export const resolveWorkbenchAiSidebarResizeBounds = ({
  viewportWidthPx,
  navExpanded,
  pageMinWidthPx = WORKBENCH_AI_PAGE_MIN_WIDTH,
}: {
  viewportWidthPx: number
  navExpanded: boolean
  pageMinWidthPx?: number
}): WorkbenchAiSidebarResizeBounds => {
  const navWidthPx = navExpanded
    ? WORKBENCH_AI_NAV_EXPANDED_WIDTH
    : WORKBENCH_AI_NAV_COLLAPSED_WIDTH
  const rawMaxWidthPx = Math.floor(
    viewportWidthPx - pageMinWidthPx - navWidthPx - WORKBENCH_AI_LAYOUT_GAP_PX,
  )
  const maxWidthPx = Math.max(
    WORKBENCH_AI_CHAT_MIN_WIDTH,
    Math.min(WORKBENCH_AI_CHAT_PREFERRED_MAX_WIDTH, rawMaxWidthPx),
  )

  return {
    minWidthPx: WORKBENCH_AI_CHAT_MIN_WIDTH,
    maxWidthPx,
    requiresNavCollapseBeforeGrow: navExpanded && rawMaxWidthPx < WORKBENCH_AI_CHAT_PREFERRED_MAX_WIDTH,
  }
}

export const clampWorkbenchAiSidebarChatWidth = (
  widthPx: number,
  bounds: Pick<WorkbenchAiSidebarResizeBounds, 'minWidthPx' | 'maxWidthPx'>,
) => {
  const normalizedWidthPx = Math.round(Number(widthPx || 0))
  return Math.min(
    Math.max(normalizedWidthPx, bounds.minWidthPx),
    bounds.maxWidthPx,
  )
}

export const normalizeWorkbenchAiSidebarPreferredWidth = (widthPx: number) => clampWorkbenchAiSidebarChatWidth(
  widthPx,
  {
    minWidthPx: WORKBENCH_AI_CHAT_MIN_WIDTH,
    maxWidthPx: WORKBENCH_AI_CHAT_PREFERRED_MAX_WIDTH,
  },
)

export const resolvePersistedWorkbenchAiSidebarPreferredWidth = (
  persistedState?: Partial<WorkbenchAiSidebarWidthStorageState> | number | null,
) => {
  if (typeof persistedState === 'number') {
    return normalizeWorkbenchAiSidebarPreferredWidth(persistedState)
  }

  if (typeof persistedState?.preferredWidthPx === 'number') {
    return normalizeWorkbenchAiSidebarPreferredWidth(persistedState.preferredWidthPx)
  }

  if (typeof persistedState?.widthPx === 'number') {
    return normalizeWorkbenchAiSidebarPreferredWidth(persistedState.widthPx)
  }

  return WORKBENCH_AI_CHAT_MIN_WIDTH
}

export const createWorkbenchAiSidebarWidthStorageState = (
  preferredWidthPx: number,
): WorkbenchAiSidebarWidthStorageState => ({
  preferredWidthPx: normalizeWorkbenchAiSidebarPreferredWidth(preferredWidthPx),
})
