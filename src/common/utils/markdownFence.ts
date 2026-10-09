export type MarkdownFenceOpeningLine = {
  marker: string
  info: string
}

const normalizeFenceLine = (line: string) => (
  String(line || '').replace(/\r?\n$/, '').replace(/\r$/, '')
)

export const parseMarkdownFenceOpeningLine = (line: string): MarkdownFenceOpeningLine | null => {
  const match = normalizeFenceLine(line).match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/)
  if (!match) {
    return null
  }
  return {
    marker: match[1],
    info: String(match[2] || '').trim().toLowerCase(),
  }
}

export const isMarkdownFenceOpeningLine = (line: string) => (
  Boolean(parseMarkdownFenceOpeningLine(line))
)

export const isMarkdownFenceClosingLine = (line: string, openingMarker: string) => {
  const normalizedLine = normalizeFenceLine(line).trim()
  const markerChar = String(openingMarker || '')[0]
  if (!normalizedLine || !markerChar || normalizedLine[0] !== markerChar) {
    return false
  }

  let markerLength = 0
  while (normalizedLine[markerLength] === markerChar) {
    markerLength += 1
  }

  return markerLength >= openingMarker.length && !normalizedLine.slice(markerLength).trim()
}
