import { Controller, ForbiddenException, Get, Req } from "@nestjs/common";
import { Request } from "express";
import { ScheduleDefinitionService } from "./schedule-definition-service";
import { isSystemAdminAccount } from "@common/types/account";

@Controller("form-data/scheduled-trigger")
export class ScheduledTriggerController {
  constructor(private readonly scheduleDefinitionService: ScheduleDefinitionService) {}

  @Get("status")
  async getStatus(@Req() req: Request) {
    if (!isSystemAdminAccount(req.account)) throw new ForbiddenException("Administrator access is required");
    return this.scheduleDefinitionService.getStatus();
  }
}
