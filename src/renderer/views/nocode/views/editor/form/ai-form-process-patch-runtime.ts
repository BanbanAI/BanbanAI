import { deepClone } from '@common/utils/object'
import {
  ProcessNodeType,
  type ProcessBranch,
  type ProcessFlow,
} from '@common/types/project'
import {
  NocodeEditorFlowPatchError,
  type NocodeEditorFlowPatch,
  type NocodeEditorFlowPatchAddNodeType,
  type NocodeEditorFlowPatchErrorCode,
  type NocodeEditorFlowPatchResult,
} from '@common/utils/nocodeEditorFlowPatch'
import {
  getFollowingFlows,
  getRollbackTargetFlows,
} from '@common/utils/flow'

export type NocodeEditorFlowPatchRuntimeNodeType =
  | NocodeEditorFlowPatchAddNodeType
  | 'trigger-data-change'
  | 'trigger-time-task'
  | 'trigger-operation'

export type CompileNocodeEditorFlowPatchNode = (input: {
  node: {
    type: NocodeEditorFlowPatchRuntimeNodeType
    name?: string
    options?: Record<string, unknown>
  }
  existingFlow?: ProcessFlow
  triggerBranch: {
    branchKey: string
    label?: string
  }
  previousFlow?: ProcessFlow | null
  nodeUidByNodeKey: ReadonlyMap<string, string>
  nodeKeyByTempKey: ReadonlyMap<string, string>
}) => ProcessFlow

type AppliedOperation = NocodeEditorFlowPatchResult['appliedOperations'][number]

type FlowLocation = {
  flow: ProcessFlow
  flows: ProcessFlow[]
  index: number
  parentBranch?: ProcessBranch
  triggerBranch?: TriggerBranchContext
}

type TriggerBranchContext = {
  branchKey: string
  label?: string
}

type FlowIndex = {
  nodeByUid: Map<string, FlowLocation>
  branchByUid: Map<string, ProcessBranch>
  triggerBranchByBranchUid: Map<string, TriggerBranchContext>
}

const PATCHABLE_NODE_TYPES = new Set<ProcessNodeType>([
  ProcessNodeType.APPROVAL,
  ProcessNodeType.TRANSACT,
  ProcessNodeType.NOTIFY,
  ProcessNodeType.REPORT_DATA,
  ProcessNodeType.ADD_DATA,
  ProcessNodeType.EDIT_DATA,
  ProcessNodeType.DELETE_DATA,
])

const UPDATABLE_NODE_TYPES = new Set<ProcessNodeType>([
  ...PATCHABLE_NODE_TYPES,
  ProcessNodeType.TRIGGER_DATA_CHANGE,
  ProcessNodeType.TRIGGER_TIME_TASK,
  ProcessNodeType.TRIGGER_OPERATION,
])

const RUNTIME_TO_PATCH_NODE_TYPE: Partial<Record<ProcessNodeType, NocodeEditorFlowPatchRuntimeNodeType>> = {
  [ProcessNodeType.TRIGGER_DATA_CHANGE]: 'trigger-data-change',
  [ProcessNodeType.TRIGGER_TIME_TASK]: 'trigger-time-task',
  [ProcessNodeType.TRIGGER_OPERATION]: 'trigger-operation',
  [ProcessNodeType.APPROVAL]: 'approval',
  [ProcessNodeType.TRANSACT]: 'transact',
  [ProcessNodeType.NOTIFY]: 'notify',
  [ProcessNodeType.REPORT_DATA]: 'report-data',
  [ProcessNodeType.ADD_DATA]: 'add-data',
  [ProcessNodeType.EDIT_DATA]: 'edit-data',
  [ProcessNodeType.DELETE_DATA]: 'delete-data',
}

const isTriggerFlow = (flow: ProcessFlow) => (
  flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE
  || flow.type === ProcessNodeType.TRIGGER_TIME_TASK
  || flow.type === ProcessNodeType.TRIGGER_OPERATION
  || flow.type === ProcessNodeType.TRIGGER_MANUAL
)

