import { EntityManager } from "@mikro-orm/core";
import { Injectable, Logger } from "@nestjs/common";
import { OrganizeLevelOption, OrganizeOptionValue } from "@common/types/project";
import { ADMIN_USERNAME, isSystemAdminAccount } from "@common/types/account";
import { WorkbenchDepartment, WorkbenchRole, WorkbenchUser } from "./entities";
import { UserRelations } from "./types";

type UsePermissions = Record<string, any>;
type ContactPermissions = Record<string, any>;
type CachedEntity = Record<string, any>;

export type CachedOrganizeUser = Readonly<{
  id: string;
  user: string;
  realname: string;
  root: boolean;
  loginTime: number;
  disabled: boolean;
  roles: string[];
  departments: string[];
  staffNo: string;
  phone: string;
  email: string;
  usePermissions?: UsePermissions;
  contactPermissions?: ContactPermissions;
  isAdmin: boolean;
  createTime: number;
  updateTime: number;
  deleteTime: number;
  resigned: boolean;
  pass?: string;
  apiKey?: string;
  apiSecret?: string;
}>;

export type CachedOrganizeDepartment = Readonly<{
  id: string;
  name: string;
  parent: string;
  managers: string[];
  usePermissions?: UsePermissions;
  createTime: number;
  updateTime: number;
  deleteTime: number;
}>;

export type CachedOrganizeRole = Readonly<{
  id: string;
  name: string;
  parent: string;
  isGroup: boolean;
  usePermissions?: UsePermissions;
  contactPermissions?: ContactPermissions;
  createTime: number;
  updateTime: number;
  deleteTime: number;
}>;

export type OrganizePermissionSources = Readonly<{
  user: CachedOrganizeUser;
  departments: CachedOrganizeDepartment[];
  roles: CachedOrganizeRole[];
}>;

type ApiCredential = Readonly<{
  userId: string;
  secret: string;
}>;

type VersionedValue<T> = Readonly<{
  version: number;
  data: T;
}>;

type LoadingValue<T> = Readonly<{
  version: number;
  promise: Promise<VersionedValue<T>>;
}>;

type CacheState<T> = {
  version: number;
  value?: VersionedValue<T>;
  loading?: LoadingValue<T>;
  loadCount: number;
  loadFailureCount: number;
  invalidationCount: number;
  lastLoadDurationMs?: number;
  lastLoadedAt?: number;
};

type UsersCache = Readonly<{
  users: CachedOrganizeUser[];
  nonAnonymousUsers: CachedOrganizeUser[];
  userById: ReadonlyMap<string, CachedOrganizeUser>;
  userByAccount: ReadonlyMap<string, CachedOrganizeUser>;
  userOrderById: ReadonlyMap<string, number>;
  userIdsByDepartmentId: ReadonlyMap<string, string[]>;
  userIdsByRoleId: ReadonlyMap<string, string[]>;
  credentialByApiKey: ReadonlyMap<string, ApiCredential>;
}>;

type DepartmentsCache = Readonly<{
  departments: CachedOrganizeDepartment[];
  departmentById: ReadonlyMap<string, CachedOrganizeDepartment>;
  childIdsByParentId: ReadonlyMap<string, string[]>;
}>;

type RolesCache = Readonly<{
  roles: CachedOrganizeRole[];
  roleById: ReadonlyMap<string, CachedOrganizeRole>;
}>;

function createCacheState<T>(): CacheState<T> {
  return {
    version: 0,
    loadCount: 0,
    loadFailureCount: 0,
    invalidationCount: 0,
  };
}

function freezeArray<T>(values: T[]): T[] {
  return Object.freeze(values) as T[];
}

function cloneAndFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map(item => cloneAndFreeze(item))) as T;
  }
  const result = Object.keys(value as Record<string, unknown>).reduce((object, key) => {
    object[key] = cloneAndFreeze(value[key]);
    return object;
  }, {} as Record<string, unknown>);
  return Object.freeze(result) as T;
}

