import { ServerLaunchConfig, StartedServer } from "../server-runtime";

export type ElectronServerLifecycle = {
  getConfig: () => ServerLaunchConfig;
  getStartedServer?: () => StartedServer | null;
  persistConfig: (config: ServerLaunchConfig) => Promise<void>;
  applyConfig: (config: ServerLaunchConfig) => Promise<void>;
};

let lifecycle: ElectronServerLifecycle | null = null;

export const registerElectronServerLifecycle = (value: ElectronServerLifecycle) => {
  lifecycle = value;
};

export const getElectronServerLifecycle = () => lifecycle;
