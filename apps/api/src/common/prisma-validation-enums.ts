/**
 * Runtime-safe Prisma enum values for class-validator @IsIn().
 * Prisma enum exports are undefined in the production Docker bundle.
 * Keep in sync with apps/api/prisma/schema.prisma.
 */

export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED'] as const;
export const MALL_STATUSES = ['DRAFT', 'LIVE', 'MAINTENANCE', 'CLOSED'] as const;
export const LOCATION_TYPES = [
  'SHOPPING_MALL',
  'STORE',
  'MARKET',
  'HOTEL',
  'HOSPITAL',
  'CAMPUS',
  'OFFICE',
  'RESTAURANT',
  'MARINA',
  'RESIDENCE',
  'AIRPORT',
  'CUSTOM',
] as const;
export const MEDIA_ASSET_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export const CHANNELS = ['WEB', 'MOBILE', 'KIOSK', 'SIGNAGE'] as const;
export const SLIDER_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export const SLIDER_PLACEMENT_TYPES = [
  'HOME',
  'CAMPAIGN',
  'EVENT',
  'STORE',
  'LOCATION',
  'CUSTOM',
] as const;
export const SLIDER_LINKED_ENTITY_TYPES = ['CAMPAIGN', 'EVENT', 'STORE', 'LOCATION'] as const;
export const STORE_CATEGORY_STATUSES = ['ACTIVE', 'PASSIVE'] as const;
export const STORE_STATUSES = ['ACTIVE', 'PASSIVE', 'ARCHIVED'] as const;
export const CONTENT_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export const CINEMA_STATUSES = ['ACTIVE', 'PASSIVE', 'ARCHIVED'] as const;
export const MOVIE_STATUSES = ['ACTIVE', 'PASSIVE', 'ARCHIVED'] as const;
export const MOVIE_SESSION_STATUSES = ['SCHEDULED', 'CANCELLED', 'ARCHIVED'] as const;
export const CINEMA_PROVIDER_TYPES = ['MANUAL', 'API', 'XML_FEED'] as const;
export const PAGE_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export const PAGE_TYPES = [
  'STANDARD',
  'LANDING',
  'LEGAL',
  'CONTACT',
  'CUSTOM',
  'ABOUT',
  'KVKK',
  'PRIVACY_POLICY',
  'COOKIE_POLICY',
  'TERMS_OF_USE',
  'CONTACT_INFO',
  'FAQ',
  'TRANSPORTATION',
  'CERTIFICATES',
  'DOCUMENTS',
  'AWARDS',
] as const;
export const PAGE_BLOCK_STATUSES = ['ACTIVE', 'PASSIVE'] as const;
export const LOCALIZED_ENTITY_TYPES = [
  'PAGE',
  'PAGE_BLOCK',
  'SLIDER',
  'SLIDER_ITEM',
  'EVENT',
  'CAMPAIGN',
  'STORE',
  'MOVIE',
  'CINEMA',
  'LOCATION',
  'POPUP',
  'SERVICE',
] as const;
export const ANALYTICS_ENTITY_TYPES = [
  'PAGE',
  'SLIDER',
  'EVENT',
  'CAMPAIGN',
  'STORE',
  'CINEMA',
  'MOVIE',
  'MOVIE_SESSION',
  'FORM',
  'CUSTOM',
] as const;
export const ANALYTICS_EVENT_TYPES = [
  'PAGE_VIEW',
  'SLIDER_VIEW',
  'SLIDER_CLICK',
  'EVENT_VIEW',
  'EVENT_CLICK',
  'CAMPAIGN_VIEW',
  'CAMPAIGN_CLICK',
  'STORE_VIEW',
  'STORE_CLICK',
  'CINEMA_VIEW',
  'MOVIE_VIEW',
  'MOVIE_SESSION_CLICK',
  'FORM_SUBMIT',
  'CUSTOM',
] as const;
export const NOTIFICATION_TYPES = ['SYSTEM', 'CONTENT', 'SCHEDULING', 'ANALYTICS', 'SECURITY'] as const;
export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'] as const;
