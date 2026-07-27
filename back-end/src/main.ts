import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

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
  const app = await NestFactory.create(AppModule);
  const port = parsePort(process.env.PORT);
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

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
    allowedHeaders: ['Content-Type', 'Accept', 'x-user-role', 'x-user-id', 'x-user-email'],
  });

  // 2. Enable Global Validation Pipe for strict DTO enforcement
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips away non-decorated payload properties
      forbidNonWhitelisted: true, // Throws 400 if unknown properties are passed
      transform: true, // Automatically transforms payloads to DTO instances
    }),
  );

  // 3. Initialize Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('TeamForge API')
    .setDescription('The Student Project Collaboration Platform REST API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Exposed at http://localhost:<PORT>/api

  await app.listen(port);
  console.log(`🚀 Backend is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation is available at: http://localhost:${port}/api`);
}
bootstrap();
