import os from "os";
import path from "path";

interface Runtime {
  readonly isProduction: boolean;
  getUserDataPath(): string;
  getProductionSrcPath(): string;
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
};

export const getRuntime = (): Runtime => runtime;
