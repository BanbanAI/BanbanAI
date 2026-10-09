import { Injectable, Logger } from "@nestjs/common";
import { Rest } from "./base.rest";


@Injectable()
export class WarehouseRest extends Rest {
  protected readonly logger = new Logger("WarehouseRest");

  async getTemplateDetailById(id: string) {
    try {
      return await this.get(this.sign(`/theme/theme-detail?id=${encodeURIComponent(id)}`));
    } catch (err) {
      this.logger.warn(`getTemplateDetailById failed: ${id}`, err);
      return null;
    }
  }

}
