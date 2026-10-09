import { Injectable, ExecutionContext, SetMetadata, CanActivate, Inject } from "@nestjs/common";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { TableUID } from "@common/types/project";
import { Account } from "@common/types/account";
import { Nocode as NocodeEntity, NocodeRepository, NocodeCache } from "@main/modules/project/entities";
import { EntityManager } from "@mikro-orm/core";
import { ApiTableSetting } from "@main/modules/project/types";
import { KeySecret } from "@common/types/nocode";
import { Preferences } from "@main/modules/common";
import { PREFERENCES } from "@main/constants";
import { ValidOption } from "../type";
import { ProjectService } from "@main/modules/project/project.services";
import md5 from "md5";
import { ApiException } from "../filters";
import { RequestStorage } from "@main/middleware";
import { AuthService } from "@main/modules/auth/auth.service";
import { OrganizeCacheService } from "@main/modules/workbench/organize-cache.service";

type ApiAuthenticationResult = {
  account: Account,
  credentialType: "global" | "account",
};

@Injectable()
export class ApiAccessGuard implements CanActivate {
  private readonly nocodeRepository: NocodeRepository;

  constructor(
    private reflector: Reflector,
    private readonly entityManager: EntityManager,
    private readonly projectService: ProjectService,
    private readonly authService: AuthService,
    private readonly organizeCache: OrganizeCacheService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) {
    this.nocodeRepository = this.entityManager.getRepository(NocodeEntity);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    delete req.account;
    delete req.apiCredentialType;
    const key = String(req.query.key || "");
    const timestamp = Number(req.query.timestamp);
    const sign = String(req.query.sign || "");
    const hasCredentialInput = [req.query.key, req.query.timestamp, req.query.sign]
      .some(value => value !== undefined && String(value).length > 0);
    let authentication: ApiAuthenticationResult;

    const requestTypeGet = this.reflector.getAllAndOverride<boolean>(REQUEST_TYPE_GET, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requestTypeGet || hasCredentialInput) {
      authentication = await this.authenticateOrThrow({ key, timestamp, sign });
      this.applyAuthentication(req, authentication);
    }

    const appSign = req.params.appId;
    const tableSign = req.params.formId;
    const { app, table } = await this.checkIdForAlias(appSign, tableSign);
    // app, table是否查询到有效数据
    if(!app) throw new ApiException(global.i18next.t('apiAccessGuard.appNotExist'));
    if(tableSign && !table) throw new ApiException(global.i18next.t('apiAccessGuard.formNotExist'));
    req.params.appId = app.id;
    if (table) {
      req.params.formId = table.id;
    }

    if (requestTypeGet && table && !table?.public && !authentication) {
      authentication = await this.authenticateOrThrow({ key, timestamp, sign });
      this.applyAuthentication(req, authentication);
    }

    if (!app.apiEnabled) throw new ApiException(global.i18next.t('apiAccessGuard.apiNotEnabled'));

    const publicRead = requestTypeGet && table?.public;
    if (req.account && !publicRead && !await this.projectService.canViewNocode(app.id, req)) {
      throw new ApiException(global.i18next.t('formDataService.noPerm'));
    }

    return true;
  }

  private async checkIdForAlias(appSign: string, tableSign?: TableUID | string): Promise<{ app: NocodeEntity, table?: ApiTableSetting }> {
    let app: NocodeEntity, table: ApiTableSetting;

    app = NocodeCache.get(appSign);
    if (!app) {
      const t0 = Date.now();
      app = await this.nocodeRepository.findOne({ id: appSign });
      const t1 = Date.now();
      if (!app) {
        app = await this.nocodeRepository.findOne({ apiAlias: appSign });
      }
      NocodeCache.set(app);
      const t2 = Date.now();
      RequestStorage.current.req.timing.findAppById = t1-t0;
      RequestStorage.current.req.timing.findAppByAlias = t2-t1;
    }

    if (app && tableSign) {
      const findTable = () => {
        let t = app.apiTableInfo?.find(item => item.id === tableSign);
        if (!t) {
          t = app.apiTableInfo?.find(item => item.apiAlias === tableSign);
        }
        return t;
      }
      table = findTable();
      // 若未查询到数据，执行apiTableInfo数据的同步操作，且再次查询table数据
      if(!table){
        app = await this.projectService.refreshApiSetting(app.id, app);
        table = findTable();
      }
    }

    return { app, table };
  }

  private async authenticateOrThrow(validOption: ValidOption): Promise<ApiAuthenticationResult> {
    const authentication = await this.authenticate(validOption);
    if (!authentication) {
      throw new ApiException(global.i18next.t('apiAccessGuard.keySecretCheckFail'));
    }
    return authentication;
  }

  private applyAuthentication(req: Request, authentication: ApiAuthenticationResult) {
    req.account = authentication.account;
    req.apiCredentialType = authentication.credentialType;
  }

  private async authenticate(validOption: ValidOption): Promise<ApiAuthenticationResult | null> {
    const { key, timestamp, sign } = validOption;

    if (Math.min(Math.abs(timestamp/1000 - Date.now()/1000), Math.abs(timestamp - Date.now()/1000)) > 60) {//60秒
      throw new ApiException(global.i18next.t('apiAccessGuard.timestampCheckFail'), {
        "serverTimestamp": Date.now(),
      });
    }

    const ks: KeySecret = this.preferences.get('keySecret');
    if (key && key === ks?.key) {
      if (!this.isSignValid(key, timestamp, sign, ks.secret)) {
        return null;
      }
      const admin = await this.organizeCache.getAdmin();
      if (!admin) {
        return null;
      }
      return {
        account: await this.authService.buildRuntimeAccount(admin),
        credentialType: "global",
      };
    }

    const account = key
      ? await this.organizeCache.authenticateApiKey(key, secret => this.isSignValid(key, timestamp, sign, secret))
      : null;
    if (!account) {
      return null;
    }

    return {
      account: await this.authService.buildRuntimeAccount(account),
      credentialType: "account",
    };
  }

  private isSignValid(key: string, timestamp: number, sign: string, secret: string) {
    const correctSign = md5(String(key + timestamp + secret));
    return correctSign === sign;
  }
}

const REQUEST_TYPE_GET = "REQUEST_TYPE_GET";
export const RequestTypeGet = () => SetMetadata(REQUEST_TYPE_GET, true);
