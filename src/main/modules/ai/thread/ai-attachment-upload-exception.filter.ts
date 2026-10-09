import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common'
import type { Response } from 'express'

@Catch(PayloadTooLargeException)
export class AiAttachmentUploadExceptionFilter implements ExceptionFilter<PayloadTooLargeException> {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(413).json({
      code: 'error',
      message: 'AI_ATTACHMENT_LIMIT_EXCEEDED',
    })
  }
}
