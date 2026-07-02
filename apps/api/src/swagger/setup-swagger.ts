import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { createOpenApiDocument } from './swagger-document.factory';
import { renderDeveloperPortalPage } from './developer-portal.page';
import { buildGettingStartedDocument, gettingStartedPathForLocale } from './getting-started.document';
import { buildRecipesDocument, recipesPathForLocale } from './recipes.document';
import {
  assertDeveloperPortalSpec,
  filterOpenApiForDeveloperPortal,
} from './filter-developer-portal-openapi';
import { detectPortalLocale } from './i18n/detect-locale';
import { localizeAllDocuments, localizeOpenApiDocument } from './i18n/localize-document';
import type { PortalLocale } from './i18n/portal-locales';
import {
  DEFAULT_PORTAL_LOCALE,
  openApiDeveloperPathForLocale,
  openApiPathForLocale,
  PORTAL_LOCALES,
} from './i18n/portal-locales';

export const OPENAPI_JSON_PATH = '/openapi.json';
export const SWAGGER_UI_PATH = 'api/docs';
export const DEVELOPER_PORTAL_PATH = '/developer';

let cachedBaseDocument: OpenAPIObject | null = null;
let cachedLocalized: Partial<Record<PortalLocale, OpenAPIObject>> = {};
let cachedDeveloperLocalized: Partial<Record<PortalLocale, OpenAPIObject>> = {};

function getBaseDocument(app: INestApplication): OpenAPIObject {
  if (!cachedBaseDocument) {
    cachedBaseDocument = createOpenApiDocument(app);
  }
  return cachedBaseDocument;
}

function getLocalizedDocument(app: INestApplication, locale: PortalLocale): OpenAPIObject {
  if (!cachedLocalized[locale]) {
    const all = localizeAllDocuments(getBaseDocument(app));
    cachedLocalized = all;
  }
  return cachedLocalized[locale]!;
}

export function getOpenApiDocument(app: INestApplication, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): OpenAPIObject {
  return getLocalizedDocument(app, locale);
}

function getDeveloperLocalizedDocument(app: INestApplication, locale: PortalLocale): OpenAPIObject {
  if (!cachedDeveloperLocalized[locale]) {
    const filtered = filterOpenApiForDeveloperPortal(getBaseDocument(app));
    assertDeveloperPortalSpec(filtered);
    cachedDeveloperLocalized[locale] = localizeOpenApiDocument(filtered, locale);
  }
  return cachedDeveloperLocalized[locale]!;
}

export function getDeveloperPortalOpenApiDocument(
  app: INestApplication,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): OpenAPIObject {
  return getDeveloperLocalizedDocument(app, locale);
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const defaultDoc = getLocalizedDocument(app, DEFAULT_PORTAL_LOCALE);

  SwaggerModule.setup(SWAGGER_UI_PATH, app, defaultDoc, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Modern CMS — Swagger UI',
  });

  const http = app.getHttpAdapter();

  for (const locale of PORTAL_LOCALES) {
    const path = openApiPathForLocale(locale);
    http.get(path, (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json(getLocalizedDocument(app, locale));
    });

    const developerPath = openApiDeveloperPathForLocale(locale);
    http.get(developerPath, (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json(getDeveloperLocalizedDocument(app, locale));
    });

    const gsPath = gettingStartedPathForLocale(locale);
    http.get(gsPath, (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json(buildGettingStartedDocument(locale));
    });

    const recipesPath = recipesPathForLocale(locale);
    http.get(recipesPath, (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json(buildRecipesDocument(locale));
    });
  }

  http.get(DEVELOPER_PORTAL_PATH, (req: Request, res: Response) => {
    const locale = detectPortalLocale(
      req.headers['accept-language'],
      typeof req.query.lang === 'string' ? req.query.lang : undefined,
    );
    res.type('html').send(renderDeveloperPortalPage(locale));
  });

  return defaultDoc;
}
