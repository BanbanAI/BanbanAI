import i18next from 'i18next'

const UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START = '```banban-app-builder-blueprint'
const FENCE_MARKER = '```'

export const getNocodeEditorUnsupportedBlueprintProtocolMessage = () => (
  i18next.t('nocodeEditorUnsupportedBlueprintProtocol.invalidBlueprintResult')
)

type NocodeEditorUnsupportedBlueprintProtocolState = {
  visibleContent: string
  pendingHiddenContent: string
  containsUnsupportedProtocol: boolean
}

const findUnsupportedBlueprintProtocolLeadIndex = (value: string, fromIndex: number) => {
  let searchIndex = fromIndex

  while (searchIndex < value.length) {
    const fenceMarkerIndex = value.indexOf(FENCE_MARKER, searchIndex)
    if (fenceMarkerIndex === -1) {
      return -1
    }

    const candidate = value.slice(
      fenceMarkerIndex,
      Math.min(value.length, fenceMarkerIndex + UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START.length),
    )
    if (
      candidate.length > FENCE_MARKER.length
      && UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START.startsWith(candidate)
    ) {
      return fenceMarkerIndex
    }

    searchIndex = fenceMarkerIndex + FENCE_MARKER.length
  }

  return -1
}

export const resolveNocodeEditorUnsupportedBlueprintProtocolState = (
  value: string,
): NocodeEditorUnsupportedBlueprintProtocolState => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n')
  if (!normalized) {
    return {
      visibleContent: '',
      pendingHiddenContent: '',
      containsUnsupportedProtocol: false,
    }
  }

  let visibleContent = ''
  let cursor = 0
  let pendingHiddenContent = ''
  let containsUnsupportedProtocol = false

  while (cursor < normalized.length) {
    const fenceStartIndex = findUnsupportedBlueprintProtocolLeadIndex(normalized, cursor)
    if (fenceStartIndex === -1) {
      visibleContent += normalized.slice(cursor)
      break
    }

    visibleContent += normalized.slice(cursor, fenceStartIndex)
    containsUnsupportedProtocol = true

    if (!normalized.startsWith(UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START, fenceStartIndex)) {
      pendingHiddenContent = normalized.slice(fenceStartIndex)
      break
    }

    const fenceEndIndex = normalized.indexOf(
      FENCE_MARKER,
      fenceStartIndex + UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START.length,
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
    containsUnsupportedProtocol: containsUnsupportedProtocol || Boolean(pendingHiddenContent),
  }
}

export const containsUnsupportedNocodeEditorBlueprintProtocol = (value: string) => (
  resolveNocodeEditorUnsupportedBlueprintProtocolState(value).containsUnsupportedProtocol
)

export const sanitizeNocodeEditorUnsupportedBlueprintProtocol = (
  value: string,
  options?: {
    replaceWhenDetected?: boolean
    fallbackText?: string
  },
) => {
  const state = resolveNocodeEditorUnsupportedBlueprintProtocolState(value)
  const fallbackText = String(
    options?.fallbackText || getNocodeEditorUnsupportedBlueprintProtocolMessage(),
  ).trim() || getNocodeEditorUnsupportedBlueprintProtocolMessage()

  if (state.containsUnsupportedProtocol && options?.replaceWhenDetected) {
    return fallbackText
  }

  if (state.containsUnsupportedProtocol && !state.visibleContent) {
    return fallbackText
  }

  return state.visibleContent
}
