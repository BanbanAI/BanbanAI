import { Account, Department as DepartmentType, Role } from "@common/types/account";
import { MemberShowField } from "./types";

type DisplayUser = Pick<Account, "realname" | "user" | "staffNo" | "phone" | "email" | "departments" | "roles">;
type DisplayOrganize = Partial<{
  departments: Array<Pick<DepartmentType, "id" | "name">>,
  roles: Array<Pick<Role, "id" | "name">>,
}>;

function getUserBaseName(user?: DisplayUser | null) {
  return user?.realname || user?.user || "";
}

function getExistingUserDisplayName(user?: DisplayUser | null) {
  if (!user) {
    return "";
  }
  const userName = getUserBaseName(user);
  if (!userName) {
    return "";
  }
  return userName;
}

function getDisplayFields(showInfo: string[] = []) {
  return showInfo.length ? showInfo : [MemberShowField.NAME];
}

function pushUniqueValues(target: string[], values: Array<string | undefined>) {
  values.forEach(value => {
    if (value && !target.includes(value)) {
      target.push(value);
    }
  });
}

export function displayFilledMemberInfoByUser(
  user?: DisplayUser | null,
  organize?: DisplayOrganize,
  showInfo: string[] = [],
  fallback = "",
) {
  if (!user) {
    return fallback;
  }

  const texts: string[] = [];
  const departmentMap = new Map((organize?.departments || []).map(item => [item.id, item.name]));
  const roleMap = new Map((organize?.roles || []).map(item => [item.id, item.name]));

  getDisplayFields(showInfo).forEach(field => {
    switch (field) {
      case MemberShowField.NAME:
        pushUniqueValues(texts, [getExistingUserDisplayName(user)]);
        break;
      case MemberShowField.STAFF_NO:
        pushUniqueValues(texts, [user.staffNo]);
        break;
      case MemberShowField.PHONE:
        pushUniqueValues(texts, [user.phone]);
        break;
      case MemberShowField.EMAIL:
        pushUniqueValues(texts, [user.email]);
        break;
      case MemberShowField.DEPARTMENT:
        pushUniqueValues(texts, (user.departments || []).map(id => departmentMap.get(id)));
        break;
      case MemberShowField.ROLE:
        pushUniqueValues(texts, (user.roles || []).map(id => roleMap.get(id)));
        break;
      default:
        break;
    }
  });

  return texts.length ? texts.join(" - ") : "";
}
