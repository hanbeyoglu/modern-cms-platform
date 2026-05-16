// ── Media ─────────────────────────────────────────────────────────────────────

export interface CmsMediaAsset {
  id: string;
  url: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  dominantColor: string | null;
}

// ── SEO ───────────────────────────────────────────────────────────────────────

export interface CmsSeoMeta {
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  image: string | null;
  /** Always null from the API — compute on frontend from slug + baseUrl. */
  canonicalUrl: string | null;
  locale: string | null;
}

// ── Response Envelope ─────────────────────────────────────────────────────────

export interface CmsEnvelopeTenant {
  id: string;
  mallId: string | null;
}

export interface CmsEnvelope<T> {
  success: true;
  locale: string | null;
  tenant: CmsEnvelopeTenant;
  data: T;
}

export interface CmsPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CmsPaginatedEnvelope<T> {
  success: true;
  locale: string | null;
  tenant: CmsEnvelopeTenant;
  pagination: CmsPaginationMeta;
  data: T[];
}

export interface CmsErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ── Entity Types ──────────────────────────────────────────────────────────────

export interface CmsSlider {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  desktopMedia: CmsMediaAsset | null;
  mobileMedia: CmsMediaAsset | null;
  videoMedia: CmsMediaAsset | null;
  linkType: string;
  linkValue: string | null;
  buttonText: string | null;
  targetDevice: string;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
}

export interface CmsEvent {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: CmsMediaAsset | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  category: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
  seo: CmsSeoMeta;
}

export interface CmsCampaign {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: CmsMediaAsset | null;
  startAt: string | null;
  endAt: string | null;
  terms: string | null;
  couponCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
  store: { id: string; name: string; slug: string } | null;
  seo: CmsSeoMeta;
}

export interface CmsPageBlock {
  id: string;
  type: string;
  title: string | null;
  dataJson: unknown;
  sortOrder: number;
}

export interface CmsPageAttachment {
  id: string;
  title: string | null;
  description: string | null;
  mediaId: string;
  sortOrder: number;
  downloadable: boolean;
  media: CmsMediaAsset | null;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  type: string;
  customTypeLabel: string | null;
  contentHtml: string | null;
  renderMode: 'HTML' | 'SINGLE_PDF' | 'DOCUMENT_LIST';
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: string | null;
  attachments: CmsPageAttachment[];
  blocks: CmsPageBlock[];
  seo: CmsSeoMeta;
}

export interface CmsStore {
  id: string;
  mallId: string;
  name: string;
  description: string | null;
  floor: string | null;
  storeNo: string | null;
  phone: string | null;
  email: string | null;
  workingHoursJson: unknown;
  locationJson: unknown;
  isFeatured: boolean;
  isSoon: boolean;
  searchTags: string[];
  sortOrder: number;
  logo: CmsMediaAsset | null;
  globalStore: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    logo: CmsMediaAsset | null;
  };
  categories: { id: string; name: string; slug: string }[];
  /** @deprecated Use categories[0] */
  category: { id: string; name: string; slug: string } | null;
  seo: CmsSeoMeta;
}

export interface CmsCinema {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: CmsMediaAsset | null;
}

export interface CmsMovieSession {
  id: string;
  cinema: { id: string; name: string; slug: string };
  movie: { id: string; title: string; slug: string; durationMinutes: number | null };
  hallName: string | null;
  startsAt: string;
  endsAt: string | null;
  language: string | null;
  subtitle: string | null;
  format: string | null;
  ticketUrl: string | null;
}

export interface CmsHomeResponse {
  locale: string | null;
  defaultLocale: string | null;
  sliders: CmsSlider[];
  featuredStores: CmsStore[];
  upcomingEvents: CmsEvent[];
  activeCampaigns: CmsCampaign[];
  todayMovieSessions: CmsMovieSession[];
}

export interface CmsSupportedLocale {
  code: string;
  name: string;
  rtl: boolean;
}

export interface CmsLocationInfo {
  id: string;
  type: string;
  name: string;
  displayName: string | null;
  slug: string;
  websiteUrl: string | null;
  phone: string | null;
  supportEmail: string | null;
  logo: CmsMediaAsset | null;
  cover: CmsMediaAsset | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    district: string | null;
    country: string | null;
    postalCode: string | null;
  } | null;
  coordinates: { latitude: number; longitude: number } | null;
  timezone: string | null;
  workingHours: unknown;
  socialLinks: unknown;
}

export interface CmsSiteConfig {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  mallId: string | null;
  mallName: string | null;
  mallSlug: string | null;
  location: CmsLocationInfo | null;
  supportedLocales: CmsSupportedLocale[];
  defaultLocale: string | null;
  activeLocale: string | null;
  rtl: boolean;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface CmsSearchHit {
  /** Lowercase entity type: 'page' | 'event' | 'campaign' | 'store' | 'movie' | 'cinema' */
  type: string;
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  image: string | null;
  /** Relative API URL to fetch the full entity */
  url: string;
  locale: string | null;
}

export interface CmsSearchResponse {
  results: CmsSearchHit[];
}

// ── Analytics Events ──────────────────────────────────────────────────────────

export type CmsAnalyticsEventType =
  | 'page_view'
  | 'campaign_view'
  | 'campaign_click'
  | 'event_view'
  | 'store_view'
  | 'search'
  | 'slider_click'
  | 'movie_session_click'
  | 'cinema_view';

export interface CmsAnalyticsEvent {
  /** Event type identifier */
  type: CmsAnalyticsEventType;
  /** Entity ID being tracked (campaign id, event id, etc.) */
  entityId?: string;
  /** Entity slug for readability */
  slug?: string;
  /** Active locale code */
  locale: string;
  /** Tenant identifier */
  tenantId: string;
  /** Mall/location identifier (when applicable) */
  mallId?: string;
  /** Search query (for 'search' events) */
  query?: string;
  /** Result count (for 'search' events) */
  resultCount?: number;
  /** Timestamp (ISO 8601); defaults to now if omitted */
  timestamp?: string;
  /** Additional arbitrary metadata */
  meta?: Record<string, string | number | boolean | null>;
}
