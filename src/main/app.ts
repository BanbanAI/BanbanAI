import { app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor, shell, Tray } from "electron";
import { Logger } from "@nestjs/common";
import { MikroORM } from "@mikro-orm/core";
import { join } from "path";
import { getLocalIp } from "@main/utils/net";
import { PREFERENCES } from "./constants";
import { getConfigLaunchOptions, initServer, ServerLaunchConfig, StartedServer } from "./server-runtime";
import { registerElectronServerLifecycle } from "./electron/electron-server-lifecycle";
import { createServerTransport, resolveServerProtocol, switchServerTransport } from "./server-transport";
import {
  clearElectronClientToken,
  createElectronClientToken,
  ELECTRON_CLIENT_TOKEN_HEADER,
  getElectronClientOrigin,
  getElectronClientToken,
  setElectronClientOrigin,
} from "./electron/electron-client-token";
import { electronLogger } from "./electron/logger";
import { bindScheduledTriggerResume, ScheduledTriggerSystemWake } from "./modules/formData/scheduled-trigger/scheduled-trigger-system-wakeup";
import { bindNestApplicationShutdown } from "./graceful-shutdown";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let startedServer: StartedServer | null = null;
let activeConfig: ServerLaunchConfig | null = null;
let restarting = false;
let unbindScheduledTriggerResume: (() => void) | undefined;
const logger = new Logger("server");
const windowIcon = join(__dirname, "assets/icon/ic_launcher.png");
const hasSingleInstanceLock = app.requestSingleInstanceLock();

const showMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const createTray = () => {
  if (tray) return;
  const iconName = process.platform === "darwin" ? "ic_launcher_16_mac.png" : "ic_launcher_16.png";
  const iconPath = join(__dirname, "assets/icon", iconName);
  tray = new Tray(iconPath);
  const updateTray = () => {
    if (!tray) return;
    tray.setToolTip(global.i18next.t("productName"));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: global.i18next.t("tray.show"), click: showMainWindow },
      { label: global.i18next.t("tray.exit"), click: () => app.quit() },
    ]));
  };
  updateTray();
  global.i18next.on("languageChanged", updateTray);
  tray.on("click", showMainWindow);
};

async function startElectronServerOnce(config: ServerLaunchConfig): Promise<StartedServer> {
  const { app: serverApp, transport } = await initServer(config);
  serverApp.useLogger(electronLogger);
  await transport.listen();
  unbindScheduledTriggerResume?.();
  unbindScheduledTriggerResume = bindScheduledTriggerResume(powerMonitor, serverApp.get(ScheduledTriggerSystemWake));
  const advertisedUrl = config.baseURL || transport.url.replace("127.0.0.1", getLocalIp());
  logger.warn(global.i18next.t("mainServer.serverStartSuccessAddr"), advertisedUrl);
  return {
    app: serverApp,
    transport,
    mode: transport.mode,
    port: transport.port,
    url: transport.url,
    advertisedUrl,
    close: async () => {
      unbindScheduledTriggerResume?.();
      unbindScheduledTriggerResume = undefined;
      // Close the HTTP/Nest lifecycle first so active requests can release their
      // SQLite coordinator leases before the ORM pool is destroyed.
      await transport.close();
      await serverApp.close();
      try {
        await serverApp.get(MikroORM).close(true);
      } catch {
        // Nest shutdown remains complete even when the ORM was already closed.
      }
    },
  };
}

async function startElectronServer(config: ServerLaunchConfig): Promise<StartedServer> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await startElectronServerOnce(config);
    } catch (error) {
      if (!String(error).includes("Unable to acquire a connection") || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function loadServer(config: ServerLaunchConfig) {
  startedServer = await startElectronServer(config);
  config.listen = startedServer.port;
  config.hostname = undefined;
  setElectronClientOrigin(startedServer.url);
  if (!mainWindow) {
    const appName = global.i18next.t("productName");
    app.setName(appName);
    mainWindow = new BrowserWindow({
      width: 840,
      height: 560,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      title: appName,
      icon: windowIcon,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, "./electron/preload.js"),
        devTools: true
      },
    });
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F11") event.preventDefault();
      if (input.type !== "keyDown" || input.key !== "F12") return;
      event.preventDefault();
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow?.webContents.openDevTools();
      }
    });
    mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
      if (frameName !== "browser") return { action: "allow" };
      if (url.startsWith("http://") || url.startsWith("https://")) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ["http://*/*", "https://*/*"] },
      (details, callback) => {
        if (details.resourceType === "xhr") {
          const token = getElectronClientToken();
          const origin = getElectronClientOrigin();
          let isCurrentServerOrigin = false;
          try {
            isCurrentServerOrigin = Boolean(origin && new URL(details.url).origin === origin);
          } catch {
            isCurrentServerOrigin = false;
          }
          if (token && isCurrentServerOrigin) {
            details.requestHeaders[ELECTRON_CLIENT_TOKEN_HEADER] = token;
          }
        }
        callback({ requestHeaders: details.requestHeaders });
      },
    );
    mainWindow.on("closed", () => { mainWindow = null; });
  }
  await mainWindow.loadURL(`${startedServer.url}/#/server`);
}

