import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response } from "express";

@Injectable()
export class LogMiddleware implements NestMiddleware {
  private logger = new Logger("LogMiddleware");
  constructor() {
  }

  use(req: Request, res: Response, next: () => void) {
    req.timing = {};
    const t = Date.now();
    res.on("finish", ()=> {
      const cost  = Date.now() - t;
      if (req.url.startsWith("/api/")) {
        // this.logger.log(`${req.url} ${res.statusCode} ${cost/1000} ${req.header("referer") || "-" } ${req.header("user-agent") || "-" }`);
        if (cost > 100) {
          this.logger.warn(`total: ${cost}ms, ${JSON.stringify(req.timing)}`);
        }
      }
    });
    next();
  }
}