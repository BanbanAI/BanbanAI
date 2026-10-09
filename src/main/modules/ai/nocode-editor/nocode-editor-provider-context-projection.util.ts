import { AiActionDefinition, AiMessageRole, AiProviderMessage } from '../ai.types'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'

const LANGCHAIN_TOOL_SCHEMA_ESTIMATE_OVERHEAD_BYTES = 105

const isInstructionRole = (role: AiMessageRole) => (
  role === AiMessageRole.SYSTEM || role === AiMessageRole.DEVELOPER
)

export type NocodeEditorProviderContextProjectionResult = {
  messages: AiProviderMessage[]
  estimatedBytes: number
  compacted: boolean
  projections: Array<{
    strategy: string
    changedMessages: number
    beforeBytes: number
    afterBytes: number
  }>
}

type NocodeEditorProviderContextProjectionStageResult = Omit<
  NocodeEditorProviderContextProjectionResult,
  'estimatedBytes'
>

type FormSummaryEntry = {
  key: string
  messageIndex: number
  formIndex?: number
}

type ModelToolExchangeMessageRef = {
  message: AiProviderMessage
  index: number
  round: number | null
}

type ModelToolExchangePair = {
  call: ModelToolExchangeMessageRef
  result: ModelToolExchangeMessageRef
  round: number | null
}

type AvailableWidgetTypesProjectionMode = 'full' | 'single-alias' | 'type-name'
type StagedBlueprintFocusedFieldProjectionMode = 'entries' | 'names'
type StagedBlueprintContextProjectionOptions = {
  omitNonFocusedFields?: boolean
  focusedFieldProjection?: StagedBlueprintFocusedFieldProjectionMode
  filterFocusedFieldsByLatestUser?: boolean
  focusedFieldFallbackCount?: number
}

const FORM_SUMMARY_TOOL_NAMES = new Set([
  'editor_get_form_summary',
  'editor_get_targeted_form_summaries',
  'editor_get_all_form_summaries',
])
const APP_PLAN_TOOL_NAME = 'editor_stage_app_plan'
const SINGLE_FORM_PLAN_TOOL_NAME = 'editor_stage_single_form_plan'
const FORMULA_STAGE_TOOL_NAME = 'editor_stage_formula_plan'
// The staged blueprint read result is already compacted by the host and must stay intact for later updates.
const STAGED_BLUEPRINT_TOOL_NAMES = new Set([
  'editor_stage_app_blueprint',
])
const STAGED_BLUEPRINT_TOOL_CALL_NAMES = new Set([
  'editor_stage_app_blueprint',
])
const STAGED_PLANNING_TOOL_NAMES = new Set([
  APP_PLAN_TOOL_NAME,
  SINGLE_FORM_PLAN_TOOL_NAME,
  FORMULA_STAGE_TOOL_NAME,
])
const STAGED_BLUEPRINT_TOOL_OPEN_QUESTION_LIMIT = 6
const STAGED_PLANNING_TOOL_OPEN_QUESTION_LIMIT = 6
const STAGED_PLANNING_ARTIFACT_LIMIT = 24
const STAGED_PLANNING_OBJECT_LIMIT = 24
const STAGED_PLANNING_MODULE_LIMIT = 24
const STAGED_PLANNING_FLOW_LIMIT = 24
const STAGED_PLANNING_CONFIRMATION_RESULT_LIMIT = 8
const NOCODE_EDITOR_COMPACTION_CRITICAL_TOOL_NAMES = new Set([
  APP_PLAN_TOOL_NAME,
  SINGLE_FORM_PLAN_TOOL_NAME,
  'editor_stage_app_blueprint',
  'editor_get_staged_app_blueprint',
])

const CHINESE_ORDINAL_DIGIT_MAP: Record<string, number> = {
  '\u96f6': 0,
  '\u3007': 0,
  '\u4e00': 1,
  '\u4e8c': 2,
  '\u4e24': 2,
  '\u4e09': 3,
  '\u56db': 4,
  '\u4e94': 5,
  '\u516d': 6,
  '\u4e03': 7,
  '\u516b': 8,
  '\u4e5d': 9,
}

const isPlainObject = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const COMPACT_HISTORY_SUMMARY_ITEM_LIMIT = 8
const COMPACT_HISTORY_SUMMARY_ITEM_CHARS = 180
const COMPACT_HISTORY_SUMMARY_TOTAL_CHARS = 260
const COMPACT_HISTORY_RETAINED_ASSISTANT_CHARS = 900
const COMPACT_HISTORY_TRAILING_ASSISTANT_CHARS = 800
const COMPACT_HISTORY_TRAILING_TOOL_EXCHANGE_ASSISTANT_CHARS = 2600
const LONG_ASSISTANT_HISTORY_CONTENT_CHARS = 4000
const LONG_ASSISTANT_HISTORY_PROSE_HEAD_CHARS = 900
const LONG_ASSISTANT_HISTORY_PROSE_TAIL_CHARS = 0
const LONG_ASSISTANT_HISTORY_FIELD_PREVIEW_LIMIT = 12
const LONG_ASSISTANT_HISTORY_FORM_PREVIEW_LIMIT = 12

export const measureUtf8JsonBytes = (value: unknown) => (
  Buffer.byteLength(JSON.stringify(value), 'utf8')
)

const normalizeCompactText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const truncateCompactText = (value: unknown, maxChars: number) => {
  const text = normalizeCompactText(value)
  const limit = Math.max(20, Math.round(Number(maxChars || 0)) || 20)
  if (text.length <= limit) {
    return text
  }
  const separator = ' ... '
  const tailLength = 16
  const headLength = Math.max(0, limit - separator.length - tailLength)
  return `${text.slice(0, headLength).trim()}${separator}${text.slice(-tailLength).trim()}`
}

const hasModelToolExchange = (message: AiProviderMessage) => Boolean(
  message.metadata?.modelToolExchangeCall
  || message.metadata?.modelToolExchangeResult,
)

const normalizeModelToolExchangeId = (value: unknown) => (
  String(value || '').trim()
)

const getModelToolExchangeCallId = (message: AiProviderMessage) => (
  normalizeModelToolExchangeId(message.metadata?.modelToolExchangeCall?.id)
)

const getModelToolExchangeResultCallId = (message: AiProviderMessage) => (
  normalizeModelToolExchangeId(message.metadata?.modelToolExchangeResult?.callId)
)

const getModelToolExchangeRound = (message: AiProviderMessage) => {
  const round = Number(message.metadata?.round)
  return Number.isFinite(round) && round > 0
    ? Math.round(round)
    : null
}

const isPersistedErrorMessage = (message: AiProviderMessage) => (
  message.metadata?.persistedError === true
)

const isCompatibleModelToolExchangePair = (
  call: ModelToolExchangeMessageRef,
  result: ModelToolExchangeMessageRef,
) => (
  call.index < result.index
  && (
    call.round === null
    || result.round === null
    || call.round === result.round
  )
)

const findCompatibleModelToolExchangeCallIndex = (
  pendingCalls: ModelToolExchangeMessageRef[],
  result: ModelToolExchangeMessageRef,
) => {
  if (result.round !== null) {
    const exactRoundCallIndex = pendingCalls.findIndex(call => (
      call.index < result.index
      && call.round === result.round
    ))
    if (exactRoundCallIndex >= 0) {
      return exactRoundCallIndex
    }
  }

  return pendingCalls.findIndex(call => (
    isCompatibleModelToolExchangePair(call, result)
  ))
}

const collectLatestTrailingModelToolExchangeMessages = (messages: AiProviderMessage[]) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const pendingCallsById = new Map<string, ModelToolExchangeMessageRef[]>()
  const completePairs: ModelToolExchangePair[] = []

  normalizedMessages.forEach((message, index) => {
    const round = getModelToolExchangeRound(message)
    const resultCallId = getModelToolExchangeResultCallId(message)
    if (resultCallId) {
      const pendingCalls = pendingCallsById.get(resultCallId)
      if (pendingCalls?.length) {
        const result: ModelToolExchangeMessageRef = {
          message,
          index,
          round,
        }
        const compatibleCallIndex = findCompatibleModelToolExchangeCallIndex(
          pendingCalls,
          result,
        )
        if (compatibleCallIndex >= 0) {
          const [call] = pendingCalls.splice(compatibleCallIndex, 1)
          if (!pendingCalls.length) {
            pendingCallsById.delete(resultCallId)
          }
          completePairs.push({
            call,
            result,
            round: result.round || call.round,
          })
        }
      }
    }

    const callId = getModelToolExchangeCallId(message)
    if (callId) {
      const pendingCalls = pendingCallsById.get(callId) || []
      pendingCalls.push({
        message,
        index,
        round,
      })
      pendingCallsById.set(callId, pendingCalls)
    }
  })

  if (!completePairs.length) {
    return []
  }

  const latestPair = completePairs[completePairs.length - 1]
  const retainedPairs = latestPair.round === null
    ? completePairs.slice(-2)
    : completePairs
      .filter(pair => pair.round === latestPair.round)
  const retainedIndexes = new Set<number>()

  retainedPairs.forEach((pair) => {
    retainedIndexes.add(pair.call.index)
    retainedIndexes.add(pair.result.index)
  })

  return normalizedMessages.filter((_, index) => retainedIndexes.has(index))
}

const shouldSummarizeHistoryMessage = (message: AiProviderMessage) => {
  if (hasModelToolExchange(message) || isPersistedErrorMessage(message)) {
    return false
  }
  if (message.role !== AiMessageRole.USER && message.role !== AiMessageRole.ASSISTANT) {
    return false
  }
  if (message.metadata?.hiddenFromTimeline) {
    return false
  }
  return Boolean(normalizeCompactText(message.content))
}

