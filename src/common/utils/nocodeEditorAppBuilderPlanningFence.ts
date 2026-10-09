const APP_BUILDER_PLANNING_FENCE_START = '```banban-app-builder-plan'
const FENCE_MARKER = '```'

type NocodeEditorAppBuilderPlanningFenceState = {
  visibleContent: string
  pendingHiddenContent: string
}

const findPlanningFenceLeadIndex = (value: string, fromIndex: number) => {
  let searchIndex = fromIndex

  while (searchIndex < value.length) {
    const fenceMarkerIndex = value.indexOf(FENCE_MARKER, searchIndex)
    if (fenceMarkerIndex === -1) {
      return -1
    }

    const candidate = value.slice(
      fenceMarkerIndex,
      Math.min(value.length, fenceMarkerIndex + APP_BUILDER_PLANNING_FENCE_START.length),
    )
    if (
      candidate.length > FENCE_MARKER.length
      && APP_BUILDER_PLANNING_FENCE_START.startsWith(candidate)
    ) {
      return fenceMarkerIndex
    }

    searchIndex = fenceMarkerIndex + FENCE_MARKER.length
  }

  return -1
}

export const resolveNocodeEditorAppBuilderPlanningFenceState = (
  value: string,
): NocodeEditorAppBuilderPlanningFenceState => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n')
  if (!normalized) {
    return {
      visibleContent: '',
      pendingHiddenContent: '',
    }
  }

  let visibleContent = ''
  let cursor = 0
  let pendingHiddenContent = ''

  while (cursor < normalized.length) {
    const fenceStartIndex = findPlanningFenceLeadIndex(normalized, cursor)
    if (fenceStartIndex === -1) {
      visibleContent += normalized.slice(cursor)
      break
    }

    visibleContent += normalized.slice(cursor, fenceStartIndex)

    if (!normalized.startsWith(APP_BUILDER_PLANNING_FENCE_START, fenceStartIndex)) {
      pendingHiddenContent = normalized.slice(fenceStartIndex)
      break
    }

    const fenceEndIndex = normalized.indexOf(
      FENCE_MARKER,
      fenceStartIndex + APP_BUILDER_PLANNING_FENCE_START.length,
    )
    if (fenceEndIndex === -1) {
      pendingHiddenContent = normalized.slice(fenceStartIndex)
      break
    }

    cursor = fenceEndIndex + FENCE_MARKER.length
  }

  return {
    visibleContent: visibleContent
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    pendingHiddenContent,
  }
}

export const stripNocodeEditorAppBuilderPlanningFence = (value: string) => (
  resolveNocodeEditorAppBuilderPlanningFenceState(value).visibleContent
)
