import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { WorkbenchUserRepository, WorkbenchUser, WorkbenchDepartmentRepository, WorkbenchDepartment, WorkbenchRoleRepository, WorkbenchRole } from "./entities";
import { EntityManager, FilterQuery } from "@mikro-orm/core";
import { MikroORM, UseRequestContext } from "@mikro-orm/core";
import { PREFERENCES } from '@main/constants';
import { Preferences } from "../common";
import { AiPermissionConfig, OrganizeCategory, OrganizeLevelOption, OrganizeOptionValue } from "@common/types/project";
import { isEmpty } from "@common/utils/object";
import { orMergeTwo } from "@common/utils";
import { UserRelations } from "./types";
import { encodePassword } from "@main/utils";
import { ADMIN_USERNAME, Account, isSystemAdminAccount } from "@common/types/account";
import { Nocode as NocodeEntity, NocodeRepository } from "../project/entities";
import { users } from "./organize";
import { KeySecret } from "@common/types/nocode";
import { numbers, lowercase, uppercase } from 'nanoid-dictionary';
import dayjs from 'dayjs';
import { randomBytes } from "crypto";
import AsyncLock from "async-lock";
import { serverConfig, updateConfig } from "@main/config";
import { OrganizeCacheService } from "./organize-cache.service";

type UsePermissions = Record<string, any>;

function createAlphabetGenerator(alphabet: string) {
  const normalizedAlphabet = Array.from(new Set(String(alphabet || "").split(""))).join("");
  if (!normalizedAlphabet.length) {
    throw new Error("Alphabet must not be empty");
  }

  const alphabetLength = normalizedAlphabet.length;
  const maxByte = Math.floor(256 / alphabetLength) * alphabetLength;

  return (size: number) => {
    const targetSize = Number.isFinite(size) ? Math.max(0, Math.floor(size)) : 0;
    if (!targetSize) {
      return "";
    }

    let result = "";
    while (result.length < targetSize) {
      const remaining = targetSize - result.length;
      const bytes = randomBytes(Math.max(remaining * 2, 8));
      for (const byte of bytes) {
        if (byte >= maxByte) {
          continue;
        }
        result += normalizedAlphabet[byte % alphabetLength];
        if (result.length >= targetSize) {
          break;
        }
      }
    }

    return result;
  };
}

@Injectable()
export class WorkbenchService implements OnApplicationBootstrap {
  private readonly logger = new Logger("workbenchService");
  private readonly workbenchUserRepository: WorkbenchUserRepository;
  private readonly workbenchDepartmentRepository: WorkbenchDepartmentRepository;
  private readonly workbenchRoleRepository: WorkbenchRoleRepository;
  private readonly nocodeRepository: NocodeRepository;
  private accountRecords: { [key: string]: string[] } = {};
  private readonly accountKeySecretLock = new AsyncLock({ timeout: 60 * 1000 });
  constructor(
    private readonly entityManager: EntityManager,
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly moduleRef: ModuleRef,
    private readonly organizeCache: OrganizeCacheService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) {
    this.workbenchUserRepository = this.entityManager.getRepository(WorkbenchUser);
    this.workbenchDepartmentRepository = this.entityManager.getRepository(WorkbenchDepartment);
    this.workbenchRoleRepository = this.entityManager.getRepository(WorkbenchRole);
    this.nocodeRepository = this.entityManager.getRepository(NocodeEntity);
  }


  @UseRequestContext()
  async onApplicationBootstrap() {
    const ks: KeySecret = this.preferences.get('keySecret');
    if (!ks) {
      this.resetKeySecret();
    }
    await this.createAnonymousUser();
    await this.initOrganize();
    if (!__IS_SERVER__ && !this.preferences.get('isInit', false)) {
      this.preferences.set({ isInit: true });
    }
  }

  private async createAnonymousUser(){
    const anonymous = await this.workbenchUserRepository.findOne({ id: "0" });
    if(!anonymous){
      const anonymousUser = new WorkbenchUser();
      anonymousUser.id = '0';
      anonymousUser.user = global.i18next.t('workbenchService.anonymousUser');
      anonymousUser.pass = encodePassword('banban_anonymous');
      anonymousUser.realname = global.i18next.t('workbenchService.anonymousUser');
      await this.workbenchUserRepository.persistAndFlush(anonymousUser);
      this.organizeCache.invalidateUsers("anonymous-user-created");
    }
  }

