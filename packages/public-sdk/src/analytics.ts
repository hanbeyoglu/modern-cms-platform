import type { CmsAnalyticsEvent, CmsAnalyticsEventType } from './types';

export type { CmsAnalyticsEvent, CmsAnalyticsEventType };

export interface AnalyticsAdapter {
  track(event: CmsAnalyticsEvent): void | Promise<void>;
}

/**
 * Builds a typed analytics event payload with sensible defaults.
 *
 * @example
 * trackCmsEvent(
 *   { type: 'campaign_click', entityId: 'cld_123', slug: 'summer-sale' },
 *   { locale: 'tr', tenantId: 'ten_abc', mallId: 'mal_xyz' }
 * )
 */
export function buildCmsEvent(
  event: Omit<CmsAnalyticsEvent, 'timestamp'> & { timestamp?: string },
): CmsAnalyticsEvent {
  return {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Console-based analytics adapter for development.
 * Replace with your analytics provider (GA4, Segment, Mixpanel, etc.).
 */
export const consoleAnalyticsAdapter: AnalyticsAdapter = {
  track(event: CmsAnalyticsEvent): void {
    if (typeof console !== 'undefined') {
      console.debug('[CMS Analytics]', event.type, event);
    }
  },
};

/**
 * Null adapter — discards all events. Useful for testing or when analytics is disabled.
 */
export const nullAnalyticsAdapter: AnalyticsAdapter = {
  track(): void {},
};

// ── Pre-built event builders ──────────────────────────────────────────────────

export function pageViewEvent(opts: {
  slug: string;
  locale: string;
  tenantId: string;
  mallId?: string;
}): CmsAnalyticsEvent {
  return buildCmsEvent({ type: 'page_view', slug: opts.slug, locale: opts.locale, tenantId: opts.tenantId, mallId: opts.mallId });
}

export function campaignViewEvent(opts: {
  entityId: string;
  slug: string;
  locale: string;
  tenantId: string;
  mallId?: string;
}): CmsAnalyticsEvent {
  return buildCmsEvent({ type: 'campaign_view', entityId: opts.entityId, slug: opts.slug, locale: opts.locale, tenantId: opts.tenantId, mallId: opts.mallId });
}

export function campaignClickEvent(opts: {
  entityId: string;
  slug: string;
  locale: string;
  tenantId: string;
  mallId?: string;
}): CmsAnalyticsEvent {
  return buildCmsEvent({ type: 'campaign_click', entityId: opts.entityId, slug: opts.slug, locale: opts.locale, tenantId: opts.tenantId, mallId: opts.mallId });
}

export function eventViewEvent(opts: {
  entityId: string;
  slug: string;
  locale: string;
  tenantId: string;
  mallId?: string;
}): CmsAnalyticsEvent {
  return buildCmsEvent({ type: 'event_view', entityId: opts.entityId, slug: opts.slug, locale: opts.locale, tenantId: opts.tenantId, mallId: opts.mallId });
}

export function storeViewEvent(opts: {
  entityId: string;
  slug: string;
  locale: string;
  tenantId: string;
  mallId: string;
}): CmsAnalyticsEvent {
  return buildCmsEvent({ type: 'store_view', entityId: opts.entityId, slug: opts.slug, locale: opts.locale, tenantId: opts.tenantId, mallId: opts.mallId });
}

export function searchEvent(opts: {
  query: string;
  resultCount: number;
  locale: string;
  tenantId: string;
  mallId?: string;
}): CmsAnalyticsEvent {
  return buildCmsEvent({ type: 'search', query: opts.query, resultCount: opts.resultCount, locale: opts.locale, tenantId: opts.tenantId, mallId: opts.mallId });
}
