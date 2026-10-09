import { createHash } from "node:crypto";
import type { ProcessFlow, ProcessNodeStatus, ProcessNodeType, Row, TableUID } from "@common/types/project";
import { getNextFlow } from "@common/utils";

/**
 * The worker-safe part of flow progression. This module is deliberately
 * side-effect free: it never imports Nest, MikroORM, RequestStorage or a
 * service. The main-process adapter decides whether and when to execute the
 * returned steps through a Gateway.
 */
export type FlowKernelTaskIdentity = {
  taskId: string;
  todoId?: string;
  leaseOwner: string;
  leaseVersion: number;
};

export type FlowGatewayCommandName =
  | "loadTaskSnapshot"
  | "executeTriggerCandidate"
  | "executeFlowNode"
  | "loadFlowExecutionContext"
  | "createOrGetFlowRecord"
  | "updateFlowData"
  | "beginStepExecution"
  | "completeStepExecution"
  | "applyDataMutation"
  | "dispatchChildTask"
  | "commitFlowTask";

export type FlowGatewayPayloads = {
  loadTaskSnapshot: { taskId: string };
  executeTriggerCandidate: {
    uuid: string;
    entryId: string;
    triggerRowSnapshot?: Row;
    beforeMutationRows?: Row[];
  };
  executeFlowNode: FlowNodeExecutionStep;
  loadFlowExecutionContext: { todoId: string };
  createOrGetFlowRecord: { nodeId: string; nodeType: ProcessNodeType; status: ProcessNodeStatus; processVersion?: number };
  updateFlowData: { status?: ProcessNodeStatus; stage?: string; todoId?: string; node?: { type: "add" | "update" | "delete"; value: string[] } };
  beginStepExecution: { stepKey: string };
  completeStepExecution: { stepKey: string; resultSnapshot?: unknown };
  applyDataMutation: { action: "add" | "update" | "delete"; targetNocodeId: string; targetTableId: TableUID; rows: Row[]; idempotencyKey: string };
  dispatchChildTask: { childOrdinal: number; payloadRef: string };
  commitFlowTask: { outcome: "completed" | "failed" | "unknown"; errorCode?: string; resultSnapshot?: unknown };
};

export type TypedFlowGatewayRequest<C extends FlowGatewayCommandName = FlowGatewayCommandName> =
  FlowKernelTaskIdentity & {
    requestId: string;
    sequence: number;
    command: C;
    idempotencyKey: string;
    payload: FlowGatewayPayloads[C];
  };

export type FlowGatewayRequest<TPayload extends Record<string, unknown> = Record<string, unknown>> =
  FlowKernelTaskIdentity & {
    requestId: string;
    sequence: number;
    command: FlowGatewayCommandName;
    idempotencyKey: string;
    payload: TPayload;
  };

export type FlowGatewayResponse<TPayload = unknown> = {
  requestId: string;
  sequence: number;
  accepted: boolean;
  retryable: boolean;
  payload?: TPayload;
  errorCode?: string;
};

/**
 * Keep RPC payloads small and explicit. A command may be retried only with
 * the same request/idempotency key; the Gateway must reject an older lease.
 */
export type FlowGatewayCommand = {
  request: TypedFlowGatewayRequest;
  response: FlowGatewayResponse;
};

export type FlowKernelNodeKind =
  | "terminal"
  | "pure_auto"
  | "wait_for_user"
  | "branch"
  | "data_mutation"
  | "external_side_effect"
  | "unsupported";

export type FlowKernelStep = {
  nodeId: string;
  nodeType: ProcessNodeType;
  kind: FlowKernelNodeKind;
  idempotencyKey: string;
  requiresGateway: boolean;
};

export type FlowKernelPlan = {
  taskId: string;
  todoId?: string;
  steps: FlowKernelStep[];
  /** False means the existing main-thread addNextNode path must run. */
  workerSafe: boolean;
  stopReason?: "gateway_required" | "branch_requires_runtime" | "unknown_node";
};

/**
 * A deliberately small node-level protocol. The worker may route only nodes
 * whose current main-thread semantics are a short, single-node operation.
 * Data mutations, branches and external effects are rejected before the first
 * Gateway call so the caller can run the complete legacy path atomically.
 */
export type FlowNodeExecutionAction = "skip" | "auto-approval" | "notify" | "terminal" | "execute";

export type FlowNodeExecutionStep = {
  nodeId: string;
  nodeType: ProcessNodeType;
  action: FlowNodeExecutionAction;
  idempotencyKey: string;
  nextNodeId?: string;
};

export type FlowNodeExecutionPlan = FlowKernelTaskIdentity & {
  steps: FlowNodeExecutionStep[];
  workerSafe: boolean;
  stopReason?: "unsupported_node" | "branch_requires_runtime" | "unknown_node" | "parallel_branch_owner";
};

export type BuildFlowNodeExecutionPlanInput = FlowKernelTaskIdentity & {
  flows: ProcessFlow[];
  startNodeId: string;
  skipNodeIds?: string[];
  maxSteps?: number;
};

