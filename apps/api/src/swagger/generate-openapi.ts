/**
 * Generates localized openapi JSON files at build time.
 * Requires DATABASE_URL (Prisma connects on module init).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument, validateOpenApiDocument } from './swagger-document.factory';
import {
  assertDeveloperPortalSpec,
  filterOpenApiForDeveloperPortal,
} from './filter-developer-portal-openapi';
import { localizeAllDocuments, localizeOpenApiDocument } from './i18n/localize-document';
import { validateLocaleParity } from './locales';
import {
  openApiDeveloperFileNameForLocale,
  openApiFileNameForLocale,
  PORTAL_LOCALES,
} from './i18n/portal-locales';

async function main(): Promise<void> {
  const logger = new Logger('OpenApiGenerate');

  validateLocaleParity();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  const base = createOpenApiDocument(app);
  validateOpenApiDocument(base);

  const localized = localizeAllDocuments(base);
  const outDir = join(process.cwd(), 'openapi');
  mkdirSync(outDir, { recursive: true });

  for (const locale of PORTAL_LOCALES) {
    const doc = localized[locale];
    validateOpenApiDocument(doc);
    const fileName = openApiFileNameForLocale(locale);
    const outPath = join(outDir, fileName);
    writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
    logger.log(`OpenAPI [${locale}] → ${outPath} (${Object.keys(doc.paths ?? {}).length} paths)`);

    const developerDoc = localizeOpenApiDocument(filterOpenApiForDeveloperPortal(base), locale);
    assertDeveloperPortalSpec(developerDoc);
    const devFileName = openApiDeveloperFileNameForLocale(locale);
    const devOutPath = join(outDir, devFileName);
    writeFileSync(devOutPath, JSON.stringify(developerDoc, null, 2), 'utf8');
    logger.log(
      `Developer OpenAPI [${locale}] → ${devOutPath} (${Object.keys(developerDoc.paths ?? {}).length} public paths)`,
    );
  }

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
