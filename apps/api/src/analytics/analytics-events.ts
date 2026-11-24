import type { AnalyticsEntityType, AnalyticsEventType } from '@prisma/client';

export const CLICK_EVENTS: AnalyticsEventType[] = [
  'STORE_CLICK',
  'EVENT_CLICK',
  'CAMPAIGN_CLICK',
  'CINEMA_CLICK',
  'MOVIE_CLICK',
  'MOVIE_SESSION_CLICK',
  'SLIDER_CLICK',
  'LINK_CLICK',
];
export const VIEW_EVENTS: AnalyticsEventType[] = [
  'PAGE_VIEW',
  'STORE_VIEW',
  'EVENT_VIEW',
  'CAMPAIGN_VIEW',
  'CINEMA_VIEW',
  'MOVIE_VIEW',
  'SLIDER_VIEW',
];
export const EVENT_ENTITIES: Partial<Record<AnalyticsEventType, AnalyticsEntityType[]>> = {
  STORE_VIEW: ['STORE'],
  STORE_CLICK: ['STORE'],
  EVENT_VIEW: ['EVENT'],
  EVENT_CLICK: ['EVENT'],
  CAMPAIGN_VIEW: ['CAMPAIGN'],
  CAMPAIGN_CLICK: ['CAMPAIGN'],
  CINEMA_VIEW: ['CINEMA'],
  CINEMA_CLICK: ['CINEMA'],
  MOVIE_VIEW: ['MOVIE'],
  MOVIE_CLICK: ['MOVIE'],
  MOVIE_SESSION_CLICK: ['MOVIE_SESSION'],
  SLIDER_VIEW: ['SLIDER'],
  SLIDER_CLICK: ['SLIDER'],
  PAGE_VIEW: ['PAGE'],
  LINK_CLICK: ['CUSTOM'],
};
/** Store paths without query strings, fragments, credentials, or external hosts. */
export function analyticsPath(value?: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value.split(/[?#]/)[0]!.slice(0, 512);
}
