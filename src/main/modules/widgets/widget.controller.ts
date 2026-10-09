import { Controller, Get, Query, Post, Body, Response } from "@nestjs/common";
import { WidgetManager } from "./widget.manager";
import { readFile } from "fs/promises";
import { WidgetTemplate } from "@common/types/project";
import * as mime from "mime/lite";

@Controller('widget')
export class WidgetController {
  constructor(
    private readonly widgetManager: WidgetManager,
  ) { }
  @Get('all-form-templates')
  async allFormTemplates() {
    return await this.widgetManager.getAllFormTemplates();
  }

  @Get('template-soul')
  async getTemplateSoul(@Query('soulUrl') soulUrl: string) {
    return await this.widgetManager.getBuiltinTemplateSoul(soulUrl);
  }

  @Post('handle-template-resource')
  async handleTemplateResource (@Body('template') template: WidgetTemplate, @Body("nocodeId") nocodeId: string) {
    return this.widgetManager.copyResource(template, nocodeId);
  }

  @Get("template-image")
  async getTemplateImage(@Query('url') url: string, @Response() res){
    const imagePath = await this.widgetManager.getTemplateImagePath(url);
    res.header('Content-Type', mime.getType(imagePath) || 'application/octet-stream');
    const data = await readFile(imagePath);
    res.send(data);
  }
}
