import { Injectable, Inject, Logger, OnApplicationBootstrap, forwardRef } from "@nestjs/common";
import { NOCODES_DIR, PREFERENCES, UPLOADS_DIR, USER } from "@main/constants";
import { getRuntime } from "@main/runtime";
import { Preferences } from "../common";
import { UserWrapper } from "./components/user-wrapper.component";
import { UserRest } from "../client";
import { ProxyOptions, SaasPlan } from "@common/types/user";
import fs from 'fs'
import { EntityManager } from "@mikro-orm/core";
import { NocodeRepository, Nocode as NocodeEntity } from "../project/entities";
import { readdir, rm } from 'fs/promises'
import { getLocalIp, isIntranet } from "@main/utils/net";
import { isEmpty } from "@common/utils/object";
import dayjs from "dayjs";
import { serverConfig } from "@main/config";
import { MikroORM, UseRequestContext } from "@mikro-orm/core";
import { AccountRole } from "@common/types/account";
import { join } from "path";
import { getLocalIpList } from "@main/utils/net";
import { WorkbenchService } from "../workbench/workbench.service";
import { ProjectService } from "../project/project.services";
import { DBInfo, FormDatabaseType } from "@common/types/nocode";
import { DbManager } from "../formData/db.manager";
import { updateConfig } from "@main/config";
import { isNasRuntime } from "@main/utils/nas-runtime";
import { getElectronServerLifecycle } from "@main/electron/electron-server-lifecycle";
import { ServerLaunchConfig } from "@main/server-runtime";

type RechargePaymentUrlOptions = {
  number: string,
  userId: string,
  title: string,
  money: number,
  code?: string,
}

