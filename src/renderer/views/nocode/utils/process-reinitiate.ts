import { TODO } from "@common/types/nocode";
import { DataChangeType, ProcessNodeType, TODOTriggerType } from "@common/types/project";
import { formFlowApi } from "@renderer/utils/api";

export type ReInitiateMode = "add" | "edit";

type FlowRecordMeta = {
  source?: string,
};

const getTriggerSource = async (todo: TODO) => {
  const records = await formFlowApi.getFlowRecords({
    nocodeId: todo.nocodeId,
    tableId: todo.tableId,
    uuid: todo.uuid,
    todoId: todo.todoId,
  });
  const startRecord = (Array.isArray(records) ? records : [])
    .find(record => record?.type === ProcessNodeType.START);
  const metas = Object.values(startRecord?.metas || {}) as FlowRecordMeta[];
  return metas.find(meta => meta?.source)?.source || null;
};

const getConfiguredChangeTypes = (todo: TODO) => {
  const changeTypes = new Set<string>();
  for (const branch of todo.flows?.[0]?.branches || []) {
    const triggerNode = branch?.flows?.[0];
    if (triggerNode?.type !== ProcessNodeType.TRIGGER_DATA_CHANGE) continue;
    for (const changeType of triggerNode.options?.changeType || []) {
      changeTypes.add(changeType);
    }
  }
  return changeTypes;
};

export const resolveReInitiateMode = async (todo?: TODO | null): Promise<ReInitiateMode | null> => {
  if (!todo?.todoId) return null;
  const source = await getTriggerSource(todo);
  if (source === TODOTriggerType.ADD) return "add";
  if (source === TODOTriggerType.EDIT) return "edit";
  if (source) return null;
  const changeTypes = getConfiguredChangeTypes(todo);
  if (changeTypes.has(DataChangeType.ADD)) return "add";
  if (changeTypes.has(DataChangeType.EDIT)) return "edit";
  return null;
};
