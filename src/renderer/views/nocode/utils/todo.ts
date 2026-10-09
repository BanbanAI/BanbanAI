import { ProcessFlow } from "@common/types/project";
import { ProcessNodeType, TimeTaskRepeat, isTimeTaskSingleTriggerMode } from "@common/types/project";
import { SystemField } from "@common/utils";
import i18next from "i18next";
import { TODO } from "@common/types/nocode";

export const isSingleOnceTimeTaskTodo = (flows: ProcessFlow[] = []) => {
  if (!Array.isArray(flows) || flows.length === 0) return false;

  const matchFlow = (flow?: ProcessFlow): boolean => {
    if (
      flow?.type === ProcessNodeType.TRIGGER_TIME_TASK
      && flow?.options?.repeat === TimeTaskRepeat.ONECE
      && isTimeTaskSingleTriggerMode(flow?.options)
    ) {
      return true;
    }

    if (!Array.isArray(flow?.branches) || flow.branches.length === 0) return false;
    return flow.branches.some((branch) => Array.isArray(branch?.flows) && branch.flows.some((branchFlow) => matchFlow(branchFlow)));
  };

  return flows.some((flow) => matchFlow(flow));
};

export const isSingleOnceTimeTaskDisplayTodo = (todo?: Pick<TODO, "singleOnceTimeTask" | "flows"> | null) => {
  if (typeof todo?.singleOnceTimeTask === "boolean") return todo.singleOnceTimeTask;
  return isSingleOnceTimeTaskTodo(todo?.flows || []);
};

export const isOperationEmptyRowDisplayTodo = (todo?: Pick<TODO, "operationTriggerActionName"> | null) => {
  return Boolean(String(todo?.operationTriggerActionName || "").trim());
};

export const getOperationEmptyRowDisplayText = (
  todo: Pick<TODO, "operationTriggerActionName"> | null | undefined,
  prefixKey: string,
  suffixKey: string,
) => {
  const actionName = String(todo?.operationTriggerActionName || "").trim();
  if (!actionName) return "";
  return `${i18next.t(prefixKey)}${actionName}${i18next.t(suffixKey)}`;
};

export const getTodoDataTitle = (
  todo?: Pick<TODO, "fields" | "data"> | null,
) => {
  const titleFieldUid = todo?.fields?.find(field => field.meta?.name === SystemField.DATA_TITLE)?.uid;
  if (!titleFieldUid) return "";

  const titleValue = todo?.data?.[titleFieldUid];
  if (Array.isArray(titleValue)) {
    return titleValue
      .filter(item => item !== undefined && item !== null && item !== "")
      .map(item => String(item).trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(titleValue ?? "").trim();
};