@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger("UserService");
  private readonly nocodeRepository: NocodeRepository;
  private syncUserTimer: number;
  private sendUserTimer: number;
  private syncUserError: string | null = null;
  constructor(
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly userRest: UserRest,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    @Inject(USER) public user: UserWrapper,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
    @Inject(forwardRef(() => ProjectService)) private readonly projectService: ProjectService,
    @Inject(forwardRef(() => WorkbenchService)) private readonly workbenchService: WorkbenchService,
    private readonly dbManager: DbManager,
    private readonly entityManager: EntityManager,
  ) { 
    this.nocodeRepository = this.entityManager.getRepository(NocodeEntity);
  }

  @UseRequestContext()
  async onApplicationBootstrap() {
    const isInit = this.preferences.get('isInit', false);
    this.logger.log("onUserApplicationBootstrap", isInit);
    if (!__IS_SERVER__ || isInit) {
      try {
        await this.loginByToken();
      } catch (err) {
        this.logger.log("login by token error", err)
      }
      this.startSyncUserInfo();
    }
    this.startSendUserInfo();
  }

  getUser() {
    return this.user.getInstance();
  }

  async loginByUsername(username: string, password: string) {
    let sessionId = this.user.get("sessionId");
    if (!sessionId) {
      //为空,本次打开软件首次登录，存放本次sessionId
      let timestamp = new Date().getTime();
      sessionId = "banban_" + timestamp;
      this.preferences.set({ prevSessionId: sessionId });
    }
    let prevSessionId = this.preferences.get("prevSessionId");
    let clientIdentifier = this.preferences.getClientIdentifierEffect();
    let clientUUID = this.preferences.get("clientUUID");
    let { user, loginToken, sessions, onlineLimit } = await this.userRest.loginByUsername(username, password, clientIdentifier, sessionId, prevSessionId, clientUUID);
    this.afterLogin(sessionId, user, sessions, onlineLimit, loginToken);
    return this.user;
  }

  async loginByPhone(phone: string, code: string) {
    const channel = this.preferences.get("channel");
    let prevSessionId = this.preferences.get("prevSessionId");
    let sessionId = this.user.get("sessionId");
    if (!sessionId) {
      //为空,本次打开软件首次登录，存放本次sessionId
      let timestamp = new Date().getTime();
      sessionId = "banban_" + timestamp;
      this.preferences.set({ prevSessionId: sessionId });
    }
    let res = await this.userRest.loginByPhone(
      phone,
      code,
      true,
      sessionId,
      this.preferences.getClientIdentifierEffect(),
      prevSessionId,
      this.preferences.get("clientUUID"),
      channel
    );
    let { user, loginToken, sessions, onlineLimit } = res;
    this.afterLogin(sessionId, user, sessions, onlineLimit, loginToken);
    return this.user;
  }

  async loginByToken() {
    const loginToken = this.preferences.get("loginToken");
    this.logger.debug("token:", loginToken)
    if (!loginToken) {
      throw new Error("no token");
    }
    let prevSessionId = this.preferences.get("prevSessionId");
    let timestamp = new Date().getTime();
    let sessionId = "banban_" + timestamp;
    this.preferences.set({ prevSessionId: sessionId });
    let clientIdentifier = this.preferences.getClientIdentifierEffect();
    let clientUUID = this.preferences.get("clientUUID");
    let { user, sessions, onlineLimit } = await this.userRest.loginByToken(loginToken, clientIdentifier, sessionId, prevSessionId, clientUUID);
    this.afterLogin(sessionId, user, sessions, onlineLimit);
    return this.user;
  }

  private async afterLogin(sessionId: string, user, sessions, onlineLimit, loginToken?) {
    this.syncUserError = null;
    if (loginToken) {
      this.preferences.set({ loginToken });
    }
    this.preferences.set({ isNewClient: false });
    this.user.init();
    this.user.valid = true;
    this.user
      .load(user)
      .update({ onlineLimit, sessionId, sessions });
    this.sendUserInfo();
  }

  async sendLoginCode(phone: string, phoneArea: string) {
    return await this.userRest
      .sendLoginCode(
        phone,
        phoneArea,
      )
  }

  async logout() {
    await this.userRest.clearSession(this.user.get("sessionId"))
    this.preferences.delete("loginToken");
    this.user.init();
    return this.getUser();
  }

  async forceOffline(sessionId: string) {
    let originSessions = this.user.get("sessions");
    const sessionIds = Object.keys(originSessions).filter(key => key !== sessionId);
    if(!sessionIds || sessionIds.length === 0) return;
    for (const sessionId of sessionIds) {
      await this.userRest.clearSession(sessionId);
    }
    let newSessions = {}
    newSessions[sessionId] = originSessions[sessionId];
    return this.user.update({ sessions: newSessions })
  }

  async clearSession(sessionId: string) {
    await this.userRest.clearSession(sessionId)
  }

  private async forcedOfflineDetection() {
    const sessionId = this.user.get("sessionId");
    if (!sessionId) return { valid: true };
    const accounts = this.workbenchService.getTodayAccountRecordCount();
    return await this.userRest.forcedOfflineDetection(sessionId, accounts);
  }

  private startSyncUserInfo() {
    if (this.syncUserTimer) return;
    const randomDuration = Math.floor(Math.random() * 20 - 10);
    this.syncUserTimer = setInterval(() => this.syncUserInfo(), (300 + randomDuration) * 1000);
  }

  private startSendUserInfo() {
    if (this.sendUserTimer) return;
    this.sendUserTimer = setInterval(() => this.sendUserInfo(), (24 * 3600) * 1000);
  }

  async syncUserInfo() {
    let data = null;
    try {
      if (this.preferences.get("loginToken")) {
        data = await this.forcedOfflineDetection();
      }
      this.syncUserError = null;
      this.preferences.set({countLoginFail: 0});
    }
    catch (error) {
      this.syncUserError = error instanceof Error ? error.message : String(error);
      const loginFail = this.preferences.get("countLoginFail", 0);
      if(loginFail <= 6 ) {
        this.preferences.set({countLoginFail: loginFail + 1});
      }else {
        data = {valid: false, user: {id: 0} }
      }
    }
    if (data) {
      if (data.valid) {
        this.user.update(data.user);
      } else {
        this.user.init();
      }
      this.user.valid = data.valid;
    }
  }

  async getUserInfo() {
    if (!this.user.valid) {
      const syncUserError = this.syncUserError;
      this.syncUserError = null;
      if (syncUserError) {
        throw new Error(syncUserError);
      }
    }
    return {
      user: this.getUser(),
      valid: this.user.valid,
    }
  }

  getProjectMax() {
    const user = this.getUser();
    if(user.staff || !isEmpty(serverConfig.db)){
      return 99999;
    }
    return user.projectQuota;
  }

  // 修改昵称
  async actionUpdateNickname(nickname: string) {
    const res = await this.userRest.updateNickname(nickname);
    return this.user.load(res);
  }

  // 修改密码
  async actionUpdatePassword(oldPassword: string, newPassword: string, code: string) {
    await this.userRest.updatePassword(oldPassword, newPassword, code);
    this.user.update({ noPassword: false });
    return this.getUser()
  }

  async actionChargePolling(number: string){
    const res = await this.userRest.chargePolling(number);
    console.log(res);
    const {user} = res;
    if(user){
      //用户更新了
      this.user.load(user);
      res.user = this.getUser()
    }
    return res
  }

  getDomainAndFlush(key: 'shareDomain' | 'domain') {
    const localIp = this.preferences.get("saasIp", getLocalIp());
    const defaultIp = `http://${localIp}`;
    let domain = this.preferences.get(key);
    if (!domain) return defaultIp;
    const [ string, protocol, host ] = domain.match(/(https?:\/\/)?([\w.-]+)/);
    if (!domain.includes('localhost') && !domain.includes('127.0.0.1') && isIntranet(host) && host !== localIp) {
      domain = protocol + localIp;
      this.preferences.set({
        [key]: domain
      })
    }
    return domain;
  }

  private getSaasDomain() {
    const electronLifecycle = getElectronServerLifecycle();
    if (electronLifecycle) {
      const config = electronLifecycle.getConfig();
      const customDomain = this.preferences.get("domain");
      if (customDomain) return customDomain;
      const protocol = config.protocol || this.preferences.get("saasIpProtocol", "http");
      const ip = this.preferences.get("saasIp", getLocalIp());
      return `${protocol}://${ip}:${this.preferences.getSaasPort()}`;
    }
    if (serverConfig.baseURL) {
      return serverConfig.baseURL;
    }
    const domain = this.preferences.get("domain");
    if (domain) return domain;
    const latestIp = getLocalIp();
    let saasIp = this.preferences.get("saasIp", latestIp)
    if (saasIp.startsWith("192.168")) {
      if(latestIp !== saasIp) {
        this.preferences.set({
          saasIp: latestIp
        })
        saasIp = latestIp;
      }
    }
    const protocol = this.preferences.get("saasIpProtocol", this.getUploadedServerCert() ? "https" : "http");
    const saasPort = this.preferences.getSaasPort();
    return `${protocol}://${saasIp}:${saasPort}`;
  }

  async sendRecallPasswordPhoneCode(account: string, phoneArea: string) {
    return await this.userRest.sendRecallPasswordPhoneCode(account, phoneArea)
  }

  async sendRecallPasswordEmailCode(account: string) {
    return await this.userRest.sendRecallPasswordEmailCode(account)
  }

  async recallPasswordVerifyPhone(account: string, code: string, phoneArea: string) {
    return await this.userRest.recallPasswordVerifyPhone(account, code, phoneArea)
  }

  async recallPasswordVerifyEmail(account: string, code: string) {
    return await this.userRest.recallPasswordVerifyEmail(account, code)
  }

  getRechargePaymentUrl(options: RechargePaymentUrlOptions) {
    return this.userRest.getRechargePaymentUrl(options);
  }

  async recallPassword(account: string, password: string, password2: string) {
    if (password !== password2) {
      throw new Error(global.i18next.t("userServiceTs.passwordMismatch"))
    }
    return await this.userRest.recallPassword(account, password, password2)
  }

  async changeShareDomain(domain: string) {
    this.preferences.set({shareDomain: domain})
    return null;
  }

  async changeSharePort(port: number) {
    this.preferences.set({sharePort: port})
    return null;
  }

  async changeServerIp(ip: string) {
    this.preferences.set({ saasIp: String(ip || "").trim() });
    return await this.getDomainPort();
  }

  private validateServerPort(port: number) {
    const value = Number(port);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(global.i18next.t("userService.invalidPort"));
    }
    return value;
  }

  async changeServerPort(port: number) {
    const value = this.validateServerPort(port);
    if (!this.isNasConsoleEditable()) {
      throw new Error(global.i18next.t("userService.consoleConfigUnsupported"));
    }
    if (__IS_SERVER__) await updateConfig("listen", value);
    else this.preferences.set({ saasPort: value });
    return await this.getDomainPort();
  }

  async changeServerProtocol(protocol: "http" | "https") {
    if (protocol !== "http" && protocol !== "https") {
      throw new Error("protocol must use http or https");
    }
    if (!this.isNasConsoleEditable()) {
      throw new Error(global.i18next.t("userService.consoleConfigUnsupported"));
    }
    const lifecycle = getElectronServerLifecycle();
    if (lifecycle) {
      const next = { ...lifecycle.getConfig(), protocol };
      await lifecycle.persistConfig(next);
    } else {
      await updateConfig("protocol", protocol);
    }
    this.preferences.set({ saasIpProtocol: protocol });
    return await this.getDomainPort();
  }

  async getServerProtocol() {
    const uploaded = this.getUploadedServerCert();
    return {
      serverType: __IS_SERVER__ ? serverConfig.protocol : this.preferences.get("saasIpProtocol", uploaded ? "https" : "http"),
      key: uploaded?.key ?? null,
      cert: uploaded?.cert ?? null,
      ca: uploaded?.ca ?? null,
    };
  }

  private getUploadedServerCert() {
    const uploaded = this.preferences.get("serverCert");
    // 只有 key 和 cert 都在才算配置完整，与传输层解析规则保持一致
    return uploaded?.key && uploaded?.cert ? uploaded : undefined;
  }

  async changeServerCertificate(type: "key" | "cert" | "ca", content?: string) {
    if (type !== "key" && type !== "cert" && type !== "ca") throw new Error("invalid certificate type");
    if (!this.isNasConsoleEditable()) {
      throw new Error(global.i18next.t("userService.consoleConfigUnsupported"));
    }
    // key 和 cert 是弹窗里两次独立的请求，所以按类型增量更新，不要求一次凑齐
    const cert = { ...(this.preferences.get("serverCert") || {}) };
    if (content) cert[type] = content;
    else delete cert[type];
    // 全删掉时也要落一次，否则残留的旧证书会继续生效
    if (Object.keys(cert).length) this.preferences.set({ serverCert: cert });
    else this.preferences.delete("serverCert");
    return await this.getServerProtocol();
  }

  async changeServerDomain(domain: string) {
    if (!this.isNasConsoleEditable()) {
      throw new Error(global.i18next.t("userService.consoleConfigUnsupported"));
    }
    const value = this.normalizeServerAccessBaseUrl(domain);
    if (!value) {
      return this.resetServerDomain();
    }
    if (__IS_SERVER__) await updateConfig("baseURL", value);
    else this.preferences.set({ domain: value });
    return await this.getDomainPort();
  }

  async resetServerDomain() {
    if (__IS_SERVER__) await updateConfig("baseURL", undefined);
    else this.preferences.delete("domain");
    return await this.getDomainPort();
  }

  private isNasConsoleEditable() {
    return isNasRuntime() || !!getElectronServerLifecycle();
  }

  private normalizeServerAccessBaseUrl(baseURL: string) {
    const value = String(baseURL || "").trim();
    if (!value) {
      return "";
    }
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("baseURL must use http or https");
    }
    return url.toString().replace(/\/$/, "");
  }

  async saveServerAccessConfig(listen?: number, baseURL?: string, protocol?: "http" | "https") {
    if (!this.isNasConsoleEditable()) {
      throw new Error(global.i18next.t("userService.consoleConfigUnsupported"));
    }

    const electronLifecycle = getElectronServerLifecycle();
    if (electronLifecycle) {
      const current = electronLifecycle.getConfig();
      if (listen !== undefined) this.preferences.set({ saasPort: this.validateServerPort(listen) });
      if (protocol !== undefined) this.preferences.set({ saasIpProtocol: protocol });
      const next: ServerLaunchConfig = {
        ...current,
        ...(baseURL === undefined ? {} : { baseURL: this.normalizeServerAccessBaseUrl(baseURL) || undefined }),
        ...(protocol === undefined ? {} : { protocol }),
      };
      await electronLifecycle.persistConfig(next);
      return await this.getDomainPort();
    }

    if (listen !== undefined) {
      const nextListen = this.validateServerPort(listen);
      await updateConfig("listen", nextListen);
    }

    if (baseURL !== undefined) {
      const nextBaseURL = this.normalizeServerAccessBaseUrl(baseURL);
      await updateConfig("baseURL", nextBaseURL || undefined);
    }

    if (protocol !== undefined) await updateConfig("protocol", protocol);

    return await this.getDomainPort();
  }

  async restartServer() {
    const lifecycle = getElectronServerLifecycle();
    if (!lifecycle) {
      throw new Error(global.i18next.t("userService.consoleConfigUnsupported"));
    }
    const current = lifecycle.getConfig();
    const next: ServerLaunchConfig = {
      ...current,
      listen: this.preferences.getSaasPort(),
      protocol: this.preferences.get("saasIpProtocol", current.protocol || "http"),
    };
    setImmediate(() => {
      void lifecycle.applyConfig(next).catch((error) => {
        console.error("Electron server restart failed", error);
      });
    });
    return { restarting: true };
  }

  async getDomainPort() {
    const shareDomain = this.getDomainAndFlush('shareDomain');
    const sharePort = this.preferences.get("sharePort");
    const saasDomain = await this.getSaasDomain();
    const saasPort = this.preferences.getSaasPort();
    const saasIp = this.preferences.get("saasIp", getLocalIp());
    const lifecycle = getElectronServerLifecycle();
    const startedServer = lifecycle?.getStartedServer?.();
    const protocol = lifecycle?.getConfig().protocol || serverConfig.protocol || this.preferences.get("saasIpProtocol", startedServer?.mode || "http");
    const runningPort = startedServer?.port || saasPort;
    const runningProtocol = startedServer?.mode || protocol;
    
    return {
      share: {
        domain: shareDomain, 
        port: sharePort,
      },
      saas: {
        domain: saasDomain,
        domainCustomized: __IS_SERVER__ ? !!serverConfig.baseURL : !!this.preferences.get("domain", null),
        ip: saasIp,
        port: saasPort,
        runningPort,
        protocol,
        runningProtocol,
        restartRequired: runningPort !== saasPort || runningProtocol !== protocol,
        resourceProxy: this.preferences.get("resourceProxy", false),
        consoleAccessConfigEditable: this.isNasConsoleEditable(),
      },
      ips: getLocalIpList(),
    };
  }

  async resetSaasDomain() {
    this.preferences.delete("domain");
    const domain = await this.getSaasDomain();
    return {
      domain: domain,
    };
  }
  
  async changeSSOSamlCert(cert: string) {
    this.preferences.set({ ssoSamlCert: cert })
    return null;
  }
  
  async changeSSOSamlEntry(entry: string) {
    this.preferences.set({ ssoSamlEntry: entry })
    return null;
  }

  changeSSOSamlAccountRole(ssoAccountRole: AccountRole) {
    this.preferences.set({ ssoAccountRole });
  }

  changeSSOSamlSignAssertions(signAssertions:boolean) {
    this.preferences.set({ ssoSignAssertions: signAssertions })
    return null;
  }

  changeSSOSamlSignResponse(signResponse:boolean) {
    this.preferences.set({ ssoSignResponse: signResponse })
    return null;
  }

  actionSetProxy(proxyOptions: ProxyOptions) {
    this.preferences
      .set({
        proxy: proxyOptions,
      })
    let rules = '';
    let getProxy = this.preferences.get('proxy');
    if (getProxy && getProxy.on) {
      rules = 'http://' + getProxy.host + ":" + getProxy.port;
    }
    return null;
  }

  //清除缓存
  async actionClearCache() {
    const nocodes = await this.nocodeRepository.find({});
    const nocodesIds = nocodes.map(nocode => nocode.id);
    const nocodesDir = this.nocodesDir;
    if (fs.existsSync(nocodesDir)) {
      const nocodesFiles = await readdir(nocodesDir);
      for (const nocodeFile of nocodesFiles) {
        if (!nocodesIds.includes(nocodeFile)) {
          const nocodeDir = join(nocodesDir, nocodeFile);
          if (fs.existsSync(nocodeDir)) {
            await rm(nocodeDir, {recursive: true}).catch((err) => {
              this.logger.log("clear nocode error", err);
            });
          }
          // TODO 清理低代码内的projects
        }
      }
    }

    const userDataPath = await getRuntime().getUserDataPath();
    const tempDir = join(userDataPath, "Temp");
    if (fs.existsSync(tempDir)) {
      const allowFolders = ["static"];
      for (const folder of allowFolders) {
        const dir = join(tempDir, folder);
        if (fs.existsSync(dir)) {
          await rm(dir, {recursive: true}).catch((err) => {
            this.logger.log("clear temp error", err);
          });
        }
      }
    }
    const uploadsDir = this.uploadsDir;
    if (fs.existsSync(uploadsDir)) {
      const uploadFiles = await readdir(uploadsDir);
      for (const file of uploadFiles) {
        if (!nocodesIds.includes(file)) {
          await rm(join(uploadsDir, file), { recursive: true }).catch((err) => {
            this.logger.log("clear nocode upload resource error", err);
          });
        }
      }
    }
    //TODO
    // 清除session中的缓存
    // await session.defaultSession.clearStorageData();
    // await session.defaultSession.clearCache();
  }

  //保存状态
  actionSave(body) {
    for (let k in body) {
      this.preferences.set({ [k]: body[k] });
    }
    return "success saved";
  }

  // 显示/隐藏用户信息
  showUserInfoChange(isShowUserInfo: boolean) {
    return this.preferences.set({ isShowUserInfo });
  }

  isShowUserInfo() {
    return this.preferences.get('isShowUserInfo', true);
  }

