import {
  nocodeEditorWidgetCapabilityCatalog,
  type NocodeEditorWidgetCapabilityCatalog,
  type NocodeEditorWidgetCapabilityPriority,
  type NocodeEditorWidgetCapabilityRequirement,
} from './nocodeEditorWidgetCapabilityCatalog'

export type NocodeEditorPromptWidgetCapabilityDigest = {
  version: string
  globalRules: string[]
  ambiguityRules: string[]
  widgets: Array<{
    type: string
    name: string
    aliases: string[]
    planningPriority: NocodeEditorWidgetCapabilityPriority
    useWhen: string[]
    avoidWhen: string[]
    requires: NocodeEditorWidgetCapabilityRequirement[]
    clarificationTriggers: string[]
    fallbackTypes: string[]
  }>
}

const DEFAULT_PROMPT_PRIORITIES: NocodeEditorWidgetCapabilityPriority[] = ['high', 'medium']

const normalizeList = (value: unknown, maxCount: number) => (
  Array.isArray(value)
    ? value
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .slice(0, maxCount)
    : []
)

export const buildNocodeEditorWidgetCapabilityDigest = (input?: {
  catalog?: NocodeEditorWidgetCapabilityCatalog
  includePriorities?: NocodeEditorWidgetCapabilityPriority[]
  includePromptHidden?: boolean
  compact?: boolean
}): NocodeEditorPromptWidgetCapabilityDigest => {
  const catalog = input?.catalog || nocodeEditorWidgetCapabilityCatalog
  const includePriorities = Array.isArray(input?.includePriorities) && input.includePriorities.length
    ? input.includePriorities
    : DEFAULT_PROMPT_PRIORITIES
  const includePromptHidden = input?.includePromptHidden === true
  const compact = input?.compact === true

  return {
    version: catalog.version,
    globalRules: normalizeList(catalog.globalRules, compact ? 4 : 8),
    ambiguityRules: normalizeList(catalog.ambiguityRules, compact ? 4 : 6),
    widgets: catalog.widgets
      .filter(widget => includePromptHidden || widget.promptVisible)
      .filter(widget => includePriorities.includes(widget.planningPriority))
      .map(widget => ({
        type: widget.type,
        name: widget.name,
        aliases: normalizeList(widget.aliases, compact ? 3 : 8),
        planningPriority: widget.planningPriority,
        useWhen: normalizeList(widget.useWhen, compact ? 1 : 3),
        avoidWhen: normalizeList(widget.avoidWhen, compact ? 1 : 3),
        requires: widget.requires.length ? widget.requires : ['none'],
        clarificationTriggers: normalizeList(widget.clarificationTriggers, compact ? 1 : 3),
        fallbackTypes: compact ? [] : normalizeList(widget.fallbackTypes, 4),
      })),
  }
}
