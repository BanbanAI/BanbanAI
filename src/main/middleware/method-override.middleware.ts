import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_METHODS = new Set([
  'PUT',
  'PATCH',
  'DELETE',
]);

@Injectable()
export class MethodOverrideMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const overrideMethod = req.headers['x-http-method-override']?.toString()?.toUpperCase();
    if (req.method === 'POST' && overrideMethod && ALLOWED_METHODS.has(overrideMethod)) {
      req.method = overrideMethod;
    }

    next();
  }
}