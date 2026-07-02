/** Supported Developer Portal locales — extend when CMS adds new locales. */
export const PORTAL_LOCALES = ['tr', 'en', 'ru'] as const;
export type PortalLocale = (typeof PORTAL_LOCALES)[number];

/** Default portal language (Turkish). */
export const DEFAULT_PORTAL_LOCALE: PortalLocale = 'tr';

/** CMS locale codes aligned with portal (future: load from DB). */
export const CMS_SUPPORTED_LOCALES: PortalLocale[] = [...PORTAL_LOCALES];

export function isPortalLocale(value: string): value is PortalLocale {
  return (PORTAL_LOCALES as readonly string[]).includes(value);
}

export function openApiPathForLocale(locale: PortalLocale): string {
  return locale === DEFAULT_PORTAL_LOCALE ? '/openapi.json' : `/openapi.${locale}.json`;
}

export function openApiFileNameForLocale(locale: PortalLocale): string {
  return locale === DEFAULT_PORTAL_LOCALE ? 'openapi.json' : `openapi.${locale}.json`;
}

/** Frontend developer portal OpenAPI (public endpoints only). */
export function openApiDeveloperPathForLocale(locale: PortalLocale): string {
  return locale === DEFAULT_PORTAL_LOCALE ? '/openapi.developer.json' : `/openapi.developer.${locale}.json`;
}

export function openApiDeveloperFileNameForLocale(locale: PortalLocale): string {
  return locale === DEFAULT_PORTAL_LOCALE ? 'openapi.developer.json' : `openapi.developer.${locale}.json`;
}
