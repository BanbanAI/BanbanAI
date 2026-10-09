import { Module } from "@nestjs/common";
import { UploaderController } from "./controller";
import { UploaderService } from "./service";

@Module({
  controllers: [UploaderController],
  providers: [
    UploaderService,
    {
      provide: "UPLOADER_SERVICE",
      useFactory(UploaderService: UploaderService) {
        return UploaderService;
      },
      inject: [UploaderService],
    }
  ],
})
export class UploaderModule {
}