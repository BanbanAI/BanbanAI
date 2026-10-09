import { PermissionCategory, PermissionRangeType, type DataPermissionOther, type NocodeBody } from "@common/types/nocode";
import type { Department } from "@common/types/account";
import { getDefaultDataPermissionOther } from "@common/utils/connection";
import { getAllRelatedDepartments } from "@common/utils";
import { isEmpty } from "@common/utils/object";
import { usePassportStore } from "@renderer/stores/passport";

type PermissionAccount = {
  id?: string;
  roles?: string[];
  departments?: string[];
  isAdmin?: boolean;
};

type PermissionRoute = {
  matched?: Array<{ meta?: Record<string, any> }>;
  meta?: Record<string, any>;
  name?: string | symbol | null;
};

export const isPublicDataPermissionBypassedRoute = (route?: PermissionRoute) => {
  if (route?.name === "PublicQuery") {
    return true;
  }

  if (route?.matched?.some(record => record?.meta?.isPublicShare === true || record?.meta?.isPublicRowShare === true)) {
    return true;
  }

  return route?.meta?.isPublicShare === true || route?.meta?.isPublicRowShare === true;
};

const canMatchMemberRange = (
  permission: DataPermissionOther,
  account: PermissionAccount,
  departments: Department[] = [],
) => {
  if (permission?.memberRange?.rangeType === PermissionRangeType.ALL) {
    return true;
  }

  if (permission?.memberRange?.range?.users?.includes(account.id)) {
    return true;
  }

  if (permission?.memberRange?.range?.roles?.some(roleId => account.roles?.includes(roleId))) {
    return true;
  }

  const relatedDepartments = getAllRelatedDepartments(departments, account.departments || []);
  return permission?.memberRange?.range?.departments?.some(departmentId => relatedDepartments.includes(departmentId)) ?? false;
};

export const canReadNocodeTableDataByBody = (
  nocodeBody: NocodeBody | undefined,
  tableId: string | undefined,
  departments: Department[] = [],
  account?: PermissionAccount,
  skipDataPermission = false,
) => {
  if (!tableId) return false;
  if (skipDataPermission) return true;
  if (!nocodeBody) return true;

  const passportState = usePassportStore();
  const currentAccount = account || passportState.account;
  if (!currentAccount || currentAccount.isAdmin) return true;

  const permissions = nocodeBody.permissions?.data?.[tableId]?.other;
  const readPermissions = isEmpty(permissions) ? getDefaultDataPermissionOther() : permissions;

  return readPermissions.some(permission => {
    if (!permission?.handleRange?.[PermissionCategory.GET]) {
      return false;
    }
    return canMatchMemberRange(permission, currentAccount, departments);
  });
};
