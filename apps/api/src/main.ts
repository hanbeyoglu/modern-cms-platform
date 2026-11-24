import 'reflect-metadata';
import { buildCorsOptions } from './common/cors-options';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';
import { setupSwagger } from './swagger/setup-swagger';
import {
  isObjectStorageConfigured,
  isObjectStorageRequired,
} from './media/object-storage.config';

function assertProductionSafety(config: ConfigService, logger: Logger): void {
  if (config.get<string>('NODE_ENV') !== 'production') {
    return;
  }
  const databaseUrl = config.get<string>('DATABASE_URL')?.trim();
  const redisUrl = config.get<string>('REDIS_URL')?.trim();
  const jwtSecret = config.get<string>('JWT_SECRET')?.trim();
  const jwtRefreshSecret = config.get<string>('JWT_REFRESH_SECRET')?.trim();
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
  if (!jwtRefreshSecret) {
    logger.error('JWT_REFRESH_SECRET is required in production. Aborting startup.');
    process.exit(1);
  }
  if (jwtRefreshSecret.length < 32) {
    logger.error(
      'JWT_REFRESH_SECRET must be at least 32 characters in production. Aborting startup.',
    );
    process.exit(1);
  }
  if (isObjectStorageRequired(config) && !isObjectStorageConfigured(config)) {
    logger.error(
      'Object storage (R2_*) is required in production. Set all R2_* vars or MEDIA_ALLOW_LOCAL_STORAGE=true. Aborting startup.',
    );
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

  const trustedProxies = config.get<string>('TRUST_PROXY')?.trim();
  if (trustedProxies) app.set('trust proxy', trustedProxies.split(',').map((value) => value.trim()).filter(Boolean));

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

  // Local fallback only — object storage serves media via R2_PUBLIC_URL when configured
  if (!isObjectStorageConfigured(config)) {
    const storageRoot = config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
    if (!existsSync(storageRoot)) {
      mkdirSync(storageRoot, { recursive: true });
    }
    app.useStaticAssets(storageRoot, { prefix: '/uploads' });
  }

  // enableCors registers Express cors middleware early so OPTIONS preflight
  // is answered before JwtAuthGuard / PublicApiKeyGuard run.
  const corsOrigins = config.get<string>('CORS_ORIGINS', '');
  app.enableCors(buildCorsOptions(corsOrigins));

  app.enableShutdownHooks();

  setupSwagger(app);

  await app.listen(port);

  logger.log(
    `[service=api] listening port=${port} nodeEnv=${config.get<string>('NODE_ENV') ?? 'development'} version=${version} gitSha=${gitSha} buildTime=${buildTime}`,
  );
  logger.log(
    '[service=api] docs: GET /api/docs (Swagger UI), GET /developer (Scalar), GET /openapi.json',
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
