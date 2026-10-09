import type {
  FlowWorkerTaskRef,
  FlowWorkerTriggerPlanCandidate,
  FlowWorkerTriggerPlanItem,
  FlowWorkerTriggerExecutionCandidate,
  FlowWorkerTriggerExecutionResult,
} from "./modules/formData/flow-worker-pool";
import type { ConditionBranchConditionGroup, Field, ProcessFlow, Row, TableUID } from "@common/types/project";
import { getNextFlow, isMeetConditionsByRow } from "@common/utils";
import { evaluateImportBatchAggregationFormula } from "@common/utils/flow-import-aggregation";
import { buildFlowKernelPlan, buildFlowNodeExecutionStep, findFlowNode, isFlowGatewayCommand, type BuildFlowKernelPlanInput, type FlowKernelPlan, type BuildFlowNodeExecutionPlanInput, type FlowNodeExecutionPlan } from "./modules/formData/flow-execution-kernel";
import { threadId } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";
import { createHash, randomUUID } from "node:crypto";

let runtimeId: string | undefined;

export type FlowWorkerCommand = {
  kind: "load-task-ref";
  task: FlowWorkerTaskRef;
  requestId: string;
  sequence: number;
  gatewayPort: MessagePort;
} | {
  kind: "prepare-flow-task";
  task: FlowWorkerTaskRef;
  taskType: "data_mutation" | "view_action_trigger";
  stepKey: string;
  rowCount: number;
  requestId: string;
  sequence: number;
  gatewayPort: MessagePort;
} | {
  kind: "runtime-probe";
  delayMs?: number;
} | {
  kind: "evaluate-import-formula";
  formula: string;
  sourceRows: Row[];
  sourceTableUID: TableUID;
  currentRow: Row;
  sourceFields: Field[];
} | {
  kind: "evaluate-trigger-conditions";
  row: Row;
  conditions: ConditionBranchConditionGroup[];
  sourceTableRows: Record<TableUID, Row[]>;
  fields: Field[];
} | {
  kind: "plan-trigger-candidates";
  source: string;
  tableUID: TableUID;
  fields: Field[];
  flows: ProcessFlow[];
  candidates: FlowWorkerTriggerPlanCandidate[];
} | {
  kind: "execute-trigger-candidate";
  candidate: FlowWorkerTriggerExecutionCandidate;
  requestId: string;
  sequence: number;
  gatewayPort: MessagePort;
} | ({
  kind: "plan-flow-kernel";
} & BuildFlowKernelPlanInput) | {
  kind: "execute-flow-nodes";
  requestId: string;
  sequence: number;
  gatewayPort: MessagePort;
  input: BuildFlowNodeExecutionPlanInput;
};

type FlowWorkerTaskSnapshot = {
  status: string;
  leaseOwner?: string;
  leaseVersion?: number;
  leaseUntil?: number;
};

export type FlowWorkerRuntimeProbeResult = {
  threadId: number;
  runtimeId: string;
  dbType: string;
};

export type FlowWorkerValidationResult = {
  taskId: string;
  leaseOwner: string;
  leaseVersion: number;
  status?: string;
  accepted: boolean;
  requestId?: string;
  sequence?: number;
};

export type FlowWorkerExecutionPlan = FlowWorkerValidationResult & {
  stepKey: string;
  taskType: "data_mutation" | "view_action_trigger";
  rowCount: number;
  idempotencyKey: string;
  recordConcurrency: number;
};

export type FlowWorkerFormulaResult = {
  handled: boolean;
  value?: unknown;
};

export type FlowWorkerConditionResult = {
  valid: boolean;
  errorMsg?: string;
};

export type FlowWorkerNodeExecutionResult = {
  requestId: string;
  sequence: number;
  handled: boolean;
  plan: FlowNodeExecutionPlan;
};

function assertFormulaCommand(command: Extract<FlowWorkerCommand, { kind: "evaluate-import-formula" }>) {
  if (!command.formula || typeof command.formula !== "string") {
    throw new Error("Flow worker formula is invalid");
  }
  if (!Array.isArray(command.sourceRows) || !Array.isArray(command.sourceFields)) {
    throw new Error("Flow worker formula rows or fields are invalid");
  }
  if (!command.sourceTableUID || !command.currentRow || typeof command.currentRow !== "object") {
    throw new Error("Flow worker formula context is invalid");
  }
}

function assertConditionCommand(command: Extract<FlowWorkerCommand, { kind: "evaluate-trigger-conditions" }>) {
  if (!command.row || typeof command.row !== "object") {
    throw new Error("Flow worker condition row is invalid");
  }
  if (!Array.isArray(command.conditions) || !Array.isArray(command.fields)) {
    throw new Error("Flow worker condition input is invalid");
  }
  if (!command.sourceTableRows || typeof command.sourceTableRows !== "object") {
    throw new Error("Flow worker condition source rows are invalid");
  }
}

