import { Module } from "@nestjs/common";
import { HandwrittenSignatureController } from "./controller";
import { HandwrittenSignatureService } from "./service";

@Module({
  controllers: [HandwrittenSignatureController],
  providers: [
    HandwrittenSignatureService,
    {
      provide: "HANDWRITTEN_SIGNATURE_SERVICE",
      useFactory(handwrittenSignatureService: HandwrittenSignatureService) {
        return handwrittenSignatureService;
      },
      inject: [HandwrittenSignatureService]
    }
  ]
})
export class HandwrittenSignatureModule {}