export async function applyElectronServerConfig(next: ServerLaunchConfig) {
  if (!startedServer || restarting) return;
  restarting = true;
  const previous = startedServer;
  const previousPreferences = previous.app.get(PREFERENCES);
  const previousConfig = { ...(activeConfig || getConfigLaunchOptions()) };
  try {
    if (next.listen !== undefined) previousPreferences.set({ saasPort: next.listen });
    if (resolveServerProtocol(previousPreferences) !== previous.mode) {
      // 换协议先整机重启。
      await previous.close();
      app.relaunch();
      app.exit(0);
      return;
    }
    mainWindow?.webContents.stop();
    // 只换传输层：协议、端口、证书都在传输层内部从 Preferences 重新解析，Nest/DI/ORM 不动
    let transport = previous.transport;
    if (resolveServerProtocol(previousPreferences) === previous.mode) {
      await transport.relisten();
    } else {
      transport = await switchServerTransport(previous.app, previous.transport);
    }
    startedServer = {
      ...previous,
      transport,
      mode: transport.mode,
      port: transport.port,
      url: transport.url,
      advertisedUrl: next.baseURL || transport.url.replace("127.0.0.1", getLocalIp()),
    };
    if (activeConfig) Object.assign(activeConfig, next, { listen: transport.port });
    setElectronClientOrigin(transport.url);
    await mainWindow?.loadURL(`${transport.url}/#/server`);
  } catch (error) {
    // 回滚只是把传输层按旧协议重新绑回同一个 Nest 实例，不重建任何东西
    try {
      previousPreferences.set({ saasPort: previous.port });
      if (activeConfig) Object.assign(activeConfig, previousConfig);
      const transport = await createServerTransport(previous.app, { mode: previous.mode });
      await transport.listen();
      startedServer = {
        ...previous,
        transport,
        mode: transport.mode,
        port: transport.port,
        url: transport.url,
        advertisedUrl: previous.advertisedUrl,
      };
      setElectronClientOrigin(transport.url);
      await mainWindow?.loadURL(`${transport.url}/#/server`).catch(() => undefined);
    } catch {
      startedServer = null;
      setElectronClientOrigin(null);
    }
    throw error;
  } finally {
    restarting = false;
  }
}

async function bootstrap() {
  await app.whenReady();
  createElectronClientToken();
  const config = getConfigLaunchOptions();
  config.listen = undefined;
  config.hostname = undefined;
  activeConfig = config;
  await loadServer(config);
  bindNestApplicationShutdown(app, {
    close: async () => {
      await startedServer?.close();
      clearElectronClientToken();
    },
  });
  createTray();
  registerElectronServerLifecycle({
    getConfig: () => config,
    getStartedServer: () => startedServer,
    persistConfig: async (next) => {
      Object.assign(config, next);
    },
    applyConfig: async (next) => {
      await applyElectronServerConfig(next);
      Object.assign(config, next);
    },
  });
  app.on("activate", () => {
    if (!mainWindow) void loadServer(config);
  });
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault()
  callback(true)
})
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}
ipcMain.on("hide-window", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.hide();
});
process.on("uncaughtException", async (error) => {
  console.error("Electron uncaught exception", error);
  await dialog.showErrorBox("启动失败", error instanceof Error ? error.message : String(error));
  clearElectronClientToken();
  app.quit();
});

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  void bootstrap().catch(async (error) => {
    console.error("Electron bootstrap failed", error);
    await dialog.showErrorBox("启动失败", error instanceof Error ? error.message : String(error));
    clearElectronClientToken();
    app.quit();
  });
}
