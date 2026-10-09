import { ProcessNodeType, type ProcessFlow } from '../types/project';

export const NOCODE_EDITOR_FLOW_PATCH_MAX_OPERATIONS = 20;

export type NocodeEditorFlowPatchAddNodeType =
  | 'approval'
  | 'transact'
  | 'notify'
  | 'report-data'
  | 'add-data'
  | 'edit-data'
  | 'delete-data';

export type NocodeEditorFlowPatchOperation =
  | {
      op: 'add';
      tempKey: string;
      parentBranchKey: string;
      afterNodeKey?: string;
      beforeNodeKey?: string;
      node: {
        type: NocodeEditorFlowPatchAddNodeType;
        name?: string;
        options?: Record<string, unknown>;
      };
    }
  | {
      op: 'update';
      nodeKey: string;
      changes: {
        name?: string;
        options?: Record<string, unknown>;
      };
    }
  | {
      op: 'remove';
      nodeKey: string;
    }
  | {
      op: 'move';
      nodeKey: string;
      parentBranchKey: string;
      afterNodeKey?: string;
      beforeNodeKey?: string;
    };

export type NocodeEditorFlowPatch = {
  target: {
    formId: string;
    processVersion: number;
    flowFingerprint: string;
  };
  operations: NocodeEditorFlowPatchOperation[];
  summary?: string;
};

export type NocodeEditorFlowPatchErrorCode =
  | 'flow_patch_invalid_input'
  | 'flow_patch_conflict'
  | 'flow_patch_target_ambiguous'
  | 'flow_patch_reference_blocked'
  | 'flow_patch_validation_failed'
  | 'requires_full_rebuild';

export class NocodeEditorFlowPatchError extends Error {
  constructor(
    public readonly code: NocodeEditorFlowPatchErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'NocodeEditorFlowPatchError';
  }
}

export type NocodeEditorFlowPatchResult = {
  ok: true;
  formId: string;
  formName?: string;
  sourceVersion: number;
  draftVersion: number;
  createdDraftVersion: boolean;
  activeVersion?: number;
  activeVersionUnchanged: boolean;
  appliedOperations: Array<{
    op: 'add' | 'update' | 'remove' | 'move';
    nodeKey?: string;
    tempKey?: string;
    nodeName?: string;
  }>;
  warnings: string[];
};

export type NormalizeNocodeEditorFlowPatchResult =
  | { ok: true; patch: NocodeEditorFlowPatch }
  | { ok: false; code: 'flow_patch_invalid_input'; message: string };

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const ADD_NODE_TYPES = new Set<NocodeEditorFlowPatchAddNodeType>([
  'approval',
  'transact',
  'notify',
  'report-data',
  'add-data',
  'edit-data',
  'delete-data',
]);

const invalid = (message: string): NormalizeNocodeEditorFlowPatchResult => ({
  ok: false,
  code: 'flow_patch_invalid_input',
  message,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean => {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every(key => allowed.has(key));
};

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);

type CloneJsonValueResult =
  | { ok: true; value: JsonValue }
  | { ok: false };

const cloneJsonValue = (
  value: unknown,
  ancestors: Set<object>,
): CloneJsonValueResult => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return { ok: true, value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (typeof value !== 'object' || ancestors.has(value)) return { ok: false };

  ancestors.add(value);
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (const item of value) {
      const cloned = cloneJsonValue(item, ancestors);
      if (cloned.ok === false) {
        ancestors.delete(value);
        return cloned;
      }
      result.push(cloned.value);
    }
    ancestors.delete(value);
    return { ok: true, value: result };
  }
  if (!isPlainObject(value) || Reflect.ownKeys(value).some(key => typeof key !== 'string')) {
    ancestors.delete(value);
    return { ok: false };
  }

  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(value)) {
    const cloned = cloneJsonValue(value[key], ancestors);
    if (cloned.ok === false) {
      ancestors.delete(value);
      return cloned;
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: cloned.value,
      writable: true,
    });
  }
  ancestors.delete(value);
  return { ok: true, value: result };
};

const cloneJsonOptions = (
  value: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false } => {
  if (!isPlainObject(value)) return { ok: false };
  try {
    const result = cloneJsonValue(value, new Set<object>());
    if (result.ok === false || Array.isArray(result.value) || !isPlainObject(result.value)) {
      return { ok: false };
    }
    return { ok: true, value: result.value };
  } catch {
    return { ok: false };
  }
};

const normalizeNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

type OperationNormalizationResult =
  | { ok: true; operation: NocodeEditorFlowPatchOperation }
  | { ok: false; message: string };