const buildTopLevelTriggerBranch = (branch: ProcessBranch): TriggerBranchContext => {
  const label = branch.flows.find(isTriggerFlow)?.options?.name
  return {
    branchKey: branch.uid,
    ...(typeof label === 'string' && label.trim() ? { label } : {}),
  }
}

const buildFlowIndex = (
  flows: ProcessFlow[],
  operationIndex: number,
): FlowIndex => {
  const nodeByUid = new Map<string, FlowLocation>()
  const branchByUid = new Map<string, ProcessBranch>()
  const triggerBranchByBranchUid = new Map<string, TriggerBranchContext>()

  const visit = (
    items: ProcessFlow[],
    parentBranch?: ProcessBranch,
    triggerBranch?: TriggerBranchContext,
  ) => {
    items.forEach((flow, index) => {
      if (nodeByUid.has(flow.uid)) {
        throw patchError(
          'flow_patch_conflict',
          `流程中存在重复节点 UID：${flow.uid}`,
          operationIndex,
          { key: flow.uid, keyKind: 'nodeUid' },
        )
      }
      nodeByUid.set(flow.uid, {
        flow,
        flows: items,
        index,
        parentBranch,
        triggerBranch,
      })
      const branches = flow.branches || []
      branches.forEach((branch) => {
        const branchTrigger = !parentBranch && flow.type === ProcessNodeType.START
          ? buildTopLevelTriggerBranch(branch)
          : triggerBranch
        if (branchByUid.has(branch.uid)) {
          throw patchError(
            'flow_patch_conflict',
            `流程中存在重复分支 UID：${branch.uid}`,
            operationIndex,
            { key: branch.uid, keyKind: 'branchUid' },
          )
        }
        branchByUid.set(branch.uid, branch)
        if (branchTrigger && !triggerBranchByBranchUid.has(branch.uid)) {
          triggerBranchByBranchUid.set(branch.uid, branchTrigger)
        }
        visit(branch.flows, branch, branchTrigger)
      })
    })
  }

  visit(flows)
  return { nodeByUid, branchByUid, triggerBranchByBranchUid }
}

const buildNodeUidByNodeKey = (
  index: FlowIndex,
  nodeKeyByTempKey: ReadonlyMap<string, string>,
) => {
  const result = new Map<string, string>()
  index.nodeByUid.forEach((_location, nodeUid) => result.set(nodeUid, nodeUid))
  nodeKeyByTempKey.forEach((nodeUid, tempKey) => result.set(tempKey, nodeUid))
  return result
}

const patchError = (
  code: NocodeEditorFlowPatchErrorCode,
  message: string,
  operationIndex: number,
  details: Record<string, unknown> = {},
) => new NocodeEditorFlowPatchError(code, message, {
  ...details,
  operationIndex,
})

const resolveNodeKey = (
  nodeKey: string,
  index: FlowIndex,
  nodeKeyByTempKey: ReadonlyMap<string, string>,
  operationIndex: number,
): FlowLocation => {
  const direct = index.nodeByUid.get(nodeKey)
  if (direct) return direct

  const mappedNodeKey = nodeKeyByTempKey.get(nodeKey)
  const mapped = mappedNodeKey ? index.nodeByUid.get(mappedNodeKey) : undefined
  if (mapped) return mapped

  throw patchError(
    'flow_patch_conflict',
    `流程节点不存在：${nodeKey}`,
    operationIndex,
    { nodeKey },
  )
}

const resolveTargetBranch = (
  branchKey: string,
  index: FlowIndex,
  operationIndex: number,
) => {
  const branch = index.branchByUid.get(branchKey)
  if (branch) return branch
  throw patchError(
    'flow_patch_conflict',
    `目标分支不存在：${branchKey}`,
    operationIndex,
    { parentBranchKey: branchKey },
  )
}

const resolveTriggerBranch = (
  branchKey: string,
  index: FlowIndex,
  operationIndex: number,
) => {
  const triggerBranch = index.triggerBranchByBranchUid.get(branchKey)
  if (triggerBranch) return triggerBranch
  throw patchError(
    'flow_patch_conflict',
    `目标分支缺少所属触发分支：${branchKey}`,
    operationIndex,
    { parentBranchKey: branchKey },
  )
}