const buildCompactHistorySummaryLine = (message: AiProviderMessage) => {
  const label = message.role === AiMessageRole.USER ? 'User' : 'Assistant'
  return `- ${label}: ${truncateCompactText(message.content, COMPACT_HISTORY_SUMMARY_ITEM_CHARS)}`
}

const buildCompactHistorySummaryContent = (messages: AiProviderMessage[]) => {
  const lines = messages
    .filter(shouldSummarizeHistoryMessage)
    .slice(-COMPACT_HISTORY_SUMMARY_ITEM_LIMIT)
    .map(buildCompactHistorySummaryLine)

  if (!lines.length) {
    return ''
  }

  return truncateCompactText(
    [
      'Earlier conversation was context-projected; only the context needed to continue is retained.',
      ...lines,
    ].join('\n'),
    COMPACT_HISTORY_SUMMARY_TOTAL_CHARS,
  )
}

const extractCompactKeywords = (value: unknown) => {
  const text = normalizeCompactText(value)
  const quotedTerms = Array.from(text.matchAll(/["']([^"']{2,30})["']/g))
    .map(match => normalizeCompactText(match[1]))
  const phraseTerms = text
    .split(/[\s,.;:!?\uFF0C\u3002\uFF1B\uFF1A\u3001\uFF01\uFF1F]+/g)
    .map(item => normalizeCompactText(item))
    .filter(item => item.length >= 2 && item.length <= 30)
  return Array.from(new Set([...quotedTerms, ...phraseTerms])).slice(0, 20)
}

const compactAssistantTextForLatestUser = (
  content: unknown,
  latestUserContent: unknown,
  maxChars: number,
) => {
  const text = String(content || '')
  if (text.length <= maxChars) {
    return text
  }

  const keywords = extractCompactKeywords(latestUserContent)
  const lines = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
  const keptLines: string[] = []
  lines.forEach((line, index) => {
    const keep = index < 2 || keywords.some(keyword => keyword && line.includes(keyword))
    if (keep && !keptLines.includes(line)) {
      keptLines.push(line)
    }
  })
  const finalLine = lines[lines.length - 1]
  if (finalLine && !keptLines.includes(finalLine)) {
    keptLines.push(finalLine)
  }

  return truncateCompactText(
    keptLines.length
      ? [
        'Previous tool summary was context-projected; retained lines are most relevant to the latest request.',
        ...keptLines,
      ].join('\n')
      : text,
    maxChars,
  )
}

const findLatestUserMessageIndex = (messages: AiProviderMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === AiMessageRole.USER && normalizeCompactText(messages[index]?.content)) {
      return index
    }
  }
  return -1
}

const findLatestAssistantStatusIndexBefore = (
  messages: AiProviderMessage[],
  beforeIndex: number,
) => {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (
      message?.role === AiMessageRole.ASSISTANT
      && !hasModelToolExchange(message)
      && !isPersistedErrorMessage(message)
      && !message.metadata?.hiddenFromTimeline
      && normalizeCompactText(message.content)
    ) {
      return index
    }
  }
  return -1
}

const compactRetainedHistoryMessage = (message: AiProviderMessage) => {
  if (message.role !== AiMessageRole.ASSISTANT) {
    return message
  }
  const content = String(message.content || '')
  if (content.length <= COMPACT_HISTORY_RETAINED_ASSISTANT_CHARS) {
    return message
  }
  return {
    ...message,
    content: truncateCompactText(content, COMPACT_HISTORY_RETAINED_ASSISTANT_CHARS),
  }
}

const compactTrailingHistoryMessage = (
  message: AiProviderMessage,
  latestUserContent: string,
) => {
  if (message.role !== AiMessageRole.ASSISTANT) {
    return message
  }
  return {
    ...message,
    content: compactAssistantTextForLatestUser(
      message.content,
      latestUserContent,
      COMPACT_HISTORY_TRAILING_ASSISTANT_CHARS,
    ),
  }
}

const compactRetainedTrailingToolExchangeMessageForContext = (
  message: AiProviderMessage,
  latestUserContent: string,
) => {
  if (
    !hasModelToolExchange(message)
    || message.role !== AiMessageRole.ASSISTANT
  ) {
    return message
  }

  const nextContent = compactAssistantTextForLatestUser(
    message.content,
    latestUserContent,
    COMPACT_HISTORY_TRAILING_TOOL_EXCHANGE_ASSISTANT_CHARS,
  )

  return nextContent === message.content
    ? message
    : {
      ...message,
      content: nextContent,
    }
}

const truncateMiddleProviderText = (
  value: unknown,
  options: {
    headChars: number
    tailChars: number
  },
) => {
  const text = normalizeCompactText(value)
  const headChars = Math.max(0, Math.round(Number(options.headChars || 0)))
  const tailChars = Math.max(0, Math.round(Number(options.tailChars || 0)))
  if (!text || text.length <= headChars + tailChars + 80) {
    return text
  }
  if (tailChars <= 0) {
    return `${text.slice(0, headChars).trim()} ...`
  }
  return `${text.slice(0, headChars).trim()} ... ${text.slice(-tailChars).trim()}`
}

const stripProviderFencedCodeBlocks = (content: string) => (
  String(content || '').replace(/```[\s\S]*?```/g, '\n')
)

const parseProviderJsonFencedBlocks = (content: string) => {
  const blocks: unknown[] = []
  const pattern = /```[^\n`]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(String(content || '')))) {
    const body = String(match[1] || '').trim()
    if (!body || (!body.startsWith('{') && !body.startsWith('['))) {
      continue
    }
    try {
      blocks.push(JSON.parse(body))
    } catch (_error) {
      // Historical fenced blocks may be malformed; prose compaction still works.
    }
  }
  return blocks
}

const normalizeProviderCompactLabel = (value: unknown, maxLength = 80) => (
  normalizeCompactText(value).slice(0, maxLength)
)

const resolveProviderStructuredRoot = (value: unknown): Record<string, any> | null => {
  if (!isPlainObject(value)) {
    return null
  }
  if (isPlainObject(value.blueprint)) {
    return value.blueprint
  }
  if (isPlainObject((value as Record<string, any>).output?.blueprint)) {
    return (value as Record<string, any>).output.blueprint
  }
  return value as Record<string, any>
}

const resolveProviderStructuredForms = (root: Record<string, any>) => {
  for (const key of ['forms', 'tables', 'objects', 'artifacts']) {
    if (Array.isArray(root[key])) {
      return root[key]
    }
  }
  return []
}

const resolveProviderStructuredFields = (form: Record<string, any>) => {
  for (const key of ['fields', 'children', 'columns', 'items']) {
    if (Array.isArray(form[key])) {
      return form[key]
    }
  }
  return []
}

const buildCompactProviderStructuredHistoryOutline = (value: unknown) => {
  const root = resolveProviderStructuredRoot(value)
  if (!root) {
    return ''
  }

  const lines: string[] = []
  const title = normalizeProviderCompactLabel(root.title || root.name || root.tableName || root.goal)
  const summary = normalizeProviderCompactLabel(root.summary || root.description, 180)
  if (title) {
    lines.push(`Title: ${title}`)
  }
  if (summary) {
    lines.push(`Summary: ${summary}`)
  }

  const forms = resolveProviderStructuredForms(root)
    .filter(isPlainObject)
    .slice(0, LONG_ASSISTANT_HISTORY_FORM_PREVIEW_LIMIT)
  if (forms.length) {
    lines.push('Structured forms:')
  }
  forms.forEach((form) => {
    const formName = normalizeProviderCompactLabel(
      form.tableName || form.formName || form.name || form.title || form.formKey,
    ) || 'unnamed form'
    const fields = resolveProviderStructuredFields(form).filter(isPlainObject)
    const fieldPreview = fields
      .slice(0, LONG_ASSISTANT_HISTORY_FIELD_PREVIEW_LIMIT)
      .map((field) => {
        const fieldName = normalizeProviderCompactLabel(
          field.name || field.fieldName || field.title || field.fieldKey,
          50,
        )
        const widgetType = normalizeProviderCompactLabel(field.widgetType || field.type, 40)
        return [fieldName, widgetType ? `(${widgetType})` : ''].filter(Boolean).join('')
      })
      .filter(Boolean)
      .join(', ')
    const omitted = fields.length > LONG_ASSISTANT_HISTORY_FIELD_PREVIEW_LIMIT
      ? ` and ${fields.length - LONG_ASSISTANT_HISTORY_FIELD_PREVIEW_LIMIT} more`
      : ''
    lines.push(`- ${formName}: ${fields.length} fields${fieldPreview ? `: ${fieldPreview}${omitted}` : ''}`)
  })

  const openQuestions = Array.isArray(root.openQuestions)
    ? root.openQuestions
      .map(item => normalizeCompactText(item))
      .filter(Boolean)
      .slice(0, 6)
    : []
  if (openQuestions.length) {
    lines.push(`Open questions: ${openQuestions.join('; ')}`)
  }

  return lines.join('\n')
}