const normalizePosition = (
  value: Record<string, unknown>,
): { ok: true; afterNodeKey?: string; beforeNodeKey?: string } | { ok: false; message: string } => {
  const afterNodeKey = value.afterNodeKey === undefined
    ? undefined
    : normalizeNonEmptyString(value.afterNodeKey);
  const beforeNodeKey = value.beforeNodeKey === undefined
    ? undefined
    : normalizeNonEmptyString(value.beforeNodeKey);
  if (value.afterNodeKey !== undefined && afterNodeKey === undefined) {
    return { ok: false, message: 'afterNodeKey must be a non-empty string' };
  }
  if (value.beforeNodeKey !== undefined && beforeNodeKey === undefined) {
    return { ok: false, message: 'beforeNodeKey must be a non-empty string' };
  }
  if (afterNodeKey !== undefined && beforeNodeKey !== undefined) {
    return { ok: false, message: 'afterNodeKey and beforeNodeKey cannot be used together' };
  }
  return { ok: true, afterNodeKey, beforeNodeKey };
};

const normalizeAddOperation = (value: Record<string, unknown>): OperationNormalizationResult => {
  if (!hasOnlyKeys(value, [
    'op',
    'tempKey',
    'parentBranchKey',
    'afterNodeKey',
    'beforeNodeKey',
    'node',
  ])) {
    return { ok: false, message: 'add operation contains an unknown field' };
  }
  const tempKey = normalizeNonEmptyString(value.tempKey);
  const parentBranchKey = normalizeNonEmptyString(value.parentBranchKey);
  if (!tempKey || !parentBranchKey) {
    return { ok: false, message: 'add operation requires tempKey and parentBranchKey' };
  }
  const position = normalizePosition(value);
  if (position.ok === false) return { ok: false, message: position.message };
  if (!isPlainObject(value.node) || !hasOnlyKeys(value.node, ['type', 'name', 'options'])) {
    return { ok: false, message: 'add operation node is invalid' };
  }
  if (typeof value.node.type !== 'string' || !ADD_NODE_TYPES.has(value.node.type as NocodeEditorFlowPatchAddNodeType)) {
    return { ok: false, message: 'add operation node.type is not supported' };
  }
  const name = hasOwn(value.node, 'name') ? normalizeNonEmptyString(value.node.name) : undefined;
  if (hasOwn(value.node, 'name') && name === undefined) {
    return { ok: false, message: 'add operation node.name must be a non-empty string' };
  }
  const options = hasOwn(value.node, 'options')
    ? cloneJsonOptions(value.node.options)
    : undefined;
  if (options?.ok === false) {
    return { ok: false, message: 'add operation node.options must contain only JSON values' };
  }
  return {
    ok: true,
    operation: {
      op: 'add',
      tempKey,
      parentBranchKey,
      ...(position.afterNodeKey === undefined ? {} : { afterNodeKey: position.afterNodeKey }),
      ...(position.beforeNodeKey === undefined ? {} : { beforeNodeKey: position.beforeNodeKey }),
      node: {
        type: value.node.type as NocodeEditorFlowPatchAddNodeType,
        ...(name === undefined ? {} : { name }),
        ...(options?.ok === true ? { options: options.value } : {}),
      },
    },
  };
};

const normalizeUpdateOperation = (value: Record<string, unknown>): OperationNormalizationResult => {
  if (!hasOnlyKeys(value, ['op', 'nodeKey', 'changes'])) {
    return { ok: false, message: 'update operation contains an unknown field' };
  }
  const nodeKey = normalizeNonEmptyString(value.nodeKey);
  if (!nodeKey) return { ok: false, message: 'update operation requires nodeKey' };
  if (!isPlainObject(value.changes) || !hasOnlyKeys(value.changes, ['name', 'options'])) {
    return { ok: false, message: 'update operation changes are invalid' };
  }
  if (Object.keys(value.changes).length === 0) {
    return { ok: false, message: 'update operation changes cannot be empty' };
  }
  const name = hasOwn(value.changes, 'name') ? normalizeNonEmptyString(value.changes.name) : undefined;
  if (hasOwn(value.changes, 'name') && name === undefined) {
    return { ok: false, message: 'update operation changes.name must be a non-empty string' };
  }
  const options = hasOwn(value.changes, 'options')
    ? cloneJsonOptions(value.changes.options)
    : undefined;
  if (options?.ok === false) {
    return { ok: false, message: 'update operation changes.options must contain only JSON values' };
  }
  return {
    ok: true,
    operation: {
      op: 'update',
      nodeKey,
      changes: {
        ...(name === undefined ? {} : { name }),
        ...(options?.ok === true ? { options: options.value } : {}),
      },
    },
  };
};

const normalizeRemoveOperation = (value: Record<string, unknown>): OperationNormalizationResult => {
  if (!hasOnlyKeys(value, ['op', 'nodeKey'])) {
    return { ok: false, message: 'remove operation contains an unknown field' };
  }
  const nodeKey = normalizeNonEmptyString(value.nodeKey);
  if (!nodeKey) return { ok: false, message: 'remove operation requires nodeKey' };
  return { ok: true, operation: { op: 'remove', nodeKey } };
};

