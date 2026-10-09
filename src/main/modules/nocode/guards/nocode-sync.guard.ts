import {
  Injectable,
  ExecutionContext,
  CanActivate,
  SetMetadata,
  Inject
} from "@nestjs/common";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { NOCODES_DIR } from "@main/constants";
import { validateSynchronization } from "@main/utils";
import { ApiException } from "@main/modules/api/filters";


interface SyncConfig {
  nocodeId?: string;
  sign?: string;
}

@Injectable()
export class NocodeSyncGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(NOCODES_DIR)
    private readonly nocodesDir: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const config = this.reflector.getAllAndOverride<SyncConfig>(
      NOCODE_SYNC_GUARD,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    // 自动查找 nocodeId / sign
    let nocodeId = req.headers[`x-nocode-id`] ?? getRequestValue(req, "nocodeId");
    let clientSign = getRequestValue(req, "sign");

    // metadata 指定路径时 fallback
    if (!nocodeId && config?.nocodeId) {
      nocodeId = getRequestValueByPath(req, config.nocodeId);
    }

    if (!clientSign && config?.sign) {
      clientSign = getRequestValueByPath(req, config.sign);
    }

    if (!nocodeId || !clientSign) return false;

    const isSync = await validateSynchronization(
      this.nocodesDir,
      nocodeId,
      clientSign,
    );

    if (!isSync) {
      throw new ApiException(
        global.i18next.t("NocodeSyncGuardTs.syncFailed"),
        {
          type: "NOCODE_SYNC_CONFLICT",
          source: "NocodeSyncGuard",
        },
      );
    }

    return true;
  }
}

function getRequestValue(req: Request, key: string) {
  return (
    req.headers[`x-${key}`] ??
    req.body?.[key] ??
    req.params?.[key] ??
    req.query?.[key] ??
    null
  );
}

function getRequestValueByPath(req: Request, path: string) {
  if (!req || !path) return null;

  const [scope, ...rest] = path.split('.');

  const map = {
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
  };

  const target = map[scope];

  if (!target) return null;

  return getValueByPath(target, rest.join('.'));
}

function getValueByPath(obj: any, path: string) {
  if (!obj || !path) return null;
  return path.split('.').reduce((o, key) => o?.[key], obj);
}

const NOCODE_SYNC_GUARD = "NOCODE_SYNC_GUARD";
export const NocodeSyncGuardValid = (nocodeId?: string) => SetMetadata(NOCODE_SYNC_GUARD, {nocodeId});
