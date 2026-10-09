import { AsyncLocalStorage } from "async_hooks";
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from "express";
import type {} from "../express";

const requestStorage = new AsyncLocalStorage<RequestStorage>();

export class RequestStorage {
  static runWithRequest<T>(req: Request, next: ()=>T): T {
    return requestStorage.run(new RequestStorage(req), next);
  }

  static get current() {
    return requestStorage.getStore();
  }

  constructor(private _req: Request) {
  }

  get req() {
    return this._req;
  }

  getParamsValue(key: string) {
    return this._req.params[key];
  }

  getQueryValue(key: string) {
    return this._req.query[key];
  }
}



@Injectable()
export class RequestStorageMiddleware implements NestMiddleware<Request, Response> {
  use(req: Request, _res: Response, next: () => void) {
    RequestStorage.runWithRequest(req, next);
  }
}
