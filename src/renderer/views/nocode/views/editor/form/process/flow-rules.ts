import { ProcessFlow, ProcessNodeType, TriggerMode } from "@common/types/project";
import { canRollbackFlow, getFollowingFlows, isRollbackSubmitNode, isTriggerNode } from "@common/utils";
import { BranchNode, ProcessNode } from "./process";

export type ProcessDropTarget = {
  mode: "after-node" | "branch-order";
  nodeUid: string;
}

const AFTER_START_NODE_TYPES = [
  ProcessNodeType.TRIGGER_DATA_CHANGE,
  ProcessNodeType.TRIGGER_TIME_TASK,
  ProcessNodeType.TRIGGER_OPERATION,
];

const AFTER_NORMAL_NODE_TYPES = [
  ProcessNodeType.CONDITION_BRANCH,
  ProcessNodeType.PARALLEL_BRANCH,
  ProcessNodeType.APPROVAL,
  ProcessNodeType.TRANSACT,
  ProcessNodeType.NOTIFY,
  ProcessNodeType.REPORT_DATA,
  ProcessNodeType.ADD_DATA,
  ProcessNodeType.EDIT_DATA,
  ProcessNodeType.DELETE_DATA,
];

export const isSameDropTarget = (target: ProcessDropTarget | null, nextTarget: ProcessDropTarget | null) => {
  return target?.mode === nextTarget?.mode && target?.nodeUid === nextTarget?.nodeUid;
}

export const canDragProcessNode = (node?: ProcessNode | null) => {
  if (!node) return false;
  if ([ProcessNodeType.START, ProcessNodeType.END].includes(node.type)) return false;
  if (isTriggerNode(node.type)) return false;
  if (node.type === ProcessNodeType.BRANCH_SETTING && node.isOtherBranch) return false;
  return true;
}

const containsProcessNode = (node: ProcessNode, uid: string): boolean => {
  if (!node || !uid) return false;
  if (node.uid === uid) return true;
  if (!(node instanceof BranchNode)) return false;
  return node.branches.some(branch => branch.nodes.some(child => containsProcessNode(child, uid)));
}

const isSingleTimeTaskSource = (node?: ProcessNode | null) => {
  const sourceNode = node?.findSourceNode();
  return sourceNode?.type === ProcessNodeType.TRIGGER_TIME_TASK
    && sourceNode?.options?.triggerMode === TriggerMode.SINGLE;
}

export const getInsertableNodeTypes = (node?: ProcessNode | null) => {
  if (!node) return [];
  if (node.type === ProcessNodeType.START) {
    return AFTER_START_NODE_TYPES;
  }
  if (isSingleTimeTaskSource(node)) {
    return AFTER_NORMAL_NODE_TYPES.filter(type => ![ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(type));
  }
  return AFTER_NORMAL_NODE_TYPES;
}

export const canMoveProcessNodeToAfter = (draggingNode?: ProcessNode | null, targetNode?: ProcessNode | null) => {
  if (!canDragProcessNode(draggingNode) || !targetNode) return false;
  if (draggingNode.uid === targetNode.uid) return false;
  if (containsProcessNode(draggingNode, targetNode.uid)) return false;
  return getInsertableNodeTypes(targetNode).includes(draggingNode.type);
}

export const canReorderBranchSettingNode = (draggingNode?: ProcessNode | null, targetNode?: ProcessNode | null) => {
  if (!draggingNode || !targetNode) return false;
  if (draggingNode.uid === targetNode.uid) return false;
  if (draggingNode.type !== ProcessNodeType.BRANCH_SETTING || targetNode.type !== ProcessNodeType.BRANCH_SETTING) {
    return false;
  }
  const sourceOwnerUid = draggingNode.parent?.getOwner()?.uid;
  const targetOwnerUid = targetNode.parent?.getOwner()?.uid;
  if (!sourceOwnerUid || sourceOwnerUid !== targetOwnerUid) return false;
  if (draggingNode.isOtherBranch) return false;
  return true;
}

type FlowTraceItem = {
  flows: ProcessFlow[];
  index: number;
}

const getFlowTrace = (
  flows: ProcessFlow[],
  flowId: string,
  trace: FlowTraceItem[] = [],
): FlowTraceItem[] => {
  for (let i = 0; i < (flows || []).length; i++) {
    const flow = flows[i];
    const nextTrace = [...trace, { flows, index: i }];
    if (flow.uid === flowId) {
      return nextTrace;
    }
    for (const branch of flow.branches || []) {
      const branchTrace = getFlowTrace(branch.flows, flowId, nextTrace);
      if (branchTrace.length > 0) {
        return branchTrace;
      }
    }
  }
  return [];
}

export const getApprovalRevertRangeOptions = (flows: ProcessFlow[], flowUid: string) => {
  const trace = getFlowTrace(flows, flowUid);
  if (trace.length === 0) return [];

  const optionMap = new Map<string, ProcessFlow>();
  for (const traceItem of trace) {
    for (let i = 0; i < traceItem.index; i++) {
      const candidate = traceItem.flows[i];
      if (!isRollbackSubmitNode(candidate) && ![ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(candidate.type)) {
        continue;
      }
      if (!isRollbackSubmitNode(candidate) && !canRollbackFlow(candidate)) {
        continue;
      }
      if (!optionMap.has(candidate.uid)) {
        optionMap.set(candidate.uid, candidate);
      }
    }
  }

  const options = Array.from(optionMap.values());
  const triggerNode = options.find(item => [
    ProcessNodeType.TRIGGER_DATA_CHANGE,
    ProcessNodeType.TRIGGER_MANUAL,
    ProcessNodeType.TRIGGER_OPERATION,
  ].includes(item.type));
  if (!triggerNode) {
    return options;
  }
  return [triggerNode, ...options.filter(item => item.uid !== triggerNode.uid)];
}

export const getApprovalRejectSkipOptions = (flows: ProcessFlow[], flowUid: string) => {
  return getFollowingFlows(flows, flowUid).filter(item => {
    return ![ProcessNodeType.END, ProcessNodeType.BRANCH_SETTING].includes(item.type);
  });
}

export const normalizeFlowReferenceOptions = (flows: ProcessFlow[]) => {
  const visit = (items: ProcessFlow[]) => {
    for (const flow of items || []) {
      if ([ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(flow.type)) {
        const options = flow.options || {};
        if (flow.type === ProcessNodeType.APPROVAL && Array.isArray(options.rejectSkipNodeIds)) {
          const validIds = new Set(getApprovalRejectSkipOptions(flows, flow.uid).map(item => item.uid));
          options.rejectSkipNodeIds = options.rejectSkipNodeIds.filter(uid => validIds.has(uid));
        }
        if (Array.isArray(options.revertRange)) {
          const validIds = new Set(getApprovalRevertRangeOptions(flows, flow.uid).map(item => item.uid));
          const nextIds = options.revertRange.filter(uid => validIds.has(uid));
          if (nextIds.length > 0) {
            options.revertRange = nextIds;
          } else {
            delete options.revertRange;
          }
        }
      }
      for (const branch of flow.branches || []) {
        visit(branch.flows);
      }
    }
  }
  visit(flows);
}
