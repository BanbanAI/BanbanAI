import { normalizeAiComparableText } from './ai-metric-field.util'

export type AiExplicitAppNameSignalReason =
  | 'quoted_name'
  | 'app_cue_word'
  | 'token_boundary'
  | 'cjk_direct_name'

export interface AiExplicitAppNameSignalMatch {
  appName: string
  reason: AiExplicitAppNameSignalReason
}

type AiExplicitAppNameSignalMatchWithSpan = AiExplicitAppNameSignalMatch & {
  start: number
  end: number
}

const AI_APP_CUE_WORDS = ['应用', '系统', '台账', '表单', '模块'] as const
const TOKEN_LIKE_CHAR_PATTERN = /[A-Za-z0-9_-]/u
const EXPLICIT_APP_NAME_VARIANT_SEPARATOR_PATTERN = /[ ._-]+/gu
const CJK_APP_NAME_CHAR_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]/u
const MIN_CJK_DIRECT_APP_NAME_LENGTH = 3

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeExplicitAppComparableText(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(EXPLICIT_APP_NAME_VARIANT_SEPARATOR_PATTERN, '')
}

function buildExplicitAppComparableText(value: unknown) {
  const sourceText = normalizeText(value).toLowerCase()
  const comparableToSourceIndex: number[] = []
  let comparableText = ''

  for (let index = 0; index < sourceText.length; index += 1) {
    const char = sourceText[index]
    if (char === ' ' || char === '-' || char === '_' || char === '.') {
      continue
    }

    comparableText += char
    comparableToSourceIndex.push(index)
  }

  return {
    comparableText,
    comparableToSourceIndex,
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isTokenLikeAppName(appName: string) {
  return TOKEN_LIKE_CHAR_PATTERN.test(appName)
}

function isTokenBoundaryChar(value: string) {
  return !value || !TOKEN_LIKE_CHAR_PATTERN.test(value)
}

function isCjkDirectNameCandidate(appName: string) {
  const comparableAppName = normalizeExplicitAppComparableText(appName)
  return !isTokenLikeAppName(appName)
    && CJK_APP_NAME_CHAR_PATTERN.test(appName)
    && Array.from(comparableAppName).length >= MIN_CJK_DIRECT_APP_NAME_LENGTH
}

function resolveQuotedNameSignal(userPrompt: string, appName: string): AiExplicitAppNameSignalMatchWithSpan | null {
  const escapedName = escapeRegExp(appName)
  for (const pattern of [
    new RegExp(`“\\s*${escapedName}\\s*”`, 'iu'),
    new RegExp(`"\\s*${escapedName}\\s*"`, 'iu'),
    new RegExp(`「\\s*${escapedName}\\s*」`, 'iu'),
    new RegExp(`‘\\s*${escapedName}\\s*’`, 'iu'),
    new RegExp(`'\\s*${escapedName}\\s*'`, 'iu'),
  ]) {
    const match = pattern.exec(userPrompt)
    if (match) {
      return {
        appName,
        reason: 'quoted_name',
        start: match.index,
        end: match.index + match[0].length,
      }
    }
  }

  return null
}

function resolveAppCueWordSignal(userPrompt: string, appName: string): AiExplicitAppNameSignalMatchWithSpan | null {
  const escapedName = escapeRegExp(appName)
  if (AI_APP_CUE_WORDS.some(cueWord => appName.endsWith(cueWord))) {
    const pattern = new RegExp(escapedName, 'iu')
    const match = pattern.exec(userPrompt)
    if (!match) {
      return null
    }

    return {
      appName,
      reason: 'app_cue_word',
      start: match.index,
      end: match.index + match[0].length,
    }
  }

  for (const cueWord of AI_APP_CUE_WORDS) {
    const pattern = new RegExp(`${escapedName}\\s*${cueWord}`, 'iu')
    const match = pattern.exec(userPrompt)
    if (match) {
      return {
        appName,
        reason: 'app_cue_word',
        start: match.index,
        end: match.index + match[0].length,
      }
    }
  }

  return null
}

function resolveCjkDirectNameSignal(userPrompt: string, appName: string): AiExplicitAppNameSignalMatchWithSpan | null {
  if (!isCjkDirectNameCandidate(appName)) {
    return null
  }

  const escapedName = escapeRegExp(appName)
  const pattern = new RegExp(escapedName, 'iu')
  const match = pattern.exec(userPrompt)
  if (!match) {
    return null
  }

  return {
    appName,
    reason: 'cjk_direct_name',
    start: match.index,
    end: match.index + match[0].length,
  }
}

function resolveTokenBoundarySignal(userPrompt: string, appName: string): AiExplicitAppNameSignalMatchWithSpan | null {
  if (!isTokenLikeAppName(appName)) {
    return null
  }

  const escapedName = escapeRegExp(appName)
  const pattern = new RegExp(escapedName, 'igu')
  let match: RegExpExecArray | null = null
  while ((match = pattern.exec(userPrompt))) {
    const start = match.index
    const end = start + match[0].length
    const previousChar = start > 0 ? userPrompt[start - 1] : ''
    const nextChar = end < userPrompt.length ? userPrompt[end] : ''
    const hasLeftBoundary = isTokenBoundaryChar(previousChar)
    const hasRightBoundary = isTokenBoundaryChar(nextChar)

    if (hasLeftBoundary && hasRightBoundary) {
      return {
        appName,
        reason: 'token_boundary',
        start,
        end,
      }
    }
  }

  return null
}

function resolveExplicitAppNameSignalMatch(userPrompt: string, appName: string): AiExplicitAppNameSignalMatchWithSpan | null {
  return resolveQuotedNameSignal(userPrompt, appName)
    || resolveAppCueWordSignal(userPrompt, appName)
    || resolveTokenBoundarySignal(userPrompt, appName)
    || resolveCjkDirectNameSignal(userPrompt, appName)
}

function resolveExplicitAppNameSignalMatchWithComparableText(
  appName: string,
  comparablePrompt: string,
  comparableToSourceIndex: number[],
): AiExplicitAppNameSignalMatchWithSpan | null {
  const comparableAppName = normalizeExplicitAppComparableText(appName)
  if (!comparableAppName) {
    return null
  }
  const match = resolveExplicitAppNameSignalMatch(comparablePrompt, comparableAppName)
  if (!match) {
    return null
  }

  const start = comparableToSourceIndex[match.start]
  const end = comparableToSourceIndex[match.end - 1]
  if (start === undefined || end === undefined) {
    return null
  }

  return {
    appName,
    reason: match.reason,
    start,
    end: end + 1,
  }
}

function isCoveredByExistingMatch(
  candidate: AiExplicitAppNameSignalMatchWithSpan,
  keptMatches: AiExplicitAppNameSignalMatchWithSpan[],
) {
  return keptMatches.some(existing =>
    existing.start <= candidate.start
    && existing.end >= candidate.end,
  )
}

export function hasExactExplicitAppNameKeyword(appName: string, keywords: unknown): boolean {
  const normalizedAppName = normalizeAiComparableText(appName)
  if (!normalizedAppName) {
    return false
  }

  const normalizedKeywords = new Set(
    (Array.isArray(keywords) ? keywords : [keywords])
      .map(item => normalizeAiComparableText(item))
      .filter(Boolean),
  )
  return normalizedKeywords.has(normalizedAppName)
}

export function collectPromptExplicitAppNameSignals(
  userPrompt: string | undefined,
  candidateNames: string[],
): AiExplicitAppNameSignalMatch[] {
  const normalizedPrompt = normalizeText(userPrompt)
  if (!normalizedPrompt) {
    return []
  }

  const comparablePrompt = normalizedPrompt.toLowerCase()
  const explicitComparablePrompt = buildExplicitAppComparableText(normalizedPrompt)
  const normalizedCandidateNames = [...new Set(
    (Array.isArray(candidateNames) ? candidateNames : [])
      .map(item => normalizeText(item))
      .filter(item => Boolean(item) && Boolean(normalizeExplicitAppComparableText(item))),
  )].sort((left, right) => right.length - left.length)

  const matchedSignals = normalizedCandidateNames
    .map(appName => {
      const comparableAppName = normalizeExplicitAppComparableText(appName)
      if (!comparablePrompt.includes(appName.toLowerCase())
        && !explicitComparablePrompt.comparableText.includes(comparableAppName)) {
        return null
      }

      return resolveExplicitAppNameSignalMatch(normalizedPrompt, appName)
        || resolveExplicitAppNameSignalMatchWithComparableText(
          appName,
          explicitComparablePrompt.comparableText,
          explicitComparablePrompt.comparableToSourceIndex,
        )
    })
    .filter((item): item is AiExplicitAppNameSignalMatchWithSpan => Boolean(item))

  const filteredSignals: AiExplicitAppNameSignalMatchWithSpan[] = []
  for (const match of matchedSignals) {
    if (isCoveredByExistingMatch(match, filteredSignals)) {
      continue
    }
    filteredSignals.push(match)
  }

  return filteredSignals.map(({ appName, reason }) => ({
    appName,
    reason,
  }))
}
