type FlowBlueprintPreflightLoadingBlock = {
  kind?: string
  status?: string
  message?: string
  flowBlueprintPreflightPhase?: string
  [key: string]: unknown
}

export const FLOW_BLUEPRINT_WAITING_LOADING_MESSAGE = '节点结构示例已准备，正在生成最终流程蓝图...'

export const resolveFlowBlueprintPreflightToolResultLoadingBlock = <
  T extends FlowBlueprintPreflightLoadingBlock,
>(input: {
  toolName: string
  ok: boolean
  block?: T | null
}): T | null => {
  const block = input.block
  if (
    input.toolName !== 'editor_get_flow_node_examples'
    || !input.ok
    || !block
    || block.kind !== 'flow-plan'
    || block.status !== 'loading'
    || block.flowBlueprintPreflightPhase !== 'examples'
  ) {
    return null
  }

  return {
    ...block,
    message: FLOW_BLUEPRINT_WAITING_LOADING_MESSAGE,
    flowBlueprintPreflightPhase: 'waiting_blueprint',
  }
}
