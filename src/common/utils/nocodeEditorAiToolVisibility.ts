const normalizeToolName = (value: unknown) => String(value || '').trim()

const HIDDEN_TIMELINE_TOOL_NAMES = new Set([
  'editor_get_host_context',
  'editor_get_staged_app_blueprint',
  'editor_get_form_summary',
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_get_relation_context',
  'editor_get_targeted_form_summaries',
  'editor_get_all_form_summaries',
  'editor_get_widget_option_schema',
  'editor_get_widget_option_choices',
])

const HIDDEN_INTERMEDIATE_ASSISTANT_NARRATION_TOOL_NAMES = new Set([
  'editor_get_host_context',
  'editor_get_staged_app_blueprint',
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_get_relation_context',
  'editor_get_targeted_form_summaries',
  'editor_get_all_form_summaries',
  'editor_get_form_summary',
  'editor_get_widget_option_schema',
  'editor_get_widget_option_choices',
])

export const isNocodeEditorHiddenTimelineTool = (toolName: unknown) => (
  HIDDEN_TIMELINE_TOOL_NAMES.has(normalizeToolName(toolName))
)

export const shouldHideNocodeEditorIntermediateAssistantNarration = (toolName: unknown) => (
  HIDDEN_INTERMEDIATE_ASSISTANT_NARRATION_TOOL_NAMES.has(normalizeToolName(toolName))
)
