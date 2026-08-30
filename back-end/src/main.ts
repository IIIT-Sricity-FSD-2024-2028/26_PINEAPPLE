import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ErrorLoggerMiddleware } from './core/middleware/error-logger.middleware';
import { LogManagerService } from './core/services/log-manager.service';
import * as path from 'path';

function parsePort(rawPort: string | undefined): number {
  const parsed = Number(rawPort);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
}

function parseCorsOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins || !rawOrigins.trim()) {
    return ['*'];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = parsePort(process.env.PORT);
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

  const app = await NestFactory.create(AppModule);
  const port = parsePort(process.env.PORT);
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

  // 0. Serve uploaded files as static assets at /uploads/*
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // 1. Enable CORS for frontend integration
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || origin === 'null') {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-user-role', 'x-user-id', 'x-user-email', 'x-admin-scope'],
  });

  // 2. Enable Global Validation Pipe for strict DTO enforcement
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips away non-decorated payload properties
      forbidNonWhitelisted: true, // Throws 400 if unknown properties are passed
      transform: true, // Automatically transforms payloads to DTO instances
    }),
  );

  // 3. Register Global Exception Filter (Error Handling Middleware)
  //    Catches all HttpExceptions and unhandled errors, logs them to files
  const logManager = app.get(LogManagerService);
  app.useGlobalFilters(new HttpExceptionFilter(logManager));

  // 4. Initialize Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('TeamForge API')
    .setDescription('The Student Project Collaboration Platform REST API')
    .setVersion('1.0')
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
