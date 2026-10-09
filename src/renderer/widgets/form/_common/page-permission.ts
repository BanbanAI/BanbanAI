import { isEmpty } from "@common/utils/object";

type PagePermissionContext = {
  nocodeBody?: any;
  departments?: Array<{ id?: string; parent?: string; children?: any[] }>;
  account?: {
    id?: string;
    isAdmin?: boolean;
    roles?: string[];
    departments?: string[];
  };
};

const getDepartmentTreeMap = (departments: PagePermissionContext["departments"] = []) => {
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
  departments: PagePermissionContext["departments"] = [],
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

const hasApplicationViewPermissionByContext = (
  pagePermissionContext: PagePermissionContext | undefined,
) => {
  const nocodeBody = pagePermissionContext?.nocodeBody;
  const account = pagePermissionContext?.account;
  if (!nocodeBody || !account) return true;
  if (account.isAdmin) return true;

  const permission = nocodeBody?.permissions?.application?.get;
  if (isEmpty(permission)) {
    return true;
  }

  const relatedDepartments = getAllRelatedDepartments(pagePermissionContext?.departments, account.departments || []);

  if (permission?.rangeType === "blacklist") {
    if (permission?.blacklist?.users?.includes(account.id)) {
      return false;
    }
    if (permission?.blacklist?.roles?.some(roleId => account.roles?.includes(roleId))) {
      return false;
    }
    if (permission?.blacklist?.departments?.some(departmentId => relatedDepartments.includes(departmentId))) {
      return false;
    }
    return true;
  }

  if (permission?.whitelist?.users?.includes(account.id)) {
    return true;
  }
  if (permission?.whitelist?.roles?.some(roleId => account.roles?.includes(roleId))) {
    return true;
  }
  return permission?.whitelist?.departments?.some(departmentId => relatedDepartments.includes(departmentId)) ?? false;
};

export const canViewLayerByContext = (
  pagePermissionContext: PagePermissionContext | undefined,
  layerId?: string,
) => {
  if (!layerId) return false;
  if (!hasApplicationViewPermissionByContext(pagePermissionContext)) {
    return false;
  }

  const nocodeBody = pagePermissionContext?.nocodeBody;
  const account = pagePermissionContext?.account;
  if (!nocodeBody || !account) return true;
  if (account.isAdmin) return true;

  const permission = nocodeBody?.permissions?.page?.[layerId]?.get;
  if (isEmpty(permission) || permission?.rangeType === "all") {
    return true;
  }

  if (permission?.range?.users?.includes(account.id)) {
    return true;
  }

  if (permission?.range?.roles?.some(roleId => account.roles?.includes(roleId))) {
    return true;
  }

  const relatedDepartments = getAllRelatedDepartments(pagePermissionContext?.departments, account.departments || []);
  return permission?.range?.departments?.some(departmentId => relatedDepartments.includes(departmentId)) ?? false;
};

type DataSourceSelectionMeta = {
  connectionUID?: string;
  tableUID?: string;
  connection?: any;
  table?: any;
  nocodeId?: string;
  hasViewPermission: boolean;
  isCurrentConnection: boolean;
  isSchemaOnly?: boolean;
};

type ResolveDataSourceSelectionOptions = {
  includeSchemaOnly?: boolean;
};

const getBoardPagePermissionContext = (board: any): PagePermissionContext | undefined => {
  return board?.projectContext?.pagePermissionContext;
};

const getBoardCurrentConnectionUID = (board: any) => {
  return getBoardPagePermissionContext(board)?.nocodeBody?.formData?.uid;
};

const getBoardSchemaOnlyConnections = (board: any) => {
  return getBoardPagePermissionContext(board)?.nocodeBody?.otherDataSourceSchemas || [];
};

const findDataSourceSelectionTarget = (connections: any[] = [], optionTableUID?: string[]) => {
  const [connectionUID, tableUID] = optionTableUID || [];
  const connection = connections.find(item => item?.uid === connectionUID);
  const table = connection?.tables?.find(item => item?.uid === tableUID);

  return {
    connection,
    table,
  };
};

const getCrossAppStoredNocodeId = (board: any, tableUID?: string) => {
  if (!tableUID) return undefined;
  const forms = getBoardPagePermissionContext(board)?.nocodeBody?.settings?.crossApp?.forms || [];
  return forms.find(item => item?.tableUID === tableUID)?.nocodeId;
};

export const resolveDataSourceSelectionMeta = (
  board: any,
  optionTableUID?: string[],
  currentConnectionUID?: string,
  options: ResolveDataSourceSelectionOptions = {},
): DataSourceSelectionMeta => {
  const [connectionUID, tableUID] = optionTableUID || [];
  const { connection: liveConnection, table: liveTable } = findDataSourceSelectionTarget(
    board?.getConnections?.() || [],
    optionTableUID,
  );
  let connection = liveConnection;
  let table = liveTable;
  let isSchemaOnly = false;

  if ((!connection || !table) && options.includeSchemaOnly) {
    const schemaOnlyTarget = findDataSourceSelectionTarget(getBoardSchemaOnlyConnections(board), optionTableUID);
    if (schemaOnlyTarget.connection && schemaOnlyTarget.table) {
      connection = schemaOnlyTarget.connection;
      table = schemaOnlyTarget.table;
      isSchemaOnly = true;
    }
  }
  const activeCurrentConnectionUID = currentConnectionUID || getBoardCurrentConnectionUID(board);
  const isCurrentConnection = !!connectionUID && connectionUID === activeCurrentConnectionUID;
  const nocodeId = (connection as any)?.nocodeId || (isCurrentConnection ? board?.nocodeId : getCrossAppStoredNocodeId(board, tableUID));
  const hasViewPermission = !tableUID
    ? false
    : isCurrentConnection
      ? canViewLayerByContext(getBoardPagePermissionContext(board), tableUID)
      : !!liveConnection && !!liveTable;

  return {
    connectionUID,
    tableUID,
    connection,
    table,
    nocodeId,
    hasViewPermission,
    isCurrentConnection,
    isSchemaOnly,
  };
};

