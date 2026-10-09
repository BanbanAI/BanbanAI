import { PermissionCategory, PermissionFilterMode, PermissionRangeType, type NocodeBody } from "@common/types/nocode";
import type { Department } from "@common/types/account";
import { getAllRelatedDepartments } from "@common/utils";
import { isEmpty } from "@common/utils/object";
import { usePassportStore } from "@renderer/stores/passport";

const hasApplicationViewPermissionByBody = (
  nocodeBody: NocodeBody | undefined,
  departments: Department[] = [],
) => {
  if (!nocodeBody) return false;

  const passportState = usePassportStore();
  const account = passportState.account;
  if (!account || account.isAdmin) return true;

  const permission = nocodeBody.permissions?.application?.[PermissionCategory.GET];
  if (isEmpty(permission)) {
    return true;
  }

  const relatedDepartments = getAllRelatedDepartments(departments, account.departments || []);

  if (permission.rangeType === PermissionFilterMode.BLACK) {
    if (permission.blacklist?.users?.includes(account.id)) {
      return false;
    }
    if (permission.blacklist?.roles?.some(roleId => account.roles?.includes(roleId))) {
      return false;
    }
    if (permission.blacklist?.departments?.some(departmentId => relatedDepartments.includes(departmentId))) {
      return false;
    }
    return true;
  }

  if (permission.whitelist?.users?.includes(account.id)) {
    return true;
  }
  if (permission.whitelist?.roles?.some(roleId => account.roles?.includes(roleId))) {
    return true;
  }
  return permission.whitelist?.departments?.some(departmentId => relatedDepartments.includes(departmentId)) ?? false;
};

export const canViewNocodeLayerByBody = (
  nocodeBody: NocodeBody | undefined,
  layerId: string | undefined,
  departments: Department[] = [],
) => {
  if (!nocodeBody || !layerId) return false;
  if (!hasApplicationViewPermissionByBody(nocodeBody, departments)) {
    return false;
  }

  const passportState = usePassportStore();
  const account = passportState.account;
  if (!account || account.isAdmin) return true;

  const permission = nocodeBody.permissions?.page?.[layerId]?.[PermissionCategory.GET];
  if (isEmpty(permission) || permission.rangeType === PermissionRangeType.ALL) {
    return true;
  }

  if (permission.range?.users?.includes(account.id)) {
    return true;
  }

  if (permission.range?.roles?.some(roleId => account.roles?.includes(roleId))) {
    return true;
  }

  const relatedDepartments = getAllRelatedDepartments(departments, account.departments || []);
  return permission.range?.departments?.some(departmentId => relatedDepartments.includes(departmentId)) ?? false;
};
