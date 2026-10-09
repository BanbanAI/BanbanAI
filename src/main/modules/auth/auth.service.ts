import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { WorkbenchUser, WorkbenchUserRepository } from "../workbench/entities";
import { EntityManager } from "@mikro-orm/core";
import { UserService } from "../user/user.service";
import { encodePassword } from "@main/utils";
import { WorkbenchService } from "../workbench/workbench.service";
import { Account, ADMIN_USERNAME } from "@common/types/account";
import { CachedOrganizeUser, OrganizeCacheService } from "../workbench/organize-cache.service";


@Injectable()
export class AuthService {
  private readonly workbenchUserRepository: WorkbenchUserRepository;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly workbenchService: WorkbenchService,
    private readonly organizeCache: OrganizeCacheService,

    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {
    this.workbenchUserRepository = this.entityManager.getRepository(WorkbenchUser);
  }

  async validateUser(username: string, password: string): Promise<any> {
    if (__IS_SERVER__) {
      const adminPass = await this.workbenchService.getAdminPassword(); // 无桌面可以在config.json中自定义管理员密码
      const user = await this.workbenchUserRepository.findOne({ user: username });
      let pwdValid = adminPass ? adminPass === password : false;
      if (!pwdValid) pwdValid = user?.pass === encodePassword(password);
      if (user && pwdValid) return await this.buildRuntimeAccount(user);
    } else {
      const user = await this.workbenchUserRepository.findOne({ user: username, pass: encodePassword(password) });
      if (user) return await this.buildRuntimeAccount(user);
    }
    throw new Error(global.i18next.t("AccountServiceTs.passwordError"));
  }

  async loadAccount(id: string): Promise<any> {
    const loadedUser = await this.organizeCache.getUserById(id);

    if (loadedUser) {
      if (loadedUser.disabled) {
        throw new Error(global.i18next.t("AccountServiceTs.notEnabled"));
      }
      return await this.buildRuntimeAccount(loadedUser);
    }
    throw new Error(`no sucn account(id=${id})`);
  }

  filterUserInfo(user: WorkbenchUser | CachedOrganizeUser): Account & { isSuperAdmin: boolean; usePermissions?: Record<string, any> } {
    const isSuperAdmin = user.user === ADMIN_USERNAME;
    const isAdmin = user.isAdmin || isSuperAdmin;
    const entityUser = user as WorkbenchUser & { toJSON?: () => Record<string, unknown> };
    const rest: Record<string, any> = typeof entityUser.toJSON === "function" ? entityUser.toJSON() : { ...user };
    delete rest.pass;
    delete rest.token;
    delete rest.apiKey;
    delete rest.apiSecret;
    return {...rest, isAdmin, isSuperAdmin} as Account & { isSuperAdmin: boolean; usePermissions?: Record<string, any> };
  }

  async buildRuntimeAccount(user: WorkbenchUser | CachedOrganizeUser): Promise<Account & { isSuperAdmin: boolean; usePermissions?: Record<string, any> }> {
    const account = this.filterUserInfo(user);
    const permission = await this.workbenchService.getPermissionsByUserId(user.id);
    return { ...account, usePermissions: permission?.usePermissions || account.usePermissions };
  }

  getUser() {
    return this.userService.getUser();
  }

  addAccountRecord(accountId: string) {
    this.workbenchService.addAccountRecord(accountId);
  }
}
