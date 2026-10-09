import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Post, Req } from "@nestjs/common";
import { WarehouseRest } from "../client";
import { ProjectService } from "../project/project.services";
import { Preferences } from "../common";
import { PREFERENCES } from "@main/constants";
import { Request } from "express";

@Controller("market")
export class MarketController {
  constructor(
    private readonly warehouseRest: WarehouseRest,
    private readonly projectService: ProjectService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) { }

  private async resolveTemplateDetail(templateId: string) {
    const normalizedTemplateId = templateId?.trim();
    if (!normalizedTemplateId) {
      throw new BadRequestException("Missing template id");
    }

    const result = await this.warehouseRest.getTemplateDetailById(normalizedTemplateId);
    let data = result?.data ?? null;
    if (!data) {
      throw new NotFoundException("Template detail not found");
    }

    return {
      templateId: normalizedTemplateId,
      data,
    };
  }

  @Post("install-template-app")
  async installTemplateApp(
    @Body("templateId") templateId: string,
    @Body("parentId") parentId: string,
    @Body("groupId") groupId: string,
    @Req() req: Request,
  ) {
    const { templateId: normalizedTemplateId, data } = await this.resolveTemplateDetail(templateId);
    const downloadUrl = typeof data?.path === "string" ? data.path.trim() : "";
    if (!downloadUrl) {
      throw new BadRequestException("Template download path not found");
    }

    const title = typeof data?.title === "string" ? data.title.trim() : "";
    const result = await this.projectService.installTemplateAppFromUrl(downloadUrl, {
      filename: `${title || normalizedTemplateId}.bb`,
      parentId: parentId?.trim() || "",
      groupId: groupId?.trim() || "",
    }, req?.account);

    if (result.meta) {
      return result;
    }

    throw new BadRequestException(result.reason || "Install template app failed");
  }
}
