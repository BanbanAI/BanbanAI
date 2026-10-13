import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from "express";
import { getExpressSession } from './session';
import passport from "passport";
import { AsyncResource } from 'async_hooks';

@Injectable()
export class SessionMiddleware implements NestMiddleware<Request, Response> {
  use(req: Request, res: Response, next: () => void) {
    const resource = new AsyncResource('SessionMiddleware');
    const t0 = Date.now();
    getExpressSession().then((expressSession)=>{
      if (expressSession) {
        let skip = false;
        if (/^\/@(vite|fs|id)/.test(req.originalUrl)) {
          skip = true;
        }
        if (!skip && /^\/socket\.io\//.test(req.originalUrl)) {
          skip = true;
        }
        if (!skip) {
          const index = req.originalUrl.indexOf("?");
          const path = index === -1 ? req.originalUrl : req.originalUrl.substring(0, index);
          if (/\.(ts|vue|scss|js|css|svg|ico|png|jpg|json|otf|map|tga|glb|glbx|di|wasm|ktx2|woff2)$/.test(path)) {
            skip = true;
          }
        }
        if (skip) {
          next();
        } else {
          resource.runInAsyncScope(() => {
            expressSession(req, res, ()=>{
              resource.runInAsyncScope(() => {
                passport.initialize({userProperty: "account"})(req, res, ()=>{
                  resource.runInAsyncScope(() => {
                    passport.session()(req, res, ()=>{
                      resource.runInAsyncScope(next);
                      req.timing.session = Date.now() - t0;
                    });
                  });
                });
              });
            });
          })
        }
      } else {
        next();
      }
    });
  }
}
