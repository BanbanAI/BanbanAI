import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { refreshSessionIfNeeded } from "../utils/session-refresh";

@Injectable()
export class SessionRefreshGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.account && req.session) {
      await refreshSessionIfNeeded(req);
    }
    return true;
  }
}
