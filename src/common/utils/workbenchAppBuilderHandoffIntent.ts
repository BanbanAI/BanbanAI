import {
  isMarkdownFenceClosingLine,
  parseMarkdownFenceOpeningLine,
} from './markdownFence'
import type {
  AppBuilderCreationMode,
  AppBuilderHandoffIntentKind,
  WorkbenchAppBuilderHandoffIntent,
} from '@common/types/appBuilderHandoff'

export const WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO = 'banban-app-builder-handoff-intent'

export type WorkbenchAppBuilderHandoffIntentSourceKind = 'strict' | 'tolerant-json'
export type WorkbenchAppBuilderHandoffIntentMalformedCode =
  | 'missing_entry_title'
  | 'invalid_creation_mode'
  | 'invalid_intent_kind'
  | 'invalid_json'

export type WorkbenchAppBuilderHandoffIntentLikeFencePayload = {
  sourceKind: WorkbenchAppBuilderHandoffIntentSourceKind
  rawPayload: string
}

export type WorkbenchAppBuilderHandoffIntentLikeFenceInspection =
  | { kind: 'absent' }
  | ({
      kind: 'malformed'
      code: WorkbenchAppBuilderHandoffIntentMalformedCode
    } & WorkbenchAppBuilderHandoffIntentLikeFencePayload)
  | ({
      kind: 'parsed'
      intent: WorkbenchAppBuilderHandoffIntent
    } & WorkbenchAppBuilderHandoffIntentLikeFencePayload)

const JSON_FENCE_INFO = 'json'
const HANDOFF_INTENT_VALUE = 'create_app_builder_task'
const REQUIRED_HANDOFF_KEYS = [
  'handoffIntent',
  'creationMode',
  'intentKind',
  'entryTitle',
] as const
const OPTIONAL_HANDOFF_KEYS = [
  'targetAppName',
  'reason',
] as const
const ALLOWED_HANDOFF_KEYS = new Set<string>([
  ...REQUIRED_HANDOFF_KEYS,
  ...OPTIONAL_HANDOFF_KEYS,
])

const VALID_CREATION_MODES = new Set<AppBuilderCreationMode>([
  'create_new_app',
  'extend_existing_app',
  'undecided',
])

const VALID_INTENT_KINDS = new Set<AppBuilderHandoffIntentKind>([
  'create_app',
  'create_form',
])

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeOptionalText = (value: unknown) => (
  typeof value === 'string' ? value.trim() : ''
)

const normalizeCreationMode = (value: unknown): AppBuilderCreationMode | null => {
  if (typeof value !== 'string') {
    return null
  }
  return VALID_CREATION_MODES.has(value as AppBuilderCreationMode)
    ? value as AppBuilderCreationMode
    : null
}

const normalizeIntentKind = (value: unknown): AppBuilderHandoffIntentKind | null => {
  if (typeof value !== 'string') {
    return null
  }
  return VALID_INTENT_KINDS.has(value as AppBuilderHandoffIntentKind)
    ? value as AppBuilderHandoffIntentKind
    : null
}

const inspectStrictWorkbenchAppBuilderHandoffIntentPayload = (
  rawPayload: string,
): WorkbenchAppBuilderHandoffIntentLikeFenceInspection => {
  try {
    const parsed = JSON.parse(String(rawPayload || '').trim())
    if (!isPlainObject(parsed)) {
      return {
        kind: 'malformed',
        sourceKind: 'strict',
        code: 'invalid_json',
        rawPayload,
      }
    }

    const raw = parsed as Record<string, unknown>
    if (raw.handoffIntent !== HANDOFF_INTENT_VALUE) {
      return {
        kind: 'malformed',
        sourceKind: 'strict',
        code: 'invalid_json',
        rawPayload,
      }
    }

    const creationMode = normalizeCreationMode(raw.creationMode)
    if (!creationMode) {
      return {
        kind: 'malformed',
        sourceKind: 'strict',
        code: 'invalid_creation_mode',
        rawPayload,
      }
    }

    const intentKind = normalizeIntentKind(raw.intentKind)
    if (!intentKind) {
      return {
        kind: 'malformed',
        sourceKind: 'strict',
        code: 'invalid_intent_kind',
        rawPayload,
      }
    }

    const entryTitle = normalizeOptionalText(raw.entryTitle)
    if (!entryTitle) {
      return {
        kind: 'malformed',
        sourceKind: 'strict',
        code: 'missing_entry_title',
        rawPayload,
      }
    }

    const targetAppName = normalizeOptionalText(raw.targetAppName)
    const reason = normalizeOptionalText(raw.reason)

    return {
      kind: 'parsed',
      sourceKind: 'strict',
      rawPayload,
      intent: {
        handoffIntent: HANDOFF_INTENT_VALUE,
        creationMode,
        intentKind,
        entryTitle,
        ...(targetAppName ? { targetAppName } : {}),
        ...(reason ? { reason } : {}),
      },
    }
  } catch {
    return {
      kind: 'malformed',
      sourceKind: 'strict',
      code: 'invalid_json',
      rawPayload,
    }
  }
}

