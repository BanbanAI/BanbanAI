import { ref } from "vue";
import { getActivePinia } from "pinia";
import { globalOrganize } from "./api";
import { ADMIN_USERNAME, Department, NocodeUser, Role } from "@common/types/account";
import { OrganizeOptionValue } from "@common/types/project";
import { isEmpty } from "@common/utils/object";
import { OrganizeUsersParams, useOrganizeCacheStore } from "@renderer/stores/organizeCache";

type GetUsersParams = OrganizeUsersParams;
type GetRolesParams = { projectId?: string; nocodeId?: string };
type GetDepartmentsParams = { projectId?: string; nocodeId?: string };

const pickUserQueryOptions = (options?: Record<string, any>): GetUsersParams => {
  if (!options) return void 0;

  const {
    projectId,
    nocodeId,
    page,
    pageSize,
    search,
    accountIds,
    roleIds,
    departmentIds,
    isAdmin,
    status,
  } = options;

  return {
    projectId,
    nocodeId,
    page,
    pageSize,
    search,
    accountIds,
    roleIds,
    departmentIds,
    isAdmin,
    status,
  };
};

export class OrganizeUtil {
  private readonly _allUsers = ref<NocodeUser[]>([]);
  private readonly _users = ref<NocodeUser[]>([]);
  private readonly _roles = ref<Role[]>([]);
  private readonly _departments = ref<Department[]>([]);

  userCount = ref(0);

  private get api() {
    return globalOrganize;
  }

  // Resolve the Pinia store lazily so OrganizeUtil can still be constructed
  // before the app finishes installing Pinia.
  private get cacheStore() {
    const pinia = getActivePinia();
    return pinia ? useOrganizeCacheStore(pinia) : null;
  }

  private async fetchUsers(options?: Record<string, any>) {
    const queryOptions = pickUserQueryOptions(options);
    const cacheStore = this.cacheStore;
    return cacheStore ? await cacheStore.getUsers(queryOptions) : { users: [], total: 0 };
  }

  private async fetchRoles(options?: Record<string, any>) {
    void options;
    const cacheStore = this.cacheStore;
    return cacheStore ? await cacheStore.getRoles() : [];
  }

  private async fetchDepartments(options?: Record<string, any>) {
    void options;
    const cacheStore = this.cacheStore;
    return cacheStore ? await cacheStore.getDepartments() : [];
  }

  private markUsersDirty(options?: Record<string, any>) {
    void options;
    this.cacheStore?.invalidate();
  }

  private markRolesDirty(options?: Record<string, any>) {
    void options;
    this.cacheStore?.invalidate();
  }

  private markDepartmentsDirty(options?: Record<string, any>) {
    void options;
    this.cacheStore?.invalidate();
  }

  // Load a full user list into the instance-level allUsers state.
  public async getAllUsers(options?: GetUsersParams) {
    const res = await this.fetchUsers(options);
    if (res?.users) {
      this._allUsers.value = res.users;
      if (res.total !== void 0) {
        this.userCount.value = res.total;
      }
    }
    return this.allUsers;
  }

  // Load a user list into the instance-level users state.
  public async getUsers(options?: GetUsersParams) {
    const userRes = await this.fetchUsers(options);
    if (userRes?.users) {
      this._users.value = userRes.users;
    }
    if (userRes?.total !== void 0) {
      this.userCount.value = userRes.total;
    }
    return this.users;
  }

  // Return the raw user-list response while still reusing the shared cache.
  public async getUserByOptions(options?: GetUsersParams) {
    return await this.fetchUsers(options);
  }

  public async getResignedUserByOptions(options?: Omit<GetUsersParams, "status">) {
    const result = await this.fetchUsers({ ...options, status: "resigned" });
    return result?.users || [];
  }

  public findUserById(id: string) {
    if (!id) {
      return null;
    }
    return this._users.value.find(user => user?.id === id)
      || this._allUsers.value.find(user => user?.id === id)
      || null;
  }

  // Load a role list into the instance-level role state.
  public async getRoles(options?: GetRolesParams) {
    const roleRes = await this.fetchRoles(options);
    if (roleRes) {
      this._roles.value = roleRes;
    }
    return this.roleList;
  }

  // Load a department list into the instance-level department state.
  public async getDepartments(options?: GetDepartmentsParams) {
    const depRes = await this.fetchDepartments(options);
    if (depRes) {
      this._departments.value = depRes;
    }
    return this.departments;
  }

  public async addUser(options: Parameters<typeof this.api.addUser>[0]) {
    try {
      await this.api.addUser(options);
      this.markUsersDirty();
    } catch (err) {
      throw err;
    }
  }

  async addUserToDepartment(options: Parameters<typeof this.api.addUserToDepartment>[0]) {
    const res = await this.api.addUserToDepartment(options);
    this.markUsersDirty();
    return res;
  }

