import type { PortalLocale } from './portal-locales';
import { DEFAULT_PORTAL_LOCALE, isPortalLocale } from './portal-locales';

const LOCALE_LABELS: Record<PortalLocale, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
};

/** Parse Accept-Language and return best matching portal locale. */
export function detectPortalLocale(
  acceptLanguage: string | undefined,
  queryLang?: string | undefined,
): PortalLocale {
  if (queryLang && isPortalLocale(queryLang)) {
    return queryLang;
  }

  if (!acceptLanguage?.trim()) {
    return DEFAULT_PORTAL_LOCALE;
  }

  const prefs = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, qPart] = part.trim().split(';');
      const q = qPart?.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1;
      const base = tag.split('-')[0]?.toLowerCase();
      return { base, q };
    })
    .filter((p) => p.base)
    .sort((a, b) => b.q - a.q);

  for (const { base } of prefs) {
    if (isPortalLocale(base)) return base;
  }

  return DEFAULT_PORTAL_LOCALE;
}

export function getLocaleLabel(locale: PortalLocale): string {
  return LOCALE_LABELS[locale];
}

export function getLocaleLabels(): Record<PortalLocale, string> {
  return { ...LOCALE_LABELS };
}
