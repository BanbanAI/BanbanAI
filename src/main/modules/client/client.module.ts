import { Global, Inject, Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { SERVER_ENDPOINT, REPORTS_DIR, PREFERENCES, NOCODES_DIR, PROJECTS_DIR, UPLOADS_DIR } from "@main/constants";
import { Rest } from "./rest/base.rest";
import { UserRest, MarketRest, WarehouseRest, DownloadRest, AIRest } from "./rest";
import { ClientController } from "./client.controller";
import { getRuntime } from "@main/runtime";
import { join } from "path";
import { Preferences } from "../common";
import { ClientService } from "./client.service";
import { SystemMigrationService } from "./system-migration.service";
import { AmapService } from "./amap.service";
import express from 'express';

const serverEndpoint = 'https://api.banban.work';

@Global()
@Module({
  providers: [
    { provide: SERVER_ENDPOINT, useValue: serverEndpoint },
    {
      provide: PROJECTS_DIR,
      useFactory: async (preferences: Preferences)=>{
        let dir = preferences.get("projectsDir");
        if (!dir) {
          dir = await getRuntime().getUserDataPath();
        }
        return join(dir, "projects");
      },
      inject: [ PREFERENCES ]
    },
    {
      provide: REPORTS_DIR,
      useFactory: async ()=>{
        return join(await getRuntime().getUserDataPath(), "reports");
      },
    },
    {
      provide: NOCODES_DIR,
      useFactory: async (preferences: Preferences)=>{
        let dir = preferences.get("rootDir");
        if (!dir) {
          dir = await getRuntime().getUserDataPath();
        }
        return join(dir, "nocodes");
      },
      inject: [ PREFERENCES ]
    },
    {
      provide: UPLOADS_DIR,
      useFactory: async (preferences: Preferences)=>{
        let dir = preferences.get("rootDir");
        if (!dir) {
          dir = await getRuntime().getUserDataPath();
        }
        return join(dir, "uploads");
      },
      inject: [ PREFERENCES ]
    },
    Rest,
    UserRest,
    MarketRest,
    WarehouseRest,
    DownloadRest,
    AIRest,
    ClientService,
    SystemMigrationService,
    AmapService,
  ],
  controllers: [ ClientController ],
  exports: [ SERVER_ENDPOINT, PROJECTS_DIR, REPORTS_DIR, NOCODES_DIR, UPLOADS_DIR, UserRest, MarketRest, WarehouseRest, DownloadRest, AIRest ],
})
export class ClientModule implements NestModule {
  private readonly logger = new Logger(ClientModule.name);

  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
  ) {}

  private applyStaticDir(consumer: MiddlewareConsumer, dir: string, route: string) {
    if (typeof dir !== "string" || !dir.trim()) {
      this.logger.warn(`skip static route ${route}: invalid path`);
      return;
    }
    const staticMiddleware = express.static(dir);
    consumer
      .apply((req, res, next) => {
        const rawRequestPath = String(req.path || req.url || '');
        let requestPath = rawRequestPath;
        try {
          requestPath = decodeURIComponent(rawRequestPath);
        } catch {
          requestPath = rawRequestPath;
        }
        requestPath = requestPath.replace(/\\/g, '/').toLowerCase();
        if (
          route === '/uploads'
          && /(^|\/)_ai(?:\/|$)/.test(requestPath)
        ) {
          res.sendStatus(404);
          return;
        }
        return staticMiddleware(req, res, next);
      })
      .forRoutes(route);
  }

  configure(consumer: MiddlewareConsumer) {
    this.applyStaticDir(consumer, this.nocodesDir, "/");
    this.applyStaticDir(consumer, this.uploadsDir, "/uploads");
  }

}