  async addUserToRole(options: Parameters<typeof this.api.addUserToRole>[0]) {
    const res = await this.api.addUserToRole(options);
    this.markUsersDirty();
    return res;
  }

  public async addRole(options: Parameters<typeof this.api.addRole>[0]) {
    await this.api.addRole(options);
    this.markRolesDirty();
    if (options?.userIds?.length) {
      this.markUsersDirty();
    }
    await this.getRoles(options);
  }

  public async addDepartment(options: Parameters<typeof this.api.addDepartment>[0]) {
    await this.api.addDepartment(options);
    this.markDepartmentsDirty();
    await this.getDepartments(options);
  }

  async updateDepartmentParent(options: Parameters<typeof this.api.updateDepartmentParent>[0]) {
    const res = await this.api.updateDepartmentParent(options);
    this.markDepartmentsDirty();
    return res;
  }

  public async updateUser(options: Parameters<typeof this.api.updateUser>[0]) {
    await this.api.updateUser(options);
    this.markUsersDirty();
    await this.getUsers(options);
  }

  public async updateRole(options: Parameters<typeof this.api.updateRole>[0]) {
    await this.api.updateRole(options);
    this.markRolesDirty();
    await this.getRoles(options);
  }

  public async updateDepartment(options: Parameters<typeof this.api.updateDepartment>[0]) {
    await this.api.updateDepartment(options);
    this.markDepartmentsDirty();
    await this.getDepartments(options);
  }

  public async removeUserPermanently(options: Parameters<typeof this.api.removeUserPermanently>[0]) {
    await this.api.removeUserPermanently(options);
    this.markUsersDirty();
    await this.getUsers(options);
  }

  public async removeUserPermanentlyList(options: Parameters<typeof this.api.removeUserPermanentlyList>[0]) {
    await this.api.removeUserPermanentlyList(options);
    this.markUsersDirty();
    await this.getUsers(options);
  }

  public async removeRole(options: Parameters<typeof this.api.removeRole>[0]) {
    await this.api.removeRole(options);
    this.markRolesDirty();
    await this.getRoles(options);
  }

  public async removeDepartment(options: Parameters<typeof this.api.removeDepartment>[0]) {
    await this.api.removeDepartment(options);
    this.markDepartmentsDirty();
    await this.getDepartments(options);
  }

  public async updateDepartmentManagers(options: Parameters<typeof this.api.updateDepartmentManagers>[0]) {
    const res = await this.api.updateDepartmentManagers(options);
    this.markDepartmentsDirty();
    return res;
  }

  public async getSharingNocodes(options: Parameters<typeof this.api.getSharingNocodes>[0]) {
    return await this.api.getSharingNocodes(options);
  }

  public async getSharingReports(options: Parameters<typeof this.api.getSharingReports>[0]) {
    return await this.api.getSharingReports(options);
  }

  public async setAdmins(options: Parameters<typeof this.api.setAdmins>[0]) {
    const res = await this.api.setAdmins(options);
    this.markUsersDirty();
    return res;
  }

  public async removeUserAsAdmin(options: Parameters<typeof this.api.removeUserAsAdmin>[0]) {
    const res = await this.api.removeUserAsAdmin(options);
    this.markUsersDirty();
    return res;
  }

  get allUsers() {
    return this._allUsers.value;
  }

  get users() {
    return this._users.value;
  }

  get adminUsers() {
    return this._users.value.filter(user => (user.user === ADMIN_USERNAME) || user.isAdmin);
  }

  get usersList() {
    return this._users.value.map(user => ({
      ...user,
      departmentsInfo: user.departments.map(depId => {
        const department = this._departments.value.find(dep => dep.id === depId);
        return department ? department.name : "";
      }).join(","),
      rolesInfo: user.roles.map(roleId => {
        const role = this._roles.value.find(role => role.id === roleId);
        return role ? role.name : "";
      }).join(","),
    }));
  }

  get roleList() {
    return this._roles.value;
  }

  get roles() {
    return this._roles.value.filter(item => !item.isGroup);
  }

  get roleGroups() {
    return this._roles.value.filter(item => item.isGroup);
  }

  get departments() {
    return this._departments.value;
  }

  getChildDepartmentIdsByIds(departmentIds: string[]) {
    if (isEmpty(departmentIds)) return [];
    const children = this.departments.filter(d => departmentIds.includes(d.parent));
    const childrenIds = children.map(c => c.id);
    const res = this.getChildDepartmentIdsByIds(childrenIds);
    return Array.from(new Set([...departmentIds, ...children, ...res]));
  }

  getUsersByOrganizeValue(options: OrganizeOptionValue) {
    let departmentIds = options?.departments;
    departmentIds = this.getChildDepartmentIdsByIds(departmentIds);
    const users = this.users;
    return users.filter(user => {
      if (options?.users?.includes(user.id)) return true;
      else if (options?.roles?.some(role => user.roles.includes(role))) return true;
      else if (departmentIds.some(department => user.departments.includes(department))) return true;
      return false;
    });
  }
}
