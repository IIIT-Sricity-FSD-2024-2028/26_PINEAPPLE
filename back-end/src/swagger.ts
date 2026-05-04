import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function generateSwaggerJson() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('TeamForge API')
    .setDescription('The Student Project Collaboration Platform REST API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const docsDir = join(__dirname, '..', 'docs');
  mkdirSync(docsDir, { recursive: true });
  const outputPath = join(docsDir, 'swagger.json');

  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
  console.log(`Swagger JSON generated at: ${outputPath}`);

  await app.close();
}

generateSwaggerJson().catch((error) => {
  console.error(error);
  process.exit(1);
});