const resolveNodeTriggerBranch = (
  location: FlowLocation,
  operationIndex: number,
) => {
  if (location.triggerBranch) return location.triggerBranch
  throw patchError(
    'flow_patch_conflict',
    `节点缺少所属触发分支：${location.flow.uid}`,
    operationIndex,
    { nodeKey: location.flow.uid },
  )
}

const assertSingleAnchor = (
  operation: { afterNodeKey?: string, beforeNodeKey?: string },
  operationIndex: number,
) => {
  if (operation.afterNodeKey && operation.beforeNodeKey) {
    throw patchError(
      'flow_patch_invalid_input',
      'afterNodeKey 与 beforeNodeKey 不能同时存在',
      operationIndex,
    )
  }
}

const resolveAnchor = (
  operation: { afterNodeKey?: string, beforeNodeKey?: string },
  targetBranch: ProcessBranch,
  index: FlowIndex,
  nodeKeyByTempKey: ReadonlyMap<string, string>,
  operationIndex: number,
) => {
  const anchorKey = operation.afterNodeKey || operation.beforeNodeKey
  if (!anchorKey) return undefined
  const anchor = resolveNodeKey(anchorKey, index, nodeKeyByTempKey, operationIndex)
  if (anchor.flows !== targetBranch.flows) {
    throw patchError(
      'flow_patch_conflict',
      `定位锚点不属于目标分支：${anchorKey}`,
      operationIndex,
      { anchorNodeKey: anchorKey, parentBranchKey: targetBranch.uid },
    )
  }
  return anchor
}

const getInsertionIndex = (
  operation: { afterNodeKey?: string, beforeNodeKey?: string },
  targetBranch: ProcessBranch,
  anchor?: FlowLocation,
) => {
  if (!anchor) return targetBranch.flows.length
  return operation.beforeNodeKey ? anchor.index : anchor.index + 1
}

const getNodeName = (flow: ProcessFlow) => {
  const value = flow.options?.name
  return typeof value === 'string' && value.trim() ? value : undefined
}

const canAppendWithoutAnchor = (flows: ProcessFlow[]) => (
  flows.every(flow => (
    flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE
    || flow.type === ProcessNodeType.TRIGGER_TIME_TASK
    || flow.type === ProcessNodeType.TRIGGER_OPERATION
    || flow.type === ProcessNodeType.TRIGGER_MANUAL
    || flow.type === ProcessNodeType.BRANCH_SETTING
    || flow.type === ProcessNodeType.JUNCTION
    || flow.type === ProcessNodeType.END
  ))
)

const resolveInsertionIndex = (
  operation: { afterNodeKey?: string, beforeNodeKey?: string },
  targetBranch: ProcessBranch,
  index: FlowIndex,
  nodeKeyByTempKey: ReadonlyMap<string, string>,
  operationIndex: number,
) => {
  assertSingleAnchor(operation, operationIndex)
  const anchor = resolveAnchor(
    operation,
    targetBranch,
    index,
    nodeKeyByTempKey,
    operationIndex,
  )
  if (!anchor && !canAppendWithoutAnchor(targetBranch.flows)) {
    throw patchError(
      'flow_patch_target_ambiguous',
      `目标分支 ${targetBranch.uid} 存在多个可插入位置，请提供锚点`,
      operationIndex,
      { parentBranchKey: targetBranch.uid },
    )
  }
  return getInsertionIndex(operation, targetBranch, anchor)
}

const assertPatchableNode = (
  flow: ProcessFlow,
  operationIndex: number,
  action: 'remove' | 'move',
) => {
  if (PATCHABLE_NODE_TYPES.has(flow.type)) return
  throw patchError(
    'requires_full_rebuild',
    `节点类型 ${flow.type} 不支持局部${action === 'remove' ? '删除' : '移动'}`,
    operationIndex,
    { nodeKey: flow.uid, nodeType: flow.type },
  )
}

const assertUpdatableNode = (flow: ProcessFlow, operationIndex: number) => {
  if (UPDATABLE_NODE_TYPES.has(flow.type)) return
  throw patchError(
    'requires_full_rebuild',
    `节点类型 ${flow.type} 不支持局部更新`,
    operationIndex,
    { nodeKey: flow.uid, nodeType: flow.type },
  )
}

