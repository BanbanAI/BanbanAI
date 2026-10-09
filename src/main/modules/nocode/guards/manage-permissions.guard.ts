import { Injectable, ExecutionContext, SetMetadata, CanActivate, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { ManageCategory } from "@common/types/project";
import { ADMIN_USERNAME } from "@common/types/account";

@Injectable()
export class ManagePermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPath = this.reflector.getAllAndOverride<[ManageCategory, "enabled" | "editable"]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredPath) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.nocode?.id) return true; // 非低代码应用内 工作台用户放行
    if (!req.account) throw new UnauthorizedException();
    if (req.account.user === ADMIN_USERNAME) return true; // 超管默认放行
    return false;
  }
}

const PERMISSIONS_KEY = "PERMISSIONS";

export const Permissions = (path: [ManageCategory, "enabled" | "editable"]) => SetMetadata(PERMISSIONS_KEY, path);

