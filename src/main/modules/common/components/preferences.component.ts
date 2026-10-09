import { Injectable, Logger } from "@nestjs/common";
import Conf from "conf";
import os from "os";
import path, { join } from 'path';
import fs, { existsSync, readFileSync } from 'fs';
import { rename } from 'fs/promises'
import { unique } from "@common/utils/unique";
import { AccountRole, ServerInitStepInfo } from "@common/types/account";
import tunnel, { ProxyOptions } from 'tunnel';
import { ProxyOptions as Proxy } from '@common/types/user';
import { AiPermissionConfig } from "@common/types/project";
import { FormDatabaseConfig, FormDatabaseType, KeySecret } from "@common/types/nocode";
import type {} from "@common/vite-env";
import { serverConfig } from "@main/config";

type ConfType = {
  prevSessionId: string,
  loginToken: string,
  isNewClient: boolean,
  clientIdentifier: string,
  clientUUID: string,
  proxy: Proxy,
  resourceProxy: boolean,
  // saasDomain: string,
  domain: string,
  saasIp: string,
  saasPort: number,
  saasIpProtocol: "http" | "https",
  /** 用户上传的证书，存 PEM 内容；key 和 cert 都在才算配置完整 */
  serverCert?: { key?: string; cert?: string; ca?: string },
  ssoSamlCert: string,
  ssoSamlEntry: string,
  ssoSignAssertions: boolean,
  ssoSignResponse: boolean,
  ssoAccountRole: AccountRole,
  shareDomain: string,
  sharePort: number,
  isShowUserInfo: boolean,
  currentReportId: string,
  lang: string,
  serverInitStepInfo: ServerInitStepInfo,
  /** 自定义的公网域名或ip  */
  networkIps: string[],
  encodeServerPassword: string,
  isShowTour: boolean,
  projectsDir: string,
  rootDir: string,
  /** 报表是否已经初始化过 */
  reportInit?: boolean,
  isInit: boolean,
  isDataOnwerComptible?: boolean,
  formDataStageMigrationVersion?: number,

  /** rvt转dae、json所需执行文件目录 */
  bmColladaExportDir: string,
  bmJsonExportDir: string,

  companyName: string,
  aiPermissionConfig: AiPermissionConfig,
  organizeInit?: boolean,
  keySecret: KeySecret

  identifier?: string,

  channel: string, // 渠道
  countLoginFail: number // 心跳包失败次数

  formDatabaseType: FormDatabaseType,
  formDatabaseConfig: FormDatabaseConfig,
}

@Injectable()
export class Preferences {
  private readonly logger = new Logger("Preferences");
  private conf: Conf;
  public readonly prop: Record<string, unknown>;

  constructor(prop: Record<string, unknown>, ...data: ConstructorParameters<typeof Conf>) {
    this.prop = Object.assign({}, prop);
    try {
      this.conf = new Conf(...data);
    } catch (err) {
      this.logger.debug(err)
      this.handleError(data);
    }
    this.cleanupLegacyPreferences();
    this.initClientUUID();
    this.checkUtm();
  }

  async handleError(data: ConstructorParameters<typeof Conf>) {
    const cwd = data[0].cwd
    const prefPath = join(cwd, 'Pref');
    if(fs.existsSync(prefPath)) {
      await rename(prefPath, join(cwd, `Pref.back`));
      this.conf = new Conf(...data);
    }
  }

  private cleanupLegacyPreferences() {
    if (this.conf.get('aiSystemPrompt') !== undefined) {
      this.conf.delete('aiSystemPrompt');
    }
  }

  set(data: Partial<ConfType>) {
    for (const item in data) {
      this.conf.set(item, data[item]);
    }
    return this;
  }

  dump() {
    return Object.assign({}, this.conf.store);
  }

  replaceAll(data: Partial<ConfType>) {
    this.conf.clear();
    this.conf.store = Object.assign({}, data) as ConfType;
    return this;
  }

  delete(key: keyof ConfType) {
    this.conf.delete(key);
  }

  $p(key: string):string {
    const value = this.prop[key];
    if (value === undefined || value === null) {
      return '';
    }
    return typeof value === 'string' ? value : String(value);
  }

  get<T extends keyof ConfType>(key: T, defaultValue?) {
    return this.conf.get(key, defaultValue) as ConfType[T];
  }
  
  /**
   * @deprecated
   * @param key 
   * @param val 
   */
  kvSet<T = unknown>(key: string, val: T):void{
    this.conf.set(key, val);
  }

  /**
   * @deprecated
   * @param key 
   * @param defaultVal 
   * @returns 
   */
  kvGet<T = unknown>(key: string, defaultVal?: T): T{
    return this.conf.get(key, defaultVal) as T;
  }

  /**
   * @deprecated
   * @param key 
   * @returns 
   */
  kvDel(key: string): void{
    return this.conf.delete(key);
  }

  /**
   * 获取 clientIdentifier，但是拥有副作用
   */
  getClientIdentifierEffect() {
    let clientIdentifier = this.get("clientIdentifier");
    if (!clientIdentifier || typeof clientIdentifier !== "string") {
      clientIdentifier =
        os.hostname() + "-" + (Math.random() + 1) * Math.pow(10, 5);
      this.set({ clientIdentifier });
    }
    return clientIdentifier;
  }

  /**
   * 获取 axios 的 Proxy 配置
   */
  getAxiosProxy(): {on: boolean, httpsAgent: ReturnType<typeof tunnel.httpsOverHttp> | null} | undefined {
    const proxy = this.get("proxy");
    if (proxy) {
      if (!proxy.host || !proxy.port) {
        return {
          on: false,
          httpsAgent: null,
        }
      }
      const proxyOptions: ProxyOptions = {
        host: proxy.host,
        port: proxy.port,
      }
      const username = proxy.username || '';
      const password = proxy.password || '';
      if (username) {
        proxyOptions.proxyAuth = `${username}:${password}`;
      } 
      const tunnelingAgent = tunnel.httpsOverHttp({
        proxy: proxyOptions,
      });
      return {
        on: proxy.on,
        httpsAgent: tunnelingAgent,
      };
    }
  }

  private initClientUUID() {
    if (this.get("clientUUID") === undefined) {
      const clientUUID = unique(20);
      this.set({ clientUUID });
    }
  }

  getSaasPort() {
    if (__IS_SERVER__) return serverConfig.listen || 16666;
    const defaultPort = 16666;
    const storedPort = this.get("saasPort");
    const port = Number(storedPort);
    if (storedPort !== undefined && Number.isInteger(port) && port >= 1 && port <= 65535) {
      return port;
    }
    this.set({ saasPort: defaultPort });
    return defaultPort;
  }

  getIdentifier() {
    let identifier = this.get("identifier");
    if (!identifier) {
      identifier = unique(32);
      this.set({ identifier });
    }
    return identifier;
  }

  checkUtm() {
    const utmInfo = this.get("channel");
    if (!utmInfo) {
      let channel = "natural";
      const channelPath = path.join(process.cwd(), 'channel.txt');
      if (existsSync(channelPath)) {
        const fileData = readFileSync(channelPath, {encoding:"utf-8"}).trim();
        channel = fileData ?? channel;
      }
      this.set({ channel });
    }
  }
}
