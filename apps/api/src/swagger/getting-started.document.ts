import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { PortalLocale } from './i18n/portal-locales';
import { GETTING_STARTED_TITLE_KEY } from './swagger.constants';
import { getLocaleDictionary } from './locales';

/**
 * Minimal OpenAPI document for the Developer Portal "Getting Started" page.
 * Rendered as a separate Scalar document — not merged into the main API spec.
 */
export function buildGettingStartedDocument(locale: PortalLocale): OpenAPIObject {
  const dict = getLocaleDictionary(locale);

  return {
    openapi: '3.1.0',
    info: {
      title: dict[GETTING_STARTED_TITLE_KEY] ?? 'Getting Started',
      version: '1.0.0',
      description: dict['gettingStarted.markdown'] ?? '',
    },
    paths: {},
    tags: [],
  };
}

export function gettingStartedPathForLocale(locale: PortalLocale): string {
  return `/developer/getting-started/${locale}.json`;
}
