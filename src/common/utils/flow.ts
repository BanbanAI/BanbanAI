import { AddTodoOptions, FormConditionValueType, RuleFunc } from "@common/types/nocode";
import { ConditionBranchConditionGroup, DataChangeType, Field, FormOption, NocodeProcess, ProcessBranch, ProcessFlow, ProcessNodeType, ProcessVersionStatus, Row, SubformConditionMatchMode, TableUID } from "@common/types/project"
import { replaceByFormula, replaceColFieldsByFormula, createFormulaRuntimeByData } from "./formula";
import { deepClone, isEmpty, equals } from "@common/utils/object";
import dayjs from "dayjs";
import { getDynamicValue } from "./connection";

export const isTriggerNode = (type: ProcessNodeType) => {
  return [
    ProcessNodeType.TRIGGER_DATA_CHANGE,
    ProcessNodeType.TRIGGER_MANUAL,
    ProcessNodeType.TRIGGER_OPERATION,
    ProcessNodeType.TRIGGER_TIME_TASK,
  ].includes(type);
}

export const isBranchNode = (type: ProcessNodeType) => {
  return [ProcessNodeType.CONDITION_BRANCH, ProcessNodeType.PARALLEL_BRANCH].includes(type);
}

export const isDataProcessingNode = (type: ProcessNodeType) => {
  return [ProcessNodeType.ADD_DATA, ProcessNodeType.EDIT_DATA, ProcessNodeType.DELETE_DATA].includes(type);
}

export const getFlows = (process: NocodeProcess, version?: number): ProcessFlow[] => {
  if (!process) return null;
  if (process.flows && !process.flowsByVersion) {
    const flows = process.flows;
    if (!flows) return null;
    const _flows = flows.splice(1, flows.length - 2);
    flows[0] = {
      ...flows[0],
      branches: !isEmpty(_flows) ? [
        {
          uid: "data0change0",
          type: ProcessNodeType.START,
          flows: _flows,
        }
      ] : []
    }
    process.flowsByVersion = {
      v1: flows
    }
    process.version = 1;
    delete process.flows;
    return flows;
  }
  version = version ?? process.version ?? 1;
  if (process.flowsByVersion) {
    return process.flowsByVersion[`v${version}`];
  }
}

export const getProcessVersionNumbers = (process?: NocodeProcess | null): number[] => {
  if (!process) {
    return [];
  }
  if (process.flows && !process.flowsByVersion) {
    getFlows(process, process.version ?? 1);
  }
  const versionNumbers = Object.keys(process.flowsByVersion || {})
    .map((key) => {
      const match = /^v(\d+)$/.exec(key);
      return match ? Number(match[1]) : NaN;
    })
    .filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(versionNumbers)).sort((left, right) => left - right);
}

export const getEnabledProcessVersion = (process?: NocodeProcess | null) => {
  if (!process?.enabled || !Number.isInteger(process.version) || process.version <= 0) {
    return null;
  }
  return hasProcessVersion(process, process.version) ? process.version : null;
}

export const getProcessVersionStatus = (process?: NocodeProcess | null, version?: number | null) => {
  if (!process || !Number.isInteger(version) || version <= 0) {
    return null;
  }
  const key = getProcessVersionKey(version);
  const explicitStatus = process.versionStatusByVersion?.[key];
  if (explicitStatus) {
    return explicitStatus;
  }
  const enabledVersion = getEnabledProcessVersion(process);
  if (!enabledVersion) {
    return ProcessVersionStatus.DESIGNING;
  }
  if (version === enabledVersion) {
    return ProcessVersionStatus.ENABLED;
  }
  return version > enabledVersion ? ProcessVersionStatus.DESIGNING : ProcessVersionStatus.HISTORY;
}

export const getProcessVersionStatusMap = (process?: NocodeProcess | null) => {
  const versionStatusMap: Record<string, ProcessVersionStatus> = {};
  for (const version of getProcessVersionNumbers(process)) {
    versionStatusMap[getProcessVersionKey(version)] = getProcessVersionStatus(process, version) || ProcessVersionStatus.DESIGNING;
  }
  return versionStatusMap;
}

export const setProcessVersionStatus = (process: NocodeProcess, version: number, status: ProcessVersionStatus) => {
  if (!process || !Number.isInteger(version) || version <= 0) {
    return;
  }
  process.versionStatusByVersion = process.versionStatusByVersion || {};
  process.versionStatusByVersion[getProcessVersionKey(version)] = status;
}

