import { Controller, Get, Param, Query, Post, Body, Put, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { OfficeService } from './office.service';
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import os from "os";

const uploadDir = os.tmpdir();
@Controller("office")
export class OfficeController {
  constructor(private readonly officeService: OfficeService) {}

  @Get("check-office-plugin")
  async checkOfficePlugin() {
    return await this.officeService.checkOfficePlugin()
  }

  @Post("install-office-plugin")
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  async installOfficePlugin(@UploadedFile() file: File) {
    return await this.officeService.installOfficePlugin(file.path);
  }

  @Post("start-up")
  async startUp() {
    return await this.officeService.startup();
  }
}