function assertTriggerPlanCommand(command: Extract<FlowWorkerCommand, { kind: "plan-trigger-candidates" }>) {
  if (!command.source || typeof command.source !== "string" || !command.tableUID) {
    throw new Error("Flow worker trigger plan context is invalid");
  }
  if (!Array.isArray(command.fields) || !Array.isArray(command.flows) || !Array.isArray(command.candidates)) {
    throw new Error("Flow worker trigger plan input is invalid");
  }
  for (const candidate of command.candidates) {
    if (!candidate || typeof candidate !== "object" || typeof candidate.uuid !== "string" || !Array.isArray(candidate.branches)) {
      throw new Error("Flow worker trigger plan candidate is invalid");
    }
    if (candidate.row !== undefined && (!candidate.row || typeof candidate.row !== "object")) {
      throw new Error("Flow worker trigger plan row is invalid");
    }
    for (const branch of candidate.branches) {
      if (!branch || typeof branch !== "object"
        || typeof branch.branchUid !== "string"
        || typeof branch.triggerNodeUid !== "string"
        || !Array.isArray(branch.changeTypes)
        || !Array.isArray(branch.conditions)
        || !branch.sourceTableRows
        || typeof branch.sourceTableRows !== "object") {
        throw new Error("Flow worker trigger plan branch is invalid");
      }
    }
  }
}

function planTriggerCandidates(command: Extract<FlowWorkerCommand, { kind: "plan-trigger-candidates" }>): FlowWorkerTriggerPlanItem[] {
  return command.candidates.map(candidate => {
    if (!candidate.row) return { uuid: candidate.uuid, matched: false };
    for (const branch of candidate.branches) {
      if (!branch.changeTypes.includes(command.source)) continue;
      const result = branch.conditions.length
        ? isMeetConditionsByRow(candidate.row, branch.conditions, branch.sourceTableRows, command.fields)
        : { valid: true };
      if (!result?.valid) continue;
      const nextNode = getNextFlow(command.flows, branch.triggerNodeUid);
      return {
        uuid: candidate.uuid,
        matched: true,
        branchUid: branch.branchUid,
        triggerNodeUid: branch.triggerNodeUid,
        ...(nextNode?.uid ? { nextNodeUid: nextNode.uid } : {}),
      };
    }
    return { uuid: candidate.uuid, matched: false };
  });
}

function assertTriggerExecutionCommand(command: Extract<FlowWorkerCommand, { kind: "execute-trigger-candidate" }>) {
  if (!command.candidate || typeof command.candidate !== "object"
    || typeof command.candidate.uuid !== "string"
    || !command.candidate.uuid
    || typeof command.candidate.entryId !== "string"
    || !command.candidate.entryId) {
    throw new Error("Flow worker trigger execution candidate is invalid");
  }
  if (!command.requestId || !Number.isInteger(command.sequence) || command.sequence < 1) {
    throw new Error("Flow worker trigger execution identity is invalid");
  }
}

function assertTaskRef(task: FlowWorkerTaskRef) {
  if (!task || typeof task !== "object") throw new Error("Flow worker task reference is missing");
  if (!task.taskId || typeof task.taskId !== "string") throw new Error("Flow worker task ID is invalid");
  if (!["p0", "p1", "p2"].includes(task.queueClass)) throw new Error("Flow worker queue class is invalid");
  if (!task.leaseOwner || typeof task.leaseOwner !== "string") throw new Error("Flow worker lease owner is invalid");
  if (!Number.isInteger(task.leaseVersion) || task.leaseVersion < 1) throw new Error("Flow worker lease version is invalid");
  if (!Number.isFinite(task.leaseUntil) || task.leaseUntil <= 0) throw new Error("Flow worker lease deadline is invalid");
  if (!Number.isInteger(task.attempt) || task.attempt < 1) throw new Error("Flow worker attempt is invalid");
}

function assertTaskSnapshot(snapshot: FlowWorkerTaskSnapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Flow worker task snapshot is missing");
  if (typeof snapshot.status !== "string") throw new Error("Flow worker task snapshot status is invalid");
  if (snapshot.leaseOwner !== undefined && typeof snapshot.leaseOwner !== "string") {
    throw new Error("Flow worker task snapshot lease owner is invalid");
  }
  if (snapshot.leaseVersion !== undefined && !Number.isInteger(snapshot.leaseVersion)) {
    throw new Error("Flow worker task snapshot lease version is invalid");
  }
  if (snapshot.leaseUntil !== undefined && !Number.isFinite(snapshot.leaseUntil)) {
    throw new Error("Flow worker task snapshot lease deadline is invalid");
  }
}

