import 'reflect-metadata';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

function assertProductionSafety(config: ConfigService, logger: Logger): void {
  if (config.get<string>('NODE_ENV') !== 'production') {
    return;
  }
  const databaseUrl = config.get<string>('DATABASE_URL')?.trim();
  const redisUrl = config.get<string>('REDIS_URL')?.trim();
  const jwtSecret = config.get<string>('JWT_SECRET')?.trim();
  if (!databaseUrl) {
    logger.error('DATABASE_URL is required in production. Aborting startup.');
    process.exit(1);
  }
  if (!redisUrl) {
    logger.error('REDIS_URL is required in production. Aborting startup.');
    process.exit(1);
  }
  if (!jwtSecret) {
    logger.error('JWT_SECRET is required in production. Aborting startup.');
    process.exit(1);
  }
  if (jwtSecret.length < 32) {
    logger.error('JWT_SECRET must be at least 32 characters in production. Aborting startup.');
    process.exit(1);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(['error', 'warn', 'log']);

  const config = app.get(ConfigService);
  assertProductionSafety(config, logger);

  const port = config.get<number>('API_PORT', 4000);
  const version = config.get<string>('APP_VERSION') ?? '0.0.0';
  const gitSha = config.get<string>('APP_GIT_SHA') ?? 'unknown';
  const buildTime = config.get<string>('APP_BUILD_TIME') ?? 'unknown';

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

  logger.log(
    `API listening on port ${port} (NODE_ENV=${config.get<string>('NODE_ENV') ?? 'development'}, version=${version}, git=${gitSha}, buildTime=${buildTime})`,
  );
  logger.log('Routes: GET /health, GET /health/ready, GET /version');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
