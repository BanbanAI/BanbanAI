import { Injectable, Inject, Logger } from "@nestjs/common";
import { Rest } from "./base.rest";
import { AxiosError } from "axios";
import { Stream } from "stream";
import { createWriteStream } from "fs";
import { mkdir, readFile } from "fs/promises";
import { getRuntime } from "@main/runtime";
import { getLocalResourceDir } from "@main/utils";
import { dirname, join } from "path";
import * as mime from "mime/lite";

@Injectable()
export class DownloadRest extends Rest {
  protected readonly logger = new Logger("DownloadRest");
  downloadFile(url: string, savePath: string, onDownloadProgress?: (progress: number) => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (/^\/oss/.test(url)) {
        url = url.replace(/^\/oss\?url\=(.*)/, "$1");
      }
      const { data, headers } = await this.get(url, {
        headers: {
          'Connection': 'keep-alive',
        },
        responseType: 'stream',
        timeout: 3600 * 1000, // 1小时
      }, false).catch(({ response, message }: AxiosError<any>) => {
        if (!response) {
          // 响应超时
          return reject(global.i18next.t("projectServicesTs.connectTimeout"));
        }
        const data = response?.data;
        if (data instanceof Stream) {
          let buffer = [];
          data.on('data', (chuck) => {
            buffer.push(chuck);
          }).on('end', () => {
            const bufferText = Buffer.concat(buffer).toString('utf-8');
            const data = JSON.parse(bufferText);
            if (data?.reason) {
              return reject(data.reason);
            }
          });
          return;
        } else {
          reject(message);
        }
        return response.data;
      });
      let curSize = 0;
      const totalLength = +headers['content-length'];
      await mkdir(dirname(savePath), { recursive: true });
      const writer = createWriteStream(savePath);
      let lastUpdateTime = 0;
      data.on('data', (chunk) => {
        curSize += chunk.length;
        if (Date.now() - lastUpdateTime > 100) {
          onDownloadProgress && onDownloadProgress(curSize / totalLength);
          lastUpdateTime = Date.now();
        }
      })
        .pipe(writer)
        .on('finish', () => {
          this.logger.log('download finish');
          onDownloadProgress && onDownloadProgress(1);
          resolve();
        }).on('close', () => {
          writer.end();
        }).on('error', (err) => {
          writer.end();
          this.logger.debug("request err", url, err);
          reject(err);
        });
    })
  }


  async getRendererFileContent(url: string, base64 = false, isLocal = false): Promise<string | Buffer> {
    const reg = /^\s*data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)?)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s]*?)\s*$/i;
    if (reg.test(url) && base64) return url; //已经是base64
    if (/^\/oss/.test(url)) {
      url = url.replace(/^\/oss\?url\=(.*)/, "$1");
    }
    const runtime = getRuntime();
    const isHttp = /^https?:/.test(url);

    let buffer: Buffer;
    if (!isHttp && (runtime.isProduction)) {
      let filePath: string;
      if (isLocal) {
        const localResourceDir = await getLocalResourceDir();
        filePath = join(localResourceDir, 'projects', url);
      } else {
        const pathname = new URL(url).pathname.replace(/\\/g, "/");
        filePath = join(runtime.getProductionSrcPath(), "renderer", pathname).replace(/\\/g, "/");
      }
      buffer = await readFile(filePath);
    } else {
      if (isLocal) {
        const localResourceDir = await getLocalResourceDir();
        const filePath = join(localResourceDir, 'projects', url);
        buffer = await readFile(filePath);
      } else {
        const result = await this.get(url, {
          responseType: "arraybuffer",
          headers: {
            Connection: 'keep-alive',
          }
        }, false);
        buffer = result.data;
      }
    }
    if (base64) {
      const mimeType = mime.getType(url);
      return `data:${mimeType};base64,` + buffer.toString("base64");
    } else {
      return buffer;
    }
  }
}
