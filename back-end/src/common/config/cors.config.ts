import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function parseCorsOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins || !rawOrigins.trim()) {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsOptions(rawOrigins?: string): CorsOptions {
  const allowedOrigins = parseCorsOrigins(
    rawOrigins !== undefined ? rawOrigins : process.env.CORS_ORIGINS,
  );

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, supertest, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check against allowed origins list
      if (allowedOrigins.includes(origin) || (allowedOrigins.includes('*') && origin !== 'null')) {
        callback(null, true);
        return;
      }

      // Origin not permitted: omit Access-Control-Allow-Origin
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Idempotency-Key',
      'idempotency-key',
      'x-user-role',
      'x-user-id',
      'x-user-email',
    ],
    exposedHeaders: ['X-Boot-Id', 'Retry-After'],
    maxAge: 86400, // 24 hours preflight caching
  };
}
