export type AccountRole = "superAdmin" | "admin" | "visitor" | "user";
export type Account = NocodeUser;

export type NocodeUser = {
  id?: string,
  user?: string,
  pass?: string,
  realname?: string,
  createTime?: number,
  updateTime?: number,
  roles: string[],
  departments: string[],
  phone?: string,
  email?: string,
  /** 是否是设置的管理员 */
  isAdmin?: boolean,
  staffNo?: string,
}

export const ADMIN_USERNAME = "admin";

export function isSystemAdminAccount(account?: Partial<Account> | null) {
  return Boolean(
    account?.isAdmin
      || account?.user === ADMIN_USERNAME
      || account?.id === "0",
  );
}

export type Department = {
  id?: string,
  name?: string,
  parent?: string,
  createTime?: number,
  updateTime?: number,
  deleteTime?: number,
  managers?: string[],
  children?: Department[],
}

export type Role = {
  id?: string,
  name?: string,
  parent?: string,
  isGroup?: boolean,
  createTime?: number,
  updateTime?: number,
  deleteTime?: number,
}

export type ServerUserInfo = {
  type?: 'user' | 'phone',
  username?: string,
  password?: string,
}

export type ServerInitStepInfo = {
  step?: 'none' | 'user' | 'complete';
  inValid?: boolean,
} & ServerUserInfo;

export type ValidateByPhoneOptions = {
  type?: 'phone',
  phone?: string,
  code?: string,
}

export type ValidateByUserOptions = {
  type?: 'user',
  username?: string,
  password?: string,
}

export enum Dynamic {
  CURRENT_USER = 'currentUser',
  CURRENT_DEPARTMENT = 'currentDepartment',
}

export type ValidateMainUserOptions = ValidateByPhoneOptions | ValidateByUserOptions;
