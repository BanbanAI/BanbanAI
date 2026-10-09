export const NOCODE_EDITOR_ROUTE_NAME = 'NocodeEditor'
export const NOCODE_VIEWER_ROUTE_NAME = 'NocodeHome'

export function isWorkbenchAiSidebarEditorRoute(routeName: unknown): boolean {
  return String(routeName || '').trim() === NOCODE_EDITOR_ROUTE_NAME
}

export function shouldCollapseWorkbenchAiNav(routeName: unknown): boolean {
  const normalizedRouteName = String(routeName || '').trim()
  return normalizedRouteName === NOCODE_EDITOR_ROUTE_NAME
    || normalizedRouteName === NOCODE_VIEWER_ROUTE_NAME
}

export function shouldCollapseWorkbenchAiSidebar(routeName: unknown): boolean {
  return isWorkbenchAiSidebarEditorRoute(routeName)
}
