import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { PortalLocale } from './i18n/portal-locales';
import { RECIPES_TITLE_KEY } from './swagger.constants';
import { getLocaleDictionary } from './locales';

/** Minimal OpenAPI document for the Developer Portal "Recipes" page. */
export function buildRecipesDocument(locale: PortalLocale): OpenAPIObject {
  const dict = getLocaleDictionary(locale);

  return {
    openapi: '3.1.0',
    info: {
      title: dict[RECIPES_TITLE_KEY] ?? 'Recipes',
      version: '1.0.0',
      description: dict['recipes.markdown'] ?? '',
    },
    paths: {},
    tags: [],
  };
}

export function recipesPathForLocale(locale: PortalLocale): string {
  return `/developer/recipes/${locale}.json`;
}
