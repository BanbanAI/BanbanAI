import { DraftStorageStateFile, DraftStorageStatus } from "@common/types/project";
import { NOCODES_DIR } from "@main/constants";
import { Inject, Injectable, Logger } from "@nestjs/common";
import AsyncLock from "async-lock";
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { readFile, rename, writeFile } from "fs/promises";
import { join } from "path";

const DEFAULT_STATE: DraftStorageStateFile = {
  version: 1,
  tables: {},
};

const STATE_RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const STATE_RENAME_RETRY_DELAYS = [20, 50, 100, 200];

@Injectable()
export class DraftStorageStateService {
  private readonly logger = new Logger("DraftStorageStateService");
  private readonly lock = new AsyncLock({ timeout: 60 * 1000 });

  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {}

  getStatePath(nocodeId: string) {
    return join(this.nocodesDir, nocodeId, "draft-storage.state.json");
  }

  private getStateLockKey(nocodeId: string) {
    return `${nocodeId}:draft-storage-state`;
  }

  async readState(nocodeId: string): Promise<DraftStorageStateFile> {
    const statePath = this.getStatePath(nocodeId);
    if (!existsSync(statePath)) {
      return {
        ...DEFAULT_STATE,
        tables: {},
      };
    }
    try {
      const content = await readFile(statePath, "utf-8");
      const parsed = JSON.parse(content) as DraftStorageStateFile;
      return {
        version: 1,
        tables: parsed?.tables || {},
      };
    } catch (err) {
      this.logger.error("read draft storage state failed", statePath, err);
      return {
        ...DEFAULT_STATE,
        tables: {},
      };
    }
  }

  async getTableStatus(nocodeId: string, optionTableUid: string): Promise<DraftStorageStatus> {
    const state = await this.readState(nocodeId);
    return state.tables?.[optionTableUid]?.status || "legacy";
  }

  async setTableStatus(
    nocodeId: string,
    optionTableUid: string,
    status: DraftStorageStatus,
    extra?: {
      lastError?: string | null,
    },
  ) {
    await this.withStateLock(nocodeId, async () => {
      const state = await this.readState(nocodeId);
      state.tables[optionTableUid] = {
        status,
        updatedAt: new Date().toISOString(),
        lastError: extra?.lastError ?? null,
      };
      await this.writeState(nocodeId, state);
    });
  }

  async withTableLock<T>(nocodeId: string, optionTableUid: string, fn: () => Promise<T>) {
    return await this.lock.acquire(`${nocodeId}:${optionTableUid}`, fn);
  }

  async withStateLock<T>(nocodeId: string, fn: () => Promise<T>) {
    return await this.lock.acquire(this.getStateLockKey(nocodeId), fn);
  }

  private async writeState(nocodeId: string, state: DraftStorageStateFile) {
    const statePath = this.getStatePath(nocodeId);
    const stateDir = join(this.nocodesDir, nocodeId);
    const tempPath = `${statePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await mkdir(stateDir, { recursive: true });
    await writeFile(tempPath, JSON.stringify(state, null, 2), "utf-8");
    try {
      await this.renameStateWithRetry(tempPath, statePath);
    } catch (err) {
      await rm(tempPath, { force: true }).catch(() => {});
      throw err;
    }
  }

  private async renameStateWithRetry(tempPath: string, statePath: string) {
    let lastError = null;
    for (let attempt = 0; attempt <= STATE_RENAME_RETRY_DELAYS.length; attempt++) {
      try {
        await rename(tempPath, statePath);
        return;
      } catch (err) {
        lastError = err;
        if (!STATE_RENAME_RETRY_CODES.has(err?.code) || attempt === STATE_RENAME_RETRY_DELAYS.length) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, STATE_RENAME_RETRY_DELAYS[attempt]));
      }
    }
    throw lastError;
  }
}