async function requestGateway<T>(port: MessagePort, requestId: string, sequence: number, command: string, payload: Record<string, unknown>, closePort = true): Promise<T> {
  if (!isFlowGatewayCommand(command)) {
    throw new Error("Flow worker Gateway command is not allowed");
  }
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      port.removeListener("message", onMessage);
      if (closePort) port.close();
      callback();
    };
    const onMessage = (response: { requestId?: string; sequence?: number; accepted?: boolean; payload?: T; error?: string } | null) => {
      if (!response || typeof response !== "object"
        || response.requestId !== requestId || response.sequence !== sequence) {
        settle(() => reject(new Error("Flow worker Gateway response identity mismatch")));
        return;
      }
      if (response.error) settle(() => reject(new Error(response.error)));
      else settle(() => resolve(response.payload as T));
    };
    port.on("message", onMessage);
    try {
      port.postMessage({ requestId, sequence, command, payload });
    } catch (error) {
      settle(() => reject(error));
    }
  });
}

function assertExecuteFlowNodesCommand(command: Extract<FlowWorkerCommand, { kind: "execute-flow-nodes" }>) {
  if (!command.requestId || !Number.isInteger(command.sequence) || command.sequence < 1) {
    throw new Error("Flow worker node execution identity is invalid");
  }
  if (!command.gatewayPort || typeof command.gatewayPort.postMessage !== "function") {
    throw new Error("Flow worker node execution Gateway is invalid");
  }
  if (!command.input || typeof command.input !== "object"
    || !command.input.taskId || !command.input.leaseOwner
    || !Number.isInteger(command.input.leaseVersion)
    || !Array.isArray(command.input.flows)
    || !command.input.startNodeId) {
    throw new Error("Flow worker node execution input is invalid");
  }
}

function assertPrepareFlowTaskCommand(command: Extract<FlowWorkerCommand, { kind: "prepare-flow-task" }>) {
  assertTaskRef(command.task);
  if (!["data_mutation", "view_action_trigger"].includes(command.taskType)) throw new Error("Flow worker task type is invalid");
  if (!command.stepKey || typeof command.stepKey !== "string") throw new Error("Flow worker step key is invalid");
  if (!Number.isInteger(command.rowCount) || command.rowCount < 0 || command.rowCount > 100_000) throw new Error("Flow worker row count is invalid");
  if (!command.requestId || !Number.isInteger(command.sequence) || command.sequence < 1) throw new Error("Flow worker request identity is invalid");
}

