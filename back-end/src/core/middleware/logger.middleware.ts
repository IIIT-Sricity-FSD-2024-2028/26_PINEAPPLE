import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');
  private logFilePath = path.join(process.cwd(), 'backend-requests.log');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const bodyStr = Object.keys(request.body || {}).length ? JSON.stringify(request.body) : '';

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');

      const logMessage = `${method} ${originalUrl} ${statusCode} ${contentLength} - ${userAgent} ${ip} ${bodyStr ? 'Body: ' + bodyStr : ''}`;
      
      // Log to console
      this.logger.log(logMessage);

      // Log to file for the user to see easily
      const timestamp = new Date().toISOString();
      fs.appendFileSync(this.logFilePath, `[${timestamp}] ${logMessage}\n`);
    });

    next();
  }
}

