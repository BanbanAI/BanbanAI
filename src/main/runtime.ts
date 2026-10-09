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
    return path.join(os.homedir(), "AppData", "Roaming", process.env.APP_DATA_NAME || "ds-banban");
  },

  getProductionSrcPath() {
    return path.dirname(require.main?.path || process.cwd());
  },
};

export const getRuntime = (): Runtime => runtime;