export default async function executeFlowWorker(command: FlowWorkerCommand): Promise<FlowWorkerValidationResult | FlowWorkerExecutionPlan | FlowWorkerRuntimeProbeResult | FlowWorkerFormulaResult | FlowWorkerConditionResult | FlowWorkerTriggerPlanItem[] | FlowWorkerTriggerExecutionResult | FlowKernelPlan | FlowWorkerNodeExecutionResult> {
  if (command?.kind === "evaluate-import-formula") {
    assertFormulaCommand(command);
    const value = evaluateImportBatchAggregationFormula(
      command.formula,
      command.sourceRows,
      command.sourceTableUID,
      command.currentRow,
      command.sourceFields,
    );
    return value === undefined ? { handled: false } : { handled: true, value };
  }
  if (command?.kind === "evaluate-trigger-conditions") {
    assertConditionCommand(command);
    return isMeetConditionsByRow(
      command.row,
      command.conditions,
      command.sourceTableRows,
      command.fields,
    );
  }
  if (command?.kind === "plan-trigger-candidates") {
    assertTriggerPlanCommand(command);
    return planTriggerCandidates(command);
  }
  if (command?.kind === "execute-trigger-candidate") {
    assertTriggerExecutionCommand(command);
    const result = await requestGateway<{ todoId?: string }>(
      command.gatewayPort,
      command.requestId,
      command.sequence,
      "executeTriggerCandidate",
      command.candidate as unknown as Record<string, unknown>,
    );
    return {
      uuid: command.candidate.uuid,
      ...(result?.todoId ? { todoId: String(result.todoId) } : {}),
    } satisfies FlowWorkerTriggerExecutionResult;
  }
  if (command?.kind === "execute-flow-nodes") {
    assertExecuteFlowNodesCommand(command);
    const maxSteps = Number.isInteger(command.input.maxSteps) && (command.input.maxSteps as number) > 0
      ? Math.min(command.input.maxSteps as number, 256)
      : 256;
    const pendingNodeIds = [command.input.startNodeId];
    const steps: FlowNodeExecutionPlan["steps"] = [];
    let sequence = command.sequence;
    try {
      while (pendingNodeIds.length) {
        if (steps.length >= maxSteps) {
          throw new Error("Flow worker node execution exceeded the step limit");
        }
        const nodeId = pendingNodeIds.shift()!;
        const node = findFlowNode(command.input.flows, nodeId);
        if (!node) throw new Error(`Flow worker node not found: ${nodeId}`);
        const step = buildFlowNodeExecutionStep(command.input, node, steps.length);
        if (!step) {
          if (!steps.length) {
            return {
              requestId: command.requestId,
              sequence,
              handled: false,
              plan: {
                taskId: command.input.taskId,
                ...(command.input.todoId ? { todoId: command.input.todoId } : {}),
                leaseOwner: command.input.leaseOwner,
                leaseVersion: command.input.leaseVersion,
                steps: [],
                workerSafe: false,
                stopReason: "unsupported_node",
              },
            };
          }
          throw new Error(`Flow worker node type is unsupported: ${node.type}`);
        }
        const result = await requestGateway<{ handled?: boolean; stop?: boolean; nextNodeIds?: string[] }>(
          command.gatewayPort,
          command.requestId,
          ++sequence,
          "executeFlowNode",
          step as unknown as Record<string, unknown>,
          false,
        );
        if (result?.handled !== true) throw new Error("Flow worker node Gateway did not handle the step");
        if (result.nextNodeIds !== undefined
          && (!Array.isArray(result.nextNodeIds)
            || result.nextNodeIds.some(nextNodeId => typeof nextNodeId !== "string" || !nextNodeId))) {
          throw new Error("Flow worker node Gateway returned invalid continuations");
        }
        steps.push(step);
        if (!result.stop) pendingNodeIds.push(...(result.nextNodeIds || []));
      }
      const plan: FlowNodeExecutionPlan = {
        taskId: command.input.taskId,
        ...(command.input.todoId ? { todoId: command.input.todoId } : {}),
        leaseOwner: command.input.leaseOwner,
        leaseVersion: command.input.leaseVersion,
        steps,
        workerSafe: true,
      };
      return {
        requestId: command.requestId,
        sequence,
        handled: true,
        plan,
      };
    } finally {
      command.gatewayPort.close();
    }
  }
  if (command?.kind === "plan-flow-kernel") {
    return buildFlowKernelPlan(command);
  }
  if (command?.kind === "prepare-flow-task") {
    assertPrepareFlowTaskCommand(command);
    const snapshot = await requestGateway<FlowWorkerTaskSnapshot>(command.gatewayPort, command.requestId, command.sequence, "loadTaskSnapshot", { taskId: command.task.taskId });
    assertTaskSnapshot(snapshot);
    const accepted = snapshot.status === "running"
      && snapshot.leaseOwner === command.task.leaseOwner
      && Number(snapshot.leaseVersion) === command.task.leaseVersion
      && Number(snapshot.leaseUntil || 0) > Date.now();
    const digest = createHash("sha256")
      .update(`${command.task.taskId}:${command.task.leaseVersion}:${command.stepKey}:${command.rowCount}`)
      .digest("hex");
    return {
      taskId: command.task.taskId,
      leaseOwner: command.task.leaseOwner,
      leaseVersion: command.task.leaseVersion,
      status: snapshot.status,
      accepted,
      requestId: command.requestId,
      sequence: command.sequence,
      stepKey: command.stepKey,
      taskType: command.taskType,
      rowCount: command.rowCount,
      idempotencyKey: `flow-step:${command.task.taskId}:${command.stepKey}:${digest.slice(0, 16)}`,
      recordConcurrency: command.task.queueClass === "p0" ? 1 : 2,
    };
  }
  if (command?.kind === "runtime-probe") {
    runtimeId ||= randomUUID();
    const delayMs = Number.isFinite(command.delayMs) ? Math.max(0, Math.min(5000, command.delayMs || 0)) : 0;
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    return {
      threadId,
      runtimeId,
      dbType: "gateway",
    };
  }
  if (command?.kind !== "load-task-ref") throw new Error("Unsupported flow worker command");
  assertTaskRef(command.task);
  if (typeof command.requestId !== "string" || !command.requestId) throw new Error("Flow worker request ID is invalid");
  if (!Number.isInteger(command.sequence) || command.sequence < 1) throw new Error("Flow worker sequence is invalid");
  const snapshot = await requestGateway<FlowWorkerTaskSnapshot>(
    command.gatewayPort,
    command.requestId,
    command.sequence,
    "loadTaskSnapshot",
    { taskId: command.task.taskId },
  );
  assertTaskSnapshot(snapshot);
  const accepted = snapshot.status === "running"
    && snapshot.leaseOwner === command.task.leaseOwner
    && Number(snapshot.leaseVersion) === command.task.leaseVersion
    && Number(snapshot.leaseUntil || 0) > Date.now();
  return {
    taskId: command.task.taskId,
    leaseOwner: command.task.leaseOwner,
    leaseVersion: command.task.leaseVersion,
    status: snapshot.status,
    accepted,
    requestId: command.requestId,
    sequence: command.sequence,
  };
}

export async function teardown() {
  runtimeId = undefined;
}
