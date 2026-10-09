import { reactive } from 'vue'
import { formDesignerPanelStateStore } from '@renderer/utils/storage'

export type EditorPanelKey = 'boardCatalog' | 'boardDataLayer' | 'boardProperty' | 'formCatalog' | 'formProperty'

export interface EditorPanelPosition {
  x: number
  y: number
}

export interface EditorPanelSize {
  width: number
  height: number
}

export interface EditorPanelBounds {
  width: number
  height: number
}

export interface EditorPanelLayout {
  pinned: boolean
  floatingPosition?: EditorPanelPosition
}

export type BoardDataLayerPanel = 'data' | 'layer' | null

const storedFormDesignerPanelState = formDesignerPanelStateStore.get()

export const formDesignerPanelState = reactive({
  fieldCatalogVisible: storedFormDesignerPanelState?.fieldCatalogVisible === true,
  propertyPanelVisible: storedFormDesignerPanelState?.propertyPanelVisible === true,
})

export const boardPanelState = reactive({
  dataLayerPanel: (
    storedFormDesignerPanelState?.boardDataLayerPanel === 'data'
    || storedFormDesignerPanelState?.boardDataLayerPanel === 'layer'
      ? storedFormDesignerPanelState.boardDataLayerPanel
      : null
  ) as BoardDataLayerPanel,
  propertyPanelVisible: storedFormDesignerPanelState?.boardPropertyVisible === true,
})

export const editorPanelLayouts = reactive<Record<EditorPanelKey, EditorPanelLayout>>({
  boardCatalog: { pinned: false },
  boardDataLayer: { pinned: storedFormDesignerPanelState?.boardDataLayerPinned === true },
  boardProperty: { pinned: storedFormDesignerPanelState?.boardPropertyPinned === true },
  formCatalog: { pinned: storedFormDesignerPanelState?.formCatalogPinned === true },
  formProperty: { pinned: storedFormDesignerPanelState?.formPropertyPinned === true },
})

function persistFormDesignerPanelState(): void {
  formDesignerPanelStateStore.set({
    fieldCatalogVisible: formDesignerPanelState.fieldCatalogVisible,
    propertyPanelVisible: formDesignerPanelState.propertyPanelVisible,
    formCatalogPinned: editorPanelLayouts.formCatalog.pinned,
    formPropertyPinned: editorPanelLayouts.formProperty.pinned,
    boardDataLayerPanel: boardPanelState.dataLayerPanel,
    boardPropertyVisible: boardPanelState.propertyPanelVisible,
    boardDataLayerPinned: editorPanelLayouts.boardDataLayer.pinned,
    boardPropertyPinned: editorPanelLayouts.boardProperty.pinned,
  })
}

export function setFormDesignerPanelVisible(
  panel: 'fieldCatalog' | 'propertyPanel',
  visible: boolean,
): void {
  if (panel === 'fieldCatalog') {
    formDesignerPanelState.fieldCatalogVisible = visible
  } else {
    formDesignerPanelState.propertyPanelVisible = visible
  }
  persistFormDesignerPanelState()
}

export function setBoardDataLayerPanel(panel: BoardDataLayerPanel): void {
  if (boardPanelState.dataLayerPanel === panel) return
  boardPanelState.dataLayerPanel = panel
  persistFormDesignerPanelState()
}

export function setBoardPropertyPanelVisible(visible: boolean): void {
  if (boardPanelState.propertyPanelVisible === visible) return
  boardPanelState.propertyPanelVisible = visible
  persistFormDesignerPanelState()
}

function isRightPanel(panelKey: EditorPanelKey): boolean {
  return panelKey === 'boardProperty' || panelKey === 'formProperty'
}

export function getEditorPanelLayout(panelKey: EditorPanelKey): EditorPanelLayout {
  const layout = editorPanelLayouts[panelKey]
  return {
    pinned: layout.pinned,
    floatingPosition: layout.floatingPosition && { ...layout.floatingPosition },
  }
}

export function updateEditorPanelFloatingPosition(
  panelKey: EditorPanelKey,
  position: EditorPanelPosition,
): void {
  editorPanelLayouts[panelKey].floatingPosition = { ...position }
}

export function setEditorPanelPinned(
  panelKey: EditorPanelKey,
  pinned: boolean,
  currentPosition?: EditorPanelPosition,
): void {
  if (pinned && !editorPanelLayouts[panelKey].pinned && currentPosition) {
    updateEditorPanelFloatingPosition(panelKey, currentPosition)
  }
  editorPanelLayouts[panelKey].pinned = pinned
  if (panelKey !== 'boardCatalog') {
    persistFormDesignerPanelState()
  }
}

export function resolveEditorPanelPosition(
  panelKey: EditorPanelKey,
  panelSize: EditorPanelSize,
  bounds: EditorPanelBounds,
  defaultPosition: EditorPanelPosition,
): EditorPanelPosition {
  const layout = editorPanelLayouts[panelKey]
  if (layout.pinned) {
    return {
      x: isRightPanel(panelKey) ? Math.max(bounds.width - panelSize.width, 0) : 0,
      y: 0,
    }
  }

  return layout.floatingPosition ? { ...layout.floatingPosition } : { ...defaultPosition }
}

export function resetEditorPanelPinning(): void {
  for (const panelKey of Object.keys(editorPanelLayouts) as EditorPanelKey[]) {
    editorPanelLayouts[panelKey] = { pinned: false }
  }
  persistFormDesignerPanelState()
}
