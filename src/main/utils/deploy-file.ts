import path from 'path';
import fs from 'fs';
import { mkdir, rm } from 'fs/promises';
import { unzip } from '@main/utils/zip';
import os from 'os';
import { Logger } from "@nestjs/common";

export class DepolyFile {
  private _unzipDir: string;
  private readonly logger = new Logger("DepolyFile");
  constructor(
    private readonly filePath: string,
  ) {
  }

  set unzipDir(value: string){
    this._unzipDir = value;
  }
  get unzipDir(): string{
    return this._unzipDir;
  }

  async unzipFile() {
    const stat = fs.lstatSync(this.filePath);
    if (stat.isDirectory()) {
      this.unzipDir = this.filePath;
      return this.unzipDir;
    } else {
      this.unzipDir = path.join(os.tmpdir(), "bingo_" + Date.now());
    }
    console.log('first', this.unzipDir);
    if (!fs.existsSync(this.unzipDir)) {
      await mkdir(this.unzipDir, { recursive: true });
    }
    await unzip(this.filePath, this.unzipDir).then(res => {
      return res;
    }).catch((err) => {
      if(Array.isArray(err)) {
        this.logger.error('unzip error', err);
        throw new Error(global.i18next.t("depolyFileTs.fileBroken"));
      }else {
        console.log("[project-controller unzip error]", err);
        throw new Error(err.message);
      }
    });
    return this.unzipDir;
  }

  async destroy() {
    return await rm(this.unzipDir, { recursive: true });
  }
}
