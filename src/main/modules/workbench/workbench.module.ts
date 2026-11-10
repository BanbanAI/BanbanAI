import { Global, Module } from "@nestjs/common";
import { WorkbenchController } from "./workbench.controller";
import { WorkbenchService } from "./workbench.service";
import { ProjectModule } from "../project";
import { FormDataModule } from "../formData/form-data.module";
import { OrganizeCacheService } from "./organize-cache.service";
import { ORGANIZE_CACHE_SERVICE } from "@main/constants";

@Global()
@Module({
  imports: [ProjectModule, FormDataModule],
  controllers: [ WorkbenchController ],
  providers: [
    OrganizeCacheService,
    WorkbenchService,
    { provide: ORGANIZE_CACHE_SERVICE, useExisting: OrganizeCacheService },
  ],
  exports: [OrganizeCacheService, WorkbenchService, ORGANIZE_CACHE_SERVICE],
})
export class WorkbenchModule {
}