const compilePatchNode = (
  compileNode: CompileNocodeEditorFlowPatchNode,
  input: Parameters<CompileNocodeEditorFlowPatchNode>[0],
  operationIndex: number,
) => {
  try {
    const compiled = compileNode(input)
    if (!compiled || typeof compiled.uid !== 'string' || !compiled.uid.trim()) {
      throw new Error('节点编译结果缺少 uid')
    }
    return compiled
  } catch (error) {
    if (error instanceof NocodeEditorFlowPatchError) {
      throw patchError(error.code, error.message, operationIndex, error.details)
    }
    throw patchError(
      'flow_patch_validation_failed',
      error instanceof Error ? error.message : '节点编译失败',
      operationIndex,
    )
  }
}

type FlowReferenceState = {
  sourceNodeKey: string
  fieldPath: string
  targetNodeKey: string
  valid: boolean
}

const collectTimeoutBackNodeIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectTimeoutBackNodeIds)
  }
  if (!value || typeof value !== 'object') return []
  const results: string[] = []
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'backNodeId' && typeof item === 'string') {
      results.push(item)
    } else {
      results.push(...collectTimeoutBackNodeIds(item))
    }
  }
  return results
}

const buildReferenceIdentity = (state: Omit<FlowReferenceState, 'valid'>) => (
  JSON.stringify([state.sourceNodeKey, state.fieldPath, state.targetNodeKey])
)

const collectFlowReferenceState = (flows: ProcessFlow[]) => {
  const result = new Map<string, FlowReferenceState>()
  const append = (
    flow: ProcessFlow,
    fieldPath: string,
    references: unknown,
    validNodeKeys: ReadonlySet<string>,
  ) => {
    if (!Array.isArray(references)) return
    references.forEach((targetNodeKey) => {
      if (typeof targetNodeKey !== 'string' || !targetNodeKey) return
      const state: FlowReferenceState = {
        sourceNodeKey: flow.uid,
        fieldPath,
        targetNodeKey,
        valid: validNodeKeys.has(targetNodeKey),
      }
      result.set(buildReferenceIdentity(state), state)
    })
  }
  const visit = (items: ProcessFlow[]) => items.forEach((flow) => {
    const options = (flow.options || {}) as Record<string, unknown>
    if (flow.type === ProcessNodeType.APPROVAL) {
      append(
        flow,
        'rejectSkipNodeIds',
        options.rejectSkipNodeIds,
        new Set(getFollowingFlows(flows, flow.uid)
          .filter(item => item.type !== ProcessNodeType.END && item.type !== ProcessNodeType.BRANCH_SETTING)
          .map(item => item.uid)),
      )
    }
    const rollbackNodeKeys = new Set(
      getRollbackTargetFlows(flows, flow.uid).map(item => item.uid),
    )
    if (flow.type === ProcessNodeType.APPROVAL || flow.type === ProcessNodeType.TRANSACT) {
      append(flow, 'revertRange', options.revertRange, rollbackNodeKeys)
    }
    append(
      flow,
      'timeout.rules[].backNodeId',
      collectTimeoutBackNodeIds(options.timeout),
      rollbackNodeKeys,
    )
    for (const branch of flow.branches || []) {
      visit(branch.flows)
    }
  })
  visit(flows)
  return result
}

const recordBlockedFlowReferenceTransitions = (
  before: ReadonlyMap<string, FlowReferenceState>,
  after: ReadonlyMap<string, FlowReferenceState>,
  operationIndexByIdentity: Map<string, number>,
  operationIndex: number,
) => {
  operationIndexByIdentity.forEach((_value, identity) => {
    if (after.get(identity)?.valid !== false) {
      operationIndexByIdentity.delete(identity)
    }
  })
  for (const [identity, state] of after) {
    if (
      !state.valid
      && before.get(identity)?.valid !== false
      && !operationIndexByIdentity.has(identity)
    ) {
      operationIndexByIdentity.set(identity, operationIndex)
    }
  }
}

type ExecuteNocodeEditorFlowPatchInput = {
  flows: ProcessFlow[]
  patch: NocodeEditorFlowPatch
  compileNode: CompileNocodeEditorFlowPatchNode
}