const inspectTolerantWorkbenchAppBuilderHandoffIntentPayload = (
  rawPayload: string,
): WorkbenchAppBuilderHandoffIntentLikeFenceInspection => {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(rawPayload || '').trim())
  } catch {
    return { kind: 'absent' }
  }

  if (!isPlainObject(parsed)) {
    return { kind: 'absent' }
  }

  const raw = parsed as Record<string, unknown>
  if (raw.handoffIntent !== HANDOFF_INTENT_VALUE) {
    return { kind: 'absent' }
  }

  const keys = Object.keys(raw)
  if (!keys.length || keys.some(key => !ALLOWED_HANDOFF_KEYS.has(key))) {
    return { kind: 'absent' }
  }

  if (!Object.prototype.hasOwnProperty.call(raw, 'creationMode')) {
    return {
      kind: 'malformed',
      sourceKind: 'tolerant-json',
      code: 'invalid_creation_mode',
      rawPayload,
    }
  }
  const creationMode = normalizeCreationMode(raw.creationMode)
  if (!creationMode) {
    return {
      kind: 'malformed',
      sourceKind: 'tolerant-json',
      code: 'invalid_creation_mode',
      rawPayload,
    }
  }

  if (!Object.prototype.hasOwnProperty.call(raw, 'intentKind')) {
    return {
      kind: 'malformed',
      sourceKind: 'tolerant-json',
      code: 'invalid_intent_kind',
      rawPayload,
    }
  }
  const intentKind = normalizeIntentKind(raw.intentKind)
  if (!intentKind) {
    return {
      kind: 'malformed',
      sourceKind: 'tolerant-json',
      code: 'invalid_intent_kind',
      rawPayload,
    }
  }

  const hasEntryTitle = Object.prototype.hasOwnProperty.call(raw, 'entryTitle')
  const entryTitle = normalizeOptionalText(raw.entryTitle)
  if (!hasEntryTitle || !entryTitle) {
    return {
      kind: 'malformed',
      sourceKind: 'tolerant-json',
      code: 'missing_entry_title',
      rawPayload,
    }
  }

  const targetAppName = normalizeOptionalText(raw.targetAppName)
  const reason = normalizeOptionalText(raw.reason)

  return {
    kind: 'parsed',
    sourceKind: 'tolerant-json',
    rawPayload,
    intent: {
      handoffIntent: HANDOFF_INTENT_VALUE,
      creationMode,
      intentKind,
      entryTitle,
      ...(targetAppName ? { targetAppName } : {}),
      ...(reason ? { reason } : {}),
    },
  }
}

const collectWorkbenchAppBuilderHandoffIntentLikeFences = (text: string) => {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const matches: Array<WorkbenchAppBuilderHandoffIntentLikeFenceInspection & {
    startLine: number
    endLine: number
  }> = []
  let active:
    | {
        marker: string
        startLine: number
        info: typeof WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO | typeof JSON_FENCE_INFO
        lines: string[]
      }
    | null = null
  let passthroughMarker: string | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (active) {
      if (isMarkdownFenceClosingLine(line, active.marker)) {
        const rawPayload = active.lines.join('\n')
        const inspection = active.info === WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO
          ? inspectStrictWorkbenchAppBuilderHandoffIntentPayload(rawPayload)
          : inspectTolerantWorkbenchAppBuilderHandoffIntentPayload(rawPayload)
        if (inspection.kind !== 'absent') {
          matches.push({
            ...inspection,
            startLine: active.startLine,
            endLine: index,
          })
        }
        active = null
        continue
      }

      active.lines.push(line)
      continue
    }

    if (passthroughMarker) {
      if (isMarkdownFenceClosingLine(line, passthroughMarker)) {
        passthroughMarker = null
      }
      continue
    }

    const opening = parseMarkdownFenceOpeningLine(line)
    if (!opening) {
      continue
    }

    if (
      opening.info === WORKBENCH_APP_BUILDER_HANDOFF_INTENT_INFO
      || opening.info === JSON_FENCE_INFO
    ) {
      active = {
        marker: opening.marker,
        startLine: index,
        info: opening.info,
        lines: [],
      }
      continue
    }

    passthroughMarker = opening.marker
  }

  return {
    lines,
    matches,
  }
}

export const inspectWorkbenchAppBuilderHandoffIntentLikeFence = (
  text: string,
): WorkbenchAppBuilderHandoffIntentLikeFenceInspection => {
  const { matches } = collectWorkbenchAppBuilderHandoffIntentLikeFences(text)
  if (!matches.length) {
    return { kind: 'absent' }
  }

  const [firstMatch] = matches
  if (firstMatch?.kind === 'parsed') {
    return {
      kind: 'parsed',
      sourceKind: firstMatch.sourceKind,
      rawPayload: firstMatch.rawPayload,
      intent: firstMatch.intent,
    }
  }
  if (firstMatch?.kind === 'malformed') {
    return {
      kind: 'malformed',
      sourceKind: firstMatch.sourceKind,
      rawPayload: firstMatch.rawPayload,
      code: firstMatch.code,
    }
  }

  return { kind: 'absent' }
}

export const stripWorkbenchAppBuilderHandoffIntentLikeFences = (text: string) => {
  const { lines, matches } = collectWorkbenchAppBuilderHandoffIntentLikeFences(text)
  if (!matches.length) {
    return String(text || '').replace(/\r\n?/g, '\n')
  }

  const strippedLineIndexes = new Set<number>()
  for (const match of matches) {
    if (match.kind !== 'parsed' && match['sourceKind'] !== 'strict') {
      continue
    }
    for (let index = match.startLine; index <= match.endLine; index += 1) {
      strippedLineIndexes.add(index)
    }
  }

  return lines
    .filter((_, index) => !strippedLineIndexes.has(index))
    .join('\n')
}
