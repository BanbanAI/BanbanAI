import { ProcessNodeType } from "@common/types/project";
import { Branch, BranchNode, ProcessNode } from "../process/process";
import { unique } from "@common/utils/unique";
import { deepClone } from "@common/utils/object";

export const TEMPORARY = 'temporary';
export const SUBFORM = 'widget.form.subform';
export const MULTIPLETABS = 'widget.form.multipleTabs';


export const isBranchNode = (node: any): node is BranchNode => {
  return node instanceof BranchNode;
}

export const isTriggerNode = (node: ProcessNode) => {
  return [
    ProcessNodeType.TRIGGER_DATA_CHANGE,
    ProcessNodeType.TRIGGER_MANUAL,
    ProcessNodeType.TRIGGER_OPERATION,
    ProcessNodeType.TRIGGER_TIME_TASK,
  ].includes(node.type)
}

export const copyBranch = (branches: Branch[]) => {
  return branches.map(branch => {
    const processBranch = {
      ...branch.getBranch(),
      uid: unique(),
    }
    processBranch.flows = copyNodes(branch.nodes);
    return processBranch;
  })
}
export const copyNodes = (nodes: ProcessNode[]) => {
  return nodes.map(node => {
    const _flow = node.getFlow();
    const flow = {
      ..._flow,
      uid: unique(),
    }
    if (flow.options) {
      flow.options = deepClone(_flow.options);
    }
    if (isBranchNode(node)) {
      flow.branches = copyBranch(node.branches);
    }
    return flow;
  })
}
