import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildRouteAuthMatrixDocument } from '../src/common/utils/route-auth-matrix';

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.AUTH_MODE = 'jwt';
  process.env.SCHEDULER_ENABLED = 'false';

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const matrix = buildRouteAuthMatrixDocument(app);
  const outArg = process.argv.find((arg) => arg.startsWith('--out='));
  const targetPath = outArg
    ? path.resolve(process.cwd(), outArg.slice('--out='.length))
    : path.resolve(__dirname, '../test/route-auth-matrix.draft.json');

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  console.log(`Generated ${matrix.routes.length} routes -> ${targetPath}`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