const normalizeMoveOperation = (value: Record<string, unknown>): OperationNormalizationResult => {
  if (!hasOnlyKeys(value, ['op', 'nodeKey', 'parentBranchKey', 'afterNodeKey', 'beforeNodeKey'])) {
    return { ok: false, message: 'move operation contains an unknown field' };
  }
  const nodeKey = normalizeNonEmptyString(value.nodeKey);
  const parentBranchKey = normalizeNonEmptyString(value.parentBranchKey);
  if (!nodeKey || !parentBranchKey) {
    return { ok: false, message: 'move operation requires nodeKey and parentBranchKey' };
  }
  const position = normalizePosition(value);
  if (position.ok === false) return { ok: false, message: position.message };
  return {
    ok: true,
    operation: {
      op: 'move',
      nodeKey,
      parentBranchKey,
      ...(position.afterNodeKey === undefined ? {} : { afterNodeKey: position.afterNodeKey }),
      ...(position.beforeNodeKey === undefined ? {} : { beforeNodeKey: position.beforeNodeKey }),
    },
  };
};

const normalizeOperation = (value: unknown): OperationNormalizationResult => {
  if (!isPlainObject(value) || typeof value.op !== 'string') {
    return { ok: false, message: 'operation must be an object with a supported op' };
  }
  switch (value.op) {
  case 'add': return normalizeAddOperation(value);
  case 'update': return normalizeUpdateOperation(value);
  case 'remove': return normalizeRemoveOperation(value);
  case 'move': return normalizeMoveOperation(value);
  default: return { ok: false, message: 'operation op is not supported' };
  }
};

export const normalizeNocodeEditorFlowPatch = (
  value: unknown,
): NormalizeNocodeEditorFlowPatchResult => {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ['target', 'operations', 'summary'])) {
    return invalid('flow patch must be an object containing only target, operations, and summary');
  }
  if (!isPlainObject(value.target)
    || !hasOnlyKeys(value.target, ['formId', 'processVersion', 'flowFingerprint'])) {
    return invalid('flow patch target is invalid');
  }
  const formId = normalizeNonEmptyString(value.target.formId);
  const flowFingerprint = normalizeNonEmptyString(value.target.flowFingerprint);
  if (!formId || !flowFingerprint || !Number.isInteger(value.target.processVersion)
    || (value.target.processVersion as number) <= 0) {
    return invalid('flow patch target requires formId, a positive processVersion, and flowFingerprint');
  }
  if (!Array.isArray(value.operations)
    || value.operations.length < 1
    || value.operations.length > NOCODE_EDITOR_FLOW_PATCH_MAX_OPERATIONS) {
    return invalid(`flow patch operations must contain 1-${NOCODE_EDITOR_FLOW_PATCH_MAX_OPERATIONS} items`);
  }
  let summary: string | undefined;
  if (value.summary !== undefined) {
    if (typeof value.summary !== 'string') {
      return invalid('flow patch summary must be a string');
    }
    summary = value.summary.trim();
    if (!summary) {
      return invalid('flow patch summary must be a non-empty string');
    }
  }

  const operations: NocodeEditorFlowPatchOperation[] = [];
  const tempKeys = new Set<string>();
  for (const [index, candidate] of value.operations.entries()) {
    const result = normalizeOperation(candidate);
    if (result.ok === false) return invalid(`operations[${index}]: ${result.message}`);
    if (result.operation.op === 'add') {
      if (tempKeys.has(result.operation.tempKey)) {
        return invalid(`operations[${index}]: duplicate add tempKey: ${result.operation.tempKey}`);
      }
      tempKeys.add(result.operation.tempKey);
    }
    operations.push(result.operation);
  }

  return {
    ok: true,
    patch: {
      target: {
        formId,
        processVersion: value.target.processVersion as number,
        flowFingerprint,
      },
      operations,
      ...(summary === undefined ? {} : { summary }),
    },
  };
};

const canonicalizeValue = (value: unknown): JsonValue | undefined => {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map(item => canonicalizeValue(item) ?? null);
  }
  if (!isPlainObject(value)) return undefined;
  const result: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = canonicalizeValue(value[key]);
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
};

const canonicalizeFlows = (flows: ProcessFlow[]): JsonValue[] => flows.map((flow) => {
  return {
    uid: flow.uid,
    type: flow.type,
    ...(flow.options === undefined ? {} : { options: canonicalizeValue(flow.options) ?? null }),
    ...(flow.branches === undefined ? {} : {
      branches: flow.branches.map(branch => ({
        uid: branch.uid,
        type: branch.type,
        flows: canonicalizeFlows(branch.flows),
      })),
    }),
  };
});

const buildFnv1aHash = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const buildNocodeEditorFlowStructureDigest = (flows: ProcessFlow[]): string => {
  const canonicalStructure = canonicalizeValue(canonicalizeFlows(flows));
  return `flow-structure-${buildFnv1aHash(JSON.stringify(canonicalStructure))}`;
};

export const buildNocodeEditorFlowFingerprint = ({
  processVersion,
  flows,
}: {
  processVersion: number;
  flows: ProcessFlow[];
}): string => `flow-v${processVersion}-${buildNocodeEditorFlowStructureDigest(flows)}`;
