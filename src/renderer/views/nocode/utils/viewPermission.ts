import { Department, NocodeUser } from "@common/types/account";
import { PermissionCategory, PermissionRangeType, ViewOperationPermissionKey, ViewPermission, ViewPermissionItem, ViewSetting } from "@common/types/nocode";

type ViewPermissionAccount = Pick<NocodeUser, "id" | "departments" | "roles" | "isAdmin">;

type MatchViewPermissionOptions = {
  permission?: ViewPermissionItem,
  account?: Partial<ViewPermissionAccount>,
  departments?: Department[],
};

type GetVisibleViewsOptions = {
  views?: ViewSetting[],
  tableId?: string,
  permissions?: ViewPermission,
  account?: Partial<ViewPermissionAccount>,
  departments?: Department[],
};

export function getCurrentAccountDepartmentIds(
  account?: Partial<ViewPermissionAccount>,
  departments: Department[] = [],
) {
  const departmentMap = new Map(
    departments
      .filter(item => !!item?.id)
      .map(item => [item.id, item.parent]),
  );
  const inheritedDepartmentIds = new Set<string>();

  for (const departmentId of account?.departments || []) {
    let currentDepartmentId: string | undefined = departmentId;
    const visited = new Set<string>();

    while (currentDepartmentId && !visited.has(currentDepartmentId)) {
      visited.add(currentDepartmentId);
      inheritedDepartmentIds.add(currentDepartmentId);
      currentDepartmentId = departmentMap.get(currentDepartmentId);
    }
  }

  return [...inheritedDepartmentIds];
}

export function canCurrentAccountView(options: MatchViewPermissionOptions) {
  if (canCurrentAccountMatchMemberRange(options)) {
    return true;
  }

  const { permission } = options;
  if (!permission) return true;

  const getPermission = permission[PermissionCategory.GET];
  if (!getPermission) return true;
  return getPermission.rangeType === PermissionRangeType.ALL;
}

export function canCurrentAccountMatchMemberRange(options: MatchViewPermissionOptions) {
  const { permission, account, departments = [] } = options;
  if (account?.isAdmin) return true;
  if (!permission) return false;

  const getPermission = permission[PermissionCategory.GET];
  if (!getPermission) return true;
  if (getPermission.rangeType === PermissionRangeType.ALL) return true;

  const range = getPermission.range;
  if (!range) return false;

  const currentAccountId = account?.id;
  if (currentAccountId && range.users?.includes(currentAccountId)) {
    return true;
  }

  const currentAccountRoleIds = account?.roles || [];
  if (currentAccountRoleIds.some(roleId => range.roles?.includes(roleId))) {
    return true;
  }

  const currentAccountDepartmentIds = getCurrentAccountDepartmentIds(account, departments);
  if (currentAccountDepartmentIds.some(departmentId => range.departments?.includes(departmentId))) {
    return true;
  }

  return false;
}

export function getCurrentAccountViewOperationPermissions(options: MatchViewPermissionOptions) {
  const defaultPermissions: Record<ViewOperationPermissionKey, boolean> = {
    [ViewOperationPermissionKey.IMPORT]: true,
    [ViewOperationPermissionKey.EXPORT]: true,
    [ViewOperationPermissionKey.BATCH_PRINT]: true,
    [ViewOperationPermissionKey.BATCH_UPDATE]: true,
    [ViewOperationPermissionKey.BATCH_DELETE]: true,
  };
  const { permission, account, departments = [] } = options;
  if (account?.isAdmin) return defaultPermissions;

  const operationGroups = permission?.operationGroups;
  if (!Array.isArray(operationGroups)) {
    return defaultPermissions;
  }

  const result: Record<ViewOperationPermissionKey, boolean> = {
    [ViewOperationPermissionKey.IMPORT]: false,
    [ViewOperationPermissionKey.EXPORT]: false,
    [ViewOperationPermissionKey.BATCH_PRINT]: false,
    [ViewOperationPermissionKey.BATCH_UPDATE]: false,
    [ViewOperationPermissionKey.BATCH_DELETE]: false,
  };

  for (const group of operationGroups) {
    const matched = group.memberRange.rangeType === PermissionRangeType.ALL || canCurrentAccountMatchMemberRange({
      permission: {
        [PermissionCategory.GET]: group.memberRange,
      },
      account,
      departments,
    });

    if (!matched) {
      continue;
    }

    for (const key of Object.values(ViewOperationPermissionKey)) {
      result[key] = result[key] || !!group.handleRange?.[key];
    }
  }

  return result;
}

export function getVisibleViewsForCurrentAccount(options: GetVisibleViewsOptions) {
  const { views = [], tableId, permissions, account, departments = [] } = options;
  if (account?.isAdmin) return views;
  if (!tableId) return views;

  const tablePermissions = permissions?.[tableId];
  if (!tablePermissions) return views;

  return views.filter(view => canCurrentAccountView({
    permission: tablePermissions[view.uid],
    account,
    departments,
  }));
}
