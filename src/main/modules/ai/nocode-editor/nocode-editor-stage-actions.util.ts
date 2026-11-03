export type NocodeEditorToolStage = 'flow'

const FLOW_STAGE_ENTRY_TOOL_NAMES = new Set([
  'editor_get_flow_summary',
  'editor_get_flow_node_examples',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_patch_flow',
  'editor_apply_staged_flow',
])

// 流程轮只剔除其它阶段的 plan/blueprint 工具；读取、表单编辑、附件等共用能力保留，
// 避免模型在流程中途需要补字段或查组织信息时失去工具。
const NON_FLOW_STAGE_TOOL_NAMES = new Set([
  'editor_stage_app_plan',
  'editor_stage_app_blueprint',
  'editor_get_staged_app_blueprint',
  'editor_apply_staged_app_blueprint',
  'editor_clear_staged_app_blueprint',
  'editor_stage_single_form_plan',
  'editor_stage_content_plan',
  'editor_stage_formula_plan',
])

const normalizeToolName = (value: unknown) => String(value || '').trim()

export const isNocodeEditorFlowStageEntryTool = (toolName: unknown) => (
  FLOW_STAGE_ENTRY_TOOL_NAMES.has(normalizeToolName(toolName))
)

export const resolveNocodeEditorToolStageFromNames = (
  toolNames: Array<unknown> | null | undefined,
): NocodeEditorToolStage | null => (
  (toolNames || []).some(isNocodeEditorFlowStageEntryTool) ? 'flow' : null
)

export const projectNocodeEditorStageActions = <T extends { name?: unknown }>(
  actions: T[],
  stage: NocodeEditorToolStage | null | undefined,
) => {
  if (stage !== 'flow') {
    return actions
  }
  const projected = actions.filter(action => (
    !NON_FLOW_STAGE_TOOL_NAMES.has(normalizeToolName(action.name))
  ))
  if (!projected.length) {
    return actions
  }
  // 没有实际剔除时保持原引用，调用点据此跳过 system prompt 重建。
  return projected.length === actions.length ? actions : projected
}
