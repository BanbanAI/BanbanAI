import { Injectable,ExecutionContext, SetMetadata, CanActivate, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core"
import { AuthGuard } from "@nestjs/passport";
import { Response, Request } from "express";
import { ELECTRON_CLIENT_TOKEN_HEADER, isElectronClientRequestToken } from "@main/electron/electron-client-token";

@Injectable()
export class LocalAuthGuard extends AuthGuard("local") implements CanActivate {
  constructor(
    private reflector: Reflector,
    ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const noLocalAuthGuard = this.reflector.getAllAndOverride<boolean>(NO_LOCAL_AUTH_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (noLocalAuthGuard) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const login = this.reflector.getAllAndOverride<boolean>(LOCAL_AUTH_GUARD_LOGIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (login) {
      await super.canActivate(context);
      await super.logIn(req);
    }
    // console.log("LocalAuthGuard canActivate", req.url, req.nocode);
    if (req.account) {
      return true;
    }
    const clientToken = req.headers[ELECTRON_CLIENT_TOKEN_HEADER.toLowerCase()];
    if (clientToken && isElectronClientRequestToken(clientToken)) {
      return true;
    }
    throw new UnauthorizedException();
  }
}

const NO_LOCAL_AUTH_GUARD = "NO_LOCAL_AUTH_GUARD";
export const NoLocalAuthGuard = () => SetMetadata(NO_LOCAL_AUTH_GUARD, true);


const LOCAL_AUTH_GUARD_LOGIN = "LOCAL_AUTH_GUARD_LOGIN";
export const LocalAuthGuardLogin = () => SetMetadata(LOCAL_AUTH_GUARD_LOGIN, true);