export type BuildFlowKernelPlanInput = FlowKernelTaskIdentity & {
  flows: ProcessFlow[];
  startNodeId: string;
  maxSteps?: number;
};

export const buildFlowNodeExecutionSnapshot = (flows: ProcessFlow[]): ProcessFlow[] => {
  const snapshot: ProcessFlow[] = [];
  const visit = (items: ProcessFlow[]) => {
    for (const flow of items || []) {
      snapshot.push({ uid: flow.uid, type: flow.type } as ProcessFlow);
      for (const branch of flow.branches || []) visit(branch.flows || []);
    }
  };
  visit(flows);
  return snapshot;
};

const MAX_KERNEL_STEPS = 256;

const MAX_WORKER_NODE_STEPS = 128;

const nodeKind = (type: ProcessNodeType): FlowKernelNodeKind => {
  switch (type) {
  case "end":
    return "terminal";
  case "approval":
    return "wait_for_user";
  case "transact":
  case "notify":
  case "report-data":
    return "external_side_effect";
  case "add-data":
  case "edit-data":
  case "delete-data":
    return "data_mutation";
  case "condition-branch":
  case "parallel-branch":
  case "branch-setting":
    return "branch";
  case "start":
  case "trigger-data-change":
  case "trigger-time-task":
  case "trigger-manual":
  case "trigger-operation":
  case "junction":
    return "pure_auto";
  default:
    return "unsupported";
  }
};

const stepIdempotencyKey = (identity: FlowKernelTaskIdentity, nodeId: string, ordinal: number) => {
  const digest = createHash("sha256")
    // A reclaimed task receives a new leaseVersion, but it must retain the
    // same logical step identity so an unknown side effect is never replayed.
    .update(`${identity.taskId}:${identity.todoId || ""}:${nodeId}:${ordinal}`)
    .digest("hex")
    .slice(0, 24);
  return `flow-step:${identity.taskId}:${nodeId}:${digest}`;
};

const nodeExecutionAction = (node: ProcessFlow, skipped: boolean): FlowNodeExecutionAction | undefined => {
  if (skipped) return "skip";
  if (node.type === "approval" && node.options?.category === "auto-approve") return "auto-approval";
  if (node.type === "notify") return "notify";
  if (node.type === "end") return "terminal";
  return undefined;
};

export const buildFlowNodeExecutionStep = (
  input: FlowKernelTaskIdentity & { skipNodeIds?: string[] },
  node: ProcessFlow,
  ordinal: number,
): FlowNodeExecutionStep | undefined => {
  const kind = nodeKind(node.type);
  const action: FlowNodeExecutionAction | undefined = kind === "unsupported"
    ? undefined
    : input.skipNodeIds?.includes(node.uid)
      ? "skip"
      : node.type === "end" ? "terminal" : "execute";
  if (!action) return undefined;
  return {
    nodeId: node.uid,
    nodeType: node.type,
    action,
    idempotencyKey: stepIdempotencyKey(input, node.uid, ordinal),
  };
};

/**
 * Build a complete, preflighted route. Returning no steps on an unsupported
 * route is intentional: the main caller can then invoke legacy addNextNode
 * without risking a partial worker execution followed by a duplicate replay.
 */
export const buildFlowNodeExecutionPlan = (input: BuildFlowNodeExecutionPlanInput): FlowNodeExecutionPlan => {
  const maxSteps = Number.isInteger(input.maxSteps) && (input.maxSteps as number) > 0
    ? Math.min(input.maxSteps as number, MAX_WORKER_NODE_STEPS)
    : MAX_WORKER_NODE_STEPS;
  const skipSet = new Set(input.skipNodeIds || []);
  const steps: FlowNodeExecutionStep[] = [];
  const visited = new Set<string>();
  let nodeId: string | undefined = input.startNodeId;
  let stopReason: FlowNodeExecutionPlan["stopReason"];

  while (nodeId && !visited.has(nodeId) && steps.length < maxSteps) {
    visited.add(nodeId);
    const node = findFlowNode(input.flows, nodeId);
    if (!node) {
      stopReason = "unknown_node";
      break;
    }
    // A node nested under a parallel branch requires branch-record updates;
    // that coordination remains in the main process.
    if (findParallelBranchOwner(input.flows, node.uid)) {
      stopReason = "parallel_branch_owner";
      break;
    }
    const action = nodeExecutionAction(node, skipSet.has(node.uid));
    if (!action) {
      stopReason = node.branches?.length ? "branch_requires_runtime" : "unsupported_node";
      break;
    }
    const next = getNextFlow(input.flows, node.uid);
    steps.push({
      nodeId: node.uid,
      nodeType: node.type,
      action,
      idempotencyKey: stepIdempotencyKey(input, node.uid, steps.length),
      ...(next?.uid ? { nextNodeId: next.uid } : {}),
    });
    if (action === "terminal") break;
    nodeId = next?.uid;
  }

  if (!stopReason && nodeId && steps.length >= maxSteps) stopReason = "unsupported_node";
  // An end node is the only terminal boundary we can safely complete here.
  // A route that simply runs off the end of a branch still needs the legacy
  // branch/junction bookkeeping.
  if (!stopReason && steps.at(-1)?.action !== "terminal") stopReason = "unknown_node";
  return {
    taskId: input.taskId,
    ...(input.todoId ? { todoId: input.todoId } : {}),
    leaseOwner: input.leaseOwner,
    leaseVersion: input.leaseVersion,
    steps: stopReason ? [] : steps,
    workerSafe: !stopReason && steps.length > 0,
    ...(stopReason ? { stopReason } : {}),
  };
};

