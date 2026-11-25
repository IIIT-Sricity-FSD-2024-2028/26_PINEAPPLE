import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';

@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const acceptEncoding = (req.headers['accept-encoding'] || '') as string;
    if (!acceptEncoding.includes('gzip')) {
      return next();
    }

    const originalWrite = res.write;
    const originalEnd = res.end;
    const chunks: Buffer[] = [];

    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    };

    res.end = function (chunk: any, ...args: any[]): any {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);

      const contentType = String(res.getHeader('content-type') || '');
      const isCompressible =
        !contentType ||
        contentType.includes('json') ||
        contentType.includes('text') ||
        contentType.includes('javascript') ||
        contentType.includes('xml');

      if (
        body.length > 1024 &&
        isCompressible &&
        !res.getHeader('content-encoding') &&
        !res.headersSent
      ) {
        try {
          const compressed = zlib.gzipSync(body);
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Length', compressed.length);
          res.removeHeader('etag');
          return originalEnd.call(res, compressed);
        } catch (_) {
          // Fallback to uncompressed on any compression error
        }
      }

      return originalEnd.call(res, body);
    };

    next();
  }
}
