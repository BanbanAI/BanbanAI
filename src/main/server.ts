import { Logger } from "@nestjs/common";
import { getLocalIp } from "@main/utils/net";
import { readConfig, updateConfig } from "./config";
import { getConfigLaunchOptions, initServer } from "./server-runtime";
import { StartedServer } from "./server-runtime";
import { nodejsLogger } from "./server/logger";

let startedServer: StartedServer;
const logger = new Logger("server");

process.on("SIGHUP", async () => {
  const config = readConfig();
  const { WorkbenchService } = await import("./modules/workbench/workbench.service");
  if (config.adminPass && startedServer) {
    const workbench = startedServer.app.get(WorkbenchService);
    workbench.completedInit(config.adminPass);
    await updateConfig("adminPass", "");
  }
  logger.log("signal SIGHUP");
});

const config = getConfigLaunchOptions();

initServer(config)
  .then(async ({ app, transport }) => {
    app.useLogger(nodejsLogger);
    await transport.listen();
    const advertisedUrl = config.baseURL || transport.url.replace("127.0.0.1", getLocalIp());
    logger.warn(global.i18next.t("mainServer.serverStartSuccessAddr"), advertisedUrl);
    startedServer = {
      app,
      transport,
      mode: transport.mode,
      port: transport.port,
      url: transport.url,
      advertisedUrl,
      close: async () => {
        await transport.close();
        await app.close();
      },
    };
  })
  .catch((error) => {
    logger.error("Server start failed", error);
    process.exitCode = 1;
  });
