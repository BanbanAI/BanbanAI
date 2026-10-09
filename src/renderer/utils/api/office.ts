
import axios from 'axios';

export type OfficeStartupFailureType = 'dll' | 'timeout';

export type OfficeStartupResult = false | {
  success: boolean,
  type?: OfficeStartupFailureType,
};

export type OfficePluginStatus = {
  installed: boolean,
  running: boolean,
  startupType?: OfficeStartupFailureType,
};

export const officeApi = {
  async checkOfficePlugin(): Promise<{ installed?: boolean, running?: boolean }> {
    try {
      const { data } = await axios.get("/office/check-office-plugin");
      return data;
    } catch (err) {
      console.error(err);
      return {};
    }
  },
  async installOfficePlugin(options: FormData) {
    const { data } = await axios.post("/office/install-office-plugin", options, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  },
  async startUp(): Promise<OfficeStartupResult> {
    try {
      const { data } = await axios.post<OfficeStartupResult>("/office/start-up");
      return data;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  async ensureOfficePluginReady(): Promise<OfficePluginStatus> {
    const status = await this.checkOfficePlugin();
    if (!status.installed || status.running) {
      return {
        installed: !!status.installed,
        running: !!status.running,
      };
    }

    const startup = await this.startUp();
    return {
      installed: true,
      running: !!startup && startup.success,
      startupType: startup && !startup.success ? startup.type : undefined,
    };
  },
}
