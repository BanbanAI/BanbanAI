import { Global, Module } from "@nestjs/common";
import { WorkbenchController } from "./workbench.controller";
import { WorkbenchService } from "./workbench.service";
import { ProjectModule } from "../project";
import { FormDataModule } from "../formData/form-data.module";
import { OrganizeCacheService } from "./organize-cache.service";

@Global()
@Module({
  imports: [ProjectModule, FormDataModule],
  controllers: [ WorkbenchController ],
  providers: [OrganizeCacheService, WorkbenchService],
  exports: [OrganizeCacheService, WorkbenchService],
})
export class WorkbenchModule {
}
