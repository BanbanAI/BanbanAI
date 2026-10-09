import {
  nocodeEditorWidgetCapabilityBaseGenerated,
  type NocodeEditorWidgetCapabilityBaseGenerated,
} from './nocodeEditorWidgetCapabilityBase.generated'
import {
  nocodeEditorWidgetCapabilityOverlay,
  type NocodeEditorWidgetCapabilityOverlay,
} from './nocodeEditorWidgetCapabilityOverlay'

export type NocodeEditorWidgetCapabilityRequirement =
  | 'none'
  | 'source'
  | 'enumOptions'
  | 'children'

export type NocodeEditorWidgetCapabilityPriority = 'high' | 'medium' | 'low'

export type NocodeEditorWidgetCapabilityFamily =
  | 'text'
  | 'number'
  | 'date'
  | 'enum'
  | 'relation'
  | 'organization'
  | 'media'
  | 'subform'
  | 'display'
  | 'advanced'

export type NocodeEditorWidgetCapability = {
  type: string
  name: string
  aliases: string[]
  family: NocodeEditorWidgetCapabilityFamily
  planningPriority: NocodeEditorWidgetCapabilityPriority
  promptVisible: boolean
  useWhen: string[]
  avoidWhen: string[]
  requires: NocodeEditorWidgetCapabilityRequirement[]
  clarificationTriggers: string[]
  fallbackTypes: string[]
  examples: string[]
  notes?: string[]
}

export type NocodeEditorWidgetCapabilityCatalog = {
  version: string
  globalRules: string[]
  ambiguityRules: string[]
  widgets: NocodeEditorWidgetCapability[]
}

const CATALOG_GLOBAL_RULES = [
  '蓝图规划时优先写清更准确的字段组件类型，不要默认退回 textInput 或 numberInput。',
  '字段组件能力目录只用于蓝图规划和解释，不替代运行时 availableWidgetTypes。',
  '如果字段值本质来自其他表单或主数据，优先规划 relation 组件，不要静默退回普通文本。',
  '如果字段能力依赖 source、enumOptions 或 children，缺失时优先进入澄清，不要假装信息齐全。',
  '低优先级展示型组件默认不进入 prompt digest，避免影响数据采集类表单规划。',
] as const

const CATALOG_AMBIGUITY_RULES = [
  '负责人、联系人、经办人等歧义人员字段，如果上下文不足，先澄清再决定 memberSelect、treeSelect 或 textInput。',
  '附件未说明时，先澄清图片还是通用文件。',
  '时间、日期未说明粒度时，先澄清是单点、范围还是纯时分秒。',
  '如果字段像关系字段但缺失 source，不要规划成空 relation 组件，先写入 openQuestions。',
  '如果字段像子表单但没有 children，先澄清明细结构。',
] as const

type WidgetCapabilityBaseWidget = NocodeEditorWidgetCapabilityBaseGenerated['widgets'][number]
type WidgetCapabilityOverlayWidget = NocodeEditorWidgetCapabilityOverlay['widgets'][number]
type WidgetCapabilityMergeInput = {
  type?: unknown
  name?: unknown
  aliases?: unknown
  family?: unknown
  planningPriority?: unknown
  promptVisible?: unknown
  useWhen?: unknown
  avoidWhen?: unknown
  requires?: unknown
  clarificationTriggers?: unknown
  fallbackTypes?: unknown
  examples?: unknown
  notes?: unknown
}

const defineWidget = (
  widget: NocodeEditorWidgetCapability,
): NocodeEditorWidgetCapability => ({
  ...widget,
  aliases: Array.from(new Set((widget.aliases || []).map(item => String(item || '').trim()).filter(Boolean))),
  useWhen: (widget.useWhen || []).map(item => String(item || '').trim()).filter(Boolean),
  avoidWhen: (widget.avoidWhen || []).map(item => String(item || '').trim()).filter(Boolean),
  requires: (widget.requires || []).length ? widget.requires : ['none'],
  clarificationTriggers: (widget.clarificationTriggers || []).map(item => String(item || '').trim()).filter(Boolean),
  fallbackTypes: (widget.fallbackTypes || []).map(item => String(item || '').trim()).filter(Boolean),
  examples: (widget.examples || []).map(item => String(item || '').trim()).filter(Boolean),
  notes: (widget.notes || []).map(item => String(item || '').trim()).filter(Boolean),
})

const normalizeList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
)

const normalizeWidget = (widget: WidgetCapabilityMergeInput): NocodeEditorWidgetCapability => defineWidget({
  type: String(widget.type || '').trim(),
  name: String(widget.name || '').trim(),
  aliases: normalizeList(widget.aliases),
  family: widget.family as NocodeEditorWidgetCapabilityFamily,
  planningPriority: (widget.planningPriority || 'high') as NocodeEditorWidgetCapabilityPriority,
  promptVisible: widget.promptVisible !== false,
  useWhen: normalizeList(widget.useWhen),
  avoidWhen: normalizeList(widget.avoidWhen),
  requires: normalizeList(widget.requires) as NocodeEditorWidgetCapabilityRequirement[],
  clarificationTriggers: normalizeList(widget.clarificationTriggers),
  fallbackTypes: normalizeList(widget.fallbackTypes),
  examples: normalizeList(widget.examples),
  notes: normalizeList(widget.notes),
})

export const mergeNocodeEditorWidgetCapabilityCatalog = (input: {
  base: NocodeEditorWidgetCapabilityBaseGenerated
  overlay: NocodeEditorWidgetCapabilityOverlay
}): NocodeEditorWidgetCapabilityCatalog => {
  const widgets = input.base.widgets.map(baseWidget => {
    const overlayWidget = input.overlay.widgets.find(item => item.type === baseWidget.type)
    return normalizeWidget({
      ...baseWidget,
      ...(overlayWidget || {}),
    })
  })

  return {
    version: String(input.base.version || input.overlay.version || '').trim(),
    globalRules: normalizeList(CATALOG_GLOBAL_RULES),
    ambiguityRules: normalizeList(CATALOG_AMBIGUITY_RULES),
    widgets,
  }
}

export const nocodeEditorWidgetCapabilityCatalog: NocodeEditorWidgetCapabilityCatalog =
  mergeNocodeEditorWidgetCapabilityCatalog({
    base: nocodeEditorWidgetCapabilityBaseGenerated,
    overlay: nocodeEditorWidgetCapabilityOverlay,
  })
