import { BadGatewayException, BadRequestException, Controller, Post, Param, Body, Get, Query, UseFilters, Response, UploadedFile, UseInterceptors, Head } from '@nestjs/common'
import { UserRest } from './rest';
import { ClientService } from './client.service';
import axios from "axios";
import { SystemMigrationExportOptions } from '@common/types/system-migration';
import { NoLocalAuthGuard } from '../auth/guards';
import { SystemMigrationService } from './system-migration.service';
import { AmapService } from './amap.service';
import { FileInterceptor } from '@nestjs/platform-express';
import os from "os";
import checkDiskSpace from 'check-disk-space';

const uploadDir = os.tmpdir();
const uploadTempSpaceBufferBytes = 512 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
};

const systemMigrationUploadOptions = {
  dest: uploadDir,
  fileFilter: (req, file, callback) => {
    const contentLength = Number(req.headers?.["content-length"]);
    if (!contentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
      callback(null, true);
      return;
    }
    checkDiskSpace(os.tmpdir()).then((disk) => {
      const needBytes = contentLength + uploadTempSpaceBufferBytes;
      if (disk.free >= needBytes) {
        callback(null, true);
        return;
      }
      callback(new Error(global.i18next.t("SystemMigration.uploadTempSpaceInsufficient", {
        size: formatBytes(needBytes),
      })), false);
    }).catch((error) => {
      callback(error, false);
    });
  },
};

@Controller()
export class ClientController {
  constructor(
    private readonly userRest: UserRest,
    private readonly clientService: ClientService,
    private readonly systemMigrationService: SystemMigrationService,
    private readonly amapService: AmapService,
  ) {}

  @Get('/show-open-dialog')
  async showOpenDialog() {
    return await this.clientService.showOpenDialog();
  }

  @Get('/get-root-dir')
  async getRootDir() {
    return await this.clientService.getRootDir();
  }

  @Post('/set-root-dir')
  async setRootDir(@Body('dir') dir: string) {
    return await this.clientService.setRootDir(dir);
  }
  
  @Post("relaunch")
  async relaunch() {
    return await this.clientService.relaunch();
  }

  @Get("local/image")
  async getLocalImage(@Query("url") url: string, @Query("ts") timestamp: string, @Query("sign") sign: string, @Response() res) {
    const image = await this.clientService.getLocalImage(url, timestamp, sign);
    if (!image) {
      res.status(404).send();
    } else {
      res.set('Content-Type', 'image');
      res.send(image);
    }
  }

  @Get("/oss")
  async getOssResource(@Query() options: {url:string}, @Response() res) {
    const { url } = options;
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });
      const contentType = response.headers['content-type'];
      res.set('Content-Type', contentType);
      res.send(response.data);
    } catch (err) {
      res.status(404).send(err.message)
    }
  }

  @NoLocalAuthGuard()
  @Get("/client/amap/regeo")
  async reverseGeocode(@Query("location") location: string, @Query("mapKey") mapKey: string) {
    return await this.amapService.reverseGeocode(location, mapKey);
  }

  @Head("/proxy")
  async proxyHead(@Query("url") url: string, @Response() res) {
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      throw new BadRequestException("invalid resource url");
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.username || targetUrl.password) {
      throw new BadRequestException("invalid resource url");
    }

    try {
      const response = await axios.head(targetUrl.toString(), {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      res.status(response.status);
      if (response.headers['content-type']) {
        res.set('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.set('Content-Length', response.headers['content-length']);
      }
      res.end();
    } catch {
      throw new BadGatewayException("resource HEAD request failed");
    }
  }

  @Get("/system-migration/export-summary")
  async getSystemMigrationExportSummary() {
    return await this.systemMigrationService.getExportSummary();
  }

  @Post("/system-migration/export-task")
  async startSystemMigrationExportTask(@Body() body: { options?: SystemMigrationExportOptions, taskId?: string }) {
    return await this.systemMigrationService.startPreparedExportPackageTask(body?.options, body?.taskId);
  }

  @Get("/system-migration/export-task/status")
  async getSystemMigrationExportTaskStatus(@Query("taskId") taskId: string) {
    return await this.systemMigrationService.getPreparedExportPackageTaskStatus(taskId);
  }

  @Post("/system-migration/export-task/cleanup")
  async cleanupSystemMigrationExportTask(@Body("taskId") taskId: string) {
    return await this.systemMigrationService.cleanupPreparedExportTask(taskId);
  }

  @Get("/system-migration/export-download")
  async downloadSystemMigrationPackageByQuery(
    @Query("taskId") taskId: string,
    @Response() res,
  ) {
    return await this.systemMigrationService.sendPreparedExportPackageTaskFile(taskId, res);
  }

  @Post("/system-migration/export/cancel")
  async cancelSystemMigrationExport(@Body("taskId") taskId?: string) {
    return await this.systemMigrationService.cancelExport(taskId);
  }

  @Post("/system-migration/upload-package")
  @UseInterceptors(FileInterceptor("file", systemMigrationUploadOptions))
  async uploadSystemMigrationPackage(@UploadedFile() file: any) {
    return await this.systemMigrationService.storeUploadedImportPackage(file);
  }

  @Post("/system-migration/cleanup-upload-package")
  async cleanupSystemMigrationUploadPackage(@Body("packagePath") packagePath: string) {
    return await this.systemMigrationService.cleanupManagedImportPackage(packagePath);
  }

  @Post("/system-migration/inspect")
  async inspectSystemMigrationPackage(@Body("packagePath") packagePath: string) {
    return await this.systemMigrationService.inspectPackage(packagePath);
  }

  @Post("/system-migration/precheck")
  async precheckSystemMigrationPackage(@Body() body: { packagePath: string, rootDir?: string }) {
    return await this.systemMigrationService.precheckImport(body.packagePath, {
      rootDir: body.rootDir,
    });
  }

  @Post("/system-migration/validate-database")
  async validateSystemMigrationDatabase(@Body() body: { packagePath: string, databaseOptions: any }) {
    return await this.systemMigrationService.validateImportDatabase(body.packagePath, body.databaseOptions);
  }

  @Post("/system-migration/import")
  async importSystemMigrationPackage(@Body() body: { packagePath: string, rootDir?: string, databaseOptions?: any }) {
    return await this.systemMigrationService.importPackage(body.packagePath, {
      rootDir: body.rootDir,
      databaseOptions: body.databaseOptions,
    });
  }

  @Get("/system-migration/apply-status")
  async getSystemMigrationApplyStatus() {
    return await this.systemMigrationService.getApplyStatus();
  }

  @Post("/system-migration/apply-status/clear")
  async clearSystemMigrationApplyStatus() {
    return await this.systemMigrationService.clearApplyStatus();
  }

  @Post("/system-migration/retry-apply")
  async retrySystemMigrationApply() {
    return await this.systemMigrationService.retryApply();
  }
}
