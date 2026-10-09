import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { ApiException } from './api-exception';


@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (exception instanceof ApiException) {
      response.status(400).json({
        error: exception.toJson(),
      });
    } else if (exception instanceof Error) {
      const status = response.statusCode >= 400 ? response.statusCode: 400;
      response.status(status).json({
        error: {
          code: -1,
          message: exception.message,
        },
      })
    } else {
      response.status(400).json({
        error: {
          code: -1,
          message: "unknow error",
        },
      });
    }
  }
}