type ExecuteNocodeEditorFlowPatchOutput = {
  flows: ProcessFlow[]
  tempKeyMap: Record<string, string>
  appliedOperations: NocodeEditorFlowPatchResult['appliedOperations']
}

const executePatchOperations = (
  input: ExecuteNocodeEditorFlowPatchInput,
  executionState: { operationIndex: number },
): ExecuteNocodeEditorFlowPatchOutput => {
  const flows = deepClone(input.flows)
  const beforeReferenceState = collectFlowReferenceState(flows)
  let currentReferenceState = beforeReferenceState
  const blockedReferenceOperationIndex = new Map<string, number>()
  const nodeKeyByTempKey = new Map<string, string>()
  const appliedOperations: AppliedOperation[] = []

  const recordCurrentReferenceState = (operationIndex: number) => {
    const nextReferenceState = collectFlowReferenceState(flows)
    recordBlockedFlowReferenceTransitions(
      currentReferenceState,
      nextReferenceState,
      blockedReferenceOperationIndex,
      operationIndex,
    )
    currentReferenceState = nextReferenceState
  }

  input.patch.operations.forEach((operation, operationIndex) => {
    executionState.operationIndex = operationIndex
    const index = buildFlowIndex(flows, operationIndex)

    if (operation.op === 'add') {
      if (nodeKeyByTempKey.has(operation.tempKey)) {
        throw patchError(
          'flow_patch_invalid_input',
          `tempKey 重复：${operation.tempKey}`,
          operationIndex,
          { tempKey: operation.tempKey },
        )
      }
      if (index.nodeByUid.has(operation.tempKey)) {
        throw patchError(
          'flow_patch_conflict',
          `tempKey 与真实节点 UID 冲突：${operation.tempKey}`,
          operationIndex,
          { tempKey: operation.tempKey, nodeKey: operation.tempKey },
        )
      }
      const targetBranch = resolveTargetBranch(operation.parentBranchKey, index, operationIndex)
      const triggerBranch = resolveTriggerBranch(operation.parentBranchKey, index, operationIndex)
      const insertionIndex = resolveInsertionIndex(
        operation,
        targetBranch,
        index,
        nodeKeyByTempKey,
        operationIndex,
      )
      const compiled = compilePatchNode(input.compileNode, {
        node: operation.node,
        triggerBranch,
        previousFlow: targetBranch.flows[insertionIndex - 1] || null,
        nodeUidByNodeKey: buildNodeUidByNodeKey(index, nodeKeyByTempKey),
        nodeKeyByTempKey,
      }, operationIndex)
      if (index.nodeByUid.has(compiled.uid)) {
        throw patchError(
          'flow_patch_conflict',
          `节点编译结果 uid 已存在：${compiled.uid}`,
          operationIndex,
          { nodeKey: compiled.uid },
        )
      }
      if (nodeKeyByTempKey.has(compiled.uid)) {
        throw patchError(
          'flow_patch_conflict',
          `节点编译结果 uid 与已有 tempKey 冲突：${compiled.uid}`,
          operationIndex,
          { nodeKey: compiled.uid, tempKey: compiled.uid },
        )
      }
      targetBranch.flows.splice(insertionIndex, 0, compiled)
      nodeKeyByTempKey.set(operation.tempKey, compiled.uid)
      appliedOperations.push({
        op: 'add',
        nodeKey: compiled.uid,
        tempKey: operation.tempKey,
        nodeName: getNodeName(compiled),
      })
      recordCurrentReferenceState(operationIndex)
      return
    }

    if (operation.op === 'update') {
      const location = resolveNodeKey(operation.nodeKey, index, nodeKeyByTempKey, operationIndex)
      assertUpdatableNode(location.flow, operationIndex)
      const runtimeType = RUNTIME_TO_PATCH_NODE_TYPE[location.flow.type]
      if (!runtimeType) {
        throw patchError('requires_full_rebuild', '当前节点无法转换为局部更新节点', operationIndex, {
          nodeKey: location.flow.uid,
          nodeType: location.flow.type,
        })
      }
      const currentName = getNodeName(location.flow)
      const nextOptions = {
        ...((location.flow.options || {}) as Record<string, unknown>),
        ...(operation.changes.options || {}),
      }
      const nextName = operation.changes.name ?? currentName
      const compiled = compilePatchNode(input.compileNode, {
        node: {
          type: runtimeType,
          ...(nextName === undefined ? {} : { name: nextName }),
          options: nextOptions,
        },
        existingFlow: location.flow,
        triggerBranch: resolveNodeTriggerBranch(location, operationIndex),
        previousFlow: location.flows[location.index - 1] || null,
        nodeUidByNodeKey: buildNodeUidByNodeKey(index, nodeKeyByTempKey),
        nodeKeyByTempKey,
      }, operationIndex)
      const updated: ProcessFlow = {
        ...compiled,
        uid: location.flow.uid,
        type: location.flow.type,
        branches: location.flow.branches,
      }
      location.flows.splice(location.index, 1, updated)
      appliedOperations.push({
        op: 'update',
        nodeKey: updated.uid,
        nodeName: getNodeName(updated),
      })
      recordCurrentReferenceState(operationIndex)
      return
    }

    if (operation.op === 'remove') {
      const location = resolveNodeKey(operation.nodeKey, index, nodeKeyByTempKey, operationIndex)
      assertPatchableNode(location.flow, operationIndex, 'remove')
      location.flows.splice(location.index, 1)
      appliedOperations.push({
        op: 'remove',
        nodeKey: location.flow.uid,
        nodeName: getNodeName(location.flow),
      })
      recordCurrentReferenceState(operationIndex)
      return
    }

    assertSingleAnchor(operation, operationIndex)
    const source = resolveNodeKey(operation.nodeKey, index, nodeKeyByTempKey, operationIndex)
    assertPatchableNode(source.flow, operationIndex, 'move')
    const targetBranch = resolveTargetBranch(operation.parentBranchKey, index, operationIndex)
    const anchor = resolveAnchor(operation, targetBranch, index, nodeKeyByTempKey, operationIndex)
    if (anchor?.flow === source.flow) {
      throw patchError(
        'flow_patch_invalid_input',
        '移动节点不能以自身作为定位锚点',
        operationIndex,
        { nodeKey: source.flow.uid },
      )
    }

    source.flows.splice(source.index, 1)
    const refreshedIndex = buildFlowIndex(flows, operationIndex)
    const refreshedTarget = resolveTargetBranch(operation.parentBranchKey, refreshedIndex, operationIndex)
    const insertionIndex = resolveInsertionIndex(
      operation,
      refreshedTarget,
      refreshedIndex,
      nodeKeyByTempKey,
      operationIndex,
    )
    refreshedTarget.flows.splice(insertionIndex, 0, source.flow)
    appliedOperations.push({
      op: 'move',
      nodeKey: source.flow.uid,
      nodeName: getNodeName(source.flow),
    })
    recordCurrentReferenceState(operationIndex)
  })

  const blockedReference = Array.from(currentReferenceState.entries()).find(
    ([identity, state]) => !state.valid && blockedReferenceOperationIndex.has(identity),
  )
  if (blockedReference) {
    const [identity, reference] = blockedReference
    throw patchError(
      'flow_patch_reference_blocked',
      `${reference.fieldPath} 引用在 patch 后无效`,
      blockedReferenceOperationIndex.get(identity) ?? input.patch.operations.length - 1,
      reference,
    )
  }

  return {
    flows,
    tempKeyMap: Object.fromEntries(nodeKeyByTempKey),
    appliedOperations,
  }
}

export const executeNocodeEditorFlowPatch = (
  input: ExecuteNocodeEditorFlowPatchInput,
): ExecuteNocodeEditorFlowPatchOutput => {
  const executionState = { operationIndex: -1 }
  try {
    return executePatchOperations(input, executionState)
  } catch (error) {
    if (error instanceof NocodeEditorFlowPatchError) throw error
    throw new NocodeEditorFlowPatchError(
      'flow_patch_invalid_input',
      error instanceof Error ? error.message : '流程 patch 执行失败',
      { operationIndex: executionState.operationIndex },
    )
  }
}
