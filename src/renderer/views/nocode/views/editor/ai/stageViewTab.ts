export type NocodeEditorStageViewTab = 'frame' | 'blueprint'

export const resolveNocodeEditorStageViewTab = (payload: {
  currentTab: NocodeEditorStageViewTab
  hasSolutionOutline: boolean
  hasBlueprint: boolean
  frameLoading?: boolean
  blueprintLoading?: boolean
}): NocodeEditorStageViewTab => {
  if (payload.blueprintLoading && !payload.frameLoading) {
    return 'blueprint'
  }

  // The frame stage is currently hidden in the app shell, so keep planning and
  // empty blueprint states on the blueprint workbench instead of routing them
  // into a non-rendered frame layer.
  if (!payload.hasBlueprint) {
    return 'blueprint'
  }

  if (payload.currentTab === 'frame' && !payload.hasSolutionOutline && payload.hasBlueprint) {
    return 'blueprint'
  }

  if (payload.currentTab === 'blueprint' && !payload.hasBlueprint && payload.hasSolutionOutline) {
    return 'frame'
  }

  return payload.currentTab
}
