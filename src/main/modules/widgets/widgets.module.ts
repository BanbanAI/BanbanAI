import { Module } from "@nestjs/common";
import { ProjectModule } from "@main/modules/project/project.module";
import { UploaderModule } from "./form/uploader/module";
import { HandwrittenSignatureModule } from "./form/handwrittenSignature/module";
import { WidgetController } from "./widget.controller";

@Module({
  imports: [
    ProjectModule,
    UploaderModule,
    HandwrittenSignatureModule,
  ],
  controllers: [WidgetController],
})
export class WidgetsModule {}
