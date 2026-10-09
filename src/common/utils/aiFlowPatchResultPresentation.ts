import type { AiAssistantFlowPatchResultBlock } from '@common/types/ai'

type FlowPatchOperation = AiAssistantFlowPatchResultBlock['operations'][number]
type FlowPatchOperationGroupKey = FlowPatchOperation['op']

const FLOW_PATCH_OPERATION_GROUPS: Array<{
  key: FlowPatchOperationGroupKey
  label: string
}> = [
  { key: 'add', label: '新增' },
  { key: 'update', label: '修改' },
  { key: 'remove', label: '删除' },
  { key: 'move', label: '移动' },
]

const resolveOperationNodeName = (operation: FlowPatchOperation) => (
  String(operation.nodeName || operation.tempKey || operation.nodeKey || '').trim() || '未命名节点'
)

export const groupAiAssistantFlowPatchResultOperations = (
  operations: AiAssistantFlowPatchResultBlock['operations'],
) => FLOW_PATCH_OPERATION_GROUPS.flatMap((group) => {
  const items = (Array.isArray(operations) ? operations : [])
    .filter(operation => operation?.op === group.key)
    .map(operation => ({
      op: operation.op,
      nodeKey: operation.nodeKey,
      tempKey: operation.tempKey,
      nodeName: resolveOperationNodeName(operation),
    }))
  return items.length ? [{ ...group, items }] : []
})

export const buildAiAssistantFlowPatchResultOperationLines = (
  operations: AiAssistantFlowPatchResultBlock['operations'],
) => groupAiAssistantFlowPatchResultOperations(operations)
  .map(group => `${group.label}：${group.items.map(item => item.nodeName).join('、')}`)