const compactLongAssistantHistoryContentForContext = (
  message: AiProviderMessage,
) => {
  const content = String(message.content || '')
  if (
    message.role !== AiMessageRole.ASSISTANT
    || hasModelToolExchange(message)
    || isPersistedErrorMessage(message)
    || content.length <= LONG_ASSISTANT_HISTORY_CONTENT_CHARS
  ) {
    return content
  }

  const taskSummary = isPlainObject(message.metadata?.taskSummary)
    ? JSON.stringify(message.metadata.taskSummary)
    : ''
  const proseSummary = truncateMiddleProviderText(stripProviderFencedCodeBlocks(content), {
    headChars: LONG_ASSISTANT_HISTORY_PROSE_HEAD_CHARS,
    tailChars: LONG_ASSISTANT_HISTORY_PROSE_TAIL_CHARS,
  })
  const structuredOutlines = parseProviderJsonFencedBlocks(content)
    .map(buildCompactProviderStructuredHistoryOutline)
    .filter(Boolean)
    .slice(0, 3)

  return [
    'Assistant long history was compacted by the provider context projection. The following summary keeps the context needed to continue.',
    'Earlier conversation was context-projected; only the context needed to continue is retained.',
    taskSummary ? `Task summary: ${taskSummary}` : '',
    proseSummary ? `Prose summary: ${proseSummary}` : '',
    ...structuredOutlines.map((outline, index) => `Structured content summary ${index + 1}:\n${outline}`),
  ].filter(Boolean).join('\n')
}

