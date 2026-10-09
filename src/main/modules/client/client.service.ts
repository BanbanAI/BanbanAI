import { Inject, Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import md5 from 'md5';
import dayjs from 'dayjs';
import { diskSize } from '@common/utils';
import { NOCODES_DIR, PREFERENCES, UPLOADS_DIR } from '@main/constants';
import { getDirSize } from '@main/utils';
import checkDiskSpace from 'check-disk-space';
import { cp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Preferences } from '../common';
import { DbManager } from '../formData/db.manager';
import { getRuntime } from '@main/runtime';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
    private readonly dbManager: DbManager,
  ) {}

  async showOpenDialog() {
    if (__IS_SERVER__) throw new Error('Storage path is only available in Electron');
    let folderDir: string | null = null;
    try {
      const { BrowserWindow, dialog } = await import('electron');
      const window = BrowserWindow.getAllWindows()[0];
      const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
      if (!result.canceled) folderDir = result.filePaths[0] || null;
    } catch {
      folderDir = null;
    }
    return { folderDir, productionPath: process.cwd() };
  }

  async getRootDir() {
    return this.preferences.get('rootDir') || await getRuntime().getUserDataPath();
  }

  async setRootDir(dir: string) {
    if (__IS_SERVER__ || !dir?.trim()) throw new Error('Invalid storage path');
    let needSize = 0;
    const copyNocodes = existsSync(this.nocodesDir);
    const copyUploads = existsSync(this.uploadsDir);
    if (copyNocodes) needSize += await getDirSize(this.nocodesDir);
    if (copyUploads) needSize += await getDirSize(this.uploadsDir);
    const diskSpace = await checkDiskSpace(dir);
    if (diskSpace.free < needSize) {
      throw new Error(global.i18next.t('clientServiceTs.diskSizeInvalid', { size: diskSize(needSize) }));
    }
    await this.dbManager.closeAll();
    const targetNocodesDir = join(dir, 'nocodes');
    const targetUploadsDir = join(dir, 'uploads');
    if (copyNocodes) await cp(this.nocodesDir, targetNocodesDir, { recursive: true });
    if (copyUploads) await cp(this.uploadsDir, targetUploadsDir, { recursive: true });
    await rm(this.nocodesDir, { recursive: true, force: true });
    await rm(this.uploadsDir, { recursive: true, force: true });
    this.preferences.set({ rootDir: dir });
    return dir;
  }

  async relaunch() {
    try {
      if (__IS_SERVER__) {
        this.restartServerProcess();
        return { restarting: true };
      }
      const { app } = await import('electron');
      app.relaunch();
      app.exit(0);
      return { restarting: true };
    } catch (error) {
      this.logger.error(`relaunch app failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private restartServerProcess() {
    this.logger.log("restart server process for pending system migration");
    setTimeout(() => {
      process.exit(0);
    }, 500);
  }

  async getLocalImage(url: string, timestamp: string, sign: string) {
    // 校验sign
    if (dayjs().isAfter(dayjs(Number(timestamp)).add(1, "minute"))) {
      // 校验失败
      return null;
    }
    const _sign = md5(`${timestamp}${url}`);
    if (_sign !== sign) {
      // 校验失败
      return null;
    }

    return await readFile(url)
  }

}
