export type ToolArgumentRepairKind =
  | 'direct_json'
  | 'direct_object'
  | 'unescaped_quotes'
  | 'trim_extra_closing_delimiters'

export interface ToolArgumentRepairResult {
  value: Record<string, any>
  repairKind: ToolArgumentRepairKind
  sourceText?: string
  repairedText?: string
}

export const tryParseToolArgumentJsonObject = (
  value: unknown,
): ToolArgumentRepairResult | null => {
  if (!value) {
    return null
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const inputValue = (value as Record<string, any>).input
    if (typeof inputValue === 'string') {
      return tryParseToolArgumentJsonObject(inputValue)
    }
    return {
      value: value as Record<string, any>,
      repairKind: 'direct_object',
    }
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
    return null
  }

  const direct = tryParseJsonObject(normalized)
  if (direct) {
    return {
      value: direct,
      repairKind: 'direct_json',
      sourceText: normalized,
      repairedText: normalized,
    }
  }

  const trimmed = trimExtraClosingDelimiters(normalized)
  if (trimmed && trimmed !== normalized) {
    const parsedTrimmed = tryParseJsonObject(trimmed)
    if (parsedTrimmed) {
      return {
        value: parsedTrimmed,
        repairKind: 'trim_extra_closing_delimiters',
        sourceText: normalized,
        repairedText: trimmed,
      }
    }

    const quoteRepairedAfterTrim = repairLikelyUnescapedQuotesInJson(trimmed)
    if (quoteRepairedAfterTrim && quoteRepairedAfterTrim !== trimmed) {
      const parsedQuoteRepairedAfterTrim = tryParseJsonObject(quoteRepairedAfterTrim)
      if (parsedQuoteRepairedAfterTrim) {
        return {
          value: parsedQuoteRepairedAfterTrim,
          repairKind: 'unescaped_quotes',
          sourceText: normalized,
          repairedText: quoteRepairedAfterTrim,
        }
      }
    }
  }

  const quoteRepaired = repairLikelyUnescapedQuotesInJson(normalized)
  if (quoteRepaired && quoteRepaired !== normalized) {
    const parsedQuoteRepaired = tryParseJsonObject(quoteRepaired)
    if (parsedQuoteRepaired) {
      return {
        value: parsedQuoteRepaired,
        repairKind: 'unescaped_quotes',
        sourceText: normalized,
        repairedText: quoteRepaired,
      }
    }
  }

  return null
}

const tryParseJsonObject = (value: string): Record<string, any> | null => {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

const trimExtraClosingDelimiters = (source: string) => {
  let inString = false
  let escaping = false
  let depth = 0

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (escaping) {
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) {
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const prefix = source.slice(0, index + 1)
        const tail = source.slice(index + 1).trim()
        return tail && /^[}\]]+$/.test(tail) ? prefix : null
      }
      if (depth < 0) {
        return null
      }
    }
  }

  return null
}

export const repairLikelyUnescapedQuotesInJson = (source: string) => {
  let result = ''
  let inString = false
  let escaping = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1] || ''

    if (!inString) {
      result += char
      if (char === '"') {
        inString = true
      }
      continue
    }

    if (escaping) {
      result += char
      escaping = false
      continue
    }

    if (char === '\\') {
      result += char
      escaping = true
      continue
    }

    if (char === '"') {
      const closingLikely = next === ',' || next === '}' || next === ']' || next === ':' || !next
      if (!closingLikely) {
        result += '\\"'
        continue
      }
      result += char
      inString = false
      continue
    }

    result += char
  }

  return result
}
