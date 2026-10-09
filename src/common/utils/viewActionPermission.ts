import { cloneDeep } from "lodash";

import {
  MemberRange,
  OperationPermission,
  ViewAction,
  ViewActionBehaviorType,
} from "../types/nocode";

export type ActionPermissionCopySources = Record<string, string>;

type CloneViewActionsForCopyOptions = {
  actions?: ViewAction[];
  createActionId: () => string;
};

type CloneViewActionsForCopyResult = {
  actions?: ViewAction[];
  permissionCopySources: ActionPermissionCopySources;
};

type BuildOperationPermissionsForActionCopiesOptions = {
  operationPermissions?: OperationPermission;
  tableId: string;
  permissionCopySources: ActionPermissionCopySources;
};

export function cloneViewActionsForCopy(
  options: CloneViewActionsForCopyOptions,
): CloneViewActionsForCopyResult {
  const { actions, createActionId } = options;
  if (!Array.isArray(actions)) {
    return {
      actions,
      permissionCopySources: {},
    };
  }

  const permissionCopySources: ActionPermissionCopySources = {};
  const copiedActions = cloneDeep(actions).map((action) => {
    const actionId = createActionId();
    if (action?.id) {
      permissionCopySources[actionId] = action.id;
    }

    const copiedAction = {
      ...action,
      id: actionId,
      code: actionId,
    };

    if (copiedAction.behavior?.type === ViewActionBehaviorType.TRIGGER_PROCESS) {
      copiedAction.behavior = {
        ...copiedAction.behavior,
        config: {
          ...copiedAction.behavior.config,
          triggerNodeId: "",
        },
      };
    }

    return copiedAction;
  });

  return {
    actions: copiedActions,
    permissionCopySources,
  };
}

export function buildOperationPermissionsForActionCopies(
  options: BuildOperationPermissionsForActionCopiesOptions,
) {
  const { operationPermissions, tableId, permissionCopySources } = options;
  const copyEntries = Object.entries(permissionCopySources || {});
  const sourceTablePermissions = operationPermissions?.[tableId];
  if (!sourceTablePermissions || !copyEntries.length) {
    return null;
  }

  const nextTablePermissions = cloneDeep(sourceTablePermissions) as Record<string, MemberRange>;
  let hasChanges = false;

  for (const [targetActionId, sourceActionId] of copyEntries) {
    if (!targetActionId || !sourceActionId || nextTablePermissions[targetActionId]) {
      continue;
    }

    const sourcePermission = sourceTablePermissions[sourceActionId];
    if (!sourcePermission) {
      continue;
    }

    nextTablePermissions[targetActionId] = cloneDeep(sourcePermission);
    hasChanges = true;
  }

  if (!hasChanges) {
    return null;
  }

  const nextOperationPermissions = cloneDeep(operationPermissions || {}) as OperationPermission;
  nextOperationPermissions[tableId] = nextTablePermissions;

  return nextOperationPermissions;
}