export const getMaxProcessVersion = (process?: NocodeProcess | null) => {
  const versions = getProcessVersionNumbers(process);
  return versions.length ? versions[versions.length - 1] : 0;
}

export const hasProcessVersion = (process?: NocodeProcess | null, version?: number | null) => {
  if (!process || !Number.isInteger(version) || version <= 0) {
    return false;
  }
  return getProcessVersionNumbers(process).includes(version);
}

export const getProcessVersionKey = (version: number) => `v${version}` as const;

export const hasProcessBranches = (process?: NocodeProcess | null, version?: number | null) => {
  const flows = getFlows(process, version ?? undefined);
  return !isEmpty(flows?.[0]?.branches);
}

export const canEnableProcessVersion = (process?: NocodeProcess | null, version?: number | null) => {
  return hasProcessVersion(process, version) && hasProcessBranches(process, version);
}

export const canDisableProcessVersion = (process?: NocodeProcess | null, version?: number | null) => {
  const enabledVersion = getEnabledProcessVersion(process);
  return !!enabledVersion && enabledVersion === version && hasProcessVersion(process, version);
}

export const hasPublishedProcess = (process?: NocodeProcess | null) => {
  if (!process) {
    return false;
  }
  return getProcessVersionNumbers(process).some((version) => {
    const status = getProcessVersionStatus(process, version);
    return [ProcessVersionStatus.ENABLED, ProcessVersionStatus.HISTORY].includes(status)
      && hasProcessBranches(process, version);
  });
}

export const isProcessTable = (formOption: FormOption) => {
  if(isEmpty(formOption)) {
    return false
  }
  if(hasPublishedProcess(formOption?.process)) {
    return true
  }
  return false
}

export const getDataChangeTriggerBranch = (
  flows: ProcessFlow[] = [],
  changeType: DataChangeType,
  options: {
    requireAllowStash?: boolean,
    requireNextFlow?: boolean,
  } = {},
): ProcessBranch | null => {
  const startNode = flows?.[0];
  const branches = startNode?.branches || [];
  const branch = branches.find((item) => {
    const triggerNode = item?.flows?.[0];
    if (triggerNode?.type !== ProcessNodeType.TRIGGER_DATA_CHANGE) {
      return false;
    }
    if (!triggerNode.options?.changeType?.includes(changeType)) {
      return false;
    }
    if (options.requireAllowStash && triggerNode.options?.allowStash !== true) {
      return false;
    }
    if (options.requireNextFlow && item?.flows?.length < 2) {
      return false;
    }
    return true;
  });
  return branch || null;
}

export const isDataChangeTriggerStashEnabled = (
  process: NocodeProcess | null | undefined,
  changeType: DataChangeType,
) => {
  const flows = getFlows(process);
  const branch = getDataChangeTriggerBranch(flows, changeType, {
    requireAllowStash: true,
    requireNextFlow: true,
  });
  return !!branch;
}

export const getFlowById = (flows: ProcessFlow[], uid: string): ProcessFlow => {
  for (const flow of flows || []) {
    if (flow.uid === uid) {
      return flow;
    }
    if (!isEmpty(flow.branches)) {
      for (const branch of flow.branches) {
        const _flow = getFlowById(branch.flows, uid);
        if (_flow) {
          return _flow;
        }
      }
    }
  }
}

export const getNextFlow = (flows: ProcessFlow[], uid: string): ProcessFlow => {
  const dfs = (flows: ProcessFlow[], uid: string, parent?: { flows: ProcessFlow[]; index: number; parentCtx?: any }): ProcessFlow => {
    for (let i = 0; i < flows.length; i++) {
      const flow = flows[i]

      if (flow.uid === uid) {
        if (i + 1 < flows.length) {
          return flows[i + 1]
        }
        return backtrack(parent)
      }

      if (flow.branches) {
        for (const branch of flow.branches) {
          const found = dfs(branch.flows, uid, { flows, index: i, parentCtx: parent })
          if (found) return found
        }
      }
    }
    return null
  }

  const backtrack = (ctx?: { flows: ProcessFlow[]; index: number; parentCtx?: any }): ProcessFlow => {
    if (!ctx) return null
    const { flows, index, parentCtx } = ctx
    if (index + 1 < flows.length) {
      return flows[index + 1]
    }
    return backtrack(parentCtx)
  }

  return dfs(flows, uid)
}

