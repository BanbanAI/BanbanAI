type PermissionContext = {
  nocodeBody?: any;
  departments?: Array<{ id?: string; parent?: string; children?: any[] }>;
  account?: {
    id?: string;
    isAdmin?: boolean;
    roles?: string[];
    departments?: string[];
  };
  skipDataPermission?: boolean;
};

const getDepartmentTreeMap = (departments: PermissionContext["departments"] = []) => {
  const parentMap = new Map<string, string | undefined>();
  const stack = [...departments];
  while (stack.length) {
    const department = stack.pop();
    if (!department?.id) continue;
    parentMap.set(department.id, department.parent);
    if (department.children?.length) {
      stack.push(...department.children);
    }
  }
  return parentMap;
};

const getAllRelatedDepartments = (
  departments: PermissionContext["departments"] = [],
  accountDepartments: string[] = [],
) => {
  const parentMap = getDepartmentTreeMap(departments);
  const result = new Set<string>();

  for (const departmentId of accountDepartments || []) {
    let currentId = departmentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      result.add(currentId);
      currentId = parentMap.get(currentId);
    }
  }

  return [...result];
};

const getDefaultReadPermissions = () => {
  return [{
    memberRange: {
      rangeType: "all",
      range: {
        departments: [],
        roles: [],
        users: [],
      },
    },
    handleRange: {
      get: true,
    },
  }];
};

const canMatchMemberRange = (
  permission: any,
  permissionContext: PermissionContext | undefined,
) => {
  const account = permissionContext?.account;
  if (!account) return true;

  if (permission?.memberRange?.rangeType === "all") {
    return true;
  }

  if (permission?.memberRange?.range?.users?.includes(account.id)) {
    return true;
  }

  if (permission?.memberRange?.range?.roles?.some(roleId => account.roles?.includes(roleId))) {
    return true;
  }

  const relatedDepartments = getAllRelatedDepartments(permissionContext?.departments, account.departments || []);
  return permission?.memberRange?.range?.departments?.some(departmentId => relatedDepartments.includes(departmentId)) ?? false;
};

export const canReadLayerDataByContext = (
  permissionContext: PermissionContext | undefined,
  layerId?: string,
) => {
  if (!layerId) return false;
  if (permissionContext?.skipDataPermission) return true;

  const nocodeBody = permissionContext?.nocodeBody;
  const account = permissionContext?.account;
  if (!nocodeBody || !account) return true;
  if (account.isAdmin) return true;

  const permissions = nocodeBody?.permissions?.data?.[layerId]?.other;
  const readPermissions = permissions === undefined ? getDefaultReadPermissions() : permissions;

  return readPermissions.some(permission => {
    if (!permission?.handleRange?.get) {
      return false;
    }
    return canMatchMemberRange(permission, permissionContext);
  });
};
