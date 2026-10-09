import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 设置只针对此中间件应用的路由有效的 CORS 头部
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 如果是 OPTIONS 预检请求，立即响应并结束
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }
    // 非 OPTIONS 请求，继续后续处理
    next();
  }
}