  private async initOrganize() {
    const admin = await this.workbenchUserRepository.findOne({ user: ADMIN_USERNAME });
    if (!admin) {
      await this.createAdmin("123456");
    }
    const accounts: WorkbenchUser[] = [];
    const departments: WorkbenchDepartment[] = [];
    const allUsers = await this.workbenchUserRepository.findAll();
    if (!this.preferences.get("organizeInit")) {
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (allUsers.find(u => u.user === user.user)) continue;
        const account = new WorkbenchUser();
        account.user = user.user;
        account.pass = encodePassword("123456");
        const staffNo = String(i + 1);
        account.staffNo = `${'0'.repeat(3 - staffNo.length)}${staffNo}`;
        account.realname = user.realName;
        let department = departments.find(d => d.name === user.department);
        if (!department) {
          department = new WorkbenchDepartment();
          department.name = user.department;
          departments.push(department);
        }
        account.departments = [department.id];
        accounts.push(account);
      }
      try {
        await this.workbenchDepartmentRepository.persistAndFlush(departments);
        await this.workbenchUserRepository.persistAndFlush(accounts);
        this.organizeCache.invalidateDepartments("initial-organize-created");
        this.organizeCache.invalidateUsers("initial-organize-created");
        this.preferences.set({ organizeInit: true });
      } catch (err) {
        this.logger.error("organize init error: ", err); 
      }
    }
  }

  async getAnonymousUser() {
    return await this.organizeCache.getUserById("0");
  }

  async getAllDepartments() {
    return await this.organizeCache.getAllDepartments();
  }

  async getAllUsers() {
    return await this.organizeCache.getAllUsers();
  }

  private async findUserByAccount(user: string, excludeId?: string) {
    const users = await this.workbenchUserRepository.find({ user } as FilterQuery<WorkbenchUser>);
    return users.find((item) => item.id !== excludeId) || null;
  }

  private async findUserByStaffNo(staffNo: string, excludeId?: string) {
    const users = await this.workbenchUserRepository.find({ staffNo } as FilterQuery<WorkbenchUser>);
    return users.find((item) => item.id !== excludeId) || null;
  }

  private async createAdmin(password: string) {
    let adminAccount = await this.workbenchUserRepository.findOne({ user: ADMIN_USERNAME });
    if (!adminAccount) {
      adminAccount = new WorkbenchUser();
      adminAccount.user = ADMIN_USERNAME;
      adminAccount.realname = ADMIN_USERNAME;
    }
    adminAccount.pass = encodePassword(password);
    if (!adminAccount.apiKey || !adminAccount.apiSecret) {
      const keySecret = await this.createUniqueAccountKeySecret();
      adminAccount.apiKey = keySecret.key;
      adminAccount.apiSecret = keySecret.secret;
    }
    await this.workbenchUserRepository.persistAndFlush(adminAccount);
    this.organizeCache.invalidateUsers("admin-created");
    return adminAccount;
  }

  async getAdmin() {
    return await this.organizeCache.getAdmin();
  }

  // 用户列表
  public async getUserList() {
    try {
      return await this.organizeCache.getAllNonAnonymousUsers();
    } catch (error) {
      this.logger.error("getUserList error: ", error);
      throw new Error("Failed to fetch user list");
    }
  }

  public async getUserById(id: string) {
    try {
      const user = await this.organizeCache.getUserById(id);
      if (!user) {
        throw new Error("User not found");
      }
      return {
        ...user,
        roles: [...user.roles],
        departments: [...user.departments],
        usePermissions: user.usePermissions ? JSON.parse(JSON.stringify(user.usePermissions)) : undefined,
        contactPermissions: user.contactPermissions ? JSON.parse(JSON.stringify(user.contactPermissions)) : undefined,
        isAdmin: isSystemAdminAccount(user),
      };
    } catch (error) {
      this.logger.error("getUserById error: ", error);
      throw new Error("Failed to fetch user");
    }
  }

  private async validateUser(user: Partial<WorkbenchUser>, isEditor?: boolean, excludeId?: string) {
    if (!user?.user || !user.user.trim()) throw new Error(global.i18next.t('workbenchService.lackParamUser'));
    // if (!user?.pass || !user.pass.trim()) throw new Error("缺少参数pass");

    const foundUser = await this.findUserByAccount(user.user, excludeId);
    if (!isEditor && foundUser) throw new Error(global.i18next.t('workbenchService.accountDuplicate'));

    if (user.staffNo) {
      const foundUserByStaffNo = await this.findUserByStaffNo(user.staffNo, user.id);
      if (foundUserByStaffNo) throw new Error(global.i18next.t('workbenchService.jobNumberDuplicate'));
    }

    return true;
  }

  public async addUser(user: WorkbenchUser) {
    await this.validateUser(user);
    const workbenchUser = new WorkbenchUser();
    for (const k in user) {
      if (k === "apiKey" || k === "apiSecret") continue;
      workbenchUser[k] = user[k];
    }
    workbenchUser.pass = encodePassword(user.pass);
    const keySecret = await this.createUniqueAccountKeySecret();
    workbenchUser.apiKey = keySecret.key;
    workbenchUser.apiSecret = keySecret.secret;
    try {
      await this.workbenchUserRepository.persistAndFlush(workbenchUser);
      this.organizeCache.invalidateUsers("user-added");
    } catch (error) {
      this.logger.error("addUser error: ", error);
      throw new Error("Failed to add user");
    }
    return workbenchUser;
  }

  async addUserToDepartment(userIds: string[], departmentId: string) {
    const users = await this.workbenchUserRepository.find({ id: { $in: userIds } });
    for (const user of users) {
      if (!user.departments?.includes(departmentId)) {
        user.departments = [...(user.departments || []), departmentId]
      }
    }
      await this.workbenchUserRepository.persistAndFlush(users);
      this.organizeCache.invalidateUsers("users-added-to-department");
  }

  async addUserToRole(userIds: string[], roleId: string) {
    const users = await this.workbenchUserRepository.find({ id: { $in: userIds } });
    for (const user of users) {
      if (!user.roles?.includes(roleId)) {
        user.roles = [...(user.roles || []), roleId]
      }
    }
      await this.workbenchUserRepository.persistAndFlush(users);
      this.organizeCache.invalidateUsers("users-added-to-role");
  }

  async updateDepartmentParent(departmentId: string, parent: string) {
    const department = await this.workbenchDepartmentRepository.findOne({ id: departmentId });
    if (!department) {
      throw new Error("Department not found");
    }
    if (parent) {
      const parentDepartment = await this.workbenchDepartmentRepository.findOne({ id: parent });
      if (!parentDepartment) {
        throw new Error(global.i18next.t('workbenchService.parentDeptNotExist'));
      }
    }
    department.parent = parent;
    await this.workbenchDepartmentRepository.persistAndFlush(department);
    this.organizeCache.invalidateDepartments("department-parent-updated");
  }

  public async updateUser(user: Partial<WorkbenchUser>) {
    await this.validateUser(user, true, user.id);
    const workbenchUser = await this.workbenchUserRepository.findOne({ id: user.id });
    if (!workbenchUser) {
      throw new Error("User not found");
    }
    const rest = { ...user };
    const pass = rest.pass;
    delete rest.pass;
    delete rest.apiKey;
    delete rest.apiSecret;
    for (const k in rest) {
      workbenchUser[k] = rest[k];
    }
    if (pass && pass !== workbenchUser.pass) {
      workbenchUser.pass = encodePassword(pass);
    }
    workbenchUser.updateTime = Date.now();
    try {
      await this.workbenchUserRepository.persistAndFlush(workbenchUser);
      this.organizeCache.invalidateUsers("user-updated");
    } catch (error) {
      this.logger.error("updateUser error: ", error);
      throw new Error("Failed to update user");
    }
    return workbenchUser;
  }
  
  async updateUserInfo(user: Partial<WorkbenchUser>) {
    const workbenchUser = await this.workbenchUserRepository.findOne({ id: user.id });
    if (!workbenchUser) {
      throw new Error("User not found");
    }
    const { phone, email } = user;
    workbenchUser.phone = phone;
    workbenchUser.email = email;
    try {
      await this.workbenchUserRepository.persistAndFlush(workbenchUser);
      this.organizeCache.invalidateUsers("user-info-updated");
    } catch (error) {
      this.logger.error("updateUser error: ", error);
      throw new Error("Failed to update user");
    }
    return true;
  }

  async updatePassword(id: string, oldPassword: string, newPassword: string) {
    const user = await this.workbenchUserRepository.findOne({ id });
    if (!user) {
      throw new Error(global.i18next.t('workbenchServiceTs.userNotFound'));
    }
    const adminPass = this.getAdminPassword();
    let pwdValid = adminPass ? adminPass === oldPassword : false;
    if (!pwdValid) pwdValid = user.pass === encodePassword(oldPassword);
    if (!pwdValid) throw new Error(global.i18next.t('workbenchServiceTs.oldPasswordIsIncorrect'));
    if (__IS_SERVER__ && serverConfig.adminPass) updateConfig("adminPass", newPassword);
    user.pass = encodePassword(newPassword);
    await this.workbenchUserRepository.persistAndFlush(user);
    this.organizeCache.invalidateUsers("user-password-updated");
  }

  public async removeUserPermanently(account: Account, id: string) {
    if (!isSystemAdminAccount(account)) {
      throw new Error('Permission denied');
    }
    try {
      const user = await this.workbenchUserRepository.findOne({ id });
      if (!user) {
        throw new Error("User not found");
      }
      if (user.user === ADMIN_USERNAME) throw new Error(global.i18next.t('workbenchService.illegalOperation'));
      await this.workbenchUserRepository.removeAndFlush(user);
      this.organizeCache.invalidateUsers("user-permanently-removed");
    } catch (error) {
      this.logger.error("removeUserPermanently error: ", error);
      throw new Error("Failed to remove user");
    }
    return 'remove success';
  }

  // 部门列表
  public async getDepartmentList() {
    try {
      return await this.organizeCache.getAllDepartments();

    } catch (error) {
      this.logger.error("getDepartmentList error: ", error);
      throw new Error("Failed to fetch department list");
    }
  }

  private async validateDepartment(department: Partial<WorkbenchDepartment>) {
    if (!department?.name || !department.name.trim()) throw new Error(global.i18next.t('workbenchService.lackParamName'));

    let parent = department.parent;

    if (department.id && parent === undefined) {
      const existing = await this.workbenchDepartmentRepository.findOne({ id: department.id });
      if (existing) {
        parent = existing.parent;
      }
    }

    const searchCondition: FilterQuery<WorkbenchDepartment> = {
      name: department.name,
      parent: parent || ""
    };

    if (department.id) {
      searchCondition.id = { $ne: department.id };
    }

    const foundDepartment = await this.workbenchDepartmentRepository.findOne(searchCondition);
    if (foundDepartment) throw new Error(global.i18next.t('workbenchService.deptAlreadyExist'));
    return true;
  }

  public async updateDepartmentManagers(id: string, managers: string[]) {
    try {
      const departmentEntity = await this.workbenchDepartmentRepository.findOne({ id });
      if (!departmentEntity) {
        throw new Error(global.i18next.t('workbenchService.deptNotFound'));
      }
      departmentEntity.managers = managers;
      await this.workbenchDepartmentRepository.persistAndFlush(departmentEntity);
      this.organizeCache.invalidateDepartments("department-managers-updated");
      return departmentEntity;
    } catch (error) {
      this.logger.error("editDepartment error: ", error);
      throw new Error(global.i18next.t('workbenchService.updateDataFail'));
    }
  }

  public async addDepartment(department: WorkbenchDepartment) {
    await this.validateDepartment(department);
    const departmentEntity = new WorkbenchDepartment();
    for (const k in department) {
      departmentEntity[k] = department[k];
    }
    try {
      await this.workbenchDepartmentRepository.persistAndFlush(departmentEntity);
      this.organizeCache.invalidateDepartments("department-added");
    } catch (error) {
      this.logger.error("addDepartment error: ", error);
      throw new Error("Failed to add department");
    }
    return departmentEntity;
  }

  public async removeDepartment(id: string) {
    try {
      const department = await this.workbenchDepartmentRepository.findOne({ id });
      if (!department) {
        throw new Error("Department not found");
      }
      const children = await this.workbenchDepartmentRepository.find({ parent: id });
      if (children.length > 0) {
        throw new Error("There are sub-departments and they cannot be deleted");
      }
      await this.workbenchDepartmentRepository.removeAndFlush(department);
      this.organizeCache.invalidateDepartments("department-removed");
    } catch (error) {
      this.logger.error("removeDepartment error: ", error);
      throw new Error("Failed to remove department");
    }
    return 'remove success';
  }

  public async updateDepartment(department: Partial<WorkbenchDepartment>) {
    const { id, ...rest } = department;
    await this.validateDepartment(department);
    try {
      const departmentEntity = await this.workbenchDepartmentRepository.findOne({ id });
      if (!departmentEntity) {
        throw new Error("Department not found");
      }
      for (const k in rest) {
        departmentEntity[k] = rest[k];
      }
      await this.workbenchDepartmentRepository.persistAndFlush(departmentEntity);
      this.organizeCache.invalidateDepartments("department-updated");
      return departmentEntity;
    } catch (error) {
      this.logger.error("editDepartment error: ", error);
      throw new Error("Failed to edit department");
    }
  }

  // 角色列表
  public async getRoleList() {
    try {
      return await this.organizeCache.getAllRoles();

    } catch (error) {
      this.logger.error("getRoleList error: ", error);
      throw new Error("Failed to fetch role list");
    }
  }

  private async validateRole(role: Partial<WorkbenchRole>, isEditor?: boolean) {
    if (!role.name || !role.name.trim()) throw new Error(global.i18next.t('workbenchService.lackParamName'));
    // if (role.isGroup && !role.parent) throw new Error("缺少参数parent");

    const foundRole = await this.workbenchRoleRepository.findOne({ name: role.name });
    if (!isEditor && foundRole) throw new Error(global.i18next.t('workbenchService.roleAlreadyExist'));
    
    return true;
  }

  private async validateRoleGroup(groupName: string) {
    if(!groupName) return
    const foundRole = await this.workbenchRoleRepository.findOne({ name: groupName });
    if (foundRole) throw new Error(global.i18next.t('workbenchService.roleGroupAlreadyExist'));
    
    return true;
  }

  public async addRole(options) {
    await this.validateRole(options);
    const roleEntity = new WorkbenchRole();
    roleEntity.name = options.name;
    roleEntity.parent = options.parent;
    options.isGroup && (roleEntity.isGroup = options.isGroup);
    try {
      await this.workbenchRoleRepository.persistAndFlush(roleEntity);
      this.organizeCache.invalidateRoles("role-added");
      return roleEntity;
    } catch (error) {
      this.logger.error("addRole error: ", error);
      throw new Error("Failed to add role");
    }
  }


  public async removeRole(id: string) {
    try {
      const role = await this.workbenchRoleRepository.findOne({ id });
      if (!role) {
        throw new Error("role not found");
      }

      // if (role.isGroup) {
      //   const children = await this.workbenchRoleRepository.find({ parent: id });
      //   if (children.length > 0) {
      //     for (const child of children || []) {
      //       await this.removeRole(child.id);
      //     }
      //   }
      // }

      await this.workbenchRoleRepository.removeAndFlush(role);
      this.organizeCache.invalidateRoles("role-removed");
    } catch (error) {
      this.logger.error("removeRole error: ", error);
      throw new Error("Failed to remove role");
    }
    return 'remove success';
  }

  public async removeRoleGroup(id: string) {
    try {
      const groupEntity = await this.workbenchRoleRepository.findOne({ id });
      if (!groupEntity.isGroup) {
        throw new Error("group not found");
      }

        const children = await this.workbenchRoleRepository.find({ parent: id });
        if (children.length > 0) {
          throw new Error(global.i18next.t('workbenchService.nonEmptyRoleGroupNotDeletable'));
      }

      await this.workbenchRoleRepository.removeAndFlush(groupEntity);
      this.organizeCache.invalidateRoles("role-group-removed");
    } catch (error) {
      this.logger.error("removeGroup error: ", error);
      throw new Error("Failed to remove group");
    }
    return 'remove success';
  }

  public async updateRole(role: Partial<WorkbenchRole>) {
    const { id, ...rest } = role;
    await this.validateRole(rest, true);
    try {
      const roleEntity = await this.workbenchRoleRepository.findOne({ id });
      if (!roleEntity) {
        throw new Error("role not found");
      }
      for (const k in rest) {
        roleEntity[k] = rest[k];
      }
      await this.workbenchRoleRepository.persistAndFlush(roleEntity);
      this.organizeCache.invalidateRoles("role-updated");
      return roleEntity;
    } catch (error) {
      this.logger.error("editRole error: ", error);
      throw new Error("Failed to edit role");
    }
  }

  async getRelationBetweenUsers(fristId: string, nextId: string): Promise<Set<UserRelations>>{
    return await this.organizeCache.getRelationsOfBToA(fristId, nextId);
  }

  /**
   * 判断两个用户之间的关系
   * @param userAId 用户A的id(提交人)
   * @param userBId 用户B的id(当前用户)
   * @returns 用户B与用户A的关系
   */
  async getRelationsOfBToA(userAId: string, userBId: string): Promise<Set<UserRelations>>{
    return await this.organizeCache.getRelationsOfBToA(userAId, userBId);
  }

  async completedInit(password: string) {
    await this.createAdmin(password);
    this.preferences.set({
      isInit: true,
    })
  }

  async setAdmins(account: Account, ids: string[]) {
    if (account.user !== ADMIN_USERNAME) {
      throw new Error('Permission denied');
    }
    const oldUsers = await this.workbenchUserRepository.find({isAdmin: true});
    const oldIds = oldUsers.map(user => user.id);
    // const removedIds = oldIds.filter(id => !ids.includes(id));
    const addedIds = ids.filter(id => !oldIds.includes(id));
    const addUsers = await this.workbenchUserRepository.find({id: addedIds});
    for (const user of addUsers) {
      user.isAdmin = true;
    }
    await this.workbenchUserRepository.persistAndFlush(addUsers);
    // const removeUsers = await this.workbenchUserRepository.find({id: removedIds});
    // for (const user of removeUsers) {
    //   user.isAdmin = false;
    // }
    // await this.workbenchUserRepository.persistAndFlush(removeUsers);
  }

  async removeUserAsAdmin(account: Account, id: string) {
    if (account.user !== ADMIN_USERNAME) {
      throw new Error('Permission denied');
    }
    const user = await this.workbenchUserRepository.findOne({id});
    user.isAdmin = false;
    await this.workbenchUserRepository.persistAndFlush(user);
  }

  async getUsers(options: OrganizeOptionValue): Promise<Account[]> {
    return await this.organizeCache.resolveUsers(options);
  }

  async isInDepartments(accountDepartments: string[], departmentIds: string[]) {
    return await this.organizeCache.isInDepartments(accountDepartments, departmentIds);
  }

  async getSiblingDepartments(departmentIds: string[]) {
    return await this.organizeCache.getSiblingDepartments(departmentIds);
  }


  async getAncestorDepartments(departmentIds: string[], deep = true): Promise<WorkbenchDepartment[]> {
    return await this.organizeCache.getAncestorDepartments(departmentIds, deep) as WorkbenchDepartment[];
  }

  async getSubDepartments(departmentIds: string[]) {
    return await this.organizeCache.getSubDepartments(departmentIds);
  }

  private async getDepartmentChainFromUserId(userId: string) {
    const user = await this.organizeCache.getUserById(userId);
    if (!user) return [];
    const chain: WorkbenchDepartment[][] = [];
    let currentIds = user.departments;
    while (currentIds.length) {
      const departments = await this.organizeCache.getDepartmentsByIds(currentIds);
      if (!departments.length) break;
      chain.push(departments as WorkbenchDepartment[]);
      currentIds = departments.map(d => d.parent).filter(Boolean);
    }
    return chain;
  }

  async getDepartmentManagerByLevel(userId: string, option: OrganizeLevelOption) {
    return await this.organizeCache.getDepartmentManagerByLevel(userId, option);
  }

  async getDepartmentsByIds(departmentIds: string|string[]) {
    if (!Array.isArray(departmentIds)) {
      departmentIds = [departmentIds];
    }
    return await this.organizeCache.getDepartmentsByIds(departmentIds);
  }

  async filterValidUsers(users: string[]) {
    return await this.organizeCache.getUsersByIds(users);
  }

  async getPermissionsByUserId(userId: string) {
    const sources = await this.organizeCache.getPermissionSources(userId);
    if (!sources) throw new Error("User not found");
    const { user, departments, roles } = sources;
    const defaults = isSystemAdminAccount(user) ? await this.getDefaultAdminUsePermissions() : {};
    let usePermissions: UsePermissions = {};
    for (const department of departments) usePermissions = orMergeTwo(usePermissions, department.usePermissions || {});
    for (const role of roles) usePermissions = orMergeTwo(usePermissions, role.usePermissions || {});
    return { usePermissions: { ...defaults, ...usePermissions, ...(user.usePermissions || {}) } };
  }

  private async getDefaultAdminUsePermissions(): Promise<UsePermissions> {
    const nocodes = await this.nocodeRepository.find({ $or: [{ deleted: { $ne: true } }, { deleted: null }] });
    return nocodes.reduce<UsePermissions>((result, nocode) => {
      const id = String(nocode?.id || "").trim();
      if (id) result[id] = { enabled: true };
      return result;
    }, {});
  }

  getKeySecret() {
    const ks: KeySecret = this.preferences.get('keySecret');

    return {
      key: ks?.key,
      secret: ks?.secret
    }
  }

  resetKeySecret() {
    const alphabet: string = numbers + lowercase + uppercase;
    const nanoid = createAlphabetGenerator(alphabet);

    const key: string = nanoid(12);
    const secret: string = nanoid(24);
    const ks: KeySecret = { key, secret };
    this.preferences.set({ keySecret: ks });

    return {
      key,
      secret
    }
  }

  async getAccountKeySecret(accountId: string) {
    return await this.ensureAccountKeySecret(accountId);
  }

  async resetAccountKeySecret(accountId: string) {
    return await this.accountKeySecretLock.acquire(accountId, async () => {
      const account = await this.getAccountForKeySecret(accountId);
      const keySecret = await this.createUniqueAccountKeySecret();
      account.apiKey = keySecret.key;
      account.apiSecret = keySecret.secret;
      account.updateTime = Date.now();
      await this.workbenchUserRepository.persistAndFlush(account);
      return keySecret;
    });
  }

  private async ensureAccountKeySecret(accountId: string) {
    return await this.accountKeySecretLock.acquire(accountId, async () => {
      const account = await this.getAccountForKeySecret(accountId);
      if (account.apiKey && account.apiSecret) {
        return {
          key: account.apiKey,
          secret: account.apiSecret,
        };
      }

      const keySecret = await this.createUniqueAccountKeySecret();
      account.apiKey = keySecret.key;
      account.apiSecret = keySecret.secret;
      account.updateTime = Date.now();
      await this.workbenchUserRepository.persistAndFlush(account);
      return keySecret;
    });
  }

  private async getAccountForKeySecret(accountId: string) {
    if (!accountId || accountId === "0") {
      throw new Error("Invalid account");
    }
    const account = await this.workbenchUserRepository.findOne({ id: accountId });
    if (!account) {
      throw new Error("Account is unavailable");
    }
    return account;
  }

  private async createUniqueAccountKeySecret(): Promise<KeySecret> {
    const alphabet = numbers + lowercase + uppercase;
    const nanoid = createAlphabetGenerator(alphabet);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const key = nanoid(12);
      const globalKey = this.getKeySecret()?.key;
      const existingAccount = await this.workbenchUserRepository.findOne({ apiKey: key });
      if (key !== globalKey && !existingAccount) {
        return {
          key,
          secret: nanoid(24),
        };
      }
    }

    throw new Error("Failed to generate account API key");
  }

  addAccountRecord(accountId: string) {
    if (!accountId) return;
    const day = dayjs().format("YYYY-MM-DD");
    if (!this.accountRecords[day]) {
      this.accountRecords[day] = [accountId];
    } else {
      if (this.accountRecords[day].includes(accountId)) return;
      this.accountRecords[day].push(accountId);
    }
  }

  getTodayAccountRecordCount(): number {
    const todayKey = dayjs().format("YYYY-MM-DD");
    return this.accountRecords[todayKey]?.length ?? 0;
  }

  private async findOrCreateDepartmentByPath(departmentPath: string): Promise<WorkbenchDepartment | null> {
    const departmentNames = String(departmentPath || "").split('.').map(name => name.trim()).filter(Boolean);
    if (isEmpty(departmentNames)) return null;

    let parent = "";
    let department: WorkbenchDepartment | null = null;

    for (const departmentName of departmentNames) {
      department = await this.workbenchDepartmentRepository.findOne({
        name: departmentName,
        parent,
      });
      if (!department) {
        department = new WorkbenchDepartment();
        department.name = departmentName;
        department.parent = parent;
        await this.workbenchDepartmentRepository.persistAndFlush(department);
      }
      parent = department.id;
    }

    return department;
  }

  public async importUsers(usersInfoData) {
    let createdUserCount = 0; // 统计新创建的成员数量

    const usersInfo = usersInfoData.map(user => {
      return {
        user: String(user.账号 ?? ''),
        pass: String(user.密码 ?? ''),
        realname: String(user.姓名 ?? ''),
        staffNo: String(user.工号 || user.员工编号 || user.编号 || ''),
        phone: String(user.手机号 ?? ''),
        email: String(user.邮箱 ?? ''),
        departments: String(user.部门 ?? '').split(',').map(item => item.trim()).filter(Boolean),
        roles: String(user.角色 ?? '').split(',').map(item => item.trim()).filter(Boolean),
      };
    }).filter(u => !(!u.user || !u.pass || !u.realname));

    // 遍历用户信息数组处理每个用户
    for (const user of usersInfo) {
      // 检查用户是否已存在
      const existingUser = await this.findUserByAccount(user.user);
      if (!existingUser) {
        const workbenchUser = new WorkbenchUser();
        workbenchUser.user = user.user;
        workbenchUser.pass = user.pass;
        workbenchUser.realname = user.realname;
        workbenchUser.phone = user.phone;
        workbenchUser.email = user.email;
        
        // 处理部门信息
        if (!isEmpty(user.departments)) {
          const departmentIds = [];
          for (const deptName of user.departments) {
            const department = await this.findOrCreateDepartmentByPath(deptName);
            if (department && !departmentIds.includes(department.id)) {
              departmentIds.push(department.id);
            }
          }
          workbenchUser.departments = departmentIds;
        }
        
        // 处理角色信息
        if (!isEmpty(user.roles)) {
          const roleIds = [];
          for (const roleName of user.roles) {
            let role = await this.workbenchRoleRepository.findOne({ name: roleName });
            if (!role) {
              // 如果角色不存在，则创建新角色
              role = new WorkbenchRole();
              role.name = roleName;
              await this.workbenchRoleRepository.persistAndFlush(role);
            }
            roleIds.push(role.id);
          }
          workbenchUser.roles = roleIds;
        }
        
        await this.addUser(workbenchUser);
        createdUserCount++;
      }
    }

    return createdUserCount;
  }
  getAdminPassword() {
    return __IS_SERVER__ ? String(serverConfig.adminPass || "") : "";
  }

  async setCompanyName(companyName: string) {
    this.preferences.set({
      companyName: companyName,
    })
    return true;
  }

  getAiPermissionConfig() {
    return this.normalizeAiPermissionConfig(this.preferences.get("aiPermissionConfig"));
  }

  async setAiPermissionConfig(config?: AiPermissionConfig | null) {
    const previous = this.getAiPermissionConfig();
    const normalized = this.normalizeAiPermissionConfig(config);
    normalized.updateTime = Date.now();
    this.preferences.set({
      aiPermissionConfig: normalized,
    });
    await this.notifyChangedAiPermissionApps(previous, normalized);
    return normalized;
  }

  private normalizeAiPermissionConfig(config?: AiPermissionConfig | null) {
    const apps = Object.entries(config?.apps || {}).reduce<Record<string, { allForms: boolean; formIds: string[] }>>((result, [appId, permission]) => {
      const normalizedAppId = String(appId || "").trim();
      if (!normalizedAppId) {
        return result;
      }

      const allForms = permission?.allForms === true;
      const formIds = Array.from(new Set(
        (Array.isArray(permission?.formIds) ? permission.formIds : [])
          .map(item => String(item || "").trim())
          .filter(Boolean),
      ));

      if (!allForms && !formIds.length) {
        return result;
      }

      result[normalizedAppId] = {
        allForms,
        formIds: allForms ? [] : formIds,
      };
      return result;
    }, {});

    const updateTime = Number(config?.updateTime || 0);
    return {
      apps,
      updateTime: Number.isFinite(updateTime) && updateTime > 0 ? updateTime : undefined,
    };
  }

  async ensureNewAppAiPermission(appId: string) {
    const normalizedAppId = String(appId || "").trim();
    if (!normalizedAppId) {
      return this.getAiPermissionConfig();
    }

    const config = this.getAiPermissionConfig();
    const hasConfiguredApps = Object.keys(config?.apps || {})
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .length > 0;
    const hasConfiguredUpdateTime = Number.isFinite(Number(config?.updateTime || 0)) && Number(config?.updateTime || 0) > 0;

    if (!hasConfiguredApps && !hasConfiguredUpdateTime) {
      return config;
    }

    if (config.apps?.[normalizedAppId]) {
      return config;
    }

    return await this.setAiPermissionConfig({
      ...config,
      apps: {
        ...(config.apps || {}),
        [normalizedAppId]: {
          allForms: true,
          formIds: [],
        },
      },
    });
  }

  async copyAppAiPermission(sourceAppId: string, targetAppId: string, uidMap?: Record<string, string>) {
    const normalizedSourceAppId = String(sourceAppId || "").trim();
    const normalizedTargetAppId = String(targetAppId || "").trim();

    if (!normalizedSourceAppId || !normalizedTargetAppId) {
      return this.getAiPermissionConfig();
    }

    const config = this.getAiPermissionConfig();
    const hasConfiguredApps = Object.keys(config?.apps || {})
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .length > 0;
    const hasConfiguredUpdateTime = Number.isFinite(Number(config?.updateTime || 0)) && Number(config?.updateTime || 0) > 0;

    if (!hasConfiguredApps && !hasConfiguredUpdateTime) {
      return config;
    }

    const sourcePermission = config.apps?.[normalizedSourceAppId];
    if (!sourcePermission) {
      return config;
    }

    const formIds = sourcePermission.allForms ? [] : Array.from(new Set(
      (sourcePermission.formIds || [])
        .map(item => {
          const normalized = String(item || "").trim();
          return uidMap?.[normalized] || normalized;
        })
        .filter(Boolean),
    ));

    return await this.setAiPermissionConfig({
      ...config,
      apps: {
        ...(config.apps || {}),
        [normalizedTargetAppId]: {
          allForms: sourcePermission.allForms === true,
          formIds,
        },
      },
    });
  }

  async backfillNewlyCreatedAppAiPermissions() {
    const config = this.getAiPermissionConfig();
    const hasConfiguredApps = Object.keys(config?.apps || {})
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .length > 0;
    const configUpdateTime = Number(config?.updateTime || 0);
    const hasConfiguredUpdateTime = Number.isFinite(configUpdateTime) && configUpdateTime > 0;

    if (!hasConfiguredApps && !hasConfiguredUpdateTime) {
      return config;
    }

    const nocodeMetas = await this.nocodeRepository.find({});
    const missingRecentApps = nocodeMetas.filter(meta => {
      const appId = String(meta?.id || "").trim();
      if (!appId || meta?.deleted === true || config.apps?.[appId]) {
        return false;
      }
      if (!hasConfiguredUpdateTime) {
        return false;
      }
      const createTime = Number(meta?.createTime || 0);
      return Number.isFinite(createTime) && createTime > configUpdateTime;
    });

    if (!missingRecentApps.length) {
      return config;
    }

    const nextApps = {
      ...(config.apps || {}),
    } as NonNullable<AiPermissionConfig["apps"]>;

    for (const meta of missingRecentApps) {
      const appId = String(meta?.id || "").trim();
      if (!appId) {
        continue;
      }
      nextApps[appId] = {
        allForms: true,
        formIds: [],
      };
    }

    return await this.setAiPermissionConfig({
      ...config,
      apps: nextApps,
    });
  }

  private getAiWarmupService() {
    const warmupModule = require('../ai/memory/ai-app-memory-warmup.service') as typeof import('../ai/memory/ai-app-memory-warmup.service');
    return this.moduleRef.get(warmupModule.AiAppMemoryWarmupService, { strict: false });
  }

  private async notifyChangedAiPermissionApps(previous?: AiPermissionConfig | null, next?: AiPermissionConfig | null) {
    const changedAppIds = new Set<string>();
    const appIds = new Set<string>([
      ...Object.keys(previous?.apps || {}),
      ...Object.keys(next?.apps || {}),
    ]);

    for (const appId of appIds) {
      const normalizedAppId = String(appId || "").trim();
      if (!normalizedAppId) {
        continue;
      }
      const previousPermission = JSON.stringify(previous?.apps?.[normalizedAppId] || null);
      const nextPermission = JSON.stringify(next?.apps?.[normalizedAppId] || null);
      if (previousPermission !== nextPermission) {
        changedAppIds.add(normalizedAppId);
      }
    }

    if (!changedAppIds.size) {
      return;
    }

    await Promise.all(
      [...changedAppIds].map(appId =>
        this.getAiWarmupService()?.invalidateSemanticMemory(appId, 'ai-permission').catch(() => undefined),
      ),
    );
  }

}
