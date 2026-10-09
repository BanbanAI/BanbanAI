import { Controller, Get, Post, Body, Query, Param, UseGuards, UseInterceptors, UploadedFile, Req, Res, OnModuleInit } from '@nestjs/common';
import { NocodeService } from './nocode.service';
import { FormTableRuntime, KeyValue } from '@common/types/nocode';
import { ConnectionUID, TableUID, Row } from '@common/types/project';
import { NoLocalAuthGuard } from '../auth/guards';
import { FileInterceptor } from "@nestjs/platform-express";
import { ExcelFormColMap, ExcelSubformColMaps } from '@common/types/excel';
import { ReturnMainSign } from './Interceptors/sign.Interceptor';
import { ProjectService } from '../project/project.services';
import { NocodeSyncGuard } from './guards/nocode-sync.guard';
import { Request, Response } from 'express';
import os from "os";

const uploadDir = os.tmpdir();

@Controller('/nocode')
export class NocodeController implements OnModuleInit {
  constructor(
    private readonly nocodeService: NocodeService,
    private readonly projectService: ProjectService,
  ) { }

  async onModuleInit() {
    await this.nocodeService.cleanupStaleImportSessions();
  }

  private getPublicRowShareToken(req: Request) {
    const token = req.headers['x-row-share-token'];
    return Array.isArray(token) ? token[0] : token;
  }

  private getPublicRowShareAccessToken(req: Request) {
    const token = req.headers['x-row-share-access-token'];
    return Array.isArray(token) ? token[0] : token;
  }

  private getPublicFormShareContext(req: Request) {
    const nocodeId = req.headers['x-public-form-share-nocode-id'];
    const tableId = req.headers['x-public-form-share-table-id'];
    const visitToken = req.headers['x-public-share-visit-token'];
    return {
      nocodeId: Array.isArray(nocodeId) ? nocodeId[0] : nocodeId,
      tableId: Array.isArray(tableId) ? tableId[0] : tableId,
      visitToken: Array.isArray(visitToken) ? visitToken[0] : visitToken,
    };
  }

  @NoLocalAuthGuard()
  @Get("read-form-data")
  async readFormData(@Query('nocodeId') nocodeId: string, @Query('tableId') tableId: TableUID, @Query('uuid') uuid: string, @Req() req: Request) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareReadFormData(shareToken, tableId, uuid, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareReadFormData(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableId, uuid, publicFormShare.visitToken);
    }
    return await this.nocodeService.readFormData(nocodeId, tableId, uuid);
  }

  @NoLocalAuthGuard()
  @Get("read-form-list")
  async readFormList(@Query('nocodeId') nocodeId: string, @Query('connectionId') connectionId: ConnectionUID, @Query('tableId') tableId: TableUID, @Req() req: Request) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareReadFormList(shareToken, tableId, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareReadFormList(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableId, publicFormShare.visitToken);
    }
    return await this.nocodeService.readFormList(nocodeId, connectionId, tableId);
  }

  @NoLocalAuthGuard()
  @Get('toc/tableFields/:appId/:tableId')
  async tableFieldList(
    @Param('appId') appId: string,
    @Param('tableId') tableId: TableUID,
    @Query('subType') subType: string[] | string,
    @Req() req: Request,
  ) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareTableFieldList(shareToken, tableId, subType, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareTableFieldList(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableId, subType, publicFormShare.visitToken);
    }
    return await this.nocodeService.tableFieldList(appId, tableId, subType);
  }

  @NoLocalAuthGuard()
  @Get('toc/:appId/:tableId')
  async getTOC(
    @Param('appId') appId: string,
    @Param('tableId') tableId: TableUID,
    @Req() req: Request,
  ) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareTOC(shareToken, tableId, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareTOC(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableId, publicFormShare.visitToken);
    }
    return await this.nocodeService.getTOC(appId, tableId);
  }

  @NoLocalAuthGuard()
  @Post("check-unique-value")
  async checkUniqueValue(@Body("nocodeId") nocodeId: string, @Body("tableId") tableId: TableUID, @Body("uniqueChecks") uniqueChecks: KeyValue[], @Req() req: Request, @Body("uuid") uuid?: KeyValue) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.checkPublicRowShareUniqueValue(shareToken, tableId, uniqueChecks, uuid, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.checkPublicFormShareUniqueValue(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableId, uniqueChecks, uuid, publicFormShare.visitToken);
    }
    return await this.nocodeService.checkUniqueValue(nocodeId, tableId, uniqueChecks, uuid);
  }

  // 富文本编辑器上传资源
  @Post("upload-resource")
  @UseInterceptors(FileInterceptor("file"))
  uploadModelResource(@Body() data, @UploadedFile() file) {
    return this.nocodeService.uploadResource(file, data);
  }

  // 上传文件
  @Post("upload-file")
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  uploadModelFile(@Body() data, @UploadedFile() file) {
    return this.nocodeService.uploadFile(file, data);
  }

  // 读Excel文件
  @Get("read-excel-file")
  readModelFile(
    @Query("fullPath") fullPath: string,
    @Query("maxRows") maxRows: number,
    @Query("sessionId") sessionId?: string,
  ) {
    return this.nocodeService.readExcelFile(fullPath, maxRows, sessionId);
  }

  @Post("cleanup-import-session")
  async cleanupImportSession(@Body("sessionId") sessionId: string) {
    return await this.nocodeService.cleanupImportSession(sessionId);
  }

  // 去重收集Excel文件的列数据
  @Post("create-import-session-from-path")
  async createImportSessionFromPath(
    @Body("fullPath") fullPath: string,
    @Body("filename") filename?: string,
  ) {
    return await this.nocodeService.createImportSessionFromPath(fullPath, { filename });
  }

  @Get("import-excel-progress-stream")
  async importExcelProgressStream(
    @Query("taskId") taskId: string,
    @Res() res: Response,
  ) {
    return await this.nocodeService.createImportExcelProgressStream(taskId, res);
  }

  @Post("collect-column-data")
  async getExcelSheetData(
    @Body("extraData") extraData: any,
    @Body("length") length: number,
    @Body("titleRowIndex") titleRowIndex: number,
  ) {
    return await this.nocodeService.collectColumnData(extraData, length, titleRowIndex);
  }

  // 导入Excel数据
  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("import-excel-data")
  async importExcelData(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("runtime") runtime: FormTableRuntime,
    @Body("extraData") extraData: any,
    @Body("mapping") mapping: ExcelFormColMap,
    @Body("subformMappings") subformMappings: ExcelSubformColMaps,
    @Body("titleRowIndex") titleRowIndex: number,
  ) {
    return await this.nocodeService.importExcelData(nocodeId, tableUID, runtime, extraData, mapping, subformMappings, titleRowIndex);
  }

  // 导出图片和附件
  @Post("export-image-attachment")
  async exportImageAttachment(@Body('selectedColumns') selectedColumns: object[], @Body('rows') rows: Row[], @Body('excelData') excelData:any, @Body('tableName') tableName: string, @Body('tableUID') tableUID: string) {
    return await this.nocodeService.exportImageAttachment(selectedColumns, rows, excelData, tableName, tableUID);
  }
}
