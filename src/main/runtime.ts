import os from "os";
import path from "path";

interface Runtime {
  readonly isProduction: boolean;
  getUserDataPath(): string;
  getProductionSrcPath(): string;
  setOpenAtLogin(onoff: boolean): void;
}

const runtime: Runtime = {
  isProduction: Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg)
    || process.env.NODE_ENV === "production",

  getUserDataPath() {
    const appDataName = process.env.APP_DATA_NAME || "ds-banban";
    switch (process.platform) {
      case "win32":
        return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appDataName);
      case "darwin":
        return path.join(process.env.HOME || os.homedir(), "Library", "Application Support", appDataName);
      default:
        return path.join(process.env.HOME || os.homedir(), ".config", appDataName);
    }
  },

  getProductionSrcPath() {
    return path.dirname(require.main?.path || process.cwd());
  },

  setOpenAtLogin(onoff: boolean) {
    if (!process.versions.electron) return;
    const { app } = require("electron") as typeof import("electron");
    if (!app.isPackaged) return;
    app.setLoginItemSettings({ openAtLogin: onoff });
  },
};

export const getRuntime = (): Runtime => runtime;
