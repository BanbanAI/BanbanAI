import { ApprovalCategoryRule, ProcessNodeOwnerType, ProcessNodeType } from '@common/types/project';

type TimelineOwner = Partial<Record<ProcessNodeOwnerType, boolean | { users?: string[] }>>;

type TimelineFlow = {
  type?: string,
  operator?: string | string[],
  data?: {
    paddingOperators?: string[],
  },
  options?: {
    categoryRule?: ApprovalCategoryRule,
    approver?: TimelineOwner,
    transactor?: TimelineOwner,
    notifier?: TimelineOwner,
    reporter?: TimelineOwner,
  },
}

const TIMEOUT_AUTO_ACTION_SET = new Set(["submit", "back"]);

const normalizeOperatorIds = (value: any) => {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
};

const getFlowMetas = (flow: any) => {
  if (!flow?.data?.metas || typeof flow.data.metas !== "object") {
    return {};
  }
  return flow.data.metas;
};

export const resolveTransactTempOperator = (flow: TimelineFlow) => {
  const operator = Array.isArray(flow?.operator) ? flow.operator[0] : flow?.operator;
  return operator || flow?.data?.paddingOperators?.[0] || '';
};

export const splitFlowOperatorsByTimeoutAutoAction = (flow: any) => {
  const operators = normalizeOperatorIds(flow?.data?.operators);
  const metas = getFlowMetas(flow);
  const autoOperatorIds = operators.filter((userId) => TIMEOUT_AUTO_ACTION_SET.has(metas?.[userId]?.timeoutAutoAction));
  const autoOperatorIdSet = new Set(autoOperatorIds);

  return {
    manualOperatorIds: operators.filter((userId) => !autoOperatorIdSet.has(userId)),
    autoOperatorIds,
  };
};

export const isTimeoutAutoFlowItem = (flow: any) => {
  return Array.isArray(flow?.timeoutAutoOperatorIds) && flow.timeoutAutoOperatorIds.length > 0;
};

export const getTimeoutAutoFlowSource = (flow: any) => {
  if (!isTimeoutAutoFlowItem(flow)) {
    return null;
  }
  return flow.timeoutAutoSource || null;
};

const reorderIdsByConfiguredOrder = (operatorIds: string[] = [], configuredIds: string[] = []) => {
  if (operatorIds.length <= 1 || configuredIds.length <= 1) {
    return operatorIds;
  }

  const configuredIndex = new Map(
    configuredIds
      .filter(id => typeof id === 'string' && id)
      .map((id, index) => [id, index])
  );
  const matchedPositions: number[] = [];
  const matchedIds: string[] = [];

  operatorIds.forEach((id, index) => {
    if (!configuredIndex.has(id)) {
      return;
    }
    matchedPositions.push(index);
    matchedIds.push(id);
  });

  if (matchedIds.length <= 1) {
    return operatorIds;
  }

  matchedIds.sort((left, right) => configuredIndex.get(left)! - configuredIndex.get(right)!);

  const result = [...operatorIds];
  matchedPositions.forEach((position, index) => {
    result[position] = matchedIds[index];
  });
  return result;
}

const getFlowConfiguredOperatorOrder = (flow: TimelineFlow, startOperatorId = '') => {
  const options = flow?.options || {};
  const owner: TimelineOwner | null =
    flow?.type === ProcessNodeType.APPROVAL
      ? (options.categoryRule === ApprovalCategoryRule.NORMAL ? options.approver : null)
      : flow?.type === ProcessNodeType.TRANSACT
        ? options.transactor
        : flow?.type === ProcessNodeType.NOTIFY
          ? options.notifier
          : flow?.type === ProcessNodeType.REPORT_DATA
            ? options.reporter
            : null;

  if (!owner) {
    return [];
  }

  const configuredIds: string[] = [];
  if (owner[ProcessNodeOwnerType.SUBMITTER] && startOperatorId) {
    configuredIds.push(startOperatorId);
  }
  const assignee = owner[ProcessNodeOwnerType.ASSIGNEE];
  if (typeof assignee === 'object' && assignee?.users?.length) {
    configuredIds.push(...assignee.users);
  }
  return configuredIds;
}

export const sortFlowOperatorsByConfiguredOrder = (flow: TimelineFlow, operatorIds: string[] = [], startOperatorId = '') => {
  if (!Array.isArray(operatorIds) || operatorIds.length <= 1) {
    return operatorIds || [];
  }

  return reorderIdsByConfiguredOrder(
    operatorIds,
    getFlowConfiguredOperatorOrder(flow, startOperatorId),
  );
}
