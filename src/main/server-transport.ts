import { createServer as createHttpServer, Server as HttpServer } from "http";
import { createServer as createHttpsServer, Server as HttpsServer } from "https";
import { Logger, NestApplicationOptions } from "@nestjs/common";
import { NestExpressApplication, ExpressAdapter } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import express, { Express } from "express";
import { PREFERENCES } from "@main/constants";
import { Preferences } from "@main/modules/common/components/preferences.component";
import { readConfig } from "./config";
import { resolveServerHttpsOptions } from "./server-https";

export type TransportMode = "http" | "https";

export type ServerTransport = {
  mode: TransportMode;
  port: number;
  url: string;
  /** 最近一次 listen 因原端口不可用而自动切换的端口信息，未切换为 null */
  portSwitch: { from: number; to: number } | null;
  listen: () => Promise<void>;
  /** 同一个 server 对象重新监听（换端口用，socket.io 等已绑定的监听器不受影响） */
  relisten: () => Promise<void>;
  close: () => Promise<void>;
};

const logger = new Logger("server-transport");

/**
 * 传输层由本模块创建并绑定到 Nest 自己的 express 实例上：
 * 协议切换只是换一个 server 对象，Nest、DI、ORM 都不重建。
 */
export class ExternalServerAdapter extends ExpressAdapter {
  initHttpServer(): void {
    // 不创建 Nest 自己的 server，见 createServerTransport
  }
}

export const createExpressApp = (): Express => express();

export const resolveServerProtocol = (preferences: Preferences): TransportMode =>
  readConfig().protocol ?? preferences.get("saasIpProtocol") ?? "http";

const closeServer = (server: HttpServer | HttpsServer) => new Promise<void>((resolve) => {
  const forceClose = (server as HttpServer & { closeAllConnections?: () => void }).closeAllConnections;
  forceClose?.call(server);
  server.close(() => resolve());
});

const listenServer = (server: HttpServer | HttpsServer, port: number, hostname?: string) => new Promise<void>((resolve, reject) => {
  const onError = (error: Error) => {
    server.removeListener("listening", onListening);
    reject(error);
  };
  const onListening = () => {
    server.removeListener("error", onError);
    resolve();
  };
  server.once("error", onError);
  server.once("listening", onListening);
  if (hostname) server.listen(port, hostname);
  else server.listen(port);
});

/**
 * 解析本次要用哪个 server，并把它绑定到 Nest 的 express 实例上（还不 listen）。
 * 协议和证书都在这里内部决定：config.jsonc → Preferences → 内置默认证书。
 * mode 只在回滚旧协议时才由调用方覆盖。
 */
export const createServerTransport = async (
  app: NestExpressApplication,
  options: { mode?: TransportMode } = {},
): Promise<ServerTransport> => {
  const config = readConfig();
  const preferences = app.get(PREFERENCES);
  const mode = options.mode ?? resolveServerProtocol(preferences);
  const { httpsOptions, configCertError } = resolveServerHttpsOptions(config.cert, preferences.get("serverCert"));
  if (mode === "https" && !httpsOptions) {
    throw configCertError ?? new Error("HTTPS certificate or key file does not exist");
  }

  // initServer 创建的就是这个 adapter，这里按自己的类型用，能拿到 setHttpServer/getInstance
  const adapter = app.getHttpAdapter() as unknown as ExternalServerAdapter;
  const expressApp = adapter.getInstance() as Express;
  const server = mode === "https"
    ? createHttpsServer(httpsOptions as NestApplicationOptions["httpsOptions"], expressApp)
    : createHttpServer(expressApp);

  // Nest 的路由、socket.io 和关闭流程都读 NestApplication.httpServer（只在构造时赋值一次），
  // 所以两个位置都要指向这个 server。
  adapter.setHttpServer(server);
  (app as unknown as { registerHttpServer(): void }).registerHttpServer();
  app.useWebSocketAdapter(new IoAdapter(app));

  let port = preferences.getSaasPort();
  let portSwitch: { from: number; to: number } | null = null;

  const listen = async () => {
    portSwitch = null;
    try {
      await listenServer(server, port, config.hostname);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EADDRINUSE" && code !== "EACCES") throw error;
      // 无桌面版的端口由部署配置决定（Docker 端口映射、NAS 访问入口），静默换端口会让外部访问失联，保持明确报错
      if (__IS_SERVER__) throw error;
      // 端口被占用或被系统保留时退回随机端口，避免因端口冲突导致服务启动失败。
      // 失败后的 close 对未监听的 server 是安全 no-op，之后再 listen 即可复用同一 server。
      const occupiedPort = port;
      await closeServer(server);
      await listenServer(server, 0, config.hostname);
      const address = server.address();
      if (address && typeof address === "object") port = address.port;
      portSwitch = { from: occupiedPort, to: port };
      // 实际端口写回配置，保证界面展示的端口与服务实际监听的端口一致
      preferences.set({ saasPort: port });
      logger.warn(global.i18next.t("mainServer.portOccupiedSwitchRandom", { port: occupiedPort, nextPort: port }));
    }
  };

  return {
    mode,
    get port() {
      return port;
    },
    get url() {
      return `${mode}://127.0.0.1:${port}`;
    },
    get portSwitch() {
      return portSwitch;
    },
    listen,
    relisten: async () => {
      await closeServer(server);
      port = preferences.getSaasPort();
      await listen();
    },
    close: () => closeServer(server),
  };
};

/** 换协议：关掉旧 server，按 Preferences 里的新协议建一个并绑回同一个 Nest 实例 */
export const switchServerTransport = async (
  app: NestExpressApplication,
  current: ServerTransport,
): Promise<ServerTransport> => {
  await current.close();
  const next = await createServerTransport(app);
  await next.listen();
  return next;
};
