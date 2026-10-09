import dns from "dns";
import { Logger } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { MikroORM } from "@mikro-orm/core";
import { json as bodyParserJson, urlencoded as bodyParserUrlencoded } from "body-parser";
import proxy from "express-http-proxy";
import { readFile } from "fs/promises";
import i18next from "i18next";
import { join } from "path";
import "./modules/ai/polyfill/langchain.polyfill";
import os from "os";
import { readConfig, serverConfig } from "./config";
import { makeMikroOrmModule } from "./utils/mikro-orm";
import { getRuntime } from "@main/runtime";
import * as VenUnique from "@common/utils/unique";
import { createExpressApp, createServerTransport, ExternalServerAdapter, ServerTransport } from "./server-transport";
import { applyPendingSystemMigration } from "./modules/client/system-migration.pending";

if (dns && typeof dns.setDefaultResultOrder === "function") dns.setDefaultResultOrder("ipv4first");

export type ServerLaunchConfig = {
  listen?: number;
  hostname?: string;
  baseURL?: string;
  protocol?: "http" | "https";
  cert?: { key: string; cert: string; ca?: string };
  db?: typeof serverConfig.db;
};

export type StartedServer = {
  app: NestExpressApplication;
  transport: ServerTransport;
  mode: "http" | "https";
  port: number;
  url: string;
  advertisedUrl: string;
  close: () => Promise<void>;
};

let i18nReady: Promise<void>;

async function getI18nOption() {
  const langFile = await readFile(join(__dirname, "../locales/lang.json"), { encoding: "utf-8" });
  const packageJsonFile = await readFile(join(__dirname, "../package.json"), { encoding: "utf-8" });
  const packageJson = JSON.parse(packageJsonFile);
  return { lng: packageJson.lang, fallbackLng: packageJson.lang, resources: JSON.parse(langFile) };
}

const initGlobals = async () => {
  if (!i18nReady) i18nReady = i18next.init(await getI18nOption()).then(() => undefined);
  await i18nReady;
  global.i18next = i18next;
  global.VenUnique = VenUnique;
};

export async function initServer(options: ServerLaunchConfig): Promise<{ app: NestExpressApplication; transport: ServerTransport }> {
  await initGlobals();
  const logger = new Logger("server");
  const config = { ...serverConfig, ...options };
  global.mongoLike = config.db?.type === "mongo";
  const userDataPath = getRuntime().getUserDataPath();
  await applyPendingSystemMigration(userDataPath, logger);
  const { AppModule, entities } = await import("./modules/app.module");
  const importModules = [];
  if (entities) {
    const mikroOrmModule = makeMikroOrmModule({
      entities,
      db: config.db ?? { type: "sqlite", dbName: "system.sqlite", pool: { min: 2, max: 20, idleTimeoutMillis: 20_000 } },
    });
    if (mikroOrmModule) importModules.push(mikroOrmModule);
  }
  const rootModule = AppModule.register(importModules);
  const expressApp = createExpressApp();
  const app = await NestFactory.create<NestExpressApplication>(rootModule, new ExternalServerAdapter(expressApp), {
    bufferLogs: true,
    bodyParser: false,
  });

  (app as unknown as { flushLogsOnOverride(): void }).flushLogsOnOverride();
  expressApp.use(bodyParserJson({ limit: "1024mb" }));
  expressApp.use(bodyParserUrlencoded({ limit: "1024mb", extended: true }));

  const staticPaths = [
    { prefix: "/locales", staticPath: join(__dirname, "..", "locales") },
    { prefix: undefined, staticPath: join(userDataPath, "nocodes") },
    { prefix: "/template", staticPath: join(userDataPath, "FormTemplates") },
    { prefix: "/tmp", staticPath: join(os.tmpdir(), "static") },
  ];
  if (getRuntime().isProduction) staticPaths.unshift({ prefix: undefined, staticPath: join(getRuntime().getProductionSrcPath(), "renderer") });
  for (const { prefix, staticPath } of staticPaths) app.useStaticAssets(staticPath, prefix ? { prefix } : undefined);
  
  if (!getRuntime().isProduction && process.env.DEV_SERVER_URL) {
    expressApp.use(proxy(process.env.DEV_SERVER_URL, {
      filter: (req) => (req.method === "GET" || req.method === "HEAD")
        && !/^\/widget\/template-image(?:\?|\/|$)/.test(req.originalUrl)
        && !/^\/ai\/threads\/[^/]+\/attachments\/[^/]+\/content(?:\?|$)/.test(req.originalUrl)
        && !/^\/api\//.test(req.originalUrl),
      proxyReqPathResolver: (req) => req.originalUrl,
      parseReqBody: false,
      skipToNextHandlerFilter: (proxyRes) => {
        if (proxyRes.statusCode === 404) throw new Error("skip to next");
        return false;
      },
      proxyErrorHandler: (_error, _res, next) => next(),
    }));
  }
  // 传输层必须在 init 之前绑定：init 会把它注册给 socket.io 等模块，之后只换 server 对象即可
  const transport = await createServerTransport(app);
  if (transport.mode === "https") logger.log(global.i18next.t("mainServer.detectHttpsCertEnableHttps"));
  try {
    await app.init();
    return { app, transport };
  } catch (error) {
    try {
      await app.get(MikroORM).close(true);
    } catch {
      // app.close below still runs module shutdown hooks.
    }
    await app.close().catch(() => undefined);
    throw error;
  }
}

export const getConfigLaunchOptions = (): ServerLaunchConfig => {
  const config = readConfig();
  return { listen: config.listen || 16666, hostname: config.hostname, baseURL: config.baseURL, protocol: config.protocol, cert: config.cert, db: config.db };
};
