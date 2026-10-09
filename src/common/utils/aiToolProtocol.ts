const DIRECT_PROTOCOL_MARKERS = [
  '<function=',
  '<parameter=',
  '</parameter',
  '</function',
  '</tool_call',
  '<tool_call',
]

const TAG_LIKE_SEGMENT_PATTERN = /<\/?[\w:-]+(?:=[^>\r\n]*)?>/g
const PROTOCOL_LIKE_TOKEN_PATTERN = /^[a-z0-9_.:/-]{1,80}$/i
const TOOL_PROTOCOL_FIELD_PATTERN = /(?:["'<\s]|^)(tool|function|name|appId|sourceId|mode)["']?\s*[:=]\s*["']?([a-z0-9_.:/-]{1,120})/gim

export type AiToolProtocolSignals = {
  toolNames: string[]
  appIds: string[]
  sourceIds: string[]
  modes: string[]
}

const stripTagLikeSegments = (text: string) => (
  text
    .replace(TAG_LIKE_SEGMENT_PATTERN, ' ')
    .replace(/[<>{}()[\],]/g, ' ')
)

const tokenizePlainText = (text: string) => (
  text
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
)

export const normalizeInterimText = (text: string) => (
  String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\u200b/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
)

export const isLikelyToolProtocolText = (text: string) => {
  const normalized = normalizeInterimText(text)
  if (!normalized) {
    return false
  }

  const lowerText = normalized.toLowerCase()
  if (DIRECT_PROTOCOL_MARKERS.some(marker => lowerText.includes(marker))) {
    return true
  }

  const tagMatches = lowerText.match(TAG_LIKE_SEGMENT_PATTERN) || []
  if (tagMatches.length < 2) {
    return false
  }
  if (!tagMatches.some(tag => /(tool_call|function|parameter)/.test(tag))) {
    return false
  }

  const strippedText = stripTagLikeSegments(lowerText)
  if (/[\u4e00-\u9fff]/.test(strippedText)) {
    return false
  }

  const tokens = tokenizePlainText(strippedText)
  if (!tokens.length) {
    return tagMatches.join('').length >= Math.max(12, Math.ceil(normalized.length * 0.35))
  }

  const protocolLikeTokenCount = tokens.filter(token => PROTOCOL_LIKE_TOKEN_PATTERN.test(token)).length
  const tagCoverage = tagMatches.join('').length / normalized.length

  return (
    tagCoverage >= 0.35
    && protocolLikeTokenCount >= Math.max(2, Math.ceil(tokens.length * 0.75))
  )
}

export const extractToolProtocolSignals = (text: string): AiToolProtocolSignals => {
  const normalized = normalizeInterimText(text)
  const signals: AiToolProtocolSignals = {
    toolNames: [],
    appIds: [],
    sourceIds: [],
    modes: [],
  }
  if (!normalized) {
    return signals
  }

  const pushUnique = (list: string[], value: string) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue || list.includes(normalizedValue)) {
      return
    }
    list.push(normalizedValue)
  }

  TOOL_PROTOCOL_FIELD_PATTERN.lastIndex = 0
  let matched: RegExpExecArray | null
  while ((matched = TOOL_PROTOCOL_FIELD_PATTERN.exec(normalized)) !== null) {
    const rawKey = String(matched[1] || '').trim().toLowerCase()
    const rawValue = String(matched[2] || '').trim()
    if (!rawKey || !rawValue) {
      continue
    }

    if (rawKey === 'tool' || rawKey === 'function' || rawKey === 'name') {
      if (['search_apps', 'get_app_memory', 'read_app_data'].includes(rawValue)) {
        pushUnique(signals.toolNames, rawValue)
      }
      continue
    }

    if (rawKey === 'mode') {
      const normalizedMode = rawValue.toLowerCase()
      if (['records', 'aggregate'].includes(normalizedMode)) {
        pushUnique(signals.modes, normalizedMode)
      }
      continue
    }

    if (rawKey === 'appid') {
      pushUnique(signals.appIds, rawValue)
      continue
    }
    if (rawKey === 'sourceid') {
      pushUnique(signals.sourceIds, rawValue)
    }
  }

  return signals
}
