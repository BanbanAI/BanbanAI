export const EMBEDDED_FLOATING_PANEL_PADDING = 16
export const EMBEDDED_BOARD_LEFT_PANEL_WIDTH = 260
export const EMBEDDED_BOARD_CATALOG_WIDTH = 716
export const EMBEDDED_BOARD_PROPERTY_WIDTH = 300
export const EMBEDDED_BOARD_FLOATING_PANEL_Z_INDEX = 1900

export function resolveFloatingPanelWidth(
  preferredWidth: number,
  boundsWidth: number,
  padding = EMBEDDED_FLOATING_PANEL_PADDING,
): number {
  if (!Number.isFinite(boundsWidth) || boundsWidth <= 0) {
    return preferredWidth
  }

  return Math.max(Math.min(preferredWidth, boundsWidth - padding * 2), 0)
}

export function resolveProjectFloatingPanelMetrics(
  boundsWidth: number,
  padding = EMBEDDED_FLOATING_PANEL_PADDING,
) {
  return {
    padding,
    leftPanelWidth: resolveFloatingPanelWidth(
      EMBEDDED_BOARD_LEFT_PANEL_WIDTH,
      boundsWidth,
      padding,
    ),
    catalogWidth: resolveFloatingPanelWidth(
      EMBEDDED_BOARD_CATALOG_WIDTH,
      boundsWidth,
      padding,
    ),
    propertyWidth: resolveFloatingPanelWidth(
      EMBEDDED_BOARD_PROPERTY_WIDTH,
      boundsWidth,
      padding,
    ),
  }
}
