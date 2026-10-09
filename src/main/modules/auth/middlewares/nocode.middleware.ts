import { ProjectService } from "@main/modules/project/project.services";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";


@Injectable()
export class NocodeMiddleware implements NestMiddleware<Request, Response> {
  constructor(
    private readonly projectService: ProjectService,
  ) {}

  async use(req: Request, res: Response, next: () => void) {
    const m = /\/(workbench|nocode)\/(\w+)/.exec(req.originalUrl);
    if (m) {
      const nocodeId = m[2];
      const body = await this.projectService.getNocodeBody(nocodeId).catch(() => null);
      // TODO 后续把低代码内部应用接口整理到一个controller上
      if (!body) return next();
      req.nocode = {
        id: nocodeId,
      };
    }
    next();
  }
}