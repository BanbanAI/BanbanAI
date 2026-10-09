import { TODO } from '@common/types/nocode';
import { ProcessFlow } from '@common/types/project';
import { getFlowById } from '@common/utils';
import { deepClone } from '@common/utils/object';

const findOwnerFlows = (flows: ProcessFlow[] = [], flowId = ''): ProcessFlow[] | null => {
  for (const flow of flows) {
    if (flow.uid === flowId) {
      return flows;
    }
    if (flow.branches?.length) {
      for (const branch of flow.branches) {
        const found = findOwnerFlows(branch.flows, flowId);
        if (found) return found;
      }
    }
  }
  return null;
};

export const getTodoBackNodeOptions = (
  todo?: TODO,
  fallbackFlows: ProcessFlow[] = [],
  submitText = '',
) => {
  if (!todo) return [];

  const flowSource = todo.flows?.length ? todo.flows : fallbackFlows;
  const flow = getFlowById(flowSource, todo.flowId);
  const isRevertRange = 'revertRange' in (flow?.options ?? {});
  const revertRange = flow?.options?.revertRange || [];
  const currentFlows = findOwnerFlows(flowSource || [], todo.flowId || '') || [];
  const currentIndex = currentFlows.findIndex((item) => item.uid === todo.flowId);

  let selectOptions = currentFlows
    .slice(0, currentIndex)
    .filter((item) => item.type === 'approval');

  const triggerNode = deepClone(currentFlows.find((item) => item.type === 'trigger-data-change'));
  if (triggerNode) {
    triggerNode.options.name = submitText || triggerNode.options.name;
    selectOptions.unshift(triggerNode);
  }

  return selectOptions.filter((item) => {
    if (!isRevertRange) return true;
    return revertRange.includes(item.uid);
  });
};

export const getTodoDefaultBackNodeId = (
  todo?: TODO,
  fallbackFlows: ProcessFlow[] = [],
  submitText = '',
) => {
  return getTodoBackNodeOptions(todo, fallbackFlows, submitText)[0]?.uid;
};
