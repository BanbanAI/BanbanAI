import { ApiException } from '@main/modules/api/filters';
import { ExceptionFilter, Catch, ArgumentsHost, Logger, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger("GlobalExceptionFilter");
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // this.logger.debug("catch exception", exception);
    if (exception instanceof ApiException) {

      const error = exception.toJson();

      response.status(400).json({
        code: error.code ?? 400,
        message: error.message,
        ...error,
      });

      return;
    }
    if (exception instanceof HttpException) {
      if (/^[\x20-\x7E\t]*$/.test(exception.message)) {
        response.statusMessage = exception.message;
      }
      response.status(exception.getStatus()).json({
        code: exception["code"] ?? "error",
        message: exception.message,
      });
    } else if (exception instanceof Error) {
      response.status(response.statusCode >= 400 ? response.statusCode: 400).json({
        code: exception["code"] ?? "error",
        message: exception.message,
      });
    } else {
      response.status(400).json({
          code: "unknown",
          message: "unknown",
          exception,
        });
    }
  }
}
