import type { CmsEnvelope, CmsPaginationMeta, CmsSeoMeta } from './types';

// ── Locale helpers ────────────────────────────────────────────────────────────

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'dv', 'ha', 'ku', 'ps', 'sd']);

/** Returns true when the given BCP 47 locale code is right-to-left. */
export function isRtlLocale(code: string): boolean {
  const base = code.split('-')[0].toLowerCase();
  return RTL_LOCALES.has(base);
}

/** Returns the language tag portion of a locale code (e.g. "tr" from "tr-TR"). */
export function localeLanguage(code: string): string {
  return code.split('-')[0].toLowerCase();
}

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Builds a full URL for a public API path with query parameters.
 *
 * @example
 * buildApiUrl('https://api.example.com', '/public/events', { locale: 'tr', limit: '10' })
 * // → 'https://api.example.com/public/events?locale=tr&limit=10'
 */
export function buildApiUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Computes a canonical URL for an entity given the frontend's base URL.
 * The CMS API returns null for canonicalUrl — use this helper on the frontend.
 *
 * @example
 * resolveCanonicalUrl({ type: 'event', slug: 'summer-fest' }, 'https://mysite.com')
 * // → 'https://mysite.com/events/summer-fest'
 */
export function resolveCanonicalUrl(
  entity: { type: string; slug: string | null },
  frontendBaseUrl: string,
): string | null {
  if (!entity.slug) return null;
  const pathMap: Record<string, string> = {
    page: `/${entity.slug}`,
    event: `/events/${entity.slug}`,
    campaign: `/campaigns/${entity.slug}`,
    store: `/stores/${entity.slug}`,
    movie: `/movies/${entity.slug}`,
    cinema: `/cinema/${entity.slug}`,
  };
  const path = pathMap[entity.type];
  if (!path) return null;
  return `${frontendBaseUrl.replace(/\/$/, '')}${path}`;
}

/**
 * Merges the CMS seo object with a frontend-computed canonical URL.
 */
export function resolveSeo(seo: CmsSeoMeta, canonicalUrl: string | null): CmsSeoMeta {
  return { ...seo, canonicalUrl };
}

// ── Pagination helpers ────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Converts CmsPaginationMeta to a convenient state object. */
export function parsePagination(meta: CmsPaginationMeta): PaginationState {
  return {
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages,
    hasNext: meta.page < meta.totalPages,
    hasPrev: meta.page > 1,
  };
}

// ── Envelope helpers ──────────────────────────────────────────────────────────

/** Type-guard: returns true if the response is a success envelope. */
export function isSuccess<T>(response: unknown): response is CmsEnvelope<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as { success: boolean }).success === true
  );
}

/** Extracts the data payload from a success envelope, or throws on error. */
export function unwrap<T>(response: CmsEnvelope<T> | { success: false; error: { code: string; message: string } }): T {
  if (!response.success) {
    throw new Error(`CMS API error [${response.error.code}]: ${response.error.message}`);
  }
  return response.data;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Formats an ISO 8601 date string to a locale-aware display string. */
export function formatCmsDate(
  isoString: string | null,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string | null {
  if (!isoString) return null;
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

/** Returns true if a dated entity (event/campaign) is currently active. */
export function isActiveNow(startAt: string | null, endAt: string | null): boolean {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : -Infinity;
  const end = endAt ? new Date(endAt).getTime() : Infinity;
  return now >= start && now <= end;
}