function addToIndex(index: Map<string, string[]>, key: string, value: string) {
  if (!key) return;
  const values = index.get(key);
  if (values) {
    values.push(value);
  } else {
    index.set(key, [value]);
  }
}

function freezeStringArrayIndex(index: Map<string, string[]>) {
  for (const [key, values] of index) {
    index.set(key, freezeArray(values));
  }
  return index as ReadonlyMap<string, string[]>;
}

@Injectable()
export class OrganizeCacheService {
  private readonly logger = new Logger("OrganizeCacheService");
  private readonly usersState = createCacheState<UsersCache>();
  private readonly departmentsState = createCacheState<DepartmentsCache>();
  private readonly rolesState = createCacheState<RolesCache>();

  constructor(private readonly entityManager: EntityManager) {}

  async getUserById(id: string) {
    if (!id) return null;
    return (await this.getUsersCache()).userById.get(String(id)) || null;
  }

  async getUserByAccount(account: string) {
    if (!account) return null;
    return (await this.getUsersCache()).userByAccount.get(account) || null;
  }

  async getUsersByIds(ids: readonly string[]) {
    if (!ids?.length) return [];
    const userById = (await this.getUsersCache()).userById;
    const seen = new Set<string>();
    const users: CachedOrganizeUser[] = [];
    for (const id of ids) {
      const normalizedId = String(id || "");
      if (!normalizedId || seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      const user = userById.get(normalizedId);
      if (user) users.push(user);
    }
    return users;
  }

  async getAllUsers() {
    return (await this.getUsersCache()).users;
  }

  async getAllNonAnonymousUsers() {
    return (await this.getUsersCache()).nonAnonymousUsers;
  }

  async getAdmin() {
    return await this.getUserByAccount(ADMIN_USERNAME);
  }

  async getDepartmentById(id: string) {
    if (!id) return null;
    return (await this.getDepartmentsCache()).departmentById.get(String(id)) || null;
  }

  async getDepartmentsByIds(ids: readonly string[]) {
    if (!ids?.length) return [];
    const departmentById = (await this.getDepartmentsCache()).departmentById;
    const seen = new Set<string>();
    const departments: CachedOrganizeDepartment[] = [];
    for (const id of ids) {
      const normalizedId = String(id || "");
      if (!normalizedId || seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      const department = departmentById.get(normalizedId);
      if (department) departments.push(department);
    }
    return departments;
  }

  async getAllDepartments() {
    return (await this.getDepartmentsCache()).departments;
  }

  async getRoleById(id: string) {
    if (!id) return null;
    return (await this.getRolesCache()).roleById.get(String(id)) || null;
  }

  async getRolesByIds(ids: readonly string[]) {
    if (!ids?.length) return [];
    const roleById = (await this.getRolesCache()).roleById;
    const seen = new Set<string>();
    const roles: CachedOrganizeRole[] = [];
    for (const id of ids) {
      const normalizedId = String(id || "");
      if (!normalizedId || seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      const role = roleById.get(normalizedId);
      if (role) roles.push(role);
    }
    return roles;
  }

  async getAllRoles() {
    return (await this.getRolesCache()).roles;
  }

  async resolveUsers(options: OrganizeOptionValue) {
    const usersCache = await this.getUsersCache();
    const userIds = new Set((options?.users || []).filter(Boolean));

    for (const roleId of options?.roles || []) {
      for (const userId of usersCache.userIdsByRoleId.get(roleId) || []) {
        userIds.add(userId);
      }
    }

    if (options?.departments?.length) {
      const departmentIds = await this.getDescendantDepartmentIds(options.departments, true);
      for (const departmentId of departmentIds) {
        for (const userId of usersCache.userIdsByDepartmentId.get(departmentId) || []) {
          userIds.add(userId);
        }
      }
    }

    return Array.from(userIds)
      .map(id => usersCache.userById.get(id))
      .filter(Boolean)
      .sort((a, b) => usersCache.userOrderById.get(a.id) - usersCache.userOrderById.get(b.id));
  }

  async isInDepartments(accountDepartmentIds: readonly string[], targetDepartmentIds: readonly string[]) {
    if (!accountDepartmentIds?.length || !targetDepartmentIds?.length) return false;
    const targets = new Set(targetDepartmentIds.filter(Boolean));
    const { departmentById } = await this.getDepartmentsCache();
    const pending = [...accountDepartmentIds];
    const visited = new Set<string>();

    while (pending.length) {
      const id = pending.pop();
      if (!id || visited.has(id)) continue;
      if (targets.has(id)) return true;
      visited.add(id);
      const parent = departmentById.get(id)?.parent;
      if (parent) pending.push(parent);
    }
    return false;
  }

  async getAncestorDepartments(departmentIds: readonly string[], deep = true) {
    if (!departmentIds?.length) return [];
    const { departmentById } = await this.getDepartmentsCache();
    const result: CachedOrganizeDepartment[] = [];
    const visited = new Set<string>(departmentIds.filter(Boolean));
    let currentIds = Array.from(new Set(departmentIds.filter(Boolean)));

    while (currentIds.length) {
      const parentIds: string[] = [];
      for (const currentId of currentIds) {
        const parentId = departmentById.get(currentId)?.parent;
        if (!parentId || visited.has(parentId)) continue;
        visited.add(parentId);
        const parent = departmentById.get(parentId);
        if (parent) {
          result.push(parent);
          parentIds.push(parentId);
        }
      }
      if (!parentIds.length) break;
      if (!deep) break;
      currentIds = parentIds;
    }
    return result;
  }

  async getSubDepartments(departmentIds: readonly string[]) {
    if (!departmentIds?.length) return [];
    const cache = await this.getDepartmentsCache();
    const childIds = new Set<string>();
    const departments: CachedOrganizeDepartment[] = [];
    for (const id of departmentIds) {
      for (const childId of cache.childIdsByParentId.get(id) || []) {
        if (childIds.has(childId)) continue;
        childIds.add(childId);
        const department = cache.departmentById.get(childId);
        if (department) departments.push(department);
      }
    }
    return departments;
  }

  async getSiblingDepartments(departmentIds: readonly string[]) {
    if (!departmentIds?.length) return [];
    const { departmentById } = await this.getDepartmentsCache();
    const parentIds = Array.from(new Set(departmentIds.map(id => departmentById.get(id)?.parent).filter(parent => parent !== undefined)));
    const siblings = await this.getSubDepartments(parentIds);
    const sourceIds = new Set(departmentIds);
    return siblings.filter(department => !sourceIds.has(department.id));
  }

  async getDepartmentManagerByLevel(userId: string, option: OrganizeLevelOption) {
    const user = await this.getUserById(userId);
    if (!user) return [];
    const { departmentById } = await this.getDepartmentsCache();
    const chain: CachedOrganizeDepartment[][] = [];
    let currentIds = Array.from(new Set(user.departments || [])).filter(Boolean);
    const visited = new Set<string>();

    while (currentIds.length) {
      const current = currentIds
        .filter(id => !visited.has(id))
        .map(id => departmentById.get(id))
        .filter(Boolean);
      if (!current.length) break;
      current.forEach(department => visited.add(department.id));
      chain.push(current);
      currentIds = Array.from(new Set(current.map(department => department.parent).filter(Boolean)));
    }

    const count = Math.max(0, Number(option?.value) || 0) + 1;
    const selected = option?.mode === "up"
      ? chain.slice(0, count)
      : option?.mode === "down"
        ? chain.slice().reverse().slice(0, count)
        : [];
    return Array.from(new Set(selected.flatMap(departments => departments.flatMap(department => department.managers || []))));
  }

  async getRelationsOfBToA(userAId: string, userBId: string) {
    const relations = new Set<UserRelations>();
    const usersCache = await this.getUsersCache();
    const userA = usersCache.userById.get(userAId);
    const userB = usersCache.userById.get(userBId);
    if (!userA || !userB) return relations;
    if (userBId !== "0") relations.add(UserRelations.allMembers);
    if (userAId === userBId) {
      relations.add(UserRelations.createrSelf);
      return relations;
    }

    const { departmentById } = await this.getDepartmentsCache();
    const userADepartments = new Set(userA.departments || []);
    const userBDepartments = new Set(userB.departments || []);
    if (!userADepartments.size || !userBDepartments.size) return relations;

    for (const departmentId of userADepartments) {
      const department = departmentById.get(departmentId);
      if (!department) continue;
      if (department.managers?.includes(userBId)) relations.add(UserRelations.manager);
      if (userBDepartments.has(departmentId)) relations.add(UserRelations.sameDepartmentUser);

      const visited = new Set<string>();
      let parentId = department.parent;
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        if (userBDepartments.has(parentId)) relations.add(UserRelations.superiorDepartmentMembers);
        const parent = departmentById.get(parentId);
        if (!parent) break;
        if (parent.managers?.includes(userBId)) relations.add(UserRelations.allSupervisorManager);
        parentId = parent.parent;
      }
    }

    for (const departmentId of userBDepartments) {
      const visited = new Set<string>();
      let parentId = departmentById.get(departmentId)?.parent;
      while (parentId && !visited.has(parentId)) {
        if (userADepartments.has(parentId)) {
          relations.add(UserRelations.allDescendantMembers);
          break;
        }
        visited.add(parentId);
        parentId = departmentById.get(parentId)?.parent;
      }
    }
    return relations;
  }

  async getPermissionSources(userId: string): Promise<OrganizePermissionSources | null> {
    const [usersCache, departmentsCache, rolesCache] = await Promise.all([
      this.getUsersCache(),
      this.getDepartmentsCache(),
      this.getRolesCache(),
    ]);
    const user = usersCache.userById.get(userId);
    if (!user) return null;
    return {
      user,
      departments: (user.departments || []).map(id => departmentsCache.departmentById.get(id)).filter(Boolean),
      roles: (user.roles || []).map(id => rolesCache.roleById.get(id)).filter(Boolean),
    };
  }

  async authenticateApiKey(key: string, verify: (secret: string) => boolean) {
    if (!key) return null;
    const usersCache = await this.getUsersCache();
    const credential = usersCache.credentialByApiKey.get(key);
    if (!credential || !verify(credential.secret)) return null;
    const user = usersCache.userById.get(credential.userId);
    if (!user || user.disabled || user.resigned || user.deleteTime > 0) return null;
    return user;
  }

  async resolveUserDisplayNames(ids: readonly string[]) {
    const users = await this.getUsersByIds(ids);
    return new Map(users.map(user => [user.id, user.realname || user.user || user.id]));
  }

  async resolveDepartmentNames(ids: readonly string[]) {
    const departments = await this.getDepartmentsByIds(ids);
    return new Map(departments.map(department => [department.id, department.name || department.id]));
  }

  invalidateUsers(reason?: string) {
    void reason;
    this.invalidate(this.usersState);
  }

  invalidateDepartments(reason?: string) {
    void reason;
    this.invalidate(this.departmentsState);
  }

  invalidateRoles(reason?: string) {
    void reason;
    this.invalidate(this.rolesState);
  }

  invalidateAll(reason?: string) {
    this.invalidateUsers(reason);
    this.invalidateDepartments(reason);
    this.invalidateRoles(reason);
  }

  getStats() {
    return {
      users: this.getStateStats(this.usersState, this.usersState.value?.data.users.length || 0),
      departments: this.getStateStats(this.departmentsState, this.departmentsState.value?.data.departments.length || 0),
      roles: this.getStateStats(this.rolesState, this.rolesState.value?.data.roles.length || 0),
    };
  }

  private async getDescendantDepartmentIds(departmentIds: readonly string[], includeSelf: boolean) {
    const { childIdsByParentId } = await this.getDepartmentsCache();
    const sourceIds = Array.from(new Set(departmentIds.filter(Boolean)));
    const result = new Set<string>(includeSelf ? sourceIds : []);
    const visited = new Set<string>();
    const pending = [...sourceIds];
    while (pending.length) {
      const id = pending.pop();
      if (!id || visited.has(id)) continue;
      visited.add(id);
      for (const childId of childIdsByParentId.get(id) || []) {
        result.add(childId);
        if (!visited.has(childId)) pending.push(childId);
      }
    }
    return result;
  }

  private async getUsersCache() {
    return (await this.ensure(this.usersState, "users", () => this.loadUsers())).data;
  }

  private async getDepartmentsCache() {
    return (await this.ensure(this.departmentsState, "departments", () => this.loadDepartments())).data;
  }

  private async getRolesCache() {
    return (await this.ensure(this.rolesState, "roles", () => this.loadRoles())).data;
  }

  private async ensure<T>(state: CacheState<T>, name: string, loader: () => Promise<T>): Promise<VersionedValue<T>> {
    for (;;) {
      if (state.value?.version === state.version) return state.value;
      const version = state.version;
      let loading = state.loading;
      if (!loading || loading.version !== version) {
        const startedAt = Date.now();
        const promise = loader()
          .then(data => ({ version, data }))
          .then(value => {
            state.loadCount += 1;
            state.lastLoadDurationMs = Date.now() - startedAt;
            state.lastLoadedAt = Date.now();
            if (state.lastLoadDurationMs >= 1000) {
              this.logger.warn(`Organize ${name} cache load took ${state.lastLoadDurationMs}ms`);
            }
            if (state.version === version) state.value = value;
            return value;
          })
          .catch(error => {
            state.loadFailureCount += 1;
            this.logger.error(`Failed to load organize ${name} cache: ${error instanceof Error ? error.name : "unknown"}`);
            throw error;
          });
        loading = { version, promise };
        state.loading = loading;
      }

      let value: VersionedValue<T>;
      try {
        value = await loading.promise;
      } catch (error) {
        if (state.version !== version) continue;
        throw error;
      } finally {
        if (state.loading?.promise === loading.promise) state.loading = undefined;
      }
      if (state.version === value.version) return value;
    }
  }

  private invalidate<T>(state: CacheState<T>) {
    state.version += 1;
    state.value = undefined;
    state.invalidationCount += 1;
  }

  private getStateStats<T>(state: CacheState<T>, itemCount: number) {
    return {
      generation: state.version,
      ready: state.value?.version === state.version,
      loading: state.loading?.version === state.version,
      itemCount,
      loadCount: state.loadCount,
      loadFailureCount: state.loadFailureCount,
      invalidationCount: state.invalidationCount,
      lastLoadDurationMs: state.lastLoadDurationMs,
      lastLoadedAt: state.lastLoadedAt,
    };
  }

  private async loadUsers(): Promise<UsersCache> {
    const entities = await this.entityManager.find(WorkbenchUser, {}, {
      orderBy: { createTime: "ASC" },
      disableIdentityMap: true,
    });
    const userById = new Map<string, CachedOrganizeUser>();
    const userByAccount = new Map<string, CachedOrganizeUser>();
    const userOrderById = new Map<string, number>();
    const userIdsByDepartmentId = new Map<string, string[]>();
    const userIdsByRoleId = new Map<string, string[]>();
    const credentialByApiKey = new Map<string, ApiCredential>();
    const users = entities.map((entity, index) => {
      const user = this.toCachedUser(entity);
      userById.set(user.id, user);
      userByAccount.set(user.user, user);
      userOrderById.set(user.id, index);
      for (const departmentId of user.departments) addToIndex(userIdsByDepartmentId, departmentId, user.id);
      for (const roleId of user.roles) addToIndex(userIdsByRoleId, roleId, user.id);
      if (entity.apiKey && entity.apiSecret) {
        credentialByApiKey.set(entity.apiKey, Object.freeze({ userId: user.id, secret: entity.apiSecret }));
      }
      return user;
    });
    return Object.freeze({
      users: freezeArray(users),
      nonAnonymousUsers: freezeArray(users.filter(user => user.id !== "0")),
      userById,
      userByAccount,
      userOrderById,
      userIdsByDepartmentId: freezeStringArrayIndex(userIdsByDepartmentId),
      userIdsByRoleId: freezeStringArrayIndex(userIdsByRoleId),
      credentialByApiKey,
    });
  }

  private async loadDepartments(): Promise<DepartmentsCache> {
    const entities = await this.entityManager.find(WorkbenchDepartment, {}, {
      orderBy: { createTime: "ASC" },
      disableIdentityMap: true,
    });
    const departmentById = new Map<string, CachedOrganizeDepartment>();
    const childIdsByParentId = new Map<string, string[]>();
    const departments = entities.map(entity => {
      const department = this.toCachedDepartment(entity);
      departmentById.set(department.id, department);
      addToIndex(childIdsByParentId, department.parent, department.id);
      return department;
    });
    return Object.freeze({
      departments: freezeArray(departments),
      departmentById,
      childIdsByParentId: freezeStringArrayIndex(childIdsByParentId),
    });
  }

  private async loadRoles(): Promise<RolesCache> {
    const entities = await this.entityManager.find(WorkbenchRole, {}, {
      orderBy: { createTime: "ASC" },
      disableIdentityMap: true,
    });
    const roleById = new Map<string, CachedOrganizeRole>();
    const roles = entities.map(entity => {
      const role = this.toCachedRole(entity);
      roleById.set(role.id, role);
      return role;
    });
    return Object.freeze({ roles: freezeArray(roles), roleById });
  }

  private toCachedUser(entity: WorkbenchUser): CachedOrganizeUser {
    const source = entity as WorkbenchUser & CachedEntity;
    return Object.freeze({
      id: String(entity.id),
      user: String(entity.user || ""),
      realname: String(entity.realname || ""),
      root: !!entity.root,
      loginTime: Number(entity.loginTime || 0),
      disabled: !!source.disabled,
      roles: freezeArray([...(entity.roles || [])]),
      departments: freezeArray([...(entity.departments || [])]),
      staffNo: String(entity.staffNo || ""),
      phone: String(entity.phone || ""),
      email: String(entity.email || ""),
      usePermissions: cloneAndFreeze(source.usePermissions),
      contactPermissions: cloneAndFreeze(source.contactPermissions),
      isAdmin: isSystemAdminAccount(entity),
      createTime: Number(entity.createTime || 0),
      updateTime: Number(entity.updateTime || 0),
      deleteTime: Number(source.deleteTime || 0),
      resigned: !!source.resigned,
      pass: source.pass,
      apiKey: source.apiKey,
      apiSecret: source.apiSecret,
    });
  }

  private toCachedDepartment(entity: WorkbenchDepartment): CachedOrganizeDepartment {
    const source = entity as WorkbenchDepartment & CachedEntity;
    return Object.freeze({
      id: String(entity.id),
      name: String(entity.name || ""),
      parent: String(entity.parent || ""),
      managers: freezeArray([...(entity.managers || [])]),
      usePermissions: cloneAndFreeze(source.usePermissions),
      createTime: Number(entity.createTime || 0),
      updateTime: Number(entity.updateTime || 0),
      deleteTime: Number(entity.deleteTime || 0),
    });
  }

  private toCachedRole(entity: WorkbenchRole): CachedOrganizeRole {
    const source = entity as WorkbenchRole & CachedEntity;
    return Object.freeze({
      id: String(entity.id),
      name: String(entity.name || ""),
      parent: String(entity.parent || ""),
      isGroup: !!entity.isGroup,
      usePermissions: cloneAndFreeze(source.usePermissions),
      contactPermissions: cloneAndFreeze(source.contactPermissions),
      createTime: Number(entity.createTime || 0),
      updateTime: Number(entity.updateTime || 0),
      deleteTime: Number(entity.deleteTime || 0),
    });
  }
}
