export interface FloatingPanelPosition {
  x: number
  y: number
}

export interface FloatingPanelSize {
  width: number
  height: number
}

export interface FloatingPanelBounds {
  width: number
  height: number
}

export interface FloatingPanelInsets {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export type FloatingPanelPadding = number | FloatingPanelInsets

export interface ResolveFieldCatalogDragPositionInput {
  startPointer: FloatingPanelPosition
  currentPointer: FloatingPanelPosition
  startPosition: FloatingPanelPosition
  panelSize: FloatingPanelSize
  bounds: FloatingPanelBounds
  padding?: FloatingPanelPadding
  insets?: FloatingPanelInsets
}

export const DEFAULT_FLOATING_PANEL_PADDING = 16
export const DEFAULT_FIELD_CATALOG_POSITION: FloatingPanelPosition = {
  x: 0,
  y: 0,
}
export const FORM_PROPERTY_PANEL_WIDTH = 300
export const DEFAULT_FIELD_CATALOG_WIDTH = 278

export function resolveFieldCatalogCollisionInsets(
  propertyPanelVisible: boolean,
  fieldCatalogPosition?: FloatingPanelPosition,
  propertyPanelPosition?: FloatingPanelPosition,
  boundsWidth?: number,
  fieldCatalogWidth: number = DEFAULT_FIELD_CATALOG_WIDTH,
  propertyPanelWidth = FORM_PROPERTY_PANEL_WIDTH,
): FloatingPanelInsets {
  if (!propertyPanelVisible) {
    return {
      left: 0,
      right: 0,
    }
  }

  if (!fieldCatalogPosition || !propertyPanelPosition || !boundsWidth) {
    return {
      left: 0,
      right: propertyPanelWidth,
    }
  }

  const fieldCenter = fieldCatalogPosition.x + (fieldCatalogWidth / 2)
  const propertyLeft = propertyPanelPosition.x
  const propertyRight = propertyLeft + propertyPanelWidth
  const propertyCenter = propertyLeft + (propertyPanelWidth / 2)
  const requiredHorizontalSpace = fieldCatalogWidth + DEFAULT_FLOATING_PANEL_PADDING
  const canFitOnLeft = propertyLeft >= requiredHorizontalSpace
  const canFitOnRight = (boundsWidth - propertyRight) >= requiredHorizontalSpace

  const resolveLeftSideInsets = () => ({
    left: 0,
    right: Math.max(boundsWidth - propertyLeft, 0),
  })

  const resolveRightSideInsets = () => ({
    left: propertyRight,
    right: 0,
  })

  if (fieldCenter >= propertyCenter) {
    if (canFitOnRight) {
      return resolveRightSideInsets()
    }
    if (canFitOnLeft) {
      return resolveLeftSideInsets()
    }
    return {
      left: 0,
      right: 0,
    }
  }

  if (canFitOnLeft) {
    return resolveLeftSideInsets()
  }
  if (canFitOnRight) {
    return resolveRightSideInsets()
  }
  return {
    left: 0,
    right: 0,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeInsets(insets?: FloatingPanelInsets): Required<FloatingPanelInsets> {
  return {
    top: insets?.top ?? 0,
    right: insets?.right ?? 0,
    bottom: insets?.bottom ?? 0,
    left: insets?.left ?? 0,
  }
}

function normalizePadding(padding: FloatingPanelPadding = DEFAULT_FLOATING_PANEL_PADDING): Required<FloatingPanelInsets> {
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    }
  }

  return {
    top: padding.top ?? DEFAULT_FLOATING_PANEL_PADDING,
    right: padding.right ?? DEFAULT_FLOATING_PANEL_PADDING,
    bottom: padding.bottom ?? DEFAULT_FLOATING_PANEL_PADDING,
    left: padding.left ?? DEFAULT_FLOATING_PANEL_PADDING,
  }
}

export function clampFloatingPanelPosition(
  position: FloatingPanelPosition,
  panelSize: FloatingPanelSize,
  bounds: FloatingPanelBounds,
  padding: FloatingPanelPadding = DEFAULT_FLOATING_PANEL_PADDING,
  insets?: FloatingPanelInsets,
): FloatingPanelPosition {
  const resolvedInsets = normalizeInsets(insets)
  const resolvedPadding = normalizePadding(padding)
  const minX = resolvedPadding.left + resolvedInsets.left
  const minY = resolvedPadding.top + resolvedInsets.top
  const maxX = Math.max(minX, bounds.width - panelSize.width - resolvedPadding.right - resolvedInsets.right)
  const maxY = Math.max(minY, bounds.height - panelSize.height - resolvedPadding.bottom - resolvedInsets.bottom)

  return {
    x: clamp(position.x, minX, maxX),
    y: clamp(position.y, minY, maxY),
  }
}

export function resolveFieldCatalogDragPosition(
  input: ResolveFieldCatalogDragPositionInput,
): FloatingPanelPosition {
  const deltaX = input.currentPointer.x - input.startPointer.x
  const deltaY = input.currentPointer.y - input.startPointer.y

  return clampFloatingPanelPosition(
    {
      x: input.startPosition.x + deltaX,
      y: input.startPosition.y + deltaY,
    },
    input.panelSize,
    input.bounds,
    input.padding,
    input.insets,
  )
}
