import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { NoLocalAuthGuard } from "@main/modules/auth/guards/local-auth.guard";
import { HandwrittenSignatureService } from "./service";

@NoLocalAuthGuard()
@Controller("signature")
export class HandwrittenSignatureController {
  constructor(
    @Inject("HANDWRITTEN_SIGNATURE_SERVICE")
    private readonly handwrittenSignatureService: HandwrittenSignatureService
  ) {}

  @Post("session/create")
  createSession(
    @Body("sessionId") sessionId: string,
    @Body("fieldUid") fieldUid: string,
    @Body("nocodeId") nocodeId: string,
    @Body("launchUrl") launchUrl: string
  ) {
    return this.handwrittenSignatureService.createSession({
      sessionId,
      fieldUid,
      nocodeId,
      launchUrl
    });
  }

  @Get("session/status")
  getSessionStatus(@Query("sessionId") sessionId: string) {
    return this.handwrittenSignatureService.getSessionStatus(sessionId);
  }

  @Post("session/complete")
  completeSession(
    @Body("sessionId") sessionId: string,
    @Body("signatureUrl") signatureUrl: string,
    @Body("saveForReuse") saveForReuse: boolean
  ) {
    return this.handwrittenSignatureService.completeSession(sessionId, signatureUrl, saveForReuse);
  }

  @Post("session/cancel")
  cancelSession(@Body("sessionId") sessionId: string) {
    return this.handwrittenSignatureService.cancelSession(sessionId);
  }

}