export const getNextFlowBySkips = (
  flows: ProcessFlow[],
  uid: string,
  skipFlowIds: string[] = [],
): ProcessFlow => {
  const skippedFlows = getSkippedFlows(flows, uid, skipFlowIds);
  const lastSkippedFlow = skippedFlows.at(-1);
  return getNextFlow(flows, lastSkippedFlow?.uid || uid);
}

export const getSkippedFlows = (
  flows: ProcessFlow[],
  uid: string,
  skipFlowIds: string[] = [],
): ProcessFlow[] => {
  const skipSet = new Set(skipFlowIds || []);
  const visited = new Set<string>();
  const skippedFlows: ProcessFlow[] = [];
  let nextFlow = getNextFlow(flows, uid);

  while (nextFlow && skipSet.has(nextFlow.uid) && !visited.has(nextFlow.uid)) {
    visited.add(nextFlow.uid);
    skippedFlows.push(nextFlow);
    nextFlow = getNextFlow(flows, nextFlow.uid);
  }

  return skippedFlows;
}

export const getFollowingFlows = (
  flows: ProcessFlow[],
  uid: string,
): ProcessFlow[] => {
  const result: ProcessFlow[] = [];
  const visited = new Set<string>();
  let nextFlow = getNextFlow(flows, uid);

  while (nextFlow && !visited.has(nextFlow.uid)) {
    visited.add(nextFlow.uid);
    result.push(nextFlow);
    nextFlow = getNextFlow(flows, nextFlow.uid);
  }

  return result;
}

export const getOwnerBranchFlow = (flows: ProcessFlow[], uid: string): ProcessFlow => {
  const dfs = (flows: ProcessFlow[], parentFlow?: ProcessFlow): ProcessFlow => {
    for (const flow of flows) {
      if (flow.branches) {
        for (const branch of flow.branches) {
          for (const bFlow of branch.flows) {
            if (bFlow.uid === uid) {
              return flow
            }
          }
          const found = dfs(branch.flows, flow)
          if (found) return found
        }
      }

      if (flow.uid === uid) {
        return parentFlow ?? null
      }
    }
    return null
  }

  return dfs(flows, undefined)
}

type FlowTraceItem = {
  flows: ProcessFlow[],
  index: number,
}

const getFlowTrace = (
  flows: ProcessFlow[],
  uid: string,
  trace: FlowTraceItem[] = [],
): FlowTraceItem[] => {
  for (let i = 0; i < (flows || []).length; i++) {
    const flow = flows[i];
    const nextTrace = [...trace, { flows, index: i }];
    if (flow.uid === uid) {
      return nextTrace;
    }
    for (const branch of flow.branches || []) {
      const branchTrace = getFlowTrace(branch.flows, uid, nextTrace);
      if (!isEmpty(branchTrace)) {
        return branchTrace;
      }
    }
  }
  return [];
}

const cloneRollbackReplayFlows = (
  trace: FlowTraceItem[],
  startIndex = 0,
): ProcessFlow[] => {
  if (isEmpty(trace)) return [];

  const [{ flows, index }] = trace;
  const sourceFlows = flows.slice(startIndex, index + 1);
  const replayFlows = deepClone(sourceFlows).map(flow => {
    delete flow["status"];
    return flow;
  });
  if (trace.length <= 1 || isEmpty(replayFlows)) {
    return replayFlows;
  }

  const sourceLastFlow = sourceFlows.at(-1);
  const replayLastFlow = replayFlows.at(-1);
  const nextTraceItem = trace[1];
  const targetBranch = sourceLastFlow?.branches?.find(branch => branch.flows === nextTraceItem.flows);
  if (!targetBranch || !replayLastFlow) {
    return replayFlows;
  }

  replayLastFlow.branches = (replayLastFlow.branches || [])
    .filter(branch => branch.uid === targetBranch.uid)
    .map(branch => ({
      ...branch,
      flows: cloneRollbackReplayFlows(trace.slice(1), 0),
    }));

  return replayFlows;
}

export type RollbackReplayPlan = {
  backFlowId: string,
  insertAfterFlowId: string,
  replayFlows: ProcessFlow[],
}

