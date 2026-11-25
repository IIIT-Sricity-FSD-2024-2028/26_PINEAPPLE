import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';

try {
  const possibleEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8');
      for (const line of envConfig.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...values] = trimmed.split('=');
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = values.join('=').trim();
          }
        }
      }
      break;
    }
  }
} catch (err: any) {
        console.warn('[main] Suppressed non-critical error:', err?.message || err);
      }

const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ErrorLoggerMiddleware } from './core/middleware/error-logger.middleware';
import { LogManagerService } from './core/services/log-manager.service';
import { TimingInterceptor } from './core/interceptors/timing.interceptor';
import { getCorsOptions } from './common/config/cors.config';

function parsePort(rawPort: string | undefined): number {
  const parsed = Number(rawPort);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = parsePort(process.env.PORT);

  // 0. Parse cookies for refresh tokens
  app.use(cookieParser());

  // 0.1 Note: Uploaded files under /uploads/* are served through UploadsController
  // with X-Content-Type-Options: nosniff, attachment disposition for non-images/PDFs,
  // and SVG serving disabled (Phase 20).

  // 1. Enable CORS for frontend integration
  app.enableCors(getCorsOptions());

  // 2. Enable Global Validation Pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips away non-decorated payload properties
      forbidNonWhitelisted: false, // Strips unknown properties gracefully instead of rejecting with 400
      transform: true, // Automatically transforms payloads to DTO instances
    }),
  );

  // 2.1 Performance Timing Interceptor (behind PERF_LOG flag)
  app.useGlobalInterceptors(new TimingInterceptor());

  // 3. Register Global Exception Filter (Error Handling Middleware)
  //    Catches all HttpExceptions and unhandled errors, logs them to files
  const logManager = app.get(LogManagerService);
  app.useGlobalFilters(new HttpExceptionFilter(logManager));

  // 4. Initialize Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('TeamForge API')
    .setDescription('The Student Project Collaboration Platform REST API with JWT, Firebase and Legacy Auth')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Exposed at http://localhost:<PORT>/api

  // 5. Register Express-level error handler (safety net for uncaught errors)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(ErrorLoggerMiddleware.getExpressErrorHandler());

  await app.listen(port);
  console.log(`🚀 Backend is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation is available at: http://localhost:${port}/api`);
  console.log(`📁 Logs directory: ./logs/ (flushed every 30 seconds)`);
  console.log(`📤 Uploads directory: ./uploads/`);
  console.log(`🔑 Auth Mode: ${process.env.AUTH_MODE || 'jwt'}`);
  console.log('');
  console.log('🔒 Middleware active:');
  console.log('   ✅ Security Headers (all routes)');
  console.log('   ✅ Structured Request Logger (all routes)');
  console.log('   ✅ XSS Input Sanitizer (POST/PATCH/PUT routes)');
  console.log('   ✅ Rate Limiter (sensitive routes)');
  console.log('   ✅ File Upload via Multer (/uploads/*)');
  console.log('   ✅ Global Exception Filter');
  console.log('   ✅ Express Error Handler');
}
bootstrap();
