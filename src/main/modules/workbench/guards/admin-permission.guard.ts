import { Injectable, ExecutionContext, SetMetadata, CanActivate, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { isSystemAdminAccount } from "@common/types/account";

@Injectable()
export class AdminPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride(NO_ADMIN_PERMISSION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ])) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    return isSystemAdminAccount(req.account);
  }
}

const NO_ADMIN_PERMISSION_GUARD = "NO_ADMIN_PERMISSION_GUARD";
export const NoAdminPermissionGuard = () => SetMetadata(NO_ADMIN_PERMISSION_GUARD, true);