export const projectLongAssistantHistoryMessagesForContext = (
  messages: AiProviderMessage[],
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const hasLongAssistantHistoryMessage = normalizedMessages.some(message => (
    message.role === AiMessageRole.ASSISTANT
    && !hasModelToolExchange(message)
    && !isPersistedErrorMessage(message)
    && String(message.content || '').length > LONG_ASSISTANT_HISTORY_CONTENT_CHARS
  ))
  if (!hasLongAssistantHistoryMessage) {
    return {
      messages: normalizedMessages,
      compacted: false,
      projections: [],
    }
  }

  const latestUserIndex = findLatestUserMessageIndex(normalizedMessages)
  const latestUserContent = latestUserIndex >= 0
    ? String(normalizedMessages[latestUserIndex]?.content || '')
    : ''
  const trailingSourceMessages = latestUserIndex >= 0
    ? normalizedMessages.slice(latestUserIndex + 1)
    : []
  const retainedTrailingToolExchangeMessages = collectLatestTrailingModelToolExchangeMessages(
    trailingSourceMessages,
  )
  const retainedTrailingToolExchangeSet = new Set(retainedTrailingToolExchangeMessages)
  const projectedMessages = normalizedMessages.flatMap((message, index) => {
    if (
      latestUserIndex >= 0
      && index < latestUserIndex
      && (message.role === AiMessageRole.TOOL || hasModelToolExchange(message))
    ) {
      return []
    }

    if (
      latestUserIndex >= 0
      && index > latestUserIndex
    ) {
      if (retainedTrailingToolExchangeSet.has(message)) {
        return [compactRetainedTrailingToolExchangeMessageForContext(message, latestUserContent)]
      }
      if (
        message.role === AiMessageRole.TOOL
        || hasModelToolExchange(message)
        || isPersistedErrorMessage(message)
      ) {
        return []
      }
      return [compactTrailingHistoryMessage(message, latestUserContent)]
    }

    const nextContent = compactLongAssistantHistoryContentForContext(message)
    return nextContent === message.content
      ? [message]
      : [{
        ...message,
        content: nextContent,
      }]
  })
  const changedMessages = Math.max(0, normalizedMessages.length - projectedMessages.length)
    + projectedMessages.filter((message, index) => (
      message.content !== normalizedMessages[index]?.content
    )).length
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: 'nocode-editor-long-assistant-history-compaction',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

export const compactOlderProviderHistoryForContext = (messages: AiProviderMessage[]) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const latestUserIndex = findLatestUserMessageIndex(normalizedMessages)
  if (latestUserIndex < 0) {
    return {
      messages: normalizedMessages,
      compacted: false,
      projections: [],
    }
  }

  const latestAssistantStatusIndex = findLatestAssistantStatusIndexBefore(
    normalizedMessages,
    latestUserIndex,
  )
  const latestUserContent = String(normalizedMessages[latestUserIndex]?.content || '')
  const olderMessages = normalizedMessages.filter((message, index) => (
    index < latestUserIndex
    && index !== latestAssistantStatusIndex
    && !isInstructionRole(message.role)
  ))
  const compactSummaryContent = buildCompactHistorySummaryContent(olderMessages)
  const systemMessages = normalizedMessages.filter(message => isInstructionRole(message.role))
  const trailingSourceMessages = normalizedMessages.slice(latestUserIndex + 1)
  const retainedTrailingToolExchangeMessages = collectLatestTrailingModelToolExchangeMessages(
    trailingSourceMessages,
  )
  const retainedTrailingToolExchangeSet = new Set(retainedTrailingToolExchangeMessages)
  const trailingMessages = trailingSourceMessages.filter(message => {
    if (retainedTrailingToolExchangeSet.has(message)) {
      return true
    }
    return (
      message.role !== AiMessageRole.TOOL
      && !hasModelToolExchange(message)
      && !isPersistedErrorMessage(message)
    )
  }).map(message => (
    retainedTrailingToolExchangeSet.has(message)
      ? compactRetainedTrailingToolExchangeMessageForContext(message, latestUserContent)
      : compactTrailingHistoryMessage(message, latestUserContent)
  ))
  const compactedMessages: AiProviderMessage[] = [
    ...systemMessages,
    ...(compactSummaryContent
      ? [{
        role: AiMessageRole.SYSTEM,
        content: compactSummaryContent,
        metadata: {
          scene: 'nocode-editor',
          providerHistoryCompacted: true,
        },
      }]
      : []),
    ...(latestAssistantStatusIndex >= 0
      ? [compactRetainedHistoryMessage(normalizedMessages[latestAssistantStatusIndex])]
      : []),
    normalizedMessages[latestUserIndex],
    ...trailingMessages,
  ]
  const afterBytes = measureUtf8JsonBytes(compactedMessages)
  const compacted = afterBytes < beforeBytes

  return {
    messages: compacted ? compactedMessages : normalizedMessages,
    compacted,
    projections: compacted
      ? [{
        strategy: 'nocode-editor-compact-older-provider-history',
        changedMessages: Math.max(0, normalizedMessages.length - compactedMessages.length),
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const buildEstimatedOpenAiTools = (actions: AiActionDefinition[]) => (
  (Array.isArray(actions) ? actions : []).map(action => ({
    type: 'function',
    function: {
      name: action.name,
      description: [
        `[${action.kind}] ${action.description}`,
        ...(action.notes || []),
      ].filter(Boolean).join('\n'),
      parameters: action.inputSchema,
    },
  }))
)

const estimateLangChainToolSchemaOverheadBytes = (actions: AiActionDefinition[]) => (
  Math.max(0, (Array.isArray(actions) ? actions.length : 0) * LANGCHAIN_TOOL_SCHEMA_ESTIMATE_OVERHEAD_BYTES)
)

const tryParseJsonObject = (value: unknown): Record<string, any> | null => {
  try {
    const parsed = JSON.parse(String(value || ''))
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

const resolveToolResultName = (message: AiProviderMessage) => (
  String(message.metadata?.modelToolExchangeResult?.name || '').trim()
)

const resolveToolCallName = (message: AiProviderMessage) => (
  String(message.metadata?.modelToolExchangeCall?.name || '').trim()
)

const buildFormSummaryKey = (
  output: Record<string, any>,
  fallback: string,
) => (
  String(output.tableId || output.tableName || fallback || '').trim()
)

const isCompactFormSummaryOutput = (output: unknown): output is Record<string, any> => (
  isPlainObject(output)
  && String(output.compactContract || '') === 'nocode-editor-form-summary@1'
)

const collectFormSummaryEntries = (messages: AiProviderMessage[]) => {
  const entries: FormSummaryEntry[] = []

  messages.forEach((message, messageIndex) => {
    if (message.role !== AiMessageRole.TOOL) return
    const toolName = resolveToolResultName(message)
    if (!FORM_SUMMARY_TOOL_NAMES.has(toolName)) return

    const parsed = tryParseJsonObject(message.content)
    if (!parsed || !isPlainObject(parsed.output)) return

    if (toolName === 'editor_get_form_summary' && isCompactFormSummaryOutput(parsed.output)) {
      const key = buildFormSummaryKey(parsed.output, `${messageIndex}`)
      if (key) {
        entries.push({ key, messageIndex })
      }
      return
    }

    const forms = Array.isArray(parsed.output.forms) ? parsed.output.forms : []
    forms.forEach((form, formIndex) => {
      if (!isCompactFormSummaryOutput(form)) return
      const key = buildFormSummaryKey(form, `${messageIndex}:${formIndex}`)
      if (key) {
        entries.push({ key, messageIndex, formIndex })
      }
    })
  })

  return entries
}

const buildLatestFormSummaryEntryIds = (entries: FormSummaryEntry[]) => {
  const latestByKey = new Map<string, FormSummaryEntry>()
  entries.forEach(entry => latestByKey.set(entry.key, entry))
  return new Set(
    Array.from(latestByKey.values()).map(entry => (
      entry.formIndex === undefined
        ? `${entry.messageIndex}`
        : `${entry.messageIndex}:${entry.formIndex}`
    )),
  )
}

const compactFormSummaryOutput = (
  output: Record<string, any>,
  options: {
    keepAvailableWidgetTypes: boolean
    keptAvailableWidgetTypesMode?: AvailableWidgetTypesProjectionMode
  },
) => {
  if (!isCompactFormSummaryOutput(output)) {
    return output
  }

  return {
    compactContract: output.compactContract,
    tableId: output.tableId,
    tableName: output.tableName,
    selectedWidgetId: output.selectedWidgetId,
    widgets: Array.isArray(output.widgets) ? output.widgets : [],
    fieldCount: output.fieldCount,
    availableWidgetTypes: options.keepAvailableWidgetTypes && Array.isArray(output.availableWidgetTypes)
      ? compactAvailableWidgetTypes(output.availableWidgetTypes, {
        mode: options.keptAvailableWidgetTypesMode || 'full',
      })
      : undefined,
    availableWidgetTypesOmitted: options.keepAvailableWidgetTypes ? undefined : true,
    summarySource: output.summarySource,
  }
}

const compactAvailableWidgetTypes = (
  value: unknown,
  options: { mode: AvailableWidgetTypesProjectionMode },
) => (
  Array.isArray(value)
    ? value.map(item => {
      const entry: Record<string, unknown> = {
        type: String(item?.type || '').trim() || undefined,
        name: String(item?.name || '').trim() || undefined,
      }
      if (options.mode !== 'type-name') {
        entry.category = String(item?.category || '').trim() || undefined
        entry.aliases = Array.isArray(item?.aliases)
          ? item.aliases
            .map((alias: unknown) => String(alias || '').trim())
            .filter(Boolean)
            .slice(0, options.mode === 'single-alias' ? 1 : undefined)
          : []
      }
      return entry
    }).filter(item => item.type || item.name)
    : []
)

const compactStructuredStringListForContext = (
  value: unknown,
  options: {
    limit: number
    maxChars: number
  },
) => (
  Array.isArray(value)
    ? value
      .map(item => truncateCompactText(item, options.maxChars))
      .filter(Boolean)
      .slice(0, options.limit)
    : []
)

const compactPlanningConfirmationForContext = (value: unknown) => {
  if (!isPlainObject(value)) {
    return undefined
  }

  const nextConfirmation: Record<string, unknown> = {
    stage: normalizeCompactText(value.stage) || undefined,
    status: normalizeCompactText(value.status) || undefined,
    preferredSurface: normalizeCompactText(value.preferredSurface) || undefined,
    completionSummary: truncateCompactText(value.completionSummary, 180) || undefined,
  }
  const resultSummary = compactStructuredStringListForContext(value.resultSummary, {
    limit: STAGED_PLANNING_CONFIRMATION_RESULT_LIMIT,
    maxChars: 120,
  })
  if (resultSummary.length) {
    nextConfirmation.resultSummary = resultSummary
  }

  const questions = Array.isArray(value.questions)
    ? value.questions.map((item) => {
      const record = isPlainObject(item) ? item : {}
      return {
        id: normalizeCompactText(record.id) || undefined,
        title: truncateCompactText(record.title, 80) || undefined,
        questionKind: normalizeCompactText(record.questionKind) || undefined,
        confirmed: record.confirmed === true ? true : undefined,
        selectedOptionValue: truncateCompactText(record.selectedOptionValue, 60) || undefined,
        answerSummary: truncateCompactText(record.answerSummary, 120) || undefined,
      }
    }).filter(item => (
      item.id
      || item.title
      || item.questionKind
      || item.confirmed
      || item.selectedOptionValue
      || item.answerSummary
    ))
    : []
  if (Array.isArray(value.questions)) {
    nextConfirmation.questions = questions
  }

  return Array.isArray(value.questions) || Object.values(nextConfirmation).some(valueItem => (
    Array.isArray(valueItem) ? valueItem.length > 0 : valueItem !== undefined
  ))
    ? nextConfirmation
    : undefined
}

const compactPlanningOutlineForContext = (value: unknown) => {
  if (!isPlainObject(value)) {
    return undefined
  }

  const forms = Array.isArray(value.forms)
    ? value.forms.map((item, index) => {
      const record = isPlainObject(item) ? item : {}
      return {
        formIndex: index + 1,
        formKey: normalizeCompactText(record.formKey) || undefined,
        tableName: normalizeCompactText(record.tableName) || undefined,
        groupName: normalizeCompactText(record.groupName) || undefined,
      }
    }).filter(item => item.formKey || item.tableName)
    : []
  const modules = Array.isArray(value.modules)
    ? value.modules.map((item) => {
      const record = isPlainObject(item) ? item : {}
      const formKeys = compactStructuredStringListForContext(record.formKeys, {
        limit: STAGED_PLANNING_MODULE_LIMIT,
        maxChars: 60,
      })
      return {
        moduleKey: normalizeCompactText(record.moduleKey) || undefined,
        name: truncateCompactText(
          typeof item === 'string' ? item : record.name,
          80,
        ) || undefined,
        formKeys: formKeys.length ? formKeys : undefined,
      }
    }).filter(item => item.moduleKey || item.name)
    : []
  const flows = Array.isArray(value.flows)
    ? value.flows.map((item) => {
      const record = isPlainObject(item) ? item : {}
      return {
        from: truncateCompactText(record.from, 80) || undefined,
        to: truncateCompactText(record.to, 80) || undefined,
        label: truncateCompactText(
          typeof item === 'string' ? item : record.label,
          60,
        ) || undefined,
      }
    }).filter(item => item.from || item.to || item.label)
      .slice(0, STAGED_PLANNING_FLOW_LIMIT)
    : []
  const openQuestions = compactStructuredStringListForContext(value.openQuestions, {
    limit: STAGED_PLANNING_TOOL_OPEN_QUESTION_LIMIT,
    maxChars: 120,
  })
  const confirmation = compactPlanningConfirmationForContext(value.confirmation)

  const nextOutline: Record<string, unknown> = {
    id: normalizeCompactText(value.id) || undefined,
    title: truncateCompactText(value.title, 120) || undefined,
    summary: truncateCompactText(value.summary, 220) || undefined,
    forms: forms.length ? forms : undefined,
    modules: modules.length ? modules : undefined,
    flows: flows.length ? flows : undefined,
    openQuestions: Array.isArray(value.openQuestions) ? openQuestions : undefined,
    confirmation,
  }

  return Array.isArray(value.openQuestions) || Object.values(nextOutline).some(valueItem => (
    Array.isArray(valueItem) ? valueItem.length > 0 : valueItem !== undefined
  ))
    ? nextOutline
    : undefined
}

const compactStagedAppPlanForContext = (plan: unknown) => {
  if (!isPlainObject(plan)) {
    return undefined
  }

  const objects = compactStructuredStringListForContext(plan.objects, {
    limit: STAGED_PLANNING_OBJECT_LIMIT,
    maxChars: 60,
  })
  const artifacts = compactPlanningArtifactsForContext(plan.artifacts)
  const openQuestions = compactStructuredStringListForContext(plan.openQuestions, {
    limit: STAGED_PLANNING_TOOL_OPEN_QUESTION_LIMIT,
    maxChars: 120,
  })

  return {
    id: normalizeCompactText(plan.id) || undefined,
    mode: normalizeCompactText(plan.mode) || undefined,
    goal: truncateCompactText(plan.goal, 220) || undefined,
    objects: objects.length ? objects : undefined,
    artifacts: artifacts.length ? artifacts : undefined,
    openQuestions: openQuestions.length ? openQuestions : undefined,
    confirmation: compactPlanningConfirmationForContext(plan.confirmation),
    outline: compactPlanningOutlineForContext(plan.outline),
  }
}

const compactStagedAppPlanToolCallInputForContext = (plan: unknown) => {
  if (!isPlainObject(plan)) {
    return undefined
  }

  const outline = isPlainObject(plan.outline) ? plan.outline : {}
  const forms = Array.isArray(outline.forms)
    ? outline.forms.map((item, index) => {
      const record = isPlainObject(item) ? item : {}
      return {
        formIndex: index + 1,
        tableName: normalizeCompactText(record.tableName) || undefined,
      }
    }).filter(item => item.tableName)
    : []
  const objectCount = Array.isArray(plan.objects)
    ? plan.objects.filter(item => normalizeCompactText(item)).length
    : 0
  const artifactCount = Array.isArray(plan.artifacts)
    ? plan.artifacts.filter(item => {
      const record = isPlainObject(item) ? item : {}
      return Boolean(normalizeCompactText(record.name || item))
    }).length
    : 0
  const openQuestionCount = Array.isArray(plan.openQuestions)
    ? plan.openQuestions.filter(item => normalizeCompactText(item)).length
    : 0
  const moduleCount = Array.isArray(outline.modules)
    ? outline.modules.length
    : 0
  const flowCount = Array.isArray(outline.flows)
    ? outline.flows.length
    : 0

  return {
    id: normalizeCompactText(plan.id) || undefined,
    mode: normalizeCompactText(plan.mode) || undefined,
    goal: truncateCompactText(plan.goal, 140) || undefined,
    objectCount: objectCount || undefined,
    artifactCount: artifactCount || undefined,
    openQuestionCount: openQuestionCount || undefined,
    outline: {
      title: truncateCompactText(outline.title, 120) || undefined,
      summary: truncateCompactText(outline.summary, 120) || undefined,
      forms: forms.length ? forms : undefined,
      moduleCount: moduleCount || undefined,
      flowCount: flowCount || undefined,
    },
  }
}

const compactPlanningArtifactsForContext = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item) => {
      const record = isPlainObject(item) ? item : {}
      return {
        type: normalizeCompactText(record.type) || undefined,
        name: truncateCompactText(record.name, 80) || undefined,
        executionLevel: normalizeCompactText(record.executionLevel) || undefined,
      }
    }).filter(item => item.type || item.name)
      .slice(0, STAGED_PLANNING_ARTIFACT_LIMIT)
    : []
)

const compactFormulaPlanForContext = (value: unknown) => {
  const plan = isPlainObject(value) ? value : {}
  const items = Array.isArray(plan.items)
    ? plan.items.filter(isPlainObject).map(item => ({
      itemKey: normalizeCompactText(item.itemKey),
      target: {
        ...(normalizeCompactText(item.target?.formKey) ? { formKey: normalizeCompactText(item.target?.formKey) } : {}),
        ...(normalizeCompactText(item.target?.formName) ? { formName: normalizeCompactText(item.target?.formName) } : {}),
        ...(normalizeCompactText(item.target?.fieldKey) ? { fieldKey: normalizeCompactText(item.target?.fieldKey) } : {}),
        fieldName: normalizeCompactText(item.target?.fieldName),
      },
      formulaSettings: Array.isArray(item.formulaSettings)
        ? item.formulaSettings.filter(isPlainObject).map(setting => ({
          formulaPath: normalizeCompactText(setting.formulaPath),
          formula: String(setting.formula || '').trim(),
          ...(normalizeCompactText(setting.explanation) ? { explanation: truncateCompactText(setting.explanation, 180) } : {}),
        }))
        : [],
    })).filter(item => item.itemKey && item.target.fieldName && item.formulaSettings.length)
    : []
  const confirmation = isPlainObject(plan.confirmation)
    ? {
      stage: normalizeCompactText(plan.confirmation.stage),
      status: normalizeCompactText(plan.confirmation.status),
      questions: Array.isArray(plan.confirmation.questions)
        ? plan.confirmation.questions.filter(isPlainObject).map(question => ({
          title: truncateCompactText(question.title, 160),
          status: normalizeCompactText(question.status),
        })).filter(question => question.title)
        : [],
    }
    : null

  return {
    title: truncateCompactText(plan.title, 120),
    summary: truncateCompactText(plan.summary, 180),
    executionIntent: normalizeCompactText(plan.executionIntent),
    items,
    openQuestions: Array.isArray(plan.openQuestions)
      ? plan.openQuestions.map(item => truncateCompactText(item, 160)).filter(Boolean).slice(0, STAGED_PLANNING_TOOL_OPEN_QUESTION_LIMIT)
      : [],
    confirmation,
  }
}

const compactFormulaStageOutputForContext = (output: Record<string, any>) => {
  const sourceContext = isPlainObject(output.sourceContext) ? output.sourceContext : {}
  return {
    ContextProjected: true,
    origin: normalizeCompactText(output.origin),
    planningScope: normalizeCompactText(output.planningScope),
    revision: Math.max(0, Math.round(Number(output.revision || 0))),
    stagedAt: Math.max(0, Math.round(Number(output.stagedAt || 0))),
    formulaPlanFingerprint: normalizeCompactText(output.formulaPlanFingerprint),
    sourceContext: {
      taskScopeKey: normalizeCompactText(sourceContext.taskScopeKey),
      nocodeId: normalizeCompactText(sourceContext.nocodeId),
      formId: normalizeCompactText(sourceContext.formId),
      ...(Number.isFinite(Number(sourceContext.draftRevision)) ? { draftRevision: Number(sourceContext.draftRevision) } : {}),
      evidenceFingerprint: normalizeCompactText(sourceContext.evidenceFingerprint),
      capturedAt: Math.max(0, Math.round(Number(sourceContext.capturedAt || 0))),
    },
    plan: compactFormulaPlanForContext(output.plan),
    formulaAdvance: normalizeCompactText(output.formulaAdvance),
    displayMode: normalizeCompactText(output.displayMode),
    preflight: isPlainObject(output.preflight)
      ? {
        resolvedWriteCount: Math.max(0, Math.round(Number(output.preflight.resolvedWriteCount || 0))),
        issueCount: Math.max(0, Math.round(Number(output.preflight.issueCount || 0))),
      }
      : undefined,
  }
}

export const projectNocodeEditorTaskSummaryForProvider = (value: unknown) => {
  if (!isPlainObject(value)) {
    return value
  }

  const entryFlowIntent = isPlainObject(value.entryFlowIntent)
    ? value.entryFlowIntent
    : null
  const projectShortList = (items: unknown, itemLimit: number, itemChars: number) => (
    Array.isArray(items)
      ? items
        .map(item => truncateCompactText(item, itemChars))
        .filter(Boolean)
        .slice(0, itemLimit)
      : []
  )
  const projectedSummary: Record<string, unknown> = {
    ...value,
    userGoal: truncateCompactText(value.userGoal, 120),
    planningSummary: truncateCompactText(value.planningSummary, 1200),
    flowSummary: truncateCompactText(value.flowSummary, 480),
    planningOpenQuestions: projectShortList(value.planningOpenQuestions, 24, 180),
    planningConfirmationQuestions: projectShortList(value.planningConfirmationQuestions, 12, 180),
    planningConfirmationResultSummary: projectShortList(value.planningConfirmationResultSummary, 12, 180),
    openQuestions: projectShortList(value.openQuestions, 24, 180),
    entryFlowIntent: entryFlowIntent
      ? {
        ...entryFlowIntent,
        sourceUserMessage: String(entryFlowIntent.state || '').trim() === 'none'
          ? ''
          : truncateCompactText(entryFlowIntent.sourceUserMessage, 240),
        evidence: projectShortList(entryFlowIntent.evidence, 8, 180),
        targetFormName: truncateCompactText(entryFlowIntent.targetFormName, 120) || undefined,
      }
      : value.entryFlowIntent,
  }
  const formulaPlan = isPlainObject(value.formulaPlan)
    ? value.formulaPlan
    : null
  if (!formulaPlan) {
    return projectedSummary
  }

  const sourceContext = isPlainObject(formulaPlan.sourceContext)
    ? formulaPlan.sourceContext
    : {}
  return {
    ...projectedSummary,
    formulaPlan: {
      origin: normalizeCompactText(formulaPlan.origin),
      planningScope: normalizeCompactText(formulaPlan.planningScope),
      revision: Math.max(0, Math.round(Number(formulaPlan.revision || 0))),
      stagedAt: Math.max(0, Math.round(Number(formulaPlan.stagedAt || 0))),
      formulaPlanFingerprint: normalizeCompactText(formulaPlan.formulaPlanFingerprint),
      sourceContext: {
        taskScopeKey: normalizeCompactText(sourceContext.taskScopeKey),
        nocodeId: normalizeCompactText(sourceContext.nocodeId),
        formId: normalizeCompactText(sourceContext.formId),
        ...(Number.isFinite(Number(sourceContext.draftRevision)) ? { draftRevision: Number(sourceContext.draftRevision) } : {}),
        evidenceFingerprint: normalizeCompactText(sourceContext.evidenceFingerprint),
      },
      plan: compactFormulaPlanForContext(formulaPlan.plan),
      confirmation: isPlainObject(formulaPlan.confirmation)
        ? compactFormulaPlanForContext({ confirmation: formulaPlan.confirmation }).confirmation
        : null,
    },
  }
}

const getCompactionMessageKey = (message: AiProviderMessage) => JSON.stringify([
  message.role,
  message.content,
  message.toolCallId,
  getModelToolExchangeCallId(message),
  getModelToolExchangeResultCallId(message),
])

export const retainNocodeEditorStructuredMessagesAfterCompaction = (input: {
  sourceMessages: AiProviderMessage[]
  projectedMessages: AiProviderMessage[]
}) => {
  const sourceMessages = Array.isArray(input.sourceMessages) ? input.sourceMessages : []
  const projectedMessages = Array.isArray(input.projectedMessages) ? input.projectedMessages : []
  const retainedKeys = new Set<string>()
  const retainedMessages: AiProviderMessage[] = []

  const retain = (message: AiProviderMessage) => {
    const projectedMessage = projectNocodeEditorProviderMessagesForContext([message]).messages[0] || message
    const key = getCompactionMessageKey(projectedMessage)
    if (retainedKeys.has(key)) return
    retainedKeys.add(key)
    retainedMessages.push(projectedMessage)
  }

  sourceMessages.forEach((message) => {
    if (
      message.metadata?.derivedTaskSummary === true
      || message.metadata?.derivedBlueprintApplyGate === true
      || message.metadata?.attachmentCatalog === true
    ) {
      retain(message)
    }
  })

  collectLatestTrailingModelToolExchangeMessages(sourceMessages)
    .filter((message) => {
      const toolName = message.metadata?.modelToolExchangeCall?.name
        || message.metadata?.modelToolExchangeResult?.name
      return NOCODE_EDITOR_COMPACTION_CRITICAL_TOOL_NAMES.has(String(toolName || '').trim())
    })
    .forEach(retain)

  if (!retainedMessages.length) {
    return projectedMessages
  }

  const projectedKeys = new Set(projectedMessages.map(getCompactionMessageKey))
  const uniqueRetained = retainedMessages.filter(message => !projectedKeys.has(getCompactionMessageKey(message)))
  if (!uniqueRetained.length) {
    return projectedMessages
  }

  const summaryMessages = projectedMessages.filter(message => (
    message.metadata?.contextCompaction === true
  ))
  const recentMessages = projectedMessages.filter(message => (
    message.metadata?.contextCompaction !== true
  ))
  return [...summaryMessages, ...uniqueRetained, ...recentMessages]
}

const compactStagedPlanningToolOutputForContext = (
  toolName: string,
  output: Record<string, any>,
) => {
  if (toolName === APP_PLAN_TOOL_NAME) {
    const plan = compactStagedAppPlanForContext(output.plan)
    if (!plan) {
      return output
    }

    return {
      ...output,
      ContextProjected: true,
      plan,
    }
  }

  if (toolName === SINGLE_FORM_PLAN_TOOL_NAME) {
    const nextOutline = compactPlanningOutlineForContext(
      normalizeNocodeEditorPlanningOutline(output.outline, {
        confirmationStage: 'form-plan',
        legacyConfirmation: output.confirmation,
        legacyOpenQuestions: [
          ...(Array.isArray(output.openQuestions) ? output.openQuestions : []),
          ...(Array.isArray(output.open_questions) ? output.open_questions : []),
        ],
        legacyOpenQuestionsMode: 'fallback-only',
      }),
    )
    if (!nextOutline) {
      return output
    }
    const nextOutput: Record<string, any> = {
      ...output,
      ContextProjected: true,
      outline: nextOutline,
    }
    delete nextOutput.confirmation
    delete nextOutput.openQuestions
    delete nextOutput.open_questions
    return nextOutput
  }

  if (toolName === FORMULA_STAGE_TOOL_NAME) {
    return compactFormulaStageOutputForContext(output)
  }

  return output
}

const compactStagedPlanningToolCallInputForContext = (
  toolName: string,
  input: Record<string, any>,
) => {
  if (toolName === APP_PLAN_TOOL_NAME) {
    const plan = compactStagedAppPlanToolCallInputForContext(input.plan)
    return plan
      ? {
        ...input,
        plan,
      }
      : input
  }

  if (toolName === SINGLE_FORM_PLAN_TOOL_NAME) {
    const outline = compactPlanningOutlineForContext(
      normalizeNocodeEditorPlanningOutline(input.outline, {
        confirmationStage: 'form-plan',
        legacyConfirmation: input.confirmation,
        legacyOpenQuestions: [
          ...(Array.isArray(input.openQuestions) ? input.openQuestions : []),
          ...(Array.isArray(input.open_questions) ? input.open_questions : []),
        ],
        legacyOpenQuestionsMode: 'fallback-only',
      }),
    )
    if (!outline) {
      return input
    }
    const nextInput: Record<string, any> = {
      ...input,
      outline,
    }
    delete nextInput.confirmation
    delete nextInput.openQuestions
    delete nextInput.open_questions
    return nextInput
  }

  return input
}

const normalizeBlueprintContextMatchText = (value: unknown) => (
  normalizeCompactText(value).replace(/\s+/g, '')
)

const parseChineseBlueprintOrdinal = (value: string) => {
  const text = String(value || '').trim()
  if (!text) {
    return null
  }
  if (text === '\u5341') {
    return 10
  }

  const tenIndex = text.indexOf('\u5341')
  if (tenIndex >= 0) {
    const tensToken = tenIndex > 0 ? text.slice(0, tenIndex) : '\u4e00'
    const onesToken = tenIndex < text.length - 1 ? text.slice(tenIndex + 1) : ''
    const tens = CHINESE_ORDINAL_DIGIT_MAP[tensToken]
    const ones = onesToken ? CHINESE_ORDINAL_DIGIT_MAP[onesToken] : 0
    if (tens === undefined || (onesToken && ones === undefined)) {
      return null
    }
    return (tens * 10) + ones
  }

  const digit = CHINESE_ORDINAL_DIGIT_MAP[text]
  return digit === undefined ? null : digit
}

const extractBlueprintFocusedFormOrdinals = (value: unknown) => {
  const text = String(value || '')
  const indexes = new Set<number>()
  const pattern = /\u7b2c\s*([0-9]{1,3}|[\u96f6\u3007\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]{1,4})\s*(?:\u4e2a|\u5f20|\u5957|\u4efd|\u8868|\u8868\u5355|\u6a21\u5757)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const rawValue = String(match[1] || '').trim()
    const arabic = Number(rawValue)
    if (Number.isFinite(arabic) && arabic > 0) {
      indexes.add(Math.round(arabic))
      continue
    }

    const chineseValue = parseChineseBlueprintOrdinal(rawValue)
    if (chineseValue && chineseValue > 0) {
      indexes.add(chineseValue)
    }
  }
  return indexes
}

const collectContextProjectedBlueprintFieldNames = (
  fields: unknown,
  parentPath = '',
): string[] => (
  Array.isArray(fields)
    ? fields.flatMap((field) => {
      const fieldRecord = isPlainObject(field) ? field : {}
      const fieldName = normalizeCompactText(
        typeof field === 'string'
          ? field
          : fieldRecord.name,
      )
      const currentPath = [parentPath, fieldName].filter(Boolean).join('.')
      const childNames = collectContextProjectedBlueprintFieldNames(
        fieldRecord.children,
        currentPath,
      )
      return currentPath ? [currentPath, ...childNames] : childNames
    })
    : []
)

const collectContextProjectedBlueprintFieldEntries = (
  fields: unknown,
  parentPath = '',
): Array<Record<string, string>> => (
  Array.isArray(fields)
    ? fields.flatMap((field) => {
      const fieldRecord = isPlainObject(field) ? field : {}
      const fieldName = normalizeCompactText(
        typeof field === 'string'
          ? field
          : fieldRecord.name,
      )
      const currentPath = [parentPath, fieldName].filter(Boolean).join('.')
      const childEntries = collectContextProjectedBlueprintFieldEntries(
        fieldRecord.children,
        currentPath,
      )
      const widgetType = normalizeCompactText(fieldRecord.widgetType || fieldRecord.type)
      const currentEntry = currentPath
        ? [{
          name: currentPath,
          ...(widgetType ? { widgetType } : {}),
        }]
        : []
      return [...currentEntry, ...childEntries]
    })
    : []
)

const extractBlueprintContextFieldKeywords = (
  value: unknown,
) => (
  Array.from(new Set(
    String(value || '')
      .split(/[\s,.;:!?\uFF0C\u3002\uFF1B\uFF1A\u3001\uFF01\uFF1F()\/+\-\n]+/g)
      .map(item => normalizeBlueprintContextMatchText(item))
      .filter(item => item.length >= 2 && item.length <= 24),
  ))
)

const filterContextProjectedFocusedFieldNamesForLatestUser = (
  fieldNames: string[],
  latestUserContent: string,
  fallbackCount: number,
) => {
  const normalizedFields = fieldNames
    .map(fieldName => ({
      raw: fieldName,
      normalized: normalizeBlueprintContextMatchText(fieldName),
    }))
    .filter(item => item.normalized)
  if (!normalizedFields.length) {
    return fieldNames
  }

  const keywords = extractBlueprintContextFieldKeywords(latestUserContent)
  const matchedFields = normalizedFields.filter(({ normalized }) => (
    keywords.some(keyword => (
      normalized.includes(keyword)
      || keyword.includes(normalized)
    ))
  ))
  if (matchedFields.length > 0) {
    return matchedFields.map(item => item.raw)
  }

  return normalizedFields
    .slice(0, Math.max(1, fallbackCount))
    .map(item => item.raw)
}

const resolveBlueprintContextFocusedFormIndexes = (
  forms: unknown,
  latestUserContent: string,
) => {
  const formList = Array.isArray(forms) ? forms : []
  const latestUserMatchText = normalizeBlueprintContextMatchText(latestUserContent)
  const indexes = extractBlueprintFocusedFormOrdinals(latestUserContent)

  formList.forEach((form, index) => {
    const formRecord = isPlainObject(form) ? form : {}
    const tableName = normalizeBlueprintContextMatchText(formRecord.tableName)
    const groupName = normalizeBlueprintContextMatchText(formRecord.groupName)
    if (
      (tableName && latestUserMatchText.includes(tableName))
      || (groupName && latestUserMatchText.includes(groupName))
    ) {
      indexes.add(index + 1)
    }
  })

  return indexes
}

const projectStagedPlanningToolMessageForContext = (
  message: AiProviderMessage,
) => {
  if (message.role !== AiMessageRole.TOOL) {
    return message
  }

  const toolName = resolveToolResultName(message)
  if (!STAGED_PLANNING_TOOL_NAMES.has(toolName)) {
    return message
  }

  const parsed = tryParseJsonObject(message.content)
  if (!parsed || !isPlainObject(parsed.output)) {
    return message
  }

  const nextOutput = compactStagedPlanningToolOutputForContext(toolName, parsed.output)
  const nextContent = JSON.stringify({
    ...parsed,
    output: nextOutput,
  })
  const toolResult = isPlainObject(message.metadata?.modelToolExchangeResult)
    ? message.metadata?.modelToolExchangeResult
    : null
  const nextMetadataOutput = isPlainObject(toolResult?.output)
    ? compactStagedPlanningToolOutputForContext(toolName, toolResult.output)
    : null
  const hasMetadataChange = Boolean(
    toolResult
    && nextMetadataOutput
    && JSON.stringify(nextMetadataOutput) !== JSON.stringify(toolResult.output),
  )

  return nextContent === message.content && !hasMetadataChange
    ? message
    : {
      ...message,
      content: nextContent,
      ...(hasMetadataChange
        ? {
          metadata: {
            ...message.metadata,
            modelToolExchangeResult: {
              ...toolResult,
              output: nextMetadataOutput,
            },
          },
        }
        : {}),
    }
}

export const projectStagedPlanningToolMessagesForContext = (
  messages: AiProviderMessage[],
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const projectedMessages = normalizedMessages.map(projectStagedPlanningToolMessageForContext)
  const changedMessages = projectedMessages.filter((message, index) => (
    message.content !== normalizedMessages[index]?.content
  )).length
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: 'nocode-editor-staged-planning-tool-result-compaction',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const projectStagedPlanningToolCallMessageForContext = (
  message: AiProviderMessage,
) => {
  if (message.role !== AiMessageRole.ASSISTANT) {
    return message
  }

  const toolCall = message.metadata?.modelToolExchangeCall
  if (!toolCall) {
    return message
  }

  const toolName = resolveToolCallName(message)
  if (!STAGED_PLANNING_TOOL_NAMES.has(toolName) || !isPlainObject(toolCall.input)) {
    return message
  }

  const nextInput = compactStagedPlanningToolCallInputForContext(toolName, toolCall.input)
  if (JSON.stringify(nextInput) === JSON.stringify(toolCall.input)) {
    return message
  }

  return {
    ...message,
    metadata: {
      ...message.metadata,
      modelToolExchangeCall: {
        ...toolCall,
        input: nextInput,
      },
    },
  }
}

const projectStagedPlanningToolCallMessagesForContext = (
  messages: AiProviderMessage[],
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const projectedMessages = normalizedMessages.map(projectStagedPlanningToolCallMessageForContext)
  const changedMessages = projectedMessages.filter((message, index) => (
    JSON.stringify(message) !== JSON.stringify(normalizedMessages[index])
  )).length
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: 'nocode-editor-staged-planning-tool-call-compaction',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const compactStagedBlueprintToolOutputForContext = (
  output: Record<string, any>,
  latestUserContent: string,
  options: StagedBlueprintContextProjectionOptions = {},
) => {
  const blueprint = isPlainObject(output.blueprint) ? output.blueprint : null
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  const compactContract = String(output.compactContract || '').trim()
  const detail = String(output.detail || '').trim()
  const hasCompactStructureContract = (
    compactContract === 'nocode-editor-blueprint@1'
    && detail === 'structure'
  )
  const hasRawBlueprintStructure = Boolean(!compactContract && blueprint && forms.length)
  if (!hasCompactStructureContract && !hasRawBlueprintStructure) {
    return output
  }
  if (!blueprint || !forms.length) {
    return output
  }

  const focusedIndexes = resolveBlueprintContextFocusedFormIndexes(forms, latestUserContent)
  const explicitFocusedIndexes = extractBlueprintFocusedFormOrdinals(latestUserContent)
  const focusedFieldProjection = options.focusedFieldProjection || 'entries'
  const focusedFieldFallbackCount = Math.max(
    1,
    Math.round(Number(options.focusedFieldFallbackCount || 2)),
  )

  return {
    ...output,
    ContextProjected: true,
    blueprint: {
      id: String(blueprint.id || '').trim() || undefined,
      title: String(blueprint.title || '').trim() || undefined,
      summary: truncateCompactText(blueprint.summary, 220) || undefined,
      forms: forms.map((form, index) => {
        const formRecord = isPlainObject(form) ? form : {}
        const fields = formRecord.fields
        const flattenedFieldNames = collectContextProjectedBlueprintFieldNames(fields)
        const focused = focusedIndexes.has(index + 1)
        const minimizeNonFocusedMetadata = Boolean(
          options.omitNonFocusedFields
          && !focused,
        )
        const filterFocusedFieldsByLatestUser = Boolean(
          options.filterFocusedFieldsByLatestUser
          && focused
          && !explicitFocusedIndexes.has(index + 1),
        )
        const focusedFieldNames = filterFocusedFieldsByLatestUser
          ? filterContextProjectedFocusedFieldNamesForLatestUser(
            flattenedFieldNames,
            latestUserContent,
            focusedFieldFallbackCount,
          )
          : flattenedFieldNames
        const projectedFields = focused
          ? (
            focusedFieldProjection === 'names'
              ? focusedFieldNames
              : collectContextProjectedBlueprintFieldEntries(fields)
          )
          : (
            options.omitNonFocusedFields
              ? null
              : flattenedFieldNames
          )
        return {
          formIndex: index + 1,
          tableName: String(formRecord.tableName || '').trim() || undefined,
          ...(minimizeNonFocusedMetadata
            ? {}
            : {
              formKey: String(formRecord.formKey || '').trim() || undefined,
              groupName: String(formRecord.groupName || '').trim() || undefined,
              fieldCount: Number(formRecord.fieldCount || flattenedFieldNames.length || 0) || 0,
            }),
          ...(projectedFields === null ? {} : { fields: projectedFields }),
        }
      }),
      openQuestions: Array.isArray(blueprint.openQuestions)
        ? blueprint.openQuestions
          .map(item => normalizeCompactText(item))
          .filter(Boolean)
          .slice(0, STAGED_BLUEPRINT_TOOL_OPEN_QUESTION_LIMIT)
        : undefined,
    },
  }
}

const projectStagedBlueprintToolMessageForContext = (
  message: AiProviderMessage,
  latestUserContent: string,
  options: StagedBlueprintContextProjectionOptions = {},
) => {
  if (message.role !== AiMessageRole.TOOL) {
    return message
  }
  if (!STAGED_BLUEPRINT_TOOL_NAMES.has(resolveToolResultName(message))) {
    return message
  }

  const parsed = tryParseJsonObject(message.content)
  if (!parsed || !isPlainObject(parsed.output)) {
    return message
  }

  const nextOutput = compactStagedBlueprintToolOutputForContext(
    parsed.output,
    latestUserContent,
    options,
  )
  const nextContent = JSON.stringify({
    ...parsed,
    output: nextOutput,
  })

  return nextContent === message.content
    ? message
    : {
      ...message,
      content: nextContent,
    }
}

export const projectStagedBlueprintToolMessagesForContext = (
  messages: AiProviderMessage[],
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const latestUserIndex = findLatestUserMessageIndex(normalizedMessages)
  const latestUserContent = latestUserIndex >= 0
    ? String(normalizedMessages[latestUserIndex]?.content || '')
    : ''
  const projectedMessages = normalizedMessages.map(message => (
    projectStagedBlueprintToolMessageForContext(message, latestUserContent)
  ))
  const changedMessages = projectedMessages.filter((message, index) => (
    message.content !== normalizedMessages[index]?.content
  )).length
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: 'nocode-editor-staged-blueprint-tool-result-compaction',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const compactStagedBlueprintDefinitionForContext = (
  blueprint: Record<string, any>,
  latestUserContent: string,
) => {
  const projected = compactStagedBlueprintToolOutputForContext(
    {
      blueprint,
    },
    latestUserContent,
    {
      omitNonFocusedFields: true,
      focusedFieldProjection: 'names',
      filterFocusedFieldsByLatestUser: true,
      focusedFieldFallbackCount: 2,
    },
  )

  return isPlainObject(projected.blueprint)
    ? projected.blueprint
    : blueprint
}

const compactStagedBlueprintPlanValueForContext = (
  value: unknown,
  latestUserContent: string,
) => {
  const parsed = typeof value === 'string'
    ? tryParseJsonObject(value)
    : isPlainObject(value)
      ? value
      : null
  if (!parsed) {
    return value
  }

  if (isPlainObject(parsed.blueprint)) {
    return {
      ...parsed,
      blueprint: compactStagedBlueprintDefinitionForContext(parsed.blueprint, latestUserContent),
    }
  }

  if (Array.isArray(parsed.forms)) {
    return compactStagedBlueprintDefinitionForContext(parsed as Record<string, any>, latestUserContent)
  }

  return value
}

const compactStagedBlueprintToolCallInputForContext = (
  input: Record<string, any>,
  latestUserContent: string,
) => {
  let changed = false
  const nextInput = {
    ...input,
  }

  if (isPlainObject(input.blueprint)) {
    const nextBlueprint = compactStagedBlueprintDefinitionForContext(input.blueprint, latestUserContent)
    if (JSON.stringify(nextBlueprint) !== JSON.stringify(input.blueprint)) {
      nextInput.blueprint = nextBlueprint
      changed = true
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'plan')) {
    const nextPlan = compactStagedBlueprintPlanValueForContext(input.plan, latestUserContent)
    if (JSON.stringify(nextPlan) !== JSON.stringify(input.plan)) {
      nextInput.plan = nextPlan
      changed = true
    }
  }

  return changed ? nextInput : input
}

const projectStagedBlueprintToolCallMessageForContext = (
  message: AiProviderMessage,
  latestUserContent: string,
) => {
  if (message.role !== AiMessageRole.ASSISTANT) {
    return message
  }

  const toolCall = message.metadata?.modelToolExchangeCall
  if (!toolCall) {
    return message
  }

  const toolName = resolveToolCallName(message)
  if (!STAGED_BLUEPRINT_TOOL_CALL_NAMES.has(toolName) || !isPlainObject(toolCall.input)) {
    return message
  }

  const nextInput = compactStagedBlueprintToolCallInputForContext(toolCall.input, latestUserContent)
  if (JSON.stringify(nextInput) === JSON.stringify(toolCall.input)) {
    return message
  }

  return {
    ...message,
    metadata: {
      ...message.metadata,
      modelToolExchangeCall: {
        ...toolCall,
        input: nextInput,
      },
    },
  }
}

const projectStagedBlueprintToolCallMessagesForContext = (
  messages: AiProviderMessage[],
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const latestUserIndex = findLatestUserMessageIndex(normalizedMessages)
  const latestUserContent = latestUserIndex >= 0
    ? String(normalizedMessages[latestUserIndex]?.content || '')
    : ''
  const projectedMessages = normalizedMessages.map(message => (
    projectStagedBlueprintToolCallMessageForContext(message, latestUserContent)
  ))
  const changedMessages = projectedMessages.filter((message, index) => (
    JSON.stringify(message) !== JSON.stringify(normalizedMessages[index])
  )).length
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: 'nocode-editor-staged-blueprint-tool-call-compaction',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const projectToolMessage = (
  message: AiProviderMessage,
  messageIndex: number,
  latestEntryIds: Set<string>,
  options: {
    compactKeptAvailableWidgetTypes?: boolean
    keptAvailableWidgetTypesMode?: AvailableWidgetTypesProjectionMode
  } = {},
) => {
  if (message.role !== AiMessageRole.TOOL) return message
  const toolName = resolveToolResultName(message)
  if (!FORM_SUMMARY_TOOL_NAMES.has(toolName)) return message

  const parsed = tryParseJsonObject(message.content)
  if (!parsed || !isPlainObject(parsed.output)) return message

  let nextOutput = parsed.output
  if (toolName === 'editor_get_form_summary') {
    nextOutput = compactFormSummaryOutput(parsed.output, {
      keepAvailableWidgetTypes: latestEntryIds.has(`${messageIndex}`),
      keptAvailableWidgetTypesMode: options.keptAvailableWidgetTypesMode
        || (options.compactKeptAvailableWidgetTypes ? 'single-alias' : 'full'),
    })
  } else if (Array.isArray(parsed.output.forms)) {
    nextOutput = {
      ...parsed.output,
      forms: parsed.output.forms.map((form: unknown, formIndex: number) => (
        isPlainObject(form)
          ? compactFormSummaryOutput(form, {
            keepAvailableWidgetTypes: latestEntryIds.has(`${messageIndex}:${formIndex}`),
            keptAvailableWidgetTypesMode: options.keptAvailableWidgetTypesMode
              || (options.compactKeptAvailableWidgetTypes ? 'single-alias' : 'full'),
          })
          : form
      )),
    }
  }

  const nextContent = JSON.stringify({
    ...parsed,
    output: nextOutput,
  })

  return nextContent === message.content
    ? message
    : {
      ...message,
      content: nextContent,
    }
}

const projectFormSummaryToolMessagesForContext = (
  messages: AiProviderMessage[],
  options: {
    compactKeptAvailableWidgetTypes?: boolean
    keptAvailableWidgetTypesMode?: AvailableWidgetTypesProjectionMode
  } = {},
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const latestEntryIds = buildLatestFormSummaryEntryIds(collectFormSummaryEntries(normalizedMessages))
  const projectedMessages = normalizedMessages.map((message, index) => (
    projectToolMessage(message, index, latestEntryIds, options)
  ))
  const changedMessages = projectedMessages.filter((message, index) => (
    message.content !== normalizedMessages[index]?.content
  )).length
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: options.keptAvailableWidgetTypesMode === 'type-name'
          ? 'nocode-editor-form-summary-type-name-capabilities'
          : options.compactKeptAvailableWidgetTypes || options.keptAvailableWidgetTypesMode === 'single-alias'
            ? 'nocode-editor-form-summary-compact-kept-capabilities'
            : 'nocode-editor-form-summary-capability-retention',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const isRedundantSameTurnPrereadSummaryMessage = (
  message: AiProviderMessage,
  prereadResultCallId: string,
) => {
  if (message.role !== AiMessageRole.ASSISTANT) {
    return false
  }
  if (message.metadata?.toolResultSummary !== true) {
    return false
  }
  if (String(message.metadata?.summaryStage || '').trim() !== 'plain-assistant') {
    return false
  }
  const toolName = String(message.metadata?.toolName || '').trim()
  if (toolName && toolName !== 'editor_get_staged_app_blueprint') {
    return false
  }
  const actionId = String(message.metadata?.actionId || '').trim()
  if (prereadResultCallId && actionId && actionId !== prereadResultCallId) {
    return false
  }
  return true
}

export const projectSameTurnPrereadCarryoverMessagesForContext = (
  messages: AiProviderMessage[],
  options: {
    filterFocusedFieldsByLatestUser?: boolean
  } = {},
) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const beforeBytes = measureUtf8JsonBytes(normalizedMessages)
  const latestUserIndex = findLatestUserMessageIndex(normalizedMessages)
  if (latestUserIndex < 0) {
    return {
      messages: normalizedMessages,
      compacted: false,
      projections: [],
    }
  }

  const latestUserContent = String(normalizedMessages[latestUserIndex]?.content || '')
  const trailingSourceMessages = normalizedMessages.slice(latestUserIndex + 1)
  const retainedTrailingToolExchangeMessages = collectLatestTrailingModelToolExchangeMessages(
    trailingSourceMessages,
  )
  const retainedTrailingToolExchangeSet = new Set(retainedTrailingToolExchangeMessages)
  const prereadResultIndex = normalizedMessages.findLastIndex((message, index) => (
    index > latestUserIndex
    && retainedTrailingToolExchangeSet.has(message)
    && message.role === AiMessageRole.TOOL
    && resolveToolResultName(message) === 'editor_get_staged_app_blueprint'
  ))

  if (prereadResultIndex < 0) {
    return {
      messages: normalizedMessages,
      compacted: false,
      projections: [],
    }
  }

  const prereadResultCallId = getModelToolExchangeResultCallId(
    normalizedMessages[prereadResultIndex],
  )
  let changedMessages = 0
  let allowSummaryDrop = false
  const projectedMessages = normalizedMessages.flatMap((message, index) => {
    if (index === prereadResultIndex) {
      allowSummaryDrop = true
        const nextMessage = projectStagedBlueprintToolMessageForContext(
          message,
          latestUserContent,
          {
            omitNonFocusedFields: true,
            focusedFieldProjection: 'names',
            filterFocusedFieldsByLatestUser: options.filterFocusedFieldsByLatestUser,
            focusedFieldFallbackCount: 2,
          },
        )
        if (nextMessage.content !== message.content) {
          changedMessages += 1
      }
      return [nextMessage]
    }

    if (
      allowSummaryDrop
      && index > prereadResultIndex
      && isRedundantSameTurnPrereadSummaryMessage(message, prereadResultCallId)
    ) {
      changedMessages += 1
      return []
    }

    allowSummaryDrop = false
    return [message]
  })
  const afterBytes = measureUtf8JsonBytes(projectedMessages)

  return {
    messages: projectedMessages,
    compacted: changedMessages > 0,
    projections: changedMessages > 0
      ? [{
        strategy: options.filterFocusedFieldsByLatestUser
          ? 'nocode-editor-same-turn-preread-focused-field-compaction'
          : 'nocode-editor-same-turn-preread-carryover-compaction',
        changedMessages,
        beforeBytes,
        afterBytes,
      }]
      : [],
  }
}

const aggregateNocodeEditorProviderContextProjection = (
  messages: AiProviderMessage[],
  projectors: Array<(messages: AiProviderMessage[]) => NocodeEditorProviderContextProjectionStageResult>,
): NocodeEditorProviderContextProjectionStageResult => (
  projectors.reduce<NocodeEditorProviderContextProjectionStageResult>((current, projector) => {
    const projected = projector(current.messages)
    return {
      messages: projected.messages,
      compacted: current.compacted || projected.compacted,
      projections: [
        ...current.projections,
        ...projected.projections,
      ],
    }
  }, {
    messages: Array.isArray(messages) ? messages : [],
    compacted: false,
    projections: [],
  })
)

export const projectNocodeEditorProviderMessagesForContext = (
  messages: AiProviderMessage[],
  options: {
    compactKeptAvailableWidgetTypes?: boolean
    keptAvailableWidgetTypesMode?: AvailableWidgetTypesProjectionMode
  } = {},
): NocodeEditorProviderContextProjectionResult => {
  const projected = aggregateNocodeEditorProviderContextProjection(messages, [
    projectLongAssistantHistoryMessagesForContext,
    projectStagedPlanningToolMessagesForContext,
    projectStagedPlanningToolCallMessagesForContext,
    projectStagedBlueprintToolMessagesForContext,
    projectStagedBlueprintToolCallMessagesForContext,
    projectSameTurnPrereadCarryoverMessagesForContext,
    currentMessages => projectSameTurnPrereadCarryoverMessagesForContext(currentMessages, {
      filterFocusedFieldsByLatestUser: true,
    }),
    currentMessages => projectFormSummaryToolMessagesForContext(currentMessages, options),
  ])

  return {
    ...projected,
    estimatedBytes: measureUtf8JsonBytes(projected.messages),
  }
}

export const estimateNocodeEditorProviderBodyBytes = (input: {
  systemPrompt: string
  actions: AiActionDefinition[]
  messages: AiProviderMessage[]
}) => (
  measureUtf8JsonBytes({
    model: 'context-projection-estimate',
    temperature: 0.7,
    stream: true,
    tools: buildEstimatedOpenAiTools(input.actions),
    messages: [
      { role: 'system', content: String(input.systemPrompt || '') },
      ...(Array.isArray(input.messages) ? input.messages : []).map(message => ({
        role: message.role,
        content: message.content,
        tool_call_id: message.toolCallId,
        tool_calls: message.metadata?.modelToolExchangeCall
          ? [{
            id: message.metadata.modelToolExchangeCall.id,
            type: 'function',
            function: {
              name: message.metadata.modelToolExchangeCall.name,
              arguments: JSON.stringify(message.metadata.modelToolExchangeCall.input || {}),
            },
          }]
          : undefined,
      })),
    ],
  })
  + estimateLangChainToolSchemaOverheadBytes(input.actions)
)