/****************************   server版相关    ********************************************* */

  async validateServerInit() {
    const stepInfo = this.preferences.get('serverInitStepInfo', {});
    if (isEmpty(stepInfo) || stepInfo.step === 'none') {
      return null;
    }
    return {
      stepInfo,
    };
  }

  isSaasExclusivePlan() {
    const saasPlan = this.getSaasPlan();
    return saasPlan === SaasPlan.ENTERPRISE;
  }

  isSaasBusinessPlan() {
    const saasPlan = this.getSaasPlan();
    return saasPlan === SaasPlan.BUSINESS;
  }

  isSaasPremiumPlan() {
    const saasPlan = this.getSaasPlan();
    return saasPlan === SaasPlan.PREMIUM;
  }

  isSaasFreePlan() {
    const saasPlan = this.getSaasPlan();
    return saasPlan === SaasPlan.FREE;
  }

  getSaasPlan() {
    const user = this.getUser();
    if(user.saasPlan) {
      if (user.saas && user.timeSaasEnd > dayjs().unix()) {
        return user.saasPlan;
      }
    }
    return SaasPlan.FREE;
  }

  /**
   * 用户充值记录列表
   */
  async getUserRechargeList(params: Record<string, string>) {
    return await this.userRest.getUserRechargeList(params);
  }

  /**
   * 用户消费订单列表
   */
  async getUserOrderList(params: Record<string, string>) {
    const res = await this.userRest.getUserOrderList(params);
    if ("coinBalance" in res) {
      this.user.update({ coin: res.coinBalance });
    }
    return res;
  }

  
  private async sendUserInfo() {
    try {
      if (!this.user.isLogin()) return;
      const company = this.getCompanyName();
      const apps = await this.getAllAppNames();
      const organize = await this.getDepartmentMemberCounts();
      const userId = this.user.get("id");
      const uuid = this.preferences.get("clientUUID");
      const userInfo = {
        userId,
        uuid,
        company,
        apps,
        organize,
      };
      await this.userRest.sendUserData(userInfo);
    } catch (error) {
    }
  }

  private getCompanyName(): string {
    return this.preferences.get("companyName", global.i18next.t('userServiceTs.companyNameNotSet'));
  }

  private async getAllAppNames(): Promise<string[]> {
    const nocodeList = await this.projectService.getNocodesMetas("");
    return nocodeList.map((nocode) => nocode.name);
  }

  private async getDepartmentMemberCounts() {
    const departments = await this.workbenchService.getDepartmentList();
    const allUsers = (await this.workbenchService.getUserList()).filter(user => !user.resigned);
    const departmentStats = {};
    departments.forEach(department => {
      const memberCount = this.countDepartmentMembers(department.id, departments, allUsers);
      departmentStats[department.name] = memberCount;
    });
    return departmentStats;
  }

  private countDepartmentMembers(departmentId: string, allDepartments: any[], allUsers: any[]) {
    const getAllChildDepartmentIds = (deptId: string): string[] => {
      const childIds = [deptId];
      const children = allDepartments.filter(dept => dept.parent === deptId);
      for (const child of children) {
        childIds.push(...getAllChildDepartmentIds(child.id));
      }
      return childIds;
    };
    const departmentIds = getAllChildDepartmentIds(departmentId);
    const memberCount = allUsers.filter(user => 
      user.departments?.some(userDeptId => departmentIds.includes(userDeptId))
    ).length;
    return memberCount;
  }

  async getDBInfo() {
    const type = this.preferences.get("formDatabaseType", FormDatabaseType.EMBEDDED);
    const info = {
      type,
    };
    if (type !== FormDatabaseType.EMBEDDED) {
      const config = this.preferences.get("formDatabaseConfig", {});
      delete config.password;
      Object.assign(info, config);
    }
    return info;
  }
}