const findParallelBranchOwner = (flows: ProcessFlow[], targetId: string): boolean => {
  const visit = (items: ProcessFlow[], underParallel = false): boolean => {
    for (const flow of items || []) {
      const isParallel = underParallel || flow.type === "parallel-branch";
      if (flow.uid === targetId) return underParallel;
      if (flow.branches?.some(branch => visit(branch.flows || [], isParallel))) return true;
    }
    return false;
  };
  return visit(flows);
};

/** Build a conservative linear prefix. Branches and side effects stop the plan. */
export const buildFlowKernelPlan = (input: BuildFlowKernelPlanInput): FlowKernelPlan => {
  const maxSteps = Number.isInteger(input.maxSteps) && (input.maxSteps as number) > 0
    ? Math.min(input.maxSteps as number, MAX_KERNEL_STEPS)
    : MAX_KERNEL_STEPS;
  const steps: FlowKernelStep[] = [];
  const visited = new Set<string>();
  let nodeId: string | undefined = input.startNodeId;
  let stopReason: FlowKernelPlan["stopReason"];

  while (nodeId && steps.length < maxSteps && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = findFlowNode(input.flows, nodeId);
    if (!node) {
      stopReason = "unknown_node";
      break;
    }
    const kind = nodeKind(node.type);
    const requiresGateway = kind !== "pure_auto" && kind !== "terminal";
    steps.push({
      nodeId: node.uid,
      nodeType: node.type,
      kind,
      requiresGateway,
      idempotencyKey: stepIdempotencyKey(input, node.uid, steps.length),
    });
    // A branch can be nested under START/JUNCTION as well as represented by
    // a branch node. Its choice needs runtime row/context data, so never walk
    // into it as if it were a linear, pure step.
    if (kind === "branch" || (node.branches || []).length > 0) stopReason = "branch_requires_runtime";
    else if (requiresGateway) stopReason = "gateway_required";
    if (stopReason) break;
    if (kind !== "pure_auto") break;
    nodeId = getNextFlow(input.flows, node.uid)?.uid;
  }

  const reachedLimit = Boolean(nodeId && steps.length >= maxSteps);
  return {
    taskId: input.taskId,
    ...(input.todoId ? { todoId: input.todoId } : {}),
    steps,
    workerSafe: !stopReason && !reachedLimit,
    ...(stopReason ? { stopReason } : {}),
    ...(reachedLimit ? { stopReason: "unknown_node" as const } : {}),
  };
};

export const findFlowNode = (flows: ProcessFlow[], uid: string): ProcessFlow | undefined => {
  for (const flow of flows || []) {
    if (flow.uid === uid) return flow;
    const nested = findFlowNode(
      (flow.branches || []).flatMap(branch => branch.flows || []),
      uid,
    );
    if (nested) return nested;
  }
  return undefined;
};

export const isFlowGatewayCommand = (command: unknown): command is FlowGatewayCommandName => (
  typeof command === "string"
  && [
    "loadTaskSnapshot",
    "executeTriggerCandidate",
    "executeFlowNode",
    "loadFlowExecutionContext",
    "createOrGetFlowRecord",
    "updateFlowData",
    "beginStepExecution",
    "completeStepExecution",
    "applyDataMutation",
    "dispatchChildTask",
    "commitFlowTask",
  ].includes(command)
);

export const assertFlowGatewayRequest = (request: FlowGatewayRequest) => {
  if (!request || typeof request !== "object") throw new TypeError("Flow Gateway request is invalid");
  if (!request.taskId || !request.leaseOwner || !Number.isInteger(request.leaseVersion) || request.leaseVersion < 1) {
    throw new TypeError("Flow Gateway request identity is invalid");
  }
  if (!request.requestId || !Number.isInteger(request.sequence) || request.sequence < 1) {
    throw new TypeError("Flow Gateway request ordering is invalid");
  }
  if (!isFlowGatewayCommand(request.command)) throw new TypeError("Flow Gateway command is not allowed");
  if (!request.idempotencyKey || !request.payload || typeof request.payload !== "object") {
    throw new TypeError("Flow Gateway request payload is invalid");
  }
  return request;
};

export type FlowKernelRowSnapshot = {
  tableUID: TableUID;
  uuid: string;
  row?: Row;
  status?: ProcessNodeStatus;
};
