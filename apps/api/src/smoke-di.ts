/**
 * Boots the full Nest application context (no HTTP listen) to surface
 * dependency-injection and module wiring errors at process start.
 *
 * Requires DATABASE_URL and a reachable DB (PrismaService connects on init).
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function main(): Promise<void> {
  const logger = new Logger('SmokeDi');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  logger.log('Application context created; DI graph resolved.');
  await app.close();
  logger.log('Closed cleanly.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
