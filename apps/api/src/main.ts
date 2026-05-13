import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 4000);

  // Global exception filters — order matters: more specific first
  app.useGlobalFilters(new MulterExceptionFilter(), new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serve uploaded files from storage root at /uploads prefix
  const storageRoot = config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
  if (!existsSync(storageRoot)) {
    mkdirSync(storageRoot, { recursive: true });
  }
  app.useStaticAssets(storageRoot, { prefix: '/uploads' });

  const corsOrigins = config.get<string>('CORS_ORIGINS', '');
  if (corsOrigins.trim().length > 0) {
    app.enableCors({
      origin: corsOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    });
  } else {
    app.enableCors({ origin: true });
  }

  app.enableShutdownHooks();
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