export const getRollbackReplayPlan = (
  flows: ProcessFlow[],
  backId: string,
  uid: string,
): RollbackReplayPlan | null => {
  const backTrace = getFlowTrace(flows, backId);
  const currentTrace = getFlowTrace(flows, uid);
  if (isEmpty(backTrace) || isEmpty(currentTrace)) return null;

  const backTraceItem = backTrace.at(-1);
  const currentTraceIndex = currentTrace.findLastIndex(item => item.flows === backTraceItem.flows);
  if (currentTraceIndex === -1) return null;

  const currentTraceItem = currentTrace[currentTraceIndex];
  if (currentTraceItem.index < backTraceItem.index) return null;

  const insertAfterFlowId = backTraceItem.flows[currentTraceItem.index]?.uid;
  const replayFlows = cloneRollbackReplayFlows(currentTrace.slice(currentTraceIndex), backTraceItem.index);
  if (!insertAfterFlowId || isEmpty(replayFlows)) return null;

  return {
    backFlowId: backId,
    insertAfterFlowId,
    replayFlows,
  };
}

export const isRollbackTargetFlow = (flow?: ProcessFlow) => {
  if (!flow) return false;
  return isRollbackSubmitNode(flow) || [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(flow.type);
}

export const canRollbackFlow = (flow?: ProcessFlow) => {
  if (!flow) return false;
  if (![ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(flow.type)) return false;
  if (flow.type === ProcessNodeType.TRANSACT) {
    return flow.options?.allowRevert !== false;
  }
  return !!flow.options?.allowRevert;
}

export const isRollbackSubmitNode = (flow?: ProcessFlow) => {
  if (!flow) return false;
  return [
    ProcessNodeType.TRIGGER_DATA_CHANGE,
    ProcessNodeType.TRIGGER_MANUAL,
    ProcessNodeType.TRIGGER_OPERATION,
  ].includes(flow.type);
}

export const getRollbackTargetFlows = (
  flows: ProcessFlow[],
  uid: string,
  revertRange?: string[],
): ProcessFlow[] => {
  const trace = getFlowTrace(flows, uid);
  if (isEmpty(trace)) return [];

  const hasRevertRange = Array.isArray(revertRange);
  const revertRangeSet = hasRevertRange ? new Set(revertRange) : null;
  const rollbackTargetMap = new Map<string, ProcessFlow>();

  for (const traceItem of trace) {
    for (let i = 0; i < traceItem.index; i++) {
      const candidate = traceItem.flows[i];
      if (!isRollbackTargetFlow(candidate)) continue;
      if (!isRollbackSubmitNode(candidate) && !canRollbackFlow(candidate)) continue;
      if (revertRangeSet && !revertRangeSet.has(candidate.uid)) continue;
      if (!rollbackTargetMap.has(candidate.uid)) {
        rollbackTargetMap.set(candidate.uid, candidate);
      }
    }
  }

  return Array.from(rollbackTargetMap.values());
}

export const getLastFlowById = (flows: ProcessFlow[], uid: string): ProcessFlow | null => {
  for (let i = (flows || []).length - 1; i >= 0; i--) {
    const flow = flows[i];
    if (flow.uid === uid) {
      return flow;
    }
    for (let j = (flow.branches || []).length - 1; j >= 0; j--) {
      const foundFlow = getLastFlowById(flow.branches[j].flows, uid);
      if (foundFlow) {
        return foundFlow;
      }
    }
  }
}

export const getLastOwnerBranchFlow = (flows: ProcessFlow[], uid: string): ProcessFlow | null => {
  const dfs = (
    currentFlows: ProcessFlow[],
    parentFlow?: ProcessFlow,
  ): {
    found: boolean,
    owner: ProcessFlow | null,
  } => {
    for (let i = (currentFlows || []).length - 1; i >= 0; i--) {
      const flow = currentFlows[i];
      if (flow.uid === uid) {
        return {
          found: true,
          owner: parentFlow ?? null,
        };
      }
      for (let j = (flow.branches || []).length - 1; j >= 0; j--) {
        const branch = flow.branches[j];
        if (branch.flows.some(branchFlow => branchFlow.uid === uid)) {
          return {
            found: true,
            owner: flow,
          };
        }
        const foundFlow = dfs(branch.flows, flow);
        if (foundFlow.found) {
          return foundFlow;
        }
      }
    }

    return {
      found: false,
      owner: null,
    };
  }

  return dfs(flows).owner;
}

export const isEqual = (a: any, b: any, strict = true) => {
  if (strict) return equals(a, b);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const mapA = new Map();
    const mapB = new Map();

    for (const item of a) {
      mapA.set(item, (mapA.get(item) || 0) + 1);
    }
    for (const item of b) {
      mapB.set(item, (mapB.get(item) || 0) + 1);
    }
    if (mapA.size !== mapB.size) return false;
    for (const [key, count] of mapA) {
      if (mapB.get(key) !== count) return false;
    }
    return true;
  } else if (a instanceof Object && b instanceof Object) {
    if (Object.keys(a).length !== Object.keys(b).length) return false;
    for (const key in a) {
      if (!isEqual(a[key], b[key], false)) return false;
    }
    return true;
  }
  return a == b
}
export const funcMap = {
  [RuleFunc.EQUAL]: (a: any, b: any) => isEqual(a, b, false),
  [RuleFunc.NOT_EQUAL]: (a: any, b: any) => !isEqual(a, b, false),
  [RuleFunc.GT]: (a: any, b: any) => a > b,
  [RuleFunc.GTE]: (a: any, b: any) => a >= b,
  [RuleFunc.LT]: (a: any, b: any) => a < b,
  [RuleFunc.LTE]: (a: any, b: any) => a <= b,
  [RuleFunc.IN]: (a: any, b: any) => b.includes(a),
  [RuleFunc.NOT_IN]: (a: any, b: any) => !b.includes(a),
  [RuleFunc.CONTAIN]: (a: any, b: any) => a?.includes(b),
  [RuleFunc.NOT_CONTAIN]: (a: any, b: any) => !a?.includes(b),
  [RuleFunc.BETWEEN]: (a: any, b: any) => b[0] <= a && a <= b[1],
  [RuleFunc.TIME_EQUAL]: (a: any, b: any) => {
    return dayjs(a).isSame(dayjs(b), "day");
  },
  [RuleFunc.TIME_NOT_EQUAL]: (a: any, b: any) => {
    return !dayjs(a).isSame(dayjs(b), "day");
  },
  [RuleFunc.TIME_LTE]: (a: any, b: any) => {
    return dayjs(a).isBefore(dayjs(b), "day") || dayjs(a).isSame(dayjs(b), "day");
  },
  [RuleFunc.TIME_BETWEEN]: (a: any, b: any) => {
    return (dayjs(a).isBefore(dayjs(b[1]), "day") || dayjs(a).isSame(dayjs(b[1]), "day")) && (dayjs(a).isAfter(dayjs(b[0]), "day") || dayjs(a).isSame(dayjs(b[0]), "day"));
  },
  [RuleFunc.CONTAIN_ANY]: (a: any, b: any) => {
    if (!Array.isArray(a)) a = a.split(",");
    if (!Array.isArray(b)) b = b.split(",");
    return b.some((item: any) => a.includes(item));
  },
  [RuleFunc.CONTAIN_ALL]: (a: any, b: any) => {
    if (!Array.isArray(a)) a = a.split(",");
    if (!Array.isArray(b)) b = b.split(",");
    return b?.every((item: any) => a.includes(item));
  },
  [RuleFunc.BELONG]: (a: any, b: any) => a?.includes(b),
  [RuleFunc.NOT_BELONG]: (a: any, b: any) => !a?.includes(b),
  [RuleFunc.EMPTY]: (a: any, b: any) => (['', NaN].includes(a) || isEmpty(a)),
  [RuleFunc.NOT_EMPTY]: (a: any, b: any) => !(['', NaN].includes(a) || isEmpty(a)),
  [RuleFunc.DYNAMIC]: (a: any, b: any) => {
    const transB = getDynamicValue(b);
    return transB.$gte <= a && a <= transB.$lte;
  },
  [RuleFunc.TRUE]: (a: any, b: any) => (a === true) || (a === "true"),
  [RuleFunc.FALSE]: (a: any, b: any) => (a === false) || (a === "false"),
}

export const isMeetSubformConditionRows = (
  rows: Row[] | null | undefined,
  matchMode: SubformConditionMatchMode | undefined,
  predicate: (row: Row) => boolean,
) => {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return matchMode === SubformConditionMatchMode.ALL
    ? rows.every(predicate)
    : rows.some(predicate);
}

export const isMeetConditionsByRow = (row: Row, conditionGroups: ConditionBranchConditionGroup[], sourceTableRows: Record<TableUID, Row[]>, fields: Field[]) => {
  let errorMsg = "";
  const valid = conditionGroups.some(conditions => {
    errorMsg = conditions[0]?.errorTip;
    return conditions.every((condition) => {
      if (condition.type === FormConditionValueType.FORMULA) {
        condition.formula = replaceColFieldsByFormula(condition.formula, (keys) => {
          const [sourceUID, fieldId, subFieldId] = keys;
          const rows = sourceTableRows[sourceUID];
          const fieldValue = rows?.map(row => row[fieldId]);
          if (isEmpty(fieldValue)) return null;

          if (subFieldId) {
            return fieldValue.flatMap(rows => rows.map(item => item[subFieldId]));
          } else {
            return fieldValue;
          }
        })
        condition.formula = replaceByFormula(condition.formula, (keys) => {
          const [sourceUID, fieldId, subFieldId] = keys;
          const rows = sourceTableRows[sourceUID];
          if (isEmpty(rows)) return null;
          let fieldValue = rows[0]?.[fieldId];
          fieldValue = Number.isNaN(fieldValue) ? 0 : fieldValue
          if (subFieldId) {
            return fieldValue.map(row => row[subFieldId]);
          } 
          return fieldValue;
        })

        const formulaRuntime = createFormulaRuntimeByData(row, fields);

        try {
          const value = formulaRuntime.evaluate(condition.formula);
          if (typeof value !== 'boolean') return false;
          return value;
        } catch (err) {
          return false;
        }
      }
      if(condition.type === FormConditionValueType.FILTER_ROW) {
        if(!sourceTableRows?.[condition.uid]) return false
        return funcMap[condition.func]?.(sourceTableRows?.[condition.uid].length, condition.value);
      };
      const arr = condition.uid?.split?.('.')
      if(arr?.length === 1) {
        return funcMap[condition.func]?.(row[condition.uid] ?? condition.uid, condition.value);
      } else {
        if(isEmpty(arr)) return false;
        const isSubTable = arr.length > 2;
        const sourceUID = arr[0] as TableUID;
        const sourceFieldUID = arr[1]
        const rows = sourceTableRows[sourceUID] || [];
        if (isEmpty(rows)) return false;
        const fieldValue = rows?.[0]?.[sourceFieldUID]
        if(isSubTable) {
          const subFieldUID = arr[2]
          return isMeetSubformConditionRows(
            fieldValue,
            condition.subformMatchMode,
            subRow => Boolean(funcMap[condition.func]?.(subRow?.[subFieldUID], condition.value)),
          );
        } else {
          return funcMap[condition.func]?.(fieldValue, condition.value);
        }
      }
    });
  })

  return {
    valid,
    errorMsg,
  }
}

type Payload = {
  nocodeId: string;
  tableId: TableUID;
  flows: ProcessFlow[];
  row: Row;
  rowUuid: string;
  currentFlows: ProcessFlow[];
  processVersion: number;
  emptyRowTrigger?: boolean;
}

export interface ScheduledTask {
  id: string;
  triggerAt: number; // 时间戳
  options: AddTodoOptions;
  payload: Payload,
}

export class SubscribeTaskManager {
  /**
   * 1. 需要存addNextNode的参数
   * 2. 需要存重复任务的下次参数
   */
  private tasks: ScheduledTask[] = [];

  addTask(task: ScheduledTask) {
    // 使用二分查找插入位置，保持数组按 triggerAt 升序
    let left = 0;
    let right = this.tasks.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.tasks[mid].triggerAt < task.triggerAt) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    this.tasks.splice(left, 0, task);
  }
  getAllTask() {
    return this.tasks;
  }
  deleteTask(id: string) {
    if (!id) return false
    const index = this.tasks.findIndex(task=> task.id === id)
    if (index === -1) {
      return false
    } 
    this.tasks.splice(index, 1);
    return true;
  }
  deleteAllByNocodeId(nocodeId: string) {
    if (!nocodeId) return

    this.tasks = this.tasks.filter(task => {
      return task.payload.nocodeId !== nocodeId
    })
  }
  deleteByRow(rowId: string) {
    if (!rowId) return;

    this.tasks = this.tasks.filter(task => {
      return task.payload.rowUuid !== rowId;
    });
  }
  getTaskByTime(from: number, to: number) {
    // 找到需要执行的任务
    // 二分查找第一个 >= from 的位置
    const start = this.lowerBound(from);
    // 二分查找第一个 > to 的位置
    const end = this.upperBound(to);

    return this.tasks.slice(start, end);
  }
    // 找到第一个 triggerAt >= target 的索引
  private lowerBound(target: number): number {
    let left = 0;
    let right = this.tasks.length;

    while (left < right) {
      const mid = (left + right) >> 1;
      if (this.tasks[mid].triggerAt < target) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  }
    // 找到第一个 triggerAt > target 的索引
  private upperBound(target: number): number {
    let left = 0;
    let right = this.tasks.length;

    while (left < right) {
      const mid = (left + right) >> 1;
      if (this.tasks[mid].triggerAt <= target) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  }
}
