import { ApiSearchOption, ApiQueryOption } from './type';
import { Controller, Get, Param, Query, Post, Body, Put, Delete, UseGuards, UseFilters, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiService } from './api.service';
import { NoLocalAuthGuard } from '../auth/guards';
import { Row, TableUID } from '@common/types/project';
import { ApiAccessGuard, RequestTypeGet } from './guards';
import { ApiExceptionFilter } from './filters';
import { FileInterceptor } from '@nestjs/platform-express';
import os from "os";

const uploadDir = os.tmpdir();

@NoLocalAuthGuard()
@UseGuards(ApiAccessGuard)
@UseFilters(ApiExceptionFilter)
@Controller('api/v1')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @RequestTypeGet()
  @Get(':appId')
  async loadFormList(
    @Param('appId') appId: string
  ) {
    return await this.apiService.loadFormList(appId);
  }

  @Post(':appId/file')
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  async uploadFile(
    @Param('appId') appId: string,
    @UploadedFile() file: any,
  ) {
    return await this.apiService.uploadFile(file, appId);
  }

  @RequestTypeGet()
  @Get(':appId/:formId')
  async loadFormDataList(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Query() query: ApiQueryOption
  ) {
    return await this.apiService.loadFormDataList(appId, formId, query);
  }

  @RequestTypeGet()
  @Get(':appId/toc/:formId')
  async loadFormDataTreeTemp(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Query() query: ApiQueryOption
  ) {
    return await this.apiService.loadFormDataTree(appId, formId, query);
  }

  @RequestTypeGet()
  @Get(':appId/:formId/toc')
  async loadFormDataTree(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Query() query: ApiQueryOption
  ) {
    return await this.apiService.loadFormDataTree(appId, formId, query);
  }

  @RequestTypeGet()
  @Get(':appId/:formId/search')
  async flexsearchFormDataList(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Query() query: ApiSearchOption,
  ) {
    return await this.apiService.flexSearchFormDataList(appId, formId, query);
  }

  @RequestTypeGet()
  @Get(':appId/:formId/:id')
  async loadFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: string,
    @Param('id') id: string,
    @Query() query: ApiSearchOption,
  ) {
    return await this.apiService.loadFormDataRow(appId, formId, id, query);
  }

  @Post(':appId/:formId')
  async createLoadFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Body('data') row?: Row
  ) {
    return await this.apiService.createLoadFormData(appId, formId, row);
  }

  @Put(':appId/:formId/:docId')
  async editLoadFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Param('docId') docId: string,
    @Body('data') row?: Row
  ) {
    return await this.apiService.editLoadFormData(appId, formId, docId, row);
  }

  @Put(':appId/:formId')
  async editLoadFormDataByFilter(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Query() query: ApiQueryOption,
    @Body('data') row?: Row
  ) {
    return await this.apiService.editLoadFormDataByFilter(appId, formId, query, row);
  }

  @Delete(':appId/:formId/:docId')
  async deleteLoadFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Param('docId') docId: string
  ) {
    return await this.apiService.deleteLoadFormData(appId, formId, docId);
  }
}