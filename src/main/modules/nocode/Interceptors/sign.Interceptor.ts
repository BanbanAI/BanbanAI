import { Injectable, NestMiddleware, NestInterceptor, ExecutionContext, CallHandler, SetMetadata } from '@nestjs/common';
import { RequestStorage } from "@main/middleware";
import { Request, Response } from "express";
import { Reflector } from '@nestjs/core';
import { tap } from "rxjs/operators";

declare module "express" {
  interface Request {
    clientSign?: string
    lastSign?: string
  }
}

const resolveClientSign = (req?: Request) => {
  if (!req) return undefined;

  return (
    req.clientSign ||
    req.headers["x-sign"] ||
    req.body?.sign ||
    req.query?.sign
  ) as string | undefined;
};

@Injectable()
export class SignMiddleware implements NestMiddleware {

  use(req: Request, _res: Response, next: () => void) {
    const sign = resolveClientSign(req);

    if (sign && RequestStorage.current?.req) {
      RequestStorage.current.req.clientSign = sign;
    }

    next();
  }

}

@Injectable()
export class MainSignInterceptor implements NestInterceptor {

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const shouldReturnSign =
      this.reflector.get<boolean>(
        "RETURN_MAIN_SIGN",
        context.getHandler()
      );

    if (!shouldReturnSign) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const currentReq = RequestStorage?.current?.req;
    const clientSign = resolveClientSign(req);

    if (clientSign && currentReq && !currentReq.clientSign) {
      currentReq.clientSign = clientSign;
    }

    return next.handle().pipe(
      tap(() => {
        const sign = SignContext.get();

        if (sign) {
          res.setHeader("x-sign", sign);
        }
      })
    );
  }

}

export const RETURN_MAIN_SIGN = "RETURN_MAIN_SIGN";

export const ReturnMainSign = () =>
  SetMetadata(RETURN_MAIN_SIGN, true);


export class SignContext {

  static set(sign: string) {
    const req = RequestStorage?.current?.req;

    if (!req) return;

    req.lastSign = sign;
  }

  static get(): string | undefined {
    const req = RequestStorage?.current?.req;

    return req?.lastSign ?? req?.clientSign ?? resolveClientSign(req);
  }

}